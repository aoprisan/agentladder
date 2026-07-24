// ---------------------------------------------------------------------------
// The architect — a decision engine for *your* task, not a canned mission.
// Pure logic, no DOM (architectui.ts owns the UI).
//
// The reader answers eight trait questions about a real piece of work
// (scale, coupling, verifiability, stakes…). The engine synthesizes a
// Mission from the answers, scores all seven L1 patterns against it with
// labsim's own fit model, stress-tests each candidate through simulate(),
// and produces: a stance (call / workflow / agent / multi-agent), a ranked
// scoreboard with modeled quality/cost/latency, a context plan, a guardrail
// kit, and an exportable Markdown decision brief with a starter CLAUDE.md.
//
// Answers pack into a URL hash (#arch=1.<8 digits base 3>) so a team can
// debate an architecture decision by link — same no-backend contract as
// share.ts. Digit order = TRAITS order; bump the version if that changes.
// ---------------------------------------------------------------------------

import {
  PATTERNS,
  patternFit,
  simulate,
  type Mission,
  type PatternId,
} from "./labsim";

export type TraitKey =
  | "scale"
  | "load"
  | "coupling"
  | "known"
  | "open"
  | "verify"
  | "variance"
  | "stakes";

/** answers[key] is an option index 0–2 into that trait's options */
export type Answers = Record<TraitKey, number>;

export interface TraitQuestion {
  key: TraitKey;
  prompt: string;
  options: Array<{ label: string; hint: string }>;
}

export const TRAITS: TraitQuestion[] = [
  {
    key: "scale",
    prompt: "How many separate pieces of work is this, roughly?",
    options: [
      { label: "One deliverable", hint: "a single artifact — an email, a fix, an answer" },
      { label: "A handful", hint: "around 5–8 pieces you could name" },
      { label: "Dozens or more", hint: "30+ pieces — a queue, a sweep, a migration" },
    ],
  },
  {
    key: "load",
    prompt: "How much material does each piece drag in?",
    options: [
      { label: "A paragraph or two", hint: "the task statement is most of it" },
      { label: "A few pages", hint: "some docs, a file or two, a runbook" },
      { label: "A small corpus", hint: "many sources, dumps, or long transcripts each" },
    ],
  },
  {
    key: "coupling",
    prompt: "Could two people work the pieces without talking to each other?",
    options: [
      { label: "No — tightly coupled", hint: "every piece leans on decisions made in the others" },
      { label: "Somewhat", hint: "occasional sync points, mostly separable" },
      { label: "Yes — fully independent", hint: "no shared state between pieces" },
    ],
  },
  {
    key: "known",
    prompt: "Can you list the subtasks before starting?",
    options: [
      { label: "Yes, completely", hint: "the checklist could be written today" },
      { label: "Roughly", hint: "the list will shift as work reveals things" },
      { label: "No — they surface as you go", hint: "discovery is part of the work" },
    ],
  },
  {
    key: "open",
    prompt: "Could you script the steps in advance?",
    options: [
      { label: "Yes — near-mechanical", hint: "a competent intern with a checklist could do it" },
      { label: "Some judgment en route", hint: "the path is clear, the calls aren't" },
      { label: "No — genuinely exploratory", hint: "hypotheses, dead ends, revised plans" },
    ],
  },
  {
    key: "verify",
    prompt: "How would you know the result is right?",
    options: [
      { label: "A machine can check it", hint: "tests pass, it typechecks, the thing runs" },
      { label: "A rubric or partial checks", hint: "criteria exist but need interpretation" },
      { label: "Taste and judgment only", hint: "you'll know it when you see it" },
    ],
  },
  {
    key: "variance",
    prompt: "Do the inputs come in distinct flavors?",
    options: [
      { label: "All alike", hint: "one kind of input, one register" },
      { label: "A few kinds", hint: "several recognizable categories" },
      { label: "Wildly mixed", hint: "refunds next to legal threats next to bug reports" },
    ],
  },
  {
    key: "stakes",
    prompt: "If a wrong result slips through, what's the damage?",
    options: [
      { label: "Annoying", hint: "easy to catch, cheap to redo" },
      { label: "Expensive", hint: "rework, real money, credibility" },
      { label: "Dangerous", hint: "irreversible, public, or compliance-shaped" },
    ],
  },
];

// Option index → the Mission attribute it encodes.
const SCALE_UNITS = [1, 6, 30];
const LOAD_K = [1, 3, 7];
const COUPLING = [0.1, 0.5, 0.95];
const KNOWN = [0.95, 0.55, 0.15];
const OPEN = [0.1, 0.5, 0.9];
const VERIFY = [0.95, 0.5, 0.15];
const VARIANCE = [0.05, 0.5, 0.9];

