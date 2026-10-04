/**
 * THE OPENING HOURS PAGE (SCRIPT.md b10–b11) — the document behind the answer, "the site's own sample lines" on paper:
 *
 *   rowIn    the TXT · Opening hours row comes back — sliding in from where the panel went (16:9 the right edge,
 *            9:16 the bottom edge) — on a glide, its paper rising off the ground (elevation 0 → 3)
 *   unfold   the row's paper opens into the full page (one SVG rect: its box, its corner, exact at every
 *            fractional edge) and it is ONE object becoming another: the row's name glides and grows into the page's
 *            heading (its weight easing 480 → 560 on the variable face), the kind token leaves its tile for the page's
 *            kind line, the pill and the … leave up through their masks; the rule draws, the three lines rise on 16ths
 *   sweep    "the part that answers them": a flat sunday band (12 %, EASE.draw, .5 s, no glow) under Saturday, then
 *            Sunday a 16th behind; the weekday line settles to 40 %
 *   b11      THE RE-SET's page side: the tokens she doesn't say (· 9:00–14:00 ·) leave up through their own masks
 *            and the sweep bands up out of theirs (CALL_LOCAL.drop); the kept words fly from their places here into her
 *            sentence (call/Reset.tsx, CALL_LOCAL.fly); then the page dims to 25 % (16:9 in place beside the answer,
 *            9:16 receding below it) and, as the record lands, recedes out (× .9, opacity → 0)
 *
 * The page is CROPPED TO ITS CONTENT (usePage): kind, heading, three lines at the title role (64 / 56), 48 px padding.
 */
import React from 'react';
import { reveal, revealStyle } from '../../../components/Type';
import { subpixel } from '../../../lib/glide';
import { useLayout } from '../../../lib/layout';
import { EASE, smooth, SPRING, springUnit, tween } from '../../../lib/motion';
import { maskBox, typeStyle } from '../../../lib/type';
import { TYPE } from '../../../theme';
import { APP, Icon, layoutWords, meshElevation, measureText, Pill, useDocPage, useKitFaces, type DocPageGeometry } from '../../kit';
import { MOMENT_LIGHTS } from '../../palettes';
import { CALL_LOCAL as C } from '../../timing';
import { KindTile, rowFace, typeLabelWidth, TypeLabel } from '../written/Row';
import { ROWS, writtenStage } from '../written/stage';
import { HOURS, panelTransform } from './Panel';
import { ease, lerp, pageDimAt, pageOutAt, type CallStage } from './stage';

const SUNDAY = MOMENT_LIGHTS.sunday.ink;
export const PAGE_LINES = ['Monday to Friday · 8:00–20:00', 'Saturday · 9:00–14:00', 'Sunday · closed'] as const;
/** the swept lines (Saturday, Sunday) */
export const SWEPT = [1, 2] as const;

export type PageGeo = DocPageGeometry & { h: number };

/** the page's geometry: the kit's DocPage layout CROPPED TO ITS CONTENT — the card as wide as its longest line plus the
 *  padding (16:9 hung from its right edge, 9:16 centred), as tall as kind + heading + three lines + the padding */
export function usePage(S: CallStage): PageGeo {
  useKitFaces();
  const P = S.page;
  const tSpec = { size: P.size, weight: TYPE.title.weight, tracking: -0.02 };
  const w = Math.ceil(Math.max(...PAGE_LINES.map((ln) => measureText(ln, tSpec)), measureText('Opening hours', { ...tSpec, size: P.size * 1.08, weight: 560 })) + 2 * P.pad);
  const x = P.anchor === 'right' ? P.x - w : P.x - w / 2;
  const g = useDocPage({ x, y: P.y, w, title: 'Opening hours', lines: PAGE_LINES, kind: 'TXT', size: P.size, pad: P.pad });
  return { ...g, h: g.card.h };
}

/** a swept line's tokens (frame px at the page's B pose): the words the re-set takes (Saturday · Sunday · closed) and
 *  the ones she doesn't say (· 9:00–14:00 ·) — laid out exactly as the line is set (no figures before a space: the
 *  tabular figures of "9:00–14:00" never move a token) */
export function sweptTokens(g: PageGeo) {
  const size = g.spec.size;
  const tSpec = { size, weight: TYPE.title.weight, tracking: -0.02 };
  return SWEPT.map((li) => {
    const r = g.lineRects[li];
    return layoutWords(PAGE_LINES[li], tSpec, r.x).words.map((w) => ({ ...w, y: r.y }));
  });
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
  // written/Row.tsx's face: the app's square icon tile (FileText), the type word "Text" after the pill
  const F = rowFace(size, layout, h);
  const tileW = tile;
  const metaW = F.metaGap + typeLabelWidth('txt', F.metaSize);
  const pillSize = Math.max(26, Math.round(size * 0.6));
  const btn = size * 1.05;
  const nameX = pad * 2 + tileW;
  const nameY = layout === 'stack' ? h / 2 - (size * 1.05 + size * 0.22 + pillSize * 1.72) / 2 : (h - size * 1.05) / 2;
  return { WS, size, layout, h, w, pad, tokenSize, tile, tileW, pillSize, btn, nameX, nameY, radius: size * 0.32, F, metaW };
}

