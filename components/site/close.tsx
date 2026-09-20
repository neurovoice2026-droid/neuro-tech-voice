"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { gsap } from "gsap";
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
import { ping } from "./product/line-figure";
import { useKitContext, useMotionKit } from "./product/motion-kit";
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
 * **The signature movement: a reading head, and the mark it leaves.**
 * This section used to move because the reader scrolled — figures
 * counting themselves in, receipts arriving on a scroll-bound cascade,
 * rules wiping open, the imperative rising under a mask. All of that was
 * an entrance: the page performed for the act of being reached, and said
 * nothing while it did it. What replaced it moved because React changed
 * an integer and a violet quarter jumped a column's width along the
 * fence, which is the audit *described* rather than the audit happening.
 *
 * What runs here now is one object on one GSAP timeline. A head travels
 * the four receipts along a route, comes to rest over each figure, and
 * rules a line under it. The route is a real path, measured off the grid
 * the receipts are actually laid out in, so the same walk is right at
 * either width: at four columns it runs the top fence in one straight
 * line; at two it reaches the end of the first row, drops a lane and
 * carries back to the left, which is what a reading head does. This is
 * the only place on the page where the reading head the whole homepage is
 * built on can be shown literally, at the end, as a summary of itself —
 * and the head *is* the transport, where the violet quarter was a
 * rectangle standing in for one.
 *
 * `MotionPathPlugin` carries the head along the route; `DrawSVGPlugin`
 * draws each receipt's mark and takes it away again as the head leaves;
 * every arrival is punctuated by the same `ping` every other figure on
 * this site uses. The clock is the house's and is unchanged: a receipt
 * holds for `holdFor(label)`, as long as its own sentence takes to read at
 * 230 words a minute and never under 1.4s. Travel is derived from the
 * distance between two receipts at one fixed speed, so the short hop and
 * the long one are the same journey and the only difference is how far
 * the head had to go.
 *
 * **It walks once, and rests on the last receipt.** The version before
 * this looped, on the argument that any of the four can be picked up and
 * checked at any time. The anchors say that, and the reader's own hand
 * says it better; a head going round and round is a screensaver, and
 * these four are evidence. So the pass ends where it should — on the
 * daily cost, directly above the block that asks for it.
 *
 * Colour stays CSS. The ink on the live figure, its label and its anchor
 * are `transition-colors` at the house's 300/500, because a state change
 * that small is not worth a tween. Nothing counts: a number ticking up is
 * a number being animated, and these four are meant to be read.
 *
 * **The reader takes it, permanently.** Pointer, focus or keyboard on any
 * receipt pauses the walk for good and glides the head to that column —
 * the timeline is scrubbed to that receipt's own stop rather than reset,
 * so the head, the marks and the ink all still agree wherever the reader
 * leaves it. The four receipts are then a row they step through
 * themselves, arrow keys and tab included. GSAP is fetched a quarter
 * screen early and never before, the walk plays only while the section is
 * on screen, and the context reverts every tween on unmount, so the page
 * in a background tab is doing nothing at all. Reduced motion never
 * downloads GSAP at all: the marks rest drawn, the whole row reads live at
 * once — the scene's final, most informative state — and the head never
 * appears.
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
 * The walk.
 *
 * Distances are in CSS pixels, because the route is measured off the
 * grid rather than authored in a viewBox: the overlay carries no
 * viewBox, so one user unit is one pixel and nothing has to be scaled.
 * ------------------------------------------------------------------ */

/** Pixels a second, so a short hop and a long one read at one pace. */
const SPEED = 520;
const TRAVEL_MIN = 0.4;
const TRAVEL_MAX = 1;

/** Where the head parks on a receipt: over the middle of its 48px mark. */
const PARK = 24;

/**
 * The lane a second row is read on.
 *
 * The first row's lane is the top fence itself, which is why the head
 * replaces the quarter that used to slide along it. A second row only
 * exists below `md`, where the grid is two columns with a 40px row gap,
 * so its lane is the middle of that gap — a fence the layout implies and
 * does not draw.
 */
const LANE_LIFT = 20;

/* ------------------------------------------------------------------ *
 * The section.
 * ------------------------------------------------------------------ */

