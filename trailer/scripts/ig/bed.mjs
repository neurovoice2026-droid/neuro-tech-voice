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

/* ═════════════════════════ REEL 1 "Not even ours" — the shift pulse ═════════════════════════ */
/**
 * ig1's arrangement (docs/ig/SCRIPT.md ig1 §4 "Sound"; PIPELINE.md §6.3 "Shift pulse"), on the reel's own moments
 * (MUSIC.ig1: hours, cascade, does, desk, cta — frames, re-timed with the voices):
 *   HARMONY  E under the hook (the dilemma, a pedal) → C#m7 – Amaj7 – Bsus/B through "Nine to six … a hundred and
 *            sixty-eight" (the question rising) → E ON the bar of the teal cascade (the answer) → C#m7 – Amaj7 – B – E …
 *            by bar, B into the impact, E on it
 *   HOOK     shaker 8ths + a muted felt-piano ostinato on E in a low graphite register, the root pedal under it
 *   HOURS    + a low string pad and the sub on the roots
 *   CASCADE  the pad and strings OPEN AN OCTAVE (brighter, fuller), the ostinato lifts an octave and unmutes
 *   DOES     a light felt kick on 1 and 3 under the records
 *   DESK     thins to piano: warm open chords on 1 and 3 (the people beat) — no shaker, no kick, no strings
 *   CTA      the ostinato and shaker back, the strings swelling through the last two bars into the shared build
 */
function ig1Harmony(put, P, fb, M) {
  const cb = Math.floor(fb(M.ig1.cascade) / 4 + 1e-9) * 4; // the cascade's bar
  put(P.from, cb - 12, 'E');
  put(cb - 12, cb - 8, 'Csm7');
  put(cb - 8, cb - 4, 'Amaj7');
  put(cb - 4, cb - 2, 'Bsus');
  put(cb - 2, cb, 'B');
  const PROG = ['E', 'Csm7', 'Amaj7', 'B'];
  for (let x = cb, k = 0; x < P.impact - 1e-6; x += 4, k++) put(x, Math.min(P.impact, x + 4), x + 4 >= P.impact - 1e-6 ? 'B' : PROG[k % 4]);
  put(P.impact, fb(M.end) / 1 + 4, 'Efin');
}

