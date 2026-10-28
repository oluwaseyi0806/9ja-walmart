// ============================================================
// MIDDLEWARE
// Helpers that run before routes: security headers, rate limiting, admin lock.
// ============================================================

const crypto = require('crypto');
const { ADMIN_KEY } = require('./config');
const db = require('./db');

// ---------- 1. SECURITY HEADERS ----------
const securityHeaders = (req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin' });
  next();
};

// ---------- 2. RATE LIMITER: limit(maxRequests, perMilliseconds) ----------
const hits = new Map();
const limit = (max, ms) => (req, res, next) => {
  const k = req.ip + req.path, now = Date.now();
  const arr = (hits.get(k) || []).filter(t => now - t < ms);
  if (arr.length >= max) return res.status(429).json({ error: 'Too many requests, slow down.' });
  arr.push(now); hits.set(k, arr); next();
};

// ---------- 3. ADMIN LOCK (requires x-admin-key header) ----------
const admin = (req, res, next) =>
  req.get('x-admin-key') === ADMIN_KEY ? next() : res.status(401).json({ error: 'Unauthorized' });

// ---------- 4. WHO IS LOGGED IN? (reads the 'sid' cookie) ----------
const attachUser = (req, res, next) => {
  req.user = null;
  const m = (req.headers.cookie || '').match(/(?:^|;\s*)sid=([a-f0-9]{64})/);
  if (m) {
    const th = crypto.createHash('sha256').update(m[1]).digest('hex');
    req.user = db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires > ?').get(th, Date.now()) || null;
  }
  next();
};
const requireUser = (req, res, next) => req.user ? next() : res.status(401).json({ error: 'Please sign in.' });

module.exports = { securityHeaders, limit, admin, attachUser, requireUser };
