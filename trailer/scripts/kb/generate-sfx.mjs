#!/usr/bin/env node
/**
 * Film 2 ("kb") — the whole soundtrack: the sound driver of docs/kb/PIPELINE.md §5.
 *
 *   node --experimental-strip-types --no-warnings scripts/kb/generate-sfx.mjs [--force]
 *   (npm run sfx:kb[:force], scripts/sfx.mjs --film=kb, or remotion.config.ts's pre-step for a
 *   command whose entry point is src/kb/index.ts / NTV_FILM=kb)
 *
 *   1. imports film 2's timeline (src/kb/timing.ts) and checks its contract (§4): every export present,
 *      VOICES sorted and not overlapping, MIX.name.voice among them, every cue room night / white, every
 *      voice WAV present, a repeated line always on the same odd / even stem (check-mix measures by id)
 *      and never together with a cut (`until`) line, MIX.file / BED.file directly in kb/sfx/, and every
 *      number master() reads from MIX / DUCK / BED finite (a missing one would mix NaN, silently)
 *   2. FILM 1's LIBRARY, read-only: the cues' sfx/… files come from public/sfx/ as film 1's driver made
 *      them; only if one of them (or public/sfx/lib.json) is missing — a fresh clone — film 1's own
 *      driver (scripts/generate-sfx.mjs, unchanged) is run once to make them. Film 2 never writes there.
 *   3. skips in ~0.2 s when kbHash (scripts/kb/hash.mjs) matches public/kb/sfx/mix.json and MIX.file and
 *      the QA stems (out/audio/kb/stem-*.wav, which check-mix measures dialogue on) are all there
 *   4. film 2's own extras (kb/sfx/fx-*.wav, scripts/kb/sounds.mjs), only when the cue sheet uses any
 *   5. the bed (scripts/kb/bed.mjs) → public/kb/sfx/bed.wav at −20 dBFS peak, cached on bed.json, keyed on
 *      bed.mjs's own inputs(T) (everything it reads); the mix is always fed the bed AS READ BACK from
 *      bed.wav, so a composed and a cached bed give the same mix.wav bytes for the same hash
 *   6. THE MASTER: film 1's unchanged master() (scripts/audio/mix.mjs) with publicDir = public/kb
 *      (voices from public/kb/voice/) → public/kb/sfx/mix.wav, stems → out/audio/kb/stem-*.wav
 *   7. removes stale files only inside public/kb/sfx/, then writes the mix.json stamp (only for a mix
 *      whose loudness and true peak are finite numbers)
 *
 * Writes ONLY public/kb/sfx/ and out/audio/kb/ (PIPELINE.md H3, H5). Files bound for public/kb/sfx/ are
 * staged in out/audio/kb/.tmp/ and renamed into place, so public/ never holds a vanishing `.tmp-` file
 * (a `remotion bundle` of either film stats every public/ file). Still: do not run this while a film 1
 * bundle is being made (render-master step 1) — the static-file list it scans would change under it.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SR, db, encodeWav, fades, normalise, peak, readWav, writeWav } from '../audio/dsp.mjs';
import { master } from '../audio/mix.mjs';
import { bed, inputs as bedInputs } from './bed.mjs';
import { kbHash } from './hash.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', '..');
const PUBLIC = path.join(ROOT, 'public');
const KB_PUBLIC = path.join(PUBLIC, 'kb');
const OUT = path.join(KB_PUBLIC, 'sfx');
const QA = path.join(ROOT, 'out', 'audio', 'kb');
const STEMS = ['voice', 'voice-odd', 'bed', 'sfx'].map((k) => path.join(QA, `stem-${k}.wav`));
const SFX_PEAK_DB = -12;
const BED_PEAK_DB = -20;
const force = process.argv.includes('--force');
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

const t0 = Date.now();
const T = await import(path.join(ROOT, 'src', 'kb', 'timing.ts'));

/* ── 1. the contract (PIPELINE.md §4, H11) ── */
{
  const errs = [];
  const need = {
    FPS: 'number', RENDER_FPS: 'number', SUB: 'number', BPM: 'number', BEAT: 'number', DURATION: 'number',
    LANDSCAPE: 'object', VERTICAL: 'object', SCENES: 'object', VOICES: 'object', vFrames: 'function', vWord: 'function',
    voiceCut: 'function', SPEECH: 'object', PHRASES: 'object', speaking: 'function', DUCK: 'object', SFX: 'object',
    HITS: 'object', CUES: 'object', BED: 'object', MIX: 'object', MUSIC: 'object',
  };
  for (const [k, type] of Object.entries(need)) if (typeof T[k] !== type) errs.push(`export ${k} is missing (or not a ${type})`);
  if (!errs.length) {
    if (T.FPS !== 30 || T.BPM !== 120) errs.push(`the house grid is 30 fps / 120 BPM (got ${T.FPS} / ${T.BPM})`);
    const V = T.VOICES;
    for (let k = 1; k < V.length; k++) {
      if (V[k].at < V[k - 1].at) errs.push(`VOICES is not sorted by at (${V[k - 1].id}@${V[k - 1].at} before ${V[k].id}@${V[k].at})`);
      else if (V[k - 1].until === undefined && V[k - 1].at + T.vFrames(V[k - 1].id) > V[k].at)
        errs.push(`${V[k - 1].id}@${V[k - 1].at} (${T.vFrames(V[k - 1].id)} f) still plays when ${V[k].id} starts @${V[k].at}`);
    }
    const parity = {};
    V.forEach((v, k) => {
      if (parity[v.id] !== undefined && parity[v.id] !== k % 2) errs.push(`${v.id} repeats on the other odd/even stem (lines ${parity[v.id]} vs ${k}): check-mix measures lines by id`);
      parity[v.id] ??= k % 2;
    });
    // a repeated id makes this driver rebuild the odd-line QA stem by slicing the dialogue stem at the
    // lines' starts (step 7); that is exact only while no line plays into the next one's span — a cut line
    // (`until`) overlaps the voice that cuts in, and its cutRoom tail runs on. Until the odd stem is built
    // per placement, the two cannot be combined (check-mix's per-line levels and masking would be wrong).
    const repeats = V.length > new Set(V.map((v) => v.id)).size;
    const cuts = V.filter((v) => v.until !== undefined);
    if (repeats && cuts.length)
      errs.push(`VOICES repeats a line id AND cuts lines (until: ${cuts.map((v) => `${v.id}@${v.at}`).join(', ')}): the odd-line QA stem cannot be rebuilt by span slicing then — drop one, or build the odd stem per placement first`);
    if (!V.some((v) => v.id === T.MIX.name?.voice)) errs.push(`MIX.name.voice "${T.MIX.name?.voice}" is not in VOICES`);
    if (!T.MIX.impact || typeof T.MIX.impact.at !== 'number') errs.push('MIX.impact is missing');
    if (!Array.isArray(T.MIX.fadeOut) || T.MIX.fadeOut[1] !== T.DURATION) errs.push(`MIX.fadeOut must end on DURATION (${T.DURATION})`);
    if (!Array.isArray(T.MIX.arc?.windows)) errs.push('MIX.arc.windows is missing');
    if (!Array.isArray(T.BED.ride) || !T.BED.ride.length) errs.push('BED.ride needs at least one point');
    for (const f of [T.BED.file, T.MIX.file])
      if (typeof f !== 'string' || path.posix.dirname(f) !== 'kb/sfx' || !f.endsWith('.wav')) errs.push(`${f}: film 2's soundtrack files are kb/sfx/<name>.wav`);
    if (T.BED.file === T.MIX.file) errs.push(`BED.file and MIX.file are the same file (${T.MIX.file})`);
    // every number master() (scripts/audio/mix.mjs) and check-mix read from MIX / DUCK / BED: one missing
    // field would mix NaN — a silent or NaN mix.wav stamped as current, "NaN LUFS" and exit 0
    const at = (o, p) => p.split('.').reduce((x, k) => (x == null ? undefined : x[k]), o);
    const NUM = {
      MIX: ['lufs', 'ceiling', 'dialogueLufs', 'dialogueTol', 'dialogueCeil', 'airLp', 'fadeK', 'fadeOut.0', 'fadeOut.1',
        'impact.at', 'impact.rideDb', 'impact.hold.0', 'impact.hold.1', 'impact.release', 'impact.ceil', 'impact.knee', 'impact.lead', 'impact.suck',
        'name.lookahead', 'name.release', 'name.tonalDb', 'name.tailsDb', 'name.sii',
        'cutRoom.k', 'cutRoom.db', 'cutRoom.room.rt60', 'cutRoom.room.rt60Hi', 'cutRoom.room.pre', 'cutRoom.room.size', 'cutRoom.room.hp', 'cutRoom.room.lp',
        'arc.lead', 'arc.ringDb'],
      DUCK: ['bedDb', 'bedLowDb', 'lowHz', 'eqDb', 'sfxEqDb', 'tailsDb', 'tonalDb', 'keyTonalDb', 'lookahead', 'ramp', 'release'],
      BED: ['vol'],
    };
    for (const [obj, keys] of Object.entries(NUM)) for (const k of keys) if (!Number.isFinite(at(T[obj], k))) errs.push(`${obj}.${k} is ${JSON.stringify(at(T[obj], k)) ?? 'missing'} (master() needs a finite number)`);
    T.BED.ride?.forEach?.((p, i) => {
      if (!Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite)) errs.push(`BED.ride[${i}] is ${JSON.stringify(p)} (needs [frame, dB], both finite)`);
    });
    for (const [i, w] of (T.MIX.arc?.windows ?? []).entries())
      if (!Array.isArray(w) || w.length !== 2 || !w.every(Number.isFinite)) errs.push(`MIX.arc.windows[${i}] is ${JSON.stringify(w)} (needs [from, to] frames)`);
    const rooms = new Set(T.CUES.map((c) => c.room));
    for (const r of rooms) if (r !== 'night' && r !== 'white') errs.push(`a cue plays in room "${r}" (only night / white exist)`);
    for (const c of T.CUES) if (!c.file.startsWith('sfx/') && !c.file.startsWith('kb/sfx/')) errs.push(`cue "${c.label}": ${c.file} is neither film 1's library (sfx/) nor film 2's extras (kb/sfx/)`);
    for (const id of new Set(V.map((v) => v.id))) if (!existsSync(path.join(KB_PUBLIC, 'voice', `${id}.wav`))) errs.push(`public/kb/voice/${id}.wav is missing — run \`npm run voice:kb\``);
    if (T.DURATION % 1 || T.DURATION <= 0) errs.push(`DURATION ${T.DURATION} is not a whole number of frames`);
  }
  if (errs.length) {
    for (const e of errs) console.error(`[sfx:kb] contract: ${e}`);
    process.exit(1);
  }
}

