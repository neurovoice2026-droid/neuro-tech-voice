"use client";

import { useEffect, useRef } from "react";
import type { gsap } from "gsap";
import { cn } from "@/lib/utils";
import { ppCinema, ppDisplay } from "./product/fonts";
import { LINE, Node, Ping, ping, VIOLET } from "./product/line-figure";
import { useKitContext, useMotionKit } from "./product/motion-kit";
import { Frame, SectionHeading } from "./product/primitives";
import { holdFor, useInView, usePrefersReducedMotion } from "./product/timing";
import { VoiceDemo } from "./voice-demo";

/**
 * The demo — the one place on the page where the product speaks for itself.
 *
 * **The scene is the call, and it answers itself.** This file used to wrap
 * its heading in scroll-triggered `Reveal`s and then sit still, waiting for
 * the reader to press a button before the product did anything at all. That
 * is backwards: an entrance is decoration, and a landing page that asks for
 * a click before it demonstrates anything has already lost the reader who
 * was only ever going to scroll. So the entrance is gone and the section is
 * now a projectionist. When the demo comes on screen it waits one beat —
 * `holdFor(MASTHEAD.title)`, the house clock's reading pace for the heading
 * above it — and then starts the call.
 *
 * **THE MOVEMENT IS THE CUE, AND THE CUE IS WHAT STARTS THE CALL.** That
 * beat used to be a `setTimeout` nobody could see: the heading faded up
 * because the reader had scrolled, then a second and a half of nothing
 * happened, then a call began on its own. Two unrelated events, neither of
 * them an argument. Now there is one timeline and it is exactly
 * `LEAD_IN_MS` long. The title arrives a word at a time — it is a sentence
 * being read, not a block being revealed — the standfirst comes up under
 * it, and then a violet mark leaves the left edge of the rule below and
 * crosses the column at a constant speed, drawing the rule in behind it as
 * it goes. There is no ease on that crossing, because a cue that speeds up
 * or slows down is lying about how much time is left. At the right edge the
 * mark turns down off the rule, pings, and *that is the press*: the
 * transport is struck by the timeline, at the frame the mark lands. The
 * thing you watch and the thing that happens are the same event, by
 * construction rather than by two durations that happen to match. Then the
 * violet drains out of the rule and the section hands the page to the call
 * below it, which is the only thing that should be moving from then on.
 *
 * DrawSVG draws the rail, MotionPath carries the mark along the very same
 * path, so the mark is at the drawn end at every frame without anything
 * being kept in step by hand. SplitText is on the title only — one line of
 * type that should arrive as language. Nothing else in this file is a
 * timeline; hover and focus stay CSS, where they belong.
 *
 * **This file owns whether the call runs; ./voice-demo owns the call.** The
 * projectionist never reaches into the replay's state. It presses the same
 * transport the reader presses, which is the whole discipline: there is one
 * play loop, one clock, one pause path, and the section cannot drift out of
 * step with the thing it is driving. It reads the transport's own label
 * back — captured after the first press, never hard-coded — to tell a call
 * in flight from a call that has finished, so a finished call is never
 * quietly restarted.
 *
 * **It yields, permanently, on the reader's first move.** A pointer, a key
 * or a focus anywhere in the section hands the transport over for good: the
 * cue runs to its end at once rather than crawling on under their hand, no
 * further press is ever issued, the reader's pause stays paused, and the
 * page stops having an opinion. Until then the section pauses itself — cue
 * and call together — whenever it leaves the viewport and picks up where it
 * stopped when it comes back, so nothing is talking to an empty room in a
 * background tab.
 *
 * **Reduced motion gets the section as a still caption.** No kit is
 * fetched, so there is no GSAP on the wire at all; the title, the
 * standfirst and the house rule are simply there, complete, exactly as the
 * server drew them, and no timer and no press ever runs. The violet cue is
 * absent rather than parked, and that is the truthful state: there is no
 * lead-in to count off when nothing is going to start by itself. The log
 * beside the orb is fully legible unplayed and the whole call is one
 * disclosure away.
 *
 * **This section is set in the light product system**, the same one every
 * mega-menu page uses: white stock, black ink, violet for the product
 * acting, Onest over Inter, and the cinema serif reserved for a line that
 * was spoken. The hero above stays dark and the imprint below stays dark,
 * exactly as on /product/ai-agents, and the body of the page is white
 * between them. A white section under a dark hero is the house edge.
 *
 * `.pp` and the two product faces are declared here, on the section itself,
 * rather than assumed from a parent, which is what lets the homepage be
 * converted one section at a time.
 *
 * **The section says out loud that there is no audio.** There is no
 * recording in this repository and there is not going to be one this pass.
 * The available moves were: synthesise a voice on a marketing page and let
 * the visitor believe they were hearing a customer; ship a mute button that
 * unmutes silence; or say the thing. We say the thing. A concession the
 * reader can check is worth more than a claim they cannot, and a prospect
 * who is buying a phone agent is exactly the person who will notice that
 * the "call" they just heard was generated for the occasion. The headline
 * says watch, not hear, and the sub says why in one sentence.
 */

