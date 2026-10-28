// ============================================================
// HELPERS & SHARED STATE
// Money formatter (naira), HTML escaping, API caller, toast popup, cart storage.
// ============================================================

const $ = s => document.querySelector(s);
const naira = k => '₦' + (k / 100).toLocaleString('en-NG');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let products = [], cart = {}, category = '';
try { cart = JSON.parse(localStorage.getItem('cart') || '{}'); } catch { cart = {}; }

const api = async (url, opt) => {
  const r = await fetch(url, opt); const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Something went wrong'); return d;
};
function toast(m) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 2200); }
