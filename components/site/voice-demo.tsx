"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useReducedMotion } from "framer-motion";
import { VOICE_DEMO as C, VOICE_DEMO_SCRIPT as SCRIPT } from "@/lib/site";
import { cn } from "@/lib/utils";
import { EASE } from "./reveal";

/**
 * The pre-recorded call, played back.
 *
 * Two halves that only touch through `OrbApi`. The orb is a self-contained
 * engine — a WebGL plasma sphere with a neural core, plus a 2D layer of
 * particles, synapses, ribbons and an equalizer ring — and it runs on its
 * own rAF outside React entirely, because a 60fps canvas has no business
 * being a render loop. The playback engine is ordinary React state: which
 * line is speaking, how many of its words have landed, which transcript
 * bubbles exist. It tells the orb who is talking and pulses it on every
 * revealed word, and that is the whole contract between them.
 *
 * Colour is the cover's. The source this is ported from ran its own violet
 * and magenta on its own near-black; here every tone comes from the
 * --cover-orb-* ramp, which is the section's pigment hue with the
 * saturation put back — see the derivation in globals.css. The two
 * speakers are told apart the way the cover tells its own two tones apart:
 * the agent is the pigment, the caller is the backlight.
 *
 * Nothing runs when it is not on screen. The source was a standalone page
 * where the orb was always visible; here it sits far down a long document,
 * and an idle rAF burning three fbm calls per pixel is not free.
 */

/* ------------------------------------------------------------------ *
 * Orb
 * ------------------------------------------------------------------ */

type Speaker = "agent" | "client" | null;

type OrbApi = {
  /** Who is talking — drives energy, hue and the speaker-change burst. */
  speak: (who: Speaker) => void;
  /** One revealed word. The orb breathes on the text's rhythm. */
  pulse: () => void;
};

const VERT = `attribute vec2 a; void main(){ gl_Position = vec4(a,0.,1.); }`;

const FRAG = `
precision highp float;
uniform float u_t, u_amp, u_hue;
uniform vec2 u_res;
uniform vec3 u_a, u_b, u_hot, u_a2, u_b2, u_hot2;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1.,0.)), u.x),
             mix(hash(i+vec2(0.,1.)), hash(i+vec2(1.,1.)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for(int i=0;i<5;i++){ v += a*noise(p); p = p*2.03 + vec2(17.3, 9.1); a *= 0.5; }
  return v;
}
mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*u_res) / min(u_res.x, u_res.y);
  float t = u_t;
  float amp = u_amp;
  float r = length(uv);
  vec2 dir = uv / max(r, 1e-4);

  vec3 colA = mix(u_a,   u_a2,   u_hue);
  vec3 colB = mix(u_b,   u_b2,   u_hue);
  vec3 hot  = mix(u_hot, u_hot2, u_hue);

  /* living surface radius (seamless angular noise) */
  float edgeN = fbm(dir*1.9 + vec2(t*0.35, -t*0.28));
  float surf = 0.285 + (edgeN-0.5)*0.05 + amp*0.055 + 0.006*sin(t*1.3);

  /* domain-warped interior plasma, slow global rotation */
  vec2 p = rot(t*0.12*(1.0+amp*1.5)) * uv * 3.2;
  float w1 = fbm(p + vec2(t*0.38, -t*0.24));
  float w2 = fbm(p*1.35 + vec2(w1*1.7) + vec2(-t*0.21, t*0.33));
  float n  = fbm(p*1.1 + vec2(w2*1.5) + vec2(t*0.15));

  float inside = smoothstep(surf, surf-0.20, r);
  vec3 plasma = mix(colA, colB, n) * (0.35 + 1.25*n);
  plasma += hot * smoothstep(0.72, 0.95, n) * (0.5 + amp*1.2);
  plasma *= 0.75 + 0.5*smoothstep(0.25, 0.6, w2);
  /* darken the heart of the sphere — the neural tissue lives there */
  plasma *= 0.35 + 0.65*smoothstep(0.02, surf*0.6, r);

  float nucleus = exp(-r*r/0.0022) * (0.30 + amp*0.25);

  /* ===== neural tissue core =====
     ridged, domain-warped noise -> thin branching dendrite filaments at
     two depths with counter-rotation, and firing shimmer along them */
  float tissue = 0.0;
  float tissueHot = 0.0;
  {
    float coreMask = smoothstep(surf*0.98, surf*0.30, r);
    vec2 q1 = rot(t*0.05) * uv * 5.5;
    vec2 warp = vec2(fbm(q1 + vec2(t*0.11, -t*0.07)), fbm(q1 + vec2(3.7, t*0.09)));
    float f1 = fbm(q1*1.6 + warp*1.9);
    float fil1 = pow(1.0 - abs(2.0*f1 - 1.0), 6.0);
    vec2 q2 = rot(-t*0.04) * uv * 9.5;
    float f2 = fbm(q2 + warp*1.3 + vec2(-t*0.06, t*0.05));
    float fil2 = pow(1.0 - abs(2.0*f2 - 1.0), 9.0);
    float fire1 = pow(0.5 + 0.5*sin(f1*22.0 - t*2.4), 3.0);
    float fire2 = pow(0.5 + 0.5*sin(f2*30.0 - t*3.1 + 1.7), 3.0);
    tissue    = (fil1*(0.50 + 0.50*fire1) + fil2*0.45*(0.35 + 0.65*fire2)) * coreMask;
    tissueHot = (fil1*fire1 + fil2*fire2*0.6) * coreMask;
  }

  float rim = exp(-pow((r - surf)*48.0, 2.0)) * (0.45 + amp*0.5);

  /* corona: angular ray noise decaying outward, breathes with speech */
  float rayN = fbm(dir*3.4 + vec2(t*0.9, t*0.6));
  float rays = pow(max(rayN, 0.0), 3.5)
             * exp(-(r - surf) * (7.5 - amp*3.5))
             * step(surf, r) * (0.30 + amp*1.8);

  float glow = exp(-(r - surf)*4.2) * step(surf, r) * (0.16 + amp*0.30);

  vec3 col = vec3(0.0);
  col += plasma * inside;
  col += mix(colA, colB, tissue) * tissue * (1.05 + amp*1.1);
  col += hot * tissueHot * (0.55 + amp*0.9);
  col += vec3(1.0) * nucleus;
  col += mix(colB, hot, 0.55) * rim;
  col += mix(colB, hot, rayN) * rays;
  col += colA * glow;

  /* circular fade — nothing ever reaches the canvas edge */
  col *= smoothstep(0.50, 0.33, r);

  float a = clamp(max(max(col.r,col.g),col.b), 0.0, 1.0);
  gl_FragColor = vec4(col * a, a);
}`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error("[voice-demo]", gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}

