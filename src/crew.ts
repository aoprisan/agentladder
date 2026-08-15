// ---------------------------------------------------------------------------
// The crew console — team coverage from share-links. Pure logic, no DOM
// (crewui.ts owns the overlay).
//
// Share-links (#share=…) and wings links (#wings=…) already let progress
// travel person-to-person; this is the aggregate view. A lead pastes the
// links teammates sent — one per line, optionally prefixed with a name —
// and gets the coverage matrix: who has read what, where the team's blind
// spots are, who is certified. No backend, no account: the links are decoded
// with the same decoders share.ts and checkride.ts use (so old payload
// versions keep meaning what they meant), and nothing is ever fetched —
// pasting a URL never causes a request to it.
//
// What persists (agentic-guide-crew-v1) is the named roster of *decoded*
// payloads — names, done-bits as section ids, wings scores. Never the pasted
// text, never the raw URLs. The matrix's column order derives from the
// sections array, so the same rule as share.ts applies: inserting or
// reordering sections requires a payload-version bump there, and decoded
// rosters here store section ids (not positions) precisely so they survive.
// ---------------------------------------------------------------------------

import type { Section } from "./content";
import { decodeShareHash } from "./share";
import { decodeWingsHash } from "./checkride";

const CREW_KEY = "agentic-guide-crew-v1";

export interface CrewWings {
  pct: number;
  date: string; // yyyy-mm-dd
  valid: boolean;
}

export interface CrewMember {
  name: string;
  /** section ids marked done in the member's latest share-link */
  done: string[];
  wings?: CrewWings;
}

export function readCrew(): CrewMember[] {
  try {
    const raw = localStorage.getItem(CREW_KEY);
    const parsed = raw ? (JSON.parse(raw) as CrewMember[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCrew(members: CrewMember[]): void {
  try {
    localStorage.setItem(CREW_KEY, JSON.stringify(members));
  } catch {
    /* private mode etc. — the roster just won't persist */
  }
}

// ---------------------------------------------------------------------------
// Parsing pasted lines
// ---------------------------------------------------------------------------

/** One decoded pasted line — carries a share payload or a wings payload. */
export interface ParsedLine {
  name: string; // may be "" when the line carried no name prefix
  done?: string[];
  wings?: CrewWings;
}

export interface ParseResult {
  entries: ParsedLine[];
  /** lines that contained neither a decodable share nor wings payload */
  badLines: string[];
}

/**
 * Parse pasted text: one link per line, whole URLs or bare hashes, optionally
 * prefixed with a name ("ana: https://…#share=2.…"). The name is everything
 * before the token that carries the hash, with a trailing ":" stripped.
 */
export function parseCrewText(text: string, sections: Section[]): ParseResult {
  const entries: ParsedLine[] = [];
  const badLines: string[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const tokens = line.split(/\s+/);
    const hashIdx = tokens.findIndex((t) => /#(share|wings)=/.test(t));
    if (hashIdx === -1) {
      badLines.push(line);
      continue;
    }
    const name = tokens
      .slice(0, hashIdx)
      .join(" ")
      .replace(/[:\-–—]\s*$/, "")
      .trim();
    const hash = tokens[hashIdx];

    const share = decodeShareHash(hash, sections);
    if (share) {
      entries.push({ name, done: share.done });
      continue;
    }
    const wings = decodeWingsHash(hash);
    if (wings) {
      entries.push({
        // A wings link already carries a name; a pasted prefix wins over it
        // so the lead's roster naming stays consistent.
        name: name || wings.name,
        wings: { pct: wings.pct, date: wings.date, valid: wings.valid },
      });
      continue;
    }
    badLines.push(line);
  }

  return { entries, badLines };
}

/**
 * Merge parsed entries into a roster. Latest link wins per field: a new
 * share-link replaces a member's done-bits, a new wings link replaces their
 * certificate — but one never wipes the other. Unnamed entries get a stable
 * placeholder name so they stay addressable in the matrix.
 */
export function mergeIntoRoster(roster: CrewMember[], entries: ParsedLine[]): CrewMember[] {
  const out = roster.map((m) => ({ ...m, done: [...m.done] }));
  let anon = out.filter((m) => /^teammate \d+$/.test(m.name)).length;

  for (const e of entries) {
    const name = e.name || `teammate ${++anon}`;
    const existing = out.find((m) => m.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      if (e.done) existing.done = [...e.done];
      if (e.wings) existing.wings = e.wings;
    } else {
      out.push({ name, done: e.done ? [...e.done] : [], wings: e.wings });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

export interface SectionCoverage {
  id: string;
  ordinal: string;
  title: string;
  /** members who have this section done */
  count: number;
}

export interface CrewSummary {
  /** per-section read counts, sections-array order */
  coverage: SectionCoverage[];
  /** sections read by the fewest people, worst first (only when a gap exists) */
  gaps: SectionCoverage[];
  /** share of the (members × sections) grid marked done, 0–100 */
  coveragePct: number;
  certified: number;
}

export function summarizeCrew(members: CrewMember[], sections: Section[]): CrewSummary {
  const coverage: SectionCoverage[] = sections.map((s) => ({
    id: s.id,
    ordinal: s.ordinal,
    title: s.title,
    count: members.filter((m) => m.done.includes(s.id)).length,
  }));

  const totalCells = members.length * sections.length;
  const doneCells = coverage.reduce((acc, c) => acc + c.count, 0);
  const coveragePct = totalCells > 0 ? Math.round((doneCells / totalCells) * 100) : 0;

  const gaps =
    members.length === 0
      ? []
      : coverage
          .filter((c) => c.count < members.length)
          .sort((a, b) => a.count - b.count)
          .slice(0, 5);

  return {
    coverage,
    gaps,
    coveragePct,
    certified: members.filter((m) => m.wings && m.wings.pct >= 80).length,
  };
}

// ---------------------------------------------------------------------------
// Markdown export — the matrix for a standup or a wiki.
// ---------------------------------------------------------------------------

export function buildCrewMarkdown(members: CrewMember[], sections: Section[]): string {
  const s = summarizeCrew(members, sections);
  const lines: string[] = [
    "# Crew coverage — agentic workflows guide",
    "",
    `${members.length} crew · ${s.coveragePct}% of the grid read · ${s.certified} certified (wings ≥ 80%)`,
    "",
    `| crew | ${sections.map((x) => x.ordinal).join(" | ")} | wings |`,
    `|------|${sections.map(() => ":---:").join("|")}|-------|`,
  ];
  for (const m of members) {
    const cells = sections.map((x) => (m.done.includes(x.id) ? "✓" : "·")).join(" | ");
    const wings = m.wings
      ? `${m.wings.pct}%${m.wings.valid ? "" : " (unverified)"} · ${m.wings.date}`
      : "—";
    lines.push(`| ${m.name} | ${cells} | ${wings} |`);
  }
  lines.push(
    "",
    `| everyone | ${s.coverage.map((c) => `${c.count}/${members.length}`).join(" | ")} | ${s.certified} |`,
  );
  if (s.gaps.length > 0) {
    lines.push("", "## Blind spots", "");
    for (const g of s.gaps) {
      lines.push(`- **${g.ordinal} · ${g.title}** — read by ${g.count}/${members.length}`);
    }
  }
  lines.push(
    "",
    "_Generated locally by the agentic-workflows field guide's crew console. Decoded from share-links on one device; nothing was uploaded._",
  );
  return lines.join("\n");
}
