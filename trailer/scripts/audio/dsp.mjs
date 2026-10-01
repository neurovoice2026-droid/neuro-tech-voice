/**
 * DSP kit for the trailer's sound — pure JS, deterministic, no dependencies.
 *
 *   buffers      stereo [L, R] Float32Array pairs at SR (48 kHz)
 *   oscillators  phase-accumulating sine / band-limited (polyBLEP) saw, seeded white + pink noise
 *   filters      RBJ biquads (fixed EQ) and a Simper/Cytomic TPT state-variable filter (smooth sweeps)
 *   space        constant-power pan + stereo balance, decorrelation all-passes, early reflections,
 *                an 8-line FDN reverb (Householder, frequency-dependent decay), a tempo delay
 *   dynamics     envelope follower, compressor, look-ahead TRUE-PEAK limiter (4× oversampled)
 *   measure      ITU-R BS.1770-4 integrated loudness (K-weighting, gating), true peak
 *   I/O          24-bit WAV read/write, windowed-sinc resampler, a tiny PNG writer (spectrograms)
 */
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import zlib from 'node:zlib';

export const SR = 48000;
export const TAU = Math.PI * 2;

/* ── numbers ─────────────────────────────────────────────────────── */
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const db = (g) => 20 * Math.log10(Math.max(1e-12, g));
export const gain = (d) => Math.pow(10, d / 20);
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const semis = (s) => Math.pow(2, s / 12);
export const smooth = (x) => {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};
export const lerp = (a, b, t) => a + (b - a) * t;

/** mulberry32 — seeded, deterministic. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── buffers ─────────────────────────────────────────────────────── */
export const N = (sec) => Math.max(1, Math.ceil(sec * SR));
export const mono = (sec) => new Float32Array(N(sec));
export const stereo = (sec) => [new Float32Array(N(sec)), new Float32Array(N(sec))];
export const dup = (m) => [Float32Array.from(m), Float32Array.from(m)];
export const len = (st) => st[0].length;

/** Constant-power pan law (-1 … 1). */
export function panGains(p) {
  const a = ((clamp(p, -1, 1) + 1) * Math.PI) / 4;
  return [Math.cos(a) * Math.SQRT2, Math.sin(a) * Math.SQRT2];
}

/** Mix a mono signal into a stereo buffer at `at` seconds (pan -1 … 1, unity at centre). */
export function addMono(dst, sig, at = 0, g = 1, pan = 0) {
  const [gl, gr] = panGains(pan);
  const s0 = Math.round(at * SR);
  const [L, R] = dst;
  const n = Math.min(sig.length, L.length - s0);
  for (let i = Math.max(0, -s0); i < n; i++) {
    L[s0 + i] += sig[i] * g * gl * Math.SQRT1_2;
    R[s0 + i] += sig[i] * g * gr * Math.SQRT1_2;
  }
  return dst;
}

/** Mix a stereo buffer into another at `at` seconds. */
export function addStereo(dst, src, at = 0, g = 1) {
  const s0 = Math.round(at * SR);
  const n = Math.min(src[0].length, dst[0].length - s0);
  for (let i = Math.max(0, -s0); i < n; i++) {
    dst[0][s0 + i] += src[0][i] * g;
    dst[1][s0 + i] += src[1][i] * g;
  }
  return dst;
}

export function scale(st, g) {
  for (const ch of st) for (let i = 0; i < ch.length; i++) ch[i] *= g;
  return st;
}

export function peak(st) {
  let p = 0;
  for (const ch of st) for (let i = 0; i < ch.length; i++) p = Math.max(p, Math.abs(ch[i]));
  return p;
}

export function normalise(st, peakDb) {
  const p = peak(st);
  return p > 0 ? scale(st, gain(peakDb) / p) : st;
}

/** Short raised-cosine fades at both ends so nothing clicks. */
export function fades(st, inMs = 0.5, outMs = 15) {
  const a = Math.round((inMs / 1000) * SR);
  const b = Math.round((outMs / 1000) * SR);
  for (const ch of st) {
    const n = ch.length;
    for (let i = 0; i < a && i < n; i++) ch[i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / a);
    for (let i = 0; i < b && i < n; i++) ch[n - 1 - i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / b);
  }
  return st;
}

/** Trim trailing silence below `floorDb` (keeps a 30 ms pad). */
export function trimTail(st, floorDb = -84) {
  const f = gain(floorDb);
  let end = st[0].length;
  while (end > 1 && Math.abs(st[0][end - 1]) < f && Math.abs(st[1][end - 1]) < f) end--;
  end = Math.min(st[0].length, end + Math.round(0.03 * SR));
  return [st[0].slice(0, end), st[1].slice(0, end)];
}

export function reverse(st) {
  return [Float32Array.from(st[0]).reverse(), Float32Array.from(st[1]).reverse()];
}

/** Remove DC with a 12 Hz high-pass (in place). */
export function dcBlock(st, f = 12) {
  for (const ch of st) {
    const hp = new Biquad('hp', f, 0.707);
    for (let i = 0; i < ch.length; i++) ch[i] = hp.run(ch[i]);
  }
  return st;
}

