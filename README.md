# Agentic Workflows with Claude — team field guide

A static TypeScript site (Vite, zero runtime dependencies) that takes a team
from the basics of agentic AI to the 2026 state of the art, focused on Claude.
Content is organized as levels L0–L7 plus a toolbox and a sources section,
with official documentation links throughout. Reading progress is tracked
per-device in localStorage (the "ledger" — the same pattern the guide's L7
section describes for long-running agents).

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
`https://<user>.github.io/<repo>/` without changes. Either:

- push `dist/` to a `gh-pages` branch (`npx gh-pages -d dist`), or
- use a Pages workflow that runs `npm ci && npm run build` and uploads `dist/`.

## Structure

```
index.html            app shell
public/               favicon (SVG)
src/main.ts           rendering, ledger state, scrollspy rail
src/content.ts        sections L0–L3 (typed data)
src/content2.ts       toolbox, L4–L7, sources
src/styles.css        design system
```

## Updating content

Sections are plain typed objects (`Section` in `src/content.ts`): id, ordinal,
title, tagline, HTML body, and a `docs` list of official links rendered as an
aside. Add or edit a section and the rail, progress gauge, and scrollspy pick
it up automatically. This space moves monthly — re-verify version-specific
claims (agent teams, nested subagents, CLI flags) against
https://code.claude.com/docs before relying on them.
