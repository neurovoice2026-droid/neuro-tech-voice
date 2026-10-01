/**
 * SCALE — the white act montage, 19.5 s (scale-local frames; every value from
 * SCALE / SCALE_LOCAL in timing.ts). Every business, every language, every
 * system — each with room to be read. ONE light leads at a time
 * (scale/lights.ts); the cards are white stock with ink labels, a card's
 * light lives only in its disc / hit flash / ring / sheen / small glow.
 *
 *   THE WALL (−4 … HERO)  out of the knowledge whip's clean white card 01
 *              fills the framing box, mid-pop, carrying the whip's momentum;
 *              the camera pulls back continuously (and breathes), always
 *              FRAMING THE CLUSTER popped so far with lead room for the next
 *              slot and ≥ 64 / 60 px margins (scale/camera.ts), as sixteen
 *              industries pop in the block order — eight on the 8th notes,
 *              eight on 16ths into the slam. Each pop: a 2 f inhale of the
 *              slot, .55 → 1.08 → 1 with a rotation settle, a shutter blur on
 *              the attack frame, and its hit in the hour's light (disc, flash
 *              pool, ripple, sparks, a glow under the card); the hour turns
 *              every four cards: rush → closing → sunday → night. The whole
 *              wall ends composed, with air around it
 *   THE HERO (HERO … langTitle, 2 s)  the wall racks back 2 f before the
 *              downbeat; "16 industries." SLAMS on it (+2.5 % kick that lets
 *              go slowly, the sixteen discs lock in the night light as a strum
 *              out from the title, a 2 f wash) and HOLDS ≈ 1.4 s, still and
 *              readable over the wall — which stays legible behind it (a light
 *              3.5 px defocus, 58 %), breathing, the night bloom breathing, a
 *              slow glint across "16" two beats in. Then fifteen cards peel
 *              off outwards, the keeper glides into the English card and turns
 *              to it, the title lifts to the band and "14 languages." rises
 *              into the slot as it leaves, landing ON langTitle
 *   THE LANGUAGES (langTitle … flow)  scale/Langs.tsx: English heard whole;
 *              the quick four slide in one per voice (1 – 1.25 s each), each
 *              showing only what is heard ("Sunt Ava," …), landing as light (a
 *              rim flare + a sheen, never a flood); Japanese whole; the room
 *              holds the hero's night (no rainbow); the gallery fills under
 *              the focus until all six are visible together
 *   THE FLOW (flow … irisToDark)  "After the call." rises as "14 languages."
 *              leaves; Japanese becomes THE CALL; a beat later it lights, then
 *              SLACK and CRM one per 2 beats, "Contact saved ✓" in the closing
 *              light; the finished rail holds ≈ 1.8 s (motes stream along it),
 *              framed with ≥ 110 / 70 px of air; the green node sits exactly
 *              at FLOW_END, where the CTA's iris opens (SCALE.irisToDark)
 *
 * Planes: the act's ground (screen space) · one bloom of the leading light
 * 0.4 · the cards / titles 1.0 · out-of-focus discs in the leading light 1.6.
 */
import React from 'react';
import { AbsoluteFill, random } from 'remotion';
import { Camera, Layer } from '../components/Camera';
import { useLayout } from '../lib/layout';
import { EASE, SPRING, tween } from '../lib/motion';
import { useSceneFrame } from '../lib/scene';
import { C, LIGHTS } from '../theme';
import { SCALE, SCALE_LOCAL } from '../timing';
import { Backdrop, Ground } from './scale/Backdrop';
import { NearDiscs } from './scale/Bokeh';
import { camAt, cameraProps, screenVel } from './scale/camera';
import { Box, flashAt, IndustryFace, popFill } from './scale/Cards';
import { dspring } from './scale/curves';
import { INDUSTRIES } from './scale/data';
import { Rail, StationCards, type FlowTiming } from './scale/Flow';
import { centre, geo, type Rect } from './scale/geometry';
import { Titles } from './scale/Heading';
import { LangCards } from './scale/Langs';
import { DirBlur, dirBlurRef, sigmaFor } from './scale/MotionBlur';
import { cardLight, HERO_LIGHT, rgba, roomColors, tintOf } from './scale/lights';

