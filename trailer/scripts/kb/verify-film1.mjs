#!/usr/bin/env node
/**
 * Film 1 invariance check (docs/kb/PIPELINE.md §11). Film 1 ("main") is delivered and frozen:
 * film 2 ("kb") work must leave every film 1 source, sound, timeline, bundle and frame unchanged.
 *
 *   node scripts/kb/verify-film1.mjs --capture [--force]   §11.A: write the baseline to out/kb-plan/baseline/
 *   node scripts/kb/verify-film1.mjs                        §11.B: every gate (1–11), PASS/FAIL each, exit 1 on any FAIL
 *   node scripts/kb/verify-film1.mjs --fast                 gates 1–5 and 10 only (no MP4s, compositions, bundle or stills)
 *   options: --only=1,4,9 (run just these gates; 9 renders from 8's bundle, so --only=9 runs 8 too)
 *            --keep (keep the run's bundle and stills in out/kb-plan/verify/)
 *            --baseline=DIR (another baseline folder; default out/kb-plan/baseline; docs/kb/baseline is the
 *            committed text copy: every gate but 9, which needs the stills)
 *            --no-wait (exit 2 at once if another verify-film1 is running, instead of waiting for it)
 *
 * ONE RUN AT A TIME: a run holds out/kb-plan/verify-film1.lock (its pid). A second run waits for it (up
 * to 60 min, or exits 2 with --no-wait): two runs share out/kb-plan/verify/ (a finishing run deletes the
 * bundle the other is rendering stills from) and out/audio/cue-timeline.txt. A lock left by a killed run
 * (its pid is gone) is taken over.
 *
 * --capture writes into <baseline>.new/ and swaps it in only when every step passed, so an aborted capture
 * never costs the old reference. --force (replace an existing baseline) is refused unless the frozen set
 * is unchanged between the old baseline's HEAD and HEAD (`git diff --quiet`). The small text files of the
 * default baseline are also copied to docs/kb/baseline/ (committed: out/ is not).
 *
 * Gates (§11.B):
 *    1  the frozen set (§10 "Untouched") is unchanged against the baseline HEAD (git diff + status, untracked
 *       files included); scripts/audio/ lists the same entries (film 1's mix hash reads every one, H1)
 *    2  sha256 of public/voice/*.wav, src/voice.generated.ts, scripts/voice-lines.json, public/sfx/*.{wav,json}
 *       (mix.wav must still be ec037282…f31e35e); public/voice/ and public/sfx/ hold the same entries
 *    3  public/voice/*.wav size + mtime unchanged (inputs to film 1's mix hash, H2)
 *    4  scripts/generate-sfx.mjs prints "up to date (2efdbc5153019f3c) — skipped" and mix.wav's mtime holds.
 *       Its hash is computed FIRST (scripts/audio/hash.mjs, read-only): on a mismatch the driver is NOT run,
 *       because it would rebuild into public/sfx/ (H3).
 *    5  timeline.json (src/timing.ts evaluated) byte-identical; check-mix stdout + cue-timeline.txt identical, exit 0
 *    6  check-render stdout on the delivered film 1 MP4s identical, exit 0; the MP4s' bytes unchanged
 *    7  `remotion compositions src/index.ts` table identical
 *    8  a fresh `remotion bundle src/index.ts`: same sha256 for every emitted file outside public/. index.html
 *       is compared with the public/kb/ entries (film 2's files) taken out of its static-file list: Remotion
 *       lists every public/ file there (name, size, mtime), public/ is shared, and film 1 never reads that
 *       list. Every other byte of index.html — film 1's own sfx/, voice/, img/ entries included — must match.
 *    9  the 35 stills (§11.A) from that bundle match the baseline: byte-identical, or max channel delta ≤ 1/255
 *       when the baseline found the renderer not byte-deterministic (meta.json stillsMode)
 *   10  `npm run typecheck` passes; `npm run check:port` passes (skipped while the script does not exist)
 *   11  `render-master --dry-run` (main) names the same comps, chunk ranges, bundle and output paths as the
 *       baseline formula. Run with NTV_EXPECT_DRY_RUN=1 (render-master aborts before step 1 if it is not in
 *       its dry-run branch) and a stub `npx` first on PATH (exit 97), so a regressed dry-run can never
 *       bundle, render or re-mux over the delivered masters. Not run if render-master lacks either.
 *
 * Writes only under out/kb-plan/ (baseline/ on --capture, verify/ otherwise), docs/kb/baseline/ (on a
 * --capture of the default baseline) and film 1's own QA file out/audio/cue-timeline.txt (check-mix
 * rewrites it with identical bytes). Remotion commands run with NTV_SKIP_SFX=1. Plain `node` is enough:
 * every .ts import runs in a child with --experimental-strip-types.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  closeSync, copyFileSync, existsSync, linkSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { bundleFiles, isFilm2Static, staticFilesOf } from '../bundle-digest.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const KB_PLAN = path.join(ROOT, 'out', 'kb-plan');
const V = path.join(KB_PLAN, 'verify');
const LOCK = path.join(KB_PLAN, 'verify-film1.lock');
const DEFAULT_B = path.join(KB_PLAN, 'baseline');
/** the committed copy of the baseline's small text files (out/ is gitignored) */
const DOCS_B = path.join(ROOT, 'docs', 'kb', 'baseline');
const rel = (p) => path.relative(ROOT, p);

/* ── what film 1 is (PIPELINE.md §1, §10, §11.A) ── */
const EXPECT_MIX_HASH = '2efdbc5153019f3c';
const EXPECT_MIX_SHA = 'ec03728237edab6417e6ab418ee7c2b1ce04215acc6431cd5e240d8aad31f35e';
const FROZEN = [
  'src/index.ts', 'src/Root.tsx', 'src/Trailer.tsx', 'src/Soundtrack.tsx', 'src/timing.ts', 'src/theme.ts', 'src/voice.generated.ts', 'src/css.d.ts',
  'src/components', 'src/scenes', 'src/dev',
  ...['fonts', 'glide', 'handoff', 'layout', 'lights', 'motion', 'pickup', 'scene', 'type'].map((n) => `src/lib/${n}.ts`),
  'scripts/generate-sfx.mjs', 'scripts/audio', 'scripts/voice-lines.json',
  'public/voice', 'public/img', 'public/sfx',
  'tsconfig.json', 'package-lock.json',
];
const DELIVERED = ['16x9', '9x16', '16x9-4k120', '9x16-4k120'].map((s) => `out/neurotechvoice-trailer-${s}.mp4`);
const STILL_FRAMES = [0, 60, 120, 180, 240, 560, 885, 945, 1005, 1200, 1395, 1690, 1980, 2160, 2250, 2309];
const STILLS = [
  ...STILL_FRAMES.flatMap((f) => ['16x9', '9x16'].map((o) => ({ name: `p${o}-${f}.png`, comp: `Preview-${o}`, frame: f, scale: 1 }))),
  { name: 't16x9-4802.png', comp: 'Trailer-16x9', frame: 4802, scale: 2 }, // 4K, sub-frame 1200.5
  { name: 't16x9-9000.png', comp: 'Trailer-16x9', frame: 9000, scale: 2 }, // 4K end card (WebGL)
  { name: 't9x16-8640.png', comp: 'Trailer-9x16', frame: 8640, scale: 2 }, // 4K logo impact
];