export const DEFAULT_ANSWERS: Answers = {
  scale: 1,
  load: 1,
  coupling: 1,
  known: 1,
  open: 1,
  verify: 1,
  variance: 1,
  stakes: 1,
};

export function missionFromAnswers(a: Answers): Mission {
  return {
    // id is required by the type but ignored everywhere the architect passes
    // this mission — always as simulate()'s missionOverride.
    id: "brief",
    name: "Your task",
    brief: "Profiled by the architect from your eight answers.",
    unitNoun: "pieces",
    units: SCALE_UNITS[a.scale],
    load: LOAD_K[a.load],
    decomposable: COUPLING[a.coupling],
    known: KNOWN[a.known],
    verifiable: VERIFY[a.verify],
    open: OPEN[a.open],
    variance: VARIANCE[a.variance],
    agentFlavor: [
      "orients: inventories what's lying around, sketches a plan",
      "works a piece, checks an assumption mid-flight, adjusts",
      "hits a surprise the plan didn't cover — re-plans and continues",
    ],
  };
}

export interface PatternScore {
  pattern: PatternId;
  name: string;
  fit: number; // 0–1 from labsim's fit model
  quality: number; // modeled, best of jit/preload with compaction + lean tools
  cost: number; // k tokens
  latency: number; // sim-minutes
  context: "jit" | "preload";
  why: string;
}

export type Tier = "call" | "workflow" | "agent" | "multi";

export interface GuardrailItem {
  text: string;
  sectionId: string;
  label: string;
}

export interface ArchitectVerdict {
  answers: Answers;
  mission: Mission;
  ranked: PatternScore[]; // best first
  top: PatternScore;
  tier: Tier;
  stance: string;
  contextPlan: string[];
  guardrails: GuardrailItem[];
  projectedLoadK: number;
}

function rationale(p: PatternId, m: Mission, fit: number): string {
  const strong = fit >= 0.6;
  switch (p) {
    case "single":
      return strong
        ? "One context can genuinely hold this whole task — the simplest thing that works."
        : m.units > 8
          ? `One window would swallow ${m.units} pieces whole — no gates, no isolation, nowhere to recover.`
          : "The task's open-endedness outgrows a single pass.";
    case "chain":
      return strong
        ? "The stages are knowable in advance, so fixed steps with programmatic gates trade latency for accuracy exactly as designed."
        : "Fixed stages presume you know the steps; this task would keep rewriting its own plan.";
    case "route":
      return strong
        ? "Heterogeneous inputs are routing's home turf: classify once cheaply, keep every downstream prompt focused."
        : "The inputs look alike — a classifier would add cost and sort nothing.";
    case "parallel":
      return strong
        ? "The shards are independent and known up front — sectioning into isolated windows is the textbook call."
        : m.decomposable < 0.4
          ? "The pieces are coupled; sliced across isolated windows they'd starve for each other's context."
          : "Too few pre-known shards for the fan-out to pay for itself.";
    case "orch":
      return strong
        ? "Subtasks can't be predicted up front, so a lead agent decomposing dynamically and delegating is what this pattern is for."
        : "An orchestrator earns its overhead when subtasks are unknowable; here they're sitting in plain sight.";
    case "evalopt":
      return strong
        ? "Clear criteria plus iteration-that-helps — precisely the evaluator–optimizer sweet spot."
        : "Without crisp criteria to push against, critic and generator argue in circles and polish noise.";
    case "agent":
      return strong
        ? "The path can't be scripted and a check exists to keep the loop honest — the canonical case for autonomy."
        : m.open < 0.4
          ? "The path is knowable — full autonomy would just pay the wandering tax."
          : "Open-ended path but no crisp check: the agent would grade its own homework.";
  }
}

const L = {
  mental: { sectionId: "mental-model", label: "L0 · The mental model" },
  patterns: { sectionId: "patterns", label: "L1 · The five composable patterns" },
  context: { sectionId: "context", label: "L2 · Context engineering" },
  tools: { sectionId: "tool-design", label: "L3 · Tool design" },
  code: { sectionId: "claude-code", label: "L4 · Claude Code as a harness" },
  multi: { sectionId: "multi-agent", label: "L5 · Multi-agent systems" },
  prod: { sectionId: "production", label: "L7 · Production hardening" },
};

