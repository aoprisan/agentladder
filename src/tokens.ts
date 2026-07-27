// ---------------------------------------------------------------------------
// Token estimation — a heuristic, and honest about it.
//
// Nothing here talks to a tokenizer. A real BPE tokenizer is model-specific
// (Claude generations do not agree with each other, and none of them agree
// with OpenAI's), ships as a large table, and would break this site's
// zero-dependency, works-offline contract for a number the reader can get
// exactly from the API in one call. What this file does instead is make the
// *shape* of the cost visible: how much of a prompt is words, how much is
// markup, and how the same instruction prices out in four different formats.
//
// The model: classify each character, weight each class. Weights are
// calibrated against hand-tokenized English prose and structured text —
// letters divide by 3.6 (an average English word plus its leading space is
// one token), punctuation and symbols cost 0.8 each (most are their own
// token; a few merge with a neighbour, as in `="` or `'s`), digits 0.4 (BPE
// groups them 1–3 at a time), CJK 0.7, newlines 0.4, and indentation runs
// 0.25 per space. Single spaces are free — they merge into the word that
// follows.
//
// Expect ±10–20% on prose and worse on anything exotic. The exact number
// comes from POST /v1/messages/count_tokens, and the guide says so where it
// shows this widget. Do not use these numbers to justify a decision that a
// real count would settle.
// ---------------------------------------------------------------------------

const LETTER = /\p{L}|\p{M}/u;
// Checked before the general letter test — CJK is also \p{L}, and it is the
// one script where a single character is most of a token.
const CJK = /[぀-ヿ㐀-䶿一-鿿豈-﫿가-힯]/;

const WEIGHT = {
  letter: 1 / 3.6,
  digit: 0.4,
  cjk: 0.7,
  punct: 0.8,
  newline: 0.4,
  indent: 0.25,
};

export interface TokenClass {
  key: "words" | "markup" | "digits" | "cjk" | "layout";
  label: string;
  tokens: number;
  hint: string;
}

export interface TokenEstimate {
  chars: number;
  words: number;
  lines: number;
  tokens: number;
  classes: TokenClass[];
  /** share of the estimate spent on structure rather than words, 0–100 */
  structurePct: number;
}

export function analyzeTokens(text: string): TokenEstimate {
  let letters = 0;
  let digits = 0;
  let cjk = 0;
  let punct = 0;
  let newlines = 0;
  let indentChars = 0;
  let run = 0; // consecutive horizontal whitespace

  for (const ch of text) {
    if (ch === "\n" || ch === "\r") {
      newlines++;
      run = 0;
      continue;
    }
    if (ch === " " || ch === "\t") {
      run++;
      // The first space of a run rides along with the next word for free;
      // the rest is indentation, which is real (if cheap) tokens.
      if (run > 1) indentChars++;
      continue;
    }
    run = 0;
    if (CJK.test(ch)) cjk++;
    else if (ch >= "0" && ch <= "9") digits++;
    else if (LETTER.test(ch)) letters++;
    else punct++;
  }

  const wordTokens = letters * WEIGHT.letter;
  const digitTokens = digits * WEIGHT.digit;
  const cjkTokens = cjk * WEIGHT.cjk;
  const markupTokens = punct * WEIGHT.punct;
  const layoutTokens = newlines * WEIGHT.newline + indentChars * WEIGHT.indent;

  const total = wordTokens + digitTokens + cjkTokens + markupTokens + layoutTokens;

  const classes: TokenClass[] = ([
    {
      key: "words",
      label: "words",
      tokens: wordTokens,
      hint: "the part the model is actually reading for meaning",
    },
    {
      key: "markup",
      label: "markup & punctuation",
      tokens: markupTokens,
      hint: "tags, braces, quotes, bullets, commas — format you pay for on every turn",
    },
    {
      key: "digits",
      label: "numbers",
      tokens: digitTokens,
      hint: "digits group 1–3 to a token, so IDs and hashes cost more than they look",
    },
    {
      key: "cjk",
      label: "CJK characters",
      tokens: cjkTokens,
      hint: "roughly one token per character or two — far denser than Latin script",
    },
    {
      key: "layout",
      label: "newlines & indentation",
      tokens: layoutTokens,
      hint: "blank lines are nearly free; deep indentation in pasted code is not",
    },
  ] as TokenClass[]).filter((c) => c.tokens > 0);

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  return {
    chars: text.length,
    words,
    lines: text ? text.split(/\r\n|\r|\n/).length : 0,
    tokens: Math.round(total),
    classes,
    structurePct: total > 0 ? ((markupTokens + layoutTokens) / total) * 100 : 0,
  };
}

