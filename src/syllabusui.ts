// ---------------------------------------------------------------------------
// The syllabus — UI over syllabus.ts. Pick a target date and a pace, read the
// day-by-day plan, export it as Markdown or an .ics calendar. The plan is
// recomputed from live state on every open; only the two choices persist.
// ---------------------------------------------------------------------------

import type { Section } from "./content";
import type { QuizQuestion } from "./quiz";
import {
  buildPlan,
  buildPlanIcs,
  buildPlanMarkdown,
  dayLabel,
  isoDate,
  readPlanPrefs,
  savePlanPrefs,
  type Plan,
  type PlanItem,
  type PlanPrefs,
} from "./syllabus";

const DAY = 86_400_000;
const PACES = [2, 3, 5];
const DEFAULT_HORIZON_DAYS = 28;

type Ledger = Record<string, boolean>;

export interface SyllabusHandle {
  open(): void;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const ITEM_ICON: Record<PlanItem["kind"], string> = {
  read: "▤",
  exercise: "▶",
  drill: "↻",
  buffer: "…",
  checkride: "✈",
};

export function initSyllabus(
  sections: Section[],
  questions: QuizQuestion[],
  getLedger: () => Ledger,
  jumpTo: (sectionId: string) => void,
  toast: (msg: string) => void,
): SyllabusHandle {
  let prefs: PlanPrefs =
    readPlanPrefs() ?? {
      targetDate: isoDate(Date.now() + DEFAULT_HORIZON_DAYS * DAY),
      daysPerWeek: 3,
    };
  let plan: Plan | null = null;

  const overlay = document.createElement("div");
  overlay.className = "overlay syllabus";
  overlay.hidden = true;
  overlay.innerHTML = `<div class="overlay-card sy-card" role="dialog" aria-modal="true" aria-label="The syllabus"></div>`;
  document.body.appendChild(overlay);
  const card = overlay.querySelector<HTMLElement>(".sy-card")!;

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
    // A stored target that has slipped into the past defaults forward rather
    // than opening onto a stale refusal.
    const stored = readPlanPrefs();
    if (stored) prefs = stored;
    if (new Date(prefs.targetDate).getTime() <= Date.now()) {
      prefs = { ...prefs, targetDate: isoDate(Date.now() + DEFAULT_HORIZON_DAYS * DAY) };
    }
    recompute();
    overlay.hidden = false;
    document.addEventListener("keydown", onKey);
    render();
  }

  function recompute(): void {
    plan = buildPlan(prefs, sections, questions, getLedger(), Date.now());
    savePlanPrefs(prefs);
  }

  function planBlock(): string {
    if (!plan) return "";
    const p = plan;

    if (!p.feasible) {
      return `
        <div class="lab-rec">
          <p>${esc(p.note)}</p>
          ${p.earliestFeasible ? `<button class="drill-btn primary" data-act="accept" type="button">plan for ${p.earliestFeasible}</button>` : ""}
        </div>`;
    }

    const dayRows = p.days
      .map((day) => {
        const items = day.items
          .map(
            (it) => `
            <li class="sy-item sy-${it.kind}">
              <span class="sy-icon" aria-hidden="true">${ITEM_ICON[it.kind]}</span>
              <span class="sy-item-body">${
                it.sectionId
                  ? `<button class="sy-read-link" data-jump="${it.sectionId}" type="button">${esc(it.label)}</button>`
                  : `<strong>${esc(it.label)}</strong>`
              }${it.hint ? `<span class="sy-hint">${esc(it.hint)}</span>` : ""}</span>
            </li>`,
          )
          .join("");
        return `
          <div class="sy-day">
            <p class="sy-date">${esc(dayLabel(day.date))}<span class="sy-iso">${isoDate(day.date)}</span></p>
            <ul class="sy-items">${items}</ul>
          </div>`;
      })
      .join("");

    return `
      <p class="drill-note">${esc(p.note)}</p>
      <div class="lab-tiles">
        <div class="lab-tile"><span class="lab-tile-num">${p.days.length}</span><span class="lab-tile-label">study days</span></div>
        <div class="lab-tile"><span class="lab-tile-num">${p.sectionsToRead}</span><span class="lab-tile-label">sections to read</span></div>
        <div class="lab-tile"><span class="lab-tile-num">${p.exercisesPending}</span><span class="lab-tile-label">exercises left</span></div>
        <div class="lab-tile"><span class="lab-tile-num">${p.reviewsDue}</span><span class="lab-tile-label">reviews scheduled</span></div>
      </div>
      <div class="sy-days">${dayRows}</div>
      <div class="drill-actions">
        <button class="drill-btn primary" data-act="copy" type="button">copy as Markdown</button>
        <button class="drill-btn" data-act="ics" type="button">download .ics</button>
        <button class="drill-btn" data-act="md" type="button">download .md</button>
      </div>`;
  }

