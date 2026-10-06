/**
 * THE INSTAGRAM REELS' BED — 120 BPM, E major, one arrangement per reel, composed against the reel's own timeline
 * (src/ig/<reel>/timing.ts SCENES + MUSIC: re-timed voices move the music with them). docs/ig/PIPELINE.md §6.3;
 * SCRIPT.md's per-beat "Sound" notes are the brief.
 *
 * Instruments: COPIED from scripts/kb/bed.mjs @ 743247a (that file exports only inputs(T) / bed(T); importing its
 * internals is impossible and editing it is forbidden: it is in film 2's mix hash). The file-level models — partial,
 * the felt piano, the sub, the bowed strings — are verbatim; the drum kit, pluck and e-piano (closures inside film 2's
 * bed()) are verbatim too, wrapped in `kitAt(sec, kickTimes)`. The chord table CH is film 2's.
 *
 * ARRANGEMENT: STUB (the foundation). Every reel gets the same placeholder: from MUSIC.bedFrom a soft felt-piano 8ths
 * figure and a shaker through E – C#m7 – Amaj7 – B with low strings and a sub (cut on the sample over MUSIC.stop, if
 * any), a half-bar snare roll with 8th kicks into the impact (MUSIC.roll), the inhale, E ON the logo (crash choked
 * before the name, a long low E, the resolution on piano + e-piano + strings) ringing into the master's fade. The reels'
 * own arrangements (PIPELINE.md §6.3 table) replace the stub section by section.
 *
 * Exports bed(T) → { st, points, segments } and inputs(T) (its cache key: scripts/ig/generate-sfx.mjs keys bed.wav on
 * this object + the bytes of this file and dsp.mjs; bed() reads ONLY this object).
 */
import {
  SR, TAU, stereo, mono, addMono, addStereo, osc, ad, mode, filt, noise, spread, fdn, compress, limit, mtof, smooth, rng,
  Saw, gain, white,
} from '../audio/dsp.mjs';

/** EVERYTHING the bed reads from the timeline — and the bed cache key. A new input goes here, so it is in the key too. */
export const inputs = (T) => ({
  REEL: T.REEL,
  BPM: T.BPM,
  BEAT: T.BEAT,
  DURATION: T.DURATION,
  MUSIC: T.MUSIC,
  SCENES: T.SCENES,
});

/* ═════════════════════════ instruments ═════════════════════════ */

