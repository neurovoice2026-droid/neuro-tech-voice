/**
 * The orb stage and the establishing lockup "03 ◉ 12".
 *
 * <OrbStage> — Ava's single WebGL orb (mounted once, never remounted: moved
 * and resized by transform only), its rim light, its light on the room, the
 * site's "wave" rings (whenever Ava starts a line) and the gulp ping. It is
 * drawn in screen coordinates from the orb's on-screen state, so it can be
 * re-framed per shot (establishing / Ava / caller).
 *
 * <Digits> — the figure pairs (Instrument Sans 440, the night `num` fill)
 * that spring OUT of the orb to both sides after the gulp, with a horizontal
 * smear scaled to their speed, and peel off sideways when the camera pushes
 * into Ava's close-up.
 */
import React from 'react';
import { Orb } from '../../components/Orb';
import { bloom, mixPalette, rgba, rimGlow, ring as waveRing, type Glow } from '../../lib/lights';
import { EASE, tween } from '../../lib/motion';
import { ORB_RIM } from '../../lib/pickup';
import { CLOCK_FILL, FONT, LIGHTS, type Palette } from '../../theme';

const RING_LIFE = 28.5; // 0.95 s
/** px / frame above which the orb is smeared (the brief: anything moving > ~25 px a frame) */
const SMEAR_FROM = 25;
/** the rim's sub-frame ghosts while it whips: [frames back, opacity] */
const GHOSTS = [
  [0.33, 0.4],
  [0.66, 0.22],
] as const;

/** power2.out */
const out2 = (u: number) => 1 - (1 - u) * (1 - u);

const SHEEN =
  'linear-gradient(100deg, rgba(255,255,255,0) 40%, rgba(255,255,255,0.9) 50%, rgba(255,255,255,0) 58%)';

export type OrbState = { x: number; y: number; d: number };

/**
 * The key light as a LIT SPHERE, not a clipped disc. The night palettes' paper-white top stop
 * (#f7f3ff) is rolled off to a lilac-white, so the hot zone keeps its gradation; over the canvas
 * (all in the orb's own scaled box) sit a limb darkening (mix(.72, 1, (n·v)^.6) as a radial
 * falloff), a soft specular where the shader's light comes from (upper left) and a 1.5 px
 * night-lilac Fresnel rim. All of it grades in with the room (`grade`), so the pickup's first
 * frames are still the twist's exact orb.
 */
const ORB_LIT: Palette = ['#14062b', '#4a1a9e', '#7c3aed', '#c4a8ff', '#e0d4ff'];
const LISTEN_LIT: Palette = ['#14062b', '#3a259c', '#5946d9', '#b4b4ff', '#d9daff'];
/** limb darkening: 1 − mix(.72, 1, (1 − r²)^.3) at r = stop (the dark is the deep end of the palette) */
const LIMB = [0, 0.5, 0.7, 0.8, 0.9, 0.95, 0.985, 1].map((r) => [r, 0.28 * (1 - Math.pow(Math.max(0, 1 - r * r), 0.3))] as const);
const limbBg = (k: number) =>
  `radial-gradient(closest-side, ${LIMB.map(([r, a]) => `rgba(12,5,32,${(a * k).toFixed(4)}) ${(r * 100).toFixed(1)}%`).join(', ')})`;

