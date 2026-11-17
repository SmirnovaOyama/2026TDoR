import { clamp, el, formatNumber, reducedMotion, token } from './dom';
import type { Mode, TmmCountry, TmmData, WorldGrid } from './data/types';

/** Lower bounds of the five heat steps, per period. */
const STEPS: Record<Mode, number[]> = {
  thisYear: [1, 2, 5, 16, 41],
  allYears: [1, 10, 50, 150, 500],
};
const LEGEND_LABEL: Record<Mode, string> = {
  thisYear: 'People reported killed this year',
  allYears: 'People reported killed since 2008',
};
const REGION_ORDER = ['Latin America and the Caribbean', 'North America', 'Asia', 'Europe', 'Africa', 'Oceania'];

function rangeLabels(steps: number[]) {
  return steps.map((lo, i) => {
    const hi = steps[i + 1] ? steps[i + 1] - 1 : null;
    if (hi === null) return `${formatNumber(lo)}+`;
    return hi === lo ? formatNumber(lo) : `${formatNumber(lo)}–${formatNumber(hi)}`;
  });
}

const ordinalRules = new Intl.PluralRules('en-GB', { type: 'ordinal' });
const SUFFIX: Record<string, string> = { one: 'st', two: 'nd', few: 'rd', other: 'th' };
const ordinal = (n: number) => `${n}${SUFFIX[ordinalRules.select(n)]}`;

/** "about one in three" for shares big enough to say that way. */
function oneIn(share: number) {
  if (share < 0.05) return null;
  const words = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
  const n = Math.round(1 / share);
  return n >= 1 && n <= 20 ? `one in ${words[n]}` : null;
}

export class PixelMap {
  private mode: Mode = 'thisYear';
  private picked: string | null = null;
  private hover: string | null = null;
  private reveal = reducedMotion ? 1 : 0;
  private readonly cells: Uint16Array;
  private readonly byName = new Map<string, TmmCountry>();
  private readonly ctx: CanvasRenderingContext2D;
  private readonly heat = [1, 2, 3, 4, 5].map((i) => token(`--heat-${i}`));
  private readonly land = token('--map-land');
  private readonly pick = token('--map-pick');
  private readonly jitter: Float32Array;
  private size = 0;
  private dpr = 1;

