/**
 * ATMOSPHERE — premium, motivated grounds. A room is neutral; its only
 * colour is the light that falls into it from a source you can point to
 * (the orb is the key light). No bokeh discs, no pastel blobs, no dust.
 *
 *   <NightRoom light={{ x, y, color, strength, radius }} floor={{ y }} />
 *       near-black; a soft key light on the back wall (a point light's
 *       Lambert falloff, (1 + (d/h)²)^−3/2, encoded perceptually so the pool
 *       has no edge); optionally a floor: the wall light stops at a feathered
 *       horizon, the floor gets its own foreshortened pool under the light and
 *       a faint sheen where wall meets floor; a smooth vignette.
 *   <PaperRoom light={{ x, y }} horizon={{ y }} />
 *       paper white / warm grey: one big soft light (a softbox) whitens the
 *       wall around it, the rest falls to warm grey; an optional seamless cove
 *       (the floor a touch brighter than the wall above the seam); a whisper
 *       of a warm vignette. `tint` lets the scene's light colour the wall faintly.
 *   <EmberRoom …>   NightRoom on a warm near-black with an ember key (the booked side).
 *   <ContactShadow x y w lift />   a real object's shadow on paper (contact core + soft ambient).
 *
 * Every layer is a CSS gradient with many stops sampled from a smooth curve
 * (Skia dithers gradients; the film grain on top dithers again) — no
 * `filter: blur`, nothing that can band or pop. Everything is a pure function
 * of its props: animate a light by animating its props (slowly).
 */
import React from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { fromOklch, hexToRgb, toOklch } from '../lib/lights';
import { ROOM, type Tone } from '../theme';

/* ── light maths ───────────────────────────────────────────────── */

/** Lambert falloff of a point light at height h over a plane, at distance u·h. */
const lambert = (u: number) => Math.pow(1 + u * u, -1.5);
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const rgbOf = (hex: string) => hexToRgb(hex).map((c) => Math.round(c * 255)) as [number, number, number];
const rgba = ([r, g, b]: readonly number[], a: number) => `rgba(${r},${g},${b},${Math.max(0, a).toFixed(4)})`;

/**
 * Stops for a radial light pool: alpha(u) = strength · lambert(u)^gamma, tapered to exactly 0
 * at the gradient's edge (`extent`, in units of h). Stops are denser near the centre.
 */
function poolStops(rgb: readonly number[], strength: number, extent: number, gamma: number, n = 28): string {
  const out: string[] = [];
  for (let i = 0; i <= n; i++) {
    const f = Math.pow(i / n, 1.35);
    const u = f * extent;
    const taper = 1 - smooth(0.62, 1, f);
    out.push(`${rgba(rgb, strength * Math.pow(lambert(u), gamma) * taper)} ${(f * 100).toFixed(2)}%`);
  }
  return out.join(', ');
}

/** Gaussian-ish stops (exactly 0 at the edge): for shadows and sheens. */
function gaussStops(rgb: readonly number[], a: number, n = 14, k = 4.5): string {
  const e = Math.exp(-k);
  const out: string[] = [];
  for (let i = 0; i <= n; i++) {
    const r = i / n;
    out.push(`${rgba(rgb, (a * (Math.exp(-k * r * r) - e)) / (1 - e))} ${(r * 100).toFixed(2)}%`);
  }
  return out.join(', ');
}

/**
 * The colour a light paints on a neutral wall: its hue, at a fixed lightness (so `strength`
 * alone sets how bright the pool is, whatever the hue), with its chroma scaled by `chroma`
 * (a wall is not a gel: most of the colour stays in the source).
 */
function wallColour(hex: string, chroma: number, L = 0.8): number[] {
  const [, c, h] = toOklch(hex);
  return rgbOf(fromOklch(L, Math.min(0.2, c) * chroma, h));
}

/** The farthest frame corner from (x, y). */
const farCorner = (x: number, y: number, W: number, H: number) =>
  Math.max(Math.hypot(x, y), Math.hypot(W - x, y), Math.hypot(x, H - y), Math.hypot(W - x, H - y));

/* ── the key light ─────────────────────────────────────────────── */

/** a night key's default strength: the wall under it a dim grey with the light's hue in it */
const NIGHT_STRENGTH = 0.22;

