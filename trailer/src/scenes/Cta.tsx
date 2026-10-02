/**
 * CTA (the last 11 s) — Ava's voice-over; the four lights become one; the
 * wordmark; then an end card that builds CALMLY, one element at a time
 * (client: "the ending is too fast"). Every frame below is CTA-local and comes
 * from timing.ts (CTA, CTA_LOCAL), which derives the converge, the impact and
 * the end card from her real voice. Every value is a continuous function of
 * the fractional timeline time (the master renders at 120 fps): no motion
 * blur, no ghost copies, no per-frame randomness.
 *
 *   iris      a dark circle opens from FLOW_END (the scale's last node), a
 *             crisp hairline of lilac on its edge
 *   0…24      HER: the site's cover portrait out of black — the eyes first (a
 *             slow push-in, a catch-light as the iris completes and another ON
 *             her first word), then a soft radial opening. She stands in a
 *             NIGHT ROOM: the art's cream backlight is replaced by one clean,
 *             motivated key behind her head (heroShader.ts, the room)
 *   line      Ava: "AI voice agents that book your customers. Twenty four
 *             seven." — the statement set like the knowledge heading
 *             (Instrument Sans display, "24/7." in the night's lilac), each
 *             word rising out of its mask ON its spoken word
 *   orbPops   THE FOUR LIGHTS, ONE AT A TIME — rush, closing, sunday, night,
 *             a turn of two beats each (orbit.ts): a point of its light gathers
 *             (3 f), ON the beat the orb springs out of it beside her face (its
 *             light up with a short attack — a bloom, never a one-frame strobe),
 *             KEYS her face from its side (its spill the only colour on her),
 *             then draws back into a point and goes out before the next one
 *             gathers. The night stays. The room's key steps down so the light
 *             in turn leads
 *   tighten   ON "Twenty" "four" "seven" the light in turn answers each word
 *             (a lift of its light, with an attack)
 *   converge  the words leave up through their masks; the light closes on her
 *             from the edges in (the opening, played backwards), her eyes
 *             last — their light lifts out as two points of lilac that slide
 *             into the core; the three that went out come back — all four
 *             together only now — at four arms, swell (anticipation) and
 *             spiral into the core, accelerating
 *   merge     each keeps its own light until they touch; the three pour into
 *             the survivor, which holds ALONE, its bloom carrying all four
 *             (every bloom slot belongs to one light, always: continuous)
 *   impact    the survivor gives its light away: a short white burst and the
 *             merged light opens OUT of the core as a wide, filled BACKLIGHT
 *             behind the word — NEUROVOICE (the site's header wordmark) in dark
 *             ink on its light, rising letter by letter from the centre out as
 *             the light reaches it; then the four lights come up as the colour
 *             of its rim (as the crown-logo end card was)
 *   brand     Ava: "Neuro Tech Voice." a beat after the impact; the URL rises
 *             ON her words ("neuro" | "tech" | "voice.com"); the site's
 *             "Start free →" (the header's button) rises once it is in; the
 *             note follows, word by word; then the press (the site's hover —
 *             plum, paper label, the arrow .2em — then .97 and back)
 *   finalHold → end: dead still — nothing moves but the global grain; over
 *             the master's fade (MIX.fadeOut) the light goes out with the
 *             chord, on the same curve, and the film ends on the night
 *
 * ONE WebGL context: HeroGL draws the portrait, the room, the four orbs and
 * the merged light.
 */
import React, { useEffect, useRef, useState } from 'react';
import { AbsoluteFill, cancelRender, continueRender, delayRender } from 'remotion';
import './cta/font/wordmark.css';
import { Camera, camMoving, Layer, useGlide } from '../components/Camera';
import { flowTime, seedTime } from '../components/Orb';
import type { OrbDraw } from '../components/orbGL';
import { glideStyle } from '../lib/glide';
import { FLOW_END } from '../lib/handoff';
import { useLayout, type Layout } from '../lib/layout';
import { ALL_GLOW, GLOW, fromOklch, hexToRgb, inkFor, mixColor, toOklch } from '../lib/lights';
import { EASE, mix, SPRING, springUnit, tween, windowed } from '../lib/motion';
import { useSceneFrame } from '../lib/scene';
import { C, LIGHTS, LIGHT_ORDER } from '../theme';
import { b, CTA, CTA_LOCAL, MIX, SCENES, vWord } from '../timing';
import { Note, StartFree, Url, Wordmark, WORDMARK_FONT, WORDMARK_INK, WORDMARK_TEXT, type Rest } from './cta/EndCard';
import { Headline, type HeadlineSpec } from './cta/Headline';
import { HERO_ART, HeroGL, type HeroOrbs, type HeroUniforms } from './cta/HeroGL';
import { brandEnv, hit, lineEnv, orbsAt, radiusAt, spinTable } from './cta/orbit';

const K = CTA_LOCAL;
const I = CTA.logoImpact;

