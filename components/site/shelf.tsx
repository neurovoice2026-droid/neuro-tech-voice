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
import { CornerDot } from "./corner-dot";
import { TornEdge } from "./cover-tear";
import { MaskRise } from "./reveal";

/**
 * Somebody else's numbers — the shelf, and the drop off the end of it.
 *
 * Nothing in this section is ours. That is its only asset, and every
 * decision below is in service of not spending it.
 *
 * **The axis is the rebuild.** The previous version put the whole
 * thirty minutes on one logarithmic scale from one second, which sounds
 * rigorous and is in fact the opposite. `ln 300 / ln 1800` is 0.761: three
 * quarters of the plot went to a stretch the study measured as a single
 * flat baseline, so three quarters of the drawing was a horizontal line
 * carrying no information, and the finding — a fourfold fall, then a
 * twenty-one-fold one — was crushed into the last quarter. A reader
 * glancing at it saw a graph that was mostly nothing.
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
 * **The aspect ratio is pinned.** The old plot used
 * `preserveAspectRatio="none"`, which meant the steepness of the cliff —
 * the entire thesis — was a function of the reader's window width. A
 * shape argument cannot be drawn in a box that changes shape. The
 * container carries the viewBox's own ratio and the SVG meets it, so the
 * gradient of that line is the same on a phone and on a monitor. The three
 * measured points stay HTML on top, because a stretched SVG circle reads
 * as an error bar and because they now have to sit exactly where the
 * pinned geometry puts them.
 *
 * **`SHELF_CLAIM` is promoted to the loudest mark in the frame.** It used
 * to be a 0.55em dot with a small caption. It is the one thing on this
 * plot that we are asserting rather than citing, so it should be
 * unmissable and unmistakably ours: a full-height brand rule at t=0 with
 * a 1.15em label. Every other mark is grey, cited, and quiet.
 *
 * **The curve draws against the scroll, not against a timer.** The old
 * autoplay was a 4.6-second walk fired by a one-shot `useInView` on a card
 * thirty em tall — which on most screens started while the plot was still
 * below the fold and finished before it arrived. Scroll-binding makes the
 * reader's own gesture the thing that walks the head down the cliff, with
 * the readout recomputing from `qualifyOddsAt()` at the drawn head, so the
 * number and the shape fall together. Under `useReducedMotion` the curve
 * is simply drawn, resting at the ten-minute mark; nothing is bound.
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
 * Kept verbatim from the old section, because both were right:
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
 * break's gap, the last sits hard against the right edge.
 */
const POINT_LABEL = [
  "-translate-x-1/2 translate-y-[0.5em]",
  "translate-x-[0.6em] -translate-y-[1.5em]",
  "-translate-x-[calc(100%_+_0.55em)] -translate-y-[1.5em]",
];

/* ---------------------------------------------------------------- *
 * Where the call lands, before any of this
 * ---------------------------------------------------------------- */

const shareOf = (id: string) => CALL_FATE.find((f) => f.id === id)?.share ?? 0;

