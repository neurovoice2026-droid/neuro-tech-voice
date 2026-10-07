#!/usr/bin/env node
/**
 * Delivery gates for the reels (docs/ig/PIPELINE.md §9 gate 9), on BOTH delivered files of a reel:
 *   out/ig/deliver/<outName>-1080p120.mp4    (the client's master)  and  <outName>-1080p60-ig.mp4  (the upload copy)
 *
 *   node --experimental-strip-types --no-warnings scripts/ig/check-delivery.mjs --film=ig<n> | --all     (npm run check:delivery:ig)
 *
 *   · size < 28,000,000 B
 *   · H.264 High, yuv420p, 1080×1920; 120/1 fps at Level 5.1 (the master) · 60/1 at Level 4.2 (the upload copy)
 *   · BT.709 tags (matrix, primaries, transfer, tv range), avc1, moov before mdat (+faststart)
 *   · AAC LC, 48 kHz, stereo, 192 kb/s
 *   · duration = DURATION / 30 ± 1 frame (video stream)
 *   · the decoded AAC at −14 ± 0.5 LUFS integrated (scripts/audio/loudness.mjs, read-only) and ≤ −1.0 dBTP
 *     (scripts/audio/dsp.mjs truePeak, 4× oversampled)
 *   · NO EDIT LISTS (finish.mjs: the B-frame delay rides negative cts offsets, the AAC priming is fed in at the source):
 *     no `elst` box anywhere in the moov, and both streams start at 0
 *   · picture/sound lock: scripts/check-render.mjs --film=ig<n> on the file (frame count at the file's rate, BT.709, the
 *     decoded AAC against mix.wav at lag 0 in every loud window) — run as a child, read-only
 *
 * Read-only on the delivered files; decodes the audio to out/ig/qa/<reel>/delivery-<kind>.wav (deleted after).
 * Exit 1 on any failure.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, readWav, truePeak } from '../audio/dsp.mjs';
import { integrated } from '../audio/loudness.mjs';
import { FILMS } from '../registry.mjs';

/** the reels: every film of the merged registry named ig<n> (ig1–ig4 of ./films.mjs, ig5 of ../ig5/films.mjs) */
const IG_FILMS = Object.fromEntries(Object.entries(FILMS).filter(([id]) => /^ig\d+$/.test(id)));
const IG_IDS = Object.keys(IG_FILMS);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const ids = args.includes('--all') ? IG_IDS : [...new Set(args.filter((a) => a.startsWith('--film=')).map((a) => a.slice(7)))];
if (!ids.length) {
  console.error('usage: check-delivery.mjs --film=ig<n> | --all');
  process.exit(2);
}
for (const id of ids) if (!IG_IDS.includes(id)) throw new Error(`unknown reel "${id}" (known: ${IG_IDS.join(', ')})`);
const BIN = path.join(ROOT, 'node_modules/@remotion/compositor-linux-x64-gnu');
const ff = (tool, a) => execFileSync(path.join(BIN, tool), a, { env: { ...process.env, LD_LIBRARY_PATH: BIN }, cwd: ROOT, maxBuffer: 1 << 30 });

/** top-level MP4 boxes in file order, and whether moov/trak/edts/elst exists */
const boxes = (file) => {
  const fd = openSync(file, 'r');
  const size = statSync(file).size;
  const head = Buffer.alloc(16);
  const top = [];
  let moov = null;
  try {
    for (let o = 0; o + 8 <= size; ) {
      readSync(fd, head, 0, 16, o);
      let sz = head.readUInt32BE(0);
      const type = head.toString('latin1', 4, 8);
      if (sz === 1) sz = Number(head.readBigUInt64BE(8));
      else if (sz === 0) sz = size - o;
      top.push(type);
      if (type === 'moov') {
        moov = Buffer.alloc(sz);
        readSync(fd, moov, 0, sz, o);
      }
      if (sz < 8) break;
      o += sz;
    }
  } finally {
    closeSync(fd);
  }
  let elst = 0;
  if (moov) for (let i = moov.indexOf('elst'); i >= 0; i = moov.indexOf('elst', i + 4)) elst++;
  return { top, elst };
};

