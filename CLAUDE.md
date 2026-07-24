# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static, zero-runtime-dependency TypeScript site (Vite) that teaches teams
agentic workflows with Claude, organized as levels L0–L7 plus a toolbox (TB)
and a sources/reference (REF) section. There is no backend; reading progress
("the ledger") is persisted per-device in `localStorage`.

## Commands

`just` wraps npm (each recipe runs `install` first); raw npm works too.

```sh
just dev        # or: npm install && npm run dev   — Vite dev server
just build      # or: npm run build                — tsc typecheck, then vite build → dist/
just preview    # serve the built dist/ locally
just deploy     # build, then npx gh-pages -d dist
```

`npm run build` runs `tsc && vite build`: **the TypeScript compile is the
gate**. `tsconfig.json` sets `strict`, `noUnusedLocals`, and
`noUnusedParameters` with `noEmit` (Vite does the actual bundling), so an
unused import or variable fails the build. There is no separate lint step and
no test suite — the typecheck is the only automated check.

## Architecture

Everything renders from typed data. The three moving parts:

- **`src/content.ts`** — defines the `Section` and `DocLink` interfaces, the
  `meta` object (title/subtitle/updated/disclaimer), and `sections` L0–L3.
- **`src/content2.ts`** — `sections2`: the toolbox, L4–L7, and sources. Imports
  the `Section` type from `content.ts`.
- **`src/main.ts`** — concatenates `[...part1, ...sections2]` into one array,
  then renders the whole page by string-templating `innerHTML`. It owns ledger
  state, the progress gauge, and an `IntersectionObserver` scrollspy that
  highlights the current section in the nav rail.

A `Section` is `{ id, ordinal, title, tagline, body, docs }`. `body` is
**trusted HTML authored in this repo** and injected via `innerHTML` — keep it
that way; do not feed user or fetched input through it. `docs` renders as an
"Official docs & sources" aside.

**To add or edit a section**, add/modify a `Section` object in `content.ts`
(L0–L3) or `content2.ts` (everything else). The nav rail, progress gauge, and
scrollspy all derive from the sections array automatically — no wiring needed.
`ordinal` is the label shown ("L0"…"L7", "TB", "REF"); `id` is the anchor and
the ledger key.

The ledger persists to `localStorage` under `agentic-guide-ledger-v1`
(`STORE_KEY` in `main.ts`). Changing that key resets everyone's saved progress.

`src/styles.css` is the design system (imported from `main.ts`).
`vite.config.ts` sets `base: "./"` so `dist/` is relocatable and works from a
GitHub Pages project path without further config.

## PWA (offline + installable)

The site is a Progressive Web App, hand-rolled to keep the zero-dependency
ethos — no `vite-plugin-pwa`, no Workbox:

- **`public/manifest.webmanifest`** — name, theme/background `#14181d`, and
  icons (192/512 PNG + a maskable 512 + the SVG). All paths are relative, so
  it works from any Pages sub-path. Linked from `index.html`.
- **`public/sw.js`** — the service worker, registered from `main.ts` as
  `./sw.js` (relative to the document, so its scope matches the deploy path).
  On `install` it precaches the shell *and* fetches the built `index.html` to
  discover the content-hashed `assets/*.js|css` names and precache those too —
  that's what makes offline work on the **first** visit. `fetch` is
  network-first for navigations (falling back to the cached shell offline) and
  cache-first for assets. Cache matches use `{ ignoreVary: true }` because dev
  and Pages send `Vary: Origin` on assets, which otherwise breaks matching for
  `crossorigin` module scripts. Bump `CACHE_VERSION` in `sw.js` on any shell
  change to retire the old cache.
- Icons are raster PNGs generated from `public/icon.svg`. There's no image
  tooling committed — regenerate with a transient `npm i --no-save sharp` (see
  git history) if the source SVG changes, and don't commit the dependency.

Files under `public/` (manifest, sw.js, icons) are copied to `dist/` verbatim
and unhashed — Vite does not rewrite references to them, so keep those links
relative.

## Deploy

Two paths, both build first:

- **GitHub Actions** (`.github/workflows/deploy.yml`) — builds on push to
  `main` and publishes `dist/` via the Pages OIDC flow. Requires repo
  **Settings → Pages → Source: "GitHub Actions"** to be selected once.
- **`just deploy`** — pushes `dist/` to a `gh-pages` branch via `npx gh-pages`.

## Content maintenance

This subject moves monthly. Version-specific claims (agent teams, nested
subagents, CLI flags) should be re-verified against
https://code.claude.com/docs before relying on them — this caveat is surfaced
to readers via `meta.disclaimer` and should stay accurate.
