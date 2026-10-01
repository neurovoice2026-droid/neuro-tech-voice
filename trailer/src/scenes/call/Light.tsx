/**
 * THE CALL'S LIGHT — 3 a.m. is the NIGHT light (theme.ts LIGHTS.night), but
 * not as a flat violet slab: a deep, cinematic midnight in which the ORB is
 * the key light.
 *
 *   room       the night ground taken much darker and cooler towards the
 *              edges (indigo at the heart → navy → near-black), opened from
 *              the twist's phone screen: at the pickup it IS the phone's
 *              NIGHT_ROOM (the cut stays invisible) and grades down into the
 *              midnight while the camera pulls back out of the screen
 *   key light  a soft gaussian pool of the orb's own light on the room
 *              (lib/lights bloom, screen-blended), breathing with the voice;
 *              its colour follows the orb's palette: violet (night `orb`)
 *              while Ava speaks, cooler caller blue (night `listen`) while
 *              the caller speaks — on the orb's own 6–8 f palette ease
 *   vignette   a strong navy falloff in screen space
 *
 * Everything else that glows in the scene (rim, halo, rings, bokeh, motes,
 * sparks) takes its colour from `callGlow(listen)` so one light leads.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { bloom, fromOklch, GLOW, hexToRgb, mixColor, type Glow } from '../../lib/lights';
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
 * The midnight room: the night ground (#34288f → #08061c) taken ~45 % darker,
 * the hue cooling from indigo (282°) at the heart to navy (262°) at the edges.
 */
export const MIDNIGHT_ROOM =
  'radial-gradient(120% 100% at 50% 40%, #161140 0%, #0d0b2e 28%, #070822 55%, #03051a 80%, #01020c 100%)';

/** The screen-space falloff over the midnight (navy, stronger than the cover's). */
export const MidnightVignette: React.FC<{ k: number }> = ({ k }) =>
  k <= 0.002 ? null : (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        background: `radial-gradient(96% 82% at 50% 44%, rgba(2,3,14,0) 26%, rgba(2,3,14,${(0.55 * k).toFixed(3)}) 66%, rgba(1,2,10,${(0.94 * k).toFixed(3)}) 100%)`,
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
