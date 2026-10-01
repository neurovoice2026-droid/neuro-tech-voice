/**
 * Ava's orb — the website's FluidOrb (components/site/product/fluid-orb.tsx),
 * made frame-deterministic: instead of a requestAnimationFrame clock, the
 * parent passes the flow time (see `flowTime`) and the volume for the
 * current frame. The shader source and the drawing live in ./orbGL.ts,
 * shared with <OrbGroup>.
 *
 * One WebGL2 context per instance — use it for the one big orb of a scene.
 * Several orbs at once: <OrbGroup> (one context for up to four). Small dots:
 * <MeshOrb> (CSS).
 *
 * Any palette works: a theme.ts light (LIGHTS.rush.orb …), or a blend from
 * src/lib/lights.ts (mixPalette, paletteAt, lightAt(…).orb, ALL_LIGHTS).
 * `paletteB` / `mixB` blend in OKLab (lights.ts mixPalette).
 */
import React, { useLayoutEffect, useRef, useState } from 'react';
import type { Palette } from '../theme';
import { FPS } from '../timing';
import { MeshOrb } from './MeshOrb';
import { OrbRenderer } from './orbGL';

/**
 * The site integrates `flowTime += dt * (0.55 + vol * 1.6)` every frame,
 * starting at 7.3. Deterministic version: integrate the volume curve from
 * frame 0 to `frame`.
 */
export function flowTime(frame: number, volumeAt: (f: number) => number): number {
  let t = 7.3;
  const dt = 1 / FPS;
  const whole = Math.floor(frame);
  for (let f = 0; f < whole; f++) t += dt * (0.55 + volumeAt(f) * 1.6);
  // the fractional rest (120 fps renders sample between timeline frames)
  const rest = frame - whole;
  if (rest > 0) t += rest * dt * (0.55 + volumeAt(frame) * 1.6);
  return t;
}

/**
 * Flow-time offset for orb `seed`: two orbs given the same time and volume
 * would otherwise swirl identically. Add it to `time` (OrbGroup's `seed`
 * does this for you).
 */
export const seedTime = (seed: number) => seed * 53.7;

export const Orb: React.FC<{
  size: number;
  palette: Palette;
  /** Optional second palette to ease towards (the site's 'listen' switch). Mixed in OKLab. */
  paletteB?: Palette;
  mixB?: number;
  volume: number;
  /** Flow time in seconds — use flowTime(frame, volumeAt). */
  time: number;
  /** A different swirl for the same time (see seedTime). */
  seed?: number;
  grain?: number;
  /** Supersampling for crisp edges on the big orb. */
  resolution?: number;
  style?: React.CSSProperties;
}> = ({ size, palette, paletteB, mixB = 0, volume, time, seed = 0, grain = 0.075, resolution = 1.5, style }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<OrbRenderer | null | undefined>(undefined);
  // The CSS stand-in shows only if WebGL2 is unavailable (the site removes it once the shader paints).
  const [failed, setFailed] = useState(false);
  const px = Math.max(2, Math.round(size * resolution));

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas || failed) return;
    if (renderer.current === undefined) renderer.current = OrbRenderer.create(canvas);
    const r = renderer.current;
    if (!r) {
      setFailed(true);
      return;
    }
    const k = px / size;
    r.render([{ x: size / 2, y: size / 2, d: size, palette, paletteB, mixB, volume, time: time + seedTime(seed), grain }], k, k, grain);
  }, [px, size, time, seed, volume, grain, palette, paletteB, mixB, failed]);

  return (
    <div style={{ position: 'relative', width: size, height: size, ...style }}>
      {failed ? (
        <MeshOrb size={size} palette={palette} time={time} style={{ position: 'absolute', inset: 0 }} />
      ) : (
        <canvas
          ref={ref}
          width={px}
          height={px}
          style={{ position: 'absolute', inset: 0, width: size, height: size, borderRadius: '50%' }}
        />
      )}
    </div>
  );
};