function ig1Parts({ P, fb, M, seg, CH, chordAt, sec, LEN, out, keys, drums, bass, putPiano, feltKick, shaker }) {
  const S = { hours: fb(M.ig1.hours), cascade: fb(M.ig1.cascade), does: fb(M.ig1.does), desk: fb(M.ig1.desk), cta: fb(M.ig1.cta) };
  const cb = Math.floor(S.cascade / 4 + 1e-9) * 4;
  /* the ostinato: 8ths over the chord, low and muted (graphite) until the cascade, an octave up and open after it */
  const FIG = [0, 2, 1, 3, 0, 2, 1, 2];
  for (let x = Math.ceil(P.from * 2 - 1e-9) / 2; x < P.impact - 1e-6; x += 0.5) {
    if (x >= S.desk - 1e-6 && x < S.cta - 1e-6) continue; // the desk: piano chords instead
    const n = chordAt(x).notes;
    const pos = Math.round(x * 2) % 8;
    const open = x >= cb - 1e-6;
    const reg = open ? 0 : -12;
    const v = (open ? 0.44 : 0.38) * (pos % 2 === 0 ? 1 : 0.78) * (pos === 0 ? 1.12 : 1);
    putPiano(keys, x, n[FIG[pos] % n.length] + reg, v, pos % 2 ? 0.2 : -0.2, { dur: open ? 0.8 : 0.55, mute: open ? 0.22 : 0.62, seed: pos % 3, g: open ? 0.3 : 0.36 });
    // the root pedal, on each bar's one (low, muted)
    if (pos === 0 && !open) putPiano(keys, x, CH[segAt(seg, x).c].root, 0.42, 0, { dur: 1.6, mute: 0.5, seed: 5, g: 0.34 });
    if (x < S.desk - 1e-6 || x >= S.cta - 1e-6) shaker(drums, x, (pos % 2 ? 0.068 : 0.05) * (open ? 1.1 : 1), pos);
  }
  /* the strings: a low pad from the week's act; OPEN AN OCTAVE on the cascade; gone for the desk; swelling into the build */
  {
    const spans = [];
    for (const s of seg) {
      if (s.a >= P.impact - 1e-6) continue;
      const a = Math.max(s.a, S.hours);
      const e = Math.min(s.e, P.impact);
      if (e <= a + 1e-6) continue;
      for (const [x0, x1, oct, g] of [
        [a, Math.min(e, cb), 0, 0.16],
        [Math.max(a, cb), Math.min(e, S.desk), 12, 0.27],
        [Math.max(a, S.cta), e, 0, 0.2],
      ]) {
        if (x1 <= x0 + 1e-6) continue;
        for (const m of CH[s.c].str) spans.push([sec(x0) - 0.03, sec(x1), m + oct, g]);
      }
    }
    addStereo(out, stringSection(LEN, spans, { att: 0.55, rel: 0.8, cut: 2600 }), 0, 1);
    // the build's swell: the last two bars before the impact, low strings crescendo (a bowed rise into the hit)
    const sw = [];
    const a0 = Math.max(S.cta, P.impact - 8);
    for (let x = a0; x < P.impact - 1e-6; x += 1) for (const m of chordAt(x).str) sw.push([sec(x) - 0.02, sec(x + 1), m - 12 + (m < 50 ? 12 : 0), 0.1 + 0.5 * ((x - a0) / (P.impact - a0)) ** 1.6]);
    addStereo(out, stringSection(LEN, sw, { att: 0.3, rel: 0.25, cut: 2400, seed: 3 }), 0, 1);
    // the crest: a rising noise swell (a reversed cymbal's breath) from the roll into the inhale, its band opening upward
    const a = P.roll;
    const c = P.impact - (M.build?.breathEnd ?? M.build?.inhale ?? 1);
    const D = sec(c - a);
    const u = (t) => Math.min(1, Math.max(0, t / D));
    const breath = noise(D + 0.03, 9401, (t) => Math.pow(u(t), M.build?.breathCurve ?? 0.9) * (t > D ? Math.max(0, 1 - (t - D) / 0.03) : 1), 'bpn', (t) => 1400 + 7000 * Math.pow(u(t), 1.6), 0.55);
    addStereo(drums, spread(breath, 0.55, 9402), sec(a), M.build?.breath ?? 0.3);
  }
  /* the sub on the roots from the week's act (not under the desk's piano) */
  for (const s of seg) {
    if (s.a >= P.impact - 1e-6 || s.e <= S.hours) continue;
    const a = Math.max(s.a, S.hours);
    if (a >= S.desk - 1e-6 && a < S.cta - 1e-6) continue;
    subNote(bass, sec(a), sec(s.e - a) - 0.02, CH[s.c].root - 12 + (CH[s.c].root < 43 ? 12 : 0), a >= cb ? 0.14 : 0.1, { att: 0.05, rel: 0.25 });
  }
  /* does: a light felt kick on 1 and 3 */
  for (let x = Math.ceil(S.does / 2 - 1e-9) * 2; x < S.desk - 1e-6; x += 2) feltKick(drums, x, 0.42);
  /* the desk: warm open piano chords on 1 and 3 (the people beat) */
  for (let x = Math.ceil(S.desk / 2 - 1e-9) * 2; x < S.cta - 1e-6; x += 2) {
    const c = chordAt(x);
    putPiano(keys, x, c.root + 12, 0.42, -0.1, { dur: 1.9, seed: 2, g: 0.36 });
    c.notes.forEach((m, i) => putPiano(keys, x + 0.03 * i, m, 0.4, (i - 1.5) * 0.14, { dur: 1.8, seed: 3 + i, g: 0.26 }));
  }
}
const segAt = (seg, x) => seg.find((s) => x >= s.a - 1e-9 && x < s.e - 1e-9) ?? seg[seg.length - 1];

/* ═════════════════════════ REEL 2 "Booked after hours" — the night call ═════════════════════════ */
/**
 * ig2's arrangement (docs/ig/SCRIPT.md ig2 §4 "Sound"; PIPELINE.md §6.3), on the reel's own moments (MUSIC.ig2: check,
 * ten, booked, hangup, gate, cta — frames, re-timed with the voices). No bed under the hook: the ring is the opener.
 *   HARMONY  E under the greeting (a B–E ostinato) → C#m7 on the availability check → Amaj7 → E on "Ten it is." → Amaj7
 *            → B ON "booked," (the lift A → B) → E ON THE HANG-UP (the call resolved: the cards' cascade) → C#m7 under the
 *            gate line → Amaj7 under the CTA → B for the roll → E on the logo
 *   CALL     a muted felt-piano ostinato, B–E 8ths, with the sub on each bar's one (ducked under her); a brushed 16th
 *            shaker from the check; a light felt kick on 1 and 3 from "Ten" (the booking coming together)
 *   BOOKED   the ostinato opens (unmuted, an octave up); a bright B chord on "booked,"
 *   CASCADE  the strings swell in under the cards; the kit stops
 *   GATE     thins: soft open piano chords on 1 and 3, a low string pad
 *   CTA      the ostinato and an 8th shaker back, the strings crescendo through the last bars into the shared build
 */
