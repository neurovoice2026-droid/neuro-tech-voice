/**
 * FILM 2's EXTRAS — the sounds trailer #2 needs that film 1's library does not have, synthesised in layers
 * (docs/kb/PIPELINE.md §5 step 4; SCRIPT.md's per-beat "Sound" notes and the act builders' HITS requests).
 *
 *   extras(T) → Map<'kb/sfx/<family>[-k].wav', stereo>, one entry per variant of every T.SFX family whose
 *   `dir` is 'kb/sfx' (src/kb/timing.ts). scripts/kb/generate-sfx.mjs normalises each to −12 dBFS peak
 *   (check-mix asserts it), applies 0.3 / 12 ms edge fades, and caches the set on public/kb/sfx/lib.json —
 *   keyed on THIS file, dsp.mjs, the families' {n, pk}, LIGHT_NOTES, FPS and T.MUSIC. So extras() reads
 *   NOTHING ELSE from T: T.SFX (the kb families), T.FPS and T.MUSIC (T.MUSIC.fx holds every timeline value a
 *   sound is cut to: the trill's second-ring cut, the b05 montage's moments, the stop-time's length, the two
 *   room-tone windows). Deterministic: every random draw is seeded.
 *
 * The house rules: recorded-sounding, never a synth beep — every object sound is a filtered-noise transient
 * on top of short resonant bodies (struck modes), paper is grain + friction, the desk answers with a felt
 * thud, and every tone is a real instrument model (felt piano, soft vibraphone bar, nylon pluck, struck
 * glass). The sounds are DRY apart from a few baked early reflections where an object sits on the desk; the
 * mix adds the act's room (white / night) and the tempo delay (scripts/audio/mix.mjs).
 *
 * Building blocks copied from scripts/audio/sounds.mjs (edge, airTail, the flick's split-flap flutter) —
 * that file exports only library() / peakTime(), and editing it would change film 1's library key and mix
 * hash (PIPELINE.md H1).
 */
import {
  SR, TAU, mono, stereo, addMono, addStereo, osc, white, pink, env, ad, mode, filt, sweep, noise, spread, early,
  fdn, mtof, smooth, rng, gain,
} from '../audio/dsp.mjs';

const tanh = Math.tanh;
const sat = (sig, drive = 1.5) => sig.map((v) => tanh(v * drive) / tanh(drive));
const S = (sec) => Math.round(sec * SR);

/* ═════════════════════════ building blocks ═════════════════════════ */

/** A short HP noise transient: the "edge" of any contact (copied from film 1's library). */
function edge(seed, { f = 4000, tau = 0.0006, len = 0.02 } = {}) {
  return noise(len, seed, ad(0.00015, tau), 'hp', f, 0.7);
}

/** An air tail: band-passed noise, decorrelated L/R (copied from film 1's library). */
function airTail(seed, { f = 8000, q = 0.8, tau = 0.02, len = 0.12, amt = 0.7 } = {}) {
  return [noise(len, seed, ad(0.001, tau), 'bpn', f, q), noise(len, seed + 97, ad(0.001, tau), 'bpn', f * 1.07, q)].map(
    (c, k, arr) => (k === 0 ? c : c.map((v, i) => v * amt + arr[0][i] * (1 - amt))),
  );
}

/** Mix a mono signal into a mono buffer at `t` seconds. */
function mixIn(dst, src, t = 0, g = 1) {
  const s0 = S(t);
  for (let i = Math.max(0, -s0); i < src.length && s0 + i < dst.length; i++) dst[s0 + i] += src[i] * g;
  return dst;
}

/**
 * One damped partial, added in place: amp · sin(2πft + ph) · (a1·e^(−t/t1) + a2·e^(−t/t2)), a raised-cosine
 * attack of `att` s, and a damper from `damp` s (decay τ `dampTau`). Rotation oscillator + incremental
 * envelopes: no sin/exp per sample (the bed and the instruments call this thousands of times).
 */
function partial(out, f, amp, ph, t1, a1, t2, a2, att = 0.001, damp = Infinity, dampTau = 0.05, at = 0) {
  if (f <= 0 || f >= SR * 0.45) return;
  const s0 = Math.max(0, S(at));
  const w = (TAU * f) / SR;
  const cw = Math.cos(w);
  const sw = Math.sin(w);
  let x = Math.cos(ph);
  let y = Math.sin(ph);
  const k1 = Math.exp(-1 / (t1 * SR));
  const k2 = Math.exp(-1 / (t2 * SR));
  let e1 = a1;
  let e2 = a2;
  const attN = Math.max(1, att * SR);
  const dN = damp * SR;
  const kd = Math.exp(-1 / (dampTau * SR));
  let d = 1;
  for (let i = s0, j = 0; i < out.length; i++, j++) {
    let g = (e1 + e2) * amp;
    if (j < attN) g *= 0.5 - 0.5 * Math.cos((Math.PI * j) / attN);
    if (j >= dN) {
      d *= kd;
      g *= d;
      if (d < 1e-5) break;
    }
    out[i] += y * g;
    const nx = x * cw - y * sw;
    y = x * sw + y * cw;
    x = nx;
    e1 *= k1;
    e2 *= k2;
    if (e1 + e2 < 1e-6) break;
    if ((j & 1023) === 1023) {
      const m = 1 / Math.hypot(x, y);
      x *= m;
      y *= m;
    }
  }
}

/**
 * A tone that shimmers in stereo without a mono tremolo: the partial itself in both channels (`1 − side` of its
 * level) plus a slowly beating detuned pair (f ∓ bt/2, L/R) carrying `side` — a real bar or glass beats, but a
 * deep L/R cancellation would pump the mid (the cue's pan keeps the side and pans the mid).
 */
function pairPartial(st, f, amp, bt, side, tau, att, ph = 0) {
  partial(st[0], f, amp * (1 - side), ph, tau, 1, tau, 0, att);
  partial(st[1], f, amp * (1 - side), ph, tau, 1, tau, 0, att);
  partial(st[0], f - bt / 2, amp * side, ph + 0.4, tau, 1, tau, 0, att);
  partial(st[1], f + bt / 2, amp * side, ph + 1.3, tau, 1, tau, 0, att);
}

/** A struck body: modes [[f, amp, tau]] excited together (a short raised-cosine attack). */
function modes(len, list, att = 0.0005, seed = 0) {
  const r = rng(seed + 1);
  const m = mono(len);
  for (const [f, a, tau] of list) partial(m, f, a, r() * TAU, tau, 1, tau, 0, att);
  return m;
}

/**
 * Paper grain: a Poisson train of micro-impulses (`density(t)` per second, jittered amplitudes `amp(t)`),
 * band-passed — the crackle of paper being handled.
 */
