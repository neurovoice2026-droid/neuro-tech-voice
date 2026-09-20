import { ppCinema, ppDisplay } from "./product/fonts";
import { Frame, Rule, SectionHeading } from "./product/primitives";
import { Reveal } from "./reveal";
import { VoiceDemo } from "./voice-demo";

/**
 * The demo — the one place on the page where the product speaks for itself.
 *
 * **This section is set in the light product system**, the same one every
 * mega-menu page uses: white stock, black ink, violet for the product
 * acting, Onest over Inter, and the cinema serif reserved for a line that
 * was spoken. It was briefly built in the cover's dark idiom, and that was
 * the mistake this file corrects — the hero above stays dark and the
 * imprint below stays dark, exactly as on /product/ai-agents, and the
 * body of the page is white between them. It does not try to blend into
 * either end; a white section under a dark hero is the house edge.
 *
 * `.pp` and the two product faces are declared here, on the section
 * itself, rather than assumed from a parent. The section then carries its
 * own tokens and its own display and cinema fonts wherever it is mounted,
 * which is what lets the homepage be converted one section at a time. If
 * the spread is later wrapped in a single `.pp` shell these three classes
 * become redundant, and harmlessly so.
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
 * and one Onest line — and the numeral rides in the eyebrow so the page's
 * running count survives the change of system. The cover's word-rise is
 * gone with it: on white, a heading that climbs out of a mask reads as a
 * stunt, and the section's real motion is downstairs where the call is.
 *
 * Everything below the rule — the orb, the call log, the transcript —
 * lives in ./voice-demo, which owns the playback clock. This file owns the
 * frame and the promise; that file owns the call.
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

export function Demo() {
  return (
    <section
      id="demo"
      className={`pp ${ppDisplay.variable} ${ppCinema.variable} relative scroll-mt-24 py-20 md:py-28`}
    >
      <Frame>
        <Reveal>
          <SectionHeading eyebrow={MASTHEAD.eyebrow} className="max-w-[680px]">
            {MASTHEAD.title}
          </SectionHeading>
        </Reveal>

        <Reveal
          as="p"
          delay={0.12}
          className="mt-5 max-w-[680px] text-[16px] leading-[26px] text-pretty text-pp-muted md:text-[17px] md:leading-[28px]"
        >
          {MASTHEAD.sub}
        </Reveal>
      </Frame>

      <Rule className="mt-10 md:mt-12" />

      <VoiceDemo />
    </section>
  );
}