/** where the row is at the start of its return: 16:9 off the right edge, 9:16 below the bottom edge (where the panel
 *  went); with no `rowFrom`, its place in the receded panel */
function rowStart(S: CallStage) {
  if (S.rowFrom) return { x: S.rowFrom.x, y: S.rowFrom.y, k: 1 };
  const row = S.from.rows.find((r) => r.name === ROWS[HOURS].name)!;
  const tr = panelTransform(C.rowIn[0], S);
  const p = tr.map(row.x, row.y);
  return { x: p.x, y: p.y, k: tr.scale };
}

/** the page's pose in b11: it dims (and 9:16 recedes) once the kept words have flown out of it; it recedes out
 *  (× .9, opacity → 0) as the record lands */
export function pagePoseC(t: number, S: CallStage, g: PageGeo) {
  const u = pageDimAt(t);
  const o = pageOutAt(t);
  const P = S.pageC;
  const sc = lerp(1, P.scale, u) * (1 - 0.1 * o);
  return { u, o, scale: sc, dx: P.dx * u, dy: P.dy * u, fade: lerp(1, P.fade, u), shade: 0.05 * u, opacity: 1 - o, cx: g.card.x + g.card.w / 2, cy: g.card.y + g.h / 2 };
}

/** the page tokens the re-set keeps ("line:token" of the swept lines: Saturday · Sunday · closed) */
const KEPT = new Set(C.reset.filter((w) => w.from).map((w) => `${w.from![0]}:${w.from![1]}`));