/* ── oscillators & noise ─────────────────────────────────────────── */
/** Sine with frequency curve f(t) (Hz) and amplitude a(t). */
export function osc(sec, f, a = 1, phase = 0) {
  const out = mono(sec);
  const n = out.length;
  const fc = typeof f === 'number';
  // amplitude: a constant, an ad() envelope (computed incrementally), or any a(t)
  const amp = typeof a === 'number' ? null : a.tau !== undefined ? adTrack(a, n) : null;
  if (fc) {
    // fixed frequency: complex rotation (renormalised), no sin() per sample
    const w = (TAU * f) / SR;
    const cw = Math.cos(w);
    const sw = Math.sin(w);
    let x = Math.cos(phase);
    let y = Math.sin(phase);
    const end = amp ? Math.min(n, Math.ceil((a.att + a.tau * 16.2) * SR)) : n; // the envelope is < 1e-7 after this
    for (let i = 0; i < end; i++) {
      out[i] = y * (amp ? amp[i] : typeof a === 'number' ? a : a(i / SR));
      const nx = x * cw - y * sw;
      y = x * sw + y * cw;
      x = nx;
      if ((i & 1023) === 1023) {
        const m = 1 / Math.hypot(x, y);
        x *= m;
        y *= m;
      }
    }
    return out;
  }
  let ph = phase;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    out[i] = Math.sin(ph) * (amp ? amp[i] : typeof a === 'number' ? a : a(t));
    ph += (TAU * f(t)) / SR;
  }
  return out;
}

/** An ad() envelope rendered sample by sample without exp() in the loop. */
function adTrack(e, n, t0 = 0) {
  const out = new Float32Array(n);
  const attN = Math.max(1, e.att * SR);
  const k = Math.exp(-1 / (e.tau * SR));
  const s0 = Math.round(t0 * SR);
  let v = 1;
  for (let i = 0; i < n; i++) {
    const j = i + s0;
    if (j < attN) out[i] = 0.5 - 0.5 * Math.cos((Math.PI * j) / attN);
    else {
      out[i] = v;
      v *= k;
      if (v < 1e-7) break;
    }
  }
  return out;
}

const polyBlep = (t, dt) => {
  if (t < dt) {
    t /= dt;
    return t + t - t * t - 1;
  }
  if (t > 1 - dt) {
    t = (t - 1) / dt;
    return t * t + t + t + 1;
  }
  return 0;
};

/** Band-limited sawtooth (polyBLEP) — stateful voice. */
export class Saw {
  constructor(phase = 0) {
    this.p = phase;
  }
  run(f) {
    const dt = f / SR;
    let v = 2 * this.p - 1 - polyBlep(this.p, dt);
    this.p += dt;
    if (this.p >= 1) this.p -= 1;
    return v;
  }
}

export function white(sec, seed) {
  const r = rng(seed);
  const out = mono(sec);
  for (let i = 0; i < out.length; i++) out[i] = r() * 2 - 1;
  return out;
}

/** Pink noise (Paul Kellet's refined filter). */
export function pink(sec, seed) {
  const r = rng(seed);
  const out = mono(sec);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < out.length; i++) {
    const w = r() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return out;
}

/** Multiply a signal by an envelope function of time (in place). */
export function env(sig, a, t0 = 0) {
  if (a.tau !== undefined) {
    const e = adTrack(a, sig.length, t0);
    for (let i = 0; i < sig.length; i++) sig[i] *= e[i];
    return sig;
  }
  for (let i = 0; i < sig.length; i++) sig[i] *= a(t0 + i / SR);
  return sig;
}

/** Attack (raised cosine) then exponential decay. */
export const ad = (att, tau) => {
  const fn = (t) => (t < att ? 0.5 - 0.5 * Math.cos((Math.PI * t) / att) : Math.exp(-(t - att) / tau));
  fn.att = att;
  fn.tau = tau;
  return fn;
};

/** A damped sinusoid: a mode of a struck body (f, amplitude, decay τ, attack). */
export function mode(sec, f, amp, tau, att = 0.0005, phase = 0) {
  const out = osc(Math.min(sec, att + tau * 9), f, ad(att, tau), phase);
  const full = mono(sec);
  for (let i = 0; i < out.length; i++) full[i] = out[i] * amp;
  return full;
}

