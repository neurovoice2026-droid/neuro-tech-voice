"use client";

import { useState } from "react";
import Link from "next/link";
import { useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Layers } from "lucide-react";
import {
  PRICING_INTRO,
  PRICING_PLANS_INTRO,
  PRICING_PLANS_NOTE,
  PRICING_RIVAL,
  TIERS,
  type Tier,
} from "@/lib/site";
import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";

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

function Unlock({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-[0.6em]">
      <span className="mt-[0.15em] grid size-[1.2em] shrink-0 place-items-center rounded-full bg-[var(--cover-brand-lit)]/14 text-[var(--cover-brand-lit)]">
        <Check className="size-[0.7em]" strokeWidth={3} />
      </span>
      <span className="text-[0.82em] leading-[1.45] text-[var(--cover-paper)]/70">
        {children}
      </span>
    </li>
  );
}

/**
 * One rung, one column.
 *
 * The featured rung draws a vertical rail across the whole column rather
 * than a badge on top of it — the same device `comparison.tsx` uses for
 * the "ours" column, so the two sections agree about what emphasis looks
 * like.
 */
function PlanColumn({
  tier,
  annual,
  first,
}: {
  tier: Tier;
  annual: boolean;
  first: boolean;
}) {
  const featured = !!tier.featured;
  const fee = feeFor(tier, annual);

  return (
    <div
      className={cn(
        "flex flex-col p-[1.3em]",
        !first && "border-l border-[var(--cover-paper)]/10",
        featured &&
          "border-x border-[var(--cover-brand-lit)]/25 bg-[var(--cover-brand-lit)]/[0.07]",
      )}
    >
      <div className="flex items-center justify-between gap-[0.5em]">
        <span className="mono text-[0.6em] uppercase tracking-[0.22em] text-[var(--cover-paper)]/45">
          {tier.name}
        </span>
        {featured ? (
          <span className="mono text-[0.5em] uppercase leading-none tracking-[0.14em] text-[var(--cover-brand-lit)]">
            Most picked
          </span>
        ) : null}
      </div>

      <div className="mt-[0.9em] flex items-baseline gap-[0.25em]">
        <span className="text-[2.2em] font-medium leading-none tracking-[-0.045em] tabular-nums">
          {money(fee)}
        </span>
        <span className="text-[0.8em] leading-none text-[var(--cover-paper)]/45">
          /mo
        </span>
      </div>
      {/* The annual line is a placeholder when monthly, so the five prices
          stay on one baseline as the toggle flips. */}
      <span
        className={cn(
          "mt-[0.5em] block text-[0.7em] leading-none",
          annual
            ? "text-[var(--cover-paper)]/45"
            : "text-transparent select-none",
        )}
      >
        {annual ? `${money(tier.monthly * 12 * ANNUAL)} billed yearly` : "—"}
      </span>

      <div className="mt-[1.2em] border-t border-[var(--cover-paper)]/10 pt-[1.2em]">
        <div className="text-[1.5em] font-medium leading-none tracking-[-0.03em] tabular-nums text-[var(--cover-brand-lit)]">
          {num(tier.minutes)}
        </div>
        <div className="mt-[0.5em] text-[0.78em] leading-[1.4] text-[var(--cover-paper)]/55">
          minutes a month
        </div>
      </div>

      <div className="mt-[1em] space-y-[0.45em]">
        <div className="mono text-[0.62em] uppercase tracking-[0.1em] tabular-nums text-[var(--cover-paper)]/70">
          {cents(effectiveRate(tier, annual))} a minute
        </div>
        <div className="inline-flex items-center rounded-full bg-[var(--cover-brand-lit)]/12 px-[0.7em] py-[0.3em] text-[0.6em] font-medium leading-none tabular-nums text-[var(--cover-brand-lit)]">
          {underRival(tier, annual)}% under {PRICING_RIVAL.name}
        </div>
        <div className="mono text-[0.58em] uppercase tracking-[0.1em] tabular-nums text-[var(--cover-paper)]/32">
          then {cents(tier.overage)} a min
        </div>
      </div>

      <Link
        href={tier.href}
        className={cn(
          "group mt-[1.3em] inline-flex w-full items-center justify-center gap-[0.4em] rounded-full px-[1em] py-[0.65em] text-[0.76em] font-medium leading-none transition-colors duration-300",
          featured
            ? "bg-[var(--cover-brand-lit)] text-[var(--cover-ink)] hover:opacity-85"
            : "border border-[var(--cover-paper)]/20 text-[var(--cover-paper)]/75 hover:border-[var(--cover-paper)]/45 hover:text-[var(--cover-paper)]",
        )}
      >
        {tier.cta}
        <ArrowRight
          className="size-[1em] transition-transform duration-300 group-hover:translate-x-[0.15em]"
          strokeWidth={2.2}
        />
      </Link>

      {/* `unlocks` is what this rung adds to the one below it, so the
          carried-forward line belongs on every rung except the first —
          there is nothing below Starter to carry. */}
      <ul className="mt-[1.2em] flex flex-col gap-[0.55em]">
        {!first ? <Unlock>Everything below, plus</Unlock> : null}
        {tier.unlocks.map((u) => (
          <Unlock key={u}>{u}</Unlock>
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
 */
function MatchedRung({
  monthly,
  theirs,
  theirPlan,
}: {
  monthly: number;
  theirs: number;
  theirPlan: string;
}) {
  const ours = TIERS.find((t) => t.monthly === monthly);
  if (!ours) return null;

  const max = Math.max(ours.minutes, theirs);
  const gain = Math.round((ours.minutes / theirs - 1) * 100);

  return (
    <div className="rounded-[0.7em] border border-[var(--cover-paper)]/10 p-[1.2em]">
      <div className="flex items-baseline justify-between gap-[0.6em]">
        <span className="text-[1.05em] font-medium leading-none tabular-nums">
          {money(monthly)} a month
        </span>
        <span className="mono text-[0.58em] uppercase tracking-[0.14em] tabular-nums text-[var(--cover-brand-lit)]">
          +{gain}% minutes
        </span>
      </div>

      <div className="mt-[1.1em] flex flex-col gap-[0.7em]">
        {[
          {
            label: `${PRICING_RIVAL.name} ${theirPlan}`,
            minutes: theirs,
            ours: false,
          },
          { label: `Our ${ours.name}`, minutes: ours.minutes, ours: true },
        ].map((row) => (
          <div key={row.label}>
            <div className="flex items-baseline justify-between gap-[0.6em]">
              <span
                className={cn(
                  "text-[0.72em] leading-none",
                  row.ours
                    ? "text-[var(--cover-paper)]/80"
                    : "text-[var(--cover-paper)]/45",
                )}
              >
                {row.label}
              </span>
              <span
                className={cn(
                  "mono text-[0.68em] leading-none tabular-nums",
                  row.ours
                    ? "text-[var(--cover-brand-lit)]"
                    : "text-[var(--cover-paper)]/45",
                )}
              >
                {num(row.minutes)}
              </span>
            </div>
            {/* Scaled against the larger of the two, so the gap is the
                thing the eye measures rather than the bar length. */}
            <div className="mt-[0.4em] h-[0.4em] overflow-hidden rounded-full bg-[var(--cover-paper)]/[0.07]">
              <div
                className={cn(
                  "h-full rounded-full",
                  row.ours
                    ? "bg-[var(--cover-brand-lit)]"
                    : "bg-[var(--cover-paper)]/25",
                )}
                style={{ width: `${(row.minutes / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PricingPlans() {
  const reduce = useReducedMotion();
  const [annual, setAnnual] = useState(false);

  /** `from` marks the rung that is negotiated rather than listed. */
  const listed = TIERS.filter((t) => !t.from);
  const negotiated = TIERS.find((t) => t.from);

  return (
    <section
      id="pricing"
      className="relative scroll-mt-24 px-[1.6em] py-[6em] md:py-[8em]"
    >
      <div className="relative mx-auto max-w-[76em]">
        <div className="mx-auto flex max-w-[42em] flex-col items-center text-center">
          <Reveal>
            <span className="inline-flex items-center gap-[0.55em] rounded-full border border-[var(--cover-brand-lit)]/25 bg-[var(--cover-brand-lit)]/10 px-[1.15em] py-[0.5em] text-[0.72em] font-semibold uppercase leading-none tracking-[0.18em] text-[var(--cover-brand-lit)]">
              <Layers className="size-[1.25em] shrink-0" strokeWidth={2} />
              {PRICING_PLANS_INTRO.eyebrow}
            </span>
          </Reveal>

          <Reveal delay={0.06}>
            <h2 className="mt-[0.8em] text-balance text-[2.8em] font-medium leading-[1.03] tracking-[-0.045em] md:text-[3.4em]">
              {PRICING_PLANS_INTRO.title}
            </h2>
          </Reveal>

          <Reveal delay={0.12}>
            <p className="mt-[0.9em] text-pretty text-[1.05em] leading-[1.6] text-[var(--cover-paper)]/60">
              {PRICING_PLANS_INTRO.sub}
            </p>
          </Reveal>

          <Reveal delay={0.16}>
            <div
              role="group"
              aria-label="Billing period"
              className="mt-[1.8em] inline-flex items-center gap-[0.3em] rounded-full border border-[var(--cover-paper)]/12 p-[0.3em]"
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
                    "rounded-full px-[1.1em] py-[0.5em] text-[0.75em] font-medium leading-none transition-colors duration-200",
                    annual === opt.value
                      ? "bg-[var(--cover-brand-lit)] text-[var(--cover-ink)]"
                      : "text-[var(--cover-paper)]/55 hover:text-[var(--cover-paper)]/85",
                  )}
                >
                  {opt.label}
                </button>
              ))}
              <span className="px-[0.7em] text-[0.62em] leading-none text-[var(--cover-brand-lit)]">
                {PRICING_INTRO.annualNote}
              </span>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.08} y={32}>
          <div className="mt-[3.5em] overflow-hidden rounded-[1.2em] border border-[var(--cover-paper)]/12 bg-[var(--cover-panel)] shadow-[0_2em_5em_-1.8em_rgba(0,0,0,0.9)] md:mt-[4.5em]">
            {/* Five columns do not survive a phone. The scroller keeps the
                comparison intact rather than restacking it into five
                unrelated cards, which is the one shape that makes a price
                list impossible to read across. */}
            <div className="overflow-x-auto [scrollbar-width:thin]">
              <div className="grid min-w-[58em] grid-cols-5 items-stretch">
                {listed.map((tier, i) => (
                  <PlanColumn
                    key={tier.id}
                    tier={tier}
                    annual={annual}
                    first={i === 0}
                  />
                ))}
              </div>
            </div>

            {negotiated ? (
              <div className="flex flex-col gap-[1em] border-t border-[var(--cover-paper)]/10 bg-[var(--cover-paper)]/[0.025] px-[1.6em] py-[1.4em] md:flex-row md:items-center md:justify-between md:px-[2em]">
                <div>
                  <div className="text-[1.05em] font-medium leading-none">
                    {negotiated.name}
                  </div>
                  <p className="mt-[0.6em] text-[0.85em] leading-[1.5] text-[var(--cover-paper)]/55">
                    From {money(negotiated.monthly)} a month for{" "}
                    {num(negotiated.minutes)} minutes, then{" "}
                    {cents(negotiated.overage)} a minute.{" "}
                    {negotiated.unlocks.join(". ")}.
                  </p>
                </div>
                <Link
                  href={negotiated.href}
                  className="group inline-flex shrink-0 items-center justify-center gap-[0.5em] rounded-full border border-[var(--cover-paper)]/20 px-[1.6em] py-[0.8em] text-[0.85em] leading-none text-[var(--cover-paper)]/80 transition-colors duration-300 hover:border-[var(--cover-paper)]/45 hover:text-[var(--cover-paper)]"
                >
                  {negotiated.cta}
                  <ArrowRight
                    className="size-[1em] transition-transform duration-300 group-hover:translate-x-[0.15em]"
                    strokeWidth={2.2}
                  />
                </Link>
              </div>
            ) : null}
          </div>
        </Reveal>

        <div className="mt-[2.5em] grid gap-[1em] md:grid-cols-2">
          {PRICING_RIVAL.matched.map((m, i) => (
            <Reveal key={m.monthly} delay={reduce ? 0 : i * 0.06}>
              <MatchedRung
                monthly={m.monthly}
                theirs={m.theirs}
                theirPlan={m.theirPlan}
              />
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.06}>
          <p className="mx-auto mt-[2em] max-w-[52em] text-center text-[0.7em] leading-[1.65] text-[var(--cover-paper)]/32">
            {PRICING_PLANS_NOTE}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