  function render(): void {
    const paceSeg = PACES.map(
      (n) =>
        `<button class="lab-seg-btn${n === prefs.daysPerWeek ? " on" : ""}" data-pace="${n}" type="button" aria-pressed="${n === prefs.daysPerWeek}">${n} days/week</button>`,
    ).join("");

    card.innerHTML = `
      <p class="overlay-eyebrow">the syllabus</p>
      <h3 class="drill-title">A study plan with a date on it</h3>
      <p class="drill-note">Pick when you want wings. The planner reads your ledger and the drill's own review schedule, spreads the unread sections in curriculum order, places each exercise after the level that teaches it, and puts the checkride at the end with a buffer day. Advisory by design — it recomputes from live progress every time you open it.</p>
      <div class="sy-controls">
        <label class="sy-date-label">target date
          <input class="sy-date-input" type="date" value="${esc(prefs.targetDate)}" />
        </label>
        <div class="lab-seg">${paceSeg}</div>
      </div>
      ${planBlock()}
      <div class="drill-actions"><button class="drill-btn" data-act="close" type="button">close</button></div>`;

    card.querySelector<HTMLInputElement>(".sy-date-input")?.addEventListener("change", (e) => {
      const v = (e.target as HTMLInputElement).value;
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
        prefs = { ...prefs, targetDate: v };
        recompute();
        render();
      }
    });

    card.querySelectorAll<HTMLButtonElement>("[data-pace]").forEach((btn) => {
      btn.addEventListener("click", () => {
        prefs = { ...prefs, daysPerWeek: Number(btn.dataset.pace) };
        recompute();
        render();
      });
    });

    card.querySelector("[data-act=accept]")?.addEventListener("click", () => {
      if (plan?.earliestFeasible) {
        prefs = { ...prefs, targetDate: plan.earliestFeasible };
        recompute();
        render();
      }
    });

    card.querySelectorAll<HTMLButtonElement>("[data-jump]").forEach((btn) => {
      btn.addEventListener("click", () => {
        close();
        jumpTo(btn.dataset.jump!);
      });
    });

    card.querySelector("[data-act=copy]")?.addEventListener("click", () => {
      if (!plan) return;
      const md = buildPlanMarkdown(plan, prefs);
      navigator.clipboard.writeText(md).then(
        () => toast("syllabus copied as Markdown"),
        () => window.prompt("Copy the syllabus:", md),
      );
    });

    card.querySelector("[data-act=md]")?.addEventListener("click", () => {
      if (!plan) return;
      download(buildPlanMarkdown(plan, prefs), "study-syllabus.md", "text/markdown");
    });

    card.querySelector("[data-act=ics]")?.addEventListener("click", () => {
      if (!plan) return;
      download(buildPlanIcs(plan, Date.now()), "study-syllabus.ics", "text/calendar");
    });

    card.querySelector("[data-act=close]")?.addEventListener("click", close);
  }

  function download(content: string, filename: string, mime: string): void {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast(`${filename} downloaded`);
  }

  return { open };
}
