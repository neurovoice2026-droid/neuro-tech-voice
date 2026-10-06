/**
 * THE REELS' LIGHTS: the rose LINE LIGHT (the phone: "No people and no handset are drawn: a phone is the rose line
 * light and its sound", SCRIPT.md §0.3), its RING pulses, and AVA'S ORB — a FORK of film 2's src/kb/scenes/turn/Orb.tsx
 * (the line light → orb birth) and call/Orb.tsx (speak / listen), @ 743247a, unbound from film 2's timeline: every
 * moment and pose is passed in by the reel; her voice is read from the reels' own VOICE (src/ig/voice.generated.ts).
 * Built on film 1's components (imported read-only): Orb (the site's FluidOrb in WebGL, one context per orb, canvas at
 * 1.5 × devicePixelRatio) and MeshOrb (the site's CSS mesh orb, for the small rose dot).
 *
 *   <LineLight t x y d />           the rose line light: a MeshOrb in MOMENT_LIGHTS.rush breathing on DeskClock's 3 s
 *                                   breath, its small bloom a radial gradient (no filter); `dim` takes it down to rest
 *   <Rings t at={[0, 30]} … />      RingPulse hairlines leaving a light (film 1 hook/Rings: power2.out over 0.95 s,
 *                                   thinning as they travel; SVG, never pixel-snapped) in the moment's ink
 *   orbTrack(T, opts)               her voice → the orb's volume and flow time, per reel (film 2's rules: narrator
 *                                   .12 + .6·env, on a call .44 + .38·env, listening .15 in the `listen` palette; the
 *                                   FluidOrb's own attack 14/s, release 5/s; flow += dt·(.55 + 1.6·vol) from 7.3)
 *   <AvaOrb t pose track … />       her orb at a pose ({x, y, d}, frame px) — drawn at a FIXED canvas size and scaled
 *                                   (it never re-allocates while it glides or grows), its rim a box-shadow on a div
 *                                   behind the canvas. Optional:
 *                                     born   the line light springs OPEN into her orb (film 2's birth): a 3-frame seed
 *                                            gathering, SPRING.pop 0 → 1.06 → 1 from the dot's own size, one hairline
 *                                            ring off the rim, the palette crossing rush → sunday over 6 frames (OKLab)
 *                                     pop    she appears out of nothing (no line light: ig1's full stop)
 *                                     close  the reverse, for the seam: she closes back into the rose line light
 *
 * Every value is a pure function of the absolute timeline frame `t` (fractional at 120 fps).
 */
import React from 'react';
import { flowTime, Orb, seedTime } from '../../components/Orb';
import { MeshOrb } from '../../components/MeshOrb';
import { subpixel } from '../../lib/glide';
import { mixColor, rgba as rgbaHex, rimGlow } from '../../lib/lights';
import { EASE, SPRING, springUnit, tween } from '../../lib/motion';
import { FPS } from '../../timing';
import { MOMENT_LIGHTS } from '../../kb/palettes';
import { KB_INK } from '../../kb/theme';
import type { ReelTimeline } from '../types';
import { VOICE } from '../voice.generated';

const RUSH = MOMENT_LIGHTS.rush;
const SUNDAY = MOMENT_LIGHTS.sunday;
/** the site's levels (film 1 scenes/knowledge/geometry.ts VOL; film 2 call/Orb) */
export const VOL = { rest: 0.12, listen: 0.15, narrate: 0.6, call: 0.38, callFloor: 0.32 } as const;
/** the ring inks: the phone's rose (rush), a caller's slate, her teal */
export const RING_INK = { rush: RUSH.orb[2], caller: KB_INK.caller.paper.tag, sunday: SUNDAY.orb[2] } as const;

