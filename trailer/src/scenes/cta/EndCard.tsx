/**
 * The end card's type, in the site's idiom — every size is the site's own
 * ratio of its font size (hero.tsx CoverCta):
 *
 *  <CoverCta>  the hero's "Start free →": a #dedce0 plate (padding .33em,
 *              radius .2em) holding four .3em CornerDots in its corners, the
 *              label (padding .8em 1em, gap .45em) stacked in the same grid
 *              cell. Enters from a gathered point of light (3 f), pops on a
 *              card spring (≈1.08 peak), a glint sweeps the plate on the hit;
 *              label words rise out of masks. At `press` it is CLICKED:
 *              .94 in 2 f, back on SPRING.pop, and it takes the site's hover
 *              and keeps it — plum plate, paper text, dots out 4 px, arrow
 *              +8 px — with a 1.5 px brand-lit rim and a plum glow, so it
 *              stays the brightest thing under the logo.
 *  <Note>      "5 free minutes, no card" (pricing copy), Inter 500, 80 % paper.
 *  <Url>       a CornerDot + "neurotechvoice.com" (Geist Mono 500), typed ON
 *              Ava's words in three chunks ("neuro" | "tech" | "voice.com" on
 *              "Neuro" "Tech" "Voice.") with a caret; the hairline draws out
 *              from it.
 *
 * `rest(t, v, target)` (from the scene) pins every residual to its exact
 * rest value by CTA.finalHold: the hold is still.
 */
import React from 'react';
import { aos, EASE, mix, mixHex, SPRING, springAt, tween } from '../../lib/motion';
import { CornerDot } from '../../components/Type';
import { C, FONT } from '../../theme';

export type Rest = (t: number, v: number, target: number) => number;

/** WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}

/** a card pop: ≈10 % overshoot, settled (±1 %) in 13 f */
const CARD = { stiffness: 360, damping: 21, mass: 0.9 };

const MaskRise: React.FC<{
  t: number;
  at: number;
  children: React.ReactNode;
  pad?: string | number;
  config?: typeof SPRING.site;
  blur?: number;
  rest: Rest;
}> = ({ t, at, children, pad = 0, config = SPRING.site, blur = 3, rest }) => {
  const p = rest(t, aos(t, at, { anticip: 3, depth: 0.06, config }), 1);
  const pPrev = aos(t - 1, at, { anticip: 3, depth: 0.06, config });
  const b = rest(t, tween(t, [at, at + 10], [blur, 0], EASE.house) + Math.min(6, Math.abs(p - pPrev) * 110 * 0.1), 0);
  return (
    <span
      style={{
        display: 'inline-block',
        overflow: 'hidden',
        verticalAlign: 'top',
        paddingBottom: '0.16em',
        marginBottom: '-0.16em',
        paddingRight: pad,
        whiteSpace: 'pre',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          transform: p < 1 - 1e-4 || p > 1 + 1e-4 ? `translateY(${((1 - p) * 110).toFixed(2)}%)` : undefined,
          filter: b > 0.05 ? `blur(${b.toFixed(2)}px)` : undefined,
        }}
      >
        {children}
      </span>
    </span>
  );
};

