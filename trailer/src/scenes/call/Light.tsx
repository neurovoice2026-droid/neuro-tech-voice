/**
 * THE MIDNIGHT — the room the call is picked up in: the twist's phone screen
 * (its NIGHT_ROOM) graded down to a near-black navy, the violet orb its key
 * light. The call holds it only across the pickup (the cut from the twist is
 * exact); as the room opens, the emerald gradient mesh (call/Mesh.tsx) lights
 * up out of the orb over it. The twist and the result read these exports
 * (MIDNIGHT_ROOM, MidnightVignette, KeyLight, AVA_GLOW), so they stay as
 * they were.
 *
 *   room       at the pickup it IS the phone's NIGHT_ROOM (the cut stays
 *              invisible) and grades down into the midnight (roomGrade)
 *   key light  a soft gaussian pool of the orb's own light on the room
 *              (lib/lights bloom, screen-blended)
 *   vignette   a strong falloff to black in screen space
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { bloom, fromOklch, GLOW, mixColor, type Glow } from '../../lib/lights';
import { C, LIGHTS } from '../../theme';

/** Ava's light (the night orb's glow): electric body, lilac core. */
export const AVA_GLOW: Glow = GLOW.night;
/** The caller's light: the night `listen` palette pushed a little further to caller blue. */
export const CALLER_GLOW: Glow = {
  body: mixColor(LIGHTS.night.listen[2], fromOklch(0.52, 0.2, 270), 0.6),
  core: mixColor(LIGHTS.night.listen[3], C.callerLit, 0.6),
};

/** The light at a listen mix (0 = Ava / violet, 1 = caller / blue). */
export const callGlow = (m: number): Glow =>
  m <= 0.001
    ? AVA_GLOW
    : m >= 0.999
      ? CALLER_GLOW
      : { body: mixColor(AVA_GLOW.body, CALLER_GLOW.body, m), core: mixColor(AVA_GLOW.core, CALLER_GLOW.core, m) };

/**
 * The midnight room: near-black with a soft, low-saturation navy lift at the
 * heart (the night ground's hue, a fraction of its chroma) — the orb and its
 * spill carry the colour. (The result opens on this exact room.)
 */
export const MIDNIGHT_ROOM =
  'radial-gradient(120% 100% at 50% 40%, #0c0e1f 0%, #090b18 28%, #060710 55%, #040409 80%, #020205 100%)';

/** The screen-space falloff over the midnight (to black, stronger than the cover's). */
export const MidnightVignette: React.FC<{ k: number }> = ({ k }) =>
  k <= 0.002 ? null : (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        background: `radial-gradient(96% 82% at 50% 44%, rgba(2,2,7,0) 26%, rgba(2,2,7,${(0.55 * k).toFixed(3)}) 66%, rgba(1,1,4,${(0.94 * k).toFixed(3)}) 100%)`,
      }}
    />
  );

/**
 * The room box (opening from the phone screen): the phone's NIGHT_ROOM at
 * `grade` 0, the midnight at 1 (a composite cross-fade, never a repaint).
 */
export const RoomBox: React.FC<{ x: number; y: number; w: number; h: number; grade: number }> = ({ x, y, w, h, grade }) => {
  const box: React.CSSProperties = { position: 'absolute', left: x - w / 2, top: y - h / 2, width: w, height: h };
  return (
    <>
      {grade < 0.999 ? <div style={{ ...box, background: LIGHTS.night.ground }} /> : null}
      {grade > 0.001 ? <div style={{ ...box, background: MIDNIGHT_ROOM, opacity: Math.min(1, grade) }} /> : null}
    </>
  );
};

/**
 * The orb's light on the room: a wide gaussian pool (≈ 3.4× the orb) with a
 * hotter core, centred on the orb, screen-blended so it ADDS light.
 */
export const KeyLight: React.FC<{ x: number; y: number; d: number; glow: Glow; strength: number; spread?: number }> = ({
  x,
  y,
  d,
  glow,
  strength,
  spread = 3.4,
}) => {
  if (strength <= 0.003) return null;
  const D = d * spread;
  return (
    <div
      style={{
        position: 'absolute',
        left: x - D / 2,
        top: y - D / 2,
        width: D,
        height: D,
        background: bloom(glow, strength, { core: 0.32, coreSize: 0.36 }),
        mixBlendMode: 'screen',
      }}
    />
  );
};
