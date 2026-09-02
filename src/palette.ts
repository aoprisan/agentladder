// ---------------------------------------------------------------------------
// Command palette — ⌘K / Ctrl+K / "/" opens an overlay with full-text search
// across every section body plus a few quick actions. The index is built at
// startup from the same typed Section data the page renders from: bodies are
// parsed in a detached <template>, split into heading-scoped blocks (one entry
// per paragraph / list item / table row / glossary term), and searched with
// a token-AND scorer that weights title > heading > body text. A hit lands
// on its heading, not just its section, using the same ids main.ts stamps
// on the live h3s (anchors.ts). Zero dependencies.
// ---------------------------------------------------------------------------

import type { Section } from "./content";
import { headingId } from "./anchors";

interface IndexEntry {
  sectionId: string;
  ordinal: string;
  sectionTitle: string;
  heading: string; // nearest h3 above the block (or the glossary term), "" for lead blocks
  anchor: string; // element id of that h3, "" when there is none
  text: string;
}

export interface PaletteAction {
  label: string;
  hint: string;
  run: () => void;
}

function clean(s: string | null): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildIndex(sections: Section[]): IndexEntry[] {
  const entries: IndexEntry[] = [];
  const tpl = document.createElement("template");
  for (const s of sections) {
    const base = { sectionId: s.id, ordinal: s.ordinal, sectionTitle: s.title };
    entries.push({ ...base, heading: "", anchor: "", text: s.tagline });
    tpl.innerHTML = s.body;
    let heading = "";
    let anchor = "";
    const seen = new Map<string, number>();
    for (const el of Array.from(tpl.content.children)) {
      const tag = el.tagName;
      if (tag === "H3" || tag === "H4") {
        heading = clean(el.textContent);
        // main.ts stamps ids on h3s only; an h4 keeps the h3 above it.
        if (tag === "H3") anchor = headingId(s.id, heading, seen);
        continue;
      }
      if (tag === "UL" || tag === "OL") {
        for (const li of Array.from(el.children)) {
          const text = clean(li.textContent);
          if (text) entries.push({ ...base, heading, anchor, text });
        }
      } else if (tag === "TABLE") {
        for (const row of Array.from(el.querySelectorAll("tr"))) {
          const text = clean(row.textContent);
          if (text) entries.push({ ...base, heading, anchor, text });
        }
      } else if (tag === "DL") {
        // A definition list indexes one entry per term, with the term as the
        // heading — so "trifecta" ranks the glossary line, not the whole list.
        let term = "";
        for (const child of Array.from(el.children)) {
          if (child.tagName === "DT") term = clean(child.textContent);
          else if (child.tagName === "DD") {
            const text = clean(child.textContent);
            if (text) entries.push({ ...base, heading: term, anchor, text });
          }
        }
      } else {
        const text = clean(el.textContent);
        if (text) entries.push({ ...base, heading, anchor, text });
      }
    }
  }
  return entries;
}

interface Scored {
  entry: IndexEntry;
  score: number;
}

