import { FAQ, FAQ_INTRO } from "@/lib/site";
import { CornerDot } from "./corner-dot";
import { Reveal, RevealStagger, StaggerItem, EASE } from "./reveal";

/**
 * FAQ — five answers, in the open, in the order the doubts arrive.
 *
 * The obvious sin in what this replaces was the accordion: a reader with
 * two questions had to open seven drawers to find them, and a reader with
 * none saw a wall of closed drawers and scrolled past — a strange thing to
 * do in the last section before the price, where the entire job is removing
 * reasons not to sign up. Nothing here is worth making somebody click for,
 * so nothing here is hidden.
 *
 * The version after that grouped the questions into three lettered stages,
 * three across. Three columns of two or three questions each is a layout
 * that argues about the *taxonomy* of doubt, and a reader with a specific
 * fear has to work out which bucket it was filed under before they can find
 * out whether it was answered. Eight questions needed the scaffolding. Five
 * do not: five fit in one column, read top to bottom in the order the
 * doubts actually arrive, and the first of them is the fear under all the
 * others. The measure is the other reason — these answers run three and
 * four lines, and a three-up sets prose at a width nobody reads prose at.
 *
 * **The answer is body copy and it is set at /80.** It had drifted to /55,
 * which puts the entire substance of the section near 2.8:1 — the one place
 * on the page where the reader has stopped to actually read, rendered in the
 * tone reserved for captions. app/globals.css:465 documents that the field's
 * ceiling was chosen so paper at 80% clears 4.5:1; this is the section that
 * choice was made for. Only the numerals and the link label go dim.
 *
 * **Motion budget, spent in one place.** Five objections arriving as five
 * separate events is the entire animation argument here: it tells the reader
 * there is a countable, finite list of things standing between them and the
 * product, rather than one blob of text fading up. So `RevealStagger` at
 * 0.08, and each row's own rule wiping open from the left on the same
 * cadence — the rule is what separates one doubt from the next, so drawing
 * it is drawing the structure. Nothing else moves.
 *
 * **Headings and paragraphs, not a `<dl>`.** A definition list may only hold
 * `dt`/`dd` or a `div` that directly holds them, and every pair here is
 * wrapped in an animated element — wrapping broke the one thing the markup
 * was there for. An `h3` per question is both honest and better: it puts all
 * five in the document outline, so a screen-reader user can jump between
 * them.
 *
 * **No `"use client"`.** There is no state and no handler left in here; the
 * three motion primitives carry their own client boundary. That matters more
 * than usual because of the last thing in the file — the FAQPage JSON-LD,
 * which is built by mapping the same `FAQ` constant the rows render, so the
 * structured data cannot drift from what is on screen. Nothing in `app/`
 * emits it, and it is the cheapest structured-data win the site has.
 *
 * `where` is drawn as a real anchor, and only when the constant carries one.
 * Two of the five end somewhere the reader can actually do the thing; the
 * other three have nowhere honest to send anybody, and a greyed-out
 * affordance would be worse than none.
 */

/** The row's top rule, wiped open from the left on its row's beat. */
function RuleWipe({ delay }: { delay: number }) {
  return (
    <Reveal
      aria-hidden
      className="h-px origin-left bg-[var(--cover-paper)]/15 motion-reduce:transform-none!"
      // `initial`/`whileInView`/`transition` land after Reveal's own spread,
      // so this is a scaleX wipe rather than the default fade-and-rise. The
      // one thing that override costs is Reveal's `useReducedMotion` branch,
      // which is why the utility above is here: an `!important` declaration
      // outranks the inline transform framer-motion writes, so a reader who
      // asked for no motion gets the finished rule and no binding.
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      transition={{ duration: 0.42, delay, ease: EASE }}
    >
      {/* The element IS the rule — a 1px box with a background. `children`
          is required by Reveal's signature, so it is explicitly nothing. */}
      {null}
    </Reveal>
  );
}

export function Faq() {
  // Built from the constant, never typed out. An FAQ schema that disagrees
  // with the page is worse than no schema at all.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <section
      id="faq"
      className="relative scroll-mt-24 px-[1.6em] py-[6em] md:py-[8em]"
    >
      <div className="relative mx-auto max-w-[76em]">
        {/* masthead */}
        <Reveal className="max-w-[54em]">
          <div className="flex items-center gap-[0.7em]">
            <CornerDot className="size-[0.55em] text-[var(--cover-brand-lit)]" />
            <span className="mono text-[0.7em] uppercase tracking-[0.24em] text-[var(--cover-paper)]/45">
              10
            </span>
            <span className="mono text-[0.7em] uppercase tracking-[0.24em] text-[var(--cover-paper)]/45">
              {FAQ_INTRO.eyebrow}
            </span>
          </div>

          <h2 className="mt-[0.9em] text-balance text-[2.8em] font-medium leading-[1.03] tracking-[-0.045em] md:text-[3.4em]">
            {FAQ_INTRO.title}
          </h2>

          <div className="mt-[1.6em] h-px bg-[var(--cover-paper)]/12" />
        </Reveal>

        {/* One reading column. The masthead above is left-aligned on the
            same gutter, so the whole section hangs off one edge — which is
            the edge the eye returns to on every line of a four-line
            answer. */}
        <RevealStagger stagger={0.08} className="mt-[3em] max-w-[54em] md:mt-[4em]">
          {FAQ.map((f, i) => (
            <StaggerItem key={f.q}>
              <RuleWipe delay={i * 0.08} />
              <div className="grid grid-cols-[auto_1fr] gap-x-[1.2em] py-[1.8em] md:gap-x-[1.8em] md:py-[2.2em]">
                <span
                  aria-hidden
                  className="mono pt-[0.6em] text-[0.7em] leading-none tracking-[0.24em] text-[var(--cover-paper)]/45"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>

                <div className="min-w-0">
                  <h3 className="text-balance text-[1.35em] font-medium leading-[1.3] tracking-[-0.04em]">
                    {f.q}
                  </h3>
                  {/* /80, and it stays there. This is the documented
                      contrast floor and this is the copy it was written
                      for. */}
                  <p className="mt-[0.7em] text-pretty text-[0.95em] leading-[1.55] text-[var(--cover-paper)]/80">
                    {f.a}
                  </p>

                  {f.where ? (
                    <a
                      href={f.where.href}
                      className="mono mt-[1.1em] inline-flex items-center gap-[0.6em] text-[0.7em] uppercase tracking-[0.24em] text-[var(--cover-paper)]/45 transition-colors duration-500 hover:text-[var(--cover-brand-lit)]"
                    >
                      <span
                        aria-hidden
                        className="h-px w-[1.8em] bg-current opacity-60"
                      />
                      {f.where.label}
                    </a>
                  ) : null}
                </div>
              </div>
            </StaggerItem>
          ))}

          {/* Closes the last row. Without it the stack is five rules with an
              open bottom, which reads as a list that was cut off — and it
              wipes on the beat after the fifth so it belongs to the same
              sequence rather than appearing out of nowhere under it. */}
          <RuleWipe delay={FAQ.length * 0.08} />
        </RevealStagger>

        <script
          type="application/ld+json"
          // Our own constants, but escaped anyway: a `<` anywhere in an
          // answer would otherwise be free to close this element early.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
      </div>
    </section>
  );
}
