/**
 * The split: a hairline with a CornerDot bead riding its tip, the owner
 * (the site's owner row — tile + lucide Moon + "THE OWNER" — at film
 * scale) and the two words, "Asleep." / "Booked.", in the owner row's
 * headline face (Instrument Sans 520), each letter rising out of its own
 * mask with anticipation, overshoot and velocity blur.
 */
import React from 'react';
import { Moon } from 'lucide-react';
import { CornerDot } from '../../components/Type';
import { aos, breathe, EASE, SPRING, tween } from '../../lib/motion';
import { C, FONT, TRACK } from '../../theme';

/** Per-letter rise + blur-in for small uppercase labels. */
export const Letters: React.FC<{
  text: string;
  t: number;
  start: number;
  step?: number;
  style?: React.CSSProperties;
}> = ({ text, t, start, step = 0.8, style }) => (
  <div style={{ display: 'flex', whiteSpace: 'pre', ...style }}>
    {text.split('').map((ch, i) => {
      const at = start + i * step;
      const p = aos(t, at, { anticip: 2, depth: 0.12, config: SPRING.pop });
      const o = Math.min(1, Math.max(0, p * 1.3));
      const blur = tween(t, [at, at + 7], [3, 0], EASE.house);
      return (
        <span
          key={i}
          style={{
            display: 'inline-block',
            opacity: o,
            transform: `translateY(${((1 - p) * 0.45).toFixed(3)}em)`,
            filter: blur > 0.1 ? `blur(${blur.toFixed(2)}px)` : undefined,
          }}
        >
          {ch}
        </span>
      );
    })}
  </div>
);

/**
 * A display word whose letters rise out of masks; the middle of the word
 * lands on `land` (the site spring first crosses 1 ≈ 5 frames after it
 * starts, so each letter starts 5 frames ahead of its landing).
 */
export const LetterRise: React.FC<{
  text: string;
  t: number;
  land: number;
  size: number;
  color: string;
  stagger?: number;
  style?: React.CSSProperties;
}> = ({ text, t, land, size, color, stagger = 1.3, style }) => {
  const chars = text.split('');
  const n = chars.length;
  return (
    <div
      style={{
        display: 'flex',
        fontFamily: FONT.ui,
        fontWeight: 520,
        fontSize: size,
        lineHeight: 1,
        letterSpacing: TRACK.section,
        color,
        whiteSpace: 'pre',
        ...style,
      }}
    >
      {chars.map((ch, i) => {
        const s = land - 5 - ((n - 1) / 2) * stagger + i * stagger;
        const cfg = SPRING.site;
        const p = aos(t, s, { anticip: 3, depth: 0.07, config: cfg });
        const pp = aos(t - 1, s, { anticip: 3, depth: 0.07, config: cfg });
        const y = (1 - p) * 108;
        const speed = Math.abs(p - pp) * size * 1.08;
        const blur = tween(t, [s, s + 10], [4, 0], EASE.house) + Math.min(9, speed * 0.07);
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              overflow: 'hidden',
              padding: '0.04em 0.05em 0.2em',
              margin: '-0.04em -0.05em -0.2em',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                transform: `translateY(${y.toFixed(2)}%) scaleY(${(1 + Math.min(0.08, speed * 0.0009)).toFixed(4)})`,
                transformOrigin: '50% 100%',
                filter: blur > 0.1 ? `blur(${blur.toFixed(2)}px)` : undefined,
              }}
            >
              {ch}
            </span>
          </span>
        );
      })}
    </div>
  );
};

