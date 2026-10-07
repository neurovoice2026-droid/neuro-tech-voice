#!/usr/bin/env node
/**
 * ig5's soundtrack — the sound driver of docs/ig/ig5/PIPELINE.md §5.1: a copy-adapt of scripts/ig/generate-sfx.mjs
 * for the fifth reel ONLY. That driver runs on import (and would build ig1–ig4), so it cannot be imported; its
 * contract() check and its step order are copied here, and every sound-shaping function is imported unchanged:
 * master() (scripts/audio/mix.mjs), the DSP kit (scripts/audio/dsp.mjs), bed() / inputs() (scripts/ig/bed.mjs — the
 * stub arrangement — or scripts/ig5/bed.mjs once it exists, §5.3), and igHash through ig5Hash (scripts/ig5/hash.mjs).
 *
 *   node --experimental-strip-types --no-warnings scripts/ig5/generate-sfx.mjs [--force]      (npm run sfx:ig5[:force];
 *   scripts/sfx.mjs --film=ig5 spawns it too)
 *
 *   1. imports src/ig/ig5/timing.ts and checks the IG contract (scripts/ig/generate-sfx.mjs contract(): every export,
 *      REEL 'ig5', the house grid, 20–28 s, the impact one bar before the end, VOICES sorted and not overlapping,
 *      MIX.name.voice placed, MIX.fadeOut on DURATION, MIX.file / BED.file directly in ig/sfx/ig5/, rooms night /
 *      white, every number master() reads finite, every SCREENS span inside its line's words, captions ≤ 7 words),
 *      PLUS ig5's own: every cue file is (a) in the SHARED library ig/sfx/lib/ — READ-ONLY, present, and its sha256
 *      equal to the shared public/ig/sfx/lib.json record; or (b) the shared ig/sfx/fx-impact-end.wav — READ-ONLY, must
 *      exist; or (c) under ig/sfx/ig5/; every VOICES id is ig5-* or the borrow ig1-07; every voice WAV exists
 *   2. ig5's OWN LIBRARY: a sound ig5 needs that is not among the shared copies is routed by its timing
 *      (SFX5 dir 'ig/sfx/ig5/lib') and BYTE-COPIED, read-only on its source, from film 1's public/sfx/ or film 2's
 *      public/kb/sfx/ into public/ig/sfx/ig5/lib/, recorded in public/ig/sfx/ig5/lib.json. The shared public/ig/sfx/lib/
 *      and lib.json are NEVER written.
 *   3. skips when ig5Hash matches public/ig/sfx/ig5/mix.json and MIX.file and the QA stems (out/audio/ig/ig5/stem-*.wav)
 *      are there
 *   4. extras: ig/sfx/fx-impact-end.wav (impactHits) is played AS IS and never re-published (the IG driver re-makes it on
 *      every ig1–ig4 rebuild; ig5 must not race it). A new ig5 extra goes only to public/ig/sfx/ig5/fx-*.wav, from
 *      scripts/ig5/sounds.mjs `extras(T)` (which does not exist yet: a cue sheet that plays one fails until it does)
 *   5. the bed → public/ig/sfx/ig5/bed.wav at −20 dBFS peak, cached on bed.json (the bed code + dsp.mjs + inputs(T)); the
 *      mix is always fed the bed AS READ BACK from bed.wav
 *   6. THE MASTER: film 1's unchanged master() with publicDir = public/ig → public/ig/sfx/ig5/mix.wav; stems →
 *      out/audio/ig/ig5/stem-*.wav
 *   7. removes stale files only at the TOP LEVEL of public/ig/sfx/ig5/ (lib.json and lib/ kept), then writes the stamp
 *      mix.json (only for a mix whose loudness and true peak are finite)
 *
 * Writes ONLY public/ig/sfx/ig5/ and out/audio/ig/{ig5,.tmp-ig5}/. Files bound for public/ are staged in
 * out/audio/ig/.tmp-ig5/ (never the shared .tmp/, which the IG driver deletes) and renamed into place. Never run it
 * while a film 1 or film 2 bundle is being made (H15: every bundle lists public/).
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SR, db, encodeWav, fades, normalise, peak, readWav, writeWav } from '../audio/dsp.mjs';
import { master } from '../audio/mix.mjs';
import { IG5_FILMS } from './films.mjs';
import { ig5Hash } from './hash.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', '..');
const ID = 'ig5';
const FILM = IG5_FILMS[ID];
const PUBLIC = path.join(ROOT, 'public');
const IG_PUBLIC = path.join(PUBLIC, 'ig');
const SFX_DIR = path.join(IG_PUBLIC, 'sfx');
const OUT = path.join(SFX_DIR, ID);
/** the reels' SHARED library (read-only here) and ig5's own */
const SHARED_LIB = 'ig/sfx/lib';
const SHARED_LIB_JSON = path.join(SFX_DIR, 'lib.json');
const OWN_LIB = `ig/sfx/${ID}/lib`;
const OWN_LIB_JSON = path.join(OUT, 'lib.json');
const SHARED_EXTRA = 'ig/sfx/fx-impact-end.wav';
const QA_ROOT = path.join(ROOT, 'out', 'audio', 'ig');
const QA = path.join(ROOT, FILM.qa);
const STAGE = path.join(QA_ROOT, `.tmp-${ID}`);
/** where a library sound may come from (read-only): film 1's library, then film 2's extras */
const SOURCES = [path.join(PUBLIC, 'sfx'), path.join(PUBLIC, 'kb', 'sfx')];
const SFX_PEAK_DB = -12;
const BED_PEAK_DB = -20;
const argv = process.argv.slice(2);
const force = argv.includes('--force');
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const say = (m) => console.log(`[sfx:ig5] ${m}`);
const fail = (m) => {
  console.error(`[sfx:ig5] ${m}`);
  rmSync(STAGE, { recursive: true, force: true });
  process.exit(1);
};
if (argv.some((a) => a !== '--force')) fail(`unknown option(s) ${argv.filter((a) => a !== '--force').join(' ')} (known: --force)`);
if (path.join(ROOT, FILM.stamp) !== path.join(OUT, 'mix.json')) fail(`the registry's stamp ${FILM.stamp} is not public/ig/sfx/ig5/mix.json`);

