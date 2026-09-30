/**
 * CTA (the last ~8 s) — Ava's voice-over; the four lights become one; the logo.
 * Every frame below is CTA-local and comes from timing.ts (CTA, CTA_LOCAL),
 * which derives the converge and the impact from her real voice.
 *
 *   iris      a dark circle opens from FLOW_END (the scale's last node), its
 *             rim smeared and its edge feathered by its own speed
 *   0…30      HERO: the site's cover portrait out of black — the eyes first
 *             (a slow push-in, a catch-light glint ON her first word), then a
 *             noisy radial opening while the site's "liquid" tear settles
 *   line      Ava: "AI voice agents that book your customers. Twenty four
 *             seven." — each headline word rises ON its spoken word ("24/7."
 *             on "Twenty"); her eyes glow with her real voice envelope
 *   orbPops   THE FOUR LIGHTS pop in on 8ths — rush, closing, sunday, night —
 *             each a light-chime hit (gather, spring overshoot, flash, ring,
 *             sparks, a camera kick); they orbit her head in depth (the ones
 *             behind her are hidden by her own matte and rim her silhouette),
 *             their flow driven by her voice
 *   tighten   ON "Twenty" "four" "seven" the orbit tightens and quickens
 *   converge  the orbit swells (anticipation), then spirals into the core,
 *             accelerating, motion-blurred; the portrait frays away to its
 *             silver backlight; the words are pulled in behind them
 *   merge     the four overlap and their palettes flow into one (ALL_LIGHTS)
 *   impact    the merged orb blows out into the light: the logo lands 1.25 → 1
 *             on SPRING.heavy, white flash, shockwave, ±6 px shake; Ava:
 *             "Neuro Tech Voice." (the crown glows with her voice); the halo
 *             keeps a faint rim of the four lights
 *   end card  "Start free →" pops → the note → the URL types → the button is
 *             clicked and keeps the site's hover (plum)
 *   finalHold → end: nothing moves but the global grain
 *
 * Parallax: art (in-shader orbit) · halo 0.3 · orbs 0.8–1.25 by depth ·
 * type/logo/button 1 · streaks 1.3 · dust 1.5.
 *
 * ONE WebGL context: HeroGL draws the portrait, the halo AND the four orbs.
 */
import React from 'react';
import { AbsoluteFill, Img, random, staticFile } from 'remotion';
import { Camera, Layer } from '../components/Camera';
import { Dust } from '../components/Dust';
import { flowTime, seedTime } from '../components/Orb';
import type { OrbDraw } from '../components/orbGL';
import { FLOW_END } from '../lib/handoff';
import { useLayout, type Layout } from '../lib/layout';
import { ALL_GLOW, GLOW, hexToRgb, mixColor } from '../lib/lights';
import { EASE, mix, SPRING, springAt, tween, windowed } from '../lib/motion';
import { useSceneFrame } from '../lib/scene';
import { C, LIGHTS, LIGHT_ORDER } from '../theme';
import { b, CTA, CTA_LOCAL, vWord } from '../timing';
import { CoverCta, Note, Url, type Rest } from './cta/EndCard';
import { Headline, type HeadlineSpec } from './cta/Headline';
import { HERO_ART, HeroGL, type HeroOrbs, type HeroUniforms } from './cta/HeroGL';
import { brandEnv, lineEnv, orbsAt, POP_PHASE, radiusAt, spinTable } from './cta/orbit';
import { buildStreaks, Streaks } from './cta/Streaks';

const K = CTA_LOCAL;
const I = CTA.logoImpact;

/** Pin a residual to its exact rest value by the final hold (eased over K.settle). */
const rest: Rest = (t, v, target) => {
  if (t >= K.settle[1]) return target;
  if (t <= K.settle[0]) return v;
  return mix(v, target, EASE.inOut((t - K.settle[0]) / (K.settle[1] - K.settle[0])));
};

/* ── geometry ─────────────────────────────────────────────────────── */
const LOGO_RATIO = 2148 / 2999;
/** the NEUROVOICE wordmark inside the logo art (rows 1905–2147 of 2148, full width) */
const WORDMARK_TOP = 1905 / 2148;

