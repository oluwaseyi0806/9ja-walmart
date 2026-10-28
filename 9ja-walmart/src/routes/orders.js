// ============================================================
// ROUTES: ORDERS (customer)
// Place an order (guest checkout) and track an order by its code.
// ============================================================

const crypto = require('crypto');
const db = require('../db');
const { limit } = require('../middleware');
const { releaseFunds, hasOpenDispute } = require('../payments');

const router = require('express').Router();

// ---------- PLACE ORDER (validates, checks stock, saves) ----------
router.post('/', limit(10, 60000), (req, res) => {
  const { customer = {}, items = [] } = req.body || {};
  const payment = 'online'; // phones are paid for inside the app only
  const { name, phone, email = '', address, state } = customer;
  if (!name || !phone || !address || !state) return res.status(400).json({ error: 'Please fill in all required fields.' });
  if (!/^[0-9+\s-]{10,15}$/.test(phone)) return res.status(400).json({ error: 'Enter a valid phone number.' });
  if (!Array.isArray(items) || !items.length || items.length > 50) return res.status(400).json({ error: 'Your cart is empty.' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email. Your payment receipt is sent there.' });

  try {
    const result = db.transaction(() => {
      let total = 0; const lines = [];
      for (const it of items) {
        const qty = Math.floor(Number(it.qty));
        const pr = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(it.id));
        if (!pr || qty < 1 || qty > 20) throw new Error('Invalid item in cart.');
        // Atomic stock decrement: fails if not enough stock (prevents overselling)
        const upd = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?').run(qty, pr.id, qty);
        if (!upd.changes) throw new Error(`Sorry, "${pr.name}" is out of stock.`);
        total += pr.price * qty; lines.push([pr, qty]); // price always comes from the DB, never the browser
      }
      const code = '9JA-' + crypto.randomBytes(4).toString('hex').toUpperCase();
      const o = db.prepare('INSERT INTO orders(code,name,phone,email,address,state,payment,total,user_id,status) VALUES (?,?,?,?,?,?,?,?,?,\'Awaiting payment\')')
        .run(code, name, phone, email, address, state, payment, total, req.user ? req.user.id : null);
      lines.forEach(([pr, qty]) => db.prepare('INSERT INTO order_items(order_id,product_id,name,price,qty,seller_id) VALUES (?,?,?,?,?,?)').run(o.lastInsertRowid, pr.id, pr.name, pr.price, qty, pr.seller_id));
      db.prepare('INSERT INTO order_events(order_id,status) VALUES (?,?)').run(o.lastInsertRowid, 'Awaiting payment');
      return { code, total };
    })();
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ---------- TRACK ORDER ----------
router.get('/:code', limit(30, 60000), (req, res) => {
  const o = db.prepare('SELECT id,code,name,state,payment,payment_status,total,status,created FROM orders WHERE code = ?').get(req.params.code.toUpperCase());
  if (!o) return res.status(404).json({ error: 'Order not found.' });
  o.items = db.prepare('SELECT name,price,qty FROM order_items WHERE order_id = ?').all(o.id);
  o.events = db.prepare('SELECT status,at FROM order_events WHERE order_id = ? ORDER BY rowid').all(o.id);
  o.dispute = db.prepare('SELECT status, reason, note FROM disputes WHERE order_code = ? ORDER BY id DESC LIMIT 1').get(o.code) || null;
  o.reviewed = !!db.prepare("SELECT 1 FROM reviews WHERE order_code = ? AND kind = 'app'").get(o.code);
  delete o.id; res.json(o);
});

// ---------- BUYER CONFIRMS "I RECEIVED MY PHONE" (this releases the held money to the seller) ----------
router.post('/:code/confirm', limit(10, 60000), (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE code = ?').get(req.params.code.toUpperCase());
  const digits = v => String(v || '').replace(/\D/g, '').slice(-10);
  if (!o || digits(o.phone) !== digits((req.body || {}).phone)) return res.status(400).json({ error: 'Order code or phone number is wrong.' });
  if (o.payment_status !== 'paid' || !['Shipped', 'Out for delivery'].includes(o.status)) return res.status(400).json({ error: 'This order is not waiting for delivery confirmation.' });
  if (hasOpenDispute(o.code)) return res.status(400).json({ error: 'You reported a problem on this order. Support is reviewing it.' });
  db.prepare("UPDATE orders SET status = 'Delivered' WHERE id = ?").run(o.id);
  db.prepare("INSERT INTO order_events(order_id,status) VALUES (?, 'Delivered')").run(o.id);
  releaseFunds(o.code);
  res.json({ ok: true });
});

// ---------- BUYER REPORTS A PROBLEM (freezes the held money until admin decides) ----------
const REASONS = ['Phone not received', 'Wrong phone', 'Phone is fake or faulty', 'Item not as described', 'Other'];
router.get('/meta/report-reasons', (req, res) => res.json(REASONS));
router.post('/:code/report', limit(10, 60000), (req, res) => {
  const b = req.body || {}, o = db.prepare('SELECT * FROM orders WHERE code = ?').get(req.params.code.toUpperCase());
  const digits = v => String(v || '').replace(/\D/g, '').slice(-10);
  if (!o || digits(o.phone) !== digits(b.phone)) return res.status(400).json({ error: 'Order code or phone number is wrong.' });
  if (o.payment_status !== 'paid') return res.status(400).json({ error: 'Only paid orders can be reported.' });
  if (!db.prepare("SELECT 1 FROM ledger WHERE order_code = ? AND state = 'held'").get(o.code))
    return res.status(400).json({ error: 'The money for this order was already released. Please contact support directly.' });
  if (hasOpenDispute(o.code)) return res.status(409).json({ error: 'You already reported this order. We are reviewing it.' });
  const reason = REASONS.includes(b.reason) ? b.reason : '';
  if (!reason) return res.status(400).json({ error: 'Please choose what went wrong.' });
  db.prepare('INSERT INTO disputes(order_code,reason,detail) VALUES (?,?,?)').run(o.code, reason, String(b.detail || '').trim().slice(0, 600));
  db.prepare("INSERT INTO order_events(order_id,status) VALUES (?, 'Problem reported')").run(o.id);
  res.json({ ok: true });
});

// ---------- BUYER RATES THE STORE AND THE APP (only after delivery is confirmed) ----------
router.post('/:code/review', limit(10, 60000), (req, res) => {
  const b = req.body || {}, o = db.prepare('SELECT * FROM orders WHERE code = ?').get(req.params.code.toUpperCase());
  const digits = v => String(v || '').replace(/\D/g, '').slice(-10);
  if (!o || digits(o.phone) !== digits(b.phone)) return res.status(400).json({ error: 'Order code or phone number is wrong.' });
  if (o.status !== 'Delivered') return res.status(400).json({ error: 'You can rate after you confirm delivery.' });
  if (db.prepare("SELECT 1 FROM reviews WHERE order_code = ? AND kind = 'app'").get(o.code)) return res.status(409).json({ error: 'You already rated this order. Thank you!' });
  const st = v => { const n = Math.floor(Number(v)); return n >= 1 && n <= 5 ? n : 0; };
  const ss = st(b.store_stars), as = st(b.app_stars);
  if (!ss || !as) return res.status(400).json({ error: 'Please give both ratings (1 to 5 stars).' });
  const name = String(o.name).split(' ')[0].slice(0, 30), sc = String(b.store_comment || '').trim().slice(0, 300), ac = String(b.app_comment || '').trim().slice(0, 300);
  db.transaction(() => {
    for (const { seller_id } of db.prepare('SELECT DISTINCT seller_id FROM order_items WHERE order_id = ?').all(o.id)) {
      db.prepare("INSERT INTO reviews(order_code,seller_id,kind,stars,comment,name) VALUES (?,?,'store',?,?,?)").run(o.code, seller_id, ss, sc, name);
      const avg = db.prepare("SELECT AVG(stars) AS a FROM reviews WHERE seller_id = ? AND kind = 'store'").get(seller_id).a;
      db.prepare('UPDATE products SET rating = ? WHERE seller_id = ?').run(Math.round(avg * 10) / 10, seller_id); // cards show the store rating
    }
    db.prepare("INSERT INTO reviews(order_code,seller_id,kind,stars,comment,name) VALUES (?,NULL,'app',?,?,?)").run(o.code, as, ac, name);
  })();
  res.json({ ok: true });
});

module.exports = router;
