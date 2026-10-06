#!/usr/bin/env node
/**
 * The Instagram reels' soundtracks — the sound driver of docs/ig/PIPELINE.md §6.2 (all four reels; each skipped by its
 * own hash).
 *
 *   node --experimental-strip-types --no-warnings scripts/ig/generate-sfx.mjs [--force] [--only=ig2[,ig3]]
 *   (npm run sfx:ig[:force]; scripts/sfx.mjs --film=ig<n> spawns it too, without the --film flag: it builds every reel)
 *
 *   1. imports every reel's timeline (src/ig/<reel>/timing.ts) and checks its contract (PIPELINE.md §6.1): every export
 *      present, REEL = its id, VOICES sorted and not overlapping, MIX.name.voice among them, MIX.fadeOut ending on
 *      DURATION, MIX.file / BED.file directly in ig/sfx/<reel>/, rooms only night / white, every number master() reads
 *      from MIX / DUCK / BED finite, every voice WAV present, every cue file in the reels' library (ig/sfx/lib/) or an
 *      IG extra (ig/sfx/fx-*), every SCREENS span inside its line's words (captions ≤ 7 words)
 *   2. THE LIBRARY (all four reels' cues, so one reel's new sound never stales another's stamp later): every
 *      ig/sfx/lib/<name>.wav that is missing is BYTE-COPIED from film 1's public/sfx/<name>.wav or film 2's
 *      public/kb/sfx/<name>.wav (read-only on the source; exactly one must exist), and public/ig/sfx/lib.json records
 *      its source and sha256. Copies are made once: a later rebuild of a film's library can never change a reel. A
 *      missing source STOPS the build (film 1's / film 2's drivers are never run from here); a copy whose bytes no
 *      longer match lib.json stops it too.
 *   3. per reel (the --only ones, default all): skips when igHash (scripts/ig/hash.mjs) matches
 *      public/ig/sfx/<reel>/mix.json and MIX.file and the QA stems (out/audio/ig/<reel>/stem-*.wav) are there
 *   4. IG extras (public/ig/sfx/fx-*.wav, scripts/ig/sounds.mjs `extras(T)`), only when a cue sheet uses any
 *   5. the bed (scripts/ig/bed.mjs) → public/ig/sfx/<reel>/bed.wav at −20 dBFS peak, cached on bed.json (bed.mjs +
 *      dsp.mjs + inputs(T)); the mix is always fed the bed AS READ BACK from bed.wav
 *   6. THE MASTER: film 1's unchanged master() (scripts/audio/mix.mjs) with publicDir = public/ig (voices from
 *      public/ig/voice/) → public/ig/sfx/<reel>/mix.wav; stems → out/audio/ig/<reel>/stem-*.wav
 *   7. removes stale files only inside public/ig/sfx/<reel>/, then writes the stamp mix.json (only for a mix whose
 *      loudness and true peak are finite)
 *
 * Writes ONLY public/ig/sfx/ and out/audio/ig/. Files bound for public/ig/sfx/ are staged in out/audio/ig/.tmp/ and
 * renamed into place (public/ never holds a vanishing temp file). Never run it while a film 1 or film 2 bundle is being
 * made (H15: every bundle lists public/).
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SR, db, encodeWav, fades, normalise, peak, readWav, writeWav } from '../audio/dsp.mjs';
import { master } from '../audio/mix.mjs';
import { bed, inputs as bedInputs } from './bed.mjs';
import { IG_FILMS, IG_IDS } from './films.mjs';
import { igHash } from './hash.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', '..');
const PUBLIC = path.join(ROOT, 'public');
const IG_PUBLIC = path.join(PUBLIC, 'ig');
const SFX_DIR = path.join(IG_PUBLIC, 'sfx');
const LIB = 'ig/sfx/lib';
const LIB_DIR = path.join(PUBLIC, LIB);
const LIB_JSON = path.join(SFX_DIR, 'lib.json');
const QA_ROOT = path.join(ROOT, 'out', 'audio', 'ig');
const STAGE = path.join(QA_ROOT, '.tmp');
/** where a library sound may come from (read-only): film 1's library, then film 2's extras */
const SOURCES = [path.join(PUBLIC, 'sfx'), path.join(PUBLIC, 'kb', 'sfx')];
const SFX_PEAK_DB = -12;
const BED_PEAK_DB = -20;
const argv = process.argv.slice(2);
const force = argv.includes('--force');
const onlyArg = argv.find((a) => a.startsWith('--only='))?.slice(7);
const ONLY = onlyArg ? onlyArg.split(',').map((s) => s.trim()).filter(Boolean) : IG_IDS;
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const say = (m) => console.log(`[sfx:ig] ${m}`);
const fail = (m) => {
  console.error(`[sfx:ig] ${m}`);
  process.exit(1);
};
for (const id of ONLY) if (!IG_IDS.includes(id)) fail(`--only: unknown reel "${id}" (known: ${IG_IDS.join(', ')})`);
if (argv.some((a) => a.startsWith('--') && a !== '--force' && !a.startsWith('--only='))) fail(`unknown option(s) ${argv.filter((a) => a.startsWith('--')).join(' ')} (known: --force --only=ig<n>[,…])`);

