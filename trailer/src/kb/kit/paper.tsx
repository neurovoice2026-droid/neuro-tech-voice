/**
 * THE PAPER PARTS — the film's objects that are not app chrome (SCRIPT.md "New" build notes), in the
 * house type system, blur-free, every value a pure function of t:
 *
 *   <DocPage> / useDocPage()   a paper document (kind token + heading + lines in the title role with
 *                              tabular figures), or — with `fileName` — the owner's own file (a Geist
 *                              Mono name, no app chrome); ink sweeps, dimmed lines, and an in-place edit
 *                              (caret → selection wash → keystrokes on 16ths)
 *   <InkSweep>                 the flat accent band that draws under a line (12 %, EASE.draw, .5 s, no glow)
 *   <SlipStack>                slips of paper: landing on a pile → fanning into one column → collapsing
 *                              into one slip (each slides under the one above, on 16ths)
 *   <FlipWord>                 a split-flap window that flips on the given beats — to the same word
 *   <MeaningLink>              a hairline curve drawn between two points, its tag at the midpoint
 *   <WordReset>                page lines re-setting into a spoken sentence on the word onsets: kept
 *                              words glide (sub-pixel) to their new pen positions, dropped tokens leave
 *                              up through their masks, new words rise in
 */
import React from 'react';
import { random } from 'remotion';
import { reveal, revealStyle } from '../../components/Type';
import { subpixel } from '../../lib/glide';
import { useLayout } from '../../lib/layout';
import { mixColor } from '../../lib/lights';
import { EASE, mix, mixHex, smooth, SPRING, springUnit, tween } from '../../lib/motion';
import { maskBox, typeStyle } from '../../lib/type';
import { TYPE } from '../../theme';
import { APP, meshElevation } from './ui';
import { layoutWords, measureText, spaceWidth, ui, useKitFaces } from './type';
import type { Rect } from './cursor';

/* ── InkSweep ───────────────────────────────────────────────────── */

/** A flat accent band drawing left → right under a line: 12 % of the accent, EASE.draw over `dur` (15 = .5 s). */
export const InkSweep: React.FC<{ t: number; at: number; x: number; y: number; w: number; h: number; color: string; dur?: number; alpha?: number; radius?: number }> = ({
  t,
  at,
  x,
  y,
  w,
  h,
  color,
  dur = 15,
  alpha = 0.12,
  radius,
}) => {
  if (t < at) return null;
  const p = tween(t, [at, at + dur], [0, 1], EASE.draw);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: radius ?? h * 0.16,
        background: color,
        opacity: alpha,
        // the band's right edge is the pen: a clip, so the band is flat (no stretched corners)
        clipPath: `inset(0 ${((1 - p) * 100).toFixed(3)}% 0 0 round ${(radius ?? h * 0.16).toFixed(1)}px)`,
      }}
    />
  );
};

/* ── DocPage ────────────────────────────────────────────────────── */

export type DocPageSpec = {
  x: number;
  y: number;
  w: number;
  /** the heading (title role) */
  title: string;
  lines: readonly string[];
  /** the kind token above the heading (label role); ignored in the owner's-file mode */
  kind?: string;
  /** the owner's own file: a Geist Mono file name on top, no kind token, no app chrome */
  fileName?: string;
  /** line size px (default the house title role 64 / 56) */
  size?: number;
};

export type DocPageGeometry = {
  spec: Required<Omit<DocPageSpec, 'fileName' | 'kind'>> & { fileName?: string; kind?: string };
  card: Rect;
  /** each line's text box (frame px) */
  lineRects: (Rect & { cx: number; cy: number })[];
  /** the box of a substring of line i (to aim a caret, a link, a selection) */
  spanRect: (i: number, text: string) => Rect & { cx: number; cy: number };
  pad: number;
  lineH: number;
};

