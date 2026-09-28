"use client";

import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from "react";
import { cn } from "@/lib/utils";
import {
  HOUSE_INK,
  HOUSE_POSTER,
  MAX_PIXELS,
  SCENE_CONTRACT,
  SLOW_MS,
  VERT,
  guarded,
  hexToRgb,
  stageTier,
  type Scene,
} from "../industry/shader-stage";
import { demote, getTier, onTierChange, slowFrames, whenTierSettled } from "../product/device-tier";
import { whenIdle, whenIntent } from "../product/motion-kit";
import { usePrefersReducedMotion } from "../product/timing";

/* ------------------------------------------------------------------ *
 * The trade window: every trade's scene, one WebGL context.
 *
 * ShaderStage is built for a page that shows one scene for its whole
 * life. The landing's trade window shows seventeen, one at a time, and a
 * ShaderStage keyed per trade would create and throw away a context on
 * every click: a compile stall each time, and browsers cap live contexts
 * (Chrome at sixteen) by losing the oldest, which could be an orb.
 *
 * So this stage keeps ONE context for as long as it is mounted and swaps
 * programs inside it:
 *
 *  · a scene is the same module ShaderStage loads, compiled against the
 *    same SCENE_CONTRACT, behind the same paper guard, fed the same
 *    uniforms. A scene cannot tell which stage is running it;
 *  · at most three linked programs are held (two on a mid device, which
 *    also skips the hover prefetch). Making room deletes the least
 *    recently used one that is neither on screen nor the one wanted;
 *  · with KHR_parallel_shader_compile the driver links on its own threads
 *    and the loop asks once a frame whether it is done. Without it the
 *    link waits for an idle moment, because then it is a long task;
 *  · until the new program is ready the old scene keeps playing. Then its
 *    last frame is frozen into a texture and opened by a ragged iris over
 *    900ms, so one scene becomes the next without a blank frame;
 *  · two poster layers crossfade underneath. They paint first, and they are
 *    all that anyone without WebGL, with a failed compile or with a lost
 *    context ever sees.
 *
 * The first context waits for the same three things ShaderStage's does:
 * the stage coming near, a first sign of intent, then an idle moment.
 * Tiers, the pixel budget, adaptive quality, the on-screen-only loop and
 * the single settled frame under reduced motion all follow ShaderStage.
 *
 * The device tier (device-tier.ts) comes before all of that: on a lite or
 * still device the stage is posters only. It never imports a scene module
 * and never creates a context; the posters come from `posters`, the page's
 * own list, or failing that the house poster. A demotion to lite while a
 * context runs (this loop's own governor included: quality at its floor
 * and frames still slow) tears the context down to the posters.
 *
 * `paused` (WCAG 2.2.2) finishes any dissolve, draws one settled frame
 * and stops asking for frames; the scene's clock stops with it and picks
 * up where it left off. A scene chosen while paused cuts in at rest.
 * ------------------------------------------------------------------ */

export type SceneLoader = (key: string) => Promise<Scene | null>;

export type TradeStageHandle = {
  /** Fetches the scene's module and, if there is room, starts its compile. Never selects. */
  prepare(key: string): void;
};

type Origin = { x: number; y: number };

/** Each scene's poster and alt, known to the page without importing the scene. */
export type ScenePosters = Readonly<Record<string, { poster: string; alt: string }>>;

/** Scene programs held at once, the one on screen included; fewer on a mid device. */
const MAX_PROGRAMS = 3;
const MID_PROGRAMS = 2;

/** How long the iris takes to open. */
const DISSOLVE_MS = 900;

/**
 * How far past the iris's radius its ragged edge can reach, in canvas
 * heights: the soft edge (0.06) plus the most the noise moves it (0.12),
 * rounded up. The radius runs from -EDGE to the farthest corner + EDGE, so
 * the old frame is whole on the first frame and entirely gone on the last.
 */
const EDGE = 0.2;

const CENTRE: Origin = { x: 0.5, y: 0.5 };