function grains(len, seed, density, { lo = 1500, hi = 7000, amp = () => 1, jitter = 0.7, dur = 0.0005 } = {}) {
  const r = rng(seed);
  const m = mono(len);
  const k = Math.exp(-1 / (dur * SR));
  const n = Math.max(2, Math.round(dur * SR * 5));
  let t = 0;
  for (;;) {
    t += -Math.log(1 - r() * 0.999999) / Math.max(1, density(t));
    if (t >= len) break;
    const i0 = S(t);
    let v = amp(t) * (1 - jitter + jitter * r()) * (r() < 0.5 ? -1 : 1);
    for (let j = 0; j < n && i0 + j < m.length; j++) {
      m[i0 + j] += v * (j === 0 ? 1 : r() * 2 - 1);
      v *= k;
    }
  }
  return filt(m, ['hp', lo, 0.7], ['hp', lo, 0.7], ['lp', hi, 0.7], ['lp', hi, 0.7]);
}

/** Friction: noise in a band that follows the stroke (`f(t)`), with stick-slip micro-modulation, shaped by `a(t)`. */
function friction(len, seed, { f = () => 3000, q = 0.9, a = () => 1, grain = 0.5, color = 'white', rate = 160 } = {}) {
  const src = color === 'pink' ? pink(len, seed) : white(len, seed);
  const r = rng(seed + 7);
  const hold = Math.max(8, Math.round(SR / rate));
  let mod = 1;
  let target = 1;
  for (let i = 0; i < src.length; i++) {
    if (i % hold === 0) target = 1 - grain + grain * 2 * r();
    mod += (target - mod) * 0.03;
    src[i] *= mod;
  }
  return env(sweep(src, 'bpn', f, q), a);
}

/** The desk answering a contact: a felt thud with a falling pitch, and a little wooden knock. */
function thud(seed, { f0 = 110, f1 = 62, tauF = 0.02, tau = 0.045, len = 0.3, knock = 0.3, lp = 300 } = {}) {
  const b = filt(osc(len, (t) => f1 + (f0 - f1) * Math.exp(-t / tauF), ad(0.0025, tau)), ['lp', lp, 0.7]);
  const k = modes(len, [[190, 0.35, 0.02], [430, 0.15, 0.012]], 0.001, seed);
  for (let i = 0; i < b.length; i++) b[i] = b[i] + k[i] * knock;
  return b;
}

/** A few baked early reflections off the desk and the near wall (the object sits in a real place). */
function desk(st, amt = 0.35) {
  addStereo(st, early(st, [[2.5, 0.4, -1], [5.5, 0.32, 1], [9, 0.22, -1], [14, 0.15, 1]]), 0, amt);
  return st;
}

/** Pad a stereo buffer with silence at the end (so baked reflections are not cut). */
const pad = (st, sec) => {
  const n = st[0].length + S(sec);
  return st.map((c) => {
    const o = new Float32Array(n);
    o.set(c);
    return o;
  });
};

/**
 * A tone's natural end: a raised-cosine damp over the file's last `sec` s (a hand settling on the bar, a finger on
 * the glass), so a long decay never reaches the end of its file still sounding — the driver's 12 ms edge fade would
 * chop it there, audibly, in a quiet passage.
 */
function ringOut(st, sec) {
  const n = st[0].length;
  const a = Math.max(0, n - S(sec));
  for (const c of st) for (let i = a; i < n; i++) c[i] *= 0.5 + 0.5 * Math.cos((Math.PI * (i - a)) / Math.max(1, n - a));
  return st;
}

/* ═════════════════════════ instruments (the tones) ═════════════════════════ */

/**
 * FELT PIANO: stretched partials (inharmonicity B rising up the keyboard), two or three detuned strings,
 * a soft felt hammer (steep partial roll-off, the striking point notching the 8th), a two-stage decay
 * (prompt sound, aftersound), the key's thump and the felt's breath, a felt damper at `dur`.
 * (The same model as scripts/kb/bed.mjs's piano — copied, so each file's cache key covers its own code.)
 */
function feltPiano(m, { vel = 0.6, dur = 2.4, seed = 0, len } = {}) {
  const f = mtof(m);
  const L = len ?? dur + 0.5;
  const out = mono(L);
  const r = rng(seed * 31 + m);
  const B = 0.00022 * Math.pow(2, (m - 60) / 18);
  const strings = m < 36 ? 1 : m < 50 ? 2 : 3;
  const det = [0, 1.1, -0.8];
  for (let k = 1; k <= 16; k++) {
    const fk = f * k * Math.sqrt(1 + B * k * k);
    if (fk > 9000) break;
    const strike = 0.35 + 0.65 * Math.abs(Math.sin((Math.PI * k) / 8.3));
    const amp = Math.pow(k, -(2.4 - 0.9 * vel)) * strike;
    const t1 = (0.42 * Math.pow(440 / f, 0.35)) / Math.pow(k, 0.55);
    const t2 = (3.4 * Math.pow(440 / f, 0.45)) / Math.pow(k, 0.45);
    for (let s = 0; s < strings; s++) {
      partial(out, fk * Math.pow(2, det[s] / 1200), amp / strings, r() * TAU, t1, 0.62, t2, 0.38, 0.0035 - 0.0015 * vel, dur, 0.07);
    }
  }
  // the felt meeting the string (a soft, low noise breath) and the key bottoming in the action
  mixIn(out, noise(0.05, seed * 7 + m, ad(0.0012, 0.006), 'lp', 1100 + 900 * vel, 0.7), 0, 0.06 + 0.06 * vel);
  mixIn(out, modes(0.12, [[95 + (m % 7) * 3, 0.05, 0.03], [240, 0.02, 0.012]], 0.002, seed + m), 0, 1);
  // the damper's felt landing
  if (dur < L - 0.05) mixIn(out, noise(0.04, seed * 13 + m, ad(0.004, 0.01), 'lp', 500, 0.7), dur, 0.012);
  return filt(out, ['lp', 2600 + 2400 * vel, 0.6], ['hp', 38, 0.7]);
}

/** A soft vibraphone bar under a yarn mallet (no motor): partials 1 · 4 · 10, slow L/R beating, a soft contact. */
function vibe(m, seed, { len = 4.4, vel = 0.7 } = {}) {
  const f = mtof(m);
  const st = stereo(len);
  const r = rng(seed);
  const P = [
    [1, 1, 1.25],
    [3.99, 0.16 * vel, 0.32],
    [9.9, 0.04 * vel, 0.07],
    [2.0, 0.025, 0.6],
  ];
  for (const [ratio, a, tau] of P) {
    const fk = f * ratio;
    if (fk > 16000) continue;
    const t = tau * Math.pow(392 / f, 0.35);
    pairPartial(st, fk, a * 0.75, 0.45 * ratio, 0.3, t, 0.003, r() * TAU);
  }
  // the resonator tube blooms the fundamental a little after the strike
  partial(st[0], f, 0.1, 0, 0.9, 1, 0.9, 0, 0.02);
  partial(st[1], f, 0.1, 0, 0.9, 1, 0.9, 0, 0.02);
  // the yarn mallet's soft contact
  addMono(st, noise(0.03, seed + 5, ad(0.0012, 0.004), 'lp', 1500, 0.7), 0, 0.1, 0);
  // (no motor, no pedal: the bar rings ~4 s, then the player's hand settles on it)
  return ringOut(st, 1.2);
}

