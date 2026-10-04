/**
 * CLOSE · b17–b18 — the stage: every position, light and grade of the close as a PURE FUNCTION of the act's time
 * (cta-local: 0 = the close's bar, where the darkening landed). Times are CTA_LOCAL (src/kb/timing.ts).
 *
 *   ctaLayout(vertical)  the frame: her dot (where b16 left it), the four corner stations of the lights, the ring's
 *                        centre, the core P (the wordmark's cap line — film 1's end-card geometry), the heading,
 *                        the backlight and the end card's rows
 *   groundAt(t, G, L)    the mesh: b16's last ground exactly on frame 0 (INK_MESH, deep, near black, keyed teal on
 *                        her dot), then THE VIOLET ROOM comes up; the room's key follows the source — her dot → her
 *                        light → the converging core → the backlight
 *   lightsAt(t, G)       THE FOUR LIGHTS (emitters: a core's diameter, its pop, light and flash — Cta.tsx draws the
 *                        core and its bloom): one at a time on 8ths from the corners, sunday first (b16's dot settled
 *                        into her point of light over K.dotMorph, springing open on her 8th); a slow
 *                        drift toward the centre (the ring turning on, counter-clockwise, the way they arrived);
 *                        the converge (a swell, a whirl, a spiral into the core); the merge into HER light; the
 *                        burst on the impact
 *   bloomAt / breathAt   film 1's merged light opening out of the core on the impact (BLOOM), breathing under the
 *                        end card, pinned to rest for the hold; arriveAt: when the light reaches a letter
 *   endLight(t)          the picture fading with the master (MIX.fadeOut's curve, as light)
 */
import { ALL_GLOW, mixColor } from '../../../lib/lights';
import { EASE, mix, springAt, springUnit, tween, windowed } from '../../../lib/motion';
import { MOMENT_LIGHTS, type MomentId } from '../../palettes';
import { CTA_LOCAL as K, MATTERS_LOCAL, MIX, SCENES } from '../../timing';
import { VOICE, type VoiceId } from '../../voice.generated';
import { dotAt, groundGrade, mattersLayout } from '../matters/stage';

export type Pt = { x: number; y: number };

/* ── the frame ─────────────────────────────────────────────────── */

export type CtaLayout = {
  vertical: boolean;
  W: number;
  H: number;
  /** her teal dot where b16 left it (screen px) and its drawn diameter */
  dot: Pt & { d: number };
  /** the lights' corner stations, in light order (sunday, rush, closing, night) */
  stations: Pt[];
  /** the ring's centre at rest; the core (the wordmark's cap-line centre, where the lights converge) */
  C0: Pt;
  P: Pt;
  /** the ring's ellipse: y radius / x radius */
  aspect: number;
  /** a light at rest (an emitter, never a body): its white-hot core's diameter and its bloom's σ (px) */
  core: number;
  bloom: number;
  heading: { cy: number; size: number };
  /** the backlight (film 1's): radii rx / ry above / ry below; the scale it opens from; its floor */
  halo: readonly [number, number, number];
  bloomFrom: number;
  floor: { dy: number; len: number; k: number; rise: number };
  wordmark: number;
  button: { y: number; size: number };
  note: { y: number; size: number };
  url: { y: number; size: number; dot: number; rule: number };
  /** the mesh key's radius on b16's last frame (Matters.tsx: L.pick(620, 600) × .88) */
  keyR0: number;
};

const LIGHT_ORDER = K.lightOrder;

