# Say their names

A vigil page for **Transgender Day of Remembrance, 20 November 2026**.

Every year on 20 November, people light candles and read aloud the names of trans people killed in the past twelve months. This page follows that ritual through one idea: a name is where recognition starts. In death, many trans people are recorded under names they had stopped using, so they drop out of the count. In life, being called by your own name protects you.

## What is on the page

- **The count.** One light for each of the 273 trans and gender diverse people reported murdered between 1 October 2025 and 30 September 2026. The lights kindle as you scroll and the number climbs with them.
- **Who they were.** This year's breakdown from TGEU's Trans Murder Monitoring: gender, race, sex work, where people were killed, and how often anyone was arrested.
- **Where it happened.** An interactive pixel map of reported murders by country, for this year or since 2008. Choose a country to see its share of the count, its rank and its total since 2008. Countries with no reports are explained too, since a dark country can also mean nobody was able to report.
- **The ones the count misses.** Why every number is a minimum, with a year-by-year chart from 2008. Fainter lights gather for the people who were never counted.
- **What a name can do.** Research on chosen names, gender-affirming care and family support for trans young people.
- **How it began.** From Rita Hester's murder in 1998 to the first vigil in 1999.
- **Light a candle.** Press and hold to close with a moment of silence.

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

## Data

- `src/data/tmm.json` holds aggregate counts from TGEU's public [Trans Murder Monitoring portal](https://transmurdermonitoring.tgeu.org/), by country and by year. Refresh it with `npm run data`.
- `src/data/grid.json` is the world as 144 × 56 cells of 2.5°, built from [world-atlas](https://github.com/topojson/world-atlas) (Natural Earth). Rebuild it with `npm run grid` after refreshing the data, so every listed country has at least one cell.

## Design

Built on the Oyama Tracker design system's dark tokens, on a true black ground: system type, a terracotta accent used as candlelight, the system's heatmap ramp for the map, and the trans flag stripes from its pixel cat. The page has no gradients and respects reduced motion.

## If you need someone now

- Switchboard LGBT+ helpline, UK: 0800 0119 100
- Trans Lifeline, US: 877 565 8860

## Licence

Code under the MIT licence. Figures belong to their sources, cited on the page.
