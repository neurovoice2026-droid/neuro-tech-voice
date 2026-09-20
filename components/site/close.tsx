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
import { cn } from "@/lib/utils";
import { CornerDot } from "./corner-dot";
import { IntentLink } from "./intent-link";
import { CountUp, EASE, MaskRise, Magnetic, RevealStagger, StaggerItem } from "./reveal";

/**
 * The close — a collection, and a return to the cover.
 *
 * Two decisions carry this section, and both are about position rather
 * than copy.
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
 * **It is built on the cover's geometry, not the interior's.** Every
 * section between here and the hero sits on a left-aligned masthead over a
 * 76em measure. This one widens back out to `--size-container`, puts the
 * headline on columns 5–8 with the four corner marks bracketing the type,
 * throws the button out to the far left and hangs the equalizer on column
 * 11 — the cover's exact arrangement. The reader has been reading a
 * document for eleven sections; the last screen returns them to the object
 * they arrived at. The bar in the corner is still ticking, on the same
 * keyframes it started on, and nothing else has to say that it never
 * stops.
 *
 * **The order is evidence, then imperative.** The receipts come first and
 * the headline last, which puts the section's own `h2` after its content —
 * a compromise made with open eyes. The alternative, "Answer it." followed
 * by the proof it rests on, ends the page on a table; and the whole point
 * of the cover block is that it is the final thing on screen. The section
 * is named by `aria-labelledby` so nothing is left unlabelled by it.
 *
 * **The phone number is printed, and it is not decoration.** A page
 * arguing for the whole length of itself that an unanswered phone costs a
 * business everything cannot end with a form as its only human route.
 * Ours is set as display type, directly under the imperative, and it is
 * answered.
 *
 * The logo-and-wordmark lockup that used to close this section is gone.
 * It rendered a 600×430 source into a square box, squashing the mark about
 * a third, and the footer repeats the same mark four ems below it.
 */

/**
 * The section's own masthead line. It is not in `lib/site.ts` on purpose:
 * the numeral is a fact about where this section sits on the page, which
 * is `app/page.tsx`'s business and not the copy deck's, and the kicker
 * names what is directly beneath it rather than the section's genre.
 */
const MASTHEAD = { numeral: "12", kicker: "The receipts" } as const;

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
 */
