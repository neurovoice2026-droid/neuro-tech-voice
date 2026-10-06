#!/usr/bin/env node
/**
 * A reel's picture master (docs/ig/PIPELINE.md §8.2): 1080×1920 at 120 fps, rendered in ACT-ALIGNED chunks, several
 * at once, then joined losslessly into out/ig/master/<outName>-1080p120-hevc.mp4 (muted; finish.mjs adds the sound).
 *
 *   node --experimental-strip-types --no-warnings scripts/ig/render-par.mjs --film=ig<n> [--workers=2] [--rebundle]
 *        [--ranges=a-b,c-d,… --dir=<suffix>] [--dry-run]                                          (npm run render:ig)
 *
 * A copy of scripts/kb/render-par.mjs (film 2's) for the reels: scale 1, intermediate HEVC at CRF 12 (NTV_HEVC=1:
 * remotion.config.ts adds x265 aq-mode=3), concurrency 1 per chunk (one tab renders every frame of its chunk the same
 * way: no glide-layer re-raster flicker), `--workers` chunks in parallel (default 2: other agents share the 4 CPUs).
 *
 *   · BUNDLE out/master/bundle-ig. Built here when it is missing or `--rebundle` is passed — after `npm run sfx:ig`
 *     (never while a film 1 / film 2 bundle is being made: H15) — with NTV_SKIP_SFX=1. A bundle older than any file
 *     under src/ is refused (the picture would be stale) unless --rebundle.
 *   · CHUNKS start on every act's mount frame ((from − pre) × SUB): every glide layer mounts at its act's start, so a
 *     chunk boundary never re-rasters text mid-act (RESEARCH-product §2.4.4). out/master/IG<n>-Reel-9x16-x1/ holds
 *     <a>-<b>.mp4 + .done markers (resumable) and plan.json {bundleSha (bundle-digest, sound entries dropped), total,
 *     chunk, scale, crf, concurrency}; chunks of another plan are deleted before rendering.
 *   · --ranges=… --dir=<suffix>: re-render exactly these render-frame ranges into …-x1-<suffix>/ (after a picture fix
 *     of one act); the join takes a range from the newest layer that has it.
 *   · JOIN: concat copy (one HEVC parameter set, frame counts checked) → out/ig/master/<outName>-1080p120-hevc.mp4.
 *
 * Writes only out/master/bundle-ig/, out/master/IG<n>-Reel-9x16-x1*\/ and out/ig/master/.
 */
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleDigest, isSoundStatic } from '../bundle-digest.mjs';
import { filmOf, need } from '../registry.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).slice(k.length + 3);
const film = filmOf(args, { required: true });
if (!film.id.startsWith('ig')) throw new Error(`render-par (IG): --film=${film.id} is not a reel (ig1…ig4)`);
const workers = Math.max(1, Math.min(2, Number(opt('workers', '2'))));
const scale = 1;
const crf = 12;
const concurrency = '1';
const dryRun = args.includes('--dry-run');
const comp = `${film.comp}9x16`;
const explicit = opt('ranges', '') ? opt('ranges', '').split(',').map((r) => r.split('-').map(Number)) : null;
const suffix = opt('dir', '');
if (explicit && !suffix) throw new Error('--ranges needs --dir=<suffix> (explicit ranges never go into the act-chunk folder)');

const T = await import(need(film, 'timing'));
const total = T.DURATION * T.SUB;
const bundle = path.join(ROOT, film.bundle);
const env = { ...process.env, NTV_SKIP_SFX: '1', NTV_HEVC: '1' };
delete env.NTV_FILM;
const log = (m) => console.log(`[render:ig ${new Date().toISOString().slice(11, 19)}] ${m}`);
const name = ([a, b]) => `${String(a).padStart(5, '0')}-${String(b).padStart(5, '0')}`;
const CHUNK = /^(\d{5})-(\d{5})\.mp4$/;
const CHUNK_FILE = /^\d{5}-\d{5}\.mp4(\.done)?$|\.part\.mp4$/;
const BIN = path.join(ROOT, 'node_modules/@remotion/compositor-linux-x64-gnu');
const ff = (tool, a, o = {}) => execFileSync(path.join(BIN, tool), a, { env: { ...process.env, LD_LIBRARY_PATH: BIN }, cwd: ROOT, maxBuffer: 1 << 28, ...o });

