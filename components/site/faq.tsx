import { FAQ, FAQ_INTRO } from "@/lib/site";
import { Frame, PillLink, SectionHeading } from "./product/primitives";
import { Reveal, RevealStagger, StaggerItem, EASE } from "./reveal";

/**
 * FAQ — five answers, in the open, in the order the doubts arrive.
 *
 * **Set in the light product system, because that is the house.** Every
 * mega-menu page — the product pages, the solutions page, the sixteen
 * industry pages — is white stock, black ink, one violet accent, Onest
 * over Inter, and one centred `Frame`. This section briefly was not, and a
 * reader arriving here from any of those pages would have been looking at
 * a different company. The substance below is unchanged; only the surface
 * and the palette are. No `--cover-*` token appears in this file, and
 * sizing is rem/px rather than the cover's em base.
 *
 * **The layout is the one the product pages close with.** A short heading
 * column on the left, the list on the right — see `ProductFaq` in
 * components/site/product/closing.tsx. What differs, deliberately, is that
 * nothing here is behind a disclosure. Those pages answer eleven or twelve
 * questions and the drawers earn their keep; five answers in the last
 * section before the price do not. A reader with two questions would have
 * to open five drawers to find them, and a reader with none would see a
 * wall of closed drawers in the one place whose whole job is removing
 * reasons not to sign up. Nothing here is worth making somebody click for,
 * so nothing here is hidden.
 *
 * The earlier version of this section grouped the questions into three
 * lettered stages, three across. Three columns of two or three questions
 * each is a layout that argues about the *taxonomy* of doubt, and a reader
 * with a specific fear has to work out which bucket it was filed under
 * before they can find out whether it was answered. Eight questions needed
 * the scaffolding. Five do not: five fit in one column, read top to bottom
 * in the order the doubts actually arrive, and the first of them is the
 * fear under all the others. The measure is the other reason — these
 * answers run three and four lines, and a three-up sets prose at a width
 * nobody reads prose at.
 *
 * **The answer is body copy, at `text-pp-ink/80`.** The sister pages set a
 * two-line disclosure answer in `text-pp-muted`; these run three and four
 * lines and carry the substance of the section, so they get the heavier of
 * the two pp secondaries — the same one `ProductStart` uses for real body
 * copy. Only the numerals and the eyebrow go to `text-pp-muted`/accent.
 *
 * **Motion budget, spent in one place.** Five objections arriving as five
 * separate events is the entire animation argument here: it tells the
 * reader there is a countable, finite list of things standing between them
 * and the product, rather than one blob of text fading up. So
 * `RevealStagger` at 0.08, and each row's own rule wiping open from the
 * left on the same cadence — the rule is what separates one doubt from the
 * next, so drawing it is drawing the structure. Nothing else moves. On
 * white a drawn line is the whole effect; there is no glow to fall back
 * on, and none is wanted.
 *
 * **Headings and paragraphs, not a `<dl>`.** A definition list may only
 * hold `dt`/`dd` or a `div` that directly holds them, and every pair here
 * is wrapped in an animated element — wrapping broke the one thing the
 * markup was there for. An `h3` per question is both honest and better: it
 * puts all five in the document outline, so a screen-reader user can jump
 * between them.
 *
 * **No `"use client"`.** There is no state and no handler in here; the
 * three motion primitives carry their own client boundary. That matters
 * more than usual because of the last thing in the file — the FAQPage
 * JSON-LD, which is built by mapping the same `FAQ` constant the rows
 * render, so the structured data cannot drift from what is on screen.
 * Nothing in `app/` emits it, and it is the cheapest structured-data win
 * the site has.
 *
 * `where` is drawn as a real action, and only when the constant carries
 * one. Two of the five end somewhere the reader can actually do the thing;
 * the other three have nowhere honest to send anybody, and a greyed-out
 * affordance would be worse than none. It is a secondary `PillLink`,
 * because that is the only button idiom this system has.
 */

/** The row's top rule, wiped open from the left on its row's beat. */
function RuleWipe({ delay }: { delay: number }) {
  return (
    <Reveal
      aria-hidden
      className="h-px origin-left bg-pp-rule motion-reduce:transform-none!"
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
    <Frame
      as="section"
      id="faq"
      className="scroll-mt-24 py-16 md:py-24"
    >
      <div className="grid gap-10 lg:grid-cols-[minmax(0,384px)_minmax(0,1fr)] lg:gap-16">
        {/* The heading column. It stays put on a long list, the way the
            product pages' closing FAQ does — the questions scroll past a
            fixed statement of what they are. */}
        <Reveal className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeading eyebrow={FAQ_INTRO.eyebrow}>
            {FAQ_INTRO.title}
          </SectionHeading>
        </Reveal>

        {/* One reading column, hanging off a single left edge — which is
            the edge the eye returns to on every line of a four-line
            answer. */}
        <RevealStagger stagger={0.08}>
          {FAQ.map((f, i) => (
            <StaggerItem key={f.q}>
              <RuleWipe delay={i * 0.08} />
              <div className="grid grid-cols-[auto_1fr] gap-x-4 py-7 md:gap-x-7 md:py-9">
                <span
                  aria-hidden
                  className="pt-1.5 font-[family-name:var(--font-geist-mono)] text-[11px] leading-none tracking-[0.18em] text-pp-muted"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>

                <div className="min-w-0">
                  <h3
                    className="pp-display text-[20px] leading-[27px] tracking-[-0.02em] text-balance md:text-[24px] md:leading-[31px]"
                    // Inline: `.pp-display` sets 360 outside Tailwind's
                    // layers, so a weight utility would lose to it. Same
                    // 480 `SectionHeading` uses.
                    style={{ fontWeight: 480 }}
                  >
                    {f.q}
                  </h3>
                  <p className="mt-3 max-w-[640px] text-[15px] leading-[24px] text-pretty text-pp-ink/80 md:text-[16px] md:leading-[26px]">
                    {f.a}
                  </p>

                  {f.where ? (
                    <PillLink
                      href={f.where.href}
                      variant="secondary"
                      size="sm"
                      className="mt-5"
                    >
                      {f.where.label}
                    </PillLink>
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
      </div>

      <script
        type="application/ld+json"
        // Our own constants, but escaped anyway: a `<` anywhere in an
        // answer would otherwise be free to close this element early.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
    </Frame>
  );
}
