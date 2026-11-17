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

// Motion, in milliseconds. Steps are per 2.5° of distance, so finer grids move at the same speed.
const RIPPLE_STEP = 26; // delay per 2.5° of distance from where the country was chosen
const RIPPLE_CELL = 380; // how long each square takes to light
const SWEEP_STEP = 5; // delay per 2.5° of longitude when the period changes
const SWEEP_CELL = 420;
const DIM_MS = 420;
const COUNT_MS = 650;
const DIMMED = 0.32;

/** Where the map opens when it is too wide for the screen: the Americas, which hold most of the count. */
const OPEN_LON = -130;
/** How far, in CSS pixels, a tap may land from a country with reports and still choose it. */
const TOUCH_REACH_PX = 14;
/** Islands too small for the atlas are drawn at this fraction of a square. */
const ISLAND_SCALE = 0.5;

// China is shown to the public map standard (自然资规〔2023〕2号). Taiwan and the two SARs
// carry the same thematic colour as the mainland, so they are coloured from China's total
// and light with it when China is chosen; each can still be chosen on its own.
const CHINA = ['China', 'Taiwan (China)', 'Hong Kong SAR', 'Macau SAR'];
const PART_OF: Record<string, string> = { 'Taiwan (China)': 'China', 'Hong Kong SAR': 'China', 'Macau SAR': 'China' };
/** Places the map leaves uncoloured and does not offer to choose. */
const UNCOLOURED: Record<string, string> = { Kashmir: 'Disputed, not coloured' };

const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);

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

/** "one in three" for shares big enough to say that way. */
function oneIn(share: number) {
  if (share < 0.05) return null;
  const words = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
  const n = Math.round(1 / share);
  return n >= 1 && n <= 20 ? `one in ${words[n]}` : null;
}

interface Pick {
  name: string;
  start: number;
  c: number;
  r: number;
}

export class PixelMap {
  private mode: Mode = 'thisYear';
  private prevMode: Mode = 'thisYear';
  private modeStart = -Infinity;
  private pick: Pick | null = null;
  private leaving: Pick | null = null;
  private hover: string | null = null;
  private dimFrom = 1;
  private dimTo = 1;
  private dimStart = -Infinity;
  private reveal = reducedMotion ? 1 : 0;
  private animating = false;
  private shown = 0;
  private countRaf = 0;

  private readonly cells: Uint16Array;
  private readonly centre = new Map<string, { c: number; r: number }>();
  private readonly byName = new Map<string, TmmCountry>();
  private readonly ctx: CanvasRenderingContext2D;
  private readonly heat = [1, 2, 3, 4, 5].map((i) => token(`--heat-${i}`));
  private readonly land = token('--map-land');
  private readonly pickColour = token('--map-pick');
  private readonly jitter: Float32Array;
  private readonly islands: Set<number>;
  /** Cells per 2.5°: motion is scaled by this so it reads the same at any resolution. */
  private readonly k: number;
  private size = 0;
  private dpr = 1;
  private opened = false;

