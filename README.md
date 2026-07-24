# Agentic Workflows with Claude — team field guide

A static TypeScript site (Vite, zero runtime dependencies) that takes a team
from the basics of agentic AI to the 2026 state of the art, focused on Claude.
Content is organized as levels L0–L7 plus a toolbox and a sources section,
with official documentation links throughout. Reading progress is tracked
per-device in localStorage (the "ledger" — the same pattern the guide's L7
section describes for long-running agents).

Beyond reading, the guide is a learning instrument:

- **Recall drill** — a spaced-repetition question bank (Leitner boxes,
  persisted per-device) over every section. The `drill` button in the top bar
  shows how many cards are due; missed cards come back sooner, known cards
  retreat to longer intervals.
- **Pattern lab** — a deterministic agent-run simulator (the `lab` button).
  Pick a mission, an architecture pattern (L1), a context strategy (L2),
  compaction, and a tool surface (L3), then watch the run play out: a live
  context-window meter, signal-integrity decay from context rot, token and
  wall-clock costs, compaction and overflow events. The debrief grades
  quality / cost / latency and links every finding back to the section that
  teaches it. Same setup, same run — it's a model of the trade-offs, built
  from the guide's own claims, not a slot machine.
- **Flight record** — a retention dashboard (the `stats` button): study
  streaks, a 12-week activity heatmap, per-section recall mastery from the
  Leitner boxes, and a 14-day review-due forecast.
- **Command palette** — `⌘K` / `Ctrl+K` / `/` opens full-text search across
  all section content, with quick actions (start drill, open the lab, open
  the flight record, copy progress link).
- **Team share-links** — your ledger encodes into a URL hash (no backend, no
  account). Send the link; a teammate gets a merge / replace / ignore banner.

## Develop

```sh
just dev        # or: npm install && npm run dev
```

## Build

```sh
just build      # typechecks, then emits dist/
just preview    # serve dist/ locally
```

## Deploy to GitHub Pages

The Vite config uses `base: "./"`, so `dist/` is relocatable — it works from
`https://<user>.github.io/<repo>/` without changes.

This repo ships a GitHub Actions workflow (`.github/workflows/deploy.yml`) that
builds and publishes on every push to `main`. To enable it, set
**Settings → Pages → Build and deployment → Source** to **"GitHub Actions"**
once; deploys then happen automatically.

Alternatively, `just deploy` (or `npx gh-pages -d dist`) pushes the build to a
`gh-pages` branch.

## Offline / installable (PWA)

The site is a Progressive Web App: it ships a web manifest
(`public/manifest.webmanifest`) and a dependency-free service worker
(`public/sw.js`) that precaches the app shell, so it installs to a
home screen and works fully offline after the first visit.

## Structure

```
index.html            app shell
public/               favicon (SVG), manifest, service worker, icons
src/main.ts           rendering, ledger state, scrollspy rail, feature wiring
src/content.ts        sections L0–L3 (typed data)
src/content2.ts       toolbox, L4–L7, sources
src/quiz.ts           recall-drill question bank (typed data)
src/drill.ts          spaced-repetition scheduler + drill overlay
src/labsim.ts         pattern-lab simulation engine (pure logic)
src/lab.ts            pattern-lab overlay (configure → run → debrief)
src/activity.ts       per-device study-event journal
src/stats.ts          flight-record dashboard (streaks, mastery, forecast)
src/palette.ts        ⌘K command palette / full-text search
src/share.ts          progress share-links (URL-hash encoding)
src/styles.css        design system
```

## Updating content

Sections are plain typed objects (`Section` in `src/content.ts`): id, ordinal,
title, tagline, HTML body, and a `docs` list of official links rendered as an
aside. Add or edit a section and the rail, progress gauge, and scrollspy pick
it up automatically. This space moves monthly — re-verify version-specific
claims (agent teams, nested subagents, CLI flags) against
https://code.claude.com/docs before relying on them.
