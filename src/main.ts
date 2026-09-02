import "./styles.css";
import { meta, sections as part1, type Section } from "./content";
import { sections2 } from "./content2";
import { questionBank } from "./quiz";
import { initDrill } from "./drill";
import { initPalette } from "./palette";
import { initLab } from "./lab";
import { initStats } from "./stats";
import { initBlackBox } from "./blackboxui";
import { initBench } from "./bench";
import { initRange } from "./rangeui";
import { initArchitect } from "./architectui";
import { readArchHash } from "./architect";
import { initCheckride, readWingsHash } from "./checkride";
import { logActivity } from "./activity";
import { graphById, renderFigure } from "./agentgraph";
import { focusTokenMeter, mountTokenMeter } from "./tokenmeter";
import { buildShareUrl, readShareHash, clearShareHash } from "./share";
import { headingId, readingMinutes } from "./anchors";

const sections: Section[] = [...part1, ...sections2];

// ---------------------------------------------------------------------------
// Ledger state — which sections are marked done. Persisted in localStorage,
// mirroring the "feature ledger" pattern the guide itself describes (L7).
// ---------------------------------------------------------------------------
const STORE_KEY = "agentic-guide-ledger-v1";

type Ledger = Record<string, boolean>;

function loadLedger(): Ledger {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Ledger) : {};
  } catch {
    return {};
  }
}

function saveLedger(ledger: Ledger): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(ledger));
  } catch {
    /* private mode etc. — progress just won't persist */
  }
}

let ledger = loadLedger();

// A share link carrying a teammate's progress? Read it once, before render.
// Same for a wings certificate and an architect interview — the three hash
// formats are mutually exclusive, so at most one of these is non-null.
const pendingShare = readShareHash(sections);
const pendingWings = readWingsHash();
const pendingArch = readArchHash();

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
const app = document.getElementById("app");
if (!app) throw new Error("missing #app root");

function docsList(s: Section): string {
  if (s.docs.length === 0) return "";
  const items = s.docs
    .map(
      (d) =>
        `<li><a href="${d.url}" target="_blank" rel="noopener">${d.label}</a></li>`,
    )
    .join("");
  return `<aside class="docs"><h4>Official docs &amp; sources</h4><ul>${items}</ul></aside>`;
}

// Unlike section bodies (trusted, authored in-repo), the wings name arrives
// via the URL from whoever built the link — escape it before it touches HTML.
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function wingsBanner(): string {
  if (!pendingWings) return "";
  const verb = pendingWings.pct >= 80 ? "passed the checkride" : "flew the checkride";
  const mark = pendingWings.valid
    ? `<strong>✓ checksum verified</strong>`
    : `checksum mismatch — treat as unverified`;
  return `
    <div class="share-banner" id="wings-banner" role="region" aria-label="Checkride certificate">
      <p>✈ <strong>${esc(pendingWings.name)}</strong> ${verb} — <strong>${pendingWings.pct}%</strong> on ${pendingWings.date}. ${mark}.</p>
      <div class="share-actions">
        <button class="drill-btn primary" data-wings="take" type="button">take the checkride yourself</button>
        <button class="drill-btn" data-wings="dismiss" type="button">dismiss</button>
      </div>
    </div>`;
}

function shareBanner(): string {
  if (!pendingShare) return "";
  const n = pendingShare.done.length;
  return `
    <div class="share-banner" id="share-banner" role="region" aria-label="Shared progress">
      <p>This link carries a teammate's progress: <strong>${n}/${sections.length}</strong> sections marked done.</p>
      <div class="share-actions">
        <button class="drill-btn primary" data-share="merge" type="button">merge into mine</button>
        <button class="drill-btn" data-share="replace" type="button">replace mine</button>
        <button class="drill-btn" data-share="ignore" type="button">ignore</button>
      </div>
    </div>`;
}

// Reading time per section, estimated from the body text. Shown in each
// section header and summed in the intro, so a reader can budget a rung
// before starting it — the way a course lists hours and a ledger lists
// remaining work.
const minutesById = new Map(sections.map((s) => [s.id, readingMinutes(s.body)]));

