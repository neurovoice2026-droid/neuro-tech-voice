"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { gsap } from "gsap";
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
import {
  INK,
  LINE,
  Node,
  Ping,
  VIOLET,
  dotted,
  ping,
  trace,
} from "./product/line-figure";
import { useKitContext, useMotionKit } from "./product/motion-kit";
import { Frame, PillLink, SectionHeading } from "./product/primitives";
import {
  holdFor,
  useInView,
  usePrefersReducedMotion,
} from "./product/timing";

/**
 * The bill — a clock crosses the working day and the receipt is written in
 * its wake.
 *
 * **The signature movement, and why it is the argument.** One violet head
 * leaves 8:00 and rides the day's own call curve to 18:00. The curve draws
 * itself behind it (DrawSVG), each hour's bar stands up at the exact instant
 * the head passes it — the beat is the inverse of the head's own travel
 * along the path, so the two are one event and not two that happen to
 * agree — and, from the second hour, the slip on the right prints one line
 * per hour in its wake, so the bill is visibly being written while the
 * phone is still ringing. The torn bottom edge of the paper lengthens on
 * the same beat the total lands: the tear IS the total, said again in the
 * shape of the slip. The last two lines — the note that names a cheaper
 * plan, and the trial — print after the head has reached 18:00, because
 * they are what is said once the day is done. One timeline owns all of it.
 *
 * That is the whole claim. A bill that fades in because you scrolled past
 * it is decoration; a bill that is being written while the phone is still
 * ringing is the product. Nothing here is an entrance. The scene is one
 * `gsap.timeline` through `useMotionKit`/`useKitContext`, the same kit the
 * product pages animate with, fetched lazily and only when this section is
 * near — no CSS `animate-in` cascade, no per-hour timer, no scroll
 * choreography of any kind.
 *
 * **What it does NOT use, on purpose.** No shader band. A scene behind this
 * section is impossible: `ShaderStage` mixes paper into the bottom third of
 * whatever it draws, and every pixel here is either a figure to be checked
 * or a control to be moved. A band with nothing to say is worse than no
 * band. And no SplitText on the ledger lines: a receipt prints, it does not
 * speak. The one piece of prose on the slip — the note that names a cheaper
 * plan than the one we sell — is split into words, because that sentence is
 * the shopkeeper talking over the till, and it should arrive as language
 * rather than as one more printed row.
 *
 * **It yields, and it never takes control back.** The first pointer, focus
 * or key event anywhere in the controls or on the slip reverts the whole
 * context for good: every inline style GSAP wrote is undone, the markup
 * falls back to its own finished state, and the reader is left holding the
 * slider at whatever volume was on screen. `useInView` gates both the fetch
 * (`25% 0px`) and the play (`-15%`), so nothing is downloaded before the
 * section is near and nothing runs off screen; GSAP's ticker is
 * `requestAnimationFrame`, so a backgrounded tab stops it too.
 * `usePrefersReducedMotion` never asks for the kit at all — the markup
 * rests complete, which is to say a closed day and a fully printed slip.
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
 * **The day is a figure now, not a row of divs.** The old strip was ten
 * `<div>`s growing by inline `height` under a CSS transition, which is a
 * chart; this is an SVG in the product pages' own drawing kit — a dotted
 * route, a ghost-and-ink pair for every stroke, a node at each end, a ping
 * when the head arrives. Nothing is invented: `INK`, `LINE`, `dotted`,
 * `Node`, `Ping`, `ping` and `trace` all come from
 * `product/line-figure.tsx`.
 *
 * **What the light page forced.** Two things could not simply be
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
 *
 * **The re-stamp stays a remount, and stays CSS.** Every live figure
 * carries `key={value}`, so when its number moves React swaps the node and
 * the `animate-in` classes replay. That is a small state change under the
 * reader's own thumb, which is exactly what a CSS transition is for; GSAP
 * owns the section's composed movement and nothing else. A line whose
 * number did not move does not flinch, which is the whole reason the dip
 * lives on the line.
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
 *
 * The angle is cut once, for the depth the bill will finish at, and the
 * timeline then grows the element's height into it. That is deliberate:
 * at half height the wedges reach only half as far across their tiles, so
 * the edge starts as a fine perforation and opens into a tear as the total
 * lands. Re-cutting the mask every frame would also put a style write
 * outside GSAP's context, which is a thing the revert could not undo.
 */
