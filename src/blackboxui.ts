// ---------------------------------------------------------------------------
// The black box — UI over blackbox.ts. Three screens:
//
//   roster  →  review (the transcript, flag turns)  →  debrief
//
// The review screen is deliberately unhelpful: nothing is highlighted, clean
// turns look exactly like faulty ones, and the fault list is always the full
// taxonomy. The difficulty *is* the exercise — a recorded run does not tell
// you which line to look at either.
//
// Every debrief verdict links back to the section that teaches the principle
// the run violated, via the jumpTo callback from main.ts.
// ---------------------------------------------------------------------------

import {
  FAULTS,
  INCIDENTS,
  faultById,
  faultTurns,
  readBlackBox,
  recordRun,
  scoreCalls,
  type Calls,
  type FaultId,
  type Incident,
  type Score,
  type Turn,
} from "./blackbox";
import { logActivity } from "./activity";

export interface BlackBoxHandle {
  open(): void;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const ACTOR_LABEL: Record<Turn["actor"], string> = {
  user: "operator",
  model: "model",
  tool: "tool call",
  result: "returned",
  system: "config",
};

export function initBlackBox(
  jumpTo: (sectionId: string) => void,
  ordinalOf: (sectionId: string) => string,
): BlackBoxHandle {
  const overlay = document.createElement("div");
  overlay.className = "overlay blackbox";
  overlay.hidden = true;
  overlay.innerHTML = `<div class="overlay-card bb-card" role="dialog" aria-modal="true" aria-label="The black box"></div>`;
  document.body.appendChild(overlay);
  const card = overlay.querySelector<HTMLElement>(".bb-card")!;

  let incident: Incident | null = null;
  let calls: Calls = {};
  let openPicker: number | null = null;

  function close(): void {
    overlay.hidden = true;
    document.removeEventListener("keydown", onKey);
  }

  function onKey(e: KeyboardEvent): void {
    if (overlay.hidden) return;
    if (e.key !== "Escape") return;
    // A picker open over the transcript swallows the first Escape — closing
    // the whole review by accident would throw away every flag placed so far.
    if (openPicker !== null) {
      openPicker = null;
      renderReview();
      return;
    }
    close();
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  function open(): void {
    overlay.hidden = false;
    document.addEventListener("keydown", onKey);
    renderRoster();
  }

  // --- screen 1: the roster -------------------------------------------------

  function renderRoster(): void {
    const store = readBlackBox();
    const rows = INCIDENTS.map((inc) => {
      const rec = store[inc.id];
      const badge = rec
        ? `<span class="bb-best g-${rec.lastGrade}">best ${rec.best}%</span>`
        : `<span class="bb-best bb-new">unflown</span>`;
      return `
        <button class="lab-chip bb-incident" data-incident="${inc.id}" type="button">
          <span class="lab-chip-name">${esc(inc.title)} ${badge}</span>
          <span class="lab-chip-sub">${esc(inc.setting)}</span>
          <span class="bb-outcome">${esc(inc.outcome)}</span>
        </button>`;
    }).join("");

    card.innerHTML = `
      <p class="overlay-eyebrow">the black box</p>
      <h3 class="drill-title">Read the recorder</h3>
      <p class="drill-note">Four agent runs that went wrong. You get the transcript and the outcome — not the diagnosis. Walk the turns, flag the ones where the run went off the rails, and name the failure mode. Locating a fault and misnaming it still scores; flagging clean turns costs you, because an operator who suspects every step has diagnosed nothing.</p>
      <div class="lab-grid bb-roster">${rows}</div>
      <div class="drill-actions"><button class="drill-btn" data-act="close" type="button">close</button></div>`;

    card.querySelectorAll<HTMLButtonElement>("[data-incident]").forEach((btn) => {
      btn.addEventListener("click", () => {
        incident = INCIDENTS.find((i) => i.id === btn.dataset.incident)!;
        calls = {};
        openPicker = null;
        renderReview();
      });
    });
    card.querySelector("[data-act=close]")?.addEventListener("click", close);
  }

  // --- screen 2: the review -------------------------------------------------

  function spine(inc: Incident): string {
    const ticks = inc.turns
      .map(
        (t) =>
          `<button class="bb-tick${calls[t.n] ? " flagged" : ""}" data-goto="${t.n}" type="button" title="turn ${t.n} — ${esc(ACTOR_LABEL[t.actor])}" aria-label="jump to turn ${t.n}"></button>`,
      )
      .join("");
    return `<div class="bb-spine" role="group" aria-label="Run timeline">${ticks}</div>`;
  }

  function pickerFor(n: number): string {
    if (openPicker !== n) return "";
    const opts = FAULTS.map(
      (f) => `
      <button class="bb-fault-opt${calls[n] === f.id ? " on" : ""}" data-call="${n}" data-fault="${f.id}" type="button">
        <strong>${esc(f.name)}</strong>
        <span>${esc(f.blurb)}</span>
      </button>`,
    ).join("");
    return `<div class="bb-picker">
      <p class="bb-picker-h">what went wrong here?</p>
      ${opts}
      ${calls[n] ? `<button class="bb-fault-clear" data-clear="${n}" type="button">remove this flag</button>` : ""}
    </div>`;
  }

  function turnCard(t: Turn): string {
    const called = calls[t.n];
    const code = t.code ? `<pre class="bb-code">${esc(t.code)}</pre>` : "";
    const flagLabel = called
      ? `⚑ ${esc(faultById(called).name)}`
      : "flag this turn";
    return `
      <li class="bb-turn${called ? " flagged" : ""}" id="bb-turn-${t.n}">
        <div class="bb-turn-gutter"><span class="bb-n">${t.n}</span></div>
        <div class="bb-turn-body">
          <p class="bb-turn-head">
            <span class="bb-actor ${t.actor}">${esc(ACTOR_LABEL[t.actor])}</span>
            <span class="bb-label">${esc(t.label)}</span>
          </p>
          <p class="bb-text">${esc(t.text)}</p>
          ${code}
          <button class="bb-flag${called ? " on" : ""}" data-flag="${t.n}" type="button" aria-expanded="${openPicker === t.n}">${flagLabel}</button>
          ${pickerFor(t.n)}
        </div>
      </li>`;
  }

  function renderReview(): void {
    const inc = incident!;
    const flags = Object.keys(calls).length;
    card.innerHTML = `
      <p class="overlay-eyebrow">the black box · ${esc(inc.id)}</p>
      <h3 class="drill-title">${esc(inc.title)}</h3>
      <p class="bb-setting">${esc(inc.setting)}</p>
      <div class="bb-brief">
        <p><span class="bb-brief-k">asked for</span> ${esc(inc.brief)}</p>
        <p><span class="bb-brief-k bad">what happened</span> ${esc(inc.outcome)}</p>
      </div>
      ${spine(inc)}
      <ol class="bb-turns">${inc.turns.map(turnCard).join("")}</ol>
      <div class="bb-submitbar">
        <span class="bb-count">${flags} turn${flags === 1 ? "" : "s"} flagged</span>
        <div class="drill-actions">
          <button class="drill-btn" data-act="roster" type="button">back</button>
          <button class="drill-btn primary" data-act="submit" type="button">file the report</button>
        </div>
      </div>`;

    card.querySelectorAll<HTMLButtonElement>("[data-flag]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const n = Number(btn.dataset.flag);
        openPicker = openPicker === n ? null : n;
        renderReview();
        document.getElementById(`bb-turn-${n}`)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });
    });

