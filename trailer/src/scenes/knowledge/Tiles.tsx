/**
 * The five documents (knowledge-stage.tsx <ol>): paper cards (16:9) / rows
 * (9:16) set in the scene's one type system — the kind as a small tracked
 * label in muted ink (no rainbow badges), the name in the title family, and
 * the match bar with its 60 % threshold tick. A card is a real object: a
 * layered shadow (theme.ts elevation) that settles as it lands.
 *
 * Each card lands on its 16th (the docTicks): it rises a few px and scales
 * .94 → 1 on the site spring (one small overshoot) as its shadow settles —
 * no glint, no ring, no flash. While a document is read, a fine sunday-ink
 * ring breathes round it and its kind turns sunday ink; the bars fill with an
 * overshoot and settle — to .22/.14/.10/.30/.26, none reaching the tick — and
 * the ticks blink 1 → .3 → 1. The documents that did not answer step back (a
 * fade and a touch smaller, never out of focus) when Ava answers (16:9) /
 * deeper, on the miss, behind the card that takes their place (9:16).
 */
import React from 'react';
import { subpixel } from '../../components/Type';
import { mixColor, rgba } from '../../lib/lights';
import { EASE, mix, smooth, SPRING, springUnit, tween } from '../../lib/motion';
import { typeStyle } from '../../lib/type';
import { C, elevation, FONT, R as RADII, TRACK } from '../../theme';
import { KNOWLEDGE_LOCAL } from '../../timing';
import { DOCS, INK, MATCH, THRESHOLD, TRACK_FILL, type Geo } from './geometry';

const KL = KNOWLEDGE_LOCAL;

/** the frame tile i lands (= its docTick cue) */
export const popAt = (i: number) => KL.docPops[i];

/** the landing: spring progress p (0 → ~1.075 → 1), released a frame before the tick so it is visibly moving ON it */
export function tilePop(t: number, i: number) {
  const p = springUnit(t - (popAt(i) - 1), SPRING.site);
  return { p, o: smooth(0, 0.45, p), sc: 0.94 + 0.06 * p, y: 26 * (1 - p) };
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

/** 0 → 1 → 0 while tile i is being read (its bar filling) */
function readingAt(t: number, i: number) {
  const [f0, step, dur] = KL.fills;
  const s = f0 + i * step - 2;
  const u = (t - s) / (dur * 0.8);
  if (u <= 0 || u >= 1) return 0;
  return Math.sin(Math.PI * EASE.inOut(u));
}

const Bar: React.FC<{ w: number; fill: number; tick: number; cool: number }> = ({ w, fill, tick, cool }) => (
  <span style={{ position: 'relative', display: 'block', width: w, height: 8, borderRadius: 4, background: TRACK_FILL }}>
    <span
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 4,
        background: rgba(mixColor(INK, '#6b6878', cool), 0.42 - 0.08 * cool),
        transformOrigin: '0 50%',
        transform: `scaleX(${Math.max(0, fill).toFixed(4)})`,
      }}
    />
    <span
      style={{
        position: 'absolute',
        left: w * THRESHOLD - 1,
        top: -7,
        width: 2,
        height: 22,
        borderRadius: 1,
        background: 'rgba(20,10,36,0.42)',
        opacity: tick,
      }}
    />
  </span>
);

export const Tiles: React.FC<{ t: number; G: Geo; cool: number }> = ({ t, G, cool }) => {
  const S = G.tile;
  // the documents step back: on her answer (16:9) / on the miss, behind the card that takes their place (9:16)
  const B = G.docsBack;
  const dq = tween(t, B.at === 'miss' ? KL.docsBackMiss : KL.dimDocs, [0, 1], EASE.inOut);
  const dim = mix(1, B.dim, dq);
  const back = mix(1, B.scale, dq);
  const listMid = (G.tiles[0].y + G.tiles[G.tiles.length - 1].y + G.tiles[G.tiles.length - 1].h) / 2;
  const tick = tickOpacity(t);
  const kindStyle = typeStyle('label', G.v, { tone: 'paper', size: S.kindText });
  const nameStyle: React.CSSProperties = {
    fontFamily: FONT.ui,
    fontWeight: 480,
    fontSize: S.name,
    letterSpacing: TRACK.title,
    lineHeight: 1.1,
    color: C.ink,
  };
  return (
    <>
      {G.tiles.map((r, i) => {
        const pp = tilePop(t, i);
        if (pp.o <= 0.001) return null;
        const d = DOCS[i];
        const rd = readingAt(t, i);
        const settle = Math.max(0, 1 - pp.p);
        const shadow = [
          // being read: a fine sunday-ink ring breathes in round the card
          ...(rd > 0.01 ? [`0 0 0 ${(1 + 0.5 * rd).toFixed(2)}px ${rgba(INK, 0.5 * rd)}`] : []),
          elevation(0.8 + 1.6 * settle, 1),
        ].join(', ');
        const y = pp.y + (1 - back) * (listMid - (r.y + r.h / 2));
        const sc = pp.sc * back;
        const moving = Math.abs(1 - pp.p) > 2e-4 || (dq > 0 && dq < 1);
        const tf = moving || sc !== 1 || y !== 0 ? `translateY(${y.toFixed(3)}px) scale(${sc.toFixed(5)})` : undefined;
        const kind = (
          <span style={{ ...kindStyle, color: mixColor(C.muted, INK, rd), display: 'block' }}>{d.kind}</span>
        );
        const bar = <Bar w={S.barW} fill={fillAt(t, i)} tick={tick} cool={cool} />;
        return (
          <div
            key={d.name}
            style={{
              position: 'absolute',
              left: r.x,
              top: r.y,
              width: r.w,
              height: r.h,
              borderRadius: G.v ? RADII.xl : RADII.x2,
              background: C.white,
              boxShadow: shadow,
              opacity: pp.o * dim,
              ...subpixel(tf, moving),
            }}
          >
            {S.kind === 'tile' ? (
              <>
                <div style={{ position: 'absolute', left: S.pad, top: S.pad - 2 }}>{kind}</div>
                <div style={{ position: 'absolute', left: r.w - S.barPadR - S.barW, top: S.pad + 9 }}>{bar}</div>
                <div
                  style={{
                    position: 'absolute',
                    left: S.nameX,
                    bottom: S.pad - 4,
                    width: r.w - 2 * S.pad,
                    ...nameStyle,
                  }}
                >
                  {d.name}
                </div>
              </>
            ) : (
              <>
                <div style={{ position: 'absolute', left: S.pad, top: 0, height: r.h, display: 'flex', alignItems: 'center' }}>{kind}</div>
                <div
                  style={{
                    position: 'absolute',
                    left: S.nameX,
                    top: 0,
                    height: r.h,
                    display: 'flex',
                    alignItems: 'center',
                    whiteSpace: 'nowrap',
                    ...nameStyle,
                  }}
                >
                  {d.name}
                </div>
                <div style={{ position: 'absolute', left: r.w - S.barPadR - S.barW, top: (r.h - 8) / 2 }}>{bar}</div>
              </>
            )}
          </div>
        );
      })}
    </>
  );
};