/** A nylon / kalimba-ish pluck: plucked-string partials (position comb), short decay, a nail tick, a wooden body. */
function pluckNote(m, seed, { bright = 0.55, tau = 0.42, len = 2.4 } = {}) {
  const f = mtof(m);
  const out = mono(len);
  const r = rng(seed);
  const beta = 0.17;
  for (let k = 1; k <= 18; k++) {
    const fk = f * k * Math.sqrt(1 + 0.00006 * k * k);
    if (fk > 12000) break;
    const amp = Math.abs(Math.sin(Math.PI * k * beta)) / Math.pow(k, 1.15 + (1 - bright) * 0.8);
    const t = tau / Math.pow(k, 0.8);
    partial(out, fk, amp, r() * TAU, t, 0.85, t * 2.6, 0.15, 0.0009);
  }
  mixIn(out, noise(0.015, seed + 1, ad(0.0002, 0.001), 'bpn', 3600, 0.9), 0, 0.12 + 0.12 * bright);
  mixIn(out, modes(0.4, [[198, 0.1, 0.06], [395, 0.05, 0.035]], 0.001, seed + 2), 0, 1);
  return ringOut(spread(filt(out, ['hp', 70, 0.7]), 0.2, seed + 3), 0.6);
}

/** A struck glass (rubber mallet on the rim): inharmonic glass modes as slowly beating pairs, a long clear decay. */
function glass(m, seed, { len = 4.6, strike = 1, decay = 1 } = {}) {
  const f = mtof(m);
  const st = stereo(len);
  const r = rng(seed);
  const P = [
    [1, 1, 1.55],
    [2.71, 0.2, 0.55],
    [5.17, 0.06, 0.2],
    [8.33, 0.02, 0.09],
  ];
  for (const [ratio, a, tau] of P) {
    const fk = f * ratio;
    if (fk > 17000) continue;
    pairPartial(st, fk, a * 0.75, 0.7 + r() * 0.8, 0.35, tau * decay, 0.0018, r() * TAU);
  }
  addMono(st, noise(0.02, seed + 3, ad(0.0002, 0.0011), 'hp', 3200, 0.7), 0, 0.1 * strike, 0);
  return ringOut(st, Math.min(1.4, len * 0.3));
}

/** A sine "ting" (her light): a pure tone with a slow shimmer pair and a tiny strike. */
function ting(m, seed, { len = 2.0, tau = 0.42 } = {}) {
  const f = mtof(m);
  const st = stereo(len);
  pairPartial(st, f, 0.65, 1.1, 0.3, tau, 0.002);
  partial(st[0], f * 2.756, 0.05, 0.3, 0.06, 1, 0.06, 0, 0.001);
  partial(st[1], f * 2.756, 0.05, 1.3, 0.06, 1, 0.06, 0, 0.001);
  addMono(st, edge(seed, { f: 6500, tau: 0.0003 }), 0, 0.06, 0);
  return ringOut(st, 0.5);
}

/* ═════════════════════════ the phone ═════════════════════════ */

const G4S = mtof(68);
const B4 = mtof(71);
/** the trill's shape: each chirp 115 ms, the second a dotted 16th after the first; the warble at 20 Hz */
const CHIRP = 0.115;
const CHIRP2 = 0.1875;

/**
 * THE DESK PHONE: one electronic ringer, a two-chirp trill warbling between G#4 and B4 (the score is in E),
 * through a small speaker behind its grille (no deep lows, a plastic resonance, a little saturation), with
 * the desk's first reflections. `chirps` 1 or 2; `cut` (s): the handset's hook switch cuts it there (2 ms).
 */
function ringer(seed, { chirps = 2, cut = Infinity } = {}) {
  const end = Math.min(cut, CHIRP2 * (chirps - 1) + CHIRP);
  const m = mono(end + 0.02);
  let ph = 0;
  for (let i = 0; i < m.length; i++) {
    const t = i / SR;
    let a = 0;
    for (let c = 0; c < chirps; c++) {
      const s = c * CHIRP2;
      const e = s + CHIRP;
      if (t >= s && t < e + 0.01) a = Math.max(a, Math.min(1, (t - s) / 0.0035) * (t > e ? 1 - (t - e) / 0.01 : 1));
    }
    if (t >= cut) a *= Math.max(0, 1 - (t - cut) / 0.002);
    const f = Math.sin(TAU * 20 * t) > 0 ? B4 : G4S;
    ph += (TAU * f) / SR;
    m[i] = a * (Math.sin(ph) + 0.2 * Math.sin(2 * ph) + 0.4 * Math.sin(3 * ph) + 0.2 * Math.sin(5 * ph) + 0.1 * Math.sin(7 * ph) + 0.05 * Math.sin(9 * ph));
  }
  let s = filt(m, ['hp', 300, 0.8], ['peak', 1250, 1.4, 4], ['peak', 2650, 2.2, 3], ['lp', 5200, 0.7]);
  s = filt(sat(s, 1.35), ['hp', 250, 0.7]);
  // the plastic housing rattles faintly with each chirp's onset
  for (let c = 0; c < chirps; c++) if (c * CHIRP2 < end) mixIn(s, modes(0.03, [[1830, 0.05, 0.004], [3120, 0.03, 0.003]], 0.0005, seed + c), c * CHIRP2, 1);
  return desk(pad(spread(s, 0.18, seed), 0.08), 0.4);
}

/** The handset lifted: a hollow plastic knock off the cradle, the hook switch springing up (a sharp click
 *  with a hint of metal), the hand's low thump, the cradle rattling back twice. */
function handset(seed, k) {
  const len = 0.4;
  const m = mono(len);
  mixIn(m, modes(0.2, [[372 + 20 * k, 0.45, 0.02], [810 + 30 * k, 0.32, 0.012], [1460, 0.18, 0.008]], 0.001, seed), 0, 0.6);
  mixIn(m, noise(0.03, seed + 1, ad(0.002, 0.008), 'bpn', 1800, 0.8), 0, 0.2);
  const tc = 0.004 + 0.002 * k;
  mixIn(m, edge(seed + 2, { f: 3500, tau: 0.0004 }), tc, 0.75);
  mixIn(m, modes(0.08, [[2240, 0.6, 0.004], [3710, 0.38, 0.0028], [5150, 0.18, 0.002]], 0.0002, seed + 3), tc, 1);
  mixIn(m, modes(0.15, [[6400 - 300 * k, 0.045, 0.025]], 0.0005, seed + 4), tc, 1);
  mixIn(m, thud(seed + 5, { f0: 100, f1: 60, tau: 0.04, knock: 0.2 }), 0, 0.45);
  mixIn(m, modes(0.05, [[1650, 0.2, 0.004], [2950, 0.12, 0.003]], 0.0003, seed + 6), 0.034 + 0.004 * k, 0.32);
  mixIn(m, modes(0.05, [[1700, 0.12, 0.004]], 0.0003, seed + 7), 0.061 + 0.003 * k, 0.18);
  return desk(spread(filt(m, ['hp', 45, 0.7]), 0.15, seed + 8), 0.3);
}

