/**
 * The #demo clock lockup at film scale, "03 ◉ 12": Ava's WebGL orb is the
 * colon; the figure pairs (Instrument Sans 440, the night `num` fill) slide
 * out from behind it to both sides on a spring, with a horizontal smear
 * (SVG feGaussianBlur "σ 0") scaled to their speed. The site's "wave"
 * rings leave the orb whenever Ava starts a line.
 *
 * Stacking as on the site: rings z0, figures z10, orb z20.
 */
import React from 'react';
import { Orb } from '../../components/Orb';
import { EASE, tween } from '../../lib/motion';
import { CLOCK_FILL, FONT, ORB } from '../../theme';

const WAVE = '185,163,255';
const ELECTRIC = '124,58,237';
const RING_LIFE = 28.5; // 0.95 s

/** power2.out */
const out2 = (u: number) => 1 - (1 - u) * (1 - u);

const SHEEN =
  'linear-gradient(100deg, rgba(255,255,255,0) 40%, rgba(255,255,255,0.9) 50%, rgba(255,255,255,0) 58%)';

const Pair: React.FC<{ digits: string; F: number; blur: number; id: string; opacity: number; sheen: number }> = ({
  digits,
  F,
  blur,
  id,
  opacity,
  sheen,
}) => (
  <div style={{ display: 'flex', opacity, position: 'relative' }}>
    {blur > 0.4 ? (
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
        <defs>
          <filter id={id} x="-40%" y="-10%" width="180%" height="120%" colorInterpolationFilters="sRGB">
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
          }}
        >
          {d}
        </span>
      ))}
    </div>
  </div>
);

