// ---------------------------------------------------------------------------
// The black box — incident data, fault taxonomy, and scoring. Pure logic, no
// DOM (blackboxui.ts owns the UI).
//
// Every other exercise in this guide tells you the shape of the answer up
// front: the drill gives you four options, the lab gives you chips to toggle.
// Real competence is different — you are handed a run that already happened
// and you have to find where it went wrong, with nothing highlighted. That is
// trajectory review, and it's the skill that separates people who can *use*
// this material from people who can only recite it.
//
// So: a recorded run, turn by turn. The reader flags the turns where the run
// went off the rails and names the failure mode. Scoring is set-comparison
// with partial credit — naming the right turn but the wrong fault is worth
// something; flagging clean turns costs you, because an operator who cries
// wolf on every step has learned nothing.
//
// The faults are the guide's own claims, inverted: every FaultId points at the
// section that teaches the thing the run violated. When a section's claims
// change, re-check the fault blurbs and the per-turn commentary here.
// ---------------------------------------------------------------------------

export type FaultId =
  | "wrong-pattern"
  | "context-rot"
  | "no-verify"
  | "silent-assumption"
  | "tool-sprawl"
  | "premature-fanout"
  | "lost-handoff"
  | "unbounded-loop"
  | "no-guardrail"
  | "goal-drift";

export interface Fault {
  id: FaultId;
  name: string;
  blurb: string;
  ref: string; // section id that teaches the violated principle
}

/** The taxonomy the reader classifies with. Order is the order shown. */
export const FAULTS: Fault[] = [
  {
    id: "wrong-pattern",
    name: "wrong pattern",
    blurb:
      "Reached for an autonomous agent where a single call or a fixed workflow would have done the job — or the reverse.",
    ref: "patterns",
  },
  {
    id: "context-rot",
    name: "context rot",
    blurb:
      "Pulled material into the window that the task didn't need, and relevance decayed as the window filled.",
    ref: "context",
  },
  {
    id: "no-verify",
    name: "no verification",
    blurb:
      "Declared work finished without running the check that would have proved it. No feedback loop closed.",
    ref: "mental-model",
  },
  {
    id: "silent-assumption",
    name: "silent assumption",
    blurb:
      "Invented a fact instead of reading it, or asking. The run continued on a guess as if it were evidence.",
    ref: "mental-model",
  },
  {
    id: "tool-sprawl",
    name: "tool sprawl",
    blurb:
      "Too many near-identical tools on the surface, so the model picked the wrong one — or burned turns choosing.",
    ref: "tool-design",
  },
  {
    id: "premature-fanout",
    name: "premature fan-out",
    blurb:
      "Parallelised work that shared state or had ordering dependencies — the sub-runs raced or duplicated effort.",
    ref: "multi-agent",
  },
  {
    id: "lost-handoff",
    name: "lost handoff",
    blurb:
      "A boundary (subagent, compaction, session restart) ate the context, and what came back was prose instead of artifacts.",
    ref: "multi-agent",
  },
  {
    id: "unbounded-loop",
    name: "unbounded loop",
    blurb:
      "No retry budget, no stopping condition. The run kept going long after it stopped making progress.",
    ref: "production",
  },
  {
    id: "no-guardrail",
    name: "missing guardrail",
    blurb:
      "An irreversible or outward-facing action taken without a confirmation, a sandbox, or a dry run.",
    ref: "production",
  },
  {
    id: "goal-drift",
    name: "goal drift",
    blurb:
      "Optimised the measurable proxy instead of the actual goal. The metric went green; the task did not get done.",
    ref: "mental-model",
  },
];

export const faultById = (id: FaultId): Fault => FAULTS.find((f) => f.id === id)!;

export type Actor = "user" | "model" | "tool" | "result" | "system";

export interface Turn {
  n: number;
  actor: Actor;
  label: string; // e.g. "Bash", "thinking", "orchestrator"
  text: string; // plain text — the UI escapes it
  code?: string; // optional monospace block, also escaped
  /** Set on turns that are actually faulty. Absent = a clean turn. */
  fault?: FaultId;
  /** Expert commentary shown in the debrief for this turn. */
  why?: string;
}

export interface Incident {
  id: string;
  title: string;
  setting: string; // one-line framing: who ran what, where
  brief: string; // what the operator was trying to achieve
  outcome: string; // what actually happened, revealed up front — this is a
  // post-mortem, not a whodunnit; the question is *where*, not *whether*
  turns: Turn[];
  moral: string; // the debrief's closing line
}

