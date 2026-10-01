/**
 * RESULT (8 beats) — the booking flies into the calendar; the diptych.
 *
 * THE LIGHT. The call's emerald room was lit by Ava's orb; the orb has just
 * dived into "Wednesday at 3 PM", so its light goes with it: over the first
 * 20 frames the emerald falls away to a warm near-black room (<EmberRoom>)
 * whose ONE key light is the booking itself — the mark, then the card, then
 * the event on the calendar (the light follows it on screen, rises as the
 * card warms, flares on the land). At the split the left half becomes the
 * night: a near-black <NightRoom> lit only by the moon. Colour lives in the
 * subjects — the ember booking, the moon — never in the wallpaper. No discs,
 * no motes, no glints; no blur, smear, ghosts or trails anywhere.
 *
 *   t 0      the call hands over "Wednesday at 3 PM" (ember, MARK_TYPE) at MARK
 *            with its <MarkGlow> at MARK_GLOW_HANDOFF; the glow cross-fades into
 *            the card's plate (t 1–5)
 *   t 0–12   LIFT: a 2-frame dip, then a soft spring up into the card (760/720
 *            × 200), towards the lens and a touch to the side; the pill's wash
 *            grows into the card; the mark's words travel onto their measured
 *            places in the card row ("Wednesday · 3 PM") — the same setting,
 *            only smaller — " at" folds out and its "·" folds in, and the
 *            registered words take the row's paper ink (t 9–13); BOOKED + its
 *            dot rise out of their band
 *   t 8–13   the owner's calendar slides in and builds; the dashed slot breathes
 *   t 12–15  the card winds up
 *   t 15–30  FLY: a lob into the slot while the camera pushes into a close-up;
 *            the card warms to solid ember — one crisp object on every frame
 *   t 30     LAND on the beat: the event squashes and settles on one soft
 *            spring, its fill flares and cools, the frame takes one soft dip
 *   t 36–51  the camera leans in (3 f), then peels back out over 6 f while the
 *            sheet crops into its card window (TUE–THU × 12–6 PM / 1–5 PM),
 *            overshoots 2.5 % and settles
 *   t 41–49  the seam draws (a paper hairline) and the night falls in behind it
 *   t 45     "Asleep." locks (left / top) — TYPE.display, paper
 *   t 49     the moon locks; four stars light on 16ths (53 56 68 71)
 *   t 60     "Booked." locks (right / bottom) — TYPE.display, ember ink — and
 *            a band of lighter ink runs through it once
 *   t 64     the event's dot draws itself into a check
 *   t 45–90  the hold: the halves drift apart ±10 px; the night dims 10 %; the
 *            event's light breathes; ONE light sweep across it on t 75
 *   t 90–100 the anticipation: the camera leans back, the event swells
 *   t 100–120 the dive into the event, accelerating into the cut; "• 3:00 PM"
 *            rides it; from t 111 its fill heats from the centre — ember, amber
 *            (#ffb877), white — and its light spills past its edge, so the chip
 *            becomes light; the white type is swallowed by the white fill; the
 *            frame is white ON t 120 = the cut (the knowledge's hit-white)
 *
 * Parallax: rooms in screen space (their lights follow their sources) · stars
 * 0.4 · moon 0.6 · calendar / card 1.0 · words 1.05. Each half has its own
 * camera (the drift) on top of the world camera; the seam and both halves
 * share the dive. Slowly drifting type rides a sub-pixel layer (Type.tsx
 * `subpixel`) so it never steps; scaled type is drawn plain (always crisp).
 */
import React, { useMemo } from 'react';
import { AbsoluteFill, Easing } from 'remotion';
import { EmberRoom, NightRoom } from '../components/Atmosphere';
import { subpixel } from '../components/Type';
import { MarkGlow } from '../components/Shared';
import { MARK_GLOW_HANDOFF, MARK_TYPE } from '../lib/handoff';
import { useLayout } from '../lib/layout';
import { EASE, mixHex, smooth, tween } from '../lib/motion';
import { useSceneFrame } from '../lib/scene';
import { typeFont } from '../lib/type';
import { C } from '../theme';
import { RESULT, RESULT_LOCAL } from '../timing';
import { Calendar, eventLookAt } from './result/Calendar';
import { EVENT_FONT, EventFace, fitFace, hexA } from './result/Event';
import { Flyer } from './result/Flyer';
import { CAL, geo, layerCss, mapRect, planeToScreen, SLOT, worldToScreen, type Cam, type Geo } from './result/geometry';
import { cssFont, measure, useFontsReady, type FontSpec } from './result/measure';
import { calMapAt, camsAt, cardAt, eventWorldAt, type MarkMetrics } from './result/motion';
import { SignOff } from './result/SignOff';
import { DisplayWord, Moon, Seam, Stars } from './result/Split';