export const Lockup: React.FC<{
  t: number;
  /** orb centre (lockup centre) */
  x: number;
  y: number;
  /** canvas size (the hand-off diameter) and its CSS scale now */
  orbBase: number;
  orbScale: number;
  /** orb diameter the lockup is laid out for (final) */
  orbFinal: number;
  F: number;
  gap: number;
  /** 0 → 1 (overshoots): pairs slide out from behind the orb */
  unfold: number;
  unfoldSpeed: number; // unfold units per frame
  volume: number;
  flow: number;
  listen: number;
  ringStarts: readonly number[];
  /** diameter of the orb at a (sub)frame, for ring birth size */
  orbDAt: (t: number) => number;
  opacity: number;
  /** exit blur (px) on the figures / rings; the orb takes 80 % of it */
  blur: number;
  /** 0..1 the orb's own light (halo + glow): 0 while it is still the twist's avatar */
  dress: number;
  /** light sweep progress per pair (left, right) */
  sheens: readonly [number, number];
  /** frame the pairs start to unfold (they become opaque behind the orb just before) */
  unfoldStart?: number;
  /** frame the orb swallows the big line: a tight, quick electric ping off its rim */
  gulp?: number;
}> = ({
  t,
  x,
  y,
  orbBase,
  orbScale,
  orbFinal,
  F,
  gap,
  unfold,
  unfoldSpeed,
  volume,
  flow,
  listen,
  ringStarts,
  orbDAt,
  opacity,
  blur,
  dress,
  sheens,
  unfoldStart,
  gulp,
}) => {
  const pairW = 1.2 * F;
  const reach = orbFinal / 2 + gap + pairW / 2; // pair centre distance at rest
  const off = reach * unfold;
  // the pairs are opaque from the moment they start to move: at unfold ≈ 0 they sit
  // hidden behind the orb, so the slide itself reads (no pop-in halfway out)
  const pairOp = (unfoldStart === undefined ? 1 : tween(t, [unfoldStart - 3, unfoldStart], [0, 1], EASE.out3)) * opacity;
  const smear = Math.min(22, Math.abs(unfoldSpeed) * reach * 0.22);
  const orbD = orbBase * orbScale;
  const lvl = Math.max(0, (volume - 0.12) / 0.7);

  /* ── rings ─────────────────────────────────────────────────────── */
  const ringAt = (tt: number, start: number) => {
    const u = Math.min(1, Math.max(0, (tt - start) / RING_LIFE));
    const e = out2(u);
    const d = orbDAt(tt) * 1.85 * (0.54 + 0.46 * e) * 1.18;
    const born = tween(tt, [start, start + 1.5], [0, 1], EASE.out3);
    return { d, op: 0.5 * born * (1 - e) };
  };
  const rings: React.ReactNode[] = [];
  ringStarts.forEach((start, i) => {
    if (t < start || t > start + RING_LIFE) return;
    const r = ringAt(t, start);
    const prev = ringAt(t - 0.5, start);
    const speed = Math.abs(r.d - prev.d) * 2;
    const copies = speed > 10 ? [0.25, 0.5, 0.75] : [];
    const ring = (d: number, o: number, key: string) => (
      <div
        key={key}
        style={{
          position: 'absolute',
          left: x - d / 2,
          top: y - d / 2,
          width: d,
          height: d,
          borderRadius: '50%',
          border: `2px solid rgba(${WAVE},0.9)`,
          boxShadow: `0 0 22px rgba(${WAVE},0.16), inset 0 0 22px rgba(${WAVE},0.12)`,
          boxSizing: 'border-box',
          opacity: Math.min(1, o) * opacity,
        }}
      />
    );
    copies.forEach((k, j) => {
      const c = ringAt(t - k, start);
      rings.push(ring(c.d, r.op * (0.45 - j * 0.12), `r${i}c${j}`));
    });
    rings.push(ring(r.d, r.op, `r${i}`));
  });

  /* ── the gulp: a tight ping off the rim (orb → 1.5×, 0.45 s, power2.out) ── */
  if (gulp !== undefined && t >= gulp && t < gulp + 14) {
    const u = (t - gulp) / 14;
    const e = out2(u);
    const d = orbD * (1.02 + 0.5 * e);
    rings.push(
      <div
        key="gulp"
        style={{
          position: 'absolute',
          left: x - d / 2,
          top: y - d / 2,
          width: d,
          height: d,
          borderRadius: '50%',
          boxShadow: `inset 0 0 0 ${(3 - 2 * e).toFixed(2)}px rgba(${WAVE},0.95), 0 0 ${(18 * (1 - e)).toFixed(1)}px rgba(${ELECTRIC},0.5)`,
          opacity: 0.85 * (1 - e) * tween(t, [gulp, gulp + 1], [0, 1], EASE.out3) * opacity,
        }}
      />,
    );
  }

  const halo = orbD * (3.2 + lvl * 0.5);
  const exitFilter = blur > 0.1 ? `blur(${blur.toFixed(2)}px)` : undefined;

  return (
    <>
      {/* z0 — the orb's light on the room, then the rings */}
      <div
        style={{
          position: 'absolute',
          left: x - halo / 2,
          top: y - halo / 2,
          width: halo,
          height: halo,
          borderRadius: '50%',
          background: `radial-gradient(closest-side, rgba(${ELECTRIC},${(0.36 + 0.3 * lvl).toFixed(3)}) 0%, rgba(${ELECTRIC},${(0.12 + 0.1 * lvl).toFixed(3)}) 45%, rgba(${ELECTRIC},0) 100%)`,
          opacity: opacity * dress,
        }}
      />
      <div style={{ position: 'absolute', inset: 0, filter: exitFilter }}>{rings}</div>

      {/* z10 — the figure pairs */}
      {pairOp > 0.002 ? (
        <>
          <div
            style={{
              position: 'absolute',
              left: x - off - pairW / 2,
              top: y - 0.55 * F,
              filter: exitFilter,
            }}
          >
            <Pair digits="03" F={F} blur={smear} id="call-smear-l" opacity={pairOp} sheen={sheens[0]} />
          </div>
          <div
            style={{
              position: 'absolute',
              left: x + off - pairW / 2,
              top: y - 0.55 * F,
              filter: exitFilter,
            }}
          >
            <Pair digits="12" F={F} blur={smear} id="call-smear-r" opacity={pairOp} sheen={sheens[1]} />
          </div>
        </>
      ) : null}

      {/* z20 — the orb */}
      <div
        style={{
          position: 'absolute',
          left: x - orbBase / 2,
          top: y - orbBase / 2,
          width: orbBase,
          height: orbBase,
          transform: `scale(${orbScale.toFixed(5)})`,
          opacity,
          // the rack focus takes the orb too (one small element — cheap)
          filter: blur > 0.1 ? `blur(${(blur * 0.8).toFixed(2)}px)` : undefined,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            boxShadow: `0 0 ${(26 + 30 * lvl).toFixed(1)}px ${(2 + 6 * lvl).toFixed(1)}px rgba(${WAVE},${(0.28 + 0.25 * lvl).toFixed(3)}), 0 30px 60px -20px rgba(8,6,28,0.7)`,
            opacity: dress,
          }}
        />
        <Orb size={orbBase} palette={ORB.ink} paletteB={ORB.listen} mixB={listen} volume={volume} time={flow} />
      </div>
    </>
  );
};
