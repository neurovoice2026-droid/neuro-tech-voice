"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  motion,
  animate,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "framer-motion";
import { ArrowRight } from "lucide-react";
import {
  CALL_FATE,
  DECAY_MAX,
  LEAD_DECAY,
  SHELF_CLAIM,
  STATS_INTRO,
  WHY_SOURCES,
  qualifyOddsAt,
} from "@/lib/site";
import { cn } from "@/lib/utils";
import { Frame, PillLink, Rule, SectionHeading } from "./product/primitives";
import { MaskRise, Reveal } from "./reveal";

/**
 * Somebody else's numbers — the shelf, and the drop off the end of it.
 *
 * Nothing in this section is ours. That is its only asset, and every
 * decision below is in service of not spending it.
 *
 * **Set in the light `pp` system**, like the twenty-one other marketing
 * routes. That is not a coat of paint on the old plate: a chart on white
 * can be drawn an order of magnitude finer than one on ink, and most of
 * the redraw below is spending that. Where the dark version needed a
 * 2.6px stroke and a lit gradient to survive a black field, this one is a
 * 1.75px line, hairline axes at `--pp-rule`'s own hue, and measured points
 * as small solid marks knocked out of the page colour — the same node
 * grammar the product and industry figures already draw. Nothing glows.
 * On white a glow is dirt.
 *
 * **Colour is the page's law, not taste.** Black is the cited measurement
 * — the curve, its area, its three points. Violet `--pp-accent` is ours,
 * and inside this plot it is spent on exactly one mark: `SHELF_CLAIM`. A
 * reviewer checking the citations can find the one line that has none by
 * looking for the only coloured thing in the frame. (Accent appears once
 * more below the plot, on the rang-out share, where it is emphasis in
 * prose rather than a mark on somebody else's graph.)
 *
 * **The axis is the rebuild, and it is kept.** An earlier version put the
 * whole thirty minutes on one logarithmic scale from one second, which
 * sounds rigorous and is in fact the opposite. `ln 300 / ln 1800` is
 * 0.761: three quarters of the plot went to a stretch the study measured
 * as a single flat baseline, so three quarters of the drawing was a
 * horizontal line carrying no information, and the finding — a fourfold
 * fall, then a twenty-one-fold one — was crushed into the last quarter.
 *
 * So the axis is broken, visibly, at the study's own baseline:
 *
 *  · **Left third — the window, linear.** The study's unit of measurement
 *    is *answered within five minutes*. It never compared one second
 *    against five minutes, so nothing here may slope. It is a flat bar,
 *    and it is a third of the frame because that is roughly the weight the
 *    finding gives it, not because a logarithm happened to put it there.
 *  · **The break.** Two slashes through the baseline, at 5m, labelled.
 *    The scale changes there — linear behind it, logarithmic in front —
 *    and a scale that changes without saying so is a lie told with a
 *    ruler. The curve carries a matching gap, and the study's baseline
 *    measurement sits in that gap, which is the honest place for it.
 *  · **Right two thirds — the collapse, logarithmic.** 5m → 30m over two
 *    thirds of the width. The tenth minute now lands mid-frame, where the
 *    fourfold fall can actually be seen falling.
 *
 * **The aspect ratio is pinned.** `preserveAspectRatio="none"` would make
 * the steepness of the cliff — the entire thesis — a function of the
 * reader's window width, and a shape argument cannot be drawn in a box
 * that changes shape. The container carries the viewBox's own ratio and
 * the SVG meets it, so the gradient of that line is the same on a phone
 * and on a monitor. The three measured points stay HTML on top, because a
 * stretched SVG circle reads as an error bar and because they now have to
 * sit exactly where the pinned geometry puts them.
 *
 * **The curve draws against the scroll, not against a timer.** An autoplay
 * fired by a one-shot `useInView` on a plate this tall starts while the
 * plot is still below the fold and finishes before it arrives.
 * Scroll-binding makes the reader's own gesture the thing that walks the
 * head down the cliff, with the readout recomputing from `qualifyOddsAt()`
 * at the drawn head, so the number and the shape fall together. Under
 * `useReducedMotion` the curve is simply drawn, resting at the ten-minute
 * mark; nothing is bound.
 *
 * **`CALL_FATE` is a sentence, and a corrected one.** It was a stacked bar
 * plus the line "six calls in ten never reach the curve above at all",
 * which is false: voicemail *is* the population the callback curve
 * describes — that is precisely what a callback is. Only the rang-out
 * share never reaches the curve. The sentence is assembled here from the
 * shares themselves so the arithmetic cannot drift away from the data
 * again, and the bar is gone because a three-segment bar of 37.8 / 37.8 /
 * 24.3 tells the reader nothing a sentence does not.
 *
 * Kept verbatim, because both were right:
 *
 *  · the log–log interpolation between the measured points (`qualifyOddsAt`
 *    in `lib/site`), and
 *  · the refusal to extrapolate below five minutes. The axis stops where
 *    the measurements do. A swooping sub-second curve would make a better
 *    graphic and an invented one.
 */