function fmtMinutes(n: number): string {
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

// The course has a spine, so every rung links to the ones either side of
// it. Plain anchors: they work without JS, in print, and with the back
// button, and the rail's scrollspy picks the new section up on arrival.
function rungNav(i: number): string {
  const prev = sections[i - 1];
  const next = sections[i + 1];
  const link = (s: Section, dir: "prev" | "next"): string =>
    `<a class="rung-link ${dir}" href="#${s.id}" title="${dir === "prev" ? "Previous" : "Next"} rung"><span class="ord">${s.ordinal}</span><span class="rung-title">${s.title}</span></a>`;
  return `<nav class="rung-nav" aria-label="Adjacent rungs">${prev ? link(prev, "prev") : ""}${next ? link(next, "next") : ""}</nav>`;
}

function render(): void {
  const navItems = sections
    .map(
      (s) => `
      <li>
        <a href="#${s.id}" class="nav-link" data-id="${s.id}">
          <span class="ord">${s.ordinal}</span>
          <span class="nav-title">${s.title}</span>
          <span class="dot" aria-hidden="true"></span>
        </a>
      </li>`,
    )
    .join("");

  const articles = sections
    .map(
      (s, i) => `
      <article id="${s.id}" class="section" data-id="${s.id}">
        <header class="section-head">
          <p class="eyebrow"><span class="ord">${s.ordinal}</span><span class="tagline">${s.tagline}</span><span class="read-time" title="Estimated reading time at 200 words a minute">${minutesById.get(s.id)} min</span></p>
          <h2>${s.title}</h2>
        </header>
        <div class="body">${s.body}</div>
        ${docsList(s)}
        <footer class="rung-foot">
          <button class="ledger-toggle" data-id="${s.id}" type="button"></button>
          ${rungNav(i)}
        </footer>
      </article>`,
    )
    .join("");

  const totalMinutes = [...minutesById.values()].reduce((a, b) => a + b, 0);

  app!.innerHTML = `
    <div class="shell">
      <nav class="rail" aria-label="Guide sections">
        <div class="brand">
          <span class="brand-mark" aria-hidden="true">▚</span>
          <div>
            <p class="brand-title">${meta.title}</p>
            <p class="brand-sub">${meta.subtitle}</p>
          </div>
        </div>
        <ul class="nav-list">${navItems}</ul>
        <p class="rail-foot">Updated ${meta.updated} · static site, no backend<br />⌘K search · [ ] previous / next rung · architect · pattern lab · black box · bench · range · checkride · progress travels by link</p>
      </nav>
      <div class="main">
        <header class="gauge-bar" role="status" aria-live="polite">
          <span class="gauge-label">progress</span>
          <div class="gauge"><div class="gauge-fill" id="gauge-fill"></div></div>
          <span class="gauge-count" id="gauge-count"></span>
          <a class="bar-btn continue" id="btn-continue" href="#" hidden>continue</a>
          <button class="bar-btn" id="btn-architect" type="button" title="The architect — profile a real task, get a ranked design and an exportable decision brief">architect</button>
          <button class="bar-btn" id="btn-drill" type="button" title="Recall drill — spaced repetition over what you've read">drill</button>
          <button class="bar-btn" id="btn-lab" type="button" title="Pattern lab — simulate an agent run and watch the trade-offs">lab</button>
          <button class="bar-btn" id="btn-bb" type="button" title="The black box — read a recorded agent run and find where it went wrong">black box</button>
          <button class="bar-btn" id="btn-bench" type="button" title="The bench — review your own CLAUDE.md, prompt, or tool description">bench</button>
          <button class="bar-btn" id="btn-range" type="button" title="The range — spend a friction budget on controls, then find out which attacks your posture actually holds">range</button>
          <button class="bar-btn" id="btn-ride" type="button" title="The checkride — 20-question exam, pass mark 80%, shareable wings">checkride</button>
          <button class="bar-btn" id="btn-stats" type="button" title="Flight record — streaks, mastery, and review forecast">stats</button>
          <button class="bar-btn" id="btn-search" type="button" title="Search the guide (⌘K)">⌘K</button>
        </header>
        <main class="content">
          ${shareBanner()}
          ${wingsBanner()}
          <section class="intro">
            <h1>${meta.title}</h1>
            <p class="lede">${meta.subtitle}. This is a course with a spine, not a reference to skim: thirteen levels climb from the first workable mental model (L0) to expert practice — multi-agent systems, adversarial hardening, loop engineering, the evals that prove it works (L11), and reading the run when it doesn't (L12) — and each rung assumes the ones below it.</p>
            <p class="lede">It also checks that the learning sticks. The drill schedules what you read for spaced recall; the lab, black box, bench and range make you apply it to live runs, real artifacts and real attacks; the checkride certifies the result. New to agents? Start at L0 and climb in order. Already deep in this? Take the checkride first and let the gaps it finds pick your rungs. Mark sections done as you go; progress stays on this device and can travel to a teammate by link.</p>
            <p class="intro-meta">About ${fmtMinutes(totalMinutes)} of reading across ${sections.length} rungs · each rung shows its own · <a href="#glossary">glossary</a> for any term you don't know · <kbd>[</kbd> <kbd>]</kbd> move between rungs</p>
            <p class="disclaimer">${meta.disclaimer}</p>
          </section>
          ${articles}
        </main>
      </div>
    </div>`;

  app!.querySelectorAll<HTMLButtonElement>(".ledger-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id!;
      ledger[id] = !ledger[id];
      if (ledger[id]) logActivity("read");
      saveLedger(ledger);
      syncState();
    });
  });

  hydrateGraphs();
  hydrateWidgets();
  hydrateHeadings();
  syncState();
  observeSections();
}

