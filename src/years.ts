import { el, formatNumber } from './dom';
import type { TmmData } from './data/types';

const PER_SQUARE = 25;

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

  const show = (y: { year: number; count: number }) => {
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
    col.addEventListener('pointerenter', () => show(y));
    col.addEventListener('focus', () => show(y));
    col.addEventListener('pointerleave', () => show(last));
    col.addEventListener('blur', () => show(last));
    chart.append(col);

    const tick = document.createElement('span');
    tick.textContent = String(y.year).slice(2);
    if (y.year === years[0].year || y.year === last.year || y.year % 5 === 0) tick.className = 'keep';
    axis.append(tick);
  }
  show(last);
}
