// ============================================================
// CART (add, remove, drawer)
// Controls the cart (add, remove, drawer).
// EDIT HERE: cart behaviour and cart drawer
// ============================================================

const save = () => { localStorage.setItem('cart', JSON.stringify(cart)); renderCart(); };
function addToCart(id) { cart[id] = Math.min((cart[id] || 0) + 1, 20); save(); toast('Added to cart ✓'); } // optimistic: instant UI
function setQty(id, d) { cart[id] = (cart[id] || 0) + d; if (cart[id] < 1) delete cart[id]; save(); }
const lookup = id => products.find(p => p.id === +id) || window.allP?.find(p => p.id === +id);
function cartLines() { return Object.entries(cart).map(([id, qty]) => ({ p: lookup(id), qty })).filter(l => l.p); }
function renderCart() {
  const lines = cartLines(), total = lines.reduce((s, l) => s + l.p.price * l.qty, 0), n = lines.reduce((s, l) => s + l.qty, 0);
  $('#cartCount').textContent = n; $('#cartTotal').textContent = naira(total); $('#mobTotal').textContent = n ? `${naira(total)} (${n})` : 'Cart is empty';
  $('#cartItems').innerHTML = lines.length ? lines.map(({ p, qty }) => `<div class="ci"><div class="e">${p.emoji}</div>
    <div class="i">${esc(p.name)}<br><b>${naira(p.price)}</b></div>
    <div class="qty"><button data-q="${p.id}" data-d="-1">−</button>${qty}<button data-q="${p.id}" data-d="1">+</button></div></div>`).join('') : '<p style="padding:20px">Your cart is empty.</p>';
  document.querySelectorAll('[data-q]').forEach(b => b.onclick = () => setQty(+b.dataset.q, +b.dataset.d));
}
$('#cartBtn').onclick = () => $('#drawer').hidden = false;
$('#closeCart').onclick = () => $('#drawer').hidden = true;