export type ResultTiming = typeof RESULT_LOCAL;

/** the event's rect opens past the frame (slow out of the chip, fastest into the cut) */
const OPEN = Easing.bezier(0.5, 0, 0.75, 0.35);
/** the light's warm white (between the ember's lit tone and paper white) */
const WARM_WHITE = '#fff3ea';
/** the moon's light on the night wall (the night light's lilac, lit) */
const MOON_LIGHT = '#c9bde6';

/** the mark's setting as a FontSpec (MARK_TYPE, <BookedMark>) */
const markSpec = (size: number): FontSpec => ({
  family: MARK_TYPE.family,
  weight: MARK_TYPE.weight,
  size,
  track: parseFloat(MARK_TYPE.tracking),
  lh: MARK_TYPE.lineHeight,
});

function markMetrics(G: Geo): MarkMetrics {
  const mf = markSpec(G.mark.fontSize);
  const D = G.cardType.date;
  const B = { day: 'Wednesday', at: 'at', sep: '·', time: '3 PM' };
  const a = (s: string) => measure(s, mf).w;
  const c = (s: string) => measure(s, D).w;
  // the row's "·" has sepAir em of extra air either side (CardFace)
  const airM = G.cardType.sepAir * mf.size;
  const airC = G.cardType.sepAir * D.size;
  return {
    m: {
      W: a(`${B.day} ${B.at} ${B.time}`),
      wed: a(B.day),
      num: a(B.time),
      numX: a(`${B.day} ${B.at} `),
      // the card's row, set in the mark's own face: what the mark closes up into as " at" folds out
      row: {
        W: a(`${B.day} ${B.sep} ${B.time}`) + 2 * airM,
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

/** A camera layer's style: drawn plain while it scales (always crisp), on a sub-pixel layer while it
 *  only translates (so slow drifts never step). `moving`: its transform differs a quarter frame later. */
function layerStyle(cam: Cam, next: Cam, depth: number): React.CSSProperties {
  const tf = layerCss(cam, depth);
  const z = 1 + (cam.z - 1) * depth;
  const moving = Math.abs(cam.x - next.x) + Math.abs(cam.y - next.y) + Math.abs(cam.z - next.z) * 100 > 1e-4;
  return subpixel(tf, moving && Math.abs(z - 1) < 0.002 && Math.abs(next.z - cam.z) < 1e-6);
}

export const Result: React.FC = () => {
  const t = useSceneFrame('result');
  const L = useLayout();
  const G0 = useMemo(() => geo(L), [L.vertical]); // eslint-disable-line react-hooks/exhaustive-deps
  const ready = useFontsReady([
    cssFont(markSpec(G0.mark.fontSize)),
    cssFont(G0.cardType.date),
    cssFont(EVENT_FONT(G0.crop.face)),
    typeFont('display', L.vertical, { tone: 'night' }),
    typeFont('label', L.vertical, { tone: 'night' }),
  ]);
  const G = useMemo(() => fitFaces(G0), [G0, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  const MM = useMemo(() => markMetrics(G), [G]);
  // (before the cut only Ava's sign-off caption, over the call's last frames: an L-cut)
  if (t < 0) return <SignOff t={t} />;
  const T = RESULT_LOCAL;
  // OUT: the white act — exactly #ffffff from whiteFull to the last mounted frame
  if (t >= T.whiteFull) return <AbsoluteFill style={{ background: C.white }} />;

  const cams = camsAt(t, G, L, T);
  const next = camsAt(t + 0.25, G, L, T);
  const map = calMapAt(t, G, T);
  const opening = t >= RESULT.toWhite[0];
  const look = eventLookAt(t, T);

  /* ── the seam, on screen ──────────────────────────────────────── */
  const sbs = G.sideBySide;
  const seamScr = sbs ? worldToScreen(cams.seam, L, { x: G.seam, y: 0 }).x : worldToScreen(cams.seam, L, { x: 0, y: G.seam }).y;
  // the night half's contents (moon, stars, "Asleep.") are there from the start of the word's rise —
  // under the sheet, which uncovers them as it crops into its card; only its light dissolves in with the seam
  const nightOn = t >= RESULT.split - 12 && seamScr > 0;
  const nightClip = sbs
    ? `inset(0px ${Math.max(0, L.width - seamScr).toFixed(2)}px 0px 0px)`
    : `inset(0px 0px ${Math.max(0, L.height - seamScr).toFixed(2)}px 0px)`;
  /** the night falls in as the seam draws (a dissolve of light: the warm room gives way to the moon's) */
  const nightIn = tween(t, [T.divider, T.divider + T.dividerDraw + 4], [0, 1], EASE.inOut);
  const dim = 0.1 * tween(t, T.hold, [0, 1], EASE.inOut);

  /* ── THE KEY LIGHT: the booking (mark → card → event), on screen ─── */
  const roomOp = tween(t, T.roomIn, [0, 1], EASE.inOut);
  const evScr = worldToScreen(cams.world, L, eventWorldAt(t, G, T));
  const card = t < RESULT.land ? cardAt(t, G, L, T, MM) : null;
  const key = card ? { x: card.x, y: card.y } : evScr;
  const landFlash = t >= RESULT.land ? Math.exp(-(t - RESULT.land) / 6) : 0;
  const bu = Math.min(1, Math.max(0, (t - T.bloom[0]) / (T.bloom[1] - T.bloom[0])));
  const keyStrength =
    (card ? 0.07 + 0.06 * card.plateOp + 0.05 * card.warm : 0.17 * look.breath + 0.1 * landFlash + 0.06 * look.glowPulse) *
      tween(t, [0, 10], [0.4, 1], EASE.inOut) +
    0.5 * bu * bu;
  // (9:16: a wide, low pool — the tall frame would otherwise carry the warm light down to its foot)
  const keyRadius = L.pick(0.42, 0.22) * L.height * (1 + 0.6 * bu);
  const keyAspect = L.pick(1, 1.45);

  /* ── the world: the calendar, the card ───────────────────────────── */
  const world = (
    <AbsoluteFill style={layerStyle(cams.world, next.world, 1)}>
      <Calendar
        t={t}
        G={G}
        T={T}
        map={map}
        camZ={cams.world.z}
        eventOut={opening}
        vertical={L.vertical}
        lite={cams.world.z > 1.8}
      />
      <Flyer t={t} G={G} T={T} L={L} cam={cams.world} MM={MM} vertical={L.vertical} />
    </AbsoluteFill>
  );

  /* ── the titles: the seam and the two words ─────────────────────── */
  /** a word's placement through camera c (depth 1.05): screen anchor + scale */
  const wordAt = (c: Cam, n: Cam, cx: number, base: number) => {
    const p = planeToScreen(c, L, { x: cx, y: base }, 1.05);
    const q = planeToScreen(n, L, { x: cx, y: base }, 1.05);
    const z = 1 + (c.z - 1) * 1.05;
    const zn = 1 + (n.z - 1) * 1.05;
    const onScreen =
      p.x + G.word * 2.4 * z > 0 &&
      p.x - G.word * 2.4 * z < L.width &&
      p.y + G.word * 0.4 * z > 0 &&
      p.y - G.word * 1.1 * z < L.height;
    const moving = Math.hypot(q.x - p.x, q.y - p.y) > 1e-4 && Math.abs(z - 1) < 0.002 && Math.abs(zn - z) < 1e-6;
    return {
      tf: `translate(${p.x.toFixed(3)}px, ${p.y.toFixed(3)}px)${Math.abs(z - 1) > 1e-6 ? ` scale(${z.toFixed(5)})` : ''}`,
      moving,
      onScreen,
    };
  };
  const aw = wordAt(cams.night, next.night, G.asleep.cx, G.asleep.base);
  const bw = wordAt(cams.booked, next.booked, G.bookedWord.cx, G.bookedWord.base);
  const asleep =
    t >= RESULT.split - 12 && aw.onScreen ? (
      <DisplayWord
        text="Asleep."
        t={t}
        land={RESULT.split}
        color={C.paper}
        vertical={L.vertical}
        transform={aw.tf}
        moving={aw.moving}
      />
    ) : null;
  const booked =
    t >= RESULT.bookedWord - 12 && bw.onScreen ? (
      <DisplayWord
        text="Booked."
        t={t}
        land={RESULT.bookedWord}
        color={C.emberLit}
        sheen={mixHex(C.emberLit, C.emberSoft, 0.7)}
        vertical={L.vertical}
        transform={bw.tf}
        moving={bw.moving}
      />
    ) : null;
  const seam = (
    <AbsoluteFill style={{ transform: layerCss(cams.seam, 1) }}>
      <Seam
        t={t}
        start={T.divider}
        dur={T.dividerDraw}
        vertical={G.divider.vertical}
        at={G.divider.at}
        from={G.divider.from}
        to={G.divider.to}
      />
    </AbsoluteFill>
  );
  const titlesUnder = t < T.titlesOver;
  const titles = (
    <>
      {seam}
      {booked}
    </>
  );

  /* ── the event, opening up past the frame (screen space) ─────────── */
  let openEl: React.ReactNode = null;
  if (opening) {
    const cb = cams.world;
    const evW = mapRect(map, G.block(SLOT.day, SLOT.from, SLOT.to));
    const ins = 4;
    const ex = {
      x: evW.x + ins,
      y: evW.y + ins,
      w: evW.w - 2 * ins,
      h: evW.h - 2 * ins,
    };
    const ox = ex.x + ex.w / 2;
    const oy = ex.y + ex.h * 0.6;
    const a = worldToScreen(cb, L, {
      x: ox - (ex.w / 2) * look.sx,
      y: oy - ex.h * 0.6 * look.sy,
    });
    const z = worldToScreen(cb, L, {
      x: ox + (ex.w / 2) * look.sx,
      y: oy + ex.h * 0.4 * look.sy,
    });
    // the camera does most of the growing (DIVE_Z); the event opens the last few ×
    const oe = OPEN(Math.min(1, Math.max(0, (t - T.open[0]) / (T.open[1] - T.open[0]))));
    // the event's rect morphs into the frame's (+ margin)
    const M = 60;
    const box = {
      x0: a.x + (-M - a.x) * oe,
      y0: a.y + (-M - a.y) * oe,
      x1: z.x + (L.width + M - z.x) * oe,
      y1: z.y + (L.height + M - z.y) * oe,
    };
    const grow = (box.x1 - box.x0) / Math.max(1, z.x - a.x);
    const faceSize = G.crop.face * cb.z * look.sy * grow;
    // THE LIGHT: the chip becomes light. Its whole fill heats — ember, amber (#ffb877), warm white,
    // white — the centre a little ahead of the edge (a source, not a hotspot); its light spills past its
    // edge onto the sheet; its corners square off as it fills the frame, so no dark corner is left at
    // the cut; the white type goes as the fill turns light around it; a flat white takes the last
    // half-frame into the knowledge's white (exactly #ffffff from whiteFull).
    const h = Math.pow(bu, 1.2);
    const heat = (x: number) => {
      const k = Math.min(1, Math.max(0, x));
      if (k < 0.45) return mixHex(look.fill, C.emberLit, k / 0.45);
      if (k < 0.8) return mixHex(C.emberLit, WARM_WHITE, (k - 0.45) / 0.35);
      return mixHex(WARM_WHITE, C.white, (k - 0.8) / 0.2);
    };
    const boxW = box.x1 - box.x0;
    const boxH = box.y1 - box.y0;
    const bcx = box.x0 + boxW / 2;
    const bcy = box.y0 + boxH * 0.55;
    const R = Math.hypot(boxW, boxH) / 2;
    const reach = 0.4 + 1.2 * h;
    const spill = 40 + 220 * h;
    const radius = 14 * cb.z * (1 - oe);
    const faceOp = 1 - smooth(0.22, 0.6, h);
    const flat = smooth(T.whiteFull - 1.5, T.whiteFull, t);
    openEl = (
      <>
        <div
          style={{
            position: 'absolute',
            left: box.x0,
            top: box.y0,
            width: boxW,
            height: boxH,
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: radius,
              background: [
                `linear-gradient(180deg, rgba(255,255,255,${(0.12 * (1 - h)).toFixed(3)}), rgba(255,255,255,0) 55%)`,
                `radial-gradient(farthest-corner at 50% 55%, ${heat(h * 1.2)} 0%, ${heat(h * 1.05)} 45%, ${heat(h * 0.9)} 100%)`,
              ].join(', '),
              boxShadow: [
                `0 0 0 1px ${hexA(C.emberLit, 0.4 * (1 - h))}`,
                `0 0 ${(spill * 0.4).toFixed(1)}px ${(spill * 0.1).toFixed(1)}px ${hexA(C.emberLit, 0.12 + 0.5 * h)}`,
                `0 0 ${spill.toFixed(1)}px ${(spill * 0.3).toFixed(1)}px ${hexA(C.ember, (0.4 + 0.25 * look.glowPulse) * (1 - 0.3 * h))}`,
              ].join(', '),
            }}
          />
          <EventFace size={faceSize} op={faceOp} color={C.white} dotColor={C.white} />
        </div>
        {/* its light on the room: added (screen) from the chip out past its edge — the frame is light by the cut */}
        {h > 0.01 ? (
          <AbsoluteFill
            style={{
              mixBlendMode: 'screen',
              background: `radial-gradient(circle at ${bcx.toFixed(1)}px ${bcy.toFixed(1)}px, ${hexA(WARM_WHITE, 0.9 * h * h)} 0px, ${hexA(C.emberLit, 0.55 * h)} ${(R * 0.6 * reach).toFixed(1)}px, ${hexA(C.ember, 0.16 * h)} ${(R * 1.1 * reach).toFixed(1)}px, ${hexA(C.ember, 0)} ${(R * 1.6 * reach).toFixed(1)}px)`,
            }}
          />
        ) : null}
        {flat > 0.001 ? <AbsoluteFill style={{ background: C.white, opacity: flat }} /> : null}
      </>
    );
  }

  /* ── the call's glow at the mark, handed over and cross-faded into the plate ── */
  const glowK = MARK_GLOW_HANDOFF * (1 - tween(t, T.plateIn, [0, 1], EASE.inOut));
  const S0 = glowK > 0.005 ? cardAt(t, G, L, T, MM) : null;

  const moon = planeToScreen(cams.night, L, G.moon, 0.6);

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {/* ── the room: the booking's own light in a warm near-black (over the call's emerald, which
           falls away with its orb) ── */}
      <AbsoluteFill style={{ opacity: roomOp < 0.999 ? roomOp : undefined }}>
        <EmberRoom
          light={{
            x: key.x,
            y: key.y,
            color: C.ember,
            strength: keyStrength,
            radius: keyRadius,
            aspect: keyAspect,
          }}
        />
      </AbsoluteFill>

      {/* ── the NIGHT half: the moon's room, falling in behind the seam ── */}
      {nightOn ? (
        <AbsoluteFill style={{ clipPath: nightClip }}>
          {nightIn > 0.001 ? (
            <AbsoluteFill style={{ opacity: nightIn < 0.999 ? nightIn : undefined }}>
              <NightRoom
                light={{
                  x: moon.x,
                  y: moon.y,
                  color: MOON_LIGHT,
                  strength: 0.2,
                  radius: L.pick(0.34, 0.24) * L.height,
                  chroma: 0.4,
                }}
                vignette={0.6}
              />
            </AbsoluteFill>
          ) : null}
          <AbsoluteFill style={layerStyle(cams.night, next.night, 0.4)}>
            <Stars t={t} stars={G.stars} locks={T.stars} />
          </AbsoluteFill>
          <AbsoluteFill style={layerStyle(cams.night, next.night, 0.6)}>
            <Moon t={t} x={G.moon.x} y={G.moon.y} d={G.moon.d} lock={T.moon} />
          </AbsoluteFill>
          {/* "Asleep." rises in the night half only */}
          {asleep}
          {dim > 0.002 ? <AbsoluteFill style={{ background: `rgba(5,4,8,${dim.toFixed(3)})` }} /> : null}
        </AbsoluteFill>
      ) : null}

      {/* ── 1.0 / 1.05 · the titles plane, UNDER the sheet while it recomposes ── */}
      {titlesUnder ? titles : null}

      {/* ── screen · Ava's "See you then!" (rides the cut, under the mark; the card lifts off
           above it and the sheet — 9:16: rising from below — passes in front of it) ── */}
      <SignOff t={t} />

      {/* ── 1.0 · the world ─────────────────────────────────────────── */}
      {S0 ? <MarkGlow x={S0.x} y={S0.y} fontSize={G.mark.fontSize} k={glowK} /> : null}
      {world}

      {/* ── 1.0 / 1.05 · the titles plane on top once the sheet is home ── */}
      {titlesUnder ? null : titles}

      {/* ── screen · the event opens up into the white act ─────────── */}
      {openEl}
    </AbsoluteFill>
  );
};