/*
  The iris. Drawn over the new scene with premultiplied blending, it keeps
  the frozen last frame of the old one outside a circle that grows from
  `uOrigin`, and lets the new one through inside it.

  The edge is not a clean circle: two octaves of value noise push it in and
  out, and a two-pixel grain reseeded 24 times a second breaks it up, so it
  reads as the old picture wearing away rather than as a wipe. The hash is
  integer arithmetic, so it is the same on every GPU.
*/
const COMPOSITE = `#version 300 es
precision highp float;
uniform sampler2D uFrozen;
uniform vec2 uRes;
uniform vec2 uOrigin;
uniform float uRadius;
uniform float uGrain;
out vec4 o;

float hash(uvec2 c, uint seed) {
  uint h = (c.x * 0x2F6B9E53u) ^ (c.y * 0x91A7C4E9u) ^ (seed * 0x5A17C3B9u);
  h ^= h >> 15u;
  h *= 0x4C9E1D27u;
  h ^= h >> 13u;
  h *= 0x7B3A58E1u;
  h ^= h >> 16u;
  return float(h >> 8u) / 16777215.0;
}

float vnoise(vec2 p, uint seed) {
  vec2 i = floor(p);
  vec2 f = p - i;
  f = f * f * (3.0 - 2.0 * f);
  uvec2 c = uvec2(ivec2(i) + 4096);
  float a = hash(c, seed);
  float b = hash(c + uvec2(1u, 0u), seed);
  float d = hash(c + uvec2(0u, 1u), seed);
  float e = hash(c + uvec2(1u, 1u), seed);
  return mix(mix(a, b, f.x), mix(d, e, f.x), f.y);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 asp = vec2(uRes.x / uRes.y, 1.0);
  float d = distance(uv * asp, uOrigin * asp);
  vec2 q = uv * asp * 7.0 + uGrain * 0.6;
  float n = (vnoise(q, 7u) * 0.667 + vnoise(q * 2.1 + 13.0, 11u) * 0.333 - 0.5) * 0.2;
  n += (hash(uvec2(gl_FragCoord.xy * 0.5), uint(uGrain * 24.0)) - 0.5) * 0.04;
  float keep = smoothstep(uRadius - 0.06, uRadius + 0.06, d + n);
  o = texture(uFrozen, uv) * keep;
}`;

/** Compiles and links without asking how it went: asking is what blocks. */
function link(gl: WebGL2RenderingContext, frag: string) {
  const program = gl.createProgram();
  const shaders = [gl.VERTEX_SHADER, gl.FRAGMENT_SHADER].map((type, i) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, i ? frag : VERT);
    gl.compileShader(s);
    gl.attachShader(program, s);
    return s;
  });
  // Every program shares one vertex array, so aPos sits at 0 in all of them.
  gl.bindAttribLocation(program, 0, "aPos");
  gl.linkProgram(program);
  // Only flagged while attached; they go with the program.
  for (const s of shaders) gl.deleteShader(s);
  return program;
}

/** Whether the link worked, or null while the driver is still on it. */
function linked(gl: WebGL2RenderingContext, par: KHR_parallel_shader_compile | null, program: WebGLProgram) {
  if (par && !gl.getProgramParameter(program, par.COMPLETION_STATUS_KHR)) return null;
  return Boolean(gl.getProgramParameter(program, gl.LINK_STATUS));
}

/** power3.inOut */
function ease(p: number) {
  return p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2;
}

type SceneLocs = Record<"res" | "time" | "pointer" | "enter", WebGLUniformLocation | null>;
type IrisLocs = Record<"res" | "origin" | "radius" | "grain", WebGLUniformLocation | null>;

type Entry = {
  key: string;
  scene: Scene;
  /** Null while a compile without the parallel extension waits for idle. */
  program: WebGLProgram | null;
  status: "compiling" | "ready" | "failed";
  used: number;
  locs: SceneLocs | null;
  cancel?: () => void;
};

type Fade = { start: number; origin: Origin; far: number };

type StageIO = {
  /** The latest props, read when needed so a new callback never rebuilds the stage. */
  props: () => {
    load: SceneLoader;
    posters?: ScenePosters;
    initialPoster?: string;
    initialAlt?: string;
    origin?: Origin;
    onSettled?: (key: string) => void;
  };
  /** Puts a scene's poster and alt on the poster layers. */
  show: (poster: string, alt: string, fade: boolean) => void;
};

type Stage = {
  commit(key: string): void;
  prepare(key: string): void;
  setReduce(reduce: boolean): void;
  setPaused(paused: boolean): void;
  destroy(): void;
};

