"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import {
  PRICING_INTRO,
  PRICING_PLANS_INTRO,
  PRICING_PLANS_NOTE,
  PRICING_RIVAL,
  TIERS,
  type Tier,
} from "@/lib/site";
import { cn } from "@/lib/utils";
import { Frame, PillLink, SectionHeading } from "./product/primitives";
import { holdFor, useInView, usePrefersReducedMotion } from "./product/timing";

/**
 * Plans — the price list, read against the rate everyone else charges.
 *
 * The receipt in `pricing.tsx` answers "what will this cost me", which is
 * the question a customer asks second. The question they ask first is
 * "what do I get for my money, and is that good" — and that one is
 * comparative whether or not the page admits it. They will open the other
 * tab. This section is the other tab, already open.
 *
 * Three decisions worth keeping:
 *
 *  · **The unit of comparison is the rate, not the plan.** The voice
 *    platforms bill one flat figure a minute at every rung, so "this plan
 *    is 31% under it" is arithmetic that holds everywhere. Their minute
 *    counts appear in exactly two places — the rungs where their sticker
 *    price is identical to ours — because anywhere else it would mean
 *    inventing a plan they do not sell in order to lose a comparison to
 *    it. A number a competitor could dispute is worth less than a smaller
 *    number they cannot.
 *  · **The falling rate is the argument, so the rate is on every card.**
 *    Six and a half cents down to four and a half is a reason to grow on
 *    this invoice rather than move off it at volume. A card that shows
 *    only a fee and an allowance hides the one thing that gets better.
 *  · **The negotiated rung is a strip, not a sixth column.** It is not
 *    bought from a page, and giving it equal width would shrink the five
 *    that are by a fifth to advertise a phone call.
 *
 * SET IN THE LIGHT `pp` SYSTEM, like every other marketing page here, and
 * that changes three things about how the argument is drawn:
 *
 *  · **This is the page's one heavy object, and on white weight is a
 *    shadow rather than a glow.** The panel is white stock lifted off the
 *    page with the house ring-and-lift shadow; the featured rung is told
 *    apart by the card grey underneath it and a violet rail across its
 *    top, not by a tinted wash. A dark plate here would read as a hole
 *    cut in the page.
 *  · **Violet is reserved for the comparison.** The eyebrow, the "% under"
 *    badge, the ticks and our own bar carry #551a89; everything else is
 *    ink and muted. Colouring every number violet would leave the one
 *    number that is an argument looking like decoration.
 *  · **The ladder climbs itself.** The section does not perform an
 *    entrance; it performs the argument. A spotlight walks the five
 *    rungs on the house clock — Starter, Growth, Pro, Business, Scale —
 *    and as it lands on each one the rung's rail draws, its column takes
 *    the card grey, its "% under" badge goes solid violet, and what that
 *    rung adds over the one below it ticks in line by line. Watch it for
 *    one pass and you have read the only thing this price list claims:
 *    the per-minute rate falls as the plan grows, and every rung on the
 *    way sits under the flat rate everyone else charges. The two
 *    matched-rung bars draw once beside it, to scale, as the proof that
 *    the percentages are not rhetoric. Nothing pulses and nothing glows
 *    — on white that reads as dirt rather than as attention.
 *
 *    The clock is `product/timing`: each rung is held for `holdFor` of
 *    the text it just put on screen, so the walk runs at reading pace
 *    rather than at a number somebody liked. `useInView` stops it dead
 *    when the section is off screen, and the first pointer, focus or key
 *    the reader spends inside the panel hands them the spotlight for
 *    good — hovering or tabbing a column lights it, and the walk never
 *    starts again. `usePrefersReducedMotion` skips straight to the
 *    recommended rung, fully drawn, with no timer running at all.
 *
 * Lengths are rem/px here. The cover's fluid `em` base does not exist on
 * this stock, and an `em` ladder inside a section that also sets type
 * sizes compounds into sizes nobody chose.
 */

/** Two months off the plan fee, per `PRICING_INTRO.annualNote`. */
const ANNUAL = 10 / 12;

const feeFor = (t: Tier, annual: boolean) =>
  annual ? t.monthly * ANNUAL : t.monthly;

