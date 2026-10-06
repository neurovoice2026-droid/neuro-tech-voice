/**
 * REEL 1 · THE STAGE's clocks (docs/ig/SCRIPT.md ig1 §4): the camera plane every act shares (the hook's type, the desk,
 * the week grid — zoomed about the grid's centre), the grid's recede / return, her orb's one path through the reel, the
 * ground's light. Pure functions of the ABSOLUTE timeline frame `t` (fractional at 120 fps), so every act — each in its
 * own <Sequence> — draws exactly the frame the act before it left.
 *
 *   zoom   1.00 at frame 0 (and in the seam's re-formed frame 0) → 1.02, the hook's slow push → held while the week fills
 *          → .94 on "a hundred and sixty-eight" (EASE.inOut, .8 s: the whole week in view) → .86 as the outcome cards land
 *          (b4, the grid receding) → 1.0 for the desk beat (b5) → the end card's step back (× .92, End.tsx)
 *   orb    her full stop on "ours" → parked in the label band as the week unfolds → on "agent's" she glides into the
 *          grid's top-right corner and grows → at rest on "only people can do" → the end card's park → the seam
 */
import { EASE, mix, mixHex, tween } from '../../lib/motion';
import { ringSwell } from './desk';
import { GRID_C } from './grid';
import * as T from './timing';

const M = T.M;

/** the hook's push (frame 0 → the week) */
export const PUSH = 0.02;
export const zoomAt = (t: number): number => {
  if (t <= 0) return 1;
  let z = 1 + PUSH * EASE.inOut(Math.min(1, t / T.HOURS));
  // the week keeps leaning in, slowly, while it fills (never a frozen frame under her voice)
  z += 0.014 * EASE.inOut(tween(t, [T.HOURS, M.week168], [0, 1]));
  // "a hundred and sixty-eight": the whole week in view
  z = mix(z, 0.94, tween(t, [M.week168 - 2, M.week168 + 22], [0, 1], EASE.inOut));
  // b4: the grid recedes behind the outcome cards
  z = mix(z, 0.86, tween(t, [M.answers - 8, M.answers + 10], [0, 1], EASE.inOut));
  // b5: the desk beat — the grid back at full size as the records leave (settled before "receptionist")
  z = mix(z, 1, tween(t, BACK, [0, 1], EASE.inOut));
  return z;
};
/** b4 → b5: the week's return to full size (from the records' exit, settled a frame before "receptionist") */
export const BACK = [M.recordsOut + 2, Math.min(M.recordsOut + 20, M.receptionist - 1)] as const;
/** b4's shade on the grid (0..1 of its recede) */
export const recedeAt = (t: number) => tween(t, [M.answers - 8, M.answers + 10], [0, 1], EASE.inOut) * (1 - tween(t, BACK, [0, 1], EASE.inOut));
/** the grid's chrome (09, 18, MON–FRI): stepped out while the records hold the stage (the contact row would cut the
 *  "18"), back — in place, not moving — once the week has settled at full size */
export const chromeAt = (t: number) =>
  1 - tween(t, [M.answers - 8, M.answers + 2], [0, 1], EASE.inOut) * (1 - tween(t, [BACK[1], BACK[1] + 8], [0, 1], EASE.inOut));

/** a point of the camera plane on screen at zoom z */
export const onScreen = (p: { x: number; y: number }, z: number) => ({ x: GRID_C.x + (p.x - GRID_C.x) * z, y: GRID_C.y + (p.y - GRID_C.y) * z });
/** the plane's CSS transform at zoom z */
export const planeTransform = (z: number) => `translate(${(GRID_C.x * (1 - z)).toFixed(4)}px, ${(GRID_C.y * (1 - z)).toFixed(4)}px) scale(${z.toFixed(6)})`;
/** is the camera moving around t (± a quarter frame: one render frame) */
export const zooming = (t: number) => Math.abs(zoomAt(t + 0.25) - zoomAt(t - 0.25)) > 2e-6;

/** the CTA's step back: the week dims well back (opacity × (1 − dim)) from just before the CTA line rises, so its
 *  centred caption never sits on the full-strength grid (End.tsx carries it on; the desk act starts it) */
export const CTA_DIM = 0.86;
export const ctaDimAt = (t: number) => CTA_DIM * tween(t, [T.END_CARD.cta - 12, T.END_CARD.cta + 4], [0, 1], EASE.inOut);

