// ---------------------------------------------------------------------------
// Activity log — a small per-device journal of study events (sections marked
// read, drill answers hit/missed) that the flight record (stats.ts) reads for
// streaks and the heatmap. Its own module so drill.ts and stats.ts can both
// use it without importing each other. Its own localStorage key, deliberately
// independent from the ledger and SRS stores.
// ---------------------------------------------------------------------------

const LOG_KEY = "agentic-guide-log-v1";
const CAP = 4000; // oldest events fall off; the heatmap only looks back 12 weeks

export type ActivityKind = "read" | "hit" | "miss";

export interface ActivityEvent {
  t: number; // epoch ms
  k: ActivityKind;
}

export function readActivity(): ActivityEvent[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    const parsed = raw ? (JSON.parse(raw) as ActivityEvent[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function logActivity(k: ActivityKind): void {
  try {
    const events = readActivity();
    events.push({ t: Date.now(), k });
    localStorage.setItem(LOG_KEY, JSON.stringify(events.slice(-CAP)));
  } catch {
    /* private mode etc. — the flight record just won't accumulate */
  }
}
