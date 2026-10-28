// ============================================================
// PHONE CARDS & PHONE LIST
// Draws each phone listing and loads the list (filters: search, brand, state, sort).
// EDIT HERE: how a phone card looks
// ============================================================

const parse = p => { try { return JSON.parse(p.specs || '{}'); } catch { return {}; } };

// ---------- ONE PHONE CARD ----------
const card = p => {
  const s = parse(p), off = p.old_price > p.price ? Math.round((1 - p.price / p.old_price) * 100) : 0;
  return `<div class="card" data-open="${p.id}">
  <div class="img">${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">` : p.emoji}${off ? `<span class="off">-${off}%</span>` : ''}${p.lowest ? `<span class="lowbadge">Lowest price in ${esc(p.state)}</span>` : ''}</div>
  <div class="n">${esc(p.name)}</div><div class="meta">${esc(s.ram || '')} RAM · ${esc(s.condition || '')}</div>
  <div class="prow"><div class="price">${naira(p.price)}</div>${off ? `<div class="old">${naira(p.old_price)}</div>` : ''}</div>
  <div class="meta">${esc(p.city || '')}, ${esc(p.state || '')}</div>
  <div class="meta"><a href="#" data-store="${p.seller_id}">${esc(p.seller)}</a>${p.verified ? ' <span class="vf" title="Verified store">Verified</span>' : ''} · ${p.rating ? '<span class="rstar">★</span> ' + Number(p.rating).toFixed(1) : 'New store'}</div>
  <button class="btn" data-add="${p.id}" ${p.stock < 1 ? 'disabled' : ''}>${p.stock < 1 ? 'Sold out' : 'Add to cart'}</button></div>`;
};

// ---------- LOAD THE LIST ----------
async function loadProducts() {
  $('#grid').innerHTML = '<div class="skel"></div>'.repeat(8);
  const q = $('#q').value.trim(), sort = $('#sort').value, st = $('#stateSel') ? $('#stateSel').value : '';
  products = await api(`/api/products?q=${encodeURIComponent(q)}&brand=${encodeURIComponent(category)}&state=${encodeURIComponent(st)}&sort=${sort}`);
  $('#listTitle').textContent = q ? `Results for "${q}"` : `${category || 'All phones'}${st ? ' in ' + st : ''}`;
  $('#grid').innerHTML = products.length ? products.map(card).join('') : '<p class="meta" style="grid-column:1/-1;padding:20px">No phones found here yet. Try another state or brand.</p>';
}
document.addEventListener('click', e => { const id = e.target.dataset.add; if (id) addToCart(+id); });