export function estimateTokens(text: string): number {
  return analyzeTokens(text).tokens;
}

// ---------------------------------------------------------------------------
// Context windows the reader is likely to be aiming at. Model-specific and
// version-specific — the meter labels these as "check the docs" for a reason
// (see meta.disclaimer). They exist to turn a token count into a share of
// something, not to be quoted as a spec.
// ---------------------------------------------------------------------------

export interface Window {
  id: string;
  label: string;
  size: number;
}

export const WINDOWS: Window[] = [
  { id: "200k", label: "200K", size: 200_000 },
  { id: "1m", label: "1M", size: 1_000_000 },
];

// ---------------------------------------------------------------------------
// One instruction, four formats. Same task, same constraints, same definition
// of done — only the encoding changes. The meter prices all four on load, so
// the format argument arrives as a number rather than an opinion.
// ---------------------------------------------------------------------------

export interface FormatSample {
  id: string;
  name: string;
  blurb: string;
  text: string;
}

export const FORMAT_SAMPLES: FormatSample[] = [
  {
    id: "plain",
    name: "plain text",
    blurb: "No structure at all. Cheapest per idea, and the boundaries are guesswork.",
    text: `You are reviewing a pull request for the payments service. The repository is checked out at /srv/payments, the branch under review is review/1841, and the test suite runs with "just test".

Read the diff and report anything that would break the checkout flow. Only report a defect if you can tie it to a specific line of the diff. Do not comment on formatting or naming. If a test fails, quote the failing output rather than describing it.

Finish with a single line saying whether the branch is safe to merge.`,
  },
  {
    id: "markdown",
    name: "Markdown",
    blurb:
      "Headings, lists, fences. Near-free structure, and the format instruction documents are already written in.",
    text: `# Task
Review a pull request for the payments service.

## Context
- repo: \`/srv/payments\`
- branch: \`review/1841\`
- tests: \`just test\`

## Rules
- Report anything that would break the checkout flow.
- Only report a defect you can tie to a specific line of the diff.
- Do not comment on formatting or naming.
- If a test fails, quote the failing output rather than describing it.

## Output
End with one line: whether the branch is safe to merge.`,
  },
  {
    id: "xml",
    name: "XML tags",
    blurb:
      "Unambiguous boundaries and named regions you can point at later. You pay for every tag, twice.",
    text: `<task>Review a pull request for the payments service.</task>

<context>
  <repo>/srv/payments</repo>
  <branch>review/1841</branch>
  <tests>just test</tests>
</context>

<rules>
  <rule>Report anything that would break the checkout flow.</rule>
  <rule>Only report a defect you can tie to a specific line of the diff.</rule>
  <rule>Do not comment on formatting or naming.</rule>
  <rule>If a test fails, quote the failing output rather than describing it.</rule>
</rules>

<output_format>End with one line: whether the branch is safe to merge.</output_format>`,
  },
  {
    id: "json",
    name: "JSON",
    blurb:
      "Every brace, quote, comma and colon is a token. Right for machine-read output, wrong for hand-written instructions.",
    text: `{
  "task": "Review a pull request for the payments service.",
  "context": {
    "repo": "/srv/payments",
    "branch": "review/1841",
    "tests": "just test"
  },
  "rules": [
    "Report anything that would break the checkout flow.",
    "Only report a defect you can tie to a specific line of the diff.",
    "Do not comment on formatting or naming.",
    "If a test fails, quote the failing output rather than describing it."
  ],
  "output_format": "End with one line: whether the branch is safe to merge."
}`,
  },
];
