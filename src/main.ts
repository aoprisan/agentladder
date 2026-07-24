import "./styles.css";
import { meta, sections as part1, type Section } from "./content";
import { sections2 } from "./content2";

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
      (s) => `
      <article id="${s.id}" class="section" data-id="${s.id}">
        <header class="section-head">
          <p class="eyebrow"><span class="ord">${s.ordinal}</span>${s.tagline}</p>
          <h2>${s.title}</h2>
        </header>
        <div class="body">${s.body}</div>
        ${docsList(s)}
        <button class="ledger-toggle" data-id="${s.id}" type="button"></button>
      </article>`,
    )
    .join("");

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
        <p class="rail-foot">Updated ${meta.updated} · static site, no backend</p>
      </nav>
      <div class="main">
        <header class="gauge-bar" role="status" aria-live="polite">
          <span class="gauge-label">progress</span>
          <div class="gauge"><div class="gauge-fill" id="gauge-fill"></div></div>
          <span class="gauge-count" id="gauge-count"></span>
        </header>
        <main class="content">
          <section class="intro">
            <h1>${meta.title}</h1>
            <p class="lede">${meta.subtitle}. Work through the levels in order — each builds on the last. Mark sections done as you go; progress is stored locally on this device.</p>
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
      saveLedger(ledger);
      syncState();
    });
  });

  syncState();
  observeSections();
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
