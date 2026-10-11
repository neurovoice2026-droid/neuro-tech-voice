/**
 * REEL 6 · ITS OWN SAFE ZONE (docs/ig/ig6/SCRIPT.md §11, STYLE.md §9.12): ig5's combined TikTok + Instagram rule
 * (src/ig/ig5/zones.ts) renamed — the same values — without ig5's price-numeral band (ig6 shows no numeral anywhere).
 * The reel registers it with the zone guard (components/ZoneGuard.tsx registerZones, from Reel6.tsx and Cover.tsx via
 * stage/Zones.tsx); check-zones --film=ig6 then fails on any rect that breaks it.
 *
 *   text      x 86–900, y 240–1400 (TikTok's header ≈ 108–240, its caption / username / sound block and Instagram's
 *             bottom band below 1400): every rect the reel reports (the lockups x 296–896, cap tops ≥ 1100)
 *   objects   x ≤ 880 wherever they reach below y 840 (TikTok's right rail): rects labelled `object …` (the dial, the
 *             hand, the domes, the comment field's disc); they may sit anywhere above
 *   wordmark  the end card's NEUROVOICE group (wordmark + the dome as its full stop, ≈ x 155–925): x 60–1020 (ig5's logo
 *             exception), y inside the text band: rects labelled `wordmark …`
 *   cover     words in x 86–900, y 260–1380 (inside both apps' 3:4 grid tile, y 240–1680)
 *
 * Node-safe: plain data and pure functions (no React), so a script can read the rule too. A top-level .ts of
 * src/ig/ig6/, so it is in ig6Hash (scripts/ig6/hash.mjs).
 */
export type Rect = { x: number; y: number; w: number; h: number };

export const IG6_ZONES = {
  frame: { w: 1080, h: 1920 },
  text: { x0: 86, x1: 900, y0: 240, y1: 1400 },
  object: { x1: 880, below: 840 },
  /** the end card's wordmark group: only the frame's 60 px side margins */
  logo: { x0: 60, x1: 1020 },
  cover: { x0: 86, x1: 900, y0: 260, y1: 1380 },
  /** the lockup box the object strokes must keep clear of (SCRIPT §3, STYLE §9.12 overlap check; drawn in the overlay) */
  lockup: { x0: 296, x1: 900, y0: 1080, y1: 1400 },
  /** the overlay's bands (TikTok + Instagram) */
  bands: {
    header: 240,
    bottom: 1400,
    rail: { x: 900, y0: 840 },
    side: 86,
    crop34: { y0: 240, y1: 1680 },
  },
} as const;

const Z = IG6_ZONES;
const n = (v: number) => v.toFixed(0);

/** Why a rect the reel reports breaks ig6's rule ([] when it obeys). The label says what it is (text by default). */
export function ig6Faults(r: Rect, what: string): string[] {
  const f: string[] = [];
  const x1 = r.x + r.w;
  const y1 = r.y + r.h;
  if (/^object\b/.test(what)) {
    if (y1 > Z.object.below && x1 > Z.object.x1) f.push(`object right ${n(x1)} > ${Z.object.x1} below y ${Z.object.below} (TikTok rail)`);
    return f;
  }
  if (/^wordmark\b/.test(what)) {
    if (r.x < Z.logo.x0 || x1 > Z.logo.x1) f.push(`wordmark x ${n(r.x)}–${n(x1)} outside ${Z.logo.x0}–${Z.logo.x1}`);
    if (r.y < Z.text.y0 || y1 > Z.text.y1) f.push(`wordmark y ${n(r.y)}–${n(y1)} outside ${Z.text.y0}–${Z.text.y1}`);
    return f;
  }
  if (r.x < Z.text.x0) f.push(`left ${n(r.x)} < ${Z.text.x0}`);
  if (x1 > Z.text.x1) f.push(`right ${n(x1)} > ${Z.text.x1}`);
  if (r.y < Z.text.y0) f.push(`top ${n(r.y)} < ${Z.text.y0}`);
  if (y1 > Z.text.y1) f.push(`bottom ${n(y1)} > ${Z.text.y1}`);
  return f;
}

/** Why a cover rect leaves ig6's cover box (words x 86–900, y 260–1380). */
export function ig6CoverFaults(r: Rect, what: string): string[] {
  const c = Z.cover;
  const f: string[] = [];
  if (/^object\b/.test(what)) return f;
  if (r.x < c.x0 || r.x + r.w > c.x1) f.push(`x ${n(r.x)}–${n(r.x + r.w)} outside ${c.x0}–${c.x1}`);
  if (r.y < c.y0 || r.y + r.h > c.y1) f.push(`y ${n(r.y)}–${n(r.y + r.h)} outside ${c.y0}–${c.y1}`);
  return f;
}