function searchIndex(index: IndexEntry[], tokens: string[]): Scored[] {
  const out: Scored[] = [];
  for (const entry of index) {
    const title = entry.sectionTitle.toLowerCase();
    const head = entry.heading.toLowerCase();
    const text = entry.text.toLowerCase();
    let score = 0;
    let all = true;
    for (const t of tokens) {
      let s = 0;
      if (title.includes(t)) s += 6;
      if (head.includes(t)) s += 4;
      const pos = text.indexOf(t);
      if (pos >= 0) s += pos < 80 ? 2 : 1;
      if (s === 0) {
        all = false;
        break;
      }
      score += s;
    }
    if (all) out.push({ entry, score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 8);
}

function snippet(text: string, tokens: string[]): string {
  const lower = text.toLowerCase();
  let first = -1;
  for (const t of tokens) {
    const pos = lower.indexOf(t);
    if (pos >= 0 && (first === -1 || pos < first)) first = pos;
  }
  let start = Math.max(0, (first === -1 ? 0 : first) - 40);
  if (start > 0) {
    const space = text.indexOf(" ", start);
    if (space !== -1 && space < start + 20) start = space + 1;
  }
  const raw = text.slice(start, start + 170);
  let html = esc((start > 0 ? "…" : "") + raw + (start + 170 < text.length ? "…" : ""));
  for (const t of tokens) {
    if (!t) continue;
    const pattern = esc(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    html = html.replace(new RegExp(`(${pattern})`, "gi"), "<mark>$1</mark>");
  }
  return html;
}

export function initPalette(
  sections: Section[],
  actions: PaletteAction[],
): { open: () => void } {
  const index = buildIndex(sections);

  const overlay = document.createElement("div");
  overlay.className = "overlay palette";
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="overlay-card pal-card" role="dialog" aria-modal="true" aria-label="Search the guide">
      <input class="pal-input" type="text" placeholder="Search the guide…  (esc to close)"
             autocomplete="off" spellcheck="false" aria-label="Search query" />
      <ul class="pal-results" role="listbox"></ul>
      <p class="pal-foot">↑↓ navigate · ↵ open · esc close</p>
    </div>`;
  document.body.appendChild(overlay);
  const input = overlay.querySelector<HTMLInputElement>(".pal-input")!;
  const list = overlay.querySelector<HTMLUListElement>(".pal-results")!;

  interface Row {
    html: string;
    run: () => void;
  }
  let rows: Row[] = [];
  let selected = 0;

  function jumpTo(sectionId: string, anchor = ""): void {
    const section = document.getElementById(sectionId);
    if (!section) return;
    // Land on the heading the hit sits under when it has one; the section
    // still flashes so the eye knows which card it is in.
    const target = (anchor && document.getElementById(anchor)) || section;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    section.classList.remove("flash");
    // restart the animation even when jumping to the same section twice
    void section.offsetWidth;
    section.classList.add("flash");
    setTimeout(() => section.classList.remove("flash"), 1800);
  }

  function computeRows(query: string): Row[] {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    const out: Row[] = [];

    const matchingActions =
      tokens.length === 0
        ? actions
        : actions.filter((a) =>
            tokens.every((t) => a.label.toLowerCase().includes(t)),
          );
    for (const a of matchingActions) {
      out.push({
        html: `<span class="ord pal-ord">→</span><div class="pal-text"><p class="pal-title">${esc(a.label)}</p><p class="pal-snip">${esc(a.hint)}</p></div>`,
        run: a.run,
      });
    }

    if (tokens.length === 0) {
      for (const s of sections) {
        out.push({
          html: `<span class="ord pal-ord">${s.ordinal}</span><div class="pal-text"><p class="pal-title">${esc(s.title)}</p><p class="pal-snip">${esc(s.tagline)}</p></div>`,
          run: () => jumpTo(s.id),
        });
      }
      return out;
    }

    for (const { entry } of searchIndex(index, tokens)) {
      const where = entry.heading
        ? `${esc(entry.sectionTitle)} · ${esc(entry.heading)}`
        : esc(entry.sectionTitle);
      out.push({
        html: `<span class="ord pal-ord">${entry.ordinal}</span><div class="pal-text"><p class="pal-title">${where}</p><p class="pal-snip">${snippet(entry.text, tokens)}</p></div>`,
        run: () => jumpTo(entry.sectionId, entry.anchor),
      });
    }
    return out;
  }

  function renderRows(): void {
    if (rows.length === 0) {
      list.innerHTML = `<li class="pal-empty">no matches — try fewer words</li>`;
      return;
    }
    list.innerHTML = rows
      .map(
        (r, i) =>
          `<li class="pal-item${i === selected ? " selected" : ""}" data-i="${i}" role="option" aria-selected="${i === selected}">${r.html}</li>`,
      )
      .join("");
    list.querySelectorAll<HTMLLIElement>(".pal-item").forEach((li) => {
      li.addEventListener("click", () => pick(Number(li.dataset.i)));
      li.addEventListener("mousemove", () => {
        const i = Number(li.dataset.i);
        if (i !== selected) {
          selected = i;
          renderRows();
        }
      });
    });
    list.querySelector(".selected")?.scrollIntoView({ block: "nearest" });
  }

  function refresh(): void {
    rows = computeRows(input.value);
    selected = 0;
    renderRows();
  }

  function pick(i: number): void {
    const row = rows[i];
    if (!row) return;
    close();
    row.run();
  }

  function open(): void {
    overlay.hidden = false;
    input.value = "";
    refresh();
    input.focus();
  }

  function close(): void {
    overlay.hidden = true;
    // Drop focus from the hidden input, or the "/" shortcut reads the page as
    // still typing and refuses to reopen until something else is clicked.
    input.blur();
  }

  input.addEventListener("input", refresh);
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      selected = Math.min(selected + 1, rows.length - 1);
      renderRows();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selected = Math.max(selected - 1, 0);
      renderRows();
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(selected);
    } else if (e.key === "Escape") {
      close();
    }
  });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  document.addEventListener("keydown", (e) => {
    const inField =
      document.activeElement instanceof HTMLInputElement ||
      document.activeElement instanceof HTMLTextAreaElement;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (overlay.hidden) open();
      else close();
    } else if (e.key === "/" && !inField && overlay.hidden) {
      e.preventDefault();
      open();
    }
  });

  return { open };
}
