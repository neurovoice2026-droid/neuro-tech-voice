/**
 * "AI voice agents that book your customers 24/7." — the hero headline
 * (Inter Tight 500, -0.04em, lh 1.04, word masks rising 115 % → 0 on the
 * site spring, 3 px blur-in, words padded 0.24em apart), bracketed by the
 * hero's four corner marks. Ava SAYS this line: each word rises on its own
 * spoken word (spec.wordAt, from the real voice timing), "24/7." on "Twenty".
 *
 * LAYOUT: the line is laid out ONCE by the browser (a hidden copy of the
 * exact site markup), measured after the face has loaded (inside a
 * delayRender), and from then on every word is its own absolutely placed
 * element. So a word can fly on its own without dragging a full-frame copy
 * of the line along.
 *
 * CONVERGE: each word leaves on the beat grid, swells away from the logo
 * centre P for a few frames (anticipation), then is pulled along a slight
 * spiral into P, accelerating, shrinking a little slower than it travels so
 * the eye can follow it into the core. It stays paper on the night, turns
 * electric violet as it crosses into the silver light (the crown's own
 * colour — lilac would vanish on silver), and blooms lilac only as the core
 * swallows it. Motion blur is a real shutter: 1–9 sub-frame samples along
 * the path, spaced ≤ 7 px apart and blurred by about their spacing, so the
 * trail is one continuous smear, never stacked copies.
 */
import React, { useLayoutEffect, useRef, useState } from 'react';
import { AbsoluteFill, cancelRender, continueRender, delayRender, Easing } from 'remotion';
import { aos, EASE, mixHex, SPRING, tween } from '../../lib/motion';
import { C, FONT, TRACK } from '../../theme';

export type HeadlineSpec = {
  lines: string[];
  fontSize: number;
  cy: number;
  P: { x: number; y: number };
  /** frame each word's mask rise starts (from its spoken word, Cta.tsx) */
  wordAt: readonly number[];
  marksAt: number;
  /** collapse: first word leaves at `from`, then one every `step` frames */
  collapse: { from: number; step: number; dur: number; anticip: number };
  marksCollapse: { from: number; dur: number };
  /** the marks sit this many px outside the block's cap-height bounds */
  markGap: number;
};

const LH = 1.04;
const MARK = 14;
/** Inter Tight: cap top and baseline below a 1.04-line row's top, in em
 *  (ascender .969, descender .242, cap height .727 → half-leading −.085) */
const CAP_TOP = 0.157;
const BASELINE = 0.884;
/** the flight: leaves gently, accelerating into the core (end slope 1.2) — a
 *  third of the way at half time, so the eye can ride it in */
const FLIGHT = Easing.bezier(0.42, 0, 0.75, 0.7);
/** shutter, in frames (0.9 ≈ a 324° shutter) */
const SHUTTER = 0.9;

type Box = { left: number; top: number; w: number; h: number };
type Measure = {
  masks: Box[];
  words: Box[];
  block: { left: number; right: number; top: number; bottom: number };
};

/** One word's flight at frame t: c = progress (0 → 1), pre = anticipation swell (0 → 1 → 0). */
function flightAt(t: number, w0: number, dur: number, anticip: number) {
  let pre = 0;
  if (t >= w0 - anticip && t < w0) pre = Math.sin(((t - (w0 - anticip)) / anticip) * (Math.PI / 2));
  else if (t >= w0 && t < w0 + 3) pre = 1 - EASE.inOut((t - w0) / 3);
  const c = tween(t, [w0, w0 + dur], [0, 1], FLIGHT);
  return { c, pre };
}

