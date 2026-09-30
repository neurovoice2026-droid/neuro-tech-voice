/**
 * Kinetic typography, in the site's idiom.
 *
 * <Words> — the hero's word-mask reveal (components/site/hero.tsx): every
 * word sits in its own overflow-hidden box and rises from y 115 % to 0, one
 * after another. Here it rides a spring with anticipation + overshoot, adds
 * velocity-scaled blur (simulated motion blur) and, optionally, the voice
 * section's 3 px → 0 blur-in. Words are separated by padding, not spaces,
 * exactly like the site (padding-right 0.24em).
 *
 * Key phrases ease from the base colour to their colour after a short delay
 * (home.css: 0.6 s house ease, 0.15 s delay).
 */
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { C, FONT, TRACK } from '../theme';
import { aos, EASE, mixHex, SPRING, tween } from '../lib/motion';
import type { SpringConfig } from 'remotion';

export type KeyPhrase = { text: string; color: string; at: number };

export const Words: React.FC<{
  text: string;
  start: number;
  stagger?: number;
  style?: React.CSSProperties;
  color?: string;
  /** Words that take a key colour: exact phrase inside `text`. */
  keys?: KeyPhrase[];
  /** Blur-in (voice section) on top of the rise. */
  blurIn?: boolean;
  /** Where the words come from. */
  from?: 'below' | 'above';
  config?: Partial<SpringConfig>;
  exit?: { at: number; stagger?: number; dur?: number; to?: 'up' | 'down' };
  align?: React.CSSProperties['textAlign'];
  /** Frame override (for motion-blur sub-frames etc). */
  frame?: number;
  wordStyle?: (i: number, word: string) => React.CSSProperties | undefined;
}> = ({
  text,
  start,
  stagger = 3,
  style,
  color = C.paper,
  keys = [],
  blurIn = true,
  from = 'below',
  config = SPRING.site,
  exit,
  align = 'center',
  frame: fOverride,
  wordStyle,
}) => {
  const current = useCurrentFrame();
  const frame = fOverride ?? current;
  const words = text.split(' ');

  // map each word index to a key phrase (if any)
  const keyOf: (KeyPhrase | undefined)[] = words.map(() => undefined);
  for (const k of keys) {
    const kw = k.text.split(' ');
    for (let i = 0; i + kw.length <= words.length; i++) {
      if (kw.every((w, j) => words[i + j] === w)) {
        for (let j = 0; j < kw.length; j++) keyOf[i + j] = k;
      }
    }
  }

  const dir = from === 'below' ? 1 : -1;

  return (
    <div
      style={{
        fontFamily: FONT.display,
        fontWeight: 500,
        letterSpacing: TRACK.display,
        lineHeight: 1.04,
        textAlign: align,
        textWrap: 'balance',
        ...style,
      }}
    >
      {words.map((w, i) => {
        const s = start + i * stagger;
        const p = aos(frame, s, { anticip: 4, depth: 0.06, config });
        const pPrev = aos(frame - 1, s, { anticip: 4, depth: 0.06, config });
        let y = (1 - p) * 115 * dir; // %
        const speed = Math.abs(p - pPrev) * 115; // % per frame
        let o = 1;
        if (exit) {
          const e = exit.at + i * (exit.stagger ?? 2);
          const q = tween(frame, [e, e + (exit.dur ?? 10)], [0, 1], EASE.in2);
          y += q * 115 * (exit.to === 'down' ? 1 : -1);
          o = 1 - q * 0.2;
        }
        const k = keyOf[i];
        const col = k ? mixHex(color, k.color, tween(frame, [k.at, k.at + 18], [0, 1], EASE.house)) : color;
        const blur =
          (blurIn ? tween(frame, [s, s + 12], [3, 0], EASE.house) : 0) + Math.min(10, speed * 0.12);
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              overflow: 'hidden',
              verticalAlign: 'top',
              paddingBottom: '0.16em',
              marginBottom: '-0.16em',
              paddingRight: i < words.length - 1 ? '0.24em' : 0,
              whiteSpace: 'nowrap',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                transform: `translateY(${y}%)`,
                color: col,
                opacity: o,
                filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
                ...wordStyle?.(i, w),
              }}
            >
              {w}
            </span>
          </span>
        );
      })}
    </div>
  );
};

/** The site's label type: 11 px Inter 500, 0.14em, UPPERCASE — scaled. */
export const Label: React.FC<{
  children: React.ReactNode;
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}> = ({ children, size = 22, color = C.paperDim, style }) => (
  <div
    style={{
      fontFamily: FONT.body,
      fontWeight: 500,
      fontSize: size,
      lineHeight: 1.45,
      letterSpacing: TRACK.label,
      textTransform: 'uppercase',
      color,
      ...style,
    }}
  >
    {children}
  </div>
);

/**
 * The site's CornerDot (components/site/corner-dot.tsx): a disc with a
 * rounded-square bite out of it. Leads eyebrows and the footer imprint.
 */
export const CornerDot: React.FC<{ size?: number; color?: string; style?: React.CSSProperties }> = ({
  size = 20,
  color = 'currentColor',
  style,
}) => (
  <svg width={size} height={size} viewBox="0 0 6 6" style={{ display: 'block', ...style }} aria-hidden>
    <path
      fill={color}
      fillRule="evenodd"
      d="M3 0a3 3 0 110 6 3 3 0 010-6ZM1.493 1.167a.326.326 0 00-.326.326v3.014c0 .18.146.326.326.326h3.014a.326.326 0 00.326-.326V1.493a.326.326 0 00-.326-.326H1.493Z"
    />
  </svg>
);

/**
 * The hero's corner marks: four solid squares bracketing a block
 * (hero.tsx:18-42). `p` 0→1 animates them in (scale 0.4 → 1, staggered).
 */
export const CornerMarks: React.FC<{
  size?: number;
  color?: string;
  inset?: number;
  frame: number;
  start: number;
}> = ({ size = 14, color = C.coverPaper, inset = -26, frame, start }) => {
  const pos: React.CSSProperties[] = [
    { left: inset, top: inset },
    { right: inset, top: inset },
    { left: inset, bottom: inset },
    { right: inset, bottom: inset },
  ];
  return (
    <>
      {pos.map((p, i) => {
        const s = aos(frame, start + i * 2, { anticip: 3, depth: 0.1, config: SPRING.pop });
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: size,
              height: size,
              background: color,
              transform: `scale(${Math.max(0, 0.4 + 0.6 * s)})`,
              opacity: Math.min(1, Math.max(0, s * 1.4)),
              ...p,
            }}
          />
        );
      })}
    </>
  );
};

/** Typewriter progress: number of characters shown at `frame`. */
export function typed(frame: number, start: number, length: number, rate: number): number {
  if (frame < start) return 0;
  return Math.min(length, Math.floor((frame - start) * rate));
}