function OpeningRule({ delay = 0 }: { delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      aria-hidden
      className="h-px origin-center bg-[var(--cover-paper)]/12"
      initial={reduce ? false : { scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    />
  );
}

/**
 * The cover's corner marks, at the cover's own offsets.
 *
 * Deliberately a copy of `hero.tsx`'s `CornerMarks` and not a shared
 * import: the hero is frozen, and the page's last motion being a literal
 * re-run of its first is the whole idea — same sizes, same delay ladder,
 * same ease. If the two ever disagree, the hero is right.
 *
 * They fire on mount rather than in view, like the hero's, and they are
 * the one thing here that does: the delay ladder is tuned against the
 * cover's opening sequence, and re-timing it to a scroll position would
 * make it a different animation wearing the same numbers.
 */
function CornerMarks() {
  const reduce = useReducedMotion();
  const at = {
    tl: "top-[1.375em] right-full mr-[0.7em]",
    tr: "top-[1.375em] left-full ml-[0.7em]",
    bl: "bottom-[0.125em] right-full mr-[0.7em]",
    br: "bottom-[0.125em] left-full ml-[0.7em]",
  };
  return (
    <>
      {Object.entries(at).map(([k, pos], i) => (
        <motion.span
          key={k}
          aria-hidden
          className={cn("absolute block size-[0.625em] bg-current", pos)}
          initial={reduce ? false : { opacity: 0, scale: 0.4 }}
          animate={reduce ? undefined : { opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 1.15 + i * 0.07, ease: EASE }}
        />
      ))}
    </>
  );
}

/** The cover's four bars, still keeping time. Same keyframes, same rates. */
function Equalizer() {
  return (
    <div
      aria-hidden
      className="flex h-[1.1em] w-[2em] items-end justify-center gap-[0.16em]"
    >
      {[0.55, 1, 0.4, 0.78].map((h, i) => (
        <span
          key={i}
          className="w-[0.14em] bg-current"
          style={{
            height: `${h * 100}%`,
            transformOrigin: "bottom",
            animation: `equalize ${0.8 + i * 0.22}s ease-in-out ${i * 0.13}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * The primary button, answering the cover's.
 *
 * The hero's CTA is a paper plate with a dot in each corner that flips to
 * the brand on hover; this is that button again at the foot of the page,
 * so the first and last things the reader can click are the same object.
 * Everything moves on `duration-500`, which is the cover's hover speed.
 */
function CloseCta() {
  return (
    <IntentLink
      href={AUTH.signup}
      className="group inline-grid select-none text-[1.25em] leading-[1.2] tracking-[-0.04em]"
    >
      <span className="col-start-1 row-start-1 grid grid-cols-2 grid-rows-2 rounded-[0.2em] bg-[var(--cover-paper)] p-[0.33em] text-[var(--cover-ink)] transition-colors duration-500 group-hover:bg-[var(--cover-brand)] group-hover:text-[var(--cover-paper)]">
        <CornerDot className="size-[0.3em] justify-self-start transition-transform duration-500 group-hover:-translate-x-[0.12em] group-hover:-translate-y-[0.12em]" />
        <CornerDot className="size-[0.3em] justify-self-end transition-transform duration-500 group-hover:-translate-y-[0.12em] group-hover:translate-x-[0.12em]" />
        <CornerDot className="size-[0.3em] self-end justify-self-start transition-transform duration-500 group-hover:-translate-x-[0.12em] group-hover:translate-y-[0.12em]" />
        <CornerDot className="size-[0.3em] self-end justify-self-end transition-transform duration-500 group-hover:translate-x-[0.12em] group-hover:translate-y-[0.12em]" />
      </span>
      <span className="col-start-1 row-start-1 z-10 flex items-center gap-[0.45em] whitespace-nowrap px-[1em] py-[0.8em] text-[var(--cover-ink)] transition-colors duration-500 group-hover:text-[var(--cover-paper)]">
        {CTA_CLOSE.primary}
        <span className="transition-transform duration-500 group-hover:translate-x-[0.25em]">
          →
        </span>
      </span>
    </IntentLink>
  );
}

/* ------------------------------------------------------------------ *
 * The section.
 * ------------------------------------------------------------------ */

export function Close() {
  return (
    <section
      id="close"
      aria-labelledby="close-title"
      className="relative scroll-mt-24 py-[6em] md:py-[8em]"
    >
      {/* The cover's measure and the cover's gutter, not the interior's
          76em column. The padding sits inside the max width exactly as
          `hero.tsx` sets it, so the far-left button lands on the same
          vertical the cover's button did. */}
      <div className="relative mx-auto w-full max-w-[var(--size-container)] px-[1.5em]">
        {/* Masthead. Left on the gutter; the numeral says where on the
            page this is, the kicker names what is under it. */}
        <div className="flex items-center gap-[0.55em]">
          <CornerDot className="size-[0.55em]" />
          <span className="mono text-[0.7em] uppercase tracking-[0.24em] text-[var(--cover-paper)]/45">
            {MASTHEAD.numeral}
          </span>
          <span className="mono text-[0.7em] uppercase tracking-[0.24em] text-[var(--cover-paper)]/45">
            {MASTHEAD.kicker}
          </span>
        </div>
        <div className="mt-[1.4em] h-px bg-[var(--cover-paper)]/12" />

        {/* The receipts. Each traces back to the section it came from, and
            the anchor is the link — a receipt the reader cannot get back
            to is not a receipt. */}
        <div className="mt-[4.5em]">
          <OpeningRule />
          <RevealStagger
            stagger={0.1}
            className="grid grid-cols-2 gap-x-[1.5em] gap-y-[2.6em] py-[2.6em] md:grid-cols-4"
          >
            {CTA_CLOSE.receipts.map((r, i) => {
              const f = FIGURES[i];
              return (
                <StaggerItem key={r.label} className="flex flex-col items-start">
                  {/* Its own count, not one fade over all four: the
                      figures are four separate claims from four separate
                      sections, and a single shared reveal asked the reader
                      to take them as one block. */}
                  <p className="text-[2.2em] font-medium leading-none tracking-[-0.04em] text-[var(--cover-brand-lit)]">
                    <CountUp
                      to={f.to}
                      prefix={f.prefix}
                      suffix={f.suffix}
                      decimals={f.decimals}
                    />
                  </p>
                  <p className="mt-[0.9em] max-w-[13em] text-pretty text-[0.85em] leading-[1.5] text-[var(--cover-paper)]/75">
                    {r.label}
                  </p>
                  {/* The anchor set as the section's own name: "#your-bill"
                      printed at a reader is a URL, and the cover already
                      speaks in mono caps. A plain anchor and not a router
                      link — nothing here is a route. */}
                  <a
                    href={r.where}
                    className="mono mt-[0.9em] inline-flex items-center gap-[0.45em] text-[0.62em] uppercase tracking-[0.2em] text-[var(--cover-paper)]/55 transition-colors duration-500 hover:text-[var(--cover-brand-lit)]"
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

        {/* The cover again: button far left, type centred on columns 5–8
            with the marks bracketing it, bars on column 11. */}
        <div className="relative mt-[6em] flex flex-col items-center gap-[3em] md:mt-[8em] md:grid md:grid-cols-12 md:items-end md:gap-0">
          <div className="order-2 flex flex-col items-center gap-[1.2em] md:absolute md:left-0 md:top-0 md:order-none md:items-start md:pt-[1em]">
            <Magnetic>
              <CloseCta />
            </Magnetic>
            {/* The terms belong against the button they qualify, not in a
                line of small print at the bottom of the screen. */}
            <p className="mono max-w-[16em] text-center text-[0.62em] uppercase leading-[1.7] tracking-[0.2em] text-[var(--cover-paper)]/75 md:text-left">
              {CTA_CLOSE.note}
            </p>
          </div>

          {/* `w-max` mirrors the cover: the block is only as wide as its
              longest line, so the marks bracket the type and not the grid
              cell. */}
          <div className="relative order-1 flex flex-col items-center gap-[1.4em] text-center text-[var(--cover-paper)] md:order-none md:col-span-4 md:col-start-5 md:w-max md:justify-self-center md:gap-[2.2em]">
            <CornerMarks />
            <h2
              id="close-title"
              className="text-balance text-[2.8em] font-medium leading-[1.03] tracking-[-0.045em] md:text-[3.4em]"
            >
              <MaskRise lines={[CTA_CLOSE.title]} />
            </h2>
            {/* The human route, printed. The label rides above the number
                because the number is the thing being offered. */}
            <a
              href={AUTH.contactSales}
              className="group flex flex-col items-center gap-[0.5em]"
            >
              <span className="mono text-[0.7em] uppercase tracking-[0.24em] text-[var(--cover-paper)]/75 transition-colors duration-500 group-hover:text-[var(--cover-paper)]">
                {CTA_CLOSE.secondary}
              </span>
              <span className="text-[1.5em] font-medium leading-[1.1] tracking-[-0.03em] transition-colors duration-500 group-hover:text-[var(--cover-brand-lit)] md:text-[1.8em]">
                {COMPANY.phone}
              </span>
            </a>
          </div>

          {/* Still ticking. Shown on phones too — the last mark on the page
              is the same mark the cover opened with, and a reader on a
              phone read the same cover. */}
          <div className="order-3 flex md:col-span-2 md:col-start-11 md:order-none md:justify-end md:self-end">
            <Equalizer />
          </div>
        </div>
      </div>
    </section>
  );
}
