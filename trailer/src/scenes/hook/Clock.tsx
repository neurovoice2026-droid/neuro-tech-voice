/**
 * The #demo clock lockup, "03 ◉ 12": four figure columns (0.6em × 1.1em,
 * clipped) whose strips of 0-9-0 roll a full turn plus the difference
 * (power3.inOut, staggered per figure), with the orb as the colon.
 *
 * Only the cells near each strip's window are drawn. Vertical motion blur
 * is an SVG feGaussianBlur with stdDeviation "0 σ" (σ ∝ strip speed), so
 * the figures smear along their travel only.
 */
import React from 'react';
import { MeshOrb } from '../../components/MeshOrb';
import { C, CLOCK_FILL, FONT, ORB } from '../../theme';
import { rgba } from './color';

/* ── Roll curve ─────────────────────────────────────────────────────── */

const inOut3 = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

export type Roll = {
  from: number; // figure the strip stands on before the roll
  to: number; // absolute strip target (from + full turn + difference)
  start: number; // frame the roll leaves
  land: number; // frame it lands (overshoot starts here)
};

/** Arrival speed in cells / frame → the size of the landing overshoot. */
const V_LAND = 0.1;
const OMEGA = (2 * Math.PI) / 9; // overshoot period ≈ 9 frames
const DECAY = 0.3;
const WIND = 0.07; // anticipation: the strip winds back 7 % of a cell
const WIND_FRAMES = 3;
/** Strip speed (cells / frame) below which no motion blur is drawn. */
const BLUR_FLOOR = 0.16;

/** Strip position in cells (fractional) at frame f. */
export function rollPos(f: number, r: Roll): number {
  const { from, to, start, land } = r;
  if (f <= start - WIND_FRAMES) return from;
  if (f < start) {
    const t = (f - (start - WIND_FRAMES)) / WIND_FRAMES;
    return from - WIND * Math.sin((t * Math.PI) / 2);
  }
  const a = from - WIND;
  const D = to - a;
  const dur = land - start;
  if (f < land) {
    const u = (f - start) / dur;
    // power3.inOut with a little linear mixed in, so the strip arrives with
    // speed V_LAND and a spring can carry it past the figure.
    const m = Math.min(0.4, (V_LAND * dur) / D);
    return a + D * ((1 - m) * inOut3(u) + m * u);
  }
  const tau = f - land;
  return to + (V_LAND / OMEGA) * Math.exp(-DECAY * tau) * Math.sin(OMEGA * tau);
}

/* ── Figure column ──────────────────────────────────────────────────── */

const SHEEN =
  `linear-gradient(100deg, ${rgba(C.white, 0)} 40%, ${rgba(C.white, 0.95)} 50%, ${rgba(C.white, 0)} 58%)`;

const Column: React.FC<{
  pos: number;
  speed: number; // cells / frame
  fontSize: number;
  id: string;
  /** 0..1 progress of a light sweep across the figure (left → right); <0 or >1 = none */
  sheen: number;
}> = ({ pos, speed, fontSize, id, sheen }) => {
  const sheenOn = sheen > 0 && sheen < 1;
  const cellW = 0.6 * fontSize;
  const cellH = 1.1 * fontSize;
  const base = Math.floor(pos);
  // σ ≈ 0.2 × travel per frame (≈ a 180° shutter), capped so it stays a smear.
  // Below a settle threshold the shutter reads as sharp, so the land frame
  // (arrival ≈ V_LAND) and the overshoot are crisp — the click is on the beat.
  const sigma = Math.min(0.42 * cellH, 0.2 * Math.max(0, Math.abs(speed) - BLUR_FLOOR) * cellH);
  const blurOn = sigma > 0.4;
  const cells = [base - 1, base, base + 1, base + 2];
  return (
    <div
      style={{
        position: 'relative',
        width: cellW,
        height: cellH,
        overflow: 'hidden',
        // drum edge: figures fade as they enter/leave the window
        WebkitMaskImage:
          'linear-gradient(180deg, transparent 0%, #000 13%, #000 87%, transparent 100%)',
        maskImage: 'linear-gradient(180deg, transparent 0%, #000 13%, #000 87%, transparent 100%)',
      }}
    >
      {blurOn ? (
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
          <defs>
            <filter id={id} x="-10%" y="-60%" width="120%" height="220%" colorInterpolationFilters="sRGB">
              <feGaussianBlur stdDeviation={`0 ${sigma.toFixed(2)}`} />
            </filter>
          </defs>
        </svg>
      ) : null}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          filter: blurOn ? `url(#${id})` : undefined,
          // motion smear loses a little density
          opacity: 1 - Math.min(0.25, Math.abs(speed) * 0.08),
        }}
      >
        {cells.map((n) => (
          <span
            key={n}
            style={{
              position: 'absolute',
              left: 0,
              top: (n - pos) * cellH,
              width: cellW,
              height: cellH,
              lineHeight: `${cellH}px`,
              fontFamily: FONT.ui,
              fontWeight: 440,
              fontSize,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: 0,
              textAlign: 'center',
              backgroundImage: sheenOn ? `${SHEEN}, ${CLOCK_FILL}` : CLOCK_FILL,
              backgroundSize: sheenOn ? '300% 100%, 100% 100%' : '100% 100%',
              backgroundPosition: sheenOn ? `${((1 - sheen) * 100).toFixed(2)}% 0, 0 0` : undefined,
              backgroundRepeat: 'no-repeat',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              color: 'transparent',
            }}
          >
            {((n % 10) + 10) % 10}
          </span>
        ))}
      </div>
    </div>
  );
};

