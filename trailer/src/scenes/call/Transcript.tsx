/**
 * The #demo transcript at film scale. No bubbles, no avatars: a speaker
 * tag (AVA lilac / CALLER callerLit, Inter 600, tracked .16em) and the
 * words, centred; only colour tells the voices apart (demo.tsx:690-721).
 *
 * The typewriter never reflows: the whole line is laid out from the first
 * frame and characters develop in place (fade + 0.1em rise + blur-out over
 * three frames — a letter stagger at CALL.typeRate), with a caret in the
 * speaker's colour after the last one. Lines enter from +40 % on the site
 * spring and leave to −30 % (power2.in), as the site's timeline does.
 */
import React from 'react';
import { BookedMark } from '../../components/Shared';
import { aos, EASE, mixHex, SPRING, springAt, tween } from '../../lib/motion';
import { C, FONT, TRACK } from '../../theme';
import { CALL } from '../../timing';
import type { Who } from './voice';

const RATE = CALL.typeRate;
const DEVELOP = 3; // frames a character takes to develop

export const speakerColor = (who: Who) => (who === 'agent' ? C.lilac : C.callerLit);

/** smooth caret blink (period 18 f), 1 while typing */
export function caretBlink(t: number, typedAt: number) {
  if (t < typedAt) return 1;
  const c = Math.cos((2 * Math.PI * (t - typedAt)) / 18);
  const x = Math.min(1, Math.max(0, (c + 0.25) / 0.5));
  return x * x * (3 - 2 * x);
}

const Caret: React.FC<{ color: string; opacity: number }> = ({ color, opacity }) => (
  <span style={{ position: 'relative' }}>
    <span
      style={{
        position: 'absolute',
        left: '0.06em',
        top: '0.1em',
        width: 3,
        height: '1.04em',
        borderRadius: 1.5,
        background: color,
        boxShadow: `0 0 10px ${color}99`,
        opacity,
      }}
    />
  </span>
);

export type TypedLineProps = {
  t: number;
  who: Who;
  text: string;
  /** frame the line starts typing */
  at: number;
  /** index of text[0] in the spoken line (row A of the last line is its start) */
  charStart?: number;
  fontSize: number;
  maxWidth: number;
  cx: number;
  cy: number;
  /** frame the next line starts (this one leaves) */
  exitAt?: number;
  /** frames the exit takes before exitAt (compressed for a line with a short hold) */
  exitDur?: number;
  /** show the caret in this line (false once it has moved to another row) */
  caret: boolean;
  /** a phrase that takes the site's AI-disclosure underline, and when it draws */
  disclose?: { phrase: string; at: number };
  /** exit dressing for the scene's recede */
  recede?: { opacity: number; blur: number };
};

/**
 * A line leaves over [exitAt − dur, exitAt + 1]: it travels −30 % and fades on
 * the same power2.in, so the move is seen while the line is still there, and
 * it is gone before the next line's first glyph develops (that line mounts at
 * its own `at`; its tag's anticipation keeps it invisible on that frame).
 */
const EXIT_DUR = 6;
export function lineVisible(t: number, at: number, exitAt?: number) {
  return t >= at && (exitAt === undefined || t <= exitAt + 1);
}

