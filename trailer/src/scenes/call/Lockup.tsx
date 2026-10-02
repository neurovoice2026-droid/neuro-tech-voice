/**
 * The orb stage and the establishing lockup "03 ◉ 12".
 *
 * <OrbStage> — Ava's single WebGL orb (mounted once, never remounted: moved
 * and resized by transform only) — the scene's key light — with its
 * lit-sphere dressing (limb darkening, a soft specular that holds still
 * while the orb sways, a hairline Fresnel rim), its rim light, a near-field
 * halo, and the one ring it gives off: the pickup. Its palette is the
 * twist's night violet at the pickup and becomes the closing light's
 * emerald under the pickup's flash (`emerald` 0 → 1, `relight`: the hue
 * turns in the dark, never through a third light); the caller's turns ease it
 * to that light's listen blue. No smear, no ghosts, no trails, no blur:
 * the film's 120 fps carries the motion.
 *
 * <Digits> — the figure pairs (Instrument Sans display, tabular, paper with a
 * top light) that slide OUT from behind the orb after the gulp, and fold
 * back INTO it as the camera pushes into Ava's framing.
 */
import React from 'react';
import { Orb } from '../../components/Orb';
import { subpixel } from '../../components/Type';
import { bloom, fromOklab, mixColor, mixPalette, rgba, rimGlow, toOklab, type Glow } from '../../lib/lights';
import { EASE, smooth, springUnit, tween } from '../../lib/motion';
import { ORB_RIM } from '../../lib/pickup';
import { FONT, LIGHTS, TYPE, type Palette } from '../../theme';
import { EMERALD_GLOW, EMERALD_LISTEN_LIT, EMERALD_LIT, LISTEN_GLOW } from './Mesh';

const RING_LIFE = 28.5; // 0.95 s

export type OrbState = { x: number; y: number; d: number };

/** The night orb, lit (the twist's orb at the pickup): its paper-white top rolled off to a lilac-white. */
const NIGHT_LIT: Palette = ['#14062b', '#4a1a9e', '#7c3aed', '#c4a8ff', '#e0d4ff'];
const NIGHT_LISTEN_LIT: Palette = ['#14062b', '#3a259c', '#5946d9', '#b4b4ff', '#d9daff'];
const NIGHT_GLOW: Glow = { body: LIGHTS.night.orb[2], core: LIGHTS.night.orb[3] };

/** limb darkening: 1 − mix(.72, 1, (1 − r²)^.3) at r = stop (the dark is the deep end of the palette) */
const LIMB = [0, 0.5, 0.7, 0.8, 0.9, 0.95, 0.985, 1].map((r) => [r, 0.28 * (1 - Math.pow(Math.max(0, 1 - r * r), 0.3))] as const);
const limbBg = (k: number, rgb: string) =>
  `radial-gradient(closest-side, ${LIMB.map(([r, a]) => `rgba(${rgb},${(a * k).toFixed(4)}) ${(r * 100).toFixed(1)}%`).join(', ')})`;

/**
 * THE PICKUP'S RELIGHT — night violet → closing emerald (k 0 → 1). mixColor / mixPalette take far-apart
 * hues round the cool side of the wheel (violet → azure → cyan → emerald), which for these two reads,
 * for a few frames, as a saturated electric-blue orb: a third light. Here the hue turns IN THE DARK
 * instead: a straight line through OKLab (no chroma kept, no walk round the wheel) whose chroma falls to
 * 40 % and lightness to 85 % at the middle — a quiet slate with no hue of its own — so the light dims,
 * turns, and comes back emerald (under the pickup's flash). Exact at both ends.
 */
