"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { ANATOMY_INTRO, STACK } from "@/lib/site";
import { cn } from "@/lib/utils";
import { CornerDot } from "./corner-dot";
import { TornEdge } from "./cover-tear";
import { IntentLink } from "./intent-link";
import { EASE, Reveal } from "./reveal";

/**
 * Fig. 01 — the path of one call, and where the market stops.
 *
 * This section replaces a nine-card feature grid. The grid listed the same
 * ten things this does and taught the reader nothing, because a grid says
 * "here are ten items" and the argument here is not a list — it is an
 * ORDER. Ten things happen to a phone call, in sequence, and the sequence
 * is load-bearing: the first five are a market, the last five are one
 * specific business, and the whole pitch lives in the fact that you can
 * buy the first half from four different vendors and the second half from
 * nobody. A grid cannot say "and then"; a line can.
 *
 * So the figure is a line and the ten stations sit on it. Three decisions
 * held this together and are worth defending:
 *
 *  · **The seam is the argument, so the seam is the only torn thing.**
 *    One TornEdge, vertical, standing at the split between station 05 and
 *    06 — and the line's stroke changes there, from paper at 25% to the
 *    page's one accent. Left of the tear is commodity; right of it is the
 *    caller's business. The tear's filaments hang toward the LEFT half
 *    (a 90° rotation points the curtain at -x), which is the correct
 *    direction: the commodity side is the side coming apart.
 *
 *  · **The stations alternate above and below the line, and the numeral
 *    always sits nearest the line.** Ten blocks in a row inside 76em give
 *    each one 7.6em — too narrow for a note to be read rather than
 *    decoded. Alternating doubles the usable width to two pitches, so
 *    every block gets 10.5em and the notes set in two or three lines
 *    instead of four ragged ones. The spec's stacking (numeral above,
 *    label then note below) is kept literally for the below-line
 *    stations and MIRRORED for the above-line ones, via flex-col-reverse
 *    — because the thing that has to stay constant is the numeral's
 *    adjacency to its own dot. DOM order is n / label / note either way,
 *    so a screen reader never sees the mirror.
 *
 *  · **Only the dots move with the scroll. The words never do.** Every
 *    station's text is at full contrast from first paint. A backgrounded
 *    tab does not run requestAnimationFrame, and a section whose content
 *    starts at 0.2 opacity is a section that can arrive blank. The head
 *    travelling is carried entirely by the stroke and by the dots
 *    lighting as it passes them, which is also the only motion here that
 *    explains anything: it is the order being asserted.
 *
 * Three of the ten stations are live product pages, and all three land on
 * the business side of the tear — 06 what it says, 07 what it knows, 08
 * your calendar. That is not a coincidence we engineered; it is what the
 * product actually is, and having the only links in the figure appear
 * after the seam makes the point a second time without a sentence.
 *
 * GEOMETRY. The desktop figure is a fixed 32em tall so the two bands and
 * the calendar tier can be placed against each other in em, while the
 * horizontal positions stay in PERCENT — below 76em the container is
 * width-constrained, so anything measured in em along x would drift off
 * the line. Hence the seam of literal Tailwind values below; they are all
 * derived from four numbers:
 *
 *   figure height  32em      line             18em from the top
 *   line-to-text    1.6em    calendar tier    0 – 6em from the top
 *
 *   above block bottom   32 - 18 + 1.6 = 15.6em from the figure's bottom
 *   below block top           18 + 1.6  = 19.6em from the figure's top
 *   dot offset from block      1.6 + 0.35 = 1.95em (half a 0.7em dot)
 *   card above station 08     19.6 - 6   = 13.6em over the block's top
 *
 * Below 768px none of it survives — a ten-station horizontal path on a
 * phone is a horizontal scrollbar — so the path stands up: one station
 * per row, the rail down the left gutter at 1.4em, the seam laid flat
 * between rows 05 and 06, and the calendar branch reduced to a stub
 * leaving station 08 to the right.
 */

/**
 * Station x positions, in percent of the figure.
 *
 * Inset 7% at each end so the first and last blocks — 10.5em wide, centred
 * on their own station — do not hang out of the container. The pitch that
 * falls out of it, 86/9, puts the midpoint between station 05 and 06 at
 * exactly 50%, which is where the seam stands.
 */
