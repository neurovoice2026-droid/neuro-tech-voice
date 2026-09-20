"use client";

import { useEffect, useRef, useState } from "react";
import type { gsap } from "gsap";
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
import {
  BG,
  DOTS,
  LINE,
  MUTED,
  Node,
  Ping,
  ping,
  svgProps,
  useSvgId,
  VIOLET,
} from "./product/line-figure";
import { useKitContext, useMotionKit } from "./product/motion-kit";
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
 * that changes two things about how the argument is drawn:
 *
 *  · **This is the page's one heavy object, and on white weight is a
 *    shadow rather than a glow.** The panel is white stock lifted off the
 *    page with the house ring-and-lift shadow; the featured rung is told
 *    apart by the card grey underneath it and a violet rail across its
 *    top, not by a tinted wash. A dark plate here would read as a hole
 *    cut in the page.
 *  · **Violet is reserved for the comparison.** The eyebrow, the "% under"
 *    badge, the ticks, the rate line and our own bars carry #551a89;
 *    everything else is ink and muted. Colouring every number violet would
 *    leave the one number that is an argument looking like decoration.
 *
 * THE MOVEMENT: THE SLOPE, DRAWN ONCE, AND THE GAP IT OPENS.
 *
 * This section claimed a falling rate in words and then printed five
 * unconnected columns, which is the one shape that cannot show a slope.
 * So the slope is now the section's signature object, drawn across the top
 * of the panel as a figure the five columns stand under.
 *
 * A dotted muted line is laid flat across the whole panel first: the rate
 * the voice platforms charge, the same at every rung, which is precisely
 * why it is a straight line and ours is not. Our rate is plotted as a
 * share of theirs — the one number the billing toggle cannot move, because
 * yearly takes the same two months off both sides — so the picture is the
 * comparison and not our own list price. A head then sets off from Starter
 * and walks the five rungs: the violet line draws behind it as it goes, it
 * stops on each rung to ping it and ink its node, and the field between
 * the two lines widens behind it, rung by rung. That widening field is the
 * "% under" badge said once, continuously, instead of five times in five
 * boxes. At Growth and at Scale — the two rungs where a plan of theirs
 * costs exactly what a plan of ours costs — the head's arrival is also
 * what sets the matched bars below drawing, so the minute-for-minute proof
 * lands on the rung it proves rather than on a delay somebody picked.
 *
 * One GSAP timeline owns all of it. SplitText puts the heading's claim up
 * as language a beat before the figure starts proving it; DrawSVG draws
 * the rate line, because a rate line should be drawn and not faded in;
 * MotionPath carries the head along the very path it is drawing, so the
 * two are the same event by construction rather than by two durations
 * that happen to agree. The rival's line is dotted, so it grows by its own
 * end point instead — DrawSVG on a dashed stroke solidifies it.
 *
 * It plays once and rests on its ending, fully drawn. A price list that
 * re-ran its own argument forever would be a screensaver, and the section
 * already refuses that for the matched bars.
 *
 * The clock is still `product/timing`: each rung is held for `holdFor` of
 * the text it just put on screen, so the walk runs at reading pace rather
 * than at a number somebody liked. The kit is fetched only when the
 * section is near, and only for a reader who has not asked for less
 * motion; `useInView` plays and pauses the timeline, and a hidden tab
 * stops it because nothing here is driven by anything but the frame clock.
 * The first pointer, focus or key the reader spends inside the panel runs
 * the timeline to its end and pauses it for good — hovering or tabbing a
 * column then lights it and ticks its unlocks in, and the walk never
 * starts again. With reduced motion GSAP is never fetched at all: the
 * figure is authored to rest complete — line drawn, field open, every node
 * inked, both bars at length — with the spotlight on the recommended rung
 * and no timer running anywhere.
 *
 * No scene band. This is hairlines and figures on white stock, and the
 * legibility of a price list is the whole point of it.
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

/* ------------------------------------------------------------------ *
 * The figure: the rate ladder, in coordinates.
 *
 * `from` marks the rung that is negotiated rather than listed, so the
 * figure plots the five that are — and each rung sits at the centre of its
 * own column, which is what lets the picture and the price list be read as
 * one object.
 * ------------------------------------------------------------------ */

const LISTED = TIERS.filter((t) => !t.from);
const FEATURED_AT = Math.max(
  0,
  LISTED.findIndex((t) => t.featured),
);

