// ============================================================
// ROUTES: SELLERS
// Seller application, image upload, own products, own orders.
// EDIT HERE: categories list (CATS), upload size limits
// ============================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const db = require('../db');
const { limit, requireUser } = require('../middleware');

const STATES = require('../states');
const CATEGORIES = require('../categories');
const clean = (v, n) => String(v || '').trim().slice(0, n);
const getSeller = id => db.prepare('SELECT * FROM sellers WHERE user_id = ?').get(id);
const requireSeller = (req, res, next) => {
  const s = getSeller(req.user.id);
  if (!s || s.status !== 'approved') return res.status(403).json({ error: 'Your seller account is not approved.' });
  req.seller = s; next();
};

// ---------- APPLY TO BECOME A SELLER ----------
router.post('/apply', requireUser, limit(5, 60000), (req, res) => {
  const b = req.body || {};
  const f = { store: clean(b.store_name, 80), phone: clean(b.phone, 20), address: clean(b.address, 200), biz: clean(b.business_id, 40),
    state: clean(b.state, 40), city: clean(b.city, 60), bank: clean(b.bank_name, 40), acc: clean(b.account_no, 10), accName: clean(b.account_name, 80) };
  if (f.store.length < 3 || !/^[0-9+\s-]{10,15}$/.test(f.phone) || f.address.length < 5 || !STATES.includes(f.state) || f.city.length < 2 || f.bank.length < 2 || !/^\d{10}$/.test(f.acc) || f.accName.length < 3)
    return res.status(400).json({ error: 'Fill every required field. Account number must be 10 digits.' });
  const ex = getSeller(req.user.id);
  if (ex && ex.status !== 'rejected') return res.status(409).json({ error: 'You already have a seller application.' });
  db.prepare("INSERT OR REPLACE INTO sellers(user_id,store_name,phone,address,business_id,bank_name,account_no,account_name,state,city,status) VALUES (?,?,?,?,?,?,?,?,?,?,'pending')")
    .run(req.user.id, f.store, f.phone, f.address, f.biz, f.bank, f.acc, f.accName, f.state, f.city);
  res.json({ seller: getSeller(req.user.id) });
});
router.get('/me', requireUser, (req, res) => res.json({ seller: getSeller(req.user.id) || null }));

// ---------- IMAGE UPLOAD (JPEG only, shrunk by the browser first) ----------
router.post('/upload', requireUser, requireSeller, limit(30, 60000), express.json({ limit: '2mb' }), (req, res) => {
  const m = String((req.body || {}).data || '').match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
  const buf = m && Buffer.from(m[1], 'base64');
  if (!buf || buf.length > 1.5e6 || buf[0] !== 0xFF || buf[1] !== 0xD8 || buf[2] !== 0xFF) return res.status(400).json({ error: 'Upload a valid photo (JPG/PNG, under 1.5MB).' });
  const dir = process.env.VERCEL ? '/tmp/uploads' : path.join(__dirname, '..', '..', 'public', 'uploads'); fs.mkdirSync(dir, { recursive: true });
  const name = crypto.randomBytes(12).toString('hex') + '.jpg';
  fs.writeFileSync(path.join(dir, name), buf);
  res.json({ url: '/uploads/' + name });
});

// ---------- MY PRODUCTS ----------
router.get('/products', requireUser, requireSeller, (req, res) =>
  res.json(db.prepare('SELECT id,name,category,price,stock,image FROM products WHERE seller_id = ? ORDER BY id DESC').all(req.user.id)));

// ---------- CHECK A LISTING FORM (used by both "add phone" and "edit phone") ----------
function parseListing(b) {
  const cat = CATEGORIES[b.category]; if (!cat) return { err: 'Pick a valid category.' };
  const specs = {};
  for (const f of cat.fields) {
    const v = clean((b.specs || {})[f.key], 60);
    if (f.required && !v) return { err: 'Please fill in: ' + f.label };
    if (f.type === 'select' && v && !f.options.includes(v)) return { err: 'Invalid choice for: ' + f.label };
    specs[f.key] = v;
  }
  const price = Math.round(Number(b.price) * 100), old = Math.round(Number(b.old_price || 0) * 100) || price, stock = Math.floor(Number(b.stock));
  const images = (Array.isArray(b.images) ? b.images : []).filter(u => /^\/uploads\/[a-f0-9]{24}\.jpg$/.test(u)).slice(0, 4);
  const imei = /^\/uploads\/[a-f0-9]{24}\.jpg$/.test(b.imei_photo || '') ? b.imei_photo : null;
  if (!imei) return { err: 'Upload a clear IMEI proof photo (dial *#06# and photograph the screen, or photograph the box sticker).' };
  if (!images.length) return { err: 'Add at least one real photo of the phone you are selling.' };
  if (!(price >= 100 && price <= 1e10) || !(stock >= 0 && stock <= 100000)) return { err: 'Check the price and stock.' };
  const name = [specs.brand, specs.model, specs.storage].filter(Boolean).join(' ');
  return { category: b.category, specs, price, old: Math.max(old, price), stock, images, imei, name, brand: specs.brand || null, key: name.toLowerCase().replace(/\s+/g, ' ') };
}