function geo(L: Layout) {
  const P = { x: L.cx, y: L.pick(L.cy - 170, 600) };
  const logoW = L.pick(560, 640);
  const logoH = logoW * LOGO_RATIO;
  const wordmark = { top: P.y - logoH / 2 + logoH * WORDMARK_TOP, bottom: P.y + logoH / 2 };
  const button = { y: L.pick(760, 1110), fontSize: L.pick(56, 60) };
  // the plate: label line (1.2em) + label padding (.8em × 2)
  const buttonTop = button.y - (button.fontSize * (1.2 + 1.6)) / 2;
  return {
    P,
    logoW,
    logoH,
    wordmark,
    /** halo centre sits under the logo centre so the wordmark is deep in the light */
    haloC: { x: P.x, y: P.y + 70 },
    /**
     * rx, ry above, ry below: a round light, the art's own backlight, dead
     * above the button. Tuned (scratchpad halo.py, a replica of the shader)
     * for the softest roll-off that keeps every wordmark pixel ≥ #a19e97
     * (luma ≥ 165 here) and the button's top edge ≤ #1a1620 (≤ 19)
     */
    haloR: L.pick([720, 570, 210] as const, [620, 660, 300] as const),
    haloPow: 2,
    /**
     * once the logo is in, the light's underside settles under the wordmark
     * so the button sits on the night: the floor starts just under the
     * wordmark (at the axis), its length, strength, and how far its edge
     * curves up at ±rx
     */
    floor: L.pick({ y: wordmark.bottom + 10, len: 140, k: 0.7, rise: 126 }, { y: wordmark.bottom + 16, len: 200, k: 0.3, rise: 180 }),
    /** the art's framing: base zoom (the portrait crop is pushed in so its glitch band stays out) */
    frame: L.pick({ zoom: 1.02, band: 0 }, { zoom: 1.36, band: 0.15 }),
    headline: {
      lines: L.pick(['AI voice agents that book', 'your customers 24/7.'], ['AI voice agents', 'that book your', 'customers 24/7.']),
      fontSize: L.pick(76, 84),
      cy: L.pick(880, 1250),
      markGap: 28,
    },
    button,
    buttonTop,
    note: { y: L.pick(885, 1250), size: 34 },
    url: { y: L.pick(950, 1330), size: 44, dot: 20 },
    /** the four lights' orbit about the eyes: radii, ring centre drop, tilt, orb diameter */
    orbit: L.pick(
      { rx: 560, ry: 190, drop: 26, tilt: -0.09, d: 150, tight: 1 },
      // 9:16: her head fills the width, so the ring runs wide and tightens less
      { rx: 452, ry: 210, drop: 40, tilt: -0.08, d: 118, tight: 0.55 },
    ),
    /** the shockwave leaves from the merged orb, out past the frame */
    ring: [60, L.pick(1150, 1100)] as const,
    iris: FLOW_END(L),
  };
}
type Geo = ReturnType<typeof geo>;

/* ── camera ───────────────────────────────────────────────────────── */
function cameraAt(t: number, G: Geo) {
  if (t >= K.settle[1]) return { x: 0, y: 0, zoom: 1, shake: 0 };
  let x: number;
  let y: number;
  let zoom: number;
  let shake = 0;
  if (t < I) {
    const d = tween(t, [-12, I], [0, 1], EASE.inOut);
    const push = tween(t, [b(1.5), K.pullBack[0]], [0, 1], EASE.inOut);
    const pull = tween(t, K.pullBack, [0, 1], EASE.inOut);
    x = mix(-16, 10, d);
    y = mix(8, -4, d);
    zoom = 1 + 0.025 * push - 0.04 * pull;
    // a small kick toward each orb as it pops (1.8 px, +0.4 %)
    K.orbPops.forEach((p, i) => {
      if (t < p) return;
      const k = Math.exp(-(t - p) / 3.5) * Math.sin(Math.min(1, (t - p) / 2) * (Math.PI / 2));
      const a = POP_PHASE[i];
      x += 1.8 * Math.sin(a) * k;
      y += 1.8 * Math.cos(a) * k;
      zoom += 0.004 * k;
    });
  } else {
    const g = springAt(t, I, SPRING.glide);
    x = mix(10, 0, g);
    y = mix(-4, 0, g);
    const k = t - I;
    if (k < K.shake) {
      const a = 6 * Math.pow(1 - k / K.shake, 2);
      const f = Math.floor(t);
      x += a * (random(`cta-shake-x-${f}`) * 2 - 1);
      y += a * (random(`cta-shake-y-${f}`) * 2 - 1);
      shake = a;
    }
    zoom = mix(1.018, 1, g);
    // the button's pop and its click each kick the frame
    if (t >= CTA.button) zoom += 0.004 * Math.exp(-(t - CTA.button) / 3.5) * Math.min(1, (t - CTA.button) / 2);
    const u = t - (CTA.press + K.pressDown);
    if (u >= 0) zoom += 0.01 * Math.exp(-u / 4);
  }
  return { x: rest(t, x, 0), y: rest(t, y, 0), zoom: rest(t, zoom, 1), shake: rest(t, shake, 0) };
  void G;
}

