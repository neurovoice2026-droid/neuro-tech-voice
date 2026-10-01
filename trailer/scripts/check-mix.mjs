#!/usr/bin/env node
/**
 * Mix QA (npm run check:audio). Proves the master before a long render:
 *
 *   · public/sfx/mix.wav is current (its build hash matches the timeline + voices) and as long as the film
 *   · integrated loudness within MIX.lufs ± 1 LU, true peak ≤ -1.0 dBTP (4× oversampled), no clipping
 *   · every effect file peaks at ≤ -12 dBFS, the bed at ≤ -20 dBFS
 *   · no word is masked: at every spoken word onset (200 ms), an SII-style intelligibility index
 *     (ANSI S3.5 octave-band importances; maskers = the effects stem incl. rooms + the ducked bed)
 *     must be ≥ 0.7 — a key hit designed to land on a word may dip to 0.55 (reported)
 *   · writes out/audio/cue-timeline.txt: every cue onset/peak and every word onset, in order
 *
 *   node --experimental-strip-types --no-warnings scripts/check-mix.mjs [--quiet]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readWav, lufs, truePeak, peak, db, Biquad, SR, gain } from './audio/dsp.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const PUBLIC = path.join(ROOT, 'public');
const QA = path.join(ROOT, 'out', 'audio');
const quiet = process.argv.includes('--quiet');
const T = await import(path.join(ROOT, 'src', 'timing.ts'));
const { VOICE } = await import(path.join(ROOT, 'src', 'voice.generated.ts'));

const fails = [];
const notes = [];
const st = (f) => {
  const w = readWav(f);
  return [w.ch[0], w.ch[1] ?? w.ch[0]];
};
const fmt = (x, d = 1) => (x >= 0 ? '+' : '') + x.toFixed(d);

/* ── is the master current? ── */
const stampF = path.join(PUBLIC, 'sfx', 'mix.json');
if (!existsSync(stampF)) {
  console.error('no public/sfx/mix.json — run `npm run sfx` first');
  process.exit(1);
}
const stamp = JSON.parse(readFileSync(stampF, 'utf8'));
const mix = st(path.join(PUBLIC, T.MIX.file));
const wantN = Math.round((T.DURATION / T.FPS) * SR);
if (mix[0].length !== wantN) fails.push(`mix.wav is ${mix[0].length} samples, the film needs ${wantN} — stale: run \`npm run sfx\``);
if (stamp.frames !== T.DURATION) fails.push(`mix.wav was built for ${stamp.frames} frames, the film is ${T.DURATION}`);

/* ── loudness / peaks ── */
const L = lufs(mix);
const tp = db(truePeak(mix));
const sp = db(peak(mix));
if (Math.abs(L - T.MIX.lufs) > 1) fails.push(`integrated ${L.toFixed(1)} LUFS (target ${T.MIX.lufs} ± 1)`);
if (tp > -1.0) fails.push(`true peak ${tp.toFixed(2)} dBTP > -1.0`);
if (sp >= 0) fails.push('the master clips');
const bedP = db(peak(st(path.join(PUBLIC, T.BED.file))));
if (bedP > -19.95) fails.push(`bed peaks at ${bedP.toFixed(2)} dBFS (> -20)`);
let sfxMax = -Infinity;
let sfxWorst = '';
for (const f of new Set(T.CUES.map((c) => c.file))) {
  const p = db(peak(st(path.join(PUBLIC, f))));
  if (p > sfxMax) { sfxMax = p; sfxWorst = f; }
}
if (sfxMax > -11.95) fails.push(`${sfxWorst} peaks at ${sfxMax.toFixed(2)} dBFS (> -12)`);
const louderCue = T.CUES.filter((c) => c.vol > 1.0001);
if (louderCue.length) fails.push(`${louderCue.length} cue(s) play above unity (would exceed the -12 dBFS SFX peak)`);