/* ── filters ─────────────────────────────────────────────────────── */
/** RBJ biquad: lp, hp, bp (0 dB peak), notch, peak, lowshelf, highshelf, ap. */
export class Biquad {
  constructor(type, f = 1000, q = 0.707, gDb = 0) {
    this.type = type;
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
    this.set(f, q, gDb);
  }
  set(f, q = this.q, gDb = this.gDb) {
    this.f = f;
    this.q = q;
    this.gDb = gDb;
    const w = (TAU * clamp(f, 5, SR * 0.49)) / SR;
    const cs = Math.cos(w);
    const sn = Math.sin(w);
    const al = sn / (2 * q);
    const A = Math.pow(10, gDb / 40);
    let b0, b1, b2, a0, a1, a2;
    switch (this.type) {
      case 'lp': b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; break;
      case 'hp': b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; break;
      case 'bp': b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; break;
      case 'notch': b0 = 1; b1 = -2 * cs; b2 = 1; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; break;
      case 'ap': b0 = 1 - al; b1 = -2 * cs; b2 = 1 + al; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; break;
      case 'peak': b0 = 1 + al * A; b1 = -2 * cs; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cs; a2 = 1 - al / A; break;
      case 'lowshelf': {
        const s = 2 * Math.sqrt(A) * al;
        b0 = A * (A + 1 - (A - 1) * cs + s); b1 = 2 * A * (A - 1 - (A + 1) * cs); b2 = A * (A + 1 - (A - 1) * cs - s);
        a0 = A + 1 + (A - 1) * cs + s; a1 = -2 * (A - 1 + (A + 1) * cs); a2 = A + 1 + (A - 1) * cs - s;
        break;
      }
      case 'highshelf': {
        const s = 2 * Math.sqrt(A) * al;
        b0 = A * (A + 1 + (A - 1) * cs + s); b1 = -2 * A * (A - 1 + (A + 1) * cs); b2 = A * (A + 1 + (A - 1) * cs - s);
        a0 = A + 1 - (A - 1) * cs + s; a1 = 2 * (A - 1 - (A + 1) * cs); a2 = A + 1 - (A - 1) * cs - s;
        break;
      }
      default: throw new Error(`biquad ${this.type}`);
    }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
  }
  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

/** Apply a fixed biquad chain to a mono signal (returns a new array). */
export function filt(sig, ...specs) {
  const out = Float32Array.from(sig);
  for (const [type, f, q = 0.707, g = 0] of specs) {
    const b = new Biquad(type, f, q, g);
    for (let i = 0; i < out.length; i++) out[i] = b.run(out[i]);
  }
  return out;
}
export const filtSt = (st, ...specs) => [filt(st[0], ...specs), filt(st[1], ...specs)];

/** Simper/Cytomic trapezoidal SVF — stable under fast modulation. */
export class SVF {
  constructor() {
    this.ic1 = this.ic2 = 0;
    this.set(1000, 0.707);
  }
  set(f, q) {
    const g = Math.tan((Math.PI * clamp(f, 10, SR * 0.47)) / SR);
    this.k = 1 / q;
    this.a1 = 1 / (1 + g * (g + this.k));
    this.a2 = g * this.a1;
    this.a3 = g * this.a2;
  }
  /** returns low-pass; band/high in this.bp / this.hp */
  run(x) {
    const v3 = x - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    this.bp = v1;
    this.hp = x - this.k * v1 - v2;
    return v2;
  }
}

/** A swept SVF over a mono signal: mode 'lp' | 'bp' | 'hp' | 'bpn' (unity-peak band-pass). */
export function sweep(sig, mode, f, q = () => 0.707, t0 = 0) {
  const out = new Float32Array(sig.length);
  const s = new SVF();
  const fc = typeof f === 'number';
  const qc = typeof q === 'number';
  for (let i = 0; i < sig.length; i++) {
    if ((i & 15) === 0) {
      const t = t0 + i / SR;
      s.set(fc ? f : f(t), qc ? q : q(t));
    }
    const lp = s.run(sig[i]);
    out[i] = mode === 'lp' ? lp : mode === 'hp' ? s.hp : mode === 'bpn' ? s.bp * s.k : s.bp;
  }
  return out;
}

/** Noise through a swept filter, shaped by an envelope. */
export function noise(sec, seed, a, mode = 'bpn', f = 1000, q = 0.8, color = 'white') {
  const src = color === 'pink' ? pink(sec, seed) : white(sec, seed);
  const out = mode ? sweep(src, mode, f, q) : src;
  return typeof a === 'number' ? out.map((v) => v * a) : env(out, a);
}

/* ── stereo space ────────────────────────────────────────────────── */
/**
 * Stereo balance of a stereo buffer: keeps the side, pans the mid (constant power).
 * `pan` is a position, or a move [from, to] eased over `moveSec` (default: the whole sound).
 */
export function balance(st, pan, moveSec) {
  const [L, R] = st;
  const n = L.length;
  const oL = new Float32Array(n);
  const oR = new Float32Array(n);
  const move = Array.isArray(pan);
  const mn = Math.max(1, moveSec ? Math.round(moveSec * SR) : n);
  let [gl, gr] = panGains(move ? pan[0] : pan);
  for (let i = 0; i < n; i++) {
    if (move && (i & 63) === 0) [gl, gr] = panGains(lerp(pan[0], pan[1], smooth(i / mn)));
    const m = (L[i] + R[i]) * 0.5;
    const s = (L[i] - R[i]) * 0.5;
    oL[i] = m * gl + s;
    oR[i] = m * gr - s;
  }
  return [oL, oR];
}

/** Widen a stereo buffer (side × w). */
export function width(st, w) {
  const [L, R] = st;
  for (let i = 0; i < L.length; i++) {
    const m = (L[i] + R[i]) * 0.5;
    const s = (L[i] - R[i]) * 0.5 * w;
    L[i] = m + s;
    R[i] = m - s;
  }
  return st;
}

/** Mono → decorrelated stereo with two different all-pass cascades (keeps the spectrum, mono-safe at `amt`). */
export function spread(sig, amt = 0.6, seed = 1) {
  const r = rng(seed);
  const chain = () => [0, 1, 2].map(() => new Biquad('ap', 400 + r() * 5000, 0.5 + r() * 1.5));
  const cl = chain();
  const cr = chain();
  const L = new Float32Array(sig.length);
  const R = new Float32Array(sig.length);
  for (let i = 0; i < sig.length; i++) {
    let a = sig[i];
    let b = sig[i];
    for (const f of cl) a = f.run(a);
    for (const f of cr) b = f.run(b);
    L[i] = sig[i] * (1 - amt) + a * amt;
    R[i] = sig[i] * (1 - amt) + b * amt;
  }
  return [L, R];
}

/** Early reflections: a few taps, alternating sides, darkened once per side. */
export function early(st, taps) {
  const [L, R] = st;
  const n = L.length;
  const oL = new Float32Array(n);
  const oR = new Float32Array(n);
  const ts = taps.map(([ms, g, side]) => [Math.round((ms / 1000) * SR), g, side]);
  for (let i = 0; i < n; i++) {
    let l = 0;
    let r = 0;
    for (const [d, g, side] of ts) {
      if (i < d) continue;
      const v = (L[i - d] + R[i - d]) * 0.5 * g;
      if (v === 0) continue;
      if (side < 0) { l += v; r += v * 0.3; } else { r += v; l += v * 0.3; }
    }
    oL[i] = l;
    oR[i] = r;
  }
  return filtSt([oL, oR], ['lp', 7000, 0.6], ['hp', 150, 0.6]);
}

/**
 * 8-line feedback delay network reverb (Householder mixing, per-line damping set
 * from two decay times, input diffusion, decorrelated stereo taps). Returns WET only.
 */
export function fdn(st, { rt60 = 1.6, rt60Hi = 0.8, pre = 0.015, size = 1, diffuse = 0.62, hp = 120, lp = 9000, tail = 0 } = {}) {
  const [L, R] = st;
  const n = L.length + Math.round(tail * SR);
  const base = [1013, 1259, 1453, 1621, 1847, 2089, 2333, 2671];
  const dl = Int32Array.from(base.map((d) => Math.max(64, Math.round(d * size * (SR / 44100)))));
  const maxD = Math.max(...dl);
  const buf = dl.map ? Array.from(dl, (d) => new Float32Array(d)) : [];
  const idx = new Int32Array(8);
  const z = new Float64Array(8);
  const gk = Float64Array.from(dl, (d) => Math.pow(10, (-3 * d) / (rt60 * SR)));
  const damp = Float64Array.from(dl, (d, k) => {
    const gh = Math.pow(10, (-3 * d) / (rt60Hi * SR));
    const r = clamp(gh / gk[k], 0.02, 1);
    return (1 - r) / (1 + r);
  });
  const preN = Math.round(pre * SR);
  const apD = [142, 107, 379, 277].map((d) => Math.round(d * (SR / 44100)));
  const apB = [0, 1].map(() => apD.map((d) => new Float32Array(d)));
  const apI = [new Int32Array(4), new Int32Array(4)];
  const inHp = [new Biquad('hp', hp, 0.6), new Biquad('hp', hp, 0.6)];
  const inLp = [new Biquad('lp', lp, 0.6), new Biquad('lp', lp, 0.6)];
  const oL = new Float32Array(n);
  const oR = new Float32Array(n);
  const sL = [1, -1, 1, -1, 1, -1, 1, -1];
  const sR = [1, 1, -1, -1, 1, 1, -1, -1];
  const x = new Float64Array(8);
  // input energy per block, to skip silence once the tank has died away
  const B = 256;
  const nb = Math.ceil(n / B);
  const loud = new Uint8Array(nb);
  for (let i = 0; i < L.length; i++) if (L[i] !== 0 || R[i] !== 0) loud[((i + preN) / B) | 0] = 1;
  let quiet = 0;
  const inp = [0, 0];
  for (let i = 0; i < n; i++) {
    if ((i & (B - 1)) === 0 && quiet > maxD * 2 + 2048 && !loud[(i / B) | 0]) {
      // tank and diffusers are silent and so is this block of input: skip it
      i += B - 1;
      continue;
    }
    const j = i - preN;
    inp[0] = j >= 0 && j < L.length ? L[j] : 0;
    inp[1] = j >= 0 && j < R.length ? R[j] : 0;
    if (inp[0] !== 0 || inp[1] !== 0) quiet = 0;
    for (let c = 0; c < 2; c++) {
      let v = inLp[c].run(inHp[c].run(inp[c]));
      const bufs = apB[c];
      const ii = apI[c];
      for (let a = 0; a < 4; a++) {
        const b = bufs[a];
        const bo = b[ii[a]];
        const y = -diffuse * v + bo;
        b[ii[a]] = v + diffuse * y;
        ii[a] = ii[a] + 1 === b.length ? 0 : ii[a] + 1;
        v = y;
      }
      inp[c] = v;
    }
    let sum = 0;
    for (let k = 0; k < 8; k++) {
      const y = buf[k][idx[k]];
      z[k] = y * (1 - damp[k]) + z[k] * damp[k];
      x[k] = z[k] * gk[k];
      sum += x[k];
    }
    sum *= 0.25;
    let wl = 0;
    let wr = 0;
    let e = 0;
    for (let k = 0; k < 8; k++) {
      const fb = x[k] - sum;
      buf[k][idx[k]] = fb + (k & 1 ? inp[1] : inp[0]) * 0.5;
      idx[k] = idx[k] + 1 === dl[k] ? 0 : idx[k] + 1;
      wl += x[k] * sL[k];
      wr += x[k] * sR[k];
      e += fb < 0 ? -fb : fb;
    }
    oL[i] = wl * 0.35;
    oR[i] = wr * 0.35;
    if (e < 1e-9 && inp[0] === 0 && inp[1] === 0) quiet++;
    else quiet = 0;
  }
  return [oL, oR];
}

/**
 * The FDN over only the stretches where the input is active (gaps longer than
 * `gap` seconds split the work; each stretch gets `tail` seconds to ring out).
 */
export function fdnSparse(st, o = {}, { gap = 5, tail = 3.5 } = {}) {
  const [L, R] = st;
  const n = L.length;
  const B = 1024;
  const act = [];
  for (let b = 0; b * B < n; b++) {
    let on = false;
    for (let i = b * B; i < Math.min(n, (b + 1) * B); i++) if (L[i] !== 0 || R[i] !== 0) { on = true; break; }
    if (on) act.push(b);
  }
  const out = [new Float32Array(n), new Float32Array(n)];
  const gapB = Math.ceil((gap * SR) / B);
  let k = 0;
  while (k < act.length) {
    let e = k;
    while (e + 1 < act.length && act[e + 1] - act[e] <= gapB) e++;
    const s0 = act[k] * B;
    const s1 = Math.min(n, (act[e] + 1) * B);
    const w = fdn([L.subarray(s0, s1), R.subarray(s0, s1)], { ...o, tail });
    for (let c = 0; c < 2; c++) {
      const src = w[c];
      const dst = out[c];
      for (let i = 0; i < src.length && s0 + i < n; i++) dst[s0 + i] += src[i];
    }
    k = e + 1;
  }
  return out;
}

/** Dry + early reflections + FDN in one call (returns a new, longer buffer). */
export function room(st, { wet = 0.2, er = 0.25, taps, ...o } = {}) {
  const tail = o.tail ?? o.rt60 ?? 1;
  const w = fdn(st, { ...o, tail });
  const n = w[0].length;
  const out = [new Float32Array(n), new Float32Array(n)];
  addStereo(out, st, 0, 1);
  if (er > 0) addStereo(out, early(st, taps ?? ER_DEFAULT), 0, er);
  addStereo(out, w, 0, wet);
  return out;
}
export const ER_DEFAULT = [
  [7, 0.6, -1], [11, 0.5, 1], [17, 0.42, -1], [23, 0.36, 1], [31, 0.28, -1], [41, 0.22, 1],
];

/** Tempo delay (ping-pong, darkened feedback). Returns WET only. */
export function pingPong(st, { time = 0.375, fb = 0.35, lp = 5000, hp = 300, tail = 2 } = {}) {
  const [L, R] = st;
  const n = L.length + Math.round(tail * SR);
  const d = Math.round(time * SR);
  const bl = new Float32Array(n);
  const br = new Float32Array(n);
  const fl = [new Biquad('lp', lp, 0.6), new Biquad('hp', hp, 0.6)];
  const fr = [new Biquad('lp', lp, 0.6), new Biquad('hp', hp, 0.6)];
  for (let i = 0; i < n; i++) {
    const inp = i < L.length ? (L[i] + R[i]) * 0.5 : 0;
    const pl = i >= d ? br[i - d] : 0;
    const pr = i >= d ? bl[i - d] : 0;
    bl[i] = fl[1].run(fl[0].run(inp + pr * fb));
    br[i] = fr[1].run(fr[0].run(pl));
  }
  return [bl, br];
}

/* ── dynamics ────────────────────────────────────────────────────── */
/** Peak/RMS envelope follower on |x| (attack/release in seconds) — mono input. */
export function follower(sig, att = 0.005, rel = 0.15, rmsWin = 0) {
  const out = new Float32Array(sig.length);
  const ga = Math.exp(-1 / (att * SR));
  const gr = Math.exp(-1 / (rel * SR));
  let e = 0;
  let acc = 0;
  const w = Math.max(1, Math.round(rmsWin * SR));
  for (let i = 0; i < sig.length; i++) {
    let x;
    if (rmsWin > 0) {
      acc += sig[i] * sig[i] - (i >= w ? sig[i - w] * sig[i - w] : 0);
      x = Math.sqrt(Math.max(0, acc) / w);
    } else x = Math.abs(sig[i]);
    e = x > e ? ga * e + (1 - ga) * x : gr * e + (1 - gr) * x;
    out[i] = e;
  }
  return out;
}

/** Feed-forward compressor (soft knee), stereo-linked. Returns the gain-reduced copy. */
export function compress(st, { thr = -18, ratio = 2, knee = 6, att = 0.005, rel = 0.12, rms = 0.004, makeup = 0 } = {}) {
  const [L, R] = st;
  const n = L.length;
  const sc = new Float32Array(n);
  for (let i = 0; i < n; i++) sc[i] = Math.max(Math.abs(L[i]), Math.abs(R[i]));
  const e = follower(sc, att, rel, rms);
  const oL = new Float32Array(n);
  const oR = new Float32Array(n);
  const mk = gain(makeup);
  const gt = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = db(e[i]);
    let over = x - thr;
    let red = 0;
    if (over > knee / 2) red = over * (1 - 1 / ratio);
    else if (over > -knee / 2) red = ((over + knee / 2) ** 2 / (2 * knee)) * (1 - 1 / ratio);
    const g = gain(-red) * mk;
    gt[i] = g;
    oL[i] = L[i] * g;
    oR[i] = R[i] * g;
  }
  const out = [oL, oR];
  out.gain = gt; // the applied gain per sample (stereo-linked): the same processing on any part of the input
  return out;
}