export function useDocPage(spec: DocPageSpec): DocPageGeometry {
  const L = useLayout();
  useKitFaces();
  const size = spec.size ?? (typeStyle('title', L.vertical).fontSize as number);
  const pad = size * 0.95;
  const lineH = size * 1.62;
  const labelSize = typeStyle('label', L.vertical).fontSize as number;
  const headTop = spec.y + pad;
  const headH = (spec.fileName ? size * 0.62 * 1.6 : labelSize * 1.5) + size * 1.25;
  const ruleY = headTop + headH + size * 0.3;
  const firstY = ruleY + size * 0.55;
  const tSpec = { size, weight: TYPE.title.weight, tracking: -0.02 };
  const lineRects = spec.lines.map((ln, i) => {
    const w = measureText(ln, tSpec);
    const y = firstY + i * lineH;
    return { x: spec.x + pad, y, w, h: size * 1.18, cx: spec.x + pad + w / 2, cy: y + size * 0.59 };
  });
  const h = firstY + spec.lines.length * lineH - lineH + size * 1.18 + pad - spec.y;
  const spanRect = (i: number, text: string) => {
    const ln = spec.lines[i];
    const k = ln.indexOf(text);
    const x0 = spec.x + pad + (k > 0 ? measureText(ln.slice(0, k), tSpec) : 0);
    const w = measureText(text, tSpec);
    const r = lineRects[i];
    return { x: x0, y: r.y, w, h: r.h, cx: x0 + w / 2, cy: r.cy };
  };
  return { spec: { ...spec, size }, card: { x: spec.x, y: spec.y, w: spec.w, h }, lineRects, spanRect, pad, lineH };
}

export type DocEdit = {
  line: number;
  /** the text replaced (selected, then typed over) */
  find: string;
  replace: string;
  /** the caret clicks into the selection's end */
  caretAt: number;
  /** the selection wash draws over `find` */
  selectAt: number;
  /** one keystroke per character of `replace` (16ths) */
  keysAt: readonly number[];
  color: string;
};

