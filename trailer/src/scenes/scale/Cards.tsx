/**
 * The white cards of the white act (site: white, radius 21.6, SHADOW.card),
 * and what goes inside them: an industry (ordinal · lucide icon · label) or
 * a language (label · greeting in the cinema face).
 */
import React from 'react';
import { spring } from 'remotion';
import { C, FONT, R, TRACK } from '../../theme';
import { EASE, SPRING, tween } from '../../lib/motion';
import { FPS } from '../../timing';
import type { Industry, Lang } from './data';
import type { Rect } from './geometry';
import { Rise, tokenize, Voice } from './Rise';

/** SHADOW.card, deepened by `lift` 0..1 (the selected card rises off the tray). */
export function cardShadow(lift: number, alpha = 1): string {
  const l = Math.max(0, lift);
  return `0 0 0 1px rgb(24 16 40 / ${(0.06 * alpha).toFixed(3)}), 0 ${(14 + 14 * l).toFixed(1)}px ${(30 + 18 * l).toFixed(1)}px ${(-20 + 2 * l).toFixed(1)}px rgb(24 16 40 / ${((0.35 + 0.1 * l) * alpha).toFixed(3)})`;
}

export const Box: React.FC<{
  r: Rect;
  transform?: string;
  opacity?: number;
  blur?: number;
  lift?: number;
  shadowAlpha?: number;
  children?: React.ReactNode;
  radius?: number;
  bg?: string;
  z?: number;
  /** a raw CSS filter (e.g. a directional DirBlur); wins over `blur` */
  filter?: string;
}> = ({ r, transform, opacity = 1, blur = 0, lift = 0, shadowAlpha = 1, children, radius = R.x2, bg = C.white, z, filter }) => (
  <div
    style={{
      position: 'absolute',
      left: r.x,
      top: r.y,
      width: r.w,
      height: r.h,
      borderRadius: radius,
      background: bg,
      boxShadow: cardShadow(lift, shadowAlpha),
      transform,
      opacity,
      filter: filter ?? (blur > 0.15 ? `blur(${blur.toFixed(2)}px)` : undefined),
      overflow: 'hidden',
      zIndex: z,
    }}
  >
    {children}
  </div>
);

/** An industry, as the #use-cases index sets it, grown into a card. */
export const IndustryContent: React.FC<{
  d: Industry;
  t: number;
  /** the pop frame */
  at: number;
  pad: number;
  opacity?: number;
  blur?: number;
  /** static (ghost copies / flyers after landing) */
  still?: boolean;
  /** label only (the smear copies of a flying card) */
  lite?: boolean;
}> = ({ d, t, at, pad, opacity = 1, blur = 0, still = false, lite = false }) => {
  const ip = still ? 1 : t < at + 1 ? 0 : spring({ frame: t - at - 1, fps: FPS, config: SPRING.land });
  const io = still ? 1 : tween(t, [at + 1, at + 3], [0, 1], EASE.out3);
  const { Icon } = d;
  if (opacity <= 0.01) return null;
  if (lite)
    return (
      <div
        style={{
          position: 'absolute',
          left: pad,
          bottom: pad - 4,
          fontFamily: FONT.body,
          fontWeight: 500,
          fontSize: 26,
          lineHeight: 1.25,
          letterSpacing: '-0.01em',
          color: C.ink,
          whiteSpace: 'nowrap',
        }}
      >
        {d.label}
      </div>
    );
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        padding: pad,
        opacity,
        filter: blur > 0.15 ? `blur(${blur.toFixed(2)}px)` : undefined,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: pad - 2,
          top: pad - 2,
          width: 44,
          height: 44,
          transform: `scale(${(0.45 + 0.55 * ip).toFixed(4)}) rotate(${((1 - ip) * -14).toFixed(2)}deg)`,
          opacity: io,
          color: C.ink,
        }}
      >
        <Icon size={44} strokeWidth={1.75} color={C.ink} />
      </div>
      <div
        style={{
          position: 'absolute',
          right: pad,
          top: pad,
          fontFamily: FONT.mono,
          fontSize: 20,
          lineHeight: '26px',
          fontWeight: 500,
          fontVariantNumeric: 'tabular-nums',
          color: C.violet,
        }}
      >
        {still ? d.n : <Rise text={d.n} t={t} at={at + 1} stagger={0.8} />}
      </div>
      <div
        style={{
          position: 'absolute',
          left: pad,
          right: pad,
          bottom: pad - 4,
          fontFamily: FONT.body,
          fontWeight: 500,
          fontSize: 26,
          lineHeight: 1.25,
          letterSpacing: '-0.01em',
          color: C.ink,
          whiteSpace: 'nowrap',
        }}
      >
        {still ? d.label : <Rise text={d.label} t={t} at={at + 2} stagger={0.9} unit="word" />}
      </div>
    </div>
  );
};