export function ctaLayout(vertical: boolean): CtaLayout {
  const g = mattersLayout(vertical);
  const end = dotAt(MATTERS_LOCAL.end, vertical);
  const dot = { x: end.x, y: end.y, d: g.clock.dot * end.z };
  if (!vertical) {
    // 16:9: her dot is the top-right station (b16 left it at the clock's colon); the other three mirror it about the
    // frame's centre — the four corners of the frame, the heading in the middle of them
    const C0 = { x: 960, y: 540 };
    const dx = dot.x - C0.x;
    const dy = dot.y - C0.y;
    return {
      vertical,
      W: 1920,
      H: 1080,
      dot,
      stations: [
        { x: C0.x + dx, y: C0.y + dy },
        { x: C0.x - dx, y: C0.y + dy },
        { x: C0.x - dx, y: C0.y - dy },
        { x: C0.x + dx, y: C0.y - dy },
      ],
      C0,
      P: { x: 960, y: 370 },
      aspect: Math.abs(dy / dx),
      core: 9,
      bloom: 13,
      heading: { cy: 540, size: 100 },
      halo: [580, 236, 214],
      bloomFrom: 0.16,
      floor: { dy: 170, len: 190, k: 0.45, rise: 70 },
      wordmark: 160,
      button: { y: 700, size: 64 },
      note: { y: 850, size: 64 },
      url: { y: 968, size: 64, dot: 20, rule: 1400 },
      keyR0: 620 * 0.88,
    };
  }
  // 9:16: the four corners of the social safe zone (y 250 – 1500) round the heading (y 584 – 876), the ring's centre a
  // little under it so the lower pair holds the empty half of the frame; her dot (top centre, where b16 raised it)
  // opens into her light, which glides to its corner
  const C0 = { x: 540, y: 800 };
  const sx = 344;
  const sy = 420;
  return {
    vertical,
    W: 1080,
    H: 1920,
    dot,
    stations: [
      { x: C0.x + sx, y: C0.y - sy },
      { x: C0.x - sx, y: C0.y - sy },
      { x: C0.x - sx, y: C0.y + sy },
      { x: C0.x + sx, y: C0.y + sy },
    ],
    C0,
    P: { x: 540, y: 650 },
    aspect: sy / sx,
    core: 9,
    bloom: 13,
    heading: { cy: 730, size: 92 },
    halo: [400, 192, 180],
    bloomFrom: 0.2,
    floor: { dy: 160, len: 170, k: 0.4, rise: 60 },
    wordmark: 116,
    button: { y: 1030, size: 56 },
    note: { y: 1180, size: 56 },
    url: { y: 1318, size: 56, dot: 18, rule: 1080 - 2 * 86 },
    keyR0: 600 * 0.88,
  };
}

/* ── curves ─────────────────────────────────────────────────────── */

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** a light's arrival flash: up over ≈ 1.5 frames (6 render frames — a bloom, never a one-frame strobe), down over ≈ 4,
 *  normalised to peak 1 */
const arrivalFlash = (u: number) => (u <= 0 ? 0 : ((1 - Math.exp(-u)) * Math.exp(-u / 4)) / 0.535);
/** a point of its light gathers over the 3 f before the beat and hands over to the light's own core (film 1's) */
const gatherAt = (u: number) => (u < -3 ? 0 : u < 0 ? Math.sin(((u + 3) / 3) * (Math.PI / 2)) : Math.max(0, 1 - u / 2.5));
/** a light's pop: ≈15 % overshoot, settled in ~12 f; it starts POP_LEAD before its 8th (film 1's ORB_POP) */
const ORB_POP = { stiffness: 340, damping: 18, mass: 0.9 };
const POP_LEAD = 1.5;
/** her point of light at rest before her 8th (× the full size and light): b16's dot, settled into an emitter */
const HER_REST = 0.72;
/** 0 → 1: b16's teal dot settling into her point of light (K.dotMorph, an in-out) */
export const dotMorphAt = (t: number) => EASE.inOut(clamp01((t - K.dotMorph[0]) / (K.dotMorph[1] - K.dotMorph[0])));
/** the backlight opening behind the word: ≈4 % over, settled in ≈16 f (film 1's BLOOM) */
export const BLOOM = { stiffness: 130, damping: 16.5, mass: 1 };
export const smoothUnit = (x: number) => {
  const u = clamp01(x);
  return u * u * (3 - 2 * u);
};

/** Pin a residual to its exact rest value by the final hold (eased over K.settle). */
export const rest = (t: number, v: number, target: number) => {
  if (t >= K.settle[1]) return target;
  if (t <= K.settle[0]) return v;
  return mix(v, target, EASE.inOut((t - K.settle[0]) / (K.settle[1] - K.settle[0])));
};

/** A line's real loudness at cta-local frame t (0 outside it). */
export function envAt(id: VoiceId, at: number, t: number) {
  const e = VOICE.lines[id].env;
  const k = t - at;
  if (k < 0 || k > e.length - 1) return 0;
  const i = Math.floor(k);
  const f = k - i;
  return e[i] * (1 - f) + (e[Math.min(e.length - 1, i + 1)] ?? 0) * f;
}
export const lineEnv = (t: number) => envAt('kb2-vo-9', K.vo9, t);
export const brandEnv = (t: number) => envAt('kb2-brand', K.brand, t);

/* ── the ground ─────────────────────────────────────────────────── */