const dpr = () => (typeof window !== 'undefined' && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/* ── the line light ─────────────────────────────────────────────── */

/** DeskClock's breath (film 2 repeat/Clock: a 3 s sine) */
export const breathAt = (t: number) => 0.5 + 0.5 * Math.sin((t / 90) * Math.PI * 2 - 1.2);

/** The rose line light: the front desk's phone. `dim` 0..1 takes it to rest (35 %: the caller giving up). */
export const LineLight: React.FC<{
  t: number;
  x: number;
  y: number;
  /** the dot's diameter */
  d: number;
  /** 0 = lit … 1 = at rest (opacity .35, no bloom) */
  dim?: number;
  /** a ring's flash on the dot at these frames (the bloom swells a touch as a ring leaves) */
  rings?: readonly number[];
  opacity?: number;
  palette?: readonly string[];
}> = ({ t, x, y, d, dim = 0, rings = [], opacity = 1, palette = RUSH.orb }) => {
  if (opacity <= 0.002) return null;
  const breath = breathAt(t);
  const last = [...rings].reverse().find((r) => t >= r);
  const ringK = last === undefined ? 0 : Math.exp(-(t - last) / 6) * clamp01((t - last) / 1.5);
  const lit = 1 - clamp01(dim);
  const bloom = (0.16 + 0.05 * breath + 0.14 * ringK) * lit;
  const halo = d * 4.2;
  const rgb = palette[2];
  const o = opacity * (0.35 + 0.65 * lit);
  return (
    <>
      {bloom > 0.004 ? (
        <div
          style={{
            position: 'absolute',
            left: x - halo / 2,
            top: y - halo / 2,
            width: halo,
            height: halo,
            borderRadius: '50%',
            opacity,
            background: `radial-gradient(closest-side, ${rgbaHex(rgb, bloom)} 0%, ${rgbaHex(rgb, bloom * 0.34)} 40%, ${rgbaHex(rgb, bloom * 0.08)} 72%, ${rgbaHex(rgb, 0)} 100%)`,
          }}
        />
      ) : null}
      <div style={{ position: 'absolute', left: x - d / 2, top: y - d / 2, width: d, height: d, opacity: o >= 0.999 ? undefined : o, transform: `scale(${(1 + 0.05 * breath * lit + 0.08 * ringK).toFixed(4)})` }}>
        <MeshOrb size={d} palette={palette} time={11.4 + t / 30} />
      </div>
    </>
  );
};

/* ── ring pulses ────────────────────────────────────────────────── */

/** film 1 hook/Rings: 0.95 s of travel, power2.out */
const RING_LIFE = 28.5;

/** RingPulse hairlines leaving a light at `at` (absolute frames): from Ø d0 to Ø d1, in `color`. */
export const Rings: React.FC<{
  t: number;
  at: readonly number[];
  x: number;
  y: number;
  d0: number;
  d1: number;
  color?: string;
  /** peak opacity (default .55) */
  strength?: number;
  /** 0..1: everything fading out (a scene's end) */
  out?: number;
}> = ({ t, at, x, y, d0, d1, color = RING_INK.rush, strength = 0.55, out = 0 }) => {
  const live = at.filter((s) => t >= s && t < s + RING_LIFE);
  if (!live.length || out >= 0.999) return null;
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }} aria-hidden>
      {live.map((s) => {
        const age = t - s;
        const u = clamp01(age / RING_LIFE);
        const e = 1 - (1 - u) * (1 - u);
        const born = tween(t, [s, s + 1.5], [0, 1], EASE.out3);
        const young = Math.max(0, 1 - age / 10);
        const w = 1.5 + 1.0 * young;
        const a = Math.min(1, strength + 0.25 * young) * born * (1 - e) * (1 - out);
        const r = Math.max(0, (d0 + (d1 - d0) * e) / 2 - w / 2);
        return <circle key={s} cx={x} cy={y} r={r} fill="none" stroke={color} strokeOpacity={a.toFixed(4)} strokeWidth={w.toFixed(3)} />;
      })}
    </svg>
  );
};

/* ── her voice → the orb ────────────────────────────────────────── */

