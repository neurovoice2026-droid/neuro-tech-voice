/**
 * THE FOUR LIGHTS' choreography (pure: a function of the CTA-local frame).
 *
 * The four orbs — rush, closing, sunday, night — pop in on 8ths at their
 * places on a tilted ring about her face and orbit it in depth (z = cos θ:
 * in front of her at θ = 0, behind her head at θ = π). The ring's centre
 * sits below her eyes, so its front passes under her chin, never over her
 * mouth. On "Twenty" "four" "seven" the ring tightens in three kicks and the
 * four lights come forward into a row in front of her (THE FORMATION: all
 * four in view, clear of her eyes and mouth, while "24/7." holds). At the
 * converge the row fans out into four arms, swells (anticipation) and
 * spirals into the core, spinning up as it closes (motion-blurred by the
 * scene). Each keeps its own light until they touch; then the three pour
 * into the survivor (night), which takes all four hues (ALL_LIGHTS), holds
 * alone, is squeezed by the pull-back, and bursts on the impact.
 */
import { ALL_LIGHTS, mixPalette } from '../../lib/lights';
import { EASE, mix, SPRING, springAt, tween, windowed } from '../../lib/motion';
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

/** radii, ring centre drop below the eyes, tilt (rad), orb diameter, how far the three kicks tighten it
 *  (1 = to .66), and how much lower the ring's centre sits in the formation */
export type Orbit = { rx: number; ry: number; drop: number; tilt: number; d: number; tight: number; formDrop: number };

/** an orb pop: ≈15 % overshoot, settled in ~12 f */
export const ORB_POP = { stiffness: 340, damping: 18, mass: 0.9 };
/** the pop's spring starts this many frames BEFORE its beat, so ON the beat (the
 *  hit frame, the brightest) the orb is already ~⅓ out inside its flash */
export const POP_LEAD = 1.5;
/** the pop's progress (0 before; the spring after; overshoots ≈1.15) */
export const popAt = (t: number, i: number) =>
  t < K.orbPops[i] - POP_LEAD ? 0 : springAt(t, K.orbPops[i] - POP_LEAD, ORB_POP);
/** where each orb pops on the ring (θ: 0 = in front of her, π = behind her
 *  head): front-right, back-right, back-left, front-left — all clear of her */
export const POP_PHASE = [0.55, 2.3, 4.0, 5.75] as const;
/** the orbit's angular speed (rad/frame) at CTA-local frame s */
export function omega(s: number) {
  let w = 0.026;
  K.tighten.forEach((f) => (w += 0.012 * tween(s, [f, f + 6], [0, 1], EASE.out3)));
  // the swell hesitates (anticipation), then the ring whirls up while it is
  // still wide (long, motion-blurred sweeps) before it collapses into the core
  w *= 1 - 0.5 * windowed(s, K.orbSwell[0], K.orbSwell[1], K.orbSwell[1], K.orbIn[0] + 6, EASE.out3, EASE.inOut);
  w += 0.2 * tween(s, K.orbIn, [0, 1], EASE.inOut);
  return w;
}
/** the spiral's radius: it holds wide while the whirl builds, then falls into the core */
const COLLAPSE = (u: number) => Math.pow(u, 2.2);
const collapseAt = (t: number) => COLLAPSE(tween(t, K.orbIn, [0, 1], (u) => u));

/** THE FORMATION: the four lights' places on the front of the ring, left to right (θ) */
const FORM = [-1.22, -0.4, 0.4, 1.22] as const;
/** … and at the converge, four arms a quarter turn apart (centred on the front) */
const ARMS = [-2.356, -0.785, 0.785, 2.356] as const;
/** how far into the formation (0 free orbit → 1 the row): it eases in from 16 f before
 *  "Twenty" (so no light is behind her when the number lands) and each word kicks it */
export function formAt(t: number) {
  const [w0, w1, w2] = K.tighten;
  const pre = tween(t, [w0 - 16, w0], [0, 0.62], EASE.inOut);
  const k1 = t < w1 ? 0 : 0.24 * springAt(t, w1, SPRING.pop);
  const k2 = t < w2 ? 0 : 0.14 * springAt(t, w2, SPRING.pop);
  return pre + k1 + k2;
}
/** the row fans out into the four arms as the orbit swells */
const fanAt = (t: number) => tween(t, [K.orbSwell[0], K.orbIn[0] + 8], [0, 1], EASE.inOut);
/** where the formation starts (its slots are dealt out here, in the lights' order round the ring) */
const FORM_REF = () => K.tighten[0] - 16;
const wrap = (a: number) => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));
/** Θ(t) = ∫ω, tabulated once per frame at quarter frames */
export function spinTable(t: number) {
  const step = 0.25;
  const n = Math.ceil((t + 2) / step) + 1;
  const tab = new Float64Array(Math.max(2, n));
  for (let k = 1; k < tab.length; k++) {
    const s = (k - 0.5) * step;
    tab[k] = tab[k - 1] + omega(s) * step;
  }
  return (tt: number) => {
    const x = Math.max(0, tt) / step;
    const k = Math.min(tab.length - 2, Math.floor(x));
    return tab[k] + (tab[k + 1] - tab[k]) * (x - k);
  };
}
/** the orbit's radius factor: 1, tightening in three kicks, a swell, then into the core */
export function radiusAt(t: number, tight = 1) {
  let r = 1;
  const steps = [0.14, 0.11, 0.09];
  K.tighten.forEach((f, k) => (r -= tight * steps[k] * (t < f ? 0 : springAt(t, f, SPRING.pop))));
  const swell = windowed(t, K.orbSwell[0], K.orbSwell[1], K.orbSwell[1], K.orbIn[0] + 6, EASE.out3, EASE.inOut);
  return r * (1 + 0.09 * swell) * (1 - collapseAt(t));
}