/** The caller's line opening: a puff of phone-band hiss and a little crackle, no tone. */
function lineOpen(seed) {
  const len = 0.35;
  const m = mono(len);
  mixIn(m, grains(len, seed, (t) => 700 * Math.exp(-t / 0.05), { lo: 400, hi: 3400, jitter: 0.9 }), 0, 0.7);
  mixIn(m, noise(len, seed + 1, (t) => smooth(t / 0.012) * Math.exp(-t / 0.08), 'bpn', 1600, 0.45), 0, 0.3);
  return spread(filt(m, ['hp', 300, 0.7], ['hp', 300, 0.7], ['lp', 3400, 0.7], ['lp', 3400, 0.7]), 0.25, seed + 2);
}

/** An open phone line: band-limited hiss (300–3400 Hz) with the codec's slow breath; `len` s, faded in / out. */
function lineHiss(seed, len, fin, fout) {
  const n = white(len, seed);
  const r = rng(seed + 1);
  let a = 1;
  let target = 1;
  for (let i = 0; i < n.length; i++) {
    if (i % 2400 === 0) target = 0.75 + 0.5 * r();
    a += (target - a) * 0.0006;
    const t = i / SR;
    n[i] *= a * Math.min(1, t / fin, (len - t) / fout) * (0.92 + 0.08 * Math.sin(TAU * 7.3 * t));
  }
  const s = filt(n, ['hp', 300, 0.7], ['hp', 300, 0.7], ['lp', 3400, 0.7], ['lp', 3400, 0.7], ['peak', 1100, 0.8, 2]);
  return spread(s, 0.08, seed + 2);
}

/* ═════════════════════════ paper, pens, the desk ═════════════════════════ */

/** A slip dropped onto the pile: the paper slap (with its crisp edge and its own flutter), the pile's soft desk thud, a settle. */
function slip(seed, k) {
  const len = 0.32;
  const m = mono(len);
  mixIn(m, noise(0.06, seed + 1, ad(0.0004, 0.0055), 'bpn', 2500 + 300 * k, 0.55), 0, 1);
  mixIn(m, noise(0.04, seed + 2, ad(0.0002, 0.0016), 'hp', 5200, 0.7), 0, 0.45);
  mixIn(m, modes(0.1, [[420 + 25 * k, 0.24, 0.01], [760 + 40 * k, 0.14, 0.007]], 0.0008, seed + 3), 0, 1);
  mixIn(m, thud(seed + 4, { f0: 115, f1: 66, tau: 0.035, knock: 0.25 }), 0.002, 0.48);
  mixIn(m, grains(0.12, seed + 5, (t) => 320 * Math.exp(-t / 0.035), { lo: 2000, hi: 8000 }), 0.01, 0.22);
  return desk(spread(filt(m, ['hp', 40, 0.7]), 0.2, seed + 6), 0.3);
}

/** A slip slid over paper: a short soft friction with grain, its loudest moment `pk` s in; the edge finds the pile. */
function slipSlide(seed, k, pk) {
  const len = pk + 0.24;
  const a = (t) => (t < pk ? Math.pow(smooth(t / pk), 1.3) : Math.exp(-(t - pk) / 0.055));
  const m = friction(len, seed, { f: (t) => 2000 + 1500 * smooth(t / pk) - 500 * Math.min(1, Math.max(0, t - pk) / 0.2), q: 0.7, a, grain: 0.55 });
  const g = grains(len, seed + 1, (t) => 1000 * a(t), { lo: 2500, hi: 9000 });
  for (let i = 0; i < m.length; i++) m[i] = m[i] * 0.8 + g[i] * 0.5;
  mixIn(m, noise(0.02, seed + 2, ad(0.0003, 0.002), 'bpn', 3100 + 200 * k, 1), pk + 0.025, 0.12);
  return spread(filt(m, ['hp', 450, 0.7], ['lp', 10000, 0.7]), 0.4, seed + 3);
}

/** A ceramic cup set down on a wooden desk: the contact, the cup's brief ring, the desk's knock and thud, a rock onto its rim. */
function cup(seed) {
  const len = 0.5;
  const m = mono(len);
  mixIn(m, edge(seed, { f: 3000, tau: 0.0004 }), 0, 0.45);
  mixIn(m, modes(len, [[1740, 0.5, 0.03], [2980, 0.32, 0.018], [4410, 0.2, 0.011], [6150, 0.1, 0.007], [3620, 0.1, 0.014]], 0.0003, seed), 0, 1);
  mixIn(m, modes(len, [[205, 0.5, 0.022], [470, 0.3, 0.014], [880, 0.12, 0.008]], 0.0008, seed + 3), 0, 1);
  mixIn(m, thud(seed + 5, { f0: 120, f1: 70, tau: 0.035, knock: 0.2 }), 0, 0.5);
  mixIn(m, modes(0.1, [[1765, 0.28, 0.012], [3010, 0.14, 0.008]], 0.0003, seed + 9), 0.022, 0.25);
  mixIn(m, edge(seed + 11, { f: 3500, tau: 0.0003 }), 0.022, 0.12);
  return desk(spread(filt(m, ['hp', 50, 0.7]), 0.15, seed + 12), 0.3);
}

/** A retractable pen clicked: the plunger, the cam locking 16 ms later, the spring's faint tink. */
function pen(seed) {
  const len = 0.14;
  const m = mono(len);
  const clk = (t, g, f1, f2, sd) => {
    mixIn(m, edge(sd, { f: 4500, tau: 0.00025, len: 0.01 }), t, 0.6 * g);
    mixIn(m, modes(0.05, [[f1, 0.5, 0.0025], [f2, 0.3, 0.0016], [1150, 0.2, 0.004]], 0.0002, sd + 1), t, g);
  };
  clk(0, 1, 2900, 5300, seed);
  clk(0.016, 0.55, 3500, 6100, seed + 10);
  mixIn(m, modes(0.1, [[6900, 0.07, 0.018]], 0.0005, seed + 20), 0.002, 1);
  return desk(spread(m, 0.1, seed + 21), 0.25);
}

/** The pile squared against the desk and lifted: two soft dry paper taps and a breath of air. */
function paperSquare(seed) {
  const len = 0.32;
  const m = mono(len);
  const tap = (t, g, sd) => {
    mixIn(m, noise(0.03, sd, ad(0.0005, 0.004), 'bpn', 1700, 0.7), t, 0.8 * g);
    mixIn(m, modes(0.08, [[255, 0.4, 0.012], [610, 0.22, 0.007]], 0.001, sd + 1), t, g);
    mixIn(m, grains(0.05, sd + 2, (u) => 500 * Math.exp(-u / 0.015), { lo: 2500, hi: 8000 }), t, 0.25 * g);
  };
  tap(0, 1, seed);
  tap(0.088, 0.65, seed + 10);
  mixIn(m, noise(len, seed + 20, (t) => Math.sin(Math.PI * Math.min(1, t / 0.25)) ** 2, 'lp', 700, 0.7), 0.04, 0.12);
  return desk(spread(filt(m, ['hp', 70, 0.7]), 0.25, seed + 21), 0.25);
}