/* ── arguments ── */
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const opt = (k) => argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
if (has('--help') || has('-h')) {
  const src = readFileSync(fileURLToPath(import.meta.url), 'utf8');
  console.log(src.slice(src.indexOf('/**') + 4, src.indexOf(' */')).replace(/^ \* ?/gm, ''));
  process.exit(0);
}
const capture = has('--capture');
const fast = has('--fast');
const keep = has('--keep');
const only = opt('only')?.split(',').map(Number);
const B = opt('baseline') ? path.resolve(opt('baseline')) : DEFAULT_B;

/* ── one run at a time (out/kb-plan/verify/ and out/audio/cue-timeline.txt are shared) ── */
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
};
const readLock = (f) => {
  try {
    return JSON.parse(readFileSync(f, 'utf8'));
  } catch {
    return null;
  }
};
const takeLock = () => {
  mkdirSync(KB_PLAN, { recursive: true });
  const me = { pid: process.pid, at: new Date().toISOString(), argv: argv.join(' ') };
  // the lock appears with its content in one step (link of a finished file), so a reader never sees it half-written
  const mine = `${LOCK}.${process.pid}`;
  writeFileSync(mine, JSON.stringify(me) + '\n');
  const deadline = Date.now() + (has('--no-wait') ? 0 : 60 * 60e3);
  let told = false;
  try {
    for (;;) {
      try {
        linkSync(mine, LOCK);
        break;
      } catch (e) {
        if (e.code !== 'EEXIST') throw e;
      }
      const holder = readLock(LOCK);
      if (!holder || !alive(holder.pid)) {
        // left by a killed run: take it over (rename first, so two runs cannot both delete a fresh lock)
        const grave = `${LOCK}.stale-${process.pid}`;
        try {
          renameSync(LOCK, grave);
          const h = readLock(grave);
          if (h && alive(h.pid)) linkSync(grave, LOCK); // raced with a live run's fresh lock: put it back
        } catch {
          /* someone else moved it: retry */
        }
        rmSync(grave, { force: true });
        continue;
      }
      if (Date.now() >= deadline) {
        rmSync(mine, { force: true }); // (process.exit skips the finally below)
        console.error(`verify-film1: another run holds ${rel(LOCK)} (pid ${holder.pid}, since ${holder.at}: ${holder.argv || '(full)'})${has('--no-wait') ? '' : ' — waited 60 min'}; not run`);
        process.exit(2);
      }
      if (!told) console.log(`verify-film1: waiting for the run already going (pid ${holder.pid}, since ${holder.at}: ${holder.argv || '(full)'}) …`);
      told = true;
      sleep(3000);
    }
  } finally {
    rmSync(mine, { force: true });
  }
  process.on('exit', () => {
    if (readLock(LOCK)?.pid === process.pid) rmSync(LOCK, { force: true });
  });
  for (const [sig, code] of [['SIGINT', 130], ['SIGTERM', 143], ['SIGHUP', 129]]) process.on(sig, () => process.exit(code));
};
takeLock();

/* ── child processes ── */
const BASE_ENV = { ...process.env };
delete BASE_ENV.NTV_FILM; // film 1 only
delete BASE_ENV.NTV_HEVC;
const NODE_TS = [process.execPath, '--experimental-strip-types', '--no-warnings'];
let LOGS = null;
let logN = 0;
const run = (cmd, args, { env = {}, log } = {}) => {
  const t0 = Date.now();
  const r = spawnSync(cmd, args, { cwd: ROOT, env: { ...BASE_ENV, ...env }, maxBuffer: 1 << 30 });
  const res = {
    code: r.status ?? 1,
    out: r.stdout ?? Buffer.alloc(0),
    err: Buffer.concat([r.stderr ?? Buffer.alloc(0), Buffer.from(r.error ? String(r.error) : '')]),
    s: (Date.now() - t0) / 1000,
  };
  if (LOGS && log) {
    mkdirSync(LOGS, { recursive: true });
    const head = `$ ${[cmd, ...args].map((a) => (a.startsWith(ROOT + path.sep) ? rel(a) : a)).join(' ')}\n# exit ${res.code}, ${res.s.toFixed(1)} s\n--- stdout\n`;
    writeFileSync(path.join(LOGS, `${String(++logN).padStart(2, '0')}-${log}.log`), Buffer.concat([Buffer.from(head), res.out, Buffer.from('\n--- stderr\n'), res.err]));
  }
  return res;
};
const node = (args, o) => run(NODE_TS[0], [...NODE_TS.slice(1), ...args], o);
const remotion = (args, o) => run('npx', ['remotion', ...args], { ...o, env: { NTV_SKIP_SFX: '1', ...o?.env } });
const tail = (buf, n = 6) => buf.toString().split('\n').filter((l) => l.trim() && !/memory|CGroup|docker|lower amount/i.test(l)).slice(-n).map((l) => `  | ${l}`).join('\n');

/* ── hashing / files ── */
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
const shaText = (s) => createHash('sha256').update(s).digest('hex');
const ls = (dir, re) => readdirSync(path.join(ROOT, dir)).filter((f) => !re || re.test(f)).sort();
const film1Files = () => [
  ...ls('public/voice', /\.wav$/).map((f) => `public/voice/${f}`),
  'src/voice.generated.ts',
  'scripts/voice-lines.json',
  ...ls('public/sfx', /\.wav$/).map((f) => `public/sfx/${f}`),
  ...ls('public/sfx', /\.json$/).map((f) => `public/sfx/${f}`),
];
const sha256Listing = (files) => files.map((f) => `${sha(path.join(ROOT, f))}  ${f}\n`).join('');
const dirsListing = () =>
  ['public/voice', 'public/sfx', 'scripts/audio']
    .flatMap((d) => readdirSync(path.join(ROOT, d), { withFileTypes: true }).map((e) => `${d}/${e.name}${e.isDirectory() ? '/' : ''}`))
    .sort()
    .join('\n') + '\n';
