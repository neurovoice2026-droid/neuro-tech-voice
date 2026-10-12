/**
 * REEL 6 · THE HAND AND THE HUB (docs/ig/ig6/STYLE.md §9.4–§9.5): the one raised part of the object, so the one that casts
 * the long paper shadow — (24, 48), blur 10, 7 % ink, scaled with the plane — from a NON-ROTATING wrapper (a filter on a
 * rotated element turns its light with it); the hand rotates inside.
 *
 *   <WorldHand>  the hand + hub on the camera's hand plane (k 1.12): pivot (97, 1183), 30° clockwise, 1095 long; your
 *                phone's recoil on each step; the hub's dome graphite (your phone) or teal (the agent), the pickup's
 *                radial wipe graphite → teal, the stamp (1 → 1.15 → 1), the collar's flash, the hub's ping; in the seam
 *                it extends out of the hub (a growing clip about the pivot) as the hub disc grows under the dome
 *   <HandShape>  the drawing itself (hand-local); M5′ draws handPath's HAND_FULL at FULL.hand
 *   handPts()    the outline's screen points (zone and overlap checks)
 */
import React from 'react';
import { INK, SHADOW } from './style';
import { DomeDefs } from './Dial';
import { matrix, project, type Plane, type Pt } from './geom';
import { COLLAR, HAND_FULL, HAND_WORLD, HUB_R, type HandDrawing } from './handPath';

export type DomeLook =
  | { kind: 'none' }
  | { kind: 'graphite' | 'teal'; scale?: number }
  /** the pickup's radial wipe: teal out of the centre over graphite (u 0 → 1) — or the seam's drain (teal shrinking) */
  | { kind: 'wipe'; u: number; scale?: number };

export type HandLook = {
  /** the hand's angle (deg clockwise from 12) */
  angle: number;
  dome: DomeLook;
  collar?: string;
  /** the hub disc's scale (the seam grows it 0 → 1) */
  hub?: number;
  /** the seam: the hand is revealed within this radius of the pivot (hand-local px); undefined = whole */
  reach?: number;
  /** the shadow's strength (0..1 of its 7 %) */
  shadow?: number;
  /** a ping out of the hub (hand-local radius, opacity; `w` its screen stroke, default 2 px) */
  ping?: { r: number; o: number; w?: number } | null;
};

/** the hand, the collar, the hub and its dome, drawn at a pivot in local px (the caller transforms) */
export const HandShape: React.FC<{ id: string; look: HandLook; pivot: Pt; screenScale: number; shape?: HandDrawing }> = ({ id, look, pivot, screenScale, shape = HAND_WORLD }) => {
  const dome = look.dome;
  const hub = look.hub ?? 1;
  const ds = dome.kind === 'none' ? 0 : (dome.scale ?? 1);
  const rD = HUB_R.dome * ds;
  const clip = look.reach !== undefined ? `${id}-reach` : undefined;
  return (
    <>
      {clip ? (
        <clipPath id={clip}>
          <circle cx={pivot.x} cy={pivot.y} r={Math.max(0, look.reach!)} />
        </clipPath>
      ) : null}
      <g clipPath={clip ? `url(#${clip})` : undefined}>
        <g transform={`translate(${pivot.x} ${pivot.y}) rotate(${look.angle.toFixed(4)})`}>
          <path d={shape.d} fill={INK.ink} fillRule="evenodd" />
          <rect x={COLLAR.x} y={COLLAR.y} width={COLLAR.w} height={COLLAR.h} fill={look.collar ?? INK.tealDeep} />
        </g>
      </g>
      {hub > 0.001 ? <circle cx={pivot.x} cy={pivot.y} r={HUB_R.disc * hub} fill={INK.ink} /> : null}
      {dome.kind === 'graphite' || dome.kind === 'teal' ? <circle cx={pivot.x} cy={pivot.y} r={rD} fill={`url(#${id}-${dome.kind})`} /> : null}
      {dome.kind === 'wipe' ? (
        <>
          <circle cx={pivot.x} cy={pivot.y} r={rD} fill={`url(#${id}-graphite)`} />
          <clipPath id={`${id}-wipe`}>
            <circle cx={pivot.x} cy={pivot.y} r={Math.max(0, rD * Math.min(1, dome.u))} />
          </clipPath>
          <circle cx={pivot.x} cy={pivot.y} r={rD} fill={`url(#${id}-teal)`} clipPath={`url(#${id}-wipe)`} />
        </>
      ) : null}
      {dome.kind !== 'none' && rD > 0 ? <circle cx={pivot.x} cy={pivot.y} r={Math.max(0, rD - 0.5)} fill="none" stroke={INK.tealRim} strokeOpacity={0.4} strokeWidth={1 / Math.max(0.2, screenScale)} /> : null}
      {look.ping ? <circle cx={pivot.x} cy={pivot.y} r={look.ping.r} fill="none" stroke={INK.ink} strokeWidth={(look.ping.w ?? 2) / Math.max(0.2, screenScale)} strokeOpacity={look.ping.o} /> : null}
    </>
  );
};

