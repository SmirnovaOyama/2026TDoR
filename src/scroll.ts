import { clamp, el, reducedMotion } from './dom';
import { buildGhostWall, buildWall } from './wall';

const GHOST_ROWS = 8;

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

export function setupScroll(total: number) {
  const hero = document.querySelector<HTMLElement>('.hero')!;
  const countSection = document.querySelector('[data-count]')!;
  const countNum = el('count');
  const setLit = buildWall(el('wall'), total);
  const ghosts = document.querySelector('[data-ghosts]')!;
  const setGhosts = buildGhostWall(el('ghost-wall'), 3, GHOST_ROWS);
  const namesSection = document.querySelector('[data-names]')!;
  const places = [...document.querySelectorAll<HTMLElement>('.places li')];
  const timeline = el('timeline');
  const steps = [...timeline.querySelectorAll<HTMLElement>('li')];

  if (reducedMotion) {
    setLit(total);
    setGhosts(GHOST_ROWS);
    countNum.textContent = String(total);
    places.forEach((p) => p.classList.add('on'));
    steps.forEach((s) => s.classList.add('past'));
    return;
  }

  const update = () => {
    // The opening softens and drifts as it leaves.
    const hr = hero.getBoundingClientRect();
    hero.style.setProperty('--out', clamp(-hr.top / (hr.height * 0.9)).toFixed(3));

    // The count: the number climbs as the wall lights, square by square.
    const lit = Math.round(easeOut(clamp(stickyProgress(countSection) / 0.82)) * total);
    countNum.textContent = String(lit);
    setLit(lit);

    // The uncounted: outlined rows appear one by one.
    setGhosts(Math.round(clamp(passProgress(ghosts, 0.85, 0.45) * 1.1) * GHOST_ROWS));

    // Four places, one at a time.
    const on = Math.min(4, Math.floor(stickyProgress(namesSection) * 5.2));
    places.forEach((p, i) => p.classList.toggle('on', i < on));

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
