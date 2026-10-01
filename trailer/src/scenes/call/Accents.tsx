/**
 * The call's pop-out vocabulary — every entrance, hit and exit is built
 * from these, so the scene speaks one motion language:
 *
 *   popScale     appear → anticipation (a 2–3 f shrink of the seed) → the
 *                overshoot PEAKS ON the hit frame → a damped settle (≈ 10 f)
 *   exitCurve    anticipation (a 2–3 f counter-move) → a fast power-in exit
 *   Sparks       a deterministic burst of light streaks (length ∝ speed:
 *                their own motion blur), decelerating, cooling, gone
 *   RingPulse    an outline that leaves an element on its hit (out-curve)
 *   glintBg      a light band sweeping across a box (background layers)
 *   Flare        a short horizontal streak of light (a line connecting)
 *
 * All pure functions of the frame; positions in screen px.
 */
import React from 'react';
import { random } from 'remotion';
import { rgba } from '../../lib/lights';
import { EASE, SPRING, springAt, tween } from '../../lib/motion';

/** The pop: hidden before hit − anticip; a seed at `from` that shrinks 8 % (the anticipation);
 *  it bursts over the last 2 frames (1 with anticip 1) to `peak` exactly ON the hit frame;
 *  then the pop spring settles it to 1 (one small undershoot, ≈ 10 f). */
export function popScale(t: number, hit: number, peak = 1.12, { from = 0.55, anticip = 3 } = {}): number {
  if (t < hit - anticip) return 0;
  const g = Math.min(2, anticip); // burst frames
  const seedF = anticip - g; // seed frames before the burst
  const s0 = from * (seedF > 0 ? 0.92 : 1);
  if (t < hit - g) return from * (1 - 0.08 * EASE.inOut((t - (hit - anticip)) / Math.max(1, seedF)));
  if (t < hit) return s0 + (peak - s0) * EASE.inOut((t - (hit - g)) / g);
  return peak + (1 - peak) * springAt(t, hit, SPRING.pop);
}

/** Opacity of a pop: the seed fades in over the anticipation, full on the hit frame. */
export const popOpacity = (t: number, hit: number, anticip = 3) =>
  t < hit - anticip ? 0 : t >= hit ? 1 : 0.35 + 0.65 * EASE.out3((t - (hit - anticip)) / anticip);

/** An exit: 0 until `at − anticip`; dips to −`dip` (the counter-move) at `at`; then a power-in run to 1 over `dur`. */
export function exitCurve(t: number, at: number, dur: number, { anticip = 3, dip = 0.06 } = {}): number {
  if (t < at - anticip) return 0;
  if (t < at) return -dip * Math.sin(((t - (at - anticip)) / anticip) * (Math.PI / 2));
  const u = Math.min(1, (t - at) / dur);
  // leave the dip, then accelerate out (power2.in)
  return -dip * (1 - u) * (1 - u) + EASE.in2(u);
}

/** A light band sweeping across a box once (p 0 → 1, left → right); spread under a fill with `, `. */
export function glintBg(p: number, a = 0.85, angle = 104): { layer: string; size: string; pos: string } | null {
  if (p <= 0 || p >= 1) return null;
  return {
    layer: `linear-gradient(${angle}deg, rgba(255,255,255,0) 38%, rgba(255,255,255,${a.toFixed(3)}) 50%, rgba(255,255,255,0) 62%)`,
    size: '320% 100%',
    pos: `${((1 - p) * 100).toFixed(2)}% 0`,
  };
}

export type SparkOpts = {
  t: number;
  at: number;
  x: number;
  y: number;
  /** hex */
  color: string;
  /** hex, the hot head (default white-ish) */
  hot?: string;
  n?: number;
  /** start radius (px) — sparks leave from an ellipse rx × ry */
  rx: number;
  ry?: number;
  /** travel (px) */
  reach: number;
  life?: number;
  /** streak thickness (px) */
  size?: number;
  seed: string;
  /** angle range (deg, 0 = right, 90 = down) */
  arc?: readonly [number, number];
  /** gravity (px over the life, downward) */
  fall?: number;
};