export type OrbTrackOpts = {
  /** lines Ava speaks ON A CALL (in-call level); default: the lines the reel shows as transcript rows or the owner's
   *  field (SCREENS kind 'row' | 'field') */
  call?: readonly string[];
  /** caller turns: she listens (the listen palette, a breath of their line in her) */
  listen?: readonly (readonly [number, number])[];
  /** a swirl of her own (flow-time offset, components/Orb seedTime) */
  seed?: number;
};
export type OrbTrack = {
  /** the FluidOrb's volume at t (after its attack / release) */
  volume: (t: number) => number;
  /** the FluidOrb's flow time (s) at t */
  flow: (t: number) => number;
  /** 0..1 she is listening */
  listen: (t: number) => number;
};

type Env = { env: readonly number[]; frames: number };
const envOf = (id: string, f: number) => {
  const e = (VOICE.lines as Record<string, Env>)[id]?.env;
  if (!e) return 0;
  const i = Math.floor(f);
  if (i < 0 || i >= e.length) return 0;
  const a = e[i];
  const b = i + 1 < e.length ? e[i + 1] : 0;
  return a + (b - a) * (f - i);
};

const TRACKS = new Map<string, { vol: Float32Array; flow: Float64Array; lis: Float32Array }>();

/** Her voice on the reel's timeline → the orb (a per-frame table, integrated once per reel and options). */
export function orbTrack(T: ReelTimeline, o: OrbTrackOpts = {}): OrbTrack {
  const key = `${T.REEL}|${JSON.stringify(o)}`;
  let tb = TRACKS.get(key);
  if (!tb) {
    const call = new Set(o.call ?? T.VOICES.filter((v) => ['row', 'field'].includes(T.SCREENS[v.id]?.kind ?? '')).map((v) => v.id));
    const listen = o.listen ?? [];
    const n = T.DURATION + 8;
    const lisAt = (f: number) => Math.max(0, ...listen.map(([a, b]) => tween(f, [a, a + 6], [0, 1], EASE.inOut) * (1 - tween(f, [b - 2, b + 6], [0, 1], EASE.inOut))));
    const target = (f: number) => {
      let x = VOL.rest + (VOL.listen - VOL.rest) * lisAt(f);
      for (const v of T.VOICES) {
        const frames = (VOICE.lines as Record<string, Env>)[v.id]?.frames ?? 0;
        if (f < v.at - 2 || f > v.at + frames + 2) continue;
        const env = envOf(v.id, f - v.at);
        if (call.has(v.id)) {
          // on a call she is "on" through the whole turn (film 2's call orb): a floor in over 4 f, out over 8
          const on = tween(f, [v.at - 2, v.at + 2], [0, 1], EASE.inOut) * (1 - tween(f, [v.at + frames - 6, v.at + frames + 2], [0, 1], EASE.inOut));
          x = Math.max(x, VOL.rest + VOL.callFloor * on + VOL.call * env);
        } else x = Math.max(x, VOL.rest + VOL.narrate * env);
      }
      return x;
    };
    const vol = new Float32Array(n);
    const flow = new Float64Array(n);
    const lis = new Float32Array(n);
    const ka = 1 - Math.exp(-14 / FPS);
    const kr = 1 - Math.exp(-5 / FPS);
    let y = VOL.rest;
    let fl = 7.3;
    for (let i = 0; i < n; i++) {
      vol[i] = y;
      flow[i] = fl;
      lis[i] = lisAt(i);
      const x = target(i);
      fl += (1 / FPS) * (0.55 + y * 1.6);
      y += (x - y) * (x > y ? ka : kr);
    }
    tb = { vol, flow, lis };
    TRACKS.set(key, tb);
  }
  const t0 = tb;
  const sample = (arr: ArrayLike<number>, t: number) => {
    const k = Math.max(0, Math.min(arr.length - 1, t));
    const i = Math.floor(k);
    const j = Math.min(arr.length - 1, i + 1);
    return arr[i] + (arr[j] - arr[i]) * (k - i);
  };
  const seed = seedTime(o.seed ?? 0);
  return { volume: (t) => sample(t0.vol, t), flow: (t) => sample(t0.flow, t) + seed, listen: (t) => sample(t0.lis, t) };
}

