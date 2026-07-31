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
  useInView,
  useMotionValue,
  useReducedMotion,
} from "framer-motion";
import { TrendingDown } from "lucide-react";
import {
  CALL_FATE,
  DECAY_MAX,
  LEAD_DECAY,
  STATS_INTRO,
  WHY_SOURCES,
  qualifyOddsAt,
} from "@/lib/site";
import { cn } from "@/lib/utils";
import { Reveal, EASE } from "./reveal";

/**
 * Why it works — somebody else's numbers.
 *
 * This section used to be four figures set very large on a dark band:
 * 24/7, <1s, 100%, 10min. All four were ours, none was sourced, and three
 * of them restated something the page had already said twice. A visitor
 * who cannot check a number does not weigh it at zero — they weigh it
 * below zero, because it teaches them to discount the numbers that *are*
 * checkable, and this page has a lot of those.
 *
 * So the section is now one published finding, drawn. The MIT / InsideSales
 * Lead Response Management study measured what happens to a lead as the
 * minutes pass, and the shape it found is the entire argument for
 * answering a phone instantly — better than any sentence we could write
 * about it:
 *
 *   **It is a plateau and then a cliff.** The odds of qualifying a caller
 *   are flat for five minutes and then collapse — four times worse by the
 *   tenth minute, twenty-one times worse by the thirtieth. On a log axis
 *   the plateau is three quarters of the plot. That shelf is the only part
 *   of the graph worth standing on, and it is exactly the part a staffed
 *   front desk cannot promise: it is five minutes wide, and it opens at
 *   whatever hour the phone happens to ring.
 *
 * Two decisions worth keeping:
 *
 *  · **The axis stops where the measurements stop.** Nothing is
 *    extrapolated past thirty minutes, and the plateau is drawn flat
 *    rather than sloping up toward zero seconds, because the study's
 *    baseline is a five-minute window and it never compared one second
 *    against five minutes. Sloping it would have made a better sales
 *    graphic and an untrue one — and this section's only asset is that
 *    every mark on it can be looked up.
 *  · **The 62% is the setup, not a second statistic.** The curve argues
 *    about *when* a call is answered; the bar underneath says that six
 *    calls in ten are never answered at all. A business tuning its
 *    callback time is arguing about where on the cliff it lands, having
 *    already dropped most of its callers off the edge of it.
 *
 * Colour and scale are the interior spread's — the section moved onto the
 * cover's stock with the rest of the page, so the aurora band and the
 * gradient numerals are gone.
 */

/* ---------------------------------------------------------------- *
 * The axis
 * ---------------------------------------------------------------- */

const LOG_MAX = Math.log(DECAY_MAX);

/** Seconds → 0–1 across the plot. Log, because the story is in the first minute. */
const posOf = (sec: number) =>
  Math.min(1, Math.max(0, Math.log(Math.max(1, sec)) / LOG_MAX));

const secOf = (pos: number) => Math.exp(Math.min(1, Math.max(0, pos)) * LOG_MAX);

const TICKS = [1, 10, 60, 300, 600, 1800];

const tickLabel = (s: number) =>
  s < 60 ? `${s}s` : s < 3600 ? `${s / 60}m` : `${s / 3600}h`;

const fmt = (s: number) => {
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return r ? `${m}m ${String(r).padStart(2, "0")}s` : `${m}m`;
};

/* Plot geometry, in viewBox units. */
const VB_W = 100;
const VB_H = 60;
const TOP = 6;
const BOTTOM = 54;
const Y = (q: number) => BOTTOM - q * (BOTTOM - TOP);

const SAMPLES = 180;

/**
 * The curve, sampled once at module load.
 *
 * It is a pure function of published constants — the same path for every
 * render of every instance, on the server and on the client alike — so it
 * has no business being recomputed per mount or memoised per component.
 */
