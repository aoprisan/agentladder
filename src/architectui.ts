// ---------------------------------------------------------------------------
// The architect — UI over architect.ts. A three-screen overlay:
//
//   interview (8 questions, one per screen)  →  verdict  →  brief (export)
//
// The verdict screen can hand the synthesized mission straight to the
// pattern lab ("stress-test in the lab"), copy a share link that carries the
// answers in the URL hash, and export the Markdown decision brief. Answers
// persist per-device so a revisit resumes where you left off.
// ---------------------------------------------------------------------------

import {
  TRAITS,
  DEFAULT_ANSWERS,
  assess,
  buildBrief,
  buildArchUrl,
  type Answers,
  type ArchitectVerdict,
} from "./architect";
import type { Mission } from "./labsim";
import type { LabConfig } from "./labsim";

const ARCH_KEY = "agentic-guide-architect-v1";

export interface ArchitectHandle {
  open(): void;
  /** open straight onto the verdict for a set of answers (share links) */
  openWithAnswers(a: Answers): void;
}

function loadAnswers(): Answers | null {
  try {
    const raw = localStorage.getItem(ARCH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Answers;
    for (const t of TRAITS) {
      const v = parsed[t.key];
      if (v !== 0 && v !== 1 && v !== 2) return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveAnswers(a: Answers): void {
  try {
    localStorage.setItem(ARCH_KEY, JSON.stringify(a));
  } catch {
    /* private mode etc. — the interview just won't persist */
  }
}

export function initArchitect(
  jumpTo: (sectionId: string) => void,
  flyInLab: (mission: Mission, cfg: LabConfig) => void,
  toast: (msg: string) => void,
): ArchitectHandle {
  let answers: Answers = loadAnswers() ?? { ...DEFAULT_ANSWERS };
  let step = 0;

  const overlay = document.createElement("div");
  overlay.className = "overlay arch";
  overlay.hidden = true;
  overlay.innerHTML = `<div class="overlay-card arch-card" role="dialog" aria-modal="true" aria-label="The architect"></div>`;
  document.body.appendChild(overlay);
  const card = overlay.querySelector<HTMLElement>(".arch-card")!;

  function close(): void {
    overlay.hidden = true;
    document.removeEventListener("keydown", onKey);
  }

  function onKey(e: KeyboardEvent): void {
    if (overlay.hidden) return;
    if (e.key === "Escape") close();
    const n = Number(e.key);
    if (n >= 1 && n <= 3 && card.querySelector("[data-opt]")) {
      const btn = card.querySelector<HTMLButtonElement>(`[data-opt="${n - 1}"]`);
      btn?.click();
    }
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  function open(): void {
    overlay.hidden = false;
    document.addEventListener("keydown", onKey);
    step = 0;
    renderIntro();
  }

  function openWithAnswers(a: Answers): void {
    answers = { ...a };
    saveAnswers(answers);
    overlay.hidden = false;
    document.addEventListener("keydown", onKey);
    renderVerdict(assess(answers));
  }

  // --- screen 0: intro --------------------------------------------------------

  function renderIntro(): void {
    card.innerHTML = `
      <p class="overlay-eyebrow">the architect</p>
      <h3 class="drill-title">Bring a real task. Leave with a design.</h3>
      <p class="drill-note">Eight questions about a piece of work you actually have — its shape, not its domain. The engine scores all seven L1 patterns against it, stress-tests the candidates in the simulator, and hands you a decision brief you can export and defend. Deterministic: same answers, same verdict.</p>
      <div class="drill-actions">
        <button class="drill-btn primary" data-act="start" type="button">start the interview</button>
        ${loadAnswers() ? `<button class="drill-btn" data-act="last" type="button">re-open last verdict</button>` : ""}
        <button class="drill-btn" data-act="close" type="button">close</button>
      </div>`;
    card.querySelector("[data-act=start]")?.addEventListener("click", () => {
      step = 0;
      renderStep();
    });
    card.querySelector("[data-act=last]")?.addEventListener("click", () => renderVerdict(assess(answers)));
    card.querySelector("[data-act=close]")?.addEventListener("click", close);
  }

  // --- screens 1–8: the interview ----------------------------------------------

  function renderStep(): void {
    const t = TRAITS[step];
    const opts = t.options
      .map(
        (o, i) => `
        <button class="lab-chip arch-opt${answers[t.key] === i ? " on" : ""}" data-opt="${i}" type="button" aria-pressed="${answers[t.key] === i}">
          <span class="lab-chip-name"><span class="opt-key">${i + 1}</span>${o.label}</span>
          <span class="lab-chip-sub">${o.hint}</span>
        </button>`,
      )
      .join("");

    card.innerHTML = `
      <p class="overlay-eyebrow">the architect · question ${step + 1}/${TRAITS.length}</p>
      <div class="arch-progress"><div class="arch-progress-fill" style="width:${(step / TRAITS.length) * 100}%"></div></div>
      <h3 class="drill-title">${t.prompt}</h3>
      <div class="arch-opts">${opts}</div>
      <div class="drill-actions">
        ${step > 0 ? `<button class="drill-btn" data-act="back" type="button">back</button>` : ""}
        <button class="drill-btn" data-act="close" type="button">close</button>
      </div>`;

    card.querySelectorAll<HTMLButtonElement>("[data-opt]").forEach((b) =>
      b.addEventListener("click", () => {
        answers = { ...answers, [t.key]: Number(b.dataset.opt) };
        if (step < TRAITS.length - 1) {
          step += 1;
          renderStep();
        } else {
          saveAnswers(answers);
          renderVerdict(assess(answers));
        }
      }),
    );
    card.querySelector("[data-act=back]")?.addEventListener("click", () => {
      step -= 1;
      renderStep();
    });
    card.querySelector("[data-act=close]")?.addEventListener("click", close);
  }

  // --- screen 9: the verdict ------------------------------------------------------

  function renderVerdict(v: ArchitectVerdict): void {
    const tierLabel: Record<string, string> = {
      call: "one augmented call",
      workflow: "a workflow",
      agent: "an agent",
      multi: "multi-agent",
    };

    const rows = v.ranked
      .map(
        (s, i) => `
        <li class="arch-row${i === 0 ? " top" : ""}">
          <span class="arch-rank">${i + 1}</span>
          <span class="arch-name">${s.name}</span>
          <span class="arch-fitbar"><span class="lab-bar"><span class="lab-bar-fill${s.fit >= 0.6 ? " sig" : s.fit >= 0.35 ? " hot" : " crit"}" style="width:${Math.round(s.fit * 100)}%"></span></span></span>
          <span class="arch-nums">${s.quality}% · ${s.cost}k · ${Math.round(s.latency)}m</span>
          ${i < 3 ? `<span class="arch-why">${s.why}</span>` : ""}
        </li>`,
      )
      .join("");

    const plan = v.contextPlan.map((c) => `<li class="lab-finding note"><p>${c}</p></li>`).join("");
    const rails = v.guardrails
      .map(
        (g) => `
        <li class="lab-finding">
          <p>${g.text}</p>
          <button class="lab-ref-link" data-jump="${g.sectionId}" type="button">${g.label} →</button>
        </li>`,
      )
      .join("");

    card.innerHTML = `
      <p class="overlay-eyebrow">the architect · verdict — this is ${tierLabel[v.tier]}</p>
      <h3 class="drill-title">${v.top.name}</h3>
      <p class="lab-verdict">${v.stance}</p>
      <h4 class="lab-h">scoreboard <span class="lab-h-ref">(modeled: quality · tokens · wall clock)</span></h4>
      <ul class="arch-rows">${rows}</ul>
      <h4 class="lab-h">context plan <span class="lab-h-ref">(L2)</span></h4>
      <ul class="lab-findings">${plan}</ul>
      <h4 class="lab-h">guardrail kit</h4>
      <ul class="lab-findings">${rails}</ul>
      <div class="drill-actions">
        <button class="drill-btn primary" data-act="fly" type="button">stress-test in the lab</button>
        <button class="drill-btn" data-act="brief" type="button">export the brief</button>
        <button class="drill-btn" data-act="link" type="button">copy decision link</button>
        <button class="drill-btn" data-act="revise" type="button">revise answers</button>
        <button class="drill-btn" data-act="close" type="button">done</button>
      </div>`;

    card.querySelectorAll<HTMLButtonElement>("[data-jump]").forEach((b) =>
      b.addEventListener("click", () => {
        close();
        jumpTo(b.dataset.jump!);
      }),
    );
    card.querySelector("[data-act=fly]")?.addEventListener("click", () => {
      close();
      flyInLab(v.mission, {
        mission: "brief",
        pattern: v.top.pattern,
        context: v.top.context,
        compaction: true,
        tools: "lean",
      });
    });
    card.querySelector("[data-act=brief]")?.addEventListener("click", () => renderBrief(v));
    card.querySelector("[data-act=link]")?.addEventListener("click", () => {
      void copyText(buildArchUrl(v.answers), "decision link copied — the interview travels in the URL");
    });
    card.querySelector("[data-act=revise]")?.addEventListener("click", () => {
      step = 0;
      renderStep();
    });
    card.querySelector("[data-act=close]")?.addEventListener("click", close);
  }

  async function copyText(text: string, okMsg: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      toast(okMsg);
    } catch {
      window.prompt("Copy this:", text);
    }
  }

  // --- screen 10: the brief ---------------------------------------------------------

  function renderBrief(v: ArchitectVerdict): void {
    const md = buildBrief(v);
    card.innerHTML = `
      <p class="overlay-eyebrow">the architect · decision brief</p>
      <h3 class="drill-title">Take it to the design review</h3>
      <p class="drill-note">Markdown: task profile, stance, modeled scoreboard, context plan, guardrail checklist, a starter CLAUDE.md, and a build sequence. Paste it in the RFC or drop it in the repo.</p>
      <pre class="arch-brief" tabindex="0"></pre>
      <div class="drill-actions">
        <button class="drill-btn primary" data-act="copy" type="button">copy markdown</button>
        <button class="drill-btn" data-act="download" type="button">download .md</button>
        <button class="drill-btn" data-act="back" type="button">back to verdict</button>
        <button class="drill-btn" data-act="close" type="button">done</button>
      </div>`;
    card.querySelector<HTMLElement>(".arch-brief")!.textContent = md;

    card.querySelector("[data-act=copy]")?.addEventListener("click", () => {
      void copyText(md, "brief copied as markdown");
    });
    card.querySelector("[data-act=download]")?.addEventListener("click", () => {
      const blob = new Blob([md], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "architecture-decision-brief.md";
      link.click();
      URL.revokeObjectURL(url);
    });
    card.querySelector("[data-act=back]")?.addEventListener("click", () => renderVerdict(v));
    card.querySelector("[data-act=close]")?.addEventListener("click", close);
  }

  return { open, openWithAnswers };
}