const X = STACK.map((_, i) => 7 + (i * 86) / 9);

/** The group boundary, as a fraction of the head's travel. */
const SEAM = 0.5;

/** Station 08 — the one the branch leaves from. */
const BRANCH_AT = STACK.findIndex((s) => s.id === "calendar");

/**
 * Only routes that exist. Everything else in the mega menu is either a
 * page we have not built or a layer we do not sell on its own, and a dead
 * link inside the figure that claims to explain the product is worse than
 * no link at all.
 */
const HREF: Record<string, string> = {
  script: "/product/ai-agents",
  knows: "/product/knowledge-base",
  calendar: "/product/integrations",
};

/** The mini month. One cell is the appointment being written. */
const CELLS = 28;
const BOOKED = 17;

export function Anatomy() {
  const sectionRef = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start 0.8", "end 0.4"],
  });

  /**
   * How many stations the head has passed.
   *
   * A single subscription driving one integer, rather than ten motion
   * values thresholded independently: the dots are not scrubbing, they
   * SETTLE — 0.35s on the page's one ease — and that needs a discrete
   * event to fire against, not a continuous mapping. The setter is
   * guarded so a scroll inside a station costs nothing.
   */
  const [lit, setLit] = useState(reduce ? STACK.length : 0);

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (reduce) return;
    const n = X.filter((x) => v >= x / 100).length;
    setLit((prev) => (prev === n ? prev : n));
  });

  // The event only fires on CHANGE, and a reader who lands mid-page —
  // a hash link, a restored scroll position — never produces one.
  useEffect(() => {
    if (reduce) {
      setLit(STACK.length);
      return;
    }
    const v = scrollYProgress.get();
    setLit(X.filter((x) => v >= x / 100).length);
  }, [reduce, scrollYProgress]);

  /**
   * Two strokes, not one with a gradient. The colour change IS the seam,
   * and a gradient stop has to be told where 50% is in the path's own
   * parameter space — which stops being 50% the moment the path gains a
   * curve or the viewBox is scaled unevenly. Two paths cannot drift.
   */
  const leftDraw = useTransform(scrollYProgress, [0, SEAM], [0, 1]);
  const rightDraw = useTransform(scrollYProgress, [SEAM, 1], [0, 1]);
  const branchDraw = useTransform(
    scrollYProgress,
    [X[BRANCH_AT] / 100, X[BRANCH_AT] / 100 + 0.07],
    [0, 1],
  );

  const booked = lit > BRANCH_AT;

  return (
    <section
      ref={sectionRef}
      id="what"
      className="relative scroll-mt-24 px-[1.6em] py-[6em] md:py-[8em]"
    >
      <div className="relative mx-auto max-w-[76em]">
        {/* masthead */}
        <Reveal className="flex items-center gap-[0.75em] text-[var(--cover-paper)]/45">
          <CornerDot className="size-[0.55em] shrink-0" />
          <span className="mono text-[0.7em] uppercase tracking-[0.24em]">
            01
          </span>
          <span className="mono text-[0.7em] uppercase tracking-[0.24em]">
            {ANATOMY_INTRO.kicker}
          </span>
        </Reveal>

        <Reveal
          as="h2"
          delay={0.06}
          className="mt-[0.9em] text-balance text-[2.8em] font-medium leading-[1.03] tracking-[-0.045em] md:text-[3.4em]"
        >
          {ANATOMY_INTRO.title}
        </Reveal>

        <Reveal
          as="p"
          delay={0.12}
          className="mt-[1.1em] max-w-[44em] text-pretty text-[1.05em] leading-[1.6] text-[var(--cover-paper)]/75"
        >
          {ANATOMY_INTRO.sub}
        </Reveal>

        <div className="mt-[1.8em] h-px bg-[var(--cover-paper)]/12" />

        {/* the figure */}
        <div className="relative mt-[3.2em] md:mt-[5em] md:h-[32em]">
          {/*
            The line. viewBox 0 0 100 100 with preserveAspectRatio="none"
            so x and y are simply percentages of the figure — every
            segment here is axis-aligned, so the uneven scale costs
            nothing, and non-scaling-stroke keeps the hairline a hairline
            at any width.
          */}
          <svg
            aria-hidden
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 hidden size-full md:block"
          >
            <motion.path
              d="M 0 56.25 H 50"
              fill="none"
              stroke="var(--cover-paper)"
              strokeOpacity={0.25}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              style={{ pathLength: reduce ? 1 : leftDraw }}
            />
            <motion.path
              d="M 50 56.25 H 100"
              fill="none"
              stroke="var(--cover-brand-lit)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              style={{ pathLength: reduce ? 1 : rightDraw }}
            />
            {/* The branch: straight up from station 08, through the gap
                between the blocks of 07 and 09, to the calendar tier. */}
            <motion.path
              d={`M ${X[BRANCH_AT]} 56.25 V 18.75`}
              fill="none"
              stroke="var(--cover-brand-lit)"
              strokeOpacity={0.55}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              style={{ pathLength: reduce ? 1 : branchDraw }}
            />
          </svg>

          {/*
            The seam, as a hairline rather than a tear.

            This was a `TornEdge` turned a quarter turn, on the reasoning
            that its measured width would become the figure's height and
            the filaments would hang into the commodity half. It rendered
            as a solid slab roughly 3em wide, sitting on top of the line
            it was supposed to interrupt — the component hangs a CURTAIN
            below its rule, and a curtain rotated is a block, not an edge.

            The argument never needed it. The stroke already changes from
            paper to the page's one accent exactly here, and a change of
            colour mid-line is a sharper statement of "the market stops"
            than any amount of texture. The fade at both ends keeps the
            seam from reading as a table divider.
          */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-[2.5em] left-1/2 hidden w-px -translate-x-1/2 bg-[var(--cover-paper)]/15 md:block"
            style={{
              maskImage:
                "linear-gradient(to bottom, transparent, #000 18%, #000 82%, transparent)",
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent, #000 18%, #000 82%, transparent)",
            }}
          />

          <ol className="relative flex flex-col gap-[1.6em] md:absolute md:inset-0 md:block md:gap-0">
            {STACK.map((s, i) => {
              const above = i % 2 === 0;
              const last = i === STACK.length - 1;
              const href = HREF[s.id];
              const on = i < lit;

              return (
                <li
                  key={s.id}
                  style={{ "--x": `${X[i]}%` } as CSSProperties}
                  className={cn(
                    "relative flex flex-col gap-[0.4em] pl-[3.2em]",
                    "md:absolute md:left-[var(--x)] md:w-[10.5em] md:-translate-x-1/2 md:pl-0 md:text-center",
                    above
                      ? "md:bottom-[15.6em] md:flex-col-reverse"
                      : "md:top-[19.6em]",
                  )}
                >
                  {/* The phone's rail: one segment per row, carrying its
                      own group's colour, bridging the gap to the next. */}
                  {!last && (
                    <motion.span
                      aria-hidden
                      className={cn(
                        "absolute left-[1.4em] top-[0.6em] w-px origin-top md:hidden",
                        s.group === "stack"
                          ? "bg-[var(--cover-paper)]/25"
                          : "bg-[var(--cover-brand-lit)]",
                        // 05 stops at the seam; 06 starts above it.
                        i === 4
                          ? "h-[calc(100%_+_0.2em)]"
                          : "h-[calc(100%_+_1.6em)]",
                      )}
                      initial={reduce ? false : { scaleY: 0 }}
                      animate={{ scaleY: on ? 1 : 0 }}
                      transition={{ duration: 0.45, ease: EASE }}
                    />
                  )}
                  {i === 5 && (
                    <>
                      <motion.span
                        aria-hidden
                        className="absolute -top-[0.8em] left-[1.4em] h-[1.4em] w-px origin-top bg-[var(--cover-brand-lit)] md:hidden"
                        initial={reduce ? false : { scaleY: 0 }}
                        animate={{ scaleY: on ? 1 : 0 }}
                        transition={{ duration: 0.45, ease: EASE }}
                      />
                      <div
                        aria-hidden
                        className="pointer-events-none absolute -top-[0.8em] left-0 right-0 md:hidden"
                      >
                        <TornEdge height={2.6} opacity={0.5} />
                      </div>
                    </>
                  )}

                  {/* The station itself. */}
                  <motion.span
                    aria-hidden
                    className={cn(
                      "absolute left-[1.05em] top-[0.25em] size-[0.7em] md:left-1/2 md:-translate-x-1/2",
                      above
                        ? "md:-bottom-[1.95em] md:top-auto"
                        : "md:-top-[1.95em]",
                      s.group === "stack"
                        ? "text-[var(--cover-paper)]/70"
                        : "text-[var(--cover-brand-lit)]",
                    )}
                    initial={reduce ? false : { opacity: 0.2, scale: 0.6 }}
                    animate={{ opacity: on ? 1 : 0.2, scale: on ? 1 : 0.6 }}
                    transition={{ duration: 0.35, ease: EASE }}
                  >
                    <CornerDot className="size-full" />
                  </motion.span>

                  <span className="mono text-[0.7em] uppercase leading-none tracking-[0.24em] text-[var(--cover-paper)]/45">
                    {s.n}
                  </span>

                  <span className="text-[1.05em] leading-[1.25]">
                    {href ? (
                      <IntentLink
                        href={href}
                        className="underline decoration-[var(--cover-paper)]/25 decoration-1 underline-offset-[0.3em] transition-colors duration-500 hover:decoration-[var(--cover-brand-lit)] focus-visible:outline-none focus-visible:decoration-[var(--cover-brand-lit)]"
                      >
                        {s.label}
                      </IntentLink>
                    ) : (
                      s.label
                    )}
                  </span>

                  <span className="text-[0.8em] leading-[1.5] text-[var(--cover-paper)]/75">
                    {s.note}
                  </span>

                  {/* The booking being written. On the phone the branch is
                      a stub leaving to the right; on the desktop figure
                      the card is lifted to the top tier and the SVG
                      branch above reaches up to meet it. */}
                  {i === BRANCH_AT && (
                    <div className="mt-[0.7em] flex items-center md:absolute md:bottom-[calc(100%_+_13.6em)] md:left-1/2 md:mt-0 md:w-[9.4em] md:-translate-x-1/2 md:flex-col">
                      <motion.span
                        aria-hidden
                        className="h-px w-[1.4em] shrink-0 origin-left bg-[var(--cover-brand-lit)]/55 md:hidden"
                        initial={reduce ? false : { scaleX: 0 }}
                        animate={{ scaleX: booked ? 1 : 0 }}
                        transition={{ duration: 0.4, ease: EASE }}
                      />
                      <div className="flex flex-col gap-[0.5em] pl-[0.7em] md:w-full md:items-center md:pl-0">
                        <span className="flex items-center gap-[0.45em]">
                          <Image
                            src="/integrari/google_calendar.svg"
                            alt=""
                            width={16}
                            height={16}
                            unoptimized
                            className="size-[1.05em] shrink-0"
                          />
                          <span className="mono text-[0.62em] uppercase tracking-[0.18em] text-[var(--cover-paper)]/45">
                            Google Calendar
                          </span>
                        </span>

                        <span
                          aria-hidden
                          className="grid grid-cols-7 gap-[0.16em]"
                        >
                          {Array.from({ length: CELLS }, (_, c) => (
                            <span
                              key={c}
                              className="relative block size-[0.62em] rounded-[0.1em] border border-[var(--cover-paper)]/12"
                            >
                              {c === BOOKED && (
                                <motion.span
                                  className="absolute inset-0 rounded-[0.1em] border border-[var(--cover-brand-lit)]/60 bg-[var(--cover-brand-lit)]/12"
                                  initial={reduce ? false : { opacity: 0 }}
                                  animate={{ opacity: booked ? 1 : 0 }}
                                  transition={{
                                    duration: 0.5,
                                    delay: booked ? 0.2 : 0,
                                    ease: EASE,
                                  }}
                                />
                              )}
                            </span>
                          ))}
                        </span>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
