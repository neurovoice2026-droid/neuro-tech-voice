"use client";

import { useEffect, useRef, useState } from "react";
import type { CoverArt } from "@/lib/site";
import {
  COVER_FLOW,
  COVER_NOISE_GLSL,
  coverDissolveAt,
} from "./cover-noise";
import {
  frameCadence,
  getTier,
  gpuIsWeak,
  onTierChange,
  slowFrames,
} from "./product/device-tier";
import { whenIdle } from "./product/motion-kit";

/**
 * Depth-map parallax portrait.
 *
 * The reference site drives its hero portrait through a Unicorn.studio
 * project whose stack is: an animated gradient, a `depthMap` layer
 * (trackMouse 0.82, momentum 0.92) displacing the image, a slow `fbm`
 * warp, and a `dither` pass. This is that stack rebuilt as a single
 * WebGL2 fragment shader — no runtime dependency, one draw call.
 *
 * The illusion: each pixel is pushed along the cursor vector in
 * proportion to its depth, so the head separates from the black field
 * and turns as you move. Purple throughout, never red.
 */

const VERT = `#version 300 es
// One oversized triangle covering the viewport — cheaper than a quad.
out vec2 vUv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uImage;
uniform sampler2D uDepth;
uniform vec2  uRes;        // canvas size, px
uniform vec2  uImgRes;     // texture size, px
uniform vec2  uPos;        // object-position, 0..1
uniform vec2  uMouse;      // smoothed pointer, 0..1
uniform float uTime;       // already scaled by the animated speed
uniform float uAmp;        // parallax scale
uniform float uWarp;       // fbm warp scale
uniform float uMixRadius;  // 1 on entry -> 0.44 at rest
uniform float uAxisX;      // face symmetry axis, image space
uniform vec3  uEye;        // [eye offset from axis, eye y, guard radius]
uniform float uSubject;    // head half-width, in image widths
uniform float uDissolve;   // 0 whole -> 1 fully apart -> 0 whole again
uniform vec3  uBrand;      // #551a89

const float PI = 3.14159265359;

/* --- object-fit: cover, with object-position ----------------------- */
vec2 coverUv(vec2 uv) {
  float rs = uRes.x / uRes.y;
  float ri = uImgRes.x / uImgRes.y;
  vec2 f = (rs > ri) ? vec2(1.0, ri / rs) : vec2(rs / ri, 1.0);
  vec2 centre = uPos * (1.0 - f) + f * 0.5;
  return (uv - 0.5) * f + centre;
}

/* Height below the surface: white in the map is near, so invert. */
float getDepth(vec2 uv) {
  vec3 c = texture(uDepth, coverUv(uv)).rgb;
  return 1.0 - dot(c, vec3(0.299, 0.587, 0.114));
}

/* --- Perlin + domain-warped fbm, ported from the reference ---------
   Shared with the interior spread's field — see ./cover-noise. */
${COVER_NOISE_GLSL}

void main() {
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);

  /* ---- 1. Parallax occlusion mapping -----------------------------
     A 16-step march along the view vector through the height field.
     Because the ray stops at the first surface it hits, near geometry
     genuinely occludes what is behind it — the head reads as a solid
     that turns, instead of an image being sheared.                  */
  vec2 parallaxDir = (uMouse - 0.5) * 0.82 * uAmp;

  const int STEPS = 16;
  float layerDepth = (1.0 / float(STEPS)) * 0.5;
  float currentLayerDepth = 0.0;
  vec2  currentUv = uv;
  vec2  prevUv = currentUv;
  float currentDepth = getDepth(currentUv);
  float prevDepth = currentDepth;

  for (int i = 0; i < STEPS; i++) {
    if (currentDepth < currentLayerDepth) break;
    currentLayerDepth += layerDepth;
    prevUv = currentUv;
    prevDepth = currentDepth;
    currentUv -= parallaxDir * layerDepth;
    currentDepth = getDepth(currentUv);
  }

  // Interpolate to the exact intersection so the silhouette stays crisp.
  float beforeDepth = prevDepth - (currentLayerDepth - layerDepth);
  float afterDepth  = currentDepth - currentLayerDepth;
  float weight = clamp(beforeDepth / (beforeDepth - afterDepth + 1e-5), 0.0, 1.0);
  vec2 hitUv = mix(prevUv, currentUv, weight);

  /* ---- 2. The dissolve -------------------------------------------
     Domain-warped Perlin (fbm of fbm). The skew squashes the noise in
     y, so it varies far faster across x than down y — that anisotropy
     is what shreds the silhouette into vertical filaments instead of
     smearing it into a blur.

     uMixRadius rides 1 -> 0.44 on entry. At 1 the falloff term goes to
     zero, so the warp covers the whole frame at full strength and the
     portrait is pure liquid; as it settles the warp pulls back into a
     centred blob and the figure resolves out of it.                  */
  /* Everything below runs in IMAGE space, using the artwork's own aspect
     rather than the canvas'. Driving it off the viewport made the noise
     frequency swing ~5x between a wide and a narrow window, so the same
     page rendered a visibly different dissolve at different sizes.

     Image space alone is not enough, though: the two art-directed crops
     are the same head at different sizes in very different aspects, so
     an effect measured against the FRAME comes out different on each. It
     did — the phone got a smooth blob where the desktop got filaments.
     So every length below is measured against the HEAD instead, and the
     two crops dissolve identically because the subject is identical.

     The landscape crop is the reference the look was tuned on; these are
     its numbers, and they are what keeps it pixel-for-pixel unchanged. */
  vec2  iuv = coverUv(hitUv);
  float imgAspect = uImgRes.x / uImgRes.y;
  const float REF_SUBJECT = 0.2288;   // see CoverArt.subject — not literally
  const float REF_ASPECT  = 1.7778;   // the head. 2048 / 1152

  // Fold about the face's axis: both halves sample identical noise and so
  // dissolve as exact mirror images — deterministic, never independent per
  // side. The x displacement is un-folded again further down.
  float dx   = iuv.x - uAxisX;
  float side = dx < 0.0 ? -1.0 : 1.0;
  vec2  fuv  = vec2(uAxisX + abs(dx), iuv.y);

  // How big the head is in this crop, in the units each term needs.
  float headW = uSubject;                       // image widths
  float headH = uSubject * imgAspect;           // image heights

  /* The blob the dissolve lives in is anchored to the FACE, not to the
     frame. Anchored to the frame centre it sat over a different part of
     the face in each crop: both crops put the eyes at the same fraction
     of their frame, but the head fills each frame differently, so the
     same frame offset is a different distance across the face. On the
     phone that pushed the forehead out to the dead edge of the falloff.

     So: start at the eye line, drop by a fixed number of head-widths —
     the number that lands exactly on the frame centre in the crop this
     was tuned on, which is what keeps that crop unchanged. */
  const float REF_EYE_Y = 0.4063;
  float blobDrop = (0.5 - REF_EYE_Y) / (REF_SUBJECT * REF_ASPECT);
  vec2 anchor = vec2(uAxisX, uEye.y + blobDrop * headH);

  vec2 mPos = anchor + (uMouse - 0.5) * 0.04;
  vec2 pos = mix(anchor, mPos, floor(uMixRadius));

  /* Where the dissolve is allowed to act.

     The reference masks its image layer by its depth layer, and the plan
     was to copy that. It cannot be copied: our depth map is not a
     silhouette, it is a soft radial blob — a vignette with no figure in
     it. Masking by it is masking by a disc, which is what was already
     there. That is also why a round falloff could never both reach the
     crown and spare the field: a disc centred on the face is either too
     small for the skull or wide enough to drag the whole vignette into
     vertical curtains.

     So the figure is described directly instead: a tall ellipse over the
     head and neck, in image coordinates, read off the artwork. Wider than
     the silhouette on purpose, so the tear can still throw filaments off
     the outline into the field — clipped exactly at the edge it reads as
     blurred rather than torn. */
  const vec2 FIGURE_CENTRE = vec2(0.0, 0.52);   // x is taken from the axis
  const vec2 FIGURE_RADII  = vec2(0.16, 0.50);
  vec2 rel = (fuv - vec2(uAxisX + FIGURE_CENTRE.x, FIGURE_CENTRE.y))
             / FIGURE_RADII;
  float figure = 1.0 - smoothstep(0.9, 1.55, length(rel));

  // The entry still opens across the whole frame, then closes onto the
  // figure as uMixRadius settles. Written as 1.0 - smoothstep(lo, hi, x)
  // rather than smoothstep(hi, lo, x): GLSL leaves the reversed-edge form
  // undefined, and it silently returned 0 here — the mask never applied.
  float settle = 1.0 - smoothstep(0.44, 1.0, uMixRadius);
  float mDist = mix(1.0, figure, settle);

  // Noise domain in head half-widths: isotropic in pixels first, then
  // divided by the head. This is what fixes the frequency mismatch — the
  // filaments come from the fine octaves, and on the portrait crop the
  // frame-relative scaling was putting them ~5x too coarse to appear.
  vec2 stIso = ((fuv - pos) * uImgRes) / (headW * uImgRes.x) * 1.7806;
  vec2 st = stIso * vec2(1.0, 0.25);           // skew -> vertical streaks
  vec2 drift = vec2(0.0, uTime * 0.005);
  float t = uTime * 0.025;

  /* ---- Eye guard ---------------------------------------------------
     The dissolve runs over the whole figure — crown, temples, jaw, the
     silhouette itself. One thing is exempt: the eyes.

     The guard is built in FOLDED space, which is what makes the symmetry
     structural rather than tuned. A point and its mirror get the same
     guard value by construction, so however this is retuned the two eyes
     cannot come out different — a single ellipse covers the pair.

     Inside the plateau the displacement is exactly zero, not merely
     small, so nothing here breathes, drifts or oscillates. The ramp
     outside it is wide: the tear has to arrive at the eyes gradually,
     or the clean region reads as pasted on rather than as the one part
     of the face still holding together.

     It is measured here, ahead of the noise, because it decides whether
     the noise is needed at all: see below. */
  float eyeD = length((fuv - vec2(uAxisX + uEye.x, uEye.y))
                      / vec2(uEye.z * 1.5, uEye.z));
  float eyeGuard = 1.0 - smoothstep(1.15, 2.1, eyeD);

  /* The three fbm stacks are nearly all of this shader's cost, and where
     the figure mask is zero (the field) or the eye guard is whole (the
     eyes) their result is multiplied by exactly zero. Skipped there, the
     picture is identical to the last bit; only the work goes. */
  vec2 fine = vec2(0.0);
  if (mDist > 0.0 && eyeGuard < 1.0) {
    vec2 r = vec2(
      fbm(vec3(st - drift + vec2(1.7, 9.2), t)),
      fbm(vec3(st - drift + vec2(8.2, 1.3), t))
    );
    float f = fbm(vec3(st + r - drift, t)) * 0.35;
    // Displacement is in image UV, so the same number moves a different
    // fraction of the head in each crop. Scaling by the head makes the tear
    // travel the same distance across the face on a phone as on a desktop.
    fine = f * 2.0 + r * 0.35;
  }

  /* The field goes with it, but it must FLOW where the figure shreds.
     Displacing the vignette's grain with the eight-octave stack is what
     turned the background into vertical curtains: fine noise moves
     neighbouring grains by different amounts and the difference is what
     you see. One low-frequency Perlin per axis instead — the grain then
     travels together, and a smooth gradient sliding smoothly is invisible
     as texture and visible only as motion. Cheap, too: one octave rather
     than eight, and only where the figure is not. */
  const float FIELD_SCALE  = 0.13;             // how coarse the field is
  const float FIELD_AMOUNT = 0.62;             // relative to the figure
  vec2 field = vec2(
    perlin(vec3(stIso * FIELD_SCALE + vec2(3.1, 7.7), t * 0.5)),
    perlin(vec3(stIso * FIELD_SCALE + vec2(9.3, 2.4), t * 0.5))
  ) * FIELD_AMOUNT;

  vec2 warpScale = (headW / REF_SUBJECT) * vec2(1.0, imgAspect / REF_ASPECT);
  /* uDissolve is the whole point of the effect, not a modifier on it: the
     figure comes apart and puts itself back together, over and over. The
     noise churns the whole time, but churn alone is a texture — held at a
     constant amplitude it just sits there as fuzz. The amplitude has to
     travel to zero for the portrait to be whole again, and that return is
     what makes the coming-apart read as an event.

     One envelope drives both, so the field breathes on the figure's beat
     rather than alongside it. */
  vec2 warp = mix(field, fine, mDist) * uWarp * uDissolve * warpScale;

  // The eyes hold still (the guard is measured above).
  warp *= 1.0 - eyeGuard;

  warp.x *= side;                              // un-fold the displacement

  vec3 col = texture(uImage, iuv + warp).rgb;

  /* ---- 3. Grade + dither ----------------------------------------- */
  // Keep the pigment violet where the dissolve drags dark over light.
  float sat = max(max(col.r, col.g), col.b) - min(min(col.r, col.g), col.b);
  col = mix(col, uBrand * (0.5 + dot(col, vec3(0.299, 0.587, 0.114)) * 1.5),
            0.10 * smoothstep(0.03, 0.30, sat));

  // Animated dither, as the reference's dither layer at speed 0.5.
  vec3 h = fract(vec3(gl_FragCoord.xyx) * 0.1031 + fract(uTime * 0.5));
  h += dot(h, h.yzx + 33.33);
  col += (fract((h.x + h.y) * h.z) - 0.5) * 0.016;

  fragColor = vec4(col, 1.0);
}`;

