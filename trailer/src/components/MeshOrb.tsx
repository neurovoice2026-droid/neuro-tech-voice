/**
 * The site's CSS mesh orb (.pp-orb-mesh in app/globals.css): five blurred
 * colour fields drifting inside a sphere, lit from the top left, under a
 * film of grain. Cheap — use it for small orbs / dots and as the WebGL
 * fallback. `time` is in seconds.
 */
import React from 'react';

export const MeshOrb: React.FC<{
  size: number;
  palette: readonly string[]; // [m0 darkest … m4 lightest]
  time: number;
  style?: React.CSSProperties;
}> = ({ size, palette, time, style }) => {
  const [m0, m1, m2, m3, m4] = palette;
  // 14 s alternate drift, 21 s reverse turn — as in the site's keyframes
  const phase = (time % 28) / 14;
  const k = phase <= 1 ? phase : 2 - phase;
  const e = k * k * (3 - 2 * k);
  const drift = `rotate(${e * 280}deg) scale(${1 + Math.sin(e * Math.PI) * 0.12}) translate(${
    (e < 0.5 ? e * 8 : 4 - (e - 0.5) * 14).toFixed(2)
  }%, ${(e < 0.5 ? -e * 6 : -3 + (e - 0.5) * 14).toFixed(2)}%)`;
  const turn = `rotate(${-((time / 21) * 360) % 360}deg)`;
  const blur = Math.max(0.6, size * 0.035);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        position: 'relative',
        isolation: 'isolate',
        background: m2,
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '-20%',
          background: `radial-gradient(42% 42% at 26% 24%, ${m4} 0%, transparent 100%),
            radial-gradient(40% 40% at 80% 26%, ${m2} 0%, transparent 100%),
            radial-gradient(46% 46% at 76% 80%, ${m0} 0%, transparent 100%),
            radial-gradient(40% 40% at 20% 78%, ${m3} 0%, transparent 100%),
            radial-gradient(28% 28% at 50% 52%, ${m1} 0%, transparent 100%), ${m2}`,
          filter: `blur(${blur}px) saturate(1.35)`,
          transform: drift,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: '-20%',
          background: `radial-gradient(22% 22% at 62% 40%, ${m4} 0%, transparent 100%),
            radial-gradient(24% 24% at 34% 56%, ${m1} 0%, transparent 100%)`,
          opacity: 0.75,
          filter: `blur(${blur * 1.15}px)`,
          transform: turn,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: `radial-gradient(circle at 30% 24%, rgb(255 255 255 / 0.22) 0%, rgb(255 255 255 / 0) 30%),
            radial-gradient(circle at 50% 44%, transparent 58%, color-mix(in oklab, ${m0} 55%, transparent) 100%)`,
          boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 0.12)',
        }}
      />
    </div>
  );
};
