<h1 align="center">DateTick</h1>

<p align="center">Tiny, <b>immutable</b>, fully <b>timezone-aware</b> date toolkit for JavaScript &amp; TypeScript — with the same ergonomic, chainable API you already know.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/datetick"><img src="https://img.shields.io/npm/v/datetick.svg?style=flat-square&colorB=51C838" alt="NPM Version"></a>
  <a href="https://bundlephobia.com/package/datetick"><img src="https://img.shields.io/bundlephobia/minzip/datetick?style=flat-square&color=45cc11" alt="Gzip Size"></a>
</p>

![TypeScript](https://img.shields.io/badge/TS-TypeScript-3178c6?logo=typescript&logoColor=white)
![GitHub contributors](https://img.shields.io/github/contributors/andreasnicolaou/datetick)
![GitHub License](https://img.shields.io/github/license/andreasnicolaou/datetick)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/andreasnicolaou/datetick/build.yaml)
![GitHub package.json version](https://img.shields.io/github/package-json/v/andreasnicolaou/datetick)
[![Known Vulnerabilities](https://snyk.io/test/github/andreasnicolaou/datetick/badge.svg)](https://snyk.io/test/github/andreasnicolaou/datetick)
![Bundle Size](https://deno.bundlejs.com/badge?q=datetick&treeshake=[*])

![ESLint](https://img.shields.io/badge/linter-eslint-4B32C3.svg?logo=eslint)
![Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?logo=prettier)
![Jest](https://img.shields.io/badge/tested_with-jest-99424f.svg?logo=jest)
![Maintenance](https://img.shields.io/maintenance/yes/2026)
[![codecov](https://codecov.io/gh/andreasnicolaou/datetick/graph/badge.svg)](https://codecov.io/gh/andreasnicolaou/datetick)
[![Socket Badge](https://badge.socket.dev/npm/package/datetick)](https://badge.socket.dev/npm/package/datetick)

![NPM Downloads](https://img.shields.io/npm/dm/datetick)

<p align="center"><b><a href="https://andreasnicolaou.github.io/datetick/">🚀 Live demo &amp; interactive playground</a></b></p>

---

> DateTick parses, validates, manipulates, formats and compares dates and times — with **every** calendar operation resolved through a real IANA timezone, so one absolute instant is always interpreted consistently in one zone (DST included). Zero runtime dependencies. Works the same in vanilla JS, Angular, React, Vue and Node.

```ts
import datetick from 'datetick';

datetick('2026-06-25T19:23Z', { timezone: 'Asia/Tokyo' }).formatPattern('DD/MM/YYYY HH:mm'); // '26/06/2026 04:23'

datetick('2026-06-25').startOf('month').add(1, 'day').set('year', 2027).format('long');

datetick.duration(90, 'minute').humanize(); // '2 hours'
datetick('2026-06-25').timeAgoLive().subscribe(console.log); // live "time ago" stream
```

- 🌐 **Fully timezone-aware** — reading components, `add`/`subtract`, `startOf`/`endOf`, weeks and formatting all resolve through the configured IANA timezone
- 💪 **Immutable & chainable** — every method returns a new instance; safe to share across Angular components, React renders and Vue computeds
- 📦 **Zero runtime dependencies** — locales come from the platform's `Intl`, so there are no locale files to import
- 🕒 **Familiar API** — Day.js-style tokens, getters/setters, comparisons and relative time
- ⏳ **Durations & live "time ago"** — ISO 8601 durations, `humanize()`, and a dependency-free live relative-time stream
- 🗓️ **Calendar-grid data** — ready-to-render month grids for building date pickers
- 🔒 **TypeScript-first** — full types shipped, ESM + UMD builds

## Getting Started

### Installation

```bash
npm install datetick
```

### Live demo & documentation

The full API reference — getters/setters, manipulation, comparisons, formatting/parsing tokens, durations, calendar-grid data, app-wide locale defaults, and copy-paste **Angular / React / Vue** integration (including a runtime language switcher) — plus a live in-browser playground, is hosted on GitHub Pages:

**➡️ [andreasnicolaou.github.io/datetick](https://andreasnicolaou.github.io/datetick/)**

You can also open [`docs/index.html`](./docs/index.html) directly in a browser — no build step required.

### API

It's easy to use DateTick to parse, validate, manipulate and display dates and times.

```ts
datetick('2026-08-08'); // parse

datetick().format('YYYY-MM-DD HH:mm:ss'); // display (token pattern)
datetick().format('long'); // display (Intl preset)

datetick().set('month', 3).month(); // get & set

datetick().add(1, 'year').subtract(3, 'day'); // manipulate

datetick().isBefore(datetick()); // query
datetick('2026-06-25').isBetween('2026-06-01', '2026-07-01', '[)');
```

### Timezones

Every operation is resolved through the configured timezone, so the same instant is interpreted consistently — across DST transitions too.

```ts
const t = datetick('2026-06-25T19:23Z', { timezone: 'Asia/Tokyo' });
t.hour(); // 4  (wall-clock hour in Tokyo)
t.utc().hour(); // 19 (same instant, UTC)
t.utcOffset(); // 540
```

### Locale-aware, without locale files

Locales resolve through the platform's `Intl`, so nothing extra needs to be imported.

```ts
datetick('2026-06-25', { locale: 'fr' }).format('long'); // French
datetick('2026-06-25', { locale: 'fr' }).localeData().months()[0]; // 'janvier'
```

### App-wide defaults

Bind locale / timezone / week start once and reuse the scoped factory — no global mutation.

```ts
const paris = datetick.withDefaults({ locale: 'fr', timezone: 'Europe/Paris' });
paris('2026-06-25').format('long'); // French, Paris
datetick('2026-06-25').format('long'); // unaffected
```

## License

DateTick is licensed under the [MIT License](./LICENSE) © Andreas Nicolaou.
