/**
 * THE SOUND LIBRARY — every effect in the trailer, synthesised in layers.
 *
 * library(T) → Map<'sfx/<name>[-k].wav', stereo> with one entry per family/variant
 * of T.SFX (src/timing.ts). Sounds are DRY (their own designed tails only); the
 * mix adds the room of the act and the tempo delay. Pre-rolled sounds (whooshes,
 * risers, swells, the flip, the ring) are built so their loudest moment falls
 * exactly T.SFX[name].pk frames after they start — the cue sheet lands that
 * moment on the picture's hit.
 *
 * Tuned families (tick, pop, ping, ding-s) are synthesised on B (the light offsets
 * in T.LIGHT_SEMI retune them by playback rate in the mix). The four light chimes
 * are synthesised at their exact notes: rush E5 · closing G#5 · sunday B5 · night E6.
 */
import {
  SR, TAU, N, mono, stereo, dup, addMono, addStereo, scale, osc, white, pink, env, ad, mode, filt,
  filtSt, sweep, noise, spread, fdn, reverse, trimTail, mtof, semis, smooth, rng, clamp, Saw, width, gain, balance,
} from './dsp.mjs';

const tanh = Math.tanh;
const sat = (sig, drive = 1.5) => sig.map((v) => tanh(v * drive) / tanh(drive));

/** Envelope-peak time of a stereo buffer (10 ms RMS) in seconds — for QA of pre-rolls. */
export function peakTime(st) {
  const w = Math.round(0.01 * SR);
  let acc = 0;
  let best = 0;
  let at = 0;
  const [L, R] = st;
  for (let i = 0; i < L.length; i++) {
    acc += L[i] * L[i] + R[i] * R[i] - (i >= w ? L[i - w] * L[i - w] + R[i - w] * R[i - w] : 0);
    if (acc > best) { best = acc; at = i - w / 2; }
  }
  return at / SR;
}

/* ═════════════════════════ building blocks ═════════════════════════ */

/** A short HP noise transient (the "edge" of a click). */
function edge(seed, { f = 4000, tau = 0.0006, len = 0.02 } = {}) {
  return noise(len, seed, ad(0.00015, tau), 'hp', f, 0.7);
}

/** An air tail: band-passed noise, decorrelated L/R. */
function airTail(seed, { f = 8000, q = 0.8, tau = 0.02, len = 0.12, amt = 0.7 } = {}) {
  return [noise(len, seed, ad(0.001, tau), 'bpn', f, q), noise(len, seed + 97, ad(0.001, tau), 'bpn', f * 1.07, q)].map(
    (c, k, arr) => (k === 0 ? c : c.map((v, i) => v * amt + arr[0][i] * (1 - amt))),
  );
}

/**
 * A struck bell / glass voice: inharmonic partials with per-side detune (slow
 * beating → a moving stereo tail), a felt-mallet strike, and a glassy shimmer.
 */
function bellVoice(sec, f0, { bright = 1, decay = 1, strike = 1, glass = 1, seed = 1, att = 0.0015, hum = 1 } = {}) {
  const r = rng(seed);
  const vary = (x, amt = 0.1) => x * (1 + (r() * 2 - 1) * amt);
  const P = [
    [0.5, 0.16 * hum, 2.6],
    [1.0, 1.0, 1.8],
    [2.0, 0.4, 1.05],
    [2.76, 0.28 * bright, 0.56],
    [4.07, 0.15 * bright, 0.32],
    [5.43, 0.09 * bright, 0.2],
    [6.81, 0.05 * bright * bright, 0.12],
  ];
  const out = stereo(sec);
  for (const [ratio, amp, tau] of P) {
    const f = f0 * ratio;
    if (f > 19000) continue;
    const dt = (0.25 + 0.15 * r()) * ratio; // Hz of L/R detune → beating in the tail
    const a = vary(amp);
    const t = vary(tau * decay, 0.08);
    const ph = r() * TAU;
    addMono(out, osc(sec, f - dt, ad(att, t), ph), 0, a, -0.55);
    addMono(out, osc(sec, f + dt, ad(att, t), ph + 0.7), 0, a, 0.55);
  }
  // glassy shimmer: the 4th and 6th harmonics, slowly beating
  if (glass > 0) {
    for (const [h, amp, tau] of [[4, 0.07, 0.9], [6, 0.035, 0.6]]) {
      const f = f0 * h;
      if (f > 18000) continue;
      addMono(out, osc(sec, f - 1.3, ad(0.004, tau * decay)), 0, amp * glass, -0.7);
      addMono(out, osc(sec, f + 1.1, ad(0.004, tau * decay)), 0, amp * glass, 0.7);
    }
  }
  // felt mallet strike
  if (strike > 0) {
    const s = noise(0.03, seed + 5, ad(0.0003, 0.0025), 'lp', 3500 + 2500 * bright, 0.7);
    addMono(out, s, 0, 0.25 * strike, 0);
  }
  return out;
}

/**
 * Filtered-noise sweep with a pitch bend and an air layer — the whoosh family.
 * The band centre rises f0 → f1 into the peak and falls to f2 after it; a narrow
 * "whistle" rides the same centre (the pitch you hear move), a low Doppler tone
 * bends down through the peak.
 */
function airSweep(seed, {
  peak, tailTau = 0.12, len, f0 = 400, f1 = 3000, f2 = 900, q = 1, rise = 2.2,
  air = 0.35, whistle = 0.1, low = 0, lowF = [140, 70], color = 'pink', wid = 0.85, drift = 0,
}) {
  const sec = len ?? peak + tailTau * 6;
  const a = (t) => (t < peak ? Math.pow(smooth(t / peak), rise) : Math.exp(-(t - peak) / tailTau));
  const fc = (t) => (t < peak ? f0 * Math.pow(f1 / f0, smooth(t / peak)) : f2 + (f1 - f2) * Math.exp(-(t - peak) / (tailTau * 1.3)));
  const body = (sd) => env(sweep(color === 'pink' ? pink(sec, sd) : white(sec, sd), 'bpn', fc, q), a);
  const L = body(seed);
  const R = body(seed + 1);
  const st = [L, R];
  // keep it mono-compatible: blend some of the mid back in
  for (let i = 0; i < L.length; i++) {
    const m = (L[i] + R[i]) * 0.5;
    L[i] = m + (L[i] - m) * wid;
    R[i] = m + (R[i] - m) * wid;
  }
  if (air > 0) {
    const ha = (sd) => env(sweep(white(sec, sd), 'hp', (t) => Math.min(12000, fc(t) * 2.4), 0.7), a);
    addStereo(st, [ha(seed + 2), ha(seed + 3)], 0, air);
  }
  if (whistle > 0) {
    const w = env(sweep(white(sec, seed + 4), 'bpn', fc, 9), a);
    addMono(st, w, 0, whistle * 1.4, 0);
  }
  if (low > 0) {
    // Doppler: the low tone rises a little into the pass, then bends down through it
    const lf = (t) =>
      t < peak ? lowF[0] * (0.88 + 0.12 * smooth(t / peak)) : lowF[1] + (lowF[0] - lowF[1]) * Math.exp(-(t - peak) / 0.09);
    addMono(st, osc(sec, lf, a), 0, low, 0);
    addMono(st, env(sweep(pink(sec, seed + 6), 'lp', 160, 0.8), a), 0, low * 1.6, 0);
  }
  // stereo motion: the sound travels across `drift` (−drift → +drift) through its pass
  return drift ? balance(st, [-drift, drift], peak + tailTau * 2) : st;
}

