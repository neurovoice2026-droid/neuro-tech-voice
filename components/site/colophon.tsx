"use client";

import Image from "next/image";
import { useReducedMotion } from "framer-motion";
import { COLOPHON, INTEGRATIONS } from "@/lib/site";
import { CornerDot } from "./corner-dot";
import { EASE, Reveal } from "./reveal";

/**
 * The colophon strip — the fold between the hero's ink and the spread's field.
 *
 * A magazine cover does not stop at the image; it runs a technical line under
 * it carrying the credits and the plate. This is that line, and its job is
 * structural before it is editorial: CoverSpread lifts its field off #06040a
 * and scrims the join, so this strip has to actually BE #06040a. The ink is
 * load-bearing. Change it and the seam between the two blacks appears.
 *
 * It measures on the hero's rule — max-w-[var(--size-container)] and a
 * px-[1.5em] gutter — not the interior sections' 76em/1.6em. The reader has
 * the wordmark's left edge in their eye from the line above; landing the
 * plate anywhere else reads as a second page starting.
 *
 * WHY THIS IS NOT A CRAWL ANY MORE. The previous version scrolled five logos,
 * duplicated to thirty, on a 32-second loop. Three things were wrong with it
 * and each one is a reason for the shape here:
 *
 *  1. It was a client component with no client behaviour — the loop was a CSS
 *     keyframe. It paid React's boundary for nothing.
 *  2. The sentence that explains what the integrations DO was hidden below
 *     1024px, which deleted the only substantive copy on the strip on exactly
 *     the devices where five logo names say least. It is now visible at every
 *     width, and it is the reason the mobile layout stacks rather than scrolls.
 *  3. Its hover state lit the mark to --cover-brand (#551a89), which on this
 *     ink is 1.84:1 — DARKER than the 3.0:1 it started from. The hover was a
 *     regression dressed as a response. Hover now does one honest thing: it
 *     raises the mark from 45% to full and changes nothing else.
 *
 * Five names do not need to move to be read. They fit. The motion left is the
 * entrance only, lifted from the hero's corner marks so the reader who has
 * just watched those land recognises the gesture: a dial-in, scale 0.88 to 1,
 * staggered at 70ms, which reads as a set of plates being seated rather than
 * five unrelated fades.
 *
 * That entrance is why the file is still "use client". Reveal guards its own
 * initial state against useReducedMotion, but the moment a caller overrides
 * `initial` to add scale, that guard is bypassed — so the override has to be
 * computed here, against the same hook. Under reduced motion the marks render
 * at their final state with no binding at all.
 */
export function Colophon() {
  const reduce = useReducedMotion();
  const count = String(INTEGRATIONS.length).padStart(2, "0");

  return (
    <section
      aria-label={COLOPHON.line}
      className="cover cover-grain relative isolate bg-[var(--cover-ink)] text-[var(--cover-paper)]"
      style={{ fontFamily: "var(--font-display)" }}
    >
      {/* Hairlines, not borders: the cover has no boxes in it, and these two
          are full-bleed on purpose — the strip is a rule across the page, so
          its edges cannot stop at the measure the content sits on. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-[var(--cover-paper)]/12"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px bg-[var(--cover-paper)]/12"
      />

      <div className="mx-auto flex w-full max-w-[var(--size-container)] flex-col gap-[1.4em] px-[1.5em] py-[2.2em] md:flex-row md:items-center md:gap-[2.4em] md:py-[1.8em]">
        {/* Plate: the same numeric register as the cover's clock and era. */}
        <div className="flex shrink-0 items-center gap-[0.9em]">
          <span className="flex items-center gap-[0.5em] text-[0.7em] uppercase leading-none tracking-[0.24em] text-[var(--cover-paper)]/45">
            <CornerDot className="size-[0.55em]" />
            {COLOPHON.kicker}
          </span>
          <span
            aria-hidden
            className="h-[1.6em] w-px bg-[var(--cover-paper)]/15"
          />
          <span className="text-[0.7em] leading-none tabular-nums text-[var(--cover-paper)]/45">
            {count}
          </span>
        </div>

        {/* The five marks. They wrap rather than scroll; at the narrowest
            width that is two lines of logos, which costs nothing and keeps
            every name selectable and findable by the browser's own search. */}
        <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-x-[1.7em] gap-y-[0.8em]">
          {INTEGRATIONS.map((it, i) => (
            <li key={it.label} className="flex items-center gap-[1.7em]">
              <Reveal
                as="span"
                className="group flex items-center gap-[0.7em]"
                initial={reduce ? false : { opacity: 0, scale: 0.88 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: i * 0.07, ease: EASE }}
              >
                {/* The vendor's own mark, not the lucide glyph beside it in
                    the constant. A monoline calendar icon is a drawing of the
                    category, and a reader scanning this strip is checking for
                    one specific logo — the glyph answers "calendars" when the
                    question was "mine". Decorative, because the label next to
                    it says the same thing and would be announced twice. */}
                <Image
                  src={it.mark}
                  alt=""
                  width={24}
                  height={24}
                  className="size-[1.15em] shrink-0 opacity-45 transition-opacity duration-500 group-hover:opacity-100"
                />
                <span className="whitespace-nowrap text-[1.15em] leading-none tracking-[-0.035em] text-[var(--cover-paper)]/80">
                  {it.label}
                </span>
              </Reveal>
              {/* Punctuation between entries, never after the last one. */}
              {i < INTEGRATIONS.length - 1 && (
                <CornerDot className="size-[0.34em] shrink-0 text-[var(--cover-paper)]/25" />
              )}
            </li>
          ))}
        </ul>

        {/* The only sentence on the strip, and the only thing here that says
            what an integration actually does during a call. It outranks the
            logos, so it never hides. */}
        <p className="max-w-[26em] shrink-0 text-pretty text-[0.85em] leading-[1.4] tracking-[-0.02em] text-[var(--cover-paper)]/75 md:text-right">
          {COLOPHON.line}
        </p>
      </div>
    </section>
  );
}
