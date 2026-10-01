/**
 * THE MASTER — voices + bed + every cue, mixed offline, sample-accurate.
 *
 *   dialogue bus   the voice WAVs as recorded (sinc-resampled to 48 kHz; every line is already
 *                  at ONE loudness target), a leveller, then make-up per line so each line
 *                  keeps exactly that loudness, and a look-ahead true-peak limiter on the bus
 *                  (MIX.dialogueCeil) so voice transients never drive the master limiter
 *   bed            ducked DUCK.bedDb across every line (ramped in ahead of it), and
 *                  DUCK.eqDb in the speech band wherever the voice is actually sounding
 *   effects        each cue retuned (rate), panned / moved, gained; sent to its act's
 *                  room (the dark night room or the short bright white-act room) and the
 *                  bells to a dotted-8th ping-pong; the effects lose DUCK.sfxEqDb in the
 *                  speech band under the voice too (keys keep their weight, words stay clear)
 *   the impact     the effects bus rides up across the logo impact into a soft-knee clipper
 *                  (MIX.impact): the stacked hit gets dense, the film's loudest moment, and is
 *                  back to the untouched bus before the name
 *   the name       under the brand line the tails and the tonal buses (the logo chord's ring) duck
 *                  deeper (MIX.name), so every word of it stays clear of the impact's ring
 *   master         an exponential fade over the end card's last second (MIX.fadeOut), a gain
 *                  to MIX.lufs integrated, then a 4×-oversampled look-ahead true-peak
 *                  limiter at MIX.ceiling dBTP
 */
