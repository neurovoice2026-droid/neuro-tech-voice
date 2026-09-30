/**
 * Film grain over the whole frame — the site's "35mm grain" (.cover-grain):
 * feTurbulence fractalNoise, baseFrequency 0.8, 3 octaves, desaturated,
 * overlay at 0.15. Re-seeded every frame (12-seed cycle) and jittered so it
 * reads as film, not as a static texture.
 */
import React from 'react';
import { AbsoluteFill, random, useCurrentFrame } from 'remotion';

const tile = (seed: number, freq: number) =>
  `url("data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='3' seed='${seed}' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='256' height='256' filter='url(#g)'/></svg>`,
  )}")`;

export const Grain: React.FC<{
  opacity?: number;
  blend?: React.CSSProperties['mixBlendMode'];
  freq?: number;
  /** Override the frame (e.g. to freeze grain). */
  frame?: number;
}> = ({ opacity = 0.15, blend = 'overlay', freq = 0.8, frame: f }) => {
  const current = useCurrentFrame();
  const frame = f ?? current;
  const seed = frame % 12;
  const x = Math.floor(random(`gx${frame}`) * 256);
  const y = Math.floor(random(`gy${frame}`) * 256);
  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        backgroundImage: tile(seed, freq),
        backgroundSize: '256px 256px',
        backgroundPosition: `${x}px ${y}px`,
        mixBlendMode: blend,
        opacity,
      }}
    />
  );
};

/** Soft edge falloff — the cover's vignette (hero.tsx wash, second radial). */
export const Vignette: React.FC<{ strength?: number; color?: string }> = ({
  strength = 1,
  color = '6,4,10',
}) => (
  <AbsoluteFill
    style={{
      pointerEvents: 'none',
      background: `radial-gradient(105% 88% at 50% 46%, transparent 34%, rgba(${color},${0.55 * strength}) 76%, rgba(${color},${0.92 * strength}) 100%)`,
    }}
  />
);
