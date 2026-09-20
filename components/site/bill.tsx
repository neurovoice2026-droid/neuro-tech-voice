"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useAnimationControls, useReducedMotion } from "framer-motion";
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
import { Frame, PillLink, SectionHeading } from "./product/primitives";
import { CountUp, EASE, Reveal, RevealStagger } from "./reveal";

/**
 * The bill — the arithmetic done out loud, on a slip of paper.
 *
 * **Set in the light product system, because that is the house.** Every
 * mega-menu page — the product pages, the solutions page, the sixteen
 * industry pages — is white stock, black ink, one violet accent, Onest
 * over Inter, and one centred `Frame`. This section briefly was not. The
 * substance below is unchanged; the surface and the palette are new. No
 * `--cover-*` token appears in this file, and sizing is rem/px rather
 * than the cover's em base.
 *
 * The plan list directly above answers "what do I get for my money". This
 * section answers the question that arrives a second later and is the one
 * that actually decides anything: *what will it cost me*. Those are two
 * different acts of reading, so they are two different objects — the
 * plans are a rack of cards, this is a single narrow slip. On white the
 * slip is the page's one grey (`bg-pp-card`) with a torn bottom edge, so
 * it reads as a piece of paper put down on the page rather than as one
 * more section of it. No border: the bottom is torn, and a frame with one
 * side missing reads as a rendering fault.
 *
 * Four decisions worth keeping, three of them inherited and one a repair:
 *
 *  · **The only question is calls a day.** The first version asked for
 *    minutes a month and drew four cost curves against them. It was
 *    precise, it was honest, and no customer could use it: a dentist does
 *    not know how many minutes their phone does in a month. Everyone
 *    knows roughly how many calls they get in a morning. So that is the
 *    one input, and calls a month, minutes, plan, allowance and invoice
 *    are all arithmetic performed in front of them, one line at a time.
 *  · **The headline figure is PER DAY.** A monthly total is a number you
 *    have to go away and compare against something. A daily one has
 *    already been priced against the reader's own morning by the time
 *    they finish reading it. It is the only large number in the section.
 *  · **The receipt SHOWS the overage line.** Hiding it would make every
 *    plan look like its sticker price and make the first invoice feel
 *    like a betrayal. Shown, it is the most trust-building object on the
 *    page. The rate is printed in cents — `6.5¢` — and not as `$0.07`, so
 *    that the multiplication on the line above can actually be checked.
 *    Rounded to two dollar-decimals, 6.5¢ prints as 7¢ and the line stops
 *    adding up.
 *  · **It names the cheaper plan when a cheaper one exists.** They were
 *    going to work it out anyway. The only question was whether they did
 *    it with us, or on a notepad afterwards, feeling handled.
 *
 * No number is written down in this comment. A figure quoted in prose
 * goes stale the first time a rung moves, which is the whole argument for
 * computing it on screen.
 *
 * **The slip's own length is still a reading.** The torn bottom edge
 * lengthens with the bill, so a quiet clinic gets a shallow tear and a
 * dispatch room a long one. It is the only ambient signal in the section,
 * and it says the same thing the total says.
 *
 * **What the light page forced.** Three things could not simply be
 * recoloured:
 *  · The tear was a `TornEdge` from `cover-tear.tsx` — a dark WebGL
 *    component that cannot be painted on white. It is now a CSS mask (see
 *    `teeth`), which also removes the reason the old depth was quantised:
 *    `TornEdge` rebuilt its whole registration whenever its height moved,
 *    so the growth had to come in six steps. A mask costs nothing to
 *    re-evaluate, so the depth is continuous and eased.
 *  · The presets were square, on the cover's reasoning that the page had
 *    one pill vocabulary and it belonged to buttons that go somewhere.
 *    This system has no square idiom at all — `PillLink` is the only
 *    button there is — so the presets borrow its exact geometry: chosen
 *    is the primary's black, unchosen the secondary's shadowed white.
 *  · The re-stamp dipped to 0.32 opacity. On white that is a line going
 *    pale rather than a line being re-inked, so it is shallower now and
 *    carries a 3px drop: the number is struck again, not faded out.
 */

/**
 * The kicker for the section heading.
 *
 * `PRICING_INTRO.eyebrow` reads "Pricing", which is what the plan list
 * above is; this section is the bill you get from it, and the FAQ and the
 * close both link here calling it exactly that. `lib/site.ts` is frozen,
 * so the name lives here instead of being forced on the shared constant.
 *
 * The cover set a section numeral beside it. This system numbers nothing
 * — no product, solutions or industry page carries a section index — so
 * the numeral went with the palette.
 */
