/**
 * b16 · THE CLOSING KEY, painted (stage.ts closingAt): the room's light pulled in from the frame's far edges onto her
 * teal dot. Every element takes the SAME light, pixel by pixel, in its own coordinates — so a card and the ground
 * around it darken together (a silhouette going out at constant contrast, never a grey slab), and type goes by its
 * opacity where the light has gone (never a grey word):
 *
 *   rampCss(...)      a radial smoothstep as CSS stops (alpha a0 → a1 between r0 and r1, clamped at the centre)
 *   localClosing(...) the closing key in an element's own px (its screen origin, its local → screen scale)
 *   <NightShade>      the night over an element (alpha 0 inside `ri` → 1 beyond `ro`): inset 0, inherits its radius
 *   fadeMask(...)     an opacity mask: opaque inside `ri`, gone by `mid` (type is gone before its paper is half dark)
 *
 * All of it is a gradient — no filter, no blur.
 */
import React from 'react';
import type { Closing } from './stage';

/** the night the room closes onto: b16's last ground where her key does not reach (measured ≈ rgb 2 0 6) */
export const NIGHT_RGB = '3, 1, 8';

const smooth = (u: number) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * (3 - 2 * x);
};

/** A radial smoothstep as CSS: alpha `a0` at r ≤ r0 → `a1` at r ≥ r1 (px), in `rgb`, centred at (cx, cy). */
export function rampCss(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number, rgb: string, n = 12): string {
  const at = (r: number) => a0 + (a1 - a0) * smooth((r - r0) / Math.max(1e-3, r1 - r0));
  const stops: string[] = [];
  // a stop can't sit inside the centre: start at r = 0 with the ramp's own value there
  if (r0 < 0) stops.push(`rgba(${rgb},${at(0).toFixed(4)}) 0px`);
  for (let i = 0; i <= n; i++) {
    const r = r0 + ((r1 - r0) * i) / n;
    if (r < 0) continue;
    stops.push(`rgba(${rgb},${at(r).toFixed(4)}) ${r.toFixed(2)}px`);
  }
  if (stops.length === 1) stops.push(`rgba(${rgb},${a1.toFixed(4)}) ${Math.max(1, r1).toFixed(2)}px`);
  return `radial-gradient(circle at ${cx.toFixed(2)}px ${cy.toFixed(2)}px, ${stops.join(', ')})`;
}

export type LocalClosing = { x: number; y: number; ri: number; ro: number; mid: number; a: number };

/** The closing key in an element's own px: `o` its local origin on screen, `z` its local → screen scale. */
export const localClosing = (cl: Closing, o: { x: number; y: number }, z: number): LocalClosing => ({
  x: (cl.x - o.x) / z,
  y: (cl.y - o.y) / z,
  ri: cl.ri / z,
  ro: cl.ro / z,
  mid: cl.mid / z,
  a: cl.a,
});

/** The night over an element, pixel by pixel with the room's light, to the night ground's own colour (put it last
 *  inside the element): a card in the dark is the dark, never a navy slab on it. */
export const NightShade: React.FC<{ lc: LocalClosing | null; flat?: number }> = ({ lc, flat = 0 }) => (
  <>
    {flat > 0.001 ? <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', background: `rgba(${NIGHT_RGB}, ${flat.toFixed(4)})` }} /> : null}
    {lc ? <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', background: rampCss(lc.x, lc.y, lc.ri, lc.ro, 1 - lc.a, 1, NIGHT_RGB) }} /> : null}
  </>
);

/** An opacity mask (CSS mask-image) for type: opaque inside `ri`, gone by `mid` — or the inverse (`invert`). */
export function fadeMask(lc: LocalClosing | null, invert = false, r0?: number, r1?: number): React.CSSProperties {
  if (!lc) return invert ? { opacity: 0 } : {};
  const a = r0 ?? lc.ri;
  const b = r1 ?? lc.mid;
  const img = rampCss(lc.x, lc.y, a, b, invert ? 0 : 1, invert ? 1 : 0, '0,0,0');
  return { maskImage: img, WebkitMaskImage: img, maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat' } as React.CSSProperties;
}