/**
 * What a minute inside the plan actually costs: the fee over the
 * allowance. Shown in cents because the ladder is only legible there —
 * "6.5¢ · 6.0¢ · 5.5¢" is a slope, "$0.0653" is a rounding artefact.
 *
 * It follows the billing toggle, because a card reading "$41/mo" beside
 * "6.5¢ a minute" is asking the reader to catch us at arithmetic they can
 * do in their head.
 */
const effectiveRate = (t: Tier, annual: boolean) =>
  feeFor(t, annual) / t.minutes;

const cents = (usd: number) => `${(usd * 100).toFixed(1)}¢`;

const num = (n: number) => n.toLocaleString("en-US");

const money = (n: number) =>
  `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

/**
 * How far under the rival's flat rate this rung sits, in whole percent.
 *
 * On yearly, the same two-months-free discount is applied to both sides
 * rather than to ours alone — which leaves the gap exactly where it was.
 * That the badge does not move when the toggle does is the point: the
 * discount is a discount, not an argument, and a comparison that improved
 * because we changed our own billing period would be a trick.
 */
const underRival = (t: Tier, annual: boolean) =>
  Math.round(
    (1 -
      effectiveRate(t, annual) /
        (PRICING_RIVAL.perMinute * (annual ? ANNUAL : 1))) *
      100,
  );

/**
 * One line of what a rung adds. When the spotlight lands on the column
 * these tick in one after another, which is the rung listing itself
 * rather than sitting there already listed.
 */
function Unlock({
  children,
  lit,
  step,
  still,
}: {
  children: React.ReactNode;
  lit: boolean;
  step: number;
  still: boolean;
}) {
  return (
    <li
      className={cn(
        "flex items-start gap-2.5 text-[13px] leading-5 text-pp-muted",
        lit &&
          !still &&
          "animate-in fade-in-0 slide-in-from-bottom-1 duration-500 fill-mode-both",
      )}
      style={still ? undefined : { animationDelay: `${step * 90}ms` }}
    >
      <Check
        className={cn(
          "mt-[3px] size-3.5 shrink-0 transition-colors duration-300",
          lit ? "text-pp-accent" : "text-pp-accent/45",
        )}
        strokeWidth={2}
      />
      <span
        className={cn(
          "text-pretty transition-colors duration-300",
          lit && "text-pp-ink",
        )}
      >
        {children}
      </span>
    </li>
  );
}

/**
 * One rung, one column.
 *
 * The featured rung keeps the card grey it always had; the spotlight is
 * a second, louder state on top of it — a violet rail drawn across the
 * top of the column rather than a badge floating over it, since what is
 * being pointed at is the whole plan and not its price.
 */
function PlanColumn({
  tier,
  annual,
  first,
  lit,
  still,
  onTake,
}: {
  tier: Tier;
  annual: boolean;
  first: boolean;
  lit: boolean;
  still: boolean;
  onTake: () => void;
}) {
  const featured = !!tier.featured;
  const fee = feeFor(tier, annual);

  return (
    <div
      onPointerEnter={onTake}
      onFocusCapture={onTake}
      className={cn(
        "relative flex flex-col px-5 py-7 transition-colors duration-500",
        !first && "border-l border-pp-rule",
        lit ? "bg-pp-card" : featured ? "bg-pp-card/55" : "bg-transparent",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-0 top-0 h-[3px] origin-left bg-pp-accent transition-transform duration-500",
          lit ? "scale-x-100" : "scale-x-0",
          still && "transition-none",
        )}
      />

      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "text-[11px] leading-4 font-medium tracking-[0.14em] uppercase transition-colors duration-300",
            lit ? "text-pp-ink" : "text-pp-muted",
          )}
        >
          {tier.name}
        </span>
        {featured ? (
          <span className="text-[11px] leading-4 font-medium tracking-[0.1em] text-pp-accent uppercase">
            Most picked
          </span>
        ) : null}
      </div>

      <div className="mt-5 flex items-baseline gap-1.5">
        <span
          className="pp-display text-[34px] leading-none tracking-[-0.03em] tabular-nums"
          // Inline: `.pp-display` sets 360 outside Tailwind's layers, which
          // would beat a weight utility. A price wants a little more body.
          style={{ fontWeight: 460 }}
        >
          {money(fee)}
        </span>
        <span className="text-[13px] leading-none text-pp-muted">/mo</span>
      </div>
      {/* The annual line is a placeholder when monthly, so the five prices
          stay on one baseline as the toggle flips. */}
      <span
        className={cn(
          "mt-2.5 block text-[12px] leading-4 tabular-nums",
          annual ? "text-pp-muted" : "text-transparent select-none",
        )}
      >
        {annual ? `${money(tier.monthly * 12 * ANNUAL)} billed yearly` : "—"}
      </span>

      <div className="mt-5 border-t border-pp-rule pt-5">
        <div className="text-[22px] leading-none font-medium tracking-[-0.02em] tabular-nums">
          {num(tier.minutes)}
        </div>
        <div className="mt-2 text-[13px] leading-5 text-pp-muted">
          minutes a month
        </div>
      </div>

      <div className="mt-5 flex flex-col items-start gap-2">
        {/* The rate is the falling number, so it is the one the spotlight
            promotes: muted while the walk is elsewhere, ink when it lands. */}
        <div
          className={cn(
            "text-[14px] leading-5 font-medium tabular-nums transition-colors duration-300",
            lit ? "text-pp-ink" : "text-pp-ink/70",
          )}
        >
          {cents(effectiveRate(tier, annual))} a minute
        </div>
        <div
          className={cn(
            "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] leading-4 font-medium tabular-nums transition-colors duration-300",
            lit ? "bg-pp-accent text-white" : "bg-pp-accent/10 text-pp-accent",
          )}
        >
          {underRival(tier, annual)}% under {PRICING_RIVAL.name}
        </div>
        <div className="text-[11px] leading-4 tracking-[0.06em] tabular-nums text-pp-muted uppercase">
          then {cents(tier.overage)} a min
        </div>
      </div>

      <PillLink
        href={tier.href}
        size="sm"
        variant={featured ? "primary" : "secondary"}
        className="mt-6 w-full"
      >
        {tier.cta}
      </PillLink>

      {/* `unlocks` is what this rung adds to the one below it, so the
          carried-forward line belongs on every rung except the first —
          there is nothing below Starter to carry. */}
      <ul className="mt-6 flex flex-col gap-2.5">
        {!first ? (
          <Unlock key={`carry-${lit}`} lit={lit} step={0} still={still}>
            Everything below, plus
          </Unlock>
        ) : null}
        {tier.unlocks.map((u, i) => (
          <Unlock
            key={`${u}-${lit}`}
            lit={lit}
            step={first ? i : i + 1}
            still={still}
          >
            {u}
          </Unlock>
        ))}
      </ul>
    </div>
  );
}

/**
 * The two rungs where the comparison needs no arithmetic at all.
 *
 * Their Pro is $99 and their Business is $990, which are also two of our
 * prices. Same money, two minute counts, drawn to scale — the only claim
 * on the page that a reader can check without trusting a percentage.
 *
 * The bars are drawn rather than stated: theirs runs out first, ours keeps
 * going past it, and the gap left over is the claim. Two bars settling at
 * different lengths is the whole argument, performed once — it draws when
 * the section comes on screen and then stays drawn, because a comparison
 * that kept re-running would be a screensaver.
 */
function MatchedRung({
  monthly,
  theirs,
  theirPlan,
  reduce,
  shown,
  card,
}: {
  monthly: number;
  theirs: number;
  theirPlan: string;
  reduce: boolean;
  shown: boolean;
  card: number;
}) {
  const ours = TIERS.find((t) => t.monthly === monthly);
  if (!ours) return null;

  const max = Math.max(ours.minutes, theirs);
  const gain = Math.round((ours.minutes / theirs - 1) * 100);

  return (
    <div className="h-full rounded-[24px] bg-pp-card p-6">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[17px] leading-6 font-medium tabular-nums">
          {money(monthly)} a month
        </span>
        {/* The gain arrives after the bars have settled — it is the
            reading of the picture, so it should not precede it. */}
        <span
          className={cn(
            "text-[11px] leading-4 font-medium tracking-[0.1em] tabular-nums text-pp-accent uppercase transition-opacity duration-500",
            shown ? "opacity-100" : "opacity-0",
            reduce && "transition-none",
          )}
          style={
            reduce ? undefined : { transitionDelay: `${700 + card * 140}ms` }
          }
        >
          +{gain}% minutes
        </span>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {[
          {
            label: `${PRICING_RIVAL.name} ${theirPlan}`,
            minutes: theirs,
            ours: false,
          },
          { label: `Our ${ours.name}`, minutes: ours.minutes, ours: true },
        ].map((row, i) => (
          <div key={row.label}>
            <div className="flex items-baseline justify-between gap-3">
              <span
                className={cn(
                  "text-[14px] leading-5",
                  row.ours ? "text-pp-ink" : "text-pp-muted",
                )}
              >
                {row.label}
              </span>
              <span
                className={cn(
                  "text-[14px] leading-5 font-medium tabular-nums",
                  row.ours ? "text-pp-accent" : "text-pp-muted",
                )}
              >
                {num(row.minutes)}
              </span>
            </div>
            {/* Scaled against the larger of the two, so the gap is the
                thing the eye measures rather than the bar length. The
                track is white on the card grey: on this stock a darker
                track would read as a third bar. */}
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-700 ease-out",
                  row.ours ? "bg-pp-accent" : "bg-pp-muted/45",
                  reduce && "transition-none",
                )}
                style={{
                  width: shown ? `${(row.minutes / max) * 100}%` : "0%",
                  transitionDelay: reduce
                    ? undefined
                    : `${100 + card * 140 + i * 160}ms`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PricingPlans() {
  const reduce = usePrefersReducedMotion();
  const [annual, setAnnual] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, "-12% 0px");

  /** `from` marks the rung that is negotiated rather than listed. */
  const listed = useMemo(() => TIERS.filter((t) => !t.from), []);
  const negotiated = TIERS.find((t) => t.from);

  /** The rung the spotlight is on, and whether the reader owns it now. */
  const featuredAt = Math.max(
    0,
    listed.findIndex((t) => t.featured),
  );
  const [at, setAt] = useState(0);
  const [taken, setTaken] = useState(false);

  /**
   * The walk. Each rung is held for as long as the text it just put on
   * screen takes to read, so the ladder climbs at the reader's pace. It
   * only runs while the section is on screen, it stops for good once the
   * reader touches anything inside it, and it never starts at all for a
   * reader who asked for less motion.
   */
  useEffect(() => {
    if (taken || reduce || !inView) return;
    const tier = listed[at];
    const spoken = [
      tier.name,
      `${cents(effectiveRate(tier, annual))} a minute`,
      `${underRival(tier, annual)}% under ${PRICING_RIVAL.name}`,
      ...tier.unlocks,
    ].join(" ");
    const id = window.setTimeout(
      () => setAt((i) => (i + 1) % listed.length),
      holdFor(spoken),
    );
    return () => window.clearTimeout(id);
  }, [at, taken, reduce, inView, annual, listed]);

  /** Reduced motion gets the end of the argument, drawn, straight away. */
  useEffect(() => {
    if (reduce) setAt(featuredAt);
  }, [reduce, featuredAt]);

  const take = () => setTaken(true);
  /** The scene's drawn state: on screen, or asked for immediately. */
  const shown = inView || reduce;

  return (
    <Frame
      as="section"
      id="pricing"
      className="scroll-mt-24 px-6 py-20 md:px-12 md:py-28"
    >
      <div
        ref={rootRef}
        onPointerDown={take}
        onKeyDownCapture={take}
        onFocusCapture={take}
      >
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div
            className={cn(
              "max-w-[640px]",
              reduce
                ? undefined
                : shown
                  ? "animate-in fade-in-0 slide-in-from-bottom-2 duration-500 fill-mode-both"
                  : "opacity-0",
            )}
          >
            <SectionHeading eyebrow={PRICING_PLANS_INTRO.eyebrow}>
              {PRICING_PLANS_INTRO.title}
            </SectionHeading>
            <p className="mt-5 text-[17px] leading-7 text-pretty text-pp-muted">
              {PRICING_PLANS_INTRO.sub}
            </p>
          </div>

          <div
            className={cn(
              "shrink-0",
              reduce
                ? undefined
                : shown
                  ? "animate-in fade-in-0 slide-in-from-bottom-2 duration-500 fill-mode-both"
                  : "opacity-0",
            )}
            style={reduce ? undefined : { animationDelay: "60ms" }}
          >
            <div className="flex flex-wrap items-center gap-3">
              <div
                role="group"
                aria-label="Billing period"
                className="flex w-fit gap-1 rounded-full bg-pp-card p-1"
              >
                {[
                  { label: "Monthly", value: false },
                  { label: "Yearly", value: true },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setAnnual(opt.value)}
                    aria-pressed={annual === opt.value}
                    className={cn(
                      "h-9 shrink-0 rounded-full px-4 text-sm transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink",
                      annual === opt.value
                        ? "pp-shadow-btn bg-white text-pp-ink"
                        : "text-pp-muted hover:text-pp-ink",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <span className="text-[13px] leading-5 text-pp-accent">
                {PRICING_INTRO.annualNote}
              </span>
            </div>
          </div>
        </div>

        <div
          className={cn(
            "mt-12 overflow-hidden rounded-[28px] bg-white shadow-[0_0_0_1px_rgb(24_16_40/0.07),0_32px_64px_-40px_rgb(24_16_40/0.5)] md:mt-16",
            reduce
              ? undefined
              : shown
                ? "animate-in fade-in-0 slide-in-from-bottom-4 duration-500 fill-mode-both"
                : "opacity-0",
          )}
          style={reduce ? undefined : { animationDelay: "80ms" }}
        >
          {/* Five columns do not survive a phone. The scroller keeps the
              comparison intact rather than restacking it into five
              unrelated cards, which is the one shape that makes a price
              list impossible to read across. */}
          <div className="overflow-x-auto [scrollbar-width:thin]">
            <div className="grid min-w-[960px] grid-cols-5 items-stretch">
              {listed.map((tier, i) => (
                <PlanColumn
                  key={tier.id}
                  tier={tier}
                  annual={annual}
                  first={i === 0}
                  lit={i === at}
                  still={reduce}
                  onTake={() => {
                    setTaken(true);
                    setAt(i);
                  }}
                />
              ))}
            </div>
          </div>

          {negotiated ? (
            <div className="flex flex-col gap-5 border-t border-pp-rule bg-pp-band px-6 py-6 md:flex-row md:items-center md:justify-between md:px-8">
              <div className="max-w-[720px]">
                <div className="text-[17px] leading-6 font-medium">
                  {negotiated.name}
                </div>
                <p className="mt-2 text-[14px] leading-[22px] text-pretty text-pp-muted">
                  From {money(negotiated.monthly)} a month for{" "}
                  {num(negotiated.minutes)} minutes, then{" "}
                  {cents(negotiated.overage)} a minute.{" "}
                  {negotiated.unlocks.join(". ")}.
                </p>
              </div>
              <PillLink
                href={negotiated.href}
                variant="secondary"
                className="max-md:w-full"
              >
                {negotiated.cta}
              </PillLink>
            </div>
          ) : null}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {PRICING_RIVAL.matched.map((m, i) => (
            <MatchedRung
              key={m.monthly}
              monthly={m.monthly}
              theirs={m.theirs}
              theirPlan={m.theirPlan}
              reduce={reduce}
              shown={shown}
              card={i}
            />
          ))}
        </div>

        <p
          className={cn(
            "mt-10 max-w-[860px] text-[12px] leading-[20px] text-pp-muted",
            reduce
              ? undefined
              : shown
                ? "animate-in fade-in-0 duration-500 fill-mode-both"
                : "opacity-0",
          )}
          style={reduce ? undefined : { animationDelay: "120ms" }}
        >
          {PRICING_PLANS_NOTE}
        </p>
      </div>
    </Frame>
  );
}