/* ------------------------------------------------------------------ *
 * Getting it on screen without holding the page up.
 *
 * Nothing here runs inside hydration: the context is created once the
 * page's first frames are out, in an idle moment, and nothing then waits
 * for an answer it does not need. The program is linked without asking
 * how it went and the GPU is asked once a frame whether it is done
 * (through the parallel-compile extension, or else a fence behind the
 * link), while the art is fetched and decoded off the main thread. Only a
 * linked program meets decoded pixels, and the canvas stays hidden until
 * then (see the style below).
 * ------------------------------------------------------------------ */

/** Compiles and links without asking how it went: asking is what blocks. */
function link(gl: WebGL2RenderingContext) {
  const program = gl.createProgram();
  const shaders = (
    [
      [gl.VERTEX_SHADER, VERT],
      [gl.FRAGMENT_SHADER, FRAG],
    ] as const
  ).map(([type, src]) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    gl.attachShader(program, s);
    return s;
  });
  gl.linkProgram(program);
  // Hand the work to the GPU process now, so it is under way before anyone asks.
  gl.flush();
  return { program, shaders };
}

type Art = { source: TexImageSource; w: number; h: number; close: () => void };

/**
 * A texture's pixels, decoded off the main thread. The URL is the one the
 * page's <img> already loaded, so the bytes come out of the cache. Where
 * createImageBitmap cannot take a blob, the image decodes itself instead.
 */