/* ---------------------------------------------------------------- *
 * The broken axis
 * ---------------------------------------------------------------- */

/** The study's baseline window, read from the data rather than retyped. */
const SHELF_END = LEAD_DECAY[0].at;

/**
 * How much of the width the window gets.
 *
 * A third: enough for the flat bar to read as a *place a caller can be*
 * rather than as a margin, and little enough that the collapse owns the
 * frame. It is a design weighting and is labelled as one on screen — the
 * break exists so nobody mistakes it for a measurement.
 */
const SHELF_FRAC = 1 / 3;

const LOG_SPAN = Math.log(DECAY_MAX / SHELF_END);

/** Seconds → 0–1 across the plot. Linear to the break, log past it. */
const posOf = (sec: number) => {
  const t = Math.max(0, Math.min(DECAY_MAX, sec));
  if (t <= SHELF_END) return (t / SHELF_END) * SHELF_FRAC;
  return SHELF_FRAC + (1 - SHELF_FRAC) * (Math.log(t / SHELF_END) / LOG_SPAN);
};

/** The inverse, so the marker can report a time from where it sits. */
const secOf = (pos: number) => {
  const p = Math.min(1, Math.max(0, pos));
  if (p <= SHELF_FRAC) return (p / SHELF_FRAC) * SHELF_END;
  return SHELF_END * Math.exp(((p - SHELF_FRAC) / (1 - SHELF_FRAC)) * LOG_SPAN);
};

const fmt = (s: number) => {
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return r ? `${m}m ${String(r).padStart(2, "0")}s` : `${m}m`;
};

/* Plot geometry, in viewBox units. The container carries this same ratio,
   so one viewBox unit is one fixed fraction of the drawing at every width. */
const VB_W = 100;
const VB_H = 46;
const TOP = 5;
const BOTTOM = 40;
const Y = (q: number) => BOTTOM - q * (BOTTOM - TOP);

const BREAK_X = SHELF_FRAC * VB_W;
/** Half-width of the gap the break opens in the curve and the baseline. */
const GAP = 1.5;

const SAMPLES = 120;

/**
 * The inks of the drawing, as literals SVG attributes can carry.
 *
 * `--pp-ink` and `--pp-accent` are read straight from the cascade — `.pp`
 * is an ancestor of this section, and an SVG paint attribute resolves a
 * custom property like any other. The two greys below are not tokens
 * because they are not `--pp-rule` and `--pp-hair`'s alphas: they are the
 * same violet-grey hue (24 16 40) at the weights a *chart* needs, which
 * sit between a page hairline and body copy. Keeping the hue means the
 * axis belongs to the same paper as the rules above and below it.
 */
const AXIS = "rgb(24 16 40 / 0.22)";
const AXIS_SOFT = "rgb(24 16 40 / 0.13)";

/**
 * The two arms of the curve, sampled once at module load.
 *
 * A pure function of published constants — identical for every render on
 * the server and the client — so it is computed here rather than memoised
 * per mount. Shelf and cliff are subpaths of ONE path: a `M` carries no
 * length, so a single `pathLength` draw runs straight across the break
 * without the two arms needing to coordinate.
 */
