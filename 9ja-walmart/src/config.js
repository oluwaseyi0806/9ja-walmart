// ============================================================
// SETTINGS
// Port + admin key. Reads the .env file; creates a secret ADMIN_KEY on first run.
// EDIT HERE: change values inside the .env file (not here)
// ============================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const envPath = path.join(__dirname, '..', '.env');

// ---------- 1. READ .env FILE ----------
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

// ---------- 2. CREATE ADMIN KEY ON FIRST RUN ----------
let newKey = false;
if (!process.env.ADMIN_KEY) {
  process.env.ADMIN_KEY = crypto.randomBytes(18).toString('hex');
  try { fs.appendFileSync(envPath, `ADMIN_KEY=${process.env.ADMIN_KEY}\n`); } catch (e) {} // on Vercel the disk is read-only: set ADMIN_KEY in the Vercel settings instead
  newKey = true;
}

module.exports = { PORT: process.env.PORT || 3000, ADMIN_KEY: process.env.ADMIN_KEY, newKey,
  COMMISSION_PERCENT: Number(process.env.COMMISSION_PERCENT || 5),            // your cut of every sale (%)
  AUTO_RELEASE_DAYS: Number(process.env.AUTO_RELEASE_DAYS || 3),              // days after 'Shipped' before held money is released if buyer is silent
  PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY || '',                 // from paystack.com dashboard
  BASE_URL: process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}` };
