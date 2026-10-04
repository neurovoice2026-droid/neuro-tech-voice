/**
 * THE OPENING HOURS PAGE (SCRIPT.md b10–b11) — the document behind the answer, "the site's own sample lines" on paper:
 *
 *   rowIn    the TXT · Opening hours row comes back — 16:9 sliding in from the right edge, where the panel went;
 *            9:16 lifted out of the receded panel — on a glide, its paper rising off the ground (elevation 0 → 3)
 *   unfold   the row's paper opens into the full page (one SVG rect: its box, its corner, exact at every
 *            fractional edge) and it is ONE object becoming another: the row's name glides and grows into the page's
 *            heading (its weight easing 480 → 560 on the variable face), the kind token leaves its tile for the page's
 *            kind line, the pill and the … leave up through their masks; the rule draws, the three lines rise on 16ths
 *   sweep    "the part that answers them": a flat sunday band (12 %, EASE.draw, .5 s, no glow) under Saturday, then
 *            Sunday a 16th behind; the weekday line settles to 40 %
 *   b11      the page dims to 25 % (16:9 in place beside the answer; 9:16 receding behind it) and its two swept lines
 *            are lifted out as their own small layer (<LiftedLines>: a white strip of the page, elevation 0 → 6) —
 *            the source the word re-set takes its words from (call/Answer.tsx)
 */
import React from 'react';
import { reveal, revealStyle } from '../../../components/Type';
import { subpixel } from '../../../lib/glide';
import { useLayout } from '../../../lib/layout';
import { EASE, mix, smooth, SPRING, springUnit, tween } from '../../../lib/motion';
import { maskBox, typeStyle } from '../../../lib/type';
import { TYPE } from '../../../theme';
import { APP, Icon, meshElevation, measureText, Pill, useDocPage, useKitFaces, type DocPageGeometry } from '../../kit';
import { MOMENT_LIGHTS } from '../../palettes';
import { CALL_LOCAL as C } from '../../timing';
import { ROWS, writtenStage } from '../written/stage';
import { HOURS, panelTransform } from './Panel';
import { ease, lerp, pageDimAt, type CallStage } from './stage';

const SUNDAY = MOMENT_LIGHTS.sunday.ink;
export const PAGE_LINES = ['Monday to Friday · 8:00–20:00', 'Saturday · 9:00–14:00', 'Sunday · closed'] as const;
/** the swept lines (Saturday, Sunday) */
export const SWEPT = [1, 2] as const;

export type PageGeo = DocPageGeometry & { h: number };

/** the page's geometry (the kit's DocPage layout; the paper at least `minH` tall: a sheet, not a card) */
export function usePage(S: CallStage): PageGeo {
  useKitFaces();
  const P = S.page;
  const g = useDocPage({ x: P.x, y: P.y, w: P.w, title: 'Opening hours', lines: PAGE_LINES, kind: 'TXT', size: P.size });
  return { ...g, h: Math.max(g.card.h, P.minH) };
}

/** the row's geometry at its own size (written/Row.tsx: kept in step with it) */
function rowGeo(S: CallStage) {
  const WS = writtenStage(S.vertical);
  const size = WS.row.size;
  const layout = WS.row.layout;
  const h = WS.row.h;
  const w = WS.list.w;
  const pad = size * 0.42;
  const tokenSize = Math.max(24, Math.round(size * 0.5));
  const tile = layout === 'stack' ? size * 1.5 : size * 1.4;
  const tileW = Math.max(tile, measureText('DOCX', { size: tokenSize, weight: TYPE.label.weight, tracking: 0.08 }) + size * 0.6);
  const pillSize = Math.max(26, Math.round(size * 0.6));
  const btn = size * 1.05;
  const nameX = pad * 2 + tileW;
  const nameY = layout === 'stack' ? h / 2 - (size * 1.05 + size * 0.22 + pillSize * 1.72) / 2 : (h - size * 1.05) / 2;
  return { WS, size, layout, h, w, pad, tokenSize, tile, tileW, pillSize, btn, nameX, nameY, radius: size * 0.32 };
}

/** where the row is at the start of its return: 16:9 off the right edge; 9:16 its place in the receded panel */
function rowStart(S: CallStage, R: ReturnType<typeof rowGeo>) {
  if (S.rowFrom) return { x: S.rowFrom.x, y: S.rowFrom.y, k: 1 };
  const row = S.from.rows.find((r) => r.name === ROWS[HOURS].name)!;
  const tr = panelTransform(C.rowIn[0], S);
  const p = tr.map(row.x, row.y);
  return { x: p.x, y: p.y, k: tr.scale };
}

