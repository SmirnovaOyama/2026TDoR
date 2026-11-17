import tmmJson from './data/tmm.json';
import gridJson from './data/grid.json';
import type { TmmData, WorldGrid } from './data/types';
import { formatDate, formatNumber } from './dom';
import { PixelMap } from './map';
import { setupReveal } from './reveal';
import { setupScroll } from './scroll';
import { setupYears } from './years';
import { buildUnitRows } from './wall';

const data = tmmJson as TmmData;
const grid = gridJson as WorldGrid;

// Numbers in the page come from the same snapshot as the map.
const fills: Record<string, string> = {
  total: formatNumber(data.total),
  countries: String(data.countries.filter((c) => c.thisYear > 0).length),
  'all-years': formatNumber(data.totalAllYears),
  fetched: formatDate(data.fetchedAt),
};
for (const node of document.querySelectorAll<HTMLElement>('[data-fill]')) {
  const key = node.dataset.fill!;
  if (key === 'total-label') node.setAttribute('aria-label', fills.total);
  else if (key in fills) node.textContent = fills[key];
}

buildUnitRows();
setupReveal();
setupScroll(data.total);
new PixelMap(grid, data);
setupYears(data);
