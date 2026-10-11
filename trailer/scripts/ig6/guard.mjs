#!/usr/bin/env node
/**
 * ig6's invariance proof (docs/ig/ig6/PIPELINE.md §7.1): everything the sixth reel must NOT move — ig1–ig5's delivered
 * files, masters, sounds, voices, stamps, sources and pictures — measured before the first ig6 edit and re-measured
 * after every step. A copy-adapt of scripts/ig5/guard.mjs (which is retired from here on and never edited: it would
 * report ig6's new public files as failures). QA only: it reads the project and writes ONLY out/ig6-guard/.
 *
 *   node --experimental-strip-types --no-warnings scripts/ig6/guard.mjs --capture [--force] [--keep]   (npm run guard:ig6 -- --capture)
 *   node --experimental-strip-types --no-warnings scripts/ig6/guard.mjs --check [--fast] [--keep]       (npm run guard:ig6 -- --check)
 *
 *   1  SHAS (sha256) of
 *        out/ig/deliver/** (ig1–ig5's 17 files + profile/) · out/ig/master/*.mp4 (6) · out/master/IG1…IG5-Reel-9x16-x1/**
 *        out/master/{bundle-ig, bundle-ig5}/** · out/audio/ig/ig1…ig5/stem-*.wav
 *        public/ig/voice/ig[1-5]-*.wav · public/ig/sfx/{lib/**, lib.json, fx-impact-end.wav, ig1…ig5/**}
 *        src/ig/voice.generated.ts · src/ig/common/** · src/ig/ig1…ig5/** · src/ig/components/** · src/ig/qa/**
 *        src/ig/{Reel.tsx, Soundtrack.tsx, index.ts, scene.ts, types.ts}
 *        scripts/voice-lines-ig.json · scripts/ig/** · scripts/ig5/** · the shared tools scripts/*.mjs but registry.mjs
 *        (PIPELINE §3.2 edit 1) · voice-candidates/{ig, ig5}/**
 *      --check: every captured file must still be there with the same bytes — there is NO allowed edit (ig6's four
 *      shared edits, PIPELINE §3.2, are all outside these sets). A NEW file in one of these sets fails, except
 *      `neurotechvoice-ig6-*` in out/ig/deliver/ and out/ig/master/ (ig6's own deliverables, beside the delivered ones).
 *      The PIPELINE §1 baseline (the delivered files' sha256 prefixes) is asserted too.
 *   2  LISTINGS of src/ig/common/, scripts/ig/ (igHash inputs), scripts/ig5/, the top level of src/ig/ig5/ (ig5Hash
 *      inputs): --check: nothing added, nothing removed. Plus the public layout ig6 is allowed (PIPELINE §0.2, §1):
 *      public/ig holds only sfx/ and voice/; public/ig/voice/ gains only ig6-*.wav; public/ig/sfx/ gains only ig6/;
 *      public/ gains nothing (a public/ig6/ would fail both film bundle gates).
 *   3  STAMPS: igHash(T) (scripts/ig/hash.mjs, read-only) === public/ig/sfx/<reel>/mix.json .hash for ig1–ig4 and
 *      ig5Hash(T5) (scripts/ig5/hash.mjs, read-only) === public/ig/sfx/ig5/mix.json .hash (19ca5ef2038155ea, the
 *      delivered booking mix), the same hashes as the capture, and what `npm run sfx:ig` / `npm run sfx:ig5` need to
 *      SKIP (MIX.file + the four QA stems present).
 *   4  COMPOSITIONS: the `remotion compositions src/ig/index.ts` table (NTV_SKIP_SFX=1). --check: every captured row is
 *      still there (whitespace-normalised: a longer new id may re-pad the columns); new rows only IG6-*.
 *   5  GATE P — PICTURE: 6 Preview stills per reel for ig1–ig5 (IG<n>-Preview-9x16; 30) from a FRESH bundle of
 *      src/ig/index.ts (out/ig6-guard/bundle, deleted unless --keep), rendered in one browser with check-zones' browser
 *      and GL choices: f0, the first two caption onsets (+ 8 f), the comment field (END_CARD.field + 10), the impact +
 *      16, END − 1 (ig5's guard's frame rule). --check renders the captured frame list and wants every PNG
 *      BYTE-IDENTICAL (a mismatch reports the max channel delta and the changed-pixel count).
 *   6  GIT (--check only; PIPELINE §7.1 "Git"): `git status` of trailer/: a modified tracked path must be one of the four
 *      shared edits (scripts/registry.mjs, package.json, src/ig/Root.tsx, src/ig/voices.ts) or under docs/ig/ig6/; a new
 *      path must be under scripts/ig6/, src/ig/ig6/, public/ig/voice/ig6-*, voice-candidates/ig6/ or docs/ig/ig6/;
 *      nothing deleted.
 *
 *   --fast (check only): gates 1–3 and 6 (no bundle, no compositions, no stills: ≈ seconds).
 *   --capture writes out/ig6-guard/baseline.new/ and swaps it in only when complete; an existing baseline is kept
 *   unless --force. --check writes its stills and report to out/ig6-guard/check/ (replaced each run).
 *   Exit 1 on any FAIL. Never run it beside a render or verify-film1 (the stills need the CPUs to themselves).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const G = path.join(ROOT, 'out', 'ig6-guard');
const BASE = path.join(G, 'baseline');
const CHECK = path.join(G, 'check');
const BUNDLE = path.join(G, 'bundle');
/** igHash reels (ig1–ig4) and the ig5Hash reel */
const IG = ['ig1', 'ig2', 'ig3', 'ig4'];
const REELS = [...IG, 'ig5'];
/** new files allowed inside a guarded set: ig6's own deliverables beside the delivered ones */
const ALLOWED_NEW = [/^out\/ig\/deliver\/neurotechvoice-ig6-[^/]+$/, /^out\/ig\/master\/neurotechvoice-ig6-[^/]+$/];
/** PIPELINE.md §1 baseline: the delivered files' sha256 prefixes (written before this guard existed) */
const EXPECT = {
  'out/ig/deliver/neurotechvoice-ig1-not-even-ours-1080p120.mp4': 'edfc55ce',
  'out/ig/deliver/neurotechvoice-ig1-not-even-ours-1080p60-ig.mp4': '14202a61',
  'out/ig/deliver/neurotechvoice-ig1-not-even-ours-cover.png': '84cf96c0',
  'out/ig/deliver/neurotechvoice-ig2-booked-after-hours-1080p120.mp4': 'a51ba168',
  'out/ig/deliver/neurotechvoice-ig2-booked-after-hours-1080p60-ig.mp4': 'edb7395e',
  'out/ig/deliver/neurotechvoice-ig2-booked-after-hours-cover.png': '4e7194f8',
  'out/ig/deliver/neurotechvoice-ig3-twelve-minutes-1080p120.mp4': 'b45bbb22',
  'out/ig/deliver/neurotechvoice-ig3-twelve-minutes-1080p60-ig.mp4': 'aa364a3b',
  'out/ig/deliver/neurotechvoice-ig3-twelve-minutes-cover.png': 'ac8b0f92',
  'out/ig/deliver/neurotechvoice-ig4-trip-it-up-1080p120.mp4': 'a84e97ee',
  'out/ig/deliver/neurotechvoice-ig4-trip-it-up-1080p60-ig.mp4': '1eb0b9f4',
  'out/ig/deliver/neurotechvoice-ig4-trip-it-up-cover.png': 'cd1a3398',
  'out/ig/deliver/neurotechvoice-ig5-dont-pay-300-message-1080p120.mp4': 'ea3cd1b0',
  'out/ig/deliver/neurotechvoice-ig5-dont-pay-300-message-1080p60-ig.mp4': '44d60053',
  'out/ig/deliver/neurotechvoice-ig5-dont-pay-300-booking-1080p120.mp4': '48dc6dba',
  'out/ig/deliver/neurotechvoice-ig5-dont-pay-300-booking-1080p60-ig.mp4': 'a2d0ec58',
  'out/ig/deliver/neurotechvoice-ig5-dont-pay-300-cover.png': '0d82f460',
  'out/ig/master/neurotechvoice-ig5-dont-pay-300-message-1080p120-hevc.mp4': 'e00b73f2',
  'out/ig/master/neurotechvoice-ig5-dont-pay-300-booking-1080p120-hevc.mp4': '8a881f87',
};
/** PIPELINE.md §1 baseline: the five stamps */
const EXPECT_STAMPS = { ig1: '49b90ae44064d049', ig2: '757d177d35b27cd6', ig3: '47ae5cf315d3434b', ig4: 'f4500c7a37b6d47e', ig5: '19ca5ef2038155ea' };
/** gate 6: the four shared edits (PIPELINE §3.2) and the new-path prefixes (PIPELINE §7.1 "Git"), relative to trailer/ */
const GIT_EDITS = new Set(['scripts/registry.mjs', 'package.json', 'src/ig/Root.tsx', 'src/ig/voices.ts']);
const GIT_NEW = [/^scripts\/ig6\//, /^src\/ig\/ig6\//, /^public\/ig\/voice\/ig6-[^/]+\.wav$/, /^voice-candidates\/ig6\//, /^docs\/ig\/ig6\//];

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const MODE = has('--capture') ? 'capture' : has('--check') ? 'check' : null;
if (!MODE || (has('--capture') && has('--check'))) {
  console.error('usage: guard.mjs --capture [--force] [--keep] | --check [--fast] [--keep]');
  process.exit(2);
}
const unknown = args.filter((a) => !['--capture', '--check', '--force', '--keep', '--fast'].includes(a));
if (unknown.length) {
  console.error(`[guard:ig6] unknown option(s): ${unknown.join(' ')}`);
  process.exit(2);
}
const FAST = MODE === 'check' && has('--fast');
const KEEP = has('--keep');
const t0 = Date.now();
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const say = (m) => console.log(`[guard:ig6 ${new Date().toISOString().slice(11, 19)}] ${m}`);
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
const files = (...ps) => ps.map((p) => path.join(ROOT, p)).filter((f) => existsSync(f));
/** the sets: [label, files()] — a set's files are listed fresh at check time, so a NEW file in it is seen */
const SETS = [
  ['out/ig/deliver/**', () => walk(path.join(ROOT, 'out', 'ig', 'deliver'))],
  ['out/ig/master/*.mp4', () => top(path.join(ROOT, 'out', 'ig', 'master'), /\.mp4$/)],
  ['out/master/IG1…IG5-Reel-9x16-x1/**', () => REELS.flatMap((r) => walk(path.join(ROOT, 'out', 'master', `IG${r.slice(2)}-Reel-9x16-x1`)))],
  ['out/master/{bundle-ig, bundle-ig5}/**', () => ['bundle-ig', 'bundle-ig5'].flatMap((b) => walk(path.join(ROOT, 'out', 'master', b)))],
  ['out/audio/ig/ig1…ig5/stem-*.wav', () => REELS.flatMap((r) => top(path.join(ROOT, 'out', 'audio', 'ig', r), /^stem-.*\.wav$/))],
  ['public/ig/voice/ig[1-5]-*.wav', () => top(path.join(ROOT, 'public', 'ig', 'voice'), /^ig[1-5]-.*\.wav$/)],
  ['public/ig/sfx/lib/**', () => walk(path.join(ROOT, 'public', 'ig', 'sfx', 'lib'))],
  ['public/ig/sfx/{lib.json, fx-impact-end.wav}', () => files('public/ig/sfx/lib.json', 'public/ig/sfx/fx-impact-end.wav')],
  ['public/ig/sfx/ig1…ig5/**', () => REELS.flatMap((r) => walk(path.join(ROOT, 'public', 'ig', 'sfx', r)))],
  ['src/ig/voice.generated.ts', () => files('src/ig/voice.generated.ts')],
  ['src/ig/common/**', () => walk(path.join(ROOT, 'src', 'ig', 'common'))],
  ['src/ig/ig1…ig5/**', () => REELS.flatMap((r) => walk(path.join(ROOT, 'src', 'ig', r)))],
  ['src/ig/components/**', () => walk(path.join(ROOT, 'src', 'ig', 'components'))],
  ['src/ig/qa/**', () => walk(path.join(ROOT, 'src', 'ig', 'qa'))],
  ['src/ig/{Reel, Soundtrack, index, scene, types}', () => files('src/ig/Reel.tsx', 'src/ig/Soundtrack.tsx', 'src/ig/index.ts', 'src/ig/scene.ts', 'src/ig/types.ts')],
  ['scripts/voice-lines-ig.json', () => files('scripts/voice-lines-ig.json')],
  ['scripts/ig/**', () => walk(path.join(ROOT, 'scripts', 'ig'))],
  ['scripts/ig5/**', () => walk(path.join(ROOT, 'scripts', 'ig5'))],
  ['scripts/*.mjs but registry.mjs', () => top(path.join(ROOT, 'scripts'), /\.mjs$/).filter((f) => path.basename(f) !== 'registry.mjs')],
  ['voice-candidates/{ig, ig5}/**', () => ['ig', 'ig5'].flatMap((d) => walk(path.join(ROOT, 'voice-candidates', d)))],
];
const measureShas = () => {
  const m = {};
  for (const [, list] of SETS) for (const f of list()) m[rel(f)] = sha(f);
  return Object.fromEntries(Object.keys(m).sort().map((k) => [k, m[k]]));
};
/** the PIPELINE §1 prefixes against a sha table */
const expectFails = (shas) => Object.entries(EXPECT).filter(([f, p]) => !shas[f]?.startsWith(p)).map(([f, p]) => `${f}: ${shas[f] ? `${shas[f].slice(0, 8)}…` : 'MISSING'}, PIPELINE §1 says ${p}…`);

/* ── 2. the listings and the public layout ── */
const names = (dir) => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).map((e) => e.name).sort() : null);
const LISTED = ['src/ig/common/', 'scripts/ig/', 'scripts/ig5/', 'src/ig/ig5/'];
const measureListings = () => ({
  ...Object.fromEntries(LISTED.map((d) => [d, names(path.join(ROOT, d))])),
  'public/ig/': names(path.join(ROOT, 'public', 'ig')),
  'public/ig/sfx/': names(path.join(ROOT, 'public', 'ig', 'sfx')),
  'public/ig/voice/': names(path.join(ROOT, 'public', 'ig', 'voice')),
  'public/': names(path.join(ROOT, 'public')),
});

