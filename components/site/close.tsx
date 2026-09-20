"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  AUTH,
  AVG_CALL_MIN,
  CALL_FATE,
  COMPANY,
  CTA_CLOSE,
  DAYS_PER_MONTH,
  LEAD_DECAY,
  SETUP_LANGS,
  TIERS,
  costFor,
} from "@/lib/site";
import {
  Eyebrow,
  Frame,
  PillLink,
  Rule,
  SectionHeading,
} from "./product/primitives";
import { CountUp, MaskRise, EASE, RevealStagger, StaggerItem } from "./reveal";

/**
 * The close — a collection, then the way in.
 *
 * **It restates nothing.** The call to action this replaces said "Never
 * miss another call. Start booking meetings today", a sentence that could
 * sit at the bottom of any voice-agent site ever built, and which asked
 * the reader to take on trust the one thing eleven sections above had just
 * spent their whole length proving. So the close makes no new claim. It
 * reprints four figures the page has already earned — the share that never
 * gets answered, the shelf before the odds collapse, the languages the
 * greeting is written in, the daily cost off the receipt — and links each
 * to the section it came from, so a reader who doubts one can go back and
 * check it rather than being asked to swallow it here. A number appearing
 * for the first time in a call to action is a number nobody has any reason
 * to believe. None of the four is typed into this file either; see
 * `FIGURES`.
 *
 * **It closes the way every other page on this site closes.** The earlier
 * version of this section was built on the dark cover's geometry — corner
 * marks bracketing the type, the button thrown to the far left, the hero's
 * equalizer still ticking on column 11 — so that the last screen returned
 * the reader to the object they arrived at. That argument died with the
 * dark interior. The page is white now, in the same light system as
 * `/product/*` and `/solutions/*`, and the reader's memory of "how this
 * company ends a page" comes from those pages, not from the cover. So the
 * shape here is `ProductStart`'s: a `Frame` column, a violet eyebrow over
 * the imperative on the left, the two pill actions and their terms on the
 * right. Nothing on this screen imitates the hero, and nothing tries to
 * blend into the dark imprint below it — white stock between two dark
 * ends is how every product page is already built.
 *
 * **The order is evidence, then imperative.** The receipts come first and
 * the headline last, which puts the section's own heading after its
 * content — a compromise made with open eyes. The alternative, "Answer
 * it." followed by the proof it rests on, ends the page on a table. The
 * section carries an `aria-label` so the region is still named; the pp
 * `SectionHeading` owns its own `h2` and takes no id, and inventing a
 * hand-built masthead just to hang one off would put a second, slightly
 * different heading style on a page whose whole point is that there is
 * one.
 *
 * **The phone number is printed, and it is not decoration.** A page
 * arguing for the whole length of itself that an unanswered phone costs a
 * business everything cannot end with a form as its only human route. It
 * is set as display type directly under the imperative and it is
 * answered. The secondary pill points at the same `tel:` and says what it
 * is, so the bare numeral is not asked to label itself.
 *
 * **Motion, retuned for white.** The mechanisms are the ones this section
 * already had — the figures count themselves in, the receipts arrive as
 * four separate events, the fencing rules draw open from the middle, the
 * imperative rises under a mask — because all four are things being drawn
 * rather than lit, and drawing is what survives the move off black. The
 * hover glows and the magnetic pull went with the cover: on white they
 * read as smudge. Every piece honours `useReducedMotion`.
 */

/**
 * The two section labels, held here and not in `lib/site.ts`.
 *
 * What used to be here was a masthead — a numeral ("12") and a kicker —
 * because the dark spread numbered its sections. The light system does
 * not: a section opens with a violet `Eyebrow` naming what is under it and
 * nothing else, so the numeral has nowhere to go and the kickers are all
 * that survive. `ask` is the house word for a closing block; the product
 * pages all use "Get started" or "Start" in the same slot.
 */
const EYEBROWS = { receipts: "The receipts", ask: "Start" } as const;

