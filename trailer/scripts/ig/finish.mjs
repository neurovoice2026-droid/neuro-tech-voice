#!/usr/bin/env node
/**
 * A reel's delivery files (docs/ig/PIPELINE.md §8.3), from its muted HEVC picture master (render-par.mjs) and its mix:
 *
 *   node --experimental-strip-types --no-warnings scripts/ig/finish.mjs --film=ig<n> [--only=120|60|cover] [--dry-run]
 *                                                                                              (npm run finish:ig)
 *
 *   A. out/ig/deliver/<outName>-1080p120.mp4 — the client's spec: H.264 High, 1080×1920, 120 fps, Level 5.1 (979,200
 *      MB/s at 1080×1920×120; 4.2 tops out near 64 fps), two-pass at the size budget, BT.709 limited with all four tags,
 *      avc1, +faststart, AAC LC 192k 48 kHz stereo from public/ig/sfx/<reel>/mix.wav at DELIVERY_GAIN_DB (film 2's
 *      −0.25 dB: AAC overshoots at the impact), −t DURATION/30. Size loop: ≥ 28,000,000 B → −3 % video, again.
 *   B. out/ig/deliver/<outName>-1080p60-ig.mp4 — the file to post (Instagram plays ≤ 60 fps): render frames 0, 2, 4 …
 *      (tinterlace=drop_even: exact 2:1; this ffmpeg has no fps/select filters), Level 4.2, ref=4, keyint 120, same
 *      budget and audio.
 *   C. out/ig/deliver/<outName>-cover.png — `remotion still` of IG<n>-Cover-9x16 from out/master/bundle-ig, plus its
 *      3:4 grid crop (y 240–1680) for QA in out/ig/qa/<reel>/cover-34.png.
 *
 * Budget (decimal 28 MB, 3 % container margin, AAC 192 kb/s): video_kbps = floor(28e6 × 8 × 0.97 / seconds / 1000) − 192;
 * maxrate 1.5×, bufsize 2×. Uses Remotion's bundled ffmpeg directly with argument arrays (the npx wrapper mangles
 * commas; there is no system ffmpeg).
 *
 * NO EDIT LISTS (RESEARCH-reels §2.5: Instagram's publishing spec forbids them; the delivery checklist wants none). An
 * MP4 normally carries two: the video's (x264's B-frame reorder delay: first pts > first dts) and the audio's (the AAC
 * encoder's 1024-sample priming). Both are removed at the source instead of being hidden by an `elst`:
 *   · video: `-movflags negative_cts_offsets` (ctts v1) — the first frame is presented at 0, not 2 frames late;
 *   · audio: the encoder is fed the mix from sample AAC_PRIMING on (with a 2 ms raised-cosine fade-in, so the cut never
 *     clicks): its 1024 priming samples then fill the first 21.3 ms, and every later sample lands on its own frame —
 *     the decoded track matches mix.wav at lag 0 with nothing to trim (check-render proves the lock; check-delivery
 *     proves there is no `elst` and both streams start at 0). The cost is the mix's first 21.3 ms (the frame-0 ring's
 *     attack starts 21.3 ms late, under a 2 ms fade).
 *
 * The encoder settings are exported (VIDEO, videoArgs, MUX, kbpsFor, …) so the bit-budget probe
 * (scripts/ig/qa/probe-encode.mjs) encodes exactly as the delivery does.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readWav, writeWav } from '../audio/dsp.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
/** film 2's delivery gain (scripts/kb/finish-master.mjs DELIVERY_GAIN_DB), copied — that file is not imported */
export const DELIVERY_GAIN_DB = -0.25;
export const LIMIT = 28_000_000;
export const AUDIO_KBPS = 192;
/** FFmpeg's native AAC encoder delay at 48 kHz (its `initial_padding`): the samples before the input's first */
export const AAC_PRIMING = 1024;
/** the fade-in over the trimmed head (samples, 2 ms) */
const HEAD_FADE = 96;
export const kbpsFor = (seconds) => Math.floor((LIMIT * 8 * 0.97) / seconds / 1000) - AUDIO_KBPS;
export const BT709 = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];

/**
 * The two delivery encodes. `x264`: the plan's settings + what the bit-budget probe settled (see qa/probe-encode.mjs
 * and src/ig/components/Finish.tsx's header for the measurements).
 */