export const CoverCta: React.FC<{
  t: number;
  at: number;
  press: number;
  fontSize: number;
  rest: Rest;
}> = ({ t, at, press, fontSize: F, rest }) => {
  if (t < at - 4) return null;
  // entrance: a point of light gathers (3 f), then the plate pops out of it
  const e = t < at ? 0 : springAt(t, at, CARD);
  const ePrev = t - 1 < at ? 0 : springAt(t - 1, at, CARD);
  const sc = rest(t, t < at ? 0 : mix(0.2, 1, e), 1);
  const y = rest(t, (1 - Math.min(1, e)) * 26, 0);
  const vy = Math.abs(e - ePrev) * 0.8 * F * 4; // px/frame of the plate's growing edge
  const gather = t < at ? Math.sin(((t - (at - 4)) / 4) * (Math.PI / 2)) : Math.max(0, 1 - (t - at) / 3);

  // the click: .94 in 2 f (in2), then back on the pop spring
  const D = 2;
  const u = t - press;
  const click = rest(
    t,
    u < 0 ? 1 : u < D ? mix(1, 0.94, EASE.in2(u / D)) : mix(0.94, 1, springAt(t, press + D, SPRING.pop)),
    1,
  );
  // the hover it takes (and keeps): colour ON the click, dots/arrow on the site spring
  const h = tween(t, [press, press + 7], [0, 1], EASE.house);
  const hs = rest(t, t < press ? 0 : springAt(t, press, SPRING.site), 1);
  const bg = mixHex(C.coverPaper, C.plum, h);
  // the label stays night while the plate is light, flips to paper as soon as
  // the plate is dark enough for it (night ≥ 5:1 before, paper ≥ 4:1 after)
  const fg = luminance(bg) > 0.165 ? C.night : C.coverPaper;
  const dot = 0.3 * F;
  const out = 4 * hs;
  const dots: React.CSSProperties[] = [
    { justifySelf: 'start', alignSelf: 'start', transform: `translate(${-out}px, ${-out}px)` },
    { justifySelf: 'end', alignSelf: 'start', transform: `translate(${out}px, ${-out}px)` },
    { justifySelf: 'start', alignSelf: 'end', transform: `translate(${-out}px, ${out}px)` },
    { justifySelf: 'end', alignSelf: 'end', transform: `translate(${out}px, ${out}px)` },
  ];
  const dotPop = (k: number) => rest(t, aos(t, at + 3 + k * 1.5, { anticip: 2, depth: 0.15, config: SPRING.pop }), 1);
  // the hit's accent: a glint sweeps the plate (at +1 … +9)
  const sweep = tween(t, [at + 1, at + 9], [-0.4, 1.4], EASE.inOut);
  const sweepO = t > at && t < at + 9 ? 0.55 * Math.sin(Math.PI * tween(t, [at + 1, at + 9], [0, 1])) : 0;
  // the click's accent: a brand-lit ring leaves the plate
  const ringU = tween(t, [press, press + 10], [0, 1], EASE.out3);
  const ringO = t >= press && t < press + 10 ? (1 - ringU) * 0.7 : 0;

  return (
    <div style={{ position: 'relative', display: 'inline-grid' }}>
      {gather > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: F * 2.4,
            height: F * 2.4,
            marginLeft: -F * 1.2,
            marginTop: -F * 1.2,
            borderRadius: '50%',
            opacity: gather,
            transform: `scale(${(t < at ? mix(0.35, 0.8, gather) : 0.8 + 0.6 * (t - at) / 3).toFixed(3)})`,
            background: 'radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(222,220,224,0.55) 18%, rgba(192,172,224,0.18) 42%, rgba(192,172,224,0) 70%)',
          }}
        />
      ) : null}
      <div
        style={{
          display: 'inline-grid',
          fontFamily: FONT.display,
          fontWeight: 400,
          fontSize: F,
          lineHeight: 1.2,
          letterSpacing: '-0.04em',
          transform: `translateY(${y.toFixed(2)}px) scale(${(sc * click).toFixed(4)})`,
          opacity: t < at ? 0 : Math.min(1, e * 3),
          filter: vy > 3 && t < at + 8 ? `blur(${Math.min(3, vy * 0.04).toFixed(2)}px)` : undefined,
        }}
      >
        <span
          style={{
            gridArea: '1 / 1',
            position: 'relative',
            overflow: 'hidden',
            display: 'grid',
            gridTemplate: '1fr 1fr / 1fr 1fr',
            borderRadius: '0.2em',
            padding: '0.33em',
            background: bg,
            color: C.night,
            boxShadow: [
              `inset 0 0 0 1.5px rgba(192,172,224,${(0.6 * h).toFixed(3)})`,
              `0 0 48px rgba(85,26,137,${(0.6 * h).toFixed(3)})`,
              `0 ${0.5 * F}px ${1.4 * F}px ${-0.5 * F}px rgba(0,0,0,0.7)`,
            ].join(', '),
          }}
        >
          {dots.map((d, k) => (
            <span key={k} style={{ ...d, display: 'block', width: dot, height: dot }}>
              <span style={{ display: 'block', transform: `scale(${Math.max(0, dotPop(k)).toFixed(3)})` }}>
                <CornerDot size={dot} color={fg} />
              </span>
            </span>
          ))}
          {sweepO > 0.01 ? (
            <span
              style={{
                position: 'absolute',
                inset: 0,
                background: `linear-gradient(105deg, rgba(255,255,255,0) ${((sweep - 0.25) * 100).toFixed(1)}%, rgba(255,255,255,${sweepO.toFixed(3)}) ${(sweep * 100).toFixed(1)}%, rgba(255,255,255,0) ${((sweep + 0.25) * 100).toFixed(1)}%)`,
                mixBlendMode: 'screen',
              }}
            />
          ) : null}
        </span>
        <span
          style={{
            gridArea: '1 / 1',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '0.45em',
            padding: '0.8em 1em',
            color: fg,
            whiteSpace: 'nowrap',
          }}
        >
          <span>
            <MaskRise t={t} at={at} pad="0.24em" config={SPRING.pop} rest={rest}>
              Start
            </MaskRise>
            <MaskRise t={t} at={at + 1.5} config={SPRING.pop} rest={rest}>
              free
            </MaskRise>
          </span>
          <span style={{ display: 'inline-block', transform: `translateX(${(8 * hs).toFixed(2)}px)` }}>
            <MaskRise t={t} at={at + 3} config={SPRING.pop} rest={rest}>
              →
            </MaskRise>
          </span>
        </span>
      </div>
      {ringO > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: `${0.2 * F + 6 + 26 * ringU}px`,
            transform: `scale(${(1 + 0.18 * ringU).toFixed(4)}, ${(1 + 0.5 * ringU).toFixed(4)})`,
            boxShadow: `0 0 0 ${(2 * (1 - ringU) + 1).toFixed(2)}px rgba(192,172,224,${ringO.toFixed(3)})`,
          }}
        />
      ) : null}
    </div>
  );
};