/** 4× polyphase interpolator (Kaiser-windowed sinc, 12 taps per phase) for true-peak work. */
const OS = 4;
const OS_TAPS = 12;
const OS_KERNEL = (() => {
  const k = [];
  const bessel0 = (x) => {
    let s = 1, t = 1;
    for (let i = 1; i < 30; i++) { t *= (x / (2 * i)) ** 2; s += t; }
    return s;
  };
  const beta = 7;
  for (let p = 0; p < OS; p++) {
    const row = new Float64Array(OS_TAPS);
    let sum = 0;
    for (let j = 0; j < OS_TAPS; j++) {
      const x = j - OS_TAPS / 2 + 1 - p / OS; // distance from sample j to the interpolated point
      const sinc = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
      const u = x / (OS_TAPS / 2);
      const w = Math.abs(u) <= 1 ? bessel0(beta * Math.sqrt(1 - u * u)) / bessel0(beta) : 0;
      row[j] = sinc * w;
      sum += row[j];
    }
    for (let j = 0; j < OS_TAPS; j++) row[j] /= sum;
    k.push(row);
  }
  return k;
})();

const OS_ABS = OS_KERNEL.map((row) => row.reduce((a, b) => a + Math.abs(b), 0));
const OS_GAIN = Math.max(...OS_ABS);

