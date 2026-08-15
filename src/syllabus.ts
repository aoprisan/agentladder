// ---------------------------------------------------------------------------
// The syllabus — a study plan with a date on it. Pure logic, no DOM
// (syllabusui.ts owns the overlay).
//
// The guide has a curriculum (the sections array), a scheduler (the drill's
// Leitner boxes), a forecast (the flight record), and an exam (the
// checkride) — this is the bridge from "wings by the 30th" to "here is what
// to do each day". It reads the same stores the flight record reads, all of
// them read-only, and recomputes the plan on every open from live state:
// reading ahead or missing a day just reshapes the remaining schedule.
//
// The exercise-to-level placement encodes the curriculum's shape — re-check
// it when levels are added. Interval math follows drill.ts's boxes via
// readSrsSnapshot(); nothing here duplicates the scheduler.
//
// Only the reader's two choices persist (agentic-guide-plan-v1): the target
// date and the days-per-week. The plan itself is always derived.
// ---------------------------------------------------------------------------

import type { Section } from "./content";
import type { QuizQuestion } from "./quiz";
import { readSrsSnapshot } from "./drill";
import { readBlackBox } from "./blackbox";
import { readRange } from "./range";
import { readBenchRuns } from "./bench";
import { readBestWings } from "./checkride";

const PLAN_KEY = "agentic-guide-plan-v1";
const DAY = 86_400_000;
const SECTIONS_PER_DAY = 2;

export interface PlanPrefs {
  targetDate: string; // yyyy-mm-dd
  daysPerWeek: number; // 1–7
}