/* ── 2. film 1's library (read-only) ── */
const cueFiles = [...new Set(T.CUES.map((c) => c.file))].sort();
const libFiles = cueFiles.filter((f) => f.startsWith('sfx/'));
const extraFiles = cueFiles.filter((f) => f.startsWith('kb/sfx/'));
if (!existsSync(path.join(PUBLIC, 'sfx', 'lib.json')) || libFiles.some((f) => !existsSync(path.join(PUBLIC, f)))) {
  console.log('[sfx:kb] film 1’s sound library is not built yet: running its own driver once (scripts/generate-sfx.mjs)');
  const r = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', path.join(ROOT, 'scripts', 'generate-sfx.mjs')], { stdio: 'inherit', cwd: ROOT });
  if (r.status !== 0) process.exit(r.status ?? 1);
  const still = libFiles.filter((f) => !existsSync(path.join(PUBLIC, f)));
  if (still.length) throw new Error(`[sfx:kb] film 1's library has no ${still.join(', ')}`);
}

/* ── 3. skip when nothing that shapes the sound has changed ── */
const hash = kbHash(T, ROOT);
const stamp = path.join(OUT, 'mix.json');
// (the QA stems too: without them check-mix --film=kb cannot measure the dialogue, it only notes their absence)
if (!force && existsSync(stamp) && existsSync(path.join(PUBLIC, T.MIX.file)) && STEMS.every((f) => existsSync(f))) {
  try {
    if (JSON.parse(readFileSync(stamp, 'utf8')).hash === hash) {
      console.log(`[sfx:kb] up to date (${hash}) — skipped`);
      process.exit(0);
    }
  } catch {
    /* rebuild */
  }
}
mkdirSync(OUT, { recursive: true });
mkdirSync(QA, { recursive: true });
/* files bound for public/kb/sfx/ are written in out/audio/kb/.tmp/ (same file system) and renamed into place:
 * public/ never holds a half-written or vanishing temp file while a bundle scans it */
