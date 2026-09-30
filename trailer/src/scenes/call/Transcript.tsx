/**
 * The transcript's screen-space furniture (captions themselves are the
 * shared <Captions>, driven by the voice):
 *
 *   <SpeakerTag>  AVA / CALLER, stacked above the caption, led by a small
 *                 mesh orb in the speaker's colours; it swaps on each cut.
 *   <Chips>       the slot chips "15:00" · "16:30": pop ON the spoken words,
 *                 15:00 is picked (squash, fill flood, glow), 16:30 drops out.
 *   <MarkRow>     row B of the last line — "Wednesday at 15:00" arrives word
 *                 by word ON the voice, 15:00 ignites ember on "three", then it
 *                 is the single <BookedMark> the result picks up.
 */
import React from 'react';
import { MeshOrb } from '../../components/MeshOrb';
import { BookedMark } from '../../components/Shared';
import { EASE, mixHex, SPRING, springAt, tween } from '../../lib/motion';
import { C, FONT, ORB, TRACK } from '../../theme';
import type { Who } from './voice';

/** the caller's orb colours (a cool, desaturated steel — the "other end of the line") */
export const CALLER_ORB = ['#2c3044', '#5d6480', '#7a83a0', '#9aa4bd', '#e2e8f2'] as const;

/** 0.8 → 1.08 → 1: a pop with its overshoot and settle, from frame `a` */
const popScale = (t: number, a: number) =>
  t < a ? 0.8 : t < a + 3 ? 0.8 + 0.28 * EASE.out3((t - a) / 3) : 1.08 - 0.08 * springAt(t, a + 3, SPRING.pop);

export const SpeakerTag: React.FC<{
  t: number;
  who: Who;
  /** frame the tag swaps in (the cut) */
  at: number;
  x: number;
  y: number;
  fontSize: number;
  dot: number;
}> = ({ t, who, at, x, y, fontSize, dot }) => {
  if (t < at) return null;
  const label = who === 'agent' ? 'AVA' : 'CALLER';
  const col = who === 'agent' ? C.lilac : C.callerLit;
  const dotS = popScale(t, at);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        alignItems: 'center',
        gap: Math.round(fontSize * 0.42),
        opacity: 0.9,
      }}
    >
      <div
        style={{
          width: dot,
          height: dot,
          transform: `scale(${dotS.toFixed(4)})`,
          opacity: tween(t, [at, at + 2], [0, 1], EASE.out3),
          borderRadius: '50%',
          boxShadow: `0 0 12px ${who === 'agent' ? 'rgba(185,163,255,0.55)' : 'rgba(169,188,255,0.45)'}`,
        }}
      >
        <MeshOrb size={dot} palette={who === 'agent' ? ORB.ink : CALLER_ORB} time={t / 30} />
      </div>
      <div
        style={{
          display: 'flex',
          fontFamily: FONT.body,
          fontWeight: 600,
          fontSize,
          lineHeight: 1,
          letterSpacing: TRACK.tag,
          marginRight: `-${TRACK.tag}`,
          color: col,
        }}
      >
        {label.split('').map((ch, k) => {
          const a = at + 1 + k;
          return (
            <span
              key={k}
              style={{
                display: 'inline-block',
                opacity: tween(t, [a - 1, a + 1], [0, 1], EASE.out3),
                transform: `scale(${popScale(t, a).toFixed(4)})`,
              }}
            >
              {ch}
            </span>
          );
        })}
      </div>
    </div>
  );
};

/* ── slot chips (line 3): "15:00" · "16:30" ─────────────────────── */
const CHIP_SPRING = { stiffness: 520, damping: 22, mass: 1 };

export const Chips: React.FC<{
  t: number;
  cx: number;
  cy: number;
  w: number;
  h: number;
  fontSize: number;
  /** frames the chips pop (their attack starts 1 f before) */
  pops: readonly [number, number];
  pick: number;
  leave: number;
}> = ({ t, cx, cy, w, h, fontSize, pops, pick, leave }) => {
  if (t < pops[0] - 1 || t > leave + 9) return null;
  const labels = ['15:00', '16:30'];
  const gap = 32;
  const lv = tween(t, [leave, leave + 8], [0, 1], EASE.in2);
  return (
    <>
      {labels.map((lab, i) => {
        const p0 = pops[i] - 1;
        if (t < p0) return null;
        const s = springAt(t, p0, CHIP_SPRING);
        const selected = i === 0;
        // pick: 15:00 squashes (.92, 2 f), pops to 1.08 and settles; 16:30 drops out
        const press = selected
          ? t < pick - 2
            ? 1
            : t < pick
              ? 1 - 0.08 * EASE.in2((t - (pick - 2)) / 2)
              : t < pick + 3
                ? 0.92 + 0.16 * EASE.out3((t - pick) / 3)
                : 1.08 - 0.08 * springAt(t, pick + 3, SPRING.land)
          : 1;
        const fill = selected ? tween(t, [pick, pick + 6], [0, 1], EASE.house) : 0;
        const drop = !selected ? tween(t, [pick, pick + 8], [0, 1], EASE.in2) : 0;
        const ring = tween(t, [pops[i], pops[i] + 10], [0, 1], EASE.out3);
        const baseX = cx + (i === 0 ? -1 : 1) * (w / 2 + gap / 2);
        const op = Math.min(1, Math.max(0, s * 3)) * (1 - drop) * (1 - lv);
        if (op <= 0.002) return null;
        const blur = drop * 6 + lv * 4;
        return (
          <div
            key={lab}
            style={{
              position: 'absolute',
              left: baseX - w / 2,
              top: cy - h / 2 + drop * 20 - lv * 16,
              width: w,
              height: h,
              opacity: op,
              filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
            }}
          >
            {/* the pop ring: 1 → 1.6×, fading */}
            {t >= pops[i] && ring < 1 ? (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: h / 2,
                  boxShadow: `0 0 0 1.5px rgba(185,163,255,${(0.9 * (1 - ring)).toFixed(3)})`,
                  transform: `scale(${(1 + 0.6 * ring).toFixed(4)})`,
                }}
              />
            ) : null}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: h / 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                background: 'rgba(255,255,255,0.08)',
                boxShadow:
                  `inset 0 0 0 1.5px rgba(185,163,255,${(0.5 * (1 - fill)).toFixed(3)}), inset 0 1px 0 rgba(255,255,255,${(0.1 + 0.3 * fill).toFixed(3)}), 0 18px 36px -18px rgba(8,6,28,0.85)` +
                  (fill > 0.01 ? `, 0 0 32px rgba(185,163,255,${(0.5 * fill).toFixed(3)})` : ''),
                transform: `scale(${(Math.max(0, s) * press).toFixed(4)})`,
                fontFamily: FONT.mono,
                fontWeight: 500,
                fontSize,
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '0.01em',
                color: mixHex(C.paper, C.ink, fill),
              }}
            >
              {fill > 0.001 ? (
                /* the selection floods out from the centre (an ink-fill, clipped by the pill) */
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: C.paper,
                    clipPath: `circle(${(14 + (Math.hypot(w, h) / 2 - 10) * fill).toFixed(2)}px at 50% 50%)`,
                  }}
                />
              ) : null}
              <span style={{ position: 'relative' }}>{lab}</span>
            </div>
          </div>
        );
      })}
    </>
  );
};

