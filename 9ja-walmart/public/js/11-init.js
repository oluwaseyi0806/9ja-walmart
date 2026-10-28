// ============================================================
// START-UP
// Loads settings, states and phones, then handles the return from Paystack.
// ============================================================

let CONFIG = { states: [], categories: {} };

// ---------- AFTER PAYING ON PAYSTACK THE CUSTOMER COMES BACK WITH ?pay=ORDERCODE ----------
async function handlePayReturn() {
  const code = new URLSearchParams(location.search).get('pay'); if (!code) return;
  history.replaceState(null, '', '/');
  try {
    const r = await api('/api/payments/verify/' + encodeURIComponent(code));
    modal(r.paid ? `<h3>🎉 Payment received!</h3><p>Order <b>${esc(code)}</b> is paid. The seller will now send your phone. Your money stays safe until you confirm delivery.</p><button class="btn" id="goTrack">Track my order</button>`
      : `<h3>Payment not confirmed yet</h3><p>Order <b>${esc(code)}</b>. If you were charged, it can take a minute. Open Track again shortly.</p><button class="btn" id="goTrack">Track my order</button>`);
    $('#goTrack').onclick = () => openTrack(code);
  } catch (e) { toast(e.message); }
}

// ---------- RUN ----------
(async () => {
  CONFIG = await api('/api/config'); STATES = CONFIG.states;
  window.allP = await api('/api/products');
  initPhoneUI();
  await loadMe();
  await Promise.all([loadCats(), loadProducts(), loadFlash()]);
  renderCart(); handlePayReturn();
  api('/api/app-rating').then(r => { if (r.count) $('#appRating').textContent = `★ ${r.avg} app rating (${r.count} reviews)`; }).catch(() => {});
})();

// ---------- FOOTER LINKS (open the same popups as the header buttons) ----------
[['#footTrack', () => openTrack('')], ['#footTrack2', () => openTrack('')], ['#footSell', () => openSeller()]].forEach(([id, fn]) => {
  const el = $(id); if (el) el.onclick = e => { e.preventDefault(); fn(); };
});
