"use client";

import { useEffect, useRef, useState } from "react";
import {
  FAST_MS,
  SLOW_MS,
  frameCadence,
  gpuIsWeak,
  isForced,
  onTierChange,
  slowFrames,
  whenTierSettled,
} from "../product/device-tier";
import { whenIdle, whenIntent } from "../product/motion-kit";
import { loadScene } from "./scenes";
import { usePrefersReducedMotion } from "../product/timing";

/* ------------------------------------------------------------------ *
 * The signature stage.
 *
 * One WebGL2 context, one full-screen triangle, and a fragment shader
 * per trade. The art lives entirely on the GPU: a scene is a few
 * kilobytes of GLSL rather than a mesh library, which is the only way
 * sixteen bespoke animations can exist on a site whose mobile LCP is
 * already its weakest number. three.js would have cost more on the first
 * load than every one of these scenes costs in total.
 *
 * Everything here exists to make that free until it is wanted:
 *
 *  · the scene module is dynamically imported, so only the trade you are
 *    looking at is ever fetched, and only once the stage is near;
 *  · the context is created on the first real intent (pointer, touch,
 *    scroll, key) or a few seconds after load, and only once the device
 *    check has had its say: weak hardware (device-tier's hard "lite")
 *    never creates one at all and keeps the poster;
 *  · with KHR_parallel_shader_compile the driver compiles on its own
 *    threads and the stage asks once a frame whether it is done, so the
 *    compile never holds the main thread; without it the compile waits
 *    for an idle moment, as it always did;
 *  · the loop runs only while the stage is on screen and the tab is
 *    visible, and stops dead otherwise;
 *  · resolution is capped, and capped harder on a phone, so a mid-range
 *    Android is filling a fraction of the pixels a desktop is; a GPU still
 *    slow at the lowest resolution gives the band back to its poster;
 *  · reduced motion draws exactly one frame and stops, so the scene is
 *    a still picture rather than an absence;
 *  · no WebGL, a failed compile, or a lost context all fall back to the
 *    CSS poster underneath, which is what paints first in every case.
 *
 * COLOUR. The environment is the site's; the object is its own.
 *
 * `uColors` and `uInk` are the ground the scene stands on — the backdrop,
 * the floor, the haze, the shadows. Those stay on the house palette, which
 * is what keeps sixteen bands reading as one website.
 *
 * The OBJECT may use its real materials, written as literals in the shader:
 * cast iron is grey, brass is brass, a nursery block is painted primary,
 * wax is red. Restraint is the rule — two or three material colours in a
 * scene, chosen because the thing really is that colour, never because a
 * frame looked empty.
 *
 * AND WHAT A MIRROR SEES IS A STUDIO, NOT THE WALL. A polished surface has
 * almost no colour of its own: it is whatever is around it. Point one at a
 * violet backdrop and a chrome desk bell renders as a purple ball — which
 * is what happened, and it was the brief's own rule that did it. So a
 * reflective material may sample a NEUTRAL studio environment — a dark
 * floor, a bright overhead sweep, a warm key and a cool fill — exactly as
 * a photographer would light it, even while the backdrop behind the object
 * stays the house palette. Chrome reads as chrome or it reads as plastic;
 * there is no third option.
 * ------------------------------------------------------------------ */

export type Scene = {
  /** GLSL ES 3.00 fragment shader. See SCENE_CONTRACT below. */
  frag: string;
  /** Four colours, darkest to lightest. Bound to uColors[4]. */
  colors: readonly [string, string, string, string];
  /** A CSS background that paints before — and instead of — the canvas. */
  poster: string;
  /** What the scene is, for anyone who cannot see it. */
  alt: string;
};

/**
 * What every scene may rely on, and nothing else:
 *
 *   uniform vec2  uRes      pixel size of the drawing buffer
 *   uniform float uTime     seconds since the scene started, never reset
 *   uniform vec2  uPointer  eased pointer in 0..1, (0.5,0.5) until touched
 *   uniform float uEnter    0 -> 1 over the first 1.6s, once
 *   uniform vec3  uColors[4]
 *   uniform float uTier     1.0 desktop, 0.5 tablet, 0.0 phone
 *   out vec4 fragColor
 *
 * A scene MAY raymarch. The budget, not a ban:
 *   · one march per fragment, and the step count comes off the tier:
 *     `int steps = uTier > 0.75 ? 48 : uTier > 0.25 ? 36 : 24;`
 *   · at most one extra short march for a shadow or a bounce, 16 steps, and
 *     only on the desktop tier (`uTier > 0.75`)
 *   · always break on a hit and on a far plane; never march to the cap
 *   · no nested marches, no marched reflections of marched reflections
 */
