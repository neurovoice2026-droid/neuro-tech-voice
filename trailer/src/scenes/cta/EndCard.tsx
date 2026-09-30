/**
 * The end card's type, in the site's idiom:
 *
 *  <CoverCta>  the hero's "Start free →" (hero.tsx CoverCta): a #dedce0
 *              plate (radius 6) holding four CornerDots in its corners, the
 *              label stacked in the same grid cell. Enters on SPRING.pop with
 *              anticipation; its label words rise out of masks. At `press`
 *              it takes the site's hover as if clicked — plum plate, paper
 *              text, dots out 4 px diagonally, arrow +8 px — with a
 *              .97 → 1 press.
 *  <Note>      "5 free minutes, no card" (pricing copy), words rising.
 *  <Url>       CornerDot + "neurotechvoice.com", letters rising, staggered.
 */
import React from 'react';
import { aos, EASE, mix, mixHex, SPRING, springAt, tween } from '../../lib/motion';
import { CornerDot } from '../../components/Type';
import { C, FONT } from '../../theme';

/** WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}

const MaskRise: React.FC<{
  t: number;
  at: number;
  children: React.ReactNode;
  pad?: string | number;
  config?: typeof SPRING.site;
  blur?: number;
}> = ({ t, at, children, pad = 0, config = SPRING.site, blur = 3 }) => {
  const p = aos(t, at, { anticip: 3, depth: 0.06, config });
  const pPrev = aos(t - 1, at, { anticip: 3, depth: 0.06, config });
  const b = tween(t, [at, at + 10], [blur, 0], EASE.house) + Math.min(6, Math.abs(p - pPrev) * 110 * 0.1);
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
          transform: `translateY(${((1 - p) * 110).toFixed(2)}%)`,
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
}> = ({ t, at, press, fontSize }) => {
  // entrance: from y+30, scale .9, with a small dip first
  const e = aos(t, at, { anticip: 4, depth: 0.1, config: SPRING.pop });
  const ePrev = aos(t - 1, at, { anticip: 4, depth: 0.1, config: SPRING.pop });
  const y = (1 - e) * 30;
  const sc = 0.9 + 0.1 * e;
  const vy = Math.abs(e - ePrev) * 30;

  // the hover, as the site's 500 ms colour transition (house ease)
  const h = tween(t, [press, press + 15], [0, 1], EASE.house);
  // dots and arrow ride the site spring (one 7.5 % overshoot)
  const hs = t < press ? 0 : springAt(t, press, SPRING.site);
  // the click: .97 → 1
  const click = t < press ? 1 : t < press + 3 ? mix(1, 0.97, EASE.out3((t - press) / 3)) : mix(0.97, 1, springAt(t, press + 3, SPRING.pop));
  const bg = mixHex(C.coverPaper, C.plum, h);
  // the label must never go mid-lavender on a mid-lavender plate: it stays
  // night while the plate is light and flips to paper the frame the plate
  // is dark enough for it (night ≥ 5:1 before, paper ≥ 4:1 after)
  const fg = luminance(bg) > 0.165 ? C.night : C.coverPaper;
  const dot = 9;
  const pad = 10;
  const out = 4 * hs;
  const dots: React.CSSProperties[] = [
    { justifySelf: 'start', alignSelf: 'start', transform: `translate(${-out}px, ${-out}px)` },
    { justifySelf: 'end', alignSelf: 'start', transform: `translate(${out}px, ${-out}px)` },
    { justifySelf: 'start', alignSelf: 'end', transform: `translate(${-out}px, ${out}px)` },
    { justifySelf: 'end', alignSelf: 'end', transform: `translate(${out}px, ${out}px)` },
  ];
  const dotPop = (k: number) => aos(t, at + 3 + k * 1.5, { anticip: 2, depth: 0.15, config: SPRING.pop });
  if (t < at - 4) return null;
  return (
    <div
      style={{
        display: 'inline-grid',
        fontFamily: FONT.display,
        fontWeight: 400,
        fontSize,
        lineHeight: 1.2,
        letterSpacing: '-0.04em',
        transform: `translateY(${y.toFixed(2)}px) scale(${(sc * click).toFixed(4)})`,
        opacity: Math.min(1, Math.max(0, e * 2)),
        filter: vy > 0.6 ? `blur(${Math.min(4, vy * 0.18).toFixed(2)}px)` : undefined,
      }}
    >
      <span
        style={{
          gridArea: '1 / 1',
          display: 'grid',
          gridTemplate: '1fr 1fr / 1fr 1fr',
          borderRadius: 6,
          padding: pad,
          background: bg,
          color: C.night,
          boxShadow: `0 ${0.8 * fontSize}px ${2 * fontSize}px ${-0.6 * fontSize}px rgba(0,0,0,0.75), 0 0 ${40 * h}px ${-6}px rgba(85,26,137,${0.55 * h})`,
        }}
      >
        {dots.map((d, k) => (
          <span key={k} style={{ ...d, display: 'block', width: dot, height: dot }}>
            <span style={{ display: 'block', transform: `scale(${Math.max(0, dotPop(k)).toFixed(3)})` }}>
              <CornerDot size={dot} color={fg} />
            </span>
          </span>
        ))}
      </span>
      <span
        style={{
          gridArea: '1 / 1',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: '0.45em',
          padding: '28px 34px',
          color: fg,
          whiteSpace: 'nowrap',
        }}
      >
        <span>
          <MaskRise t={t} at={at} pad="0.24em" config={SPRING.pop}>
            Start
          </MaskRise>
          <MaskRise t={t} at={at + 1.5} config={SPRING.pop}>
            free
          </MaskRise>
        </span>
        <span style={{ display: 'inline-block', transform: `translateX(${(8 * hs).toFixed(2)}px)` }}>
          <MaskRise t={t} at={at + 3} config={SPRING.pop}>
            →
          </MaskRise>
        </span>
      </span>
    </div>
  );
};

export const Note: React.FC<{ t: number; at: number; size: number }> = ({ t, at, size }) => {
  const words = '5 free minutes, no card'.split(' ');
  if (t < at - 4) return null;
  return (
    <div
      style={{
        fontFamily: FONT.body,
        fontWeight: 400,
        fontSize: size,
        lineHeight: 1.3,
        color: C.paperDim,
        whiteSpace: 'nowrap',
      }}
    >
      {words.map((w, i) => (
        <MaskRise key={i} t={t} at={at + i * 2} pad={i < words.length - 1 ? '0.26em' : 0}>
          {w}
        </MaskRise>
      ))}
    </div>
  );
};

/**
 * The colophon strip: the hero's masthead hairline (paper at 12 %) running
 * to the safe margins, broken by CornerDot + URL. The rule draws outward
 * from the URL as the letters land.
 */