export type RoomLight = {
  /** where the light is (px in the frame) — put it on its source (the orb) */
  x: number;
  y: number;
  /** hex: the light's colour on the wall (use the source's mid tone, e.g. LIGHTS.night.orb[2]) */
  color: string;
  /** 0..1: the wall's brightness under the light, perceptual (night default .34) */
  strength?: number;
  /** px: the light's height over the wall — the pool's size (≈ half-bright at .77 × radius). Default .36 × frame height */
  radius?: number;
  /** horizontal stretch of the pool (1 = round) */
  aspect?: number;
  /** tail shape: alpha = strength · lambert^falloff — .45 = physical (long, soft), 1 = a tight pool (default) */
  falloff?: number;
  /** how much of the light's colour the wall takes, 0 (neutral) … 1 (default .45) */
  chroma?: number;
};

export type RoomFloor = {
  /** the horizon (px from the top): the wall light stops here (feathered), the floor begins */
  y: number;
  /** 0..1 the floor pool's strength relative to the key (default .7) */
  strength?: number;
  /** px the horizon is feathered over (default 2.4 % of the frame height) */
  feather?: number;
  /** the sheen where wall meets floor, 0..1 (default .5) */
  sheen?: number;
  /** how much of the wall's light still reaches the floor (bounce), 0..1 (default .45) — no black band */
  bounce?: number;
};