export const SCENE_CONTRACT = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uPointer;
uniform float uEnter;
uniform vec3 uColors[4];
uniform vec3 uInk;
uniform float uTier;
out vec4 fragColor;`;

/** The site's accent, and the darkest colour any scene may draw with. */
export const HOUSE_INK = "#551a89";

/** Violet on paper: the site's own hand, for a band with no scene yet. */
export const HOUSE_POSTER =
  "radial-gradient(120% 90% at 20% 15%, #ffffff 0%, #f4f3f7 45%, #e4e0ee 75%, #cfc6e4 100%)";

/*
  Two brakes on the raymarched scenes, because a step budget alone is not
  a guarantee. A step budget bounds the work per FRAGMENT; it says nothing
  about how many fragments there are, and this band is full-bleed — on a
  2560px monitor at devicePixelRatio 2 it would otherwise ask a GPU for
  eleven million marched fragments a frame.

  MAX_PIXELS bounds the area outright, whatever the screen.
  Then `quality` watches the real frame time and gives up resolution until
  the frames come back. It only ever degrades: a loop that also climbs back
  up oscillates, and a band of soft colour at three quarters of the pixels
  is indistinguishable anyway. The one way back is frameCadence()'s: a
  floor that brought no faster frames gave up the pixels for nothing.
*/
export const MAX_PIXELS = 1_500_000;
// The frame-time judgement every GPU loop shares (the cover portrait too), so
// it lives in device-tier, which the cover already loads: see frameCadence().
export { FAST_MS, SLOW_MS, frameCadence };
/** Frames at the lowest resolution, and after a pause, left unjudged. */
const FLOOR_GRACE = 10;
/** Judged frames after which a lone slow verdict is forgotten. */
const FLOOR_FORGET = 30;

/*
  Three tiers, because a tablet is neither of the other two: it has a
  desktop's pixel count and a phone's power budget, and treating it as a
  small desktop is how a raymarched band ends up at eight frames a second
  on an iPad.

    uTier 0.0  phone    24 march steps, no shadow ray
    uTier 0.5  tablet   36 march steps, no shadow ray
    uTier 1.0  desktop  48 march steps, one shadow ray
*/
export function stageTier(): { tier: 0 | 0.5 | 1; cap: number; base: number } {
  const wide = window.matchMedia("(min-width: 1024px)").matches;
  const phone = window.matchMedia("(max-width: 767px)").matches;
  const tier = phone ? 0 : wide ? 1 : 0.5;
  const cap = phone ? 1.2 : tier === 0.5 ? 1.5 : 2;
  const base = phone ? 0.62 : tier === 0.5 ? 0.8 : 1;
  return { tier, cap, base };
}

export const VERT = `#version 300 es
in vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

/**
 * The floor, applied to every scene whether its author remembered or not.
 *
 * A line of black text sits over the bottom of this band. Leaving that to
 * each scene produced four different percentage veils, all tuned on a 21:9
 * screenshot and all failing on a 4:5 phone band where the bottom third is
 * a much larger share of the picture. So the scene's own main() is renamed
 * and called from ours, and the cut is made here: paper below 0.17 of the
 * height, released by 0.30, at every aspect ratio. An out variable can be
 * read back after it is written, which is what makes this possible without
 * touching a single scene.
 */
export function guarded(frag: string) {
  return `${frag.replace("void main(", "void sceneMain(")}
void main(){
  sceneMain();
  float gy = gl_FragCoord.y / uRes.y;
  fragColor.rgb = mix(fragColor.rgb, uColors[3], smoothstep(0.30, 0.17, gy));
}`;
}

export function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(log ?? "compile failed");
  }
  return s;
}

/**
 * Compiles and links without asking how it went: asking is what blocks.
 * The shaders' own status is read only once the link has failed.
 */
function link(gl: WebGL2RenderingContext, frag: string) {
  const program = gl.createProgram();
  const shaders = [gl.VERTEX_SHADER, gl.FRAGMENT_SHADER].map((type, i) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, i ? frag : VERT);
    gl.compileShader(s);
    gl.attachShader(program, s);
    return s;
  });
  gl.linkProgram(program);
  return { program, shaders };
}

