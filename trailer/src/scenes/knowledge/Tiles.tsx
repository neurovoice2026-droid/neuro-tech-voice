/**
 * The five documents (knowledge-stage.tsx <ol>): white tiles (16:9) / rows
 * (9:16) with the site's DocBadge, the name, and the match bar with its
 * 60 % threshold tick. Each pops on its 16th (the docTicks): a 2 f inhale,
 * then scale .7 → 1.08 → 1 with the ring and shadow growing in and the
 * badge flashing 20 % brighter for 2 f; ON the hit a glint of Sunday light
 * crosses the tile and an outline ring leaves its edge. While a document is
 * read it takes a sunday-ink ring and an aqua sheen. The bars fill with an overshoot and
 * settle — to .22/.14/.10/.30/.26, none reaching the tick — the ticks blink
 * 1 → .3 → 1, and the documents step back (.25, 2 px out of focus) when
 * Ava answers, so her answer leads.
 */
import React from 'react';
import { spring } from 'remotion';
import { mixColor, rgba } from '../../lib/lights';
import { EASE, mix, tween } from '../../lib/motion';
import { C, FONT } from '../../theme';
import { FPS, KNOWLEDGE_LOCAL } from '../../timing';
import { BADGE, DIM, DIM_BLUR, DOCS, INK, MATCH, SUN, SUN_GLOW, THRESHOLD, TRACK_FILL, type Geo } from './geometry';

const KL = KNOWLEDGE_LOCAL;

/** ζ ≈ .38: one 27 % overshoot, so .7 → 1.08 → 1 */
const POP = { stiffness: 420, damping: 14.5, mass: 0.8 };

/** the frame tile i pops (= its docTick cue) */
export const popAt = (i: number) => KL.docPops[i];

/** the pop: spring progress p (0 → ~1.27 → 1), plus the 2 f inhale before it */
export function tilePop(t: number, i: number) {
  const s = popAt(i);
  if (t < s - 2) return { p: 0, o: 0, sc: 0.7, y: 24, inhale: 0 };
  if (t < s) {
    const u = (t - (s - 2)) / 2;
    return { p: 0, o: 0.3 * u, sc: 0.7 - 0.04 * Math.sin((u * Math.PI) / 2), y: 24 + 4 * u, inhale: u };
  }
  const p = spring({ frame: t - s, fps: FPS, config: POP });
  return { p, o: Math.min(1, 0.3 + (t - s) / 3), sc: 0.7 + 0.3 * p, y: 24 * (1 - p), inhale: 0 };
}

/** the match bar's fill for tile i (overshoot +.03, then settle) */
function fillAt(t: number, i: number) {
  const [f0, step, dur] = KL.fills;
  const s = f0 + i * step;
  const m = MATCH[i];
  const u = (t - s) / dur;
  if (u <= 0) return 0;
  if (u < 0.62) return (m + 0.03) * EASE.out3(u / 0.62);
  return mix(m + 0.03, m, EASE.inOut(Math.min(1, (u - 0.62) / 0.38)));
}

/** the ticks' blink: 1 → .3 → 1 over tickBlink */
function tickOpacity(t: number) {
  const [a, b] = KL.tickBlink;
  if (t <= a || t >= b) return 1;
  const u = (t - a) / (b - a);
  const k = u < 0.5 ? EASE.inOut(u * 2) : EASE.inOut(2 - u * 2);
  return 1 - 0.7 * k;
}

const Badge: React.FC<{ kind: keyof typeof BADGE; h: number; size: number; minW: number; flash: number }> = ({
  kind,
  h,
  size,
  minW,
  flash,
}) => (
  <span
    style={{
      display: 'inline-grid',
      placeItems: 'center',
      height: h,
      minWidth: minW,
      padding: '0 14px',
      boxSizing: 'border-box',
      borderRadius: 12,
      background: BADGE[kind].bg,
      color: BADGE[kind].fg,
      fontFamily: FONT.body,
      fontWeight: 500,
      fontSize: size,
      letterSpacing: '0.04em',
      lineHeight: 1,
      filter: flash > 0 ? `brightness(${(1 + 0.2 * flash).toFixed(3)})` : undefined,
    }}
  >
    {kind}
  </span>
);