/** where a point on a Layer of `depth` lands on screen (Camera.tsx's transform) */
function onLayer(L: Layout, p: { x: number; y: number }, cam: { x: number; y: number; zoom: number }, depth: number) {
  const z = 1 + (cam.zoom - 1) * depth;
  return { x: L.cx + (p.x - L.cx) * z - cam.x * depth, y: L.cy + (p.y - L.cy) * z - cam.y * depth, z };
}

const rgb01 = (hex: string) => hexToRgb(hex) as [number, number, number];

/* ── the scene ────────────────────────────────────────────────────── */
export const Cta: React.FC = () => {
  const t = useSceneFrame('cta');
  const L = useLayout();
  if (t < K.iris[0]) return null;
  const G = geo(L);
  const art = L.vertical ? HERO_ART.portrait : HERO_ART.landscape;
  const cam = cameraAt(t, G);

  /* ── hero uniforms ── */
  const orbit = tween(t, [-8, I + 5], [0, 1], EASE.inOut);
  const pull = tween(t, K.pullBack, [0, 1], EASE.inOut);
  const land = t < I ? 0 : rest(t, springAt(t, I, SPRING.heavy), 1);
  const flare = t < I ? 0 : rest(t, Math.exp(-(t - I) / 7), 0);
  // the halo breathes under the end card, then its amplitude eases to 0 into the hold, where it freezes
  const breathAmp = tween(t, [K.breath, K.breath + 30], [0, 1], EASE.inOut) * (1 - tween(t, K.breathOut, [0, 1], EASE.inOut));
  const breath = t < K.breath || t >= K.breathOut[1] ? 0 : Math.sin(((t - K.breath) / 75) * Math.PI * 2) * breathAmp;
  const haloScale = (1 - 0.05 * pull * (t < I ? 1 : 0)) * (t < I ? 1 : mix(1.07, 1, land));
  const hC = onLayer(L, G.haloC, cam, 0.3);
  // the dolly into the eyes, plus the slow push after the iris
  const eyePush = 1 + 0.04 * tween(t, K.eyePush, [0, 1], EASE.out3);
  const zoom = mix(1.0, 1.12, tween(t, [-8, I], [0, 1], EASE.inOut)) * eyePush;
  const voiceGlow = brandEnv(t); // "Neuro Tech Voice." — the light answers her
  const u0 = {
    mouse: [mix(1.2, -0.2, orbit), mix(0.36, 0.62, orbit)] as [number, number],
    zoom,
    pan: [0, 0] as [number, number],
    time: 20 + (t / 30) * 4,
    tear: Math.max(
      tween(t, K.entryTear, [0.55, 0], EASE.out3),
      // the portrait crop's warp is about half as wide in px as the landscape's:
      // it gets more, so the downbeat burst reads the same in both
      (tween(t, K.tearKick, [0, 0.3], EASE.out3) + tween(t, K.tear, [0, 0.7], EASE.draw)) * L.pick(1, 2.8),
    ),
    liquid: tween(t, K.liquid, [1, 0], EASE.inOut),
    erase: tween(t, K.erase, [0, 1], EASE.draw),
    reveal: tween(t, K.reveal, [0, 1.9], EASE.inOut),
    eyes: tween(t, K.eyes, [0, 1], EASE.out3),
    haloC: [hC.x, hC.y] as [number, number],
    haloR: [G.haloR[0] * hC.z * haloScale, G.haloR[1] * hC.z * haloScale, G.haloR[2] * hC.z * haloScale] as [number, number, number],
    haloGain: rest(
      t,
      (1 - 0.06 * pull * (t < I ? 1 : 0)) * (1 + 0.32 * flare) * (1 + 0.009 * breath) * (1 + 0.025 * voiceGlow),
      1,
    ),
    floor: [
      onLayer(L, { x: L.cx, y: G.floor.y }, cam, 0.3).y,
      G.floor.len * hC.z,
      G.floor.k * tween(t, [I + 4, CTA.button - 2], [0, 1], EASE.inOut),
      G.floor.rise * hC.z,
    ] as [number, number, number, number],
    haloShape: [G.haloPow, 0, 0.06] as [number, number, number],
    frame: [G.frame.zoom, G.P.y / L.height, G.frame.band] as [number, number, number],
    seed: t,
  };

  /* ── the four lights ── */
  const spin = spinTable(t + 1);
  const now = orbsAt(t, G, spin);
  const prev = orbsAt(t - 0.5, G, spin);
  const next = orbsAt(t + 0.5, G, spin);
  const camAt = (tt: number) => cameraAt(tt, G);
  const camPrev = camAt(t - 0.5);
  const camNext = camAt(t + 0.5);
  const vol = (s: number) => 0.12 + 0.75 * lineEnv(s) + 0.6 * tween(s, K.orbIn, [0, 1], EASE.in2);
  const flow = flowTime(Math.max(0, t), vol);
  const burstU = tween(t, K.burst, [0, 1], EASE.out3);
  const back: OrbDraw[] = [];
  const front: OrbDraw[] = [];
  const glows: HeroUniforms['glows'] = [];
  const ringsDom: { x: number; y: number; r: number; w: number; color: string; o: number }[] = [];
  const sparks: { x0: number; y0: number; x1: number; y1: number; color: string; o: number; w: number }[] = [];
  const merged = t >= K.merge[0];
  const order = [...now].sort((a, c) => (merged ? (a.i === 3 ? 1 : c.i === 3 ? -1 : a.z - c.z) : a.z - c.z));
  for (const o of order) {
    const depthPar = 1 + 0.25 * o.z * Math.min(1, radiusAt(t, G.orbit.tight));
    const scr = onLayer(L, o, cam, depthPar);
    const pv = prev[o.i];
    const nx = next[o.i];
    const sp = onLayer(L, pv, camPrev, depthPar);
    const sn = onLayer(L, nx, camNext, depthPar);
    const pop = o.pop;
    const flash = t >= K.orbPops[o.i] ? Math.exp(-(t - K.orbPops[o.i]) / 3) : 0;
    const light = GLOW[o.id];
    const toAll = tween(t, [K.orbIn[0] + 4, K.merge[1]], [0, 1], EASE.inOut);
    const glowBody = mixColor(light.body, ALL_GLOW.body, toAll);
    // after the impact only the survivor bursts, then nothing
    let d = o.d * scr.z;
    let opacity = o.opacity;
    if (t >= I) {
      if (o.i !== 3) continue;
      d *= mix(1, 3.2, burstU);
      opacity = t >= K.burst[1] ? 0 : Math.pow(1 - burstU, 1.6);
    }
    // anticipation: a point of the light gathers for 3 f before the pop
    const gather = t < K.orbPops[o.i] && t >= K.orbPops[o.i] - 3 ? Math.sin(((t - (K.orbPops[o.i] - 3)) / 3) * (Math.PI / 2)) : 0;
    if (gather > 0) {
      glows.push({ x: scr.x, y: scr.y, r: G.orbit.d * (0.18 + 0.12 * gather), s: 0.95 * gather, color: rgb01(LIGHTS[o.id].orb[3]), back: false });
      continue;
    }
    if (pop <= 0 || d < 1 || opacity <= 0.002) continue;
    const draw: OrbDraw = {
      x: scr.x,
      y: scr.y,
      d,
      palette: o.palette,
      volume: vol(t),
      time: flow + seedTime(o.i),
      opacity,
      smear: [(sn.x - sp.x) * 0.5, (sn.y - sp.y) * 0.5],
    };
    // behind her or in front: a soft hand-over around the sides (z ≈ 0)
    const wFront = merged ? 1 : EASE.inOut(Math.min(1, Math.max(0, (o.z + 0.14) / 0.28)));
    if (wFront > 0.001) front.push({ ...draw, opacity: opacity * wFront });
    if (wFront < 0.999) back.unshift({ ...draw, opacity: opacity * (1 - wFront) });
    // its bloom
    const tightenFlash = K.tighten.reduce((a, f) => a + (t >= f ? 0.3 * Math.exp(-(t - f) / 4) : 0), 0);
    const s =
      (0.46 * Math.min(1.15, pop) + 0.9 * flash + tightenFlash) * (1 + 0.9 * tween(t, K.orbIn, [0, 1], EASE.in2)) * opacity +
      (t >= I ? 0.8 * Math.exp(-(t - I) / 4) : 0);
    glows.push({ x: scr.x, y: scr.y, r: d * (1.35 + 0.5 * flash) * (t >= I ? 1.15 : 1), s, color: rgb01(glowBody), back: o.z < 0 && !merged });
    // the pop's accents: a ring in the light's wave colour and a burst of sparks
    const pu = t - K.orbPops[o.i];
    if (pu >= 0 && pu < 12) {
      const e = EASE.out3(pu / 12);
      ringsDom.push({ x: scr.x, y: scr.y, r: (d / 2) * mix(1.02, 1.9, e), w: mix(3.5, 0.8, e), color: LIGHTS[o.id].orb[3], o: 0.85 * (1 - e) * (o.z < -0.2 ? 0.35 : 1) });
      // six sparks fly off the rim, decelerating; each is a tapered streak whose
      // tail is where its head was 2 f ago (motion blur by construction)
      const at = (uu: number, k: number) => {
        const a = (k / 6) * Math.PI * 2 + 0.5 + random(`cta-spark-${o.i}-${k}`) * 0.6;
        const far = (d / 2) * 1.02 + (46 + 50 * random(`cta-spark-r-${o.i}-${k}`)) * EASE.out3(Math.min(1, Math.max(0, uu) / 10));
        return { x: scr.x + Math.cos(a) * far, y: scr.y + Math.sin(a) * far };
      };
      for (let k = 0; k < 6; k++) {
        const h = at(pu, k);
        const tl = at(pu - 2, k);
        sparks.push({
          x0: tl.x,
          y0: tl.y,
          x1: h.x,
          y1: h.y,
          color: LIGHTS[o.id].orb[3],
          o: Math.pow(1 - pu / 12, 1.4) * (o.z < -0.2 ? 0.3 : 1),
          w: 2.6,
        });
      }
    }
  }
  const orbs: HeroOrbs = { back, front };
  const u: HeroUniforms = {
    ...u0,
    occ: 1 - tween(t, K.unhide, [0, 1], EASE.inOut),
    glows: glows.slice(0, 4),
    // her eyes carry her voice (0.25 · the real envelope, plus a whisper while she speaks)
    eyeGlow: t >= CTA.line && t < K.erase[0] + 6 ? 0.25 * lineEnv(t) + 0.05 * windowed(t, CTA.line, CTA.line + 4, K.erase[0], K.erase[0] + 6) : 0,
    rim: [0.16 * tween(t, K.rimIn, [0, 1], EASE.inOut), 0.93, 0.13, 2.25],
    rimColors: LIGHT_ORDER.map((id) => rgb01(LIGHTS[id].orb[2])),
  };

  /* ── iris ── */
  const irisAt = (tt: number) => tween(tt, K.iris, [0, Math.hypot(L.width, L.height)], EASE.peel);
  const irisR = irisAt(t);
  const irisV = Math.abs(irisAt(t + 0.5) - irisAt(t - 0.5));
  // the edge is feathered by its own speed (6–14 px on the fastest frames)
  const feather = mix(6, 14, Math.min(1, irisV / 160));
  const mask =
    t < K.iris[1]
      ? `radial-gradient(circle at ${G.iris.x}px ${G.iris.y}px, #000 ${Math.max(0, irisR - feather).toFixed(1)}px, transparent ${irisR.toFixed(1)}px)`
      : undefined;

  /* ── headline: each word on its spoken word ── */
  const spec: HeadlineSpec = {
    ...G.headline,
    P: G.P,
    wordAt: CTA.lineWords.map((w) => CTA.line + vWord(CTA.lineVoice, w) - K.riseLead),
    marksAt: K.marks,
    collapse: K.collapse,
    marksCollapse: K.marksIn,
  };
  const reach = Math.hypot(L.width, L.height) * 0.62;
  const streaks = buildStreaks(K.streaks[0], K.streaks[1], G.P, L.width, L.height);
  const rings = K.rings.map((r0, i) => ({ t0: K.streaks[0] + 4 + i * 5, t1: I - 3 + i, r0: reach * r0 }));

  /* the gathering light at the core (the four lights' merged glow) */
  const coreGrow = tween(t, [K.core[0], K.pullBack[0]], [0, 1], EASE.out3);
  const bloom = t >= I ? 0 : coreGrow * L.pick(640, 580) * (1 - 0.35 * pull);
  const bloomHot = 0.6 + 0.4 * pull;

  /* the eyes' last light slides into the core (screen space, like the hero) */
  const Pscr = onLayer(L, G.P, cam, 1);
  const eyeZ = G.frame.zoom * zoom;
  const eyeOff = art.eye[0] * eyeZ * L.width;
  const eyeX0 = art.axis * L.width;
  const eyeGlowO = windowed(t, K.eyeGlow[0], K.eyeGlow[1], K.eyeGlow[1] + 2, K.eyeGlow[2], EASE.out3, EASE.in2);
  const slideAt = (tt: number) => tween(tt, [K.eyeGlow[1], K.eyeGlow[2]], [0, 1], EASE.in2);

  /* impact accents */
  const flash = t === I ? 0.35 : t === I + 1 ? 0.18 : 0;
  const ringAt = (tt: number) => mix(G.ring[0], G.ring[1], tween(tt, K.ring, [0, 1], EASE.expo));
  const ringO = t >= I && t <= K.ring[1] ? 1 - tween(t, K.ring, [0, 1], EASE.out3) : 0;

  /* logo */
  const logoScale = t < I ? 1.25 : rest(t, mix(1.25, 1, land), 1);
  const logoPrev = t - 1 < I ? 1.25 : mix(1.25, 1, springAt(t - 1, I, SPRING.heavy));
  const logoBlur = t < I ? 0 : rest(t, Math.min(6, Math.abs(logoScale - logoPrev) * G.logoW * 0.08 + cam.shake * 0.3), 0);
  const logoO = t < I ? 0 : tween(t, [I, I + 1], [0.8, 1], EASE.out3);

  const dustO = 0.6 * (1 - tween(t, K.dustOut, [0, 1], EASE.inOut));

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ WebkitMaskImage: mask, maskImage: mask, background: C.night }}>
        <HeroGL art={art} width={L.width} height={L.height} u={u} orbs={orbs} />
        <Glint t={t} x0={eyeX0} off={eyeOff} y={G.P.y} eyeZ={eyeZ} art={art} W={L.width} />
        {eyeGlowO > 0.01 ? (
          <EyeLight
            o={eyeGlowO}
            at={(tt, side) => {
              const k = slideAt(tt);
              return { x: mix(eyeX0 + side * eyeOff, Pscr.x, k), y: mix(G.P.y, Pscr.y, k), k };
            }}
            t={t}
          />
        ) : null}
        <PopAccents rings={ringsDom} sparks={sparks} w={L.width} h={L.height} />
        <Camera x={cam.x} y={cam.y} zoom={cam.zoom}>
          <Layer depth={1}>
            <Headline t={t} spec={spec} />
          </Layer>
          <Layer depth={1.3}>
            <Streaks t={t} P={G.P} streaks={streaks} rings={rings} width={L.width} height={L.height} />
          </Layer>
          <Layer depth={1}>
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
                  background: `radial-gradient(circle, ${rgbaHex(ALL_GLOW.core, 0.3 * bloomHot)} 0%, ${rgbaHex(ALL_GLOW.body, 0.14 * bloomHot)} 35%, ${rgbaHex(ALL_GLOW.body, 0)} 70%)`,
                }}
              />
            ) : null}
            {ringO > 0.01 ? <Shockwave P={G.P} r={ringAt(t)} rPrev={ringAt(t - 0.35)} o={ringO} w={L.width} h={L.height} /> : null}
            {/* the logo; a soft contact shadow under the crown only (never under the wordmark) */}
            {t >= I ? (
              <div
                style={{
                  position: 'absolute',
                  left: G.P.x - G.logoW / 2,
                  top: G.P.y - G.logoH / 2,
                  width: G.logoW,
                  height: G.logoH,
                  transform: logoScale !== 1 ? `scale(${logoScale.toFixed(4)})` : undefined,
                  opacity: logoO,
                }}
              >
                <Img
                  src={staticFile('img/logo.png')}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    transform: 'translate(0px, 14px)',
                    filter: 'brightness(0) blur(16px)',
                    opacity: 0.18,
                    WebkitMaskImage: 'linear-gradient(to bottom, #000 0%, #000 70%, transparent 82%)',
                    maskImage: 'linear-gradient(to bottom, #000 0%, #000 70%, transparent 82%)',
                  }}
                />
                <Img
                  src={staticFile('img/logo.png')}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    filter: [
                      logoBlur > 0.1 ? `blur(${logoBlur.toFixed(2)}px)` : '',
                      voiceGlow > 0.01 ? `drop-shadow(0 0 ${(6 + 14 * voiceGlow).toFixed(1)}px rgba(185,163,255,${(0.55 * voiceGlow).toFixed(3)}))` : '',
                    ]
                      .join(' ')
                      .trim() || undefined,
                  }}
                />
              </div>
            ) : null}
            <Row y={G.button.y}>
              <CoverCta t={t} at={CTA.button} press={CTA.press} fontSize={G.button.fontSize} rest={rest} />
            </Row>
            <Row y={G.note.y}>
              <Note t={t} at={CTA.note} size={G.note.size} rest={rest} />
            </Row>
            <Row y={G.url.y}>
              <Url t={t} at={CTA.url} size={G.url.size} dot={G.url.dot} ruleW={L.width - 2 * L.safe.x} step={K.urlStep} rest={rest} />
            </Row>
          </Layer>
          {dustO > 0.005 ? (
            <Layer depth={1.5}>
              <Dust count={26} seed="cta-dust" color="185,163,255" opacity={dustO} speed={0.3} size={[2, 9]} blur={[0, 5]} />
            </Layer>
          ) : null}
        </Camera>
        {flash > 0 ? <AbsoluteFill style={{ background: C.white, opacity: flash }} /> : null}
      </AbsoluteFill>
      {t < K.iris[1] + 1 ? <IrisRim t={t} r={irisR} rPrev={irisAt(t - 0.5)} x={G.iris.x} y={G.iris.y} w={L.width} h={L.height} /> : null}
    </AbsoluteFill>
  );
};

