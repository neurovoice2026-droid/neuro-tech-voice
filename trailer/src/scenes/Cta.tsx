/**
 * 24–30 s · CTA — everything converges into the logo.
 *
 *   t −4…8    IRIS: a dark circle opens from FLOW_END (the scale scene's last
 *             node) with a thin lilac/electric rim — radially smeared by its
 *             own speed — swallowing the white act
 *   t 0…30    HERO: the site's cover portrait out of black — the eyes first,
 *             then a noisy radial opening while the site's "liquid" entry
 *             tear settles onto the figure; a slow dolly into the eyes and a
 *             2.5D depth-map orbit (one WebGL2 pass, site grade/scrim/wash).
 *             The art is framed so its eyes sit exactly on the logo centre.
 *   t 15…44   LINE: "AI voice agents that book your customers 24/7." rises
 *             word by word out of masks; the hero's corner marks bracket it;
 *             it then HOLDS, untouched, until t 61
 *   t 45      CONVERGE (downbeat, riser): the first filament burst tears the
 *             portrait, the first streak heads cross the frame edges
 *   t 45…69   the portrait frays away in vertical filaments, outside-in, down
 *             to its silver backlight; the eyes go last, flashing lilac, and
 *             their light slides into the core (t 66…71)
 *   t 61…75   the words swell (anticipation) and are pulled one by one into
 *             the core, smeared by a real shutter; the marks follow
 *   t 68…75   everything pulls back a touch (anticipation)
 *   t 75      LOGO IMPACT: logo 1.25 → 1 on SPRING.heavy, 2-frame white
 *             flash, a bright shockwave ring off the logo, ±6 px camera
 *             shake (blurred), halo flare
 *   t 90      "Start free →" (the hero CoverCta) pops in
 *   t 98      "5 free minutes, no card"
 *   t 105     CornerDot + neurotechvoice.com
 *   t 113     the button takes the site's hover as if clicked
 *   t 135…180 FINAL HOLD — nothing moves but grain and a ≤2 % halo breath
 *
 * Parallax: halo 0.3 (in-shader) · type/logo/button 1 · streaks 1.3 ·
 * dust 1.5.
 */
import React from 'react';
import { AbsoluteFill, Img, random, staticFile } from 'remotion';
import { Camera, Layer } from '../components/Camera';
import { Dust } from '../components/Dust';
import { FLOW_END } from '../lib/handoff';
import { useLayout, type Layout } from '../lib/layout';
import { EASE, mix, SPRING, springAt, tween, windowed } from '../lib/motion';
import { useSceneFrame } from '../lib/scene';
import { C } from '../theme';
import { b, CTA, SCALE, SCENES } from '../timing';
import { CoverCta, Note, Url } from './cta/EndCard';
import { Headline, type HeadlineSpec } from './cta/Headline';
import { HERO_ART, HeroGL, type HeroUniforms } from './cta/HeroGL';
import { buildStreaks, Streaks } from './cta/Streaks';

// LOCAL TIMING - hoist into timing.ts
/** the white act ends (Trailer's grain switch) exactly as the iris is fully open */
const IRIS_END = SCENES.scale.from + SCALE.irisToDark[1] - SCENES.cta.from; // 8
/**
 * the iris waits 3 f after the scale's last cue (irisToDark[0], confirm + whoosh-rev,
 * node solid green) so the green node and the first beat of its ping read before
 * the iris swallows them (integration pass: it used to start 1 f BEFORE the cue)
 */
