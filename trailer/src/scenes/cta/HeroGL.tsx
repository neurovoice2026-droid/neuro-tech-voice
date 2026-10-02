/**
 * The hero portrait + its room + the four lights + the merged light: ONE
 * WebGL2 context for the whole CTA (see heroShader.ts, orbPass.ts). Textures
 * load inside a delayRender; every uniform and every orb is a pure function
 * of the (fractional) frame, passed in by the scene. The backing store is
 * CSS size × quality × devicePixelRatio, so the 4K master (--scale 2) draws
 * every pixel; the art itself is the largest source there is (hero-robot.webp
 * 2048 × 1152, hero-robot-portrait.webp 900 × 1600 — both upscaled on screen).
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
  /** 1 = the portrait pass runs; 0 = the merged light only (after the converge) */
  art: number;
  reveal: number;
  eyes: number;
  /** THE ROOM's key (replaces the art's cream backlight): centre (frame px), height over the wall (px), strength */
  wall: [number, number, number, number];
  /** … its colour on the wall (0..1 rgb) */
  wallColor: [number, number, number];
  haloC: [number, number];
  haloR: [number, number, number];
  haloGain: number;
  /** the backlight: body gain, rim peak (≤ .75), rim spill past the edge, core lift */
  merge: [number, number, number, number];
  /** floor under the halo: start y at the axis, length (frame px), strength, rise at ±rx (px) */
  floor: [number, number, number, number];
  /** base zoom, screen y of the eyes (0..1), art glitch-band edge v (0 = none) */
  frame: [number, number, number];
  seed: number;
  /** how much the figure hides the back orb layer (0..1) */
  occ: number;
  /** the four lights' slots (slot k = light k, always): bloom centre (frame px), bloom radius px,
   *  bloom strength, colour, how far behind the figure (0..1), and its key on her face (spill) */
  glows: { x: number; y: number; r: number; s: number; color: [number, number, number]; back: number; spill: number; spillColor: [number, number, number] }[];
  /** the key: its reach (frame px), gain */
  spill: [number, number];
  /** her matte: centre drop below the eyes, radii x / y (eye offsets), feather (frame px) */
  vig: [number, number, number, number];
  /** her face: de-stipple radius (art px), de-stipple amount, shadow lift, her purple calmed (0..1) */
  face: [number, number, number, number];
  /** the wall falls dark toward her silhouette over this much of the head matte (0 = off) */
  wallNear: number;
  /** the eyes' voice light (0..1) */
  eyeGlow: number;
  /** the four lights on the corona (its colour at each diagonal): strength 0..1, (unused), (unused), angular half-width (rad) */
  rim: [number, number, number, number];
  /** arc colours: top-left, top-right, bottom-right, bottom-left */
  rimColors: [number, number, number][];
  /** how much of each orb's bloom also lies over its own body (halation) */
  glowOver: number;
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
  'uImage', 'uDepth', 'uRes', 'uImgRes', 'uPxScale', 'uMouse', 'uAmp', 'uZoom', 'uPan', 'uTime',
  'uArt', 'uReveal', 'uEyes', 'uAxisX', 'uEye', 'uSubject', 'uBrand', 'uWall', 'uWallC',
  'uHaloC', 'uHaloR', 'uHaloGain', 'uMerge', 'uFloor', 'uFrame', 'uSeed',
  'uOrbBack', 'uOrbFront', 'uOrbOn', 'uOcc', 'uGlowP', 'uGlowC', 'uGlowBack', 'uEyeGlow', 'uRim', 'uRimC',
  'uGlowOver', 'uGlowSpill', 'uSpillC', 'uSpill', 'uVig', 'uFace', 'uWallNear',
];