export function Close() {
  const rootRef = useRef<HTMLDivElement>(null);
  // Two margins, two jobs: `near` fetches GSAP, `inView` plays the walk.
  const inView = useInView(rootRef, "-10% 0px");
  const near = useInView(rootRef, "25% 0px");
  const reduce = usePrefersReducedMotion();
  // `near && !reduce`: with reduced motion the markup already rests in the
  // scene's finished state, so GSAP is never downloaded.
  const kit = useMotionKit(near && !reduce);

  const count = CTA_CLOSE.receipts.length;
  /** Which receipt is being read. */
  const [head, setHead] = useState(0);
  /** True once the reader has touched the row; the walk never restarts. */
  const [taken, setTaken] = useState(false);
  /**
   * The grid's measured box.
   *
   * The route is real geometry, so anything that reflows the receipts — a
   * rotation, a breakpoint, a font landing late — has to redraw it. The
   * string is a cheap identity: an unchanged box sets the same value and
   * React does not re-render, so the timeline is not rebuilt for nothing.
   */
  const [box, setBox] = useState("");

  const tlRef = useRef<gsap.core.Timeline | null>(null);
  /** Glides the head to a receipt. Null until the walk has been built. */
  const seekRef = useRef<((i: number) => void) | null>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBox(`${Math.round(width)}x${Math.round(height)}`);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useKitContext(
    kit,
    ({ gsap }) => {
      const root = rootRef.current;
      if (!root) return;
      // Typed back to `Element[]`: the scope is a div, so the selector's
      // own return type is the HTML element union and everything drawn in
      // here is SVG.
      const q: (sel: string) => Element[] = gsap.utils.selector(rootRef);
      const route = q(".cl-route")[0] as SVGPathElement | undefined;
      const rider = q(".cl-head")[0] as SVGGElement | undefined;
      const marks = q(".cl-mark") as SVGLineElement[];
      const pings = q(".cl-ping") as SVGCircleElement[];
      const cells = q(".cl-cell") as HTMLElement[];
      if (!route || !rider || cells.length !== count || marks.length !== count) return;

      if (reduce) {
        // Nothing walks: every receipt reads as already checked. Only
        // reachable if the setting is turned on while the page is open —
        // `useMotionKit` above declines to fetch GSAP in the first place.
        gsap.set(marks, { opacity: 1, drawSVG: "0% 100%" });
        gsap.set(rider, { opacity: 0 });
        return;
      }

      // Where the head parks on each receipt, and which lane it reads on.
      const base = root.getBoundingClientRect();
      const parks = cells.map((cell) => {
        const b = cell.getBoundingClientRect();
        return { x: b.left - base.left + PARK, top: b.top - base.top };
      });
      const firstTop = parks[0].top;
      const points = [
        // A lead-in from the left edge, so the head arrives from the page
        // above rather than switching itself on over the first figure.
        { x: 0, y: 0.5 },
        ...parks.map((p) => ({
          x: p.x,
          y: Math.abs(p.top - firstTop) < 1 ? 0.5 : p.top - LANE_LIFT,
        })),
      ];

      const legs = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
      const run = legs.reduce((a, b) => a + b, 0);
      if (run < 1) return;
      // How far along the route each receipt sits, so one tween can carry
      // the head exactly from one stop to the next.
      const at: number[] = [0];
      legs.forEach((leg, i) => at.push(at[i] + leg / run));

      // Through `attr`, which is how this house writes an SVG attribute,
      // and set here rather than in the timeline: MotionPath reads the
      // geometry when its tween is built, so the `d` has to be there
      // first — and a `set` outside the timeline is applied at once.
      gsap.set(route, {
        attr: {
          d: points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" "),
        },
      });
      points.slice(1).forEach((p, i) => gsap.set(pings[i], { attr: { cx: p.x, cy: p.y } }));

      const tl = gsap.timeline({ paused: true });
      /** The time each receipt is parked on, for the reader's own seeks. */
      const stops: number[] = [];

      // The whole resting state, set at the top, before anything moves.
      tl.set(marks, { opacity: 1, drawSVG: "0% 0%" }, 0)
        .set(rider, { opacity: 0 }, 0)
        .to(rider, { opacity: 1, duration: 0.3 }, 0.15);

      let t = 0.15;
      for (let i = 0; i < count; i++) {
        const travel = gsap.utils.clamp(TRAVEL_MIN, TRAVEL_MAX, legs[i] / SPEED);
        tl.to(
          rider,
          {
            duration: travel,
            ease: "power2.inOut",
            motionPath: {
              path: route,
              align: route,
              alignOrigin: [0.5, 0.5],
              start: at[i],
              end: at[i + 1],
            },
          },
          t,
        );

        const arrives = t + travel;
        tl.call(() => setHead(i), [], arrives);
        ping(tl, [pings[i]], arrives);
        tl.to(marks[i], { drawSVG: "0% 100%", duration: 0.5, ease: "power2.out" }, arrives);
        stops.push(arrives + 0.5);

        // The hold is the receipt's own sentence, at reading pace.
        t = arrives + holdFor(CTA_CLOSE.receipts[i].label) / 1000;
        // The mark belongs to the head and leaves with it — except the
        // last, which is what the pass comes to rest on.
        if (i < count - 1) {
          tl.to(marks[i], { drawSVG: "100% 100%", duration: 0.4, ease: "power2.inOut" }, t - 0.4);
        }
      }
      // A rest at the end, written as an empty tween rather than a delay.
      tl.to({}, { duration: 0.6 });

      // The reader's seek: scrubbed, not cut, so the head is seen going to
      // the receipt they asked for and the marks stay in step with it.
      let glide: gsap.core.Tween | null = null;
      seekRef.current = (i: number) => {
        glide?.kill();
        tl.pause();
        glide = tl.tweenTo(stops[i], { duration: 0.5, ease: "power2.inOut" });
      };

      // A reflow rebuilds the walk from new measurements. If the reader
      // already has it, it goes straight back to the receipt they left it
      // on rather than to the start of a pass they stopped.
      if (taken) tl.time(stops[head]);

      tlRef.current = tl;
      return () => {
        glide?.kill();
        seekRef.current = null;
        tlRef.current = null;
      };
    },
    // The callback sets inline styles and measures, so the context reverts
    // before every rebuild.
    { scope: rootRef, dependencies: [box, reduce], revertOnUpdate: true },
  );

  // Plays while on screen, and never again once the reader has taken it.
  // `kit` and `box` are in the deps because the timeline is built
  // asynchronously and rebuilt on a reflow; each new one needs telling.
  useEffect(() => {
    const tl = tlRef.current;
    if (!tl) return;
    if (inView && !reduce && !taken) tl.play();
    else tl.pause();
  }, [inView, reduce, taken, kit, box]);

  const take = useCallback((i: number) => {
    setTaken(true);
    setHead(i);
    seekRef.current?.(i);
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
        <div ref={rootRef} className="relative mt-8 md:mt-10">
          {/* The head and its route, laid over the grid rather than drawn
              inside it. No viewBox, so one user unit is one CSS pixel and
              the measured route needs no scaling at any width. The route
              is never painted: it exists to be travelled, like every other
              motion guide in this house. */}
          <svg
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
            fill="none"
          >
            <path className="cl-route" stroke="none" />
            {CTA_CLOSE.receipts.map((r) => (
              <circle
                key={r.label}
                className="cl-ping"
                r="4.4"
                stroke="var(--pp-accent)"
                strokeWidth="1.6"
                opacity="0"
              />
            ))}
            {/* Parked at the origin and invisible until the path moves it.
                The disc of page stock behind it is the house's: the fence
                stops short of the head instead of running under it. */}
            <g className="cl-head" opacity="0">
              <circle r="8" fill="var(--pp-bg)" />
              <circle r="3.4" fill="var(--pp-accent)" />
            </g>
          </svg>

          {/* The upper fence. It is also the first row's lane: the head
              rides along it, where a violet quarter used to jump a column
              at a time — and below md, where the grid is two columns and
              that quarter had to be hidden because it would have lied
              about which cell was live, the head simply drops a lane and
              carries on. */}
          <div aria-hidden className="h-px bg-pp-rule" />

          <div className="grid grid-cols-2 gap-x-8 gap-y-10 py-10 md:grid-cols-4 md:gap-x-12 md:py-12">
            {CTA_CLOSE.receipts.map((r, i) => {
              const live = isLive(i);
              return (
                <div
                  key={r.label}
                  className="cl-cell flex flex-col items-start"
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
                  {/* The head's own mark under the figure it is reading,
                      drawn rather than scaled. The ghost and ink pair
                      every stroke in this house is made of: the faint copy
                      holds the mark's place — an unread receipt is still a
                      printed one — and the ink copy is drawn over it,
                      left to right, as the head arrives, and retracted
                      through its far end as the head leaves. With no
                      GSAP, and so with reduced motion, the ink has no
                      dash of its own and simply rests drawn. */}
                  <svg
                    aria-hidden
                    className="mt-3 block overflow-visible"
                    width="48"
                    height="2"
                    viewBox="0 0 48 2"
                    fill="none"
                  >
                    <line
                      x1="1"
                      y1="1"
                      x2="47"
                      y2="1"
                      stroke="var(--pp-accent)"
                      strokeOpacity="0.2"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                    />
                    <line
                      className="cl-mark opacity-0 motion-reduce:opacity-100"
                      x1="1"
                      y1="1"
                      x2="47"
                      y2="1"
                      stroke="var(--pp-accent)"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                    />
                  </svg>
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