const PITCH = 22;

const teeth = (depth: number) => {
  const half = (Math.atan2(PITCH / 2, depth) * 180) / Math.PI;
  return `conic-gradient(from ${180 - half}deg at 50% 0, #000 0 ${2 * half}deg, rgb(0 0 0 / 0) 0)`;
};

/** The stub the paper is torn back to before the bill is written. */
const TEAR_MIN = 9;

/* ── The day, and the clock that crosses it ────────────────────────── */

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

/** The figure's box, and the day laid out inside it. */
const DAY = { w: 360, h: 60, x0: 16, x1: 344, base: 48, amp: 26 };
const STEP = (DAY.x1 - DAY.x0) / HOURS;

/** Where hour `i`'s bar stands. */
const hourX = (i: number) => DAY.x0 + (i + 0.5) * STEP;

/**
 * The call rate at x, cosine-blended between the hours either side of it,
 * and held flat past the first and last bar so the curve opens and closes
 * level with its end nodes.
 */
function rateAt(x: number) {
  const u = (x - DAY.x0) / STEP - 0.5;
  const i = Math.floor(u);
  const t = Math.min(Math.max(u - i, 0), 1);
  const clamp = (n: number) => DAY_SHAPE[Math.min(Math.max(n, 0), HOURS - 1)];
  return clamp(i) + (clamp(i + 1) - clamp(i)) * (0.5 - 0.5 * Math.cos(Math.PI * t));
}

const dayY = (x: number) => DAY.base - (rateAt(x) / PEAK) * DAY.amp;

/** The day's own shape, sampled into a path. */
const DAY_CURVE = trace(DAY.x0, DAY.x1, dayY);

/**
 * How far along the curve x is, by LENGTH rather than by width.
 *
 * The head travels the path on `ease: "none"`, and MotionPath measures a
 * path in arc length — so on a curve this wavy, "half the width" and "half
 * the journey" are several tenths of a second apart. Every bar's beat is
 * taken from here, which is what makes an hour stand up exactly as the
 * clock reaches it rather than approximately when it should have.
 */
const PROGRESS = (() => {
  const step = 1.25;
  const xs: number[] = [DAY.x0];
  const cum: number[] = [0];
  let total = 0;
  let px = DAY.x0;
  let py = dayY(DAY.x0);
  for (let x = DAY.x0 + step; x <= DAY.x1; x += step) {
    const y = dayY(x);
    total += Math.hypot(x - px, y - py);
    px = x;
    py = y;
    xs.push(x);
    cum.push(total);
  }
  return (x: number) => {
    for (let i = 1; i < xs.length; i++) if (xs[i] >= x) return cum[i] / total;
    return 1;
  };
})();

/** The clock sets off a beat after the section settles. */
const START = 0.3;
/** The working day, at this file's own hour. */
const RUN = (HOURS * TICK) / 1000;
const HOUR_T = RUN / HOURS;

/**
 * When the clock reaches hour `h`. Past closing it keeps counting at the
 * average hour, because the last lines of a bill are written after the
 * phone has stopped.
 */
const timeAt = (h: number) =>
  h < HOURS
    ? START + PROGRESS(hourX(h)) * RUN
    : START + RUN + (h - HOURS + 0.5) * HOUR_T;

/**
 * The volumes the scene plays, in order: the page's own default first —
 * so a reader who arrives mid-cycle is looking at the same business the
 * slider starts on — then the three named ones.
 */
const VOLUMES = [10, ...PRICING_PRESETS.map((p) => p.callsDay)];

/**
 * One printed slot on the slip, and the unit the timeline prints in.
 *
 * It carries no transition and no transform utility of its own: GSAP
 * writes `transform` and Tailwind's `translate-*` classes write the
 * separate `translate` property, which would compose on top of it. The
 * class is the whole interface — the slots are printed in document order,
 * one an hour, and the markup rests visible so a reader with reduced
 * motion, or with the kit still on its way, is handed the finished slip.
 */
function Printed({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("bill-slot", className)}>{children}</div>;
}

