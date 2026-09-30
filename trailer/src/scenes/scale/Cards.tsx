/**
 * The white cards of the white act (site: white, radius 21.6, SHADOW.card
 * plus a long soft drop), and what goes inside them: an industry (lucide
 * icon + label) or a language (label + the greeting in the cinema face,
 * the AI phrase big with the site's electric underline).
 */
import React from 'react';
import { C, FONT, R, TRACK } from '../../theme';
import { EASE, mixHex, tween } from '../../lib/motion';
import type { Industry, Lang } from './data';
import { underlined } from './data';
import type { Rect } from './geometry';
import { dspring } from './curves';

/** SHADOW.card + a long soft drop; `lift` 0..1 deepens it, `alpha` fades it */
export function cardShadow(lift = 0, alpha = 1): string {
  const l = Math.max(0, lift);
  const a = (x: number) => (x * alpha).toFixed(3);
  return (
    `0 0 0 1px rgb(24 16 40 / ${a(0.06)}), ` +
    `0 ${(14 + 10 * l).toFixed(1)}px ${(30 + 14 * l).toFixed(1)}px -20px rgb(24 16 40 / ${a(0.35 + 0.08 * l)}), ` +
    `0 ${(24 + 16 * l).toFixed(1)}px ${(48 + 24 * l).toFixed(1)}px -28px rgba(24,16,40,${a(0.25)})`
  );
}

export const Box: React.FC<{
  r: Rect;
  transform?: string;
  opacity?: number;
  lift?: number;
  shadowAlpha?: number;
  children?: React.ReactNode;
  radius?: number;
  bg?: string;
  z?: number;
  /** CSS filter (blur / a DirBlur url) */
  filter?: string;
  /** a 2 px ring inside the card (the live language cell) */
  ring?: string;
  origin?: string;
}> = ({ r, transform, opacity = 1, lift = 0, shadowAlpha = 1, children, radius = R.x2, bg = C.white, z, filter, ring, origin }) =>
  opacity <= 0.004 ? null : (
    <div
      style={{
        position: 'absolute',
        left: r.x,
        top: r.y,
        width: r.w,
        height: r.h,
        borderRadius: radius,
        background: bg,
        boxShadow: cardShadow(lift, shadowAlpha) + (ring ? `, inset 0 0 0 2px ${ring}` : ''),
        transform,
        transformOrigin: origin,
        opacity: opacity < 0.999 ? opacity : undefined,
        filter,
        overflow: 'hidden',
        zIndex: z,
      }}
    >
      {children}
    </div>
  );

/** the card fill on a pop: 15 % lilac on the tick, back to white over 4 f */
export const popFill = (t: number, tick: number) => {
  if (t < tick) return C.white;
  const k = 1 - tween(t, [tick, tick + 4], [0, 1], EASE.out3);
  return mixHex(C.white, C.lilac, 0.15 * k);
};

/** An industry card's face: the lucide icon (top-left) and its label (bottom-left). */
export const IndustryFace: React.FC<{
  d: Industry;
  t: number;
  /** the pop's start frame (content motion) */
  at: number;
  /** the tick frame (icon flash) */
  tick: number;
  pad: number;
  iconSize: number;
  labelSize: number;
  /** 0..1 the hero's violet lock flash */
  lock?: number;
  /** static: no inner motion (flyers, glides) */
  still?: boolean;
}> = ({ d, t, at, tick, pad, iconSize, labelSize, lock = 0, still = false }) => {
  const { Icon } = d;
  // the icon flashes electric on its tick (+ glow), back to ink by +5
  const fk = t < tick ? 0 : 1 - tween(t, [tick, tick + 5], [0, 1], EASE.out3);
  const col = lock > fk ? mixHex(C.ink, C.violet, lock) : mixHex(C.ink, C.electric, fk);
  const glow = Math.max(fk, lock);
  // follow-through: the icon settles a frame after the card (rotate + scale)
  const ip = still ? 1 : dspring(t - at + 1, { stiffness: 520, damping: 18, mass: 0.6 });
  const words = d.label.split(' ');
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: pad - iconSize * 0.06,
          top: pad - iconSize * 0.06,
          width: iconSize,
          height: iconSize,
          transform: still ? undefined : `rotate(${((1 - ip) * -12).toFixed(2)}deg) scale(${(0.78 + 0.22 * ip).toFixed(4)})`,
          transformOrigin: '30% 30%',
          filter: glow > 0.01 ? `drop-shadow(0 0 28px rgba(124,58,237,${(0.7 * glow).toFixed(3)}))` : undefined,
        }}
      >
        <Icon size={iconSize} strokeWidth={2.25} color={col} absoluteStrokeWidth={false} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: pad,
          right: pad,
          bottom: pad - labelSize * 0.12,
          fontFamily: FONT.body,
          fontWeight: 500,
          fontSize: labelSize,
          lineHeight: 1.12,
          letterSpacing: '-0.012em',
          color: C.ink,
          textWrap: 'balance',
        }}
      >
        {words.map((w, j) => {
          // each word settles 0.8 f after the last (visible from the first frame: never an empty card)
          const p = still ? 1 : dspring(t - at + 1.2 - 0.8 * j, { stiffness: 600, damping: 20, mass: 0.6 });
          return (
            <React.Fragment key={j}>
              <span style={{ display: 'inline-block', transform: p < 0.999 ? `translateY(${((1 - p) * labelSize * 0.45).toFixed(2)}px)` : undefined }}>
                {w}
              </span>
              {j < words.length - 1 ? ' ' : null}
            </React.Fragment>
          );
        })}
      </div>
    </>
  );
};

