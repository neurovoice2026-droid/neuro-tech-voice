#!/usr/bin/env node
/**
 * Master render (npm run render:master -- [16x9|9x16 …] [--scale=2] [--chunk=960] [--crf=16] [--concurrency=1]
 *                [--film=<id>] [--dry-run]).
 *
 * The delivery masters: 3840×2160 / 2160×3840 at RENDER_FPS (120), HEVC Main
 * (hvc1, so QuickTime / iOS / Android / Windows play it), BT.709 limited range,
 * AAC 320k from public/sfx/mix.wav, lip-locked to the sample.
 *
 * Why not one `remotion render`: at 4K 120 fps a film is ~9 000 frames and many
 * hours of Chromium. A container restart would lose all of it. So the film
 * renders in RESUMABLE CHUNKS (picture only, one shared bundle) to
 * out/master/<comp>-x<scale>/; a finished chunk is never rendered again. The
 * chunks are then joined losslessly (same encoder, same parameter sets) and the
 * master mix is muxed once. FFmpeg's native AAC encoder writes the edit list
 * that trims its priming, so the sound starts on frame 0 (check-render proves it).
 *
 * Why --concurrency=1 by default: each render tab rasterises the glide layers
 * (lib/glide.ts) on its own; two tabs can round a re-raster differently, so on
 * a zoom the text alternated ±0.9 px between neighbouring frames. One tab
 * renders every frame the same way: text moves only as far as the camera does.
 *
 * Why HEVC: H.264 at 3840×2160 × 120 fps needs level 6.x, which most hardware
 * decoders refuse; HEVC Main level 5.2 covers 4K120 (it is what phones record).
 *
 * --film=<id> (scripts/films.mjs; default main): the film's timeline, composition prefix, sound driver,
 * entry point, bundle folder and output name. Film 1 (main): Trailer-*, scripts/generate-sfx.mjs,
 * src/index.ts → out/master/bundle → out/neurotechvoice-trailer-<fmt>-4k120.mp4. Film 2 (kb):
 * KB-Trailer-*, scripts/kb/generate-sfx.mjs, src/kb/index.ts → out/master/bundle-kb →
 * out/kb/neurotechvoice-knowledge-<fmt>-4k120.mp4. Each film has its own bundle and chunk folders, so
 * two films can render chunks at the same time — but public/ is SHARED: `remotion bundle` lists (stats)
 * every public/ file, so do not run film 2's sound build (`npm run sfx:kb`, an --install, or a kb master's
 * step 1) while a film 1 master is in its bundle step (step 1): a file renamed into public/kb/sfx/ mid-scan
 * can fail that bundle after out/master/bundle was deleted. (Film 2's driver now stages its temp files in
 * out/audio/kb/, outside public/, which removes the vanishing `.tmp-` entries; the list still changes.)
 *
 * CHUNK PLAN (films that are not frozen, i.e. film 2): a finished chunk is reused only if it was rendered
 * from the same picture. <chunk dir>/plan.json records { bundleSha (sha256 over the bundle's emitted
 * files outside public/, index.html without its sound entries: scripts/bundle-digest.mjs), total, chunk,
 * scale, crf, concurrency }; when the new plan differs, the folder's chunks (*.mp4, *.done) are deleted
 * before rendering, so a scene fix or new takes of the same length can never be muxed as the OLD picture
 * under the NEW mix. A frozen film (film 1) keeps its chunks and its exact command sequence.
 *
 * --dry-run: prints the comps, chunk ranges (and which are done or stale), the sound step, the bundle and
 * the output paths, then exits. Nothing is built, deleted, rendered or written. NTV_EXPECT_DRY_RUN=1
 * (verify-film1 gate 11) makes any run that is NOT a dry run abort before it does anything.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleDigest, isSoundStatic } from './bundle-digest.mjs';
import { abs, filmOf, need } from './films.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const film = filmOf(args);
// refuse a mistyped flag or format BEFORE anything runs (step 1 deletes the film's bundle folder)
const FLAGS = ['scale', 'chunk', 'crf', 'concurrency', 'film'];
const unknown = args.filter((a) => a.startsWith('--') && a !== '--dry-run' && !FLAGS.some((k) => a.startsWith(`--${k}=`)));
if (unknown.length) throw new Error(`render-master: unknown option(s) ${unknown.join(' ')} (known: ${FLAGS.map((k) => `--${k}=`).join(' ')} --dry-run)`);
const dryRun = args.includes('--dry-run');
if (process.env.NTV_EXPECT_DRY_RUN === '1' && !dryRun) {
  console.error('render-master: NTV_EXPECT_DRY_RUN=1 but this is not a --dry-run — aborted before anything was built, deleted or rendered');
  process.exit(3);
}
const T = await import(need(film, 'timing'));

const opt = (k, d) => {
  const a = args.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const scale = Number(opt('scale', '2'));
const chunk = Number(opt('chunk', '960'));
const crf = Number(opt('crf', '16'));
const concurrency = opt('concurrency', '1');
const formats = args.filter((a) => !a.startsWith('--'));
const badFormat = formats.filter((f) => !film.formats.includes(f));
if (badFormat.length) throw new Error(`render-master: unknown format(s) ${badFormat.join(' ')} for film "${film.id}" (${film.formats.join(', ')})`);
const fmts = formats.length ? formats : film.formats;
const comps = fmts.map((f) => `${film.comp}${f}`);

const total = T.DURATION * T.SUB;
const env = { ...process.env, NTV_SKIP_SFX: '1', NTV_HEVC: '1' };
const npx = (a, opts = {}) => execFileSync('npx', ['remotion', ...a], { cwd: ROOT, env, stdio: 'inherit', ...opts });
const log = (m) => console.log(`[master ${new Date().toISOString().slice(11, 19)}] ${m}`);
const bundle = abs(film, 'bundle');
const rangesOf = () => {
  const ranges = [];
  for (let a = 0; a < total; a += chunk) ranges.push([a, Math.min(total, a + chunk) - 1]);
  return ranges;
};
const chunkName = ([a, b]) => `${String(a).padStart(5, '0')}-${String(b).padStart(5, '0')}`;
const outOf = (comp) =>
  path.join(ROOT, film.outDir, `${film.outName}-${comp.slice(film.comp.length)}-${scale === 2 ? '4k' : `x${scale}`}${T.RENDER_FPS}.mp4`);
/* the chunk plan (not for a frozen film): what a chunk folder's finished chunks were rendered from */
const PLAN_KEYS = ['total', 'chunk', 'scale', 'crf', 'concurrency'];
const params = { total, chunk, scale, crf, concurrency };
const CHUNK_FILE = /^\d{5}-\d{5}\.mp4(\.done)?$|\.part\.mp4$/;
const readPlan = (dir) => {
  try {
    return JSON.parse(readFileSync(path.join(dir, 'plan.json'), 'utf8'));
  } catch {
    return null;
  }
};
/** why the folder's chunks belong to another plan ('' = same plan); bundleSha only when the bundle is built */
const planDiff = (old, now) => {
  if (!old) return 'no plan.json';
  return [...PLAN_KEYS, ...('bundleSha' in now ? ['bundleSha'] : [])]
    .filter((k) => old[k] !== now[k])
    .map((k) => (k === 'bundleSha' ? 'the picture changed (bundle sha)' : `${k} ${old[k]} → ${now[k]}`))
    .join(', ');
};

