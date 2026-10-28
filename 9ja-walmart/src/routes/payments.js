// ============================================================
// ROUTES: PAYMENTS
// Start a Paystack payment, verify it, and receive Paystack webhooks.
// ============================================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const cfg = require('../config');
const { limit } = require('../middleware');
const P = require('../payments');

// ---------- START PAYMENT (returns the Paystack page link) ----------
router.post('/init', limit(10, 60000), async (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE code = ?').get(String((req.body || {}).code || ''));
  if (!o || o.payment_status !== 'unpaid' || o.status !== 'Awaiting payment') return res.status(400).json({ error: 'This order cannot be paid (expired or already paid).' });
  if (!cfg.PAYSTACK_SECRET_KEY) return res.status(503).json({ error: 'Online payment is not switched on yet. Your order is saved; the shop will confirm payment.' });
  try { res.json({ url: await P.paystackInit(o) }); } catch (e) { res.status(502).json({ error: 'Payment provider error. Please try again.' }); }
});

// ---------- VERIFY AFTER THE CUSTOMER RETURNS (we ask Paystack; we never trust the browser) ----------
router.get('/verify/:code', limit(30, 60000), async (req, res) => {
  const o = db.prepare('SELECT code,status,payment_status FROM orders WHERE code = ?').get(req.params.code);
  if (!o) return res.status(404).json({ error: 'Order not found.' });
  if (o.payment_status !== 'paid' && cfg.PAYSTACK_SECRET_KEY) {
    try { const d = await P.paystackVerify(o.code); if (d.status === 'success') P.settlePayment(o.code, d.reference, d.amount, d.currency); } catch (e) {}
  }
  const n = db.prepare('SELECT code,status,payment_status FROM orders WHERE code = ?').get(req.params.code);
  res.json({ code: n.code, status: n.status, paid: n.payment_status === 'paid' });
});

// ---------- WEBHOOK (Paystack tells our server; signature is checked) ----------
router.post('/webhook', express.raw({ type: '*/*', limit: '100kb' }), (req, res) => {
  if (!P.validSignature(req.body, req.headers['x-paystack-signature'])) return res.status(401).end();
  try {
    const ev = JSON.parse(req.body.toString('utf8'));
    if (ev.event === 'charge.success') P.settlePayment(ev.data.reference, ev.data.reference, ev.data.amount, ev.data.currency);
  } catch (e) {}
  res.sendStatus(200);
});

module.exports = router;