const K = SCALE_LOCAL;
const HERO = SCALE.industriesTitle;

/** the industry pop: k700 c17 m.6 (≈ .96 on the tick, 1.08 at +1…2, settled by +7) */
const POP = { stiffness: 700, damping: 17, mass: 0.6 };

/* ── industry pops ───────────────────────────────────────────────── */
const popStart = (i: number) => (i === 0 ? K.pops[0] - K.preroll : K.pops[i]);
/** the frame card i's disc flashes (its cue): card 01 pre-rolls, its tick is t 0 */
const tickOf = (i: number) => K.pops[i];

function popPose(i: number, tt: number, vertical: boolean) {
  const s = popStart(i);
  if (tt >= HERO) return { sc: 1, rot: 0, dx: 0, dy: 0 };
  const u = tt - s;
  const p = dspring(u + 1.75, POP);
  const q = dspring(u + 1, POP);
  const rot0 = (i % 2 === 0 ? 1 : -1) * (2.5 + 1.5 * random(`scale-rot-${i}`));
  // card 01 carries the knowledge whip's momentum (16:9 from the right, 9:16 from below)
  const m = i === 0 ? 60 * (1 - dspring(tt - s, SPRING.pop)) : 0;
  return {
    sc: 0.55 + 0.45 * p,
    rot: rot0 * (1 - tween(tt, [s, s + 4], [0, 1], EASE.out3)),
    dx: vertical ? 0 : m,
    dy: 30 * (1 - q) + (vertical ? m : 0),
  };
}
const poseCss = (p: { sc: number; rot: number; dx: number; dy: number }) =>
  p.sc === 1 && p.rot === 0 && p.dx === 0 && p.dy === 0
    ? undefined
    : `translate(${p.dx.toFixed(2)}px, ${p.dy.toFixed(2)}px) rotate(${p.rot.toFixed(3)}deg) scale(${p.sc.toFixed(4)})`;

/* ── the fifteen leaving cards ───────────────────────────────────── */
function flyAt(i: number, order: number, tt: number, u: { x: number; y: number }) {
  const s = K.flyOut + order * K.flyStagger;
  const A = K.flyAnticip;
  const pre = tt < s - A ? 0 : tt < s ? Math.sin(((tt - (s - A)) / A) * (Math.PI / 2)) : Math.max(0, 1 - (tt - s) / 3);
  const q = tween(tt, [s, s + K.flyDur], [0, 1], EASE.in2);
  const d = -14 * pre + q * 2300;
  const spin = (random(`scale-fly-r-${i}`) > 0.5 ? 1 : -1) * (8 + 10 * random(`scale-fly-rr-${i}`));
  return { x: u.x * d, y: u.y * d, rot: spin * q, sc: 1 - 0.03 * pre + 0.1 * q, q };
}

/* ────────────────────────────────────────────────────────────────── */

