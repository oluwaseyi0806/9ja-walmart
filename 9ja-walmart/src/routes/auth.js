// ============================================================
// ROUTES: ACCOUNTS
// Sign up, sign in, sign out, profile, my orders.
// EDIT HERE: password rules, session length (days)
// ============================================================

const crypto = require('crypto');
const router = require('express').Router();
const db = require('../db');
const { limit, requireUser } = require('../middleware');

const DAYS = 14; // how long a login lasts
const sha = t => crypto.createHash('sha256').update(t).digest('hex');
const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString('hex'); // slow on purpose = safer
const safe = u => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, address: u.address, state: u.state });

// ---------- HELPER: start a login session (httpOnly cookie) ----------
function startSession(req, res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
  db.prepare('INSERT INTO sessions(token_hash,user_id,expires) VALUES (?,?,?)').run(sha(token), userId, Date.now() + DAYS * 864e5);
  res.append('Set-Cookie', `sid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${DAYS * 86400}${req.secure ? '; Secure' : ''}`);
}

// ---------- SIGN UP ----------
router.post('/register', limit(10, 60000), (req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim().slice(0, 80), email = String(b.email || '').trim().toLowerCase().slice(0, 120);
  const phone = String(b.phone || '').trim().slice(0, 20), password = String(b.password || '');
  if (name.length < 2) return res.status(400).json({ error: 'Enter your full name.' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email.' });
  if (password.length < 8 || password.length > 100) return res.status(400).json({ error: 'Password must be 8 or more characters.' });
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) return res.status(409).json({ error: 'An account with this email already exists. Try signing in.' });
  const salt = crypto.randomBytes(16).toString('hex');
  const r = db.prepare('INSERT INTO users(email,name,phone,salt,hash) VALUES (?,?,?,?,?)').run(email, name, phone, salt, hashPw(password, salt));
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(r.lastInsertRowid);
  startSession(req, res, user.id);
  res.json({ user: safe(user) });
});

// ---------- SIGN IN ----------
router.post('/login', limit(10, 60000), (req, res) => {
  const email = String((req.body || {}).email || '').trim().toLowerCase(), password = String((req.body || {}).password || '');
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  const given = Buffer.from(hashPw(password, user ? user.salt : 'x'.repeat(32)), 'hex');
  const ok = user && crypto.timingSafeEqual(given, Buffer.from(user.hash, 'hex'));
  if (!ok) return res.status(401).json({ error: 'Wrong email or password.' });
  startSession(req, res, user.id);
  res.json({ user: safe(user) });
});

// ---------- SIGN OUT ----------
router.post('/logout', (req, res) => {
  const m = (req.headers.cookie || '').match(/(?:^|;\s*)sid=([a-f0-9]{64})/);
  if (m) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(m[1]));
  res.append('Set-Cookie', 'sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
  res.json({ ok: true });
});

// ---------- WHO AM I / UPDATE PROFILE ----------
router.get('/me', (req, res) => res.json({ user: req.user ? safe(req.user) : null }));

router.patch('/me', requireUser, (req, res) => {
  const b = req.body || {}, name = String(b.name || '').trim().slice(0, 80);
  if (name.length < 2) return res.status(400).json({ error: 'Enter your full name.' });
  db.prepare('UPDATE users SET name=?, phone=?, address=?, state=? WHERE id=?')
    .run(name, String(b.phone || '').trim().slice(0, 20), String(b.address || '').trim().slice(0, 300), String(b.state || '').slice(0, 40), req.user.id);
  res.json({ user: safe(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) });
});

// ---------- MY ORDERS ----------
router.get('/my-orders', requireUser, (req, res) =>
  res.json(db.prepare('SELECT code,status,payment_status,total,created FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 50').all(req.user.id)));

module.exports = router;
