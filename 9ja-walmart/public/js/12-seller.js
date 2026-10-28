// ============================================================
// SELLER AREA: APPLY, DASHBOARD, ADD PHONES, ORDERS, EARNINGS
// Header "Sell" button -> application / pending notice / dashboard.
// EDIT HERE: application fields, dashboard tabs
// ============================================================

const fld = (id, label, attrs = '') => `<label>${label}</label><input id="${id}" ${attrs}>`;
$('#sellBtn').onclick = openSeller;

// ---------- ENTRY ----------
async function openSeller() {
  if (!user) { toast('Sign in or sign up first'); return openAuth('register'); }
  const { seller } = await api('/api/seller/me');
  if (!seller || seller.status === 'rejected') return applyForm(seller);
  if (seller.status === 'pending') return modal('<h3>Application under review ⏳</h3><p>We are verifying your store. You can sell once approved.</p>');
  if (seller.status === 'suspended') return modal('<h3>Seller account suspended</h3><p>' + esc(seller.note || 'Please contact support.') + '</p>');
  dash('products', seller);
}

// ---------- APPLICATION FORM (store location = state + town) ----------
function applyForm(old) {
  modal(`<h3>Sell phones on 9JA WALMART</h3>${old ? '<p class="err">Rejected: ' + esc(old.note || 'details could not be verified') + '. You can re-apply.</p>' : '<p class="meta" style="margin-bottom:8px">Every store is verified before it can list phones.</p>'}
    ${fld('s-store', 'Store name *')}${fld('s-phone', 'Business phone *', 'type="tel"')}
    <label>Store state *</label><select id="s-state">${STATES.map(s => `<option>${esc(s)}</option>`).join('')}</select>
    ${fld('s-city', 'Town / city (e.g. Ado Ekiti) *')}${fld('s-addr', 'Shop address *')}${fld('s-biz', 'CAC / business reg. no. (optional)')}
    ${fld('s-bank', 'Bank name *')}${fld('s-acc', 'Account number (10 digits) *', 'inputmode="numeric" maxlength="10"')}${fld('s-accn', 'Account name *')}
    <button class="btn" id="sGo">Submit application</button><p id="sErr" class="err"></p>`);
  $('#sGo').onclick = async () => {
    try {
      await send('/api/seller/apply', { store_name: $('#s-store').value, phone: $('#s-phone').value, state: $('#s-state').value, city: $('#s-city').value, address: $('#s-addr').value, business_id: $('#s-biz').value, bank_name: $('#s-bank').value, account_no: $('#s-acc').value, account_name: $('#s-accn').value });
      modal('<h3>Application sent ✅</h3><p>We will verify and approve your store.</p>');
    } catch (e) { $('#sErr').textContent = e.message; }
  };
}

// ---------- ADD-PHONE FORM FIELDS (built from src/categories.js) ----------
const specFields = cat => CONFIG.categories[cat].fields.map(f => `<label>${esc(f.label)}${f.required ? ' *' : ''}</label>` + (f.type === 'select'
  ? `<select data-spec="${f.key}">${f.options.map(o => `<option>${esc(o)}</option>`).join('')}</select>` : `<input data-spec="${f.key}">`)).join('');

