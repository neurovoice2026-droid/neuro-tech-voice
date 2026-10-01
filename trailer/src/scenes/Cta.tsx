/**
 * CTA (the last 11 s) — Ava's voice-over; the four lights become one; the logo;
 * then an end card that builds CALMLY, one element at a time (client: "the
 * ending is too fast"). Every frame below is CTA-local and comes from timing.ts
 * (CTA, CTA_LOCAL), which derives the converge, the impact and the end card
 * from her real voice.
 *
 *   iris      a dark circle opens from FLOW_END (the scale's last node), its
 *             rim smeared and its edge feathered by its own speed
 *   0…24      HERO: the site's cover portrait out of black — the eyes first
 *             (a slow push-in from the first frame, a catch-light as the iris
 *             completes and another ON her first word), then a soft radial
 *             opening whose light rises evenly (revealAt); the room's backlight
 *             carries the night's lilac until the four lights take over
 *   line      Ava: "AI voice agents that book your customers. Twenty four
 *             seven." — each headline word rises ON its spoken word ("24/7."
 *             on "Twenty") over a soft dark pool (so no orb's bloom washes it);
 *             her eyes glow with her real voice envelope
 *   orbPops   THE FOUR LIGHTS pop in on 8ths — rush, closing, sunday, night.
 *             Each: a point of its light gathers (3 f), and ON the beat (the
 *             brightest frame) the flash, a ring, six sparks and a camera kick,
 *             the orb already ⅓ out, overshooting ≈15 %, settled in ~12 f. As
 *             they arrive the room's silver backlight dims to 45 % so they are
 *             the brightest things in frame (blooms + halation: emitters).
 *             They orbit her face in depth — the front of the ring under her
 *             chin, the back behind her head (hidden by her head, rimming her)
 *   tighten   ON "Twenty" "four" "seven" the ring tightens and the four lights
 *             come forward into a row under her chin; while the line is read
 *             (CTA_LOCAL.drift) the row keeps drawing in, slowly
 *   converge  after a breath: the row fans into four arms, swells
 *             (anticipation) and spirals into the core, accelerating,
 *             motion-blurred; her HEAD frays in filaments that glow in the
 *             nearest light's colour (capped at her head + 40 px), her eyes go
 *             last as two points of lilac; the stage behind her collapses
 *             radially into the core (stageOut) — the merge plays on black
 *   merge     each keeps its own light until they touch; the three pour into
 *             the survivor, which holds ALONE (survivor) — 2×, its mesh
 *             swirling all four hues, its bloom split into the four colours
 *   impact    the survivor blows out into a white-lilac light: the logo lands
 *             1.25 → 1 on SPRING.heavy, white flash, shockwave, ±6 px shake; the
 *             merged light BLOOMS out of the core behind it (round, then
 *             settling under the wordmark), then the four lights come up as
 *             four arcs on its rim — the logo lands ALONE
 *   brand     Ava: "Neuro Tech Voice." a beat after the impact; the URL types ON
 *             her words ("neuro" | "tech" | "voice.com"); the crown glows with
 *             her voice; "Start free →" unfolds out of a point of light and
 *             RISES on "…Voice." (soft spring); the note follows, word by word;
 *             then the press (hover lift, squash, the plum floods from the
 *             arrow, a ripple, a glint) and it keeps the site's hover
 *   finalHold → end: dead still — nothing moves but the global grain
 *
 * Parallax: art (in-shader orbit) · halo 0.3 · orbs 0.8–1.25 by depth ·
 * type/logo/button 1 · streaks 1.3 · dust 1.5.
 *
 * ONE WebGL context: HeroGL draws the portrait, the halo AND the four orbs.
 */