/** A sub thump with a pitch drop, a felt knock and a click. */
function thumpSig(seed, { f0 = 120, f1 = 46, tauF = 0.028, tau = 0.15, knock = 180, knockAmt = 0.35, click = 0.25, len = 0.6, drive = 1.6 } = {}) {
  const body = osc(len, (t) => f1 + (f0 - f1) * Math.exp(-t / tauF), ad(0.0015, tau));
  const out = sat(body, drive);
  const k = mode(len, knock, knockAmt, 0.03, 0.001);
  const c = noise(len, seed, ad(0.0002, 0.0012), 'lp', 3200, 0.7);
  for (let i = 0; i < out.length; i++) out[i] += k[i] + c[i] * click;
  return out;
}

/** The layered UI click: sharp transient + tonal body + a low knock + an air tail. */
function clickSnd(seed, { body = 1750, knock = 430, bright = 1, airAmt = 0.1, len = 0.14 } = {}) {
  const st = stereo(len);
  const tr = edge(seed, { f: 3800, tau: 0.0005 });
  const b1 = mode(len, body, 0.8, 0.009);
  const b2 = mode(len, body * 2.71, 0.28 * bright, 0.004);
  const kn = mode(len, knock, 0.45, 0.015, 0.0008);
  const m = mono(len);
  for (let i = 0; i < m.length; i++) m[i] = (tr[i] ?? 0) * 0.7 * bright + b1[i] + b2[i] + kn[i];
  addMono(st, m, 0, 1, 0);
  addStereo(st, airTail(seed + 11, { f: 8000, tau: 0.022, len }), 0, airAmt);
  return st;
}

/* ═════════════════════════ the families ═════════════════════════ */

const B4 = mtof(71);
const B5 = mtof(83);
const B6 = mtof(95);