/** a flow time for an orb with no voice (rest), from frame `from` */
export const restFlow = (t: number, from = 0) => flowTime(Math.max(0, t - from), () => VOL.rest) + 4.1;

/* ── her orb ────────────────────────────────────────────────────── */

export type OrbPose = { x: number; y: number; d: number; moving?: boolean };

export type AvaOrbProps = {
  t: number;
  pose: OrbPose;
  track: OrbTrack;
  /** the FluidOrb's canvas diameter (≥ the largest d it is shown at; default pose.d) — fixed, so it never re-allocates */
  canvas?: number;
  /** the line light springs open into her orb at `at` (before it: the rose line light at the pose, Ø `dot`) */
  born?: { at: number; dot: number };
  /** she appears out of nothing at `at` (SPRING.pop from 0) */
  pop?: { at: number };
  /** she closes back into the rose line light over [at, at + dur] (the seam), ending as a dot of Ø `dot`; the line
   *  light breathes on the clock t − t0 (the seam: t0 = END, so it breathes exactly as frame 0's does) */
  close?: { at: number; dur: number; dot: number; t0?: number };
  /** palette while she listens: × the track's listen (default .55 of the way to the listen palette) */
  listenMix?: number;
  /** rim strength × (her rim of light; 0 = none) */
  rim?: number;
  /** a lean (scale) while she listens: SCRIPT ig2 "the orb … leans (scale .97)" */
  lean?: number;
  opacity?: number;
  /** her contact shadow (a pearl ground: under-shadow of the rim, 0..1) */
  shadow?: number;
};

