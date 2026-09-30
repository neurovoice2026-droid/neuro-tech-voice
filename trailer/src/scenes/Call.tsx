/**
 * 8–15 s · CALL — the site's #demo "3 a.m., booked" stage at film scale.
 *
 *   t −4…0   the night room fades in over the twist's phone screen (same
 *            room, same orb, same flow time: the cut is invisible)
 *   t 0      PICKUP on the downbeat: orb breath (1 → .965 → 1), volume
 *            spike, a ring; the zoomed room pulls back to the stage;
 *            status row swings in; "Picked up on the first ring." rises
 *   t 4…30   the orb glides up into the clock lockup "03 ◉ 12"; the figure
 *            pairs spring out from behind it (t 11); the level row draws
 *   t 17…29  Ava takes the line: it gathers, shrinks and dives into the orb
 *            (behind the figures, motion-blurred); the orb gulps it (ping,
 *            level blip) at t 29 and emits the phase dot from its crown;
 *            "PICKED UP ON THE FIRST RING" unfolds out of the dot (t 34)
 *   t 23…    live transcript, one line at a time (CALL.lines): typewriter
 *            with caret, AI-disclosure underline, slot chips, the pick
 *   t 45…    the stage's floor: rule, THE OWNER · Asleep. / the call log
 *   t 53…68  status + phase dim to .58: the transcript is the one read
 *   t 173    "You're booked for / Wednesday at 15:00." — the mark turns
 *            ember at CALL.bookedMark with a press-and-settle beat
 *   t 196…228 everything but the mark recedes (fade front-loaded, rack
 *            focus, scale .94); the period leaves before t 210, when the
 *            mark is handed to the result.
 *
 * Parallax: room light 0.3 · lockup 0.8 · level row 0.85 · status 0.9 ·
 * owner row 0.95 · transcript 1.0 · dust 1.3 · bokeh 1.6; the booked mark
 * sits in screen space.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { noise2D } from '@remotion/noise';
import { Dust } from '../components/Dust';
import { Vignette } from '../components/Grain';
import { flowTime } from '../components/Orb';
import { CALL_ORB_START, MARK, TRANSCRIPT } from '../lib/handoff';
import { useLayout } from '../lib/layout';
import { aos, EASE, SPRING, springAt, tween } from '../lib/motion';
import { useSceneFrame } from '../lib/scene';
import { NIGHT_ROOM } from '../theme';
import { b, CALL } from '../timing';
import { Bokeh } from './call/Bokeh';
import { Lockup } from './call/Lockup';
import { OwnerRow } from './call/Owner';
import { flightAt, PhaseLine, PickupLine, StatusRow } from './call/Status';
import { caretBlink, Chips, MarkRow, TypedLine } from './call/Transcript';
import { LINES, listenAt, ORB_FRAME0, orbVolumeByIndex, typeDur, volumeAt } from './call/voice';
import { Waveform } from './call/Waveform';

// LOCAL TIMING - hoist into timing.ts
const LIFT = b(1.25) + 2; // 21: the big line starts its dive
const DIVE = 8; // frames of the dive
const SWALLOW = LIFT + DIVE; // 29: the orb swallows it
export const CALL_LOCAL = {
  /** the night room fades in over the twist's (identical) phone screen */
  roomIn: [-4, 0] as const,
  /** the zoomed room (the phone screen) pulls back to the whole stage */
  roomOpen: [2, b(2.6)] as const,
  /** pickup breath (site): 1 → .965 power2.in 0.16 s, → 1 expo.out 0.9 s */
  inhale: [0, 5] as const,
  exhale: [5, 32] as const,
  /** the orb leaves the centre for the lockup (spring) */
  glide: 4,
  /** the figure pairs slide out from behind the orb (spring), on a 16th */
  unfold: b(0.75), // 11
  /** the status row swings in (sign), day label letters follow */
  statusIn: 0,
  /** the dotted level row draws out from the centre */
  waveIn: b(1),
  /** the big line gathers (4 f) then dives into the orb… */
  lift: LIFT,
  dive: DIVE,
  /** …which swallows it (gulp + ping + level blip)… */
  swallow: SWALLOW,
  /** …and emits the phase dot from its crown; the label unfolds 4 f later */
  emit: SWALLOW + 1, // 30 = b(2), the end of CALL.pickedUpText
  /** rings: the pickup, then every time Ava starts a line */
  rings: [0, CALL.lines[0].at, CALL.lines[2].at, CALL.lines[4].at] as const,
  /** the AI-disclosure underline draws once "an AI assistant" is typed */
  disclose: CALL.lines[0].at + Math.ceil('This is Ava, an AI assistant'.length / CALL.typeRate),
  /** the stage's floor (owner / call-log row) draws in */
  ownerIn: b(3), // 45
  /** status + phase label dim to .58 so the transcript is the single read */
  dim: [b(3.5), b(4.5)] as const, // 53 → 68
  /** camera drift settles to rest before the mark is handed over */
  camSettle: [b(10), b(13)] as const,
  /** the payoff beat: the mark presses (3 f) and springs back — exactly 1 again by markHide − 1 */
  payoff: CALL.bookedMark + 1, // 198
  /** once the mark starts turning ember, everything but the mark recedes */
  exit: [CALL.bookedMark - 1, b(15.2)] as const, // 196 → 228 (scale, rack focus)
  exitFade: [CALL.bookedMark - 1, b(15.2) - 2] as const, // 196 → 226 (opacity, front-loaded)
  /** the result scene draws the mark from here (global 450) */
  markHide: b(14), // 210
};