/** Whether the link worked, or null while the driver is still on it. */
function linked(gl: WebGL2RenderingContext, par: KHR_parallel_shader_compile | null, program: WebGLProgram) {
  if (par && !gl.getProgramParameter(program, par.COMPLETION_STATUS_KHR)) return null;
  return Boolean(gl.getProgramParameter(program, gl.LINK_STATUS));
}

export function ShaderStage({
  slug,
  className,
  load,
}: {
  slug: string;
  className?: string;
  /** A page outside the industry set supplies its own loader, so its scene
   *  never has to be registered in the trades' LOADERS map. Must be a
   *  module-level (stable) function: it is an effect dependency. */
  load?: () => Promise<Scene | null>;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scene, setScene] = useState<Scene | null>(null);
  const still = usePrefersReducedMotion();

  // Fetch the trade's scene only when the stage is getting close. The
  // loaders are named one by one in ./scenes/index.ts rather than matched
  // from a template, so a stray file in that folder cannot join the build
  // — it did once, and it took all sixteen pages down with it.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let live = true;
    const near = new IntersectionObserver(
      (entries) => {
        // The last entry is the stage as it is now. When the main thread is
        // busy, one callback can carry several (not near, then near), and
        // the first alone would read "not near" for good.
        if (!entries[entries.length - 1].isIntersecting) return;
        near.disconnect();
        (load ? load() : loadScene(slug))
          .then((s) => {
            if (live && s) setScene(s);
          })
          .catch(() => {
            /* The poster is the page's real artwork as far as the reader is
               concerned; a missing scene simply means it stays still. */
          });
      },
      { rootMargin: "40% 0px" },
    );
    near.observe(host);
    return () => {
      live = false;
      near.disconnect();
    };
  }, [slug, load]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !scene) return;

    let teardown: (() => void) | undefined;
    let cancelIdle: (() => void) | undefined;
    let cancelled = false;

    const stop = () => {
      cancelled = true;
      cancelIdle?.();
      teardown?.();
      teardown = undefined;
    };

    // A device found weak after the stage started (the GPU check can land
    // late) gives the band back to its poster, context and all.
    const off = onTierChange((t) => {
      if (t !== "lite") return;
      stop();
      canvas.style.display = "none";
    });

    // Compiling costs a long task, so it waits for the first sign that a
    // human is here rather than racing the first paint, and then for the
    // device check: weak hardware keeps the poster and never pays for a
    // compile it would throw away. Reduced motion is its own tier ("still")
    // and keeps its one composed frame, unless the GPU itself is weak.
    whenIntent()
      .then(whenTierSettled)
      .then((t) => {
        if (cancelled || t === "lite" || gpuIsWeak()) return;
        cancelIdle = whenIdle(() => {
          if (!cancelled) teardown = start(canvas, scene, still);
        });
      })
      .catch(() => {});

    return () => {
      off();
      stop();
    };
  }, [scene, still]);

  return (
    <div ref={hostRef} className={className}>
      {/* The poster is not a placeholder: it is what most readers on a
          slow phone will actually see, so it has to be worth seeing. The
          house fallback stands in while the scene is still on its way, and
          for good on a device that cannot run it — never an empty band. */}
      <div aria-hidden className="absolute inset-0" style={{ background: scene?.poster ?? HOUSE_POSTER }} />
      <canvas ref={canvasRef} className="absolute inset-0 block size-full" role="img" aria-label={scene?.alt ?? ""} />
    </div>
  );
}

