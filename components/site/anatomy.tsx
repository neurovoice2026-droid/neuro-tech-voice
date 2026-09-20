"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { ANATOMY_INTRO, STACK } from "@/lib/site";
import { cn } from "@/lib/utils";
import { Frame, SectionHeading } from "./product/primitives";
import { CornerDot } from "./corner-dot";
import { IntentLink } from "./intent-link";
import { holdFor, useInView, usePrefersReducedMotion } from "./product/timing";

/**
 * One call walking the stack, live, and where the market stops.
 *
 * THE SCENE. A call runs. It enters at the left of the figure and moves
 * station by station through the ten things that have to happen before a
 * caller hears a word: the line is DRAWN ahead of it, each station inks as
 * the call reaches it, the head marks where the call is right now, and at
 * station 08 the branch climbs to the calendar and an appointment is
 * written into the month. It reaches station 10, the finished call sits
 * for a beat, and the next call comes in. Nobody has to scroll for any of
 * it: the section is alive the moment it is on screen, and what it is
 * alive with is the product doing its job.
 *
 * That is the whole reason this replaced scroll choreography. The section
 * used to draw its line from the reader's scroll position — the figure
 * moved because the page moved, which says nothing about a phone call. A
 * scene that runs says the thing the section is actually claiming: these
 * ten steps happen in an ORDER, the order is load-bearing, and you can buy
 * the first five from four vendors and the last five from nobody. A grid
 * cannot say "and then". A line can. A line being drawn in front of you,
 * at reading pace, says it without a sentence.
 *
 * THE CLOCK is the house clock, `./product/timing`. Every station holds
 * for `holdFor(note)` — its own word count at a reading pace, never under
 * 1.4s — so the run is paced by how long its notes take to read, not by a
 * round number someone liked. `useInView` gates the whole thing: off
 * screen, the timer is not scheduled, and it is cleared on unmount.
 * `usePrefersReducedMotion` readers get the finished call — every station
 * inked, the line whole, the appointment written — immediately, with no
 * timer ever set.
 *
 * THE READER WINS. First pointer, focus or key event inside the figure
 * hands the playhead over permanently and the autoplay never takes it
 * back. Pointing at or tabbing into a station puts the call THERE, so the
 * ten stations are themselves the control: the reader scrubs the call
 * through the stack at their own speed. A tap or key anywhere else in the
 * figure settles it on the finished call.
 *
 * THE MOVEMENT IS CSS. React owns one integer — which station the call is
 * at — and `transition-*` utilities do every pixel of the animating:
 * stroke-dashoffset for the drawn line, scale for the rail segments and
 * the dots, opacity for the booked cell. No motion library is imported
 * here, and no easing curve is hand-rolled.
 *
 * THE WORDS NEVER MOVE. Every station's label and note is at full
 * contrast from first paint. A backgrounded tab does not animate, and a
 * section whose content starts at 0.2 opacity is a section that can
 * arrive blank. The run is carried by the stroke, the dots and the
 * calendar — motion that draws rather than motion that glows, which is
 * the difference in tone between this surface and the cover.
 *
 * SET IN THE PRODUCT-PAGE SYSTEM (`.pp`), not the cover's. White stock,
 * black ink, violet for the product's own hand, Onest display over Inter
 * body, a single centred `Frame` column. The section carries `.pp` itself
 * and resets to a 16px base, so it stands on white whatever surrounds it.
 * All lengths are px/rem; the cover's fluid `em` base does not exist
 * inside a pp surface and nothing here may inherit it.
 *
 * Two decisions about the figure are worth defending:
 *
 *  · **The seam is the argument, so the stroke changes colour there.** The
 *    line's first half is violet-grey — the pp "not yet" ink, the same one
 *    the unreached dots carry — and its second half is the page's violet
 *    at full strength. Left of the change is commodity; right of it is the
 *    caller's business. Two paths, not one with a gradient: a gradient
 *    stop has to be told where 50% is in the path's own parameter space,
 *    and two paths cannot drift. The boundary itself is a plain hairline
 *    at the figure's midpoint, faded at both ends so it cannot be mistaken
 *    for a table divider.
 *
 *  · **The stations alternate above and below the line, and the numeral
 *    always sits nearest the line.** Ten blocks in a row inside the 1176px
 *    column give each one 117px — too narrow for a note to be read rather
 *    than decoded. Alternating doubles the usable width, so every block
 *    gets 14% of the column and the notes set in two or three lines. The
 *    spec's stacking (numeral above, label then note below) is kept
 *    literally for the below-line stations and MIRRORED for the above-line
 *    ones, via flex-col-reverse, because what has to stay constant is the
 *    numeral's adjacency to its own dot. DOM order is n / label / note
 *    either way, so a screen reader never sees the mirror.
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
 * reduced to a stub leaving station 08 to the right. The call runs down
 * that rail exactly as it runs along the desktop line.
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

/** The group boundary, as a fraction of the figure's width. */
const SEAM = 0.5;

