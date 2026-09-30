#!/usr/bin/env node
/**
 * Neuro Tech Voice trailer — sound design, synthesised from scratch.
 *
 * Pure Node (no dependencies), deterministic (seeded noise), ~1 s to run.
 * Writes 48 kHz / 24-bit stereo WAVs into public/sfx:
 *
 *   · every sound effect, each normalised to a -12 dBFS peak
 *   · bed.wav — a 30 s, 120 BPM ambient pad + beat, normalised to -20 dBFS
 *     peak (a placeholder you can swap for a licensed track: same file name,
 *     or change BED in src/timing.ts)
 *
 * Run automatically by remotion.config.ts before `remotion studio|render`,
 * or by hand: `node scripts/generate-sfx.mjs`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', 'public', 'sfx');
const SR = 48000;
const BPM = 120;
const BEAT = 60 / BPM; // seconds
const SFX_PEAK_DB = -12;
const BED_PEAK_DB = -20;
const BED_SECONDS = 30;

/* ─────────────────────────── DSP kit ─────────────────────────── */

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TAU = Math.PI * 2;
const buf = (sec) => [new Float32Array(Math.ceil(sec * SR)), new Float32Array(Math.ceil(sec * SR))];
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const dbToGain = (db) => Math.pow(10, db / 20);
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const expDecay = (t, tau) => Math.exp(-t / tau);
const smooth = (x) => x * x * (3 - 2 * x);

/** RBJ biquad; coefficients recomputed as the cutoff moves. */
class Biquad {
  constructor(type, f = 1000, q = 0.707) {
    this.type = type;
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
    this.set(f, q);
  }
  set(f, q = this.q) {
    this.f = f;
    this.q = q;
    const w = (TAU * clamp(f, 10, SR * 0.49)) / SR;
    const cos = Math.cos(w);
    const alpha = Math.sin(w) / (2 * q);
    let b0, b1, b2, a0, a1, a2;
    if (this.type === 'lp') {
      b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = (1 - cos) / 2;
    } else if (this.type === 'hp') {
      b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = (1 + cos) / 2;
    } else {
      // band-pass, constant 0 dB peak
      b0 = alpha; b1 = 0; b2 = -alpha;
    }
    a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha;
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
  }
  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

/** Freeverb-style stereo reverb (8 combs + 4 all-passes per side). */
function reverb([L, R], { room = 0.84, damp = 0.25, wet = 0.3, dry = 1, width = 1, pre = 0.01 } = {}) {
  const scale = SR / 44100;
  const combT = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((t) => Math.round(t * scale));
  const apT = [556, 441, 341, 225].map((t) => Math.round(t * scale));
  const spread = Math.round(23 * scale);
  const preN = Math.round(pre * SR);
  const make = (off) => ({
    combs: combT.map((t) => ({ b: new Float32Array(t + off), i: 0, s: 0 })),
    aps: apT.map((t) => ({ b: new Float32Array(t + off), i: 0 })),
  });
  const chans = [make(0), make(spread)];
  const n = L.length;
  const outL = new Float32Array(n);
  const outR = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const src = i - preN >= 0 ? (L[i - preN] + R[i - preN]) * 0.015 : 0;
    const w = [0, 0];
    for (let c = 0; c < 2; c++) {
      const ch = chans[c];
      let acc = 0;
      for (const cb of ch.combs) {
        const y = cb.b[cb.i];
        cb.s = y * (1 - damp) + cb.s * damp;
        cb.b[cb.i] = src + cb.s * room;
        cb.i = (cb.i + 1) % cb.b.length;
        acc += y;
      }
      for (const ap of ch.aps) {
        const bo = ap.b[ap.i];
        const y = -acc + bo;
        ap.b[ap.i] = acc + bo * 0.5;
        ap.i = (ap.i + 1) % ap.b.length;
        acc = y;
      }
      w[c] = acc;
    }
    const wet1 = wet * (width / 2 + 0.5);
    const wet2 = wet * ((1 - width) / 2);
    outL[i] = L[i] * dry + w[0] * wet1 + w[1] * wet2;
    outR[i] = R[i] * dry + w[1] * wet1 + w[0] * wet2;
  }
  return [outL, outR];
}