/* ── intelligibility at every word: an SII-style index (ANSI S3.5 octave-band importances) ── */
const OCT = [[180, 355, 0.0617], [355, 710, 0.1671], [710, 1400, 0.2373], [1400, 2800, 0.2648], [2800, 5600, 0.2142], [5600, 11000, 0.0549]];
const bandOf = (s, lo, hi) => {
  const m = new Float32Array(s[0].length);
  for (let i = 0; i < m.length; i++) m[i] = (s[0][i] + s[1][i]) * 0.5;
  const f = [new Biquad('hp', lo, 0.7), new Biquad('hp', lo, 0.7), new Biquad('lp', hi, 0.7), new Biquad('lp', hi, 0.7)];
  for (let i = 0; i < m.length; i++) {
    let v = m[i];
    for (const b of f) v = b.run(v);
    m[i] = v;
  }
  return m;
};
const rms = (m, a, e) => {
  const i0 = Math.max(0, Math.round(a * SR));
  const i1 = Math.min(m.length, Math.round(e * SR));
  let z = 0;
  for (let i = i0; i < i1; i++) z += m[i] * m[i];
  return Math.sqrt(z / Math.max(1, i1 - i0));
};
const words = T.VOICES.flatMap((v) =>
  VOICE.lines[v.id].words.map((w, k) => ({ f: v.at + w.t * T.FPS, w: w.w, id: v.id, k })),
);
let maskRows = [];
const SII_OK = 0.7; // ≥ 0.7 ≈ fully intelligible speech
const SII_KEY = 0.55; // a key hit designed to land on a word may dip to this
if (['voice', 'sfx', 'bed'].every((k) => existsSync(path.join(QA, `stem-${k}.wav`)))) {
  const v = st(path.join(QA, 'stem-voice.wav'));
  const fx = st(path.join(QA, 'stem-sfx.wav'));
  const bd = st(path.join(QA, 'stem-bed.wav'));
  const mk = [new Float32Array(fx[0].length), new Float32Array(fx[0].length)];
  for (let c = 0; c < 2; c++) for (let i = 0; i < mk[c].length; i++) mk[c][i] = fx[c][i] + (bd[c][i] ?? 0);
  const vb = OCT.map(([lo, hi]) => bandOf(v, lo, hi));
  const mb = OCT.map(([lo, hi]) => bandOf(mk, lo, hi));
  const fb = OCT.map(([lo, hi]) => bandOf(fx, lo, hi));
  for (const w of words) {
    const t = w.f / T.FPS;
    let sii = 0;
    let siiFx = 0;
    for (let k = 0; k < OCT.length; k++) {
      const s0 = rms(vb[k], t, t + 0.2);
      const snr = db(s0) - db(rms(mb[k], t - 0.02, t + 0.2));
      const snrFx = db(s0) - db(rms(fb[k], t - 0.02, t + 0.2));
      sii += OCT[k][2] * Math.min(1, Math.max(0, (snr + 15) / 30));
      siiFx += OCT[k][2] * Math.min(1, Math.max(0, (snrFx + 15) / 30));
    }
    const near = T.CUES.filter((c) => c.hit >= w.f - 6 && c.hit <= w.f + 4);
    maskRows.push({ ...w, sii, siiFx, near });
  }
  for (const r of maskRows) {
    if (r.sii >= SII_OK) continue;
    const keys = r.near.filter((c) => c.key);
    const msg = `word “${r.w}” (${r.id} @${r.f.toFixed(0)}): intelligibility ${r.sii.toFixed(2)} (effects alone ${r.siiFx.toFixed(2)}) — ${r.near.map((c) => path.basename(c.file, '.wav')).join(', ') || 'tails / bed'}`;
    if (keys.length && r.sii >= SII_KEY) notes.push(`key hit on a word (allowed): ${msg}`);
    else fails.push(`masking: ${msg}`);
  }
} else notes.push('no stems in out/audio — run `npm run sfx` for the masking check');

