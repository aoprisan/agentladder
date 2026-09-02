// ---------------------------------------------------------------------------
// The checkride — a one-pass certification exam over the drill question bank,
// aviation-style: no feedback until the end, pass mark 80%, and a shareable
// "wings" link on success. Unlike the drill (drill.ts), nothing here touches
// SRS scheduling — the checkride grades, it doesn't teach.
//
// The certificate travels the same no-backend way as share links:
//
//   #wings=1.<pct>.<yyyymmdd>.<name>.<checksum>
//
// where <name> is URI-encoded and <checksum> is a salted djb2 over the other
// fields — tamper-evidence for a team ritual, not cryptography. main.ts shows
// a banner when a wings hash is present. Best local result persists under
// agentic-guide-wings-v1 (its own store, like every other feature).
// ---------------------------------------------------------------------------

import type { Section } from "./content";
import type { QuizQuestion } from "./quiz";
import { logActivity } from "./activity";

const WINGS_KEY = "agentic-guide-wings-v1";
// One question per section that carries questions is the floor (16 of them
// as of L12 — the glossary has none), so the exam size has to stay above
// that count for the random fill — and the variety it buys — to mean
// anything.
const EXAM_SIZE = 20;
const PASS_PCT = 80;
const SALT = "agentladder-wings";

export interface CheckrideHandle {
  open(): void;
}

interface BestResult {
  pct: number;
  date: string; // yyyymmdd
  name: string;
}

function loadBest(): BestResult | null {
  try {
    const raw = localStorage.getItem(WINGS_KEY);
    return raw ? (JSON.parse(raw) as BestResult) : null;
  } catch {
    return null;
  }
}

function saveBest(b: BestResult): void {
  try {
    localStorage.setItem(WINGS_KEY, JSON.stringify(b));
  } catch {
    /* private mode etc. — the wings just won't persist */
  }
}

