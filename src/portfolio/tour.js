// One-step guided tour: points first-time visitors at the "3D World" button in the nav.
// Shown once per visitor (remembered in localStorage); add ?tour to the URL to see it again.
const KEY = 'tour-3d-seen';
const seen = () => {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
};
const markSeen = () => {
  try { localStorage.setItem(KEY, '1'); } catch { /* storage blocked: tour may show again next visit */ }
};

export function initWorldTour({ title, body, cta, later } = {}) {
  const force = new URLSearchParams(location.search).has('tour');
  if (!force && seen()) return;

  const navBtn = document.querySelector('.nav-cta .btn');
  const menuBtn = document.querySelector('#menu-toggle');
  if (!navBtn) return;
  const visible = (el) => el && el.getClientRects().length > 0;
  // on narrow screens the 3D button lives inside the hamburger menu, so point at the menu instead
  const target = () => (visible(navBtn) ? navBtn : menuBtn);

  const tip = document.createElement('div');
  tip.className = 'tour';
  tip.setAttribute('role', 'dialog');
  tip.setAttribute('aria-labelledby', 'tour-title');
  tip.setAttribute('aria-describedby', 'tour-text');
  tip.innerHTML = `
    <span class="tour-arrow" aria-hidden="true"></span>
    <button class="tour-close" type="button" aria-label="Close tip">×</button>
    <p class="tour-step"><span class="tour-dot" aria-hidden="true"></span>Quick tour</p>
    <h3 id="tour-title"></h3>
    <p id="tour-text"></p>
    <p class="tour-hint">Find it any time under <b>3D World</b> in the menu.</p>
    <div class="tour-actions">
      <a class="btn primary sm" href="world.html"></a>
      <button class="btn ghost sm tour-later" type="button"></button>
    </div>`;
  tip.querySelector('#tour-title').textContent = title || 'Prefer to explore in 3D?';
  tip.querySelector('#tour-text').textContent =
    body || 'Drive a neon rover around a tiny planet where every landmark opens part of my CV.';
  tip.querySelector('.btn.primary').textContent = cta || 'Launch 3D world →';
  tip.querySelector('.tour-later').textContent = later || 'Maybe later';

  let current = null;
  const place = () => {
    if (!tip.isConnected) return;
    const t = target();
    if (!visible(t)) return;
    if (t !== current) {
      current?.classList.remove('tour-target');
      t.classList.add('tour-target');
      current = t;
      tip.classList.toggle('in-menu', t === menuBtn);
    }
    const r = t.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const w = tip.offsetWidth;
    const left = Math.min(Math.max(r.left + r.width / 2 - w / 2, 16), vw - w - 16);
    tip.style.left = `${left}px`;
    tip.style.top = `${r.bottom + 14}px`;
    const arrow = Math.min(Math.max(r.left + r.width / 2 - left, 20), w - 20);
    tip.style.setProperty('--arrow-x', `${arrow}px`);
  };

  const close = () => {
    if (!tip.isConnected) return;
    markSeen();
    tip.classList.remove('show');
    current?.classList.remove('tour-target');
    removeEventListener('resize', place);
    removeEventListener('scroll', place);
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('pointerdown', onOutside, true);
    setTimeout(() => tip.remove(), 250);
  };
  const onKey = (e) => e.key === 'Escape' && close();
  const onOutside = (e) => {
    if (tip.contains(e.target)) return;
    // opening the menu keeps the tip so it can follow the 3D button into the menu
    if (menuBtn?.contains(e.target)) return;
    close();
  };

  tip.querySelector('.tour-close').onclick = close;
  tip.querySelector('.tour-later').onclick = close;
  tip.querySelector('.btn.primary').addEventListener('click', markSeen);
  navBtn.addEventListener('click', markSeen);
  // opening / closing the menu moves the 3D button, so re-point the tip after the menu toggles
  menuBtn?.addEventListener('click', () => requestAnimationFrame(place));

  setTimeout(() => {
    document.body.append(tip);
    place();
    void tip.offsetWidth; // commit the hidden state first so the fade-in transition runs
    tip.classList.add('show');
    addEventListener('resize', place);
    addEventListener('scroll', place, { passive: true });
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onOutside, true);
  }, force ? 400 : 2500);
}