export const DocPage: React.FC<{
  page: DocPageGeometry;
  t: number;
  sweep?: { lines: readonly number[]; at: number; color: string; dur?: number };
  dim?: { lines: readonly number[]; at: number; to?: number };
  edit?: DocEdit;
  /** the whole page's own dim (a page behind a sentence) */
  fade?: number;
  /** lines lifted out of the page (a WordReset carries them now): not drawn here, nor their sweep */
  hide?: readonly number[];
  ink?: string;
  lift?: number;
  dx?: number;
  dy?: number;
  scale?: number;
  opacity?: number;
}> = ({ page: g, t, sweep, dim, edit, fade = 1, hide = [], ink, lift = 3, dx = 0, dy = 0, scale = 1, opacity = 1 }) => {
  const L = useLayout();
  const { spec, card, lineRects, pad } = g;
  const size = spec.size;
  const title = typeStyle('title', L.vertical, { size, tabular: true });
  const ox = card.x;
  const oy = card.y;
  const sweepH = size * 1.22;
  const moving = Math.abs(scale - 1) > 1e-5 || Math.abs(dx % 1) > 1e-3 || Math.abs(dy % 1) > 1e-3;
  const tf = `translate(${(card.x + dx).toFixed(3)}px, ${(card.y + dy).toFixed(3)}px)${Math.abs(scale - 1) > 1e-5 ? ` scale(${scale.toFixed(5)})` : ''}`;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: card.w,
        height: card.h,
        borderRadius: size * 0.22,
        background: APP.card,
        boxShadow: meshElevation(lift, ink),
        opacity: opacity >= 0.999 ? undefined : opacity,
        transformOrigin: '50% 50%',
        ...subpixel(tf, moving),
      }}
    >
      <div style={{ position: 'absolute', inset: 0, opacity: fade }}>
        {spec.fileName ? (
          <div style={{ position: 'absolute', left: pad, top: pad, ...ui(size * 0.62, 460, { mono: true }), color: APP.mutedFg }}>{spec.fileName}</div>
        ) : spec.kind ? (
          <div style={{ position: 'absolute', left: pad, top: pad, ...typeStyle('label', L.vertical), color: APP.mutedFg }}>{spec.kind}</div>
        ) : null}
        <div
          style={{
            position: 'absolute',
            left: pad,
            top: pad + (spec.fileName ? size * 0.62 * 1.6 : (typeStyle('label', L.vertical).fontSize as number) * 1.5),
            ...typeStyle('title', L.vertical, { size: size * 1.08, weight: 560 }),
            color: APP.foreground,
            whiteSpace: 'nowrap',
          }}
        >
          {spec.title}
        </div>
        <div style={{ position: 'absolute', left: pad, right: pad, top: lineRects[0].y - oy - size * 0.55 + size * 0.0, height: 1.25, background: APP.border }} />
        {spec.lines.map((ln, i) => {
          if (hide.includes(i)) return null;
          const r = lineRects[i];
          const swept = sweep && sweep.lines.includes(i);
          const dimmed = dim && dim.lines.includes(i) ? tween(t, [dim.at, dim.at + 15], [1, dim.to ?? 0.4], EASE.inOut) : 1;
          let content: React.ReactNode = ln;
          let wash: React.ReactNode = null;
          let caret: React.ReactNode = null;
          if (edit && edit.line === i) {
            const k = ln.indexOf(edit.find);
            const pre = ln.slice(0, k);
            const post = ln.slice(k + edit.find.length);
            const typedN = edit.keysAt.filter((f) => f <= t).length;
            const sel = g.spanRect(i, edit.find);
            const preW = measureText(pre, { size, weight: TYPE.title.weight, tracking: -0.02 });
            if (t >= edit.selectAt && typedN === 0) {
              const p = tween(t, [edit.selectAt, edit.selectAt + 4], [0, 1], EASE.out3);
              wash = <div style={{ position: 'absolute', left: sel.x - ox, top: r.y - oy - size * 0.02, width: sel.w * p, height: sweepH, background: edit.color, opacity: 0.16, borderRadius: size * 0.08 }} />;
            }
            const typedText = edit.replace.slice(0, typedN);
            content =
              typedN === 0 ? (
                ln
              ) : (
                <>
                  {pre}
                  {typedText.split('').map((ch, j) => {
                    const at = edit.keysAt[j];
                    const rv = reveal(t, at, { config: SPRING.caption, rise: 55, fade: 0.4 });
                    return (
                      <span key={j} style={{ ...maskBox(0), margin: `-0.16em 0 -0.22em 0`, padding: `0.16em 0 0.22em 0` }}>
                        <span style={revealStyle(rv, undefined, t - at < 10)}>{ch}</span>
                      </span>
                    );
                  })}
                  {post}
                </>
              );
            if (t >= edit.caretAt) {
              const cx = typedN === 0 ? sel.x + sel.w - ox : pre ? preW + measureText(typedText, { size, weight: TYPE.title.weight, tracking: -0.02 }) + r.x - ox : r.x - ox;
              const idle = typedN === 0 || t > edit.keysAt[edit.keysAt.length - 1] + 8;
              const ph = (((t - edit.caretAt) % 30) + 30) % 30;
              const blink = idle && t - edit.caretAt > 6 ? (ph < 15 ? 1 : 1 - smooth(15, 16.5, ph)) : 1;
              caret = <div style={{ position: 'absolute', left: cx + size * 0.03, top: r.y - oy + size * 0.02, width: Math.max(2, size * 0.055), height: size * 1.12, background: APP.foreground, opacity: blink }} />;
            }
          }
          return (
            <React.Fragment key={i}>
              {swept ? <InkSweep t={t} at={sweep!.at} x={r.x - ox - size * 0.14} y={r.y - oy - size * 0.02} w={r.w + size * 0.28} h={sweepH} color={sweep!.color} dur={sweep!.dur} /> : null}
              {wash}
              <div style={{ position: 'absolute', left: r.x - ox, top: r.y - oy, ...title, letterSpacing: '-0.02em', color: APP.foreground, whiteSpace: 'nowrap', opacity: dimmed }}>{content}</div>
              {caret}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

/* ── SlipStack ──────────────────────────────────────────────────── */

export type SlipStackProps = {
  t: number;
  /** the pile's bottom slip: its left / top (frame px) and width */
  x: number;
  y: number;
  w: number;
  text: string;
  /** each slip's landing time (a slip exists from its landing) */
  lands: readonly number[];
  /** text size px (default the title role × .7) */
  size?: number;
  /** each new slip lands this much higher on the pile (default .2 × the slip's height) */
  step?: number;
  /** pile → one column of rows (rows spaced `pitch`, from the top slip down), fanning out on 16ths */
  fanAt?: number;
  pitch?: number;
  /** the column's first row (top-left); default: the pile's top slip */
  column?: { x: number; y: number };
  /** → one: each slip slides under the one above (bottom first) on 16ths, into the column's first row */
  collapseAt?: number;
  ink?: string;
  color?: string;
  seed?: string;
};

/** a slip's height for its text size */
export const slipHeight = (size: number) => size * 2.3;

export const SlipStack: React.FC<SlipStackProps> = ({ t, x, y, w, text, lands, size: sizeProp, step: stepProp, fanAt, pitch: pitchProp, column, collapseAt, ink, color = APP.foreground, seed = 'slip' }) => {
  const L = useLayout();
  const size = sizeProp ?? Math.round((typeStyle('title', L.vertical).fontSize as number) * 0.7);
  const h = slipHeight(size);
  const step = stepProp ?? h * 0.2;
  const pitch = pitchProp ?? h + size * 0.35;
  const n = lands.length;
  const col = column ?? { x, y: y - (n - 1) * step };
  const S16 = 3.75;
  return (
    <>
      {lands.map((at, i) => {
        if (t < at - 0.5) return null;
        // the pile pose: seeded per slip (a pure function of the slip): 3 px jitter, ±.4°; the third lands crooked
        const jx = (random(`${seed}x${i}`) - 0.5) * 6;
        const rot = i === 2 ? 1.2 : (random(`${seed}r${i}`) - 0.5) * 0.8;
        const pile = { x: x + jx, y: y - i * step, r: rot };
        // landing: from a hand's breadth above, on the landing spring
        const ls = springUnit(t - at, SPRING.land);
        let px = pile.x;
        let py = pile.y - (1 - ls) * h * 0.55;
        let pr = pile.r + (1 - Math.min(1, ls)) * 2.4 * (i % 2 ? -1 : 1);
        let lift = 1.2 * (1 - Math.min(1, ls)) + 0.25;
        let o = smooth(0, 0.25, ls);
        // fan: the top slip becomes row 0, the bottom row n − 1 (the newest first: a teleprompter of the same line)
        if (fanAt !== undefined && t >= fanAt) {
          const row = n - 1 - i;
          const fs = springUnit(t - fanAt - row * S16 * 0.5, SPRING.text);
          px = mix(px, col.x, fs);
          py = mix(py, col.y + row * pitch, fs);
          pr = mix(pr, 0, Math.min(1, fs));
          lift = mix(lift, 0.35, Math.min(1, fs));
        }
        // collapse: bottom first, each slides up under the one above, landing in row 0
        if (collapseAt !== undefined && t >= collapseAt) {
          const order = i; // the oldest (bottom) first
          const cs = springUnit(t - collapseAt - order * S16, SPRING.land);
          px = mix(px, col.x, Math.min(1, cs));
          py = mix(py, col.y, cs);
          pr = mix(pr, 0, Math.min(1, cs));
          lift = mix(lift, 0.2 + 0.05 * (n - i), Math.min(1, cs));
        }
        const moving = true;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: w,
              height: h,
              borderRadius: size * 0.12,
              background: '#ffffff',
              boxShadow: meshElevation(lift, ink, 0.9),
              opacity: o >= 0.999 ? undefined : o,
              // the slips stack by landing order: the newest on top (and slide UNDER on the collapse)
              zIndex: collapseAt !== undefined && t >= collapseAt ? n - i : i,
              transformOrigin: '50% 50%',
              ...subpixel(`translate(${px.toFixed(3)}px, ${py.toFixed(3)}px) rotate(${pr.toFixed(4)}deg)`, moving),
            }}
          >
            <div style={{ position: 'absolute', left: size * 0.7, top: (h - size * 1.12) / 2 - size * 0.08, ...typeStyle('title', L.vertical, { size }), letterSpacing: '-0.02em', color, whiteSpace: 'nowrap' }}>{text}</div>
            {/* the pad's hairline rule */}
            <div style={{ position: 'absolute', left: size * 0.7, right: size * 0.7, bottom: h * 0.16, height: 1.25, background: 'rgba(20, 10, 36, 0.10)' }} />
          </div>
        );
      })}
    </>
  );
};

/* ── FlipWord ───────────────────────────────────────────────────── */

/**
 * A split-flap window holding `word`; on each time in `flips` its flap turns over (`dur` = 6 frames:
 * the top flap — a real card, opaque — folds down to the seam on an accelerating curve, then the
 * bottom flap lands from the seam and settles) and shows the same word again. The flap darkens as it
 * turns edge-on and the card beneath catches its shadow: light, never blur. Inline-block: set it inside
 * a line of type (it takes the line's font).
 */
export const FlipWord: React.FC<{ t: number; word: string; flips: readonly number[]; style?: React.CSSProperties; color?: string; tile?: string; dur?: number }> = ({
  t,
  word,
  flips,
  style,
  color = APP.foreground,
  tile = '#f1eff6',
  dur = 6,
}) => {
  let at = -Infinity;
  for (const f of flips) if (f <= t) at = f;
  const u = (t - at) / dur;
  const flipping = u >= 0 && u < 1;
  const ink = color.startsWith('#') ? color : '#140a24';
  const card = (part: 'top' | 'bottom', o: { rot?: number; shade?: number } = {}) => (
    <span
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: '0.1em',
        background: o.shade ? mixColor(tile, '#9b96ad', o.shade) : tile,
        color: o.shade ? mixColor(ink, '#000000', o.shade * 0.6) : ink,
        clipPath: part === 'top' ? 'inset(0 0 50% 0)' : 'inset(50% 0 0 0)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transformOrigin: '50% 50%',
        transform: o.rot ? `perspective(8em) rotateX(${o.rot.toFixed(3)}deg)` : undefined,
        backfaceVisibility: 'hidden',
      }}
    >
      {word}
    </span>
  );
  // top flap 0 → −90° over the first half (accelerating), bottom flap 90° → 0 over the second (landing, a whisper of settle)
  const u1 = Math.min(1, Math.max(0, u * 2));
  const u2 = Math.min(1, Math.max(0, u * 2 - 1));
  const a1 = -90 * EASE.in3(u1);
  const a2 = 90 * (1 - EASE.out3(u2));
  return (
    <span style={{ position: 'relative', display: 'inline-block', padding: '0 0.14em', margin: '0 -0.02em', ...style }}>
      <span style={{ visibility: 'hidden' }}>{word}</span>
      {card('top')}
      {/* the lower half: the flap that is still up shades it as it falls */}
      {card('bottom', { shade: flipping && u < 0.5 ? 0.18 * u1 : flipping ? 0.18 * (1 - u2) : 0 })}
      {flipping && u < 0.5 ? card('top', { rot: a1, shade: 0.45 * u1 }) : null}
      {flipping && u >= 0.5 ? card('bottom', { rot: a2, shade: 0.4 * (1 - u2) }) : null}
      {/* the seam between the two flaps */}
      <span style={{ position: 'absolute', left: 0, right: 0, top: 'calc(50% - 0.012em)', height: '0.024em', background: 'rgba(20, 10, 36, 0.10)' }} />
    </span>
  );
};