/* ------------------------------------------------------------------ *
 * The four figures, derived here rather than written in `CTA_CLOSE`.
 *
 * The receipts the close reprints are the page's own, and the only way
 * they can stay the page's own is to be read from the same constants the
 * sections computed them from. The block that used to sit in `lib/site.ts`
 * carried a hand-typed "$10 a day" from a price list that had been
 * replaced twice — in the one section whose entire job is to be
 * checkable. So the constant now holds labels and anchors and nothing
 * else, and every number on this screen is arithmetic done at render.
 * ------------------------------------------------------------------ */

/** Ten a day: the calculator's own default, so the two agree on sight. */
const CLOSE_CALLS_DAY = 10;

/** Everything that is not answered by a person, which is the claim. */
const UNANSWERED = CALL_FATE.filter((f) => f.id !== "live").reduce(
  (s, f) => s + f.share,
  0,
);

/**
 * The plan is chosen by the receipt's rule, not by the lowest total.
 *
 * `pricing.tsx` names the smallest plan whose allowance actually covers
 * the volume — a plan you blow through eightfold is a warning light, not
 * a saving — and this figure links straight to that section. Picking the
 * cheapest here instead would put two different dollar amounts one click
 * apart, under a heading that promises they can be checked. The `false`
 * is the calculator's default billing period, for the same reason.
 */
const CLOSE_MINUTES = CLOSE_CALLS_DAY * DAYS_PER_MONTH * AVG_CALL_MIN;
const CLOSE_TIER =
  TIERS.find((t) => t.minutes >= CLOSE_MINUTES) ?? TIERS[TIERS.length - 1];
const CLOSE_PER_DAY =
  costFor(CLOSE_TIER, CLOSE_MINUTES, false) / DAYS_PER_MONTH;

/**
 * Positional, and it has to be.
 *
 * Each label in `CTA_CLOSE.receipts` is written for exactly one of these
 * — "is how long the odds hold flat" is a sentence about one number and
 * no other. Keyed on the label instead, the copy could be reworded and
 * quietly keep the wrong figure; a wrong index shows up the moment the
 * section is opened.
 *
 * Shaped for `CountUp` rather than pre-formatted, because each figure
 * counts itself into place and a string cannot be counted to.
 */
const FIGURES: {
  to: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}[] = [
  { to: Math.round(UNANSWERED * 100), suffix: "%" },
  // The near end of the study's plateau, read off the data rather than
  // restated beside it.
  { to: LEAD_DECAY[0].at / 60, suffix: " min" },
  { to: SETUP_LANGS.length },
  { to: CLOSE_PER_DAY, prefix: "$", decimals: 2 },
];

/* ------------------------------------------------------------------ *
 * Pieces.
 * ------------------------------------------------------------------ */

/**
 * A hairline that draws itself outward from the middle.
 *
 * Two of them fence the receipts, and the direction is the reason they
 * are animated at all: a rule that wipes left-to-right reads as a line
 * being drawn *under* something, while one opening from the centre reads
 * as a bracket closing around the four figures between them. Borders
 * cannot be transformed on their own, so these are elements.
 *
 * `bg-pp-rule` and not the cover's paper-at-12%: on white the fence is
 * the system's own hairline, the same one `Rule` and every card edge on
 * the light pages draw.
 */
