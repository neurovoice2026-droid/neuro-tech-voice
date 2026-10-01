/**
 * SCALE — the white act montage (scale-local frames; every value from
 * SCALE / SCALE_LOCAL in timing.ts). 24/7 = every hour has its own light,
 * and ONE light leads at a time (scale/lights.ts): after the night (hook →
 * result) and Sunday (knowledge), this act gives the RUSH the wall and JUST
 * AFTER CLOSING the languages and the flow — so the CTA gathers four lights
 * the film has each shown owning an hour.
 *
 *   t −3       out of the knowledge whip's clean white: card 01 fills the
 *              frame (≈ 3.9×), mid-pop, carrying the whip's momentum
 *   t 0…56     16 industries, one per 16th: every pop is a hit — opaque on
 *              its tick, .55 → .96 → 1.10 → 1 spring, ±4° and +30 px settle,
 *              a 6 px shutter blur on the attack frame; its icon disc lights
 *              in the rush light (rose, on the rush ground) with a flash pool,
 *              ripple and sparks, then settles to a neutral pearl disc — white
 *              cards, ink labels, the newest pop glows, the wall stays calm. On
 *              each quarter the cards already up pulse once, as a soft wave. The camera frames the block being filled —
 *              card 01 → 2 × 2 → 3 × 3 → the whole wall — and kicks on the grid
 *   t 60       "16 industries." SLAMS (hit.wav): +2.5 % kick, the 16 discs
 *              lock in the rush light as a strum out from the title ("16" in
 *              the rush ink), a 2 f wash, the wall dims to 40 % + 8 px blur
 *   t 66       thirteen cards peel off; three keepers glide into three big
 *              cells — and the title lifts to the top band WITH them, out of
 *              the cell band before any cell turns
 *   t 75/79/83 page 1: each cell flips (16:9 rotateY · 9:16 rotateX, shutter
 *              blur) to EN / RO / ES on its 16th; t 90/94/98 page 2: each flips
 *              again, one beat later, to FR / DE / JA. The whole greeting at
 *              84 px (16:9) / 80 px (9:16), its AI disclosure underlined, the
 *              cell's orb in the closing light. The room turns with them
 *              (SCALE_LOCAL.lightTurn 68 → 82): the rose drains to white stock
 *              and the closing ground floods in as English lands
 *   t 76…83    "16 industries." exits up out of its mask (2 f dip, 4 f exit,
 *              ghost blur); "14 languages." rises into it 1 f after
 *   t 109…116  "14 languages." exits the same way; the two other cells
 *              collapse into the deck; the Japanese cell flies onto it and
 *              becomes THE CALL; "After the call." rises
 *   t 120/128/135  THE CALL → SLACK → CRM: big cards that fill the frame,
 *              nodes solid ON the cues (1.35 → 1, 2.5× ping, a 1 % nudge toward
 *              each); the green CRM node sits exactly at FLOW_END; from 128 the
 *              stage (not the heading) pushes in 4 % about FLOW_END for the
 *              CTA's iris
 *
 * Planes: the act's ground (screen space) · one bloom of the leading light
 * 0.4 · the wall / cells / flow 1.0 (+ titles) · out-of-focus discs in the
 * leading light 1.6.
 */
import React from 'react';
import { AbsoluteFill, random } from 'remotion';
import { Camera, Layer } from '../components/Camera';
import { useLayout } from '../lib/layout';
import { aos, EASE, SPRING, tween } from '../lib/motion';
import { useSceneFrame } from '../lib/scene';
import { C } from '../theme';
import { SCALE, SCALE_LOCAL } from '../timing';
import { Backdrop, Ground } from './scale/Backdrop';
import { NearDiscs } from './scale/Bokeh';
import { camAt, cameraProps, stepSpeed } from './scale/camera';
import { Box, IndustryFace, LangFace, popFill } from './scale/Cards';
import { dspring, slide } from './scale/curves';
import { INDUSTRIES, LANGS } from './scale/data';
import { Rail, StationCards, StationFace, type FlowTiming } from './scale/Flow';
import { centre, geo, mixRect, type Geo, type Rect } from './scale/geometry';
import { Titles } from './scale/Heading';
import { DirBlur, dirBlurRef, sigmaFor } from './scale/MotionBlur';
import { bodyOf, cardLight, FLOW_LIGHT, HERO_LIGHT, LANG_LIGHT, leadColors, litFill, rgba, tintOf } from './scale/lights';