/**
 * THE END: the wordmark's light goes out WITH its chord. The master fades over MIX.fadeOut
 * (exponential, fadeK nepers, offset to land on true zero — scripts/audio/mix.mjs); the picture
 * reads the same window and the same curve, taking the audio gain as the light's intensity
 * (linear light, so ^(1/2.2) on screen): the card holds, sinks, and the film ends on the night,
 * frame-for-frame with the silence. (An end-of-film fade, not a scene transition.)
 */
const END_FADE = [MIX.fadeOut[0] - SCENES.cta.from, MIX.fadeOut[1] - SCENES.cta.from] as const;
function endLight(t: number) {
  if (t <= END_FADE[0]) return 1;
  const u = Math.min(1, (t - END_FADE[0]) / Math.max(1, END_FADE[1] - 1 - END_FADE[0]));
  const z = Math.exp(-MIX.fadeK);
  const g = Math.max(0, (Math.exp(-MIX.fadeK * u) - z) / (1 - z));
  return Math.pow(g, 1 / 2.2);
}

/** Pin a residual to its exact rest value by the final hold (eased over K.settle). */
const rest: Rest = (t, v, target) => {
  if (t >= K.settle[1]) return target;
  if (t <= K.settle[0]) return v;
  return mix(v, target, EASE.inOut((t - K.settle[0]) / (K.settle[1] - K.settle[0])));
};

/** the scene's one accent ink: the night's lilac (the orb's light end, as "your own documents." is the Sunday's) */
const ACCENT = inkFor('night', 'dark');

/* ── geometry ─────────────────────────────────────────────────────── */
function geo(L: Layout) {
  // 9:16: the whole film-to-end-card stack lives inside the social safe zone (y 250 – 1500)
  /** the core: the four lights converge here and the wordmark's cap line is centred on it */
  const P = { x: L.cx, y: L.pick(L.cy - 170, 650) };
  /** her eyes (the portrait's framing): a little above the core, the face ≈ 12 % smaller than v7,
   *  so the 16:9 headline sits clear under her chin (its baseline ≤ 950) */
  const E = { x: L.cx, y: L.pick(L.cy - 210, 620) };
  return {
    P,
    E,
    /** the wordmark: its cap line centred on the core P */
    wordmark: { size: L.pick(160, 116) },
    /** the backlight (d = 1 where it turns to its edge): rx, ry above, ry below — the word's ends sit at d ≈ .75 */
    halo: L.pick([580, 236, 214] as const, [400, 192, 180] as const),
    /** the backlight: body gain, rim peak (≤ .75: light round a source, not a tube), rim spill, core lift */
    merge: [1, 0.72, 0.42, 0.05] as const,
    /** the backlight opens out of the core: its scale on the impact (the burst's edge) */
    bloomFrom: L.pick(0.16, 0.2),
    /** the light's underside settles under the word, so the button sits on the night */
    floor: L.pick({ dy: 170, len: 190, k: 0.45, rise: 70 }, { dy: 160, len: 170, k: 0.4, rise: 60 }),
    /** the art's framing: base zoom (× .88 of v7), glitch-band edge (v) */
    frame: L.pick({ zoom: 0.9, band: 0 }, { zoom: 1.13, band: 0.15 }),
    /** the dolly into the eyes over the scene (9:16 pushes less: the crop is already close) */
    dolly: L.pick(0.12, 0.07),
    /** THE ROOM's key behind her head: above the eyes (× the art's zoom), its height over the wall, strength (low:
     *  the night is near-black, the lights are the key) */
    wall: L.pick({ up: 110, h: 460, s: 0.2 }, { up: 150, h: 540, s: 0.2 }),
    /** her matte (eye offsets): centre drop below the eyes, radii x / y, feather (px) */
    // (smaller than her head: its outline — crown, ears, jaw — lies inside the feather, never an edge)
    vig: L.pick([-0.2, 1.4, 2.35, 130] as const, [-0.2, 1.4, 2.35, 150] as const),
    headline: {
      lines: ['AI voice agents that book', 'your customers 24/7.'],
      // 16:9: TYPE.display at 112, line 2's baseline at ≈ 940 (descenders ≈ 965), clear under her chin;
      // 9:16: 78 px (the safe zone's last 200 px under her: line 1's caps at ≈ 1303, descenders ≈ 1458)
      size: L.pick(112, 78),
      cy: L.pick(840, 1372),
    },
    /** a soft dark pool under the headline (radial, ≈36 % ink) so an orb's bloom never washes the type */
    scrim: L.pick({ w: 1700, h: 470 }, { w: 1080, h: 420 }),
    button: { y: L.pick(700, 1030), fontSize: L.pick(64, 56) },
    note: { y: L.pick(850, 1180), size: L.pick(64, 56) },
    url: { y: L.pick(968, 1318), size: L.pick(64, 56), dot: L.pick(20, 18), rule: L.pick(1400, L.width - 2 * L.safe.x) },
    /** the four lights: the converge ring about her eyes (radii, centre drop, tilt, orb diameter) and a light's
     *  turn (key: a small ring beside her face — it arrives at θ = a0, cheek height, and arcs back to eye
     *  height as it goes) */
    orbit: L.pick(
      { rx: 520, ry: 170, drop: 100, tilt: -0.09, d: 130, key: { rx: 400, ry: 150, drop: 40, a0: 0.95, w: 0.03 } },
      { rx: 430, ry: 205, drop: 170, tilt: -0.08, d: 128, key: { rx: 430, ry: 170, drop: 60, a0: 0.95, w: 0.03 } },
    ),
    /** the key's reach on her face (px) and gain */
    spill: L.pick([240, 3.4] as const, [280, 3.4] as const),
    iris: FLOW_END(L),
  };
}