/**
 * THE VIOLET ROOM (the night's level): the deep INK_MESH opened from b16's dark into a room you can see the material
 * in — the floor (m2) ≈ #1a0a40–#20004b (OKLCH L .22), the electric and indigo pools violet at about a third of the
 * site's lightness, her teal pool the key. A third of the mesh's own lift keeps the deepest pool (m0, lower right) a
 * deep violet (L .12) instead of crushing it to black; the lit shade is held low so the corners fall off without going
 * out. White type on it stays above 10:1. The key pulls the top-right m2 pool (the floor's own colour), not the white
 * m4 one: the m4 sheen stays at home, top left, so the teal key never greys and the converge never fogs the centre
 * (on b16's last frame, at its 7 % brightness, the two pulls differ by under 2 levels: the swap is invisible). The pools drift a little wider and faster than b16's (the room breathes: × `drift`, the clock × `speed`,
 * both eased in with the light so the field never jumps on the cut).
 */
const NIGHT = { brightness: 0.33, saturation: 1.2, shade: 0.15, key: 0.68, lift: 0.3, drift: 1.3, speed: 1.25 } as const;
const SUNDAY = MOMENT_LIGHTS.sunday;
/** the mesh pool the key pulls (kit/mesh.ts FLOW index 3: the m2 pool at 80/26) */
const KEY_POOL = 3;
/** the backlight's light on the ground (its mid stop, the night's light #b298f6) */
export const BACKLIGHT_MID = '#b298f6';

/** the night's rise: C¹ (no slope on the cut — the darkening landed with none), front-loaded (its steepest a quarter of
 *  the way in: the room comes up out of the dark at once and settles slowly), and its integral (for the mesh's clock) */
const riseCurve = (u: number) => {
  const x = clamp01(u);
  return 1 - Math.pow(1 - x, 4) * (1 + 4 * x);
};
const riseIntegral = (u: number) => {
  const x = clamp01(u);
  return x - 1 / 3 + Math.pow(1 - x, 5) - (2 / 3) * Math.pow(1 - x, 6) + Math.max(0, u - 1);
};

export type GroundState = {
  /** the mesh's clock (timeline frames: b16's on the cut, then running × NIGHT.speed) */
  clock: number;
  drift: number;
  lift: number;
  brightness: number;
  saturation: number;
  shade: number;
  key: { x: number; y: number; strength: number; color: string; radius: number; pool: number };
};

/**
 * The mesh at t. Frame 0 is b16's last ground exactly (matters/stage.ts groundGrade at its end — `lift0` is the lift
 * Matters.tsx draws it with — and Matters.tsx's key: strength .5, the sunday orb's deep teal, radius × .88). The violet
 * room comes up over K.night (riseCurve). The key follows the source.
 */
export function groundAt(t: number, G: CtaLayout, lights: LightState[], lift0: number): GroundState {
  const g0 = groundGrade(MATTERS_LOCAL.end);
  const D = K.night[1] - K.night[0];
  const up = riseCurve((t - K.night[0]) / D);
  const impact = t < K.impact ? 0 : springUnit(t - K.impact, BLOOM);
  // THE INHALE: as the four become one the room draws its breath — its light sinks toward the core's own, so the
  // impact opens out of a darker room — and lets it go as the backlight opens
  const inhale = t < K.impact ? tween(t, [K.merge[0], K.impact], [0, 1], EASE.in2) : Math.max(0, 1 - Math.min(1, impact));
  let brightness = mix(g0.brightness, NIGHT.brightness, up) + 0.04 * Math.min(1.2, impact) - 0.11 * inhale;
  const saturation = mix(g0.saturation, NIGHT.saturation, up);
  const shade = mix(g0.shade, NIGHT.shade, up);
  const lift = mix(lift0, NIGHT.lift, up);
  // the field: b16's clock on the cut, then a little quicker and wider as the room comes up (the clock is the integral
  // of its speed, so it never jumps)
  const clock = SCENES.cta.from + t + (NIGHT.speed - 1) * D * riseIntegral(Math.max(0, t - K.night[0]) / D);
  const drift = mix(1, NIGHT.drift, up);
  // the key: on her dot, then on her light as it opens (the pool glides with it), then on the converging core,
  // then the backlight's own light on the ground
  const sun = lights[0];
  const onOrb = EASE.inOut(clamp01((t - K.lights[0]) / 6));
  let kx = mix(G.dot.x, sun.x, onOrb);
  let ky = mix(G.dot.y, sun.y, onOrb);
  const toCore = EASE.inOut(clamp01((t - K.converge) / (K.impact - K.converge)));
  kx = mix(kx, G.P.x, toCore);
  ky = mix(ky, G.P.y, toCore);
  const glow = clamp01(impact);
  // (her teal on the violet room: the deep teal of b16's key opened a third of the way to her body colour as the room
  // comes up, so the pool reads teal, not the blue a deep teal makes screened over violet; on the converge it becomes
  // the merged light's own colour, then the backlight's)
  const teal = mixColor(SUNDAY.orb[1], SUNDAY.orb[2], 0.35 * up);
  const color = mixColor(mixColor(teal, ALL_GLOW.body, toCore), BACKLIGHT_MID, glow);
  const strength = (mix(0.5, NIGHT.key, up) + 0.08 * glow) * (1 - 0.4 * inhale);
  const radius = mix(G.keyR0, Math.sqrt(G.W * G.H) * 0.5, Math.max(0.4 * toCore, glow));
  brightness = rest(t, brightness, NIGHT.brightness + 0.04);
  return { clock, drift, lift, brightness, saturation, shade, key: { x: kx, y: ky, strength, color, radius, pool: KEY_POOL } };
}