function start(canvas: HTMLCanvasElement, scene: Scene, still: boolean) {
  const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: "low-power" });
  // A context that arrives already lost is one this canvas used before (a
  // remount, or reduced motion toggled): it will never draw again.
  if (!gl || gl.isContextLost()) {
    canvas.style.display = "none";
    return;
  }

  // Nothing is asked of the driver yet: with the parallel extension the
  // link finishes on the driver's threads, and the loop below starts on the
  // first frame that finds it done. The poster shows until then.
  const par = gl.getExtension("KHR_parallel_shader_compile");
  const { program, shaders } = link(gl, guarded(`${SCENE_CONTRACT}\n${scene.frag}`));

  let disposed = false;
  let waiting = 0;
  let loop: { stop: () => void } | null = null;
  let buf: WebGLBuffer | null = null;

  const onLost = (e: Event) => {
    e.preventDefault();
    cancelAnimationFrame(waiting);
    loop?.stop();
    canvas.style.display = "none";
  };
  canvas.addEventListener("webglcontextlost", onLost);

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(waiting);
    loop?.stop();
    canvas.removeEventListener("webglcontextlost", onLost);
    for (const s of shaders) gl.deleteShader(s);
    gl.deleteProgram(program);
    if (buf) gl.deleteBuffer(buf);
    if (!gl.isContextLost()) gl.getExtension("WEBGL_lose_context")?.loseContext();
  };

  const ready = () => {
    // A lost context answers nothing, and would be asked forever.
    if (disposed || gl.isContextLost()) return;
    const ok = linked(gl, par, program);
    if (ok === null) {
      waiting = requestAnimationFrame(ready);
      return;
    }
    if (!ok) {
      // A scene that will not compile is a scene the reader never learns
      // about: the poster was already underneath it. Only now is it worth
      // asking why, for whoever is looking at the console.
      if (process.env.NODE_ENV !== "production") {
        for (const s of shaders) {
          if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(s));
        }
        console.warn(gl.getProgramInfoLog(program));
      }
      canvas.style.display = "none";
      dispose();
      return;
    }
    // Only flagged while attached; they go with the program.
    for (const s of shaders) gl.deleteShader(s);
    shaders.length = 0;
    buf = gl.createBuffer();
    loop = run(gl, canvas, program, buf, scene, still, () => {
      // Still slow at the lowest resolution: this GPU cannot afford the
      // scene. The band fades back to its poster, and only this band: the
      // rest of the visit keeps its tier.
      canvas.style.transition = "opacity 600ms ease";
      canvas.style.opacity = "0";
      window.setTimeout(() => {
        if (disposed) return;
        dispose();
        canvas.style.display = "none";
      }, 650);
    });
  };

  // Without the extension, asking is the compile: it runs here, in the
  // idle moment this was called in, as it always did.
  ready();
  return dispose;
}

