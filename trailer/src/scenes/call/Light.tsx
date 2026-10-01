/**
 * THE CALL'S LIGHT — 3 a.m. is the NIGHT light (theme.ts LIGHTS.night), but
 * never as a violet slab: a deep, near-black midnight in which the ORB is the
 * key light. The colour lives in the orb and its light spill; the room itself
 * is a low-saturation navy-black (#0c0e1f at the heart → #020205 at the
 * edges; outside the spill it averages ≈ 9–11/255 luminance, grain included).
 *
 *   room       opened from the twist's phone screen: at the pickup it IS the
 *              phone's NIGHT_ROOM (the cut stays invisible) and grades down
 *              into the midnight while the camera pulls back out of the screen
 *   key light  a soft gaussian pool of the orb's own light on the room
 *              (lib/lights bloom, screen-blended), breathing with the voice;
 *              its colour follows the orb's palette: violet (night `orb`)
 *              while Ava speaks, cooler caller blue (night `listen`) while
 *              the caller speaks — on the orb's own 6–8 f palette ease
 *   vignette   a strong falloff to black in screen space
 *   floor      (9:16) the orb's key-light pool on a floor below it and a soft,
 *              faint reflection of it (flipped, blurred): light structure for
 *              the lower third of the vertical frame
 *
 * Everything else that glows in the scene (rim, halo, rings, bokeh, motes,
 * sparks) takes its colour from `callGlow(listen)` so one light leads.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { bloom, fromOklch, GLOW, hexToRgb, mixColor, rgba, type Glow } from '../../lib/lights';
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

/** '#rrggbb' → 'r,g,b' (for the components that take an rgb triple). */
export const triple = (hex: string) =>
  hexToRgb(hex)
    .map((c) => Math.round(c * 255))
    .join(',');

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

/**
 * (9:16) The floor under the orb — light structure for the lower third:
 *   pool        a wide, flat ellipse of its light on the floor round the point
 *               under it (`floorY`), screen-blended
 *   reflection  the orb mirrored about the floor line, seen at a grazing angle
 *               (compressed toward the line, squashed), blurred, ≈ 20 %, fading
 *               away from the line — a gradient of the orb's own light (never a
 *               second canvas), its highlight mirrored to the lower side
 * Everything follows the orb's on-screen state and breathes with its level.
 */
export const Floor: React.FC<{
  x: number;
  y: number;
  d: number;
  /** where the floor under the orb meets the frame (screen y): the pool's centre, the mirror line */
  floorY: number;
  glow: Glow;
  /** the key light's strength (the pool scales with it) */
  strength: number;
  /** 0..1+ the voice's level */
  level: number;
  /** the orb's depth-of-field blur (the reflection softens with it) */
  dof: number;
}> = ({ x, y, d, floorY, glow, strength, level, dof }) => {
  if (strength <= 0.003) return null;
  // the mirror image, compressed toward the line (the floor is seen at a grazing angle)
  const ry = floorY + (floorY - y) * 0.3;
  const rw = d * 0.96;
  const rh = d * 0.56;
  const refl = Math.min(0.36, 0.27 + 0.06 * level) * Math.min(1, strength / 0.16);
  const pw = d * 3.3;
  const ph = d * 0.52;
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: x - pw / 2,
          top: floorY + 30 - ph / 2,
          width: pw,
          height: ph,
          background: bloom(glow, 0.95 * strength, { core: 0.25, coreSize: 0.4 }),
          mixBlendMode: 'screen',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: x - rw / 2,
          top: ry - rh / 2,
          width: rw,
          height: rh,
          borderRadius: '50%',
          background: `radial-gradient(closest-side at 46% 64%, ${rgba(glow.core, 1)} 0%, ${rgba(glow.core, 0.8)} 24%, ${rgba(glow.body, 0.85)} 52%, ${rgba(LIGHTS.night.orb[1], 0.7)} 80%, ${rgba(LIGHTS.night.orb[0], 0)} 100%)`,
          opacity: refl,
          filter: `blur(${(11 + dof * 2).toFixed(1)}px)`,
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.75) 45%, rgba(0,0,0,0.15) 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.75) 45%, rgba(0,0,0,0.15) 100%)',
          mixBlendMode: 'screen',
        }}
      />
    </>
  );
};
