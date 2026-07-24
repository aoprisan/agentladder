# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static, zero-runtime-dependency TypeScript site (Vite) that teaches teams
agentic workflows with Claude, organized as levels L0–L7 plus a toolbox (TB)
and a sources/reference (REF) section. There is no backend; reading progress
("the ledger") and recall-drill scheduling are persisted per-device in
`localStorage`, and progress can travel between people via share-links
encoded in the URL hash.

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

Everything renders from typed data. The moving parts:

- **`src/content.ts`** — defines the `Section` and `DocLink` interfaces, the
  `meta` object (title/subtitle/updated/disclaimer), and `sections` L0–L3.
- **`src/content2.ts`** — `sections2`: the toolbox, L4–L7, and sources. Imports
  the `Section` type from `content.ts`.
- **`src/main.ts`** — concatenates `[...part1, ...sections2]` into one array,
  then renders the whole page by string-templating `innerHTML`. It owns ledger
  state, the progress gauge, an `IntersectionObserver` scrollspy that
  highlights the current section in the nav rail, and wires up the drill,
  palette, and share modules below.
- **`src/quiz.ts`** — the recall-drill question bank: `QuizQuestion` objects
  (multiple choice + explanation) keyed to a `sectionId`. Questions are
  authored against the section bodies — **when a section's claims change,
  re-check its questions here**. Question `id`s are the localStorage keys for
  scheduling state, so renaming one resets that card's schedule.
- **`src/drill.ts`** — spaced repetition: a Leitner-box scheduler (boxes 0–5,
  intervals 0/1/3/7/16/35 days; a miss drops the card to box 0 and re-queues
  it in a minute) persisted under `agentic-guide-srs-v1`, plus the drill
  modal overlay. Keyboard: 1–4 answer, Enter next, Esc close.
- **`src/palette.ts`** — the ⌘K / Ctrl+K / `/` command palette. At startup it
  parses every section body in a detached `<template>` into heading-scoped
  blocks (paragraph / list-item / table-row granularity) and runs a token-AND
  scorer over them (title > heading > body weight). Also hosts quick actions
  (start drill, open lab, open flight record, copy share link) passed in from
  `main.ts`.
- **`src/labsim.ts`** — the pattern-lab simulation engine, pure logic with no
  DOM. Missions (typed attribute vectors: decomposability, open-endedness,
  verifiability, context load…) × architecture patterns × context strategy ×
  compaction × tool surface → a deterministic event stream with window/cost/
  latency/quality tracking, graded findings, and a fit-for-purpose
  recommendation. **The numbers encode the guide's claims** (context rot,
  ~15× multi-agent token cost, tool-sprawl fumbles) — if a section's claims
  change, re-check the corresponding model terms and finding texts here.
- **`src/lab.ts`** — the pattern-lab UI over `labsim.ts`: configure → animated
  run (event log + live meters) → debrief. Debrief findings link back into
  sections via a `jumpTo` callback from `main.ts`. `openWith(mission, cfg)`
  flies a mission that isn't in `MISSIONS` — the architect hands its
  synthesized "your task" mission in here, and it appears as an extra chip
  on the config screen while active.
- **`src/architect.ts`** — the architect's decision engine, pure logic with
  no DOM. Eight trait questions (`TRAITS`) about a real task → a synthetic
  `Mission` → all seven patterns scored via `patternFit` and stress-tested
  via `simulate(cfg, false, missionOverride)` → a stance
  (call/workflow/agent/multi), ranked scoreboard, context plan, guardrail
  kit, and a Markdown decision brief (`buildBrief`) with a starter
  CLAUDE.md. Answers travel by URL as `#arch=1.<8 digits 0–2>` (digit order
  = `TRAITS` order — bump the version if that changes). The advice strings
  encode the guide's claims: re-check them when sections change.
- **`src/architectui.ts`** — the architect's overlay: interview (one
  question per screen) → verdict → brief (copy/download). Last answers
  persist under `agentic-guide-architect-v1`; a `#arch=` hash opens straight
  onto the recomputed verdict.
- **`src/checkride.ts`** — the certification exam: 12 questions sampled for
  section coverage from `quiz.ts`, one pass, no feedback until the end, pass
  mark 80%. Deliberately does NOT touch SRS scheduling (it logs activity
  only). Passing builds a shareable wings link
  `#wings=1.<pct>.<yyyymmdd>.<uri-name>.<salted djb2>` — tamper-evidence,
  not cryptography; the name is the only URL-sourced string rendered into
  HTML and `main.ts` escapes it. Best local result persists under
  `agentic-guide-wings-v1`.
- **`src/activity.ts`** — tiny per-device study-event journal (sections read,
  drill hits/misses) under `agentic-guide-log-v1`; shared by `drill.ts` and
  `stats.ts` so they don't import each other.
- **`src/stats.ts`** — the "flight record" dashboard: streaks, a 12-week
  activity heatmap, per-section recall mastery (average Leitner box), and a
  14-day review-due forecast. Read-only over the activity log, the SRS store
  (via `readSrsSnapshot()` from `drill.ts`), and the ledger.
- **`src/share.ts`** — team share-links: the ledger's done-bits packed into a
  hex payload in the URL hash (`#share=1.<hex>`, bit order = sections-array
  order, so **don't reorder sections** without bumping the payload version).
  `main.ts` shows a merge/replace/ignore banner when a share hash is present.

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
(`STORE_KEY` in `main.ts`); drill scheduling under `agentic-guide-srs-v1`
(`SRS_KEY` in `drill.ts`); the study-activity journal under
`agentic-guide-log-v1` (`LOG_KEY` in `activity.ts`); the architect's last
interview under `agentic-guide-architect-v1` (`ARCH_KEY` in
`architectui.ts`); the best checkride result under `agentic-guide-wings-v1`
(`WINGS_KEY` in `checkride.ts`). Changing any key resets everyone's saved
state for that feature — they are deliberately independent stores.

Three URL-hash payloads coexist and are mutually exclusive: `#share=1.…`
(ledger bits, `share.ts`), `#arch=1.…` (architect answers, `architect.ts`),
`#wings=1.…` (checkride certificate, `checkride.ts`). All are read once at
module init in `main.ts`; section bodies are trusted HTML but hash-sourced
strings (the wings name) are not — escape anything from a hash before it
touches `innerHTML`.

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

When editing a section's claims, also update its questions in `src/quiz.ts`
(they quiz the exact numbers and phrasings the sections teach). The palette's
search index derives from the bodies automatically and needs no maintenance.
