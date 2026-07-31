"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  COVER_FLOW,
  COVER_NOISE_GLSL,
  COVER_NOISE_SKEW,
  coverDissolveAt,
  coverElapsed,
} from "./cover-noise";

/**
 * Torn edges — the cover's dissolve, on a rule.
 *
 * A plate's frame is four hairlines. Under the cover's own logic they
 * should not be clean: everything else on the sheet is coming apart and
 * putting itself back together, and a perfectly straight 1px border is the
 * one thing on the page that has never been touched by the effect. So the
 * rules fray. A solid mass above, filaments hanging out of it below, on the
 * cover's twelve-second breath.
 *
 * ONE WEBGL CONTEXT, shared.
 *
 * This is the refactor that had to happen before this feature could exist,
 * and it is worth being explicit about why. Every earlier effect on this
 * page owns its own context: the portrait, the field, and one per heading.
 * Eight torn edges running continuously would have taken that past nine
 * live contexts, and five was already enough to starve requestAnimationFrame
 * on this machine. Chrome does not fail loudly here — it evicts the oldest
 * context and the effect simply stops somewhere up the page.
 *
 * So a module-level singleton owns one context, one program, one loop, and
 * every edge registers with it. Per frame it draws each registration into a
 * corner of one shared GL canvas and blits the result into that edge's own
 * 2D canvas. The blit is a GPU copy; the saving is eight contexts down to
 * one. The same renderer could take the headings later — it is written to.
 */

const VERT = `#version 300 es
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

uniform sampler2D uSrc;
uniform vec2  uSize;      // this registration's size, device px
uniform vec2  uFull;      // the shared canvas size, device px
uniform float uSubject;   // the mass's own depth, device px
uniform vec2  uSkew;
uniform float uTime;
uniform float uDissolve;
uniform float uWarpPx;
uniform vec3  uBrand;

${COVER_NOISE_GLSL}

void main() {
  /* The shared canvas is bigger than most registrations, and each is drawn
     into its bottom-left corner, so fragments outside this one's box are
     simply not ours. */
  vec2 px = vUv * uFull;
  if (px.x > uSize.x || px.y > uSize.y) {
    fragColor = vec4(0.0);
    return;
  }
  vec2 uv = vec2(px.x / uSize.x, 1.0 - px.y / uSize.y);

  // The cover's domain, measured against the subject — see dissolve-text
  // for why this is not a fixed rate per pixel.
  vec2 st = (uv * uSize / uSubject) * 1.7806 * uSkew;
  vec2 drift = vec2(0.0, uTime * 0.005);
  float t = uTime * 0.025;

  vec2 r = vec2(
    fbm(vec3(st - drift + vec2(1.7, 9.2), t)),
    fbm(vec3(st - drift + vec2(8.2, 1.3), t))
  );
  float f = fbm(vec3(st + r - drift, t)) * 0.35;
  vec2 fine = f * 2.0 + r * 0.35;

  /* The rule itself is spared. The cover holds the eyes clean through the
     tear so one part of the figure keeps holding together; here the mass at
     the top is that part — a frame whose own line wandered would read as a
     rendering fault rather than as an effect. The displacement ramps in
     below it, which is also what makes the filaments hang rather than
     shimmer in place. */
  float hold = 1.0 - smoothstep(0.10, 0.40, uv.y);

  vec2 warp = fine * uWarpPx * uDissolve * (1.0 - hold) / uSize;

  vec4 c = texture(uSrc, uv + warp);

  // The cover's grade: keep the pigment violet where the tear drags dark
  // over light.
  float sat = max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b);
  c.rgb = mix(c.rgb, uBrand * (0.5 + dot(c.rgb, vec3(0.299, 0.587, 0.114)) * 1.5),
              0.10 * smoothstep(0.03, 0.30, sat));

  vec3 h = fract(vec3(gl_FragCoord.xyx) * 0.1031 + fract(uTime * 0.5));
  h += dot(h, h.yzx + 33.33);
  c.rgb += (fract((h.x + h.y) * h.z) - 0.5) * 0.016;

  fragColor = c;
}`;

type Registration = {
  /** The visible canvas this edge draws into. */
  ctx: CanvasRenderingContext2D;
  /** The rasterised source: a mass with a soft underside. */
  src: HTMLCanvasElement;
  tex: WebGLTexture;
  w: number;
  h: number;
  subject: number;
  warpPx: number;
  /** Off-screen registrations are skipped, not drawn and thrown away. */
  visible: boolean;
};

type Handle = {
  stop(): void;
  /** The renderer reads `visible` off the live registration, so this has to
      mutate that object — an equivalent copy would silently do nothing. */
  setVisible(v: boolean): void;
};

type Renderer = {
  add(r: Omit<Registration, "tex">): Handle | null;
};

let renderer: Renderer | null = null;
let rendererTried = false;