const Bar: React.FC<{ w: number; fill: number; tick: number; cool: number }> = ({ w, fill, tick, cool }) => (
  <span style={{ position: 'relative', display: 'block', width: w, height: 10, borderRadius: 5, background: TRACK_FILL }}>
    <span
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 5,
        background: rgba(mixColor(INK, '#6b6878', cool), 0.32 - 0.04 * cool),
        transformOrigin: '0 50%',
        transform: `scaleX(${Math.max(0, fill).toFixed(4)})`,
      }}
    />
    <span
      style={{
        position: 'absolute',
        left: w * THRESHOLD - 1.5,
        top: -7,
        width: 3,
        height: 24,
        borderRadius: 1.5,
        background: 'rgba(20,10,36,0.4)',
        opacity: tick,
      }}
    />
  </span>
);

/** 0 → 1 → 0 while tile i is being read (its bar filling) */
function readingAt(t: number, i: number) {
  const [f0, step, dur] = KL.fills;
  const s = f0 + i * step - 2;
  const u = (t - s) / (dur * 0.8);
  if (u <= 0 || u >= 1) return 0;
  return Math.sin(Math.PI * EASE.inOut(u));
}

export const Tiles: React.FC<{ t: number; G: Geo; cool: number }> = ({ t, G, cool }) => {
  const S = G.tile;
  const dq = tween(t, KL.dimDocs, [0, 1], EASE.inOut);
  const dim = mix(1, DIM, dq);
  const focus = DIM_BLUR * dq;
  const tick = tickOpacity(t);
  return (
    <>
      {G.tiles.map((r, i) => {
        const pp = tilePop(t, i);
        if (pp.o <= 0) return null;
        const d = DOCS[i];
        const k = Math.max(0, pp.p);
        const extra = Math.max(0, k - 1) / 0.27; // 0..1 at the overshoot
        const rd0 = readingAt(t, i);
        const shadow = [
          rd0 > 0.01
            ? `0 0 0 ${(1 + 1.4 * rd0).toFixed(2)}px ${rgba(INK, 0.08 + 0.3 * rd0)}`
            : `0 0 0 ${(1 + 1.2 * extra).toFixed(2)}px rgba(24,16,40,${(0.07 * Math.min(1, k) + 0.05 * extra).toFixed(3)})`,
          // the read throws a little Sunday light round the tile
          ...(rd0 > 0.01 ? [`0 0 ${(24 * rd0).toFixed(1)}px ${rgba(SUN_GLOW.body, 0.22 * rd0)}`] : []),
          `0 ${(14 * Math.min(1.3, k) + 8 * extra).toFixed(1)}px ${(30 * Math.min(1.3, k) + 14 * extra).toFixed(1)}px -20px ${rgba(SUN.orb[0], 0.32 * Math.min(1, k))}`,
        ].join(', ');
        const flash = t >= popAt(i) && t < popAt(i) + 2 ? 1 : 0;
        // shutter: the pop's first frames smear with the size change
        const grow = Math.abs(pp.sc - tilePop(t - 1, i).sc) * Math.max(r.w, r.h);
        const smear = Math.min(4, grow * 0.08);
        const badge = <Badge kind={d.kind} h={S.badgeH} size={S.badgeText} minW={S.badgeMinW} flash={flash} />;
        const bar = <Bar w={S.barW} fill={fillAt(t, i)} tick={tick} cool={cool} />;
        // being read: a violet ring breathes in and a sheen crosses the tile
        const rd = readingAt(t, i);
        const [f0, step] = KL.fills;
        const sheenQ = tween(t, [f0 + i * step - 3, f0 + i * step + 11], [0, 1], EASE.inOut);
        // ON the hit: a glint of light crosses the tile (fast, power3.out) and a ring leaves its edge
        const hit = popAt(i);
        const glintQ = tween(t, [hit, hit + 8], [0, 1], EASE.out3);
        const ringQ = tween(t, [hit + 1, hit + 12], [0, 1], EASE.out3);
        const ringO = t > hit && ringQ < 1 ? 0.55 * (1 - ringQ) : 0;
        const ringK = 4 + 18 * ringQ;
        return (
          <div
            key={d.name}
            style={{
              position: 'absolute',
              left: r.x,
              top: r.y,
              width: r.w,
              height: r.h,
              borderRadius: 21.6,
              background: C.white,
              boxShadow: shadow,
              opacity: pp.o * dim,
              transform: `translateY(${pp.y.toFixed(2)}px) scale(${pp.sc.toFixed(4)})`,
              filter: smear + focus > 0.3 ? `blur(${(smear + focus).toFixed(2)}px)` : undefined,
            }}
          >
            {ringO > 0 ? (
              <div
                style={{
                  position: 'absolute',
                  inset: -ringK,
                  borderRadius: 21.6 + ringK,
                  boxShadow: `inset 0 0 0 1.5px ${rgba(SUN.orb[2], ringO)}`,
                  pointerEvents: 'none',
                }}
              />
            ) : null}
            {(sheenQ > 0 && sheenQ < 1) || (glintQ > 0 && glintQ < 1) ? (
              <div style={{ position: 'absolute', inset: 0, borderRadius: 21.6, overflow: 'hidden', pointerEvents: 'none' }}>
                {glintQ > 0 && glintQ < 1 ? (
                  <div
                    style={{
                      position: 'absolute',
                      top: -60,
                      bottom: -60,
                      width: 90,
                      left: -140 + glintQ * (r.w + 200),
                      transform: 'rotate(20deg)',
                      background: `linear-gradient(90deg, ${rgba(SUN_GLOW.core, 0)}, ${rgba(SUN_GLOW.core, 0.75 * (1 - glintQ * 0.5))}, ${rgba('#ffffff', 0.9 * (1 - glintQ * 0.5))} 50%, ${rgba(SUN_GLOW.core, 0.75 * (1 - glintQ * 0.5))}, ${rgba(SUN_GLOW.core, 0)})`,
                    }}
                  />
                ) : null}
                {sheenQ > 0 && sheenQ < 1 ? (
                  <div
                    style={{
                      position: 'absolute',
                      top: -40,
                      bottom: -40,
                      width: 160,
                      left: -200 + sheenQ * (r.w + 240),
                      transform: 'rotate(18deg)',
                      background: `linear-gradient(90deg, ${rgba(SUN_GLOW.core, 0)}, ${rgba(SUN_GLOW.core, 0.5 * Math.max(0.2, rd))}, ${rgba(SUN_GLOW.core, 0)})`,
                    }}
                  />
                ) : null}
              </div>
            ) : null}
            {S.kind === 'tile' ? (
              <>
                <div style={{ position: 'absolute', left: S.pad, top: S.pad }}>{badge}</div>
                <div style={{ position: 'absolute', left: r.w - S.barPadR - S.barW, top: S.pad + (S.badgeH - 10) / 2 }}>{bar}</div>
                <div
                  style={{
                    position: 'absolute',
                    left: S.nameX,
                    top: S.pad + S.badgeH + 12,
                    width: r.w - 2 * S.pad,
                    fontFamily: FONT.body,
                    fontWeight: 500,
                    fontSize: S.name,
                    lineHeight: 1.08,
                    letterSpacing: '-0.015em',
                    color: C.ink,
                  }}
                >
                  {d.name}
                </div>
              </>
            ) : (
              <>
                <div style={{ position: 'absolute', left: S.pad, top: (r.h - S.badgeH) / 2 }}>{badge}</div>
                <div
                  style={{
                    position: 'absolute',
                    left: S.nameX,
                    top: 0,
                    height: r.h,
                    display: 'flex',
                    alignItems: 'center',
                    fontFamily: FONT.body,
                    fontWeight: 500,
                    fontSize: S.name,
                    letterSpacing: '-0.012em',
                    color: C.ink,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {d.name}
                </div>
                <div style={{ position: 'absolute', left: r.w - S.barPadR - S.barW, top: (r.h - 10) / 2 }}>{bar}</div>
              </>
            )}
          </div>
        );
      })}
    </>
  );
};
