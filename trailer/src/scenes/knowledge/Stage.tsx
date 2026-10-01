/**
 * The stage itself: the site's #knowledge room on the white stock, bled to
 * the frame edges — a PAPER ROOM lit by one light, the reader's Sunday light.
 *
 *   wall      a cool paper grey in the corners, opening to white where the
 *             light falls (a softbox's Lambert falloff — depth, not a wash)
 *   light     the orb is the key: a soft aqua pool on the wall around it,
 *             in the light's own colour (teal → the caller's blue while they
 *             speak → drained to a cool grey on the miss → teal again when Ava
 *             answers). Multiplied into the paper like a coloured light, with a
 *             physical falloff: no edge, no blob, no disc.
 *   dawn      (the match cut on light) the result's white flash gathers into a
 *             seed of Sunday light at the reader's place and blooms ON the hit
 *   eyebrow   ● KNOWLEDGE BASE (the site's CornerDot eyebrow, TYPE.label in sunday ink)
 *
 * Every layer is a many-stop gradient sampled from a smooth curve (the film
 * grain dithers it): nothing can band, nothing pops.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { CornerDot, Reveal } from '../../components/Type';
import { Vignette2 } from '../../components/Atmosphere';
import { Grain } from '../../components/Grain';
import { hexToRgb, rgba } from '../../lib/lights';
import { EASE, mix, SPRING, tween } from '../../lib/motion';
import { typeStyle } from '../../lib/type';
import { KNOWLEDGE, KNOWLEDGE_LOCAL } from '../../timing';
import { flashAt } from './pulse';
import { INK, SUN_GLOW, type Geo } from './geometry';
import { glowAt, greyAt, relitAt } from './light';

const K = KNOWLEDGE;
const KL = KNOWLEDGE_LOCAL;

/** 0 → 1 as the white flash becomes the stage (t 0 is the hit) */
export const stageIn = (t: number) => tween(t, KL.stageIn, [0, 1], EASE.house);

/** the dawn's strength: gathers over the result's last white frames (an accelerating inhale),
 *  peaks ON the hit, then hands over to the stage's own light */
export function dawnAt(t: number) {
  const [a, b] = KL.dawn;
  if (t < a - 1) return 0;
  if (t <= b) {
    const u = (t - (a - 1)) / (b - (a - 1));
    return u * u;
  }
  return Math.exp(-(t - b) / 5.5);
}

/* ── light maths (the same model as components/Atmosphere.tsx) ───── */

