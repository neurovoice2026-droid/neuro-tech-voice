"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, PhoneCall } from "lucide-react";
import { AUTH, COMPANY, CTA_CLOSE } from "@/lib/site";
import { Reveal, Magnetic } from "./reveal";

/**
 * The close — a collection, not a fresh set of claims.
 *
 * The call to action this replaces said "Never miss another call. Start
 * booking meetings today", which is a sentence that could sit at the
 * bottom of any voice-agent site ever built, and which asked the reader to
 * take on trust the one thing the eight sections above had just spent
 * their whole length proving.
 *
 * So the close restates nothing. It reprints four figures the page has
 * already earned — the unanswered 62%, the five-minute shelf, the clock
 * from the setup, the daily cost from the receipt — and labels each with
 * the section it came from, so a reader who doubts one can go back and
 * check it rather than being asked to swallow it here. A number appearing
 * for the first time in a call to action is a number nobody has any reason
 * to believe.
 *
 * The phone number is deliberate too, and it is not decoration: a page
 * arguing for the whole length of itself that an unanswered phone costs a
 * business everything cannot end with an email form as its only human
 * route. Ours is on the page, and it is answered.
 */

export function CTA() {
  return (
    <section className="relative scroll-mt-24 px-[1.6em] py-[6em] md:py-[8em]">
      <div className="relative mx-auto max-w-[64em] text-center">
        <Reveal>
          <h2 className="text-balance text-[3em] font-medium leading-[1.02] tracking-[-0.045em] md:text-[4.2em]">
            {CTA_CLOSE.title}
          </h2>
        </Reveal>

        <Reveal
          delay={0.08}
          className="mx-auto mt-[1.1em] max-w-[36em] text-pretty text-[1.05em] leading-[1.6] text-[var(--cover-paper)]/55"
        >
          {CTA_CLOSE.sub}
        </Reveal>

        {/* The receipts. Each one traces back to a section by name. */}
        <Reveal delay={0.14} y={24} className="mt-[3em]">
          <div className="grid grid-cols-2 gap-x-[1.5em] gap-y-[2em] border-y border-[var(--cover-paper)]/12 py-[2.2em] md:grid-cols-4">
            {CTA_CLOSE.receipts.map((r) => (
              <div key={r.label} className="flex flex-col items-center">
                <p className="text-[2.2em] font-medium leading-none tracking-[-0.04em] text-[var(--cover-brand-lit)]">
                  {r.value}
                </p>
                <p className="mt-[0.8em] max-w-[11em] text-balance text-[0.8em] leading-[1.45] text-[var(--cover-paper)]/55">
                  {r.label}
                </p>
                <p className="mono mt-[0.7em] text-[0.55em] uppercase tracking-[0.18em] text-[var(--cover-paper)]/25">
                  {r.where}
                </p>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.2} className="mt-[2.8em]">
          <div className="flex flex-col items-center justify-center gap-[0.8em] sm:flex-row">
            <Magnetic>
              <Link
                href={AUTH.signup}
                className="group inline-flex items-center justify-center gap-[0.5em] rounded-full bg-[var(--cover-brand-lit)] px-[1.8em] py-[0.9em] text-[0.9em] font-medium leading-none text-[var(--cover-ink)] transition-opacity duration-300 hover:opacity-85"
              >
                {CTA_CLOSE.primary}
                <ArrowRight
                  className="size-[1.1em] transition-transform duration-300 group-hover:translate-x-[0.2em]"
                  strokeWidth={2.2}
                />
              </Link>
            </Magnetic>

            <Link
              href={COMPANY.phoneHref}
              className="inline-flex items-center justify-center gap-[0.55em] rounded-full border border-[var(--cover-paper)]/20 px-[1.6em] py-[0.9em] text-[0.9em] leading-none text-[var(--cover-paper)]/80 transition-colors duration-300 hover:border-[var(--cover-paper)]/45 hover:text-[var(--cover-paper)]"
            >
              <PhoneCall className="size-[1.05em]" strokeWidth={1.9} />
              {CTA_CLOSE.secondary}
            </Link>
          </div>

          <p className="mono mt-[1.4em] text-[0.62em] uppercase tracking-[0.2em] text-[var(--cover-paper)]/35">
            {CTA_CLOSE.note}
          </p>
        </Reveal>

        {/* The last mark on the cover, closing the run the wordmark opened. */}
        <Reveal delay={0.26} className="mt-[3.5em] flex justify-center">
          <span className="inline-flex items-center gap-[0.7em] text-[var(--cover-paper)]/25">
            <Image
              src={COMPANY.logo}
              alt=""
              width={22}
              height={22}
              className="size-[1.4em] opacity-45"
            />
            <span className="mono text-[0.58em] uppercase tracking-[0.3em]">
              {COMPANY.wordmark}
            </span>
          </span>
        </Reveal>
      </div>
    </section>
  );
}
