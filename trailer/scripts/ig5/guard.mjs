#!/usr/bin/env node
/**
 * ig5's invariance proof (docs/ig/ig5/PIPELINE.md §7.1): everything the fifth reel must NOT move — ig1–ig4's delivered
 * files, sounds, voices, stamps, sources and pictures — measured before the first ig5 edit and re-measured after every
 * step. QA only: it reads the project and writes ONLY out/ig5-guard/.
 *
 *   node --experimental-strip-types --no-warnings scripts/ig5/guard.mjs --capture [--force] [--keep]   (npm run guard:ig5 -- --capture)
 *   node --experimental-strip-types --no-warnings scripts/ig5/guard.mjs --check [--fast] [--keep]       (npm run guard:ig5 -- --check)
 *
 *   1  SHAS (sha256) of
 *        out/ig/deliver/** · out/ig/master/*.mp4 · out/master/IG1…IG4-Reel-9x16-x1/** · out/audio/ig/ig1…ig4/stem-*.wav
 *        public/ig/voice/ig[1-4]-*.wav · public/ig/sfx/{lib/**, lib.json, fx-impact-end.wav, ig1…ig4/**}
 *        src/ig/voice.generated.ts · src/ig/common/** · src/ig/ig1…ig4/**
 *        scripts/voice-lines-ig.json · scripts/ig/** (every file: the sound code igHash reads and the QA tools)
 *      --check: every captured file must still be there with the same bytes. The ONLY changes allowed are PIPELINE.md
 *      §3.2 edits 9–10 (scripts/ig/check-zones.mjs, scripts/ig/check-delivery.mjs: QA-only, outside igHash), reported
 *      as "allowed". A NEW file in one of these sets fails, except `neurotechvoice-ig5-*` in out/ig/deliver/ and
 *      out/ig/master/ (ig5's own deliverables, beside the delivered ones).
 *   2  LISTINGS of src/ig/common/ and of the top level of scripts/ig/ (both are igHash inputs: a new file there restales
 *      all four reels). --check: nothing removed; an added name fails unless it is an ig5 name (and even then igHash,
 *      gate 3, would catch it). Plus the public layout ig5 is allowed (PIPELINE.md §0.3, §10): public/ig holds only
 *      sfx/ and voice/; public/ig/voice/ gains only ig5-*.wav; public/ig/sfx/ gains only ig5/; no public/ig5/.
 *   3  STAMPS: igHash(T) (scripts/ig/hash.mjs, read-only) === public/ig/sfx/<reel>/mix.json .hash for ig1–ig4, the same
 *      hashes as the capture, and what `npm run sfx:ig` needs to SKIP (MIX.file + the four QA stems present).
 *   4  COMPOSITIONS: the `remotion compositions src/ig/index.ts` table (NTV_SKIP_SFX=1). --check: every captured row is
 *      still there (whitespace-normalised: a longer new id may re-pad the columns); new rows only IG5-*.
 *   5  GATE P — PICTURE: 6 Preview stills per reel (IG<n>-Preview-9x16) from a FRESH bundle of src/ig/index.ts
 *      (out/ig5-guard/bundle, deleted unless --keep), rendered in one browser with check-zones' browser and GL
 *      choices: f0, the first two caption onsets (+ 8 f), the comment field (END_CARD.field + 10), the impact + 16,
 *      END − 1. --check renders the captured frame list and wants every PNG BYTE-IDENTICAL (a mismatch reports the
 *      max channel delta and the changed-pixel count, decoded through Remotion's ffmpeg).
 *
 *   --fast (check only): gates 1–3 (no bundle, no compositions, no stills: ≈ seconds).
 *   --capture writes out/ig5-guard/baseline.new/ and swaps it in only when complete; an existing baseline is kept
 *   unless --force. --check writes its stills and report to out/ig5-guard/check/ (replaced each run).
 *   Exit 1 on any FAIL. Never run it beside a render or verify-film1 (the stills need the CPUs to themselves).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const G = path.join(ROOT, 'out', 'ig5-guard');
const BASE = path.join(G, 'baseline');
const CHECK = path.join(G, 'check');
const BUNDLE = path.join(G, 'bundle');
const REELS = ['ig1', 'ig2', 'ig3', 'ig4'];
/** PIPELINE.md §3.2 edits 9–10: the only files of the guarded sets ig5 may change (QA-only, in scripts/ig/hash.mjs QA_ONLY) */
const ALLOWED_EDITS = new Set(['scripts/ig/check-zones.mjs', 'scripts/ig/check-delivery.mjs']);
/** new files allowed inside a guarded set: ig5's own deliverables beside the delivered ones */
const ALLOWED_NEW = [/^out\/ig\/deliver\/neurotechvoice-ig5-[^/]+$/, /^out\/ig\/master\/neurotechvoice-ig5-[^/]+$/];

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const MODE = has('--capture') ? 'capture' : has('--check') ? 'check' : null;
if (!MODE || (has('--capture') && has('--check'))) {
  console.error('usage: guard.mjs --capture [--force] [--keep] | --check [--fast] [--keep]');
  process.exit(2);
}
const unknown = args.filter((a) => !['--capture', '--check', '--force', '--keep', '--fast'].includes(a));
if (unknown.length) {
  console.error(`[guard:ig5] unknown option(s): ${unknown.join(' ')}`);
  process.exit(2);
}
const FAST = MODE === 'check' && has('--fast');
const KEEP = has('--keep');
const t0 = Date.now();
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const say = (m) => console.log(`[guard:ig5 ${new Date().toISOString().slice(11, 19)}] ${m}`);
const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');
const BIN = path.join(ROOT, 'node_modules/@remotion/compositor-linux-x64-gnu');
const ff = (a) => execFileSync(path.join(BIN, 'ffmpeg'), a, { env: { ...process.env, LD_LIBRARY_PATH: BIN }, cwd: ROOT, maxBuffer: 1 << 26 });
const env = { ...process.env, NTV_SKIP_SFX: '1' };
delete env.NTV_FILM;

