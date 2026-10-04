/**
 * AVA'S ORB in b08 — b07's orb carried on (scenes/turn/Orb.tsx, its last frame exactly): the site's FluidOrb
 * (components/Orb, WebGL, canvas 1.5 × devicePixelRatio) in the sunday palette, its rim a box-shadow on a div
 * behind the canvas. It glides to its b08 place (written/stage.ts orbPose: the canvas keeps b07's 300 px and the
 * whole orb scales, so nothing re-allocates mid-move) and breathes with her REAL voice — kb2-vo-4's envelope
 * through the FluidOrb's own attack 14/s and release 5/s, continuing from b07's last volume and flow time.
 */
import React from 'react';
import { Orb } from '../../../components/Orb';
import { rimGlow } from '../../../lib/lights';
import { subpixel } from '../../../lib/glide';
import { MOMENT_LIGHTS } from '../../palettes';
import { FPS, TURN_LOCAL, WRITTEN_LOCAL as W } from '../../timing';
import { VOICE } from '../../voice.generated';
import { orbFlowAt, orbVolumeAt } from '../turn/Orb';
import { turnStage } from '../turn/stage';
import { orbPose, type WrittenStage } from './stage';

const RUSH = MOMENT_LIGHTS.rush;
const SUNDAY = MOMENT_LIGHTS.sunday;
const VOL = { rest: 0.12, speak: 0.6 } as const;

const envAt = (f: number) => {
  const e = VOICE.lines['kb2-vo-4'].env;
  const i = Math.floor(f);
  if (i < 0 || i >= e.length) return 0;
  const a = e[i];
  const b = i + 1 < e.length ? e[i + 1] : 0;
  return a + (b - a) * (f - i);
};

/** per act frame: the smoothed volume and the flow time (b07's at frame 0, then integrated as components/Orb's flowTime) */
let TABLE: { vol: Float32Array; flow: Float64Array } | null = null;
function table() {
  if (TABLE) return TABLE;
  const n = W.end + 8;
  const vol = new Float32Array(n);
  const flow = new Float64Array(n);
  const ka = 1 - Math.exp(-14 / FPS);
  const kr = 1 - Math.exp(-5 / FPS);
  let y = orbVolumeAt(TURN_LOCAL.end);
  let f = orbFlowAt(TURN_LOCAL.end);
  for (let i = 0; i < n; i++) {
    vol[i] = y;
    flow[i] = f;
    const x = VOL.rest + VOL.speak * envAt(i - W.vo4);
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
export const writtenOrbVolume = (t: number) => sample(table().vol, t);
export const writtenOrbFlow = (t: number) => sample(table().flow, t);

const dpr = () => (typeof window !== 'undefined' && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1);

export const WrittenOrb: React.FC<{ t: number; S: WrittenStage }> = ({ t, S }) => {
  const D = turnStage(S.vertical).orb.d; // b07's canvas size: the orb scales, its canvas never re-allocates
  const p = orbPose(t, S);
  const scale = p.d / D;
  const vol = writtenOrbVolume(t);
  const rim = 0.12 + 0.18 * Math.max(0, vol - VOL.rest);
  const glow = { body: SUNDAY.orb[2], core: SUNDAY.orb[3] };
  const tf = `translate(${(p.x - D / 2).toFixed(3)}px, ${(p.y - D / 2).toFixed(3)}px) scale(${scale.toFixed(5)})`;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: D, height: D, transformOrigin: '50% 50%', ...subpixel(tf, p.moving) }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', boxShadow: rimGlow(glow, rim, D / 400, { shadow: 0.3 }) }} />
      <Orb size={D} palette={RUSH.orb} paletteB={SUNDAY.orb} mixB={1} volume={vol} time={writtenOrbFlow(t)} resolution={1.5 * dpr()} />
    </div>
  );
};