function checksum(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, "0").slice(0, 6);
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDate(yyyymmdd: string): string {
  if (!/^\d{8}$/.test(yyyymmdd)) return yyyymmdd;
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

export function buildWingsUrl(pct: number, date: string, name: string): string {
  // "." delimits the payload fields, and encodeURIComponent leaves it alone —
  // escape it by hand so names like "J.R." survive the round trip.
  const enc = encodeURIComponent(name).replace(/\./g, "%2E");
  const sum = checksum(`1.${pct}.${date}.${name}.${SALT}`);
  const base = location.href.split("#")[0];
  return `${base}#wings=1.${pct}.${date}.${enc}.${sum}`;
}

export interface WingsPayload {
  pct: number;
  date: string; // formatted yyyy-mm-dd
  name: string;
  valid: boolean; // checksum matched
}

export function readWingsHash(): WingsPayload | null {
  const m = location.hash.match(/^#wings=1\.(\d{1,3})\.(\d{8})\.([^.]*)\.([0-9a-f]{6})$/i);
  if (!m) return null;
  const pct = Number(m[1]);
  if (pct > 100) return null;
  const name = decodeURIComponent(m[3]);
  const valid = checksum(`1.${pct}.${m[2]}.${name}.${SALT}`) === m[4].toLowerCase();
  return { pct, date: fmtDate(m[2]), name, valid };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** One question per section first (coverage), then random fill to EXAM_SIZE. */
function buildExam(sections: Section[], bank: QuizQuestion[]): QuizQuestion[] {
  const picked: QuizQuestion[] = [];
  for (const s of sections) {
    const pool = shuffle(bank.filter((q) => q.sectionId === s.id));
    if (pool.length > 0) picked.push(pool[0]);
  }
  const rest = shuffle(bank.filter((q) => !picked.includes(q)));
  while (picked.length < EXAM_SIZE && rest.length > 0) picked.push(rest.pop()!);
  return shuffle(picked.slice(0, EXAM_SIZE));
}

export function initCheckride(
  sections: Section[],
  bank: QuizQuestion[],
  ordinalOf: (sectionId: string) => string,
  jumpTo: (sectionId: string) => void,
  toast: (msg: string) => void,
): CheckrideHandle {
  let exam: QuizQuestion[] = [];
  let answers: number[] = []; // chosen option index per exam question
  let idx = 0;

  const overlay = document.createElement("div");
  overlay.className = "overlay ride";
  overlay.hidden = true;
  overlay.innerHTML = `<div class="overlay-card ride-card" role="dialog" aria-modal="true" aria-label="The checkride"></div>`;
  document.body.appendChild(overlay);
  const card = overlay.querySelector<HTMLElement>(".ride-card")!;

  function close(): void {
    overlay.hidden = true;
    document.removeEventListener("keydown", onKey);
  }

  function onKey(e: KeyboardEvent): void {
    if (overlay.hidden) return;
    if (e.key === "Escape") close();
    const n = Number(e.key);
    if (n >= 1 && n <= 4) {
      card.querySelector<HTMLButtonElement>(`[data-pick="${n - 1}"]`)?.click();
    }
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  function open(): void {
    overlay.hidden = false;
    document.addEventListener("keydown", onKey);
    renderIntro();
  }

  // --- intro --------------------------------------------------------------

  function renderIntro(): void {
    const best = loadBest();
    card.innerHTML = `
      <p class="overlay-eyebrow">the checkride</p>
      <h3 class="drill-title">Earn your wings</h3>
      <p class="drill-note">${EXAM_SIZE} questions sampled across every level. One pass, no feedback until the end, pass mark ${PASS_PCT}%. Unlike the drill, this doesn't touch your review schedule — it's the exam, not the studying.</p>
      ${best ? `<p class="drill-note">Best so far: <strong>${best.pct}%</strong> on ${fmtDate(best.date)}.</p>` : ""}
      <div class="drill-actions">
        <button class="drill-btn primary" data-act="start" type="button">begin</button>
        <button class="drill-btn" data-act="close" type="button">not yet</button>
      </div>`;
    card.querySelector("[data-act=start]")?.addEventListener("click", () => {
      exam = buildExam(sections, bank);
      answers = [];
      idx = 0;
      renderQuestion();
    });
    card.querySelector("[data-act=close]")?.addEventListener("click", close);
  }

  // --- questions ------------------------------------------------------------

  function renderQuestion(): void {
    const q = exam[idx];
    const opts = q.options
      .map(
        (o, i) => `
        <button class="drill-opt" data-pick="${i}" type="button">
          <span class="opt-key">${i + 1}</span>
          <span>${o}</span>
        </button>`,
      )
      .join("");

    card.innerHTML = `
      <p class="overlay-eyebrow">the checkride · ${idx + 1}/${exam.length}</p>
      <div class="arch-progress"><div class="arch-progress-fill" style="width:${(idx / exam.length) * 100}%"></div></div>
      <p class="drill-ord">${ordinalOf(q.sectionId)}</p>
      <p class="drill-prompt">${q.prompt}</p>
      <div class="drill-options">${opts}</div>
      <div class="drill-actions">
        <button class="drill-btn" data-act="abort" type="button">abort — nothing is recorded</button>
      </div>`;

    card.querySelectorAll<HTMLButtonElement>("[data-pick]").forEach((b) =>
      b.addEventListener("click", () => {
        answers.push(Number(b.dataset.pick));
        logActivity(Number(b.dataset.pick) === q.answer ? "hit" : "miss");
        idx += 1;
        if (idx < exam.length) renderQuestion();
        else renderResults();
      }),
    );
    card.querySelector("[data-act=abort]")?.addEventListener("click", close);
  }

  // --- results ----------------------------------------------------------------

  function renderResults(): void {
    const correct = exam.filter((q, i) => answers[i] === q.answer).length;
    const pct = Math.round((correct / exam.length) * 100);
    const passed = pct >= PASS_PCT;

    const best = loadBest();
    if (!best || pct > best.pct) saveBest({ pct, date: today(), name: best?.name ?? "" });

    // per-level breakdown, in sections order
    const byOrd = new Map<string, { hit: number; total: number }>();
    exam.forEach((q, i) => {
      const ord = ordinalOf(q.sectionId);
      const row = byOrd.get(ord) ?? { hit: 0, total: 0 };
      row.total += 1;
      if (answers[i] === q.answer) row.hit += 1;
      byOrd.set(ord, row);
    });
    const breakdown = sections
      .filter((s) => byOrd.has(s.ordinal))
      .map((s) => {
        const r = byOrd.get(s.ordinal)!;
        return `<span class="ride-ord${r.hit === r.total ? " ok" : ""}">${s.ordinal} ${r.hit}/${r.total}</span>`;
      })
      .join("");

    const missed = exam
      .map((q, i) => ({ q, i }))
      .filter(({ q, i }) => answers[i] !== q.answer)
      .map(
        ({ q }) => `
        <li class="lab-finding bad">
          <p>${q.prompt}</p>
          <p><strong>Correct:</strong> ${q.options[q.answer]}</p>
          <p class="fb-explain">${q.explain}</p>
          <button class="lab-ref-link" data-jump="${q.sectionId}" type="button">${ordinalOf(q.sectionId)} · review the section →</button>
        </li>`,
      )
      .join("");

    const wings = passed
      ? `
      <div class="ride-wings">
        <p><strong>Wings earned.</strong> Put a name on the certificate and send the link — the score and date travel in the URL, checksummed.</p>
        <div class="ride-wings-row">
          <input class="ride-name" id="ride-name" type="text" maxlength="40" placeholder="your name or initials" value="${loadBest()?.name ?? ""}" />
          <button class="drill-btn primary" data-act="wings" type="button">copy wings link</button>
        </div>
      </div>`
      : `<p class="drill-note">Pass mark is ${PASS_PCT}%. The drill knows what to feed you — the missed sections are listed below.</p>`;

    card.innerHTML = `
      <p class="overlay-eyebrow">the checkride · debrief</p>
      <h3 class="drill-title">${passed ? "Checkride passed" : "Not this time"} — ${pct}%</h3>
      <p class="drill-pct">${correct}/${exam.length} correct</p>
      <div class="ride-breakdown">${breakdown}</div>
      ${wings}
      ${missed ? `<h4 class="lab-h">what you missed</h4><ul class="lab-findings">${missed}</ul>` : `<p class="drill-note">A clean sweep. Frame it.</p>`}
      <div class="drill-actions">
        <button class="drill-btn" data-act="retake" type="button">fly it again</button>
        <button class="drill-btn" data-act="close" type="button">done</button>
      </div>`;

    card.querySelectorAll<HTMLButtonElement>("[data-jump]").forEach((b) =>
      b.addEventListener("click", () => {
        close();
        jumpTo(b.dataset.jump!);
      }),
    );
    card.querySelector("[data-act=wings]")?.addEventListener("click", () => {
      const name =
        card.querySelector<HTMLInputElement>("#ride-name")?.value.trim() || "a teammate";
      saveBest({ pct, date: today(), name });
      const url = buildWingsUrl(pct, today(), name);
      navigator.clipboard.writeText(url).then(
        () => toast("wings link copied — send it to the team"),
        () => window.prompt("Copy this wings link:", url),
      );
    });
    card.querySelector("[data-act=retake]")?.addEventListener("click", () => {
      exam = buildExam(sections, bank);
      answers = [];
      idx = 0;
      renderQuestion();
    });
    card.querySelector("[data-act=close]")?.addEventListener("click", close);
  }

  return { open };
}
