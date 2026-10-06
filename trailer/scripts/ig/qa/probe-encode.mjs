#!/usr/bin/env node
/**
 * THE BIT-BUDGET PROBE (docs/ig/PIPELINE.md §8.1, build step 3): one 120 fps strip through the delivery chain, measured.
 *
 *   node --experimental-strip-types --no-warnings scripts/ig/qa/probe-encode.mjs --comp=IG-Probe-Night-9x16 \
 *        [--film=ig2] [--frames=0-239] [--kbps=N] [--props='{"reseed":"render"}'] [--label=name] [--image-format=png]
 *        [--jpeg-quality=100] [--bundle=out/ig/probe/bundle] [--rebundle] [--60] [--audio] [--sample=0,60,120,180,236] [--keep] [--reuse]
 *
 *   1. RENDER the strip exactly as render-par.mjs renders a chunk (scale 1, frames at JPEG q100, HEVC CRF 12
 *      intermediate, one tab, NTV_SKIP_SFX / NTV_HEVC) from a probe bundle (out/ig/probe/bundle; built here when missing
 *      or with --rebundle — rebundle after any src/ change).
 *   2. ENCODE it with finish.mjs's own settings (videoArgs, MUX: two-pass x264 at the reel's budget — `--film` picks the
 *      reel, IG-Probe-Night → ig2, IG-Probe-Pearl → ig1 — or `--kbps`), the 120 fps file and, with --60, the upload copy.
 *      The strip gets the reel's AVERAGE rate; in the full reel two-pass gives a hard passage more, an easy one less.
 *      --audio: mux the reel's mix (primed as finish.mjs does: no edit list) and prove the lock with check-render
 *      (--from=<first frame>, the strip's own rate).
 *   3. MEASURE on the sampled render frames, intermediate vs delivery (Y plane; U/V for the plateau test):
 *        · PSNR-Y, SSIM-Y (8×8 windows) of the delivery against the intermediate
 *        · PLATEAUS in the smooth ground (flat mask from a 9×9 box blur of the intermediate: no edge, no text): per pixel
 *          the narrower of its horizontal / vertical run of one code value (a band's width across the gradient).
 *          p8 / p16 = share of ground pixels in plateaus ≥ 8 / ≥ 16 px; max. Chroma at half resolution (×2 = luma px).
 *        · BLOCKING: mean |ΔY| across 8-px block edges ÷ inside blocks, in the ground (1 = none)
 *        · GRAIN kept: high-pass RMS of the ground, delivery ÷ intermediate
 *      → out/ig/probe/<label>/report.json + a one-line summary.
 *   4. CROPS for the eye: per sampled frame and region, 1:1 [intermediate | delivery] PNGs, and the same with the luma
 *      stretched over the crop's own range (bands that would be invisible at 1:1 become obvious): crops/<frame>-<region>*.png.
 *
 * Writes only out/ig/probe/. The intermediate and delivery files are deleted unless --keep.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { png } from '../../audio/dsp.mjs';
import { IG_FILMS } from '../films.mjs';
import { encodeTwoPass, ff, kbpsFor, primedMix, VIDEO } from '../finish.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const args = process.argv.slice(2);
const opt = (k, d) => {
  const a = args.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const comp = opt('comp', null);
if (!comp) throw new Error('--comp=<composition id> is required (IG-Probe-Night-9x16, IG-Probe-Pearl-9x16, IG<n>-Reel-9x16 …)');
const filmId = opt('film', /Night/.test(comp) ? 'ig2' : /Pearl/.test(comp) ? 'ig1' : (comp.match(/^IG(\d)-/) ?? [])[1] ? `ig${comp.match(/^IG(\d)-/)[1]}` : null);
if (!filmId || !IG_FILMS[filmId]) throw new Error(`--film=ig<n> needed for ${comp}`);
const T = await import(path.join(ROOT, IG_FILMS[filmId].timing));
const reelSeconds = T.DURATION / T.FPS;
const kbps = Number(opt('kbps', kbpsFor(reelSeconds)));
const [a, b] = opt('frames', '0-239').split('-').map(Number);
const frames = b - a + 1;
const props = opt('props', '{}');
const label = opt('label', `${comp.replace(/-9x16$/, '')}-${kbps}`);
const imageFormat = opt('image-format', null);
const jpegQuality = imageFormat === 'png' ? null : opt('jpeg-quality', '100');
const bundle = path.join(ROOT, opt('bundle', 'out/ig/probe/bundle'));
const OUT = path.join(ROOT, 'out', 'ig', 'probe', label);
const crf = Number(opt('crf', '12'));
const want60 = args.includes('--60');
const keep = args.includes('--keep');
const reuse = args.includes('--reuse');
const sample = opt('sample', '')
  ? opt('sample', '').split(',').map(Number)
  : [0, Math.round(frames * 0.25), Math.round(frames * 0.5), Math.round(frames * 0.75), frames - 4].map((f) => Math.min(frames - 1, f));
const log = (m) => console.log(`[probe ${label} ${new Date().toISOString().slice(11, 19)}] ${m}`);
mkdirSync(path.join(OUT, 'crops'), { recursive: true });

/* ── 1. render (render-par's chunk command) ── */
const env = { ...process.env, NTV_SKIP_SFX: '1', NTV_HEVC: '1' };
delete env.NTV_FILM;
if (!existsSync(path.join(bundle, 'index.html')) || args.includes('--rebundle')) {
  rmSync(bundle, { recursive: true, force: true });
  log(`bundling src/ig/index.ts → ${path.relative(ROOT, bundle)}`);
  const r = spawnSync('npx', ['remotion', 'bundle', 'src/ig/index.ts', '--out-dir', bundle, '--log=error'], { cwd: ROOT, env, stdio: 'inherit' });
  if (r.status !== 0) throw new Error('remotion bundle failed');
}
const inter = path.join(OUT, 'intermediate-hevc.mp4');
const t0 = Date.now();
let renderS = null;
if (!(reuse && existsSync(inter))) {
  log(`render ${comp} ${a}-${b} (${frames} frames, ${imageFormat === 'png' ? 'png' : `jpeg q${jpegQuality}`} frames, HEVC CRF ${crf}) props ${props}`);
  const r = spawnSync(
    'npx',
    ['remotion', 'render', bundle, comp, inter, `--frames=${a}-${b}`, '--scale=1', '--muted', '--codec=h265', `--crf=${crf}`, '--concurrency=1', '--log=error', `--props=${props}`, ...(imageFormat ? [`--image-format=${imageFormat}`] : []), ...(jpegQuality ? [`--jpeg-quality=${jpegQuality}`] : [])],
    { cwd: ROOT, env, stdio: ['ignore', 'ignore', 'inherit'] },
  );
  if (r.status !== 0) throw new Error('remotion render failed');
  renderS = (Date.now() - t0) / 1000;
  log(`rendered in ${renderS.toFixed(0)} s (${(renderS / frames).toFixed(2)} s/frame)`);
}