/* ── camera ───────────────────────────────────────────────────────── */
function cameraAt(t: number) {
  if (t >= K.settle[1]) return { x: 0, y: 0, zoom: 1 };
  let x: number;
  let y: number;
  let zoom: number;
  if (t < I) {
    const d = tween(t, [-12, I], [0, 1], EASE.inOut);
    const push = tween(t, [b(1.5), K.pullBack[0]], [0, 1], EASE.inOut);
    const pull = tween(t, K.pullBack, [0, 1], EASE.inOut);
    x = mix(-16, 10, d);
    y = mix(8, -4, d);
    zoom = 1 + 0.025 * push - 0.04 * pull;
    // a small nudge toward each light as it arrives, on its side (1.8 px, +0.4 %): a smooth impulse, no shake
    K.orbPops.forEach((p, i) => {
      if (t < p) return;
      const k = Math.exp(-(t - p) / 3.5) * Math.sin(Math.min(1, (t - p) / 2) * (Math.PI / 2));
      x += 1.8 * K.lightSide[i] * k;
      zoom += 0.004 * k;
    });
  } else {
    // the impact: one firm push that settles on a glide (no noise, no shake)
    const g = springUnit(t - I, SPRING.glide);
    x = mix(10, 0, g);
    y = mix(-4, 0, g);
    zoom = mix(1.018, 1, g);
    // the click is felt: a small push that eases in over 2 f and dies away
    const u = t - (CTA.press + K.pressDown);
    if (u >= 0) zoom += 0.005 * Math.exp(-u / 5) * Math.min(1, u / 2);
  }
  return { x: rest(t, x, 0), y: rest(t, y, 0), zoom: rest(t, zoom, 1) };
}

/** where a point on a Layer of `depth` lands on screen (Camera.tsx's transform) */
function onLayer(L: Layout, p: { x: number; y: number }, cam: { x: number; y: number; zoom: number }, depth: number) {
  const z = 1 + (cam.zoom - 1) * depth;
  return { x: L.cx + (p.x - L.cx) * z - cam.x * depth, y: L.cy + (p.y - L.cy) * z - cam.y * depth, z };
}

const rgb01 = (hex: string) => hexToRgb(hex) as [number, number, number];
/** smoothstep of a clamped unit value */
const smoothUnit = (x: number) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * (3 - 2 * u);
};
/** a light's colour on a near-neutral wall: its hue at a fixed lightness, chroma scaled (Atmosphere.tsx) */
const wallInk = (hex: string, chroma: number, L = 0.8) => {
  const [, c, h] = toOklch(hex);
  return rgb01(fromOklch(L, Math.min(0.2, c) * chroma, h));
};
/** the merged light opening behind the word: ≈4 % over, settled in ≈16 f (a bloom, not a pop) */
const BLOOM = { stiffness: 130, damping: 16.5, mass: 1 };
/** the reveal's light curve: starts at ≈1.5× its mean rate, settles softly */
const REVEAL = (x: number) => 1 - Math.pow(1 - x, 2.2);
/**
 * The radial reveal's radius (frame half-diagonals). The frame's light comes
 * in between radii lo…hi (her backlight sits just outside the head),
 * following ≈ smoothstep(lo, hi, R); so R is driven through the INVERSE of
 * that, and the light rises evenly, decelerating, instead of slamming in
 * while R crosses the band. The last 12 % of the window opens the rest.
 */
function revealAt(t: number, [lo, hi]: readonly [number, number]) {
  const u = tween(t, K.reveal, [0, 1], REVEAL);
  if (u >= 0.88) return mix(hi, 1.9, (u - 0.88) / 0.12);
  const y = u / 0.88;
  const x = 0.5 - Math.sin(Math.asin(1 - 2 * y) / 3); // smoothstep⁻¹
  return mix(lo, hi, x);
}

