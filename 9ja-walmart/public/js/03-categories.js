// ============================================================
// CATEGORY BAR
// Controls the category bar.
// EDIT HERE: the category chips under the header
// ============================================================

async function loadCats() {
  const cats = await api('/api/categories');
  $('#cats').innerHTML = ['All', ...cats.map(c => c.name)].map(c =>
    `<button class="chip ${(c === 'All' && !category) || c === category ? 'on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
  document.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => {
    category = b.dataset.cat === 'All' ? '' : b.dataset.cat; $('#q').value = ''; loadCats(); loadProducts();
  });
}