const voiceStat = () =>
  ls('public/voice', /\.wav$/)
    .map((f) => {
      const p = path.join(ROOT, 'public/voice', f);
      const s = statSync(p);
      return `public/voice/${f} ${s.size} ${s.mtimeMs} ${statSync(p, { bigint: true }).mtimeNs}`;
    })
    .join('\n') + '\n';
const mixStat = () => {
  const s = statSync(path.join(ROOT, 'public/sfx/mix.wav'));
  return `${s.size} ${s.mtimeMs}`;
};
/**
 * sha256 of every file a bundle emitted outside public/ (`<sha>  ./<path>` lines). index.html is hashed with
 * the public/kb/ entries (film 2's files) taken out of its static-file list — the rest of it byte for byte,
 * film 1's own entries included (scripts/bundle-digest.mjs). `kb` = how many entries were taken out.
 */
const bundleListingOf = (dir) => {
  const { files, dropped } = bundleFiles(dir, { drop: isFilm2Static });
  return { listing: files.map((f) => `${f.sha}  ./${f.rel}\n`).join(''), kb: dropped.length };
};
const bundleListing = (dir) => bundleListingOf(dir).listing;
/** why two index.html differ: the static-file entries (other than public/kb/) that changed, or the rest of the page */
const indexHtmlDiff = (fa, fb) => {
  try {
    const ha = readText(fa);
    const hb = readText(fb);
    const key = (e) => `${e.name} ${e.sizeInBytes} ${e.lastModified}`;
    const a = new Map(staticFilesOf(ha).filter((e) => !isFilm2Static(e)).map((e) => [e.name, key(e)]));
    const b = new Map(staticFilesOf(hb).filter((e) => !isFilm2Static(e)).map((e) => [e.name, key(e)]));
    const d = [];
    for (const [n, k] of a) if (!b.has(n)) d.push(`static entry gone: ${n}`); else if (b.get(n) !== k) d.push(`static entry changed: ${k} → ${b.get(n)}`);
    for (const n of b.keys()) if (!a.has(n)) d.push(`static entry new: ${n}`);
    const strip = (h) => h.replace(/window\.remotion_staticFiles = \[.*?\](?=[.<])/s, '');
    if (strip(ha) !== strip(hb)) d.push(`the page outside the static-file list differs: ${firstDiff(strip(ha), strip(hb))}`);
    return d.length ? d : ['(no difference found outside the public/kb/ entries)'];
  } catch (e) {
    return [`(index.html not compared: ${e.message})`];
  }
};
const read = (f) => readFileSync(f);
const readText = (f) => readFileSync(f, 'utf8');
const firstDiff = (a, b) => {
  const x = String(a).split('\n');
  const y = String(b).split('\n');
  for (let i = 0; i < Math.max(x.length, y.length); i++)
    if (x[i] !== y[i]) return `line ${i + 1}:\n    baseline: ${(x[i] ?? '<none>').slice(0, 220)}\n    now:      ${(y[i] ?? '<none>').slice(0, 220)}`;
  return 'identical text';
};
const listingDiff = (base, now) => {
  const parse = (t) => new Map(t.trim().split('\n').filter(Boolean).map((l) => { const m = l.match(/^(\S+)\s+(.+)$/); return [m[2], m[1]]; }));
  const a = parse(base);
  const b = parse(now);
  const d = [];
  for (const [f, h] of a) if (!b.has(f)) d.push(`missing  ${f}`); else if (b.get(f) !== h) d.push(`changed  ${f}`);
  for (const f of b.keys()) if (!a.has(f)) d.push(`new      ${f}`);
  return d;
};

/* ── PNG decode (node:zlib only) + max channel delta ── */
const decodePng = (file) => {
  const buf = readFileSync(file);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error(`${file}: not a PNG`);
  let w = 0, h = 0, depth = 0, ctype = 0, interlace = 0;
  const idat = [];
  for (let p = 8; p < buf.length; ) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('latin1', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; ctype = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[ctype];
  if (depth !== 8 || !ch || interlace) throw new Error(`${file}: unsupported PNG (depth ${depth}, colour type ${ctype}, interlace ${interlace})`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const s = y * (stride + 1) + 1;
    const o = y * stride;
    const u = o - stride; // the row above (y > 0)
    for (let i = 0; i < stride; i++) {
      const x = raw[s + i];
      const a = i >= ch ? px[o + i - ch] : 0;
      const b = y ? px[u + i] : 0;
      const c = y && i >= ch ? px[u + i - ch] : 0;
      let v;
      if (f === 0) v = x;
      else if (f === 1) v = x + a;
      else if (f === 2) v = x + b;
      else if (f === 3) v = x + ((a + b) >> 1);
      else if (f === 4) {
        const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c);
        v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      } else throw new Error(`${file}: bad filter ${f} on row ${y}`);
      px[o + i] = v & 255;
    }
  }
  return { w, h, ch, px };
};
/** max |Δ| over every channel of every pixel (0–255) and how many pixels differ at all */
const pngDelta = (fa, fb) => {
  const a = decodePng(fa);
  const b = decodePng(fb);
  if (a.w !== b.w || a.h !== b.h || a.ch !== b.ch) return { max: Infinity, px: a.w * a.h, note: `${a.w}×${a.h}×${a.ch} vs ${b.w}×${b.h}×${b.ch}` };
  let max = 0, n = 0;
  for (let i = 0; i < a.px.length; i += a.ch) {
    let d = 0;
    for (let k = 0; k < a.ch; k++) d = Math.max(d, Math.abs(a.px[i + k] - b.px[i + k]));
    if (d) { n++; if (d > max) max = d; }
  }
  return { max, px: n };
};

/* ── the pieces both modes share ── */
const gitFrozenDirty = (head) => {
  const d = run('git', ['diff', '--name-status', head, '--', ...FROZEN]);
  const s = run('git', ['status', '--porcelain', '--untracked-files=all', '--', ...FROZEN]);
  if (d.code !== 0 || s.code !== 0) return [`git failed: ${d.err}${s.err}`.trim()];
  return [...d.out.toString().split('\n'), ...s.out.toString().split('\n')].filter(Boolean).filter((l, i, a) => a.indexOf(l) === i);
};
const TIMELINE_JS =
  "const T=await import('./src/timing.ts');console.log(JSON.stringify({C:T.CUES,V:T.VOICES,S:T.SCENES,D:T.DURATION,B:T.BED,M:T.MIX,SP:T.SPEECH,PH:T.PHRASES,H:T.HITS}))";
