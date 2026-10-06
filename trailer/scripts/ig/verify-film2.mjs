#!/usr/bin/env node
/**
 * Film 2 ("kb", delivered) invariance proof for the Instagram reels (docs/ig/PIPELINE.md §9 gate 3).
 * The IG work must leave every film 2 source, sound, timeline, compiled bundle and delivered file unchanged.
 *
 *   node --experimental-strip-types --no-warnings scripts/ig/verify-film2.mjs --capture [--force]
 *        write the reference to scripts/ig/film2-baseline/ (run BEFORE the first IG edit of a shared file;
 *        --force replaces an existing reference, and is refused unless step 1 passes)
 *   node --experimental-strip-types --no-warnings scripts/ig/verify-film2.mjs [--fast] [--keep]   (npm run verify:film2)
 *        every step, PASS/FAIL each, exit 1 on any FAIL. --fast = steps 1–4 (no compositions, bundle, MP4 decode).
 *        --keep keeps the fresh bundle in out/ig/verify-film2/.
 *
 * Steps:
 *   1  sources: `git diff --quiet 743247a -- src/kb src/lib/cuesheet.ts scripts/kb scripts/films.mjs
 *      scripts/voice-lines-kb.json public/kb/voice`, and no untracked file under those paths
 *   2  kbHash(T) (scripts/kb/hash.mjs, read-only) = public/kb/sfx/mix.json .hash = db3a9efa91f928f2
 *   3  sha256 of every file in public/kb/sfx/, public/kb/voice/ (the entries too), the delivered out/kb/*.mp4 and
 *      everything in out/kb/deliver/ — mix.wav 9c25a361…4085, bed.wav fe732796…02c4, the four MP4s of
 *      RESEARCH-product §3.8
 *   4  `check-mix --film=kb` exits 0 with byte-identical stdout; out/audio/kb/cue-timeline.txt identical
 *   5  `remotion compositions src/kb/index.ts` table identical
 *   6  a fresh `remotion bundle src/kb/index.ts`: bundleDigest(drop: isSoundStatic) = the reference digest (which
 *      the capture also matched against out/master/KB-Trailer-…/plan.json bundleSha: film 2's compiled picture)
 *   7  `check-render --film=kb` on the four delivered MP4s: exit 0, byte-identical stdout
 *
 * Writes only scripts/ig/film2-baseline/ (on --capture), out/ig/verify-film2/ (deleted unless --keep) and film 2's
 * own QA file out/audio/kb/cue-timeline.txt (check-mix rewrites it with identical bytes). Never writes public/.
 * Remotion commands run with NTV_SKIP_SFX=1 (no sound driver runs).
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleDigest, isSoundStatic } from '../bundle-digest.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const B = path.join(ROOT, 'scripts', 'ig', 'film2-baseline');
const WORK = path.join(ROOT, 'out', 'ig', 'verify-film2');
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

/* ── what film 2 is (RESEARCH-product §3.8, recorded at 743247a) ── */
const REF_COMMIT = '743247a';
const SOURCES = ['src/kb', 'src/lib/cuesheet.ts', 'scripts/kb', 'scripts/films.mjs', 'scripts/voice-lines-kb.json', 'public/kb/voice'];
const EXPECT = {
  kbHash: 'db3a9efa91f928f2',
  'public/kb/sfx/mix.wav': '9c25a361bcbc2cb6bfe6c14ee291ffc402f4fb58ba5aae6a38119fcb4e464085',
  'public/kb/sfx/bed.wav': 'fe7327961b96d2600f03cd2d4f855cec39551f5e731bcd3c5b33365c5eb402c4',
  'out/kb/neurotechvoice-knowledge-16x9-4k120.mp4': '18a4751ca9836e3bd432e1550a0af1eccaecd2c46b799230d8595a88302eca71',
  'out/kb/neurotechvoice-knowledge-9x16-4k120.mp4': '5cc54591426bd79640944ff3186a660cdb39cd0f9dd1a9bdfc80fab6c86f62bb',
  'out/kb/deliver/neurotechvoice-knowledge-16x9-1080p60-preview.mp4': '46ed09839ed34a7df953fa175f424abc435bdf320c4471529580fd93793d1509',
  'out/kb/deliver/neurotechvoice-knowledge-9x16-1080p60-preview.mp4': '3919278192bafe40b5cdb9fd3db8fd1f1c43c0c4d566c2445f2d27375b06041b',
};
const MP4S = Object.keys(EXPECT).filter((k) => k.endsWith('.mp4'));

