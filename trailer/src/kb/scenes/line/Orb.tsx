/**
 * AVA'S ORB in b12 — b11's orb carried on (scenes/call/Orb.tsx at its last frame exactly: the site's FluidOrb,
 * components/Orb, WebGL, canvas 1.5 × devicePixelRatio, drawn at b07's canvas size and scaled, so it never re-allocates
 * while it moves; its rim a box-shadow on a div behind the canvas).
 *
 *   0 → orb[1]   she glides to her corner, small (Ø 140 / 150), and DIMS TO REST while the owner types — these are not
 *                her words: rest volume, the rim down, the body a little paler (opacity), her key light down with her
 *   vo-6         she relights on her first word and speaks: the narrator's .12 + .6 · env (kb2-vo-6), through the
 *                FluidOrb's own attack 14/s and release 5/s, as in b07/b08/b10
 *
 * Volume and flow time are integrated per act frame from b11's last values (call/Orb.tsx), so the hand-off is exact; the
 * listen palette mix b11 ends on (0) carries on.
 */
import React from 'react';
import { Orb } from '../../../components/Orb';
import { subpixel } from '../../../lib/glide';
import { rimGlow } from '../../../lib/lights';
import { MOMENT_LIGHTS } from '../../palettes';
import { CALL_LOCAL, FPS, LINE_LOCAL as N } from '../../timing';
import { VOICE } from '../../voice.generated';
import { callOrbFlow, callOrbVolume } from '../call/Orb';
import { turnStage } from '../turn/stage';
import { lerp, orbLit, type LineStage } from './stage';

const SUNDAY = MOMENT_LIGHTS.sunday;
const REST = 0.12;

const envAt = (f: number) => {
  const e = VOICE.lines['kb2-vo-6'].env;
  const i = Math.floor(f);
  if (i < 0 || i >= e.length) return 0;
  const a = e[i];
  const b = i + 1 < e.length ? e[i + 1] : 0;
  return a + (b - a) * (f - i);
};

/** per act frame: the smoothed volume and the flow time (b11's at frame 0, then integrated as components/Orb's flowTime) */
let TABLE: { vol: Float32Array; flow: Float64Array } | null = null;
function table() {
  if (TABLE) return TABLE;
  const n = N.end + 8;
  const vol = new Float32Array(n);
  const flow = new Float64Array(n);
  const ka = 1 - Math.exp(-14 / FPS);
  const kr = 1 - Math.exp(-5 / FPS);
  let y = callOrbVolume(CALL_LOCAL.end);
  let f = callOrbFlow(CALL_LOCAL.end);
  for (let i = 0; i < n; i++) {
    vol[i] = y;
    flow[i] = f;
    const x = REST + 0.6 * envAt(i - N.vo6);
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
export const lineOrbVolume = (t: number) => sample(table().vol, t);
export const lineOrbFlow = (t: number) => sample(table().flow, t);

const dpr = () => (typeof window !== 'undefined' && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1);

export const LineOrb: React.FC<{ t: number; S: LineStage; pose: { x: number; y: number; d: number; moving: boolean } }> = ({ t, S, pose: p }) => {
  const D = turnStage(S.vertical).orb.d; // b07's canvas size (b08–b11 kept it): the orb scales, its canvas never re-allocates
  const scale = p.d / D;
  const vol = lineOrbVolume(t);
  const lit = orbLit(t);
  const rim = (0.12 + 0.18 * Math.max(0, vol - REST)) * lerp(0.55, 1, lit);
  const glow = { body: SUNDAY.orb[2], core: SUNDAY.orb[3] };
  const tf = `translate(${(p.x - D / 2).toFixed(3)}px, ${(p.y - D / 2).toFixed(3)}px) scale(${scale.toFixed(5)})`;
  const opacity = lerp(0.82, 1, lit);
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: D, height: D, transformOrigin: '50% 50%', opacity: opacity >= 0.999 ? undefined : opacity, ...subpixel(tf, p.moving) }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', boxShadow: rimGlow(glow, rim, D / 400, { shadow: 0.3 }) }} />
      <Orb size={D} palette={SUNDAY.orb} paletteB={SUNDAY.listen} mixB={0} volume={vol} time={lineOrbFlow(t)} resolution={1.5 * dpr()} />
    </div>
  );
};
