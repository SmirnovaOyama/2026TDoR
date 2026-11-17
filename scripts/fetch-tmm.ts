// Fetches TGEU's Trans Murder Monitoring figures from its public data portal
// and writes the aggregate counts the page uses to src/data/tmm.json.
// Only counts are kept: no names, cities or other details of any person.
//
//   npm run data

import { writeFile } from 'node:fs/promises';

const API = 'https://transmurdermonitoring.tgeu.org/api/search';
const TYPE = '6229d559af18d40fd7154cb3';
const PERIOD = 'TDoR 2026';

interface Bucket {
  key: string;
  label?: string;
  doc_count?: number;
  filtered?: { doc_count: number };
  values?: Bucket[];
}
interface SearchResult {
  totalRows: number;
  aggregations: { all: Record<string, { buckets: Bucket[] }> };
}

async function search(filters?: Record<string, unknown>): Promise<SearchResult> {
  const params = new URLSearchParams({
    types: JSON.stringify([TYPE]),
    allAggregations: 'true',
    limit: '0',
    includeUnpublished: 'false',
  });
  if (filters) params.set('filters', JSON.stringify(filters));
  const res = await fetch(`${API}?${params}`, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`TMM portal answered ${res.status} ${res.statusText}`);
  return (await res.json()) as SearchResult;
}

const count = (b: Bucket) => b.filtered?.doc_count ?? b.doc_count ?? 0;

/** Country buckets sit under region buckets; a few may sit at the top level. */
function countries(result: SearchResult): Map<string, { region: string; count: number }> {
  const out = new Map<string, { region: string; count: number }>();
  const add = (label: string, region: string, n: number) => {
    const name = label.trim();
    const prev = out.get(name);
    out.set(name, { region: prev?.region ?? region, count: (prev?.count ?? 0) + n });
  };
  for (const b of result.aggregations.all['country_territory_of_the_murder'].buckets) {
    if (b.key === 'any' || b.key === 'missing') continue;
    if (b.values?.length) {
      const region = (b.label ?? '').split(',').pop()!.trim();
      for (const c of b.values) if (count(c)) add(c.label ?? c.key, region, count(c));
    } else if (count(b)) {
      add(b.label ?? b.key, '', count(b));
    }
  }
  return out;
}

const all = await search();
const periods = all.aggregations.all['tdor_period__oct_sept_'].buckets.filter((b) => b.label?.startsWith('TDoR '));
const target = periods.find((b) => b.label === PERIOD);
if (!target) throw new Error(`No period called ${PERIOD} on the portal yet`);
const year = await search({ tdor_period__oct_sept_: { values: [target.key] } });

const thisYear = countries(year);
const allTime = countries(all);
const names = [...new Set([...thisYear.keys(), ...allTime.keys()])];

const data = {
  source: 'TGEU Trans Murder Monitoring, transmurdermonitoring.tgeu.org',
  fetchedAt: new Date().toISOString().slice(0, 10),
  period: { label: PERIOD, from: '2025-10-01', to: '2026-09-30' },
  total: year.totalRows,
  totalAllYears: all.totalRows,
  years: periods
    .map((b) => ({ year: Number(b.label!.slice(5)), count: count(b) }))
    .sort((a, b) => a.year - b.year),
  countries: names
    .map((name) => ({
      name,
      region: thisYear.get(name)?.region || allTime.get(name)?.region || '',
      thisYear: thisYear.get(name)?.count ?? 0,
      allYears: allTime.get(name)?.count ?? 0,
    }))
    .sort((a, b) => b.thisYear - a.thisYear || b.allYears - a.allYears || a.name.localeCompare(b.name)),
};

await writeFile(new URL('../src/data/tmm.json', import.meta.url), JSON.stringify(data, null, 1) + '\n');
const reported = data.countries.filter((c) => c.thisYear > 0).length;
console.log(`${PERIOD}: ${data.total} people in ${reported} countries; ${data.totalAllYears} across all years`);
