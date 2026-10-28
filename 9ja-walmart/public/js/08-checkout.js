// ============================================================
// CHECKOUT, POPUPS & PAYMENT START
// Popup helpers, guest checkout form, sends the customer to Paystack to pay.
// EDIT HERE: checkout form fields and wording
// ============================================================

let STATES = []; // all 37 states, loaded from the server in js/11-init.js

// ---------- POPUP HELPERS ----------
function modal(html) { $('#modalBox').innerHTML = html; $('#modal').hidden = false; }
const closeModal = () => $('#modal').hidden = true;
$('#modal').onclick = e => { if (e.target.id === 'modal') closeModal(); };
// ENTER = press the main green button of the popup. ESC = close the popup.
$('#modalBox').addEventListener('keydown', e => {
  if (e.key !== 'Enter' || e.defaultPrevented || ['TEXTAREA', 'BUTTON', 'SELECT'].includes(e.target.tagName) || e.target.type === 'file') return;
  const b = $('#modalBox .btn:not(.ghost):not(.sm):not(:disabled)'); if (b) { e.preventDefault(); b.click(); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); $('#drawer').hidden = true; } });

// ---------- START ONLINE PAYMENT FOR AN ORDER CODE ----------
async function payNow(code) {
  try { location.href = (await send('/api/payments/init', { code })).url; }
  catch (e) { modal(`<h3>Order saved ✅</h3><p>Your order number is <b>${esc(code)}</b>.</p><p style="margin:10px 0">${esc(e.message)}</p><button class="btn" onclick="document.getElementById('modal').hidden=true">OK</button>`); }
}

// ---------- CHECKOUT FORM ----------
function checkout() {
  const lines = cartLines(); if (!lines.length) return toast('Your cart is empty');
  const total = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
  $('#drawer').hidden = true;
  modal(`<h3>Checkout</h3>
  <label>Full name *</label><input id="f-name"><label>Phone number *</label><input id="f-phone" type="tel" placeholder="0803 000 0000">
  <label>Email * (payment receipt)</label><input id="f-email" type="email"><label>Delivery address *</label><textarea id="f-addr" rows="2"></textarea>
  <label>Your state *</label><select id="f-state">${STATES.map(s => `<option>${esc(s)}</option>`).join('')}</select>
  <p style="margin:6px 0"><b>Total: ${naira(total)}</b></p>
  <p class="meta" style="margin-bottom:10px">🔒 You pay securely in the app (Paystack). The seller ships after payment, and your money is only released to the seller when you confirm delivery.</p>
  <button class="btn" id="placeBtn">Pay securely</button><p id="err" class="err"></p>`);
  prefill();
  $('#placeBtn').onclick = async () => {
    const btn = $('#placeBtn'); btn.disabled = true; btn.textContent = 'Please wait…';
    try {
      const r = await send('/api/orders', { items: Object.entries(cart).map(([id, qty]) => ({ id: +id, qty })),
        customer: { name: $('#f-name').value.trim(), phone: $('#f-phone').value.trim(), email: $('#f-email').value.trim(), address: $('#f-addr').value.trim(), state: $('#f-state').value } });
      cart = {}; save(); payNow(r.code);
    } catch (e) { $('#err').textContent = e.message; btn.disabled = false; btn.textContent = 'Pay securely'; }
  };
}
$('#goCheckout').onclick = checkout; $('#mobCheckout').onclick = checkout;
