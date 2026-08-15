// ---------------------------------------------------------------------------
// Pattern-lab simulation engine — pure logic, no DOM (lab.ts owns the UI).
//
// Models one agent run: a mission with measurable properties (decomposability,
// open-endedness, verifiability, context load…) executed under an architecture
// pattern (L1), a context strategy (L2), and a tool surface (L3). The engine
// walks the run step by step, accounting for context-window growth, context
// rot, compaction, overflow, wrong-tool fumbles, and the token economics of
// fan-out — the same claims the guide's sections teach, made mechanical.
//
// Deliberately deterministic: same configuration, same run. It's a model of
// the trade-offs, not a slot machine.
// ---------------------------------------------------------------------------

export type MissionId = "email" | "inbox" | "migration" | "flaky" | "brief";
export type PatternId =
  | "single"
  | "chain"
  | "route"
  | "parallel"
  | "orch"
  | "evalopt"
  | "agent";

export interface LabConfig {
  mission: MissionId;
  pattern: PatternId;
  context: "preload" | "jit";
  compaction: boolean;
  tools: "lean" | "sprawl";
}

export interface Mission {
  id: MissionId;
  name: string;
  brief: string;
  unitNoun: string; // what the work units are called in the log
  units: number; // irreducible work units
  load: number; // k tokens of material each unit drags in
  decomposable: number; // 0–1: splits into independent subtasks
  known: number; // 0–1: subtasks knowable in advance
  verifiable: number; // 0–1: a crisp success check exists
  open: number; // 0–1: can't predict the steps up front
  variance: number; // 0–1: input heterogeneity (routing's fuel)
  agentFlavor: string[]; // log lines for the full agent loop
}

export interface PatternInfo {
  id: PatternId;
  name: string;
  blurb: string;
}

export const MISSIONS: Mission[] = [
  {
    id: "email",
    name: "Draft the launch email",
    brief: "One marketing email for Thursday's release. Tone guide attached.",
    unitNoun: "draft",
    units: 1,
    load: 3,
    decomposable: 0,
    known: 1,
    verifiable: 0.2,
    open: 0.1,
    variance: 0,
    agentFlavor: [
      "reads the tone guide, then re-reads it",
      "searches the repo for previous launch emails",
      "drafts, second-guesses the subject line, drafts again",
    ],
  },
  {
    id: "inbox",
    name: "Clear the support queue",
    brief: "30 tickets: refunds, bug reports, password resets, one legal threat.",
    unitNoun: "tickets",
    units: 30,
    load: 1.2,
    decomposable: 1,
    known: 0.85,
    verifiable: 0.5,
    open: 0.15,
    variance: 0.9,
    agentFlavor: [
      "answers a refund, then a bug report, switching registers each time",
      "pulls the billing runbook mid-ticket",
      "flags the legal threat for a human — good instinct",
    ],
  },
  {
    id: "migration",
    name: "Migrate 40 deprecated call sites",
    brief: "Mechanical API migration across the codebase. The typechecker is the judge.",
    unitNoun: "call sites",
    units: 40,
    load: 1.8,
    decomposable: 1,
    known: 0.95,
    verifiable: 0.95,
    open: 0.15,
    variance: 0.15,
    agentFlavor: [
      "greps for the deprecated symbol, builds a checklist",
      "migrates a file, runs tsc, moves on",
      "hits the one weird call site with a spread argument",
    ],
  },
  {
    id: "flaky",
    name: "Hunt the flaky checkout test",
    brief: "Fails 1 run in 7, only in CI. Nobody knows why. The test passing is the judge.",
    unitNoun: "hypotheses",
    units: 9,
    load: 5,
    decomposable: 0.15,
    known: 0.15,
    verifiable: 0.95,
    open: 0.9,
    variance: 0.1,
    agentFlavor: [
      "hypothesis: timeout too tight — bumps it, still flaky",
      "hypothesis: shared fixture mutation — adds isolation, closer",
      "instruments the cart store with logging, re-runs 20×",
      "finds it: a race between two awaited writes — one line",
    ],
  },
  {
    id: "brief",
    name: "Write the competitive brief",
    brief: "Quarterly landscape: 6 competitors, pricing moves, a recommendation. Sources everywhere.",
    unitNoun: "research threads",
    units: 12,
    load: 7,
    decomposable: 0.8,
    known: 0.35,
    verifiable: 0.25,
    open: 0.65,
    variance: 0.5,
    agentFlavor: [
      "reads competitor A's changelog, then their pricing page",
      "discovers competitor D pivoted — the outline just changed",
      "drowns in tabs: 14 sources open, 3 summarized",
    ],
  },
];