const rgbaHex = (hex: string, a: number) => {
  const [r, g, bb] = hexToRgb(hex);
  return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(bb * 255)},${Math.max(0, a).toFixed(3)})`;
};

const Row: React.FC<{ y: number; children: React.ReactNode }> = ({ y, children }) => (
  <div style={{ position: 'absolute', left: 0, right: 0, top: y, display: 'flex', justifyContent: 'center', transform: 'translateY(-50%)' }}>
    {children}
  </div>
);

/**
 * The catch-light: ON her first word a 6 px white glint (60 %) sweeps across
 * both irises in 4 frames, with a sub-frame trail.
 */
const Glint: React.FC<{
  t: number;
  x0: number;
  off: number;
  y: number;
  eyeZ: number;
  art: { eye: [number, number, number] };
  W: number;
}> = ({ t, x0, off, y, eyeZ, art, W }) => {
  const [a, c] = K.glint;
  if (t < a || t > c) return null;
  const iris = art.eye[2] * 0.42 * eyeZ * W; // iris half-width on screen
  const at = (tt: number) => tween(tt, [a, c], [-1, 1], EASE.inOut);
  const o = 0.6 * Math.sin(Math.PI * tween(t, [a, c], [0, 1]));
  const els: React.ReactNode[] = [];
  [-1, 1].forEach((side) => {
    [0.5, 0.25, 0].forEach((back, j) => {
      const k = at(t - back);
      els.push(
        <div
          key={`${side}-${j}`}
          style={{
            position: 'absolute',
            left: x0 + side * off + k * iris - 3,
            top: y - iris * 0.3 - 3 + k * iris * 0.12,
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#ffffff',
            opacity: o * (j === 2 ? 1 : 0.3 * (j + 1)),
            boxShadow: '0 0 6px rgba(255,255,255,0.8)',
          }}
        />,
      );
    });
  });
  return <AbsoluteFill>{els}</AbsoluteFill>;
};

/** The pops' accents: expanding rings in each light's colour and short spark streaks. */
const PopAccents: React.FC<{
  rings: { x: number; y: number; r: number; w: number; color: string; o: number }[];
  sparks: { x0: number; y0: number; x1: number; y1: number; color: string; o: number; w: number }[];
  w: number;
  h: number;
}> = ({ rings, sparks, w, h }) => {
  if (!rings.length && !sparks.length) return null;
  return (
    <svg width={w} height={h} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
      {rings.map((r, i) => (
        <g key={`r${i}`}>
          <circle cx={r.x} cy={r.y} r={r.r} fill="none" stroke={r.color} strokeOpacity={0.25 * r.o} strokeWidth={r.w * 4} />
          <circle cx={r.x} cy={r.y} r={r.r} fill="none" stroke={r.color} strokeOpacity={r.o} strokeWidth={r.w} />
        </g>
      ))}
      <defs>
        {sparks.map((s, i) => (
          <linearGradient key={i} id={`cta-spark-g-${i}`} gradientUnits="userSpaceOnUse" x1={s.x0} y1={s.y0} x2={s.x1} y2={s.y1}>
            <stop offset="0" stopColor={s.color} stopOpacity={0} />
            <stop offset="0.7" stopColor={s.color} stopOpacity={0.6 * s.o} />
            <stop offset="1" stopColor="#ffffff" stopOpacity={s.o} />
          </linearGradient>
        ))}
      </defs>
      {sparks.map((s, i) =>
        s.o > 0.01 ? (
          <line key={`s${i}`} x1={s.x0} y1={s.y0} x2={s.x1} y2={s.y1} stroke={`url(#cta-spark-g-${i})`} strokeWidth={s.w} strokeLinecap="round" />
        ) : null,
      )}
    </svg>
  );
};

