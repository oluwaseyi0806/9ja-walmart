// ============================================================
// ROUTES: CATALOG
// Site settings, phone listings (filter by state/brand), one phone + other stores, brands, suggestions.
// ============================================================

const router = require('express').Router();
const db = require('../db');
const cfg = require('../config');
const STATES = require('../states');
const CATEGORIES = require('../categories');

// ---------- "LOWEST PRICE IN <STATE>" BADGE (same phone, same state, 2+ stores in stock) ----------
const GRP = 'FROM products x WHERE x.model_key = products.model_key AND x.state = products.state AND x.verified = 1 AND x.stock > 0';
const LOW = `, CASE WHEN products.stock > 0 AND (SELECT COUNT(*) ${GRP}) > 1 AND products.price = (SELECT MIN(x.price) ${GRP}) THEN 1 ELSE 0 END AS lowest`;

// ---------- SITE SETTINGS (states, category fields, commission) ----------
router.get('/config', (req, res) => res.json({ states: STATES, categories: CATEGORIES, commission: cfg.COMMISSION_PERCENT, payments: !!cfg.PAYSTACK_SECRET_KEY }));

// ---------- LISTINGS (search, brand, state, sort) ----------
router.get('/products', (req, res) => {
  const { q = '', brand = '', state = '', sort = '' } = req.query;
  let sql = 'SELECT products.*' + LOW + ' FROM products WHERE verified = 1 AND seller_id IS NOT NULL'; const p = [];
  if (q) { sql += ' AND (name LIKE ? OR city LIKE ? OR seller LIKE ? OR specs LIKE ?)'; p.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`); }
  if (brand) { sql += ' AND brand = ?'; p.push(brand); }
  if (state) { sql += ' AND state = ?'; p.push(state); }
  sql += { low: ' ORDER BY price ASC', high: ' ORDER BY price DESC', rating: ' ORDER BY rating DESC' }[sort] || ' ORDER BY id DESC';
  res.json(db.prepare(sql + ' LIMIT 200').all(...p));
});

// ---------- ONE PHONE + OTHER STORES SELLING THE SAME PHONE (cheapest first, your state first) ----------
router.get('/products/:id', (req, res) => {
  const p = db.prepare('SELECT products.*' + LOW + ' FROM products WHERE id = ? AND verified = 1').get(Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'Phone not found.' });
  const offers = db.prepare('SELECT products.*' + LOW + ' FROM products WHERE model_key = ? AND verified = 1 AND id != ? AND stock > 0 ORDER BY (state = ?) DESC, price ASC LIMIT 30').all(p.model_key, p.id, String(req.query.state || p.state));
  res.json({ product: p, offers });
});

// ---------- BRANDS (the chips under the header) ----------
router.get('/categories', (req, res) => res.json(db.prepare('SELECT brand AS name, COUNT(*) AS count FROM products WHERE verified = 1 AND brand IS NOT NULL GROUP BY brand').all()));

// ---------- SEARCH SUGGESTIONS ----------
router.get('/suggest', (req, res) => {
  const q = String(req.query.q || '').trim(); if (!q) return res.json([]);
  res.json(db.prepare("SELECT MIN(id) AS id, name, '📱' AS emoji FROM products WHERE verified = 1 AND name LIKE ? GROUP BY model_key LIMIT 6").all(`%${q}%`));
});

// ---------- FLASH SALE (empty until you mark listings as flash) ----------
router.get('/flash', (req, res) => {
  const now = Date.now(), block = 6 * 3600 * 1000;
  res.json({ serverNow: now, endsAt: Math.ceil((now + 1) / block) * block, items: db.prepare('SELECT * FROM products WHERE flash = 1 AND verified = 1').all() });
});

// ---------- STORE PAGE (details, rating, reviews, phones) ----------
router.get('/stores/:id', (req, res) => {
  const id = Number(req.params.id);
  const store = db.prepare("SELECT user_id, store_name, city, state, address, created FROM sellers WHERE user_id = ? AND status = 'approved'").get(id);
  if (!store) return res.status(404).json({ error: 'Store not found.' });
  const r = db.prepare("SELECT COUNT(*) AS n, AVG(stars) AS avg FROM reviews WHERE seller_id = ? AND kind = 'store'").get(id);
  res.json({ store, rating: { count: r.n, avg: r.avg ? Math.round(r.avg * 10) / 10 : 0 },
    sold: db.prepare("SELECT COUNT(DISTINCT order_code) AS n FROM ledger WHERE seller_id = ? AND kind = 'sale' AND state IN ('available','paid_out')").get(id).n,
    reviews: db.prepare("SELECT stars, comment, name, created FROM reviews WHERE seller_id = ? AND kind = 'store' ORDER BY id DESC LIMIT 20").all(id),
    products: db.prepare('SELECT products.*' + LOW + ' FROM products WHERE seller_id = ? AND verified = 1 ORDER BY stock > 0 DESC, id DESC LIMIT 100').all(id) });
});

// ---------- APP RATING (shown in the footer) ----------
router.get('/app-rating', (req, res) => {
  const r = db.prepare("SELECT COUNT(*) AS n, AVG(stars) AS avg FROM reviews WHERE kind = 'app'").get();
  res.json({ count: r.n, avg: r.avg ? Math.round(r.avg * 10) / 10 : 0 });
});

module.exports = router;
