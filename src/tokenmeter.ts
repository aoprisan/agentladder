// ---------------------------------------------------------------------------
// The token meter — the inline widget in the prompt-formats section (PW).
//
// A section body marks its slot with `<div data-widget="token-meter">` and
// main.ts mounts this into it, the same hydration trick the topology diagrams
// use: the markup stays out of the content files and out of the palette's
// search index.
//
// Same privacy contract as the bench (bench.ts): what you paste is never
// persisted, never put in the URL, and never leaves the tab. Unlike the bench
// this doesn't even keep a scoreboard — there is nothing here worth storing.
//
// The estimator is in tokens.ts and is a heuristic; every number this renders
// is prefixed with a ~ and the copy says where the exact one comes from.
// ---------------------------------------------------------------------------

import {
  analyzeTokens,
  FORMAT_SAMPLES,
  WINDOWS,
  type TokenEstimate,
} from "./tokens";

/** Turns a prompt into a rough number of turns' worth of standing context. */
const STANDING_TURNS = 40;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function num(n: number): string {
  return Math.round(n).toLocaleString();
}

export function mountTokenMeter(host: HTMLElement): void {
  let source = FORMAT_SAMPLES[1].text; // Markdown — the format most readers arrive using
  let windowId = WINDOWS[0].id;

  // The four formats are priced once, at mount: the comparison is the point of
  // the widget, and making the reader click four times to see it hides it.
  const formatRows = FORMAT_SAMPLES.map((s) => ({
    sample: s,
    tokens: analyzeTokens(s.text).tokens,
  }));
  const baseline = formatRows[0].tokens;

  host.innerHTML = `
    <div class="tm">
      <p class="tm-eyebrow">token meter</p>
      <p class="tm-note">Paste a prompt, a <code>CLAUDE.md</code>, a tool description — anything you send on every turn. It is estimated in this tab: nothing is stored, nothing is uploaded, nothing goes in the URL.</p>
      <textarea class="tm-editor" spellcheck="false" aria-label="Prompt to estimate">${esc(source)}</textarea>
      <div class="tm-out"></div>
      <h4 class="lab-h">one instruction, four formats <span class="lab-h-ref">(same task, same rules, same definition of done)</span></h4>
      <div class="tm-formats">${formatRows
        .map(({ sample, tokens }) => {
          const delta = tokens - baseline;
          const pct = baseline > 0 ? Math.round((delta / baseline) * 100) : 0;
          const cmp =
            delta === 0
              ? `<span class="tm-delta base">baseline</span>`
              : `<span class="tm-delta ${delta > 0 ? "up" : "down"}">${delta > 0 ? "+" : ""}${pct}%</span>`;
          return `
          <div class="tm-format">
            <p class="tm-format-head">
              <span class="tm-format-name">${esc(sample.name)}</span>
              <span class="tm-format-num">~${num(tokens)} tokens</span>
              ${cmp}
            </p>
            <p class="tm-format-blurb">${esc(sample.blurb)}</p>
            <button class="drill-btn" data-sample="${sample.id}" type="button">load it in the meter</button>
          </div>`;
        })
        .join("")}</div>
      <p class="tm-caveat">The spread here is the format tax, not the whole story: XML costs the most tokens and removes the most ambiguity, and on a prompt carrying a pasted document that trade is usually worth it. On a prompt that carries none, it is pure overhead.</p>
    </div>`;

  const editor = host.querySelector<HTMLTextAreaElement>(".tm-editor")!;
  const out = host.querySelector<HTMLElement>(".tm-out")!;

  function tiles(est: TokenEstimate): string {
    const win = WINDOWS.find((w) => w.id === windowId)!;
    const share = (est.tokens / win.size) * 100;
    const shareLabel = share < 0.1 && est.tokens > 0 ? "<0.1%" : `${share.toFixed(1)}%`;
    return `
      <div class="lab-tiles">
        <div class="lab-tile"><span class="lab-tile-num">~${num(est.tokens)}</span><span class="lab-tile-label">tokens</span></div>
        <div class="lab-tile"><span class="lab-tile-num">${num(est.chars)}</span><span class="lab-tile-label">characters</span></div>
        <div class="lab-tile"><span class="lab-tile-num">${num(est.words)}</span><span class="lab-tile-label">words</span></div>
        <div class="lab-tile"><span class="lab-tile-num">${shareLabel}</span><span class="lab-tile-label">of a ${win.label} window</span></div>
      </div>`;
  }

  function composition(est: TokenEstimate): string {
    if (est.tokens === 0) return "";
    const segs = est.classes
      .map(
        (c) =>
          `<span class="tm-seg tm-seg-${c.key}" style="flex-grow:${c.tokens.toFixed(2)}" title="${esc(c.hint)}"></span>`,
      )
      .join("");
    const legend = est.classes
      .map(
        (c) =>
          `<li><span class="tm-key tm-seg-${c.key}" aria-hidden="true"></span>${esc(c.label)} — ~${num(c.tokens)}</li>`,
      )
      .join("");
    return `
      <div class="tm-bar" role="img" aria-label="Token composition">${segs}</div>
      <ul class="tm-legend">${legend}</ul>
      <p class="tm-struct"><strong>${Math.round(est.structurePct)}%</strong> of this is structure rather than words. That share is what a format choice actually costs you.</p>`;
  }

  function standing(est: TokenEstimate): string {
    if (est.tokens === 0) return "";
    return `<p class="tm-standing">Carried on every turn of a ${STANDING_TURNS}-turn session, this is <strong>~${num(est.tokens * STANDING_TURNS)} tokens</strong> read — before the conversation, the files, or the tool results. Standing context is billed by the turn, not by the paste.</p>`;
  }

  function windowSeg(): string {
    return `<div class="lab-seg tm-windows">${WINDOWS.map(
      (w) =>
        `<button class="lab-seg-btn${w.id === windowId ? " on" : ""}" data-window="${w.id}" type="button" aria-pressed="${w.id === windowId}">${w.label} window</button>`,
    ).join("")}</div>`;
  }

  function paint(): void {
    const est = analyzeTokens(source);
    out.innerHTML = `
      ${windowSeg()}
      ${tiles(est)}
      ${composition(est)}
      ${standing(est)}
      <p class="tm-exact">Estimate only — ±10–20%, and blind to which model you're calling. Real tokenizers differ between model generations and disagree entirely with other vendors' (an OpenAI tokenizer undercounts Claude by roughly 15–20% on prose, more on code). For the number you can act on: <code>POST /v1/messages/count_tokens</code>, or <code>/context</code> inside Claude Code.</p>`;

    out.querySelectorAll<HTMLButtonElement>("[data-window]").forEach((btn) => {
      btn.addEventListener("click", () => {
        windowId = btn.dataset.window!;
        paint();
      });
    });
  }

  editor.addEventListener("input", () => {
    source = editor.value;
    paint();
  });

  host.querySelectorAll<HTMLButtonElement>("[data-sample]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const found = FORMAT_SAMPLES.find((s) => s.id === btn.dataset.sample);
      if (!found) return;
      source = found.text;
      editor.value = source;
      paint();
      editor.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });

  paint();
}

/** Focus the meter — the palette's quick action lands the reader in the field. */
export function focusTokenMeter(): void {
  document.querySelector<HTMLTextAreaElement>(".tm-editor")?.focus({ preventScroll: true });
}
