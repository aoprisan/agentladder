// ---------------------------------------------------------------------------
// The wind tunnel — watch a real transcript occupy the context window. Pure
// logic, no DOM (windtunnelui.ts owns the widget).
//
// The pattern lab models context load for synthetic missions and the token
// meter prices a single prompt; this is the missing middle: paste your own
// conversation or agent transcript and watch L2's story happen to it, turn by
// turn — occupancy climbing, the rot band, the moment compaction would fire,
// what a different strategy would have kept.
//
// The thresholds are imported from labsim's WINDOW_MODEL — the widget and the
// lab must never disagree about when rot starts or compaction fires — and the
// per-turn pricing is tokens.ts's estimator, the same heuristic every other
// surface uses (±10–20%; the exact number comes from count_tokens, and the
// widget says so). The strategies replay L2's techniques retroactively; when
// L2's claims change, re-check the strategy terms here alongside labsim.ts.
//
// Privacy contract, same as the token meter: the pasted transcript is never
// persisted, never put in the URL, never leaves the tab, and no scoreboard is
// kept.
// ---------------------------------------------------------------------------

import { analyzeTokens } from "./tokens";
import { WINDOW_MODEL } from "./labsim";

export interface Turn {
  role: string; // "user" | "assistant" | "tool" | … | "¶" for blank-split turns
  text: string;
  tokens: number;
  /** share of the estimate spent on structure — how tool-result-ish it looks */
  structurePct: number;
}

export type MarkerStyle = "auto" | "roles" | "blank";

const ROLE_RE = /^\s*(user|assistant|human|ai|system|agent|tool|model|claude)\s*[:>]\s*/i;

/**
 * Split a pasted transcript into turns. "roles" splits on speaker markers
 * (`user:` / `Assistant:` …) at line starts; "blank" splits on blank lines;
 * "auto" picks roles when at least two marker lines exist.
 */
export function splitTranscript(text: string, style: MarkerStyle): Turn[] {
  const lines = text.split(/\r?\n/);
  const markerCount = lines.filter((l) => ROLE_RE.test(l)).length;
  const useRoles = style === "roles" || (style === "auto" && markerCount >= 2);

  const chunks: Array<{ role: string; lines: string[] }> = [];

  if (useRoles) {
    let current: { role: string; lines: string[] } | null = null;
    for (const line of lines) {
      const m = ROLE_RE.exec(line);
      if (m) {
        if (current) chunks.push(current);
        current = { role: m[1].toLowerCase(), lines: [line.replace(ROLE_RE, "")] };
      } else if (current) {
        current.lines.push(line);
      } else if (line.trim()) {
        current = { role: "¶", lines: [line] };
      }
    }
    if (current) chunks.push(current);
  } else {
    let current: string[] = [];
    for (const line of lines) {
      if (line.trim() === "") {
        if (current.length > 0) chunks.push({ role: "¶", lines: current });
        current = [];
      } else {
        current.push(line);
      }
    }
    if (current.length > 0) chunks.push({ role: "¶", lines: current });
  }

  return chunks
    .map((c) => {
      const body = c.lines.join("\n").trim();
      const est = analyzeTokens(body);
      return {
        role: c.role,
        text: body,
        tokens: est.tokens,
        structurePct: est.structurePct,
      };
    })
    .filter((t) => t.tokens > 0);
}

// ---------------------------------------------------------------------------
// Windows — scaled versions of the model, so a few thousand pasted tokens can
// demonstrate dynamics that would need a day-long session at 200K. The
// thresholds stay the same *shares* of the window that labsim uses.
// ---------------------------------------------------------------------------

export interface TunnelWindow {
  id: string;
  label: string;
  sizeK: number;
}

export const TUNNEL_WINDOWS: TunnelWindow[] = [
  { id: "4k", label: "4K", sizeK: 4 },
  { id: "32k", label: "32K", sizeK: 32 },
  { id: "200k", label: "200K", sizeK: WINDOW_MODEL.maxK },
];

