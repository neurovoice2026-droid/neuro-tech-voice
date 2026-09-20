"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ppCinema, ppDisplay } from "./product/fonts";
import { Frame, Rule, SectionHeading } from "./product/primitives";
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
 * above it — and then starts the call. You land here and a phone is already
 * being answered, a calendar already being read, an appointment already
 * being written into it. That is the argument; the heading is only the
 * caption for it.
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
 * or a focus anywhere in the section hands the transport over for good: no
 * further press is ever issued, the reader's pause stays paused, and the
 * page stops having an opinion. Until then the section pauses itself
 * whenever it leaves the viewport and picks up where it stopped when it
 * comes back, so nothing is talking to an empty room in a background tab.
 * Readers who ask for reduced motion get no timers and no presses at all —
 * the log beside the orb is fully legible unplayed and the whole call is one
 * disclosure away, which is the informative state, not a blank one.
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
 *
 * The opener is `SectionHeading`, not a hand-built masthead. Every light
 * page introduces a section the same way — a violet corner-dotted eyebrow
 * and one Onest line. Its reveal is two CSS utilities on the house's own
 * 500ms, gated on the section arriving; there is no motion library in this
 * file and no scroll value driving anything.
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
 * that line actually takes to read, and then the phone rings.
 */
const LEAD_IN_MS = holdFor(MASTHEAD.title);

/** Fade-and-rise, the light system's only entrance, on the house's 500ms. */
const REVEAL = "animate-in fade-in-0 slide-in-from-bottom-2 duration-500 fill-mode-both";

export function Demo() {
  const root = useRef<HTMLElement>(null);
  /*
   * The shrunken root is deliberate: the call starts when the section is
   * properly in front of the reader, not when two per cent of it peeks in
   * at the bottom edge. Arriving at a replay already halfway through it is
   * worse than arriving at one that has not started.
   */
  const inView = useInView(root, "-15% 0px -15% 0px");
  const reduce = usePrefersReducedMotion();

  /** Has the section arrived? Latches, so the heading reveals exactly once. */
  const [lit, setLit] = useState(false);

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

  useEffect(() => {
    if (inView) setLit(true);
  }, [inView]);

  useEffect(() => {
    const el = root.current;
    if (!el || reduce) return;

    const transport = () => el.querySelector("button");
    const labelNow = () => transport()?.textContent?.trim() ?? "";

    /** True once the call has run to the end: the label left the playing one. */
    const finished = () =>
      playingLabel.current !== null && labelNow() !== playingLabel.current;

    const handOver = () => {
      taken.current = true;
    };
    // Capture phase: the transport's own handler must not be able to stop
    // us hearing the press that retires us.
    el.addEventListener("pointerdown", handOver, true);
    el.addEventListener("keydown", handOver, true);
    el.addEventListener("focusin", handOver, true);

    let lead: ReturnType<typeof setTimeout> | undefined;
    let frame = 0;

    if (inView && !taken.current) {
      if (!started.current) {
        lead = setTimeout(() => {
          if (taken.current) return;
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
        }, LEAD_IN_MS);
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

  // Reduced motion never hides anything waiting for a trigger that will not
  // come: the heading is simply there.
  const reveal = reduce ? "" : lit ? REVEAL : "opacity-0";

  return (
    <section
      ref={root}
      id="demo"
      className={`pp ${ppDisplay.variable} ${ppCinema.variable} relative scroll-mt-24 py-20 md:py-28`}
    >
      <Frame>
        <SectionHeading
          eyebrow={MASTHEAD.eyebrow}
          className={cn("max-w-[680px]", reveal)}
        >
          {MASTHEAD.title}
        </SectionHeading>

        <p
          className={cn(
            "mt-5 max-w-[680px] text-[16px] leading-[26px] text-pretty text-pp-muted md:text-[17px] md:leading-[28px]",
            reveal,
            !reduce && lit && "delay-150",
          )}
        >
          {MASTHEAD.sub}
        </p>
      </Frame>

      <Rule className="mt-10 md:mt-12" />

      <VoiceDemo />
    </section>
  );
}
