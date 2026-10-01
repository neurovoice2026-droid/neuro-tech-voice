/**
 * THE MASTER — voices + bed + every cue, mixed offline, sample-accurate.
 *
 *   dialogue bus   the voice WAVs as recorded (sinc-resampled to 48 kHz; every line is already
 *                  at ONE loudness target), a gentle 2:1 leveller, then make-up per line so
 *                  each line keeps exactly that loudness
 *   bed            ducked DUCK.bedDb across every line (ramped in ahead of it), and
 *                  DUCK.eqDb in the speech band wherever the voice is actually sounding
 *   effects        each cue retuned (rate), panned / moved, gained; sent to its act's
 *                  room (the dark night room or the short bright white-act room) and the
 *                  bells to a dotted-8th ping-pong; the effects lose DUCK.sfxEqDb in the
 *                  speech band under the voice too (keys keep their weight, words stay clear)
 *   the impact     the effects bus rides up across the logo impact into its own true-peak
 *                  limiter (MIX.impact): the climax is the loudest moment, the name stays clean
 *   master         an exponential fade over the end card's last second (MIX.fadeOut), a gain
 *                  to MIX.lufs integrated, then a 4×-oversampled look-ahead true-peak
 *                  limiter at MIX.ceiling dBTP
 */
import path from 'node:path';
import {
  SR, readWav, resample, resampleSt, stereo, addStereo, balance, follower, compress, lufs, limit, truePeak,
  gain, db, fdnSparse, resampleCubic, early, pingPong, Biquad, smooth, peak, clamp, truePeakTrack,
} from './dsp.mjs';

const ROOMS = {
  // the dark acts: a mid-sized, dark room
  night: { fdn: { rt60: 1.5, rt60Hi: 0.45, pre: 0.02, size: 1.1, hp: 160, lp: 6500 }, er: [[9, 0.5, -1], [14, 0.42, 1], [21, 0.35, -1], [29, 0.3, 1], [38, 0.24, -1], [49, 0.18, 1]], wet: 1, erGain: 0.6 },
  // the white act: a short, bright room
  white: { fdn: { rt60: 0.7, rt60Hi: 0.55, pre: 0.006, size: 0.55, hp: 250, lp: 12000 }, er: [[4, 0.6, -1], [7, 0.5, 1], [11, 0.42, -1], [15, 0.34, 1], [20, 0.26, -1]], wet: 0.85, erGain: 0.8 },
};

/** Voice activity 0..1 per sample (10 ms RMS, fast attack, 180 ms release), looking `ahead` seconds ahead. */
function activity(mono, ahead = 0) {
  const e = follower(mono, 0.004, 0.18, 0.01);
  const a = new Float32Array(mono.length);
  const la = Math.round(ahead * SR);
  for (let i = 0; i < a.length; i++) a[i] = smooth((db(e[i]) + 52) / 16);
  if (la > 0) {
    // the duck starts before the word: running max over the next `la` samples (monotonic deque)
    const out = new Float32Array(a.length);
    const dq = new Int32Array(a.length);
    let h = 0;
    let t = 0;
    for (let i = a.length - 1; i >= 0; i--) {
      while (t > h && a[dq[t - 1]] <= a[i]) t--;
      dq[t++] = i;
      while (dq[h] > i + la) h++;
      out[i] = a[dq[h]];
    }
    return out;
  }
  return a;
}

/** A peaking EQ in the speech band whose cut follows `amt` (0..1) × `depthDb`. */
function dynamicEq(st, amt, depthDb, f = 2300, q = 0.75) {
  const out = [new Float32Array(st[0].length), new Float32Array(st[0].length)];
  for (let c = 0; c < 2; c++) {
    const b = new Biquad('peak', f, q, 0);
    let last = 1;
    for (let i = 0; i < st[c].length; i++) {
      if ((i & 31) === 0) {
        const g = depthDb * amt[i];
        if (Math.abs(g - last) > 0.05) {
          b.set(f, q, g);
          last = g;
        }
      }
      out[c][i] = b.run(st[c][i]);
    }
  }
  return out;
}

