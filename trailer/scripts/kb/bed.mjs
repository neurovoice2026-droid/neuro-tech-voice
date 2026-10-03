/**
 * FILM 2's BED — a placeholder score: 120 BPM, E major, built from film 2's own timeline
 * (src/kb/timing.ts SCENES + MUSIC), so re-timed voices move the music with them. The real bed comes
 * in the build phase (docs/kb/PIPELINE.md §5); this one makes the mix musical, not silent.
 *
 *   PART I     from ring one: ONE bar of muted felt piano (B–E 8ths) with a soft shaker, the identical
 *              bar looping; a low felt pulse on 1 and 3 from the third ring; over the rolls the filter
 *              opens and it doubles to 16ths; at the HARD STOP the whole of it (hall included) is cut on
 *              the sample
 *   b06        silence: a low felt-piano E2 under "brilliant", a single high B5 on "Waiting." (unresolved)
 *   b07        the loop returns for one bar (deadpan); on "Some work matters." it stops and the harmony
 *              opens: E – C#m7 – Amaj7 – B, pad and a warm sub
 *   b08        felt-piano 8ths, a soft felt kick on 1 and 3, the same progression
 *   b09        the call: pad and piano, no kick
 *   b10        stop-time: the beat drops out, a sustained E add9 holds
 *   b11–b14    the groove returns on the resume; b12 thins to piano and pad; b14 lifts with a high line
 *   b15        the desk: one warm sustained pad (and a bar of near-nothing before vo-8)
 *   b16        fuller (pad + piano), a gentle lift into the dark
 *   CLOSE      the night: Amaj9 → F#m7 → Bsus under her line, the rings come back as a glass arpeggio
 *              (E6 G#6 B6 on 8ths), the converge builds (8th kicks, a snare roll, 16th plucks), inhales,
 *              and E lands ON the logo (piano + e-piano doubling the pad, a crash choked before the
 *              name); a halo of the four lights' notes from the button; the chord rings into the fade
 *
 * Instrument code copied from scripts/audio/bed.mjs (pad, felt kick, shaker, snare, crash, bass,
 * pluck, felt piano, e-piano, hall, glue, bus limiter): that file exports only bed(T), and editing it
 * would change film 1's bedKey and mix hash. Exports bed(T) → { st, points } and inputs(T) (its cache key).
 */
import {
  SR, TAU, stereo, mono, addMono, addStereo, osc, ad, mode, filt, noise, spread, fdn, compress, limit, mtof, smooth, rng,
  Saw, Biquad, lerp, gain,
} from '../audio/dsp.mjs';

/**
 * EVERYTHING the bed reads from the timeline — and the bed cache key (scripts/kb/generate-sfx.mjs keys
 * bed.wav on this object + the bytes of this file and dsp.mjs). bed() reads ONLY this object, so a new
 * input has to be added here, and then it is in the key too: a cached bed can never miss a change.
 */
export const inputs = (T) => ({
  BPM: T.BPM,
  BEAT: T.BEAT,
  DURATION: T.DURATION,
  MUSIC: T.MUSIC,
  SCENES: T.SCENES,
  rings: T.REPEAT_LOCAL.rings,
  vo9: T.CTA_LOCAL.vo9,
});