/** A pad sheet folding to a strip: the crease (a dense crinkle), then a soft slide; no tone. */
function paperFold(seed) {
  const len = 0.34;
  const m = mono(len);
  mixIn(m, grains(len, seed, (t) => 2600 * Math.exp(-t / 0.03), { lo: 1800, hi: 8500, dur: 0.0004 }), 0, 0.8);
  mixIn(m, friction(len, seed + 1, { f: () => 2600, q: 0.6, a: (t) => smooth((t - 0.05) / 0.06) * Math.exp(-Math.max(0, t - 0.12) / 0.07), grain: 0.5 }), 0, 0.5);
  return spread(filt(m, ['hp', 500, 0.7]), 0.35, seed + 2);
}

/** One strip landing on the one below: a dry paper tick with a light body. */
function riffleTick(seed, k) {
  const len = 0.05;
  const m = mono(len);
  mixIn(m, noise(len, seed, ad(0.0003, 0.0028), 'bpn', 2700 + 180 * k, 0.8), 0, 0.9);
  mixIn(m, edge(seed + 1, { f: 5500, tau: 0.0002 }), 0, 0.25);
  mixIn(m, modes(len, [[520 + 30 * k, 0.22, 0.006]], 0.0006, seed + 2), 0, 1);
  return spread(m, 0.2, seed + 3);
}

/** The teleprompter: a faint continuous paper drag (≈ 4 s), in over a beat, the speed breathing. */
function scroll(seed) {
  const len = 4.2;
  const r = rng(seed);
  const ph = [r() * TAU, r() * TAU];
  const a = (t) => smooth(t / 0.5) * (1 - smooth((t - 3.0) / 1.2)) * (0.8 + 0.12 * Math.sin(TAU * 0.6 * t + ph[0]) + 0.08 * Math.sin(TAU * 1.7 * t + ph[1]));
  const L = friction(len, seed + 1, { f: (t) => 2300 + 300 * Math.sin(TAU * 0.4 * t), q: 0.5, a, grain: 0.35, color: 'pink' });
  const R = friction(len, seed + 2, { f: (t) => 2400 + 300 * Math.sin(TAU * 0.4 * t + 1), q: 0.5, a, grain: 0.35, color: 'pink' });
  return [filt(L, ['hp', 600, 0.7]), filt(R, ['hp', 600, 0.7])];
}

/** A slip sliding up under the pile: a short dry slide ending in a soft click ON the hit (`pk` s in). */
function tuck(seed, k, pk) {
  const len = pk + 0.08;
  const m = friction(len, seed, { f: (t) => 2400 + 1400 * (t / pk), q: 0.8, a: (t) => (t < pk ? Math.pow(t / pk, 1.6) : Math.exp(-(t - pk) / 0.01)), grain: 0.5 });
  for (let i = 0; i < m.length; i++) m[i] *= 0.5;
  mixIn(m, noise(0.03, seed + 1, ad(0.0003, 0.0022), 'bpn', 2900 + 200 * k, 0.9), pk, 0.8);
  mixIn(m, modes(0.05, [[470 + 20 * k, 0.18, 0.006]], 0.0006, seed + 2), pk, 1);
  return spread(filt(m, ['hp', 300, 0.7]), 0.25, seed + 3);
}

/** The pile settling: a soft low paper thud, a shuffle of grain, no ring. */
function settle(seed) {
  const len = 0.3;
  const m = mono(len);
  mixIn(m, thud(seed, { f0: 100, f1: 58, tau: 0.055, lp: 260, knock: 0.15 }), 0, 1);
  mixIn(m, noise(0.05, seed + 1, ad(0.001, 0.008), 'bpn', 1600, 0.6), 0, 0.25);
  mixIn(m, grains(0.1, seed + 2, (t) => 400 * Math.exp(-t / 0.03), { lo: 2000, hi: 7000 }), 0.005, 0.18);
  return desk(spread(m, 0.15, seed + 3), 0.25);
}

/** A row landing: a pitched paper "tock" on E5 (retuned per chord tone by the cue): a hollow, quick body, a paper click. */
function tock(seed) {
  const f = mtof(76);
  const len = 0.25;
  const m = mono(len);
  const body = osc(len, (t) => f * (1 + 0.035 * Math.exp(-t / 0.004)), ad(0.0008, 0.042));
  mixIn(m, body, 0, 0.6);
  mixIn(m, modes(len, [[f * 2.03, 0.14, 0.018], [f * 3.15, 0.06, 0.009]], 0.0006, seed), 0, 1);
  mixIn(m, noise(0.03, seed + 1, ad(0.0003, 0.002), 'bpn', 2400, 0.8), 0, 0.35);
  mixIn(m, modes(len, [[185, 0.2, 0.014]], 0.001, seed + 2), 0, 1);
  return spread(filt(m, ['hp', 90, 0.7]), 0.15, seed + 3);
}

/** A sheet flexing open into a page (≈ .8 s): crinkle growing, an air "whomp" as it opens, a soft settle tap. */
function paperUnfold(seed) {
  const len = 0.85;
  const m = mono(len);
  const flex = (t) => smooth(t / 0.3) * Math.exp(-Math.max(0, t - 0.35) / 0.08);
  mixIn(m, grains(len, seed, (t) => 60 + 1800 * flex(t), { lo: 1600, hi: 8000, amp: (t) => 0.5 + 0.5 * flex(t) }), 0, 0.6);
  mixIn(m, friction(len, seed + 1, { f: (t) => 1600 + 1400 * flex(t), q: 0.5, a: flex, grain: 0.6, color: 'pink' }), 0, 0.35);
  mixIn(m, noise(len, seed + 2, (t) => Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, (t - 0.18) / 0.36))), 2), 'lp', 420, 0.8), 0, 0.3);
  mixIn(m, noise(0.03, seed + 3, ad(0.0006, 0.004), 'bpn', 1500, 0.7), 0.52, 0.25);
  mixIn(m, modes(0.1, [[300, 0.12, 0.01]], 0.001, seed + 4), 0.52, 1);
  return spread(filt(m, ['hp', 60, 0.7]), 0.35, seed + 5);
}

