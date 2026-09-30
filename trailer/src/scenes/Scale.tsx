/**
 * 19–24 s · SCALE — the white act (.pp.home-body stock).
 *
 *   t 0        CUT (hit.wav): white; the #use-cases tray is already rising
 *              and card 01 is mid-pop with the ring on it (both pre-rolled
 *              2–3 f, so the accent lands ON the downbeat); the wash blooms
 *              and bokeh fade in from nothing, the white stays continuous
 *   t 0…56     16 industries pop into their slots on 16th notes (scale .6→1,
 *              overshoot, rotation settle; icon / ordinal / label stagger);
 *              the electric ring glides along each row (fixed ~7 px
 *              overshoot, directional shutter blur) and re-pops on each new
 *              row; the camera starts close on the ring and pulls back
 *   t 53       "16 industries." rises (0.35 f letter cascade); grid ripple
 *   t 61…64    HOLD: the complete grid at rest under the finished title
 *   t 65…77    MORPH: the ring lets go; 10 cards peel off (3 f pull-in,
 *              accelerating out, smeared, steered clear of the heading);
 *              6 glide + resize into the language grid
 *   t 68…106   six languages on 8th notes — label, greeting in the cinema
 *              face (rise 8 px + blur 3 → 0); the ring re-pops on English
 *              and then glides / re-pops cell to cell; the AI-disclosure
 *              underline inks in under "an AI assistant" while English is
 *              live (74 → 79) and English never dims below 84 %
 *   t 110…118  the title rolls "14 languages." → "After the call." (the
 *              site's #after section name, so the flow is framed like every
 *              other section); five cells collapse into the deck at station 1
 *              while the Japanese line holds complete; at 115 it flies (fixed
 *              overshoot, directional blur, the ring rides it out) and lands
 *              on top as the call
 *   t 120/131/143  THE CALL → SLACK → CRM: plum fill + bead, nodes solid ON
 *              each cue, the last node green with a 2.8× ping — exactly at
 *              FLOW_END; from 128 the stage (not the heading) pushes in 4 %
 *              ABOUT FLOW_END (the node never moves) and hands the eye to the
 *              CTA's iris
 *
 * Parallax: wash blooms 0.2 · tray/cards/type 1.0 · lilac bokeh 1.4.
 */
import React from 'react';
import { AbsoluteFill, random, spring } from 'remotion';
import { Camera, Layer } from '../components/Camera';
import { useLayout, type Layout } from '../lib/layout';
import { aos, EASE, SPRING, tween, windowed } from '../lib/motion';
import { useSceneFrame } from '../lib/scene';
import { C } from '../theme';
import { b, FPS, SCALE } from '../timing';
import { Backdrop } from './scale/Backdrop';
import { Bokeh } from './scale/Bokeh';
import { Box, IndustryContent, LangContent, Slot } from './scale/Cards';
import { slide } from './scale/curves';
import { INDUSTRIES, LANGS } from './scale/data';
import { CallContent, Flow } from './scale/Flow';
import { centre, geo, mixRect, type Geo, type Rect } from './scale/geometry';
import { Heading } from './scale/Heading';
import { DirBlur, dirBlurRef, sigmaFor } from './scale/MotionBlur';
import { ringCentre, ringDraws, type RingStep } from './scale/ring';