const K = SCALE_LOCAL;
const HERO = SCALE.industriesTitle;

/** the industry pop: k700 c17 m.6 (≈ .96 on the tick, 1.10 at +1…2, settled by +7) */
const POP = { stiffness: 700, damping: 17, mass: 0.6 };
/** the language flip: ~6 f to 180°, a 3 % overshoot */
const FLIP = { stiffness: 234, damping: 19.2, mass: 0.7 };
/** the five cells into the deck, and the Japanese carrier's flight (fixed-px overshoot) */
const COLLAPSE = { w: 0.85, z: 0.6, over: 10, anticip: 4, back: 12 };
const CARRY = { w: 0.86, z: 0.62, over: 12, anticip: 3, back: 18 };

const dist = (a: Rect, bb: Rect) => Math.hypot(centre(bb).x - centre(a).x, centre(bb).y - centre(a).y);

/* ── industry pops ───────────────────────────────────────────────── */
const popStart = (i: number) => (i === 0 ? K.pops[0] - K.preroll : K.pops[i]);
/** the frame card i's icon flashes (its cue): card 01 pre-rolls, its tick is t 0 */
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
    rot: rot0 * (1 - tween(tt, [s, s + 3], [0, 1], EASE.out3)),
    dx: vertical ? 0 : m,
    dy: 30 * (1 - q) + (vertical ? m : 0),
  };
}
const poseCss = (p: { sc: number; rot: number; dx: number; dy: number }) =>
  p.sc === 1 && p.rot === 0 && p.dx === 0 && p.dy === 0
    ? undefined
    : `translate(${p.dx.toFixed(2)}px, ${p.dy.toFixed(2)}px) rotate(${p.rot.toFixed(3)}deg) scale(${p.sc.toFixed(4)})`;

/* ── keepers ─────────────────────────────────────────────────────── */
const glideStart = (k: number) => K.glide + k * K.glideStagger;
const glideAt = (k: number, tt: number) => aos(tt, glideStart(k), { anticip: 4, depth: 0.05, config: SPRING.site });
/** the last cell (Spanish → Japanese) carries on: it becomes THE CALL */
const CARRIER = 2;
const collapseStart = (k: number) => (k === CARRIER ? K.carrierFly : K.collapse + k * K.collapseStagger);

function keeperRect(G: Geo, k: number, tt: number): Rect {
  const base = mixRect(G.cards[G.stay[k]], G.cells[k], glideAt(k, tt));
  const p = slide(tt - collapseStart(k), dist(base, G.stations[0]), k === CARRIER ? CARRY : COLLAPSE);
  return mixRect(base, G.stations[0], p);
}

/** one half-turn (deg): a 2 f −8° anticipation, then −8 → 180 on FLIP */
function halfTurn(L0: number, tt: number) {
  if (tt < L0 - 2) return 0;
  if (tt < L0) return -8 * Math.sin(((tt - (L0 - 2)) / 2) * (Math.PI / 2));
  return -8 + 188 * dspring(tt - L0 + 0.6, FLIP);
}
/** cell k turns twice: industry → language k (page 1) → language k + 3 (page 2), one beat apart */
const flipAngle = (k: number, tt: number) => halfTurn(K.langs[k], tt) + halfTurn(K.langs[k + 3], tt);
/** which language a cell shows at angle a (−1: still the industry face) */
const pageOf = (k: number, a: number) => (a < 90 ? -1 : a < 270 ? k : k + 3);