export function bed(T) {
  const I = inputs(T);
  const BEAT = 60 / I.BPM; // seconds per beat
  const fb = (frame) => frame / I.BEAT; // frames → beats
  const sec = (beat) => beat * BEAT;
  const half = (x) => Math.round(x * 2) / 2;
  const M = I.MUSIC;
  const S = I.SCENES;
  const END = I.DURATION / I.BEAT;
  const P = {
    ring: fb(M.ringOne),
    rolls: fb(M.rolls),
    ring3: fb(I.rings[2]),
    stop: fb(M.hardStop),
    brilliant: half(fb(M.brilliant)),
    waiting: fb(M.waiting),
    turn: fb(M.turn),
    matters: half(fb(M.matters)),
    written: fb(M.written),
    call: fb(M.call),
    freeze: fb(M.freeze),
    resume: fb(M.resume),
    line: fb(M.line),
    change: fb(M.change),
    ring14: fb(M.ring14),
    desk: fb(M.desk),
    vo8: half(fb(M.vo8)),
    cta: fb(M.cta),
    vo9: fb(S.cta.from + I.vo9),
    converge: fb(M.converge),
    impact: fb(M.impact),
    brand: fb(M.brand),
    button: fb(M.button),
  };
  const LEN = sec(END) + 3;
  const out = stereo(LEN);
  const partI = stereo(LEN);

  /* ── harmony ─────────────────────────────────────────────────── */
  const CH = {
    E: { root: 40, notes: [56, 59, 64, 66] }, // Eadd9
    Csm7: { root: 37, notes: [56, 59, 64, 71] }, // C#m7 (G#3 B3 E4 B4 over C#)
    Amaj7: { root: 45, notes: [57, 61, 64, 68] },
    B: { root: 47, notes: [59, 63, 66, 71] },
    Bsus: { root: 47, notes: [59, 64, 66, 71] },
    Eadd9: { root: 40, notes: [52, 59, 64, 66, 68] }, // the stop-time: E3 B3 E4 F#4 G#4, held
    Amaj9: { root: 45, notes: [57, 61, 64, 68, 71] },
    Fsm7: { root: 42, notes: [57, 61, 64, 69] },
    Efin: { root: 40, notes: [52, 59, 64, 68, 71, 78] }, // the resolution: E3 B3 E4 G#4 B4 F#5
  };
  const seg = [];
  const put = (a, e, c) => {
    if (e > a + 1e-6) seg.push({ a, e, c });
  };
  /** the progression from `a` to `e`, one chord per bar on the bar lines (the first runs to the next bar) */
  const PROG = ['E', 'Csm7', 'Amaj7', 'B'];
  let progI = 0;
  const prog = (a, e) => {
    let x = a;
    while (x < e - 1e-6) {
      let nx = Math.ceil((x + 1e-6) / 4) * 4;
      if (nx - x < 2 && nx + 4 <= e + 1e-6) nx += 4; // no chord shorter than two beats
      put(x, Math.min(nx, e), PROG[progI++ % 4]);
      x = Math.min(nx, e);
    }
  };
  prog(P.matters, P.freeze);
  put(P.freeze, P.resume, 'Eadd9');
  progI = 0;
  prog(P.resume, P.desk);
  put(P.desk, P.vo8, 'E');
  put(P.vo8, P.vo8 + Math.max(1, (P.cta - P.vo8) / 2), 'Amaj7');
  put(P.vo8 + Math.max(1, (P.cta - P.vo8) / 2), P.cta, 'Bsus');
  {
    const mid = Math.min(P.cta + 4, P.converge - 2);
    put(P.cta, mid, 'Amaj9');
    put(mid, P.converge, 'Fsm7');
  }
  put(P.converge, P.impact - 1, 'Bsus');
  put(P.impact - 1, P.impact, 'B');
  put(P.impact, END + 4, 'Efin');
  const chordAt = (x) => CH[(seg.find((s) => x >= s.a && x < s.e) ?? seg[seg.length - 1]).c];
  const inR = (x, a, e) => x >= a && x < e;

  /* ── automation (beats) ── */
  const padGain = (x) => {
    if (x < P.freeze) return 0.5;
    if (x < P.resume) return 0.42; // the held E add9
    if (x < P.line) return 0.5;
    if (x < P.change) return 0.38; // b12 thins
    if (x < P.desk) return 0.48;
    if (x < P.vo8) return 0.36; // the desk: one warm pad
    if (x < P.cta) return lerp(0.4, 0.6, smooth((x - P.vo8) / Math.max(1, P.cta - P.vo8)));
    if (x < P.impact) return lerp(0.3, 0.8, smooth((x - P.cta) / (P.impact - P.cta)));
    return 0.42 + 0.5 * Math.exp(-(x - P.impact) / 2.2);
  };
  const padCut = (x) => {
    if (x < P.freeze) return 1500;
    if (x < P.resume) return 1100;
    if (x < P.desk) return 1700;
    if (x < P.vo8) return 900;
    if (x < P.cta) return 2200;
    if (x < P.impact) return 900 + 3800 * Math.pow(smooth((x - P.cta) / (P.impact - P.cta)), 1.6);
    return 1300 + 4000 * Math.exp(-(x - P.impact) / 2.5);
  };

  /* ── PAD: three detuned band-limited saws per note, crossfaded per chord ── */
  {
    const pl = mono(LEN);
    const pr = mono(LEN);
    const r = rng(201);
    for (const s of seg) {
      const t0 = sec(s.a) - 0.06;
      const t1 = sec(s.e) + 0.45;
      const att = s.a === P.impact ? 0.004 : s.c === 'Eadd9' ? 0.6 : 0.3;
      const i0 = Math.max(0, Math.round(t0 * SR));
      const i1 = Math.min(pl.length, Math.round(t1 * SR));
      CH[s.c].notes.forEach((m, v) => {
        for (const det of [-0.11, 0, 0.1]) {
          const saw = new Saw(r());
          const f = mtof(m + det);
          const side = det < 0 ? -1 : det > 0 ? 1 : v % 2 ? 0.4 : -0.4;
          const gl = 0.5 - side * 0.35;
          const gr = 0.5 + side * 0.35;
          for (let i = i0; i < i1; i++) {
            const t = i / SR;
            const fade = Math.min(1, (t - t0) / att, (t1 - t) / 0.45);
            const x = saw.run(f) * fade * 0.05;
            pl[i] += x * gl;
            pr[i] += x * gr;
          }
        }
      });
    }
    const f = [0, 1, 2, 3].map(() => new Biquad('lp', 600, 0.7));
    for (let i = 0; i < pl.length; i++) {
      const x = i / SR / BEAT;
      if ((i & 63) === 0) {
        const c = padCut(x) * (1 + 0.06 * Math.sin(TAU * 0.11 * (i / SR)));
        f[0].set(c, 0.6);
        f[1].set(c * 1.4, 0.55);
        f[2].set(c * 1.03, 0.6);
        f[3].set(c * 1.45, 0.55);
      }
      const g = padGain(x);
      out[0][i] += f[1].run(f[0].run(pl[i])) * g;
      out[1][i] += f[3].run(f[2].run(pr[i])) * g;
    }
  }

  /* ── instruments (copied from scripts/audio/bed.mjs) ── */
  const kickTimes = [];
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
  /** a soft shaker / closed hat */
  const shaker = (dst, x, g, seed, bright = 0) => {
    const h = noise(0.07, 7100 + seed, ad(0.002, 0.014 + 0.004 * bright), 'bpn', 6500 + 3000 * bright, 0.9);
    addMono(dst, h, sec(x), g, ((seed * 7) % 5) / 10 - 0.2);
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
  const bassNote = (dst, x, dur, m, g, bright = 0.2) => {
    const len = sec(dur) + 0.3;
    const f = mtof(m);
    const a = (t) => Math.min(1, t / 0.006) * (t < sec(dur) ? Math.exp(-t / Math.max(0.25, sec(dur))) : Math.exp(-sec(dur) / Math.max(0.25, sec(dur))) * Math.exp(-(t - sec(dur)) / 0.05));
    const s = osc(len, f, a);
    const h = osc(len, 2 * f, a);
    for (let i = 0; i < s.length; i++) s[i] = Math.tanh((s[i] + h[i] * bright) * 1.4) * 0.8;
    addMono(dst, s, sec(x), g, 0);
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
  /** felt piano: slightly stretched partials, a soft hammer; `mute` shortens it (the Part I loop) */
  const piano = (dst, x, m, g, pan, mute = 1, seed = 0) => {
    const len = 2.6 * mute + 0.2;
    const f = mtof(m);
    const s = mono(len);
    for (let k = 1; k <= 7; k++) {
      const fk = f * k * Math.sqrt(1 + 0.00035 * k * k);
      if (fk > 12000) break;
      const p = mode(len, fk, Math.pow(k, -1.6), (1.9 * mute) / Math.pow(k, 0.8), 0.004);
      for (let i = 0; i < s.length; i++) s[i] += p[i];
    }
    const h = noise(0.05, 8200 + seed + m, ad(0.001, 0.008), 'lp', 1400, 0.7);
    for (let i = 0; i < h.length; i++) s[i] += h[i] * 0.2;
    addMono(dst, filt(s, ['lp', mute < 1 ? 1800 : 3200, 0.6]), sec(x), g, pan);
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

  /* ── PART I: the loop (one bar, identical every time), cut on the sample at the hard stop ── */
  {
    const loopBar = (dst, b0, until, sixteenths = false, open = 0) => {
      for (let j = 0; j < (sixteenths ? 16 : 8); j++) {
        const x = b0 + j * (sixteenths ? 0.25 : 0.5);
        if (x >= until - 1e-6) break;
        const k = sixteenths ? j >> 1 : j;
        // B3 – E4 8ths (the B on the beats), muted felt; the same seeds every bar: the identical bar
        piano(dst, x, k % 2 ? 64 : 59, (k % 2 ? 0.085 : 0.1) * (sixteenths && j % 2 ? 0.7 : 1), k % 2 ? 0.2 : -0.2, 0.32 + 0.25 * open, j);
        shaker(dst, x, (j % 2 ? 0.05 : 0.07) * (sixteenths ? 0.8 : 1), j, open);
      }
    };
    for (let x = P.ring; x < P.stop - 1e-6; x += 4) {
      const rolling = x + 4 > P.rolls;
      loopBar(partI, x, Math.min(P.rolls, P.stop));
      if (rolling) loopBar(partI, Math.max(x, P.rolls - ((P.rolls - x) % 0.25)), P.stop, true, 1);
    }
    // b04: a low pulse on 1 and 3 from the third ring
    for (let x = Math.ceil(P.ring3 / 2) * 2; x < P.stop - 1e-6; x += 2) feltKick(partI, x, 0.32);
    const hall = fdn(partI, { rt60: 1.4, rt60Hi: 0.6, pre: 0.012, size: 0.8, hp: 220, lp: 7000, tail: 0 });
    // THE HARD STOP: the loop AND its hall end on the sample (a 1 ms fade so it never clicks)
    const cut = Math.round(sec(P.stop) * SR);
    const ramp = Math.round(0.001 * SR);
    for (let c = 0; c < 2; c++) {
      for (let i = 0; i < partI[c].length; i++) {
        const g = i < cut - ramp ? 1 : i >= cut ? 0 : (cut - i) / ramp;
        partI[c][i] = (partI[c][i] + hall[c][i] * 0.25) * g;
      }
    }
  }

  /* ── the rest of the film ── */
  const drums = stereo(LEN);
  const keys = stereo(LEN);
  const bass = stereo(LEN);
  // b06: E2 under "brilliant", one high B5 on "Waiting." that does not resolve
  piano(keys, P.brilliant, 40, 0.16, 0);
  piano(keys, P.waiting, 83, 0.05, 0.25);
  // b07: the Part I loop returns for one bar under "Some work repeats." (deadpan) …
  for (let j = 0; j < 8; j++) {
    const x = P.turn + j * 0.5;
    if (x >= P.matters - 1e-6) break;
    piano(keys, x, j % 2 ? 64 : 59, j % 2 ? 0.085 : 0.1, j % 2 ? 0.2 : -0.2, 0.32, j);
  }
  // … and the harmony opens: a warm sub on the roots under the pad
  for (const s of seg.filter((x) => x.a >= P.matters && x.a < P.desk && !inR(x.a, P.freeze, P.resume))) {
    bassNote(bass, s.a, s.e - s.a, CH[s.c].root, 0.22, 0.08);
  }
  // b08 (and the groove after the resume): felt-piano 8ths from the chord, a felt kick on 1 and 3
  const groove = (a, e, kickG, pianoG) => {
    for (let x = Math.ceil(a * 2) / 2, i = 0; x < e - 1e-6; x += 0.5, i++) {
      const n = chordAt(x).notes;
      piano(keys, x, n[i % n.length] + 12, pianoG * (x % 1 === 0 ? 1 : 0.75), i % 2 ? 0.25 : -0.25, 0.8, i);
      if (kickG > 0 && x % 2 === 0) feltKick(drums, x, kickG);
    }
  };
  groove(P.written, P.call, 0.36, 0.06);
  // b09: the call — pad and a sparse piano, no kick
  for (let x = Math.ceil(P.call), i = 0; x < P.freeze - 1e-6; x += 2, i++) {
    const n = chordAt(x).notes;
    piano(keys, x, n[i % n.length] + 12, 0.05, i % 2 ? 0.2 : -0.2);
  }
  // b10: stop-time — the E add9 struck once, soft, and held by the pad
  chordAt(P.freeze + 0.01).notes.forEach((m, i) => piano(keys, P.freeze + i * 0.02, m + 12, 0.045, (i - 2) * 0.2));
  // b11: the groove returns on the beat
  groove(P.resume, P.line, 0.34, 0.055);
  // b12: thins to piano and pad (a note every two beats)
  for (let x = Math.ceil(P.line), i = 0; x < P.change - 1e-6; x += 2, i++) {
    const n = chordAt(x).notes;
    piano(keys, x, n[i % n.length] + 12, 0.05, i % 2 ? 0.25 : -0.25);
  }
  // b13–b14: the groove; from the next call a high piano line lifts it
  groove(P.change, P.desk, 0.3, 0.05);
  for (let x = Math.ceil(P.ring14), i = 0; x < P.desk - 1e-6; x += 1, i++) {
    const n = chordAt(x).notes;
    piano(keys, x, n[n.length - 1 - (i % 2)] + 24, 0.035, i % 2 ? 0.35 : -0.35);
  }
  // b16: fuller — piano 8ths over the pad, rising into the dark
  for (let x = P.vo8, i = 0; x < P.cta - 1e-6; x += 0.5, i++) {
    const n = chordAt(x).notes;
    const u = (x - P.vo8) / Math.max(1, P.cta - P.vo8);
    piano(keys, x, n[i % n.length] + 12, 0.04 + 0.03 * u, i % 2 ? 0.25 : -0.25, 0.8, i);
  }
  // THE CLOSE: under her line the rings come back as music — E6 G#6 B6, a glass arpeggio on 8ths
  for (let x = Math.ceil(P.vo9 * 2) / 2, i = 0; x < P.converge - 1e-6; x += 0.5, i++) {
    pluck(keys, x, [88, 92, 95][i % 3], 0.03, i % 2 ? 0.35 : -0.35, 0.35, 0.6);
  }
  // the converge: 8th kicks, a snare roll 16ths → 32nds, 16th plucks; everything inhales into the hit
  for (let x = P.converge; x < P.impact - 0.4; x += 0.5) kick(drums, x, 0.55 + 0.2 * ((x - P.converge) / (P.impact - P.converge)));
  for (let x = P.converge; x < P.impact - 0.3; ) {
    const u = (x - P.converge) / (P.impact - P.converge);
    snare(drums, x, 0.18 + 0.4 * u * u, Math.round(x * 8));
    x += u < 0.5 ? 0.25 : 0.125;
  }
  for (let x = P.converge, i = 0; x < P.impact - 0.01; x += 0.25, i++) {
    const n = chordAt(x).notes;
    pluck(keys, x, n[i % n.length] + 12, 0.03 + 0.04 * ((x - P.converge) / (P.impact - P.converge)), i % 2 ? 0.3 : -0.3, 0.6, 0.3);
  }
  for (const s of seg.filter((x) => x.a >= P.cta && x.a < P.impact)) bassNote(bass, s.a, s.e - s.a, CH[s.c].root, 0.2 + 0.15 * ((s.a - P.cta) / (P.impact - P.cta)), 0.1);
  // E ON the logo: the crash (choked 50 ms before the name), a long low E, piano + e-piano doubling the pad
  crash(drums, P.impact, 0.5, 3, 1.6, Math.max(0.1, sec(P.brand - P.impact) - 0.05));
  kick(drums, P.impact, 0.8);
  bassNote(bass, P.impact, END - P.impact, 28, 0.42, 0.18);
  CH.Efin.notes.forEach((m, i) => {
    epiano(keys, P.impact + i * 0.008, m + 12, 0.07, (i - 2.5) * 0.18);
    piano(keys, P.impact + i * 0.012, m, 0.07, (i - 2.5) * 0.15);
  });
  // the end card: a halo of the four lights' notes (E5 G#5 B5 E6) breathes in from the button, held
  {
    const a = sec(P.button);
    const len = sec(END) + 0.5 - a;
    [[76, 0.05, -0.35, 0.13], [80, 0.035, 0.35, 0.17], [83, 0.04, -0.1, 0.11], [88, 0.022, 0.15, 0.19]].forEach(([m, g, pan, lfo], i) => {
      const f = mtof(m);
      const sig = osc(len, (t) => f * (1 + 0.0012 * Math.sin(TAU * lfo * t + i)), (t) => smooth(Math.min(1, t / 2.2)) * (0.85 + 0.15 * Math.sin(TAU * lfo * 0.7 * t + i * 2)));
      addMono(keys, sig, a, g, pan);
    });
  }

  /* ── a gentle sidechain pump under the kicks (pad + bass + keys) ── */
  const pump = new Float32Array(out[0].length).fill(1);
  for (const t of kickTimes) {
    if (t < sec(P.stop)) continue; // Part I's own bus is not pumped
    const depth = t >= sec(P.converge) ? 0.3 : 0.18;
    const i0 = Math.round(t * SR);
    for (let i = 0; i < 0.3 * SR && i0 + i < pump.length; i++) {
      const u = i / SR;
      pump[i0 + i] = Math.min(pump[i0 + i], 1 - depth * (u < 0.004 ? u / 0.004 : Math.exp(-(u - 0.004) / 0.08)));
    }
  }
  for (let c = 0; c < 2; c++) for (let i = 0; i < out[c].length; i++) out[c][i] = (out[c][i] + keys[c][i] * 0.9 + bass[c][i]) * pump[i] + drums[c][i];
  // (the pad and its hall stay out of Part I: the main bus is silent until the hard stop's aftermath)
  for (let c = 0; c < 2; c++) for (let i = 0; i < Math.min(out[c].length, Math.round(sec(P.stop) * SR)); i++) out[c][i] = 0;

  /* ── space, glue, the inhale, density ── */
  const hall = fdn(out, { rt60: 2.4, rt60Hi: 0.9, pre: 0.022, size: 1.2, hp: 200, lp: 7000, tail: 0 });
  for (let c = 0; c < 2; c++) for (let i = 0; i < out[c].length; i++) out[c][i] += hall[c][i] * 0.32 + partI[c][i];
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
  {
    let p = 0;
    for (const c of glued) for (let i = 0; i < c.length; i++) p = Math.max(p, Math.abs(c[i]));
    const k = p > 0 ? Math.pow(10, 3.5 / 20) / p : 1;
    for (const c of glued) for (let i = 0; i < c.length; i++) c[i] *= k;
  }
  const lim = limit(glued, { ceilingDb: -0.5, look: 0.004, rel: 0.09, relSlow: 0.3 });
  return { st: [lim[0], lim[1]], points: P, segments: seg };
}