/** The draw loop over a linked program. `giveUp` is called at most once. */
function run(
  gl: WebGL2RenderingContext,
  canvas: HTMLCanvasElement,
  program: WebGLProgram,
  buf: WebGLBuffer,
  scene: Scene,
  still: boolean,
  giveUp: () => void,
) {
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(program, "uRes");
  const uTime = gl.getUniformLocation(program, "uTime");
  const uPointer = gl.getUniformLocation(program, "uPointer");
  const uEnter = gl.getUniformLocation(program, "uEnter");
  const uTier = gl.getUniformLocation(program, "uTier");
  gl.uniform3fv(gl.getUniformLocation(program, "uColors"), new Float32Array(scene.colors.flatMap(hexToRgb)));
  // The house violet is bound separately and unconditionally. A scene whose
  // ink slot is ember had nothing dark and legal to rule a line with, and one
  // of them solved that by multiplying a mid tone down to a near-black that
  // no mix of its palette could reach. This is the colour it wanted.
  gl.uniform3fv(gl.getUniformLocation(program, "uInk"), new Float32Array(hexToRgb(HOUSE_INK)));

  // The tier, pixel-ratio cap and base scale; see stageTier() above.
  const { tier, cap, base } = stageTier();

  // Adaptive resolution under MAX_PIXELS and SLOW_MS, judged against the
  // display's own cadence; see above.
  let quality = 1;
  const cadence = frameCadence();
  // Judges the frames once quality is at its floor, and gives the band back
  // to its poster only on a verdict it gets twice running: a burst of the
  // page's own work (a section rendering as it scrolls in) is one verdict at
  // most, a GPU that cannot keep up is every one. The first frames at the
  // floor, and after every pause, are the switch's and are not judged. All
  // of it is off under a forced tier.
  const slowAtFloor = isForced() ? null : slowFrames();
  let grace = FLOOR_GRACE;
  let verdicts = 0;
  let sinceVerdict = 0;
  let gaveUp = false;

  let raf = 0;
  let onScreen = true;
  let begun = 0;
  const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };

  // The canvas's CSS size, kept by an observer rather than read in the
  // loop: clientWidth inside a rAF forces a synchronous layout whenever
  // anything else on the page has dirtied it that frame — and the call
  // rail two sections down re-renders on every frame of its playback.
  let cssW = Math.max(1, canvas.clientWidth);
  let cssH = Math.max(1, canvas.clientHeight);

  const resize = () => {
    let dpr = Math.min(window.devicePixelRatio || 1, cap) * base * quality;
    const cw = cssW;
    const ch = cssH;
    // Area first, then whatever the tier and the adaptive step allow.
    const area = cw * ch * dpr * dpr;
    if (area > MAX_PIXELS) dpr *= Math.sqrt(MAX_PIXELS / area);
    const w = Math.max(1, Math.round(cw * dpr));
    const h = Math.max(1, Math.round(ch * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  };

  let lastFrame = 0;
  let slow = 0;

  const frame = (now: number) => {
    raf = 0;
    if (!begun) begun = now;
    // Give up resolution rather than frames. Three slow frames in a row is a
    // machine telling us it cannot afford this, and 0.72 either side of the
    // floor halves the fragment count in two steps.
    if (lastFrame && quality > 0.5) {
      const delta = now - lastFrame;
      slow = cadence.slow(delta) ? slow + 1 : 0;
      cadence.read(delta, false);
      if (slow >= 3) {
        cadence.stepped(quality === 1);
        quality = Math.max(0.5, quality * 0.72);
        slow = 0;
      }
    } else if (lastFrame && !still && cadence.read(now - lastFrame, true)) {
      // The floor came no faster than full did: the display's cadence is
      // the limit, not the GPU, so the pixels come back (frameCadence).
      quality = 1;
      slow = 0;
      cadence.stepped();
    } else if (lastFrame && !still && slowAtFloor) {
      if (grace > 0) grace--;
      else if (!slowAtFloor(now - lastFrame)) {
        if (++sinceVerdict > FLOOR_FORGET) verdicts = 0;
      } else if (++verdicts >= 2) {
        // At the floor and still slow: nothing left to give but the scene.
        gaveUp = true;
        stop();
        giveUp();
        return;
      } else sinceVerdict = 0;
    }
    lastFrame = now;
    const t = (now - begun) / 1000;
    pointer.x += (pointer.tx - pointer.x) * 0.06;
    pointer.y += (pointer.ty - pointer.y) * 0.06;
    resize();
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, t);
    gl.uniform2f(uPointer, pointer.x, pointer.y);
    gl.uniform1f(uEnter, Math.min(1, t / 1.6));
    gl.uniform1f(uTier, tier);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!still && onScreen) raf = requestAnimationFrame(frame);
  };

  const play = () => {
    if (raf || gaveUp || !onScreen || still || document.hidden) return;
    grace = FLOOR_GRACE;
    raf = requestAnimationFrame(frame);
  };
  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
    // The gap across a pause is the pause, not a frame: never judge it.
    lastFrame = 0;
  }

  // Reduced motion gets one composed frame — the scene at rest, not a
  // blank canvas over the poster.
  if (still) {
    pointer.x = pointer.tx;
    pointer.y = pointer.ty;
    frame(performance.now());
    // uEnter is 0 on the first frame, so draw the settled state too.
    begun = performance.now() - 2000;
    frame(performance.now());
  }

  const onView = new IntersectionObserver((entries) => {
    // The last entry, not the first: at a few frames a second one callback
    // can carry "off screen" and then "on screen", and reading the first
    // stopped the loop with the stage in full view, for good.
    onScreen = entries[entries.length - 1].isIntersecting;
    if (onScreen) play();
    else stop();
  });
  onView.observe(canvas);

  const onSize = new ResizeObserver(([e]) => {
    const box = e.contentBoxSize?.[0];
    cssW = Math.max(1, box ? box.inlineSize : canvas.clientWidth);
    cssH = Math.max(1, box ? box.blockSize : canvas.clientHeight);
    // A still scene has no loop to pick the new size up.
    if (still) frame(performance.now());
  });
  onSize.observe(canvas);

  const onVisibility = () => (document.hidden ? stop() : play());
  const onMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    pointer.tx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    pointer.ty = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
  };

  document.addEventListener("visibilitychange", onVisibility);
  // Passive, and on the stage rather than the window: a scene reacts to a
  // pointer that is actually over it.
  canvas.addEventListener("pointermove", onMove, { passive: true });
  // Resizing the buffer clears it, so a still scene redraws rather than
  // going blank when only the pixel ratio changes (a window dragged to
  // another monitor), which the size observer does not see.
  const onResize = () => (still ? frame(performance.now()) : resize());
  window.addEventListener("resize", onResize, { passive: true });
  play();

  return {
    stop: () => {
      gaveUp = true;
      stop();
      onView.disconnect();
      onSize.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", onResize);
    },
  };
}
