# Transgender Day of Remembrance 2026

A page for **20 November 2026**. It shows the trans people reported murdered between 1 October 2025 and 30 September 2026, where they were killed, how the count has changed since 2008, and why it undercounts.

## What is on the page

- **The count.** A pixel candle of 273 squares, one for each trans and gender diverse person reported murdered between 1 October 2025 and 30 September 2026. The squares light from the base up as you scroll, the number climbs with them, and the flame catches with the last person counted.
- **Who was killed.** This year's breakdown from TGEU's Trans Murder Monitoring: gender, race, sex work, where people were killed, and how often anyone was arrested.
- **By country.** An interactive pixel map of reported murders by country, for this year or since 2008. Choose a country to see its share of the count, its rank and its total since 2008. On a phone the map runs edge to edge and pans sideways. China is drawn to China's public map standard (自然资规〔2023〕2号): 藏南 and 阿克赛钦 as China, Taiwan, Hong Kong SAR and Macau SAR in the same colour as the mainland, the South China Sea islands, 钓鱼岛 and 赤尾屿 marked, the ten-dash line drawn, and Kashmir left uncoloured.
- **Undercounting.** Why every number is a minimum, with a year-by-year chart from 2008. Below the last rows of the count, outlined squares appear for the people who were never counted.
- **Suicide among trans women in China.** Deaths the murder count leaves out, with survey findings, the 2022 hormone sales ban, a link to the One Among Us memorial and China's 12356 support line.
- **Chosen names.** Research on chosen names among trans young people.
- **Support and care.** Studies on gender-affirming care and family support.
- **History.** From Rita Hester's murder in 1998 to the first vigil in 1999.
- **Vigils.** Where to find a vigil, where TGEU lists the people in its count, and helplines you can tap to call.

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

Only the page itself runs through `worker/index.ts`. It makes the Open Graph and Twitter card addresses absolute for whichever domain was asked, so link previews work on every domain the site is served on without naming any of them here.

## Link previews

The preview image is `public/og.png`, 1200 × 630, drawn from `scripts/og.html`. After the count changes, update the number in that file and run `npm run og` (it uses Chrome on macOS).

## Data

- `src/data/tmm.json` holds aggregate counts from TGEU's public [Trans Murder Monitoring portal](https://transmurdermonitoring.tgeu.org/), by country and by year. Refresh it with `npm run data`.
- `src/data/grid.json` is the world as 288 × 112 cells of 1.25°, each taking the country that covers most of it, built from [world-atlas](https://github.com/topojson/world-atlas) (Natural Earth) with the corrections above. The dash positions follow a public tracing, since China has not published coordinates. Rebuild it with `npm run grid` after refreshing the data, so every listed country has at least one cell.

## Design

Built on the Oyama Tracker design system's dark tokens, on a true black ground: system type, the trans flag colours from its pixel cat for the accent and the map's colour scale, and a pixel candle in flame and wax for the count. Every picture on the page is built from one unit, the square. The page has no gradients and respects reduced motion.

## If you need someone now

- Switchboard LGBT+ helpline, UK: 0800 0119 100
- Trans Lifeline, US: 877 565 8860
- Psychological assistance hotline, mainland China: 12356

## Licence

Code under the MIT licence. Figures belong to their sources, cited on the page.
