// ============================================================
// ORDER TRACKING, "RECEIVED" CONFIRMATION & RATING
// Track an order, pay if unpaid, confirm delivery, rate the store and the app.
// EDIT HERE: wording of the popups
// ============================================================

let lastPhone = '';
$('#trackBtn').onclick = () => openTrack('');

// ---------- TRACK ----------
function openTrack(code) {
  modal(`<h3>Track your order</h3><input id="t-code" placeholder="e.g. 9JA-1A2B3C4D" value="${esc(code)}"><button class="btn" id="tGo">Track</button><div id="tOut"></div>`);
  $('#tGo').onclick = async () => {
    try {
      const o = await api('/api/orders/' + encodeURIComponent($('#t-code').value.trim()));
      const open = o.dispute && o.dispute.status === 'open';
      const waiting = o.payment_status === 'paid' && ['Shipped', 'Out for delivery'].includes(o.status) && !open;
      const canReport = o.payment_status === 'paid' && ['Packed', 'Shipped', 'Out for delivery'].includes(o.status) && !open;
      $('#tOut').innerHTML = `<p style="margin-top:12px"><b>${esc(o.code)}</b> · ${esc(o.status)} · ${naira(o.total)}</p>
        <ul class="tl">${o.events.map(e => `<li><b>${esc(e.status)}</b><br><small>${esc(e.at)} UTC</small></li>`).join('')}</ul>
        <p>${o.items.map(i => `${esc(i.name)} × ${i.qty}`).join('<br>')}</p>
        ${o.status === 'Awaiting payment' ? '<button class="btn" id="tPay" style="margin-top:12px">Pay now</button>' : ''}
        ${waiting ? `<div class="recv"><p><b>Did your phone arrive?</b></p><p class="meta" style="margin:4px 0 8px">Confirm only after you have collected and checked it. This releases your payment to the store.</p>
          <input id="t-phone" placeholder="Your phone number" value="${esc((user && user.phone) || lastPhone)}"><button class="btn" id="tConf">✅ Yes, I received my order successfully</button></div>` : ''}
        ${open ? `<div class="recv"><p><b>⚠️ Problem reported: ${esc(o.dispute.reason)}</b></p><p class="meta">Your money is safe and frozen while our team reviews this. We will contact you.</p></div>` : ''}
        ${o.dispute && o.dispute.status === 'refunded' ? '<p class="meta" style="margin-top:10px">We ruled in your favour. Your refund is being processed.</p>' : ''}
        ${canReport ? '<button class="btn ghost" id="tReport" style="margin-top:12px">⚠️ Report a problem</button>' : ''}
        ${o.status === 'Delivered' && !o.reviewed ? '<button class="btn" id="tRate" style="margin-top:12px">⭐ Rate the store and the app</button>' : ''}
        ${o.status === 'Delivered' && o.reviewed ? '<p class="meta" style="margin-top:10px">Order received ✅ · Thank you for your rating ⭐</p>' : ''}`;
      if ($('#tPay')) $('#tPay').onclick = () => payNow(o.code);
      if ($('#tReport')) $('#tReport').onclick = () => openReport(o.code);
      if ($('#tRate')) $('#tRate').onclick = () => openRate(o.code);
      if ($('#tConf')) {
        $('#t-phone').onkeydown = e => { if (e.key === 'Enter') { e.stopPropagation(); $('#tConf').click(); } };
        $('#tConf').onclick = async () => {
          try {
            lastPhone = $('#t-phone').value; await send(`/api/orders/${o.code}/confirm`, { phone: lastPhone });
            modal(`<h3>✅ Order received successfully</h3><p>Thank you! You confirmed that order <b>${esc(o.code)}</b> arrived. Payment has been released to the store.</p><button class="btn" id="goRate" style="margin-top:12px">⭐ Rate the store and the app</button>`);
            $('#goRate').onclick = () => openRate(o.code);
          } catch (e) { toast(e.message); }
        };
      }
    } catch (e) { $('#tOut').innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  };
  if (code) $('#tGo').click();
}

// ---------- RATE THE STORE + THE APP ----------
function openRate(code) {
  const R = { store: 0, app: 0 };
  const stars = k => [1, 2, 3, 4, 5].map(n => `<button class="star" type="button" data-k="${k}" data-n="${n}">★</button>`).join('');
  modal(`<h3>How was your experience?</h3>
    <p class="sec">The store</p><div class="stars" id="st-store">${stars('store')}</div><textarea id="r-sc" rows="2" placeholder="Was the phone as described? How was delivery?"></textarea>
    <p class="sec">The 9JA WALMART app</p><div class="stars" id="st-app">${stars('app')}</div><textarea id="r-ac" rows="2" placeholder="How can we make the app better?"></textarea>
    <label>Your phone number (confirms this is your order)</label><input id="r-phone" value="${esc((user && user.phone) || lastPhone)}">
    <button class="btn" id="rGo">Submit rating</button><p id="rErr" class="err"></p>`);
  document.querySelectorAll('.star').forEach(b => b.onclick = () => {
    R[b.dataset.k] = +b.dataset.n;
    document.querySelectorAll(`#st-${b.dataset.k} .star`).forEach(x => x.classList.toggle('on', +x.dataset.n <= R[b.dataset.k]));
  });
  $('#rGo').onclick = async () => {
    try {
      await send(`/api/orders/${code}/review`, { phone: $('#r-phone').value, store_stars: R.store, store_comment: $('#r-sc').value, app_stars: R.app, app_comment: $('#r-ac').value });
      modal('<h3>Thank you! 🙏</h3><p>Your rating helps other buyers trust good stores.</p>'); loadProducts();
    } catch (e) { $('#rErr').textContent = e.message; }
  };
}

// ---------- REPORT A PROBLEM (freezes the money until support decides) ----------
async function openReport(code) {
  const reasons = await api('/api/orders/meta/report-reasons');
  modal(`<h3>Report a problem</h3><p class="meta">Your payment stays frozen, so the store is not paid until we sort this out.</p>
    <label>What went wrong?</label><select id="rp-reason">${reasons.map(r => `<option>${esc(r)}</option>`).join('')}</select>
    <label>Tell us more (optional)</label><textarea id="rp-detail" rows="3" placeholder="Example: the box had a different phone inside"></textarea>
    <label>Your phone number (confirms this is your order)</label><input id="rp-phone" value="${esc((user && user.phone) || lastPhone)}">
    <button class="btn" id="rpGo">Send report</button><p id="rpErr" class="err"></p>`);
  $('#rp-phone').onkeydown = e => { if (e.key === 'Enter') { e.stopPropagation(); $('#rpGo').click(); } };
  $('#rpGo').onclick = async () => {
    try {
      lastPhone = $('#rp-phone').value;
      await send(`/api/orders/${code}/report`, { phone: lastPhone, reason: $('#rp-reason').value, detail: $('#rp-detail').value });
      modal('<h3>Report received ✅</h3><p>Your money is frozen and safe. Our team will contact you soon.</p>');
    } catch (e) { $('#rpErr').textContent = e.message; }
  };
}