/** Where a point `W` (its centre) is on its flight into P, and at what size / angle. */
function place(W: { x: number; y: number }, P: { x: number; y: number }, c: number, pre: number, dir: number) {
  const f = (1 - c) * (1 + 0.05 * pre); // distance to P
  const s = Math.pow(1 - c, 0.6) * (1 + 0.06 * pre); // size: shrinks slower than it travels
  const rot = dir * 18 * c * c; // degrees, a slight spiral
  const a = (rot * Math.PI) / 180;
  const dx = W.x - P.x;
  const dy = W.y - P.y;
  return {
    x: P.x + (dx * Math.cos(a) - dy * Math.sin(a)) * f,
    y: P.y + (dx * Math.sin(a) + dy * Math.cos(a)) * f,
    s,
    rot,
  };
}

const maskStyle = (last: boolean): React.CSSProperties => ({
  display: 'inline-block',
  overflow: 'hidden',
  verticalAlign: 'top',
  paddingBottom: '0.16em',
  marginBottom: '-0.16em',
  paddingRight: last ? 0 : '0.24em',
  whiteSpace: 'nowrap',
});

const typeStyle = (fontSize: number): React.CSSProperties => ({
  fontFamily: FONT.display,
  fontWeight: 500,
  fontSize,
  lineHeight: LH,
  letterSpacing: TRACK.display,
  whiteSpace: 'nowrap',
});