// ---------------------------------------------------------------------------
// Strategies — L2's techniques, applied retroactively to the pasted turns.
// ---------------------------------------------------------------------------

export type StrategyId = "none" | "compaction" | "droptools" | "notes";

export interface Strategy {
  id: StrategyId;
  name: string;
  blurb: string;
}

/** A tool-resulty turn: marked as one, or mostly structure rather than words. */
const isToolish = (t: Turn): boolean =>
  t.role === "tool" || t.structurePct > 55;

// Strategy terms. Compaction's trigger/target come from WINDOW_MODEL; the
// rest encode L2's claims — a summary stub keeps ~15% of what it replaces
// (decisions and open items survive, the transcript doesn't), tool results
// stop earning their keep a few turns after they were read.
const NOTE_KEEP = 0.15; // structured notes keep this share of an old turn
const TOOL_STUB = 0.1; // an elided tool result leaves this share behind
const RECENT_TURNS = 4; // how far back "recent" reaches for both strategies

export const STRATEGIES: Strategy[] = [
  {
    id: "none",
    name: "no strategy",
    blurb: "Every token stays forever. The baseline the others are measured against.",
  },
  {
    id: "compaction",
    name: "compaction",
    blurb: `Crossing ${Math.round(WINDOW_MODEL.compactAtShare * 100)}% summarizes the trajectory down to ${Math.round(WINDOW_MODEL.compactToShare * 100)}% — decisions, state and open items survive; the transcript doesn't.`,
  },
  {
    id: "droptools",
    name: "drop old tool results",
    blurb: `Tool output is kept verbatim for ${RECENT_TURNS} turns, then elided to a stub — it was read when it arrived; it doesn't need to be re-read forever.`,
  },
  {
    id: "notes",
    name: "structured notes",
    blurb: `Turns older than ${RECENT_TURNS} turns are replaced by notes at ${Math.round(NOTE_KEEP * 100)}% of their size — durable state lives outside the window.`,
  },
];

// ---------------------------------------------------------------------------
// The replay
// ---------------------------------------------------------------------------

export interface TurnPoint {
  turn: number; // 1-based
  role: string;
  addedK: number; // this turn's own cost, k tokens
  occupancyK: number; // window occupancy after this turn, strategy applied
  occupancyPct: number; // of the selected window
  compacted: boolean; // compaction fired on this turn
  overflowed: boolean; // occupancy is past the overflow line
}

export interface TunnelRun {
  points: TurnPoint[];
  peakPct: number;
  finalPct: number;
  compactions: number;
  /** 1-based turn where occupancy first crossed the overflow line, if ever */
  firstOverflow: number | null;
  /** total k tokens the strategy kept out of the window vs. no strategy */
  savedK: number;
  /** turns spent above the rot floor — the attention-tax exposure */
  turnsAboveRotFloor: number;
}

const kOf = (tokens: number): number => tokens / 1000;