export function master(T, lib, bedSt, { publicDir }) {
  const F = T.FPS;
  const n = Math.round((T.DURATION / F) * SR);
  const frameS = (f) => Math.round((f / F) * SR);

  /* ── dialogue ── */
  const voice = stereo(n / SR);
  for (const v of T.VOICES) {
    const w = readWav(path.join(publicDir, 'voice', `${v.id}.wav`));
    const ch = w.ch.length > 1 ? w.ch : [w.ch[0], w.ch[0]];
    const st = w.sr === SR ? ch : resampleSt(ch, w.sr / SR, 16);
    addStereo(voice, st, frameS(v.at) / SR, 1);
  }
  const vBefore = lufs(voice);
  const vox = compress(voice, { thr: -19, ratio: 2, knee: 8, att: 0.004, rel: 0.14, rms: 0.006 });
  // make-up PER LINE: the leveller only shapes the syllables; every line comes back to its own
  // pre-leveller loudness — the one dialogue target the voice files are normalised to
  // (scripts/generate-voice.mjs) — so no line ends up quieter because it is punchier
  const lineDb = {};
  {
    const spans = T.VOICES.map((v) => frameS(v.at)).map((s0, k, all) => [s0, k + 1 < all.length ? all[k + 1] : n]);
    T.VOICES.forEach((v, k) => {
      const [s0, s1] = spans[k];
      const e = Math.min(s1, frameS(v.at + T.vFrames(v.id)) + Math.round(0.2 * SR));
      const seg = (st) => [st[0].subarray(s0, e), st[1].subarray(s0, e)];
      const mk = lufs(seg(voice)) - lufs(seg(vox));
      lineDb[v.id] = mk;
      const g = gain(mk);
      for (const c of vox) for (let i = k === 0 ? 0 : s0; i < s1; i++) c[i] *= g;
    });
  }
  const vAfter = lufs(vox);
  const act = activity(voice[0], T.DUCK.lookahead);

  /* ── bed: line-window duck + speech-band dynamic EQ ── */
  const bedGain = new Float32Array(n).fill(1);
  {
    const D = T.DUCK;
    const depth = 1 - gain(D.bedDb);
    for (let i = 0; i < n; i++) {
      const f = (i / SR) * F;
      let k = 0;
      for (const [a, e] of T.SPEECH) {
        if (f < a - D.ramp || f > e + D.release) continue;
        const u = f < a ? smooth((f - (a - D.ramp)) / D.ramp) : f <= e ? 1 : 1 - smooth((f - e) / D.release);
        k = Math.max(k, u);
      }
      bedGain[i] = 1 - depth * k;
    }
  }
  const bedIn = [new Float32Array(n), new Float32Array(n)];
  for (let c = 0; c < 2; c++) for (let i = 0; i < n && i < bedSt[c].length; i++) bedIn[c][i] = bedSt[c][i] * T.BED.vol * bedGain[i];
  const bed = dynamicEq(bedIn, act, T.DUCK.eqDb);

  /* ── effects ── */
  const dry = stereo(n / SR + 0.001);
  const tonal = stereo(n / SR + 0.001);
  const keyTonal = stereo(n / SR + 0.001);
  const send = { night: stereo(n / SR + 0.001), white: stereo(n / SR + 0.001) };
  const dly = stereo(n / SR + 0.001);
  const missing = new Set();
  const tuned = new Map();
  /** the cue's playback rate: band-limited sinc for real retuning, Hermite for micro-detunes (memoised) */
  const retune = (file, src, rate) => {
    if (Math.abs(rate - 1) < 1e-4) return src;
    const key = `${file}@${rate.toFixed(6)}`;
    if (!tuned.has(key)) {
      const cents = Math.abs(1200 * Math.log2(rate));
      tuned.set(key, cents < 25 ? [resampleCubic(src[0], rate), resampleCubic(src[1], rate)] : resampleSt(src, rate, 8));
    }
    return tuned.get(key);
  };
  for (const c of T.CUES) {
    const src = lib.get(c.file);
    if (!src) {
      missing.add(c.file);
      continue;
    }
    let st = retune(c.file, src, c.rate);
    st = balance(st, c.pan, c.move ? c.move / F : undefined);
    const at = (c.at / F) * SR;
    const s0 = Math.floor(at);
    // fractional start: a tiny linear interpolation keeps sample accuracy
    const fr = at - s0;
    const put = (bus, g) => {
      for (let ch = 0; ch < 2; ch++) {
        const x = st[ch];
        const o = bus[ch];
        for (let i = 0; i < x.length; i++) {
          const j = s0 + i;
          if (j < 0 || j >= o.length) continue;
          const v = fr ? x[i] * (1 - fr) + (i > 0 ? x[i - 1] : 0) * fr : x[i];
          o[j] += v * g;
        }
      }
    };
    put(c.group === 'bell' || c.group === 'spark' ? (c.key && c.speech ? keyTonal : tonal) : dry, c.vol);
    put(send[c.room], c.vol * gain(c.send));
    if (c.delay !== undefined) put(dly, c.vol * gain(c.delay));
  }
  if (missing.size) throw new Error(`[mix] cues reference missing sounds: ${[...missing].join(', ')}`);
  // the returns (rooms + tempo delay) are the tails: they step back under the voice
  const tails = stereo(n / SR + 0.001);
  for (const [room, R] of Object.entries(ROOMS)) {
    const wet = fdnSparse(send[room], R.fdn, { gap: 4, tail: R.fdn.rt60 * 2.2 });
    addStereo(tails, wet, 0, R.wet);
    addStereo(tails, early(send[room], R.er), 0, R.erGain);
  }
  addStereo(tails, pingPong(dly, { time: (60 / T.BPM) * 0.75, fb: 0.3, lp: 5500, hp: 400, tail: 0 }), 0, 1);
  const sfx = stereo(n / SR + 0.001);
  addStereo(sfx, dry, 0, 1);
  {
    const dT = 1 - gain(T.DUCK.tailsDb);
    const dB = 1 - gain(T.DUCK.tonalDb);
    const dK = 1 - gain(T.DUCK.keyTonalDb);
    for (let c = 0; c < 2; c++) {
      for (let i = 0; i < n; i++) sfx[c][i] += tails[c][i] * (1 - dT * act[i]) + tonal[c][i] * (1 - dB * act[i]) + keyTonal[c][i] * (1 - dK * act[i]);
    }
  }
  const fxEq = dynamicEq([sfx[0].subarray(0, n), sfx[1].subarray(0, n)], act, T.DUCK.sfxEqDb, 2400, 0.6);

  /* ── the logo impact: the film's loudest moment ──
   * The effects bus rides up MIX.impact.rideDb across the hit (held a few frames, back to unity
   * before Ava says the name) into the bus's own look-ahead true-peak limiter at MIX.impact.ceil
   * dBTP (after the master gain): the stacked hit (impact + chord + shock + the build's last
   * peak) gets dense instead of peaky, and the master limiter no longer pumps the name under it.
   * (The bus limiter guards every other big hit of the film the same way.) */
  const I = T.MIX.impact;
  const ride = new Float32Array(n).fill(1);
  {
    const up = gain(I.rideDb);
    const a0 = I.at + I.hold[0] - 0.5;
    const a1 = I.at + I.hold[0];
    const e0 = I.at + I.hold[1];
    const e1 = I.at + I.release;
    for (let i = frameS(a0); i < Math.min(n, frameS(e1)); i++) {
      const f = (i / SR) * F;
      const u = f < a1 ? smooth((f - a0) / (a1 - a0)) : f <= e0 ? 1 : 1 - smooth((f - e0) / (e1 - e0));
      ride[i] = 1 + (up - 1) * u;
    }
  }
  const rode = fxEq.map((c) => Float32Array.from(c, (x, i) => x * ride[i]));
  const g0 = T.MIX.lufs - lufs([0, 1].map((c) => Float32Array.from(vox[c], (x, i) => x + bed[c][i] + rode[c][i])));
  const fx = limit(rode, { ceilingDb: I.ceil - g0, look: 0.0015, rel: 0.05, relSlow: 0.25 });

  /* ── master ── */
  const sum = [new Float32Array(n), new Float32Array(n)];
  for (let c = 0; c < 2; c++) {
    const hp = new Biquad('hp', 18, 0.6);
    for (let i = 0; i < n; i++) sum[c][i] = hp.run(vox[c][i] + bed[c][i] + fx[c][i]);
  }
  // THE END: the whole mix fades out over the end card's last second (MIX.fadeOut) — an
  // exponential (dB-linear) curve, offset so it lands on true zero at the last sample — so the
  // impact's rooms and the chord's ring resolve into silence instead of being cut, and a looping
  // 9:16 player runs from silence back into the hook's silence
  {
    const [fa, fe] = T.MIX.fadeOut;
    const a = frameS(fa);
    const e = Math.min(n, frameS(fe));
    const k = T.MIX.fadeK;
    const z = Math.exp(-k);
    for (let c = 0; c < 2; c++) {
      for (let i = a; i < n; i++) {
        const u = Math.min(1, (i - a) / Math.max(1, e - 1 - a));
        sum[c][i] *= (Math.exp(-k * u) - z) / (1 - z);
      }
    }
  }
  const pre = lufs(sum);
  let g = T.MIX.lufs - pre;
  let out = null;
  // the gained signal's true-peak track is the track × gain: compute it once
  const tracks = sum.map((c) => truePeakTrack(c, gain(T.MIX.ceiling - 9)));
  for (let pass = 0; pass < 3; pass++) {
    const k = gain(g);
    const hot = sum.map((c) => {
      const o = new Float32Array(c.length);
      for (let i = 0; i < c.length; i++) o[i] = c[i] * k;
      return o;
    });
    out = limit(hot, { ceilingDb: T.MIX.ceiling, look: 0.0015, rel: 0.06, relSlow: 0.35, tracks, trackGain: k });
    const got = lufs(out);
    if (Math.abs(got - T.MIX.lufs) < 0.1) break;
    g += T.MIX.lufs - got;
  }
  const report = {
    voiceLufsIn: vBefore,
    dialogueMakeupDb: vBefore - vAfter,
    lineMakeupDb: lineDb,
    fxBusLimiterMaxGrDb: fx.maxReductionDb,
    preLufs: pre,
    masterGainDb: g,
    limiterMaxGrDb: out.maxReductionDb,
    lufs: lufs(out),
    truePeakDb: db(truePeak(out, gain(T.MIX.ceiling - 6))),
    samplePeakDb: db(peak(out)),
    bedPeakDb: db(peak(bedSt)),
  };
  return { mix: [out[0], out[1]], stems: { voice: vox, bed, sfx: [fx[0], fx[1]] }, report, gainDb: g };
}
