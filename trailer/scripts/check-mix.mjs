#!/usr/bin/env node
/**
 * Mix QA (npm run check:audio). Proves the master before a long render:
 *
 *   · public/sfx/mix.wav is current (its build hash matches the timeline, voices and sound code) and as long as the film
 *   · integrated loudness within MIX.lufs ± 1 LU, true peak ≤ -1.0 dBTP (4× oversampled), no clipping
 *   · every effect file peaks at ≤ -12 dBFS, the bed at ≤ -20 dBFS
 *   · DIALOGUE: every voice file at the one dialogue target (voice-lines.json level.lufs ± 0.5,
 *     BS.1770 integrated, mono) and every line in the dialogue stem at MIX.dialogueLufs ± dialogueTol;
 *     every phone-line caller keeps its presence (1.4–2.8 kHz ≥ -16 dB of the line's power)
 *   · THE CLIMAX: the momentary loudness (400 ms) from the logo impact beats the loudest dialogue
 *     moment of the master by MIX.impact.lead LU, and the 400 ms before the hit by MIX.impact.suck LU
 *   · THE END: the last 100 ms are below -55 dBFS RMS and the last frame below -60 dBFS
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
import { readWav, lufs, truePeak, peak, db, Biquad, SR } from './audio/dsp.mjs';
import { buildHash } from './audio/hash.mjs';
import { integrated, momentary, rmsDb } from './audio/loudness.mjs';

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
if (stamp.hash !== buildHash(T, ROOT)) fails.push('mix.wav is stale (the timeline, the voices or the sound code changed since it was built) — run `npm run sfx`');

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

/* ── dialogue: one loudness for every line ── */
const vcfg = JSON.parse(readFileSync(path.join(HERE, 'voice-lines.json'), 'utf8'));
const LV = { lufs: -23, ...(vcfg.level ?? {}) };
const fileL = {};
const bandShare = (m, sr, lo, hi) => {
  const f = [lo, lo, hi, hi].map((x, k) => {
    const w = (2 * Math.PI * x) / sr, c = Math.cos(w), al = Math.sin(w) / (2 * 0.7), hp = k < 2;
    const b = hp ? [(1 + c) / 2, -(1 + c), (1 + c) / 2] : [(1 - c) / 2, 1 - c, (1 - c) / 2];
    const a0 = 1 + al;
    return { b: b.map((v) => v / a0), a: [(-2 * c) / a0, (1 - al) / a0], x1: 0, x2: 0, y1: 0, y2: 0 };
  });
  let zb = 0, zt = 0;
  for (const x of m) {
    let v = x;
    for (const q of f) {
      const y = q.b[0] * v + q.b[1] * q.x1 + q.b[2] * q.x2 - q.a[0] * q.y1 - q.a[1] * q.y2;
      q.x2 = q.x1; q.x1 = v; q.y2 = q.y1; q.y1 = y; v = y;
    }
    zb += v * v; zt += x * x;
  }
  return 10 * Math.log10(zb / zt);
};
const presence = {};
for (const v of T.VOICES) {
  const w = readWav(path.join(PUBLIC, 'voice', `${v.id}.wav`));
  fileL[v.id] = integrated([w.ch[0]], w.sr);
  if (Math.abs(fileL[v.id] - LV.lufs) > 0.5) fails.push(`dialogue: ${v.id}.wav is ${fileL[v.id].toFixed(1)} LUFS (target ${LV.lufs} ± 0.5) — run \`npm run voice:remaster\``);
  if (vcfg.voices?.[VOICE.lines[v.id].voice]?.phone) {
    presence[v.id] = bandShare(w.ch[0], w.sr, 1400, 2800);
    if (presence[v.id] < -16) fails.push(`dialogue: ${v.id} (phone line) is dull — 1.4–2.8 kHz at ${presence[v.id].toFixed(1)} dB of the line (≥ -16)`);
  }
}
const stemL = {};
if (existsSync(path.join(QA, 'stem-voice.wav'))) {
  const vs = st(path.join(QA, 'stem-voice.wav'));
  for (const v of T.VOICES) {
    stemL[v.id] = integrated(vs, SR, { from: v.at / T.FPS, to: (v.at + T.vFrames(v.id)) / T.FPS - 0.4 });
    if (Math.abs(stemL[v.id] - T.MIX.dialogueLufs) > T.MIX.dialogueTol)
      fails.push(`dialogue: ${v.id} sits at ${stemL[v.id].toFixed(1)} LUFS in the dialogue stem (target ${T.MIX.dialogueLufs} ± ${T.MIX.dialogueTol})`);
  }
}

