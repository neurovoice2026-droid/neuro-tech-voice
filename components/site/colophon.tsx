"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { gsap } from "gsap";
import Image from "next/image";
import { COLOPHON, INTEGRATIONS } from "@/lib/site";
import { CornerDot } from "./corner-dot";
import { ping } from "./product/line-figure";
import { useKitContext, useMotionKit } from "./product/motion-kit";
import { Eyebrow, Frame } from "./product/primitives";
import { holdFor, useInView, usePrefersReducedMotion } from "./product/timing";

/**
 * The colophon strip — the first white thing on the page, and the first
 * thing on the page that is doing something rather than arriving.
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
 * THE MOVEMENT: A HEAD THAT DRAWS THE LINE IT WALKS ON.
 *
 * The paragraph on the right is the whole claim of this band — the agent
 * is inside your tools while the caller is still on the line, one at a
 * time, in order. So there is exactly one moving thing on this strip: a
 * violet head that enters at the left edge of a tool's baseline and
 * crosses it at constant speed, laying an ink hairline down behind it as
 * it goes. When it runs out of tool it steps off into the punctuation,
 * which pings, the line it drew withdraws the way it came, and the next
 * tool's line begins. The logo it is standing on comes up to its own
 * colours and its name goes to ink; everything it has left, and everything
 * it has not reached, sits back in grey.
 *
 * That is why the line is DRAWN rather than wiped. A bar that grows is a
 * progress meter — it says "waiting". A line being drawn by something that
 * is moving says the thing moved through here, which is the only claim
 * this band makes. Five logos fading up on scroll say "these exist". A
 * head walking them in turn says "these are wired, and something is using
 * them right now".
 *
 * WHICH PLUGINS, AND WHY ONLY THESE. DrawSVGPlugin draws the hairline,
 * because a hairline appearing under a name is the mark the head leaves.
 * MotionPath is not here: the route is one straight rule per tool, and
 * putting a path element under a horizontal line to travel it would be
 * ceremony. SplitText is not here either: the only prose in this band is a
 * four-clause paragraph of small grey type, and a paragraph that arrives
 * word by word at reading pace is decoration in front of a claim the
 * reader wants whole.
 *
 * ON THE HOUSE CLOCK. Every crossing lasts holdFor(label) — the same
 * reading-pace hold the strip has always used, floored at 1.4s — so the
 * timeline's seconds are derived from the words on screen rather than
 * tuned. `near` fetches GSAP a quarter-screen early, `inView` plays and
 * pauses it, and a hidden tab or a departed strip stops it dead.
 *
 * REDUCED MOTION IS A THIRD FRAME, NOT AN ABSENCE. GSAP is never fetched
 * for those readers at all: the markup already rests on the scene's most
 * informative frame — every tool lit at once, no head, no line.
 *
 * THE READER WINS. The first pointer, focus or key event anywhere in the
 * strip retires the walk for good; the timeline is reverted, taking the
 * head and its ink with it, and the tool under the reader's pointer is
 * ruled by a plain CSS transition instead. It never takes control back.
 */

/** The head appearing at the left of a rule, and stepping off the right. */
const IN = 0.28;
const OUT = 0.3;
/** The ink withdrawing the way it came, inside the gap before the next tool. */
const RETRACT = 0.28;
const GAP = 0.34;

