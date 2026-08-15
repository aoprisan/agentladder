// ---------------------------------------------------------------------------
// The wind tunnel — the inline widget in L2. A section body marks its slot
// with `<div data-widget="wind-tunnel">` and main.ts mounts this into it,
// the same hydration trick the token meter and the topology diagrams use.
//
// Same privacy contract as the token meter: what you paste is never
// persisted, never put in the URL, never leaves the tab, and no scoreboard
// is kept. All the model terms live in windtunnel.ts / labsim.ts.
// ---------------------------------------------------------------------------

import {
  replay,
  splitTranscript,
  SAMPLE_TRANSCRIPT,
  STRATEGIES,
  TUNNEL_WINDOWS,
  type MarkerStyle,
  type StrategyId,
  type TurnPoint,
} from "./windtunnel";
import { WINDOW_MODEL } from "./labsim";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const ROT_PCT = Math.round(WINDOW_MODEL.rotFloorShare * 100);
const COMPACT_PCT = Math.round(WINDOW_MODEL.compactAtShare * 100);
const OVERFLOW_PCT = Math.round(WINDOW_MODEL.overflowAtShare * 100);

export function mountWindTunnel(host: HTMLElement): void {
  let source = SAMPLE_TRANSCRIPT;
  let marker: MarkerStyle = "auto";
  let windowId = TUNNEL_WINDOWS[0].id; // small window — the dynamics are the lesson
  let strategy: StrategyId = "none";

  host.innerHTML = `
    <div class="wt">
      <p class="tm-eyebrow">wind tunnel</p>
      <p class="tm-note">Paste a conversation or agent transcript and watch it occupy the window turn by turn — the rot band, the compaction point, what each L2 strategy would have kept. Estimated in this tab: nothing is stored, nothing is uploaded, nothing goes in the URL.</p>
      <textarea class="wt-editor" spellcheck="false" aria-label="Transcript to replay"></textarea>
      <div class="wt-controls"></div>
      <div class="wt-out"></div>
    </div>`;

  const editor = host.querySelector<HTMLTextAreaElement>(".wt-editor")!;
  editor.value = source;
  const controls = host.querySelector<HTMLElement>(".wt-controls")!;
  const out = host.querySelector<HTMLElement>(".wt-out")!;

  function seg<T extends string>(
    attr: string,
    value: T,
    options: Array<[T, string, string?]>,
  ): string {
    return `<div class="lab-seg">${options
      .map(
        ([v, label, title]) =>
          `<button class="lab-seg-btn${v === value ? " on" : ""}" data-${attr}="${v}" type="button" aria-pressed="${v === value}"${title ? ` title="${esc(title)}"` : ""}>${label}</button>`,
      )
      .join("")}</div>`;
  }

  function paintControls(): void {
    controls.innerHTML = `
      <div class="wt-ctl-row">
        <div>
          <h4 class="lab-h">turn markers</h4>
          ${seg("marker", marker, [
            ["auto", "auto"],
            ["roles", "user:/assistant:"],
            ["blank", "blank lines"],
          ])}
        </div>
        <div>
          <h4 class="lab-h">window</h4>
          ${seg(
            "win",
            windowId,
            TUNNEL_WINDOWS.map((w) => [
              w.id,
              w.label,
              "same thresholds as the lab, as shares of the window — a small window shows in 20 turns what a 200K window shows in a day",
            ]),
          )}
        </div>
      </div>
      <h4 class="lab-h">strategy <span class="lab-h-ref">(L2, applied retroactively)</span></h4>
      ${seg(
        "strategy",
        strategy,
        STRATEGIES.map((s) => [s.id, s.name, s.blurb]),
      )}
      <p class="wt-strategy-blurb">${esc(STRATEGIES.find((s) => s.id === strategy)!.blurb)}</p>`;

    controls.querySelectorAll<HTMLButtonElement>("[data-marker]").forEach((b) =>
      b.addEventListener("click", () => {
        marker = b.dataset.marker as MarkerStyle;
        paintControls();
        paint();
      }),
    );
    controls.querySelectorAll<HTMLButtonElement>("[data-win]").forEach((b) =>
      b.addEventListener("click", () => {
        windowId = b.dataset.win!;
        paintControls();
        paint();
      }),
    );
    controls.querySelectorAll<HTMLButtonElement>("[data-strategy]").forEach((b) =>
      b.addEventListener("click", () => {
        strategy = b.dataset.strategy as StrategyId;
        paintControls();
        paint();
      }),
    );
  }

  function barClass(p: TurnPoint): string {
    if (p.overflowed || p.occupancyPct >= OVERFLOW_PCT) return "crit";
    if (p.occupancyPct >= COMPACT_PCT) return "hot";
    if (p.occupancyPct >= ROT_PCT) return "rot";
    return "";
  }

  function paint(): void {
    const win = TUNNEL_WINDOWS.find((w) => w.id === windowId)!;
    const turns = splitTranscript(source, marker);

    if (turns.length === 0) {
      out.innerHTML = `<p class="drill-note">Nothing to replay yet — paste a transcript above.</p>`;
      return;
    }

    const run = replay(turns, win.sizeK, strategy);
    const totalK = turns.reduce((a, t) => a + t.tokens, 0) / 1000;

    const bars = run.points
      .map((p) => {
        const h = Math.max(2, Math.round(p.occupancyPct));
        const marks = `${p.compacted ? `<span class="wt-compact" title="compaction fired here">◆</span>` : ""}`;
        return `<div class="wt-col" title="turn ${p.turn} · ${esc(p.role)} · +${p.addedK.toFixed(1)}k this turn · ${Math.round(p.occupancyPct)}% of the ${win.label} window${p.compacted ? " · compaction fired" : ""}${p.overflowed ? " · past the overflow line" : ""}">
          ${marks}
          <div class="wt-bar ${barClass(p)}" style="height:${h}%"></div>
        </div>`;
      })
      .join("");

    const overflowNote = run.firstOverflow
      ? `<li class="lab-ev bad">turn ${run.firstOverflow}: past the overflow line (${OVERFLOW_PCT}%) — in a real run this is a truncated restart, or the model quietly losing the plot</li>`
      : "";
    const compactNote =
      run.compactions > 0
        ? `<li class="lab-ev good">compaction fired ${run.compactions}× — decisions, state and open items survive; the transcript doesn't</li>`
        : "";
    const rotNote =
      run.turnsAboveRotFloor > 0
        ? `<li class="lab-ev warn">${run.turnsAboveRotFloor} of ${run.points.length} turns spent above the rot floor (${ROT_PCT}%) — every one of them paid the attention tax</li>`
        : `<li class="lab-ev good">the whole run stayed under the rot floor (${ROT_PCT}%) — attention never had to compete with stale mass</li>`;
    const savedNote =
      strategy !== "none" && run.savedK > 0.05
        ? `<li class="lab-ev info">this strategy kept ~${run.savedK}k of the transcript's ~${totalK.toFixed(1)}k out of the window at the end</li>`
        : "";

    out.innerHTML = `
      <div class="lab-tiles">
        <div class="lab-tile"><span class="lab-tile-num">${run.points.length}</span><span class="lab-tile-label">turns</span></div>
        <div class="lab-tile"><span class="lab-tile-num">~${totalK.toFixed(1)}k</span><span class="lab-tile-label">transcript tokens</span></div>
        <div class="lab-tile"><span class="lab-tile-num">${run.peakPct}%</span><span class="lab-tile-label">peak occupancy</span></div>
        <div class="lab-tile"><span class="lab-tile-num">${run.finalPct}%</span><span class="lab-tile-label">final occupancy</span></div>
      </div>
      <div class="wt-plot" role="img" aria-label="Window occupancy per turn">
        <div class="wt-line wt-line-overflow" style="bottom:${OVERFLOW_PCT}%" title="overflow at ${OVERFLOW_PCT}%"></div>
        <div class="wt-line wt-line-compact" style="bottom:${COMPACT_PCT}%" title="compaction fires at ${COMPACT_PCT}%"></div>
        <div class="wt-line wt-line-rot" style="bottom:${ROT_PCT}%" title="rot floor at ${ROT_PCT}%"></div>
        <div class="wt-cols">${bars}</div>
      </div>
      <p class="wt-legend"><span class="wt-key rot"></span>above the rot floor (${ROT_PCT}%) · <span class="wt-key hot"></span>compaction territory (${COMPACT_PCT}%) · <span class="wt-key crit"></span>overflow (${OVERFLOW_PCT}%) · ◆ compaction</p>
      <ul class="lab-log wt-notes">${compactNote}${overflowNote}${rotNote}${savedNote}</ul>
      <p class="tm-exact">Turn costs are estimates (±10–20%) from the same character-class heuristic as the token meter; thresholds are the lab's, as shares of the window. For real numbers: <code>POST /v1/messages/count_tokens</code>, or <code>/context</code> inside Claude Code.</p>`;
  }

  editor.addEventListener("input", () => {
    source = editor.value;
    paint();
  });

  paintControls();
  paint();
}

/** Focus the tunnel — the palette's quick action lands the reader in the field. */
export function focusWindTunnel(): void {
  document.querySelector<HTMLTextAreaElement>(".wt-editor")?.focus({ preventScroll: true });
}
