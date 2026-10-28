// ============================================================
// ROUTES: ADMIN
// View all orders and change order status. Protected by ADMIN_KEY.
// ============================================================

const db = require('../db');
const { limit, admin } = require('../middleware');
const { settlePayment, releaseFunds, voidFunds, autoRelease } = require('../payments');

const router = require('express').Router();

// ---------- ORDER STATUS OPTIONS (edit the list to add more steps) ----------
const STATUSES = ['Awaiting payment', 'Packed', 'Shipped', 'Out for delivery', 'Delivered', 'Cancelled'];

// ---------- LIST ORDERS ----------
router.get('/orders', limit(60, 60000), admin, (req, res) =>
  res.json({ statuses: STATUSES, orders: db.prepare(`SELECT code, name, phone, email, state, address, total, status, payment_status, reference, created,
    (SELECT GROUP_CONCAT(name || ' x' || qty, '; ') FROM order_items WHERE order_id = orders.id) AS items FROM orders ORDER BY id DESC LIMIT 300`).all() }));

// ---------- UPDATE ORDER STATUS ----------
router.patch('/orders/:code', admin, (req, res) => {
  const { status } = req.body || {};
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Bad status' });
  const o = db.prepare('SELECT id, payment_status FROM orders WHERE code = ?').get(req.params.code);
  if (!o) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, o.id);
  db.prepare('INSERT INTO order_events(order_id,status) VALUES (?,?)').run(o.id, status);
  if (status === 'Delivered' && o.payment_status === 'paid') releaseFunds(req.params.code);   // money becomes payable to the seller
  if (status === 'Cancelled' && o.payment_status === 'paid') voidFunds(req.params.code);       // refund the buyer from Paystack
  res.json({ ok: true });
});

// ---------- DISPUTES: list + resolve ----------
router.get('/disputes', limit(60, 60000), admin, (req, res) =>
  res.json(db.prepare(`SELECT d.*, o.name, o.phone, o.total, o.status AS order_status,
    (SELECT GROUP_CONCAT(name || ' x' || qty, '; ') FROM order_items WHERE order_id = o.id) AS items,
    (SELECT GROUP_CONCAT(DISTINCT s.store_name) FROM order_items i JOIN sellers s ON s.user_id = i.seller_id WHERE i.order_id = o.id) AS stores
    FROM disputes d JOIN orders o ON o.code = d.order_code ORDER BY (d.status='open') DESC, d.id DESC LIMIT 300`).all()));

// action 'refund' -> buyer is refunded (money voided, you refund via Paystack); 'release' -> seller is paid
router.post('/disputes/:id/resolve', admin, (req, res) => {
  const { action, note } = req.body || {};
  const d = db.prepare('SELECT * FROM disputes WHERE id = ?').get(req.params.id);
  if (!d) return res.status(404).json({ error: 'Not found' });
  if (d.status !== 'open') return res.status(409).json({ error: 'Already resolved.' });
  if (!['refund', 'release'].includes(action)) return res.status(400).json({ error: 'Choose refund or release.' });
  const o = db.prepare('SELECT id FROM orders WHERE code = ?').get(d.order_code);
  db.transaction(() => {
    db.prepare("UPDATE disputes SET status = ?, note = ?, resolved = CURRENT_TIMESTAMP WHERE id = ?")
      .run(action === 'refund' ? 'refunded' : 'released', String(note || '').slice(0, 400), d.id);
    if (action === 'refund') {
      voidFunds(d.order_code);
      db.prepare("UPDATE orders SET status = 'Cancelled' WHERE id = ?").run(o.id);
      db.prepare("INSERT INTO order_events(order_id,status) VALUES (?, 'Cancelled')").run(o.id);
    } else {
      db.prepare("UPDATE orders SET status = 'Delivered' WHERE id = ?").run(o.id);
      db.prepare("INSERT INTO order_events(order_id,status) VALUES (?, 'Delivered')").run(o.id);
      releaseFunds(d.order_code);
    }
  })();
  res.json({ ok: true });
});

// ---------- MARK AN ORDER PAID BY HAND (only after you SEE the money in your account, e.g. bank transfer) ----------
router.post('/orders/:code/mark-paid', admin, (req, res) => {
  const o = db.prepare('SELECT total FROM orders WHERE code = ?').get(req.params.code);
  if (!o) return res.status(404).json({ error: 'Not found' });
  const r = settlePayment(req.params.code, 'ADMIN-' + Date.now(), o.total);
  r.ok ? res.json(r) : res.status(400).json(r);
});

// ---------- PAYOUTS: what each seller is owed + your commission earned ----------
router.get('/payouts', limit(60, 60000), admin, (req, res) => res.json({
  platform: db.prepare("SELECT state, COALESCE(SUM(amount),0) AS total FROM ledger WHERE kind = 'commission' GROUP BY state").all(),
  sellers: db.prepare(`SELECT s.user_id, s.store_name, s.bank_name, s.account_no, s.account_name,
    COALESCE(SUM(CASE WHEN l.state = 'available' THEN l.amount END), 0) AS available, COALESCE(SUM(CASE WHEN l.state = 'held' THEN l.amount END), 0) AS held
    FROM sellers s LEFT JOIN ledger l ON l.seller_id = s.user_id AND l.kind = 'sale' GROUP BY s.user_id`).all() }));

