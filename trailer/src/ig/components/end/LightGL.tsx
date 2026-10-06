/**
 * <IgLightGL> — the end card's ONE WebGL2 context: the teal emitter and the backlight. A FORK of film 2's
 * src/kb/scenes/cta/LightGL.tsx @ 743247a (itself HeroGL without the portrait) for the forked shader (./lightShader.ts:
 * the backlight's stops as uniforms, and a tint composite for the pearl grounds). Otherwise verbatim: a transparent,
 * premultiplied canvas over the ground; the backing store is CSS size × quality × devicePixelRatio; every uniform is a
 * pure function of the frame, passed in by the scene; the context is created in a layout effect and drawn in the next
 * one of the same commit (nothing loads, no frame is held) and handed back on unmount.
 */
import React, { useLayoutEffect, useRef } from 'react';
import { cancelRender } from 'remotion';
import { IG_LIGHT_FRAG, IG_LIGHT_VERT } from './lightShader';

export type Glow = { x: number; y: number; r: number; s: number; color: [number, number, number] };
export type Core = { x: number; y: number; r: number; s: number; color: [number, number, number] };
type RGB = [number, number, number];

export type IgLightUniforms = {
  haloC: [number, number];
  haloR: [number, number, number];
  haloGain: number;
  merge: [number, number, number, number];
  floor: [number, number, number, number];
  glows: Glow[];
  cores: Core[];
  rim: [number, number, number, number];
  rimColors: RGB[];
  wide: [number, number];
  seed: number;
  /** the backlight's colours: core, high, mid, edge (0..1 rgb) */
  stops: [RGB, RGB, RGB, RGB];
  /** 0: light added on a dark ground · 1: laid over a light ground */
  tint: number;
};

type GL = { gl: WebGL2RenderingContext; prog: WebGLProgram; vao: WebGLVertexArrayObject; u: Record<string, WebGLUniformLocation | null> };

const NAMES = ['uRes', 'uHaloC', 'uHaloR', 'uHaloGain', 'uMerge', 'uFloor', 'uSeed', 'uGlowP', 'uGlowC', 'uCoreP', 'uCoreC', 'uRim', 'uRimC', 'uWide', 'uStops', 'uTint'];

const dpr = () => (typeof window !== 'undefined' && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1);

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(`[ig end light] ${gl.getShaderInfoLog(sh)}`);
  return sh;
}

const NO_GLOW: Glow = { x: 0, y: 0, r: 1, s: 0, color: [0, 0, 0] };

export const IgLightGL: React.FC<{ width: number; height: number; quality?: number; u: IgLightUniforms }> = ({ width, height, quality = 1, u }) => {
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
      cancelRender(new Error('[ig end light] WebGL2 unavailable'));
      return;
    }
    try {
      const prog = gl.createProgram()!;
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, IG_LIGHT_VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, IG_LIGHT_FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`[ig end light] ${gl.getProgramInfoLog(prog)}`);
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
    for (let i = 0; i < 4; i++) {
      const g = u.glows[i] ?? NO_GLOW;
      gp.set([g.x * q, g.y * q, Math.max(1, g.r * q), g.s], i * 4);
      gc.set(g.color, i * 3);
    }
    gl.uniform4fv(L.uGlowP, gp);
    gl.uniform3fv(L.uGlowC, gc);
    const cp = new Float32Array(16);
    const cc = new Float32Array(12);
    for (let i = 0; i < 4; i++) {
      const c = u.cores[i] ?? NO_GLOW;
      cp.set([c.x * q, c.y * q, Math.max(0.25, c.r * q), c.s], i * 4);
      cc.set(c.color, i * 3);
    }
    gl.uniform4fv(L.uCoreP, cp);
    gl.uniform3fv(L.uCoreC, cc);
    gl.uniform4f(L.uRim, u.rim[0], u.rim[1], u.rim[2], u.rim[3]);
    const rc = new Float32Array(12);
    u.rimColors.slice(0, 4).forEach((c, i) => rc.set(c, i * 3));
    gl.uniform3fv(L.uRimC, rc);
    gl.uniform2f(L.uWide, u.wide[0], u.wide[1]);
    const st = new Float32Array(12);
    u.stops.forEach((c, i) => st.set(c, i * 3));
    gl.uniform3fv(L.uStops, st);
    gl.uniform1f(L.uTint, u.tint);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
  });

  return <div ref={ref} style={{ position: 'absolute', left: 0, top: 0, width, height, pointerEvents: 'none' }} />;
};