/** the long shadow's filter at a plane scale (its offset and blur scale with S) */
const shadowFilter = (S: number, k: number) => {
  const L = SHADOW.long;
  const a = 0.07 * k;
  return `drop-shadow(${(L.dx * S).toFixed(2)}px ${(L.dy * S).toFixed(2)}px ${(L.blur * S).toFixed(2)}px rgba(10,10,10,${a.toFixed(4)}))`;
};

/** the hand on a camera plane (screen-space SVG under one matrix), its shadow on the non-rotating wrapper */
export const WorldHand: React.FC<{ id: string; plane: Plane; pivot: Pt; look: HandLook }> = ({ id, plane, pivot, look }) => {
  const k = look.shadow ?? 1;
  // never translucent (crit-r2 B1): the hand enters and leaves by motion only
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, filter: k > 0.001 ? shadowFilter(plane.S, k) : undefined }}>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: 'absolute', left: 0, top: 0, overflow: 'hidden' }} shapeRendering="geometricPrecision" aria-hidden>
        <DomeDefs id={id} />
        <g transform={matrix(plane)}>
          <HandShape id={id} look={look} pivot={pivot} screenScale={plane.S} />
        </g>
      </svg>
    </div>
  );
};

/** the hand in M5′: drawn at the dial's centre, scaled, pointing at θ, inside the M5′ plane */
export const FullHand: React.FC<{ id: string; plane: Plane; centre: Pt; scale: number; look: HandLook }> = ({ id, plane, centre, scale, look }) => {
  const S = plane.S * scale;
  const k = look.shadow ?? 1;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, filter: k > 0.001 ? shadowFilter(S, k) : undefined }}>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: 'absolute', left: 0, top: 0, overflow: 'hidden' }} shapeRendering="geometricPrecision" aria-hidden>
        <DomeDefs id={id} />
        <g transform={`${matrix(plane)} translate(${centre.x} ${centre.y}) scale(${scale})`}>
          <HandShape id={id} look={look} pivot={{ x: 0, y: 0 }} screenScale={S} shape={HAND_FULL} />
        </g>
      </svg>
    </div>
  );
};

/** the hand's outline + hub as screen points (every ~4th outline sample; the hub as a ring of 12) */
export function handPts(plane: Plane, pivot: Pt, angle: number, scale = 1, reach?: number, shape: HandDrawing = HAND_WORLD): Pt[] {
  const c = Math.cos((angle * Math.PI) / 180);
  const s = Math.sin((angle * Math.PI) / 180);
  const out: Pt[] = [];
  shape.outline.forEach(([x, y], i) => {
    if (i % 2) return;
    if (reach !== undefined && Math.hypot(x, y) > reach) return;
    const wx = pivot.x + scale * (c * x - s * y);
    const wy = pivot.y + scale * (s * x + c * y);
    out.push(project(plane, wx, wy));
  });
  for (let i = 0; i < 12; i++) {
    const th = (i / 12) * Math.PI * 2;
    out.push(project(plane, pivot.x + scale * HUB_R.disc * Math.cos(th), pivot.y + scale * HUB_R.disc * Math.sin(th)));
  }
  return out;
}
