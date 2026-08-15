// ---------------------------------------------------------------------------
// Team share-links — the ledger encoded into the URL hash, so progress can
// move between people and devices with no backend. Format:
//
//   #share=4.<hex>
//
// where <hex> is the sections' done-bits (in sections-array order) packed
// four to a hex digit, and "4" is the payload version. A lead can mark the
// sections that matter and send one link; a teammate opening it gets an
// import banner (merge / replace / ignore). Unknown trailing bits are
// ignored, so links survive sections being added at the end.
//
// A section inserted in the *middle* is what the version number is for: the
// bit at index i means a different section than it used to. Every superseded
// order is frozen below and still decoded — v1 (ten sections, before the
// prompt-formats section landed between L3 and TB), v2 (eleven, before the
// adversarial section landed between L7 and the sources) and v3 (twelve,
// before the hardening section landed between L8 and the sources). A link a
// teammate sent last week should not silently mark the wrong sections done.
// ---------------------------------------------------------------------------

import type { Section } from "./content";

type Ledger = Record<string, boolean>;

const VERSION = 4;

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

/** The v2 order, frozen — before the adversarial section landed between L7
 *  and the sources. Same contract as V1_ORDER: an old link keeps meaning what
 *  it meant when it was sent. */
const V2_ORDER = [
  "mental-model",
  "patterns",
  "context",
  "tool-design",
  "prompt-formats",
  "toolbox",
  "claude-code",
  "multi-agent",
  "agent-sdk",
  "production",
  "sources",
];

/** The v3 order, frozen — before the hardening section landed between L8 and
 *  the sources. Same contract as the orders above. */
const V3_ORDER = [
  "mental-model",
  "patterns",
  "context",
  "tool-design",
  "prompt-formats",
  "toolbox",
  "claude-code",
  "multi-agent",
  "agent-sdk",
  "production",
  "adversarial",
  "sources",
];

const FROZEN: Record<string, string[]> = {
  "1": V1_ORDER,
  "2": V2_ORDER,
  "3": V3_ORDER,
};

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

/**
 * Decode a share hash from any string (a full URL, a bare `#share=…`). The
 * crew console (crew.ts) feeds pasted teammate links through this so the bit
 * order is decoded in exactly one place.
 */
export function decodeShareHash(hash: string, sections: Section[]): SharePayload | null {
  const m = hash.match(/#share=([1234])\.([0-9a-f]+)/i);
  if (!m) return null;
  const bits = [...m[2]]
    .map((c) => parseInt(c, 16).toString(2).padStart(4, "0"))
    .join("");
  const order = FROZEN[m[1]] ?? sections.map((s) => s.id);
  const known = new Set(sections.map((s) => s.id));
  const done = order.filter((id, i) => bits[i] === "1" && known.has(id));
  return { done };
}

export function readShareHash(sections: Section[]): SharePayload | null {
  if (!/^#share=/.test(location.hash)) return null;
  return decodeShareHash(location.hash, sections);
}

export function clearShareHash(): void {
  history.replaceState(null, "", location.pathname + location.search);
}