function ig2Harmony(put, P, fb, M) {
  const m = M.ig2;
  const b6 = Math.floor(fb(m.check) / 4 + 1e-9) * 4; // the check's bar
  const booked = fb(m.booked);
  const hang = fb(m.hangup);
  const gateBar = Math.ceil(fb(m.gate) / 4 - 1e-9) * 4;
  put(P.from, b6, 'E');
  put(b6, b6 + 4, 'Csm7');
  put(b6 + 4, b6 + 8, 'Amaj7');
  put(b6 + 8, b6 + 12, 'E');
  put(b6 + 12, booked, 'Amaj7');
  put(booked, hang, 'B');
  put(hang, gateBar, 'E');
  put(gateBar, gateBar + 4, 'Csm7');
  put(gateBar + 4, P.roll, 'Amaj7');
  put(P.roll, P.impact, 'B');
  put(P.impact, fb(M.end) + 4, 'Efin');
}

function ig2Parts({ P, fb, M, seg, CH, chordAt, sec, LEN, out, keys, drums, bass, putPiano, feltKick, shaker }) {
  const m = M.ig2;
  const S = { check: fb(m.check), ten: fb(m.ten), booked: fb(m.booked), hang: fb(m.hangup), gate: fb(m.gate), cta: fb(m.cta) };
  const gateBar = Math.ceil(S.gate / 4 - 1e-9) * 4;
  /* the ostinato: B–E 8ths (the chord's 2nd and 3rd tones, a 4th on the off-beats), muted and low through the call,
   * open an octave up after "booked,"; out under the cards' cascade and the gate (piano chords there) */
  const FIG = [1, 2, 1, 2, 1, 3, 1, 2];
  for (let x = Math.ceil(P.from * 2 - 1e-9) / 2; x < P.impact - 1e-6; x += 0.5) {
    if (x >= S.hang - 1e-6 && x < S.cta - 1e-6) continue;
    const n = chordAt(x).notes;
    const pos = Math.round(x * 2) % 8;
    const open = x >= S.booked - 1e-6;
    const v = (open ? 0.42 : 0.34) * (pos % 2 === 0 ? 1 : 0.8) * (pos === 0 ? 1.1 : 1);
    putPiano(keys, x, n[FIG[pos] % n.length] + (open ? 12 : 0), v, pos % 2 ? 0.22 : -0.22, { dur: open ? 0.75 : 0.5, mute: open ? 0.2 : 0.6, seed: pos % 3, g: open ? 0.26 : 0.32 });
  }
  /* the sub on each bar's one (and on every chord change), short — the call's pulse */
  for (const s of seg) {
    if (s.a >= P.impact - 1e-6) continue;
    for (let x = s.a; x < s.e - 1e-6; x = Math.floor(x / 4 + 1e-9) * 4 + 4) {
      if (x >= S.hang - 1e-6 && x < S.cta - 1e-6) continue;
      subNote(bass, sec(x), sec(Math.min(0.9, s.e - x)) - 0.02, CH[s.c].root - 12 + (CH[s.c].root < 43 ? 12 : 0), 0.13, { att: 0.02, rel: 0.2 });
    }
  }
  /* the brushed shaker: 16ths from the availability check to the hang-up; 8ths again from the CTA */
  for (let x = Math.ceil(S.check * 4 - 1e-9) / 4; x < S.hang - 1e-6; x += 0.25) {
    const pos = Math.round(x * 4) % 4;
    shaker(drums, x, pos === 0 ? 0.05 : pos === 2 ? 0.042 : 0.03, pos + 4, 0.2);
  }
  for (let x = Math.ceil(S.cta * 2 - 1e-9) / 2; x < P.roll - 1e-6; x += 0.5) shaker(drums, x, (Math.round(x * 2) % 2 ? 0.06 : 0.045), Math.round(x * 2) % 8);
  /* a light felt kick on 1 and 3 from "Ten it is." to the hang-up (the booking coming together) */
  for (let x = Math.ceil(S.ten / 2 - 1e-9) * 2; x < S.hang - 1e-6; x += 2) feltKick(drums, x, 0.36);
  /* "booked,": a bright, open B chord under the mallet */
  {
    const c = CH.B;
    c.notes.forEach((n, i) => putPiano(keys, S.booked + 0.02 * i, n + 12, 0.5, (i - 1.5) * 0.16, { dur: 1.6, seed: 6 + i, g: 0.2 }));
  }
  /* the gate: soft open piano chords on 1 and 3 (it thins under the line) */
  for (let x = Math.ceil(S.gate / 2 - 1e-9) * 2; x < S.cta - 1e-6; x += 2) {
    const c = chordAt(x);
    c.notes.forEach((n, i) => putPiano(keys, x + 0.025 * i, n, 0.36, (i - 1.5) * 0.14, { dur: 1.7, seed: 3 + i, g: 0.2 }));
  }
  /* the strings: a low pad from "Ten"; the SWELL under the cards' cascade (from the hang-up), thinning under the gate
   * line; the build's crescendo from the CTA into the impact */
  {
    const spans = [];
    for (const s of seg) {
      if (s.a >= P.impact - 1e-6) continue;
      for (const [x0, x1, oct, g] of [
        [Math.max(s.a, S.ten), Math.min(s.e, S.hang), 0, 0.1],
        [Math.max(s.a, S.hang), Math.min(s.e, gateBar), 12, 0.34],
        [Math.max(s.a, gateBar), Math.min(s.e, S.cta), 0, 0.12],
      ]) {
        if (x1 <= x0 + 1e-6) continue;
        for (const n of CH[s.c].str) spans.push([sec(x0) - 0.03, sec(x1), n + oct, g]);
      }
    }
    addStereo(out, stringSection(LEN, spans, { att: 0.35, rel: 0.7, cut: 2600, seed: 2 }), 0, 1);
    const sw = [];
    const a0 = Math.min(S.cta, P.impact - 6);
    for (let x = a0; x < P.impact - 1e-6; x += 1) for (const n of chordAt(x).str) sw.push([sec(x) - 0.02, sec(Math.min(P.impact, x + 1)), n, 0.12 + 0.5 * ((x - a0) / (P.impact - a0)) ** 1.5]);
    addStereo(out, stringSection(LEN, sw, { att: 0.25, rel: 0.2, cut: 3000, seed: 4 }), 0, 1);
  }
}

