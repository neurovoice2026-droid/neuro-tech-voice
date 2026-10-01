/**
 * The #demo clock lockup, "03 ◉ 12": four figure columns (0.6em × 1.1em,
 * clipped) on strips of 0-9-0, with the orb as the colon.
 *
 * THE FOUR LIGHTS: the strips FLICK through the site's four moments — each
 * flick a full turn plus the difference (as the site spins its figures),
 * power3.inOut over a few frames after a short wind-back, landing with a
 * spring overshoot. Flicks are additive (chainPos), so a new one can leave
 * while the last one's overshoot is still settling.
 *
 * Only the cells near each strip's window are drawn. Vertical motion blur
 * is an SVG feGaussianBlur with stdDeviation "0 σ" (σ ∝ strip speed), so
 * the figures smear along their travel only.
 */
import React from 'react';
import { MeshOrb } from '../../components/MeshOrb';
import { C, FONT } from '../../theme';
import { rgba } from './color';

/* ── Flick curve ────────────────────────────────────────────────────── */

const inOut3 = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

/** One forward flick of a strip: `delta` cells, leaving at `start`, landing ON `land`. */
export type Flick = { start: number; land: number; delta: number };

/** Arrival speed in cells / frame → the size of the landing overshoot. */
const V_LAND = 0.1;
const OMEGA = (2 * Math.PI) / 9; // overshoot period ≈ 9 frames
const DECAY = 0.3;
const WIND = 0.07; // anticipation: the strip winds back 7 % of a cell
const WIND_FRAMES = 2;
/** Strip speed (cells / frame) below which no motion blur is drawn. */
const BLUR_FLOOR = 0.16;

/** Displacement (cells) one flick has added by frame f: wind-back, travel, overshoot + settle. */
export function flickDisp(f: number, { start, land, delta }: Flick): number {
  if (f <= start - WIND_FRAMES) return 0;
  if (f < start) {
    const t = (f - (start - WIND_FRAMES)) / WIND_FRAMES;
    return -WIND * Math.sin((t * Math.PI) / 2);
  }
  const D = delta + WIND;
  const dur = land - start;
  if (f < land) {
    const u = (f - start) / dur;
    // power3.inOut with a little linear mixed in, so the strip arrives with
    // speed V_LAND and a spring can carry it past the figure
    const m = Math.min(0.4, (V_LAND * dur) / D);
    return -WIND + D * ((1 - m) * inOut3(u) + m * u);
  }
  const tau = f - land;
  return delta + (V_LAND / OMEGA) * Math.exp(-DECAY * tau) * Math.sin(OMEGA * tau);
}

/** Strip position (cells, fractional) at frame f: `from` plus every flick so far. */
export const chainPos = (f: number, from: number, flicks: readonly Flick[]) =>
  flicks.reduce((p, k) => p + flickDisp(f, k), from);

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
  /** the figures' fill (a CSS gradient: the moment's `num`, on the dark) */
  fill: string;
}> = ({ pos, speed, fontSize, id, sheen, fill }) => {
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
              backgroundImage: sheenOn ? `${SHEEN}, ${fill}` : fill,
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
  /** strip position (cells) of column c at a (sub)frame */
  posAt: (col: number, frame: number) => number;
  /** fill per column (CSS gradient) */
  fills: readonly string[];
  /** sheen progress per figure (see Column) */
  sheens: number[];
  fontSize: number;
  orbSize: number;
  gap: number;
  /** 0..1 — pairs slide out from under the orb. */
  unfold: number;
  orbScale: number;
  orbTime: number;
  /** the colon orb's palette (the moment's light) */
  orbPalette: readonly string[];
  /** the light's glow: body (halo) and core (rim) */
  glowBody: string;
  glowCore: string;
  /** 0..1 extra light on the orb halo (ring flashes). */
  orbFlash: number;
  /** vertical nudge of the orb so it sits on the figures' optical centre */
  orbDy: number;
  figuresOpacity: number;
  orbOpacity: number;
}> = ({
  frame,
  posAt,
  fills,
  sheens,
  fontSize,
  orbSize,
  gap,
  unfold,
  orbScale,
  orbTime,
  orbPalette,
  glowBody,
  glowCore,
  orbFlash,
  orbDy,
  figuresOpacity,
  orbOpacity,
}) => {
  const cols = [0, 1, 2, 3].map((i) => {
    const pos = posAt(i, frame);
    const speed = posAt(i, frame + 0.5) - posAt(i, frame - 0.5);
    return (
      <Column
        key={i}
        pos={pos}
        speed={speed}
        fontSize={fontSize}
        id={`hook-vblur-${i}`}
        sheen={sheens[i]}
        fill={fills[i]}
      />
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
            background: `radial-gradient(closest-side, ${rgba(glowBody, (0.42 + orbFlash * 0.45) * orbOpacity)} 0%, ${rgba(glowBody, (0.14 + orbFlash * 0.2) * orbOpacity)} 45%, ${rgba(glowBody, 0)} 100%)`,
            transform: `scale(${0.85 + 0.35 * orbScale})`,
          }}
        />
        <MeshOrb
          size={orbSize}
          palette={orbPalette}
          time={orbTime}
          style={{
            transform: `scale(${orbScale.toFixed(4)})`,
            opacity: orbOpacity,
            boxShadow: `0 0 ${(10 + orbFlash * 26).toFixed(1)}px ${(orbFlash * 4).toFixed(1)}px ${rgba(glowCore, 0.35 + orbFlash * 0.4)}`,
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
