// ---------------------------------------------------------------------------
// The range — UI over range.ts. Five screens:
//
//   board  →  harden (spend the friction budget)  →  call it (predict)
//          →  the run (chains walk, link by link)  →  debrief
//
// The prediction screen is the one that makes this more than a checklist. The
// reader commits, before seeing anything, to which threats their own posture
// holds — and the debrief scores that separately from the posture itself. A
// good posture you did not understand is a posture you will dismantle the
// first time it gets in your way.
//
// Everything the reader chooses stays on this device; the exported report is
// built locally and never sent anywhere.
// ---------------------------------------------------------------------------

import {
  CONTROLS,
  DEPLOYMENTS,
  FAMILY_LABEL,
  buildRangeMarkdown,
  calibrate,
  controlById,
  costOf,
  frictionOf,
  readRange,
  recordRange,
  runRange,
  threatById,
  type Advice,
  type Calibration,
  type Control,
  type ControlId,
  type Deployment,
  type Outcome,
  type Prediction,
  type RangeResult,
  type RouteResult,
  type StageResult,
  type ThreatId,
} from "./range";
import { logActivity } from "./activity";

export interface RangeHandle {
  open(): void;
}

const TICK_MS = 300; // link-reveal cadence while the chains walk

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const SEV_LABEL: Record<number, string> = {
  1: "embarrassing",
  2: "expensive",
  3: "write-up",
};

