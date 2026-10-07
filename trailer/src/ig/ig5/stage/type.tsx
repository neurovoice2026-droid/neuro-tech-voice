/**
 * REEL 5 · THE STAGE'S TYPE (docs/ig/ig5/SCRIPT.md §0.3 "Motion", §3): the words that print ON the objects (the slips'
 * tags, hedges and figures, ours' words), set in the house sans and measured with the kit (never flowed), each a pure
 * function of `t`:
 *
 *   <Print>      a word (or a run) that rises out of its own mask on her onset (SPRING.caption, 80 % of its height,
 *                the opacity over the first half) — object text is only ever words she says, on or after the word
 *   <Figure>     a price numeral: tabular digits in fixed cells (the width of "0", so a rolling figure never changes
 *                its digits' places), the "$" and "," at their own widths; `roll` counts it 0 → its value on 32nd
 *                ticks over ≈ 0.6 s (an out-cubic, so it decelerates into the value) and it lands on SPRING.land (a
 *                small drop with the landing spring's overshoot); a figure that `never rolls` (ours' $49) is just set
 *   rollValue()  the rolled value at t; rollEase() the continuous share (the to-scale hairline grows with it)
 *   figWidth()   a figure's width (needs the faces)
 *
 * No blur, no glow: rises out of masks; moving words ride their own sub-pixel layers (lib/glide via revealStyle).
 */
import React from 'react';
import { reveal, revealStyle, useGlide } from '../../../components/Type';
import { EASE, SPRING, springUnit, tween } from '../../../lib/motion';
import { maskBox } from '../../../lib/type';
import { FONT, TYPE } from '../../../theme';
import { measureText } from '../../../kb/kit';

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

/** the roll: ≈ 0.6 s, ticking on 32nds */
export const ROLL = { dur: 18, tick: 1.875 } as const;
const outCubic = (u: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, u)), 3);
/** the rolled value at t (0 before the roll, the value from at + dur on) */
export function rollValue(t: number, at: number, value: number): number {
  if (t < at) return 0;
  const tq = Math.min(ROLL.dur, Math.floor((t - at) / ROLL.tick + 1e-9) * ROLL.tick);
  return Math.round(value * outCubic(tq / ROLL.dur));
}
/** the roll's continuous share (the to-scale hairline grows with it) */
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

export const Figure: React.FC<{
  t: number;
  /** the value it shows at rest */
  value: number;
  /** local px: left and box top (line-height 1) */
  x: number;
  y: number;
  size: number;
  color: string;
  /** roll from 0 on this frame (her word); omitted: set (shown from `from`) */
  roll?: number;
  /** a set figure appears from here (default always) */
  from?: number;
  ink?: number;
  moving?: boolean;
}> = ({ t, value, x, y, size, color, roll, from, ink = 1, moving = false }) => {
  const glide = useGlide();
  if (roll !== undefined && t < roll - 0.25) return null;
  if (roll === undefined && from !== undefined && t < from) return null;
  const v = roll !== undefined ? rollValue(t, roll, value) : value;
  const { cells } = figCells(money(v), size);
  // the landing: a small drop on the landing spring while it rolls (its overshoot is the "thump")
  const k = roll !== undefined ? springUnit(t - roll, SPRING.land) : 1;
  const dy = (1 - k) * -0.07 * size;
  const o = (roll !== undefined ? tween(t, [roll - 0.25, roll + 1.5], [0, 1], EASE.out3) : 1) * ink;
  const live = moving || glide || Math.abs(dy) > 0.02;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 0,
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
        ...(live ? { transform: `translateY(${dy.toFixed(3)}px) rotate(0.002deg)`, willChange: 'transform' } : {}),
      }}
    >
      {cells.map((c, i) => (
        <span key={i} style={{ position: 'absolute', left: c.x, top: 0, width: c.w, textAlign: 'center', display: 'block' }}>
          {c.ch}
        </span>
      ))}
    </div>
  );
};

/** a to-scale hairline (local px): from x0, `len` long, a $0 tick at its start */
export const ScaleBar: React.FC<{ x0: number; y: number; len: number; color: string; ink?: number; stroke?: number; tick?: number }> = ({ x0, y, len, color, ink = 1, stroke = 3, tick = 1 }) => (
  <>
    {tick > 0.002 ? <div style={{ position: 'absolute', left: x0 - 0.75, top: y - 9, width: 1.5, height: 18, borderRadius: 1, background: '#55535a', opacity: 0.55 * ink * tick }} /> : null}
    {len > 0.3 ? <div style={{ position: 'absolute', left: x0, top: y - stroke / 2, width: len, height: stroke, borderRadius: stroke / 2, background: color, opacity: ink }} /> : null}
  </>
);