/**
 * Per-sample true-peak magnitude of a channel (max over the 4 interpolated points after it).
 * Samples whose whole neighbourhood is below `floor` / OS_GAIN cannot reach `floor`: they
 * report their sample value (exact for anything that matters to a limiter at `floor`).
 */
export function truePeakTrack(ch, floor = 0) {
  const n = ch.length;
  const out = new Float32Array(n);
  const h = OS_TAPS / 2 - 1;
  const B = 16;
  const nb = Math.ceil(n / B);
  const bmax = new Float32Array(nb);
  for (let i = 0; i < n; i++) {
    const a = Math.abs(ch[i]);
    if (a > bmax[(i / B) | 0]) bmax[(i / B) | 0] = a;
  }
  const lim = floor / OS_GAIN;
  for (let i = 0; i < n; i++) {
    let m = Math.abs(ch[i]);
    if (floor > 0) {
      const b0 = Math.max(0, ((i - h) / B) | 0);
      const b1 = Math.min(nb - 1, ((i - h + OS_TAPS) / B) | 0);
      let loud = false;
      for (let b = b0; b <= b1; b++) if (bmax[b] >= lim) { loud = true; break; }
      if (!loud) { out[i] = m; continue; }
    }
    for (let p = 1; p < OS; p++) {
      const row = OS_KERNEL[p];
      let acc = 0;
      const k0 = i - h;
      if (k0 >= 0 && k0 + OS_TAPS <= n) {
        for (let j = 0; j < OS_TAPS; j++) acc += ch[k0 + j] * row[j];
      } else {
        for (let j = 0; j < OS_TAPS; j++) {
          const idx = k0 + j;
          if (idx >= 0 && idx < n) acc += ch[idx] * row[j];
        }
      }
      const a = Math.abs(acc);
      if (a > m) m = a;
    }
    out[i] = m;
  }
  return out;
}

