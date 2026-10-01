/**
 * The FluidOrb renderer, shared by <Orb> (one orb, a canvas of its own) and
 * <OrbGroup> (up to four orbs in ONE WebGL2 context).
 *
 * ORB_FRAG is the website's FluidOrb fragment shader
 * (components/site/product/fluid-orb.tsx), verbatim but for two uniforms
 * that are identity for a single orb:
 *   uOrigin  the orb's box corner in canvas pixels (0 on its own canvas), so
 *            several orbs can share a canvas at sub-pixel positions
 *   uAlpha   the orb's opacity, premultiplied (1 on its own canvas)
 * The output is premultiplied alpha; orbs are composited with
 * ONE / ONE_MINUS_SRC_ALPHA, so overlapping or touching orbs blend without
 * dark fringes.
 *
 * No motion blur: the film renders at 120 fps and a moving orb reads crisply
 * (the old `smear` pass is gone; the field is accepted and ignored).
 *
 * Third-party shader code kept with its notices, as on the site:
 * 3D simplex noise from webgl-noise (Copyright (C) 2011 Ashima Arts, Stefan
 * Gustavson, MIT) and "Hash without Sine" (Copyright (c) 2014 David Hoskins,
 * MIT) — see ORB_FRAG.
 */
import type { Palette } from '../theme';
import { hexToRgb, mixPalette } from '../lib/lights';

export const ORB_VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

export const ORB_FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform vec2 uOrigin;
uniform float uTime;
uniform float uVol;
uniform float uGrain;
uniform float uAlpha;
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
  vec2 px = gl_FragCoord.xy - uOrigin;
  vec2 uv = (px / uRes) * 2.0 - 1.0;
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
  float g = hash12(px + floor(t * 24.0) * 37.0) - 0.5;
  col += g * uGrain;

  outColor = vec4(clamp(col, 0.0, 1.0) * mask, mask) * uAlpha;
}`;

/** One orb for the renderer, in canvas CSS pixels (y down). */
export type OrbDraw = {
  /** Centre. */
  x: number;
  y: number;
  /** Diameter. */
  d: number;
  palette: Palette;
  paletteB?: Palette;
  mixB?: number;
  volume: number;
  /** Flow time in seconds (flowTime). */
  time: number;
  grain?: number;
  opacity?: number;
  /** @deprecated ignored — no simulated motion blur (the film renders at 120 fps). */
  smear?: readonly [number, number];
};

/** The 15 floats of a (mixed) palette for uColors. */
export function paletteUniform(palette: Palette, paletteB?: Palette, mixB = 0): Float32Array {
  const pal = paletteB && mixB > 0 ? mixPalette(palette, paletteB, mixB) : palette;
  const out = new Float32Array(15);
  for (let i = 0; i < 5; i++) {
    const [r, g, b] = hexToRgb(pal[Math.min(i, pal.length - 1)]);
    out[i * 3] = r;
    out[i * 3 + 1] = g;
    out[i * 3 + 2] = b;
  }
  return out;
}

function compile(gl: WebGL2RenderingContext, frag: string): WebGLProgram | null {
  const program = gl.createProgram();
  if (!program) return null;
  for (const [type, src] of [
    [gl.VERTEX_SHADER, ORB_VERT],
    [gl.FRAGMENT_SHADER, frag],
  ] as const) {
    const s = gl.createShader(type);
    if (!s) return null;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('Orb shader:', gl.getShaderInfoLog(s));
      return null;
    }
    gl.attachShader(program, s);
  }
  gl.bindAttribLocation(program, 0, 'aPos');
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Orb program:', gl.getProgramInfoLog(program));
    return null;
  }
  return program;
}

const uniforms = <K extends string>(gl: WebGL2RenderingContext, p: WebGLProgram, names: readonly K[]) =>
  Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(p, n)])) as Record<K, WebGLUniformLocation | null>;

const ORB_U = ['uRes', 'uOrigin', 'uTime', 'uVol', 'uGrain', 'uAlpha', 'uColors'] as const;

/**
 * One WebGL2 context on one canvas, drawing any number of orbs per frame.
 * The caller sets canvas.width / height (the backing store); `render` maps
 * CSS pixels onto it with the given scale.
 */
export class OrbRenderer {
  private constructor(
    readonly gl: WebGL2RenderingContext,
    private readonly orb: { p: WebGLProgram; u: Record<(typeof ORB_U)[number], WebGLUniformLocation | null> },
  ) {}

  static create(canvas: HTMLCanvasElement): OrbRenderer | null {
    const gl = canvas.getContext('webgl2', {
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
      antialias: false,
      alpha: true,
    });
    if (!gl || gl.isContextLost()) return null;
    const p = compile(gl, ORB_FRAG);
    if (!p) return null;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    // one triangle over the whole viewport; the scissor box picks each orb's pixels
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    return new OrbRenderer(gl, { p, u: uniforms(gl, p, ORB_U) });
  }

  /**
   * Clear the canvas and draw `orbs` back to front.
   * `sx`/`sy`: backing-store pixels per CSS pixel. `grain`: default film grain.
   */
  render(orbs: readonly OrbDraw[], sx: number, sy: number, grain = 0.075) {
    const gl = this.gl;
    const W = gl.drawingBufferWidth;
    const H = gl.drawingBufferHeight;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.SCISSOR_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const box = (x0: number, y0: number, x1: number, y1: number) => {
      const a = Math.max(0, Math.floor(x0));
      const b = Math.max(0, Math.floor(y0));
      const c = Math.min(W, Math.ceil(x1));
      const d = Math.min(H, Math.ceil(y1));
      return c > a && d > b ? ([a, b, c - a, d - b] as const) : null;
    };

    for (const o of orbs) {
      const alpha = Math.max(0, Math.min(1, o.opacity ?? 1));
      if (alpha <= 0 || !(o.d > 0)) continue;
      const res = o.d * sx; // diameter in device px
      const ox = (o.x - o.d / 2) * sx; // box corner, GL coords (y up)
      const oy = H - (o.y + o.d / 2) * sy;
      const orbBox = box(ox - 1, oy - 1, ox + res + 1, oy + res + 1);
      if (!orbBox) continue;
      const u = this.orb.u;
      gl.scissor(...orbBox);
      gl.useProgram(this.orb.p);
      gl.uniform2f(u.uRes, res, res);
      gl.uniform2f(u.uOrigin, ox, oy);
      gl.uniform1f(u.uTime, o.time);
      gl.uniform1f(u.uVol, o.volume);
      gl.uniform1f(u.uGrain, o.grain ?? grain);
      gl.uniform1f(u.uAlpha, alpha);
      gl.uniform3fv(u.uColors, paletteUniform(o.palette, o.paletteB, o.mixB ?? 0));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.disable(gl.SCISSOR_TEST);
  }
}
