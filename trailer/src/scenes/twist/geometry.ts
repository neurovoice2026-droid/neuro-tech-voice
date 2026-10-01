/**
 * TWIST geometry + camera. Pure functions of the layout and the (local)
 * frame, so the scene can re-evaluate any layer at a sub-frame time for
 * motion-blur ghosts.
 */
import { noise2D } from '@remotion/noise';
import { CALL_ORB_START } from '../../lib/handoff';
import type { Layout } from '../../lib/layout';
import { EASE, tween } from '../../lib/motion';
import { TWIST, TWIST_LOCAL } from '../../timing';

/** Twist fine-cut timing lives in timing.ts (TWIST_LOCAL). */
export const TW = TWIST_LOCAL;

export type Geo = ReturnType<typeof twistGeo>;

export function twistGeo(L: Layout) {
  const fontSize = L.pick(118, 104);
  const text = { fontSize, cx: L.cx, cy: L.pick(L.cy - 6, L.cy + 26), boxWidth: L.pick(1400, 940) };

  const door = L.pick(
    { cx: 336, top: 222, w: 300, h: 650 },
    { cx: 292, top: 226, w: 250, h: 540 },
  );
  const floor = door.top + door.h;

  // 9:16: under the tagline, its caller ID (label + number, above the orb — Phone.tsx) inside the
  // safe zone (y ≤ 1500 at the hold's full push); the body runs on into the bottom band
  const phone = L.pick({ cx: 1592, cy: 540, w: 260, h: 540 }, { cx: 772, cy: 1490, w: 260, h: 540 });
  const bezel = 9;
  const screen = { w: phone.w - 2 * bezel, h: phone.h - 2 * bezel, r: 37 };

  const orb = CALL_ORB_START(L);
  // final zoom of the phone plane: the screen overfills the frame's short
  // dimension across (with margin, so its rounded corners sit off-frame)
  const S = L.pick((L.width / screen.w) * 1.1, (L.width / screen.w) * 1.12);
  /** avatar diameter on the phone at t ≥ pushToPhone[1] (the contract) */
  const avatarD = orb.d / S;
  /** …and at rest, as the incoming-call UI draws it (~26 % of the screen) */
  const avatarRest = L.pick(64, 60);

  return { L, text, door, floor, phone, bezel, screen, orb, S, avatarD, avatarRest };
}

/**
 * Avatar diameter in phone-plane px. At rest it is the call UI's size;
 * in the second half of the dive it settles to avatarD, so that
 * avatarD · S = CALL_ORB_START.d exactly when the dive ends.
 */
export function avatarOnPhone(t: number, g: Geo): number {
  const k = tween(t, TW.avatarShrink, [0, 1], EASE.inOut);
  return g.avatarRest + (g.avatarD - g.avatarRest) * k;
}

/* ── the camera ─────────────────────────────────────────────────────
 * A pinhole dolly. Layers sit at parallax factor k (bg 0.2, door+phone
 * 0.6, text 1.0, dust 1.4). The camera has a lateral offset (cx, cy),
 * measured on the k = 1 plane, and a forward travel dz. A layer at k is
 * scaled f = 1 / (1 − dz·k) about the frame centre and shifted −c·k·f:
 * nearer layers grow and slide faster, and the camera can fly THROUGH the
 * text on its way into the phone.
 */
export type Cam = { cx: number; cy: number; dz: number };

const K_PHONE = 0.6;

