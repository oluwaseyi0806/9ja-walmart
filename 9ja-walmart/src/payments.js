// ============================================================
// PAYMENTS CORE
// Commission, held money (escrow), payment confirmation, Paystack calls, expiry of unpaid orders.
// EDIT HERE: COMMISSION_PERCENT in .env. All money rules live here.
// ============================================================

const crypto = require('crypto');
const db = require('./db');
const cfg = require('./config');

// ---------- 1. CONFIRM A PAYMENT (safe to call many times: pays out only once) ----------
function settlePayment(code, reference, amountKobo, currency = 'NGN') {
  return db.transaction(() => {
    const o = db.prepare('SELECT * FROM orders WHERE code = ?').get(code);
    if (!o) return { ok: false, error: 'Order not found' };
    if (o.payment_status === 'paid') return { ok: true, already: true };
    if (Number(amountKobo) !== o.total || currency !== 'NGN') return { ok: false, error: 'Amount mismatch' };
    if (o.status === 'Cancelled') { // customer paid after the 30-minute hold expired -> must be refunded
      db.prepare("UPDATE orders SET payment_status = 'refund_due', reference = ? WHERE id = ?").run(String(reference), o.id);
      return { ok: false, error: 'Order had expired. Refund due.' };
    }
    db.prepare("UPDATE orders SET payment_status = 'paid', status = 'Paid', reference = ?, paid_at = CURRENT_TIMESTAMP WHERE id = ?").run(String(reference), o.id);
    db.prepare("INSERT INTO order_events(order_id,status) VALUES (?, 'Paid')").run(o.id);
    // ---------- 2. SPLIT THE MONEY: seller share + your commission (both HELD until delivery) ----------
    for (const l of db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id)) {
      const gross = l.price * l.qty, fee = Math.round(gross * cfg.COMMISSION_PERCENT / 100);
      db.prepare("INSERT INTO ledger(order_code,seller_id,kind,amount,state) VALUES (?,?,'sale',?,'held')").run(code, l.seller_id, gross - fee);
      db.prepare("INSERT INTO ledger(order_code,seller_id,kind,amount,state) VALUES (?,NULL,'commission',?,'held')").run(code, fee);
    }
    return { ok: true };
  })();
}

// ---------- 3. RELEASE MONEY AFTER DELIVERY / VOID IF CANCELLED ----------
// Money is NEVER released while the buyer has an open complaint on the order.
const hasOpenDispute = code => !!db.prepare("SELECT 1 FROM disputes WHERE order_code = ? AND status = 'open'").get(code);
const releaseFunds = code => hasOpenDispute(code) ? 0 :
  db.prepare("UPDATE ledger SET state = 'available' WHERE order_code = ? AND state = 'held'").run(code).changes;
function voidFunds(code) {
  db.prepare("UPDATE ledger SET state = 'void' WHERE order_code = ? AND state = 'held'").run(code);
  db.prepare("UPDATE orders SET payment_status = 'refund_due' WHERE code = ? AND payment_status = 'paid'").run(code);
}

// ---------- 4. CANCEL UNPAID ORDERS AFTER 30 MINUTES AND PUT PHONES BACK IN STOCK ----------
function expireUnpaid() {
  const old = db.prepare("SELECT id FROM orders WHERE payment_status = 'unpaid' AND status = 'Awaiting payment' AND created < datetime('now','-30 minutes')").all();
  for (const o of old) db.transaction(() => {
    for (const l of db.prepare('SELECT product_id, qty FROM order_items WHERE order_id = ?').all(o.id)) db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(l.qty, l.product_id);
    db.prepare("UPDATE orders SET status = 'Cancelled' WHERE id = ?").run(o.id);
    db.prepare("INSERT INTO order_events(order_id,status) VALUES (?, 'Cancelled (payment not received)')").run(o.id);
  })();
  return old.length;
}

// ---------- 5. PAYSTACK (hosted checkout: card details never touch your server) ----------
async function paystackInit(o) {
  const r = await fetch('https://api.paystack.co/transaction/initialize', { method: 'POST',
    headers: { Authorization: 'Bearer ' + cfg.PAYSTACK_SECRET_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: o.email, amount: o.total, currency: 'NGN', reference: o.code, callback_url: `${cfg.BASE_URL}/?pay=${o.code}` }) });
  const d = await r.json(); if (!d.status) throw new Error(d.message || 'Paystack error'); return d.data.authorization_url;
}
async function paystackVerify(ref) {
  const r = await fetch('https://api.paystack.co/transaction/verify/' + encodeURIComponent(ref), { headers: { Authorization: 'Bearer ' + cfg.PAYSTACK_SECRET_KEY } });
  return (await r.json()).data || {};
}
function validSignature(raw, sig) {
  if (!cfg.PAYSTACK_SECRET_KEY || !sig) return false;
  const h = crypto.createHmac('sha512', cfg.PAYSTACK_SECRET_KEY).update(raw).digest('hex');
  return h.length === String(sig).length && crypto.timingSafeEqual(Buffer.from(h), Buffer.from(String(sig)));
}

module.exports = { settlePayment, releaseFunds, voidFunds, expireUnpaid, autoRelease, hasOpenDispute, paystackInit, paystackVerify, validSignature };

// ---------- 4. AUTO-RELEASE: buyer went quiet after shipping -> pay the seller after AUTO_RELEASE_DAYS ----------
function autoRelease() {
  const rows = db.prepare(`SELECT o.id, o.code FROM orders o
    WHERE o.payment_status = 'paid' AND o.status IN ('Shipped','Out for delivery')
    AND EXISTS (SELECT 1 FROM ledger l WHERE l.order_code = o.code AND l.state = 'held')
    AND (SELECT MAX(e.at) FROM order_events e WHERE e.order_id = o.id AND e.status IN ('Shipped','Out for delivery')) <= datetime('now', ?)`)
    .all(`-${Math.max(1, cfg.AUTO_RELEASE_DAYS)} days`);
  let n = 0;
  for (const o of rows) {
    if (hasOpenDispute(o.code)) continue;
    db.prepare("UPDATE orders SET status = 'Delivered' WHERE id = ?").run(o.id);
    db.prepare("INSERT INTO order_events(order_id,status) VALUES (?, 'Delivered')").run(o.id);
    releaseFunds(o.code); n++;
  }
  return n;
}
