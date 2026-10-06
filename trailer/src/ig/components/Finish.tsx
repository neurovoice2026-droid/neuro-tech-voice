/**
 * IgFinish — the reels' finishing pass (docs/ig/PIPELINE.md §8.1, SCRIPT.md §5): film 1's components/Grain (Grain,
 * Dither — the latter as IgDither, below) over the whole frame, as the films' FilmGrain does — overlay grain + the sparse screen dither on the night,
 * multiply grain on a pearl — with ONE change the ≤ 28 MB, 120 fps file forces: THE NOISE IS STATIC (one seed for the
 * whole reel), not re-seeded per render frame (the films) nor per timeline frame (the plan's first idea).
 *
 * THE BIT-BUDGET PROBE (build step 3; scripts/ig/qa/probe-encode.mjs on src/ig/qa/Probe.tsx's IG-Probe-* strips, 240
 * render frames through the real chain: Remotion frames → HEVC CRF 12 intermediate → x264 two-pass at the reel's own
 * budget, ig2 night 8.86 Mb/s, ig1 pearl 8.16 Mb/s). "Plateaus" = ground pixels in a run of one luma value ≥ 8 px
 * both ways (a band, or a block the encoder flattened); "grain kept" = the delivery's high-pass RMS ÷ the
 * intermediate's.
 *
 *   night (ig2 f0–60)                        plateaus ≥ 8 px   grain kept   PSNR-Y   SSIM-Y
 *   no grain, no dither                          58.6 %           —         57.7     .9986   ← rings: the banding
 *   films' strengths, re-seeded at 30 fps         6.0 %          .63        45.5     .9699   ← smeared into crawling
 *                                                                                            8–16 px blotches
 *   films' strengths, STATIC                      0.1 %          .98        49.5     .9893
 *   STATIC, frames at JPEG q100 (render-par)     0.05 %          .99        49.4     .9898
 *   STATIC at 75 % of the budget (6.4 Mb/s)      0.16 %          .98        47.8     .9851   ← headroom
 *   pearl (ig1 f255–315), STATIC, q100: ground dither .5 / paper .035: 20.1 % · dither 1 / .035: 15.0 % ·
 *   dither 1 / paper .05: 7.9 % (what is left sits at Y 190–230, 1-level steps that cannot be seen); grain kept 1.01.
 *
 * Fresh noise on any clock is the most expensive thing an encoder can see at ≈ .035 bits per pixel per frame: x264
 * keeps it in a few blocks and flattens the rest, so 30 fps grain arrives as blotches that crawl. A static seed costs
 * the intermediate's I-frames only — P/B-frames reference it — so it survives whole and the gradients stay unbanded.
 * At these strengths it reads as the print's tooth, not as dirt: nothing about it moves.
 *
 * `white` 0..1 is how much of the frame is a pearl ground (FilmGrain's split, crossfaded). The grounds' in-canvas
 * dither (kit MeshGround `dither`) is held on the same seed by components/Ground.tsx.
 */
import React from 'react';
import { AbsoluteFill, random, useCurrentFrame } from 'remotion';
import { Grain } from '../../components/Grain';
import { useTimelineFrame } from '../scene';

export type FinishSpec = {
  /** overlay grain on the night ground (films' FilmGrain: .1) */
  dark: number;
  /** multiply grain on a pearl ground (FilmGrain: .035) */
  paper: number;
  /** the sparse dark dither, screen-blended (FilmGrain: .05); nothing visible on paper */
  dither: number;
  /** feTurbulence baseFrequency of the grain (cycles / px; film 1's Grain default .92) */
  freq: number;
  /** feTurbulence baseFrequency of the dark dither (film 1's Dither: .95, fixed there) */
  ditherFreq: number;
};