export function truePeak(st, floor = 0) {
  let m = 0;
  for (const ch of st) {
    const t = truePeakTrack(ch, floor);
    for (let i = 0; i < t.length; i++) if (t[i] > m) m = t[i];
  }
  return m;
}

/**
 * Look-ahead true-peak limiter (stereo-linked). The required gain at every sample
 * (ceiling / true peak) is min-filtered over the look-ahead, released with a
 * program-dependent one-pole, then box-smoothed over the look-ahead — so the
 * gain has reached its target by the time the peak arrives, with no overshoot.
 */
export function limit(st, { ceilingDb = -1.5, look = 0.0015, rel = 0.08, relSlow = 0.4, tracks = null, trackGain = 1 } = {}) {
  const [L, R] = st;
  const n = L.length;
  const c = gain(ceilingDb - 0.15);
  const tl = tracks ? tracks[0] : truePeakTrack(L, c * 0.5);
  const tr = tracks ? tracks[1] : truePeakTrack(R, c * 0.5);
  const req = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = Math.max(tl[i], tr[i]) * trackGain;
    req[i] = p > c ? c / p : 1;
  }
  const la = Math.max(2, Math.round(look * SR));
  // look-ahead minimum (monotonic deque)
  const mn = new Float32Array(n);
  const dq = new Int32Array(n);
  let h = 0, t = 0;
  for (let i = n - 1; i >= 0; i--) {
    while (t > h && req[dq[t - 1]] >= req[i]) t--;
    dq[t++] = i;
    while (dq[h] > i + la) h++;
    mn[i] = req[dq[h]];
  }
  // release: drop instantly, recover with a blend of fast and slow release
  const rf = Math.exp(-1 / (rel * SR));
  const rs = Math.exp(-1 / (relSlow * SR));
  const g = new Float32Array(n);
  let gf = 1, gs = 1;
  for (let i = 0; i < n; i++) {
    gf = Math.min(mn[i], rf * gf + (1 - rf));
    gs = Math.min(mn[i], rs * gs + (1 - rs));
    g[i] = Math.min(mn[i], 0.6 * gf + 0.4 * gs);
  }
  // attack: trailing box average over the look-ahead. Every sample j in [p − la, p]
  // has g[j] ≤ mn[j] ≤ req[p], so the average AT a peak p is ≤ req[p]: the gain is a
  // linear ramp that has fully arrived when the peak does (no overshoot, no clicks).
  const out = [new Float32Array(n), new Float32Array(n)];
  const gt = new Float32Array(n);
  let acc = la; // the window starts full of unity gain
  let minG = 1;
  for (let i = 0; i < n; i++) {
    acc += g[i] - (i >= la ? g[i - la] : 1);
    const gg = acc / la;
    if (gg < minG) minG = gg;
    gt[i] = gg;
    out[0][i] = L[i] * gg;
    out[1][i] = R[i] * gg;
  }
  out.maxReductionDb = -db(minG);
  out.gain = gt; // the applied gain per sample (stereo-linked)
  return out;
}

