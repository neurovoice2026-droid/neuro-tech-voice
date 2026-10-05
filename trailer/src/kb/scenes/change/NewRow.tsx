/**
 * THE NEW VERSION (SCRIPT.md b13–b14) — the edited file, landed in the list's top slot as its own row (written/Row.tsx:
 * the FileText tile · Opening hours, the pill Reading… with the app's spinner and the type word Text → on "the new
 * answer" Ready · 1 passage), then, a beat before the next call rings, LIFTED OUT of the receding app and UNFOLDED into
 * its page — b10's idiom (call/Page.tsx): one object becoming another.
 *
 * THE UNFOLD IS ONE CONTINUOUS MOVE (critic fix, build B): the lifted row's right-hand face (pill, type word, …) leaves up
 * through its masks as the paper narrows and travels to the page's width and place; then the paper OPENS DOWNWARDS and
 * the page's own content — set at its final place inside the paper (the TXT kind line, the rule, the three lines) — is
 * revealed by the paper's moving bottom edge: the box is never larger than what it shows, and no line is ever cut by an
 * edge that stands still. The row's name glides and grows into the page's heading as the edge passes it (its weight
 * easing 480 → 560 on the variable face); the kind line rises into its place once the name has gone down past it.
 *
 *   "Saturday"  the sunday sweep (b10's band: a flat 12 % sunday, 15 frames, EASE.draw, no glow) runs under the new
 *               Saturday line; the other two lines settle to 40 %
 */
import React from 'react';
import { Easing } from 'remotion';
import { reveal, revealStyle } from '../../../components/Type';
import { subpixel } from '../../../lib/glide';
import { useLayout } from '../../../lib/layout';
import { EASE, smooth, SPRING, springUnit, tween } from '../../../lib/motion';
import { maskBox, typeStyle } from '../../../lib/type';
import { TYPE } from '../../../theme';
import { APP, Icon, meshElevation, Pill, type DocPageGeometry, type PillState } from '../../kit';
import { CHANGE_LOCAL as K } from '../../timing';
import { KindTile, Row, rowFace, TypeLabel } from '../written/Row';
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

/**
 * The row's face exactly as written/Row.tsx lays out a single-line row (inline layout, content shown): the tile, the
 * name, the pill + its type word right-aligned before the … trigger. Laid out for the row's own width `rowW`; `shift`
 * carries the right-hand group (pill, word, …) with a box narrower than the row (the flight's widening paper), on its
 * own sub-pixel layer; at shift 0 it is the Row's face pixel for pixel.
 */
export const RowFace: React.FC<{ t: number; rowW: number; rowH: number; h: number; shift: number; size: number; opacity: number }> = ({ t, rowW, rowH, h, shift, size, opacity }) => {
  const L = useLayout();
  const F = rowFace(size, 'inline', rowH);
  const W = Math.ceil(rowW);
  const mx = rowW - F.pad - F.btn;
  // the face is centred on the paper's current height (the flight's box is a row's height from 65 % of its drop)
  const dy = (h - rowH) / 2;
  const moving = Math.abs(shift) > 0.01 || Math.abs(dy) > 0.01;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: rowH, opacity: opacity >= 0.999 ? undefined : opacity, ...subpixel(Math.abs(dy) > 0.01 ? `translate(0px, ${dy.toFixed(3)}px)` : undefined, moving) }}>
      <KindTile kind="txt" side={F.tile} icon={F.icon} radius={F.radius} style={{ position: 'absolute', left: F.pad, top: (rowH - F.tile) / 2 }} />
      <div style={{ position: 'absolute', left: F.nameX, top: F.nameY, ...typeStyle('title', L.vertical, { size }), color: APP.foreground, whiteSpace: 'nowrap', lineHeight: 1.05 }}>Opening hours</div>
      <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: rowH, ...subpixel(Math.abs(shift) > 0.01 ? `translateX(${shift.toFixed(3)}px)` : undefined, moving) }}>
        <div style={{ position: 'absolute', right: W - mx + F.pad * 0.6, top: (rowH - F.pillSize * 1.72) / 2, height: F.pillSize * 1.72, display: 'flex', alignItems: 'center' }}>
          <Pill t={t} states={PILL} size={F.pillSize} />
          <span style={{ display: 'inline-block', width: F.metaGap }} />
          <TypeLabel kind="txt" size={F.metaSize} />
        </div>
        <div style={{ position: 'absolute', left: mx, top: (rowH - F.btn) / 2, width: F.btn, height: F.btn, borderRadius: size * 0.22, display: 'flex', alignItems: 'center', justifyContent: 'center', color: APP.foreground }}>
          <Icon name="ellipsis" size={size * 0.56} stroke={2.4} />
        </div>
      </div>
    </div>
  );
};

/** the paper opening downwards: a soft start, a long settle (the edge decelerates onto the page's bottom) */
const OPEN = Easing.bezier(0.33, 0, 0.2, 1);