/** The owner row: 96px tile (white/.08) + lucide Moon (lilac, 1.75), label. */
export const Owner: React.FC<{
  t: number;
  x: number;
  y: number;
  start: number;
  /** the night light over the owner's half (screen centre + size) */
  night: { x: number; y: number; w: number; h: number };
}> = ({ t, x, y, start, night }) => {
  if (t < start - 3) return null;
  const pop = aos(t, start, { anticip: 3, depth: 0.12, config: SPRING.pop });
  const moonIn = aos(t, start + 3, { anticip: 2, depth: 0.2, config: SPRING.land });
  const b = breathe(t, 64, 1);
  const b2 = breathe(t, 64, 1, 1.1);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: 'translateY(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 28,
      }}
    >
      <div style={{ position: 'relative', width: 96, height: 96, flex: 'none' }}>
        {/* the night: a wide, faint window light over the owner's half */}
        <div
          style={{
            position: 'absolute',
            left: night.x - x - night.w / 2,
            top: night.y - y + 48 - night.h / 2,
            width: night.w,
            height: night.h,
            background: `radial-gradient(closest-side, rgba(185,163,255,${(0.085 + 0.015 * b2).toFixed(3)}), rgba(185,163,255,0.03) 55%, rgba(185,163,255,0))`,
            opacity: tween(t, [start - 2, start + 24], [0, 1], EASE.inOut),
          }}
        />
        {/* moonlight */}
        <div
          style={{
            position: 'absolute',
            left: -110,
            top: -110,
            width: 316,
            height: 316,
            background: `radial-gradient(closest-side, rgba(185,163,255,${(0.16 + 0.05 * b2).toFixed(3)}), rgba(185,163,255,0))`,
            opacity: Math.min(1, Math.max(0, pop)),
          }}
        />
        {/* slow breathing rings (the call's rings, at a sleeper's pace) */}
        {[0, 1].map((i) => {
          const cyc = 72;
          const age = t - start - 4 - i * (cyc / 2);
          if (age < 0) return null;
          const k = (age % cyc) / cyc;
          const e = EASE.out3(k);
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                boxShadow: 'inset 0 0 0 1.5px rgba(185,163,255,1)',
                transform: `scale(${(1 + 1.1 * e).toFixed(4)})`,
                opacity: 0.26 * Math.pow(1 - k, 1.6) * Math.min(1, age / 6),
              }}
            />
          );
        })}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.06)',
            transform: `scale(${Math.max(0, 0.55 + 0.45 * pop).toFixed(4)})`,
            opacity: Math.min(1, Math.max(0, pop * 1.5)),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              transform: `rotate(${(-14 * (1 - moonIn) - 6 + 3 * b).toFixed(3)}deg) scale(${(
                Math.max(0, moonIn) *
                (1 + 0.035 * b)
              ).toFixed(4)})`,
              display: 'flex',
              filter: `drop-shadow(0 0 ${(8 + 4 * b2).toFixed(2)}px rgba(185,163,255,0.45))`,
            }}
          >
            <Moon size={42} color={C.lilac} strokeWidth={1.75} />
          </div>
        </div>
      </div>
      <Letters
        text="THE OWNER"
        t={t}
        start={start + 3}
        step={0.7}
        style={{ fontFamily: FONT.body, fontWeight: 500, fontSize: 24, letterSpacing: TRACK.label, color: C.paperDim, lineHeight: 1 }}
      />
    </div>
  );
};

/** The split hairline, drawn with a CornerDot bead riding its tip. */
const DRAW = { stiffness: 95, damping: 15, mass: 1 };
export const Divider: React.FC<{
  t: number;
  start: number;
  vertical: boolean;
  at: number;
  from: number;
  to: number;
}> = ({ t, start, vertical, at, from, to }) => {
  if (t < start - 3) return null;
  const drawAt = (tt: number) => aos(tt, start, { anticip: 3, depth: 0.015, config: DRAW });
  const e = drawAt(t);
  const span = to - from;
  const len = Math.min(span + 6, span * Math.max(0, e));
  const tip = from + span * Math.max(0, e);
  const speed = Math.abs(drawAt(t + 0.5) - drawAt(t - 0.5)) * span;
  const bead = Math.min(1.15, Math.max(0, aos(t, start, { anticip: 3, depth: 0.2, config: SPRING.pop })));
  const headLen = Math.min(len, 200);
  const line: React.CSSProperties = vertical
    ? { left: at - 0.75, top: from, width: 1.5, height: len }
    : { left: from, top: at - 0.75, width: len, height: 1.5 };
  const head: React.CSSProperties = vertical
    ? { left: at - 1, top: from + len - headLen, width: 2, height: headLen }
    : { left: from + len - headLen, top: at - 1, width: headLen, height: 2 };
  const dir = vertical ? '180deg' : '90deg';
  const heat = Math.min(1, speed / 8 + 0.2) * (1 - tween(t, [start + 14, start + 30], [0, 1], EASE.inOut) * 0.85);
  const stretch = 1 + Math.min(0.35, speed / 90);
  return (
    <>
      {len > 0.5 ? (
        <>
          <div
            style={{
              position: 'absolute',
              ...line,
              background: `linear-gradient(${dir}, rgba(237,236,241,0), rgba(237,236,241,0.2) 10%, rgba(237,236,241,0.2) 90%, rgba(237,236,241,0.05))`,
            }}
          />
          {/* the hot head of the stroke, cooling behind the bead */}
          <div
            style={{
              position: 'absolute',
              ...head,
              background: `linear-gradient(${dir}, rgba(237,236,241,0), rgba(237,236,241,${(0.6 * heat).toFixed(3)}))`,
            }}
          />
        </>
      ) : null}
      {/* bead: the site's CornerDot, stretched a touch along the stroke by its speed */}
      <div
        style={{
          position: 'absolute',
          left: vertical ? at : tip,
          top: vertical ? tip : at,
          transform: `translate(-50%, -50%) ${vertical ? `scaleY(${stretch.toFixed(3)})` : `scaleX(${stretch.toFixed(3)})`} scale(${bead.toFixed(3)})`,
          filter: 'drop-shadow(0 0 8px rgba(185,163,255,0.7))',
        }}
      >
        <CornerDot size={18} color={C.paper} />
      </div>
    </>
  );
};