/** the reels' own arrangements (harmony + parts), by REEL; a reel without one plays the stub */
const ARRANGEMENTS = { ig1: { harmony: ig1Harmony, parts: ig1Parts }, ig2: { harmony: ig2Harmony, parts: ig2Parts } };

/* ═════════════════════════ REEL 3 "Twelve minutes" — the colour timer ═════════════════════════ */
/**
 * ig3's arrangement (docs/ig/SCRIPT.md ig3 §4 "Sound"; PIPELINE.md §6.3), on the reel's own moments (MUSIC.ig3: pickup,
 * walkIn, hangup, cta — frames, re-timed with the voices). The timer's tick is the rhythm: it is on the cue sheet (a dry
 * tick on every real second, 8ths under the time-lapse, 16ths into the hang-up, dead on it), so the bed only holds the
 * harmony round it.
 *   HARMONY  E under the hook (a low pedal: the held breath) → E – C#m7 – Amaj7 – B by bar from the pickup (the call),
 *            B held into the hang-up → E ON THE HANG-UP (timer's done) → C#m7 → Amaj7 under the CTA → B for the roll →
 *            E on the logo
 *   HOOK     a low E pedal (sub + low strings, very quiet) and muted felt-piano B–E dyads on the ticks (every 2 beats),
 *            the dyad leaning to A–E then B–F# in the last bar before the pickup (the dilemma)
 *   CALL     a muted felt-piano ostinato in 8ths over the chords (ducked under her), the sub on each bar's one, a low
 *            string pad; from "walk-in" the ostinato's off-beats brighten (the answer coming together)
 *   PAYOFF   the bed OPENS: a high piano line (E-major pentatonic) over open strings an octave up, no ostinato, no sub
 *   CTA      the ostinato back with an 8th shaker, the strings crescendo into the shared build
 */
function ig3Harmony(put, P, fb, M) {
  const m = M.ig3;
  const pk = fb(m.pickup);
  const hang = fb(m.hangup);
  const ctaBar = Math.floor(fb(m.cta) / 4 + 1e-9) * 4;
  put(P.from, pk, 'E');
  put(pk, pk + 4, 'E');
  put(pk + 4, pk + 8, 'Csm7');
  put(pk + 8, pk + 12, 'Amaj7');
  put(pk + 12, hang, 'B');
  put(hang, Math.max(hang + 3, ctaBar - 4), 'E');
  put(Math.max(hang + 3, ctaBar - 4), ctaBar, 'Csm7');
  put(ctaBar, P.roll, 'Amaj7');
  put(P.roll, P.impact, 'B');
  put(P.impact, fb(M.end) + 4, 'Efin');
}

