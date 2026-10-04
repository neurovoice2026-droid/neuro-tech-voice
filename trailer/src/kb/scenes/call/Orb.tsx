/**
 * AVA'S ORB in b09–b11 — b08's orb carried on (scenes/written/Orb.tsx at its last frame exactly: the site's FluidOrb,
 * components/Orb, WebGL, canvas 1.5 × devicePixelRatio, drawn at b07's canvas size and scaled, so it never
 * re-allocates while it moves; its rim a box-shadow on a div behind the canvas).
 *
 *   ring       a single slate hairline leaves her rim (SVG, sub-pixel): the line ringing, shown not captioned
 *   pickup     she wakes to LISTEN: rest .12 → listen .15 (a breath of the caller's voice in it), her palette
 *              easing toward the sunday listen palette (palettes.ts MOMENT_LIGHTS.sunday.listen)
 *   filler     she SPEAKS on the call: .44 + .38 · env (kb2-call-1), attack 14/s, release 5/s (the FluidOrb's own)
 *   stop-time  she shrinks into the dot of BETWEEN QUESTION AND ANSWER and narrates from there (kb2-vo-5: the
 *              narrator's .12 + .6 · env, as b07/b08)
 *   answer     out of the dot to her answer place, speaking on the call again (kb2-call-2)
 *
 * Volume and flow time are integrated per act frame from b08's last values (written/Orb.tsx), so the hand-off is exact.
 */
import React from 'react';
import { Orb } from '../../../components/Orb';
import { subpixel } from '../../../lib/glide';
import { useLayout } from '../../../lib/layout';
import { rimGlow } from '../../../lib/lights';
import { EASE, tween } from '../../../lib/motion';
import { MOMENT_LIGHTS } from '../../palettes';
import { KB_INK } from '../../theme';
import { CALL_LOCAL as C, FPS, WRITTEN_LOCAL } from '../../timing';
import { VOICE, type VoiceId } from '../../voice.generated';
import { turnStage } from '../turn/stage';
import { writtenOrbFlow, writtenOrbVolume } from '../written/Orb';
import type { CallStage } from './stage';

const SUNDAY = MOMENT_LIGHTS.sunday;
const RING_INK = KB_INK.caller.paper.tag;

const envOf = (id: VoiceId, f: number) => {
  const e = VOICE.lines[id].env;
  const i = Math.floor(f);
  if (i < 0 || i >= e.length) return 0;
  const a = e[i];
  const b = i + 1 < e.length ? e[i + 1] : 0;
  return a + (b - a) * (f - i);
};

/** 0..1 she is listening (the pickup → her filler; she does not listen while she speaks) */
export const listenAt = (t: number) => tween(t, [C.pickup, C.pickup + 8], [0, 1], EASE.inOut) * (1 - tween(t, [C.call1 - 3, C.call1 + 3], [0, 1], EASE.inOut));

/** the orb's target volume at act frame f (before the FluidOrb's own attack / release) */
function target(f: number): number {
  const l = listenAt(f);
  if (f >= C.resume) return 0.12 + (f >= C.call2 - 2 ? 0.32 * Math.min(1, (f - C.call2 + 2) / 4) : 0) + 0.38 * envOf('kb2-call-2', f - C.call2);
  if (f >= C.freeze) return 0.12 + 0.6 * envOf('kb2-vo-5', f - C.vo5);
  if (f >= C.call1 - 2) return 0.12 + 0.32 * Math.min(1, (f - C.call1 + 2) / 4) * (1 - tween(f, [C.call1 + 52, C.call1 + 60], [0, 1])) + 0.38 * envOf('kb2-call-1', f - C.call1);
  // (the take's ridden-out opening syllable — timing.ts VOICE_RIDES — does not move her either)
  return 0.12 + 0.03 * l + 0.06 * l * (f < C.c4Words[0] - 2 ? 0 : envOf('kb2-c4', f - C.c4));
}

let TABLE: { vol: Float32Array; flow: Float64Array } | null = null;
function table() {
  if (TABLE) return TABLE;
  const n = C.end + 8;
  const vol = new Float32Array(n);
  const flow = new Float64Array(n);
  const ka = 1 - Math.exp(-14 / FPS);
  const kr = 1 - Math.exp(-5 / FPS);
  let y = writtenOrbVolume(WRITTEN_LOCAL.end);
  let f = writtenOrbFlow(WRITTEN_LOCAL.end);
  for (let i = 0; i < n; i++) {
    vol[i] = y;
    flow[i] = f;
    const x = target(i);
    f += (1 / FPS) * (0.55 + y * 1.6);
    y += (x - y) * (x > y ? ka : kr);
  }
  TABLE = { vol, flow };
  return TABLE;
}
const sample = (arr: ArrayLike<number>, t: number) => {
  const k = Math.max(0, Math.min(arr.length - 1, t));
  const i = Math.floor(k);
  const j = Math.min(arr.length - 1, i + 1);
  return arr[i] + (arr[j] - arr[i]) * (k - i);
};
export const callOrbVolume = (t: number) => sample(table().vol, t);
export const callOrbFlow = (t: number) => sample(table().flow, t);

const dpr = () => (typeof window !== 'undefined' && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1);

export const CallOrb: React.FC<{ t: number; S: CallStage; pose: { x: number; y: number; d: number; moving: boolean } }> = ({ t, S, pose: p }) => {
  const L = useLayout();
  const D = turnStage(S.vertical).orb.d; // b07's canvas size (b08 kept it): the orb scales, its canvas never re-allocates
  const scale = p.d / D;
  const vol = callOrbVolume(t);
  const rim = 0.12 + 0.18 * Math.max(0, vol - 0.12);
  const listen = listenAt(t) * 0.55;
  const glow = { body: SUNDAY.orb[2], core: SUNDAY.orb[3] };
  const tf = `translate(${(p.x - D / 2).toFixed(3)}px, ${(p.y - D / 2).toFixed(3)}px) scale(${scale.toFixed(5)})`;
  // the ring: one slate hairline off her rim on the bar (its radius from the orb's size at that moment)
  const rq = tween(t, [C.ring, C.ring + 26], [0, 1], EASE.out3);
  const ringOn = t >= C.ring && rq < 1;
  const rr = (p.d / 2) * (1.04 + 0.62 * rq);
  const young = Math.max(0, 1 - (t - C.ring) / 10);
  return (
    <>
      {ringOn ? (
        <svg width={L.width} height={L.height} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} aria-hidden>
          <circle cx={p.x} cy={p.y} r={rr} fill="none" stroke={RING_INK} strokeOpacity={(0.62 * (1 - rq) * Math.min(1, (t - C.ring) / 2)).toFixed(4)} strokeWidth={1.4 + 0.8 * young} />
        </svg>
      ) : null}
      <div style={{ position: 'absolute', left: 0, top: 0, width: D, height: D, transformOrigin: '50% 50%', ...subpixel(tf, p.moving) }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', boxShadow: rimGlow(glow, rim, D / 400, { shadow: 0.3 }) }} />
        <Orb size={D} palette={SUNDAY.orb} paletteB={SUNDAY.listen} mixB={listen} volume={vol} time={callOrbFlow(t)} resolution={1.5 * dpr()} />
      </div>
    </>
  );
};
