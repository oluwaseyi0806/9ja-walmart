// ============================================================
// DATABASE
// Opens the SQLite file (data.db), creates tables, adds starter products.
// EDIT HERE: the starter product list below. Delete data.db after changing it to re-seed.
// ============================================================

const { DatabaseSync } = require('node:sqlite'); // built into Node 22.5+ (no install needed)
const path = require('path');

// ---------- 1. CONNECT ----------
const ON_VERCEL = !!process.env.VERCEL; // demo hosting: only /tmp is writable and it resets now and then
const db = new DatabaseSync(ON_VERCEL ? '/tmp/data.db' : path.join(__dirname, '..', 'data.db'));
if (!ON_VERCEL) db.exec('PRAGMA journal_mode = WAL');

// Helper: db.transaction(fn) -> runs fn all-or-nothing (rolls back on any error)
db.transaction = fn => (...args) => {
  db.exec('BEGIN IMMEDIATE');
  try { const r = fn(...args); db.exec('COMMIT'); return r; }
  catch (e) { db.exec('ROLLBACK'); throw e; }
};

// ---------- 2. TABLES (products, orders, order_items, order_events) ----------
db.exec(`
CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY, name TEXT, category TEXT, price INTEGER, old_price INTEGER, emoji TEXT, rating REAL, stock INTEGER, seller TEXT, flash INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY, code TEXT UNIQUE, name TEXT, phone TEXT, email TEXT, address TEXT, state TEXT, payment TEXT, total INTEGER, status TEXT DEFAULT 'Placed', created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS order_items(order_id INTEGER, product_id INTEGER, name TEXT, price INTEGER, qty INTEGER);
CREATE TABLE IF NOT EXISTS order_events(order_id INTEGER, status TEXT, at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_products_cat ON products(category);
`);

// ---------- 2b. ACCOUNTS (users + login sessions) ----------
db.exec(`
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, email TEXT UNIQUE, name TEXT, phone TEXT DEFAULT '', address TEXT DEFAULT '', state TEXT DEFAULT '', salt TEXT, hash TEXT, created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user_id INTEGER, expires INTEGER);
`);
db.exec(`CREATE TABLE IF NOT EXISTS sellers(user_id INTEGER PRIMARY KEY, store_name TEXT, phone TEXT, address TEXT, business_id TEXT, bank_name TEXT, account_no TEXT, account_name TEXT, status TEXT DEFAULT 'pending', note TEXT DEFAULT '', created TEXT DEFAULT CURRENT_TIMESTAMP)`);
// add new columns to older databases (ignored if they already exist)
for (const q of ['ALTER TABLE orders ADD COLUMN user_id INTEGER', 'ALTER TABLE products ADD COLUMN seller_id INTEGER', 'ALTER TABLE products ADD COLUMN image TEXT',
  'ALTER TABLE products ADD COLUMN verified INTEGER DEFAULT 0', "ALTER TABLE order_items ADD COLUMN fulfil TEXT DEFAULT 'Pending'",
  'ALTER TABLE order_items ADD COLUMN seller_id INTEGER', "ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT 'unpaid'", 'ALTER TABLE orders ADD COLUMN reference TEXT', 'ALTER TABLE orders ADD COLUMN paid_at TEXT',
  'ALTER TABLE products ADD COLUMN brand TEXT', 'ALTER TABLE products ADD COLUMN model_key TEXT', 'ALTER TABLE products ADD COLUMN specs TEXT', 'ALTER TABLE products ADD COLUMN state TEXT',
  'ALTER TABLE products ADD COLUMN city TEXT', 'ALTER TABLE products ADD COLUMN images TEXT', 'ALTER TABLE sellers ADD COLUMN state TEXT', 'ALTER TABLE sellers ADD COLUMN city TEXT', 'ALTER TABLE products ADD COLUMN imei_photo TEXT']) { try { db.exec(q); } catch (e) {} }

// ---------- 3. NO STARTER PRODUCTS (phones are added by approved sellers) ----------

// ---------- 4. MONEY TABLES: ledger (who is owed what) + payouts (money sent to sellers) ----------
db.exec(`
CREATE TABLE IF NOT EXISTS ledger(id INTEGER PRIMARY KEY, order_code TEXT, seller_id INTEGER, kind TEXT, amount INTEGER, state TEXT, created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS payouts(id INTEGER PRIMARY KEY, seller_id INTEGER, amount INTEGER, created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_products_model ON products(model_key);
CREATE INDEX IF NOT EXISTS idx_ledger_order ON ledger(order_code);
CREATE TABLE IF NOT EXISTS reviews(id INTEGER PRIMARY KEY, order_code TEXT, seller_id INTEGER, kind TEXT, stars INTEGER, comment TEXT, name TEXT, created TEXT DEFAULT CURRENT_TIMESTAMP);

-- ---------- DISPUTES: a buyer reports a problem; the held money is frozen until admin decides ----------
CREATE TABLE IF NOT EXISTS disputes(id INTEGER PRIMARY KEY, order_code TEXT NOT NULL, reason TEXT NOT NULL, detail TEXT,
  status TEXT NOT NULL DEFAULT 'open',  -- open | refunded | released
  note TEXT, created TEXT DEFAULT CURRENT_TIMESTAMP, resolved TEXT);
CREATE INDEX IF NOT EXISTS idx_disputes_order ON disputes(order_code);
`);
db.exec('DELETE FROM products WHERE seller_id IS NULL'); // removes the old demo products

module.exports = db;

// Demo hosting only: start with a ready-made store so the client has something to click.
if (ON_VERCEL || process.env.DEMO_SEED) require('./demo-seed')(db);