/** A burst of streaks: each leaves the ellipse on its own angle, decelerates (out3), shortens and fades. */
export const Sparks: React.FC<SparkOpts> = ({
  t,
  at,
  x,
  y,
  color,
  hot = '#ffffff',
  n = 10,
  rx,
  ry = rx,
  reach,
  life = 14,
  size = 3,
  seed,
  arc = [0, 360],
  fall = 0,
}) => {
  if (t < at || t > at + life * 1.3) return null;
  const out: React.ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const r = (k: string) => random(`${seed}-${i}-${k}`);
    const ang = ((arc[0] + ((arc[1] - arc[0]) * (i + 0.5 + 0.7 * (r('a') - 0.5))) / n) * Math.PI) / 180;
    const L = life * (0.75 + 0.5 * r('l'));
    // on the hit frame a spark is already ~0.7 f out, so the burst reads as streaks, not as a dotted outline
    const u = (t - at + 0.7) / L;
    if (u >= 1) continue;
    const go = 0.65 + 0.6 * r('g');
    const pos = (uu: number) => {
      const e = EASE.out3(Math.min(1, Math.max(0, uu)));
      return {
        x: x + Math.cos(ang) * (rx + reach * go * e),
        y: y + Math.sin(ang) * (ry + reach * go * e * (ry / rx)) + fall * uu * uu,
      };
    };
    const p = pos(u);
    const q = pos(u - 0.9 / L); // where it was ~1 frame ago: the streak's tail (motion blur)
    const len = Math.max(size * 1.4, Math.hypot(p.x - q.x, p.y - q.y) * 1.25);
    const rot = (Math.atan2(p.y - q.y, p.x - q.x) * 180) / Math.PI;
    const op = Math.pow(1 - u, 1.4);
    const th = size * (0.7 + 0.6 * r('s')) * (1 - 0.5 * u);
    out.push(
      <div
        key={i}
        style={{
          position: 'absolute',
          left: p.x - len,
          top: p.y - th / 2,
          width: len,
          height: th,
          borderRadius: th,
          transformOrigin: '100% 50%',
          transform: `rotate(${rot.toFixed(2)}deg)`,
          background: `linear-gradient(90deg, ${rgba(color, 0)} 0%, ${rgba(color, 0.9 * op)} 62%, ${rgba(hot, op)} 100%)`,
          boxShadow: `0 0 ${(th * 3).toFixed(1)}px ${rgba(color, 0.6 * op)}`,
        }}
      />,
    );
  }
  return <>{out}</>;
};

/** An outline leaving a box on its hit: scale 1 → `grow` (out3), fading; a soft glow. */
export const RingPulse: React.FC<{
  t: number;
  at: number;
  x: number;
  y: number;
  w: number;
  h: number;
  radius: number;
  /** hex */
  color: string;
  grow?: number;
  life?: number;
  width?: number;
  alpha?: number;
}> = ({ t, at, x, y, w, h, radius, color, grow = 1.6, life = 12, width = 2, alpha = 0.9 }) => {
  if (t < at || t > at + life) return null;
  const e = EASE.out3((t - at) / life);
  const op = alpha * (1 - e) * tween(t, [at, at + 1], [0.4, 1], EASE.out3);
  if (op <= 0.003) return null;
  // grow by the same number of px on both axes (a pill keeps its shape)
  const px = (Math.min(w, h) * (grow - 1) * e) / 2;
  return (
    <div
      style={{
        position: 'absolute',
        left: x - w / 2 - px,
        top: y - h / 2 - px,
        width: w + 2 * px,
        height: h + 2 * px,
        borderRadius: radius + px,
        boxShadow: `inset 0 0 0 ${(width * (1 - 0.5 * e)).toFixed(2)}px ${rgba(color, op)}, 0 0 ${(14 + 10 * e).toFixed(1)}px ${rgba(color, 0.35 * op)}`,
      }}
    />
  );
};

/** A short horizontal streak of light (the phone line connecting): grows from the centre (or out from
 *  its start, `anchor: 'start'` — x is then its left end), then thins and fades. */
export const Flare: React.FC<{
  t: number;
  at: number;
  x: number;
  y: number;
  w: number;
  color: string;
  life?: number;
  anchor?: 'center' | 'start';
}> = ({ t, at, x, y, w, color, life = 9, anchor = 'center' }) => {
  if (t < at - 1 || t > at + life) return null;
  const u = Math.max(0, (t - at + 1) / (life + 1));
  const grow = EASE.out3(Math.min(1, u * 2.2));
  const op = Math.pow(1 - u, 1.3);
  const W = w * (0.2 + 0.8 * grow);
  const H = 3 + 5 * (1 - u);
  // from the start: the streak runs out to the right, its hot head leading
  const left = anchor === 'start' ? x : x - W / 2;
  const head = anchor === 'start' ? x + W * 0.82 : x;
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left,
          top: y - H / 2,
          width: W,
          height: H,
          borderRadius: H,
          background:
            anchor === 'start'
              ? `linear-gradient(90deg, ${rgba(color, 0)} 0%, ${rgba(color, 0.55 * op)} 45%, ${rgba('#ffffff', op)} 82%, ${rgba(color, 0.6 * op)} 92%, ${rgba(color, 0)} 100%)`
              : `linear-gradient(90deg, ${rgba(color, 0)} 0%, ${rgba(color, 0.7 * op)} 30%, ${rgba('#ffffff', op)} 50%, ${rgba(color, 0.7 * op)} 70%, ${rgba(color, 0)} 100%)`,
          boxShadow: `0 0 18px ${rgba(color, 0.5 * op)}`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: head - 70,
          top: y - 70,
          width: 140,
          height: 140,
          background: `radial-gradient(closest-side, ${rgba('#ffffff', 0.55 * op)}, ${rgba(color, 0.25 * op)} 45%, ${rgba(color, 0)} 100%)`,
          mixBlendMode: 'screen',
        }}
      />
    </>
  );
};