// Every h3 gets a stable id (`<section>--<slug>`, from anchors.ts — the same
// ids the palette computes, so a search hit lands on its heading) and a
// hover "#" link; sections long enough to need one get an "on this rung"
// outline under the header. Done after render so the markup stays out of
// the content files and out of the palette's index.
const OUTLINE_MIN = 5;
function hydrateHeadings(): void {
  app!.querySelectorAll<HTMLElement>("article.section").forEach((article) => {
    const sectionId = article.dataset.id!;
    const seen = new Map<string, number>();
    const items: string[] = [];
    article.querySelectorAll<HTMLHeadingElement>(".body h3").forEach((h) => {
      const text = (h.textContent ?? "").trim();
      const id = headingId(sectionId, text, seen);
      h.id = id;
      h.insertAdjacentHTML(
        "beforeend",
        ` <a class="hlink" href="#${id}" aria-label="Link to this heading">#</a>`,
      );
      items.push(`<li><a href="#${id}">${esc(text)}</a></li>`);
    });
    if (items.length >= OUTLINE_MIN) {
      article
        .querySelector(".section-head")
        ?.insertAdjacentHTML(
          "afterend",
          `<nav class="outline" aria-label="On this rung"><span class="outline-label">on this rung</span><ol>${items.join("")}</ol></nav>`,
        );
    }
  });
}

// Section bodies mark where a topology diagram goes with an empty
// `<div data-graph="…">`; the SVG is built here so the diagrams stay typed
// data (agentgraph.ts) instead of hand-written markup — and so the palette's
// index, which reads the body strings, never sees a wall of SVG.
function hydrateGraphs(): void {
  app!.querySelectorAll<HTMLElement>("[data-graph]").forEach((slot) => {
    const graph = graphById(slot.dataset.graph!);
    if (graph) slot.innerHTML = renderFigure(graph);
  });
}

// Interactive widgets get the same treatment as the diagrams: the body marks
// the slot with an empty `<div data-widget="…">` and the markup is built here,
// which keeps it out of the content files and out of the palette's index.
function hydrateWidgets(): void {
  app!.querySelectorAll<HTMLElement>("[data-widget]").forEach((slot) => {
    if (slot.dataset.widget === "token-meter") mountTokenMeter(slot);
  });
}

function syncState(): void {
  const doneCount = sections.filter((s) => ledger[s.id]).length;

  sections.forEach((s) => {
    const done = Boolean(ledger[s.id]);
    const article = document.querySelector(`article[data-id="${s.id}"]`);
    const link = document.querySelector(`.nav-link[data-id="${s.id}"]`);
    const btn = document.querySelector<HTMLButtonElement>(
      `.ledger-toggle[data-id="${s.id}"]`,
    );
    article?.classList.toggle("done", done);
    link?.classList.toggle("done", done);
    if (btn) {
      btn.textContent = done ? "✓ done — mark as unread" : "mark section as done";
      btn.setAttribute("aria-pressed", String(done));
    }
  });

  const fill = document.getElementById("gauge-fill");
  const count = document.getElementById("gauge-count");
  if (fill) fill.style.width = `${(doneCount / sections.length) * 100}%`;
  if (count) count.textContent = `${doneCount}/${sections.length} sections`;

  // "Continue" resumes at the first rung not yet marked done — the ledger
  // read the way L7 says to read one. Hidden until something is done, and
  // again once everything is.
  const cont = document.getElementById("btn-continue") as HTMLAnchorElement | null;
  if (cont) {
    const next = doneCount > 0 ? sections.find((s) => !ledger[s.id]) : undefined;
    cont.hidden = !next;
    if (next) {
      cont.href = `#${next.id}`;
      cont.title = `Pick up at ${next.ordinal} — ${next.title} (${minutesById.get(next.id)} min)`;
      cont.innerHTML = `continue <span class="ord">${next.ordinal}</span>`;
    }
  }
}

