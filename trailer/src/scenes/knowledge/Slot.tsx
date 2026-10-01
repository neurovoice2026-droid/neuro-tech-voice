/**
 * The slot (knowledge-stage.tsx's peek, in both frames): the page the
 * reader is reading, and what becomes of an unanswered question. A paper
 * card (theme.ts elevation) in the scene's one type system.
 *
 *   peekOpen      (16:9) the page opens (a clip from the top, on the house
 *                 ease): four lines of text, quiet hairlines of ink
 *   scan          the reader reads it: a sunday-ink highlight runs along each
 *                 line in turn, as a reader's marker would
 *   slotOpenMiss  (9:16, where the slot shares the documents' place) it is
 *                 born on the miss instead: it steps forward out of the
 *                 receding list (.96 → 1)
 *   miss          the lines fold away (bottom up, 1.5 f apart) and
 *                 "0 matches" rises into the page in the miss's grey, then the
 *                 card shakes "no" after the pill; on Ava's "answer" the words
 *                 give a small nod (1 → 1.03 → 1)
 *   ticketPop     "I'll…": "0 matches" leaves up through its mask and the page
 *                 becomes the card for the team — it lifts (its shadow deepens)
 *                 and settles on a soft spring
 *   ticketType    its lines rise in on the spoken words: the caller's
 *                 question on "ask", the caller's number on "team"
 *   callback      "call": the callback chip opens (the after-closing green is
 *                 a confirmation: the check only)
 *   check         "today.": its check draws
 *
 * No glints, no rings, no blooms: the card is an object, the light is the orb's.
 */
import React from 'react';
import { Reveal, reveal, revealStyle, subpixel } from '../../components/Type';
import { mixColor, rgba } from '../../lib/lights';
import { EASE, smooth, SPRING, springUnit, tween } from '../../lib/motion';
import { maskBox, typeStyle } from '../../lib/type';
import { C, elevation, FONT, R as RADII, TRACK, VOICE_INK } from '../../theme';
import { KNOWLEDGE, KNOWLEDGE_LOCAL } from '../../timing';
import { CLOSING_INK, DOT, FLAGGED, INK, TICKET, type Geo } from './geometry';
import { CHIP_POP } from './Status';

const K = KNOWLEDGE;
const KL = KNOWLEDGE_LOCAL;
const GREY = DOT.missing; // #6b6878
const CALLER_INK = VOICE_INK.caller.paper.text;

/** ζ ≈ .78: the card settles with a ~2 % overshoot */
const CARD = { stiffness: 260, damping: 25, mass: 1 };

/** the card's pop on "I'll": a 2 f inhale to .985, then a soft spring through ~1.02 to 1 */
function cardScale(t: number): number {
  const a = KL.ticketPop;
  if (t < a - 2) return 1;
  if (t < a) return 1 - 0.015 * Math.sin(((t - (a - 2)) / 2) * (Math.PI / 2));
  return 0.985 + 0.015 * springUnit(t - a, { stiffness: 300, damping: 15, mass: 1 });
}

/** a damped "no" (px) over [a, b] */
function shake(t: number, [a, b]: readonly [number, number], amp: number) {
  if (t <= a || t >= b) return 0;
  const u = (t - a) / (b - a);
  return amp * Math.sin(u * Math.PI * 3) * Math.exp(-2.4 * u);
}

/** words that rise out of their masks from `at`, `step` frames apart */
const RiseWords: React.FC<{ t: number; text: string; at: number; step: number; style?: React.CSSProperties }> = ({ t, text, at, step, style }) => {
  const ws = text.split(' ');
  return (
    <div style={{ whiteSpace: 'nowrap', ...style }}>
      {ws.map((w, i) => {
        const r = reveal(t, at + i * step, { config: SPRING.caption, rise: 90, fade: 0.5 });
        return (
          <span key={i} style={maskBox(i < ws.length - 1 ? 0.24 : 0)}>
            <span style={revealStyle(r)}>{w}</span>
          </span>
        );
      })}
    </div>
  );
};