export function relight(a: string, b: string, k: number): string {
  if (k <= 0) return a;
  if (k >= 1) return b;
  const A = toOklab(a);
  const B = toOklab(b);
  const s = Math.sin(Math.PI * k);
  const ch = 1 - 0.6 * s;
  const lt = 1 - 0.15 * s;
  return fromOklab([(A[0] + (B[0] - A[0]) * k) * lt, (A[1] + (B[1] - A[1]) * k) * ch, (A[2] + (B[2] - A[2]) * k) * ch]);
}
const relightPalette = (a: readonly string[], b: readonly string[], k: number): string[] => a.map((c, i) => relight(c, b[i], k));
/** A glow (body, core) relit from one light to the other (see `relight`). */
export const relightGlow = (a: Glow, b: Glow, k: number): Glow => ({ body: relight(a.body, b.body, k), core: relight(a.core, b.core, k) });

/** The light the orb gives off now: night → emerald (the pickup's relight), Ava → caller (listen). */
export function orbGlow(emerald: number, listen: number): Glow {
  const ava = relightGlow(NIGHT_GLOW, EMERALD_GLOW, emerald);
  if (listen <= 0.001) return ava;
  const cal = { body: mixColor(LIGHTS.night.listen[2], LISTEN_GLOW.body, emerald), core: mixColor(LIGHTS.night.listen[3], LISTEN_GLOW.core, emerald) };
  return { body: mixColor(ava.body, cal.body, listen), core: mixColor(ava.core, cal.core, listen) };
}

/** The canvas's device-pixel ratio (the 4K masters render at --scale 2): the orb is sharp at any scale. */
const dpr = () => (typeof window !== 'undefined' && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1);

/**
 * Ava's orb, on screen — the scene's KEY LIGHT. `base` is the canvas size (the largest the orb
 * ever gets, so it is never upscaled); every framing is a transform of it.
 */
