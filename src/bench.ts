// ---------------------------------------------------------------------------
// The bench — UI over rubric.ts. Paste a real artifact (a CLAUDE.md, an agent
// prompt, a tool description), get a line-anchored review against the guide's
// rules, export it as Markdown.
//
// Privacy is a design constraint, not a footnote: the pasted text is never
// written to localStorage, never put in the URL, and never leaves the tab.
// People paste real project files here, and real project files occasionally
// contain credentials — which is itself one of the things the rule set looks
// for. What *is* persisted is a scoreboard of past runs: kind, score, token
// count, timestamp. No content.
// ---------------------------------------------------------------------------

import {
  KINDS,
  SAMPLES,
  buildReviewMarkdown,
  reviewArtifact,
  type ArtifactKind,
  type Finding,
  type Review,
} from "./rubric";
import { logActivity } from "./activity";
import { estimateTokens } from "./tokens";

const BENCH_KEY = "agentic-guide-bench-v1";
const HISTORY_CAP = 12;

interface BenchRun {
  t: number;
  kind: ArtifactKind;
  score: number;
  grade: Review["grade"];
  tokens: number;
  findings: number;
}

function readHistory(): BenchRun[] {
  try {
    const raw = localStorage.getItem(BENCH_KEY);
    const parsed = raw ? (JSON.parse(raw) as BenchRun[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function pushHistory(run: BenchRun): void {
  try {
    localStorage.setItem(BENCH_KEY, JSON.stringify([...readHistory(), run].slice(-HISTORY_CAP)));
  } catch {
    /* private mode etc. — the scoreboard just won't persist */
  }
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const SEV_LABEL: Record<Finding["severity"], string> = {
  block: "blocking",
  warn: "warning",
  note: "note",
};

export interface BenchHandle {
  open(): void;
}

export function initBench(
  jumpTo: (sectionId: string) => void,
  ordinalOf: (sectionId: string) => string,
  toast: (msg: string) => void,
): BenchHandle {
  const overlay = document.createElement("div");
  overlay.className = "overlay bench";
  overlay.hidden = true;
  overlay.innerHTML = `<div class="overlay-card bn-card" role="dialog" aria-modal="true" aria-label="The bench"></div>`;
  document.body.appendChild(overlay);
  const card = overlay.querySelector<HTMLElement>(".bn-card")!;

  let kind: ArtifactKind = "claude-md";
  let source = "";
  let review: Review | null = null;

  function close(): void {
    overlay.hidden = true;
    document.removeEventListener("keydown", onKey);
  }

  function onKey(e: KeyboardEvent): void {
    if (overlay.hidden) return;
    if (e.key === "Escape") {
      // Escape inside the editor would discard a paste the reader may not have
      // reviewed yet; make them leave the field first.
      if (document.activeElement === editor()) return;
      close();
    }
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  const editor = (): HTMLTextAreaElement | null =>
    card.querySelector<HTMLTextAreaElement>(".bn-editor");

  function open(): void {
    overlay.hidden = false;
    document.addEventListener("keydown", onKey);
    render();
  }

  // --- rendering ------------------------------------------------------------

  function kindSeg(): string {
    return KINDS.map(
      (k) => `
      <button class="lab-seg-btn${k.id === kind ? " on" : ""}" data-kind="${k.id}" type="button" aria-pressed="${k.id === kind}" title="${esc(k.blurb)}">${esc(k.name)}</button>`,
    ).join("");
  }

  function historyStrip(): string {
    const runs = readHistory().filter((r) => r.kind === kind);
    if (runs.length < 2) return "";
    const best = Math.max(...runs.map((r) => r.score));
    const first = runs[0];
    const last = runs[runs.length - 1];
    const delta = last.score - first.score;
    const arrow = delta > 0 ? `▲ +${delta}` : delta < 0 ? `▼ ${delta}` : "level";
    return `<p class="bn-history">${runs.length} reviews of this artifact kind on this device · best ${best}/100 · ${arrow} since the first. <span class="bn-history-note">scores only — nothing you paste is stored.</span></p>`;
  }

  function findingCard(f: Finding, i: number): string {
    const where =
      f.line > 0
        ? `<button class="bn-line" data-line="${f.line}" type="button" title="select this line in the editor">line ${f.line}</button>`
        : `<span class="bn-line bn-line-doc">whole file</span>`;
    const excerpt =
      f.excerpt && f.excerpt !== "—" ? `<pre class="bn-excerpt">${esc(f.excerpt)}</pre>` : "";
    return `
      <div class="bn-finding sev-${f.severity}">
        <p class="bn-finding-head">
          <span class="bn-sev sev-${f.severity}">${SEV_LABEL[f.severity]}</span>
          <span class="bn-finding-title">${esc(f.title)}</span>
          ${where}
        </p>
        ${excerpt}
        <p class="bn-detail">${esc(f.detail)}</p>
        <p class="bn-fix"><span class="bn-fix-k">fix</span> ${esc(f.fix)}</p>
        <button class="lab-ref-link" data-jump="${f.ref}" type="button">${esc(ordinalOf(f.ref))} — the principle</button>
        <span class="bn-rule">${esc(f.rule)}</span>
        <span class="bn-idx" aria-hidden="true">${i + 1}</span>
      </div>`;
  }

  function resultBlock(): string {
    if (!review) {
      return `<div class="bn-empty"><p>Paste an artifact above and run the review. The rule set is heuristic — it reads structure and keywords, not meaning — so treat every finding as an argument you're free to lose. Each one cites the section it came from.</p></div>`;
    }
    const r = review;
    const counts = {
      block: r.findings.filter((f) => f.severity === "block").length,
      warn: r.findings.filter((f) => f.severity === "warn").length,
      note: r.findings.filter((f) => f.severity === "note").length,
    };
    const strengths =
      r.strengths.length > 0
        ? `<h4 class="lab-h">worth keeping</h4>
           <ul class="bn-strengths">${r.strengths.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>`
        : "";
    const findings =
      r.findings.length > 0
        ? `<h4 class="lab-h">findings <span class="lab-h-ref">(${counts.block} blocking · ${counts.warn} warnings · ${counts.note} notes)</span></h4>
           <div class="bn-findings">${r.findings.map(findingCard).join("")}</div>`
        : `<div class="lab-rec"><p>Nothing in the rule set fires on this artifact. That is not a certificate — the bench checks structure and stated intent, and it cannot tell you whether what you wrote is <em>true</em> of your project.</p></div>`;

    return `
      <div class="lab-tiles">
        <div class="lab-tile"><span class="lab-tile-grade g-${r.grade}">${r.grade}</span><span class="lab-tile-label">review grade</span></div>
        <div class="lab-tile"><span class="lab-tile-num">${r.score}</span><span class="lab-tile-label">out of 100</span></div>
        <div class="lab-tile"><span class="lab-tile-num">~${r.metrics.approxTokens.toLocaleString()}</span><span class="lab-tile-label">tokens carried</span></div>
        <div class="lab-tile"><span class="lab-tile-num">${r.metrics.commands}</span><span class="lab-tile-label">runnable commands</span></div>
      </div>
      ${strengths}
      ${findings}
      <div class="drill-actions bn-export">
        <button class="drill-btn primary" data-act="copy" type="button">copy review as Markdown</button>
        <button class="drill-btn" data-act="download" type="button">download .md</button>
      </div>`;
  }

  function render(): void {
    const preserve = editor()?.selectionStart ?? null;
    card.innerHTML = `
      <p class="overlay-eyebrow">the bench</p>
      <h3 class="drill-title">Review a real artifact</h3>
      <p class="drill-note">Everything else here is a simulation. This is the bench: bring in the actual <code>CLAUDE.md</code>, prompt, or tool description you maintain and have the guide's rules applied to it, line by line. It all runs in this tab — the text is never stored, never sent anywhere, and never put in a link.</p>

      <h4 class="lab-h">what are we looking at</h4>
      <div class="lab-seg bn-kinds">${kindSeg()}</div>
      <p class="bn-kind-blurb">${esc(KINDS.find((k) => k.id === kind)!.blurb)}</p>

      <textarea class="bn-editor" spellcheck="false" placeholder="Paste it here…" aria-label="Artifact source">${esc(source)}</textarea>
      <div class="bn-bar">
        <span class="bn-meta">${source.length.toLocaleString()} chars · ~${estimateTokens(source).toLocaleString()} tokens</span>
        <div class="drill-actions">
          <button class="drill-btn" data-act="sample" type="button">load a worked example</button>
          <button class="drill-btn" data-act="clear" type="button">clear</button>
          <button class="drill-btn primary" data-act="run" type="button">run the review</button>
        </div>
      </div>
      ${historyStrip()}
      ${resultBlock()}
      <div class="drill-actions"><button class="drill-btn" data-act="close" type="button">close</button></div>`;

    const ed = editor()!;
    ed.addEventListener("input", () => {
      source = ed.value;
      const meta = card.querySelector<HTMLElement>(".bn-meta");
      if (meta) {
        meta.textContent = `${source.length.toLocaleString()} chars · ~${estimateTokens(source).toLocaleString()} tokens`;
      }
    });
    if (preserve !== null) {
      ed.focus();
      ed.setSelectionRange(preserve, preserve);
    }

    card.querySelectorAll<HTMLButtonElement>("[data-kind]").forEach((btn) => {
      btn.addEventListener("click", () => {
        kind = btn.dataset.kind as ArtifactKind;
        // A review of the previous kind would be misleading against the new
        // rule set — drop it rather than silently mixing the two.
        review = source.trim() ? reviewArtifact(source, kind) : null;
        render();
      });
    });

    card.querySelectorAll<HTMLButtonElement>("[data-line]").forEach((btn) => {
      btn.addEventListener("click", () => selectLine(Number(btn.dataset.line)));
    });

    card.querySelectorAll<HTMLButtonElement>("[data-jump]").forEach((btn) => {
      btn.addEventListener("click", () => {
        close();
        jumpTo(btn.dataset.jump!);
      });
    });

    card.querySelector("[data-act=run]")?.addEventListener("click", run);
    card.querySelector("[data-act=sample]")?.addEventListener("click", () => {
      source = SAMPLES[kind];
      review = reviewArtifact(source, kind);
      render();
    });
    card.querySelector("[data-act=clear]")?.addEventListener("click", () => {
      source = "";
      review = null;
      render();
    });
    card.querySelector("[data-act=copy]")?.addEventListener("click", () => void copyMd());
    card.querySelector("[data-act=download]")?.addEventListener("click", downloadMd);
    card.querySelector("[data-act=close]")?.addEventListener("click", close);
  }

  function run(): void {
    const ed = editor();
    if (ed) source = ed.value;
    if (!source.trim()) {
      toast("paste something first — or load a worked example");
      return;
    }
    review = reviewArtifact(source, kind);
    pushHistory({
      t: Date.now(),
      kind,
      score: review.score,
      grade: review.grade,
      tokens: review.metrics.approxTokens,
      findings: review.findings.length,
    });
    logActivity("bench");
    render();
    card.querySelector(".lab-tiles")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /** Select a finding's line in the editor, so the reader sees it in place. */
  function selectLine(line: number): void {
    const ed = editor();
    if (!ed) return;
    const lines = ed.value.split(/\r?\n/);
    if (line < 1 || line > lines.length) return;
    let start = 0;
    for (let i = 0; i < line - 1; i++) start += lines[i].length + 1;
    ed.focus();
    ed.setSelectionRange(start, start + lines[line - 1].length);
    // Rough but reliable: scroll the field so the line sits near the top.
    const lineHeight = ed.scrollHeight / Math.max(1, lines.length);
    ed.scrollTop = Math.max(0, (line - 2) * lineHeight);
    ed.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function copyMd(): Promise<void> {
    if (!review) return;
    const md = buildReviewMarkdown(review, ordinalOf);
    try {
      await navigator.clipboard.writeText(md);
      toast("review copied as Markdown");
    } catch {
      window.prompt("Copy the review:", md);
    }
  }

  function downloadMd(): void {
    if (!review) return;
    const md = buildReviewMarkdown(review, ordinalOf);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bench-review-${kind}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast("review downloaded");
  }

  return { open };
}