/** Half the distance between two stations: how far past a station the head draws. */
const HALF_PITCH = 86 / 18;

const LAST = STACK.length - 1;

/** Station 08 — the one the branch leaves from. */
const BRANCH_AT = STACK.findIndex((s) => s.id === "calendar");

/** A beat of clean line before a call enters, and after one is done. */
const LEAD_IN = 520;
const REST = 2600;

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

/** How far the drawn line has got, 0–1, with the call at station `head`. */
function reachOf(head: number) {
  if (head < 0) return 0;
  if (head >= LAST) return 1;
  return Math.min(1, (X[head] + HALF_PITCH) / 100);
}

export function Anatomy() {
  const sectionRef = useRef<HTMLElement>(null);
  const reduce = usePrefersReducedMotion();
  const inView = useInView(sectionRef, "-12% 0px");

  /**
   * Where the call is. -1 is the clean line before a call enters; LAST is
   * the finished call. One integer is the entire animation state — every
   * stroke, dot, rail and cell below is a pure function of it, and the
   * browser interpolates the rest.
   */
  const [head, setHead] = useState(-1);
  const [taken, setTaken] = useState(false);
  const takenRef = useRef(false);

  /**
   * The run. One timeout at a time, re-armed from the station it just
   * reached, so every station holds for its own reading time instead of a
   * shared tick. Not scheduled at all while the figure is off screen or
   * once the reader has taken the playhead, and cleared on unmount.
   */
  useEffect(() => {
    if (reduce || taken || !inView) return;
    const wait = head < 0 ? LEAD_IN : head >= LAST ? REST : holdFor(STACK[head].note);
    const id = window.setTimeout(() => setHead((h) => (h >= LAST ? -1 : h + 1)), wait);
    return () => window.clearTimeout(id);
  }, [head, inView, taken, reduce]);

  /**
   * The reader takes the playhead, permanently. `at` is the station they
   * pointed at or tabbed into; `null` is a tap or a key anywhere else in
   * the figure, which on the FIRST such event settles on the finished
   * call and afterwards leaves the head wherever the reader put it.
   */
  const take = useCallback((at: number | null) => {
    const first = !takenRef.current;
    takenRef.current = true;
    setTaken(true);
    if (at !== null) setHead(at);
    else if (first) setHead(LAST);
  }, []);

  /**
   * Where the figure draws the call. Reduced motion is not a paused run
   * but a finished one: the last station, derived rather than stored, so
   * those readers get the whole line, every dot and the written
   * appointment on the first paint that knows their preference.
   */
  const at = reduce ? LAST : head;

  const reach = reachOf(at);
  const leftP = Math.min(reach, SEAM) / SEAM;
  const rightP = Math.max(0, (reach - SEAM) / (1 - SEAM));
  const booked = at >= BRANCH_AT;

  // The line draws at the page's reveal speed and CLEARS at twice that, so
  // the reset between two calls reads as a fresh line rather than a rewind.
  const draw = at < 0 ? "duration-200" : "duration-500";

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
        <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-500 fill-mode-both">
          <SectionHeading eyebrow={ANATOMY_INTRO.kicker}>
            {ANATOMY_INTRO.title}
          </SectionHeading>
        </div>

        <p className="mt-5 max-w-[680px] text-pretty text-[17px] leading-7 text-pp-muted animate-in fade-in-0 slide-in-from-bottom-2 duration-500 delay-100 fill-mode-both md:text-[19px] md:leading-8">
          {ANATOMY_INTRO.sub}
        </p>

        {/* A plain hairline rather than <Rule>: Rule is itself a Frame, and
            nesting one inside this column would inset it twice. */}
        <div aria-hidden className="mt-10 h-px bg-pp-rule" />

        {/* the figure */}
        <div
          className="relative mt-12 md:mt-20 md:h-[544px]"
          onPointerDown={() => take(null)}
          onKeyDown={() => take(null)}
          onFocusCapture={() => take(null)}
        >
          {/*
            The line. viewBox 0 0 100 100 with preserveAspectRatio="none"
            so x and y are simply percentages of the figure — every
            segment here is axis-aligned, so the uneven scale costs
            nothing, and non-scaling-stroke keeps the hairline a hairline
            at any width. Each path carries pathLength 1, so one dash of
            length 1 and a transitioning dash offset draw it exactly as
            far as the call has got.
          */}
          <svg
            aria-hidden
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 hidden size-full md:block"
          >
            <path
              d="M 0 56.25 H 50"
              pathLength={1}
              fill="none"
              stroke={STACK_STROKE}
              strokeOpacity={STACK_STROKE_OPACITY}
              strokeWidth={1}
              strokeDasharray={1}
              vectorEffect="non-scaling-stroke"
              className={cn("transition-[stroke-dashoffset] ease-out", draw)}
              style={{ strokeDashoffset: 1 - leftP }}
            />
            <path
              d="M 50 56.25 H 100"
              pathLength={1}
              fill="none"
              stroke="var(--pp-accent)"
              strokeWidth={1}
              strokeDasharray={1}
              vectorEffect="non-scaling-stroke"
              className={cn("transition-[stroke-dashoffset] ease-out", draw)}
              style={{ strokeDashoffset: 1 - rightP }}
            />
            {/* The branch: straight up from station 08, through the gap
                between the blocks of 07 and 09, to the calendar tier. It
                climbs when the call arrives at 08. */}
            <path
              d={`M ${X[BRANCH_AT]} 56.25 V 18.75`}
              pathLength={1}
              fill="none"
              stroke="var(--pp-accent)"
              strokeOpacity={0.45}
              strokeWidth={1}
              strokeDasharray={1}
              vectorEffect="non-scaling-stroke"
              className={cn("transition-[stroke-dashoffset] ease-out", draw)}
              style={{ strokeDashoffset: booked ? 0 : 1 }}
            />
          </svg>

          {/*
            The seam, as a hairline.

            The stroke already changes from the "not yet" grey to the
            page's violet exactly here, and a change of colour mid-line is
            a sharper statement of "the market stops" than any amount of
            texture — which is also why the call visibly crosses it. The
            fade at both ends keeps the seam from reading as a table
            divider.
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
              const last = i === LAST;
              const href = HREF[s.id];
              const on = i <= at;
              const here = i === at;
              const business = s.group === "business";

              return (
                <li
                  key={s.id}
                  style={{ "--x": `${X[i]}%` } as CSSProperties}
                  // Pointing at a station, or tabbing into its link, puts
                  // the call there: the stations ARE the scrub control.
                  onPointerEnter={() => take(i)}
                  onFocus={() => take(i)}
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
                    <span
                      aria-hidden
                      className={cn(
                        "absolute left-[22px] top-4 w-px origin-top transition-transform duration-500 ease-out md:hidden",
                        business ? "bg-pp-accent" : "bg-pp-muted/50",
                        i === 4 ? "h-[calc(100%-2px)]" : "h-[calc(100%+12px)]",
                        on ? "scale-y-100" : "scale-y-0",
                      )}
                    />
                  )}
                  {i === 5 && (
                    <>
                      <span
                        aria-hidden
                        className={cn(
                          "absolute -top-[14px] left-[22px] h-[14px] w-px origin-top bg-pp-accent transition-transform duration-500 ease-out md:hidden",
                          on ? "scale-y-100" : "scale-y-0",
                        )}
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

                  {/* The station itself: unlit until the call reaches it,
                      lit after, and marked while the call is standing on
                      it. The mark is a ring that only exists while the
                      figure is on screen and motion is wanted. */}
                  <span
                    aria-hidden
                    className={cn(
                      "absolute left-4 top-0 size-[13px] transition duration-300 ease-out md:left-1/2 md:size-3 md:-translate-x-1/2",
                      above ? "md:-bottom-8 md:top-auto" : "md:-top-8",
                      business ? "text-pp-accent" : "text-pp-muted",
                      here
                        ? "scale-110 opacity-100"
                        : on
                          ? "scale-100 opacity-100"
                          : "scale-[0.6] opacity-30",
                    )}
                  >
                    <CornerDot className="size-full" />
                    {here && inView && !reduce && (
                      <span
                        className={cn(
                          "absolute -inset-1 rounded-full animate-ping",
                          business ? "bg-pp-accent/20" : "bg-pp-muted/20",
                        )}
                      />
                    )}
                  </span>

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

                  {/* The booking being written, as the call stands on 08.
                      On the phone the branch is a stub leaving to the
                      right; on the desktop figure the card is lifted to
                      the top tier and the SVG branch reaches up to it. */}
                  {i === BRANCH_AT && (
                    <div className="mt-3 flex items-center md:absolute md:bottom-[calc(100%+230px)] md:left-1/2 md:mt-0 md:w-[150px] md:-translate-x-1/2 md:flex-col">
                      <span
                        aria-hidden
                        className={cn(
                          "h-px w-6 shrink-0 origin-left bg-pp-accent/45 transition-transform duration-500 ease-out md:hidden",
                          booked ? "scale-x-100" : "scale-x-0",
                        )}
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
                                <span
                                  className={cn(
                                    "absolute -inset-px rounded-[3px] border border-pp-accent bg-pp-accent/15 transition-opacity duration-500 ease-out",
                                    booked ? "opacity-100 delay-200" : "opacity-0",
                                  )}
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