const W = 960;
const H = 132;
/** Air at each end, so the rival's flat line runs past the outer rungs. */
const PAD = 40;
/** The rival's line, and the top of the figure's scale. */
const RIVAL_Y = 34;
/** Units of drop per 1.0 of their rate given back. Sets the slope's pitch. */
const FALL = 169;

/** The centre of column `i`, in the figure's own units. */
const columnX = (i: number) => (W / LISTED.length) * (i + 0.5);

/**
 * Our rate as a share of theirs. Yearly scales both sides by the same two
 * months, so this number — and therefore the whole figure — is the one
 * thing on the panel the billing toggle cannot move.
 */
const share = (t: Tier) => t.monthly / t.minutes / PRICING_RIVAL.perMinute;

const RUNGS = LISTED.map((t, i) => ({
  x: columnX(i),
  y: RIVAL_Y + (1 - share(t)) * FALL,
}));

const LEGS = RUNGS.slice(0, -1).map((a, i) => {
  const b = RUNGS[i + 1];
  return {
    d: `M${a.x.toFixed(2)} ${a.y.toFixed(2)} L${b.x.toFixed(2)} ${b.y.toFixed(2)}`,
    len: Math.hypot(b.x - a.x, b.y - a.y),
  };
});

/** Their line across the top, ours back along the rungs: the saving, as an area. */
const FIELD = `M${RUNGS[0].x.toFixed(2)} ${RIVAL_Y} L${RUNGS[RUNGS.length - 1].x.toFixed(2)} ${RIVAL_Y} ${[
  ...RUNGS,
]
  .reverse()
  .map((r) => `L${r.x.toFixed(2)} ${r.y.toFixed(2)}`)
  .join(" ")} Z`;

/* ------------------------------------------------------------------ *
 * The score.
 *
 * Every hold is `holdFor` of the text that rung has just put on screen —
 * the same clock the rest of this site walks to — and every move between
 * two rungs is one house-length travel. The arrival times fall out of the
 * two; nothing here is a number somebody nudged twice.
 * ------------------------------------------------------------------ */

/** What a rung says when the spotlight lands on it. */
const spokenAt = (t: Tier) =>
  [
    t.name,
    `${cents(effectiveRate(t, false))} a minute`,
    `${underRival(t, false)}% under ${PRICING_RIVAL.name}`,
    ...t.unlocks,
  ].join(" ");

const HOLD = LISTED.map((t) => holdFor(spokenAt(t)) / 1000);
/** The claim, then their flat rate, before the walk sets off. */
const LEAD = 1.6;
/** One rung to the next. */
const LEG = 0.8;

const ARRIVE = (() => {
  const out: number[] = [];
  let t = LEAD;
  LISTED.forEach((_, i) => {
    out[i] = t;
    t += HOLD[i] + (i < LISTED.length - 1 ? LEG : 0);
  });
  return out;
})();

const END = ARRIVE[ARRIVE.length - 1] + HOLD[HOLD.length - 1];

/** The two matched-price cards, each tied to the rung it proves. */
const MATCHED = PRICING_RIVAL.matched.map((m) => ({
  ...m,
  rung: Math.max(
    0,
    LISTED.findIndex((t) => t.monthly === m.monthly),
  ),
}));

/**
 * The slope, drawn across the top of the panel.
 *
 * Ghost first, ink second — the route is there faintly from the start and
 * the walk visits it, which is how every drawn stroke in this house is
 * built. With `still` the whole figure is authored complete: the line
 * carries no dash offset, the field's clip is open to full width, their
 * line already reaches the far edge and every node is filled.
 */
