// ==========================================================================
// INTERACTIONS LAYER  (interactions.js)
// Lightweight vanilla JS, no libraries. It only ADDS behaviour:
//   1. 3D tilt + shine on product cards and the phone photo (mouse only)
//   2. Cart badge "ping" when an item is added
//   3. Keyboard access for product cards (Tab, Enter, Space)
// It never changes text, styles you wrote, cart logic or buttons.
// Pair file: interactions.css (all the visuals and springs live there)
// EDIT HERE: MAX_TILT (degrees, keep 10-12), SELECTOR (what can tilt)
// ==========================================================================
(() => {
  'use strict';
  const MAX_TILT = 10;                    // degrees, the most a card may rotate
  const SELECTOR = '.card, .gal';         // product cards + the phone showcase photo
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const calm = matchMedia('(prefers-reduced-motion: reduce)');

  // iOS Safari only shows :active press feedback if a touch listener exists
  document.addEventListener('touchstart', () => {}, { passive: true });

  // ---------- 1. 3D TILT + SHINE (mouse / pen only, never touch) ----------
  let active = null, pending = null, raf = 0;

  function paint() {                      // runs once per frame (60fps), only writes CSS variables
    raf = 0; if (!pending) return;
    const { el, x, y } = pending; pending = null;
    el.style.setProperty('--ry', ((x - 0.5) * 2 * MAX_TILT).toFixed(2) + 'deg');
    el.style.setProperty('--rx', (-(y - 0.5) * 2 * MAX_TILT).toFixed(2) + 'deg');
    el.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
    el.style.setProperty('--my', (y * 100).toFixed(1) + '%');
  }
  function release(el) {                  // back to rest; the CSS spring does the easing
    if (!el) return;
    pending = null;
    el.classList.remove('is-tilting');
    ['--rx', '--ry', '--mx', '--my'].forEach(p => el.style.removeProperty(p));
  }
  document.addEventListener('pointermove', e => {
    if (calm.matches || !fine.matches || e.pointerType === 'touch') return;
    const el = e.target && e.target.closest ? e.target.closest(SELECTOR) : null;
    if (el !== active) { release(active); active = el; }
    if (!el) return;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
    el.classList.add('is-tilting');
    pending = { el, x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
    if (!raf) raf = requestAnimationFrame(paint);
  }, { passive: true });
  document.addEventListener('mouseout', e => { if (!e.relatedTarget) { release(active); active = null; } });   // pointer left the window
  addEventListener('scroll', () => { release(active); active = null; }, { passive: true, capture: true });  // content moved under a still pointer
  addEventListener('blur', () => { release(active); active = null; });

  // ---------- 2. CART BADGE PING ----------
  const badge = document.getElementById('cartCount');
  if (badge) {
    let last = parseInt(badge.textContent, 10) || 0, armedAt = 0;
    document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-add]')) armedAt = performance.now(); }, true);
    new MutationObserver(() => {
      const now = parseInt(badge.textContent, 10) || 0;
      if (now > last && performance.now() - armedAt < 1200 && !calm.matches) {   // only when the shopper just added something
        badge.classList.remove('ping'); void badge.offsetWidth; badge.classList.add('ping');
      }
      last = now;
    }).observe(badge, { childList: true, characterData: true, subtree: true });
    badge.addEventListener('animationend', () => badge.classList.remove('ping'));
  }

  // ---------- 3. KEYBOARD ACCESS FOR PRODUCT CARDS ----------
  let scheduled = false;
  function arm() {
    scheduled = false;
    document.querySelectorAll('.card[data-open]:not([tabindex])').forEach(c => {
      c.tabIndex = 0; c.setAttribute('role', 'button');
      const t = c.querySelector('.n'); if (t) c.setAttribute('aria-label', t.textContent.trim());
    });
  }
  new MutationObserver(() => { if (!scheduled) { scheduled = true; requestAnimationFrame(arm); } }).observe(document.body, { childList: true, subtree: true });
  arm();
  document.addEventListener('keydown', e => {
    const c = e.target;
    if (c && c.matches && c.matches('.card[data-open]') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); c.click(); }
  });
})();
