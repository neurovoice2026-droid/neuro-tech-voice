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
import { Frame, SectionHeading } from "./product/primitives";
import { CornerDot } from "./corner-dot";
import { IntentLink } from "./intent-link";
import { EASE, Reveal } from "./reveal";

/**
 * The path of one call, and where the market stops.
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
 * SET IN THE PRODUCT-PAGE SYSTEM (`.pp`), not the cover's. This is the
 * client's established design and the one every mega-menu page already
 * uses: white stock, black ink, violet for the product's own hand, Onest
 * display over Inter body, and a single centred `Frame` column. The
 * section carries `.pp` itself and resets to a 16px base, so it stands on
 * white whatever surrounds it — the hero above stays dark and the footer
 * below stays dark, exactly as on every product page, and this does not
 * try to blend into either. All lengths are px/rem; the cover's fluid `em`
 * base does not exist inside a pp surface and nothing here may inherit it.
 *
 * Four decisions held the figure together and are worth defending:
 *
 *  · **The seam is the argument, so the stroke changes colour there.** On
 *    white the line's first half is violet-grey — the pp "not yet" ink,
 *    the same one the unreached dots carry — and its second half is the
 *    page's violet at full strength. Left of the change is commodity;
 *    right of it is the caller's business. The cover's torn edge is gone:
 *    a filament curtain is a dark-stock idiom, and on paper it reads as
 *    dirt rather than as a tear. The boundary is a plain hairline at the
 *    figure's midpoint, faded at both ends so it cannot be mistaken for a
 *    table divider.
 *
 *  · **The stations alternate above and below the line, and the numeral
 *    always sits nearest the line.** Ten blocks in a row inside the
 *    1176px column give each one 117px — too narrow for a note to be read
 *    rather than decoded. Alternating doubles the usable width to two
 *    pitches, so every block gets 14% of the column and the notes set in
 *    two or three lines instead of four ragged ones. The spec's stacking
 *    (numeral above, label then note below) is kept literally for the
 *    below-line stations and MIRRORED for the above-line ones, via
 *    flex-col-reverse — because the thing that has to stay constant is the
 *    numeral's adjacency to its own dot. DOM order is n / label / note
 *    either way, so a screen reader never sees the mirror.
 *
 *  · **Only the dots move with the scroll. The words never do.** Every
 *    station's text is at full contrast from first paint. A backgrounded
 *    tab does not run requestAnimationFrame, and a section whose content
 *    starts at 0.2 opacity is a section that can arrive blank. The head
 *    travelling is carried entirely by the stroke being DRAWN and by the
 *    dots inking as it passes them — motion that draws rather than motion
 *    that glows, which is the whole difference in tone between this
 *    surface and the cover.
 *
 *  · **Station width is a percentage of the figure, not a fixed px.** The
 *    old figure sized its blocks in em against a column measured in em,
 *    and below the column's max width the two stopped agreeing and the
 *    end blocks hung out of the page. 14% is exactly twice the 7% end
 *    inset, so the first block's left edge and the last block's right edge
 *    land on the column's own edges at every width, and 14% sits well
 *    inside the two-pitch (19.1%) clearance that alternating buys.
 *
 * Three of the ten stations are live product pages, and all three land on
 * the business side of the seam — 06 what it says, 07 what it knows, 08
 * your calendar. That is not a coincidence we engineered; it is what the
 * product actually is, and having the only links in the figure appear
 * after the seam makes the point a second time without a sentence.
 *
 * GEOMETRY. The desktop figure is a fixed 544px tall so the two bands and
 * the calendar tier can be placed against each other in px, while the
 * horizontal positions stay in PERCENT. All the literal values below are
 * derived from four numbers:
 *
 *   figure height  544px     line             306px from the top (56.25%)
 *   line-to-text    26px     calendar tier    0 – 102px from the top
 *
 *   above block bottom   544 - 306 + 26 = 264px from the figure's bottom
 *   below block top           306 + 26  = 332px from the figure's top
 *   dot offset from block      26 + 6   = 32px (half a 12px dot)
 *   card above station 08     332 - 102 = 230px over the block's top
 *
 * Below 768px none of it survives — a ten-station horizontal path on a
 * phone is a horizontal scrollbar — so the path stands up: one station per
 * row, the rail down the left gutter at 22px, the seam laid flat in the
 * middle of the gap between rows 05 and 06, and the calendar branch
 * reduced to a stub leaving station 08 to the right. Every row's dot sits
 * on the rail's own centreline, so the vertical path is one continuous
 * line with ten marks on it rather than a list with bullets.
 */