/** Add a mono signal into a stereo buffer with constant-power pan (-1..1). */
function addMono([L, R], start, sig, gain = 1, pan = 0) {
  const a = ((pan + 1) * Math.PI) / 4;
  const gl = Math.cos(a) * gain;
  const gr = Math.sin(a) * gain;
  const s0 = Math.round(start * SR);
  for (let i = 0; i < sig.length; i++) {
    const j = s0 + i;
    if (j < 0 || j >= L.length) continue;
    L[j] += sig[i] * gl;
    R[j] += sig[i] * gr;
  }
}

function softclip(x, drive = 1) {
  return Math.tanh(x * drive) / Math.tanh(drive);
}

function normalise([L, R], peakDb) {
  let peak = 0;
  for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const g = peak > 0 ? dbToGain(peakDb) / peak : 1;
  for (let i = 0; i < L.length; i++) { L[i] *= g; R[i] *= g; }
  return [L, R];
}

/** Short fades at both ends so nothing clicks. */
function edges([L, R], inMs = 1, outMs = 8) {
  const a = Math.round((inMs / 1000) * SR);
  const b = Math.round((outMs / 1000) * SR);
  for (let i = 0; i < a && i < L.length; i++) { L[i] *= i / a; R[i] *= i / a; }
  for (let i = 0; i < b && i < L.length; i++) {
    const k = L.length - 1 - i;
    L[k] *= i / b; R[k] *= i / b;
  }
  return [L, R];
}

function writeWav(name, [L, R]) {
  const n = L.length;
  const bytes = 3;
  const data = Buffer.alloc(n * 2 * bytes);
  let o = 0;
  for (let i = 0; i < n; i++) {
    for (const ch of [L, R]) {
      const v = Math.round(clamp(ch[i], -1, 1) * 8388607);
      data.writeIntLE(v, o, 3);
      o += 3;
    }
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2 * bytes, 28); h.writeUInt16LE(2 * bytes, 32);
  h.writeUInt16LE(bytes * 8, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  writeFileSync(path.join(OUT, name), Buffer.concat([h, data]));
}

/* ───────────────────────── generators ───────────────────────── */

/** Mono sine with an arbitrary frequency curve f(t) and amplitude a(t). */
function tone(sec, f, a, { phase = 0, shape = 'sine' } = {}) {
  const out = new Float32Array(Math.ceil(sec * SR));
  let ph = phase;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    ph += (TAU * f(t)) / SR;
    let s;
    if (shape === 'tri') s = (2 / Math.PI) * Math.asin(Math.sin(ph));
    else if (shape === 'saw') s = 2 * ((ph / TAU) % 1) - 1;
    else s = Math.sin(ph);
    out[i] = s * a(t);
  }
  return out;
}

/** Filtered noise with a moving filter. */
function noise(sec, seed, a, { type = 'bp', f = () => 1000, q = () => 0.8 } = {}) {
  const r = rng(seed);
  const out = new Float32Array(Math.ceil(sec * SR));
  const flt = type ? new Biquad(type, f(0), q(0)) : null;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    if (flt && i % 32 === 0) flt.set(f(t), q(t));
    const w = r() * 2 - 1;
    out[i] = (flt ? flt.run(w) : w) * a(t);
  }
  return out;
}

/** FM bell (Chowning): carrier c, ratio m, index decays with time. */
function bell(sec, freq, { ratio = 3.5, index = 4, tau = 0.8, idxTau = 0.25, attack = 0.002 } = {}) {
  const out = new Float32Array(Math.ceil(sec * SR));
  let pc = 0;
  let pm = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    pm += (TAU * freq * ratio) / SR;
    const idx = index * expDecay(t, idxTau);
    pc += (TAU * freq) / SR;
    const env = Math.min(1, t / attack) * expDecay(t, tau);
    out[i] = Math.sin(pc + idx * Math.sin(pm)) * env;
  }
  return out;
}

function mono2(sig) {
  return [Float32Array.from(sig), Float32Array.from(sig)];
}

/* ────────────────────────── the sounds ───────────────────────── */

const SFX = {};

/** A UI click: tight noise transient + short high blip. */
function clickSig(freq = 1900, seed = 1, len = 0.05) {
  const n = noise(len, seed, (t) => expDecay(t, 0.0022), { type: 'hp', f: () => 3500, q: () => 0.7 });
  const b = tone(len, () => freq, (t) => expDecay(t, 0.006) * 0.6);
  const out = new Float32Array(n.length);
  for (let i = 0; i < out.length; i++) out[i] = n[i] + b[i];
  return out;
}