export function assess(a: Answers): ArchitectVerdict {
  const m = missionFromAnswers(a);

  const ranked: PatternScore[] = PATTERNS.map((p) => {
    let best: PatternScore | null = null;
    for (const ctx of ["jit", "preload"] as const) {
      const r = simulate(
        { mission: "brief", pattern: p.id, context: ctx, compaction: true, tools: "lean" },
        false,
        m,
      );
      const s: PatternScore = {
        pattern: p.id,
        name: p.name,
        fit: patternFit(p.id, m),
        quality: r.quality,
        cost: r.cost,
        latency: r.latency,
        context: ctx,
        why: "",
      };
      if (!best || s.quality > best.quality || (s.quality === best.quality && s.cost < best.cost)) {
        best = s;
      }
    }
    best!.why = rationale(p.id, m, best!.fit);
    return best!;
  }).sort((x, y) =>
    Math.abs(x.quality - y.quality) <= 2 ? x.cost - y.cost : y.quality - x.quality,
  );

  const top = ranked[0];
  const tier: Tier =
    top.pattern === "single"
      ? "call"
      : top.pattern === "agent"
        ? "agent"
        : top.pattern === "orch"
          ? "multi"
          : "workflow";

  const lowVerify = a.verify === 2;
  const stance =
    tier === "call"
      ? "You don't need an agent. One well-prompted call with retrieval covers this — the simplest solution is the whole answer here."
      : tier === "workflow"
        ? "This is a workflow, not an agent: enough of the path is knowable that code should decide the steps and the model should fill them in."
        : tier === "agent"
          ? lowVerify
            ? "This earns autonomy — the path can't be scripted — but with no crisp check, pair the loop with a separate evaluator or it will grade its own homework."
            : "This one earns autonomy: the path can't be scripted, and a crisp check exists to keep the loop honest."
          : "This decomposes into work a lead agent should delegate to parallel workers. Budget accordingly — multi-agent runs ~15× the tokens of chat, a fair price only when task value covers it.";

  // --- context plan ---------------------------------------------------------
  const projectedLoadK = Math.round(m.units * m.load);
  const contextPlan: string[] = [];
  if (projectedLoadK > 40) {
    contextPlan.push(
      `Projected working set ≈${projectedLoadK}k tokens — just-in-time retrieval is mandatory; preloading would rot the window before the halfway mark.`,
    );
  } else if (projectedLoadK > 12) {
    contextPlan.push(
      `≈${projectedLoadK}k of material in play: start from a curated primer and fetch the rest just-in-time — paths and identifiers are cheap, contents are expensive.`,
    );
  } else {
    contextPlan.push(
      `Small working set (≈${projectedLoadK}k) — a curated preload is fine here; don't over-engineer retrieval.`,
    );
  }
  if (projectedLoadK > 100 || (a.scale === 2 && a.open >= 1)) {
    contextPlan.push(
      "This is long-horizon work: turn compaction on and decide up front what must survive it — decisions and rationale, modified files, error→fix pairs, open items.",
    );
  }
  if (a.coupling === 2 && a.scale >= 1) {
    contextPlan.push(
      "Independent pieces → isolated context windows. Push each piece's exploration into its own window and let only a condensed summary return; failed attempts stay quarantined.",
    );
  }
  if (a.scale === 2) {
    contextPlan.push(
      "Keep a ledger file of per-piece status outside the context window — every fresh session (or fresh window) picks it up cold and knows exactly where the work stands.",
    );
  }

  // --- guardrail kit --------------------------------------------------------
  const guardrails: GuardrailItem[] = [];
  if (a.stakes === 2) {
    guardrails.push({
      text: "Dangerous failure mode → run it sandboxed: container or VM, scoped permissions, network allowlist, read-only mounts for anything precious.",
      ...L.prod,
    });
    guardrails.push({
      text: "Gate every side-effecting tool behind an allowlist or human approval. Autonomy ends where irreversibility begins.",
      ...L.prod,
    });
  }
  if (a.stakes >= 1) {
    guardrails.push({
      text: "Policy that must hold every time goes in hooks, not instructions — hooks are executed by the harness, not interpreted by the model.",
      ...L.code,
    });
  }
  if (a.verify === 0) {
    guardrails.push({
      text: "A machine-checkable result is your multiplier: wire the check in as a gate the agent runs itself before it's allowed to declare victory.",
      ...L.code,
    });
  } else if (lowVerify) {
    guardrails.push({
      text: "No crisp check exists, so separate generation from verification: a fresh-context evaluator with a written rubric. Never let the model doing the work grade it.",
      ...L.multi,
    });
  }
  if (a.variance === 2) {
    guardrails.push({
      text: "Wildly mixed inputs: put a cheap-model classifier up front — routing is the natural place for cost control even inside a bigger architecture.",
      ...L.patterns,
    });
  }
  if (a.scale === 2 && a.stakes >= 1) {
    guardrails.push({
      text: "Many pieces + real stakes: add verification gates between batches or sessions so a regression is caught before it compounds across the rest.",
      ...L.prod,
    });
  }
  guardrails.push({
    text: "Before scaling autonomy, build a ~20-task eval from real inputs. Small samples reveal large effects in agentic systems.",
    ...L.prod,
  });
  guardrails.push({
    text: "Keep the tool surface lean — few, well-scoped tools with prompt-quality descriptions. If a human would hesitate between two tools, the model will too.",
    ...L.tools,
  });

  return { answers: a, mission: m, ranked, top, tier, stance, contextPlan, guardrails, projectedLoadK };
}