const { line, area } = (() => {
  const pts: string[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const p = i / SAMPLES;
    pts.push(
      `${i ? "L" : "M"} ${(p * VB_W).toFixed(2)} ${Y(qualifyOddsAt(secOf(p))).toFixed(2)}`,
    );
  }
  const line = pts.join(" ");
  return { line, area: `${line} L ${VB_W} ${BOTTOM} L 0 ${BOTTOM} Z` };
})();

/* ---------------------------------------------------------------- *
 * Section
 * ---------------------------------------------------------------- */

const REST = posOf(600);

const PRESETS = [
  { label: "On the first ring", pos: 0 },
  { label: "Called back in 10 min", pos: REST },
  { label: "Called back in 30 min", pos: 1 },
];

export function Stats() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const plot = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20% 0px -20% 0px" });

  const [pos, setPos] = useState(REST);
  const [driving, setDriving] = useState(false);
  const [dragging, setDragging] = useState(false);

  const take = useCallback(() => setDriving(true), []);

  /**
   * It plays itself once. The collapse is the finding, and a reader who
   * has to discover a draggable marker before the section says anything
   * has already scrolled past it — so the marker walks the whole axis on
   * arrival and comes to rest at ten minutes, which is a good callback
   * time for a busy front desk and still four times worse than answering.
   */
  const mv = useMotionValue(0);
  useEffect(() => {
    if (!inView || driving || reduce) return;
    mv.set(0);
    const controls = animate(mv, [0, 1, REST], {
      duration: 4.6,
      times: [0, 0.68, 1],
      ease: [EASE, EASE],
      delay: 0.35,
    });
    const unsub = mv.on("change", setPos);
    return () => {
      controls.stop();
      unsub();
    };
  }, [inView, driving, reduce, mv]);

  const sec = secOf(pos);
  const odds = qualifyOddsAt(sec);
  const worse = 1 / odds;
  const onPlateau = sec <= LEAD_DECAY[0].at;

  const at = (e: ReactPointerEvent) => {
    const r = plot.current?.getBoundingClientRect();
    if (!r?.width) return;
    take();
    setPos(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
  };

  const key = (e: ReactKeyboardEvent) => {
    const d = e.shiftKey ? 0.1 : 0.025;
    const step =
      e.key === "ArrowRight" ? d : e.key === "ArrowLeft" ? -d : 0;
    const jump = e.key === "Home" ? 0 : e.key === "End" ? 1 : -1;
    if (!step && jump < 0) return;
    e.preventDefault();
    take();
    setPos(jump >= 0 ? jump : Math.min(1, Math.max(0, pos + step)));
  };

  return (
    <section
      id="why"
      className="relative scroll-mt-24 px-[1.6em] py-[6em] md:py-[8em]"
    >
      <div className="relative mx-auto max-w-[76em]">
        {/* header */}
        <div className="mx-auto flex max-w-[42em] flex-col items-center text-center">
          <Reveal>
            <span className="inline-flex items-center gap-[0.55em] rounded-full border border-[var(--cover-brand-lit)]/25 bg-[var(--cover-brand-lit)]/10 px-[1.15em] py-[0.5em] text-[0.72em] font-semibold uppercase leading-none tracking-[0.18em] text-[var(--cover-brand-lit)]">
              <TrendingDown className="size-[1.25em] shrink-0" strokeWidth={2} />
              {STATS_INTRO.eyebrow}
            </span>
          </Reveal>

          <Reveal delay={0.06} className="mt-[1em]">
            <h2 className="text-balance text-[2.8em] font-medium leading-[1.03] tracking-[-0.045em] md:text-[3.4em]">
              {STATS_INTRO.title}
            </h2>
          </Reveal>

          <Reveal
            delay={0.12}
            className="mt-[1.1em] max-w-[36em] text-pretty text-[1.05em] leading-[1.6] text-[var(--cover-paper)]/60"
          >
            {STATS_INTRO.sub}
          </Reveal>
        </div>

        {/* the instrument */}
        <Reveal delay={0.08} y={32} className="mt-[3.5em] md:mt-[4.5em]">
          <div
            ref={ref}
            className="overflow-hidden rounded-[1.2em] border border-[var(--cover-paper)]/12 bg-[var(--cover-panel)] shadow-[0_2em_5em_-1.8em_rgba(0,0,0,0.9)]"
          >
            <div className="flex flex-col gap-[0.9em] border-b border-[var(--cover-paper)]/10 px-[1.6em] py-[1em] md:flex-row md:items-center md:justify-between md:px-[2em]">
              <p className="mono text-[0.62em] uppercase tracking-[0.22em] text-[var(--cover-paper)]/40">
                Odds of qualifying a caller, by how long they waited
              </p>

              <div className="flex flex-wrap gap-[0.35em]">
                {PRESETS.map((p) => {
                  const on = Math.abs(pos - p.pos) < 0.012;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        take();
                        setPos(p.pos);
                      }}
                      aria-pressed={on}
                      className={cn(
                        "rounded-full border px-[0.9em] py-[0.45em] text-[0.7em] leading-none transition-colors duration-200",
                        on
                          ? "border-[var(--cover-brand-lit)]/60 bg-[var(--cover-brand-lit)]/12 text-[var(--cover-brand-lit)]"
                          : "border-[var(--cover-paper)]/12 text-[var(--cover-paper)]/45 hover:border-[var(--cover-paper)]/30 hover:text-[var(--cover-paper)]/80",
                      )}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-[1.6em] md:p-[2em]">
              {/* the plot */}
              <div
                ref={plot}
                role="group"
                aria-label="Relative odds of qualifying a caller against how long they waited to be answered. Drag or use the arrow keys."
                tabIndex={0}
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
                className={cn(
                  "relative h-[15em] touch-none select-none rounded-[0.7em] outline-none md:h-[18em]",
                  "focus-visible:ring-2 focus-visible:ring-[var(--cover-brand-lit)]/50",
                  dragging ? "cursor-grabbing" : "cursor-ew-resize",
                )}
              >
                <svg
                  aria-hidden
                  viewBox={`0 0 ${VB_W} ${VB_H}`}
                  preserveAspectRatio="none"
                  className="absolute inset-0 size-full"
                >
                  <defs>
                    {/* Value evaporating left to right. The fill is lit
                        under the plateau and all but gone past the cliff,
                        so the shape reads before a single label does. */}
                    <linearGradient
                      id="ntv-decay-fill"
                      gradientUnits="userSpaceOnUse"
                      x1="0"
                      y1="0"
                      x2={VB_W}
                      y2="0"
                    >
                      <stop
                        offset="0%"
                        stopColor="var(--cover-brand-lit)"
                        stopOpacity="0.34"
                      />
                      <stop
                        offset={`${posOf(300) * 100}%`}
                        stopColor="var(--cover-brand-lit)"
                        stopOpacity="0.26"
                      />
                      <stop
                        offset={`${posOf(700) * 100}%`}
                        stopColor="var(--cover-brand-lit)"
                        stopOpacity="0.08"
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--cover-brand-lit)"
                        stopOpacity="0.02"
                      />
                    </linearGradient>

                    {/* A veil back down to the panel, so the plateau reads
                        as a lit shelf standing on the page rather than as a
                        flat block of colour filling a quarter of it. */}
                    <linearGradient
                      id="ntv-decay-veil"
                      gradientUnits="userSpaceOnUse"
                      x1="0"
                      y1={TOP}
                      x2="0"
                      y2={BOTTOM}
                    >
                      <stop
                        offset="0%"
                        stopColor="var(--cover-panel)"
                        stopOpacity="0"
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--cover-panel)"
                        stopOpacity="0.78"
                      />
                    </linearGradient>
                  </defs>

                  {/* the measured points, as rules */}
                  {LEAD_DECAY.map((d) => (
                    <line
                      key={d.at}
                      x1={posOf(d.at) * VB_W}
                      y1={TOP - 3}
                      x2={posOf(d.at) * VB_W}
                      y2={BOTTOM}
                      stroke="var(--cover-paper)"
                      strokeOpacity="0.1"
                      strokeWidth="0.25"
                      strokeDasharray="1 1.6"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}

                  <line
                    x1="0"
                    y1={BOTTOM}
                    x2={VB_W}
                    y2={BOTTOM}
                    stroke="var(--cover-paper)"
                    strokeOpacity="0.14"
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                  />

                  <path d={area} fill="url(#ntv-decay-fill)" />
                  <rect
                    x="0"
                    y={TOP}
                    width={VB_W}
                    height={BOTTOM - TOP}
                    fill="url(#ntv-decay-veil)"
                  />
                  <path
                    d={line}
                    fill="none"
                    stroke="var(--cover-brand-lit)"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>

                {/* The three measured points, drawn as HTML rather than as
                    SVG circles. `preserveAspectRatio="none"` is what lets
                    the curve fill any width without a measured viewBox, and
                    it stretches every circle in the same breath — the marks
                    came out as wide ovals, which on a chart reads as an
                    error bar. `vectorEffect` rescues strokes, not geometry. */}
                {LEAD_DECAY.map((d) => (
                  <span
                    key={`pt${d.at}`}
                    aria-hidden
                    className="pointer-events-none absolute size-[0.6em] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--cover-brand-lit)] bg-[var(--cover-panel)]"
                    style={{
                      left: `${posOf(d.at) * 100}%`,
                      top: `${(Y(d.qualify) / VB_H) * 100}%`,
                    }}
                  />
                ))}

                {/* The plateau, named. Three quarters of the axis, and the
                    only stretch where a second costs nothing. */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 left-0 border-r border-dashed border-[var(--cover-brand-lit)]/30"
                  style={{ width: `${posOf(300) * 100}%` }}
                >
                  <span className="mono absolute bottom-[0.5em] left-[0.6em] text-[0.58em] uppercase tracking-[0.2em] text-[var(--cover-brand-lit)]/55">
                    The five-minute plateau
                  </span>
                </div>

                {/* Where the agent stands. Sat at the bottom of the plot it
                    read as a footnote; sat on the shelf it is the point —
                    the claim is about position, not about odds, and that is
                    the only claim this section gets to make for us. */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute left-0"
                  style={{ top: `${(Y(1) / VB_H) * 100}%` }}
                >
                  {/* Dot on the line, label under it. Set on one baseline
                      the two collided — the curve's own stroke ran straight
                      through the words. */}
                  <span className="absolute block size-[0.55em] -translate-y-1/2 rounded-full bg-[var(--cover-brand-lit)] shadow-[0_0_0_0.4em_rgba(192,172,224,0.16)]" />
                  <span
                    className="absolute whitespace-nowrap text-[0.68em] leading-none text-[var(--cover-brand-lit)]"
                    style={{ left: "1.1em", top: "0.55em" }}
                  >
                    Your agent answers here
                  </span>
                </div>

                {/* the playhead */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 w-px bg-[var(--cover-paper)]/45"
                  style={{
                    left: `${pos * 100}%`,
                    transitionProperty: dragging ? "none" : "left",
                    transitionDuration: dragging || reduce ? "0ms" : "120ms",
                  }}
                >
                  <span
                    className="absolute -translate-x-1/2 rounded-full border-2 border-[var(--cover-paper)] bg-[var(--cover-panel)]"
                    style={{
                      top: `${((Y(odds) - 0) / VB_H) * 100}%`,
                      width: "0.7em",
                      height: "0.7em",
                      marginTop: "-0.35em",
                    }}
                  />
                  <span
                    className={cn(
                      "mono absolute top-0 whitespace-nowrap rounded-[0.4em] bg-[var(--cover-ink)]/85 px-[0.55em] py-[0.3em] text-[0.62em] leading-none text-[var(--cover-paper)]",
                      pos > 0.86 ? "right-[0.5em]" : "left-[0.5em]",
                    )}
                  >
                    {fmt(sec)}
                  </span>
                </div>
              </div>

              {/* axis */}
              <div className="relative mt-[0.5em] h-[1.2em]">
                {TICKS.map((t) => (
                  <span
                    key={t}
                    aria-hidden
                    className={cn(
                      "mono absolute top-0 text-[0.6em] tracking-[0.1em] text-[var(--cover-paper)]/35",
                      t === 1 ? "left-0" : t === DECAY_MAX ? "right-0" : "-translate-x-1/2",
                    )}
                    style={
                      t === 1 || t === DECAY_MAX
                        ? undefined
                        : { left: `${posOf(t) * 100}%` }
                    }
                  >
                    {tickLabel(t)}
                  </span>
                ))}
              </div>

              {/* the readout */}
              <div className="mt-[1.8em] grid grid-cols-2 gap-[1.2em] border-t border-[var(--cover-paper)]/10 pt-[1.5em] sm:grid-cols-3">
                <div>
                  <p className="mono text-[0.58em] uppercase tracking-[0.22em] text-[var(--cover-paper)]/35">
                    Answered after
                  </p>
                  <p className="mono mt-[0.4em] text-[1.7em] leading-none tabular-nums tracking-[-0.02em]">
                    {fmt(sec)}
                  </p>
                </div>

                <div>
                  <p className="mono text-[0.58em] uppercase tracking-[0.22em] text-[var(--cover-paper)]/35">
                    Odds of qualifying
                  </p>
                  <p
                    className={cn(
                      "mt-[0.4em] text-[1.7em] font-medium leading-none tabular-nums tracking-[-0.03em] transition-colors duration-300",
                      onPlateau
                        ? "text-[var(--cover-brand-lit)]"
                        : "text-[var(--cover-paper)]/55",
                    )}
                  >
                    {Math.round(odds * 100)}
                    <span className="text-[0.5em] text-[var(--cover-paper)]/35">
                      {" "}
                      of 100
                    </span>
                  </p>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <p className="mono text-[0.58em] uppercase tracking-[0.22em] text-[var(--cover-paper)]/35">
                    Against the first ring
                  </p>
                  <p className="mt-[0.4em] text-[1.7em] font-medium leading-none tabular-nums tracking-[-0.03em]">
                    {onPlateau ? (
                      <span className="text-[var(--cover-brand-lit)]">
                        No difference
                      </span>
                    ) : (
                      <>
                        {worse.toFixed(worse < 10 ? 1 : 0)}×
                        <span className="text-[0.5em] text-[var(--cover-paper)]/45">
                          {" "}
                          worse
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* the sentence, by where the marker sits */}
              <p className="mt-[1.4em] max-w-[46em] text-[0.95em] leading-[1.65] text-[var(--cover-paper)]/60">
                {onPlateau ? (
                  <>
                    Inside the plateau, a second costs nothing —{" "}
                    <span className="text-[var(--cover-paper)]/85">
                      this is the only stretch of the graph where that is true
                    </span>
                    , and it is five minutes wide. It is also the only stretch
                    an always-on agent ever operates in, at any hour, on every
                    call at once.
                  </>
                ) : sec <= 600 ? (
                  <>
                    Past the shelf. MIT measured a{" "}
                    <span className="text-[var(--cover-paper)]/85">
                      fourfold fall by the tenth minute
                    </span>{" "}
                    — the caller is still reachable, but they are no longer
                    reaching for you. Somebody answered while you were
                    deciding to call back.
                  </>
                ) : (
                  <>
                    <span className="text-[var(--cover-paper)]/85">
                      Twenty-one times worse by the half hour
                    </span>{" "}
                    — the study&rsquo;s own headline figure, and the reason a
                    callback is not a save. By now this is not your customer
                    being followed up. It is somebody else&rsquo;s customer
                    being confirmed.
                  </>
                )}
              </p>

              {/* Before any of it: does the call get answered at all. */}
              <div className="mt-[2.2em] border-t border-[var(--cover-paper)]/10 pt-[1.6em]">
                <p className="mono text-[0.58em] uppercase tracking-[0.22em] text-[var(--cover-paper)]/35">
                  And before any of that — where the call actually lands
                </p>

                <div className="mt-[1em] flex h-[2.2em] w-full overflow-hidden rounded-[0.4em]">
                  {CALL_FATE.map((f, i) => (
                    <motion.div
                      key={f.id}
                      initial={reduce ? false : { width: 0 }}
                      animate={inView ? { width: `${f.share * 100}%` } : {}}
                      transition={{
                        duration: 0.9,
                        delay: 0.2 + i * 0.12,
                        ease: EASE,
                      }}
                      className="h-full shrink-0"
                      style={{
                        width: `${f.share * 100}%`,
                        background:
                          i === 0
                            ? "var(--cover-brand-lit)"
                            : i === 1
                              ? "var(--cover-load-1)"
                              : "rgba(222,220,224,0.09)",
                      }}
                    />
                  ))}
                </div>

                <div className="mt-[0.9em] flex flex-wrap gap-x-[1.6em] gap-y-[0.5em]">
                  {CALL_FATE.map((f, i) => (
                    <span
                      key={f.id}
                      className="flex items-center gap-[0.55em] text-[0.76em] leading-none text-[var(--cover-paper)]/55"
                    >
                      <span
                        aria-hidden
                        className="size-[0.7em] shrink-0 rounded-[0.15em]"
                        style={{
                          background:
                            i === 0
                              ? "var(--cover-brand-lit)"
                              : i === 1
                                ? "var(--cover-load-1)"
                                : "rgba(222,220,224,0.14)",
                        }}
                      />
                      <span className="mono tabular-nums text-[var(--cover-paper)]/85">
                        {(f.share * 100).toFixed(1)}%
                      </span>
                      {f.label}
                    </span>
                  ))}
                </div>

                <p className="mt-[1.2em] max-w-[46em] text-[0.95em] leading-[1.65] text-[var(--cover-paper)]/60">
                  Six calls in ten never reach the curve above at all.{" "}
                  <span className="text-[var(--cover-paper)]/85">
                    A business tuning its callback time is arguing about where
                    on the cliff it lands
                  </span>{" "}
                  — having already dropped most of its callers off the edge of
                  it.
                </p>
              </div>
            </div>

            {/* provenance — the section's entire standing */}
            <div className="border-t border-[var(--cover-paper)]/10 bg-[var(--cover-paper)]/[0.025] px-[1.6em] py-[1.1em] md:px-[2em]">
              <p className="mono text-[0.56em] uppercase tracking-[0.22em] text-[var(--cover-paper)]/30">
                Sources
              </p>
              <ul className="mt-[0.7em] flex flex-col gap-[0.5em]">
                {WHY_SOURCES.map((s) => (
                  <li
                    key={s.work}
                    className="text-[0.68em] leading-[1.55] text-[var(--cover-paper)]/40"
                  >
                    {s.work}
                    <span className="text-[var(--cover-paper)]/25">
                      {" "}
                      — {s.detail}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>

        <p aria-live="polite" className="sr-only">
          {driving
            ? `Answered after ${fmt(sec)}: odds of qualifying ${Math.round(
                odds * 100,
              )} of 100, ${
                onPlateau
                  ? "no different from answering on the first ring."
                  : `${worse.toFixed(1)} times worse than answering on the first ring.`
              }`
            : ""}
        </p>
      </div>
    </section>
  );
}
