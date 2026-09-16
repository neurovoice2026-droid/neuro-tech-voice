"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { cn } from "@/lib/utils";
import { whenIdle } from "./motion-kit";
import { Orb } from "./primitives";

/* ------------------------------------------------------------------ *
 * A voice sphere drawn by a fragment shader.
 *
 * Colour lives on the surface of a slowly turning sphere as layered 3D
 * simplex noise, domain-warped so the fields fold through each other the
 * way a liquid does, then lit from the upper left, rimmed in the palette's
 * deepest colour and filmed with animated grain. Its palette is the same
 * five-slot mesh the CSS orb uses, and it eases between palettes instead of
 * cutting.
 *
 * `volume` is read every frame (0–1). It speeds the flow and deepens the
 * warp, which is what makes the sphere look like it is speaking.
 *
 * Third-party shader code, both MIT-licensed, with their notices kept in
 * the shader source: 3D simplex noise from webgl-noise (Copyright (C) 2011
 * Ashima Arts, Stefan Gustavson) and "Hash without Sine" (Copyright (c)
 * 2014 David Hoskins). The MIT License requires those notices to stay.
 *
 * One WebGL2 context per instance: meant for the one large orb on a stage,
 * not for rows of small ones. The context is only created once the orb
 * comes near the screen, in an idle moment; until then, and for good
 * without WebGL, the CSS mesh orb stands in.
 * ------------------------------------------------------------------ */

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uVol;
uniform float uGrain;
uniform vec3 uColors[5];
out vec4 outColor;

// 3D simplex noise (mod289, permute, taylorInvSqrt, snoise) from webgl-noise:
// Copyright (C) 2011 Ashima Arts, Stefan Gustavson. Distributed under the
// MIT License. https://github.com/stegu/webgl-noise
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// "Hash without Sine", Copyright (c) 2014 David Hoskins. MIT License.
// https://www.shadertoy.com/view/4djSRW
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec3 ramp(float x) {
  float s = clamp(x, 0.0, 1.0) * 4.0;
  float i = min(floor(s), 3.0);
  float f = s - i;
  f = f * f * (3.0 - 2.0 * f);
  int a = int(i);
  return mix(uColors[a], uColors[a + 1], f);
}

