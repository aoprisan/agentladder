// ---------------------------------------------------------------------------
// Team share-links — the ledger encoded into the URL hash, so progress can
// move between people and devices with no backend. Format:
//
//   #share=2.<hex>
//
// where <hex> is the sections' done-bits (in sections-array order) packed
// four to a hex digit, and "2" is the payload version. A lead can mark the
// sections that matter and send one link; a teammate opening it gets an
// import banner (merge / replace / ignore). Unknown trailing bits are
// ignored, so links survive sections being added at the end.
//
// A section inserted in the *middle* is what the version number is for: the
// bit at index i means a different section than it used to. V1 links (the
// ten-section order, before the prompt-formats section landed between L3 and
// TB) are still read, against the frozen id list below — a link a teammate
// sent last week should not silently mark the wrong sections done.
// ---------------------------------------------------------------------------

import type { Section } from "./content";

type Ledger = Record<string, boolean>;

const VERSION = 2;

/** The v1 sections order, frozen. Only used to decode old links. */
const V1_ORDER = [
  "mental-model",
  "patterns",
  "context",
  "tool-design",
  "toolbox",
  "claude-code",
  "multi-agent",
  "agent-sdk",
  "production",
  "sources",
];

export function buildShareUrl(sections: Section[], ledger: Ledger): string {
  const bits = sections.map((s) => (ledger[s.id] ? "1" : "0")).join("");
  let hex = "";
  for (let i = 0; i < bits.length; i += 4) {
    hex += parseInt(bits.slice(i, i + 4).padEnd(4, "0"), 2).toString(16);
  }
  const base = location.href.split("#")[0];
  return `${base}#share=${VERSION}.${hex}`;
}

export interface SharePayload {
  /** section ids marked done in the shared link */
  done: string[];
}

export function readShareHash(sections: Section[]): SharePayload | null {
  const m = location.hash.match(/^#share=([12])\.([0-9a-f]+)$/i);
  if (!m) return null;
  const bits = [...m[2]]
    .map((c) => parseInt(c, 16).toString(2).padStart(4, "0"))
    .join("");
  const order = m[1] === "1" ? V1_ORDER : sections.map((s) => s.id);
  const known = new Set(sections.map((s) => s.id));
  const done = order.filter((id, i) => bits[i] === "1" && known.has(id));
  return { done };
}

export function clearShareHash(): void {
  history.replaceState(null, "", location.pathname + location.search);
}