const timeline = () => node(['--input-type=module', '-e', TIMELINE_JS], { log: 'timeline' });
/** film 1's mix hash computed exactly as generate-sfx does (read-only), the stamp's, and render-master's formula */
const PROBE_JS = `
import { readFileSync } from 'node:fs';
import { buildHash } from './scripts/audio/hash.mjs';
const T = await import('./src/timing.ts');
let stamp = null;
try { stamp = JSON.parse(readFileSync('public/sfx/mix.json', 'utf8')).hash; } catch {}
const total = T.DURATION * T.SUB, chunk = 960, scale = 2, ranges = [];
for (let a = 0; a < total; a += chunk) ranges.push([a, Math.min(total, a + chunk) - 1]);
const comps = ['16x9', '9x16'].map((f) => 'Trailer-' + f);
console.log(JSON.stringify({ hash: buildHash(T, process.cwd()), stamp, master: { comps, total, chunk, scale, ranges, bundle: 'out/master/bundle',
  outputs: comps.map((c) => 'out/neurotechvoice-trailer-' + c.slice(8) + '-' + (scale === 2 ? '4k' : 'x' + scale) + T.RENDER_FPS + '.mp4') } }));`;
const probe = () => {
  const r = node(['--input-type=module', '-e', PROBE_JS], { log: 'probe' });
  if (r.code !== 0) throw new Error(`probe failed:\n${tail(r.err, 12)}`);
  return JSON.parse(r.out.toString());
};
const sfxRun = () => node([path.join(ROOT, 'scripts', 'generate-sfx.mjs')], { log: 'generate-sfx' });
const checkMix = () => node([path.join(ROOT, 'scripts', 'check-mix.mjs')], { log: 'check-mix' });
const checkRender = (files) => node([path.join(ROOT, 'scripts', 'check-render.mjs'), ...files], { log: 'check-render' });
const compositions = () => {
  const r = remotion(['compositions', 'src/index.ts'], { log: 'compositions' });
  // eslint-disable-next-line no-control-regex
  const lines = r.out.toString().replace(/\x1b\[[0-9;]*m/g, '').split('\n');
  const i = lines.findIndex((l) => /compositions are available/.test(l));
  return { ...r, table: i < 0 ? null : lines.slice(i).map((l) => l.trimEnd()).join('\n').trim() + '\n' };
};
const bundle = (dir) => {
  rmSync(dir, { recursive: true, force: true });
  return remotion(['bundle', 'src/index.ts', '--out-dir', dir], { log: `bundle-${path.basename(dir)}` });
};
const renderStills = (bundleDir, outDir) => {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const t0 = Date.now();
  for (const s of STILLS) {
    const args = ['still', bundleDir, s.comp, path.join(outDir, s.name), `--frame=${s.frame}`, '--image-format=png'];
    if (s.scale !== 1) args.push(`--scale=${s.scale}`);
    const r = remotion(args);
    if (r.code !== 0 || !existsSync(path.join(outDir, s.name))) throw new Error(`still ${s.name} failed (exit ${r.code}):\n${tail(r.err, 10)}\n${tail(r.out, 4)}`);
  }
  return (Date.now() - t0) / 1000;
};
const stillsListing = (dir) => STILLS.map((s) => `${sha(path.join(dir, s.name))}  ${s.name}\n`).join('');
const typecheck = () => run('npm', ['run', '--silent', 'typecheck'], { log: 'typecheck' });
const pkgScripts = () => JSON.parse(readText(path.join(ROOT, 'package.json'))).scripts ?? {};
const fmtS = (s) => (s >= 60 ? `${Math.floor(s / 60)} min ${Math.round(s % 60)} s` : `${s.toFixed(1)} s`);
/** a baseline's small text files (HEAD, *.sha256, *.txt, *.json, *.stat — not the bundle, stills or logs) */
const TEXT_BASELINE = /^HEAD$|\.(txt|json|sha256|stat)$/;
/** copy them to dst/ (its other files, e.g. a README, are kept); returns how many */
const copyTextBaseline = (src, dst) => {
  mkdirSync(dst, { recursive: true });
  for (const f of readdirSync(dst)) if (TEXT_BASELINE.test(f)) rmSync(path.join(dst, f));
  const files = readdirSync(src, { withFileTypes: true }).filter((e) => e.isFile() && TEXT_BASELINE.test(e.name)).map((e) => e.name);
  for (const f of files) copyFileSync(path.join(src, f), path.join(dst, f));
  return files.length;
};

/* ════════════════════════════════ --capture (§11.A) ════════════════════════════════ */
if (capture) {
  const OLD_HEAD = existsSync(path.join(B, 'HEAD')) ? readText(path.join(B, 'HEAD')).trim() : null;
  if (OLD_HEAD && !has('--force')) {
    console.error(`${rel(B)} already holds a baseline (HEAD ${OLD_HEAD.slice(0, 7)}). It must be captured once, before any edit;\n` +
      'pass --force only if you are sure the frozen set is still the delivered film 1.');
    process.exit(2);
  }
  if (OLD_HEAD) {
    // a forced recapture must not move the reference: the frozen set must be the same at the old baseline's HEAD and now
    const d = run('git', ['diff', '--quiet', OLD_HEAD, 'HEAD', '--', ...FROZEN]);
    if (d.code !== 0) {
      console.error(`--force refused: the frozen set differs between the old baseline's HEAD ${OLD_HEAD.slice(0, 7)} and HEAD` +
        `${d.code === 1 ? '' : ` (git diff exit ${d.code}: ${d.err.toString().trim()})`} — a recapture would hide that change instead of proving film 1 unchanged.`);
      process.exit(2);
    }
  }
  // capture into <baseline>.new/ and swap it in only when every step passed: an abort never costs the old reference
  const BN = `${B}.new`;
  rmSync(BN, { recursive: true, force: true });
  mkdirSync(BN, { recursive: true });
  LOGS = path.join(BN, 'logs');
  const T0 = Date.now();
  const timings = {};
  const step = (name, fn) => {
    const t0 = Date.now();
    process.stdout.write(`[capture] ${name} … `);
    const r = fn();
    timings[name] = +((Date.now() - t0) / 1000).toFixed(1);
    console.log(`${fmtS(timings[name])}${typeof r === 'string' ? ` — ${r}` : ''}`);
    return r;
  };
  const abort = (m) => {
    console.log('');
    console.error(`[capture] ABORT: ${m}`);
    process.exit(1);
  };
  const W = (f, data) => writeFileSync(path.join(BN, f), data);

  const head = run('git', ['rev-parse', 'HEAD']).out.toString().trim();
  step('frozen set clean', () => {
    const dirty = gitFrozenDirty(head);
    if (dirty.length) abort(`the frozen set differs from HEAD — not an untouched tree:\n  ${dirty.join('\n  ')}`);
    const other = run('git', ['status', '--porcelain']).out.toString().trim();
    W('HEAD', head + '\n');
    W('frozen.txt', FROZEN.join('\n') + '\n');
    return other ? `clean (other changes in the tree, outside the frozen set: ${other.split('\n').length})` : `clean at ${head.slice(0, 7)}`;
  });
  step('sha256 of film 1 files', () => {
    const l = sha256Listing(film1Files());
    W('film1.sha256', l);
    W('dirs.txt', dirsListing());
    const mix = l.match(/^(\w+)  public\/sfx\/mix\.wav$/m)?.[1];
    if (mix !== EXPECT_MIX_SHA) abort(`public/sfx/mix.wav is ${mix}, PIPELINE.md §1 says ${EXPECT_MIX_SHA}`);
    return `${l.trim().split('\n').length} files, mix.wav ${mix.slice(0, 8)}…`;
  });
  step('voice stat', () => {
    W('voice.stat', voiceStat());
    W('mix.stat', mixStat() + '\n');
    return `${ls('public/voice', /\.wav$/).length} voices`;
  });
  step('timeline.json', () => {
    const r = timeline();
    if (r.code !== 0) abort(`timeline dump failed:\n${tail(r.err, 12)}`);
    W('timeline.json', r.out);
    return `${r.out.length} B, sha256 ${shaText(r.out).slice(0, 16)}`;
  });
  const pr = {};
  step('mix hash probe', () => {
    const p = probe();
    pr.hash = p.hash; // (step() hands back the fn's string for the log: keep the hash for meta.json here)
    if (p.hash !== EXPECT_MIX_HASH || p.stamp !== EXPECT_MIX_HASH) abort(`film 1's mix hash is ${p.hash}, stamp ${p.stamp}; expected ${EXPECT_MIX_HASH}. Not running generate-sfx (it would rebuild public/sfx/).`);
    W('render-master.expected.json', JSON.stringify(p.master, null, 2) + '\n');
    return `buildHash = stamp = ${p.hash}`;
  });
  step('generate-sfx', () => {
    const m0 = mixStat();
    const r = sfxRun();
    W('sfx.txt', r.out);
    const want = `[sfx] up to date (${EXPECT_MIX_HASH}) — skipped\n`;
    if (r.code !== 0 || r.out.toString() !== want) abort(`generate-sfx printed:\n${r.out}${tail(r.err)}`);
    if (mixStat() !== m0) abort('mix.wav changed during generate-sfx');
    return r.out.toString().trim();
  });
  step('check-mix', () => {
    const r = checkMix();
    W('check-mix.txt', r.out);
    if (r.code !== 0) abort(`check-mix exit ${r.code}:\n${tail(r.out, 12)}`);
    W('cue-timeline.txt', read(path.join(ROOT, 'out/audio/cue-timeline.txt')));
    return r.out.toString().trim().split('\n').pop();
  });
  const delivered = DELIVERED.filter((f) => existsSync(path.join(ROOT, f)));
  step('check-render', () => {
    if (!delivered.length) {
      W('check-render.txt', '');
      W('delivered.txt', '');
      return 'no delivered MP4 in out/ — gate 6 will be skipped';
    }
    const r = checkRender(delivered);
    W('check-render.txt', r.out);
    if (r.code !== 0) abort(`check-render exit ${r.code}:\n${r.out}`);
    W('delivered.txt', delivered.join('\n') + '\n');
    W('delivered.sha256', sha256Listing(delivered));
    return `${delivered.length} MP4s ✓`;
  });
  step('compositions', () => {
    const r = compositions();
    if (r.code !== 0 || !r.table) abort(`remotion compositions failed:\n${tail(r.err, 10)}`);
    W('compositions.txt', r.table);
    return `${r.table.trim().split('\n').length - 2} compositions`;
  });
  step('bundle ×2', () => {
    const a = path.join(BN, 'bundle-a');
    const b = path.join(BN, 'bundle-b');
    for (const d of [a, b]) {
      const r = bundle(d);
      if (r.code !== 0) abort(`remotion bundle failed:\n${tail(r.err, 10)}`);
    }
    const la = bundleListing(a);
    const lb = bundleListing(b);
    W('bundle.sha256', la);
    W('bundle-b.sha256', lb);
    if (la !== lb) abort(`two bundles of the same tree differ — gate 8 cannot work:\n  ${listingDiff(la, lb).slice(0, 10).join('\n  ')}`);
    rmSync(b, { recursive: true, force: true }); // only needed for the determinism check
    return `${la.trim().split('\n').length} files outside public/, deterministic (bundle-b removed)`;
  });
  const stills = step('stills a/ and b/', () => {
    const a = path.join(BN, 'stills', 'a');
    const b = path.join(BN, 'stills', 'b');
    const sa = renderStills(path.join(BN, 'bundle-a'), a);
    const sb = renderStills(path.join(BN, 'bundle-a'), b);
    const la = stillsListing(a);
    const lb = stillsListing(b);
    W('stills.sha256', la);
    W('stills-b.sha256', lb);
    const rows = [];
    let maxAll = 0;
    for (const s of STILLS) {
      if (sha(path.join(a, s.name)) === sha(path.join(b, s.name))) rows.push(`${s.name} identical`);
      else {
        const d = pngDelta(path.join(a, s.name), path.join(b, s.name));
        maxAll = Math.max(maxAll, d.max);
        rows.push(`${s.name} differs: max delta ${d.max}/255 in ${d.px} px${d.note ? ` (${d.note})` : ''}`);
      }
    }
    const identical = la === lb;
    W('stills-compare.txt', rows.join('\n') + '\n');
    if (!identical && maxAll > 1) abort(`stills a/ vs b/ differ by up to ${maxAll}/255 — the renderer is not stable enough for a ≤1/255 gate (stills-compare.txt)`);
    return { identical, maxAll, sa, sb, note: identical ? `${STILLS.length}/${STILLS.length} byte-identical` : `not byte-identical, max delta ${maxAll}/255` };
  });
  console.log(`  stills: ${stills.note} (a/ ${fmtS(stills.sa)}, b/ ${fmtS(stills.sb)})`);
  step('typecheck', () => {
    const r = typecheck();
    if (r.code !== 0) abort(`npm run typecheck failed:\n${tail(r.out, 12)}`);
    return 'pass';
  });

  timings.total = +((Date.now() - T0) / 1000).toFixed(1);
  const remotionVersion = JSON.parse(readText(path.join(ROOT, 'node_modules/@remotion/cli/package.json'))).version;
  const meta = {
    head,
    capturedAt: new Date().toISOString(),
    node: process.version,
    remotion: remotionVersion,
    mixHash: pr.hash,
    mixSha256: EXPECT_MIX_SHA,
    film1Files: readText(path.join(BN, 'film1.sha256')).trim().split('\n').length,
    delivered,
    bundleDeterministic: true,
    stills: STILLS.length,
    stillsMode: stills.identical ? 'exact' : 'delta',
    stillsMaxDelta: stills.maxAll,
    timings,
  };
  W('meta.json', JSON.stringify(meta, null, 2) + '\n');
  W('timings.json', JSON.stringify(timings, null, 2) + '\n');
  // every step passed: swap the new baseline in (the old one is removed only after the new one is in place)
  const OLD = `${B}.old-${process.pid}`;
  if (existsSync(B)) renameSync(B, OLD);
  renameSync(BN, B);
  rmSync(OLD, { recursive: true, force: true });
  let docs = '';
  if (B === DEFAULT_B) docs = ` (text files also in ${rel(DOCS_B)}/: ${copyTextBaseline(B, DOCS_B)} files — commit them)`;
  console.log(`[capture] baseline written to ${rel(B)}/ in ${fmtS(timings.total)} — stills gate: ${meta.stillsMode}${docs}`);
  process.exit(0);
}

/* ════════════════════════════════ verify (§11.B) ════════════════════════════════ */
if (!existsSync(path.join(B, 'meta.json'))) {
  console.error(`no baseline in ${rel(B)}/ — run: node scripts/kb/verify-film1.mjs --capture`);
  process.exit(2);
}
mkdirSync(V, { recursive: true });
LOGS = path.join(V, 'logs');
rmSync(LOGS, { recursive: true, force: true });
const META = JSON.parse(readText(path.join(B, 'meta.json')));
const BASE_HEAD = readText(path.join(B, 'HEAD')).trim();
const bt = (f) => readText(path.join(B, f));
const want = only ? [...only] : fast ? [1, 2, 3, 4, 5, 10] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
// gate 9 renders its stills from gate 8's bundle: --only=9 runs (and reports) 8 first
if (want.includes(9) && !want.includes(8)) want.splice(want.indexOf(9), 0, 8);
const results = [];
const state = { sfxHashOk: null, bundleDir: null };
const T0 = Date.now();

const GATES = {
  1: ['frozen set unchanged', () => {
    const d = [];
    const dirty = gitFrozenDirty(BASE_HEAD);
    if (dirty.length) d.push(`differs from baseline ${BASE_HEAD.slice(0, 7)} (git diff / status):`, ...dirty.slice(0, 20).map((l) => `  ${l}`));
    const audioNow = dirsListing().split('\n').filter((l) => l.startsWith('scripts/audio/'));
    const audioBase = bt('dirs.txt').split('\n').filter((l) => l.startsWith('scripts/audio/'));
    if (audioNow.join('\n') !== audioBase.join('\n'))
      d.push(`scripts/audio/ entries changed (H1: film 1's mix hash reads every entry): ${[...audioNow.filter((x) => !audioBase.includes(x)).map((x) => `+${x}`), ...audioBase.filter((x) => !audioNow.includes(x)).map((x) => `-${x}`)].join(' ')}`);
    return d.length ? { fail: d } : { ok: `${FROZEN.length} paths match ${BASE_HEAD.slice(0, 7)}; no untracked files; scripts/audio/ ${audioNow.length} entries` };
  }],
  2: ['film 1 file hashes', () => {
    const base = bt('film1.sha256');
    const now = sha256Listing(base.trim().split('\n').map((l) => l.slice(66)).filter((f) => existsSync(path.join(ROOT, f))));
    const d = listingDiff(base, now);
    const mix = now.match(/^(\w+)  public\/sfx\/mix\.wav$/m)?.[1];
    if (mix !== EXPECT_MIX_SHA) d.unshift(`public/sfx/mix.wav is ${mix ?? 'missing'}, must be ${EXPECT_MIX_SHA}`);
    const dirNow = dirsListing().split('\n').filter((l) => l.startsWith('public/'));
    const dirBase = bt('dirs.txt').split('\n').filter((l) => l.startsWith('public/'));
    for (const x of dirNow) if (!dirBase.includes(x)) d.push(`new entry  ${x}`);
    for (const x of dirBase) if (!dirNow.includes(x) && !d.some((m) => m.endsWith(x))) d.push(`gone       ${x}`);
    return d.length ? { fail: d.slice(0, 25) } : { ok: `${base.trim().split('\n').length} files identical (mix.wav ${EXPECT_MIX_SHA.slice(0, 8)}…); public/voice + public/sfx hold the same ${dirNow.length} entries` };
  }],
  3: ['voice size + mtime', () => {
    const now = voiceStat();
    const base = bt('voice.stat');
    return now === base ? { ok: `${base.trim().split('\n').length} voices: size and mtime unchanged` } : { fail: [firstDiff(base, now)] };
  }],
  4: ['generate-sfx skips', () => {
    const p = probe();
    const wantLine = bt('sfx.txt');
    const baseHash = wantLine.match(/\(([0-9a-f]+)\)/)?.[1];
    if (p.hash !== baseHash || p.stamp !== baseHash) {
      state.sfxHashOk = false;
      return { fail: [`film 1's mix hash is now ${p.hash} (stamp ${p.stamp}), baseline ${baseHash}: an input of film 1's sound changed.`, 'generate-sfx NOT run (it would rebuild into public/sfx/).'] };
    }
    state.sfxHashOk = true;
    const m0 = mixStat();
    const r = sfxRun();
    const d = [];
    if (r.code !== 0) d.push(`exit ${r.code}${tail(r.err)}`);
    if (r.out.toString() !== wantLine) d.push(`printed: ${r.out.toString().trim()}`, `wanted:  ${wantLine.trim()}`);
    const m1 = mixStat();
    if (m1 !== m0) d.push(`mix.wav size/mtime changed during the run: ${m0} → ${m1}`);
    if (m1 !== bt('mix.stat').trim()) d.push(`mix.wav size/mtime ${m1} ≠ baseline ${bt('mix.stat').trim()} (rewritten since the baseline)`);
    return d.length ? { fail: d } : { ok: `${r.out.toString().trim()}; mix.wav mtime unchanged` };
  }],
  5: ['timeline + check-mix', () => {
    const d = [];
    const t = timeline();
    if (t.code !== 0) d.push(`timeline dump failed:\n${tail(t.err, 10)}`);
    else if (!t.out.equals(read(path.join(B, 'timeline.json')))) d.push(`timeline.json differs: ${firstDiff(bt('timeline.json').replace(/([,{[])/g, '$1\n'), t.out.toString().replace(/([,{[])/g, '$1\n'))}`);
    const r = checkMix();
    writeFileSync(path.join(V, 'check-mix.txt'), r.out);
    if (r.code !== 0) d.push(`check-mix exit ${r.code}`);
    if (!r.out.equals(read(path.join(B, 'check-mix.txt')))) d.push(`check-mix output differs: ${firstDiff(bt('check-mix.txt'), r.out)}`);
    const ct = read(path.join(ROOT, 'out/audio/cue-timeline.txt'));
    if (!ct.equals(read(path.join(B, 'cue-timeline.txt')))) d.push(`cue-timeline.txt differs: ${firstDiff(bt('cue-timeline.txt'), ct)}`);
    return d.length ? { fail: d } : { ok: `timeline.json ${t.out.length} B identical; check-mix identical (${r.out.toString().trim().split('\n').pop()}); cue-timeline identical` };
  }],
  6: ['check-render on delivered MP4s', () => {
    const files = META.delivered ?? [];
    if (!files.length) return { skip: 'the baseline had no delivered MP4 in out/' };
    const missing = files.filter((f) => !existsSync(path.join(ROOT, f)));
    if (missing.length) return { fail: [`missing: ${missing.join(', ')}`] };
    const d = [];
    const r = checkRender(files);
    writeFileSync(path.join(V, 'check-render.txt'), r.out);
    if (r.code !== 0) d.push(`check-render exit ${r.code}`);
    if (!r.out.equals(read(path.join(B, 'check-render.txt')))) d.push(`output differs: ${firstDiff(bt('check-render.txt'), r.out)}`);
    const ld = listingDiff(bt('delivered.sha256'), sha256Listing(files));
    if (ld.length) d.push(`delivered MP4 bytes changed: ${ld.join(', ')}`);
    return d.length ? { fail: d } : { ok: `${files.length} MP4s: check-render identical, bytes unchanged` };
  }],
  7: ['compositions', () => {
    const r = compositions();
    if (r.code !== 0 || !r.table) return { fail: [`remotion compositions failed (exit ${r.code}):\n${tail(r.err, 8)}`] };
    writeFileSync(path.join(V, 'compositions.txt'), r.table);
    return r.table === bt('compositions.txt') ? { ok: `${r.table.trim().split('\n').length - 2} compositions identical` } : { fail: [firstDiff(bt('compositions.txt'), r.table)] };
  }],
  8: ['bundle', () => {
    const dir = path.join(V, 'bundle');
    const r = bundle(dir);
    if (r.code !== 0) return { fail: [`remotion bundle failed (exit ${r.code}):\n${tail(r.err, 8)}`] };
    state.bundleDir = dir;
    const { listing: now, kb } = bundleListingOf(dir);
    writeFileSync(path.join(V, 'bundle.sha256'), now);
    const d = listingDiff(bt('bundle.sha256'), now);
    // index.html differs: say what (film 1's own static entries, or the page itself) when the baseline bundle is at hand
    const baseIndex = path.join(B, 'bundle-a', 'index.html');
    if (d.includes('changed  ./index.html') && existsSync(baseIndex)) d.push(...indexHtmlDiff(baseIndex, path.join(dir, 'index.html')).slice(0, 10).map((l) => `  index.html: ${l}`));
    const kbNote = kb ? ` (index.html compared without its ${kb} public/kb/ static entries: film 2's files, listed by every bundle of the shared public/)` : '';
    return d.length ? { fail: d.slice(0, 30) } : { ok: `${now.trim().split('\n').length} emitted files outside public/ identical${kbNote}` };
  }],
  9: ['stills', () => {
    // the bundle gate 8 built (it runs first whenever 9 is asked for), whether or not its listing matched:
    // the stills are their own proof
    if (!state.bundleDir) return { fail: ['no bundle to render from (gate 8 could not bundle)'] };
    if (!existsSync(path.join(B, 'stills', 'a'))) return { fail: [`${rel(B)}/ has no stills/a/ (a text-only baseline such as docs/kb/baseline): run gate 9 against out/kb-plan/baseline`] };
    const dir = path.join(V, 'stills');
    const s = renderStills(state.bundleDir, dir);
    const exact = META.stillsMode === 'exact';
    const rows = [];
    let maxAll = 0, same = 0;
    for (const st of STILLS) {
      const b = path.join(B, 'stills', 'a', st.name);
      const n = path.join(dir, st.name);
      if (sha(b) === sha(n)) { same++; continue; }
      const d = pngDelta(b, n);
      maxAll = Math.max(maxAll, d.max);
      if (exact || d.max > 1) rows.push(`${st.name}: max delta ${d.max}/255 in ${d.px} px${d.note ? ` (${d.note})` : ''}`);
    }
    const how = `${same}/${STILLS.length} byte-identical${same < STILLS.length ? `, max delta ${maxAll}/255` : ''}, rendered in ${fmtS(s)}`;
    return rows.length ? { fail: [`gate is ${exact ? 'exact (baseline renders were byte-deterministic)' : '≤ 1/255'}; ${how}`, ...rows] } : { ok: how };
  }],
  10: ['typecheck (+ check:port)', () => {
    const d = [];
    const r = typecheck();
    if (r.code !== 0) d.push(`npm run typecheck failed:\n${tail(r.out, 12)}`);
    let port = 'check:port not present yet (skipped)';
    if (pkgScripts()['check:port']) {
      const p = run('npm', ['run', '--silent', 'check:port'], { log: 'check-port' });
      if (p.code !== 0) d.push(`npm run check:port failed:\n${tail(p.out, 10)}${tail(p.err, 6)}`);
      port = 'check:port passes';
    }
    return d.length ? { fail: d } : { ok: `tsc --noEmit passes; ${port}` };
  }],
  11: ['render-master --dry-run', () => {
    const src = readText(path.join(ROOT, 'scripts/render-master.mjs'));
    if (!src.includes('dry-run')) return { skip: 'render-master.mjs has no --dry-run yet (not run: without it the script renders)' };
    if (!src.includes('NTV_EXPECT_DRY_RUN')) return { fail: ['render-master.mjs does not honour NTV_EXPECT_DRY_RUN (its abort if a dry run is not one) — not run'] };
    if (state.sfxHashOk === false) return { fail: ["film 1's mix hash changed (gate 4): render-master's sound step could rebuild public/sfx/ — not run"] };
    if (state.sfxHashOk === null) {
      const p = probe();
      // (a baseline captured before meta.json carried mixHash: the hash its sfx.txt printed, as gate 4 reads it)
      const baseHash = META.mixHash ?? bt('sfx.txt').match(/\(([0-9a-f]+)\)/)?.[1];
      if (!baseHash || p.hash !== baseHash || p.stamp !== baseHash) return { fail: [`film 1's mix hash is ${p.hash} (stamp ${p.stamp}), baseline ${baseHash} — not run`] };
    }
    const exp = JSON.parse(bt('render-master.expected.json'));
    const watch = () => [path.join(ROOT, exp.bundle), ...exp.outputs.map((o) => path.join(ROOT, o))].map((p) => (existsSync(p) ? `${p} ${statSync(p).mtimeMs}` : `${p} -`)).join('\n');
    const w0 = watch();
    const args = [path.join(ROOT, 'scripts/render-master.mjs'), '--dry-run'];
    if (/--film|filmOf/.test(src)) args.push('--film=main');
    // belt and braces: render-master aborts before step 1 unless it is in its dry-run branch (NTV_EXPECT_DRY_RUN),
    // and a stub `npx` first on PATH means that even a regressed script could not bundle, render or mux
    const stub = path.join(V, 'stub-bin');
    rmSync(stub, { recursive: true, force: true });
    mkdirSync(stub, { recursive: true });
    writeFileSync(path.join(stub, 'npx'), '#!/bin/sh\necho "verify-film1 gate 11: npx is stubbed (render-master --dry-run must never call it): npx $*" >&2\nexit 97\n', { mode: 0o755 });
    const r = node(args, { log: 'render-master-dry-run', env: { NTV_EXPECT_DRY_RUN: '1', PATH: `${stub}${path.delimiter}${process.env.PATH ?? ''}` } });
    rmSync(stub, { recursive: true, force: true });
    writeFileSync(path.join(V, 'render-master-dry-run.txt'), r.out);
    const out = r.out.toString();
    const d = [];
    if (r.code !== 0) d.push(`exit ${r.code}:\n${tail(r.err, 8)}`);
    if (watch() !== w0) d.push('the dry run touched out/master/bundle or a delivered master');
    for (const c of exp.comps) if (!out.includes(c)) d.push(`comp ${c} not named`);
    if (!out.includes(exp.bundle) || /bundle-kb/.test(out)) d.push(`bundle ${exp.bundle} not named (or bundle-kb named)`);
    for (const o of exp.outputs) if (!out.includes(o)) d.push(`output ${o} not named`);
    const pad = (n) => String(n).padStart(5, '0');
    const missing = exp.ranges.filter(([a, b]) => ![`${a}-${b}`, `${a}–${b}`, `${a}..${b}`, `${pad(a)}-${pad(b)}`, `[${a},${b}]`, `[${a}, ${b}]`].some((f) => out.includes(f)));
    if (missing.length) d.push(`chunk ranges not named: ${missing.map(([a, b]) => `${a}-${b}`).join(', ')}`);
    return d.length ? { fail: d } : { ok: `${exp.comps.join(', ')}; ${exp.ranges.length} chunks of ${exp.chunk} over ${exp.total} frames; ${exp.bundle}; ${exp.outputs.join(', ')}` };
  }],
};

console.log(`verify-film1: baseline ${BASE_HEAD.slice(0, 7)} (captured ${META.capturedAt}), gates ${want.join(' ')}${fast ? ' (--fast)' : ''}`);
for (const n of want) {
  const [title, fn] = GATES[n] ?? [];
  if (!fn) continue;
  const t0 = Date.now();
  let g;
  try {
    g = fn();
  } catch (e) {
    g = { fail: [String(e?.stack ?? e).split('\n').slice(0, 6).join('\n')] };
  }
  const s = (Date.now() - t0) / 1000;
  const status = g.fail ? 'FAIL' : g.skip ? 'SKIP' : 'PASS';
  results.push({ n, title, status, s, detail: g.fail ?? [g.skip ?? g.ok] });
  console.log(`${status}  ${String(n).padStart(2)}  ${title} (${fmtS(s)}) — ${g.fail ? '' : g.skip ?? g.ok}`);
  if (g.fail) for (const l of g.fail) console.log(`        ${String(l).replace(/\n/g, '\n        ')}`);
}

// the run's bundle and stills are large: keep them only when a picture gate failed, or with --keep
const pictureFailed = results.some((r) => (r.n === 8 || r.n === 9) && r.status === 'FAIL');
if (!keep && !pictureFailed) {
  rmSync(path.join(V, 'bundle'), { recursive: true, force: true });
  rmSync(path.join(V, 'stills'), { recursive: true, force: true });
}
const failed = results.filter((r) => r.status === 'FAIL');
const total = (Date.now() - T0) / 1000;
const summary = `${failed.length ? `FAIL — gate(s) ${failed.map((r) => r.n).join(', ')}` : 'PASS'}: ${results.filter((r) => r.status === 'PASS').length} pass, ${failed.length} fail, ${results.filter((r) => r.status === 'SKIP').length} skipped, ${fmtS(total)}`;
console.log(summary);
writeFileSync(path.join(V, 'report.json'), JSON.stringify({ at: new Date().toISOString(), baseline: BASE_HEAD, head: run('git', ['rev-parse', 'HEAD']).out.toString().trim(), mode: fast ? 'fast' : only ? 'only' : 'full', results, total }, null, 2) + '\n');
process.exit(failed.length ? 1 : 0);
