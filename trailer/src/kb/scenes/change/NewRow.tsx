/**
 * THE NEW VERSION (SCRIPT.md b13–b14) — the edited file, landed in the list's top slot as its own row (written/Row.tsx:
 * TXT · Opening hours, the pill Reading… with the app's spinner → on "the new answer" Ready · 1 passage), then, a beat
 * before the next call rings, LIFTED OUT of the receding app and UNFOLDED into its page — b10's idiom (call/Page.tsx):
 * one object becoming another. The paper opens from the row's box to the page's (one SVG rect, exact at every
 * fractional edge); the row's name glides and grows into the page's heading (its weight easing 480 → 560 on the variable
 * face), the kind token leaves its tile for the page's kind line, the pill and the … leave up through their masks; the
 * rule draws and the three lines rise on 16ths — the new one, "Saturday · 9:00–16:00".
 *
 *   "four."   the sunday sweep (a flat band at 12 %, EASE.draw, no glow) runs under the new Saturday line; the other two
 *             lines settle to 45 %
 */
import React from 'react';
import { reveal, revealStyle } from '../../../components/Type';
import { subpixel } from '../../../lib/glide';
import { useLayout } from '../../../lib/layout';
import { EASE, smooth, SPRING, springUnit, tween } from '../../../lib/motion';
import { maskBox, typeStyle } from '../../../lib/type';
import { TYPE } from '../../../theme';
import { APP, Icon, measureText, meshElevation, Pill, type DocPageGeometry, type PillState } from '../../kit';
import { CHANGE_LOCAL as K } from '../../timing';
import { KindTile, Row, rowFace, typeLabelWidth, TypeLabel } from '../written/Row';
import { ease, lerp, listGeo, type ChangeStage } from './stage';

/** the new version's lines (the page b14 answers from) */
export const NEW_LINES = ['Monday to Friday · 8:00–20:00', 'Saturday · 9:00–16:00', 'Sunday · closed'] as const;
/** the swept line */
export const NEW_LINE = 1;

const PILL: readonly PillState[] = [
  { at: K.land, kind: 'reading' },
  { at: K.ready5, kind: 'ready', n: 1 },
];

/** the new row's box at rest in the list's top slot (frame px, the panel settled) */
export function newRowBox(S: ChangeStage) {
  const Lg = listGeo(S);
  return { x: Lg.x, y: Lg.listY, w: Lg.w, h: Lg.h, radius: S.row.size * 0.32 };
}

/** the single-line row's inner geometry (written/Row.tsx, kept in step with it) */
function rowGeo(size: number, w: number, h: number) {
  const pad = size * 0.42;
  const tokenSize = Math.max(24, Math.round(size * 0.5));
  const tile = size * 1.4;
  // written/Row.tsx's face: the app's square icon tile (FileText), the type word "Text" after the pill
  const F = rowFace(size, 'inline', h);
  const tileW = tile;
  const metaW = F.metaGap + typeLabelWidth('txt', F.metaSize);
  const btn = size * 1.05;
  const pillSize = Math.max(26, Math.round(size * 0.6));
  const mx = w - pad - btn;
  const pillW = measureText('Ready · 1 passage', { size: pillSize, weight: 520 }) + 2.67 * pillSize;
  return { pad, tokenSize, tile, tileW, btn, pillSize, mx, pillW, F, nameX: pad * 2 + tileW, nameY: (h - size * 1.05) / 2, pillX: mx - pad * 0.6 - pillW - metaW, pillY: (h - pillSize * 1.72) / 2 };
}

