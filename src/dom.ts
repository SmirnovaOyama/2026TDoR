export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

/** Reads a colour or other token from the design system. */
export const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node as T;
}

const numberFormat = new Intl.NumberFormat('en-GB');
export const formatNumber = (n: number) => numberFormat.format(n);

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
