import { clamp, el, reducedMotion } from './dom';

/** Press and hold to light the candle; letting go early lets it go out. */
export function setupVigil() {
  const vigil = el('vigil');
  const button = el<HTMLButtonElement>('hold-btn');
  const label = el('hold-label');
  const lit = el('lit');
  const HOLD_MS = reducedMotion ? 600 : 2000;
  let started = 0;
  let raf = 0;
  let done = false;

  const setHold = (v: number) => vigil.style.setProperty('--hold', String(v));
  const tick = (now: number) => {
    const p = clamp((now - started) / HOLD_MS);
    setHold(p);
    if (p >= 1) return finish();
    raf = requestAnimationFrame(tick);
  };
  const begin = () => {
    if (done || started) return;
    started = performance.now();
    label.textContent = 'Keep holding';
    raf = requestAnimationFrame(tick);
  };
  const cancel = () => {
    if (done || !started) return;
    cancelAnimationFrame(raf);
    started = 0;
    setHold(0);
    label.textContent = 'Hold to light a candle';
  };
  const finish = () => {
    done = true;
    started = 0;
    setHold(1);
    vigil.classList.add('lit');
    button.setAttribute('aria-pressed', 'true');
    label.textContent = 'Your candle is lit';
    lit.hidden = false;
  };

  button.addEventListener('pointerdown', (e) => {
    button.setPointerCapture?.(e.pointerId);
    begin();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) button.addEventListener(type, cancel);
  button.addEventListener('contextmenu', (e) => e.preventDefault());
  button.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
      e.preventDefault();
      begin();
    }
  });
  button.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') cancel(); });
  button.addEventListener('blur', cancel);
}