const MASTHEAD = {
  /**
   * No running numeral, and not the anatomy section's kicker.
   *
   * The numbered eyebrow was a cover-system device; no page in the mega
   * menu numbers its sections, and a number is a promise about length
   * that a landing page should not make. "The call, end to end" was also
   * already spoken for — it opens the figure two sections above, and the
   * same violet label twice tells a reader they have scrolled backwards.
   * This one names what the section actually is: the call, played.
   */
  eyebrow: "Hear it run",
  title: "Watch a call become a booking",
  sub: "There is no audio on this page. This is a real call reconstructed — the transcript, replayed at the pace it actually ran. When we have a recording the customer is happy to see published, it plays here. Until then, a replay you can read beats a voice we synthesised for the occasion.",
} as const;

/**
 * How long the heading is allowed to sit alone before the call starts under
 * it. The house clock, not a number picked by eye: the reader gets the time
 * that line actually takes to read, and then the phone rings. It is also
 * the length of the cue timeline, because the cue *is* this number made
 * visible.
 */
const LEAD_IN_MS = holdFor(MASTHEAD.title);

/* ------------------------------------------------------------------ *
 * The cue's timings, every one of them derived from the line above it
 * rather than tuned by eye.
 * ------------------------------------------------------------------ */

/** The whole timeline, in seconds. The press lands on its last frame. */
const LEAD = LEAD_IN_MS / 1000;
const TITLE_WORDS = MASTHEAD.title.trim().split(/\s+/).length;
/** A word takes this long to arrive, and the next follows `WORD` behind it. */
const TITLE_IN = 0.75;
const WORD = 0.06;
/** When the title has finished arriving — where a late-built cue picks up. */
const CAPTION = TITLE_IN + TITLE_WORDS * WORD;
/**
 * The mark leaves once the title is legible, and never with less than
 * nine tenths of a second of rail left to cross: a cue shorter than that
 * reads as a flicker rather than as time passing.
 */
const CUE_START = Math.max(0, Math.min(0.35, LEAD - 0.9));

/* The rail's geometry, in CSS pixels. The `<svg>` carries no `viewBox`, so
 * one user unit is one pixel and the path can be generated from the rail's
 * measured width — which is the only way a full-column stroke, a round cap
 * and a quarter turn all come out the right shape at every breakpoint. */
const CUE_H = 40;
const CUE_Y = 20;
/** How far the mark turns down off the rule, towards the stage below it. */
const TURN = 14;
/** The cubic handle that makes a quarter turn a circle rather than a corner. */
const HANDLE = 0.4477;

/** The route: the column, then a quarter turn down at the right edge. */
function cueRoute(w: number) {
  return (
    `M0 ${CUE_Y} L${w - TURN} ${CUE_Y} ` +
    `C${w - HANDLE * TURN} ${CUE_Y} ${w} ${CUE_Y + HANDLE * TURN} ${w} ${CUE_Y + TURN}`
  );
}

