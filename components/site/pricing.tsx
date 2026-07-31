"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Gift, Receipt } from "lucide-react";
import {
  AVG_CALL_MIN,
  DAYS_PER_MONTH,
  PRICING_INTRO,
  PRICING_MAX_CALLS_DAY,
  PRICING_NOTE,
  PRICING_PRESETS,
  PRICING_TRIAL,
  TIERS,
  type Tier,
} from "@/lib/site";
import { cn } from "@/lib/utils";
import { Reveal, EASE } from "./reveal";

/**
 * Pricing — the bill, worked out in front of the customer.
 *
 * The version this replaces asked for minutes a month and drew four cost
 * curves against them. It was precise and it was honest and a customer
 * could do nothing with it. A dentist does not know how many minutes their
 * phone does in a month; four overlapping lines on a chart is a tool for
 * the person who set the prices, not for the person about to pay them.
 *
 * Everyone knows roughly how many calls they get in a day. So that is the
 * only question the section asks, and everything downstream of it — calls
 * a month, minutes, which plan, what the invoice says — is arithmetic done
 * out loud, on a receipt, one line at a time.
 *
 * Three decisions worth keeping:
 *
 *  · **The headline number is per day.** A monthly total is a number you
 *    have to go and compare against something. "Eleven dollars a day" is a
 *    number a business owner has already priced against their own morning,
 *    before they have finished reading it.
 *  · **The receipt shows the overage line.** Hiding it would make every
 *    plan look like its sticker price and make the first invoice a
 *    betrayal. Shown, it is the single most trust-building object on the
 *    page — it is the arithmetic a customer would otherwise have to do in
 *    the dark, and it is the arithmetic we would supposedly rather they
 *    did not do.
 *  · **It names the cheapest plan, whichever one that is.** They were
 *    going to work it out anyway. The only question was whether they did
 *    it with us, or on a notepad afterwards, feeling handled.
 */

/** Two months off the plan fee, per `PRICING_INTRO.annualNote`. */
const ANNUAL = 10 / 12;

const feeFor = (t: Tier, annual: boolean) =>
  annual ? t.monthly * ANNUAL : t.monthly;

/** The invoice: the fee, plus this plan's own rate past its allowance. */
const costFor = (t: Tier, minutes: number, annual: boolean) =>
  feeFor(t, annual) + Math.max(0, minutes - t.minutes) * t.overage;

/**
 * Always two decimals, even on the round numbers.
 *
 * Dropping the cents above a hundred looked tidier and broke the one thing
 * a receipt has to do: `$49.00` above `$263` above `$312` is three
 * different precisions in one column, and the reader cannot check that it
 * adds up — which is the entire reason the overage line is shown at all.
 */
const money = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const num = (n: number) => Math.round(n).toLocaleString("en-US");