const t0 = Date.now();
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

/* ── staging: files bound for public/ig/sfx/ig5/ are written in out/audio/ig/.tmp-ig5/ and renamed into place ── */
mkdirSync(STAGE, { recursive: true });
const inOwn = (file) => {
  const r = path.relative(OUT, file);
  return r && !r.startsWith('..') && !path.isAbsolute(r);
};
const publish = (file, buf) => {
  if (!inOwn(file)) fail(`refusing to write ${rel(file)}: this driver writes only public/ig/sfx/ig5/`);
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

/* ── 1. the timeline and its contract ── */
let T;
try {
  T = await import(path.join(ROOT, FILM.timing));
} catch (e) {
  fail(`${FILM.timing} does not load — ${e.message}`);
}
const { VOICE } = await import(path.join(ROOT, FILM.voiceTs));
/** the IG contract — scripts/ig/generate-sfx.mjs contract() verbatim but for the cue-file rule (ig5's, below) */
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
  for (const vid of new Set(V.map((v) => v.id))) if (!existsSync(path.join(IG_PUBLIC, 'voice', `${vid}.wav`))) errs.push(`public/ig/voice/${vid}.wav is missing — run \`${FILM.cmd.voice}\``);
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
/** ig5's own rules (PIPELINE §5.1 step 2): its voices, and where each cue file may live */
const sharedLib = (() => {
  try {
    return JSON.parse(readFileSync(SHARED_LIB_JSON, 'utf8')).files ?? {};
  } catch {
    return {};
  }
})();
const own = (T) => {
  const errs = [];
  for (const vid of new Set(T.VOICES.map((v) => v.id))) if (!/^ig5-/.test(vid) && vid !== 'ig1-07') errs.push(`VOICES places ${vid}: ig5 places only ig5-* lines and the borrowed sign-off ig1-07`);
  for (const f of [...new Set(T.CUES.map((c) => c.file))].sort()) {
    const dir = path.posix.dirname(f);
    if (dir === SHARED_LIB) {
      const name = path.posix.basename(f);
      const rec = sharedLib[name];
      const p = path.join(PUBLIC, f);
      if (!rec) errs.push(`cue file ${f} is not among the shared library's copies (public/ig/sfx/lib.json): route its family to ig5's own library (SFX5 … dir '${OWN_LIB}')`);
      else if (!existsSync(p)) errs.push(`cue file ${f} is missing from the shared library (run \`npm run sfx:ig\` with the guard green; this driver never writes it)`);
      else if (sha(readFileSync(p)) !== rec.sha256) errs.push(`cue file ${f} no longer matches the shared lib.json (${rec.sha256.slice(0, 12)}…)`);
    } else if (f === SHARED_EXTRA) {
      if (!existsSync(path.join(PUBLIC, f))) errs.push(`${f} is missing (the IG driver makes it: run \`npm run sfx:ig\` with the guard green; this driver never writes it)`);
    } else if (!(dir === OWN_LIB || new RegExp(`^ig/sfx/${ID}/fx-[^/]+\\.wav$`).test(f)))
      errs.push(`cue file ${f} is neither in the shared library (${SHARED_LIB}/), nor ${SHARED_EXTRA}, nor ig5's own (${OWN_LIB}/<name>.wav or ig/sfx/${ID}/fx-*.wav)`);
  }
  return errs;
};
/* the reels' cue machinery (src/ig/common/cues.ts) must still be src/lib/cuesheet.ts token for token (the IG driver's
 * check, read-only): ig5's timing builds its cues with it */
{
  const code = (f) => {
    const s = readFileSync(path.join(ROOT, f), 'utf8');
    return s.slice(s.indexOf('import {'));
  };
  const port = code('src/lib/cuesheet.ts').replace("from '../timing.ts'", "from '../../timing.ts'");
  if (code('src/ig/common/cues.ts') !== port) fail('src/ig/common/cues.ts is no longer src/lib/cuesheet.ts token for token (below the header)');
}
{
  const errs = [...contract(ID, T, VOICE), ...own(T)];
  if (errs.length) {
    for (const e of errs) console.error(`[sfx:ig5] contract: ${e}`);
    fail(`${errs.length} contract error(s) in ${FILM.timing}`);
  }
}

/* ── 2. ig5's own library: byte copies of film 1's / film 2's sounds (read-only on the sources), once ── */
{
  const libJson = (() => {
    try {
      return JSON.parse(readFileSync(OWN_LIB_JSON, 'utf8'));
    } catch {
      return { files: {} };
    }
  })();
  const want = [...new Set(T.CUES.map((c) => c.file).filter((f) => path.posix.dirname(f) === OWN_LIB))].sort();
  const copied = [];
  for (const f of want) {
    const name = path.posix.basename(f);
    const dst = path.join(PUBLIC, f);
    const rec = libJson.files[name];
    if (existsSync(dst) && rec) {
      if (sha(readFileSync(dst)) !== rec.sha256) fail(`${f} no longer matches public/ig/sfx/ig5/lib.json (${rec.source}, ${rec.sha256.slice(0, 12)}…): delete it to copy it again`);
      continue;
    }
    const srcs = SOURCES.map((d) => path.join(d, name)).filter((p) => existsSync(p));
    if (srcs.length === 0) fail(`${f}: its source ${name} is in neither ${SOURCES.map(rel).join('/ nor ')}/ — the reels' drivers never run another film's driver`);
    if (srcs.length > 1) fail(`${f}: ${name} exists in both ${srcs.map(rel).join(' and ')} — ambiguous source`);
    const tmp = path.join(STAGE, `${name}.${process.pid}`);
    copyFileSync(srcs[0], tmp); // a byte copy; the source is only read
    const s = sha(readFileSync(tmp));
    mkdirSync(path.dirname(dst), { recursive: true });
    if (!inOwn(dst)) fail(`refusing to write ${rel(dst)}`);
    renameSync(tmp, dst);
    libJson.files[name] = { source: rel(srcs[0]), sha256: s };
    copied.push(name);
  }
  if (copied.length) {
    const sorted = Object.fromEntries(Object.keys(libJson.files).sort().map((k) => [k, libJson.files[k]]));
    publish(OWN_LIB_JSON, Buffer.from(JSON.stringify({ note: 'ig5-only byte copies of film 1 (public/sfx) and film 2 (public/kb/sfx) sounds, made once by scripts/ig5/generate-sfx.mjs', files: sorted }, null, 2) + '\n'));
  }
  say(`library: ${new Set(T.CUES.map((c) => c.file).filter((f) => path.posix.dirname(f) === SHARED_LIB)).size} shared (read-only, sha-checked) + ${want.length} ig5-own${copied.length ? ` (${copied.length} copied now: ${copied.join(', ')})` : ''}`);
}

/* ── 3. skip · 4. extras · 5. bed · 6. master · 7. stamp ── */
const loadSt = (f) => {
  const w = readWav(path.join(PUBLIC, f));
  if (w.sr !== SR) throw new Error(`[sfx:ig5] ${f} is at ${w.sr} Hz (the mix runs at ${SR})`);
  return [w.ch[0], w.ch[1] ?? w.ch[0]];
};
const keyOf = (files, data) => {
  const h = createHash('sha256');
  for (const f of files) h.update(readFileSync(f));
  h.update(JSON.stringify(data));
  return h.digest('hex').slice(0, 16);
};
const STEMS = ['voice', 'voice-odd', 'bed', 'sfx'].map((k) => path.join(QA, `stem-${k}.wav`));
const stamp = path.join(OUT, 'mix.json');
const r0 = Date.now();

/* 3. skip when nothing that shapes the sound has changed */
if (!force && existsSync(stamp) && existsSync(path.join(PUBLIC, T.MIX.file)) && STEMS.every((f) => existsSync(f))) {
  try {
    const h = ig5Hash(T, ROOT);
    if (JSON.parse(readFileSync(stamp, 'utf8')).hash === h) {
      say(`${ID}: up to date (${h}) — skipped`);
      rmSync(STAGE, { recursive: true, force: true });
      process.exit(0);
    }
  } catch {
    /* rebuild */
  }
}
mkdirSync(OUT, { recursive: true });
mkdirSync(QA, { recursive: true });
const cueFiles = [...new Set(T.CUES.map((c) => c.file))].sort();
const written = new Set([path.basename(T.MIX.file), path.basename(T.BED.file), 'mix.json', 'bed.json', 'lib.json']);

/* 4. extras: the shared fx-impact-end is read as is; ig5's own fx-*.wav from scripts/ig5/sounds.mjs */
const ownExtras = cueFiles.filter((f) => path.posix.dirname(f) === `ig/sfx/${ID}` && /^fx-[^/]+\.wav$/.test(path.posix.basename(f)));
let extraNote = cueFiles.includes(SHARED_EXTRA) ? 'fx-impact-end (shared, read-only)' : 'none';
if (ownExtras.length) {
  const soundsF = path.join(HERE, 'sounds.mjs');
  if (!existsSync(soundsF)) fail(`the cue sheet plays ig5 extras (${ownExtras.join(', ')}) but scripts/ig5/sounds.mjs does not exist`);
  const { extras } = await import(soundsF);
  const raw = extras(T);
  for (const f of ownExtras) {
    if (!raw.has(f)) fail(`scripts/ig5/sounds.mjs has no generator for ${f}`);
    publishWav(f, normalise(fades(raw.get(f), 0.3, 12), SFX_PEAK_DB));
    written.add(path.posix.basename(f));
  }
  extraNote += ` + ${ownExtras.length} ig5 extra(s) synthesised`;
}

/* 5. the bed: scripts/ig5/bed.mjs when it exists (PIPELINE §5.3), else the IG stub (scripts/ig/bed.mjs, imported) */
const bedF = existsSync(path.join(HERE, 'bed.mjs')) ? path.join(HERE, 'bed.mjs') : path.join(ROOT, 'scripts', 'ig', 'bed.mjs');
const { bed, inputs: bedInputs } = await import(bedF);
const bedKey = keyOf([bedF, path.join(ROOT, 'scripts', 'audio', 'dsp.mjs')], bedInputs(T));
let bedNote = `cached, ${rel(bedF)}`;
let cachedBed = false;
try {
  cachedBed = !force && JSON.parse(readFileSync(path.join(OUT, 'bed.json'), 'utf8')).key === bedKey && existsSync(path.join(PUBLIC, T.BED.file));
} catch {
  cachedBed = false;
}
if (!cachedBed) {
  bedNote = `composed, ${rel(bedF)}`;
  publishWav(T.BED.file, normalise(bed(T).st, BED_PEAK_DB));
  publish(path.join(OUT, 'bed.json'), Buffer.from(JSON.stringify({ key: bedKey })));
}
const bedSt = loadSt(T.BED.file);

/* 6. the master (film 1's unchanged mixer; voices from public/ig/voice/) */
const lib = new Map(cueFiles.map((f) => [f, loadSt(f)]));
const m = master(T, lib, bedSt, { publicDir: IG_PUBLIC });
const r = m.report;
if (!Number.isFinite(r.lufs) || !Number.isFinite(r.truePeakDb)) fail(`the master came out ${r.lufs} LUFS / ${r.truePeakDb} dBTP — not written, not stamped (a NaN in the timeline's mix numbers?)`);
publishWav(T.MIX.file, m.mix);
// a line placed more than once: rebuild the odd-line QA stem by span slicing (the IG driver's step, verbatim)
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

/* 7. stale files ONLY at the top level of public/ig/sfx/ig5/ (lib.json and lib/ kept), then the stamp */
for (const e of readdirSync(OUT, { withFileTypes: true })) {
  if (!e.isFile()) continue;
  const f = e.name;
  if ((f.endsWith('.wav') || f.endsWith('.json') || f.includes('.tmp')) && !written.has(f)) rmSync(path.join(OUT, f));
}
publish(stamp, Buffer.from(JSON.stringify({ hash: ig5Hash(T, ROOT), frames: T.DURATION, samples: m.mix[0].length, sr: SR, ...r }, null, 2)));
rmSync(STAGE, { recursive: true, force: true });
say(
  `${ID}: ${cueFiles.length} cue files + extras (${extraNote}) + bed (${bedNote}, ${db(peak(bedSt)).toFixed(1)} dBFS peak) + master: ` +
    `${r.lufs.toFixed(1)} LUFS, ${r.truePeakDb.toFixed(2)} dBTP (gain ${r.masterGainDb >= 0 ? '+' : ''}${r.masterGainDb.toFixed(1)} dB, limiter ${r.limiterMaxGrDb.toFixed(1)} dB max) — ` +
    `${T.CUES.length} cues, ${T.VOICES.length} lines, ${(T.DURATION / T.FPS).toFixed(1)} s → ${rel(path.join(PUBLIC, T.MIX.file))} in ${((Date.now() - r0) / 1000).toFixed(1)} s (total ${((Date.now() - t0) / 1000).toFixed(1)} s)`,
);
