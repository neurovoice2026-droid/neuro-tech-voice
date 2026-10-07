/**
 * REEL 5 · THE STAGE'S TYPE (docs/ig/ig5/SCRIPT.md §0.3 "Motion", §3): the words that print ON the objects (the slips'
 * tags, hedges and figures, ours' words), set in the house sans and measured with the kit (never flowed), each a pure
 * function of `t`:
 *
 *   <Print>      a word (or a run) that rises out of its own mask on her onset (SPRING.caption, 80 % of its height,
 *                the opacity over the first half) — object text is only ever words she says, on or after the word
 *   <Figure>     a price numeral: tabular digits in fixed cells (the width of "0"), the "$" and "," at their own
 *                widths; with `roll` (her word's frame) it RISES OUT OF ITS MASK AS ITS FINAL VALUE on the landing
 *                spring (its overshoot is the "thump") — it never counts: a 0 → N count printed prices that are in no
 *                source ($0, $28, $203, $1,013 — crit-r1 P7 / T2), and a paused frame must never show one; without
 *                `roll` (ours' $49) it is just set
 *   rollEase()   the continuous share over ROLL.dur from her word (the to-scale bar grows with it)
 *   figWidth()   a figure's width (needs the faces)
 *
 * No blur, no glow: rises out of masks; moving words ride their own sub-pixel layers (lib/glide via revealStyle).
 */
import React from 'react';
import { reveal, revealStyle, useGlide } from '../../../components/Type';
import { EASE, SPRING, tween } from '../../../lib/motion';
import { maskBox } from '../../../lib/type';
import { FONT, TYPE } from '../../../theme';
import { measureText } from '../../../kb/kit';
import { springMoving } from './settle';

/* ── settings ── */
/** object words (the slips' lines, ours' words): the title role's weight and tracking */
export const OBJ = { weight: TYPE.title.weight, tracking: -0.02 } as const;
/** the label role (tags, SAMPLE CALL) */
export const LABEL = { weight: TYPE.label.weight, tracking: 0.14 } as const;
/** price figures: a touch heavier than the display role so a numeral reads at a glance; no tracking (fixed cells) */
export const FIG = { weight: 520, tracking: 0 } as const;

export const objSpec = (size: number) => ({ size, weight: OBJ.weight, tracking: OBJ.tracking });
export const labelSpec = (size: number) => ({ size, weight: LABEL.weight, tracking: LABEL.tracking });
const figSpec = (size: number) => ({ size, weight: FIG.weight, tracking: 0 });

/* ── printed words ── */
export const Print: React.FC<{
  t: number;
  /** the rise starts here (her onset − 1: on or after the word) */
  at: number;
  text: string;
  /** local px: left and box top (line-height 1.2 box) */
  x: number;
  y: number;
  size: number;
  color: string;
  /** 'obj' (title weight) or 'label' (uppercase, tracked) */
  kind?: 'obj' | 'label';
  weight?: number;
  /** leaves up through the mask from here (6 f) */
  exitAt?: number;
  /** extra opacity (the pile's ink) */
  ink?: number;
  /** a carrying paper is moving */
  moving?: boolean;
  /** right-aligned at x (x is then the right edge) */
  right?: boolean;
  /** set (no rise): present from `at` at full ink — or with `lift`, 72 % until `at` then up (the frame-0 idiom) */
  set?: boolean;
  /** with `set`: the ink before `at` */
  lift?: number;
}> = ({ t, at, text, x, y, size, color, kind = 'obj', weight, exitAt, ink = 1, moving = false, right = false, set = false, lift }) => {
  const glide = useGlide();
  if (!set && t < at - 1) return null;
  if (exitAt !== undefined && t > exitAt + 7) return null;
  const label = kind === 'label';
  const w = weight ?? (label ? LABEL.weight : OBJ.weight);
  const tr = label ? LABEL.tracking : OBJ.tracking;
  const shown = label ? text.toUpperCase() : text;
  let r = set ? { p: 1, y: 0, opacity: 1, scale: 1 } : reveal(t, at, { config: SPRING.caption, rise: 80, fade: 0.5, exit: exitAt !== undefined ? { at: exitAt, dur: 6 } : undefined });
  if (set && exitAt !== undefined) r = reveal(t, -1e6, { exit: { at: exitAt, dur: 6 }, rise: 80 });
  let a = ink;
  if (set && lift !== undefined) a *= lift + (1 - lift) * tween(t, [at - 1, at + 1], [0, 1], EASE.out3);
  const hold = moving || glide || (!set && t - at < 14) || (exitAt !== undefined && t > exitAt - 1);
  const st = revealStyle({ ...r, opacity: r.opacity * a }, undefined, hold);
  const width = right ? measureText(shown, { size, weight: w, tracking: tr }) : 0;
  return (
    <div
      style={{
        position: 'absolute',
        left: right ? x - width : x,
        top: y,
        fontFamily: FONT.ui,
        fontSize: size,
        fontWeight: w,
        letterSpacing: `${tr}em`,
        lineHeight: 1.2,
        fontKerning: 'normal',
        whiteSpace: 'nowrap',
        color,
      }}
    >
      <span style={maskBox(0)}>
        <span style={st}>{shown}</span>
      </span>
    </div>
  );
};

