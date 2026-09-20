"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
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
import {
  holdFor,
  useInView,
  usePrefersReducedMotion,
} from "./product/timing";

/**
 * The bill — a day of calls answered, then the slip it produces.
 *
 * **The scene, and why it is the argument.** This section does not perform
 * an entrance. It runs a working day. A clock walks from 8:00 to 18:00 one
 * hour at a time, the calls that arrive in each hour stack up as a bar
 * under the slider, the tally beside the question climbs toward the day's
 * volume — and two hours in, the slip starts printing itself, one line per
 * hour, so the bill is being written while the phone is still ringing. The
 * day closes, the total holds long enough to be read at reading pace
 * (`holdFor`, the house clock in `product/timing.ts`), and the scene starts
 * again on the next volume: the default, then a quiet clinic, a busy salon,
 * a dispatch room. A reader who lands here watches the same arithmetic run
 * four times against four different businesses without touching anything.
 *
 * That is the point. A number that counts up because you scrolled past it
 * is decoration. A number that climbs because calls are being answered is
 * the product. The old version of this file was scroll choreography —
 * entrance wrappers, masked rises, scroll-bound cascades — and none of it
 * survived: no `framer-motion`, no `./reveal`. React changes state on a
 * timer; `transition-*` and `animate-in` do every pixel of the moving.
 *
 * **It yields, and it never takes control back.** The first pointer, focus
 * or key event anywhere in the controls or on the slip stops the loop for
 * good and leaves the reader holding the slider at whatever volume was on
 * screen. `useInView` gates the whole thing, so nothing ticks off screen,
 * and `usePrefersReducedMotion` hands those readers the finished state —
 * a closed day and a fully printed slip — with no timers at all.
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
 * dispatch room a long one. Because the scene changes volume on its own,
 * the tear is now the section's slowest-moving signal: it grows and
 * retracts across the loop, and it says the same thing the total says.
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
 *  · The re-stamp is a remount, not a tween: every live figure carries
 *    `key={value}`, so when its number moves React swaps the node and the
 *    `animate-in` classes replay. A line whose number did not move does
 *    not flinch, which is the whole reason the dip lives on the line.
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

/* ── The day, and the clock it runs on ─────────────────────────────── */

/**
 * How a small business's phone actually behaves across ten opening hours:
 * a hard morning, a lunch trough, a second afternoon peak, a quiet close.
 * The weights sum to 1, so whatever volume the day is set to, the hours
 * divide it and the last hour lands exactly on it.
 */
const DAY_SHAPE = [0.06, 0.12, 0.14, 0.11, 0.06, 0.08, 0.12, 0.13, 0.1, 0.08];
const HOURS = DAY_SHAPE.length;
const DAY_OPEN = 8;
const PEAK = Math.max(...DAY_SHAPE);

/** Calls answered by the end of hour `h`, as a fraction of the day. */
const BY_HOUR = DAY_SHAPE.reduce<number[]>(
  (acc, w) => [...acc, acc[acc.length - 1] + w],
  [0],
);

/** One hour of the working day. Ten of them make the day about 3.2s long. */
const TICK = 320;

/** How many hours pass before the slip starts printing what it has. */
const LEAD = 2;

/** Slots on the slip, printed one an hour in this order. */
const STAMPS = 10;

/** The last tick of a cycle: the day has closed and the slip is complete. */
const LAST = LEAD + STAMPS;

/**
 * The volumes the scene plays, in order: the page's own default first —
 * so a reader who arrives mid-cycle is looking at the same business the
 * slider starts on — then the three named ones.
 */
const VOLUMES = [10, ...PRICING_PRESETS.map((p) => p.callsDay)];

/**
 * One printed slot on the slip.
 *
 * Hidden it keeps its space, so the paper never reflows and the torn edge
 * never jitters while the bill is being written. The movement is a two
 * property transition and nothing else.
 */
function Printed({
  on,
  className,
  children,
}: {
  on: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        className,
        "transition-[opacity,translate] duration-300 motion-reduce:transition-none",
        on ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0",
      )}
    >
      {children}
    </div>
  );
}

/**
 * One line of the bill, and the unit of both movements.
 *
 * It prints once, when its hour comes round. After that it re-stamps only
 * when its own number moves: the figure carries `key={value}`, so React
 * replaces the node and the `animate-in` classes run again. At twenty
 * calls a day the plan fee and the allowance do not change, and a receipt
 * where every line flinches at every drag teaches the reader nothing
 * about which of them the slider touches.
 */