export function readPlanPrefs(): PlanPrefs | null {
  try {
    const raw = localStorage.getItem(PLAN_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PlanPrefs;
    return /^\d{4}-\d{2}-\d{2}$/.test(p.targetDate) && p.daysPerWeek >= 1 && p.daysPerWeek <= 7
      ? p
      : null;
  } catch {
    return null;
  }
}

export function savePlanPrefs(p: PlanPrefs): void {
  try {
    localStorage.setItem(PLAN_KEY, JSON.stringify(p));
  } catch {
    /* private mode etc. — the choices just won't persist */
  }
}

// ---------------------------------------------------------------------------
// Date helpers — day granularity, local time. "now" is injected throughout so
// the layout is a pure function of its inputs.
// ---------------------------------------------------------------------------

function dayStart(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function isoDate(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseIso(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const t = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
  return Number.isFinite(t) ? t : null;
}

function ymd(t: number): string {
  return isoDate(t).replace(/-/g, "");
}

export function dayLabel(t: number): string {
  return new Date(t).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Monday-start week key for a day, so "N days a week" means calendar weeks. */
function weekKey(t: number): number {
  const d = new Date(t);
  const dow = (d.getDay() + 6) % 7; // Mon=0
  return dayStart(t - dow * DAY);
}

// ---------------------------------------------------------------------------
// Exercise milestones — where the guide's instruments sit in the curriculum.
// ---------------------------------------------------------------------------

interface Milestone {
  id: string;
  title: string;
  hint: string;
  /** scheduled after this section is read (or already-read) */
  afterSection: string;
  done: boolean;
}

function milestonesNow(): Milestone[] {
  return [
    {
      id: "lab",
      title: "Fly the pattern lab",
      hint: "one deliberately bad run, then the fit-for-purpose setup — the debrief links back into L1–L3",
      afterSection: "tool-design",
      done: false, // the lab keeps no store; if you've already flown it, skip the day
    },
    {
      id: "bench",
      title: "Review a real artifact on the bench",
      hint: "bring the CLAUDE.md or prompt you actually maintain",
      afterSection: "prompt-formats",
      done: readBenchRuns().length > 0,
    },
    {
      id: "blackbox",
      title: "Read an incident in the black box",
      hint: "flag the turns where a recorded run went wrong and name the fault",
      afterSection: "claude-code",
      done: Object.keys(readBlackBox()).length > 0,
    },
    {
      id: "range",
      title: "Harden a deployment on the range",
      hint: "spend the friction budget, call your own posture, watch the routes",
      afterSection: "hardening",
      done: Object.keys(readRange()).length > 0,
    },
  ];
}

// ---------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------

export interface PlanItem {
  kind: "read" | "exercise" | "drill" | "buffer" | "checkride";
  label: string;
  hint?: string;
  sectionId?: string;
}

export interface PlanDay {
  date: number; // local-midnight epoch ms
  items: PlanItem[];
}

export interface Plan {
  feasible: boolean;
  days: PlanDay[];
  /** headline: what the plan covers, or why the date doesn't work */
  note: string;
  /** counter-offer when infeasible: the earliest date that fits, yyyy-mm-dd */
  earliestFeasible?: string;
  slotsNeeded: number;
  studyDaysAvailable: number;
  sectionsToRead: number;
  exercisesPending: number;
  reviewsDue: number;
}

/** Study days between tomorrow and target (inclusive): the first
 *  `daysPerWeek` days of each calendar week in the range. */
function studyDays(today: number, target: number, daysPerWeek: number): number[] {
  const out: number[] = [];
  const perWeek = new Map<number, number>();
  for (let d = today + DAY; d <= target; d += DAY) {
    const wk = weekKey(d);
    const used = perWeek.get(wk) ?? 0;
    if (used < daysPerWeek) {
      perWeek.set(wk, used + 1);
      out.push(d);
    }
  }
  return out;
}

type Ledger = Record<string, boolean>;

export function buildPlan(
  prefs: PlanPrefs,
  sections: Section[],
  questions: QuizQuestion[],
  ledger: Ledger,
  now: number,
): Plan {
  const today = dayStart(now);
  const target = parseIso(prefs.targetDate);

  const unread = sections.filter((s) => !ledger[s.id]);
  const milestones = milestonesNow();
  const pendingByGate = new Map<string, Milestone[]>();
  for (const m of milestones) {
    if (m.done) continue;
    const list = pendingByGate.get(m.afterSection) ?? [];
    list.push(m);
    pendingByGate.set(m.afterSection, list);
  }
  const exercisesPending = milestones.filter((m) => !m.done).length;

  // --- the ordered slot queue: reads (paired) and exercises ------------------
  const slots: PlanItem[][] = [];
  let readBuffer: PlanItem[] = [];
  const flushReads = (): void => {
    if (readBuffer.length > 0) slots.push(readBuffer);
    readBuffer = [];
  };
  for (const s of sections) {
    if (!ledger[s.id]) {
      readBuffer.push({
        kind: "read",
        label: `${s.ordinal} · ${s.title}`,
        hint: s.tagline,
        sectionId: s.id,
      });
      if (readBuffer.length === SECTIONS_PER_DAY) flushReads();
    }
    for (const m of pendingByGate.get(s.id) ?? []) {
      flushReads();
      slots.push([{ kind: "exercise", label: m.title, hint: m.hint }]);
    }
  }
  flushReads();

  const wings = readBestWings();
  const finale: PlanItem[][] = [
    [
      {
        kind: "buffer",
        label: "Buffer day — drill only",
        hint: "clear the review queue; nothing new the day before the exam",
      },
    ],
    [
      {
        kind: "checkride",
        label: wings && wings.pct >= 80 ? "Retake the checkride" : "The checkride",
        hint:
          wings && wings.pct >= 80
            ? `wings already earned at ${wings.pct}% — this pass is for the streak`
            : "15 questions across every level, pass mark 80% — wings travel by link",
      },
    ],
  ];

  const slotsNeeded = slots.length + finale.length;

  // --- review load from the drill's own schedule -----------------------------
  const srs = readSrsSnapshot();
  const dueDays: number[] = [];
  for (const q of questions) {
    const st = srs[q.id];
    if (st) dueDays.push(Math.max(today, dayStart(st.due)));
  }
  const reviewsDue = dueDays.length;

  // --- feasibility ------------------------------------------------------------
  const available = target !== null && target > today ? studyDays(today, target, prefs.daysPerWeek) : [];

  if (target === null || target <= today || available.length < slotsNeeded) {
    // Counter-offer: extend day by day until the study days fit the work.
    let probe = Math.max(target ?? today, today);
    let days: number[] = [];
    while (days.length < slotsNeeded) {
      probe += DAY;
      days = studyDays(today, probe, prefs.daysPerWeek);
    }
    const why =
      target === null || target <= today
        ? "That target isn't in the future."
        : `That date doesn't fit: the remaining work needs ${slotsNeeded} study day${slotsNeeded === 1 ? "" : "s"}, and ${prefs.daysPerWeek}/week until then gives you ${available.length}.`;
    return {
      feasible: false,
      days: [],
      note: `${why} Earliest date that fits at ${prefs.daysPerWeek} day${prefs.daysPerWeek === 1 ? "" : "s"} a week: ${isoDate(probe)}. The plan won't cram — it degrades honestly.`,
      earliestFeasible: isoDate(probe),
      slotsNeeded,
      studyDaysAvailable: available.length,
      sectionsToRead: unread.length,
      exercisesPending,
      reviewsDue,
    };
  }

  // --- lay the slots onto the days -------------------------------------------
  // Content fills from the start; the buffer and checkride take the last two
  // study days, so slack lands in the middle where drift can absorb it.
  const days: PlanDay[] = available.map((date) => ({ date, items: [] }));
  slots.forEach((slot, i) => days[i].items.push(...slot));
  finale.forEach((slot, i) => {
    days[days.length - finale.length + i].items.push(...slot);
  });

  // Drill days: reviews come due per the Leitner schedule; cards due on
  // non-study days roll forward to the next study day, and anything due past
  // the target lands on the final day.
  const counted = new Array<number>(days.length).fill(0);
  for (const due of dueDays) {
    let idx = days.findIndex((d) => d.date >= due);
    if (idx === -1) idx = days.length - 1;
    counted[idx] += 1;
  }
  days.forEach((d, i) => {
    if (counted[i] > 0) {
      d.items.push({
        kind: "drill",
        label: `Drill — ~${counted[i]} card${counted[i] === 1 ? "" : "s"} due`,
        hint: "the scheduler's numbers, not the plan's — open the drill and it knows",
      });
    }
  });

  const withWork = days.filter((d) => d.items.length > 0);

  return {
    feasible: true,
    days: withWork,
    note:
      unread.length === 0
        ? `Nothing left to read — this plan is reviews, the ${exercisesPending} remaining exercise${exercisesPending === 1 ? "" : "s"}, and the checkride.`
        : `${unread.length} section${unread.length === 1 ? "" : "s"} to read, ${exercisesPending} exercise${exercisesPending === 1 ? "" : "s"}, and the checkride by ${prefs.targetDate}, at ${prefs.daysPerWeek} day${prefs.daysPerWeek === 1 ? "" : "s"} a week.`,
    slotsNeeded,
    studyDaysAvailable: available.length,
    sectionsToRead: unread.length,
    exercisesPending,
    reviewsDue,
  };
}

// ---------------------------------------------------------------------------
// Exports — Markdown for a team channel, and a hand-rolled .ics (a text
// format; no library, consistent with the hand-rolled service worker).
// ---------------------------------------------------------------------------

export function buildPlanMarkdown(plan: Plan, prefs: PlanPrefs): string {
  const lines: string[] = [
    `# Study syllabus — wings by ${prefs.targetDate}`,
    "",
    plan.note,
    "",
  ];
  for (const day of plan.days) {
    lines.push(`## ${dayLabel(day.date)} (${isoDate(day.date)})`, "");
    for (const item of day.items) {
      lines.push(`- [ ] **${item.label}**${item.hint ? ` — ${item.hint}` : ""}`);
    }
    lines.push("");
  }
  lines.push(
    "_Generated locally by the agentic-workflows field guide's syllabus planner. The plan is advisory and recomputed from live progress — reading ahead or missing a day just reshapes the rest._",
  );
  return lines.join("\n");
}

function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function buildPlanIcs(plan: Plan, now: number): string {
  const stamp = `${ymd(dayStart(now))}T000000Z`;
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//agentladder//syllabus//EN",
    "CALSCALE:GREGORIAN",
  ];
  for (const day of plan.days) {
    const summary = day.items.map((i) => i.label).join(" · ");
    lines.push(
      "BEGIN:VEVENT",
      `UID:agentladder-syllabus-${ymd(day.date)}@agentic-guide`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(day.date)}`,
      `DTEND;VALUE=DATE:${ymd(day.date + DAY)}`,
      `SUMMARY:${icsEscape(`Guide study: ${summary}`)}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