const { line, area } = (() => {
  const shelf = `M 0 ${Y(1)} L ${(BREAK_X - GAP).toFixed(2)} ${Y(1)}`;

  const startP = (BREAK_X + GAP) / VB_W;
  const pts: string[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const p = startP + (1 - startP) * (i / SAMPLES);
    pts.push(
      `${i ? "L" : "M"} ${(p * VB_W).toFixed(2)} ${Y(qualifyOddsAt(secOf(p))).toFixed(2)}`,
    );
  }
  const cliff = pts.join(" ");

  return {
    line: `${shelf} ${cliff}`,
    area:
      `${shelf} L ${(BREAK_X - GAP).toFixed(2)} ${BOTTOM} L 0 ${BOTTOM} Z ` +
      `${cliff} L ${VB_W} ${BOTTOM} L ${(BREAK_X + GAP).toFixed(2)} ${BOTTOM} Z`,
  };
})();

/** Where the marker comes to rest when there is nothing to scroll against. */
const REST = posOf(600);

/* The x ticks. Only the break and the decade marks — the shelf has no
   internal structure to label, and pretending it does re-introduces exactly
   the false precision the break exists to deny. */
const TICKS: { at: number; label: string }[] = [
  { at: 0, label: "the call" },
  { at: SHELF_END, label: "5m" },
  { at: 600, label: "10m" },
  { at: 1200, label: "20m" },
  { at: DECAY_MAX, label: "30m" },
];

/**
 * Label placement for the three measured points, by their index in
 * `LEAD_DECAY`. Hand-placed because there are exactly three of them and
 * each one has a different neighbour to dodge: the first sits in the
 * break's gap, the last sits hard against the right edge. In px, not em —
 * these dodge a 15px knock-out and a 1.75px stroke, both of which are
 * fixed sizes on white.
 */
const POINT_LABEL = [
  "-translate-x-1/2 translate-y-[11px]",
  "translate-x-[11px] -translate-y-[20px]",
  "-translate-x-[calc(100%_+_10px)] -translate-y-[20px]",
];

/* ---------------------------------------------------------------- *
 * Where the call lands, before any of this
 * ---------------------------------------------------------------- */

const shareOf = (id: string) => CALL_FATE.find((f) => f.id === id)?.share ?? 0;

const LIVE = shareOf("live");
const VOICEMAIL = shareOf("voicemail");
const RANG_OUT = shareOf("none");

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

/** The small tracked label that names a figure or an axis. */
const LABEL = "text-[11px] leading-4 font-medium tracking-[0.12em] text-pp-muted uppercase";

/* ---------------------------------------------------------------- *
 * Section
 * ---------------------------------------------------------------- */