// LOCAL TIMING - hoist into timing.ts
export const SCALE_LOCAL = {
  /** one industry pop per 16th note */
  pops: Array.from({ length: 16 }, (_, i) => Math.round(SCALE.industriesIn + i * SCALE.industryStep)),
  /** card 01 (and its ring) pop this many frames before the cut, the tray one
   *  more: t 0 (hit.wav) shows them mid-move instead of an empty white frame */
  preroll: 2,
  /** the camera pulls back from the montage close-up to rest */
  camPull: [b(0.25), b(4)] as const, // 4 → 60
  /** eyebrows in: "Same agent, your vocabulary" → "What the caller hears" */
  eyebrow: [b(0.15), b(4.8)] as const, // 2, 72
  /** …and out (fast; the next rises into a clear slot) */
  eyebrowOut: [b(4.4), b(7.3)] as const, // 66, 110
  /** "16 industries." → "14 languages." (a J-cut: the words follow the picture) */
  titleSwap: b(4.9), // 74
  /** the ring lets go of card 16 as the grid breaks */
  ringRelease: b(4.3), // 65
  /** the ten leaving cards peel off: pull-in from flyOut − flyAnticip, then accelerate out */
  flyOut: b(4.3), // 65
  flyAnticip: 3,
  flyStagger: 0.8,
  flyDur: 10,
  /** the six keepers glide + resize into the language grid */
  glide: b(4.3), // 65
  glideStagger: 1,
  /** one language per 8th note */
  langs: Array.from({ length: 6 }, (_, i) => Math.round(SCALE.langMorph + i * SCALE.langStep)),
  /** the AI-disclosure underline inks in under "an AI assistant", while English is live */
  disclose: [SCALE.langMorph + 6, SCALE.langMorph + 11] as const, // 74 → 79
  /** English dims only after its underline is drawn, and only to 84 % */
  englishDim: [SCALE.langMorph + 13, SCALE.langMorph + 23] as const, // 81 → 91
  /** the camera's slow push during the languages, released for the flow */
  push: [b(4), b(7.3), b(7.95)] as const, // 60, 110, 119
  /** "14 languages." leaves → "After the call." rolls in; five cells collapse into the deck; tray → after-call stage */
  titleOut: b(7.3), // 110
  titleAfter: b(7.4), // 111
  collapse: b(7.4), // 111
  collapseStagger: 0.5,
  /** the Japanese cell (complete) flies onto the deck and becomes the call;
   *  the ring lets go of it a frame before */
  carrierFly: b(7.65), // 115
  ringOut: b(7.6), // 114
  /** the dotted track + hollow nodes appear */
  trackIn: b(7.6), // 114
  /** the call card's number types in; its Booked pill pops */
  callIn: b(7.8), // 117
  pill: b(8.2), // 123
  /** station cues (= the flow cues in timing.ts): each node is solid ON its cue */
  stations: [0, 1, 2].map((i) => Math.round(SCALE.flow + i * SCALE.flowStep * 1.5)), // 120, 131, 143
  /** node fills start (the fill spring takes ~2–3 f) */
  fills: [b(7.85), b(8.6), b(9.35)] as const, // 118, 129, 140
  /** station labels / cards rise a beat-fraction before their node fills */
  cardsIn: [b(7.75), b(8.45), b(9.05)] as const, // 116, 127, 136
  /** the CRM's "200 OK" lands (green by 142) */
  ok: b(9.25), // 139
  /** plum fill segments (the bead reaches each node as it fills) */
  rails: [
    [b(8.05), b(8.6)],
    [b(8.75), b(9.35)],
  ] as const, // 121→129, 131→140
  /** the final node's ping ring (2.8×) */
  ping: [b(9.45), b(9.45) + b(1.6)] as const, // 142 → 166
  /** slow push-in of the stage about FLOW_END (zoom 1 → 1.04; the heading stays put) */
  flowPush: [b(8.55), b(10.8)] as const, // 128 → 162
} as const;
const K = SCALE_LOCAL;

/** A bouncier pop than the site spring: ~16 % overshoot (ζ ≈ .5). */
const POP = { stiffness: 360, damping: 17, mass: 0.8 };
/** Ring glides: along a montage row (3.75 f apart) and between language cells. */
const RING_ROW = { w: 1, z: 0.7, over: 7 };
const RING_CELL = { w: 0.8, z: 0.62, over: 10, anticip: 2, back: 8 };
/** The five cells into the deck, and the Japanese carrier's flight. */
const COLLAPSE = { w: 0.85, z: 0.6, over: 10, anticip: 4, back: 12 };
const CARRY = { w: 0.72, z: 0.62, over: 12, anticip: 3, back: 18 };