/* ── 1. the guarded files ── */
const walk = (dir) => {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.isFile()) out.push(p);
  }
  return out;
};
const top = (dir, re) => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile() && re.test(e.name)).map((e) => path.join(dir, e.name)) : []);
/** the sets: [label, files()] — a set's files are listed fresh at check time, so a NEW file in it is seen */
const SETS = [
  ['out/ig/deliver/**', () => walk(path.join(ROOT, 'out', 'ig', 'deliver'))],
  ['out/ig/master/*.mp4', () => top(path.join(ROOT, 'out', 'ig', 'master'), /\.mp4$/)],
  ['out/master/IG1…IG4-Reel-9x16-x1/**', () => REELS.flatMap((r) => walk(path.join(ROOT, 'out', 'master', `IG${r.slice(2)}-Reel-9x16-x1`)))],
  ['out/audio/ig/ig1…ig4/stem-*.wav', () => REELS.flatMap((r) => top(path.join(ROOT, 'out', 'audio', 'ig', r), /^stem-.*\.wav$/))],
  ['public/ig/voice/ig[1-4]-*.wav', () => top(path.join(ROOT, 'public', 'ig', 'voice'), /^ig[1-4]-.*\.wav$/)],
  ['public/ig/sfx/lib/**', () => walk(path.join(ROOT, 'public', 'ig', 'sfx', 'lib'))],
  ['public/ig/sfx/{lib.json, fx-impact-end.wav}', () => ['lib.json', 'fx-impact-end.wav'].map((f) => path.join(ROOT, 'public', 'ig', 'sfx', f)).filter((f) => existsSync(f))],
  ['public/ig/sfx/ig1…ig4/**', () => REELS.flatMap((r) => walk(path.join(ROOT, 'public', 'ig', 'sfx', r)))],
  ['src/ig/voice.generated.ts', () => [path.join(ROOT, 'src', 'ig', 'voice.generated.ts')]],
  ['src/ig/common/**', () => walk(path.join(ROOT, 'src', 'ig', 'common'))],
  ['src/ig/ig1…ig4/**', () => REELS.flatMap((r) => walk(path.join(ROOT, 'src', 'ig', r)))],
  ['scripts/voice-lines-ig.json', () => [path.join(ROOT, 'scripts', 'voice-lines-ig.json')]],
  ['scripts/ig/**', () => walk(path.join(ROOT, 'scripts', 'ig'))],
];
const measureShas = () => {
  const m = {};
  for (const [, list] of SETS) for (const f of list()) m[rel(f)] = sha(f);
  return Object.fromEntries(Object.keys(m).sort().map((k) => [k, m[k]]));
};