export function camAt(t: number, g: Geo): Cam {
  const { L } = g;
  // slow push while we read; shatter kick; focus kick; slam shake
  const push = 0.04 * tween(t, TW.push, [0, 1], EASE.inOut);
  const kickX = t - TWIST.shatter;
  const kick = kickX > 0 ? 0.022 * (kickX / 2.2) * Math.exp(1 - kickX / 2.2) : 0;
  // the focus beat: a small camera kick ON the beat (≈ 0.6 % → 1–3 px on the type)
  const fkX = t - TW.keyFocus[0];
  const focusKick = fkX > 0 ? 0.006 * (fkX / 2) * Math.exp(1 - fkX / 2) : 0;
  const logDrift = Math.log(1 + push + kick + focusKick);

  // the dive: anticipation dip, then EASE.peel into the screen
  const [d0, d1, d2] = TW.diveDip;
  const dipU = t < d0 ? 0 : t < d1 ? tween(t, [d0, d1], [0, 1], EASE.inOut) : tween(t, [d1, d2], [1, 0], EASE.inOut);
  const dive = tween(t, TWIST.pushToPhone, [0, 1], EASE.peel);
  const logF = logDrift * (1 - dive) + Math.log(g.S) * dive + Math.log(0.955) * dipU;
  const fPh = Math.exp(logF);
  const dz = (1 - 1 / fPh) / K_PHONE;

  // aim: the avatar's screen offset from centre shrinks (1 − w), w eased.
  // Only the dive's own zoom is aimed; the slow push and the pull-back
  // happen about the frame centre, so the tagline holds centre.
  const w = tween(t, TW.diveAim, [0, 1], EASE.inOut);
  const fAim = Math.exp(Math.log(g.S) * dive);
  const A = { x: g.phone.cx, y: g.phone.cy };
  const ax = A.x - L.cx;
  const ay = A.y - L.cy;
  // avatar screen offset = (A − C)(1 − w) = (A − C)·f − c·k·f
  const aimX = (ax * (fAim - 1 + w)) / (K_PHONE * fAim);
  const aimY = (ay * (fAim - 1 + w)) / (K_PHONE * fAim);

  // drift: a breathing handheld, very small
  const bx = 5 * noise2D('twist-cam-x', t * 0.012, 0.2);
  const by = 4 * noise2D('twist-cam-y', 0.8, t * 0.012);
  // handheld is zero at the break (the hook's line hands over untouched)
  // and gone by the end of the dive (the orb must land exactly)
  const settle =
    tween(t, [0, 14], [0, 1], EASE.inOut) *
    (1 - tween(t, [TWIST.pushToPhone[0], TWIST.pushToPhone[1] - 6], [0, 1], EASE.inOut));

  // slam shake: ±4 px, 4 frames, decaying
  const s = shake(t);

  return { cx: aimX + bx * settle + s.x, cy: aimY + by * settle + s.y, dz };
}

export function shake(t: number) {
  const u = t - TWIST.doorSlam;
  if (u < 0 || u > 5) return { x: 0, y: 0 };
  const env = 4 * Math.exp(-u / 1.6);
  const sgn = Math.round(u) % 2 === 0 ? 1 : -1;
  return {
    x: env * sgn * (0.75 + 0.25 * noise2D('shk-x', u, 0)),
    y: env * -sgn * (0.45 + 0.3 * noise2D('shk-y', 0, u)),
  };
}

export type LayerXf = { f: number; tx: number; ty: number; alive: boolean };

export function layerXf(cam: Cam, k: number): LayerXf {
  const den = 1 - cam.dz * k;
  // `alive`: the plane is still comfortably in front of the lens (the text
  // and dust planes are flown through and hidden before that)
  const alive = den > 0.12;
  const f = 1 / Math.max(0.01, den);
  return { f, tx: -cam.cx * k * f, ty: -cam.cy * k * f, alive };
}

export const xfCss = (x: LayerXf) =>
  `translate(${x.tx.toFixed(2)}px, ${x.ty.toFixed(2)}px) scale(${x.f.toFixed(5)})`;

/** Screen position of a rest-position point on a layer. */
export function project(x: LayerXf, L: Layout, px: number, py: number) {
  return { x: L.cx + (px - L.cx) * x.f + x.tx, y: L.cy + (py - L.cy) * x.f + x.ty };
}

/**
 * Phone vibration at the second burst. `f` is the phone plane's zoom: the
 * buzz lives on the phone, so it grows (sub-linearly) as the camera dives
 * in and still reads at 5×. Returns screen px + a small rotation (deg)
 * about the phone's centre (which leaves the avatar where it is).
 */
export function buzz(t: number, f = 1) {
  const [a, b] = TW.buzz;
  if (t < a || t > b) return { x: 0, y: 0, rot: 0 };
  const env = tween(t, [a, a + 1.5], [0, 1], EASE.out3) * tween(t, [b - 4, b], [1, 0], EASE.inOut);
  const ph = (t - a) * Math.PI * 1.35;
  const amp = 3 * Math.pow(Math.max(1, f), 0.6);
  return {
    x: amp * env * Math.sin(ph),
    y: 0.37 * amp * env * Math.sin(ph * 1.7 + 0.8),
    rot: 1.4 * env * Math.sin(ph * 0.92 + 1.9),
  };
}