export const VIDEO = {
  120: { level: '5.1', vf: null, x264: 'aq-mode=3:keyint=240:min-keyint=24', fps: 120, suffix: '-1080p120' },
  60: { level: '4.2', vf: 'tinterlace=drop_even', x264: 'aq-mode=3:ref=4:keyint=120:min-keyint=12', fps: 60, suffix: '-1080p60-ig' },
};
/** libx264 two-pass rate control at `kbps` (maxrate 1.5×, bufsize 2×), High profile, the kind's level, BT.709 tags */
export const videoArgs = (kind, kbps) => [
  '-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-level:v', VIDEO[kind].level, '-pix_fmt', 'yuv420p',
  '-b:v', `${kbps}k`, '-maxrate', `${Math.round(kbps * 1.5)}k`, '-bufsize', `${kbps * 2}k`, '-x264-params', VIDEO[kind].x264, ...BT709,
];
/** the container: avc1, moov first, no edit lists (negative cts offsets carry the B-frame delay) */
export const MUX = ['-tag:v', 'avc1', '-use_editlist', '0', '-movflags', '+faststart+negative_cts_offsets'];
export const AUDIO = ['-af', `volume=${DELIVERY_GAIN_DB}dB`, '-c:a', 'aac', '-b:a', `${AUDIO_KBPS}k`, '-ar', '48000', '-ac', '2'];

const BIN = path.join(ROOT, 'node_modules/@remotion/compositor-linux-x64-gnu');
export const ff = (tool, a, o = {}) => execFileSync(path.join(BIN, tool), a, { env: { ...process.env, LD_LIBRARY_PATH: BIN }, cwd: ROOT, maxBuffer: 1 << 28, ...o });

/**
 * The AAC encoder's input: `mix` from sample AAC_PRIMING on, its head faded in over HEAD_FADE samples (raised cosine),
 * written to `out` (24-bit stereo). Decoded without an edit list, the AAC then lines up with `mix` at lag 0.
 */
export function primedMix(mix, out) {
  const w = readWav(mix);
  if (w.sr !== 48000) throw new Error(`${mix}: ${w.sr} Hz (the delivery is 48 kHz)`);
  const st = [w.ch[0], w.ch[1] ?? w.ch[0]].map((c) => {
    const a = Float32Array.from(c.subarray(AAC_PRIMING));
    for (let i = 0; i < HEAD_FADE && i < a.length; i++) a[i] *= 0.5 - 0.5 * Math.cos((Math.PI * (i + 0.5)) / HEAD_FADE);
    return a;
  });
  mkdirSync(path.dirname(out), { recursive: true });
  writeWav(out, st);
  return out;
}

/**
 * One two-pass encode of `input` (+ the primed audio `aacIn`, or muted when null) at `kbps`, with the size loop:
 * ≥ LIMIT → −3 % video, again (up to 6 times). Returns { size, kbps }.
 */
export function encodeTwoPass({ input, aacIn, out, kind, kbps: kbps0, seconds, passlog, log = () => {}, loop = true }) {
  let kbps = kbps0;
  const vf = VIDEO[kind].vf ? ['-vf', VIDEO[kind].vf] : [];
  for (let attempt = 1; attempt <= 6; attempt++) {
    const v = videoArgs(kind, kbps);
    log(`${kind}: two-pass at ${kbps} kb/s video${aacIn ? ` + ${AUDIO_KBPS} kb/s AAC` : ''} (attempt ${attempt})`);
    ff('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-i', input, '-map', '0:v:0', ...vf, ...v, '-pass', '1', '-passlogfile', passlog, '-an', '-f', 'mp4', '/dev/null'], { stdio: 'inherit' });
    const tmp = out.replace(/\.mp4$/, '.tmp.mp4');
    const a = aacIn ? ['-i', aacIn] : [];
    const maps = aacIn ? ['-map', '0:v:0', '-map', '1:a:0'] : ['-map', '0:v:0'];
    ff('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-i', input, ...a, ...maps, ...vf, ...v, '-pass', '2', '-passlogfile', passlog,
      ...(aacIn ? AUDIO : ['-an']), '-t', String(seconds), ...MUX, tmp], { stdio: 'inherit' });
    const dir = path.dirname(passlog);
    for (const f of readdirSync(dir).filter((f) => f.startsWith(path.basename(passlog)))) rmSync(path.join(dir, f));
    const size = statSync(tmp).size;
    if (size < LIMIT || !loop) {
      renameSync(tmp, out);
      log(`${kind}: ${path.relative(ROOT, out)} — ${(size / 1e6).toFixed(2)} MB`);
      return { size, kbps };
    }
    rmSync(tmp);
    log(`${kind}: ${(size / 1e6).toFixed(2)} MB ≥ 28 MB — re-encoding at −3 %`);
    kbps = Math.floor(kbps * 0.97);
  }
  throw new Error(`${kind}: still ≥ 28 MB after 6 attempts`);
}