import React from 'react';
import { AbsoluteFill, Easing, Img, random, staticFile } from 'remotion';
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
  // 9:16: the whole film-to-end-card stack lives inside the social safe zone
  // (y 250 – 1500): her eyes / the logo (P) sit higher, the headline and the
  // end card's last line end above y 1500
  const P = { x: L.cx, y: L.pick(L.cy - 170, 650) };
  const logoW = L.pick(500, 660);
  const logoH = logoW * LOGO_RATIO;
  const wordmark = { top: P.y - logoH / 2 + logoH * WORDMARK_TOP, bottom: P.y + logoH / 2 };
  // the plate is 2.8em tall: label line (1.2em) + label padding (.8em × 2); phone-legible
  // label (≥ 64 / 56 px)
  const button = { y: L.pick(712, 1112), fontSize: L.pick(68, 66) };
  return {
    P,
    logoW,
    logoH,
    wordmark,
    /** halo centre sits under the logo centre so the wordmark is deep in the light */
    haloC: { x: P.x, y: P.y + L.pick(64, 80) },
    /**
     * rx, ry above, ry below. BEFORE the impact: the art's own wide silver
     * backlight (the figure is erased to it; it collapses into the core with
     * her — CTA_LOCAL.stageOut). AFTER: the merged light, a lilac-white light
     * hugging the logo that BLOOMS out of the core on the impact (soft
     * spring): the wordmark stays in the light (hr ≤ .86), its lit edge clear
     * of the frame top (16:9: ≥ 90 px), the button on the night
     */
    haloR: L.pick([720, 570, 205] as const, [620, 660, 290] as const),
    haloEnd: L.pick([410, 318, 176] as const, [470, 450, 232] as const),
    haloPow: 2,
    /**
     * once the logo is in, the light's underside settles under the wordmark
     * so the button sits on the night: the floor starts just under the
     * wordmark (at the axis), its length, strength, and how far its edge
     * curves up at ±rx
     */
    floor: L.pick({ y: wordmark.bottom + 12, len: 120, k: 0.55, rise: 110 }, { y: wordmark.bottom + 18, len: 160, k: 0.35, rise: 140 }),
    /** the reveal's light band (half-diagonals), see revealAt */
    reveal: L.pick([0.22, 0.88] as const, [0.28, 0.86] as const),
    /**
     * the art's framing: base zoom, glitch-band edge (v), and the 9:16 crop's
     * shoulder line (v) above which its backlight feathers out. 9:16 is drawn
     * at 1.2 (was 1.36): the 900 × 1600 portrait is upscaled less, so her face
     * stays crisp; the band the wider crop could reach is filled and scrimmed
     */
    frame: L.pick({ zoom: 1.02, band: 0, edge: 0 }, { zoom: 1.2, band: 0.15, edge: 0.632 }),
    /** the dolly into the eyes over the scene (9:16 pushes less: the crop is already close) */
    dolly: L.pick(0.12, 0.07),
    headline: {
      lines: L.pick(['AI voice agents that book', 'your customers 24/7.'], ['AI voice agents', 'that book your', 'customers 24/7.']),
      fontSize: L.pick(76, 84),
      // 9:16: the three rows run ≈ y 1190 – 1450 (marks 1175 – 1465): all above the caption UI
      cy: L.pick(880, 1320),
      markGap: 28,
    },
    /** a soft dark pool under the headline (radial, ≈40 % ink) so an orb's bloom never washes the type */
    scrim: L.pick({ w: 1500, h: 430 }, { w: 1080, h: 560 }),
    button,
    note: { y: L.pick(872, 1272), size: L.pick(64, 56) },
    url: { y: L.pick(982, 1380), size: L.pick(64, 56), dot: L.pick(22, 20), rule: L.pick(1400, L.width - 2 * L.safe.x) },
    /** the four lights' orbit about her face: radii, ring centre drop below the eyes, tilt, orb diameter */
    orbit: L.pick(
      // the ring's centre sits at her mouth, so its front passes under her
      // chin (≈ y 730, clear of the headline), its back behind her forehead
      { rx: 560, ry: 210, drop: 150, tilt: -0.09, d: 130, tight: 0.75, formDrop: 30 },
      // 9:16: the ring runs wide (the two that pop "behind" pop beside her cheeks, in view) and
      // sits higher, so its front (and the formation row under her chin) stays above the
      // headline (orb bottoms ≤ y ≈ 1150)
      { rx: 430, ry: 205, drop: 196, tilt: -0.08, d: 128, tight: 0.55, formDrop: 50, phase: [0.7, 1.95, 4.35, 5.6] },
    ),
    /** the shockwave leaves from the merged orb, out past the frame */
    ring: [60, L.pick(1150, 1100)] as const,
    iris: FLOW_END(L),
  };
}