/** the page's pose in b11 (dim, recede) */
export function pagePoseC(t: number, S: CallStage, g: PageGeo) {
  const u = pageDimAt(t);
  const P = S.pageC;
  const sc = lerp(1, P.scale, u);
  return { u, scale: sc, dx: P.dx * u, dy: P.dy * u, fade: lerp(1, P.fade, u), shade: 0.05 * u, cx: g.card.x + g.card.w / 2, cy: g.card.y + g.h / 2 };
}

export const OpeningHoursPage: React.FC<{ t: number; S: CallStage; g: PageGeo; ink: string }> = ({ t, S, g, ink }) => {
  const L = useLayout();
  const v = L.vertical;
  if (t < C.rowIn[0]) return null;
  const R = rowGeo(S);
  const st = rowStart(S, R);
  const size = g.spec.size;
  const pad = g.pad;
  const labelSize = typeStyle('label', v).fontSize as number;
  const headTop = pad + labelSize * 1.5;
  const headSize = size * 1.08;

  /* the fetch: the row (at its own size) from its start to where it waits — 16:9 in from the right edge, 9:16 lifted
     out of the receded panel on a small arc — then, after the freeze, from there into the page's box */
  const fl = t < C.rowIn[0] ? 0 : springUnit(t - C.rowIn[0], { stiffness: 140, damping: 23, mass: 1 });
  const k0 = st.k;
  const hx = lerp(st.x, S.rowHold.x, fl);
  const hy = lerp(st.y, S.rowHold.y, fl) - (S.rowFrom ? 0 : 30 * Math.sin(Math.PI * Math.min(1, fl)));
  const rk = lerp(k0, 1, Math.min(1, fl));
  /* the unfold: the paper opens from the row's box to the page's, travelling to the page's place */
  const un = ease(t, C.unfold[0], C.unfold[1], EASE.inOut);
  const rx = lerp(hx, g.card.x, un);
  const ry = lerp(hy, g.card.y, un);
  const w = lerp(R.w * rk, g.card.w, un);
  const h = lerp(R.h * rk, g.h, un);
  const radius = lerp(R.radius * rk, size * 0.22, un);
  // the paper rises off the ground as it is fetched (it is held a touch higher while it waits)
  const lift = lerp(3.4, 3, un) * smooth(0, 0.4, fl);
  const moving = fl < 0.9995 || (un > 0 && un < 1);

  /* b11: the page dims and (9:16) recedes */
  const pc = pagePoseC(t, S, g);
  const cardTf = `translate(${rx.toFixed(3)}px, ${ry.toFixed(3)}px)`;
  const outer = pc.u > 0 ? `translate(${pc.dx.toFixed(3)}px, ${pc.dy.toFixed(3)}px) scale(${pc.scale.toFixed(5)})` : undefined;

  /* the row's face, leaving: tile + token, name → heading, pill, … */
  const rowOut = ease(t, C.unfold[0] - 6, C.unfold[0] + 2, EASE.in3);
  // the pill's width (kit/ui.tsx Pill: icon 1em + gap .33em + label + 2 × .67em padding)
  const pillW = measureText(`Ready · ${ROWS[HOURS].n} passage${ROWS[HOURS].n === 1 ? '' : 's'}`, { size: R.pillSize, weight: 520 }) + 2.67 * R.pillSize;
  const tileA = 1 - ease(t, C.unfold[0], C.unfold[0] + 10, EASE.inOut);
  // name → heading: position and size (by transform), weight on the variable face
  const nameS = R.size * rk;
  // the name travels second, down first and then left (the token has gone up to its line by then: they never cross)
  const hm = ease(t, C.unfold[0] + 3, C.unfold[1] - 1, EASE.inOut);
  const hyp = ease(t, C.unfold[0] + 2, C.unfold[0] + 15, EASE.inOut);
  const hxp = ease(t, C.unfold[0] + 9, C.unfold[1] - 1, EASE.inOut);
  const nx = lerp(R.nameX * rk, pad, hxp);
  const ny = lerp(R.nameY * rk, headTop, hyp);
  const nsc = lerp(nameS, headSize, hm) / headSize;
  const nWeight = lerp(TYPE.title.weight, 560, hm);
  // token: the tile's centre → the page's kind line — first, and quick (out of the name's way)
  const hk = ease(t, C.unfold[0] - 1, C.unfold[0] + 10, EASE.out3);
  const tokS = lerp(R.tokenSize * rk, labelSize, hk);
  const tokW0 = measureText('TXT', { size: R.tokenSize * rk, weight: TYPE.label.weight, tracking: 0.08 });
  const tx = lerp(R.pad * rk + (R.tileW * rk - tokW0) / 2, pad, hk);
  const ty = lerp((R.h * rk - R.tokenSize * rk * 1.2) / 2, pad, hk);
  const tokTrack = lerp(0.08, 0.14, hk);
  // the page's own content: rule + lines on 16ths
  const ruleP = tween(t, [C.unfold[1] - 8, C.unfold[1] + 4], [0, 1], EASE.draw);
  const linesAt = (i: number) => C.unfold[1] - 6 + i * 3.75;
  const dimW = tween(t, [C.sweep, C.sweep + 15], [1, 0.4], EASE.inOut);
  // the swept lines leave the page with the lifted layer, and come back to it faintly once that layer has cleared
  // (the page stays whole, dim, behind the answer — never a double image of the same line)
  const sweptA = t < C.lift[0] ? undefined : tween(t, [C.lift[0] + 12, C.lift[0] + 24], [0, 1], EASE.inOut);
  const fade = pc.fade;
  const title = typeStyle('title', v, { size, tabular: true });
  const sweepH = size * 1.22;

  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: S.W, height: S.H, transformOrigin: `${pc.cx}px ${pc.cy}px`, ...subpixel(outer, pc.u > 0 && pc.u < 1) }}>
      <div style={{ position: 'absolute', left: 0, top: 0, ...subpixel(cardTf, moving) }}>
        {/* the paper: one rect (its shadow on a div behind it) */}
        <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, borderRadius: radius, boxShadow: meshElevation(lift, ink) }} />
        <svg width={Math.ceil(w) + 2} height={Math.ceil(h) + 2} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} aria-hidden>
          <rect x={0} y={0} width={w} height={h} rx={radius} ry={radius} fill={APP.card} />
          {un < 1 ? <rect x={0.625} y={0.625} width={Math.max(0, w - 1.25)} height={Math.max(0, h - 1.25)} rx={Math.max(0, radius - 0.6)} fill="none" stroke={APP.border} strokeWidth={1.25} strokeOpacity={1 - un} /> : null}
        </svg>
        <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, overflow: 'hidden', borderRadius: radius, opacity: fade < 0.999 ? fade : undefined }}>
          {/* the row's tile (its muted square), fading as the token leaves it */}
          {tileA > 0.001 ? (
            <div style={{ position: 'absolute', left: R.pad * rk, top: (R.h * rk - R.tile * rk) / 2, width: R.tileW * rk, height: R.tile * rk, borderRadius: R.size * 0.24 * rk, background: APP.muted, opacity: tileA }} />
          ) : null}
          {/* the kind token TXT: tile → kind line */}
          <div style={{ position: 'absolute', left: tx, top: ty, ...typeStyle('label', v, { size: tokS }), letterSpacing: `${tokTrack}em`, color: APP.mutedFg, lineHeight: 1.2, whiteSpace: 'nowrap' }}>TXT</div>
          {/* the name → the heading */}
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
          {/* the pill and the … leave up through their masks */}
          {rowOut < 1 ? (
            <>
              <div style={{ position: 'absolute', left: (R.layout === 'stack' ? R.nameX : R.w - R.pad - R.btn - R.pad * 0.6 - pillW) * rk, top: (R.layout === 'stack' ? R.nameY + R.size * 1.27 : (R.h - R.pillSize * 1.72) / 2) * rk, overflow: 'hidden' }}>
                <div style={{ transform: `translateY(${(-rowOut * 120).toFixed(2)}%) scale(${rk.toFixed(4)})`, transformOrigin: '0 0', opacity: 1 - smooth(0.3, 1, rowOut), display: 'flex' }}>
                  <Pill t={0} states={[{ at: -1, kind: 'ready', n: ROWS[HOURS].n }]} size={R.pillSize} />
                </div>
              </div>
              <div style={{ position: 'absolute', left: (R.w - R.pad - R.btn) * rk, top: ((R.h - R.btn) / 2) * rk, width: R.btn * rk, height: R.btn * rk, display: 'flex', alignItems: 'center', justifyContent: 'center', color: APP.foreground, opacity: 1 - rowOut }}>
                <Icon name="ellipsis" size={R.size * 0.56 * rk} stroke={2.4} />
              </div>
            </>
          ) : null}
          {pc.shade > 0.001 ? <div style={{ position: 'absolute', inset: 0, background: `rgba(20, 10, 36, ${pc.shade.toFixed(4)})` }} /> : null}
          {/* the page: the rule draws, the lines rise on 16ths */}
          {ruleP > 0 ? <div style={{ position: 'absolute', left: pad, top: g.lineRects[0].y - g.card.y - size * 0.55, width: (g.card.w - 2 * pad) * ruleP, height: 1.25, background: APP.border }} /> : null}
          {PAGE_LINES.map((ln, i) => {
            if (t < linesAt(i) - 0.5) return null;
            const r = g.lineRects[i];
            const rv = reveal(t, linesAt(i), { config: SPRING.text, rise: 90, fade: 0.5 });
            const swept = (SWEPT as readonly number[]).includes(i);
            const sAt = C.sweep + (i - 1) * 3.75;
            const sp = swept && t >= sAt && (sweptA ?? 1) > 0.001 ? tween(t, [sAt, sAt + 15], [0, 1], EASE.draw) : 0;
            return (
              <React.Fragment key={i}>
                {sp > 0 ? (
                  <div
                    style={{
                      position: 'absolute',
                      left: r.x - g.card.x - size * 0.14,
                      top: r.y - g.card.y - size * 0.02,
                      width: r.w + size * 0.28,
                      height: sweepH,
                      borderRadius: sweepH * 0.16,
                      background: SUNDAY,
                      opacity: 0.12 * (sweptA ?? 1),
                      clipPath: `inset(0 ${((1 - sp) * 100).toFixed(3)}% 0 0 round ${(sweepH * 0.16).toFixed(1)}px)`,
                    }}
                  />
                ) : null}
                <div style={{ position: 'absolute', left: r.x - g.card.x, top: r.y - g.card.y, ...maskBox(0), opacity: i === 0 ? dimW : swept ? sweptA : undefined }}>
                  <span style={{ ...revealStyle(rv, undefined, t - linesAt(i) < 18), ...title, letterSpacing: '-0.02em', color: APP.foreground, whiteSpace: 'nowrap' }}>{ln}</span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/** the two swept lines' block (frame px, the page at its B pose) — where the hairlines land, and the lift's source */
export function sweptBlock(g: PageGeo) {
  const size = g.spec.size;
  const a = g.lineRects[SWEPT[0]];
  const b = g.lineRects[SWEPT[1]];
  const x = a.x - size * 0.14;
  const y = a.y - size * 0.02;
  return { x, y, w: Math.max(a.w, b.w) + size * 0.28, h: b.y + size * 1.2 - y, cy: (a.cy + b.cy) / 2, left: x, size };
}

/**
 * b11: the two swept lines lifted out of the page as their own small layer — a white strip of the page, its sweep
 * bands still under the lines, rising off the page (elevation 0 → 6) and gliding a little toward the answer. The
 * WORDS are drawn by the re-set (call/Answer.tsx) at liftedSource(); this is their paper, which empties as the words
 * leave (a band fades as its line empties) and goes once the last kept word has left.
 */
export function liftAt(t: number) {
  return t < C.lift[0] ? 0 : springUnit(t - C.lift[0], { stiffness: 150, damping: 22, mass: 1 });
}
export function liftedSource(t: number, S: CallStage, g: PageGeo) {
  const l = liftAt(t);
  const size = g.spec.size;
  const a = g.lineRects[SWEPT[0]];
  return { x: a.x + S.lift.dx * l, y: a.y + S.lift.dy * l, size, lineH: g.lineH, l };
}

export const LiftedLines: React.FC<{ t: number; S: CallStage; g: PageGeo; ink: string; lastKept: number }> = ({ t, S, g, ink, lastKept }) => {
  if (t < C.lift[0]) return null;
  const src = liftedSource(t, S, g);
  const size = g.spec.size;
  const sb = sweptBlock(g);
  const padX = size * 0.34;
  const padY = size * 0.28;
  const x = sb.x - padX + S.lift.dx * src.l;
  const y = sb.y - padY + S.lift.dy * src.l;
  const w = sb.w + 2 * padX;
  const h = sb.h + 2 * padY;
  const out = tween(t, [lastKept + 1, lastKept + 9], [0, 1], EASE.in3);
  if (out >= 1) return null;
  const band1 = 1 - tween(t, [C.resetLeave, C.resetLeave + 10], [0, 1], EASE.inOut);
  const band2 = 1 - tween(t, [lastKept, lastKept + 10], [0, 1], EASE.inOut);
  const lift = 6 * src.l;
  const sweepH = size * 1.22;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, opacity: 1 - out, ...subpixel(`translate(${x.toFixed(3)}px, ${(y - out * 14).toFixed(3)}px)`, true) }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, borderRadius: size * 0.18, background: APP.card, boxShadow: meshElevation(lift, ink) }} />
      {[band1, band2].map((a, i) => {
        const r = g.lineRects[SWEPT[i]];
        if (a <= 0.001) return null;
        return <div key={i} style={{ position: 'absolute', left: padX + (r.x - size * 0.14 - sb.x), top: padY + (r.y - size * 0.02 - sb.y), width: r.w + size * 0.28, height: sweepH, borderRadius: sweepH * 0.16, background: SUNDAY, opacity: 0.12 * a }} />;
      })}
    </div>
  );
};

/** a convenience: the page's lines' left (for links) */
export const lineLeft = (g: PageGeo, i: number) => g.lineRects[i].x;
export { mix };