/* ── her orb ── */
/** parked in the label band while the week fills (Ø 40, as her full stop) */
export const P1 = { x: 840, y: 300, d: 40 } as const;
/** "That's the agent's shift": she grows over the grid's top-right corner, Ø 96 (SCRIPT ig1 b3: Ø 120 at (840, 400) —
 *  lifted into the label band, clear of the week's top row at y 360 with her contact shadow, so she never sits on the
 *  agent's own hours; her top edge at y 242, under the platform's header band) */
export const P2 = { x: 840, y: 290, d: 96 } as const;
/** the orb's canvas (fixed: it never re-allocates while she glides or grows) */
export const ORB_CANVAS = 120;

export type OrbPose = { x: number; y: number; d: number; moving: boolean; opacity: number };
/**
 * Her pose at t; `stop` = her full stop's place in the plane (Hook.tsx fullStop(), measured once the faces are in).
 * Before "ours" + 2 she is not there (the pop is AvaOrb's).
 */
export function orbPose(t: number, stop: { x: number; y: number }): OrbPose {
  // the full stop rides the hook's push (it is in the plane), then detaches as "Not even ours." leaves — rising first
  // and then drifting right, so she leaves the week by its top edge instead of crossing its last columns
  const fs = onScreen(stop, zoomAt(Math.min(t, M.detach)));
  const dz = zoomAt(Math.min(t, M.detach));
  const g1 = tween(t, [M.detach, M.detach + 18], [0, 1], EASE.inOut);
  const g1y = tween(t, [M.detach, M.detach + 14], [0, 1], EASE.inOut);
  const g1x = tween(t, [M.detach + 3, M.detach + 18], [0, 1], EASE.inOut);
  let x = mix(fs.x, P1.x, g1x);
  let y = mix(fs.y, P1.y, g1y);
  let d = mix(P1.d * dz, P1.d, g1);
  const g2 = tween(t, [M.agents - 4, M.agents + 16], [0, 1], EASE.inOut);
  x = mix(x, P2.x, g2);
  y = mix(y, P2.y, g2);
  d = mix(d, P2.d, g2);
  // "only people can do": she rests (dimmer); back for the end card
  const rest = tween(t, [M.only, M.only + 14], [0, 1], EASE.inOut) * (1 - tween(t, [T.END_CARD.cta, T.END_CARD.cta + 14], [0, 1], EASE.inOut));
  const moving = (g1 > 0 && g1 < 1) || (g2 > 0 && g2 < 1) || (t < M.detach && zooming(t));
  return { x, y, d, moving, opacity: 1 - 0.45 * rest };
}

/* ── the ground's light ── */
const HOOK_KEY = { x: 160, y: 1560, strength: 0.35, color: '#d9d4cf', radius: 760 } as const;
/** b1: THE PHONE's light on the ground (film 2's line-light key: the source in frame pulls a pool onto itself and tints
 *  the pearl) — the desk phone's rose, swelling as each ring leaves it, out as "ours" lands (the phone answered) */
const PHONE_KEY = { x: 860, y: 820, strength: 0.3, color: '#f2b8c9', radius: 900 } as const;
/** b3: the sunday pool rising behind the week (her teal, from "other", over 1 s) */
const POOL_KEY = { x: 700, y: 980, strength: 0.32, color: '#bfeef5', radius: 980 } as const;
export const poolAt = (t: number) => tween(t, [M.cascade, M.cascade + 30], [0, 1], EASE.inOut);
/** 1 while the phone rings, out as her orb lands on "ours" (the week opening out of the desk line) */
export const phoneAt = (t: number) => 1 - tween(t, [M.ours, M.unfold + 14], [0, 1], EASE.inOut);
export const groundKeyAt = (t: number) => {
  const k = poolAt(t);
  const ph = phoneAt(t);
  const base = {
    x: mix(HOOK_KEY.x, POOL_KEY.x, k),
    y: mix(HOOK_KEY.y, POOL_KEY.y, k),
    strength: mix(HOOK_KEY.strength, POOL_KEY.strength, k),
    color: mixHex(HOOK_KEY.color, POOL_KEY.color, k),
    radius: mix(HOOK_KEY.radius, POOL_KEY.radius, k),
  };
  if (ph <= 0) return base;
  const s = PHONE_KEY.strength * (0.75 + 0.45 * ringSwell(t));
  return {
    x: mix(base.x, PHONE_KEY.x, ph),
    y: mix(base.y, PHONE_KEY.y, ph),
    strength: mix(base.strength, s, ph),
    color: mixHex(base.color, PHONE_KEY.color, ph),
    radius: mix(base.radius, PHONE_KEY.radius, ph),
  };
};
export { HOOK_KEY };