/* ── the last line's row B: the booked mark ─────────────────────── */

const MARK_WORDS = ['Wednesday', 'at', '15:00'];
const ENTER = 6;

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

/** a word entering in place: opacity, .16em rise, blur 3 → 0 over 6 f (on its appear frame it is 1/6 in) */
const enterStyle = (t: number, a: number): React.CSSProperties => {
  const u = Math.min(1, Math.max(0, (t - a + 1) / ENTER));
  if (u >= 1) return { display: 'inline-block' };
  const e = EASE.out3(u);
  return {
    display: 'inline-block',
    opacity: u <= 0 ? 0 : e,
    transform: `translateY(${(0.16 * (1 - e)).toFixed(4)}em)`,
    filter: u > 0 ? `blur(${(3 * (1 - e)).toFixed(2)}px)` : undefined,
  };
};

export const MarkRow: React.FC<{
  t: number;
  /** appear frames of "Wednesday", "at", "15:00" and the period */
  appear: readonly [number, number, number, number];
  /** 0..1 paper → ember */
  ember: number;
  /** 0..1 light sweep across the mark (ember turn); <0 or >1 none */
  sheen: number;
  /** the payoff beat: the mark's scale (exactly 1 before the hand-over) */
  pulse: number;
  /** 0..1 the period folds out (before the mark is handed over) */
  periodOut: number;
  x: number;
  y: number;
  fontSize: number;
  show: boolean;
}> = ({ t, appear, ember, sheen, pulse, periodOut, x, y, fontSize, show }) => {
  if (!show || t < appear[0] - 1) return null;
  const color = mixHex(C.paper, C.emberLit, ember);
  const sheenOn = sheen > 0 && sheen < 1;
  const allIn = t >= appear[2] - 1 + ENTER;
  const pPeriod = Math.min(1, Math.max(0, (t - appear[3] + 1) / ENTER));
  const scale = `scale(${pulse.toFixed(5)})`;
  return (
    <>
      {allIn ? (
        <BookedMark
          color={color}
          x={x}
          y={y}
          fontSize={fontSize}
          style={{
            transform: `translate(-50%, -50%) ${scale}`,
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
      ) : (
        /* arriving: the mark's own box, one span per word, each entering on its spoken word */
        <div style={{ ...markBox(x, y, fontSize), transform: `translate(-50%, -50%) ${scale}`, color }}>
          {MARK_WORDS.map((w, i) => (
            <React.Fragment key={i}>
              {i > 0 ? ' ' : null}
              <span
                style={{
                  ...enterStyle(t, appear[i]),
                  // "15:00" arrives with the ember: a hot core that cools into the mark
                  textShadow:
                    i === 2 && t >= appear[2] ? `0 0 0.4em rgba(255,184,119,${(0.7 * (1 - ember)).toFixed(3)})` : undefined,
                }}
              >
                {w}
              </span>
            </React.Fragment>
          ))}
        </div>
      )}
      {/* the period rides a twin of the mark's box (same face / size) */}
      {pPeriod > 0 && periodOut < 1 ? (
        <div style={{ ...markBox(x, y, fontSize), color: C.paper }}>
          <span style={{ visibility: 'hidden' }}>{MARK_WORDS.join(' ')}</span>
          <span
            style={{
              position: 'absolute',
              left: '100%',
              top: `${((1 - EASE.out3(pPeriod)) * 0.16).toFixed(3)}em`,
              opacity: EASE.out3(pPeriod) * (1 - periodOut),
              filter: pPeriod < 1 ? `blur(${(3 * (1 - EASE.out3(pPeriod))).toFixed(2)}px)` : undefined,
              transform: `scale(${(1 - 0.5 * periodOut).toFixed(3)})`,
              transformOrigin: '0% 80%',
            }}
          >
            .
          </span>
        </div>
      ) : null}
    </>
  );
};
