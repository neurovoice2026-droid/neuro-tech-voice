"use client";

import { motion, useReducedMotion } from "framer-motion";
import { SOLUTIONS_INTRO, SOLUTION_ITEMS } from "@/lib/site";
import { cn } from "@/lib/utils";
import { Frame, PillLink, SectionHeading } from "./product/primitives";
import { Reveal, EASE } from "./reveal";

/**
 * The second business — the one the homepage never admitted to.
 *
 * The agent is a product you buy. These five are work you commission, and
 * until now a visitor met them only by opening the mega menu. That is
 * backwards. A company that can build you a CRM is *more* credible selling
 * you a phone agent, not less, and the agent is the cheapest possible proof
 * that the building is real. This band is what makes the site read as a
 * company rather than as a single-feature tool, which is why it sits here,
 * immediately before the price: the reader should know who they are buying
 * from before they are asked what it costs.
 *
 * **It is a spec sheet, not five cards.** The section has to carry "we know
 * what we are doing", and a grid of tiles is the shape of a brochure — it
 * asks to be admired and gives the eye nothing to check. What we actually
 * hold per item is a promise, three deliverables and a four-part stack.
 * That is a *specification*, and a specification is the only page furniture
 * that reads as competence rather than as marketing, because it can be
 * disagreed with. So: one ruled row per item, fields labelled in the small
 * caps the product pages label with, the stack in mono because a stack is a
 * list of names and setting it as prose would be a lie about what it is.
 * Hairlines and the label gutter do the grouping; nothing is boxed — which
 * matters more here than anywhere, because on white stock a card is the
 * loudest object available and this band has five of everything.
 *
 * **Set in `pp`, like every other marketing page on the site.** White
 * stock, black ink, violet only on the mark and the eyebrow, `#f4f3f7`
 * unused because nothing here is a card. Hairlines are `--pp-rule` and they
 * all sit on one inset: the ledger draws its own top edge as the first
 * row's border rather than borrowing the page-level `<Rule />`, whose frame
 * is 24/48px wider than the padded rows and would have left the spec sheet
 * with one hairline overhanging the rest. In a ledger that is not a detail.
 *
 * **Vertical rhythm is half a `<Gap />` on each side** (`py-10 md:py-16`),
 * so two adjacent homepage bands add up to exactly the 80/128px the product
 * pages put between sections. If a neighbouring section sets its own
 * heavier padding the seam grows; the fix is there, not here.
 *
 * **One link, and it is the intro's.** Four of the five solution pages do
 * not exist. A section whose entire job is to look like we know what we are
 * doing cannot afford to walk a reader into a 404 — that single dead click
 * costs more than the whole band earns. So the four are named in full, with
 * their promise and their stack, and are simply not links. No "coming
 * soon" either: an unlinked heading reads as a capability, an unlinked
 * heading with a badge on it reads as a roadmap. The one that does exist is
 * a secondary pill, because a pill is the site's only button and a lone
 * underlined sentence at the foot of a spec sheet reads as a footnote.
 *
 * **The stack is what arrives.** Motion here is doing one job: the four
 * tokens are the load-bearing evidence in each row, so they land in
 * sequence as their own row crosses into view — the eye is walked across
 * the proof rather than shown a decorative fade. They *slide* in from the
 * left rather than lifting: on white a ledger is read across, and a fade
 * from nothing would read as the page still loading. Nothing loops, nothing
 * fades from zero (a row that never animates must still be readable), and
 * under `useReducedMotion` every element renders in its final state with no
 * scroll binding at all.
 */

/**
 * Line numbers for the ledger. Two digits so the rail stays a fixed
 * optical width and the labels start on one vertical.
 */
const lineNo = (i: number) => String(i + 1).padStart(2, "0");

/**
 * Caption tone — field names, never substance. The product pages' label:
 * Inter small caps in the muted violet-grey, which clears 5.6:1 on white.
 * Mono is reserved here for things that are literally names (the line
 * number, the stack), so that the two tones mean different things.
 */
const FIELD = "text-[11px] leading-4 font-medium tracking-[0.12em] text-pp-muted uppercase";

