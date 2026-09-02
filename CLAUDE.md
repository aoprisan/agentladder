# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static, zero-runtime-dependency TypeScript site (Vite) that teaches teams
agentic workflows with Claude, organized as levels L0–L12 plus a prompt-writing
section (PW), a toolbox (TB), a glossary (GL) and a sources/reference (REF) section. There is no backend; reading progress
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
- **`src/content2.ts`** — `sections2`: prompt writing (PW), the toolbox, L4–L12,
  the glossary (GL), and sources. Imports the `Section` type from `content.ts`.
  The glossary is a `<dl class="glossary">`; the palette indexes one entry
  per term. REF ends with a dated changelog — add a line when a rung lands.
- **`src/main.ts`** — concatenates `[...part1, ...sections2]` into one array,
  then renders the whole page by string-templating `innerHTML`. It owns ledger
  state, the progress gauge, an `IntersectionObserver` scrollspy that
  highlights the current section in the nav rail, and wires up the drill,
  palette, and share modules below. After render it also stamps an id on
  every body `h3` and inserts the "on this rung" outline for sections with
  five or more headings (`hydrateHeadings`, ids from `anchors.ts`), renders
  reading time per section (and the intro's total), the previous/next rung
  footer under each section, the `continue` control in the gauge bar (first
  rung not marked done), and the `[` / `]` keyboard navigation (suppressed
  while typing or while any `.overlay` is open).
- **`src/anchors.ts`** — `headingId(sectionId, text, seen)` → the element id
  a heading gets (`<section>--<slug>`), and `readingMinutes(html)`. Shared
  by `main.ts` (stamps the live h3s) and `palette.ts` (indexes the same body
  strings) so a search hit lands on the heading it was found under; if they
  computed ids separately, they would drift.
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
  blocks (paragraph / list-item / table-row / glossary-term granularity) and
  runs a token-AND scorer over them (title > heading > body weight); each
  entry carries the id of the h3 it sits under (from `anchors.ts`) so a hit
  scrolls to the heading, not just the section. Also hosts quick actions
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
  Every `SimEvent` also carries a `node` — the id of the place in the
  pattern's topology where it happened, which is what lets the lab light the
  diagram up as a run plays (see `agentgraph.ts`).
- **`src/agentgraph.ts`** — the agent topology diagrams: pure data (nodes,
  edges, hand-laid coordinates) plus a string renderer, no DOM. `renderGraph`
  emits inline SVG styled entirely from `styles.css`; `renderFigure` wraps it
  with its caption; `mermaidFor` emits the same graph as a Mermaid flowchart
  (the architect's brief carries one into the RFC). Sixteen graphs: the seven
  L1 patterns — **their ids are the `PatternId`s**, so `graphFor(pattern)`
  works — plus `augmented`, `loop`, `loopeng`, `funnel`, `layers`,
  `research`, `teams`, `trust` and `defense`. Node ids are the
  run positions `labsim.ts` emits; if you rename one, rename it there too or
  the lab's live highlight silently stops moving. Section bodies mark a
  diagram with an empty `<div data-graph="…">` and `main.ts` hydrates it after
  render, which keeps the SVG out of the palette's search index.
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
- **`src/checkride.ts`** — the certification exam: 20 questions sampled for
  section coverage from `quiz.ts`, one pass, no feedback until the end, pass
  mark 80%. Deliberately does NOT touch SRS scheduling (it logs activity
  only). Passing builds a shareable wings link
  `#wings=1.<pct>.<yyyymmdd>.<uri-name>.<salted djb2>` — tamper-evidence,
  not cryptography; the name is the only URL-sourced string rendered into
  HTML and `main.ts` escapes it. Best local result persists under
  `agentic-guide-wings-v1`.
- **`src/blackbox.ts`** — the black box: **trajectory review**, the one
  exercise here that hands the reader an answer with nothing highlighted.
  Pure data + scoring, no DOM. Four recorded agent runs (`INCIDENTS`) that
  went wrong, each a list of `Turn`s; the faulty turns carry a `FaultId` from
  a ten-entry taxonomy (`FAULTS`) and expert commentary. The reader flags
  turns and names the fault; `scoreCalls` is set comparison with partial
  credit — exact 2 pts, right turn/wrong fault 1 pt, false alarm −1, which is
  what stops "flag everything" from scoring. **Every `Fault.ref` is a section
  id**, so the debrief links back into the guide; when a section's claims
  change, re-check the fault blurbs and the per-turn `why` texts. Best result
  per incident persists under `agentic-guide-blackbox-v1`.
- **`src/blackboxui.ts`** — the black box overlay: roster → transcript (flag
  turns, spine strip for navigation) → debrief. Turn text is escaped, not
  trusted HTML, unlike section bodies.
- **`src/rubric.ts`** — the bench's review engine: a static rule set over a
  real artifact the reader pastes in (`ArtifactKind` = CLAUDE.md / agent
  prompt / tool description). Pure logic — regex and counting, no network.
  Each `Rule` emits line-anchored `Finding`s carrying a severity, a detail, a
  concrete fix, and a `ref` to the section that justifies it; a linter that
  can't cite its reason is just an opinion with a line number. Also exports
  `buildReviewMarkdown` (exportable review) and `SAMPLES` (a deliberately bad
  artifact of each kind, so the bench does something on first open). **The
  rules encode the guide's claims** — re-check the rules pointed at a section
  when that section changes. Note `contextBudget` lives outside `RULES`
  because it needs the artifact kind, which `Rule.run` doesn't receive.
- **`src/bench.ts`** — the bench UI: editor → findings, with line links that
  select the offending line back in the textarea. **The pasted text is never
  persisted, never put in the URL, and never leaves the tab** — people paste
  real project files, and one of the rules exists to catch the credentials
  that occasionally come with them. Only a scoreboard (kind, score, tokens,
  timestamp — no content) persists, under `agentic-guide-bench-v1`.
- **`src/activity.ts`** — tiny per-device study-event journal (sections read,
  drill hits/misses, black-box calls, bench runs) under
  `agentic-guide-log-v1`; shared by `drill.ts`, `blackboxui.ts`, `bench.ts`
  and `stats.ts` so they don't import each other. Drill `hit`/`miss` and
  black-box `found`/`overlooked` are separate kinds on purpose: the flight
  record reports drill accuracy as recall from memory, and folding
  trajectory-review calls into it would silently change what that number
  means. Range results (`held`/`breached`) are a third pair for the same
  reason.
- **`src/stats.ts`** — the "flight record" dashboard: streaks, a 12-week
  activity heatmap, per-section recall mastery (average Leitner box), a
  trajectory-review panel (per-incident best scores from `readBlackBox()`),
  and a 14-day review-due forecast. Read-only over the activity log, the SRS
  store (via `readSrsSnapshot()` from `drill.ts`), the black-box store, and
  the ledger.
- **`src/tokens.ts`** — the token estimator: pure logic, no DOM, no tokenizer
  table. Classifies characters (letters / digits / CJK / punctuation /
  layout) and weights each class, which is enough to show the *shape* of a
  prompt's cost without breaking the zero-dependency, works-offline contract.
  It is a heuristic (±10–20%) and every surface that renders it says so and
  points at `count_tokens`. Also exports `FORMAT_SAMPLES` — one instruction
  written four ways (plain / Markdown / XML / JSON), which is what makes the
  format argument in PW a measurement rather than an assertion. `rubric.ts`
  and `bench.ts` share `estimateTokens` so the bench and the meter never
  disagree about the same file; the bench's `contextBudget` thresholds are
  calibrated against it.
- **`src/tokenmeter.ts`** — the inline widget in PW, mounted by `main.ts` into
  a `<div data-widget="token-meter">`. Same privacy contract as the bench:
  what you paste is never persisted, never put in the URL, never leaves the
  tab — and unlike the bench it keeps no scoreboard either.
- **`src/range.ts`** — the range: **the adversarial exercise**, and the only
  one here that models an opponent. Pure logic and data, no DOM. Four
  `Deployment`s (where the agent runs, who can write into its context, and the
  *friction budget* the setting can bear) × thirteen `Control`s priced in
  friction points × ten `Threat`s. A threat is not a single chain: it carries
  two `Route`s to the same outcome, each an ordered list of stages, and a
  stage is cut when the posture holds any control in its `blockedBy` list.
  **Containment requires cutting every route** — the second route is
  deliberately the one the obvious control misses, which is what stops the
  exercise from being a checklist. `detectedBy` controls never block; they
  score at half credit (`DETECTED_WEIGHT`). `costOf` applies a deployment's
  `frictionMod`, so the same control is priced differently by setting (an
  approval queue is affordable on a nightly batch and a staffing decision on a
  support desk) — anything reading a control's price must go through it rather
  than reading `Control.friction` directly. `runRange` also returns the
  marginal analysis (`advice`: residual risk removed per friction point) and
  `idle` (friction that bought nothing here). `calibrate` scores the reader's
  pre-reveal prediction separately from the posture, with blind spots
  (believed covered, actually open) called out as the dangerous direction.
  **The routes, prices and budgets are balanced numbers**: `src/range.ts` is
  tuned so a grade-A posture is reachable but rare (roughly 1–4% of in-budget
  postures, and not at all on the laptop). Changing a `blockedBy` list, a
  `friction`, a `frictionMod` or a `budget` moves that — brute-force the
  subsets and re-check before committing, or the exercise quietly becomes
  either trivial or hopeless.
- **`src/rangeui.ts`** — the range's overlay: board → harden (spend the
  budget) → call it (predict, per threat, whether your own posture holds) →
  the run (routes walk link by link) → debrief. The prediction screen is what
  makes the calibration score possible, and it must stay *before* the reveal.
  Exports a Markdown threat model; nothing the reader chooses leaves the
  device.
- **`src/share.ts`** — team share-links: the ledger's done-bits packed into a
  hex payload in the URL hash (`#share=7.<hex>`, bit order = sections-array
  order, so **don't reorder or insert sections** without bumping the payload
  version). V1 links are still decoded against the frozen `V1_ORDER` list —
  when you bump the version, freeze the old order the same way rather than
  letting old links mark the wrong sections done. `main.ts` shows a
  merge/replace/ignore banner when a share hash is present.

A `Section` is `{ id, ordinal, title, tagline, body, docs }`. `body` is
**trusted HTML authored in this repo** and injected via `innerHTML` — keep it
that way; do not feed user or fetched input through it. `docs` renders as an
"Official docs & sources" aside.

**To add or edit a section**, add/modify a `Section` object in `content.ts`
(L0–L3) or `content2.ts` (everything else). The nav rail, progress gauge, and
scrollspy all derive from the sections array automatically — no wiring needed.
`ordinal` is the label shown ("L0"…"L12", "PW", "TB", "GL", "REF"); `id` is
the anchor and the ledger key. Appending a section is free; inserting one
anywhere else (the usual case — new rungs land before REF) means bumping the
share payload version in `share.ts` and freezing the previous order there. To drop a topology diagram into a body, add an
empty `<div data-graph="<graph id>"></div>` — `main.ts` fills it from
`agentgraph.ts`; add the graph there first if it doesn't exist yet. Interactive
widgets work the same way: `<div data-widget="token-meter"></div>` is mounted
by `hydrateWidgets()` in `main.ts`. Both hooks keep the markup out of the
content files and out of the palette's search index (which reads the body
strings, so an empty div contributes nothing). Headings need no markup:
every `<h3>` in a body gets a stable id and a hover link at render time.