/* ── the four lights ────────────────────────────────────────────── */

export type LightState = {
  id: MomentId;
  i: number;
  x: number;
  y: number;
  /** its white-hot core's drawn diameter (px) */
  d: number;
  /** its size factor (the pop spring) */
  pop: number;
  opacity: number;
  /** how lit (0 … 1), the arrival flash (peak 1), the gathering point */
  light: number;
  flash: number;
  gather: number;
};

/** the survivor of the merge: HER light (sunday, light 0) takes all four */
export const SURVIVOR = 0;

/** the ring's angular speed (rad / frame, counter-clockwise on screen) at t */
function omega(s: number) {
  let w = 0.0032;
  // the swell hesitates (anticipation), then the ring whirls up while still wide, then into the core
  w *= 1 - 0.5 * windowed(s, K.swell[0], K.swell[1], K.swell[1], K.orbIn[0] + 6, EASE.out3, EASE.inOut);
  w += 0.2 * tween(s, K.orbIn, [0, 1], EASE.inOut);
  return w;
}
const SPIN_STEP = 0.25;
let spinTab: Float64Array | null = null;
/** Θ(t) = ∫ω from the first light, tabulated at quarter frames (built once: K is fixed) */
function spinAt(t: number) {
  const s0 = K.lights[0];
  if (!spinTab) {
    const n = Math.ceil((K.impact + 8 - s0) / SPIN_STEP) + 2;
    spinTab = new Float64Array(n);
    for (let k = 1; k < n; k++) spinTab[k] = spinTab[k - 1] + omega(s0 + (k - 0.5) * SPIN_STEP) * SPIN_STEP;
  }
  const x = Math.max(0, t - s0) / SPIN_STEP;
  const k = Math.min(spinTab.length - 2, Math.floor(x));
  return spinTab[k] + (spinTab[k + 1] - spinTab[k]) * Math.min(1, x - k);
}
/** the spiral's radius: it holds wide while the whirl builds, then falls into the core */
export const collapseAt = (t: number) => Math.pow(tween(t, K.orbIn, [0, 1], (u) => u), 2.2);

