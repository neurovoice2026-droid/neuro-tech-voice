"use client";

import { CircleQuestionMark } from "lucide-react";
import { FAQ, FAQ_INTRO, FAQ_STAGES } from "@/lib/site";
import { Reveal } from "./reveal";

/**
 * FAQ — grouped by when the question turns up, and answered in the open.
 *
 * Two things were wrong with the accordion this replaces, and the second
 * is the interesting one.
 *
 * The obvious one: every answer was folded away. A reader with two
 * questions had to open seven drawers to find them, and a reader with none
 * saw a wall of closed drawers and scrolled past — a strange thing to do
 * to the last section before the price, where the entire job is removing
 * reasons not to sign up. Nothing here is worth making somebody click for,
 * so nothing here is hidden.
 *
 * The subtle one: the order was arbitrary. Doubts arrive on a schedule.
 * "Can I cancel" is a question you have before handing over an email
 * address; "do I need a new number" only becomes urgent halfway through
 * setting it up; "what if I go over" is a question nobody has until the
 * agent has been answering for three weeks. Grouped by moment, a reader
 * finds their own column instead of scanning all eight — and the three
 * headings say something the answers cannot, which is that somebody here
 * has thought about the whole arc of using this and not only about the
 * sale.
 */

export function Faq() {
  return (
    <section
      id="faq"
      className="relative scroll-mt-24 px-[1.6em] py-[6em] md:py-[8em]"
    >
      <div className="relative mx-auto max-w-[76em]">
        <div className="mx-auto flex max-w-[42em] flex-col items-center text-center">
          <Reveal>
            <span className="inline-flex items-center gap-[0.55em] rounded-full border border-[var(--cover-brand-lit)]/25 bg-[var(--cover-brand-lit)]/10 px-[1.15em] py-[0.5em] text-[0.72em] font-semibold uppercase leading-none tracking-[0.18em] text-[var(--cover-brand-lit)]">
              <CircleQuestionMark
                className="size-[1.25em] shrink-0"
                strokeWidth={2}
              />
              {FAQ_INTRO.eyebrow}
            </span>
          </Reveal>

          <Reveal delay={0.06} className="mt-[1em]">
            <h2 className="text-balance text-[2.8em] font-medium leading-[1.03] tracking-[-0.045em] md:text-[3.4em]">
              {FAQ_INTRO.title}
            </h2>
          </Reveal>

          <Reveal
            delay={0.12}
            className="mt-[1.1em] max-w-[34em] text-pretty text-[1.05em] leading-[1.6] text-[var(--cover-paper)]/60"
          >
            {FAQ_INTRO.sub}
          </Reveal>
        </div>

        {/* Three moments, left to right. The rule across the top of each is
            what makes the grouping read as an arc rather than as three
            arbitrary buckets. */}
        <div className="mt-[3.5em] grid gap-[2.8em] md:mt-[4.5em] md:grid-cols-3 md:gap-[2.4em]">
          {FAQ_STAGES.map((stage, si) => (
            <Reveal key={stage.id} delay={si * 0.08} y={24}>
              <div className="border-t border-[var(--cover-paper)]/15 pt-[1.1em]">
                <div className="flex items-baseline gap-[0.8em]">
                  <span className="mono text-[0.62em] tracking-[0.14em] text-[var(--cover-brand-lit)]/70">
                    {stage.n}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[1.05em] font-medium leading-tight">
                      {stage.label}
                    </p>
                    <p className="mono mt-[0.5em] text-[0.58em] uppercase tracking-[0.18em] text-[var(--cover-paper)]/30">
                      {stage.note}
                    </p>
                  </div>
                </div>

                <dl className="mt-[1.8em] flex flex-col gap-[1.7em]">
                  {FAQ.filter((f) => f.stage === stage.id).map((f) => (
                    <div key={f.q}>
                      <dt className="text-[0.95em] font-medium leading-[1.4] text-[var(--cover-paper)]/90">
                        {f.q}
                      </dt>
                      <dd className="mt-[0.55em] text-[0.86em] leading-[1.65] text-[var(--cover-paper)]/50">
                        {f.a}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