const IRIS_START = SCENES.scale.from + SCALE.irisToDark[0] + 3 - SCENES.cta.from; // −4
export const CTA_LOCAL = {
  /** the dark iris opens from FLOW_END over 12 frames, ending with the white act (−4 → 8) */
  iris: [IRIS_START, IRIS_END] as const,
  /** the eyes come out of black first (frames) */
  eyes: [0, 7] as const,
  /** radial reveal from the eyes, inside the hero window (4 → 30) */
  reveal: [CTA.robotIn[0] + 4, CTA.robotIn[1]] as const,
  /** the site's liquid entry tear settles onto the figure (frames 0 → 24; liquid 0 → 18) */
  entryTear: [0, 24] as const,
  liquid: [0, 18] as const,
  /** corner marks bracket the line right after its last word (41) */
  marks: b(2.75),
  /** ON the converge downbeat: a first filament burst (45 → 49) … */
  tearKick: [CTA.converge[0], CTA.converge[0] + 4] as const,
  /** … then the tear builds while the figure is erased to the halo (45 → 69) */
  tear: [CTA.converge[0] + 4, CTA.logoImpact - 6] as const,
  erase: [CTA.converge[0], CTA.logoImpact - 6] as const,
  /** words hold until 61, swell for 3 f, leave at 64 + 0.35 f each, 8 f flights (all in by 74.5) */
  collapse: { from: b(4.25), step: 0.35, dur: 8, anticip: 3 },
  /** the corner marks travel in behind the words (66 → 74) */
  marksIn: { from: b(4.25) + 2, dur: 8 },
  /** streaks + motes pour in from the frame edges (45 → 75) */
  streaks: [CTA.converge[0], CTA.logoImpact] as const,
  /** the hook's ring waves, reversed: three rings contract into P (start radius × reach) */
  rings: [1.25, 1.1, 0.95] as const,
  /** the eyes' last light (frames): glows up as they tear (62 → 66), then slides into the core (66 → 71) */
  eyeGlow: [62, 66, 71] as const,
  /** the core gathers (60 → 75) */
  core: [b(4), CTA.logoImpact] as const,
  /** anticipation: everything pulls back (68 → 75) */
  pullBack: [b(4.5), CTA.logoImpact] as const,
  /** impact accents (frames) */
  shake: 6,
  ring: [CTA.logoImpact, CTA.logoImpact + 20] as const,
  /** halo breath starts under the end card */
  breath: CTA.button + 10,
  /** dust clears before the hold */
  dustOut: [b(8), CTA.finalHold] as const,
};
const K = CTA_LOCAL;

/* ── geometry ─────────────────────────────────────────────────────── */
const LOGO_RATIO = 2148 / 2999;

function geo(L: Layout) {
  const P = { x: L.cx, y: L.pick(L.cy - 110, L.cy - 260) };
  const logoW = L.pick(620, 700);
  const logoH = logoW * LOGO_RATIO;
  return {
    P,
    logoW,
    logoH,
    /** halo centre sits under the logo centre so the wordmark is deep in the light */
    haloC: { x: P.x, y: P.y + L.pick(70, 60) },
    /**
     * rx, ry above, ry below: a round light, the art's own backlight, that
     * keeps the whole wordmark ≥ #a19e97 and is night again under the
     * headline. 9:16 stays inside the frame (a contained source) with a
     * slightly fuller (superelliptic, power below) underside.
     */
    haloR: L.pick([720, 570, 350] as const, [590, 660, 450] as const),
    haloPow: L.pick(2, 2.2),
    /** the film's overlay grain takes ~14 levels off the light: this puts them back */
    haloGain: L.pick(1.06, 1.08),
    /**
     * 16:9 only: once the logo is in, the light's underside settles under the
     * wordmark to seat the button on the night — start y at the axis,
     * length, strength, how far the edge curves up at ±rx
     */
    floor: L.pick({ y: P.y + logoH / 2 + 10, len: 180, k: 0.82, rise: 90 }, { y: 0, len: 1, k: 0, rise: 0 }),
    /** the art's framing: base zoom (the portrait crop is pushed in so its glitch band stays out) */
    frame: L.pick({ zoom: 1.02, band: 0 }, { zoom: 1.36, band: 0.15 }),
    headline: {
      lines: L.pick(['AI voice agents that book', 'your customers 24/7.'], ['AI voice agents', 'that book your', 'customers 24/7.']),
      fontSize: L.pick(76, 84),
      cy: L.pick(880, 1500),
      markSide: L.pick(0.3, 0.45),
    },
    button: { y: L.pick(L.cy + 230, L.cy + 320), fontSize: L.pick(40, 44) },
    note: { y: L.pick(L.cy + 330, L.cy + 424), size: 26 },
    url: { y: L.pick(L.height - 110, L.height - 260), size: L.pick(30, 34) },
    /** logo bounding circle: where the shockwave starts */
    ring: [Math.hypot(logoW, logoH) / 2 + 12, L.pick(1150, 1100)] as const,
    iris: FLOW_END(L),
  };
}