async function main() {
  const { filmOf, need } = await import('../registry.mjs');
  const args = process.argv.slice(2);
  const film = filmOf(args, { required: true });
  if (!film.id.startsWith('ig')) throw new Error(`finish (IG): --film=${film.id} is not a reel (ig1…ig4)`);
  const only = args.find((a) => a.startsWith('--only='))?.slice(7);
  const dryRun = args.includes('--dry-run');
  const T = await import(need(film, 'timing'));
  const seconds = T.DURATION / T.FPS;
  const log = (m) => console.log(`[finish:ig ${new Date().toISOString().slice(11, 19)}] ${m}`);
  const master = path.join(ROOT, film.outDir, 'master', `${film.outName}-1080p${T.RENDER_FPS}-hevc.mp4`);
  const mix = path.join(ROOT, 'public', T.MIX.file);
  const DELIVER = path.join(ROOT, film.outDir, 'deliver');
  const QA = path.join(ROOT, film.outDir, 'qa', film.id);
  const TMP = path.join(ROOT, film.outDir, `.tmp-finish-${film.id}`);
  const KBPS0 = kbpsFor(seconds);
  const want = (k) => !only || only === k;

  if (dryRun) {
    console.log(`finish:ig --dry-run · ${film.id} · ${seconds.toFixed(2)} s · video ${KBPS0} kb/s (max ${Math.round(KBPS0 * 1.5)}, buf ${KBPS0 * 2}) + AAC ${AUDIO_KBPS}k`);
    console.log(`  master ${path.relative(ROOT, master)}${existsSync(master) ? '' : ' (missing: npm run render:ig -- --film=' + film.id + ')'}`);
    console.log(`  mix    ${path.relative(ROOT, mix)}${existsSync(mix) ? '' : ' (missing: npm run sfx:ig)'}`);
    for (const k of ['120', '60']) console.log(`  ${k}: x264 ${VIDEO[k].x264} · level ${VIDEO[k].level}${VIDEO[k].vf ? ` · -vf ${VIDEO[k].vf}` : ''}`);
    console.log(`  → ${path.relative(ROOT, DELIVER)}/${film.outName}-1080p120.mp4 · -1080p60-ig.mp4 · -cover.png (no edit lists: audio primed by ${AAC_PRIMING} samples)`);
    return;
  }
  if ((want('120') || want('60')) && !existsSync(master)) throw new Error(`no picture master ${path.relative(ROOT, master)} — run npm run render:ig -- --film=${film.id}`);
  if ((want('120') || want('60')) && !existsSync(mix)) throw new Error(`no mix ${path.relative(ROOT, mix)} — run npm run sfx:ig`);
  mkdirSync(DELIVER, { recursive: true });
  mkdirSync(QA, { recursive: true });

  if (want('120') || want('60')) {
    const aacIn = primedMix(mix, path.join(TMP, `${film.id}-aac-in.wav`));
    try {
      for (const kind of ['120', '60'])
        if (want(kind))
          encodeTwoPass({ input: master, aacIn, out: path.join(DELIVER, `${film.outName}${VIDEO[kind].suffix}.mp4`), kind, kbps: KBPS0, seconds, passlog: path.join(TMP, `x264-${film.id}-${kind}`), log });
    } finally {
      rmSync(TMP, { recursive: true, force: true });
    }
  }
  if (want('cover')) {
    const bundle = path.join(ROOT, film.bundle);
    if (!existsSync(path.join(bundle, 'index.html'))) throw new Error(`no ${film.bundle} — npm run render:ig -- --film=${film.id} builds it`);
    const cover = path.join(DELIVER, `${film.outName}-cover.png`);
    const r = spawnSync('npx', ['remotion', 'still', bundle, `IG${film.id.slice(2)}-Cover-9x16`, cover, '--frame=0', '--scale=1', '--image-format=png', '--log=error'], {
      cwd: ROOT,
      env: { ...process.env, NTV_SKIP_SFX: '1' },
      stdio: 'inherit',
    });
    if (r.status !== 0) throw new Error('remotion still (cover) failed');
    ff('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-i', cover, '-vf', 'crop=1080:1440:0:240', path.join(QA, 'cover-34.png')], { stdio: 'inherit' });
    log(`cover: ${path.relative(ROOT, cover)} + ${path.relative(ROOT, path.join(QA, 'cover-34.png'))}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