export const TypedLine: React.FC<TypedLineProps> = ({
  t,
  who,
  text,
  at,
  charStart = 0,
  fontSize,
  maxWidth,
  cx,
  cy,
  exitAt,
  exitDur = EXIT_DUR,
  caret,
  disclose,
  recede,
}) => {
  if (!lineVisible(t, at, exitAt)) return null;
  const tagCol = speakerColor(who);
  const wordCol = who === 'agent' ? C.paper : C.callerLit;
  const typedF = (t - at) * RATE - charStart; // chars of THIS row typed (fractional)
  // the caret sits after the last character that has started to develop
  const n = Math.max(0, Math.min(text.length, Math.ceil(typedF - 1e-6)));

  /* entry: +40 % → 0 on the site spring (7.5 % overshoot); exit: −30 % + fade, power2.in */
  const e = springAt(t, at, SPRING.site);
  const inOp = tween(t, [at, at + 5], [0, 1], EASE.out3);
  const u = exitAt === undefined ? 0 : EASE.in2(tween(t, [exitAt - exitDur, exitAt + 1], [0, 1], (x) => x));
  const dy = 40 * (1 - e) - 30 * u;
  const opacity = inOp * (1 - u) * (recede?.opacity ?? 1);
  const blur = 5 * u + (1 - Math.min(1, e)) * 2 + (recede?.blur ?? 0);

  // tag metrics: the tag's caps sit centred on the words' x-height
  const tagFs = Math.round(fontSize * 0.42);
  const lift = (0.546 * fontSize - 0.727 * tagFs) / 2;

  // the disclosure phrase
  const dIdx = disclose ? text.indexOf(disclose.phrase) : -1;
  const dEnd = dIdx >= 0 ? dIdx + disclose!.phrase.length : -1;
  const dP = disclose ? tween(t, [disclose.at, disclose.at + 12], [0, 1], EASE.house) : 0;

  const typedAt = at + (charStart + text.length) / RATE;
  const caretOp = caret && (exitAt === undefined || t < exitAt - exitDur + 2) ? caretBlink(t, typedAt) : 0;

  const chars: React.ReactNode[] = [];
  const renderChar = (i: number) => {
    const p = Math.min(1, Math.max(0, (typedF - i) / (DEVELOP * RATE)));
    const ep = EASE.out3(p);
    const ch = text[i];
    const style: React.CSSProperties =
      p >= 1
        ? {}
        : {
            opacity: ep,
            position: 'relative',
            top: `${((1 - ep) * 0.1).toFixed(3)}em`,
            filter: p > 0 && p < 1 ? `blur(${((1 - ep) * 2.5).toFixed(2)}px)` : undefined,
          };
    return (
      <span key={i} style={style}>
        {ch}
      </span>
    );
  };
  const withCaret = (i: number, node: React.ReactNode) =>
    caretOp > 0.01 && i === n - 1 ? [node, <Caret key="caret" color={tagCol} opacity={caretOp} />] : [node];

  if (caretOp > 0.01 && n === 0) chars.push(<Caret key="caret" color={tagCol} opacity={caretOp} />);
  let i = 0;
  while (i < text.length) {
    if (i === dIdx) {
      const inner: React.ReactNode[] = [];
      for (let k = dIdx; k < dEnd; k++) inner.push(...withCaret(k, renderChar(k)));
      chars.push(
        <span
          key={`d${i}`}
          style={{
            paddingBottom: '0.14em',
            backgroundImage: `linear-gradient(${C.electric}, ${C.electric})`,
            backgroundRepeat: 'no-repeat',
            backgroundSize: `${(dP * 100).toFixed(2)}% 3px`,
            backgroundPosition: '0 1.25em',
          }}
        >
          {inner}
        </span>,
      );
      i = dEnd;
      continue;
    }
    chars.push(...withCaret(i, renderChar(i)));
    i++;
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: cx - maxWidth / 2,
        width: maxWidth,
        top: cy,
        transform: `translateY(calc(-50% + ${dy.toFixed(2)}%))`,
        opacity,
        filter: blur > 0.1 ? `blur(${blur.toFixed(2)}px)` : undefined,
        textAlign: 'center',
        textWrap: 'balance',
        fontFamily: FONT.body,
        fontWeight: 500,
        fontSize,
        lineHeight: 1.22,
        letterSpacing: '-0.01em',
        color: wordCol,
      }}
    >
      <span
        style={{
          display: 'inline-block',
          marginRight: 18,
          fontSize: tagFs,
          fontWeight: 600,
          letterSpacing: TRACK.tag,
          lineHeight: 1,
          textTransform: 'uppercase',
          color: tagCol,
          verticalAlign: `${lift.toFixed(1)}px`,
        }}
      >
        {(who === 'agent' ? 'Ava' : 'Caller').split('').map((c, k) => {
          const s = aos(t, at + k * 1.2, { anticip: 2, depth: 0.15, config: SPRING.pop });
          return (
            <span
              key={k}
              style={{
                display: 'inline-block',
                opacity: Math.min(1, Math.max(0, s * 1.4)),
                transform: `translateY(${((1 - s) * 0.5).toFixed(3)}em)`,
              }}
            >
              {c}
            </span>
          );
        })}
      </span>
      {chars}
    </div>
  );
};

/* ── the last line's row B: the booked mark ─────────────────────── */

const MARK_TEXT = 'Wednesday at 15:00';

