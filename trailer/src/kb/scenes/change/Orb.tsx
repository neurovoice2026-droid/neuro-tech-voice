/**
 * AVA'S ORB in b13–b14 — b12's orb carried on (scenes/line/Orb.tsx at its last frame exactly: the site's FluidOrb,
 * components/Orb, WebGL, canvas 1.5 × devicePixelRatio, drawn at b07's canvas size and scaled, so it never re-allocates
 * while it moves; its rim a box-shadow on a div behind the canvas).
 *
 *   vo-7       she narrates (the narrator's .12 + .6 · env, kb2-vo-7) from her corner while the owner works
 *   ring       one slate hairline leaves her rim (SVG, sub-pixel) as she glides to her call place: shown, not captioned
 *   pickup     she LISTENS to Dana's identical question: rest .12 → .15 (a breath of the caller's voice in it), her palette
 *              easing toward the sunday listen palette
 *   call-3     she SPEAKS on the call: .44 + .38 · env (kb2-call-3), the FluidOrb's own attack 14/s and release 5/s
 *
 * Volume and flow time are integrated per act frame from b12's last values (line/Orb.tsx), so the hand-off is exact.
 */
import React from 'react';
import { Orb } from '../../../components/Orb';
import { subpixel } from '../../../lib/glide';
import { useLayout } from '../../../lib/layout';
import { rimGlow } from '../../../lib/lights';
import { EASE, tween } from '../../../lib/motion';
import { MOMENT_LIGHTS } from '../../palettes';
import { KB_INK } from '../../theme';
import { CHANGE_LOCAL as K, FPS, LINE_LOCAL, vFrames } from '../../timing';
import { VOICE, type VoiceId } from '../../voice.generated';
import { lineOrbFlow, lineOrbVolume } from '../line/Orb';
import { turnStage } from '../turn/stage';
import type { ChangeStage } from './stage';

const SUNDAY = MOMENT_LIGHTS.sunday;
const RING_INK = KB_INK.caller.paper.tag;
const REST = 0.12;

const envOf = (id: VoiceId, f: number) => {
  const e = VOICE.lines[id].env;
  const i = Math.floor(f);
  if (i < 0 || i >= e.length) return 0;
  const a = e[i];
  const b = i + 1 < e.length ? e[i + 1] : 0;
  return a + (b - a) * (f - i);
};

/** 0..1 she is listening (the pickup → just before her answer; she does not listen while she speaks) */
export const listenAt = (t: number) => tween(t, [K.pickup, K.pickup + 8], [0, 1], EASE.inOut) * (1 - tween(t, [K.call3 - 3, K.call3 + 3], [0, 1], EASE.inOut));

/** the orb's target volume at act frame f (before the FluidOrb's own attack / release) */
function target(f: number): number {
  if (f >= K.call3 - 2) {
    const end = K.call3 + vFrames('kb2-call-3');
    return REST + 0.32 * Math.min(1, (f - K.call3 + 2) / 4) * (1 - tween(f, [end - 6, end + 2], [0, 1])) + 0.38 * envOf('kb2-call-3', f - K.call3);
  }
  if (f >= K.pickup) {
    const l = listenAt(f);
    return REST + 0.03 * l + 0.06 * l * envOf('kb2-c2', f - K.c2);
  }
  return REST + 0.6 * envOf('kb2-vo-7', f - K.vo7);
}

let TABLE: { vol: Float32Array; flow: Float64Array } | null = null;
function table() {
  if (TABLE) return TABLE;
  const n = K.end + 8;
  const vol = new Float32Array(n);
  const flow = new Float64Array(n);
  const ka = 1 - Math.exp(-14 / FPS);
  const kr = 1 - Math.exp(-5 / FPS);
  let y = lineOrbVolume(LINE_LOCAL.end);
  let f = lineOrbFlow(LINE_LOCAL.end);
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
export const changeOrbVolume = (t: number) => sample(table().vol, t);
export const changeOrbFlow = (t: number) => sample(table().flow, t);

const dpr = () => (typeof window !== 'undefined' && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1);

export const ChangeOrb: React.FC<{ t: number; S: ChangeStage; pose: { x: number; y: number; d: number; moving: boolean } }> = ({ t, S, pose: p }) => {
  const L = useLayout();
  const D = turnStage(S.vertical).orb.d; // b07's canvas size (b08–b12 kept it): the orb scales, its canvas never re-allocates
  const scale = p.d / D;
  const vol = changeOrbVolume(t);
  const rim = REST + 0.18 * Math.max(0, vol - REST);
  const listen = listenAt(t) * 0.55;
  const glow = { body: SUNDAY.orb[2], core: SUNDAY.orb[3] };
  const tf = `translate(${(p.x - D / 2).toFixed(3)}px, ${(p.y - D / 2).toFixed(3)}px) scale(${scale.toFixed(5)})`;
  // the ring: one slate hairline off her rim on the beat (its radius from the orb's size at that moment)
  const rq = tween(t, [K.ring, K.ring + 26], [0, 1], EASE.out3);
  const ringOn = t >= K.ring && rq < 1;
  const rr = (p.d / 2) * (1.04 + 0.62 * rq);
  const young = Math.max(0, 1 - (t - K.ring) / 10);
  return (
    <>
      {ringOn ? (
        <svg width={L.width} height={L.height} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} aria-hidden>
          <circle cx={p.x} cy={p.y} r={rr} fill="none" stroke={RING_INK} strokeOpacity={(0.62 * (1 - rq) * Math.min(1, (t - K.ring) / 2)).toFixed(4)} strokeWidth={1.4 + 0.8 * young} />
        </svg>
      ) : null}
      <div style={{ position: 'absolute', left: 0, top: 0, width: D, height: D, transformOrigin: '50% 50%', ...subpixel(tf, p.moving) }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', boxShadow: rimGlow(glow, rim, D / 400, { shadow: 0.3 }) }} />
        <Orb size={D} palette={SUNDAY.orb} paletteB={SUNDAY.listen} mixB={listen} volume={vol} time={changeOrbFlow(t)} resolution={1.5 * dpr()} />
      </div>
    </>
  );
};
