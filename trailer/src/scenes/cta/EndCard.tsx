/**
 * THE END CARD — calm, one element at a time, each settled before the next
 * moves (client: "the ending is too fast"). Everything is crisp vector type,
 * revealed by motion (a rise out of a mask, a spring), never by blur.
 *
 *  <Wordmark>  "NEUROVOICE" exactly as the site's header sets it (lib/site.ts
 *              COMPANY.wordmark; .hdr-wordmark: Inter Tight 500, −0.07em,
 *              leading 1, --cover-paper on the dark) — the brand mark, the one
 *              exception to the Instrument Sans rule. The letters are laid out
 *              ONCE as one kerned run (canvas measureText of each prefix, so
 *              the site's kerning survives) and each surfaces — a short rise,
 *              its opacity over the travel, a whisper of scale — just after the
 *              merged light has passed it: from the centre out, as the corona
 *              opens behind the word, on a soft display spring.
 *  <CoverCta>  the site's own primary button (components/site/hero.tsx
 *              CoverCta): a paper plate (--cover-paper, radius .2em) with four
 *              CornerDots in its corners, the label in ink, "Start free →".
 *              It rises once the URL has typed; at `press` it is CLICKED: a
 *              hover lift (anticipation), .96 in 2 f, back on a soft spring,
 *              and it takes the site's hover — the plate floods to the brand
 *              plum from the arrow (a crisp radial edge), the label turns
 *              paper, the corner dots step out, the arrow moves .25em.
 *  <Note>      "5 free minutes, no card" (pricing copy), Instrument Sans,
 *              paper-dim, one word at a time.
 *  <Url>       the colophon: a hairline to the safe margins, broken by a
 *              CornerDot + "neurotechvoice.com" in Instrument Sans; the URL
 *              rises in three chunks ON Ava's words ("neuro" | "tech" |
 *              "voice.com" on "Neuro" "Tech" "Voice.").
 *
 * `rest(t, v, target)` (from the scene) pins every residual to its exact rest
 * value by CTA.finalHold: the hold is dead still.
 */
import React, { useMemo } from 'react';
import { Easing } from 'remotion';
import { CornerDot, reveal, revealStyle, subpixel } from '../../components/Type';
import { EASE, mix, smooth, SPRING, springUnit, tween } from '../../lib/motion';
import { maskBox, typeStyle } from '../../lib/type';
import { C, TRACK } from '../../theme';

export type Rest = (t: number, v: number, target: number) => number;

/* ── the wordmark ─────────────────────────────────────────────── */

/** The site header's wordmark face (font/wordmark.css): Inter Tight, the --font-display face. */
export const WORDMARK_FONT = '"Inter Tight Variable", "Inter Tight", system-ui, sans-serif';
export const WORDMARK_TEXT = 'NEUROVOICE';
/** Inter Tight: cap height .7275 em, ascender .96875, descender .2412 (line-height 1 → half-leading −.105) */
const IT_CAP = 0.7275;
const IT_ASC = 0.96875;
const IT_DESC = 0.2412;
/** the cap line's centre below the top of a line-height-1 box (em) */
const CAP_MID = (1 - IT_ASC - IT_DESC) / 2 + IT_ASC - IT_CAP / 2;

