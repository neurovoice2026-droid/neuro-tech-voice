#!/usr/bin/env node
/**
 * Parallel chunk renderer for film 2's 4K masters (node scripts/kb/render-par.mjs [--workers=3] [--chunk=240]).
 *
 * render-master renders its chunks one after another, each as its own `remotion render` (a fresh tab per
 * chunk, concurrency 1 inside it). This runs the SAME per-chunk command for several chunks at once — every
 * chunk is still one tab rendering its frames in order, so a chunk is byte-for-byte what render-master
 * would make; only the wall clock changes. It writes into render-master's chunk folders with its naming,
 * `.done` markers and plan.json (bundleSha + total/chunk/scale/crf/concurrency), so finishing is simply
 *   node scripts/render-master.mjs --film=kb --chunk=<same chunk>
 * which rebuilds the bundle, sees the same picture sha, skips every finished chunk, joins and muxes.
 *
 * It renders from the existing out/master/bundle-kb (built by render-master) and refuses to start unless
 * that bundle's digest is the one recorded in plan.json, or no plan exists yet (then it records it).
 * Resumable: a chunk with `.done` is never rendered again; a `.part.mp4` is overwritten.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleDigest, isSoundStatic } from '../bundle-digest.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).slice(k.length + 3);
const workers = Number(opt('workers', '3'));
const chunk = Number(opt('chunk', '240'));
const scale = 2;
const crf = 16;
const concurrency = '1';
const COMPS = ['KB-Trailer-16x9', 'KB-Trailer-9x16'];

const T = await import(path.join(ROOT, 'src/kb/timing.ts'));
const total = T.DURATION * T.SUB;
const bundle = path.join(ROOT, 'out/master/bundle-kb');
const env = { ...process.env, NTV_SKIP_SFX: '1', NTV_HEVC: '1' };
const log = (m) => console.log(`[par ${new Date().toISOString().slice(11, 19)}] ${m}`);
const CHUNK_FILE = /^\d{5}-\d{5}\.mp4(\.done)?$|\.part\.mp4$/;
const name = ([a, b]) => `${String(a).padStart(5, '0')}-${String(b).padStart(5, '0')}`;

if (!existsSync(path.join(bundle, 'index.html'))) throw new Error('no out/master/bundle-kb — run render-master --film=kb once to build it');
const plan = { bundleSha: bundleDigest(bundle, { drop: isSoundStatic }), total, chunk, scale, crf, concurrency };
log(`bundle sha ${plan.bundleSha.slice(0, 16)} · ${total} frames · chunk ${chunk} · ${workers} workers`);

const queue = [];
for (const comp of COMPS) {
  const dir = path.join(ROOT, 'out', 'master', `${comp}-x${scale}`);
  mkdirSync(dir, { recursive: true });
  let old = null;
  try {
    old = JSON.parse(readFileSync(path.join(dir, 'plan.json'), 'utf8'));
  } catch {}
  const same = old && Object.keys(plan).every((k) => old[k] === plan[k]);
  if (!same) {
    const stale = readdirSync(dir).filter((f) => CHUNK_FILE.test(f));
    for (const f of stale) rmSync(path.join(dir, f));
    if (stale.length) log(`${comp}: ${stale.length} chunk file(s) from another plan deleted`);
    writeFileSync(path.join(dir, 'plan.json'), JSON.stringify(plan, null, 2) + '\n');
  }
  for (let a = 0; a < total; a += chunk) {
    const r = [a, Math.min(total, a + chunk) - 1];
    const file = path.join(dir, `${name(r)}.mp4`);
    if (!(existsSync(`${file}.done`) && existsSync(file))) queue.push({ comp, dir, r, file });
  }
}
log(`${queue.length} chunk(s) to render`);

let failed = 0;
const runOne = (job) =>
  new Promise((resolve) => {
    const { comp, r, file } = job;
    const tmp = file.replace(/\.mp4$/, '.part.mp4');
    const t0 = Date.now();
    log(`${comp} ${name(r)} start`);
    const p = spawn('npx', ['remotion', 'render', bundle, comp, tmp, `--frames=${r[0]}-${r[1]}`, `--scale=${scale}`,
      '--muted', '--codec=h265', `--crf=${crf}`, `--concurrency=${concurrency}`, '--log=error'], { cwd: ROOT, env, stdio: ['ignore', 'ignore', 'inherit'] });
    p.on('exit', (code) => {
      if (code === 0 && existsSync(tmp)) {
        renameSync(tmp, file);
        writeFileSync(`${file}.done`, '');
        const s = (Date.now() - t0) / 1000;
        log(`${comp} ${name(r)} done in ${Math.round(s)} s (${(s / (r[1] - r[0] + 1)).toFixed(2)} s/frame)`);
      } else {
        failed++;
        log(`${comp} ${name(r)} FAILED (exit ${code})`);
      }
      resolve();
    });
  });

const worker = async () => {
  while (queue.length) await runOne(queue.shift());
};
await Promise.all(Array.from({ length: workers }, worker));
log(failed ? `finished with ${failed} failed chunk(s) — re-run to retry` : 'all chunks rendered');
process.exit(failed ? 1 : 0);
