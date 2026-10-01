/**
 * The hero portrait + halo + the four lights: ONE WebGL2 context for the
 * whole CTA (see heroShader.ts, orbPass.ts). Textures load inside a
 * delayRender; every uniform and every orb is a pure function of the frame,
 * passed in by the scene.
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cancelRender, continueRender, delayRender, staticFile } from 'remotion';
import type { OrbDraw } from '../../components/orbGL';
import { HERO_FRAG, HERO_VERT } from './heroShader';
import { OrbPass } from './orbPass';

export type HeroArt = {
  src: string;
  depth: string;
  axis: number;
  eye: [number, number, number];
  subject: number;
};

/** lib/site.ts COVER_ART — measured on the artwork by the site. */
export const HERO_ART: { landscape: HeroArt; portrait: HeroArt } = {
  landscape: {
    src: 'img/hero-robot.webp',
    depth: 'img/hero-robot-depth.webp',
    axis: 0.5024,
    eye: [0.0513, 0.4063, 0.055],
    subject: 0.2288,
  },
  portrait: {
    src: 'img/hero-robot-portrait.webp',
    depth: 'img/hero-robot-portrait-depth.webp',
    axis: 0.4961,
    eye: [0.1085, 0.406, 0.108],
    subject: 0.2189,
  },
};

export type HeroUniforms = {
  mouse: [number, number];
  zoom: number;
  pan: [number, number];
  time: number;
  tear: number;
  liquid: number;
  erase: number;
  reveal: number;
  eyes: number;
  haloC: [number, number];
  haloR: [number, number, number];
  haloGain: number;
  /** floor under the halo: start y at the axis, length (frame px), strength, rise at ±rx (px) */
  floor: [number, number, number, number];
  /** shape power (2 = round), very-low-frequency edge term (≤ 0.01), core bloom (0.06) */
  haloShape: [number, number, number];
  /** base zoom, screen y of the eyes (0..1), art glitch-band edge v (0 = none) */
  frame: [number, number, number];
  seed: number;
  /** how much the figure hides the back orb layer (0..1) */
  occ: number;
  /** up to four orb blooms: centre (frame px), radius px, strength, colour, behind the figure? */
  glows: { x: number; y: number; r: number; s: number; color: [number, number, number]; back: boolean }[];
  /** the eyes' voice light (0..1) */
  eyeGlow: number;
  /** the four lights' arcs on the halo rim: strength, radius (halo d), radial width, angular half-width (rad) */
  rim: [number, number, number, number];
  /** arc colours: top-left, top-right, bottom-right, bottom-left */
  rimColors: [number, number, number][];
  /** the art's silver backlight gain (1 = as is) */
  backGain: number;
  /** 0 silver backlight → 1 the merged light (lilac-white) */
  tint: number;
  /** how much of each orb's bloom also lies over its own body (halation) */
  glowOver: number;
  /** 0..1: the art's backlight graded toward the night's lilac (the reveal, before the lights) */
  backLilac: number;
  /** art v of the portrait's shoulder line: its backlight feathers out above it (0 = off) */
  plateEdge: number;
  /** 0..1: torn filaments glow in the nearest light's colour; their colour where no light is near */
  tearTint: number;
  tearColor: [number, number, number];
  /** the filaments stay inside the head matte + ~40 px (head-ellipse units; 0 = no cap) */
  headCap: number;
};

/** The four lights in the hero's context: back (hidden by the figure) and front layers. */
export type HeroOrbs = { back: OrbDraw[]; front: OrbDraw[] };

type GL = {
  gl: WebGL2RenderingContext;
  prog: WebGLProgram;
  vao: WebGLVertexArrayObject;
  tex: [WebGLTexture, WebGLTexture];
  orbs: OrbPass;
  u: Record<string, WebGLUniformLocation | null>;
  imgRes: [number, number];
};