type Gpu = {
  ensure(key: string, scene: Scene, wanted: boolean): void;
  schedule(): void;
  pause(): void;
  restart(): void;
  /** Stops (true) or restarts (false) the scene's clock, for `paused`. */
  hold(on: boolean): void;
  destroy(): void;
};

/** True for a device tier that gets posters only. */
function flat() {
  const tier = getTier();
  return tier === "lite" || tier === "still";
}

function createStage(host: HTMLElement, canvas: HTMLCanvasElement, first: string, io: StageIO): Stage {
  const modules = new Map<string, Promise<Scene | null>>();
  /** Scenes already here, whose posters a posters-only stage may still use. */
  const scenes = new Map<string, Scene>();
  /** Keys with no scene, or whose scene would not compile: poster only. */
  const failed = new Set<string>();

  let want = first;
  /** The key whose onSettled is still owed. */
  let owed: string | null = first;
  let reduce = false;
  let paused = false;
  /** Set by a commit made while nobody could see the stage: that swap cuts. */
  let instant = false;
  let onScreen = false;
  let shown = true;
  /** No WebGL2, or the context was lost: the posters, for good. */
  let broken = false;
  let dead = false;
  let gpu: Gpu | null = null;
  let cancelIdle: (() => void) | undefined;

  const setShown = (on: boolean) => {
    shown = on;
    canvas.style.visibility = on ? "" : "hidden";
  };

  const settle = (key: string) => {
    if (owed !== key) return;
    owed = null;
    io.props().onSettled?.(key);
  };

  const fetchScene = (key: string) => {
    let pending = modules.get(key);
    if (!pending) {
      const { load } = io.props();
      pending = Promise.resolve()
        .then(() => load(key))
        .then(
          (scene) => {
            if (scene) scenes.set(key, scene);
            else failed.add(key);
            return scene;
          },
          () => {
            // A network failure is not a verdict on the scene: forget it, so
            // the next time this trade is chosen the import is tried again.
            modules.delete(key);
            return null;
          },
        );
      modules.set(key, pending);
    }
    return pending;
  };

  // Poster first, then the program. The poster is what shows while the
  // program compiles (or instead of it), so it changes the moment the
  // module is here; the canvas keeps the old scene until the new one can
  // actually be drawn.
  const request = (key: string) => {
    if (flat()) {
      // Posters only: the page's list, a scene already here, or the one the
      // server painted; never a new import.
      const { posters, initialPoster, initialAlt = "" } = io.props();
      const known =
        posters?.[key] ?? scenes.get(key) ?? (key === first && initialPoster ? { poster: initialPoster, alt: initialAlt } : null);
      io.show(known?.poster ?? HOUSE_POSTER, known?.alt ?? "", !reduce);
      setShown(false);
      settle(key);
      return;
    }
    fetchScene(key).then((scene) => {
      if (dead || key !== want) return;
      io.show(scene?.poster ?? HOUSE_POSTER, scene?.alt ?? "", !reduce);
      if (!scene || broken || failed.has(key)) {
        setShown(false);
        settle(key);
        return;
      }
      gpu?.ensure(key, scene, true);
    });
  };

  function create() {
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      powerPreference: "low-power",
    });
    // A context that arrives already lost is a canvas this stage used before
    // (a dev-mode remount): it will never draw again, so treat it as none.
    if (gl && !gl.isContextLost()) gpu = startGpu(gl);
    else {
      broken = true;
      setShown(false);
    }
    request(want);
  }

  function startGpu(gl: WebGL2RenderingContext): Gpu {
    const par = gl.getExtension("KHR_parallel_shader_compile");
    const { tier, cap, base } = stageTier();
    const room = getTier() === "mid" ? MID_PROGRAMS : MAX_PROGRAMS;
    const programs = new Map<string, Entry>();
    const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    let current: Entry | null = null;
    let fade: Fade | null = null;
    /** The current scene's clock: set on its first draw, so uTime starts at 0. */
    let begun = 0;
    /** Something changed that a still (reduced-motion) canvas has to redraw for. */
    let needsDraw = true;
    let clock = 0;
    let raf = 0;
    let lost = false;
    let quality = 1;
    let lastFrame = 0;
    let slow = 0;
    /** Judges the frames once quality is at its floor: still slow there demotes the visit. */
    const slowAtFloor = slowFrames();
    /** The scene's clock, stopped, while `paused`. */
    let stoppedAt: number | null = null;
    // Kept by an observer, never read in the loop; see ShaderStage.
    let cssW = Math.max(1, canvas.clientWidth);
    let cssH = Math.max(1, canvas.clientHeight);
    let frozenW = 0;
    let frozenH = 0;

    // One triangle over the canvas, shared by every program.
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // The frozen frame, on unit 0 for good. It is sized when a frame is
    // copied into it, so a resize mid-dissolve never wipes the one in use.
    const frozen = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, frozen);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // The iris is compiled with the context. Until it is ready, and for good
    // if it fails, swaps simply cut.
    let iris: { program: WebGLProgram; locs: IrisLocs | null } | null = { program: link(gl, COMPOSITE), locs: null };

    const drop = (e: Entry) => {
      e.cancel?.();
      if (e.program) gl.deleteProgram(e.program);
      programs.delete(e.key);
    };

    const finish = (e: Entry, program: WebGLProgram) => {
      const ok = linked(gl, par, program);
      if (ok === null) return;
      if (!ok) {
        e.status = "failed";
        drop(e);
        failed.add(e.key);
        // The poster already on show is this scene's; it carries it.
        if (e.key === want) {
          setShown(false);
          settle(e.key);
        }
        return;
      }
      gl.useProgram(program);
      const at = (name: string) => gl.getUniformLocation(program, name);
      e.locs = { res: at("uRes"), time: at("uTime"), pointer: at("uPointer"), enter: at("uEnter") };
      gl.uniform3fv(at("uColors"), new Float32Array(e.scene.colors.flatMap(hexToRgb)));
      gl.uniform3fv(at("uInk"), new Float32Array(hexToRgb(HOUSE_INK)));
      gl.uniform1f(at("uTier"), tier);
      e.status = "ready";
    };

    const poll = () => {
      if (iris && !iris.locs) {
        const ok = linked(gl, par, iris.program);
        if (ok === false) {
          gl.deleteProgram(iris.program);
          iris = null;
        } else if (ok) {
          const program = iris.program;
          const at = (name: string) => gl.getUniformLocation(program, name);
          gl.useProgram(program);
          gl.uniform1i(at("uFrozen"), 0);
          iris.locs = { res: at("uRes"), origin: at("uOrigin"), radius: at("uRadius"), grain: at("uGrain") };
        }
      }
      for (const e of programs.values()) if (e.status === "compiling" && e.program) finish(e, e.program);
    };

    /** Makes room for a wanted program. False when every slot is protected. */
    const evict = () => {
      let victim: Entry | null = null;
      for (const e of programs.values()) {
        if (e === current || e.key === want) continue;
        if (!victim || e.used < victim.used) victim = e;
      }
      if (victim) drop(victim);
      return victim !== null;
    };

    const ensure = (key: string, scene: Scene, wanted: boolean) => {
      if (lost || failed.has(key)) return;
      const held = programs.get(key);
      if (held) held.used = ++clock;
      else if (programs.size < room || (wanted && evict())) {
        const e: Entry = { key, scene, program: null, status: "compiling", used: ++clock, locs: null };
        programs.set(key, e);
        const frag = guarded(`${SCENE_CONTRACT}\n${scene.frag}`);
        if (par) e.program = link(gl, frag);
        else
          e.cancel = whenIdle(() => {
            e.cancel = undefined;
            if (lost || programs.get(key) !== e) return;
            e.program = link(gl, frag);
            finish(e, e.program);
            schedule();
          });
      }
      if (wanted) needsDraw = true;
      schedule();
    };

    const resize = () => {
      let dpr = Math.min(window.devicePixelRatio || 1, cap) * base * quality;
      const area = cssW * cssH * dpr * dpr;
      if (area > MAX_PIXELS) dpr *= Math.sqrt(MAX_PIXELS / area);
      const w = Math.max(1, Math.round(cssW * dpr));
      const h = Math.max(1, Math.round(cssH * dpr));
      if (canvas.width === w && canvas.height === h) return false;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      return true;
    };

    const drawScene = (e: Entry, t: number, enter: number) => {
      if (!e.program || !e.locs) return;
      gl.useProgram(e.program);
      gl.uniform2f(e.locs.res, canvas.width, canvas.height);
      gl.uniform1f(e.locs.time, t);
      gl.uniform2f(e.locs.pointer, pointer.x, pointer.y);
      gl.uniform1f(e.locs.enter, enter);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    /** The frame as it stands: the current scene, and the iris over it mid-swap. */
    const paint = (now: number) => {
      if (!current) return;
      if (!begun) begun = now;
      const t = stoppedAt ?? (now - begun) / 1000;
      drawScene(current, t, Math.min(1, t / 1.6));
      if (!fade || !iris?.locs) return;
      const p = Math.min(1, (now - fade.start) / DISSOLVE_MS);
      gl.useProgram(iris.program);
      gl.uniform2f(iris.locs.res, canvas.width, canvas.height);
      gl.uniform2f(iris.locs.origin, fade.origin.x, fade.origin.y);
      gl.uniform1f(iris.locs.radius, -EDGE + ease(p) * (fade.far + 2 * EDGE));
      gl.uniform1f(iris.locs.grain, (now - fade.start) / 1000);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.disable(gl.BLEND);
    };

    // Read straight back out of the drawing buffer, in the same task that
    // drew it: until this task ends the buffer still holds the frame.
    const freeze = () => {
      const w = canvas.width;
      const h = canvas.height;
      if (w !== frozenW || h !== frozenH) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        frozenW = w;
        frozenH = h;
      }
      gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, w, h);
    };

    const swap = (now: number) => {
      const next = programs.get(want);
      if (!next || next.status !== "ready") return;
      if (next === current) {
        // Back to the scene already loaded, after a failed one hid the canvas.
        if (!shown) {
          setShown(true);
          needsDraw = true;
        }
        return;
      }
      if (current && shown && !reduce && !paused && !instant && iris?.locs) {
        // The old scene one last time, exactly as it stands (an interrupted
        // iris included), frozen, then opened from the origin.
        paint(now);
        freeze();
        const origin = io.props().origin ?? CENTRE;
        const asp = canvas.width / canvas.height;
        const far = Math.max(
          ...[0, 1].flatMap((cx) => [0, 1].map((cy) => Math.hypot((cx - origin.x) * asp, cy - origin.y))),
        );
        fade = { start: now, origin, far };
      } else fade = null;
      current = next;
      next.used = ++clock;
      begun = now;
      // Chosen while paused: the scene comes in at rest, and plays on from there.
      if (paused) stoppedAt = 2;
      instant = false;
      needsDraw = true;
      if (!shown) setShown(true);
    };

    // Give up resolution rather than frames; see ShaderStage. At the floor,
    // frames that stay slow give up the visit's WebGL (a demotion to lite).
    const pace = (now: number) => {
      if (lastFrame && quality > 0.5) {
        slow = now - lastFrame > SLOW_MS ? slow + 1 : 0;
        if (slow >= 3) {
          quality = Math.max(0.5, quality * 0.72);
          slow = 0;
        }
      } else if (lastFrame && slowAtFloor(now - lastFrame)) demote();
      lastFrame = now;
    };

    const frame = (now: number) => {
      raf = 0;
      if (lost) return;
      const still = reduce || paused;
      if (!still) pace(now);
      // The governor may have demoted the visit, and this context with it.
      if (lost) return;
      poll();
      // Reduced motion draws the pointer where it is, never easing toward
      // it; a paused scene keeps it where it stopped.
      if (!paused) {
        const k = reduce ? 1 : 0.06;
        pointer.x += (pointer.tx - pointer.x) * k;
        pointer.y += (pointer.ty - pointer.y) * k;
      }
      if (resize()) needsDraw = true;
      swap(now);
      if (current && shown && (needsDraw || !still)) {
        // Reduced motion: one composed frame per scene, the scene at rest.
        if (reduce) drawScene(current, 2, 1);
        else paint(now);
        needsDraw = false;
        if (fade && now - fade.start >= DISSOLVE_MS) fade = null;
        if (!fade && current.key === want) settle(want);
      }
      schedule();
    };

    // A frame is asked for only while the stage is on screen and the tab is
    // visible, and then only for a reason: a scene to play, a swap to make,
    // a still frame to redraw, or a parallel compile to ask after.
    function schedule() {
      if (raf || dead || lost || !onScreen || document.hidden) return;
      const next = programs.get(want);
      const compiling =
        !!par && (iris?.locs === null || [...programs.values()].some((e) => e.status === "compiling"));
      const swapDue = next?.status === "ready" && (next !== current || !shown);
      const drawDue = !!current && shown && (!(reduce || paused) || needsDraw);
      if (compiling || swapDue || drawDue) raf = requestAnimationFrame(frame);
    }

    // A dissolve nobody is watching is simply over.
    const pause = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      lastFrame = 0;
      slow = 0;
      fade = null;
    };

    const ro = new ResizeObserver(([e]) => {
      const box = e.contentBoxSize?.[0];
      const w = box ? box.inlineSize : canvas.clientWidth;
      const h = box ? box.blockSize : canvas.clientHeight;
      if (w < 1 || h < 1) return;
      cssW = w;
      cssH = h;
      needsDraw = true;
      schedule();
    });
    ro.observe(canvas);

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      pointer.tx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      pointer.ty = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    };
    const onLost = (e: Event) => {
      e.preventDefault();
      lost = true;
      broken = true;
      pause();
      setShown(false);
    };
    // The pixel ratio can change without the box changing (a window dragged
    // to another monitor); resizing the buffer clears it, so redraw.
    const onWindow = () => {
      needsDraw = true;
      schedule();
    };
    canvas.addEventListener("pointermove", onMove, { passive: true });
    canvas.addEventListener("webglcontextlost", onLost);
    window.addEventListener("resize", onWindow, { passive: true });

    // Without the extension the iris is linked here, inside the idle
    // callback that made the context; it is a few lines of GLSL.
    if (!par) poll();

    return {
      ensure,
      schedule,
      pause,
      restart() {
        pause();
        needsDraw = true;
        schedule();
      },
      hold(on) {
        const now = performance.now();
        if (on) stoppedAt = current && begun ? (now - begun) / 1000 : 2;
        else if (stoppedAt !== null) {
          begun = now - stoppedAt * 1000;
          stoppedAt = null;
        }
        // Stopped mid-dissolve, the new scene is simply there.
        fade = null;
        lastFrame = 0;
        slow = 0;
        needsDraw = true;
        schedule();
      },
      destroy() {
        pause();
        ro.disconnect();
        canvas.removeEventListener("pointermove", onMove);
        canvas.removeEventListener("webglcontextlost", onLost);
        window.removeEventListener("resize", onWindow);
        for (const e of programs.values()) drop(e);
        if (iris) gl.deleteProgram(iris.program);
        gl.deleteTexture(frozen);
        gl.deleteBuffer(buf);
        gl.deleteVertexArray(vao);
        if (!lost) gl.getExtension("WEBGL_lose_context")?.loseContext();
        // Nothing asks this context for a frame again, from the loop or outside it.
        lost = true;
      },
    };
  }

  const view = new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    if (onScreen) gpu?.schedule();
    else gpu?.pause();
  });
  view.observe(host);

  const onVisibility = () => (document.hidden ? gpu?.pause() : gpu?.schedule());
  document.addEventListener("visibilitychange", onVisibility);

  // Once the stage is near and the device tier is known, the first scene's
  // module is fetched; the context waits for intent and then idle, because
  // the first compile is a long task on ANGLE/D3D and must not land in
  // anyone's first paint. A posters-only tier stops at the poster.
  const near = new IntersectionObserver(
    ([e]) => {
      if (!e.isIntersecting) return;
      near.disconnect();
      void whenTierSettled()
        .then(() => {
          if (dead) return;
          request(want);
          if (!flat()) return whenIntent();
        })
        .then(() => {
          if (dead || flat() || gpu || broken) return;
          cancelIdle = whenIdle(() => {
            cancelIdle = undefined;
            if (!dead && !flat()) create();
          });
        });
    },
    { rootMargin: "40% 0px" },
  );
  near.observe(host);

  // A demotion to lite (or reduced motion switched on) mid-visit: the
  // context goes and the posters take over, the current scene's on show.
  const offTier = onTierChange(() => {
    if (dead || !flat()) return;
    cancelIdle?.();
    cancelIdle = undefined;
    gpu?.destroy();
    gpu = null;
    broken = true;
    request(want);
  });

  return {
    commit(key) {
      if (dead || key === want) return;
      want = key;
      owed = key;
      instant = !onScreen || document.hidden;
      request(key);
    },
    prepare(key) {
      // Hover prefetch is a full-tier luxury: a mid device compiles on the click.
      if (dead || getTier() !== "full") return;
      fetchScene(key).then((scene) => {
        if (scene && !dead) gpu?.ensure(key, scene, false);
      });
    },
    setReduce(next) {
      if (next === reduce) return;
      reduce = next;
      gpu?.restart();
    },
    setPaused(next) {
      if (next === paused) return;
      paused = next;
      gpu?.hold(next);
    },
    destroy() {
      dead = true;
      offTier();
      near.disconnect();
      view.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      cancelIdle?.();
      gpu?.destroy();
      gpu = null;
    },
  };
}

