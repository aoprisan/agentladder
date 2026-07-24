// ---------------------------------------------------------------------------
// Recall drill — a Leitner-box spaced-repetition scheduler over the question
// bank, persisted per-device in localStorage (separate store from the reading
// ledger, so clearing one never touches the other). Zero dependencies: the
// scheduler is ~40 lines and the UI is a hand-rolled modal overlay.
//
// Scheduling model: every card sits in a box 0–5. A correct answer promotes
// it one box and pushes its due date out by that box's interval; a wrong
// answer drops it back to box 0 and re-queues it in minutes, not days.
// ---------------------------------------------------------------------------

import type { QuizQuestion } from "./quiz";

const SRS_KEY = "agentic-guide-srs-v1";
const DAY = 86_400_000;
const RETRY_MS = 60_000; // wrong answers come back almost immediately
const INTERVAL_DAYS = [0, 1, 3, 7, 16, 35]; // box index → days until next review
const SESSION_CAP = 12;

interface CardState {
  box: number;
  due: number; // epoch ms
  seen: number;
  lapses: number;
}

type SrsStore = Record<string, CardState>;

function loadStore(): SrsStore {
  try {
    const raw = localStorage.getItem(SRS_KEY);
    return raw ? (JSON.parse(raw) as SrsStore) : {};
  } catch {
    return {};
  }
}

