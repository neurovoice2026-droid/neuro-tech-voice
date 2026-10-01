/**
 * The slot (knowledge-stage.tsx's peek, in both frames): the page the
 * reader is reading, and what becomes of an unanswered question.
 *
 *   peekOpen      (16:9) the dashed page opens (the site's page reveal: clip
 *                 from the top, a scan line of Sunday light on its edge); its
 *                 skeleton lines shimmer while every document is weighed;
 *                 its dashes march slowly (a page still open, waiting)
 *   slotOpenMiss  (9:16, where the slot shares the documents' place) it is
 *                 born on the miss instead: it steps forward out of the
 *                 receding list (.94 → 1, nearly opaque, a soft shadow)
 *   miss          the lines fold away (bottom up, 1.5 f apart) and
 *                 "0 matches" pops in, in the miss's grey (an inhale, an
 *                 overshoot, a grey ring), then shakes "no" after the pill;
 *                 on Ava's "answer" a soft grey ring leaves it again
 *   ticketPop     "I'll…": the slot inhales (2 f at .95), "0 matches" flicks
 *                 out, and the dashed page pops into a solid card for the
 *                 team (.95 → 1.08 → 1, settled in 10 f): its dashes give way
 *                 to a ring and a soft contact shadow, a glint of Sunday
 *                 light sweeps it, a ring leaves its edge, a pool of light
 *                 blooms behind it (+ a camera kick in Knowledge.tsx)
 *   ticketType    its lines write in on the spoken words: the caller's
 *                 question on "ask", the caller's number on "team"
 *   callback      "call": the callback chip pops in the after-closing green
 *                 (.5 → 1.12 → 1, a green bloom, a ring)
 *   check         "today.": its check draws, the disc pulses, a glint
 *                 crosses the chip
 *
 * No dashed placeholder is ever left empty on screen.
 */
import React from 'react';
import { bloom, mixColor, rgba } from '../../lib/lights';
import { aos, EASE, SPRING, tween } from '../../lib/motion';
import { C, FONT, TRACK } from '../../theme';
import { KNOWLEDGE, KNOWLEDGE_LOCAL } from '../../timing';
import { flashAt, lifeAt } from './blur';
import { CLOSING_GLOW, CLOSING_INK, DOT, FLAGGED, INK, SUN, SUN_GLOW, SUN_MISS, TICKET, type Geo } from './geometry';
import { CHIP_POP } from './Status';

const K = KNOWLEDGE;
const KL = KNOWLEDGE_LOCAL;
const GREY = DOT.missing; // #6b6878

/** the card pop: .95 at the hit → 1.08 (2–3 f later) → a small undershoot → 1 within ~10 f */
function cardScale(t: number): number {
  const a = KL.ticketPop;
  if (t < a - 2) return 1;
  if (t < a) return 1 - 0.05 * Math.sin(((t - (a - 2)) / 2) * (Math.PI / 2)); // the inhale
  const u = t - a;
  const w = (2 * Math.PI) / 10;
  return 1 + Math.exp(-u / 3.2) * (-0.05 * Math.cos(w * u) + 0.18 * Math.sin(w * u));
}

/** a damped "no" (px) over [a, b] */
function shake(t: number, [a, b]: readonly [number, number], amp: number) {
  if (t <= a || t >= b) return 0;
  const u = (t - a) / (b - a);
  return amp * Math.sin(u * Math.PI * 3) * Math.exp(-2.4 * u);
}

/** a ring leaving a rounded box: inset grows 4 → 4 + spread, alpha fades */
const BoxRing: React.FC<{ q: number; r: number; color: string; spread?: number; w?: number }> = ({ q, r, color, spread = 22, w = 1.5 }) => {
  const k = 4 + spread * q;
  return (
    <div
      style={{
        position: 'absolute',
        inset: -k,
        borderRadius: r + k,
        boxShadow: `inset 0 0 0 ${w}px ${color}`,
        pointerEvents: 'none',
      }}
    />
  );
};