/* ── MeaningLink ────────────────────────────────────────────────── */

/**
 * A hairline drawn from `from` to `to` (a gentle arc bowed by `bend` × its length, EASE.draw over
 * `dur`), with a small dot at each end and — optionally — a tag set at its midpoint in the label role,
 * on a white chip so it reads over anything; the tag rises as the pen passes it.
 */
export const MeaningLink: React.FC<{
  t: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
  at: number;
  dur?: number;
  bend?: number;
  color?: string;
  width?: number;
  tag?: string;
  tagColor?: string;
  /** leave (the line un-draws from its start) */
  exitAt?: number;
  /** which side of the chord the arc bows to (screen 'above' / 'below') */
  side?: 'above' | 'below';
  /** where along the arc the tag sits (0..1, default .5) and how far off the line, px (perpendicular, towards the bow) */
  tagPos?: number;
  tagOffset?: number;
}> = ({ t, from, to, at, dur = 15, bend = 0.18, color = APP.foreground, width = 2, tag, tagColor, exitAt, side = 'above', tagPos = 0.5, tagOffset = 0 }) => {
  const L = useLayout();
  if (t < at) return null;
  const p = tween(t, [at, at + dur], [0, 1], EASE.draw);
  const q = exitAt !== undefined ? tween(t, [exitAt, exitAt + 10], [0, 1], EASE.in3) : 0;
  if (q >= 0.999) return null;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.hypot(dx, dy) || 1;
  // bow to the chosen side of the chord
  let nx = -dy / d;
  let ny = dx / d;
  if (side === 'above' ? ny > 0 : ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  const cx = (from.x + to.x) / 2 + nx * bend * d;
  const cy = (from.y + to.y) / 2 + ny * bend * d;
  const u = tagPos;
  const mx = (1 - u) * (1 - u) * from.x + 2 * (1 - u) * u * cx + u * u * to.x + nx * tagOffset;
  const my = (1 - u) * (1 - u) * from.y + 2 * (1 - u) * u * cy + u * u * to.y + ny * tagOffset;
  const W0 = L.width;
  const H0 = L.height;
  const tagP = tag ? springUnit(t - (at + dur * Math.max(0, tagPos - 0.05)), SPRING.caption) : 0;
  return (
    <>
      <svg width={W0} height={H0} viewBox={`0 0 ${W0} ${H0}`} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }} aria-hidden>
        <path
          d={`M${from.x.toFixed(2)} ${from.y.toFixed(2)} Q${cx.toFixed(2)} ${cy.toFixed(2)} ${to.x.toFixed(2)} ${to.y.toFixed(2)}`}
          fill="none"
          stroke={color}
          strokeWidth={width}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={`${(p - q).toFixed(4)} 2`}
          strokeDashoffset={(-q).toFixed(4)}
        />
        <circle cx={from.x} cy={from.y} r={width * 2.2 * smooth(0, 0.15, p) * (1 - q)} fill={color} />
        <circle cx={to.x} cy={to.y} r={width * 2.2 * smooth(0.85, 1, p) * (1 - q)} fill={color} />
      </svg>
      {tag && tagP > 0.001 ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            ...subpixel(`translate(${mx.toFixed(2)}px, ${my.toFixed(2)}px) translate(-50%, -50%)`, true),
          }}
        >
          <div
            style={{
              ...typeStyle('label', L.vertical),
              color: tagColor ?? color,
              background: '#ffffff',
              padding: '0.38em 0.7em 0.34em',
              borderRadius: 999,
              boxShadow: `0 0 0 1.25px ${APP.border}, 0 6px 16px -8px rgba(30, 20, 66, 0.35)`,
              whiteSpace: 'nowrap',
              opacity: smooth(0, 0.5, tagP) * (1 - q),
              transform: `translateY(${((1 - Math.min(1, tagP)) * 40).toFixed(2)}%)`,
            }}
          >
            {tag}
          </div>
        </div>
      ) : null}
    </>
  );
};