/** SETTLED BY THE PROBE (see the header): the films' night strengths; paper .035 → .05 (with the pearl's canvas dither
 *  at 1) halves the pearl's plateaus; both noise frequencies .92 / .95 → .7, off the pixel grid's beat (see IgDither):
 *  the 20 px lattice peak (34× its ring's median in the night's deep corner) falls to 5.8×, every beat ≤ 3.3 px. */
export const FINISH: FinishSpec = { dark: 0.1, paper: 0.05, dither: 0.05, freq: 0.7, ditherFreq: 0.7 };

/**
 * The sparse dark dither — film 1's components/Grain `Dither` (ditherTile + component, copied: that file is frozen and
 * fixes baseFrequency at .95) with the frequency as a parameter. Chrome samples feTurbulence's lattice at 1 px; at
 * .95 cycles/px the lattice beats against the pixel grid every 1 / (1 − .95) = 20 px, a faint 20 px grid that the films
 * never showed (their noise moved every frame) but a STATIC seed freezes on screen (the probe's FFT: peaks at 19.7 px).
 */
const TILES = 16;
const ditherTile = (seed: number, size: number, slope: number, freq: number) =>
  `url("data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'><filter id='d' color-interpolation-filters='sRGB'><feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='1' seed='${seed}' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncR type='linear' slope='${slope}' intercept='${(-slope * 0.5).toFixed(3)}'/><feFuncG type='linear' slope='${slope}' intercept='${(-slope * 0.5).toFixed(3)}'/><feFuncB type='linear' slope='${slope}' intercept='${(-slope * 0.5).toFixed(3)}'/><feFuncA type='linear' slope='0' intercept='1'/></feComponentTransfer></filter><rect width='${size}' height='${size}' filter='url(#d)'/></svg>`,
  )}")`;
export const IgDither: React.FC<{ opacity: number; freq: number; slope?: number; frame: number }> = ({ opacity, freq, slope = 3.2, frame }) => {
  if (opacity <= 0.0005) return null;
  const size = 256;
  const s = Math.floor(random(`ds${frame}`) * TILES);
  const x = Math.floor(random(`dx${frame}`) * size);
  const y = Math.floor(random(`dy${frame}`) * size);
  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        backgroundImage: ditherTile(s, size, slope, freq),
        backgroundSize: `${size}px ${size}px`,
        backgroundPosition: `${x}px ${y}px`,
        mixBlendMode: 'screen',
        opacity,
      }}
    />
  );
};

/** The noise seed at timeline time t (fractional 30 fps frames): one per timeline frame, the same for its 4 render frames. */
export const finishSeed = (t: number) => Math.floor(t + 1e-6);

/** How the noise is re-seeded: the reels use 'static' (the probe compares the other two). */
export type Reseed = 'timeline' | 'render' | 'static';
/** The seed for a re-seed mode (render frame = Remotion's frame at 120 fps). */
export const seedFor = (mode: Reseed, t: number, renderFrame: number) => (mode === 'timeline' ? finishSeed(t) : mode === 'render' ? renderFrame : 0);

export const IgFinish: React.FC<{
  /** 0 = night ground … 1 = pearl ground */
  white: number;
  /** overrides of FINISH (the probe's variants) */
  spec?: Partial<FinishSpec>;
  /** the probe's re-seed mode (default 'static', the settled one) */
  reseed?: Reseed;
}> = ({ white, spec, reseed = 'static' }) => {
  const t = useTimelineFrame();
  const frame = useCurrentFrame();
  const s = { ...FINISH, ...spec };
  const w = Math.min(1, Math.max(0, white));
  const seed = seedFor(reseed, t, frame);
  return (
    <>
      <Grain opacity={s.dark * (1 - w)} blend="overlay" seed="ov" freq={s.freq} frame={seed} />
      <Grain opacity={s.paper * w} blend="multiply" seed="mu" freq={s.freq} frame={seed} />
      <IgDither opacity={s.dither * (1 - w)} freq={s.ditherFreq} frame={seed} />
    </>
  );
};
