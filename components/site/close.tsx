"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  Eyebrow,
  Frame,
  PillLink,
  Rule,
  SectionHeading,
} from "./product/primitives";
import { holdFor, useInView, usePrefersReducedMotion } from "./product/timing";

/**
 * The close — the page auditing itself, then the way in.
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
 * **The scene: a reading head walking the page's own evidence.** This
 * section used to move because the reader scrolled — figures counting
 * themselves in, receipts arriving on a scroll-bound cascade, rules
 * wiping open, the imperative rising under a mask. All of that was an
 * entrance: the page performed for the act of being reached, and said
 * nothing while it did it. What runs here instead is the audit itself. A
 * head steps along the four receipts, one at a time, on the house clock —
 * `holdFor(label)`, so each claim sits for as long as its own sentence
 * takes to read at 230 words a minute, never under 1.4s — and it keeps
 * walking, because the argument is that any one of these four can be
 * picked up and checked, not that they once appeared. The live receipt
 * carries the ink, its rule under the figure, and the lit anchor back to
 * the section that earned it; the other three stay legible and wait their
 * turn. On the top fence, a violet segment sits over whichever column is
 * being read, so the fence is a transport rather than a border.
 *
 * The movement is CSS throughout — `transition-colors`, `transition-opacity`,
 * `transition-transform` at the house's 200/300/500 — and React only
 * changes which index is live. Nothing counts: a number ticking up is a
 * number being animated, and these four are meant to be read.
 *
 * **The reader takes it, permanently.** Pointer, focus or keyboard on any
 * receipt pins that one and stops the clock for good; the four receipts
 * are then a row the reader steps through themselves, arrow keys and tab
 * included. `useInView` keeps the head from walking off screen and the
 * timeout is cleared on unmount, so the page in a background tab is
 * doing nothing at all. Reduced motion gets the whole row live at once —
 * the scene's final, most informative state — and no timers.
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
 * right.
 *
 * **The order is evidence, then imperative.** The receipts come first and
 * the headline last, which puts the section's own heading after its
 * content — a compromise made with open eyes. The alternative, "Answer
 * it." followed by the proof it rests on, ends the page on a table. The
 * section carries an `aria-label` so the region is still named; the pp
 * `SectionHeading` owns its own `h2` and takes no id.
 *
 * **The ask never animates.** It is the last thing on the page and the
 * only thing on it that is asked for; a button that has to wait for a
 * scene to finish before it is fully there is a button that was not
 * offered. The imperative, the phone number and both pills are painted
 * at full strength from the first frame, whatever the head is doing
 * above them.
 *
 * **The phone number is printed, and it is not decoration.** A page
 * arguing for the whole length of itself that an unanswered phone costs a
 * business everything cannot end with a form as its only human route. It
 * is set as display type directly under the imperative and it is
 * answered. The secondary pill points at the same `tel:` and says what it
 * is, so the bare numeral is not asked to label itself.
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

/**
 * Formatted once, at render, and never animated.
 *
 * The same `en-US` grouping and fixed fraction digits the counting
 * version printed on its last frame — the figures are unchanged, only the
 * theatre around them is gone.
 */
function figureText(f: (typeof FIGURES)[number]) {
  const decimals = f.decimals ?? 0;
  return `${f.prefix ?? ""}${f.to.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}${f.suffix ?? ""}`;
}

/* ------------------------------------------------------------------ *
 * The section.
 * ------------------------------------------------------------------ */