const t0 = Date.now();
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

/* ── staging: files bound for public/ig/sfx/ are written in out/audio/ig/.tmp/ and renamed into place ── */
mkdirSync(STAGE, { recursive: true });
const publish = (file, buf) => {
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = path.join(STAGE, `${path.basename(file)}.${process.pid}`);
  writeFileSync(tmp, buf);
  try {
    renameSync(tmp, file);
  } catch (e) {
    rmSync(tmp, { force: true });
    throw e;
  }
};
const publishWav = (relFile, st) => publish(path.join(PUBLIC, relFile), encodeWav(st));

/* ── 1. every reel's timeline and its contract ── */
const TL = {};
for (const id of IG_IDS) {
  try {
    TL[id] = await import(path.join(ROOT, IG_FILMS[id].timing));
  } catch (e) {
    fail(`${id}: ${IG_FILMS[id].timing} does not load — ${e.message}`);
  }
}
const contract = (id, T, VOICE) => {
  const errs = [];
  const need = {
    REEL: 'string', FPS: 'number', RENDER_FPS: 'number', SUB: 'number', BPM: 'number', BEAT: 'number', DURATION: 'number',
    VERTICAL: 'object', SCENES: 'object', ORDER: 'object', IMPACT: 'number', END: 'number', VOICES: 'object', vFrames: 'function',
    vWord: 'function', voiceCut: 'function', voiceEnd: 'function', SPEECH: 'object', PHRASES: 'object', speaking: 'function',
    SCREENS: 'object', DISPLAY: 'object', DUCK: 'object', SFX: 'object', HITS: 'object', CUES: 'object', BED: 'object',
    MIX: 'object', MUSIC: 'object', GRAIN: 'object', roomAt: 'function', END_CARD: 'object',
  };
  for (const [k, type] of Object.entries(need)) if (typeof T[k] !== type) errs.push(`export ${k} is missing (or not a ${type})`);
  if (errs.length) return errs;
  if (T.REEL !== id) errs.push(`REEL is "${T.REEL}", the registry entry is "${id}"`);
  if (T.FPS !== 30 || T.BPM !== 120 || T.SUB !== 4) errs.push(`the house grid is 30 fps × 4 / 120 BPM (got ${T.FPS} × ${T.SUB} / ${T.BPM})`);
  if (T.VERTICAL.width !== 1080 || T.VERTICAL.height !== 1920) errs.push(`VERTICAL is ${T.VERTICAL.width}×${T.VERTICAL.height}, the reels are 1080×1920`);
  if (T.DURATION % 1 || T.DURATION <= 0) errs.push(`DURATION ${T.DURATION} is not a whole number of frames`);
  if (T.DURATION < 600 || T.DURATION > 840) errs.push(`DURATION ${T.DURATION} f (${(T.DURATION / 30).toFixed(1)} s) is outside 20–28 s`);
  if (T.END !== T.DURATION) errs.push(`END ${T.END} ≠ DURATION ${T.DURATION}`);
  if (T.IMPACT % 60) errs.push(`IMPACT ${T.IMPACT} is not on a bar line`);
  if (T.DURATION - T.IMPACT !== 60) errs.push(`the impact must land one bar before the end (IMPACT ${T.IMPACT}, END ${T.DURATION})`);
  const V = T.VOICES;
  for (let k = 1; k < V.length; k++) {
    if (V[k].at < V[k - 1].at) errs.push(`VOICES is not sorted by at (${V[k - 1].id}@${V[k - 1].at} before ${V[k].id}@${V[k].at})`);
    else if (V[k - 1].until === undefined && V[k - 1].at + T.vFrames(V[k - 1].id) > V[k].at)
      errs.push(`${V[k - 1].id}@${V[k - 1].at} (${T.vFrames(V[k - 1].id)} f) still plays when ${V[k].id} starts @${V[k].at}`);
  }
  if (V.length > new Set(V.map((v) => v.id)).size && V.some((v) => v.until !== undefined)) errs.push('VOICES repeats a line id AND cuts lines (until): the odd-line QA stem cannot be rebuilt then');
  const last = V[V.length - 1];
  if (last && last.at + T.vFrames(last.id) > T.DURATION - 14) errs.push(`the last line ${last.id} ends at ${last.at + T.vFrames(last.id)}, inside the seam (${T.DURATION - 14}–${T.DURATION})`);
  if (!V.some((v) => v.id === T.MIX.name?.voice)) errs.push(`MIX.name.voice "${T.MIX.name?.voice}" is not in VOICES`);
  if (!T.MIX.impact || T.MIX.impact.at !== T.IMPACT) errs.push(`MIX.impact.at (${T.MIX.impact?.at}) ≠ IMPACT (${T.IMPACT})`);
  if (!Array.isArray(T.MIX.fadeOut) || T.MIX.fadeOut[1] !== T.DURATION) errs.push(`MIX.fadeOut must end on DURATION (${T.DURATION})`);
  if (!Array.isArray(T.MIX.arc?.windows)) errs.push('MIX.arc.windows is missing');
  if (!Array.isArray(T.BED.ride) || !T.BED.ride.length) errs.push('BED.ride needs at least one point');
  for (const f of [T.BED.file, T.MIX.file])
    if (typeof f !== 'string' || path.posix.dirname(f) !== `ig/sfx/${id}` || !f.endsWith('.wav')) errs.push(`${f}: a reel's soundtrack files are ig/sfx/${id}/<name>.wav`);
  if (T.BED.file === T.MIX.file) errs.push(`BED.file and MIX.file are the same file (${T.MIX.file})`);
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
  T.BED.ride.forEach((p, i) => {
    if (!Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite)) errs.push(`BED.ride[${i}] is ${JSON.stringify(p)} (needs [frame, dB], both finite)`);
  });
  for (const [i, w] of (T.MIX.arc?.windows ?? []).entries())
    if (!Array.isArray(w) || w.length !== 2 || !w.every(Number.isFinite)) errs.push(`MIX.arc.windows[${i}] is ${JSON.stringify(w)} (needs [from, to] frames)`);
  for (const r of new Set(T.CUES.map((c) => c.room))) if (r !== 'night' && r !== 'white') errs.push(`a cue plays in room "${r}" (only night / white exist)`);
  for (const c of T.CUES)
    if (!(path.posix.dirname(c.file) === LIB || /^ig\/sfx\/fx-[^/]+\.wav$/.test(c.file))) errs.push(`cue "${c.label}": ${c.file} is neither in the reels' library (${LIB}/) nor an IG extra (ig/sfx/fx-*.wav)`);
  for (const vid of new Set(V.map((v) => v.id))) if (!existsSync(path.join(IG_PUBLIC, 'voice', `${vid}.wav`))) errs.push(`public/ig/voice/${vid}.wav is missing — run \`npm run voice:ig\``);
  // the screens: every span inside its line's words, in order, captions ≤ 7 words; every placed line has its screens
  const words = (vid) => VOICE.lines[vid]?.words?.length ?? null;
  for (const v of V) if (!T.SCREENS[v.id]) errs.push(`SCREENS has no entry for ${v.id} (every line on screen says what it shows)`);
  for (const [vid, s] of Object.entries(T.SCREENS)) {
    const n = words(vid);
    let prev = -1;
    for (const [a, e] of s.spans) {
      if (!(Number.isInteger(a) && Number.isInteger(e) && a <= e)) errs.push(`SCREENS ${vid}: span [${a}, ${e}] is not a word range`);
      if (a <= prev) errs.push(`SCREENS ${vid}: span [${a}, ${e}] overlaps or precedes the one before`);
      if (n !== null && e >= n) errs.push(`SCREENS ${vid}: span [${a}, ${e}] runs past the line's ${n} words`);
      if (s.kind === 'caption' && e - a + 1 > 7) errs.push(`SCREENS ${vid}: a caption screen of ${e - a + 1} words (≤ 7)`);
      prev = e;
    }
  }
  for (const d of T.DISPLAY) {
    const n = words(d.id);
    if (!T.SCREENS[d.id]) errs.push(`DISPLAY "${d.text}": ${d.id} has no screens`);
    if (n !== null && (d.from > d.to || d.to >= n)) errs.push(`DISPLAY "${d.text}": span [${d.from}, ${d.to}] is not inside ${d.id}'s ${n} words`);
  }
  return errs;
};
/* the reels' cue machinery (src/ig/common/cues.ts) is the port src/lib/cuesheet.ts token for token — its header and the
 * relative path of film 1's constants aside (a fork only because film 2's check-port forbids naming the port outside
 * src/kb/: see its header). A drifted fork would build cues the films' machinery would not. */
{
  const code = (f) => {
    const s = readFileSync(path.join(ROOT, f), 'utf8');
    return s.slice(s.indexOf('import {'));
  };
  const port = code('src/lib/cuesheet.ts').replace("from '../timing.ts'", "from '../../timing.ts'");
  if (code('src/ig/common/cues.ts') !== port) fail('src/ig/common/cues.ts is no longer src/lib/cuesheet.ts token for token (below the header): re-fork it');
}
{
  const { VOICE } = await import(path.join(ROOT, 'src', 'ig', 'voice.generated.ts'));
  const errs = IG_IDS.flatMap((id) => contract(id, TL[id], VOICE).map((e) => `${id}: contract: ${e}`));
  if (errs.length) {
    for (const e of errs) console.error(`[sfx:ig] ${e}`);
    process.exit(1);
  }
}