const lambert = (u: number) => Math.pow(1 + u * u, -1.5);
const smoothstep = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};
const rgbOf = (hex: string) => hexToRgb(hex).map((c) => Math.round(c * 255));
const rgbaOf = (rgb: readonly number[], a: number) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${Math.max(0, a).toFixed(4)})`;

/** stops for a light pool: alpha(u) = strength · lambert(u)^gamma, tapered to exactly 0 at the edge */
function lightStops(rgb: readonly number[], strength: number, extent: number, gamma: number, n = 26): string {
  const out: string[] = [];
  for (let i = 0; i <= n; i++) {
    const f = Math.pow(i / n, 1.35);
    const taper = 1 - smoothstep(0.62, 1, f);
    out.push(`${rgbaOf(rgb, strength * Math.pow(lambert(f * extent), gamma) * taper)} ${(f * 100).toFixed(2)}%`);
  }
  return out.join(', ');
}

/** the wall in shade (corners) and lit (at the light) — a cool paper, never a tinted one */
const WALL = '#e9ecee';
const LIT = [255, 255, 255] as const;
/** the wall's dither (overlay grain opacity) */
const PAPER_DITHER = 0.5;

/** the Sunday light's strength on the wall at t (multiply alpha at its centre) */
function tintAt(t: number) {
  const grey = greyAt(t);
  // it swells as the orb lands and as Ava's light comes back; it drains on the miss
  const swell = 0.45 * flashAt(t, KL.orbIn + 3, 9) + 0.5 * flashAt(t, KL.relight[0] + 2, 12) * relitAt(t);
  // before the orb, the light is the heading's (the dawn's settle): a touch quieter; once the orb has
  // folded away (the recede) its light lingers, lower, under the closing line
  const orb = tween(t, [KL.orbIn - 2, KL.orbIn + 10], [0.75, 1], EASE.inOut);
  const gone = 1 - 0.4 * tween(t, [KL.recede[0], KL.recede[1] + 8], [0, 1], EASE.inOut);
  return 0.24 * orb * gone * (1 + swell) * (1 - 0.55 * grey);
}

/**
 * Plane 0.3: the room. `G.panel` bleeds past the frame (the camera's push never shows an edge);
 * the stage-in scales it 1.035 → 1 about the reader as it comes up out of the white. It does not
 * whip: under the whip its shading goes to clean white (the scale's room comes up out of white),
 * so no panel edge is ever seen.
 */
export const Room: React.FC<{ t: number; G: Geo }> = ({ t, G }) => {
  // in out of the white flash; out to clean white under the whip (the scale's room comes up out of white)
  const p = stageIn(t) * (1 - tween(t, [KL.whip[0] - 3, KL.whip[0] + 8], [0, 1], EASE.inOut));
  const P = G.panel;
  const W = P.w;
  const H = P.h;
  // the light sits on the reader (panel coordinates)
  const lx = G.orb.x - P.x;
  const ly = G.orb.y - P.y;
  const far = Math.max(Math.hypot(lx, ly), Math.hypot(W - lx, ly), Math.hypot(lx, H - ly), Math.hypot(W - lx, H - ly)) * 1.06;

  // the white: a big soft source, so the corners fall to the cool paper (depth, not a vignette ring)
  const hW = G.v ? 1.15 * W : 0.6 * W;
  const aW = G.v ? 0.85 : 1.3;
  // the Sunday light: a tighter pool round the orb, in its colour now
  const glow = glowAt(t);
  const tint = tintAt(t);
  const hT = G.v ? 330 : 380;
  const aT = G.v ? 0.95 : 1.2;
  const sc = mix(1.035, 1, stageIn(t));
  return (
    <AbsoluteFill style={{ opacity: p }}>
      <div
        style={{
          position: 'absolute',
          left: P.x,
          top: P.y,
          width: W,
          height: H,
          background: WALL,
          overflow: 'hidden',
          transform: sc !== 1 ? `scale(${sc.toFixed(5)})` : undefined,
          transformOrigin: `${lx}px ${ly}px`,
        }}
      >
        <AbsoluteFill
          style={{
            background: `radial-gradient(${(far * aW).toFixed(1)}px ${far.toFixed(1)}px at ${lx.toFixed(1)}px ${ly.toFixed(1)}px, ${lightStops(LIT, 1, far / hW, 0.85)}, transparent)`,
          }}
        />
        {tint > 0.001 ? (
          <AbsoluteFill
            style={{
              background: `radial-gradient(${(far * aT).toFixed(1)}px ${far.toFixed(1)}px at ${lx.toFixed(1)}px ${ly.toFixed(1)}px, ${lightStops(rgbOf(glow.body), tint, far / hT, 1.5, 34)}, transparent)`,
              mixBlendMode: 'multiply',
            }}
          />
        ) : null}
        <Vignette2 strength={0.06} rgb={[38, 52, 60]} at={`${((lx / W) * 100).toFixed(1)}% ${((ly / H) * 100).toFixed(1)}%`} />
        {/* the paper's tooth: a fine overlay grain on the wall only (under every card and word). On near-white
         *  overlay scales with the distance from white, so pure white stays white — it dithers the light's
         *  smooth falloff so no 1-level contour can survive the encode as a ring */}
        <Grain opacity={PAPER_DITHER} blend="overlay" seed="kbpaper" />
      </div>
    </AbsoluteFill>
  );
};

/** gradient stops for a gaussian falloff (fraction of the radius) */
const GAUSS = [0, 0.08, 0.16, 0.24, 0.32, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];

/**
 * The match cut on light. The result's booked event blooms to white from its
 * ember centre; over its last white frames (pre-roll, t < 0) that centre
 * gathers into a seed of SUNDAY light — aqua (#a5eaf5), teal at its edge —
 * that drifts to the reader's place, blooms ON the hit (t 0, with the white
 * hit and the Sunday chime) and settles into the room's own light as the
 * room comes up out of it. Two gaussians (each falls off monotonically, so
 * their sum can never ring): light on the white stock, never a disc.
 */
export const Dawn: React.FC<{ t: number; G: Geo }> = ({ t, G }) => {
  const k = dawnAt(t);
  if (k < 0.004) return null;
  const [a] = KL.dawn;
  const m = tween(t, [a, 4], [0, 1], EASE.inOut);
  const x = mix(G.dawn.x0, G.orb.x, m);
  const y = mix(G.dawn.y0, G.orb.y, m);
  // the seed opens out as it gathers (inhale) and is widest just after the hit
  const D = (G.v ? 1500 : 1700) * (0.22 + 0.78 * EASE.out3(Math.min(1, (t - (a - 1)) / 8)));
  const pool = (hex: string, peak: number, w: number) =>
    `radial-gradient(closest-side, ${GAUSS.map((r) => `${rgba(hex, Math.min(1, peak * k * Math.exp(-((r / w) ** 2))))} ${(r * 100).toFixed(0)}%`).join(', ')})`;
  return (
    <div
      style={{
        position: 'absolute',
        left: x - D / 2,
        top: y - D / 2,
        width: D,
        height: D,
        background: `${pool(SUN_GLOW.core, 0.62, 0.32)}, ${pool(SUN_GLOW.body, 0.09, 0.56)}`,
      }}
    />
  );
};

/** The eyebrow: the CornerDot turns in, "KNOWLEDGE BASE" (TYPE.label, sunday ink) rises out of its mask. */
export const Eyebrow: React.FC<{ t: number; G: Geo }> = ({ t, G }) => {
  const T = G.top;
  const d0 = KL.eyebrowDot;
  if (t < d0 - 1) return null;
  // the dot: a soft spring scale + a quarter turn (no ring, no flash)
  const dp = Math.min(1.02, Math.max(0, tween(t, [d0, d0 + 9], [0, 1], EASE.out3)));
  return (
    <div
      style={{
        position: 'absolute',
        left: T.eyebrowX,
        top: T.y,
        transform: 'translateY(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        color: INK,
        ...typeStyle('label', G.v, { tone: 'paper', size: T.label }),
        whiteSpace: 'nowrap',
      }}
    >
      <div
        style={{
          transform: dp < 1 ? `scale(${(0.4 + 0.6 * dp).toFixed(4)}) rotate(${((1 - dp) * -90).toFixed(2)}deg)` : undefined,
          opacity: Math.min(1, dp * 1.6),
        }}
      >
        <CornerDot size={T.dot} color={INK} />
      </div>
      <Reveal t={t} start={K.heading + 1} config={SPRING.text} rise={100}>
        Knowledge base
      </Reveal>
    </div>
  );
};
