/**
 * REEL 5 · "Three rings" — ig5's OWN BED (docs/ig/ig5/PIPELINE.md §5.3: "If the critic rounds want a distinct
 * arrangement, write scripts/ig5/bed.mjs. Its instruments must be copied"). 120 BPM, E major, composed against ig5's
 * own timeline (src/ig/ig5/timing.ts MUSIC: the bed moves with the takes). scripts/ig5/generate-sfx.mjs plays this file
 * when it exists (else the IG stub), cached on inputs(T) + the bytes of this file and dsp.mjs.
 *
 * Instruments: COPIED, token for token, from scripts/ig/bed.mjs (itself a copy of film 2's scripts/kb/bed.mjs @ 743247a):
 * the file-level models (partial, the felt piano, the sub, the bowed strings) and the kit closures (kitAt: felt kick,
 * kick, shaker, snare, crash, pluck, e-piano). scripts/ig/bed.mjs exports only inputs(T) / bed(T) and must not be edited
 * (it is an igHash input: one byte there restales ig1–ig4), so nothing is imported from it. The chord table CH, the
 * shared build (MUSIC.roll: the half-bar snare roll, the 8th kicks, the 16th plucks), the inhale and E ON the logo are
 * the IG bed's own, unchanged.
 *
 * THE ARRANGEMENT (docs/ig/ig5/HOOKS.md §1.4, SCRIPT.md §2 "Sound", voice-candidates/ig5/PICKS.md "the stop-time"), on
 * MUSIC.ig5's moments (frames, every one off the placed takes' onsets):
 *   HOOK      no bed: the frame-0 ring and her three short sentences in room tone (the cue sheet's), a phone you can't
 *             reach in a quiet room — nothing at all before MUSIC.bedFrom
 *   QUOTES    the bed ENTERS on the first beat of the agency line ("Agency AI receptionist:"): a muted felt-piano 8ths
 *             figure in a graphite middle register (the price list), a soft shaker, the sub on the chord changes, a low
 *             string pad — E · C#m7 · Amaj7 by bar; from the answering line the shaker goes to brushed 16ths
 *   THE CUT   F#m11 under "Live answering service", then Bsus → B in the bar before the stop: low strings SWELL into
 *             the cut (the phone still ringing, unanswered: ig4's curveball idiom) and end ON it — MUSIC.stop cuts the
 *             bed and its tails on the sample at a 16th (f420, PLAN.stopLead before "Ours?"), so the pickup, the orb's
 *             birth and "Ours?" sit in the room tone alone
 *   RETURN    exactly on "forty-nine" (MUSIC.stop[1]) the bed comes back on E: an open E rolled on the felt piano over a
 *             low E, the string PAD AN OCTAVE UP (Emaj9, warm: her teal), and a beat later the 8ths figure OPEN an octave
 *             up (unmuted: ours); no shaker, no kick — the payoff breathes
 *   SET UP    Amaj7 under the four dots (the plucks are the cue sheet's); the figure rests one 8th on "You" (the line's
 *             weakest onset)
 *   DOES      B under "It picks up when you can't," (the hook's "You can't" answered: the V before the I), a light felt
 *             kick on 1 and 3 from MUSIC.ig5.kick and the shaker's 8ths back; E ON "books" (a bright open E under the
 *             cue sheet's mallet: the call resolved)
 *   CTA       E → Amaj7 under "Comment AGENT for the link.", the strings' crescendo into the shared build: B for the roll,
 *             E on the logo (crash choked before the name, a long low E, the resolution) ringing into the master's fade
 *
 * Exports bed(T) → { st, points, segments } and inputs(T) (the cache key: bed() reads ONLY this object).
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

const segAt = (seg, x) => seg.find((s) => x >= s.a - 1e-9 && x < s.e - 1e-9) ?? seg[seg.length - 1];

/* ═════════════════════════ REEL 5 "Three rings" — the quotes, the cut, the answer ═════════════════════════ */
/** the frames MUSIC.ig5 must carry (src/ig/ig5/timing.ts) */
const IG5_KEYS = ['agency', 'answering', 'fortyNine', 'you', 'kick', 'books', 'cta'];