/** A light dry paper lift (≈ .2 s): a rising peel of grain and air, a tiny release tick. */
function paperLift(seed, k) {
  const len = 0.24;
  const m = mono(len);
  const a = (t) => smooth(t / 0.13) * Math.exp(-Math.max(0, t - 0.13) / 0.03);
  mixIn(m, grains(len, seed, (t) => 100 + 1500 * a(t), { lo: 2200, hi: 9000 }), 0, 0.55);
  mixIn(m, friction(len, seed + 1, { f: (t) => 2800 + 1800 * (t / len), q: 0.6, a, grain: 0.4 }), 0, 0.4);
  mixIn(m, noise(0.02, seed + 2, ad(0.0003, 0.0018), 'bpn', 3400 + 300 * k, 1), 0.135, 0.18);
  return spread(filt(m, ['hp', 700, 0.7]), 0.4, seed + 3);
}

/** A felt-tip swipe across paper (`len` s): smooth soft friction, a faint felt squeak, the nib's contact and lift. */
function feltTip(seed, len, { bright = 1 } = {}) {
  const r = rng(seed);
  const a = (t) => smooth(t / 0.035) * (1 - smooth((t - (len - 0.12)) / 0.12)) * (0.85 + 0.15 * Math.sin(TAU * 3.1 * t + r() * TAU));
  const m = friction(len, seed + 1, { f: (t) => 2600 + 900 * (t / len) * bright, q: 0.75, a, grain: 0.3, rate: 260 });
  const hi = friction(len, seed + 2, { f: () => 6200, q: 1, a, grain: 0.4 });
  const sq = osc(len, (t) => 2150 + 120 * Math.sin(TAU * 4.3 * t) + 200 * (t / len), (t) => a(t) * 0.04 * bright);
  for (let i = 0; i < m.length; i++) m[i] = m[i] * 0.7 + hi[i] * 0.3 + sq[i];
  mixIn(m, noise(0.015, seed + 3, ad(0.0003, 0.0015), 'bpn', 3300, 1), 0, 0.12);
  return spread(filt(m, ['hp', 900, 0.7], ['lp', 9000, 0.7]), 0.25, seed + 4);
}

/** A fine pen scratch (≈ .3 s): a dense train of nib micro-impulses, high-passed, with the stroke's speed curve. */
function scratch(seed) {
  const len = 0.34;
  const a = (t) => smooth(t / 0.04) * (1 - smooth((t - 0.2) / 0.12));
  const m = grains(len, seed, (t) => 1800 * a(t), { lo: 3800, hi: 10500, amp: a, dur: 0.00025 });
  const f = friction(len, seed + 1, { f: () => 5200, q: 0.9, a, grain: 0.6, rate: 400 });
  for (let i = 0; i < m.length; i++) m[i] = m[i] * 0.8 + f[i] * 0.25;
  return spread(m, 0.3, seed + 2);
}

/** The felt-tip leaving the paper (≈ 60 ms): the last of the friction, a tiny lift tick. */
function penLift(seed) {
  const len = 0.09;
  const m = friction(len, seed, { f: (t) => 3400 + 2000 * (t / len), q: 0.8, a: (t) => Math.exp(-t / 0.018), grain: 0.4 });
  mixIn(m, noise(0.012, seed + 1, ad(0.0002, 0.0012), 'bpn', 4200, 1), 0.028, 0.25);
  return spread(filt(m, ['hp', 1200, 0.7]), 0.2, seed + 2);
}

/** The call strip folding into a white card: a paper click with a little body, a short rustle. */
function record(seed) {
  const len = 0.2;
  const m = mono(len);
  mixIn(m, edge(seed, { f: 3500, tau: 0.0004 }), 0, 0.5);
  mixIn(m, modes(len, [[2350, 0.35, 0.003], [1180, 0.25, 0.006], [225, 0.42, 0.016], [520, 0.15, 0.01]], 0.0004, seed + 1), 0, 1);
  mixIn(m, grains(0.08, seed + 2, (t) => 500 * Math.exp(-t / 0.02), { lo: 2500, hi: 8000 }), 0.006, 0.2);
  return desk(spread(m, 0.15, seed + 3), 0.2);
}

/** A small dry card tick with a hint of body (≈ 25 ms): a tag popping beside a label. */
function tag(seed) {
  const len = 0.06;
  const m = mono(len);
  mixIn(m, edge(seed, { f: 4200, tau: 0.0003 }), 0, 0.45);
  mixIn(m, modes(len, [[3050, 0.3, 0.0015], [920, 0.26, 0.005], [255, 0.2, 0.008]], 0.0003, seed + 1), 0, 1);
  return spread(m, 0.1, seed + 2);
}

/** A light panel opening from its trigger (≈ 30 ms): a soft low dry pop with a breath of air, no pitch. */
function menuOpen(seed) {
  const len = 0.1;
  const m = mono(len);
  mixIn(m, noise(len, seed, ad(0.0015, 0.009), 'lp', 650, 0.7), 0, 0.9);
  mixIn(m, modes(len, [[330, 0.3, 0.01], [760, 0.1, 0.005]], 0.0015, seed + 1), 0, 1);
  mixIn(m, noise(len, seed + 2, ad(0.002, 0.012), 'bpn', 5000, 0.6), 0, 0.06);
  return spread(m, 0.2, seed + 3);
}

/* ═════════════════════════ the interface ═════════════════════════ */

/** A pointer button going down: the micro-switch's crisp snap, the shell's plastic modes, the finger's low body. */
function clickDown(seed, k) {
  const len = 0.08;
  const m = mono(len);
  mixIn(m, edge(seed, { f: 5000, tau: 0.00025 }), 0, 0.45);
  mixIn(m, modes(len, [[2050 + 120 * k, 0.5, 0.0035], [3420 + 150 * k, 0.32, 0.0022], [5900, 0.1, 0.0012]], 0.0002, seed + 1), 0, 1);
  mixIn(m, modes(len, [[310 + 15 * k, 0.32, 0.007], [720 + 20 * k, 0.16, 0.005]], 0.0008, seed + 2), 0, 1);
  return desk(spread(m, 0.1, seed + 3), 0.18);
}

/** … and coming back up: lighter, a touch higher, no body. */
function clickUp(seed, k) {
  const len = 0.05;
  const m = mono(len);
  mixIn(m, edge(seed, { f: 6000, tau: 0.0002 }), 0, 0.42);
  mixIn(m, modes(len, [[2620 + 140 * k, 0.42, 0.0022], [4300 + 100 * k, 0.22, 0.0015]], 0.0002, seed + 1), 0, 1);
  mixIn(m, modes(len, [[520, 0.07, 0.003]], 0.0006, seed + 2), 0, 1);
  return spread(m, 0.1, seed + 3);
}