SFX['click.wav'] = () => {
  const s = buf(0.25);
  addMono(s, 0, clickSig(1800, 11), 1);
  addMono(s, 0.004, clickSig(3200, 12, 0.03), 0.35);
  return reverb(s, { wet: 0.12, room: 0.6 });
};

for (let k = 0; k < 4; k++) {
  SFX[`tick-${k}.wav`] = () => {
    const s = buf(0.12);
    addMono(s, 0, clickSig(2300 + k * 330, 20 + k, 0.03), 1, (k - 1.5) * 0.25);
    return reverb(s, { wet: 0.08, room: 0.5 });
  };
}

for (let k = 0; k < 3; k++) {
  SFX[`pop-${k}.wav`] = () => {
    const s = buf(0.4);
    const f0 = [1150, 980, 1320][k];
    const body = tone(0.18, (t) => 320 + (f0 - 320) * expDecay(t, 0.018), (t) => Math.min(1, t / 0.0015) * expDecay(t, 0.05));
    const air = noise(0.05, 40 + k, (t) => expDecay(t, 0.006) * 0.25, { type: 'bp', f: () => 4200, q: () => 1.2 });
    addMono(s, 0, body, 1);
    addMono(s, 0, air, 1);
    return reverb(s, { wet: 0.18, room: 0.7 });
  };
}

/** Mechanical counter roll — ticks accelerating then braking (the clock). */
SFX['roll.wav'] = () => {
  const s = buf(0.9);
  const n = 16;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const t = 0.5 * (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
    addMono(s, t, clickSig(2600 + i * 40, 60 + i, 0.025), 0.55 + 0.45 * Math.sin(u * Math.PI), (i % 2 ? 0.2 : -0.2));
  }
  return reverb(s, { wet: 0.12, room: 0.55 });
};

/** Digits land: click + weighted thump. */
SFX['land.wav'] = () => {
  const s = buf(0.8);
  addMono(s, 0, clickSig(2000, 70), 0.8);
  addMono(s, 0, tone(0.35, (t) => 48 + 60 * expDecay(t, 0.03), (t) => Math.min(1, t / 0.002) * expDecay(t, 0.09)), 1.1);
  return reverb(s, { wet: 0.2, room: 0.72 });
};

/**
 * The ring: one 0.4 s burst of a warm, designed electronic ring — two
 * bell partials trilling at 25 Hz (a real phone's warble) through a soft
 * filter, with room.
 */
SFX['ring.wav'] = () => {
  const s = buf(1.4);
  const len = 0.4;
  const out = new Float32Array(Math.ceil(len * SR));
  let p1 = 0, p2 = 0, p3 = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const trill = 0.5 + 0.5 * Math.sign(Math.sin(TAU * 25 * t)); // 25 Hz warble
    const fA = trill ? 1318.5 : 1174.7; // E6 / D6
    p1 += (TAU * fA) / SR;
    p2 += (TAU * fA * 2.01) / SR;
    p3 += (TAU * fA * 0.5) / SR;
    const env = smooth(Math.min(1, t / 0.012)) * (t > len - 0.03 ? (len - t) / 0.03 : 1);
    out[i] = (Math.sin(p1) * 0.6 + Math.sin(p2) * 0.18 + Math.sin(p3) * 0.3) * env;
  }
  const lp = new Biquad('lp', 5200, 0.6);
  for (let i = 0; i < out.length; i++) out[i] = lp.run(out[i]);
  addMono(s, 0, out, 1);
  return reverb(s, { wet: 0.32, room: 0.8, damp: 0.35 });
};