const NAMES = [
  'uImage', 'uDepth', 'uRes', 'uImgRes', 'uMouse', 'uAmp', 'uZoom', 'uPan', 'uTime', 'uWarp',
  'uTear', 'uLiquid', 'uErase', 'uReveal', 'uEyes', 'uAxisX', 'uEye', 'uSubject', 'uBrand',
  'uHaloC', 'uHaloR', 'uHaloGain', 'uFloor', 'uHaloShape', 'uFrame', 'uSeed',
  'uOrbBack', 'uOrbFront', 'uOrbOn', 'uOcc', 'uGlowP', 'uGlowC', 'uGlowBack', 'uEyeGlow', 'uRim', 'uRimC',
  'uBackGain', 'uTint', 'uGlowOver', 'uBackLilac', 'uPlateEdge', 'uTearTint', 'uTearC', 'uHeadCap',
];

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(`[cta hero] ${gl.getShaderInfoLog(sh)}`);
  }
  return sh;
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`[cta hero] failed to load ${url}`));
    img.src = url;
  });
}

function texture(gl: WebGL2RenderingContext, unit: number, img: HTMLImageElement) {
  const tex = gl.createTexture()!;
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return tex;
}

export const HeroGL: React.FC<{
  art: HeroArt;
  width: number;
  height: number;
  /** canvas px per frame px */
  quality?: number;
  octaves?: number;
  u: HeroUniforms;
  orbs?: HeroOrbs;
  style?: React.CSSProperties;
}> = ({ art, width, height, quality = 1, octaves = 6, u, orbs, style }) => {
  const ref = useRef<HTMLDivElement>(null);
  const state = useRef<GL | null>(null);
  const [handle] = useState(() => delayRender('CTA hero textures'));
  const released = useRef(false);
  const [ready, setReady] = useState(false);
  const cw = Math.round(width * quality);
  const ch = Math.round(height * quality);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    // the canvas is made here, not in JSX: every mount gets a fresh one, so the
    // context released on unmount is never the one a remount would get back
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    Object.assign(canvas.style, { position: 'absolute', left: '0px', top: '0px', width: '100%', height: '100%' });
    host.appendChild(canvas);
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: true,
      premultipliedAlpha: true,
    });
    if (!gl) {
      cancelRender(new Error('[cta hero] WebGL2 unavailable'));
      return;
    }
    let disposed = false;
    try {
      const prog = gl.createProgram()!;
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, HERO_VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, `${HERO_FRAG.replace('precision highp float;', `precision highp float;\n#define OCTAVES ${octaves}`)}`));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`[cta hero] ${gl.getProgramInfoLog(prog)}`);
      gl.useProgram(prog);
      const vao = gl.createVertexArray()!;
      const uniforms: GL['u'] = {};
      for (const n of NAMES) uniforms[n] = gl.getUniformLocation(prog, n);
      const orbPass = new OrbPass(gl);
      Promise.all([loadImage(staticFile(art.src)), loadImage(staticFile(art.depth))])
        .then(([img, dep]) => {
          if (disposed) return;
          const t0 = texture(gl, 0, img);
          const t1 = texture(gl, 1, dep);
          gl.useProgram(prog);
          gl.uniform1i(uniforms.uImage, 0);
          gl.uniform1i(uniforms.uDepth, 1);
          gl.uniform1i(uniforms.uOrbBack, 2);
          gl.uniform1i(uniforms.uOrbFront, 3);
          state.current = { gl, prog, vao, tex: [t0, t1], orbs: orbPass, u: uniforms, imgRes: [img.naturalWidth, img.naturalHeight] };
          setReady(true);
        })
        .catch((e) => cancelRender(e));
    } catch (e) {
      cancelRender(e as Error);
    }
    return () => {
      disposed = true;
      state.current = null;
      // hand the context back at once: scrubbing across the scene in the
      // Studio must not pile up contexts (Chrome evicts the oldest ~16th,
      // which would be another scene's orb)
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      canvas.remove();
      if (!released.current) {
        released.current = true;
        continueRender(handle);
      }
    };
    // the art is fixed per composition
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    const s = state.current;
    if (!ready || !s) return;
    const { gl, u: L } = s;
    if (gl.canvas.width !== cw || gl.canvas.height !== ch) {
      gl.canvas.width = cw;
      gl.canvas.height = ch;
    }
    // the four lights, into their two layers (the orb pass leaves the default framebuffer bound)
    s.orbs.render([orbs?.back ?? [], orbs?.front ?? []], cw, ch, quality, quality);
    const [lb, lf] = s.orbs.layers(cw, ch);
    gl.useProgram(s.prog);
    gl.bindVertexArray(s.vao);
    gl.disable(gl.BLEND);
    gl.disable(gl.SCISSOR_TEST);
    const bind = (unit: number, tex: WebGLTexture) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
    };
    bind(0, s.tex[0]);
    bind(1, s.tex[1]);
    bind(2, lb);
    bind(3, lf);
    gl.viewport(0, 0, cw, ch);
    gl.uniform2f(L.uRes, cw, ch);
    gl.uniform2f(L.uImgRes, s.imgRes[0], s.imgRes[1]);
    gl.uniform2f(L.uMouse, u.mouse[0], u.mouse[1]);
    gl.uniform1f(L.uAmp, 0.048);
    gl.uniform1f(L.uZoom, u.zoom);
    gl.uniform2f(L.uPan, u.pan[0], u.pan[1]);
    gl.uniform1f(L.uTime, u.time);
    gl.uniform1f(L.uWarp, 1.15);
    gl.uniform1f(L.uTear, u.tear);
    gl.uniform1f(L.uLiquid, u.liquid);
    gl.uniform1f(L.uErase, u.erase);
    gl.uniform1f(L.uReveal, u.reveal);
    gl.uniform1f(L.uEyes, u.eyes);
    gl.uniform1f(L.uAxisX, art.axis);
    gl.uniform3f(L.uEye, art.eye[0], art.eye[1], art.eye[2]);
    gl.uniform1f(L.uSubject, art.subject);
    gl.uniform3f(L.uBrand, 0x55 / 255, 0x1a / 255, 0x89 / 255);
    gl.uniform2f(L.uHaloC, u.haloC[0] * quality, u.haloC[1] * quality);
    gl.uniform3f(L.uHaloR, u.haloR[0] * quality, u.haloR[1] * quality, u.haloR[2] * quality);
    gl.uniform1f(L.uHaloGain, u.haloGain);
    gl.uniform4f(L.uFloor, u.floor[0] * quality, u.floor[1] * quality, u.floor[2], u.floor[3] * quality);
    gl.uniform3f(L.uHaloShape, u.haloShape[0], u.haloShape[1], u.haloShape[2]);
    gl.uniform3f(L.uFrame, u.frame[0], u.frame[1], u.frame[2]);
    gl.uniform1f(L.uSeed, u.seed);
    gl.uniform1f(L.uOrbOn, s.orbs.on ? 1 : 0);
    gl.uniform1f(L.uOcc, u.occ);
    const gp = new Float32Array(16);
    const gc = new Float32Array(12);
    const gb = new Float32Array(4);
    u.glows.slice(0, 4).forEach((g, i) => {
      gp.set([g.x * quality, g.y * quality, Math.max(1, g.r * quality), g.s], i * 4);
      gc.set(g.color, i * 3);
      gb[i] = g.back ? 1 : 0;
    });
    gl.uniform4fv(L.uGlowP, gp);
    gl.uniform3fv(L.uGlowC, gc);
    gl.uniform1fv(L.uGlowBack, gb);
    gl.uniform1f(L.uEyeGlow, u.eyeGlow);
    gl.uniform4f(L.uRim, u.rim[0], u.rim[1], u.rim[2], u.rim[3]);
    const rc = new Float32Array(12);
    u.rimColors.slice(0, 4).forEach((c, i) => rc.set(c, i * 3));
    gl.uniform3fv(L.uRimC, rc);
    gl.uniform1f(L.uBackGain, u.backGain);
    gl.uniform1f(L.uTint, u.tint);
    gl.uniform1f(L.uGlowOver, u.glowOver);
    gl.uniform1f(L.uBackLilac, u.backLilac);
    gl.uniform1f(L.uPlateEdge, u.plateEdge);
    gl.uniform1f(L.uTearTint, u.tearTint);
    gl.uniform3f(L.uTearC, u.tearColor[0], u.tearColor[1], u.tearColor[2]);
    gl.uniform1f(L.uHeadCap, u.headCap);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
    if (!released.current) {
      released.current = true;
      continueRender(handle);
    }
  });

  return <div ref={ref} style={{ position: 'absolute', left: 0, top: 0, width, height, ...style }} />;
};
