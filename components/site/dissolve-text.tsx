"use client";

import { useEffect, useRef, type ElementType } from "react";
import {
  COVER_FLOW,
  COVER_NOISE_GLSL,
  COVER_NOISE_SKEW,
  COVER_WARP_SUBJECTS,
  coverDissolveAt,
} from "./cover-noise";

/**
 * A heading carrying the cover's dissolve.
 *
 * The portrait's effect is not a transition, it is a state: the figure
 * comes apart and puts itself back together, over and over, on a
 * twelve-second raised cosine, forever. That cycle IS the effect — the
 * churn alone is just fuzz, and the return to whole is what makes the
 * coming-apart read as an event. So the headings run it too: the same
 * eight-octave domain-warped fbm, the same 0.25 y-skew that makes the
 * shred vertical, the same drift, the same physical noise rate
 * (COVER_NOISE_PER_PX), the same throw (COVER_WARP_SUBJECTS), and the
 * same `coverDissolveAt` on the same shared clock, so all four breathe in
 * phase rather than each on its own timer.
 *
 * An earlier version of this file ran the cycle once on scroll and then
 * handed the crisp DOM text back, on the reasoning that a heading is text
 * someone has to read and text that periodically liquefies is a defect.
 * That was the wrong call to make unilaterally: it is a real trade, but it
 * is the author's to make, not this component's, and what it produced was
 * a different effect that merely shared a texture. The cycle is the brief.
 *
 * Two things it still does not copy, for reasons of substance rather than
 * taste:
 *
 *  · No depth raymarch. Type is flat; there is nothing to occlude.
 *  · No eye guard. The portrait exempts the eyes so one part of the face
 *    keeps holding together; type has no equivalent feature to spare, and
 *    sparing an arbitrary band would read as a rectangle of clean text.
 *
 * The <h*> element is the real text throughout — it carries the layout,
 * the line breaking and the accessibility tree, and the canvas is only
 * ever an `aria-hidden` skin over it. Reduced motion never builds the
 * skin at all and gets plain, still type.
 */

const VERT = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uText;
uniform vec2  uSize;      // canvas size, device px
uniform float uSubject;   // the type's own solid dimension, device px
uniform vec2  uSkew;      // [1.0, 0.25] — the vertical anisotropy
uniform float uTime;      // already scaled by the animated speed
uniform float uDissolve;  // 1 fully torn -> 0 whole
uniform float uWarpPx;    // peak displacement, device px
uniform vec3  uBrand;     // the cover's pigment

${COVER_NOISE_GLSL}

