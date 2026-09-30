/**
 * The call's voice model — ONE deterministic curve that drives the orb
 * (volume + flow time), the waveform and the orb's listen palette, so
 * everything the viewer sees "hears" the same thing.
 *
 * Levels are the site's (demo-script.ts / demo-timeline.ts):
 *   idle 0.12 · pickup spike 0.62 then 0.14 · caller 0.18–0.3 ·
 *   Ava per word 0.52 + min(0.3, len·0.03), 0.44 between words.
 * Smoothing is the FluidOrb's own (attack 14/s, release 5/s), palette
 * easing k = 1 − exp(−dt·7). Speech follows the typewriter: a word "sounds"
 * while its characters are typed.
 *
 * Everything is precomputed once into per-frame tables (local call frames),
 * so a lookup is O(1) and pure.
 */
import { Easing } from 'remotion';
import { EASE, tween } from '../../lib/motion';
import { CALL, FPS, SCENES, TWIST } from '../../timing';

export type Who = 'agent' | 'caller';
export type Line = { at: number; who: Who; text: string };
export const LINES: Line[] = CALL.lines.map((l) => ({ at: l.at, who: l.who as Who, text: l.text }));

/** frames a line takes to type */
export const typeDur = (text: string) => text.length / CALL.typeRate;

/** word char spans of a line: [start, end) char indices */
export function wordSpans(text: string) {
  const out: { s: number; e: number; len: number }[] = [];
  let i = 0;
  for (const w of text.split(' ')) {
    out.push({ s: i, e: i + w.length, len: w.replace(/[^A-Za-z0-9']/g, '').length });
    i += w.length + 1;
  }
  return out;
}

/* ── table range (local call frames) ─────────────────────────────── */
const T0 = -20;
const T1 = SCENES.call.to - SCENES.call.from + SCENES.call.post + 4;
const N = T1 - T0 + 1;
const SUB = 4;

const IDLE = 0.12;
const sineOut = Easing.bezier(0.39, 0.575, 0.565, 1);

/** raw target level (before the orb's attack/release smoothing) */
function speechTarget(t: number): { v: number; caller: number; who: number } {
  let v = IDLE;
  let caller = 0;
  let who = -1;
  for (const line of LINES) {
    const dur = typeDur(line.text);
    const u = t - line.at;
    if (u < -1 || u > dur + 3) continue;
    const isAgent = line.who === 'agent';
    who = isAgent ? 0 : 1;
    if (!isAgent) caller = 1;
    const between = isAgent ? 0.44 : 0.18;
    let lv = between;
    const chars = u * CALL.typeRate;
    for (const w of wordSpans(line.text)) {
      if (chars >= w.s - 0.3 && chars < w.e + 0.3) {
        // a soft bump across the word (peak in its middle)
        const k = (chars - (w.s - 0.3)) / (w.e - w.s + 0.6);
        const bump = Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, k))), 0.6);
        const peak = isAgent ? 0.52 + Math.min(0.3, w.len * 0.03) : 0.22 + Math.min(0.08, w.len * 0.012);
        lv = between + (peak - between) * bump;
        break;
      }
    }
    // the breath before the first word and the tail after the last
    if (u < 0) lv = IDLE + (between - IDLE) * (u + 1);
    if (u > dur) lv = between;
    v = Math.max(v, lv);
  }
  return { v, caller, who };
}

/** the twist's own orb volume (Twist.tsx), so the orb's flow time carries across the cut */
function twistVolume(tt: number) {
  const shiver =
    tween(tt, [TWIST.ring2, TWIST.ring2 + 4], [0, 1], EASE.out3) *
    tween(tt, [TWIST.ring2 + 8, TWIST.ring2 + 20], [1, 0], EASE.inOut);
  return 0.12 + 0.12 * shiver + 0.1 * tween(tt, TWIST.pushToPhone, [0, 1], EASE.inOut);
}
/** twist-local frame that coincides with call t = 0 */
const TWIST_AT_PICKUP = SCENES.call.from - SCENES.twist.from; // 120

/** the pickup: the orb's hand-off level → 0.62 (0.12 s sine.out) → 0.14 (0.4 s) → idle */
function pickupLevel(t: number): number {
  const v0 = twistVolume(TWIST_AT_PICKUP);
  if (t < 0) return twistVolume(TWIST_AT_PICKUP + t);
  if (t < 4) return tween(t, [0, 4], [v0, 0.62], sineOut);
  if (t < 16) return tween(t, [4, 16], [0.62, 0.14], EASE.inOut);
  return tween(t, [16, 40], [0.14, IDLE], EASE.inOut);
}

const VOL = new Float32Array(N);
const LISTEN = new Float32Array(N);
const SPEAKER = new Float32Array(N); // 0 = Ava, 1 = caller (eased)
const TALK = new Float32Array(N); // 0..1 speech envelope (no pickup), the orb's smoothing
const TALK_FAST = new Float32Array(N); // the same speech with a quick release, for the level row

(() => {
  const aAtk = 1 - Math.exp(-14 / FPS);
  const aRel = 1 - Math.exp(-5 / FPS);
  const aPal = 1 - Math.exp(-7 / FPS);
  // the level row lets go quickly (12/s) so silence reads as silence
  const aRelFast = 1 - Math.exp(-12 / FPS);
  let s = IDLE;
  let sf = IDLE;
  let lis = 0;
  let spk = 0;
  let lastWho = 0;
  for (let i = 0; i < N; i++) {
    const t = T0 + i;
    let acc = 0;
    let cal = 0;
    for (let k = 0; k < SUB; k++) {
      const r = speechTarget(t + k / SUB - 0.5 + 0.5 / SUB);
      acc += r.v;
      cal = Math.max(cal, r.caller);
      if (r.who >= 0) lastWho = r.who;
    }
    const target = acc / SUB;
    s += (target - s) * (target > s ? aAtk : aRel);
    sf += (target - sf) * (target > sf ? aAtk : aRelFast);
    lis += (cal - lis) * aPal;
    spk += (lastWho - spk) * 0.28;
    TALK[i] = s;
    TALK_FAST[i] = sf;
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
/** 0 = Ava speaking last, 1 = caller (eased), for the waveform colour. */
export const speakerAt = (t: number) => look(SPEAKER, t);
/** Speech-only level (idle 0.12 … ~0.82), with the orb's slow release. */
export const talkAt = (t: number) => look(TALK, t);
/** Speech-only level with a fast (12/s) release — the waveform, so gaps fall silent. */
export const talkFastAt = (t: number) => look(TALK_FAST, t);

/**
 * The orb's flow-time integrator input on the GLOBAL-ish frame index the
 * twist uses for its orb (twist t + 8), extended with the call's curve, so
 * flowTime(t + ORB_FRAME0, orbVolumeByIndex) continues the twist's orb
 * without a jump.
 */
export const ORB_FRAME0 = TWIST_AT_PICKUP + 8; // 128
export const orbVolumeByIndex = (fr: number) =>
  fr < ORB_FRAME0 ? twistVolume(fr - 8) : volumeAt(fr - ORB_FRAME0);