export const PATTERNS: PatternInfo[] = [
  { id: "single", name: "Single augmented call", blurb: "One well-prompted call with retrieval. The simplest thing." },
  { id: "chain", name: "Prompt chaining", blurb: "Fixed sequential stages, gates between them." },
  { id: "route", name: "Routing", blurb: "Classify first, dispatch to specialist prompts." },
  { id: "parallel", name: "Parallelization", blurb: "Known shards fan out to isolated windows." },
  { id: "orch", name: "Orchestrator–workers", blurb: "A lead agent decomposes dynamically and delegates." },
  { id: "evalopt", name: "Evaluator–optimizer", blurb: "Generate, critique against criteria, revise, repeat." },
  { id: "agent", name: "Full agent loop", blurb: "The model directs its own process and tool use." },
];

export interface SimEvent {
  kind: "info" | "step" | "good" | "warn" | "bad";
  text: string;
  window: number; // k tokens in the main context after this event
  cost: number; // cumulative k tokens spent
  latency: number; // cumulative sim-minutes
  quality: number; // current expected quality 0–100
  /** where in the topology this happened — a node id in the pattern's graph
   *  (agentgraph.ts), so the lab can light the diagram up as the run plays */
  node: string;
}

export interface Finding {
  tone: "good" | "bad" | "note";
  text: string;
  sectionId: string;
  label: string; // "L2 · Context engineering"
}

export interface SimResult {
  config: LabConfig;
  events: SimEvent[];
  quality: number;
  cost: number; // k tokens
  latency: number; // sim-minutes
  grades: { quality: string; cost: string; latency: string };
  verdict: string;
  findings: Finding[];
  recommended: { pattern: PatternId; context: "preload" | "jit"; compaction: boolean; quality: number; cost: number } | null;
}

// The window model, shared with the wind tunnel (windtunnel.ts) so the widget
// and the lab never disagree about when rot starts or compaction fires. The
// shares are fractions of the window: rot begins above 40% occupancy,
// compaction fires at 70% and summarizes down to 30%, overflow hits at 82.5%.
export const WINDOW_MODEL = {
  maxK: 200,
  rotFloorShare: 0.4,
  compactAtShare: 0.7,
  compactToShare: 0.3,
  overflowAtShare: 0.825,
} as const;

const WINDOW_MAX = WINDOW_MODEL.maxK; // k tokens

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

/** How well a pattern matches a mission's shape, 0–1. Each term is legible. */
export function patternFit(p: PatternId, m: Mission): number {
  switch (p) {
    case "single":
      return clamp01(1 - (m.units - 1) / 8) * (1 - 0.5 * m.open);
    case "chain":
      return clamp01(m.known * 0.6 + m.verifiable * 0.3 + 0.2 - m.units / 60 - m.open * 0.4);
    case "route":
      return clamp01(m.variance * (0.5 + m.known * 0.5));
    case "parallel":
      return clamp01(
        m.decomposable * m.known * (0.4 + Math.min(m.units, 10) / 16) * (1 - m.variance * 0.35),
      );
    case "orch":
      return clamp01(
        m.decomposable *
          (0.45 + (1 - m.known) * 0.3 + m.open * 0.25 + Math.min(m.units, 12) / 80),
      );
    case "evalopt":
      return clamp01(
        m.verifiable * 0.55 * (1 - m.open * 0.6) + clamp01(1 - (m.units - 1) / 10) * 0.25,
      );
    case "agent":
      return clamp01(m.open * 0.7 + m.verifiable * 0.25);
  }
}

