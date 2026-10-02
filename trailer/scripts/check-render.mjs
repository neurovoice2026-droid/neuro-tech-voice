#!/usr/bin/env node
/**
 * Deliverable QA (npm run check:render -- <file.mp4> [more.mp4 …] [--from=<frame>]).
 * Proves a rendered MP4 against the timeline and the master mix before it ships:
 *
 *   · picture: H.264 (or HEVC tagged hvc1: the 4K 120 masters), yuv420p, BT.709 LIMITED range
 *     with all four colour properties tagged (matrix, primaries, transfer, range) — what
 *     platforms and players assume
 *   · length: the whole film at the file's rate — DURATION frames at FPS (previews) or
 *     DURATION × SUB at RENDER_FPS (masters); skipped with --from
 *   · picture/sound lock: the AAC track, decoded the way players decode it (edit list honoured),
 *     lines up with public/sfx/mix.wav TO THE SAMPLE (lag 0) in every loud window through the
 *     file. Untrimmed AAC priming reads as +2048 (libfdk) or +1024 (native) samples late.
 *
 * --from=<frame>: the file is a frame-range render starting at that frame, counted at the
 * file's own rate (`npx remotion render … --frames=<from>-<to>`).
 *
 *   node --experimental-strip-types --no-warnings scripts/check-render.mjs out/neurotechvoice-trailer-16x9.mp4
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readWav, SR } from './audio/dsp.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const T = await import(path.join(ROOT, 'src', 'timing.ts'));
const args = process.argv.slice(2);
const range = args.find((a) => a.startsWith('--from='));
const from = range ? Number(range.slice(7)) : 0;
const files = args.filter((a) => !a.startsWith('--'));
if (!files.length) {
  console.error('usage: check-render.mjs <file.mp4> [more.mp4 …] [--from=<frame>]');
  process.exit(2);
}

// Remotion's own FFmpeg build (the one that rendered the file); no soundtrack rebuild
const env = { ...process.env, NTV_SKIP_SFX: '1' };
const ff = (bin, a, opts = {}) =>
  execFileSync('npx', ['remotion', bin, '-hide_banner', '-v', 'error', ...a], { cwd: ROOT, env, maxBuffer: 1 << 30, ...opts });

/* ── the master, mono, from the render's first frame ── */
const w = readWav(path.join(ROOT, 'public', T.MIX.file));
const ref = new Float64Array(w.ch[0].length);
for (let i = 0; i < ref.length; i++) ref[i] = (w.ch[0][i] + (w.ch[1] ?? w.ch[0])[i]) / 2;

