/**
 * THE CALL'S OUTCOME PILL (docs/ig/SCRIPT.md §5; §0.4 "Dashboard strings shown"): the dashboard's own OutcomeChip
 * (components/calls/call-display.tsx:95–110 — a Badge variant="outline": h-5, rounded-4xl, border, px-2, gap-1.5,
 * text-xs font-medium, a size-1.5 dot), in the app's own colours (OUTCOME_META :12–23, Tailwind v4's palette, the
 * OKLCH values converted to sRGB):
 *
 *   Booked         emerald   border-emerald-200 bg-emerald-50 text-emerald-700 · dot emerald-500   (ig2 only: the series' one emerald)
 *   Answered       blue      border-blue-200    bg-blue-50    text-blue-700    · dot blue-500
 *   Message taken  indigo    border-indigo-200  bg-indigo-50  text-indigo-700  · dot indigo-500
 *   Transferred    violet    border-violet-200  bg-violet-50  text-violet-700  · dot violet-500
 *
 * At trailer scale (SCRIPT.md §0.3: app chrome ≤ 32 px) the chip's 12 px type becomes `size` (default 28) and every
 * measure scales with it (height 20/12 em, padding 8/12 em, gap 6/12 em, dot 6/12 em). Sentence case, as the app sets
 * it — never uppercase. App chrome is not a line: a pill appears on, or after, the spoken word it belongs to.
 *
 *   <OutcomePill kind="answered" t={t} at={landing} />          lands (rises a touch, settles on SPRING.pop)
 *   <OutcomePill kind="booked" />                               static (inside a kit <Swap>, a card, a cover)
 *   outcomePillSize('booked', 28) → { w, h }                    for layout and the zone guard
 */
import React from 'react';
import { reveal } from '../../components/Type';
import { subpixel } from '../../lib/glide';
import { SPRING } from '../../lib/motion';
import { measureText, W } from '../../kb/kit';

export type OutcomeKind = 'booked' | 'answered' | 'messageTaken' | 'transferred';

/** OUTCOME_META's label and Tailwind classes, resolved (Tailwind v4 oklch → sRGB) */
export const OUTCOME: Record<OutcomeKind, { label: string; bg: string; border: string; ink: string; dot: string }> = {
  booked: { label: 'Booked', bg: '#ecfdf5', border: '#a4f4cf', ink: '#007a55', dot: '#00bc7d' },
  answered: { label: 'Answered', bg: '#eff6ff', border: '#bedbff', ink: '#1447e6', dot: '#2b7fff' },
  messageTaken: { label: 'Message taken', bg: '#eef2ff', border: '#c6d2ff', ink: '#432dd7', dot: '#615fff' },
  transferred: { label: 'Transferred', bg: '#f5f3ff', border: '#ddd6ff', ink: '#7008e7', dot: '#8e51ff' },
};

/** the chip's measures as a share of its type size (the Badge: text-xs 12 px, h-5, px-2, gap-1.5, size-1.5) */
const M = { h: 20 / 12, px: 8 / 12, gap: 6 / 12, dot: 6 / 12 } as const;
const textSpec = (size: number) => ({ size, weight: W.medium, tracking: -0.004 });

/** the pill's box at a type size (px) */
export function outcomePillSize(kind: OutcomeKind, size = 28): { w: number; h: number } {
  const w = 2 * M.px * size + M.dot * size + M.gap * size + measureText(OUTCOME[kind].label, textSpec(size));
  return { w, h: M.h * size };
}

export const OutcomePill: React.FC<{
  kind: OutcomeKind;
  /** type size (px), ≤ 32 (app chrome) */
  size?: number;
  /** animate: the landing frame (omitted: static) */
  t?: number;
  at?: number;
  /** leaves up (and fades) from here */
  exitAt?: number;
  /** extra transform after the landing (a parent's step-back is better applied to the parent) */
  style?: React.CSSProperties;
}> = ({ kind, size = 28, t, at, exitAt, style }) => {
  const o = OUTCOME[kind];
  const animated = t !== undefined && at !== undefined;
  let moving = false;
  let tf: string | undefined;
  let opacity = 1;
  if (animated) {
    if (t < at - 1) return null;
    // a chip is an object, not a line: it lands from 40 % of its height below on the app's pop spring, its opacity
    // over the first half of the travel, a whisper of scale settling with it
    const r = reveal(t, at, { config: SPRING.pop, rise: 40, fade: 0.5, scaleFrom: 0.94, exit: exitAt !== undefined ? { at: exitAt, dur: 6 } : undefined });
    moving = Math.abs(r.y) > 0.03 || Math.abs(r.scale - 1) > 1e-4;
    tf = moving ? `translateY(${r.y.toFixed(3)}%) scale(${r.scale.toFixed(5)})` : undefined;
    opacity = r.opacity;
    if (opacity <= 0.002) return null;
  }
  const bw = Math.max(1.25, size / 14);
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: M.gap * size,
        height: M.h * size,
        padding: `0 ${(M.px * size).toFixed(2)}px`,
        borderRadius: 999,
        background: o.bg,
        boxShadow: `inset 0 0 0 ${bw.toFixed(2)}px ${o.border}`,
        fontFamily: '"Instrument Sans Variable", "Instrument Sans", system-ui, sans-serif',
        fontSize: size,
        fontWeight: W.medium,
        letterSpacing: '-0.004em',
        lineHeight: 1,
        color: o.ink,
        whiteSpace: 'nowrap',
        transformOrigin: '50% 60%',
        opacity: opacity >= 0.999 ? undefined : opacity,
        ...subpixel(tf, moving),
        ...style,
      }}
    >
      <span style={{ display: 'block', width: M.dot * size, height: M.dot * size, borderRadius: '50%', background: o.dot, flexShrink: 0 }} />
      <span style={{ display: 'block', transform: 'translateY(-0.02em)' }}>{o.label}</span>
    </div>
  );
};