function gradeQuality(q: number): string {
  return q >= 88 ? "A" : q >= 76 ? "B" : q >= 64 ? "C" : q >= 50 ? "D" : "F";
}

function gradeRatio(ratio: number): string {
  return ratio <= 1.25 ? "A" : ratio <= 2 ? "B" : ratio <= 3.5 ? "C" : ratio <= 7 ? "D" : "F";
}

const fmtK = (k: number): string => `${Math.round(k)}k`;

/**
 * Run one mission. `missionOverride` lets callers simulate a mission that
 * isn't in MISSIONS — the architect (architect.ts) builds one from a reader's
 * interview answers and stress-tests patterns against it; cfg.mission is
 * ignored when an override is present.
 */
export function simulate(
  cfg: LabConfig,
  computeGrades = true,
  missionOverride?: Mission,
): SimResult {
  const m = missionOverride ?? MISSIONS.find((x) => x.id === cfg.mission)!;
  const fit = patternFit(cfg.pattern, m);

  // --- quality budget, set up front; the run spends it -----------------------
  let base = 58 + fit * 34;
  if (fit >= 0.75) base += 4; // the fit-for-purpose bonus
  const gated = cfg.pattern === "chain" || cfg.pattern === "evalopt" || cfg.pattern === "agent" ||
    (cfg.pattern === "parallel" && m.verifiable > 0.7);
  if (gated) base += m.verifiable * 8;
  if (cfg.pattern === "evalopt") base += m.verifiable * 6 - (1 - m.verifiable) * 10;
  const coupled =
    (cfg.pattern === "parallel" || cfg.pattern === "orch" || cfg.pattern === "route") &&
    m.decomposable < 0.4;
  if (coupled) base -= 12;

  let rot = 0; // quality points lost to a bloated window
  let fumbles = 0; // wrong-tool retries (sprawl)
  let overflowed = false;
  let compactions = 0;

  let window = 3;
  let cost = 0;
  let latency = 0;
  const events: SimEvent[] = [];

  const qualityNow = (): number =>
    Math.max(5, Math.min(97, base - rot - fumbles * 1.2));

  // Where the run currently is in the pattern's topology. Events that don't
  // name a node (compaction, overflow, tool fumbles) happen wherever the run
  // already was, so they inherit it.
  let node = "in";

  function emit(kind: SimEvent["kind"], text: string, at?: string): void {
    if (at) node = at;
    events.push({
      kind,
      text,
      window: Math.min(window, WINDOW_MAX),
      cost,
      latency,
      quality: qualityNow(),
      node,
    });
  }

  // Rot accrues when model passes run against a fat main window; a preloaded
  // window rots faster because the stale mass competes for attention on every
  // pass (L2: attention is a finite budget).
  function rotTick(unitsProcessed: number): void {
    const pct = (window / WINDOW_MAX) * 100;
    const over = Math.max(0, pct - WINDOW_MODEL.rotFloorShare * 100);
    rot += unitsProcessed * over * 0.06 * (cfg.context === "preload" ? 1.5 : 1) * 0.01 * 10;
  }

  // Window pressure valve — called between chunks of main-window work.
  function pressure(): void {
    const compactAt = WINDOW_MODEL.compactAtShare * WINDOW_MAX;
    const compactTo = WINDOW_MODEL.compactToShare * WINDOW_MAX;
    if (window > compactAt && cfg.compaction) {
      cost += 4;
      latency += 1.5;
      rot += 0.5;
      window = compactTo;
      compactions += 1;
      emit(
        "good",
        `compaction: trajectory summarized — decisions, current state, open items survive; the transcript doesn't (${compactAt}k → ${compactTo}k)`,
      );
    } else if (window > WINDOW_MODEL.overflowAtShare * WINDOW_MAX && !cfg.compaction) {
      overflowed = true;
      if (m.verifiable > 0.6) {
        cost += 25;
        latency += 8;
        rot += 6;
        window = 40;
        emit("bad", "context overflow — run truncated; restarting from the last verified checkpoint (+25k, +8 min)");
      } else {
        rot += 18;
        window = 120;
        emit("bad", "context overflow — no checkpoint to fall back to; the model quietly loses the plot");
      }
    }
  }

  // Sprawling tool surfaces cause wrong-tool retries in proportion to how many
  // model steps touch them (L3: overlapping tools confuse models like humans).
  let fumbleEventsLeft = 3;
  function fumbleTick(modelSteps: number): void {
    if (cfg.tools !== "sprawl") return;
    const n = modelSteps * 0.12;
    fumbles += n;
    if (fumbleEventsLeft > 0 && fumbles >= (4 - fumbleEventsLeft) * 1.2) {
      fumbleEventsLeft -= 1;
      cost += 2;
      latency += 0.7;
      emit("warn", "grabbed search_docs_v2 instead of search_docs — wrong-tool retry (+2k, +40s)");
    }
  }

  // --- setup ------------------------------------------------------------------
  emit("info", `boot: system prompt + mission brief loaded (3k) — “${m.name}”`);

  if (cfg.tools === "sprawl") {
    window += 9;
    emit("warn", "41 tool schemas attached — 9k of overlapping descriptions ride along on every turn");
  } else {
    window += 1.5;
    emit("info", "6 well-scoped tools attached (+1.5k) — each with one unambiguous job");
  }

  let preloadK = 0;
  if (cfg.context === "preload") {
    preloadK = Math.min(m.units * m.load * 0.9, 150);
    window += preloadK;
    cost += preloadK;
    latency += 1;
    emit(
      preloadK > 60 ? "warn" : "info",
      `kitchen-sink preload: ${fmtK(preloadK)} of docs, dumps and transcripts stuffed in up front`,
    );
  } else {
    const primer = Math.min(5, 1.5 + m.units * m.load * 0.1);
    window += primer;
    cost += primer;
    emit("info", `curated primer only (${primer.toFixed(1)}k) — the agent fetches the rest just-in-time`);
  }

  // Helper for a pass over units inside the MAIN window, chunked for the log.
  function mainPass(
    unitCount: number,
    perUnit: { cost: number; window: number; latency: number },
    chunkText: (doneSoFar: number, chunk: number) => string,
    at: string,
    kind: SimEvent["kind"] = "step",
  ): void {
    const chunks = unitCount <= 4 ? 1 : unitCount <= 12 ? 2 : 3;
    let done = 0;
    for (let c = 0; c < chunks; c++) {
      const n = Math.round((unitCount * (c + 1)) / chunks) - done;
      cost += perUnit.cost * n;
      window += perUnit.window * n;
      latency += perUnit.latency * n;
      rotTick(n);
      fumbleTick(n);
      done += n;
      emit(kind, chunkText(done, n), at);
      pressure();
    }
  }

  const jitFetch = cfg.context === "jit" ? m.load * 0.45 : 0;
  const jitCost = cfg.context === "jit" ? m.load * 0.5 : m.load * 0.25;

  // --- the run, per pattern -----------------------------------------------------
  switch (cfg.pattern) {
    case "single": {
      latency += 1;
      mainPass(
        m.units,
        { cost: 1.8 + jitCost, window: 1.2 + jitFetch, latency: 0.5 },
        (done) => `one context, one pass: ${done}/${m.units} ${m.unitNoun} worked through`,
        "llm",
      );
      break;
    }

    case "chain": {
      const stages = ["decompose & outline", "execute against the outline", "polish & assemble"];
      for (let s = 0; s < stages.length; s++) {
        latency += 0.5;
        mainPass(
          m.units,
          { cost: 0.9 + jitCost * 0.5, window: 0.8 + jitFetch * 0.4, latency: 0.2 },
          (done) => `stage ${s + 1}/3 — ${stages[s]}: ${done}/${m.units} ${m.unitNoun}`,
          `s${s + 1}`,
        );
        if (m.verifiable > 0.5 && s < stages.length - 1) {
          cost += 1.5;
          latency += 0.5;
          emit(
            "good",
            `gate after stage ${s + 1}: output validated programmatically before the next stage sees it`,
            `g${s + 1}`,
          );
        }
      }
      break;
    }

    case "route": {
      cost += m.units * 0.25;
      latency += 1;
      emit("step", `classifier pass: ${m.units} ${m.unitNoun} sorted into buckets (cheap model, 0.25k each)`, "cls");
      const k = 2 + Math.round(m.variance * 3);
      const per = m.units / k;
      cost += m.units * (1.6 + m.load * 0.35);
      latency += per * 0.35 + 1;
      window += 2;
      for (let b = 0; b < Math.min(k, 4); b++) {
        emit(
          "step",
          `specialist route ${b + 1}/${k}: ~${Math.round(per)} ${m.unitNoun} handled with a focused prompt, isolated window`,
          `r${Math.min(b, 2) + 1}`,
        );
      }
      if (m.variance < 0.3) {
        emit("warn", `the inputs all looked alike — ${k - 1} of ${k} specialist routes sat nearly idle`);
      }
      fumbleTick(m.units * 0.3);
      break;
    }

    case "parallel": {
      const b = Math.min(5, Math.max(2, Math.round(m.units / 8)));
      const per = Math.round(m.units / b);
      emit("step", `sectioning: ${m.units} ${m.unitNoun} split into ${b} shards, one isolated window each`, "split");
      cost += m.units * (1.9 + m.load * 0.4) * 1.05;
      latency += per * 0.5 + 1.5;
      for (let i = 0; i < Math.min(b, 3); i++) {
        emit(
          "step",
          `shard ${i + 1}/${b}: ~${per} ${m.unitNoun} processed in a fresh window — no cross-contamination`,
          `w${i + 1}`,
        );
      }
      window += b * 1.5;
      cost += 3;
      latency += 1;
      emit("step", `aggregation: ${b} shard summaries merged in the main window (+${fmtK(b * 1.5)})`, "agg");
      if (m.verifiable > 0.7) {
        cost += 2;
        latency += 1;
        emit("good", "verification gate across all shards — the checker judges the merged end state");
      }
      fumbleTick(m.units * 0.2);
      break;
    }

    case "orch": {
      cost += 6;
      latency += 1.5;
      window += 4;
      emit("step", "lead agent studies the mission and decomposes it — subtasks weren't knowable up front", "lead");
      const w = Math.min(4, Math.max(2, Math.round(m.units / 4)));
      const rounds = m.known < 0.5 ? 2 : 1;
      for (let r = 0; r < rounds; r++) {
        cost += (m.units * (2.2 + m.load * 0.5)) / rounds + w * 3;
        latency += (m.units / w) * 0.6 + 2;
        emit(
          "step",
          rounds === 2 && r === 0
            ? `round 1: ${w} workers explore in parallel windows; the lead reads their reports and re-plans`
            : `${w} workers execute in parallel windows — objective, output format and boundaries spelled out per task`,
          `w${Math.min(r, 2) + 1}`,
        );
        window += w * 2.5;
        pressure();
      }
      cost += 8;
      latency += 2;
      emit("step", "synthesis: the lead merges worker output into one coherent result", "synth");
      fumbleTick(m.units * 0.25);
      break;
    }

    case "evalopt": {
      latency += 1;
      mainPass(
        m.units,
        { cost: 1.6 + jitCost, window: 1.1 + jitFetch, latency: 0.4 },
        (done) => `generator: first full draft covering ${done}/${m.units} ${m.unitNoun}`,
        "gen",
      );
      for (let e = 1; e <= 2; e++) {
        cost += m.units * 0.9 + 4;
        latency += 2;
        window += m.units * 0.6 + 3;
        rotTick(m.units * 0.5);
        emit(
          m.verifiable < 0.4 && e === 2 ? "warn" : "step",
          m.verifiable < 0.4 && e === 2
            ? "revision round 2: without crisp criteria, critic and generator start arguing in circles"
            : `critic scores the draft against the rubric and demands revisions — round ${e}`,
          "eval",
        );
        pressure();
      }
      break;
    }

    case "agent": {
      const loops = Math.round(m.units * (1.15 + m.open * 0.6));
      latency += 0.5;
      emit("step", `agent loop engaged: gather context → act → verify → repeat (est. ${loops} iterations, its call)`, "agent");
      const flavors = m.agentFlavor;
      const chunks = 3;
      let done = 0;
      for (let c = 0; c < chunks; c++) {
        const n = Math.round((loops * (c + 1)) / chunks) - done;
        cost += (2.2 + jitCost) * n;
        window += (1.1 + jitFetch) * n;
        latency += 0.8 * n;
        rotTick(n);
        fumbleTick(n);
        done += n;
        const fi = Math.round((c * (flavors.length - 1)) / (chunks - 1));
        emit("step", `iteration ${done}/${loops}: ${flavors[fi]}`, c === 1 ? "tools" : "agent");
        pressure();
      }
      if (m.verifiable > 0.6) {
        cost += 3;
        latency += 1.5;
        emit("good", "self-verification: the agent runs the check itself before declaring victory", "check");
      } else {
        emit("warn", "no crisp check exists — the agent grades its own homework and stops when it feels done", "check");
      }
      break;
    }
  }

  // --- wrap-up -------------------------------------------------------------------
  const quality = qualityNow();
  emit(
    quality >= 76 ? "good" : quality >= 55 ? "info" : "bad",
    `run complete — ${fmtK(cost)} tokens, ${Math.round(latency)} sim-minutes, signal integrity ${Math.round(quality)}%`,
    "out",
  );

  // --- findings --------------------------------------------------------------------
  const findings: Finding[] = [];
  const ref = (sectionId: string, label: string) => ({ sectionId, label });
  const REFS = {
    mental: ref("mental-model", "L0 · The mental model"),
    patterns: ref("patterns", "L1 · The five composable patterns"),
    context: ref("context", "L2 · Context engineering"),
    tools: ref("tool-design", "L3 · Tool design"),
    multi: ref("multi-agent", "L5 · Multi-agent systems"),
  };

  const patName = PATTERNS.find((p) => p.id === cfg.pattern)!.name.toLowerCase();

  if (cfg.pattern === "single" && m.units <= 2 && fit >= 0.7) {
    findings.push({ tone: "good", text: "The simplest solution possible, and it was enough. This is the single most repeated piece of advice in the canon.", ...REFS.mental });
  } else if (fit >= 0.7) {
    const why: Record<PatternId, string> = {
      single: "One context could genuinely hold this whole task.",
      chain: "The task decomposes into fixed, knowable stages — chaining with gates trades latency for accuracy exactly as designed.",
      route: "Heterogeneous inputs are routing's home turf: classify once, then every downstream prompt stays focused.",
      parallel: "The shards were independent and known in advance — sectioning is the textbook call.",
      orch: "Subtasks couldn't be predicted up front, so a lead agent decomposing dynamically is what the pattern is for.",
      evalopt: "Clear criteria plus iteration-that-helps is precisely the evaluator–optimizer sweet spot.",
      agent: "Open-ended path, crisp success check — the canonical case for letting the model direct its own process.",
    };
    findings.push({ tone: "good", text: `Architecture follows task structure: ${why[cfg.pattern]}`, ...REFS.patterns });
  }

  if (fit <= 0.35) {
    const why: Record<PatternId, string> = {
      single: `One window swallowed a ${m.units}-step task whole — no gates, no isolation, nowhere to recover.`,
      chain: "Fixed stages presume you know the steps; this task kept rewriting its own plan.",
      route: "Routing needs heterogeneous inputs to sort; these all looked the same, so the classifier added cost and nothing else.",
      parallel: "Parallelization presumes independent, pre-known shards. This work was coupled — the shards needed each other's context.",
      orch: "An orchestrator earns its overhead when subtasks are unknowable; here they were sitting in plain sight.",
      evalopt: "The evaluator–optimizer loop needs crisp criteria to push against; without them it polishes noise.",
      agent: "Full autonomy on a task with a knowable path: you paid the wandering tax for nothing.",
    };
    findings.push({ tone: "bad", text: why[cfg.pattern], ...REFS.patterns });
  }

  if (m.units <= 2 && (cfg.pattern === "orch" || cfg.pattern === "parallel" || cfg.pattern === "route")) {
    findings.push({ tone: "bad", text: `You brought an orchestra to hum a jingle: ${patName} spent multiples of the tokens one call needed, for no quality gain.`, ...REFS.mental });
  }

  if (cfg.context === "preload" && preloadK > 25) {
    findings.push({ tone: "bad", text: `Kitchen-sink context: ${fmtK(preloadK)} preloaded and most of it never touched. Attention is a finite budget — every stale token competed with the signal on every single pass.`, ...REFS.context });
  }
  if (cfg.context === "jit" && m.units * m.load > 25) {
    findings.push({ tone: "good", text: "Just-in-time retrieval kept the window lean: paths and identifiers are cheap, contents were loaded only when needed.", ...REFS.context });
  }
  if (compactions > 0) {
    findings.push({ tone: "good", text: `Compaction fired ${compactions}× and preserved the trajectory — decisions and open items survived, the raw transcript didn't have to.`, ...REFS.context });
  }
  if (overflowed) {
    findings.push({ tone: "bad", text: "The window overflowed with compaction off. Long-horizon work needs a plan for what survives summarization — before it's needed.", ...REFS.context });
  }

  if (cfg.tools === "sprawl") {
    const nf = Math.max(1, Math.round(fumbles));
    findings.push({ tone: "bad", text: `41 overlapping tools produced ${nf} wrong-tool ${nf === 1 ? "retry" : "retries"}. If a human engineer would hesitate between two tools, the model will too.`, ...REFS.tools });
  } else {
    findings.push({ tone: "good", text: "Few, well-scoped tools: zero fumbles, and 7.5k of schema overhead avoided on every turn.", ...REFS.tools });
  }

  if (coupled) {
    findings.push({ tone: "bad", text: "Tightly coupled work sliced across isolated windows — the agents needed shared context they didn't have. Multi-agent wins breadth-first problems, not this.", ...REFS.multi });
  }
  if (cfg.pattern === "orch" && fit < 0.5) {
    findings.push({ tone: "note", text: "Multi-agent systems run ~15× the tokens of chat. That spend is a feature on high-value breadth-first work — and a bill everywhere else.", ...REFS.multi });
  }
  if (cfg.pattern === "agent" && m.verifiable <= 0.4) {
    findings.push({ tone: "note", text: "The agent graded its own homework. Don't let the model doing the work also judge it — separate generation from verification.", ...REFS.multi });
  }

  // --- grading against the best fit-for-purpose setup --------------------------------
  let recommended: SimResult["recommended"] = null;
  let grades = { quality: gradeQuality(quality), cost: "B", latency: "B" };
  let verdict = "";

  if (computeGrades) {
    let best: { r: SimResult; cfg: LabConfig } | null = null;
    for (const p of PATTERNS) {
      for (const ctx of ["jit", "preload"] as const) {
        const r = simulate(
          { mission: cfg.mission, pattern: p.id, context: ctx, compaction: true, tools: "lean" },
          false,
          missionOverride,
        );
        if (!best || r.quality > best.r.quality + 0.01 || (Math.abs(r.quality - best.r.quality) <= 0.01 && r.cost < best.r.cost)) {
          best = { r, cfg: { mission: cfg.mission, pattern: p.id, context: ctx, compaction: true, tools: "lean" } };
        }
      }
    }
    const b = best!;
    grades = {
      quality: gradeQuality(quality),
      cost: gradeRatio(cost / Math.max(1, b.r.cost)),
      latency: gradeRatio(latency / Math.max(1, b.r.latency)),
    };
    const sameSetup = b.cfg.pattern === cfg.pattern && b.cfg.context === cfg.context;
    if (!sameSetup && (b.r.quality > quality + 5 || cost / Math.max(1, b.r.cost) > 1.8)) {
      recommended = { pattern: b.cfg.pattern, context: b.cfg.context, compaction: true, quality: Math.round(b.r.quality), cost: Math.round(b.r.cost) };
    }

    const costRatio = cost / Math.max(1, b.r.cost);
    if (quality >= 85 && costRatio <= 1.6) verdict = "Clean run. This is the setup a staff engineer would pick.";
    else if (quality >= 85) verdict = `It shipped — at ${costRatio.toFixed(1)}× the price of the fit-for-purpose setup.`;
    else if (quality >= 70) verdict = "Serviceable, with visible scar tissue. The findings below are where the points went.";
    else if (quality >= 50) verdict = "It limped home. Several deliberate choices worked against this task's shape.";
    else verdict = "This run went sideways. Read the findings, then rebuild it setting by setting.";
  }

  return { config: cfg, events, quality: Math.round(quality), cost: Math.round(cost), latency: Math.round(latency * 10) / 10, grades, verdict, findings, recommended };
}