/* ── 2. encode (finish.mjs's settings) ── */
const seconds = frames / 120;
const outs = {};
const withAudio = args.includes('--audio');
if (withAudio && a !== 0) throw new Error('--audio: the strip must start at frame 0 (the primed mix starts at the reel\'s first sample)');
const aacIn = withAudio ? primedMix(path.join(ROOT, 'public', T.MIX.file), path.join(OUT, 'aac-in.wav')) : null;
for (const kind of want60 ? ['120', '60'] : ['120']) {
  const out = path.join(OUT, `delivery${VIDEO[kind].suffix}.mp4`);
  const t1 = Date.now();
  const { size } = encodeTwoPass({ input: inter, aacIn, out, kind, kbps, seconds, passlog: path.join(OUT, `x264-${kind}`), loop: false });
  outs[kind] = { file: out, size, mbps: (size * 8) / seconds / 1e6, encodeS: (Date.now() - t1) / 1000 };
  log(`${kind}: ${(size / 1e6).toFixed(3)} MB for ${seconds.toFixed(2)} s = ${outs[kind].mbps.toFixed(2)} Mb/s (target ${(kbps / 1000).toFixed(2)})`);
}

if (aacIn) {
  rmSync(aacIn, { force: true });
  for (const [kind, o] of Object.entries(outs)) {
    const cr = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', path.join(ROOT, 'scripts', 'check-render.mjs'), `--film=${filmId}`, o.file, '--from=0'], { cwd: ROOT, encoding: 'utf8' });
    o.lock = `${cr.status === 0 ? 'PASS' : 'FAIL'} ${(cr.stdout + cr.stderr).trim().split('\n').filter(Boolean).pop()}`;
    log(`${kind}: check-render ${o.lock}`);
  }
}