// ---------------------------------------------------------------------------
// Markdown decision brief — the exportable artifact.
// ---------------------------------------------------------------------------

const strip = (html: string): string => html.replace(/<[^>]+>/g, "");

export function buildBrief(v: ArchitectVerdict): string {
  const a = v.answers;
  const profile = TRAITS.map(
    (t) => `- **${strip(t.prompt)}** ${t.options[a[t.key]].label} — ${t.options[a[t.key]].hint}`,
  ).join("\n");

  const board = v.ranked
    .slice(0, 4)
    .map(
      (s, i) =>
        `| ${i + 1} | ${s.name} | ${Math.round(s.fit * 100)}% | ${s.quality}% | ${s.cost}k | ${Math.round(s.latency)}m |`,
    )
    .join("\n");

  const guardrails = v.guardrails.map((g) => `- [ ] ${g.text} *(${g.label})*`).join("\n");
  const context = v.contextPlan.map((c) => `- ${c}`).join("\n");

  const done =
    a.verify === 0
      ? "- The crisp check passes (tests / typecheck / the thing runs) — run it yourself before declaring victory."
      : a.verify === 1
        ? "- The written rubric below is satisfied; a separate evaluator pass has scored the result against it."
        : "- A fresh-context evaluator (not you) has reviewed the result against the rubric and signed off.";

  const boundaries =
    a.stakes === 2
      ? `## Boundaries
- Run sandboxed; side-effecting actions require explicit approval.
- Never touch production data or credentials; network access is allowlisted.`
      : a.stakes === 1
        ? `## Boundaries
- Destructive or outward-facing actions require approval first.`
        : "";

  const delegation =
    v.tier === "multi"
      ? `## Delegation rules (orchestrator)
- Every delegated task states: objective, output format, tool guidance, boundaries.
- Scale effort to the task — no fan-out for one-line questions.
- Workers return condensed summaries, not transcripts.`
      : "";

  const starter = `# CLAUDE.md — starter (generated by the architect)

## Commands
- build: <fill in>
- check: <fill in — the crisp check; the agent runs this before claiming done>

## Definition of done
${done}

## Compaction policy
When summarizing, always preserve: decisions and their rationale, modified
files, error→fix pairs, open items. The raw transcript may go.
${boundaries ? `\n${boundaries}\n` : ""}${delegation ? `\n${delegation}\n` : ""}`;

  const runner = v.ranked[1];

  return `# Architecture decision brief

*Generated by the [Agentic Workflows guide](https://github.com/aoprisan/agentladder)'s architect — a deterministic model of the guide's claims, not a measurement. Re-verify version-specific details against the official docs.*

## Task profile
${profile}

## Stance
${v.stance}

**Recommended pattern: ${v.top.name}** — modeled at ${v.top.quality}% quality for ${v.top.cost}k tokens with ${v.top.context === "jit" ? "curated + just-in-time context" : "a curated preload"}, compaction on, lean tools.
${v.top.why}

Runner-up: **${runner.name}** (${runner.quality}% / ${runner.cost}k) — ${runner.why}

## Scoreboard (modeled)
| # | pattern | fit | quality | tokens | wall clock |
|---|---------|-----|---------|--------|------------|
${board}

## Context plan
${context}

## Guardrail kit
${guardrails}

## Starter CLAUDE.md
\`\`\`markdown
${starter}\`\`\`

## Build sequence
1. Ship the smallest honest version: ${v.tier === "call" ? "one well-prompted call with retrieval — measure before adding anything." : `the ${v.top.name.toLowerCase()} skeleton with stub tools and one real input.`}
2. Wire in verification${a.verify === 0 ? " (the machine check) as a gate the agent runs itself" : ": write the rubric down and stand up a separate evaluator"}.
3. Run the ~20-task eval; read the transcripts; fix tools and prompts where the agent stumbles.
4. Only then add autonomy or fan-out — and only if the eval says it measurably helps.
`;
}

// ---------------------------------------------------------------------------
// Share-hash — answers travel by URL: #arch=1.<8 digits 0–2, TRAITS order>.
// ---------------------------------------------------------------------------

export function encodeAnswers(a: Answers): string {
  return TRAITS.map((t) => String(a[t.key])).join("");
}

export function buildArchUrl(a: Answers): string {
  const base = location.href.split("#")[0];
  return `${base}#arch=1.${encodeAnswers(a)}`;
}

export function readArchHash(): Answers | null {
  const m = location.hash.match(/^#arch=1\.([0-2]{8})$/);
  if (!m) return null;
  const digits = m[1];
  const a = { ...DEFAULT_ANSWERS };
  TRAITS.forEach((t, i) => {
    a[t.key] = Number(digits[i]);
  });
  return a;
}
