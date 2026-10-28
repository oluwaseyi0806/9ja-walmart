// ============================================================
// ACCOUNTS: SIGN UP, SIGN IN, PROFILE
// Header account button, login/register popup, profile + my orders, checkout prefill.
// EDIT HERE: the wording of the popups, or which profile fields exist
// ============================================================

// ---------- STATE ----------
let user = null; // the signed-in customer (or null)
const send = (url, body, method = 'POST') => api(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

async function loadMe() {
  try { user = (await api('/api/auth/me')).user; } catch { user = null; }
  renderAcct();
}
function renderAcct() {
  $('#acctBtn').textContent = user ? user.name.split(' ')[0] : 'Register / Sign in';
  $('#acctBtn').classList.toggle('primary', !user); // green button for visitors
}
$('#acctBtn').onclick = () => user ? openProfile() : openAuth('login');

// ---------- SIGN IN / SIGN UP POPUP ----------
function openAuth(tab) {
  const reg = tab === 'register';
  modal(`<h3>${reg ? 'Create your account' : 'Welcome back'}</h3>
    <div class="tabs"><button id="tLogin" class="${reg ? '' : 'on'}">Sign in</button><button id="tReg" class="${reg ? 'on' : ''}">Register</button></div>
    ${reg ? '<label>Full name</label><input id="a-name" autocomplete="name"><label>Phone (optional)</label><input id="a-phone" type="tel" autocomplete="tel">' : ''}
    <label>Email</label><input id="a-email" type="email" autocomplete="email">
    <label>Password${reg ? ' (8+ characters)' : ''}</label><input id="a-pass" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}">
    <button class="btn" id="aGo">${reg ? 'Create account' : 'Sign in'}</button><p id="aErr" class="err"></p>`);
  $('#tLogin').onclick = () => openAuth('login'); $('#tReg').onclick = () => openAuth('register');
  $('#aGo').onclick = async () => {
    const btn = $('#aGo'); btn.disabled = true;
    try {
      const body = { email: $('#a-email').value, password: $('#a-pass').value };
      if (reg) { body.name = $('#a-name').value; body.phone = $('#a-phone').value; }
      user = (await send(reg ? '/api/auth/register' : '/api/auth/login', body)).user;
      renderAcct(); closeModal(); toast('Welcome, ' + user.name.split(' ')[0] + ' 👋');
    } catch (e) { $('#aErr').textContent = e.message; btn.disabled = false; }
  };
}

// ---------- PROFILE + MY ORDERS POPUP ----------
async function openProfile() {
  let orders = []; try { orders = await api('/api/auth/my-orders'); } catch {}
  modal(`<h3>My Profile</h3><p class="meta" style="margin-bottom:10px">${esc(user.email)}</p>
    <label>Full name</label><input id="p-name" value="${esc(user.name)}">
    <label>Phone</label><input id="p-phone" type="tel" value="${esc(user.phone || '')}">
    <label>Delivery address</label><textarea id="p-addr" rows="2">${esc(user.address || '')}</textarea>
    <label>State</label><select id="p-state">${STATES.map(s => `<option ${s === user.state ? 'selected' : ''}>${s}</option>`).join('')}</select>
    <button class="btn" id="pSave">Save changes</button><p id="pMsg" class="err"></p>
    <h3 style="margin-top:18px">My Orders <small class="meta">(tap an order to open it)</small></h3>
    ${orderList(orders)}
    <button class="btn ghost" id="pOut">Sign out</button>`);
  $('#pSave').onclick = async () => {
    try {
      user = (await send('/api/auth/me', { name: $('#p-name').value, phone: $('#p-phone').value, address: $('#p-addr').value, state: $('#p-state').value }, 'PATCH')).user;
      renderAcct(); toast('Profile saved ✓');
    } catch (e) { $('#pMsg').textContent = e.message; }
  };
  document.querySelectorAll('[data-track]').forEach(el => el.onclick = () => openTrack(el.dataset.track));
  $('#pOut').onclick = async () => { await send('/api/auth/logout', {}); user = null; renderAcct(); closeModal(); toast('Signed out'); };
}

// ---------- CHECKOUT HELPER: fill the form from the profile ----------
function prefill() {
  if (!user) {
    $('#placeBtn').insertAdjacentHTML('beforebegin', '<p class="meta" style="margin-bottom:10px">Have an account? <a href="#" id="signinLink">Sign in</a> to checkout faster.</p>');
    $('#signinLink').onclick = e => { e.preventDefault(); openAuth('login'); };
    return;
  }
  $('#f-name').value = user.name; $('#f-phone').value = user.phone || ''; $('#f-email').value = user.email;
  $('#f-addr').value = user.address || ''; if (user.state) $('#f-state').value = user.state;
}

// ---------- PROFILE: ORDER LIST (paid orders first; tap one to track / confirm / rate) ----------
function orderList(list) {
  if (!list.length) return '<p class="meta">No orders yet.</p>';
  const row = o => `<div class="ord clickable" data-track="${esc(o.code)}"><b>${esc(o.code)}</b> <span class="pill ${o.payment_status === 'paid' ? 'ok' : 'warn'}">${o.payment_status === 'paid' ? 'Paid' : 'Not paid'}</span> · ${esc(o.status)}<br><small class="meta">${naira(o.total)} · ${esc(o.created)} UTC</small></div>`;
  const paid = list.filter(o => o.payment_status === 'paid'), other = list.filter(o => o.payment_status !== 'paid');
  return (paid.length ? '<p class="sec">💳 Paid orders</p>' + paid.map(row).join('') : '') + (other.length ? '<p class="sec">⏳ Not paid yet</p>' + other.map(row).join('') : '');
}
