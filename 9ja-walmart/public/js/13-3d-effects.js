// ============================================================
// 3D EFFECTS: product cards tilt toward the mouse (desktop only)
// Turned off automatically on phones and for people who prefer reduced motion.
// EDIT HERE: change 10 (tilt strength) or 700 (perspective depth)
// ============================================================

if (matchMedia('(hover: hover)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.addEventListener('mousemove', e => {
    const c = e.target.closest && e.target.closest('.card'); if (!c) return;
    const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    c.style.transform = `perspective(700px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) translateZ(8px)`;
  });
  document.addEventListener('mouseout', e => {
    const c = e.target.closest && e.target.closest('.card'); if (c && !c.contains(e.relatedTarget)) c.style.transform = '';
  });
}
