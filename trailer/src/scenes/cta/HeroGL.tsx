/**
 * The hero portrait + halo, one WebGL2 context (see heroShader.ts).
 * Textures load inside a delayRender; every uniform is a pure function of
 * the frame, passed in by the scene.
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cancelRender, continueRender, delayRender, staticFile } from 'remotion';
import { HERO_FRAG, HERO_VERT } from './heroShader';

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
  /** underside superellipse power, low-frequency rim wobble, falloff grain */
  haloShape: [number, number, number];
  /** base zoom, screen y of the eyes (0..1), art glitch-band edge v (0 = none) */
  frame: [number, number, number];
  seed: number;
};

type GL = {
  gl: WebGL2RenderingContext;
  u: Record<string, WebGLUniformLocation | null>;
  imgRes: [number, number];
};

const NAMES = [
  'uImage', 'uDepth', 'uRes', 'uImgRes', 'uMouse', 'uAmp', 'uZoom', 'uPan', 'uTime', 'uWarp',
  'uTear', 'uLiquid', 'uErase', 'uReveal', 'uEyes', 'uAxisX', 'uEye', 'uSubject', 'uBrand',
  'uHaloC', 'uHaloR', 'uHaloGain', 'uFloor', 'uHaloShape', 'uFrame', 'uSeed',
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
  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
}

export const HeroGL: React.FC<{
  art: HeroArt;
  width: number;
  height: number;
  /** canvas px per frame px */
  quality?: number;
  octaves?: number;
  u: HeroUniforms;
  style?: React.CSSProperties;
}> = ({ art, width, height, quality = 1, octaves = 6, u, style }) => {
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
      gl.bindVertexArray(gl.createVertexArray());
      const uniforms: GL['u'] = {};
      for (const n of NAMES) uniforms[n] = gl.getUniformLocation(prog, n);
      Promise.all([loadImage(staticFile(art.src)), loadImage(staticFile(art.depth))])
        .then(([img, dep]) => {
          if (disposed) return;
          texture(gl, 0, img);
          texture(gl, 1, dep);
          gl.uniform1i(uniforms.uImage, 0);
          gl.uniform1i(uniforms.uDepth, 1);
          state.current = { gl, u: uniforms, imgRes: [img.naturalWidth, img.naturalHeight] };
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
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
    if (!released.current) {
      released.current = true;
      continueRender(handle);
    }
  });

  return <div ref={ref} style={{ position: 'absolute', left: 0, top: 0, width, height, ...style }} />;
};