async function decodeArt(url: string): Promise<Art> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`failed: ${url}`);
    const bitmap = await createImageBitmap(await res.blob());
    return { source: bitmap, w: bitmap.width, h: bitmap.height, close: () => bitmap.close() };
  } catch {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { source: img, w: img.naturalWidth, h: img.naturalHeight, close: () => {} };
  }
}

function upload(gl: WebGL2RenderingContext, unit: number, art: Art) {
  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, art.source);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  art.close();
  return tex;
}

/** Frame gaps under this, this many in a row, say the page's first frames are out. */
const STEADY_GAP_MS = 24;
const STEADY_FRAMES = 8;
/** However the frames come (a 30Hz display, a slow GPU), the portrait starts by this long after mount. */
const STEADY_MAX_MS = 3000;

/**
 * Calls `run` once the page's own first frames are out, and returns the
 * cancel. A GPU still rasterising them answers a new context late, and the
 * main thread waits for the answer: in headless Chrome (a software GPU)
 * getContext blocked for 0.4–1s in the first seconds after navigation and
 * for 9ms once the frames came steadily. On capable hardware that is a
 * handful of frames after hydration.
 */
function whenSteady(run: () => void) {
  let raf = 0;
  let last = 0;
  let streak = 0;
  const cap = window.setTimeout(done, STEADY_MAX_MS);
  function tick(now: number) {
    streak = last && now - last < STEADY_GAP_MS ? streak + 1 : 0;
    last = now;
    if (streak >= STEADY_FRAMES) return done();
    raf = requestAnimationFrame(tick);
  }
  function done() {
    cancelAnimationFrame(raf);
    clearTimeout(cap);
    run();
  }
  raf = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(raf);
    clearTimeout(cap);
  };
}

