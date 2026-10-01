#!/usr/bin/env node
/**
 * Neuro Tech Voice trailer — the whole soundtrack, synthesised and mixed from scratch.
 *
 * Pure Node (no dependencies), deterministic (seeded noise). Reads the film's
 * timeline from src/timing.ts and writes 48 kHz / 24-bit stereo WAVs:
 *
 *   public/sfx/<sound>[-k].wav  every effect family and its round-robin variants,
 *                               dry, each at a -12 dBFS peak   (scripts/audio/sounds.mjs)
 *   public/sfx/bed.wav          the 120 BPM music bed in E major, -20 dBFS peak (scripts/audio/bed.mjs)
 *   public/sfx/mix.wav          THE MASTER: voices + bed + every cue in CUES, ducked, roomed,
 *                               at MIX.lufs with a MIX.ceiling dBTP true-peak limit (scripts/audio/mix.mjs)
 *   out/audio/stem-*.wav        the voice / bed / effects stems of that master (for QA)
 *
 * src/Soundtrack.tsx plays mix.wav. Run automatically by remotion.config.ts
 * before `remotion studio|render` (skipped when nothing it reads has changed),
 * or by hand: `npm run sfx` (add --force to rebuild).
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SR, fades, normalise, writeWav, writeAtomic, peak, db, readWav } from './audio/dsp.mjs';
import { library, peakTime } from './audio/sounds.mjs';
import { bed } from './audio/bed.mjs';
import { master } from './audio/mix.mjs';
import { buildHash } from './audio/hash.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const PUBLIC = path.join(ROOT, 'public');
const OUT = path.join(PUBLIC, 'sfx');
const QA = path.join(ROOT, 'out', 'audio');
const SFX_PEAK_DB = -12;
const BED_PEAK_DB = -20;
const force = process.argv.includes('--force');

const t0 = Date.now();
const T = await import(path.join(ROOT, 'src', 'timing.ts'));

/* ── skip when nothing that shapes the sound has changed ── */
const hash = buildHash(T, ROOT);
const stamp = path.join(OUT, 'mix.json');
if (!force && existsSync(stamp) && existsSync(path.join(OUT, 'mix.wav'))) {
  try {
    if (JSON.parse(readFileSync(stamp, 'utf8')).hash === hash) {
      console.log(`[sfx] up to date (${hash}) — skipped`);
      process.exit(0);
    }
  } catch {
    /* rebuild */
  }
}

mkdirSync(OUT, { recursive: true });
mkdirSync(QA, { recursive: true });

/* ── partial caches: the library and the bed are only re-synthesised when what they read changes ── */
const keyOf = (files, data) => {
  const h = createHash('sha256');
  for (const f of files) h.update(readFileSync(path.join(HERE, 'audio', f)));
  h.update(JSON.stringify(data));
  return h.digest('hex').slice(0, 16);
};
const cached = (jsonFile, key, files) => {
  try {
    return !force && JSON.parse(readFileSync(path.join(OUT, jsonFile), 'utf8')).key === key && files.every((f) => existsSync(path.join(PUBLIC, f)));
  } catch {
    return false;
  }
};
const loadSt = (f) => {
  const w = readWav(path.join(PUBLIC, f));
  return [w.ch[0], w.ch[1] ?? w.ch[0]];
};

