// ---------------------------------------------------------------------------
// The crew console — UI over crew.ts. Paste teammates' progress links and
// wings links, get the team's coverage matrix, gap list, and a Markdown
// export. Names and decoded progress bits stay on this device; pasting a URL
// never causes a request to it.
// ---------------------------------------------------------------------------

import type { Section } from "./content";
import {
  buildCrewMarkdown,
  mergeIntoRoster,
  parseCrewText,
  readCrew,
  saveCrew,
  summarizeCrew,
  type CrewMember,
} from "./crew";

export interface CrewHandle {
  open(): void;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function initCrew(
  sections: Section[],
  jumpTo: (sectionId: string) => void,
  toast: (msg: string) => void,
): CrewHandle {
  let members: CrewMember[] = readCrew();

  const overlay = document.createElement("div");
  overlay.className = "overlay crew";
  overlay.hidden = true;
  overlay.innerHTML = `<div class="overlay-card cw-card" role="dialog" aria-modal="true" aria-label="The crew console"></div>`;
  document.body.appendChild(overlay);
  const card = overlay.querySelector<HTMLElement>(".cw-card")!;

  function close(): void {
    overlay.hidden = true;
    document.removeEventListener("keydown", onKey);
  }

  function onKey(e: KeyboardEvent): void {
    if (overlay.hidden) return;
    if (e.key === "Escape") {
      if (document.activeElement === card.querySelector(".cw-paste")) return;
      close();
    }
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  function open(): void {
    members = readCrew();
    overlay.hidden = false;
    document.addEventListener("keydown", onKey);
    render();
  }

  function matrix(): string {
    if (members.length === 0) {
      return `<div class="bn-empty"><p>No crew yet. Paste the links teammates sent — their progress links (<code>#share=…</code>) and wings links (<code>#wings=…</code>) — one per line, optionally with a name in front: <code>ana: https://…#share=4.1fff</code>. Everything is decoded in this tab; nothing is fetched or uploaded.</p></div>`;
    }
    const s = summarizeCrew(members, sections);

    const head = `<tr><th class="cw-name-h">crew</th>${sections
      .map((x) => `<th title="${esc(x.title)}">${esc(x.ordinal)}</th>`)
      .join("")}<th>wings</th><th></th></tr>`;

    const rows = members
      .map((m, mi) => {
        const cells = sections
          .map((x) =>
            m.done.includes(x.id)
              ? `<td class="cw-done" title="${esc(m.name)} — ${esc(x.title)}">✓</td>`
              : `<td class="cw-not" title="${esc(m.name)} — ${esc(x.title)} not read">·</td>`,
          )
          .join("");
        const wings = m.wings
          ? `<td class="cw-wings${m.wings.valid ? "" : " unverified"}" title="${m.wings.valid ? "checksum verified" : "checksum mismatch — treat as unverified"}">${m.wings.pct}%</td>`
          : `<td class="cw-not">—</td>`;
        return `<tr><td class="cw-name">${esc(m.name)}</td>${cells}${wings}<td><button class="cw-remove" data-remove="${mi}" type="button" title="remove ${esc(m.name)} from the roster">×</button></td></tr>`;
      })
      .join("");

    const totals = `<tr class="cw-totals"><td class="cw-name">everyone</td>${s.coverage
      .map((c) => `<td>${c.count}/${members.length}</td>`)
      .join("")}<td>${s.certified}</td><td></td></tr>`;

    const gaps =
      s.gaps.length > 0
        ? `<h4 class="lab-h">blind spots <span class="lab-h-ref">(read by the fewest)</span></h4>
           <ul class="lab-findings">${s.gaps
             .map(
               (g) => `
             <li class="lab-finding ${g.count === 0 ? "bad" : "note"}">
               <p><strong>${esc(g.ordinal)} · ${esc(g.title)}</strong> — read by ${g.count}/${members.length}</p>
               <button class="lab-ref-link" data-jump="${g.id}" type="button">open the section →</button>
             </li>`,
             )
             .join("")}</ul>`
        : `<p class="drill-note">Full coverage — every section has been read by everyone on the roster.</p>`;

    return `
      <div class="lab-tiles">
        <div class="lab-tile"><span class="lab-tile-num">${members.length}</span><span class="lab-tile-label">crew</span></div>
        <div class="lab-tile"><span class="lab-tile-num">${s.coveragePct}%</span><span class="lab-tile-label">of the grid read</span></div>
        <div class="lab-tile"><span class="lab-tile-num">${s.certified}</span><span class="lab-tile-label">certified (≥80%)</span></div>
      </div>
      <div class="cw-scroll"><table class="cw-matrix">${head}${rows}${totals}</table></div>
      ${gaps}
      <div class="drill-actions">
        <button class="drill-btn primary" data-act="copy" type="button">copy matrix as Markdown</button>
        <button class="drill-btn" data-act="clear" type="button">clear roster</button>
      </div>`;
  }

  function render(): void {
    card.innerHTML = `
      <p class="overlay-eyebrow">the crew console</p>
      <h3 class="drill-title">Team coverage, no backend</h3>
      <p class="drill-note">Progress already travels by link — this is the aggregate. Paste the team's share-links and wings links below (one per line, <code>name:</code> prefix optional) and read the matrix. The roster stores names and decoded progress only, on this device; the pasted links themselves are not kept.</p>
      <textarea class="cw-paste" spellcheck="false" rows="4" aria-label="Teammate links, one per line" placeholder="ana: https://…#share=4.1fff&#10;ben: https://…#wings=1.87.20260810.ben.a1b2c3"></textarea>
      <div class="drill-actions">
        <button class="drill-btn primary" data-act="add" type="button">add to roster</button>
      </div>
      ${matrix()}
      <div class="drill-actions"><button class="drill-btn" data-act="close" type="button">close</button></div>`;

    card.querySelector("[data-act=add]")?.addEventListener("click", () => {
      const ta = card.querySelector<HTMLTextAreaElement>(".cw-paste")!;
      const { entries, badLines } = parseCrewText(ta.value, sections);
      if (entries.length === 0) {
        toast(
          badLines.length > 0
            ? "no decodable link on those lines — expected #share= or #wings="
            : "paste at least one link first",
        );
        return;
      }
      members = mergeIntoRoster(members, entries);
      saveCrew(members);
      toast(
        `${entries.length} link${entries.length === 1 ? "" : "s"} decoded${
          badLines.length > 0 ? ` · ${badLines.length} line${badLines.length === 1 ? "" : "s"} skipped` : ""
        }`,
      );
      render();
    });

    card.querySelectorAll<HTMLButtonElement>("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", () => {
        members = members.filter((_, i) => i !== Number(btn.dataset.remove));
        saveCrew(members);
        render();
      });
    });

    card.querySelectorAll<HTMLButtonElement>("[data-jump]").forEach((btn) => {
      btn.addEventListener("click", () => {
        close();
        jumpTo(btn.dataset.jump!);
      });
    });

    card.querySelector("[data-act=copy]")?.addEventListener("click", () => {
      const md = buildCrewMarkdown(members, sections);
      navigator.clipboard.writeText(md).then(
        () => toast("coverage matrix copied as Markdown"),
        () => window.prompt("Copy the matrix:", md),
      );
    });

    card.querySelector("[data-act=clear]")?.addEventListener("click", () => {
      members = [];
      saveCrew(members);
      toast("roster cleared");
      render();
    });

    card.querySelector("[data-act=close]")?.addEventListener("click", close);
  }

  return { open };
}
