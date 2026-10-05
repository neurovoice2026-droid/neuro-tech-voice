#!/usr/bin/env node
/**
 * Film 2 finishing (node scripts/kb/finish-master.mjs [16x9|9x16 …] [--previews]): the rendered chunks →
 * the 4K 120 fps delivery masters → (with --previews) the 1080p60 share copies.
 *
 * 1. CHUNKS. The picture is the regular grid (out/master/KB-Trailer-<fmt>-x2/, scripts/kb/render-par.mjs) with
 *    any act-aligned replacements from out/master/KB-Trailer-<fmt>-x2-act/ (render-par --ranges … --dir=act) and,
 *    over those, re-renders after a picture fix from …-x2-act2/: a lower-layer chunk that overlaps a higher one is dropped. A grid chunk that starts mid-act opens a fresh tab, which
 *    re-rasters the glide layers that a continuous render would still be drawing from their mount — a 0.1–0.7 px
 *    jump of static text at the seam; act chunks start where every layer mounts, so their seams are clean. The
 *    script refuses gaps, overlaps, unfinished chunks, wrong packet counts or parameter sets that differ.
 * 2. MASTER. render-master's step 3 (concat copy, hvc1, AAC 320k 48 kHz, −t DURATION, +faststart) with the mix at
 *    DELIVERY_GAIN_DB: ffmpeg's AAC at 320k overshoots the mix's −1.65 dBTP transient at the impact to −0.99 dBTP;
 *    −0.25 dB lands the delivered audio at ≈ −1.14 dBTP / −15.77 LUFS (mix.wav itself stays the reference that
 *    check-render locks to — the gain does not move a single sample in time).
 * 3. SHARE COPIES (--previews). 1920×1080 / 1080×1920 H.264 High at 60 fps, < 30 MB: every second master frame
 *    (tinterlace=drop_even keeps frames 0, 2, 4 …; this ffmpeg build has no fps/select filters and a bare -r 60
 *    on the 120 fps master keeps 0, 1, 2, 3, 5, 7 …), lanczos 2:1, two-pass at the size budget, aq-mode 3 for the
 *    dark gradients, Level 4.2 with ref=4 (preset slow's ref=5 forces Level 5.0 at 1080p, which 4.2-only devices refuse), AAC 160k from the mix at the same delivery gain, BT.709 limited tags, avc1, +faststart.
 *
 * Uses Remotion's bundled ffmpeg/ffprobe directly (the npx wrapper mangles commas inside filter strings).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DELIVERY_GAIN_DB = -0.25;
const PREVIEW = { budget: 28.6e6, audioKbps: 160, videoKbps: 2110 };
const args = process.argv.slice(2);
const fmts = args.filter((a) => !a.startsWith('--'));
const FORMATS = fmts.length ? fmts : ['16x9', '9x16'];
const previews = args.includes('--previews');
/** re-render layers over the grid, highest priority first (out/master/<comp>-x2-<layer>/) */
const LAYERS = ['act2', 'act'];

const T = await import(path.join(ROOT, 'src/kb/timing.ts'));
const total = T.DURATION * T.SUB;
const seconds = T.DURATION / T.FPS;
const BIN = path.join(ROOT, 'node_modules/@remotion/compositor-linux-x64-gnu');
const env = { ...process.env, LD_LIBRARY_PATH: BIN };
const run = (tool, a, opts = {}) => execFileSync(path.join(BIN, tool), a, { env, cwd: ROOT, maxBuffer: 1 << 28, ...opts });
const log = (m) => console.log(`[finish ${new Date().toISOString().slice(11, 19)}] ${m}`);
const CHUNK = /^(\d{5})-(\d{5})\.mp4$/;
const mix = path.join(ROOT, 'public', T.MIX.file);

const chunksIn = (dir) =>
  existsSync(dir)
    ? readdirSync(dir)
        .map((f) => f.match(CHUNK))
        .filter(Boolean)
        .filter((m) => existsSync(path.join(dir, `${m[0]}.done`)))
        .map((m) => ({ file: path.join(dir, m[0]), a: Number(m[1]), b: Number(m[2]) }))
    : [];