/* ── camera ───────────────────────────────────────────────────────── */
function cameraAt(t: number) {
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
    // (the end card builds calmly: no kick on the button's rise) — only the click is felt, a
    // small push that eases in over 2 f and dies away
    const u = t - (CTA.press + K.pressDown);
    if (u >= 0) zoom += 0.006 * Math.exp(-u / 5) * Math.min(1, u / 2);
  }
  return { x: rest(t, x, 0), y: rest(t, y, 0), zoom: rest(t, zoom, 1), shake: rest(t, shake, 0) };
}

/** where a point on a Layer of `depth` lands on screen (Camera.tsx's transform) */
function onLayer(L: Layout, p: { x: number; y: number }, cam: { x: number; y: number; zoom: number }, depth: number) {
  const z = 1 + (cam.zoom - 1) * depth;
  return { x: L.cx + (p.x - L.cx) * z - cam.x * depth, y: L.cy + (p.y - L.cy) * z - cam.y * depth, z };
}

const rgb01 = (hex: string) => hexToRgb(hex) as [number, number, number];
/** in-cubic: the stage leaves slowly, then is swallowed */
const IN3 = Easing.bezier(0.55, 0.055, 0.675, 0.19);
/** the merged light opening behind the logo: ≈4 % over, settled in ≈16 f (a bloom, not a pop) */
const BLOOM = { stiffness: 130, damping: 16.5, mass: 1 };
/** the reveal's light curve: starts at ≈1.5× its mean rate, settles softly */
const REVEAL = Easing.bezier(0.33, 0.5, 0.45, 1);
/**
 * The radial reveal's radius (frame half-diagonals). The frame's light comes
 * in between radii lo…hi (measured on the art: her backlight sits just
 * outside the head), following ≈ smoothstep(lo, hi, R); so R is driven
 * through the INVERSE of that, and the light rises on the REVEAL curve —
 * evenly, decelerating — instead of slamming in while R crosses the band.
 * The last 12 % of the window opens the rest of the frame (no light there).
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
  if (t < K.iris[0]) return null;
  const G = geo(L);
  const art = L.vertical ? HERO_ART.portrait : HERO_ART.landscape;
  const cam = cameraAt(t);

  /* ── hero uniforms ── */
  const orbit = tween(t, [-8, I + 5], [0, 1], EASE.inOut);
  const pull = tween(t, K.pullBack, [0, 1], EASE.inOut);
  const land = t < I ? 0 : rest(t, springAt(t, I, SPRING.heavy), 1);
  const flare = t < I ? 0 : rest(t, Math.exp(-(t - I) / 7), 0);
  // the halo breathes under the end card, then its amplitude eases to 0 into the hold, where it freezes
  const breathAmp = tween(t, [K.breath, K.breath + 30], [0, 1], EASE.inOut) * (1 - tween(t, K.breathOut, [0, 1], EASE.inOut));
  const breath = t < K.breath || t >= K.breathOut[1] ? 0 : Math.sin(((t - K.breath) / 75) * Math.PI * 2) * breathAmp;
  // BEFORE the impact: the art's wide backlight — the stage. As she is erased it collapses
  // radially into the core (scale 1 → .4, light → 0, in-cubic): the merge plays on black.
  // ON the impact the merged light BLOOMS out of the core onto the logo (soft spring, ≈4 % over)
  const stage = tween(t, K.stageOut, [0, 1], IN3); // its size: leaves slowly, then is swallowed
  const stageLight = tween(t, [K.stageOut[0], K.stageOut[1] - 4], [0, 1], EASE.inOut); // its light: out a little before
  const bloomS = t < I ? 0 : rest(t, springAt(t, I, BLOOM), 1);
  const haloScale = t < I ? (1 - 0.05 * pull) * mix(1, 0.4, stage) : mix(K.bloomFrom, 1, bloomS);
  const hC = onLayer(
    L,
    t < I ? { x: G.haloC.x, y: mix(G.haloC.y, G.P.y, stage) } : { x: G.haloC.x, y: mix(G.P.y, G.haloC.y, Math.min(1, bloomS)) },
    cam,
    0.3,
  );
  // (the merged light opens ROUND from the core, then settles into its shape under the wordmark)
  const haloShape = t < I ? G.haloR : ([G.haloEnd[0], G.haloEnd[1], mix(G.haloEnd[1], G.haloEnd[2], Math.min(1, bloomS))] as const);
  const haloR = [0, 1, 2].map((k) => haloShape[k] * hC.z * haloScale) as [number, number, number];
  // while the lights are in frame the room's silver backlight steps down (they lead);
  // it returns ON the impact as their merged light
  const backGain = t < I ? mix(1, 0.45, tween(t, K.backDim, [0, 1], EASE.inOut)) : 1;
  // the halo takes the merged light's colour as the four become one, fully ON the impact
  const tint = t < I ? tween(t, [K.merge[0], I], [0, 0.12], EASE.inOut) : 1;
  // the dolly into the eyes, plus the slow push from the first frame they show
  const eyePush = 1 + 0.06 * tween(t, K.eyePush, [0, 1], EASE.out3);
  const zoom = mix(1.0, 1 + G.dolly, tween(t, [-8, I], [0, 1], EASE.inOut)) * eyePush;
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
    // blooms from the eyes and decelerates into the figure: the radius grows so the lit
    // AREA (≈ the frame's light) rises evenly, on a gentle out-curve (no dead hold, no slam)
    reveal: revealAt(t, G.reveal),
    eyes: tween(t, K.eyes, [0, 1], EASE.out3),
    haloC: [hC.x, hC.y] as [number, number],
    haloR,
    haloGain: rest(
      t,
      (t < I ? backGain * (1 - 0.06 * pull) * (1 - stageLight) : mix(0.6, 1, Math.min(1, bloomS))) *
        (1 + 0.32 * flare) *
        (1 + 0.009 * breath) *
        (1 + 0.025 * voiceGlow),
      1,
    ),
    floor: [
      onLayer(L, { x: L.cx, y: G.floor.y }, cam, 0.3).y,
      G.floor.len * hC.z,
      G.floor.k * tween(t, [I + 4, CTA.button + 10], [0, 1], EASE.inOut),
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
  const camPrev = cameraAt(t - 0.5);
  const camNext = cameraAt(t + 0.5);
  // the flow follows her voice, quickens in the whirl, and the survivor's mesh swirls hard
  const survivor = windowed(t, K.merge[0], K.survivor[0], I - 1, I + 4, EASE.out3, EASE.in2);
  const vol = (s: number) =>
    0.12 + 0.75 * lineEnv(s) + 0.6 * tween(s, K.orbIn, [0, 1], EASE.in2) + 1.4 * windowed(s, K.merge[0], K.survivor[0], I - 1, I + 4, EASE.out3, EASE.in2);
  const flow = flowTime(Math.max(0, t), vol);
  const burstU = tween(t, K.burst, [0, 1], EASE.out3);
  const back: OrbDraw[] = [];
  const front: OrbDraw[] = [];
  const glows: HeroUniforms['glows'] = [];
  const ringsDom: { x: number; y: number; r: number; w: number; color: string; o: number }[] = [];
  const sparks: { x0: number; y0: number; x1: number; y1: number; color: string; o: number; w: number }[] = [];
  const merged = t >= K.merge[0];
  const order = [...now].sort((a, c) => (merged ? (a.i === 3 ? 1 : c.i === 3 ? -1 : a.z - c.z) : a.z - c.z));
  const tightenFlash = K.tighten.reduce((a, f) => a + (t >= f ? 0.3 * Math.exp(-(t - f) / 4) : 0), 0);
  for (const o of order) {
    const depthPar = 1 + 0.25 * o.z * Math.min(1, radiusAt(t, G.orbit.tight));
    const scr = onLayer(L, o, cam, depthPar);
    const sp = onLayer(L, prev[o.i], camPrev, depthPar);
    const sn = onLayer(L, next[o.i], camNext, depthPar);
    const pop = o.pop;
    // the hit frame (pu = 0) is the brightest frame of each light
    const pu = t - K.orbPops[o.i];
    const flash = pu >= 0 ? Math.exp(-pu / 3) : 0;
    const light = GLOW[o.id];
    const toAll = o.i === 3 ? tween(t, K.merge, [0, 1], EASE.inOut) : 0;
    // light, not paint: the bloom is the orb's body colour lifted toward its core
    const glowBody = mixColor(mixColor(light.body, light.core, 0.4), ALL_GLOW.body, toAll);
    // the orb's full size here (its pop aside), for the accents
    const full = G.orbit.d * scr.z;
    // after the impact only the survivor bursts, then nothing
    let d = o.d * scr.z;
    let opacity = o.opacity;
    if (t >= I) {
      if (o.i !== 3) continue;
      d *= mix(1, 2.8, burstU);
      opacity = t >= K.burst[1] ? 0 : Math.pow(1 - burstU, 2);
    }
    // anticipation: a point of its light gathers over the 3 f before the beat, peaks
    // ON it (inside the flash) and hands over to the orb over the next 2–3 f
    const gather = pu < -3 ? 0 : pu < 0 ? Math.sin(((pu + 3) / 3) * (Math.PI / 2)) : Math.max(0, 1 - pu / 2.5);
    const shown = pop > 0 && d >= 1 && opacity > 0.002;
    if (shown) {
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
    }
    // ONE bloom per light (the shader has four): the gathering point, the pop's flash,
    // its steady light (an emitter: ≈.75), the whirl's, the survivor's (≥1.2, 2.2 d)
    let gs = gather > 0 ? 0.8 * gather : 0;
    let gr = gather > 0 ? full * (0.22 + 0.3 * gather) : 0;
    if (shown) {
      const steady = (0.75 * Math.min(1.15, pop) + 1.1 * flash + tightenFlash) * (1 + 0.3 * tween(t, K.orbIn, [0, 1], EASE.in2)) * opacity;
      const s = mix(steady, 1.25, o.i === 3 ? survivor : 0) + (t >= I ? 0.8 * Math.exp(-(t - I) / 3.5) : 0);
      // (after the impact the bloom stays the merged orb's size: a hot core round the crown, not a wash)
      const gd = t >= I ? o.d * scr.z * 1.3 : Math.max(d, full * 0.8 * Math.min(1, flash * 2));
      const r = mix(gd * (1.35 + 0.6 * flash), 1.9 * d, o.i === 3 ? survivor : 0);
      gs = Math.min(1.6, gs + s);
      gr = Math.max(gr, r);
    }
    // the burst: a white-lilac light from the core, hot for 2–3 frames as the merged
    // light opens behind the logo — light, never a flat purple disc
    let burstLight = false;
    if (t >= I && o.i === 3) {
      gs = 1.3 * Math.exp(-(t - I) / 2.5);
      gr = mix(o.d * scr.z * 1.2, G.haloEnd[0] * 0.95, burstU);
      burstLight = true;
    }
    if (o.i === 3 && survivor > 0.01 && t < I) {
      // the survivor carries all four: its bloom splits into the four lights' colours,
      // swirling about it with its mesh (the three fading lights hand it their slots)
      const sw = (t - K.merge[0]) * 0.32;
      LIGHT_ORDER.forEach((id, k) => {
        const a = sw + (k * Math.PI) / 2;
        glows.push({
          x: scr.x + Math.cos(a) * d * 0.62,
          y: scr.y + Math.sin(a) * d * 0.62,
          r: d * 0.8,
          s: 0.85 * survivor,
          color: rgb01(LIGHTS[id].orb[2]),
          back: false,
        });
      });
      gs *= 1 - 0.55 * survivor;
    }
    if (gs > 0.001) glows.push({ x: scr.x, y: scr.y, r: gr, s: gs, color: rgb01(burstLight ? mixColor(ALL_GLOW.body, ALL_GLOW.core, 0.6) : gather > flash && !shown ? LIGHTS[o.id].orb[3] : glowBody), back: o.z < 0 && !merged });
    // ON "Twenty" "four" "seven": each orb answers the word with a thin ring
    if (shown)
      K.tighten.forEach((f) => {
        const tu = t - f;
        if (tu < 0 || tu >= 10) return;
        const e = EASE.out3(tu / 10);
        ringsDom.push({ x: scr.x, y: scr.y, r: (d / 2) * mix(1.0, 1.55, e), w: mix(2.2, 0.6, e), color: LIGHTS[o.id].orb[3], o: 0.6 * (1 - e) * (o.z < -0.2 ? 0 : 1) });
      });
    // the pop's accents, from the hit frame on: a ring in the light's colour and a burst of sparks
    if (pu >= 0 && pu < 12) {
      const e = EASE.out3(pu / 12);
      const hide = o.z < -0.2 ? 0.35 : 1;
      ringsDom.push({ x: scr.x, y: scr.y, r: (full / 2) * mix(0.75, 1.9, e), w: mix(4, 0.8, e), color: LIGHTS[o.id].orb[3], o: 0.9 * (1 - e) * hide });
      // six sparks fly off the rim, decelerating; each is a tapered streak whose
      // tail is where its head was 2 f ago (motion blur by construction)
      const at = (uu: number, k: number) => {
        const a = (k / 6) * Math.PI * 2 + 0.5 + random(`cta-spark-${o.i}-${k}`) * 0.6;
        const far = (full / 2) * 0.8 + (46 + 50 * random(`cta-spark-r-${o.i}-${k}`)) * EASE.out3(Math.min(1, Math.max(0, uu) / 10));
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
    // (the shader has four bloom slots: in the survivor's hold its four colours take them all)
    glows: (survivor > 0.01 && t < I ? [...glows].sort((a, c) => c.s - a.s) : glows).slice(0, 4),
    // her eyes carry her voice (0.25 · the real envelope, plus a whisper while she speaks)
    eyeGlow: 0.25 * lineEnv(t),
    // the four lights as four arcs on the merged light's rim (rose TL, emerald TR, teal BR, violet BL)
    // (just outside the light's edge, on the night, so each hue stays itself)
    rim: [0.6 * tween(t, K.rimIn, [0, 1], EASE.inOut), 1.18, 0.1, 0.3],
    rimColors: LIGHT_ORDER.map((id) => rgb01(mixColor(LIGHTS[id].orb[2], LIGHTS[id].orb[3], 0.25))),
    backGain,
    tint,
    glowOver: 0.45,
    // the reveal's light carries the night's lilac until the four lights take over (then silver)
    backLilac: K.lilacBack * (1 - tween(t, K.backDim, [0, 1], EASE.inOut)),
    plateEdge: G.frame.edge,
    // the torn filaments are light: the nearest orb's colour (the night's lilac before they are in)
    tearTint: 1,
    tearColor: rgb01(C.lilac),
    // … and they stay within ~40 px of her head matte (in head-ellipse units: 2.1 eye offsets)
    headCap: 1 + 40 / (L.width * G.frame.zoom * zoom * 2.1 * art.eye[0]) - 0.22,
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
  // the pool under the headline: in with its first word, out as the words are pulled into the core
  const scrimO =
    tween(t, [spec.wordAt[0] - 4, spec.wordAt[0] + 10], [0, 1], EASE.out3) *
    (1 - tween(t, [K.collapse.from - 2, K.collapse.from + 8], [0, 1], EASE.inOut));
  const reach = Math.hypot(L.width, L.height) * 0.62;
  const streaks = buildStreaks(K.streaks[0], K.streaks[1], G.P, L.width, L.height);
  const rings = K.rings.map((r0, i) => ({ t0: K.streaks[0] + 4 + i * 5, t1: I - 3 + i, r0: reach * r0 }));

  /* the gathering light at the core (the four lights' merged glow) */
  const coreGrow = tween(t, [K.core[0], K.pullBack[0]], [0, 1], EASE.out3);
  const bloom = t >= I ? 0 : coreGrow * L.pick(560, 520) * (1 - 0.35 * pull);
  const bloomHot = (0.6 + 0.4 * pull) * 0.6;

  /* the eyes' last light slides into the core (screen space, like the hero) */
  const Pscr = onLayer(L, G.P, cam, 1);
  const eyeZ = G.frame.zoom * zoom;
  const eyeOff = art.eye[0] * eyeZ * L.width;
  const eyeX0 = art.axis * L.width;
  const eyeGlowO = windowed(t, K.eyeGlow[0], K.eyeGlow[1], K.eyeGlow[1] + 2, K.eyeGlow[2], EASE.out3, EASE.in2);
  const slideAt = (tt: number) => tween(tt, [K.eyeGlow[1], K.eyeGlow[2]], [0, 1], EASE.in2);

  /* impact accents */
  // the impact's light: a white burst from the core (not a grey veil), 3 frames
  const flash = t === I ? 1 : t === I + 1 ? 0.5 : t === I + 2 ? 0.18 : 0;
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
        {[K.glint0, K.glint].map((win, k) => (
          <Glint key={k} t={t} win={win} x0={eyeX0} off={IRIS.k * eyeOff} y={G.P.y - IRIS.dv * eyeZ * L.height} r={IRIS.r * eyeZ} />
        ))}
        {eyeGlowO > 0.01 ? (
          <EyeLight
            o={eyeGlowO}
            at={(tt, side) => {
              const k = slideAt(tt);
              return { x: mix(eyeX0 + side * IRIS.k * eyeOff, Pscr.x, k), y: mix(G.P.y - IRIS.dv * eyeZ * L.height, Pscr.y, k), k };
            }}
            t={t}
          />
        ) : null}
        <PopAccents rings={ringsDom} sparks={sparks} w={L.width} h={L.height} />
        <Camera x={cam.x} y={cam.y} zoom={cam.zoom}>
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
                  background: 'radial-gradient(closest-side, rgba(6,4,10,0.46) 0%, rgba(6,4,10,0.38) 42%, rgba(6,4,10,0.14) 76%, rgba(6,4,10,0) 100%)',
                }}
              />
            ) : null}
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
              <CoverCta
                t={t}
                at={CTA.button}
                press={CTA.press}
                fontSize={G.button.fontSize}
                spec={{ lift: K.pressLift, down: K.pressDown, flood: K.flood, ripple: K.ripple, glint: K.pressGlint }}
                rest={rest}
              />
            </Row>
            <Row y={G.note.y}>
              <Note t={t} at={CTA.note} step={K.noteStep} size={G.note.size} rest={rest} />
            </Row>
            <Row y={G.url.y}>
              <Url
                t={t}
                at={CTA.url}
                chunks={K.urlChunks.map((from, k) => ({ from, at: K.urlAt[k] }))}
                size={G.url.size}
                dot={G.url.dot}
                ruleW={G.url.rule}
                step={K.urlStep}
                rest={rest}
              />
            </Row>
          </Layer>
          {dustO > 0.005 ? (
            <Layer depth={1.5}>
              <Dust count={26} seed="cta-dust" color="185,163,255" opacity={dustO} speed={0.3} size={[2, 9]} blur={[0, 5]} />
            </Layer>
          ) : null}
        </Camera>
        {flash > 0 ? (
          <AbsoluteFill
            style={{
              background: `radial-gradient(circle at ${Pscr.x.toFixed(1)}px ${Pscr.y.toFixed(1)}px, rgba(255,255,255,${(0.92 * flash).toFixed(3)}) 0%, rgba(250,246,255,${(0.62 * flash).toFixed(3)}) ${L.pick(12, 10)}%, rgba(233,224,255,${(0.24 * flash).toFixed(3)}) ${L.pick(34, 28)}%, rgba(233,224,255,${(0.08 * flash).toFixed(3)}) 60%, rgba(233,224,255,0) 90%)`,
            }}
          />
        ) : null}
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
 * The irises, measured on the art: centres at .877 of the site's eye offset
 * and .0053 (art v) above its eye line; radius ≈ 9.5 art px = 17.8 frame px
 * per unit of zoom (both crops are 1.875 frame px per art px).
 */