/** characters that write in from `at`, `step` frames apart (each rises .2em out of a soft blur) */
const Typed: React.FC<{ t: number; text: string; at: number; step: number; style: React.CSSProperties }> = ({ t, text, at, step, style }) => (
  <div style={{ whiteSpace: 'pre', ...style }}>
    {text.split('').map((ch, i) => {
      const s = at + i * step;
      const u = Math.min(1, Math.max(0, (t - s + 1) / 5));
      const e = EASE.out3(u);
      return (
        <span
          key={i}
          style={{
            display: 'inline-block',
            opacity: e,
            transform: u < 1 ? `translateY(${(0.22 * (1 - e)).toFixed(3)}em)` : undefined,
            filter: u > 0 && u < 1 ? `blur(${(2.5 * (1 - e)).toFixed(2)}px)` : undefined,
          }}
        >
          {ch}
        </span>
      );
    })}
  </div>
);

export const Slot: React.FC<{ t: number; G: Geo }> = ({ t, G }) => {
  const S = G.slot;
  const v = G.v;
  // 'peek' (16:9): the page being read opens before the scan; 'miss' (9:16): the slot opens on the
  // miss, in front of the documents stepping back — no reading page, it is born as the miss
  const peek = G.slotMode === 'peek';
  const openAt = peek ? KL.peekOpen : KL.slotOpenMiss;
  if (t < openAt) return null;
  const R = v ? 22 : 24;

  /* ── the page opening (peek: a clip reveal with a scan line; miss: it steps forward out of the list) ── */
  const clip = peek ? tween(t, [openAt, openAt + 9], [100, 0], EASE.out3) : 0;
  const settle = peek
    ? aos(t, openAt, { anticip: 0, depth: 0, config: SPRING.site })
    : Math.min(1.02, aos(t, openAt, { anticip: 0, depth: 0, config: SPRING.site }));
  const boxO = peek ? 1 : Math.min(1, Math.max(0, (t - openAt + 1) / 5));

  /* ── the card ── */
  const pop = KL.ticketPop;
  const carded = t >= pop;
  const cq = tween(t, [pop, pop + 5], [0, 1], EASE.out3); // dashes → solid ring + shadow
  const sc = (peek ? 0.965 + 0.035 * settle : 0.94 + 0.06 * settle) * cardScale(t);
  const dx = shake(t, KL.zeroShake, v ? 6 : 7);

  /* ── the skeleton lines (reading), folding away on the miss ── */
  const nBars = peek ? (v ? 3 : 4) : 0;
  const padX = v ? 32 : 40;
  const inner = S.w - padX * 2;
  const barW = [0.34, 0.86, 0.64, 0.78].slice(0, nBars);
  const barY = (i: number) => (v ? 42 + i * 40 : 52 + i * 52);
  /* Ava's "answer": a soft grey ring leaves "0 matches" (her words point at the empty page) */
  const echoQ = tween(t, [KL.zeroEcho, KL.zeroEcho + 14], [0, 1], EASE.out3);
  const echoO = t > KL.zeroEcho && echoQ < 1 ? 0.4 * (1 - echoQ) : 0;
  const echoS = 1 + 0.05 * Math.exp(-Math.max(0, t - KL.zeroEcho) / 4) * (t >= KL.zeroEcho ? 1 : 0);

  /* ── "0 matches" ── */
  const z = KL.zeroPop;
  const zp = aos(t, z, { anticip: 2, depth: 0.06, config: CHIP_POP });
  const zOut = tween(t, [pop - 2, pop + 3], [0, 1], EASE.in2);
  const zScale = (0.6 + 0.4 * Math.max(0, zp)) * (1 - 0.06 * zOut);
  const zRingQ = tween(t, [z + 1, z + 13], [0, 1], EASE.out3);
  const zRingO = t > z && zRingQ < 1 ? 0.45 * (1 - zRingQ) : 0;
  const zSize = v ? 56 : 64;

  /* ── the card's accents ON the pop ── */
  const glintQ = tween(t, [pop, pop + 9], [0, 1], EASE.out3);
  const ringQ = tween(t, [pop + 1, pop + 14], [0, 1], EASE.out3);
  const ringO = t > pop && ringQ < 1 ? 0.6 * (1 - ringQ) : 0;
  const flash = flashAt(t, pop, 5);
  const lit = carded ? 0.55 * flash + 0.12 * cq : 0;

  /* ── the callback chip ── */
  const cb = KL.callback;
  const ck = KL.check;
  const chipP = aos(t, cb, { anticip: 2, depth: 0.1, config: CHIP_POP });
  const chipS = t < cb - 2 ? 0 : 0.5 + 0.5 * chipP;
  const chipO = Math.min(1, Math.max(0, (t - (cb - 2)) / 3));
  const chipFlash = flashAt(t, cb, 5) + 0.9 * flashAt(t, ck, 6);
  const chipRingQ = tween(t, [cb + 1, cb + 12], [0, 1], EASE.out3);
  const chipRingO = t > cb && chipRingQ < 1 ? 0.55 * (1 - chipRingQ) : 0;
  const checkQ = tween(t, [ck - 1, ck + 4], [0, 1], EASE.out3);
  const discPulse = t >= ck ? 1 + 0.28 * Math.exp(-(t - ck) / 3) * Math.cos(((t - ck) / 6) * Math.PI) : 1;
  const chipGlint = tween(t, [ck + 1, ck + 11], [0, 1], EASE.inOut);

  const label = v ? 28 : 30;
  const qSize = v ? 66 : 68;
  const numSize = v ? 28 : 30;
  const chipH = v ? 52 : 58;
  const chipText = v ? 28 : 30;
  const disc = v ? 30 : 34;

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      {/* the site's "flagged" mark: a hollow dot, told apart by shape as well as colour */}
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          boxShadow: `inset 0 0 0 2px ${FLAGGED}`,
          transform: `scale(${Math.max(0, aos(t, pop + 1, { anticip: 1, depth: 0.2, config: CHIP_POP })).toFixed(4)})`,
          flex: 'none',
        }}
      />
      <div
        style={{
          overflow: 'hidden',
          paddingTop: '0.1em',
          paddingBottom: '0.06em',
          fontFamily: FONT.body,
          fontWeight: 500,
          fontSize: label,
          lineHeight: 1.12,
          letterSpacing: TRACK.label,
          textTransform: 'uppercase',
          color: INK,
          whiteSpace: 'pre',
        }}
      >
        {TICKET.label
          .toUpperCase()
          .split('')
          .map((ch, i) => {
            const p = aos(t, pop + 1 + i * 0.6, { anticip: 2, depth: 0.08, config: SPRING.site });
            return (
              <span key={i} style={{ display: 'inline-block', transform: `translateY(${((1 - p) * 110).toFixed(2)}%)` }}>
                {ch}
              </span>
            );
          })}
      </div>
      {v ? (
        <Typed
          t={t}
          text={`· ${TICKET.number}`}
          at={KL.ticketType[1]}
          step={0.6}
          style={{ fontFamily: FONT.mono, fontSize: numSize, color: C.muted, letterSpacing: '0.02em', marginLeft: 2 }}
        />
      ) : null}
    </div>
  );

  const question = (
    <Typed
      t={t}
      text={`“${TICKET.question}”`}
      at={KL.ticketType[0]}
      step={0.7}
      style={{
        fontFamily: FONT.cinema,
        fontStyle: 'italic',
        fontWeight: 500,
        fontSize: qSize,
        lineHeight: 1.05,
        color: C.caller,
      }}
    />
  );

  const chip =
    t >= cb - 2 ? (
      <div style={{ position: 'relative', flex: 'none' }}>
        {chipFlash > 0.02 ? (
          <div
            style={{
              position: 'absolute',
              left: -90,
              right: -90,
              top: -70,
              bottom: -70,
              background: bloom(CLOSING_GLOW, 0.55 * Math.min(1, chipFlash), { core: 0.6, coreSize: 0.45 }),
              pointerEvents: 'none',
            }}
          />
        ) : null}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            height: chipH,
            padding: `0 ${v ? 22 : 24}px 0 ${(chipH - disc) / 2}px`,
            borderRadius: 9999,
            background: C.white,
            boxShadow: `0 0 0 1.5px ${rgba('#047857', 0.22 + 0.25 * Math.min(1, chipFlash))}, 0 10px 22px -14px ${rgba('#03281a', 0.45)}`,
            transform: `scale(${chipS.toFixed(4)})`,
            transformOrigin: '50% 50%',
            opacity: chipO,
            fontFamily: FONT.body,
            fontWeight: 500,
            fontSize: chipText,
            letterSpacing: '-0.005em',
            color: CLOSING_INK,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
        >
          {chipRingO > 0 ? <BoxRing q={chipRingQ} r={chipH / 2} color={rgba(CLOSING_GLOW.body, chipRingO)} spread={16} /> : null}
          <span
            style={{
              position: 'relative',
              width: disc,
              height: disc,
              borderRadius: '50%',
              background: `linear-gradient(135deg, #34d399 0%, #047857 100%)`,
              transform: `scale(${discPulse.toFixed(4)})`,
              flex: 'none',
              boxShadow: `0 0 ${(14 * Math.min(1, chipFlash)).toFixed(1)}px ${rgba(CLOSING_GLOW.body, 0.7 * Math.min(1, chipFlash))}`,
            }}
          >
            <svg width={disc} height={disc} viewBox="0 0 24 24" style={{ position: 'absolute', inset: 0 }}>
              <path
                d="M6.5 12.5l3.6 3.6 7.4-8"
                fill="none"
                stroke="#ffffff"
                strokeWidth={2.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={1}
                strokeDasharray="1 1"
                strokeDashoffset={(1 - checkQ).toFixed(4)}
              />
            </svg>
          </span>
          <span>{TICKET.chip}</span>
          {chipGlint > 0 && chipGlint < 1 ? (
            <span
              style={{
                position: 'absolute',
                top: -20,
                bottom: -20,
                width: 60,
                left: `${(-30 + chipGlint * 130).toFixed(2)}%`,
                transform: 'rotate(20deg)',
                background: `linear-gradient(90deg, ${rgba('#ffffff', 0)}, ${rgba('#ffffff', 0.85)}, ${rgba(CLOSING_GLOW.core, 0)})`,
                mixBlendMode: 'screen',
                pointerEvents: 'none',
              }}
            />
          ) : null}
        </div>
      </div>
    ) : null;

  // the dashes: a page being read (Sunday) → the miss (grey) → gone into the card's solid ring
  const missK = peek ? tween(t, [K.miss, K.miss + 8], [0, 1], EASE.out3) : 1;
  const dashCol = mixColor('#0e7490', '#8a8794', missK);
  const base = peek ? 0.55 : 0.9;
  const dashA = (0.34 - 0.06 * missK) * (1 - cq);

  return (
    <div
      style={{
        position: 'absolute',
        left: S.x,
        top: S.y,
        width: S.w,
        height: S.h,
        transform: `translateX(${dx.toFixed(2)}px) scale(${sc.toFixed(4)})`,
        transformOrigin: v ? '50% 50%' : '0% 50%',
        opacity: boxO,
      }}
    >
      {/* the pop's pool of Sunday light behind the card */}
      {lit > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: -S.w * 0.35,
            right: -S.w * 0.35,
            top: -S.h * 0.9,
            bottom: -S.h * 0.9,
            background: bloom(SUN_GLOW, lit, { core: 0.55, coreSize: 0.4 }),
            pointerEvents: 'none',
          }}
        />
      ) : null}
      {ringO > 0 ? <BoxRing q={ringQ} r={R} color={rgba(SUN.orb[2], ringO)} spread={18} w={2} /> : null}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: R,
          // (miss mode: it stands in front of the receding documents, so it is nearly opaque and lifts on a soft shadow)
          background: carded ? `rgba(255,255,255,${(base + (1 - base) * cq).toFixed(3)})` : `rgba(255,255,255,${base})`,
          boxShadow: carded
            ? `0 0 0 1px rgba(24,16,40,${(0.07 * cq).toFixed(3)}), 0 0 ${(30 * flash).toFixed(1)}px ${rgba(SUN_GLOW.body, 0.35 * flash)}, 0 ${(22 * cq).toFixed(1)}px ${(44 * cq).toFixed(1)}px -26px ${rgba(SUN.orb[0], 0.38 * cq)}`
            : peek
              ? undefined
              : `0 18px 40px -28px ${rgba(SUN_MISS[0], 0.3)}`,
          clipPath: `inset(0% 0% ${clip.toFixed(2)}% 0% round ${R}px)`,
          overflow: 'hidden',
        }}
      >
        {/* the dashed outline (an SVG rect: even dashes all round) */}
        {dashA > 0.005 ? (
          <svg width={S.w} height={S.h} style={{ position: 'absolute', inset: 0 }}>
            <rect
              x={1.5}
              y={1.5}
              width={S.w - 3}
              height={S.h - 3}
              rx={R - 1.5}
              fill="none"
              stroke={rgba(dashCol, dashA)}
              strokeWidth={2.5}
              strokeDasharray="10 9"
              strokeDashoffset={(-0.7 * (t - openAt)).toFixed(2)}
            />
          </svg>
        ) : null}
        {/* the reveal edge: a scan line of Sunday light running down as the page opens */}
        {clip > 0.5 ? (
          <div
            style={{
              position: 'absolute',
              left: 8,
              right: 8,
              top: `calc(${(100 - clip).toFixed(2)}% - 3px)`,
              height: 3,
              borderRadius: 2,
              background: `linear-gradient(90deg, ${rgba(SUN.orb[2], 0)}, ${rgba(SUN.orb[2], 0.9)} 30%, ${rgba(SUN.orb[3], 1)} 50%, ${rgba(SUN.orb[2], 0.9)} 70%, ${rgba(SUN.orb[2], 0)})`,
              boxShadow: `0 0 14px 2px ${rgba(SUN.orb[2], 0.45)}`,
              opacity: Math.min(1, clip / 30),
            }}
          />
        ) : null}
        {/* the skeleton lines — a glint sweeps each while reading; they fold away on the miss */}
        {barW.map((bw, i) => {
          const c0 = KL.peekCollapse[0] + (nBars - 1 - i) * 1.5;
          const q = tween(t, [c0, c0 + 4], [0, 1], EASE.in2);
          if (q >= 1) return null;
          const w = inner * bw;
          const reading = t >= K.scan[0] && t < K.miss + 2;
          const ph = (((t - K.scan[0] - i * 1.5) % 10) + 10) % 10;
          const band = 160;
          const gx = -band + EASE.inOut(ph / 10) * (w + band);
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: padX,
                top: barY(i),
                width: w,
                height: v ? 18 : 18,
                borderRadius: 9,
                overflow: 'hidden',
                background: `rgba(20,10,36,${i === 0 ? 0.08 : 0.055})`,
                transformOrigin: '0% 50%',
                transform: `scaleX(${(1 - q).toFixed(4)})`,
                opacity: 1 - 0.6 * q,
              }}
            >
              {reading ? (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: gx,
                    width: band,
                    background: `linear-gradient(90deg, ${rgba(SUN.orb[2], 0)}, ${rgba(SUN.orb[2], 0.34)}, ${rgba(SUN.orb[2], 0)})`,
                  }}
                />
              ) : null}
            </div>
          );
        })}
        {/* ON the pop: a glint of Sunday light sweeps the card */}
        {glintQ > 0 && glintQ < 1 ? (
          <div
            style={{
              position: 'absolute',
              top: -80,
              bottom: -80,
              width: v ? 140 : 120,
              left: -180 + glintQ * (S.w + 260),
              transform: 'rotate(20deg)',
              background: `linear-gradient(90deg, ${rgba(SUN_GLOW.core, 0)}, ${rgba(SUN_GLOW.core, 0.7 * (1 - 0.5 * glintQ))}, ${rgba('#ffffff', 0.9 * (1 - 0.5 * glintQ))} 50%, ${rgba(SUN_GLOW.core, 0.7 * (1 - 0.5 * glintQ))}, ${rgba(SUN_GLOW.core, 0)})`,
              pointerEvents: 'none',
            }}
          />
        ) : null}
      </div>

      {/* "0 matches": the miss, in its grey */}
      {t >= z - 2 && zOut < 1 ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              position: 'relative',
              fontFamily: FONT.body,
              fontWeight: 500,
              fontSize: zSize,
              letterSpacing: '-0.02em',
              lineHeight: 1,
              color: GREY,
              transform: `translateY(${(-60 * zOut).toFixed(2)}%) scale(${(zScale * echoS).toFixed(4)})`,
              opacity: Math.min(1, Math.max(0, (t - (z - 2)) / 3)) * (1 - zOut),
              filter: zOut > 0.02 ? `blur(${(6 * zOut).toFixed(2)}px)` : undefined,
              whiteSpace: 'nowrap',
            }}
          >
            {echoO > 0 ? (
              <div
                style={{
                  position: 'absolute',
                  left: -24 - 30 * echoQ,
                  right: -24 - 30 * echoQ,
                  top: -22 - 22 * echoQ,
                  bottom: -22 - 22 * echoQ,
                  borderRadius: 9999,
                  boxShadow: `inset 0 0 0 1.5px rgba(107,104,120,${echoO.toFixed(3)})`,
                }}
              />
            ) : null}
            {zRingO > 0 ? (
              <div
                style={{
                  position: 'absolute',
                  left: -18 - 40 * zRingQ,
                  right: -18 - 40 * zRingQ,
                  top: -16 - 28 * zRingQ,
                  bottom: -16 - 28 * zRingQ,
                  borderRadius: 9999,
                  boxShadow: `inset 0 0 0 1.5px rgba(107,104,120,${zRingO.toFixed(3)})`,
                }}
              />
            ) : null}
            <span style={{ fontFamily: FONT.mono, fontWeight: 500, letterSpacing: 0 }}>0</span> matches
          </div>
        </div>
      ) : null}

      {/* the card's content */}
      {carded ? (
        v ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              padding: '0 28px 0 32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 20,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              {header}
              {question}
            </div>
            {chip}
          </div>
        ) : (
          <div style={{ position: 'absolute', inset: 0, padding: '28px 32px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {header}
              <Typed
                t={t}
                text={TICKET.number}
                at={KL.ticketType[1]}
                step={0.6}
                style={{ fontFamily: FONT.mono, fontSize: numSize, color: C.muted, letterSpacing: '0.02em' }}
              />
            </div>
            <div style={{ marginTop: 16 }}>{question}</div>
            <div style={{ position: 'absolute', left: 32, bottom: 28 }}>{chip}</div>
          </div>
        )
      ) : null}
      {/* the pop's speed reads as a brief shimmer of the whole card (life 0 → 1 → 0) */}
      {carded && lifeAt(t, pop, pop + 6) > 0.05 ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: R,
            boxShadow: `0 0 0 ${(2 * lifeAt(t, pop, pop + 6)).toFixed(2)}px ${rgba(SUN.orb[3], 0.8 * lifeAt(t, pop, pop + 6))}`,
            pointerEvents: 'none',
          }}
        />
      ) : null}
    </div>
  );
};