/** A language cell's face: the language (label), the greeting (AI phrase big, underlined). */
export const LangFace: React.FC<{
  lang: Lang;
  /** the AI-phrase lines for this orientation */
  ai: string[];
  t: number;
  /** the flip frame (Japanese reveals per character from here) */
  at: number;
  pad: number;
  labelSize: number;
  leadSize: number;
  aiSize: number;
  /** 0..1 the underline draw */
  underline: number;
}> = ({ lang, ai, t, at, pad, labelSize, leadSize, aiSize, underline }) => {
  const n = ai.length;
  // Japanese: per character (the site's voice reveal), from the landing of the flip
  let ci = 0;
  const chars = (s: string) =>
    Array.from(s).map((ch, i) => {
      const s0 = at + 3 + 0.45 * ci++;
      const p = t < s0 ? 0 : dspring(t - s0, { stiffness: 420, damping: 24, mass: 0.8 });
      const o = tween(t, [s0, s0 + 3], [0, 1], EASE.out3);
      const bl = tween(t, [s0, s0 + 5], [3, 0], EASE.out3);
      return (
        <span
          key={i}
          style={{
            display: 'inline-block',
            opacity: o,
            transform: `translateY(${((1 - p) * 10).toFixed(2)}px)`,
            filter: bl > 0.1 && o > 0 ? `blur(${bl.toFixed(2)}px)` : undefined,
          }}
        >
          {ch}
        </span>
      );
    });
  const text = (s: string) => (lang.perChar ? chars(s) : s);
  const aiBlock = ai.map((line, j) => {
    const u = underlined(line);
    const rest = line.slice(u.length);
    const draw = Math.min(1, Math.max(0, underline * n - j));
    return (
      <div key={`ai-${j}`} style={{ fontSize: aiSize, lineHeight: 1.02, whiteSpace: 'nowrap' }}>
        <span style={{ position: 'relative', display: 'inline-block' }}>
          {text(u)}
          {draw > 0 ? (
            <span
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: lang.perChar ? -aiSize * 0.02 : aiSize * 0.02,
                height: 4,
                borderRadius: 2,
                background: C.electric,
                transform: `scaleX(${draw.toFixed(4)})`,
                transformOrigin: '0 50%',
              }}
            />
          ) : null}
        </span>
        {rest ? text(rest) : null}
      </div>
    );
  });
  const lead = (
    <div key="lead" style={{ fontSize: leadSize, lineHeight: 1.1, whiteSpace: 'nowrap', marginBottom: lang.aiFirst ? 0 : leadSize * 0.1, marginTop: lang.aiFirst ? leadSize * 0.18 : 0 }}>
      {text(lang.lead)}
    </div>
  );
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: pad,
          top: pad - 2,
          fontFamily: FONT.body,
          fontWeight: 500,
          fontSize: labelSize,
          lineHeight: 1,
          letterSpacing: TRACK.label,
          textTransform: 'uppercase',
          color: C.muted,
          whiteSpace: 'nowrap',
        }}
      >
        {lang.name}
      </div>
      <div
        style={{
          position: 'absolute',
          left: pad,
          right: pad,
          bottom: pad - aiSize * 0.1,
          fontFamily: FONT.cinema,
          fontWeight: 500,
          letterSpacing: '-0.005em',
          color: C.ink,
        }}
      >
        {lang.aiFirst ? [...aiBlock, lead] : [lead, ...aiBlock]}
      </div>
    </>
  );
};
