/**
 * Kinetic typography — set like the knowledge heading (theme.ts TYPE), and
 * revealed by MOTION, never by blur.
 *
 * Every reveal is the same gesture: the word (or line) sits in its own
 * clipping box (lib/type.ts maskBox) and rises out of it on a soft spring
 * (SPRING.text: ζ ≈ .8, a 1.4 % overshoot) while its opacity comes up over
 * the first half of the travel. Exits leave the same way (up out of the mask,
 * accelerating, fading in the second half). No filter: blur, no ghost
 * copies, no simulated motion blur — the film renders at 120 fps, and every
 * value here is a continuous function of the fractional timeline time, so
 * the motion itself is smooth.
 *
 *   reveal(t, start, opts)   the curve, for anything (→ { p, y %, opacity, scale })
 *   <Reveal>                 one masked element (a card name, a figure …)
 *   <Words>                  a line / paragraph, per word or per line, two-tone key phrases
 *   <Label>                  uppercase tracked meta (TYPE.label)
 *   <SpeakerLabel>           ● AVA / ● CALLER in the speaker's ink
 */
import React from 'react';
import { useCurrentFrame, type SpringConfig } from 'remotion';
import { C, TYPE, VOICE_INK, type Speaker, type Tone, type TypeRole } from '../theme';
import { EASE, mixHex, smooth, SPRING, springUnit, tween } from '../lib/motion';
import { useLayout } from '../lib/layout';
import { useSub } from '../lib/scene';
import { maskBox, typeStyle } from '../lib/type';

/* ── the curve ─────────────────────────────────────────────────── */

export type RevealExit = {
  /** frame the exit starts */
  at: number;
  /** frames it takes (default 8) */
  dur?: number;
  to?: 'up' | 'down';
};

export type RevealOptions = {
  config?: Partial<SpringConfig>;
  /** travel, in % of the element's own height (100 = from just outside its mask) */
  rise?: number;
  from?: 'below' | 'above';
  /** the share of the travel over which the opacity comes up (0 = none) */
  fade?: number;
  /** start scale (1 = none; .96 = a whisper of scale settling with the rise) */
  scaleFrom?: number;
  /** frames of a soft anticipation dip before `start` (0 = none) */
  anticip?: number;
  exit?: RevealExit;
};

/**
 * The reveal at time t (timeline frames, fractional) for an element released at `start`.
 * p: the spring (0 → ~1.014 → 1); y: translateY in % of the element's height; opacity; scale.
 */
export function reveal(t: number, start: number, o: RevealOptions = {}) {
  const { config = SPRING.text, rise = 100, from = 'below', fade = 0.55, scaleFrom = 1, anticip = 0, exit } = o;
  let p: number;
  if (anticip > 0 && t < start && t > start - anticip) {
    p = -0.05 * Math.sin(((t - (start - anticip)) / anticip) * (Math.PI / 2));
  } else {
    const s = springUnit(t - start, config);
    const recover = anticip > 0 ? Math.max(0, 1 - (t - start) / 4) : 0;
    p = s - 0.05 * recover * (1 - s);
  }
  const dir = from === 'below' ? 1 : -1;
  let y = (1 - p) * rise * dir;
  let opacity = fade > 0 ? smooth(0, fade, p) : t >= start ? 1 : 0;
  if (exit) {
    const q = tween(t, [exit.at, exit.at + (exit.dur ?? 8)], [0, 1], EASE.in3);
    y += q * rise * (exit.to === 'down' ? 1 : -1);
    opacity *= 1 - smooth(0.35, 1, q);
  }
  const scale = scaleFrom + (1 - scaleFrom) * Math.min(1, Math.max(0, p));
  return { p, y, opacity, scale };
}

/** The inner (moving) span's style for a reveal state. */
export function revealStyle(r: ReturnType<typeof reveal>, origin = '50% 85%'): React.CSSProperties {
  const tf =
    Math.abs(r.y) > 1e-4 || Math.abs(r.scale - 1) > 1e-5
      ? `translateY(${r.y.toFixed(3)}%)${Math.abs(r.scale - 1) > 1e-5 ? ` scale(${r.scale.toFixed(5)})` : ''}`
      : undefined;
  return {
    display: 'inline-block',
    transform: tf,
    transformOrigin: origin,
    opacity: r.opacity >= 0.999 ? undefined : Math.max(0, r.opacity),
  };
}