export const OrbStage: React.FC<{
  t: number;
  base: number;
  orb: OrbState;
  volume: number;
  flow: number;
  /** 0..1 the caller is speaking (the listen palette) */
  listen: number;
  /** 0..1 night violet → closing emerald */
  emerald: number;
  /** rim light strength (pickupGlow + speech) */
  rim: number;
  /** 0..1 the orb's own dressing comes up after the pickup (halo, four-light rim) */
  dress: number;
  /** frames the orb gives off a ring (the pickup) */
  ringStarts: readonly number[];
  /** 0..1 the syllable follower of her voice: the light she gives off */
  light?: number;
  /** 0..1 the rim/halo come up over the twist's orb (the room's cross-fade) */
  rimIn: number;
  /** 0..1+ a hit's extra light (pickup, gulp): the halo flares */
  flash?: number;
  /** 0..1 the lit-sphere grade (rolled-off highlight, limb, specular, Fresnel rim) */
  grade?: number;
  /** 0..1 the orb's own opacity (it is absorbed at the end of its dive into the mark) */
  fade?: number;
  /** −1..1 the sway: the specular holds still in the room while the sphere moves under it */
  tilt?: number;
}> = ({ t, base, orb, volume, flow, listen, emerald, rim, dress, ringStarts, light = 0, rimIn, flash = 0, grade = 0, fade = 1, tilt = 0 }) => {
  const { x, y, d } = orb;
  const lvl = Math.max(0, (volume - 0.12) / 0.7);
  const glow = orbGlow(emerald, listen);
  const k = d / base;

  /* ── the pickup's ring (the night `wave`, turning to the closing light's) ── */
  const rings: React.ReactNode[] = [];
  ringStarts.forEach((start, i) => {
    if (t < start || t > start + RING_LIFE) return;
    const u = Math.min(1, Math.max(0, (t - start) / RING_LIFE));
    const e = 1 - (1 - u) * (1 - u);
    const dd = d * 1.85 * (0.54 + 0.46 * e) * 1.18;
    const op = 0.42 * tween(t, [start, start + 1.5], [0, 1], EASE.out3) * (1 - e);
    rings.push(
      <div
        key={`r${i}`}
        style={{
          position: 'absolute',
          left: x - dd / 2,
          top: y - dd / 2,
          width: dd,
          height: dd,
          borderRadius: '50%',
          boxShadow: `inset 0 0 0 1.5px ${rgba(glow.core, 0.9)}`,
          opacity: Math.min(1, op),
        }}
      />,
    );
  });

  // the halo: a near-field pool of the orb's own light, hugging it (the room's light is the mesh's)
  const halo = d * (1.9 + lvl * 0.14 + light * 0.14 + 0.3 * flash);
  const haloK = dress * (0.3 + 0.18 * lvl + 0.28 * light) + 0.7 * flash;
  // the rim: the pickup's ORB_RIM (= the twist's, so the cross-fade over the twist is exact) hands
  // over to the rimGlow in the orb's current colour as the room dresses
  const spread = 1 + 1.2 * lvl;
  const rimBox = (shadow: string, op: number, key: string) =>
    op <= 0.002 ? null : (
      <div
        key={key}
        style={{
          position: 'absolute',
          left: x - d / 2,
          top: y - d / 2,
          width: d,
          height: d,
          borderRadius: '50%',
          boxShadow: shadow,
          opacity: op * fade,
        }}
      />
    );
  const palA = relightPalette(mixPalette(LIGHTS.night.orb, NIGHT_LIT, grade), EMERALD_LIT, emerald);
  const palB = mixPalette(mixPalette(LIGHTS.night.listen, NIGHT_LISTEN_LIT, grade), EMERALD_LISTEN_LIT, emerald);
  // the sphere's own dressing, in its light's colours
  // (the limb's dark turns with the light, continuously)
  const limbRgb = [12 - 10 * emerald, 5 + 17 * emerald, 32 - 18 * emerald].map((v) => Math.round(v)).join(',');
  const fresnel = relight('#b9a3ff', listen > 0.5 ? '#a9dcf0' : '#a7f3d0', emerald);
  const [fr, fg, fb] = [1, 3, 5].map((i) => parseInt(fresnel.slice(i, i + 2), 16));
  // the specular sits where the room's light comes from (upper left) and stays put as the sphere sways
  const specX = 33 - 3.2 * tilt;
  return (
    <>
      {haloK * fade > 0.003 ? (
        <div
          style={{
            position: 'absolute',
            left: x - halo / 2,
            top: y - halo / 2,
            width: halo,
            height: halo,
            background: bloom(glow, haloK * fade, { core: 0.5, coreSize: 0.5 }),
            mixBlendMode: 'screen',
          }}
        />
      ) : null}
      {rings}
      {/* rim light + contact shadow (screen space, so it is never scaled) */}
      {rimBox(ORB_RIM(rim, spread), rimIn * (1 - dress), 'rim0')}
      {rimBox(rimGlow(glow, Math.min(1, rim) * 0.8, (d / 400) * spread, { shadow: 0.8 }), rimIn * dress, 'rim1')}
      {/* the orb: one canvas, framed by transform only */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: base,
          height: base,
          transformOrigin: '50% 50%',
          transform: `translate(${(x - base / 2).toFixed(3)}px, ${(y - base / 2).toFixed(3)}px) scale(${k.toFixed(5)})`,
          opacity: fade < 0.999 ? fade : undefined,
        }}
      >
        <Orb size={base} palette={palA} paletteB={palB} mixB={listen} volume={volume} time={flow} resolution={1.25 * dpr()} />
        {grade > 0.001 ? (
          <>
            {/* the limb falls off (a sphere, not a plate) */}
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: limbBg(grade, limbRgb) }} />
            {/* a soft specular where the light comes from */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: `radial-gradient(26% 21% at ${specX.toFixed(2)}% 29%, rgba(255,255,255,${(0.15 * grade).toFixed(3)}) 0%, rgba(236,250,244,${(0.06 * grade).toFixed(3)}) 45%, rgba(236,250,244,0) 100%)`,
                mixBlendMode: 'screen',
              }}
            />
            {/* the Fresnel rim: a 1.5 px line of the light just inside the limb (screen px, in the scaled box) */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: (() => {
                  const R = d / 2;
                  const at = (px: number) => `${(100 * (1 - px / R)).toFixed(3)}%`;
                  return `radial-gradient(closest-side, rgba(${fr},${fg},${fb},0) ${at(4.5)}, rgba(${fr},${fg},${fb},${(0.42 * grade).toFixed(3)}) ${at(2)}, rgba(${fr},${fg},${fb},${(0.18 * grade).toFixed(3)}) ${at(0.8)}, rgba(${fr},${fg},${fb},0) 100%)`;
                })(),
                mixBlendMode: 'screen',
              }}
            />
          </>
        ) : null}
      </div>
    </>
  );
};