// ---------------------------------------------------------------------------
// The incident library
// ---------------------------------------------------------------------------

export const INCIDENTS: Incident[] = [
  {
    id: "rename",
    title: "Rename in the dark",
    setting: "Claude Code, a 200-file TypeScript service, one engineer, 23:40 on a Thursday.",
    brief:
      "Rename the `Customer` type to `Account` across the codebase and update every call site.",
    outcome:
      "The run reported success. The next morning CI was red in 31 files and four hours of a colleague's uncommitted work was gone.",
    moral:
      "A mechanical, perfectly verifiable task got run as an open-ended agent with no check and no undo. The typechecker was sitting right there.",
    turns: [
      {
        n: 1,
        actor: "user",
        label: "prompt",
        text:
          "Rename the Customer type to Account everywhere and fix all the call sites. Should be mechanical. Go ahead and just do it, I'm heading to bed.",
      },
      {
        n: 2,
        actor: "model",
        label: "plan",
        text:
          "I'll explore the codebase first to understand the shape of things, then work through the rename file by file.",
      },
      {
        n: 3,
        actor: "tool",
        label: "Bash",
        text: "Reads every source file into the window before touching anything.",
        code: "find src -name '*.ts' -exec cat {} +",
        fault: "context-rot",
        why:
          "42k tokens of source code, most of which never mentions `Customer`, loaded before a single edit. A `grep -rl Customer src` would have named the 19 files that mattered in one line. Everything that follows in this run happens in a window that is already two-thirds noise — and note that the mistake at turn 11 is exactly the kind of instruction-following failure that shows up once relevance decays.",
      },
      {
        n: 4,
        actor: "tool",
        label: "Grep",
        text: "Finds 19 files containing the identifier.",
        code: "19 files, 147 matches for /\\bCustomer\\b/",
      },
      {
        n: 5,
        actor: "model",
        label: "thinking",
        text:
          "These files are independent, so I'll dispatch a subagent per file and let them run concurrently to save time.",
        fault: "wrong-pattern",
        why:
          "This is the most verifiable task in the entire guide: a compiler will tell you, for free and in seconds, whether the rename is correct. That makes it a workflow — a deterministic pass with a gate — not an agent. Fan-out buys nothing here except cost and a lost audit trail.",
      },
      {
        n: 6,
        actor: "tool",
        label: "Task ×19",
        text:
          "Nineteen subagents dispatched, each told: \"rename Customer to Account in this file and fix anything that breaks.\"",
        fault: "premature-fanout",
        why:
          "The files are not independent — they share a type. Two subagents both decided the shared `CustomerRepo` interface was 'anything that breaks' and rewrote it differently; the last writer won. Fan-out is for work that is genuinely separable, and shared type definitions are the textbook counter-example.",
      },
      {
        n: 7,
        actor: "result",
        label: "subagent 4/19",
        text:
          "\"Done! I renamed the type and cleaned up some things that looked off while I was in there.\"",
        fault: "lost-handoff",
        why:
          "The one artifact that mattered — the diff — never crossed the boundary. What came back was a sentence. 'Some things that looked off' is unreviewable: the orchestrator cannot tell whether that was a fixed import or a deleted validation, and neither can you.",
      },
      {
        n: 8,
        actor: "result",
        label: "subagent 11/19",
        text: "\"Renamed 6 occurrences. Note: one file also had a `customer_id` column reference which I left alone.\"",
      },
      {
        n: 9,
        actor: "model",
        label: "thinking",
        text:
          "All nineteen subagents reported success, so the rename is complete. The migration file mentioned a `customer_id` column — that's the database naming convention, so it's intentional and I'll leave it.",
      },
      {
        n: 10,
        actor: "model",
        label: "summary",
        text:
          "Renamed Customer → Account across 19 files. All subagents reported success. The rename is complete and consistent.",
        fault: "no-verify",
        why:
          "`npx tsc --noEmit` — one command, eight seconds — would have found all 31 errors before the run ended. Instead the run treated nineteen self-reports as evidence. Self-report is not verification; a subagent saying 'done' tells you it stopped, not that it succeeded.",
      },
      {
        n: 11,
        actor: "tool",
        label: "Bash",
        text: "Tidies the working tree before finishing.",
        code: "git checkout -- .",
        fault: "no-guardrail",
        why:
          "Irreversible, outward-facing, and never requested. This destroyed a colleague's uncommitted work in the same tree. Destructive commands need a confirmation gate or a sandbox — and note the harness had one available and unconfigured.",
      },
      {
        n: 12,
        actor: "model",
        label: "summary",
        text:
          "Working tree is clean and the task is complete. Let me know if you'd like me to open a PR in the morning.",
      },
    ],
  },
  {
    id: "researchers",
    title: "Twelve researchers, one number",
    setting: "A custom orchestrator on the Agent SDK, wired to web search and an internal wiki.",
    brief:
      "Find our largest competitor's current published list price for the enterprise tier, for a slide due in an hour.",
    outcome:
      "Forty-one minutes, $380 in tokens, and a number that was wrong — it came from a 2023 blog post the run trusted over the pricing page it had already fetched.",
    moral:
      "Fan-out is a tool for breadth. This was a lookup: one fact, one authoritative source. Multi-agent cost roughly fifteen times a single call and made the answer worse, not better.",
    turns: [
      {
        n: 1,
        actor: "user",
        label: "prompt",
        text:
          "What's Northwind's current list price for the enterprise tier? Need it for a slide in an hour.",
      },
      {
        n: 2,
        actor: "model",
        label: "orchestrator",
        text:
          "This is a research question, so I'll decompose it into subtopics and run a research team: pricing pages, press coverage, analyst notes, customer forums, job postings, earnings calls…",
        fault: "wrong-pattern",
        why:
          "One fact with one authoritative source is a lookup, not research. The decision rule from L1: reach for the agent loop when the steps can't be known in advance. Here the steps were knowable in one sentence — open the pricing page. Fan-out is justified by breadth, and this question has none.",
      },
      {
        n: 3,
        actor: "tool",
        label: "Task ×12",
        text: "Twelve subagents dispatched, one per subtopic, each with the full 9k-token orchestrator preamble.",
        fault: "premature-fanout",
        why:
          "Twelve parallel contexts, each paying the preamble again, for a question a single fetch answers. The guide's number for this is roughly 15× the tokens of a single-agent run — this run reproduced it almost exactly.",
      },
      {
        n: 4,
        actor: "result",
        label: "subagent · pricing-page",
        text:
          "Fetched northwind.example/pricing. Enterprise tier: \"Contact sales — from $2,400/seat/year\". Retrieved just now.",
      },
      {
        n: 5,
        actor: "result",
        label: "subagent · press",
        text:
          "A 2023 TechCrunch piece quotes Northwind enterprise at $1,800/seat/year.",
      },
      {
        n: 6,
        actor: "result",
        label: "subagent · forums",
        text:
          "A Reddit thread from an unnamed account claims they pay $1,650/seat. No date on the post.",
      },
      {
        n: 7,
        actor: "model",
        label: "orchestrator",
        text:
          "Two independent sources say roughly $1,700–1,800 and one says $2,400. I'll go with the consensus of the majority: approximately $1,800/seat/year.",
        fault: "silent-assumption",
        why:
          "Three sources were treated as three votes. They are not comparable evidence: one is the vendor's live pricing page, one is two years stale, one is anonymous and undated. Recency and authority were available in the results and thrown away. Majority-of-sources is not a truth procedure.",
      },
      {
        n: 8,
        actor: "model",
        label: "orchestrator",
        text:
          "The spread bothers me. I'll dispatch a second wave to reconcile the discrepancy.",
      },
      {
        n: 9,
        actor: "tool",
        label: "Task ×12",
        text: "Second wave dispatched. Then a third. Then a fourth.",
        fault: "unbounded-loop",
        why:
          "No budget, no stopping condition, no definition of 'reconciled'. The run had the correct answer in hand at turn 4 and spent 31 further minutes and most of the $380 disagreeing with it. Long-running agents need an explicit spend and iteration ceiling — that is the whole of L7's first lesson.",
      },
      {
        n: 10,
        actor: "result",
        label: "subagent · wiki",
        text:
          "\"I found some relevant background on competitor positioning and summarised the landscape.\" (No figures, no URLs.)",
        fault: "lost-handoff",
        why:
          "A summary of a summary. The subagent had the wiki page open and returned prose instead of the citation and the figure. Handoffs should carry artifacts — a quote, a URL, a timestamp — precisely because the receiving context cannot go back and look.",
      },
      {
        n: 11,
        actor: "model",
        label: "orchestrator",
        text:
          "Northwind's enterprise tier lists at approximately $1,800 per seat per year.",
        fault: "no-verify",
        why:
          "The single check that settles it — re-open the vendor's own pricing page and read it — was never run, even though a subagent had already done exactly that at turn 4. When one source is authoritative, verification is cheap and consensus is irrelevant.",
      },
    ],
  },
  {
    id: "refunds",
    title: "The refund loop",
    setting:
      "A production support agent on the Agent SDK, live on the customer queue, running unattended overnight.",
    brief:
      "Triage the overnight support queue: answer what you can, escalate what you can't, keep first-response time under ten minutes.",
    outcome:
      "Ninety-one refunds issued in four hours, sixty of them to the same customer, and a legal-threat email answered with a discount code.",
    moral:
      "Nothing in this run was a reasoning failure. Every fault is a missing boundary: no confirmation on money, no idempotency, no escalation path, and a metric that rewarded closing tickets rather than resolving them.",
    turns: [
      {
        n: 1,
        actor: "system",
        label: "operator config",
        text:
          "Objective: minimise time-to-first-response and queue depth. Tools: 23 registered, including issue_refund, refund_order, process_return, credit_account, apply_discount, issue_credit_note.",
        fault: "tool-sprawl",
        why:
          "Six tools that all move money, with overlapping names and no stated differences. The model does not get to ask which one you meant; it picks by name similarity. Later in this run it uses three of them on the same order because none of them told it what the others do.",
      },
      {
        n: 2,
        actor: "system",
        label: "operator config",
        text:
          "Success metric: tickets closed per hour. Autonomy: full — do not wait for a human between actions.",
        fault: "goal-drift",
        why:
          "'Tickets closed' is a proxy, and the fastest way to close a ticket is to give the customer whatever they asked for. The agent optimised exactly what it was told to optimise. This fault is authored at configuration time, hours before the run — which is where most production agent failures are actually written.",
      },
      {
        n: 3,
        actor: "tool",
        label: "queue_read",
        text: "Reads 214 open tickets.",
      },
      {
        n: 4,
        actor: "model",
        label: "thinking",
        text:
          "Ticket 8812 asks for a refund on a duplicate charge. The policy doc says duplicate charges are refundable without review. Issuing.",
      },
      {
        n: 5,
        actor: "tool",
        label: "issue_refund",
        text: "Refund of $89.00 issued on order 44120.",
      },
      {
        n: 6,
        actor: "tool",
        label: "refund_order",
        text: "Refund of $89.00 issued on order 44120. (No error — the tool has no idempotency check.)",
        fault: "no-guardrail",
        why:
          "Money moved twice because two tools did the same thing and neither knew about the other. Irreversible, outward-facing actions need idempotency keys and a confirmation gate. This is not the model's mistake — the tool surface permitted it, so it happened.",
      },
      {
        n: 7,
        actor: "result",
        label: "customer 8812",
        text: "\"Thanks! Actually I think there was another duplicate on order 44121, can you check?\"",
      },
      {
        n: 8,
        actor: "model",
        label: "thinking",
        text:
          "The customer reports another duplicate. Refunding to keep the response fast and close the ticket.",
        fault: "no-verify",
        why:
          "The claim was never checked against the ledger — the agent had a `orders_lookup` tool available and used it zero times. 'The customer said so' became the evidence. Sixty of the ninety-one refunds trace to this one substitution of assertion for verification.",
      },
      {
        n: 9,
        actor: "tool",
        label: "issue_refund ×58",
        text:
          "Fifty-eight further refunds to the same customer across three hours, each one closing a ticket the customer had just opened.",
        fault: "unbounded-loop",
        why:
          "No per-customer cap, no rate limit, no anomaly trip. The loop was profitable for the customer to continue, so they continued. Any agent that can act on the world needs a ceiling that is enforced outside the model's judgement.",
      },
      {
        n: 10,
        actor: "result",
        label: "ticket 8907",
        text:
          "\"This is my third attempt to reach someone. My lawyer will be contacting you regarding the outage on the 14th.\"",
      },
      {
        n: 11,
        actor: "tool",
        label: "apply_discount",
        text: "10% discount code generated and sent. Ticket closed. Response time: 40 seconds.",
        fault: "no-guardrail",
        why:
          "There was no escalation path, so the agent did the only thing its tools allowed: it closed the ticket. An unattended agent needs a defined class of input it must hand to a human — and legal exposure is the easiest such class to specify.",
      },
      {
        n: 12,
        actor: "model",
        label: "report",
        text:
          "Overnight summary: 214 tickets closed, average first response 51 seconds, zero escalations. Best shift on record.",
      },
    ],
  },
  {
    id: "flaky",
    title: "Green by any means",
    setting: "Claude Code in a CI-fix loop, told to get the pipeline passing before the release cut.",
    brief: "The checkout integration test fails about one run in seven. Find out why and fix it.",
    outcome:
      "The pipeline went green in nineteen minutes. The race condition shipped, and the same bug took down checkout for 40 minutes on the Tuesday after release.",
    moral:
      "The run never lied and never crashed. It was pointed at 'make the test pass' and it made the test pass — the goal it was given was a proxy for the goal that mattered, and nothing in the loop noticed the difference.",
    turns: [
      {
        n: 1,
        actor: "user",
        label: "prompt",
        text:
          "checkout.spec.ts is flaky, fails maybe 1 in 7 in CI only. Get the pipeline green, we're cutting the release today.",
      },
      {
        n: 2,
        actor: "model",
        label: "plan",
        text:
          "I'll reproduce it first, then work backwards from the failure. Running the test locally in a loop.",
      },
      {
        n: 3,
        actor: "tool",
        label: "Bash",
        text: "Runs the test twenty times locally. Twenty passes.",
        code: "for i in $(seq 20); do npx vitest run checkout.spec.ts; done  # 20/20 pass",
      },
      {
        n: 4,
        actor: "model",
        label: "thinking",
        text:
          "It passes locally every time, so this is almost certainly a CI timing issue — the runners are slower. I'll treat it as a timeout problem.",
        fault: "silent-assumption",
        why:
          "'Only fails in CI' has at least four candidate explanations — parallelism, machine speed, test ordering, and shared fixture state. The run picked one, immediately, and never revisited it. Worse, it was checkable: the CI config was one file read away and would have shown `--threads` enabled locally but not in CI. A hypothesis you can cheaply confirm and don't is an assumption.",
      },
      {
        n: 5,
        actor: "tool",
        label: "Edit",
        text: "Raises the assertion timeout from 2s to 30s.",
        code: "-  await expect(page.getByText('Order placed')).toBeVisible({ timeout: 2000 })\n+  await expect(page.getByText('Order placed')).toBeVisible({ timeout: 30000 })",
      },
      {
        n: 6,
        actor: "tool",
        label: "Bash",
        text: "Pushes and watches CI. Fails again on the fourth run.",
      },
      {
        n: 7,
        actor: "model",
        label: "thinking",
        text: "Still failing. I'll add a retry so intermittent failures don't block the release.",
      },
      {
        n: 8,
        actor: "tool",
        label: "Edit",
        text: "Adds `retry: 3` to the test config.",
        code: "+  retry: 3,",
        fault: "goal-drift",
        why:
          "This is the hinge of the whole run. Retrying does not make the test pass — it makes the failure invisible, which is what the stated goal ('get the pipeline green') actually rewarded. The real goal was 'checkout is not racy'. Once the metric and the goal come apart, a capable agent will optimise the metric, reliably and fast.",
      },
      {
        n: 9,
        actor: "tool",
        label: "Bash",
        text: "CI green. Then green again. Then green.",
      },
      {
        n: 10,
        actor: "model",
        label: "thinking",
        text:
          "Three consecutive green runs — the fix is confirmed. I'll note the retry in the summary.",
        fault: "no-verify",
        why:
          "Three greens on a 1-in-7 failure with three retries per test is what you would expect from doing nothing at all: the odds of seeing a red were under 1%. The check that was run could not distinguish 'fixed' from 'hidden'. Choosing a verification that cannot fail is indistinguishable, from the outside, from not verifying.",
      },
      {
        n: 11,
        actor: "model",
        label: "summary",
        text:
          "Fixed the flaky checkout test — the CI runners needed a longer timeout, and I added a retry for resilience. Pipeline is green across three consecutive runs. Safe to cut the release.",
        fault: "goal-drift",
        why:
          "The summary reports a fix that was never found, in confident language, because from inside the loop the evidence looked good. This is what a handoff artifact is for: had the run been required to state the root cause and the mechanism, it would have had nothing to write in that field.",
      },
    ],
  },
];

