"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import {
  AVG_CALL_MIN,
  DAYS_PER_MONTH,
  PRICING_INTRO,
  PRICING_MAX_CALLS_DAY,
  PRICING_NOTE,
  PRICING_PRESETS,
  PRICING_TRIAL,
  TIERS,
  costFor,
  feeFor,
} from "@/lib/site";
import { cn } from "@/lib/utils";
import { CornerDot } from "./corner-dot";
import { TornEdge } from "./cover-tear";
import { IntentLink } from "./intent-link";
import { CountUp, EASE, Reveal, RevealStagger } from "./reveal";

/**
 * The bill — the arithmetic done out loud, on a slip of paper.
 *
 * The plan list directly above this owns the only panel on the page, and it
 * answers "what do I get for my money". This section answers the question
 * that arrives a second later and is the one that actually decides anything:
 * *what will it cost me*. Those are two different acts of reading, so they
 * are two different physical objects. The plans are a rack of cards; this is
 * a single narrow slip with a torn bottom edge, set off the gutter on the
 * open field. Nothing about it is shaped like the thing above it, because a
 * second panel would have read as a continuation of the price list rather
 * than as the answer to it.
 *
 * Four decisions worth keeping, three of them inherited from the version
 * this replaces and one of them a repair:
 *
 *  · **The only question is calls a day.** The first version asked for
 *    minutes a month and drew four cost curves against them. It was precise,
 *    it was honest, and no customer could use it: a dentist does not know
 *    how many minutes their phone does in a month. Everyone knows roughly
 *    how many calls they get in a morning. So that is the one input, and
 *    calls a month, minutes, plan, allowance and invoice are all arithmetic
 *    performed in front of them, one line at a time.
 *  · **The headline figure is PER DAY.** A monthly total is a number you
 *    have to go away and compare against something. A daily one has already
 *    been priced against the reader's own morning by the time they finish
 *    reading it. It is the only large number in the section for that reason.
 *  · **The receipt SHOWS the overage line.** Hiding it would make every plan
 *    look like its sticker price and make the first invoice feel like a
 *    betrayal. Shown, it is the most trust-building object on the page: it
 *    is the arithmetic a customer would otherwise do in the dark, and it is
 *    exactly the arithmetic we would supposedly rather they did not do. The
 *    rate is printed in cents — `6.5¢` — and not as `$0.07`, so that the
 *    multiplication on the line above can actually be checked. Rounded to
 *    two dollar-decimals, 6.5¢ prints as 7¢ and the line stops adding up.
 *  · **It names the cheaper plan when a cheaper one exists.** They were
 *    going to work it out anyway. The only question was whether they did it
 *    with us, or on a notepad afterwards, feeling handled.
 *
 * The repair: the old block comment narrated "Eleven dollars a day" against
 * a default that now computes to a shade over three. A figure quoted in
 * prose goes stale the first time a rung moves, which is the whole argument
 * for computing it on screen — so no number is written down here at all.
 *
 * **The slip's own length is a reading.** The torn bottom edge grows with
 * the bill, so a quiet clinic gets a short stub and a dispatch room gets a
 * long one. It is the only ambient signal in the section, and it says the
 * same thing the total says.
 */

/**
 * The numeral and the kicker for the masthead.
 *
 * `PRICING_INTRO.eyebrow` reads "Pricing", which is what the plan list above
 * is; this section is the bill you get from it, and the FAQ and the close
 * both link here calling it exactly that. `lib/site.ts` is frozen, so the
 * name lives here instead of being forced on the shared constant.
 */
const NUMERAL = "09";
const KICKER = "Your bill";

/**
 * Always two decimals, even on the round numbers.
 *
 * Dropping the cents above a hundred looked tidier and broke the one thing
 * a receipt has to do: `$49.00` above `$263` above `$312` is three different
 * precisions in one column, and the reader cannot check that it adds up —
 * which is the entire reason the overage line is shown at all.
 */
const money = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const num = (n: number) => Math.round(n).toLocaleString("en-US");