function ig5Harmony(put, P, fb, M) {
  const m = M.ig5;
  const sb = Math.floor(P.stop[0] / 4 + 1e-9) * 4; // the stop's bar (the cut on its line or inside it)
  const rb = Math.ceil(P.stop[1] / 4 - 1e-9) * 4; // the first bar line after the return
  const books = fb(m.books);
  const ctaBar = Math.ceil(fb(m.cta) / 4 - 1e-9) * 4;
  const clip = (a, e, c) => put(Math.max(P.from, a), e, c);
  // the quotes: E · C#m7 · Amaj7 by bar, F#m11 under the answering line, Bsus → B into the cut
  clip(P.from, sb - 16, 'E');
  clip(sb - 16, sb - 12, 'Csm7');
  clip(sb - 12, sb - 8, 'Amaj7');
  clip(sb - 8, sb - 4, 'Fsm11');
  clip(sb - 4, sb - 2, 'Bsus');
  clip(sb - 2, P.stop[1], 'B'); // (cut on the sample from P.stop[0]: silent to the return)
  // the return on "forty-nine": E (the answer), Amaj7 under the set-up, B under "It picks up when you can't," → E ON "books"
  put(P.stop[1], rb + 4, 'Emaj9');
  put(rb + 4, Math.min(rb + 8, books), 'Amaj7');
  put(Math.min(rb + 8, books), books, 'B');
  put(books, ctaBar, 'E');
  put(ctaBar, P.roll, 'Amaj7');
  put(P.roll, P.impact, 'B');
  put(P.impact, fb(M.end) + 4, 'Efin');
}

