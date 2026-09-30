/**
 * 15–19 s · RESULT — the booking flies into the calendar.
 *
 *   t 0      the call hands over "Wednesday at 15:00" (ember) at MARK; the
 *            night room knocks the call back (fast out-curve, t 0–20)
 *   t 0–12   LIFT: a 2-frame dip, then a soft spring (peak ≈ t11) up into
 *            CARD0, towards the lens and a touch to the side; the booked
 *            pill's wash grows into the card; the mark's two words travel
 *            onto their measured places in the card row, " at" folds out,
 *            and — registered — they cross-fade (t 9–13); BOOKED + dot rise
 *   t 8–13   the owner's calendar enters (right / bottom) and builds:
 *            hairlines, labels, bookings, WED, the dashed slot — which then
 *            beckons (t 11–15)
 *   t 12–15  the card winds up (CARD0 at t 15, minus the 16 px wind-up)
 *   t 15–30  FLY: a lob into the slot while the camera pushes into a real
 *            close-up (16:9 2.6×, 9:16 1.7× on screen); screen-space ghost
 *            train, tilt, shadow lifting then tightening
 *   t 30     LAND on the beat: squash/stretch (SPRING.land), ping, flash,
 *            two outline rings, the dashed slot knocked out, a soft ember
 *            shockwave through the sheet, the frame takes the hit
 *   t 36–50  hold, then the camera pulls back out as the calendar recomposes
 *            into its half; the hairline draws with a CornerDot bead
 *   t 45     "Asleep." lands; the owner lockup follows (t 48)
 *   t 60     "Booked." lands (ember)
 *   t 94–105 anticipation: the camera ticks back, the event swells (1.12),
 *            heats, gathers (0.97)
 *   t 100–117 the dive: the camera pushes ~3× into the event, the world
 *            streams out (radial smear), the event opens past the frame and
 *            blooms from its centre ember → soft ember → white; white from
 *            t 117 to the end (t 130)
 *
 * Parallax: room 0.15 · room light 0.4 · calendar / card 1.0 · motes 1.5
 * (world camera); owner 0.92 · divider 1.0 · words 1.05 on the titles plane,
 * which is locked to the frame (drift, half the breath, and the dive only).
 */
import React, { useMemo } from 'react';
import { AbsoluteFill, Easing } from 'remotion';
import { Vignette } from '../components/Grain';
import { useLayout } from '../lib/layout';
import { EASE, mixHex, tween } from '../lib/motion';
import { useSceneFrame } from '../lib/scene';
import { C, FONT, NIGHT_ROOM } from '../theme';
import { b, RESULT } from '../timing';
import { DATE_FONT } from './result/Card';
import { Calendar, eventLookAt } from './result/Calendar';
import { EventFace, hexA } from './result/Event';
import { Flyer } from './result/Flyer';
import { calToWorld, CAL, geo, layerCss, rectToWorld, worldToScreen, type Cam, type Geo } from './result/geometry';
import { cssFont, measure, useFontsReady, type FontSpec } from './result/measure';
import { calPoseAt, camAt, camTypeAt, diveAt, type MarkMetrics } from './result/motion';
import { Motes } from './result/Motes';
import { Divider, LetterRise, Owner } from './result/Split';