/** Whooshes: band-passed noise sweeping, panned across. */
function whoosh(sec, seed, { f0 = 300, f1 = 3000, f2 = 800, peak = 0.55, q = 1.1, pan = [-0.7, 0.7], rumble = 0 } = {}) {
  const s = buf(sec + 0.6);
  const a = (t) => {
    const u = t / sec;
    return u < peak ? Math.pow(u / peak, 2.2) : Math.pow(Math.max(0, 1 - (u - peak) / (1 - peak)), 1.6);
  };
  const f = (t) => {
    const u = t / sec;
    return u < peak ? f0 * Math.pow(f1 / f0, u / peak) : f1 * Math.pow(f2 / f1, (u - peak) / (1 - peak));
  };
  const n1 = noise(sec, seed, a, { type: 'bp', f, q: () => q });
  const n2 = noise(sec, seed + 1, (t) => a(t) * 0.5, { type: 'bp', f: (t) => f(t) * 1.9, q: () => q * 1.4 });
  // pan sweep, sample by sample
  const [L, R] = s;
  for (let i = 0; i < n1.length; i++) {
    const u = i / n1.length;
    const p = pan[0] + (pan[1] - pan[0]) * smooth(u);
    const ang = ((p + 1) * Math.PI) / 4;
    const v = n1[i] + n2[i];
    L[i] += v * Math.cos(ang);
    R[i] += v * Math.sin(ang);
  }
  if (rumble) addMono(s, 0, tone(sec, (t) => 50 + 40 * a(t), (t) => a(t) * rumble), 1);
  return reverb(s, { wet: 0.25, room: 0.78 });
}

SFX['whoosh.wav'] = () => whoosh(0.7, 101, { f0: 250, f1: 4200, f2: 700, peak: 0.5, rumble: 0.5 });
SFX['whoosh-soft.wav'] = () => whoosh(0.55, 102, { f0: 500, f1: 2600, f2: 1200, peak: 0.45, q: 1.6, pan: [-0.4, 0.4] });

/** Reverse whoosh: swells and stops dead on the cut. */
SFX['whoosh-rev.wav'] = () => {
  const [L, R] = whoosh(0.6, 103, { f0: 600, f1: 5000, f2: 5000, peak: 0.98, pan: [0.6, -0.6], rumble: 0.35 });
  const end = Math.round(0.6 * SR);
  const l = L.slice(0, end);
  const r = R.slice(0, end);
  // add a reversed reverb tail feel: pre-swell
  const tail = reverb([Float32Array.from(l).reverse(), Float32Array.from(r).reverse()], { wet: 0.6, dry: 0, room: 0.85 });
  const outL = new Float32Array(end);
  const outR = new Float32Array(end);
  for (let i = 0; i < end; i++) {
    outL[i] = l[i] + tail[0][end - 1 - i] * 0.8;
    outR[i] = r[i] + tail[1][end - 1 - i] * 0.8;
  }
  return [outL, outR];
};

function riser(sec, seed, { f0 = 250, f1 = 1600 } = {}) {
  const s = buf(sec);
  const a = (t) => Math.pow(t / sec, 2.4);
  addMono(s, 0, noise(sec, seed, a, { type: 'bp', f: (t) => 400 * Math.pow(12, t / sec), q: () => 1.6 }), 0.9, -0.3);
  addMono(s, 0, noise(sec, seed + 7, a, { type: 'hp', f: (t) => 2000 + 6000 * (t / sec), q: () => 0.7 }), 0.25, 0.3);
  // tonal sweep with accelerating tremolo
  let trem = 0;
  const sweep = tone(sec, (t) => f0 * Math.pow(f1 / f0, Math.pow(t / sec, 1.4)), (t) => {
    trem += (TAU * (4 + 26 * (t / sec))) / SR;
    return a(t) * (0.6 + 0.4 * Math.sin(trem)) * 0.35;
  }, { shape: 'tri' });
  addMono(s, 0, sweep, 1);
  const [L, R] = reverb(s, { wet: 0.22, room: 0.8 });
  return edges([L, R], 1, 2);
}

SFX['riser-short.wav'] = () => riser(0.4, 201, { f0: 400, f1: 1500 });
SFX['riser.wav'] = () => riser(1.0, 202, { f0: 180, f1: 1400 });

