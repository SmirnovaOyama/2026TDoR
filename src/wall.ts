export const WALL_COLUMNS = 21; // 21 × 13 = 273: this year's count fills the wall exactly

const square = () => document.createElement('i');

/**
 * The trans flag's stripe for a row: blue at the edges, pink, white in the middle.
 * With 13 rows that is 3 blue, 2 pink, 3 white, 2 pink, 3 blue, so the full wall is the flag.
 */
function stripe(row: number, rows: number) {
  const half = (rows - 1) / 2 || 1;
  const d = Math.abs(row - (rows - 1) / 2) / half;
  return d < 0.3 ? '--flag-white' : d < 0.6 ? '--flag-pink' : '--flag-blue';
}

/** The count as a wall of squares, one per person, lit in reading order. */
export function buildWall(host: HTMLElement, total: number) {
  host.style.setProperty('--cols', String(WALL_COLUMNS));
  const rows = Math.ceil(total / WALL_COLUMNS);
  const squares = Array.from({ length: total }, (_, i) => {
    const s = square();
    s.style.setProperty('--c', `var(${stripe(Math.floor(i / WALL_COLUMNS), rows)})`);
    return s;
  });
  host.replaceChildren(...squares);
  let lit = 0;
  return (n: number) => {
    n = Math.max(0, Math.min(total, n));
    for (let i = lit; i < n; i++) squares[i].classList.add('on');
    for (let i = n; i < lit; i++) squares[i].classList.remove('on');
    lit = n;
  };
}

/**
 * The last rows of the count fading up into view, then outlined rows for the
 * people it never reached, fading away below. Returns a setter for how many
 * of the outlined rows are showing.
 */
export function buildGhostWall(host: HTMLElement, litRows = 3, ghostRows = 8) {
  host.style.setProperty('--cols', String(WALL_COLUMNS));
  const row = (cls: string, opacity: number) => {
    const r = document.createElement('div');
    r.className = `ghost-row ${cls}`;
    r.style.setProperty('--o', opacity.toFixed(2));
    r.append(...Array.from({ length: WALL_COLUMNS }, square));
    return r;
  };
  const counted = Array.from({ length: litRows }, (_, i) => row('counted', (i + 1) / litRows * 0.85 + 0.15));
  const uncounted = Array.from({ length: ghostRows }, (_, i) => row('uncounted', 1 - i / ghostRows * 0.92));
  host.replaceChildren(...counted, ...uncounted);
  return (n: number) => uncounted.forEach((r, i) => r.classList.toggle('shown', i < n));
}

/** Each stat as a row of twenty squares, one square for every 5%. */
export function buildUnitRows() {
  for (const stat of document.querySelectorAll<HTMLElement>('.stat[data-value]')) {
    const units = stat.querySelector<HTMLElement>('.units');
    if (!units) continue;
    const filled = Number(stat.dataset.value) / 5;
    units.replaceChildren(
      ...Array.from({ length: 20 }, (_, j) => {
        const i = square();
        i.style.setProperty('--j', String(j));
        const share = Math.max(0, Math.min(1, filled - j));
        if (share > 0) {
          const b = document.createElement('b');
          if (share < 1) b.style.setProperty('--w', `${(share * 100).toFixed(0)}%`);
          i.append(b);
        }
        return i;
      }),
    );
  }
}
