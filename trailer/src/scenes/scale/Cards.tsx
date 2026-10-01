/**
 * The white cards of the white act (site: white, radius 21.6, SHADOW.card
 * plus a long soft drop), and what goes inside them: an industry (lucide
 * icon + label) or a language (label + the greeting in the cinema face,
 * the AI phrase big with the site's electric underline).
 */
import React from 'react';
import { random } from 'remotion';
import { C, FONT, LIGHTS, R, TRACK, type LightId } from '../../theme';
import { bloom, mixColor } from '../../lib/lights';
import { EASE, tween } from '../../lib/motion';
import { MeshOrb } from '../../components/MeshOrb';
import { discHot, discRest, litFill, rgba } from './lights';
import type { Industry, Lang, Setting } from './data';
import { underlined } from './data';
import type { Rect } from './geometry';
import { dspring } from './curves';

/** SHADOW.card + a long soft drop; `lift` 0..1 deepens it, `alpha` fades it */
export function cardShadow(lift = 0, alpha = 1): string {
  const l = Math.max(0, lift);
  const a = (x: number) => (x * alpha).toFixed(3);
  return (
    `0 0 0 1px rgb(24 16 40 / ${a(0.06)}), ` +
    `0 ${(14 + 10 * l).toFixed(1)}px ${(30 + 14 * l).toFixed(1)}px -20px rgb(24 16 40 / ${a(0.35 + 0.08 * l)}), ` +
    `0 ${(24 + 16 * l).toFixed(1)}px ${(48 + 24 * l).toFixed(1)}px -28px rgba(24,16,40,${a(0.25)})`
  );
}

export const Box: React.FC<{
  r: Rect;
  transform?: string;
  opacity?: number;
  lift?: number;
  shadowAlpha?: number;
  children?: React.ReactNode;
  radius?: number;
  bg?: string;
  z?: number;
  /** CSS filter (blur / a DirBlur url) */
  filter?: string;
  /** a 2 px ring inside the card (the live language cell) */
  ring?: string;
  origin?: string;
}> = ({ r, transform, opacity = 1, lift = 0, shadowAlpha = 1, children, radius = R.x2, bg = C.white, z, filter, ring, origin }) =>
  opacity <= 0.004 ? null : (
    <div
      style={{
        position: 'absolute',
        left: r.x,
        top: r.y,
        width: r.w,
        height: r.h,
        borderRadius: radius,
        background: bg,
        boxShadow: cardShadow(lift, shadowAlpha) + (ring ? `, inset 0 0 0 2px ${ring}` : ''),
        transform,
        transformOrigin: origin,
        opacity: opacity < 0.999 ? opacity : undefined,
        filter,
        overflow: 'hidden',
        zIndex: z,
      }}
    >
      {children}
    </div>
  );

/** the card fill on a pop: the card's light (its pale tint) on the tick, back to white over 4 f */
export const popFill = (t: number, tick: number, light: LightId = 'night', amount = 1) => {
  if (t < tick) return C.white;
  return litFill(light, amount * (1 - tween(t, [tick, tick + 4], [0, 1], EASE.out3)));
};

/** 1 on frame `a`, back to 0 by a + dur (EASE.out3); 0 before */
export const flashAt = (t: number, a: number | undefined, dur = 6) =>
  a === undefined || t < a ? 0 : 1 - tween(t, [a, a + dur], [0, 1], EASE.out3);

/**
 * The hit's accents around a point, in a light: a ripple ring that leaves
 * the disc and a burst of short radial sparks (9 f, EASE.out3). Clipped by
 * the card, so it reads as a ripple across the card's surface.
 */
export const HitBurst: React.FC<{ t: number; at: number; cx: number; cy: number; r: number; light: LightId; seed: string; n?: number }> = ({
  t,
  at,
  cx,
  cy,
  r,
  light,
  seed,
  n = 7,
}) => {
  if (t < at || t > at + 11) return null;
  const o = LIGHTS[light].orb;
  const p = tween(t, [at, at + 11], [0, 1], EASE.out3);
  const q = tween(t, [at, at + 9], [0, 1], EASE.out3);
  const R = r * (1 + 1.6 * p);
  const rot0 = random(`scale-spark-${seed}`) * 360;
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: cx - R,
          top: cy - R,
          width: 2 * R,
          height: 2 * R,
          borderRadius: '50%',
          boxShadow: `inset 0 0 0 ${(1 + 3.5 * (1 - p)).toFixed(2)}px ${rgba(o[2], 0.75 * (1 - p) * (1 - p))}, 0 0 ${(18 * (1 - p)).toFixed(1)}px ${rgba(o[3], 0.6 * (1 - p))}`,
        }}
      />
      {q < 1
        ? Array.from({ length: n }, (_, j) => {
            const a = rot0 + (j * 360) / n + (random(`scale-spark-${seed}-${j}`) - 0.5) * 22;
            const d0 = r * 1.08;
            const d = d0 + r * (0.5 + 0.35 * random(`scale-spark-d-${seed}-${j}`)) * q;
            const len = Math.max(3, r * 0.26 * (1 - q) + 3);
            const w = Math.max(2, r * 0.07);
            return (
              <div
                key={j}
                style={{
                  position: 'absolute',
                  left: cx - w / 2,
                  top: cy - d - len,
                  width: w,
                  height: len,
                  borderRadius: w,
                  background: `linear-gradient(to top, ${rgba(o[2], 0)}, ${o[2]} 55%, ${o[3]})`,
                  opacity: (1 - q) ** 1.4,
                  transform: `rotate(${a.toFixed(2)}deg)`,
                  transformOrigin: `50% ${(d + len).toFixed(2)}px`,
                }}
              />
            );
          })
        : null}
    </>
  );
};

