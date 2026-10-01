/**
 * The call's voice model — driven by the REAL voices (src/voice.generated.ts:
 * VOICE.lines[id].env, the per-frame loudness of each spoken line). One
 * deterministic curve drives the orb (volume + flow time) and its listen
 * palette, so everything the viewer sees "hears" the same thing.
 *
 * Per-frame target (the site's levels, demo-script.ts):
 *   Ava speaking      .44 + .38 · env
 *   caller speaking   .15 + .15 · env   (and the orb eases to "listen")
 *   silence           .12
 *   the pickup spike (t < 40) on top.
 * Smoothing is the FluidOrb's own (attack 14/s, release 5/s); the palette
 * eases with k = 1 − e^(−7/30) per frame.
 *
 * Everything is precomputed once into per-frame tables (local call frames),
 * so a lookup is O(1) and pure.
 */
import { Easing } from 'remotion';
import { EASE, tween } from '../../lib/motion';
import { twistOrbVolume } from '../../lib/pickup';
import { CALL, FPS, SCENES } from '../../timing';
import { VOICE, type VoiceId } from '../../voice.generated';

export type Who = 'agent' | 'caller';

/** A line's loudness `f` frames after it starts (fractional ok; 0 outside the line). */
export function env(id: VoiceId, f: number): number {
  const e = VOICE.lines[id].env as readonly number[];
  if (f < 0 || f > e.length - 1) return 0;
  const i = Math.floor(f);
  const a = e[i] ?? 0;
  const b = e[i + 1] ?? 0;
  return a + (b - a) * (f - i);
}

/**
 * Syllable onsets in a line's loudness (frames from its start) within [from, to): where it climbs over
 * `thr` after having been under `thr`·0.6 — for words the voice says but the aligner has no word for
 * ("Oh,", "Um…", "Thank you!"), so they can be captioned on the real voice.
 */
export function onsets(id: VoiceId, from: number, to: number, thr = 0.3): number[] {
  const e = VOICE.lines[id].env as readonly number[];
  const out: number[] = [];
  let low = from <= 0 || (e[Math.max(0, Math.floor(from) - 1)] ?? 0) < thr * 0.6;
  for (let f = Math.max(0, Math.floor(from)); f < Math.min(e.length, to); f++) {
    if (low && e[f] >= thr) {
      out.push(f);
      low = false;
    } else if (e[f] < thr * 0.6) low = true;
  }
  return out;
}

/** The line being spoken at call-local frame t (or -1). */
export function lineAt(t: number): number {
  for (let i = 0; i < CALL.lines.length; i++) {
    const l = CALL.lines[i];
    if (t >= l.at && t < l.at + VOICE.lines[l.voice].frames) return i;
  }
  return -1;
}

/** The shot (the line whose turn it is) at call-local frame t: the last line started, or -1 before the first. */
export function turnAt(t: number): number {
  let k = -1;
  CALL.lines.forEach((l, i) => {
    if (t >= l.at) k = i;
  });
  return k;
}

/* ── table range (local call frames) ─────────────────────────────── */
const T0 = -20;
const T1 = SCENES.call.to - SCENES.call.from + SCENES.call.post + 4;
const N = T1 - T0 + 1;
const SUB = 4;

const IDLE = 0.12;
const sineOut = Easing.bezier(0.39, 0.575, 0.565, 1);

/** raw target level (before the orb's attack/release smoothing) */
function target(t: number): { v: number; caller: number; who: number } {
  const i = lineAt(t);
  if (i < 0) return { v: IDLE, caller: 0, who: -1 };
  const l = CALL.lines[i];
  const e = env(l.voice, t - l.at);
  return l.who === 'agent' ? { v: 0.44 + 0.38 * e, caller: 0, who: 0 } : { v: 0.15 + 0.15 * e, caller: 1, who: 1 };
}

/** twist-local frame that coincides with call t = 0 */
const TWIST_AT_PICKUP = SCENES.call.from - SCENES.twist.from; // 120