/* ── camera ───────────────────────────────────────────────────────── */
function cameraAt(t: number) {
  if (t >= CTA.finalHold) return { x: 0, y: 0, zoom: 1, shake: 0 };
  const I = CTA.logoImpact;
  if (t < I) {
    const d = tween(t, [-12, I], [0, 1], EASE.inOut);
    const push = tween(t, [b(1.5), K.pullBack[0]], [0, 1], EASE.inOut);
    const pull = tween(t, K.pullBack, [0, 1], EASE.inOut);
    return { x: mix(-16, 10, d), y: mix(8, -4, d), zoom: 1 + 0.025 * push - 0.04 * pull, shake: 0 };
  }
  const g = springAt(t, I, SPRING.glide);
  let x = mix(10, 0, g);
  let y = mix(-4, 0, g);
  const k = t - I;
  let shake = 0;
  if (k < K.shake) {
    const a = 6 * Math.pow(1 - k / K.shake, 2);
    const f = Math.floor(t);
    x += a * (random(`cta-shake-x-${f}`) * 2 - 1);
    y += a * (random(`cta-shake-y-${f}`) * 2 - 1);
    shake = a;
  }
  const zoom = mix(1.018, 1, springAt(t, I, SPRING.glide));
  return { x, y, zoom, shake };
}

/** where a point on a Layer of `depth` lands on screen (Camera.tsx's transform) */
function onLayer(L: Layout, p: { x: number; y: number }, cam: { x: number; y: number; zoom: number }, depth: number) {
  const z = 1 + (cam.zoom - 1) * depth;
  return { x: L.cx + (p.x - L.cx) * z - cam.x * depth, y: L.cy + (p.y - L.cy) * z - cam.y * depth, z };
}