void main() {
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);

  /* The cover's domain, measured the way the cover measures it: pixels
     divided by the SUBJECT, times 1.7806. That last number is the
     portrait's, and dividing by the subject is the whole point — the head
     spans 1.78 noise units, so the texture you see comes out of octaves
     three to six.

     Scaling by a fixed rate per pixel instead (which is what this did
     first, and it was wrong) makes the noise the same physical size
     everywhere — but type is an order of magnitude smaller than a head, so
     a heading then fits inside a tenth of ONE noise cell, the low octaves
     merely slide it around bodily, and everything you actually see comes
     from octaves seven and eight. Those are the sub-pixel ones. The result
     is a crumbly scribble instead of long vertical filaments: the same
     noise, sampled in the wrong octave band. Measuring against the subject
     puts the type in the same band as the face. */
  vec2 st = (uv * uSize / uSubject) * 1.7806 * uSkew;
  vec2 drift = vec2(0.0, uTime * 0.005);
  float t = uTime * 0.025;

  // fbm of fbm, exactly the cover's combination.
  vec2 r = vec2(
    fbm(vec3(st - drift + vec2(1.7, 9.2), t)),
    fbm(vec3(st - drift + vec2(8.2, 1.3), t))
  );
  float f = fbm(vec3(st + r - drift, t)) * 0.35;
  vec2 fine = f * 2.0 + r * 0.35;

  vec2 warp = fine * uWarpPx * uDissolve / uSize;

  vec4 c = texture(uText, uv + warp);

  /* The cover's grade, verbatim: keep the pigment violet where the
     dissolve drags dark over light. On the portrait this is what stops the
     tear going grey; here it is what makes the filaments the cover's
     colour rather than plain paper smeared about. */
  float sat = max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b);
  c.rgb = mix(c.rgb, uBrand * (0.5 + dot(c.rgb, vec3(0.299, 0.587, 0.114)) * 1.5),
              0.10 * smoothstep(0.03, 0.30, sat));

  /* Dither, as the cover's dither layer. On a photograph it kills banding
     in the falloff; on type it keeps the thinnest filaments from stepping
     as they fade, which is the same job on different material. */
  vec3 h = fract(vec3(gl_FragCoord.xyx) * 0.1031 + fract(uTime * 0.5));
  h += dot(h, h.yzx + 33.33);
  c.rgb += (fract((h.x + h.y) * h.z) - 0.5) * 0.016;

  fragColor = c;
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error("[dissolve-text]", gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

/** One entry per line box the browser actually produced. */
type Line = { text: string; left: number; top: number };

/**
 * Read the element's real line breaks back off the layout.
 *
 * Re-wrapping the string in canvas-land with measureText would be the
 * obvious move and it is a trap: canvas and CSS disagree about
 * letter-spacing at line ends, about which characters are breakable, and
 * about hyphenation, so the skin would drift out of register with the
 * type it is standing in for. Instead every character is measured where
 * the browser already put it, and characters sharing a line-box top are
 * one line. Exact by construction, and cheap — a heading is forty-odd
 * ranges, measured once.
 */
function readLines(el: HTMLElement, node: Text): Line[] {
  const origin = el.getBoundingClientRect();
  const range = document.createRange();
  const lines: Line[] = [];
  let current: { top: number; left: number; chars: string[] } | null = null;

  const text = node.data;
  for (let i = 0; i < text.length; i++) {
    range.setStart(node, i);
    range.setEnd(node, i + 1);
    const rect = range.getClientRects()[0];
    // Collapsed whitespace at a break has no box — it belongs to neither
    // line, which is exactly how it should be drawn.
    if (!rect || rect.width === 0) continue;

    // Tops are compared with slack: sub-pixel layout puts glyphs on the
    // same visual line a fraction apart, and an exact match would split
    // one line into several.
    if (!current || Math.abs(rect.top - current.top) > 1) {
      if (current) lines.push(join(current));
      current = { top: rect.top, left: rect.left, chars: [text[i]] };
    } else {
      current.chars.push(text[i]);
      current.left = Math.min(current.left, rect.left);
    }
  }
  if (current) lines.push(join(current));

  function join(c: { top: number; left: number; chars: string[] }): Line {
    return {
      text: c.chars.join(""),
      left: c.left - origin.left,
      top: c.top - origin.top,
    };
  }

  range.detach();
  return lines;
}

export function DissolveText({
  text,
  className,
  as: Tag = "h3",
  /**
   * Scales the cover's own throw. 1 is the portrait's, measured against
   * the line height as this effect's subject — see COVER_WARP_SUBJECTS.
   * At the cover's full throw the heading genuinely comes apart at the
   * peak, which is the point: it is only there for a moment, and the
   * resolve is what makes the coming-apart read as an event rather than
   * as a blurry heading.
   */
  strength = 1,
  /**
   * Seconds for a whole -> apart -> whole cycle.
   *
   * The cover runs twelve, and it can: it is a poster you are looking at
   * anyway, so six seconds to come apart is a slow reveal rather than a
   * wait. Here the loop is on a hover, and the reader is holding the
   * pointer still to watch — six seconds of that is too long to ask for.
   * The curve, the noise, the throw and the churn rate are the cover's
   * untouched; only the envelope's period is shorter.
   */
  cycle = 4,
  /**
   * Play one cycle unprompted when it scrolls into view.
   *
   * True for the feature headings, which announce themselves. False for
   * anything that should stay quiet until pointed at — which is also what
   * defers its WebGL context until first hover, and that is the difference
   * between four idle figures costing nothing and four idle figures
   * costing four contexts.
   */
  intro = true,
}: {
  text: string;
  className?: string;
  as?: ElementType;
  strength?: number;
  cycle?: number;
  intro?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const el = host.firstElementChild as HTMLElement | null;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let disposed = false;
    let cleanupGl: (() => void) | null = null;
    let startFn: (() => void) | null = null;
    let pauseFn: (() => void) | null = null;
    let hovering = false;

    /* The pointer owns the loop, so it also owns the WebGL context.
       `intro` decides only whether the plate ALSO plays one cycle
       unprompted on arrival. It matters more than it looks: with intro on,
       a context is built for every instance that has ever been scrolled
       past, and at ten of them on one page Chrome starts evicting
       contexts. Off, the context is not created until the reader actually
       points at the thing, so the four figures cost nothing until used. */
    const ensure = () => {
      if (!cleanupGl && !disposed) cleanupGl = run();
    };

    const onEnter = () => {
      hovering = true;
      ensure();
      startFn?.();
    };
    const onLeave = () => {
      hovering = false;
    };
    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointerleave", onLeave);

    /* Kept for the lifetime of the effect, not disconnected on first fire:
       it is the thing that pauses a loop scrolling away and resumes one
       scrolling back, so a cycle never churns over a page nobody is
       looking at. */
    const io = new IntersectionObserver(
      (entries) => {
        if (disposed) return;
        if (!entries[0].isIntersecting) {
          pauseFn?.();
          return;
        }
        if (intro) {
          ensure();
          startFn?.();
        } else if (cleanupGl && hovering) {
          startFn?.();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);

    /* Re-rasterise on resize. The skin used to be temporary, so a stale one
       simply never outlived the animation; now it is permanent, and a
       window resize reflows the heading underneath a texture cut for the
       old line breaks. Cheap because it only happens on resize. */
    let rebuildTimer = 0;
    const ro = new ResizeObserver(() => {
      if (disposed || !cleanupGl) return;
      window.clearTimeout(rebuildTimer);
      rebuildTimer = window.setTimeout(() => {
        if (disposed) return;
        cleanupGl?.();
        cleanupGl = run();
      }, 180);
    });
    ro.observe(el);

    function run(): (() => void) | null {
      const node = [...el!.childNodes].find(
        (n): n is Text => n.nodeType === Node.TEXT_NODE,
      );
      if (!node) return null;

      const lines = readLines(el!, node);
      if (!lines.length) return null;

      const cs = getComputedStyle(el!);
      const fontSize = parseFloat(cs.fontSize);
      const box = el!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      /* The throw, in CSS px. The subject here is the line height — the
         type's own solid dimension, the closest thing a heading has to the
         portrait's head-width — so the tear crosses a line of text by the
         same proportion it crosses the face. */
      const lineBox =
        cs.lineHeight === "normal" ? fontSize * 1.2 : parseFloat(cs.lineHeight);
      const throwPx = lineBox * COVER_WARP_SUBJECTS * strength;

      /* Room for the tear to throw filaments past the glyphs — clipped at
         the text's own bounds the effect reads as a blur along a straight
         edge instead of a shred.
         Sized against the throw the noise ACTUALLY reaches, not its
         nominal peak. `fine` is a sum of fbm terms that in practice lands
         around a fifth of its theoretical maximum, so padding for the peak
         wrapped every heading in a margin that was 80% of the canvas and
         shaded all of it at 24 Perlin evaluations a pixel, for nothing. */
      const pad = Math.ceil(throwPx * 0.5);
      const w = Math.ceil(box.width) + pad * 2;
      const h = Math.ceil(box.height) + pad * 2;
      if (w <= 0 || h <= 0) return null;

      /* --- rasterise the type ------------------------------------- */
      const tex2d = document.createElement("canvas");
      tex2d.width = Math.round(w * dpr);
      tex2d.height = Math.round(h * dpr);
      const ctx = tex2d.getContext("2d");
      if (!ctx) return null;
      ctx.scale(dpr, dpr);
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize}/${cs.lineHeight} ${cs.fontFamily}`;
      ctx.letterSpacing = cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing;
      ctx.fillStyle = cs.color;
      ctx.textBaseline = "alphabetic";

      // Sit the glyphs on the baseline the browser used: the line box is
      // taller than the font, and the extra is split above and below it.
      const m = ctx.measureText("Mg");
      const ascent = m.fontBoundingBoxAscent ?? fontSize * 0.8;
      const descent = m.fontBoundingBoxDescent ?? fontSize * 0.2;
      const lineHeight =
        cs.lineHeight === "normal" ? fontSize * 1.2 : parseFloat(cs.lineHeight);
      const halfLeading = (lineHeight - (ascent + descent)) / 2;

      for (const line of lines) {
        ctx.fillText(line.text, line.left + pad, line.top + pad + halfLeading + ascent);
      }

      /* --- the skin ----------------------------------------------- */
      const canvas = document.createElement("canvas");
      canvas.width = tex2d.width;
      canvas.height = tex2d.height;
      canvas.setAttribute("aria-hidden", "true");
      /* Positioned against the heading's own box, not the host's. The two
         usually coincide, but the heading carries a top margin and whether
         that margin collapses through the host depends on the host having
         no border, padding or BFC — conditions a future className could
         quietly break, sliding the skin off the type it is standing in for.
         Measuring the offset costs nothing and cannot drift. */
      const hostBox = host!.getBoundingClientRect();
      const dx = box.left - hostBox.left - pad;
      const dy = box.top - hostBox.top - pad;
      canvas.style.cssText = `position:absolute;left:${dx}px;top:${dy}px;width:${w}px;height:${h}px;pointer-events:none;`;

      const gl = canvas.getContext("webgl2", {
        antialias: false,
        alpha: true,
        premultipliedAlpha: false,
      });
      if (!gl) return null;

      const vs = compile(gl, gl.VERTEX_SHADER, VERT);
      const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
      if (!vs || !fs) return null;
      const prog = gl.createProgram();
      if (!prog) return null;
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        console.error("[dissolve-text]", gl.getProgramInfoLog(prog));
        return null;
      }
      gl.useProgram(prog);

      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tex2d);
      // CLAMP, so a UV pushed off the edge samples the transparent border
      // the padding provides rather than wrapping type in from the far side.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      const u = (n: string) => gl.getUniformLocation(prog, n);
      gl.uniform1i(u("uText"), 0);
      gl.uniform2f(u("uSize"), canvas.width, canvas.height);
      /* The subject. On the cover this is the blob around the head, about
         twice the head itself, so the head lands near one noise unit and
         the filaments fall in octaves three to six. A line of type is the
         equivalent solid here, so the subject is a line-height scaled by
         the same factor — that is what puts type in the cover's octave
         band instead of down among the sub-pixel ones. */
      gl.uniform1f(u("uSubject"), lineBox * 1.8 * dpr);
      gl.uniform2f(u("uSkew"), COVER_NOISE_SKEW[0], COVER_NOISE_SKEW[1]);
      gl.uniform1f(u("uWarpPx"), throwPx * dpr);
      const brand = getComputedStyle(el!)
        .getPropertyValue("--cover-brand")
        .trim()
        .match(/^#([0-9a-f]{6})$/i);
      const bn = brand ? parseInt(brand[1], 16) : 0x551a89;
      gl.uniform3f(
        u("uBrand"),
        (bn >> 16) / 255,
        ((bn >> 8) & 255) / 255,
        (bn & 255) / 255,
      );
      const uTime = u("uTime");
      const uDissolve = u("uDissolve");

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);

      // Hand the frame to the skin only once there is something in it, or
      // the heading blinks out for a frame before the tear appears.
      let shown = false;
      host!.appendChild(canvas);

      const easeQuart = (s: number) =>
        s < 0.5 ? 8 * s ** 4 : 1 - Math.pow(-2 * s + 2, 4) / 2;

      let raf = 0;
      let shaderTime = 0;
      let last = performance.now();
      let lastDraw = 0;
      const entered = last;

      /* Phase within the cycle, in seconds, advancing only while the thing
         is actually running — so it is local rather than off the shared
         clock. It has to be: the loop is now the reader's to start, and a
         heading they just pointed at has to begin whole and come apart,
         not cut in halfway through a cycle it was never running. */
      let phase = 0;

      /* Drawn at 30fps, not at refresh rate.
         Each of these shaders runs three fbm calls per pixel at eight
         octaves — 24 Perlin evaluations per fragment, against the field's
         ten — so three headings on screen at once cost more than the field
         they sit in, and at 60fps on a 2.5k window that was enough to wedge
         the renderer. Halving the draw rate halves it back.
         Nothing about the effect changes: `shaderTime` still accumulates
         over real elapsed time and the cycle still comes off the shared
         clock, so the churn rate and the twelve-second period are
         untouched. Only how often the result is sampled drops, and on a
         breath this slow that is not visible. */
      const DRAW_INTERVAL = 1000 / 30;

      const frame = () => {
        raf = 0;
        if (disposed) return;
        const now = performance.now();
        const dt = Math.min((now - last) / 1000, 1 / 20);
        last = now;

        /* The cover's speed ramp, measured from arrival: churns fast as it
           opens and eases to the drift it keeps forever after. Same curve
           and same two values as the portrait's. */
        const s = Math.min(1, (now - entered) / 1000 / 0.9);
        const speed = 0.35 + (0.12 - 0.35) * easeQuart(s);
        shaderTime += dt * speed * COVER_FLOW;

        phase += dt;

        if (now - lastDraw >= DRAW_INTERVAL) {
          lastDraw = now;
          draw(coverDissolveAt(phase, cycle));
        }

        /* One cycle, then a decision. The curve is flat at both extremes,
           so a cycle boundary is the only moment the type is genuinely
           whole — stopping anywhere else would freeze a heading mid-tear.
           Hovering keeps it going; letting go does not cut it off, it lets
           the current cycle finish and parks it whole. */
        if (phase >= cycle) {
          phase = 0;
          if (!hovering) {
            stopAtWhole();
            return;
          }
        }

        raf = requestAnimationFrame(frame);
      };

      // `gl!` because this is a hoisted declaration: it is called from
      // `frame` above its own definition, which puts it outside the block
      // where the null check narrowed the context.
      function draw(d: number) {
        gl!.uniform1f(uTime, shaderTime);
        gl!.uniform1f(uDissolve, d);
        gl!.clear(gl!.COLOR_BUFFER_BIT);
        gl!.drawArrays(gl!.TRIANGLES, 0, 3);
        if (!shown) {
          shown = true;
          el!.style.opacity = "0";
        }
      }

      /* Parked, not torn down: the skin stays, holding a whole frame, so a
         hover can restart instantly without re-rasterising the type. */
      function stopAtWhole() {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        phase = 0;
        draw(0);
      }
      /* Starting has to reset `last`, or the first dt after an idle spell is
         the whole time spent stopped and the churn jumps. Exposed to the
         effect, which owns the pointer listeners — the skin sits over the
         type and is `pointer-events:none`, so the hover is seen on the
         heading itself, not here. */
      startFn = () => {
        if (raf || disposed) return;
        last = performance.now();
        raf = requestAnimationFrame(frame);
      };
      pauseFn = () => {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      };

      // Something has to be in the buffer before the type is handed over,
      // or the heading blinks out for a frame.
      draw(0);

      return () => {
        startFn = null;
        pauseFn = null;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        el!.style.opacity = "";
        canvas.remove();
        gl.deleteTexture(tex);
        gl.deleteProgram(prog!);
        gl.deleteShader(vs!);
        gl.deleteShader(fs!);
        if (vao) gl.deleteVertexArray(vao);
      };
    }

    return () => {
      disposed = true;
      window.clearTimeout(rebuildTimer);
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointerleave", onLeave);
      ro.disconnect();
      io.disconnect();
      cleanupGl?.();
    };
  }, [text, strength, cycle, intro]);

  return (
    <div ref={hostRef} className="relative">
      <Tag className={className}>{text}</Tag>
    </div>
  );
}