function OpeningRule({ delay = 0 }: { delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      aria-hidden
      className="h-px origin-center bg-pp-rule"
      initial={reduce ? false : { scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    />
  );
}

/* ------------------------------------------------------------------ *
 * The section.
 * ------------------------------------------------------------------ */

export function Close() {
  return (
    <section
      id="close"
      // The heading below belongs to `SectionHeading`, which owns its own
      // `h2` and takes no id, so the region is named directly.
      aria-label={CTA_CLOSE.title}
      className="relative scroll-mt-24"
    >
      <Rule />

      {/* The receipts. Each traces back to the section it came from, and
          the anchor is the link — a receipt the reader cannot get back to
          is not a receipt. */}
      <Frame className="px-6 pt-16 pb-6 md:px-12 md:pt-24 md:pb-10">
        <Eyebrow>{EYEBROWS.receipts}</Eyebrow>
        <div className="mt-8 md:mt-10">
          <OpeningRule />
          <RevealStagger
            stagger={0.1}
            className="grid grid-cols-2 gap-x-8 gap-y-10 py-10 md:grid-cols-4 md:gap-x-12 md:py-12"
          >
            {CTA_CLOSE.receipts.map((r, i) => {
              const f = FIGURES[i];
              return (
                <StaggerItem key={r.label} className="flex flex-col items-start">
                  {/* Its own count, not one fade over all four: the
                      figures are four separate claims from four separate
                      sections, and a single shared reveal asked the reader
                      to take them as one block.

                      Black, not violet. On white the accent is reserved
                      for the things that are active — the eyebrow and the
                      anchors under each figure — and four violet numerals
                      would spend it on the one part of the screen that is
                      simply a fact. */}
                  <p
                    className="pp-display text-[34px] leading-none tracking-[-0.02em] text-pp-ink md:text-[44px]"
                    // Inline: `.pp-display` sets 360 outside Tailwind's
                    // layers, which would beat a weight utility.
                    style={{ fontWeight: 480 }}
                  >
                    <CountUp
                      to={f.to}
                      prefix={f.prefix}
                      suffix={f.suffix}
                      decimals={f.decimals}
                    />
                  </p>
                  <p className="mt-4 max-w-[15rem] text-pretty text-[14px] leading-[21px] text-pp-muted md:text-[15px] md:leading-[22px]">
                    {r.label}
                  </p>
                  {/* The anchor set as the section's own name: "#your-bill"
                      printed at a reader is a URL. A plain anchor and not
                      a router link — nothing here is a route. 24px tall
                      rather than its 16px line, because a standalone link
                      gets the WCAG 2.5.8 minimum target. */}
                  <a
                    href={r.where}
                    className="mt-4 inline-flex min-h-6 items-center gap-2 text-[11px] leading-4 font-medium tracking-[0.14em] text-pp-accent uppercase underline-offset-4 transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink"
                  >
                    <span aria-hidden>↑</span>
                    {r.where.slice(1).replace(/-/g, " ")}
                  </a>
                </StaggerItem>
              );
            })}
          </RevealStagger>
          <OpeningRule delay={0.08} />
        </div>
      </Frame>

      {/* The ask, in the shape every light page closes in: the imperative
          and the human route on the left, the two actions and the terms
          they qualify on the right. The terms sit against the button
          rather than in a line of small print at the foot of the screen. */}
      <Frame className="grid gap-10 px-6 pt-10 pb-20 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:gap-12 md:px-12 md:pt-14 md:pb-28">
        <div>
          <SectionHeading eyebrow={EYEBROWS.ask} className="max-w-[640px]">
            <MaskRise lines={[CTA_CLOSE.title]} />
          </SectionHeading>
          {/* The human route, printed. No label above it: the secondary
              pill beside it already says what the number is, and the same
              three words twice on one screen reads as a mistake rather
              than as emphasis. */}
          <a
            href={COMPANY.phoneHref}
            className="pp-display mt-6 inline-flex min-h-6 items-center text-[28px] leading-[34px] tracking-[-0.02em] text-pp-ink underline-offset-[6px] transition-colors hover:text-pp-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink md:text-[34px] md:leading-[40px]"
            style={{ fontWeight: 480 }}
          >
            {COMPANY.phone}
          </a>
        </div>
        <div className="flex flex-col items-start gap-3 md:items-end">
          {/* gap-y is deliberately larger than gap-x: two pills 8px apart
              fail the touch-target spacing rule the moment the row wraps. */}
          <div className="flex flex-wrap gap-x-2 gap-y-6">
            <PillLink href={AUTH.signup}>{CTA_CLOSE.primary}</PillLink>
            <PillLink href={AUTH.contactSales} variant="secondary">
              {CTA_CLOSE.secondary}
            </PillLink>
          </div>
          <p className="max-w-[22rem] text-[13px] leading-[18px] text-pp-muted md:text-right">
            {CTA_CLOSE.note}
          </p>
        </div>
      </Frame>
    </section>
  );
}