export const Slot: React.FC<{ t: number; G: Geo }> = ({ t, G }) => {
  const S = G.slot;
  const v = G.v;
  // 'peek' (16:9): the page being read opens before the scan; 'miss' (9:16): the slot opens on the
  // miss, in front of the documents stepping back — no reading page, it is born as the miss
  const peek = G.slotMode === 'peek';
  const openAt = peek ? KL.peekOpen : KL.slotOpenMiss;
  if (t < openAt - 1) return null;
  const R = v ? RADII.xl : RADII.x2;

  /* ── the page opening (peek: a clip reveal from the top; miss: it steps forward out of the list) ── */
  const clip = peek ? tween(t, [openAt, openAt + 10], [100, 0], EASE.house) : 0;
  const settle = springUnit(t - (openAt - 1), SPRING.site);
  const boxO = peek ? (t >= openAt ? 1 : 0) : smooth(0, 0.5, settle);

  /* ── the card ── */
  const pop = KL.ticketPop;
  const carded = t >= pop;
  const cq = springUnit(t - pop, CARD); // the lift into a card
  const sc = (peek ? 1 : 0.96 + 0.04 * Math.min(1, settle)) * cardScale(t);
  const dx = shake(t, KL.zeroShake, 5);
  const lift = 0.7 + 0.8 * Math.min(1.05, cq); // a page on the stage → a card held up for the team

  /* ── the page's lines (reading), folding away on the miss ── */
  const nLines = peek ? 4 : 0;
  const padX = v ? 32 : 40;
  const inner = S.w - padX * 2;
  const lineW = [0.42, 0.88, 0.7, 0.8].slice(0, nLines);
  const lineY = (i: number) => (v ? 46 + i * 36 : 60 + i * 48);
  // the reader's marker runs along line i over its window (they share the scan, one after another)
  const [s0, s1] = [K.scan[0] + 2, K.miss - 2];
  const per = (s1 - s0) / Math.max(1, nLines);

  /* ── "0 matches" ── */
  const z = KL.zeroPop;
  const zr = reveal(t, z, { config: SPRING.text, rise: 100, fade: 0.55, exit: { at: pop - 3, dur: 5 } });
  const nod = 0.03 * Math.sin(Math.min(1, Math.max(0, (t - KL.zeroEcho) / 12)) * Math.PI);
  const zStyle = typeStyle('title', v, { tone: 'paper', tabular: true });

  /* ── the callback chip ── */
  const cb = KL.callback;
  const ck = KL.check;
  const chipP = springUnit(t - (cb - 1), CHIP_POP);
  const chipS = 0.86 + 0.14 * chipP;
  const chipO = smooth(0, 0.45, chipP);
  const checkQ = tween(t, [ck - 1, ck + 6], [0, 1], EASE.out3);
  const discK = t >= ck ? 1 + 0.08 * Math.sin(Math.min(1, (t - ck) / 10) * Math.PI) : 1;

  const label = v ? 28 : 30;
  /** the caller's number: figures, not a label — sentence-set, tabular, a hair open */
  const numberStyle: React.CSSProperties = {
    fontFamily: FONT.ui,
    fontWeight: 460,
    fontSize: label,
    letterSpacing: '0.01em',
    fontVariantNumeric: 'tabular-nums',
    textTransform: 'none',
  };
  const chipH = v ? 52 : 58;
  const chipText = v ? 28 : 30;
  const disc = v ? 30 : 34;

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, ...typeStyle('label', v, { tone: 'paper', size: label, tabular: true }), whiteSpace: 'nowrap' }}>
      {/* the site's "flagged" mark: a hollow dot, told apart by shape as well as colour */}
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: '50%',
          boxShadow: `inset 0 0 0 2px ${FLAGGED}`,
          transform: `scale(${Math.max(0, Math.min(1.03, springUnit(t - pop, CHIP_POP))).toFixed(4)})`,
          flex: 'none',
        }}
      />
      <Reveal t={t} start={pop + 1} config={SPRING.text} rise={100} style={{ color: INK }}>
        {TICKET.label}
      </Reveal>
      {v ? (
        <Reveal t={t} start={KL.ticketType[1]} config={SPRING.caption} rise={90} style={{ ...numberStyle, color: C.muted }}>
          · {TICKET.number}
        </Reveal>
      ) : null}
    </div>
  );

  const question = (
    <RiseWords
      t={t}
      text={`“${TICKET.question}”`}
      at={KL.ticketType[0]}
      step={2}
      style={{ ...typeStyle('title', v, { tone: 'paper' }), color: CALLER_INK }}
    />
  );

  const chip =
    t >= cb - 2 ? (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 12,
          height: chipH,
          padding: `0 ${v ? 22 : 24}px 0 ${(chipH - disc) / 2}px`,
          borderRadius: 9999,
          background: C.white,
          boxShadow: `0 0 0 1.5px ${rgba('#047857', 0.22)}, ${elevation(0.4, 0.8)}`,
          ...subpixel(chipS !== 1 ? `scale(${chipS.toFixed(5)})` : undefined, Math.abs(1 - chipP) > 2e-4),
          transformOrigin: '50% 50%',
          opacity: chipO,
          fontFamily: FONT.ui,
          fontWeight: 480,
          fontSize: chipText,
          letterSpacing: TRACK.h3,
          color: CLOSING_INK,
          whiteSpace: 'nowrap',
          flex: 'none',
        }}
      >
        <span
          style={{
            position: 'relative',
            width: disc,
            height: disc,
            borderRadius: '50%',
            background: mixColor('#0e9f6e', '#047857', 0.5),
            transform: discK !== 1 ? `scale(${discK.toFixed(4)})` : undefined,
            flex: 'none',
          }}
        >
          <svg width={disc} height={disc} viewBox="0 0 24 24" style={{ position: 'absolute', inset: 0 }}>
            <path
              d="M6.8 12.4l3.4 3.4 7-7.6"
              fill="none"
              stroke="#ffffff"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              strokeDasharray="1 1"
              strokeDashoffset={(1 - checkQ).toFixed(4)}
            />
          </svg>
        </span>
        <span>{TICKET.chip}</span>
      </div>
    ) : null;

  const moving = Math.abs(dx) > 0.01 || Math.abs(sc - 1) > 1e-4;
  return (
    <div
      style={{
        position: 'absolute',
        left: S.x,
        top: S.y,
        width: S.w,
        height: S.h,
        ...subpixel(moving ? `translateX(${dx.toFixed(3)}px) scale(${sc.toFixed(5)})` : undefined, moving),
        transformOrigin: v ? '50% 50%' : '0% 50%',
        opacity: boxO,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: R,
          background: C.white,
          boxShadow: elevation(lift, 1),
          // (the page opens from the top; the clip reaches past the sides and the foot so its shadow is never cut)
          clipPath: clip > 0.01 ? `inset(-3px -40% ${(clip * 1.4 - 40).toFixed(3)}% -40%)` : undefined,
          overflow: 'hidden',
        }}
      >
        {/* the page's lines — the reader's marker runs along each in turn; they fold away on the miss */}
        {lineW.map((lw, i) => {
          const c0 = KL.peekCollapse[0] + (nLines - 1 - i) * 1.5;
          const q = tween(t, [c0, c0 + 5], [0, 1], EASE.in3);
          if (q >= 1) return null;
          const w = inner * lw;
          const m0 = s0 + i * per;
          const mark = tween(t, [m0, m0 + per * 1.1], [0, 1], EASE.inOut);
          const markO = 1 - tween(t, [K.miss - 2, K.miss + 4], [0, 1], EASE.inOut);
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: padX,
                top: lineY(i),
                width: w,
                height: 12,
                borderRadius: 6,
                overflow: 'hidden',
                background: `rgba(20,10,36,${i === 0 ? 0.09 : 0.06})`,
                transformOrigin: '0% 50%',
                transform: q > 0 ? `scaleX(${(1 - q).toFixed(4)})` : undefined,
              }}
            >
              {mark > 0 && markO > 0 ? (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: '100%',
                    background: rgba(INK, 0.34 * markO),
                    transformOrigin: '0% 50%',
                    transform: `scaleX(${mark.toFixed(4)})`,
                  }}
                />
              ) : null}
            </div>
          );
        })}

        {/* "0 matches": the miss, in its grey */}
        {t >= z - 1 && zr.opacity > 0.001 ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              ...zStyle,
              fontWeight: 460,
              color: GREY,
            }}
          >
            <span style={maskBox(0)}>
              <span style={revealStyle(zr)}>
                <span style={{ display: 'inline-block', ...subpixel(nod > 0.0005 ? `scale(${(1 + nod).toFixed(5)})` : undefined, nod > 0.0005) }}>
                  0 matches
                </span>
              </span>
            </span>
          </div>
        ) : null}

        {/* the card's content */}
        {carded ? (
          v ? (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                padding: '0 26px 0 32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 18,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
                {header}
                {question}
              </div>
              {chip}
            </div>
          ) : (
            <div style={{ position: 'absolute', inset: 0, padding: '30px 32px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {header}
                <Reveal t={t} start={KL.ticketType[1]} config={SPRING.caption} rise={90} style={{ ...numberStyle, color: C.muted }}>
                  {TICKET.number}
                </Reveal>
              </div>
              <div style={{ marginTop: 18 }}>{question}</div>
              <div style={{ position: 'absolute', left: 32, bottom: 30 }}>{chip}</div>
            </div>
          )
        ) : null}
      </div>
    </div>
  );
};