// LOCAL TIMING - hoist into timing.ts
export const RESULT_LOCAL = {
  /** the night room knocks the call back (out-curve) */
  roomIn: [RESULT.lift, b(4 / 3)] as const, // 0 → 20
  /** the lift spring starts here, after a 2-frame anticipation dip */
  liftGo: RESULT.lift + b(1 / 8), // 2
  /** the booked-pill wash blooms around the mark */
  plateIn: [RESULT.lift + b(1 / 15), RESULT.lift + b(0.3)] as const, // 1 → 5
  /** " at" folds out of the mark */
  markCollapse: [RESULT.lift + b(1 / 8), RESULT.lift + b(0.4)] as const, // 2 → 6
  /** the plate grows pill → card; the mark's words travel onto the card row */
  morph: [RESULT.lift + b(1 / 8), RESULT.lift + b(2 / 3)] as const, // 2 → 10
  /** BOOKED + the ember dot rise in */
  cardReveal: [RESULT.lift + b(0.4), RESULT.lift + b(0.8)] as const, // 6 → 12
  /** the registered words cross-fade: the mark (Inter) → the card row (Instrument Sans) */
  markOut: [RESULT.lift + b(0.6), RESULT.lift + b(5 / 6)] as const, // 9 → 13
  /** the card pulls back before the throw */
  windUp: [RESULT.fly - b(0.2), RESULT.fly] as const, // 12 → 15
  /** the sheet's entry spring (3-frame anticipation before it) */
  sheetIn: RESULT.calendarIn, // 8
  /** hairlines, labels, hours, bookings build (all in by t≈13–15) */
  build: [RESULT.calendarIn + b(1 / 15), RESULT.fly] as const, // 9 → 15
  /** WED highlight */
  wedIn: [RESULT.calendarIn + b(2 / 15), RESULT.calendarIn + b(0.4)] as const, // 10 → 14
  /** the dashed slot */
  slotIn: [RESULT.calendarIn + b(2 / 15), RESULT.calendarIn + b(1 / 3)] as const, // 10 → 13
  /** …which beckons before the throw */
  beckon: [RESULT.calendarIn + b(0.2), RESULT.fly] as const, // 11 → 15
  /** the camera pushes into the close-up with the throw */
  camIn: [RESULT.fly, RESULT.land + b(2 / 15)] as const, // 15 → 32
  /** the landing shockwave through the sheet */
  shock: [RESULT.land, RESULT.land + b(1.4)] as const, // 30 → 51
  /** the pill's ping on the event's dot */
  ping: [RESULT.land + b(0.2), RESULT.land + b(1.2)] as const, // 33 → 48
  /** the calendar recomposes into its half (its anticipation starts 3 f earlier, t 36) */
  recompose: RESULT.land + b(0.6), // 39
  recomposeAnticip: b(0.2), // 3
  /** the split hairline starts drawing */
  divider: RESULT.split - b(0.25), // 41
  /** the split's grade: the owner's half cools and darkens */
  splitGrade: [RESULT.split - b(0.4), RESULT.split + b(14 / 15)] as const, // 39 → 59
  /** the titles plane moves above the sheet (it sits under it while the sheet recomposes) */
  titlesOver: RESULT.split + b(1 / 3), // 50
  /** the owner lockup pops (after "Asleep." lands) */
  ownerIn: RESULT.split + b(0.2), // 48
  /** anticipation pulse on the event (peak) */
  pulse: RESULT.toWhite[0] - b(1 / 3), // 100
  /** the dive into the event */
  dive: [RESULT.toWhite[0] - b(1 / 3), RESULT.toWhite[1] - b(0.2)] as const, // 100 → 117
  /** the event's rect opens past the frame edges (camera does most of it; this is the last few ×) */
  open: [RESULT.toWhite[0], RESULT.toWhite[1] - b(4 / 15)] as const, // 105 → 116
  /** the event's fill blooms from its centre: ember → soft ember → white */
  bloom: [RESULT.toWhite[0] + b(2 / 15), RESULT.toWhite[1] - b(0.2)] as const, // 107 → 117
  /** the frame is entirely white from here */
  whiteFull: RESULT.toWhite[1] - b(0.2), // 117
};
export type ResultTiming = typeof RESULT_LOCAL;

/** the event's rect opens past the frame */
const OPEN = Easing.bezier(0.6, 0, 0.8, 0.3);

function markMetrics(G: Geo): MarkMetrics {
  const mf: FontSpec = { family: FONT.body, weight: 500, size: G.mark.fontSize, track: -0.01, lh: 1.22 };
  const a = (s: string) => measure(s, mf).w;
  const c = (s: string) => measure(s, DATE_FONT).w;
  return {
    m: {
      W: a('Wednesday at 15:00'),
      wed: a('Wednesday'),
      at: a('at'),
      atX: a('Wednesday '),
      num: a('15:00'),
      numX: a('Wednesday at '),
      capOff: measure('H', mf).capOff,
      box: mf.lh * mf.size,
    },
    c: { wed: c('Wednesday'), num: c('15:00'), numX: c('Wednesday '), capOff: measure('H', DATE_FONT).capOff },
  };
}

