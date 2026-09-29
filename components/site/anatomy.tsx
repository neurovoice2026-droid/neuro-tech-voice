"use client";

import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import type { gsap } from "gsap";
import { ANATOMY_INTRO, STACK } from "@/lib/site";
import { cn } from "@/lib/utils";
import { Frame, SectionHeading } from "./product/primitives";
import { CornerDot } from "./corner-dot";
import { IntentLink } from "./intent-link";
import { useKitContext, useMotionKit } from "./product/motion-kit";
import { holdFor, useInView, usePrefersReducedMotion } from "./product/timing";

/**
 * One call walking the stack, live, and where the market stops.
 *
 * THE SIGNATURE MOVEMENT IS THE CALL ITSELF, AS AN OBJECT. A violet head
 * enters at the left edge of the figure and travels the line station by
 * station. It is not a metaphor for the call, it is the call: the line
 * does not fade in behind it, it is UNCOVERED by it — one clip window
 * whose right edge and the head's own position are the same number, so
 * the stroke cannot be anywhere the call has not been. The head slows
 * into each station, the dot there lands and takes its ink, the head
 * sends out a ring and moves on. It crosses the seam at the midpoint and
 * the stroke behind it changes from the "not yet" grey to the page's
 * violet, because that is the moment the market stops selling and the
 * work starts. At station 08 an appointment LEAVES the call — a violet
 * node travels an arc up into the Google Calendar card while the arc
 * draws under it, and a cell in the month lights when it gets there. The
 * call reaches station 10, runs off the end leaving the line whole, the
 * finished call sits for a beat, and the next one comes in.
 *
 * That is the argument. A grid cannot say "and then"; a line being drawn
 * in front of you, at reading pace, by a thing that is visibly going
 * somewhere, says it without a sentence. It is also why this replaced
 * scroll choreography: the figure used to move because the page moved,
 * which says nothing about a phone call.
 *
 * HOW IT IS BUILT. GSAP, fetched lazily through `./product/motion-kit`
 * the way every figure on the product pages fetches it — one timeline,
 * `paused: true`, built inside a `useKitContext` scoped to the figure so
 * nothing it touches outlives the section. `DrawSVGPlugin` draws the
 * calendar arc under its ghost twin; `MotionPathPlugin` carries the
 * booking along that same arc, so the node and the line it rides are one
 * object by construction rather than two tweens that happen to agree.
 * SplitText is deliberately not used — see THE WORDS NEVER MOVE below.
 * There is no shader band here: this figure is hairlines on white, and
 * anything behind it would cost the legibility the geometry below is
 * built for. A band with nothing to say is worse than no band.
 *
 * THE CLOCK IS STILL THE HOUSE CLOCK, `./product/timing`. Every station's
 * beat is `holdFor(note)` — its own word count at a reading pace, never
 * under 1.4s — and the timeline's absolute positions are DERIVED from
 * that sum rather than hand-tuned, so the run is paced by how long its
 * notes take to read. `useInView` gates it at two margins, the house's
 * two: 25% out fetches GSAP, 12% in plays the timeline. Off screen it is
 * paused, not running invisibly, and the context reverts on unmount.
 *
 * THE MARKUP RESTS FINISHED AND THE TIMELINE REWINDS IT. Every dot is
 * inked, the line is whole and the appointment is written in the HTML the
 * server sends. The timeline's first act, once it exists, is to `set` all
 * of that back to nothing. So a reader with no JavaScript, a reader on a
 * phone that never gets to the idle callback, and a reader who asked for
 * reduced motion all get the same complete picture — a third authored
 * state, not an absence — and with `prefers-reduced-motion` GSAP is never
 * fetched at all.
 *
 * THE READER WINS. First pointer, focus or key event inside the figure
 * hands the playhead over permanently and the autoplay never takes it
 * back. Pointing at or tabbing into a station seeks the timeline to that
 * station's second, so the ten stations are themselves the control: the
 * reader scrubs the call through the stack at their own speed, and what
 * they are scrubbing is the real thing rather than a second, simpler copy
 * of it. A tap or key anywhere else in the figure settles it on the
 * finished call.
 *
 * SMALL STATE CHANGES ARE STILL CSS. The phone's rails, the link
 * underlines and the mobile branch stub are `transition-*` utilities off
 * one integer of React state, which the timeline updates as it passes
 * each station. GSAP owns the composed movement; it does not own hover.
 *
 * THE WORDS NEVER MOVE. Every station's label and note is at full
 * contrast from first paint, and none of them is split. These are notes
 * to be read, not speech to be heard — the house splits type when it is
 * being spoken, and staggering a paragraph the reader is already reading
 * is an entrance, which is decoration. The run is carried by the head,
 * the stroke, the dots and the calendar: motion that draws rather than
 * motion that glows, which is the difference in tone between this surface
 * and the cover.
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
 *    caller's business. Two strokes under one clip window, not one stroke
 *    with a gradient: a gradient stop has to be told where 50% is in the
 *    path's own parameter space, and it would also have to be drawn by a
 *    dash offset, which cannot be the same number as the head's position.
 *    The clip can. The boundary itself is a plain hairline at the figure's
 *    midpoint, faded at both ends so it cannot be mistaken for a table
 *    divider.
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
 *   branch overlay              306 - 102 = 204px tall, from y = 102px
 *
 * Below 768px none of it survives — a ten-station horizontal path on a
 * phone is a horizontal scrollbar — so the path stands up: one station per
 * row, the rail down the left gutter at 22px, the seam laid flat in the
 * middle of the gap between rows 05 and 06, and the calendar branch
 * reduced to a stub leaving station 08 to the right. The travelling head
 * and the drawn line are desktop-only; on a phone the same timeline lands
 * the same dots at the same seconds, and the rails grow under them.
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

const LAST = STACK.length - 1;

/** Station 08 — the one the branch leaves from. */
const BRANCH_AT = STACK.findIndex((s) => s.id === "calendar");