function Line({
  label,
  value,
  strong,
  dim,
}: {
  label: React.ReactNode;
  value: string;
  strong?: boolean;
  dim?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-[1.2em] py-[0.55em]",
        strong && "border-t border-[var(--cover-paper)]/15 pt-[0.9em]",
      )}
    >
      <span
        className={cn(
          "min-w-0 text-[0.88em] leading-snug",
          strong
            ? "text-[var(--cover-paper)]"
            : dim
              ? "text-[var(--cover-paper)]/40"
              : "text-[var(--cover-paper)]/60",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "mono shrink-0 tabular-nums",
          strong
            ? "text-[1.5em] leading-none text-[var(--cover-brand-lit)]"
            : "text-[0.88em] text-[var(--cover-paper)]/80",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function Pricing() {
  const reduce = useReducedMotion();
  const [callsDay, setCallsDay] = useState(10);
  const [annual, setAnnual] = useState(false);

  const callsMonth = callsDay * DAYS_PER_MONTH;
  const minutes = callsMonth * AVG_CALL_MIN;

  const priced = TIERS.map((t) => ({
    tier: t,
    total: costFor(t, minutes, annual),
    over: Math.max(0, minutes - t.minutes),
  }));

  /**
   * The plan is the smallest one whose allowance actually covers the
   * volume — not whichever is numerically cheapest.
   *
   * Optimising pure dollars produced advice no business would take:
   * "stay on the 150-minute plan and buy 1,050 minutes of overage, every
   * month, forever." An allowance is the thing being sold; a plan you
   * blow through eightfold is not a plan, it is a warning light. `TIERS`
   * is in ascending order of minutes, so the first one that fits is the
   * right one, and past the top rung there is only the top rung.
   */
  const mine =
    priced.find((p) => p.tier.minutes >= minutes) ?? priced[priced.length - 1];

  /**
   * Kept anyway, and shown when it differs.
   *
   * If a smaller plan plus its overage really would cost less, saying so
   * is the whole reason anybody trusts a page like this — and it is also a
   * live check on the price list. A coherent one never has this gap: it
   * only opens when a rung's overage rate undercuts its own effective
   * per-minute rate, and it closes by itself the moment that is fixed.
   */
  const cheapest = priced.reduce((a, b) => (b.total < a.total ? b : a));
  const cheaperExists = cheapest.tier.id !== mine.tier.id;

  const perDay = mine.total / DAYS_PER_MONTH;
  const perCall = mine.total / Math.max(1, callsMonth);
  const pct = (callsDay / PRICING_MAX_CALLS_DAY) * 100;

  return (
    <section
      id="pricing"
      className="relative scroll-mt-24 px-[1.6em] py-[6em] md:py-[8em]"
    >
      <div className="relative mx-auto max-w-[76em]">
        {/* header */}
        <div className="mx-auto flex max-w-[42em] flex-col items-center text-center">
          <Reveal>
            <span className="inline-flex items-center gap-[0.55em] rounded-full border border-[var(--cover-brand-lit)]/25 bg-[var(--cover-brand-lit)]/10 px-[1.15em] py-[0.5em] text-[0.72em] font-semibold uppercase leading-none tracking-[0.18em] text-[var(--cover-brand-lit)]">
              <Receipt className="size-[1.25em] shrink-0" strokeWidth={2} />
              {PRICING_INTRO.eyebrow}
            </span>
          </Reveal>

          <Reveal delay={0.06} className="mt-[1em]">
            <h2 className="text-balance text-[2.8em] font-medium leading-[1.03] tracking-[-0.045em] md:text-[3.4em]">
              {PRICING_INTRO.title}
            </h2>
          </Reveal>

          <Reveal
            delay={0.12}
            className="mt-[1.1em] max-w-[36em] text-pretty text-[1.05em] leading-[1.6] text-[var(--cover-paper)]/60"
          >
            {PRICING_INTRO.sub}
          </Reveal>
        </div>

        <Reveal delay={0.08} y={32} className="mt-[3.5em] md:mt-[4.5em]">
          <div className="overflow-hidden rounded-[1.2em] border border-[var(--cover-paper)]/12 bg-[var(--cover-panel)] shadow-[0_2em_5em_-1.8em_rgba(0,0,0,0.9)]">
            {/* The one question. Everything else on this page follows from
                the answer, so it gets the whole top of the panel. */}
            <div className="border-b border-[var(--cover-paper)]/10 px-[1.6em] py-[1.8em] md:px-[2em]">
              <div className="flex flex-wrap items-end justify-between gap-[1em]">
                <label
                  htmlFor="calls-a-day"
                  className="text-[1.1em] leading-tight text-[var(--cover-paper)]/70"
                >
                  How many calls do you get on a normal day?
                </label>

                <div className="flex items-baseline gap-[0.5em]">
                  <span className="mono text-[2.6em] leading-none tabular-nums text-[var(--cover-brand-lit)]">
                    {callsDay}
                  </span>
                  <span className="text-[0.9em] text-[var(--cover-paper)]/45">
                    {callsDay === 1 ? "call" : "calls"} a day
                  </span>
                </div>
              </div>

              {/* A native range, deliberately. A custom drag surface reads
                  as a chart to be interpreted; this reads as a control to
                  be moved, and it arrives with keyboard and touch support
                  already correct. */}
              <input
                id="calls-a-day"
                type="range"
                min={1}
                max={PRICING_MAX_CALLS_DAY}
                step={1}
                value={callsDay}
                onChange={(e) => setCallsDay(Number(e.target.value))}
                style={{
                  background: `linear-gradient(to right, var(--cover-brand-lit) ${pct}%, rgba(222,220,224,0.12) ${pct}%)`,
                }}
                className={cn(
                  "mt-[1.4em] h-[0.5em] w-full cursor-ew-resize appearance-none rounded-full outline-none",
                  "focus-visible:ring-2 focus-visible:ring-[var(--cover-brand-lit)]/50 focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--cover-panel)]",
                  "[&::-webkit-slider-thumb]:size-[1.5em] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[0.25em] [&::-webkit-slider-thumb]:border-[var(--cover-panel)] [&::-webkit-slider-thumb]:bg-[var(--cover-brand-lit)] [&::-webkit-slider-thumb]:shadow-[0_0_0_1px_rgba(192,172,224,0.5)]",
                  "[&::-moz-range-thumb]:size-[1.5em] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[0.25em] [&::-moz-range-thumb]:border-[var(--cover-panel)] [&::-moz-range-thumb]:bg-[var(--cover-brand-lit)]",
                )}
              />

              <div className="mt-[1.2em] flex flex-wrap gap-[0.4em]">
                {PRICING_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setCallsDay(p.callsDay)}
                    aria-pressed={callsDay === p.callsDay}
                    className={cn(
                      "rounded-full border px-[0.9em] py-[0.45em] text-[0.72em] leading-none transition-colors duration-200",
                      callsDay === p.callsDay
                        ? "border-[var(--cover-brand-lit)]/60 bg-[var(--cover-brand-lit)]/12 text-[var(--cover-brand-lit)]"
                        : "border-[var(--cover-paper)]/12 text-[var(--cover-paper)]/45 hover:border-[var(--cover-paper)]/30 hover:text-[var(--cover-paper)]/80",
                    )}
                  >
                    {p.label} · {p.callsDay} a day
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5">
              {/* the receipt */}
              <div className="border-b border-[var(--cover-paper)]/10 p-[1.6em] md:col-span-3 md:border-b-0 md:border-r md:p-[2em]">
                <div className="flex items-center justify-between gap-[1em]">
                  <p className="mono text-[0.6em] uppercase tracking-[0.22em] text-[var(--cover-paper)]/35">
                    Your monthly bill, worked out
                  </p>

                  <div className="flex rounded-full border border-[var(--cover-paper)]/12 bg-[var(--cover-paper)]/[0.05] p-[0.2em] text-[0.68em]">
                    {[
                      { on: false, label: "Monthly" },
                      { on: true, label: PRICING_INTRO.annualNote },
                    ].map((opt) => (
                      <button
                        key={opt.label}
                        type="button"
                        aria-pressed={annual === opt.on}
                        onClick={() => setAnnual(opt.on)}
                        className={cn(
                          "relative rounded-full px-[0.85em] py-[0.45em] leading-none transition-colors duration-200",
                          annual === opt.on
                            ? "text-[var(--cover-ink)]"
                            : "text-[var(--cover-paper)]/55 hover:text-[var(--cover-paper)]/85",
                        )}
                      >
                        {annual === opt.on && (
                          <motion.span
                            layoutId="ntv-billing"
                            aria-hidden
                            className="absolute inset-0 rounded-full bg-[var(--cover-brand-lit)]"
                            transition={{
                              duration: reduce ? 0 : 0.35,
                              ease: EASE,
                            }}
                          />
                        )}
                        <span className="relative">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-[1.2em]">
                  <Line
                    label="Calls on a normal day"
                    value={num(callsDay)}
                    dim
                  />
                  <Line
                    label={`Every day of the month, × ${DAYS_PER_MONTH}`}
                    value={`${num(callsMonth)} calls`}
                    dim
                  />
                  <Line
                    label={`About ${AVG_CALL_MIN} minutes a call`}
                    value={`${num(minutes)} min`}
                    dim
                  />

                  <div className="mt-[0.6em] border-t border-dashed border-[var(--cover-paper)]/15 pt-[0.4em]">
                    <Line
                      label={
                        <>
                          <span className="text-[var(--cover-paper)]">
                            {mine.tier.name}
                          </span>{" "}
                          plan — {num(mine.tier.minutes)} minutes included
                        </>
                      }
                      value={money(feeFor(mine.tier, annual))}
                    />

                    {mine.over > 0 ? (
                      <Line
                        label={`${num(mine.over)} minutes past that, at $${mine.tier.overage.toFixed(2)} each`}
                        value={money(mine.over * mine.tier.overage)}
                      />
                    ) : (
                      <Line
                        label="Nothing past the allowance"
                        value={money(0)}
                      />
                    )}
                  </div>

                  <Line
                    strong
                    label="What you pay, every month"
                    value={money(mine.total)}
                  />
                </div>

                {/* The number a business owner has already priced against
                    their own morning by the time they finish reading it. */}
                <div className="mt-[1.8em] flex flex-wrap items-end gap-x-[2.4em] gap-y-[1.2em] border-t border-[var(--cover-paper)]/10 pt-[1.6em]">
                  <div>
                    <p className="mono text-[0.58em] uppercase tracking-[0.22em] text-[var(--cover-paper)]/35">
                      That is
                    </p>
                    {/* "a day" sits on its own line. Inline at 0.35em the
                        word-space between "a" and "day" all but vanished
                        and the hero number read "$10.38aday". */}
                    <p className="mt-[0.35em] text-[2.6em] font-medium leading-none tracking-[-0.04em] text-[var(--cover-brand-lit)]">
                      {money(perDay)}
                    </p>
                    <p className="mt-[0.55em] text-[0.85em] leading-none text-[var(--cover-paper)]/45">
                      a day
                    </p>
                  </div>

                  <div>
                    <p className="mono text-[0.58em] uppercase tracking-[0.22em] text-[var(--cover-paper)]/35">
                      Per call answered
                    </p>
                    <p className="mt-[0.4em] text-[1.5em] font-medium leading-none tracking-[-0.03em]">
                      {money(perCall)}
                    </p>
                  </div>

                  <div>
                    <p className="mono text-[0.58em] uppercase tracking-[0.22em] text-[var(--cover-paper)]/35">
                      Calls answered
                    </p>
                    <p className="mt-[0.4em] text-[1.5em] font-medium leading-none tracking-[-0.03em]">
                      {num(callsMonth)}
                      <span className="text-[0.55em] font-normal text-[var(--cover-paper)]/40">
                        {" "}
                        / month
                      </span>
                    </p>
                  </div>
                </div>

                <p className="mt-[1.6em] max-w-[34em] text-[0.92em] leading-[1.6] text-[var(--cover-paper)]/55">
                  One booking you would otherwise have missed is worth{" "}
                  <span className="text-[var(--cover-paper)]/85">
                    between $35 and $200
                  </span>{" "}
                  depending on your trade — the figures in the panel further
                  up this page. At {callsDay} calls a day, the whole month
                  costs {money(mine.total)}.
                </p>

                {/* Said out loud when it is true. A pricing page that points
                    at its own cheaper option is worth more than the
                    difference, and the reader was going to find it anyway. */}
                {cheaperExists && (
                  <p className="mt-[1.2em] max-w-[34em] rounded-[0.6em] border border-[var(--cover-paper)]/12 bg-[var(--cover-paper)]/[0.03] p-[1em] text-[0.85em] leading-[1.6] text-[var(--cover-paper)]/50">
                    Worth knowing:{" "}
                    <span className="text-[var(--cover-paper)]/80">
                      staying on {cheapest.tier.name} and paying for the extra{" "}
                      {num(cheapest.over)} minutes would come to{" "}
                      {money(cheapest.total)}
                    </span>{" "}
                    — {money(mine.total - cheapest.total)} less a month. You
                    would be running past your allowance every month to do it,
                    which is why it is not what we put on the receipt. Your
                    call.
                  </p>
                )}
              </div>

              {/* every plan, at this volume */}
              <div className="p-[1.6em] md:col-span-2 md:p-[2em]">
                <p className="mono text-[0.6em] uppercase tracking-[0.22em] text-[var(--cover-paper)]/35">
                  Every plan, at {callsDay} calls a day
                </p>

                <div className="mt-[1.2em] flex flex-col gap-[0.5em]">
                  {priced.map(({ tier, total, over }) => {
                    const best = tier.id === mine.tier.id;
                    return (
                      <div
                        key={tier.id}
                        className={cn(
                          "rounded-[0.7em] border p-[1em] transition-colors duration-300",
                          best
                            ? "border-[var(--cover-brand-lit)]/50 bg-[var(--cover-brand-lit)]/[0.08]"
                            : "border-[var(--cover-paper)]/10",
                        )}
                      >
                        <div className="flex items-baseline justify-between gap-[0.8em]">
                          <span className="flex flex-wrap items-baseline gap-[0.6em]">
                            <span
                              className={cn(
                                "text-[1em] font-medium leading-none",
                                best && "text-[var(--cover-brand-lit)]",
                              )}
                            >
                              {tier.name}
                            </span>
                            {best ? (
                              <span className="mono text-[0.55em] uppercase tracking-[0.16em] text-[var(--cover-brand-lit)]/70">
                                covers your volume
                              </span>
                            ) : (
                              cheaperExists &&
                              tier.id === cheapest.tier.id && (
                                <span className="mono text-[0.55em] uppercase tracking-[0.16em] text-[var(--cover-paper)]/40">
                                  cheaper, with overage
                                </span>
                              )
                            )}
                          </span>
                          <span
                            className={cn(
                              "mono shrink-0 text-[1.1em] leading-none tabular-nums",
                              best
                                ? "text-[var(--cover-brand-lit)]"
                                : "text-[var(--cover-paper)]/65",
                            )}
                          >
                            {money(total)}
                          </span>
                        </div>

                        <p className="mono mt-[0.6em] text-[0.58em] uppercase leading-[1.5] tracking-[0.1em] text-[var(--cover-paper)]/30">
                          {tier.from ? "from " : ""}
                          {money(feeFor(tier, annual))} · {num(tier.minutes)} min
                          {over > 0
                            ? ` · ${num(over)} over at $${tier.overage.toFixed(2)}`
                            : " · nothing over"}
                        </p>

                        <p className="mt-[0.6em] text-[0.76em] leading-[1.5] text-[var(--cover-paper)]/40">
                          {tier.unlocks.join(" · ")}
                        </p>

                        <Link
                          href={tier.href}
                          className={cn(
                            "mt-[0.9em] inline-flex w-full items-center justify-center gap-[0.45em] rounded-full px-[1em] py-[0.6em] text-[0.76em] font-medium leading-none transition-opacity duration-200 hover:opacity-85",
                            best
                              ? "bg-[var(--cover-brand-lit)] text-[var(--cover-ink)]"
                              : "border border-[var(--cover-paper)]/20 text-[var(--cover-paper)]/75",
                          )}
                        >
                          {tier.cta}
                          <ArrowRight className="size-[1em]" strokeWidth={2.2} />
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* the trial */}
            <div className="flex flex-col gap-[1em] border-t border-[var(--cover-paper)]/10 bg-[var(--cover-brand-lit)]/[0.06] px-[1.6em] py-[1.4em] md:flex-row md:items-center md:justify-between md:px-[2em]">
              <div className="flex items-start gap-[0.9em]">
                <span className="mt-[0.15em] grid size-[2.1em] shrink-0 place-items-center rounded-full bg-[var(--cover-brand-lit)]/15 text-[var(--cover-brand-lit)]">
                  <Gift className="size-[1.05em]" strokeWidth={2} />
                </span>
                <div>
                  <p className="text-[1.02em] font-medium leading-tight">
                    {PRICING_TRIAL.headline}
                  </p>
                  <p className="mt-[0.5em] max-w-[38em] text-[0.85em] leading-[1.55] text-[var(--cover-paper)]/50">
                    {PRICING_TRIAL.body}
                  </p>
                </div>
              </div>

              <Link
                href={PRICING_TRIAL.href}
                className="inline-flex shrink-0 items-center justify-center gap-[0.45em] rounded-full bg-[var(--cover-brand-lit)] px-[1.3em] py-[0.7em] text-[0.8em] font-medium leading-none text-[var(--cover-ink)] transition-opacity duration-200 hover:opacity-85"
              >
                {PRICING_TRIAL.cta}
                <ArrowRight className="size-[1.1em]" strokeWidth={2.2} />
              </Link>
            </div>

            {/* provenance */}
            <p className="border-t border-[var(--cover-paper)]/10 bg-[var(--cover-paper)]/[0.025] px-[1.6em] py-[0.9em] text-[0.68em] leading-[1.6] text-[var(--cover-paper)]/40 md:px-[2em]">
              {PRICING_NOTE}
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