// Highlight the section currently in view in the rail.
function observeSections(): void {
  const links = new Map<string, Element>();
  document
    .querySelectorAll(".nav-link")
    .forEach((l) => links.set((l as HTMLElement).dataset.id!, l));

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          links.forEach((l) => l.classList.remove("current"));
          const id = (entry.target as HTMLElement).dataset.id!;
          links.get(id)?.classList.add("current");
        }
      }
    },
    { rootMargin: "-20% 0px -70% 0px" },
  );

  document.querySelectorAll("article.section").forEach((a) => observer.observe(a));
}

render();

// ---------------------------------------------------------------------------
// Toast — tiny transient confirmation, used by copy-link and share import.
// ---------------------------------------------------------------------------
let toastTimer = 0;
function toast(msg: string): void {
  let el = document.querySelector<HTMLElement>(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el!.classList.remove("show"), 2200);
}

// ---------------------------------------------------------------------------
// Recall drill — spaced repetition over the question bank (see drill.ts).
// ---------------------------------------------------------------------------
const ordinalOf = (sectionId: string): string =>
  sections.find((s) => s.id === sectionId)?.ordinal ?? "";

// Scroll to a section and flash it — used by lab debrief links (palette has
// its own copy scoped to its overlay lifecycle).
function jumpTo(sectionId: string): void {
  const target = document.getElementById(sectionId);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  target.classList.remove("flash");
  void target.offsetWidth;
  target.classList.add("flash");
  setTimeout(() => target.classList.remove("flash"), 1800);
}

function updateDrillBadge(): void {
  const btn = document.getElementById("btn-drill");
  if (!btn) return;
  const n = drill.readyCount();
  btn.innerHTML = n > 0 ? `drill <span class="due-badge">${n}</span>` : "drill";
}

const drill = initDrill(questionBank, ordinalOf, () => updateDrillBadge());
updateDrillBadge();
document.getElementById("btn-drill")?.addEventListener("click", () => drill.open());

// ---------------------------------------------------------------------------
// Pattern lab — simulate an agent run against the guide's claims (see lab.ts).
// ---------------------------------------------------------------------------
const lab = initLab(jumpTo);
document.getElementById("btn-lab")?.addEventListener("click", () => lab.open());

// ---------------------------------------------------------------------------
// The black box — trajectory review over recorded runs (blackboxui.ts). The
// only exercise here that hands you an answer with nothing highlighted.
// ---------------------------------------------------------------------------
const blackbox = initBlackBox(jumpTo, ordinalOf);
document.getElementById("btn-bb")?.addEventListener("click", () => blackbox.open());

// ---------------------------------------------------------------------------
// The bench — review a real artifact against the guide's rules (bench.ts).
// Nothing pasted here is persisted or leaves the tab; see the module header.
// ---------------------------------------------------------------------------
const bench = initBench(jumpTo, ordinalOf, toast);
document.getElementById("btn-bench")?.addEventListener("click", () => bench.open());

// ---------------------------------------------------------------------------
// The range — the adversarial exercise (rangeui.ts). Spend a friction budget
// on controls, call which attacks your posture holds, then watch the chains.
// ---------------------------------------------------------------------------
const range = initRange(jumpTo, ordinalOf, toast);
document.getElementById("btn-range")?.addEventListener("click", () => range.open());

// ---------------------------------------------------------------------------
// The architect — profile a real task, get a design + brief (architectui.ts).
// A #arch= link opens straight onto the shared verdict.
// ---------------------------------------------------------------------------
const architect = initArchitect(jumpTo, (mission, cfg) => lab.openWith(mission, cfg), toast);
document.getElementById("btn-architect")?.addEventListener("click", () => architect.open());

if (pendingArch) {
  clearShareHash();
  architect.openWithAnswers(pendingArch);
  toast("a teammate's architecture interview — verdict recomputed locally");
}

// ---------------------------------------------------------------------------
// The checkride — certification exam with shareable wings (checkride.ts).
// ---------------------------------------------------------------------------
const checkride = initCheckride(sections, questionBank, ordinalOf, jumpTo, toast);
document.getElementById("btn-ride")?.addEventListener("click", () => checkride.open());