/* ── the climax: the logo impact is the loudest moment ── */
const MM = momentary(mix, SR, { hop: 1 / T.FPS });
const mAt = (f) => MM[Math.max(0, Math.min(MM.length - 1, Math.round(f)))];
const IMP = T.MIX.impact;
let dMax = { lufs: -Infinity, f: 0, id: '' };
for (const r of MM) {
  const f0 = r.t * T.FPS;
  const f1 = f0 + 0.4 * T.FPS;
  if (f1 > IMP.at && f0 < IMP.at + 0.4 * T.FPS) continue; // the impact's own windows
  const k = T.SPEECH.findIndex(([a, e]) => f0 >= a && f1 <= e + 3);
  if (k >= 0 && r.lufs > dMax.lufs) dMax = { lufs: r.lufs, f: f0, id: T.VOICES[k].id };
}
const impM = mAt(IMP.at).lufs;
const suckM = mAt(IMP.at - 0.4 * T.FPS).lufs;
if (impM < dMax.lufs + IMP.lead)
  fails.push(`climax: the logo impact is ${impM.toFixed(1)} LUFS-M, the loudest dialogue ${dMax.lufs.toFixed(1)} (${dMax.id} @${dMax.f.toFixed(0)}) — needs ≥ +${IMP.lead} LU`);
if (impM - suckM < IMP.suck) fails.push(`climax: only ${(impM - suckM).toFixed(1)} LU between the build (${suckM.toFixed(1)}) and the impact (${impM.toFixed(1)}) — needs ≥ ${IMP.suck}`);

/* ── the end resolves into silence ── */
const dur = mix[0].length / SR;
const end100 = rmsDb(mix, SR, dur - 0.1, dur);
const endFrame = rmsDb(mix, SR, dur - 1 / T.FPS, dur);
if (end100 > -55) fails.push(`the end is cut, not resolved: last 100 ms at ${end100.toFixed(1)} dBFS RMS (≤ -55)`);
if (endFrame > -60) fails.push(`the last frame is at ${endFrame.toFixed(1)} dBFS RMS (≤ -60)`);

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
const spread = (o) => { const v = Object.values(o); return v.length ? Math.max(...v) - Math.min(...v) : 0; };
console.log(`dialogue      files ${LV.lufs} LUFS ± ${(spread(fileL) / 2).toFixed(2)} · stem ${Object.entries(stemL).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(' · ')} (spread ${spread(stemL).toFixed(1)} LU)`);
if (Object.keys(presence).length) console.log(`presence      phone lines 1.4–2.8 kHz: ${Object.entries(presence).map(([k, v]) => `${k} ${v.toFixed(1)} dB`).join(' · ')}`);
console.log(`climax        logo impact ${impM.toFixed(1)} LUFS-M · loudest dialogue ${dMax.lufs.toFixed(1)} (${dMax.id} @${dMax.f.toFixed(0)}) · lead ${fmt(impM - dMax.lufs)} LU · build before it ${suckM.toFixed(1)}`);
console.log(`end           last 100 ms ${end100.toFixed(1)} dBFS RMS · last frame ${endFrame.toFixed(1)} dBFS`);
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
