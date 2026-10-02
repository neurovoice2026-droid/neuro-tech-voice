/**
 * THE FOUR LIGHTS' choreography (pure: a function of the fractional CTA-local frame).
 *
 * ONE AT A TIME (client: "one at a time"; v8 director: four candy spheres in front of her
 * face at once was the rainbow look the brief bans). Rush, closing, sunday, night each get a
 * TURN of two beats (K.orbPops, on the downbeats):
 *
 *   arrive   a point of its light gathers over the 3 f before its beat; ON the beat the orb
 *            springs out of it, beside her face, on its own side (K.lightSide: rush left,
 *            closing right, sunday left, night right) — its light comes up with a short
 *            attack (never a one-frame strobe at 120 fps)
 *   key      it keys her face from that side: a slow arc on a small ring about her head (a
 *            little in front of her, cheek to eye height), rising and turning back as it goes;
 *            its spill is the only colour on her face (heroShader.ts, the key)
 *   go       its turn over (K.turnOut), it draws back into a point of its own light and goes
 *            out — gone before the next one gathers. The night (Ava's own light) stays: it
 *            holds on through the end of her line and slowly draws in (K.drift)
 *
 * THE CONVERGE: the three that went out come back (K.reIn, on 16ths) — all four together only
 * now — at four arms a quarter turn apart round her (the night glides into its arm), the ring
 * swells (anticipation), whirls up while it is still wide and spirals into the core, spinning
 * up as it closes (drawn crisp: the film renders at 120 fps, no simulated blur). Each keeps
 * its own light until they touch; then the three pour into the survivor (night), which takes
 * all four hues (ALL_LIGHTS), holds alone, is squeezed by the pull-back, and gives its light
 * to the backlight on the impact.
 */
import { ALL_LIGHTS, mixPalette } from '../../lib/lights';
import { EASE, mix, springAt, tween, windowed } from '../../lib/motion';
import { LIGHTS, LIGHT_ORDER, type LightId, type Palette } from '../../theme';
import { CTA, CTA_LOCAL as K } from '../../timing';
import { VOICE, type VoiceId } from '../../voice.generated';

/** A line's real loudness at (fractional) CTA-local frame t (0 outside the line). */
export function envAt(id: VoiceId, at: number, t: number) {
  const e = VOICE.lines[id].env;
  const k = t - at;
  if (k < 0 || k > e.length - 1) return 0;
  const i = Math.floor(k);
  const f = k - i;
  return e[i] * (1 - f) + (e[Math.min(e.length - 1, i + 1)] ?? 0) * f;
}
export const lineEnv = (t: number) => envAt(CTA.lineVoice, CTA.line, t);
export const brandEnv = (t: number) => envAt(CTA.brandVoiceId, CTA.brandVoice, t);

/**
 * The geometry (frame px, about her eyes E):
 *  the converge ring — radii, its centre's drop below the eyes, tilt (rad), orb diameter;
 *  key — a light's turn: the small ring it arcs on (radii, centre drop below the eyes), the
 *  angle it arrives at (θ from the front, 0 = in front of her, π/2 = beside her) and its
 *  angular speed (rad / frame).
 */
export type Orbit = {
  rx: number;
  ry: number;
  drop: number;
  tilt: number;
  d: number;
  key: { rx: number; ry: number; drop: number; a0: number; w: number };
};

/** an orb pop: ≈15 % overshoot, settled in ~12 f */
export const ORB_POP = { stiffness: 340, damping: 18, mass: 0.9 };
/** the pop's spring starts this many frames BEFORE its beat, so ON the beat the orb is
 *  already ~⅓ out of its point of light */
export const POP_LEAD = 1.5;

/**
 * A light's hit with an attack: 0 before the beat, up over ≈ 1 frame (τ = .5 f), down
 * over ≈ 3 (τ = 3 f) — normalised so its peak (≈ 1 f after the beat) is 1. At 120 fps the
 * peak grows over ≈ 4 render frames: a bloom, not a one-frame strobe.
 */