import path from 'node:path';
import {
  SR, readWav, resample, resampleSt, stereo, addStereo, balance, follower, compress, lufs, limit, truePeak,
  gain, db, fdn, fdnSparse, resampleCubic, early, pingPong, Biquad, smooth, peak, clamp, truePeakTrack,
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
  // QA: the odd-numbered lines alone (the even ones are voice − odd), so check-mix can hear each line
  // of the language cascade on its own, with the next voice counted as a masker
  const odd = stereo(n / SR);
  const placed = [];
  const CR = T.MIX.cutRoom;
  for (const [k, v] of T.VOICES.entries()) {
    const w = readWav(path.join(publicDir, 'voice', `${v.id}.wav`));
    const ch = w.ch.length > 1 ? w.ch : [w.ch[0], w.ch[0]];
    let st = w.sr === SR ? [Float32Array.from(ch[0]), Float32Array.from(ch[1])] : resampleSt(ch, w.sr / SR, 16);
    const cut = T.voiceCut(v);
    if (cut) {
      // THE CASCADE CUT (T.voiceCut): from the next voice's start she lets go like a voice that is
      // interrupted — an exponential release (−9 dB in the first quarter, MIX.cutRoom.k nepers) that
      // reaches true zero on her own next dip; the room she is in carries on for a moment
      // (MIX.cutRoom), so the line lets go into space instead of being gated
      const a = ((cut[0] - v.at) / F) * SR;
      const e = ((cut[1] - v.at) / F) * SR;
      const len = Math.min(st[0].length, Math.ceil(e) + 1);
      const played = [st[0].slice(0, len), st[1].slice(0, len)];
      const z = Math.exp(-CR.k);
      for (let i = Math.max(0, Math.floor(a)); i < len; i++) {
        const u = Math.max(0, i - a) / (e - a);
        const g = u >= 1 ? 0 : (Math.exp(-CR.k * u) - z) / (1 - z);
        played[0][i] *= g;
        played[1][i] *= g;
      }
      const wet = fdn(played, { ...CR.room, tail: CR.room.rt60 * 1.6 });
      const out = stereo(wet[0].length / SR);
      const k0 = gain(CR.db);
      for (let i = 0; i < out[0].length; i++) {
        const u = i < a ? 0 : i >= e ? 1 : smooth((i - a) / (e - a));
        out[0][i] = (i < len ? played[0][i] : 0) + wet[0][i] * k0 * u;
        out[1][i] = (i < len ? played[1][i] : 0) + wet[1][i] * k0 * u;
      }
      st = out;
    }
    addStereo(voice, st, frameS(v.at) / SR, 1);
    if (k % 2) addStereo(odd, st, frameS(v.at) / SR, 1);
    placed.push({ s: frameS(v.at), st });
  }
  /** line k alone over [a, e) samples, through a gain track (or several, multiplied) */
  const own = (k, a, e, ...tracks) => {
    const { s, st } = placed[k];
    const out = [new Float32Array(e - a), new Float32Array(e - a)];
    for (let i = a; i < e; i++) {
      const j = i - s;
      if (j < 0 || j >= st[0].length) continue;
      let g = 1;
      for (const t of tracks) g *= t[i];
      out[0][i - a] = st[0][j] * g;
      out[1][i - a] = st[1][j] * g;
    }
    return out;
  };
  const vBefore = lufs(voice);
  const voxLev = compress(voice, { thr: -19, ratio: 2, knee: 8, att: 0.004, rel: 0.14, rms: 0.006 });
  const voxLevGain = voxLev.gain;
  // make-up PER LINE: the leveller only shapes the syllables; every line comes back to its own
  // pre-leveller loudness — the one dialogue target the voice files are normalised to
  // (scripts/generate-voice.mjs) — so no line ends up quieter because it is punchier
  const lineDb = {};
  const spans = T.VOICES.map((v, k) => {
    const s0 = frameS(v.at);
    const s1 = k + 1 < T.VOICES.length ? frameS(T.VOICES[k + 1].at) : n;
    const e = Math.min(s1, frameS(v.at + T.vFrames(v.id)) + Math.round(0.2 * SR));
    return { id: v.id, s0: k === 0 ? 0 : s0, a: s0, s1, e };
  });
  // every line is measured ON ITS OWN (the cascade's lines overlap the voice that cuts in over them).
  // A whole line keeps its own loudness (the files share one target); a cascade fragment — what she
  // says before the next voice cuts in (its span ends there) — is brought to the dialogue level
  // itself, so every greeting of the cascade sits exactly where her other lines sit
  for (const [k, sp] of spans.entries()) {
    sp.k = k;
    sp.target = T.VOICES[k].until !== undefined ? T.MIX.dialogueLufs : lufs(own(k, sp.a, sp.e));
  }
  const trimLines = (st, dbOf) => {
    for (const sp of spans) {
      const g = gain(dbOf(sp));
      for (const c of st) for (let i = sp.s0; i < sp.s1; i++) c[i] *= g;
    }
  };
  for (const sp of spans) lineDb[sp.id] = sp.target - lufs(own(sp.k, sp.a, sp.e, voxLev.gain));
  trimLines(voxLev, (sp) => lineDb[sp.id]);
  const vAfter = lufs(voxLev);
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
  // the fader rides (BED.ride: frame → dB, smoothstep between points)
  const ride = new Float32Array(n).fill(1);
  {
    const R = T.BED.ride;
    for (let i = 0; i < n; i++) {
      const f = (i / SR) * F;
      let d = 0;
      if (f <= R[0][0]) d = R[0][1];
      else if (f >= R[R.length - 1][0]) d = R[R.length - 1][1];
      else {
        let k = 0;
        while (R[k + 1][0] < f) k++;
        d = R[k][1] + (R[k + 1][1] - R[k][1]) * smooth((f - R[k][0]) / (R[k + 1][0] - R[k][0]));
      }
      ride[i] = gain(d);
    }
  }
  // the duck, split at DUCK.lowHz (Linkwitz–Riley, 24 dB/oct, sums flat): the lows only dip DUCK.bedLowDb
  const lowDuck = gain(T.DUCK.bedLowDb);
  const lowK = (1 - lowDuck) / (1 - gain(T.DUCK.bedDb));
  const bedIn = [new Float32Array(n), new Float32Array(n)];
  for (let c = 0; c < 2; c++) {
    const lp = [new Biquad('lp', T.DUCK.lowHz, Math.SQRT1_2), new Biquad('lp', T.DUCK.lowHz, Math.SQRT1_2)];
    const hp = [new Biquad('hp', T.DUCK.lowHz, Math.SQRT1_2), new Biquad('hp', T.DUCK.lowHz, Math.SQRT1_2)];
    for (let i = 0; i < n; i++) {
      const x = i < bedSt[c].length ? bedSt[c][i] * T.BED.vol * ride[i] : 0;
      const lo = lp[1].run(lp[0].run(x));
      const hi = hp[1].run(hp[0].run(x));
      // the full-band duck depth (1 − bedGain) scaled down for the lows
      const gLo = 1 - (1 - bedGain[i]) * lowK;
      bedIn[c][i] = lo * gLo + hi * bedGain[i];
    }
  }
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
  // THE NAME (MIX.name): a window over the brand line (faded in `lookahead` frames before it, out
  // over `release` after it) in which the voice-driven duck of the tails and the tonal buses goes deeper
  const NM = T.MIX.name;
  const nameW = new Float32Array(n);
  {
    const v = T.VOICES.find((x) => x.id === NM.voice);
    const a = v.at;
    const e = v.at + T.vFrames(v.id);
    for (let i = Math.max(0, frameS(a - NM.lookahead)); i < Math.min(n, frameS(e + NM.release)); i++) {
      const f = (i / SR) * F;
      nameW[i] = f < a ? smooth((f - (a - NM.lookahead)) / NM.lookahead) : f <= e ? 1 : 1 - smooth((f - e) / NM.release);
    }
  }
  const sfx = stereo(n / SR + 0.001);
  addStereo(sfx, dry, 0, 1);
  {
    const depth = (d, x, w) => 1 - gain(d + x * w);
    for (let i = 0; i < n; i++) {
      const w = nameW[i];
      const dT = depth(T.DUCK.tailsDb, NM.tailsDb, w) * act[i];
      const dB = depth(T.DUCK.tonalDb, NM.tonalDb, w) * act[i];
      const dK = depth(T.DUCK.keyTonalDb, NM.tonalDb, w) * act[i];
      for (let c = 0; c < 2; c++) sfx[c][i] += tails[c][i] * (1 - dT) + tonal[c][i] * (1 - dB) + keyTonal[c][i] * (1 - dK);
    }
  }
  const fxEq = dynamicEq([sfx[0].subarray(0, n), sfx[1].subarray(0, n)], act, T.DUCK.sfxEqDb, 2400, 0.6);

  // the master gain to come (the final pass corrects it by a few hundredths of a dB)
  const g0 = T.MIX.lufs - lufs([0, 1].map((c) => Float32Array.from(voxLev[c], (x, i) => x + bed[c][i] + fxEq[c][i])));

  /* ── dialogue peaks: a look-ahead true-peak limiter on the dialogue bus at MIX.dialogueCeil dBTP
   * (after the master gain). The lines are loudness-matched, so their peaks differ: the bus catches
   * plosives and consonant spikes itself, so the master limiter never pulls the bed and the effects
   * down with them. Each line's trim is re-solved through the limiter (3 passes) so every line still
   * lands on the dialogue target. */
  let vox;
  {
    const adj = Object.fromEntries(spans.map((sp) => [sp.id, 0]));
    for (let pass = 0; pass < 3; pass++) {
      const inp = [Float32Array.from(voxLev[0]), Float32Array.from(voxLev[1])];
      trimLines(inp, (sp) => adj[sp.id]);
      vox = limit(inp, { ceilingDb: T.MIX.dialogueCeil - g0, look: 0.002, rel: 0.04, relSlow: 0.2 });
      for (const sp of spans) {
        let m = 0;
        for (let i = sp.a; i < sp.e; i++) {
          const a = Math.abs(inp[0][i]);
          if (a > 1e-3) m = Math.max(m, db(a) - db(Math.abs(vox[0][i]) || 1e-9));
        }
        sp.gr = m;
      }
      let worst = 0;
      for (const sp of spans) {
        const out = own(sp.k, sp.a, sp.e, voxLev.gain, vox.gain);
        const tg = gain(lineDb[sp.id] + adj[sp.id]);
        for (const c of out) for (let i = 0; i < c.length; i++) c[i] *= tg;
        const d = sp.target - lufs(out);
        adj[sp.id] += d;
        worst = Math.max(worst, Math.abs(d));
      }
      if (worst < 0.05) break;
    }
    for (const sp of spans) lineDb[sp.id] += adj[sp.id];
  }
  // the odd lines through the same (gain-only, stereo-linked) dialogue chain: leveller × line trims × limiter
  const oddOut = [new Float32Array(n), new Float32Array(n)];
  {
    const trim = new Float32Array(n).fill(1);
    for (const sp of spans) {
      const g = gain(lineDb[sp.id]);
      for (let i = sp.s0; i < sp.s1; i++) trim[i] = g;
    }
    for (let i = 0; i < n; i++) {
      const g = voxLevGain[i] * trim[i] * vox.gain[i];
      oddOut[0][i] = odd[0][i] * g;
      oddOut[1][i] = odd[1][i] * g;
    }
  }

  /* ── the logo impact: the film's loudest moment ──
   * The hit is a stack of dense layers (the impact, the four lights' chord, the shock ring, the
   * build's last peak): summed they are peaky (a 9 dB peak-to-loudness ratio), so turning them up
   * only drives the master limiter — which then pumps Ava's name under it. Instead the effects bus
   * gets an insert across the hit: it rides up MIX.impact.rideDb into a soft-knee clipper whose
   * ceiling sits at MIX.impact.ceil dBTP after the master gain (the knee starts `knee` dB below),
   * held for a few frames and crossfaded back to the untouched bus before the name
   * (CTA.brandVoice). The stack comes out dense, over the loudest dialogue by MIX.impact.lead. */
  const I = T.MIX.impact;
  const fx = [Float32Array.from(fxEq[0]), Float32Array.from(fxEq[1])];
  const insert = { from: frameS(I.at + I.hold[0] - 0.5), to: Math.min(n, frameS(I.at + I.release)) };
  {
    const C = gain(I.ceil - g0);
    const K = C * gain(-I.knee);
    const G = gain(I.rideDb);
    const clip = (x) => {
      const a = Math.abs(x);
      return a <= K ? x : Math.sign(x) * (K + (C - K) * Math.tanh((a - K) / (C - K)));
    };
    const a0 = I.at + I.hold[0] - 0.5;
    const a1 = I.at + I.hold[0];
    const e0 = I.at + I.hold[1];
    const e1 = I.at + I.release;
    for (let i = insert.from; i < insert.to; i++) {
      const f = (i / SR) * F;
      const u = f < a1 ? smooth((f - a0) / (a1 - a0)) : f <= e0 ? 1 : 1 - smooth((f - e0) / (e1 - e0));
      for (let c = 0; c < 2; c++) fx[c][i] += (clip(fxEq[c][i] * G) - fxEq[c][i]) * u;
    }
  }

  /* ── master ── */
  const sum = [new Float32Array(n), new Float32Array(n)];
  for (let c = 0; c < 2; c++) {
    const hp = new Biquad('hp', 18, 0.6);
    // the air ceiling (MIX.airLp): two Butterworth sections, 24 dB/oct
    const lp1 = new Biquad('lp', T.MIX.airLp, 0.5412);
    const lp2 = new Biquad('lp', T.MIX.airLp, 1.3066);
    for (let i = 0; i < n; i++) sum[c][i] = lp2.run(lp1.run(hp.run(vox[c][i] + bed[c][i] + fx[c][i])));
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
    impactInsert: insert,
    provisionalGainDb: g0,
    dialogueLimiterMaxGrDb: vox.maxReductionDb,
    dialogueLimiterLineGrDb: Object.fromEntries(spans.map((sp) => [sp.id, Math.round(sp.gr * 10) / 10])),
    preLufs: pre,
    masterGainDb: g,
    limiterMaxGrDb: out.maxReductionDb,
    lufs: lufs(out),
    truePeakDb: db(truePeak(out, gain(T.MIX.ceiling - 6))),
    samplePeakDb: db(peak(out)),
    bedPeakDb: db(peak(bedSt)),
  };
  return { mix: [out[0], out[1]], stems: { voice: [vox[0], vox[1]], 'voice-odd': oddOut, bed, sfx: [fx[0], fx[1]] }, report, gainDb: g };
}
