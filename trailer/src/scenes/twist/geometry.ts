/**
 * TWIST geometry + camera. Pure functions of the layout and the (local)
 * frame, so the scene can re-evaluate any layer at a sub-frame time for
 * motion-blur ghosts.
 */
import { noise2D } from '@remotion/noise';
import { CALL_ORB_START } from '../../lib/handoff';
import type { Layout } from '../../lib/layout';
import { EASE, tween } from '../../lib/motion';
import { TWIST } from '../../timing';

/* LOCAL TIMING - hoist into timing.ts (values are TWIST-local frames; b() = beats) */
export const TW = {
  /** anticipation before the break: the line gathers itself (t -8 → 0) */
  gather: -8,
  /** word-level landing starts of the rebuilt line (Closed, is, for, the, door,) */
  wordStarts: [3, 8, 12, 16, 21] as const,
  /** the door creaks a little wider before it swings (anticipation) */
  doorCreak: 7,
  /** the swing itself: slow start, accelerating into the slam (EASE.in4) */
  doorSwing: [12, TWIST.doorSlam] as const,
  /** screen: line expands, then opens to the full screen */
  screenLine: [TWIST.phoneOn, TWIST.phoneOn + 3] as const,
  screenOpen: [TWIST.phoneOn + 2, TWIST.phoneOn + 14] as const,
  /** phone UI rows */
  uiLabel: TWIST.phoneOn + 6,
  uiNumber: TWIST.phoneOn + 10,
  /** camera: slow push over the hold */
  push: [TWIST.doorSlam - 2, TWIST.pushToPhone[0] + 2] as const,
  /** pull-back anticipation of the dive (peaks at [1]) */
  diveDip: [TWIST.pushToPhone[0] - 5, TWIST.pushToPhone[0] + 3, TWIST.pushToPhone[0] + 10] as const,
  /** camera aims at the avatar (pan) — leads the zoom */
  diveAim: [TWIST.pushToPhone[0], TWIST.pushToPhone[1] - 4] as const,
  /** phone vibration at the second burst */
  buzz: [TWIST.ring2, TWIST.ring2 + 12] as const,
};

export type Geo = ReturnType<typeof twistGeo>;

export function twistGeo(L: Layout) {
  const fontSize = L.pick(118, 104);
  const text = { fontSize, cx: L.cx, cy: L.pick(L.cy - 6, L.cy + 26), boxWidth: L.pick(1400, 940) };

  const door = L.pick(
    { cx: 336, top: 222, w: 300, h: 650 },
    { cx: 292, top: 226, w: 250, h: 540 },
  );
  const floor = door.top + door.h;

  const phone = L.pick({ cx: 1592, cy: 540, w: 260, h: 540 }, { cx: 772, cy: 1484, w: 260, h: 540 });
  const bezel = 9;
  const screen = { w: phone.w - 2 * bezel, h: phone.h - 2 * bezel, r: 37 };

  const orb = CALL_ORB_START(L);
  // final zoom of the phone plane: the screen overfills the frame's short
  // dimension across (with margin, so its rounded corners sit off-frame)
  const S = L.pick((L.width / screen.w) * 1.1, (L.width / screen.w) * 1.12);
  const avatarD = orb.d / S;

  return { L, text, door, floor, phone, bezel, screen, orb, S, avatarD };
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
  // slow push while we read; shatter kick; slam shake
  const push = 0.04 * tween(t, TW.push, [0, 1], EASE.inOut);
  const kickX = t - TWIST.shatter;
  const kick = kickX > 0 ? 0.022 * (kickX / 2.2) * Math.exp(1 - kickX / 2.2) : 0;
  const logDrift = Math.log(1 + push + kick);

  // the dive: anticipation dip, then EASE.peel into the screen
  const [d0, d1, d2] = TW.diveDip;
  const dipU = t < d0 ? 0 : t < d1 ? tween(t, [d0, d1], [0, 1], EASE.inOut) : tween(t, [d1, d2], [1, 0], EASE.inOut);
  const dive = tween(t, TWIST.pushToPhone, [0, 1], EASE.peel);
  const logF = logDrift * (1 - dive) + Math.log(g.S) * dive + Math.log(0.955) * dipU;
  const fPh = Math.exp(logF);
  const dz = (1 - 1 / fPh) / K_PHONE;

  // aim: the avatar's screen offset from centre shrinks (1 − w), w eased.
  // A slight counter-move first (anticipation).
  const w = tween(t, TW.diveAim, [0, 1], EASE.inOut) - 0.05 * dipU;
  const A = { x: g.phone.cx, y: g.phone.cy };
  const ax = A.x - L.cx;
  const ay = A.y - L.cy;
  // avatar screen offset = (A − C)(1 − w) = (A − C)·fPh − c·k·fPh
  const aimX = (ax * (fPh - 1 + w)) / (K_PHONE * fPh);
  const aimY = (ay * (fPh - 1 + w)) / (K_PHONE * fPh);

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
  const alive = den > 0.12;
  const f = 1 / Math.max(0.12, den);
  return { f, tx: -cam.cx * k * f, ty: -cam.cy * k * f, alive };
}

export const xfCss = (x: LayerXf) =>
  `translate(${x.tx.toFixed(2)}px, ${x.ty.toFixed(2)}px) scale(${x.f.toFixed(5)})`;

/** Screen position of a rest-position point on a layer. */
export function project(x: LayerXf, L: Layout, px: number, py: number) {
  return { x: L.cx + (px - L.cx) * x.f + x.tx, y: L.cy + (py - L.cy) * x.f + x.ty };
}

/** Phone vibration at the second burst (screen px). */
export function buzz(t: number) {
  const [a, b] = TW.buzz;
  if (t < a || t > b) return { x: 0, y: 0 };
  const env = tween(t, [a, a + 1.5], [0, 1], EASE.out3) * tween(t, [b - 4, b], [1, 0], EASE.inOut);
  const ph = (t - a) * Math.PI * 1.35;
  return { x: 3 * env * Math.sin(ph), y: 1.1 * env * Math.sin(ph * 1.7 + 0.8) };
}
