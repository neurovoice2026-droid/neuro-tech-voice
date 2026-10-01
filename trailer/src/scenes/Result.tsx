/**
 * RESULT (8 beats) — the booking flies into the calendar; the diptych.
 *
 *   t 0      the call hands over "Wednesday at 3 PM" (ember) at MARK with its
 *            <MarkGlow> at MARK_GLOW_HANDOFF; the glow cross-fades into the
 *            card's plate (t 1–5); the night room knocks the call back (t 0–20)
 *   t 0–12   LIFT: a 2-frame dip, then a soft spring up into the card (760/720
 *            × 200), towards the lens and a touch to the side; the pill's wash
 *            grows into the card; the mark's two words travel onto their
 *            measured places in the card row ("Wednesday · 3 PM"), " at"
 *            folds out and its "·" folds in, and —
 *            registered — they cross-fade (t 9–13); BOOKED + dot rise in
 *   t 8–13   the owner's calendar enters and builds; the dashed slot beckons
 *   t 12–15  the card winds up
 *   t 15–30  FLY: a lob into the slot while the camera pushes into a close-up;
 *            screen-space ghost train; the card warms to solid ember
 *   t 30     LAND on the beat: squash/stretch, ping, flash, two rings, the
 *            dashed slot knocked out, a shockwave through the sheet, a jolt
 *   t 36–51  the camera leans in (3 f), then peels back out over 6 f while the
 *            sheet crops into its card window (TUE–THU × 12–18 / 13–17),
 *            overshoots 2.5 % and settles; a zoom smear on the fast frames
 *   t 41–49  the seam draws (lilac → ember) and the night falls in behind it;
 *            the Booked half grades into its own night-violet ground (#1f1860 →
 *            #110c38, the night light behind the card). Ember is the event, its
 *            ≤ 118 px bloom and the word's glow only — never a wash on a half
 *   t 45     "Asleep." locks (left / top): the night half kicks 1.2 %
 *   t 49     the moon locks; stars twinkle in on 16ths / 8ths (53 56 68 71)
 *   t 60     "Booked." locks (right / bottom): the Booked half kicks 1.2 %
 *   t 64     the confirmation check pops on the event (the closing light's green)
 *   t 45–90  the hold: halves drift apart ±10 px, the Booked half pushes in
 *            1 → 1.035, the night dims 10 %, the moon breathes on the bar, the
 *            event's glow on half notes, stars on 8ths; ONE sweep across the
 *            event on the downbeat (t 75); motes + two disc planes
 *   t 90–100 everything has settled; the pulse's anticipation (in-out)
 *   t 100–120 the dive into the event, accelerating into the cut; "• 3:00 PM"
 *            rides it, scaling with the chip (a zoom smear once it is fast);
 *            from t 111 an amber core (#ffb877) lights inside the chip, a
 *            white-hot core follows and both bleed past its edge (screen
 *            bloom; the edge runs hot and goes soft), so the chip dissolves
 *            into light; the type burns out t 117–119.5; white peaks ON t 120
 *            = the cut (the knowledge's hit-white, on the beat), where the
 *            knowledge's white stock takes over (#ffffff here from t 120 on)
 *
 * Parallax: room 0.15 · night sky 0.15 · stars 0.4 · room light 0.4 · far
 * discs 0.5 · moon 0.6 · calendar / card 1.0 · words 1.05 · motes 1.4–1.5 ·
 * near discs 1.6. Each half has its own camera (drift, kick, push) on top of
 * the world camera; the seam and both halves share the dive.
 */