/* ── 3. measure ── */
const W = 1080;
const H = 1920;
const FRAME = (W * H * 3) / 2;
/** decoded yuv420p planes of render frame `n` of a 120 fps file (frame n of a 60 fps file is render frame 2n) */
const planes = (file, n) => {
  const buf = ff('ffmpeg', ['-hide_banner', '-v', 'error', '-i', file, '-vf', `trim=start_frame=${n}:end_frame=${n + 1}`, '-fps_mode', 'passthrough', '-f', 'image2pipe', '-c:v', 'rawvideo', '-pix_fmt', 'yuv420p', '-'], { maxBuffer: 1 << 26 });
  if (buf.length !== FRAME) throw new Error(`${path.basename(file)} frame ${n}: ${buf.length} bytes`);
  return { Y: buf.subarray(0, W * H), U: buf.subarray(W * H, W * H * 1.25), V: buf.subarray(W * H * 1.25) };
};
/** box blur (r) of a plane into Float32 */
const blur = (p, w, h, r) => {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    let s = 0;
    for (let x = -r; x <= r; x++) s += p[y * w + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = s / (2 * r + 1);
      s += p[y * w + Math.min(w - 1, x + r + 1)] - p[y * w + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let y = -r; y <= r; y++) s += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = s / (2 * r + 1);
      s += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
};
/** the smooth ground: the intermediate's 9×9 blur changes < .9 level/px and spans < 6 levels over ±6 px (no edges, no type) */
const flatMask = (Y, w, h) => {
  const bl = blur(Y, w, h, 4);
  const m = new Uint8Array(w * h);
  const R = 6;
  for (let y = R; y < h - R; y++)
    for (let x = R; x < w - R; x++) {
      const i = y * w + x;
      const gx = Math.abs(bl[i + 1] - bl[i - 1]) / 2;
      const gy = Math.abs(bl[i + w] - bl[i - w]) / 2;
      if (gx > 0.9 || gy > 0.9) continue;
      const span = Math.max(Math.abs(bl[i - R] - bl[i + R]), Math.abs(bl[i - R * w] - bl[i + R * w]), Math.abs(bl[i - R - R * w] - bl[i + R + R * w]));
      if (span < 6) m[i] = 1;
    }
  return m;
};
/** per pixel min(horizontal run, vertical run) of one code value; stats over the mask */
const plateaus = (p, w, h, mask) => {
  const hr = new Uint16Array(w * h);
  const vr = new Uint16Array(w * h);
  for (let y = 0; y < h; y++) {
    let s = 0;
    for (let x = 1; x <= w; x++)
      if (x === w || p[y * w + x] !== p[y * w + s]) {
        for (let k = s; k < x; k++) hr[y * w + k] = x - s;
        s = x;
      }
  }
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let y = 1; y <= h; y++)
      if (y === h || p[y * w + x] !== p[s * w + x]) {
        for (let k = s; k < y; k++) vr[k * w + x] = y - s;
        s = y;
      }
  }
  let n = 0;
  let n8 = 0;
  let n16 = 0;
  let max = 0;
  for (let i = 0; i < w * h; i++) {
    if (!mask[i]) continue;
    const r = Math.min(hr[i], vr[i]);
    n++;
    if (r >= 8) n8++;
    if (r >= 16) n16++;
    if (r > max) max = r;
  }
  return { n, p8: n ? n8 / n : 0, p16: n ? n16 / n : 0, max };
};
const halfMask = (mask) => {
  const m = new Uint8Array((W / 2) * (H / 2));
  for (let y = 0; y < H / 2; y++) for (let x = 0; x < W / 2; x++) m[y * (W / 2) + x] = mask[2 * y * W + 2 * x] & mask[(2 * y + 1) * W + 2 * x + 1];
  return m;
};
const psnr = (A, B) => {
  let s = 0;
  for (let i = 0; i < A.length; i++) s += (A[i] - B[i]) ** 2;
  return 10 * Math.log10((255 * 255) / Math.max(1e-9, s / A.length));
};
const ssim = (A, B, w, h) => {
  const C1 = (0.01 * 255) ** 2;
  const C2 = (0.03 * 255) ** 2;
  let acc = 0;
  let n = 0;
  for (let y = 0; y + 8 <= h; y += 4)
    for (let x = 0; x + 8 <= w; x += 4) {
      let ma = 0, mb = 0, va = 0, vb = 0, cv = 0;
      for (let j = 0; j < 8; j++)
        for (let i = 0; i < 8; i++) {
          const p = A[(y + j) * w + x + i];
          const q = B[(y + j) * w + x + i];
          ma += p; mb += q; va += p * p; vb += q * q; cv += p * q;
        }
      ma /= 64; mb /= 64; va = va / 64 - ma * ma; vb = vb / 64 - mb * mb; cv = cv / 64 - ma * mb;
      acc += ((2 * ma * mb + C1) * (2 * cv + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
      n++;
    }
  return acc / n;
};
const blocking = (Y, mask) => {
  let e = 0, ne = 0, inner = 0, ni = 0;
  for (let y = 0; y < H; y++)
    for (let x = 1; x < W; x++) {
      const i = y * W + x;
      if (!mask[i] || !mask[i - 1]) continue;
      const d = Math.abs(Y[i] - Y[i - 1]);
      if (x % 8 === 0) { e += d; ne++; } else { inner += d; ni++; }
    }
  return ni && ne ? e / ne / Math.max(1e-6, inner / ni) : 1;
};
const grainRms = (Y, mask) => {
  const bl = blur(Y, W, H, 1);
  let s = 0, n = 0;
  for (let i = 0; i < W * H; i++) if (mask[i]) { s += (Y[i] - bl[i]) ** 2; n++; }
  return n ? Math.sqrt(s / n) : 0;
};

/* the crop regions (frame px) for the eye */
const REGIONS = /Night/.test(comp)
  ? { halo: [340, 250, 400, 320], ground: [40, 860, 400, 400], deep: [640, 1440, 400, 440], label: [380, 1290, 320, 110] }
  : /Pearl/.test(comp)
    ? { ground: [40, 1480, 400, 400], pool: [600, 1400, 440, 360], grid: [140, 300, 400, 300], caption: [80, 1220, 640, 110] }
    : { top: [40, 260, 400, 400], mid: [340, 760, 400, 400], low: [640, 1300, 400, 400] };
const rgbOf = (pl, x0, y0, w, h, stretch) => {
  const out = Buffer.alloc(w * h * 3);
  let lo = 255, hi = 0;
  if (stretch) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = pl.Y[(y0 + y) * W + x0 + x]; lo = Math.min(lo, v); hi = Math.max(hi, v); }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const Yv = pl.Y[(y0 + y) * W + x0 + x];
      const o = (y * w + x) * 3;
      if (stretch) {
        const g = Math.round(((Yv - lo) / Math.max(1, hi - lo)) * 255);
        out[o] = out[o + 1] = out[o + 2] = g;
        continue;
      }
      const ci = ((y0 + y) >> 1) * (W / 2) + ((x0 + x) >> 1);
      const yy = 1.164 * (Yv - 16), u = pl.U[ci] - 128, v = pl.V[ci] - 128;
      out[o] = Math.max(0, Math.min(255, Math.round(yy + 1.793 * v)));
      out[o + 1] = Math.max(0, Math.min(255, Math.round(yy - 0.213 * u - 0.533 * v)));
      out[o + 2] = Math.max(0, Math.min(255, Math.round(yy + 2.112 * u)));
    }
  return { rgb: out, lo, hi };
};
const sideBySide = (l, r, w, h) => {
  const gap = 8;
  const W2 = 2 * w + gap;
  const out = Buffer.alloc(W2 * h * 3, 255);
  for (let y = 0; y < h; y++) {
    l.copy(out, y * W2 * 3, y * w * 3, (y + 1) * w * 3);
    r.copy(out, (y * W2 + w + gap) * 3, y * w * 3, (y + 1) * w * 3);
  }
  return png(W2, h, out);
};