export function library(T) {
  const F = T.FPS;
  const pk = (name) => T.SFX[name].pk / F;
  const L = new Map();
  const put = (name, k, st) => L.set(T.SFX[name].n > 1 ? `sfx/${name}-${k}.wav` : `sfx/${name}.wav`, st);
  const each = (name, make) => {
    for (let k = 0; k < T.SFX[name].n; k++) put(name, k, make(k));
  };

  /* ── transients ── */
  each('click', (k) => clickSnd(1100 + k * 13, { body: [1750, 1830, 1660, 1910][k], knock: [430, 460, 395, 480][k], bright: [1, 0.85, 1.1, 0.95][k] }));

  each('tick', (k) => {
    const len = 0.12;
    const st = stereo(len);
    const tr = edge(1200 + k, { f: 5000, tau: 0.0004 });
    const m = mono(len);
    const ratios = [2.76, 2.61, 2.89, 2.7][k];
    const p1 = mode(len, B6, 0.75, [0.014, 0.012, 0.016, 0.013][k]);
    const p2 = mode(len, B6 * ratios, 0.22, 0.004);
    const p0 = mode(len, B6 / 2, 0.18, 0.006);
    for (let i = 0; i < m.length; i++) m[i] = (tr[i] ?? 0) * [0.55, 0.45, 0.6, 0.5][k] + p1[i] + p2[i] + p0[i];
    addMono(st, m, 0, 1, 0);
    addStereo(st, airTail(1210 + k, { f: 9500, tau: 0.008, len }), 0, 0.08);
    return st;
  });

  each('tap', (k) => {
    const len = 0.12;
    const m = mono(len);
    const n0 = noise(len, 1300 + k, ad(0.0006, 0.004), 'lp', 1800 + k * 150, 0.7);
    const b = mode(len, [280, 300, 262, 315][k], 0.8, 0.024, 0.0012);
    const b2 = mode(len, [820, 870, 790, 900][k], 0.22, 0.008, 0.001);
    for (let i = 0; i < m.length; i++) m[i] = n0[i] * 0.5 + b[i] + b2[i];
    return dup(m);
  });

  each('key', (k) => {
    const len = 0.06;
    const m = mono(len);
    const tr = edge(1400 + k, { f: 3000, tau: 0.0008 });
    const pl = noise(len, 1410 + k, ad(0.0003, 0.005), 'bpn', [1600, 1750, 1500, 1850][k], 2);
    const md = mode(len, [2400, 2550, 2300, 2650][k], 0.2, 0.003);
    const bo = mode(len, [190, 205, 180, 215][k], 0.25, 0.008, 0.001);
    for (let i = 0; i < m.length; i++) m[i] = (tr[i] ?? 0) * 0.5 + pl[i] * 0.6 + md[i] + bo[i];
    return spread(m, 0.25, 1420 + k);
  });

  each('flick', (k) => {
    // split-flap flutter: six micro-clicks accelerating into the landing (crescendo)
    const len = 0.16;
    const st = stereo(len);
    const at = k ? [0, 0.02, 0.036, 0.05, 0.062, 0.072] : [0, 0.022, 0.039, 0.053, 0.065, 0.075];
    at.forEach((t, i) => {
      const m = mono(0.03);
      const tr = edge(1500 + k * 10 + i, { f: 4500, tau: 0.0004, len: 0.03 });
      const md = mode(0.03, 3100 + i * 120, 0.4, 0.003);
      for (let j = 0; j < m.length; j++) m[j] = (tr[j] ?? 0) * 0.6 + md[j];
      addMono(st, m, t, 0.45 + 0.11 * i, (i % 2 ? 0.25 : -0.25) * (k ? -1 : 1));
    });
    return st;
  });

  /* ── bodies ── */
  each('pop', (k) => {
    // bubbly: a pitch-drop body that settles on B4, a sub click, a little air, a micro second bubble
    const len = 0.32;
    const kk = [2.5, 2.25, 2.75, 2.4][k];
    const tp = [0.011, 0.013, 0.009, 0.012][k];
    const st = stereo(len);
    const body = osc(len, (t) => B4 * (1 + (kk - 1) * Math.exp(-t / tp)), ad(0.0008, 0.05));
    const h2 = osc(len, (t) => 2 * B4 * (1 + (kk - 1) * Math.exp(-t / tp)), ad(0.0008, 0.018));
    const sub = osc(len, (t) => 70 + 40 * Math.exp(-t / 0.01), ad(0.001, 0.02));
    const clk = noise(len, 1600 + k, ad(0.0001, 0.0006), 'lp', 6000, 0.7);
    const m = mono(len);
    for (let i = 0; i < m.length; i++) m[i] = body[i] + h2[i] * 0.14 + sub[i] * 0.5 + clk[i] * 0.3;
    addMono(st, m, 0, 1, 0);
    const bub = osc(0.08, (t) => B4 * 1.5 * (1 + 0.8 * Math.exp(-t / 0.006)), ad(0.0006, 0.014));
    addMono(st, bub, [0.024, 0.028, 0.021, 0.026][k], [0.22, 0.16, 0.26, 0.2][k], k % 2 ? 0.2 : -0.2);
    addStereo(st, airTail(1610 + k, { f: 5200, q: 1.2, tau: 0.006, len }), 0, 0.12);
    return st;
  });

  each('gulp', (k) => {
    // the orb swallows: a low pitch-drop gulp, then a small upward glug, sub weight, wet click
    const len = 0.45;
    const st = stereo(len);
    const f1 = [170, 185][k];
    const g1 = osc(len, (t) => f1 * (1 + 2.1 * Math.exp(-t / 0.028)), ad(0.001, 0.085));
    const g2 = osc(0.12, (t) => 165 + 120 * smooth(t / 0.045), (t) => Math.sin(Math.PI * clamp(t / 0.07, 0, 1)) ** 2);
    const sub = osc(len, (t) => 52 + 30 * Math.exp(-t / 0.02), ad(0.003, 0.07));
    const clk = noise(len, 1700 + k, ad(0.0002, 0.002), 'bpn', 2600, 1.4);
    const m = mono(len);
    for (let i = 0; i < m.length; i++) m[i] = sat([g1[i]], 1.3)[0] + sub[i] * 0.6 + clk[i] * 0.35;
    addMono(st, m, 0, 1, 0);
    addMono(st, g2, 0.058, 0.38, 0);
    addStereo(st, airTail(1710 + k, { f: 4200, q: 1.5, tau: 0.01, len }), 0.004, 0.1);
    return st;
  });

  each('flip', (k) => {
    // "fwip" (a quick rising air) into a clack ON the pk frame, then two dying rattles
    const clackAt = pk('flip');
    const len = clackAt + 0.35;
    const st = stereo(len);
    const fw = env(sweep(white(clackAt, 1800 + k), 'bpn', (t) => 1200 * Math.pow(4, t / clackAt), 1.4), (t) => Math.pow(t / clackAt, 2.2));
    addStereo(st, spread(fw, 0.5, 1801 + k), 0, 0.45);
    const clack = (sd, g, tauScale = 1) => {
      const c = mono(0.2);
      const nb = noise(0.2, sd, ad(0.0002, 0.003 * tauScale), 'bpn', [2400, 2200, 2600][k], 1);
      const a = mode(0.2, [700, 660, 740][k], 0.5, 0.012 * tauScale);
      const b = mode(0.2, [1530, 1480, 1600][k], 0.3, 0.006 * tauScale);
      const lo = mode(0.2, [170, 160, 185][k], 0.4, 0.02 * tauScale, 0.001);
      for (let i = 0; i < c.length; i++) c[i] = nb[i] * 0.8 + a[i] + b[i] + lo[i];
      return c.map((v) => v * g);
    };
    addMono(st, clack(1810 + k, 1), clackAt, 1, 0);
    addMono(st, clack(1820 + k, 0.24, 0.7), clackAt + 0.042, 1, 0.1);
    addMono(st, clack(1830 + k, 0.1, 0.6), clackAt + 0.078, 1, -0.1);
    return st;
  });

  /* ── air ── */
  each('swish', (k) =>
    airSweep(1900 + k * 7, {
      peak: pk('swish'), tailTau: 0.06, f0: [900, 800, 1000, 850][k], f1: [3600, 3300, 3900, 3000][k], f2: [1800, 1600, 2000, 1500][k],
      q: [1.2, 1.0, 1.4, 1.1][k], rise: 2, air: 0.35, whistle: 0.08, drift: [0.25, -0.25, 0.2, -0.2][k],
    }),
  );
  each('whoosh-soft', (k) =>
    airSweep(2000 + k * 7, { peak: pk('whoosh-soft'), tailTau: 0.09, f0: [700, 600][k], f1: [2600, 2300][k], f2: [1300, 1100][k], q: 1.3, rise: 2, air: 0.25, whistle: 0.06, drift: [0.3, -0.3][k] }),
  );
  each('whoosh', (k) =>
    airSweep(2100 + k * 7, {
      peak: pk('whoosh'), tailTau: 0.11, f0: [260, 300, 240][k], f1: [4200, 3600, 4600][k], f2: [700, 600, 800][k], q: 0.9, rise: 2.4,
      air: 0.4, whistle: 0.12, low: 0.32, lowF: [[130, 62], [120, 58], [140, 66]][k], drift: [0.35, -0.35, 0.3][k],
    }),
  );
  {
    // reverse whoosh: a forward whoosh + its own reverb, reversed: it swells and stops dead on the peak
    const fwd = airSweep(2200, { peak: 0.02, tailTau: 0.16, len: 0.9, f0: 5000, f1: 5200, f2: 600, q: 0.9, rise: 1, air: 0.4, whistle: 0.1, low: 0.25, lowF: [70, 120] });
    const wet = fdn(fwd, { rt60: 1.2, rt60Hi: 0.5, pre: 0.005, tail: 0.6 });
    const mix = stereo(1.5);
    addStereo(mix, fwd, 0, 1);
    addStereo(mix, wet, 0, 0.9);
    const rv = reverse(mix);
    const n = rv[0].length;
    const peakAt = pk('whoosh-rev');
    // keep the last `peakAt` seconds before the end, then a 25 ms clipped tail
    const s0 = Math.max(0, n - Math.round(peakAt * SR) - Math.round(0.03 * SR));
    const out = [rv[0].slice(s0), rv[1].slice(s0)];
    const m = out[0].length;
    for (let i = 0; i < m; i++) {
      const t = i / SR;
      const g = t < peakAt ? Math.pow(smooth(t / peakAt), 1.5) : Math.exp(-(t - peakAt) / 0.012);
      out[0][i] *= g;
      out[1][i] *= g;
    }
    put('whoosh-rev', 0, out);
  }
  {
    // camera pull-back: long, soft, low air that sinks as the room opens
    const len = 1.5;
    const a = (t) => smooth(t / 0.3) * Math.exp(-Math.max(0, t - 0.45) / 0.38);
    const fc = (t) => 900 * Math.pow(0.32, smooth(t / 1.2));
    const st = [env(sweep(pink(len, 2300), 'bpn', fc, 0.7), a), env(sweep(pink(len, 2301), 'bpn', fc, 0.7), a)];
    addMono(st, env(sweep(pink(len, 2302), 'lp', 110, 0.8), a), 0, 1.2, 0);
    addStereo(st, [env(sweep(white(len, 2303), 'hp', 6500, 0.7), a), env(sweep(white(len, 2304), 'hp', 6500, 0.7), a)], 0, 0.05);
    put('air', 0, st);
  }
  each('swell', (k) => {
    // a short inhale: rising band + a faint reversed shimmer, cut on the peak
    const peakAt = pk('swell');
    const len = peakAt + 0.03;
    const a = (t) => (t < peakAt ? Math.pow(t / peakAt, 2.6) : Math.exp(-(t - peakAt) / 0.008));
    const fc = (t) => [600, 700][k] * Math.pow(4.5, Math.min(1, t / peakAt));
    const st = [env(sweep(pink(len, 2400 + k), 'bpn', fc, 1.1), a), env(sweep(pink(len, 2402 + k), 'bpn', fc, 1.1), a)];
    addMono(st, env(osc(len, (t) => mtof(83) * (0.98 + 0.02 * t / peakAt)), a), 0, 0.05, 0);
    return st;
  });
  each('sheen', (k) => {
    // a light sliding across glass: a high, narrow band that rises then settles + two glass grains
    const len = 0.5;
    const a = (t) => smooth(t / 0.06) * Math.exp(-Math.max(0, t - 0.08) / 0.12);
    const fc = (t) => [5200, 6000][k] * (1 + 0.6 * Math.sin(Math.PI * Math.min(1, t / 0.32)));
    const st = [env(sweep(white(len, 2500 + k), 'bpn', fc, 2.6), a), env(sweep(white(len, 2502 + k), 'bpn', fc, 2.6), a)];
    for (const [t, m, g] of [[0.07, [100, 104][k], 0.12], [0.15, [107, 112][k], 0.08]]) {
      addMono(st, osc(0.3, mtof(m), ad(0.002, 0.07)), t, g, 0);
    }
    return st;
  });
  {
    // the AI-disclosure underline: a thin, white-hot line drawing across (exactly as long as the draw)
    const L0 = (T.CALL_LOCAL.disclose[1] - T.CALL_LOCAL.disclose[0]) / F;
    const len = L0 + 0.12;
    const a = (t) => smooth(t / 0.05) * (t < L0 ? 0.75 + 0.25 * (t / L0) : Math.exp(-(t - L0) / 0.03));
    const fc = (t) => 5200 * Math.pow(1.7, Math.min(1, t / L0));
    const st = [env(sweep(white(len, 2600), 'bpn', fc, 3.2), a), env(sweep(white(len, 2601), 'bpn', fc, 3.2), a)];
    addMono(st, env(osc(len, (t) => mtof(95) * Math.pow(semis(5), smooth(Math.min(1, t / L0)))), a), 0, 0.05, 0);
    put('draw', 0, st);
  }
  {
    // short riser: noise band + a tremolo glide B4 → B5 accelerating, a reverse cymbal; cut on the peak
    const p = pk('riser-short');
    put('riser-short', 0, riser(2700, p, { m0: 71, m1: 83, f0: 500, f1: 6500, sub: 0 }));
  }
  {
    // the big riser into the logo: B3 → B5 glide with accelerating tremolo, rising noise, a sub swell
    const p = pk('riser');
    put('riser', 0, riser(2800, p, { m0: 59, m1: 83, f0: 260, f1: 7000, sub: 0.5 }));
  }

  /* ── sparkle ── */
  const PENTA = [88, 90, 92, 95, 97, 100, 102, 104, 107]; // E major pentatonic, E6 → B7
  each('shimmer', (k) => {
    const r = rng(2900 + k);
    const len = 1.2;
    const st = stereo(len);
    const n = 11;
    for (let i = 0; i < n; i++) {
      const t = 0.26 * Math.pow(i / (n - 1), 1.3) + r() * 0.012;
      const m = PENTA[Math.min(PENTA.length - 1, Math.floor((i / n) * PENTA.length + r() * 2))];
      const g = osc(0.6, mtof(m), ad(0.0012, 0.12 + r() * 0.2));
      const g2 = osc(0.6, mtof(m) * 2.76, ad(0.0012, 0.05));
      for (let j = 0; j < g.length; j++) g[j] += g2[j] * 0.2;
      addMono(st, g, t, 0.32 + r() * 0.2, (r() * 2 - 1) * 0.75);
    }
    addStereo(st, [noise(len, 2910 + k, ad(0.02, 0.18), 'hp', 7500, 0.7), noise(len, 2920 + k, ad(0.02, 0.18), 'hp', 7500, 0.7)], 0, 0.1);
    return st;
  });
  each('glint', (k) => {
    const len = 0.45;
    const st = stereo(len);
    const notes = [[112, 116], [114, 119], [109, 116]][k]; // E8 G#8 · F#8 B8 · C#8 G#8: above the speech band
    notes.forEach((m, i) => addMono(st, osc(0.4, mtof(m), ad(0.001, 0.09 - i * 0.02)), i * 0.018, 0.5 - i * 0.12, i ? 0.3 : -0.3));
    addStereo(st, [noise(len, 3000 + k, ad(0.002, 0.025), 'hp', 10000, 0.7), noise(len, 3010 + k, ad(0.002, 0.025), 'hp', 10000, 0.7)], 0, 0.22);
    return st;
  });
  each('ping', (k) => {
    const len = 0.9;
    const st = stereo(len);
    const f = (t) => B6 * Math.pow(semis(0.25), smooth(t / 0.06));
    addMono(st, osc(len, f, ad(0.0015, [0.28, 0.24][k])), 0, 0.8, -0.15);
    addMono(st, osc(len, (t) => f(t) * 1.003, ad(0.0015, [0.26, 0.22][k])), 0, 0.5, 0.25);
    addMono(st, osc(len, (t) => f(t) * 2.76, ad(0.001, 0.05)), 0, 0.12, 0);
    addMono(st, edge(3100 + k, { f: 6000, tau: 0.0004 }), 0, 0.2, 0);
    return st;
  });

  /* ── weight ── */
  each('thump', (k) => dup(thumpSig(3200 + k, { f0: [120, 110, 130][k], f1: [46, 43, 49][k], knock: [180, 165, 200][k], tau: [0.15, 0.17, 0.14][k] })));
  each('land', (k) => {
    const st = dup(thumpSig(3300 + k, { f0: [140, 125][k], f1: [50, 47][k], knock: [210, 190][k], knockAmt: 0.45, tau: 0.13, click: 0.4 }));
    addStereo(st, clickSnd(3310 + k, { body: [1500, 1420][k], knock: 380, airAmt: 0.06 }), 0, 0.42);
    const r = rng(3320 + k);
    for (let i = 0; i < 3; i++) addStereo(st, clickSnd(3330 + i + k * 5, { body: 2400 + r() * 1200, knock: 600, airAmt: 0, len: 0.05 }), 0.018 + i * 0.017 + r() * 0.008, 0.07 - i * 0.015);
    return st;
  });
  {
    // a soft heartbeat (lub-dub) for the frozen world's breath
    const len = 0.7;
    const m = mono(len);
    const lub = osc(len, (t) => 50 + 22 * Math.exp(-t / 0.02), ad(0.012, 0.09));
    const dub = osc(len, (t) => 47 + 16 * Math.exp(-t / 0.02), ad(0.01, 0.075));
    const kn = mode(len, 140, 0.18, 0.03, 0.004);
    for (let i = 0; i < m.length; i++) m[i] = lub[i] + kn[i];
    const off = Math.round(0.17 * SR);
    for (let i = 0; i + off < m.length; i++) m[i + off] += dub[i] * 0.6;
    put('breath', 0, dup(filt(sat(m, 1.4), ['lp', 400, 0.7])));
  }
  {
    // her eyes out of the black: a deep sub swell with harmonics for small speakers, and a dark "whoom"
    const len = 2.2;
    const s = osc(len, (t) => 33 + 15 * Math.exp(-t / 0.25), ad(0.04, 1.0));
    const st = dup(sat(s, 2.2));
    addMono(st, env(sweep(pink(len, 3400), 'lp', (t) => 320 - 180 * smooth(t / 1.2), 0.9), ad(0.06, 0.5)), 0, 0.9, 0);
    put('sub', 0, st);
  }
  {
    // the handset buzz: a 165 Hz motor (odd harmonics) rattling on a surface, 12 frames long
    const on = T.TWIST_LOCAL.buzz[1] - T.TWIST_LOCAL.buzz[0];
    const len = on / F + 0.1;
    const a = (t) => smooth(t / 0.015) * (t < on / F ? 1 : Math.exp(-(t - on / F) / 0.02));
    const m = mono(len);
    const r = rng(3500);
    let ph = 0;
    for (let i = 0; i < m.length; i++) {
      const t = i / SR;
      ph += (TAU * (165 + 4 * Math.sin(TAU * 7 * t))) / SR;
      const sq = Math.sin(ph) + Math.sin(3 * ph) / 3 + Math.sin(5 * ph) / 5 + Math.sin(7 * ph) / 7;
      const rattle = (Math.sin(ph) > 0.92 ? 1 : 0) * (r() * 2 - 1);
      m[i] = (sq * 0.6 + rattle * 0.5) * a(t);
    }
    put('buzz', 0, spread(filt(m, ['lp', 2400, 0.7], ['hp', 90, 0.7], ['peak', 1100, 1.2, 4]), 0.2, 3501));
  }

  /* ── bells: the four light chimes ── */
  const LIGHTS = ['rush', 'closing', 'sunday', 'night'];
  for (const light of LIGHTS) {
    const f0 = mtof(T.LIGHT_NOTES[light]);
    each(`chime-${light}`, (k) => bellVoice(2.6, f0, { seed: 3600 + LIGHTS.indexOf(light) * 10 + k, bright: k ? 0.9 : 1, strike: k ? 0.9 : 1.1 }));
    put(`chime-${light}-soft`, 0, bellVoice(2.2, f0, { seed: 3650 + LIGHTS.indexOf(light), bright: 0.55, strike: 0.4, att: 0.006, decay: 0.85, glass: 0.7 }));
  }
  const chordOf = (seed, { strum = 0.006, decay = 1.6, bright = 1, order = LIGHTS, len = 4.5 } = {}) => {
    const st = stereo(len);
    const pans = { rush: -0.4, closing: 0.4, sunday: -0.15, night: 0.15 };
    order.forEach((light, i) => {
      const v = bellVoice(len, mtof(T.LIGHT_NOTES[light]), { seed: seed + i, decay, bright, strike: 0.9 });
      addStereo(st, balanceSt(v, pans[light]), i * strum, 0.6);
    });
    return st;
  };
  {
    // THE CHORD — the four lights ring together inside the logo impact (+ a low E hum)
    const st = chordOf(3700, { strum: 0.005, decay: 1.5, bright: 0.6 });
    addStereo(st, bellVoice(4.5, mtof(64), { seed: 3710, bright: 0.4, decay: 1.4, strike: 0.3, glass: 0 }), 0, 0.35);
    put('chord', 0, st);
    // its reverse swell: the chord + a big room, reversed — the four lights fuse into the impact
    const big = stereo(6);
    addStereo(big, st, 0, 1);
    addStereo(big, fdn(st, { rt60: 3, rt60Hi: 1.6, pre: 0.02, tail: 1 }), 0, 1.2);
    const rv = reverse(trimTail(big));
    const p = pk('chord-rev');
    const n = rv[0].length;
    const s0 = Math.max(0, n - Math.round(p * SR) - 1);
    const out = [rv[0].slice(s0), rv[1].slice(s0)];
    for (let i = 0; i < out[0].length; i++) {
      const g = Math.pow(smooth(i / out[0].length), 1.4);
      out[0][i] *= g;
      out[1][i] *= g;
    }
    fadeOut(out, 0.004);
    put('chord-rev', 0, out);
  }
  // the four lights strummed fast (the wall locks in its four lights)
  put('strum', 0, chordOf(3750, { strum: 0.028, decay: 0.55, bright: 0.85, len: 2 }));

  {
    // the booking lands: a warm bell on E5 with its major third, a low E hum and a sparkle
    const st = stereo(3.2);
    addStereo(st, bellVoice(3.2, mtof(76), { seed: 3800, bright: 0.9, decay: 1.2 }), 0, 0.8);
    addStereo(st, balanceSt(bellVoice(3.2, mtof(80), { seed: 3801, bright: 0.7, decay: 1.0, strike: 0.5 }), 0.3), 0.012, 0.5);
    addStereo(st, bellVoice(3.2, mtof(64), { seed: 3802, bright: 0.3, decay: 0.9, strike: 0.2, glass: 0 }), 0, 0.3);
    put('ding', 0, st);
  }
  each('ding-s', (k) => bellVoice(1.6, B5, { seed: 3850 + k, bright: 1.05, decay: 0.45, strike: 1.1, hum: 0.5 }));
  {
    // success: the closing light's G#5, then B5 (and a breath of E6 on top)
    const st = stereo(2.2);
    addStereo(st, balanceSt(bellVoice(2, mtof(80), { seed: 3900, decay: 0.55 }), -0.2), 0, 0.7);
    addStereo(st, balanceSt(bellVoice(2, mtof(83), { seed: 3901, decay: 0.75 }), 0.2), 0.085, 0.75);
    addStereo(st, bellVoice(2, mtof(88), { seed: 3902, decay: 0.6, strike: 0.3, bright: 0.6 }), 0.17, 0.25);
    put('confirm', 0, st);
  }

  /* ── ember (the booked moment) ── */
  {
    const len = 2.4;
    const st = stereo(len);
    // a soft bloom (the attack is 35 ms so the spoken word in front of it stays clear)
    const bloom = (sd) => env(sweep(pink(len, sd), 'bpn', (t) => 260 + 1300 * Math.sin(Math.PI * Math.min(1, t / 0.5)) * Math.exp(-t / 0.6), 0.9), ad(0.035, 0.22));
    addStereo(st, [bloom(4000), bloom(4001)], 0, 0.45);
    // warm bell: E4 + B4 (+ a little G#5)
    addStereo(st, bellVoice(len, mtof(64), { seed: 4002, bright: 0.45, decay: 0.75, strike: 0.3, att: 0.012 }), 0, 0.55);
    addStereo(st, balanceSt(bellVoice(len, mtof(71), { seed: 4003, bright: 0.5, decay: 0.7, strike: 0.2, att: 0.012 }), 0.25), 0.01, 0.35);
    addStereo(st, balanceSt(bellVoice(len, mtof(80), { seed: 4004, bright: 0.6, decay: 0.5, strike: 0.2, att: 0.01 }), -0.2), 0.02, 0.14);
    // sparks crackle off its end (to the right)
    const r = rng(4005);
    for (let i = 0; i < 28; i++) {
      const t = 0.1 + Math.pow(r(), 1.7) * 0.95;
      const c = noise(0.01, 4100 + i, ad(0.00008, 0.0006 + r() * 0.0008), 'hp', 2000 + r() * 4000, 0.7);
      addMono(st, c, t, (0.18 + r() * 0.3) * Math.exp(-t / 0.5), 0.1 + r() * 0.7);
      if (i % 4 === 0) addMono(st, osc(0.2, mtof(PENTA[Math.floor(r() * PENTA.length)]), ad(0.001, 0.03)), t, 0.06, 0.2 + r() * 0.6);
    }
    put('ember', 0, st);
  }

  /* ── the miss: the light drains out of the orb ── */
  {
    const len = 1.6;
    const st = stereo(len);
    const f0 = mtof(T.LIGHT_NOTES.sunday);
    const bend = (t) => Math.pow(semis(-2), smooth((t - 0.05) / 0.4));
    const sideV = (side, sd) => {
      const P = [[1, 1, 0.9], [2, 0.35, 0.5], [2.76, 0.22, 0.3], [4.07, 0.1, 0.18]];
      const m = mono(len);
      for (const [ratio, amp, tau] of P) {
        const s = osc(len, (t) => f0 * ratio * bend(t) + side * 0.4 * ratio, ad(0.002, tau));
        for (let i = 0; i < m.length; i++) m[i] += s[i] * amp;
      }
      return sweep(m, 'lp', (t) => 7000 * Math.pow(0.12, smooth(t / 0.55)), 0.7);
    };
    addMono(st, sideV(-1, 4200), 0, 0.55, -0.5);
    addMono(st, sideV(1, 4201), 0, 0.55, 0.5);
    addStereo(st, [noise(len, 4202, ad(0.01, 0.25), 'bpn', (t) => 3000 * Math.pow(0.1, smooth(t / 0.5)), 0.9), noise(len, 4203, ad(0.01, 0.25), 'bpn', (t) => 3100 * Math.pow(0.1, smooth(t / 0.5)), 0.9)], 0, 0.22);
    addMono(st, osc(len, (t) => 110 * Math.pow(0.5, smooth(t / 0.45)), ad(0.01, 0.25)), 0, 0.3, 0);
    put('drain', 0, st);
  }

  /* ── signatures ── */
  {
    // time freezes mid-ring: a crystal "tsing" and the ring's two notes frozen into a hanging, beating tone
    const len = 2.4;
    const st = stereo(len);
    for (const [m, g, tau, p] of [[88, 0.5, 0.3, -0.3], [95, 0.35, 0.22, 0.3], [100, 0.25, 0.16, -0.1], [104, 0.15, 0.12, 0.2]]) {
      addMono(st, osc(0.8, mtof(m), ad(0.0006, tau)), 0, g, p);
    }
    addStereo(st, [noise(0.1, 4300, ad(0.0002, 0.005), 'hp', 5000, 0.7), noise(0.1, 4301, ad(0.0002, 0.005), 'hp', 5000, 0.7)], 0, 0.35);
    const hold = (t) => smooth(t / 0.05) * Math.exp(-t / 0.95) * (0.85 + 0.15 * Math.sin(TAU * 2.2 * t));
    addMono(st, osc(len, mtof(88) - 0.7, hold), 0, 0.22, -0.6);
    addMono(st, osc(len, mtof(88) + 0.6, hold), 0, 0.22, 0.6);
    addMono(st, osc(len, mtof(90) + 0.4, hold), 0, 0.12, -0.2);
    addMono(st, osc(len, mtof(90) - 0.5, hold), 0, 0.12, 0.2);
    put('freeze', 0, st);
  }
  {
    // the phone ring: a warm electronic trill (E6 ↔ F#6 at 25 Hz) in two pulses that follow the
    // picture's two ring pulses; the attack starts SFX.ring-hook.pk frames before the beat
    const ring = (pulse2) => {
      const lead = T.SFX['ring-hook'].pk / F;
      const p1 = Math.min(0.22, pulse2 - 0.035);
      const pulses = [[0, p1], [pulse2, pulse2 + 0.2]];
      const len = lead + pulse2 + 0.3;
      const m = mono(len);
      let ph = 0;
      for (let i = 0; i < m.length; i++) {
        const t = i / SR - lead;
        const trill = Math.sin(TAU * 25 * (t + lead)) > 0;
        const f = trill ? mtof(88) : mtof(90);
        ph += (TAU * f) / SR;
        let a = 0;
        for (const [s, e] of pulses) {
          const s0 = s - (s === 0 ? lead : 0.008);
          if (t >= s0 && t < e + 0.012) a = Math.max(a, smooth((t - s0) / (s === 0 ? lead : 0.008)) * (t > e ? 1 - (t - e) / 0.012 : 1) * (s === 0 ? 1 : 0.88));
        }
        m[i] = (Math.sin(ph) * 0.6 + Math.sin(2 * ph) * 0.16 + Math.sin(3 * ph) * 0.05 + Math.sin(ph / 2) * 0.22) * a;
      }
      const shaped = filt(m, ['hp', 280, 0.7], ['peak', 2200, 1.1, 3], ['lp', 6000, 0.6]);
      return spread(shaped, 0.25, 4400);
    };
    put('ring-hook', 0, ring((T.HOOK_LOCAL.ringB - T.HOOK.ring) / F));
    put('ring-twist', 0, ring(9 / F));
  }
  {
    // the shatter: a crack, a thump, a spray of glass pings and debris flying wide
    const len = 1.4;
    const st = stereo(len);
    const r = rng(4500);
    addStereo(st, [noise(0.15, 4501, ad(0.0002, 0.006), 'hp', 1500, 0.7), noise(0.15, 4502, ad(0.0002, 0.006), 'hp', 1500, 0.7)], 0, 0.9);
    addMono(st, sat(osc(0.5, (t) => 52 + 60 * Math.exp(-t / 0.02), ad(0.001, 0.09)), 1.6), 0, 0.9, 0);
    for (let i = 0; i < 46; i++) {
      const t = Math.pow(r(), 1.9) * 0.55;
      const f = 2300 + r() * 6800;
      const g = osc(0.3, f, ad(0.0003, 0.015 + r() * 0.06));
      const g2 = osc(0.3, f * (1.5 + r() * 1.3), ad(0.0003, 0.01));
      for (let j = 0; j < g.length; j++) g[j] += g2[j] * 0.4;
      addMono(st, g, t, (0.12 + r() * 0.2) * Math.exp(-t / 0.35), (r() * 2 - 1) * 0.9);
    }
    for (let i = 0; i < 18; i++) {
      const t = 0.01 + r() * 0.35;
      addMono(st, noise(0.02, 4600 + i, ad(0.0002, 0.002), 'bpn', 1500 + r() * 4000, 1.5), t, 0.25 * Math.exp(-t / 0.2), (r() * 2 - 1) * 0.9);
    }
    addStereo(st, airSweep(4700, { peak: 0.03, tailTau: 0.12, f0: 3000, f1: 4000, f2: 900, q: 0.9, air: 0.3, whistle: 0 }), 0, 0.35);
    put('shatter', 0, st);
  }
  {
    // the door slam: a low thud, the wooden body ringing, the latch, a puff of dust
    const len = 1.2;
    const st = stereo(len);
    const thud = sat(osc(len, (t) => 45 + 40 * Math.exp(-t / 0.03), ad(0.002, 0.18)), 1.8);
    addMono(st, thud, 0, 1, 0);
    const exc = noise(0.05, 4800, ad(0.0003, 0.006), 'lp', 1800, 0.7);
    const body = mono(len);
    for (const [f, a, tau] of [[112, 0.6, 0.12], [178, 0.45, 0.09], [263, 0.35, 0.07], [410, 0.22, 0.05], [655, 0.12, 0.03]]) {
      const md = mode(len, f, a, tau, 0.002);
      for (let i = 0; i < body.length; i++) body[i] += md[i];
    }
    for (let i = 0; i < exc.length; i++) body[i] += exc[i] * 0.8;
    addMono(st, body, 0, 0.8, 0);
    addStereo(st, clickSnd(4801, { body: 3400, knock: 1200, airAmt: 0.05, len: 0.08 }), 0.045, 0.35);
    addStereo(st, clickSnd(4802, { body: 2900, knock: 900, airAmt: 0.03, len: 0.06 }), 0.072, 0.2);
    addStereo(st, [noise(len, 4803, ad(0.02, 0.25), 'lp', 900, 0.7), noise(len, 4804, ad(0.02, 0.25), 'lp', 950, 0.7)], 0.01, 0.35);
    put('door', 0, st);
  }
  {
    // the door creaks a little wider: stick-slip friction through a wooden body
    const len = 0.45;
    const m = mono(len);
    const r = rng(4900);
    let t = 0.02;
    let rate = 42;
    while (t < 0.34) {
      const i0 = Math.round(t * SR);
      const g = Math.sin((Math.PI * t) / 0.36);
      for (const [f, tau, a] of [[720, 0.006, 0.6], [1130, 0.004, 0.4], [1920, 0.003, 0.25]]) {
        for (let j = 0; j < 0.02 * SR && i0 + j < m.length; j++) m[i0 + j] += Math.sin((TAU * f * j) / SR) * Math.exp(-j / (tau * SR)) * a * g;
      }
      rate = clamp(rate + (r() - 0.5) * 14, 30, 72);
      t += 1 / rate;
    }
    put('creak', 0, spread(filt(m, ['hp', 300, 0.7]), 0.2, 4901));
  }
  {
    // the phone powers on: a line of light expanding, a bloom rising into the screen, an electric crackle
    const len = 1.1;
    const st = stereo(len);
    addStereo(st, [noise(len, 5000, ad(0.004, 0.07), 'bpn', (t) => 1500 * Math.pow(6, smooth(t / 0.12)), 1.6), noise(len, 5001, ad(0.004, 0.07), 'bpn', (t) => 1550 * Math.pow(6, smooth(t / 0.12)), 1.6)], 0, 0.5);
    const sawL = new Saw(0.1);
    const sawR = new Saw(0.6);
    const bl = mono(len);
    const br = mono(len);
    for (let i = 0; i < bl.length; i++) {
      const t = i / SR;
      const f = mtof(40) * Math.pow(4, smooth(t / 0.45));
      const a = Math.sin(Math.PI * clamp(t / 0.6, 0, 1)) ** 1.5;
      bl[i] = sawL.run(f * 0.998) * a;
      br[i] = sawR.run(f * 1.002) * a;
    }
    const cut = (t) => 300 * Math.pow(10, smooth(t / 0.4));
    addStereo(st, [sweep(bl, 'lp', cut, 0.9), sweep(br, 'lp', cut, 0.9)], 0, 0.3);
    const r = rng(5002);
    for (let i = 0; i < 6; i++) addMono(st, noise(0.01, 5010 + i, ad(0.0001, 0.0005), 'hp', 3000, 0.7), r() * 0.05, 0.3, (r() * 2 - 1) * 0.5);
    addMono(st, osc(len, mtof(28), ad(0.03, 0.3)), 0, 0.3, 0);
    put('power-on', 0, st);
  }
  {
    // the pickup: the handset clunk, the line opening, the two-note "connected" (B5 → E6)
    const len = 1.0;
    const st = stereo(len);
    addStereo(st, clickSnd(5100, { body: 1500, knock: 360 }), 0, 0.8);
    addMono(st, mode(len, 118, 0.6, 0.04, 0.002), 0, 1, 0);
    const blip = (m, tau) => {
      const s = osc(0.5, (t) => mtof(m) * (1 + 0.002 * Math.sin(TAU * 30 * t)), ad(0.003, tau));
      const h = osc(0.5, mtof(m) * 2, ad(0.003, tau * 0.4));
      for (let i = 0; i < s.length; i++) s[i] += h[i] * 0.15;
      return s;
    };
    addMono(st, blip(83, 0.05), 0.03, 0.32, -0.15);
    addMono(st, blip(88, 0.12), 0.1, 0.36, 0.15);
    addStereo(st, spread(filt(white(0.3, 5101), ['hp', 300, 0.7], ['lp', 3400, 0.7]).map((v, i) => v * ad(0.01, 0.08)(i / SR)), 0.5, 5102), 0, 0.12);
    put('pickup', 0, st);
  }
  {
    // the caller's line connects: a small click, a crackle of phone-band noise, a low E5 blip
    const len = 0.5;
    const st = stereo(len);
    addStereo(st, clickSnd(5200, { body: 1350, knock: 340, airAmt: 0.04 }), 0, 0.7);
    const r = rng(5201);
    const cr = mono(0.1);
    for (let i = 0; i < 6; i++) {
      const t0 = r() * 0.07;
      const b = noise(0.02, 5210 + i, ad(0.0002, 0.003), null);
      for (let j = 0; j < b.length; j++) {
        const k = Math.round(t0 * SR) + j;
        if (k < cr.length) cr[k] += b[j] * (0.5 + r() * 0.5);
      }
    }
    addStereo(st, spread(filt(cr, ['hp', 300, 0.7], ['lp', 3400, 0.7]), 0.4, 5202), 0, 0.5);
    addMono(st, osc(0.3, mtof(76), ad(0.004, 0.06)), 0.02, 0.18, 0);
    put('line', 0, st);
  }
  {
    // the shockwave ring sweeps past the frame: a widening, falling whoomph (peaks pk frames in)
    const p = pk('shock');
    const len = 1.3;
    const a = (t) => (t < p ? Math.pow(t / p, 1.6) : Math.exp(-(t - p) / 0.22));
    const fc = (t) => 1300 * Math.pow(0.12, smooth(t / 0.6));
    const st = [env(sweep(pink(len, 5300), 'lp', fc, 0.9), a), env(sweep(pink(len, 5301), 'lp', fc, 0.9), a)];
    addMono(st, osc(len, (t) => 220 * Math.pow(0.4, smooth(t / 0.5)), a), 0, 0.25, 0);
    // the ring widens as it travels out
    const [Ls, Rs] = st;
    for (let i = 0; i < Ls.length; i++) {
      const w = 0.3 + 0.9 * smooth(i / SR / 0.5);
      const m = (Ls[i] + Rs[i]) * 0.5;
      const s = (Ls[i] - Rs[i]) * 0.5 * w;
      Ls[i] = m + s;
      Rs[i] = m - s;
    }
    put('shock', 0, st);
  }
  {
    // THE LOGO IMPACT — the loudest moment of the film. A sub drop, an E3→E2 body punch (it
    // carries the hit on phone speakers), a cracking transient, a 1.6 kHz snap and a noise burst
    // whose mids clear in ~0.15 s (Ava says the name 8 frames later), glued by saturating the
    // layers together (a dense hit: ~5 LU more loudness at the same −12 dBFS peak), then a long,
    // wide, dark room
    const len = 4.8;
    const st = stereo(len);
    const drop = (t) => 28 + 64 * Math.exp(-t / 0.09);
    addMono(st, sat(osc(len, drop, ad(0.001, 0.9)), 2), 0, 0.8, 0);
    addMono(st, osc(len, (t) => 2 * drop(t), ad(0.001, 0.35)), 0, 0.18, 0);
    addMono(st, sat(osc(len, (t) => 82.41 + 82.41 * Math.exp(-t / 0.045), ad(0.0015, 0.2)), 2.4), 0, 0.7, 0);
    addStereo(st, [noise(0.2, 5400, ad(0.0002, 0.004), 'hp', 2200, 0.7), noise(0.2, 5401, ad(0.0002, 0.004), 'hp', 2200, 0.7)], 0, 0.85);
    addMono(st, noise(0.2, 5402, ad(0.0003, 0.012), 'bpn', 900, 1), 0, 0.6, 0);
    addStereo(st, [noise(0.4, 5407, ad(0.0005, 0.03), 'bpn', 1600, 0.9), noise(0.4, 5408, ad(0.0005, 0.03), 'bpn', 1700, 0.9)], 0, 0.45);
    const burst = (sd) => env(sweep(pink(len, sd), 'lp', (t) => 250 + 6500 * Math.exp(-t / 0.06), 0.8), ad(0.0008, 0.1));
    addStereo(st, [burst(5403), burst(5404)], 0, 1);
    const tail = (sd) => env(sweep(white(len, sd), 'hp', 6500, 0.7), (t) => smooth(t / 0.08) * Math.exp(-t / 1.4));
    addStereo(st, [tail(5405), tail(5406)], 0, 0.05);
    {
      // the glue: one saturation stage over the summed layers (drive 3 at full scale)
      let p = 1e-9;
      for (const c of st) for (let i = 0; i < c.length; i++) p = Math.max(p, Math.abs(c[i]));
      const k = 3 / p;
      for (const c of st) for (let i = 0; i < c.length; i++) c[i] = tanh(c[i] * k) / tanh(3);
    }
    // its own big room, dark (the brand name is spoken 8 frames later: the mids must clear)
    const room = fdn(st, { rt60: 3.4, rt60Hi: 0.5, pre: 0.03, size: 1.4, lp: 1800, tail: 0 });
    addStereo(st, room, 0, 0.25);
    put('impact', 0, width(st, 1.2));
  }
  {
    // the white act's hit: a kick body, a bright crack and a white flash of air (+ a glassy ting)
    const len = 1.6;
    const st = stereo(len);
    addMono(st, sat(osc(len, (t) => 48 + 100 * Math.exp(-t / 0.025), ad(0.001, 0.18)), 1.8), 0, 1, 0);
    addStereo(st, [noise(0.1, 5500, ad(0.0002, 0.006), 'hp', 3000, 0.7), noise(0.1, 5501, ad(0.0002, 0.006), 'hp', 3000, 0.7)], 0, 0.7);
    const flash = (sd) => env(sweep(white(len, sd), 'hp', 5000, 0.7), ad(0.003, 0.22));
    addStereo(st, [flash(5502), flash(5503)], 0, 0.3);
    addStereo(st, [noise(len, 5504, ad(0.02, 0.4), 'bpn', 8000, 0.7), noise(len, 5505, ad(0.02, 0.4), 'bpn', 8200, 0.7)], 0, 0.12);
    addMono(st, osc(0.8, mtof(100), ad(0.001, 0.25)), 0.004, 0.12, -0.3);
    addMono(st, osc(0.8, mtof(107), ad(0.001, 0.18)), 0.012, 0.08, 0.3);
    put('hit-white', 0, st);
  }
  {
    // "16 industries." slams: a kick, a snare-like crack and a short lilac wash
    const len = 1.2;
    const st = stereo(len);
    addMono(st, sat(osc(len, (t) => 50 + 120 * Math.exp(-t / 0.02), ad(0.001, 0.14)), 1.8), 0, 1, 0);
    addMono(st, mode(len, 95, 0.4, 0.1, 0.002), 0, 1, 0);
    addMono(st, noise(0.3, 5600, ad(0.0003, 0.025), 'bpn', 1800, 0.9), 0, 0.6, 0);
    addStereo(st, [noise(0.1, 5601, ad(0.0002, 0.008), 'hp', 6000, 0.7), noise(0.1, 5602, ad(0.0002, 0.008), 'hp', 6000, 0.7)], 0, 0.4);
    const wash = (sd) => env(sweep(pink(len, sd), 'bpn', (t) => 1400 - 700 * smooth(t / 0.4), 0.8), ad(0.01, 0.25));
    addStereo(st, [wash(5603), wash(5604)], 0, 0.3);
    put('slam', 0, st);
  }

  return L;
}

