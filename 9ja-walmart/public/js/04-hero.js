// ============================================================
// HERO BANNER CAROUSEL
// Controls the hero banner carousel.
// EDIT HERE: edit the slides array: title, subtitle, colour
// ============================================================

const slides = [
  ['The phone you want, from a store you can trust.', 'Buy from trusted sellers in your state', 'linear-gradient(120deg,#075E40,#0B7A53)'],
  ['Pay in the app. Stay protected.', 'Your money is held until you receive your phone', 'linear-gradient(120deg,#0B1220,#1B3555)'],
  ['Compare stores near you.', 'Same phone, many stores, pick the best price', 'linear-gradient(120deg,#14213D,#0B7A53)'],
];
let si = 0;
$('#hero').innerHTML = slides.map((s, i) => `<div class="slide ${i ? '' : 'on'}" style="background:${s[2]}"><h3>${s[0]}</h3><p>${s[1]}</p><a class="hero-cta" href="#grid">Shop phones</a></div>`).join('') +
  `<div class="dots">${slides.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>`;
setInterval(() => {
  si = (si + 1) % slides.length;
  document.querySelectorAll('.slide').forEach((el, i) => el.classList.toggle('on', i === si));
  document.querySelectorAll('.dots i').forEach((el, i) => el.classList.toggle('on', i === si));
}, 4000);