export const Note: React.FC<{ t: number; at: number; size: number; rest: Rest }> = ({ t, at, size, rest }) => {
  const words = '5 free minutes, no card'.split(' ');
  if (t < at - 4) return null;
  return (
    <div
      style={{
        fontFamily: FONT.body,
        fontWeight: 500,
        fontSize: size,
        lineHeight: 1.3,
        color: 'rgba(237,236,241,0.8)',
        whiteSpace: 'nowrap',
      }}
    >
      {words.map((w, i) => (
        <MaskRise key={i} t={t} at={at + i * 1.5} pad={i < words.length - 1 ? '0.26em' : 0} rest={rest}>
          {w}
        </MaskRise>
      ))}
    </div>
  );
};

/**
 * The colophon strip: the hero's masthead hairline (paper at 16 %) running
 * to the safe margins, broken by a CornerDot + the URL. The URL TYPES from
 * its cue frame (one character per `step` frames, each landing with a 1-frame
 * rise), a brand-lit caret riding ahead of it; the rule draws out from the
 * URL as it types. Full paper, never dimmed.
 */
export const Url: React.FC<{
  t: number;
  at: number;
  /** typed in chunks: chunk k starts at character `from` on frame `at` */
  chunks?: readonly { from: number; at: number }[];
  size: number;
  dot: number;
  ruleW: number;
  step: number;
  rest: Rest;
}> = ({ t, at, chunks, size, dot, ruleW, step, rest }) => {
  const text = 'neurotechvoice.com';
  if (t < at - 3) return null;
  const d = rest(t, aos(t, at - 1, { anticip: 2, depth: 0.2, config: SPRING.pop }), 1);
  const draw = tween(t, [at + 2, at + 20], [0, 1], EASE.house);
  const n = text.length;
  const parts = chunks && chunks.length ? chunks : [{ from: 0, at }];
  /** the frame character i is typed */
  const charAt = (i: number) => {
    let c = parts[0];
    for (const p of parts) if (i >= p.from) c = p;
    return c.at + (i - c.from) * step;
  };
  let typedN = 0;
  for (let i = 0; i < n; i++) if (t >= charAt(i)) typedN = i + 1;
  const typed = typedN - 1 + 1e-3; // (whole characters typed, for the caret)
  const doneAt = charAt(n - 1);
  // caret: on while typing, then a blink off
  const caretO = t < at ? 0 : t <= doneAt + 2 ? 1 : tween(t, [doneAt + 2, doneAt + 5], [1, 0], EASE.in2);
  const rule = (origin: 'left' | 'right') => (
    <div
      style={{
        flex: 1,
        height: 1,
        background: 'rgba(222,220,224,0.16)',
        transform: `scaleX(${draw.toFixed(4)})`,
        transformOrigin: origin,
      }}
    />
  );
  return (
    <div style={{ width: ruleW, display: 'flex', alignItems: 'center', gap: Math.round(size * 0.9) }}>
      {rule('right')}
      <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(size * 0.45) }}>
        <span
          style={{
            display: 'block',
            transform: `scale(${Math.max(0, d).toFixed(3)}) rotate(${((1 - Math.min(1, d)) * -90).toFixed(2)}deg)`,
          }}
        >
          <CornerDot size={dot} color={C.brandLit} />
        </span>
        <div
          style={{
            position: 'relative',
            fontFamily: FONT.mono,
            fontWeight: 500,
            fontSize: size,
            lineHeight: 1.2,
            letterSpacing: '0.01em',
            color: C.paper,
            whiteSpace: 'pre',
            display: 'flex',
          }}
        >
          {text.split('').map((ch, i) => {
            const k = t - charAt(i); // ≥ 0 once typed
            const up = k < 0 ? 0 : rest(t, springAt(t, charAt(i), SPRING.pop), 1);
            return (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  opacity: k < 0 ? 0 : 1,
                  transform: up < 1 - 1e-4 || up > 1 + 1e-4 ? `translateY(${((1 - up) * 0.22).toFixed(3)}em)` : undefined,
                }}
              >
                {ch}
              </span>
            );
          })}
          {caretO > 0.01 ? (
            <span
              style={{
                position: 'absolute',
                top: '0.12em',
                left: `${(Math.min(n, Math.max(0, Math.floor(typed) + 1)) * 0.61).toFixed(3)}em`, // Geist Mono advance .6em + .01em tracking
                width: '0.08em',
                height: '0.96em',
                marginLeft: '0.06em',
                background: C.brandLit,
                opacity: caretO,
                boxShadow: `0 0 12px rgba(192,172,224,${(0.6 * caretO).toFixed(3)})`,
              }}
            />
          ) : null}
        </div>
      </div>
      {rule('left')}
    </div>
  );
};