/** The four lights at t (light order: sunday, rush, closing, night). */
export function lightsAt(t: number, G: CtaLayout): LightState[] {
  const drift = 1 - 0.12 * tween(t, K.drift, [0, 1], EASE.inOut);
  const swell = windowed(t, K.swell[0], K.swell[1], K.swell[1], K.orbIn[0] + 6, EASE.out3, EASE.inOut);
  const col = collapseAt(t);
  const radius = drift * (1 + 0.09 * swell) * (1 - col);
  const toCore = tween(t, [K.converge, K.orbIn[1]], [0, 1], EASE.inOut);
  const C = { x: mix(G.C0.x, G.P.x, toCore), y: mix(G.C0.y, G.P.y, toCore) };
  const phi = -spinAt(t);
  const cp = Math.cos(phi);
  const sp = Math.sin(phi);
  const inP = tween(t, K.orbIn, [0, 1], EASE.inOut);
  const toAll = tween(t, K.merge, [0, 1], EASE.inOut);
  const pour = tween(t, K.merge, [0, 1], EASE.in2);
  const squeeze = 1 - 0.14 * tween(t, K.squeeze, [0, 1], EASE.in2);
  const burst = tween(t, K.burst, [0, 1], EASE.out3);
  const vol = 0.12 + 0.75 * lineEnv(t);
  const glide = EASE.inOut(clamp01((t - K.sundayGlide[0]) / (K.sundayGlide[1] - K.sundayGlide[0])));

  return LIGHT_ORDER.map((id, i) => {
    const pAt = K.lights[i];
    // its place on the ring: its station's offset, turned in the ellipse's own space, scaled, about the moving centre
    const ox = G.stations[i].x - G.C0.x;
    const oy = (G.stations[i].y - G.C0.y) / G.aspect;
    const rx = (ox * cp - oy * sp) * radius;
    const ry = (ox * sp + oy * cp) * radius * G.aspect;
    let x = C.x + rx;
    let y = C.y + ry;
    if (i === 0) {
      // hers springs out of the dot and glides to its corner (16:9: the dot IS its corner)
      x = mix(G.dot.x, x, glide);
      y = mix(G.dot.y, y, glide);
    }
    // hers is already a point of light, at rest a size down (b16's dot settled into it over K.dotMorph); on her 8th it
    // springs open to full like the others. The others pop out of nothing (a gathering point first).
    const spring = t < pAt - POP_LEAD ? 0 : springAt(t, pAt - POP_LEAD, ORB_POP);
    const pop = i === 0 ? HER_REST * dotMorphAt(t) + (1 - HER_REST) * spring : spring;
    const size = pop;
    const flash = arrivalFlash(t - pAt);
    const gather = i === 0 ? 0 : gatherAt(t - pAt);
    const light = Math.min(1.15, pop);
    const survivor = i === SURVIVOR;
    const grow = survivor ? 1 + 1.2 * tween(t, K.merge, [0, 1], EASE.out3) : 1 - 0.55 * pour;
    let d = G.core * size * (1 + 0.04 * vol) * mix(1, 0.72, inP) * grow * (survivor ? squeeze : 1);
    let opacity = survivor ? 1 : 1 - toAll;
    if (t >= K.impact) {
      d *= survivor ? mix(1, 1.25, burst) : 0;
      opacity = survivor ? Math.pow(1 - burst, 2.2) : 0;
    }
    return { id, i, x, y, d, pop, opacity, light, flash, gather };
  });
}

/* ── the backlight ──────────────────────────────────────────────── */

/** the backlight's open state (0 → 1, BLOOM spring from the impact), pinned for the hold */
export const bloomAt = (t: number) => (t < K.impact ? 0 : rest(t, springUnit(t - K.impact, BLOOM), 1));

/** the light breathes under the end card, its amplitude easing to 0 into the hold, where it freezes */
export function breathAt(t: number) {
  if (t < K.breath || t >= K.breathOut[1]) return 0;
  const amp = tween(t, [K.breath, K.breath + 30], [0, 1], EASE.inOut) * (1 - tween(t, K.breathOut, [0, 1], EASE.inOut));
  return Math.sin(((t - K.breath) / 75) * Math.PI * 2) * amp;
}

/**
 * When the backlight reaches a letter |x| em from the word's centre (frames after the impact): each letter of
 * NEUROVOICE surfaces just after the light has passed it, from the centre out (film 1's arrive()).
 */
export function arriveAt(G: CtaLayout) {
  const wm = G.wordmark;
  const rxPx = G.halo[0];
  return (xEm: number) => {
    const target = Math.min(0.98, (xEm * wm + 0.3 * wm) / rxPx);
    if (target <= G.bloomFrom) return -1;
    for (let dt = 0; dt < 30; dt += 0.1) if (mix(G.bloomFrom, 1, springUnit(dt, BLOOM)) >= target) return dt + 1;
    return 10;
  };
}

/* ── the end ────────────────────────────────────────────────────── */

/**
 * THE END: the card's light goes out WITH its chord — MIX.fadeOut's window and curve (exponential, fadeK nepers,
 * landing on true zero; scripts/audio/mix.mjs), the audio gain taken as the light's intensity (linear light, so
 * ^(1/2.2) on screen): film 1's endLight.
 */
export function endLight(t: number) {
  const a = MIX.fadeOut[0] - SCENES.cta.from;
  const e = MIX.fadeOut[1] - SCENES.cta.from;
  if (t <= a) return 1;
  const u = Math.min(1, (t - a) / Math.max(1, e - 1 - a));
  const z = Math.exp(-MIX.fadeK);
  const g = Math.max(0, (Math.exp(-MIX.fadeK * u) - z) / (1 - z));
  return Math.pow(g, 1 / 2.2);
}
