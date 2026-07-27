// ---------------------------------------------------------------------------
// The bench — a static review engine for the artifacts this guide is actually
// about: a CLAUDE.md, an agent prompt, a tool or subagent description. Pure
// logic, no DOM (bench.ts owns the UI). Nothing leaves the device; the engine
// is regex and counting, all of it running in the tab.
//
// Why this exists: everything else here teaches by simulation. This is the one
// surface where a reader brings in a real file they maintain and gets the
// guide's rules applied to it, line by line. That makes the guide a thing you
// open on a Tuesday, not a thing you read once.
//
// Design rules for the rule set itself, learned the hard way:
//   * Every finding cites the section that justifies it. A linter that can't
//     say why is just an opinion with a line number.
//   * Every finding carries a concrete fix, not a diagnosis.
//   * Heuristics are honest about being heuristics — the UI says so, and
//     severity is capped accordingly. Absence of a keyword is weak evidence,
//     so keyword-absence rules never exceed "block" on the things that are
//     genuinely load-bearing (a verification command, a success criterion).
//
// The rules encode the guide's claims. When a section's claims change,
// re-check the rules pointed at it.
// ---------------------------------------------------------------------------

import { estimateTokens } from "./tokens";

export type ArtifactKind = "claude-md" | "prompt" | "tool";

export type Severity = "block" | "warn" | "note";

export interface Finding {
  rule: string;
  title: string;
  severity: Severity;
  /** 1-based source line, or 0 for a whole-document finding. */
  line: number;
  excerpt: string;
  detail: string;
  fix: string;
  ref: string; // section id
}

export interface Metrics {
  chars: number;
  lines: number;
  approxTokens: number;
  headings: number;
  fences: number;
  commands: number;
}

export interface Review {
  kind: ArtifactKind;
  findings: Finding[];
  strengths: string[];
  metrics: Metrics;
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
}

export const KINDS: Array<{ id: ArtifactKind; name: string; blurb: string }> = [
  {
    id: "claude-md",
    name: "CLAUDE.md",
    blurb: "The project memory file every session loads before it does anything.",
  },
  {
    id: "prompt",
    name: "agent prompt",
    blurb: "A task you hand to an agent — the brief, the constraints, the definition of done.",
  },
  {
    id: "tool",
    name: "tool / subagent description",
    blurb: "The text the model reads when deciding whether to call this thing.",
  },
];

// ---------------------------------------------------------------------------
// Document model
// ---------------------------------------------------------------------------

interface Doc {
  text: string;
  lines: string[];
  /** lowercased text with fenced code stripped — most rules read prose, not code */
  prose: string;
  fenceLangs: string[];
  unlabeledFences: number[]; // 1-based line numbers of ``` with no language
  headings: number[]; // 1-based line numbers
  /** 1-based line numbers inside a fenced block */
  inFence: Set<number>;
  approxTokens: number;
}