export function initRange(
  jumpTo: (sectionId: string) => void,
  ordinalOf: (sectionId: string) => string,
  toast: (msg: string) => void,
): RangeHandle {
  const overlay = document.createElement("div");
  overlay.className = "overlay range";
  overlay.hidden = true;
  overlay.innerHTML = `<div class="overlay-card rg-card" role="dialog" aria-modal="true" aria-label="The range"></div>`;
  document.body.appendChild(overlay);
  const card = overlay.querySelector<HTMLElement>(".rg-card")!;

  let deployment: Deployment | null = null;
  let posture: ControlId[] = [];
  let prediction: Prediction = {};
  let result: RangeResult | null = null;
  let cal: Calibration | null = null;
  let timer = 0;

  function close(): void {
    overlay.hidden = true;
    clearInterval(timer);
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
    renderBoard();
  }

  // --- screen 1: the board --------------------------------------------------

  function renderBoard(): void {
    const store = readRange();
    const rows = DEPLOYMENTS.map((d) => {
      const rec = store[d.id];
      const badge = rec
        ? `<span class="bb-best g-${rec.grade}">best ${rec.best}%</span>`
        : `<span class="bb-best bb-new">unrun</span>`;
      return `
        <button class="lab-chip rg-deployment" data-deployment="${d.id}" type="button">
          <span class="lab-chip-name">${esc(d.name)} ${badge}</span>
          <span class="lab-chip-sub">${esc(d.setting)}</span>
          <span class="rg-chip-meta">${d.threats.length} threats in scope · ${d.budget} friction points</span>
        </button>`;
    }).join("");

    card.innerHTML = `
      <p class="overlay-eyebrow">the range</p>
      <h3 class="drill-title">Harden it before someone else tests it</h3>
      <p class="drill-note">Every other exercise here asks whether a design works. This one asks what happens when somebody wants it to work against you. Pick a deployment, spend a fixed budget of <strong>friction points</strong> on controls, then commit to which attacks you think your posture holds — before you find out. The budget is the whole exercise: a control that gets in the way forty times a day is a control that gets switched off, so "harden everything" is not an answer.</p>
      <div class="lab-grid rg-board">${rows}</div>
      <p class="rg-foot">Each threat has <em>two routes</em> to the same outcome. Any one control on a link cuts that route — but a threat only counts as contained when <em>both</em> routes are cut, because an attacker who finds one path closed takes the other. The second route is always the one the obvious control misses. Detection is scored at half credit: knowing an hour later beats never and loses to no.</p>
      <div class="drill-actions"><button class="drill-btn" data-act="close" type="button">close</button></div>`;

    card.querySelectorAll<HTMLButtonElement>("[data-deployment]").forEach((btn) => {
      btn.addEventListener("click", () => {
        deployment = DEPLOYMENTS.find((d) => d.id === btn.dataset.deployment)!;
        posture = [...(readRange()[deployment.id]?.posture ?? [])];
        prediction = {};
        result = null;
        cal = null;
        renderHarden();
      });
    });
    card.querySelector("[data-act=close]")?.addEventListener("click", close);
  }

  // --- screen 2: hardening --------------------------------------------------

  function controlCard(c: Control, spent: number): string {
    const d = deployment!;
    const price = costOf(d, c.id);
    const on = posture.includes(c.id);
    const wouldExceed = !on && spent + price > d.budget;
    const pips = Array.from(
      { length: price },
      () => `<span class="rg-pip"></span>`,
    ).join("");
    // A price that differs from the control's default is the deployment
    // talking: the same measure is not equally expensive everywhere.
    const shift =
      price === c.friction
        ? ""
        : `<span class="rg-shift ${price > c.friction ? "up" : "down"}" title="costs ${price > c.friction ? "more" : "less"} here than its usual ${c.friction}">${price > c.friction ? "↑" : "↓"} ${price > c.friction ? "dearer" : "cheaper"} here</span>`;
    return `
      <button class="rg-control${on ? " on" : ""}${wouldExceed ? " over" : ""}"
              data-control="${c.id}" type="button" aria-pressed="${on}">
        <span class="rg-control-head">
          <span class="rg-control-name">${esc(c.name)}</span>
          <span class="rg-cost" title="${price} friction point${price === 1 ? "" : "s"} here">${pips}</span>
        </span>
        ${shift}
        <span class="rg-family">${esc(FAMILY_LABEL[c.family])}</span>
        <span class="rg-control-blurb">${esc(c.blurb)}</span>
        <span class="rg-control-cost">${esc(c.cost)}</span>
      </button>`;
  }

  function renderHarden(): void {
    const d = deployment!;
    const spent = frictionOf(d, posture);
    const over = spent > d.budget;
    const pct = Math.min(100, Math.round((spent / d.budget) * 100));

    const byFamily = ["provenance", "gate", "boundary", "identity", "observe"] as const;
    const groups = byFamily
      .map((f) => {
        const list = CONTROLS.filter((c) => c.family === f);
        if (list.length === 0) return "";
        return `
          <h4 class="lab-h rg-family-h">${esc(FAMILY_LABEL[f])}</h4>
          <div class="rg-controls">${list.map((c) => controlCard(c, spent)).join("")}</div>`;
      })
      .join("");

    const threatNames = d.threats
      .map((id) => {
        const t = threatById(id);
        return `<li><strong>${esc(t.name)}</strong> — ${esc(t.setting)}</li>`;
      })
      .join("");

    card.innerHTML = `
      <p class="overlay-eyebrow">the range · ${esc(d.name.toLowerCase())}</p>
      <h3 class="drill-title">${esc(d.name)}</h3>
      <p class="rg-setting">${esc(d.setting)}</p>
      <div class="rg-brief">
        <p><span class="bb-brief-k">the job</span> ${esc(d.brief)}</p>
        <p><span class="bb-brief-k bad">who can write into its context</span> ${esc(d.exposure)}</p>
      </div>
      <div class="rg-budget${over ? " over" : ""}">
        <div class="rg-budget-head">
          <span class="rg-budget-label">friction budget</span>
          <span class="rg-budget-val" id="rg-spent">${spent} / ${d.budget}</span>
        </div>
        <div class="lab-bar"><div class="lab-bar-fill${over ? " crit" : pct > 85 ? " hot" : ""}" style="width:${pct}%"></div></div>
        <p class="rg-budget-note">${esc(d.note)}</p>
      </div>
      <details class="rg-scope">
        <summary>${d.threats.length} threats are in scope for this deployment</summary>
        <ul>${threatNames}</ul>
        <p>You are not told which chain each control cuts. Working that out is the exercise — and it is the same reasoning you will do on a Tuesday with a real system in front of you.</p>
      </details>
      ${groups}
      <div class="rg-submitbar">
        <span class="rg-count${over ? " bad" : ""}">${over ? `${spent - d.budget} points over budget` : `${d.budget - spent} point${d.budget - spent === 1 ? "" : "s"} unspent`}</span>
        <div class="drill-actions">
          <button class="drill-btn" data-act="board" type="button">back</button>
          <button class="drill-btn primary" data-act="predict" type="button"${over ? " disabled" : ""}>commit this posture</button>
        </div>
      </div>`;

    card.querySelectorAll<HTMLButtonElement>("[data-control]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.control as ControlId;
        posture = posture.includes(id)
          ? posture.filter((c) => c !== id)
          : [...posture, id];
        renderHarden();
      });
    });
    card.querySelector("[data-act=board]")?.addEventListener("click", renderBoard);
    card.querySelector("[data-act=predict]")?.addEventListener("click", renderPredict);
  }

  // --- screen 3: the call ---------------------------------------------------

  function renderPredict(): void {
    const d = deployment!;
    result = runRange(d, posture);
    const rows = result.outcomes
      .map((o) => {
        const t = o.threat;
        const picked = prediction[t.id];
        return `
          <div class="rg-call" data-threat="${t.id}">
            <div class="rg-call-body">
              <p class="rg-call-name">${esc(t.name)} <span class="rg-sev s${t.severity}">${esc(SEV_LABEL[t.severity])}</span></p>
              <p class="rg-call-setting">${esc(t.setting)}</p>
            </div>
            <div class="rg-call-btns">
              <button class="rg-pick${picked === false ? " on hold" : ""}" data-call="${t.id}" data-through="0" type="button">my posture holds it</button>
              <button class="rg-pick${picked === true ? " on through" : ""}" data-call="${t.id}" data-through="1" type="button">it gets through</button>
            </div>
          </div>`;
      })
      .join("");

    const answered = result.outcomes.filter(
      (o) => prediction[o.threat.id] !== undefined,
    ).length;
    const all = answered === result.outcomes.length;

    const bought = posture.length
      ? posture.map((id) => `<li>${esc(controlById(id).name)}</li>`).join("")
      : `<li class="rg-none">nothing — you are flying it bare</li>`;

    card.innerHTML = `
      <p class="overlay-eyebrow">the range · call it</p>
      <h3 class="drill-title">Before you look</h3>
      <p class="drill-note">This is the half of the exercise that is about you rather than the system. For each threat, say whether the posture you just bought holds it. You will be scored on the posture and on the calling separately — because a defence you cannot explain is a defence you will remove the first week it inconveniences somebody.</p>
      <details class="rg-scope" open>
        <summary>what you bought — ${result.friction}/${result.budget} points</summary>
        <ul>${bought}</ul>
      </details>
      <div class="rg-calls">${rows}</div>
      <div class="rg-submitbar">
        <span class="rg-count">${answered}/${result.outcomes.length} called</span>
        <div class="drill-actions">
          <button class="drill-btn" data-act="harden" type="button">change the posture</button>
          <button class="drill-btn primary" data-act="run" type="button"${all ? "" : " disabled"}>run the range</button>
        </div>
      </div>`;

    card.querySelectorAll<HTMLButtonElement>("[data-call]").forEach((btn) => {
      btn.addEventListener("click", () => {
        prediction[btn.dataset.call as ThreatId] = btn.dataset.through === "1";
        renderPredict();
      });
    });
    card.querySelector("[data-act=harden]")?.addEventListener("click", renderHarden);
    card.querySelector("[data-act=run]")?.addEventListener("click", startRun);
  }

  // --- screen 4: the run ----------------------------------------------------

  /** Every stage of every route of every threat, flattened into one reveal
   *  order. Routes of the same threat play one after the other, so the reader
   *  watches the second path open right after the first one is cut — which is
   *  the whole point the routes model is making. */
  interface Beat {
    outcome: Outcome;
    route: RouteResult;
    routeIndex: number;
    stage: StageResult;
    index: number;
    /** last shown stage of this route */
    endsRoute: boolean;
    /** last shown stage of the whole threat */
    endsThreat: boolean;
  }

  function beatsOf(res: RangeResult): Beat[] {
    const beats: Beat[] = [];
    for (const o of res.outcomes) {
      o.routes.forEach((r, ri) => {
        const shown = r.stages.filter((s) => s.state !== "unreached");
        shown.forEach((s, i) => {
          beats.push({
            outcome: o,
            route: r,
            routeIndex: ri,
            stage: s,
            index: i,
            endsRoute: i === shown.length - 1,
            endsThreat: i === shown.length - 1 && ri === o.routes.length - 1,
          });
        });
      });
    }
    return beats;
  }

  function startRun(): void {
    const res = result!;
    const beats = beatsOf(res);

    const lanes = res.outcomes
      .map(
        (o) => `
        <div class="rg-lane" id="rg-lane-${o.threat.id}">
          <div class="rg-lane-head">
            <span class="rg-lane-name">${esc(o.threat.name)}</span>
            <span class="rg-lane-verdict" id="rg-v-${o.threat.id}">…</span>
          </div>
          ${o.routes
            .map(
              (r, ri) => `
            <div class="rg-routeline">
              <span class="rg-routename">${esc(r.route.name)}</span>
              <div class="rg-links">${r.stages
                .map(
                  (_s, i) =>
                    `<span class="rg-link" id="rg-link-${o.threat.id}-${ri}-${i}"></span>`,
                )
                .join("")}</div>
            </div>`,
            )
            .join("")}
        </div>`,
      )
      .join("");

    card.innerHTML = `
      <p class="overlay-eyebrow">the range · live</p>
      <h3 class="drill-title">${esc(res.deployment.name)} <span class="lab-via">under fire</span></h3>
      <div class="rg-lanes">${lanes}</div>
      <ul class="lab-log rg-log" id="rg-log" aria-live="polite"></ul>
      <div class="drill-actions">
        <button class="drill-btn" data-act="skip" type="button">skip ahead</button>
        <button class="drill-btn" data-act="close" type="button">abort</button>
      </div>`;

    const log = card.querySelector<HTMLElement>("#rg-log")!;
    let i = 0;

    function showBeat(): void {
      const b = beats[i];
      const { outcome: o, stage: s } = b;
      const dot = card.querySelector<HTMLElement>(
        `#rg-link-${o.threat.id}-${b.routeIndex}-${b.index}`,
      );
      const li = document.createElement("li");
      const where = `${o.threat.name} · ${b.route.route.name}`;

      if (s.state === "cut") {
        dot?.classList.add("cut");
        li.className = "lab-ev good";
        li.textContent = `${where} — cut at "${s.stage.name}" by ${s.by
          .map((c) => controlById(c).name)
          .join(" / ")}`;
      } else {
        dot?.classList.add("through");
        if (s.seenBy.length > 0) dot?.classList.add("seen");
        li.className = s.seenBy.length > 0 ? "lab-ev warn" : "lab-ev bad";
        li.textContent =
          `${where} — "${s.stage.name}" goes through` +
          (s.seenBy.length > 0 ? " (logged, not stopped)" : "");
      }
      log.appendChild(li);
      log.scrollTop = log.scrollHeight;

      if (b.endsRoute) {
        card
          .querySelectorAll(`#rg-lane-${o.threat.id} .rg-routeline`)
          [b.routeIndex]?.classList.add(b.route.open ? "open" : "cut");
      }

      if (b.endsThreat) {
        const v = card.querySelector<HTMLElement>(`#rg-v-${o.threat.id}`);
        if (v) {
          v.textContent =
            o.verdict === "contained"
              ? "contained"
              : o.verdict === "detected"
                ? "landed · detected"
                : "landed";
          v.className = `rg-lane-verdict ${o.verdict}`;
        }
        card
          .querySelector(`#rg-lane-${o.threat.id}`)
          ?.classList.add(o.verdict);
      }
      i += 1;
    }

    function finish(): void {
      const actions = card.querySelector<HTMLElement>(".drill-actions")!;
      actions.innerHTML = `<button class="drill-btn primary" data-act="debrief" type="button">read the debrief</button>`;
      const btn = actions.querySelector<HTMLButtonElement>("[data-act=debrief]")!;
      btn.addEventListener("click", submit);
      btn.focus();
    }

    timer = window.setInterval(() => {
      if (i < beats.length) showBeat();
      if (i >= beats.length) {
        clearInterval(timer);
        finish();
      }
    }, TICK_MS);

    card.querySelector("[data-act=skip]")?.addEventListener("click", () => {
      clearInterval(timer);
      while (i < beats.length) showBeat();
      finish();
    });
    card.querySelector("[data-act=close]")?.addEventListener("click", close);
  }

  // --- screen 5: the debrief ------------------------------------------------

  function submit(): void {
    const res = result!;
    cal = calibrate(res, prediction);
    recordRange(res, cal);
    // One journal entry per threat resolved, so a range run lands in the flight
    // record at roughly the weight of a drill session rather than a single tap.
    for (const o of res.outcomes) {
      logActivity(o.verdict === "contained" ? "held" : "breached");
    }
    renderDebrief();
  }

  function routeBlock(r: RouteResult): string {
    const steps = r.stages
      .map((s, i) => {
        const state =
          s.state === "cut"
            ? `<span class="rg-chain-tag cut">cut — ${esc(s.by.map((c) => controlById(c).name).join(" / "))}</span>`
            : s.state === "through"
              ? s.seenBy.length > 0
                ? `<span class="rg-chain-tag seen">through · logged by ${esc(s.seenBy.map((c) => controlById(c).name).join(", "))}</span>`
                : `<span class="rg-chain-tag through">through</span>`
              : `<span class="rg-chain-tag unreached">never reached</span>`;
        return `
          <li class="rg-chain-step ${s.state}">
            <span class="rg-step-n">${i + 1}</span>
            <div>
              <p class="rg-step-name">${esc(s.stage.name)} ${state}</p>
              <p class="rg-step-text">${esc(s.stage.text)}</p>
            </div>
          </li>`;
      })
      .join("");

    return `
      <div class="rg-route ${r.open ? "open" : "cut"}">
        <p class="rg-route-head">
          <span class="rg-route-mark">${r.open ? "route open" : "route cut"}</span>
          <span class="rg-route-name">${esc(r.route.name)}</span>
        </p>
        <p class="rg-route-why">${esc(r.route.why)}</p>
        <ol class="rg-chain">${steps}</ol>
      </div>`;
  }

  function chainRow(o: Outcome, callKind: string | null): string {
    const links = o.routes.map(routeBlock).join("");

    const callBadge =
      callKind === "blindspot"
        ? `<span class="rg-callmark blindspot">you called this contained</span>`
        : callKind === "pessimism"
          ? `<span class="rg-callmark pessimism">you expected this through</span>`
          : `<span class="rg-callmark right">called correctly</span>`;

    return `
      <div class="rg-threat ${o.verdict}">
        <p class="rg-threat-head">
          <span class="rg-verdict ${o.verdict}">${o.verdict === "contained" ? "contained" : o.verdict === "detected" ? "landed · detected" : "landed"}</span>
          <span class="rg-threat-name">${esc(o.threat.name)}</span>
          <span class="rg-sev s${o.threat.severity}">${esc(SEV_LABEL[o.threat.severity])}</span>
          ${callBadge}
        </p>
        <p class="rg-threat-setting">${esc(o.threat.setting)}</p>
        <p class="rg-routes-note">${
          o.openRoutes.length === 0
            ? "Both routes cut — this is what containment means here."
            : o.openRoutes.length === o.routes.length
              ? "Every route open."
              : `${o.routes.length - o.openRoutes.length} of ${o.routes.length} routes cut, which changes nothing: an attacker who finds one path closed takes the other.`
        }</p>
        <div class="rg-routes">${links}</div>
        ${o.verdict !== "contained" ? `<p class="rg-impact"><span class="bb-brief-k bad">impact</span> ${esc(o.threat.impact)}</p>` : ""}
        <p class="rg-moral">${esc(o.threat.moral)}</p>
        <button class="lab-ref-link" data-jump="${o.threat.ref}" type="button">${esc(ordinalOf(o.threat.ref))} — read the section</button>
      </div>`;
  }

  function adviceRow(a: Advice): string {
    const names = a.wouldContain
      .map((id) => esc(result!.outcomes.find((o) => o.threat.id === id)!.threat.name))
      .join(", ");
    return `
      <div class="rg-advice${a.affordable ? "" : " unaffordable"}">
        <div class="rg-advice-main">
          <p class="rg-advice-name">${esc(a.control.name)} <span class="rg-advice-cost">${a.price} point${a.price === 1 ? "" : "s"}</span></p>
          <p class="rg-advice-why">${names ? `would contain ${names}` : `would cut links without fully containing anything on its own`}</p>
        </div>
        <div class="rg-advice-num">
          <strong>${a.perPoint}</strong>
          <span>risk removed<br />per point</span>
        </div>
        <button class="lab-ref-link" data-jump="${a.control.ref}" type="button">${esc(ordinalOf(a.control.ref))}</button>
      </div>`;
  }

  function renderDebrief(): void {
    const res = result!;
    const c = cal!;
    const callKind = new Map(c.calls.map((k) => [k.threat.id, k.kind]));

    const chains = res.outcomes
      .map((o) => chainRow(o, callKind.get(o.threat.id) ?? null))
      .join("");

    const advice =
      res.advice.length > 0
        ? `
          <h4 class="lab-h">best next point spent <span class="lab-h-ref">(residual risk removed per friction point)</span></h4>
          <div class="rg-advices">${res.advice.slice(0, 5).map(adviceRow).join("")}</div>`
        : `<p class="rg-foot">No remaining control cuts a chain in this deployment — you have contained what this threat list can reach.</p>`;

    const idle =
      res.idle.length > 0
        ? `
          <h4 class="lab-h">friction that bought nothing here</h4>
          <div class="lab-rec rg-idle">
            <p>${res.idle
              .map(
                (id) =>
                  `<strong>${esc(controlById(id).name)}</strong> (${costOf(res.deployment, id)} pt)`,
              )
              .join(", ")} cut no chain and saw no stage in this deployment. That is not an argument against the control — it may be the right one somewhere else. It is an argument against buying controls by reputation instead of against a threat list.</p>
          </div>`
        : "";

    const calNote =
      c.blindspots.length > 0
        ? `<p class="rg-cal-bad">${c.blindspots.length} blind spot${c.blindspots.length === 1 ? "" : "s"}: ${c.blindspots
            .map((k) => esc(k.threat.name))
            .join(", ")}. You believed the posture covered ${c.blindspots.length === 1 ? "this" : "these"} and it did not — which is the direction that gets exploited, because it is the direction nobody re-checks.</p>`
        : `<p class="rg-cal-good">No blind spots. Every threat you thought you had covered was covered — you know what your own posture does, which is rarer than having a good one.</p>`;

    const pessimism =
      c.pessimism.length > 0
        ? `<p class="rg-cal-note">Held anyway: ${c.pessimism.map((k) => esc(k.threat.name)).join(", ")}. Being wrong in this direction costs you worry, not incidents — but it also means you may be about to spend points on something already covered.</p>`
        : "";

    const store = readRange();
    const rec = store[res.deployment.id];
    const bestLine =
      rec && rec.runs > 1 ? `Best over ${rec.runs} runs: ${rec.best}%.` : "";

    card.innerHTML = `
      <p class="overlay-eyebrow">the range · debrief</p>
      <h3 class="drill-title">${esc(res.deployment.name)}</h3>
      <div class="lab-tiles">
        <div class="lab-tile">
          <span class="lab-tile-grade g-${res.grade}">${res.grade}</span>
          <span class="lab-tile-label">posture</span>
        </div>
        <div class="lab-tile">
          <span class="lab-tile-num">${res.contained}/${res.outcomes.length}</span>
          <span class="lab-tile-label">contained</span>
        </div>
        <div class="lab-tile">
          <span class="lab-tile-num">${res.residual}<span class="rg-of">/${res.worstCase}</span></span>
          <span class="lab-tile-label">residual risk</span>
        </div>
        <div class="lab-tile">
          <span class="lab-tile-num">${c.pct}%</span>
          <span class="lab-tile-label">calls right</span>
        </div>
        <div class="lab-tile">
          <span class="lab-tile-num">${res.friction}<span class="rg-of">/${res.budget}</span></span>
          <span class="lab-tile-label">friction spent</span>
        </div>
      </div>
      <p class="drill-note">${res.contained} contained, ${res.detected} detected but not stopped, ${res.landed} straight through. ${esc(bestLine)}</p>
      <h4 class="lab-h">calibration <span class="lab-h-ref">(what you thought your own posture did)</span></h4>
      <div class="lab-rec rg-cal">${calNote}${pessimism}</div>
      ${advice}
      ${idle}
      <h4 class="lab-h">the chains, link by link</h4>
      <div class="rg-threats">${chains}</div>
      <div class="bn-export">
        <button class="drill-btn" data-act="copy" type="button">copy the threat model</button>
        <button class="drill-btn" data-act="download" type="button">download .md</button>
      </div>
      <div class="drill-actions">
        <button class="drill-btn primary" data-act="again" type="button">spend the points differently</button>
        <button class="drill-btn" data-act="board" type="button">another deployment</button>
        <button class="drill-btn" data-act="close" type="button">close</button>
      </div>`;

    card.querySelectorAll<HTMLButtonElement>("[data-jump]").forEach((btn) => {
      btn.addEventListener("click", () => {
        close();
        jumpTo(btn.dataset.jump!);
      });
    });
    card.querySelector("[data-act=copy]")?.addEventListener("click", () => void copyMd());
    card.querySelector("[data-act=download]")?.addEventListener("click", downloadMd);
    card.querySelector("[data-act=again]")?.addEventListener("click", () => {
      prediction = {};
      renderHarden();
    });
    card.querySelector("[data-act=board]")?.addEventListener("click", renderBoard);
    card.querySelector("[data-act=close]")?.addEventListener("click", close);
  }

  async function copyMd(): Promise<void> {
    if (!result) return;
    const md = buildRangeMarkdown(result, cal);
    try {
      await navigator.clipboard.writeText(md);
      toast("threat model copied as Markdown");
    } catch {
      window.prompt("Copy the threat model:", md);
    }
  }

  function downloadMd(): void {
    if (!result) return;
    const blob = new Blob([buildRangeMarkdown(result, cal)], {
      type: "text/markdown",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `threat-model-${result.deployment.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast("threat model downloaded");
  }

  return { open };
}