function getRenderer(): Renderer | null {
  if (rendererTried) return renderer;
  rendererTried = true;

  const glCanvas = document.createElement("canvas");
  const gl = glCanvas.getContext("webgl2", {
    antialias: false,
    alpha: true,
    premultipliedAlpha: false,
  });
  if (!gl) return null;

  const compile = (type: number, src: string) => {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error("[cover-tear]", gl.getShaderInfoLog(sh));
      return null;
    }
    return sh;
  };
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error("[cover-tear]", gl.getProgramInfoLog(prog));
    return null;
  }
  gl.useProgram(prog);
  gl.bindVertexArray(gl.createVertexArray());
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  const u = (n: string) => gl.getUniformLocation(prog, n);
  const uSize = u("uSize");
  const uFull = u("uFull");
  const uSubject = u("uSubject");
  const uTime = u("uTime");
  const uDissolve = u("uDissolve");
  const uWarpPx = u("uWarpPx");
  gl.uniform1i(u("uSrc"), 0);
  gl.uniform2f(u("uSkew"), COVER_NOISE_SKEW[0], COVER_NOISE_SKEW[1]);

  const brand = getComputedStyle(document.documentElement)
    .getPropertyValue("--cover-brand")
    .trim()
    .match(/^#([0-9a-f]{6})$/i);
  const bn = brand ? parseInt(brand[1], 16) : 0x551a89;
  gl.uniform3f(u("uBrand"), (bn >> 16) / 255, ((bn >> 8) & 255) / 255, (bn & 255) / 255);

  const regs = new Set<Registration>();
  let raf = 0;
  let shaderTime = 0;
  let last = performance.now();
  let lastDraw = 0;
  const DRAW_INTERVAL = 1000 / 30;

  const fit = () => {
    let w = 1;
    let h = 1;
    for (const r of regs) {
      w = Math.max(w, r.w);
      h = Math.max(h, r.h);
    }
    if (glCanvas.width !== w || glCanvas.height !== h) {
      glCanvas.width = w;
      glCanvas.height = h;
    }
  };

  const frame = () => {
    raf = 0;
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    // The cover's drift, the value its own speed ramp settles to.
    shaderTime += dt * 0.12 * COVER_FLOW;

    if (now - lastDraw >= DRAW_INTERVAL) {
      lastDraw = now;
      const dissolve = coverDissolveAt(coverElapsed());
      gl.uniform1f(uTime, shaderTime);
      gl.uniform1f(uDissolve, dissolve);
      gl.uniform2f(uFull, glCanvas.width, glCanvas.height);

      for (const r of regs) {
        if (!r.visible) continue;
        gl.viewport(0, 0, glCanvas.width, glCanvas.height);
        gl.uniform2f(uSize, r.w, r.h);
        gl.uniform1f(uSubject, r.subject);
        gl.uniform1f(uWarpPx, r.warpPx);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, r.tex);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        // Each registration is drawn into the shared canvas's top-left in
        // its own coordinates, so the blit is a straight copy of that box.
        r.ctx.clearRect(0, 0, r.w, r.h);
        r.ctx.drawImage(glCanvas, 0, 0, r.w, r.h, 0, 0, r.w, r.h);
      }
    }

    if (regs.size) raf = requestAnimationFrame(frame);
  };

  renderer = {
    add(input) {
      const tex = gl.createTexture();
      if (!tex) return null;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, input.src);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      const reg: Registration = { ...input, tex };
      regs.add(reg);
      fit();
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
      return {
        stop() {
          regs.delete(reg);
          gl.deleteTexture(tex);
          fit();
          if (!regs.size && raf) {
            cancelAnimationFrame(raf);
            raf = 0;
          }
        },
        setVisible(v: boolean) {
          reg.visible = v;
        },
      };
    },
  };
  return renderer;
}

/**
 * One frayed rule.
 *
 * The source is drawn in 2D: a hairline of `--cover-paper` with a soft
 * gradient hanging beneath it. The rule is what the shader holds still; the
 * gradient is the material the filaments are torn out of, which is why it
 * is there at all — displacing a bare 1px line only makes it wobble, and a
 * wobbling border reads as a bug. A mass with an underside frays.
 */