/* ── the ten leaving cards ───────────────────────────────────────── */
function flyAt(i: number, order: number, tt: number, u: { x: number; y: number }) {
  const s = K.flyOut + order * K.flyStagger;
  const A = K.flyAnticip;
  const pre = tt < s - A ? 0 : tt < s ? Math.sin(((tt - (s - A)) / A) * (Math.PI / 2)) : Math.max(0, 1 - (tt - s) / 3);
  const q = tween(tt, [s, s + K.flyDur], [0, 1], EASE.in2);
  const d = -14 * pre + q * 2100;
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
  // velocity blur on the wall during the camera steps (≤ 5 px on screen)
  const sp = t < K.camSteps[2][1] + 1 ? stepSpeed(t, G, L) : 0;
  const stepBlur = Math.min(5, sp / 25);

  /* ── the hero hit ─────────────────────────────────────────────── */
  const dim = tween(t, [HERO, HERO + 6], [0, 1], EASE.out3);
  const wash = t >= HERO && t < HERO + 2 ? (t < HERO + 1 ? 0.09 : 0.05) : 0;

  /* ── card metrics ─────────────────────────────────────────────── */
  const ind = { pad: v ? 24 : 32, iconSize: v ? 72 : 80, labelSize: v ? 30 : 40 };
  // the greetings at reading size: 84 px (16:9) / 80 px (9:16), labels 30 / 28
  const cell = { pad: v ? 26 : 32, labelSize: v ? 28 : 30, size: v ? 80 : 84, orb: v ? 104 : 168 };

  /** the wall-phase filter of card i: attack-frame shutter blur, step blur, hero blur */
  const wallFilter = (i: number, id: string, extraBlur = 0): { f?: string; defs: React.ReactNode } => {
    const s = popStart(i);
    let defs: React.ReactNode = null;
    const parts: string[] = [];
    if (t >= s && t < s + 1 && t < HERO) {
      // 6 px shutter blur on the attack frame (screen px → layer px)
      const mom = i === 0 ? sigmaFor(60 * (dspring(t - s + 0.5, SPRING.pop) - dspring(t - s - 0.5, SPRING.pop))) : 0;
      const sx = (v ? 1.6 : 1.6 + mom) / cam.s;
      const sy = (v ? 6 + mom : 6) / cam.s;
      const ref = dirBlurRef(id, sx, sy);
      if (ref) {
        parts.push(ref);
        defs = <DirBlur id={id} sx={sx} sy={sy} />;
      }
    }
    const b = stepBlur + 8 * dim + extraBlur;
    if (b > 0.2) parts.push(`blur(${(b / cam.s).toFixed(2)}px)`);
    return { f: parts.length ? parts.join(' ') : undefined, defs };
  };

  /** the hero's lock strums out from the title (the wall centre): 0 → 4 f by distance */
  const wc0 = centre(G.wall);
  const far = Math.hypot(G.wall.w, G.wall.h) / 2;
  const lockDelay = (i: number) => (4 * Math.hypot(centre(G.cards[i]).x - wc0.x, centre(G.cards[i]).y - wc0.y)) / far;

  /* ── keepers / flyers ─────────────────────────────────────────── */
  const keeperOf = Array.from({ length: 16 }, (_, i) => G.stay.indexOf(i));
  const leaving = Array.from({ length: 16 }, (_, i) => i).filter((i) => keeperOf[i] < 0);
  const wc = centre(G.wall);
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
    callIn: K.callIn,
    pill: K.pill,
  };

  /* ── one keeper (industry card → language cell → page 2 → deck) ─── */
  const keeper = (k: number) => {
    const i = G.stay[k];
    if (t < popStart(i)) return null;
    const carrier = k === CARRIER;
    const gs = glideStart(k);
    const r = t < gs - 4 ? G.cards[i] : keeperRect(G, k, t);
    const a = flipAngle(k, t);
    const page = pageOf(k, a);
    const cs = collapseStart(k);
    const hide = carrier ? 0 : tween(t, [K.stations[0] - 1, K.stations[0] + 3], [0, 1]);
    if (hide >= 1) return null;
    const id = `scale-kp-${k}`;
    let filter: string | undefined;
    let defs: React.ReactNode = null;
    let transform: string | undefined;
    let opacity = 1 - hide;
    let bg: string = C.white;
    let ring: string | undefined;
    let lift = 0;
    let z = 1;
    let face: React.ReactNode;
    // the flip's shutter blur: the card's width collapses/opens fast mid-turn
    // 16:9 tall columns turn about their vertical axis; 9:16 wide rows flip about the horizontal one (a split-flap)
    const axis = v ? 'X' : 'Y';
    const flipS = Math.abs(Math.cos((flipAngle(k, t + 0.5) * Math.PI) / 180) - Math.cos((flipAngle(k, t - 0.5) * Math.PI) / 180)) * ((v ? r.h : r.w) / 2);
    const fs = Math.min(14, sigmaFor(flipS));

    if (t < HERO) {
      // the wall: the pop
      const w = wallFilter(i, id);
      filter = w.f;
      defs = w.defs;
      transform = poseCss(popPose(i, t, v));
      bg = popFill(t, tickOf(i), cardLight(i), 0.4);
    } else if (page < 0) {
      // dimmed industry front: .4 on the hit → .6 over the glide → 1 as it turns
      const up = tween(t, [gs, gs + 10], [0, 1], EASE.inOut);
      const turn = tween(t, [K.langs[k] - 2, K.langs[k]], [0, 1], EASE.out3);
      opacity *= (1 - 0.6 * dim + 0.2 * up) * (1 - turn) + turn;
      const blurPx = (8 * dim - 5.5 * up) * (1 - turn);
      const fx = v ? 0 : fs;
      const fy = v ? fs : 0;
      const ref = dirBlurRef(id, fx, fy);
      if (ref) defs = <DirBlur id={id} sx={fx} sy={fy} />;
      filter = [ref, blurPx > 0.2 ? `blur(${(blurPx / cam.s).toFixed(2)}px)` : ''].filter(Boolean).join(' ') || undefined;
      transform = a !== 0 ? `perspective(1600px) rotate${axis}(${a.toFixed(3)}deg)` : undefined;
      if (a > 0) z = 2;
    } else {
      // a language face (page 1 on the back, page 2 on the front again)
      let sx = v ? 0 : fs;
      let sy = v ? fs : 0;
      // collapse / carrier flight: a directional shutter blur along the move
      if (t >= cs - 4 && t < cs + 14) {
        const r0 = keeperRect(G, k, t - 0.5);
        sx = Math.max(sx, Math.min(30, sigmaFor(centre(r).x - centre(r0).x)));
        sy = Math.max(sy, Math.min(30, sigmaFor(centre(r).y - centre(r0).y)));
      }
      const ref = dirBlurRef(id, sx, sy);
      if (ref) defs = <DirBlur id={id} sx={sx} sy={sy} />;
      filter = ref;
      const ra = a - (page === k ? 180 : 360);
      transform = Math.abs(ra) > 0.01 ? `perspective(1600px) rotate${axis}(${ra.toFixed(3)}deg)` : undefined;
      const L0 = K.langs[page];
      const firstFrame = pageOf(k, flipAngle(k, t - 1)) !== page;
      // the live cell: lit from its landing until the next flip lands (or the collapse)
      const nextLive = page + 1 < 6 ? K.langs[page + 1] : K.collapse;
      const live = t < nextLive + 3 && t < cs;
      if (firstFrame) bg = litFill(LANG_LIGHT, 1.1);
      if (carrier && t >= K.stations[0]) bg = popFill(t, K.stations[0], FLOW_LIGHT);
      if (live) ring = rgba(bodyOf(LANG_LIGHT), 0.7 * tween(t, [L0, L0 + 3], [0, 1], EASE.out3));
      z = t < L0 + 8 ? 2 : 1;
      if (t >= cs - 4) {
        lift = carrier ? tween(t, [cs - 3, cs + 4], [0, 1], EASE.out3) * (1 - tween(t, [cs + 6, cs + 14], [0, 1], EASE.inOut)) : 0.4;
        z = carrier ? 4 : 1;
      }
    }

    if (t < HERO || page < 0) {
      face = (
        <IndustryFace
          d={INDUSTRIES[i]}
          t={t}
          at={popStart(i)}
          tick={tickOf(i)}
          pad={ind.pad}
          iconSize={ind.iconSize}
          labelSize={ind.labelSize}
          light={cardLight(i)}
          lockAt={HERO}
          lockLight={HERO_LIGHT}
          lockDelay={lockDelay(i)}
          beats={K.beats}
          beatLights={K.wallLights.slice(1)}
          still={t > tickOf(i) + 12}
        />
      );
    } else {
      const langOut = carrier
        ? tween(t, [K.carrierFly - 1, K.carrierFly + 3], [0, 1], EASE.in2)
        : tween(t, [cs + 2, cs + 6], [0, 1], EASE.inOut); // the deck under THE CALL is blank stock
      const callIn = carrier ? tween(t, [K.callIn - 1, K.callIn + 2], [0, 1], EASE.out3) : 0;
      const lg = LANGS[page];
      face = (
        <>
          {langOut < 1 ? (
            <div style={{ position: 'absolute', inset: 0, opacity: 1 - langOut }}>
              <LangFace
                lang={lg}
                set={v ? lg.v : lg.h}
                t={t}
                at={K.langs[page]}
                pad={cell.pad}
                labelSize={cell.labelSize}
                size={lg.size ? (v ? lg.size[1] : lg.size[0]) : cell.size}
                underline={tween(t, K.disclose[page], [0, 1], EASE.house)}
                light={LANG_LIGHT}
                orbSize={cell.orb}
                w={r.w}
              />
            </div>
          ) : null}
          {callIn > 0 ? (
            <div style={{ position: 'absolute', inset: 0, opacity: callIn }}>
              <StationFace i={0} t={t} T={flowT} vertical={v} />
            </div>
          ) : null}
        </>
      );
    }
    return (
      <React.Fragment key={`keep-${k}`}>
        {defs}
        <Box r={r} transform={transform} opacity={opacity} lift={lift} bg={bg} ring={ring} z={z} filter={filter}>
          {face}
        </Box>
      </React.Fragment>
    );
  };

  /* ── one leaving card (the wall, then the peel-off) ────────────── */
  const flyer = (i: number, o: number) => {
    if (t < popStart(i)) return null;
    const u = dirOf(i);
    const f = flyAt(i, o, t, u);
    if (f.q >= 0.999) return null;
    // once a flyer (and its ghosts, which trail it) is wholly off the frame it costs nothing
    const offScreen = (dx: number, dy: number, sc: number) => {
      const c = centre(G.cards[i]);
      const rr = 0.75 * Math.hypot(G.cards[i].w, G.cards[i].h) * sc * cam.s + 40;
      const x = cam.ax + cam.s * (c.x + dx);
      const y = cam.ay + cam.s * (c.y + dy);
      return x + rr < 0 || x - rr > L.width || y + rr < 0 || y - rr > L.height;
    };
    const fg = flyAt(i, o, t - 0.7, u);
    if (offScreen(f.x, f.y, f.sc) && offScreen(fg.x, fg.y, fg.sc)) return null;
    const id = `scale-fl-${i}`;
    const at = (tt: number) => {
      const ff = flyAt(i, o, tt, u);
      return `translate(${ff.x.toFixed(2)}px, ${ff.y.toFixed(2)}px) rotate(${ff.rot.toFixed(3)}deg) scale(${ff.sc.toFixed(4)})`;
    };
    const f1 = flyAt(i, o, t - 1, u);
    const speed = Math.hypot(f.x - f1.x, f.y - f1.y);
    const w = wallFilter(i, id, Math.min(10, speed * 0.05));
    const content = (ghost: boolean) => (
      <IndustryFace
        d={INDUSTRIES[i]}
        t={t}
        at={popStart(i)}
        tick={tickOf(i)}
        pad={ind.pad}
        iconSize={ind.iconSize}
        labelSize={ind.labelSize}
        light={cardLight(i)}
        lockAt={HERO}
        lockLight={HERO_LIGHT}
        lockDelay={lockDelay(i)}
        beats={K.beats}
        beatLights={K.wallLights.slice(1)}
        still={ghost || t > tickOf(i) + 12}
        accents={!ghost}
      />
    );
    const op = 1 - 0.6 * dim;
    return (
      <React.Fragment key={`fly-${i}`}>
        {w.defs}
        {speed > 10
          ? [0.35, 0.7].map((d, gi) => (
              <Box key={gi} r={G.cards[i]} transform={at(t - d)} opacity={op * [0.3, 0.14][gi]} shadowAlpha={0.4} filter={`blur(${(Math.min(12, speed * 0.06) + 8 * dim).toFixed(2)}px)`}>
                {content(true)}
              </Box>
            ))
          : null}
        <Box
          r={G.cards[i]}
          transform={t < K.flyOut - K.flyAnticip ? poseCss(popPose(i, t, v)) : at(t)}
          opacity={op}
          bg={popFill(t, tickOf(i), cardLight(i), 0.4)}
          filter={w.f}
          lift={f.q > 0 ? 0.6 : 0}
        >
          {content(false)}
        </Box>
      </React.Fragment>
    );
  };

  const fz = 1 + 0.04 * tween(t, K.flowPush, [0, 1], EASE.inOut);
  const stagePush = fz > 1.00001 ? `scale(${fz.toFixed(5)})` : undefined;
  const cp = cameraProps(cam, L);

  return (
    <AbsoluteFill style={{ background: C.white, overflow: 'hidden' }}>
      {/* 0 · the act's ground (the rush, then the closing light): screen space, behind the camera */}
      <Ground t={t} />
      {/* the quarter kicks' roll, about the screen centre (every plane alike) */}
      <AbsoluteFill style={{ transform: cp.rot ? `rotate(${cp.rot.toFixed(4)}deg)` : undefined }}>
      <Camera x={cp.x} y={cp.y} zoom={cp.zoom}>
        {/* 0.4 · the leading light's bloom + room shading */}
        <Layer depth={0.4}>
          <Backdrop t={t} L={L} />
        </Layer>

        {/* 1.0 · the wall → cells → flow (pushed about FLOW_END), then the titles */}
        <Layer depth={1}>
          <AbsoluteFill style={{ transform: stagePush, transformOrigin: `${G.end.x}px ${G.end.y}px`, zIndex: 0 }}>
            {flyOrder.map((i, o) => flyer(i, o))}
            {[0, 1].map((k) => keeper(k))}
            <Rail t={t} G={G} vertical={v} T={flowT} />
            {keeper(CARRIER)}
            <StationCards t={t} G={G} vertical={v} T={flowT} />
          </AbsoluteFill>
          <Titles
            t={t}
            T={{ hero: HERO, swap: K.titleSwap, exit: K.titleExit, in: K.titleIn, out: K.titleOut, after: K.titleAfter }}
            hero={G.title.hero}
            band={G.title.band}
            after={G.title.after}
          />
        </Layer>

        {/* 1.6 · out-of-focus discs in the leading light, nearest the lens */}
        <Layer depth={1.6}>
          {leadColors(t, 2).map((c, ci) => (
            <NearDiscs key={ci} t={t} L={L} fade={c.w * tween(t, [0, 10], [0, 1], EASE.out3)} color={c.col} />
          ))}
        </Layer>
      </Camera>
      </AbsoluteFill>

      {/* the hero hit: a 2 f wash of the rush light over everything */}
      {wash > 0 ? <AbsoluteFill style={{ background: rgba(tintOf(HERO_LIGHT), wash) }} /> : null}
    </AbsoluteFill>
  );
};