function BillLine({
  label,
  value,
  unit,
  strong,
  on,
  still,
}: {
  label: ReactNode;
  value: number;
  unit: "usd" | "min";
  strong?: boolean;
  on: boolean;
  still: boolean;
}) {
  return (
    <Printed on={on} className="flex items-baseline justify-between gap-6 py-2">
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
        <span
          key={still ? "static" : value}
          className={cn(
            "inline-block",
            !still && "animate-in fade-in-0 slide-in-from-top-1 duration-200",
          )}
        >
          {unit === "usd" ? money(value) : `${num(value)} min`}
        </span>
      </span>
    </Printed>
  );
}

export function Bill() {
  const scene = useRef<HTMLDivElement>(null);
  const reduce = usePrefersReducedMotion();
  const inView = useInView(scene, "-15% 0px -15% 0px");

  /** True from the reader's first pointer, focus or key event, forever. */
  const [taken, setTaken] = useState(false);
  const takeOver = () => setTaken(true);

  const [callsDay, setCallsDay] = useState(VOLUMES[0]);
  const [volume, setVolume] = useState(0);
  const [tick, setTick] = useState(0);

  const live = inView && !reduce && !taken;
  /** Reduced motion and the reader both get the finished day immediately. */
  const at = reduce || taken ? LAST : tick;

  const hour = Math.min(at, HOURS);
  const stamped = Math.min(Math.max(at - LEAD, 0), STAMPS);
  const answered = Math.round(callsDay * BY_HOUR[hour]);

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

  /**
   * The line the finished bill has to be read against, and therefore the
   * one that sets how long the scene rests before the next volume. The
   * house clock decides; this file does not pick a number.
   */
  const closing = `a day, for ${num(callsMonth)} calls answered a month`;

  /**
   * The clock. One timeout at a time, cleared on every change — so it
   * stops dead when the section leaves the viewport, when the reader
   * takes over, and on unmount.
   */
  useEffect(() => {
    if (!live) return;
    if (tick < LAST) {
      const id = setTimeout(() => setTick((t) => t + 1), TICK);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => {
      setVolume((v) => (v + 1) % VOLUMES.length);
      setTick(0);
    }, holdFor(closing));
    return () => clearTimeout(id);
  }, [live, tick, closing]);

  /** The scene owns the slider until the reader touches it. */
  useEffect(() => {
    if (taken) return;
    setCallsDay(VOLUMES[volume]);
  }, [volume, taken]);

  return (
    /* `#pricing` belongs to the plan list — that is what a "Pricing" link
       is asking for. This section answers the question after it, and is
       linkable in its own right: FAQ[4] and the close both point here. */
    <Frame as="section" id="your-bill" className="scroll-mt-24 py-16 md:py-24">
      <div
        ref={scene}
        onPointerDown={takeOver}
        onKeyDown={takeOver}
        onFocus={takeOver}
        className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:gap-16"
      >
        {/* THE QUESTION. On the open page, beside the slip and outside
            it. A receipt is a thing you are handed; the question that
            produces it is a thing you answer. Putting the slider inside
            the slip made the paper interactive, which is the one thing
            paper is not, and it meant every re-stamp of the bill happened
            underneath the reader's own thumb. */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeading eyebrow={KICKER}>{PRICING_INTRO.title}</SectionHeading>

          <p className="mt-5 max-w-[560px] text-[15px] leading-[24px] text-pretty text-pp-ink/80 md:text-[16px] md:leading-[26px]">
            {PRICING_INTRO.sub}
          </p>

          <div className="mt-10 max-w-[560px]">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <label
                htmlFor="calls-a-day"
                className="text-[15px] leading-[22px] text-pp-ink md:text-[16px]"
              >
                How many calls do you get on a normal day?
              </label>
              {/* The tally, not the setting: it climbs as the day's calls
                  are answered and lands on the volume the slider holds. */}
              <span className="flex items-baseline gap-1.5">
                <span
                  className={cn(
                    MONO,
                    "text-[22px] leading-none tabular-nums text-pp-accent",
                  )}
                >
                  {answered}
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
              onChange={(e) => {
                takeOver();
                setCallsDay(Number(e.target.value));
              }}
              style={{
                background: `linear-gradient(to right, var(--pp-ink) ${pct}%, var(--pp-hair) ${pct}%)`,
              }}
              className={cn(
                "mt-6 h-1.5 w-full cursor-ew-resize appearance-none rounded-full outline-none transition-[background] duration-300 motion-reduce:transition-none",
                "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-pp-ink",
                "[&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_0_1.6px_#000]",
                // Firefox paints its own track behind the element's
                // background and gives the thumb a border of its own.
                "[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent",
                "[&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-[0_0_0_1.6px_#000]",
              )}
            />

            {/* THE DAY. Ten opening hours, each as tall as the calls that
                land in it, filling left to right while the clock walks.
                It is decorative in the strict sense — every figure it
                carries is stated in words below it — so it is hidden from
                the accessibility tree rather than narrated twice. */}
            <div aria-hidden className="mt-7 flex items-end gap-3">
              <span
                className={cn(
                  MONO,
                  "w-[52px] shrink-0 text-[12px] leading-none tabular-nums text-pp-muted",
                )}
              >
                {DAY_OPEN + hour}:00
              </span>
              <span className="flex h-8 min-w-0 flex-1 items-end gap-1.5">
                {DAY_SHAPE.map((w, i) => {
                  const done = hour > i;
                  const now = hour === i + 1;
                  return (
                    <span
                      key={i}
                      className={cn(
                        "min-w-0 flex-1 rounded-[2px] transition-[height,background-color] duration-500 motion-reduce:transition-none",
                        now
                          ? "bg-pp-accent"
                          : done
                            ? "bg-pp-ink/70"
                            : "bg-pp-hair",
                      )}
                      style={{
                        height: done ? `${6 + (w / PEAK) * 26}px` : "2px",
                      }}
                    />
                  );
                })}
              </span>
            </div>

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
                start — and, until the reader touches anything, the three
                the scene is playing through. The pressed one moves on its
                own, which is how the loop says which business it is
                costing right now. */}
            <div className="mt-6 flex flex-wrap gap-2">
              {PRICING_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    takeOver();
                    setCallsDay(p.callsDay);
                  }}
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
          </div>
        </div>

        {/* THE SLIP. It writes itself while the day runs. */}
        <div>
          <div className="rounded-t-[24px] bg-pp-card">
            <div className="px-6 pt-7 md:px-8 md:pt-8">
              <Printed on={stamped > 0} className="mb-3">
                <p
                  className={cn(
                    MONO,
                    "text-[11px] tracking-[0.14em] text-pp-muted uppercase",
                  )}
                >
                  Your monthly bill, worked out
                </p>
              </Printed>

              <BillLine
                on={stamped > 1}
                still={reduce}
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
                on={stamped > 2}
                still={reduce}
                label="Minutes included in that fee"
                value={mine.tier.minutes}
                unit="min"
              />

              <BillLine
                on={stamped > 3}
                still={reduce}
                label="Minutes past the allowance"
                value={mine.over}
                unit="min"
              />

              <BillLine
                on={stamped > 4}
                still={reduce}
                label={
                  mine.over > 0
                    ? `Those ${num(mine.over)} minutes, at ${cents(mine.tier.overage)} each`
                    : "Nothing past the allowance to bill"
                }
                value={overCost}
                unit="usd"
              />

              <Printed on={stamped > 5}>
                <div aria-hidden className="my-3 h-px bg-pp-hair" />
              </Printed>

              <BillLine
                on={stamped > 6}
                still={reduce}
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
              <Printed on={stamped > 7} className="mt-8">
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
                  <span
                    key={reduce ? "static" : perDay}
                    className={cn(
                      "inline-block",
                      !reduce &&
                        "animate-in fade-in-0 slide-in-from-top-1 duration-300",
                    )}
                  >
                    {money(perDay)}
                  </span>
                </p>
                <p className="mt-3 text-[14px] leading-[21px] text-pp-muted">
                  {closing}
                </p>
              </Printed>

              {cheaperExists && (
                <Printed on={stamped > 8} className="mt-8">
                  <div className="border-t border-dashed border-pp-hair pt-4 text-[13px] leading-[21px] text-pretty text-pp-muted">
                    Worth knowing: staying on {cheapest.tier.name} and paying
                    for the extra {num(cheapest.over)} minutes would come to{" "}
                    {money(cheapest.total)} —{" "}
                    {money(mine.total - cheapest.total)} less a month. You would
                    be running past your allowance every month to do it, which
                    is why it is not what we put on the receipt. Your call.
                  </div>
                </Printed>
              )}

              {/* The trial closes the slip rather than opening a panel of
                  its own. It is the last line of a bill you have not been
                  sent yet, which is the only place on the page it means
                  anything. */}
              <Printed on={stamped > 9} className="mt-8 pb-8">
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
              </Printed>
            </div>
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