/** The overage rate, at the precision it is actually billed at. */
const cents = (usd: number) => `${(usd * 100).toFixed(1)}¢`;

/**
 * One line of the bill, and the unit of both animations.
 *
 * On arrival it is a stagger child: the slip types itself top to bottom.
 * When the reader moves the slider it re-stamps itself — but only if its own
 * number moved. That is the whole reason the dip lives down here on the line
 * rather than up on the slip: at twenty calls a day the plan fee and the
 * allowance do not change, and a receipt where every line flinches at every
 * drag teaches the reader nothing about which of them the slider touches.
 *
 * The dip is a separate element from the stamp because one is driven by the
 * parent's variants and the other by imperative controls, and a single node
 * cannot be owned by both.
 */
function BillLine({
  label,
  value,
  unit,
  strong,
}: {
  label: ReactNode;
  value: number;
  unit: "usd" | "min";
  strong?: boolean;
}) {
  const reduce = useReducedMotion();
  const controls = useAnimationControls();
  // The number this line last showed. A ref, not state: it is compared in an
  // effect and never read during a render.
  const prev = useRef(value);

  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    if (reduce) return;
    controls.start({
      opacity: [0.32, 1],
      transition: { duration: 0.18, ease: EASE },
    });
  }, [value, reduce, controls]);

  return (
    <Stamp>
      <motion.div
        animate={controls}
        className="flex items-baseline justify-between gap-[1.4em] py-[0.5em]"
      >
        <span
          className={cn(
            "min-w-0 text-[0.86em] leading-[1.45]",
            strong
              ? "font-medium text-[var(--cover-paper)]"
              : "text-[var(--cover-paper)]/75",
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            "mono shrink-0 tabular-nums",
            strong
              ? "text-[1.15em] leading-none text-[var(--cover-brand-lit)]"
              : "text-[0.86em] text-[var(--cover-paper)]/85",
          )}
        >
          <CountUp
            to={value}
            track
            duration={0.5}
            decimals={unit === "usd" ? 2 : 0}
            prefix={unit === "usd" ? "$" : ""}
            suffix={unit === "min" ? " min" : ""}
          />
        </span>
      </motion.div>
    </Stamp>
  );
}

/**
 * One press of the stamp: down onto the paper, not up off it.
 *
 * `y` is negative and in em, so the line arrives from above and settles —
 * which is what a printed line does — and it scales with the cover's own
 * font-size rather than being a fixed pixel drop that reads differently at
 * the two ends of the clamp.
 */
