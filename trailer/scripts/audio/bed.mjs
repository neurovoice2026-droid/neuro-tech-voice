/**
 * THE BED — a 120 BPM piece in E major, built from the film's own timeline.
 *
 * Every section boundary, chord change and build is read from src/timing.ts, so
 * a regenerated voice that moves the scenes moves the music with them. The four
 * lights' notes (E G# B E′) are the key's arpeggio; the progression resolves to
 * E ON the logo impact.
 *
 *   HOOK       C#m9 (the relative minor: night, closed) — a drone and a dark pad
 *   TWIST      A → Bsus → B: the pad opens, hats creep in, a reverse cymbal into the call
 *   CALL       E · B/D# · C#m · A — soft kick on 1 & 3, 8th hats, a sub on the roots,
 *              a quiet plucked arp; the BOOKED moment lifts to E
 *   RESULT     half-time: Amaj7 under "Asleep.", E (+ an e-piano chord) on "Booked.", Bsus into white
 *   KNOWLEDGE  the hush: felt piano and pad, no drums; THE MISS drains to a near-silent
 *              F#m7; Ava's answer brings it back; "it says so." resolves to E
 *   SCALE      the full groove: four on the floor, claps, 16th arp, a pumping bass
 *   CTA        drops out into the dark, builds under Ava (A maj9 → F#m7 → Bsus → B),
 *              a snare roll into the impact, and E — with a crash — ON the logo
 */
import {
  SR, TAU, stereo, mono, addMono, addStereo, osc, white, pink, env, ad, mode, filt, sweep, noise, spread,
  fdn, compress, limit, mtof, smooth, rng, clamp, Saw, Biquad, lerp,
} from './dsp.mjs';