/* ── the figure pairs ─────────────────────────────────────────── */

/** paper, lit from above (the figures are objects in the room's light, not stickers) */
const FIGURE_FILL = 'linear-gradient(180deg, #f6f7f6 0%, #e4ebe7 58%, #c6d9cf 100%)';
const SWEEP = 'linear-gradient(100deg, rgba(255,255,255,0) 40%, rgba(255,255,255,0.85) 50%, rgba(255,255,255,0) 60%)';

const Pair: React.FC<{ digits: string; F: number; sheen: number }> = ({ digits, F, sheen }) => {
  const on = sheen > 0 && sheen < 1;
  return (
    <div
      style={{
        whiteSpace: 'nowrap',
        fontFamily: FONT.ui,
        fontWeight: TYPE.display.weightOnDark,
        fontSize: F,
        lineHeight: 1.1,
        letterSpacing: '-0.01em',
        fontVariantNumeric: 'tabular-nums',
        // a light sweep crosses the pair once as it lands (left → right)
        backgroundImage: on ? `${SWEEP}, ${FIGURE_FILL}` : FIGURE_FILL,
        backgroundSize: on ? '300% 100%, 100% 100%' : '100% 100%',
        backgroundPosition: on ? `${((1 - sheen) * 100).toFixed(2)}% 0, 0 0` : undefined,
        backgroundRepeat: 'no-repeat',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        color: 'transparent',
      }}
    >
      {digits}
    </div>
  );
};

/** The unfold: a soft spring out from behind the orb (≈ 3 % overshoot), no anticipation (it starts hidden). */
const UNFOLD = { stiffness: 190, damping: 19, mass: 1 };

/** The figure pairs around the orb's centre (x, y). Drawn BEHIND the orb (it hides them as they leave / return). */
export const Digits: React.FC<{
  t: number;
  x: number;
  y: number;
  /** the orb's diameter now (they keep their distance from its rim) */
  orbD: number;
  F: number;
  gap: number;
  /** frame they start to slide out */
  unfoldStart: number;
  /** frame they start to fold back into the orb */
  foldStart: number;
  sheens: readonly [number, number];
}> = ({ t, x, y, orbD, F, gap, unfoldStart, foldStart, sheens }) => {
  if (t < unfoldStart - 1) return null;
  const fold = tween(t, [foldStart, foldStart + 9], [0, 1], EASE.in2);
  if (fold >= 1) return null;
  const pairW = 1.2 * F;
  const reach = orbD / 2 + gap + pairW / 2; // pair centre distance at rest
  const unfold = springUnit(t - unfoldStart, UNFOLD);
  const off = reach * unfold * (1 - fold);
  // they are hidden behind the orb while they are inside it, so they are opaque from the start;
  // the fold's last frames fade them (by then the growing orb covers them)
  const op = smooth(unfoldStart - 1, unfoldStart + 1, t) * (1 - smooth(0.55, 1, fold));
  const box = (cx: number, digits: string, sheen: number) => (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: pairW,
        // the pair rides the orb's sway (a hair of vertical arc): on its own layer, so it moves in exact sub-pixels
        ...subpixel(`translate(${(cx - pairW / 2).toFixed(3)}px, ${(y - 0.55 * F).toFixed(3)}px)`, true),
        display: 'flex',
        justifyContent: 'center',
        opacity: op,
      }}
    >
      <Pair digits={digits} F={F} sheen={sheen} />
    </div>
  );
  return (
    <>
      {box(x - off, '03', sheens[0])}
      {box(x + off, '12', sheens[1])}
    </>
  );
};
