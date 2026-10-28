// ============================================================
// PHONE DETAILS, STORE PAGES & STATE FILTER
// Phone popup (photos, specs, IMEI proof, other stores), store page with reviews, state filter.
// EDIT HERE: what the phone popup / store page show
// ============================================================

const lowBadge = p => p.lowest ? `<span class="lowbadge">🏆 Lowest price in ${esc(p.state)}</span>` : '';
const addAll = list => list.forEach(x => { if (!window.allP.find(a => a.id === x.id)) window.allP.push(x); }); // so the cart can find them

// ---------- STATE FILTER (all 37 states) ----------
function initPhoneUI() {
  $('#stateSel').innerHTML = '<option value="">All states</option>' + STATES.map(s => `<option>${esc(s)}</option>`).join('');
  $('#stateSel').onchange = loadProducts;
}
$('#q').addEventListener('keydown', e => { if (e.key === 'Enter') { $('#sugg').hidden = true; loadProducts(); } }); // Enter = search now

// ---------- PHONE POPUP ----------
async function openPhone(id) {
  const { product: p, offers } = await api(`/api/products/${id}?state=${encodeURIComponent($('#stateSel').value)}`);
  addAll([p, ...offers]);
  const s = parse(p), imgs = (() => { try { return JSON.parse(p.images || '[]'); } catch { return []; } })();
  const fields = (CONFIG.categories[p.category] || { fields: [] }).fields;
  modal(`<div class="gal"><img id="gMain" src="${esc(imgs[0] || p.image || '')}" alt="">
    <div class="thumbs">${imgs.map(u => `<img src="${esc(u)}" data-img="${esc(u)}" alt="">`).join('')}</div></div>
    <h3>${esc(p.name)}</h3><div class="price big">${naira(p.price)}</div>${lowBadge(p)}
    <p class="meta">📍 ${esc(p.city)}, ${esc(p.state)} · <a href="#" data-store="${p.seller_id}"><b>${esc(p.seller)}</b></a> <span class="vf">✔ Verified</span> · ${p.rating ? '⭐ ' + Number(p.rating).toFixed(1) : 'New store'} · ${p.stock} in stock</p>
    <table class="spec">${fields.filter(f => s[f.key]).map(f => `<tr><td>${esc(f.label.split(' (')[0])}</td><td>${esc(s[f.key])}</td></tr>`).join('')}</table>
    ${p.imei_photo ? `<div class="imei"><b>IMEI proof photo</b> <small class="meta">(uploaded by the store, tap to enlarge)</small><br><a href="${esc(p.imei_photo)}" target="_blank" rel="noopener"><img src="${esc(p.imei_photo)}" alt="IMEI proof"></a></div>` : ''}
    <button class="btn" data-add="${p.id}" ${p.stock < 1 ? 'disabled' : ''} style="margin-top:12px">Add to cart</button>
    <p class="meta" style="margin-top:8px">🔒 Pay in the app. Your money is held safely until you confirm you received your phone.</p>
    ${offers.length ? `<h3 style="margin-top:16px">Other stores selling this phone (${offers.length})</h3>` + offers.map(o => `<div class="offer" data-open="${o.id}">
      <div><b>${esc(o.seller)}</b> <span class="vf">✔</span> ${o.rating ? '⭐ ' + Number(o.rating).toFixed(1) : ''}<br>${lowBadge(o)}<small class="meta">📍 ${esc(o.city)}, ${esc(o.state)} · ${esc(parse(o).condition || '')} · ${esc(parse(o).warranty || '')}</small></div><b>${naira(o.price)}</b></div>`).join('') : ''}`);
}

// ---------- STORE PAGE ----------
async function openStore(id) {
  const d = await api('/api/stores/' + id); addAll(d.products);
  modal(`<h3>🏪 ${esc(d.store.store_name)} <span class="vf">✔ Verified store</span></h3>
    <p class="meta">📍 ${esc(d.store.address)}, ${esc(d.store.city)}, ${esc(d.store.state)}</p>
    <div class="ord"><b>${d.rating.count ? '⭐ ' + d.rating.avg + ' (' + d.rating.count + ' review' + (d.rating.count > 1 ? 's' : '') + ')' : 'New store · no reviews yet'}</b><br><small class="meta">${d.sold} completed sale${d.sold === 1 ? '' : 's'} · on 9JA WALMART since ${esc(String(d.store.created).slice(0, 10))}</small></div>
    <p class="sec">Phones in this store</p>
    ${d.products.map(p => `<div class="offer" data-open="${p.id}"><div><b>${esc(p.name)}</b><br>${lowBadge(p)}<small class="meta">${esc(parse(p).condition || '')} · ${esc(parse(p).warranty || '')} · ${p.stock > 0 ? p.stock + ' in stock' : 'Sold out'}</small></div><b>${naira(p.price)}</b></div>`).join('') || '<p class="meta">No phones listed.</p>'}
    <p class="sec">Customer reviews</p>
    ${d.reviews.map(r => `<div class="ord"><b style="color:#f59e0b">${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)}</b> ${esc(r.name)}<br>${esc(r.comment || '')}<br><small class="meta">${esc(String(r.created).slice(0, 10))}</small></div>`).join('') || '<p class="meta">No reviews yet.</p>'}`);
}

// ---------- CLICKS: photo thumbnails, store links, opening phones ----------
document.addEventListener('click', e => {
  if (e.target.dataset.img) { $('#gMain').src = e.target.dataset.img; return; }
  const st = e.target.closest('[data-store]'); if (st) { e.preventDefault(); openStore(+st.dataset.store); return; }
  const el = e.target.closest('[data-open]'); if (el && !e.target.closest('[data-add]')) openPhone(+el.dataset.open);
});
