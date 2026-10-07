/**
 * REEL 5 · ITS OWN SAFE ZONE (docs/ig/ig5/SCRIPT.md §1.2–1.3): TikTok first, then Instagram, one render, so one combined
 * rule, tighter than the series' Instagram ZONES (src/ig/common/zones.ts, which ig1–ig4 keep). The reel registers it
 * with the zone guard (components/ZoneGuard.tsx registerZones, from Reel5.tsx and Cover.tsx); check-zones --film=ig5
 * then fails on any rect that breaks it.
 *
 *   text            x 86–900, y 240–1400 (TikTok's header ≈ 108–240, its caption / username / sound block ≈ the bottom
 *                   320–480 px, Instagram's bottom band from 1520): every rect the reel reports
 *   price numerals  y 300–1260 (clears even the TikTok ad guide's bottom block): rects labelled `price …`
 *   objects         x ≤ 880 wherever they reach below y 840 (TikTok's right rail starts higher than Instagram's): rects
 *                   labelled `object …` (slips, the record, the orb, the desk hairline); they may sit anywhere above
 *   the exception   the shared end card's wordmark (components/End.tsx, built once for ig1–ig4: ≤ 760 px centred, so
 *                   ≈ x 160–920 at y 760–900): it is the series' logo, and moving it would re-render ig1–ig4's picture;
 *                   it is checked against the frame's side margins only (BUILD.md, known gaps)
 *   cover           words in x 86–900, y 260–1380 (inside both apps' 3:4 grid tile); "$49" above y 1300 (TikTok's grid
 *                   view count): rects labelled `price $49 …` on the cover
 *
 * Node-safe: plain data and pure functions (no React), so a script can read the rule too.
 */
export type Rect = { x: number; y: number; w: number; h: number };

export const IG5_ZONES = {
  frame: { w: 1080, h: 1920 },
  text: { x0: 86, x1: 900, y0: 240, y1: 1400 },
  price: { y0: 300, y1: 1260 },
  object: { x1: 880, below: 840 },
  /** the shared end card's wordmark: only the frame's 60 px side margins */
  logo: { x0: 60, x1: 1020 },
  cover: { x0: 86, x1: 900, y0: 260, y1: 1380, price49: 1300 },
  /** the overlay's bands (TikTok + Instagram, SCRIPT §1.1) */
  bands: {
    header: 240,
    bottom: 1400,
    rail: { x: 900, y0: 840 },
    side: 86,
    crop34: { y0: 240, y1: 1680 },
  },
} as const;

const Z = IG5_ZONES;
const n = (v: number) => v.toFixed(0);

/** Why a rect the reel reports breaks ig5's rule ([] when it obeys). The label says what it is (text by default). */
export function ig5Faults(r: Rect, what: string): string[] {
  const f: string[] = [];
  const x1 = r.x + r.w;
  const y1 = r.y + r.h;
  if (/^object\b/.test(what)) {
    if (y1 > Z.object.below && x1 > Z.object.x1) f.push(`object right ${n(x1)} > ${Z.object.x1} below y ${Z.object.below} (TikTok rail)`);
    if (r.x < 0 || x1 > Z.frame.w) f.push(`object off the frame (x ${n(r.x)}–${n(x1)})`);
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
  if (/^price\b/.test(what)) {
    if (r.y < Z.price.y0) f.push(`price top ${n(r.y)} < ${Z.price.y0}`);
    if (y1 > Z.price.y1) f.push(`price bottom ${n(y1)} > ${Z.price.y1}`);
  }
  return f;
}

/** Why a cover rect leaves ig5's cover box (words x 86–900, y 260–1380; "$49" above y 1300). */
export function ig5CoverFaults(r: Rect, what: string): string[] {
  const c = Z.cover;
  const f: string[] = [];
  if (/^object\b/.test(what)) return f;
  if (r.x < c.x0 || r.x + r.w > c.x1) f.push(`x ${n(r.x)}–${n(r.x + r.w)} outside ${c.x0}–${c.x1}`);
  if (r.y < c.y0 || r.y + r.h > c.y1) f.push(`y ${n(r.y)}–${n(r.y + r.h)} outside ${c.y0}–${c.y1}`);
  if (/^price \$49\b/.test(what) && r.y + r.h > c.price49) f.push(`"$49" bottom ${n(r.y + r.h)} > ${c.price49} (TikTok's grid view count)`);
  return f;
}