function ig5Parts({ P, fb, M, seg, CH, chordAt, sec, LEN, out, keys, drums, bass, putPiano, feltKick, shaker }) {
  const m = M.ig5;
  const S = {
    stop: P.stop[0],
    ret: P.stop[1],
    answer: fb(m.answering),
    you: fb(m.you),
    kick: fb(m.kick),
    books: fb(m.books),
    cta: fb(m.cta),
  };
  const sb = Math.floor(S.stop / 4 + 1e-9) * 4;
  const rb = Math.ceil(S.ret / 4 - 1e-9) * 4;
  const quotes = (x) => x >= P.from - 1e-6 && x < S.stop - 1e-6;
  /* the 8ths figure: muted and middle (graphite) through the quotes; OPEN an octave up from the beat after the return;
   * a rest on "You"; out from the roll (the build's own 16th plucks there) */
  const FIG = [0, 2, 1, 3, 0, 2, 1, 2];
  const openFrom = Math.ceil(S.ret + 0.75 - 1e-9);
  for (let x = Math.ceil(P.from * 2 - 1e-9) / 2; x < P.roll - 1e-6; x += 0.5) {
    const open = x >= openFrom - 1e-6;
    if (!quotes(x) && !open) continue;
    if (x > S.you - 0.3 && x < S.you + 0.4) continue; // "You": the figure rests an 8th
    const n = chordAt(x).notes;
    const pos = Math.round(x * 2) % 8;
    const v = (open ? 0.42 : 0.36) * (pos % 2 === 0 ? 1 : 0.8) * (pos === 0 ? 1.1 : 1);
    putPiano(keys, x, n[FIG[pos] % n.length] + (open ? 12 : 0), v, pos % 2 ? 0.22 : -0.22, { dur: open ? 0.8 : 0.55, mute: open ? 0.2 : 0.55, seed: pos % 3, g: open ? 0.26 : 0.3 });
  }
  /* the shaker: soft 8ths under the agency quote, brushed 16ths from the answering line into the cut; 8ths again with
   * the kick (does → the roll) */
  for (let x = Math.ceil(P.from * 2 - 1e-9) / 2; x < Math.min(S.answer, S.stop) - 1e-6; x += 0.5) shaker(drums, x, Math.round(x * 2) % 2 ? 0.055 : 0.042, Math.round(x * 2) % 8);
  for (let x = Math.ceil(S.answer * 4 - 1e-9) / 4; x < S.stop - 1e-6; x += 0.25) {
    const pos = Math.round(x * 4) % 4;
    shaker(drums, x, pos === 0 ? 0.05 : pos === 2 ? 0.042 : 0.03, pos + 4, 0.2);
  }
  const kick0 = Math.ceil(S.kick / 2 - 1e-9) * 2;
  for (let x = Math.ceil(kick0 * 2 - 1e-9) / 2; x < P.roll - 1e-6; x += 0.5) shaker(drums, x, Math.round(x * 2) % 2 ? 0.058 : 0.044, Math.round(x * 2) % 8);
  /* a light felt kick on 1 and 3 from MUSIC.ig5.kick (does) to the roll */
  for (let x = kick0; x < P.roll - 1e-6; x += 2) feltKick(drums, x, Math.round(x) % 4 === 0 ? 0.4 : 0.32);
  /* the sub on each bar's one and every chord change: through the quotes (never into the cut) and from the return */
  for (const sg of seg) {
    if (sg.a >= P.roll - 1e-6) continue;
    for (let x = sg.a; x < sg.e - 1e-6; x = Math.floor(x / 4 + 1e-9) * 4 + 4) {
      if (x >= S.stop - 1e-6 && x < S.ret - 1e-6) continue;
      const len = Math.min(1.1, sg.e - x, x < S.stop ? S.stop - x : 9);
      subNote(bass, sec(x), sec(len) - 0.03, CH[sg.c].root - 12 + (CH[sg.c].root < 43 ? 12 : 0), 0.12, { att: 0.02, rel: 0.2 });
    }
  }
  /* the strings: a low pad under the quotes; the SWELL into the cut (low strings growing over the two bars before it,
   * ending ON it: the stop takes them); the pad AN OCTAVE UP from the return to the set-up's bar; a low pad under the
   * set-up and the call; the CTA's crescendo into the build */
  {
    const spans = [];
    for (const sg of seg) {
      for (const [x0, x1, oct, g] of [
        [Math.max(sg.a, P.from), Math.min(sg.e, sb - 8), 0, 0.12],
        [Math.max(sg.a, S.ret), Math.min(sg.e, rb + 4), 12, 0.22],
        [Math.max(sg.a, rb + 4), Math.min(sg.e, S.cta), 0, 0.12],
      ]) {
        if (x1 <= x0 + 1e-6) continue;
        for (const n of CH[sg.c].str) spans.push([sec(x0) - (x0 === S.ret ? 0 : 0.03), sec(x1), n + oct, g]);
      }
    }
    addStereo(out, stringSection(LEN, spans, { att: 0.5, rel: 0.7, cut: 2500, seed: 11 }), 0, 1);
    const sw = [];
    for (let x = sb - 8; x < S.stop - 1e-6; x += 1) {
      const a = Math.max(x, P.from);
      for (const n of chordAt(a).str) sw.push([sec(a) - 0.02, sec(Math.min(S.stop + 0.5, x + 1)), n - 12 + (n < 52 ? 12 : 0), 0.08 + 0.3 * ((x - (sb - 8)) / (S.stop - (sb - 8))) ** 1.4]);
    }
    addStereo(out, stringSection(LEN, sw, { att: 0.3, rel: 0.2, cut: 2200, seed: 12 }), 0, 1);
    const cr = [];
    const a0 = Math.min(S.cta, P.impact - 6);
    for (let x = a0; x < P.impact - 1e-6; x += 1) for (const n of chordAt(x).str) cr.push([sec(x) - 0.02, sec(Math.min(P.impact, x + 1)), n, 0.12 + 0.5 * ((x - a0) / (P.impact - a0)) ** 1.5]);
    addStereo(out, stringSection(LEN, cr, { att: 0.25, rel: 0.2, cut: 3000, seed: 13 }), 0, 1);
  }
  /* "forty-nine": the bed returns — an open E rolled on the felt piano over a low E (the answer) */
  CH.E.notes.forEach((n, i) => putPiano(keys, S.ret + 0.02 * i, n + (i > 1 ? 12 : 0), 0.46, (i - 1.5) * 0.15, { dur: 2.2, seed: 3 + i, g: 0.24 }));
  putPiano(keys, S.ret, 40, 0.42, 0, { dur: 2.2, seed: 9, g: 0.26 });
  /* "books": a bright open E under the mallet (the call resolved) */
  CH.E.notes.forEach((n, i) => putPiano(keys, S.books + 0.02 * i, n + 12, 0.5, (i - 1.5) * 0.16, { dur: 1.6, seed: 6 + i, g: 0.2 }));
}