// ---------- ADD A PHONE ----------
router.post('/products', requireUser, requireSeller, limit(60, 60000), (req, res) => {
  const x = parseListing(req.body || {}); if (x.err) return res.status(400).json({ error: x.err });
  const r = db.prepare("INSERT INTO products(name,category,price,old_price,emoji,rating,stock,seller,seller_id,image,images,verified,brand,model_key,specs,state,city,imei_photo) VALUES (?,?,?,?,'📱',0,?,?,?,?,?,1,?,?,?,?,?,?)")
    .run(x.name, x.category, x.price, x.old, x.stock, req.seller.store_name, req.user.id, x.images[0], JSON.stringify(x.images), x.brand, x.key, JSON.stringify(x.specs), req.seller.state, req.seller.city, x.imei);
  res.json({ id: Number(r.lastInsertRowid) });
});

// ---------- OPEN ONE OF MY PHONES (all details, for the edit form) ----------
router.get('/products/:id', requireUser, requireSeller, (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ? AND seller_id = ?').get(Number(req.params.id), req.user.id);
  p ? res.json(p) : res.status(404).json({ error: 'Phone not found.' });
});

// ---------- EDIT A PHONE (everything: details, price, stock, photos, IMEI photo) ----------
router.put('/products/:id', requireUser, requireSeller, limit(60, 60000), (req, res) => {
  const id = Number(req.params.id);
  if (!db.prepare('SELECT id FROM products WHERE id = ? AND seller_id = ?').get(id, req.user.id)) return res.status(404).json({ error: 'Phone not found.' });
  const x = parseListing(req.body || {}); if (x.err) return res.status(400).json({ error: x.err });
  db.prepare('UPDATE products SET name=?, category=?, price=?, old_price=?, stock=?, image=?, images=?, brand=?, model_key=?, specs=?, imei_photo=?, state=?, city=?, seller=? WHERE id=?')
    .run(x.name, x.category, x.price, x.old, x.stock, x.images[0], JSON.stringify(x.images), x.brand, x.key, JSON.stringify(x.specs), x.imei, req.seller.state, req.seller.city, req.seller.store_name, id);
  res.json({ ok: true });
});

router.patch('/products/:id', requireUser, requireSeller, (req, res) => {
  const price = Math.round(Number(req.body.price) * 100), stock = Math.floor(Number(req.body.stock));
  if (!(price >= 100 && stock >= 0)) return res.status(400).json({ error: 'Invalid price or stock.' });
  const r = db.prepare('UPDATE products SET price = ?, old_price = MAX(old_price, ?), stock = ? WHERE id = ? AND seller_id = ?').run(price, price, stock, Number(req.params.id), req.user.id);
  r.changes ? res.json({ ok: true }) : res.status(404).json({ error: 'Not found.' });
});

// ---------- MY ORDERS (lines containing my products) ----------
router.get('/orders', requireUser, requireSeller, (req, res) =>
  res.json(db.prepare(`SELECT oi.rowid AS line, o.code, o.name AS customer, o.phone, o.address, o.state, o.status, oi.name AS product, oi.qty, oi.fulfil
    FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN products p ON p.id = oi.product_id WHERE p.seller_id = ? AND o.payment_status = 'paid' ORDER BY o.id DESC LIMIT 100`).all(req.user.id)));

router.patch('/orders/:line', requireUser, requireSeller, (req, res) => {
  if (!['Packed', 'Shipped'].includes(req.body.fulfil)) return res.status(400).json({ error: 'Bad status.' });
  const r = db.prepare('UPDATE order_items SET fulfil = ? WHERE rowid = ? AND product_id IN (SELECT id FROM products WHERE seller_id = ?)').run(req.body.fulfil, Number(req.params.line), req.user.id);
  if (!r.changes) return res.status(404).json({ error: 'Not found.' });
  if (req.body.fulfil === 'Shipped') { // when every item of an order is shipped, the order becomes "Shipped"
    const oid = db.prepare('SELECT order_id FROM order_items WHERE rowid = ?').get(Number(req.params.line)).order_id;
    if (!db.prepare("SELECT COUNT(*) c FROM order_items WHERE order_id = ? AND fulfil != 'Shipped'").get(oid).c &&
        db.prepare("UPDATE orders SET status = 'Shipped' WHERE id = ? AND status = 'Paid'").run(oid).changes)
      db.prepare("INSERT INTO order_events(order_id,status) VALUES (?, 'Shipped')").run(oid);
  }
  res.json({ ok: true });
});

// ---------- MY EARNINGS (held = waiting for delivery, available = ready for payout) ----------
router.get('/earnings', requireUser, requireSeller, (req, res) =>
  res.json(db.prepare("SELECT state, COALESCE(SUM(amount),0) AS total FROM ledger WHERE seller_id = ? AND kind = 'sale' GROUP BY state").all(req.user.id)));

module.exports = router;