export const AvaOrb: React.FC<AvaOrbProps> = ({ t, pose, track, canvas, born, pop, close, listenMix = 0.55, rim = 1, lean = 0.97, opacity = 1, shadow = 0.3 }) => {
  const D = canvas ?? pose.d;
  if (opacity <= 0.002) return null;

  /* before her birth: the rose line light */
  if (born && t < born.at) {
    return <LineLight t={t} x={pose.x} y={pose.y} d={born.dot} />;
  }
  /* after she has closed back into the line light */
  if (close && t >= close.at + close.dur) {
    return <LineLight t={t - (close.t0 ?? 0)} x={pose.x} y={pose.y} d={close.dot} />;
  }
  /* she appears out of nothing */
  if (pop && t < pop.at - 0.5) return null;

  const vol = track.volume(t);
  const lis = track.listen(t);
  // the size: the pose, the birth's open (from the dot's own size, SPRING.pop overshoot), the appearance, the close
  let d = pose.d;
  let relight = 1; // 0 = rush (the line light's colour), 1 = sunday (hers)
  let seedA = 0;
  let seedD = 0;
  let dotA = 0;
  let dot0 = 0;
  let flash = 0;
  if (born) {
    const p = springUnit(t - born.at, SPRING.pop);
    dot0 = born.dot * 1.08;
    d = dot0 + (pose.d - dot0) * p;
    relight = tween(t, [born.at, born.at + 6], [0, 1], EASE.inOut);
    // the seed's light disperses as she opens out of it (6 frames: it widens with her and thins away)
    const dq = (t - born.at) / 6;
    seedA = dq < 1 ? 0.5 * (1 - dq) * (1 - dq) : 0;
    seedD = born.dot * 5 + (pose.d * 1.5 - born.dot * 5) * EASE.out3(clamp01(dq));
    dotA = Math.max(0, 1 - (t - born.at) / 1.5);
    flash = Math.exp(-Math.max(0, t - born.at - 2) / 6) * clamp01((t - born.at) / 2);
  }
  if (pop) {
    const p = springUnit(t - pop.at, SPRING.pop);
    d = pose.d * Math.max(0, p);
    flash = Math.max(flash, Math.exp(-Math.max(0, t - pop.at - 2) / 6) * clamp01((t - pop.at) / 2));
  }
  let closeK = 0;
  if (close && t > close.at) {
    closeK = EASE.inOut(clamp01((t - close.at) / close.dur));
    d = d + (close.dot - d) * closeK;
    relight = Math.min(relight, 1 - closeK);
  }
  // a lean while she listens (scale about her centre)
  const scale = (d / D) * (1 - (1 - lean) * lis);
  const glow = { body: mixColor(RUSH.orb[2], SUNDAY.orb[2], relight), core: mixColor(RUSH.orb[3], SUNDAY.orb[3], relight) };
  const rimS = rim * (0.12 + 0.16 * flash + 0.18 * Math.max(0, vol - VOL.rest));
  const moving = !!pose.moving || (born !== undefined && t < born.at + 14) || (pop !== undefined && t < pop.at + 14) || (closeK > 0 && closeK < 1);
  const tf = `translate(${(pose.x - D / 2).toFixed(3)}px, ${(pose.y - D / 2).toFixed(3)}px) scale(${Math.max(0, scale).toFixed(5)})`;
  // the hairline ring: off her rim as she first reaches her size (the pop's overshoot, ≈ 4 f)
  const ringAt = born ? born.at + 4 : pop ? pop.at + 4 : -Infinity;
  const rq = tween(t, [ringAt, ringAt + 20], [0, 1], EASE.out3);
  const ringOn = t > ringAt && rq < 1;
  const young = Math.max(0, 1 - (t - ringAt) / 10);
  // the close: the line light comes up in her place over the last third
  const closeDot = close && closeK > 0.6 ? (closeK - 0.6) / 0.4 : 0;
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: opacity >= 0.999 ? undefined : opacity, pointerEvents: 'none' }}>
      {seedA > 0.002 ? (
        <div
          style={{
            position: 'absolute',
            left: pose.x - seedD / 2,
            top: pose.y - seedD / 2,
            width: seedD,
            height: seedD,
            borderRadius: '50%',
            background: `radial-gradient(closest-side, ${rgbaHex(glow.body, seedA)} 0%, ${rgbaHex(glow.body, seedA * 0.34)} 40%, ${rgbaHex(glow.body, seedA * 0.08)} 72%, ${rgbaHex(glow.body, 0)} 100%)`,
          }}
        />
      ) : null}
      {ringOn ? (
        <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} aria-hidden>
          <circle cx={pose.x} cy={pose.y} r={(pose.d / 2) * (1 + 0.5 * rq)} fill="none" stroke={SUNDAY.orb[2]} strokeOpacity={(0.55 * (1 - rq)).toFixed(4)} strokeWidth={1.5 + young} />
        </svg>
      ) : null}
      {d > 0.5 && closeDot < 1 ? (
        <div style={{ position: 'absolute', left: 0, top: 0, width: D, height: D, transformOrigin: '50% 50%', opacity: closeDot > 0 ? 1 - closeDot : undefined, ...subpixel(tf, moving) }}>
          {rimS > 0.001 ? <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', boxShadow: rimGlow(glow, rimS, D / 400, { shadow }) }} /> : null}
          <Orb size={D} palette={relight >= 1 ? SUNDAY.orb : RUSH.orb} paletteB={relight >= 1 ? SUNDAY.listen : SUNDAY.orb} mixB={relight >= 1 ? listenMix * lis : relight} volume={vol} time={track.flow(t)} resolution={1.5 * dpr()} />
        </div>
      ) : null}
      {dotA > 0.002 ? (
        <div style={{ position: 'absolute', left: pose.x - dot0 / 2, top: pose.y - dot0 / 2, width: dot0, height: dot0, opacity: dotA }}>
          <MeshOrb size={dot0} palette={RUSH.orb} time={11.4 + t / 30} />
        </div>
      ) : null}
      {closeDot > 0 && close ? <LineLight t={t - (close.t0 ?? 0)} x={pose.x} y={pose.y} d={close.dot} opacity={closeDot} /> : null}
    </div>
  );
};