/* ── Lockup ─────────────────────────────────────────────────────────── */

export const ClockLockup: React.FC<{
  frame: number;
  rolls: Roll[]; // four
  /** sheen progress per figure (see Column) */
  sheens: number[];
  fontSize: number;
  orbSize: number;
  gap: number;
  /** 0..1 — pairs slide out from under the orb. */
  unfold: number;
  orbScale: number;
  orbTime: number;
  /** 0..1 extra light on the orb halo (ring flashes). */
  orbFlash: number;
  /** vertical nudge of the orb so it sits on the figures' optical centre */
  orbDy: number;
  figuresOpacity: number;
  orbOpacity: number;
}> = ({
  frame,
  rolls,
  sheens,
  fontSize,
  orbSize,
  gap,
  unfold,
  orbScale,
  orbTime,
  orbFlash,
  orbDy,
  figuresOpacity,
  orbOpacity,
}) => {
  const cols = rolls.map((r, i) => {
    const pos = rollPos(frame, r);
    const speed = rollPos(frame + 0.5, r) - rollPos(frame - 0.5, r);
    return (
      <Column key={i} pos={pos} speed={speed} fontSize={fontSize} id={`hook-vblur-${i}`} sheen={sheens[i]} />
    );
  });
  const slide = (1 - unfold) * (0.22 * fontSize);
  const halo = orbSize * 3.4;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      <div
        style={{
          display: 'flex',
          marginRight: gap,
          position: 'relative',
          zIndex: 1,
          transform: `translateX(${slide.toFixed(2)}px)`,
          opacity: figuresOpacity,
        }}
      >
        {cols[0]}
        {cols[1]}
      </div>
      <div style={{ position: 'relative', zIndex: 2, width: orbSize, height: orbSize, transform: `translateY(${orbDy}px)` }}>
        {/* halo — a gradient, not a filter */}
        <div
          style={{
            position: 'absolute',
            left: (orbSize - halo) / 2,
            top: (orbSize - halo) / 2,
            width: halo,
            height: halo,
            borderRadius: '50%',
            background: `radial-gradient(closest-side, ${rgba(C.electric, (0.42 + orbFlash * 0.45) * orbOpacity)} 0%, ${rgba(C.electric, (0.14 + orbFlash * 0.2) * orbOpacity)} 45%, ${rgba(C.electric, 0)} 100%)`,
            transform: `scale(${0.85 + 0.35 * orbScale})`,
          }}
        />
        <MeshOrb
          size={orbSize}
          palette={ORB.ink}
          time={orbTime}
          style={{
            transform: `scale(${orbScale.toFixed(4)})`,
            opacity: orbOpacity,
            boxShadow: `0 0 ${(10 + orbFlash * 26).toFixed(1)}px ${(orbFlash * 4).toFixed(1)}px ${rgba(C.lilac, 0.35 + orbFlash * 0.4)}`,
          }}
        />
      </div>
      <div
        style={{
          display: 'flex',
          marginLeft: gap,
          position: 'relative',
          zIndex: 1,
          transform: `translateX(${(-slide).toFixed(2)}px)`,
          opacity: figuresOpacity,
        }}
      >
        {cols[2]}
        {cols[3]}
      </div>
    </div>
  );
};