type RGB = [number, number, number];

/** Reads a `#rrggbb` custom property as 0..1 floats. */
function token(css: CSSStyleDeclaration, name: string, fallback: number): RGB {
  const m = css.getPropertyValue(name).trim().match(/^#([0-9a-f]{6})$/i);
  const n = m ? parseInt(m[1], 16) : fallback;
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function Orb({ apiRef }: { apiRef: React.RefObject<OrbApi | null> }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const glCanvas = glRef.current;
    const fxCanvas = fxRef.current;
    if (!wrap || !glCanvas || !fxCanvas) return;

    const fx = fxCanvas.getContext("2d");
    if (!fx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);

    // CSS size, then the same in device pixels. `draw` needs the raw
    // buffer size for u_res, and reading it back off the canvas there
    // costs a null-check the hoisted function cannot see through.
    let W = 0, H = 0, PW = 0, PH = 0, CX = 0, CY = 0, R = 0;

    /* ---------- plasma shader ---------- */
    let gl = glCanvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: true,
    });
    let prog: WebGLProgram | null = null;
    let uT: WebGLUniformLocation | null = null;
    let uAmp: WebGLUniformLocation | null = null;
    let uHue: WebGLUniformLocation | null = null;
    let uRes: WebGLUniformLocation | null = null;

    // Read the ramp off `.cover`, so retoning the palette in one place
    // cannot leave the orb behind on last month's colours.
    const css = getComputedStyle(wrap);
    const A0 = token(css, "--cover-orb-a", 0x7b4fd4);
    const B0 = token(css, "--cover-orb-b", 0xb98ae8);
    const H0 = token(css, "--cover-orb-hot", 0xede4fb);
    const A1 = token(css, "--cover-orb-alt-a", 0x5d6480);
    const B1 = token(css, "--cover-orb-alt-b", 0x9aa4bd);
    const H1 = token(css, "--cover-orb-alt-hot", 0xe2e8f2);

    if (gl) {
      const vs = compile(gl, gl.VERTEX_SHADER, VERT);
      const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
      prog = vs && fs ? gl.createProgram() : null;
      if (gl && vs && fs && prog) {
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
          console.error("[voice-demo]", gl.getProgramInfoLog(prog));
          gl = null;
        } else {
          gl.useProgram(prog);
          const buf = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, buf);
          gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([-1, -1, 3, -1, -1, 3]),
            gl.STATIC_DRAW,
          );
          const loc = gl.getAttribLocation(prog, "a");
          gl.enableVertexAttribArray(loc);
          gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
          uT = gl.getUniformLocation(prog, "u_t");
          uAmp = gl.getUniformLocation(prog, "u_amp");
          uHue = gl.getUniformLocation(prog, "u_hue");
          uRes = gl.getUniformLocation(prog, "u_res");
          const set3 = (n: string, v: RGB) =>
            gl!.uniform3f(gl!.getUniformLocation(prog!, n), v[0], v[1], v[2]);
          set3("u_a", A0); set3("u_b", B0); set3("u_hot", H0);
          set3("u_a2", A1); set3("u_b2", B1); set3("u_hot2", H1);
          gl.enable(gl.BLEND);
          gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
          gl.clearColor(0, 0, 0, 0);
        }
      } else {
        gl = null;
      }
    }

    const resize = () => {
      const rect = fxCanvas.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      if (!W || !H) return;
      PW = Math.round(W * DPR);
      PH = Math.round(H * DPR);
      for (const c of [glCanvas, fxCanvas]) {
        c.width = PW;
        c.height = PH;
      }
      fx.setTransform(DPR, 0, 0, DPR, 0, 0);
      CX = W / 2;
      CY = H / 2;
      R = Math.min(W, H) * 0.27;
      if (gl) gl.viewport(0, 0, PW, PH);
    };

    /* ---------- state ---------- */
    let energy = 0, targetEnergy = 0;
    let hueMix = 0, targetHue = 0;
    let env = 0, prevEnv = 0;
    let ampS = 0, pulse = 0;
    let lastSpeaker: Speaker = null;

    apiRef.current = {
      speak(who) {
        if (who === "agent") { targetEnergy = 1; targetHue = 0; }
        else if (who === "client") { targetEnergy = 0.8; targetHue = 1; }
        else { targetEnergy = 0; }
      },
      pulse() {
        pulse = Math.min(pulse + 0.45, 1);
      },
    };

    /* ---------- 2D layer ---------- */
    const SPHERE_N = reduce ? 100 : 300;
    const sphere: { x: number; y: number; z: number; tw: number; sz: number }[] = [];
    {
      const GA = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < SPHERE_N; i++) {
        const y = 1 - (i / (SPHERE_N - 1)) * 2;
        const rad = Math.sqrt(1 - y * y);
        const th = GA * i;
        sphere.push({
          x: Math.cos(th) * rad, y, z: Math.sin(th) * rad,
          tw: Math.random() * Math.PI * 2, sz: 0.6 + Math.random() * 1.4,
        });
      }
    }
    let rotY = 0, rotX = 0.35;

    const DUST = Array.from({ length: 80 }, () => ({
      a: Math.random() * Math.PI * 2,
      r: 1.42 + Math.random() * 0.28,
      s: (0.0004 + Math.random() * 0.0016) * (Math.random() < 0.5 ? 1 : -1),
      sz: 0.5 + Math.random() * 1.6,
      o: 0.1 + Math.random() * 0.4,
      w: Math.random() * Math.PI * 2,
    }));

    type Shock = { r: number; a: number; w: number };
    type Spark = { x: number; y: number; vx: number; vy: number; a: number; sz: number };
    type Comet = { a: number; r: number; s: number; life: number; trail: { x: number; y: number }[] };
    const shockwaves: Shock[] = [];
    const sparks: Spark[] = [];
    const comets: Comet[] = [];

    const ribbons = Array.from({ length: 3 }, (_, i) => ({
      tilt: 0.26 + i * 0.05,
      phase: i * ((Math.PI * 2) / 3),
      speed: (0.1 + i * 0.045) * (i % 2 ? 1 : -1),
      head: Math.random() * Math.PI * 2,
      headSpeed: 0.012 + i * 0.006,
    }));

    const NEURONS = Array.from({ length: 16 }, () => {
      const nd = 4 + ((Math.random() * 3) | 0);
      return {
        a0: Math.random() * Math.PI * 2,
        rad: 0.1 + Math.random() * 0.42,
        fa: (0.04 + Math.random() * 0.08) * (Math.random() < 0.5 ? 1 : -1),
        fw: 0.3 + Math.random() * 0.45,
        pw: Math.random() * Math.PI * 2,
        sz: 1.3 + Math.random() * 1.8,
        dendrites: Array.from({ length: nd }, (_, d) => ({
          ang: (d / nd) * Math.PI * 2 + Math.random() * 0.8,
          len: 0.05 + Math.random() * 0.075,
          bend: (Math.random() - 0.5) * 1.4,
          wig: Math.random() * Math.PI * 2,
        })),
      };
    });
    type Signal = { i: number; j: number; cp: { x: number; y: number }; p: number; sp: number };
    const signals: Signal[] = [];
    const flashes: { x: number; y: number; a: number }[] = [];

    function speakerBurst() {
      if (reduce) return;
      for (let i = 0; i < 60; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = (0.9 + Math.random() * 3.0) * R * 0.02;
        sparks.push({
          x: CX + Math.cos(a) * R * 0.4, y: CY + Math.sin(a) * R * 0.4,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          a: 1, sz: 1 + Math.random() * 2.4,
        });
      }
      shockwaves.push({ r: R * 0.7, a: 0.8, w: 2.2 });
    }

    const b255 = (v: RGB): RGB => [
      Math.round(v[0] * 255), Math.round(v[1] * 255), Math.round(v[2] * 255),
    ];
    const A_ = b255(A0), B_ = b255(B0), HOT_ = b255(H0);
    const A2_ = b255(A1), B2_ = b255(B1), HOT2_ = b255(H1);
    const mixRGB = (a: RGB, b: RGB, m: number): RGB => [
      Math.round(lerp(a[0], b[0], m)),
      Math.round(lerp(a[1], b[1], m)),
      Math.round(lerp(a[2], b[2], m)),
    ];

    let raf = 0;
    let visible = false;
    let disposed = false;
    const t0 = performance.now();
    let lastNow = t0;

    function draw(now: number) {
      raf = 0;
      if (disposed) return;
      const t = (now - t0) / 1000;
      const dt = Math.min((now - lastNow) / 1000, 0.05);
      lastNow = now;
      const k = (f: number) => 1 - Math.exp(-f * dt);

      energy = lerp(energy, targetEnergy, k(2.6));
      hueMix = lerp(hueMix, targetHue, k(3.0));
      prevEnv = env;
      if (targetEnergy > 0.05) {
        const rawEnv =
          0.42 + 0.58 * Math.abs(Math.sin(t * 3.7) * Math.sin(t * 1.9) + 0.22 * Math.sin(t * 6.3));
        env = lerp(env, Math.min(rawEnv, 1), k(5.0));
      } else {
        env = lerp(env, 0, k(2.6));
      }
      pulse *= Math.exp(-3.2 * dt);
      const ampRaw = reduce
        ? energy * 0.3
        : energy * Math.min(env * 0.75 + pulse * 0.5, 1);
      ampS = lerp(ampS, ampRaw, k(9));
      const amp = ampS;

      if (gl) {
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform1f(uT, reduce ? t * 0.3 : t);
        gl.uniform1f(uAmp, amp);
        gl.uniform1f(uHue, hueMix);
        gl.uniform2f(uRes, PW, PH);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }

      const A = mixRGB(A_, A2_, hueMix);
      const B = mixRGB(B_, B2_, hueMix);
      const HOT = mixRGB(HOT_, HOT2_, hueMix);

      if (!reduce && amp > 0.5 && env - prevEnv > 0.012 && shockwaves.length < 4) {
        shockwaves.push({ r: R * 0.95, a: 0.5, w: 1.4 });
      }
      if (!reduce && Math.random() < 0.012 && comets.length < 3) {
        const a = Math.random() * Math.PI * 2;
        comets.push({ a, r: R * (1.35 + Math.random() * 0.3), s: 0.02 + Math.random() * 0.03, life: 1, trail: [] });
      }
      const speakerNow: Speaker =
        targetEnergy > 0.05 ? (targetHue < 0.5 ? "agent" : "client") : null;
      if (speakerNow && speakerNow !== lastSpeaker) speakerBurst();
      lastSpeaker = speakerNow;

      fx!.clearRect(0, 0, W, H);
      fx!.globalCompositeOperation = "lighter";

      /* fallback core, only when there is no GL to draw the plasma */
      if (!gl) {
        const g = fx!.createRadialGradient(CX, CY, 0, CX, CY, R * (1 + amp * 0.2));
        g.addColorStop(0, "rgba(255,255,255,.9)");
        g.addColorStop(0.35, `rgba(${B[0]},${B[1]},${B[2]},.5)`);
        g.addColorStop(0.7, `rgba(${A[0]},${A[1]},${A[2]},.3)`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        fx!.fillStyle = g;
        fx!.beginPath();
        fx!.arc(CX, CY, R * 1.3, 0, Math.PI * 2);
        fx!.fill();
      }

      /* ---- neurons: somas, dendrites, curved synapses, impulses ---- */
      const NPOS = NEURONS.map((nn) => {
        const a = nn.a0 + t * nn.fa;
        const wob = Math.sin(t * nn.fw + nn.pw) * R * 0.04;
        return {
          x: CX + Math.cos(a) * R * nn.rad + wob,
          y: CY + Math.sin(a) * R * nn.rad * 0.92 - wob * 0.6,
          sz: nn.sz,
          nn,
        };
      });
      const qbez = (
        p0: { x: number; y: number },
        cp: { x: number; y: number },
        p1: { x: number; y: number },
        tt: number,
      ) => ({
        x: (1 - tt) * (1 - tt) * p0.x + 2 * (1 - tt) * tt * cp.x + tt * tt * p1.x,
        y: (1 - tt) * (1 - tt) * p0.y + 2 * (1 - tt) * tt * cp.y + tt * tt * p1.y,
      });

      fx!.lineCap = "round";
      for (const q of NPOS) {
        for (const d of q.nn.dendrites) {
          const a = d.ang + Math.sin(t * 0.8 + d.wig) * 0.18;
          const L = R * d.len;
          const ex = q.x + Math.cos(a) * L, ey = q.y + Math.sin(a) * L;
          const cp = {
            x: q.x + Math.cos(a + d.bend * 0.5) * L * 0.55,
            y: q.y + Math.sin(a + d.bend * 0.5) * L * 0.55,
          };
          fx!.strokeStyle = `rgba(${A[0]},${A[1]},${A[2]},${0.14 + amp * 0.16})`;
          fx!.lineWidth = 1.1;
          fx!.beginPath();
          fx!.moveTo(q.x, q.y);
          fx!.quadraticCurveTo(cp.x, cp.y, ex, ey);
          fx!.stroke();
          fx!.fillStyle = `rgba(${B[0]},${B[1]},${B[2]},${0.18 + amp * 0.2})`;
          fx!.beginPath();
          fx!.arc(ex, ey, 0.9, 0, Math.PI * 2);
          fx!.fill();
        }
      }

      const LINK = R * 0.42;
      for (let i = 0; i < NPOS.length; i++) {
        for (let j = i + 1; j < NPOS.length; j++) {
          const dx = NPOS[i].x - NPOS[j].x, dy = NPOS[i].y - NPOS[j].y;
          const d = Math.hypot(dx, dy);
          if (d >= LINK) continue;
          const mid = { x: (NPOS[i].x + NPOS[j].x) / 2, y: (NPOS[i].y + NPOS[j].y) / 2 };
          const off = Math.sin(i * 12.9 + j * 7.7) * R * 0.07;
          const cp = { x: mid.x - (dy / d) * off, y: mid.y + (dx / d) * off };
          fx!.strokeStyle = `rgba(${A[0]},${A[1]},${A[2]},${(1 - d / LINK) * (0.11 + amp * 0.2)})`;
          fx!.lineWidth = 0.85;
          fx!.beginPath();
          fx!.moveTo(NPOS[i].x, NPOS[i].y);
          fx!.quadraticCurveTo(cp.x, cp.y, NPOS[j].x, NPOS[j].y);
          fx!.stroke();
          if (!reduce && Math.random() < 0.0015 + amp * 0.007 && signals.length < 10) {
            signals.push({ i, j, cp, p: 0, sp: 0.018 + Math.random() * 0.022 });
          }
        }
      }

      for (const q of NPOS) {
        const breathe = 1 + 0.12 * Math.sin(t * 1.4 + q.nn.pw);
        let g2 = fx!.createRadialGradient(q.x, q.y, 0, q.x, q.y, q.sz * 3.4 * breathe);
        g2.addColorStop(0, `rgba(${HOT[0]},${HOT[1]},${HOT[2]},${0.34 + amp * 0.3})`);
        g2.addColorStop(0.45, `rgba(${B[0]},${B[1]},${B[2]},${0.14 + amp * 0.14})`);
        g2.addColorStop(1, "rgba(0,0,0,0)");
        fx!.fillStyle = g2;
        fx!.beginPath();
        fx!.arc(q.x, q.y, q.sz * 3.4 * breathe, 0, Math.PI * 2);
        fx!.fill();
        const lx = q.x + q.sz * 1.1, ly = q.y - q.sz * 0.7;
        g2 = fx!.createRadialGradient(lx, ly, 0, lx, ly, q.sz * 1.8);
        g2.addColorStop(0, `rgba(${A[0]},${A[1]},${A[2]},${0.2 + amp * 0.16})`);
        g2.addColorStop(1, "rgba(0,0,0,0)");
        fx!.fillStyle = g2;
        fx!.beginPath();
        fx!.arc(lx, ly, q.sz * 1.8, 0, Math.PI * 2);
        fx!.fill();
      }

      for (let i = signals.length - 1; i >= 0; i--) {
        const sg = signals[i];
        sg.p += sg.sp * (1 + amp * 1.2);
        if (sg.p >= 1 || !NPOS[sg.i] || !NPOS[sg.j]) {
          if (NPOS[sg.j]) flashes.push({ x: NPOS[sg.j].x, y: NPOS[sg.j].y, a: 0.9 });
          signals.splice(i, 1);
          continue;
        }
        const pt = qbez(NPOS[sg.i], sg.cp, NPOS[sg.j], sg.p);
        const fade = Math.sin(sg.p * Math.PI);
        fx!.fillStyle = `rgba(255,255,255,${0.8 * fade})`;
        fx!.beginPath();
        fx!.arc(pt.x, pt.y, 1.5, 0, Math.PI * 2);
        fx!.fill();
        fx!.fillStyle = `rgba(${B[0]},${B[1]},${B[2]},${0.42 * fade})`;
        fx!.beginPath();
        fx!.arc(pt.x, pt.y, 3.6, 0, Math.PI * 2);
        fx!.fill();
      }

      for (let i = flashes.length - 1; i >= 0; i--) {
        const f = flashes[i];
        f.a -= 0.05;
        if (f.a <= 0) { flashes.splice(i, 1); continue; }
        const g3 = fx!.createRadialGradient(f.x, f.y, 0, f.x, f.y, 10);
        g3.addColorStop(0, `rgba(255,255,255,${f.a * 0.7})`);
        g3.addColorStop(1, "rgba(0,0,0,0)");
        fx!.fillStyle = g3;
        fx!.beginPath();
        fx!.arc(f.x, f.y, 10, 0, Math.PI * 2);
        fx!.fill();
      }

      /* ---- 3D particle constellation ---- */
      rotY += (reduce ? 0.02 : 0.1 + amp * 0.6) * 0.016;
      rotX = 0.35 + Math.sin(t * 0.3) * 0.12;
      const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
      const wobble = amp * 0.15;
      for (const p of sphere) {
        const x = p.x * cosY + p.z * sinY;
        let z = -p.x * sinY + p.z * cosY;
        const y = p.y * cosX - z * sinX;
        z = p.y * sinX + z * cosX;
        const rr = R * (1.06 + 0.03 * Math.sin(t * 1.2 + p.tw) + wobble * Math.sin(t * 5 + p.tw * 3));
        const persp = 1 / (1.6 - z * 0.5);
        const depth = (z + 1) / 2;
        const tw = 0.6 + 0.4 * Math.sin(t * 2.4 + p.tw);
        const alpha = (0.05 + depth * 0.45) * (0.4 + amp * 0.9) * tw;
        const col = depth > 0.7 ? HOT : p.tw % 2 < 1 ? A : B;
        fx!.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${alpha})`;
        fx!.beginPath();
        fx!.arc(CX + x * rr * persp, CY + y * rr * persp, p.sz * persp * (0.8 + amp * 0.7), 0, Math.PI * 2);
        fx!.fill();
      }

      /* ---- comets ---- */
      for (let i = comets.length - 1; i >= 0; i--) {
        const c = comets[i];
        c.a += c.s * (1 + amp * 1.5);
        c.life -= 0.004;
        if (c.life <= 0) { comets.splice(i, 1); continue; }
        c.trail.push({ x: CX + Math.cos(c.a) * c.r, y: CY + Math.sin(c.a) * c.r * 0.92 });
        if (c.trail.length > 26) c.trail.shift();
        for (let k = 0; k < c.trail.length; k++) {
          const q = c.trail[k];
          fx!.fillStyle = `rgba(${HOT[0]},${HOT[1]},${HOT[2]},${(k / c.trail.length) * c.life * 0.6})`;
          fx!.beginPath();
          fx!.arc(q.x, q.y, 1.2 + k * 0.06, 0, Math.PI * 2);
          fx!.fill();
        }
      }

      /* ---- gyroscope ribbons ---- */
      for (let i = 0; i < ribbons.length; i++) {
        const rb = ribbons[i];
        const rot = t * rb.speed + rb.phase;
        const rr = R * (1.16 + i * 0.045 + amp * 0.06);
        const flat = rb.tilt + 0.05 * Math.sin(t * 0.7 + i);
        const col = i % 2 === 0 ? A : B;
        fx!.save();
        fx!.translate(CX, CY);
        fx!.rotate(rot);
        fx!.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${0.1 + amp * 0.16})`;
        fx!.lineWidth = 1.6;
        fx!.beginPath();
        fx!.ellipse(0, 0, rr, rr * flat, 0, 0, Math.PI * 2);
        fx!.stroke();
        fx!.strokeStyle = `rgba(${HOT[0]},${HOT[1]},${HOT[2]},${0.05 + amp * 0.1})`;
        fx!.lineWidth = 3.5;
        fx!.beginPath();
        fx!.ellipse(0, 0, rr, rr * flat, 0, 0, Math.PI * 2);
        fx!.stroke();
        fx!.restore();
        rb.head += rb.headSpeed * (1 + amp * 2.2);
        const TAIL = 16;
        for (let k = 0; k < TAIL; k++) {
          const ha = rb.head - k * 0.055 * (rb.speed < 0 ? -1 : 1);
          const ex = Math.cos(ha) * rr, ey = Math.sin(ha) * rr * flat;
          fx!.fillStyle = `rgba(${HOT[0]},${HOT[1]},${HOT[2]},${(1 - k / TAIL) * (0.35 + amp * 0.6)})`;
          fx!.beginPath();
          fx!.arc(
            CX + ex * Math.cos(rot) - ey * Math.sin(rot),
            CY + ex * Math.sin(rot) + ey * Math.cos(rot),
            (2.6 - k * 0.12) * (0.8 + amp * 0.5), 0, Math.PI * 2,
          );
          fx!.fill();
        }
      }

      /* ---- shockwaves ---- */
      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const s = shockwaves[i];
        s.r += R * 0.034;
        s.a -= 0.016;
        if (s.a <= 0 || s.r > R * 1.75) { shockwaves.splice(i, 1); continue; }
        fx!.strokeStyle = `rgba(${B[0]},${B[1]},${B[2]},${s.a * (1 - s.r / (R * 1.75))})`;
        fx!.lineWidth = s.w;
        fx!.beginPath();
        fx!.arc(CX, CY, s.r, 0, Math.PI * 2);
        fx!.stroke();
      }

      /* ---- sparks ---- */
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx; s.y += s.vy;
        s.vx *= 0.96; s.vy *= 0.96;
        s.a -= 0.022;
        if (s.a <= 0) { sparks.splice(i, 1); continue; }
        fx!.fillStyle = `rgba(${HOT[0]},${HOT[1]},${HOT[2]},${s.a})`;
        fx!.beginPath();
        fx!.arc(s.x, s.y, s.sz * s.a, 0, Math.PI * 2);
        fx!.fill();
      }

      /* ---- equalizer ring ---- */
      const bars = 96;
      const baseR = R * 1.34;
      for (let i = 0; i < bars; i++) {
        const a = (i / bars) * Math.PI * 2 + t * 0.25;
        const n = Math.sin(i * 0.9 + t * 3.3) * Math.sin(i * 0.37 + t * 1.7);
        const len = 3 + amp * 34 * Math.abs(n) + energy * 3;
        const col = i % 2 === 0 ? A : B;
        fx!.lineWidth = 2;
        fx!.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${0.1 + amp * 0.62})`;
        fx!.beginPath();
        fx!.moveTo(CX + Math.cos(a) * baseR, CY + Math.sin(a) * baseR);
        fx!.lineTo(CX + Math.cos(a) * (baseR + len), CY + Math.sin(a) * (baseR + len));
        fx!.stroke();
      }

      /* ---- orbital dust ---- */
      for (const p of DUST) {
        p.a += p.s * (1 + amp * 3);
        p.w += 0.02;
        const pr = R * p.r * (1 + 0.04 * Math.sin(p.w)) + amp * 10 * Math.sin(p.w * 2);
        fx!.fillStyle = `rgba(${B[0]},${B[1]},${B[2]},${p.o * (0.3 + amp * 0.7)})`;
        fx!.beginPath();
        fx!.arc(CX + Math.cos(p.a) * pr, CY + Math.sin(p.a) * pr * 0.94, p.sz * (0.8 + amp * 0.6), 0, Math.PI * 2);
        fx!.fill();
      }

      fx!.globalCompositeOperation = "source-over";
      if (visible) raf = requestAnimationFrame(draw);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(fxCanvas);

    // Nothing runs off-screen. The engine is expensive and this sits a long
    // way down the page.
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible && !raf && !disposed) {
          lastNow = performance.now();
          raf = requestAnimationFrame(draw);
        }
      },
      { threshold: 0 },
    );
    io.observe(fxCanvas);

    resize();

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      apiRef.current = null;
      if (gl && prog) gl.deleteProgram(prog);
    };
  }, [apiRef]);

  return (
    <div
      ref={wrapRef}
      className="relative mt-[0.5em] flex aspect-square w-[min(28em,86vw)] items-center justify-center"
    >
      <div className="pointer-events-none absolute inset-[11%] animate-[orbSpin_24s_linear_infinite] rounded-full border border-[var(--cover-paper)]/12 before:absolute before:-top-[3px] before:left-1/2 before:size-[6px] before:rounded-full before:bg-[var(--cover-orb-b)] before:shadow-[0_0_12px_var(--cover-orb-b)] before:content-['']" />
      <div className="pointer-events-none absolute inset-[4%] animate-[orbSpin_38s_linear_infinite_reverse] rounded-full border border-[var(--cover-paper)]/12 opacity-50" />
      <canvas ref={glRef} className="absolute inset-0 block size-full" />
      <canvas ref={fxRef} className="absolute inset-0 z-[2] block size-full" />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Playback
 * ------------------------------------------------------------------ */

const GAP_MS = 700;
const TOTAL_WORDS = SCRIPT.reduce((s, l) => s + l.t.split(" ").length, 0);

/**
 * Longer words linger, short ones flow — clamped so the rhythm holds.
 *
 * The clamp is deliberately narrow. Each word's reveal runs far longer than
 * the gap to the next one, so several are always mid-flight; widening the
 * spread makes that overlap lurch between two and six words and the stream
 * reads as ticking rather than flowing. The average is unchanged, so the
 * call still takes the same time end to end.
 */
function wordDelay(w: string) {
  return Math.max(200, Math.min(360, 235 * 0.6 + w.replace(/[^a-zA-Z0-9]/g, "").length * 30));
}

function wordsBefore(line: number, word: number) {
  let c = 0;
  for (let i = 0; i < line; i++) c += SCRIPT[i].t.split(" ").length;
  return c + word;
}

type Phase = "idle" | "playing" | "paused" | "done";

/** Keys that mean "I am scrolling this page myself". */
const SCROLL_KEYS = new Set([
  "ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " ",
]);

export function VoiceDemo() {
  const orbRef = useRef<OrbApi | null>(null);
  const reduce = useReducedMotion();

  /* ---------- follow the transcript ---------- */
  // The transcript's own box: its bottom edge IS the bottom of the newest
  // bubble, so no sentinel element is needed to measure against.
  const tailRef = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const tween = useRef<{ stop: () => void } | null>(null);
  const tweening = useRef(false);

  /*
    The scroll position, held as a motion value rather than passed to
    `animate` as a plain number. That is the whole reason the follow reads
    as one continuous camera move: a bubble can land while the previous
    ride is still in the air, and re-targeting a motion value hands the new
    animation the velocity the old one had. Animating between two numbers
    cannot do that — every bubble would start a fresh curve from rest, and
    the page would visibly stall and re-accelerate at each one.
  */
  const scrollMV = useMotionValue(0);

  useEffect(
    () =>
      scrollMV.on("change", (v) => {
        // Only while we own the scroll. `release` clears the flag the
        // instant the reader reaches for the page, and this goes quiet.
        if (tweening.current) window.scrollTo({ top: v, behavior: "instant" });
      }),
    [scrollMV],
  );

  useEffect(() => {
    /*
      Hand the page back the moment the reader reaches for it.
      Listening for wheel/touch/keys rather than for `scroll` is the whole
      trick: our own tween fires `scroll` on every frame, so a scroll
      listener would read its own output as the user grabbing the page and
      release on the first step it took.
    */
    let settle: ReturnType<typeof setTimeout>;

    const release = () => {
      follow.current = false;
      clearTimeout(settle);
      tween.current?.stop();
      tween.current = null;
      tweening.current = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (SCROLL_KEYS.has(e.key)) release();
    };
    /*
      And take it back only when they come to rest at the end of the
      transcript.

      Both halves of that are load-bearing. "At rest" — because a scroll
      gesture fires its first event while the page has barely moved, so
      testing on every event re-arms in the middle of the very gesture that
      just released, and the reader gets dragged back down as soon as they
      try to look up. Debouncing waits for the gesture, its momentum and any
      smooth-scroll animation to finish, then asks once.

      And "at the end" rather than "near it" — someone who has scrolled on
      to the pricing table is a long way past the tail too, and a test that
      only measured distance would read that as being back at the bottom.
    */
    const rearm = () => {
      if (tweening.current || follow.current) return;
      clearTimeout(settle);
      settle = setTimeout(() => {
        const rect = tailRef.current?.getBoundingClientRect();
        if (!rect) return;
        if (rect.bottom >= 0 && rect.bottom <= window.innerHeight) {
          follow.current = true;
        }
      }, 180);
    };

    window.addEventListener("wheel", release, { passive: true });
    window.addEventListener("touchmove", release, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", rearm, { passive: true });
    return () => {
      window.removeEventListener("wheel", release);
      window.removeEventListener("touchmove", release);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", rearm);
      clearTimeout(settle);
      tween.current?.stop();
    };
  }, []);

  const [phase, setPhase] = useState<Phase>("idle");
  const [line, setLine] = useState(-1);
  const [revealed, setRevealed] = useState(0);
  /** Words restored on resume — they reappear without re-animating. */
  const [restored, setRestored] = useState(0);
  const [bubbles, setBubbles] = useState(0);
  const [spoken, setSpoken] = useState(0);

  // The exact resume point, and the flag that unwinds the async loop.
  const pos = useRef({ line: 0, word: 0 });
  const cancelled = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(
    () => () => {
      cancelled.current = true;
      timers.current.forEach(clearTimeout);
    },
    [],
  );

  /*
    Every bubble pushes the page taller. Ride it down so the newest line is
    always on screen — but only as far as it actually needs, and never past
    what is already visible, so a transcript that still fits does not move
    the page at all.
  */
  useEffect(() => {
    if (!bubbles || !follow.current) return;
    const tail = tailRef.current;
    if (!tail) return;

    // Land the newest bubble a little above the fold rather than flush
    // against it — a line touching the bottom edge reads as cut off.
    const gap = Math.round(window.innerHeight * 0.14);
    const delta = tail.getBoundingClientRect().bottom + gap - window.innerHeight;
    if (delta <= 1) return;

    const to = window.scrollY + delta;

    if (reduce) {
      // `instant` matters: `html` carries `scroll-behavior: smooth`, and
      // without the override the browser would animate this after all.
      tween.current?.stop();
      tweening.current = false;
      window.scrollTo({ top: to, behavior: "instant" });
      return;
    }

    // Only resync when we are starting from rest. Mid-flight the motion
    // value already holds where we are, and `jump` would wipe the velocity
    // this whole arrangement exists to preserve.
    if (!tweening.current) scrollMV.jump(window.scrollY);
    tweening.current = true;

    // A critically damped spring rather than a fixed curve: bounce 0 so it
    // never overshoots and shows the reader a line it then takes back, and
    // handing it a new target is a retarget, not a restart — no `stop()`
    // here, `animate` takes the value over and inherits its motion.
    tween.current = animate(scrollMV, to, {
      type: "spring",
      duration: 1.15,
      bounce: 0,
      onComplete: () => {
        tweening.current = false;
        tween.current = null;
      },
    });
  }, [bubbles, reduce, scrollMV]);

  const wait = (ms: number) =>
    new Promise<void>((res) => {
      timers.current.push(setTimeout(res, ms));
    });

  const play = useCallback(async () => {
    cancelled.current = false;
    // Pressing play is an explicit "show me this", so it re-arms following
    // even if the reader had scrolled off earlier in the session.
    follow.current = true;
    setPhase("playing");

    // Start over only if we finished, or were never mid-conversation.
    if (pos.current.line === 0 && pos.current.word === 0) {
      setBubbles(0);
      setSpoken(0);
    }

    let done = wordsBefore(pos.current.line, pos.current.word);
    setSpoken(done);

    for (let li = pos.current.line; li < SCRIPT.length; li++) {
      if (cancelled.current) return;
      const turn = SCRIPT[li];
      const words = turn.t.split(" ");
      const from = li === pos.current.line ? pos.current.word : 0;

      orbRef.current?.speak(turn.sp);
      setLine(li);
      setRestored(from);
      setRevealed(from);

      for (let i = from; i < words.length; i++) {
        if (cancelled.current) return;
        setRevealed(i + 1);
        orbRef.current?.pulse();
        done++;
        setSpoken(done);
        pos.current = { line: li, word: i + 1 };
        await wait(wordDelay(words[i]));
      }
      if (cancelled.current) return;

      setBubbles(li + 1);
      pos.current = { line: li + 1, word: 0 };
      orbRef.current?.speak(null);
      await wait(GAP_MS);
    }

    if (cancelled.current) return;
    orbRef.current?.speak(null);
    setLine(-1);
    setSpoken(TOTAL_WORDS);
    pos.current = { line: 0, word: 0 };
    setPhase("done");
  }, []);

  const toggle = () => {
    if (phase === "playing") {
      // Freeze everything; `pos` already holds the exact word to resume on.
      cancelled.current = true;
      timers.current.forEach(clearTimeout);
      timers.current = [];
      orbRef.current?.speak(null);
      setPhase("paused");
    } else {
      void play();
    }
  };

  const turn = line >= 0 ? SCRIPT[line] : null;
  const isAgent = turn?.sp === "agent";
  const words = turn ? turn.t.split(" ") : [];

  const tag =
    phase === "paused" ? C.tagPaused
    : phase === "done" ? C.tagDone
    : turn ? (isAgent ? C.tagAgent : C.tagCaller)
    : C.tagIdle;

  const label =
    phase === "playing" ? C.labelPlaying
    : phase === "paused" ? C.labelPaused
    : phase === "done" ? C.labelDone
    : C.labelIdle;

  return (
    <div className="mt-[5em] flex flex-col items-center md:mt-[7em]">
      <span className="inline-flex items-center gap-[0.6em] rounded-full border border-[var(--cover-paper)]/14 bg-[var(--cover-panel)]/60 px-[1em] py-[0.5em] text-[0.68em] font-semibold uppercase leading-none tracking-[0.14em] text-[var(--cover-brand-lit)] backdrop-blur-sm">
        <span className="size-[0.5em] shrink-0 animate-pulse rounded-full bg-[var(--cover-orb-b)]" />
        {C.chip}
      </span>

      <p className="mt-[1.4em] text-center text-[0.68em] font-semibold uppercase leading-none tracking-[0.22em] text-[var(--cover-paper)]/45">
        {C.kicker}
      </p>

      <h3 className="mt-[0.9em] max-w-[16em] text-balance text-center text-[1.9em] font-medium leading-[1.15] tracking-[-0.035em] md:text-[2.3em]">
        {C.title}
      </h3>

      <Orb apiRef={orbRef} />

      {/* Speaker tag. Sits under the orb rather than inside it — the orb is
          square and fluid, and overlaying it clipped the tag on narrow
          screens where the copy is longest. */}
      <span
        className={cn(
          "-mt-[1.5em] inline-flex items-center rounded-full border px-[1em] py-[0.45em] text-[0.65em] font-semibold uppercase leading-none tracking-[0.16em] backdrop-blur-sm transition-colors duration-500",
          turn && isAgent
            ? "border-[var(--cover-orb-b)]/45 bg-[var(--cover-ink)]/75 text-[var(--cover-orb-b)]"
            : turn
              ? "border-[var(--cover-orb-alt-b)]/45 bg-[var(--cover-ink)]/75 text-[var(--cover-orb-alt-b)]"
              : "border-[var(--cover-paper)]/14 bg-[var(--cover-ink)]/75 text-[var(--cover-paper)]/50",
        )}
      >
        {tag}
      </span>

      {/* Caption. Fixed minimum height so the controls below it never jump
          as lines of different lengths come and go. */}
      <div className="mt-[1.4em] flex min-h-[7em] w-[min(42em,92vw)] flex-col items-center gap-[0.6em] text-center">
        <span className="text-[0.6em] font-semibold uppercase leading-none tracking-[0.2em] text-[var(--cover-paper)]/45">
          {turn ? (isAgent ? C.agentName : C.callerName) : ""}
        </span>

        <p
          className={cn(
            "text-[1.15em] leading-[1.5] tracking-[-0.01em] md:text-[1.35em]",
            turn && !isAgent && "font-light text-[var(--cover-orb-alt-hot)]",
          )}
        >
          {phase === "done" ? (
            <span className="text-[var(--cover-brand-lit)]">{C.captionDone}</span>
          ) : (
            words.map((w, i) => (
              /*
                No scale. It was the one transform the eye could catch:
                type growing back to size wobbles its own sidebearings, and
                on a word that is already translating and defocusing it is
                the part that reads as a pop.

                And a gentler curve than the site's EASE. Expo-out is built
                for a one-shot arrival — it spends its motion in the first
                quarter and coasts, which is right for a section sliding
                into view and wrong here, where the coast is invisible and
                every word lands on the same hard tick. This spreads the
                travel across the whole 820ms, so each word is still
                settling as the next three begin and the line resolves as
                one continuous movement.
              */
              <span
                key={`${line}-${i}`}
                className={cn(
                  "inline-block will-change-[opacity,transform,filter]",
                  i < revealed
                    ? "translate-y-0 opacity-100 blur-0"
                    : "translate-y-[7px] opacity-0 blur-[5px]",
                  i < restored
                    ? "transition-none"
                    : "transition-[opacity,transform,filter] duration-[820ms] ease-[cubic-bezier(.2,.7,.3,1)]",
                )}
              >
                {w}
                {i < words.length - 1 ? " " : ""}
              </span>
            ))
          )}
        </p>
      </div>

      <div className="mt-[1.6em] flex flex-col items-center gap-[0.9em] sm:flex-row sm:gap-[1.2em]">
        <button
          type="button"
          onClick={toggle}
          aria-label={label}
          className={cn(
            "relative grid size-[3.6em] shrink-0 place-items-center rounded-full text-[var(--cover-ink)] transition-transform duration-200",
            "bg-[linear-gradient(135deg,var(--cover-orb-a),var(--cover-orb-b))]",
            "shadow-[0_0_2em_rgba(123,79,212,0.55),inset_0_1px_0_rgba(255,255,255,0.35)]",
            "hover:scale-105 active:scale-95",
            phase !== "playing" &&
              "after:absolute after:-inset-[0.35em] after:animate-[orbHalo_2.2s_ease-out_infinite] after:rounded-full after:border after:border-[var(--cover-orb-b)]/40 after:content-['']",
          )}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="size-[1.4em]">
            {phase === "playing" ? (
              <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
            ) : (
              <path d="M8 5.5v13l11-6.5z" />
            )}
          </svg>
        </button>
        {/* Fixed width, or the centred row re-centres every time the label
            changes length and the button slides out from under the cursor
            that just pressed it. */}
        <span className="text-[0.68em] font-semibold uppercase leading-none tracking-[0.16em] text-[var(--cover-paper)]/50 sm:w-[15em] sm:text-left">
          {label}
        </span>
      </div>

      <div className="mt-[1.5em] h-[3px] w-[min(26em,80vw)] overflow-hidden rounded-full bg-[var(--cover-paper)]/12">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,var(--cover-orb-a),var(--cover-orb-b))] shadow-[0_0_10px_rgba(185,138,232,0.7)] transition-[width] duration-300 ease-linear"
          style={{ width: `${((spoken / TOTAL_WORDS) * 100).toFixed(1)}%` }}
        />
      </div>

      <div
        ref={tailRef}
        className="mt-[2.8em] flex w-[min(42em,94vw)] flex-col gap-[0.75em]"
      >
        <div className="mb-[0.3em] flex items-center gap-[0.8em]">
          <h4 className="text-[0.7em] font-semibold uppercase leading-none tracking-[0.14em] text-[var(--cover-brand-lit)]">
            {C.transcriptTitle}
          </h4>
          <span aria-hidden className="h-px flex-1 bg-[var(--cover-paper)]/12" />
        </div>

        {SCRIPT.slice(0, bubbles).map((b, i) => (
          <motion.div
            key={i}
            /* A bubble is a one-shot arrival, so EASE is right here — but
               slower, and defocused on the way in so it settles into the
               page rather than snapping onto it, the same move the caption
               above makes word by word. */
            initial={reduce ? false : { opacity: 0, y: 16, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.85, ease: EASE }}
            className={cn(
              "max-w-[82%] rounded-[1.1em] border px-[1.1em] py-[0.8em] text-[0.9em] leading-[1.55]",
              b.sp === "agent"
                ? "self-start rounded-bl-[0.25em] border-[var(--cover-orb-b)]/30 bg-[linear-gradient(135deg,rgba(123,79,212,0.16),rgba(185,138,232,0.1))]"
                : "self-end rounded-br-[0.25em] border-[var(--cover-orb-alt-b)]/20 bg-[var(--cover-panel)]/75 text-[var(--cover-orb-alt-hot)]",
            )}
          >
            <span
              className={cn(
                "mb-[0.4em] block text-[0.62em] font-semibold uppercase leading-none tracking-[0.18em]",
                b.sp === "agent"
                  ? "text-[var(--cover-orb-b)]"
                  : "text-[var(--cover-orb-alt-b)]",
              )}
            >
              {b.sp === "agent" ? C.agentName : C.callerName}
            </span>
            {b.t}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