    card.querySelectorAll<HTMLButtonElement>("[data-fault]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const n = Number(btn.dataset.call);
        calls[n] = btn.dataset.fault as FaultId;
        openPicker = null;
        renderReview();
        document.getElementById(`bb-turn-${n}`)?.scrollIntoView({ block: "center" });
      });
    });

    card.querySelectorAll<HTMLButtonElement>("[data-clear]").forEach((btn) => {
      btn.addEventListener("click", () => {
        delete calls[Number(btn.dataset.clear)];
        openPicker = null;
        renderReview();
      });
    });

    card.querySelectorAll<HTMLButtonElement>("[data-goto]").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.getElementById(`bb-turn-${btn.dataset.goto}`)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });
    });

    card.querySelector("[data-act=roster]")?.addEventListener("click", renderRoster);
    card.querySelector("[data-act=submit]")?.addEventListener("click", submit);
  }

  // --- screen 3: the debrief -----------------------------------------------

  function submit(): void {
    const inc = incident!;
    const score = scoreCalls(inc, calls);
    recordRun(inc.id, score);
    // One journal entry per fault present, so a review shows up in the flight
    // record at roughly the weight of a drill session rather than a single tap.
    for (const r of score.results) {
      if (r.verdict === "exact" || r.verdict === "misdiagnosed") logActivity("found");
      else if (r.verdict === "missed") logActivity("overlooked");
    }
    renderDebrief(score);
  }

  function verdictRow(
    label: string,
    turn: Turn,
    cls: string,
    line: string,
    why: string | null,
    ref: string | null,
  ): string {
    const link =
      ref !== null
        ? `<button class="lab-ref-link" data-jump="${ref}" type="button">${esc(ordinalOf(ref))} — read the section</button>`
        : "";
    return `
      <div class="bb-verdict ${cls}">
        <p class="bb-verdict-head"><span class="bb-vn">turn ${turn.n}</span> <span class="bb-vlabel">${esc(label)}</span> <span class="bb-vtext">${esc(line)}</span></p>
        ${why ? `<p class="bb-why">${esc(why)}</p>` : ""}
        ${link}
      </div>`;
  }

  function renderDebrief(score: Score): void {
    const inc = incident!;

    const rows = score.results
      .map((r) => {
        const t = r.turn;
        if (r.verdict === "exact") {
          return verdictRow(
            `called it — ${faultById(r.truth!).name}`,
            t,
            "good",
            t.text,
            t.why ?? null,
            faultById(r.truth!).ref,
          );
        }
        if (r.verdict === "misdiagnosed") {
          return verdictRow(
            `right turn, wrong fault — you said ${faultById(r.called!).name}, it was ${faultById(r.truth!).name}`,
            t,
            "part",
            t.text,
            t.why ?? null,
            faultById(r.truth!).ref,
          );
        }
        if (r.verdict === "missed") {
          return verdictRow(
            `missed — ${faultById(r.truth!).name}`,
            t,
            "bad",
            t.text,
            t.why ?? null,
            faultById(r.truth!).ref,
          );
        }
        return verdictRow(
          `false alarm — you flagged ${faultById(r.called!).name}`,
          t,
          "note",
          t.text,
          "This turn was clean. Reading a run means resisting the pull to find fault everywhere the outcome was bad — most turns in a failed run are fine, which is exactly why the bad ones survive review.",
          null,
        );
      })
      .join("");

    const store = readBlackBox();
    const rec = store[inc.id];
    const bestLine =
      rec && rec.runs > 1
        ? `Best over ${rec.runs} reviews: ${rec.best}%.`
        : "";

    card.innerHTML = `
      <p class="overlay-eyebrow">the black box · report filed</p>
      <h3 class="drill-title">${esc(inc.title)}</h3>
      <div class="lab-tiles">
        <div class="lab-tile">
          <span class="lab-tile-grade g-${score.grade}">${score.grade}</span>
          <span class="lab-tile-label">review grade</span>
        </div>
        <div class="lab-tile">
          <span class="lab-tile-num">${score.exact}/${score.total}</span>
          <span class="lab-tile-label">named exactly</span>
        </div>
        <div class="lab-tile">
          <span class="lab-tile-num">${score.recall}%</span>
          <span class="lab-tile-label">faults located</span>
        </div>
        <div class="lab-tile">
          <span class="lab-tile-num">${score.falseAlarms}</span>
          <span class="lab-tile-label">false alarms</span>
        </div>
      </div>
      <p class="drill-note">${score.found}/${score.total} faults located, ${score.exact} named correctly, ${score.precision}% of your flags landed on a real fault. ${esc(bestLine)}</p>
      <div class="lab-rec"><p>${esc(inc.moral)}</p></div>
      <h4 class="lab-h">turn by turn <span class="lab-h-ref">(${faultTurns(inc).length} faults planted)</span></h4>
      <div class="bb-verdicts">${rows}</div>
      <div class="drill-actions">
        <button class="drill-btn primary" data-act="again" type="button">review it again</button>
        <button class="drill-btn" data-act="roster" type="button">another incident</button>
        <button class="drill-btn" data-act="close" type="button">close</button>
      </div>`;

    card.querySelectorAll<HTMLButtonElement>("[data-jump]").forEach((btn) => {
      btn.addEventListener("click", () => {
        close();
        jumpTo(btn.dataset.jump!);
      });
    });
    card.querySelector("[data-act=again]")?.addEventListener("click", () => {
      calls = {};
      openPicker = null;
      renderReview();
    });
    card.querySelector("[data-act=roster]")?.addEventListener("click", renderRoster);
    card.querySelector("[data-act=close]")?.addEventListener("click", close);
  }

  return { open };
}
