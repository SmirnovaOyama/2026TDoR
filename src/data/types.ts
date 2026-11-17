export interface TmmCountry {
  name: string;
  region: string;
  thisYear: number;
  allYears: number;
}

export interface TmmData {
  source: string;
  fetchedAt: string;
  period: { label: string; from: string; to: string };
  total: number;
  totalAllYears: number;
  years: { year: number; count: number }[];
  countries: TmmCountry[];
}

/** The world as square cells; `rle` holds [country index, run length, …], index 0 is sea. */
export interface WorldGrid {
  cols: number;
  rows: number;
  step: number;
  lonMin: number;
  latMax: number;
  names: string[];
  rle: number[];
}

export type Mode = 'thisYear' | 'allYears';
