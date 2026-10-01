/**
 * The beams (knowledge-stage.tsx <svg>): fine dotted cubics from every
 * document into the reader. Each draws through a mask (pathLength 1,
 * EASE.draw, 2 f apart) with a small sunday-ink head riding its front (no
 * halo); the dots then stream toward the orb (dash offset — the integral of
 * a smooth speed curve, continuous at any fractional t). On the miss the
 * stream slows to a stop and the beams fall back to .15.
 */
import React from 'react';
import { EASE, mix, tween } from '../../lib/motion';
import { KNOWLEDGE, KNOWLEDGE_LOCAL } from '../../timing';
import { ACCENT, BEAM_INK, BEAM_MISS, cubicAt, type Geo } from './geometry';

const K = KNOWLEDGE;
const KL = KNOWLEDGE_LOCAL;

/** each beam's own draw window (the five fill KL.beams, 2 f apart) */
function drawWin(i: number): [number, number] {
  const n = 5;
  const [a, b] = KL.beams;
  const dur = b - a - (n - 1) * KL.beamStagger;
  const s = a + i * KL.beamStagger;
  return [s, s + dur];
}

/** the stream's speed (px / frame): eased on with the scan, eased to a stop on the miss */
const speed = (f: number) =>
  1.6 * tween(f, [K.scan[0], K.scan[0] + 12], [0, 1], EASE.out3) * (1 - tween(f, [K.miss, K.miss + 16], [0, 1], EASE.out3));

/** px the dots have travelled toward the orb by frame t: ∫ speed (trapezoids of ¼ f + the exact remainder) */
function flow(t: number): number {
  const a = K.scan[0];
  if (t <= a) return 0;
  const end = Math.min(t, K.miss + 16);
  const h = 0.25;
  let x = 0;
  let f = a;
  for (; f + h <= end; f += h) x += ((speed(f) + speed(f + h)) / 2) * h;
  if (end > f) x += ((speed(f) + speed(end)) / 2) * (end - f);
  return x;
}

export const Beams: React.FC<{ t: number; G: Geo; uid: string }> = ({ t, G, uid }) => {
  if (t < KL.beams[0] - 1) return null;
  const fade = mix(1, BEAM_MISS, tween(t, [K.miss, K.miss + 8], [0, 1], EASE.out3));
  const off = -flow(t);
  return (
    <svg
      width={G.v ? 1080 : 1920}
      height={G.v ? 1920 : 1080}
      style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}
      fill="none"
    >
      {G.beams.map((bm, i) => {
        const [s, e] = drawWin(i);
        const p = tween(t, [s, e], [0, 1], EASE.draw);
        if (p <= 0) return null;
        const head = p < 1 ? cubicAt(bm, p) : null;
        const headO = p < 1 ? Math.min(1, p * 6) * Math.min(1, (1 - p) * 6) : 0;
        return (
          <g key={i} style={{ opacity: fade }}>
            {/* the draw mask only while drawing (an SVG mask a frame costs; a drawn beam needs none) */}
            {p < 1 ? (
              <mask id={`${uid}-m${i}`} maskUnits="userSpaceOnUse" x={0} y={0} width={G.v ? 1080 : 1920} height={G.v ? 1920 : 1080}>
                <path d={bm.d} pathLength={1} stroke="#fff" strokeWidth={14} strokeDasharray="1 1" strokeDashoffset={1 - p} />
              </mask>
            ) : null}
            <path
              d={bm.d}
              mask={p < 1 ? `url(#${uid}-m${i})` : undefined}
              stroke={BEAM_INK}
              strokeWidth={3}
              strokeDasharray="0.01 9"
              strokeDashoffset={off}
              strokeLinecap="round"
            />
            {head ? <circle cx={head.x} cy={head.y} r={4.5} fill={ACCENT} opacity={headO} /> : null}
          </g>
        );
      })}
    </svg>
  );
};