/** The canvas' fade over the <img>, in and out. */
const FADE_MS = 900;
/** 60 frames a second at most, on any display: past that the eye gains nothing and the GPU pays in full. */
const FRAME_MS = 1000 / 60;
/** How early a display's frame may arrive and still be drawn. */
const FRAME_SLACK_MS = 2;
/** Each time the frames prove slow, the raster keeps this share of itself… */
const STEP_DOWN = 0.75;
/** …down to this share of its budget. Still slow there, the portrait comes whole and holds. */
const FLOOR = 0.5;
/** The raster's steps, from the whole budget down to the floor: 1, 0.75, 0.5625, 0.5. */
const LEVELS = Math.ceil(Math.log(FLOOR) / Math.log(STEP_DOWN));
/** The dissolve's envelope under this reads as whole. */
const WHOLE = 0.01;
/**
 * Frame gaps left unjudged at the start, and after a pause, a resize or a
 * hidden tab: those hitches are the page's. This many, or for this long,
 * whichever ends first, so a GPU at a few frames a second is not given
 * seconds' grace.
 */
const GRACE_FRAMES = 10;
const GRACE_MS = 600;
/**
 * A drawn gap under this, with raster given up, is a frame to spare: one
 * on time at 60Hz (16.7ms) or on a 48–50Hz panel (20.8, 20), never one
 * that missed a 60Hz frame (33ms) or, on the 60Hz grid, a 120Hz one
 * (25ms). No adopted cadence moves it: frameCadence() drops one at the
 * step down from full, and a 30Hz display gets its raster back by the
 * reading of its floor instead.
 */
const FAST_MS = 24;
/**
 * Frames to spare that win back one step of raster. A step back
 * up that does not last as long as it took to earn doubles the wait for
 * the next, up to the most (as TradeStage's), so a device on the edge
 * settles instead of stepping up and down.
 */
const RECOVER_FRAMES = 120;
const RECOVER_MAX_FRAMES = 1920;
/**
 * At the floor, how long the frames have to stay slow before the portrait
 * settles: a burst of the page's own work (a section building as it
 * scrolls in, a busy machine for a moment) passes well inside it, a GPU
 * that cannot keep up does not.
 */
const FLOOR_PATIENCE_MS = 4000;
/** Judged frames without a slow verdict after which the slow stretch at the floor is forgotten. */
const FLOOR_FORGET = 30;
/** A held portrait tries again, from the floor, after this long; twice as long each time it holds again, up to the most. */
const REST_MS = 8000;
const REST_MAX_MS = 64000;