/**
 * What the server draws. It is never seen — both strokes rest invisible and
 * only the timeline, which has measured the rail, ever shows them — but a
 * path needs a `d` to exist at all, and the widest column is the honest
 * guess.
 */
const NOMINAL_ROUTE = cueRoute(1096);

export function Demo() {
  const root = useRef<HTMLElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);

  /*
   * The shrunken root is deliberate: the call starts when the section is
   * properly in front of the reader, not when two per cent of it peeks in
   * at the bottom edge. Arriving at a replay already halfway through it is
   * worse than arriving at one that has not started.
   */
  const inView = useInView(root, "-15% 0px -15% 0px");
  /** The wider margin, and the other job: this one only fetches the kit. */
  const near = useInView(root, "25% 0px");
  const reduce = usePrefersReducedMotion();
  /*
   * `near && !reduce`, not `near`: with reduced motion the markup already
   * rests complete — title, standfirst and rule are all simply there — so
   * GSAP has nothing to put right and is never downloaded.
   */
  const kit = useMotionKit(near && !reduce);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  /** The reader touched something. From here the transport is theirs alone. */
  const taken = useRef(false);
  /** We have pressed start at least once. */
  const started = useRef(false);
  /** We believe the call is in flight (our own presses, our own belief). */
  const running = useRef(false);
  /** We, not the reader, paused it — so we may resume it on the way back. */
  const held = useRef(false);
  /**
   * The transport's label while a call is in flight, read off the button
   * after our first press rather than copied from ./voice-demo. It is the
   * one signal that tells a paused or finished call from a running one, and
   * capturing it instead of hard-coding it means the replay can retone its
   * own strings without this file knowing or caring.
   */
  const playingLabel = useRef<string | null>(null);
  /** The cue exists and owns the clock, so no fallback timer is needed. */
  const cueOwns = useRef(false);
  /** The section has been in front of the reader at least once. */
  const entered = useRef(false);
  /** The press, held where the timeline can reach it. */
  const press = useRef<() => void>(() => {});

  useEffect(() => {
    if (inView) entered.current = true;
  }, [inView]);

  useKitContext(
    kit,
    ({ gsap, SplitText }) => {
      // The media query is live, so this callback can re-run with reduced
      // motion newly on. The context has already reverted; build nothing.
      if (reduce) return;

      // Two selectors, because the section holds both the type and the
      // cue: one scoped to the section, one to the rail's own svg.
      const q: (sel: string) => Element[] = gsap.utils.selector(root);
      const qs: (sel: string) => Element[] = gsap.utils.selector(svg);
      const title = q(".dm-title")[0] as HTMLElement | undefined;
      const railEl = rail.current;
      const route = qs(".dm-cue")[0] as SVGPathElement;
      const ghost = qs(".dm-cue-ghost");
      const head = qs(".dm-head");
      if (!title || !railEl || !route) return;

      // The route is generated from the rail's own width, the way every
      // path in this house is generated rather than drawn by hand. It is
      // measured twice and never per frame: once here, so the geometry is
      // right the moment the kit lands, and once on the frame the mark
      // leaves, by which time the section is certainly laid out.
      const cut = () => {
        const w = Math.max(240, railEl.clientWidth);
        gsap.set([route, ...ghost], { attr: { d: cueRoute(w) } });
        gsap.set(qs(".dm-ping"), { attr: { cx: w, cy: CUE_Y + TURN } });
      };
      cut();

      // Split for motion only: the words stay plain text to a screen
      // reader, the heading keeps its role, and the context reverts the
      // split when the section goes — never call .revert() by hand.
      const words = SplitText.create(title, { type: "words", aria: "none" }).words;
      // Each word on its own compositor layer, so the fade, the rise and
      // the light blur are GPU work rather than a repaint of the line.
      gsap.set(words, { willChange: "transform, opacity, filter", force3D: true });

      cueOwns.current = true;

      const tl = gsap.timeline({ paused: true });

      // The whole resting state, set at the top, before anything moves.
      tl.set([route, ...ghost], { opacity: 1 }, 0)
        .set(route, { drawSVG: "0% 0%" }, 0)
        .set(head, { opacity: 0 }, 0)
        .set(q(".dm-sub"), { autoAlpha: 0, y: 10 }, 0)
        .fromTo(
          words,
          { autoAlpha: 0, yPercent: 18, filter: "blur(3px)" },
          {
            autoAlpha: 1,
            yPercent: 0,
            filter: "blur(0px)",
            duration: TITLE_IN,
            ease: "power2.out",
            stagger: WORD,
          },
          0,
        )
        // A `.to()` off the resting state set above, not a `fromTo` at a
        // non-zero position: the standfirst has to be down before the first
        // frame is drawn, not at the frame its tween starts.
        .to(q(".dm-sub"), { autoAlpha: 1, y: 0, duration: 0.6, ease: "power3.out" }, 0.3)
        .call(cut, [], Math.max(0, CUE_START - 0.05))
        .to(head, { opacity: 1, duration: 0.25 }, CUE_START)
        // No ease on either of these: a countdown that accelerates is
        // lying about how much of it is left.
        .to(route, { drawSVG: "0% 100%", duration: LEAD - CUE_START, ease: "none" }, CUE_START)
        .to(
          head,
          {
            duration: LEAD - CUE_START,
            ease: "none",
            motionPath: { path: route, align: route, alignOrigin: [0.5, 0.5] },
          },
          CUE_START,
        );

      // The mark lands, and the landing is the press.
      ping(tl, qs(".dm-ping"), LEAD, 18);
      tl.call(() => press.current(), [], LEAD)
        // Spent: the violet drains back to the house rule and the section
        // stops competing with the call it just started.
        .to(head, { opacity: 0, duration: 0.3 }, LEAD + 0.05)
        .to([route, ...ghost], { opacity: 0, duration: 0.55, ease: "power2.inOut" }, LEAD + 0.15);

      tlRef.current = tl;

      // Already being looked at when the kit landed: do not rewind a
      // heading the reader is reading. Pick up where the title finished.
      if (entered.current) tl.seek(CAPTION);

      return () => {
        tlRef.current = null;
        cueOwns.current = false;
      };
    },
    // `revertOnUpdate` because the callback splits text and sets inline
    // styles; both have to be undone before it can run again.
    { scope: root, dependencies: [reduce], revertOnUpdate: true },
  );

  // Plays while on screen. `kit` is in the deps because the timeline is
  // built asynchronously, after the kit arrives.
  useEffect(() => {
    const tl = tlRef.current;
    if (!tl) return;
    // Either the reader has the transport or the fallback already pressed:
    // the countdown is void, so the cue goes straight to its resting end.
    if (taken.current || started.current) {
      tl.progress(1);
      return;
    }
    if (inView && !reduce) tl.play();
    else tl.pause();
  }, [inView, reduce, kit]);

  useEffect(() => {
    const el = root.current;
    if (!el || reduce) return;

    // The transport is ./voice-demo's own pill. The data hook is preferred
    // so the two files can be held together by something named rather than
    // by document order; the first button is the long-standing fallback.
    const transport = () =>
      el.querySelector<HTMLButtonElement>("[data-pp-transport]") ?? el.querySelector("button");
    const labelNow = () => transport()?.textContent?.trim() ?? "";

    /** True once the call has run to the end: the label left the playing one. */
    const finished = () =>
      playingLabel.current !== null && labelNow() !== playingLabel.current;

    let frame = 0;

    const startCall = () => {
      if (taken.current || started.current) return;
      const b = transport();
      if (!b) return;
      started.current = true;
      running.current = true;
      b.click();
      // Two frames: one for React to commit the new phase, one for the
      // label to be in the DOM when we read it.
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          playingLabel.current = labelNow() || null;
        });
      });
    };
    press.current = startCall;

    const handOver = () => {
      taken.current = true;
      // The cue was counting off a beat the reader has just cut short.
      // Run it out rather than leaving a mark crawling under their hand;
      // the press it carries is already guarded and does nothing.
      tlRef.current?.progress(1);
    };
    // Capture phase: the transport's own handler must not be able to stop
    // us hearing the press that retires us.
    el.addEventListener("pointerdown", handOver, true);
    el.addEventListener("keydown", handOver, true);
    el.addEventListener("focusin", handOver, true);

    let lead: ReturnType<typeof setTimeout> | undefined;

    if (inView && !taken.current) {
      if (!started.current) {
        // Only for the reader whose kit never arrives. When the cue is
        // there it owns the clock, and this timer is neither armed nor
        // allowed to fire — two clocks is exactly the drift the
        // projectionist exists to avoid.
        if (!cueOwns.current) {
          lead = setTimeout(() => {
            if (!cueOwns.current) startCall();
          }, LEAD_IN_MS);
        }
      } else if (held.current && !finished()) {
        held.current = false;
        running.current = true;
        transport()?.click();
      }
    } else if (!inView && started.current && running.current && !finished()) {
      // Off screen: stop the call where it stands. It resumes on return,
      // on the reader's word or ours, whichever comes first.
      running.current = false;
      held.current = true;
      transport()?.click();
    }

    return () => {
      clearTimeout(lead);
      cancelAnimationFrame(frame);
      el.removeEventListener("pointerdown", handOver, true);
      el.removeEventListener("keydown", handOver, true);
      el.removeEventListener("focusin", handOver, true);
    };
  }, [inView, reduce]);

  return (
    <section
      ref={root}
      id="demo"
      className={`pp ${ppDisplay.variable} ${ppCinema.variable} relative scroll-mt-24 py-20 md:py-28`}
    >
      <Frame>
        {/* Nothing here carries a Tailwind scale or translate utility:
            Tailwind v4 writes the standalone `scale` and `translate`
            properties, which would compose on top of the `transform` GSAP
            writes. Both the title's words and the standfirst rest at their
            finished position in the markup and are moved from there. */}
        <SectionHeading
          eyebrow={MASTHEAD.eyebrow}
          className="max-w-[680px]"
          titleClassName="dm-title"
        >
          {MASTHEAD.title}
        </SectionHeading>

        <p
          className={cn(
            "dm-sub mt-5 max-w-[680px] text-[16px] leading-[26px] text-pretty text-pp-muted",
            "md:text-[17px] md:leading-[28px]",
          )}
        >
          {MASTHEAD.sub}
        </p>
      </Frame>

      {/* The rule, and the cue laid over it. The hairline is the house's
          own `Rule` markup — it is the ghost the violet is drawn on, and
          it is all that shows before the kit lands, after the cue is spent
          and for a reader who asked for reduced motion. */}
      <Frame className="mt-10 md:mt-12">
        <div ref={rail} className="relative h-px">
          <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-pp-rule" />
          <svg
            ref={svg}
            aria-hidden
            fill="none"
            height={CUE_H}
            className="pointer-events-none absolute left-0 w-full"
            // No `viewBox`: one user unit is one CSS pixel, which is what
            // lets the route be generated from the measured width. Visible
            // overflow so the ping is not clipped by a 40px band.
            style={{ top: -CUE_Y, overflow: "visible" }}
          >
            <path
              className="dm-cue-ghost"
              d={NOMINAL_ROUTE}
              stroke={VIOLET}
              strokeOpacity="0.14"
              strokeWidth={LINE}
              strokeLinecap="round"
              opacity={0}
            />
            <path
              className="dm-cue"
              d={NOMINAL_ROUTE}
              stroke={VIOLET}
              strokeWidth={LINE}
              strokeLinecap="round"
              opacity={0}
            />
            <Ping className="dm-ping" x={0} y={0} color={VIOLET} />
            {/* Parked at the origin, invisible, until the route moves it. */}
            <Node className="dm-head" hidden r={4} color={VIOLET} />
          </svg>
        </div>
      </Frame>

      <VoiceDemo />
    </section>
  );
}