export function replay(turns: Turn[], windowK: number, strategy: StrategyId): TunnelRun {
  const rotFloorK = WINDOW_MODEL.rotFloorShare * windowK;
  const compactAtK = WINDOW_MODEL.compactAtShare * windowK;
  const compactToK = WINDOW_MODEL.compactToShare * windowK;
  const overflowAtK = WINDOW_MODEL.overflowAtShare * windowK;

  const points: TurnPoint[] = [];
  let compactions = 0;
  let firstOverflow: number | null = null;
  let turnsAboveRotFloor = 0;

  // What each already-seen turn currently contributes, in k. Compaction
  // rewrites history wholesale; the other strategies age turns individually.
  const contrib: number[] = [];
  // What compaction has already collapsed — a floor the summary sits on.
  let summaryK = 0;

  let rawTotalK = 0;

  turns.forEach((t, i) => {
    const addedK = kOf(t.tokens);
    rawTotalK += addedK;
    contrib.push(addedK);

    // Age older turns per strategy.
    if (strategy === "droptools" || strategy === "notes") {
      for (let j = 0; j < i - RECENT_TURNS + 1; j++) {
        if (strategy === "droptools") {
          if (isToolish(turns[j])) contrib[j] = Math.min(contrib[j], kOf(turns[j].tokens) * TOOL_STUB);
        } else {
          contrib[j] = Math.min(contrib[j], kOf(turns[j].tokens) * NOTE_KEEP);
        }
      }
    }

    let occupancyK = summaryK + contrib.reduce((a, b) => a + b, 0);

    let compacted = false;
    if (strategy === "compaction" && occupancyK > compactAtK) {
      // Same move labsim's pressure valve makes: the trajectory so far is
      // summarized down to the target share.
      summaryK = compactToK;
      contrib.fill(0);
      occupancyK = compactToK;
      compacted = true;
      compactions += 1;
    }

    const overflowed = occupancyK > overflowAtK;
    if (overflowed && firstOverflow === null) firstOverflow = i + 1;
    if (occupancyK > rotFloorK) turnsAboveRotFloor += 1;

    points.push({
      turn: i + 1,
      role: t.role,
      addedK,
      occupancyK,
      occupancyPct: Math.min(100, (occupancyK / windowK) * 100),
      compacted,
      overflowed,
    });
  });

  const last = points[points.length - 1];
  return {
    points,
    peakPct: Math.round(Math.max(0, ...points.map((p) => p.occupancyPct))),
    finalPct: last ? Math.round(last.occupancyPct) : 0,
    compactions,
    firstOverflow,
    savedK: Math.round((rawTotalK - (last ? last.occupancyK : 0)) * 10) / 10,
    turnsAboveRotFloor,
  };
}

// ---------------------------------------------------------------------------
// Sample transcript — an agent debugging session, so the widget does
// something on first open. Deliberately tool-heavy: the point is watching the
// tool results pile up.
// ---------------------------------------------------------------------------

