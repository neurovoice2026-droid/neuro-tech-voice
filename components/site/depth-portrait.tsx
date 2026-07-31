"use client";

import { useEffect, useRef, useState } from "react";
import type { CoverArt } from "@/lib/site";
import {
  COVER_FLOW,
  COVER_NOISE_GLSL,
  coverDissolveAt,
} from "./cover-noise";

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

  vec2 r = vec2(
    fbm(vec3(st - drift + vec2(1.7, 9.2), t)),
    fbm(vec3(st - drift + vec2(8.2, 1.3), t))
  );
  float f = fbm(vec3(st + r - drift, t)) * 0.35;
  // Displacement is in image UV, so the same number moves a different
  // fraction of the head in each crop. Scaling by the head makes the tear
  // travel the same distance across the face on a phone as on a desktop.
  vec2 fine = f * 2.0 + r * 0.35;

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
     of the face still holding together. */
  float eyeD = length((fuv - vec2(uAxisX + uEye.x, uEye.y))
                      / vec2(uEye.z * 1.5, uEye.z));
  float eyeGuard = 1.0 - smoothstep(1.15, 2.1, eyeD);

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

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error("[depth-portrait]", gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

function loadTexture(gl: WebGL2RenderingContext, url: string) {
  return new Promise<{ tex: WebGLTexture; w: number; h: number }>(
    (resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const tex = gl.createTexture();
        if (!tex) return reject(new Error("no texture"));
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        resolve({ tex, w: img.naturalWidth, h: img.naturalHeight });
      };
      img.onerror = () => reject(new Error(`failed: ${url}`));
      img.src = url;
    },
  );
}

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
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });
    if (!gl) return; // caller keeps the static <Image> visible

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;

    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error("[depth-portrait]", gl.getProgramInfoLog(prog));
      return;
    }
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

    // Pointer in 0..1, and the heavy inertia the reference runs
    // (momentum 0.92) — it should lag behind the cursor, not track it.
    const target = { x: 0.5, y: 0.5 };
    const smooth = { x: 0.5, y: 0.5 };
    const onPointer = (e: PointerEvent) => {
      target.x = e.clientX / window.innerWidth;
      target.y = e.clientY / window.innerHeight;
    };
    if (!reduce) window.addEventListener("pointermove", onPointer, { passive: true });

    let vao: WebGLVertexArrayObject | null = gl.createVertexArray();
    gl.bindVertexArray(vao);

    let raf = 0;
    let visible = true;
    let disposed = false;
    const start = performance.now();

    const resize = () => {
      // 6-octave 3D Perlin runs three times per pixel — cap the raster.
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      const w = Math.round(canvas.clientWidth * dpr);
      const h = Math.round(canvas.clientHeight * dpr);
      if (w === 0 || h === 0) return;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(uRes, canvas.width, canvas.height);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Don't burn a rAF loop on a hero that has scrolled away.
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible && !raf && !disposed) raf = requestAnimationFrame(frame);
      },
      { threshold: 0 },
    );
    io.observe(canvas);

    // The reference's `appear` states: the warp opens at full-frame and
    // closes to a centred blob while its speed eases off, so the figure
    // resolves out of liquid noise over the first second.
    const easeCubic = (s: number) =>
      s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2;
    const easeQuart = (s: number) =>
      s < 0.5 ? 8 * s ** 4 : 1 - Math.pow(-2 * s + 2, 4) / 2;

    let shaderTime = 0;
    let last = performance.now();

    function frame() {
      raf = 0;
      if (disposed || !gl) return;
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 1 / 20);
      last = now;
      const elapsed = (now - start) / 1000;

      const mixRadius = reduce
        ? 0.44
        : 1 + (0.44 - 1) * easeCubic(Math.min(1, elapsed / 1.0));
      const speed = reduce
        ? 0
        : 0.35 + (0.12 - 0.35) * easeQuart(Math.min(1, elapsed / 0.9));
      shaderTime += dt * speed * COVER_FLOW;

      // momentum: ease toward the pointer rather than snapping to it
      smooth.x += (target.x - smooth.x) * 0.055;
      smooth.y += (target.y - smooth.y) * 0.055;
      // Idle orbit so the portrait still turns on touch, or when the
      // cursor is parked. Small enough to read as breathing, not drift.
      const dx = reduce ? 0 : Math.sin(elapsed * 0.21) * 0.09;
      const dy = reduce ? 0 : Math.cos(elapsed * 0.16) * 0.06;

      gl.uniform2f(uMouse, smooth.x + dx, smooth.y + dy);
      gl.uniform1f(uTime, shaderTime);
      gl.uniform1f(uMixRadius, mixRadius);
      // Reduced motion gets the portrait whole and still, not mid-tear.
      gl.uniform1f(uDissolve, reduce ? 0 : coverDissolveAt(elapsed));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (visible && !reduce) raf = requestAnimationFrame(frame);
    }

    let textures: WebGLTexture[] = [];
    Promise.all([loadTexture(gl, src), loadTexture(gl, depthSrc)])
      .then(([image, depth]) => {
        if (disposed) return;
        textures = [image.tex, depth.tex];
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, image.tex);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, depth.tex);
        gl.uniform2f(uImgRes, image.w, image.h);
        resize();
        setReady(true);
        onReady?.();
        raf = requestAnimationFrame(frame);
      })
      .catch((err) => console.error("[depth-portrait]", err));

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onPointer);
      textures.forEach((t) => gl.deleteTexture(t));
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      if (vao) gl.deleteVertexArray(vao);
      vao = null;
    };
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
        transition: "opacity 900ms cubic-bezier(0.16,1,0.3,1)",
      }}
    />
  );
}