export function bed(T) {
  const BEAT = 60 / T.BPM; // seconds per beat
  const fb = (frame) => frame / T.BEAT; // frames → beats
  const sec = (beat) => beat * BEAT;
  const half = (b) => Math.round(b * 2) / 2;
  const S = T.SCENES;
  const K = T.KNOWLEDGE;
  const END = T.DURATION / T.BEAT;
  const P = {
    freeze: fb(T.HOOK.freeze),
    shatter: fb(S.twist.from),
    call: fb(S.call.from),
    booked: Math.ceil(fb(S.call.from + T.CALL.bookedMark) * 2) / 2,
    result: fb(S.result.from),
    split: fb(S.result.from + T.RESULT.split),
    bookedWord: fb(S.result.from + T.RESULT.bookedWord),
    white: fb(S.result.from + T.RESULT.toWhite[0]),
    kb: fb(S.knowledge.from),
    miss: half(fb(S.knowledge.from + K.miss)),
    answer: half(fb(S.knowledge.from + K.answer + T.vWord(K.answerVoice, 0))),
    closing: half(fb(S.knowledge.from + K.closing)),
    key: half(fb(S.knowledge.from + T.KNOWLEDGE_LOCAL.closingKey)),
    whip: fb(S.knowledge.from + K.out[0]),
    scale: fb(S.scale.from),
    title: fb(S.scale.from + T.SCALE.industriesTitle),
    flow: fb(S.scale.from + T.SCALE.flow),
    cta: fb(S.cta.from),
    line: fb(S.cta.from + T.CTA.line),
    converge: fb(S.cta.from + T.CTA.converge[0]),
    impact: fb(S.cta.from + T.CTA.logoImpact),
  };
  const inR = (b, a, e) => b >= a && b < e;
  const LEN = sec(END) + 3;
  const out = stereo(LEN);

  /* ── harmony ─────────────────────────────────────────────────── */
  const CH = {
    Csm: { root: 37, notes: [56, 59, 63, 64] }, // C#m9 (G#3 B3 D#4 E4 over C#)
    A: { root: 45, notes: [57, 61, 64, 71] }, // Aadd9
    Amaj7: { root: 45, notes: [57, 61, 64, 68] },
    Amaj9: { root: 45, notes: [57, 61, 64, 68, 71] },
    Bsus: { root: 47, notes: [59, 64, 66, 71] },
    B: { root: 47, notes: [59, 63, 66, 71] },
    BD: { root: 39, notes: [59, 63, 66, 71] }, // B/D#
    E: { root: 40, notes: [56, 59, 64, 66] }, // Eadd9
    EG: { root: 44, notes: [56, 59, 64, 66] }, // E/G#
    Fsm7: { root: 42, notes: [57, 61, 64, 69] },
    Efin: { root: 40, notes: [52, 59, 64, 68, 71, 78] }, // the resolution: E3 B3 E4 G#4 B4 F#5
  };
  const seg = [];
  const put = (a, e, c) => {
    if (e > a + 1e-6) seg.push({ a, e, c });
  };
  put(0, P.shatter, 'Csm');
  put(P.shatter, P.shatter + 4, 'A');
  put(P.shatter + 4, P.call - 2, 'Bsus');
  put(P.call - 2, P.call, 'B');
  {
    const loop = ['E', 'BD', 'Csm', 'A'];
    for (let b = P.call, i = 0; b < P.booked; b += 4, i++) put(b, Math.min(b + 4, P.booked), loop[i % 4]);
  }
  put(P.booked, P.split, 'E');
  put(P.split, P.bookedWord, 'Amaj7');
  put(P.bookedWord, P.white, 'E');
  put(P.white, P.kb, 'Bsus');
  put(P.kb, Math.min(P.kb + 4, P.miss), 'A');
  put(P.kb + 4, P.miss, 'EG');
  put(P.miss, P.answer, 'Fsm7');
  {
    const loop = ['A', 'EG', 'Fsm7'];
    for (let b = P.answer, i = 0; b < P.closing; b += 4, i++) put(b, Math.min(b + 4, P.closing), loop[i % 3]);
  }
  put(P.closing, P.key, 'Bsus');
  put(P.key, P.scale, 'E');
  put(P.scale, P.title, 'Csm');
  put(P.title, P.flow, 'A');
  put(P.flow, P.cta, 'B');
  const mid = Math.max(P.cta + 2, Math.min(P.cta + 4, P.converge - 2));
  put(P.cta, mid, 'Amaj9');
  put(mid, P.converge, 'Fsm7');
  put(P.converge, P.impact - 1, 'Bsus');
  put(P.impact - 1, P.impact, 'B');
  put(P.impact, END + 4, 'Efin');
  const chordAt = (b) => CH[(seg.find((s) => b >= s.a && b < s.e) ?? seg[seg.length - 1]).c];

  /* ── automation (all in beats) ───────────────────────────────── */
  const padGain = (b) => {
    if (b < P.shatter) return 0.4 + 0.15 * smooth(b / P.shatter);
    if (b < P.call) return 0.5 + 0.2 * smooth((b - P.shatter) / (P.call - P.shatter));
    if (b < P.booked) return 0.55;
    if (b < P.kb) return 0.7;
    if (b < P.miss) return 0.5;
    if (b < P.answer) return lerp(0.5, 0.14, smooth((b - P.miss) / 1));
    if (b < P.closing) return lerp(0.14, 0.45, smooth((b - P.answer) / 2));
    if (b < P.scale) return 0.55;
    if (b < P.cta) return 0.6;
    if (b < P.impact) return 0.35 + 0.5 * smooth((b - P.cta) / (P.impact - P.cta));
    return 1.0 * Math.exp(-(b - P.impact) / 5);
  };
  const padCut = (b) => {
    if (b < P.shatter) return 420 + 380 * smooth(b / P.shatter);
    if (b < P.call) return 800 + 1100 * smooth((b - P.shatter) / (P.call - P.shatter));
    if (b < P.booked) return 1500 + 250 * Math.sin(b * 0.39);
    if (b < P.kb) return 2600;
    if (b < P.miss) return 1900;
    if (b < P.answer) return lerp(1900, 520, smooth(b - P.miss));
    if (b < P.closing) return lerp(520, 1500, smooth((b - P.answer) / 3));
    if (b < P.scale) return 2300;
    if (b < P.cta) return 3000;
    if (b < P.impact) return 900 + 4200 * Math.pow(smooth((b - P.cta) / (P.impact - P.cta)), 1.6);
    return 1400 + 4000 * Math.exp(-(b - P.impact) / 2.5);
  };

  /* ── PAD: three detuned band-limited saws per note, voice-led crossfades ── */
  {
    const pl = mono(LEN);
    const pr = mono(LEN);
    const r = rng(101);
    for (const s of seg) {
      const t0 = sec(s.a) - 0.08;
      const t1 = sec(s.e) + 0.45;
      const att = s.a === P.impact ? 0.004 : s.c === 'Csm' && s.a === 0 ? 1.6 : 0.3;
      const i0 = Math.max(0, Math.round(t0 * SR));
      const i1 = Math.min(pl.length, Math.round(t1 * SR));
      CH[s.c].notes.forEach((m, v) => {
        for (const det of [-0.11, 0, 0.1]) {
          const saw = new Saw(r());
          const f = mtof(m + det);
          const side = det < 0 ? -1 : det > 0 ? 1 : (v % 2 ? 0.4 : -0.4);
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
    const fl = new Biquad('lp', 600, 0.7);
    const fr = new Biquad('lp', 600, 0.7);
    const fl2 = new Biquad('lp', 600, 0.7);
    const fr2 = new Biquad('lp', 600, 0.7);
    for (let i = 0; i < pl.length; i++) {
      const b = i / SR / BEAT;
      if ((i & 63) === 0) {
        const c = padCut(b) * (1 + 0.06 * Math.sin(TAU * 0.11 * (i / SR)));
        fl.set(c, 0.6); fl2.set(c * 1.4, 0.55);
        fr.set(c * 1.03, 0.6); fr2.set(c * 1.45, 0.55);
      }
      const g = padGain(b);
      out[0][i] += fl2.run(fl.run(pl[i])) * g;
      out[1][i] += fr2.run(fr.run(pr[i])) * g;
    }
  }

  /* ── drums & bass, per section ───────────────────────────────── */
  const drums = stereo(LEN);
  const kickTimes = [];
  const kick = (b, g) => {
    kickTimes.push(sec(b));
    const k = osc(0.5, (t) => 47 + 105 * Math.exp(-t / 0.028), ad(0.0012, 0.16)).map((v) => Math.tanh(v * 1.7) / Math.tanh(1.7));
    const c = noise(0.02, 7000 + Math.round(b * 4), ad(0.0002, 0.0015), 'hp', 2500, 0.7);
    for (let i = 0; i < c.length; i++) k[i] += c[i] * 0.25;
    addMono(drums, k, sec(b), g, 0);
  };
  const hat = (b, g, open = false, seed = 0) => {
    const len = open ? 0.35 : 0.08;
    const h = noise(len, 7100 + seed, ad(0.0004, open ? 0.11 : 0.017), 'hp', 7200, 0.7);
    const m = noise(len, 7200 + seed, ad(0.0004, open ? 0.09 : 0.012), 'bpn', 10500, 1.2);
    for (let i = 0; i < h.length; i++) h[i] = h[i] * 0.8 + m[i] * 0.6;
    addMono(drums, h, sec(b), g, ((seed * 7) % 5) / 10 - 0.2);
  };
  const clap = (b, g, seed) => {
    const len = 0.4;
    const c = mono(len);
    for (const d of [0, 0.011, 0.022]) {
      const burst = noise(0.03, 7300 + seed + d * 1000, ad(0.0003, 0.003), 'bpn', 1300, 1);
      for (let i = 0; i < burst.length; i++) c[i + Math.round(d * SR)] += burst[i];
    }
    const tail = noise(len, 7400 + seed, ad(0.001, 0.07), 'bpn', 1200, 0.8);
    for (let i = 0; i < c.length; i++) c[i] += tail[Math.max(0, i - Math.round(0.022 * SR))] * 0.6;
    addStereo(drums, spread(c, 0.4, 7500 + seed), sec(b), g);
  };
  const snare = (b, g, seed) => {
    const len = 0.3;
    const s = noise(len, 7600 + seed, ad(0.0005, 0.06), 'bpn', 2200, 0.7);
    const tn = osc(len, (t) => 185 + 30 * Math.exp(-t / 0.01), ad(0.0008, 0.04));
    for (let i = 0; i < s.length; i++) s[i] = s[i] * 0.9 + tn[i] * 0.5;
    addStereo(drums, spread(s, 0.3, 7700 + seed), sec(b), g);
  };
  const crash = (b, g, seed, tau = 1.4) => {
    const len = tau * 3.2;
    const metal = (sd) => {
      const r2 = rng(sd);
      const m = mono(len);
      for (let k = 0; k < 6; k++) {
        const f = 3100 + r2() * 5200;
        const o = osc(len, f, ad(0.001, tau * (0.5 + r2() * 0.5)));
        for (let i = 0; i < m.length; i++) m[i] += (o[i] < 0 ? -Math.sqrt(-o[i]) : Math.sqrt(o[i])) * 0.12;
      }
      const n = noise(len, sd + 1, ad(0.002, tau), 'hp', 5200, 0.7);
      for (let i = 0; i < m.length; i++) m[i] = m[i] * 0.5 + n[i];
      return filt(m, ['hp', 2500, 0.7], ['lp', 14000, 0.7]);
    };
    addStereo(drums, [metal(7800 + seed), metal(7900 + seed)], sec(b), g);
  };
  const revCym = (bEnd, beats, g, seed) => {
    const d = sec(beats);
    const c = (sd) => env(sweep(white(d, sd), 'hp', (t) => 2500 + 6000 * (t / d), 0.7), (t) => Math.pow(t / d, 3.2));
    addStereo(drums, [c(8000 + seed), c(8001 + seed)], sec(bEnd) - d, g);
  };

  // HOOK — nothing but the drone (the clock and the heartbeats are effects)
  // TWIST — hats creep in (16ths, crescendo), a reverse cymbal into the call
  for (let b = P.shatter + 4; b < P.call; b += 0.25) {
    const u = (b - (P.shatter + 4)) / 4;
    hat(b, (0.05 + 0.18 * u) * (b % 1 === 0 ? 1 : b % 0.5 === 0 ? 0.7 : 0.45), false, Math.round(b * 4));
  }
  revCym(P.call, 2, 0.35, 1);
  // CALL — soft kick on 1 & 3, 8th hats with 16th ghosts
  for (let b = P.call; b < P.result; b += 0.25) {
    const onBar = (b - P.call) % 4;
    if (b % 1 === 0 && onBar % 2 === 0) kick(b, b >= P.booked ? 0.5 : 0.42);
    if (b % 0.5 === 0) hat(b, b % 1 === 0 ? 0.09 : 0.14, false, Math.round(b * 4));
    else hat(b, 0.035, false, Math.round(b * 4));
  }
  // RESULT — half time
  for (let b = Math.ceil(P.result); b < P.white; b += 1) {
    if (b % 2 === 0) kick(b, 0.4);
    hat(b + 0.5, 0.12, false, Math.round(b * 4));
  }
  // KNOWLEDGE — no drums; a reverse cymbal into the closing title and into the montage
  revCym(P.closing, 2, 0.12, 2);
  revCym(P.scale, 1.5, 0.3, 3);
  // SCALE — the full groove
  crash(P.scale, 0.28, 1, 1.1);
  for (let b = P.scale; b < P.cta - 0.01; b += 0.25) {
    if (b % 1 === 0) kick(b, 0.75);
    if (b % 1 === 0 && (b - P.scale) % 2 === 1) clap(b, 0.4, Math.round(b));
    const sx = Math.round((b - P.scale) * 4);
    hat(b, sx % 4 === 2 ? 0.2 : sx % 2 ? 0.07 : 0.11, sx % 4 === 2 && (b - P.scale) % 2 >= 1, Math.round(b * 4));
  }
  crash(P.title, 0.22, 2, 1.0);
  // CTA — silence in the dark, then the build: a pulse, 16th hats, a snare roll into the impact
  {
    const b0 = Math.max(P.line + 2, mid);
    for (let b = b0; b < P.converge; b += 1) kick(b, 0.25 + 0.3 * ((b - b0) / Math.max(1, P.converge - b0)));
    for (let b = b0; b < P.impact; b += 0.25) {
      const u = (b - b0) / (P.impact - b0);
      hat(b, (0.03 + 0.12 * u) * (b % 0.5 === 0 ? 1 : 0.6), false, Math.round(b * 4) + 500);
    }
    for (let b = P.converge; b < P.impact - 0.01; ) {
      const u = (b - P.converge) / (P.impact - P.converge);
      snare(b, 0.08 + 0.35 * u * u, Math.round(b * 8));
      b += u < 0.5 ? 0.25 : 0.125;
    }
    crash(P.impact, 0.55, 3, 1.6);
  }

  /* ── bass ── */
  const bass = stereo(LEN);
  const bassNote = (b, dur, m, g, bright = 0.2) => {
    const len = sec(dur) + 0.3;
    const f = mtof(m);
    const a = (t) => Math.min(1, t / 0.006) * (t < sec(dur) ? Math.exp(-t / Math.max(0.25, sec(dur))) : Math.exp(-sec(dur) / Math.max(0.25, sec(dur))) * Math.exp(-(t - sec(dur)) / 0.05));
    const s = osc(len, f, a);
    const h = osc(len, 2 * f, a);
    const h3 = osc(len, 3 * f, a);
    for (let i = 0; i < s.length; i++) s[i] = Math.tanh((s[i] + h[i] * bright + h3[i] * bright * 0.4) * 1.4) * 0.8;
    addMono(bass, s, sec(b), g, 0);
  };
  // hook drone: C#2 + a faint C#1, rising out of the black, gone into the shatter
  {
    const d = sec(P.shatter) + 0.6;
    const a = (t) => smooth(t / 1.8) * (t < d - 0.6 ? 1 : Math.max(0, (d - t) / 0.6));
    addMono(bass, osc(d, mtof(37), a), 0, 0.3, 0);
    addMono(bass, osc(d, mtof(25), a), 0, 0.22, 0);
    addMono(bass, osc(d, mtof(44) + 0.3, a), 0, 0.07, -0.3);
    addMono(bass, env(sweep(pink(d, 8100), 'lp', 380, 0.7), a), 0, 0.4, 0);
  }
  // twist: sustained roots from the shatter
  for (const s of seg.filter((x) => x.a >= P.shatter && x.a < P.call)) bassNote(s.a, s.e - s.a, CH[s.c].root, 0.35, 0.1);
  // call: roots on 1 and 3 (+ an 8th pickup into the next bar)
  for (let b = P.call; b < P.result; b += 2) {
    bassNote(b, 1.6, chordAt(b).root, 0.32, 0.25);
    if ((b - P.call) % 4 === 2) bassNote(b + 1.5, 0.4, chordAt(b + 2).root, 0.18, 0.25);
  }
  // result: sustained roots
  for (const s of seg.filter((x) => x.a >= P.result - 0.6 && x.a < P.kb)) bassNote(Math.max(s.a, P.result), s.e - Math.max(s.a, P.result), CH[s.c].root, 0.3, 0.15);
  // knowledge: only after the answer, soft
  for (const s of seg.filter((x) => x.a >= P.answer && x.a < P.scale)) bassNote(s.a, s.e - s.a, CH[s.c].root, 0.18, 0.08);
  // scale: 8th-note pumping bass (root / octave)
  for (let b = P.scale; b < P.cta - 0.01; b += 0.5) bassNote(b, 0.42, chordAt(b).root + ((b * 2) % 2 ? 12 : 0), 0.34, 0.35);
  // cta: the build, then E on the logo (long)
  for (const s of seg.filter((x) => x.a >= P.cta && x.a < P.impact)) bassNote(s.a, s.e - s.a, CH[s.c].root, 0.2 + 0.15 * ((s.a - P.cta) / (P.impact - P.cta)), 0.1);
  bassNote(P.impact, END - P.impact, 28, 0.42, 0.18);

  /* ── melodic voices ── */
  const keys = stereo(LEN);
  /** additive pluck: exact pitch, harmonics decaying faster the higher they are */
  const pluck = (b, m, g, pan, bright = 0.6, tau = 0.5) => {
    const len = Math.min(1.6, tau * 5);
    const f = mtof(m);
    const s = mono(len);
    for (let k = 1; k <= 8; k++) {
      if (f * k > 16000) break;
      const p = mode(len, f * k, Math.pow(k, -1.25) * (k === 1 ? 1 : bright), tau / Math.pow(k, 0.75), 0.0008);
      for (let i = 0; i < s.length; i++) s[i] += p[i];
    }
    addMono(keys, s, sec(b), g, pan);
  };
  /** felt piano: slightly stretched partials, a soft hammer */
  const piano = (b, m, g, pan) => {
    const len = 2.6;
    const f = mtof(m);
    const s = mono(len);
    for (let k = 1; k <= 7; k++) {
      const fk = f * k * Math.sqrt(1 + 0.00035 * k * k);
      if (fk > 12000) break;
      const p = mode(len, fk, Math.pow(k, -1.6), 1.9 / Math.pow(k, 0.8), 0.004);
      for (let i = 0; i < s.length; i++) s[i] += p[i];
    }
    const h = noise(0.05, 8200 + Math.round(b * 8) + m, ad(0.001, 0.008), 'lp', 1400, 0.7);
    for (let i = 0; i < h.length; i++) s[i] += h[i] * 0.2;
    addMono(keys, filt(s, ['lp', 3200, 0.6]), sec(b), g, pan);
  };
  /** e-piano (FM, tine) */
  const epiano = (b, m, g, pan) => {
    const len = 3;
    const f = mtof(m);
    let pm = 0;
    let pt = 0;
    const s = mono(len);
    let pc = 0;
    for (let i = 0; i < s.length; i++) {
      const t = i / SR;
      pm += (TAU * f) / SR;
      pt += (TAU * f * 14) / SR;
      const idx = 1.8 * Math.exp(-t / 0.3) + 0.3;
      pc += (TAU * f) / SR;
      s[i] = Math.sin(pc + idx * Math.sin(pm) + 0.4 * Math.exp(-t / 0.02) * Math.sin(pt)) * Math.min(1, t / 0.002) * Math.exp(-t / 1.3);
    }
    addMono(keys, s, sec(b), g, pan);
  };
  // call: a quiet 8th arp from the chord, an octave up, alternating sides
  for (let b = P.call + 0.5, i = 0; b < P.result; b += 0.5, i++) {
    const n = chordAt(b).notes;
    pluck(b, n[i % n.length] + 12, b >= P.booked ? 0.05 : 0.038, i % 2 ? 0.35 : -0.35, 0.45, 0.35);
  }
  // result: the e-piano chord on "Asleep." (soft) and on "Booked."
  for (const [b, g] of [[P.split, 0.06], [P.bookedWord, 0.1]]) chordAt(b).notes.forEach((m, i) => epiano(b + i * 0.01, m + 12, g, (i - 1.5) * 0.25));
  // knowledge: felt piano — a gentle figure until the miss, then silence, then sparser under the answer
  {
    const fig = [0, 1.5, 2.5];
    for (let bar = P.kb; bar < P.miss; bar += 4) {
      for (const o of fig) {
        const b = bar + o;
        if (b >= P.miss - 0.25) continue;
        const n = chordAt(b).notes;
        piano(b, n[(o * 2) % n.length] + 12, 0.11, o === 1.5 ? 0.25 : -0.2);
      }
      piano(bar, chordAt(bar).root + 12, 0.08, 0);
    }
    for (let bar = P.answer; bar < P.closing; bar += 2) {
      const n = chordAt(bar).notes;
      piano(bar, n[((bar - P.answer) / 2) % n.length] + 12, 0.07, ((bar - P.answer) % 4 ? 0.25 : -0.25));
    }
    // "it says so.": the resolution chord on the key frame
    chordAt(P.key).notes.forEach((m, i) => piano(P.key + i * 0.02, m + 12, 0.08, (i - 1.5) * 0.2));
  }
  // scale: 16th arp, brighter
  for (let b = P.scale, i = 0; b < P.cta - 0.01; b += 0.25, i++) {
    const n = chordAt(b).notes;
    const m = n[i % n.length] + 12 + (Math.floor(i / 8) % 2 ? 12 : 0);
    pluck(b, m, i % 4 === 0 ? 0.07 : 0.05, Math.sin(i * 0.9) * 0.5, 0.7, 0.25);
  }
  // cta: the pulse returns under her line (8ths → 16ths at the converge)
  for (let b = Math.max(P.line, P.cta + 1), i = 0; b < P.impact; b += b < P.converge ? 0.5 : 0.25, i++) {
    const n = chordAt(b).notes;
    const u = (b - P.cta) / (P.impact - P.cta);
    pluck(b, n[i % n.length] + 12, 0.02 + 0.05 * u, i % 2 ? 0.3 : -0.3, 0.4 + 0.4 * u, 0.3);
  }
  // the resolution: E on the logo (e-piano + piano doubling the pad)
  CH.Efin.notes.forEach((m, i) => {
    epiano(P.impact + i * 0.008, m + 12, 0.07, (i - 2.5) * 0.18);
    piano(P.impact + i * 0.012, m, 0.07, (i - 2.5) * 0.15);
  });

  /* ── sidechain pump in the groove sections (pad + bass + keys duck under the kick) ── */
  const pump = new Float32Array(out[0].length).fill(1);
  for (const t of kickTimes) {
    const b = t / BEAT;
    const depth = inR(b, P.scale, P.cta) ? 0.45 : inR(b, P.call, P.kb) ? 0.22 : 0.25;
    const i0 = Math.round(t * SR);
    for (let i = 0; i < 0.3 * SR && i0 + i < pump.length; i++) {
      const u = i / SR;
      const g = 1 - depth * (u < 0.004 ? u / 0.004 : Math.exp(-(u - 0.004) / 0.08));
      pump[i0 + i] = Math.min(pump[i0 + i], g);
    }
  }
  for (let c = 0; c < 2; c++) {
    for (let i = 0; i < out[c].length; i++) out[c][i] = (out[c][i] + keys[c][i] * 0.9 + bass[c][i]) * pump[i] + drums[c][i];
  }

  /* ── space, glue, and the end ── */
  const hall = fdn(out, { rt60: 2.4, rt60Hi: 0.9, pre: 0.022, size: 1.2, hp: 200, lp: 7000, tail: 0 });
  for (let c = 0; c < 2; c++) for (let i = 0; i < out[c].length; i++) out[c][i] += hall[c][i] * 0.32;
  const glued = compress(out, { thr: -20, ratio: 2, knee: 8, att: 0.01, rel: 0.2, rms: 0.01 });
  // fade the tail out over the final hold so the film ends in near-silence
  const fadeA = sec(END) - 1.2;
  const fadeB = sec(END) + 0.2;
  for (let c = 0; c < 2; c++) {
    for (let i = 0; i < glued[c].length; i++) {
      const t = i / SR;
      if (t > fadeA) glued[c][i] *= t > fadeB ? 0 : Math.pow(1 - (t - fadeA) / (fadeB - fadeA), 1.5);
    }
  }
  const lim = limit(glued, { ceilingDb: -0.5, look: 0.003, rel: 0.12 });
  return { st: [lim[0], lim[1]], points: P, segments: seg };
}