  private readonly canvas = el<HTMLCanvasElement>('map');
  private readonly frame = this.canvas.parentElement!;
  private readonly tip = el('map-tip');
  private readonly list = el('country-list');
  private readonly legend = el('legend');
  private readonly legendLabel = el('legend-label');
  private readonly segmented = document.querySelector<HTMLElement>('.segmented')!;
  private readonly modeButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-mode]')];
  private readonly ro = {
    sub: el('ro-sub'),
    title: el('ro-title'),
    num: el('ro-num'),
    unit: el('ro-unit'),
    facts: el('ro-facts'),
    note: el('ro-note'),
    clear: el<HTMLButtonElement>('ro-clear'),
  };
  private readonly factCells: { dt: HTMLElement; dd: HTMLElement }[];

  constructor(private readonly grid: WorldGrid, private readonly data: TmmData) {
    this.ctx = this.canvas.getContext('2d')!;
    this.cells = new Uint16Array(grid.cols * grid.rows);
    for (let i = 0, at = 0; i < grid.rle.length; i += 2) {
      this.cells.fill(grid.rle[i], at, at + grid.rle[i + 1]);
      at += grid.rle[i + 1];
    }
    this.jitter = Float32Array.from({ length: grid.cols * grid.rows }, (_, i) => ((i * 2654435761) % 1000) / 1000);
    this.islands = new Set(grid.islands);
    this.k = 2.5 / grid.step;

    // Where each country's squares sit on average, for ripples started from the list.
    const sums = new Map<number, { c: number; r: number; n: number }>();
    this.cells.forEach((id, i) => {
      if (!id) return;
      const s = sums.get(id) ?? { c: 0, r: 0, n: 0 };
      s.c += i % grid.cols;
      s.r += Math.floor(i / grid.cols);
      s.n++;
      sums.set(id, s);
    });
    sums.forEach((s, id) => this.centre.set(grid.names[id], { c: s.c / s.n, r: s.r / s.n }));

    for (const c of data.countries) this.byName.set(c.name, c);
    this.canvas.style.aspectRatio = `${grid.cols} / ${grid.rows}`;

    this.factCells = [0, 1, 2].map(() => {
      const div = document.createElement('div');
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      div.append(dt, dd);
      this.ro.facts.append(div);
      return { dt, dd };
    });

    this.modeButtons.forEach((b) => b.addEventListener('click', () => this.setMode(b.dataset.mode as Mode)));
    this.canvas.addEventListener('pointermove', (e) => this.onMove(e));
    this.canvas.addEventListener('pointerleave', () => this.setHover(null));
    this.canvas.addEventListener('click', (e) => {
      const name = this.nameAt(e, true);
      if (name && UNCOLOURED[name]) return;
      const { c, r } = this.cellAt(e);
      this.select(name === this.pick?.name ? null : name, { c, r });
    });
    this.ro.clear.addEventListener('click', () => this.select(null));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.pick) this.select(null); });
    new ResizeObserver(() => this.resize()).observe(this.canvas);
    this.watchReveal();
    this.renderList();
    this.renderLegend();
    this.renderReadout(false);
  }

  private count(c: TmmCountry | undefined, mode = this.mode) {
    return c ? c[mode] : 0;
  }

  private level(n: number, mode = this.mode) {
    let level = 0;
    STEPS[mode].forEach((lo, i) => { if (n >= lo) level = i + 1; });
    return level;
  }

  /** The count a place is coloured by: China's parts share one colour, from their total. */
  private heatCount(name: string, mode: Mode) {
    if (UNCOLOURED[name]) return 0;
    if (CHINA.includes(name)) return CHINA.reduce((n, part) => n + this.count(this.byName.get(part), mode), 0);
    return this.count(this.byName.get(name), mode);
  }

  private colourFor(name: string, mode: Mode) {
    const level = this.level(this.heatCount(name, mode), mode);
    return level ? this.heat[level - 1] : this.land;
  }

  /** Whether a square belongs to the chosen or hovered place: choosing China lights all of it. */
  private within(name: string, target: string | undefined | null) {
    return !!target && (name === target || (target === 'China' && CHINA.includes(name)));
  }

  private resize() {
    const width = this.canvas.clientWidth;
    if (!width) return;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.size = (width / this.grid.cols) * this.dpr;
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(this.size * this.grid.rows);
    this.draw(performance.now());
    if (!this.opened) {
      this.opened = true;
      this.panTo((OPEN_LON - this.grid.lonMin) / this.grid.step, 'start', false);
    }
  }

  /** On a phone the map is wider than the screen; this brings a column of it into view. */
  private panTo(column: number, align: 'start' | 'centre', smooth: boolean) {
    const { frame, canvas } = this;
    if (frame.scrollWidth <= frame.clientWidth + 1) return;
    const x = column * (canvas.clientWidth / this.grid.cols);
    const left = align === 'centre' ? canvas.offsetLeft + x - frame.clientWidth / 2 : x;
    frame.scrollTo({ left, behavior: smooth && !reducedMotion ? 'smooth' : 'auto' });
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
        this.draw(now);
        if (this.reveal < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, { threshold: 0.25 });
    io.observe(this.canvas);
  }

  /** Runs frames until every transition has settled. */
  private kick() {
    if (reducedMotion) { this.draw(performance.now()); return; }
    if (this.animating) return;
    this.animating = true;
    const frame = (now: number) => {
      const busy = this.draw(now);
      if (busy) requestAnimationFrame(frame);
      else this.animating = false;
    };
    requestAnimationFrame(frame);
  }

  /** Draws one frame and reports whether anything is still moving. */
  private draw(now: number) {
    const { ctx, size, grid } = this;
    if (!size) return false;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const { k } = this;
    const gap = size * (size > 3 * this.dpr ? 0.2 : 0.12);
    const front = this.reveal * (grid.cols + 24 * k);
    const motion = !reducedMotion;
    let busy = false;

    const dimT = motion ? easeOut(clamp((now - this.dimStart) / DIM_MS)) : 1;
    const dim = this.dimFrom + (this.dimTo - this.dimFrom) * dimT;
    if (dimT < 1) busy = true;

    const square = (c: number, r: number, scale: number) => {
      const s = (size - gap) * scale;
      const off = (size - s) / 2;
      ctx.fillRect(c * size + off, r * size + off, s, s);
    };

    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const i = r * grid.cols + c;
        const id = this.cells[i];
        if (!id) continue;
        const name = grid.names[id];
        const reveal = clamp((front - c - this.jitter[i] * 16 * k) / (8 * k));
        if (reveal <= 0) continue;
        const scale = this.islands.has(i) ? ISLAND_SCALE : 1;

        // Period change: the new colours sweep in from the west.
        const m = motion ? easeOut(clamp((now - this.modeStart - (c * SWEEP_STEP) / k) / SWEEP_CELL)) : 1;
        if (m < 1) busy = true;
        const isPicked = this.within(name, this.pick?.name);
        const isLeaving = this.within(name, this.leaving?.name);
        const fade = isPicked || isLeaving ? 1 : dim;

        if (m < 1 && this.prevMode !== this.mode) {
          ctx.globalAlpha = reveal * fade * (1 - m);
          ctx.fillStyle = this.colourFor(name, this.prevMode);
          square(c, r, scale);
        }
        ctx.globalAlpha = reveal * fade * (this.prevMode !== this.mode ? m : 1);
        const hovered = this.within(name, this.hover) && !isPicked && !UNCOLOURED[name];
        ctx.fillStyle = hovered ? this.heat[4] : this.colourFor(name, this.mode);
        square(c, r, scale);

        // A chosen country lights in a ripple from where it was chosen.
        const lit = (p: Pick, out: boolean) => {
          const d = Math.hypot(c - p.c, r - p.r);
          let t = motion ? clamp((now - p.start - (out ? 0 : (d * RIPPLE_STEP) / k)) / (out ? DIM_MS : RIPPLE_CELL)) : 1;
          if (t < 1) busy = true;
          t = out ? 1 - easeOut(t) : t;
          if (t <= 0) return;
          const pop = out ? 1 : 1 + 0.45 * Math.sin(Math.PI * easeOut(t));
          ctx.globalAlpha = reveal * (out ? t : easeOut(t));
          ctx.fillStyle = this.pickColour;
          square(c, r, pop * scale);
        };
        if (isPicked) lit(this.pick!, false);
        else if (isLeaving) lit(this.leaving!, true);
      }
    }
    if (this.drawDashes(now, front, dim)) busy = true;
    ctx.globalAlpha = 1;
    return busy;
  }

  /** The South China Sea ten-dash line, drawn in China's colour and lit with it. */
  private drawDashes(now: number, front: number, dim: number) {
    const { ctx, size, grid, k } = this;
    const motion = !reducedMotion;
    const x = (lon: number) => ((lon - grid.lonMin) / grid.step) * size;
    const y = (lat: number) => ((grid.latMax - lat) / grid.step) * size;
    const chinaPicked = this.within('China', this.pick?.name);
    const chinaLeaving = this.within('China', this.leaving?.name);
    let busy = false;
    ctx.lineWidth = Math.max(this.dpr, size * 0.22);
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    for (const dash of grid.dashes) {
      const [lon, lat] = dash[Math.floor(dash.length / 2)];
      const c = (lon - grid.lonMin) / grid.step;
      const r = (grid.latMax - lat) / grid.step;
      const reveal = clamp((front - c) / (8 * k));
      if (reveal <= 0) continue;
      const path = () => {
        ctx.beginPath();
        dash.forEach(([lo, la], i) => (i ? ctx.lineTo(x(lo), y(la)) : ctx.moveTo(x(lo), y(la))));
        ctx.stroke();
      };
      const m = motion ? easeOut(clamp((now - this.modeStart - (c * SWEEP_STEP) / k) / SWEEP_CELL)) : 1;
      if (m < 1) busy = true;
      const fade = chinaPicked || chinaLeaving ? 1 : dim;
      if (m < 1 && this.prevMode !== this.mode) {
        ctx.globalAlpha = reveal * fade * (1 - m);
        ctx.strokeStyle = this.colourFor('China', this.prevMode);
        path();
      }
      ctx.globalAlpha = reveal * fade * (this.prevMode !== this.mode ? m : 1);
      ctx.strokeStyle = this.colourFor('China', this.mode);
      path();
      const p = chinaPicked ? this.pick! : chinaLeaving ? this.leaving! : null;
      if (p) {
        const out = !chinaPicked;
        const d = Math.hypot(c - p.c, r - p.r);
        let t = motion ? clamp((now - p.start - (out ? 0 : (d * RIPPLE_STEP) / k)) / (out ? DIM_MS : RIPPLE_CELL)) : 1;
        if (t < 1) busy = true;
        t = out ? 1 - easeOut(t) : easeOut(t);
        if (t > 0) {
          ctx.globalAlpha = reveal * t;
          ctx.strokeStyle = this.pickColour;
          path();
        }
      }
    }
    return busy;
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
    const cellPx = this.canvas.clientWidth / this.grid.cols;
    const touch = (e as PointerEvent).pointerType === 'touch';
    const reach = touch ? Math.max(2, Math.round(TOUCH_REACH_PX / cellPx)) : generous ? 2 : 1;
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
    this.tip.replaceChildren(name);
    const span = document.createElement('span');
    span.textContent = UNCOLOURED[name] ?? (n ? formatNumber(n) : 'None reported');
    this.tip.append(span);
    const half = this.tip.offsetWidth / 2;
    const width = this.canvas.clientWidth;
    this.tip.style.left = `${this.canvas.offsetLeft + clamp(x, half, Math.max(half, width - half))}px`;
    this.tip.style.top = `${this.canvas.offsetTop + y}px`;
  }

  private setHover(name: string | null) {
    this.tip.hidden = !name;
    if (name === this.hover) return;
    this.hover = name;
    this.canvas.style.cursor = name && !UNCOLOURED[name] ? 'pointer' : 'default';
    this.kick();
  }

  setMode(mode: Mode) {
    if (mode === this.mode) return;
    this.prevMode = this.mode;
    this.mode = mode;
    this.modeStart = performance.now();
    this.segmented.style.setProperty('--seg', mode === 'allYears' ? '1' : '0');
    this.modeButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    this.renderLegend();
    this.renderList();
    this.renderReadout(true);
    this.kick();
  }

  select(name: string | null, from?: { c: number; r: number }) {
    if (name === (this.pick?.name ?? null)) return;
    const now = performance.now();
    this.leaving = this.pick ? { ...this.pick, start: now } : null;
    const origin = from ?? (name ? this.centre.get(name) : undefined) ?? { c: 0, r: 0 };
    this.pick = name ? { name, start: now, ...origin } : null;
    const dimNow = this.dimFrom + (this.dimTo - this.dimFrom) * easeOut(clamp((now - this.dimStart) / DIM_MS));
    this.dimFrom = dimNow;
    this.dimTo = name ? DIMMED : 1;
    this.dimStart = now;
    this.list.querySelectorAll<HTMLButtonElement>('button').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.name === name)),
    );
    this.renderReadout(true);
    this.kick();
    // Chosen from the list: on a phone, pan the map so the country is in view when you scroll back up.
    if (name && !from) this.panTo(origin.c, 'centre', true);
  }

  private renderLegend() {
    const labels = rangeLabels(STEPS[this.mode]);
    this.legendLabel.textContent = LEGEND_LABEL[this.mode];
    this.legend.innerHTML = labels
      .map((label, i) => `<li><i style="background:var(--heat-${i + 1})"></i>${label}</li>`)
      .join('');
  }

  private renderList() {
    const shown = this.data.countries
      .filter((c) => c[this.mode] > 0)
      .sort((a, b) => b[this.mode] - a[this.mode] || a.name.localeCompare(b.name));
    this.list.setAttribute('aria-label', this.mode === 'thisYear' ? 'Countries with reported murders this year' : 'Countries with reported murders since 2008');
    this.list.replaceChildren(
      ...shown.map((c) => {
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.name = c.name;
        b.setAttribute('aria-pressed', String(c.name === this.pick?.name));
        const a = document.createElement('span');
        a.textContent = c.name;
        const n = document.createElement('span');
        n.textContent = formatNumber(c[this.mode]);
        b.append(a, n);
        b.addEventListener('click', () => this.select(c.name === this.pick?.name ? null : c.name));
        b.addEventListener('pointerenter', () => this.setHover(c.name));
        b.addEventListener('pointerleave', () => this.setHover(null));
        b.addEventListener('focus', () => this.setHover(c.name));
        b.addEventListener('blur', () => this.setHover(null));
        li.append(b);
        return li;
      }),
    );
  }

  /** Fills the readout; with `animate`, the text comes into focus and the number counts to its new value. */
  private renderReadout(animate: boolean) {
    const thisYear = this.mode === 'thisYear';
    const total = thisYear ? this.data.total : this.data.totalAllYears;
    const counted = this.data.countries.filter((c) => c[this.mode] > 0);
    const period = thisYear ? 'this year' : 'since 2008';
    const otherLabel = thisYear ? 'Since 2008' : 'This year';

    let sub: string, title: string, value: number, note: string;
    let facts: [string, string][];

    if (!this.pick) {
      const top = [...counted].sort((a, b) => b[this.mode] - a[this.mode])[0];
      sub = thisYear ? '1 October 2025 to 30 September 2026' : '2008 to 2026';
      title = 'Worldwide';
      value = total;
      facts = [
        ['Countries', String(counted.length)],
        ['Highest', `${top.name}, ${formatNumber(top[this.mode])}`],
        [otherLabel, formatNumber(thisYear ? this.data.totalAllYears : this.data.total)],
      ];
      note = 'Select a country on the map or in the list.';
    } else {
      const name = this.pick.name;
      const c = this.byName.get(name);
      const n = c?.[this.mode] ?? 0;
      const other = c?.[thisYear ? 'allYears' : 'thisYear'] ?? 0;
      sub = PART_OF[name] ?? (c?.region || 'No reports since 2008');
      title = name;
      value = n;
      if (n > 0) {
        const share = n / total;
        const ahead = counted.filter((k) => k[this.mode] > n).length;
        const tied = counted.filter((k) => k[this.mode] === n).length > 1;
        facts = [
          ['Share', `${(share * 100).toFixed(share < 0.1 ? 1 : 0)}%`],
          [tied ? 'Joint rank' : 'Rank', `${ordinal(ahead + 1)} of ${counted.length}`],
          [otherLabel, formatNumber(other)],
        ];
        const phrase = oneIn(share);
        note = phrase ? `About ${phrase} people in the ${thisYear ? "year's" : 'whole'} count ${thisYear ? 'was' : 'were'} killed in ${name}.` : '';
      } else {
        facts = [['Share', 'None'], ['Rank', 'Not ranked'], [otherLabel, formatNumber(other)]];
        note = other > 0
          ? `No murders were reported here ${thisYear ? 'this year' : 'before this year'}.`
          : PART_OF[name]
            ? 'No murders reported here since the count began in 2008. On the map it takes the colour of the rest of China.'
            : 'No murders reported since the count began in 2008. This can reflect less violence or less reporting.';
      }
    }

    this.ro.sub.textContent = sub;
    this.ro.title.textContent = title;
    this.ro.title.title = title;
    this.ro.unit.textContent = `people reported killed ${period}`;
    facts.forEach(([k, v], i) => {
      this.factCells[i].dt.textContent = k;
      this.factCells[i].dd.textContent = v;
      this.factCells[i].dd.title = v;
    });
    this.ro.note.textContent = note;
    this.ro.clear.hidden = !this.pick;

    if (animate && !reducedMotion) {
      const parts = [this.ro.sub, this.ro.title, this.ro.unit, ...this.factCells.map((f) => f.dd), this.ro.note];
      parts.forEach((p, i) => {
        p.classList.remove('swap');
        void p.offsetWidth; // restart the animation
        p.style.animationDelay = `${i * 35}ms`;
        p.classList.add('swap');
      });
      this.countTo(value);
    } else {
      this.shown = value;
      this.ro.num.textContent = formatNumber(value);
    }
  }

  private countTo(target: number) {
    cancelAnimationFrame(this.countRaf);
    const from = this.shown;
    const start = performance.now();
    const step = (now: number) => {
      const t = easeOut(clamp((now - start) / COUNT_MS));
      this.shown = Math.round(from + (target - from) * t);
      this.ro.num.textContent = formatNumber(this.shown);
      if (t < 1) this.countRaf = requestAnimationFrame(step);
    };
    this.countRaf = requestAnimationFrame(step);
  }
}