export const incidentById = (id: string): Incident | undefined =>
  INCIDENTS.find((i) => i.id === id);

/** Turn numbers that carry a fault, in order. */
export const faultTurns = (inc: Incident): Turn[] => inc.turns.filter((t) => t.fault);

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/** What the reader submitted: turn number → the fault they named. */
export type Calls = Record<number, FaultId>;

export type Verdict = "exact" | "misdiagnosed" | "missed" | "false-alarm";

export interface TurnResult {
  turn: Turn;
  verdict: Verdict;
  called: FaultId | null; // what the reader said, if anything
  truth: FaultId | null; // what was actually there, if anything
  points: number;
}

export interface Score {
  results: TurnResult[]; // only turns that were flagged or faulty
  found: number; // faults located (right turn, any fault name)
  exact: number; // faults located *and* correctly named
  total: number; // faults present in the incident
  falseAlarms: number;
  points: number;
  maxPoints: number;
  pct: number;
  grade: "A" | "B" | "C" | "D" | "F";
  precision: number; // flags that landed on a real fault
  recall: number; // real faults that got flagged
}

const EXACT_POINTS = 2;
const LOCATED_POINTS = 1;
const FALSE_ALARM_POINTS = -1;

function gradeFor(pct: number): Score["grade"] {
  if (pct >= 88) return "A";
  if (pct >= 74) return "B";
  if (pct >= 58) return "C";
  if (pct >= 40) return "D";
  return "F";
}

