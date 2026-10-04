/**
 * <LightGL> — the close's ONE WebGL2 context (SCRIPT.md b17: "the scene's single WebGL context"): the four lights
 * and the backlight. A FORK of film 1's src/scenes/cta/HeroGL.tsx with the portrait pass removed (film 2 shows no
 * faces: no art textures to load) and a transparent, premultiplied canvas, so it lies over the mesh ground
 * (lightShader.ts says how it composites). The four lights are EMITTERS drawn in the one pass (a white-hot core in a
 * tight bloom of its own colour): no orb bodies, no surface, no offscreen layer.
 *
 * The backing store is CSS size × quality × devicePixelRatio, so the 4K master (--scale 2) draws every pixel.
 * Every uniform is a pure function of the (fractional) frame, passed in by the scene. The context
 * is created in a layout effect and drawn in the next one of the same commit — nothing loads, so no frame is
 * held — and it is handed back on unmount (scrubbing must not pile up contexts).
 */
import React, { useLayoutEffect, useRef } from 'react';
import { cancelRender } from 'remotion';
import { LIGHT_FRAG, LIGHT_VERT } from './lightShader';

export type Glow = { x: number; y: number; r: number; s: number; color: [number, number, number] };
/** a light's core: centre (frame px), radius (px), intensity (0..1), and the hue its white is tinted by */
export type Core = { x: number; y: number; r: number; s: number; color: [number, number, number] };

export type LightUniforms = {
  /** the backlight: centre (frame px), radii rx / ry above / ry below (px), gain */
  haloC: [number, number];
  haloR: [number, number, number];
  haloGain: number;
  /** body gain, rim peak (≤ .75), rim spill past the edge, core lift */
  merge: [number, number, number, number];
  /** floor start y (frame px), length (px), strength, rise at ±rx (px) */
  floor: [number, number, number, number];
  /** the four bloom slots (slot k = light k, always) */
  glows: Glow[];
  /** the four cores (slot k = light k) */
  cores: Core[];
  /** rim strength (0..1), -, -, angular half-width (rad) */
  rim: [number, number, number, number];
  /** rim colours: top-left, top-right, bottom-right, bottom-left (0..1 rgb) */
  rimColors: [number, number, number][];
  /** each light's pool on the ground: radius (× its bloom radius), strength (× its bloom's) */
  wide: [number, number];
  seed: number;
};

type GL = { gl: WebGL2RenderingContext; prog: WebGLProgram; vao: WebGLVertexArrayObject; u: Record<string, WebGLUniformLocation | null> };

const NAMES = ['uRes', 'uHaloC', 'uHaloR', 'uHaloGain', 'uMerge', 'uFloor', 'uSeed', 'uGlowP', 'uGlowC', 'uCoreP', 'uCoreC', 'uRim', 'uRimC', 'uWide'];

const dpr = () => (typeof window !== 'undefined' && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1);

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(`[kb cta lights] ${gl.getShaderInfoLog(sh)}`);
  return sh;
}

export const LightGL: React.FC<{
  width: number;
  height: number;
  /** canvas px per frame CSS px, before the device-pixel ratio */
  quality?: number;
  u: LightUniforms;
}> = ({ width, height, quality = 1, u }) => {
  const ref = useRef<HTMLDivElement>(null);
  const state = useRef<GL | null>(null);
  const q = quality * dpr();
  const cw = Math.round(width * q);
  const ch = Math.round(height * q);

  useLayoutEffect(() => {
    const host = ref.current;
    if (!host) return;
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    Object.assign(canvas.style, { position: 'absolute', left: '0px', top: '0px', width: '100%', height: '100%' });
    host.appendChild(canvas);
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true });
    if (!gl) {
      cancelRender(new Error('[kb cta lights] WebGL2 unavailable'));
      return;
    }
    try {
      const prog = gl.createProgram()!;
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, LIGHT_VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, LIGHT_FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`[kb cta lights] ${gl.getProgramInfoLog(prog)}`);
      const uniforms: GL['u'] = {};
      for (const n of NAMES) uniforms[n] = gl.getUniformLocation(prog, n);
      state.current = { gl, prog, vao: gl.createVertexArray()!, u: uniforms };
    } catch (e) {
      cancelRender(e as Error);
    }
    return () => {
      state.current = null;
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      canvas.remove();
    };
    // the canvas size is fixed per composition
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    const s = state.current;
    if (!s) return;
    const { gl, u: L } = s;
    if (gl.canvas.width !== cw || gl.canvas.height !== ch) {
      gl.canvas.width = cw;
      gl.canvas.height = ch;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(s.prog);
    gl.bindVertexArray(s.vao);
    gl.disable(gl.BLEND);
    gl.disable(gl.SCISSOR_TEST);
    gl.viewport(0, 0, cw, ch);
    gl.uniform2f(L.uRes, cw, ch);
    gl.uniform2f(L.uHaloC, u.haloC[0] * q, u.haloC[1] * q);
    gl.uniform3f(L.uHaloR, u.haloR[0] * q, u.haloR[1] * q, u.haloR[2] * q);
    gl.uniform1f(L.uHaloGain, u.haloGain);
    gl.uniform4f(L.uMerge, u.merge[0], u.merge[1], u.merge[2], u.merge[3]);
    gl.uniform4f(L.uFloor, u.floor[0] * q, u.floor[1] * q, u.floor[2], u.floor[3] * q);
    gl.uniform1f(L.uSeed, u.seed);
    const gp = new Float32Array(16);
    const gc = new Float32Array(12);
    u.glows.slice(0, 4).forEach((g, i) => {
      gp.set([g.x * q, g.y * q, Math.max(1, g.r * q), g.s], i * 4);
      gc.set(g.color, i * 3);
    });
    gl.uniform4fv(L.uGlowP, gp);
    gl.uniform3fv(L.uGlowC, gc);
    const cp = new Float32Array(16);
    const cc = new Float32Array(12);
    u.cores.slice(0, 4).forEach((c, i) => {
      cp.set([c.x * q, c.y * q, Math.max(0.25, c.r * q), c.s], i * 4);
      cc.set(c.color, i * 3);
    });
    gl.uniform4fv(L.uCoreP, cp);
    gl.uniform3fv(L.uCoreC, cc);
    gl.uniform4f(L.uRim, u.rim[0], u.rim[1], u.rim[2], u.rim[3]);
    const rc = new Float32Array(12);
    u.rimColors.slice(0, 4).forEach((c, i) => rc.set(c, i * 3));
    gl.uniform3fv(L.uRimC, rc);
    gl.uniform2f(L.uWide, u.wide[0], u.wide[1]);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
  });

  return <div ref={ref} style={{ position: 'absolute', left: 0, top: 0, width, height, pointerEvents: 'none' }} />;
};
