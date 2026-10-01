/**
 * Film grain — the site's "35mm grain" (.cover-grain: feTurbulence
 * fractalNoise, desaturated), refined for a 120 fps master: finer (2
 * octaves, ~1 px), subtler, and re-seeded on EVERY render frame (16 tiles,
 * offset per frame), so at 120 fps it reads as a fine, living texture rather
 * than a pattern. Grain is genuinely discrete per frame — it is texture, not
 * motion.
 *
 * <FilmGrain white={0..1}> is the film's finishing pass (Trailer, devRoot,
 * specimen): overlay grain on the dark, a whisper of multiply on paper, and a
 * sparse DITHER on the dark (<Dither>) — overlay/soft-light vanish on
 * near-black, and without it the night rooms' gradients come out of x264
 * (CRF 14) as 1-level rings. Measured on the night room through the real
 * encode: std ≈ 2.2 code values, no plateau > 8 px, black lifted < 1 level.
 */
import React from 'react';
import { AbsoluteFill, random, useCurrentFrame } from 'remotion';

const TILES = 16;
/** the dark dither's opacity (sparse tile), measured through x264 CRF 14: .035 still rings, .05 is clean */
const DITHER = 0.05;
const tile = (seed: number, freq: number, octaves: number, size: number) =>
  `url("data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='${octaves}' seed='${seed}' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='${size}' height='${size}' filter='url(#g)'/></svg>`,
  )}")`;

/**
 * A SPARSE dither tile: 1-octave noise pushed through a steep transfer curve, so most pixels
 * are 0 and a scattered few are bright. Screened on near-black at low opacity it breaks the
 * gradients' 1-level steps (which survive x264 as rings otherwise) while lifting the black
 * far less than mid-grey noise would (a screen layer can only add).
 */
const ditherTile = (seed: number, size: number, slope: number) =>
  `url("data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'><filter id='d' color-interpolation-filters='sRGB'><feTurbulence type='fractalNoise' baseFrequency='0.95' numOctaves='1' seed='${seed}' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncR type='linear' slope='${slope}' intercept='${(-slope * 0.5).toFixed(3)}'/><feFuncG type='linear' slope='${slope}' intercept='${(-slope * 0.5).toFixed(3)}'/><feFuncB type='linear' slope='${slope}' intercept='${(-slope * 0.5).toFixed(3)}'/><feFuncA type='linear' slope='0' intercept='1'/></feComponentTransfer></filter><rect width='${size}' height='${size}' filter='url(#d)'/></svg>`,
  )}")`;

/** The dark dither (see ditherTile): screen-blended, re-seeded every render frame. */
export const Dither: React.FC<{ opacity?: number; slope?: number; frame?: number }> = ({ opacity = 0.16, slope = 3.2, frame: f }) => {
  const current = useCurrentFrame();
  const frame = f ?? current;
  if (opacity <= 0.0005) return null;
  const size = 256;
  const s = Math.floor(random(`ds${frame}`) * TILES);
  const x = Math.floor(random(`dx${frame}`) * size);
  const y = Math.floor(random(`dy${frame}`) * size);
  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        backgroundImage: ditherTile(s, size, slope),
        backgroundSize: `${size}px ${size}px`,
        backgroundPosition: `${x}px ${y}px`,
        mixBlendMode: 'screen',
        opacity,
      }}
    />
  );
};

export const Grain: React.FC<{
  opacity?: number;
  blend?: React.CSSProperties['mixBlendMode'];
  /** feTurbulence baseFrequency (cycles / px): .92 ≈ 1 px grain */
  freq?: number;
  octaves?: number;
  /** tile size, px */
  size?: number;
  /** Override the RENDER frame (e.g. to freeze grain). */
  frame?: number;
  /** a different stream (two grain layers must not share one) */
  seed?: string;
}> = ({ opacity = 0.1, blend = 'overlay', freq = 0.92, octaves = 2, size = 256, frame: f, seed = 'g' }) => {
  const current = useCurrentFrame();
  const frame = f ?? current;
  if (opacity <= 0.0005) return null;
  const s = Math.floor(random(`${seed}s${frame}`) * TILES);
  const x = Math.floor(random(`${seed}x${frame}`) * size);
  const y = Math.floor(random(`${seed}y${frame}`) * size);
  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        backgroundImage: tile(s, freq, octaves, size),
        backgroundSize: `${size}px ${size}px`,
        backgroundPosition: `${x}px ${y}px`,
        mixBlendMode: blend,
        opacity,
      }}
    />
  );
};

/**
 * The finishing grain for the whole film. `white` 0..1 = how much of the frame is the white
 * act (paper): overlay grain on the dark, multiply on paper, the dark dither always.
 */
export const FilmGrain: React.FC<{ white?: number; strength?: number }> = ({ white = 0, strength = 1 }) => {
  const w = Math.min(1, Math.max(0, white));
  return (
    <>
      <Grain opacity={0.1 * strength * (1 - w)} blend="overlay" seed="ov" />
      {/* on white, overlay grain would vanish; a whisper of multiply keeps the film texture */}
      <Grain opacity={0.035 * strength * w} blend="multiply" seed="mu" />
      {/* the dark dither: breaks the night gradients' 1-level steps so they survive the encode (nothing visible on paper) */}
      <Dither opacity={DITHER * (1 - w)} />
    </>
  );
};

/** Soft edge falloff — the cover's vignette (hero.tsx wash, second radial), with smooth stops. */
export const Vignette: React.FC<{ strength?: number; color?: string }> = ({
  strength = 1,
  color = '6,4,10',
}) => {
  const stops: string[] = [];
  for (let i = 0; i <= 10; i++) {
    const r = 0.34 + (i / 10) * 0.66;
    const u = (r - 0.34) / 0.66;
    const a = 0.92 * strength * (u * u * (3 - 2 * u)) ** 1.15;
    stops.push(`rgba(${color},${a.toFixed(4)}) ${(r * 100).toFixed(1)}%`);
  }
  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        background: `radial-gradient(105% 88% at 50% 46%, transparent 0%, ${stops.join(', ')})`,
      }}
    />
  );
};