export function TornEdge({
  className,
  /* Deep enough for the tear to travel, shallow enough that the curtain
     stays an edge. At eight em and near-full opacity the filaments were
     right and the plate underneath went dark — the curtain has to fray the
     boundary, not shade the figure it belongs to. */
  height = 4.6,
  opacity = 0.6,
}: {
  className?: string;
  /** Depth of the hanging curtain, in em of the cover's scale. */
  height?: number;
  opacity?: number;
}) {
  const hostRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = hostRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let handle: Handle | null = null;
    let io: IntersectionObserver | null = null;
    let ro: ResizeObserver | null = null;
    let rebuild = 0;
    let disposed = false;

    const build = () => {
      handle?.stop();
      handle = null;
      const r = getRenderer();
      if (!r || disposed) return;

      const cs = getComputedStyle(canvas);
      const em = parseFloat(cs.fontSize) || 16;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const wCss = canvas.clientWidth;
      const hCss = height * em;
      if (wCss < 4) return;

      const w = Math.round(wCss * dpr);
      const h = Math.round(hCss * dpr);
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      /* The mass is the plate's own ink, not a bright rule.
         The cover tears a DARK head out over a LIGHT field, and every
         version of this so far built the opposite — a pale band on a dark
         ground — then wondered why the filaments never read. The plate
         already has the right material in it: the pool of washed ink it
         sits on is a dark mass against a lighter moving field. Fraying the
         pool's edge is the cover's exact contrast relationship, and it
         needs no new bar drawn across the figure to do it. */
      const mass =
        cs.getPropertyValue("--cover-field-low").trim() || "#171520";

      // The source: rule on top, mass beneath it, fading out.
      const src = document.createElement("canvas");
      src.width = w;
      src.height = h;
      const sctx = src.getContext("2d");
      if (!sctx) return;
      /* A thin mass and a great deal of room under it.
         The cover drags its mass roughly three quarters of the mass's own
         size — 353px of travel on a 469px subject — and the filaments you
         see are the head's own dark pixels pulled far out over the light
         field. A sixty-pixel band has nowhere to pull anything, which is
         why the first attempts moved without ever coming apart: the tear
         needs vertical room, not a stronger setting. So the mass is the top
         tenth and the rest is empty, and the strip hangs over the content
         below rather than occupying space in the flow — which is also what
         the cover does, its filaments falling across the field. */
      const grad = sctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, mass);
      grad.addColorStop(0.4, mass);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      sctx.globalAlpha = opacity;
      sctx.fillStyle = grad;
      sctx.fillRect(0, 0, w, h);

      /* Give the mass something to shred.
         The dissolve is a DISPLACEMENT: it can only reveal structure the
         source already has. The cover tears a photograph — hair, edges,
         grain — so the warp separates detail into strands. A smooth gradient
         displaced by any amount is still a smooth gradient, which is exactly
         what the first attempts looked like: a band that moved without ever
         coming apart. So the underside is combed into vertical strokes of
         varying reach before the shader sees it. Deterministic, because a
         source that reshuffled on every resize would flicker. */
      const strokeTop = Math.max(1, Math.round(h * 0.4));
      sctx.globalAlpha = 1;
      sctx.globalCompositeOperation = "destination-out";
      for (let x = 0; x < w; x++) {
        // Two incommensurate sines: dense variation with no visible period.
        const n =
          0.5 +
          0.5 * Math.sin(x * 0.21 + Math.cos(x * 0.043) * 2.3);
        const keep = strokeTop + (h - strokeTop) * (0.15 + n * 0.85);
        sctx.fillRect(x, keep, 1, h - keep);
      }
      sctx.globalCompositeOperation = "source-over";

      /* The subject is the strip's WIDTH, not its depth.
         A filament's width is set by how fast the noise varies across x, so
         the subject has to be the horizontal extent — measuring against the
         strip's depth instead put the filament-bearing octaves at a third
         of a pixel and the tear came out as a soft grey band. On the cover a
         filament is one or two percent of the frame; at 1.78 units per
         subject the fifth octave lands near subject/69, which is what puts
         it there. Depth then only decides how far they can hang. */
      const subject = w;
      const warpPx = h * 2.4;

      const added = r.add({
        ctx,
        src,
        w,
        h,
        subject,
        warpPx,
        visible: true,
      });
      if (!added) return;
      handle = added;

      // The renderer skips registrations that are off screen; this is what
      // tells it which those are.
      io?.disconnect();
      io = new IntersectionObserver(
        ([e]) => added.setVisible(e.isIntersecting),
        { threshold: 0 },
      );
      io.observe(canvas);
    };

    build();

    ro = new ResizeObserver(() => {
      window.clearTimeout(rebuild);
      rebuild = window.setTimeout(() => {
        if (!disposed) build();
      }, 200);
    });
    ro.observe(canvas);

    return () => {
      disposed = true;
      window.clearTimeout(rebuild);
      ro?.disconnect();
      io?.disconnect();
      handle?.stop();
    };
  }, [height, opacity]);

  /* The wrapper takes no height of its own: only the rule sits in the flow,
     and the curtain hangs out of it over whatever is below. Laying the full
     depth out in the flow would push every plate apart by half a screen to
     make room for something that is mostly empty. */
  return (
    <div className={cn("relative h-px w-full", className)}>
      <canvas
        ref={hostRef}
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0"
        style={{ display: "block", width: "100%", height: `${height}em` }}
      />
    </div>
  );
}