/** One element revealed out of its own mask (inline-block). `gap`: space after it, in em. */
export const Reveal: React.FC<
  RevealOptions & {
    t: number;
    start: number;
    children: React.ReactNode;
    gap?: number;
    /** false: no clipping box (a plain rise + fade) */
    mask?: boolean;
    style?: React.CSSProperties;
    innerStyle?: React.CSSProperties;
  }
> = ({ t, start, children, gap = 0, mask = true, style, innerStyle, ...o }) => {
  const r = reveal(t, start, o);
  if (r.opacity <= 0.001 && !mask) return null;
  return (
    <span style={{ ...(mask ? maskBox(gap) : { display: 'inline-block', marginRight: `${gap}em` }), ...style }}>
      <span style={{ ...revealStyle(r), ...innerStyle }}>{children}</span>
    </span>
  );
};

/* ── Words ─────────────────────────────────────────────────────── */

export type KeyPhrase = { text: string; color: string; at: number };

export type WordsProps = {
  text: string;
  start: number;
  /** frames between words (or lines, with by="line") */
  stagger?: number;
  style?: React.CSSProperties;
  /** hex (key phrases ease from it) */
  color?: string;
  /** Words that take a key colour: exact phrase inside `text`. Two-tone from the start: at ≤ start. */
  keys?: KeyPhrase[];
  /** @deprecated no-op — text never blurs in (it rises out of its mask) */
  blurIn?: boolean;
  /** Where the words come from. */
  from?: 'below' | 'above';
  config?: Partial<SpringConfig>;
  exit?: { at: number; stagger?: number; dur?: number; to?: 'up' | 'down' };
  align?: React.CSSProperties['textAlign'];
  /** Frame override (timeline frames, fractional ok). */
  frame?: number;
  wordStyle?: (i: number, word: string) => React.CSSProperties | undefined;
  /** the TYPE role (default 'display'); `style` overrides (e.g. a fontSize from a handoff contract) */
  role?: TypeRole;
  /** the ground (weight compensation for light type on night). Default 'night' (the default colour is paper). */
  tone?: Tone;
  /** explicit lines (each kept on one row); otherwise `text` wraps, balanced */
  lines?: readonly string[];
  /** reveal unit: each word (default) or each whole line */
  by?: 'word' | 'line';
  /** travel in % of the unit's height (default 100: from just outside its mask) */
  rise?: number;
  /** start scale (default 1) */
  scaleFrom?: number;
  /** anticipation dip, frames (default 0) */
  anticip?: number;
  /** word gap, em (default .24 — the site's padding-right) */
  gap?: number;
};

export const Words: React.FC<WordsProps> = ({
  text,
  start,
  stagger = 3,
  style,
  color = C.paper,
  keys = [],
  from = 'below',
  config = SPRING.text,
  exit,
  align = 'center',
  frame: fOverride,
  wordStyle,
  role = 'display',
  tone = 'night',
  lines,
  by = 'word',
  rise = 100,
  scaleFrom = 1,
  anticip = 0,
  gap = 0.24,
}) => {
  const current = useCurrentFrame() / useSub();
  const t = fOverride ?? current;
  const L = useLayout();
  const rows = (lines && lines.length ? lines : [text]).map((r) => r.split(' ').filter(Boolean));
  const all = rows.flat();

  // map each word index to a key phrase (if any)
  const keyOf: (KeyPhrase | undefined)[] = all.map(() => undefined);
  for (const k of keys) {
    const kw = k.text.split(' ');
    for (let i = 0; i + kw.length <= all.length; i++) {
      if (kw.every((w, j) => all[i + j] === w)) for (let j = 0; j < kw.length; j++) keyOf[i + j] = k;
    }
  }
  const inkOf = (i: number) => {
    const k = keyOf[i];
    return k ? mixHex(color, k.color, tween(t, [k.at, k.at + 18], [0, 1], EASE.house)) : color;
  };
  const opts = (s: number, e: number | null): RevealOptions => ({
    config,
    rise,
    from,
    scaleFrom,
    anticip,
    exit: exit && e !== null ? { at: e, dur: exit.dur ?? 10, to: exit.to } : undefined,
  });

  let n = 0;
  const body =
    by === 'line'
      ? rows.map((ws, li) => {
          const s = start + li * stagger;
          const e = exit ? exit.at + li * (exit.stagger ?? 2) : null;
          const r = reveal(t, s, opts(s, e));
          const first = n;
          n += ws.length;
          return (
            <div key={li} style={{ whiteSpace: 'nowrap' }}>
              <span style={maskBox(0)}>
                <span style={revealStyle(r)}>
                  {ws.map((w, j) => (
                    <span key={j} style={{ color: inkOf(first + j), paddingRight: j < ws.length - 1 ? `${gap}em` : 0, ...wordStyle?.(first + j, w) }}>
                      {w}
                    </span>
                  ))}
                </span>
              </span>
            </div>
          );
        })
      : rows.map((ws, li) => {
          const words = ws.map((w, j) => {
            const i = n++;
            const s = start + i * stagger;
            const e = exit ? exit.at + i * (exit.stagger ?? 2) : null;
            const r = reveal(t, s, opts(s, e));
            const last = j === ws.length - 1 && li === rows.length - 1;
            return (
              <span key={i} style={maskBox(last ? 0 : gap)}>
                <span style={{ ...revealStyle(r), color: inkOf(i), ...wordStyle?.(i, w) }}>{w}</span>
              </span>
            );
          });
          return lines && lines.length ? (
            <div key={li} style={{ whiteSpace: 'nowrap' }}>
              {words}
            </div>
          ) : (
            <React.Fragment key={li}>{words}</React.Fragment>
          );
        });

  return (
    <div
      style={{
        ...typeStyle(role, L.vertical, { tone }),
        textAlign: align,
        textWrap: 'balance',
        color,
        ...style,
      }}
    >
      {body}
    </div>
  );
};