/**
 * The iris edge: a thin lilac line with an electric glow, motion-blurred —
 * a half-frame shutter smears it radially inward (a radial gradient over the
 * distance it travelled), and the crisp line thins as it speeds up.
 */
const IrisRim: React.FC<{ t: number; r: number; rPrev: number; x: number; y: number; w: number; h: number }> = ({
  t,
  r,
  rPrev,
  x,
  y,
  w,
  h,
}) => {
  const o = tween(t, [K.iris[0], K.iris[0] + 2], [0, 1], EASE.out3) * (1 - tween(t, [K.iris[1] - 5, K.iris[1] + 1], [0, 1], EASE.in2));
  if (o <= 0.01 || r < 1) return null;
  const smear = Math.max(0, r - rPrev);
  const crisp = 1 / (1 + smear / 60); // a fast edge spreads its light over the smear
  const inner = Math.max(0, (r - smear) / r);
  return (
    <svg width={w} height={h} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
      {smear > 3 ? (
        <>
          <defs>
            <radialGradient id="cta-iris-smear" gradientUnits="userSpaceOnUse" cx={x} cy={y} r={r}>
              <stop offset={inner.toFixed(4)} stopColor="rgb(124,58,237)" stopOpacity={0} />
              <stop offset={mix(inner, 1, 0.75).toFixed(4)} stopColor="rgb(124,58,237)" stopOpacity={0.1 * o} />
              <stop offset="1" stopColor="rgb(185,163,255)" stopOpacity={0.32 * o} />
            </radialGradient>
          </defs>
          <circle cx={x} cy={y} r={r} fill="url(#cta-iris-smear)" />
        </>
      ) : null}
      <circle cx={x} cy={y} r={r + 6} fill="none" stroke={`rgba(124,58,237,${0.1 * o})`} strokeWidth={26 + smear * 0.15} />
      <circle cx={x} cy={y} r={r + 2} fill="none" stroke={`rgba(124,58,237,${0.28 * o})`} strokeWidth={9} />
      <circle cx={x} cy={y} r={r} fill="none" stroke={`rgba(185,163,255,${(0.95 * o * (0.45 + 0.55 * crisp)).toFixed(3)})`} strokeWidth={2} />
    </svg>
  );
};

