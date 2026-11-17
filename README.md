# Transgender Day of Remembrance 2026

A page for **20 November 2026**. It shows the trans people reported murdered between 1 October 2025 and 30 September 2026, where they were killed, how the count has changed since 2008, and why it undercounts.

## What is on the page

- **The count.** A wall of 273 squares, one for each trans and gender diverse person reported murdered between 1 October 2025 and 30 September 2026. The squares light in reading order as you scroll, and the number climbs with them.
- **Who was killed.** This year's breakdown from TGEU's Trans Murder Monitoring: gender, race, sex work, where people were killed, and how often anyone was arrested.
- **By country.** An interactive pixel map of reported murders by country, for this year or since 2008. Choose a country to see its share of the count, its rank and its total since 2008.
- **Undercounting.** Why every number is a minimum, with a year-by-year chart from 2008. Below the last rows of the count, outlined squares appear for the people who were never counted.
- **Suicide among trans women in China.** Deaths the murder count leaves out, with survey findings, the 2022 hormone sales ban, a link to the One Among Us memorial and China's 12356 support line.
- **Chosen names.** Research on chosen names, gender-affirming care and family support for trans young people.
- **History.** From Rita Hester's murder in 1998 to the first vigil in 1999.
- **Light a candle.** Press and hold to light it.

Every figure is cited at the foot of the page. The data holds counts only: no names or other details of any person.

## Running it

```bash
npm install
npm run dev
```

```bash
npm run build      # typecheck, then build to dist/
npm run preview    # serve the built site
```

The build uses a relative base, so `dist/` works from any folder or a GitHub Pages project path.

## Deploying

The site runs on Cloudflare as a Worker that serves the static files in `dist/` (see `wrangler.jsonc`), live at https://tdor-2026.oyamasmirnona.workers.dev.

```bash
npm run deploy     # build, then upload with wrangler
```

## Data

- `src/data/tmm.json` holds aggregate counts from TGEU's public [Trans Murder Monitoring portal](https://transmurdermonitoring.tgeu.org/), by country and by year. Refresh it with `npm run data`.
- `src/data/grid.json` is the world as 144 × 56 cells of 2.5°, built from [world-atlas](https://github.com/topojson/world-atlas) (Natural Earth). Rebuild it with `npm run grid` after refreshing the data, so every listed country has at least one cell.

## Design

Built on the Oyama Tracker design system's dark tokens, on a true black ground: system type, a terracotta accent used as candlelight, the system's heatmap ramp for the map, and the trans flag stripes from its pixel cat. Every picture on the page is built from one unit, the square. The page has no gradients and respects reduced motion.

## If you need someone now

- Switchboard LGBT+ helpline, UK: 0800 0119 100
- Trans Lifeline, US: 877 565 8860
- Psychological assistance hotline, mainland China: 12356

## Licence

Code under the MIT licence. Figures belong to their sources, cited on the page.
