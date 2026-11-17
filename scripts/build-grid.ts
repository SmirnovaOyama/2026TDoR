// Rasterises the world into a grid of square cells, one country per cell, and
// writes it to src/data/grid.json for the pixel map. Each cell takes the country
// that covers most of it, sampled at 3 × 3 points.
//
// China is drawn to the public map standard (自然资规〔2023〕2号): its border follows
// the standard map, so 藏南 is China (阿克赛钦 already is in the atlas); Kashmir is
// left uncoloured; the South China Sea islands and 钓鱼岛 and 赤尾屿 are marked; and the
// ten-dash line is stored for the map to draw.
//
//   npm run grid

import { readFile, writeFile } from 'node:fs/promises';
import { geoBounds, geoCentroid, geoContains } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { Topology, GeometryCollection } from 'topojson-specification';

const STEP = 1.25; // degrees per cell
const SAMPLES = 3; // per side of a cell
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
  // Naming for these follows the author's choice.
  'Taiwan': 'Taiwan (China)',
  'Hong Kong': 'Hong Kong SAR',
  'Macao': 'Macau SAR',
};

// Too small for a square of their own, but they should still be on the map to choose.
const ALWAYS_SHOWN = ['Hong Kong SAR', 'Macau SAR'];

// The atlas draws Crimea inside Russia; this page shows it as part of Ukraine.
// A rough outline of the peninsula, in [lon, lat], from the Perekop isthmus round to Kerch.
const CRIMEA: [number, number][] = [
  [32.45, 45.35], [33.0, 45.9], [33.65, 46.2], [34.6, 46.15], [35.1, 45.65], [35.5, 45.45],
  [36.65, 45.5], [36.6, 45.05], [35.5, 44.95], [34.5, 44.4], [33.4, 44.35], [32.45, 45.35],
];
function inRing(ring: [number, number][], lon: number, lat: number) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// 藏南, south of the McMahon Line, which the standard map shows as part of China and
// the atlas gives to India. An approximate outline, west to east along the foothills.
const ZANGNAN: [number, number][] = [
  [91.65, 27.85], [91.95, 27.45], [92.05, 26.95], [92.65, 27.0], [93.3, 26.95], [93.85, 27.2],
  [94.4, 27.4], [94.9, 27.65], [95.4, 27.85], [95.65, 27.55], [95.6, 27.1], [95.35, 26.75],
  [95.95, 26.65], [96.6, 27.25], [97.1, 27.6], [97.35, 28.2], [96.95, 28.4], [96.55, 29.1],
  [96.1, 29.45], [95.4, 29.3], [94.7, 29.25], [94.0, 28.85], [93.3, 28.4], [92.6, 27.95],
  [92.0, 27.9], [91.65, 27.85],
];

// Kashmir, disputed between India and Pakistan. The standard leaves it uncoloured on maps
// coloured by country. Only land the atlas gives to India or Pakistan is taken, so the
// parts China administers stay China.
const KASHMIR: [number, number][] = [
  [73.65, 32.95], [74.6, 32.6], [75.3, 32.3], [76.35, 33.0], [77.0, 32.8], [77.7, 32.55],
  [78.4, 32.45], [79.2, 32.45], [80.3, 33.2], [80.3, 35.6], [77.8, 35.6], [75.9, 36.6],
  [75.4, 36.95], [74.6, 37.1], [73.7, 36.9], [72.55, 36.1], [73.2, 35.2], [73.3, 34.5],
  [73.45, 33.6], [73.65, 32.95],
];

// Islands too small for the atlas, marked as small squares: the South China Sea islands
// the standard lists (东沙、西沙、中沙、南沙群岛, 曾母暗沙, 黄岩岛) and 钓鱼岛 and 赤尾屿.
const ISLANDS: [string, number, number][] = [
  ['东沙群岛', 116.72, 20.7],
  ['西沙群岛', 112.0, 16.5],
  ['中沙群岛', 114.5, 15.9],
  ['黄岩岛', 117.76, 15.13],
  ['南沙群岛 太平岛', 114.36, 10.38],
  ['南沙群岛 永暑礁', 112.89, 9.55],
  ['南沙群岛 美济礁', 115.53, 9.9],
  ['南沙群岛 南威岛', 111.92, 8.64],
  ['南沙群岛 弹丸礁', 113.84, 7.37],
  ['曾母暗沙', 112.35, 3.97],
  ['钓鱼岛', 123.47, 25.74],
  ['赤尾屿', 124.56, 25.92],
];