function Stamp({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={{
        hidden: reduce ? {} : { opacity: 0, y: "-0.3em" },
        show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function Bill() {
  const [callsDay, setCallsDay] = useState(10);

  const callsMonth = callsDay * DAYS_PER_MONTH;
  const minutes = callsMonth * AVG_CALL_MIN;

  /**
   * Billed monthly, and there is no toggle here.
   *
   * The plan list above owns the billing period and its own switch. Two
   * switches for one decision, in two components that cannot see each
   * other's state, guarantees a screen where the card says $82.50 and the
   * receipt under it says $99 — and a reader with no way to tell which one
   * is the real price. The receipt quotes the list price and the note at the
   * foot states what annual takes off it.
   */
  const priced = TIERS.map((t) => ({
    tier: t,
    total: costFor(t, minutes, false),
    over: Math.max(0, minutes - t.minutes),
  }));

  /**
   * The plan is the smallest one whose allowance actually covers the volume
   * — not whichever is numerically cheapest.
   *
   * Optimising pure dollars produced advice no business would take: "stay on
   * the 750-minute plan and buy 1,050 minutes of overage, every month,
   * forever." An allowance is the thing being sold; a plan you blow through
   * eightfold is not a plan, it is a warning light. `TIERS` is in ascending
   * order of minutes, so the first one that fits is the right one, and past
   * the top rung there is only the top rung.
   */
  const mine =
    priced.find((p) => p.tier.minutes >= minutes) ?? priced[priced.length - 1];

  /**
   * Kept anyway, and said out loud when it differs.
   *
   * If a smaller plan plus its overage really would cost less, saying so is
   * the reason anybody trusts a page like this — and it doubles as a live
   * audit of the price list. A coherent one never has this gap: it only
   * opens when a rung's overage rate undercuts its own effective per-minute
   * rate, and it closes by itself the moment that is fixed.
   */
  const cheapest = priced.reduce((a, b) => (b.total < a.total ? b : a));
  const cheaperExists = cheapest.tier.id !== mine.tier.id;

  const fee = feeFor(mine.tier, false);
  const overCost = mine.over * mine.tier.overage;
  const perDay = mine.total / DAYS_PER_MONTH;
  const pct = (callsDay / PRICING_MAX_CALLS_DAY) * 100;

  /**
   * How far the torn edge hangs, in em.
   *
   * Quantised, and that is not a stylistic choice: `TornEdge` rebuilds its
   * whole registration — rasterised source, GL texture, observers — whenever
   * its height changes, and a continuous mapping would do that on every
   * frame of a drag. Six steps across the range give the growth a reader can
   * see and a rebuild they cannot.
   *
   * Logarithmic, because the totals are: the bill runs from about $49 at one
   * call a day to about $500 at eighty, and a linear map would leave every
   * small business sharing the same stub.
   */
  const span = Math.log(mine.total / TIERS[0].monthly) / Math.log(12);
  const tear =
    2.8 + Math.round(Math.min(1, Math.max(0, span)) * 6) * 0.6;

  return (
    /* `#pricing` belongs to the plan list — that is what a "Pricing" link is
       asking for. This section answers the question after it, and is
       linkable in its own right: FAQ[4] and the close both point here. */
    <section
      id="your-bill"
      className="relative scroll-mt-24 px-[1.6em] py-[6em] md:py-[8em]"
    >
      <div className="relative mx-auto max-w-[76em]">
        {/* masthead */}
        <Reveal>
          <span className="flex items-center gap-[0.55em] mono text-[0.7em] uppercase tracking-[0.24em] text-[var(--cover-paper)]/45">
            <CornerDot className="size-[0.55em]" />
            {NUMERAL}
            <span aria-hidden>·</span>
            {KICKER}
          </span>
        </Reveal>

        <Reveal delay={0.06} className="mt-[0.9em]">
          <h2 className="text-balance text-[2.8em] font-medium leading-[1.03] tracking-[-0.045em] md:text-[3.4em]">
            {PRICING_INTRO.title}
          </h2>
        </Reveal>

        <Reveal
          delay={0.12}
          className="mt-[1em] max-w-[44em] text-pretty text-[1.05em] leading-[1.6] text-[var(--cover-paper)]/75"
        >
          {PRICING_INTRO.sub}
        </Reveal>

        <Reveal delay={0.16} className="mt-[2.4em]">
          <div aria-hidden className="h-px bg-[var(--cover-paper)]/12" />
        </Reveal>

        {/* THE CONTROL — on the open field, above the slip and outside it.
            A receipt is a thing you are handed; the question that produces
            it is a thing you answer. Putting the slider inside the slip made
            the paper interactive, which is the one thing paper is not, and
            it also meant every re-stamp of the bill happened underneath the
            reader's own thumb. */}
        <Reveal delay={0.08} className="mt-[3em] max-w-[40em]">
          <div className="flex flex-wrap items-baseline justify-between gap-x-[1.2em] gap-y-[0.4em]">
            <label
              htmlFor="calls-a-day"
              className="text-[1.05em] leading-tight text-[var(--cover-paper)]/85"
            >
              How many calls do you get on a normal day?
            </label>
            <span className="flex items-baseline gap-[0.4em]">
              <span className="mono text-[1.35em] leading-none tabular-nums text-[var(--cover-brand-lit)]">
                {callsDay}
              </span>
              <span className="text-[0.82em] leading-none text-[var(--cover-paper)]/45">
                a day
              </span>
            </span>
          </div>

          {/* A native range, deliberately. A custom drag surface reads as a
              chart to be interpreted; this reads as a control to be moved,
              and it arrives with keyboard and touch already correct.
              The track is mixed from `--cover-paper` rather than written as
              an rgba literal: the literal was the old one's only hard-coded
              colour and it inverted wrongly under `.cover.hdr-light`. */}
          <input
            id="calls-a-day"
            type="range"
            min={1}
            max={PRICING_MAX_CALLS_DAY}
            step={1}
            value={callsDay}
            onChange={(e) => setCallsDay(Number(e.target.value))}
            style={{
              background: `linear-gradient(to right, var(--cover-brand-lit) ${pct}%, color-mix(in srgb, var(--cover-paper) 14%, transparent) ${pct}%)`,
            }}
            className={cn(
              "mt-[1.2em] h-[0.4em] w-full cursor-ew-resize appearance-none rounded-full outline-none",
              "focus-visible:ring-2 focus-visible:ring-[var(--cover-brand-lit)]/60",
              "[&::-webkit-slider-thumb]:size-[1.4em] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[0.22em] [&::-webkit-slider-thumb]:border-[var(--cover-field-low)] [&::-webkit-slider-thumb]:bg-[var(--cover-brand-lit)]",
              "[&::-moz-range-thumb]:size-[1.4em] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[0.22em] [&::-moz-range-thumb]:border-[var(--cover-field-low)] [&::-moz-range-thumb]:bg-[var(--cover-brand-lit)]",
            )}
          />

          {/* The conversion, on the field rather than on the slip. The slip
              bills minutes; this is where calls become them, and stating it
              here is what lets the two assumptions be argued with before a
              single price has been read. */}
          <p className="mt-[1em] text-[0.86em] leading-[1.5] text-[var(--cover-paper)]/75">
            {num(callsDay)} {callsDay === 1 ? "call" : "calls"} a day ×{" "}
            {DAYS_PER_MONTH} days × about {AVG_CALL_MIN} minutes a call ={" "}
            <span className="mono tabular-nums text-[var(--cover-paper)]">
              {num(minutes)} minutes
            </span>{" "}
            a month.
          </p>

          {/* Three volumes worth naming, so nobody has to guess where to
              start. Square at the slip's own radius, not pills — the page
              has one pill vocabulary and it belongs to the buttons that
              actually go somewhere. */}
          <div className="mt-[1.2em] flex flex-wrap gap-[0.45em]">
            {PRICING_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setCallsDay(p.callsDay)}
                aria-pressed={callsDay === p.callsDay}
                className={cn(
                  "rounded-[0.35em] border px-[0.9em] py-[0.5em] text-[0.72em] leading-none transition-colors duration-500",
                  callsDay === p.callsDay
                    ? "border-[var(--cover-brand-lit)]/55 bg-[var(--cover-brand-lit)]/12 text-[var(--cover-brand-lit)]"
                    : "border-[var(--cover-paper)]/12 text-[var(--cover-paper)]/75 hover:border-[var(--cover-paper)]/30",
                )}
              >
                {p.label} · {p.callsDay} a day
              </button>
            ))}
          </div>
        </Reveal>

        {/* THE SLIP. Off the gutter rather than centred: it is an object
            that has been put down on the field, not a column of the layout.
            The radius is the low rung of the ladder — a receipt is cut, not
            rounded — and there is no border, because the bottom edge is torn
            and a frame with one side missing reads as a rendering fault. */}
        <div className="mt-[3.2em] max-w-[34em] rounded-[0.35em] bg-[var(--cover-panel)] md:ml-[6em]">
          <RevealStagger stagger={0.09} className="px-[1.5em] pt-[1.6em] md:px-[1.9em]">
            <Stamp className="mb-[0.8em]">
              <p className="mono text-[0.62em] uppercase tracking-[0.22em] text-[var(--cover-paper)]/45">
                Your monthly bill, worked out
              </p>
            </Stamp>

            <BillLine
              label={
                <>
                  <span className="text-[var(--cover-paper)]">
                    {mine.tier.name}
                  </span>{" "}
                  plan, billed monthly
                </>
              }
              value={fee}
              unit="usd"
            />

            <BillLine
              label="Minutes included in that fee"
              value={mine.tier.minutes}
              unit="min"
            />

            <BillLine
              label="Minutes past the allowance"
              value={mine.over}
              unit="min"
            />

            <BillLine
              label={
                mine.over > 0
                  ? `Those ${num(mine.over)} minutes, at ${cents(mine.tier.overage)} each`
                  : "Nothing past the allowance to bill"
              }
              value={overCost}
              unit="usd"
            />

            <Stamp>
              <div
                aria-hidden
                className="my-[0.7em] h-px bg-[var(--cover-paper)]/15"
              />
            </Stamp>

            <BillLine
              strong
              label="What you pay, every month"
              value={mine.total}
              unit="usd"
            />

            {/* The number an owner has already priced against their own
                morning by the time they finish reading it — and the only
                large one in the section. "a day" sits on its own line:
                inline at this size the word-space all but vanished and the
                figure read "$10.38aday". */}
            <Stamp className="mt-[1.6em]">
              <p className="mono text-[0.6em] uppercase tracking-[0.22em] text-[var(--cover-paper)]/45">
                That is
              </p>
              <p className="mt-[0.3em] text-[3.2em] font-medium leading-none tracking-[-0.045em] text-[var(--cover-brand-lit)]">
                <CountUp
                  to={perDay}
                  track
                  duration={0.5}
                  decimals={2}
                  prefix="$"
                />
              </p>
              <p className="mt-[0.5em] text-[0.86em] leading-none text-[var(--cover-paper)]/75">
                a day, for {num(callsMonth)} calls answered a month
              </p>
            </Stamp>

            {cheaperExists && (
              <Stamp className="mt-[1.6em]">
                <div className="border-t border-dashed border-[var(--cover-paper)]/15 pt-[1em] text-[0.82em] leading-[1.6] text-[var(--cover-paper)]/75">
                  Worth knowing: staying on {cheapest.tier.name} and paying for
                  the extra {num(cheapest.over)} minutes would come to{" "}
                  {money(cheapest.total)} —{" "}
                  {money(mine.total - cheapest.total)} less a month. You would
                  be running past your allowance every month to do it, which is
                  why it is not what we put on the receipt. Your call.
                </div>
              </Stamp>
            )}

            {/* The trial closes the slip rather than opening a panel of its
                own. It is the last line of a bill you have not been sent
                yet, which is the only place on the page it means anything. */}
            <Stamp className="mt-[1.6em] pb-[1.8em]">
              <div className="border-t border-[var(--cover-paper)]/12 pt-[1.2em]">
                <p className="text-[0.95em] font-medium leading-tight">
                  {PRICING_TRIAL.headline}
                </p>
                <p className="mt-[0.5em] text-[0.82em] leading-[1.55] text-[var(--cover-paper)]/75">
                  {PRICING_TRIAL.body}
                </p>
                <IntentLink
                  href={PRICING_TRIAL.href}
                  className="mt-[1em] inline-flex items-center gap-[0.45em] text-[0.85em] font-medium leading-none text-[var(--cover-brand-lit)] transition-opacity duration-500 hover:opacity-70"
                >
                  {PRICING_TRIAL.cta}
                  <ArrowRight className="size-[1em]" strokeWidth={2.2} />
                </IntentLink>
              </div>
            </Stamp>
          </RevealStagger>

          {/* The slip's bottom edge, torn, and as long as the bill is. One
              of the three instances the page allows. */}
          <TornEdge height={tear} />
        </div>

        {/* The two assumptions, stated where they can be argued with. */}
        <p className="mt-[5.5em] max-w-[52em] text-[0.74em] leading-[1.7] text-[var(--cover-paper)]/75">
          {PRICING_NOTE}
        </p>
      </div>
    </section>
  );
}