function ig3Parts({ P, fb, M, seg, CH, chordAt, sec, LEN, out, keys, drums, bass, putPiano, shaker }) {
  const m = M.ig3;
  const S = { pick: fb(m.pickup), walk: fb(m.walkIn), hang: fb(m.hangup), cta: fb(m.cta) };
  /* the hook: the low E pedal and B–E dyads on the ticks (beats 1 and 3), leaning to A–E, then B–F# before the pickup */
  subNote(bass, sec(P.from), sec(S.pick - P.from) - 0.05, 28, 0.07, { att: 0.6, rel: 0.4 });
  for (let x = Math.ceil(P.from / 2 - 1e-9) * 2; x < S.pick - 1e-6; x += 2) {
    const last = S.pick - x <= 4 + 1e-6;
    const dy = last ? (S.pick - x <= 2 + 1e-6 ? [59, 66] : [57, 64]) : [59, 64];
    const v = 0.3 + (Math.round(x) % 4 === 0 ? 0.05 : 0);
    dy.forEach((n, i) => putPiano(keys, x + 0.012 * i, n, v, i ? 0.12 : -0.12, { dur: 1.5, mute: 0.5, seed: 4 + i, g: 0.32 }));
  }
  /* the call: the muted ostinato in 8ths over the chords (its off-beats a touch brighter from "walk-in"), the sub on
   * each bar's one; out from the hang-up until the CTA (the payoff's own line there) */
  const FIG = [0, 2, 1, 3, 0, 2, 1, 2];
  const osti = (x) => (x >= S.pick - 1e-6 && x < S.hang - 1e-6) || x >= S.cta - 1e-6;
  for (let x = Math.ceil(S.pick * 2 - 1e-9) / 2; x < P.impact - 1e-6; x += 0.5) {
    if (!osti(x)) continue;
    const n = chordAt(x).notes;
    const pos = Math.round(x * 2) % 8;
    const lit = x >= S.walk - 1e-6 && pos % 2 === 1 ? 1.12 : 1;
    const v = 0.34 * (pos % 2 === 0 ? 1 : 0.8) * (pos === 0 ? 1.1 : 1) * lit;
    putPiano(keys, x, n[FIG[pos] % n.length], v, pos % 2 ? 0.2 : -0.2, { dur: 0.55, mute: 0.58, seed: pos % 3, g: 0.3 });
    if (x >= S.cta - 1e-6 && x < P.roll - 1e-6) shaker(drums, x, pos % 2 ? 0.06 : 0.045, pos);
  }
  for (const sg of seg) {
    if (sg.a >= P.impact - 1e-6 || sg.e <= S.pick + 1e-6) continue;
    for (let x = Math.max(sg.a, S.pick); x < sg.e - 1e-6; x = Math.floor(x / 4 + 1e-9) * 4 + 4) {
      if (!osti(x)) continue;
      subNote(bass, sec(x), sec(Math.min(1.2, sg.e - x)) - 0.02, CH[sg.c].root - 12 + (CH[sg.c].root < 43 ? 12 : 0), 0.12, { att: 0.02, rel: 0.25 });
    }
  }
  /* the payoff: the bed OPENS — a high piano line, E-major pentatonic, over the E and the C#m7 */
  {
    const LINE = [
      [0, 83, 0.5], [0.5, 80, 0.42], [1, 76, 0.44], [2, 78, 0.4], [2.5, 80, 0.42], [3, 83, 0.46],
      [4, 85, 0.44], [4.5, 83, 0.4], [5, 80, 0.42], [6, 78, 0.38], [6.5, 76, 0.36],
    ];
    for (const [dx, n, v] of LINE) {
      const x = S.hang + dx;
      if (x >= S.cta - 1e-6) break;
      putPiano(keys, x, n, v, 0.18, { dur: 1.4, seed: 6, g: 0.26 });
    }
    // the open chord under the hang-up's mallet: E, rolled, warm
    CH.E.notes.forEach((n, i) => putPiano(keys, S.hang + 0.02 * i, n, 0.36, (i - 1.5) * 0.14, { dur: 2.4, seed: 3 + i, g: 0.2 }));
  }
  /* the strings: a low pad under the hook (the pedal) and the call; OPEN AN OCTAVE at the payoff; the build's
   * crescendo from the CTA into the impact */
  {
    const spans = [];
    for (const sg of seg) {
      if (sg.a >= P.impact - 1e-6) continue;
      for (const [x0, x1, oct, g] of [
        [Math.max(sg.a, P.from), Math.min(sg.e, S.pick), -12, 0.08],
        [Math.max(sg.a, S.pick), Math.min(sg.e, S.hang), 0, 0.12],
        [Math.max(sg.a, S.hang), Math.min(sg.e, S.cta), 12, 0.22],
      ]) {
        if (x1 <= x0 + 1e-6) continue;
        for (const n of CH[sg.c].str) spans.push([sec(x0) - 0.03, sec(x1), n + oct + (n + oct < 40 ? 12 : 0), g]);
      }
    }
    addStereo(out, stringSection(LEN, spans, { att: 0.4, rel: 0.7, cut: 2600, seed: 5 }), 0, 1);
    const sw = [];
    const a0 = Math.min(S.cta, P.impact - 6);
    for (let x = a0; x < P.impact - 1e-6; x += 1) for (const n of chordAt(x).str) sw.push([sec(x) - 0.02, sec(Math.min(P.impact, x + 1)), n, 0.12 + 0.5 * ((x - a0) / (P.impact - a0)) ** 1.5]);
    addStereo(out, stringSection(LEN, sw, { att: 0.25, rel: 0.2, cut: 3000, seed: 6 }), 0, 1);
  }
}
ARRANGEMENTS.ig3 = { harmony: ig3Harmony, parts: ig3Parts };