/* ── 3. the stamps (igHash / ig5Hash, read-only) and sfx:ig's / sfx:ig5's skip conditions ── */
const TL = {};
for (const r of REELS) TL[r] = await import(path.join(ROOT, 'src', 'ig', r, 'timing.ts'));
const { igHash } = await import(path.join(ROOT, 'scripts', 'ig', 'hash.mjs'));
const { ig5Hash } = await import(path.join(ROOT, 'scripts', 'ig5', 'hash.mjs'));
const measureStamps = () =>
  Object.fromEntries(
    REELS.map((r) => {
      const T = TL[r];
      const stampF = path.join(ROOT, 'public', 'ig', 'sfx', r, 'mix.json');
      const stamp = existsSync(stampF) ? JSON.parse(readFileSync(stampF, 'utf8')).hash : null;
      const skipReady = existsSync(path.join(ROOT, 'public', T.MIX.file)) && ['voice', 'voice-odd', 'bed', 'sfx'].every((k) => existsSync(path.join(ROOT, 'out', 'audio', 'ig', r, `stem-${k}.wav`)));
      const hash = r === 'ig5' ? ig5Hash(T, ROOT) : igHash(T, ROOT);
      return [r, { fn: r === 'ig5' ? 'ig5Hash' : 'igHash', hash, stamp, skipReady, frames: T.DURATION, impact: T.IMPACT }];
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
  say('bundling src/ig/index.ts (fresh) → out/ig6-guard/bundle');
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

/* ── 6. git (trailer/ only) ── */
const git = (a) => spawnSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
const head = () => {
  const r = git(['rev-parse', '--short', 'HEAD']);
  return r.status === 0 ? r.stdout.trim() : 'unknown';
};
/** `git status --porcelain` of trailer/, paths relative to trailer/: [{ xy, path }] */
const gitStatus = () => {
  const prefix = git(['rev-parse', '--show-prefix']).stdout.trim();
  const r = git(['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', '.']);
  if (r.status !== 0) throw new Error(`git status failed: ${r.stderr}`);
  const out = [];
  const parts = r.stdout.split('\0').filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    const xy = parts[i].slice(0, 2);
    let p = parts[i].slice(3);
    if (xy[0] === 'R' || xy[0] === 'C') i++; // the rename's source follows
    if (p.startsWith(prefix)) p = p.slice(prefix.length);
    out.push({ xy, path: p });
  }
  return out;
};

/* ── capture ── */
if (MODE === 'capture') {
  if (existsSync(path.join(BASE, 'meta.json')) && !has('--force')) {
    console.error(`[guard:ig6] ${rel(BASE)}/ exists — pass --force to replace it (run --check to compare against it)`);
    process.exit(2);
  }
  const NEW = `${BASE}.new`;
  rmSync(NEW, { recursive: true, force: true });
  mkdirSync(NEW, { recursive: true });
  const W = (f, s) => writeFileSync(path.join(NEW, f), s);
  const refuse = (m) => {
    console.error(`[guard:ig6] capture refused: ${m}`);
    rmSync(NEW, { recursive: true, force: true });
    process.exit(1);
  };
  const shas = measureShas();
  W('shas.json', JSON.stringify(shas, null, 1) + '\n');
  const perSet = SETS.map(([label, list]) => `${label} ${list().length}`).join(' · ');
  say(`1 shas: ${Object.keys(shas).length} files (${perSet})`);
  const exp = expectFails(shas);
  if (exp.length) refuse(`the delivered files are not PIPELINE §1's:\n  ${exp.join('\n  ')}`);
  say(`1 PIPELINE §1 baseline: ${Object.keys(EXPECT).length}/${Object.keys(EXPECT).length} delivered sha256 prefixes match`);
  const listings = measureListings();
  W('listings.json', JSON.stringify(listings, null, 1) + '\n');
  say(`2 listings: ${[...LISTED, 'public/ig/voice/'].map((k) => `${k} ${listings[k]?.length ?? 'MISSING'}`).join(' · ')}`);
  const stamps = measureStamps();
  W('stamps.json', JSON.stringify(stamps, null, 1) + '\n');
  for (const r of REELS)
    say(`3 ${r}: ${stamps[r].fn} ${stamps[r].hash} ${stamps[r].hash === stamps[r].stamp ? '=' : '≠'} stamp ${stamps[r].stamp}${stamps[r].skipReady ? '' : ' (MIX.file or a QA stem MISSING: its driver would rebuild)'} · ${stamps[r].frames} f · impact ${stamps[r].impact}`);
  const badStamp = REELS.filter((r) => stamps[r].hash !== stamps[r].stamp || !stamps[r].skipReady || stamps[r].hash !== EXPECT_STAMPS[r]);
  if (badStamp.length) refuse(`${badStamp.join(', ')} not CURRENT at PIPELINE §1's stamp — a baseline must start from the delivered stamps`);
  const table = compositions();
  W('compositions.txt', table);
  const rows = rowsOf(table);
  if (rows.some((r) => /^IG6-/.test(r))) refuse('the compositions table already lists IG6-* rows: capture before the first ig6 edit');
  say(`4 compositions: ${rows.length} rows`);
  const frames = Object.fromEntries(REELS.map((r) => [r, stillFrames(TL[r])]));
  const stills = await renderStills(frames, path.join(NEW, 'stills'));
  W('stills.json', JSON.stringify({ frames, shas: stills }, null, 1) + '\n');
  const status = gitStatus();
  W('git.json', JSON.stringify({ head: head(), status }, null, 1) + '\n');
  W('meta.json', JSON.stringify({ head: head(), at: new Date().toISOString(), files: Object.keys(shas).length, stills: Object.keys(stills).length, gitDirty: status.map((s) => `${s.xy} ${s.path}`), seconds: Math.round((Date.now() - t0) / 1000) }, null, 1) + '\n');
  rmSync(BASE, { recursive: true, force: true });
  renameSync(NEW, BASE);
  say(`CAPTURED → ${rel(BASE)}/ (${Object.keys(shas).length} files, ${Object.keys(stills).length} stills, HEAD ${head()}; git status: ${status.length ? status.map((s) => `${s.xy.trim()} ${s.path}`).join(', ') : 'clean'}) in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  process.exit(0);
}

/* ── check ── */
if (!existsSync(path.join(BASE, 'meta.json'))) {
  console.error(`[guard:ig6] no baseline in ${rel(BASE)}/ — run --capture first (before the first ig6 edit)`);
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
gate('1 shas (no allowed edit) + PIPELINE §1 prefixes', () => {
  const was = B('shas.json');
  const now = measureShas();
  let same = 0;
  for (const [f, s] of Object.entries(was)) {
    if (!(f in now)) fails.push(`1 shas: ${f} is GONE`);
    else if (now[f] !== s) fails.push(`1 shas: ${f} CHANGED (${s.slice(0, 12)}… → ${now[f].slice(0, 12)}…)`);
    else same++;
  }
  for (const f of Object.keys(now)) {
    if (f in was) continue;
    if (ALLOWED_NEW.some((re) => re.test(f))) notes.push(`1 shas: new ${f} (ig6's own deliverable)`);
    else fails.push(`1 shas: NEW file ${f} inside a guarded set`);
  }
  for (const e of expectFails(now)) fails.push(`1 PIPELINE §1: ${e}`);
  return `${same}/${Object.keys(was).length} byte-identical; ${Object.keys(EXPECT).length} delivered prefixes checked`;
});
gate('2 listings + public layout', () => {
  const was = B('listings.json');
  const now = measureListings();
  for (const k of LISTED) {
    for (const n of was[k]) if (!now[k]?.includes(n)) fails.push(`2 listings: ${k}${n} is GONE`);
    for (const n of now[k] ?? []) if (!was[k].includes(n)) fails.push(`2 listings: ${k}${n} is NEW (a hash listing of ig1–ig5: never add a file here, PIPELINE.md §9)`);
  }
  for (const n of now['public/ig/']) if (!['sfx', 'voice'].includes(n)) fails.push(`2 public: public/ig/${n} — ig6's public files live only under public/ig/voice/ig6-* and public/ig/sfx/ig6/`);
  for (const n of now['public/ig/sfx/']) if (!was['public/ig/sfx/'].includes(n) && n !== 'ig6') fails.push(`2 public: public/ig/sfx/${n} is NEW (only ig6/ may be added)`);
  for (const n of was['public/ig/sfx/']) if (!now['public/ig/sfx/'].includes(n)) fails.push(`2 public: public/ig/sfx/${n} is GONE`);
  for (const n of now['public/ig/voice/']) if (!was['public/ig/voice/'].includes(n) && !/^ig6-[^/]+\.wav$/.test(n)) fails.push(`2 public: public/ig/voice/${n} is NEW and not an ig6-*.wav`);
  for (const n of was['public/ig/voice/']) if (!now['public/ig/voice/'].includes(n)) fails.push(`2 public: public/ig/voice/${n} is GONE`);
  for (const n of now['public/']) if (!was['public/'].includes(n)) fails.push(`2 public: public/${n} is NEW (a public/ig6/ would fail both film bundle gates)`);
  for (const n of was['public/']) if (!now['public/'].includes(n)) fails.push(`2 public: public/${n} is GONE`);
  const added = now['public/ig/voice/'].filter((n) => !was['public/ig/voice/'].includes(n));
  return `${LISTED.map((k) => `${k} ${now[k]?.length}`).join(' · ')}; public/ig/voice +${added.length} ig6 file(s)${now['public/ig/sfx/'].includes('ig6') ? '; public/ig/sfx/ig6/ present' : ''}`;
});
gate('3 stamps (igHash / ig5Hash = mix.json; sfx:ig and sfx:ig5 would skip)', () => {
  const was = B('stamps.json');
  const now = measureStamps();
  for (const r of REELS) {
    const drv = r === 'ig5' ? 'sfx:ig5' : 'sfx:ig';
    if (now[r].hash !== now[r].stamp) fails.push(`3 ${r}: ${now[r].fn} ${now[r].hash} ≠ stamp ${now[r].stamp} — STALE (do NOT run ${drv}: it would rebuild ${r}'s delivered mix)`);
    if (now[r].hash !== was[r].hash) fails.push(`3 ${r}: ${now[r].fn} ${now[r].hash} ≠ the captured ${was[r].hash}`);
    if (now[r].hash !== EXPECT_STAMPS[r]) fails.push(`3 ${r}: ${now[r].fn} ${now[r].hash} ≠ PIPELINE §1's ${EXPECT_STAMPS[r]}`);
    if (!now[r].skipReady) fails.push(`3 ${r}: MIX.file or a QA stem is missing (${drv} would rebuild)`);
  }
  return REELS.map((r) => `${r} ${now[r].hash}`).join(' · ');
});
gate('6 git (modified ⊆ the four shared edits + docs/ig/ig6; new paths only under ig6 prefixes)', () => {
  const st = gitStatus();
  let mod = 0;
  let add = 0;
  for (const { xy, path: p } of st) {
    if (xy === '??' || xy.includes('A')) {
      if (GIT_NEW.some((re) => re.test(p))) add++;
      else fails.push(`6 git: new path ${p} is outside scripts/ig6/, src/ig/ig6/, public/ig/voice/ig6-*, voice-candidates/ig6/, docs/ig/ig6/`);
    } else if (xy.includes('D')) fails.push(`6 git: ${p} is DELETED`);
    else if (GIT_EDITS.has(p) || /^docs\/ig\/ig6\//.test(p)) mod++;
    else fails.push(`6 git: ${p} is modified (${xy.trim()}) — only ${[...GIT_EDITS].join(', ')} (PIPELINE §3.2) and docs/ig/ig6/ may change`);
  }
  return `${mod} modified (allowed), ${add} new (allowed)`;
});
if (!FAST) {
  gate('4 compositions (ig1–ig5 rows unchanged; new rows IG6-* only)', () => {
    const was = rowsOf(readFileSync(path.join(BASE, 'compositions.txt'), 'utf8'));
    const tbl = compositions();
    mkdirSync(CHECK, { recursive: true });
    writeFileSync(path.join(CHECK, 'compositions.txt'), tbl);
    const now = rowsOf(tbl);
    for (const r of was) if (!now.includes(r)) fails.push(`4 compositions: row "${r}" is gone or changed`);
    const added = now.filter((r) => !was.includes(r));
    for (const r of added) if (!/^IG6-/.test(r)) fails.push(`4 compositions: new row "${r}" is not an IG6 composition`);
    return `${was.length} captured rows present; +${added.length} IG6 row(s)${added.length ? `: ${added.map((r) => r.split(' ')[0]).join(', ')}` : ''}`;
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
  gate('5 gate P (ig1–ig5 Preview stills byte-identical)', () => {
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
  `guard:ig6 --check${FAST ? ' --fast' : ''} · HEAD ${head()} · baseline HEAD ${B('meta.json').head} (${B('meta.json').at}) · ${((Date.now() - t0) / 1000).toFixed(0)} s`,
  ...lines,
  ...notes.map((n) => `note  ${n}`),
  ...fails.map((f) => `FAIL  ${f}`),
  fails.length ? `FAIL: ${fails.length} problem(s)` : `PASS${FAST ? ' (fast: gates 1–3, 6)' : ' (gates 1–6)'}`,
].join('\n');
writeFileSync(path.join(CHECK, `report${FAST ? '-fast' : ''}.txt`), report + '\n');
console.log(report);
process.exit(fails.length ? 1 : 0);