/**
 * One line of the bill.
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
  still,
  className,
}: {
  label: ReactNode;
  value: number;
  unit: "usd" | "min";
  strong?: boolean;
  still: boolean;
  className?: string;
}) {
  return (
    <Printed
      className={cn("flex items-baseline justify-between gap-6 py-2", className)}
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
  // Two margins, two jobs: `near` fetches GSAP, `inView` plays the day.
  const inView = useInView(scene, "-15% 0px -15% 0px");
  const near = useInView(scene, "25% 0px");
  const reduce = usePrefersReducedMotion();
  // `near && !reduce`: the markup already rests on a closed day and a
  // printed slip, so a reader who asked for no motion never downloads the
  // library at all.
  const kit = useMotionKit(near && !reduce);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  /** True from the reader's first pointer, focus or key event, forever. */
  const [taken, setTaken] = useState(false);
  const takeOver = () => setTaken(true);

  /** The volume the scene is costing, until the reader names one instead. */
  const [volume, setVolume] = useState(0);
  const [manual, setManual] = useState<number | null>(null);
  const callsDay = manual ?? VOLUMES[volume];
  const setCallsDay = (n: number) => {
    takeOver();
    setManual(n);
  };

  /**
   * The hour the clock has reached. It rests on the closed day — the
   * server, a reader with reduced motion and a reader who has taken over
   * all get 18:00 and the full tally — and the timeline rewinds it to 8:00
   * before the frame it starts on is painted.
   */
  const [hour, setHour] = useState(HOURS);

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

  /** The clock stops where the reader left it, showing a finished day. */
  useEffect(() => {
    if (taken || reduce) setHour(HOURS);
  }, [taken, reduce]);

  useKitContext(
    kit,
    ({ gsap, SplitText }) => {
      // Reduced motion never reaches here — the kit is not fetched for it —
      // and once the reader has taken over, the revert that ran a moment
      // ago has already put the section back into its finished state.
      if (reduce || taken) return;

      const q = gsap.utils.selector(scene);
      // `q` is typed as an HTML element array; the guide is the SVG path
      // MotionPath needs, so it is narrowed at the grab site.
      const guide = q(".bill-guide")[0] as unknown as SVGPathElement | undefined;
      const paper = q(".bill-tear")[0] as HTMLElement | undefined;
      if (!guide || !paper) return;

      const slots = q(".bill-slot");
      const stems = q(".bill-stem");
      const head = q(".bill-head");
      const aside = q(".bill-aside")[0] as HTMLElement | undefined;

      // Rewound inside a layout effect, so the finished slip the server
      // sent is never seen half way through a cycle.
      setHour(0);

      // Split for motion only: the words stay plain text to a screen
      // reader, and the context reverts the split when the volume changes
      // — never call .revert() by hand.
      const words = aside
        ? SplitText.create(aside, { type: "words", aria: "none" }).words
        : [];

      const tl = gsap.timeline({
        paused: true,
        onComplete: () => setVolume((v) => (v + 1) % VOLUMES.length),
      });

      // The whole resting state, set at the top, before anything moves.
      tl.set(slots, { autoAlpha: 0, y: -4 })
        .set(q(".bill-rule"), { scaleX: 0, transformOrigin: "0% 50%" })
        .set(q(".bill-curve"), { drawSVG: "0% 0%" })
        .set(stems, { attr: { y1: DAY.base } })
        .set(head, { opacity: 0 })
        .set(paper, { height: TEAR_MIN })
        // Each word on its own compositor layer, so the rise and the blur
        // are GPU work rather than a repaint of the paragraph per frame.
        .set(words, {
          autoAlpha: 0,
          yPercent: 16,
          filter: "blur(3px)",
          willChange: "transform, opacity, filter",
          force3D: true,
        });

      // The clock crosses the day at a constant speed, drawing the calls it
      // answers behind it. Both the head and the stroke are measured in arc
      // length, so the ink ends exactly under the head at every moment.
      tl.to(head, { opacity: 1, duration: 0.25 }, START)
        .to(
          head,
          {
            duration: RUN,
            ease: "none",
            motionPath: { path: guide, align: guide, alignOrigin: [0.5, 0.5] },
          },
          START,
        )
        .to(q(".bill-curve"), { drawSVG: "0% 100%", duration: RUN, ease: "none" }, START);

      // Each hour stands up as the head reaches it.
      for (let i = 0; i < HOURS; i++) {
        const at = timeAt(i);
        tl.to(
          stems[i],
          { attr: { y1: dayY(hourX(i)) }, duration: 0.45, ease: "power3.out" },
          at,
        );
        tl.call(() => setHour(i + 1), [], at);
      }

      const close = START + RUN;
      ping(tl, q(".bill-ping"), close, 14);
      tl.to(head, { opacity: 0, duration: 0.3 }, close + 0.1);

      // The bill prints in the clock's wake, one line an hour, starting
      // `LEAD` hours behind it — and its last two lines land after the day
      // has closed, which is when they would be said.
      slots.forEach((slot, i) => {
        tl.to(
          slot,
          { autoAlpha: 1, y: 0, duration: 0.3, ease: "power2.out" },
          timeAt(LEAD + i),
        );
      });

      /** Which hour a named slot is printed on, or -1 if it is not there. */
      const slotAt = (sel: string) => {
        const el = q(sel)[0];
        return el ? slots.indexOf(el) : -1;
      };

      const ruleAt = slotAt(".bill-slot-rule");
      if (ruleAt >= 0) {
        // Ruled, rather than faded: a line under a column of figures is a
        // mark somebody made.
        tl.to(
          q(".bill-rule"),
          { scaleX: 1, duration: 0.5, ease: "power2.out" },
          timeAt(LEAD + ruleAt) + 0.1,
        );
      }

      const totalAt = slotAt(".bill-slot-total");
      if (totalAt >= 0) {
        // The paper lengthens with the bill, on the beat the total lands.
        tl.to(
          paper,
          { height: tear, duration: 0.7, ease: "power2.out" },
          timeAt(LEAD + totalAt),
        );
      }

      const asideAt = slotAt(".bill-slot-aside");
      if (asideAt >= 0 && words.length) {
        tl.to(
          words,
          {
            autoAlpha: 1,
            yPercent: 0,
            filter: "blur(0px)",
            duration: 0.6,
            ease: "power2.out",
            stagger: 0.035,
          },
          timeAt(LEAD + asideAt) + 0.1,
        );
      }

      // The finished bill has to be readable before the next business walks
      // in. Written as an empty tween, never as a delay, and the house
      // clock — not this file — decides how long it is.
      tl.to({}, { duration: holdFor(closing) / 1000 });

      tlRef.current = tl;
      return () => {
        tlRef.current = null;
      };
    },
    // Rebuilt per volume, because the tear's depth and the reading time of
    // the closing line both come off it. `revertOnUpdate` because the
    // callback splits text and sets inline styles.
    { scope: scene, dependencies: [volume, taken, reduce], revertOnUpdate: true },
  );

  // Plays while on screen. `kit` is in the deps because the timeline is
  // built asynchronously, after the kit arrives; `volume` because each one
  // gets a timeline of its own, which then needs telling.
  useEffect(() => {
    const tl = tlRef.current;
    if (!tl) return;
    if (inView && !reduce && !taken) tl.play();
    else tl.pause();
  }, [inView, reduce, taken, kit, volume]);

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
                reserved for the two live figures and the clock. */}
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
                "mt-6 h-1.5 w-full cursor-ew-resize appearance-none rounded-full outline-none transition-[background] duration-300 motion-reduce:transition-none",
                "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-pp-ink",
                "[&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_0_1.6px_#000]",
                // Firefox paints its own track behind the element's
                // background and gives the thumb a border of its own.
                "[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent",
                "[&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-[0_0_0_1.6px_#000]",
              )}
            />

            {/* THE DAY. Ten opening hours drawn as the day's own curve,
                with the clock riding it and each hour standing up as the
                clock passes. It is decorative in the strict sense — every
                figure it carries is stated in words below it — so it is
                hidden from the accessibility tree rather than narrated
                twice. */}
            <div aria-hidden className="mt-7 flex items-end gap-3">
              <span
                className={cn(
                  MONO,
                  "w-[52px] shrink-0 pb-2 text-[12px] leading-none tabular-nums text-pp-muted",
                )}
              >
                {DAY_OPEN + hour}:00
              </span>
              <svg
                viewBox={`0 0 ${DAY.w} ${DAY.h}`}
                className="block h-auto min-w-0 flex-1"
                fill="none"
              >
                {/* The day itself: a dotted route, waiting to be walked. */}
                <line
                  x1={DAY.x0}
                  x2={DAY.x1}
                  y1={DAY.base}
                  y2={DAY.base}
                  strokeOpacity="0.3"
                  {...dotted}
                />

                {/* Ghost, then ink: the pair every drawn stroke in this
                    house is made of. */}
                <path
                  d={DAY_CURVE}
                  stroke={INK}
                  strokeOpacity="0.14"
                  strokeWidth={LINE}
                  strokeLinecap="round"
                />
                <path
                  className="bill-curve"
                  d={DAY_CURVE}
                  stroke={INK}
                  strokeWidth={LINE}
                  strokeLinecap="round"
                />
                {/* A path that exists only to carry the clock. */}
                <path className="bill-guide" d={DAY_CURVE} stroke="none" />

                {DAY_SHAPE.map((_, i) => (
                  <line
                    key={`g${i}`}
                    x1={hourX(i)}
                    x2={hourX(i)}
                    y1={dayY(hourX(i))}
                    y2={DAY.base}
                    strokeOpacity="0.22"
                    {...dotted}
                  />
                ))}
                {DAY_SHAPE.map((_, i) => (
                  <line
                    key={`s${i}`}
                    className="bill-stem"
                    x1={hourX(i)}
                    x2={hourX(i)}
                    y1={dayY(hourX(i))}
                    y2={DAY.base}
                    stroke={INK}
                    strokeWidth={LINE}
                    strokeLinecap="round"
                  />
                ))}

                <Node x={DAY.x0} y={dayY(DAY.x0)} hollow r={3.4} />
                <Ping className="bill-ping" x={DAY.x1} y={dayY(DAY.x1)} />
                <Node x={DAY.x1} y={dayY(DAY.x1)} r={3.4} />
                {/* Parked at the origin, invisible, until the path moves it. */}
                <Node className="bill-head" hidden r={3.6} color={VIOLET} />
              </svg>
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
          </div>
        </div>

        {/* THE SLIP. It writes itself while the day runs. */}
        <div>
          <div className="rounded-t-[24px] bg-pp-card">
            <div className="px-6 pt-7 md:px-8 md:pt-8">
              <Printed className="mb-3">
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
                still={reduce}
                label="Minutes included in that fee"
                value={mine.tier.minutes}
                unit="min"
              />

              <BillLine
                still={reduce}
                label="Minutes past the allowance"
                value={mine.over}
                unit="min"
              />

              <BillLine
                still={reduce}
                label={
                  mine.over > 0
                    ? `Those ${num(mine.over)} minutes, at ${cents(mine.tier.overage)} each`
                    : "Nothing past the allowance to bill"
                }
                value={overCost}
                unit="usd"
              />

              <Printed className="bill-slot-rule">
                <div aria-hidden className="bill-rule my-3 h-px bg-pp-hair" />
              </Printed>

              <BillLine
                className="bill-slot-total"
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
              <Printed className="mt-8">
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
                /* The one piece of prose on the slip, and the only thing
                   here that arrives as language rather than as a printed
                   row: this is the shopkeeper talking over the till. */
                <Printed className="bill-slot-aside mt-8">
                  {/* Keyed on the volume so React REPLACES this paragraph
                      when its figures move rather than writing new text
                      into the word spans SplitText put there — which is
                      how a split line ends up reverting to a stale one. */}
                  <p
                    key={callsDay}
                    className="bill-aside border-t border-dashed border-pp-hair pt-4 text-[13px] leading-[21px] text-pretty text-pp-muted"
                  >
                    Worth knowing: staying on {cheapest.tier.name} and paying
                    for the extra {num(cheapest.over)} minutes would come to{" "}
                    {money(cheapest.total)} —{" "}
                    {money(mine.total - cheapest.total)} less a month. You would
                    be running past your allowance every month to do it, which
                    is why it is not what we put on the receipt. Your call.
                  </p>
                </Printed>
              )}

              {/* The trial closes the slip rather than opening a panel of
                  its own. It is the last line of a bill you have not been
                  sent yet, which is the only place on the page it means
                  anything. */}
              <Printed className="mt-8 pb-8">
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

          {/* The slip's bottom edge, torn, and as long as the bill is.
              While the scene runs, the timeline owns this height and grows
              it on the beat the total lands. Once the reader owns the
              slider, a CSS transition takes it over — a transition and a
              tween writing the same property would only fight. */}
          <span
            aria-hidden
            className={cn(
              "bill-tear block w-full bg-pp-card",
              taken &&
                "transition-[height] duration-500 motion-reduce:transition-none",
            )}
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