if (dryRun) {
  // print the plan; nothing is built, deleted, rendered or written
  const rel = (p) => path.relative(ROOT, p);
  const ranges = rangesOf();
  console.log(`render-master --dry-run · film ${film.id} (${film.timing}) · ${total} frames at ${T.RENDER_FPS} fps (${T.DURATION} × ${T.SUB}) · scale ${scale} · chunk ${chunk} · crf ${crf} · concurrency ${concurrency}`);
  console.log(`sound         node --experimental-strip-types --no-warnings ${film.sfxDriver}   (not run)`);
  console.log(`bundle        npx remotion bundle ${film.entry} --out-dir ${rel(bundle)}   (not run; a real run deletes ${rel(bundle)} first)`);
  console.log(`comps         ${comps.join(' ')}`);
  if (!film.frozen) console.log('chunk plan    <chunk dir>/plan.json: a "done" chunk is kept only if the new bundle\'s sha matches it (checked after bundling)');
  for (const comp of comps) {
    const dir = path.join(ROOT, 'out', 'master', `${comp}-x${scale}`);
    console.log(`\n${comp} ×${scale} → ${rel(dir)}/`);
    const stale = film.frozen || !existsSync(dir) ? '' : planDiff(readPlan(dir), params);
    for (const r of ranges) {
      const file = path.join(dir, `${chunkName(r)}.mp4`);
      const done = existsSync(`${file}.done`) && existsSync(file);
      console.log(`  chunk ${chunkName(r)}   frames ${r[0]}–${r[1]} (${r[1] - r[0] + 1} f)   ${done ? (stale ? `stale (${stale}): re-rendered` : 'done') : 'to render'}`);
    }
    console.log(`  mux   ${rel(path.join(ROOT, 'public', T.MIX.file))} → ${rel(outOf(comp))}   (HEVC hvc1 copy + AAC 320k, ${T.DURATION / T.FPS} s)`);
  }
  process.exit(0);
}