/** The dashed empty slot a card rises into (site after-call: 1 px dashed, ink 10 %). */
export const Slot: React.FC<{ r: Rect; inhale: number; opacity: number; radius?: number }> = ({
  r,
  inhale,
  opacity,
  radius = R.x2,
}) =>
  opacity <= 0.01 ? null : (
    <div
      style={{
        position: 'absolute',
        left: r.x,
        top: r.y,
        width: r.w,
        height: r.h,
        borderRadius: radius,
        border: `1.5px dashed rgba(24, 16, 40, ${(0.13 + 0.12 * inhale).toFixed(3)})`,
        background: `rgba(255,255,255,${(0.28 * inhale).toFixed(3)})`,
        boxSizing: 'border-box',
        transform: `scale(${(1 - 0.035 * inhale).toFixed(4)})`,
        opacity,
      }}
    />
  );

/** A language cell's content: label (with the live dot) and the greeting. */
export const LangContent: React.FC<{
  lang: Lang;
  lines: string[];
  t: number;
  /** the label rises as the cell arrives */
  labelAt: number;
  /** the greeting is spoken (8th-note reveal) */
  at: number;
  pad: number;
  fontSize: number;
  /** 0..1: the newest cell (live dot on) */
  live: number;
  opacity: number;
  /** 0..1 underline draw */
  underline: number;
  out?: number;
  blur?: number;
}> = ({ lang, lines, t, labelAt, at, pad, fontSize, live, opacity, underline, out, blur = 0 }) => {
  if (t < labelAt - 4 || opacity <= 0.01) return null;
  const toks = lines.map((l) => tokenize(l, !!lang.perChar, lang.disclose));
  const dot = t < at ? 0 : spring({ frame: t - at, fps: FPS, config: { stiffness: 320, damping: 12, mass: 0.7 } });
  const dotIn = tween(t, [labelAt, labelAt + 6], [0, 1], EASE.out3);
  // a dotted "waiting" rule where the line will be spoken (the site's dotted track)
  const wait = tween(t, [labelAt + 2, labelAt + 14], [0, 1], EASE.house) * (1 - tween(t, [at - 1, at + 4], [0, 1], EASE.in2));
  const on = live * dot;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity,
        filter: blur > 0.15 ? `blur(${blur.toFixed(2)}px)` : undefined,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: pad,
          top: pad - 2,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div style={{ position: 'relative', width: 10, height: 10 }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: 'rgba(24,16,40,0.16)',
              transform: `scale(${(0.4 + 0.6 * dotIn).toFixed(4)})`,
              opacity: dotIn,
            }}
          />
          {on > 0.001 ? (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: C.electric,
                transform: `scale(${on.toFixed(4)})`,
                boxShadow: `0 0 0 ${(4 * on).toFixed(2)}px rgba(124,58,237,0.14)`,
              }}
            />
          ) : null}
        </div>
        <div
          style={{
            fontFamily: FONT.body,
            fontWeight: 500,
            fontSize: 22,
            lineHeight: '30px',
            letterSpacing: TRACK.label,
            textTransform: 'uppercase',
            color: C.muted,
          }}
        >
          <Rise text={lang.name} t={t} at={labelAt} stagger={0.7} out={out} outStagger={0.3} />
        </div>
      </div>
      {wait > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: pad,
            bottom: pad + fontSize * 0.36,
            width: 150 * wait,
            height: 4,
            backgroundImage: 'radial-gradient(circle, rgba(24,16,40,0.26) 1.3px, transparent 1.9px)',
            backgroundSize: '10px 4px',
            backgroundRepeat: 'repeat-x',
            opacity: Math.min(1, wait * 1.5),
          }}
        />
      ) : null}
      {t >= at - 3 ? (
        <div
          style={{
            position: 'absolute',
            left: pad,
            right: pad,
            bottom: pad - fontSize * 0.08,
            fontFamily: FONT.cinema,
            fontWeight: 500,
            fontSize,
            lineHeight: 1.1,
            letterSpacing: '-0.005em',
            color: C.ink,
          }}
        >
          <Voice
            lines={toks}
            t={t}
            at={at}
            // site: min(0.02 s, 0.6/n) — per character for Japanese
            stagger={lang.perChar ? 0.5 : 0.9}
            rise={8}
            underline={underline}
            underlineColor={C.electric}
            out={out}
          />
        </div>
      ) : null}
    </div>
  );
};