/** Shatter: a transient, a low thump and a spray of glass-like pings. */
SFX['shatter.wav'] = () => {
  const s = buf(1.2);
  const r = rng(301);
  addMono(s, 0, noise(0.12, 302, (t) => expDecay(t, 0.02), { type: 'hp', f: () => 1800, q: () => 0.7 }), 0.9);
  addMono(s, 0, tone(0.3, (t) => 60 + 90 * expDecay(t, 0.02), (t) => expDecay(t, 0.07)), 0.9);
  for (let i = 0; i < 38; i++) {
    const at = Math.pow(r(), 1.8) * 0.4;
    const f = 2400 + r() * 6200;
    const ping = bell(0.25, f, { ratio: 1.41 + r(), index: 1.5, tau: 0.02 + r() * 0.05, idxTau: 0.02 });
    addMono(s, at, ping, 0.18 + r() * 0.2, r() * 1.6 - 0.8);
  }
  return reverb(s, { wet: 0.3, room: 0.82 });
};

/** Door slam: thud + body + latch, in a room. */
SFX['door.wav'] = () => {
  const s = buf(1.2);
  addMono(s, 0, tone(0.5, (t) => 42 + 50 * expDecay(t, 0.04), (t) => Math.min(1, t / 0.003) * expDecay(t, 0.12)), 1.2);
  addMono(s, 0, noise(0.25, 401, (t) => expDecay(t, 0.035), { type: 'lp', f: () => 700, q: () => 0.9 }), 1.0);
  addMono(s, 0.055, clickSig(1400, 402, 0.04), 0.45, 0.15);
  addMono(s, 0.07, clickSig(2600, 403, 0.03), 0.25, 0.15);
  return reverb(s, { wet: 0.28, room: 0.7, damp: 0.5 });
};

/** Screen power-on: a soft rising bloom with a glassy top. */
SFX['power-on.wav'] = () => {
  const s = buf(1.2);
  const sec = 0.55;
  addMono(s, 0, tone(sec, (t) => 220 * Math.pow(4, smooth(t / sec)), (t) => Math.sin(Math.PI * Math.min(1, t / sec)) * 0.5, { shape: 'tri' }), 0.8);
  addMono(s, 0.12, bell(0.9, mtof(88), { ratio: 2.0, index: 1.2, tau: 0.35 }), 0.35, 0.2);
  addMono(s, 0.18, bell(0.9, mtof(83), { ratio: 2.0, index: 1.0, tau: 0.35 }), 0.25, -0.2);
  return reverb(s, { wet: 0.4, room: 0.85 });
};

/** Pickup: the click of the call connecting + two-note "connected" blip. */
SFX['pickup.wav'] = () => {
  const s = buf(1.0);
  addMono(s, 0, clickSig(1500, 501, 0.05), 1);
  addMono(s, 0.0, tone(0.2, (t) => 70 + 50 * expDecay(t, 0.02), (t) => expDecay(t, 0.05)), 0.7);
  addMono(s, 0.05, bell(0.35, mtof(79), { ratio: 2, index: 0.8, tau: 0.09 }), 0.45, -0.15);
  addMono(s, 0.13, bell(0.45, mtof(84), { ratio: 2, index: 0.8, tau: 0.12 }), 0.45, 0.15);
  return reverb(s, { wet: 0.25, room: 0.75 });
};

/** Shimmer: a fast sparkle arpeggio (the moment it's booked). */
SFX['shimmer.wav'] = () => {
  const s = buf(1.6);
  const notes = [88, 92, 95, 100, 104];
  notes.forEach((m, i) => addMono(s, i * 0.035, bell(1.1, mtof(m), { ratio: 3.01, index: 1.1, tau: 0.25 }), 0.4, -0.6 + i * 0.3));
  return reverb(s, { wet: 0.45, room: 0.86 });
};

/** Ding: the booking lands — a warm FM bell, major third. */
SFX['ding.wav'] = () => {
  const s = buf(3.0);
  addMono(s, 0, bell(2.6, mtof(84), { ratio: 3.5, index: 3.2, tau: 0.9, idxTau: 0.18 }), 0.9, -0.1);
  addMono(s, 0.012, bell(2.6, mtof(88), { ratio: 3.5, index: 2.4, tau: 0.8, idxTau: 0.16 }), 0.55, 0.15);
  addMono(s, 0, bell(2.0, mtof(72), { ratio: 2.0, index: 1.2, tau: 0.6 }), 0.35);
  return reverb(s, { wet: 0.35, room: 0.86, damp: 0.3 });
};