/* ── the library ── */
const libKey = keyOf(['sounds.mjs', 'dsp.mjs'], {
  SFX: Object.fromEntries(Object.entries(T.SFX).map(([k, d]) => [k, [d.n, d.pk]])), notes: T.LIGHT_NOTES, disclose: T.CALL_LOCAL.disclose, ring: [T.HOOK.ring, T.HOOK_LOCAL.ringB], buzz: T.TWIST_LOCAL.buzz, fps: T.FPS,
});
const libFiles = Object.entries(T.SFX).flatMap(([name, def]) =>
  Array.from({ length: def.n }, (_, k) => `sfx/${def.n > 1 ? `${name}-${k}` : name}.wav`),
);
const lib = new Map();
const written = new Set(['bed.wav', 'mix.wav']);
let libNote = 'cached';
if (cached('lib.json', libKey, libFiles)) {
  for (const f of libFiles) lib.set(f, loadSt(f));
} else {
  libNote = 'synthesised';
  const raw = library(T);
  const pkErrors = [];
  for (const [file, st] of raw) {
    const out = normalise(fades(st, 0.3, 12), SFX_PEAK_DB);
    lib.set(file, out);
    writeWav(path.join(PUBLIC, file), out);
    const name = path.basename(file, '.wav');
    const def = T.SFX[name] ?? T.SFX[name.replace(/-\d+$/, '')];
    if (def && def.pk > 0) {
      const pt = peakTime(out) * T.FPS;
      if (Math.abs(pt - def.pk) > 1.25) pkErrors.push(`${name}: peak at ${pt.toFixed(1)} f, designed ${def.pk} f`);
    }
  }
  for (const f of libFiles) if (!lib.has(f)) throw new Error(`[sfx] no generator for ${f}`);
  if (pkErrors.length) console.warn(`[sfx] pre-roll peaks off: ${pkErrors.join('; ')}`);
  writeAtomic(path.join(OUT, 'lib.json'), Buffer.from(JSON.stringify({ key: libKey, files: libFiles.length })));
}
for (const f of libFiles) written.add(path.basename(f));

/* ── the bed ── */
const bedKey = keyOf(['bed.mjs', 'dsp.mjs'], {
  S: T.SCENES, H: T.HOOK, C: [T.CALL.bookedMark, T.CALL.length], R: T.RESULT, K: T.KNOWLEDGE, KL: T.KNOWLEDGE_LOCAL.closingKey,
  A: T.vWord(T.KNOWLEDGE.answerVoice, 0), SC: T.SCALE, CTA: T.CTA, D: T.DURATION, BPM: T.BPM,
});
let bedSt;
let bedNote = 'cached';
if (cached('bed.json', bedKey, ['sfx/bed.wav'])) bedSt = loadSt('sfx/bed.wav');
else {
  bedNote = 'composed';
  bedSt = normalise(bed(T).st, BED_PEAK_DB);
  writeWav(path.join(OUT, 'bed.wav'), bedSt);
  writeAtomic(path.join(OUT, 'bed.json'), Buffer.from(JSON.stringify({ key: bedKey })));
}

/* ── the master ── */
const m = master(T, lib, bedSt, { publicDir: PUBLIC });
writeWav(path.join(OUT, 'mix.wav'), m.mix);
for (const [k, st] of Object.entries(m.stems)) writeWav(path.join(QA, `stem-${k}.wav`), st);

// stale files from earlier designs
for (const f of readdirSync(OUT)) if ((f.endsWith('.wav') || f.includes('.tmp-')) && !written.has(f)) rmSync(path.join(OUT, f));

const r = m.report;
writeAtomic(stamp, Buffer.from(JSON.stringify({ hash, frames: T.DURATION, samples: m.mix[0].length, sr: SR, ...r }, null, 2)));
console.log(
  `[sfx] ${libFiles.length} sounds (${libNote}, ${SFX_PEAK_DB} dBFS peak) + bed (${bedNote}, ${db(peak(bedSt)).toFixed(1)} dBFS peak) + master: ` +
    `${r.lufs.toFixed(1)} LUFS, ${r.truePeakDb.toFixed(2)} dBTP (gain ${r.masterGainDb >= 0 ? '+' : ''}${r.masterGainDb.toFixed(1)} dB, ` +
    `limiter ${r.limiterMaxGrDb.toFixed(1)} dB max) — ${T.CUES.length} cues, ${T.VOICES.length} lines, ${((Date.now() - t0) / 1000).toFixed(1)} s`,
);