/* ── arguments ── */
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
if (has('--help') || has('-h')) {
  const src = readFileSync(fileURLToPath(import.meta.url), 'utf8');
  console.log(src.slice(src.indexOf('/**') + 4, src.indexOf(' */')).replace(/^ \* ?/gm, ''));
  process.exit(0);
}
const capture = has('--capture');
const fast = has('--fast') && !capture;
const keep = has('--keep');
if (!process.execArgv.some((a) => a.includes('strip-types')) && !process.features?.typescript)
  throw new Error('run with node --experimental-strip-types --no-warnings (npm run verify:film2)');

/* ── helpers ── */
const ENV = { ...process.env, NTV_SKIP_SFX: '1' };
delete ENV.NTV_FILM;
delete ENV.NTV_HEVC;
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: ROOT, env: ENV, maxBuffer: 1 << 30 });
  return { code: r.status ?? 1, out: (r.stdout ?? Buffer.alloc(0)).toString(), err: (r.stderr ?? Buffer.alloc(0)).toString() + (r.error ? String(r.error) : '') };
};
const nodeTs = (args) => run(process.execPath, ['--experimental-strip-types', '--no-warnings', ...args]);
const tail = (s, n = 6) => s.split('\n').filter((l) => l.trim() && !/memory|CGroup|docker|lower amount/i.test(l)).slice(-n).map((l) => `  | ${l}`).join('\n');
const sha = (file) => {
  const h = createHash('sha256');
  const buf = Buffer.allocUnsafe(8 << 20);
  const fd = openSync(file, 'r');
  try {
    for (let n; (n = readSync(fd, buf, 0, buf.length, null)) > 0; ) h.update(buf.subarray(0, n));
  } finally {
    closeSync(fd);
  }
  return h.digest('hex');
};
const walk = (dir) => {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
};
const firstDiff = (a, b) => {
  const la = a.split('\n');
  const lb = b.split('\n');
  for (let i = 0; i < Math.max(la.length, lb.length); i++)
    if (la[i] !== lb[i]) return `line ${i + 1}:\n    was: ${la[i] ?? '(none)'}\n    now: ${lb[i] ?? '(none)'}`;
  return '(same lines, different bytes)';
};
const bt = (f) => readFileSync(path.join(B, f), 'utf8');

