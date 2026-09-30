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
import { EASE, tween } from '../../lib/motion';
import { ORB_RIM } from '../../lib/pickup';
import { CLOCK_FILL, FONT, ORB } from '../../theme';

const WAVE = '185,163,255';
const ELECTRIC = '124,58,237';
const RING_LIFE = 28.5; // 0.95 s

/** power2.out */
const out2 = (u: number) => 1 - (1 - u) * (1 - u);

const SHEEN =
  'linear-gradient(100deg, rgba(255,255,255,0) 40%, rgba(255,255,255,0.9) 50%, rgba(255,255,255,0) 58%)';

export type OrbState = { x: number; y: number; d: number };

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
 * Ava's orb, on screen. `base` is the canvas size (the largest the orb ever
 * gets, so it is never upscaled); every framing is a transform of it.
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
  /** frame the orb swallows the big line: a tight, quick electric ping off its rim */
  gulp: number;
  /** 0..1 the rim/halo come up over the twist's orb (the room's cross-fade) */
  rimIn: number;
}> = ({ t, base, orb, orbAt, volume, flow, listen, rim, dress, dof, ringStarts, gulp, rimIn }) => {
  const { x, y, d } = orb;
  const lvl = Math.max(0, (volume - 0.12) / 0.7);

  /* ── rings ─────────────────────────────────────────────────────── */
  const ringAt = (tt: number, start: number) => {
    const o = orbAt(tt);
    const u = Math.min(1, Math.max(0, (tt - start) / RING_LIFE));
    const e = out2(u);
    const dd = o.d * 1.85 * (0.54 + 0.46 * e) * 1.18;
    const born = tween(tt, [start, start + 1.5], [0, 1], EASE.out3);
    return { x: o.x, y: o.y, d: dd, op: 0.5 * born * (1 - e) };
  };
  const rings: React.ReactNode[] = [];
  ringStarts.forEach((start, i) => {
    if (t < start || t > start + RING_LIFE) return;
    const r = ringAt(t, start);
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
          border: `2px solid rgba(${WAVE},0.9)`,
          boxShadow: `0 0 22px rgba(${WAVE},0.16), inset 0 0 22px rgba(${WAVE},0.12)`,
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
          boxShadow: `inset 0 0 0 ${(3 - 2 * e).toFixed(2)}px rgba(${WAVE},0.95), 0 0 ${(18 * (1 - e)).toFixed(1)}px rgba(${ELECTRIC},0.5)`,
          opacity: 0.85 * (1 - e) * tween(t, [gulp, gulp + 1], [0, 1], EASE.out3),
        }}
      />,
    );
  }

  const halo = d * (3.2 + lvl * 0.5);
  const k = d / base;
  return (
    <>
      {/* the orb's light around it, then the rings */}
      <div
        style={{
          position: 'absolute',
          left: x - halo / 2,
          top: y - halo / 2,
          width: halo,
          height: halo,
          borderRadius: '50%',
          background: `radial-gradient(closest-side, rgba(${ELECTRIC},${(0.36 + 0.3 * lvl).toFixed(3)}) 0%, rgba(${ELECTRIC},${(0.12 + 0.1 * lvl).toFixed(3)}) 45%, rgba(${ELECTRIC},0) 100%)`,
          opacity: dress,
        }}
      />
      {rings}
      {/* rim light + contact shadow (screen space, so it is never scaled) */}
      <div
        style={{
          position: 'absolute',
          left: x - d / 2,
          top: y - d / 2,
          width: d,
          height: d,
          borderRadius: '50%',
          boxShadow: ORB_RIM(rim, 1 + 1.2 * lvl),
          opacity: rimIn,
          filter: dof > 0.1 ? `blur(${dof.toFixed(2)}px)` : undefined,
        }}
      />
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
          // the blur is set in the orb's own (scaled) space
          filter: dof > 0.1 ? `blur(${(dof / k).toFixed(2)}px)` : undefined,
        }}
      >
        <Orb size={base} palette={ORB.ink} paletteB={ORB.listen} mixB={listen} volume={volume} time={flow} resolution={1.25} />
      </div>
    </>
  );
};