const report = { comp, film: filmId, label, frames: [a, b], props: JSON.parse(props), kbps, renderS, imageFormat: imageFormat ?? 'jpeg', jpegQuality, outputs: {}, samples: [] };
for (const [k, o] of Object.entries(outs)) report.outputs[k] = { size: o.size, mbps: Number(o.mbps.toFixed(3)), encodeS: Number(o.encodeS.toFixed(1)), lock: o.lock };
const agg = { psnr: [], ssim: [], p8: [], p16: [], max: [], p8c: [], max_c: [], p8src: [], block: [], grain: [] };
for (const n of sample) {
  const src = planes(inter, n);
  const del = planes(outs['120'].file, n);
  const mask = flatMask(src.Y, W, H);
  const hm = halfMask(mask);
  const pl = plateaus(del.Y, W, H, mask);
  const plSrc = plateaus(src.Y, W, H, mask);
  const plU = plateaus(del.U, W / 2, H / 2, hm);
  const plV = plateaus(del.V, W / 2, H / 2, hm);
  const s = {
    frame: n,
    ground: Number((pl.n / (W * H)).toFixed(3)),
    psnrY: Number(psnr(src.Y, del.Y).toFixed(2)),
    ssimY: Number(ssim(src.Y, del.Y, W, H).toFixed(4)),
    plateauY: { p8: Number(pl.p8.toFixed(4)), p16: Number(pl.p16.toFixed(4)), max: pl.max },
    plateauYsrc: { p8: Number(plSrc.p8.toFixed(4)), p16: Number(plSrc.p16.toFixed(4)), max: plSrc.max },
    plateauUV: { p8: Number(Math.max(plU.p8, plV.p8).toFixed(4)), maxPx: 2 * Math.max(plU.max, plV.max) },
    blocking: Number(blocking(del.Y, mask).toFixed(3)),
    grainKept: Number((grainRms(del.Y, mask) / Math.max(1e-6, grainRms(src.Y, mask))).toFixed(3)),
    grainSrc: Number(grainRms(src.Y, mask).toFixed(3)),
  };
  report.samples.push(s);
  agg.psnr.push(s.psnrY); agg.ssim.push(s.ssimY); agg.p8.push(s.plateauY.p8); agg.p16.push(s.plateauY.p16); agg.max.push(s.plateauY.max);
  agg.p8c.push(s.plateauUV.p8); agg.max_c.push(s.plateauUV.maxPx); agg.p8src.push(s.plateauYsrc.p8); agg.block.push(s.blocking); agg.grain.push(s.grainKept);
  for (const [name, [x, y, w, h]] of Object.entries(REGIONS)) {
    const A = rgbOf(src, x, y, w, h, false), B = rgbOf(del, x, y, w, h, false);
    writeFileSync(path.join(OUT, 'crops', `${String(n).padStart(3, '0')}-${name}.png`), sideBySide(A.rgb, B.rgb, w, h));
    const As = rgbOf(src, x, y, w, h, true), Bs = rgbOf(del, x, y, w, h, true);
    writeFileSync(path.join(OUT, 'crops', `${String(n).padStart(3, '0')}-${name}-stretch.png`), sideBySide(As.rgb, Bs.rgb, w, h));
  }
}
const mean = (v) => v.reduce((s, x) => s + x, 0) / v.length;
report.summary = {
  mbps120: Number(outs['120'].mbps.toFixed(3)),
  mbps60: outs['60'] ? Number(outs['60'].mbps.toFixed(3)) : null,
  psnrY: Number(mean(agg.psnr).toFixed(2)),
  ssimY: Number(mean(agg.ssim).toFixed(4)),
  plateauY_p8: Number(mean(agg.p8).toFixed(4)),
  plateauY_p16: Number(mean(agg.p16).toFixed(4)),
  plateauY_max: Math.max(...agg.max),
  plateauY_p8_intermediate: Number(mean(agg.p8src).toFixed(4)),
  plateauUV_p8: Number(mean(agg.p8c).toFixed(4)),
  plateauUV_maxPx: Math.max(...agg.max_c),
  blocking: Number(mean(agg.block).toFixed(3)),
  grainKept: Number(mean(agg.grain).toFixed(3)),
};
writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2) + '\n');
const S = report.summary;
console.log(
  `PROBE ${label}: ${S.mbps120} Mb/s · PSNR-Y ${S.psnrY} dB · SSIM-Y ${S.ssimY} · plateaus ≥8 px ${(S.plateauY_p8 * 100).toFixed(2)} % (intermediate ${(S.plateauY_p8_intermediate * 100).toFixed(2)} %) ≥16 px ${(S.plateauY_p16 * 100).toFixed(2)} % max ${S.plateauY_max} px · chroma ≥8 ${(S.plateauUV_p8 * 100).toFixed(2)} % max ${S.plateauUV_maxPx} px · blocking ${S.blocking} · grain kept ${S.grainKept}${renderS ? ` · render ${(renderS / frames).toFixed(2)} s/f` : ''}`,
);
if (!keep) {
  for (const o of Object.values(outs)) rmSync(o.file, { force: true });
  if (!reuse) rmSync(inter, { force: true });
}
