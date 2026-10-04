/**
 * FILM 2's BED — "Two Kinds of Work", 120 BPM, E major, composed against film 2's own timeline (src/kb/timing.ts
 * SCENES + MUSIC: re-timed voices move the music with them). SCRIPT.md's per-beat "Sound" notes are the brief.
 *
 *   PART I   from ring one: ONE bar of muted felt piano (B3–E4 8ths) and a soft shaker — rendered once and pasted, so
 *            every bar is the identical bar (deadpan: the same answer, again); from the third ring a low felt pulse on
 *            1 and 3; over b05's rolls the felt lifts, the filter opens and the figure doubles to 16ths; THE HARD STOP:
 *            the whole of Part I (its room included) is cut ON THE SAMPLE — room tone only (a cue)
 *   b06      silence; a low felt-piano E2 under "brilliant"; on "Waiting." (on the bar) a single high B5 that does not
 *            resolve
 *   b07      the Part I bar returns, identical, under "Some work repeats." (deadpan); on "Some work matters." it stops and
 *            the harmony opens: E – C#m7 – Amaj7 – B, soft strings and a warm sub
 *   b08–b09  felt-piano 8ths through the chords, a soft felt kick on 1 and 3 (the call: lighter, no kick)
 *   b10      stop-time: the beat drops out, a held E add9 (strings, a warm pad, the piano struck once) — her plucks
 *            (cues) build the same chord on 8ths
 *   b11      the groove returns ON the bar
 *   b12      thins to piano and pad (the owner types: quarter-note piano, nothing on the 16ths)
 *   b13–b14  the groove; the progression is turned so the bar of "the new answer" is E (the fifth mallet, E5, lands on
 *            its tonic); from the next call a high piano line lifts it
 *   b15      room tone and ONE warm pad (E); it breathes out into the bar of room tone before vo-8
 *   b16      fuller: strings and piano, a gentle lift (Amaj7 → Bsus) into the dark
 *   CLOSE    the drop into the dark ON the bar: Amaj9 → F#m11 → Bsus → B under her line (the glass arpeggio and the four
 *            light chimes are cues); the converge: 8th kicks, a snare roll 16ths → 32nds, 16th plucks, the strings
 *            swelling; the INHALE (the bar drawn in 9 dB over the beat before the hit); E ON the logo: crash (choked
 *            before the name), kick, a long low E, piano + e-piano + strings on the resolution; a halo of the four lights'
 *            notes from the button; the chord rings into the master's fade (the bed has no fade of its own)
 *
 * Instruments: the felt piano, strings and pad are this file's own models (stretched-partial felt piano with a
 * two-stage decay and a felt damper; a bowed-string ensemble of band-limited saws with drifting pitch, delayed
 * vibrato, body EQ and bow noise); the kick, shaker, snare, crash, bass, pluck, e-piano, hall, glue and bus limiter
 * follow scripts/audio/bed.mjs (copied: that file exports only bed(T), and editing it would change film 1's bedKey
 * and mix hash). Exports bed(T) → { st, points, segments } and inputs(T) (its cache key).
 */
import {
  SR, TAU, stereo, mono, addMono, addStereo, osc, ad, mode, filt, noise, spread, fdn, compress, limit, mtof, smooth, rng,
  Saw, Biquad, lerp, gain, white,
} from '../audio/dsp.mjs';