The ledger persists to `localStorage` under `agentic-guide-ledger-v1`
(`STORE_KEY` in `main.ts`); drill scheduling under `agentic-guide-srs-v1`
(`SRS_KEY` in `drill.ts`); the study-activity journal under
`agentic-guide-log-v1` (`LOG_KEY` in `activity.ts`); the architect's last
interview under `agentic-guide-architect-v1` (`ARCH_KEY` in
`architectui.ts`); the best checkride result under `agentic-guide-wings-v1`
(`WINGS_KEY` in `checkride.ts`); black-box incident records under
`agentic-guide-blackbox-v1` (`BB_KEY` in `blackbox.ts`); the bench's
content-free scoreboard under `agentic-guide-bench-v1` (`BENCH_KEY` in
`bench.ts`); the range's best posture per deployment under
`agentic-guide-range-v1` (`RANGE_KEY` in `range.ts`). Changing any key resets everyone's saved state for that feature
— they are deliberately independent stores.

Three URL-hash payloads coexist and are mutually exclusive: `#share=7.…`
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

When a rung lands or a section's claims change, add a line to the changelog
at the end of REF (`sources` in `content2.ts`) and, if a new term came with
it, a `<dt>`/`<dd>` pair to the glossary. L12's fault table mirrors the
black box's `FAULTS` taxonomy — change one, change the other.

When editing a section's claims, also update its questions in `src/quiz.ts`
(they quiz the exact numbers and phrasings the sections teach), the matching
model terms and finding texts in `src/labsim.ts`, the fault blurbs and per-turn
commentary in `src/blackbox.ts`, any rule in `src/rubric.ts` whose `ref`
points at that section, and — for anything about untrusted input, permissions,
credentials or isolation — the control blurbs and route stages in
`src/range.ts`. The palette's search index derives from the bodies
automatically and needs no maintenance.