function parse(text: string): Doc {
  const lines = text.split(/\r?\n/);
  const fenceLangs: string[] = [];
  const unlabeledFences: number[] = [];
  const headings: number[] = [];
  const inFence = new Set<number>();
  const proseLines: string[] = [];

  let open = false;
  lines.forEach((raw, i) => {
    const n = i + 1;
    const fence = /^\s*```(\S*)/.exec(raw);
    if (fence) {
      if (!open) {
        fenceLangs.push(fence[1]);
        if (!fence[1]) unlabeledFences.push(n);
      }
      open = !open;
      inFence.add(n);
      return;
    }
    if (open) {
      inFence.add(n);
      return;
    }
    if (/^#{1,6}\s+\S/.test(raw)) headings.push(n);
    proseLines.push(raw);
  });

  return {
    text,
    lines,
    prose: proseLines.join("\n").toLowerCase(),
    fenceLangs,
    unlabeledFences,
    headings,
    inFence,
    // Same estimator the token meter uses (PW), so the bench and the meter
    // never disagree about the same file. Precision isn't the point — making
    // an invisible recurring cost visible is.
    approxTokens: estimateTokens(text),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clip(s: string, n = 96): string {
  const t = s.trim().replace(/\s+/g, " ");
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

/** First matching line, skipping fenced code unless includeCode. */
function firstLine(
  doc: Doc,
  re: RegExp,
  includeCode = false,
): { line: number; excerpt: string } | null {
  for (let i = 0; i < doc.lines.length; i++) {
    const n = i + 1;
    if (!includeCode && doc.inFence.has(n)) continue;
    if (re.test(doc.lines[i])) return { line: n, excerpt: clip(doc.lines[i]) };
  }
  return null;
}

/** All matching lines (capped), skipping fenced code unless includeCode. */
function allLines(
  doc: Doc,
  re: RegExp,
  cap = 4,
  includeCode = false,
): Array<{ line: number; excerpt: string }> {
  const out: Array<{ line: number; excerpt: string }> = [];
  for (let i = 0; i < doc.lines.length && out.length < cap; i++) {
    const n = i + 1;
    if (!includeCode && doc.inFence.has(n)) continue;
    if (re.test(doc.lines[i])) out.push({ line: n, excerpt: clip(doc.lines[i]) });
  }
  return out;
}

const has = (doc: Doc, re: RegExp): boolean => re.test(doc.prose);

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

interface Rule {
  id: string;
  kinds: ArtifactKind[];
  run(doc: Doc): Finding[];
}

const ALL: ArtifactKind[] = ["claude-md", "prompt", "tool"];

const CMD_WORDS =
  "npm|pnpm|yarn|bun|npx|just|make|cargo|go|uv|poetry|pip|pytest|jest|vitest|tsc|eslint|ruff|mypy|gradle|mvn|dotnet|rake|bundle|docker|terraform";

/**
 * A command has to be at the *start* of something to count. Matching the bare
 * word anywhere in prose reads "ALWAYS make sure your code is correct" as a
 * build command and hands the file credit for being runnable when it isn't —
 * which is exactly backwards, since that file's real problem is having no
 * commands at all. So: start of line (after a `$`, `>` or list marker), or
 * inside an inline code span.
 */
const CMD_START_RE = new RegExp(`^\\s*(?:[$>]\\s+|[-*]\\s+)?\`?(?:${CMD_WORDS})\\s+\\S`);
const CMD_INLINE_RE = new RegExp(`\`\\s*(?:${CMD_WORDS})\\s+[^\`]+\``);

const isCommandLine = (raw: string): boolean =>
  CMD_START_RE.test(raw) || CMD_INLINE_RE.test(raw);

/** 1-based line numbers that carry a runnable command, code fences included. */
function commandLines(doc: Doc): number[] {
  const out: number[] = [];
  doc.lines.forEach((raw, i) => {
    if (isCommandLine(raw)) out.push(i + 1);
  });
  return out;
}

const VERIFY_RE =
  /\b(test|tests|typecheck|type-check|tsc|lint|linter|build|verify|verification|check|checks|ci|assert|golden|snapshot)\b/;

/**
 * Prose that tries to defend against prompt injection by instructing the model
 * not to obey injected instructions. The sentence is fine to write; treating it
 * as the control is the mistake the finding names — so this pairs with
 * UNTRUSTED_NOUN_RE on the same line to keep it off ordinary "ignore the old
 * instructions in X" prose.
 */
const INJECTION_DEFENSE_RE =
  /\b(?:ignore|disregard|do not (?:follow|obey)|don'?t (?:follow|obey)|never (?:follow|obey))\b[^.\n]{0,60}\b(?:instructions?|commands?|directives?|prompts?)\b/i;

const UNTRUSTED_NOUN_RE =
  /\b(?:untrusted|external|fetched|web ?pages?|urls?|issues?|tickets?|emails?|comments?|tool (?:results?|output)|scraped|third[- ]party)\b/i;

/** Ways an artifact can tell someone to turn the permission layer off. */
const BYPASS_RE =
  /--dangerously-skip-permissions|dangerouslyDisableSandbox|["']?bypassPermissions["']?/i;

const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/sk-ant-[A-Za-z0-9_-]{8,}/, "an Anthropic API key"],
  [/\bAKIA[0-9A-Z]{12,}/, "an AWS access key id"],
  [/\bgh[pousr]_[A-Za-z0-9]{16,}/, "a GitHub token"],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}/, "a Slack token"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "a private key"],
  [/\b(api[_-]?key|secret|token|passwd|password)\s*[:=]\s*["']?[A-Za-z0-9/+_-]{16,}/i, "a credential"],
];

const RULES: Rule[] = [
  // --- any artifact -------------------------------------------------------
  {
    id: "secret-in-context",
    kinds: ALL,
    run(doc) {
      const out: Finding[] = [];
      // One finding per line, not per pattern: a single `API_KEY=sk-ant-…`
      // trips both the vendor-specific and the generic rule, and reporting it
      // twice makes the reader think there are two keys.
      const flagged = new Set<number>();
      for (const [re, what] of SECRET_PATTERNS) {
        for (let i = 0; i < doc.lines.length; i++) {
          if (flagged.has(i)) continue;
          const m = re.exec(doc.lines[i]);
          if (!m) continue;
          flagged.add(i);
          out.push({
            rule: "secret-in-context",
            title: "A credential is sitting in the context",
            severity: "block",
            line: i + 1,
            // Never echo the match — this review can be exported and pasted.
            excerpt: doc.lines[i].replace(m[0], "«redacted»").trim().slice(0, 96),
            detail: `This line looks like ${what}. Anything in this file is in the model's context on every single run, which means it is in every transcript, every log line, and every artifact anyone exports — including this review.`,
            fix: "Move it to an environment variable and reference the variable name here. Then rotate it: assume it is already compromised.",
            ref: "hardening",
          });
          break; // one finding per pattern is enough to make the point
        }
      }
      return out;
    },
  },
  // NOTE: the context-budget rule lives outside this array — it needs the
  // artifact kind, which Rule.run doesn't receive. See contextBudget() below.
  {
    id: "prompt-only-injection-defense",
    kinds: ALL,
    run(doc) {
      const out: Finding[] = [];
      for (let i = 0; i < doc.lines.length && out.length < 2; i++) {
        const n = i + 1;
        if (doc.inFence.has(n)) continue;
        const raw = doc.lines[i];
        // Both halves have to be on the same line, or "ignore the instructions
        // in the legacy README" three paragraphs from the word "web" trips it.
        if (!INJECTION_DEFENSE_RE.test(raw) || !UNTRUSTED_NOUN_RE.test(raw)) continue;
        out.push({
          rule: "prompt-only-injection-defense",
          title: "Injection defence written as an instruction",
          severity: "note",
          line: n,
          excerpt: clip(raw),
          detail:
            "This tells the model to disregard instructions arriving in untrusted content — which means it is a sentence competing with the attacker's sentence in the same undifferentiated token stream, and theirs is more recent and more specific. Worth keeping; not worth counting. The line is a mitigation, and a posture built out of mitigations has no floor.",
          fix: "Keep the sentence, then put the actual control somewhere the model cannot argue with it: a deny rule on the tool the attack needs, a PreToolUse hook that sees the arguments, or an egress allowlist that turns the exfiltration into a failed lookup.",
          ref: "hardening",
        });
      }
      return out;
    },
  },
  {
    id: "permission-bypass",
    kinds: ALL,
    run(doc) {
      const hits = allLines(doc, BYPASS_RE, 2, true);
      return hits.map((h) => ({
        rule: "permission-bypass",
        title: "Permission bypass baked into the artifact",
        severity: "warn" as Severity,
        line: h.line,
        excerpt: h.excerpt,
        detail:
          "This file tells whoever reads it — a person or the agent — to run with the permission layer switched off. Skipping permissions also skips protected-path checks, so the files an attacker most wants to edit stop being special at the same moment. Written down in a shared artifact, it becomes the default everyone copies, including into the deployments where nobody is watching.",
        fix: "Scope it to an environment that can afford it: a container holding no credentials and nothing you would miss. If the goal was fewer prompts rather than fewer boundaries, reach for the sandbox with an egress allowlist, or an explicit allow list for the commands that keep interrupting.",
        ref: "hardening",
      }));
    },
  },
  {
    id: "vague-quality-words",
    kinds: ALL,
    run(doc) {
      const re =
        /\b(clean code|best practices?|properly|appropriately|as (?:needed|appropriate)|high[- ]quality|idiomatic|elegant|robust|production[- ]ready|make it nice|good code)\b/i;
      const hits = allLines(doc, re, 3);
      if (hits.length === 0) return [];
      return hits.map((h) => ({
        rule: "vague-quality-words",
        title: "Unfalsifiable instruction",
        severity: "warn" as Severity,
        line: h.line,
        excerpt: h.excerpt,
        detail:
          "An instruction the agent cannot check itself against is decoration. \"Follow best practices\" excludes no action — there is no edit it would prevent and no output it would reject, so it costs tokens and changes nothing.",
        fix: "Replace it with the rule you actually mean, in a form something can fail: a command that must exit zero, a file that must not change, a shape the output must have.",
        ref: "context",
      }));
    },
  },
  {
    id: "hedged-instruction",
    kinds: ALL,
    run(doc) {
      const re =
        /\b(try to|if possible|feel free to|you may want to|ideally|probably should|where possible|when in doubt,? use your (?:best )?judg?ement|consider(?:ing)? maybe)\b/i;
      const hits = allLines(doc, re, 3);
      if (hits.length === 0) return [];
      return hits.map((h) => ({
        rule: "hedged-instruction",
        title: "Hedged instruction reads as optional",
        severity: "note" as Severity,
        line: h.line,
        excerpt: h.excerpt,
        detail:
          "Hedges are how humans stay polite with each other, and they transfer badly: an instruction phrased as a preference gets weighed against every other pressure in the run, and under load it loses.",
        fix: "If it is a requirement, say it as one. If it genuinely is a preference, say what should win when it conflicts with something else.",
        ref: "context",
      }));
    },
  },
  {
    id: "absolutes-inflation",
    kinds: ALL,
    run(doc) {
      const shouted = doc.text.match(/\b(ALWAYS|NEVER|MUST|CRITICAL|IMPORTANT|REQUIRED)\b/g) ?? [];
      if (shouted.length < 8) return [];
      return [
        {
          rule: "absolutes-inflation",
          title: `${shouted.length} shouted absolutes`,
          severity: "note",
          line: firstLine(doc, /\b(ALWAYS|NEVER|MUST|CRITICAL|IMPORTANT|REQUIRED)\b/)?.line ?? 0,
          excerpt: `${shouted.length} × ALWAYS / NEVER / MUST / CRITICAL`,
          detail:
            "Emphasis is a currency and this file has printed a lot of it. When most instructions are marked critical, none of them are — the markers stop carrying information and the genuinely load-bearing rules lose the only signal that distinguished them.",
          fix: "Pick the two or three rules that would actually cause damage if broken and reserve emphasis for those. Let the rest be ordinary sentences.",
          ref: "context",
        },
      ];
    },
  },
  {
    id: "unlabeled-fence",
    kinds: ALL,
    run(doc) {
      if (doc.unlabeledFences.length === 0) return [];
      return [
        {
          rule: "unlabeled-fence",
          title: `${doc.unlabeledFences.length} code block${doc.unlabeledFences.length === 1 ? "" : "s"} without a language`,
          severity: "note",
          line: doc.unlabeledFences[0],
          excerpt: "```",
          detail:
            "An unlabelled fence makes the model guess whether it is looking at shell, a config file, or output it should not run. The guess is usually right and occasionally expensive.",
          fix: "Tag the fence — ```sh, ```ts, ```json. If the block is example *output* rather than something to run, say so in the line above it.",
          ref: "tool-design",
        },
      ];
    },
  },
  {
    id: "stale-marker",
    kinds: ALL,
    run(doc) {
      const hits = allLines(doc, /\b(TODO|FIXME|XXX|TBD)\b|<your[- ]|\blorem ipsum\b|\[placeholder\]/i, 3, true);
      if (hits.length === 0) return [];
      return hits.map((h) => ({
        rule: "stale-marker",
        title: "Unfinished marker left in",
        severity: "note" as Severity,
        line: h.line,
        excerpt: h.excerpt,
        detail:
          "The agent has no way to know this is a note-to-self rather than an instruction, and it will occasionally act on it — filling in the placeholder with something plausible and moving on.",
        fix: "Finish it or delete it. If it is genuinely open, phrase it as a question the agent should ask rather than a blank it should fill.",
        ref: "context",
      }));
    },
  },
  {
    id: "wall-of-text",
    kinds: ALL,
    run(doc) {
      let start = 0;
      let len = 0;
      for (let i = 0; i <= doc.lines.length; i++) {
        const raw = i < doc.lines.length ? doc.lines[i] : "";
        const blank = raw.trim() === "";
        if (blank || i === doc.lines.length || doc.inFence.has(i + 1)) {
          if (len > 600) {
            return [
              {
                rule: "wall-of-text",
                title: "Unbroken block of prose",
                severity: "warn" as Severity,
                line: start,
                excerpt: clip(doc.lines[start - 1] ?? ""),
                detail: `About ${len} characters with no break. Structure is how a model scopes attention — an unbroken block gets read as one undifferentiated lump, and the constraint buried in the middle of it is the one that gets dropped.`,
                fix: "Break it into a heading and a short list. One rule per line beats one paragraph containing five rules.",
                ref: "context",
              },
            ];
          }
          len = 0;
          start = 0;
        } else {
          if (len === 0) start = i + 1;
          len += raw.length;
        }
      }
      return [];
    },
  },

  // --- CLAUDE.md ----------------------------------------------------------
  {
    id: "no-commands",
    kinds: ["claude-md"],
    run(doc) {
      if (commandLines(doc).length > 0) return [];
      return [
        {
          rule: "no-commands",
          title: "No runnable command anywhere in the file",
          severity: "block",
          line: 0,
          excerpt: "—",
          detail:
            "There is no build, test, or run command here. That means every session begins by rediscovering how to execute this project, usually by guessing at a package manager — and an agent that cannot run the project cannot check its own work.",
          fix: "Add a short commands block near the top: the install, the dev loop, the test, the typecheck. Exact invocations, copy-pasteable, no prose between them.",
          ref: "claude-code",
        },
      ];
    },
  },
  {
    id: "no-verification-gate",
    kinds: ["claude-md"],
    run(doc) {
      if (has(doc, VERIFY_RE) || firstLine(doc, VERIFY_RE, true)) return [];
      return [
        {
          rule: "no-verification-gate",
          title: "Nothing states how work gets verified",
          severity: "block",
          line: 0,
          excerpt: "—",
          detail:
            "No test, typecheck, lint, or build is named. The single highest-leverage thing this file can carry is the sentence that tells an agent how to find out whether it succeeded — without it, every run ends on self-report, which is the failure mode behind most of the incidents in the black box.",
          fix: "Name the gate explicitly: \"`npm run build` runs tsc then vite build — the typecheck is the gate. Run it before claiming a change works.\"",
          ref: "mental-model",
        },
      ];
    },
  },
  {
    id: "no-structure-map",
    kinds: ["claude-md"],
    run(doc) {
      if (has(doc, /(^|\s)[\w.-]+\/[\w./-]+|\bsrc\b|\barchitecture\b|\blayout\b|\bdirector(?:y|ies)\b/m)) {
        return [];
      }
      return [
        {
          rule: "no-structure-map",
          title: "No map of the codebase",
          severity: "warn",
          line: 0,
          excerpt: "—",
          detail:
            "Nothing here names a file or a directory. Rediscovering the layout is the most expensive thing a fresh session does, it happens every single time, and the result is thrown away when the session ends.",
          fix: "Add five or six lines naming the modules that matter and what each one owns. Not a file tree — a sentence per part, with the paths in it.",
          ref: "context",
        },
      ];
    },
  },
  {
    id: "no-negative-space",
    kinds: ["claude-md", "prompt"],
    run(doc) {
      if (has(doc, /\b(do not|don't|never|avoid|refrain|stop short of|out of scope|non-goals?)\b/)) {
        return [];
      }
      return [
        {
          rule: "no-negative-space",
          title: "No boundaries stated",
          severity: "warn",
          line: 0,
          excerpt: "—",
          detail:
            "Every instruction here is something to do; nothing says what not to do. Capable agents fill unstated space with initiative, and initiative is exactly what you do not want around migrations, deletions, and anything that touches the outside world.",
          fix: "Add a short \"don't\" list. Two or three entries: what must never be edited, what must never run without asking, what is out of scope.",
          ref: "production",
        },
      ];
    },
  },
  {
    id: "pasted-tree",
    kinds: ["claude-md", "prompt"],
    run(doc) {
      let run = 0;
      let start = 0;
      for (let i = 0; i < doc.lines.length; i++) {
        const raw = doc.lines[i];
        const treeish =
          /[│├└]|^\s{2,}[\w.-]+\/?\s*$/.test(raw) && raw.trim().length > 0;
        if (treeish) {
          if (run === 0) start = i + 1;
          run += 1;
          if (run >= 12) {
            return [
              {
                rule: "pasted-tree",
                title: "A file tree pasted into standing context",
                severity: "warn",
                line: start,
                excerpt: clip(doc.lines[start - 1]),
                detail:
                  "A directory listing is high-volume and low-signal: it is expensive to carry, it goes stale the first time somebody adds a file, and the agent can regenerate it in one command whenever it actually needs it.",
                fix: "Delete it. Replace it with the handful of paths that carry meaning, or with the command that prints the tree on demand.",
                ref: "context",
              },
            ];
          }
        } else if (raw.trim() !== "") {
          run = 0;
        }
      }
      return [];
    },
  },
  {
    id: "no-headings",
    kinds: ["claude-md"],
    run(doc) {
      if (doc.headings.length > 0 || doc.lines.length < 25) return [];
      return [
        {
          rule: "no-headings",
          title: "No headings in a long file",
          severity: "warn",
          line: 0,
          excerpt: `${doc.lines.length} lines, 0 headings`,
          detail:
            "Headings are addressable structure — they are how a model (and a human) finds the relevant part without reading the whole thing, and how you later move a section out to an on-demand file.",
          fix: "Break it into named sections: Commands, Architecture, Conventions, Don'ts.",
          ref: "context",
        },
      ];
    },
  },
  {
    id: "readme-spillover",
    kinds: ["claude-md"],
    run(doc) {
      const hits = allLines(
        doc,
        /^#{1,6}\s*(installation|getting started|contributing|license|acknowledge?ments|badges|roadmap|changelog)\b/i,
        2,
      );
      if (hits.length === 0) return [];
      return hits.map((h) => ({
        rule: "readme-spillover",
        title: "README material in the agent's memory file",
        severity: "note" as Severity,
        line: h.line,
        excerpt: h.excerpt,
        detail:
          "This section is written for a human evaluating the project, not for an agent working in it. It is paid for on every turn of every session and changes no decision the agent will make.",
        fix: "Leave it in the README. This file should carry only what changes what the agent does.",
        ref: "context",
      }));
    },
  },

  // --- agent prompts -------------------------------------------------------
  {
    id: "no-success-criterion",
    kinds: ["prompt"],
    run(doc) {
      if (
        has(
          doc,
          /\b(done when|success|succeeds? (?:if|when)|acceptance|definition of done|must pass|should pass|verify|verified|criteri|exit(?:s)? (?:zero|0)|green)\b/,
        )
      ) {
        return [];
      }
      return [
        {
          rule: "no-success-criterion",
          title: "No definition of done",
          severity: "block",
          line: 0,
          excerpt: "—",
          detail:
            "The prompt says what to do but never says how the agent knows it worked. Without a criterion the run terminates on the model's own sense of completion, which is the single most reliable predictor of a confident wrong answer.",
          fix: "State the check: \"Done when `npm test` passes and the new case is covered.\" If the task genuinely has no mechanical check, say what a human will look at.",
          ref: "mental-model",
        },
      ];
    },
  },
  {
    id: "no-output-contract",
    kinds: ["prompt", "tool"],
    run(doc) {
      if (
        has(
          doc,
          /\b(return|returns|respond with|output|format|json|markdown|a list of|schema|shape|fields?)\b/,
        )
      ) {
        return [];
      }
      return [
        {
          rule: "no-output-contract",
          title: "No output contract",
          severity: "warn",
          line: 0,
          excerpt: "—",
          detail:
            "Nothing states what should come back. Whatever consumes this — you, a parser, another agent — is now guessing, and the shape will drift between runs even when the work is right.",
          fix: "Say the shape in one sentence: the fields, the format, and what an empty result looks like.",
          ref: "tool-design",
        },
      ];
    },
  },
  {
    id: "no-stop-condition",
    kinds: ["prompt"],
    run(doc) {
      if (
        has(
          doc,
          /\b(stop (?:when|if|after)|if you (?:can'?t|cannot|get stuck)|ask (?:me|the user|first)|at most|no more than|budget|give up|escalat|time ?box)\b/,
        )
      ) {
        return [];
      }
      return [
        {
          rule: "no-stop-condition",
          title: "No stopping condition",
          severity: "warn",
          line: 0,
          excerpt: "—",
          detail:
            "Nothing tells the agent what to do when it stops making progress. The default behaviour is to keep trying — more searches, more hypotheses, more tokens — long past the point where a human would have come back and asked a question.",
          fix: "Give it a ceiling and an exit: \"If two approaches fail, stop and report what you tried rather than trying a third.\"",
          ref: "production",
        },
      ];
    },
  },
  {
    id: "unbounded-scope",
    kinds: ["prompt"],
    run(doc) {
      const hits = allLines(
        doc,
        /\b(all (?:the )?files|entire codebase|whole (?:codebase|repo|project)|everything|every file|anything (?:else )?(?:you|that) (?:find|see|notice)|fix all)\b/i,
        2,
      );
      if (hits.length === 0) return [];
      return hits.map((h) => ({
        rule: "unbounded-scope",
        title: "Unbounded scope",
        severity: "warn" as Severity,
        line: h.line,
        excerpt: h.excerpt,
        detail:
          "An open scope makes the diff unreviewable and the context unbounded — the agent will pull in whatever it decides is relevant, and \"while I was in there\" is how unrelated changes end up in the same commit.",
        fix: "Name the boundary: the directory, the file list, or the command whose output defines the work.",
        ref: "context",
      }));
    },
  },
  {
    id: "roleplay-preamble",
    kinds: ["prompt", "tool"],
    run(doc) {
      const hits = allLines(
        doc,
        /\b(you are (?:a |an |the )?(?:world[- ]class|expert|senior|10x|brilliant|highly skilled)|act as (?:a|an)|pretend you)\b/i,
        1,
      );
      if (hits.length === 0) return [];
      return hits.map((h) => ({
        rule: "roleplay-preamble",
        title: "Persona preamble doing no work",
        severity: "note" as Severity,
        line: h.line,
        excerpt: h.excerpt,
        detail:
          "A persona line changes register, not capability. It costs context and it displaces the thing that would actually help here — the constraints, the tools available, and what to do when they run out.",
        fix: "Replace it with the operational facts: what the agent can run, what it must not touch, and how it knows it is finished.",
        ref: "context",
      }));
    },
  },
  {
    id: "no-entry-point",
    kinds: ["prompt"],
    run(doc) {
      if (has(doc, /\b(start (?:by|with)|first,|begin by|read|look at|open|the relevant (?:file|code)|context:)\b/)) {
        return [];
      }
      return [
        {
          rule: "no-entry-point",
          title: "No entry point",
          severity: "note",
          line: 0,
          excerpt: "—",
          detail:
            "The prompt never says where to start looking. The run opens with exploration — often a broad search that loads far more than the task needs, which is where context rot begins.",
          fix: "Name the first file, the first command, or the symbol to grep for. One line saves a dozen turns of orientation.",
          ref: "context",
        },
      ];
    },
  },

  // --- tool / subagent descriptions ----------------------------------------
  {
    id: "no-when-to-use",
    kinds: ["tool"],
    run(doc) {
      if (has(doc, /\b(use (?:this|it|when)|call (?:this|it)|when you need|for when|invoke)\b/)) return [];
      return [
        {
          rule: "no-when-to-use",
          title: "Says what it is, not when to use it",
          severity: "block",
          line: 0,
          excerpt: "—",
          detail:
            "A description is a routing decision, not documentation. The model is not asking what this does — it is choosing between this and everything else on the surface, and a description with no trigger condition loses that choice to whichever neighbour phrased itself better.",
          fix: "Open with the trigger: \"Use this when the user asks about X and you need Y.\" Concrete situations beat capabilities.",
          ref: "tool-design",
        },
      ];
    },
  },
  {
    id: "no-when-not-to-use",
    kinds: ["tool"],
    run(doc) {
      if (has(doc, /\b(do not use|don'?t use|not for|instead of|rather than|prefer .* (?:for|when)|avoid)\b/)) {
        return [];
      }
      return [
        {
          rule: "no-when-not-to-use",
          title: "No boundary against neighbouring tools",
          severity: "warn",
          line: 0,
          excerpt: "—",
          detail:
            "Nothing here distinguishes this tool from the one next to it. That distinction is the whole job of the description — near-identical tools with no stated boundary are precisely the tool-sprawl failure, and the model has no way to resolve it at call time.",
          fix: "Add one line naming the sibling and the split: \"For a single known file use Read instead; this is for searching when you don't know the path.\"",
          ref: "tool-design",
        },
      ];
    },
  },
  {
    id: "no-error-semantics",
    kinds: ["tool"],
    run(doc) {
      if (has(doc, /\b(error|errors|fails?|failure|empty|not found|missing|throws?|invalid|denied|timeout)\b/)) {
        return [];
      }
      return [
        {
          rule: "no-error-semantics",
          title: "No failure semantics",
          severity: "warn",
          line: 0,
          excerpt: "—",
          detail:
            "The description covers the happy path only. When the call comes back empty or errors, the model has to infer whether that means \"absent\", \"denied\", or \"try again\" — and inferring wrong turns one bad call into a retry loop.",
          fix: "State what an empty result means, what an error looks like, and whether retrying is ever the right response.",
          ref: "tool-design",
        },
      ];
    },
  },
  {
    id: "surface-sprawl",
    kinds: ["tool"],
    run(doc) {
      const names = doc.text.match(/^\s*[-*]?\s*([a-z][a-z0-9]*_[a-z0-9_]+)\b/gim) ?? [];
      const unique = new Set(names.map((n) => n.trim().replace(/^[-*]\s*/, "")));
      if (unique.size < 10) return [];
      return [
        {
          rule: "surface-sprawl",
          title: `${unique.size} tool names on one surface`,
          severity: "warn",
          line: firstLine(doc, /^\s*[-*]?\s*[a-z][a-z0-9]*_[a-z0-9_]+\b/i, true)?.line ?? 0,
          excerpt: [...unique].slice(0, 4).join(", ") + "…",
          detail:
            "Past roughly a dozen tools, selection accuracy falls off — not because any one description is bad, but because near-neighbours blur. The refund incident in the black box is this failure with money attached.",
          fix: "Consolidate near-duplicates behind one tool with a mode parameter, or split the surface so only the relevant subset is loaded for a given task.",
          ref: "tool-design",
        },
      ];
    },
  },
];

// The context-budget rule needs the artifact kind, which a plain Rule.run
// doesn't receive. Rather than thread it through every rule signature for one
// case, that rule is built here where the kind is in scope.
function contextBudget(doc: Doc, kind: ArtifactKind): Finding[] {
  const limits: Record<ArtifactKind, [number, number]> = {
    "claude-md": [1500, 4000],
    prompt: [1200, 3500],
    tool: [220, 500],
  };
  const [warnAt, blockAt] = limits[kind];
  const t = doc.approxTokens;
  if (t <= warnAt) return [];
  return [
    {
      rule: "context-budget",
      title: `~${t.toLocaleString()} tokens of standing context`,
      severity: t > blockAt ? "block" : "warn",
      line: 0,
      excerpt: `${doc.lines.length} lines · ~${t.toLocaleString()} tokens · budget ${warnAt.toLocaleString()}`,
      detail:
        kind === "tool"
          ? `Tool descriptions are read on every turn and compete with one another for attention. Past roughly ${warnAt} tokens a description stops being read and starts being pattern-matched on its first sentence.`
          : `Past the ${warnAt.toLocaleString()}-token mark relevance decays: material at the bottom of a long file is followed less reliably than the same material in a short one. Length is not neutral — it degrades instruction-following, including the instructions you care most about.`,
      fix:
        kind === "claude-md"
          ? "Cut anything the agent could discover by reading the code. Keep commands, conventions the code does not reveal, and boundaries. Move sometimes-relevant material to a file loaded on demand."
          : "Cut to the decision-relevant. Where the agent could look something up, tell it where to look instead of pasting it in.",
      ref: "context",
    },
  ];
}

// ---------------------------------------------------------------------------
// Strengths — the things worth keeping, so a review is not purely a list of
// complaints. A reader who only ever sees findings learns what to delete, not
// what a good artifact looks like.
// ---------------------------------------------------------------------------

function strengthsFor(doc: Doc, kind: ArtifactKind): string[] {
  const out: string[] = [];
  const cmds = commandLines(doc).length;
  if (cmds > 0) out.push("Names commands the agent can actually run.");
  // A verification *word* is not a verification gate. Crediting "ALWAYS test
  // your changes" as a closed feedback loop is how a linter teaches the exact
  // habit it exists to break — the credit needs a runnable command behind it.
  if (cmds > 0 && has(doc, VERIFY_RE))
    out.push("Points at a verification gate — the run can check itself.");
  if (has(doc, /\b(do not|don'?t|never|avoid|out of scope|non-goals?)\b/))
    out.push("States boundaries, not just intentions.");
  if (doc.headings.length >= 3) out.push("Structured into addressable sections.");
  if (has(doc, /(^|\s)[\w.-]+\/[\w./-]+\.\w+/m)) out.push("Names concrete file paths.");
  if (kind === "tool" && has(doc, /\b(do not use|not for|instead of|rather than)\b/))
    out.push("Draws a boundary against neighbouring tools — the hard part of a description.");
  if (kind === "prompt" && has(doc, /\b(done when|must pass|acceptance|exit(?:s)? (?:zero|0))\b/))
    out.push("Carries a mechanical definition of done.");
  if (doc.approxTokens > 0 && doc.approxTokens < 600 && kind !== "tool")
    out.push("Short. Every token here is one the model actually reads.");
  return out;
}

// ---------------------------------------------------------------------------
// The review
// ---------------------------------------------------------------------------

const PENALTY: Record<Severity, number> = { block: 20, warn: 9, note: 3 };
const SEV_ORDER: Record<Severity, number> = { block: 0, warn: 1, note: 2 };

function gradeFor(score: number): Review["grade"] {
  if (score >= 88) return "A";
  if (score >= 74) return "B";
  if (score >= 58) return "C";
  if (score >= 40) return "D";
  return "F";
}

export function reviewArtifact(text: string, kind: ArtifactKind): Review {
  const doc = parse(text);

  const findings: Finding[] = [...contextBudget(doc, kind)];
  for (const rule of RULES) {
    if (!rule.kinds.includes(kind)) continue;
    findings.push(...rule.run(doc));
  }

  findings.sort(
    (a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || a.line - b.line,
  );

  const strengths = strengthsFor(doc, kind);
  const penalty = findings.reduce((acc, f) => acc + PENALTY[f.severity], 0);
  const credit = Math.min(strengths.length * 2, 8);
  const score = Math.max(0, Math.min(100, 100 - penalty + credit));

  return {
    kind,
    findings,
    strengths,
    metrics: {
      chars: text.length,
      lines: doc.lines.length,
      approxTokens: doc.approxTokens,
      headings: doc.headings.length,
      fences: doc.fenceLangs.length,
      commands: commandLines(doc).length,
    },
    score,
    grade: gradeFor(score),
  };
}

/** The review as Markdown — paste into a PR, a doc, or a ticket. */
export function buildReviewMarkdown(review: Review, ordinalOf: (id: string) => string): string {
  const kindName = KINDS.find((k) => k.id === review.kind)!.name;
  const lines: string[] = [
    `# Bench review — ${kindName}`,
    "",
    `**Grade ${review.grade}** (${review.score}/100) · ~${review.metrics.approxTokens.toLocaleString()} tokens · ${review.metrics.lines} lines · ${review.findings.length} finding${review.findings.length === 1 ? "" : "s"}`,
    "",
    "> Generated locally by the agentic-workflows field guide. Heuristic, not authoritative — every finding cites the principle it came from so you can disagree with it on the merits.",
    "",
  ];

  if (review.strengths.length > 0) {
    lines.push("## Keep", "");
    for (const s of review.strengths) lines.push(`- ${s}`);
    lines.push("");
  }

  if (review.findings.length === 0) {
    lines.push("## Findings", "", "None. Nothing in the rule set fires on this artifact.", "");
  } else {
    lines.push("## Findings", "");
    for (const f of review.findings) {
      const where = f.line > 0 ? `line ${f.line}` : "whole file";
      lines.push(`### [${f.severity}] ${f.title} — ${where}`, "");
      if (f.excerpt && f.excerpt !== "—") lines.push("```", f.excerpt, "```", "");
      lines.push(f.detail, "", `**Fix.** ${f.fix}`, "", `_Principle: ${ordinalOf(f.ref)}_`, "");
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Worked examples — a bad artifact of each kind, so the bench does something
// the first time it is opened. Each is a composite of things that genuinely
// show up in the wild, not a strawman built to trip the rules.
// ---------------------------------------------------------------------------

export const SAMPLES: Record<ArtifactKind, string> = {
  "claude-md": `# CLAUDE.md

This is the repository for our platform. It's a large TypeScript monorepo with several services and a web frontend, and the code is fairly mature at this point so please be careful when making changes and always follow best practices and write clean code that matches the existing style, and if you're unsure about something try to look at how similar things are done elsewhere in the codebase and follow that pattern as closely as you can, since consistency is really important to us and we've had problems in the past with contributions that didn't match our conventions which then had to be rewritten later which wastes everyone's time and causes friction in code review.

IMPORTANT: ALWAYS make sure your code is correct. NEVER break the build. It is CRITICAL that you MUST test your changes. ALWAYS be careful. NEVER make assumptions. IMPORTANT: MUST follow the style guide.

## Installation

Clone the repo and install dependencies. See the README for details.

## Project layout

    packages/
      api/
        src/
          routes/
          models/
          middleware/
      web/
        src/
          components/
          hooks/
          pages/
      shared/
        src/
          types/
          utils/
      workers/
        src/
          jobs/
          queues/

## Notes

The staging deploy key is API_KEY=sk-ant-api03-Xj4kQm2vNp8rTf6wZc1yHb5dLg9sAe3u for the integration tests.

TODO: document the migration process

Ideally you should try to keep functions small if possible.
`,
  prompt: `You are a world-class senior engineer with deep expertise in distributed systems.

Go through the entire codebase and fix all the type errors. Also clean up anything else you notice along the way that could be improved — dead code, bad naming, missing error handling, whatever seems worth doing. Make the code high quality and production-ready.

Take as long as you need to get it right.`,
  tool: `search_documents

Searches documents.

Parameters:
- query: the query
- limit: the limit
- offset: the offset

Related tools on this surface:
- search_docs
- find_document
- document_lookup
- query_documents
- fetch_document
- get_document_by_id
- list_documents
- semantic_search
- keyword_search
- hybrid_search
- search_archive
- search_attachments`,
};
