// ============================================================
// 9JA WALMART - SERVER ENTRY POINT
// Wires everything together. Run with: npm start
// EDIT HERE: add new route files in the ROUTES section
// ============================================================

const express = require('express');
const path = require('path');
const { PORT, newKey, ADMIN_KEY } = require('./src/config');
const { securityHeaders, attachUser } = require('./src/middleware');

const app = express();
if (process.env.TRUST_PROXY) app.set('trust proxy', 1); // set TRUST_PROXY=1 in .env when behind Caddy/Cloudflare

// ---------- 1. GLOBAL SETUP ----------
// small JSON limit everywhere except the photo upload route (it sets its own)
app.use((req, res, next) => req.path === '/api/seller/upload' || req.path === '/api/payments/webhook' ? next() : express.json({ limit: '50kb' })(req, res, next));
app.use(securityHeaders);
if (process.env.VERCEL) app.get('/uploads/:f', (req, res) => { const f = String(req.params.f); if (!/^[a-f0-9]{24}\.jpg$/.test(f)) return res.status(404).end(); res.sendFile('/tmp/uploads/' + f, e => e && res.status(404).end()); }); // demo hosting keeps photos in /tmp
app.use(express.static(path.join(__dirname, 'public'))); // serves the website files

app.use(attachUser); // who is logged in?

// ---------- 2. ROUTES (API) ----------
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/payments', require('./src/routes/payments')); // Paystack init / verify / webhook
app.use('/api/seller', require('./src/routes/seller'));   // seller application + dashboard       // sign up, sign in, profile
app.use('/api', require('./src/routes/catalog'));  // products, categories, suggest, flash
app.use('/api/orders', require('./src/routes/orders')); // place + track orders
app.use('/api/admin', require('./src/routes/admin'));   // admin only

// ---------- 3. START ----------
if (require.main === module) app.listen(PORT, () => {
  console.log(`\n9JA WALMART running -> http://localhost:${PORT}\n   Admin page -> http://localhost:${PORT}/admin.html`);
  console.log(newKey ? `\n   YOUR NEW ADMIN KEY (also saved in the .env file):\n   ${ADMIN_KEY}\n` : '   Admin key: see the ADMIN_KEY line in your .env file\n');
});

// ---------- 4. BACKGROUND JOB: cancel unpaid orders after 30 minutes ----------
const { expireUnpaid, autoRelease } = require('./src/payments');
if (!process.env.VERCEL) { // Vercel cannot run background timers (demo only; the VPS runs them)
expireUnpaid(); setInterval(expireUnpaid, 5 * 60 * 1000);
autoRelease(); setInterval(autoRelease, 60 * 60 * 1000); // pays sellers when a buyer stays silent after shipping
}

module.exports = app; // lets Vercel use the app as a function