const wingsEl = document.getElementById("wings-banner");
wingsEl?.querySelectorAll<HTMLButtonElement>("[data-wings]").forEach((btn) => {
  btn.addEventListener("click", () => {
    clearShareHash();
    wingsEl.remove();
    if (btn.dataset.wings === "take") checkride.open();
  });
});

// ---------------------------------------------------------------------------
// Flight record — streaks, mastery, and review forecast (see stats.ts).
// ---------------------------------------------------------------------------
const stats = initStats(sections, questionBank, () => ledger);
document.getElementById("btn-stats")?.addEventListener("click", () => stats.open());

// ---------------------------------------------------------------------------
// Team share-links — progress that travels by URL (see share.ts).
// ---------------------------------------------------------------------------
async function copyShareLink(): Promise<void> {
  const url = buildShareUrl(sections, ledger);
  try {
    await navigator.clipboard.writeText(url);
    toast("progress link copied — send it to a teammate");
  } catch {
    window.prompt("Copy this progress link:", url);
  }
}

const banner = document.getElementById("share-banner");
banner?.querySelectorAll<HTMLButtonElement>("[data-share]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const act = btn.dataset.share;
    if (act === "merge" || act === "replace") {
      if (act === "replace") ledger = {};
      for (const id of pendingShare?.done ?? []) ledger[id] = true;
      saveLedger(ledger);
      syncState();
      toast(act === "merge" ? "progress merged" : "progress replaced");
    }
    clearShareHash();
    banner.remove();
  });
});

// ---------------------------------------------------------------------------
// Command palette — ⌘K search across everything (see palette.ts).
// ---------------------------------------------------------------------------
const palette = initPalette(sections, [
  {
    label: "Ask the architect",
    hint: "profile a real task — ranked patterns, guardrails, exportable brief",
    run: () => architect.open(),
  },
  {
    label: "Start recall drill",
    hint: "spaced-repetition cards over what you've read",
    run: () => drill.open(),
  },
  {
    label: "Take the checkride",
    hint: "20 questions, one pass, 80% to earn shareable wings",
    run: () => checkride.open(),
  },
  {
    label: "Open the black box",
    hint: "read a recorded agent run and find the turns where it went wrong",
    run: () => blackbox.open(),
  },
  {
    label: "Run the range",
    hint: "spend a friction budget on controls, then find out which attacks your posture actually holds",
    run: () => range.open(),
  },
  {
    label: "Review an artifact on the bench",
    hint: "your CLAUDE.md, prompt, or tool description — line-anchored findings, stays on this device",
    run: () => bench.open(),
  },
  {
    label: "Estimate a prompt's token cost",
    hint: "paste a prompt or CLAUDE.md — composition, window share, format comparison",
    run: () => {
      jumpTo("prompt-formats");
      focusTokenMeter();
    },
  },
  {
    label: "Open the glossary",
    hint: "every term the ladder leans on, one line each, with the rung that teaches it",
    run: () => jumpTo("glossary"),
  },
  {
    label: "Open the pattern lab",
    hint: "simulate an agent run — architecture, context, tools, trade-offs",
    run: () => lab.open(),
  },
  {
    label: "Open your flight record",
    hint: "streaks, recall mastery, and the 14-day review forecast",
    run: () => stats.open(),
  },
  {
    label: "Copy team progress link",
    hint: "share your ledger as a URL — no backend, no account",
    run: () => void copyShareLink(),
  },
]);
document.getElementById("btn-search")?.addEventListener("click", () => palette.open());

// ---------------------------------------------------------------------------
// Keyboard: "[" and "]" move to the previous / next rung, from wherever the
// scrollspy says you are. Ignored while typing or while any overlay is up,
// so the drill's and the bench's own key handling is never shadowed.
// ---------------------------------------------------------------------------
document.addEventListener("keydown", (e) => {
  if (e.key !== "[" && e.key !== "]") return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const el = document.activeElement;
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  ) {
    return;
  }
  if (document.querySelector(".overlay:not([hidden])")) return;
  const currentId = document.querySelector<HTMLElement>(".nav-link.current")?.dataset.id;
  const i = sections.findIndex((s) => s.id === currentId);
  const target = e.key === "]" ? sections[i + 1] : i > 0 ? sections[i - 1] : undefined;
  if (!target) return;
  e.preventDefault();
  jumpTo(target.id);
});

// ---------------------------------------------------------------------------
// PWA — register the service worker so the guide installs and works offline.
// Registered relative to the document (works from any GitHub Pages sub-path).
// ---------------------------------------------------------------------------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      /* offline support just won't be available — the app still works */
    });
  });
}
