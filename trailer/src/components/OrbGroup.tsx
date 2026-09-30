/**
 * <OrbGroup> — up to four FluidOrbs in ONE WebGL2 context (a scene may hold
 * only one): the same shader as <Orb> (./orbGL.ts), each orb drawn at its
 * own sub-pixel offset inside one canvas and composited back to front with
 * premultiplied alpha, so orbs that overlap, touch or pass through each
 * other blend cleanly — no dark fringes, no seams.
 *
 *   <OrbGroup
 *     width={L.width} height={L.height}
 *     orbs={[
 *       { x: 480, y: 540, d: 300, palette: LIGHTS.rush.orb, volume: v, time: flow, seed: 0 },
 *       { x: 960, y: 540, d: 300, palette: LIGHTS.night.orb, volume: v, time: flow, seed: 3 },
 *     ]}
 *   />
 *
 * Coordinates are CSS pixels inside the group's own box (width × height),
 * which the caller positions (style). Array order is paint order: first is
 * furthest back. Driven only by props: deterministic. If WebGL2 is missing,
 * <MeshOrb>s stand in at the same places.
 *
 * Glow / rim / contact shadow are CSS (lights.ts bloom, rimGlow) on divs
 * BEHIND the group — never filters on the canvas itself.
 */
import React, { useLayoutEffect, useRef, useState } from 'react';
import type { Palette } from '../theme';
import { MeshOrb } from './MeshOrb';
import { seedTime } from './Orb';
import { OrbRenderer } from './orbGL';

export type GroupOrb = {
  /** Centre, CSS px inside the group box. */
  x: number;
  y: number;
  /** Diameter, CSS px. 0 skips the orb. */
  d: number;
  /** Any 5-colour palette (theme.ts LIGHTS[id].orb, lights.ts mixPalette / paletteAt / ALL_LIGHTS …). */
  palette: Palette;
  /** Second palette to ease towards (e.g. the light's `listen`), mixed in OKLab by `mixB`. */
  paletteB?: Palette;
  mixB?: number;
  /** 0..1 — speeds the flow and deepens the warp (drive it from the real voice envelope). */
  volume: number;
  /** Flow time in seconds (flowTime(frame, volumeAt)). */
  time: number;
  /** 0..1, premultiplied. */
  opacity?: number;
  /** Offsets the flow time so orbs sharing one clock swirl differently. Use 0, 1, 2, 3. */
  seed?: number;
  /** Film grain for this orb (default: the group's). */
  grain?: number;
  /**
   * Motion blur: how far (CSS px, [dx, dy], y down) the orb moves while the
   * shutter is open — velocity in px/frame × 0.5 for a 180° shutter
   * (motion.ts velocity()). Leave it out when the orb is slow (< 1 px).
   */
  blur?: readonly [number, number];
};

export const OrbGroup: React.FC<{
  width: number;
  height: number;
  orbs: readonly GroupOrb[];
  /** Supersampling of the canvas (1.5 = crisp edges on big orbs; 1 is lighter). */
  resolution?: number;
  /** Default film grain (the site's 0.075). */
  grain?: number;
  style?: React.CSSProperties;
}> = ({ width, height, orbs, resolution = 1.5, grain = 0.075, style }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<OrbRenderer | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const W = Math.max(2, Math.round(width * resolution));
  const H = Math.max(2, Math.round(height * resolution));

  // runs every render: the orbs array is new each frame anyway
  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas || failed) return;
    if (renderer.current === undefined) renderer.current = OrbRenderer.create(canvas);
    const r = renderer.current;
    if (!r) {
      setFailed(true);
      return;
    }
    r.render(
      orbs.slice(0, 4).map((o) => ({
        x: o.x,
        y: o.y,
        d: o.d,
        palette: o.palette,
        paletteB: o.paletteB,
        mixB: o.mixB,
        volume: o.volume,
        time: o.time + seedTime(o.seed ?? 0),
        grain: o.grain,
        opacity: o.opacity,
        smear: o.blur,
      })),
      W / width,
      H / height,
      grain,
    );
  });

  return (
    <div style={{ position: 'relative', width, height, pointerEvents: 'none', ...style }}>
      {failed ? (
        orbs.slice(0, 4).map((o, i) =>
          o.d > 0 ? (
            <MeshOrb
              key={i}
              size={o.d}
              palette={o.palette}
              time={o.time + seedTime(o.seed ?? 0)}
              style={{ position: 'absolute', left: o.x - o.d / 2, top: o.y - o.d / 2, opacity: o.opacity ?? 1 }}
            />
          ) : null,
        )
      ) : (
        <canvas ref={ref} width={W} height={H} style={{ position: 'absolute', inset: 0, width, height }} />
      )}
    </div>
  );
};
