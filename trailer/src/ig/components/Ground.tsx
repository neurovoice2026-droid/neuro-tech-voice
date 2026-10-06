/**
 * The reels' two grounds (SCRIPT.md §0.3 "Colour and ground", PIPELINE.md §8.1): the kit's MeshGround (imported
 * read-only) with the bit-budget probe's settings, so every act paints the same material.
 *
 *   <PearlGround t={f} />                                   MUTED_MESH, variant light (ig1, ig3; ig4 passes KB_MESH)
 *   <PearlGround t={f} paletteB={MOMENT_LIGHTS.sunday.orb} mix={u} keyLight={…} />
 *   <NightGround t={f} keyLight={{ x, y, strength, color }} />   INK_MESH, deep (ig2 only)
 *
 * What the wrapper fixes (the scene still chooses palette, pools, key light, drift):
 *   · grain = 0: IgFinish (components/Finish.tsx) is the only film grain, over the whole frame.
 *   · the in-canvas dither (MeshGround `dither`, ≈ ±1 LSB soft-light noise that keeps the long ramps from banding) at
 *     GROUND[tone].dither, and RE-SEEDED ONCE PER TIMELINE FRAME like IgFinish: MeshGround seeds it from
 *     useCurrentFrame(), so it is mounted inside a <Freeze> at the timeline-frame seed. Only that seed is frozen — the
 *     mesh itself moves on `t` (a prop), smooth at 120 fps.
 *   · the night's grade: deep INK_MESH dimmed (brightness / shade below) so its pools never blow out behind type.
 *
 * `t` is the absolute timeline time (fractional 30 fps frames). Children are rendered OVER the ground, outside the
 * freeze (they keep the real clock).
 */
import React from 'react';
import { AbsoluteFill, Freeze, useCurrentFrame } from 'remotion';
import { MeshGround, type MeshGroundProps } from '../../kb/kit';
import { INK_MESH, MUTED_MESH } from '../../kb/palettes';
import { seedFor, type Reseed } from './Finish';

export type GroundTone = 'pearl' | 'night';

/** SETTLED BY THE PROBE (scripts/ig/qa/probe-encode.mjs; numbers in Finish.tsx's header). */
export const GROUND = {
  pearl: { dither: 0.5, quality: 0.5 },
  night: { dither: 1, quality: 0.5, brightness: 0.45, shade: 0.15 },
} as const;

type GroundProps = Omit<MeshGroundProps, 'grain' | 'variant' | 'palette' | 'children'> & {
  palette?: MeshGroundProps['palette'];
  /** the probe's re-seed mode (default 'timeline') */
  reseed?: Reseed;
  children?: React.ReactNode;
};

const Painted: React.FC<GroundProps & { tone: GroundTone }> = ({ tone, reseed = 'timeline', children, style, ...p }) => {
  const frame = useCurrentFrame();
  const seed = seedFor(reseed, p.t, frame);
  const night = tone === 'night';
  // the tone's settings, then the scene's (an `undefined` prop never overrides a setting)
  const set = Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined)) as typeof p;
  const base = night
    ? { palette: INK_MESH, variant: 'deep' as const, dither: GROUND.night.dither, quality: GROUND.night.quality, brightness: GROUND.night.brightness, shade: GROUND.night.shade }
    : { palette: MUTED_MESH, variant: 'light' as const, dither: GROUND.pearl.dither, quality: GROUND.pearl.quality };
  return (
    <AbsoluteFill style={style}>
      <Freeze frame={seed}>
        <MeshGround {...base} {...set} grain={0} />
      </Freeze>
      {children}
    </AbsoluteFill>
  );
};

/** The pearl ground: MUTED_MESH (or the scene's palette), variant light. */
export const PearlGround: React.FC<GroundProps> = (p) => <Painted tone="pearl" {...p} />;

/** ig2's night ground: INK_MESH, deep, dimmed. */
export const NightGround: React.FC<GroundProps> = (p) => <Painted tone="night" {...p} />;