/** The mark's box, exactly as <BookedMark> sets it (Shared.tsx), so the swap is invisible. */
const markBox = (x: number, y: number, fontSize: number): React.CSSProperties => ({
  position: 'absolute',
  left: x,
  top: y,
  transform: 'translate(-50%, -50%)',
  whiteSpace: 'nowrap',
  fontFamily: FONT.body,
  fontWeight: 500,
  fontSize,
  lineHeight: 1.22,
  letterSpacing: '-0.01em',
});

/** a character developing in place (fade + 0.1em rise + blur) — row A's typewriter */
const developStyle = (p: number): React.CSSProperties => {
  if (p >= 1) return {};
  const ep = EASE.out3(Math.max(0, p));
  return {
    opacity: ep,
    position: 'relative',
    top: `${((1 - ep) * 0.1).toFixed(3)}em`,
    filter: p > 0 ? `blur(${((1 - ep) * 2.5).toFixed(2)}px)` : undefined,
  };
};

export const MarkRow: React.FC<{
  t: number;
  /** characters of row B typed (fractional; the mark, then the period) */
  typedF: number;
  /** 0..1 paper → ember */
  ember: number;
  /** 0..1 light sweep across the mark (ember turn); <0 or >1 none */
  sheen: number;
  /** 0..1 the ember glow under the mark */
  glow: number;
  /** the payoff beat: the mark's scale (exactly 1 before the hand-over) */
  pulse: number;
  /** 0..1 the period leaves (before the mark is handed over) */
  periodOut: number;
  x: number;
  y: number;
  fontSize: number;
  show: boolean;
  caret: number;
}> = ({ typedF, ember, sheen, glow, pulse, periodOut, x, y, fontSize, show, caret }) => {
  const color = mixHex(C.paper, C.emberLit, ember);
  const sheenOn = sheen > 0 && sheen < 1;
  const len = MARK_TEXT.length;
  const pOf = (i: number) => Math.min(1, Math.max(0, (typedF - i) / (DEVELOP * RATE)));
  const developing = pOf(len - 1) < 1;
  const n = Math.max(0, Math.min(len, Math.ceil(typedF - 1e-6))); // chars started
  const caretEl = (
    <span key="caret" style={{ position: 'relative' }}>
      <span
        style={{
          position: 'absolute',
          left: '0.06em',
          top: '0.1em',
          width: 3,
          height: '1.04em',
          borderRadius: 1.5,
          background: C.lilac,
          boxShadow: `0 0 10px ${C.lilac}99`,
          opacity: caret,
        }}
      />
    </span>
  );
  const pPeriod = pOf(len);
  return (
    <>
      {glow > 0.005 ? (
        <div
          style={{
            position: 'absolute',
            left: x - fontSize * 5.6,
            top: y - fontSize * 1.1,
            width: fontSize * 11.2,
            height: fontSize * 2.2,
            background: `radial-gradient(closest-side, rgba(238,84,35,${(0.42 * glow).toFixed(3)}), rgba(238,84,35,${(0.14 * glow).toFixed(3)}) 55%, rgba(238,84,35,0))`,
          }}
        />
      ) : null}
      {show && typedF > 0 ? (
        developing ? (
          /* typing: the mark's own box, one span per character, developing like row A */
          <div style={{ ...markBox(x, y, fontSize), color }}>
            {MARK_TEXT.split('').map((ch, i) => (
              <React.Fragment key={i}>
                <span style={developStyle(pOf(i))}>{ch}</span>
                {caret > 0.01 && n < len && i === n - 1 ? caretEl : null}
              </React.Fragment>
            ))}
          </div>
        ) : (
          <BookedMark
            color={color}
            x={x}
            y={y}
            fontSize={fontSize}
            style={{
              transform: `translate(-50%, -50%) scale(${pulse.toFixed(5)})`,
              ...(sheenOn
                ? {
                    backgroundImage: `linear-gradient(100deg, ${color} 0%, ${color} 38%, ${C.emberSoft} 50%, ${color} 62%, ${color} 100%)`,
                    backgroundSize: '300% 100%',
                    backgroundPosition: `${((1 - sheen) * 100).toFixed(2)}% 0`,
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }
                : null),
            }}
          />
        )
      ) : null}
      {/* the period + the caret ride a twin of the mark's box (same face / size) */}
      {n >= len ? (
        <div style={{ ...markBox(x, y, fontSize), color: C.paper }}>
          <span style={{ visibility: 'hidden' }}>{MARK_TEXT}</span>
          <span
            style={{
              ...developStyle(pPeriod),
              position: 'absolute',
              left: '100%',
              top: `${((1 - EASE.out3(pPeriod)) * 0.1).toFixed(3)}em`,
              opacity: EASE.out3(pPeriod) * (1 - periodOut),
            }}
          >
            .
          </span>
          {caret > 0.01 ? (
            <span
              style={{
                position: 'absolute',
                left: `calc(100% + ${pPeriod > 0 ? '0.34em' : '0.06em'})`,
                top: '0.1em',
                width: 3,
                height: '1.04em',
                borderRadius: 1.5,
                background: C.lilac,
                boxShadow: `0 0 10px ${C.lilac}99`,
                opacity: caret,
              }}
            />
          ) : null}
        </div>
      ) : null}
    </>
  );
};

