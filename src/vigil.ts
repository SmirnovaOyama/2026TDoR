import { clamp, el, reducedMotion } from './dom';
import { renderCandle } from './wall';

// Press and hold the candle in the Vigils section to light it. The flame fills square by
// square from the wick up; let go early and it dies back. Once lit it stays lit.
const LIGHT_MS = 1500; // holding this long lights the candle
const FADE_MS = 600; // let go early and the flame dies back this fast
const FLICKER_MS = 150;

const STATUS = {
  idle: 'Hold to light the candle',
  holding: 'Keep holding',
  lit: 'The candle is lit',
};

export function setupVigil() {
  const button = el<HTMLButtonElement>('vigil-candle');
  const status = el('vigil-status');
  const cols = 9;
  const { cells, squares } = renderCandle(el('vigil-squares'), {
    cols,
    flame: [1, 1, 1, 3, 3, 5, 5, 5, 3],
    body: cols * 11,
    drips: [[2, 3], [6, 2]],
  });
  const flame = cells.filter((c) => c.part === 'flame');
  const mid = (cols - 1) / 2;
  // Ignition order: from the wick up, centre outwards on each row.
  const order = [...flame]
    .sort((a, b) => b.r - a.r || Math.abs(a.c - mid) - Math.abs(b.c - mid))
    .map((c) => squares.get(c)!);
  // Once lit, the flame's edge and tip flicker.
  const edges = flame.filter((c) => c.colour === '--flame-outer' || c.r <= 2).map((c) => squares.get(c)!);

  let progress = 0;
  let shown = 0;
  let holding = false;
  let lit = false;
  let raf = 0;
  let prev = 0;

  const say = (text: string) => { if (status.textContent !== text) status.textContent = text; };
  const draw = () => {
    const n = Math.round(progress * order.length);
    for (let i = shown; i < n; i++) order[i].classList.add('on');
    for (let i = n; i < shown; i++) order[i].classList.remove('on');
    shown = n;
  };

  const flicker = () => {
    if (reducedMotion) return;
    let visible = true;
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(button);
    window.setInterval(() => {
      if (!visible) return;
      edges.forEach((s) => s.classList.remove('flick'));
      for (let k = 0; k < 2; k++) edges[Math.floor(Math.random() * edges.length)].classList.add('flick');
    }, FLICKER_MS);
  };

  const light = () => {
    lit = true;
    holding = false;
    raf = 0;
    progress = 1;
    draw();
    button.classList.remove('holding');
    button.classList.add('lit');
    button.setAttribute('aria-pressed', 'true');
    say(STATUS.lit);
    navigator.vibrate?.(12);
    flicker();
  };

  const tick = (now: number) => {
    const dt = Math.min(64, now - prev);
    prev = now;
    progress = clamp(progress + (holding ? dt / LIGHT_MS : -dt / FADE_MS));
    draw();
    if (progress >= 1) { light(); return; }
    if (holding || progress > 0) { raf = requestAnimationFrame(tick); return; }
    raf = 0;
    say(STATUS.idle);
  };

  const start = () => {
    if (lit || holding) return;
    holding = true;
    button.classList.add('holding');
    say(STATUS.holding);
    if (!raf) { prev = performance.now(); raf = requestAnimationFrame(tick); }
  };
  const stop = () => {
    if (!holding) return;
    holding = false;
    button.classList.remove('holding');
  };

  button.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    try { button.setPointerCapture(e.pointerId); } catch { /* already released */ }
    start();
  });
  button.addEventListener('pointerup', stop);
  button.addEventListener('pointercancel', stop); // the page took the touch to scroll
  button.addEventListener('lostpointercapture', stop);
  button.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); start(); }
  });
  button.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') stop(); });
  button.addEventListener('blur', stop);
  button.addEventListener('contextmenu', (e) => e.preventDefault());
}