/**
 * Each light's angle on the ring at t: the free orbit (its pop place, carried
 * round by Θ), blended toward its formation slot (dealt out in ring order, so
 * no two ever cross) by formAt; in the converge the slots fan into four arms
 * that whirl with Θ.
 */
export function anglesAt(t: number, spin: (tt: number) => number) {
  const free = LIGHT_ORDER.map((_, i) => POP_PHASE[i] - spin(K.orbPops[i]) + spin(t));
  const g = formAt(t); // (the word kicks overshoot the row a little, then settle)
  if (g <= 0) return free;
  const tr = FORM_REF();
  const ref = LIGHT_ORDER.map((_, i) => POP_PHASE[i] - spin(K.orbPops[i]) + spin(tr));
  const rank = ref.map((a, i) => ({ a: wrap(a), i })).sort((p, q) => p.a - q.a);
  const slotOf: number[] = [];
  rank.forEach((r, k) => (slotOf[r.i] = k));
  // the whirl: Θ's turn since the converge began (0 before)
  const whirl = t > K.orbSwell[0] ? spin(t) - spin(K.orbSwell[0]) : 0;
  const fan = fanAt(t);
  return free.map((th, i) => {
    const k = slotOf[i];
    // the slot, as the nearest turn to where this light was when the formation began
    const turn = 2 * Math.PI * Math.round((ref[i] - FORM[k]) / (2 * Math.PI));
    const slot = mix(FORM[k], ARMS[k], fan) + turn + whirl;
    return th + g * (slot - th);
  });
}

export type OrbState = {
  id: LightId;
  i: number;
  x: number;
  y: number;
  d: number;
  z: number;
  pop: number;
  opacity: number;
  palette: Palette;
};

export function orbsAt(t: number, G: { P: { x: number; y: number }; orbit: Orbit }, spin: (tt: number) => number): OrbState[] {
  const O = G.orbit;
  const rho = radiusAt(t, O.tight);
  const inP = tween(t, K.orbIn, [0, 1], EASE.inOut);
  // each keeps its own light until they touch; only the survivor takes all four
  const toAll = tween(t, K.merge, [0, 1], EASE.inOut);
  const vol = 0.12 + 0.75 * lineEnv(t);
  const squeeze = 1 - 0.14 * tween(t, [CTA.logoImpact - 4, CTA.logoImpact], [0, 1], EASE.in2);
  // the ring's centre: below the eyes (lower still in the formation), into the core as it collapses
  const drop = (O.drop + O.formDrop * Math.min(1, formAt(t))) * (1 - collapseAt(t));
  const ths = anglesAt(t, spin);
  const pour = tween(t, K.merge, [0, 1], EASE.in2);
  return LIGHT_ORDER.map((id, i) => {
    const th = ths[i];
    const z = Math.cos(th);
    const dx = O.rx * rho * Math.sin(th);
    const dy = O.ry * rho * z + drop;
    const x = G.P.x + dx * Math.cos(O.tilt) - dy * Math.sin(O.tilt);
    const y = G.P.y + dx * Math.sin(O.tilt) + dy * Math.cos(O.tilt);
    const pop = popAt(t, i);
    const depth = 1 + 0.24 * z * Math.min(1, rho);
    // the survivor (night) takes the others' light as they pour in: it grows to 2× its
    // in-spiral size (≈1.45× its orbit size), holds, then is squeezed (anticipation)
    const grow = i === 3 ? 1 + 1.0 * tween(t, K.merge, [0, 1], EASE.out3) : 1 - 0.55 * pour;
    const d = O.d * depth * pop * (1 + 0.04 * vol) * mix(1, 0.72, inP) * grow * (i === 3 ? squeeze : 1);
    const opacity = i < 3 ? 1 - tween(t, K.merge, [0, 1], EASE.inOut) : 1;
    const palette = i === 3 ? mixPalette(LIGHTS[id].orb, ALL_LIGHTS, toAll) : [...LIGHTS[id].orb];
    return { id, i, x, y, d, z, pop, opacity, palette };
  });
}

