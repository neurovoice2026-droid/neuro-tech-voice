"use client";

import Image from "next/image";
import { useReducedMotion } from "framer-motion";
import { COLOPHON, INTEGRATIONS } from "@/lib/site";
import { CornerDot } from "./corner-dot";
import { Eyebrow, Frame } from "./product/primitives";
import { EASE, Reveal } from "./reveal";

/**
 * The colophon strip — the first white thing on the page.
 *
 * The hero above it is dark and the imprint at the foot of the page is
 * dark; everything between them is the light product system, the same one
 * every mega-menu page is set in. That makes this strip the transition,
 * and a transition is a job you do once, quietly, in one band. It carries
 * `.pp` itself because the homepage's `main` is not a `.pp` main — the
 * tokens have to start somewhere, and they start here.
 *
 * It does NOT try to blend into the hero. A gradient down out of black
 * would be the site apologising for its own structure; the product pages
 * change stock at a hard edge and so does this. The band is --pp-band
 * rather than plain white for exactly one reason: under a black hero,
 * white-on-black-on-white makes the strip read as a gap. The faint violet
 * grey gives it a body, and the hairline under it hands the page off to
 * the open field below.
 *
 * It sits in <Frame>, the pp column, not on the hero's own gutter. On the
 * cover the argument was that the reader has the wordmark's left edge in
 * their eye; on white the argument reverses — everything below this point
 * measures on the 1176px column, and the colophon is the first line of
 * that column, not the last line of the hero.
 *
 * WHY THIS IS NOT A CRAWL. An earlier version scrolled five logos,
 * duplicated to thirty, on a 32-second loop:
 *
 *  1. It was a client component with no client behaviour — the loop was a
 *     CSS keyframe. It paid React's boundary for nothing.
 *  2. The sentence that explains what the integrations DO was hidden
 *     below 1024px, which deleted the only substantive copy on the strip
 *     on exactly the devices where five logo names say least. It is now
 *     visible at every width, and it is the reason the narrow layout
 *     stacks rather than scrolls.
 *  3. Its hover lit the mark to the brand violet, which on that ink was
 *     darker than what it started from — a regression dressed as a
 *     response. On white there is nothing left for hover to fix: the
 *     vendor marks are already at full strength and in their own colours,
 *     which is how the product pages print them, so hover does nothing
 *     and that is the honest answer.
 *
 * Five names do not need to move to be read. The motion left is the
 * entrance only — a dial-in, scale 0.88 to 1, staggered at 70ms, which
 * reads as a set of plates being seated rather than five unrelated fades.
 * It draws and seats; it does not glow. On white a glow is dirt.
 *
 * That entrance is why the file is still "use client". Reveal guards its
 * own initial state against useReducedMotion, but the moment a caller
 * overrides `initial` to add scale, that guard is bypassed — so the
 * override is computed here, against the same hook. Under reduced motion
 * the marks render at their final state with no binding at all.
 */
export function Colophon() {
  const reduce = useReducedMotion();
  const count = String(INTEGRATIONS.length).padStart(2, "0");

  return (
    <section aria-label={COLOPHON.line} className="pp relative isolate">
      {/* The band and its closing hairline are full-bleed: the strip is a
          rule across the page, so its edges cannot stop at the measure the
          content sits on. */}
      <div className="border-b border-pp-hair bg-pp-band">
        <Frame className="flex flex-col gap-6 py-8 md:flex-row md:items-center md:gap-10 md:py-9">
          {/* Plate: the section eyebrow every pp section opens with, plus
              the count, which is the one numeral on the strip. */}
          <div className="flex shrink-0 items-center gap-3">
            <Eyebrow>{COLOPHON.kicker}</Eyebrow>
            <span aria-hidden className="h-4 w-px bg-pp-rule" />
            <span className="text-[12px] leading-4 tabular-nums text-pp-muted">{count}</span>
          </div>

          {/* The five marks. They wrap rather than scroll; at the narrowest
              width that is two lines of logos, which costs nothing and keeps
              every name selectable and findable by the browser's own search. */}
          <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-x-6 gap-y-3">
            {INTEGRATIONS.map((it, i) => (
              <li key={it.label} className="flex items-center gap-6">
                <Reveal
                  as="span"
                  className="flex items-center gap-2.5"
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
                    className="size-5 shrink-0"
                  />
                  <span className="whitespace-nowrap text-[15px] leading-6 tracking-[-0.01em] text-pp-ink">
                    {it.label}
                  </span>
                </Reveal>
                {/* Punctuation between entries, never after the last one. */}
                {i < INTEGRATIONS.length - 1 && (
                  <CornerDot className="size-1.5 shrink-0 text-pp-muted/45" />
                )}
              </li>
            ))}
          </ul>

          {/* The only sentence on the strip, and the only thing here that says
              what an integration actually does during a call. It outranks the
              logos, so it never hides. */}
          <p className="max-w-[46ch] shrink-0 text-pretty text-[14px] leading-5 text-pp-muted md:max-w-[34ch] md:text-right">
            {COLOPHON.line}
          </p>
        </Frame>
      </div>
    </section>
  );
}