import React, { useMemo } from 'react';
import { AbsoluteFill, Easing } from 'remotion';
import { Vignette } from '../components/Grain';
import { BOOKING, MarkGlow } from '../components/Shared';
import { MARK_GLOW_HANDOFF } from '../lib/handoff';
import { useLayout } from '../lib/layout';
import { EASE, mixHex, tween } from '../lib/motion';
import { useSceneFrame } from '../lib/scene';
import { C, FONT, NIGHT_ROOM } from '../theme';
import { BEAT, RESULT, RESULT_LOCAL, SCENES } from '../timing';
import { Calendar, eventLookAt } from './result/Calendar';
import { EVENT_FONT, EventFace, fitFace, hexA } from './result/Event';
import { Flyer } from './result/Flyer';
import { CAL, geo, layerCss, mapRect, planeToScreen, SLOT, worldToScreen, type Cam, type Geo } from './result/geometry';
import { cssFont, measure, useFontsReady, type FontSpec } from './result/measure';
import { calMapAt, camsAt, cardAt, eventWorldAt, type MarkMetrics } from './result/motion';
import { Discs, Motes } from './result/Motes';
import { BookedGround, Divider, LetterRise, Moon, NightGrade, Stars } from './result/Split';
import { MIDNIGHT_ROOM, MidnightVignette } from './call/Light';
import { SignOff } from './result/SignOff';

export type ResultTiming = typeof RESULT_LOCAL;

/** the event's rect opens past the frame */
const OPEN = Easing.bezier(0.6, 0, 0.8, 0.3);
/** a bar's downbeat on the film's grid (bars of 4 beats from global frame 0), in result-local frames —
 *  derived, since the result's start moves with the voices */
const BAR = 4 * BEAT;
const DOWNBEAT = (BAR - (SCENES.result.from % BAR)) % BAR;

function markMetrics(G: Geo): MarkMetrics {
  const mf: FontSpec = { family: FONT.body, weight: 500, size: G.mark.fontSize, track: -0.01, lh: 1.22 };
  const D = G.cardType.date;
  const B = BOOKING;
  const a = (s: string) => measure(s, mf).w;
  const c = (s: string) => measure(s, D).w;
  // the row's "·" has sepAir em of extra air either side (CardFace)
  const airM = G.cardType.sepAir * mf.size;
  const airC = G.cardType.sepAir * D.size;
  return {
    m: {
      W: a(B.mark),
      wed: a(B.day),
      num: a(B.time),
      numX: a(`${B.day} ${B.at} `),
      // the card's row, set in the mark's own face: what the mark closes up into as " at" folds out
      row: {
        W: a(B.date) + 2 * airM,
        sep: a(B.sep),
        sepX: a(`${B.day} `) + airM,
        numX: a(`${B.day} ${B.sep} `) + 2 * airM,
      },
      capOff: measure('H', mf).capOff,
      box: mf.lh * mf.size,
    },
    c: {
      wed: c(B.day),
      sep: c(B.sep),
      sepX: c(`${B.day} `) + airC,
      num: c(B.time),
      numX: c(`${B.day} ${B.sep} `) + 2 * airC,
      capOff: measure('H', D).capOff,
    },
  };
}

/** The event face's sizes, fitted to the event's width ("• 3:00 PM", measured): the whole sheet's slot
 *  cell (calendar units) and the card window's cell (its event is inset CAL.inset). */
const fitFaces = (G: Geo): Geo => ({
  ...G,
  face: fitFace(G.face, G.slot.w),
  crop: { ...G.crop, face: fitFace(G.crop.face, G.crop.colPx - 2 * CAL.inset) },
});