let failed = false;
for (const id of ids) {
  const film = { id, ...IG_FILMS[id] };
  const T = await import(path.join(ROOT, film.timing));
  const seconds = T.DURATION / T.FPS;
  const QA = path.join(ROOT, film.outDir, 'qa', id);
  mkdirSync(QA, { recursive: true });
  for (const kind of [{ tag: '120', fps: 120, level: 51 }, { tag: '60', fps: 60, level: 42 }]) {
    const file = path.join(ROOT, film.outDir, 'deliver', `${film.outName}-1080p${kind.tag}${kind.tag === '60' ? '-ig' : ''}.mp4`);
    const rel = path.relative(ROOT, file);
    const f = [];
    if (!existsSync(file)) {
      console.log(`✗ ${rel}: missing (npm run finish:ig -- --film=${id})`);
      failed = true;
      continue;
    }
    const size = statSync(file).size;
    if (size >= 28_000_000) f.push(`size ${size} B ≥ 28,000,000`);
    const p = JSON.parse(ff('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,codec_tag_string,profile,level,width,height,pix_fmt,r_frame_rate,color_range,color_space,color_transfer,color_primaries,sample_rate,channels,bit_rate,duration,nb_frames,start_time', '-of', 'json', file]).toString());
    const v = p.streams.find((s) => s.codec_type === 'video');
    const a = p.streams.find((s) => s.codec_type === 'audio');
    if (!v) f.push('no video stream');
    else {
      // this ffprobe build prints profiles as numbers: H.264 High = 100, AAC LC = 1 (FF_PROFILE_AAC_LOW)
      if (v.codec_name !== 'h264' || !['High', '100', 100].includes(v.profile)) f.push(`video ${v.codec_name} ${v.profile}, want h264 High`);
      if (v.pix_fmt !== 'yuv420p') f.push(`pix_fmt ${v.pix_fmt}`);
      if (v.width !== 1080 || v.height !== 1920) f.push(`${v.width}×${v.height}, want 1080×1920`);
      if (v.r_frame_rate !== `${kind.fps}/1`) f.push(`${v.r_frame_rate} fps, want ${kind.fps}/1`);
      if (Number(v.level) !== kind.level) f.push(`level ${v.level}, want ${kind.level}`);
      for (const [k, x] of Object.entries({ color_space: 'bt709', color_primaries: 'bt709', color_transfer: 'bt709', color_range: 'tv' })) if (v[k] !== x) f.push(`${k} = ${v[k]}, want ${x}`);
      if (v.codec_tag_string !== 'avc1') f.push(`tag ${v.codec_tag_string}, want avc1`);
      const dur = Number(v.duration);
      if (!(Math.abs(dur - seconds) <= 1 / kind.fps + 1e-6)) f.push(`video ${dur.toFixed(4)} s, want ${seconds.toFixed(4)} ± 1 frame`);
      if (Number(v.nb_frames) !== Math.round(seconds * kind.fps)) f.push(`${v.nb_frames} frames, want ${Math.round(seconds * kind.fps)}`);
    }
    if (!a) f.push('no audio stream');
    else {
      if (a.codec_name !== 'aac' || !['LC', '1', 1].includes(a.profile)) f.push(`audio ${a.codec_name} ${a.profile}, want aac LC`);
      if (Number(a.sample_rate) !== 48000) f.push(`audio ${a.sample_rate} Hz`);
      if (a.channels !== 2) f.push(`audio ${a.channels} channels`);
      if (Math.abs(Number(a.bit_rate) - 192000) > 192000 * 0.06) f.push(`audio ${Math.round(a.bit_rate / 1000)} kb/s, want 192`);
    }
    const bx = boxes(file);
    const im = bx.top.indexOf('moov');
    const id2 = bx.top.indexOf('mdat');
    if (im < 0 || id2 < 0 || im > id2) f.push(`moov ${im < 0 ? 'missing' : 'after mdat'} (top boxes: ${bx.top.join(' ')}) — +faststart`);
    if (bx.elst) f.push(`${bx.elst} edit list(s) (elst) — the delivery carries none (finish.mjs: -use_editlist 0, primed audio)`);
    for (const s of [v, a].filter(Boolean)) if (Math.abs(Number(s.start_time)) > 1e-6) f.push(`${s.codec_type} starts at ${s.start_time} s, want 0`);
    const cr = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', path.join(ROOT, 'scripts', 'check-render.mjs'), `--film=${id}`, file], { cwd: ROOT, encoding: 'utf8' });
    const crOut = `${cr.stdout ?? ''}${cr.stderr ?? ''}`.trim();
    const lock = (crOut.match(/sync lag 0 in \d+\/\d+ windows/) ?? [])[0] ?? '';
    if (cr.status !== 0) f.push(`check-render: ${crOut.split('\n').filter((l) => l.trim()).slice(-3).join(' | ')}`);
    let loud = '';
    if (a) {
      const wav = path.join(QA, `delivery-${kind.tag}.wav`);
      ff('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-i', file, '-map', '0:a:0', '-c:a', 'pcm_s24le', '-ar', '48000', wav]);
      const w = readWav(wav);
      rmSync(wav, { force: true });
      const st = [w.ch[0], w.ch[1] ?? w.ch[0]];
      const L = integrated(st, w.sr);
      const tp = db(truePeak(st));
      if (Math.abs(L - -14) > 0.5) f.push(`decoded AAC at ${L.toFixed(2)} LUFS (want −14 ± 0.5)`);
      if (tp > -1.0) f.push(`decoded AAC true peak ${tp.toFixed(2)} dBTP (> −1.0)`);
      loud = `${L.toFixed(2)} LUFS, ${tp.toFixed(2)} dBTP`;
    }
    const note = `${(size / 1e6).toFixed(2)} MB · ${v ? `${v.codec_name} ${String(v.profile) === '100' ? 'High' : v.profile} L${v.level} ${v.width}×${v.height} ${v.r_frame_rate}` : ''} · ${a ? `aac ${String(a.profile) === '1' ? 'LC' : a.profile} ${Math.round(a.bit_rate / 1000)}k` : ''} · ${loud} · elst ${bx.elst ? 'PRESENT' : 'none'} · ${lock || 'lock not proven'}`;
    if (f.length) {
      failed = true;
      console.log(`✗ ${rel}: ${note}\n  ${f.join('\n  ')}`);
    } else console.log(`✓ ${rel}: ${note}`);
  }
}
process.exit(failed ? 1 : 0);