/* ── 2. the library: byte copies of film 1's / film 2's sounds (read-only on the sources), once ── */
const libJson = (() => {
  try {
    return JSON.parse(readFileSync(LIB_JSON, 'utf8'));
  } catch {
    return { files: {} };
  }
})();
let libChanged = false;
{
  const want = [...new Set(IG_IDS.flatMap((id) => TL[id].CUES.map((c) => c.file)).filter((f) => path.posix.dirname(f) === LIB))].sort();
  const copied = [];
  for (const f of want) {
    const name = path.posix.basename(f);
    const dst = path.join(PUBLIC, f);
    const rec = libJson.files[name];
    if (existsSync(dst) && rec) {
      if (sha(readFileSync(dst)) !== rec.sha256) fail(`${f} no longer matches public/ig/sfx/lib.json (${rec.source}, ${rec.sha256.slice(0, 12)}…): delete it to copy it again`);
      continue;
    }
    const srcs = SOURCES.map((d) => path.join(d, name)).filter((p) => existsSync(p));
    if (srcs.length === 0)
      fail(`${f}: its source ${name} is in neither ${SOURCES.map(rel).join('/ nor ')}/ — build that film's own library first (npm run sfx / npm run sfx:kb); the reels' driver never runs another film's driver`);
    if (srcs.length > 1) fail(`${f}: ${name} exists in both ${srcs.map(rel).join(' and ')} — ambiguous source`);
    mkdirSync(LIB_DIR, { recursive: true });
    const tmp = path.join(STAGE, `${name}.${process.pid}`);
    copyFileSync(srcs[0], tmp); // a byte copy; the source is only read
    const s = sha(readFileSync(tmp));
    renameSync(tmp, dst);
    libJson.files[name] = { source: rel(srcs[0]), sha256: s };
    libChanged = true;
    copied.push(name);
  }
  if (libChanged) {
    const sorted = Object.fromEntries(Object.keys(libJson.files).sort().map((k) => [k, libJson.files[k]]));
    publish(LIB_JSON, Buffer.from(JSON.stringify({ note: 'byte copies of film 1 (public/sfx) and film 2 (public/kb/sfx) sounds, made once by scripts/ig/generate-sfx.mjs', files: sorted }, null, 2) + '\n'));
  }
  say(`library: ${want.length} sounds in ${LIB}/${copied.length ? ` (${copied.length} copied now: ${copied.join(', ')})` : ' (all present)'}`);
}