export const Url: React.FC<{ t: number; at: number; size: number; ruleW: number; stagger?: number }> = ({
  t,
  at,
  size,
  ruleW,
  stagger = 0.7,
}) => {
  const text = 'neurotechvoice.com';
  if (t < at - 4) return null;
  const d = aos(t, at, { anticip: 3, depth: 0.12, config: SPRING.pop });
  const draw = tween(t, [at + 2, at + 22], [0, 1], EASE.house);
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
    <div style={{ width: ruleW, display: 'flex', alignItems: 'center', gap: Math.round(size * 1.1) }}>
      {rule('right')}
      <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(size * 0.5) }}>
        <span
          style={{
            display: 'block',
            transform: `scale(${Math.max(0, d).toFixed(3)}) rotate(${((1 - Math.min(1, d)) * -90).toFixed(2)}deg)`,
          }}
        >
          <CornerDot size={Math.round(size * 0.62)} color={C.brandLit} />
        </span>
        <div
          style={{
            fontFamily: FONT.mono,
            fontWeight: 500,
            fontSize: size,
            lineHeight: 1.2,
            letterSpacing: '0.02em',
            color: C.paper,
            whiteSpace: 'pre',
            display: 'flex',
          }}
        >
          {text.split('').map((ch, i) => (
            <MaskRise key={i} t={t} at={at + 3 + i * stagger} config={SPRING.pop} blur={2}>
              {ch}
            </MaskRise>
          ))}
        </div>
      </div>
      {rule('left')}
    </div>
  );
};