export const NewRow: React.FC<{ t: number; S: ChangeStage; g: DocPageGeometry; ink: string; accent: string }> = ({ t, S, g, ink, accent }) => {
  const L = useLayout();
  const v = L.vertical;
  if (t < K.land) return null;
  const B = newRowBox(S);
  const size = S.row.size;
  // in the list (landed → the lift): the row itself
  if (t < K.lift[0]) {
    return <Row t={t} x={B.x} y={B.y} w={B.w} h={B.h} layout="inline" size={size} kind="txt" name="Opening hours" pill={PILL} contentAt={K.land - 1} moving={t < K.land + 12} />;
  }
  /* ── lifted out, unfolding into the page ── */
  const R = rowGeo(size, B.w, B.h);
  const ps = g.spec.size;
  const pad = g.pad;
  const labelSize = typeStyle('label', v).fontSize as number;
  const headTop = pad;
  const headSize = ps * 1.08;
  const headY = pad + labelSize * 1.5;
  // the lift: off the list (elevation 0 → 3.4, a hair larger), then the unfold carries it to the page's box
  const lf = springUnit(t - K.lift[0], { stiffness: 260, damping: 26, mass: 1 });
  const un = ease(t, K.unfold[0], K.unfold[1], EASE.inOut);
  const grow = 1 + 0.012 * Math.min(1, lf) * (1 - un);
  const x0 = B.x - (B.w * (grow - 1)) / 2;
  const y0 = B.y - (B.h * (grow - 1)) / 2;
  const x = lerp(x0, g.card.x, un);
  const y = lerp(y0, g.card.y, un);
  const w = lerp(B.w * grow, g.card.w, un);
  const h = lerp(B.h * grow, g.card.h, un);
  const radius = lerp(B.radius, ps * 0.22, un);
  const lift = lerp(3.4 * Math.min(1, lf), 3, un);
  const moving = un < 1 || lf < 0.999;
  // the row's face leaving: pill + … up out, the tile fading as its token leaves for the kind line
  const rowOut = ease(t, K.unfold[0] - 3, K.unfold[0] + 4, EASE.in3);
  const tileA = 1 - ease(t, K.unfold[0] + 2, K.unfold[0] + 12, EASE.inOut);
  // name → heading: down first, then left, growing (by transform), its weight on the variable face
  // (they travel WITH the paper: inside its box, as it opens — never ahead of it)
  const hm = ease(t, K.unfold[0] + 3, K.unfold[1] - 1, EASE.inOut);
  const hyp = ease(t, K.unfold[0] + 4, K.unfold[0] + 16, EASE.inOut);
  const hxp = ease(t, K.unfold[0] + 8, K.unfold[1] - 1, EASE.inOut);
  const nx = lerp(R.nameX, pad, hxp);
  const ny = lerp(R.nameY, headY, hyp);
  const nsc = lerp(size, headSize, hm) / headSize;
  const nWeight = lerp(TYPE.title.weight, 560, hm);
  // the page's kind line: the row's tile holds the app's FileText icon (written/Row.tsx), not a token, so the line
  // rises into its place on the page through its own mask once the name has gone down past it (they never cross)
  const kindAt = K.unfold[0] + 12;
  // the page's own content: the rule draws, the lines rise on 16ths
  const ruleP = tween(t, [K.unfold[1] - 8, K.unfold[1] + 4], [0, 1], EASE.draw);
  const linesAt = (i: number) => K.unfold[1] - 6 + i * 3.75;
  // "four.": the sweep under the new line; the others settle to 45 %
  const sp = t >= K.sweep[0] ? tween(t, [K.sweep[0], K.sweep[1]], [0, 1], EASE.draw) : 0;
  const dimO = tween(t, [K.sweep[0], K.sweep[0] + 12], [1, 0.45], EASE.inOut);
  const title = typeStyle('title', v, { size: ps, tabular: true });
  const sweepH = ps * 1.22;
  const borderA = 1 - un;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, ...subpixel(`translate(${x.toFixed(3)}px, ${y.toFixed(3)}px)`, moving) }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, borderRadius: radius, boxShadow: lift > 0.01 ? meshElevation(lift, ink, Math.min(1, lift / 1.2)) : undefined }} />
      <svg width={Math.ceil(w) + 2} height={Math.ceil(h) + 2} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} aria-hidden>
        <rect x={0} y={0} width={w} height={h} rx={radius} ry={radius} fill={APP.card} />
        {borderA > 0.001 ? <rect x={0.625} y={0.625} width={Math.max(0, w - 1.25)} height={Math.max(0, h - 1.25)} rx={Math.max(0, radius - 0.6)} fill="none" stroke={APP.border} strokeWidth={1.25} strokeOpacity={borderA} /> : null}
      </svg>
      <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, overflow: 'hidden', borderRadius: radius }}>
        {tileA > 0.001 ? <KindTile kind="txt" side={R.tile} icon={R.F.icon} radius={R.F.radius} style={{ position: 'absolute', left: R.pad, top: (B.h - R.tile) / 2, opacity: tileA }} /> : null}
        {t >= kindAt - 0.5 ? (
          <div style={{ position: 'absolute', left: pad, top: headTop, ...maskBox(0) }}>
            <span style={{ ...revealStyle(reveal(t, kindAt, { rise: 90, fade: 0.5 }), undefined, t - kindAt < 16), display: 'block', ...typeStyle('label', v, { size: labelSize }), letterSpacing: '0.14em', color: APP.mutedFg, lineHeight: 1.2, whiteSpace: 'nowrap' }}>TXT</span>
          </div>
        ) : null}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            transformOrigin: '0 0',
            ...typeStyle('title', v, { size: headSize, weight: nWeight }),
            lineHeight: 1.05,
            color: APP.foreground,
            whiteSpace: 'nowrap',
            ...subpixel(`translate(${nx.toFixed(3)}px, ${ny.toFixed(3)}px) scale(${nsc.toFixed(5)})`, hm > 0 && hm < 1),
          }}
        >
          Opening hours
        </div>
        {rowOut < 1 ? (
          <>
            <div style={{ position: 'absolute', left: R.pillX, top: R.pillY, overflow: 'hidden', paddingBottom: 1 }}>
              <div style={{ transform: `translateY(${(-rowOut * 120).toFixed(2)}%)`, opacity: 1 - smooth(0.3, 1, rowOut), display: 'flex', alignItems: 'center', height: R.pillSize * 1.72 }}>
                <Pill t={t} states={PILL} size={R.pillSize} />
                <span style={{ display: 'inline-block', width: R.F.metaGap }} />
                <TypeLabel kind="txt" size={R.F.metaSize} />
              </div>
            </div>
            <div style={{ position: 'absolute', left: R.mx, top: (B.h - R.btn) / 2, width: R.btn, height: R.btn, display: 'flex', alignItems: 'center', justifyContent: 'center', color: APP.foreground, opacity: 1 - rowOut }}>
              <Icon name="ellipsis" size={size * 0.56} stroke={2.4} />
            </div>
          </>
        ) : null}
        {ruleP > 0 ? <div style={{ position: 'absolute', left: pad, top: g.lineRects[0].y - g.card.y - ps * 0.55, width: (g.card.w - 2 * pad) * ruleP, height: 1.25, background: APP.border }} /> : null}
        {NEW_LINES.map((ln, i) => {
          if (t < linesAt(i) - 0.5) return null;
          const r = g.lineRects[i];
          const rv = reveal(t, linesAt(i), { config: SPRING.text, rise: 90, fade: 0.5 });
          const swept = i === NEW_LINE;
          return (
            <React.Fragment key={i}>
              {swept && sp > 0 ? (
                <div
                  style={{
                    position: 'absolute',
                    left: r.x - g.card.x - ps * 0.14,
                    top: r.y - g.card.y - ps * 0.02,
                    width: r.w + ps * 0.28,
                    height: sweepH,
                    borderRadius: sweepH * 0.16,
                    background: accent,
                    opacity: 0.12,
                    clipPath: `inset(0 ${((1 - sp) * 100).toFixed(3)}% 0 0 round ${(sweepH * 0.16).toFixed(1)}px)`,
                  }}
                />
              ) : null}
              <div style={{ position: 'absolute', left: r.x - g.card.x, top: r.y - g.card.y, ...maskBox(0), opacity: swept ? undefined : dimO < 0.999 ? dimO : undefined }}>
                <span style={{ ...revealStyle(rv, undefined, t - linesAt(i) < 18), ...title, letterSpacing: '-0.02em', color: APP.foreground, whiteSpace: 'nowrap' }}>{ln}</span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