export const att = (u: number) => (u <= 0 ? 0 : 1 - Math.exp(-u / 0.5));
/** att(u)·e^(−u/D) at its maximum (u* = ln(1 + 2D) / 2) */
const hitPeak = (D: number) => ((2 * D) / (1 + 2 * D)) * Math.pow(1 + 2 * D, -1 / (2 * D));
export const hit = (u: number, decay = 3) => (u <= 0 || !Number.isFinite(u) ? 0 : (att(u) * Math.exp(-u / decay)) / hitPeak(decay));

/** the arrival's anticipation: a point of its light gathers over the 3 f before the beat, peaks
 *  ON it (inside the flash) and hands over to the orb over the next 2.5 f */
const gatherAt = (u: number) => (u < -3 ? 0 : u < 0 ? Math.sin(((u + 3) / 3) * (Math.PI / 2)) : Math.max(0, 1 - u / 2.5));

/** the night stays on; the others go out at the end of their turn */
const STAYS = 3;
/** 0 → 1 as light i draws back into a point at the end of its turn */
const goneAt = (t: number, i: number) => (i === STAYS ? 0 : tween(t, [K.orbPops[i] + K.turnOut[0], K.orbPops[i] + K.turnOut[1]], [0, 1], EASE.in2));
/** the converge's re-entry frame of light i (the night never left) */
const reInAt = (i: number) => (i < STAYS ? K.reIn[i] : -Infinity);

/** the converge ring's angular speed (rad/frame) at CTA-local frame s */
export function omega(s: number) {
  let w = 0.03;
  // the swell hesitates (anticipation), then the ring whirls up while it is still wide
  // (long sweeps) before it collapses into the core
  w *= 1 - 0.5 * windowed(s, K.orbSwell[0], K.orbSwell[1], K.orbSwell[1], K.orbIn[0] + 6, EASE.out3, EASE.inOut);
  w += 0.2 * tween(s, K.orbIn, [0, 1], EASE.inOut);
  return w;
}
/** the spiral's radius: it holds wide while the whirl builds, then falls into the core */
const COLLAPSE = (u: number) => Math.pow(u, 2.2);
export const collapseAt = (t: number) => COLLAPSE(tween(t, K.orbIn, [0, 1], (u) => u));

/** the converge: four arms a quarter turn apart, each on its light's side (rush L-back,
 *  closing R-front, sunday L-front, night R-back) */
const ARMS = [-2.356, 0.785, -0.785, 2.356] as const;
/** Θ(t) = ∫ω from the converge, tabulated at quarter frames */
export function spinTable(t: number) {
  const step = 0.25;
  const s0 = K.orbSwell[0] - 8;
  const n = Math.ceil((Math.max(s0, t) + 2 - s0) / step) + 1;
  const tab = new Float64Array(Math.max(2, n));
  for (let k = 1; k < tab.length; k++) tab[k] = tab[k - 1] + omega(s0 + (k - 0.5) * step) * step;
  return (tt: number) => {
    const x = Math.max(0, tt - s0) / step;
    const k = Math.min(tab.length - 2, Math.floor(x));
    return tab[k] + (tab[k + 1] - tab[k]) * (x - k);
  };
}
/** the converge ring's radius factor: 1, a swell, then into the core */
export function radiusAt(t: number) {
  const swell = windowed(t, K.orbSwell[0], K.orbSwell[1], K.orbSwell[1], K.orbIn[0] + 6, EASE.out3, EASE.inOut);
  return (1 + 0.09 * swell) * (1 - collapseAt(t));
}
/** the night glides from the end of its turn into its arm as the converge opens */
const toArmAt = (t: number) => tween(t, [K.orbSwell[0] - 2, K.orbIn[0] + 6], [0, 1], EASE.inOut);

export type OrbState = {
  id: LightId;
  i: number;
  x: number;
  y: number;
  /** drawn diameter (px, before the camera's layer zoom) */
  d: number;
  z: number;
  /** its size factor (the pop spring; 0 while it is out) */
  pop: number;
  opacity: number;
  palette: Palette;
  /** how lit it is (0 out … 1 keying her), the arrival flash (peak 1) and the gathering point */
  light: number;
  flash: number;
  gather: number;
  /** its side of her (−1 left, +1 right) */
  side: number;
};

type Pt = { x: number; y: number; z: number };