const Pair: React.FC<{ digits: string; F: number; blur: number; id: string; sheen: number }> = ({
  digits,
  F,
  blur,
  id,
  sheen,
}) => (
  <div style={{ display: 'flex', position: 'relative' }}>
    {blur > 0.4 ? (
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
        <defs>
          <filter id={id} x="-60%" y="-10%" width="220%" height="120%" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation={`${blur.toFixed(2)} 0`} />
          </filter>
        </defs>
      </svg>
    ) : null}
    <div style={{ display: 'flex', filter: blur > 0.4 ? `url(#${id})` : undefined }}>
      {digits.split('').map((d, i) => (
        <span
          key={i}
          style={{
            display: 'block',
            width: 0.6 * F,
            height: 1.1 * F,
            lineHeight: `${1.1 * F}px`,
            fontFamily: FONT.ui,
            fontWeight: 440,
            fontSize: F,
            fontVariantNumeric: 'tabular-nums',
            textAlign: 'center',
            // a light sweep crosses the pair once as it lands (left → right)
            backgroundImage: sheen > 0 && sheen < 1 ? `${SHEEN}, ${CLOCK_FILL}` : CLOCK_FILL,
            backgroundSize: sheen > 0 && sheen < 1 ? '300% 100%, 100% 100%' : '100% 100%',
            backgroundPosition:
              sheen > 0 && sheen < 1 ? `${((1 - Math.min(1, Math.max(0, sheen * 2 - i * 0.5))) * 100).toFixed(2)}% 0, 0 0` : undefined,
            backgroundRepeat: 'no-repeat',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            color: 'transparent',
            textShadow: 'none',
          }}
        >
          {d}
        </span>
      ))}
    </div>
  </div>
);

/** The figure pairs, in world coordinates around the orb's centre (x, y). */
export const Digits: React.FC<{
  t: number;
  x: number;
  y: number;
  orbD: number;
  F: number;
  gap: number;
  /** 0 → 1 (overshoots): pairs slide out from behind the orb */
  unfold: number;
  unfoldSpeed: number;
  unfoldStart: number;
  /** 0..1 the peel-out: 03 → −700, 12 → +700, blur → 14, fade */
  peel: number;
  peelSpeed: number;
  sheens: readonly [number, number];
}> = ({ t, x, y, orbD, F, gap, unfold, unfoldSpeed, unfoldStart, peel, peelSpeed, sheens }) => {
  if (t < unfoldStart - 4 || peel >= 1) return null;
  const pairW = 1.2 * F;
  const reach = orbD / 2 + gap + pairW / 2; // pair centre distance at rest
  const off = reach * unfold + 700 * peel;
  // opaque from the moment they start to move: at unfold ≈ 0 they sit hidden
  // behind the orb, so the slide itself reads (no pop-in halfway out)
  const op = tween(t, [unfoldStart - 3, unfoldStart], [0, 1], EASE.out3) * (1 - peel);
  const smear = Math.min(28, Math.abs(unfoldSpeed) * reach * 0.22 + peelSpeed * 700 * 0.12);
  const exit = peel > 0.005 ? `blur(${(14 * peel).toFixed(2)}px)` : undefined;
  return (
    <>
      <div style={{ position: 'absolute', left: x - off - pairW / 2, top: y - 0.55 * F, opacity: op, filter: exit }}>
        <Pair digits="03" F={F} blur={smear} id="call-smear-l" sheen={sheens[0]} />
      </div>
      <div style={{ position: 'absolute', left: x + off - pairW / 2, top: y - 0.55 * F, opacity: op, filter: exit }}>
        <Pair digits="12" F={F} blur={smear} id="call-smear-r" sheen={sheens[1]} />
      </div>
    </>
  );
};

/**
 * Ava's orb, on screen — the scene's KEY LIGHT. `base` is the canvas size
 * (the largest the orb ever gets, so it is never upscaled); every framing is
 * a transform of it. Its halo is a gaussian pool of its own light (violet
 * while Ava speaks, caller blue while the caller does: `glow`), its rim the
 * four-light rimGlow, its rings the night `wave`.
 */