// ---------- DASHBOARD ----------
async function dash(tab, seller) {
  const tabs = [['products', 'My phones'], ['add', 'Add phone'], ['orders', 'Orders'], ['money', 'Earnings']];
  let body = '';
  if (tab === 'products') {
    const ps = await api('/api/seller/products');
    body = ps.length ? ps.map(p => `<div class="pl">${p.image ? `<img class="mini" src="${esc(p.image)}" alt="">` : ''}<div style="flex:1"><b>${esc(p.name)}</b><br><small class="meta">${p.stock} in stock</small></div>₦<input id="pr${p.id}" type="number" value="${p.price / 100}"> qty<input id="st${p.id}" type="number" value="${p.stock}"><button class="btn sm" data-save="${p.id}">Save</button><button class="btn sm" data-edit="${p.id}">Open / Edit</button></div>`).join('') : '<p class="meta">No phones yet. Use "Add phone".</p>';
  } else if (tab === 'add') {
    const cats = Object.keys(CONFIG.categories);
    body = `<label>Category</label><select id="n-cat">${cats.map(c => `<option>${esc(c)}</option>`).join('')}</select><div id="specs">${specFields(cats[0])}</div>
      ${fld('n-price', 'Price (₦) *', 'type="number" min="1"')}${fld('n-old', 'Old price (₦, optional)', 'type="number"')}${fld('n-stock', 'Quantity in stock *', 'type="number" min="0"')}
      <label>Real photos of THIS phone * (up to 4: front, back, screen on)</label><input id="n-img" type="file" accept="image/*" multiple>
      <p class="meta">Fake or stock photos lead to suspension.</p>
      <label>IMEI proof photo * (dial *#06# and photograph the screen, or the box sticker)</label><input id="n-imei" type="file" accept="image/*"><button class="btn" id="nGo">Publish phone</button><p id="nErr" class="err"></p>`;
  } else if (tab === 'orders') {
    const os = await api('/api/seller/orders');
    body = '<p class="meta">Only PAID orders show here. Ship immediately: the buyer\'s money is already held safely.</p>' + (os.length ? os.map(o => `<div class="ord"><b>${esc(o.product)}</b> × ${o.qty} · <span class="vf">${esc(o.fulfil)}</span><br>
      <small class="meta">${esc(o.code)} · ${esc(o.customer)} · ${esc(o.phone)}<br>${esc(o.address)}, ${esc(o.state)}</small><br>
      <button class="btn sm" data-ful="${o.line}" data-v="Packed">Mark packed</button> <button class="btn sm" data-ful="${o.line}" data-v="Shipped">Mark shipped</button></div>`).join('') : '<p class="meta">No paid orders yet.</p>');
  } else {
    const m = Object.fromEntries((await api('/api/seller/earnings')).map(r => [r.state, r.total]));
    body = `<div class="ord">⏳ Held (waiting for delivery): <b>${naira(m.held || 0)}</b></div><div class="ord">✅ Ready for payout: <b>${naira(m.available || 0)}</b></div><div class="ord">💸 Already paid out: <b>${naira(m.paid_out || 0)}</b></div>
      <p class="meta" style="margin-top:8px">Platform commission (${CONFIG.commission}%) is already deducted from these amounts.</p>`;
  }
  modal(`<h3>🏪 ${esc(seller.store_name)} <span class="vf">✔ Verified · ${esc(seller.city || '')}, ${esc(seller.state || '')}</span></h3>
    <div class="tabs">${tabs.map(t => `<button data-tab="${t[0]}" class="${t[0] === tab ? 'on' : ''}">${t[1]}</button>`).join('')}</div>${body}`);
  document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => dash(b.dataset.tab, seller));
  document.querySelectorAll('[data-save]').forEach(b => b.onclick = async () => {
    try { await send('/api/seller/products/' + b.dataset.save, { price: $('#pr' + b.dataset.save).value, stock: $('#st' + b.dataset.save).value }, 'PATCH'); toast('Saved ✓'); loadProducts(); } catch (e) { toast(e.message); }
  });
  document.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => editPhone(+b.dataset.edit, seller));
  document.querySelectorAll('[data-ful]').forEach(b => b.onclick = async () => {
    try { await send('/api/seller/orders/' + b.dataset.ful, { fulfil: b.dataset.v }, 'PATCH'); dash('orders', seller); } catch (e) { toast(e.message); }
  });
  if (tab === 'add') {
    $('#n-cat').onchange = () => $('#specs').innerHTML = specFields($('#n-cat').value);
    $('#nGo').onclick = async () => {
      const btn = $('#nGo'); btn.disabled = true; btn.textContent = 'Publishing…';
      try {
        const images = [], files = [...$('#n-img').files].slice(0, 4);
        for (const f of files) images.push((await send('/api/seller/upload', { data: await toJpeg(f) })).url);
        if (!$('#n-imei').files[0]) throw new Error('Add the IMEI proof photo.');
        const imei_photo = (await send('/api/seller/upload', { data: await toJpeg($('#n-imei').files[0]) })).url;
        const specs = {}; document.querySelectorAll('[data-spec]').forEach(el => specs[el.dataset.spec] = el.value);
        await send('/api/seller/products', { category: $('#n-cat').value, specs, images, imei_photo, price: $('#n-price').value, old_price: $('#n-old').value, stock: $('#n-stock').value });
        toast('Phone published 🎉'); loadProducts(); loadCats(); dash('products', seller);
      } catch (e) { $('#nErr').textContent = e.message; btn.disabled = false; btn.textContent = 'Publish phone'; }
    };
  }
}