/** A low-profile (scissor) keystroke: the finger on the cap, the key bottoming out, its release clack. */
function keystroke(seed, k) {
  const r = rng(seed);
  const len = 0.11;
  const m = mono(len);
  mixIn(m, noise(0.02, seed + 1, ad(0.0004, 0.0026), 'bpn', 1900 + r() * 700, 1.1), 0, 0.45);
  mixIn(m, modes(0.05, [[2300 + r() * 500, 0.26, 0.003], [3700 + r() * 600, 0.13, 0.002]], 0.0003, seed + 2), 0, 1);
  mixIn(m, modes(0.06, [[255 + r() * 60, 0.42, 0.009], [600 + r() * 90, 0.24, 0.006], [1150 + r() * 150, 0.14, 0.004]], 0.0006, seed + 3), 0.003, 1);
  const tr = 0.042 + r() * 0.018;
  mixIn(m, modes(0.04, [[2900 + r() * 400, 0.12, 0.002], [430 + r() * 40, 0.07, 0.004]], 0.0003, seed + 4), tr, 1);
  mixIn(m, edge(seed + 5, { f: 5000, tau: 0.0002 }), tr, 0.1);
  return desk(spread(m, 0.12, seed + 6 + k), 0.15);
}

/** A tiny dry interface tick (a pill rolling, a word landing, a selection snapping). */
function tick(seed, k) {
  const len = 0.04;
  const m = mono(len);
  mixIn(m, edge(seed, { f: 6000, tau: 0.0002 }), 0, 0.45);
  mixIn(m, modes(len, [[4800 + 300 * k, 0.28, 0.0016], [2300 + 100 * k, 0.18, 0.001]], 0.0002, seed + 1), 0, 1);
  return spread(m, 0.15, seed + 2);
}

/** The split-flap window: a light card flap snapping onto its stop — a dry click, a hollow body, a tiny flutter. */
function flap(seed) {
  const len = 0.08;
  const m = mono(len);
  mixIn(m, edge(seed, { f: 3800, tau: 0.0004 }), 0, 0.55);
  mixIn(m, modes(len, [[3150, 0.32, 0.0018], [1480, 0.28, 0.004], [690, 0.38, 0.008], [240, 0.18, 0.01]], 0.0003, seed + 1), 0, 1);
  mixIn(m, modes(0.03, [[3300, 0.1, 0.0012]], 0.0002, seed + 2), 0.009, 1);
  return desk(spread(m, 0.1, seed + 3), 0.2);
}

/** The clock's figures rolling (film 1's split-flap flutter: six micro-clicks accelerating into the landing). */
function flick(seed, k) {
  const len = 0.16;
  const st = stereo(len);
  const at = k ? [0, 0.02, 0.036, 0.05, 0.062, 0.072] : [0, 0.022, 0.039, 0.053, 0.065, 0.075];
  at.forEach((t, i) => {
    const m = mono(0.03);
    const tr = edge(seed + k * 10 + i, { f: 4500, tau: 0.0004, len: 0.03 });
    const md = mode(0.03, 3100 + i * 120, 0.4, 0.003);
    for (let j = 0; j < m.length; j++) m[j] = (tr[j] ?? 0) * 0.6 + md[j];
    addMono(st, m, t, 0.45 + 0.11 * i, (i % 2 ? 0.25 : -0.25) * (k ? -1 : 1));
  });
  return st;
}

/** Her light lifting off the clock: a soft rising sine seed B4 → E5 over `len` s, swelling into its end, with a breath of air. */
function seedTone(seed, len) {
  const f0 = mtof(71);
  const f1 = mtof(76);
  const fr = (t) => f0 * Math.pow(f1 / f0, smooth(t / len));
  const a = (t) => Math.pow(Math.min(1, t / len), 1.8) * (t > len ? Math.max(0, 1 - (t - len) / 0.015) : 1);
  const L = len + 0.02;
  const st = stereo(L);
  addMono(st, osc(L, (t) => fr(t) * 0.999, a), 0, 0.5, -0.3);
  addMono(st, osc(L, (t) => fr(t) * 1.001, a), 0, 0.5, 0.3);
  addMono(st, osc(L, (t) => fr(t) * 2, (t) => a(t) * 0.08), 0, 1, 0);
  addStereo(st, [noise(L, seed, a, 'bpn', 5200, 0.6), noise(L, seed + 1, a, 'bpn', 5600, 0.6)], 0, 0.06);
  return st;
}

/* ═════════════════════════ ambience ═════════════════════════ */

/**
 * FRONT-DESK ROOM TONE (replaces a third reverb: PIPELINE.md §5): the HVAC's soft rumble and air, a faint
 * fan tone, the far street (slow swells, a car passing now and then); decorrelated L/R. `len` s, faded in
 * over `fin` and out over `fout`.
 */
function roomTone(seed, len, fin, fout) {
  const r = rng(seed);
  const st = stereo(len);
  const cars = [];
  for (let t = 2.5 + r() * 3; t < len - 2; t += 6 + r() * 5) cars.push(t);
  for (let c = 0; c < 2; c++) {
    const rumble = filt(pink(len, seed + 10 + c), ['lp', 240, 0.6], ['hp', 32, 0.7]);
    const air = filt(pink(len, seed + 20 + c), ['hp', 700, 0.6], ['lp', 5000, 0.6]);
    const street = filt(pink(len, seed + 30 + c), ['lp', 380, 0.7], ['hp', 45, 0.7]);
    const ph = [r() * TAU, r() * TAU, r() * TAU];
    const fan = osc(len, (t) => 117 * (1 + 0.003 * Math.sin(TAU * 0.07 * t + ph[2])), 1);
    const fan2 = osc(len, 234.5, 1);
    const L = st[c];
    for (let i = 0; i < L.length; i++) {
      const t = i / SR;
      const swell = 0.6 + 0.25 * Math.sin(TAU * 0.043 * t + ph[0]) + 0.15 * Math.sin(TAU * 0.11 * t + ph[1]);
      L[i] = rumble[i] * 0.9 + air[i] * 0.05 + street[i] * 0.55 * swell + fan[i] * 0.006 + fan2[i] * 0.0025;
    }
    for (const [j, t0] of cars.entries()) {
      const d = 3.2 + (j % 2) * 0.8;
      const car = sweep(pink(d, seed + 40 + j * 2 + c), 'bpn', (t) => 300 + 260 * Math.sin(Math.PI * Math.min(1, t / d)), 0.7);
      const a = (t) => Math.pow(Math.sin(Math.PI * Math.min(1, t / d)), 2) * (c === (j % 2) ? 1 : 0.7);
      mixIn(L, env(car, a), t0, 0.22);
    }
    for (let i = 0; i < L.length; i++) {
      const t = i / SR;
      L[i] *= Math.min(1, t / fin, (len - t) / fout);
    }
  }
  return st;
}

/* ═════════════════════════ composites ═════════════════════════ */

/**
 * b05 · THE REST OF THE DAY as ONE file, hard-cut ON THE SAMPLE at the stop (SCRIPT.md b05: "music and SFX are
 * cut on the sample with no tail"): a cue's own tail and the mix's room returns would ring past the stop, so
 * the montage carries its own small room and ends at the hard stop exactly. Per roll (on 8ths): the clock's
 * figures roll (`flickLead` before), a chirp cut by the pickup click (`pickupAfter` on), the slip lands
 * (`rollSlips`). The file starts `lead` frames before the first roll — the family's pk (src/kb/timing.ts).
 */
