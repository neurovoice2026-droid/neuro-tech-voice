/**
 * REEL 6 · ITS FACES, OFFLINE (docs/ig/ig6/STYLE.md §9.2, PIPELINE.md §6.1 "Font loading plan"):
 *
 *   Instrument Sans Variable 450 / 580 / 600   lead words, the tier, AGENT, the URL — already declared by src/lib/fonts.ts
 *                                              (@fontsource-variable/instrument-sans, bundled); Reel6 calls waitForFonts()
 *   Cormorant Garamond Italic 600              THE ACCENT PHRASE ONLY — declared here, ig6-locally, from the declared
 *                                              dependency @fontsource/cormorant-garamond (its latin woff2 ships in
 *                                              node_modules and is bundled: no network at bundle or render time)
 *   Inter Tight Variable 500                   the NEUROVOICE wordmark — film 1's src/scenes/cta/font/wordmark.css (import
 *                                              only, as components/End.tsx does)
 *
 * src/lib/fonts.ts is NEVER edited (shared by every film; it dropped Cormorant in v7). useIg6Faces() holds the frame
 * (useFaceReady → delayRender) until every instance a lockup measures is in, so a canvas measurement never sees a
 * fallback face. measureSerif() is the accent's canvas measure (kb/kit measureText handles the sans only).
 */
import '@fontsource/cormorant-garamond/latin-600-italic.css';
import '../../../scenes/cta/font/wordmark.css';
import { useFaceReady } from '../../../lib/fonts';
import { WORDMARK_FONT, WORDMARK_TEXT } from '../../../scenes/cta/EndCard';
import { TIER } from './style';

/** canvas wants the face's own name first */
const CANVAS_SERIF = '"Cormorant Garamond"';
const CANVAS_SANS = '"Instrument Sans Variable"';
/** every accent glyph the reel sets (the ’ included) — the latin subset covers them (STYLE §9.2, checked) */
export const SERIF_SAMPLE = 'six seconds. can’t answer. rings, still waiting. customer. receptionist day or night. from your words. yourself. AGENT';

/** the reel's faces are in (call it in every component that measures text; it holds the frame until they are) */
export function useIg6Faces(): boolean {
  const a = useFaceReady(`italic ${TIER.accent.weight} 110px ${CANVAS_SERIF}`, SERIF_SAMPLE);
  const b = useFaceReady(`${TIER.lead.weight} 60px ${CANVAS_SANS}`);
  const c = useFaceReady(`${TIER.tier.weight} 32px ${CANVAS_SANS}`);
  const d = useFaceReady(`600 50px ${CANVAS_SANS}`);
  return a && b && c && d;
}
/** the wordmark's face is in (End6, the cover) */
export const useWordmarkFace = () => useFaceReady(`500 100px ${WORDMARK_FONT}`, WORDMARK_TEXT);

let canvas: HTMLCanvasElement | null = null;
const cache = new Map<string, number>();
const ctx2d = () => {
  if (!canvas) canvas = document.createElement('canvas');
  return canvas.getContext('2d')!;
};
/** advance width in px of a canvas setting (tracking in em after every glyph, as the DOM lays a run out; kerning on).
 *  A measurement taken before the face is in is used for that render only (never cached). */
const measure = (text: string, font: string, size: number, tracking: number, fallbackK: number) => {
  const key = `${font}|${size}|${tracking}|${text}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  if (typeof document === 'undefined') return text.length * size * fallbackK;
  const ctx = ctx2d();
  ctx.font = font;
  (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${tracking * size}px`;
  ctx.fontKerning = 'normal';
  const w = ctx.measureText(text).width;
  if (document.fonts.check(ctx.font, text)) cache.set(key, w);
  return w;
};
/** the accent: Cormorant Garamond Italic 600 at `size`, tracking −0.01em (STYLE §9.2) */
export const measureSerif = (text: string, size: number, tracking: number = TIER.accent.tracking) =>
  measure(text, `italic ${TIER.accent.weight} ${size}px ${CANVAS_SERIF}`, size, tracking, 0.4);
/** the sans tiers (lead 580 −0.03em, tier 450 0): Instrument Sans Variable at any weight */
export const measureSans = (text: string, size: number, weight: number, tracking = 0) => measure(text, `${weight} ${size}px ${CANVAS_SANS}`, size, tracking, 0.52);
