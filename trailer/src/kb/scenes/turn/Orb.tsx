/**
 * THE LINE LIGHT → AVA'S ORB (SCRIPT.md b07: "On 'Ava' (snapped to the 16th), the orb is born from the line
 * light"). One light, two meanings: the colour that interrupted becomes the colour that answers.
 *
 *   until lift   the clock's rose colon — exactly DeskClock's (scenes/repeat/Clock.tsx): a MeshOrb in the
 *                rush palette breathing on its 3 s breath, its small bloom a gradient (no filter)
 *   lift → Ava   it lifts off the clock (towards the viewer: it grows a little, its bloom gathering) and
 *                glides on a gentle arc to its place above the left title (turn/stage.ts lightPath); its
 *                last 3 frames are the seed — the light gathering before it opens
 *   Ava          it springs open into Ava's orb: the site's FluidOrb (components/Orb, WebGL, canvas at
 *                1.5 × devicePixelRatio), SPRING.pop 0 → 1.06 → 1 from the dot's own size, one hairline
 *                ring leaving the rim (SVG, sub-pixel), its rim of light a box-shadow on a div behind the
 *                canvas; its palette crossfades rush → sunday over 6 frames (mixPalette, OKLab)
 *   after        hers: the orb breathes with her REAL voice (kb2-vo-3's envelope through the FluidOrb's
 *                own attack 14/s and release 5/s), at rest between phrases
 */
import React from 'react';
import { flowTime, Orb } from '../../../components/Orb';
import { MeshOrb } from '../../../components/MeshOrb';
import { useLayout } from '../../../lib/layout';
import { mixColor, rgba as rgbaHex, rimGlow } from '../../../lib/lights';
import { EASE, tween } from '../../../lib/motion';
import { MOMENT_LIGHTS } from '../../palettes';
import { FPS, REPEAT_LOCAL, SCENES, TURN_LOCAL as T } from '../../timing';
import { VOICE } from '../../voice.generated';
import { colonAt, lightPath, openAt, type TurnStage } from './stage';

const RUSH = MOMENT_LIGHTS.rush;
const SUNDAY = MOMENT_LIGHTS.sunday;
/** the site's levels (film 1 scenes/knowledge/geometry.ts VOL) */
const VOL = { rest: 0.12, speak: 0.6 } as const;

/** DeskClock's own clock at this act's frame t: b06 drew it at REPEAT_LOCAL.hardStop + 30 + its local time */
const deskClockT = (t: number) => REPEAT_LOCAL.hardStop + 30 + (SCENES.turn.from - SCENES.recording.from) + t;
/** DeskClock's breath (a 3 s sine) */
const breathAt = (tc: number) => 0.5 + 0.5 * Math.sin((tc / 90) * Math.PI * 2 - 1.2);

/* ── her voice → the orb's volume (a table of act-local frames) ── */
const envAt = (f: number) => {
  const e = VOICE.lines['kb2-vo-3'].env;
  const i = Math.floor(f);
  if (i < 0 || i >= e.length) return 0;
  const a = e[i];
  const b = i + 1 < e.length ? e[i + 1] : 0;
  return a + (b - a) * (f - i);
};
const T0 = -2;
const T1 = T.end + 4;
let TABLE: Float32Array | null = null;
function table(): Float32Array {
  if (TABLE) return TABLE;
  const n = T1 - T0 + 1;
  const out = new Float32Array(n);
  const ka = 1 - Math.exp(-14 / FPS);
  const kr = 1 - Math.exp(-5 / FPS);
  let y = VOL.rest;
  for (let i = 0; i < n; i++) {
    const t = T0 + i;
    const x = t >= T.ava ? VOL.rest + VOL.speak * envAt(t - T.vo3) : VOL.rest;
    y += (x - y) * (x > y ? ka : kr);
    out[i] = y;
  }
  TABLE = out;
  return out;
}
/** the orb's (smoothed) volume at act-local t — for b08 to continue from (orbVolumeAt(T.end + its own t)) */
export function orbVolumeAt(t: number): number {
  const tb = table();
  const k = Math.max(0, Math.min(tb.length - 1, t - T0));
  const i = Math.floor(k);
  const j = Math.min(tb.length - 1, i + 1);
  return tb[i] + (tb[j] - tb[i]) * (k - i);
}
/** the FluidOrb's flow time at act-local t (the site's integration from her birth) */
export const orbFlowAt = (t: number) => flowTime(Math.max(0, t - T.ava), (f) => orbVolumeAt(f + T.ava)) + 4.1;

const dpr = () => (typeof window !== 'undefined' && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1);

