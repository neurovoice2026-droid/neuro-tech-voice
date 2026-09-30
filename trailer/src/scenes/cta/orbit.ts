/**
 * THE FOUR LIGHTS' choreography (pure: a function of the CTA-local frame).
 *
 * The four orbs — rush, closing, sunday, night — pop in on 8ths at their
 * places on a tilted ring about her eyes and orbit it in depth (z = cos θ:
 * in front of her at θ = 0, behind her head at θ = π); the ring tightens and
 * quickens in three kicks ON "Twenty" "four" "seven"; at the converge it
 * swells (anticipation) and spirals into the core, spinning up as it closes
 * (motion-blurred by the scene), the palettes flowing into ALL_LIGHTS; the
 * back three go as the night covers them, and the survivor is squeezed by
 * the pull-back before it bursts on the impact.
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

export type Orbit = { rx: number; ry: number; drop: number; tilt: number; d: number };

/** an orb pop: ≈12 % overshoot, settled in ~12 f */
export const ORB_POP = { stiffness: 340, damping: 18, mass: 0.9 };
/** where each orb pops on the ring (θ: 0 = in front of her, π = behind her
 *  head): front-right, back-right, back-left, front-left — all clear of her */
export const POP_PHASE = [0.55, 2.3, 4.0, 5.75] as const;
/** the orbit's angular speed (rad/frame) at CTA-local frame s */
export function omega(s: number) {
  let w = 0.02;
  K.tighten.forEach((f) => (w += 0.012 * tween(s, [f, f + 6], [0, 1], EASE.out3)));
  // the swell hesitates (anticipation), then the spiral spins up as it closes in
  w *= 1 - 0.5 * windowed(s, K.orbSwell[0], K.orbSwell[1], K.orbSwell[1], K.orbIn[0] + 6, EASE.out3, EASE.inOut);
  w += 0.22 * tween(s, K.orbIn, [0, 1], EASE.in2);
  return w;
}
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
export function radiusAt(t: number) {
  let r = 1;
  const steps = [0.14, 0.11, 0.09];
  K.tighten.forEach((f, k) => (r -= steps[k] * (t < f ? 0 : springAt(t, f, SPRING.pop))));
  const swell = windowed(t, K.orbSwell[0], K.orbSwell[1], K.orbSwell[1], K.orbIn[0] + 6, EASE.out3, EASE.inOut);
  return r * (1 + 0.09 * swell) * (1 - tween(t, K.orbIn, [0, 1], EASE.in2));
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
  const rho = radiusAt(t);
  const inP = tween(t, K.orbIn, [0, 1], EASE.inOut);
  const toAll = tween(t, [K.orbIn[0] + 4, K.merge[1]], [0, 1], EASE.inOut);
  const vol = 0.12 + 0.75 * lineEnv(t);
  const squeeze = 1 - 0.16 * tween(t, [CTA.logoImpact - 4, CTA.logoImpact], [0, 1], EASE.in2);
  return LIGHT_ORDER.map((id, i) => {
    const th = POP_PHASE[i] - spin(K.orbPops[i]) + spin(t);
    const z = Math.cos(th);
    const dx = O.rx * rho * Math.sin(th);
    const dy = O.ry * rho * z + O.drop * rho;
    const x = G.P.x + dx * Math.cos(O.tilt) - dy * Math.sin(O.tilt);
    const y = G.P.y + dx * Math.sin(O.tilt) + dy * Math.cos(O.tilt);
    const pop = t < K.orbPops[i] ? 0 : springAt(t, K.orbPops[i], ORB_POP);
    const depth = 1 + 0.24 * z * Math.min(1, rho);
    // the survivor (night) takes the others' light as they merge: it grows, then is squeezed (anticipation)
    const grow = i === 3 ? 1 + 0.55 * tween(t, [K.merge[0] - 2, K.merge[1]], [0, 1], EASE.out3) : 1;
    const d = O.d * depth * pop * (1 + 0.04 * vol) * mix(1, 0.72, inP) * grow * (i === 3 ? squeeze : 1);
    const opacity = i < 3 ? 1 - tween(t, K.merge, [0, 1], EASE.inOut) : 1;
    const palette = mixPalette(LIGHTS[id].orb, ALL_LIGHTS, toAll, { stagger: id === 'closing' || id === 'sunday' ? 0.12 : 0 });
    return { id, i, x, y, d, z, pop, opacity, palette };
  });
}