/* ── the timeline ── */
mkdirSync(QA, { recursive: true });
const lines = [];
const ev = [
  ...T.CUES.map((c) => ({ f: c.at, kind: 'cue', c })),
  ...words.map((w) => ({ f: w.f, kind: 'word', w })),
].sort((a, b) => a.f - b.f || (a.kind === 'word' ? 1 : -1));
const sceneOf = (f) => Object.entries(T.SCENES).find(([, s]) => f >= s.from && f < s.to)?.[0] ?? 'end';
let lastScene = '';
for (const e of ev) {
  const sc = sceneOf(e.kind === 'cue' ? e.c.hit : e.f);
  if (sc !== lastScene) {
    lines.push(`\n── ${sc.toUpperCase()} (${T.SCENES[sc]?.from ?? ''}–${T.SCENES[sc]?.to ?? ''}) ${'─'.repeat(40)}`);
    lastScene = sc;
  }
  const tc = (f) => `${f.toFixed(1).padStart(7)} f  ${(f / T.FPS).toFixed(3).padStart(7)} s`;
  if (e.kind === 'word') {
    const m = maskRows.find((r) => r.id === e.w.id && r.k === e.w.k);
    lines.push(`${tc(e.f)}   ▶ “${e.w.w}”  (${e.w.id})${m ? `   intelligibility ${m.sii.toFixed(2)}` : ''}`);
  } else {
    const c = e.c;
    const pan = Array.isArray(c.pan) ? `${fmt(c.pan[0], 2)}→${fmt(c.pan[1], 2)}` : fmt(c.pan, 2);
    const pk = c.hit - c.at > 0.05 ? ` peak@${c.hit.toFixed(1)}` : '';
    lines.push(
      `${tc(c.at)}   ${c.key ? '◆' : '·'} ${path.basename(c.file, '.wav').padEnd(20)} ${fmt(20 * Math.log10(c.vol)).padStart(6)} dB  pan ${pan.padEnd(12)} ${c.rate !== 1 ? `×${c.rate.toFixed(3)}` : '      '} ${c.room === 'white' ? 'W' : 'N'}${pk}  ${c.label}`,
    );
  }
}
writeFileSync(
  path.join(QA, 'cue-timeline.txt'),
  `Neuro Tech Voice — cue timeline (${T.CUES.length} cues, ${words.length} words). ◆ key hit · ▶ spoken word (intelligibility: SII-style, 1 = clear, ≥ 0.7 required)\n` +
    lines.join('\n') +
    '\n',
);

/* ── report ── */
const count = {};
for (const c of T.CUES) count[sceneOf(c.hit)] = (count[sceneOf(c.hit)] ?? 0) + 1;
const worst = [...maskRows].sort((a, b) => a.sii - b.sii).slice(0, 5);
console.log(`master        ${L.toFixed(1)} LUFS integrated · ${tp.toFixed(2)} dBTP true peak · ${sp.toFixed(2)} dBFS sample peak`);
console.log(`levels        effects ≤ ${sfxMax.toFixed(1)} dBFS · bed ${bedP.toFixed(1)} dBFS · master gain ${fmt(stamp.masterGainDb)} dB · limiter ≤ ${stamp.limiterMaxGrDb.toFixed(1)} dB`);
console.log(`cues          ${T.CUES.length}: ${Object.entries(count).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
if (maskRows.length) {
  const mean = maskRows.reduce((a, r) => a + r.sii, 0) / maskRows.length;
  console.log(`words         ${maskRows.length} — intelligibility (SII-style, 1 = clear) mean ${mean.toFixed(2)}, lowest: ${worst.map((r) => `“${r.w}” ${r.sii.toFixed(2)}`).join(', ')}`);
}
console.log(`timeline      out/audio/cue-timeline.txt`);
if (!quiet) for (const n of notes) console.log(`note          ${n}`);
for (const f of fails) console.log(`FAIL          ${f}`);
console.log(fails.length ? `${fails.length} problem(s)` : 'OK');
process.exit(fails.length ? 1 : 0);