export const NewRow: React.FC<{ t: number; S: ChangeStage; g: DocPageGeometry; ink: string; accent: string }> = ({ t, S, g, ink, accent }) => {
  const L = useLayout();
  const v = L.vertical;
  // 9:16 has no flight (no parked thumbnail): the new version lands in the slot the list opened for it by itself — a
  // b08 landing (from a touch above, a fade, a hair of scale), its last frames on K.land
  const flies = !!S.file.park;
  const landAt = flies ? K.land : K.land - 6;
  if (t < landAt) return null;
  const B = newRowBox(S);
  const size = S.row.size;
  const layout = S.row.layout;
  // in the list (landed → the lift): the row itself — its face already whole (the flight brought it in)
  if (t < K.lift[0]) {
    const s = flies ? 1 : springUnit(t - landAt, SPRING.land);
    // (9:16's top slot is 12 px under the tab bar — stage.ts listOnly: it drops in from just under the bar, never over it)
    const dy = -(1 - s) * (S.listOnly ? 0.06 : 0.18) * B.h;
    return (
      <Row
        t={t}
        x={B.x}
        y={B.y + dy}
        w={B.w}
        h={B.h}
        layout={layout}
        size={size}
        pillSize={S.row.pill}
        kind="txt"
        name="Opening hours"
        pill={PILL}
        pillLead
        opacity={flies ? 1 : smooth(0, 0.3, s)}
        scale={flies ? 1 : 0.985 + 0.015 * Math.min(1, s)}
        moving={t < K.land + 12}
      />
    );
  }
  /* ── lifted out, unfolding into the page ── */
  const F = rowFace(size, layout, B.h, S.row.pill);
  const ps = g.spec.size;
  const pad = g.pad;
  const labelSize = typeStyle('label', v).fontSize as number;
  const headTop = pad;
  const headSize = ps * 1.08;
  const headY = pad + labelSize * 1.5;
  const [u0, u1] = K.unfold;
  // the lift: off the list (elevation 0 → 3.4, a hair larger)
  const lf = springUnit(t - K.lift[0], { stiffness: 260, damping: 26, mass: 1 });
  // 1 · the paper narrows and travels to the page's width and place (the row's height kept)
  const hx = ease(t, u0, u0 + 10, EASE.inOut);
  // 2 · it opens downwards (from 3 frames into the narrowing — one move, never a blank strip); everything inside is
  //     revealed by this one moving bottom edge
  const hv = ease(t, u0 + 3, u0 + 16, OPEN);
  const grow = 1 + 0.012 * Math.min(1, lf) * (1 - hx);
  const x0 = B.x - (B.w * (grow - 1)) / 2;
  const y0 = B.y - (B.h * (grow - 1)) / 2;
  const x = lerp(x0, g.card.x, hx);
  const y = lerp(y0, g.card.y, hx);
  const w = lerp(B.w * grow, g.card.w, hx);
  const h = lerp(B.h * grow, g.card.h, hv);
  const radius = lerp(B.radius, ps * 0.22, hx);
  const lift = lerp(3.4 * Math.min(1, lf), 3, hx);
  const moving = t < u1 + 0.5 || lf < 0.999;
  // the row's face leaving AS the paper changes (never a blank strip): pill + type word + … ride the narrowing right
  // edge and go, the tile after them
  const rowOut = ease(t, u0 + 2, u0 + 7, EASE.in3);
  // the status line (pill + type word) FADES where it sits, drifting up a hair (PILL_DRIFT px, less than the gap over
  // it) — no mask: rising through one sliced it flat along an invisible edge just under the title / the paper's top
  // (polish round 2). The two-line row's goes first, as the row lifts, before the name travels down past it
  const pillOut = layout === 'stack' ? ease(t, u0 - 3, u0 + 1.5, EASE.inOut) : ease(t, u0 + 1, u0 + 5.5, EASE.inOut);
  const PILL_DRIFT = 6;
  const tileA = 1 - ease(t, u0 + 4, u0 + 9, EASE.inOut);
  // name → heading, driven by the opening edge: it is down at the heading's place (and at its size) once the paper is
  // tall enough to hold it (hv ≈ .35), always inside the paper
  const hn = EASE.inOut(Math.min(1, hv / 0.35));
  const hxp = ease(t, u0 + 2, u0 + 10, EASE.inOut);
  const nx = lerp(F.nameX, pad, hxp);
  const ny = lerp(F.nameY, headY, hn);
  const nsc = lerp(size, headSize, hn) / headSize;
  const nWeight = lerp(TYPE.title.weight, 560, hn);
  // the page's kind line: rises into its place through its own mask once the name has gone down past it
  const kindAt = u0 + 7.5;
  // "Saturday": the sweep under the new line; the others settle to 40 % (b10's)
  const sp = t >= K.sweep[0] ? tween(t, [K.sweep[0], K.sweep[1]], [0, 1], EASE.draw) : 0;
  const dimO = tween(t, [K.sweep[0], K.sweep[0] + 15], [1, 0.4], EASE.inOut);
  const title = typeStyle('title', v, { size: ps, tabular: true });
  const sweepH = ps * 1.22;
  const borderA = 1 - hx;
  const contentOn = hv > 0;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, ...subpixel(`translate(${x.toFixed(3)}px, ${y.toFixed(3)}px)`, moving) }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, borderRadius: radius, boxShadow: lift > 0.01 ? meshElevation(lift, ink, Math.min(1, lift / 1.2)) : undefined }} />
      <svg width={Math.ceil(w) + 2} height={Math.ceil(h) + 2} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} aria-hidden>
        <rect x={0} y={0} width={w} height={h} rx={radius} ry={radius} fill={APP.card} />
        {borderA > 0.001 ? <rect x={0.625} y={0.625} width={Math.max(0, w - 1.25)} height={Math.max(0, h - 1.25)} rx={Math.max(0, radius - 0.6)} fill="none" stroke={APP.border} strokeWidth={1.25} strokeOpacity={borderA} /> : null}
      </svg>
      <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, overflow: 'hidden', borderRadius: radius }}>
        {tileA > 0.001 ? <KindTile kind="txt" side={F.tile} icon={F.icon} radius={F.radius} style={{ position: 'absolute', left: F.pad, top: (B.h - F.tile) / 2, opacity: tileA }} /> : null}
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
            ...subpixel(`translate(${nx.toFixed(3)}px, ${ny.toFixed(3)}px) scale(${nsc.toFixed(5)})`, hn > 0 && hn < 1),
          }}
        >
          Opening hours
        </div>
        {layout === 'stack' && pillOut < 1 ? (
          // the two-line row's status line (under the name), leaving up through its mask
          <div style={{ position: 'absolute', left: F.nameX, top: F.nameY + size * 1.27 }}>
            <div style={{ transform: `translateY(${(-pillOut * PILL_DRIFT).toFixed(3)}px)`, opacity: 1 - pillOut, display: 'flex', alignItems: 'center', height: F.pillSize * 1.72 }}>
              <Pill t={t} states={PILL} size={F.pillSize} />
              <span style={{ display: 'inline-block', width: F.metaGap }} />
              <TypeLabel kind="txt" size={F.metaSize} />
            </div>
          </div>
        ) : null}
        {rowOut < 1 ? (
          // the right-hand group rides the paper's right edge (laid out for the row's own width)
          <div style={{ position: 'absolute', left: 0, top: 0, width: Math.ceil(B.w), height: B.h, ...subpixel(Math.abs(w - B.w) > 0.01 ? `translateX(${(w - B.w).toFixed(3)}px)` : undefined, moving) }}>
            {layout === 'inline' ? (
              <div style={{ position: 'absolute', right: Math.ceil(B.w) - (B.w - F.pad - F.btn) + F.pad * 0.6, top: (B.h - F.pillSize * 1.72) / 2 }}>
                <div style={{ transform: `translateY(${(-pillOut * PILL_DRIFT).toFixed(3)}px)`, opacity: 1 - pillOut, display: 'flex', alignItems: 'center', height: F.pillSize * 1.72 }}>
                  <Pill t={t} states={PILL} size={F.pillSize} />
                  <span style={{ display: 'inline-block', width: F.metaGap }} />
                  <TypeLabel kind="txt" size={F.metaSize} />
                </div>
              </div>
            ) : null}
            <div style={{ position: 'absolute', left: B.w - F.pad - F.btn, top: (B.h - F.btn) / 2, width: F.btn, height: F.btn, display: 'flex', alignItems: 'center', justifyContent: 'center', color: APP.foreground, opacity: 1 - rowOut }}>
              <Icon name="ellipsis" size={size * 0.56} stroke={2.4} />
            </div>
          </div>
        ) : null}
        {/* the page's own content, at its final place in the paper: revealed by the opening edge (the overflow above) */}
        {contentOn ? <div style={{ position: 'absolute', left: pad, top: g.lineRects[0].y - g.card.y - ps * 0.55, width: g.card.w - 2 * pad, height: 1.25, background: APP.border }} /> : null}
        {contentOn
          ? NEW_LINES.map((ln, i) => {
              const r = g.lineRects[i];
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
                  <div style={{ position: 'absolute', left: r.x - g.card.x, top: r.y - g.card.y, ...title, letterSpacing: '-0.02em', color: APP.foreground, whiteSpace: 'nowrap', opacity: swept ? undefined : dimO < 0.999 ? dimO : undefined }}>{ln}</div>
                </React.Fragment>
              );
            })
          : null}
      </div>
    </div>
  );
};