export const Scale: React.FC = () => {
  const t = useSceneFrame('scale');
  const L = useLayout();
  if (t < -K.preroll) return null;
  const v = L.vertical;
  const G = geo(L);

  /* ── camera ───────────────────────────────────────────────────── */
  const cam = camAt(t, G, L);

  /* ── the hero hit ─────────────────────────────────────────────── */
  // the wall racks back 2 f BEFORE the slam (already ≈ 55 % at its first glyph: no type over sharp labels)
  const dim = tween(t, [HERO - 2, HERO + 6], [0, 1], EASE.out3);
  const wash = t >= HERO && t < HERO + 2 ? (t < HERO + 1 ? 0.09 : 0.05) : 0;

  /* ── card metrics: labels 40 px (16:9) / 32 px (9:16) ─────────── */
  const ind = { pad: v ? 22 : 32, iconSize: v ? 58 : 62, labelSize: v ? 32 : 40 };

  /** the wall-phase filter of card i: the camera's pull (directional), the attack-frame shutter blur, the hero's defocus */
  const wallFilter = (i: number, id: string, extraBlur = 0): { f?: string; defs: React.ReactNode } => {
    const s = popStart(i);
    let sx = 0;
    let sy = 0;
    if (t < HERO - 2) {
      // the pull-back smears each card along its own screen path (a 180° shutter: half the frame's travel; layer px)
      const sv = screenVel(t, centre(G.cards[i]), G, L);
      sx = Math.min(8, 0.5 * sigmaFor(sv.vx)) / cam.s;
      sy = Math.min(8, 0.5 * sigmaFor(sv.vy)) / cam.s;
    }
    if (t >= s && t < s + 1 && t < HERO) {
      // 6 px shutter blur on the attack frame (screen px → layer px)
      const mom = i === 0 ? sigmaFor(60 * (dspring(t - s + 0.5, SPRING.pop) - dspring(t - s - 0.5, SPRING.pop))) : 0;
      sx = Math.max(sx, (v ? 1.6 : 1.6 + mom) / cam.s);
      sy = Math.max(sy, (v ? 6 + mom : 6) / cam.s);
    }
    sx = Math.min(sx, 14);
    sy = Math.min(sy, 14);
    const parts: string[] = [];
    let defs: React.ReactNode = null;
    const ref = dirBlurRef(id, sx, sy);
    if (ref) {
      parts.push(ref);
      defs = <DirBlur id={id} sx={sx} sy={sy} />;
    }
    if (extraBlur > 0.2) parts.push(`blur(${(extraBlur / cam.s).toFixed(2)}px)`);
    return { f: parts.length ? parts.join(' ') : undefined, defs };
  };

  /** the hero's lock strums out from the title (the wall centre): 0 → 4 f by distance */
  const wc = centre(G.wall);
  const far = Math.hypot(G.wall.w, G.wall.h) / 2;
  const lockDelay = (i: number) => (4 * Math.hypot(centre(G.cards[i]).x - wc.x, centre(G.cards[i]).y - wc.y)) / far;

  /* ── the fifteen that leave ───────────────────────────────────── */
  const leaving = Array.from({ length: 16 }, (_, i) => i).filter((i) => i !== G.keeper);
  const flyOrder = [...leaving].sort((a, bb) => {
    const da = Math.hypot(centre(G.cards[a]).x - wc.x, centre(G.cards[a]).y - wc.y) + random(`scale-fo-${a}`) * 240;
    const db = Math.hypot(centre(G.cards[bb]).x - wc.x, centre(G.cards[bb]).y - wc.y) + random(`scale-fo-${bb}`) * 240;
    return db - da;
  });
  const dirOf = (i: number) => {
    const c = centre(G.cards[i]);
    const a = Math.atan2(c.y - wc.y, c.x - wc.x) + (random(`scale-fly-a-${i}`) - 0.5) * 0.5;
    return { x: Math.cos(a), y: Math.sin(a) };
  };

  const flowT: FlowTiming = {
    trackIn: K.trackIn,
    stations: K.stations,
    fills: K.fills,
    cardsIn: K.cardsIn,
    rails: K.rails,
    ok: K.ok,
    ping: K.ping,
    stream: K.stream,
    moteDur: K.moteDur,
    callIn: K.callIn,
    pill: K.pill,
  };

  /** the slot's inhale before a pop: a soft shadow of the card-to-be and a point of its light (2 f) */
  const inhale = (i: number, r: Rect) => {
    const s = popStart(i);
    if (i === 0 || t < s - 2 || t >= s) return null;
    const p = (t - (s - 2)) / 2;
    const c = centre(r);
    const col = LIGHTS[cardLight(i)].orb[3];
    const w = r.w * (0.5 - 0.06 * p);
    const h = r.h * (0.5 - 0.06 * p);
    return (
      <div
        key={`inh-${i}`}
        style={{
          position: 'absolute',
          left: c.x - w / 2,
          top: c.y - h / 2,
          width: w,
          height: h,
          borderRadius: 18,
          background: `radial-gradient(closest-side, ${rgba(col, 0.55 * p)}, ${rgba(col, 0)})`,
          boxShadow: `0 10px 30px -14px rgba(24,16,40,${(0.25 * p).toFixed(3)})`,
        }}
      />
    );
  };

  /** one wall card: the pop, the hold, the hero's dim, then (unless it is the keeper) the peel-off */
  const wallCard = (i: number, o: number) => {
    if (t < popStart(i) - 2) return null;
    const r = G.cards[i];
    if (t < popStart(i)) return inhale(i, r);
    const keeper = i === G.keeper;
    if (keeper && t >= K.glide - 4) return null; // the English card (scale/Langs.tsx) takes it from here
    const u = dirOf(i);
    const f = keeper ? { x: 0, y: 0, rot: 0, sc: 1, q: 0 } : flyAt(i, o, t, u);
    if (f.q >= 0.999) return null;
    // once a flyer (and its trail) is wholly off the frame it costs nothing
    const offScreen = (dx: number, dy: number, sc: number) => {
      const c = centre(r);
      const rr = 0.75 * Math.hypot(r.w, r.h) * sc * cam.s + 40;
      const x = cam.ax + cam.s * (c.x + dx);
      const y = cam.ay + cam.s * (c.y + dy);
      return x + rr < 0 || x - rr > L.width || y + rr < 0 || y - rr > L.height;
    };
    const fg = keeper ? f : flyAt(i, o, t - 0.7, u);
    if (!keeper && offScreen(f.x, f.y, f.sc) && offScreen(fg.x, fg.y, fg.sc)) return null;
    const id = `scale-wc-${i}`;
    const at = (tt: number) => {
      const ff = flyAt(i, o, tt, u);
      return `translate(${ff.x.toFixed(2)}px, ${ff.y.toFixed(2)}px) rotate(${ff.rot.toFixed(3)}deg) scale(${ff.sc.toFixed(4)})`;
    };
    // the flight's shutter blur: half the frame's travel, along the flight (layer px)
    const f0 = keeper ? f : flyAt(i, o, t - 0.5, u);
    const f1 = keeper ? f : flyAt(i, o, t + 0.5, u);
    const w = wallFilter(i, id);
    let flyDefs: React.ReactNode = null;
    let flyF: string | undefined;
    if (!keeper && f.q > 0) {
      // slow (leaving): a true directional smear; fast: the GPU's blur (the card is a streak by then)
      const fx = 0.5 * sigmaFor(f1.x - f0.x);
      const fy = 0.5 * sigmaFor(f1.y - f0.y);
      if (Math.hypot(fx, fy) < 6) {
        flyF = dirBlurRef(id + '-f', fx, fy);
        if (flyF) flyDefs = <DirBlur id={id + '-f'} sx={fx} sy={fy} />;
      } else flyF = `blur(${Math.min(12, 0.6 * Math.hypot(fx, fy)).toFixed(2)}px)`;
    }
    const light = cardLight(i);
    const content = (still: boolean) => (
      <IndustryFace
        d={INDUSTRIES[i]}
        t={t}
        at={popStart(i)}
        tick={tickOf(i)}
        pad={ind.pad}
        iconSize={ind.iconSize}
        labelSize={ind.labelSize}
        light={light}
        lockAt={HERO}
        lockLight={HERO_LIGHT}
        lockDelay={lockDelay(i)}
        still={still || t > tickOf(i) + 12}
      />
    );
    // the hit's small glow under the card, in its light
    const k = flashAt(t, tickOf(i), 12);
    const glow = k > 0.01 ? `0 18px 60px -18px ${rgba(LIGHTS[light].orb[2], 0.6 * k)}, 0 0 40px -6px ${rgba(tintOf(light), 0.9 * k)}` : undefined;
    const moving = !keeper && t >= K.flyOut - K.flyAnticip;
    return (
      <React.Fragment key={`wc-${i}`}>
        {w.defs}
        {flyDefs}
        <Box
          r={r}
          transform={moving ? at(t) : poseCss(popPose(i, t, v))}
          bg={popFill(t, tickOf(i), light, 0.45)}
          glow={glow}
          filter={flyF ?? w.f}
          lift={f.q > 0 ? 0.6 : 0}
          z={t < tickOf(i) + 4 ? 2 : 1}
        >
          {content(false)}
        </Box>
      </React.Fragment>
    );
  };

  const fz = 1 + 0.03 * tween(t, K.flowPush, [0, 1], EASE.inOut);
  const stagePush = fz > 1.00001 ? `scale(${fz.toFixed(5)})` : undefined;
  const cp = cameraProps(cam, L);
  // the wall settles behind the hero: 1.5 % back about its centre
  const settle = 1 - 0.015 * dim;
  const wallOn = t < K.flyOut + K.flyDur + 16;
  // the hero's LIGHT defocus on the wall (the sixteen still read under the number: ≈ 3.5 px, labels at ≈ 40 %
  // contrast); as the cards peel off, their own motion blur takes over (a rack focus to the move)
  const defocus = 3.5 * dim * (1 - tween(t, [K.flyOut - K.flyAnticip, K.flyOut + 5], [0, 1], EASE.inOut));
  const wallFade = 1 - 0.42 * dim;

  return (
    <AbsoluteFill style={{ background: C.white, overflow: 'hidden' }}>
      {/* 0 · the act's ground: screen space, behind the camera */}
      <Ground t={t} />
      {/* the kicks' roll, about the screen centre (every plane alike) */}
      <AbsoluteFill style={{ transform: cp.rot ? `rotate(${cp.rot.toFixed(4)}deg)` : undefined }}>
        <Camera x={cp.x} y={cp.y} zoom={cp.zoom}>
          {/* 0.4 · the leading light's bloom + room shading */}
          <Layer depth={0.4}>
            <Backdrop t={t} L={L} />
          </Layer>

          {/* 1.0 · the wall → the languages → the flow (pushed about FLOW_END), then the titles */}
          <Layer depth={1}>
            <AbsoluteFill style={{ transform: stagePush, transformOrigin: `${G.end.x}px ${G.end.y}px`, zIndex: 0 }}>
              {wallOn ? (
                <AbsoluteFill
                  style={{
                    transform: settle < 0.99999 ? `scale(${settle.toFixed(5)})` : undefined,
                    transformOrigin: `${wc.x}px ${wc.y}px`,
                    // the hero's defocus: the whole wall at once (one filter, not sixteen)
                    opacity: dim > 0.001 ? wallFade : undefined,
                    filter: defocus > 0.2 ? `blur(${(defocus / cam.s).toFixed(2)}px)` : undefined,
                  }}
                >
                  {Array.from({ length: 16 }, (_, i) => wallCard(i, flyOrder.indexOf(i)))}
                </AbsoluteFill>
              ) : null}
              <Rail t={t} G={G} vertical={v} T={flowT} />
              <LangCards t={t} G={G} vertical={v} dim={dim} flowT={flowT} ind={ind} />
              <StationCards t={t} G={G} vertical={v} T={flowT} />
            </AbsoluteFill>
            <Titles
              t={t}
              T={{ hero: HERO, glint: K.heroGlint, swap: K.titleSwap, exit: K.titleExit, in: K.titleIn, out: K.titleOut, after: K.titleAfter }}
              hero={G.title.hero}
              band={G.title.band}
              after={G.title.after}
            />
          </Layer>

          {/* 1.6 · out-of-focus discs in the room's light, nearest the lens */}
          <Layer depth={1.6}>
            {roomColors(t, 2).map((c, ci) => (
              <NearDiscs key={ci} t={t} L={L} fade={c.w * tween(t, [0, 10], [0, 1], EASE.out3)} color={c.col} />
            ))}
          </Layer>
        </Camera>
      </AbsoluteFill>

      {/* the hero hit: a 2 f wash of the hero light over everything */}
      {wash > 0 ? <AbsoluteFill style={{ background: rgba(tintOf(HERO_LIGHT), wash) }} /> : null}
    </AbsoluteFill>
  );
};