/**
 * The impact shockwave: centred on the logo, it leaves from the merged orb's
 * edge. A white core with a thin night inner edge so it reads on the silver
 * as well as on the night; a radial smear behind it.
 */
const Shockwave: React.FC<{ P: { x: number; y: number }; r: number; rPrev: number; o: number; w: number; h: number }> = ({
  P,
  r,
  rPrev,
  o,
  w,
  h,
}) => {
  const smear = Math.max(0, r - rPrev);
  const inner = Math.max(0, (r - smear) / r);
  const width = mix(1.4, 3, o);
  return (
    <svg width={w} height={h} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
      {smear > 3 ? (
        <>
          <defs>
            <radialGradient id="cta-shock-smear" gradientUnits="userSpaceOnUse" cx={P.x} cy={P.y} r={r}>
              <stop offset={inner.toFixed(4)} stopColor="#ffffff" stopOpacity={0} />
              <stop offset="1" stopColor="#ffffff" stopOpacity={0.1 * o} />
            </radialGradient>
          </defs>
          <circle cx={P.x} cy={P.y} r={r} fill="url(#cta-shock-smear)" />
        </>
      ) : null}
      <circle cx={P.x} cy={P.y} r={Math.max(1, r - width)} fill="none" stroke={`rgba(6,4,10,${(0.4 * o).toFixed(3)})`} strokeWidth={width} />
      <circle cx={P.x} cy={P.y} r={r} fill="none" stroke={`rgba(255,255,255,${(0.14 * o).toFixed(3)})`} strokeWidth={14} />
      <circle cx={P.x} cy={P.y} r={r} fill="none" stroke={`rgba(255,255,255,${(0.95 * o).toFixed(3)})`} strokeWidth={width} />
    </svg>
  );
};

/**
 * The eyes' last light: two lilac glints where the eyes were, sliding into
 * the core, accelerating, with a short sub-frame trail.
 */
const EyeLight: React.FC<{
  t: number;
  o: number;
  at: (tt: number, side: number) => { x: number; y: number; k: number };
}> = ({ t, o, at }) => {
  const els: React.ReactNode[] = [];
  [-1, 1].forEach((side) => {
    [0.66, 0.33, 0].forEach((back, j) => {
      const q = at(t - back, side);
      const size = mix(90, 40, q.k);
      const a = o * (j === 2 ? 1 : 0.3 * (j + 1));
      els.push(
        <div
          key={`${side}-${j}`}
          style={{
            position: 'absolute',
            left: q.x - size / 2,
            top: q.y - size / 2,
            width: size,
            height: size,
            borderRadius: '50%',
            opacity: a,
            background:
              'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(185,163,255,0.8) 16%, rgba(124,58,237,0.3) 42%, rgba(124,58,237,0) 70%)',
          }}
        />,
      );
    });
  });
  return <AbsoluteFill>{els}</AbsoluteFill>;
};