export const SAMPLE_TRANSCRIPT = `user: The checkout test is flaky again — fails maybe one run in seven, only in CI. Can you find it? The suite is \`npm test -- checkout\`.

assistant: I'll start by reproducing it locally and reading the test to see what it actually asserts. Running the checkout suite in a loop first.

tool: $ for i in $(seq 1 10); do npm test -- checkout --silent; done
run 1: PASS (4.2s)  run 2: PASS (4.1s)  run 3: PASS (4.4s)  run 4: FAIL (4.9s)
run 5: PASS (4.0s)  run 6: PASS (4.3s)  run 7: PASS (4.1s)  run 8: FAIL (5.1s)
run 9: PASS (4.2s)  run 10: PASS (4.0s)

FAIL src/checkout/checkout.test.ts > completes a purchase with a saved card
AssertionError: expected cart.items to have length 0, got 1
  at src/checkout/checkout.test.ts:118:31
  at processTicksAndRejections (node:internal/process/task_queues:95:5)
  at runTest (node_modules/vitest/dist/chunks/runtime.js:1815:11)
  cart.state = { items: [ { sku: "SKU-2214", qty: 1, priceCents: 4900 } ],
    coupon: null, tax: { rate: 0.0875, cents: 429 }, totals: { sub: 4900,
    tax: 429, grand: 5329 }, lastSync: 1755201883021 }

Test Files  1 failed (1)
     Tests  1 failed | 13 passed (14)
  Duration  4.91s (transform 312ms, setup 88ms, collect 419ms, tests 3.71s)

assistant: Reproduced — 2 failures in 10, and it's the cart-empty assertion after purchase, not the payment itself. The failing runs are also the slow ones (4.9s, 5.1s), which smells like timing rather than bad logic. First hypothesis: the CI config gives this suite a tighter timeout and something legitimately slow trips it. Checking the CI logs from the last red run.

tool: $ gh run view 8817243 --log 2>/dev/null | grep -A 40 'checkout'
2026-08-14T03:12:44.1082514Z  RUN  v2.1.9 /home/runner/work/shop/shop
2026-08-14T03:12:44.9871003Z  · src/checkout/checkout.test.ts (14 tests) 5122ms
2026-08-14T03:12:49.2211872Z  FAIL src/checkout/checkout.test.ts >
2026-08-14T03:12:49.2214191Z    completes a purchase with a saved card
2026-08-14T03:12:49.2216530Z  AssertionError: expected cart.items to have
2026-08-14T03:12:49.2217701Z    length 0, got 1
2026-08-14T03:12:49.2219814Z  ❯ src/checkout/checkout.test.ts:118:31
2026-08-14T03:12:49.2222093Z  ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
2026-08-14T03:12:49.2224707Z  Serialized Error: {
2026-08-14T03:12:49.2226117Z    "items": [ { "sku": "SKU-2214", "qty": 1,
2026-08-14T03:12:49.2227418Z      "priceCents": 4900 } ],
2026-08-14T03:12:49.2228803Z    "coupon": null,
2026-08-14T03:12:49.2230112Z    "tax": { "rate": 0.0875, "cents": 429 },
2026-08-14T03:12:49.2231609Z    "totals": { "sub": 4900, "tax": 429,
2026-08-14T03:12:49.2232901Z      "grand": 5329 },
2026-08-14T03:12:49.2234587Z    "lastSync": 1755141169108 }
2026-08-14T03:12:49.2301226Z  Tests  1 failed | 13 passed (14)
2026-08-14T03:12:49.2308861Z  hook timeout: none exceeded, per-test timeout 5000ms not reached
2026-08-14T03:12:49.2312513Z  ##[error]Process completed with exit code 1.

assistant: Hypothesis one is dead: the CI log says no timeout was exceeded — per-test budget is 5000ms and the test finished under it. The assertion itself failed, with the same resurrected cart item as locally. Second hypothesis: shared fixture mutation — another test in the file mutates the same cart fixture and a scheduling difference lets it bleed in. Checking how the fixtures are built.

tool: $ grep -n 'makeCart\\|beforeEach\\|afterEach\\|fixture' src/checkout/checkout.test.ts src/checkout/helpers.ts
src/checkout/checkout.test.ts:12:import { makeCart, stubPayment } from "./helpers";
src/checkout/checkout.test.ts:19:beforeEach(() => resetBackendMock());
src/checkout/checkout.test.ts:97:  const cart = makeCart();
src/checkout/checkout.test.ts:141:  const cart = makeCart();
src/checkout/checkout.test.ts:177:  const cart = makeCart();
src/checkout/helpers.ts:8:export function makeCart(): CartStore {
src/checkout/helpers.ts:9:  return new CartStore(backendMock());
src/checkout/helpers.ts:10:}
src/checkout/helpers.ts:14:export function backendMock() {
src/checkout/helpers.ts:15:  const db = new Map<string, unknown>();
src/checkout/helpers.ts:16:  return {
src/checkout/helpers.ts:17:    push: async (s: unknown) => { await tick(2 + Math.random() * 18); db.set("cart", s); },
src/checkout/helpers.ts:18:    get:  async () => db.get("cart"),
src/checkout/helpers.ts:19:    tick: () => db,
src/checkout/helpers.ts:20:  };
assistant: Fixtures are clean — every test builds its own CartStore over its own mock db, and the backend mock resets between tests. So hypothesis two is out. But the mock itself is interesting: push() awaits a random 2–20ms tick before writing. Two pushes in flight at once would land in random order. That points at a write race inside the store. Reading the test body and the store.

tool: $ sed -n '96,132p' src/checkout/checkout.test.ts
  96  it("completes a purchase with a saved card", async () => {
  97    const cart = makeCart();
  98    await cart.add("SKU-2214");
  99    const payment = stubPayment({ outcome: "approved" });
 100    const order = await checkout(cart, payment);
 101    // the order is confirmed synchronously once payment approves
 103    expect(order.status).toBe("confirmed");
 104    // keep the backend in step with the in-memory cart before the
 105    // email assertion below — mirrors what the app shell does
 108    await cart.sync();          // push state to the mock backend
 112    await confirmEmail(order);  // fire-and-forget in prod code
 115    // checkout() cleared the cart internally; by now both the local
 116    // state and the backend should agree it is empty
 118    expect(cart.items).toHaveLength(0);
 132  });

tool: $ sed -n '1,60p' src/checkout/cartStore.ts
   1  import type { Backend } from "./backend";
  14  export class CartStore {
  15    private state: CartState = emptyCart();
  16    lastSync = 0;
  22    async sync(): Promise<void> {
  23      this.lastSync = Date.now();
  24      const snapshot = structuredClone(this.state);
  25      await this.backend.push(snapshot);       // ← not ordered vs clear()
  31    }
  36    get items() {
  37      return this.state.items;
  38    }
  40    async clear(): Promise<void> {
  41      this.state.items = [];
  42      await this.backend.push(this.state);
  47    }
  52    async hydrate(): Promise<void> {
  53      const remote = await this.backend.get();
  54      if (remote) this.state = remote as CartState;
  55    }

assistant: There it is: \`checkout()\` calls \`cart.clear()\` internally, and the test separately calls \`cart.sync()\`. Both push to the backend but nothing orders them — two in-flight writes, and the mock's random latency decides which lands last. If sync's snapshot (taken before clear ran) lands second, the backend resurrects the item, and the hydrate inside confirmEmail repopulates cart.items. Third step: prove the ordering story with instrumentation instead of trusting the read.

tool: $ npx tsx scripts/trace-cart.ts --runs 30
[trace] instrumenting backend.push with sequence ids…
[trace] run 01: push#1=sync(items:1) push#2=clear(items:0)  final=empty   clean
[trace] run 02: push#1=sync(items:1) push#2=clear(items:0)  final=empty   clean
[trace] run 03: push#1=sync(items:1) push#2=clear(items:0)  final=empty   clean
[trace] run 04: push#1=sync(items:1) push#2=clear(items:0)  final=empty   clean
[trace] run 05: push#1=sync(items:1) push#2=clear(items:0)  final=empty   clean
[trace] run 06: push#1=sync(items:1) push#2=clear(items:0)  final=empty   clean
[trace] run 07: push#1=clear(items:0) push#2=sync(items:1)  final=1 item  DIRTY ←
[trace] run 08: push#1=sync(items:1) push#2=clear(items:0)  final=empty   clean
[trace] run 09: push#1=sync(items:1) push#2=clear(items:0)  final=empty   clean
[trace] run 10: push#1=sync(items:1) push#2=clear(items:0)  final=empty   clean
[trace] run 11: push#1=sync(items:1) push#2=clear(items:0)  final=empty   clean
[trace] run 12: push#1=clear(items:0) push#2=sync(items:1)  final=1 item  DIRTY ←
[trace] run 13: push#1=sync(items:1) push#2=clear(items:0)  final=empty   clean
[trace] run 14: push#1=sync(items:1) push#2=clear(items:0)  final=empty   clean
[trace] run 15: push#1=sync(items:1) push#2=clear(items:0)  final=empty   clean
[trace] run 16: push#1=sync(items:1) push#2=clear(items:0)  final=empty   clean
[trace] run 17: push#1=sync(items:1) push#2=clear(items:0)  final=empty   clean
[trace] run 18: push#1=sync(items:1) push#2=clear(items:0)  final=empty   clean
[trace] run 19: push#1=clear(items:0) push#2=sync(items:1)  final=1 item  DIRTY ←
[trace] run 20: push#1=sync(items:1) push#2=clear(items:0)  final=empty   clean
[trace] run 21: push#1=sync(items:1) push#2=clear(items:0)  final=empty   clean
[trace] run 22: push#1=sync(items:1) push#2=clear(items:0)  final=empty   clean
[trace] run 23: push#1=sync(items:1) push#2=clear(items:0)  final=empty   clean
[trace] run 24: push#1=clear(items:0) push#2=sync(items:1)  final=1 item  DIRTY ←
[trace] run 25: push#1=sync(items:1) push#2=clear(items:0)  final=empty   clean
[trace] run 26: push#1=sync(items:1) push#2=clear(items:0)  final=empty   clean
[trace] run 27: push#1=sync(items:1) push#2=clear(items:0)  final=empty   clean
[trace] run 28: push#1=sync(items:1) push#2=clear(items:0)  final=empty   clean
[trace] run 29: push#1=sync(items:1) push#2=clear(items:0)  final=empty   clean
[trace] run 30: push#1=sync(items:1) push#2=clear(items:0)  final=empty   clean
30 runs: 26 clean, 4 dirty — every dirty run has the stale sync landing last

assistant: Confirmed — all four dirty runs show the pre-clear snapshot landing after the clear; every clean run shows the opposite order. The fix is to serialize writes through the store instead of letting callers race: queue every backend push on a single promise chain so a later clear can never be overtaken by an earlier sync. Patching cartStore now.

tool: $ git diff
diff --git a/src/checkout/cartStore.ts b/src/checkout/cartStore.ts
--- a/src/checkout/cartStore.ts
+++ b/src/checkout/cartStore.ts
@@ -14,6 +14,7 @@ export class CartStore {
   private state: CartState = emptyCart();
+  private writeChain: Promise<void> = Promise.resolve();
   lastSync = 0;
@@ -22,9 +23,12 @@ export class CartStore {
   async sync(): Promise<void> {
     this.lastSync = Date.now();
     const snapshot = structuredClone(this.state);
-    await this.backend.push(snapshot);
+    await this.enqueue(() => this.backend.push(snapshot));
   }
+  private enqueue(w: () => Promise<void>): Promise<void> {
+    this.writeChain = this.writeChain.then(w, w);
+    return this.writeChain;
+  }
@@ -40,7 +44,7 @@ export class CartStore {
   async clear(): Promise<void> {
     this.state.items = [];
-    await this.backend.push(this.state);
+    await this.enqueue(() => this.backend.push(structuredClone(this.state)));
   }

tool: $ npm test -- checkout --silent && for i in $(seq 1 40); do npm test -- checkout --silent | tail -1; done | sort | uniq -c
PASS src/checkout (14 tests) 4.1s
     40 Tests  14 passed (14)

assistant: Fixed and verified. The root cause was a write race in CartStore: sync() and clear() both pushed state to the backend without ordering, so a pre-clear snapshot could land after the clear and resurrect the cart item — which is why it only failed on slow, noisy CI runners. The patch serializes all backend pushes through a single promise chain inside the store (and snapshots the state at enqueue time, closing the same hole in clear()). 40 consecutive runs pass; before the patch it failed 2 in 10.

user: Great. Why did it only ever show up in CI though?

assistant: Timing. Locally the sync round-trip finished well before checkout reached clear(), so the two writes happened to serialize themselves — same code, friendlier schedule. CI runners are slower and noisier: the sync request could still be in flight when clear() fired, and then it was a coin flip which write landed last. That's the classic shape of a race — the bug was always there; CI just ran the experiment often enough to catch it. The fix removes the coin flip rather than the slowness, which is why it holds everywhere. Worth noting for the postmortem: the trace script is checked in at scripts/trace-cart.ts, and the same enqueue pattern should be applied to any store that lets two callers push independently.`;