// The ten-dash line, as [lon, lat] points per dash. China has not published coordinates;
// these follow a public tracing of the standard map (github.com/gattiscm/PRC_Files) and are
// approximate, which is well within one cell.
const DASHES: [number, number][][] = [
  [[109.17, 16.1], [109.55, 15.53], [109.73, 15.05]],
  [[110.18, 12.14], [110.12, 11.52], [109.84, 11.02]],
  [[108.1, 7.04], [108.06, 6.45], [108.15, 6.05]],
  [[111.68, 3.51], [112.33, 3.64], [112.76, 3.85]],
  [[115.44, 7.14], [116.16, 7.96]],
  [[118.44, 10.75], [118.73, 11.32], [118.87, 11.87]],
  [[119.0, 14.86], [118.95, 15.83]],
  [[119.39, 17.9], [119.95, 18.95]],
  [[121.1, 20.79], [121.87, 21.71]],
  [[122.57, 24.02], [122.82, 25.06]],
];

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

/** The country at a point, with this page's corrections to the atlas. */
function countryAt(lon: number, lat: number) {
  const hit = shapes.find((s) => inBounds(s.bounds, lon, lat) && geoContains(s.f as Feature, [lon, lat]));
  if (!hit) return null;
  const name = hit.name;
  if (name === 'Russia' && inRing(CRIMEA, lon, lat)) return 'Ukraine';
  if (name === 'India' && inRing(ZANGNAN, lon, lat)) return 'China';
  if (name === 'Siachen Glacier') return 'Kashmir';
  if ((name === 'India' || name === 'Pakistan') && inRing(KASHMIR, lon, lat)) return 'Kashmir';
  return name;
}

// A cell is land when at least a third of its samples are; it takes the country with the most.
const cells = new Array<number>(COLS * ROWS).fill(0);
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    const tally = new Map<string, number>();
    let land = 0;
    for (let i = 0; i < SAMPLES; i++) {
      for (let j = 0; j < SAMPLES; j++) {
        const lon = LON_MIN + (c + (j + 0.5) / SAMPLES) * STEP;
        const lat = LAT_MAX - (r + (i + 0.5) / SAMPLES) * STEP;
        const name = countryAt(lon, lat);
        if (!name) continue;
        land++;
        tally.set(name, (tally.get(name) ?? 0) + 1);
      }
    }
    if (land * 3 < SAMPLES * SAMPLES) continue;
    const [top] = [...tally].sort((a, b) => b[1] - a[1]);
    cells[r * COLS + c] = id(top[0]);
  }
}

const cellOf = (lon: number, lat: number) => {
  const c = Math.floor((lon - LON_MIN) / STEP);
  const r = Math.floor((LAT_MAX - lat) / STEP);
  return { c, r, i: r * COLS + c };
};

// Island squares go in empty sea cells; one already taken by China is simply marked.
const islands = new Set<number>();
for (const [label, lon, lat] of ISLANDS) {
  const { i } = cellOf(lon, lat);
  if (cells[i] && names[cells[i]] !== 'China') throw new Error(`${label} falls in ${names[cells[i]]}`);
  if (!cells[i]) { cells[i] = id('China'); islands.add(i); }
}

// Every country TGEU lists, and the places above, must own at least one cell,
// however small they are: the cell their centre falls in, or the nearest one
// another small place has not already taken.
const tmm = JSON.parse(await readFile(new URL('../src/data/tmm.json', import.meta.url), 'utf8')) as {
  countries: { name: string }[];
};
const pinned = new Set<number>(islands);
const missing: string[] = [];
for (const name of [...tmm.countries.map((c) => c.name), ...ALWAYS_SHOWN]) {
  if (indexOf.has(name)) continue;
  const shape = shapes.find((s) => s.name === name);
  if (!shape) { missing.push(name); continue; }
  const [lon, lat] = geoCentroid(shape.f as Feature);
  const { c: c0, r: r0 } = cellOf(lon, lat);
  let best = -1;
  let bestD = Infinity;
  for (let dr = -3; dr <= 3; dr++) {
    for (let dc = -3; dc <= 3; dc++) {
      const r = r0 + dr;
      const c = c0 + dc;
      if (r < 0 || c < 0 || r >= ROWS || c >= COLS || pinned.has(r * COLS + c)) continue;
      const d = dr * dr * 1.5 + dc * dc; // prefer neighbours along the same row
      if (d < bestD) { bestD = d; best = r * COLS + c; }
    }
  }
  cells[best] = id(name);
  pinned.add(best);
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
  JSON.stringify({
    cols: COLS, rows: ROWS, step: STEP, lonMin: LON_MIN, latMax: LAT_MAX, names, rle,
    islands: [...islands].sort((a, b) => a - b), dashes: DASHES,
  }) + '\n',
);
console.log(`${COLS}×${ROWS} cells, ${names.length - 1} countries, ${rle.length / 2} runs, ${islands.size} island squares`);
