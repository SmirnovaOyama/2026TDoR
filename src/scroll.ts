import { clamp, el, reducedMotion } from './dom';
import type { Field } from './field';

const START = 7;

/** Progress through a tall section whose stage sticks to the screen. */
const stickyProgress = (node: Element) => {
  const r = node.getBoundingClientRect();
  return clamp(-r.top / Math.max(1, r.height - innerHeight));
};
/** Progress of an element passing through the screen, from `from` to `to` (fractions of the screen height). */
const passProgress = (node: Element, from = 1, to = 0) => {
  const r = node.getBoundingClientRect();
  const vh = innerHeight;
  return clamp((vh * from - r.top) / Math.max(1, r.height + vh * (from - to)));
};
const easeOut = (x: number) => 1 - Math.pow(1 - x, 2.2);

export function setupScroll(field: Field) {
  const countSection = document.querySelector('[data-count]')!;
  const countNum = el('count');
  const missing = document.querySelector('[data-missing]')!;
  const namesSection = document.querySelector('[data-names]')!;
  const places = [...document.querySelectorAll<HTMLElement>('.places li')];
  const thesis = el('thesis');
  const timeline = el('timeline');
  const steps = [...timeline.querySelectorAll<HTMLElement>('li')];

  // Split the line into words so they come up one at a time.
  const text = thesis.textContent!.trim();
  thesis.setAttribute('aria-label', text);
  thesis.innerHTML = text
    .split(/\s+/)
    .map((word) => `<span class="w" aria-hidden="true">${word}</span>`)
    .join(' ');
  const words = [...thesis.querySelectorAll<HTMLElement>('.w')];
  thesis.classList.add('split');

  if (reducedMotion) {
    field.set(field.total, field.ghostTotal);
    countNum.textContent = String(field.total);
    places.forEach((p) => p.classList.add('on'));
    words.forEach((w) => w.classList.add('on'));
    steps.forEach((s) => s.classList.add('past'));
    return;
  }

  const update = () => {
    // The count: the number and the lights rise together.
    const pc = easeOut(clamp(stickyProgress(countSection) / 0.8));
    countNum.textContent = String(Math.round(pc * field.total));
    const kindled = START + Math.round(pc * (field.total - START));
    // The uncounted: faint lights gather as that section passes.
    const ghosts = Math.round(clamp(passProgress(missing, 0.9, 0.2) * 1.25) * field.ghostTotal);
    field.set(kindled, ghosts);

    // Four places, one at a time.
    const lit = Math.min(4, Math.floor(stickyProgress(namesSection) * 5.2));
    places.forEach((p, i) => p.classList.toggle('on', i < lit));

    // The line, word by word.
    const n = Math.round(clamp(passProgress(thesis, 0.85, 0.35) * 1.15) * words.length);
    words.forEach((w, i) => w.classList.toggle('on', i < n));

    // The timeline draws down as you read.
    const r = timeline.getBoundingClientRect();
    const reach = innerHeight * 0.62 - r.top;
    timeline.style.setProperty('--p', String(clamp(reach / r.height)));
    steps.forEach((s) => s.classList.toggle('past', s.offsetTop + 8 < reach));
  };

  let queued = false;
  const queue = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; update(); });
  };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  update();
}