/* ── WordReset ──────────────────────────────────────────────────── */

export type ResetWord = {
  /** the word's onset (frames, timeline) — from vWord */
  at: number;
  /** the source token it comes from: [line, token index] (tokens split on spaces); omit for a new word */
  from?: readonly [number, number];
};

/**
 * Page lines re-set into what was said. Source tokens sit where the page set them (left at
 * source.x, lines source.lineH apart); on each target word's onset a KEPT word glides to its pen
 * position in the target sentence (and from the source size to the target size, by transform — the
 * glyphs are set once, at the target size), extra letters it gains ("Sunday" → "Sundays,") rise in
 * after it lands, NEW words rise into their masks, and every source token no target word takes leaves
 * up through its mask at `leaveAt` (default: the first onset), one frame apart.
 */
export const WordReset: React.FC<{
  t: number;
  source: { x: number; y: number; lines: readonly string[]; size: number; lineH?: number; color?: string };
  target: { text: string; x: number; y: number; size: number; maxWidth: number; align?: 'center' | 'left'; color?: string; keys?: readonly { text: string; color: string; at: number }[] };
  words: readonly ResetWord[];
  leaveAt?: number;
}> = ({ t, source, target, words, leaveAt }) => {
  useKitFaces();
  const sSpec = { size: source.size, weight: TYPE.title.weight, tracking: -0.02 };
  const tSpec = { size: target.size, weight: TYPE.caption.weight, tracking: -0.02 };
  const sLineH = source.lineH ?? source.size * 1.62;
  // source token boxes
  const srcTokens = source.lines.map((ln, li) => layoutWords(ln, sSpec, source.x).words.map((w) => ({ ...w, y: source.y + li * sLineH })));
  // target layout: greedy wrap, each line centred (or left)
  const tWords = target.text.split(' ');
  const space = spaceWidth(tSpec);
  const widths = tWords.map((w) => measureText(w, tSpec));
  const lines: number[][] = [];
  let cur: number[] = [];
  let lw = 0;
  tWords.forEach((_, i) => {
    if (cur.length && lw + space + widths[i] > target.maxWidth) {
      lines.push(cur);
      cur = [];
      lw = 0;
    }
    lw += (cur.length ? space : 0) + widths[i];
    cur.push(i);
  });
  if (cur.length) lines.push(cur);
  const tLineH = target.size * TYPE.caption.lineHeight;
  const top = target.y - (lines.length * tLineH) / 2;
  const pos: { x: number; y: number }[] = [];
  lines.forEach((ln, li) => {
    const wSum = ln.reduce((s, i) => s + widths[i], 0) + space * (ln.length - 1);
    let x = target.align === 'left' ? target.x : target.x - wSum / 2;
    for (const i of ln) {
      pos[i] = { x, y: top + li * tLineH };
      x += widths[i] + space;
    }
  });
  const used = new Set(words.filter((w) => w.from).map((w) => `${w.from![0]}:${w.from![1]}`));
  const leave = leaveAt ?? Math.min(...words.map((w) => w.at));
  const tColor = target.color ?? APP.foreground;
  const sColor = source.color ?? APP.foreground;
  const keyOf = (i: number) => {
    for (const k of target.keys ?? []) {
      const kw = k.text.split(' ');
      for (let s = 0; s + kw.length <= tWords.length; s++) {
        if (kw.every((w, j) => tWords[s + j].replace(/[.,!?]$/, '') === w.replace(/[.,!?]$/, '')) && i >= s && i < s + kw.length) return k;
      }
    }
    return null;
  };
  const scaleK = source.size / target.size;
  return (
    <>
      {/* source tokens nobody keeps: up and out through their masks */}
      {srcTokens.flatMap((line, li) =>
        line.map((tok, ti) => {
          if (used.has(`${li}:${ti}`)) return null;
          const k = li * 10 + ti;
          const rv = reveal(t, -1e6, { exit: { at: leave + (li * line.length + ti) * 1, dur: 9 } });
          if (rv.opacity <= 0.001) return null;
          return (
            <span key={`s${k}`} style={{ position: 'absolute', left: tok.x, top: tok.y, ...maskBox(0), ...typeStyle('title', false, { size: source.size, tabular: true }), letterSpacing: '-0.02em', color: sColor }}>
              <span style={revealStyle(rv, undefined, true)}>{tok.text}</span>
            </span>
          );
        }),
      )}
      {tWords.map((word, i) => {
        const spec = words[i] ?? { at: Infinity };
        const k = keyOf(i);
        const ink = k ? mixHex(tColor, k.color, tween(t, [k.at, k.at + 18], [0, 1], EASE.house)) : tColor;
        const P = pos[i];
        if (spec.from) {
          const tok = srcTokens[spec.from[0]][spec.from[1]];
          // glide: position + size (scale from the source size) on a soft spring from the onset
          const g = springUnit(t - spec.at, { stiffness: 150, damping: 21, mass: 1 });
          const gx = mix(tok.x, P.x, g);
          const gy = mix(tok.y + (source.size * 1.18 - target.size * 1.18 * scaleK) / 2, P.y, g);
          const sc = mix(scaleK, 1, g);
          const keep = tok.text;
          const prefix = word.startsWith(keep) ? keep : word;
          const suffix = word.startsWith(keep) ? word.slice(keep.length) : '';
          const suf = suffix ? reveal(t, spec.at + 7, { config: SPRING.caption, rise: 90 }) : null;
          // (on its sub-pixel layer from the start to the end: a landed word never re-rasterises — Type.tsx `hold`)
          return (
            <span
              key={`t${i}`}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                transformOrigin: '0 0',
                ...typeStyle('caption', false, { size: target.size }),
                letterSpacing: '-0.02em',
                whiteSpace: 'nowrap',
                color: t < spec.at ? sColor : mixHex(sColor, ink, Math.min(1, g)),
                ...subpixel(`translate(${gx.toFixed(3)}px, ${gy.toFixed(3)}px) scale(${sc.toFixed(5)})`, true),
              }}
            >
              {prefix}
              {suffix ? (
                <span style={maskBox(0)}>
                  <span style={revealStyle(suf!, undefined, true)}>{suffix}</span>
                </span>
              ) : null}
            </span>
          );
        }
        if (t < spec.at - 0.5) return null;
        const rv = reveal(t, spec.at, { config: SPRING.caption, rise: 100 });
        return (
          <span key={`t${i}`} style={{ position: 'absolute', left: P.x, top: P.y, ...maskBox(0), ...typeStyle('caption', false, { size: target.size }), letterSpacing: '-0.02em', color: ink }}>
            <span style={revealStyle(rv, undefined, t - spec.at < 20)}>{word}</span>
          </span>
        );
      })}
    </>
  );
};

/** A label-role text's width (uppercase, tracked), for layouts outside React. */
export const labelWidth = (text: string, size: number) => measureText(text.toUpperCase(), { size, weight: TYPE.label.weight, tracking: 0.14 });