/* ═════════════════════════ REEL 4 "Can you trip it up?" — the challenge ═════════════════════════ */
/**
 * ig4's arrangement (docs/ig/SCRIPT.md ig4 §4 "Sound"; PIPELINE.md §6.3 "pluck call-and-response riff with soft kick and
 * rim → chord building on the landings → hard stop on the sample at the stop-time → warm pad under the fallback → bed
 * returns on "says so" → build"), on the reel's own moments (MUSIC.ig4: the rings, the landings, the answer, "eighty-
 * five", the curveball, "says", "so", the CTA — frames, re-timed with the voices; MUSIC.stop is the stop-time).
 *   HARMONY  E under the hook → C#m7 – Amaj7 – B by bar through the three phrasings (the question rising) → E for the
 *            answer (her "eighty-five" lands on it, under the mallet) → C#m7 – F#m11 under the curveball (darker, a
 *            crescendo) → THE STOP (MUSIC.stop: the bed and its tails cut on the sample, bed.mjs below) → Amaj9, the
 *            warm pad, under the fallback → Bsus under "Where your documents stop" → E ON "so" → Amaj7 under the CTA → B
 *            for the roll → E on the logo
 *   RIFF     a muted pluck call-and-response, one bar long: the CALL climbs the chord in 8ths on beats 1–2, the RESPONSE
 *            answers an octave down on 3 and 4 (pluck: the kit's additive pluck, copied — ig4Pluck); a soft felt kick on
 *            1 and 3, a rim on 2 and 4 (ig4Rim, new); the sub on each bar's one from the first ring
 *   LANDINGS each hairline's landing adds a held string voice — E4, G#4, B4 — the chord BUILDING under the phrasings,
 *            all three resolving into the answer's E
 *   CURVE    the kick drops out on the curveball's ring; the riff thins to its calls; low strings swell into the cut
 *   FALLBACK one warm pad (strings, slow bow): Amaj9, then Bsus under the thesis
 *   "so"     the bed RETURNS: an open E rolled on the felt piano, the riff, kick and rim back; the CTA adds an 8th shaker
 *            and the strings' crescendo into the shared build
 */
/** the kit's additive pluck (kitAt pluck, verbatim): exact pitch, harmonics decaying faster the higher they are */
function ig4Pluck(dst, sec, x, m, g, pan, bright = 0.6, tau = 0.5) {
  const len = Math.min(1.6, tau * 5);
  const f = mtof(m);
  const s = mono(len);
  for (let k = 1; k <= 8; k++) {
    if (f * k > 16000) break;
    const p = mode(len, f * k, Math.pow(k, -1.25) * (k === 1 ? 1 : bright), tau / Math.pow(k, 0.75), 0.0008);
    for (let i = 0; i < s.length; i++) s[i] += p[i];
  }
  addMono(dst, s, sec(x), g, pan);
}
/** a soft rim click: a woody knock (two short modes) and a breath of band-passed noise, 40 ms */
function ig4Rim(dst, sec, x, g, seed) {
  const len = 0.12;
  const s = mono(len);
  const body = mode(len, 410 + (seed % 3) * 9, 0.7, 0.018, 0.0004);
  const ring = mode(len, 1720, 0.35, 0.009, 0.0003);
  const n = noise(0.04, 8800 + seed, ad(0.0003, 0.008), 'bpn', 2600, 0.9);
  for (let i = 0; i < s.length; i++) s[i] = body[i] + ring[i] + (i < n.length ? n[i] * 0.5 : 0);
  addStereo(dst, spread(filt(s, ['hp', 180, 0.7]), 0.2, 8900 + seed), sec(x), g);
}