/* ── slot chips (line 3): "15:00" · "16:30" ─────────────────────── */
export const Chips: React.FC<{
  t: number;
  cx: number;
  cy: number;
  pops: readonly [number, number];
  pick: number;
  leave: number;
}> = ({ t, cx, cy, pops, pick, leave }) => {
  if (t < pops[0] - 4 || t > leave + 14) return null;
  const labels = ['15:00', '16:30'];
  const gap = 18;
  const w = 164;
  const h = 64;
  return (
    <>
      {labels.map((lab, i) => {
        const s = aos(t, pops[i], { anticip: 3, depth: 0.12, config: SPRING.pop });
        if (t < pops[i] - 3) return null;
        const scale0 = 0.7 + 0.3 * s;
        // the anticipation is SEEN: the chip ghosts in at ~.35 while it gathers, then pops
        const popOp = t < pops[i] ? tween(t, [pops[i] - 3, pops[i]], [0, 0.35], EASE.out3) : Math.min(1, 0.35 + 1.5 * Math.max(0, s));
        const selected = i === 0;
        // selection: press .96 → 1 and fill paper
        const fill = selected ? tween(t, [pick, pick + 6], [0, 1], EASE.house) : 0;
        const press = selected
          ? t < pick
            ? 1 - 0.04 * tween(t, [pick - 3, pick], [0, 1], EASE.in2)
            : 0.96 + 0.04 * springAt(t, pick, SPRING.land)
          : 1;
        // the other slot dims to 30 % and drifts away
        const dim = !selected ? tween(t, [pick, pick + 14], [0, 1], EASE.house) : 0;
        const drift = dim * 26;
        // leave (line 5): drop + fade, staggered
        const lv = tween(t, [leave + i * 2, leave + i * 2 + 10], [0, 1], EASE.in2);
        const baseX = cx + (i === 0 ? -1 : 1) * (w / 2 + gap / 2);
        return (
          <div
            key={lab}
            style={{
              position: 'absolute',
              left: baseX - w / 2 + drift,
              top: cy - h / 2 + lv * 26,
              width: w,
              height: h,
              borderRadius: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.08)',
              overflow: 'hidden',
              boxShadow:
                `inset 0 0 0 1px rgba(255,255,255,${(0.15 * (1 - fill)).toFixed(3)}), inset 0 1px 0 rgba(255,255,255,${(0.08 + 0.3 * fill).toFixed(3)})` +
                (fill > 0.01 ? `, 0 14px 30px -14px rgba(8,6,28,${(0.8 * fill).toFixed(3)}), 0 0 ${(30 * fill).toFixed(1)}px rgba(237,236,241,${(0.18 * fill).toFixed(3)})` : ''),
              transform: `scale(${(scale0 * press).toFixed(4)})`,
              opacity: popOp * (1 - 0.7 * dim) * (1 - lv),
              filter: dim > 0.01 || lv > 0.01 ? `blur(${(dim * 1.5 + lv * 4).toFixed(2)}px)` : undefined,
              fontFamily: FONT.mono,
              fontWeight: 500,
              fontSize: 30,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '0.02em',
              color: mixHex(C.paper, C.ink, fill),
            }}
          >
            {fill > 0.001 ? (
              /* the selection floods out from the centre (an ink-fill, clipped by the pill) */
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 9999,
                  background: C.paper,
                  clipPath: `circle(${(14 + 82 * fill).toFixed(2)}px at 50% 50%)`,
                }}
              />
            ) : null}
            <span style={{ position: 'relative' }}>{lab}</span>
          </div>
        );
      })}
    </>
  );
};