/* ── per reel: 3. skip · 4. extras · 5. bed · 6. master · 7. stamp ── */
const loadSt = (f) => {
  const w = readWav(path.join(PUBLIC, f));
  if (w.sr !== SR) throw new Error(`[sfx:ig] ${f} is at ${w.sr} Hz (the mix runs at ${SR})`);
  return [w.ch[0], w.ch[1] ?? w.ch[0]];
};
const keyOf = (files, data) => {
  const h = createHash('sha256');
  for (const f of files) h.update(readFileSync(f));
  h.update(JSON.stringify(data));
  return h.digest('hex').slice(0, 16);
};
const libCache = new Map();
const libSt = (f) => {
  if (!libCache.has(f)) libCache.set(f, loadSt(f));
  return libCache.get(f);
};
let built = 0;
for (const id of ONLY) {
  const T = TL[id];
  const OUT = path.join(SFX_DIR, id);
  const QA = path.join(QA_ROOT, id);
  const STEMS = ['voice', 'voice-odd', 'bed', 'sfx'].map((k) => path.join(QA, `stem-${k}.wav`));
  const stamp = path.join(OUT, 'mix.json');
  const r0 = Date.now();

  /* 3. skip when nothing that shapes the sound has changed */
  if (!force && existsSync(stamp) && existsSync(path.join(PUBLIC, T.MIX.file)) && STEMS.every((f) => existsSync(f))) {
    try {
      const h = igHash(T, ROOT);
      if (JSON.parse(readFileSync(stamp, 'utf8')).hash === h) {
        say(`${id}: up to date (${h}) — skipped`);
        continue;
      }
    } catch {
      /* rebuild */
    }
  }
  mkdirSync(OUT, { recursive: true });
  mkdirSync(QA, { recursive: true });
  const cueFiles = [...new Set(T.CUES.map((c) => c.file))].sort();
  const written = new Set([path.basename(T.MIX.file), path.basename(T.BED.file), 'mix.json', 'bed.json']);

  /* 4. IG extras (public/ig/sfx/fx-*.wav), only when the cue sheet uses any */
  const extraFiles = cueFiles.filter((f) => path.posix.dirname(f) === 'ig/sfx');
  let extraNote = 'none';
  if (extraFiles.length) {
    const soundsF = path.join(HERE, 'sounds.mjs');
    if (!existsSync(soundsF)) fail(`${id}: the cue sheet plays IG extras (${extraFiles.join(', ')}) but scripts/ig/sounds.mjs does not exist`);
    const { extras } = await import(soundsF);
    const raw = extras(T);
    for (const f of extraFiles) {
      if (!raw.has(f)) fail(`${id}: scripts/ig/sounds.mjs has no generator for ${f}`);
      publishWav(f, normalise(fades(raw.get(f), 0.3, 12), SFX_PEAK_DB));
    }
    extraNote = `${extraFiles.length} synthesised`;
  }

  /* 5. the bed, keyed on exactly what bed.mjs reads + its code and the DSP kit */
  const bedKey = keyOf([path.join(HERE, 'bed.mjs'), path.join(ROOT, 'scripts', 'audio', 'dsp.mjs')], bedInputs(T));
  let bedNote = 'cached';
  let cachedBed = false;
  try {
    cachedBed = !force && JSON.parse(readFileSync(path.join(OUT, 'bed.json'), 'utf8')).key === bedKey && existsSync(path.join(PUBLIC, T.BED.file));
  } catch {
    cachedBed = false;
  }
  if (!cachedBed) {
    bedNote = 'composed';
    publishWav(T.BED.file, normalise(bed(T).st, BED_PEAK_DB));
    publish(path.join(OUT, 'bed.json'), Buffer.from(JSON.stringify({ key: bedKey })));
  }
  const bedSt = loadSt(T.BED.file);

  /* 6. the master (film 1's unchanged mixer; voices from public/ig/voice/) */
  const lib = new Map(cueFiles.map((f) => [f, libSt(f)]));
  const m = master(T, lib, bedSt, { publicDir: IG_PUBLIC });
  const r = m.report;
  if (!Number.isFinite(r.lufs) || !Number.isFinite(r.truePeakDb)) fail(`${id}: the master came out ${r.lufs} LUFS / ${r.truePeakDb} dBTP — not written, not stamped (a NaN in the timeline's mix numbers?)`);
  publishWav(T.MIX.file, m.mix);
  // a line placed more than once: rebuild the odd-line QA stem by span slicing (film 2's driver, step 7)
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

  /* 7. stale files ONLY inside public/ig/sfx/<reel>/, then the stamp (the hash of what this build left) */
  for (const f of readdirSync(OUT)) if ((f.endsWith('.wav') || f.endsWith('.json') || f.includes('.tmp')) && !written.has(f)) rmSync(path.join(OUT, f));
  publish(stamp, Buffer.from(JSON.stringify({ hash: igHash(T, ROOT), frames: T.DURATION, samples: m.mix[0].length, sr: SR, ...r }, null, 2)));
  built++;
  say(
    `${id}: ${cueFiles.length} library sounds + extras (${extraNote}) + bed (${bedNote}, ${db(peak(bedSt)).toFixed(1)} dBFS peak) + master: ` +
      `${r.lufs.toFixed(1)} LUFS, ${r.truePeakDb.toFixed(2)} dBTP (gain ${r.masterGainDb >= 0 ? '+' : ''}${r.masterGainDb.toFixed(1)} dB, limiter ${r.limiterMaxGrDb.toFixed(1)} dB max) — ` +
      `${T.CUES.length} cues, ${T.VOICES.length} lines, ${(T.DURATION / T.FPS).toFixed(1)} s → ${rel(path.join(PUBLIC, T.MIX.file))} in ${((Date.now() - r0) / 1000).toFixed(1)} s`,
  );
}
rmSync(STAGE, { recursive: true, force: true });
say(`${built} built, ${ONLY.length - built} up to date — ${((Date.now() - t0) / 1000).toFixed(1)} s`);