for (const fmt of FORMATS) {
  const comp = `KB-Trailer-${fmt}`;
  // layers, highest priority first: later re-renders (act2: after a picture fix) over act-aligned seams over the grid;
  // a chunk overlapping anything already chosen is dropped whole, so a partial overlap shows up as a gap (refused below)
  const layers = [...LAYERS.map((l) => chunksIn(path.join(ROOT, 'out/master', `${comp}-x2-${l}`))), chunksIn(path.join(ROOT, 'out/master', `${comp}-x2`))];
  const chosen = [];
  for (const layer of layers) for (const c of layer) if (!chosen.some((x) => c.a <= x.b && x.a <= c.b)) chosen.push(c);
  const parts = chosen.sort((x, y) => x.a - y.a);
  const act = parts.filter((c) => !c.file.includes(`${comp}-x2/`));
  let next = 0;
  for (const c of parts) {
    if (c.a !== next) throw new Error(`${fmt}: chunks leave a gap or overlap at frame ${next} (next chunk starts at ${c.a})`);
    next = c.b + 1;
  }
  if (next !== total) throw new Error(`${fmt}: chunks end at ${next - 1}, the film is ${total} frames`);

  // every chunk: its frame count, and the same HEVC parameter sets (concat copy needs one stream description)
  let hvcc = null;
  for (const c of parts) {
    const p = JSON.parse(run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_packets', '-show_entries', 'stream=nb_read_packets,width,height,r_frame_rate,codec_name,profile,level', '-show_data', '-show_streams', '-of', 'json', c.file]).toString());
    const s = p.streams[0];
    if (Number(s.nb_read_packets) !== c.b - c.a + 1) throw new Error(`${fmt}: ${path.basename(c.file)} has ${s.nb_read_packets} frames, want ${c.b - c.a + 1}`);
    const key = JSON.stringify([s.codec_name, s.profile, s.level, s.width, s.height, s.r_frame_rate, s.extradata]);
    if (hvcc === null) hvcc = key;
    else if (key !== hvcc) throw new Error(`${fmt}: ${path.basename(c.file)} has different stream parameters than the first chunk`);
  }
  log(`${fmt}: ${parts.length} chunks (${act.length} from re-render layers ${LAYERS.join('/')}, ${parts.length - act.length} grid), frames 0–${total - 1}, one parameter set`);

  const list = path.join(ROOT, 'out/master', `${comp}-x2`, 'concat-final.txt');
  writeFileSync(list, parts.map((c) => `file '${c.file}'`).join('\n') + '\n');
  const out = path.join(ROOT, 'out/kb', `neurotechvoice-knowledge-${fmt}-4k${T.RENDER_FPS}.mp4`);
  const tmp = out.replace(/\.mp4$/, '.tmp.mp4');
  run('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-i', mix,
    '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-tag:v', 'hvc1',
    '-af', `volume=${DELIVERY_GAIN_DB}dB`, '-c:a', 'aac', '-b:a', '320k', '-ar', '48000',
    '-t', String(seconds), '-movflags', '+faststart', tmp], { stdio: 'inherit' });
  renameSync(tmp, out);
  log(`${fmt}: ${path.relative(ROOT, out)} (${(statSync(out).size / 2 ** 20).toFixed(1)} MiB)`);

  if (!previews) continue;
  const [w, h] = fmt === '16x9' ? [1920, 1080] : [1080, 1920];
  const share = path.join(ROOT, 'out/kb/deliver', `neurotechvoice-knowledge-${fmt}-1080p60-preview.mp4`);
  const passlog = path.join(ROOT, 'out/kb', `.x264-${fmt}`);
  const vf = `tinterlace=drop_even,scale=${w}:${h}:flags=lanczos+accurate_rnd+full_chroma_int`;
  const venc = ['-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-b:v', `${PREVIEW.videoKbps}k`,
    '-level:v', '4.2', '-x264-params', 'aq-mode=3:ref=4', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-passlogfile', passlog];
  run('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-i', out, '-map', '0:v:0', '-vf', vf, ...venc, '-pass', '1', '-an', '-f', 'mp4', '/dev/null'], { stdio: 'inherit' });
  const stmp = share.replace(/\.mp4$/, '.tmp.mp4');
  run('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-i', out, '-i', mix, '-map', '0:v:0', '-map', '1:a:0', '-vf', vf, ...venc, '-pass', '2',
    '-af', `volume=${DELIVERY_GAIN_DB}dB`, '-c:a', 'aac', '-b:a', `${PREVIEW.audioKbps}k`, '-ar', '48000',
    '-t', String(seconds), '-tag:v', 'avc1', '-movflags', '+faststart', stmp], { stdio: 'inherit' });
  renameSync(stmp, share);
  for (const f of readdirSync(path.join(ROOT, 'out/kb')).filter((f) => f.startsWith(`.x264-${fmt}`))) rmSync(path.join(ROOT, 'out/kb', f));
  const size = statSync(share).size;
  log(`${fmt}: ${path.relative(ROOT, share)} (${(size / 1e6).toFixed(2)} MB)${size >= 30e6 ? ' — OVER 30 MB' : ''}`);
  if (size >= 30e6) process.exitCode = 1;
}