/* ── loudness (ITU-R BS.1770-4) ──────────────────────────────────── */
function kWeight(ch) {
  // the standard's 48 kHz coefficients
  const s1 = { b: [1.53512485958697, -2.69169618940638, 1.19839281085285], a: [-1.69065929318241, 0.73248077421585] };
  const s2 = { b: [1.0, -2.0, 1.0], a: [-1.99004745483398, 0.99007225036621] };
  const out = new Float64Array(ch.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0, z1 = 0, z2 = 0, w1 = 0, w2 = 0;
  for (let i = 0; i < ch.length; i++) {
    const x = ch[i];
    const y = s1.b[0] * x + s1.b[1] * x1 + s1.b[2] * x2 - s1.a[0] * y1 - s1.a[1] * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    const z = s2.b[0] * y + s2.b[1] * z1 + s2.b[2] * z2 - s2.a[0] * w1 - s2.a[1] * w2;
    z2 = z1; z1 = y; w2 = w1; w1 = z;
    out[i] = z;
  }
  return out;
}

/** Momentary (400 ms) block powers, 75 % overlap. */
function blocks(st) {
  const kw = st.map(kWeight);
  const bl = Math.round(0.4 * SR);
  const hop = Math.round(0.1 * SR);
  const p = [];
  for (let s = 0; s + bl <= kw[0].length; s += hop) {
    let z = 0;
    for (const ch of kw) {
      let a = 0;
      for (let i = s; i < s + bl; i++) a += ch[i] * ch[i];
      z += a / bl;
    }
    p.push(z);
  }
  return p;
}
const lufsOf = (z) => -0.691 + 10 * Math.log10(Math.max(1e-20, z));

/** Integrated loudness (LUFS) with the absolute and relative gates. */
export function lufs(st) {
  const p = blocks(st);
  const abs = p.filter((z) => lufsOf(z) > -70);
  if (!abs.length) return -Infinity;
  const mean = abs.reduce((a, b) => a + b, 0) / abs.length;
  const rel = lufsOf(mean) - 10;
  const g = abs.filter((z) => lufsOf(z) > rel);
  return lufsOf(g.reduce((a, b) => a + b, 0) / g.length);
}

/** Max momentary loudness (LUFS, 400 ms). */
export function momentaryMax(st) {
  const p = blocks(st);
  return p.length ? lufsOf(Math.max(...p)) : -Infinity;
}

/* ── resampling ──────────────────────────────────────────────────── */
/**
 * Windowed-sinc resampler. `step` = input samples per output sample (rate);
 * the kernel widens when decimating so nothing aliases.
 */
const RS_RES = 512; // kernel table points per input sample
const rsTables = new Map();
function rsTable(c, taps) {
  const key = `${c.toFixed(6)}:${taps}`;
  if (rsTables.has(key)) return rsTables.get(key);
  const half = taps / c;
  const n = Math.ceil(half * RS_RES) + 2;
  const t = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const d = i / RS_RES;
    const u = (d * c) / taps;
    if (u >= 1) continue;
    const w = 0.42 + 0.5 * Math.cos(Math.PI * u) + 0.08 * Math.cos(2 * Math.PI * u); // Blackman
    const a = Math.PI * d * c;
    t[i] = (a === 0 ? 1 : Math.sin(a) / a) * c * w;
  }
  rsTables.set(key, t);
  return t;
}
export function resample(sig, step, taps = 16) {
  const outN = Math.max(1, Math.floor((sig.length - 1) / step) + 1);
  const out = new Float32Array(outN);
  const c = Math.min(1, 1 / step) * 0.97;
  const half = Math.ceil(taps / c);
  const tb = rsTable(c, taps);
  const tn = tb.length - 1;
  for (let j = 0; j < outN; j++) {
    const x = j * step;
    const i0 = Math.floor(x);
    let acc = 0;
    const k0 = Math.max(0, i0 - half + 1);
    const k1 = Math.min(sig.length - 1, i0 + half);
    for (let k = k0; k <= k1; k++) {
      const p = Math.abs(x - k) * RS_RES;
      const q = p | 0;
      if (q >= tn) continue;
      const f = p - q;
      acc += sig[k] * (tb[q] + (tb[q + 1] - tb[q]) * f);
    }
    out[j] = acc;
  }
  return out;
}
/** 4-point Hermite — for rates within a few cents of 1, where no band-limiting is needed. */
export function resampleCubic(sig, step) {
  const outN = Math.max(1, Math.floor((sig.length - 1) / step) + 1);
  const out = new Float32Array(outN);
  const n = sig.length;
  for (let j = 0; j < outN; j++) {
    const x = j * step;
    const i = x | 0;
    const f = x - i;
    const y0 = i > 0 ? sig[i - 1] : 0;
    const y1 = sig[i];
    const y2 = i + 1 < n ? sig[i + 1] : 0;
    const y3 = i + 2 < n ? sig[i + 2] : 0;
    const c1 = 0.5 * (y2 - y0);
    const c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3;
    const c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
    out[j] = ((c3 * f + c2) * f + c1) * f + y1;
  }
  return out;
}
export const resampleSt = (st, step, taps) => [resample(st[0], step, taps), resample(st[1], step, taps)];

