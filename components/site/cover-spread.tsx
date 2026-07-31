"use client";

import type { ReactNode } from "react";
import { CoverField } from "./cover-field";

/**
 * One field, many spreads.
 *
 * Each section used to carry its own copy of the cover's background: its
 * own sticky canvas, its own grain, and a scrim at both edges. Stacked,
 * that reads as exactly what it is — two backgrounds butted together. The
 * canvas unsticks at the end of one section and a second one sticks at the
 * top of the next, so the wash and the vignette snap back to the viewport
 * at the seam; and the two facing scrims each darken to --cover-ink, so
 * they meet as a band drawn across the page at precisely the join you were
 * not supposed to notice.
 *
 * So the field is hoisted out of the sections and drawn once, over all of
 * them. The sections inside are transparent — they contribute padding, an
 * id to scroll to, and their content, nothing else. Scrims survive only at
 * the outer edges of the whole run, where there really is a different
 * surface to bridge to.
 *
 * It costs less, too: one WebGL context and one rAF loop for the whole
 * interior rather than one per section.
 *
 * Everything the sections inside depend on is set here — `.cover` carries
 * both the --cover-* palette and the fluid `em` base, so their lengths
 * resolve against this element and scale with the viewport as one piece.
 */
export function CoverSpread({ children }: { children: ReactNode }) {
  return (
    <div
      className="cover cover-grain relative isolate bg-[var(--cover-field-low)] text-[var(--cover-paper)]"
      style={{ fontFamily: "var(--font-display)" }}
    >
      {/* No `overflow` on this wrapper, and that is load-bearing: an
          ancestor with overflow hidden or clip becomes the sticky element's
          scroll container, and since this one never scrolls the canvas
          would pin to the top of the spread and leave everything past the
          first screen on flat ink. `max-h-full` does the clamping instead,
          so a run shorter than the viewport cannot overflow the bottom and
          paint over whatever follows it. */}
      <div aria-hidden className="absolute inset-0 -z-20">
        <div className="sticky top-0 h-[100dvh] max-h-full w-full">
          <div className="cover-field-still absolute inset-0" />
          <CoverField className="absolute inset-0 size-full" />
        </div>
      </div>

      {/* Scrims, at the outer edges only. They start on the colophon
          strip's actual ink rather than on this run's washed base, which is
          what bridges the two: the strip above is #06040a, the spread is
          lifted off it, and without the bridge the join reads as a seam
          between two different blacks. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[7em]"
        style={{
          background:
            "linear-gradient(to bottom, var(--cover-ink) 0%, rgba(6,4,10,0.55) 40%, transparent 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[7em]"
        style={{
          background:
            "linear-gradient(to top, var(--cover-ink) 0%, rgba(6,4,10,0.55) 40%, transparent 100%)",
        }}
      />

      {children}
    </div>
  );
}
