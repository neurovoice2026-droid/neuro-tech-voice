/**
 * Instagram's safe zones on the 1080×1920 frame (docs/ig/PIPELINE.md §7, SCRIPT.md §0.3 "Layout bands"), enforced:
 * every text-bearing part reports its measured rect (components/ZoneGuard), and scripts/ig/check-zones.mjs fails a
 * reel on any violation the Zones compositions log.
 *
 * Node-safe (plain data and a pure function).
 */
export const ZONES = {
  frame: { w: 1080, h: 1920 },
  /** text y ≥ 240 (Instagram's header ≈ 0–220) */
  top: 240,
  /** text y ≤ 1520 (caption / username / audio ≈ 1520–1920) */
  bottom: 1520,
  /** nothing with x > 906 while y overlaps 900–1650 (like / comment / share) */
  rail: { x: 906, y0: 900, y1: 1650 },
  /** x ≥ 60 (and x + w ≤ 1080 − 60) */
  side: 60,
  /** the profile grid's 3:4 crop; a cover's words go in x 86–930, y 260–1500 */
  crop34: { y0: 240, y1: 1680 },
  cover: { x0: 86, x1: 930, y0: 260, y1: 1500 },
} as const;

export type Rect = { x: number; y: number; w: number; h: number };

/** Why a text rect breaks the zones ([] when it obeys every rule). */
export const zoneFaults = (r: Rect): string[] => {
  const f: string[] = [];
  if (r.y < ZONES.top) f.push(`top ${r.y.toFixed(0)} < ${ZONES.top}`);
  if (r.y + r.h > ZONES.bottom) f.push(`bottom ${(r.y + r.h).toFixed(0)} > ${ZONES.bottom}`);
  if (r.x < ZONES.side) f.push(`left ${r.x.toFixed(0)} < ${ZONES.side}`);
  if (r.x + r.w > ZONES.frame.w - ZONES.side) f.push(`right ${(r.x + r.w).toFixed(0)} > ${ZONES.frame.w - ZONES.side}`);
  if (r.x + r.w > ZONES.rail.x && r.y < ZONES.rail.y1 && r.y + r.h > ZONES.rail.y0) f.push(`right rail (x ${(r.x + r.w).toFixed(0)} > ${ZONES.rail.x} at y ${r.y.toFixed(0)}–${(r.y + r.h).toFixed(0)})`);
  return f;
};

/** True when a text rect obeys every rule. */
export const inZone = (r: Rect) => zoneFaults(r).length === 0;

/** Why a cover's text rect leaves the cover box (x 86–930, y 260–1500, inside the 3:4 crop). */
export const coverFaults = (r: Rect): string[] => {
  const c = ZONES.cover;
  const f: string[] = [];
  if (r.x < c.x0 || r.x + r.w > c.x1) f.push(`x ${r.x.toFixed(0)}–${(r.x + r.w).toFixed(0)} outside ${c.x0}–${c.x1}`);
  if (r.y < c.y0 || r.y + r.h > c.y1) f.push(`y ${r.y.toFixed(0)}–${(r.y + r.h).toFixed(0)} outside ${c.y0}–${c.y1}`);
  return f;
};