export function Shelf() {
  const reduce = useReducedMotion();
  const section = useRef<HTMLElement>(null);
  const plot = useRef<HTMLDivElement>(null);

  /**
   * The draw, and the head.
   *
   * `drawn` is the stroke's `pathLength`; `pos` is where the readout is
   * reading. They are the same number until the reader grabs the marker,
   * at which point the curve completes and `pos` becomes theirs. `driving`
   * is mirrored into a ref because the scroll subscription has to refuse
   * the hand-off on the frame it happens, not on the render after it.
   */
  const drawn = useMotionValue(0);
  const [pos, setPos] = useState(0);
  const [driving, setDriving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const drivingRef = useRef(false);

  const { scrollYProgress } = useScroll({
    target: section,
    offset: ["start 70%", "end 60%"],
  });

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (reduce || drivingRef.current) return;
    drawn.set(v);
    setPos(v);
  });

  // Mount: the section may already be on screen, and `change` only fires on
  // a change. Reduced motion skips the binding entirely and takes the end
  // state — a finished curve, resting on the ten-minute measurement.
  useEffect(() => {
    if (reduce) {
      drawn.set(1);
      setPos(REST);
      return;
    }
    if (drivingRef.current) return;
    const v = scrollYProgress.get();
    drawn.set(v);
    setPos(v);
  }, [reduce, drawn, scrollYProgress]);

  const take = useCallback(() => {
    if (drivingRef.current) return;
    drivingRef.current = true;
    setDriving(true);
    // Finish the drawing rather than snapping it: the reader has just
    // touched the marker, and a curve that completes under their hand reads
    // as a response to them.
    animate(drawn, 1, { duration: reduce ? 0 : 0.45, ease: [0.16, 1, 0.3, 1] });
  }, [drawn, reduce]);

  const sec = secOf(pos);
  const odds = qualifyOddsAt(sec);
  const worse = 1 / odds;
  const onShelf = sec <= SHELF_END;

  const at = (e: ReactPointerEvent) => {
    const r = plot.current?.getBoundingClientRect();
    if (!r?.width) return;
    take();
    setPos(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
  };

  const key = (e: ReactKeyboardEvent) => {
    const big = e.shiftKey || e.key === "PageUp" || e.key === "PageDown";
    const d = big ? 0.08 : 0.02;
    const step =
      e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "PageUp"
        ? d
        : e.key === "ArrowLeft" || e.key === "ArrowDown" || e.key === "PageDown"
          ? -d
          : 0;
    const jump = e.key === "Home" ? 0 : e.key === "End" ? 1 : -1;
    if (!step && jump < 0) return;
    e.preventDefault();
    take();
    setPos(jump >= 0 ? jump : Math.min(1, Math.max(0, pos + step)));
  };

  const valuetext = `${fmt(sec)} — ${Math.round(odds * 100)} in 100${
    onShelf ? ", no worse than answering at once" : `, ${worse.toFixed(1)} times worse`
  }`;

  return (
    <section ref={section} id="why" className="scroll-mt-24">
      {/* ---- the masthead ---- */}
      <Frame className="px-6 pt-20 pb-10 md:px-12 md:pt-28 md:pb-12">
        <SectionHeading eyebrow={STATS_INTRO.eyebrow} titleClassName="max-w-[660px]">
          <MaskRise lines={[STATS_INTRO.title]} />
        </SectionHeading>

        <p className="mt-5 max-w-[680px] text-[17px] leading-7 text-pretty text-pp-muted">
          {STATS_INTRO.sub}
        </p>
      </Frame>

      {/* A hairline, not a tear. The cover's frayed edge was a dark-field
          device; here the page already separates by air, and the rule is
          only there to say the instrument below is a different kind of
          object from the prose above it. */}
      <Rule />

      {/* ---- the instrument, standing on white ---- */}

      <Frame className="px-6 py-12 md:px-12 md:py-16">
        <p className={LABEL}>Odds of qualifying a caller, against how long they waited</p>

        <div className="relative mt-6 w-full max-w-[860px]">
          <div
            ref={plot}
            role="slider"
            tabIndex={0}
            aria-label="How long a caller waited to be answered"
            aria-orientation="horizontal"
            aria-valuemin={0}
            aria-valuemax={DECAY_MAX}
            aria-valuenow={Math.round(sec)}
            aria-valuetext={valuetext}
            onKeyDown={key}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setDragging(true);
              at(e);
            }}
            onPointerMove={(e) => dragging && at(e)}
            onPointerUp={(e) => {
              e.currentTarget.releasePointerCapture(e.pointerId);
              setDragging(false);
            }}
            onPointerCancel={() => setDragging(false)}
            style={{ aspectRatio: `${VB_W} / ${VB_H}` }}
            className={cn(
              "relative w-full touch-none select-none rounded-[10px]",
              "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-pp-ink",
              dragging ? "cursor-grabbing" : "cursor-ew-resize",
            )}
          >
            {/*
              `meet`, and the container carries the viewBox's ratio — so
              `meet` never letterboxes and never distorts. This is what makes
              the cliff's gradient a constant of the argument rather than of
              the window, and it is also what lets the HTML overlays below
              position themselves in plain percentages: one viewBox unit maps
              to one fixed percentage of the box at every width.
            */}
            <svg
              aria-hidden
              viewBox={`0 0 ${VB_W} ${VB_H}`}
              preserveAspectRatio="xMidYMid meet"
              className="absolute inset-0 size-full overflow-visible"
            >
              <defs>
                {/*
                  Value evaporating left to right. On ink this was a lit
                  brand wash; on white the same idea has to be whispered —
                  a tint of the paper's own violet-grey at a tenth of an
                  alpha, gone to nothing past the cliff. Anything heavier
                  reads as a smudge rather than as area under a curve.
                */}
                <linearGradient
                  id="ntv-shelf-fill"
                  gradientUnits="userSpaceOnUse"
                  x1="0"
                  y1="0"
                  x2={VB_W}
                  y2="0"
                >
                  <stop offset="0%" stopColor="#181028" stopOpacity="0.10" />
                  <stop offset={`${BREAK_X}%`} stopColor="#181028" stopOpacity="0.08" />
                  <stop offset="72%" stopColor="#181028" stopOpacity="0.025" />
                  <stop offset="100%" stopColor="#181028" stopOpacity="0.01" />
                </linearGradient>
              </defs>

              {/* the two measured points past the break, as dropped rules */}
              {LEAD_DECAY.slice(1).map((d) => (
                <line
                  key={d.at}
                  x1={posOf(d.at) * VB_W}
                  y1={Y(d.qualify)}
                  x2={posOf(d.at) * VB_W}
                  y2={BOTTOM}
                  stroke={AXIS_SOFT}
                  strokeWidth="1"
                  strokeDasharray="1.5 2.5"
                  vectorEffect="non-scaling-stroke"
                />
              ))}

              {/* the break, carried from the curve's gap down to the axis */}
              <line
                x1={BREAK_X}
                y1={TOP}
                x2={BREAK_X}
                y2={BOTTOM + 3}
                stroke={AXIS_SOFT}
                strokeWidth="1"
                strokeDasharray="1.5 2.5"
                vectorEffect="non-scaling-stroke"
              />

              {/* the baseline, itself broken */}
              <line
                x1="0"
                y1={BOTTOM}
                x2={BREAK_X - 1.9}
                y2={BOTTOM}
                stroke={AXIS}
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1={BREAK_X + 2.9}
                y1={BOTTOM}
                x2={VB_W}
                y2={BOTTOM}
                stroke={AXIS}
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />

              {/* the two slashes: the axis says, in the conventional hand,
                  that it is not continuous here */}
              {[-1.7, 0.5].map((dx) => (
                <line
                  key={dx}
                  x1={BREAK_X + dx}
                  y1={BOTTOM + 2.1}
                  x2={BREAK_X + dx + 1.9}
                  y2={BOTTOM - 2.1}
                  stroke="var(--pp-ink)"
                  strokeOpacity="0.55"
                  strokeWidth="1"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}

              <path d={area} fill="url(#ntv-shelf-fill)" />

              {/* The stroke draws against the scroll. The filled area above
                  is static on purpose: the shape has to be legible before a
                  single pixel of script runs, and the draw is emphasis, not
                  the only way to see it.

                  1.75px, where the dark plate needed 2.6. Black on white
                  carries at a weight that would have disappeared on ink,
                  and the finer line is what lets the cliff read as a curve
                  rather than as a ribbon. */}
              <motion.path
                d={line}
                fill="none"
                stroke="var(--pp-ink)"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                style={{ pathLength: drawn }}
              />
            </svg>

            {/* THE CLAIM. Full height, at t = 0, in the only accent this
                system has — and the only mark on this plot that is ours
                rather than cited. Read from SHELF_CLAIM so a reviewer
                checking the citations can find the one sentence that has
                none. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 w-px bg-pp-accent"
            >
              <span className="absolute left-3 top-[42%] w-[8.5rem] text-[16px] leading-[21px] font-medium tracking-[-0.01em] text-pp-accent">
                {SHELF_CLAIM}
              </span>
            </div>

            {/* The three measured points, as HTML. A stretched SVG circle
                reads as an error bar; these stay round at every width.

                Solid marks now, not rings: on white a hollow dot is a hole
                in the paper, while a filled one is a measurement taken. The
                white disc around it is a knock-out, so the point cuts the
                curve instead of the curve running through the point — the
                same grammar the product pages' figures draw. */}
            {LEAD_DECAY.map((d, i) => (
              <span
                key={`pt${d.at}`}
                aria-hidden
                className="pointer-events-none absolute"
                style={{
                  left: `${posOf(d.at) * 100}%`,
                  top: `${(Y(d.qualify) / VB_H) * 100}%`,
                }}
              >
                <span className="absolute grid size-[15px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-pp-bg">
                  <span className="block size-[8px] rounded-full bg-pp-ink" />
                </span>
                <span
                  className={cn(
                    "mono absolute block whitespace-nowrap text-[11px] leading-none tracking-[0.04em] text-pp-muted",
                    POINT_LABEL[i],
                  )}
                >
                  {d.qualify >= 1 ? "1.00" : d.qualify.toFixed(2)}
                </span>
              </span>
            ))}

            {/* what each half of the axis is */}
            <span
              aria-hidden
              className="pointer-events-none absolute bottom-1.5 left-0 text-[11px] leading-4 tracking-[0.1em] text-pp-muted uppercase"
              style={{ width: `${SHELF_FRAC * 100}%` }}
            >
              <span className="block pl-2">The window · flat</span>
            </span>
            <span
              aria-hidden
              className="pointer-events-none absolute right-0 bottom-1.5 text-[11px] leading-4 tracking-[0.1em] text-pp-muted uppercase"
            >
              The collapse · log
            </span>

            {/* the head */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 w-px bg-pp-ink/30"
              style={{
                left: `${pos * 100}%`,
                transitionProperty: dragging || !driving ? "none" : "left",
                transitionDuration: dragging || !driving || reduce ? "0ms" : "120ms",
              }}
            >
              <span
                className="absolute size-[11px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-pp-ink bg-pp-bg"
                style={{ top: `${(Y(odds) / VB_H) * 100}%` }}
              />
              {/* The one inverted chip in the section: black on white is how
                  this system says "the live value", where the cover said it
                  with a lit panel. */}
              <span
                className={cn(
                  "mono absolute top-0 whitespace-nowrap rounded-full bg-pp-ink px-2 py-1 text-[11px] leading-none text-white",
                  pos > 0.84 ? "right-2" : "left-2",
                )}
              >
                {fmt(sec)}
              </span>
            </div>
          </div>

          {/* the x axis, and the break named where it happens */}
          <div className="relative mt-2 h-5">
            {TICKS.map((t) => (
              <span
                key={t.at}
                aria-hidden
                className={cn(
                  "mono absolute top-0 text-[11px] leading-4 tracking-[0.06em] text-pp-muted",
                  t.at === 0
                    ? "left-0"
                    : t.at === DECAY_MAX
                      ? "right-0"
                      : "-translate-x-1/2",
                )}
                style={
                  t.at === 0 || t.at === DECAY_MAX
                    ? undefined
                    : { left: `${posOf(t.at) * 100}%` }
                }
              >
                {t.label}
              </span>
            ))}
          </div>

          <p className="mt-4 max-w-[640px] text-[12px] leading-[18px] text-pp-muted">
            The axis is broken at the five-minute mark — the study&rsquo;s own
            baseline. Behind the break the scale is linear across that single
            measured window; in front of it, logarithmic to thirty minutes.
            Nothing is drawn below five minutes, because nothing was measured
            there.
          </p>
        </div>

        {/* ---- the readout, grouped by rules and space ---- */}

        <div className="mt-12 grid max-w-[860px] grid-cols-2 gap-y-8 border-t border-pp-rule pt-8 sm:grid-cols-3 sm:gap-x-10">
          <div className="sm:border-r sm:border-pp-rule sm:pr-10">
            <p className={LABEL}>Answered after</p>
            <p className="mono mt-2 text-[28px] leading-none tabular-nums tracking-[-0.02em] text-pp-ink md:text-[32px]">
              {fmt(sec)}
            </p>
          </div>

          <div className="sm:border-r sm:border-pp-rule sm:pr-10">
            <p className={LABEL}>Odds of qualifying</p>
            <p
              className={cn(
                "mt-2 text-[28px] leading-none font-medium tabular-nums tracking-[-0.03em] transition-colors duration-500 md:text-[32px]",
                onShelf ? "text-pp-accent" : "text-pp-ink",
              )}
            >
              {Math.round(odds * 100)}
              <span className="text-[14px] text-pp-muted md:text-[16px]"> in 100</span>
            </p>
          </div>

          <div className="col-span-2 sm:col-span-1">
            <p className={LABEL}>Against answering at once</p>
            <p className="mt-2 text-[28px] leading-none font-medium tabular-nums tracking-[-0.03em] text-pp-ink md:text-[32px]">
              {onShelf ? (
                <span className="text-pp-accent">No difference</span>
              ) : (
                <>
                  {worse.toFixed(worse < 10 ? 1 : 0)}&times;
                  <span className="text-[14px] text-pp-muted md:text-[16px]"> worse</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* the sentence, by where the head sits */}
        <p className="mt-8 max-w-[760px] text-[17px] leading-7 text-pp-muted">
          {onShelf ? (
            <>
              Inside the window a second costs nothing, and{" "}
              <span className="text-pp-ink">
                this is the only stretch of the graph where that is true
              </span>
              . It is five minutes wide, it opens at whatever hour the phone
              happens to ring, and a staffed front desk cannot promise it.
            </>
          ) : sec <= 600 ? (
            <>
              Past the shelf, and falling. MIT measured a{" "}
              <span className="text-pp-ink">fourfold drop by the tenth minute</span>{" "}
              — the caller is still reachable, but they have stopped reaching
              for you. Somebody answered while you were deciding to call back.
            </>
          ) : (
            <>
              <span className="text-pp-ink">Twenty-one times worse by the half hour</span>{" "}
              — the study&rsquo;s own headline figure, and the reason a callback
              is not a save. By this point it is not your customer being
              followed up. It is somebody else&rsquo;s customer being confirmed.
            </>
          )}
        </p>
      </Frame>

      {/* The rule below the plot. The argument changes here: everything
          above is about *when* a call is answered, everything below is
          about whether it is answered at all. */}
      <Rule />

      <Frame className="px-6 py-12 md:px-12 md:py-16">
        <Reveal>
          <p className={LABEL}>Before any of that — whether the call is answered at all</p>

          {/*
            One sentence, assembled from CALL_FATE's own shares.

            The line this replaces said six calls in ten never reach the curve
            above. They do. A voicemail is a lead with the clock running — it
            is the exact population a callback curve describes, and calling it
            lost both overstates the case and misses the sharper one: a
            quarter of callers are not late, they are gone, and no callback
            time in the world reaches them.
          */}
          <p className="mt-5 max-w-[760px] text-[19px] leading-8 text-pp-muted md:text-[21px]">
            Of every hundred calls to a small business,{" "}
            <span className="mono tabular-nums text-pp-ink">{pct(LIVE)}</span> are
            picked up by a person and{" "}
            <span className="mono tabular-nums text-pp-ink">{pct(VOICEMAIL)}</span>{" "}
            land in voicemail — and voicemail is precisely the population the
            curve above describes: the clock starts, and the callback lands
            somewhere on that cliff. Only the{" "}
            <span className="mono tabular-nums text-pp-accent">{pct(RANG_OUT)}</span>{" "}
            that ring out never reach the curve at all.{" "}
            <span className="text-pp-ink">Those callers are not late. They are gone.</span>
          </p>
        </Reveal>

        {/* Provenance on one line, and then out — to the businesses this
            actually happens to. A bibliography is where a reader stops; an
            anchor is where they continue. */}
        <div className="mt-12 flex flex-col gap-5 border-t border-pp-rule pt-6 md:flex-row md:items-center md:justify-between">
          <p className="max-w-[640px] text-[12px] leading-[18px] text-pp-muted">
            Measured by{" "}
            {WHY_SOURCES.map((s, i) => (
              <span key={s.work} title={s.detail}>
                {i ? " · " : ""}
                {s.work}
              </span>
            ))}
          </p>

          <PillLink href="#use-cases" variant="secondary" size="sm" className="group self-start">
            Whose phone this happens on
            <ArrowRight
              className="size-4 transition-transform duration-300 group-hover:translate-x-0.5"
              strokeWidth={2}
              aria-hidden
            />
          </PillLink>
        </div>
      </Frame>
    </section>
  );
}