/* ── the scene ────────────────────────────────────────────────────── */
export const Cta: React.FC = () => {
  const t = useSceneFrame('cta');
  const L = useLayout();
  if (t < K.iris[0]) return null;
  const G = geo(L);
  const art = L.vertical ? HERO_ART.portrait : HERO_ART.landscape;
  const I = CTA.logoImpact;
  const cam = cameraAt(t);

  /* hero uniforms */
  const orbit = tween(t, [-8, I + 5], [0, 1], EASE.inOut);
  const pull = tween(t, K.pullBack, [0, 1], EASE.inOut);
  const land = t < I ? 0 : springAt(t, I, SPRING.heavy);
  const flare = t < I ? 0 : Math.exp(-(t - I) / 7);
  const breath = t < K.breath ? 0 : Math.sin(((t - K.breath) / 75) * Math.PI * 2) * tween(t, [K.breath, K.breath + 30], [0, 1], EASE.inOut);
  const haloScale = (1 - 0.05 * pull * (t < I ? 1 : 0)) * (t < I ? 1 : mix(1.07, 1, land));
  const hC = onLayer(L, G.haloC, cam, 0.3);
  const zoom = mix(1.0, 1.12, tween(t, [-8, I], [0, 1], EASE.inOut));
  const u: HeroUniforms = {
    mouse: [mix(1.2, -0.2, orbit), mix(0.36, 0.62, orbit)],
    zoom,
    pan: [0, 0],
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
    haloC: [hC.x, hC.y],
    haloR: [G.haloR[0] * hC.z * haloScale, G.haloR[1] * hC.z * haloScale, G.haloR[2] * hC.z * haloScale],
    haloGain: G.haloGain * (1 - 0.06 * pull * (t < I ? 1 : 0)) * (1 + 0.32 * flare) * (1 + 0.009 * breath),
    floor: [
      onLayer(L, { x: L.cx, y: G.floor.y }, cam, 0.3).y,
      G.floor.len * hC.z,
      G.floor.k * tween(t, [I + 4, CTA.button + 4], [0, 1], EASE.inOut),
      G.floor.rise * hC.z,
    ],
    haloShape: [G.haloPow, 0.025, 0.06],
    frame: [G.frame.zoom, G.P.y / L.height, G.frame.band],
    seed: t,
  };

  /* iris */
  const irisAt = (tt: number) => tween(tt, K.iris, [0, Math.hypot(L.width, L.height)], EASE.peel);
  const irisR = irisAt(t);
  const clip = t < K.iris[1] ? `circle(${irisR.toFixed(1)}px at ${G.iris.x}px ${G.iris.y}px)` : undefined;

  /* headline */
  const spec: HeadlineSpec = {
    ...G.headline,
    P: G.P,
    start: CTA.line,
    stagger: CTA.wordStagger,
    marksAt: K.marks,
    collapse: K.collapse,
    marksCollapse: K.marksIn,
  };
  const reach = Math.hypot(L.width, L.height) * 0.62;
  const streaks = buildStreaks(K.streaks[0], K.streaks[1], G.P, L.width, L.height);
  const rings = K.rings.map((r0, i) => ({ t0: K.streaks[0] + 4 + i * 5, t1: I - 3 + i, r0: reach * r0 }));

  /* core: gathers as the eyes and words arrive, contracts before the hit */
  const coreGrow = tween(t, [K.core[0], K.pullBack[0]], [0, 1], EASE.out3);
  const coreSize = t >= I ? 0 : 150 * coreGrow * (1 - 0.45 * pull);
  const coreHot = 0.6 + 0.4 * pull;
  // a wide bloom that inhales with the pull-back
  const bloom = t >= I ? 0 : coreGrow * L.pick(620, 560) * (1 - 0.35 * pull);

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
  const logoScale = t < I ? 1.25 : mix(1.25, 1, land);
  const logoPrev = t - 1 < I ? 1.25 : mix(1.25, 1, springAt(t - 1, I, SPRING.heavy));
  const logoBlur = t < I ? 0 : Math.min(6, Math.abs(logoScale - logoPrev) * G.logoW * 0.08 + cam.shake * 0.3);
  const logoO = t < I ? 0 : tween(t, [I, I + 1], [0.8, 1], EASE.out3);

  const dustO = 0.6 * (1 - tween(t, K.dustOut, [0, 1], EASE.inOut));

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ clipPath: clip, background: C.night }}>
        <HeroGL art={art} width={L.width} height={L.height} u={u} />
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
                  background: `radial-gradient(circle, rgba(185,163,255,${(0.34 * coreHot).toFixed(3)}) 0%, rgba(124,58,237,${(0.14 * coreHot).toFixed(3)}) 35%, rgba(124,58,237,0) 70%)`,
                }}
              />
            ) : null}
            {coreSize > 0.5 ? (
              <div
                style={{
                  position: 'absolute',
                  left: G.P.x - coreSize / 2,
                  top: G.P.y - coreSize / 2,
                  width: coreSize,
                  height: coreSize,
                  borderRadius: '50%',
                  background: `radial-gradient(circle, rgba(255,255,255,${coreHot}) 0%, rgba(237,236,241,${0.9 * coreHot}) 12%, rgba(185,163,255,${0.55 * coreHot}) 30%, rgba(124,58,237,${0.22 * coreHot}) 52%, rgba(124,58,237,0) 70%)`,
                }}
              />
            ) : null}
            {ringO > 0.01 ? <Shockwave P={G.P} r={ringAt(t)} rPrev={ringAt(t - 0.35)} o={ringO} w={L.width} h={L.height} /> : null}
            {/* the logo; a soft contact shadow under the crown only (never under the wordmark) */}
            <div
              style={{
                position: 'absolute',
                left: G.P.x - G.logoW / 2,
                top: G.P.y - G.logoH / 2,
                width: G.logoW,
                height: G.logoH,
                transform: `scale(${logoScale.toFixed(4)})`,
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
                  filter: logoBlur > 0.1 ? `blur(${logoBlur.toFixed(2)}px)` : undefined,
                }}
              />
            </div>
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: G.button.y,
                display: 'flex',
                justifyContent: 'center',
                transform: 'translateY(-50%)',
              }}
            >
              <CoverCta t={t} at={CTA.button} press={CTA.press} fontSize={G.button.fontSize} />
            </div>
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: G.note.y,
                display: 'flex',
                justifyContent: 'center',
                transform: 'translateY(-50%)',
              }}
            >
              <Note t={t} at={CTA.note} size={G.note.size} />
            </div>
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: G.url.y,
                display: 'flex',
                justifyContent: 'center',
                transform: 'translateY(-50%)',
              }}
            >
              <Url t={t} at={CTA.url} size={G.url.size} ruleW={L.width - 2 * L.safe.x} />
            </div>
          </Layer>
          {dustO > 0.005 ? (
            <Layer depth={1.5}>
              <Dust count={26} seed="cta-dust" color="185,163,255" opacity={dustO} speed={0.3} size={[2, 9]} blur={[0, 5]} />
            </Layer>
          ) : null}
        </Camera>
        {flash > 0 ? <AbsoluteFill style={{ background: C.white, opacity: flash }} /> : null}
      </AbsoluteFill>
      {t < K.iris[1] + 1 ? (
        <IrisRim t={t} r={irisR} rPrev={irisAt(t - 0.5)} x={G.iris.x} y={G.iris.y} w={L.width} h={L.height} />
      ) : null}
    </AbsoluteFill>
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
 * The impact shockwave: centred on the logo, it leaves from just outside the
 * logo's bounding circle. A white core with a thin night inner edge so it
 * reads on the silver as well as on the night; a radial smear behind it.
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
      <circle cx={P.x} cy={P.y} r={r - width} fill="none" stroke={`rgba(6,4,10,${(0.4 * o).toFixed(3)})`} strokeWidth={width} />
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
