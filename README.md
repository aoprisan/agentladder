# Agentic Workflows with Claude — team field guide

A static TypeScript site (Vite, zero runtime dependencies) that takes a team
from the basics of agentic AI to the 2026 state of the art, focused on Claude.
Content is organized as levels L0–L8 plus a prompt-writing section, a
toolbox and a sources section,
with official documentation links throughout. Reading progress is tracked
per-device in localStorage (the "ledger" — the same pattern the guide's L7
section describes for long-running agents).

Beyond reading, the guide is a learning instrument:

- **The architect** — a decision console for *your* work (the `architect`
  button). Answer eight questions about a real task's shape — scale,
  coupling, verifiability, stakes — and the engine scores all seven L1
  patterns against it using the simulator's own fit model, stress-tests the
  candidates, and returns a stance (call / workflow / agent / multi-agent),
  a ranked scoreboard with modeled quality/cost/latency, a context plan, and
  a guardrail kit. Export the whole thing as a Markdown decision brief
  (including a starter CLAUDE.md), copy a decision link that carries the
  interview in the URL hash, or hand the synthesized task straight to the
  pattern lab to watch it fly.
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
- **The black box** — trajectory review (the `black box` button): four
  recorded agent runs that went wrong, with the transcript and the outcome but
  no diagnosis. Flag the turns where the run went off the rails and name the
  failure mode from a ten-entry taxonomy; scoring gives partial credit for
  locating a fault you misname and penalises false alarms, so "flag
  everything" loses.
- **The bench** — a static review of a real artifact (the `bench` button):
  paste your own CLAUDE.md, agent prompt, or tool description and get
  line-anchored findings, each with a fix and a citation to the section that
  justifies it. What you paste is never persisted, never put in the URL, and
  never leaves the tab.
- **The hangar** — the bench's before/after mode: two versions of the same
  artifact side by side and a findings *diff* — which of the guide's
  objections your edit fixed, which it introduced, which stand — plus the
  score and token delta, so the bench works as an editing loop. Findings are
  matched by rule and line *content*, so an edit that merely shifts line
  numbers shows no churn. Same privacy contract as the bench.
- **The wind tunnel** — an inline widget in L2: paste a real conversation or
  agent transcript and watch it occupy the context window turn by turn — the
  rot band, the point where compaction fires, the overflow line — then apply
  each L2 strategy retroactively (compaction, dropping old tool results,
  structured notes) and see what it would have kept. Same thresholds as the
  pattern lab, same estimator as the token meter, same privacy contract.
- **The range** — the adversarial exercise (the `range` button). Pick a
  deployment (public triage bot, customer-facing support agent, developer
  laptop, overnight researcher), spend a fixed budget of *friction points* on
  thirteen controls, then commit — before the reveal — to which attacks you
  think your own posture holds. Ten threats, each with two routes to the same
  outcome; a threat counts as contained only when both routes are cut, and the
  second route is always the one the obvious control misses. The debrief
  scores the posture and your calling of it separately (the gap is the
  interesting number), ranks the best next point of friction to spend, names
  the controls that bought nothing in this setting, and exports the whole
  thing as a Markdown threat model. The same control costs different amounts
  in different deployments — an approval queue is affordable on a nightly
  batch and a staffing decision on a support desk.
- **Flight record** — a retention dashboard (the `stats` button): study
  streaks, a 12-week activity heatmap, per-section recall mastery from the
  Leitner boxes, per-incident trajectory-review scores, threat posture per
  deployment, and a 14-day review-due forecast.
- **The checkride** — a certification exam (the `checkride` button): 15
  questions sampled for coverage across every level, one pass, no feedback until the end,
  pass mark 80%. Passing earns "wings" — a shareable, checksummed certificate
  link (`#wings=…`) that shows teammates a verified score banner when opened.
  Unlike the drill, the checkride never touches your review schedule.
- **The crew console** — team coverage with no backend (the `crew` button):
  paste the share-links and wings links teammates sent, one per line with an
  optional name prefix, and read the coverage matrix — who has read what,
  the team's blind spots, who is certified — exportable as Markdown for a
  standup. Links are decoded locally with the same decoders the share and
  wings features use (old link versions keep working); nothing is fetched
  and nothing leaves the device.
- **The syllabus** — a study plan with a date on it (from the palette or the
  flight record): pick when you want wings and get a day-by-day plan —
  sections in curriculum order, each exercise placed after the level that
  teaches it, drill days where the Leitner forecast says reviews fall due,
  the checkride last with a buffer day. Impossible dates are refused with
  the earliest feasible counter-offer. Exports Markdown and an `.ics`.
- **Ghost runs** — a pattern-lab debrief has a "copy run link" that encodes
  the whole configuration into `#lab=…`. The lab is deterministic by design,
  so a teammate opening the link watches the *same run* fly — architect
  missions travel too, as their eight trait digits.
- **Command palette** — `⌘K` / `Ctrl+K` / `/` opens full-text search across
  all section content, with quick actions (ask the architect, start drill,
  take the checkride, open the lab, the hangar, the crew console, the
  syllabus, the wind tunnel, open the flight record, copy progress link).
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
src/content2.ts       prompt writing, toolbox, L4–L8, sources
src/range.ts          the range: controls, threats, routes, scoring (pure logic)
src/rangeui.ts        the range overlay (harden → call it → run → debrief)
src/rubric.ts         the bench's review rules + the hangar's diff (pure logic)
src/bench.ts          the bench overlay (single review + before/after compare)
src/crew.ts           crew console: link decoding, aggregation (pure logic)
src/crewui.ts         the crew console overlay
src/windtunnel.ts     wind tunnel: transcript replay engine (pure logic)
src/windtunnelui.ts   the wind tunnel widget (L2)
src/syllabus.ts       study planner + Markdown/.ics exports (pure logic)
src/syllabusui.ts     the syllabus overlay
src/blackbox.ts       recorded incidents + fault taxonomy (pure data)
src/blackboxui.ts     the black box overlay
src/agentgraph.ts     agent topology diagrams (pure data + SVG renderer)
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