const KICKER = "Your bill";

/** Figures are set in the house mono, the way every pp page sets one. */
const MONO = "font-[family-name:var(--font-geist-mono)]";

/**
 * Always two decimals, even on the round numbers.
 *
 * Dropping the cents above a hundred looked tidier and broke the one
 * thing a receipt has to do: `$49.00` above `$263` above `$312` is three
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

/** The overage rate, at the precision it is actually billed at. */
const cents = (usd: number) => `${(usd * 100).toFixed(1)}¢`;

/**
 * The torn bottom edge, as a mask rather than a picture.
 *
 * One tooth per `PITCH`, each a wedge pointing straight down from the top
 * of its tile. The tile clips the wedge at its own edges, so a tooth can
 * never be deeper than half the pitch at a fixed angle — which is why the
 * angle is computed from the depth instead of being fixed at 45°: a
 * shallow tear is a row of wide, blunt teeth and a long one is a row of
 * narrow, deep ones, on the same perforation pitch throughout.
 */
const PITCH = 22;

const teeth = (depth: number) => {
  const half = (Math.atan2(PITCH / 2, depth) * 180) / Math.PI;
  return `conic-gradient(from ${180 - half}deg at 50% 0, #000 0 ${2 * half}deg, rgb(0 0 0 / 0) 0)`;
};

