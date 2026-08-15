// ---------------------------------------------------------------------------
// Pattern lab — the UI over labsim.ts. A three-screen overlay:
//
//   configure  →  run (animated event log + live instruments)  →  debrief
//
// The reader picks a mission, an architecture pattern, a context strategy,
// compaction, and a tool surface, then watches the run play out against the
// guide's own claims. Every debrief finding links back to the section that
// teaches it. Deterministic by design: same setup, same run.
// ---------------------------------------------------------------------------

import {
  MISSIONS,
  PATTERNS,
  buildLabUrl,
  simulate,
  type LabConfig,
  type Mission,
  type SimResult,
  type PatternId,
} from "./labsim";
import { graphFor, renderFigure, renderGraph } from "./agentgraph";

export interface LabHandle {
  open(): void;
  /** fly a mission that isn't in MISSIONS — the architect hands its synthesized
   *  "your task" mission here, with its trait digits so the run stays linkable */
  openWith(mission: Mission, cfg: LabConfig, archDigits?: string): void;
  /** open straight onto a configured run — a #lab= ghost-run link landing */
  openRun(cfg: LabConfig): void;
}

const TICK_MS = 340; // event-reveal cadence during the run

export function initLab(
  jumpTo: (sectionId: string) => void,
  toast: (msg: string) => void,
): LabHandle {
  // Deliberately naive defaults — the first run is the first lesson.
  let cfg: LabConfig = {
    mission: "inbox",
    pattern: "single",
    context: "preload",
    compaction: false,
    tools: "sprawl",
  };

  const overlay = document.createElement("div");
  overlay.className = "overlay lab";
  overlay.hidden = true;
  overlay.innerHTML = `<div class="overlay-card lab-card" role="dialog" aria-modal="true" aria-label="Pattern lab"></div>`;
  document.body.appendChild(overlay);
  const card = overlay.querySelector<HTMLElement>(".lab-card")!;

  let timer = 0;

  // A mission synthesized elsewhere (the architect). While active, it replaces
  // cfg.mission; picking a canned mission chip deactivates it but keeps it
  // around as a chip so the reader can flip back.
  let custom: Mission | null = null;
  let customActive = false;
  // The architect's eight trait digits for the custom mission, when known —
  // what lets a ghost-run link reconstruct the mission on the other end.
  let customArch: string | null = null;

  const activeMission = (): Mission =>
    customActive && custom ? custom : MISSIONS.find((m) => m.id === cfg.mission)!;

  function close(): void {
    overlay.hidden = true;
    clearInterval(timer);
    document.removeEventListener("keydown", onKey);
  }

  function open(): void {
    overlay.hidden = false;
    document.addEventListener("keydown", onKey);
    renderConfig();
  }

  function openWith(mission: Mission, newCfg: LabConfig, archDigits?: string): void {
    custom = mission;
    customActive = true;
    customArch = archDigits ?? null;
    cfg = { ...newCfg };
    overlay.hidden = false;
    document.addEventListener("keydown", onKey);
    startRun();
  }

  function openRun(newCfg: LabConfig): void {
    customActive = false;
    cfg = { ...newCfg };
    overlay.hidden = false;
    document.addEventListener("keydown", onKey);
    startRun();
  }

  function onKey(e: KeyboardEvent): void {
    if (!overlay.hidden && e.key === "Escape") close();
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  // --- screen 1: configuration ---------------------------------------------

  function renderConfig(): void {
    const customRow = custom
      ? `
      <button class="lab-chip lab-mission${customActive ? " on" : ""}" data-mission="__custom" type="button" aria-pressed="${customActive}">
        <span class="lab-chip-name">${custom.name} <span class="lab-via">(from the architect)</span></span>
        <span class="lab-chip-sub">${custom.brief}</span>
      </button>`
      : "";
    const missionRows =
      customRow +
      MISSIONS.map(
        (m) => `
      <button class="lab-chip lab-mission${!customActive && m.id === cfg.mission ? " on" : ""}" data-mission="${m.id}" type="button" aria-pressed="${!customActive && m.id === cfg.mission}">
        <span class="lab-chip-name">${m.name}</span>
        <span class="lab-chip-sub">${m.brief}</span>
      </button>`,
      ).join("");

    const patternRows = PATTERNS.map(
      (p) => `
      <button class="lab-chip${p.id === cfg.pattern ? " on" : ""}" data-pattern="${p.id}" type="button" aria-pressed="${p.id === cfg.pattern}">
        <span class="lab-chip-name">${p.name}</span>
        <span class="lab-chip-sub">${p.blurb}</span>
      </button>`,
    ).join("");

    const seg = (
      group: string,
      value: string,
      options: Array<[string, string]>,
    ): string =>
      `<div class="lab-seg" role="group">${options
        .map(
          ([v, label]) =>
            `<button class="lab-seg-btn${v === value ? " on" : ""}" data-${group}="${v}" type="button" aria-pressed="${v === value}">${label}</button>`,
        )
        .join("")}</div>`;

    card.innerHTML = `
      <p class="overlay-eyebrow">pattern lab</p>
      <h3 class="drill-title">Build a run, then watch it fly</h3>
      <p class="drill-note">A deterministic simulator wired to the guide's own claims — context rot, compaction, tool sprawl, the economics of fan-out. Same setup, same run: it's a model, not a slot machine.</p>
      <div class="lab-grid">
        <div class="lab-col">
          <h4 class="lab-h">mission</h4>
          ${missionRows}
        </div>
        <div class="lab-col">
          <h4 class="lab-h">architecture <span class="lab-h-ref">(L1)</span></h4>
          ${patternRows}
        </div>
      </div>
      <div class="lab-graph">${renderFigure(graphFor(cfg.pattern))}</div>
      <div class="lab-row">
        <div>
          <h4 class="lab-h">context strategy <span class="lab-h-ref">(L2)</span></h4>
          ${seg("context", cfg.context, [["preload", "kitchen-sink preload"], ["jit", "curated + just-in-time"]])}
        </div>
        <div>
          <h4 class="lab-h">compaction</h4>
          ${seg("compaction", String(cfg.compaction), [["false", "off"], ["true", "on"]])}
        </div>
        <div>
          <h4 class="lab-h">tool surface <span class="lab-h-ref">(L3)</span></h4>
          ${seg("tools", cfg.tools, [["sprawl", "41 tools"], ["lean", "6 well-scoped"]])}
        </div>
      </div>
      <div class="drill-actions">
        <button class="drill-btn primary" data-act="run" type="button">run the mission</button>
        <button class="drill-btn" data-act="close" type="button">close</button>
      </div>`;

    card.querySelectorAll<HTMLButtonElement>("[data-mission]").forEach((b) =>
      b.addEventListener("click", () => {
        if (b.dataset.mission === "__custom") {
          customActive = true;
        } else {
          customActive = false;
          cfg = { ...cfg, mission: b.dataset.mission as LabConfig["mission"] };
        }
        renderConfig();
      }),
    );
    card.querySelectorAll<HTMLButtonElement>("[data-pattern]").forEach((b) =>
      b.addEventListener("click", () => {
        cfg = { ...cfg, pattern: b.dataset.pattern as PatternId };
        renderConfig();
      }),
    );
    card.querySelectorAll<HTMLButtonElement>("[data-context]").forEach((b) =>
      b.addEventListener("click", () => {
        cfg = { ...cfg, context: b.dataset.context as LabConfig["context"] };
        renderConfig();
      }),
    );
    card.querySelectorAll<HTMLButtonElement>("[data-compaction]").forEach((b) =>
      b.addEventListener("click", () => {
        cfg = { ...cfg, compaction: b.dataset.compaction === "true" };
        renderConfig();
      }),
    );
    card.querySelectorAll<HTMLButtonElement>("[data-tools]").forEach((b) =>
      b.addEventListener("click", () => {
        cfg = { ...cfg, tools: b.dataset.tools as LabConfig["tools"] };
        renderConfig();
      }),
    );
    card.querySelector("[data-act=run]")?.addEventListener("click", () => startRun());
    card.querySelector("[data-act=close]")?.addEventListener("click", close);
  }

  // --- screen 2: the animated run -------------------------------------------

  function meterClass(pct: number): string {
    return pct > 85 ? "crit" : pct > 70 ? "hot" : "";
  }

  function startRun(): void {
    const mission = activeMission();
    const result = simulate(cfg, true, customActive && custom ? custom : undefined);
    const pattern = PATTERNS.find((p) => p.id === cfg.pattern)!;

    card.innerHTML = `
      <p class="overlay-eyebrow">pattern lab · in flight</p>
      <h3 class="drill-title">${mission.name} <span class="lab-via">via ${pattern.name.toLowerCase()}</span></h3>
      <div class="lab-graph flight">${renderGraph(graphFor(cfg.pattern), { live: true })}</div>
      <div class="lab-meters">
        <div class="lab-meter">
          <span class="lab-meter-label">context window</span>
          <div class="lab-bar"><div class="lab-bar-fill" id="lab-window"></div></div>
          <span class="lab-meter-val" id="lab-window-val">0%</span>
        </div>
        <div class="lab-meter">
          <span class="lab-meter-label">signal integrity</span>
          <div class="lab-bar"><div class="lab-bar-fill sig" id="lab-signal"></div></div>
          <span class="lab-meter-val" id="lab-signal-val">—</span>
        </div>
        <div class="lab-dials">
          <span class="lab-dial">tokens <strong id="lab-cost">0k</strong></span>
          <span class="lab-dial">clock <strong id="lab-clock">0m</strong></span>
        </div>
      </div>
      <ul class="lab-log" id="lab-log" aria-live="polite"></ul>
      <div class="drill-actions">
        <button class="drill-btn" data-act="skip" type="button">skip animation</button>
        <button class="drill-btn" data-act="close" type="button">abort</button>
      </div>`;

    const log = card.querySelector<HTMLElement>("#lab-log")!;
    const winFill = card.querySelector<HTMLElement>("#lab-window")!;
    const winVal = card.querySelector<HTMLElement>("#lab-window-val")!;
    const sigFill = card.querySelector<HTMLElement>("#lab-signal")!;
    const sigVal = card.querySelector<HTMLElement>("#lab-signal-val")!;
    const costEl = card.querySelector<HTMLElement>("#lab-cost")!;
    const clockEl = card.querySelector<HTMLElement>("#lab-clock")!;
    const graphNodes = Array.from(card.querySelectorAll<SVGGElement>(".ag-node"));

    let i = 0;

    // Move the light along the topology. Nodes the run has already visited
    // stay half-lit, so the path taken reads at a glance.
    function lightNode(id: string): void {
      for (const el of graphNodes) {
        const on = el.dataset.node === id;
        el.classList.toggle("on", on);
        if (on) el.classList.add("seen");
      }
    }

    function showEvent(): void {
      const ev = result.events[i];
      const li = document.createElement("li");
      li.className = `lab-ev ${ev.kind}`;
      li.textContent = ev.text;
      log.appendChild(li);
      log.scrollTop = log.scrollHeight;

      const pct = Math.round((ev.window / 200) * 100);
      winFill.style.width = `${pct}%`;
      winFill.className = `lab-bar-fill ${meterClass(pct)}`;
      winVal.textContent = `${pct}%`;
      sigFill.style.width = `${ev.quality}%`;
      sigFill.className = `lab-bar-fill sig ${ev.quality < 55 ? "crit" : ev.quality < 76 ? "hot" : ""}`;
      sigVal.textContent = `${Math.round(ev.quality)}%`;
      costEl.textContent = `${Math.round(ev.cost)}k`;
      clockEl.textContent = `${Math.round(ev.latency)}m`;
      lightNode(ev.node);
      i += 1;
    }

    function finishControls(): void {
      const actions = card.querySelector<HTMLElement>(".drill-actions")!;
      actions.innerHTML = `<button class="drill-btn primary" data-act="debrief" type="button">read the debrief</button>`;
      actions
        .querySelector<HTMLButtonElement>("[data-act=debrief]")!
        .addEventListener("click", () => renderDebrief(result, mission));
      actions.querySelector<HTMLButtonElement>("[data-act=debrief]")!.focus();
    }

    timer = window.setInterval(() => {
      if (i < result.events.length) showEvent();
      if (i >= result.events.length) {
        clearInterval(timer);
        finishControls();
      }
    }, TICK_MS);

    card.querySelector("[data-act=skip]")?.addEventListener("click", () => {
      clearInterval(timer);
      while (i < result.events.length) showEvent();
      finishControls();
    });
    card.querySelector("[data-act=close]")?.addEventListener("click", close);
  }

  // --- screen 3: debrief -----------------------------------------------------

  function renderDebrief(result: SimResult, mission: Mission): void {
    const tiles = `
      <div class="lab-tiles">
        <div class="lab-tile"><span class="lab-tile-grade g-${result.grades.quality}">${result.grades.quality}</span><span class="lab-tile-num">${result.quality}%</span><span class="lab-tile-label">quality</span></div>
        <div class="lab-tile"><span class="lab-tile-grade g-${result.grades.cost}">${result.grades.cost}</span><span class="lab-tile-num">${result.cost}k</span><span class="lab-tile-label">tokens</span></div>
        <div class="lab-tile"><span class="lab-tile-grade g-${result.grades.latency}">${result.grades.latency}</span><span class="lab-tile-num">${Math.round(result.latency)}m</span><span class="lab-tile-label">wall clock</span></div>
      </div>`;

    const findings = result.findings
      .map(
        (f) => `
        <li class="lab-finding ${f.tone}">
          <p>${f.text}</p>
          <button class="lab-ref-link" data-jump="${f.sectionId}" type="button">${f.label} →</button>
        </li>`,
      )
      .join("");

    const rec = result.recommended
      ? `<div class="lab-rec">
           <p><strong>Fit-for-purpose setup:</strong> ${PATTERNS.find((p) => p.id === result.recommended!.pattern)!.name.toLowerCase()},
           ${result.recommended.context === "jit" ? "curated + just-in-time context" : "preloaded context"}, compaction on, lean tools —
           models out at ${result.recommended.quality}% quality for ${result.recommended.cost}k tokens.</p>
           <button class="drill-btn" data-act="fly-rec" type="button">fly that setup</button>
         </div>`
      : "";

    // The run is linkable when it can be reconstructed on the other end: any
    // canned mission, or an architect mission whose trait digits we hold.
    const linkable = !customActive || customArch !== null;

    card.innerHTML = `
      <p class="overlay-eyebrow">pattern lab · debrief</p>
      <h3 class="drill-title">${mission.name}</h3>
      <p class="lab-verdict">${result.verdict}</p>
      ${tiles}
      <ul class="lab-findings">${findings}</ul>
      ${rec}
      <div class="drill-actions">
        <button class="drill-btn primary" data-act="tweak" type="button">tweak the setup</button>
        ${linkable ? `<button class="drill-btn" data-act="link" type="button" title="Deterministic by design — the link replays this exact run on any device">copy run link</button>` : ""}
        <button class="drill-btn" data-act="close" type="button">done</button>
      </div>`;

    card.querySelectorAll<HTMLButtonElement>("[data-jump]").forEach((b) =>
      b.addEventListener("click", () => {
        close();
        jumpTo(b.dataset.jump!);
      }),
    );
    card.querySelector("[data-act=tweak]")?.addEventListener("click", renderConfig);
    card.querySelector("[data-act=link]")?.addEventListener("click", () => {
      const url = buildLabUrl(cfg, customActive ? customArch ?? undefined : undefined);
      navigator.clipboard.writeText(url).then(
        () => toast("run link copied — same setup, same run, on any device"),
        () => window.prompt("Copy this run link:", url),
      );
    });
    card.querySelector("[data-act=close]")?.addEventListener("click", close);
    card.querySelector("[data-act=fly-rec]")?.addEventListener("click", () => {
      const r = result.recommended!;
      cfg = { ...cfg, pattern: r.pattern, context: r.context, compaction: true, tools: "lean" };
      startRun();
    });
  }

  return { open, openWith, openRun };
}
