import { CornerDot } from "./corner-dot";
import { MaskRise, Reveal } from "./reveal";
import { VoiceDemo } from "./voice-demo";

/**
 * The demo — the one place on the page where the product speaks for itself.
 *
 * What was here was two demos stacked. A chat card dramatised a booking in
 * an iMessage skin, and five ems below it the real engine dramatised the
 * *same* booking properly. The card won nothing and cost a lot: it was a
 * fifth feature panel in a page already full of panels, it carried the only
 * homepage copy that never made it into lib/site.ts, and it kept twenty-one
 * infinite springs mounted for the length of the visit to draw a waveform
 * for a call that has no sound. It is gone. One demo, and it is the one
 * with an engine behind it.
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
 * The masthead is left on the gutter and the numeral is part of it, because
 * six identically centred headers were half of what made this page read as
 * a brochure. The headline is the hero's own word-rise rather than a fade:
 * it is the same gesture the cover opens with, which is what ties the
 * bottom of the page to the top without repeating the cover's furniture.
 *
 * Everything below the rule — the orb, the call log, the transcript — lives
 * in ./voice-demo, which owns the playback clock. This file owns the frame
 * and the promise; that file owns the call.
 */

/** Two lines, hard-broken. The rise reads as one sweep across both. */
const HEADLINE = ["Watch a call", "become a booking"];

const MASTHEAD = {
  numeral: "02",
  kicker: "The call, end to end",
  sub: "There is no audio on this page. This is a real call reconstructed — the transcript, replayed at the pace it actually ran. When we have a recording the customer is happy to see published, it plays here. Until then, a replay you can read beats a voice we synthesised for the occasion.",
} as const;

export function Demo() {
  return (
    <section
      id="demo"
      className="relative scroll-mt-24 px-[1.6em] py-[6em] md:py-[8em]"
    >
      <div className="relative mx-auto max-w-[76em]">
        <div className="flex flex-col items-start">
          <Reveal className="mono flex items-center gap-[0.8em] text-[0.7em] uppercase tracking-[0.24em] text-[var(--cover-paper)]/45">
            <CornerDot className="size-[0.55em] shrink-0" />
            <span>{MASTHEAD.numeral}</span>
            <span>{MASTHEAD.kicker}</span>
          </Reveal>

          <h2 className="mt-[0.9em] text-balance text-[2.8em] font-medium leading-[1.03] tracking-[-0.045em] md:text-[3.4em]">
            <MaskRise lines={HEADLINE} />
          </h2>

          <Reveal
            as="p"
            delay={0.12}
            className="mt-[1.1em] max-w-[44em] text-pretty text-[1.05em] leading-[1.6] text-[var(--cover-paper)]/75"
          >
            {MASTHEAD.sub}
          </Reveal>

          <div
            aria-hidden
            className="mt-[2.4em] h-px w-full bg-[var(--cover-paper)]/12"
          />
        </div>

        <VoiceDemo />
      </div>
    </section>
  );
}