export function Solutions() {
  const reduce = useReducedMotion();

  /**
   * The row settles; it does not appear. Starting from zero opacity would
   * mean a row that is never animated — a backgrounded tab starves rAF —
   * stays invisible, and these rows are the section.
   */
  const row = {
    rest: reduce ? {} : { opacity: 0.55, y: 8 },
    enter: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
  };

  /**
   * The stack tokens, landing left to right behind their own row. The index
   * comes in as `custom` so the delay is a property of the token's position
   * rather than of a wrapper, which keeps the four of them on one flex line
   * instead of inside four staggered boxes. `x` and not `y`: the row is a
   * line of a specification and is read across.
   */
  const token = {
    rest: reduce ? {} : { opacity: 0.3, x: -5 },
    enter: (i: number) => ({
      opacity: 1,
      x: 0,
      transition: { duration: 0.45, delay: 0.14 + i * 0.04, ease: EASE },
    }),
  };

  return (
    <section id="solutions" className="scroll-mt-28 py-10 md:py-16">
      <Frame className="px-6 md:px-12">
        {/* masthead — on the gutter, not centred */}
        <Reveal>
          <SectionHeading eyebrow={SOLUTIONS_INTRO.kicker} className="max-w-[820px]">
            {SOLUTIONS_INTRO.title}
          </SectionHeading>

          <p className="mt-5 max-w-[620px] text-base leading-[25px] text-pretty text-pp-muted">
            {SOLUTIONS_INTRO.sub}
          </p>
        </Reveal>

        {/* the ledger. Its top edge is the first row's own hairline, so every
            rule in the section sits on one vertical. */}
        <ul className="mt-10 border-t border-pp-rule md:mt-12">
          {SOLUTION_ITEMS.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.li
                key={item.id}
                variants={row}
                initial={reduce ? false : "rest"}
                whileInView="enter"
                viewport={{ once: true, margin: "-12% 0px -8% 0px" }}
                className="grid gap-x-10 gap-y-5 border-b border-pp-rule py-7 md:grid-cols-[40px_minmax(200px,1fr)_minmax(0,1.35fr)] md:py-9"
              >
                {/* rail: the mark and the line number */}
                <div className="flex items-center gap-3 md:block">
                  <Icon className="size-5 shrink-0 text-pp-accent" strokeWidth={1.75} aria-hidden />
                  {/* 4px down on desktop so the numeral clears the 20px mark
                      without the rail claiming a line of its own. */}
                  <span className="mono text-[11px] leading-4 tracking-[0.18em] text-pp-muted md:mt-4 md:block">
                    {lineNo(index)}
                  </span>
                </div>

                {/* what it is */}
                <div className="min-w-0">
                  <h3 className="text-[19px] leading-7 tracking-[-0.01em] text-balance text-pp-ink md:text-[21px] md:leading-8">
                    {item.label}
                  </h3>
                  <p className="mt-2 max-w-[360px] text-[14px] leading-[21px] text-pretty text-pp-muted md:text-[15px] md:leading-[23px]">
                    {item.promise}
                  </p>
                </div>

                {/* the specification */}
                <div className="min-w-0">
                  <div className="grid gap-x-8 gap-y-2 sm:grid-cols-[76px_minmax(0,1fr)]">
                    {/* 3px down so the 16px label sits on the first 21px item line. */}
                    <p className={cn(FIELD, "sm:pt-[3px]")}>Delivers</p>
                    <ul className="space-y-2">
                      {item.deliverables.map((d) => (
                        <li key={d} className="flex gap-3">
                          {/* A rule, not a bullet — the page groups with
                              hairlines and this is the smallest one. 10px
                              down centres it on a 21px line. */}
                          <span aria-hidden className="mt-[10px] h-px w-3 shrink-0 bg-pp-hair" />
                          <span className="min-w-0 text-[14px] leading-[21px] text-pp-ink/85">{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-5 grid gap-x-8 gap-y-2 border-t border-pp-rule pt-5 sm:grid-cols-[76px_minmax(0,1fr)]">
                    <p className={FIELD}>Stack</p>
                    <div className="flex flex-wrap items-center gap-y-2">
                      {item.stack.map((s, i) => (
                        <motion.span
                          key={s}
                          custom={i}
                          variants={token}
                          className={cn(
                            "mono text-[11px] leading-4 tracking-[0.14em] text-pp-ink uppercase",
                            i > 0 && "ml-3 border-l border-pp-hair pl-3",
                          )}
                        >
                          {s}
                        </motion.span>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.li>
            );
          })}
        </ul>

        {/*
          The only destination in the band. It is the intro's, not the first
          row's: hanging the link off one of five otherwise identical rows
          would imply the other four are links a reader has failed to find.
        */}
        <Reveal delay={0.05}>
          <PillLink href={SOLUTIONS_INTRO.href} variant="secondary" className="mt-9">
            {SOLUTIONS_INTRO.cta}
          </PillLink>
        </Reveal>
      </Frame>
    </section>
  );
}