/** Hit on the white flip: kick-ish body + bright crack. */
SFX['hit.wav'] = () => {
  const s = buf(1.4);
  addMono(s, 0, tone(0.5, (t) => 50 + 110 * expDecay(t, 0.025), (t) => Math.min(1, t / 0.002) * expDecay(t, 0.14)), 1.2);
  addMono(s, 0, noise(0.3, 601, (t) => expDecay(t, 0.05), { type: 'hp', f: () => 2500, q: () => 0.7 }), 0.6);
  addMono(s, 0, bell(1.0, mtof(76), { ratio: 1.5, index: 2.5, tau: 0.3 }), 0.25);
  return reverb(s, { wet: 0.35, room: 0.84 });
};

/** Confirm: two-note success chime (the green 200 OK node). */
SFX['confirm.wav'] = () => {
  const s = buf(1.4);
  addMono(s, 0, bell(0.9, mtof(79), { ratio: 2, index: 1.4, tau: 0.22 }), 0.7, -0.2);
  addMono(s, 0.09, bell(1.1, mtof(86), { ratio: 2, index: 1.4, tau: 0.35 }), 0.8, 0.2);
  return reverb(s, { wet: 0.32, room: 0.82 });
};

/** Sub drop into the dark CTA. */
SFX['sub.wav'] = () => {
  const s = buf(2.0);
  addMono(s, 0, tone(1.8, (t) => 30 + 30 * expDecay(t, 0.4), (t) => smooth(Math.min(1, t / 0.03)) * expDecay(t, 0.55)), 1);
  addMono(s, 0, noise(0.6, 701, (t) => expDecay(t, 0.12) * 0.25, { type: 'lp', f: () => 400, q: () => 0.7 }), 1);
  return reverb(s, { wet: 0.25, room: 0.85 });
};

/** Impact on the logo: sub boom + crack + inharmonic metal ring + big room. */
SFX['impact.wav'] = () => {
  const s = buf(4.0);
  const boom = tone(2.8, (t) => 27 + 48 * expDecay(t, 0.06), (t) => Math.min(1, t / 0.002) * expDecay(t, 0.8));
  for (let i = 0; i < boom.length; i++) boom[i] = softclip(boom[i] * 1.4, 1.6);
  addMono(s, 0, boom, 1.25);
  addMono(s, 0, noise(0.5, 801, (t) => expDecay(t, 0.06), { type: 'lp', f: (t) => 5000 * expDecay(t, 0.08) + 300, q: () => 0.8 }), 0.9);
  const partials = [1, 2.76, 5.4, 8.93];
  partials.forEach((p, i) =>
    addMono(s, 0, bell(3.5, 110 * p, { ratio: 1.41, index: 0.6, tau: 1.2 / (i + 1) }), 0.16 / (i + 1), (i % 2 ? 0.3 : -0.3)),
  );
  return reverb(s, { wet: 0.42, room: 0.9, damp: 0.3 });
};

/* ─────────────────────────── the bed ─────────────────────────── */
/**
 * 30 s at 120 BPM (60 beats), following the film's sections:
 *   beats  0–8   HOOK   drone + a clock ticking on the beat
 *   beats  8–16  TWIST  pad opens, hats creep in, reverse swell into the call
 *   beats 16–30  CALL   soft kick on 1 & 3, 8th hats, bass pulse
 *   beats 30–38  RESULT lift: brighter chord, half-time
 *   beats 38–48  SCALE  full groove: four-on-the-floor, claps, 16th arp
 *   beats 48–60  CTA    groove drops out, big chord, resolves under the logo
 */
