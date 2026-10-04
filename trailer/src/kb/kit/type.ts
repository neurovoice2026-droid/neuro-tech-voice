/**
 * The kit's type: the HOUSE system (src/theme.ts TYPE — Instrument Sans, one family) applied to UI.
 *
 *   · names / doc lines / field text     the house `title` role (64 / 56)
 *   · tags, eyebrows, kind tokens         the house `label` role (30 / 28, uppercase tracked)
 *   · UI chrome in sentence case          `ui(size, weight)` — tab labels, buttons, pills, menu items:
 *                                         Instrument Sans at the app's medium weight, a whisper of
 *                                         negative tracking, sized by the component (≥ the label
 *                                         role's 30 / 28 legibility floor)
 *   · technical tokens                    the house `meta` role (Geist Mono): a URL, a file name
 *
 * measureText() is a canvas measurement with the same face, weight and tracking (kerning on), so
 * layouts computed here (tab slots, caret positions, word re-sets) match the DOM to a fraction of a
 * px. Components that use it call useKitFaces() once: it holds the frame until the faces are in.
 */
import type { CSSProperties } from 'react';
import { useFaceReady } from '../../lib/fonts';
import { FONT, TYPE } from '../../theme';

export const SANS = FONT.ui;
export const MONO = FONT.mono;
/** canvas wants the face's own name first */
const CANVAS_SANS = '"Instrument Sans Variable"';
const CANVAS_MONO = '"Geist Mono Variable"';

/** the app's weights (Tailwind font-medium 500, font-semibold 600) as Instrument Sans settings */
export const W = { regular: 440, medium: 520, active: 560, semibold: 600, title: TYPE.title.weight } as const;

/** UI chrome tracking: Instrument Sans at 30–40 px wants a hair of negative tracking (the house title is −.02) */
export const UI_TRACK = -0.008;

export type TextSpec = { size: number; weight?: number; tracking?: number; mono?: boolean };

/** CSS for a UI text setting. */
export function ui(size: number, weight: number = W.medium, o: { tracking?: number; mono?: boolean; tabular?: boolean } = {}): CSSProperties {
  return {
    fontFamily: o.mono ? MONO : SANS,
    fontSize: size,
    fontWeight: weight,
    letterSpacing: `${o.tracking ?? (o.mono ? 0 : UI_TRACK)}em`,
    lineHeight: 1.2,
    fontKerning: 'normal',
    fontVariantNumeric: o.tabular ? 'tabular-nums' : undefined,
    whiteSpace: 'nowrap',
  };
}

let canvas: HTMLCanvasElement | null = null;
const cache = new Map<string, number>();

/** Advance width of `text` in px (tracking included after every glyph but the last — as the DOM lays a run out). */
export function measureText(text: string, s: TextSpec): number {
  const weight = s.weight ?? W.medium;
  const tracking = s.tracking ?? (s.mono ? 0 : UI_TRACK);
  const key = `${s.mono ? 'm' : 's'}|${weight}|${s.size}|${tracking}|${text}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  if (typeof document === 'undefined') return text.length * s.size * 0.52;
  if (!canvas) canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.font = `${weight} ${s.size}px ${s.mono ? CANVAS_MONO : CANVAS_SANS}`;
  (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${tracking * s.size}px`;
  ctx.fontKerning = 'normal';
  // the DOM puts the tracking after every glyph, the last one too: keep it (it is in the box width)
  const w = ctx.measureText(text).width;
  // only a measurement in the real face is kept: one taken before the face has loaded (the fallback's
  // metrics) is used for this render only — useKitFaces() re-renders once the face is in
  if (document.fonts.check(ctx.font, text)) cache.set(key, w);
  return w;
}

/** The advance of one word space in a setting (a space between two letters, so its tracking is the DOM's). */
export function spaceWidth(s: TextSpec): number {
  return measureText('n n', s) - measureText('nn', s);
}

/** The faces the kit measures with are loaded (holds the frame until they are). */
export function useKitFaces(): boolean {
  const a = useFaceReady(`${W.medium} 40px ${CANVAS_SANS}`);
  const b = useFaceReady(`${W.active} 40px ${CANVAS_SANS}`);
  const c = useFaceReady(`${TYPE.title.weight} 64px ${CANVAS_SANS}`);
  const d = useFaceReady(`460 30px ${CANVAS_MONO}`);
  return a && b && c && d;
}

/** Word boxes of a line of text set left from x0 (gap = one space of the setting), for carets and re-sets. */
export function layoutWords(text: string, s: TextSpec, x0 = 0): { words: { text: string; x: number; w: number }[]; width: number; space: number } {
  const space = spaceWidth(s);
  let x = x0;
  const words = text
    .split(' ')
    .filter(Boolean)
    .map((w) => {
      const width = measureText(w, s);
      const box = { text: w, x, w: width };
      x += width + space;
      return box;
    });
  return { words, width: Math.max(0, x - space - x0), space };
}

/**
 * ONE APOSTROPHE FOR THE WHOLE FILM: the typographic ’ (U+2019) for every straight ' in copy that is rendered
 * (captions, word arrays, the call's answer). One character for one, so word counts, word indices and the timings
 * built on them never change.
 */
export const typo = (s: string): string => s.replace(/'/g, '’');

/** Greedy wrap into lines no wider than maxW (word indices per line). */
export function wrapWords(text: string, s: TextSpec, maxW: number): string[][] {
  const words = text.split(' ').filter(Boolean);
  const space = spaceWidth(s);
  const lines: string[][] = [];
  let cur: string[] = [];
  let w = 0;
  for (const word of words) {
    const ww = measureText(word, s);
    if (cur.length && w + space + ww > maxW + 0.01) {
      lines.push(cur);
      cur = [];
      w = 0;
    }
    w += (cur.length ? space : 0) + ww;
    cur.push(word);
  }
  if (cur.length) lines.push(cur);
  return lines;
}