const inflate = (r: Rect, d: number): Rect => ({ x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d });
const dist = (a: Rect, bb: Rect) => Math.hypot(centre(bb).x - centre(a).x, centre(bb).y - centre(a).y);
const overlaps = (a: Rect, bb: Rect) => a.x < bb.x + bb.w && bb.x < a.x + a.w && a.y < bb.y + bb.h && bb.y < a.y + a.h;

/* ────────────────────────────────────────────────────────────────── */

const popStart = (i: number) => (i === 0 ? K.pops[0] - K.preroll : K.pops[i]);

function popAt(i: number, tt: number, cols: number) {
  const s0 = popStart(i);
  const rot0 = (random(`scale-pop-rot-${i}`) - 0.5) * 10;
  if (tt < s0) return { sc: 0.6, rot: rot0, dy: 22, o: 0, v: 0 };
  const p = spring({ frame: tt - s0, fps: FPS, config: POP });
  const pv = spring({ frame: Math.max(0, tt - s0 - 1), fps: FPS, config: POP });
  // the grid's settle ripple, from the top-left, as the title lands
  const r = Math.floor(i / cols);
  const c = i % cols;
  const w = tt - (SCALE.gridSettle + (r + c) * 0.8);
  const ripple = w <= 0 ? 0 : Math.sin((w / 6) * Math.PI) * Math.exp(-w / 5);
  return {
    sc: (0.6 + 0.4 * p) * (1 - 0.022 * ripple),
    rot: rot0 * (1 - p),
    dy: 22 * (1 - p),
    o: tween(tt, [s0, s0 + 2.5], [0, 1], EASE.out3),
    v: Math.abs(p - pv),
  };
}

/** Selection lift of industry card i during the montage. */
function liftAt(i: number, tt: number) {
  const on = tween(tt, [popStart(i), popStart(i) + 3], [0, 1], EASE.out3);
  const offAt = i < 15 ? K.pops[i + 1] : K.ringRelease;
  return on * (1 - tween(tt, [offAt, offAt + 4], [0, 1], EASE.house));
}

function glideAt(k: number, tt: number) {
  return aos(tt, K.glide + k * K.glideStagger, { anticip: 4, depth: 0.05, config: SPRING.site });
}
const collapseStart = (k: number) => (k === 5 ? K.carrierFly : K.collapse + k * K.collapseStagger);

function keeperRect(G: Geo, k: number, tt: number): Rect {
  const base = mixRect(G.cards[G.stay[k]], G.cells[k], glideAt(k, tt));
  const p = slide(tt - collapseStart(k), dist(base, G.stations[0]), k === 5 ? CARRY : COLLAPSE);
  return mixRect(base, G.stations[0], p);
}

/** The ring's steps: montage (slide along a row, pop on a new row) → release → languages → release. */
function ringSteps(G: Geo, L: Layout): RingStep[] {
  const cols = L.pick(4, 2);
  const lcols = L.pick(3, 2);
  const steps: RingStep[] = [{ kind: 'pop', at: popStart(0), to: () => inflate(G.cards[0], 7) }];
  for (let i = 1; i < 16; i++) {
    const to = () => inflate(G.cards[i], 7);
    const sameRow = Math.floor(i / cols) === Math.floor((i - 1) / cols);
    steps.push(sameRow ? { kind: 'slide', at: K.pops[i], to, opts: RING_ROW } : { kind: 'pop', at: K.pops[i], to });
  }
  steps.push({ kind: 'out', at: K.ringRelease, dur: 4 });
  for (let k = 0; k < 6; k++) {
    const to = (tt: number) => inflate(keeperRect(G, k, tt), 7);
    const sameRow = k > 0 && Math.floor(k / lcols) === Math.floor((k - 1) / lcols);
    steps.push(sameRow ? { kind: 'slide', at: K.langs[k], to, opts: RING_CELL } : { kind: 'pop', at: K.langs[k], to });
  }
  steps.push({ kind: 'out', at: K.ringOut, dur: 4, follow: true });
  return steps;
}

/**
 * Exit directions of the ten leaving cards: radial from the tray centre
 * (with jitter), rotated the least amount that keeps each path clear of the
 * heading block.
 */
