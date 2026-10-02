/**
 * A press asked to hear a stage whose words, on a narrow screen, can sit
 * far from the control that was pressed (cards stacked one under another,
 * a caption under a long list): brings `el`, the words being said, on
 * screen when they are not, so a reader who follows the captions sees them
 * as they are heard. Only while `query` matches (the stacked layout), and
 * at once under reduced motion. Never for a stage that started by itself:
 * only a press (or a Listen) may move the page. True when it scrolled:
 * whatever now sits under a resting mouse pointer was not pointed at.
 */
export function showSaid(el: Element | null | undefined, reduce: boolean, query: string) {
  if (!el || typeof window === "undefined" || !window.matchMedia(query).matches) return false;
  const r = el.getBoundingClientRect();
  const h = window.innerHeight;
  // The top band is under the site's header.
  if (r.top >= Math.min(96, h * 0.12) && r.bottom <= h) return false;
  el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  return true;
}

/** How long after showSaid scrolled the page a pointer "entering" something is the page moving under it, not the hand. */
export const SCROLLED_MS = 1200;