/* ── the scene ────────────────────────────────────────────────────── */
export const Cta: React.FC = () => {
  const t = useSceneFrame('cta');
  const L = useLayout();
  const ready = useWordmarkFace();
  if (t < K.iris[0]) return null;
  const G = geo(L);
  const art = L.vertical ? HERO_ART.portrait : HERO_ART.landscape;
  const cam = cameraAt(t);
  const reveal: readonly [number, number] = L.pick([0.22, 0.88] as const, [0.28, 0.86] as const);

  /* ── the portrait + its room ── */
  const orbit = tween(t, [-8, I + 5], [0, 1], EASE.inOut);
  // the dolly into the eyes, plus the slow push from the first frame they show
  const eyePush = 1 + 0.06 * tween(t, K.eyePush, [0, 1], EASE.out3);
  const zoom = mix(1.0, 1 + G.dolly, tween(t, [-8, I], [0, 1], EASE.inOut)) * eyePush;
  // the converge: the light closes on her from the edges in (the opening backwards), the eyes last;
  // as their light lifts out (K.eyeGlow) they go too — then the portrait pass is off (all black)
  const close = tween(t, K.close, [0, 1], EASE.inOut);
  const revealR = mix(revealAt(t, reveal), -0.35, close);
  const eyesOn = tween(t, K.eyes, [0, 1], EASE.out3) * (1 - tween(t, [K.eyeGlow[0], K.eyeGlow[1]], [0, 1], EASE.inOut));
  const artOn = t < K.eyeGlow[1] + 1 ? 1 : 0; // (all black by then: an invisible switch)
  // THE ROOM's key: her lilac (low chroma) until the four lights take over, then near-neutral and dimmer
  const lead = tween(t, K.backDim, [0, 1], EASE.inOut);
  const artZ = G.frame.zoom * zoom;
  const wallC = (() => {
    const a = wallInk(C.lilac, 0.32);
    const n = wallInk(C.lilac, 0.1);
    return [mix(a[0], n[0], lead), mix(a[1], n[1], lead), mix(a[2], n[2], lead)] as [number, number, number];
  })();

  /* ── the backlight (after the impact) ── */
  const bloomS = t < I ? 0 : rest(t, springUnit(t - I, BLOOM), 1);
  const haloScale = mix(G.bloomFrom, 1, bloomS);
  const hC = onLayer(L, G.P, cam, 1);
  const haloR = [0, 1, 2].map((k) => G.halo[k] * hC.z * haloScale) as [number, number, number];
  // the light breathes under the end card, then its amplitude eases to 0 into the hold, where it freezes
  const breathAmp = tween(t, [K.breath, K.breath + 30], [0, 1], EASE.inOut) * (1 - tween(t, K.breathOut, [0, 1], EASE.inOut));
  const breath = t < K.breath || t >= K.breathOut[1] ? 0 : Math.sin(((t - K.breath) / 75) * Math.PI * 2) * breathAmp;
  const voiceGlow = brandEnv(t); // "Neuro Tech Voice." — the light answers her
  const flare = t < I ? 0 : rest(t, Math.exp(-(t - I) / 6), 0);
  const floorY = onLayer(L, { x: G.P.x, y: G.P.y + G.floor.dy }, cam, 1).y;

  const u0 = {
    mouse: [mix(1.2, -0.2, orbit), mix(0.36, 0.62, orbit)] as [number, number],
    zoom,
    pan: [0, 0] as [number, number],
    time: 20 + (t / 30) * 4,
    art: artOn,
    reveal: revealR,
    eyes: eyesOn,
    wall: [L.cx, G.E.y - G.wall.up * artZ, G.wall.h * artZ, G.wall.s * mix(1, 0.55, lead) * (1 - close)] as [number, number, number, number],
    wallColor: wallC,
    wallNear: 0.45,
    vig: [...G.vig] as [number, number, number, number],
    // her face: the stipple smoothed (2.4 art px), the stripes' shadows lifted; her purple calms as the lights lead
    face: [2.4, 0.85, 1, 0.5 * lead] as [number, number, number, number],
    haloC: [hC.x, hC.y] as [number, number],
    haloR,
    // (the backlight is born at the orb's edge and comes up as it opens past it)
    haloGain: t < I ? 0 : rest(t, smoothUnit(bloomS / 0.5) * (1 + 0.22 * flare) * (1 + 0.012 * breath) * (1 + 0.04 * voiceGlow), 1),
    merge: [...G.merge] as [number, number, number, number],
    floor: [floorY, G.floor.len * hC.z, G.floor.k * tween(t, [I + 4, K.button + 10], [0, 1], EASE.inOut), G.floor.rise * hC.z] as [number, number, number, number],
    frame: [G.frame.zoom, G.E.y / L.height, G.frame.band] as [number, number, number],
    seed: t,
  };

  /* ── the four lights ── */
  const spin = spinTable(t + 1);
  const now = orbsAt(t, G, spin);
  // the flow follows her voice, quickens in the whirl, and the survivor's mesh swirls hard
  const survivor = windowed(t, K.merge[0], K.survivor[0], I - 1, I + 4, EASE.out3, EASE.in2);
  const vol = (s: number) =>
    0.12 + 0.75 * lineEnv(s) + 0.6 * tween(s, K.orbIn, [0, 1], EASE.in2) + 1.4 * windowed(s, K.merge[0], K.survivor[0], I - 1, I + 4, EASE.out3, EASE.in2);
  const flow = flowTime(Math.max(0, t), vol);
  const burstU = tween(t, K.burst, [0, 1], EASE.out3);
  const back: OrbDraw[] = [];
  const front: OrbDraw[] = [];
  const merged = t >= K.merge[0];
  // ON "Twenty" "four" "seven" the light in turn answers the word: a lift of its light with an attack
  // (≈ 1 f to its peak — a bloom over ≈ 4 render frames, never a one-frame step)
  const wordLift = K.tighten.reduce((a, f) => a + 0.18 * hit(t - f, 4), 0);
  // the survivor (night) on screen: its four colour glows sit about it, turning with its mesh
  const sv = now[3];
  const svScr = onLayer(L, sv, cam, 1 + 0.25 * sv.z * Math.min(1, radiusAt(t)));
  const svD = sv.d * svScr.z * (t >= I ? mix(1, 1.25, burstU) : 1);
  const sw = (t - K.merge[0]) * 0.32;
  /**
   * FOUR BLOOM SLOTS, ONE PER LIGHT, ALWAYS (slot k = light k): no sort, no hand-over of a slot
   * between lights, so every slot is continuous through the merge. In the merge each slot
   * travels from its own light's glow to the survivor's colour glow k (on the survivor at
   * angle sw + kπ/2), weighted by `survivor`.
   */
  const glows: HeroUniforms['glows'] = now.map((o) => {
    const depthPar = 1 + 0.25 * o.z * Math.min(1, radiusAt(t));
    const scr = onLayer(L, o, cam, depthPar);
    const lightC = GLOW[o.id];
    const toAll = o.i === 3 ? tween(t, K.merge, [0, 1], EASE.inOut) : 0;
    // light, not paint: the bloom is the orb's body colour lifted toward its core
    const glowBody = mixColor(mixColor(lightC.body, lightC.core, 0.4), ALL_GLOW.body, toAll);
    const full = G.orbit.d * scr.z;
    const d = o.d * scr.z;
    const opacity = t >= I ? (o.i === 3 ? Math.pow(1 - burstU, 2.2) : 0) : o.opacity;
    const shown = o.pop > 0 && d >= 1 && opacity > 0.002;
    // its own light: the gathering point, the arrival's flash, its steady light (≈ .42), the word lifts.
    // The bloom is TIGHT (≈ 40 % of v7's): its light reads on her face (the key), not as a disc round the ball
    let gs = 0.7 * o.gather;
    let gr = o.gather > 0 ? full * (0.1 + 0.1 * o.gather) : 0;
    if (shown) {
      const lift = wordLift * Math.min(1, o.light);
      gs += (0.42 * o.light + 0.6 * o.flash + lift) * (1 + 0.3 * tween(t, K.orbIn, [0, 1], EASE.in2)) * opacity;
      const gd = Math.max(d, full * 0.8 * Math.min(1, o.flash * 2));
      gr = Math.max(gr, 0.42 * gd * (1.05 + 0.45 * o.flash));
    }
    gs = Math.min(1.3, gs);
    const own = {
      x: scr.x,
      y: scr.y,
      r: gr,
      s: gs,
      // (the gathering point is its light's pale core; it hands over to the body as the orb comes out — a blend, never a switch)
      color: rgb01(mixColor(glowBody, LIGHTS[o.id].orb[3], smoothUnit(o.gather * (1 - Math.min(1, o.light / 0.4))))),
    };
    // … and the survivor's colour glow k (it carries all four)
    const a = sw + (o.i * Math.PI) / 2;
    const mine = {
      x: svScr.x + Math.cos(a) * svD * 0.55,
      y: svScr.y + Math.sin(a) * svD * 0.55,
      r: svD * 0.72,
      s: 0.6 * survivor,
      color: rgb01(LIGHTS[o.id].orb[2]),
    };
    const w = survivor;
    let g = {
      x: mix(own.x, mine.x, w),
      y: mix(own.y, mine.y, w),
      r: mix(own.r, mine.r, w),
      s: mix(own.s, mine.s, w),
      color: [0, 1, 2].map((c) => mix(own.color[c], mine.color[c], w)) as [number, number, number],
    };
    if (t >= I && o.i === 3) {
      // the impact (the cut): the survivor's slot is the burst — a white-lilac light from the core,
      // hot for 2–3 frames, handing over to the backlight
      g = {
        x: svScr.x,
        y: svScr.y,
        r: mix(o.d * svScr.z * 1.1, G.halo[0] * 0.5, burstU),
        s: 0.85 * Math.exp(-(t - I) / 2.2),
        color: rgb01(mixColor('#f7f3ff', LIGHTS.night.orb[3], 0.35)),
      };
    }
    // its key on her face: as lit as it is (its arrival lifts it a little, and the word lifts)
    const spill = t >= I ? 0 : (o.light * (1 + 0.35 * o.flash) + wordLift * Math.min(1, o.light)) * o.opacity;
    // (its colour on her: the light's saturated body, a little toward its light)
    // behind her (its bloom hidden by her head): a soft hand-over around the sides, as the orb's own layers
    const back = merged ? 0 : 1 - EASE.inOut(Math.min(1, Math.max(0, (o.z + 0.14) / 0.28)));
    return { ...g, back, spill, spillColor: rgb01(mixColor(LIGHTS[o.id].orb[2], LIGHTS[o.id].orb[3], 0.2)) };
  });
  // the orbs themselves (drawn back to front; in the merge the survivor on top)
  const order = [...now].sort((a, c) => (merged ? (a.i === 3 ? 1 : c.i === 3 ? -1 : a.z - c.z) : a.z - c.z));
  for (const o of order) {
    if (t >= I && o.i !== 3) continue;
    const scr = onLayer(L, o, cam, 1 + 0.25 * o.z * Math.min(1, radiusAt(t)));
    let d = o.d * scr.z;
    let opacity = o.opacity;
    if (t >= I) {
      // the impact: only the survivor, and it gives its light away — a little larger, gone in ≈6 f
      d *= mix(1, 1.25, burstU);
      opacity = Math.pow(1 - burstU, 2.2);
    }
    if (!(o.pop > 0 && d >= 1 && opacity > 0.002)) continue;
    const draw: OrbDraw = { x: scr.x, y: scr.y, d, palette: o.palette, volume: vol(t), time: flow + seedTime(o.i), opacity };
    // behind her or in front: a soft hand-over around the sides (z ≈ 0)
    const wFront = merged ? 1 : EASE.inOut(Math.min(1, Math.max(0, (o.z + 0.14) / 0.28)));
    if (wFront > 0.001) front.push({ ...draw, opacity: opacity * wFront });
    if (wFront < 0.999) back.unshift({ ...draw, opacity: opacity * (1 - wFront) });
  }
  const orbs: HeroOrbs = { back, front };
  const u: HeroUniforms = {
    ...u0,
    occ: 1 - tween(t, K.unhide, [0, 1], EASE.inOut),
    glows,
    spill: [G.spill[0], G.spill[1]],
    // her eyes carry her voice (0.25 · the real envelope)
    eyeGlow: 0.25 * lineEnv(t),
    // the four lights on the backlight's rim: its edge takes each one's colour at a diagonal (rose TL, emerald TR,
    // teal BR, violet BL), wide arcs that blend into one another
    rim: [0.85 * tween(t, K.rimIn, [0, 1], EASE.inOut), 0, 0, 0.45],
    rimColors: LIGHT_ORDER.map((id) => rgb01(mixColor(LIGHTS[id].orb[2], LIGHTS[id].orb[3], 0.25))),
    glowOver: 0.4,
  };

  /* ── iris ── */
  const irisAt = (tt: number) => tween(tt, K.iris, [0, Math.hypot(L.width, L.height)], EASE.peel);
  const irisR = irisAt(t);
  const mask =
    t < K.iris[1]
      ? `radial-gradient(circle at ${G.iris.x}px ${G.iris.y}px, #000 ${Math.max(0, irisR - 1.5).toFixed(2)}px, transparent ${(irisR + 0.5).toFixed(2)}px)`
      : undefined;

  /* ── headline: each word on its spoken word; out through its mask at the converge ── */
  const spec: HeadlineSpec = {
    lines: G.headline.lines,
    cy: G.headline.cy,
    size: G.headline.size,
    wordAt: CTA.lineWords.map((w) => CTA.line + vWord(CTA.lineVoice, w) - K.riseLead),
    exit: K.wordsOut,
    keys: ['24/7.'],
    accent: ACCENT,
    vertical: L.vertical,
  };
  // the pool under the headline: in with its first word, out as the words leave
  const scrimO =
    tween(t, [spec.wordAt[0] - 4, spec.wordAt[0] + 10], [0, 1], EASE.out3) *
    (1 - tween(t, [K.wordsOut.from, K.wordsOut.from + 12], [0, 1], EASE.inOut));

  /* the gathering light at the core (the four lights' merged glow) */
  const pull = tween(t, K.pullBack, [0, 1], EASE.inOut);
  const coreGrow = tween(t, [K.core[0], K.pullBack[0]], [0, 1], EASE.out3);
  const bloom = t >= I ? 0 : coreGrow * L.pick(520, 480) * (1 - 0.35 * pull);
  const bloomHot = (0.6 + 0.4 * pull) * 0.5;

  /* the eyes' last light slides into the core (screen space, like the hero) */
  const Pscr = onLayer(L, G.P, cam, 1);
  const eyeZ = G.frame.zoom * zoom;
  const eyeOff = art.eye[0] * eyeZ * L.width;
  const eyeX0 = art.axis * L.width;
  const eyeGlowO = windowed(t, K.eyeGlow[0], K.eyeGlow[1], K.eyeGlow[1] + 2, K.eyeGlow[2], EASE.out3, EASE.in2);
  const slide = tween(t, [K.eyeGlow[1], K.eyeGlow[2]], [0, 1], EASE.in2);

  /* the impact's light: a white burst from the core (a light, not a veil), rising over 1.5 f, gone in ≈5 */
  const flash = t < I - 1.5 ? 0 : t < I ? Math.sin(((t - (I - 1.5)) / 1.5) * (Math.PI / 2)) : Math.exp(-(t - I) / 1.5);

  /* the wordmark: each letter rises just after the corona's light has passed it (from the centre out),
     so the line of light never cuts across a letter on its way up */
  const wmSize = G.wordmark.size;
  const rxPx = G.halo[0];
  const arrive = (xEm: number) => {
    const target = Math.min(0.98, (xEm * wmSize + 0.3 * wmSize) / rxPx);
    if (target <= G.bloomFrom) return -1;
    for (let dt = 0; dt < 30; dt += 0.1) if (mix(G.bloomFrom, 1, springUnit(dt, BLOOM)) >= target) return dt + 1;
    return 10;
  };

  const endO = 1 - endLight(t);

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ WebkitMaskImage: mask, maskImage: mask, background: '#050408' }}>
        <HeroGL art={art} width={L.width} height={L.height} u={u} orbs={orbs} />
        {[K.glint0, K.glint].map((win, k) => (
          <Glint key={k} t={t} win={win} x0={eyeX0} off={IRIS.k * eyeOff} y={G.E.y - IRIS.dv * eyeZ * L.height} r={IRIS.r * eyeZ} />
        ))}
        {eyeGlowO > 0.01
          ? [-1, 1].map((side) => (
              <EyeLight
                key={side}
                o={eyeGlowO}
                x={mix(eyeX0 + side * IRIS.k * eyeOff, Pscr.x, slide)}
                y={mix(G.E.y - IRIS.dv * eyeZ * L.height, Pscr.y, slide)}
                size={mix(84, 40, slide)}
              />
            ))
          : null}
        {/* while it moves, the headline words and the end-card rows on its plane glide at their exact sub-pixel position */}
        <Camera x={cam.x} y={cam.y} zoom={cam.zoom} moving={camMoving(cameraAt, t)}>
          <Layer depth={1}>
            {scrimO > 0.005 ? (
              <div
                style={{
                  position: 'absolute',
                  left: L.cx - G.scrim.w / 2,
                  top: G.headline.cy - G.scrim.h / 2,
                  width: G.scrim.w,
                  height: G.scrim.h,
                  opacity: scrimO,
                  background: 'radial-gradient(closest-side, rgba(5,4,8,0.40) 0%, rgba(5,4,8,0.33) 42%, rgba(5,4,8,0.12) 76%, rgba(5,4,8,0) 100%)',
                }}
              />
            ) : null}
            <Headline t={t} spec={spec} />
            {bloom > 1 ? (
              <div
                style={{
                  position: 'absolute',
                  left: G.P.x - bloom / 2,
                  top: G.P.y - bloom / 2,
                  width: bloom,
                  height: bloom,
                  borderRadius: '50%',
                  mixBlendMode: 'screen',
                  background: `radial-gradient(circle, ${rgbaHex(ALL_GLOW.core, 0.26 * bloomHot)} 0%, ${rgbaHex(ALL_GLOW.body, 0.12 * bloomHot)} 35%, ${rgbaHex(ALL_GLOW.body, 0)} 70%)`,
                }}
              />
            ) : null}
            <Wordmark
              t={t}
              at={I}
              ready={ready}
              rest={rest}
              spec={{ x: G.P.x, y: G.P.y, size: wmSize, arrive, color: WORDMARK_INK }}
            />
            <Row y={G.button.y}>
              <StartFree
                t={t}
                at={K.button}
                press={CTA.press}
                fontSize={G.button.fontSize}
                vertical={L.vertical}
                spec={{ hover: K.pressLift[0], down: K.pressDown }}
                rest={rest}
              />
            </Row>
            <Row y={G.note.y}>
              <Note t={t} at={K.note} step={K.noteStep} size={G.note.size} vertical={L.vertical} />
            </Row>
            <Row y={G.url.y}>
              <Url
                t={t}
                text={K.urlText}
                chunks={K.urlChunks.map((from, k) => ({ from, at: K.urlAt[k] }))}
                size={G.url.size}
                dot={G.url.dot}
                ruleW={G.url.rule}
                vertical={L.vertical}
                rest={rest}
              />
            </Row>
          </Layer>
        </Camera>
        {flash > 0.002 ? (
          <AbsoluteFill
            style={{
              background: `radial-gradient(circle at ${Pscr.x.toFixed(1)}px ${Pscr.y.toFixed(1)}px, rgba(255,255,255,${(0.75 * flash).toFixed(3)}) 0%, rgba(247,243,255,${(0.42 * flash).toFixed(3)}) ${L.pick(6, 5)}%, rgba(214,200,255,${(0.12 * flash).toFixed(3)}) ${L.pick(18, 15)}%, rgba(196,168,255,${(0.03 * flash).toFixed(3)}) 34%, rgba(196,168,255,0) 52%)`,
            }}
          />
        ) : null}
      </AbsoluteFill>
      {t < K.iris[1] + 1 ? <IrisRim t={t} r={irisR} x={G.iris.x} y={G.iris.y} w={L.width} h={L.height} /> : null}
      {endO > 0.001 ? <AbsoluteFill style={{ background: C.night, opacity: endO }} /> : null}
    </AbsoluteFill>
  );
};