/** The canvas's device-pixel ratio (the 4K masters render at --scale 2): the backing store follows it. */
const dpr = () => (typeof window !== 'undefined' && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1);

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
  /** canvas px per frame CSS px, before the device-pixel ratio */
  quality?: number;
  u: HeroUniforms;
  orbs?: HeroOrbs;
  style?: React.CSSProperties;
}> = ({ art, width, height, quality = 1, u, orbs, style }) => {
  const ref = useRef<HTMLDivElement>(null);
  const state = useRef<GL | null>(null);
  const [handle] = useState(() => delayRender('CTA hero textures'));
  const released = useRef(false);
  const [ready, setReady] = useState(false);
  // the backing store follows the device-pixel ratio (CSS size × quality × dpr): sharp at 4K
  const q = quality * dpr();
  const cw = Math.round(width * q);
  const ch = Math.round(height * q);

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
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, HERO_FRAG));
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
    s.orbs.render([orbs?.back ?? [], orbs?.front ?? []], cw, ch, q, q);
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
    gl.uniform1f(L.uPxScale, q);
    gl.uniform2f(L.uMouse, u.mouse[0], u.mouse[1]);
    gl.uniform1f(L.uAmp, 0.048);
    gl.uniform1f(L.uZoom, u.zoom);
    gl.uniform2f(L.uPan, u.pan[0], u.pan[1]);
    gl.uniform1f(L.uTime, u.time);
    gl.uniform1f(L.uArt, u.art);
    gl.uniform1f(L.uReveal, u.reveal);
    gl.uniform1f(L.uEyes, u.eyes);
    gl.uniform1f(L.uAxisX, art.axis);
    gl.uniform3f(L.uEye, art.eye[0], art.eye[1], art.eye[2]);
    gl.uniform1f(L.uSubject, art.subject);
    gl.uniform3f(L.uBrand, 0x55 / 255, 0x1a / 255, 0x89 / 255);
    gl.uniform4f(L.uWall, u.wall[0] * q, u.wall[1] * q, u.wall[2] * q, u.wall[3]);
    gl.uniform3f(L.uWallC, u.wallColor[0], u.wallColor[1], u.wallColor[2]);
    gl.uniform2f(L.uHaloC, u.haloC[0] * q, u.haloC[1] * q);
    gl.uniform3f(L.uHaloR, u.haloR[0] * q, u.haloR[1] * q, u.haloR[2] * q);
    gl.uniform1f(L.uHaloGain, u.haloGain);
    gl.uniform4f(L.uMerge, u.merge[0], u.merge[1], u.merge[2], u.merge[3]);
    gl.uniform4f(L.uFloor, u.floor[0] * q, u.floor[1] * q, u.floor[2], u.floor[3] * q);
    gl.uniform3f(L.uFrame, u.frame[0], u.frame[1], u.frame[2]);
    gl.uniform1f(L.uSeed, u.seed);
    gl.uniform1f(L.uOrbOn, s.orbs.on ? 1 : 0);
    gl.uniform1f(L.uOcc, u.occ);
    const gp = new Float32Array(16);
    const gc = new Float32Array(12);
    const gb = new Float32Array(4);
    const gsp = new Float32Array(4);
    const gsc = new Float32Array(12);
    u.glows.slice(0, 4).forEach((g, i) => {
      gsc.set(g.spillColor, i * 3);
      gp.set([g.x * q, g.y * q, Math.max(1, g.r * q), g.s], i * 4);
      gc.set(g.color, i * 3);
      gb[i] = Math.min(1, Math.max(0, g.back));
      gsp[i] = Math.max(0, g.spill);
    });
    gl.uniform4fv(L.uGlowP, gp);
    gl.uniform3fv(L.uGlowC, gc);
    gl.uniform1fv(L.uGlowBack, gb);
    gl.uniform1fv(L.uGlowSpill, gsp);
    gl.uniform3fv(L.uSpillC, gsc);
    gl.uniform2f(L.uSpill, u.spill[0], u.spill[1]);
    gl.uniform4f(L.uVig, u.vig[0], u.vig[1], u.vig[2], u.vig[3]);
    gl.uniform4f(L.uFace, u.face[0], u.face[1], u.face[2], u.face[3]);
    gl.uniform1f(L.uWallNear, u.wallNear);
    gl.uniform1f(L.uEyeGlow, u.eyeGlow);
    gl.uniform4f(L.uRim, u.rim[0], u.rim[1], u.rim[2], u.rim[3]);
    const rc = new Float32Array(12);
    u.rimColors.slice(0, 4).forEach((c, i) => rc.set(c, i * 3));
    gl.uniform3fv(L.uRimC, rc);
    gl.uniform1f(L.uGlowOver, u.glowOver);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
    if (!released.current) {
      released.current = true;
      continueRender(handle);
    }
  });

  return <div ref={ref} style={{ position: 'absolute', left: 0, top: 0, width, height, ...style }} />;
};