function RateLadder({ annual, still }: { annual: boolean; still: boolean }) {
  const clip = useSvgId("rl-clip");
  const rivalRate = PRICING_RIVAL.perMinute * (annual ? ANNUAL : 1);

  return (
    <div className="aspect-[960/132] w-full border-b border-pp-rule">
      <svg {...svgProps(W, H)}>
        <defs>
          <clipPath id={clip}>
            {/* The field opens behind the head, rung by rung. */}
            <rect className="rl-clip" x="0" y="0" width={still ? W : 0} height={H} />
          </clipPath>
        </defs>

        {/* Everything between their rate and ours. This is the badge on
            every column, said once and continuously. */}
        <path d={FIELD} fill={VIOLET} fillOpacity="0.07" clipPath={`url(#${clip})`} />

        {/* Dotted, so it grows by its end point rather than by DrawSVG,
            which would solidify it. Flat is the whole point of it. */}
        <line
          className="rl-rival"
          x1={PAD}
          x2={still ? W - PAD : PAD}
          y1={RIVAL_Y}
          y2={RIVAL_Y}
          stroke={MUTED}
          strokeWidth={LINE}
          strokeDasharray={DOTS}
          strokeLinecap="round"
        />

        {LEGS.map((leg, i) => (
          <path
            key={`ghost-${i}`}
            d={leg.d}
            stroke={VIOLET}
            strokeOpacity="0.14"
            strokeWidth={LINE}
            strokeLinecap="round"
          />
        ))}
        {LEGS.map((leg, i) => (
          <path
            key={`ink-${i}`}
            className={`rl-ink rl-leg-${i}`}
            d={leg.d}
            stroke={VIOLET}
            strokeWidth={LINE}
            strokeLinecap="round"
            strokeDasharray={`${leg.len.toFixed(2)} ${leg.len.toFixed(2)}`}
            strokeDashoffset={still ? 0 : leg.len.toFixed(2)}
          />
        ))}

        {RUNGS.map((r, i) => (
          <Ping key={`ping-${i}`} className={`rl-ping-${i}`} x={r.x} y={r.y} color={VIOLET} />
        ))}
        {RUNGS.map((r, i) => (
          <Node
            key={`node-${i}`}
            x={r.x}
            y={r.y}
            r={4}
            color={VIOLET}
            hollow={!still}
            coreClassName={`rl-core rl-core-${i}`}
          />
        ))}

        {/* Parked at the origin and invisible until the walk sets off. */}
        <Node className="rl-head" hidden r={3.4} color={VIOLET} />

        <text
          className="rl-cap rl-cap-rival"
          x={PAD}
          y={RIVAL_Y - 10}
          fill={MUTED}
          fontSize="12.5"
          opacity={still ? 1 : 0}
        >
          {PRICING_RIVAL.name}, {cents(rivalRate)} a minute at every rung
        </text>
        <text
          className="rl-cap rl-cap-ours"
          x={PAD}
          y={RUNGS[0].y - 13}
          fill={VIOLET}
          fontSize="12.5"
          opacity={still ? 1 : 0}
        >
          Our rate
        </text>
      </svg>
    </div>
  );
}

/**
 * One line of what a rung adds. When the spotlight lands on the column
 * these tick in one after another, which is the rung listing itself
 * rather than sitting there already listed. The tick is a stagger on the
 * lit column's rows, so the reader's hover and the walk are the same
 * mechanism; the colour change stays a CSS transition, which is all a
 * colour change ever needs.
 */
