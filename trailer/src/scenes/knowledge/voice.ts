/**
 * The reader's voice model: ONE per-frame curve drives the orb (volume and
 * flow time), so it listens to the caller's REAL envelope (kb-1), reads,
 * goes quiet on the miss, and — relit — breathes with Ava's REAL envelope
 * (kb-2).
 * Levels are the site's (VOL); smoothing is the FluidOrb's own (attack 14/s,
 * release 5/s). Precomputed once into a table of knowledge-local frames.
 */
import { Easing } from 'remotion';
import { EASE, tween } from '../../lib/motion';
import { FPS, KNOWLEDGE, KNOWLEDGE_LOCAL, SCENES, vFrames } from '../../timing';
import { VOICE, type VoiceId } from '../../voice.generated';
import { VOL } from './geometry';
import { relitAt } from './light';

const K = KNOWLEDGE;
const KL = KNOWLEDGE_LOCAL;

/** loudness 0..1 of a line `f` frames after it started (0 outside it) */
export function envAt(id: VoiceId, f: number): number {
  const e = VOICE.lines[id].env;
  const i = Math.floor(f);
  if (i < 0 || i >= e.length) return 0;
  const a = e[i];
  const b = i + 1 < e.length ? e[i + 1] : 0;
  return a + (b - a) * (f - i);
}

const sine = Easing.bezier(0.37, 0, 0.63, 1);
/** 0..1 bumps: the status dot's three reading pulses */
export function readPulse(t: number): number {
  const [at, gap, n] = KL.dotPulse;
  let v = 0;
  for (let k = 0; k < n; k++) {
    const u = (t - (at + k * gap)) / gap;
    if (u >= 0 && u <= 1) v = Math.max(v, Math.sin(Math.PI * sine(u)));
  }
  return v;
}

/** raw target level (before the orb's own attack / release) */
function target(t: number): number {
  const askLen = vFrames(K.askVoice);
  const ansLen = vFrames(K.answerVoice);
  // relit, she speaks at the orb's full level; quiet in between
  const lit = VOL.miss + (VOL.rest - VOL.miss) * relitAt(t);
  if (t >= K.answer && t < K.answer + ansLen) return lit + 0.6 * envAt(K.answerVoice, t - K.answer);
  if (t >= K.answer) return lit;
  if (t >= K.miss) return VOL.miss + (VOL.rest - VOL.miss) * (1 - tween(t, KL.toGrey, [0, 1], EASE.inOut));
  if (t >= K.scan[0]) return VOL.rest + 0.06 * readPulse(t);
  if (t >= K.ask && t < K.ask + askLen) return VOL.listen + 0.15 * envAt(K.askVoice, t - K.ask);
  if (t >= K.ask) return VOL.listen;
  return VOL.rest;
}

const T0 = -SCENES.knowledge.pre - 2;
const T1 = SCENES.knowledge.to - SCENES.knowledge.from + SCENES.knowledge.post + 2;
let TABLE: Float32Array | null = null;
function table(): Float32Array {
  if (TABLE) return TABLE;
  const n = T1 - T0 + 1;
  const out = new Float32Array(n);
  const ka = 1 - Math.exp(-14 / FPS);
  const kr = 1 - Math.exp(-5 / FPS);
  let y = VOL.rest;
  for (let i = 0; i < n; i++) {
    const x = target(T0 + i);
    y += (x - y) * (x > y ? ka : kr);
    out[i] = y;
  }
  TABLE = out;
  return out;
}

/** the orb's (smoothed) volume at knowledge-local frame t */
export function volumeAt(t: number): number {
  const tb = table();
  const i = Math.max(0, Math.min(tb.length - 1, Math.floor(t) - T0));
  return tb[i];
}