/**
 * The wordmark's face (font/wordmark.css) must be in before a frame is taken: the scene holds
 * the render (delayRender) until the browser has it, then re-renders with the kerned layout.
 */
function useWordmarkFace(): boolean {
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender('CTA wordmark face (Inter Tight)'));
  const released = useRef(false);
  useEffect(() => {
    let alive = true;
    document.fonts
      .load(`500 100px ${WORDMARK_FONT}`, WORDMARK_TEXT)
      .then(() => document.fonts.ready)
      .then(() => {
        if (alive) setReady(true);
      })
      .catch((e) => cancelRender(e));
    return () => {
      alive = false;
      if (!released.current) {
        released.current = true;
        continueRender(handle);
      }
    };
  }, [handle]);
  useEffect(() => {
    if (ready && !released.current) {
      released.current = true;
      continueRender(handle);
    }
  }, [ready, handle]);
  return ready;
}

const rgbaHex = (hex: string, a: number) => {
  const [r, g, bb] = hexToRgb(hex);
  return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(bb * 255)},${Math.max(0, a).toFixed(3)})`;
};

/** an end-card row; while the camera settles its content rides its own small, content-sized layer
 *  (no 1 px hop on the way to rest; a frame-wide layer can be re-rastered differently per render tab) */
const Row: React.FC<{ y: number; children: React.ReactNode }> = ({ y, children }) => {
  const glide = useGlide();
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: y, display: 'flex', justifyContent: 'center', transform: 'translateY(-50%)' }}>
      <div style={{ display: 'flex', ...glideStyle(undefined, glide) }}>{children}</div>
    </div>
  );
};

/**
 * The irises, measured on the art: centres at .877 of the site's eye offset
 * and .0053 (art v) above its eye line; radius ≈ 9.5 art px = 17.8 frame px
 * per unit of zoom (both crops are 1.875 frame px per art px).
 */
const IRIS = { k: 0.877, dv: 0.0053, r: 17.8 };

/** The catch-light: a small specular point crossing both irises in 4 frames, just above their centres. */
const Glint: React.FC<{ t: number; win: readonly [number, number]; x0: number; off: number; y: number; r: number }> = ({ t, win, x0, off, y, r }) => {
  const [a, c] = win;
  if (t < a - 0.5 || t > c) return null;
  const k = tween(t, [a, c], [-0.8, 0.8], EASE.inOut);
  const o = 0.6 * Math.sin(Math.PI * tween(t, [a - 0.5, c], [0, 1]));
  return (
    <AbsoluteFill>
      {[-1, 1].map((side) => (
        <div
          key={side}
          style={{
            position: 'absolute',
            left: x0 + side * off + k * r - 5,
            top: y - r * 0.42 + Math.abs(k) * r * 0.18 - 5,
            width: 10,
            height: 10,
            borderRadius: '50%',
            opacity: o,
            background: 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0.9) 28%, rgba(255,255,255,0) 70%)',
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

/** The iris edge: a crisp hairline of lilac light on the dark circle's rim, out as it completes. */
const IrisRim: React.FC<{ t: number; r: number; x: number; y: number; w: number; h: number }> = ({ t, r, x, y, w, h }) => {
  const o = tween(t, [K.iris[0], K.iris[0] + 2], [0, 1], EASE.out3) * (1 - tween(t, [K.iris[1] - 5, K.iris[1] + 1], [0, 1], EASE.in2));
  if (o <= 0.01 || r < 1) return null;
  return (
    <svg width={w} height={h} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
      <circle cx={x} cy={y} r={r} fill="none" stroke={`rgba(185,163,255,${(0.85 * o).toFixed(3)})`} strokeWidth={1.5} />
    </svg>
  );
};

/** One of the eyes' last lights: a point of lilac light (a light's falloff, not a blur), sliding into the core. */
const EyeLight: React.FC<{ o: number; x: number; y: number; size: number }> = ({ o, x, y, size }) => (
  <div
    style={{
      position: 'absolute',
      left: x - size / 2,
      top: y - size / 2,
      width: size,
      height: size,
      borderRadius: '50%',
      opacity: o,
      background: 'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(214,200,255,0.8) 12%, rgba(185,163,255,0.32) 32%, rgba(124,58,237,0.1) 52%, rgba(124,58,237,0) 70%)',
    }}
  />
);