function flyDirections(G: Geo, L: Layout, leaving: number[]) {
  const tc = centre(G.tray);
  const H: Rect = {
    x: G.head.x - 40,
    y: G.head.eyebrowY - 30,
    w: L.pick(860, 720),
    h: G.head.titleY + G.head.titleSize * 1.2 - G.head.eyebrowY + 60,
  };
  const dirs: Record<number, { x: number; y: number }> = {};
  for (const i of leaving) {
    const r = G.cards[i];
    const c = centre(r);
    const a0 = Math.atan2(c.y - tc.y, c.x - tc.x) + (random(`scale-fly-a-${i}`) - 0.5) * 0.5;
    const clear = (a: number) => {
      for (let d = 40; d <= 1900; d += 40) {
        const m = { ...r, x: r.x + Math.cos(a) * d, y: r.y + Math.sin(a) * d };
        if (overlaps(m, H)) return false;
      }
      return true;
    };
    let a = a0;
    for (let n = 1; n <= 12 && !clear(a); n++) {
      // try the side away from the heading first
      const away = c.x > H.x + H.w / 2 ? 1 : -1;
      const sgn = Math.sin(a0) < 0 ? away : -away;
      if (clear(a0 + sgn * 0.12 * n)) {
        a = a0 + sgn * 0.12 * n;
        break;
      }
      if (clear(a0 - sgn * 0.12 * n)) {
        a = a0 - sgn * 0.12 * n;
        break;
      }
    }
    dirs[i] = { x: Math.cos(a), y: Math.sin(a) };
  }
  return dirs;
}

/** A leaving card: pull-in (anticipation), then accelerate out along its direction. */
function flyAt(i: number, order: number, tt: number, u: { x: number; y: number }) {
  const s = K.flyOut + order * K.flyStagger;
  const A = K.flyAnticip;
  const pre = tt < s - A ? 0 : tt < s ? Math.sin(((tt - (s - A)) / A) * (Math.PI / 2)) : Math.max(0, 1 - (tt - s) / 3);
  const q = tween(tt, [s, s + K.flyDur], [0, 1], EASE.in2);
  const d = -14 * pre + q * 1900;
  const spin = (random(`scale-fly-r-${i}`) > 0.5 ? 1 : -1) * (8 + 10 * random(`scale-fly-rr-${i}`));
  return { x: u.x * d, y: u.y * d, rot: spin * q, sc: 1 - 0.03 * pre + 0.1 * q, q };
}

/* ────────────────────────────────────────────────────────────────── */