// ---------- HELPER: shrink photo to max 800px JPEG in the browser (saves data) ----------
function toJpeg(file) {
  return new Promise((ok, bad) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 800 / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src); ok(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => bad(new Error('Could not read that image.'));
    img.src = URL.createObjectURL(file);
  });
}

// ---------- OPEN + EDIT ONE OF MY PHONES (details, price, stock, photos, IMEI photo) ----------
async function editPhone(id, seller) {
  const p = await api('/api/seller/products/' + id), s = parse(p);
  let imgs = (() => { try { return JSON.parse(p.images || '[]'); } catch { return []; } })();
  const fields = CONFIG.categories[p.category].fields.map(f => `<label>${esc(f.label)}${f.required ? ' *' : ''}</label>` + (f.type === 'select'
    ? `<select data-spec="${f.key}">${f.options.map(o => `<option ${o === s[f.key] ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`
    : `<input data-spec="${f.key}" value="${esc(s[f.key] || '')}">`)).join('');
  modal(`<h3>✏️ Edit phone</h3><p class="meta">${esc(p.name)} · ${esc(p.city)}, ${esc(p.state)}</p>${fields}
    ${fld('e-price', 'Price (₦) *', `type="number" value="${p.price / 100}"`)}${fld('e-old', 'Old price (₦, optional)', `type="number" value="${p.old_price > p.price ? p.old_price / 100 : ''}"`)}${fld('e-stock', 'Quantity in stock *', `type="number" value="${p.stock}"`)}
    <label>Photos (up to 4). Remove old ones or add new ones:</label><div id="e-imgs" class="pics"></div><input id="e-new" type="file" accept="image/*" multiple>
    <label>IMEI proof photo</label>${p.imei_photo ? `<a href="${esc(p.imei_photo)}" target="_blank" rel="noopener"><img class="mini" src="${esc(p.imei_photo)}" alt="IMEI"></a>` : ''}<input id="e-imei" type="file" accept="image/*">
    <p class="meta">Leave the IMEI box empty to keep the current IMEI photo.</p>
    <button class="btn" id="eGo">Save changes</button><button class="btn sm" id="eBack" type="button" style="margin-top:8px">← Back to my phones</button><p id="eErr" class="err"></p>`);
  const draw = () => {
    $('#e-imgs').innerHTML = imgs.map((u, i) => `<div class="pic"><img src="${esc(u)}" alt=""><button class="btn sm" type="button" data-rm="${i}">Remove</button></div>`).join('') || '<p class="meta">No photos left. Add at least one.</p>';
    document.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { imgs.splice(+b.dataset.rm, 1); draw(); });
  };
  draw(); $('#eBack').onclick = () => dash('products', seller);
  $('#eGo').onclick = async () => {
    const btn = $('#eGo'); btn.disabled = true; btn.textContent = 'Saving…';
    try {
      const all = [...imgs];
      for (const f of [...$('#e-new').files]) { if (all.length >= 4) break; all.push((await send('/api/seller/upload', { data: await toJpeg(f) })).url); }
      const imei_photo = $('#e-imei').files[0] ? (await send('/api/seller/upload', { data: await toJpeg($('#e-imei').files[0]) })).url : p.imei_photo;
      const specs = {}; document.querySelectorAll('[data-spec]').forEach(el => specs[el.dataset.spec] = el.value);
      await send('/api/seller/products/' + id, { category: p.category, specs, images: all, imei_photo, price: $('#e-price').value, old_price: $('#e-old').value, stock: $('#e-stock').value }, 'PUT');
      toast('Phone updated ✓'); loadProducts(); loadCats(); dash('products', seller);
    } catch (e) { $('#eErr').textContent = e.message; btn.disabled = false; btn.textContent = 'Save changes'; }
  };
}