export function Close() {
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, "-10% 0px");
  const reduce = usePrefersReducedMotion();

  const count = CTA_CLOSE.receipts.length;
  /** Which receipt is being read. */
  const [head, setHead] = useState(0);
  /** True once the reader has touched the row; the clock never restarts. */
  const [taken, setTaken] = useState(false);

  // The head walks on the house clock: each receipt holds for as long as
  // its own label takes to read. Paused off screen, cleared on unmount,
  // stopped for good the moment the reader takes over.
  useEffect(() => {
    if (taken || reduce || !inView) return;
    const id = window.setTimeout(
      () => setHead((h) => (h + 1) % count),
      holdFor(CTA_CLOSE.receipts[head].label),
    );
    return () => window.clearTimeout(id);
  }, [head, taken, reduce, inView, count]);

  const take = useCallback((i: number) => {
    setTaken(true);
    setHead(i);
  }, []);

  // Reduced motion reads them all as live: the row's finished state, not
  // a blank one waiting for a clock that will never run.
  const isLive = (i: number) => reduce || i === head;

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
        <div ref={rootRef} className="mt-8 md:mt-10">
          {/* The upper fence doubles as the transport: a violet quarter
              sits over the column being read and slides to the next one.
              Below md the grid is two columns wide and the quarter would
              lie about which cell is live, so there it is the per-figure
              rule alone that marks the head. */}
          <div aria-hidden className="relative h-px bg-pp-rule">
            <div
              className={cn(
                "absolute inset-y-0 left-0 hidden w-1/4 bg-pp-accent transition-[transform,opacity] duration-500 md:block",
                reduce && "opacity-0",
              )}
              style={{ transform: `translateX(${head * 100}%)` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-10 py-10 md:grid-cols-4 md:gap-x-12 md:py-12">
            {CTA_CLOSE.receipts.map((r, i) => {
              const live = isLive(i);
              return (
                <div
                  key={r.label}
                  className="flex flex-col items-start"
                  // First pointer, focus or key anywhere in the cell hands
                  // the row to the reader and never takes it back.
                  onPointerEnter={() => take(i)}
                  onPointerDown={() => take(i)}
                  onFocusCapture={() => take(i)}
                  onKeyDownCapture={() => take(i)}
                >
                  {/* Black, not violet. On white the accent is reserved
                      for the things that are active — the eyebrow, the
                      head's rule and the anchors — and four violet
                      numerals would spend it on the one part of the
                      screen that is simply a fact. The figure off the
                      head is held back a step in ink rather than faded
                      out: an unread receipt is still a printed one. */}
                  <p
                    className={cn(
                      "pp-display text-[34px] leading-none tracking-[-0.02em] tabular-nums transition-colors duration-500 md:text-[44px]",
                      live ? "text-pp-ink" : "text-pp-ink/45",
                    )}
                    // Inline: `.pp-display` sets 360 outside Tailwind's
                    // layers, which would beat a weight utility.
                    style={{ fontWeight: 480 }}
                  >
                    {figureText(FIGURES[i])}
                  </p>
                  {/* The head's own mark under the figure it is reading.
                      An element and not a border: borders cannot be
                      scaled, and this one draws out from the left edge of
                      the numeral at the moment the receipt goes live. */}
                  <span
                    aria-hidden
                    className={cn(
                      "mt-3 h-px w-12 origin-left bg-pp-accent transition-transform duration-500",
                      live ? "scale-x-100" : "scale-x-0",
                    )}
                  />
                  <p
                    className={cn(
                      "mt-4 max-w-[15rem] text-pretty text-[14px] leading-[21px] transition-colors duration-500 md:text-[15px] md:leading-[22px]",
                      live ? "text-pp-ink" : "text-pp-muted",
                    )}
                  >
                    {r.label}
                  </p>
                  {/* The anchor set as the section's own name: "#your-bill"
                      printed at a reader is a URL. A plain anchor and not
                      a router link — nothing here is a route. 24px tall
                      rather than its 16px line, because a standalone link
                      gets the WCAG 2.5.8 minimum target. It lights with
                      the head, so the way back to the section is what the
                      scene is pointing at. */}
                  <a
                    href={r.where}
                    className={cn(
                      "mt-4 inline-flex min-h-6 items-center gap-2 text-[11px] leading-4 font-medium tracking-[0.14em] uppercase underline-offset-4 transition-colors duration-300 hover:text-pp-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink",
                      live ? "text-pp-accent" : "text-pp-muted",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "transition-transform duration-300",
                        live ? "-translate-y-px" : "translate-y-0",
                      )}
                    >
                      ↑
                    </span>
                    {r.where.slice(1).replace(/-/g, " ")}
                  </a>
                </div>
              );
            })}
          </div>

          <div aria-hidden className="h-px bg-pp-rule" />
        </div>
      </Frame>

      {/* The ask, in the shape every light page closes in: the imperative
          and the human route on the left, the two actions and the terms
          they qualify on the right. The terms sit against the button
          rather than in a line of small print at the foot of the screen. */}
      <Frame className="grid gap-10 px-6 pt-10 pb-20 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:gap-12 md:px-12 md:pt-14 md:pb-28">
        <div>
          <SectionHeading eyebrow={EYEBROWS.ask} className="max-w-[640px]">
            {CTA_CLOSE.title}
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
