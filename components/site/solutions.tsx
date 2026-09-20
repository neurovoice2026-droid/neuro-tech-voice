"use client";

import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { SOLUTIONS_INTRO, SOLUTION_ITEMS } from "@/lib/site";
import { cn } from "@/lib/utils";
import { CornerDot } from "./corner-dot";
import { IntentLink } from "./intent-link";
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
 * disagreed with. So: one ruled row per item, fields labelled in the mono
 * caption tone, the stack in mono because a stack is a list of names and
 * setting it as prose would be a lie about what it is. Hairlines and the
 * label gutter do the grouping; nothing is boxed.
 *
 * **One link, and it is the intro's.** Four of the five solution pages do
 * not exist. A section whose entire job is to look like we know what we are
 * doing cannot afford to walk a reader into a 404 — that single dead click
 * costs more than the whole band earns. So the four are named in full, with
 * their promise and their stack, and are simply not links. No "coming
 * soon" either: an unlinked heading reads as a capability, an unlinked
 * heading with a badge on it reads as a roadmap.
 *
 * **The stack is what arrives.** Motion here is doing one job: the four
 * tokens are the load-bearing evidence in each row, so they land in
 * sequence as their own row crosses into view — the eye is walked across
 * the proof rather than shown a decorative fade. Nothing loops, nothing
 * fades from zero (a row that never animates must still be readable), and
 * under `useReducedMotion` every element renders in its final state with no
 * scroll binding at all.
 */

/** The section's place in the spread. Hard-coded here, as every section's is. */
const NUMERAL = "06";

/**
 * Line numbers for the ledger. Two digits so the rail stays a fixed
 * optical width and the labels start on one vertical.
 */
const lineNo = (i: number) => String(i + 1).padStart(2, "0");

/** Caption tone. Field names, never substance — hence /45 rather than /75. */
const FIELD =
  "mono text-[0.58em] uppercase leading-[1.7] tracking-[0.2em] text-[var(--cover-paper)]/45";

export function Solutions() {
  const reduce = useReducedMotion();

  /**
   * The row settles; it does not appear. Starting from zero opacity would
   * mean a row that is never animated — a backgrounded tab starves rAF —
   * stays invisible, and these rows are the section.
   */
  const row = {
    rest: reduce ? {} : { opacity: 0.5, y: 10 },
    enter: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
  };

  /**
   * The stack tokens, landing left to right behind their own row. The index
   * comes in as `custom` so the delay is a property of the token's position
   * rather than of a wrapper, which keeps the four of them on one flex line
   * instead of inside four staggered boxes.
   */
  const token = {
    rest: reduce ? {} : { opacity: 0.25, y: 8 },
    enter: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.45, delay: 0.14 + i * 0.04, ease: EASE },
    }),
  };

  return (
    <section
      id="solutions"
      className="relative scroll-mt-24 px-[1.6em] py-[6em] md:py-[8em]"
    >
      <div className="relative mx-auto max-w-[76em]">
        {/* masthead — on the gutter, not centred */}
        <Reveal>
          <div
            className={cn(
              "flex items-center gap-[0.75em]",
              "mono text-[0.7em] uppercase tracking-[0.24em] text-[var(--cover-paper)]/45",
            )}
          >
            <CornerDot className="size-[0.55em] shrink-0" />
            <span>{NUMERAL}</span>
            <span>{SOLUTIONS_INTRO.kicker}</span>
          </div>

          <h2 className="mt-[0.9em] text-balance text-[2.8em] font-medium leading-[1.03] tracking-[-0.045em] md:text-[3.4em]">
            {SOLUTIONS_INTRO.title}
          </h2>

          <p className="mt-[0.9em] max-w-[44em] text-pretty text-[1.05em] leading-[1.6] text-[var(--cover-paper)]/75">
            {SOLUTIONS_INTRO.sub}
          </p>

          <div className="mt-[2.2em] h-px bg-[var(--cover-paper)]/12" />
        </Reveal>

        {/* the ledger */}
        <ul>
          {SOLUTION_ITEMS.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.li
                key={item.id}
                variants={row}
                initial={reduce ? false : "rest"}
                whileInView="enter"
                viewport={{ once: true, margin: "-12% 0px -8% 0px" }}
                className="grid gap-x-[1.8em] gap-y-[1em] border-b border-[var(--cover-paper)]/12 py-[1.8em] md:grid-cols-[2.4em_minmax(13em,1fr)_minmax(0,1.4fr)]"
              >
                {/* rail: the mark and the line number */}
                <div className="flex items-center gap-[0.7em] md:block">
                  <Icon
                    className="size-[1.2em] shrink-0 text-[var(--cover-brand-lit)]"
                    strokeWidth={1.9}
                    aria-hidden
                  />
                  <span className="mono text-[0.62em] uppercase leading-none tracking-[0.2em] text-[var(--cover-paper)]/45 md:mt-[0.9em] md:block">
                    {lineNo(index)}
                  </span>
                </div>

                {/* what it is */}
                <div>
                  <h3 className="text-[1.15em] font-medium leading-[1.25] tracking-[-0.02em]">
                    {item.label}
                  </h3>
                  <p className="mt-[0.5em] text-pretty text-[0.95em] leading-[1.55] text-[var(--cover-paper)]/75">
                    {item.promise}
                  </p>
                </div>

                {/* the specification */}
                <div>
                  <div className="grid gap-x-[1.4em] gap-y-[0.35em] sm:grid-cols-[5.5em_minmax(0,1fr)]">
                    <p className={cn(FIELD, "sm:pt-[0.3em]")}>Delivers</p>
                    <ul className="space-y-[0.4em]">
                      {item.deliverables.map((d) => (
                        <li key={d} className="flex gap-[0.7em]">
                          {/* A rule, not a bullet — the page groups with
                              hairlines and this is the smallest one. */}
                          <span
                            aria-hidden
                            className="mt-[0.72em] h-px w-[0.7em] shrink-0 bg-[var(--cover-paper)]/25"
                          />
                          <span className="text-[0.9em] leading-[1.55] text-[var(--cover-paper)]/75">
                            {d}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-[0.9em] grid gap-x-[1.4em] gap-y-[0.35em] border-t border-[var(--cover-paper)]/10 pt-[0.9em] sm:grid-cols-[5.5em_minmax(0,1fr)]">
                    <p className={cn(FIELD, "sm:pt-[0.15em]")}>Stack</p>
                    <div className="flex flex-wrap items-center gap-y-[0.5em]">
                      {item.stack.map((s, i) => (
                        <motion.span
                          key={s}
                          custom={i}
                          variants={token}
                          className={cn(
                            "mono text-[0.62em] uppercase leading-[1.4] tracking-[0.16em] text-[var(--cover-paper)]/75",
                            i > 0 &&
                              "ml-[0.95em] border-l border-[var(--cover-paper)]/20 pl-[0.95em]",
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
          <IntentLink
            href={SOLUTIONS_INTRO.href}
            className="group mt-[1.8em] inline-flex items-center gap-[0.6em] text-[1em] leading-none text-[var(--cover-brand-lit)] transition-colors duration-500 hover:text-[var(--cover-paper)]"
          >
            <span className="border-b border-[var(--cover-brand-lit)]/35 pb-[0.25em] transition-colors duration-500 group-hover:border-[var(--cover-paper)]/60">
              {SOLUTIONS_INTRO.cta}
            </span>
            <ArrowRight
              className="size-[1em] shrink-0 transition-transform duration-500 group-hover:translate-x-[0.2em]"
              strokeWidth={2}
              aria-hidden
            />
          </IntentLink>
        </Reveal>
      </div>
    </section>
  );
}