export const OpeningHoursPage: React.FC<{ t: number; S: CallStage; g: PageGeo; ink: string }> = ({ t, S, g, ink }) => {
  const L = useLayout();
  const v = L.vertical;
  if (t < C.rowIn[0]) return null;
  const R = rowGeo(S);
  const st = rowStart(S);
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

  /* b11: the page dims and (9:16) recedes; then it recedes out under the record */
  const pc = pagePoseC(t, S, g);
  if (pc.opacity <= 0.001) return null;
  const cardTf = `translate(${rx.toFixed(3)}px, ${ry.toFixed(3)}px)`;
  const outer = pc.u > 0 || pc.o > 0 ? `translate(${pc.dx.toFixed(3)}px, ${pc.dy.toFixed(3)}px) scale(${pc.scale.toFixed(5)})` : undefined;

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
  // the page's kind line: the row's tile holds the app's FileText icon (written/Row.tsx), not a token, so the line
  // rises into its place on the page through its own mask once the name has gone down past it (they never cross)
  const kindAt = C.unfold[0] + 10;
  // the page's own content: rule + lines on 16ths
  const ruleP = tween(t, [C.unfold[1] - 8, C.unfold[1] + 4], [0, 1], EASE.draw);
  const linesAt = (i: number) => C.unfold[1] - 6 + i * 3.75;
  const dimW = tween(t, [C.sweep, C.sweep + 15], [1, 0.4], EASE.inOut);
  // THE RE-SET's page side (b11): the swept lines are set token by token (exactly where the line sets them); from
  // `drop` the tokens she doesn't say (· 9:00–14:00 ·) leave up through their own masks, a frame apart, and the sweep
  // bands go up out of theirs; the kept words are the re-set's from `fly` (call/Reset.tsx flies them from here)
  const toks = sweptTokens(g);
  const dropped = toks.flatMap((line, li) => line.map((_, k) => `${li}:${k}`)).filter((key) => !KEPT.has(key));
  const fade = pc.fade;
  const title = typeStyle('title', v, { size, tabular: true });
  const sweepH = size * 1.22;

  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: S.W, height: S.H, transformOrigin: `${pc.cx}px ${pc.cy}px`, opacity: pc.opacity < 0.999 ? pc.opacity : undefined, ...subpixel(outer, (pc.u > 0 && pc.u < 1) || (pc.o > 0 && pc.o < 1)) }}>
      <div style={{ position: 'absolute', left: 0, top: 0, ...subpixel(cardTf, moving) }}>
        {/* the paper: one rect (its shadow on a div behind it) */}
        <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, borderRadius: radius, boxShadow: meshElevation(lift, ink) }} />
        <svg width={Math.ceil(w) + 2} height={Math.ceil(h) + 2} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} aria-hidden>
          <rect x={0} y={0} width={w} height={h} rx={radius} ry={radius} fill={APP.card} />
          {un < 1 ? <rect x={0.625} y={0.625} width={Math.max(0, w - 1.25)} height={Math.max(0, h - 1.25)} rx={Math.max(0, radius - 0.6)} fill="none" stroke={APP.border} strokeWidth={1.25} strokeOpacity={1 - un} /> : null}
        </svg>
        <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, overflow: 'hidden', borderRadius: radius, opacity: fade < 0.999 ? fade : undefined }}>
          {/* the row's icon tile (its muted square, FileText), fading as the page opens */}
          {tileA > 0.001 ? (
            <KindTile kind="txt" side={R.tile * rk} icon={R.F.icon * rk} radius={R.F.radius * rk} style={{ position: 'absolute', left: R.pad * rk, top: (R.h * rk - R.tile * rk) / 2, opacity: tileA }} />
          ) : null}
          {/* the page's kind line TXT, rising into place */}
          {t >= kindAt - 0.5 ? (
            <div style={{ position: 'absolute', left: pad, top: pad, ...maskBox(0) }}>
              <span style={{ ...revealStyle(reveal(t, kindAt, { rise: 90, fade: 0.5 }), undefined, t - kindAt < 16), display: 'block', ...typeStyle('label', v, { size: labelSize }), letterSpacing: '0.14em', color: APP.mutedFg, lineHeight: 1.2, whiteSpace: 'nowrap' }}>TXT</span>
            </div>
          ) : null}
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
              <div style={{ position: 'absolute', left: (R.layout === 'stack' ? R.nameX : R.w - R.pad - R.btn - R.pad * 0.6 - pillW - R.metaW) * rk, top: (R.layout === 'stack' ? R.nameY + R.size * 1.27 : (R.h - R.pillSize * 1.72) / 2) * rk, overflow: 'hidden' }}>
                <div style={{ transform: `translateY(${(-rowOut * 120).toFixed(2)}%) scale(${rk.toFixed(4)})`, transformOrigin: '0 0', opacity: 1 - smooth(0.3, 1, rowOut), display: 'flex', alignItems: 'center', height: R.pillSize * 1.72 }}>
                  <Pill t={0} states={[{ at: -1, kind: 'ready', n: ROWS[HOURS].n }]} size={R.pillSize} />
                  <span style={{ display: 'inline-block', width: R.F.metaGap }} />
                  <TypeLabel kind="txt" size={R.F.metaSize} />
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
            const si = (SWEPT as readonly number[]).indexOf(i);
            const swept = si >= 0;
            const sAt = C.sweep + (i - 1) * 3.75;
            const sp = swept && t >= sAt ? tween(t, [sAt, sAt + 15], [0, 1], EASE.draw) : 0;
            // the band leaves up out of its own mask (no box ever outlives its words)
            const bq = swept ? tween(t, [C.drop + si, C.drop + si + 6], [0, 1], EASE.in3) : 0;
            const bandR = sweepH * 0.16;
            return (
              <React.Fragment key={i}>
                {sp > 0 && bq < 1 ? (
                  <div style={{ position: 'absolute', left: r.x - g.card.x - size * 0.14, top: r.y - g.card.y - size * 0.02, width: r.w + size * 0.28, height: sweepH, overflow: 'hidden', borderRadius: bandR }}>
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: bandR,
                        background: SUNDAY,
                        opacity: 0.12 * (1 - smooth(0.35, 1, bq)),
                        transform: bq > 0 ? `translateY(${(-bq * 110).toFixed(3)}%)` : undefined,
                        clipPath: `inset(0 ${((1 - sp) * 100).toFixed(3)}% 0 0 round ${bandR.toFixed(1)}px)`,
                      }}
                    />
                  </div>
                ) : null}
                {swept ? (
                  toks[si].map((tok, k) => {
                    const key = `${si}:${k}`;
                    const kept = KEPT.has(key);
                    if (kept && t >= C.fly[0]) return null;
                    const di = dropped.indexOf(key);
                    const at = C.drop + Math.max(0, di);
                    const rt = kept ? rv : reveal(t, linesAt(i), { config: SPRING.text, rise: 90, fade: 0.5, exit: { at, dur: 6 } });
                    if (!kept && t > at + 6) return null;
                    return (
                      <div key={k} style={{ position: 'absolute', left: tok.x - g.card.x, top: r.y - g.card.y, ...maskBox(0) }}>
                        <span style={{ ...revealStyle(rt, undefined, t - linesAt(i) < 18 || (!kept && t > at - 1)), ...title, letterSpacing: '-0.02em', color: APP.foreground, whiteSpace: 'nowrap' }}>{tok.text}</span>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ position: 'absolute', left: r.x - g.card.x, top: r.y - g.card.y, ...maskBox(0), opacity: i === 0 ? dimW : undefined }}>
                    <span style={{ ...revealStyle(rv, undefined, t - linesAt(i) < 18), ...title, letterSpacing: '-0.02em', color: APP.foreground, whiteSpace: 'nowrap' }}>{ln}</span>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/** the two swept lines' block (frame px, the page at its B pose) — where the hairlines land */
export function sweptBlock(g: PageGeo) {
  const size = g.spec.size;
  const a = g.lineRects[SWEPT[0]];
  const b = g.lineRects[SWEPT[1]];
  const x = a.x - size * 0.14;
  const y = a.y - size * 0.02;
  return { x, y, w: Math.max(a.w, b.w) + size * 0.28, h: b.y + size * 1.2 - y, cy: (a.cy + b.cy) / 2, left: x, size };
}