/**
 * Station x positions, in percent of the figure.
 *
 * Inset 7% at each end so the first and last blocks — 14% wide, centred on
 * their own station — sit exactly flush with the column. The pitch that
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

/**
 * The commodity half of the line, and the dots that have not been reached.
 *
 * `--pp-muted` at half strength: a stroke light enough to sit behind the
 * violet half without competing, dark enough that the draw is legible on
 * white. `--pp-hair` — the value this would take if it were furniture —
 * is 10% black, which reads as a divider but disappears as a drawn line.
 * The static seam uses `--pp-hair` instead, because that one IS furniture.
 */
const STACK_STROKE = "var(--pp-muted)";
const STACK_STROKE_OPACITY = 0.5;

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
      // `.pp` carries the light palette, Inter, and the white stock.
      // `text-base` pins the subtree to a 16px base so nothing inherits a
      // fluid em scale from whatever this section is nested inside.
      className="pp relative scroll-mt-24 text-base py-20 md:py-32"
    >
      <Frame>
        <Reveal>
          <SectionHeading eyebrow={ANATOMY_INTRO.kicker}>
            {ANATOMY_INTRO.title}
          </SectionHeading>
        </Reveal>

        <Reveal
          as="p"
          delay={0.06}
          className="mt-5 max-w-[680px] text-pretty text-[17px] leading-7 text-pp-muted md:text-[19px] md:leading-8"
        >
          {ANATOMY_INTRO.sub}
        </Reveal>

        {/* A plain hairline rather than <Rule>: Rule is itself a Frame, and
            nesting one inside this column would inset it twice. */}
        <div aria-hidden className="mt-10 h-px bg-pp-rule" />

        {/* the figure */}
        <div className="relative mt-12 md:mt-20 md:h-[544px]">
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
              stroke={STACK_STROKE}
              strokeOpacity={STACK_STROKE_OPACITY}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              style={{ pathLength: reduce ? 1 : leftDraw }}
            />
            <motion.path
              d="M 50 56.25 H 100"
              fill="none"
              stroke="var(--pp-accent)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              style={{ pathLength: reduce ? 1 : rightDraw }}
            />
            {/* The branch: straight up from station 08, through the gap
                between the blocks of 07 and 09, to the calendar tier. */}
            <motion.path
              d={`M ${X[BRANCH_AT]} 56.25 V 18.75`}
              fill="none"
              stroke="var(--pp-accent)"
              strokeOpacity={0.45}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              style={{ pathLength: reduce ? 1 : branchDraw }}
            />
          </svg>

          {/*
            The seam, as a hairline.

            This was a `TornEdge` turned a quarter turn, on the reasoning
            that its measured width would become the figure's height and
            the filaments would hang into the commodity half. It rendered
            as a solid slab sitting on top of the line it was supposed to
            interrupt — the component hangs a CURTAIN below its rule, and a
            curtain rotated is a block, not an edge. On white it would be
            worse still: torn paper is a dark-stock effect, and the same
            texture on a page this clean reads as a smudge.

            The argument never needed it. The stroke already changes from
            the "not yet" grey to the page's violet exactly here, and a
            change of colour mid-line is a sharper statement of "the market
            stops" than any amount of texture. The fade at both ends keeps
            the seam from reading as a table divider.
          */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-10 left-1/2 hidden w-px -translate-x-1/2 bg-pp-hair md:block"
            style={{
              maskImage:
                "linear-gradient(to bottom, transparent, #000 18%, #000 82%, transparent)",
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent, #000 18%, #000 82%, transparent)",
            }}
          />

          <ol className="relative flex flex-col gap-7 md:absolute md:inset-0 md:block md:gap-0">
            {STACK.map((s, i) => {
              const above = i % 2 === 0;
              const last = i === STACK.length - 1;
              const href = HREF[s.id];
              const on = i < lit;
              const business = s.group === "business";

              return (
                <li
                  key={s.id}
                  style={{ "--x": `${X[i]}%` } as CSSProperties}
                  className={cn(
                    "relative flex flex-col gap-1.5 pl-12",
                    "md:absolute md:left-[var(--x)] md:w-[14%] md:-translate-x-1/2 md:gap-1 md:pl-0 md:text-center",
                    above ? "md:bottom-[264px] md:flex-col-reverse" : "md:top-[332px]",
                  )}
                >
                  {/* The phone's rail: one segment per row, carrying its
                      own group's colour, bridging the gap to the next.
                      Row 05 stops in the middle of the gap, where the seam
                      lies; row 06 starts again just under it. */}
                  {!last && (
                    <motion.span
                      aria-hidden
                      className={cn(
                        "absolute left-[22px] top-4 w-px origin-top md:hidden",
                        business ? "bg-pp-accent" : "bg-pp-muted/50",
                        i === 4 ? "h-[calc(100%-2px)]" : "h-[calc(100%+12px)]",
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
                        className="absolute -top-[14px] left-[22px] h-[14px] w-px origin-top bg-pp-accent md:hidden"
                        initial={reduce ? false : { scaleY: 0 }}
                        animate={{ scaleY: on ? 1 : 0 }}
                        transition={{ duration: 0.45, ease: EASE }}
                      />
                      {/* The seam, laid flat between the two groups. Same
                          hairline and the same end-fade as the desktop
                          one, turned through ninety degrees. */}
                      <div
                        aria-hidden
                        className="pointer-events-none absolute -top-[14px] left-0 right-0 h-px bg-pp-hair md:hidden"
                        style={{
                          maskImage:
                            "linear-gradient(to right, transparent, #000 14%, #000 86%, transparent)",
                          WebkitMaskImage:
                            "linear-gradient(to right, transparent, #000 14%, #000 86%, transparent)",
                        }}
                      />
                    </>
                  )}

                  {/* The station itself. */}
                  <motion.span
                    aria-hidden
                    className={cn(
                      "absolute left-4 top-0 size-[13px] md:left-1/2 md:size-3 md:-translate-x-1/2",
                      above ? "md:-bottom-8 md:top-auto" : "md:-top-8",
                      business ? "text-pp-accent" : "text-pp-muted",
                    )}
                    initial={reduce ? false : { opacity: 0.28, scale: 0.6 }}
                    animate={{ opacity: on ? 1 : 0.28, scale: on ? 1 : 0.6 }}
                    transition={{ duration: 0.35, ease: EASE }}
                  >
                    <CornerDot className="size-full" />
                  </motion.span>

                  <span className="text-[11px] leading-4 font-medium uppercase tracking-[0.14em] text-pp-muted tabular-nums">
                    {s.n}
                  </span>

                  <span className="text-[15px] leading-[22px] text-pp-ink md:text-base">
                    {href ? (
                      <IntentLink
                        href={href}
                        className="underline decoration-pp-hair decoration-1 underline-offset-4 transition-colors duration-300 hover:text-pp-accent hover:decoration-pp-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink"
                      >
                        {s.label}
                      </IntentLink>
                    ) : (
                      s.label
                    )}
                  </span>

                  <span className="text-[13px] leading-[19px] text-pp-muted md:text-[12px] md:leading-[17px] lg:text-[13px] lg:leading-[19px]">
                    {s.note}
                  </span>

                  {/* The booking being written. On the phone the branch is
                      a stub leaving to the right; on the desktop figure
                      the card is lifted to the top tier and the SVG
                      branch above reaches up to meet it. */}
                  {i === BRANCH_AT && (
                    <div className="mt-3 flex items-center md:absolute md:bottom-[calc(100%+230px)] md:left-1/2 md:mt-0 md:w-[150px] md:-translate-x-1/2 md:flex-col">
                      <motion.span
                        aria-hidden
                        className="h-px w-6 shrink-0 origin-left bg-pp-accent/45 md:hidden"
                        initial={reduce ? false : { scaleX: 0 }}
                        animate={{ scaleX: booked ? 1 : 0 }}
                        transition={{ duration: 0.4, ease: EASE }}
                      />
                      {/* A soft pp card rather than a bare cluster: it is
                          the one object in the figure that is a SCREEN,
                          and the card is what says so on white. */}
                      <div className="flex flex-col gap-2 rounded-xl bg-pp-card px-3 py-2.5 ml-2.5 md:ml-0 md:w-full md:items-center">
                        <span className="flex items-center gap-2">
                          <Image
                            src="/integrari/google_calendar.svg"
                            alt=""
                            width={16}
                            height={16}
                            unoptimized
                            className="size-4 shrink-0"
                          />
                          <span className="text-[10px] leading-4 font-medium uppercase tracking-[0.12em] text-pp-muted">
                            Google Calendar
                          </span>
                        </span>

                        <span aria-hidden className="grid grid-cols-7 gap-[3px]">
                          {Array.from({ length: CELLS }, (_, c) => (
                            <span
                              key={c}
                              className="relative block size-[11px] rounded-[3px] border border-pp-hair"
                            >
                              {c === BOOKED && (
                                <motion.span
                                  className="absolute -inset-px rounded-[3px] border border-pp-accent bg-pp-accent/15"
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
      </Frame>
    </section>
  );
}
