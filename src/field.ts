import { clamp, reducedMotion, token } from './dom';

interface Light {
  x: number;
  y: number;
  r: number;
  phase: number;
  speed: number;
  core: boolean;
  v: number;
}

/**
 * The field of lights behind the page: one per person in this year's count,
 * and a second, fainter set for the people the count never reached.
 */
export class Field {
  kindled: number;
  ghosts = 0;
  private bright = 0;
  private brightTarget = 0;
  private readonly lights: Light[];
  private readonly faint: Light[];
  private readonly ctx: CanvasRenderingContext2D;
  private readonly colors = { flame: token('--flame'), core: token('--flame-core'), ghost: token('--ghost') };
  private w = 0;
  private h = 0;
  private last = performance.now();
  private running = false;
  private locked = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    readonly total: number,
    readonly ghostTotal: number,
    start: number,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.kindled = start;
    const rand = mulberry32(1120);
    const make = (n: number, rMin: number, rMax: number): Light[] =>
      Array.from({ length: n }, () => ({
        x: rand(),
        y: rand(),
        r: rMin + rand() * (rMax - rMin),
        phase: rand() * Math.PI * 2,
        speed: 0.5 + rand() * 1.4,
        core: rand() < 0.28,
        v: 0,
      }));
    this.lights = make(total, 1.1, 2.5);
    this.faint = make(ghostTotal, 0.8, 1.6);
    this.resize();
    addEventListener('resize', () => { this.resize(); this.wake(); });
    document.addEventListener('visibilitychange', () => this.wake());
  }

  /** Sets how many lights burn, unless the candle has already lit them all. */
  set(kindled: number, ghosts: number) {
    if (this.locked) return;
    this.kindled = kindled;
    this.ghosts = ghosts;
    this.wake();
  }

  /** Brings every light up and keeps them up, as when the candle is lit. */
  kindleAll() {
    this.locked = true;
    this.kindled = this.total;
    this.ghosts = this.ghostTotal;
    this.brightTarget = 1;
    this.wake();
  }

  wake() {
    if (this.running || document.hidden) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.frame);
  }

  private resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = innerWidth;
    this.h = innerHeight;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** Lights behind the reading column stay dim so the text reads first. */
  private dim(x: number) {
    if (this.w < 900) return 0.5;
    const half = Math.min(this.w / 2, 400);
    return Math.abs(x * this.w - this.w / 2) < half ? 0.32 : 1;
  }

  private frame = (now: number) => {
    const dt = Math.min(64, now - this.last) / 1000;
    this.last = now;
    const t = now / 1000;
    const ease = reducedMotion ? 1 : 1 - Math.pow(0.002, dt);
    this.bright += (this.brightTarget - this.bright) * (reducedMotion ? 1 : 1 - Math.pow(0.05, dt));
    const { ctx, w, h } = this;
    ctx.clearRect(0, 0, w, h);

    const mood = 0.62 + 0.38 * this.bright;
    const grow = 1 + 0.35 * this.bright;
    let moving = Math.abs(this.brightTarget - this.bright) > 0.002;

    ctx.fillStyle = this.colors.ghost;
    this.faint.forEach((g, i) => {
      const target = i < this.ghosts ? 1 : 0;
      g.v += (target - g.v) * ease;
      if (Math.abs(target - g.v) > 0.005) moving = true;
      if (g.v < 0.01) return;
      const flicker = reducedMotion ? 1 : 0.75 + 0.25 * Math.sin(t * g.speed * 0.6 + g.phase);
      ctx.globalAlpha = 0.34 * g.v * flicker * this.dim(g.x) * (0.8 + 0.4 * this.bright);
      ctx.beginPath();
      ctx.arc(g.x * w, g.y * h, g.r * g.v, 0, Math.PI * 2);
      ctx.fill();
    });

    this.lights.forEach((l, i) => {
      const target = i < this.kindled ? 1 : 0;
      l.v += (target - l.v) * ease;
      if (Math.abs(target - l.v) > 0.005) moving = true;
      if (l.v < 0.01) return;
      const flicker = reducedMotion
        ? 1
        : 0.82 + 0.13 * Math.sin(t * l.speed + l.phase) + 0.05 * Math.sin(t * l.speed * 2.9 + l.phase * 1.7);
      const pop = l.v < 1 ? 1 + 0.6 * Math.sin(Math.PI * l.v) : 1;
      ctx.globalAlpha = clamp(l.v * flicker * mood * this.dim(l.x));
      ctx.fillStyle = l.core ? this.colors.core : this.colors.flame;
      ctx.beginPath();
      ctx.arc(l.x * w, l.y * h, l.r * l.v * pop * grow, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Flicker keeps the loop alive; with reduced motion it sleeps once settled.
    if (document.hidden || (reducedMotion && !moving)) {
      this.running = false;
      return;
    }
    requestAnimationFrame(this.frame);
  };
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
