// ---------------------------------------------------------------------------
// Flight record — the retention dashboard. Reads three per-device stores it
// never writes: the activity log (activity.ts), the SRS schedule (drill.ts),
// and the reading ledger (passed in from main.ts). Everything is recomputed
// on open, so it always reflects the current state. Zero dependencies: the
// heatmap and charts are plain DOM + CSS.
// ---------------------------------------------------------------------------

import type { Section } from "./content";
import type { QuizQuestion } from "./quiz";
import { readActivity } from "./activity";
import { readSrsSnapshot } from "./drill";
import { INCIDENTS, readBlackBox } from "./blackbox";
import { DEPLOYMENTS, readRange } from "./range";

const DAY = 86_400_000;
const HEAT_DAYS = 84; // 12 weeks
const FORECAST_DAYS = 14;

type Ledger = Record<string, boolean>;

export interface StatsHandle {
  open(): void;
}

/** Local-midnight timestamp for the day containing t. */
function dayStart(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dayLabel(t: number): string {
  return new Date(t).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function initStats(
  sections: Section[],
  questions: QuizQuestion[],
  getLedger: () => Ledger,
): StatsHandle {
  const overlay = document.createElement("div");
  overlay.className = "overlay stats";
  overlay.hidden = true;
  overlay.innerHTML = `<div class="overlay-card fr-card" role="dialog" aria-modal="true" aria-label="Flight record"></div>`;
  document.body.appendChild(overlay);
  const card = overlay.querySelector<HTMLElement>(".fr-card")!;

  function close(): void {
    overlay.hidden = true;
    document.removeEventListener("keydown", onKey);
  }

  function onKey(e: KeyboardEvent): void {
    if (!overlay.hidden && e.key === "Escape") close();
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  function open(): void {
    overlay.hidden = false;
    document.addEventListener("keydown", onKey);
    render();
  }

  function render(): void {
    const events = readActivity();
    const srs = readSrsSnapshot();
    const ledger = getLedger();
    const today = dayStart(Date.now());

    // --- per-day activity counts -----------------------------------------
    const perDay = new Map<number, number>();
    for (const ev of events) {
      const d = dayStart(ev.t);
      perDay.set(d, (perDay.get(d) ?? 0) + 1);
    }

    // --- streaks -----------------------------------------------------------
    let streak = 0;
    let cursor = perDay.has(today) ? today : today - DAY; // today optional
    while (perDay.has(cursor)) {
      streak += 1;
      cursor -= DAY;
    }
    let longest = 0;
    for (const d of perDay.keys()) {
      if (perDay.has(d - DAY)) continue; // only count from run starts
      let len = 0;
      let c = d;
      while (perDay.has(c)) {
        len += 1;
        c += DAY;
      }
      longest = Math.max(longest, len);
    }

    const hits = events.filter((e) => e.k === "hit").length;
    const misses = events.filter((e) => e.k === "miss").length;
    const reviews = hits + misses;
    const accuracy = reviews > 0 ? Math.round((hits / reviews) * 100) : null;

    const tiles = `
      <div class="fr-tiles">
        <div class="fr-tile"><strong>${streak}</strong><span>day streak</span></div>
        <div class="fr-tile"><strong>${longest}</strong><span>longest streak</span></div>
        <div class="fr-tile"><strong>${reviews}</strong><span>cards reviewed</span></div>
        <div class="fr-tile"><strong>${accuracy === null ? "—" : `${accuracy}%`}</strong><span>from memory</span></div>
      </div>`;

    // --- heatmap: last 12 weeks, one column per week ------------------------
    const cells: string[] = [];
    for (let i = HEAT_DAYS - 1; i >= 0; i--) {
      const d = today - i * DAY;
      const n = perDay.get(d) ?? 0;
      const q = n === 0 ? 0 : n <= 2 ? 1 : n <= 5 ? 2 : n <= 11 ? 3 : 4;
      cells.push(
        `<div class="fr-cell q${q}" title="${dayLabel(d)} — ${n} action${n === 1 ? "" : "s"}"></div>`,
      );
    }
    const heat = `
      <h4 class="lab-h">last 12 weeks</h4>
      <div class="fr-heat" role="img" aria-label="Study activity, last 12 weeks">${cells.join("")}</div>`;

    // --- mastery by section --------------------------------------------------
    const masteryRows = sections
      .map((s) => {
        const qs = questions.filter((q) => q.sectionId === s.id);
        if (qs.length === 0) return "";
        const seen = qs.filter((q) => srs[q.id]).length;
        const boxSum = qs.reduce((acc, q) => acc + (srs[q.id]?.box ?? 0), 0);
        const pct = Math.round((boxSum / (qs.length * 5)) * 100);
        return `
          <div class="fr-mastery-row">
            <span class="ord pal-ord">${s.ordinal}</span>
            <span class="fr-mastery-title">${s.title}${ledger[s.id] ? ` <span class="fr-read" title="section marked done">✓</span>` : ""}</span>
            <div class="fr-mastery-bar"><div class="fr-mastery-fill" style="width:${pct}%"></div></div>
            <span class="fr-mastery-meta">${seen}/${qs.length} cards</span>
          </div>`;
      })
      .join("");
    const mastery = `
      <h4 class="lab-h">recall mastery <span class="lab-h-ref">(avg Leitner box, 0–5)</span></h4>
      <div class="fr-mastery">${masteryRows}</div>`;

    // --- 14-day review forecast ----------------------------------------------
    const dueCounts = new Array<number>(FORECAST_DAYS).fill(0);
    for (const q of questions) {
      const state = srs[q.id];
      if (!state) continue;
      const idx = Math.max(0, Math.floor((dayStart(state.due) - today) / DAY));
      if (idx < FORECAST_DAYS) dueCounts[idx] += 1;
    }
    const maxDue = Math.max(1, ...dueCounts);
    const bars = dueCounts
      .map((n, i) => {
        const d = today + i * DAY;
        const h = n === 0 ? 4 : 8 + (n / maxDue) * 44;
        return `<div class="fr-fc-col" title="${dayLabel(d)} — ${n} card${n === 1 ? "" : "s"} due">
          <div class="fr-fc-bar${n > 0 ? " has" : ""}" style="height:${Math.round(h)}px"></div>
          <span class="fr-fc-day">${i === 0 ? "now" : i}</span>
        </div>`;
      })
      .join("");
    const forecast = `
      <h4 class="lab-h">review forecast <span class="lab-h-ref">(next 14 days)</span></h4>
      <div class="fr-forecast">${bars}</div>`;

    // --- trajectory review ---------------------------------------------------
    // Deliberately not folded into the recall numbers above: reading a run is a
    // different skill from remembering what a section said, and a reader who is
    // strong at one and weak at the other should be able to see that.
    const bb = readBlackBox();
    const found = events.filter((e) => e.k === "found").length;
    const overlooked = events.filter((e) => e.k === "overlooked").length;
    const flown = INCIDENTS.filter((i) => bb[i.id]).length;
    const incidentRows = INCIDENTS.map((inc) => {
      const rec = bb[inc.id];
      return `
        <div class="fr-mastery-row">
          <span class="ord pal-ord">${rec ? rec.lastGrade : "—"}</span>
          <span class="fr-mastery-title">${inc.title}</span>
          <div class="fr-mastery-bar"><div class="fr-mastery-fill" style="width:${rec?.best ?? 0}%"></div></div>
          <span class="fr-mastery-meta">${rec ? `${rec.best}% · ${rec.runs} review${rec.runs === 1 ? "" : "s"}` : "unflown"}</span>
        </div>`;
    }).join("");
    const eye =
      found + overlooked > 0
        ? `${Math.round((found / (found + overlooked)) * 100)}% of planted faults spotted across ${flown}/${INCIDENTS.length} incidents.`
        : `No incidents reviewed yet — the black box is where reading a run gets practised.`;
    const trajectory = `
      <h4 class="lab-h">trajectory review <span class="lab-h-ref">(the black box)</span></h4>
      <p class="fr-sub">${eye}</p>
      <div class="fr-mastery">${incidentRows}</div>`;

    // --- the range -----------------------------------------------------------
    // Two numbers, deliberately side by side: how much risk the reader's best
    // posture removed, and how well they predicted their own posture. The
    // second is the one that says whether the first will survive a busy week.
    const rangeStore = readRange();
    const rangeRows = DEPLOYMENTS.map((d) => {
      const rec = rangeStore[d.id];
      return `
        <div class="fr-mastery-row">
          <span class="ord pal-ord">${rec ? rec.grade : "—"}</span>
          <span class="fr-mastery-title">${d.name}</span>
          <div class="fr-mastery-bar"><div class="fr-mastery-fill" style="width:${rec?.best ?? 0}%"></div></div>
          <span class="fr-mastery-meta">${rec ? `${rec.best}% · ${rec.friction} pts · calls ${rec.bestCal}%` : "unrun"}</span>
        </div>`;
    }).join("");
    const held = events.filter((e) => e.k === "held").length;
    const breached = events.filter((e) => e.k === "breached").length;
    const rangeRun = DEPLOYMENTS.filter((d) => rangeStore[d.id]).length;
    const rangeNote =
      held + breached > 0
        ? `${Math.round((held / (held + breached)) * 100)}% of threat chains contained across ${rangeRun}/${DEPLOYMENTS.length} deployments hardened.`
        : `No deployment hardened yet — the range is where the threat model gets practised against a budget.`;
    const rangePanel = `
      <h4 class="lab-h">threat posture <span class="lab-h-ref">(the range)</span></h4>
      <p class="fr-sub">${rangeNote}</p>
      <div class="fr-mastery">${rangeRows}</div>`;

    card.innerHTML = `
      <p class="overlay-eyebrow">flight record</p>
      <h3 class="drill-title">Your study telemetry</h3>
      <p class="drill-note">Reading, drilling and retention on this device — the same handoff-artifact discipline the guide preaches for agents (L7), applied to you.</p>
      ${tiles}
      ${heat}
      ${mastery}
      ${trajectory}
      ${rangePanel}
      ${forecast}
      <div class="drill-actions">
        <button class="drill-btn" data-act="close" type="button">close</button>
      </div>`;

    card.querySelector("[data-act=close]")?.addEventListener("click", close);
  }

  return { open };
}