/* ═════════════════════════ the bed ═════════════════════════ */

export function bed(T) {
  const I = inputs(T);
  if (I.REEL !== 'ig5') throw new Error(`scripts/ig5/bed.mjs is ig5's arrangement (REEL ${JSON.stringify(I.REEL)})`);
  const BEAT = 60 / I.BPM; // seconds per beat
  const fb = (frame) => frame / I.BEAT; // frames → beats
  const sec = (beat) => beat * BEAT;
  const M = I.MUSIC;
  for (const k of IG5_KEYS) if (!Number.isFinite(M.ig5?.[k])) throw new Error(`scripts/ig5/bed.mjs: MUSIC.ig5.${k} is ${JSON.stringify(M.ig5?.[k])}`);
  if (!M.stop) throw new Error('scripts/ig5/bed.mjs: MUSIC.stop (the cut before "Ours?") is missing');
  const END = I.DURATION / I.BEAT;
  const P = {
    from: fb(M.bedFrom ?? 0),
    roll: fb(M.roll),
    impact: fb(M.impact),
    brand: fb(M.brand),
    stop: [fb(M.stop[0]), fb(M.stop[1])],
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
  const seg = [];
  const put = (a, e, c) => {
    if (e > a + 1e-6) seg.push({ a, e, c });
  };
  ig5Harmony(put, P, fb, M);
  const chordAt = (x) => CH[segAt(seg, x).c];

  const keys = stereo(LEN);
  const drums = stereo(LEN);
  const bass = stereo(LEN);
  const kickTimes = [];
  const { putPiano, feltKick, kick, shaker, snare, crash, pluck, epiano } = kitAt(sec, kickTimes);

  ig5Parts({ P, fb, M, seg, CH, chordAt, sec, LEN, out, keys, drums, bass, putPiano, feltKick, shaker });

  /* ── the build (the IG bed's, unchanged): a half-bar snare roll (16ths → 32nds) and 8th kicks into the impact, 16th
   * plucks; MUSIC.build: kick / snare gain ×, where the kicks and the roll stop, the inhale's length and depth ── */
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

  /* ── E ON the logo (the IG bed's): the crash (choked 50 ms before the name), a long low E, the resolution ── */
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
    // THE INHALE: the beat before the logo the bed is drawn in, back at unity ON the hit
    const i0 = Math.round(sec(P.impact - BLD.inhale) * SR);
    const i1 = Math.round(sec(P.impact) * SR);
    const back = Math.round(0.002 * SR);
    const dip = 1 - gain(BLD.inhaleDb);
    const down = Math.max(1, i1 - back - i0);
    for (let c = 0; c < 2; c++) {
      for (let i = i0; i < i1 && i < glued[c].length; i++) glued[c][i] *= i < i1 - back ? 1 - dip * smooth((i - i0) / down) : 1 - dip * ((i1 - i) / back);
    }
  }
  // THE STOP (MUSIC.stop): the bed and its tails cut on the sample at its 16th (a 1 ms ramp); the RETURN is exact — the
  // gate is back at unity ON MUSIC.stop[1] (a 2 ms ramp ending there), so the rolled E on "forty-nine" keeps its attack
  {
    const a = Math.round(sec(P.stop[0]) * SR);
    const e = Math.round(sec(P.stop[1]) * SR);
    const r0 = Math.round(0.001 * SR);
    const r1 = Math.round(0.002 * SR);
    for (const c of glued) for (let i = Math.max(0, a - r0); i < Math.min(c.length, e); i++) c[i] *= i < a ? (a - i) / r0 : i < e - r1 ? 0 : (i - (e - r1)) / r1;
  }
  // nothing before the bed's start (the hook: the ring and her voice in room tone alone)
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
