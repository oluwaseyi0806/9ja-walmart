// ============================================================
// SEARCH AUTOCOMPLETE & SORT
// Controls the search autocomplete & sort.
// EDIT HERE: search box suggestions and sort dropdown
// ============================================================

let dt;
$('#q').addEventListener('input', () => {
  clearTimeout(dt);
  dt = setTimeout(async () => {
    const q = $('#q').value.trim(), box = $('#sugg');
    if (!q) { box.hidden = true; return loadProducts(); }
    const r = await api('/api/suggest?q=' + encodeURIComponent(q));
    box.innerHTML = r.map(x => `<div data-s="${esc(x.name)}">${x.emoji} ${esc(x.name)}</div>`).join(''); box.hidden = !r.length;
    box.querySelectorAll('div').forEach(d => d.onclick = () => { $('#q').value = d.dataset.s; box.hidden = true; loadProducts(); });
    loadProducts();
  }, 250);
});
$('#sort').onchange = loadProducts;
document.addEventListener('click', e => { if (!e.target.closest('.search')) $('#sugg').hidden = true; });