router.post('/payouts/:id', admin, (req, res) => {
  const id = Number(req.params.id);
  const amt = db.prepare("SELECT COALESCE(SUM(amount),0) AS t FROM ledger WHERE seller_id = ? AND kind = 'sale' AND state = 'available'").get(id).t;
  if (!amt) return res.status(400).json({ error: 'Nothing available to pay out.' });
  db.transaction(() => {
    db.prepare("UPDATE ledger SET state = 'paid_out' WHERE seller_id = ? AND kind = 'sale' AND state = 'available'").run(id);
    db.prepare('INSERT INTO payouts(seller_id,amount) VALUES (?,?)').run(id, amt);
  })();
  res.json({ paid: amt });
});

// ---------- SELLER APPLICATIONS (review, approve, reject, suspend) ----------
router.get('/sellers', limit(60, 60000), admin, (req, res) =>
  res.json(db.prepare("SELECT s.*, u.email FROM sellers s JOIN users u ON u.id = s.user_id ORDER BY (s.status = 'pending') DESC, s.created DESC").all()));

router.patch('/sellers/:id', admin, (req, res) => {
  const { status, note = '' } = req.body || {}, id = Number(req.params.id);
  if (!['approved', 'rejected', 'suspended'].includes(status)) return res.status(400).json({ error: 'Bad status' });
  if (!db.prepare('UPDATE sellers SET status = ?, note = ? WHERE user_id = ?').run(status, String(note).slice(0, 200), id).changes) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE products SET verified = ? WHERE seller_id = ?').run(status === 'approved' ? 1 : 0, id); // badge follows approval
  res.json({ ok: true });
});

// ---------- OVERVIEW NUMBERS (the dashboard cards) ----------
router.get('/stats', limit(60, 60000), admin, (req, res) => {
  const n = q => db.prepare(q).get().n;
  const c = Object.fromEntries(db.prepare("SELECT state, COALESCE(SUM(amount),0) AS t FROM ledger WHERE kind = 'commission' GROUP BY state").all().map(r => [r.state, r.t]));
  const app = db.prepare("SELECT COUNT(*) AS n, AVG(stars) AS a FROM reviews WHERE kind = 'app'").get();
  res.json({
    pendingSellers: n("SELECT COUNT(*) AS n FROM sellers WHERE status = 'pending'"), approvedSellers: n("SELECT COUNT(*) AS n FROM sellers WHERE status = 'approved'"),
    liveListings: n('SELECT COUNT(*) AS n FROM products WHERE verified = 1 AND seller_id IS NOT NULL'),
    awaitingPayment: n("SELECT COUNT(*) AS n FROM orders WHERE status = 'Awaiting payment'"), toShip: n("SELECT COUNT(*) AS n FROM orders WHERE status = 'Paid'"),
    refundDue: n("SELECT COUNT(*) AS n FROM orders WHERE payment_status = 'refund_due'"),
    openDisputes: n("SELECT COUNT(*) AS n FROM disputes WHERE status = 'open'"),
    commissionEarned: c.available || 0, commissionPending: c.held || 0, appReviews: app.n, appRating: app.a ? Math.round(app.a * 10) / 10 : 0 });
});

// ---------- PHONE LISTINGS (check the IMEI photo, hide bad listings) ----------
router.get('/listings', limit(60, 60000), admin, (req, res) =>
  res.json(db.prepare('SELECT id, name, brand, seller, city, state, price, old_price, stock, image, images, specs, imei_photo, verified FROM products WHERE seller_id IS NOT NULL ORDER BY id DESC LIMIT 200').all()));

router.patch('/listings/:id', admin, (req, res) => {
  if (req.body && ('price' in req.body || 'stock' in req.body)) { // admin edits price / stock
    const price = Math.round(Number(req.body.price) * 100), stock = Math.floor(Number(req.body.stock));
    if (!(price >= 100 && stock >= 0)) return res.status(400).json({ error: 'Invalid price or stock.' });
    const r = db.prepare('UPDATE products SET price = ?, old_price = MAX(old_price, ?), stock = ? WHERE id = ? AND seller_id IS NOT NULL').run(price, price, stock, Number(req.params.id));
    return r.changes ? res.json({ ok: true }) : res.status(404).json({ error: 'Not found' });
  }
  const show = req.body && req.body.show ? 1 : 0, id = Number(req.params.id);
  const r = show
    ? db.prepare("UPDATE products SET verified = 1 WHERE id = ? AND seller_id IN (SELECT user_id FROM sellers WHERE status = 'approved')").run(id)
    : db.prepare('UPDATE products SET verified = 0 WHERE id = ?').run(id);
  r.changes ? res.json({ ok: true }) : res.status(400).json({ error: 'Cannot show this listing (seller not approved).' });
});

module.exports = router;
