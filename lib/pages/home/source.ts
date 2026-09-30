/* ------------------------------------------------------------------ *
 * How the landing's copy modules read their sources: by id, and by
 * whole sentences, throwing at import time rather than rendering a page
 * that has drifted from the one it quotes.
 * ------------------------------------------------------------------ */

/** Throws at import time when an id this page depends on goes missing. */
export function must<T extends { id: string }>(list: readonly T[], id: string): T {
  const hit = list.find((x) => x.id === id);
  if (!hit) throw new Error(`lib/pages/home: no "${id}" in the list it reads from`);
  return hit;
}

/**
 * Sentences `from` up to `to` (exclusive) of a paragraph, verbatim. A
 * sentence ends at `.`, `!` or `?` followed by whitespace, so "3 a.m.,"
 * and "eu-west-1" never split.
 */
export function sentences(text: string, from: number, to = from + 1): string {
  const all = text.match(/\S.*?[.!?](?=\s|$)|\S.*$/g) ?? [];
  if (from < 0 || to > all.length || from >= to) {
    throw new Error(`lib/pages/home: asked for sentences ${from}–${to} of a ${all.length}-sentence note`);
  }
  return all.slice(from, to).join(" ");
}

/**
 * A section heading's words and the one phrase in it that takes colour
 * (HomeHeading `titleKey`): the payoff, never the first word, copied
 * character for character from the title. home.test.ts holds each key to
 * its title. `keyTone: "quiet"` sets the phrase in muted instead.
 */
export type HomeTitle = { title: string; key: string; keyTone?: "quiet" };
