// Rasterises the world into a coarse grid of square cells, one country per cell,
// and writes it to src/data/grid.json for the pixel map.
//
//   npm run grid

import { readFile, writeFile } from 'node:fs/promises';
import { geoBounds, geoCentroid, geoContains } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { Topology, GeometryCollection } from 'topojson-specification';

const STEP = 2.5; // degrees per cell
const LON_MIN = -180;
const LAT_MAX = 83.5;
const COLS = Math.round(360 / STEP);
const ROWS = Math.ceil((LAT_MAX + 56) / STEP); // stop above Antarctica

// The atlas abbreviates; the page uses the names TGEU uses, spelled out.
const RENAME: Record<string, string> = {
  'United States of America': 'United States',
  'Dominican Rep.': 'Dominican Republic',
  'Central African Rep.': 'Central African Republic',
  'Dem. Rep. Congo': 'DR Congo',
  'Bosnia and Herz.': 'Bosnia and Herzegovina',
  'S. Sudan': 'South Sudan',
  'Solomon Is.': 'Solomon Islands',
  'W. Sahara': 'Western Sahara',
  'Eq. Guinea': 'Equatorial Guinea',
  'N. Cyprus': 'Northern Cyprus',
  'Fr. Polynesia': 'French Polynesia',
  'Falkland Is.': 'Falkland Islands',
  'Fr. S. Antarctic Lands': 'French Southern Lands',
  'Faeroe Is.': 'Faroe Islands',
  'Marshall Is.': 'Marshall Islands',
  'Cayman Is.': 'Cayman Islands',
  'Turks and Caicos Is.': 'Turks and Caicos Islands',
  'British Virgin Is.': 'British Virgin Islands',
  'U.S. Virgin Is.': 'US Virgin Islands',
  'N. Mariana Is.': 'Northern Mariana Islands',
  'Cook Is.': 'Cook Islands',
  'St. Vin. and Gren.': 'Saint Vincent and the Grenadines',
  'St. Kitts and Nevis': 'Saint Kitts and Nevis',
  'Antigua and Barb.': 'Antigua and Barbuda',
  'São Tomé and Principe': 'São Tomé and Príncipe',
  'eSwatini': 'Eswatini',
  'Macedonia': 'North Macedonia',
};

const topo = JSON.parse(
  await readFile(new URL('../node_modules/world-atlas/countries-50m.json', import.meta.url), 'utf8'),
) as Topology<{ countries: GeometryCollection<{ name: string }> }>;
const fc = feature(topo, topo.objects.countries) as FeatureCollection<Geometry, { name: string }>;
const shapes = fc.features
  .filter((f) => f.properties.name !== 'Antarctica')
  .map((f) => ({ f, name: RENAME[f.properties.name] ?? f.properties.name, bounds: geoBounds(f) }));

const names: string[] = [''];
const indexOf = new Map<string, number>();
const id = (name: string) => {
  let i = indexOf.get(name);
  if (i === undefined) { i = names.length; names.push(name); indexOf.set(name, i); }
  return i;
};

const inBounds = ([[x0, y0], [x1, y1]]: [[number, number], [number, number]], lon: number, lat: number) =>
  lat >= y0 && lat <= y1 && (x0 <= x1 ? lon >= x0 && lon <= x1 : lon >= x0 || lon <= x1);

const cells = new Array<number>(COLS * ROWS).fill(0);
for (let r = 0; r < ROWS; r++) {
  const lat = LAT_MAX - (r + 0.5) * STEP;
  for (let c = 0; c < COLS; c++) {
    const lon = LON_MIN + (c + 0.5) * STEP;
    const hit = shapes.find((s) => inBounds(s.bounds, lon, lat) && geoContains(s.f as Feature, [lon, lat]));
    if (hit) cells[r * COLS + c] = id(hit.name);
  }
}

// Every country TGEU lists must own at least one cell, however small it is.
const tmm = JSON.parse(await readFile(new URL('../src/data/tmm.json', import.meta.url), 'utf8')) as {
  countries: { name: string }[];
};
const missing: string[] = [];
for (const { name } of tmm.countries) {
  if (indexOf.has(name)) continue;
  const shape = shapes.find((s) => s.name === name);
  if (!shape) { missing.push(name); continue; }
  const [lon, lat] = geoCentroid(shape.f as Feature);
  const c = Math.min(COLS - 1, Math.max(0, Math.floor((lon - LON_MIN) / STEP)));
  const r = Math.min(ROWS - 1, Math.max(0, Math.floor((LAT_MAX - lat) / STEP)));
  cells[r * COLS + c] = id(name);
}
if (missing.length) console.warn('Not on the map:', missing.join(', '));

// Run-length encode: [value, run, value, run, …]
const rle: number[] = [];
for (let i = 0; i < cells.length; ) {
  let j = i;
  while (j < cells.length && cells[j] === cells[i]) j++;
  rle.push(cells[i], j - i);
  i = j;
}

await writeFile(
  new URL('../src/data/grid.json', import.meta.url),
  JSON.stringify({ cols: COLS, rows: ROWS, step: STEP, lonMin: LON_MIN, latMax: LAT_MAX, names, rle }) + '\n',
);
console.log(`${COLS}×${ROWS} cells, ${names.length - 1} countries, ${rle.length / 2} runs`);
