"use client";

import { useEffect, useRef, type CSSProperties } from "react";

/* ------------------------------------------------------------------ *
 * The flowing copy of a lit surface's light (saas.css §3, "The mesh in
 * motion"): the #pricing plan cards' flow, on any surface on this page.
 *
 * The surface paints its light once as its ground (`.saas-lit
 * .saas-light-<name>`, from the server's first byte). Over it sits this:
 * the same light taken apart into its pools, one element per pool, each
 * drifting on its own compositor-only path. The pools are worked out on
 * the server (home/mesh-flow.ts `meshBlobs` over palette.ts SAAS_LIGHTS)
 * and arrive as plain style objects, so neither the recipe parser nor the
 * recipes reach this chunk.
 *
 * WHERE IT GOES. The surface's first child, before its `.home-grain`:
 *
 *   <div class="saas-lit saas-light-room" style="--saas-radius:28px">
 *     <LiveMesh blobs={…} drift={1.12} />
 *     <span aria-hidden class="home-grain" />
 *     …content
 *   </div>
 *
 * ONLY WHILE ON SCREEN. An IntersectionObserver on the surface (this
 * element's parent) toggles `data-live` on it, straight on the DOM with no
 * React state, so a surface scrolling in and out never re-renders anything.
 * Off screen, saas.css drops the pools' animations, and their layers with
 * them; the surface rests on its still picture and flows off again from
 * rest when it comes back. The attribute is removed on unmount, so a
 * surface never keeps a flow nobody is watching.
 *
 * The gates are all CSS: reduced motion, the still tier and weak hardware
 * (<html data-weak>) never display this element at all, and see the
 * ground alone — the same picture, standing still. The observer still
 * runs there; with nothing displayed, the attribute it sets costs nothing.
 *
 * `drift` is the surface's own tempo (1 is #pricing's first card): a
 * higher number is slower. Pools drawn at a fixed px size, like the
 * credentials card's, cross a large surface in a smaller share of it, so
 * they take a slower drift to look the same.
 * ------------------------------------------------------------------ */

export function LiveMesh({ blobs, drift = 1 }: { blobs: readonly CSSProperties[]; drift?: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const surface = ref.current?.parentElement;
    if (!surface) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) e.target.toggleAttribute("data-live", e.isIntersecting);
    });
    io.observe(surface);
    return () => {
      io.disconnect();
      surface.removeAttribute("data-live");
    };
  }, []);

  return (
    <span ref={ref} aria-hidden className="saas-mesh" style={{ "--drift": drift } as CSSProperties}>
      {blobs.map((style, n) => (
        <span key={n} style={style} />
      ))}
    </span>
  );
}