export const Scale: React.FC = () => {
  const t = useSceneFrame('scale');
  const L = useLayout();
  if (t < 0) return null;
  const G = geo(L);
  const cols = L.pick(4, 2);
  const pad = L.pick(24, 22);
  const cellPad = L.pick(34, 32);
  const greetSize = L.pick(60, 56);
  const steps = ringSteps(G, L);
  const Ls = K.langs;

  /* ── camera ─────────────────────────────────────────────────────── */
  const pull = tween(t, K.camPull, [0, 1], EASE.inOut);
  const zoomA = 0.13 * (1 - pull);
  let fx = 0;
  let fy = 0;
  const N = 12;
  for (let s = 0; s <= N; s++) {
    const c = ringCentre(steps, Math.max(-K.preroll, t - s));
    fx += c.x;
    fy += c.y;
  }
  fx /= N + 1;
  fy /= N + 1;
  const push = 0.022 * windowed(t, K.push[0], K.push[1], K.push[1], K.push[2], EASE.inOut, EASE.inOut);
  const cam = {
    x: (fx - L.cx) * zoomA * 1.35,
    y: (fy - L.cy) * zoomA * 1.35 + (centre(G.tray).y - L.cy) * push,
    zoom: 1 + zoomA + push,
  };
  // the flow push-in: the stage scales ABOUT FLOW_END, so the final node never
  // moves (the camera is at rest from t 119) and the eye is led to it
  const fz = 1 + 0.04 * tween(t, K.flowPush, [0, 1], EASE.inOut);
  const stagePush = fz > 1.00001 ? `scale(${fz.toFixed(5)})` : undefined;

  /* ── tray (home-rise, pre-rolled; becomes the after-call stage) ── */
  const rise = aos(t, -K.preroll - 1, { anticip: 0, depth: 0, config: SPRING.site });
  const toStage = aos(t, K.collapse, { anticip: 4, depth: 0.04, config: SPRING.site });
  const trayR = mixRect(G.tray, G.stage, toStage);
  const tc = centre(G.tray);
  const entrance = `translateY(${((1 - rise) * 40).toFixed(2)}px) scale(${(0.97 + 0.03 * rise).toFixed(4)})`;

  /* ── keepers / flyers ───────────────────────────────────────────── */
  const keeperOf = Array.from({ length: 16 }, (_, i) => G.stay.indexOf(i));
  const leaving = Array.from({ length: 16 }, (_, i) => i).filter((i) => keeperOf[i] < 0);
  // outermost first, with a little jitter so the peel never reads as a sweep
  const flyOrder = [...leaving].sort((a, bb) => {
    const da = Math.hypot(centre(G.cards[a]).x - tc.x, centre(G.cards[a]).y - tc.y) + random(`scale-fo-${a}`) * 240;
    const db = Math.hypot(centre(G.cards[bb]).x - tc.x, centre(G.cards[bb]).y - tc.y) + random(`scale-fo-${bb}`) * 240;
    return db - da;
  });
  const dirs = t >= K.flyOut - K.flyAnticip - 1 ? flyDirections(G, L, leaving) : null;

  const cardTransform = (i: number, tt: number) => {
    const pp = popAt(i, tt, cols);
    const lift = tt < K.ringRelease + 8 ? liftAt(i, tt) : 0;
    return { pp, lift, tf: `translateY(${(pp.dy - 5 * lift).toFixed(2)}px) rotate(${pp.rot.toFixed(3)}deg) scale(${pp.sc.toFixed(4)})` };
  };

  /* ── the ring ───────────────────────────────────────────────────── */
  const ringLift = t < K.ringRelease + 2 ? -5 : -4;
  const rings = ringDraws(steps, t);

  const flowT = {
    trackIn: K.trackIn,
    stations: K.stations,
    fills: K.fills,
    ok: K.ok,
    cardsIn: K.cardsIn,
    rails: K.rails,
    ping: K.ping,
  };

  return (
    <AbsoluteFill style={{ background: C.white, overflow: 'hidden' }}>
      <Camera x={cam.x} y={cam.y} zoom={cam.zoom}>
        {/* 0.2 · wash blooms */}
        <Layer depth={0.2}>
          <Backdrop t={t} L={L} />
        </Layer>

        {/* 1.0 · the tray, its cards, the ring, the rail, the heading */}
        <Layer depth={1}>
          <AbsoluteFill style={{ transform: stagePush, transformOrigin: `${G.end.x}px ${G.end.y}px` }}>
            <AbsoluteFill style={{ transform: entrance, transformOrigin: `${tc.x}px ${tc.y}px` }}>
              <div
                style={{
                  position: 'absolute',
                  left: trayR.x,
                  top: trayR.y,
                  width: trayR.w,
                  height: trayR.h,
                  borderRadius: 28 - 4 * Math.max(0, Math.min(1, toStage)),
                  background: C.chip,
                  boxShadow: '0 0 0 1px rgb(24 16 40 / 0.06), 0 30px 60px -40px rgb(24 16 40 / 0.35)',
                }}
              />

              {/* dashed slots, each inhales before its card pops in */}
              {t < K.pops[15] + 4
                ? G.cards.map((r, i) => (
                    <Slot
                      key={`slot-${i}`}
                      r={r}
                      inhale={tween(t, [popStart(i) - 3, popStart(i)], [0, 1], EASE.inOut)}
                      opacity={1 - tween(t, [popStart(i) + 1, popStart(i) + 3], [0, 1], EASE.out3)}
                    />
                  ))
                : null}

              {/* the ten leaving cards (under the keepers), with two smear copies */}
              {flyOrder.map((i, o) => {
                if (t < popStart(i)) return null;
                const u = dirs?.[i] ?? { x: 0, y: 0 };
                const f = flyAt(i, o, t, u);
                if (f.q >= 0.999) return null;
                const { pp, lift, tf } = cardTransform(i, t);
                const at = (tt: number) => {
                  const ff = flyAt(i, o, tt, u);
                  return `translate(${ff.x.toFixed(2)}px, ${ff.y.toFixed(2)}px) rotate(${ff.rot.toFixed(3)}deg) scale(${ff.sc.toFixed(4)})`;
                };
                const f1 = flyAt(i, o, t - 1, u);
                const speed = Math.hypot(f.x - f1.x, f.y - f1.y);
                const ghosts = speed > 10 ? [0.35, 0.7] : [];
                return (
                  <React.Fragment key={`fly-${i}`}>
                    {ghosts.map((d, gi) => (
                      <Box
                        key={gi}
                        r={G.cards[i]}
                        transform={at(t - d)}
                        opacity={[0.3, 0.14][gi]}
                        blur={Math.min(10, speed * 0.05)}
                        shadowAlpha={0.4}
                      >
                        <IndustryContent d={INDUSTRIES[i]} t={t} at={popStart(i)} pad={pad} still lite />
                      </Box>
                    ))}
                    <Box
                      r={G.cards[i]}
                      transform={`${at(t)} ${tf}`}
                      opacity={pp.o}
                      lift={lift}
                      blur={Math.min(8, speed * 0.04) + Math.min(2.5, pp.v * 7)}
                    >
                      {/* static (one span per line) once it is in flight: no snap is visible under the blur */}
                      <IndustryContent d={INDUSTRIES[i]} t={t} at={popStart(i)} pad={pad} still={f.q > 0} />
                    </Box>
                  </React.Fragment>
                );
              })}

              {/* the rail runs under the station cards */}
              <Flow t={t} G={G} vertical={L.vertical} T={flowT} part="rail" />

              {/* the six keepers: industry → language cell → (collapse) → the call */}
              {G.stay.map((i, k) => {
                if (t < popStart(i)) return null;
                const r = keeperRect(G, k, t);
                const gs = K.glide + k * K.glideStagger;
                const inGrid = t < gs - 1;
                const { pp, lift, tf } = cardTransform(i, t);
                const carrier = k === 5;
                const cs = collapseStart(k);
                const newest = t >= Ls[k] && (k === 5 || t < Ls[k + 1]) && t < cs;
                const langLift = t >= Ls[k] ? tween(t, [Ls[k], Ls[k] + 4], [0, 1]) * (k < 5 ? 1 - tween(t, [Ls[k + 1], Ls[k + 1] + 5], [0, 1]) : 1) : 0;
                const cLift = langLift * (1 - tween(t, [cs, cs + 5], [0, 1]));
                const dim =
                  k === 0
                    ? 1 - 0.16 * tween(t, K.englishDim, [0, 1], EASE.inOut)
                    : k < 5
                      ? 1 - 0.45 * tween(t, [Ls[k + 1], Ls[k + 1] + 8], [0, 1], EASE.inOut)
                      : 1;
                const langOut = carrier ? K.carrierFly - 1 : cs - 3;
                const hide = carrier ? 0 : tween(t, [K.stations[0] - 1, K.stations[0] + 3], [0, 1]);
                // directional shutter blur while the deck collapses (a 180° shutter)
                let blurF: string | undefined;
                let defs: React.ReactNode = null;
                if (t >= cs - 4 && t < cs + 12) {
                  const r0 = keeperRect(G, k, t - 0.5);
                  // capped: past ~30 px the card stops reading as a card
                  const sx = Math.min(30, sigmaFor(centre(r).x - centre(r0).x));
                  const sy = Math.min(30, sigmaFor(centre(r).y - centre(r0).y));
                  blurF = dirBlurRef(`scale-kb-${k}`, sx, sy);
                  if (blurF) defs = <DirBlur id={`scale-kb-${k}`} sx={sx} sy={sy} />;
                }
                return (
                  <React.Fragment key={`keep-${k}`}>
                    {defs}
                    <Box
                      r={r}
                      transform={inGrid ? tf : `translateY(${(-4 * cLift).toFixed(2)}px)`}
                      opacity={inGrid ? pp.o : 1 - hide}
                      lift={inGrid ? lift : cLift}
                      blur={inGrid ? Math.min(2.5, pp.v * 7) : 0}
                      filter={blurF}
                      z={carrier ? 2 : 1}
                    >
                      <IndustryContent
                        d={INDUSTRIES[i]}
                        t={t}
                        at={popStart(i)}
                        pad={pad}
                        still={t > gs - 3}
                        opacity={1 - tween(t, [gs - 1, gs + 3], [0, 1], EASE.in2)}
                        blur={tween(t, [gs - 1, gs + 3], [0, 5], EASE.in2)}
                      />
                      <LangContent
                        lang={LANGS[k]}
                        lines={(L.vertical && LANGS[k].linesV) || LANGS[k].lines}
                        t={t}
                        labelAt={gs + 2}
                        at={Ls[k]}
                        pad={cellPad}
                        fontSize={greetSize}
                        live={newest ? 1 : 0}
                        opacity={dim * (1 - tween(t, [langOut, langOut + (carrier ? 4 : 5)], [0, 1], EASE.in2))}
                        blur={tween(t, [langOut, langOut + 5], [0, 4], EASE.in2)}
                        underline={k === 0 ? tween(t, K.disclose, [0, 1], EASE.house) : 0}
                      />
                      {carrier ? <CallContent t={t} at={K.callIn} pill={K.pill} pad={L.pick(30, 36)} big={L.vertical} /> : null}
                    </Box>
                  </React.Fragment>
                );
              })}

              {/* the electric selection ring (directional shutter blur on glides) */}
              {rings.map((g) => {
                const id = `scale-ring-${g.key}`;
                const f = dirBlurRef(id, g.sx, g.sy);
                return (
                  <React.Fragment key={g.key}>
                    {f ? <DirBlur id={id} sx={g.sx} sy={g.sy} /> : null}
                    <div
                      style={{
                        position: 'absolute',
                        left: g.r.x,
                        top: g.r.y + ringLift,
                        width: g.r.w,
                        height: g.r.h,
                        borderRadius: 21.6 + 7,
                        border: `2px solid ${C.electric}`,
                        boxSizing: 'border-box',
                        opacity: g.o,
                        transform: g.sc !== 1 ? `scale(${g.sc.toFixed(4)})` : undefined,
                        boxShadow: '0 0 0 5px rgba(124,58,237,0.08), 0 0 34px rgba(124,58,237,0.20)',
                        filter: f,
                        zIndex: 3,
                      }}
                    />
                  </React.Fragment>
                );
              })}
            </AbsoluteFill>

            <Flow t={t} G={G} vertical={L.vertical} T={flowT} part="stations" />
          </AbsoluteFill>

          <Heading
            t={t}
            x={G.head.x}
            eyebrowY={G.head.eyebrowY}
            titleY={G.head.titleY}
            size={G.head.titleSize}
            T={{
              eyebrow: K.eyebrow,
              eyebrowOut: K.eyebrowOut,
              title: SCALE.industriesTitle,
              swap: K.titleSwap,
              out: K.titleOut,
              after: K.titleAfter,
            }}
          />
        </Layer>

        {/* 1.4 · soft lilac bokeh, nearest the lens (fades in after the cut) */}
        <Layer depth={1.4}>
          <Bokeh
            frame={t}
            width={L.width}
            height={L.height}
            seed="scale-bokeh"
            count={7}
            color="124,58,237"
            opacity={0.05}
            speed={0.7}
            size={[180, 380]}
            fade={tween(t, [0, 8], [0, 1], EASE.out3)}
          />
        </Layer>
      </Camera>
    </AbsoluteFill>
  );
};