  private readonly canvas = el<HTMLCanvasElement>('map');
  private readonly tip = el('map-tip');
  private readonly card = el('country-card');
  private readonly list = el('country-list');
  private readonly legend = el('legend');
  private readonly legendLabel = el('legend-label');
  private readonly modeButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-mode]')];

  constructor(private readonly grid: WorldGrid, private readonly data: TmmData) {
    this.ctx = this.canvas.getContext('2d')!;
    this.cells = new Uint16Array(grid.cols * grid.rows);
    for (let i = 0, at = 0; i < grid.rle.length; i += 2) {
      this.cells.fill(grid.rle[i], at, at + grid.rle[i + 1]);
      at += grid.rle[i + 1];
    }
    this.jitter = Float32Array.from({ length: grid.cols * grid.rows }, (_, i) => ((i * 2654435761) % 1000) / 1000);
    for (const c of data.countries) this.byName.set(c.name, c);
    this.canvas.style.aspectRatio = `${grid.cols} / ${grid.rows}`;

    this.modeButtons.forEach((b) => b.addEventListener('click', () => this.setMode(b.dataset.mode as Mode)));
    this.canvas.addEventListener('pointermove', (e) => this.onMove(e));
    this.canvas.addEventListener('pointerleave', () => this.setHover(null));
    this.canvas.addEventListener('click', (e) => {
      const name = this.nameAt(e, true);
      this.select(name === this.picked ? null : name);
    });
    new ResizeObserver(() => this.resize()).observe(this.canvas.parentElement!);
    this.watchReveal();
    this.render();
  }

  private count(c: TmmCountry | undefined) {
    return c ? c[this.mode] : 0;
  }

  private level(n: number) {
    const steps = STEPS[this.mode];
    let level = 0;
    steps.forEach((lo, i) => { if (n >= lo) level = i + 1; });
    return level;
  }

  private resize() {
    const width = this.canvas.parentElement!.clientWidth;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.size = (width / this.grid.cols) * this.dpr;
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(this.size * this.grid.rows);
    this.draw();
  }

  /** The map lights from west to east the first time it comes into view. */
  private watchReveal() {
    if (reducedMotion || !('IntersectionObserver' in window)) { this.reveal = 1; return; }
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const step = (now: number) => {
        this.reveal = clamp((now - start) / 2200);
        this.draw();
        if (this.reveal < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, { threshold: 0.25 });
    io.observe(this.canvas);
  }

  private draw() {
    const { ctx, size, grid } = this;
    if (!size) return;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const gap = size > 5 * this.dpr ? Math.max(this.dpr, size * 0.16) : size * 0.08;
    const front = this.reveal * (grid.cols + 24);
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const i = r * grid.cols + c;
        const id = this.cells[i];
        if (!id) continue;
        const name = grid.names[id];
        const level = this.level(this.count(this.byName.get(name)));
        const alpha = clamp((front - c - this.jitter[i] * 16) / 8);
        if (alpha <= 0) continue;
        if (name === this.picked) ctx.fillStyle = this.pick;
        else if (name === this.hover) ctx.fillStyle = level ? this.heat[4] : this.heat[0];
        else ctx.fillStyle = level ? this.heat[level - 1] : this.land;
        ctx.globalAlpha = level || name === this.picked || name === this.hover ? alpha : alpha * 0.9;
        ctx.fillRect(c * size + gap / 2, r * size + gap / 2, size - gap, size - gap);
      }
    }
    ctx.globalAlpha = 1;
  }

  private cellAt(e: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const c = Math.floor(((e.clientX - rect.left) / rect.width) * this.grid.cols);
    const r = Math.floor(((e.clientY - rect.top) / rect.height) * this.grid.rows);
    return { c, r, x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  /** The country under the pointer; near small places, the nearest one with reports. */
  private nameAt(e: MouseEvent, generous = false) {
    const { c, r } = this.cellAt(e);
    const at = (cc: number, rr: number) =>
      cc >= 0 && rr >= 0 && cc < this.grid.cols && rr < this.grid.rows ? this.cells[rr * this.grid.cols + cc] : 0;
    const id = at(c, r);
    if (id) return this.grid.names[id];
    const reach = generous || (e as PointerEvent).pointerType === 'touch' ? 2 : 1;
    let best: string | null = null;
    let bestD = Infinity;
    for (let dr = -reach; dr <= reach; dr++) {
      for (let dc = -reach; dc <= reach; dc++) {
        const near = at(c + dc, r + dr);
        if (!near) continue;
        const name = this.grid.names[near];
        if (!this.count(this.byName.get(name))) continue;
        const d = dc * dc + dr * dr;
        if (d < bestD) { bestD = d; best = name; }
      }
    }
    return best;
  }

  private onMove(e: PointerEvent) {
    if (e.pointerType === 'touch') return;
    const name = this.nameAt(e);
    this.setHover(name);
    if (!name) return;
    const { x, y } = this.cellAt(e);
    const n = this.count(this.byName.get(name));
    this.tip.innerHTML = '';
    this.tip.append(name);
    const span = document.createElement('span');
    span.textContent = n ? formatNumber(n) : 'None reported';
    this.tip.append(span);
    const half = this.tip.offsetWidth / 2;
    const width = this.canvas.clientWidth;
    this.tip.style.left = `${clamp(x, half, Math.max(half, width - half))}px`;
    this.tip.style.top = `${y}px`;
  }

  private setHover(name: string | null) {
    this.tip.hidden = !name;
    if (name === this.hover) return;
    this.hover = name;
    this.canvas.style.cursor = name ? 'pointer' : 'crosshair';
    this.draw();
  }

  setMode(mode: Mode) {
    this.mode = mode;
    this.modeButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    this.render();
  }

  select(name: string | null) {
    this.picked = name;
    this.renderCard();
    this.list.querySelectorAll<HTMLButtonElement>('button').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.name === name)),
    );
    this.draw();
  }

  private render() {
    const labels = rangeLabels(STEPS[this.mode]);
    this.legendLabel.textContent = LEGEND_LABEL[this.mode];
    this.legend.innerHTML = labels
      .map((label, i) => `<li><i style="background:var(--heat-${i + 1})"></i>${label}</li>`)
      .join('');

    const shown = this.data.countries.filter((c) => c[this.mode] > 0).sort((a, b) => b[this.mode] - a[this.mode] || a.name.localeCompare(b.name));
    this.list.setAttribute('aria-label', this.mode === 'thisYear' ? 'Countries with reported murders this year' : 'Countries with reported murders since 2008');
    this.list.replaceChildren(
      ...shown.map((c) => {
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.name = c.name;
        b.setAttribute('aria-pressed', String(c.name === this.picked));
        const a = document.createElement('span');
        a.textContent = c.name;
        const n = document.createElement('span');
        n.textContent = formatNumber(c[this.mode]);
        b.append(a, n);
        b.addEventListener('click', () => this.select(c.name === this.picked ? null : c.name));
        b.addEventListener('focus', () => this.setHover(c.name));
        b.addEventListener('blur', () => this.setHover(null));
        li.append(b);
        return li;
      }),
    );
    this.renderCard();
    this.draw();
  }

  private totals() {
    const total = this.mode === 'thisYear' ? this.data.total : this.data.totalAllYears;
    const counted = this.data.countries.filter((c) => c[this.mode] > 0);
    return { total, counted };
  }

  private renderCard() {
    const { total, counted } = this.totals();
    const thisYear = this.mode === 'thisYear';
    const period = thisYear ? 'this year' : 'since 2008';
    const c = this.picked ? this.byName.get(this.picked) : undefined;

    if (!this.picked) {
      const regions = new Map<string, number>();
      for (const k of counted) regions.set(k.region, (regions.get(k.region) ?? 0) + k[this.mode]);
      const rows = REGION_ORDER.filter((r) => regions.get(r)).map((r) => [r, formatNumber(regions.get(r)!)]);
      this.card.innerHTML = '';
      this.card.append(
        line('p', 'region', thisYear ? '1 October 2025 to 30 September 2026' : 'Every year of the count'),
        line('h3', '', `${counted.length} countries`),
        line('p', 'big', formatNumber(total)),
        line('p', 'big-label', `people reported killed ${period}`),
        table(rows),
        line('p', 'note', 'Choose a country on the map or in the list below to see its numbers.'),
      );
      return;
    }

    const name = this.picked;
    const n = c?.[this.mode] ?? 0;
    const other = c?.[thisYear ? 'allYears' : 'thisYear'] ?? 0;
    const rows: [string, string][] = [];
    let note: string;

    if (n > 0) {
      const share = n / total;
      const ahead = counted.filter((k) => k[this.mode] > n).length;
      const tied = counted.filter((k) => k[this.mode] === n).length > 1;
      rows.push([thisYear ? "Share of this year's count" : 'Share of all years', `${(share * 100).toFixed(share < 0.1 ? 1 : 0)}%`]);
      rows.push(['Rank', `${tied ? 'Joint ' : ''}${ordinal(ahead + 1)} of ${counted.length}`]);
      rows.push([thisYear ? 'Since 2008' : 'This year', formatNumber(other)]);
      const phrase = oneIn(share);
      note = phrase
        ? `About ${phrase} people in the ${thisYear ? "year's" : 'whole'} count ${thisYear ? 'was' : 'were'} killed in ${name}.`
        : n === 1
          ? `One person. Their name is read with all the others on 20 November.`
          : `${formatNumber(n)} people, each with a name that is read on 20 November.`;
    } else if (other > 0) {
      rows.push([thisYear ? 'Since 2008' : 'This year', formatNumber(other)]);
      note = thisYear
        ? `No murders were reported here this year. This is a count of reports, and reports fall when reporting gets harder.`
        : `No murders reported before this year.`;
    } else {
      note = 'No murders have been reported here since the count began in 2008. That can mean less violence. It can also mean deaths that went unreported, or people who were never recognised as trans.';
    }

    this.card.innerHTML = '';
    this.card.append(line('p', 'region', c?.region || 'No reports'), line('h3', '', name), line('p', 'big', formatNumber(n)), line('p', 'big-label', `people reported killed ${period}`));
    if (rows.length) this.card.append(table(rows));
    this.card.append(line('p', 'note', note));
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'segmented-clear';
    clear.textContent = 'Back to every country';
    clear.addEventListener('click', () => this.select(null));
    this.card.append(clear);
  }
}

function line(tag: 'p' | 'h3', cls: string, text: string) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  node.textContent = text;
  return node;
}

function table(rows: string[][]) {
  const dl = document.createElement('dl');
  for (const [k, v] of rows) {
    const div = document.createElement('div');
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = v;
    div.append(dt, dd);
    dl.append(div);
  }
  return dl;
}