/** A beat of clean line before a call enters, and after one is done. */
const LEAD_IN = 520;
const REST = 2600;

/**
 * How long the call takes to cross from one station to the next. A move,
 * so it sits in the house's 0.5–0.9s band; `power2.inOut` because the call
 * leaves a station and settles on the next one rather than sliding past.
 */
const TRAVEL = 0.62;

/**
 * When the call stands on each station, in seconds, derived — never
 * hand-tuned. Station `i` is reached once every note before it has had its
 * own reading time, after one lead-in of clean line.
 */
const T = (() => {
  const times: number[] = [];
  let t = LEAD_IN / 1000;
  for (const s of STACK) {
    times.push(t);
    t += holdFor(s.note) / 1000;
  }
  return times;
})();

/** The call is over and the line is whole: where the reader's first tap lands. */
const SETTLED = T[LAST] + 1.5;

/** The figure clears, and the next call comes in. */
const END = T[LAST] + REST / 1000;

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
 * The branch, in its own 1:1 overlay — 120 × 204 css px sitting between
 * the line and the calendar card, centred on station 08.
 *
 * It bows left rather than climbing straight, because a hand-off is not a
 * riser: the appointment LEAVES the call and goes somewhere else, and an
 * arc says that where a vertical says "column rule". The bow tops out 30px
 * left of centre, well inside the ~112px gap between the blocks of 07 and
 * 09, and the two cubics share a vertical tangent at the waist so the
 * traveller never kinks. It ends 2px under the card, and its foot is on
 * the line.
 */