export const AvaOrb: React.FC<{ t: number; S: TurnStage }> = ({ t, S }) => {
  const L = useLayout();
  const o = S.orb;
  const tc = deskClockT(t);
  const breath = breathAt(tc);
  const colon = colonAt(t, S);

  /* ── the line light, on the clock and in flight ── */
  if (t < T.ava) {
    // 16:9: nothing until the clock has ridden in
    if (!S.vertical && colon.y < -40) return null;
    const flying = t > T.lift;
    const p = flying ? lightPath(t, S) : { x: colon.x, y: colon.y, lift: 0, u: 0 };
    // lifting towards the viewer it grows (×1.45 by the open); the bloom gathers over the flight and the seed
    const grow = 1 + 0.45 * EASE.inOut(p.u);
    const seed = tween(t, [T.ava - 3, T.ava], [0, 1], EASE.in2);
    const dotScale = (1 + 0.05 * breath) * grow;
    const bloom = 0.16 + 0.05 * breath + 0.16 * p.lift + 0.3 * seed;
    const halo = colon.d * 4.2 * (1 + 0.35 * p.u - 0.15 * seed);
    const bloomScale = flying ? 0.9 + 0.2 * p.u : 0.9;
    return (
      <>
        <div
          style={{
            position: 'absolute',
            left: p.x - halo / 2,
            top: p.y - halo / 2,
            width: halo,
            height: halo,
            borderRadius: '50%',
            background: `radial-gradient(closest-side, rgb(236 72 153 / ${bloom.toFixed(4)}) 0%, rgb(236 72 153 / ${(bloom * 0.34).toFixed(4)}) 40%, rgb(236 72 153 / ${(bloom * 0.08).toFixed(4)}) 72%, rgb(236 72 153 / 0) 100%)`,
            transform: `scale(${bloomScale.toFixed(4)})`,
          }}
        />
        <div style={{ position: 'absolute', left: p.x - colon.d / 2, top: p.y - colon.d / 2, width: colon.d, height: colon.d, transform: `scale(${dotScale.toFixed(4)})` }}>
          <MeshOrb size={colon.d} palette={RUSH.orb} time={11.4 + tc / 30} />
        </div>
      </>
    );
  }

  /* ── Ava's orb ── */
  const D = o.d;
  const p = openAt(t);
  // it opens from exactly the light's size as it lands (the flying dot's displayed diameter on "Ava")
  const d0 = colon.d * (1 + 0.05 * breathAt(deskClockT(T.ava))) * 1.45;
  const scale = (d0 + (D - d0) * p) / D;
  const relight = tween(t, [T.relight[0], T.relight[1]], [0, 1], EASE.inOut);
  const vol = orbVolumeAt(t);
  // the rim: a flash as it opens, then a quiet rim that breathes with her voice; its contact shadow (light rooms)
  const flash = Math.exp(-Math.max(0, t - T.ava - 2) / 6) * Math.min(1, (t - T.ava) / 2);
  const rim = 0.12 + 0.16 * flash + 0.18 * Math.max(0, vol - VOL.rest);
  const glow = { body: mixColor(RUSH.orb[2], SUNDAY.orb[2], relight), core: mixColor(RUSH.orb[3], SUNDAY.orb[3], relight) };
  // the seed's light disperses as the orb opens out of it (6 frames: it widens with the orb and thins away)
  const dq = (t - T.ava) / 6;
  const seedA = dq < 1 ? (0.16 + 0.05 * breathAt(deskClockT(T.ava)) + 0.3) * (1 - dq) * (1 - dq) : 0;
  const seedD = colon.d * 4.2 * 1.2 + (D * 1.5 - colon.d * 5) * EASE.out3(Math.min(1, Math.max(0, dq)));
  const seedRgb = mixColor('#ec4899', SUNDAY.orb[2], relight);
  // the dot itself hands over to the FluidOrb over a frame and a half (the same size: no jump in look)
  const dotA = Math.max(0, 1 - (t - T.ava) / 1.5);
  // the hairline ring: off the rim as the orb first reaches its size (the pop's overshoot, ≈ 4 f): the "ting"
  const ringA = T.ava + 4;
  const rq = tween(t, [ringA, ringA + 20], [0, 1], EASE.out3);
  const ringOn = t > ringA && rq < 1;
  const rr = (D / 2) * (1.0 + 0.5 * rq);
  const young = Math.max(0, 1 - (t - ringA) / 10);
  return (
    <>
      {seedA > 0.002 ? (
        <div
          style={{
            position: 'absolute',
            left: o.x - seedD / 2,
            top: o.y - seedD / 2,
            width: seedD,
            height: seedD,
            borderRadius: '50%',
            background: `radial-gradient(closest-side, ${rgbaHex(seedRgb, seedA)} 0%, ${rgbaHex(seedRgb, seedA * 0.34)} 40%, ${rgbaHex(seedRgb, seedA * 0.08)} 72%, ${rgbaHex(seedRgb, 0)} 100%)`,
          }}
        />
      ) : null}
      {ringOn ? (
        <svg width={L.width} height={L.height} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} aria-hidden>
          <circle cx={o.x} cy={o.y} r={rr} fill="none" stroke={SUNDAY.orb[2]} strokeOpacity={(0.55 * (1 - rq)).toFixed(4)} strokeWidth={1.5 + young} />
        </svg>
      ) : null}
      <div
        style={{
          position: 'absolute',
          left: o.x - D / 2,
          top: o.y - D / 2,
          width: D,
          height: D,
          transform: `scale(${scale.toFixed(5)})`,
          transformOrigin: '50% 50%',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', boxShadow: rimGlow(glow, rim, D / 400, { shadow: 0.3 * Math.min(1, p) }) }} />
        <Orb size={D} palette={RUSH.orb} paletteB={SUNDAY.orb} mixB={relight} volume={vol} time={orbFlowAt(t)} resolution={1.5 * dpr()} />
      </div>
      {dotA > 0.002 ? (
        <div style={{ position: 'absolute', left: o.x - d0 / 2, top: o.y - d0 / 2, width: d0, height: d0, opacity: dotA }}>
          <MeshOrb size={d0} palette={RUSH.orb} time={11.4 + tc / 30} />
        </div>
      ) : null}
    </>
  );
};