/* ── radix-2 FFT (in place) for the cross-correlation ── */
const fft = (re, im, inv) => {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const r = re[i];
      re[i] = re[j];
      re[j] = r;
      const m = im[i];
      im[i] = im[j];
      im[j] = m;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = ((inv ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(a);
    const wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const p = i + k;
        const q = p + len / 2;
        const tr = re[q] * cr - im[q] * ci;
        const ti = re[q] * ci + im[q] * cr;
        re[q] = re[p] - tr;
        im[q] = im[p] - ti;
        re[p] += tr;
        im[p] += ti;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
};
const WIN = 1 << 16; // 1.37 s windows
const MAXLAG = 4800; // ±100 ms
/** lag (samples) of `dec` against the master in the window starting at sample s; + = audio late */
const lagAt = (dec, s, off) => {
  const N = WIN * 2;
  const ar = new Float64Array(N), ai = new Float64Array(N), br = new Float64Array(N), bi = new Float64Array(N);
  for (let i = 0; i < WIN; i++) {
    ar[i] = dec[s + i] ?? 0;
    br[i] = ref[off + s + i] ?? 0;
  }
  fft(ar, ai, false);
  fft(br, bi, false);
  for (let i = 0; i < N; i++) {
    const r = ar[i] * br[i] + ai[i] * bi[i];
    const m = ai[i] * br[i] - ar[i] * bi[i];
    ar[i] = r;
    ai[i] = m;
  }
  fft(ar, ai, true);
  let best = 0;
  let bv = -Infinity;
  for (let l = -MAXLAG; l <= MAXLAG; l++) {
    const v = ar[(l + N) % N];
    if (v > bv) {
      bv = v;
      best = l;
    }
  }
  return best;
};

let failed = false;
for (const file of files) {
  const fails = [];
  const p = JSON.parse(
    ff('ffprobe', ['-show_entries', 'stream=codec_type,codec_name,codec_tag_string,width,height,pix_fmt,color_range,color_space,color_transfer,color_primaries,nb_frames,r_frame_rate,start_time,duration', '-of', 'json', path.resolve(file)]).toString(),
  );
  const v = p.streams.find((s) => s.codec_type === 'video');
  const a = p.streams.find((s) => s.codec_type === 'audio');
  if (!v) fails.push('no video stream');
  else {
    const want = { pix_fmt: 'yuv420p', color_range: 'tv', color_space: 'bt709', color_transfer: 'bt709', color_primaries: 'bt709' };
    for (const [k, x] of Object.entries(want)) if (v[k] !== x) fails.push(`video ${k} = ${v[k]}, want ${x}`);
    if (v.codec_name !== 'h264' && v.codec_name !== 'hevc') fails.push(`video codec ${v.codec_name}, want h264 or hevc`);
    if (v.codec_name === 'hevc' && v.codec_tag_string !== 'hvc1') fails.push(`HEVC tagged ${v.codec_tag_string}, want hvc1 (QuickTime / iOS)`);
    if (v.r_frame_rate !== `${T.FPS}/1` && v.r_frame_rate !== `${T.RENDER_FPS}/1`)
      fails.push(`video ${v.r_frame_rate} fps, want ${T.FPS} or ${T.RENDER_FPS}`);
  }
  const fps = v ? Number(v.r_frame_rate.split('/')[0]) / Number(v.r_frame_rate.split('/')[1] ?? 1) : T.FPS;
  const filmFrames = Math.round(T.DURATION * (fps / T.FPS));
  if (v && !range && Number(v.nb_frames) !== filmFrames) fails.push(`video has ${v.nb_frames} frames, the film is ${filmFrames} at ${fps} fps`);
  const off = Math.round((from / fps) * SR);
  const lags = [];
  if (!a) fails.push('no audio stream');
  else {
    // a piped WAV (this FFmpeg build has no raw muxers); its data chunk runs to the end
    const wav = ff('ffmpeg', ['-i', path.resolve(file), '-map', '0:a:0', '-ac', '1', '-ar', String(SR), '-c:a', 'pcm_s16le', '-f', 'wav', '-']);
    const d0 = wav.indexOf('data', 12, 'ascii') + 8;
    const dec = new Float64Array((wav.length - d0) >> 1);
    for (let i = 0; i < dec.length; i++) dec[i] = wav.readInt16LE(d0 + i * 2) / 32768;
    const frames = v ? Number(v.nb_frames) : 0;
    const need = Math.round((frames / fps) * SR);
    if (dec.length < need) fails.push(`audio is ${dec.length} samples, the picture needs ${need}`);
    // every loud window through the file (skip near-silence: no transient to lock on)
    for (let s = 0; s + WIN <= Math.min(dec.length, ref.length - off); s += WIN) {
      let e = 0;
      for (let i = 0; i < WIN; i++) e += ref[off + s + i] ** 2;
      if (10 * Math.log10(e / WIN + 1e-20) < -40) continue;
      lags.push([s, lagAt(dec, s, off)]);
    }
    if (!lags.length) fails.push('no loud window to measure the sync on');
    const bad = lags.filter(([, l]) => l !== 0);
    if (bad.length)
      fails.push(
        `audio not locked to the picture in ${bad.length}/${lags.length} windows: lag ${bad
          .slice(0, 6)
          .map(([s, l]) => `${l > 0 ? '+' : ''}${l} smp @ f${from + Math.round((s / SR) * fps)}`)
          .join(', ')}${bad.length > 6 ? ', …' : ''} (+ = sound late)`,
      );
  }
  const lagNote = `sync lag 0 in ${lags.filter(([, l]) => l === 0).length}/${lags.length} windows`;
  if (fails.length) {
    failed = true;
    console.log(`✗ ${file}\n  ${fails.join('\n  ')}`);
  } else
    console.log(
      `✓ ${file}: ${v.codec_name} ${v.pix_fmt} ${v.color_space}/${v.color_primaries}/${v.color_transfer}/${v.color_range}, ${v.width ? `${v.width}×${v.height}, ` : ''}${v.nb_frames} f @ ${fps}; ${lagNote}`,
    );
}
process.exit(failed ? 1 : 0);