/* ── the act-aligned chunks (render frames, inclusive) ── */
const starts = [...new Set(T.ORDER.map((k) => Math.max(0, (T.SCENES[k].from - T.SCENES[k].pre) * T.SUB)))].sort((a, b) => a - b);
if (starts[0] !== 0) starts.unshift(0);
const actRanges = starts.map((s, i) => [s, (starts[i + 1] ?? total) - 1]);
const ranges = explicit ?? actRanges;
for (const [a, b] of ranges) if (!(Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b < total && a <= b)) throw new Error(`bad range ${a}-${b} (0–${total - 1})`);
const dirOf = (sfx) => path.join(ROOT, 'out', 'master', `${comp}-x${scale}${sfx ? `-${sfx}` : ''}`);
const dir = dirOf(suffix);
const outFile = path.join(ROOT, film.outDir, 'master', `${film.outName}-1080p${T.RENDER_FPS}-hevc.mp4`);

if (dryRun) {
  console.log(`render:ig --dry-run · ${film.id} · ${comp} · ${total} frames (${T.DURATION} × ${T.SUB}) · scale ${scale} · crf ${crf} · ${workers} workers`);
  for (const r of ranges) console.log(`  ${name(r)}  ${existsSync(path.join(dir, `${name(r)}.mp4.done`)) ? 'done' : 'to render'}`);
  console.log(`  bundle ${path.relative(ROOT, bundle)}${existsSync(path.join(bundle, 'index.html')) ? '' : ' (missing: built first, after npm run sfx:ig)'}`);
  console.log(`  chunks ${path.relative(ROOT, dir)}/ → ${path.relative(ROOT, outFile)}`);
  process.exit(0);
}

/* ── the bundle ── */
const newestSrc = () => {
  let t = 0;
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else t = Math.max(t, statSync(p).mtimeMs);
    }
  };
  walk(path.join(ROOT, 'src'));
  return t;
};
const haveBundle = existsSync(path.join(bundle, 'index.html'));
if (haveBundle && !args.includes('--rebundle') && statSync(path.join(bundle, 'index.html')).mtimeMs < newestSrc())
  throw new Error(`${path.relative(ROOT, bundle)} is older than a file under src/ — pass --rebundle (the chunks would render the old picture)`);
if (!haveBundle || args.includes('--rebundle')) {
  log('npm run sfx:ig (the bundle lists public/: the mixes must be in place first)');
  const s = spawnSync('npm', ['run', '--silent', 'sfx:ig'], { cwd: ROOT, stdio: 'inherit' });
  if (s.status !== 0) throw new Error('npm run sfx:ig failed');
  rmSync(bundle, { recursive: true, force: true });
  log(`bundling src/ig/index.ts → ${path.relative(ROOT, bundle)}`);
  const b = spawnSync('npx', ['remotion', 'bundle', film.entry, '--out-dir', bundle, '--log=error'], { cwd: ROOT, env, stdio: 'inherit' });
  if (b.status !== 0) throw new Error('remotion bundle failed');
}
const plan = { bundleSha: bundleDigest(bundle, { drop: isSoundStatic }), total, chunk: explicit ? `ranges:${opt('ranges', '')}` : `acts:${starts.join(',')}`, scale, crf, concurrency };
log(`${comp}: bundle sha ${plan.bundleSha.slice(0, 16)} · ${total} frames · ${ranges.length} chunk(s) · ${workers} worker(s)`);

