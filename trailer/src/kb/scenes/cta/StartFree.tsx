/**
 * b18 · "Start free →" — the site header's own button (components/site/header/site-header.tsx .hdr-startfree), a FORK
 * of film 1's scenes/cta/EndCard StartFree (frozen) that changes one thing: THE HOVER NEVER WASHES THE LABEL OUT.
 *
 * Film 1 ran the site's transition-colors literally — the plate paper → plum and the label ink → paper on the same
 * curve — so half-way both met in a lavender plate with a lavender-grey label on it (the label all but gone for a frame
 * or two, t2936.5–2938 in the critic's strip). Here the plate still runs the site's 300 ms colour transition (Tailwind's
 * curve, sRGB channels, the arrow .2em on), but the label is never interpolated: it stays the cover ink while the ink
 * reads better on the plate than the paper would, and turns paper the moment the paper reads better (WCAG contrast of
 * each against the plate's colour on that frame), with a crossfade one render frame wide. The worst it ever reads is
 * the crossover itself, ≈ 3.9:1, for that one frame; ink on the paper plate is 13:1, paper on plum 7.7:1.
 *
 * Everything else is film 1's: the rise (the plate up on the text spring, opaque within 40 % of its travel, its words
 * out of their masks), the press (active:scale .97 in `down` frames) and the release (one soft ≈4 % overshoot, settled in
 * ≈12 f), every residual pinned by `rest` for the hold.
 */
import React from 'react';
import { Easing } from 'remotion';
import { reveal, revealStyle } from '../../../components/Type';
import { subpixel } from '../../../lib/glide';
import { EASE, mix, smooth, SPRING, springUnit, tween } from '../../../lib/motion';
import { maskBox, typeStyle } from '../../../lib/type';
import { C } from '../../../theme';

export type Rest = (t: number, v: number, target: number) => number;

/** the plate back from the click: one soft ≈4 % overshoot, settled in ≈12 f (film 1's) */
const BACK = { stiffness: 230, damping: 21, mass: 1 };
/** Tailwind's transition timing (cubic-bezier(.4, 0, .2, 1)) over its 300 ms */
const TW = Easing.bezier(0.4, 0, 0.2, 1);
const TW_FRAMES = 9;
const INK = '#06040a'; // --cover-ink
const PAPER_PLATE = C.coverPaper; // --cover-paper
const PLUM = C.plum; // --cover-brand (the site's hover)

const rgbOf = (hex: string) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
const lerpRgb = (a: string, b: string, u: number) => {
  const A = rgbOf(a);
  const B = rgbOf(b);
  return A.map((x, k) => x + (B[k] - x) * u);
};
const css = (c: number[]) => `rgb(${c.map((x) => x.toFixed(2)).join(' ')})`;
/** WCAG relative luminance of an sRGB 0..255 triple */
const lum = (c: number[]) => {
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const L_INK = lum(rgbOf(INK));
const L_PAPER = lum(rgbOf(PAPER_PLATE));

/** The label's colour on a plate: whichever of ink / paper reads better, crossfading only across ±.25 of contrast
 *  around the crossover (one render frame of the transition). */
function labelOn(plate: number[]): number[] {
  const lp = lum(plate);
  const d = contrast(L_PAPER, lp) - contrast(L_INK, lp);
  const w = smooth(-0.25, 0.25, d);
  return lerpRgb(INK, PAPER_PLATE, w);
}

export type PressSpec = {
  /** the hover: the pointer's hotspot enters the plate and the site's transition-colors (300 ms) runs from here */
  hover: number;
  /** frames down to .97 (active:scale) */
  down: number;
};

export const StartFree: React.FC<{
  t: number;
  at: number;
  press: number;
  /** label size (px) */
  fontSize: number;
  vertical: boolean;
  spec: PressSpec;
  rest: Rest;
}> = ({ t, at, press, fontSize: F, vertical, spec, rest }) => {
  if (t < at - 1) return null;
  /* ── the rise: the plate comes up on a soft spring, its words out of their masks ── */
  const e = rest(t, springUnit(t - at, SPRING.text), 1);
  const y = (1 - e) * 0.55 * F;
  const sc0 = mix(0.97, 1, Math.min(1, Math.max(0, e)));
  // (the plate is opaque within the first 40 % of its travel: paper, never a lingering grey veil)
  const plateO = smooth(0, 0.4, e);

  /* ── the click, as on the site: hover (the plate's colour over 300 ms, the arrow .2em), then active:scale(.97) ── */
  const h = rest(t, tween(t, [spec.hover, spec.hover + TW_FRAMES], [0, 1], TW), 1);
  const u = t - press;
  const down = u < 0 ? 1 : u < spec.down ? mix(1, 0.97, EASE.out3(u / spec.down)) : mix(0.97, 1, springUnit(u - spec.down, BACK));
  const click = rest(t, down, 1);
  const arrowX = 0.2 * h;
  const plate = h <= 0 ? rgbOf(PAPER_PLATE) : lerpRgb(PAPER_PLATE, PLUM, h);

  const label = typeStyle('title', vertical, { tone: 'paper', size: F, weight: 500 });
  const moving = Math.abs(y) > 0.02 || Math.abs(sc0 * click - 1) > 1e-4;
  const tf = moving ? `translateY(${y.toFixed(3)}px) scale(${(sc0 * click).toFixed(5)})` : undefined;

  return (
    <div
      style={{
        ...label,
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4em',
        height: '2.25em',
        padding: '0 1.125em',
        borderRadius: '0.5em',
        background: h <= 0 ? PAPER_PLATE : css(plate),
        color: h <= 0 ? INK : css(labelOn(plate)),
        whiteSpace: 'nowrap',
        opacity: plateO >= 0.999 ? undefined : plateO,
        ...subpixel(tf, moving),
      }}
    >
      <span>
        <Rise t={t} at={at - 0.5} gap={0.24}>
          Start
        </Rise>
        <Rise t={t} at={at + 0.5}>
          free
        </Rise>
      </span>
      <span style={{ display: 'inline-block', transform: arrowX > 1e-4 ? `translateX(${arrowX.toFixed(4)}em)` : undefined }}>
        <Rise t={t} at={at + 1.5}>
          →
        </Rise>
      </span>
    </div>
  );
};

/** One word out of its own mask (the film's gesture), on the caption spring (film 1's `quick` Rise). */
const Rise: React.FC<{ t: number; at: number; gap?: number; children: React.ReactNode }> = ({ t, at, gap = 0, children }) => {
  const r = reveal(t, at, { config: SPRING.caption });
  return (
    <span style={maskBox(gap)}>
      <span style={revealStyle(r)}>{children}</span>
    </span>
  );
};