export function Colophon() {
  const reduce = usePrefersReducedMotion();
  const rootRef = useRef<HTMLElement>(null);
  // Two margins, two jobs: `near` fetches GSAP, `inView` plays the walk.
  const inView = useInView(rootRef, "-10% 0px");
  const near = useInView(rootRef, "25% 0px");

  // -1 is "every tool lit": the still frame of the scene, which is what
  // the server renders, what reduced motion keeps, and what the strip
  // falls back to before it has ever played.
  const [head, setHead] = useState(-1);
  const [taken, setTaken] = useState(false);

  // A background tab keeps its IntersectionObserver entries, and this strip
  // sits high enough that it is usually still "on screen" when the reader
  // switches away. So the clock watches the tab as well as the viewport.
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const on = () => setHidden(document.hidden);
    on();
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);

  // Reduced motion needs no GSAP at all: the markup below rests complete.
  const kit = useMotionKit(near && !reduce);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  useKitContext(
    kit,
    ({ gsap }) => {
      // Once the reader has taken the strip, nothing is built and nothing
      // is left behind: the revert that precedes this run has already put
      // the ink and the head back to their resting state.
      if (taken || reduce) return;

      const q = gsap.utils.selector(rootRef);
      const rails = q(".cl-rail") as HTMLElement[];
      const inks = q(".cl-ink");
      const heads = q(".cl-head");
      const pings = q(".cl-ping");
      if (!rails.length) return;

      // Function-based distances, re-read on every lap: the strip wraps to
      // two lines on a narrow screen and each rule is as wide as its own
      // name, so the crossing is measured rather than assumed.
      const tl: gsap.core.Timeline = gsap.timeline({
        paused: true,
        repeat: -1,
        onRepeat: () => tl.invalidate(),
      });

      let t = 0;
      INTEGRATIONS.forEach((it, i) => {
        const hold = holdFor(it.label) / 1000;
        const rail = rails[i];
        const ink = inks[i];
        const dot = heads[i];

        // The tool comes to full strength on the head's arrival, not on a
        // React commit a beat away from it.
        tl.call(() => setHead(i), [], t)
          .set(ink, { opacity: 1, drawSVG: "0% 0%" }, t)
          .fromTo(dot, { opacity: 0 }, { opacity: 1, duration: IN, ease: "power2.out", immediateRender: false }, t)
          // The head and the ink are one object: same start, same length,
          // same constant speed, so the line can only ever end where the
          // head is.
          .fromTo(
            dot,
            { x: 0 },
            { x: () => rail.offsetWidth - 5, duration: hold, ease: "none", immediateRender: false },
            t,
          )
          .to(ink, { drawSVG: "0% 100%", duration: hold, ease: "none" }, t)
          .to(dot, { opacity: 0, duration: OUT, ease: "power2.in" }, t + hold);

        // It steps off into the punctuation on its way to the next tool.
        if (pings[i]) ping(tl, [pings[i]], t + hold, 14);

        tl.to(ink, { drawSVG: "100% 100%", duration: RETRACT, ease: "power2.inOut" }, t + hold + 0.06).set(
          ink,
          { opacity: 0 },
          t + hold + 0.06 + RETRACT,
        );

        t += hold + GAP;
      });

      // The rest beat before the next call, written as a hold rather than
      // a delay, so the loop closes on the same still frame it opened on.
      tl.to({}, { duration: 0.6 }, t);

      tlRef.current = tl;
      return () => {
        tlRef.current = null;
      };
    },
    // Everything here sets inline styles and does `fromTo`, so the context
    // must revert before it runs again — and reverting is exactly what
    // hands the strip back to CSS when the reader takes it.
    { scope: rootRef, dependencies: [taken, reduce], revertOnUpdate: true },
  );

  // Plays while on screen. `kit` is in the deps because the timeline is
  // built asynchronously, after the kit has arrived.
  useEffect(() => {
    const tl = tlRef.current;
    if (!tl) return;
    if (inView && !hidden && !reduce && !taken) tl.play();
    else tl.pause();
  }, [inView, hidden, reduce, taken, kit]);

  const takeOver = useCallback(() => setTaken(true), []);
  const point = (i: number) => {
    setTaken(true);
    setHead(i);
  };

  // Reduced motion, and the untouched first frame, light everything.
  const all = head < 0;

  return (
    <section
      ref={rootRef}
      aria-label={COLOPHON.line}
      className="pp relative isolate"
      onPointerDownCapture={takeOver}
      onFocusCapture={takeOver}
      onKeyDownCapture={takeOver}
    >
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
            <span className="text-[12px] leading-4 tabular-nums text-pp-muted">
              {String(INTEGRATIONS.length).padStart(2, "0")}
            </span>
          </div>

          {/* The five marks. They wrap rather than scroll; at the narrowest
              width that is two lines of logos, which costs nothing and keeps
              every name selectable and findable by the browser's own search. */}
          <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-x-6 gap-y-3">
            {INTEGRATIONS.map((it, i) => {
              const live = all || head === i;
              return (
                <li key={it.label} className="flex items-center gap-6" onPointerEnter={() => point(i)}>
                  <span className="cl-rail relative flex items-center gap-2.5 pb-1">
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
                      className={`size-5 shrink-0 transition duration-300 ${
                        live ? "opacity-100 saturate-100" : "opacity-55 saturate-0"
                      }`}
                    />
                    <span
                      className={`whitespace-nowrap text-[15px] leading-6 tracking-[-0.01em] transition-colors duration-300 ${
                        live ? "text-pp-ink" : "text-pp-muted"
                      }`}
                    >
                      {it.label}
                    </span>

                    {/* The baseline: a ghost the head never touches, and the ink
                        copy it lays down over it. The viewBox is stretched to the
                        name's own width, which is why the strokes carry
                        non-scaling-stroke — a hairline is a hairline at every
                        width. The ink rests invisible because there is no tool in
                        hand until something picks one up, which is also the frame
                        a reduced-motion reader keeps. */}
                    <svg
                      aria-hidden
                      viewBox="0 0 100 1"
                      preserveAspectRatio="none"
                      fill="none"
                      className="absolute inset-x-0 bottom-0 h-px w-full"
                    >
                      <line
                        x1="0"
                        y1="0.5"
                        x2="100"
                        y2="0.5"
                        className="text-pp-hair"
                        stroke="currentColor"
                        strokeWidth="1"
                        vectorEffect="non-scaling-stroke"
                      />
                      <line
                        className="cl-ink text-pp-accent"
                        x1="0"
                        y1="0.5"
                        x2="100"
                        y2="0.5"
                        stroke="currentColor"
                        strokeWidth="1"
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                        style={{ opacity: 0 }}
                      />
                    </svg>

                    {/* The head. GSAP writes `transform`, so its resting position
                        is set inline rather than with a Tailwind translate
                        utility, which would compose on top and move it. */}
                    <span
                      aria-hidden
                      className="cl-head absolute -bottom-0.5 left-0 size-[5px] rounded-full bg-pp-accent"
                      style={{ opacity: 0, transform: "translate3d(0,0,0)" }}
                    />

                    {/* After the reader takes the strip there is no timeline and
                        no head, so the rule under the tool they are pointing at is
                        a plain state change — which is what a CSS transition is
                        for. It is a separate element from the ink above so the two
                        systems never write to the same style. */}
                    <span
                      aria-hidden
                      className="absolute inset-x-0 bottom-0 h-px origin-left bg-pp-accent transition-transform duration-300 ease-out motion-reduce:transition-none"
                      style={{ transform: `scaleX(${taken && head === i ? 1 : 0})` }}
                    />
                  </span>

                  {/* Punctuation between entries, never after the last one — and
                      the place the head steps off on its way to the next tool. */}
                  {i < INTEGRATIONS.length - 1 && (
                    <span className="relative flex shrink-0 items-center">
                      <CornerDot
                        className={`size-1.5 transition-colors duration-300 ${
                          !all && head === i ? "text-pp-accent" : "text-pp-muted/45"
                        }`}
                      />
                      <svg
                        aria-hidden
                        viewBox="0 0 24 24"
                        fill="none"
                        className="pointer-events-none absolute left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 overflow-visible text-pp-accent"
                      >
                        <circle
                          className="cl-ping"
                          cx="12"
                          cy="12"
                          r="5"
                          stroke="currentColor"
                          strokeWidth="1"
                          opacity="0"
                        />
                      </svg>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          {/* The only prose on the strip, and the only thing here that says
              what an integration actually does during a call. It outranks the
              logos, so it never hides and it never waits on the walk. */}
          <p className="max-w-[46ch] shrink-0 text-pretty text-[14px] leading-5 text-pp-muted md:max-w-[34ch] md:text-right">
            {COLOPHON.line}
          </p>
        </Frame>
      </div>
    </section>
  );
}
