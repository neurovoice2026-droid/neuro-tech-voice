#!/usr/bin/env node
/**
 * Master render (npm run render:master -- [16x9|9x16 …] [--scale=2] [--chunk=960] [--crf=16]).
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
 * Why HEVC: H.264 at 3840×2160 × 120 fps needs level 6.x, which most hardware
 * decoders refuse; HEVC Main level 5.2 covers 4K120 (it is what phones record).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const T = await import(path.join(ROOT, 'src', 'timing.ts'));

const args = process.argv.slice(2);
const opt = (k, d) => {
  const a = args.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const scale = Number(opt('scale', '2'));
const chunk = Number(opt('chunk', '960'));
const crf = Number(opt('crf', '16'));
const formats = args.filter((a) => !a.startsWith('--'));
const comps = (formats.length ? formats : ['16x9', '9x16']).map((f) => `Trailer-${f}`);

const total = T.DURATION * T.SUB;
const env = { ...process.env, NTV_SKIP_SFX: '1' };
const npx = (a, opts = {}) => execFileSync('npx', ['remotion', ...a], { cwd: ROOT, env, stdio: 'inherit', ...opts });
const log = (m) => console.log(`[master ${new Date().toISOString().slice(11, 19)}] ${m}`);

// 1. the soundtrack, then ONE bundle every chunk renders from
execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings', path.join(ROOT, 'scripts', 'generate-sfx.mjs')], {
  cwd: ROOT,
  stdio: 'inherit',
});
const bundle = path.join(ROOT, 'out', 'master', 'bundle');
rmSync(bundle, { recursive: true, force: true });
npx(['bundle', 'src/index.ts', '--out-dir', bundle]);

for (const comp of comps) {
  const dir = path.join(ROOT, 'out', 'master', `${comp}-x${scale}`);
  mkdirSync(dir, { recursive: true });
  const ranges = [];
  for (let a = 0; a < total; a += chunk) ranges.push([a, Math.min(total, a + chunk) - 1]);

  // 2. picture, chunk by chunk; `.done` marks a chunk that finished encoding
  for (const [a, b] of ranges) {
    const name = `${String(a).padStart(5, '0')}-${String(b).padStart(5, '0')}`;
    const file = path.join(dir, `${name}.mp4`);
    if (existsSync(`${file}.done`) && existsSync(file)) continue;
    const t0 = Date.now();
    log(`${comp} ×${scale}: frames ${a}–${b} of ${total - 1}`);
    const tmp = path.join(dir, `${name}.part.mp4`);
    npx([
      'render', bundle, comp, tmp,
      `--frames=${a}-${b}`, `--scale=${scale}`, '--muted',
      '--codec=h265', `--crf=${crf}`,
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
  const out = path.join(ROOT, 'out', `neurotechvoice-trailer-${comp.slice(8)}-${scale === 2 ? '4k' : `x${scale}`}${T.RENDER_FPS}.mp4`);
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
