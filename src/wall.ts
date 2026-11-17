export const WALL_COLUMNS = 21; // the undercounting figure's width

const square = () => document.createElement('i');

/*
 * Pixel candles. The count is one, a square per person: 273 squares make a teardrop
 * flame of 52, one square of wick and a body of 11 × 20. It lights from the base up
 * as you scroll, so the flame catches with the last people counted. The candle in
 * the Vigils section uses the same builder at a smaller size.
 */
export interface CandleCell { r: number; c: number; colour: string; part: 'flame' | 'wick' | 'wax' }

export interface CandleShape {
  cols: number;
  /** Squares per row of the flame, tip to base. */
  flame: number[];
  /** Squares of wax; a remainder short of a full row is centred on the top row. */
  body: number;
  /** Columns where wax runs down from the top, and how many rows. */
  drips: [number, number][];
}

export function candleCells({ cols, flame, body, drips }: CandleShape) {
  const mid = (cols - 1) / 2;
  const cells: CandleCell[] = [];
  flame.forEach((w, r) => {
    const half = (w - 1) / 2;
    for (let c = mid - half; c <= mid + half; c++) {
      const edge = half - Math.abs(c - mid); // 0 at the flame's edge
      const colour = w === 1 || edge === 1 ? '--flame-mid' : edge === 0 ? '--flame-outer' : '--flame-core';
      cells.push({ r, c, colour, part: 'flame' });
    }
  });
  const wickRow = flame.length;
  cells.push({ r: wickRow, c: mid, colour: '--wick', part: 'wick' });

  const bodyRows = Math.ceil(body / cols);
  const top = wickRow + 1;
  const firstRowCount = body - (bodyRows - 1) * cols;
  const dripAt = new Set(drips.flatMap(([c, depth]) => Array.from({ length: depth }, (_, i) => `${top + 1 + i}:${c}`)));
  for (let i = 0; i < bodyRows; i++) {
    const r = top + i;
    const n = i === 0 ? firstRowCount : cols;
    const from = Math.floor((cols - n) / 2);
    for (let c = from; c < from + n; c++) {
      const colour = i === 0 || dripAt.has(`${r}:${c}`) || c === 1 ? '--wax-light' : c >= cols - 2 ? '--wax-shade' : '--wax';
      cells.push({ r, c, colour, part: 'wax' });
    }
  }
  return { cols, rows: top + bodyRows, cells };
}

/** Lays a candle's squares into a grid host, with empty slots around the flame. */
export function renderCandle(host: HTMLElement, shape: CandleShape) {
  const { cols, rows, cells } = candleCells(shape);
  host.style.setProperty('--cols', String(cols));
  host.style.setProperty('--rows', String(rows));
  const at = new Map(cells.map((cell) => [cell.r * cols + cell.c, cell]));
  const squares = new Map<CandleCell, HTMLElement>();
  host.replaceChildren(...Array.from({ length: cols * rows }, (_, i) => {
    const cell = at.get(i);
    if (!cell) return document.createElement('span');
    const s = square();
    s.style.setProperty('--c', `var(${cell.colour})`);
    s.dataset.part = cell.part;
    squares.set(cell, s);
    return s;
  }));
  return { cells, squares };
}

const COUNT_FLAME = [1, 1, 1, 3, 3, 5, 5, 7, 7, 7, 7, 5];

/** The count as a candle of squares, lit from the base up. */
export function buildWall(host: HTMLElement, total: number) {
  const cols = 11;
  const body = Math.max(0, total - COUNT_FLAME.reduce((a, b) => a + b, 0) - 1);
  const { cells, squares } = renderCandle(host, { cols, flame: COUNT_FLAME, body, drips: [[3, 3], [7, 2]] });
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