const LIVE = shareOf("live");
const VOICEMAIL = shareOf("voicemail");
const RANG_OUT = shareOf("none");

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

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
    <section
      ref={section}
      id="why"
      className="relative scroll-mt-24 px-[1.6em] py-[6em] md:py-[8em]"
    >
      <div className="relative mx-auto max-w-[76em]">
        {/* masthead */}
        <div className="flex items-center gap-[0.75em] text-[var(--cover-paper)]/45">
          <CornerDot className="size-[0.55em] shrink-0" />
          <span className="mono text-[0.7em] uppercase tracking-[0.24em] text-[var(--cover-paper)]/45">
            03
          </span>
          <span className="mono text-[0.7em] uppercase tracking-[0.24em] text-[var(--cover-paper)]/45">
            {STATS_INTRO.eyebrow}
          </span>
        </div>

        <h2 className="mt-[0.85em] max-w-[18em] text-balance text-[2.8em] font-medium leading-[1.03] tracking-[-0.045em] md:text-[3.4em]">
          <MaskRise lines={[STATS_INTRO.title]} />
        </h2>

        <p className="mt-[1.05em] max-w-[44em] text-pretty text-[1.05em] leading-[1.6] text-[var(--cover-paper)]/75">
          {STATS_INTRO.sub}
        </p>

        <div className="mt-[2.4em] h-px bg-[var(--cover-paper)]/12" />

        {/* The rule above the plot. Frayed, because the plate below it is
            the one thing on this page nobody may mistake for decoration —
            the tear is how the cover says "a division, not a border". */}
        <TornEdge height={3.2} opacity={0.55} className="mt-[3.2em] mb-[4.2em]" />

        {/* ---- the instrument, standing on the open field ---- */}

        <p className="mono text-[0.68em] uppercase leading-[1.5] tracking-[0.22em] text-[var(--cover-paper)]/45">
          Odds of qualifying a caller, against how long they waited
        </p>

        <div className="relative mt-[1.6em] w-full max-w-[62em]">
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
              "relative w-full touch-none select-none rounded-[0.4em] outline-none",
              "focus-visible:ring-2 focus-visible:ring-[var(--cover-brand-lit)]/60",
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
                {/* Value evaporating left to right: lit under the window,
                    all but gone past the cliff, so the shape reads before a
                    single label does. */}
                <linearGradient
                  id="ntv-shelf-fill"
                  gradientUnits="userSpaceOnUse"
                  x1="0"
                  y1="0"
                  x2={VB_W}
                  y2="0"
                >
                  <stop offset="0%" stopColor="var(--cover-brand-lit)" stopOpacity="0.26" />
                  <stop
                    offset={`${BREAK_X}%`}
                    stopColor="var(--cover-brand-lit)"
                    stopOpacity="0.2"
                  />
                  <stop offset="72%" stopColor="var(--cover-brand-lit)" stopOpacity="0.05" />
                  <stop offset="100%" stopColor="var(--cover-brand-lit)" stopOpacity="0.02" />
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
                  stroke="var(--cover-paper)"
                  strokeOpacity="0.16"
                  strokeWidth="0.25"
                  strokeDasharray="1 1.6"
                  vectorEffect="non-scaling-stroke"
                />
              ))}

              {/* the break, carried from the curve's gap down to the axis */}
              <line
                x1={BREAK_X}
                y1={TOP}
                x2={BREAK_X}
                y2={BOTTOM + 3}
                stroke="var(--cover-paper)"
                strokeOpacity="0.14"
                strokeWidth="0.25"
                strokeDasharray="1 1.6"
                vectorEffect="non-scaling-stroke"
              />

              {/* the baseline, itself broken */}
              <line
                x1="0"
                y1={BOTTOM}
                x2={BREAK_X - 1.9}
                y2={BOTTOM}
                stroke="var(--cover-paper)"
                strokeOpacity="0.2"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1={BREAK_X + 2.9}
                y1={BOTTOM}
                x2={VB_W}
                y2={BOTTOM}
                stroke="var(--cover-paper)"
                strokeOpacity="0.2"
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
                  stroke="var(--cover-paper)"
                  strokeOpacity="0.45"
                  strokeWidth="1"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}

              <path d={area} fill="url(#ntv-shelf-fill)" />

              {/* The stroke draws against the scroll. The filled area above
                  is static on purpose: the shape has to be legible before a
                  single pixel of script runs, and the draw is emphasis, not
                  the only way to see it. */}
              <motion.path
                d={line}
                fill="none"
                stroke="var(--cover-brand-lit)"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                style={{ pathLength: drawn }}
              />
            </svg>

            {/* THE CLAIM. Full height, at t = 0, in the only accent the
                cover has — the loudest mark in the frame, and the only mark
                on this plot that is ours rather than cited. Read from
                SHELF_CLAIM so a reviewer checking the citations can find
                the one sentence that has none. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 w-px bg-[var(--cover-brand-lit)]"
            >
              <span className="absolute left-[0.7em] top-[42%] w-[7em] text-[1.15em] font-medium leading-[1.2] tracking-[-0.02em] text-[var(--cover-brand-lit)]">
                {SHELF_CLAIM}
              </span>
            </div>

            {/* The three measured points, as HTML. A stretched SVG circle
                reads as an error bar; these stay round at every width. */}
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
                <span className="absolute block size-[0.62em] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--cover-brand-lit)] bg-[var(--cover-ink)]" />
                <span
                  className={cn(
                    "mono absolute block whitespace-nowrap text-[0.62em] leading-none tracking-[0.08em] text-[var(--cover-paper)]/75",
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
              className="mono pointer-events-none absolute bottom-[0.45em] left-0 text-[0.6em] uppercase tracking-[0.2em] text-[var(--cover-paper)]/45"
              style={{ width: `${SHELF_FRAC * 100}%` }}
            >
              <span className="block pl-[0.5em]">The window · flat</span>
            </span>
            <span
              aria-hidden
              className="mono pointer-events-none absolute bottom-[0.45em] right-0 text-[0.6em] uppercase tracking-[0.2em] text-[var(--cover-paper)]/45"
            >
              The collapse · log
            </span>

            {/* the head */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 w-px bg-[var(--cover-paper)]/45"
              style={{
                left: `${pos * 100}%`,
                transitionProperty: dragging || !driving ? "none" : "left",
                transitionDuration: dragging || !driving || reduce ? "0ms" : "120ms",
              }}
            >
              <span
                className="absolute size-[0.7em] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--cover-paper)] bg-[var(--cover-ink)]"
                style={{ top: `${(Y(odds) / VB_H) * 100}%` }}
              />
              <span
                className={cn(
                  "mono absolute top-0 whitespace-nowrap rounded-[0.35em] bg-[var(--cover-ink)]/85 px-[0.55em] py-[0.3em] text-[0.62em] leading-none text-[var(--cover-paper)]",
                  pos > 0.84 ? "right-[0.5em]" : "left-[0.5em]",
                )}
              >
                {fmt(sec)}
              </span>
            </div>
          </div>

          {/* the x axis, and the break named where it happens */}
          <div className="relative mt-[0.55em] h-[1.3em]">
            {TICKS.map((t) => (
              <span
                key={t.at}
                aria-hidden
                className={cn(
                  "mono absolute top-0 text-[0.62em] tracking-[0.1em] text-[var(--cover-paper)]/45",
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

          <p className="mt-[0.9em] text-[0.7em] leading-[1.6] text-[var(--cover-paper)]/45">
            The axis is broken at the five-minute mark — the study&rsquo;s own
            baseline. Behind the break the scale is linear across that single
            measured window; in front of it, logarithmic to thirty minutes.
            Nothing is drawn below five minutes, because nothing was measured
            there.
          </p>
        </div>

        {/* ---- the readout, grouped by rules and space ---- */}

        <div className="mt-[3em] grid max-w-[62em] grid-cols-2 gap-y-[1.6em] border-t border-[var(--cover-paper)]/12 pt-[1.6em] sm:grid-cols-3 sm:gap-x-[2em]">
          <div className="sm:border-r sm:border-[var(--cover-paper)]/12 sm:pr-[2em]">
            <p className="mono text-[0.62em] uppercase tracking-[0.22em] text-[var(--cover-paper)]/45">
              Answered after
            </p>
            <p className="mono mt-[0.45em] text-[1.8em] leading-none tabular-nums tracking-[-0.02em]">
              {fmt(sec)}
            </p>
          </div>

          <div className="sm:border-r sm:border-[var(--cover-paper)]/12 sm:pr-[2em]">
            <p className="mono text-[0.62em] uppercase tracking-[0.22em] text-[var(--cover-paper)]/45">
              Odds of qualifying
            </p>
            <p
              className={cn(
                "mt-[0.45em] text-[1.8em] font-medium leading-none tabular-nums tracking-[-0.03em] transition-colors duration-500",
                onShelf
                  ? "text-[var(--cover-brand-lit)]"
                  : "text-[var(--cover-paper)]/75",
              )}
            >
              {Math.round(odds * 100)}
              <span className="text-[0.5em] text-[var(--cover-paper)]/45"> in 100</span>
            </p>
          </div>

          <div className="col-span-2 sm:col-span-1">
            <p className="mono text-[0.62em] uppercase tracking-[0.22em] text-[var(--cover-paper)]/45">
              Against answering at once
            </p>
            <p className="mt-[0.45em] text-[1.8em] font-medium leading-none tabular-nums tracking-[-0.03em]">
              {onShelf ? (
                <span className="text-[var(--cover-brand-lit)]">No difference</span>
              ) : (
                <>
                  {worse.toFixed(worse < 10 ? 1 : 0)}&times;
                  <span className="text-[0.5em] text-[var(--cover-paper)]/45"> worse</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* the sentence, by where the head sits */}
        <p className="mt-[1.5em] max-w-[62em] text-[0.98em] leading-[1.65] text-[var(--cover-paper)]/75">
          {onShelf ? (
            <>
              Inside the window a second costs nothing, and{" "}
              <span className="text-[var(--cover-paper)]">
                this is the only stretch of the graph where that is true
              </span>
              . It is five minutes wide, it opens at whatever hour the phone
              happens to ring, and a staffed front desk cannot promise it.
            </>
          ) : sec <= 600 ? (
            <>
              Past the shelf, and falling. MIT measured a{" "}
              <span className="text-[var(--cover-paper)]">
                fourfold drop by the tenth minute
              </span>{" "}
              — the caller is still reachable, but they have stopped reaching
              for you. Somebody answered while you were deciding to call back.
            </>
          ) : (
            <>
              <span className="text-[var(--cover-paper)]">
                Twenty-one times worse by the half hour
              </span>{" "}
              — the study&rsquo;s own headline figure, and the reason a callback
              is not a save. By this point it is not your customer being
              followed up. It is somebody else&rsquo;s customer being confirmed.
            </>
          )}
        </p>

        {/* The rule below the plot. The argument changes here: everything
            above is about *when* a call is answered, everything below is
            about whether it is answered at all. */}
        <TornEdge height={3.2} opacity={0.55} className="mt-[4.4em] mb-[4.2em]" />

        <p className="mono text-[0.68em] uppercase leading-[1.5] tracking-[0.22em] text-[var(--cover-paper)]/45">
          Before any of that — whether the call is answered at all
        </p>

        {/*
          One sentence, assembled from CALL_FATE's own shares.

          The line this replaces said six calls in ten never reach the curve
          above. They do. A voicemail is a lead with the clock running — it
          is the exact population a callback curve describes, and calling it
          lost both overstates the case and misses the sharper one: a
          quarter of callers are not late, they are gone, and no callback
          time in the world reaches them.
        */}
        <p className="mt-[1.1em] max-w-[52em] text-[1.05em] leading-[1.65] text-[var(--cover-paper)]/75">
          Of every hundred calls to a small business,{" "}
          <span className="mono tabular-nums text-[var(--cover-paper)]">
            {pct(LIVE)}
          </span>{" "}
          are picked up by a person and{" "}
          <span className="mono tabular-nums text-[var(--cover-paper)]">
            {pct(VOICEMAIL)}
          </span>{" "}
          land in voicemail — and voicemail is precisely the population the
          curve above describes: the clock starts, and the callback lands
          somewhere on that cliff. Only the{" "}
          <span className="mono tabular-nums text-[var(--cover-brand-lit)]">
            {pct(RANG_OUT)}
          </span>{" "}
          that ring out never reach the curve at all.{" "}
          <span className="text-[var(--cover-paper)]">
            Those callers are not late. They are gone.
          </span>
        </p>

        {/* Provenance on one line, and then out — to the businesses this
            actually happens to. A bibliography is where a reader stops; an
            anchor is where they continue. */}
        <div className="mt-[3em] flex flex-col gap-[1.2em] border-t border-[var(--cover-paper)]/12 pt-[1.2em] md:flex-row md:items-baseline md:justify-between">
          <p className="max-w-[54em] text-[0.7em] leading-[1.6] text-[var(--cover-paper)]/45">
            Measured by{" "}
            {WHY_SOURCES.map((s, i) => (
              <span key={s.work} title={s.detail}>
                {i ? " · " : ""}
                {s.work}
              </span>
            ))}
          </p>

          <a
            href="#use-cases"
            className="group inline-flex shrink-0 items-center gap-[0.5em] text-[0.85em] leading-none text-[var(--cover-paper)]/75 transition-colors duration-500 hover:text-[var(--cover-brand-lit)]"
          >
            Whose phone this happens on
            <ArrowRight
              className="size-[1em] transition-transform duration-500 group-hover:translate-x-[0.2em]"
              strokeWidth={2}
              aria-hidden
            />
          </a>
        </div>
      </div>
    </section>
  );
}
