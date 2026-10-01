/**
 * The beams (knowledge-stage.tsx <svg>): dotted cubics from every document
 * into the reader. Each draws through a mask (pathLength 1, EASE.draw, 2 f
 * apart) with a small head of Sunday light riding its front (a sunday-ink
 * dot in an aqua halo); the dots then stream
 * toward the orb (dash offset). On the miss the stream slows to a stop and
 * the beams fall back to .15.
 */
import React from 'react';
import { rgba } from '../../lib/lights';
import { EASE, mix, tween } from '../../lib/motion';
import { KNOWLEDGE, KNOWLEDGE_LOCAL } from '../../timing';
import { ACCENT, BEAM_INK, BEAM_MISS, cubicAt, SUN_GLOW, type Geo } from './geometry';

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

/** px the dots have travelled toward the orb by frame t (eased on, eased to a stop on the miss) */
function flow(t: number): number {
  let x = 0;
  for (let f = K.scan[0]; f < t; f++) {
    const on = tween(f, [K.scan[0], K.scan[0] + 12], [0, 1], EASE.out3);
    const off = 1 - tween(f, [K.miss, K.miss + 16], [0, 1], EASE.out3);
    x += 1.6 * on * off;
  }
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
            {head ? (
              <>
                <circle cx={head.x} cy={head.y} r={16} fill={rgba(SUN_GLOW.body, 0.12 * headO)} />
                <circle cx={head.x} cy={head.y} r={9} fill={rgba(SUN_GLOW.core, 0.5 * headO)} />
                <circle cx={head.x} cy={head.y} r={4.5} fill={ACCENT} opacity={headO} />
              </>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
};
