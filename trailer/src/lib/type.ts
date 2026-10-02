/**
 * The TYPE roles (theme.ts) as CSS — one place that turns a role + an
 * orientation + a ground into a font setting, so every frame is set like the
 * knowledge heading.
 *
 *   const L = useLayout();
 *   <div style={typeStyle('headline', L.vertical, { tone: 'paper' })}>…</div>
 *   const size = typeSize('caption', L.vertical);
 *   <Captions font={captionFont(L.vertical, 'night')} … />
 *
 * Japanese: typeStyle(role, v, { jp: true }) applies TYPE_JP on top of the role.
 */
import type { CSSProperties } from 'react';
import { TYPE, TYPE_JP, type Tone, type TypeRole } from '../theme';
import { useLayout } from './layout';

/** A caption setting (components/Captions.tsx reads this). */
export type CaptionFont = {
  family: string;
  weight: number;
  size: number;
  /** @deprecated never italic: the speaker is shown by a label and colour */
  italic?: boolean;
  lineHeight: number;
  /** letter-spacing: a CSS length, or a number in em */
  tracking: string | number;
};

export type TypeOptions = {
  /** the ground: light type on `night` takes the role's weightOnDark (default 'paper') */
  tone?: Tone;
  /** override the size (px) */
  size?: number;
  /** override the weight */
  weight?: number;
  /** Japanese: TYPE_JP on top of the role (size × .86, +.02em, Noto's weight) */
  jp?: boolean;
  /** tabular figures (clocks, counters) */
  tabular?: boolean;
};

/** The role's size in px for an orientation (Japanese: × TYPE_JP.scale). */
export function typeSize(role: TypeRole, vertical: boolean, jp = false): number {
  const s = TYPE[role].size[vertical ? 1 : 0];
  return jp ? Math.round(s * TYPE_JP.scale) : s;
}

/** The role's weight on a ground. */
export function typeWeight(role: TypeRole, tone: Tone = 'paper', jp = false): number {
  if (jp) return tone === 'night' ? TYPE_JP.weightOnDark : TYPE_JP.weight;
  return tone === 'night' ? TYPE[role].weightOnDark : TYPE[role].weight;
}

/** Full CSS for a role: family, size, weight, tracking, line-height, case. */
export function typeStyle(role: TypeRole, vertical: boolean, o: TypeOptions = {}): CSSProperties {
  const r = TYPE[role];
  const jp = !!o.jp;
  return {
    fontFamily: r.family,
    fontSize: o.size ?? typeSize(role, vertical, jp),
    fontWeight: o.weight ?? typeWeight(role, o.tone, jp),
    letterSpacing: jp ? TYPE_JP.tracking : r.tracking,
    lineHeight: jp ? TYPE_JP.lineHeight : r.lineHeight,
    fontStyle: 'normal',
    textTransform: r.upper ? 'uppercase' : undefined,
    fontVariantNumeric: o.tabular ? 'tabular-nums' : undefined,
    fontKerning: 'normal',
    fontOpticalSizing: 'auto',
  };
}

/** typeStyle with the current composition's orientation. */
export function useType(role: TypeRole, o: TypeOptions = {}): CSSProperties {
  return typeStyle(role, useLayout().vertical, o);
}

/** A canvas `font` shorthand for a role (for measureText). */
export function typeFont(role: TypeRole, vertical: boolean, o: TypeOptions = {}): string {
  const st = typeStyle(role, vertical, o);
  return `${st.fontWeight} ${st.fontSize}px ${st.fontFamily}`;
}

/** The caption role as a <Captions> font (both speakers: the same setting, colour tells them apart). */
export function captionFont(vertical: boolean, tone: Tone = 'night', size?: number): CaptionFont {
  const r = TYPE.caption;
  return {
    family: r.family,
    weight: tone === 'night' ? r.weightOnDark : r.weight,
    size: size ?? r.size[vertical ? 1 : 0],
    lineHeight: r.lineHeight,
    tracking: r.tracking,
  };
}

/* ── The mask geometry every reveal uses (components/Type.tsx, Captions.tsx) ──
 * Instrument Sans: ascender .97, descender .25 (content 1.22 em), cap .72,
 * x .51. A word's clip box extends past its line box by MASK_PAD on each side
 * (so accents, descenders and the overhang of tight tracking are never cut
 * at rest), and is pulled back by the same negative margin (so nothing
 * reflows). */
export const MASK_PAD = { top: 0.16, right: 0.08, bottom: 0.22, left: 0.08 } as const;

/** The outer (clipping) span of a word / line reveal. `gap` = space after it (em). */
export function maskBox(gap = 0): CSSProperties {
  const p = MASK_PAD;
  return {
    display: 'inline-block',
    overflow: 'hidden',
    verticalAlign: 'top',
    padding: `${p.top}em ${p.right}em ${p.bottom}em ${p.left}em`,
    margin: `-${p.top}em ${(gap - p.right).toFixed(3)}em -${p.bottom}em -${p.left}em`,
    whiteSpace: 'nowrap',
  };
}

/**
 * A centred line rises AS A UNIT: all its words out of their masks together, this many frames apart
 * (a ripple, not a typewriter). Revealing a centred line word by word over a second leaves the first
 * words hanging off-centre under the label until the line fills — it reads as broken alignment.
 */
export const UNIT_STAGGER = 0.5;

/** Instrument Sans: the baseline's depth below the top of a line box of line-height `lh` (em). */
export const baselineEm = (lh: number) => (lh - 1.22) / 2 + 0.97;

/* ── Measuring (canvas measureText, the same face / weight / tracking as the DOM) ── */
let measureCtx: CanvasRenderingContext2D | null = null;
const WIDTHS = new Map<string, number>();

/**
 * The advance width (px) of `text` set in `family` at `weight` / `size` px with `trackingEm` letter-
 * spacing (em). Cached only once the face is loaded (use lib/fonts.ts useFaceReady to re-render).
 */
export function textWidth(text: string, family: string, weight: number, size: number, trackingEm = 0): number {
  const font = `${weight} ${size}px ${family}`;
  const key = `${font}|${trackingEm}|${text}`;
  const hit = WIDTHS.get(key);
  if (hit !== undefined) return hit;
  if (typeof document === 'undefined') return text.length * size * 0.5;
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  if (!measureCtx) return text.length * size * 0.5;
  measureCtx.font = font;
  (measureCtx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${trackingEm * size}px`;
  measureCtx.fontKerning = 'normal';
  const w = measureCtx.measureText(text).width;
  if (document.fonts.check(font, text)) WIDTHS.set(key, w);
  return w;
}