function bed() {
  const s = buf(BED_SECONDS + 0.001);
  const at = (beat) => beat * BEAT;
  const r = rng(9001);

  // chord per 4 beats (one bar). A minor → F → C → G, lifting at RESULT.
  const CH = {
    Am: [57, 60, 64, 69], // A3 C4 E4 A4
    F: [53, 57, 60, 65],
    C: [48, 55, 60, 64],
    G: [55, 59, 62, 67],
    Fmaj7: [53, 57, 60, 64],
    Cadd9: [48, 55, 62, 64, 67],
  };
  const bars = [
    'Am', 'Am', // hook
    'F', 'F', // twist
    'Am', 'F', 'C', 'G', // call (bars 4–7)
    'F', 'C', // result (bars 7.5–9.5)
    'Am', 'F', 'C', // scale (bars 9.5–12)
    'Fmaj7', 'Cadd9', // cta
  ];
  const roots = { Am: 45, F: 41, C: 36, G: 43, Fmaj7: 41, Cadd9: 36 };
  // section gain envelope for the pad (per beat)
  const padGain = (beat) => {
    if (beat < 8) return 0.35 + 0.15 * (beat / 8);
    if (beat < 16) return 0.5 + 0.3 * ((beat - 8) / 8);
    if (beat < 30) return 0.6;
    if (beat < 38) return 0.75;
    if (beat < 48) return 0.6;
    if (beat < 53) return 0.7 + 0.2 * ((beat - 48) / 5);
    return 0.95 * Math.max(0, 1 - (beat - 53) / 9);
  };

  // PAD: detuned saws → slow low-pass, per bar with crossfades
  const padL = new Float32Array(s[0].length);
  const padR = new Float32Array(s[0].length);
  const phases = [];
  for (let bi = 0; bi < bars.length; bi++) {
    const notes = CH[bars[bi]];
    const t0 = at(bi * 4) - 0.25;
    const t1 = at(bi * 4 + 4) + (bi === bars.length - 1 ? 6 : 0.35);
    const i0 = Math.max(0, Math.round(t0 * SR));
    const i1 = Math.min(padL.length, Math.round(t1 * SR));
    for (let v = 0; v < notes.length; v++) {
      for (const det of [-0.09, 0.08]) {
        const f = mtof(notes[v] + det);
        const key = `${v}${det}`;
        let ph = phases[key] ?? r() * TAU;
        for (let i = i0; i < i1; i++) {
          const t = i / SR;
          const fade = Math.min(1, (t - t0) / 0.3, (t1 - t) / 0.35);
          ph += (TAU * f) / SR;
          const saw = 2 * ((ph / TAU) % 1) - 1;
          const v2 = saw * fade * 0.08;
          if (det < 0) padL[i] += v2; else padR[i] += v2;
          (det < 0 ? padR : padL)[i] += v2 * 0.35;
        }
        phases[key] = ph;
      }
    }
  }
  const lpL = new Biquad('lp', 600, 0.7);
  const lpR = new Biquad('lp', 600, 0.7);
  for (let i = 0; i < padL.length; i++) {
    const t = i / SR;
    const beat = t / BEAT;
    if (i % 64 === 0) {
      const open =
        beat < 16 ? 350 + 900 * smooth(Math.min(1, beat / 16)) :
        beat < 38 ? 1300 + 300 * Math.sin(beat * 0.4) :
        beat < 48 ? 2200 :
        beat < 53 ? 1400 + 2400 * smooth((beat - 48) / 5) : 3200 * Math.max(0.25, 1 - (beat - 53) / 10);
      lpL.set(open, 0.8); lpR.set(open * 1.03, 0.8);
    }
    const g = padGain(beat);
    s[0][i] += lpL.run(padL[i]) * g;
    s[1][i] += lpR.run(padR[i]) * g;
  }

  // DRONE (hook): A1 sine + fifth, fades into the pad
  addMono(s, 0, tone(9, () => mtof(33), (t) => smooth(Math.min(1, t / 1.5)) * Math.max(0, 1 - Math.max(0, t - 6) / 3) * 0.35), 1);
  addMono(s, 0, tone(9, () => mtof(40), (t) => smooth(Math.min(1, t / 2.5)) * Math.max(0, 1 - Math.max(0, t - 6) / 3) * 0.12), 1);

  // CLOCK TICK on every beat of the hook (tick-tock alternation)
  for (let beat = 0; beat < 8; beat++) {
    addMono(s, at(beat), clickSig(beat % 2 ? 2100 : 2600, 9100 + beat, 0.03), 0.18, beat % 2 ? 0.25 : -0.25);
  }

  // KICK
  const kick = (gain) =>
    tone(0.35, (t) => 45 + 95 * expDecay(t, 0.03), (t) => Math.min(1, t / 0.0015) * expDecay(t, 0.11) * gain);
  for (let beat = 16; beat < 48; beat++) {
    const inCall = beat < 30 && beat % 2 === 0;
    const inResult = beat >= 30 && beat < 38 && beat % 4 === 0;
    const inScale = beat >= 38;
    if (inCall || inResult || inScale) addMono(s, at(beat), kick(inScale ? 0.9 : 0.55), 1);
  }

  // BASS pulse on 8ths (call + scale), root of the bar
  for (let e = 16 * 2; e < 48 * 2; e++) {
    const beat = e / 2;
    if (beat >= 30 && beat < 38 && e % 2) continue; // half-time in RESULT
    const bar = bars[Math.floor(beat / 4)];
    const f = mtof(roots[bar]);
    const len = 0.22;
    const b = tone(len, () => f, (t) => Math.min(1, t / 0.004) * expDecay(t, 0.1) * (beat >= 38 ? 0.28 : 0.2), { shape: 'tri' });
    addMono(s, at(beat) + (e % 2 ? 0 : 0.01), b, 1);
  }

  // HATS: creep in during the twist (16ths, quiet), 8ths in the call, 16ths in scale
  const hat = (seed, gain, open = false) =>
    noise(open ? 0.18 : 0.05, seed, (t) => expDecay(t, open ? 0.05 : 0.012) * gain, { type: 'hp', f: () => 7500, q: () => 0.7 });
  for (let sx = 12 * 4; sx < 48 * 4; sx++) {
    const beat = sx / 4;
    let g = 0;
    if (beat < 16) g = ((beat - 12) / 4) * 0.12 * (sx % 2 ? 0.6 : 1);
    else if (beat < 30) g = sx % 2 === 0 ? (sx % 4 === 2 ? 0.2 : 0.12) : 0;
    else if (beat < 38) g = sx % 4 === 2 ? 0.14 : 0;
    else g = sx % 4 === 2 ? 0.22 : 0.1;
    if (g > 0) addMono(s, at(beat), hat(9500 + sx, g, beat >= 38 && sx % 4 === 2), 1, sx % 2 ? 0.3 : -0.3);
  }

  // CLAP on 2 & 4 in SCALE
  for (let beat = 39; beat < 48; beat += 2) {
    const clap = noise(0.2, 9700 + beat, (t) => (expDecay(t, 0.04) + (t < 0.02 ? 0.5 : 0)) * 0.35, { type: 'bp', f: () => 1400, q: () => 0.9 });
    addMono(s, at(beat), clap, 1);
  }

  // ARP: 16th plucks in SCALE, quieter 8ths during the call
  for (let sx = 16 * 4; sx < 48 * 4; sx++) {
    const beat = sx / 4;
    const scale = beat >= 38;
    if (!scale && sx % 2) continue;
    if (beat >= 30 && beat < 38) continue;
    const notes = CH[bars[Math.floor(beat / 4)]];
    const m = notes[sx % notes.length] + 12 + (Math.floor(sx / 8) % 2 ? 12 : 0);
    const pl = bell(0.3, mtof(m), { ratio: 2, index: 1.1, tau: 0.09, idxTau: 0.05 });
    addMono(s, at(beat), pl, scale ? 0.1 : 0.06, Math.sin(sx * 0.7) * 0.5);
  }

  // REVERSE SWELL into the call (beats 14–16)
  const swell = noise(1.0, 9800, (t) => Math.pow(t / 1.0, 3) * 0.4, { type: 'bp', f: (t) => 800 + 5000 * (t / 1.0), q: () => 0.9 });
  addMono(s, at(14), swell, 1);

  const wet = reverb(s, { wet: 0.28, dry: 1, room: 0.88, damp: 0.35, width: 1 });
  // gentle glue: soft clip at the bus
  for (let i = 0; i < wet[0].length; i++) {
    wet[0][i] = softclip(wet[0][i], 1.1);
    wet[1][i] = softclip(wet[1][i], 1.1);
  }
  return edges(wet, 5, 400);
}

/* ─────────────────────────── write ─────────────────────────── */

const t0 = Date.now();
mkdirSync(OUT, { recursive: true });
for (const [name, make] of Object.entries(SFX)) {
  writeWav(name, normalise(edges(make(), 0.5, 20), SFX_PEAK_DB));
}
writeWav('bed.wav', normalise(bed(), BED_PEAK_DB));
console.log(
  `[sfx] ${Object.keys(SFX).length + 1} files → public/sfx (SFX ${SFX_PEAK_DB} dBFS peak, bed ${BED_PEAK_DB} dBFS peak) in ${Date.now() - t0} ms`,
);