/* a stereo buffer's balance without the dsp.balance allocation-per-call API differences */
function balanceSt(st, pan) {
  const a = ((pan + 1) * Math.PI) / 4;
  const gl = Math.cos(a) * Math.SQRT2;
  const gr = Math.sin(a) * Math.SQRT2;
  const [L, R] = st;
  for (let i = 0; i < L.length; i++) {
    const m = (L[i] + R[i]) * 0.5;
    const s = (L[i] - R[i]) * 0.5;
    L[i] = m * gl + s;
    R[i] = m * gr - s;
  }
  return st;
}

function fadeOut(st, sec) {
  const n = Math.round(sec * SR);
  for (const ch of st) for (let i = 0; i < n && i < ch.length; i++) ch[ch.length - 1 - i] *= i / n;
}

/** A riser that peaks (and cuts) at `peak` seconds: noise band, tremolo glide, reverse cymbal, sub. */
function riser(seed, peak, { m0, m1, f0, f1, sub = 0 }) {
  const len = peak + 0.035;
  const st = stereo(len);
  const a = (t) => (t < peak ? Math.pow(t / peak, 2.4) : Math.exp(-(t - peak) / 0.01));
  const fc = (t) => f0 * Math.pow(f1 / f0, Math.min(1, t / peak));
  addStereo(st, [env(sweep(pink(len, seed), 'bpn', fc, 1.3), a), env(sweep(pink(len, seed + 1), 'bpn', fc, 1.3), a)], 0, 0.8);
  const cym = (sd) => env(sweep(white(len, sd), 'hp', 4500, 0.7), (t) => (t < peak ? Math.pow(t / peak, 4) : Math.exp(-(t - peak) / 0.01)));
  addStereo(st, [cym(seed + 2), cym(seed + 3)], 0, 0.35);
  // tonal glide (two detuned saws, filtered) with a tremolo that accelerates 4 → 26 Hz
  const sL = new Saw(0.2);
  const sR = new Saw(0.7);
  const tl = mono(len);
  const tr = mono(len);
  let trem = 0;
  for (let i = 0; i < tl.length; i++) {
    const t = i / SR;
    const u = Math.min(1, t / peak);
    const f = mtof(m0 + (m1 - m0) * Math.pow(u, 1.5));
    trem += (TAU * (4 + 22 * u * u)) / SR;
    const g = a(t) * (0.62 + 0.38 * Math.sin(trem));
    tl[i] = sL.run(f * 0.997) * g;
    tr[i] = sR.run(f * 1.003) * g;
  }
  const cut = (t) => 900 + 5000 * Math.min(1, t / peak);
  addStereo(st, [sweep(tl, 'lp', cut, 0.8), sweep(tr, 'lp', cut, 0.8)], 0, 0.3);
  if (sub > 0) addMono(st, sat(osc(len, (t) => mtof(28) + mtof(28) * Math.min(1, t / peak), (t) => Math.pow(Math.min(1, t / peak), 2) * (t < peak ? 1 : Math.exp(-(t - peak) / 0.01))), 1.5), 0, sub, 0);
  return st;
}
