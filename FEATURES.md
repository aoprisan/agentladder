# Feature proposals — five new instruments

> **Status: all five are implemented.** This document remains the design
> record; the living documentation is `CLAUDE.md` and the README.

Five feature definitions for the guide, written to be buildable as-is. Each
follows the house rules: zero runtime dependencies, pure logic separated from
the overlay that renders it, per-device persistence in `localStorage` under its
own versioned key, URL-hash payloads for anything that travels between people,
and the bench's privacy contract for anything a reader pastes in. Ordering is
by expected value, not by effort.

---

## 1. The crew console — team coverage from share-links

**One-liner.** Paste your teammates' progress links and wings links into one
screen and get the team's coverage picture — who has read what, where the
team's blind spots are, who is certified — without a backend, an account, or
anything leaving the tab.

**Problem.** Share-links (`#share=2.…`) and wings links (`#wings=1.…`) already
let progress travel person-to-person, but a lead running a team through the
guide has no way to see the *aggregate*: nine people have sent links, and the
answer to "has anyone on the team read L8?" lives in nine browser tabs. The
guide teaches teams; its progress model is still individual.

**Behavior.**
- A `crew` button opens an overlay with a paste box. The reader pastes any
  number of share-links and wings links (whole URLs or bare hashes), one per
  line, optionally prefixed with a name (`ana: https://…#share=2.…`).
- The console decodes each line with the existing decoders in `share.ts` and
  `checkride.ts` — including the frozen `V1_ORDER` path for old links — and
  renders a coverage matrix: rows are people, columns are sections in
  sections-array order, plus a wings column showing certified score and date.
- Below the matrix: the team's gap list (sections read by the fewest people,
  linked by section id), a coverage percentage, and a count of certified crew.