/* ── figures ── */
/** "$1,500" from 1500 (no locale: deterministic) */
export const money = (v: number) => `$${Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

/** the bar's growth from her word: ≈ 0.6 s (an out-cubic, so it decelerates into the value) */
export const ROLL = { dur: 18 } as const;
const outCubic = (u: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, u)), 3);
/** the bar's continuous share (the to-scale bar grows with it) */
export const rollEase = (t: number, at: number) => outCubic((t - at) / ROLL.dur);

/** the digits' cell: the width of "0", a touch tighter (the figures read as one word, never as spaced digits) */
const CELL = 0.95;
/** a figure's cells (needs the faces) */
export function figCells(text: string, size: number) {
  const spec = figSpec(size);
  const cw = measureText('0', spec) * CELL;
  let x = 0;
  const cells = [...text].map((ch) => {
    const w = /\d/.test(ch) ? cw : measureText(ch, spec);
    const c = { ch, x, w };
    x += w;
    return c;
  });
  return { cells, w: x };
}
export const figWidth = (text: string, size: number) => figCells(text, size).w;

/** a figure's mask padding (em): the "$" stands above the cap line and the comma drops under the baseline */
const FIG_PAD = { top: 0.08, bottom: 0.16, side: 0.06 } as const;
/** |1 − p| under which the rise's 80 % offset is ≤ .03 % (≤ .04 px at 140 px): rest */
const FIG_RISE_EPS = 0.03 / 80;
export const Figure: React.FC<{
  t: number;
  /** the value it shows (always this value: it never counts) */
  value: number;
  /** local px: left and box top (line-height 1) */
  x: number;
  y: number;
  size: number;
  color: string;
  /** rises out of its mask on this frame (her word); omitted: set (shown from `from`) */
  roll?: number;
  /** a set figure appears from here (default always) */
  from?: number;
  ink?: number;
  moving?: boolean;
}> = ({ t, value, x, y, size, color, roll, from, ink = 1, moving = false }) => {
  const glide = useGlide();
  if (roll !== undefined && t < roll - 1) return null;
  if (roll === undefined && from !== undefined && t < from) return null;
  const { cells, w } = figCells(money(value), size);
  // the rise: out of its own mask from 80 % of its height below on the landing spring, its opacity over the first
  // half — the Print idiom, the value final from its first visible frame. The spring's overshoot is cut at rest (the
  // figure lands hard: the thump), so it never rises past its place into the tag above it
  const r0 = roll !== undefined ? reveal(t, roll - 1, { config: SPRING.land, rise: 80, fade: 0.5 }) : { p: 1, y: 0, opacity: 1, scale: 1 };
  const r = { ...r0, y: Math.max(0, r0.y) };
  const o = r.opacity * ink;
  if (o <= 0.002) return null;
  // its own layer while the landing spring lives — by the spring's ENVELOPE (crit-r3 LOOK3-B1: |r.y| > .03 % went false
  // at every overshoot crossing of SPRING.land, ζ ≈ .45 — and the overshoot is clamped to 0 — so a figure at rest flipped
  // crisp ↔ soft a few times before it settled)
  const live = moving || glide || (roll !== undefined && springMoving(t - (roll - 1), SPRING.land, FIG_RISE_EPS));
  const pt = FIG_PAD.top * size;
  const pb = FIG_PAD.bottom * size;
  const ps = FIG_PAD.side * size;
  return (
    <div style={{ position: 'absolute', left: x - ps, top: y - pt, width: w + 2 * ps, height: size + pt + pb, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          left: ps,
          top: pt,
          width: w,
          height: size,
          fontFamily: FONT.ui,
          fontSize: size,
          fontWeight: FIG.weight,
          lineHeight: 1,
          fontKerning: 'normal',
          fontVariantNumeric: 'tabular-nums lining-nums',
          whiteSpace: 'nowrap',
          color,
          opacity: o >= 0.999 ? undefined : o,
          ...(live ? { transform: `translateY(${r.y.toFixed(3)}%) rotate(0.002deg)`, willChange: 'transform' } : {}),
        }}
      >
        {cells.map((c, i) => (
          <span key={i} style={{ position: 'absolute', left: c.x, top: 0, width: c.w, textAlign: 'center', display: 'block' }}>
            {c.ch}
          </span>
        ))}
      </div>
    </div>
  );
};

/** a to-scale bar (local px): from x0, `len` long (no $0 tick: crit-r1 P8 — the bars' shared left edge says "from
 *  zero", and an unlabelled tick read as a glitch) */
export const ScaleBar: React.FC<{ x0: number; y: number; len: number; color: string; ink?: number; stroke?: number }> = ({ x0, y, len, color, ink = 1, stroke = 5 }) =>
  len > 0.3 ? <div style={{ position: 'absolute', left: x0, top: y - stroke / 2, width: Math.max(len, stroke), height: stroke, borderRadius: stroke / 2, background: color, opacity: ink }} /> : null;