const BRANCH_W = 120;
const BRANCH_H = 204;
const BRANCH = `M ${BRANCH_W / 2} ${BRANCH_H} C ${BRANCH_W / 2} 164 30 148 30 102 C 30 56 ${BRANCH_W / 2} 42 ${BRANCH_W / 2} 2`;

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
  const figureRef = useRef<HTMLDivElement>(null);
  const reduce = usePrefersReducedMotion();
  // Two margins, two jobs: `near` fetches GSAP, `inView` plays the run.
  const inView = useInView(sectionRef, "-12% 0px");
  const near = useInView(sectionRef, "25% 0px");
  // `near && !reduce`, because the markup already rests finished: with
  // reduced motion the library is never downloaded at all.
  const kit = useMotionKit(near && !reduce);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  /**
   * Where the call is. -1 is the clean line before a call enters; LAST is
   * the finished call, which is where it starts so the server's markup is
   * the complete figure. The timeline rewinds it on its first frame.
   *
   * GSAP owns every pixel that moves. This integer owns the things that
   * only change state: the phone's rails, the mobile branch stub.
   */
  const [head, setHead] = useState(LAST);
  const [taken, setTaken] = useState(false);
  const takenRef = useRef(false);
  // Where the READER put the call, for the timeline builder to read: it
  // runs outside the render, and it only ever asks once the reader has
  // taken the playhead, which is the one path that writes this.
  const headRef = useRef(LAST);

  const clipId = `anatomy-clip-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  useKitContext(
    kit,
    ({ gsap }) => {
      if (reduce) return;
      const q = gsap.utils.selector(figureRef);

      const call = q(".an-head")[0] as HTMLElement | undefined;
      // The selector is typed off an HTML scope, so the SVG members it
      // hands back need the cast spelled out.
      const clip = q(".an-clip")[0] as unknown as SVGRectElement | undefined;
      const branch = q(".an-branch")[0] as unknown as SVGPathElement | undefined;
      if (!call || !clip || !branch) return;

      const ring = q(".an-head-ring");
      const dots = q(".an-dot");
      const booking = q(".an-booking");
      const cell = q(".an-cell");
      const cellRing = q(".an-cell-ring");

      const tl = gsap.timeline({ paused: true, repeat: -1 });

      /* The whole resting state, set at the top: a clean line, no station
         reached, nothing written into the month. This is the rewind — the
         markup arrives finished and the timeline takes it back to zero. */
      tl.set(call, { left: "0%", autoAlpha: 0 }, 0)
        .set(ring, { scale: 0.4, autoAlpha: 0 }, 0)
        .set(clip, { attr: { x: 0, width: 0 } }, 0)
        .set(dots, { scale: 0.6, autoAlpha: 0.3 }, 0)
        .set(branch, { drawSVG: "0% 0%" }, 0)
        .set(booking, { autoAlpha: 0 }, 0)
        .set([...cell, ...cellRing], { autoAlpha: 0 }, 0)
        .to(call, { autoAlpha: 1, duration: 0.3 }, 0.1);

      /* The run. One travel tween per station, and the clip window's right
         edge is given the same number, the same duration and the same ease
         as the head's own position — so the stroke IS where the call has
         been, rather than a second animation that agrees with it. */
      STACK.forEach((_, i) => {
        const start = Math.max(0, T[i] - TRAVEL);
        const dur = T[i] - start;
        tl.to(call, { left: `${X[i]}%`, duration: dur, ease: "power2.inOut" }, start)
          .to(clip, { attr: { width: X[i] }, duration: dur, ease: "power2.inOut" }, start)
          // The station lands: it takes its ink, overshoots, settles.
          .to(dots[i], { scale: 1.15, autoAlpha: 1, duration: 0.22, ease: "power2.out" }, T[i])
          .to(dots[i], { scale: 1, duration: 0.4, ease: "power2.out" }, T[i] + 0.22)
          // The house's arrival mark, carried by the head rather than
          // printed at every station: one ring, wherever the call is.
          .fromTo(
            ring,
            { scale: 0.4, autoAlpha: 0.55 },
            { scale: 2.6, autoAlpha: 0, duration: 1, ease: "power2.out", immediateRender: false },
            T[i],
          )
          .call(() => setHead(i), [], T[i]);
      });

      /* Station 08: the appointment leaves the call. The arc draws and the
         booking rides that same path — one object, not two. */
      const book = T[BRANCH_AT] + 0.25;
      tl.to(branch, { drawSVG: "0% 100%", duration: 1.1, ease: "power2.out" }, book)
        .to(booking, { autoAlpha: 1, duration: 0.25 }, book)
        .to(
          booking,
          {
            duration: 1.1,
            ease: "power2.inOut",
            motionPath: { path: branch, align: branch, alignOrigin: [0.5, 0.5] },
          },
          book,
        )
        .to(booking, { autoAlpha: 0, duration: 0.3 }, book + 1.05)
        .to(cell, { autoAlpha: 1, duration: 0.4, ease: "power2.out" }, book + 1.1)
        .fromTo(
          cellRing,
          { scale: 0.5, autoAlpha: 0.7 },
          { scale: 1.9, autoAlpha: 0, duration: 0.9, ease: "power2.out", immediateRender: false },
          book + 1.1,
        );

      /* The call runs off the end and leaves the line whole behind it. */
      const off = T[LAST] + 0.5;
      tl.to(call, { left: "100%", duration: 0.9, ease: "power2.in" }, off)
        .to(clip, { attr: { width: 100 }, duration: 0.9, ease: "power2.in" }, off)
        .to(call, { autoAlpha: 0, duration: 0.35 }, off + 0.55);

      /* The figure clears. The window slides off to the right rather than
         retracting, so the reset reads as a fresh line and not a rewind —
         and it clears at roughly twice the speed it drew at. */
      tl.to(clip, { attr: { x: 100, width: 0 }, duration: 0.35, ease: "power2.in" }, END)
        .to(dots, { scale: 0.6, autoAlpha: 0.3, duration: 0.3 }, END)
        .to(branch, { drawSVG: "100% 100%", duration: 0.35, ease: "power2.inOut" }, END)
        .to(cell, { autoAlpha: 0, duration: 0.3 }, END)
        .call(() => setHead(-1), [], END)
        // A beat of clean line, written as a tween and never as a delay.
        .to({}, { duration: LEAD_IN / 1000 }, END + 0.35);

      tlRef.current = tl;

      // If the reader got here before GSAP did, the timeline is born where
      // they left it; otherwise it is born rewound and React follows.
      if (takenRef.current) {
        const h = headRef.current;
        tl.pause(h >= 0 && h < LAST ? T[h] : SETTLED);
      } else {
        setHead(-1);
      }

      return () => {
        tlRef.current = null;
      };
    },
    // `revertOnUpdate` because the callback sets inline styles: flipping
    // the OS setting has to put the finished figure back, untouched.
    { scope: figureRef, dependencies: [reduce], revertOnUpdate: true },
  );

  /**
   * Plays while on screen, and never once the reader has the playhead.
   * `kit` is in the deps because the timeline is built asynchronously,
   * after the library arrives.
   */
  useEffect(() => {
    const tl = tlRef.current;
    if (!tl) return;
    if (inView && !reduce && !taken) tl.play();
    else tl.pause();
  }, [inView, reduce, taken, kit]);

  /**
   * The reader takes the playhead, permanently. `at` is the station they
   * pointed at or tabbed into — the timeline is SEEKED to that station's
   * own second, so what they are scrubbing is the run itself. `null` is a
   * tap or a key anywhere else in the figure, which on the FIRST such
   * event settles on the finished call and afterwards leaves the head
   * wherever the reader put it.
   */
  const take = useCallback((at: number | null) => {
    const first = !takenRef.current;
    takenRef.current = true;
    setTaken(true);
    const tl = tlRef.current;
    if (at !== null) {
      headRef.current = at;
      setHead(at);
      tl?.pause(T[at]);
    } else if (first) {
      headRef.current = LAST;
      setHead(LAST);
      tl?.pause(SETTLED);
    }
  }, []);

  /**
   * What the state-driven parts read. Reduced motion is not a paused run
   * but a finished one: the last station, derived rather than stored, so
   * those readers get every rail and the written appointment on the first
   * paint that knows their preference.
   */
  const at = reduce ? LAST : head;
  const booked = at >= BRANCH_AT;

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
        <SectionHeading eyebrow={ANATOMY_INTRO.kicker}>{ANATOMY_INTRO.title}</SectionHeading>

        <p className="mt-5 max-w-[680px] text-pretty text-[17px] leading-7 text-pp-muted md:text-[19px] md:leading-8">
          {ANATOMY_INTRO.sub}
        </p>

        {/* A plain hairline rather than <Rule>: Rule is itself a Frame, and
            nesting one inside this column would inset it twice. */}
        <div aria-hidden className="mt-10 h-px bg-pp-rule" />

        {/* the figure */}
        <div
          ref={figureRef}
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
            at any width. Both halves live under one clip window whose
            right edge is the call's own position, so the stroke is
            uncovered by the head rather than animated alongside it.
          */}
          <svg
            aria-hidden
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 hidden size-full md:block"
          >
            <defs>
              <clipPath id={clipId}>
                {/* Rests open across the whole figure: with no JavaScript
                    and with reduced motion, the line is simply whole. */}
                <rect className="an-clip" x="0" y="0" width="100" height="100" />
              </clipPath>
            </defs>
            <g clipPath={`url(#${clipId})`}>
              <line
                x1="0"
                x2={SEAM * 100}
                y1="56.25"
                y2="56.25"
                stroke={STACK_STROKE}
                strokeOpacity={STACK_STROKE_OPACITY}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1={SEAM * 100}
                x2="100"
                y1="56.25"
                y2="56.25"
                stroke="var(--pp-accent)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          </svg>

          {/*
            The branch, in its own overlay at 1:1 — a fixed 120 × 204 box
            with a matching viewBox, so the arc is never sheared by the
            figure's own uneven scale and DrawSVG and MotionPath are both
            working in real pixels.

            Ghost first, then ink: the pair every drawn stroke in this
            house is made of. Resting drawn, like everything else here.
          */}
          <svg
            aria-hidden
            viewBox={`0 0 ${BRANCH_W} ${BRANCH_H}`}
            className="pointer-events-none absolute top-[102px] hidden h-[204px] w-[120px] md:block"
            style={{ left: `${X[BRANCH_AT]}%`, transform: "translateX(-50%)" }}
          >
            <path d={BRANCH} fill="none" stroke="var(--pp-accent)" strokeOpacity="0.16" strokeWidth={1.2} strokeLinecap="round" />
            <path
              className="an-branch"
              d={BRANCH}
              fill="none"
              stroke="var(--pp-accent)"
              strokeOpacity="0.5"
              strokeWidth={1.2}
              strokeLinecap="round"
            />
            {/* Parked at the origin and invisible until the path moves it. */}
            <circle className="an-booking" cx="0" cy="0" r="3.4" fill="var(--pp-accent)" opacity="0" />
          </svg>

          {/*
            The call. One object, carrying its own arrival ring, travelling
            the line. Its position is set inline and animated as `left`:
            GSAP writes `transform`, and a Tailwind translate utility on
            the same element would compose on top of it.
          */}
          <div
            aria-hidden
            className="an-head pointer-events-none absolute top-[56.25%] hidden md:block"
            style={{ left: "0%", transform: "translate(-50%, -50%)", opacity: 0 }}
          >
            <span className="relative block size-2">
              <span
                className="an-head-ring absolute -inset-2 rounded-full bg-pp-accent/20"
                style={{ opacity: 0 }}
              />
              <span className="absolute inset-0 rounded-full bg-pp-accent" />
            </span>
          </div>

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
              const business = s.group === "business";

              return (
                <li
                  key={s.id}
                  style={{ "--x": `${X[i]}%` } as CSSProperties}
                  // Pointing at a station, or tabbing into its link, seeks
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
                      lies; row 06 starts again just under it. A state
                      change, so it stays a CSS transition. */}
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

                  {/* The station itself. The outer span does the
                      positioning — which differs between the phone's
                      stack and the desktop line — and the inner one is
                      what the timeline scales and inks, so nothing GSAP
                      touches carries a transform utility of its own. It
                      rests lit: the timeline dims it on its first frame. */}
                  <span
                    aria-hidden
                    className={cn(
                      "absolute left-4 top-0 size-[13px] md:left-1/2 md:size-3 md:-translate-x-1/2",
                      above ? "md:-bottom-8 md:top-auto" : "md:-top-8",
                      business ? "text-pp-accent" : "text-pp-muted",
                    )}
                  >
                    <span className="an-dot block size-full">
                      <CornerDot className="size-full" />
                    </span>
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
                      the top tier and the arc overlay reaches up to it. */}
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
                                <>
                                  {/* The arrival mark, then the cell. The
                                      ring is transient and rests at zero;
                                      the cell rests written, and the
                                      timeline clears it on frame one. */}
                                  <span
                                    className="an-cell-ring absolute -inset-1.5 rounded-[5px] border border-pp-accent"
                                    style={{ opacity: 0 }}
                                  />
                                  <span className="an-cell absolute -inset-px rounded-[3px] border border-pp-accent bg-pp-accent/15" />
                                </>
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