export const Headline: React.FC<{ t: number; spec: HeadlineSpec }> = ({ t, spec }) => {
  const { lines, fontSize, cy, P, wordAt } = spec;
  const words = lines.map((l) => l.split(' '));
  const flat = words.flatMap((ws, li) => ws.map((w, j) => ({ text: w, li, last: j === ws.length - 1 })));
  const n = lines.length;
  const lineY = (li: number) => cy + (li - (n - 1) / 2) * fontSize * LH;

  /* ── measure once, after the face is in ─────────────────────────── */
  const [m, setM] = useState<Measure | null>(null);
  const [handle] = useState(() => delayRender('CTA headline layout'));
  const released = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const maskRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  useLayoutEffect(() => {
    if (m) return;
    let alive = true;
    const release = () => {
      if (!released.current) {
        released.current = true;
        continueRender(handle);
      }
    };
    document.fonts
      .load(`500 ${fontSize}px "Inter Tight Variable"`, lines.join(' '))
      .then(() => document.fonts.ready)
      .then(() => {
        if (!alive) return;
        const root = rootRef.current;
        if (!root) return;
        const rr = root.getBoundingClientRect();
        const k = rr.width / root.offsetWidth || 1; // undo any transform above us
        const box = (el: Element | null): Box => {
          const r = el!.getBoundingClientRect();
          return { left: (r.left - rr.left) / k, top: (r.top - rr.top) / k, w: r.width / k, h: r.height / k };
        };
        const masks = maskRefs.current.slice(0, flat.length).map(box);
        const wordBoxes = wordRefs.current.slice(0, flat.length).map(box);
        const rows = lineRefs.current.slice(0, n).map(box);
        setM({
          masks,
          words: wordBoxes,
          block: {
            left: Math.min(...wordBoxes.map((w) => w.left)),
            right: Math.max(...masks.map((mb, i) => (flat[i].last ? mb.left + mb.w : -Infinity))),
            top: rows[0].top,
            bottom: rows[n - 1].top + rows[n - 1].h,
          },
        });
        release();
      })
      .catch((e) => cancelRender(e));
    return () => {
      alive = false;
    };
    // measured once per mount; the copy and size are fixed per composition
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m]);
  // never leave the render hanging if we unmount before measuring
  useLayoutEffect(
    () => () => {
      if (!released.current) {
        released.current = true;
        continueRender(handle);
      }
    },
    [handle],
  );

  if (!m) {
    let gi = 0;
    return (
      <AbsoluteFill ref={rootRef} style={{ visibility: 'hidden' }}>
        {words.map((ws, li) => (
          <div
            key={li}
            ref={(el) => {
              lineRefs.current[li] = el;
            }}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: lineY(li),
              transform: 'translateY(-50%)',
              display: 'flex',
              justifyContent: 'center',
              ...typeStyle(fontSize),
            }}
          >
            {ws.map((w, j) => {
              const i = gi++;
              return (
                <span
                  key={j}
                  ref={(el) => {
                    maskRefs.current[i] = el;
                  }}
                  style={maskStyle(j === ws.length - 1)}
                >
                  <span
                    ref={(el) => {
                      wordRefs.current[i] = el;
                    }}
                    style={{ display: 'inline-block' }}
                  >
                    {w}
                  </span>
                </span>
              );
            })}
          </div>
        ))}
      </AbsoluteFill>
    );
  }

  /* ── the words ─────────────────────────────────────────────────── */
  const { from, step, dur, anticip } = spec.collapse;
  const els: React.ReactNode[] = [];
  flat.forEach((wd, i) => {
    const s0 = wordAt[Math.min(i, wordAt.length - 1)];
    if (t < s0 - 4) return;
    const wb = m.words[i];
    const mb = m.masks[i];
    const Wc = { x: wb.left + wb.w / 2, y: wb.top + wb.h / 2 };
    const w0 = from + i * step;
    const dir = Wc.x < P.x ? -1 : 1;
    const now = flightAt(t, w0, dur, anticip);
    if (now.c >= 0.999) return;

    const p = aos(t, s0, { anticip: 4, depth: 0.06, config: SPRING.site });
    const pPrev = aos(t - 1, s0, { anticip: 4, depth: 0.06, config: SPRING.site });
    const riseY = (1 - p) * 115;
    const riseBlur = tween(t, [s0, s0 + 12], [3, 0], EASE.house) + Math.min(10, Math.abs(p - pPrev) * 115 * 0.12);

    // at rest (or still rising): the site's mask reveal
    if (now.c <= 0 && now.pre <= 0) {
      els.push(
        <div
          key={`w${i}`}
          style={{ position: 'absolute', left: mb.left, top: mb.top, width: mb.w, height: mb.h, overflow: 'hidden' }}
        >
          <span
            style={{
              position: 'absolute',
              left: wb.left - mb.left,
              top: wb.top - mb.top,
              ...typeStyle(fontSize),
              color: C.paper,
              transform: riseY > 0.01 ? `translateY(${riseY.toFixed(2)}%)` : undefined,
              filter: riseBlur > 0.05 ? `blur(${riseBlur.toFixed(2)}px)` : undefined,
            }}
          >
            {wd.text}
          </span>
        </div>,
      );
      return;
    }

    // in flight: a shutter's worth of sub-frame samples along the path
    const at = (tt: number) => {
      const f = flightAt(tt, w0, dur, anticip);
      return { ...f, ...place(Wc, P, f.c, f.pre, dir) };
    };
    const head = at(t);
    const tail = at(t - SHUTTER);
    const trail = Math.hypot(head.x - tail.x, head.y - tail.y) + Math.abs(head.s - tail.s) * wb.w * 0.5;
    const N = Math.max(1, Math.min(9, Math.ceil(trail / 7) + 1));
    const spacing = N > 1 ? trail / (N - 1) : 0;
    const fade = 1 - tween(head.c, [0.93, 1], [0, 1], EASE.in2);
    const violet = tween(head.c, [0.42, 0.7], [0, 1], EASE.soft);
    const bloom = tween(head.c, [0.78, 0.97], [0, 1], EASE.soft);
    const col = mixHex(mixHex(C.paper, C.electric, violet), C.lilac, bloom);
    for (let k = N - 1; k >= 0; k--) {
      const q = k === 0 ? head : at(t - (SHUTTER * k) / (N - 1));
      const o = k === 0 ? fade : fade * 0.5 * Math.pow(1 - k / N, 1.3);
      if (o < 0.01) continue;
      const blur = k === 0 ? Math.min(3, trail * 0.04) : Math.min(9, 0.8 * spacing + 0.5);
      els.push(
        <span
          key={`w${i}-${k}`}
          style={{
            position: 'absolute',
            left: wb.left,
            top: wb.top,
            ...typeStyle(fontSize),
            color: col,
            opacity: o,
            transformOrigin: `${(wb.w / 2).toFixed(2)}px ${(wb.h / 2).toFixed(2)}px`,
            transform: `translate(${(q.x - Wc.x).toFixed(2)}px, ${(q.y - Wc.y).toFixed(2)}px) rotate(${q.rot.toFixed(3)}deg) scale(${Math.max(0.001, q.s).toFixed(4)})`,
            filter: blur > 0.1 ? `blur(${blur.toFixed(2)}px)` : undefined,
            // the head keeps a soft night edge while it is paper on the silver,
            // then blooms lilac as the core takes it
            textShadow:
              k === 0
                ? `0 0 ${(10 * q.s).toFixed(1)}px rgba(6,4,10,${(0.45 * (1 - violet)).toFixed(3)}), 0 0 ${(20 * bloom + 4).toFixed(1)}px rgba(185,163,255,${(0.85 * bloom).toFixed(3)})`
                : undefined,
          }}
        >
          {wd.text}
        </span>,
      );
    }
  });

  /* ── corner marks: after the words; then they travel into P ────────── */
  // on the block's cap-height bounds (first row's cap line → last row's
  // baseline), pushed markGap px out on both axes
  const B = m.block;
  const g = spec.markGap;
  const top = B.top + fontSize * CAP_TOP - g;
  const bottom = B.top + fontSize * LH * (n - 1) + fontSize * BASELINE + g;
  const marks = [
    { x: B.left - g, y: top },
    { x: B.right + g, y: top },
    { x: B.left - g, y: bottom },
    { x: B.right + g, y: bottom },
  ];
  const mcFrom = spec.marksCollapse.from;
  const mcDur = spec.marksCollapse.dur;
  marks.forEach((mk, k) => {
    const a0 = spec.marksAt + k * 2;
    if (t < a0 - 3) return;
    const a = aos(t, a0, { anticip: 3, depth: 0.1, config: SPRING.pop });
    const dir = k % 2 === 0 ? -1 : 1;
    const markAt = (tt: number) => {
      const f = flightAt(tt, mcFrom + k * 0.5, mcDur, 3);
      const pl = place(mk, P, f.c, f.pre, dir);
      return { ...f, ...pl };
    };
    const head = markAt(t);
    if (head.c >= 0.999) return;
    const tail = markAt(t - SHUTTER);
    const trail = Math.hypot(head.x - tail.x, head.y - tail.y);
    const N = head.c > 0 ? Math.max(1, Math.min(6, Math.ceil(trail / 8) + 1)) : 1;
    const fade = 1 - tween(head.c, [0.85, 1], [0, 1], EASE.in2);
    const lil = tween(head.c, [0.2, 0.6], [0, 1], EASE.soft);
    for (let j = N - 1; j >= 0; j--) {
      const q = j === 0 ? head : markAt(t - (SHUTTER * j) / (N - 1));
      const o = Math.min(1, Math.max(0, a * 1.4)) * fade * (j === 0 ? 1 : 0.45 * (1 - j / N));
      if (o < 0.01) continue;
      const size = MARK * (1 - 0.35 * q.c) * Math.max(0, 0.4 + 0.6 * a);
      els.push(
        <div
          key={`m${k}-${j}`}
          style={{
            position: 'absolute',
            left: q.x - size / 2,
            top: q.y - size / 2,
            width: size,
            height: size,
            background: mixHex(C.coverPaper, C.lilac, lil),
            opacity: o,
            transform: `rotate(${(45 * q.c).toFixed(2)}deg)`,
            filter: j > 0 ? `blur(${Math.min(5, trail / N).toFixed(2)}px)` : undefined,
            boxShadow: j === 0 && q.c > 0.05 ? `0 0 ${(12 * q.c).toFixed(1)}px rgba(185,163,255,${(0.8 * q.c).toFixed(2)})` : undefined,
          }}
        />,
      );
    }
  });

  return <AbsoluteFill ref={rootRef}>{els}</AbsoluteFill>;
};