- An "export" action emits the matrix as Markdown for a standup or a wiki.
- Pasted links may be saved to the roster (names and decoded bits only, never
  the raw URLs' full text beyond the hash payload) so the console reopens
  populated; a per-row remove control and a "clear roster" control exist.

**Modules.** `src/crew.ts` — decoding, aggregation, gap analysis, Markdown
export (pure logic, no DOM; reuses the decoders rather than duplicating bit
order). `src/crewui.ts` — the overlay. `main.ts` wires the button and passes
`jumpTo`.

**Persistence.** `agentic-guide-crew-v1`: the named roster of decoded payloads.
No new URL payload — this feature *consumes* the existing ones.

**Privacy.** Names and progress bits stay on-device. Nothing is fetched;
pasting a URL never causes a request to it.

**Maintenance hooks.** The matrix's column order derives from the sections
array, so the same rule as `share.ts` applies: inserting or reordering
sections requires a payload-version bump, and the crew console must decode
old rosters against the frozen order. Note this in `CLAUDE.md` next to the
share-link warning.

**Done when** a roster of mixed v1/v2 share-links and a wings link renders a
correct matrix, survives reload, exports clean Markdown, and `tsc` passes.

---

## 2. The wind tunnel — watch a real transcript occupy the window

**One-liner.** Paste a real conversation or agent transcript and watch the
context window fill turn by turn — with compaction strategies from L2 applied
live — so context rot stops being a claim and becomes something you did to
your own transcript.

**Problem.** The pattern lab models context load for *synthetic* missions, and
the token meter prices a *single* prompt. Nothing in the guide lets a reader
take their own agent transcript and see the L2 story happen to it: occupancy
climbing, signal integrity decaying, the moment compaction would fire, what a
different strategy would have kept.

**Behavior.**
- A section-embedded widget in L2 (`<div data-widget="wind-tunnel">`), mounted
  by `hydrateWidgets()` like the token meter — not a top-bar overlay; it lives
  where the claim it demonstrates lives.
- The reader pastes a transcript. A tolerant splitter recognises common turn
  markers (`user:`/`assistant:`, `Human:`/`Assistant:`, blank-line fallback);
  the reader can nudge the split by choosing a marker style.
- Each turn is priced with `estimateTokens` from `tokens.ts` (same heuristic,
  same ±10–20% disclaimer, same pointer at `count_tokens`). The widget renders
  a turn-by-turn occupancy timeline against a selectable window size, with the
  rot band from the lab's model overlaid.
- A strategy selector applies L2's compaction strategies retroactively:
  summarize-oldest, drop-tool-results, structured-notes. The timeline redraws
  showing when each would have fired and what occupancy it buys back; numbers
  come from the same model terms `labsim.ts` uses, so the widget and the lab
  never disagree.
- A sample transcript ships (like the bench's `SAMPLES`) so the widget does
  something on first open.

**Modules.** `src/windtunnel.ts` — splitting, per-turn pricing, strategy
replay (pure logic, importing the compaction terms from `labsim.ts` and
`estimateTokens` from `tokens.ts`). `src/windtunnelui.ts` — the widget.

**Persistence.** None. Same contract as the token meter: the pasted transcript
is never persisted, never put in the URL, never leaves the tab, and no
scoreboard is kept.

**Maintenance hooks.** The strategy numbers encode L2's claims — when L2
changes, re-check the wind tunnel's model terms alongside `labsim.ts` (add it
to the content-maintenance list in `CLAUDE.md`).

**Done when** pasting a 40-turn transcript shows a correct cumulative
timeline, switching strategies visibly moves the compaction points, the
sample loads on first open, and nothing appears in `localStorage` afterwards.

---

## 3. The hangar — before/after review on the bench

**One-liner.** Put two versions of the same artifact side by side and get a
findings *diff*: which of the guide's objections your edit fixed, which it
introduced, and what it did to the token bill — turning the bench from a
linter into an editing loop.

**Problem.** The bench reviews one artifact at a point in time. The real
workflow it should serve is iterative: paste CLAUDE.md, read the findings,
edit, and ask *did that help?* Today the reader diffs two findings lists by
eye, and the scoreboard can't tell them whether the score moved because the
artifact improved or because they pasted a different file.

**Behavior.**
- A "compare" toggle on the existing bench overlay adds a second editor pane
  (A = before, B = after) with a "copy A → B" starter action.
- Both panes run through the existing `RULES` plus `contextBudget`. The
  findings panel becomes three lists: **fixed** (in A, not B), **introduced**
  (in B, not A), and **standing** (in both) — matched by rule id plus a
  line-content fingerprint so an unrelated edit shifting line numbers doesn't
  report every finding as fixed-and-reintroduced.
- A delta header: score A → score B, token estimate A → B (via the shared
  `estimateTokens`, so the hangar, the bench and the meter never disagree),
  and finding counts by severity.
- `buildReviewMarkdown` gains a comparison variant so the before/after review
  is exportable like a single review.

**Modules.** Extend `src/rubric.ts` with a pure `compareFindings(a, b)` and
the fingerprint matcher; extend `src/bench.ts` with the second pane. No new
files — this is deliberately an extension of the bench, not a sibling.

**Persistence.** Unchanged from the bench: pasted text is never persisted,
never put in the URL, never leaves the tab. The `agentic-guide-bench-v1`
scoreboard entry for a compare run records kind, both scores, both token
estimates, and a timestamp — no content, same as today.

**Maintenance hooks.** None beyond the bench's existing rule: rules encode
section claims, re-check refs when sections change. The fingerprint matcher
must be re-checked if `Finding`'s shape changes.

**Done when** editing the sample artifact to fix one finding shows exactly
that finding under **fixed**, an injected credential shows under
**introduced**, line-shifting edits produce no phantom churn, and the export
renders both columns.

---

## 4. The syllabus — a study plan with a date on it

**One-liner.** Tell the guide when the team wants to be certified and get a
day-by-day plan — sections to read, reviews already scheduled by the Leitner
boxes, exercise milestones, checkride at the end — exportable as Markdown or
an `.ics` calendar file.

**Problem.** The guide has a curriculum (L0–L9), a scheduler (the drill), a
forecast (the flight record's 14-day review-due view), and an exam (the
checkride) — but no bridge from "I want wings by the 30th" to "here is what
to do each day". The flight record describes the past; nothing plans the
future.

**Behavior.**
- A "plan" quick-action (palette + flight record) opens a small overlay: pick
  a target date and study days per week.
- The planner reads the ledger (unread sections), `readSrsSnapshot()` from
  `drill.ts` (cards due and their box intervals), and the black-box / range /
  bench records, then lays out a schedule: unread sections spread across
  available days in curriculum order, each level's matching exercise placed
  after its sections (lab after L1–L3, black box after L4, range after L8–L9),
  drill days where the Leitner forecast says reviews will fall due, and the
  checkride last with a buffer day.
- Infeasible dates degrade honestly: the planner says what doesn't fit and
  proposes the earliest feasible date rather than silently cramming.
- Exports: Markdown (for a team channel) and a dependency-free hand-rolled
  `.ics` (VEVENT per study day — a text format, no library needed, consistent
  with the hand-rolled service worker ethos).
- The plan is advisory and recomputed on open from live state — reading ahead
  or missing a day just reshapes the remaining schedule. Only the target date
  and days-per-week choice persist.

**Modules.** `src/syllabus.ts` — planning and both exporters (pure logic; date
arithmetic on day granularity, injected "today" for testability).
`src/syllabusui.ts` — the overlay. Reads existing stores read-only, exactly
like `stats.ts`.

**Persistence.** `agentic-guide-plan-v1`: `{ targetDate, daysPerWeek }` only.

**Maintenance hooks.** The exercise-to-level placement encodes the curriculum
shape; re-check it when levels are added (as L9 just was). Interval math must
follow `drill.ts`'s box intervals — import them, don't copy them.

**Done when** a fresh device gets a full-curriculum plan, a mostly-done device
gets a short one, an impossible date is refused with a counter-offer, and the
`.ics` imports cleanly into a calendar app.

---

## 5. Ghost runs — lab permalinks

**One-liner.** A pattern-lab run becomes a URL: `#lab=1.…` encodes mission,
pattern, context strategy, compaction and tool surface, so a debrief can be
sent to a teammate who opens it and watches the *same deterministic run* fly —
the lab's answer to the share-link.

**Problem.** The lab is deterministic by design — same setup, same run — but a
run's configuration can't leave the device. The moment the lab persuades
someone ("look what happens to quality when the fan-out pattern hits this
context load"), there is no way to hand a teammate the evidence except a
screenshot. Determinism is the whole point; it's currently unshareable.

**Behavior.**
- A "copy run link" action on the lab's debrief screen encodes the full
  configuration into `#lab=1.<payload>` — a dot-separated tuple of indices
  into the typed option lists (mission, pattern, context strategy, compaction,
  tool surface), version-prefixed like `#arch=1.…`. Architect-synthesized
  missions (not in `MISSIONS`) additionally encode the eight trait digits so
  the mission can be reconstructed via the architect's existing
  mission-synthesis path.
- On load, `main.ts` reads the hash once at module init (as with the other
  three payloads), validates every index against the current option lists,
  and opens the lab straight onto the configured run with a "shared run"
  banner. An invalid or stale payload gets a graceful "this link predates the
  current lab" notice, never a broken screen.
- `#lab=` joins the mutually-exclusive hash family (`#share=`, `#arch=`,
  `#wings=`).

**Modules.** Encode/decode in `src/labsim.ts` next to the option lists they
index (pure logic; the option arrays are the coupling, so the codec lives
beside them). `src/lab.ts` gains the debrief action and the entry path via
the existing `openWith`.

**Persistence.** None. The URL *is* the artifact.

**Maintenance hooks.** Payload indices are positions in the option arrays —
the same rule as `share.ts`'s bit order: don't reorder or insert options
without bumping the payload version, and decode old versions against a frozen
order. Add `#lab=` to `CLAUDE.md`'s hash-payload list. No hash-sourced string
is rendered as HTML (the payload is digits and dots), but the decoder must
still treat the hash as untrusted input and bounds-check every index.

**Done when** a run link round-trips (copy on one profile, open on a clean
profile, identical event stream and debrief), an architect mission survives
the trip, a tampered payload degrades gracefully, and all four hash payloads
remain mutually exclusive.
