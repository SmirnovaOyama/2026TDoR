import { clamp, el, formatNumber } from './dom';
import type { TmmData } from './data/types';

const PER_SQUARE = 25;

// Touch: hold still this long, or drag sideways this far, and the chart follows your finger.
const HOLD_MS = 220;
const SLOP_PX = 8;
/** After you let go, the year you were on stays this long before the latest returns. */
const LINGER_MS = 1800;

/** Each year as a column of squares, 25 people to a square, drawn to scale. */
export function setupYears(data: TmmData) {
  const chart = el('years-chart');
  const axis = el('years-axis');
  const value = el('years-value');
  const label = el('years-label');
  const years = data.years;
  const last = years[years.length - 1];
  const tallest = Math.ceil(Math.max(...years.map((y) => y.count)) / PER_SQUARE);
  chart.style.setProperty('--n', String(years.length));
  axis.style.setProperty('--n', String(years.length));

  type Year = (typeof years)[number];
  let shown: Year | null = null;
  const show = (y: Year) => {
    if (y === shown) return;
    shown = y;
    value.textContent = formatNumber(y.count);
    label.textContent = `TDoR ${y.year}`;
    chart.querySelectorAll('.year').forEach((c) => c.classList.toggle('on', (c as HTMLElement).dataset.year === String(y.year)));
  };

  for (const y of years) {
    const col = document.createElement('button');
    col.type = 'button';
    col.className = 'year' + (y === last ? ' now' : '');
    col.dataset.year = String(y.year);
    col.setAttribute('aria-label', `TDoR ${y.year}, ${formatNumber(y.count)} people`);
    const full = Math.floor(y.count / PER_SQUARE);
    const part = (y.count % PER_SQUARE) / PER_SQUARE;
    const square = `calc((100% - ${tallest - 1} * 2px) / ${tallest})`;
    for (let i = 0; i < full; i++) {
      const s = document.createElement('i');
      s.style.height = square;
      col.append(s);
    }
    if (part > 0) {
      const s = document.createElement('i');
      s.style.height = `calc(${square} * ${part.toFixed(3)})`;
      col.append(s);
    }
    // A mouse or pen reads a year by pointing at it; touch uses hold and drag, below.
    col.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') show(y); });
    col.addEventListener('focus', () => show(y));
    col.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') show(last); });
    col.addEventListener('blur', () => show(last));
    chart.append(col);

    const tick = document.createElement('span');
    tick.textContent = String(y.year).slice(2);
    // On narrow screens only these labels show: the ends, and every fifth year not crowding them.
    const roomy = y.year - years[0].year > 2 && last.year - y.year > 2;
    if (y.year === years[0].year || y.year === last.year || (y.year % 5 === 0 && roomy)) tick.className = 'keep';
    axis.append(tick);
  }
  show(last);
  setupScrub(chart, years, show, last);
}

/**
 * Hold and drag: press on the chart and hold, or drag sideways, and the readout follows
 * your finger from year to year. A vertical swipe still scrolls the page. A tap shows the
 * year tapped. Either way the year stays a moment after you let go, then the latest returns.
 */
function setupScrub<Y>(chart: HTMLElement, years: Y[], show: (y: Y) => void, last: Y) {
  let start: { x: number; y: number; id: number } | null = null;
  let scrubbing = false;
  let current: Y | null = null;
  let hold = 0;
  let linger = 0;

  const yearAt = (clientX: number) => {
    const r = chart.getBoundingClientRect();
    return years[clamp(Math.floor(((clientX - r.left) / r.width) * years.length), 0, years.length - 1)];
  };
  const follow = (clientX: number) => {
    const y = yearAt(clientX);
    if (y === current) return;
    current = y;
    show(y);
    if (scrubbing) navigator.vibrate?.(4); // a light tick per year, where the phone supports it
  };
  const begin = (clientX: number) => {
    if (!start) return;
    scrubbing = true;
    chart.classList.add('scrubbing');
    try { chart.setPointerCapture(start.id); } catch { /* the pointer already ended */ }
    follow(clientX);
  };
  const end = (keep: boolean) => {
    clearTimeout(hold);
    scrubbing = false;
    start = null;
    current = null;
    chart.classList.remove('scrubbing');
    clearTimeout(linger);
    linger = keep ? window.setTimeout(() => show(last), LINGER_MS) : 0;
    if (!keep) show(last);
  };

  chart.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    clearTimeout(linger);
    start = { x: e.clientX, y: e.clientY, id: e.pointerId };
    const x = e.clientX;
    hold = window.setTimeout(() => begin(x), HOLD_MS);
  });
  chart.addEventListener('pointermove', (e) => {
    if (!start || e.pointerId !== start.id) return;
    if (scrubbing) { follow(e.clientX); return; }
    const dx = Math.abs(e.clientX - start.x);
    const dy = Math.abs(e.clientY - start.y);
    if (dx > SLOP_PX && dx > dy) { clearTimeout(hold); begin(e.clientX); }
    else if (dy > SLOP_PX) { clearTimeout(hold); start = null; } // a scroll: leave it to the page
  });
  chart.addEventListener('pointerup', (e) => {
    if (!start || e.pointerId !== start.id) return;
    if (!scrubbing) follow(e.clientX); // a tap
    end(true);
  });
  chart.addEventListener('pointercancel', () => { if (start) end(false); });
  // While scrubbing, the drag belongs to the chart rather than the page.
  chart.addEventListener('touchmove', (e) => { if (scrubbing) e.preventDefault(); }, { passive: false });
  chart.addEventListener('contextmenu', (e) => { if (start || scrubbing) e.preventDefault(); });
}
