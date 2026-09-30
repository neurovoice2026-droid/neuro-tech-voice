/**
 * <LightGround> — the room lit by one or more of the four lights: each
 * light's ground stacked, opacity only (as #demo crossfades its rooms: a
 * composite, never a repaint). The layer opacities are normalised so the
 * result is the exact weighted mix of the grounds (no dip to the backdrop
 * half-way through a change).
 *
 *   <LightGround weights={lightAt(t, keys).weights} />            // the site's rooms
 *   <LightGround weights={…} rooms="night" />                     // each light's dark room
 *   <LightGround weights={{ rush: 0, closing: 0, sunday: 1, night: 0 }} />
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { LIGHTS, LIGHT_ORDER, type LightId } from '../theme';
import { NIGHT_ROOMS } from '../lib/lights';

export const LightGround: React.FC<{
  weights: Partial<Record<LightId, number>>;
  /** 'site': the #demo grounds verbatim (three light rooms + the night). 'night': every light's dark room (lights.ts NIGHT_ROOMS). */
  rooms?: 'site' | 'night';
  style?: React.CSSProperties;
}> = ({ weights, rooms = 'site', style }) => {
  let acc = 0;
  const layers: React.ReactNode[] = [];
  for (const id of LIGHT_ORDER) {
    const w = Math.max(0, weights[id] ?? 0);
    if (w <= 0) continue;
    acc += w;
    layers.push(
      <AbsoluteFill
        key={id}
        style={{ background: rooms === 'site' ? LIGHTS[id].ground : NIGHT_ROOMS[id], opacity: w / acc }}
      />,
    );
  }
  return <AbsoluteFill style={{ pointerEvents: 'none', ...style }}>{layers}</AbsoluteFill>;
};