const LightPool: React.FC<{
  l: RoomLight;
  W: number;
  H: number;
  floorY?: number;
  feather?: number;
  bounce?: number;
  blend?: React.CSSProperties['mixBlendMode'];
}> = ({ l, W, H, floorY, feather = 0, bounce = 0.45, blend = 'screen' }) => {
  const h = l.radius ?? 0.36 * H;
  const aspect = l.aspect ?? 1;
  const strength = l.strength ?? NIGHT_STRENGTH;
  if (strength <= 0.0005) return null;
  const extentPx = farCorner(l.x, l.y, W, H) * 1.06;
  const extent = extentPx / h;
  const rgb = wallColour(l.color, l.chroma ?? 0.45);
  // below the horizon only the bounce remains (eased over the feather: a seamless cove, never a band)
  const mask =
    floorY !== undefined
      ? `linear-gradient(to bottom, #000 ${(floorY - feather).toFixed(1)}px, rgba(0,0,0,${(0.5 + 0.5 * bounce).toFixed(3)}) ${floorY.toFixed(1)}px, rgba(0,0,0,${bounce.toFixed(3)}) ${(floorY + feather).toFixed(1)}px)`
      : undefined;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(${(extentPx * aspect).toFixed(1)}px ${extentPx.toFixed(1)}px at ${l.x.toFixed(2)}px ${l.y.toFixed(2)}px, ${poolStops(rgb, strength, extent, l.falloff ?? 1)}, transparent)`,
        mixBlendMode: blend,
        maskImage: mask,
        WebkitMaskImage: mask,
      }}
    />
  );
};

/** The floor's own light under a key: a foreshortened pool + the sheen along the horizon. */
const FloorLight: React.FC<{ l: RoomLight; f: RoomFloor; W: number; H: number }> = ({ l, f, W, H }) => {
  const h = l.radius ?? 0.36 * H;
  const s = (l.strength ?? NIGHT_STRENGTH) * (f.strength ?? 0.7);
  if (s <= 0.0005) return null;
  const rgb = wallColour(l.color, l.chroma ?? 0.45);
  const below = Math.max(0, f.y - l.y);
  // the pool's centre: just below the horizon, nearer to the camera the higher the light hangs
  const py = f.y + Math.min(0.22 * H, 0.18 * h + 0.25 * below);
  const rx = Math.max(W * 0.35, 2.2 * h);
  const ry = Math.max(H * 0.08, 0.42 * h);
  const sheen = (f.sheen ?? 0.5) * (l.strength ?? NIGHT_STRENGTH);
  const top = `linear-gradient(to bottom, transparent ${(f.y - 1).toFixed(1)}px, #000 ${(f.y + (f.feather ?? 0.05 * H)).toFixed(1)}px)`;
  return (
    <>
      <AbsoluteFill
        style={{
          background: `radial-gradient(${rx.toFixed(1)}px ${ry.toFixed(1)}px at ${l.x.toFixed(1)}px ${py.toFixed(1)}px, ${poolStops(rgb, s, 3.2, 0.9, 20)}, transparent)`,
          mixBlendMode: 'screen',
          maskImage: top,
          WebkitMaskImage: top,
        }}
      />
      {sheen > 0.001 ? (
        <AbsoluteFill
          style={{
            background: `radial-gradient(${(2.6 * h).toFixed(1)}px ${(0.035 * H).toFixed(1)}px at ${l.x.toFixed(1)}px ${f.y.toFixed(1)}px, ${gaussStops(rgb, 0.45 * sheen)}, transparent)`,
            mixBlendMode: 'screen',
          }}
        />
      ) : null}
    </>
  );
};

/** A smooth vignette: darkens towards the corners along a smoothstep, never a ring. */
export const Vignette2: React.FC<{ strength?: number; rgb?: readonly number[]; at?: string }> = ({
  strength = 0.5,
  rgb = [0, 0, 0],
  at = '50% 46%',
}) => {
  if (strength <= 0.001) return null;
  const stops: string[] = [];
  for (let i = 0; i <= 12; i++) {
    const r = 0.38 + (i / 12) * 0.62;
    stops.push(`${rgba(rgb, strength * Math.pow(smooth(0.38, 1, r), 1.6))} ${(r * 100).toFixed(1)}%`);
  }
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse farthest-corner at ${at}, transparent 0%, ${stops.join(', ')})` }} />
  );
};

/* ── rooms ─────────────────────────────────────────────────────── */

type RoomProps = {
  /** the key light (null: an unlit room) */
  light?: RoomLight | null;
  /** extra lights (rare: a second source in frame). Added (screen). */
  lights?: readonly RoomLight[];
  /** the room's ground colour */
  base?: string;
  floor?: RoomFloor | null;
  /** 0..1 (default .55) */
  vignette?: number;
  style?: React.CSSProperties;
  children?: React.ReactNode;
};

/** Near-black, lit by one motivated key light. */
export const NightRoom: React.FC<RoomProps> = ({ light, lights = [], base = ROOM.night, floor = null, vignette = 0.55, style, children }) => {
  const { width: W, height: H } = useVideoConfig();
  const all = [...(light ? [light] : []), ...lights];
  const feather = floor ? floor.feather ?? 0.05 * H : 0;
  return (
    <AbsoluteFill style={{ background: base, overflow: 'hidden', ...style }}>
      {all.map((l, i) => (
        <LightPool key={i} l={l} W={W} H={H} floorY={floor?.y} feather={feather} bounce={floor?.bounce} />
      ))}
      {floor ? all.map((l, i) => <FloorLight key={`f${i}`} l={l} f={floor} W={W} H={H} />) : null}
      <Vignette2 strength={vignette} />
      {children}
    </AbsoluteFill>
  );
};

/** The booked side: a warm near-black under an ember key. */
export const EmberRoom: React.FC<RoomProps> = ({ base = ROOM.ember, vignette = 0.6, light, ...rest }) => (
  <NightRoom
    base={base}
    vignette={vignette}
    // dark orange on a wall is brown: the ember stays in the subject, the wall takes a warm grey
    light={light ? { chroma: 0.3, strength: 0.18, ...light } : null}
    {...rest}
  />
);

export type PaperLight = {
  /** where the softbox's light is centred on the wall (px) */
  x: number;
  y: number;
  /** px: how far the white spreads (default .62 × frame width) */
  radius?: number;
  /** 0..1 how white the centre gets (default 1) */
  strength?: number;
  /** horizontal stretch (default 1.25: a wide softbox) */
  aspect?: number;
  /** hex: the scene's light colouring the wall faintly (colour lives in the subject — keep `tintStrength` ≤ .08) */
  tint?: string;
  tintStrength?: number;
};

/** Paper white / warm grey with one soft light; optional seamless cove at `horizon`. */
export const PaperRoom: React.FC<{
  light?: PaperLight | null;
  /** wall in shade (default ROOM.paper.wall) */
  base?: string;
  /** the lit colour (default ROOM.paper.lit) */
  lit?: string;
  horizon?: { y: number; strength?: number } | null;
  /** 0..1 (default .35): a warm-grey falloff at the edges */
  vignette?: number;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ light, base = ROOM.paper.wall, lit = ROOM.paper.lit, horizon = null, vignette = 0.35, style, children }) => {
  const { width: W, height: H } = useVideoConfig();
  const l = light === undefined ? { x: W / 2, y: H * 0.42 } : light;
  let layers: React.ReactNode = null;
  if (l) {
    const h = l.radius ?? 0.62 * W;
    const aspect = l.aspect ?? 1.25;
    const ext = farCorner(l.x, l.y, W, H) * 1.06;
    const extent = ext / h;
    const tintS = l.tintStrength ?? 0;
    layers = (
      <>
        <AbsoluteFill
          style={{
            background: `radial-gradient(${(ext * aspect).toFixed(1)}px ${ext.toFixed(1)}px at ${l.x.toFixed(1)}px ${l.y.toFixed(1)}px, ${poolStops(rgbOf(lit), l.strength ?? 1, extent, 1.0)}, transparent)`,
          }}
        />
        {l.tint && tintS > 0.0005 ? (
          <AbsoluteFill
            style={{
              background: `radial-gradient(${(ext * aspect * 0.8).toFixed(1)}px ${(ext * 0.8).toFixed(1)}px at ${l.x.toFixed(1)}px ${l.y.toFixed(1)}px, ${poolStops(rgbOf(l.tint), tintS, extent * 0.8, 0.9)}, transparent)`,
              mixBlendMode: 'multiply',
            }}
          />
        ) : null}
      </>
    );
  }
  let cove: React.ReactNode = null;
  if (horizon) {
    const s = horizon.strength ?? 1;
    const fy = horizon.y;
    const fl = rgbOf(ROOM.paper.floor);
    // the floor: brighter than the wall just above the seam, settling to paper towards the camera;
    // a soft shade just above the seam where the cove turns (no line)
    cove = (
      <>
        <AbsoluteFill
          style={{
            background: `linear-gradient(to bottom, transparent ${(fy - 0.02 * H).toFixed(1)}px, ${rgba(fl, 0.55 * s)} ${(fy + 0.03 * H).toFixed(1)}px, ${rgba(fl, 0.25 * s)} ${(fy + 0.25 * H).toFixed(1)}px, ${rgba(fl, 0.1 * s)} 100%)`,
          }}
        />
        <AbsoluteFill
          style={{
            background: `linear-gradient(to bottom, transparent ${(fy - 0.09 * H).toFixed(1)}px, rgba(60,52,44,${(0.022 * s).toFixed(4)}) ${(fy - 0.01 * H).toFixed(1)}px, transparent ${(fy + 0.03 * H).toFixed(1)}px)`,
          }}
        />
      </>
    );
  }
  return (
    <AbsoluteFill style={{ background: base, overflow: 'hidden', ...style }}>
      {layers}
      {cove}
      <Vignette2 strength={vignette * 0.16} rgb={[70, 60, 50]} />
      {children}
    </AbsoluteFill>
  );
};

/**
 * A real object's shadow on a surface: a tight dark contact core (sharp when it
 * rests, gone soft and faint as it lifts) under a wide soft ambient. (x, y) = the
 * centre of the object's bottom edge; w = its width. Draw it BEHIND the object.
 */
export const ContactShadow: React.FC<{
  x: number;
  y: number;
  w: number;
  /** 0 = resting on the surface … 1 = a hand's breadth above it */
  lift?: number;
  /** darkness multiplier */
  k?: number;
  /** the surface: 'paper' (warm grey shadow) or 'night' (black, stronger) */
  tone?: Tone;
}> = ({ x, y, w, lift = 0, k = 1, tone = 'paper' }) => {
  const rgb = tone === 'paper' ? [38, 30, 24] : [0, 0, 0];
  const dark = tone === 'paper' ? 1 : 2.2;
  const l = Math.max(0, lift);
  const coreW = w * (0.92 + 0.1 * l);
  const coreH = Math.max(6, w * 0.035) * (1 + 2.2 * l);
  const coreA = (0.26 * k * dark) / (1 + 2.4 * l);
  const ambW = w * (1.25 + 0.35 * l);
  const ambH = w * (0.16 + 0.14 * l);
  const ambA = (0.11 * k * dark) / (1 + 0.6 * l);
  const ambY = y + w * (0.02 + 0.05 * l);
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: x - ambW / 2,
          top: ambY - ambH / 2,
          width: ambW,
          height: ambH,
          background: `radial-gradient(closest-side, ${gaussStops(rgb, ambA)})`,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: x - coreW / 2,
          top: y - coreH / 2 + 2 + 6 * l,
          width: coreW,
          height: coreH,
          background: `radial-gradient(closest-side, ${gaussStops(rgb, coreA, 12, 3.2)})`,
          pointerEvents: 'none',
        }}
      />
    </>
  );
};