/* ── 2. the listings and the public layout ── */
const names = (dir, filesOnly = false) => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((e) => !filesOnly || e.isFile()).map((e) => e.name).sort() : null);
const measureListings = () => ({
  'src/ig/common/': names(path.join(ROOT, 'src', 'ig', 'common')),
  'scripts/ig/': names(path.join(ROOT, 'scripts', 'ig')),
  'public/ig/': names(path.join(ROOT, 'public', 'ig')),
  'public/ig/sfx/': names(path.join(ROOT, 'public', 'ig', 'sfx')),
  'public/ig/voice/': names(path.join(ROOT, 'public', 'ig', 'voice')),
  'public/': names(path.join(ROOT, 'public')),
});

/* ── 3. the stamps (igHash, read-only) and sfx:ig's skip conditions ── */
const TL = {};
for (const r of REELS) TL[r] = await import(path.join(ROOT, 'src', 'ig', r, 'timing.ts'));
const { igHash } = await import(path.join(ROOT, 'scripts', 'ig', 'hash.mjs'));
const measureStamps = () =>
  Object.fromEntries(
    REELS.map((r) => {
      const T = TL[r];
      const stampF = path.join(ROOT, 'public', 'ig', 'sfx', r, 'mix.json');
      const stamp = existsSync(stampF) ? JSON.parse(readFileSync(stampF, 'utf8')).hash : null;
      const skipReady = existsSync(path.join(ROOT, 'public', T.MIX.file)) && ['voice', 'voice-odd', 'bed', 'sfx'].every((k) => existsSync(path.join(ROOT, 'out', 'audio', 'ig', r, `stem-${k}.wav`)));
      return [r, { hash: igHash(T, ROOT), stamp, skipReady, frames: T.DURATION, impact: T.IMPACT }];
    }),
  );