export const Result: React.FC = () => {
  const t = useSceneFrame('result');
  const L = useLayout();
  const G = useMemo(() => geo(L), [L.vertical]); // eslint-disable-line react-hooks/exhaustive-deps
  const wordFont: FontSpec = { family: FONT.ui, weight: 520, size: G.word, track: -0.03, lh: 1 };
  const markFont = `500 ${G.mark.fontSize}px ${FONT.body}`;
  const ready = useFontsReady([markFont, cssFont(DATE_FONT), cssFont(wordFont)]);
  const MM = useMemo(() => markMetrics(G), [G, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  const wordCap = useMemo(() => measure('H', wordFont).capOff, [G, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  if (t < 0) return null;
  const T = RESULT_LOCAL;

  const cam = camAt(t, G, L, T);
  const camT = camTypeAt(t, G, L, T);
  const pose = calPoseAt(t, G, T);
  const screenS = pose.s * cam.z;
  // screen-space velocity of the sheet's centre (camera included)
  const centreAt = (tt: number) => {
    const p = calPoseAt(tt, G, T);
    return worldToScreen(camAt(tt, G, L, T), L, { x: p.left + (G.W * p.s) / 2, y: p.top + (G.H * p.s) / 2 });
  };
  const va = centreAt(t - 0.5);
  const vb = centreAt(t + 0.5);
  const vel = { x: vb.x - va.x, y: vb.y - va.y };

  const roomOp = tween(t, T.roomIn, [0, 1], EASE.out3);
  const splitIn = tween(t, T.splitGrade, [0, 1], EASE.inOut);
  const landed = t >= RESULT.land;

  /* ── the white opening ─────────────────────────────────────────── */
  const opening = t >= RESULT.toWhite[0];
  const look = eventLookAt(t, T);
  const dive = diveAt(t, T);

  /* ── light ─────────────────────────────────────────────────────── */
  const evWorld = calToWorld(pose, G.slotC.x, G.slotC.y);
  const warm = landed ? tween(t, [RESULT.land, RESULT.land + 14], [0, 1], EASE.out3) : 0;

  const world = (c: Cam, key: string, op = 1) => (
    <AbsoluteFill key={key} style={{ transform: layerCss(c, 1), opacity: op }}>
      {warm > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: evWorld.x - L.pick(700, 640),
            top: evWorld.y - L.pick(560, 520),
            width: L.pick(1400, 1280),
            height: L.pick(1120, 1040),
            background: `radial-gradient(closest-side, ${hexA(C.ember, 0.17 * warm)}, ${hexA(C.ember, 0.06 * warm)} 55%, ${hexA(C.ember, 0)})`,
          }}
        />
      ) : null}
      <Calendar t={t} G={G} T={T} pose={pose} vel={vel} screenS={pose.s * c.z} eventOut={opening} vertical={L.vertical} />
      {key === 'world' ? <Flyer t={t} G={G} T={T} L={L} cam={c} MM={MM} /> : null}
    </AbsoluteFill>
  );

  const wf = (c: Cam) => (wordBlur > 0.3 ? `blur(${(wordBlur / c.z).toFixed(2)}px)` : undefined);
  const words = (c: Cam, key: string, op = 1) => (
    <AbsoluteFill key={key} style={{ transform: layerCss(c, 1.05), opacity: op }}>
      {t >= RESULT.split - 12 ? (
        <div style={{ position: 'absolute', left: G.asleep.x, top: G.asleep.capY - wordCap, transform: 'translateY(-50%)', filter: wf(c) }}>
          <LetterRise text="Asleep." t={t} land={RESULT.split} size={G.word} color={C.lilac} />
        </div>
      ) : null}
      {t >= RESULT.bookedWord - 12 ? (
        <>
          <div
            style={{
              position: 'absolute',
              left: G.booked.x - 120,
              top: G.booked.capY - 170,
              width: G.word * 4.6,
              height: 340,
              background: `radial-gradient(closest-side, ${hexA(C.ember, 0.16)}, ${hexA(C.ember, 0)})`,
              opacity: tween(t, [RESULT.bookedWord - 3, RESULT.bookedWord + 12], [0, 1], EASE.out3),
            }}
          />
          <div style={{ position: 'absolute', left: G.booked.x, top: G.booked.capY - wordCap, transform: 'translateY(-50%)', filter: wf(c) }}>
            <LetterRise text="Booked." t={t} land={RESULT.bookedWord} size={G.word} color={C.emberLit} />
          </div>
        </>
      ) : null}
    </AbsoluteFill>
  );

  // radial smear through the dive: the same planes a hair earlier on the dive, fainter,
  // plus a blur on the words scaled by how fast the dive is streaming them out
  const diving = t >= T.dive[0] && t < T.whiteFull && dive.k > 0.02;
  const smear = diving
    ? [
        { dt: 0.14, op: 0.22 },
        { dt: 0.28, op: 0.13 },
        { dt: 0.42, op: 0.07 },
      ]
    : [];
  // the world is heavy (the whole sheet): two copies; the sheet's own blur does the rest
  const smearWorld = smear.slice(0, 2);
  const zRate = diving ? diveAt(t + 0.5, T).f / diveAt(t - 0.5, T).f - 1 : 0;
  const wordBlur = Math.min(16, zRate * 700 * 0.09);

  const titles = (
    <>
      <AbsoluteFill style={{ transform: layerCss(camT, 1) }}>
        <Divider
          t={t}
          start={T.divider}
          vertical={G.divider.vertical}
          at={G.divider.at}
          from={G.divider.from}
          to={G.divider.to}
        />
      </AbsoluteFill>
      {smear.map((s, i) => words(camTypeAt(t - s.dt, G, L, T), `wsmear${i}`, s.op))}
      {words(camT, 'words')}
    </>
  );
  const titlesUnder = t < T.titlesOver;

  /* the event, opening up past the frame (screen space) */
  let openEl: React.ReactNode = null;
  if (opening && t < T.whiteFull) {
    const evW = rectToWorld(pose, G.slot);
    const ox = evW.x + evW.w / 2;
    const oy = evW.y + evW.h * 0.6;
    const a = worldToScreen(cam, L, { x: ox - (evW.w / 2) * look.sx, y: oy - evW.h * 0.6 * look.sy });
    const z = worldToScreen(cam, L, { x: ox + (evW.w / 2) * look.sx, y: oy + evW.h * 0.4 * look.sy });
    // the camera does most of the growing (DIVE_Z); the event opens the last few ×
    const oe = OPEN(Math.min(1, Math.max(0, (t - T.open[0]) / (T.open[1] - T.open[0]))));
    // the event's rect morphs into the frame's (+ margin): all four rounded corners arrive together
    const M = 60;
    const box = {
      x0: a.x + (-M - a.x) * oe,
      y0: a.y + (-M - a.y) * oe,
      x1: z.x + (L.width + M - z.x) * oe,
      y1: z.y + (L.height + M - z.y) * oe,
    };
    // bloom from the centre: white core → the booked pill's soft ember → ember → the event's heat
    const bloom = tween(t, T.bloom, [0, 1], EASE.in2);
    const core = -75 + 165 * bloom;
    const hair = 1 - tween(t, [T.whiteFull - 4, T.whiteFull], [0, 1], EASE.inOut);
    const faceOp = 1 - tween(t, [RESULT.toWhite[0], RESULT.toWhite[0] + 4], [0, 1], EASE.in2);
    openEl = (
      <div
        style={{
          position: 'absolute',
          left: box.x0,
          top: box.y0,
          width: box.x1 - box.x0,
          height: box.y1 - box.y0,
          borderRadius: CAL.slotRadius * screenS * (1 + 0.6 * oe),
          background: `radial-gradient(farthest-corner at 50% 55%, ${C.white} ${core.toFixed(1)}%, ${C.emberSoft} ${(core + 20).toFixed(1)}%, ${mixHex(C.ember, C.emberLit, 0.35)} ${(core + 46).toFixed(1)}%, ${look.fill} ${(core + 75).toFixed(1)}%)`,
          boxShadow: [
            `0 0 0 1px ${hexA(C.ember, 0.7 * hair)}`,
            `0 0 ${(28 + 50 * oe).toFixed(1)}px ${(4 * oe).toFixed(1)}px ${hexA(C.ember, (0.4 + 0.25 * look.glowPulse) * (1 - bloom))}`,
          ].join(', '),
        }}
      >
        <div style={{ position: 'absolute', inset: 0, transform: `scale(${Math.min(4, look.sy).toFixed(4)})` }}>
          <EventFace u={screenS} op={faceOp} size={G.face} color={C.white} />
        </div>
      </div>
    );
  }

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {/* ── 0.15 · the night room ───────────────────────────────────── */}
      <AbsoluteFill style={{ transform: layerCss(cam, 0.15), opacity: roomOp }}>
        <div
          style={{
            position: 'absolute',
            left: L.cx - (L.width * 1.6) / 2,
            top: L.cy - (L.height * 1.6) / 2,
            width: L.width * 1.6,
            height: L.height * 1.6,
            background: NIGHT_ROOM.replace('120% 100% at 50% 40%', '81% 67.5% at 50% 43.25%'),
          }}
        />
        <Vignette strength={0.55} color="8,6,28" />
      </AbsoluteFill>

      {/* ── 0.4 · room light: the call's violet, cooling out ───────── */}
      <AbsoluteFill style={{ transform: layerCss(cam, 0.4), opacity: roomOp }}>
        <div
          style={{
            position: 'absolute',
            left: L.cx - L.pick(1000, 900),
            top: L.pick(430, 700) - L.pick(760, 900),
            width: L.pick(2000, 1800),
            height: L.pick(1520, 1800),
            background: `radial-gradient(closest-side, rgba(124,58,237,${(0.1 * (1 - 0.5 * splitIn)).toFixed(3)}), rgba(124,58,237,0))`,
          }}
        />
      </AbsoluteFill>

      {/* ── screen · the split's grade: the owner's side cooler, darker ── */}
      {splitIn > 0 ? (
        <AbsoluteFill
          style={{
            opacity: splitIn,
            background: L.pick(
              'linear-gradient(90deg, rgba(8,6,28,0.5) 0%, rgba(8,6,28,0.34) 44%, rgba(8,6,28,0) 52%)',
              'linear-gradient(180deg, rgba(8,6,28,0.5) 0%, rgba(8,6,28,0.34) 44%, rgba(8,6,28,0) 52%)',
            ),
          }}
        />
      ) : null}

      {/* ── 0.92 · the owner (titles plane) ────────────────────────── */}
      <AbsoluteFill style={{ transform: layerCss(camT, 0.92) }}>
        <Owner t={t} x={G.owner.x} y={G.owner.rowY} start={T.ownerIn} night={G.night} />
      </AbsoluteFill>

      {/* ── 1.0 / 1.05 · the titles plane, UNDER the sheet while it recomposes:
             the calendar sweeps away and uncovers the rising word ─────── */}
      {titlesUnder ? titles : null}

      {/* ── 1.0 · the world: ember halo, calendar, card ─────────────── */}
      {smearWorld.map((s, i) => world(camAt(t - s.dt, G, L, T), `smear${i}`, s.op))}
      {world(cam, 'world')}

      {/* ── 1.0 / 1.05 · the titles plane on top once the sheet is home (nothing overlaps at the swap) ── */}
      {titlesUnder ? null : titles}

      {/* ── 1.5 · motes ──────────────────────────────────────────────── */}
      <AbsoluteFill style={{ opacity: roomOp * 0.9 }}>
        <Motes t={t + 810} cam={cam} depth={1.5} width={L.width} height={L.height} count={18} />
      </AbsoluteFill>

      {/* ── screen · the event opens up into the white act ─────────── */}
      {opening ? t >= T.whiteFull ? <AbsoluteFill style={{ background: C.white }} /> : openEl : null}
    </AbsoluteFill>
  );
};