type Layers = { under: string; over: string; alt: string; fade: boolean };

export function TradeStage({
  sceneKey,
  load,
  posters,
  initialPoster,
  initialAlt,
  origin,
  paused = false,
  className,
  onSettled,
  ref,
}: {
  sceneKey: string;
  /** Must be a module-level (stable) function; it is read, not depended on. */
  load: SceneLoader;
  /**
   * Every scene's poster and alt, built on the server: what a lite or still
   * device shows instead of the scenes, without importing a single one.
   * Read when needed; a key missing from it gets the house poster.
   */
  posters?: ScenePosters;
  /** The first scene's poster, rendered on the server so it paints first. */
  initialPoster?: string;
  initialAlt?: string;
  /** 0..1, y up: where the iris opens from on the NEXT swap. Centre by default. */
  origin?: Origin;
  /** Holds the scene still (WCAG 2.2.2): one settled frame, then none until unpaused. */
  paused?: boolean;
  className?: string;
  /** Called once the committed scene is on screen and at rest (or its poster is, without WebGL). */
  onSettled?(key: string): void;
  ref?: Ref<TradeStageHandle>;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const reduce = usePrefersReducedMotion();
  const [layers, setLayers] = useState<Layers>(() => ({
    under: "none",
    over: initialPoster ?? HOUSE_POSTER,
    alt: initialAlt ?? "",
    fade: false,
  }));

  const latest = useRef({ sceneKey, load, posters, initialPoster, initialAlt, origin, onSettled });
  useEffect(() => {
    latest.current = { sceneKey, load, posters, initialPoster, initialAlt, origin, onSettled };
  });

  // Built once for the component's life: one context, never keyed and
  // never re-created. Everything that changes reaches it through `latest`
  // or through the calls below.
  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const stage = createStage(host, canvas, latest.current.sceneKey, {
      props: () => latest.current,
      show: (poster, alt, fade) =>
        setLayers((l) =>
          l.over === poster
            ? l.alt === alt
              ? l
              : { ...l, alt, fade: false }
            : { under: l.over, over: poster, alt, fade },
        ),
    });
    stageRef.current = stage;
    return () => {
      stage.destroy();
      stageRef.current = null;
    };
  }, []);

  useEffect(() => {
    stageRef.current?.commit(sceneKey);
  }, [sceneKey]);

  useEffect(() => {
    stageRef.current?.setReduce(reduce);
  }, [reduce]);

  useEffect(() => {
    stageRef.current?.setPaused(paused);
  }, [paused]);

  useImperativeHandle(ref, () => ({ prepare: (key: string) => stageRef.current?.prepare(key) }), []);

  // The new poster fades in over the old one, which stays opaque beneath it,
  // so the crossfade never dips toward whatever is behind the stage. Before
  // paint, so the new layer is never seen at full strength first.
  useLayoutEffect(() => {
    const el = overRef.current;
    if (!el || !layers.fade) return;
    for (const a of el.getAnimations()) a.cancel();
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380, easing: "cubic-bezier(.22,1,.36,1)" });
  }, [layers]);

  return (
    <div ref={hostRef} className={cn("relative", className)}>
      <div aria-hidden className="absolute inset-0" style={{ background: layers.under }} />
      <div ref={overRef} aria-hidden className="absolute inset-0" style={{ background: layers.over }} />
      <canvas ref={canvasRef} className="absolute inset-0 block size-full" role="img" aria-label={layers.alt} />
    </div>
  );
}