// 1. the soundtrack, then ONE bundle every chunk renders from
execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings', abs(film, 'sfxDriver')], {
  cwd: ROOT,
  stdio: 'inherit',
});
rmSync(bundle, { recursive: true, force: true });
npx(['bundle', film.entry, '--out-dir', bundle]);
// what the picture is (a muted render reads no sound file, so index.html's sound entries are left out)
const plan = film.frozen ? null : { bundleSha: bundleDigest(bundle, { drop: isSoundStatic }), ...params };

for (const comp of comps) {
  const dir = path.join(ROOT, 'out', 'master', `${comp}-x${scale}`);
  mkdirSync(dir, { recursive: true });
  const ranges = rangesOf();
  if (plan) {
    // chunks from another picture or other settings are never reused: same names, different content
    const why = planDiff(readPlan(dir), plan);
    if (why) {
      const old = readdirSync(dir).filter((f) => CHUNK_FILE.test(f));
      for (const f of old) rmSync(path.join(dir, f));
      if (old.length) log(`${comp}: ${old.length} chunk file(s) from another plan deleted (${why})`);
      writeFileSync(path.join(dir, 'plan.json'), JSON.stringify(plan, null, 2) + '\n');
    }
  }

  // 2. picture, chunk by chunk; `.done` marks a chunk that finished encoding
  for (const [a, b] of ranges) {
    const name = chunkName([a, b]);
    const file = path.join(dir, `${name}.mp4`);
    if (existsSync(`${file}.done`) && existsSync(file)) continue;
    const t0 = Date.now();
    log(`${comp} ×${scale}: frames ${a}–${b} of ${total - 1}`);
    const tmp = path.join(dir, `${name}.part.mp4`);
    npx([
      'render', bundle, comp, tmp,
      `--frames=${a}-${b}`, `--scale=${scale}`, '--muted',
      '--codec=h265', `--crf=${crf}`, `--concurrency=${concurrency}`,
    ]);
    renameSync(tmp, file);
    writeFileSync(`${file}.done`, '');
    const s = (Date.now() - t0) / 1000;
    log(`${comp}: chunk ${name} in ${Math.round(s)} s (${(s / (b - a + 1)).toFixed(2)} s/frame)`);
  }

  // 3. join losslessly + the master mix
  const list = path.join(dir, 'concat.txt');
  const parts = readdirSync(dir).filter((f) => /^\d{5}-\d{5}\.mp4$/.test(f)).sort();
  if (parts.length !== ranges.length) throw new Error(`${comp}: ${parts.length}/${ranges.length} chunks`);
  writeFileSync(list, parts.map((f) => `file '${path.join(dir, f)}'`).join('\n') + '\n');
  const out = outOf(comp);
  mkdirSync(path.dirname(out), { recursive: true });
  const r = spawnSync('npx', [
    'remotion', 'ffmpeg', '-hide_banner', '-v', 'error', '-y',
    '-f', 'concat', '-safe', '0', '-i', list,
    '-i', path.join(ROOT, 'public', T.MIX.file),
    '-map', '0:v:0', '-map', '1:a:0',
    '-c:v', 'copy', '-tag:v', 'hvc1',
    '-c:a', 'aac', '-b:a', '320k', '-ar', '48000',
    '-t', String(T.DURATION / T.FPS),
    '-movflags', '+faststart', out,
  ], { cwd: ROOT, env, stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`${comp}: mux failed`);
  log(`${comp}: ${path.relative(ROOT, out)} (${(statSync(out).size / 2 ** 20).toFixed(0)} MB)`);
}