/**
 * An industry card's face: the lucide icon on its light's disc (top-left)
 * and its label (bottom-left, ink). On the tick the disc lights (the
 * light's key-dot gradient, the icon white, a bloom), a ripple and sparks
 * leave it, and it settles back to the pale disc + ink icon by +6.
 */
export const IndustryFace: React.FC<{
  d: Industry;
  t: number;
  /** the pop's start frame (content motion) */
  at: number;
  /** the tick frame (the hit) */
  tick: number;
  pad: number;
  iconSize: number;
  labelSize: number;
  light: LightId;
  /** the hero's unison flash: every disc lights on this frame (the wall "locks") */
  lockAt?: number;
  /** …in this light (one light for the whole wall) */
  lockLight?: LightId;
  /** the quarter-note pulse: the discs already on the wall light (0.7) on these frames… */
  beats?: readonly number[];
  /** …each in the NEW hour's light (beats[j] → beatLights[j]) */
  beatLights?: readonly LightId[];
  /** static: no inner motion (flyers, glides) */
  still?: boolean;
  /** the tick's ripple + sparks (off for ghost copies) */
  accents?: boolean;
}> = ({ d, t, at, tick, pad, iconSize, labelSize, light: own, lockAt, lockLight, beats, beatLights, still = false, accents = true }) => {
  const { Icon } = d;
  // ONE light at a time on a disc: its own hit, the hour's pulse, or the hero's lock — whichever is strongest
  let k = flashAt(t, tick, 6);
  let light: LightId = own;
  if (beats)
    beats.forEach((b, j) => {
      if (b <= tick || (lockAt !== undefined && b >= lockAt)) return;
      const kb = 0.7 * flashAt(t, b, 5);
      if (kb > k) {
        k = kb;
        light = beatLights?.[j] ?? own;
      }
    });
  const kl = flashAt(t, lockAt, 7);
  if (kl > k) {
    k = kl;
    light = lockLight ?? own;
  }
  const D = Math.round(iconSize * 1.35);
  const x0 = pad - Math.round(D * 0.09);
  // follow-through: the disc settles a frame after the card (rotate + scale)
  const ip = still ? 1 : dspring(t - at + 1, { stiffness: 520, damping: 18, mass: 0.6 });
  const rest = discRest();
  const o = LIGHTS[light].orb;
  const words = d.label.split(' ');
  // the icon: white while the disc is lit, back to ink THROUGH the light's ink (never grey)
  const li = LIGHTS[light].ink;
  const iconCol = k <= 0.002 ? C.ink : k >= 0.55 ? mixColor(li, '#ffffff', Math.min(1, (k - 0.55) / 0.3)) : mixColor(C.ink, li, k / 0.55);
  const cx = x0 + D / 2;
  return (
    <>
      {k > 0.01 ? (
        // the hit is LIGHT: a pool of the card's light falling from the disc across the card
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(circle at ${cx}px ${cx}px, ${rgba(o[3], 0.62 * k)} 0%, ${rgba(o[3], 0.3 * k)} 28%, ${rgba(o[3], 0.08 * k)} 58%, ${rgba(o[3], 0)} 85%)`,
          }}
        />
      ) : null}
      {accents ? <HitBurst t={t} at={tick} cx={x0 + D / 2} cy={x0 + D / 2} r={D / 2} light={own} seed={d.label} /> : null}
      <div
        style={{
          position: 'absolute',
          left: x0,
          top: x0,
          width: D,
          height: D,
          transform: still || ip > 0.9995 ? undefined : `rotate(${((1 - ip) * -12).toFixed(2)}deg) scale(${(0.78 + 0.22 * ip).toFixed(4)})`,
          transformOrigin: '50% 50%',
        }}
      >
        {k > 0.01 ? (
          <div style={{ position: 'absolute', left: -D * 0.9, top: -D * 0.9, width: D * 2.8, height: D * 2.8, background: bloom(light, 0.85 * k) }} />
        ) : null}
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', ...rest }} />
        {k > 0.01 ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: discHot(light),
              opacity: Math.min(1, k * 1.15),
              boxShadow: `0 0 ${(D * 0.3).toFixed(1)}px ${rgba(o[2], 0.55 * k)}, 0 0 0 ${(2 * k).toFixed(2)}px ${rgba(o[3], 0.8 * k)}`,
            }}
          />
        ) : null}
        <div style={{ position: 'absolute', left: (D - iconSize) / 2, top: (D - iconSize) / 2, width: iconSize, height: iconSize }}>
          <Icon size={iconSize} strokeWidth={2.25} color={iconCol} absoluteStrokeWidth={false} />
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: pad,
          right: pad,
          bottom: pad - labelSize * 0.12,
          fontFamily: FONT.body,
          fontWeight: 500,
          fontSize: labelSize,
          lineHeight: 1.12,
          letterSpacing: '-0.012em',
          color: C.ink,
          textWrap: 'balance',
        }}
      >
        {words.map((w, j) => {
          // each word settles 0.8 f after the last (visible from the first frame: never an empty card)
          const p = still ? 1 : dspring(t - at + 1.2 - 0.8 * j, { stiffness: 600, damping: 20, mass: 0.6 });
          return (
            <React.Fragment key={j}>
              <span style={{ display: 'inline-block', transform: p < 0.999 ? `translateY(${((1 - p) * labelSize * 0.45).toFixed(2)}px)` : undefined }}>
                {w}
              </span>
              {j < words.length - 1 ? ' ' : null}
            </React.Fragment>
          );
        })}
      </div>
    </>
  );
};

/**
 * A language cell's face: the language (label, top-left), Ava's orb in the
 * cell's light (top-right), and the greeting — the WHOLE greeting at reading
 * size (84 px 16:9 · 72 px 9:16), its AI disclosure underlined in the light's
 * ink. Words rise in on the flip's landing (the site's voice reveal: 10 px →
 * 0, 3 px blur → 0); Japanese reveals per character.
 */
export const LangFace: React.FC<{
  lang: Lang;
  /** the greeting as set for this orientation */
  set: Setting;
  t: number;
  /** the flip frame (the text rises in from its landing) */
  at: number;
  pad: number;
  labelSize: number;
  /** the greeting's size */
  size: number;
  /** 0..1 the underline draw */
  underline: number;
  /** the greeting's light (its orb, sheen, pulse and underline) */
  light: LightId;
  orbSize: number;
  /** the face's width (the sheen's travel) */
  w: number;
}> = ({ lang, set, t, at, pad, labelSize, size, underline, light, orbSize, w }) => {
  const land = at + 2;
  const o = LIGHTS[light].orb;
  const ink = LIGHTS[light].ink;
  // the site's voice reveal, tightened to the 16th grid: each unit rises 10 px → 0 and un-blurs 3 px → 0
  let ui = 0;
  const unit = (s: string, key: string, step: number) => {
    const s0 = land - 2 + step * ui++;
    const p = t < s0 ? 0 : dspring(t - s0, { stiffness: 460, damping: 22, mass: 0.7 });
    const op = tween(t, [s0, s0 + 3], [0, 1], EASE.out3);
    const bl = tween(t, [s0, s0 + 5], [3, 0], EASE.out3);
    return (
      <span
        key={key}
        style={{
          display: 'inline-block',
          whiteSpace: 'pre',
          opacity: op < 0.999 ? op : undefined,
          transform: p < 0.999 ? `translateY(${((1 - p) * size * 0.14).toFixed(2)}px)` : undefined,
          filter: bl > 0.1 && op > 0 ? `blur(${bl.toFixed(2)}px)` : undefined,
        }}
      >
        {s}
      </span>
    );
  };
  const units = (s: string, key: string) =>
    lang.perChar
      ? Array.from(s).map((ch, i) => unit(ch, `${key}-${i}`, 0.3))
      : s.split(/( )/).filter((x) => x.length > 0).map((wd, i) => (wd === ' ' ? <span key={`${key}-s${i}`}> </span> : unit(wd, `${key}-${i}`, 0.7)));
  const n = set.ai.length;
  const aiLines = set.ai.map((line, j) => {
    const u = underlined(line);
    const rest = line.slice(u.length);
    const draw = Math.min(1, Math.max(0, underline * n - j));
    return (
      <div key={`ai-${j}`} style={{ whiteSpace: 'nowrap', color: C.ink }}>
        <span style={{ position: 'relative', display: 'inline-block' }}>
          {units(u, `a${j}`)}
          {draw > 0 ? (
            <span
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: lang.perChar ? -size * 0.04 : size * 0.035,
                height: Math.max(4, Math.round(size * 0.055)),
                borderRadius: 3,
                background: `linear-gradient(90deg, ${o[2]}, ${ink})`,
                boxShadow: `0 0 ${(size * 0.12 * (1 - 0.6 * draw)).toFixed(1)}px ${rgba(o[2], 0.55)}`,
                transform: `scaleX(${draw.toFixed(4)})`,
                transformOrigin: '0 50%',
              }}
            />
          ) : null}
        </span>
        {rest ? units(rest, `ar${j}`) : null}
      </div>
    );
  });
  const leadLines = set.lead.map((line, j) => (
    <div key={`lead-${j}`} style={{ whiteSpace: 'nowrap', color: mixColor(C.ink, '#ffffff', 0.18) }}>
      {units(line, `l${j}`)}
    </div>
  ));
  // the orb: it pops in with the face, pulses as its greeting lands (the
  // greeting is "said"), then breathes on the half-beat
  const pop = dspring(t - land + 1, { stiffness: 520, damping: 15, mass: 0.6 });
  const pulse = flashAt(t, land + 1, 10) + 0.55 * flashAt(t, land + 8.5, 8);
  const breath = 0.035 * Math.sin(((t - land) / 15) * 2 * Math.PI) * tween(t, [land + 10, land + 20], [0, 1], EASE.inOut);
  const os = Math.max(0, (0.45 + 0.55 * pop) * (1 + 0.16 * pulse + breath));
  const oc = { x: w - pad - orbSize / 2, y: pad + orbSize / 2 };
  // the sheen: a band of the light's tint sweeps the face as it lands
  const sh = tween(t, [land - 1, land + 9], [0, 1], EASE.inOut);
  return (
    <>
      {sh > 0 && sh < 1 ? (
        <div
          style={{
            position: 'absolute',
            top: '-20%',
            height: '140%',
            left: 0,
            width: w * 0.5,
            transform: `translateX(${(-w * 0.55 + sh * w * 1.1).toFixed(1)}px) skewX(-16deg)`,
            background: `linear-gradient(90deg, ${rgba(o[3], 0)} 0%, ${rgba(o[3], 0.36)} 48%, ${rgba(o[4], 0.55)} 52%, ${rgba(o[3], 0)} 100%)`,
          }}
        />
      ) : null}
      <div
        style={{
          position: 'absolute',
          left: oc.x - orbSize * 1.5,
          top: oc.y - orbSize * 1.5,
          width: orbSize * 3,
          height: orbSize * 3,
          background: bloom(light, (0.25 + 0.6 * pulse) * Math.min(1, pop)),
        }}
      />
      <HitBurst t={t} at={land + 1} cx={oc.x} cy={oc.y} r={orbSize / 2} light={light} seed={`lang-${lang.name}`} n={7} />
      <div
        style={{
          position: 'absolute',
          left: oc.x - orbSize / 2,
          top: oc.y - orbSize / 2,
          width: orbSize,
          height: orbSize,
          transform: `scale(${os.toFixed(4)})`,
          borderRadius: '50%',
          boxShadow: `0 0 ${(orbSize * 0.35 * (0.4 + pulse)).toFixed(1)}px ${rgba(o[2], 0.3 + 0.3 * pulse)}, 0 ${(orbSize * 0.12).toFixed(1)}px ${(orbSize * 0.3).toFixed(1)}px -${(orbSize * 0.1).toFixed(1)}px ${rgba(o[0], 0.35)}`,
        }}
      >
        <MeshOrb size={orbSize} palette={o} time={t / 30 + at * 0.37} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: pad,
          top: pad + 2,
          fontFamily: FONT.body,
          fontWeight: 500,
          fontSize: labelSize,
          lineHeight: 1,
          letterSpacing: TRACK.label,
          textTransform: 'uppercase',
          color: C.muted,
          whiteSpace: 'nowrap',
        }}
      >
        {lang.name}
      </div>
      <div
        style={{
          position: 'absolute',
          left: pad,
          right: pad,
          bottom: pad - size * 0.08,
          fontFamily: FONT.cinema,
          fontWeight: 500,
          fontSize: size,
          lineHeight: 1.04,
          letterSpacing: '-0.005em',
        }}
      >
        {lang.aiFirst ? [...aiLines, ...leadLines] : [...leadLines, ...aiLines]}
      </div>
    </>
  );
};
