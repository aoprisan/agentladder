// ---------------------------------------------------------------------------
// Team share-links — the ledger encoded into the URL hash, so progress can
// move between people and devices with no backend. Format:
//
//   #share=1.<hex>
//
// where <hex> is the sections' done-bits (in sections-array order) packed
// four to a hex digit, and "1" is the payload version. A lead can mark the
// sections that matter and send one link; a teammate opening it gets an
// import banner (merge / replace / ignore). Unknown trailing bits are
// ignored, so links survive sections being added later.
// ---------------------------------------------------------------------------

import type { Section } from "./content";

type Ledger = Record<string, boolean>;

export function buildShareUrl(sections: Section[], ledger: Ledger): string {
  const bits = sections.map((s) => (ledger[s.id] ? "1" : "0")).join("");
  let hex = "";
  for (let i = 0; i < bits.length; i += 4) {
    hex += parseInt(bits.slice(i, i + 4).padEnd(4, "0"), 2).toString(16);
  }
  const base = location.href.split("#")[0];
  return `${base}#share=1.${hex}`;
}

export interface SharePayload {
  /** section ids marked done in the shared link */
  done: string[];
}

export function readShareHash(sections: Section[]): SharePayload | null {
  const m = location.hash.match(/^#share=1\.([0-9a-f]+)$/i);
  if (!m) return null;
  const bits = [...m[1]]
    .map((c) => parseInt(c, 16).toString(2).padStart(4, "0"))
    .join("");
  const done = sections.filter((_s, i) => bits[i] === "1").map((s) => s.id);
  return { done };
}

export function clearShareHash(): void {
  history.replaceState(null, "", location.pathname + location.search);
}