/** One damped partial, added in place (rotation oscillator, incremental two-stage envelope, a damper). */
function partial(out, f, amp, ph, t1, a1, t2, a2, att, damp, dampTau, s0 = 0) {
  if (f <= 0 || f >= SR * 0.45) return;
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
 * FELT PIANO: stretched partials, two or three detuned strings, a soft felt hammer (steep roll-off, the striking point
 * notching the 8th), prompt + aftersound decay, the felt's breath and the key's thump, a felt damper at `dur` s.
 * `mute` (0…1): the moderator felt — darker and shorter (Part I's deadpan bar). Rendered notes are cached.
 */
const PIANO_CACHE = new Map();
function pianoNote(m, vel, dur, mute = 0, seed = 0) {
  const key = `${m}|${vel.toFixed(2)}|${dur.toFixed(3)}|${mute.toFixed(2)}|${seed}`;
  const hit = PIANO_CACHE.get(key);
  if (hit) return hit;
  const f = mtof(m);
  const len = dur + 0.35 + (mute ? 0 : 0.6);
  const out = mono(len);
  const r = rng(seed * 131 + m * 7 + 3);
  const B = 0.00022 * Math.pow(2, (m - 60) / 18);
  const strings = m < 36 ? 1 : m < 50 ? 2 : 3;
  const det = [0, 1.1, -0.8];
  const bright = vel * (1 - 0.55 * mute);
  for (let k = 1; k <= 16; k++) {
    const fk = f * k * Math.sqrt(1 + B * k * k);
    if (fk > 9000) break;
    const strike = 0.35 + 0.65 * Math.abs(Math.sin((Math.PI * k) / 8.3));
    const amp = Math.pow(k, -(2.45 - 0.9 * bright)) * strike;
    const t1 = (0.42 * Math.pow(440 / f, 0.35)) / Math.pow(k, 0.55);
    const t2 = (3.4 * Math.pow(440 / f, 0.45)) / Math.pow(k, 0.45);
    for (let s = 0; s < strings; s++) {
      partial(out, fk * Math.pow(2, det[s] / 1200), amp / strings, r() * TAU, t1, 0.62, t2, 0.38, 0.0035 - 0.0015 * vel, dur, mute ? 0.035 : 0.07);
    }
  }
  const breath = noise(0.05, seed * 7 + m, ad(0.0012, 0.006), 'lp', 900 + 900 * bright, 0.7);
  for (let i = 0; i < breath.length; i++) out[i] += breath[i] * (0.05 + 0.06 * vel);
  const thump = mode(0.12, 95 + (m % 7) * 3, 0.04 + 0.03 * vel, 0.03, 0.002);
  for (let i = 0; i < thump.length; i++) out[i] += thump[i];
  const o = filt(out, ['lp', (2400 + 2600 * vel) * (1 - 0.45 * mute), 0.6], ['hp', 38, 0.7]);
  PIANO_CACHE.set(key, o);
  return o;
}

/** a warm sine sub with a touch of second harmonic and soft saturation */
function subNote(dst, t0, dur, m, g, { att = 0.012, rel = 0.25 } = {}) {
  const f = mtof(m);
  const len = dur + rel + 0.05;
  const s = mono(len);
  let ph = 0;
  for (let i = 0; i < s.length; i++) {
    const t = i / SR;
    ph += (TAU * f) / SR;
    const a = Math.min(1, t / att) * (t < dur ? 1 : Math.exp(-(t - dur) / (rel / 3)));
    s[i] = Math.tanh((Math.sin(ph) + 0.18 * Math.sin(2 * ph)) * 1.25) * 0.8 * a;
  }
  addMono(dst, s, t0, g, 0);
}

/**
 * STRINGS: a bowed ensemble — per note three band-limited saws (detuned ±6 cents), each with its own slow pitch drift
 * and a vibrato that fades in after the bow settles; a body EQ, bow noise riding the envelope. `spans` are
 * [t0, t1, midi, gain] (s); a span's envelope swells in over `att` and lets go over `rel`.
 */
function stringSection(len, spans, { att = 0.45, rel = 0.7, cut = 2600, seed = 0 } = {}) {
  const L = mono(len);
  const R = mono(len);
  const r = rng(9100 + seed);
  for (const [t0, t1, m, g] of spans) {
    const f0 = mtof(m);
    const i0 = Math.max(0, Math.round((t0 - 0.02) * SR));
    const i1 = Math.min(len * SR, Math.round((t1 + rel * 2.2) * SR));
    for (let v = 0; v < 3; v++) {
      const saw = new Saw(r());
      const det = (v - 1) * 6 + (r() - 0.5) * 2;
      const vibF = 5.1 + r() * 0.8;
      const vibPh = r() * TAU;
      const drF = 0.09 + r() * 0.15;
      const drPh = r() * TAU;
      const pan = (v - 1) * 0.55 + (m % 12) * 0.01 - 0.06;
      const gl = Math.cos(((pan + 1) * Math.PI) / 4);
      const gr = Math.sin(((pan + 1) * Math.PI) / 4);
      let f = f0;
      for (let i = i0; i < i1; i++) {
        const t = i / SR;
        const u = t - t0;
        if (((i - i0) & 31) === 0) {
          const vib = 0.0055 * smooth((u - 0.35) / 0.6) * Math.sin(TAU * vibF * t + vibPh);
          const drift = 0.0016 * Math.sin(TAU * drF * t + drPh);
          f = f0 * Math.pow(2, det / 1200) * (1 + vib + drift);
        }
        const a = u < 0 ? 0 : (t < t1 ? smooth(u / att) : smooth(Math.min(1, (t1 - t0) / att)) * Math.exp(-(t - t1) / (rel / 2.3)));
        const x = saw.run(f) * a * g * 0.05;
        L[i] += x * gl;
        R[i] += x * gr;
      }
    }
  }
  const body = (c) => filt(c, ['hp', 70, 0.7], ['lp', cut, 0.65], ['lp', cut * 1.35, 0.6], ['peak', 290, 1.1, 2.5], ['peak', 1100, 1.3, -2], ['peak', 2700, 1.4, 1.5]);
  const out = [body(L), body(R)];
  // bow noise: a breath of rosin riding the section's own level
  const env = new Float32Array(out[0].length);
  {
    let e = 0;
    for (let i = 0; i < env.length; i++) {
      const x = Math.abs(out[0][i]) + Math.abs(out[1][i]);
      e += (x - e) * (x > e ? 0.002 : 0.0004);
      env[i] = e;
    }
  }
  for (let c = 0; c < 2; c++) {
    const n = filt(white(len, 9200 + seed + c), ['bp', 3800, 0.7], ['lp', 7000, 0.7]);
    for (let i = 0; i < out[c].length; i++) out[c][i] += n[i] * env[i] * 0.05;
  }
  return out;
}

/* ═════════════════════════ the drum kit, pluck, e-piano (film 2's bed() closures, verbatim) ═════════════════════════ */

/** film 2's in-bed instruments, bound to the bed's beat clock `sec` (beats → s); kicks are logged in `kickTimes` (s) */
function kitAt(sec, kickTimes) {
  const putPiano = (dst, x, m, vel, pan, { dur = 2.2, mute = 0, seed = 0, g = 1 } = {}) => addMono(dst, pianoNote(m, vel, dur, mute, seed), sec(x), g * (0.35 + 0.65 * vel), pan);
  /** a felt kick: round, low, no click — a pulse felt under the voices */
  const feltKick = (dst, x, g) => {
    kickTimes.push(sec(x));
    const k = filt(osc(0.45, (t) => 44 + 38 * Math.exp(-t / 0.045), ad(0.004, 0.2)), ['lp', 180, 0.7]);
    addMono(dst, k, sec(x), g, 0);
  };
  const kick = (dst, x, g) => {
    kickTimes.push(sec(x));
    const k = osc(0.5, (t) => 47 + 105 * Math.exp(-t / 0.028), ad(0.0012, 0.16)).map((v) => Math.tanh(v * 1.7) / Math.tanh(1.7));
    addMono(dst, k, sec(x), g, 0);
  };
  /** a soft shaker: a burst of bead grains, band-passed high */
  const shaker = (dst, x, g, seed, bright = 0) => {
    const len = 0.09;
    const s = mono(len);
    const r = rng(7100 + seed);
    for (let j = 0; j < 9; j++) {
      const t = 0.004 + Math.pow(r(), 1.4) * 0.05;
      const gr = noise(0.012, 7200 + seed * 13 + j, ad(0.0004, 0.002 + r() * 0.002), null);
      const a = Math.sin(Math.PI * Math.min(1, t / 0.06)) * (0.4 + 0.6 * r());
      const i0 = Math.round(t * SR);
      for (let i = 0; i < gr.length && i0 + i < s.length; i++) s[i0 + i] += gr[i] * a;
    }
    addStereo(dst, spread(filt(s, ['bp', 6800 + 1600 * bright, 0.9], ['hp', 3500, 0.7]), 0.35, 7300 + seed), sec(x), g);
  };
  const snare = (dst, x, g, seed) => {
    const len = 0.3;
    const s = noise(len, 7600 + seed, ad(0.0005, 0.06), 'bpn', 2200, 0.7);
    const tn = osc(len, (t) => 185 + 30 * Math.exp(-t / 0.01), ad(0.0008, 0.04));
    for (let i = 0; i < s.length; i++) s[i] = s[i] * 0.9 + tn[i] * 0.5;
    addStereo(dst, spread(s, 0.3, 7700 + seed), sec(x), g);
  };
  /** a crash; `choke` (s after the hit): a hand grabs it, gone in ~0.1 s */
  const crash = (dst, x, g, seed, tau = 1.4, choke = Infinity) => {
    const len = tau * 3.2;
    const metal = (sd) => {
      const r2 = rng(sd);
      const m = mono(len);
      for (let k = 0; k < 6; k++) {
        const o = osc(len, 3100 + r2() * 5200, ad(0.001, tau * (0.5 + r2() * 0.5)));
        for (let i = 0; i < m.length; i++) m[i] += (o[i] < 0 ? -Math.sqrt(-o[i]) : Math.sqrt(o[i])) * 0.12;
      }
      const n = noise(len, sd + 1, ad(0.002, tau), 'hp', 5200, 0.7);
      for (let i = 0; i < m.length; i++) m[i] = m[i] * 0.5 + n[i];
      const o = filt(m, ['hp', 2500, 0.7], ['lp', 14000, 0.7]);
      for (let i = Math.max(0, Math.round(choke * SR)); i < o.length; i++) o[i] *= Math.exp(-(i / SR - choke) / 0.02);
      return o;
    };
    addStereo(dst, [metal(7800 + seed), metal(7900 + seed)], sec(x), g);
  };
  /** additive pluck: exact pitch, harmonics decaying faster the higher they are */
  const pluck = (dst, x, m, g, pan, bright = 0.6, tau = 0.5) => {
    const len = Math.min(1.6, tau * 5);
    const f = mtof(m);
    const s = mono(len);
    for (let k = 1; k <= 8; k++) {
      if (f * k > 16000) break;
      const p = mode(len, f * k, Math.pow(k, -1.25) * (k === 1 ? 1 : bright), tau / Math.pow(k, 0.75), 0.0008);
      for (let i = 0; i < s.length; i++) s[i] += p[i];
    }
    addMono(dst, s, sec(x), g, pan);
  };
  /** e-piano (FM, tine) */
  const epiano = (dst, x, m, g, pan) => {
    const len = 3;
    const f = mtof(m);
    let pm = 0;
    let pt = 0;
    let pc = 0;
    const s = mono(len);
    for (let i = 0; i < s.length; i++) {
      const t = i / SR;
      pm += (TAU * f) / SR;
      pt += (TAU * f * 14) / SR;
      pc += (TAU * f) / SR;
      const idx = 1.8 * Math.exp(-t / 0.3) + 0.3;
      s[i] = Math.sin(pc + idx * Math.sin(pm) + 0.4 * Math.exp(-t / 0.02) * Math.sin(pt)) * Math.min(1, t / 0.002) * Math.exp(-t / 1.3);
    }
    addMono(dst, s, sec(x), g, pan);
  };

  return { putPiano, feltKick, kick, shaker, snare, crash, pluck, epiano };
}

/* ═════════════════════════ the bed ═════════════════════════ */

export function bed(T) {
  const I = inputs(T);
  const BEAT = 60 / I.BPM; // seconds per beat
  const fb = (frame) => frame / I.BEAT; // frames → beats
  const sec = (beat) => beat * BEAT;
  const M = I.MUSIC;
  const END = I.DURATION / I.BEAT;
  const P = {
    from: fb(M.bedFrom ?? 0),
    roll: fb(M.roll),
    impact: fb(M.impact),
    brand: fb(M.brand),
    stop: M.stop ? [fb(M.stop[0]), fb(M.stop[1])] : null,
  };
  const LEN = sec(END) + 3;
  const out = stereo(LEN);

  const CH = {
    E: { root: 40, notes: [56, 59, 64, 66], str: [52, 59, 64, 68] }, // E (add9 in the keys)
    Csm7: { root: 37, notes: [56, 59, 64, 71], str: [49, 56, 64, 71] },
    Amaj7: { root: 45, notes: [57, 61, 64, 68], str: [45, 57, 64, 68] },
    B: { root: 47, notes: [59, 63, 66, 71], str: [47, 59, 63, 66] },
    Bsus: { root: 47, notes: [59, 64, 66, 71], str: [47, 59, 64, 66] },
    Eadd9: { root: 40, notes: [52, 59, 64, 66, 68], str: [40, 52, 59, 66, 68] }, // the stop-time: E3 B3 E4 F#4 G#4
    Emaj9: { root: 40, notes: [52, 59, 63, 66, 68], str: [40, 52, 59, 63, 68] }, // b15's warm pad
    Amaj9: { root: 45, notes: [57, 61, 64, 68, 71], str: [45, 57, 64, 68, 71] },
    Fsm11: { root: 42, notes: [57, 61, 64, 69, 71], str: [42, 57, 64, 69, 71] },
    Efin: { root: 40, notes: [52, 59, 64, 68, 71, 78], str: [40, 52, 59, 64, 68, 71] }, // the resolution
  };
  /* ── harmony: E – C#m7 – Amaj7 – B, one chord per bar line from the bed's start, B into the impact, E on it ── */
  const seg = [];
  const put = (a, e, c) => {
    if (e > a + 1e-6) seg.push({ a, e, c });
  };
  {
    const PROG = ['E', 'Csm7', 'Amaj7', 'B'];
    let x = P.from;
    for (let k = 0; x < P.impact - 1 - 1e-6; k++) {
      const nx = Math.min(P.impact - 1, Math.floor(x / 4 + 1e-9) * 4 + 4);
      put(x, nx, PROG[k % 4]);
      x = nx;
    }
    put(x, P.impact, 'B');
    put(P.impact, END + 4, 'Efin');
  }
  const segAt = (x) => seg.find((s) => x >= s.a - 1e-9 && x < s.e - 1e-9) ?? seg[seg.length - 1];
  const chordAt = (x) => CH[segAt(x).c];

  const keys = stereo(LEN);
  const drums = stereo(LEN);
  const bass = stereo(LEN);
  const kickTimes = [];
  const { putPiano, kick, shaker, snare, crash, pluck, epiano } = kitAt(sec, kickTimes);

  /* ── ARRANGEMENT (stub, every reel): felt-piano 8ths + a shaker, low strings, the sub on the roots ── */
  const FIG = [0, 1, 2, 3, 2, 1, 2, 3];
  for (let x = Math.ceil(P.from * 2 - 1e-9) / 2; x < P.impact - 1e-6; x += 0.5) {
    const n = chordAt(x).notes;
    const pos = Math.round(x * 2) % 8;
    const v = 0.4 * (pos % 2 === 0 ? 1 : 0.8) * (pos === 0 ? 1.1 : 1);
    putPiano(keys, x, n[FIG[pos] % n.length] + 12, v, pos % 2 ? 0.22 : -0.22, { dur: 0.9, mute: 0.4, seed: pos % 3, g: 0.3 });
    shaker(drums, x, pos % 2 ? 0.07 : 0.05, pos);
  }
  {
    const spans = seg.filter((s) => s.a < P.impact - 1e-6).flatMap((s) => CH[s.c].str.map((m) => [sec(s.a) - 0.03, sec(s.e), m, 0.25]));
    addStereo(out, stringSection(LEN, spans, { att: 0.6, rel: 0.8, cut: 2200 }), 0, 1);
  }
  for (const s of seg) if (s.a < P.impact - 1e-6) subNote(bass, sec(s.a), sec(s.e - s.a) - 0.02, CH[s.c].root - 12 + (CH[s.c].root < 43 ? 12 : 0), 0.12, { att: 0.05, rel: 0.25 });

  /* ── the build: a half-bar snare roll (16ths → 32nds) and 8th kicks into the impact, 16th plucks ── */
  for (let x = P.roll; x < P.impact - 0.4; x += 0.5) kick(drums, x, 0.5 + 0.2 * ((x - P.roll) / (P.impact - P.roll)));
  for (let x = P.roll; x < P.impact - 0.3; ) {
    const u = (x - P.roll) / (P.impact - P.roll);
    snare(drums, x, 0.16 + 0.38 * u * u, Math.round(x * 8));
    x += u < 0.5 ? 0.25 : 0.125;
  }
  for (let x = P.roll, i = 0; x < P.impact - 0.01; x += 0.25, i++) {
    const n = chordAt(x).notes;
    pluck(keys, x, n[i % n.length] + 12, 0.03 + 0.04 * ((x - P.roll) / (P.impact - P.roll)), i % 2 ? 0.3 : -0.3, 0.6, 0.3);
  }

  /* ── E ON the logo: the crash (choked 50 ms before the name), a long low E, the resolution rolled across 60 ms ── */
  crash(drums, P.impact, 0.38, 3, 1.6, Math.max(0.1, sec(P.brand - P.impact) - 0.05));
  subNote(bass, sec(P.impact), sec(END - P.impact) + 1, 28, 0.3, { att: 0.09, rel: 1 });
  CH.Efin.notes.forEach((m, i) => {
    epiano(keys, P.impact + 0.02 + i * 0.022, m + 12, 0.045, (i - 2.5) * 0.18);
    putPiano(keys, P.impact + i * 0.024, m, 0.55, (i - 2.5) * 0.15, { dur: sec(END - P.impact) + 1, seed: 8, g: 0.2 });
  });
  addStereo(out, stringSection(LEN, CH.Efin.str.map((m) => [sec(P.impact) - 0.02, sec(END) + 1, m, 0.7]), { att: 0.25, rel: 1, cut: 2600, seed: 1 }), 0, 1);

  /* ── a gentle sidechain pump under the kicks ── */
  const pump = new Float32Array(out[0].length).fill(1);
  for (const t of kickTimes) {
    const i0 = Math.round(t * SR);
    for (let i = 0; i < 0.3 * SR && i0 + i < pump.length; i++) {
      const u = i / SR;
      pump[i0 + i] = Math.min(pump[i0 + i], 1 - 0.3 * (u < 0.004 ? u / 0.004 : Math.exp(-(u - 0.004) / 0.08)));
    }
  }
  for (let c = 0; c < 2; c++) for (let i = 0; i < out[c].length; i++) out[c][i] = (out[c][i] + keys[c][i] * 0.9 + bass[c][i]) * pump[i] + drums[c][i];

  /* ── space, glue, the inhale, density (film 2's chain) ── */
  const hall = fdn(out, { rt60: 2.4, rt60Hi: 0.9, pre: 0.022, size: 1.2, hp: 200, lp: 7000, tail: 0 });
  for (let c = 0; c < 2; c++) for (let i = 0; i < out[c].length; i++) out[c][i] += hall[c][i] * 0.3;
  const glued = compress(out, { thr: -20, ratio: 2, knee: 8, att: 0.01, rel: 0.2, rms: 0.01 });
  {
    // THE INHALE: the beat before the logo the bed is drawn in 9 dB, back at unity ON the hit
    const i0 = Math.round(sec(P.impact - 1) * SR);
    const i1 = Math.round(sec(P.impact) * SR);
    const back = Math.round(0.002 * SR);
    const dip = 1 - gain(-9);
    const down = Math.max(1, i1 - back - i0);
    for (let c = 0; c < 2; c++) {
      for (let i = i0; i < i1 && i < glued[c].length; i++) glued[c][i] *= i < i1 - back ? 1 - dip * smooth((i - i0) / down) : 1 - dip * ((i1 - i) / back);
    }
  }
  // THE STOP (MUSIC.stop): the bed and its tails cut on the sample (a 1 ms ramp), back over 30 ms at its end
  if (P.stop) {
    const a = Math.round(sec(P.stop[0]) * SR);
    const e = Math.round(sec(P.stop[1]) * SR);
    const r0 = Math.round(0.001 * SR);
    const r1 = Math.round(0.03 * SR);
    for (const c of glued) for (let i = Math.max(0, a - r0); i < Math.min(c.length, e + r1); i++) c[i] *= i < a ? (a - i) / r0 : i < e ? 0 : (i - e) / r1;
  }
  // nothing before the bed's start (ig2: the ring alone)
  for (const c of glued) for (let i = 0; i < Math.min(c.length, Math.round(sec(P.from) * SR)); i++) c[i] = 0;
  {
    let p = 0;
    for (const c of glued) for (let i = 0; i < c.length; i++) p = Math.max(p, Math.abs(c[i]));
    const k = p > 0 ? Math.pow(10, 3.5 / 20) / p : 1;
    for (const c of glued) for (let i = 0; i < c.length; i++) c[i] *= k;
  }
  const lim = limit(glued, { ceilingDb: -0.5, look: 0.004, rel: 0.09, relSlow: 0.3 });
  return { st: [lim[0], lim[1]], points: P, segments: seg };
}