void main() {
  vec2 uv = (gl_FragCoord.xy / uRes) * 2.0 - 1.0;
  float r = length(uv);
  float aa = 3.0 / uRes.x;
  float mask = 1.0 - smoothstep(1.0 - aa, 1.0, r);
  if (mask <= 0.0) { outColor = vec4(0.0); return; }

  float rc = min(r, 1.0);
  vec3 n = vec3(uv, sqrt(max(0.0, 1.0 - rc * rc)));

  // The sphere turns slowly about a tilted axis. The noise is sampled at a
  // low frequency so the colour sits in a few large, soft fields.
  float t = uTime;
  float a = t * 0.09;
  mat3 turn = mat3(cos(a), 0.0, -sin(a), 0.0, 1.0, 0.0, sin(a), 0.0, cos(a));
  mat3 tilt = mat3(1.0, 0.0, 0.0, 0.0, 0.94, 0.34, 0.0, -0.34, 0.94);
  vec3 p = tilt * turn * n * 0.62;

  // Domain warp: slow, broad noise bending the coordinates of the colour
  // noise, so the fields fold into each other instead of sliding past.
  vec3 q = vec3(
    snoise(p * 0.9 + vec3(0.0, t * 0.13, 0.0)),
    snoise(p * 0.9 + vec3(5.2, -t * 0.11, 1.3)),
    snoise(p * 0.9 + vec3(-3.1, 2.7, t * 0.12))
  );
  vec3 w = p + (0.32 + uVol * 0.38) * q;

  float n1 = snoise(w * 0.85 + vec3(t * 0.045));
  float n2 = snoise(w * 1.35 - vec3(t * 0.05, 0.0, t * 0.03) + 7.1);
  // A fixed composition under the moving noise: the palette's light end
  // gathers upper left, its deep end lower right, the way a lit sphere reads.
  float lean = dot(uv, vec2(-0.62, 0.78));
  float field = 0.5 + 0.36 * n1 + 0.1 * n2 + 0.55 * lean;
  vec3 col = ramp(field);

  // Light from the upper left; the rim falls to the deepest colour.
  vec3 L = normalize(vec3(-0.45, 0.55, 0.72));
  float diff = max(dot(n, L), 0.0);
  col = mix(col, uColors[4], pow(diff, 7.0) * 0.5);
  col = mix(col, uColors[0], smoothstep(0.58, 1.0, rc) * 0.22 * (1.0 - diff));
  col *= 0.94 + 0.08 * diff;

  // Film grain, re-seeded at 24 steps a second like the real thing.
  float g = hash12(gl_FragCoord.xy + floor(t * 24.0) * 37.0) - 0.5;
  col += g * uGrain;

  outColor = vec4(clamp(col, 0.0, 1.0) * mask, mask);
}`;

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(log ?? "shader compile failed");
  }
  return s;
}

export function FluidOrb({
  colors,
  volume,
  running = true,
  still = false,
  grain = 0.075,
  className,
}: {
  /** Five colours, in the mesh orb's slot order. */
  colors: readonly string[];
  /** Read every frame, 0–1. */
  volume?: MutableRefObject<number>;
  running?: boolean;
  still?: boolean;
  grain?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const placeholderRef = useRef<HTMLDivElement>(null);
  const target = useRef<number[]>(colors.flatMap(hexToRgb));
  const state = useRef({ running, still });

  useEffect(() => {
    target.current = colors.flatMap(hexToRgb);
  }, [colors]);

  useEffect(() => {
    state.current = { running, still };
  }, [running, still]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let teardown: (() => void) | undefined;
    let cancelIdle: (() => void) | undefined;
    const near = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        near.disconnect();
        cancelIdle = whenIdle(() => {
          teardown = start(canvas);
        });
      },
      { rootMargin: "25% 0px" },
    );
    near.observe(canvas);
    return () => {
      near.disconnect();
      cancelIdle?.();
      teardown?.();
    };

    function start(canvas: HTMLCanvasElement) {
      const gl = canvas.getContext("webgl2", {
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
      });
      // Without WebGL the CSS orb underneath simply stays.
      if (!gl) {
        canvas.style.display = "none";
        return;
      }

      let program: WebGLProgram;
      try {
        program = gl.createProgram()!;
        gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
        gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("link failed");
      } catch {
        canvas.style.display = "none";
        return;
      }

      gl.useProgram(program);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(program, "aPos");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      const uRes = gl.getUniformLocation(program, "uRes");
      const uTime = gl.getUniformLocation(program, "uTime");
      const uVol = gl.getUniformLocation(program, "uVol");
      const uGrain = gl.getUniformLocation(program, "uGrain");
      const uColors = gl.getUniformLocation(program, "uColors");

      const current = new Float32Array(target.current);
      let flowTime = 7.3;
      let vol = 0;
      let raf = 0;
      let prev = performance.now();
      let visible = true;

      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
        const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        gl.viewport(0, 0, canvas.width, canvas.height);
      };

      const draw = () => {
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform1f(uTime, flowTime);
        gl.uniform1f(uVol, vol);
        gl.uniform1f(uGrain, grain);
        gl.uniform3fv(uColors, current);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      };

      const frame = (now: number) => {
        const dt = Math.min((now - prev) / 1000, 0.05);
        prev = now;
        const { running: on, still: frozen } = state.current;

        // Palette changes ease in over roughly half a second.
        const k = 1 - Math.exp(-dt * 7);
        const goal = target.current;
        for (let i = 0; i < current.length; i++) current[i] += (goal[i] - current[i]) * k;

        const want = Math.max(0, Math.min(1, volume?.current ?? 0));
        vol += (want - vol) * (1 - Math.exp(-dt * (want > vol ? 14 : 5)));

        if (on && !frozen) flowTime += dt * (0.55 + vol * 1.6);
        if (visible) draw();
        raf = requestAnimationFrame(frame);
      };

      const ro = new ResizeObserver(() => {
        resize();
        draw();
      });
      ro.observe(canvas);
      const io = new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
      });
      io.observe(canvas);

      resize();
      draw();
      // The shader has painted: the CSS stand-in can go.
      if (placeholderRef.current) placeholderRef.current.style.opacity = "0";
      raf = requestAnimationFrame(frame);

      return () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        io.disconnect();
        gl.deleteBuffer(buf);
        gl.deleteProgram(program);
      };
    }
    // The loop reads colours, volume and flags from refs; it is built once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={cn("relative", className)}>
      <div ref={placeholderRef} aria-hidden className="absolute inset-0 transition-opacity duration-500">
        <Orb mesh={colors} className="size-full" />
      </div>
      <canvas ref={canvasRef} aria-hidden className="absolute inset-0 size-full" />
    </div>
  );
}