/** x of every letter (its left edge, em) in the kerned run, and the run's width (em) — measured once. */
function useWordmarkLayout(ready: boolean) {
  return useMemo(() => {
    const n = WORDMARK_TEXT.length;
    // fallback (before the face is in — never on a rendered frame: Cta holds the frame until it is)
    let xs = Array.from({ length: n }, (_, i) => i * 0.553);
    let w = n * 0.553 - 0.07;
    if (ready && typeof document !== 'undefined') {
      const ctx = document.createElement('canvas').getContext('2d');
      if (ctx) {
        ctx.font = `500 1000px ${WORDMARK_FONT}`;
        // TRACK.wordmark (−0.07em) at 1000 px
        (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${parseFloat(TRACK.wordmark) * 1000}px`;
        ctx.fontKerning = 'normal';
        xs = Array.from({ length: n }, (_, i) => ctx.measureText(WORDMARK_TEXT.slice(0, i)).width / 1000);
        // the run's advance, without the tracking after its last glyph
        w = ctx.measureText(WORDMARK_TEXT).width / 1000 - parseFloat(TRACK.wordmark);
      }
    }
    return { xs, w };
  }, [ready]);
}

export type WordmarkSpec = {
  /** centre of the word's cap line (frame px) */
  x: number;
  y: number;
  /** font size (px) */
  size: number;
  /** when the merged light reaches |x| (frames after `at`, from the corona's spring): x in em from the centre → frame */
  arrive: (xEm: number) => number;
  /** a light crossing the letters once they are in: [start, end] frames */
  sweep: readonly [number, number];
  color: string;
};

export const Wordmark: React.FC<{ t: number; at: number; spec: WordmarkSpec; ready: boolean; rest: Rest }> = ({ t, at, spec, ready, rest }) => {
  const { xs, w } = useWordmarkLayout(ready);
  if (t < at - 1) return null;
  const F = spec.size;
  const left = spec.x - (w * F) / 2;
  const top = spec.y - CAP_MID * F;
  // the whole word settles from a whisper of scale as it lands (the impact's weight, not a pop)
  const land = rest(t, springUnit(t - at, SPRING.heavy), 1);
  const scale = mix(1.035, 1, land);
  const moving = Math.abs(scale - 1) > 1e-4;
  // the light crossing the letters: a soft band of white across the paper (in word space)
  const sw = tween(t, spec.sweep, [-0.25, 1.25], EASE.inOut);
  const swO = t > spec.sweep[0] && t < spec.sweep[1] ? Math.sin(Math.PI * tween(t, spec.sweep, [0, 1])) : 0;
  const wPx = w * F;
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width: wPx,
        height: F,
        transformOrigin: `${(wPx / 2).toFixed(2)}px ${(CAP_MID * F).toFixed(2)}px`,
        ...subpixel(moving ? `scale(${scale.toFixed(5)})` : undefined, moving),
      }}
    >
      {WORDMARK_TEXT.split('').map((ch, i) => {
        const x0 = xs[i] * F;
        const x1 = (i + 1 < xs.length ? xs[i + 1] : w) * F;
        const mid = (x0 + x1) / 2;
        const start = at + spec.arrive(Math.abs(mid / F - w / 2));
        // a short rise (no mask: a full-height rise would cross the corona's line) with the
        // opacity over most of the travel and a whisper of scale — the letter surfaces in the light
        const r = reveal(t, start, { config: SPRING.display, rise: 26, fade: 0.8, scaleFrom: 0.97 });
        const fill: React.CSSProperties =
          swO > 0.002
            ? {
                // the sweep in word coordinates: each letter shows its slice of one band
                backgroundImage: `linear-gradient(100deg, ${spec.color} ${((sw - 0.16) * 100).toFixed(2)}%, rgba(255,255,255,1) ${(sw * 100).toFixed(2)}%, ${spec.color} ${((sw + 0.16) * 100).toFixed(2)}%)`,
                backgroundSize: `${wPx.toFixed(2)}px ${F}px`,
                backgroundPosition: `${(-x0).toFixed(2)}px 0px`,
                backgroundRepeat: 'no-repeat',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }
            : { color: spec.color };
        return (
          <span
            key={i}
            style={{
              position: 'absolute',
              left: x0,
              top: 0,
              display: 'block',
              whiteSpace: 'nowrap',
              fontFamily: WORDMARK_FONT,
              fontWeight: 500,
              fontSize: F,
              lineHeight: 1,
              letterSpacing: TRACK.wordmark,
              fontKerning: 'normal',
            }}
          >
            <span style={{ ...revealStyle(r, '50% 100%'), ...fill }}>{ch}</span>
          </span>
        );
      })}
    </div>
  );
};

/* ── the site's button ────────────────────────────────────────── */

export type PressSpec = {
  /** the hover lift before the click (anticipation) */
  lift: readonly [number, number];
  /** frames down to .96 */
  down: number;
  /** the plum floods the plate from the arrow */
  flood: readonly [number, number];
};

/** the plate back from the click: one soft ≈4 % overshoot, settled in ≈12 f */
const BACK = { stiffness: 230, damping: 21, mass: 1 };
/** ease-in-out sine for the hover lift */
const SINE = Easing.bezier(0.37, 0, 0.63, 1);
const INK = '#06040a'; // --cover-ink
const PAPER_PLATE = C.coverPaper; // --cover-paper
const PLUM = C.plum; // --cover-brand (the site's hover)

export const CoverCta: React.FC<{
  t: number;
  at: number;
  press: number;
  /** label size (px) */
  fontSize: number;
  vertical: boolean;
  spec: PressSpec;
  rest: Rest;
}> = ({ t, at, press, fontSize: F, vertical, spec, rest }) => {
  if (t < at - 1) return null;
  /* ── the rise: the plate comes up on a soft spring, its words out of their masks ── */
  const e = rest(t, springUnit(t - at, SPRING.text), 1);
  const y = (1 - e) * 0.55 * F;
  const sc0 = mix(0.97, 1, Math.min(1, Math.max(0, e)));
  // (the plate is opaque within its first quarter of travel: paper, never a grey veil)
  const plateO = smooth(0, 0.25, e);

  /* ── the press ── */
  const lift = t < spec.lift[0] || t >= press ? 0 : SINE(tween(t, spec.lift, [0, 1], (x) => x));
  const D = spec.down;
  const u = t - press;
  const down = u < 0 ? 1 + 0.02 * lift : u < D ? mix(1.02, 0.96, EASE.in2(u / D)) : mix(0.96, 1, springUnit(t - (press + D), BACK));
  const click = rest(t, down, 1);
  // the site's hover: the plate floods to plum from the arrow, the dots step out, the arrow moves
  const fl = t < press ? 0 : rest(t, tween(t, spec.flood, [0, 1], EASE.out3), 1);
  const hs = rest(t, t < press ? 0 : springUnit(t - press, SPRING.text), 1);
  const dotOut = 0.12 * hs;
  const arrowX = 0.25 * hs + 0.06 * lift;
  const reach = 7.5; // em: the plate's diagonal reach from the arrow — the flood covers it all at fl = 1
  const floodR = fl * reach * F;
  const floodMask =
    fl >= 1 || fl <= 0
      ? undefined
      : `radial-gradient(circle at calc(100% - 1.6em) 50%, #000 ${Math.max(0, floodR - 1).toFixed(2)}px, transparent ${(floodR + 1).toFixed(2)}px)`;

  const label = typeStyle('title', vertical, { tone: 'paper', size: F });
  const moving = Math.abs(y) > 0.02 || Math.abs(sc0 * click - 1) > 1e-4;
  const tf = moving ? `translateY(${y.toFixed(3)}px) scale(${(sc0 * click).toFixed(5)})` : undefined;

  /** one face: paper at rest, plum once clicked (each with its own label colour) */
  const face = (pressed: boolean) => (
    <span
      style={{
        gridArea: '1 / 1',
        position: 'relative',
        display: 'inline-grid',
        borderRadius: '0.2em',
        background: pressed ? PLUM : PAPER_PLATE,
        WebkitMaskImage: pressed ? floodMask : undefined,
        maskImage: pressed ? floodMask : undefined,
        zIndex: pressed ? 2 : 1,
      }}
    >
      {/* the four corner dots (the site's p-[.33em] grid), stepping out on the hover */}
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sy], k) => (
        <span
          key={k}
          style={{
            position: 'absolute',
            [sx < 0 ? 'left' : 'right']: '0.33em',
            [sy < 0 ? 'top' : 'bottom']: '0.33em',
            width: '0.3em',
            height: '0.3em',
            transform: pressed && dotOut > 1e-4 ? `translate(${(sx * dotOut).toFixed(4)}em, ${(sy * dotOut).toFixed(4)}em)` : undefined,
          }}
        >
          <CornerDot size={0.3 * F} color={pressed ? C.paper : INK} />
        </span>
      ))}
      <span
        style={{
          gridArea: '1 / 1',
          display: 'flex',
          alignItems: 'center',
          gap: '0.45em',
          padding: '0.62em 1em',
          color: pressed ? C.paper : INK,
          whiteSpace: 'nowrap',
        }}
      >
        <span>
          <Rise t={t} at={at - 0.5} gap={0.24} quick>
            Start
          </Rise>
          <Rise t={t} at={at + 0.5} quick>
            free
          </Rise>
        </span>
        <span style={{ display: 'inline-block', transform: arrowX > 1e-4 ? `translateX(${arrowX.toFixed(4)}em)` : undefined }}>
          <Rise t={t} at={at + 1.5} quick>
            →
          </Rise>
        </span>
      </span>
    </span>
  );

  return (
    <div
      style={{
        display: 'inline-grid',
        ...label,
        lineHeight: 1.2,
        opacity: plateO >= 0.999 ? undefined : plateO,
        ...subpixel(tf, moving),
      }}
    >
      {face(false)}
      {fl > 0 ? face(true) : null}
    </div>
  );
};

/** One word out of its own mask (the film's gesture), on the text spring (`quick`: the caption spring). */
const Rise: React.FC<{ t: number; at: number; gap?: number; quick?: boolean; children: React.ReactNode }> = ({ t, at, gap = 0, quick, children }) => {
  const r = reveal(t, at, { config: quick ? SPRING.caption : SPRING.text });
  return (
    <span style={maskBox(gap)}>
      <span style={revealStyle(r)}>{children}</span>
    </span>
  );
};

/* ── the note ─────────────────────────────────────────────────── */

export const Note: React.FC<{ t: number; at: number; step: number; size: number; vertical: boolean }> = ({ t, at, step, size, vertical }) => {
  const words = '5 free minutes, no card'.split(' ');
  if (t < at - 1) return null;
  return (
    <div style={{ ...typeStyle('title', vertical, { tone: 'night', size }), color: C.paperDim, whiteSpace: 'nowrap' }}>
      {words.map((w, i) => (
        <Rise key={i} t={t} at={at + i * step} gap={i < words.length - 1 ? 0.24 : 0}>
          {w}
        </Rise>
      ))}
    </div>
  );
};

/* ── the colophon ─────────────────────────────────────────────── */

export const Url: React.FC<{
  t: number;
  text: string;
  /** chunk k starts at character `from` and rises at frame `at` */
  chunks: readonly { from: number; at: number }[];
  size: number;
  dot: number;
  ruleW: number;
  vertical: boolean;
  rest: Rest;
}> = ({ t, text, chunks, size, dot, ruleW, vertical, rest }) => {
  const at = chunks[0].at;
  if (t < at - 2) return null;
  const d = rest(t, springUnit(t - (at - 1), SPRING.text), 1);
  const draw = tween(t, [at + 2, at + 26], [0, 1], EASE.house);
  const parts = chunks.map((c, k) => ({ at: c.at, s: text.slice(c.from, k + 1 < chunks.length ? chunks[k + 1].from : undefined) }));
  const rule = (origin: 'left' | 'right') => (
    <div
      style={{
        flex: 1,
        height: 1,
        background: 'rgba(222,220,224,0.16)',
        transform: draw < 1 ? `scaleX(${draw.toFixed(4)})` : undefined,
        transformOrigin: origin,
      }}
    />
  );
  return (
    <div style={{ width: ruleW, display: 'flex', alignItems: 'center', gap: Math.round(size * 0.9) }}>
      {rule('right')}
      <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(size * 0.42) }}>
        <span
          style={{
            display: 'block',
            opacity: Math.min(1, Math.max(0, d)),
            transform: d < 0.9999 || d > 1.0001 ? `scale(${Math.max(0, d).toFixed(4)})` : undefined,
          }}
        >
          <CornerDot size={dot} color={C.brandLit} />
        </span>
        <div style={{ ...typeStyle('title', vertical, { tone: 'night', size }), color: C.paper, whiteSpace: 'nowrap' }}>
          {parts.map((p, k) => (
            <Rise key={k} t={t} at={p.at - 1}>
              {p.s}
            </Rise>
          ))}
        </div>
      </div>
      {rule('left')}
    </div>
  );
};