/* ── the measurements ── */
const gitSources = () => {
  const d = run('git', ['diff', '--quiet', REF_COMMIT, '--', ...SOURCES]);
  const u = run('git', ['status', '--porcelain', '--untracked-files=all', '--', ...SOURCES]);
  const fails = [];
  if (d.code !== 0) fails.push(`git diff ${REF_COMMIT} -- ${SOURCES.join(' ')}: changed (${run('git', ['diff', '--stat', REF_COMMIT, '--', ...SOURCES]).out.trim().split('\n').pop()})`);
  if (u.out.trim()) fails.push(`working tree: ${u.out.trim().split('\n').slice(0, 8).join('; ')}`);
  return fails;
};
const kbHashNow = () => {
  const r = nodeTs([
    '--input-type=module',
    '-e',
    `const T = await import(${JSON.stringify(path.join(ROOT, 'src/kb/timing.ts'))});
     const { kbHash } = await import(${JSON.stringify(path.join(ROOT, 'scripts/kb/hash.mjs'))});
     console.log(kbHash(T, ${JSON.stringify(ROOT)}));`,
  ]);
  if (r.code !== 0) throw new Error(`kbHash failed:\n${tail(r.err, 8)}`);
  return r.out.trim();
};
const fileListing = () => {
  const files = [
    ...walk(path.join(ROOT, 'public', 'kb')),
    ...readdirSync(path.join(ROOT, 'out', 'kb')).filter((f) => f.endsWith('.mp4')).map((f) => path.join(ROOT, 'out', 'kb', f)),
    ...walk(path.join(ROOT, 'out', 'kb', 'deliver')),
  ]
    .map(rel)
    .sort();
  return files.map((f) => `${sha(path.join(ROOT, f))}  ${f}\n`).join('');
};
const checkMix = () => nodeTs([path.join(ROOT, 'scripts', 'check-mix.mjs'), '--film=kb']);
const cueTimelineSha = () => {
  const f = path.join(ROOT, 'out', 'audio', 'kb', 'cue-timeline.txt');
  return existsSync(f) ? sha(f) : 'missing';
};
const compositions = () => {
  const r = run('npx', ['remotion', 'compositions', 'src/kb/index.ts']);
  // eslint-disable-next-line no-control-regex
  const lines = r.out.replace(/\x1b\[[0-9;]*m/g, '').split('\n');
  const i = lines.findIndex((l) => /compositions are available/.test(l));
  return { ...r, table: i < 0 ? null : lines.slice(i).map((l) => l.trimEnd()).join('\n').trim() + '\n' };
};
const freshBundleDigest = () => {
  const dir = path.join(WORK, 'bundle-kb');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(WORK, { recursive: true });
  const r = run('npx', ['remotion', 'bundle', 'src/kb/index.ts', '--out-dir', dir]);
  if (r.code !== 0) throw new Error(`remotion bundle src/kb/index.ts failed (exit ${r.code}):\n${tail(r.err, 8)}`);
  return bundleDigest(dir, { drop: isSoundStatic });
};
const planShas = () =>
  existsSync(path.join(ROOT, 'out', 'master'))
    ? readdirSync(path.join(ROOT, 'out', 'master'))
        .filter((d) => d.startsWith('KB-Trailer-') && existsSync(path.join(ROOT, 'out', 'master', d, 'plan.json')))
        .map((d) => ({ dir: `out/master/${d}`, bundleSha: JSON.parse(readFileSync(path.join(ROOT, 'out', 'master', d, 'plan.json'), 'utf8')).bundleSha }))
    : [];
const checkRender = () => nodeTs([path.join(ROOT, 'scripts', 'check-render.mjs'), '--film=kb', ...MP4S]);

/* ── capture ── */
if (capture) {
  if (existsSync(path.join(B, 'meta.json')) && !has('--force')) {
    console.error(`${rel(B)}/ exists — pass --force to replace it`);
    process.exit(2);
  }
  const t0 = Date.now();
  const say = (m) => console.log(`[capture ${((Date.now() - t0) / 1000).toFixed(0).padStart(4)} s] ${m}`);
  const g = gitSources();
  if (g.length) {
    console.error(`film 2's sources are not at ${REF_COMMIT}: ${g.join('\n')}`);
    process.exit(1);
  }
  const NEW = `${B}.new`;
  rmSync(NEW, { recursive: true, force: true });
  mkdirSync(NEW, { recursive: true });
  const W = (f, s) => writeFileSync(path.join(NEW, f), s);
  const meta = { capturedAt: new Date().toISOString(), head: run('git', ['rev-parse', 'HEAD']).out.trim(), ref: REF_COMMIT };
  meta.kbHash = kbHashNow();
  meta.stampHash = JSON.parse(readFileSync(path.join(ROOT, 'public/kb/sfx/mix.json'), 'utf8')).hash;
  say(`kbHash ${meta.kbHash} · stamp ${meta.stampHash}`);
  const listing = fileListing();
  W('files.sha256', listing);
  say(`${listing.trim().split('\n').length} files hashed`);
  for (const [k, v] of Object.entries(EXPECT))
    if (k !== 'kbHash' && !listing.includes(`${v}  ${k}\n`)) throw new Error(`${k} is not ${v.slice(0, 8)}… (RESEARCH-product §3.8) — film 2 already differs`);
  if (meta.kbHash !== EXPECT.kbHash || meta.stampHash !== EXPECT.kbHash) throw new Error(`kbHash ${meta.kbHash} / stamp ${meta.stampHash}, expected ${EXPECT.kbHash}`);
  const cm = checkMix();
  if (cm.code !== 0) throw new Error(`check-mix --film=kb exits ${cm.code}:\n${tail(cm.out, 8)}`);
  W('check-mix-kb.txt', cm.out);
  meta.cueTimeline = cueTimelineSha();
  say(`check-mix --film=kb: ${cm.out.trim().split('\n').pop()}`);
  const c = compositions();
  if (c.code !== 0 || !c.table) throw new Error(`remotion compositions failed (exit ${c.code}):\n${tail(c.err, 8)}`);
  W('compositions-kb.txt', c.table);
  say(`${c.table.trim().split('\n').length - 2} compositions`);
  meta.bundleSha = freshBundleDigest();
  meta.bundlePlans = planShas().filter((p) => p.bundleSha === meta.bundleSha).map((p) => p.dir);
  say(`bundle digest ${meta.bundleSha.slice(0, 16)} · matches ${meta.bundlePlans.join(', ') || 'no plan.json'}`);
  const cr = checkRender();
  if (cr.code !== 0) throw new Error(`check-render --film=kb exits ${cr.code}:\n${tail(cr.out + cr.err, 8)}`);
  W('check-render-kb.txt', cr.out);
  say(`check-render --film=kb: ${cr.out.trim().split('\n').length} files ✓`);
  W('meta.json', JSON.stringify(meta, null, 2) + '\n');
  rmSync(B, { recursive: true, force: true });
  renameSync(NEW, B);
  if (!keep) rmSync(WORK, { recursive: true, force: true });
  say(`reference written to ${rel(B)}/`);
  process.exit(0);
}

/* ── verify ── */
if (!existsSync(path.join(B, 'meta.json'))) {
  console.error(`no reference in ${rel(B)}/ — run --capture first (before the first IG edit)`);
  process.exit(2);
}
const META = JSON.parse(bt('meta.json'));
const STEPS = {
  1: ['film 2 sources', () => {
    const f = gitSources();
    return f.length ? { fail: f } : { ok: `${SOURCES.length} paths match ${REF_COMMIT}; no untracked files` };
  }],
  2: ['kbHash', () => {
    const h = kbHashNow();
    const st = JSON.parse(readFileSync(path.join(ROOT, 'public/kb/sfx/mix.json'), 'utf8')).hash;
    const f = [];
    if (h !== EXPECT.kbHash) f.push(`kbHash(T) = ${h}, expected ${EXPECT.kbHash}`);
    if (st !== EXPECT.kbHash) f.push(`public/kb/sfx/mix.json hash = ${st}, expected ${EXPECT.kbHash}`);
    return f.length ? { fail: f } : { ok: `kbHash = stamp = ${h}` };
  }],
  3: ['file hashes', () => {
    const now = fileListing();
    const was = bt('files.sha256');
    const f = [];
    for (const [k, v] of Object.entries(EXPECT)) if (k !== 'kbHash' && !now.includes(`${v}  ${k}\n`)) f.push(`${k} is no longer ${v.slice(0, 8)}…`);
    if (now !== was) {
      const a = new Map(was.trim().split('\n').map((l) => [l.slice(66), l.slice(0, 64)]));
      const b = new Map(now.trim().split('\n').map((l) => [l.slice(66), l.slice(0, 64)]));
      for (const [n, s] of a) if (!b.has(n)) f.push(`gone: ${n}`); else if (b.get(n) !== s) f.push(`changed: ${n}`);
      for (const n of b.keys()) if (!a.has(n)) f.push(`new: ${n}`);
    }
    return f.length ? { fail: f.slice(0, 20) } : { ok: `${now.trim().split('\n').length} files identical (mix.wav ${EXPECT['public/kb/sfx/mix.wav'].slice(0, 8)}…, bed.wav ${EXPECT['public/kb/sfx/bed.wav'].slice(0, 8)}…, ${MP4S.length} delivered MP4s)` };
  }],
  4: ['check-mix --film=kb', () => {
    const r = checkMix();
    const f = [];
    if (r.code !== 0) f.push(`exit ${r.code}`);
    if (r.out !== bt('check-mix-kb.txt')) f.push(`stdout differs: ${firstDiff(bt('check-mix-kb.txt'), r.out)}`);
    const ct = cueTimelineSha();
    if (ct !== META.cueTimeline) f.push(`out/audio/kb/cue-timeline.txt differs (${ct.slice(0, 8)}…, was ${META.cueTimeline.slice(0, 8)}…)`);
    return f.length ? { fail: f } : { ok: `exit 0, stdout identical (${r.out.trim().split('\n').pop()}); cue-timeline identical` };
  }],
  5: ['compositions', () => {
    const r = compositions();
    if (r.code !== 0 || !r.table) return { fail: [`remotion compositions failed (exit ${r.code}):\n${tail(r.err, 8)}`] };
    return r.table === bt('compositions-kb.txt') ? { ok: `${r.table.trim().split('\n').length - 2} compositions identical` } : { fail: [firstDiff(bt('compositions-kb.txt'), r.table)] };
  }],
  6: ['bundle digest', () => {
    const d = freshBundleDigest();
    const plans = planShas().filter((p) => p.bundleSha === d).map((p) => p.dir);
    if (d !== META.bundleSha) return { fail: [`fresh bundle digest ${d.slice(0, 16)}…, reference ${META.bundleSha.slice(0, 16)}… (film 2's compiled picture changed)`] };
    return { ok: `digest ${d.slice(0, 16)}… identical${plans.length ? ` (= ${plans.join(', ')} plan.json bundleSha)` : ''}` };
  }],
  7: ['check-render --film=kb', () => {
    const r = checkRender();
    const f = [];
    if (r.code !== 0) f.push(`exit ${r.code}:\n${tail(r.out + r.err, 6)}`);
    if (r.out !== bt('check-render-kb.txt')) f.push(`stdout differs: ${firstDiff(bt('check-render-kb.txt'), r.out)}`);
    return f.length ? { fail: f } : { ok: `${MP4S.length} delivered MP4s: exit 0, stdout identical` };
  }],
};
const ids = fast ? [1, 2, 3, 4] : [1, 2, 3, 4, 5, 6, 7];
const fmtS = (s) => (s >= 60 ? `${Math.floor(s / 60)} min ${Math.round(s % 60)} s` : `${s.toFixed(1)} s`);
console.log(`verify-film2: reference ${META.head.slice(0, 7)} (captured ${META.capturedAt}), steps ${ids.join(' ')}${fast ? ' (--fast)' : ''}`);
const T0 = Date.now();
let fails = 0;
for (const id of ids) {
  const [name, fn] = STEPS[id];
  const t0 = Date.now();
  let r;
  try {
    r = fn();
  } catch (e) {
    r = { fail: [String(e.message ?? e)] };
  }
  const s = (Date.now() - t0) / 1000;
  if (r.fail) {
    fails++;
    console.log(`FAIL  ${String(id).padStart(2)}  ${name} (${fmtS(s)})\n${r.fail.map((l) => `        ${l}`).join('\n')}`);
  } else console.log(`PASS  ${String(id).padStart(2)}  ${name} (${fmtS(s)}) — ${r.ok}`);
}
if (!keep) rmSync(WORK, { recursive: true, force: true });
console.log(`${fails ? 'FAIL' : 'PASS'}: ${ids.length - fails} pass, ${fails} fail, ${fmtS((Date.now() - T0) / 1000)}`);
process.exit(fails ? 1 : 0);