export const Result: React.FC = () => {
  const t = useSceneFrame('result');
  const L = useLayout();
  const G0 = useMemo(() => geo(L), [L.vertical]); // eslint-disable-line react-hooks/exhaustive-deps
  const wordFont: FontSpec = { family: FONT.ui, weight: 520, size: G0.word, track: -0.03, lh: 1 };
  const markFont = `500 ${G0.mark.fontSize}px ${FONT.body}`;
  const ready = useFontsReady([markFont, cssFont(G0.cardType.date), cssFont(wordFont), cssFont(EVENT_FONT(G0.crop.face))]);
  const G = useMemo(() => fitFaces(G0), [G0, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  const MM = useMemo(() => markMetrics(G), [G]);
  const wordBase = useMemo(() => measure('Asleep.', wordFont).base, [G, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  // (before the cut only Ava's sign-off caption, over the call's last frames: an L-cut)
  if (t < 0) return <SignOff t={t} />;
  const T = RESULT_LOCAL;
  // OUT: the white act — exactly #ffffff from whiteFull to the last mounted frame (no vignette, motes, tint)
  if (t >= T.whiteFull) return <AbsoluteFill style={{ background: C.white }} />;

  const cams = camsAt(t, G, L, T);
  const map = calMapAt(t, G, T);

  // the event on screen (the focal point): its velocity drives the sheet's blur and the smear
  const evScr = (tt: number) => worldToScreen(camsAt(tt, G, L, T).world, L, eventWorldAt(tt, G, T));
  const e0 = evScr(t - 0.5);
  const e1 = evScr(t + 0.5);
  const vel = { x: e1.x - e0.x, y: e1.y - e0.y };
  const scaleScr = (tt: number) => calMapAt(tt, G, T).by * camsAt(tt, G, L, T).world.z;
  const zRateRec = Math.abs(Math.log(scaleScr(t + 0.5) / scaleScr(t - 0.5)));

  const roomOp = tween(t, T.roomIn, [0, 1], EASE.out3);
  /** the call's midnight → the result's night room (hidden behind the sheet's close-up) */
  const roomWarm = tween(t, T.roomWarm, [0, 1], EASE.inOut);
  const roomBox: React.CSSProperties = {
    position: 'absolute',
    left: L.cx - (L.width * 1.6) / 2,
    top: L.cy - (L.height * 1.6) / 2,
    width: L.width * 1.6,
    height: L.height * 1.6,
  };
  const splitIn = tween(t, T.splitGrade, [0, 1], EASE.inOut);
  const opening = t >= RESULT.toWhite[0];
  const look = eventLookAt(t, T);

  /* ── the seam, on screen ──────────────────────────────────────── */
  const sbs = G.sideBySide;
  const seamScr = sbs ? worldToScreen(cams.seam, L, { x: G.seam, y: 0 }).x : worldToScreen(cams.seam, L, { x: 0, y: G.seam }).y;
  const drawE = tween(t, [T.divider, T.divider + T.dividerDraw], [0, 1], EASE.house);
  const tipW = G.divider.from + (G.divider.to - G.divider.from) * drawE;
  const tipScr = sbs
    ? worldToScreen(cams.seam, L, { x: G.seam, y: tipW }).y
    : worldToScreen(cams.seam, L, { x: tipW, y: G.seam }).x;
  const nightOn = t >= T.divider - 1 && seamScr > 0;
  const nightClip = sbs
    ? `inset(0px ${Math.max(0, L.width - seamScr).toFixed(2)}px 0px 0px)`
    : `inset(0px 0px ${Math.max(0, L.height - seamScr).toFixed(2)}px 0px)`;
  const bookedClip = sbs
    ? `inset(0px 0px 0px ${Math.max(0, seamScr).toFixed(2)}px)`
    : `inset(${Math.max(0, seamScr).toFixed(2)}px 0px 0px 0px)`;
  // the night falls in behind the bead: a soft edge (≈ motion blur) chasing the tip
  const wipe =
    drawE < 1
      ? `linear-gradient(${sbs ? '180deg' : '90deg'}, #000 ${(tipScr - 130).toFixed(1)}px, rgba(0,0,0,0.55) ${(tipScr - 50).toFixed(1)}px, transparent ${(tipScr + 20).toFixed(1)}px)`
      : undefined;
  /** on-screen side of a point, 0 = night, 1 = booked (after the seam exists) */
  const isNight = (x: number, y: number) => (sbs ? x < seamScr : y < seamScr);

  /* ── atmosphere levels ──────────────────────────────────────────── */
  const discs = tween(t, T.discsIn, [0, 1], EASE.inOut) * (1 - tween(t, T.discsOut, [0, 1], EASE.in2));
  const warmMotes =
    tween(t, [RESULT.split, RESULT.bookedWord], [0, 1], EASE.inOut) * (1 - tween(t, T.discsOut, [0, 1], EASE.in2));
  const dim = 0.1 * tween(t, T.hold, [0, 1], EASE.inOut);
  /** the Booked half's light swells as its word lands (and settles on its own) */
  const bookedFlash = t >= RESULT.bookedWord ? Math.exp(-(t - RESULT.bookedWord) / 7) : 0;
  /** the Booked half's own ground (the night stage's mid range) grades in behind the seam's bead */
  const bookedGround = tween(t, [T.divider + 1, T.splitGrade[1]], [0, 1], EASE.inOut);

  /* ── smear: the recompose's peel and the dive stream the world out of the event ── */
  const diving = t >= T.dive[0] && cams.dive.k > 0.02;
  const zRateDive = diving ? camsAt(t + 0.5, G, L, T).dive.f / camsAt(t - 0.5, G, L, T).dive.f - 1 : 0;
  const recSmear = zRateRec > 0.05 || Math.hypot(vel.x, vel.y) > 45;
  const smear =
    diving || (recSmear && t > RESULT.land + 2)
      ? [
          { dt: 0.14, op: 0.22 },
          { dt: 0.28, op: 0.13 },
          { dt: 0.42, op: 0.07 },
        ]
      : [];
  const wordBlur = Math.min(16, Math.max(zRateDive * 700 * 0.09, 0));
  /** the words' glow leaves with the dive (its blur, scaled 8×, would cost more than it shows) */
  const glowScale = 1 - tween(t, [T.pulse, T.pulse + 6], [0, 1], EASE.inOut);

  /* ── the world: the ember light, the calendar, the card ───────────── */
  const world = (tt: number, key: string, op = 1) => {
    const c = key === 'world' ? cams : camsAt(tt, G, L, T);
    const m = key === 'world' ? map : calMapAt(tt, G, T);
    return (
      <AbsoluteFill key={key} style={{ transform: layerCss(c.world, 1), opacity: op }}>
        <Calendar
          t={tt}
          G={G}
          T={T}
          map={m}
          vel={key === 'world' ? vel : { x: 0, y: 0 }}
          camZ={c.world.z}
          eventOut={opening}
          vertical={L.vertical}
          lite={c.world.z > 1.8}
        />
        {key === 'world' ? <Flyer t={t} G={G} T={T} L={L} cam={cams.world} MM={MM} /> : null}
      </AbsoluteFill>
    );
  };

  /* ── the titles: the seam and the two words ─────────────────────── */
  const wf = (c: Cam) => (wordBlur > 0.3 ? `blur(${(wordBlur / c.z).toFixed(2)}px)` : undefined);
  /** is a word (centre cx, baseline) still on screen through camera c at the words' depth? */
  const onScreen = (c: Cam, cx: number, base: number) => {
    const w = G.word * 2.2;
    const a = planeToScreen(c, L, { x: cx - w, y: base - G.word * 1.1 }, 1.05);
    const b = planeToScreen(c, L, { x: cx + w, y: base + G.word * 0.4 }, 1.05);
    return b.x > 0 && a.x < L.width && b.y > 0 && a.y < L.height;
  };
  const asleep = (cn: Cam, key: string, op = 1) =>
    t >= RESULT.split - 12 && onScreen(cn, G.asleep.cx, G.asleep.base) ? (
      <AbsoluteFill key={key} style={{ transform: layerCss(cn, 1.05), opacity: op }}>
        <div
          style={{
            position: 'absolute',
            left: G.asleep.cx,
            top: G.asleep.base - wordBase,
            transform: 'translateX(-50%)',
            filter: wf(cn),
          }}
        >
          <LetterRise
            text="Asleep."
            t={t}
            land={RESULT.split}
            size={G.word}
            color={C.paperDim}
            stagger={T.letterStagger}
            glow="#c0ace0"
            glowRest={0.14}
            glowScale={glowScale * (op < 1 ? 0 : 1)}
          />
        </div>
      </AbsoluteFill>
    ) : null;
  const booked = (cb: Cam, key: string, op = 1) =>
    t >= RESULT.bookedWord - 12 && onScreen(cb, G.bookedWord.cx, G.bookedWord.base) ? (
      <AbsoluteFill key={key} style={{ transform: layerCss(cb, 1.05), opacity: op }}>
        <div
          style={{
            position: 'absolute',
            left: G.bookedWord.cx,
            top: G.bookedWord.base - wordBase,
            transform: 'translateX(-50%)',
            filter: wf(cb),
          }}
        >
          <LetterRise
            text="Booked."
            t={t}
            land={RESULT.bookedWord}
            size={G.word}
            color={C.emberLit}
            stagger={T.letterStagger}
            glow={C.ember}
            glowRest={0.35}
            glowScale={glowScale * (op < 1 ? 0 : 1)}
            sheen="#fff3e8"
          />
        </div>
      </AbsoluteFill>
    ) : null;
  const smearCams = smear.map((s) => ({ c: camsAt(t - s.dt, G, L, T), op: s.op }));
  const titles = (
    <>
      <AbsoluteFill style={{ transform: layerCss(cams.seam, 1) }}>
        <Divider
          t={t}
          start={T.divider}
          dur={T.dividerDraw}
          vertical={G.divider.vertical}
          at={G.divider.at}
          from={G.divider.from}
          to={G.divider.to}
        />
      </AbsoluteFill>
      {smearCams.map((s, i) => booked(s.c.booked, `bsmear${i}`, s.op))}
      {booked(cams.booked, 'booked')}
    </>
  );
  const titlesUnder = t < T.titlesOver;

  /* ── the event, opening up past the frame (screen space) ─────────── */
  /** the opening chip's screen box and its face size at (fractional) time tt — sampled again for the type's zoom trail */
  const openAt = (tt: number) => {
    const m = tt === t ? map : calMapAt(tt, G, T);
    const cb = tt === t ? cams.world : camsAt(tt, G, L, T).world;
    const lk = tt === t ? look : eventLookAt(tt, T);
    const evW = mapRect(m, G.block(SLOT.day, SLOT.from, SLOT.to));
    const ins = 4;
    const ex = { x: evW.x + ins, y: evW.y + ins, w: evW.w - 2 * ins, h: evW.h - 2 * ins };
    const ox = ex.x + ex.w / 2;
    const oy = ex.y + ex.h * 0.6;
    const a = worldToScreen(cb, L, { x: ox - (ex.w / 2) * lk.sx, y: oy - ex.h * 0.6 * lk.sy });
    const z = worldToScreen(cb, L, { x: ox + (ex.w / 2) * lk.sx, y: oy + ex.h * 0.4 * lk.sy });
    // the camera does most of the growing (DIVE_Z); the event opens the last few ×
    const oe = OPEN(Math.min(1, Math.max(0, (tt - T.open[0]) / (T.open[1] - T.open[0]))));
    // the event's rect morphs into the frame's (+ margin): all four rounded corners arrive together
    const M = 60;
    const box = {
      x0: a.x + (-M - a.x) * oe,
      y0: a.y + (-M - a.y) * oe,
      x1: z.x + (L.width + M - z.x) * oe,
      y1: z.y + (L.height + M - z.y) * oe,
    };
    // "• 3:00 PM" scales with the chip: the camera, and the open on top of it
    const grow = (box.x1 - box.x0) / Math.max(1, z.x - a.x);
    return { box, oe, cb, face: G.crop.face * cb.z * lk.sy * grow };
  };
  let openEl: React.ReactNode = null;
  if (opening) {
    const { box, oe, cb, face: faceSize } = openAt(t);
    // THE LIGHT: an amber core (#ffb877, the ember's own lit tone) grows from the event's centre from
    // the bloom's start, a white-hot core follows it late, and both bleed past the chip's edge — the
    // chip dissolves into light (never a slab), white ON the cut. Radii in % of the farthest corner.
    const bu = Math.min(1, Math.max(0, (t - T.bloom[0]) / (T.bloom[1] - T.bloom[0])));
    const bloom = Math.pow(bu, 1.5);
    const amber = -50 + 160 * bloom;
    const whiteR = -60 + 155 * Math.pow(bu, 3);
    const hot = mixHex(C.white, C.emberLit, 0.5);
    const hair = 1 - tween(t, [T.whiteFull - 4, T.whiteFull], [0, 1], EASE.inOut);
    // "• 3:00 PM" rides the push and burns out — runs hot, then is swallowed — only in the last frames
    const burn = tween(t, T.faceBurn, [0, 1], EASE.in2);
    const faceOp = 1 - burn;
    // the spill past the edge (screen px): amber close in, ember wide — LIGHT on the dark sheet
    const spill = 40 + 300 * bloom;
    const boxW = box.x1 - box.x0;
    const boxH = box.y1 - box.y0;
    const bcx = box.x0 + boxW / 2;
    const bcy = box.y0 + boxH * 0.55;
    // as the light takes over, the chip's own edge runs hot and goes soft: it dissolves
    const edge = mixHex(look.fill, C.emberLit, 0.75 * bloom);
    const soft = 22 * bloom * bloom;
    const R = Math.hypot(boxW, boxH) / 2;
    const reach = 0.3 + 1.1 * bloom;
    const radius = 14 * cb.z * (1 + 0.6 * oe);
    // the type's zoom smear (a 180° shutter): eight samples over the last half frame, fading — only once
    // the dive is fast enough to smear (≥ 10 % a frame), so it never reads as a double image
    const rate = faceSize / openAt(t - 1).face;
    const trail =
      faceOp > 0.05 && rate > 1.1
        ? Array.from({ length: 8 }, (_, i) => ({
            ...openAt(t - (i + 1) / 16),
            op: 0.16 * Math.pow(1 - i / 8, 1.5) * faceOp * Math.min(1, (rate - 1.1) / 0.1),
          }))
        : [];
    openEl = (
      <>
        <div style={{ position: 'absolute', left: box.x0, top: box.y0, width: boxW, height: boxH }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: radius,
              background: [
                `linear-gradient(180deg, rgba(255,255,255,${(0.12 * (1 - bloom)).toFixed(3)}), rgba(255,255,255,0) 55%)`,
                `radial-gradient(farthest-corner at 50% 55%, ${C.white} ${whiteR.toFixed(1)}%, ${hot} ${(whiteR + 10).toFixed(1)}%, ${C.emberLit} ${amber.toFixed(1)}%, ${mixHex(C.ember, C.emberLit, 0.35 + 0.4 * bloom)} ${(amber + 22).toFixed(1)}%, ${edge} ${(amber + 50).toFixed(1)}%)`,
              ].join(', '),
              boxShadow: [
                `0 0 0 1px ${hexA(C.ember, 0.7 * hair)}`,
                `0 0 ${(spill * 0.4).toFixed(1)}px ${(spill * 0.1).toFixed(1)}px ${hexA(C.emberLit, 0.15 + 0.7 * bloom)}`,
                `0 0 ${spill.toFixed(1)}px ${(spill * 0.3).toFixed(1)}px ${hexA(C.ember, (0.45 + 0.25 * look.glowPulse) * (1 - 0.2 * bloom))}`,
              ].join(', '),
              filter: soft > 0.4 ? `blur(${soft.toFixed(2)}px)` : undefined,
            }}
          />
        </div>
        {trail.map((g, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: g.box.x0,
              top: g.box.y0,
              width: g.box.x1 - g.box.x0,
              height: g.box.y1 - g.box.y0,
            }}
          >
            <EventFace size={g.face} op={g.op} color={C.white} glow={burn} />
          </div>
        ))}
        <div style={{ position: 'absolute', left: box.x0, top: box.y0, width: boxW, height: boxH }}>
          <EventFace size={faceSize} op={faceOp} color={C.white} glow={burn} />
        </div>
        {/* the bloom: added light (screen) from the core out past the chip's edge, washing the sheet
            round it — the whole frame is light by the cut */}
        {bloom > 0.01 ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              mixBlendMode: 'screen',
              background: `radial-gradient(circle at ${bcx.toFixed(1)}px ${bcy.toFixed(1)}px, ${hexA(C.white, Math.min(1, 1.1 * Math.pow(bu, 2.2)))} 0px, ${hexA(hot, 0.9 * bloom)} ${(R * 0.45 * reach).toFixed(1)}px, ${hexA(C.emberLit, 0.6 * bloom)} ${(R * 0.85 * reach).toFixed(1)}px, ${hexA(C.ember, 0.18 * bloom)} ${(R * 1.25 * reach).toFixed(1)}px, ${hexA(C.ember, 0)} ${(R * 1.7 * reach).toFixed(1)}px)`,
            }}
          />
        ) : null}
      </>
    );
  }

  /* ── the call's glow at the mark, handed over and cross-faded into the plate ── */
  const glowK = MARK_GLOW_HANDOFF * (1 - tween(t, T.plateIn, [0, 1], EASE.inOut));
  const S0 = glowK > 0.005 ? cardAt(t, G, L, T, MM) : null;

  const nearCams: readonly [Cam, Cam] = [cams.night, cams.booked];

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {/* ── 0.15 · the night room ───────────────────────────────────── */}
      {/* It opens as the call's MIDNIGHT room (the cut stays dark) and warms to the night
          room only while the calendar sheet fills the frame (T.roomWarm), so nothing brightens
          in view after the hand-over. */}
      <AbsoluteFill style={{ transform: layerCss(cams.base, 0.15), opacity: roomOp }}>
        {roomWarm < 0.999 ? (
          <div style={{ ...roomBox, background: MIDNIGHT_ROOM.replace('120% 100% at 50% 40%', '81% 67.5% at 50% 43.25%') }} />
        ) : null}
        {roomWarm > 0.001 ? (
          <div
            style={{
              ...roomBox,
              opacity: roomWarm,
              background: NIGHT_ROOM.replace('120% 100% at 50% 40%', '81% 67.5% at 50% 43.25%'),
            }}
          />
        ) : null}
        <Vignette strength={0.55} color="8,6,28" />
      </AbsoluteFill>
      {roomWarm < 0.999 ? (
        <AbsoluteFill style={{ opacity: roomOp }}>
          <MidnightVignette k={1 - roomWarm} />
        </AbsoluteFill>
      ) : null}

      {/* ── 0.4 · room light: the call's violet, cooling out ───────── */}
      <AbsoluteFill style={{ transform: layerCss(cams.base, 0.4), opacity: roomOp }}>
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

      {/* ── 0.15 · the BOOKED half's ground: night violet, lit from behind the card (no ember wash) ── */}
      {bookedGround > 0.001 ? (
        <AbsoluteFill style={{ clipPath: bookedClip, opacity: bookedGround, WebkitMaskImage: wipe, maskImage: wipe }}>
          <AbsoluteFill style={{ transform: layerCss(cams.booked, 0.15) }}>
            <BookedGround
              x={sbs ? G.seam - 140 : -140}
              y={sbs ? -140 : G.seam - 140}
              w={sbs ? L.width - G.seam + 280 : L.width + 280}
              h={sbs ? L.height + 280 : L.height - G.seam + 280}
              cx={G.booked.x}
              cy={sbs ? 470 : 1300}
              vertical={L.vertical}
              light={look.breath * (1 + 0.45 * bookedFlash)}
            />
          </AbsoluteFill>
        </AbsoluteFill>
      ) : null}

      {/* ── 0.5 · far discs on the Booked half (the night plate covers the other side) ── */}
      <AbsoluteFill style={{ clipPath: bookedClip }}>
        <Discs
          discs={G.discsFar.filter((d) => d.side === 1)}
          cams={nearCams}
          L={L}
          depth={0.5}
          colors={['185,163,255', '139,92,246']}
          opacity={discs}
          t={t}
          soft={0.9}
        />
      </AbsoluteFill>

      {/* ── the NIGHT half: its own sky, falling in behind the seam's bead ── */}
      {nightOn ? (
        <AbsoluteFill style={{ clipPath: nightClip, WebkitMaskImage: wipe, maskImage: wipe }}>
          <AbsoluteFill style={{ transform: layerCss(cams.night, 0.15) }}>
            <NightGrade
              x={sbs ? -140 : -140}
              y={sbs ? -140 : -140}
              w={sbs ? G.seam + 280 : L.width + 280}
              h={sbs ? L.height + 280 : G.seam + 280}
              vertical={L.vertical}
            />
          </AbsoluteFill>
          <AbsoluteFill style={{ transform: layerCss(cams.night, 0.4) }}>
            <Stars t={t} stars={G.stars} locks={T.stars} />
          </AbsoluteFill>
          <Discs
            discs={G.discsFar.filter((d) => d.side === 0)}
            cams={nearCams}
            L={L}
            depth={0.5}
            colors={['150,140,230', '139,92,246']}
            opacity={discs}
            t={t}
            soft={0.9}
          />
          <AbsoluteFill style={{ transform: layerCss(cams.night, 0.6) }}>
            <Moon t={t} x={G.moon.x} y={G.moon.y} d={G.moon.d} lock={T.moon} bar={DOWNBEAT} />
          </AbsoluteFill>
          {/* "Asleep." rises in the night half only: the falling night reveals it */}
          {smearCams.map((s, i) => asleep(s.c.night, `asmear${i}`, s.op))}
          {asleep(cams.night, 'asleep')}
        </AbsoluteFill>
      ) : null}

      {/* ── 1.0 / 1.05 · the titles plane, UNDER the sheet while it recomposes ── */}
      {titlesUnder ? titles : null}

      {/* ── 1.0 · the world ─────────────────────────────────────────── */}
      {S0 ? <MarkGlow x={S0.x} y={S0.y} fontSize={G.mark.fontSize} k={glowK} /> : null}
      {smear.slice(0, 2).map((s, i) => world(t - s.dt, `smear${i}`, s.op))}
      {world(t, 'world')}

      {/* ── 1.0 / 1.05 · the titles plane on top once the sheet is home ── */}
      {titlesUnder ? null : titles}

      {/* ── 1.4–1.6 · the near planes: motes and out-of-focus discs, per half ── */}
      <AbsoluteFill style={{ opacity: roomOp * 0.9 }}>
        <Motes
          t={t + 810}
          cam={cams.base}
          depth={1.5}
          width={L.width}
          height={L.height}
          count={18}
          vy={-0.14}
          keep={(x, y) =>
            t < T.divider - 6 || isNight(x, y) ? 1 : 1 - tween(t, [T.divider - 6, RESULT.split], [0, 1], EASE.inOut)
          }
        />
      </AbsoluteFill>
      {warmMotes > 0 ? (
        <AbsoluteFill style={{ clipPath: bookedClip, opacity: warmMotes }}>
          <Motes
            t={t}
            cam={cams.booked}
            depth={1.4}
            width={L.width}
            height={L.height}
            count={14}
            seed="result-warm"
            color="214,200,255"
            opacity={0.42}
            vy={-0.95}
            keep={(x, y) => (isNight(x, y) ? 0 : 1)}
          />
        </AbsoluteFill>
      ) : null}
      {discs > 0 ? (
        <>
          <AbsoluteFill style={{ clipPath: nightClip }}>
            <Discs
              discs={G.discsNear.filter((d) => d.side === 0)}
              cams={nearCams}
              L={L}
              depth={1.6}
              colors={['185,163,255', '196,168,255']}
              opacity={discs}
              t={t}
            />
          </AbsoluteFill>
          <AbsoluteFill style={{ clipPath: bookedClip }}>
            <Discs
              discs={G.discsNear.filter((d) => d.side === 1)}
              cams={nearCams}
              L={L}
              depth={1.6}
              colors={['185,163,255', '196,168,255']}
              opacity={discs}
              t={t}
            />
          </AbsoluteFill>
        </>
      ) : null}

      {/* ── the night half dims 10 % across the hold ─────────────────── */}
      {dim > 0.002 ? <AbsoluteFill style={{ clipPath: nightClip, background: `rgba(3,4,16,${dim.toFixed(3)})` }} /> : null}

      {/* ── screen · the event opens up into the white act ─────────── */}
      {openEl}

      {/* ── screen · Ava's "See you then!" (rides the cut, under the mark) ── */}
      <SignOff t={t} />
    </AbsoluteFill>
  );
};
