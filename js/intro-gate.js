// Runs right after the intro overlay markup, before first paint.
// Show the intro once per session, and never for reduced-motion users or deep links (e.g. /#contact).
(() => {
  const overlay = document.getElementById('li-intro');
  if (!overlay) return;
  let seen = true;
  try { seen = sessionStorage.getItem('ls-intro-seen') === '1'; } catch (e) { /* storage blocked: skip intro */ }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (seen || reduced || location.hash) {
    overlay.remove();
    return;
  }
  document.documentElement.classList.add('li-lock');
})();
