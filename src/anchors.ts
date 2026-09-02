// ---------------------------------------------------------------------------
// Heading anchors and reading time — the one place that turns a section id
// plus an h3's text into the element id that main.ts (which stamps it on the
// live heading) and palette.ts (which indexes the same body string in a
// detached template) both agree on. Computed in two places it would drift,
// and a search hit would land on the wrong heading the day it did. Reading
// time lives here too because it reads the same body strings the same way.
// ---------------------------------------------------------------------------

export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
}

/**
 * Deterministic id for a heading inside a section — `<sectionId>--<slug>`,
 * with a numeric suffix when the same heading text repeats within one
 * section. `seen` is per section; pass a fresh map for each.
 */
export function headingId(
  sectionId: string,
  text: string,
  seen: Map<string, number>,
): string {
  const base = `${sectionId}--${slugify(text) || "heading"}`;
  const n = (seen.get(base) ?? 0) + 1;
  seen.set(base, n);
  return n === 1 ? base : `${base}-${n}`;
}

// Technical prose with tables and code reads slower than fiction; 200 wpm is
// the conventional figure for it and errs toward honest rather than flattering.
const WORDS_PER_MINUTE = 200;

/** Word count of a body's visible text (tags stripped, SVG slots empty). */
export function wordCount(html: string): number {
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  return (tpl.content.textContent ?? "").split(/\s+/).filter(Boolean).length;
}

export function readingMinutes(html: string): number {
  return Math.max(1, Math.round(wordCount(html) / WORDS_PER_MINUTE));
}