/* ── WAV I/O ─────────────────────────────────────────────────────── */
export function encodeWav([L, R], sr = SR) {
  const n = L.length;
  const data = Buffer.alloc(n * 6);
  let o = 0;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 2; c++) {
      const x = c ? R[i] : L[i];
      let v = Math.round((x > 1 ? 1 : x < -1 ? -1 : x) * 8388607);
      if (v < 0) v += 16777216;
      data[o] = v & 255;
      data[o + 1] = (v >> 8) & 255;
      data[o + 2] = (v >> 16) & 255;
      o += 3;
    }
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22);
  h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 6, 28); h.writeUInt16LE(6, 32);
  h.writeUInt16LE(24, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

/** Atomic write (tmp + rename) so a render reading the file never sees half of it. */
export function writeAtomic(file, buf) {
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, buf);
  renameSync(tmp, file);
}
export const writeWav = (file, st) => writeAtomic(file, encodeWav(st));

/** Read a PCM / float WAV → { sr, ch: Float32Array[] }. */
export function readWav(file) {
  const b = readFileSync(file);
  let o = 12;
  let fmt = null;
  let data = null;
  while (o + 8 <= b.length) {
    const id = b.toString('ascii', o, o + 4);
    const sz = b.readUInt32LE(o + 4);
    if (id === 'fmt ') fmt = { tag: b.readUInt16LE(o + 8), ch: b.readUInt16LE(o + 10), sr: b.readUInt32LE(o + 12), bits: b.readUInt16LE(o + 22) };
    if (id === 'data') data = { o: o + 8, sz: Math.min(sz, b.length - o - 8) };
    o += 8 + sz + (sz & 1);
  }
  if (!fmt || !data) throw new Error(`bad wav ${file}`);
  const bps = fmt.bits / 8;
  const frames = Math.floor(data.sz / (bps * fmt.ch));
  const ch = Array.from({ length: fmt.ch }, () => new Float32Array(frames));
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < fmt.ch; c++) {
      const p = data.o + (i * fmt.ch + c) * bps;
      let v;
      if (fmt.tag === 3 && bps === 4) v = b.readFloatLE(p);
      else if (bps === 2) v = b.readInt16LE(p) / 32768;
      else if (bps === 3) v = b.readIntLE(p, 3) / 8388608;
      else if (bps === 4) v = b.readInt32LE(p) / 2147483648;
      else throw new Error(`bits ${fmt.bits}`);
      ch[c][i] = v;
    }
  }
  return { sr: fmt.sr, ch };
}

/* ── a tiny PNG writer (for spectrogram / waveform QA images) ───── */
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
export function png(w, h, rgb) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w * 3; x++) raw[y * (w * 3 + 1) + 1 + x] = rgb[y * w * 3 + x];
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