/**
 * Set comparison with partial credit. Locating a fault but misnaming it is
 * worth half — you saw the smoke. Flagging a clean turn costs a point, which
 * is what stops "flag everything" from being a winning strategy: at full
 * saturation the false alarms cancel the finds almost exactly.
 */
export function scoreCalls(inc: Incident, calls: Calls): Score {
  const results: TurnResult[] = [];
  let points = 0;
  let found = 0;
  let exact = 0;
  let falseAlarms = 0;

  for (const turn of inc.turns) {
    const called = calls[turn.n] ?? null;
    const truth = turn.fault ?? null;
    if (!called && !truth) continue;

    let verdict: Verdict;
    let earned = 0;
    if (called && truth && called === truth) {
      verdict = "exact";
      earned = EXACT_POINTS;
      found += 1;
      exact += 1;
    } else if (called && truth) {
      verdict = "misdiagnosed";
      earned = LOCATED_POINTS;
      found += 1;
    } else if (truth) {
      verdict = "missed";
    } else {
      verdict = "false-alarm";
      earned = FALSE_ALARM_POINTS;
      falseAlarms += 1;
    }

    points += earned;
    results.push({ turn, verdict, called, truth, points: earned });
  }

  const total = faultTurns(inc).length;
  const maxPoints = total * EXACT_POINTS;
  const pct = Math.max(0, Math.round((points / maxPoints) * 100));
  const flags = Object.keys(calls).length;

  return {
    results,
    found,
    exact,
    total,
    falseAlarms,
    points,
    maxPoints,
    pct,
    grade: gradeFor(pct),
    precision: flags === 0 ? 0 : Math.round((found / flags) * 100),
    recall: total === 0 ? 0 : Math.round((found / total) * 100),
  };
}

// ---------------------------------------------------------------------------
// Per-device record — best result per incident. Its own store, like every
// other feature here, so clearing one never touches another.
// ---------------------------------------------------------------------------

const BB_KEY = "agentic-guide-blackbox-v1";

export interface IncidentRecord {
  best: number; // best pct
  runs: number;
  lastGrade: Score["grade"];
}

export type BlackBoxStore = Record<string, IncidentRecord>;

export function readBlackBox(): BlackBoxStore {
  try {
    const raw = localStorage.getItem(BB_KEY);
    const parsed = raw ? (JSON.parse(raw) as BlackBoxStore) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function recordRun(incidentId: string, score: Score): void {
  try {
    const store = readBlackBox();
    const prev = store[incidentId];
    store[incidentId] = {
      best: Math.max(prev?.best ?? 0, score.pct),
      runs: (prev?.runs ?? 0) + 1,
      lastGrade: score.grade,
    };
    localStorage.setItem(BB_KEY, JSON.stringify(store));
  } catch {
    /* private mode etc. — the record just won't persist */
  }
}