export function orbsAt(t: number, G: { E: { x: number; y: number }; P: { x: number; y: number }; orbit: Orbit }, spin: (tt: number) => number): OrbState[] {
  const O = G.orbit;
  const k = O.key;
  const rho = radiusAt(t);
  const col = collapseAt(t);
  const inP = tween(t, K.orbIn, [0, 1], EASE.inOut);
  const toAll = tween(t, K.merge, [0, 1], EASE.inOut);
  const vol = 0.12 + 0.75 * lineEnv(t);
  const squeeze = 1 - 0.14 * tween(t, [CTA.logoImpact - 4, CTA.logoImpact], [0, 1], EASE.in2);
  const pour = tween(t, K.merge, [0, 1], EASE.in2);
  const whirl = t > K.orbSwell[0] - 8 ? spin(t) - spin(K.orbSwell[0]) : 0;
  // the night draws in a little after "…seven" (tension before the converge)
  const drift = tween(t, K.drift, [0, 1], EASE.inOut);
  // a point on a ring (its centre c, radii, angle θ; tilted)
  const onRing = (c: { x: number; y: number }, rx: number, ry: number, th: number): Pt => {
    const z = Math.cos(th);
    const dx = rx * Math.sin(th);
    const dy = ry * z;
    return {
      x: c.x + dx * Math.cos(O.tilt) - dy * Math.sin(O.tilt),
      y: c.y + dx * Math.sin(O.tilt) + dy * Math.cos(O.tilt),
      z,
    };
  };
  // the converge ring's centre: under her eyes, into the core P as it collapses
  const ringC = { x: mix(G.E.x, G.P.x, col), y: mix(G.E.y + O.drop, G.P.y, col) };
  const keyC = { x: G.E.x, y: G.E.y + k.drop };

  return LIGHT_ORDER.map((id, i) => {
    const side = K.lightSide[i];
    const p0 = K.orbPops[i];
    /* ── its turn: a slow arc beside her face ── */
    const draw = i === STAYS ? 1 - 0.12 * drift : 1;
    const thKey = side * (k.a0 + k.w * Math.max(0, t - p0) - (i === STAYS ? 0.25 * drift : 0));
    const key = onRing(keyC, k.rx * draw, k.ry * draw, thKey);
    /* ── the converge: its arm, whirling in ── */
    const arm = onRing(ringC, O.rx * rho, O.ry * rho, ARMS[i] + whirl);
    const w = i === STAYS ? toArmAt(t) : t >= reInAt(i) - 3 ? 1 : 0;
    const pt: Pt = { x: mix(key.x, arm.x, w), y: mix(key.y, arm.y, w), z: mix(key.z, arm.z, w) };

    /* ── its size: the turn's pop, out into a point, the converge's re-entry ── */
    const turnPop = t < p0 - POP_LEAD ? 0 : springAt(t, p0 - POP_LEAD, ORB_POP);
    const gone = goneAt(t, i);
    const re = i === STAYS || t < reInAt(i) - POP_LEAD ? 0 : springAt(t, reInAt(i) - POP_LEAD, ORB_POP);
    const pop = turnPop * (1 - gone) + re;
    /* ── its light ── */
    const flash = hit(t - p0) + 0.6 * hit(t - reInAt(i));
    const gather = Math.max(gatherAt(t - p0), 0.6 * gatherAt(t - reInAt(i)));
    const light = Math.min(1.15, turnPop) * Math.pow(1 - gone, 2) + Math.min(1.15, re);

    const depth = 1 + 0.24 * pt.z * Math.min(1, w > 0 ? rho : 1);
    // the survivor (night) takes the others' light as they pour in: it grows to 2× its
    // in-spiral size, holds, then is squeezed (anticipation)
    const grow = i === STAYS ? 1 + 1.0 * tween(t, K.merge, [0, 1], EASE.out3) : 1 - 0.55 * pour;
    const d = O.d * depth * pop * (1 + 0.04 * vol) * mix(1, 0.72, inP) * grow * (i === STAYS ? squeeze : 1);
    const opacity = i < STAYS ? 1 - tween(t, K.merge, [0, 1], EASE.inOut) : 1;
    const palette = i === STAYS ? mixPalette(LIGHTS[id].orb, ALL_LIGHTS, toAll) : [...LIGHTS[id].orb];
    return { id, i, x: pt.x, y: pt.y, d, z: pt.z, pop, opacity, palette, light, flash, gather, side };
  });
}