const STAGE = path.join(QA, '.tmp');
mkdirSync(STAGE, { recursive: true });
const publish = (file, buf) => {
  const tmp = path.join(STAGE, `${path.basename(file)}.${process.pid}`);
  writeFileSync(tmp, buf);
  try {
    renameSync(tmp, file);
  } catch (e) {
    rmSync(tmp, { force: true });
    throw e;
  }
};
const publishWav = (rel, st) => publish(path.join(PUBLIC, rel), encodeWav(st));

const loadSt = (f) => {
  const w = readWav(path.join(PUBLIC, f));
  if (w.sr !== SR) throw new Error(`[sfx:kb] ${f} is at ${w.sr} Hz (the mix runs at ${SR})`);
  return [w.ch[0], w.ch[1] ?? w.ch[0]];
};
const keyOf = (files, data) => {
  const h = createHash('sha256');
  for (const f of files) h.update(readFileSync(f));
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
/** what this build keeps in public/kb/sfx/ (everything else there that is a .wav or a temp file is stale) */
const written = new Set([path.basename(T.MIX.file), path.basename(T.BED.file), 'mix.json', 'bed.json']);

/* ── 4. film 2's extras (only when the cue sheet uses any) ── */
let extraNote = 'none';
if (extraFiles.length) {
  const soundsF = path.join(HERE, 'sounds.mjs');
  if (!existsSync(soundsF)) throw new Error(`[sfx:kb] the cue sheet plays film 2 extras (${extraFiles.join(', ')}) but scripts/kb/sounds.mjs does not exist yet`);
  const extraDefs = Object.fromEntries(Object.entries(T.SFX).filter(([, d]) => d.dir === 'kb/sfx').map(([k, d]) => [k, [d.n, d.pk]]));
  const libKey = keyOf([soundsF, path.join(ROOT, 'scripts', 'audio', 'dsp.mjs')], { extraDefs, notes: T.LIGHT_NOTES, fps: T.FPS, music: T.MUSIC });
  if (cached('lib.json', libKey, extraFiles)) extraNote = `${extraFiles.length} cached`;
  else {
    const { extras } = await import(soundsF);
    const raw = extras(T);
    for (const [file, st] of raw) {
      if (!file.startsWith('kb/sfx/')) throw new Error(`[sfx:kb] sounds.mjs made ${file}: extras live in kb/sfx/`);
      if (path.posix.dirname(file) !== 'kb/sfx') throw new Error(`[sfx:kb] sounds.mjs made ${file}: extras live directly in kb/sfx/`);
      publishWav(file, normalise(fades(st, 0.3, 12), SFX_PEAK_DB));
    }
    const missing = extraFiles.filter((f) => !raw.has(f));
    if (missing.length) throw new Error(`[sfx:kb] sounds.mjs has no generator for ${missing.join(', ')}`);
    publish(path.join(OUT, 'lib.json'), Buffer.from(JSON.stringify({ key: libKey, files: raw.size })));
    extraNote = `${raw.size} synthesised`;
  }
  written.add('lib.json');
  for (const f of extraFiles) written.add(path.basename(f));
}

/* ── 5. the lib Map the mixer looks cues up in (`c.file`, relative to public/) ── */
const lib = new Map(cueFiles.map((f) => [f, loadSt(f)]));

/* ── 6. the bed ── */
// keyed on exactly what bed.mjs reads (its inputs(T): bed() reads nothing else) + its code and the DSP kit
const bedKey = keyOf([path.join(HERE, 'bed.mjs'), path.join(ROOT, 'scripts', 'audio', 'dsp.mjs')], bedInputs(T));
let bedNote = 'cached';
if (!cached('bed.json', bedKey, [T.BED.file])) {
  bedNote = 'composed';
  publishWav(T.BED.file, normalise(bed(T).st, BED_PEAK_DB));
  publish(path.join(OUT, 'bed.json'), Buffer.from(JSON.stringify({ key: bedKey })));
}
// the mix always gets the bed AS STORED (bed.wav's samples), composed now or cached: one hash, one mix.wav
const bedSt = loadSt(T.BED.file);

/* ── 7. the master (film 1's unchanged mixer; voices from public/kb/voice/) ── */
const m = master(T, lib, bedSt, { publicDir: KB_PUBLIC });
const r = m.report;
if (!Number.isFinite(r.lufs) || !Number.isFinite(r.truePeakDb)) {
  console.error(`[sfx:kb] the master came out ${r.lufs} LUFS / ${r.truePeakDb} dBTP — not written, not stamped (a NaN in the timeline's mix numbers?)`);
  process.exit(1);
}
publishWav(T.MIX.file, m.mix);
/* QA STEM for a line placed more than once (kb2-desk-1 ×3, kb2-c2 ×2): master() adds a line's limiter
 * correction to its trim once PER PLACEMENT (`lineDb[sp.id] += adj[sp.id]`, keyed by id), so its odd-line
 * stem over-counts it for a repeated id (+7 LU on desk-1) — and check-mix's even stem (voice − odd) then
 * carries a negative copy of the line. The mix and the dialogue stem are right (each placement is trimmed
 * once). The odd stem is rebuilt as the dialogue stem over the odd lines' spans (s0 = the line's start,
 * s1 = the next one's). PRECONDITION (the contract enforces it): no line sounds into the next line's span —
 * lines without `until` may not overlap, and a repeated id is refused together with any cut (`until`) line,
 * whose overlap and cutRoom tail would land in the wrong line's span; the dialogue chain is otherwise dry
 * (leveller, trims and limiter are gains), so outside a cut nothing smears across a span boundary. */
if (new Set(T.VOICES.map((v) => v.id)).size < T.VOICES.length) {
  const vox = m.stems.voice;
  const n = vox[0].length;
  const s = (f) => Math.min(n, Math.round((f / T.FPS) * SR));
  const odd = [new Float32Array(n), new Float32Array(n)];
  T.VOICES.forEach((v, k) => {
    if (!(k % 2)) return;
    const a = s(v.at);
    const e = k + 1 < T.VOICES.length ? s(T.VOICES[k + 1].at) : n;
    for (let c = 0; c < 2; c++) odd[c].set(vox[c].subarray(a, e), a);
  });
  m.stems['voice-odd'] = odd;
}
for (const [k, st] of Object.entries(m.stems)) writeWav(path.join(QA, `stem-${k}.wav`), st);

// stale files from earlier designs (and temp files of an interrupted run) — ONLY inside public/kb/sfx/
for (const f of readdirSync(OUT)) if ((f.endsWith('.wav') || f.includes('.tmp-')) && !written.has(f)) rmSync(path.join(OUT, f));

publish(stamp, Buffer.from(JSON.stringify({ hash, frames: T.DURATION, samples: m.mix[0].length, sr: SR, ...r }, null, 2)));
rmSync(STAGE, { recursive: true, force: true });
console.log(
  `[sfx:kb] ${libFiles.length} library sounds (film 1, read-only) + extras (${extraNote}) + bed (${bedNote}, ${db(peak(bedSt)).toFixed(1)} dBFS peak) + master: ` +
    `${r.lufs.toFixed(1)} LUFS, ${r.truePeakDb.toFixed(2)} dBTP (gain ${r.masterGainDb >= 0 ? '+' : ''}${r.masterGainDb.toFixed(1)} dB, ` +
    `limiter ${r.limiterMaxGrDb.toFixed(1)} dB max) — ${T.CUES.length} cues, ${T.VOICES.length} lines, ${(T.DURATION / T.FPS).toFixed(1)} s → ${rel(path.join(PUBLIC, T.MIX.file))} in ${((Date.now() - t0) / 1000).toFixed(1)} s`,
);