export function DepthPortrait({
  art,
  focal,
  // The reference's parallax scale: 0.24 * 0.2.
  amplitude = 0.048,
  /**
   * Dissolve strength in the released zone.
   *
   * Measured against the reference by how many times a row crosses the
   * figure's outline — 2 is a solid silhouette, and the more the dissolve
   * genuinely tears the figure into strands the higher it climbs. The
   * reference is dead flat at 0 over the top quarter, then spikes to ~52
   * and tapers: a solid mass with a violent shred under it, not an even
   * haze. At 0.42 ours peaked at 17 and was flat across the whole figure,
   * which is what read as "not the same effect".
   *
   * This was only safe to raise once the eye guard existed. Before it the
   * strength was the only thing holding the dissolve off the eyes, so it
   * had to stay low everywhere to keep them readable; now they are held
   * explicitly and this is free to govern the tear alone.
   *
   * This is the PEAK of the cycle, not a constant. Held constant, a value
   * this high destroys the silhouette — the skull becomes a mass of spikes
   * with nothing left to recognise, which is why an earlier pass had to
   * drop it to 0.34 to keep a readable head. That was solving the wrong
   * problem: the figure is meant to be unrecognisable at the peak, because
   * a moment later it is whole again. uDissolve carries it there and back.
   */
  warp = 1.15,
  className,
  onReady,
}: {
  /** Chosen art-directed crop; must match what <picture> resolved to. */
  art: CoverArt;
  /** Focal point as [x, y] fractions — the same one CSS anchors to. */
  focal: [number, number];
  amplitude?: number;
  warp?: number;
  className?: string;
  onReady?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const { src, depth: depthSrc, axis, eye, subject } = art;
  const objectPosition = focal;

  useEffect(() => {
    const el = canvasRef.current;
    // A device already known to be weak keeps the server's <img>: no
    // context, no compile, no second download.
    if (!el || getTier() === "lite") return;
    const canvas: HTMLCanvasElement = el;

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let gl: WebGL2RenderingContext | null = null;
    let program: WebGLProgram | null = null;
    let shaders: WebGLShader[] = [];
    let vao: WebGLVertexArrayObject | null = null;
    const textures: WebGLTexture[] = [];
    let raf = 0;
    let polling = 0;
    let loseTimer = 0;
    // Everything the running portrait hangs on the page, undone in one go.
    let unhook: (() => void) | undefined;
    // The decoded art not yet on the GPU, handed back if the run ends first.
    let release: (() => void) | undefined;
    // This run is over: unmounted, or taken down for a lite verdict.
    let dead = false;

    // Once the page's first frames are out, in the first idle moment after.
    let cancelStart = whenSteady(() => {
      cancelStart = whenIdle(begin);
    });
    // A lite verdict that lands once the portrait is up takes it down again.
    const offTier = onTierChange((t) => {
      if (t === "lite") teardown();
    });

    return () => {
      offTier();
      stop();
      const g = gl;
      if (g) {
        textures.forEach((t) => g.deleteTexture(t));
        if (program) g.deleteProgram(program);
        shaders.forEach((s) => g.deleteShader(s));
        if (vao) g.deleteVertexArray(vao);
      }
      vao = null;
      if (loseTimer) {
        clearTimeout(loseTimer);
        lose();
      }
    };

    function stop() {
      dead = true;
      cancelStart();
      cancelAnimationFrame(raf);
      cancelAnimationFrame(polling);
      release?.();
      unhook?.();
    }

    /** A lite verdict: the canvas fades back to the <img> under it (the same art, graded the same). */
    function teardown() {
      if (dead) return;
      stop();
      setReady(false);
      // Lost once it has faded: losing it at once would blank it mid-fade.
      loseTimer = window.setTimeout(lose, FADE_MS + 100);
    }

    function lose() {
      loseTimer = 0;
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    }

    function begin() {
      // Asked now rather than after the visitor's first move, because this
      // draws on load. A weak GPU keeps the <img> and makes the visit lite.
      if (dead || gpuIsWeak()) return;
      // This task asks the GPU for the context and nothing else: every
      // question waits its turn behind whatever the GPU is drawing, so the
      // start is spread over tasks of one or two questions each rather than
      // one long one (see step() below). The extension and the link come in
      // the next idle moment, in a task of their own.
      const ctx = canvas.getContext("webgl2", {
        antialias: false,
        alpha: false,
        powerPreference: "high-performance",
      });
      // Without WebGL2 the <img> underneath simply stays. So it does for a
      // context this canvas already had and gave up.
      if (!ctx || ctx.isContextLost()) return;
      gl = ctx;
      cancelStart = whenIdle(() => {
        if (!dead && !ctx.isContextLost()) build(ctx);
      });
    }

    function build(ctx: WebGL2RenderingContext) {
      // Asked before the link: any question put to the GPU after it waits
      // for the compile to finish.
      const par = ctx.getExtension("KHR_parallel_shader_compile");
      const pictures = Promise.all([decodeArt(src), decodeArt(depthSrc)]);
      const linked = link(ctx);
      program = linked.program;
      shaders = linked.shaders;
      const prog = linked.program;
      // A fence behind the link as well: the GPU passes it once it has
      // worked through the link, and whether it has is free to ask. With
      // the extension, both have to say so, so that the one question that
      // is not free (did it link?) never has to wait.
      const fence = ctx.fenceSync(ctx.SYNC_GPU_COMMANDS_COMPLETE, 0);
      ctx.flush();

      // Asked once a frame until the program is built; then, in that frame
      // and on its own, whether it linked.
      const built = new Promise<boolean>((resolve) => {
        const check = () => {
          polling = 0;
          if (dead || ctx.isContextLost()) return resolve(false);
          const done =
            (!par || ctx.getProgramParameter(prog, par.COMPLETION_STATUS_KHR)) &&
            (!fence || ctx.getSyncParameter(fence, ctx.SYNC_STATUS) === ctx.SIGNALED);
          if (!done) {
            polling = requestAnimationFrame(check);
            return;
          }
          if (fence) ctx.deleteSync(fence);
          // The logs are read only when it failed.
          const ok = !!ctx.getProgramParameter(prog, ctx.LINK_STATUS);
          if (!ok) {
            for (const s of shaders) {
              if (!ctx.getShaderParameter(s, ctx.COMPILE_STATUS)) {
                console.error("[depth-portrait]", ctx.getShaderInfoLog(s));
              }
            }
            console.error("[depth-portrait]", ctx.getProgramInfoLog(prog));
          }
          resolve(ok);
        };
        polling = requestAnimationFrame(check);
      });

      Promise.all([pictures, built])
        .then(([[image, depth], ok]) => {
          if (!ok || dead || ctx.isContextLost()) {
            image.close();
            depth.close();
            return;
          }
          run(ctx, prog, image, depth);
        })
        .catch((err) => {
          if (!dead) console.error("[depth-portrait]", err);
        });
    }

    /**
     * Runs the steps one idle moment apart, while this run lives. The next
     * is cancelled through `cancelStart`, as the start itself is.
     */
    function step(steps: (() => void)[]) {
      const [next, ...rest] = steps;
      if (!next) return;
      cancelStart = whenIdle(() => {
        if (dead || !gl || gl.isContextLost()) return release?.();
        next();
        step(rest);
      });
    }

    function run(
      gl: WebGL2RenderingContext,
      prog: WebGLProgram,
      image: Art,
      depth: Art,
    ) {
      // The textures each in a task of their own (an upload waits for the
      // GPU to take the pixels), then the uniforms, then the first frame.
      let pending = [image, depth];
      release = () => {
        pending.forEach((a) => a.close());
        pending = [];
      };
      step([
        () => {
          textures.push(upload(gl, 0, image));
          pending = [depth];
        },
        () => {
          textures.push(upload(gl, 1, depth));
          pending = [];
        },
        () => play(gl, prog, image),
      ]);
    }

    function play(gl: WebGL2RenderingContext, prog: WebGLProgram, image: Art) {
      gl.useProgram(prog);

      const u = (n: string) => gl.getUniformLocation(prog, n);
      const uRes = u("uRes");
      const uImgRes = u("uImgRes");
      const uPos = u("uPos");
      const uMouse = u("uMouse");
      const uTime = u("uTime");
      const uMixRadius = u("uMixRadius");
      const uAmp = u("uAmp");
      const uDissolve = u("uDissolve");

      gl.uniform1i(u("uImage"), 0);
      gl.uniform1i(u("uDepth"), 1);
      gl.uniform2f(uPos, objectPosition[0], objectPosition[1]);
      gl.uniform1f(uAmp, amplitude);
      gl.uniform1f(u("uWarp"), warp);
      gl.uniform1f(u("uAxisX"), axis);
      gl.uniform3f(u("uEye"), eye[0], eye[1], eye[2]);
      gl.uniform1f(u("uSubject"), subject);
      gl.uniform3f(u("uBrand"), 0x55 / 255, 0x1a / 255, 0x89 / 255);

      vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      gl.uniform2f(uImgRes, image.w, image.h);

      // Pointer in 0..1, and the heavy inertia the reference runs
      // (momentum 0.92) — it should lag behind the cursor, not track it.
      const target = { x: 0.5, y: 0.5 };
      const smooth = { x: 0.5, y: 0.5 };
      const onPointer = (e: PointerEvent) => {
        target.x = e.clientX / window.innerWidth;
        target.y = e.clientY / window.innerHeight;
      };
      if (!reduce) window.addEventListener("pointermove", onPointer, { passive: true });

      // How many steps of raster the governor below has given up (0: none),
      // and the share of its budget that leaves it.
      let level = 0;
      let quality = 1;
      // The artwork's own pixel count: a raster past it only upscales the
      // art, while the fbm still runs once per pixel.
      const artPx = image.w * image.h;

      // Its own governor: frames that stay slow cost raster first, a step
      // at a time, and frames to spare win it back the same way, so a slow
      // moment is never the whole visit's. At the floor and slow for a
      // while (FLOOR_PATIENCE_MS), the portrait finishes the breath it is
      // in and holds there, whole, as its last frame; after a rest, or on
      // coming back into view, it tries again from the floor. It never
      // touches the tier.
      //
      // Slow and to spare are judged against the display's own cadence,
      // as the industry band and the trade stage judge them
      // (frameCadence()). A browser or an OS power saver holds every
      // frame to 30Hz, where no gap is ever under 20ms: judged against
      // fixed thresholds alone, the page's own load and scroll work would
      // step the raster down with nothing to win it back, and the cover
      // would stay at half raster for the visit. A step that brought no
      // faster frames than full raster gave before it, at a cadence a
      // display can have, gives all of the raster back at once; never while
      // the floor's own slow verdict is under way (slowSince), since frames
      // slowFrames() calls slow are the GPU's or the page's, and whether the
      // portrait holds is that verdict's to say.
      const cadence = frameCadence();
      let slow = slowFrames();
      let visible = true;
      // 0: the next frame draws at once and is not judged (the first, and
      // the first after a pause, a resize or a hidden tab).
      let lastDraw = 0;
      // When the next frame is due, kept on a 60Hz grid: a 120Hz display
      // draws every other frame, a 75Hz one four in five.
      let due = 0;
      // Judged gaps still to be let pass after a start, a pause, a resize or
      // a hidden tab, and until when.
      let grace = GRACE_FRAMES;
      let graceUntil = performance.now() + GRACE_MS;
      // Frames to spare, counted while raster is given up (see pace()).
      let fast = 0;
      // How many of them the next step back up needs.
      let recoverAfter = RECOVER_FRAMES;
      // Judged frames left in which a step down means the last step up did not hold.
      let proving = 0;
      // When the frames were first found slow at the floor, this stretch (0: they are not)…
      let slowSince = 0;
      // …and the judged frames since they last were.
      let sinceVerdict = 0;
      let settling = false;
      let held = false;
      let heldAt = 0;
      let rest = REST_MS;
      let restTimer = 0;
      let shaderTime = 0;
      let start = performance.now();
      let last = start;

      const fresh = () => {
        lastDraw = 0;
        due = 0;
        grace = GRACE_FRAMES;
        graceUntil = performance.now() + GRACE_MS;
      };

      const resize = () => {
        const cw = canvas.clientWidth;
        const ch = canvas.clientHeight;
        if (cw === 0 || ch === 0) return;
        // 6-octave 3D Perlin runs three times per pixel — cap the raster:
        // at 1.25 device pixels per CSS pixel, and at the artwork's own
        // pixel count, which no window up to 1920x1080 at 1x, or 1536x864
        // at 125%, reaches — those draw exactly as many pixels as before.
        const budget = Math.min(
          window.devicePixelRatio || 1,
          1.25,
          Math.sqrt(artPx / (cw * ch)),
        );
        // The held frame is drawn at the full raster, so the still it
        // leaves is as sharp as the art.
        const dpr = budget * (held ? 1 : quality);
        const w = Math.round(cw * dpr);
        const h = Math.round(ch * dpr);
        if (w === 0 || h === 0) return;
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
          gl.viewport(0, 0, w, h);
        }
        gl.uniform2f(uRes, canvas.width, canvas.height);
      };

      const setLevel = (next: number) => {
        level = next;
        quality = Math.max(FLOOR, STEP_DOWN ** level);
        resize();
      };

      /** All of the raster back, judged afresh from full. */
      const giveBack = () => {
        fast = 0;
        proving = 0;
        slowSince = 0;
        settling = false;
        slow = slowFrames();
        cadence.stepped();
        setLevel(0);
      };

      /** Judges one drawn gap: see the governor above. */
      const pace = (gap: number, now: number) => {
        if (grace > 0 && now < graceUntil) {
          grace--;
          return;
        }
        if (proving > 0) proving--;
        // Past the adopted cadence, if there is one; until then exactly
        // slowFrames()'s fixed 34ms, since that is over SLOW_MS as well.
        const over = cadence.slow(gap);
        if (cadence.read(gap, level > 0, !slowSince)) {
          // The raster given up came no faster than full raster did before
          // the step from it: the display is the limit, not the GPU.
          giveBack();
          return;
        }
        if (slow(over ? gap : 0)) {
          fast = 0;
          if (level < LEVELS) {
            // A step back up that did not hold makes the next one wait
            // twice as long; after one that held, the wait starts over.
            recoverAfter = proving > 0 ? Math.min(RECOVER_MAX_FRAMES, recoverAfter * 2) : RECOVER_FRAMES;
            proving = 0;
            cadence.stepped(level === 0);
            setLevel(level + 1);
          } else {
            slowSince ||= now;
            sinceVerdict = 0;
            if (now - slowSince >= FLOOR_PATIENCE_MS) settling = true;
          }
          return;
        }
        if (slowSince && ++sinceVerdict > FLOOR_FORGET) slowSince = 0;
        // Only a slow verdict (above) starts the count over: a busy page's
        // frames are never all short, and one long one is not a verdict.
        if (level === 0) fast = 0;
        else if (gap < FAST_MS) fast++;
        if (fast >= recoverAfter) {
          proving = recoverAfter;
          fast = 0;
          slowSince = 0;
          settling = false;
          cadence.stepped();
          setLevel(level - 1);
        }
      };

      /** A held portrait moves again, from the floor, judged afresh. */
      const wake = () => {
        clearTimeout(restTimer);
        restTimer = 0;
        if (dead || !held) return;
        held = false;
        settling = false;
        slowSince = 0;
        slow = slowFrames();
        // The breath picks up where it was held, not where the clock got to.
        const now = performance.now();
        start += now - heldAt;
        last = now;
        resize();
        fresh();
        if (visible && !raf) raf = requestAnimationFrame(frame);
      };

      // The reference's `appear` states: the warp opens at full-frame and
      // closes to a centred blob while its speed eases off, so the figure
      // resolves out of liquid noise over the first second.
      const easeCubic = (s: number) =>
        s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2;
      const easeQuart = (s: number) =>
        s < 0.5 ? 8 * s ** 4 : 1 - Math.pow(-2 * s + 2, 4) / 2;

      function frame(now: number) {
        raf = 0;
        if (dead) return;
        // Held: the same frame again, after a resize cleared it.
        if (held) {
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          return;
        }
        if (due && now < due - FRAME_SLACK_MS) {
          raf = requestAnimationFrame(frame);
          return;
        }
        due = (due > now - FRAME_MS ? due : now) + FRAME_MS;
        if (lastDraw && !reduce) pace(now - lastDraw, now);
        lastDraw = now;
        const dt = Math.min(Math.max(0, now - last) / 1000, 1 / 20);
        last = now;
        const elapsed = Math.max(0, now - start) / 1000;

        const mixRadius = reduce
          ? 0.44
          : 1 + (0.44 - 1) * easeCubic(Math.min(1, elapsed / 1.0));
        const speed = reduce
          ? 0
          : 0.35 + (0.12 - 0.35) * easeQuart(Math.min(1, elapsed / 0.9));
        shaderTime += dt * speed * COVER_FLOW;

        // momentum: ease toward the pointer rather than snapping to it —
        // 0.055 of the way per 60th of a second, at any frame rate
        const k = 1 - Math.pow(1 - 0.055, dt * 60);
        smooth.x += (target.x - smooth.x) * k;
        smooth.y += (target.y - smooth.y) * k;
        // Idle orbit so the portrait still turns on touch, or when the
        // cursor is parked. Small enough to read as breathing, not drift.
        const dx = reduce ? 0 : Math.sin(elapsed * 0.21) * 0.09;
        const dy = reduce ? 0 : Math.cos(elapsed * 0.16) * 0.06;

        // Reduced motion gets the portrait whole and still, not mid-tear.
        const dissolve = reduce ? 0 : coverDissolveAt(elapsed);
        if (settling && dissolve < WHOLE) {
          held = true;
          heldAt = now;
          resize();
          restTimer = window.setTimeout(wake, rest);
          rest = Math.min(REST_MAX_MS, rest * 2);
        }
        gl.uniform2f(uMouse, smooth.x + dx, smooth.y + dy);
        gl.uniform1f(uTime, shaderTime);
        gl.uniform1f(uMixRadius, mixRadius);
        gl.uniform1f(uDissolve, dissolve);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        if (visible && !reduce && !held) raf = requestAnimationFrame(frame);
      }

      // A resize clears the canvas, so one that is not looping draws again.
      const ro = new ResizeObserver(() => {
        resize();
        fresh();
        if (visible && !raf && !dead) raf = requestAnimationFrame(frame);
      });
      ro.observe(canvas);

      // Don't burn a rAF loop on a hero that has scrolled away. Under a
      // fifth of it left, the band still showing sits under the ink scrim,
      // and keeps its last frame.
      const io = new IntersectionObserver(
        (entries) => {
          const was = visible;
          // The last entry is the element as it is now: a busy main thread can hand one callback several.
          visible = entries[entries.length - 1].intersectionRatio >= 0.2;
          // Back in view, a held portrait tries again at once.
          if (visible && !was && held) wake();
          else if (visible && !raf && !dead) {
            fresh();
            raf = requestAnimationFrame(frame);
          }
        },
        { threshold: [0, 0.2] },
      );
      io.observe(canvas);

      // A hidden tab's gap says nothing about the device.
      document.addEventListener("visibilitychange", fresh);

      unhook = () => {
        clearTimeout(restTimer);
        ro.disconnect();
        io.disconnect();
        window.removeEventListener("pointermove", onPointer);
        document.removeEventListener("visibilitychange", fresh);
      };

      resize();
      setReady(true);
      onReady?.();
      raf = requestAnimationFrame(frame);
    }
    // Rebuilt when the art-directed crop changes; otherwise the effect
    // owns the GL context for the component's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, depthSrc, axis, eye, subject, objectPosition]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{
        opacity: ready ? 1 : 0,
        // Hidden, not just transparent, until it is ready: a canvas the
        // compositor has to draw costs the GPU a pass over the whole cover,
        // and every question put to the GPU meanwhile (the link, the
        // uniforms, the upload) waits behind it. Visibility flips at once
        // on the way in and only after the fade on the way out.
        visibility: ready ? "visible" : "hidden",
        transition: `opacity ${FADE_MS}ms cubic-bezier(0.16,1,0.3,1), visibility ${FADE_MS}ms`,
      }}
    />
  );
}