// ---------------------------------------------------------------------------
// Ghost runs — a lab configuration encoded into the URL hash, so a debrief
// can travel to a teammate who opens the link and watches the *same
// deterministic run* fly. Format:
//
//   #lab=1.<mission>.<pattern>.<context>.<compaction>.<tools>
//
// where <mission> is an index into MISSIONS — or "a" + the architect's eight
// trait digits (0–2, TRAITS order) for a mission synthesized from an
// interview — and the rest are indices into the option lists in this file.
// The codec lives beside those lists because the positions ARE the payload:
// same contract as share.ts's bit order — don't reorder or insert options
// without bumping the version, and decode old versions against a frozen
// order. The hash is untrusted input; every index is bounds-checked and no
// hash-sourced string is ever rendered as HTML (the payload is digits).
// ---------------------------------------------------------------------------

const LAB_CONTEXTS: Array<LabConfig["context"]> = ["preload", "jit"];
const LAB_TOOLS: Array<LabConfig["tools"]> = ["sprawl", "lean"];

export interface LabShare {
  cfg: LabConfig;
  /** eight architect trait digits when the mission came from an interview */
  arch?: string;
}

export function buildLabUrl(cfg: LabConfig, archDigits?: string): string {
  const mission = archDigits
    ? `a${archDigits}`
    : String(MISSIONS.findIndex((m) => m.id === cfg.mission));
  const parts = [
    mission,
    PATTERNS.findIndex((p) => p.id === cfg.pattern),
    LAB_CONTEXTS.indexOf(cfg.context),
    cfg.compaction ? 1 : 0,
    LAB_TOOLS.indexOf(cfg.tools),
  ];
  const base = location.href.split("#")[0];
  return `${base}#lab=1.${parts.join(".")}`;
}

export function readLabHash(): LabShare | null {
  const m = location.hash.match(/^#lab=1\.(a[0-2]{8}|\d{1,2})\.(\d{1,2})\.([01])\.([01])\.([01])$/);
  if (!m) return null;
  const arch = m[1].startsWith("a") ? m[1].slice(1) : undefined;
  const missionIdx = arch ? 0 : Number(m[1]);
  const patternIdx = Number(m[2]);
  if (!arch && missionIdx >= MISSIONS.length) return null;
  if (patternIdx >= PATTERNS.length) return null;
  const cfg: LabConfig = {
    // With an architect mission the id is a placeholder — the caller passes
    // the reconstructed mission as simulate()'s override, which ignores it.
    mission: arch ? "brief" : MISSIONS[missionIdx].id,
    pattern: PATTERNS[patternIdx].id,
    context: LAB_CONTEXTS[Number(m[3])],
    compaction: m[4] === "1",
    tools: LAB_TOOLS[Number(m[5])],
  };
  return { cfg, arch };
}