export const OrbStage: React.FC<{
  t: number;
  base: number;
  orb: OrbState;
  /** the orb's on-screen state at a (sub)frame, for the rings */
  orbAt: (t: number) => OrbState;
  volume: number;
  flow: number;
  listen: number;
  /** rim light strength (pickupGlow + speech) */
  rim: number;
  /** 0..1 the orb's own light (halo) */
  dress: number;
  /** depth-of-field blur on the orb (px on screen) */
  dof: number;
  ringStarts: readonly number[];
  /** softer rings as each of Ava's phrases starts */
  phraseRings?: readonly number[];
  /** 0..1 the syllable follower of her voice: the light she gives off */
  light?: number;
  /** frame the orb swallows the big line: a tight, quick ping off its rim */
  gulp: number;
  /** 0..1 the rim/halo come up over the twist's orb (the room's cross-fade) */
  rimIn: number;
  /** the light's colours now (follows the orb's palette) */
  glow: Glow;
  /** 0..1+ a hit's extra light (pickup, gulp): the halo flares */
  flash?: number;
  /** 0..1 the lit-sphere grade (rolled-off highlight, limb, specular, Fresnel rim) */
  grade?: number;
  /** 0..1 the orb's own opacity (it is absorbed at the end of its dive into the mark) */
  fade?: number;
  /** frames back of the glow copies trailing the orb (its dive): [frames, opacity][] */
  trail?: readonly (readonly [number, number])[];
}> = ({ t, base, orb, orbAt, volume, flow, listen, rim, dress, dof, ringStarts, phraseRings = [], light = 0, gulp, rimIn, glow, flash = 0, grade = 0, fade = 1, trail = [] }) => {
  const { x, y, d } = orb;
  const lvl = Math.max(0, (volume - 0.12) / 0.7);

  /* ── motion: a swing whips the orb up to ≈ 200 px a frame. The canvas gets a
   * directional blur along its velocity (an SVG gaussian, never CameraMotionBlur),
   * its rim leaves sub-frame ghosts and its halo stretches along the path. ── */
  const oA = orbAt(t - 0.5);
  const oB = orbAt(t + 0.5);
  const vx = oB.x - oA.x;
  const vy = oB.y - oA.y;
  const speed = Math.hypot(vx, vy);
  const moving = speed > SMEAR_FROM;
  const smX = moving ? Math.min(36, Math.abs(vx) * 0.16) : 0;
  const smY = moving ? Math.min(36, Math.abs(vy) * 0.16) : 0;
  /** half-size of the box the smeared rim is drawn in (the rim's spill + the path) */
  const rimR = d * 1.25 + 120 + speed;

  /* ── rings (the night `wave`) ───────────────────────────────────── */
  const ringAt = (tt: number, start: number) => {
    const o = orbAt(tt);
    const u = Math.min(1, Math.max(0, (tt - start) / RING_LIFE));
    const e = out2(u);
    const dd = o.d * 1.85 * (0.54 + 0.46 * e) * 1.18;
    const born = tween(tt, [start, start + 1.5], [0, 1], EASE.out3);
    return { x: o.x, y: o.y, d: dd, op: 0.5 * born * (1 - e) };
  };
  const rings: React.ReactNode[] = [];
  const all = [...ringStarts.map((s) => ({ s, k: 1 })), ...phraseRings.map((s) => ({ s, k: 0.55 }))];
  all.forEach(({ s: start, k: strength }, i) => {
    if (t < start || t > start + RING_LIFE) return;
    const r0 = ringAt(t, start);
    const r = { ...r0, op: r0.op * strength };
    const prev = ringAt(t - 0.5, start);
    const speed = Math.abs(r.d - prev.d) * 2;
    // sub-frame copies while the ring is fast: a smear, not a comb
    const copies = speed > 10 ? [0.25, 0.5, 0.75] : [];
    const ring = (c: { x: number; y: number; d: number }, o: number, key: string) => (
      <div
        key={key}
        style={{
          position: 'absolute',
          left: c.x - c.d / 2,
          top: c.y - c.d / 2,
          width: c.d,
          height: c.d,
          borderRadius: '50%',
          border: `2px solid ${waveRing('night', 0.9)}`,
          boxShadow: `0 0 22px ${waveRing('night', 0.16)}, inset 0 0 22px ${waveRing('night', 0.12)}`,
          boxSizing: 'border-box',
          opacity: Math.min(1, o),
        }}
      />
    );
    copies.forEach((k, j) => rings.push(ring(ringAt(t - k, start), r.op * (0.45 - j * 0.12), `r${i}c${j}`)));
    rings.push(ring(r, r.op, `r${i}`));
  });

  /* ── the gulp: a tight ping off the rim (orb → 1.5×, 0.45 s, power2.out) ── */
  if (t >= gulp && t < gulp + 14) {
    const e = out2((t - gulp) / 14);
    const gd = d * (1.02 + 0.5 * e);
    rings.push(
      <div
        key="gulp"
        style={{
          position: 'absolute',
          left: x - gd / 2,
          top: y - gd / 2,
          width: gd,
          height: gd,
          borderRadius: '50%',
          boxShadow: `inset 0 0 0 ${(3 - 2 * e).toFixed(2)}px ${waveRing('night', 0.95)}, 0 0 ${(18 * (1 - e)).toFixed(1)}px ${rgba(glow.body, 0.5)}`,
          opacity: 0.85 * (1 - e) * tween(t, [gulp, gulp + 1], [0, 1], EASE.out3),
        }}
      />,
    );
  }

  // the halo: a pool of the orb's own light, hugging it (the room's wide spill is <KeyLight>)
  // (stretched along the path while it whips, trailing a little behind)
  const halo = d * (2.2 + lvl * 0.2 + light * 0.2 + 0.4 * flash);
  const haloW = halo + Math.abs(vx) * 0.9;
  const haloH = halo + Math.abs(vy) * 0.9;
  const haloK = dress * (0.55 + 0.25 * lvl + 0.4 * light) + 0.9 * flash;
  const k = d / base;
  // the rim: the pickup's ORB_RIM (= the twist's, so the cross-fade over the twist is exact) hands
  // over to the four-light rimGlow in the orb's current colour as the room dresses
  const spread = 1 + 1.2 * lvl;
  const rimBox = (shadow: string, op: number, key: string, at: OrbState = orb) =>
    op <= 0.002 ? null : (
      <div
        key={key}
        style={{
          position: 'absolute',
          left: at.x - at.d / 2,
          top: at.y - at.d / 2,
          width: at.d,
          height: at.d,
          borderRadius: '50%',
          boxShadow: shadow,
          opacity: op * fade,
          filter: dof > 0.1 ? `blur(${dof.toFixed(2)}px)` : undefined,
        }}
      />
    );
  return (
    <>
      {/* the glow copies trailing the orb on its dive (its own violet: never a grey dissolve) */}
      {trail.map(([dt, a], i) => {
        const g = orbAt(t - dt);
        const D = g.d * 1.2;
        return a <= 0.003 ? null : (
          <div
            key={`trail${i}`}
            style={{
              position: 'absolute',
              left: g.x - D / 2,
              top: g.y - D / 2,
              width: D,
              height: D,
              borderRadius: '50%',
              background: `radial-gradient(closest-side, ${rgba(glow.core, 0.75 * a)} 0%, ${rgba(glow.body, 0.6 * a)} 48%, ${rgba(glow.body, 0.18 * a)} 78%, ${rgba(glow.body, 0)} 100%)`,
              mixBlendMode: 'screen',
            }}
          />
        );
      })}
      {/* the orb's light around it, then the rings */}
      {haloK * fade > 0.003 ? (
        <div
          style={{
            position: 'absolute',
            left: x - vx * 0.25 - haloW / 2,
            top: y - vy * 0.25 - haloH / 2,
            width: haloW,
            height: haloH,
            background: bloom(glow, haloK * fade * (halo / Math.sqrt(haloW * haloH)), { core: 0.55, coreSize: 0.5 }),
            mixBlendMode: 'screen',
          }}
        />
      ) : null}
      {rings}
      {/* rim light + contact shadow (screen space, so it is never scaled) */}
      {rimBox(ORB_RIM(rim, spread), rimIn * (1 - dress), 'rim0')}
      {moving ? (
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
          <defs>
            <filter id="call-orb-smear" x="-45%" y="-45%" width="190%" height="190%" colorInterpolationFilters="sRGB">
              <feGaussianBlur stdDeviation={`${(smX / k).toFixed(2)} ${(smY / k).toFixed(2)}`} />
            </filter>
            <filter id="call-rim-smear" x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
              <feGaussianBlur stdDeviation={`${smX.toFixed(2)} ${smY.toFixed(2)}`} />
            </filter>
          </defs>
        </svg>
      ) : null}
      {moving ? (
        /* the rim and its sub-frame ghosts, smeared along the path like the canvas (a blur, not a strobe) */
        <div style={{ position: 'absolute', left: x - rimR, top: y - rimR, width: 2 * rimR, height: 2 * rimR, filter: 'url(#call-rim-smear)' }}>
          {/* (a box round the orb only, so the filter never runs over the whole frame) */}
          <div style={{ position: 'absolute', left: rimR - x, top: rimR - y }}>
            {GHOSTS.map(([dt, a], i) => {
              const g = orbAt(t - dt);
              return rimBox(rimGlow(glow, Math.min(1, rim), (g.d / 400) * spread, { shadow: 0 }), a * rimIn * dress, `rimg${i}`, g);
            })}
            {rimBox(rimGlow(glow, Math.min(1, rim), (d / 400) * spread, { shadow: 1 }), rimIn * dress, 'rim1')}
          </div>
        </div>
      ) : (
        rimBox(rimGlow(glow, Math.min(1, rim), (d / 400) * spread, { shadow: 1 }), rimIn * dress, 'rim1')
      )}
      {/* the orb: one canvas, framed by transform only */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: base,
          height: base,
          transformOrigin: '50% 50%',
          transform: `translate(${(x - base / 2).toFixed(2)}px, ${(y - base / 2).toFixed(2)}px) scale(${k.toFixed(5)})`,
          opacity: fade < 0.999 ? fade : undefined,
          // the blur is set in the orb's own (scaled) space
          filter:
            [moving ? 'url(#call-orb-smear)' : '', dof > 0.1 ? `blur(${(dof / k).toFixed(2)}px)` : ''].filter(Boolean).join(' ') ||
            undefined,
        }}
      >
        <Orb
          size={base}
          palette={grade > 0.001 ? mixPalette(LIGHTS.night.orb, ORB_LIT, grade) : LIGHTS.night.orb}
          paletteB={grade > 0.001 ? mixPalette(LIGHTS.night.listen, LISTEN_LIT, grade) : LIGHTS.night.listen}
          mixB={listen}
          volume={volume}
          time={flow}
          resolution={1.25}
        />
        {grade > 0.001 ? (
          <>
            {/* the limb falls off (a sphere, not a plate) */}
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: limbBg(grade) }} />
            {/* a soft specular where the light comes from */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: `radial-gradient(26% 21% at 33% 29%, rgba(255,252,255,${(0.2 * grade).toFixed(3)}) 0%, rgba(240,232,255,${(0.08 * grade).toFixed(3)}) 45%, rgba(240,232,255,0) 100%)`,
                mixBlendMode: 'screen',
              }}
            />
            {/* the Fresnel rim: a 1.5 px night-lilac line just inside the limb (screen px, in the scaled box) */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: (() => {
                  const R = d / 2;
                  const at = (px: number) => `${(100 * (1 - px / R)).toFixed(3)}%`;
                  return `radial-gradient(closest-side, rgba(185,163,255,0) ${at(4.5)}, rgba(185,163,255,${(0.5 * grade).toFixed(3)}) ${at(2)}, rgba(185,163,255,${(0.22 * grade).toFixed(3)}) ${at(0.8)}, rgba(185,163,255,0) 100%)`;
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