function Unlock({ children, lit }: { children: React.ReactNode; lit: boolean }) {
  return (
    <li className="pl-unlock flex items-start gap-2.5 text-[13px] leading-5 text-pp-muted">
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
  index,
  annual,
  first,
  lit,
  still,
  onTake,
}: {
  tier: Tier;
  index: number;
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
      data-rung={index}
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
        {!first ? <Unlock lit={lit}>Everything below, plus</Unlock> : null}
        {tier.unlocks.map((u) => (
          <Unlock key={u} lit={lit}>
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
 * going past it, and the gap left over is the claim. They draw at the
 * moment the walk above reaches the rung they belong to, and then stay
 * drawn — a comparison that kept re-running would be a screensaver.
 *
 * It is a transform, never a width: a scale is composited, and nothing
 * beside the bar moves when it fills.
 */
function MatchedRung({
  monthly,
  theirs,
  theirPlan,
  still,
  card,
}: {
  monthly: number;
  theirs: number;
  theirPlan: string;
  still: boolean;
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
            `rg-gain-${card}`,
            "text-[11px] leading-4 font-medium tracking-[0.1em] tabular-nums text-pp-accent uppercase",
          )}
          style={{ opacity: still ? 1 : 0 }}
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
        ].map((row) => (
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
              {/* No Tailwind `scale-*` here: Tailwind v4 writes the
                  standalone `scale` property, which would compose on top of
                  the `transform` GSAP writes and multiply it back to zero.
                  The resting value is set inline instead. */}
              <div
                data-fill={(row.minutes / max).toFixed(4)}
                className={cn(
                  `rg-bar-${card}`,
                  "h-full w-full origin-left rounded-full",
                  row.ours ? "bg-pp-accent" : "bg-pp-muted/45",
                )}
                style={{
                  transform: `scaleX(${still ? row.minutes / max : 0})`,
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
  // Two margins, two jobs: `near` fetches GSAP, `inView` plays the timeline.
  const inView = useInView(rootRef, "-10% 0px");
  const near = useInView(rootRef, "25% 0px");
  // `near && !reduce`, because the figure below is authored to rest
  // complete: a reader who asked for less motion never downloads GSAP.
  const kit = useMotionKit(near && !reduce);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  const negotiated = TIERS.find((t) => t.from);

  /** The rung the spotlight is on, and whether the reader owns it now. */
  const [at, setAt] = useState(0);
  const [taken, setTaken] = useState(false);

  /**
   * The walk, as one timeline.
   *
   * The resting state is set whole at t = 0, then the heading's claim goes
   * up as language, their flat rate is laid across the panel, and the head
   * walks the rungs — drawing the line it travels, opening the field
   * behind it, pinging and inking each rung on arrival, and setting the
   * matched bars below going at the two rungs those bars are about.
   */
  useKitContext(
    kit,
    ({ gsap, SplitText }) => {
      if (reduce) return;
      const q = gsap.utils.selector(rootRef);

      // `q` is typed off the scope, which is a div; the figure inside it is
      // SVG, so the path is named at the grab site.
      const legs = LEGS.map(
        (_, i) => q(`.rl-leg-${i}`)[0] as unknown as SVGPathElement,
      );
      const head = q(".rl-head");
      if (!legs[0] || head.length === 0) return;

      // Split for motion only: the words stay plain text to a screen
      // reader, and the context reverts the split — never call .revert().
      // Nothing above the fold is split here, so by the time `near` fires
      // and the kit arrives on idle the webfont's line boxes are final.
      const title = q(".pl-title")[0];
      const words = title
        ? SplitText.create(title, { type: "words", aria: "none" }).words
        : [];
      // Each word on its own compositor layer, so the fade, the rise and
      // the light blur are GPU work rather than a repaint of the line.
      if (words.length)
        gsap.set(words, {
          willChange: "transform, opacity, filter",
          force3D: true,
        });

      const tl = gsap.timeline({ paused: true });

      // The whole resting state, at the top, before anything moves.
      tl.set(q(".rl-ink"), { drawSVG: "0% 0%" }, 0)
        .set(q(".rl-clip"), { attr: { width: 0 } }, 0)
        .set(q(".rl-rival"), { attr: { x2: PAD } }, 0)
        .set(q(".rl-cap"), { opacity: 0 }, 0)
        .set(q(".rl-core"), { attr: { fill: BG } }, 0)
        .set(head, { opacity: 0 }, 0);

      if (words.length)
        tl.fromTo(
          words,
          { autoAlpha: 0, yPercent: 16, filter: "blur(3px)" },
          {
            autoAlpha: 1,
            yPercent: 0,
            filter: "blur(0px)",
            duration: 0.9,
            ease: "power2.out",
            stagger: 0.06,
          },
          0,
        );

      // Their rate, laid flat across the whole panel.
      tl.to(
        q(".rl-rival"),
        { attr: { x2: W - PAD }, duration: 0.9, ease: "power2.out" },
        0.7,
      )
        .to(q(".rl-cap-rival"), { opacity: 1, duration: 0.3 }, 1.2)
        .to(q(".rl-cap-ours"), { opacity: 1, duration: 0.3 }, LEAD - 0.25)
        // The head is born on Starter rather than flying in from nowhere.
        .set(head, { x: RUNGS[0].x, y: RUNGS[0].y }, LEAD - 0.4)
        .to(head, { opacity: 1, duration: 0.3 }, LEAD - 0.4)
        .to(
          q(".rl-clip"),
          { attr: { width: RUNGS[0].x }, duration: 0.5, ease: "power2.out" },
          ARRIVE[0],
        );

      // An arrival: the rung inks, rings, and takes the spotlight.
      RUNGS.forEach((_, i) => {
        tl.set(q(`.rl-core-${i}`), { attr: { fill: VIOLET } }, ARRIVE[i]);
        ping(tl, q(`.rl-ping-${i}`), ARRIVE[i], 20);
        tl.call(() => setAt(i), [], ARRIVE[i]);
      });

      // A leg: one ease, one duration, shared by the draw, the traveller
      // and the field, so the three cannot drift apart.
      LEGS.forEach((_, i) => {
        const depart = ARRIVE[i] + HOLD[i];
        tl.to(
          legs[i],
          { drawSVG: "0% 100%", duration: LEG, ease: "sine.inOut" },
          depart,
        )
          .to(
            head,
            {
              duration: LEG,
              ease: "sine.inOut",
              motionPath: {
                path: legs[i],
                align: legs[i],
                alignOrigin: [0.5, 0.5],
              },
            },
            depart,
          )
          .to(
            q(".rl-clip"),
            {
              attr: { width: RUNGS[i + 1].x },
              duration: LEG,
              ease: "sine.inOut",
            },
            depart,
          );
      });

      // The minute-for-minute proof, at the rung it proves.
      MATCHED.forEach((m, card) => {
        const when = ARRIVE[m.rung] + 0.25;
        tl.fromTo(
          q(`.rg-bar-${card}`),
          { scaleX: 0 },
          {
            scaleX: (_i: number, el: Element) =>
              Number((el as HTMLElement).dataset.fill ?? 1),
            transformOrigin: "0% 50%",
            duration: 0.7,
            ease: "power2.out",
            stagger: 0.16,
            immediateRender: false,
          },
          when,
        ).to(
          q(`.rg-gain-${card}`),
          { autoAlpha: 1, duration: 0.4 },
          when + 1.2,
        );
      });

      // The walk is over; the figure rests drawn. A hold, written as an
      // empty tween — never as a delay.
      tl.to(head, { opacity: 0, duration: 0.3 }, END).to({}, { duration: 0.6 });

      tlRef.current = tl;
      return () => {
        tlRef.current = null;
      };
    },
    // `revertOnUpdate` because the callback splits text and sets inline
    // styles; `reduce` is live, so flipping it hands the markup back its
    // own complete resting state.
    { scope: rootRef, dependencies: [reduce], revertOnUpdate: true },
  );

  /**
   * The lit column lists itself. One stagger, driven by whichever put the
   * spotlight there — the walk, a hover or a tab — so there is one
   * mechanism and not two.
   */
  useKitContext(
    kit,
    ({ gsap }) => {
      if (reduce) return;
      const q = gsap.utils.selector(rootRef);
      const rows = q(`[data-rung="${at}"] .pl-unlock`);
      if (rows.length === 0) return;
      gsap.fromTo(
        rows,
        { autoAlpha: 0, y: 6 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.45,
          ease: "power2.out",
          stagger: 0.07,
        },
      );
    },
    { scope: rootRef, dependencies: [at, reduce], revertOnUpdate: true },
  );

  /**
   * Plays while on screen. `kit` is in the deps because the timeline is
   * built asynchronously, after the kit arrives.
   *
   * The reader's first move ends the argument rather than interrupting it:
   * the timeline is run to its end and paused for good, so the figure they
   * are handed is the finished one and the spotlight is theirs.
   */
  useEffect(() => {
    const tl = tlRef.current;
    if (!tl) return;
    if (taken) {
      tl.progress(1).pause();
      return;
    }
    if (inView && !reduce) tl.play();
    else tl.pause();
  }, [inView, reduce, taken, kit]);

  /** Reduced motion gets the end of the argument, drawn, straight away. */
  useEffect(() => {
    if (reduce) setAt(FEATURED_AT);
  }, [reduce]);

  const take = () => setTaken(true);

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
          <div className="max-w-[640px]">
            <SectionHeading
              eyebrow={PRICING_PLANS_INTRO.eyebrow}
              titleClassName="pl-title"
            >
              {PRICING_PLANS_INTRO.title}
            </SectionHeading>
            <p className="mt-5 text-[17px] leading-7 text-pretty text-pp-muted">
              {PRICING_PLANS_INTRO.sub}
            </p>
          </div>

          <div className="shrink-0">
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

        <div className="mt-12 overflow-hidden rounded-[28px] bg-white shadow-[0_0_0_1px_rgb(24_16_40/0.07),0_32px_64px_-40px_rgb(24_16_40/0.5)] md:mt-16">
          {/* Five columns do not survive a phone. The scroller keeps the
              comparison intact rather than restacking it into five
              unrelated cards, which is the one shape that makes a price
              list impossible to read across. The figure scrolls with them,
              because a rung and its point on the line are one thing. */}
          <div className="overflow-x-auto [scrollbar-width:thin]">
            <div className="min-w-[960px]">
              <RateLadder annual={annual} still={reduce} />
              <div className="grid grid-cols-5 items-stretch">
                {LISTED.map((tier, i) => (
                  <PlanColumn
                    key={tier.id}
                    tier={tier}
                    index={i}
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
          {MATCHED.map((m, i) => (
            <MatchedRung
              key={m.monthly}
              monthly={m.monthly}
              theirs={m.theirs}
              theirPlan={m.theirPlan}
              still={reduce}
              card={i}
            />
          ))}
        </div>

        <p className="mt-10 max-w-[860px] text-[12px] leading-[20px] text-pp-muted">
          {PRICING_PLANS_NOTE}
        </p>
      </div>
    </Frame>
  );
}