function saveStore(store: SrsStore): void {
  try {
    localStorage.setItem(SRS_KEY, JSON.stringify(store));
  } catch {
    /* private mode etc. — recall scheduling just won't persist */
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface DrillHandle {
  open(): void;
  /** cards reviewable right now: overdue + never-seen */
  readyCount(): number;
}

export function initDrill(
  questions: QuizQuestion[],
  ordinalOf: (sectionId: string) => string,
  onStateChange: () => void,
): DrillHandle {
  let store = loadStore();

  const dueCards = () => questions.filter((q) => store[q.id] && store[q.id].due <= Date.now());
  const newCards = () => questions.filter((q) => !store[q.id]);
  const readyCount = () => dueCards().length + newCards().length;

  function nextDueText(): string {
    const times = questions.map((q) => store[q.id]?.due ?? 0).filter((t) => t > Date.now());
    if (times.length === 0) return "";
    const next = Math.min(...times);
    const days = Math.ceil((next - Date.now()) / DAY);
    if (days <= 1) return "tomorrow";
    return `in ${days} days`;
  }

  function grade(q: QuizQuestion, correct: boolean): void {
    const s = store[q.id] ?? { box: 0, due: 0, seen: 0, lapses: 0 };
    s.seen += 1;
    if (correct) {
      s.box = Math.min(s.box + 1, INTERVAL_DAYS.length - 1);
      s.due = Date.now() + INTERVAL_DAYS[s.box] * DAY;
    } else {
      s.box = 0;
      s.lapses += 1;
      s.due = Date.now() + RETRY_MS;
    }
    store[q.id] = s;
    saveStore(store);
    onStateChange();
  }

  // --- overlay DOM ---------------------------------------------------------
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.hidden = true;
  overlay.innerHTML = `<div class="overlay-card" role="dialog" aria-modal="true" aria-label="Recall drill"></div>`;
  document.body.appendChild(overlay);
  const card = overlay.querySelector<HTMLElement>(".overlay-card")!;

  let session: QuizQuestion[] = [];
  let index = 0;
  let scoreCorrect = 0;
  let answered = false;

  function close(): void {
    overlay.hidden = true;
    document.removeEventListener("keydown", onKey);
  }

  function open(): void {
    store = loadStore(); // pick up state from other tabs
    session = [
      ...shuffle(dueCards()),
      ...shuffle(newCards()),
    ].slice(0, SESSION_CAP);
    index = 0;
    scoreCorrect = 0;
    overlay.hidden = false;
    document.addEventListener("keydown", onKey);
    if (session.length === 0) renderAllClear();
    else renderIntro();
  }

  function renderAllClear(): void {
    const when = nextDueText();
    card.innerHTML = `
      <p class="overlay-eyebrow">recall drill</p>
      <h3 class="drill-title">All caught up</h3>
      <p class="drill-note">Every card is scheduled out. ${
        when ? `Next review comes due ${when}.` : "Read some sections, then come back."
      }</p>
      <div class="drill-actions"><button class="drill-btn" data-act="close">close</button></div>`;
    wireActions();
  }

  function renderIntro(): void {
    const due = session.filter((q) => store[q.id]).length;
    const fresh = session.length - due;
    const parts = [
      due > 0 ? `${due} due for review` : "",
      fresh > 0 ? `${fresh} new` : "",
    ].filter(Boolean);
    card.innerHTML = `
      <p class="overlay-eyebrow">recall drill</p>
      <h3 class="drill-title">${session.length} card${session.length === 1 ? "" : "s"} ready</h3>
      <p class="drill-note">${parts.join(" · ")}. Answer from memory — cards you miss come back sooner; cards you know retreat to longer intervals. Progress is stored on this device.</p>
      <div class="drill-actions">
        <button class="drill-btn primary" data-act="start">start</button>
        <button class="drill-btn" data-act="close">not now</button>
      </div>`;
    wireActions();
  }

  function renderQuestion(): void {
    const q = session[index];
    answered = false;
    const opts = q.options
      .map(
        (o, i) =>
          `<button class="drill-opt" data-i="${i}"><span class="opt-key">${i + 1}</span><span>${o}</span></button>`,
      )
      .join("");
    card.innerHTML = `
      <p class="overlay-eyebrow">recall drill · card ${index + 1}/${session.length} · <span class="drill-ord">${ordinalOf(q.sectionId)}</span></p>
      <h3 class="drill-prompt">${q.prompt}</h3>
      <div class="drill-options">${opts}</div>
      <div class="drill-feedback" hidden></div>
      <div class="drill-actions">
        <button class="drill-btn" data-act="close">quit</button>
      </div>`;
    card.querySelectorAll<HTMLButtonElement>(".drill-opt").forEach((btn) => {
      btn.addEventListener("click", () => answer(Number(btn.dataset.i)));
    });
    wireActions();
  }

  function answer(picked: number): void {
    if (answered) return;
    answered = true;
    const q = session[index];
    const correct = picked === q.answer;
    if (correct) scoreCorrect += 1;
    grade(q, correct);

    card.querySelectorAll<HTMLButtonElement>(".drill-opt").forEach((btn) => {
      const i = Number(btn.dataset.i);
      btn.disabled = true;
      if (i === q.answer) btn.classList.add("is-correct");
      else if (i === picked) btn.classList.add("is-wrong");
    });

    const fb = card.querySelector<HTMLElement>(".drill-feedback")!;
    fb.hidden = false;
    fb.innerHTML = `
      <p class="fb-verdict ${correct ? "good" : "bad"}">${correct ? "correct" : "not quite"}</p>
      <p class="fb-explain">${q.explain}</p>`;

    const actions = card.querySelector<HTMLElement>(".drill-actions")!;
    actions.innerHTML = `<button class="drill-btn primary" data-act="next">${
      index + 1 < session.length ? "next card" : "finish"
    }</button>`;
    wireActions();
    actions.querySelector<HTMLButtonElement>("[data-act=next]")?.focus();
  }

  function next(): void {
    index += 1;
    if (index < session.length) renderQuestion();
    else renderSummary();
  }

  function renderSummary(): void {
    const when = nextDueText();
    const pct = Math.round((scoreCorrect / session.length) * 100);
    card.innerHTML = `
      <p class="overlay-eyebrow">recall drill · session complete</p>
      <h3 class="drill-title">${scoreCorrect}/${session.length} from memory <span class="drill-pct">(${pct}%)</span></h3>
      <p class="drill-note">${
        scoreCorrect === session.length
          ? "Clean sweep — these cards retreat to longer intervals."
          : "Missed cards return within minutes; drill again before you close the tab, or catch them next session."
      }${when ? ` Next scheduled review: ${when}.` : ""}</p>
      <div class="drill-actions">
        ${readyCount() > 0 ? `<button class="drill-btn primary" data-act="again">drill again</button>` : ""}
        <button class="drill-btn" data-act="close">done</button>
      </div>`;
    wireActions();
  }

  function wireActions(): void {
    card.querySelectorAll<HTMLButtonElement>("[data-act]").forEach((btn) => {
      const act = btn.dataset.act;
      btn.addEventListener("click", () => {
        if (act === "close") close();
        else if (act === "start") renderQuestion();
        else if (act === "next") next();
        else if (act === "again") open();
      });
    });
  }

  function onKey(e: KeyboardEvent): void {
    if (overlay.hidden) return;
    if (e.key === "Escape") {
      close();
      return;
    }
    if (!answered) {
      const n = Number(e.key);
      if (n >= 1 && n <= 4) {
        const btn = card.querySelector<HTMLButtonElement>(`.drill-opt[data-i="${n - 1}"]`);
        if (btn && !btn.disabled) {
          e.preventDefault();
          btn.click();
        }
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      card.querySelector<HTMLButtonElement>("[data-act=next]")?.click();
    }
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  return { open, readyCount };
}
