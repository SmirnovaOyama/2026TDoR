export const WALL_COLUMNS = 21; // the undercounting figure's width

const square = () => document.createElement('i');

/*
 * The count as a pixel candle, one square per person. 273 squares make it exactly:
 * a flame of 52, one square of wick and a body of 11 × 20. The squares light from
 * the base up as you scroll, so the flame catches with the last people counted.
 */
export const CANDLE_COLUMNS = 11;
const FLAME = [1, 1, 1, 3, 3, 5, 5, 7, 7, 7, 7, 5]; // squares per row, tip to base: a teardrop

interface Cell { r: number; c: number; colour: string }

function candle(total: number) {
  const cols = CANDLE_COLUMNS;
  const mid = (cols - 1) / 2;
  const cells: Cell[] = [];
  FLAME.forEach((w, r) => {
    const half = (w - 1) / 2;
    for (let c = mid - half; c <= mid + half; c++) {
      const edge = half - Math.abs(c - mid); // 0 at the flame's edge
      const colour = w === 1 || edge === 1 ? '--flame-mid' : edge === 0 ? '--flame-outer' : '--flame-core';
      cells.push({ r, c, colour });
    }
  });
  const wickRow = FLAME.length;
  cells.push({ r: wickRow, c: mid, colour: '--wick' });

  // The body takes the rest: full rows of wax, any remainder centred on the top row.
  const body = Math.max(0, total - cells.length);
  const bodyRows = Math.ceil(body / cols);
  const top = wickRow + 1;
  const firstRowCount = body - (bodyRows - 1) * cols;
  const drips = new Set([`${top + 1}:3`, `${top + 2}:3`, `${top + 3}:3`, `${top + 1}:7`, `${top + 2}:7`]);
  for (let i = 0; i < bodyRows; i++) {
    const r = top + i;
    const n = i === 0 ? firstRowCount : cols;
    const from = Math.floor((cols - n) / 2);
    for (let c = from; c < from + n; c++) {
      const colour = i === 0 || drips.has(`${r}:${c}`) || c === 1 ? '--wax-light' : c >= cols - 2 ? '--wax-shade' : '--wax';
      cells.push({ r, c, colour });
    }
  }
  return { cols, rows: top + bodyRows, cells };
}

/** The count as a candle of squares, lit from the base up. */
export function buildWall(host: HTMLElement, total: number) {
  const { cols, rows, cells } = candle(total);
  host.style.setProperty('--cols', String(cols));
  host.style.setProperty('--rows', String(rows));
  const at = new Map(cells.map((cell) => [cell.r * cols + cell.c, cell]));
  const squares = new Map<Cell, HTMLElement>();
  const slots = Array.from({ length: cols * rows }, (_, i) => {
    const cell = at.get(i);
    if (!cell) return document.createElement('span');
    const s = square();
    s.style.setProperty('--c', `var(${cell.colour})`);
    squares.set(cell, s);
    return s;
  });
  host.replaceChildren(...slots);
  // Lighting order: bottom row first, left to right, up to the tip of the flame.
  const order = [...cells].sort((a, b) => b.r - a.r || a.c - b.c).map((cell) => squares.get(cell)!);
  let lit = 0;
  return (n: number) => {
    n = Math.max(0, Math.min(order.length, n));
    for (let i = lit; i < n; i++) order[i].classList.add('on');
    for (let i = n; i < lit; i++) order[i].classList.remove('on');
    lit = n;
  };
}

/**
 * Rows of the count in wax, fading up into view, then outlined rows for the
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
