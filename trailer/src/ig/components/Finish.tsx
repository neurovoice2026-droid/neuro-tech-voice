/**
 * IgFinish — the reels' finishing pass (docs/ig/PIPELINE.md §8.1, SCRIPT.md §5): film 1's components/Grain (Grain,
 * Dither) over the whole frame, as the films' FilmGrain does, with two changes for a ≤ 28 MB, 120 fps file:
 *
 *   · RE-SEEDED ONCE PER TIMELINE FRAME (30 fps), not per render frame. At 1080×1920×120 and ≈ 8–10 Mb/s the encoder
 *     has ≈ 0.035 bits per pixel per frame, and fresh noise on every frame is the most expensive thing it can see; a
 *     seed that holds for the four render frames of one timeline frame costs a quarter of the temporal entropy and still
 *     reads as a living texture (`finishSeed`).
 *   · THE STRENGTHS ARE THE BIT-BUDGET PROBE'S (FINISH below; scripts/ig/qa/probe-encode.mjs on the IG-Probe-* comps,
 *     rendered through the real chain: HEVC CRF 12 intermediate → x264 two-pass at the reel's own bitrate).
 *
 * `white` 0..1 is how much of the frame is a pearl (paper) ground: multiply grain on paper, overlay grain + the sparse
 * dark dither on the night (FilmGrain's split), crossfaded so a reel can move between the two.
 *
 * The grounds' own in-canvas dither (kit MeshGround `dither`) is re-seeded on the same clock by components/Ground.tsx.
 */
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { Dither, Grain } from '../../components/Grain';
import { useTimelineFrame } from '../scene';

export type FinishSpec = {
  /** overlay grain on the night ground (films' FilmGrain: .1) */
  dark: number;
  /** multiply grain on a pearl ground (FilmGrain: .035) */
  paper: number;
  /** film 1's sparse dark dither, screen-blended (FilmGrain: .05); nothing visible on paper */
  dither: number;
  /** feTurbulence baseFrequency of the grain (cycles / px; Grain's default .92 ≈ 1 px) */
  freq: number;
};

/** SETTLED BY THE PROBE (see the header). */
export const FINISH: FinishSpec = { dark: 0.1, paper: 0.035, dither: 0.05, freq: 0.92 };

/** The noise seed at timeline time t (fractional 30 fps frames): one per timeline frame, the same for its 4 render frames. */
export const finishSeed = (t: number) => Math.floor(t + 1e-6);

/** How the probe compositions re-seed the noise: the reels always use 'timeline'. */
export type Reseed = 'timeline' | 'render' | 'static';
/** The seed for a re-seed mode (render frame = Remotion's frame at 120 fps). */
export const seedFor = (mode: Reseed, t: number, renderFrame: number) => (mode === 'timeline' ? finishSeed(t) : mode === 'render' ? renderFrame : 0);

export const IgFinish: React.FC<{
  /** 0 = night ground … 1 = pearl ground */
  white: number;
  /** overrides of FINISH (the probe's variants) */
  spec?: Partial<FinishSpec>;
  /** the probe's re-seed mode (default 'timeline') */
  reseed?: Reseed;
}> = ({ white, spec, reseed = 'timeline' }) => {
  const t = useTimelineFrame();
  const frame = useCurrentFrame();
  const s = { ...FINISH, ...spec };
  const w = Math.min(1, Math.max(0, white));
  const seed = seedFor(reseed, t, frame);
  return (
    <>
      <Grain opacity={s.dark * (1 - w)} blend="overlay" seed="ov" freq={s.freq} frame={seed} />
      <Grain opacity={s.paper * w} blend="multiply" seed="mu" freq={s.freq} frame={seed} />
      <Dither opacity={s.dither * (1 - w)} frame={seed} />
    </>
  );
};