/* ── Labels ────────────────────────────────────────────────────── */

/** Uppercase tracked meta in Instrument Sans (TYPE.label; 30 / 28 px by orientation unless `size`). */
export const Label: React.FC<{
  children: React.ReactNode;
  size?: number;
  color?: string;
  tone?: Tone;
  style?: React.CSSProperties;
}> = ({ children, size, color = C.paperDim, tone = 'night', style }) => {
  const L = useLayout();
  return (
    <div style={{ ...typeStyle('label', L.vertical, { tone, size }), color, whiteSpace: 'nowrap', ...style }}>
      {children}
    </div>
  );
};

/**
 * ● AVA / ● CALLER — who is speaking, in the speaker's tag ink (theme.ts VOICE_INK).
 * With `t`/`start` it rises out of its mask like the words (and leaves with `exit`).
 */
export const SpeakerLabel: React.FC<{
  who: Speaker;
  tone?: Tone;
  t?: number;
  start?: number;
  exit?: RevealExit;
  size?: number;
  /** a small dot before the name (default true) */
  dot?: boolean;
  color?: string;
  text?: string;
  style?: React.CSSProperties;
}> = ({ who, tone = 'night', t, start, exit, size, dot = true, color, text, style }) => {
  const L = useLayout();
  const ink = color ?? VOICE_INK[who][tone].tag;
  const st = typeStyle('label', L.vertical, { tone, size });
  const fs = (st.fontSize as number) ?? TYPE.label.size[0];
  const content = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5em' }}>
      {dot ? (
        <span
          style={{
            display: 'inline-block',
            width: Math.round(fs * 0.3),
            height: Math.round(fs * 0.3),
            borderRadius: '50%',
            background: ink,
            transform: 'translateY(-0.04em)',
          }}
        />
      ) : null}
      <span>{text ?? VOICE_INK[who].label}</span>
    </span>
  );
  return (
    <div style={{ ...st, color: ink, whiteSpace: 'nowrap', ...style }}>
      {t !== undefined && start !== undefined ? (
        <Reveal t={t} start={start} exit={exit} config={SPRING.caption}>
          {content}
        </Reveal>
      ) : (
        content
      )}
    </div>
  );
};

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
 * (hero.tsx:18-42), scaling in .4 → 1 on a soft spring, staggered.
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
        const s = springUnit(frame - (start + i * 2), SPRING.pop);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: size,
              height: size,
              background: color,
              transform: `scale(${Math.max(0, 0.4 + 0.6 * s).toFixed(4)})`,
              opacity: Math.min(1, Math.max(0, s * 1.4)),
              ...p,
            }}
          />
        );
      })}
    </>
  );
};

/** Typewriter progress: number of characters shown at `frame` (genuinely discrete). */
export function typed(frame: number, start: number, length: number, rate: number): number {
  if (frame < start) return 0;
  return Math.min(length, Math.floor((frame - start) * rate));
}