/* ── 4. the compositions table ── */
const compositions = () => {
  const r = spawnSync('npx', ['remotion', 'compositions', 'src/ig/index.ts'], { cwd: ROOT, env, encoding: 'utf8', maxBuffer: 1 << 26 });
  // eslint-disable-next-line no-control-regex
  const lines = (r.stdout ?? '').replace(/\x1b\[[0-9;]*m/g, '').split('\n');
  const i = lines.findIndex((l) => /compositions are available/.test(l));
  if (r.status !== 0 || i < 0) throw new Error(`remotion compositions src/ig/index.ts failed (exit ${r.status}):\n${(r.stderr ?? '').split('\n').slice(-8).join('\n')}`);
  return lines.slice(i).map((l) => l.trimEnd()).join('\n').trim() + '\n';
};
const rowsOf = (table) => table.split('\n').slice(1).map((l) => l.trim().replace(/\s+/g, ' ')).filter(Boolean);

/* ── 5. gate P: the Preview stills ── */
const stillFrames = (T) => {
  const caps = [];
  for (const v of T.VOICES) {
    const s = T.SCREENS[v.id];
    if (s?.kind !== 'caption') continue;
    for (const [a] of s.spans) caps.push(Math.round(v.at + T.vWord(v.id, a)) + 8);
  }
  const want = [0, ...caps.sort((x, y) => x - y).slice(0, 2), T.END_CARD.field + 10, T.IMPACT + 16, T.DURATION - 1];
  return [...new Set(want.map((f) => Math.round(f)))].filter((f) => f >= 0 && f < T.DURATION).sort((x, y) => x - y);
};
const renderStills = async (frames, outDir) => {
  rmSync(BUNDLE, { recursive: true, force: true });
  say('bundling src/ig/index.ts (fresh) → out/ig5-guard/bundle');
  const b = spawnSync('npx', ['remotion', 'bundle', 'src/ig/index.ts', '--out-dir', BUNDLE, '--log=error'], { cwd: ROOT, env, stdio: ['ignore', 'ignore', 'inherit'] });
  if (b.status !== 0 || !existsSync(path.join(BUNDLE, 'index.html'))) throw new Error('remotion bundle src/ig/index.ts failed');
  const { openBrowser, renderStill, selectComposition } = await import('@remotion/renderer');
  const browserExecutable = process.env.REMOTION_BROWSER ?? ['/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'].find((p) => existsSync(p)) ?? null;
  const chromiumOptions = { gl: 'angle' };
  const browser = await openBrowser('chrome', { browserExecutable, chromiumOptions });
  mkdirSync(outDir, { recursive: true });
  const out = {};
  try {
    for (const r of REELS) {
      const id = `IG${r.slice(2)}-Preview-9x16`;
      const composition = await selectComposition({ serveUrl: BUNDLE, id, inputProps: {}, puppeteerInstance: browser, browserExecutable, chromiumOptions });
      const ts = Date.now();
      for (const f of frames[r]) {
        const file = path.join(outDir, `${r}-f${String(f).padStart(3, '0')}.png`);
        await renderStill({ serveUrl: BUNDLE, composition, output: file, frame: f, inputProps: {}, imageFormat: 'png', scale: 1, puppeteerInstance: browser, browserExecutable, chromiumOptions, overwrite: true });
        out[path.basename(file)] = sha(file);
      }
      say(`${r}: ${frames[r].length} stills (f ${frames[r].join(', ')}) in ${((Date.now() - ts) / 1000).toFixed(0)} s`);
    }
  } finally {
    await browser.close({ silent: true });
    if (!KEEP) rmSync(BUNDLE, { recursive: true, force: true });
  }
  return out;
};
/** max channel delta (0–255) and changed-pixel count of two PNGs of the same size */
const pixelDiff = (a, b) => {
  const raw = (f) => ff(['-hide_banner', '-v', 'error', '-i', f, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-']);
  const x = raw(a);
  const y = raw(b);
  if (x.length !== y.length) return { max: 255, px: -1 };
  let max = 0;
  let px = 0;
  for (let i = 0; i < x.length; i += 4) {
    const d = Math.max(Math.abs(x[i] - y[i]), Math.abs(x[i + 1] - y[i + 1]), Math.abs(x[i + 2] - y[i + 2]), Math.abs(x[i + 3] - y[i + 3]));
    if (d) {
      px++;
      if (d > max) max = d;
    }
  }
  return { max, px };
};

const head = () => {
  const r = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : 'unknown';
};

/* ── capture ── */
if (MODE === 'capture') {
  if (existsSync(path.join(BASE, 'meta.json')) && !has('--force')) {
    console.error(`[guard:ig5] ${rel(BASE)}/ exists — pass --force to replace it (run --check to compare against it)`);
    process.exit(2);
  }
  const NEW = `${BASE}.new`;
  rmSync(NEW, { recursive: true, force: true });
  mkdirSync(NEW, { recursive: true });
  const W = (f, s) => writeFileSync(path.join(NEW, f), s);
  const shas = measureShas();
  W('shas.json', JSON.stringify(shas, null, 1) + '\n');
  say(`1 shas: ${Object.keys(shas).length} files`);
  const listings = measureListings();
  W('listings.json', JSON.stringify(listings, null, 1) + '\n');
  say(`2 listings: src/ig/common/ ${listings['src/ig/common/'].length} · scripts/ig/ ${listings['scripts/ig/'].length} · public/ig/voice/ ${listings['public/ig/voice/'].length}`);
  const stamps = measureStamps();
  W('stamps.json', JSON.stringify(stamps, null, 1) + '\n');
  const badStamp = REELS.filter((r) => stamps[r].hash !== stamps[r].stamp || !stamps[r].skipReady);
  for (const r of REELS) say(`3 ${r}: igHash ${stamps[r].hash} ${stamps[r].hash === stamps[r].stamp ? '=' : '≠'} stamp ${stamps[r].stamp}${stamps[r].skipReady ? '' : ' (MIX.file or a QA stem MISSING: sfx:ig would rebuild)'} · ${stamps[r].frames} f · impact ${stamps[r].impact}`);
  if (badStamp.length) {
    console.error(`[guard:ig5] capture refused: ${badStamp.join(', ')} not CURRENT — a baseline must start from current stamps`);
    rmSync(NEW, { recursive: true, force: true });
    process.exit(1);
  }
  const table = compositions();
  W('compositions.txt', table);
  say(`4 compositions: ${rowsOf(table).length} rows`);
  const frames = Object.fromEntries(REELS.map((r) => [r, stillFrames(TL[r])]));
  const stills = await renderStills(frames, path.join(NEW, 'stills'));
  W('stills.json', JSON.stringify({ frames, shas: stills }, null, 1) + '\n');
  W('meta.json', JSON.stringify({ head: head(), at: new Date().toISOString(), files: Object.keys(shas).length, stills: Object.keys(stills).length, seconds: Math.round((Date.now() - t0) / 1000) }, null, 1) + '\n');
  rmSync(BASE, { recursive: true, force: true });
  renameSync(NEW, BASE);
  say(`CAPTURED → ${rel(BASE)}/ (${Object.keys(shas).length} files, ${Object.keys(stills).length} stills, HEAD ${head()}) in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  process.exit(0);
}

/* ── check ── */
if (!existsSync(path.join(BASE, 'meta.json'))) {
  console.error(`[guard:ig5] no baseline in ${rel(BASE)}/ — run --capture first (before the first ig5 edit)`);
  process.exit(2);
}
const B = (f) => JSON.parse(readFileSync(path.join(BASE, f), 'utf8'));
const fails = [];
const notes = [];
const lines = [];
const gate = (name, f) => {
  const before = fails.length;
  try {
    const ok = f();
    lines.push(`${fails.length === before ? 'PASS' : 'FAIL'}  ${name}${ok ? ` — ${ok}` : ''}`);
  } catch (e) {
    fails.push(`${name}: ${e.message}`);
    lines.push(`FAIL  ${name} — ${e.message}`);
  }
};
gate('1 shas', () => {
  const was = B('shas.json');
  const now = measureShas();
  let same = 0;
  for (const [f, s] of Object.entries(was)) {
    if (!(f in now)) fails.push(`1 shas: ${f} is GONE`);
    else if (now[f] !== s) {
      if (ALLOWED_EDITS.has(f)) notes.push(`1 shas: ${f} changed — allowed (PIPELINE.md §3.2 edit ${f.includes('zones') ? 9 : 10}, QA-only, not in igHash)`);
      else fails.push(`1 shas: ${f} CHANGED (${s.slice(0, 12)}… → ${now[f].slice(0, 12)}…)`);
    } else same++;
  }
  for (const f of Object.keys(now)) {
    if (f in was) continue;
    if (ALLOWED_NEW.some((re) => re.test(f))) notes.push(`1 shas: new ${f} (ig5's own deliverable)`);
    else fails.push(`1 shas: NEW file ${f} inside a guarded set`);
  }
  return `${same}/${Object.keys(was).length} byte-identical`;
});
gate('2 listings + public layout', () => {
  const was = B('listings.json');
  const now = measureListings();
  for (const k of ['src/ig/common/', 'scripts/ig/']) {
    for (const n of was[k]) if (!now[k].includes(n)) fails.push(`2 listings: ${k}${n} is GONE`);
    for (const n of now[k]) if (!was[k].includes(n)) (/ig5/i.test(n) ? notes : fails).push(`2 listings: ${k}${n} is NEW (an igHash listing: ${/ig5/i.test(n) ? 'an ig5 name — see gate 3' : 'never add a file here, PIPELINE.md §10'})`);
  }
  for (const n of now['public/ig/']) if (!['sfx', 'voice'].includes(n)) fails.push(`2 public: public/ig/${n} — ig5's public files live only under public/ig/voice/ and public/ig/sfx/ig5/`);
  for (const n of now['public/ig/sfx/']) if (!was['public/ig/sfx/'].includes(n) && n !== 'ig5') fails.push(`2 public: public/ig/sfx/${n} is NEW (only ig5/ may be added)`);
  for (const n of was['public/ig/sfx/']) if (!now['public/ig/sfx/'].includes(n)) fails.push(`2 public: public/ig/sfx/${n} is GONE`);
  for (const n of now['public/ig/voice/']) if (!was['public/ig/voice/'].includes(n) && !/^ig5-[^/]+\.wav$/.test(n)) fails.push(`2 public: public/ig/voice/${n} is NEW and not an ig5-*.wav`);
  for (const n of was['public/ig/voice/']) if (!now['public/ig/voice/'].includes(n)) fails.push(`2 public: public/ig/voice/${n} is GONE`);
  for (const n of now['public/']) if (!was['public/'].includes(n)) fails.push(`2 public: public/${n} is NEW (a public/ig5/ would fail both film bundle gates)`);
  const added = now['public/ig/voice/'].filter((n) => !was['public/ig/voice/'].includes(n));
  return `common ${now['src/ig/common/'].length} · scripts/ig ${now['scripts/ig/'].length} entries; public/ig/voice +${added.length} ig5 file(s)${now['public/ig/sfx/'].includes('ig5') ? '; public/ig/sfx/ig5/ present' : ''}`;
});
gate('3 stamps (igHash = mix.json, sfx:ig would skip)', () => {
  const was = B('stamps.json');
  const now = measureStamps();
  for (const r of REELS) {
    if (now[r].hash !== now[r].stamp) fails.push(`3 ${r}: igHash ${now[r].hash} ≠ stamp ${now[r].stamp} — STALE (do NOT run sfx:ig: it would rebuild ${r}'s delivered mix)`);
    if (now[r].hash !== was[r].hash) fails.push(`3 ${r}: igHash ${now[r].hash} ≠ the captured ${was[r].hash}`);
    if (!now[r].skipReady) fails.push(`3 ${r}: MIX.file or a QA stem is missing (sfx:ig would rebuild)`);
  }
  return REELS.map((r) => `${r} ${now[r].hash}`).join(' · ');
});
if (!FAST) {
  gate('4 compositions (ig1–ig4 rows unchanged; new rows IG5-* only)', () => {
    const was = rowsOf(readFileSync(path.join(BASE, 'compositions.txt'), 'utf8'));
    const tbl = compositions();
    mkdirSync(CHECK, { recursive: true });
    writeFileSync(path.join(CHECK, 'compositions.txt'), tbl);
    const now = rowsOf(tbl);
    for (const r of was) if (!now.includes(r)) fails.push(`4 compositions: row "${r}" is gone or changed`);
    const added = now.filter((r) => !was.includes(r));
    for (const r of added) if (!/^IG5-/.test(r)) fails.push(`4 compositions: new row "${r}" is not an IG5 composition`);
    return `${was.length} captured rows present; +${added.length} IG5 row(s)${added.length ? `: ${added.map((r) => r.split(' ')[0]).join(', ')}` : ''}`;
  });
}
if (!FAST) {
  const st = B('stills.json');
  rmSync(path.join(CHECK, 'stills'), { recursive: true, force: true });
  let now = {};
  try {
    now = await renderStills(st.frames, path.join(CHECK, 'stills'));
  } catch (e) {
    fails.push(`5 gate P: ${e.message}`);
  }
  gate('5 gate P (ig1–ig4 Preview stills byte-identical)', () => {
    let same = 0;
    for (const [f, s] of Object.entries(st.shas)) {
      if (!now[f]) fails.push(`5 gate P: ${f} was not rendered`);
      else if (now[f] !== s) {
        const d = pixelDiff(path.join(BASE, 'stills', f), path.join(CHECK, 'stills', f));
        fails.push(`5 gate P: ${f} DIFFERS (max channel delta ${d.max}/255 over ${d.px} px)`);
      } else same++;
    }
    return `${same}/${Object.keys(st.shas).length} byte-identical`;
  });
}
mkdirSync(CHECK, { recursive: true });
const report = [
  `guard:ig5 --check${FAST ? ' --fast' : ''} · HEAD ${head()} · baseline HEAD ${B('meta.json').head} (${B('meta.json').at}) · ${((Date.now() - t0) / 1000).toFixed(0)} s`,
  ...lines,
  ...notes.map((n) => `note  ${n}`),
  ...fails.map((f) => `FAIL  ${f}`),
  fails.length ? `FAIL: ${fails.length} problem(s)` : `PASS${FAST ? ' (fast: gates 1–3)' : ' (gates 1–5)'}`,
].join('\n');
writeFileSync(path.join(CHECK, `report${FAST ? '-fast' : ''}.txt`), report + '\n');
console.log(report);
process.exit(fails.length ? 1 : 0);