/**
 * EVERYTHING the bed reads from the timeline — and the bed cache key (scripts/kb/generate-sfx.mjs keys bed.wav on
 * this object + the bytes of this file and dsp.mjs). bed() reads ONLY this object, so a new input has to be added
 * here, and then it is in the key too: a cached bed can never miss a change.
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

/* ═════════════════════════ the bed ═════════════════════════ */

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
    vo6: fb(M.vo6),
    change: fb(M.change),
    ready5: fb(M.ready5),
    ring14: fb(M.ring14),
    desk: fb(M.desk),
    breath: fb(M.breath[0]),
    vo8: half(fb(M.vo8)),
    cta: fb(M.cta),
    vo9: fb(S.cta.from + I.vo9),
    lights: fb(M.lights),
    converge: fb(M.converge),
    impact: fb(M.impact),
    brand: fb(M.brand),
    button: fb(M.button),
  };
  const LEN = sec(END) + 3;
  const out = stereo(LEN);

  /* ── harmony ─────────────────────────────────────────────────── */
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
  const seg = [];
  const put = (a, e, c) => {
    if (e > a + 1e-6) seg.push({ a, e, c });
  };
  /** E – C#m7 – Amaj7 – B, one chord per bar, turned so the bar holding `eAt` (beats) is E; no chord shorter than two
   *  beats (a short first span joins the next bar, a short last one extends the chord before it) */
  const PROG = ['E', 'Csm7', 'Amaj7', 'B'];
  const prog = (a, e, eAt) => {
    const eBar = Math.floor(eAt / 4 + 1e-9);
    const chordOfBar = (bar) => PROG[(((bar - eBar) % 4) + 4) % 4];
    let x = a;
    while (x < e - 1e-6) {
      let bar = Math.floor(x / 4 + 1e-9);
      let nx = bar * 4 + 4;
      if (nx - x < 2 - 1e-6 && nx + 4 <= e + 1e-6) {
        nx += 4; // a short first span joins the next bar (and takes its chord)
        bar += 1;
      }
      if (e - nx < 2 - 1e-6) nx = e; // a short last span extends this chord
      put(x, Math.min(nx, e), chordOfBar(bar));
      x = Math.min(nx, e);
    }
  };
  prog(P.matters, P.freeze, P.matters);
  put(P.freeze, P.resume, 'Eadd9');
  prog(P.resume, P.change, P.resume);
  prog(P.change, P.desk, P.ready5);
  put(P.desk, P.vo8, 'Emaj9');
  {
    const bar = Math.ceil(P.vo8 / 4 + 1e-9) * 4;
    const mid = bar - P.vo8 >= 2 && P.cta - bar >= 2 ? bar : (P.vo8 + P.cta) / 2;
    put(P.vo8, mid, 'Amaj7');
    put(mid, P.cta, 'Bsus');
  }
  {
    const a = P.cta;
    const b1 = Math.min(a + 4, P.converge - 2);
    const b2 = Math.min(a + 8, P.converge - 1);
    put(a, b1, 'Amaj9');
    put(b1, b2, 'Fsm11');
    put(b2, P.impact - 1, 'Bsus');
    put(P.impact - 1, P.impact, 'B');
    put(P.impact, END + 4, 'Efin');
  }
  const segAt = (x) => seg.find((s) => x >= s.a - 1e-9 && x < s.e - 1e-9) ?? seg[seg.length - 1];
  const chordAt = (x) => CH[segAt(x).c];
  const inR = (x, a, e) => x >= a - 1e-9 && x < e - 1e-9;

  /* ── buses ── */
  const partI = stereo(LEN);
  const keys = stereo(LEN);
  const drums = stereo(LEN);
  const bass = stereo(LEN);
  const kickTimes = [];
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

  /* ── PART I: THE BAR, rendered once and pasted (bit-identical every time), cut on the sample at the hard stop ── */
  /** one bar of the deadpan figure: B3 on the beats, E4 on the offbeats, muted felt; the shaker on the 8ths */
  const renderBar = (sixteenths, open) => {
    const st = stereo(sec(4) + 1.2);
    const steps = sixteenths ? 16 : 8;
    const step = 4 / steps;
    for (let j = 0; j < steps; j++) {
      const x = j * step;
      const k = sixteenths ? j >> 1 : j;
      const on = k % 2 === 0;
      const vel = (on ? 0.5 : 0.42) * (sixteenths && j % 2 ? 0.8 : 1) + 0.12 * open;
      const pn = pianoNote(on ? 59 : 64, vel, (sixteenths ? 0.11 : 0.19) + 0.12 * open, 1 - 0.75 * open, j % 2);
      addMono(st, pn, sec(x), 0.6 * (0.35 + 0.65 * vel), on ? -0.18 : 0.18);
      shaker(st, x, (on ? 0.1 : 0.15) * (sixteenths ? (j % 2 ? 0.7 : 0.9) : 1), j + (sixteenths ? 40 : 0), open);
    }
    return st;
  };
  const BAR8 = renderBar(false, 0);
  {
    const rollBar = P.rolls; // the figure doubles from the first roll
    for (let x = P.ring; x < P.stop - 1e-6; x += 4) {
      if (x >= rollBar - 1e-6) break;
      if (x + 4 <= rollBar + 1e-6) addStereo(partI, BAR8, sec(x), 1);
      else {
        // the bar the rolls start in: the 8ths up to the first roll …
        const cut = Math.round(sec(rollBar - x) * SR);
        const part = [BAR8[0].slice(0, cut), BAR8[1].slice(0, cut)];
        addStereo(partI, part, sec(x), 1);
      }
    }
    // … then 16ths, the felt lifting and the filter opening into the stop
    const rolled = stereo(LEN);
    for (let x = P.rolls, j = 0; x < P.stop - 1e-6; x += 0.25, j++) {
      const u = (x - P.rolls) / Math.max(0.25, P.stop - P.rolls);
      const k = Math.round(x * 2) % 2;
      const vel = (k === 0 ? 0.5 : 0.43) * (j % 2 ? 0.82 : 1) + 0.18 * u;
      putPiano(rolled, x, k === 0 ? 59 : 64, vel, k === 0 ? -0.2 : 0.2, { dur: 0.12 + 0.1 * u, mute: 1 - 0.7 * u, seed: j % 3, g: 0.55 });
      shaker(rolled, x, (j % 2 ? 0.085 : 0.115) * (1 + 0.4 * u), 60 + j, u);
    }
    // the filter opening (a swept low-pass on the rolled figure)
    for (let c = 0; c < 2; c++) {
      const f = new Biquad('lp', 1500, 0.8);
      const i0 = Math.round(sec(P.rolls) * SR);
      for (let i = i0; i < rolled[c].length; i++) {
        if (((i - i0) & 63) === 0) f.set(1500 * Math.pow(8000 / 1500, smooth((i / SR - sec(P.rolls)) / Math.max(0.1, sec(P.stop - P.rolls)))), 0.8);
        partI[c][i] += f.run(rolled[c][i]);
      }
    }
    // b04: a low felt pulse on 1 and 3 from the third ring (with a breath of sub on E1)
    for (let x = Math.ceil(P.ring3 / 2) * 2; x < P.stop - 1e-6; x += 2) {
      feltKick(partI, x, 0.42);
      subNote(partI, sec(x), 0.18, 28, 0.1, { rel: 0.12 });
    }
    const hall = fdn(partI, { rt60: 1.3, rt60Hi: 0.55, pre: 0.012, size: 0.75, hp: 220, lp: 7000, tail: 0 });
    // THE HARD STOP: the bar AND its room end on the sample (a 1 ms ramp so it never clicks)
    const cut = Math.round(sec(P.stop) * SR);
    const ramp = Math.round(0.001 * SR);
    for (let c = 0; c < 2; c++) {
      for (let i = 0; i < partI[c].length; i++) {
        const g = i < cut - ramp ? 1 : i >= cut ? 0 : (cut - i) / ramp;
        partI[c][i] = (partI[c][i] + hall[c][i] * 0.22) * g;
      }
    }
  }

  /* ── b06: one low E2 under "brilliant"; one high B5 on "Waiting." that does not resolve ── */
  putPiano(keys, P.brilliant, 40, 0.55, -0.05, { dur: 3.6, seed: 1, g: 0.5 });
  putPiano(keys, P.waiting, 83, 0.42, 0.2, { dur: 2.4, seed: 2, g: 0.32 });

  /* ── b07: THE BAR again, identical, under "Some work repeats." — stopped on "Some work matters." ── */
  {
    const n = Math.max(0, Math.round(sec(P.matters - P.turn) * SR));
    const fade = Math.round(0.03 * SR);
    const part = [BAR8[0].slice(0, n + fade), BAR8[1].slice(0, n + fade)];
    for (const c of part) for (let i = Math.max(0, n - fade); i < c.length; i++) c[i] *= Math.max(0, (n + fade - i) / (2 * fade));
    addStereo(keys, part, sec(P.turn), 1);
  }

  /* ── STRINGS + PAD + SUB through the harmony (b07 → the end) ── */
  const strGain = (x) => {
    if (x < P.written) return 0.85; // b07: the harmony opening — strings alone over the sub
    if (x < P.call) return 0.6;
    if (x < P.freeze) return 0.55;
    if (x < P.resume) return 0.62; // the held E add9
    if (x < P.line) return 0.6;
    if (x < P.change) return 0; // b12: piano and pad only
    if (x < P.ring14) return 0.5;
    if (x < P.desk) return 0.6;
    if (x < P.vo8) return 0; // b15: one warm pad
    if (x < P.cta) return lerp(0.6, 0.85, smooth((x - P.vo8) / Math.max(1, P.cta - P.vo8)));
    if (x < P.converge) return lerp(0.45, 0.8, smooth((x - P.cta) / (P.converge - P.cta)));
    if (x < P.impact) return lerp(0.8, 1.05, (x - P.converge) / (P.impact - P.converge));
    return 1;
  };
  {
    // voice-led: a pitch held into the next chord carries on (no re-bow); each span's level from the section
    const spans = [];
    const open = new Map();
    const closeAll = (keep, at) => {
      for (const [m, s] of open) if (!keep.has(m)) {
        s[1] = at;
        spans.push(s);
        open.delete(m);
      }
    };
    for (const s of seg) {
      const g = strGain(s.a + 0.01);
      if (g <= 0) {
        closeAll(new Set(), sec(s.a));
        continue;
      }
      const ns = new Set(CH[s.c].str);
      closeAll(ns, sec(s.a));
      for (const m of ns) {
        const lvl = g * (m < 48 ? 0.75 : m > 70 ? 0.6 : 1);
        if (open.has(m) && Math.abs(open.get(m)[3] - lvl) < 0.2) continue;
        if (open.has(m)) {
          const o = open.get(m);
          o[1] = sec(s.a);
          spans.push(o);
        }
        open.set(m, [sec(s.a) - 0.03, 0, m, lvl]);
      }
    }
    closeAll(new Set(), sec(END + 3));
    const strs = stringSection(LEN, spans, { att: 0.5, rel: 0.8, cut: 2400 });
    // the close opens the strings' filter with the build
    addStereo(out, strs, 0, 1);
  }
  // the warm pad: b10's held chord, b12's bed under the piano, b15's one sustained pad, and the end's held E
  {
    // the windows the pad plays in, each chord clipped to them
    const WIN = [[P.freeze, P.resume], [P.line, P.change], [P.desk, P.vo8], [P.impact, END + 4]];
    const spans = [];
    for (const s of seg) for (const [wa, we] of WIN) if (s.e > wa + 1e-6 && s.a < we - 1e-6) spans.push({ a: Math.max(s.a, wa), e: Math.min(s.e, we), c: s.c });
    const padLevel = (x) => {
      if (inR(x, P.freeze, P.resume)) return 0.5;
      if (inR(x, P.line, P.change)) return 0.42;
      if (inR(x, P.desk, P.vo8)) return 0.5 * (1 - smooth((x - P.breath) / 2)); // breathes out into the bar of room tone
      if (x >= P.impact) return 0.3 + 0.35 * Math.exp(-(x - P.impact) / 3);
      return 0;
    };
    const pl = mono(LEN);
    const pr = mono(LEN);
    const r = rng(301);
    for (const s of spans) {
      const t0 = sec(s.a) - 0.05;
      const t1 = sec(s.e) + 0.5;
      const att = s.c === 'Eadd9' || s.c === 'Emaj9' ? 0.8 : 0.35;
      const i0 = Math.max(0, Math.round(t0 * SR));
      const i1 = Math.min(pl.length, Math.round(t1 * SR));
      CH[s.c].notes.forEach((m, v) => {
        for (const det of [-0.08, 0, 0.07]) {
          const saw = new Saw(r());
          const f = mtof(m + det);
          const side = det < 0 ? -1 : det > 0 ? 1 : v % 2 ? 0.4 : -0.4;
          const gl = 0.5 - side * 0.35;
          const gr = 0.5 + side * 0.35;
          for (let i = i0; i < i1; i++) {
            const t = i / SR;
            const fade = Math.min(1, (t - t0) / att, (t1 - t) / 0.5);
            const x = saw.run(f) * fade * 0.05;
            pl[i] += x * gl;
            pr[i] += x * gr;
          }
        }
      });
    }
    const f = [0, 1, 2, 3].map(() => new Biquad('lp', 800, 0.7));
    for (let i = 0; i < pl.length; i++) {
      const x = i / SR / BEAT;
      if ((i & 63) === 0) {
        const c = (x >= P.impact ? 1200 + 2600 * Math.exp(-(x - P.impact) / 2.5) : 950) * (1 + 0.05 * Math.sin(TAU * 0.11 * (i / SR)));
        f[0].set(c, 0.6);
        f[1].set(c * 1.4, 0.55);
        f[2].set(c * 1.03, 0.6);
        f[3].set(c * 1.45, 0.55);
      }
      const g = padLevel(x);
      if (g <= 0) {
        f[0].run(pl[i]);
        f[2].run(pr[i]);
        continue;
      }
      out[0][i] += f[1].run(f[0].run(pl[i])) * g;
      out[1][i] += f[3].run(f[2].run(pr[i])) * g;
    }
  }
  // the warm sub on the roots (b07 → b16; not under b12's thin bed or b15's pad; the close has its own bass)
  for (const s of seg) {
    if (s.a < P.matters - 1e-6 || s.a >= P.cta - 1e-6) continue;
    if (inR(s.a, P.line, P.change) || inR(s.a, P.desk, P.vo8)) continue;
    const g = inR(s.a, P.freeze, P.resume) ? 0.12 : 0.17;
    subNote(bass, sec(s.a), sec(s.e - s.a) - 0.02, CH[s.c].root - 12 + (CH[s.c].root < 43 ? 12 : 0), g, { att: 0.05, rel: 0.3 });
  }

  /* ── FELT PIANO through the acts ── */
  /** 8ths through the chord: an up-and-back figure in the octave above, the downbeats a touch stronger */
  const FIG = [0, 1, 2, 3, 2, 1, 2, 3];
  const eighths = (a, e, vel, { kick = 0, pan = 0.22 } = {}) => {
    for (let x = Math.ceil(a * 2 - 1e-9) / 2, i = 0; x < e - 1e-6; x += 0.5, i++) {
      const n = chordAt(x).notes;
      const pos = Math.round(x * 2) % 8;
      const m = n[FIG[pos] % n.length] + 12;
      const v = vel * (pos % 2 === 0 ? 1 : 0.8) * (pos === 0 ? 1.1 : 1);
      putPiano(keys, x, m, v, pos % 2 ? pan : -pan, { dur: 0.9, seed: pos % 3, g: 0.3 });
      if (kick > 0 && Math.abs(x % 2) < 1e-6) feltKick(drums, x, kick);
    }
  };
  // b07 after "matters": a soft chord on each change
  for (const s of seg.filter((x) => inR(x.a, P.matters, P.written))) {
    CH[s.c].notes.forEach((m, i) => putPiano(keys, s.a + i * 0.012, m, 0.38, (i - 1.5) * 0.15, { dur: sec(s.e - s.a), seed: 4, g: 0.22 }));
  }
  // b08: felt-piano 8ths, a soft felt kick on 1 and 3
  eighths(P.written, P.call, 0.5, { kick: 0.34 });
  // b09: the call — the 8ths lighter, no kick
  eighths(P.call, P.freeze, 0.36);
  // b10: the E add9 struck once, soft, and held (strings + pad)
  chordAt(P.freeze + 0.01).notes.forEach((m, i) => putPiano(keys, P.freeze + i * 0.025, m + 12, 0.36, (i - 2) * 0.2, { dur: sec(P.resume - P.freeze), seed: 5, g: 0.26 }));
  // b11: the groove returns ON the bar
  eighths(P.resume, P.line, 0.48, { kick: 0.32 });
  // b12: thins to piano and pad — a quarter-note piano, nothing on the 16ths the owner types on
  for (let x = Math.ceil(P.line), i = 0; x < P.change - 1e-6; x += 1, i++) {
    const n = chordAt(x).notes;
    putPiano(keys, x, n[[0, 2, 1, 3][i % 4] % n.length] + 12, x % 4 === 0 ? 0.42 : 0.34, i % 2 ? 0.25 : -0.25, { dur: 1.2, seed: i % 3, g: 0.28 });
  }
  // b13–b14: the groove; from the next call a high piano line lifts it
  eighths(P.change, P.desk, 0.44, { kick: 0.3 });
  {
    const LINE = [4, 3, 2, 3, 4, 5, 4, 2];
    for (let x = Math.ceil(P.ring14), i = 0; x < P.desk - 1e-6; x += 1, i++) {
      const n = chordAt(x).notes;
      const m = n[LINE[i % LINE.length] % n.length] + 24;
      putPiano(keys, x, m, 0.42, i % 2 ? 0.3 : -0.3, { dur: 1.4, seed: 6, g: 0.26 });
    }
  }
  // b16: fuller — piano 8ths over the strings, rising into the dark
  for (let x = P.vo8, i = 0; x < P.cta - 1e-6; x += 0.5, i++) {
    const n = chordAt(x).notes;
    const u = (x - P.vo8) / Math.max(1, P.cta - P.vo8);
    putPiano(keys, x, n[FIG[i % 8] % n.length] + 12, 0.36 + 0.14 * u, i % 2 ? 0.22 : -0.22, { dur: 0.9, seed: i % 3, g: 0.3 });
  }

  /* ── THE CLOSE ── */
  // under her line: the piano marks each chord, low and soft (the glass arpeggio and the four chimes are cues)
  for (const s of seg.filter((x) => inR(x.a, P.cta, P.converge))) {
    CH[s.c].notes.forEach((m, i) => putPiano(keys, s.a + i * 0.015, m, 0.34, (i - 2) * 0.15, { dur: sec(s.e - s.a), seed: 7, g: 0.22 }));
  }
  // the converge: 8th kicks, a snare roll 16ths → 32nds, 16th plucks
  for (let x = P.converge; x < P.impact - 0.4; x += 0.5) kick(drums, x, 0.5 + 0.2 * ((x - P.converge) / (P.impact - P.converge)));
  for (let x = P.converge; x < P.impact - 0.3; ) {
    const u = (x - P.converge) / (P.impact - P.converge);
    snare(drums, x, 0.16 + 0.38 * u * u, Math.round(x * 8));
    x += u < 0.5 ? 0.25 : 0.125;
  }
  for (let x = P.converge, i = 0; x < P.impact - 0.01; x += 0.25, i++) {
    const n = chordAt(x).notes;
    pluck(keys, x, n[i % n.length] + 12, 0.03 + 0.04 * ((x - P.converge) / (P.impact - P.converge)), i % 2 ? 0.3 : -0.3, 0.6, 0.3);
  }
  for (const s of seg.filter((x) => inR(x.a, P.cta, P.impact))) {
    const u = (s.a - P.cta) / (P.impact - P.cta);
    subNote(bass, sec(s.a), sec(s.e - s.a) - 0.02, CH[s.c].root - 12 + (CH[s.c].root < 43 ? 12 : 0), 0.14 + 0.1 * u, { att: 0.05, rel: 0.2 });
  }
  // E ON the logo: the crash (choked 50 ms before the name), a long low E swelling in under it (the hit's low punch is the
  // cue stack's — a kick and a sub transient here would only stack on its peaks and drive the master limiter), piano +
  // e-piano + the strings on the resolution
  crash(drums, P.impact, 0.38, 3, 1.6, Math.max(0.1, sec(P.brand - P.impact) - 0.05));
  subNote(bass, sec(P.impact), sec(END - P.impact) + 1, 28, 0.3, { att: 0.09, rel: 1 });
  // (the chord rolled across 60 ms, low notes first: the strings carry the resolution's weight, the keys its edge — twelve
  // attacks on one sample would only add a peak to the hit)
  CH.Efin.notes.forEach((m, i) => {
    epiano(keys, P.impact + 0.02 + i * 0.022, m + 12, 0.045, (i - 2.5) * 0.18);
    putPiano(keys, P.impact + i * 0.024, m, 0.55, (i - 2.5) * 0.15, { dur: sec(END - P.impact) + 1, seed: 8, g: 0.2 });
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

  /* ── a gentle sidechain pump under the kicks (strings + pad + bass + keys) ── */
  const pump = new Float32Array(out[0].length).fill(1);
  for (const t of kickTimes) {
    if (t < sec(P.stop)) continue; // Part I's own bus is not pumped
    const depth = t >= sec(P.converge) ? 0.3 : 0.14;
    const i0 = Math.round(t * SR);
    for (let i = 0; i < 0.3 * SR && i0 + i < pump.length; i++) {
      const u = i / SR;
      pump[i0 + i] = Math.min(pump[i0 + i], 1 - depth * (u < 0.004 ? u / 0.004 : Math.exp(-(u - 0.004) / 0.08)));
    }
  }
  for (let c = 0; c < 2; c++) for (let i = 0; i < out[c].length; i++) out[c][i] = (out[c][i] + keys[c][i] * 0.9 + bass[c][i]) * pump[i] + drums[c][i];
  // nothing of the main bus before the hard stop (Part I is its own bus, cut on the sample)
  for (let c = 0; c < 2; c++) for (let i = 0; i < Math.min(out[c].length, Math.round(sec(P.stop) * SR)); i++) out[c][i] = 0;

  /* ── space, glue, the inhale, density ── */
  const hall = fdn(out, { rt60: 2.4, rt60Hi: 0.9, pre: 0.022, size: 1.2, hp: 200, lp: 7000, tail: 0 });
  for (let c = 0; c < 2; c++) for (let i = 0; i < out[c].length; i++) out[c][i] += hall[c][i] * 0.3 + partI[c][i];
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