/* ── chunks (resumable) ── */
mkdirSync(dir, { recursive: true });
let old = null;
try {
  old = JSON.parse(readFileSync(path.join(dir, 'plan.json'), 'utf8'));
} catch {}
if (!(old && Object.keys(plan).every((k) => old[k] === plan[k]))) {
  const stale = readdirSync(dir).filter((f) => CHUNK_FILE.test(f));
  for (const f of stale) rmSync(path.join(dir, f));
  if (stale.length) log(`${stale.length} chunk file(s) from another plan deleted`);
  writeFileSync(path.join(dir, 'plan.json'), JSON.stringify(plan, null, 2) + '\n');
}
const queue = ranges.map((r) => ({ r, file: path.join(dir, `${name(r)}.mp4`) })).filter((j) => !(existsSync(`${j.file}.done`) && existsSync(j.file)));
queue.sort((x, y) => y.r[1] - y.r[0] - (x.r[1] - x.r[0]));
log(`${queue.length} chunk(s) to render`);
let failed = 0;
const runOne = ({ r, file }) =>
  new Promise((resolve) => {
    const tmp = file.replace(/\.mp4$/, '.part.mp4');
    const t0 = Date.now();
    log(`${name(r)} start`);
    const p = spawn('npx', ['remotion', 'render', bundle, comp, tmp, `--frames=${r[0]}-${r[1]}`, `--scale=${scale}`, '--muted', '--codec=h265', `--crf=${crf}`, `--concurrency=${concurrency}`, '--log=error'], {
      cwd: ROOT,
      env,
      stdio: ['ignore', 'ignore', 'inherit'],
    });
    p.on('exit', (code) => {
      if (code === 0 && existsSync(tmp)) {
        renameSync(tmp, file);
        writeFileSync(`${file}.done`, '');
        const s = (Date.now() - t0) / 1000;
        log(`${name(r)} done in ${Math.round(s)} s (${(s / (r[1] - r[0] + 1)).toFixed(2)} s/frame)`);
      } else {
        failed++;
        log(`${name(r)} FAILED (exit ${code})`);
      }
      resolve();
    });
  });
await Promise.all(Array.from({ length: workers }, async () => {
  while (queue.length) await runOne(queue.shift());
}));
if (failed) {
  log(`${failed} chunk(s) failed — re-run to retry`);
  process.exit(1);
}

/* ── join: the act chunks, with re-render layers (…-x1-<suffix>/, newest first) over them ── */
const chunksIn = (d) =>
  existsSync(d)
    ? readdirSync(d)
        .map((f) => f.match(CHUNK))
        .filter(Boolean)
        .filter((m) => existsSync(path.join(d, `${m[0]}.done`)))
        .map((m) => ({ file: path.join(d, m[0]), a: Number(m[1]), b: Number(m[2]) }))
    : [];
const base = dirOf('');
const layerDirs = readdirSync(path.dirname(base))
  .filter((d) => d.startsWith(`${path.basename(base)}-`))
  .map((d) => path.join(path.dirname(base), d))
  .sort((x, y) => statSync(y).mtimeMs - statSync(x).mtimeMs);
const chosen = [];
for (const layer of [...layerDirs.map(chunksIn), chunksIn(base)]) for (const c of layer) if (!chosen.some((x) => c.a <= x.b && x.a <= c.b)) chosen.push(c);
const parts = chosen.sort((x, y) => x.a - y.a);
let next = 0;
for (const c of parts) {
  if (c.a !== next) throw new Error(`chunks leave a gap or overlap at frame ${next} (next chunk starts at ${c.a})`);
  next = c.b + 1;
}
if (next !== total) throw new Error(`chunks end at ${next - 1}, the reel is ${total} frames`);
let key0 = null;
for (const c of parts) {
  const p = JSON.parse(ff('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_packets', '-show_entries', 'stream=nb_read_packets,width,height,r_frame_rate,codec_name,profile,level', '-show_data', '-show_streams', '-of', 'json', c.file]).toString());
  const s = p.streams[0];
  if (Number(s.nb_read_packets) !== c.b - c.a + 1) throw new Error(`${path.basename(c.file)} has ${s.nb_read_packets} frames, want ${c.b - c.a + 1}`);
  const key = JSON.stringify([s.codec_name, s.profile, s.level, s.width, s.height, s.r_frame_rate, s.extradata]);
  if (key0 === null) key0 = key;
  else if (key !== key0) throw new Error(`${path.basename(c.file)} has different stream parameters than the first chunk (concat copy needs one)`);
}
const list = path.join(base, 'concat.txt');
writeFileSync(list, parts.map((c) => `file '${c.file}'`).join('\n') + '\n');
mkdirSync(path.dirname(outFile), { recursive: true });
const tmp = outFile.replace(/\.mp4$/, '.tmp.mp4');
ff('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-map', '0:v:0', '-c:v', 'copy', '-tag:v', 'hvc1', '-an', '-movflags', '+faststart', tmp], { stdio: 'inherit' });
renameSync(tmp, outFile);
log(`${path.relative(ROOT, outFile)} (${parts.length} chunks, ${(statSync(outFile).size / 2 ** 20).toFixed(1)} MiB, muted picture master)`);