const IRIS = { k: 0.877, dv: 0.0053, r: 17.8 };

/**
 * The catch-light: ON her first word a 6 px white glint (60 %) sweeps across
 * both irises in 4 frames, just above their centres, with a sub-frame trail.
 */
const Glint: React.FC<{ t: number; win: readonly [number, number]; x0: number; off: number; y: number; r: number }> = ({ t, win, x0, off, y, r }) => {
  const [a, c] = win;
  if (t < a - 0.5 || t > c) return null;
  const at = (tt: number) => tween(tt, [a, c], [-0.8, 0.8], EASE.inOut);
  const o = 0.6 * Math.sin(Math.PI * tween(t, [a - 0.5, c], [0, 1]));
  const els: React.ReactNode[] = [];
  [-1, 1].forEach((side) => {
    [0.5, 0.25, 0].forEach((back, j) => {
      const k = at(t - back);
      els.push(
        <div
          key={`${side}-${j}`}
          style={{
            position: 'absolute',
            left: x0 + side * off + k * r - 3,
            top: y - r * 0.42 + Math.abs(k) * r * 0.18 - 3,
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#ffffff',
            opacity: o * (j === 2 ? 1 : 0.3 * (j + 1)),
            boxShadow: '0 0 5px rgba(255,255,255,0.7)',
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