/**
 * One line of the bill, and the unit of both animations.
 *
 * On arrival it is a stagger child: the slip types itself top to bottom.
 * When the reader moves the slider it re-stamps itself — but only if its
 * own number moved. That is the whole reason the dip lives down here on
 * the line rather than up on the slip: at twenty calls a day the plan fee
 * and the allowance do not change, and a receipt where every line
 * flinches at every drag teaches the reader nothing about which of them
 * the slider touches.
 *
 * The dip is a separate element from the stamp because one is driven by
 * the parent's variants and the other by imperative controls, and a
 * single node cannot be owned by both.
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
  // The number this line last showed. A ref, not state: it is compared in
  // an effect and never read during a render.
  const prev = useRef(value);

  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    if (reduce) return;
    // Shallower than the cover's dip and with a drop under it: on white a
    // line at 0.32 opacity has gone pale, which is the opposite of what a
    // re-printed line does.
    controls.start({
      opacity: [0.45, 1],
      y: [-3, 0],
      transition: { duration: 0.22, ease: EASE },
    });
  }, [value, reduce, controls]);

  return (
    <Stamp>
      <motion.div
        animate={controls}
        className="flex items-baseline justify-between gap-6 py-2"
      >
        <span
          className={cn(
            "min-w-0 text-[14px] leading-[21px] md:text-[15px] md:leading-[22px]",
            strong ? "font-medium text-pp-ink" : "text-pp-muted",
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            MONO,
            "shrink-0 tabular-nums",
            strong
              ? "text-[17px] leading-none text-pp-ink md:text-[18px]"
              : "text-[13px] leading-none text-pp-ink/80 md:text-[14px]",
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
 * `y` is negative so the line arrives from above and settles, which is
 * what a printed line does. In px, not em: this system has no em base to
 * scale against.
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
        hidden: reduce ? {} : { opacity: 0, y: -6 },
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
   * receipt under it says $99 — and a reader with no way to tell which
   * one is the real price. The receipt quotes the list price and the note
   * at the foot states what annual takes off it.
   */
  const priced = TIERS.map((t) => ({
    tier: t,
    total: costFor(t, minutes, false),
    over: Math.max(0, minutes - t.minutes),
  }));

  /**
   * The plan is the smallest one whose allowance actually covers the
   * volume — not whichever is numerically cheapest.
   *
   * Optimising pure dollars produced advice no business would take: "stay
   * on the 750-minute plan and buy 1,050 minutes of overage, every month,
   * forever." An allowance is the thing being sold; a plan you blow
   * through eightfold is not a plan, it is a warning light. `TIERS` is in
   * ascending order of minutes, so the first one that fits is the right
   * one, and past the top rung there is only the top rung.
   */
  const mine =
    priced.find((p) => p.tier.minutes >= minutes) ?? priced[priced.length - 1];

  /**
   * Kept anyway, and said out loud when it differs.
   *
   * If a smaller plan plus its overage really would cost less, saying so
   * is the reason anybody trusts a page like this — and it doubles as a
   * live audit of the price list. A coherent one never has this gap: it
   * only opens when a rung's overage rate undercuts its own effective
   * per-minute rate, and it closes by itself the moment that is fixed.
   */
  const cheapest = priced.reduce((a, b) => (b.total < a.total ? b : a));
  const cheaperExists = cheapest.tier.id !== mine.tier.id;

  const fee = feeFor(mine.tier, false);
  const overCost = mine.over * mine.tier.overage;
  const perDay = mine.total / DAYS_PER_MONTH;
  const pct = (callsDay / PRICING_MAX_CALLS_DAY) * 100;

  /**
   * How far the torn edge hangs, in px.
   *
   * Logarithmic, because the totals are: the bill runs from about $49 at
   * one call a day to about $500 at eighty, and a linear map would leave
   * every small business sharing the same stub.
   */
  const span = Math.log(mine.total / TIERS[0].monthly) / Math.log(12);
  const tear = 9 + Math.min(1, Math.max(0, span)) * 17;

  return (
    /* `#pricing` belongs to the plan list — that is what a "Pricing" link
       is asking for. This section answers the question after it, and is
       linkable in its own right: FAQ[4] and the close both point here. */
    <Frame as="section" id="your-bill" className="scroll-mt-24 py-16 md:py-24">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:gap-16">
        {/* THE QUESTION. On the open page, beside the slip and outside
            it. A receipt is a thing you are handed; the question that
            produces it is a thing you answer. Putting the slider inside
            the slip made the paper interactive, which is the one thing
            paper is not, and it meant every re-stamp of the bill happened
            underneath the reader's own thumb. */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <Reveal>
            <SectionHeading eyebrow={KICKER}>
              {PRICING_INTRO.title}
            </SectionHeading>
          </Reveal>

          <Reveal
            delay={0.06}
            className="mt-5 max-w-[560px] text-[15px] leading-[24px] text-pretty text-pp-ink/80 md:text-[16px] md:leading-[26px]"
          >
            {PRICING_INTRO.sub}
          </Reveal>

          <Reveal delay={0.12} className="mt-10 max-w-[560px]">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <label
                htmlFor="calls-a-day"
                className="text-[15px] leading-[22px] text-pp-ink md:text-[16px]"
              >
                How many calls do you get on a normal day?
              </label>
              <span className="flex items-baseline gap-1.5">
                <span
                  className={cn(
                    MONO,
                    "text-[22px] leading-none tabular-nums text-pp-accent",
                  )}
                >
                  {callsDay}
                </span>
                <span className="text-[12px] leading-none text-pp-muted">
                  a day
                </span>
              </span>
            </div>

            {/* A native range, deliberately. A custom drag surface reads
                as a chart to be interpreted; this reads as a control to be
                moved, and it arrives with keyboard and touch already
                correct. The thumb is the white puck with a black ring that
                every scrubber on the product pages uses, and the filled
                rail is ink rather than violet: violet on this page is
                reserved for the two live figures. */}
            <input
              id="calls-a-day"
              type="range"
              min={1}
              max={PRICING_MAX_CALLS_DAY}
              step={1}
              value={callsDay}
              onChange={(e) => setCallsDay(Number(e.target.value))}
              style={{
                background: `linear-gradient(to right, var(--pp-ink) ${pct}%, var(--pp-hair) ${pct}%)`,
              }}
              className={cn(
                "mt-6 h-1.5 w-full cursor-ew-resize appearance-none rounded-full outline-none",
                "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-pp-ink",
                "[&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_0_1.6px_#000]",
                // Firefox paints its own track behind the element's
                // background and gives the thumb a border of its own.
                "[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent",
                "[&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-[0_0_0_1.6px_#000]",
              )}
            />

            {/* The conversion, beside the slip rather than on it. The slip
                bills minutes; this is where calls become them, and stating
                it here is what lets the two assumptions be argued with
                before a single price has been read. */}
            <p className="mt-5 text-[14px] leading-[22px] text-pp-muted">
              {num(callsDay)} {callsDay === 1 ? "call" : "calls"} a day ×{" "}
              {DAYS_PER_MONTH} days × about {AVG_CALL_MIN} minutes a call ={" "}
              <span className={cn(MONO, "tabular-nums text-pp-ink")}>
                {num(minutes)} minutes
              </span>{" "}
              a month.
            </p>

            {/* Three volumes worth naming, so nobody has to guess where to
                start. Pills, because this system has exactly one button
                shape and these borrow the two `PillLink` variants rather
                than inventing a third. */}
            <div className="mt-6 flex flex-wrap gap-2">
              {PRICING_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setCallsDay(p.callsDay)}
                  aria-pressed={callsDay === p.callsDay}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center justify-center rounded-full px-3.5 text-sm whitespace-nowrap transition-[background-color,color,scale] duration-200 active:scale-[0.97]",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink",
                    callsDay === p.callsDay
                      ? "bg-pp-ink text-white"
                      : "pp-shadow-btn bg-white text-pp-ink hover:bg-pp-card",
                  )}
                >
                  {p.label} · {p.callsDay} a day
                </button>
              ))}
            </div>
          </Reveal>
        </div>

        {/* THE SLIP. */}
        <div>
          <div className="rounded-t-[24px] bg-pp-card">
            <RevealStagger stagger={0.09} className="px-6 pt-7 md:px-8 md:pt-8">
              <Stamp className="mb-3">
                <p
                  className={cn(
                    MONO,
                    "text-[11px] tracking-[0.14em] text-pp-muted uppercase",
                  )}
                >
                  Your monthly bill, worked out
                </p>
              </Stamp>

              <BillLine
                label={
                  <>
                    <span className="text-pp-ink">{mine.tier.name}</span> plan,
                    billed monthly
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
                <div aria-hidden className="my-3 h-px bg-pp-hair" />
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
                  inline at this size the word-space all but vanished and
                  the figure read "$10.38aday". */}
              <Stamp className="mt-8">
                <p
                  className={cn(
                    MONO,
                    "text-[11px] tracking-[0.14em] text-pp-muted uppercase",
                  )}
                >
                  That is
                </p>
                <p
                  className="pp-display mt-2 text-[44px] leading-none tracking-[-0.03em] text-pp-accent md:text-[54px]"
                  // Inline: `.pp-display` sets 360 outside Tailwind's
                  // layers, so a weight utility would lose to it.
                  style={{ fontWeight: 480 }}
                >
                  <CountUp
                    to={perDay}
                    track
                    duration={0.5}
                    decimals={2}
                    prefix="$"
                  />
                </p>
                <p className="mt-3 text-[14px] leading-[21px] text-pp-muted">
                  a day, for {num(callsMonth)} calls answered a month
                </p>
              </Stamp>

              {cheaperExists && (
                <Stamp className="mt-8">
                  <div className="border-t border-dashed border-pp-hair pt-4 text-[13px] leading-[21px] text-pretty text-pp-muted">
                    Worth knowing: staying on {cheapest.tier.name} and paying
                    for the extra {num(cheapest.over)} minutes would come to{" "}
                    {money(cheapest.total)} —{" "}
                    {money(mine.total - cheapest.total)} less a month. You would
                    be running past your allowance every month to do it, which
                    is why it is not what we put on the receipt. Your call.
                  </div>
                </Stamp>
              )}

              {/* The trial closes the slip rather than opening a panel of
                  its own. It is the last line of a bill you have not been
                  sent yet, which is the only place on the page it means
                  anything. */}
              <Stamp className="mt-8 pb-8">
                <div className="border-t border-pp-hair pt-5">
                  <p className="text-[15px] leading-[22px] font-medium text-pp-ink md:text-[16px]">
                    {PRICING_TRIAL.headline}
                  </p>
                  <p className="mt-2 text-[13px] leading-[21px] text-pp-muted">
                    {PRICING_TRIAL.body}
                  </p>
                  <PillLink
                    href={PRICING_TRIAL.href}
                    variant="primary"
                    size="sm"
                    className="mt-5"
                  >
                    {PRICING_TRIAL.cta}
                  </PillLink>
                </div>
              </Stamp>
            </RevealStagger>
          </div>

          {/* The slip's bottom edge, torn, and as long as the bill is. The
              height is transitioned rather than snapped so the tear reads
              as growing with the total instead of re-cutting itself. */}
          <span
            aria-hidden
            className="block w-full bg-pp-card transition-[height] duration-500 motion-reduce:transition-none"
            style={{
              height: `${tear}px`,
              WebkitMaskImage: teeth(tear),
              maskImage: teeth(tear),
              WebkitMaskSize: `${PITCH}px 100%`,
              maskSize: `${PITCH}px 100%`,
              WebkitMaskRepeat: "repeat-x",
              maskRepeat: "repeat-x",
            }}
          />
        </div>
      </div>

      {/* The two assumptions, stated where they can be argued with. */}
      <p className="mt-16 max-w-[720px] text-[12px] leading-[20px] text-pp-muted">
        {PRICING_NOTE}
      </p>
    </Frame>
  );
}