function ig4Harmony(put, P, fb, M) {
  const m = M.ig4;
  const so = fb(m.so);
  const ctaBar = Math.ceil(fb(m.cta) / 4 - 1e-9) * 4;
  put(P.from, 8, 'E');
  put(8, 12, 'Csm7');
  put(12, 16, 'Amaj7');
  put(16, 20, 'B');
  put(20, 24, 'E');
  put(24, 28, 'Csm7');
  put(28, P.stop[0], 'Fsm11');
  put(P.stop[0], 40, 'Amaj9');
  put(40, so, 'Bsus');
  put(so, ctaBar + 4, 'E');
  put(ctaBar + 4, P.roll, 'Amaj7');
  put(P.roll, P.impact, 'B');
  put(P.impact, fb(M.end) + 4, 'Efin');
}

function ig4Parts({ P, fb, M, seg, CH, chordAt, sec, LEN, out, keys, drums, bass, putPiano, feltKick, shaker }) {
  const m = M.ig4;
  const S = { r1: fb(m.rings[1]), answer: fb(m.answer), curve: fb(m.curve), stop: P.stop[0], resume: P.stop[1], says: fb(m.says), so: fb(m.so), cta: fb(m.cta) };
  const on = (x) => x < S.stop - 1e-6 || x >= S.so - 1e-6;
  /* the riff: CALL (beats 1–2, 8ths climbing the chord) and RESPONSE (beats 3–4, an octave down, quarters) */
  for (let x = Math.ceil(P.from * 2 - 1e-9) / 2; x < P.roll - 1e-6; x += 0.5) {
    if (!on(x)) continue;
    const c = chordAt(x);
    const n = [...c.notes].sort((a, b) => a - b);
    const pos = Math.round(x * 2) % 8;
    const thin = x >= S.curve - 1e-6 && x < S.stop;
    if (pos < 4) {
      const note = n[pos % n.length] + (n[0] < 60 ? 12 : 0);
      ig4Pluck(keys, sec, x, note, (pos === 0 ? 0.075 : 0.058) * (x < S.r1 ? 0.85 : 1), pos % 2 ? 0.24 : -0.08, 0.55, 0.28);
    } else if (!thin && (pos === 4 || pos === 6)) {
      const note = (pos === 4 ? n[2] : n[0]) + (n[0] < 60 ? 0 : -12);
      ig4Pluck(keys, sec, x, note, 0.06, -0.26, 0.42, 0.34);
    }
  }
  /* the kit: a soft felt kick on 1 and 3, a rim on 2 and 4 — not in the curveball (it holds its breath), back on "so" */
  for (let x = Math.ceil(P.from - 1e-9); x < P.roll - 1e-6; x += 1) {
    if (!on(x) || (x >= S.curve - 1e-6 && x < S.stop)) continue;
    const beat = Math.round(x) % 4;
    if (beat === 0 || beat === 2) feltKick(drums, x, beat === 0 ? 0.4 : 0.32);
    else ig4Rim(drums, sec, x, beat === 3 ? 0.07 : 0.06, Math.round(x));
  }
  /* the CTA's 8th shaker */
  for (let x = Math.ceil(S.cta * 2 - 1e-9) / 2; x < P.roll - 1e-6; x += 0.5) shaker(drums, x, Math.round(x * 2) % 2 ? 0.058 : 0.044, Math.round(x * 2) % 8);
  /* the sub on each bar's one (and every chord change) from the first ring; not through the stop or the pad */
  for (const sg of seg) {
    if (sg.a >= P.roll - 1e-6) continue;
    for (let x = Math.max(sg.a, S.r1); x < sg.e - 1e-6; x = Math.floor(x / 4 + 1e-9) * 4 + 4) {
      if (!on(x)) continue;
      subNote(bass, sec(x), sec(Math.min(1.1, sg.e - x, S.stop - x > 0 ? S.stop - x : 9)) - 0.03, CH[sg.c].root - 12 + (CH[sg.c].root < 43 ? 12 : 0), 0.12, { att: 0.02, rel: 0.2 });
    }
  }
  /* the strings: the landings' chord building (E4, G#4, B4 held into the answer's E), a low pad under the answer, the
   * curveball's swell INTO the cut, the warm pad under the fallback and the thesis, the CTA's crescendo */
  {
    const spans = [];
    m.lands.forEach((f, k) => spans.push([sec(fb(f)) - 0.02, sec(S.answer + 2), [64, 68, 71][k], 0.2]));
    for (const sg of seg) {
      for (const [x0, x1, oct, g] of [
        [Math.max(sg.a, S.answer), Math.min(sg.e, S.curve), 0, 0.1],
        [Math.max(sg.a, S.resume), Math.min(sg.e, S.so), 0, 0.26],
        [Math.max(sg.a, S.so), Math.min(sg.e, S.cta), 0, 0.12],
      ]) {
        if (x1 <= x0 + 1e-6) continue;
        for (const n of CH[sg.c].str) spans.push([sec(x0) - 0.03, sec(x1), n, g]);
      }
    }
    addStereo(out, stringSection(LEN, spans, { att: 0.7, rel: 0.6, cut: 2400, seed: 7 }), 0, 1);
    // the curveball's swell: low strings growing into the cut (they end ON it: the stop takes them)
    const sw = [];
    for (let x = S.curve; x < S.stop - 1e-6; x += 1) for (const n of chordAt(x).str) sw.push([sec(x) - 0.02, sec(Math.min(S.stop + 0.5, x + 1)), n - 12 + (n < 52 ? 12 : 0), 0.08 + 0.32 * ((x - S.curve) / (S.stop - S.curve)) ** 1.4]);
    addStereo(out, stringSection(LEN, sw, { att: 0.3, rel: 0.2, cut: 2200, seed: 8 }), 0, 1);
    // the CTA's crescendo into the build
    const cr = [];
    const a0 = Math.min(S.cta, P.impact - 6);
    for (let x = a0; x < P.impact - 1e-6; x += 1) for (const n of chordAt(x).str) cr.push([sec(x) - 0.02, sec(Math.min(P.impact, x + 1)), n, 0.12 + 0.5 * ((x - a0) / (P.impact - a0)) ** 1.5]);
    addStereo(out, stringSection(LEN, cr, { att: 0.25, rel: 0.2, cut: 3000, seed: 9 }), 0, 1);
  }
  /* "so": the bed returns — an open E rolled on the felt piano (the lift) */
  CH.E.notes.forEach((n, i) => putPiano(keys, S.so + 0.02 * i, n + (i > 1 ? 12 : 0), 0.46, (i - 1.5) * 0.15, { dur: 2.2, seed: 3 + i, g: 0.24 }));
  putPiano(keys, S.so, 40, 0.42, 0, { dur: 2.2, seed: 9, g: 0.26 });
}
ARRANGEMENTS.ig4 = { harmony: ig4Harmony, parts: ig4Parts };

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
  const ARR = ARRANGEMENTS[I.REEL];
  if (ARR) ARR.harmony(put, P, fb, M);
  else {
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
  const { putPiano, feltKick, kick, shaker, snare, crash, pluck, epiano } = kitAt(sec, kickTimes);

  /* ── ARRANGEMENT: the reel's own (ARRANGEMENTS), else the stub: felt-piano 8ths + a shaker, low strings, the sub ── */
  if (ARR) ARR.parts({ P, fb, M, seg, CH, chordAt, sec, LEN, out, keys, drums, bass, putPiano, feltKick, shaker });
  else {
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
  }

  /* ── the build: a half-bar snare roll (16ths → 32nds) and 8th kicks into the impact, 16th plucks ──
   * MUSIC.build (optional, a reel's own; every default is the stub's): kick / snare gain ×, where the kicks and the roll
   * stop (beats before the impact), the inhale's length (beats) and depth (dB) */
  const BLD = { kick: 1, snare: 1, kickEnd: 0.4, snareEnd: 0.3, inhale: 1, inhaleDb: -9, ...(M.build ?? {}) };
  for (let x = P.roll; x < P.impact - BLD.kickEnd; x += 0.5) kick(drums, x, (0.5 + 0.2 * ((x - P.roll) / (P.impact - P.roll))) * BLD.kick);
  for (let x = P.roll; x < P.impact - BLD.snareEnd; ) {
    const u = (x - P.roll) / (P.impact - P.roll);
    snare(drums, x, (0.16 + 0.38 * u * u) * BLD.snare, Math.round(x * 8));
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
    const i0 = Math.round(sec(P.impact - BLD.inhale) * SR);
    const i1 = Math.round(sec(P.impact) * SR);
    const back = Math.round(0.002 * SR);
    const dip = 1 - gain(BLD.inhaleDb);
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