function rollsMontage(fx, FPS) {
  const t0 = fx.rolls[0] - fx.lead;
  const sec = (f) => (f - t0) / FPS;
  const end = sec(fx.hardStop);
  // (20 ms of silence after the stop: the driver's 12 ms edge fade then lands on zeros, not on the last 10 ms before it)
  const st = stereo(end + 0.02);
  fx.rolls.forEach((f, k) => {
    const g = gain(0.35 * k);
    addStereo(st, flick(8100 + k, k % 2), sec(f - fx.flickLead), 0.42 * g);
    addStereo(st, ringer(8200 + k, { chirps: 1, cut: fx.pickupAfter / FPS }), sec(f), 0.6 * g);
    addStereo(st, handset(8300 + k * 3, k % 2), sec(f + fx.pickupAfter), 0.5 * g);
    addStereo(st, slip(8400 + k * 5, k % 3), sec(fx.rollSlips[k]), 0.78 * g);
  });
  const room = fdn(st, { rt60: 0.45, rt60Hi: 0.3, pre: 0.006, size: 0.5, hp: 250, lp: 9000, tail: 0 });
  addStereo(st, room, 0, 0.22);
  // THE HARD STOP: zero from the stop's sample on (a 1 ms ramp into it, so it never clicks)
  const cut = S(end);
  const ramp = S(0.001);
  for (const c of st) for (let i = Math.max(0, cut - ramp); i < c.length; i++) c[i] *= i >= cut ? 0 : (cut - i) / ramp;
  return st;
}

/* ═════════════════════════ the families ═════════════════════════ */

/**
 * Every film-2 extra: family → (variant k, ctx) → stereo. ctx = { pk (s), fx (T.MUSIC.fx), FPS }.
 * The tuned families are synthesised at their exact notes (their names say which); `fx-tock` is built on
 * E5 and retuned per chord tone by the cue's `semi`.
 */
const MAKE = {
  'fx-trill': (k) => ringer(5001, { chirps: 2 }),
  'fx-trill-15': (k, c) => ringer(5001, { chirps: 2, cut: c.fx.ring2Cut / c.FPS }),
  'fx-trill-1': (k) => ringer(5001, { chirps: 1 }),
  'fx-pickup': (k) => handset(5101 + k * 7, k),
  'fx-line': () => lineOpen(5201),
  'fx-linehiss': () => lineHiss(5301, 0.3, 0.012, 0.05),
  'fx-linehold': (k, c) => lineHiss(5311, (c.fx.stopTime[1] - c.fx.stopTime[0]) / c.FPS + 0.3, 0.25, 0.3),
  'fx-rolls': (k, c) => rollsMontage(c.fx, c.FPS),
  'fx-slip': (k) => slip(5401 + k * 11, k),
  'fx-slip-slide': (k, c) => slipSlide(5501 + k * 11, k, c.pk),
  'fx-cup': () => cup(5601),
  'fx-pen': () => pen(5701),
  'fx-roomtone': (k, c) => roomTone(5801, (c.fx.room[1] - c.fx.room[0]) / c.FPS, 0.4, 2.5),
  'fx-roomtone-desk': (k, c) => roomTone(5851, (c.fx.roomDesk[1] - c.fx.roomDesk[0]) / c.FPS, 1.2, 1.5),
  'fx-paper-square': () => paperSquare(5901),
  'fx-paper-fold': () => paperFold(6001),
  'fx-riffle': (k) => riffleTick(6101 + k * 5, k),
  'fx-scroll': () => scroll(6201),
  'fx-flap': () => flap(6301),
  'fx-seed': (k, c) => seedTone(6401, c.fx.seed / c.FPS),
  'fx-ting': () => ting(83, 6501),
  'fx-click-down': (k) => clickDown(6601 + k * 7, k),
  'fx-click-up': (k) => clickUp(6701 + k * 7, k),
  'fx-keys': (k) => keystroke(6801 + k * 13, k),
  'fx-tick': (k) => tick(6901 + k * 5, k),
  'fx-tock': () => tock(7001),
  'fx-tuck': (k, c) => tuck(7101 + k * 7, k, c.pk),
  'fx-settle': () => settle(7201),
  'fx-mallet-e4': () => vibe(64, 7301),
  'fx-mallet-fs4': () => vibe(66, 7302),
  'fx-mallet-gs4': () => vibe(68, 7303),
  'fx-mallet-b4': () => vibe(71, 7304),
  'fx-mallet-e5': () => vibe(76, 7305, { len: 5.0 }),
  'fx-felt-e': () => {
    const m = feltPiano(64, { vel: 0.45, dur: 2.6, seed: 7401 });
    return spread(m, 0.25, 7402);
  },
  'fx-paper-unfold': () => paperUnfold(7501),
  'fx-felttip': (k) => feltTip(7601 + k * 7, 0.5),
  'fx-felttip-short': () => feltTip(7651, 0.22, { bright: 0.7 }),
  'fx-scratch': (k) => scratch(7701 + k * 7),
  'fx-pluck-e4': () => pluckNote(64, 7801),
  'fx-pluck-fs4': () => pluckNote(66, 7802),
  'fx-pluck-gs4': () => pluckNote(68, 7803),
  'fx-pluck-b4': () => pluckNote(71, 7804),
  'fx-pluck-e5': () => pluckNote(76, 7805, { bright: 0.8, tau: 0.5 }),
  'fx-paper-lift': (k) => paperLift(7901 + k * 7, k),
  'fx-record': () => record(8001),
  'fx-tag': () => tag(8501),
  'fx-menu-open': () => menuOpen(8601),
  'fx-pen-lift': () => penLift(8701),
  'fx-glass-tick': () => {
    const st = glass(88, 8801, { len: 0.5, strike: 1.4, decay: 0.05 });
    addStereo(st, airTail(8802, { f: 9000, tau: 0.03, len: 0.5 }), 0, 0.05);
    return st;
  },
  'fx-glass-e6': () => glass(88, 8901),
  'fx-glass-gs6': () => glass(92, 8902),
  'fx-glass-b6': () => glass(95, 8903),
};

/** Every film-2 extra the timeline defines (T.SFX families with dir 'kb/sfx'), as 'kb/sfx/<file>.wav' → stereo. */
export function extras(T) {
  const out = new Map();
  const FPS = T.FPS;
  const fx = T.MUSIC.fx;
  for (const [name, def] of Object.entries(T.SFX)) {
    if (def.dir !== 'kb/sfx') continue;
    const make = MAKE[name];
    if (!make) throw new Error(`[sounds:kb] no generator for the family "${name}" (scripts/kb/sounds.mjs MAKE)`);
    for (let k = 0; k < def.n; k++) {
      const st = make(k, { pk: def.pk / FPS, fx, FPS });
      out.set(`kb/sfx/${def.n > 1 ? `${name}-${k}` : name}.wav`, st);
    }
  }
  return out;
}

/** The family names this file can make (for QA). */
export const FAMILIES = Object.keys(MAKE);