/** the pickup: the orb's hand-off level → 0.62 (0.12 s sine.out) → 0.14 (0.4 s) → idle */
function pickupLevel(t: number): number {
  const v0 = twistOrbVolume(TWIST_AT_PICKUP);
  if (t < 0) return twistOrbVolume(TWIST_AT_PICKUP + t);
  if (t < 4) return tween(t, [0, 4], [v0, 0.62], sineOut);
  if (t < 16) return tween(t, [4, 16], [0.62, 0.14], EASE.inOut);
  return tween(t, [16, 40], [0.14, IDLE], EASE.inOut);
}

const VOL = new Float32Array(N);
const LISTEN = new Float32Array(N);
const SPEAKER = new Float32Array(N); // 0 = Ava, 1 = caller (eased)
const TALK = new Float32Array(N); // speech-only level (no pickup), the orb's smoothing
const LIGHT = new Float32Array(N); // a fast syllable follower of Ava's voice, for the light she gives off

(() => {
  const aAtk = 1 - Math.exp(-14 / FPS);
  const aRel = 1 - Math.exp(-5 / FPS);
  const aPal = 1 - Math.exp(-7 / FPS);
  // the light follows syllables: quick attack (≈ 1.5 f), soft release (≈ 4 f)
  const lAtk = 1 - Math.exp(-40 / FPS);
  const lRel = 1 - Math.exp(-8 / FPS);
  let s = IDLE;
  let li = 0;
  let lis = 0;
  let spk = 0;
  let lastWho = 0;
  for (let i = 0; i < N; i++) {
    const t = T0 + i;
    let acc = 0;
    let cal = 0;
    for (let k = 0; k < SUB; k++) {
      const r = target(t + k / SUB - 0.5 + 0.5 / SUB);
      acc += r.v;
      cal = Math.max(cal, r.caller);
      if (r.who >= 0) lastWho = r.who;
    }
    const tg = acc / SUB;
    s += (tg - s) * (tg > s ? aAtk : aRel);
    const k = lineAt(t);
    const le = k >= 0 ? env(CALL.lines[k].voice, t - CALL.lines[k].at) * (CALL.lines[k].who === 'agent' ? 1 : 0.35) : 0;
    li += (le - li) * (le > li ? lAtk : lRel);
    LIGHT[i] = t < 0 ? 0 : li;
    lis += (cal - lis) * aPal;
    spk += (lastWho - spk) * 0.28;
    TALK[i] = s;
    VOL[i] = t < 0 ? pickupLevel(t) : Math.max(pickupLevel(t), s);
    LISTEN[i] = lis;
    SPEAKER[i] = spk;
  }
})();

function look(arr: Float32Array, t: number): number {
  const x = Math.min(N - 1, Math.max(0, t - T0));
  const i = Math.floor(x);
  const f = x - i;
  const a = arr[i];
  const b = arr[Math.min(N - 1, i + 1)];
  return a + (b - a) * f;
}

/** The orb volume at a local call frame (fractional ok). */
export const volumeAt = (t: number) => look(VOL, t);
/** 0..1 — how far the orb has eased into the listen palette. */
export const listenAt = (t: number) => look(LISTEN, t);
/** 0 = Ava speaking last, 1 = caller (eased). */
export const speakerAt = (t: number) => look(SPEAKER, t);
/** Speech-only level (idle 0.12 … ~0.82), with the orb's release. */
export const talkAt = (t: number) => look(TALK, t);
/** 0..1 — a fast follower of the voice's syllables (Ava full, the caller at .35): the light the orb gives off. */
export const lightAt = (t: number) => look(LIGHT, t);

/**
 * The orb's flow-time integrator input on the frame index the twist uses for
 * its orb (twist t + 8), extended with the call's curve, so
 * flowTime(t + ORB_FRAME0, orbVolumeByIndex) continues the twist's orb
 * without a jump.
 */
export const ORB_FRAME0 = TWIST_AT_PICKUP + 8; // 128
export const orbVolumeByIndex = (fr: number) =>
  fr < ORB_FRAME0 ? twistOrbVolume(fr - 8) : volumeAt(fr - ORB_FRAME0);
