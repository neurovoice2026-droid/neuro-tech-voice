"use client";

import { useEffect, useRef } from "react";
import {
  COVER_FLOW,
  COVER_NOISE_GLSL,
  coverDissolveAt,
} from "./cover-noise";

/**
 * The cover's moving background, with nothing in front of it.
 *
 * The hero is two things stacked: a portrait being torn apart by
 * domain-warped noise, and the field that portrait sits in — a purple
 * pigment wash and a vignette, both sliding on one low-frequency Perlin
 * per axis, dithered. Strip the portrait and the field is what's left,
 * and the field is the part that can carry a page of text behind it.
 *
 * So this is not "a background inspired by the hero". It is the hero's
 * own background layers, rebuilt in the shader instead of in CSS so the
 * same noise that shreds the portrait can move them:
 *
 *   - the wash is the cover's `radial-gradient(62% 50% at 52% 32%)`
 *   - the vignette is its `radial-gradient(105% 88% at 50% 46%)`
 *   - the displacement is the cover's FIELD term, unchanged
 *   - the filaments are its fbm at the same 0.25 vertical skew
 *   - the dither is its dither layer at the same 0.016
 *
 * and the swell is `coverDissolveAt` — literally the same clock, so the
 * field breathes on the portrait's beat rather than alongside it.
 *
 * The canvas is sticky and one viewport tall, so a spread of any length
 * costs exactly what the hero costs: the field is a backdrop the page
 * travels over, which is also how the hero's own parallax reads.
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

uniform vec2  uRes;       // canvas size, px
uniform float uTime;      // already scaled by the animated speed
uniform float uDissolve;  // 0 settled -> 1 fully open -> 0 again
// The cover's three measured tones — washed black, the face's mauve, the
// backlight's silver-grey. See --cover-field-* in globals.css.
uniform vec3  uLow;
uniform vec3  uMid;
uniform vec3  uHigh;

${COVER_NOISE_GLSL}

void main() {
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);

  /* Two spaces, on purpose. The gradients are read in uv, so they sit
     exactly where the cover's CSS puts them at any window shape; the
     noise is read in p, normalised to the short edge, so its grain stays
     round instead of stretching with the window. */
  vec2 p = (uv - 0.5) * (uRes / min(uRes.x, uRes.y));

  float t = uTime * 0.025;

  /* The field term, unchanged from the cover.

     One low-frequency Perlin per axis, and that is the whole trick:
     fine noise moves neighbouring pixels by different amounts and the
     difference is what you see as texture, while a single octave moves
     them together, so a smooth gradient sliding smoothly is invisible as
     texture and visible only as motion. */
  const float FIELD_SCALE  = 0.68;
  const float FIELD_AMOUNT = 0.62;
  vec2 field = vec2(
    perlin(vec3(p * FIELD_SCALE + vec2(3.1, 7.7), t * 0.5)),
    perlin(vec3(p * FIELD_SCALE + vec2(9.3, 2.4), t * 0.5))
  ) * FIELD_AMOUNT;

  vec2 wuv = uv + field * 0.16;

  // The cover's pigment wash: 62% 50% at 52% 32%.
  float bloom = 1.0 - smoothstep(
    0.0, 1.0, length((wuv - vec2(0.52, 0.32)) / vec2(0.62, 0.50))
  );

  // The cover's vignette: 105% 88% at 50% 46%, transparent to 34%.
  float vig = smoothstep(
    0.34, 1.0, length((wuv - vec2(0.50, 0.46)) / vec2(1.05, 0.88))
  );

  /* Filaments. The 0.25 skew in y is what shreds the cover's portrait
     into vertical strands rather than smearing it into a blur; with no
     figure here to shred, the same stack at a fraction of its amplitude
     is the grain of that effect — the page is visibly made of whatever
     the hero was coming apart into. */
  vec2 st = p * 3.4 * vec2(1.0, 0.25);
  float fil = fbm(vec3(st - vec2(0.0, uTime * 0.005), t));

  /* One envelope, shared with the portrait. Churn held at a constant
     amplitude is just fuzz sitting there; the amplitude has to travel to
     zero and back for the motion to read as an event rather than noise. */
  float breath = 0.40 + 0.60 * uDissolve;

  /* Grade.

     Every term above is untouched — same field displacement, same bloom,
     same filaments, same breath, same vignette. Only the lookup they
     drive is different: this used to add a saturated pigment onto near
     black, which is a violet the cover does not contain. Now the bloom
     walks the cover's own three tones in the cover's own order — washed
     charcoal, through the face's muted mauve, up to the backlight's
     silver-grey — so the motion is the same effect wearing measured
     colour instead of assumed colour. */
  // Named level, not t: t is the noise clock, declared above. Shadowing
  // it compiled to nothing and the page silently ran on the CSS still.
  float level = bloom * breath;
  vec3 col = mix(uLow, uMid, smoothstep(0.00, 0.62, level));
  col = mix(col, uHigh, smoothstep(0.40, 1.00, level));

  // Filaments lift toward the backlight rather than adding pigment.
  float lift = clamp(max(fil, 0.0) * 0.85 * uDissolve * (0.30 + bloom), 0.0, 1.0);
  col = mix(col, uHigh, lift);

  col = mix(col, uLow, vig * 0.88);

  // Animated dither, as the cover's dither layer at speed 0.5.
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
    console.error("[cover-field]", gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export function CoverField({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
    if (!gl) return; // caller keeps its CSS gradient visible

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;

    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error("[cover-field]", gl.getProgramInfoLog(prog));
      return;
    }
    gl.useProgram(prog);

    const u = (n: string) => gl.getUniformLocation(prog, n);
    const uRes = u("uRes");
    const uTime = u("uTime");
    const uDissolve = u("uDissolve");

    // Read the tones off `.cover`, so retoning the palette in one place
    // cannot leave the field behind on last month's colours.
    const css = getComputedStyle(canvas);
    const send = (uniform: string, token: string, fallback: number) => {
      const m = css.getPropertyValue(token).trim().match(/^#([0-9a-f]{6})$/i);
      const n = m ? parseInt(m[1], 16) : fallback;
      gl.uniform3f(
        u(uniform),
        (n >> 16) / 255,
        ((n >> 8) & 255) / 255,
        (n & 255) / 255,
      );
    };
    send("uLow", "--cover-field-low", 0x171520);
    send("uMid", "--cover-field-mid", 0x3b2f4a);
    send("uHigh", "--cover-field-high", 0x4b4451);

    let vao: WebGLVertexArrayObject | null = gl.createVertexArray();
    gl.bindVertexArray(vao);

    let raf = 0;
    let visible = true;
    let disposed = false;
    const start = performance.now();

    /* Raster budget, in pixels.
       The hero caps device-pixel-ratio and stops there, which is fine for
       it: it draws a photograph and needs the detail. This draws soft
       gradients, and the cost is brutal — three fbm calls per pixel, eight
       octaves each, so ~24 Perlin evaluations for every fragment. On a
       2549x1305 window that is 3.3M pixels and the frame budget is gone.
       Capping the ratio alone does not help, because the window is
       genuinely that many CSS pixels; the cap has to be on area. Below,
       the canvas renders inside this budget and CSS scales it up, which
       nothing reveals — there is no edge in a gradient to soften, and the
       grain layer sits over the top of it regardless. */
    const PIXEL_BUDGET = 1_400_000;

    const resize = () => {
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      if (cw === 0 || ch === 0) return;
      const dpr = Math.min(
        window.devicePixelRatio || 1,
        Math.sqrt(PIXEL_BUDGET / (cw * ch)),
      );
      const w = Math.round(cw * dpr);
      const h = Math.round(ch * dpr);
      if (w === 0 || h === 0) return;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(uRes, canvas.width, canvas.height);
      if (reduce) draw(0);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Don't burn a rAF loop on a spread that has scrolled away.
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible && !raf && !disposed && !reduce) {
          raf = requestAnimationFrame(frame);
        }
      },
      { threshold: 0 },
    );
    io.observe(canvas);

    const easeQuart = (s: number) =>
      s < 0.5 ? 8 * s ** 4 : 1 - Math.pow(-2 * s + 2, 4) / 2;

    let shaderTime = 0;
    let last = performance.now();

    function draw(dissolve: number) {
      if (!gl) return;
      gl.uniform1f(uTime, shaderTime);
      gl.uniform1f(uDissolve, dissolve);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function frame() {
      raf = 0;
      if (disposed || !gl) return;
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 1 / 20);
      last = now;
      const elapsed = (now - start) / 1000;

      // The cover's speed ramp: it opens fast and eases off to a drift.
      const speed = 0.35 + (0.12 - 0.35) * easeQuart(Math.min(1, elapsed / 0.9));
      shaderTime += dt * speed * COVER_FLOW;

      draw(coverDissolveAt(elapsed));
      if (visible) raf = requestAnimationFrame(frame);
    }

    resize();
    // Reduced motion gets one frame at the settled end of the breath.
    if (reduce) draw(0);
    else raf = requestAnimationFrame(frame);

    /* Reveal by writing the style, not by setting state.
       The portrait fades in from a `ready` flag, and can: it is waiting on
       two textures, so the flag flips in a later task and React gets a
       render to transition across. Nothing here is async — the shader is
       built and drawn inside this effect — so the same flag would flip
       before the browser ever painted the opacity it was transitioning
       from, giving a cascading render and no fade for it to cause. The
       canvas is an external system at this point; writing to it directly
       is the thing effects are for. */
    canvas.style.opacity = "1";

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      if (vao) gl.deleteVertexArray(vao);
      vao = null;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      // Starts hidden so the still gradient underneath carries the first
      // paint; the effect raises it once there is a frame in the buffer.
      // A browser with no WebGL2 never gets that far and the still stays.
      style={{
        opacity: 0,
        transition: "opacity 900ms cubic-bezier(0.16,1,0.3,1)",
      }}
    />
  );
}
