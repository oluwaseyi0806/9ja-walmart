// ============================================================
// FLASH SALE & COUNTDOWN
// Controls the flash sale & countdown.
// EDIT HERE: flash sale section (timer uses server time)
// ============================================================

async function loadFlash() {
  const f = await api('/api/flash');
  if (!f.items.length) { $('#flashSec').hidden = true; return; } // no flash deals yet
  const offset = f.serverNow - Date.now();
  $('#flashGrid').innerHTML = f.items.map(card).join('');
  const tick = () => {
    let s = Math.max(0, Math.floor((f.endsAt - (Date.now() + offset)) / 1000));
    if (s === 0) return location.reload();
    const h = String(Math.floor(s / 3600)).padStart(2, '0'), m = String(Math.floor(s % 3600 / 60)).padStart(2, '0');
    $('#timer').textContent = `${h}:${m}:${String(s % 60).padStart(2, '0')}`;
  };
  tick(); setInterval(tick, 1000);
}
