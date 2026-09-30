/**
 * Ava's orb — the website's FluidOrb fragment shader, ported verbatim
 * (components/site/product/fluid-orb.tsx) and made frame-deterministic:
 * instead of a requestAnimationFrame clock, the parent passes the flow time
 * (see `flowTime`) and the volume for the current frame.
 *
 * Third-party shader code kept with its notices, as on the site:
 * 3D simplex noise from webgl-noise (Copyright (C) 2011 Ashima Arts, Stefan
 * Gustavson, MIT) and "Hash without Sine" (Copyright (c) 2014 David Hoskins,
 * MIT).
 *
 * One WebGL2 context per instance — use it for the big orb only; use
 * <MeshOrb> (CSS) for small dots.
 */
import React, { useLayoutEffect, useRef } from 'react';
import { FPS } from '../timing';
import { MeshOrb } from './MeshOrb';

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

  float t = uTime;
  float a = t * 0.09;
  mat3 turn = mat3(cos(a), 0.0, -sin(a), 0.0, 1.0, 0.0, sin(a), 0.0, cos(a));
  mat3 tilt = mat3(1.0, 0.0, 0.0, 0.0, 0.94, 0.34, 0.0, -0.34, 0.94);
  vec3 p = tilt * turn * n * 0.62;

  vec3 q = vec3(
    snoise(p * 0.9 + vec3(0.0, t * 0.13, 0.0)),
    snoise(p * 0.9 + vec3(5.2, -t * 0.11, 1.3)),
    snoise(p * 0.9 + vec3(-3.1, 2.7, t * 0.12))
  );
  vec3 w = p + (0.32 + uVol * 0.38) * q;

  float n1 = snoise(w * 0.85 + vec3(t * 0.045));
  float n2 = snoise(w * 1.35 - vec3(t * 0.05, 0.0, t * 0.03) + 7.1);
  float lean = dot(uv, vec2(-0.62, 0.78));
  float field = 0.5 + 0.36 * n1 + 0.1 * n2 + 0.55 * lean;
  vec3 col = ramp(field);

  vec3 L = normalize(vec3(-0.45, 0.55, 0.72));
  float diff = max(dot(n, L), 0.0);
  col = mix(col, uColors[4], pow(diff, 7.0) * 0.5);
  col = mix(col, uColors[0], smoothstep(0.58, 1.0, rc) * 0.22 * (1.0 - diff));
  col *= 0.94 + 0.08 * diff;

  float g = hash12(gl_FragCoord.xy + floor(t * 24.0) * 37.0) - 0.5;
  col += g * uGrain;

  outColor = vec4(clamp(col, 0.0, 1.0) * mask, mask);
}`;

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

type GLState = {
  gl: WebGL2RenderingContext;
  u: Record<'res' | 'time' | 'vol' | 'grain' | 'colors', WebGLUniformLocation | null>;
};

function init(canvas: HTMLCanvasElement): GLState | null {
  const gl = canvas.getContext('webgl2', {
    premultipliedAlpha: true,
    preserveDrawingBuffer: true,
    antialias: false,
    alpha: true,
  });
  if (!gl) return null;
  const program = gl.createProgram()!;
  for (const [type, src] of [
    [gl.VERTEX_SHADER, VERT],
    [gl.FRAGMENT_SHADER, FRAG],
  ] as const) {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('Orb shader:', gl.getShaderInfoLog(s));
      return null;
    }
    gl.attachShader(program, s);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  return {
    gl,
    u: {
      res: gl.getUniformLocation(program, 'uRes'),
      time: gl.getUniformLocation(program, 'uTime'),
      vol: gl.getUniformLocation(program, 'uVol'),
      grain: gl.getUniformLocation(program, 'uGrain'),
      colors: gl.getUniformLocation(program, 'uColors'),
    },
  };
}

/**
 * The site integrates `flowTime += dt * (0.55 + vol * 1.6)` every frame,
 * starting at 7.3. Deterministic version: integrate the volume curve from
 * frame 0 to `frame`.
 */
export function flowTime(frame: number, volumeAt: (f: number) => number): number {
  let t = 7.3;
  const dt = 1 / FPS;
  for (let f = 0; f < frame; f++) t += dt * (0.55 + volumeAt(f) * 1.6);
  return t;
}

/** Mix two 5-colour palettes (t: 0 → a, 1 → b). */
function mixPalette(a: readonly string[], b: readonly string[] | undefined, t: number) {
  const out: number[] = [];
  for (let i = 0; i < 5; i++) {
    const ca = hexToRgb(a[i]);
    const cb = b ? hexToRgb(b[i]) : ca;
    for (let k = 0; k < 3; k++) out.push(ca[k] + (cb[k] - ca[k]) * t);
  }
  return new Float32Array(out);
}

export const Orb: React.FC<{
  size: number;
  palette: readonly string[];
  /** Optional second palette to ease towards (the site's 'listen' switch). */
  paletteB?: readonly string[];
  mixB?: number;
  volume: number;
  /** Flow time in seconds — use flowTime(frame, volumeAt). */
  time: number;
  grain?: number;
  /** Supersampling for crisp edges on the big orb. */
  resolution?: number;
  style?: React.CSSProperties;
}> = ({ size, palette, paletteB, mixB = 0, volume, time, grain = 0.075, resolution = 1.5, style }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const state = useRef<GLState | null | undefined>(undefined);
  const px = Math.max(2, Math.round(size * resolution));

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (state.current === undefined) state.current = init(canvas);
    const s = state.current;
    if (!s) return;
    const { gl, u } = s;
    gl.viewport(0, 0, px, px);
    gl.uniform2f(u.res, px, px);
    gl.uniform1f(u.time, time);
    gl.uniform1f(u.vol, volume);
    gl.uniform1f(u.grain, grain);
    gl.uniform3fv(u.colors, mixPalette(palette, paletteB, mixB));
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }, [px, time, volume, grain, palette, paletteB, mixB]);

  return (
    <div style={{ position: 'relative', width: size, height: size, ...style }}>
      {/* CSS stand-in under the canvas — shows only if WebGL2 is unavailable. */}
      <MeshOrb size={size} palette={palette} time={time} style={{ position: 'absolute', inset: 0 }} />
      <canvas
        ref={ref}
        width={px}
        height={px}
        style={{ position: 'absolute', inset: 0, width: size, height: size, borderRadius: '50%' }}
      />
    </div>
  );
};
