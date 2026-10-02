/**
 * The five documents (knowledge-stage.tsx <ol>): paper cards (16:9) / rows
 * (9:16) set in the scene's one type system — the kind as a small tracked
 * label in muted ink (no rainbow badges) and the name in the title family.
 * Nothing else: no meters, no scrubbers — a document is its name. A card is a
 * real object: a layered shadow (theme.ts elevation) that settles as it lands.
 *
 * Each card lands on its 16th (the docTicks): it rises a few px and scales
 * .94 → 1 on the site spring (one small overshoot) as its shadow settles —
 * no glint, no ring, no flash. While a document is read, a fine sunday-ink
 * ring breathes round it and its kind turns sunday ink (one after another,
 * KL.fills — the reading). The documents that did not answer step back (a
 * fade and a touch smaller, never out of focus) when Ava answers (16:9) /
 * deeper, on the miss, behind the card that takes their place (9:16).
 */
import React from 'react';
import { glideStyle, useGlide } from '../../components/Type';
import { mixColor, rgba } from '../../lib/lights';
import { EASE, mix, smooth, SPRING, springUnit, tween } from '../../lib/motion';
import { typeStyle } from '../../lib/type';
import { C, elevation, FONT, R as RADII, TRACK } from '../../theme';
import { KNOWLEDGE_LOCAL } from '../../timing';
import { DOCS, INK, type Geo } from './geometry';

const KL = KNOWLEDGE_LOCAL;

/** the frame tile i lands (= its docTick cue) */
export const popAt = (i: number) => KL.docPops[i];

/** the landing: spring progress p (0 → ~1.075 → 1), released a frame before the tick so it is visibly moving ON it */
export function tilePop(t: number, i: number) {
  const p = springUnit(t - (popAt(i) - 1), SPRING.site);
  return { p, o: smooth(0, 0.45, p), sc: 0.94 + 0.06 * p, y: 26 * (1 - p) };
}

/** 0 → 1 → 0 while tile i is being read (KL.fills: one after another, 2.4 f apart) */
function readingAt(t: number, i: number) {
  const [f0, step, dur] = KL.fills;
  const s = f0 + i * step - 2;
  const u = (t - s) / (dur * 0.8);
  if (u <= 0 || u >= 1) return 0;
  return Math.sin(Math.PI * EASE.inOut(u));
}

export const Tiles: React.FC<{ t: number; G: Geo }> = ({ t, G }) => {
  const glide = useGlide(); // under the scene's slow push each tile rides its own small layer
  const S = G.tile;
  // the documents step back: on her answer (16:9) / on the miss, behind the card that takes their place (9:16)
  const B = G.docsBack;
  const dq = tween(t, B.at === 'miss' ? KL.docsBackMiss : KL.dimDocs, [0, 1], EASE.inOut);
  const dim = mix(1, B.dim, dq);
  const back = mix(1, B.scale, dq);
  const listMid = (G.tiles[0].y + G.tiles[G.tiles.length - 1].y + G.tiles[G.tiles.length - 1].h) / 2;
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
              ...glideStyle(tf, moving || glide),
            }}
          >
            {S.kind === 'tile' ? (
              <>
                <div style={{ position: 'absolute', left: S.pad, top: S.pad - 2 }}>{kind}</div>
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
              </>
            )}
          </div>
        );
      })}
    </>
  );
};