const ROW_A = "You're booked for";

/** the gulp: a damped kick on the orb's scale (overshoot + settle) */
const gulpKick = (tt: number) => {
  const u = tt - CALL_LOCAL.swallow;
  if (u < 0) return 0;
  return Math.exp(-u / 5) * Math.sin((Math.PI * u) / 5);
};
/** …and a level blip, so the orb's shader stirs as it swallows */
const gulpLevel = (tt: number) => {
  const u = tt - CALL_LOCAL.swallow;
  if (u < 0) return 0;
  return 0.16 * (1 - Math.exp(-u / 1.2)) * Math.exp(-u / 6);
};

/** frames a line's exit takes: 6, compressed when its hold is short (line 4) */
const exitDurOf = (i: number) =>
  Math.max(3, Math.min(6, Math.round(LINES[i + 1].at - (LINES[i].at + typeDur(LINES[i].text)) - 4)));

/* the twist's phone screen at the end of its dive (twist/geometry.ts:
 * phone 260×540, bezel 9 → screen 242×522, scaled S about the avatar) */
const TWIST_SCREEN = { w: 242, h: 522 };

export const Call: React.FC = () => {
  const t = useSceneFrame('call');
  const L = useLayout();
  if (t < CALL_LOCAL.roomIn[0]) return null;

  const T = TRANSCRIPT(L);
  const M = MARK(L);
  const O = CALL_ORB_START(L);
  const Y = {
    status: L.pick(170, 330),
    phase: L.pick(228, 392),
    lock: L.pick(430, 700),
    wave: L.pick(640, 950),
    chips: L.pick(T.y + 80, T.y + 140),
  };
  /* the stage's floor (owner / call log) */
  const FLOOR = L.pick(
    { x0: L.safe.x, x1: L.width - L.safe.x, ruleY: 944, rowY: 984, valueY: 984 },
    { x0: L.safe.x, x1: L.width - L.safe.x, ruleY: 1590, rowY: 1636, valueY: 1708 },
  );
  const F = L.pick(200, 170);
  const orbFinal = L.pick(250, 220);
  const gap = L.pick(34, 28);
  const live = t >= 0;

  /* ── camera: a slow handheld drift, zero at the pickup and at the hand-over ── */
  const env =
    tween(t, [0, 40], [0, 1], EASE.inOut) * (1 - tween(t, CALL_LOCAL.camSettle, [0, 1], EASE.inOut));
  const cam = {
    x: 18 * noise2D('call-cam-x', t * 0.009, 0.31) * env,
    y: 10 * noise2D('call-cam-y', 0.77, t * 0.009) * env,
  };
  const layer = (depth: number): React.CSSProperties => ({
    transform: `translate(${(-cam.x * depth).toFixed(2)}px, ${(-cam.y * depth).toFixed(2)}px)`,
  });

  /* ── exit: everything but the mark recedes ─────────────────────── *
   * the fade is front-loaded (out3) so by the hand-over (t 210) only the
   * mark is left to follow; the rack focus (blur) is quick too, the scale
   * pull-back eases over the whole window */
  const exOp = tween(t, CALL_LOCAL.exitFade, [0, 1], EASE.out3);
  const exBlur = tween(t, CALL_LOCAL.exit, [0, 1], EASE.out3);
  const exScale = tween(t, CALL_LOCAL.exit, [0, 1], EASE.inOut);
  const lean = tween(t, [CALL_LOCAL.exit[0] - 4, CALL_LOCAL.exit[0] + 4], [0, 1], EASE.inOut) * (1 - exScale);
  const recede = { opacity: 1 - exOp, blur: 10 * exBlur };
  const recedeScale = 1 + 0.006 * lean - 0.06 * exScale;
  const dimK = 1 - 0.42 * tween(t, CALL_LOCAL.dim, [0, 1], EASE.inOut);

  /* ── the voice ───────────────────────────────────────────────────── */
  const vol = volumeAt(t) + gulpLevel(t);
  const lvl = Math.max(0, (vol - 0.12) / 0.7);
  const flow = flowTime(Math.max(0, Math.round(t + ORB_FRAME0)), (fr) => orbVolumeByIndex(fr) + gulpLevel(fr - ORB_FRAME0));

  /* ── the orb: breath, glide into the lockup ─────────────────────── */
  const breath = (tt: number) =>
    tt < CALL_LOCAL.inhale[0]
      ? 1
      : tt < CALL_LOCAL.inhale[1]
        ? 1 - 0.035 * tween(tt, CALL_LOCAL.inhale, [0, 1], EASE.in2)
        : 0.965 + 0.035 * tween(tt, CALL_LOCAL.exhale, [0, 1], EASE.expo);
  const glideCfg = { stiffness: 110, damping: 17, mass: 1 };
  const glideAt = (tt: number) => Math.max(0, aos(tt, CALL_LOCAL.glide, { anticip: 0, depth: 0, config: glideCfg }));
  const orbY = (tt: number) => O.y + (Y.lock - O.y) * glideAt(tt);
  const orbDAt = (tt: number) => {
    const g = glideAt(tt);
    // the talk swell eases in after the pickup, so at t 0 the orb is exactly CALL_ORB_START
    const talk =
      1 +
      0.03 *
        Math.max(0, (volumeAt(tt) - 0.12) / 0.7) *
        (0.7 + 0.3 * Math.sin((tt / 48) * Math.PI * 2)) *
        tween(tt, [0, 6], [0, 1], EASE.house);
    return (O.d + (orbFinal - O.d) * g) * breath(tt) * (tt >= 0 ? talk : 1) * (1 + 0.05 * gulpKick(tt));
  };
  const orbD = orbDAt(t);
  const dress = tween(t, [0, 12], [0, 1], EASE.house);

  const unfoldAt = (tt: number) => aos(tt, CALL_LOCAL.unfold, { anticip: 3, depth: 0.06, config: SPRING.site });
  const unfold = unfoldAt(t);
  const unfoldSpeed = unfoldAt(t + 0.5) - unfoldAt(t - 0.5);

  /* ── the room: the phone screen pulls back into the whole stage ─── */
  const S = L.pick((L.width / TWIST_SCREEN.w) * 1.1, (L.width / TWIST_SCREEN.w) * 1.12);
  const open = tween(t, CALL_LOCAL.roomOpen, [0, 1], EASE.inOut);
  const box0 = { w: TWIST_SCREEN.w * S, h: TWIST_SCREEN.h * S };
  const box1 = { w: L.width * 1.08, h: L.height * 1.08 };
  const room = {
    w: box0.w * Math.pow(box1.w / box0.w, open),
    h: box0.h * Math.pow(box1.h / box0.h, open),
  };
  const roomOp = tween(t, CALL_LOCAL.roomIn, [0, 1], EASE.inOut);

  /* ── the big line's dive into the orb ─────────────────────────── */
  const flightOpts = {
    x0: L.cx,
    y0: T.y,
    y1: Y.lock,
    band: 0.62 * F,
    s1: L.pick(0.1, 0.12),
    lift: CALL_LOCAL.lift,
    dive: CALL_LOCAL.dive,
  };
  const flight = (tt: number) => flightAt(tt, flightOpts);

  /* ── transcript ─────────────────────────────────────────────────── */
  const last = LINES[4];
  const lastTyped = (t - last.at) * CALL.typeRate;
  const markStart = ROW_A.length + 1;
  const lastTypedAt = last.at + last.text.length / CALL.typeRate;
  const ember = tween(t, [CALL.bookedMark, CALL.bookedMark + 13], [0, 1], EASE.soft);
  const sheen = t < CALL.bookedMark ? -1 : tween(t, [CALL.bookedMark, CALL_LOCAL.markHide - 1], [0, 1], EASE.inOut);
  const glow =
    tween(t, [CALL.bookedMark, CALL.bookedMark + 5], [0, 1], EASE.out3) *
    (1 - tween(t, [CALL.bookedMark + 8, CALL_LOCAL.markHide + 4], [0, 1], EASE.inOut));
  // the payoff beat: press 1 → .975 (3 f, power2.in), spring back (pop) — exactly 1 before the hand-over
  const P = CALL_LOCAL.payoff;
  const pulse =
    t < P || t >= CALL_LOCAL.markHide - 1
      ? 1
      : t < P + 3
        ? 1 - 0.025 * tween(t, [P, P + 3], [0, 1], EASE.in2)
        : 0.975 + 0.025 * springAt(t, P + 3, SPRING.pop);
  const periodOut = tween(t, [CALL_LOCAL.markHide - 8, CALL_LOCAL.markHide], [0, 1], EASE.in2);
  const markCaret =
    lastTyped >= markStart
      ? caretBlink(t, lastTypedAt) * (1 - tween(t, [CALL.bookedMark - 3, CALL.bookedMark], [0, 1], EASE.in2))
      : 0;

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {/* ── 0.3 · the room (a slow push once the stage is open) ─────── */}
      <AbsoluteFill
        style={{
          ...layer(0.3),
          opacity: roomOp,
          transform: `${layer(0.3).transform} scale(${(1 + 0.035 * tween(t, [20, 220], [0, 1], EASE.inOut)).toFixed(5)})`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: L.cx - room.w / 2,
            top: L.cy - room.h / 2,
            width: room.w,
            height: room.h,
            background: NIGHT_ROOM,
          }}
        />
        {live ? (
          <div
            style={{
              position: 'absolute',
              left: L.cx - L.pick(1000, 900),
              top: orbY(t) - L.pick(760, 900),
              width: L.pick(2000, 1800),
              height: L.pick(1520, 1800),
              background: `radial-gradient(closest-side, rgba(124,58,237,${(0.1 + 0.2 * lvl).toFixed(3)}), rgba(124,58,237,0) 100%)`,
              opacity: dress,
            }}
          />
        ) : null}
        <Vignette strength={0.55 * open} color="8,6,28" />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          transform: `scale(${recedeScale.toFixed(5)})`,
          transformOrigin: `${M.x}px ${M.y}px`,
        }}
      >
        {/* ── 1.0 · the big line — it dives BEHIND the lockup, into the orb ── */}
        {live && t <= CALL_LOCAL.swallow ? (
          <AbsoluteFill style={layer(1)}>
            <PickupLine
              t={t}
              text="Picked up on the first ring."
              fontSize={L.pick(96, 92)}
              boxW={L.pick(1500, 940)}
              flight={flight}
            />
          </AbsoluteFill>
        ) : null}

        {/* ── 0.8 · the lockup ─────────────────────────────────────── */}
        <AbsoluteFill style={layer(0.8)}>
          <Lockup
            t={t}
            x={L.cx}
            y={orbY(t)}
            orbBase={O.d}
            orbScale={orbD / O.d}
            orbFinal={orbFinal}
            F={F}
            gap={gap}
            unfold={live ? unfold : 0}
            unfoldSpeed={unfoldSpeed}
            unfoldStart={CALL_LOCAL.unfold}
            gulp={CALL_LOCAL.swallow}
            volume={vol}
            flow={flow}
            listen={listenAt(t)}
            ringStarts={CALL_LOCAL.rings}
            orbDAt={orbDAt}
            opacity={recede.opacity}
            blur={recede.blur}
            dress={dress}
            sheens={[
              tween(t, [CALL_LOCAL.unfold + 6, CALL_LOCAL.unfold + 22], [0, 1], EASE.inOut),
              tween(t, [CALL_LOCAL.unfold + 10, CALL_LOCAL.unfold + 26], [0, 1], EASE.inOut),
            ]}
          />
        </AbsoluteFill>

        {live ? (
          <>
            {/* ── 0.85 · the level row ────────────────────────────── */}
            <AbsoluteFill style={layer(0.85)}>
              <Waveform
                t={t}
                cx={L.cx}
                cy={Y.wave}
                bars={L.pick(56, 40)}
                tail={L.pick(12, 6)}
                maxH={L.pick(60, 54)}
                drawIn={CALL_LOCAL.waveIn}
                opacity={recede.opacity}
                blur={recede.blur}
              />
            </AbsoluteFill>

            {/* ── 0.9 · status ──────────────────────────────────────── */}
            <AbsoluteFill style={layer(0.9)}>
              <StatusRow t={t} cx={L.cx} cy={Y.status} start={CALL_LOCAL.statusIn} recede={recede} dim={dimK} />
            </AbsoluteFill>

            {/* ── 0.95 · the stage's floor: the owner, the call log ─── */}
            <AbsoluteFill style={layer(0.95)}>
              <OwnerRow t={t} vertical={L.vertical} {...FLOOR} start={CALL_LOCAL.ownerIn} recede={recede} />
            </AbsoluteFill>

            {/* ── 1.0 · transcript, chips, the phase line ─────────── */}
            <AbsoluteFill style={layer(1)}>
              <PhaseLine
                t={t}
                cx={L.cx}
                cy={Y.phase}
                fromY={Y.lock - orbFinal / 2 + 4}
                emit={CALL_LOCAL.emit}
                recede={recede}
                dim={dimK}
              />
              {LINES.slice(0, 4).map((line, i) => (
                <TypedLine
                  key={i}
                  t={t}
                  who={line.who}
                  text={line.text}
                  at={line.at}
                  fontSize={T.fontSize}
                  maxWidth={T.maxWidth}
                  cx={L.cx}
                  cy={T.y}
                  exitAt={LINES[i + 1].at}
                  exitDur={exitDurOf(i)}
                  caret
                  disclose={i === 0 ? { phrase: 'an AI assistant', at: CALL_LOCAL.disclose } : undefined}
                />
              ))}
              <TypedLine
                t={t}
                who={last.who}
                text={ROW_A}
                at={last.at}
                fontSize={T.fontSize}
                maxWidth={T.maxWidth}
                cx={L.cx}
                cy={T.y}
                caret={lastTyped < markStart}
                recede={recede}
              />
              <Chips
                t={t}
                cx={L.cx}
                cy={Y.chips}
                pops={[LINES[2].at + CALL.slotPops[0], LINES[2].at + CALL.slotPops[1]]}
                pick={CALL.slotPick}
                leave={last.at}
              />
            </AbsoluteFill>

            {/* ── 1.3 · motes ─────────────────────────────────────────── */}
            <AbsoluteFill style={{ ...layer(1.3), opacity: dress * recede.opacity }}>
              <Dust count={14} seed="call-motes" color="185,163,255" opacity={0.4} size={[2, 6]} blur={[0.4, 3]} speed={0.3} frame={t + 600} />
            </AbsoluteFill>
            <AbsoluteFill style={{ ...layer(1.6), opacity: dress * recede.opacity }}>
              <Bokeh
                t={t}
                opacity={1}
                discs={L.pick(
                  [
                    { x: 150, y: 930, r: 170, a: 0.07, seed: 'b1' },
                    { x: 1800, y: 230, r: 120, a: 0.06, seed: 'b2' },
                    { x: 1850, y: 690, r: 90, a: 0.08, seed: 'b3' },
                  ],
                  [
                    { x: 30, y: 1450, r: 170, a: 0.07, seed: 'b1' },
                    { x: 1000, y: 430, r: 120, a: 0.06, seed: 'b2' },
                    { x: 1040, y: 1880, r: 90, a: 0.08, seed: 'b3' },
                  ],
                )}
              />
            </AbsoluteFill>
          </>
        ) : null}
      </AbsoluteFill>

      {/* ── screen space · the booked mark (handed to the result at markHide) ── */}
      {live ? (
        <AbsoluteFill style={layer(1)}>
          <MarkRow
            t={t}
            typedF={lastTyped - markStart}
            ember={ember}
            sheen={sheen}
            glow={glow}
            pulse={pulse}
            periodOut={Math.max(periodOut, exOp)}
            x={M.x}
            y={M.y}
            fontSize={M.fontSize}
            show={t < CALL_LOCAL.markHide}
            caret={markCaret}
          />
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
