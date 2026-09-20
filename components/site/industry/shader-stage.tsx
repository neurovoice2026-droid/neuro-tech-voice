"use client";

import { useEffect, useRef, useState } from "react";
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
 *    scroll, key) or seven seconds in — shader compilation is a long
 *    task on ANGLE/D3D and it must never land inside the first paint;
 *  · the loop runs only while the stage is on screen and the tab is
 *    visible, and stops dead otherwise;
 *  · resolution is capped, and capped harder on a phone, so a mid-range
 *    Android is filling a fraction of the pixels a desktop is;
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
const HOUSE_INK = "#551a89";

/** Violet on paper: the site's own hand, for a band with no scene yet. */
const HOUSE_POSTER =
  "radial-gradient(120% 90% at 20% 15%, #ffffff 0%, #f4f3f7 45%, #e4e0ee 75%, #cfc6e4 100%)";

const VERT = `#version 300 es
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
function guarded(frag: string) {
  return `${frag.replace("void main(", "void sceneMain(")}
void main(){
  sceneMain();
  float gy = gl_FragCoord.y / uRes.y;
  fragColor.rgb = mix(fragColor.rgb, uColors[3], smoothstep(0.30, 0.17, gy));
}`;
}

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
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
      ([e]) => {
        if (!e.isIntersecting) return;
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

    // Compiling costs a long task, so it waits for the first sign that a
    // human is here rather than racing the first paint.
    whenIntent().then(() => {
      if (cancelled) return;
      cancelIdle = whenIdle(() => {
        if (!cancelled) teardown = start(canvas, scene, still);
      });
    });

    return () => {
      cancelled = true;
      cancelIdle?.();
      teardown?.();
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
  if (!gl) {
    canvas.style.display = "none";
    return;
  }

  let program: WebGLProgram;
  try {
    program = gl.createProgram()!;
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, guarded(`${SCENE_CONTRACT}\n${scene.frag}`)));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "link failed");
  } catch {
    // A scene that will not compile is a scene the reader never learns
    // about: the poster was already underneath it.
    canvas.style.display = "none";
    return;
  }

  gl.useProgram(program);
  const buf = gl.createBuffer();
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

  /*
    Three tiers, because a tablet is neither of the other two: it has a
    desktop's pixel count and a phone's power budget, and treating it as a
    small desktop is how a raymarched band ends up at eight frames a second
    on an iPad.

      uTier 0.0  phone    24 march steps, no shadow ray
      uTier 0.5  tablet   36 march steps, no shadow ray
      uTier 1.0  desktop  48 march steps, one shadow ray
  */
  const wide = window.matchMedia("(min-width: 1024px)").matches;
  const phone = window.matchMedia("(max-width: 767px)").matches;
  const tier = phone ? 0 : wide ? 1 : 0.5;
  const cap = phone ? 1.2 : tier === 0.5 ? 1.5 : 2;
  const base = phone ? 0.62 : tier === 0.5 ? 0.8 : 1;

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
    is indistinguishable anyway.
  */
  const MAX_PIXELS = 1_500_000;
  const SLOW_MS = 26;
  let quality = 1;

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
    if (!begun) begun = now;
    // Give up resolution rather than frames. Three slow frames in a row is a
    // machine telling us it cannot afford this, and 0.72 either side of the
    // floor halves the fragment count in two steps.
    if (lastFrame && quality > 0.5) {
      const delta = now - lastFrame;
      slow = delta > SLOW_MS ? slow + 1 : 0;
      if (slow >= 3) {
        quality = Math.max(0.5, quality * 0.72);
        slow = 0;
      }
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
    if (!raf && onScreen && !still && !document.hidden) raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };

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

  const onView = new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
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
  const onLost = (e: Event) => {
    e.preventDefault();
    stop();
    canvas.style.display = "none";
  };

  document.addEventListener("visibilitychange", onVisibility);
  // Passive, and on the stage rather than the window: a scene reacts to a
  // pointer that is actually over it.
  canvas.addEventListener("pointermove", onMove, { passive: true });
  canvas.addEventListener("webglcontextlost", onLost);
  // Resizing the buffer clears it, so a still scene redraws rather than
  // going blank when only the pixel ratio changes (a window dragged to
  // another monitor), which the size observer does not see.
  const onResize = () => (still ? frame(performance.now()) : resize());
  window.addEventListener("resize", onResize, { passive: true });
  play();

  return () => {
    stop();
    onView.disconnect();
    onSize.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("webglcontextlost", onLost);
    window.removeEventListener("resize", onResize);
    gl.deleteProgram(program);
    gl.deleteBuffer(buf);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  };
}
