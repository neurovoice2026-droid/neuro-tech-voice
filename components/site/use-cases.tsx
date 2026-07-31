"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  // React's own, not the DOM global it shadows — `FormEvent` is deprecated
  // in these types on the grounds that no such event exists.
  type SubmitEvent,
} from "react";
import {
  motion,
  AnimatePresence,
  animate,
  useInView,
  useMotionValue,
  useReducedMotion,
} from "framer-motion";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  Building2,
  Clock,
  Radio,
  RotateCcw,
  X,
} from "lucide-react";
import {
  INDUSTRIES,
  USE_CASES_INTRO,
  customIndustry,
  type Industry,
} from "@/lib/site";
import { cn } from "@/lib/utils";
import { Reveal, EASE } from "./reveal";

/**
 * Who it's for — "one day on the line".
 *
 * This section used to be six tiles in a grid: an icon, a trade, a
 * sentence. It answered the only question a grid can answer — am I on the
 * list — and it answered it in the same breath for all six, which is why
 * nobody read past the second one. The claim the business actually needs
 * to land here is bigger than membership: *whatever you do, the phone is
 * how it starts, and a staffed front desk structurally cannot hear all of
 * it.* A grid cannot argue that. A day can.
 *
 * So the section is one instrument instead. Pick a trade and it re-models
 * the day: 24 hourly bars of real call shape, the hours a human is
 * actually at the desk, and one toggle that fills in what the agent picks
 * up. The toggle is the whole section in one gesture — the same day, twice,
 * and the difference between them is the product.
 *
 * Three decisions worth keeping:
 *
 *  · **It plays itself first.** The panel arrives in "without" and flips
 *    on its own about a second and a half later, then walks the trades.
 *    Anything that waits to be clicked on a landing page is not seen. The
 *    first interaction of any kind takes the controls for good — autoplay
 *    that fights the reader is worse than none.
 *  · **It never claims to be telemetry.** The shapes are true to each
 *    trade and the arithmetic is real arithmetic over them, but they are a
 *    model, and the panel's footer says so. A fabricated dashboard buys
 *    one scroll and costs the whole page's credibility.
 *  · **The "not on the list" field is the coverage claim, made payable.**
 *    Type any trade and the instrument answers with a generic day and a
 *    generic script — honestly generic, because we do not know that
 *    business yet. That is the actual product promise: not a vertical, a
 *    briefing.
 *
 * Colour and scale are the interior spread's, unchanged — --cover-panel
 * for the instrument, --cover-brand-lit as the only accent, the
 * --cover-load-* ramp for the bars (it was validated as an ordinal ramp
 * against exactly this panel colour), and every length in `em` off
 * `.cover`'s fluid base so the whole thing breathes with the viewport.
 */

/* ---------------------------------------------------------------- *
 * The model
 * ---------------------------------------------------------------- */

type HourCell = {
  hour: number;
  calls: number;
  /** Calls a staffed desk gets to — zero outside hours, reduced in rush. */
  answered: number;
  staffed: boolean;
};

type DayModel = {
  cells: HourCell[];
  peak: number;
  total: number;
  answeredWithout: number;
  missed: number;
  offHoursShare: number;
  recoveredValue: number;
};

/**
 * The day, costed by walking one phone line through it.
 *
 * The earlier version took a percentage off each hour — `busyMiss` applied
 * in bulk — which produced plausible totals and a chart that could not
 * survive being opened. Expand such an hour into calls and there is no
 * reason *these* three were the ones lost, and nothing stops two "answered"
 * calls from overlapping on a line the page has just called single.
 *
 * So the arithmetic runs the other way now: every hour is expanded into its
 * actual calls first, each one is offered to a single line, and the hour's
 * number is whatever survived. Two things can lose a call, both real —
 * the line is still engaged with the last one, or nobody is free to pick it
 * up. Which means the chart, the tally and the opened hour cannot disagree,
 * because there is only one computation and they all read it.
 */
function modelDay(ind: Industry): DayModel {
  const [open, close] = ind.staffed;

  const cells: HourCell[] = ind.volume.map((calls, hour) => ({
    hour,
    calls,
    answered: hourCalls(ind, hour).filter((c) => c.answered).length,
    staffed: hour >= open && hour < close,
  }));
  const peak = Math.max(...ind.volume);

  const total = cells.reduce((s, c) => s + c.calls, 0);
  const answeredWithout = cells.reduce((s, c) => s + c.answered, 0);
  const offHours = cells.reduce((s, c) => s + (c.staffed ? 0 : c.calls), 0);
  const missed = total - answeredWithout;

  return {
    cells,
    peak,
    total,
    answeredWithout,
    missed,
    offHoursShare: total ? offHours / total : 0,
    recoveredValue: missed * ind.value,
  };
}

const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;
const hhmm = (h: number, m: number) =>
  `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

/* ---------------------------------------------------------------- *
 * One hour, call by call
 * ---------------------------------------------------------------- */

/**
 * A single hour, expanded into the calls that made it.
 *
 * Seeded off the trade and the hour rather than random, for three reasons
 * that all matter: the same bar always opens the same hour, so a reader who
 * closes and reopens is not told a different story about it; the day model
 * above can call this twenty-four times and get a stable total; and nothing
 * here can differ between the server's render and the client's.
 */
type HourCall = {
  start: number;
  dur: number;
  answered: boolean;
  about: string;
  /**
   * Which concurrent line this call would sit on if every one of them were
   * taken — 0 for the first, 1 for one arriving while 0 is still talking.
   * Computed over all of the hour's calls regardless of mode, because it
   * describes the hour rather than the outcome. Without an agent only lane
   * 0 is ever drawn, and it can be: the walk below guarantees no two
   * answered calls overlap.
   */
  lane: number;
};

function fnv1a(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hourCalls(ind: Industry, hour: number): HourCall[] {
  const n = ind.volume[hour];
  if (!n) return [];

  const rnd = mulberry32(fnv1a(`${ind.id}:${ind.label}:${hour}`));
  const [open, close] = ind.staffed;
  const staffed = hour >= open && hour < close;
  const rush = n >= Math.max(...ind.volume) * 0.7;

  // How likely anyone is free to answer at all this hour. Zero outside the
  // staffed window — there is nobody in the building to be free.
  const attend = staffed ? 1 - (rush ? ind.busyMiss : ind.busyMiss * 0.35) : 0;

  // Arrivals start from equal slots so the hour stays legible, but each one
  // drifts well past its own slot. That drift is the point: calls that
  // arrive politely spaced never collide, and an hour with no collision in
  // it cannot show what one line does when two people ring at once. Real
  // calls clump; these clump.
  //
  // Intents rotate from a seeded start rather than being drawn one at a
  // time — drawing independently repeats itself inside a six-row hour often
  // enough to look like a bug.
  const slot = 60 / n;
  const off = Math.floor(rnd() * ind.snippets.length);
  const [tmin, tmax] = ind.talk;

  const arrivals = Array.from({ length: n }, (_, i) => ({
    start: Math.max(
      0,
      Math.min(58, Math.round(i * slot + (rnd() - 0.35) * slot * 1.5)),
    ),
    dur: tmin + Math.round(rnd() * (tmax - tmin)),
    about: ind.snippets[(off + i) % ind.snippets.length],
  })).sort((a, b) => a.start - b.start);

  // The walk. `busyUntil` is the single human line; `lanes` is what the
  // agent would need, one entry per conversation running at once.
  let busyUntil = -1;
  const lanes: number[] = [];

  return arrivals.map((c) => {
    const answered = c.start >= busyUntil && rnd() < attend;
    if (answered) busyUntil = c.start + c.dur;

    let lane = lanes.findIndex((free) => free <= c.start);
    if (lane === -1) {
      lane = lanes.length;
      lanes.push(0);
    }
    lanes[lane] = c.start + c.dur;

    return { ...c, answered, lane };
  });
}

/* ---------------------------------------------------------------- *
 * A number that re-counts every time it changes
 * ---------------------------------------------------------------- */

function Tally({
  value,
  prefix = "",
  className,
}: {
  value: number;
  prefix?: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  // The motion value carries the previous number for us, so each change
  // animates from wherever the last one landed rather than from zero.
  const mv = useMotionValue(value);
  const [counted, setCounted] = useState(value);

  useEffect(() => {
    if (reduce) return;
    const controls = animate(mv, value, {
      duration: 0.7,
      ease: [0.22, 1, 0.36, 1],
    });
    const unsub = mv.on("change", (v) => setCounted(v));
    return () => {
      controls.stop();
      unsub();
    };
  }, [value, reduce, mv]);

  // Reduced motion reads the prop straight through, as CountUp does: the
  // number is already in hand, and writing it into state from an effect
  // only buys a second render to arrive at it.
  const shown = reduce ? value : counted;

  return (
    <span className={cn("tabular-nums", className)}>
      {prefix}
      {Math.round(shown).toLocaleString("en-US")}
    </span>
  );
}

/* ---------------------------------------------------------------- *
 * The day
 * ---------------------------------------------------------------- */

const AXIS_HOURS = [0, 3, 6, 9, 12, 15, 18, 21];

function DayChart({
  day,
  covered,
  staffed,
  label,
  onPick,
}: {
  day: DayModel;
  /** True once the agent is on the line: every bar fills. */
  covered: boolean;
  staffed: [number, number];
  label: string;
  onPick: (hour: number) => void;
}) {
  const reduce = useReducedMotion();
  const plot = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const cell = hover === null ? null : day.cells[hover];

  // Hover is read off the plot rather than off each bar. An hour with no
  // calls is `disabled`, and a disabled button fires no pointer events, so
  // crossing 04:00 on the way to 05:00 left the read-out stranded on
  // whichever hour it had last seen — a tooltip confidently describing an
  // hour the cursor was nowhere near. One handler over the whole plot also
  // covers the hairline gaps between bars, which `pointerenter` never did.
  const track = (e: React.PointerEvent) => {
    const r = plot.current?.getBoundingClientRect();
    if (!r?.width) return;
    // Clamped rather than range-checked: at sub-pixel ratios the last
    // column rounds to 24 and would blank the read-out on the one pixel
    // where it should be reading 23:00. Leaving the plot is what clears it.
    const i = Math.floor(((e.clientX - r.left) / r.width) * 24);
    setHover(Math.min(23, Math.max(0, i)));
  };

  // Roving tabindex. Twenty-four bars are twenty-four tab stops if each one
  // is focusable, which would make the whole page hostile to keyboard use
  // to reach one feature — so the group takes a single stop and the arrows
  // move inside it. Until the reader moves, that stop is the busiest hour,
  // which is the one worth opening anyway.
  //
  // The walk runs over the hours that actually rang. Empty ones are
  // disabled and so cannot take focus, which meant stepping onto one moved
  // the tab stop to an unreachable bar and stranded focus on the bar that
  // had just given it up — the next Tab left the chart entirely. Every
  // trade has six dead hours before dawn, and Home landed inside them.
  const bars = useRef<(HTMLButtonElement | null)[]>([]);
  const live = useMemo(
    () => day.cells.filter((c) => c.calls).map((c) => c.hour),
    [day],
  );
  const peakIdx = day.cells.findIndex((c) => c.calls === day.peak);
  const [roved, setRoved] = useState<number | null>(null);
  // A rove outlives a change of trade only if its hour still rings in the
  // new one; otherwise the stop falls back to that trade's own peak.
  const focusIdx = roved !== null && day.cells[roved]?.calls ? roved : peakIdx;

  const rove = (e: React.KeyboardEvent) => {
    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    const jump = e.key === "Home" ? 0 : e.key === "End" ? live.length - 1 : -1;
    if (!dir && jump < 0) return;
    e.preventDefault();

    const at = live.indexOf(focusIdx);
    const next =
      live[jump >= 0 ? jump : Math.min(Math.max(at + dir, 0), live.length - 1)];
    if (next === undefined) return;
    setRoved(next);
    bars.current[next]?.focus();
  };

  return (
    <div>
      {/* `group`, not `img`. The obvious label for a chart is `role="img"`,
          and it silently makes the whole subtree presentational — which
          would take all twenty-four bar buttons away from a screen reader
          and leave the roving tabindex above driving nothing. The day's
          arithmetic is announced by the live region in the section; here
          the bars speak for themselves. */}
      <div
        ref={plot}
        role="group"
        aria-label={`Calls per hour across one day for ${label} — choose an hour to open it.`}
        className="relative h-[13em] select-none"
        onPointerMove={track}
        onPointerLeave={() => setHover(null)}
      >
        {/* The hours a human is at the desk. Everything outside this band
            is, without an agent, a call nobody hears. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 border-x border-dashed border-[var(--cover-paper)]/22 bg-[var(--cover-paper)]/[0.055]"
          style={{
            left: `${(staffed[0] / 24) * 100}%`,
            width: `${((staffed[1] - staffed[0]) / 24) * 100}%`,
          }}
        />

        <div
          className="relative flex h-full items-end gap-[0.18em]"
          onKeyDown={rove}
        >
          {day.cells.map((c, i) => {
            const barPct = day.peak ? (c.calls / day.peak) * 100 : 0;
            const fillPct = c.calls
              ? ((covered ? c.calls : c.answered) / c.calls) * 100
              : 0;

            return (
              <button
                key={c.hour}
                type="button"
                ref={(el) => {
                  bars.current[i] = el;
                }}
                tabIndex={i === focusIdx ? 0 : -1}
                disabled={!c.calls}
                aria-label={`${hh(c.hour)}, ${c.calls} calls — open this hour`}
                onFocus={() => {
                  setRoved(i);
                  setHover(i);
                }}
                onClick={() => onPick(c.hour)}
                className="group relative flex h-full flex-1 items-end rounded-t-[0.25em] outline-none focus-visible:ring-2 focus-visible:ring-[var(--cover-brand-lit)] enabled:cursor-pointer"
              >
                {/* Full-height hit area, so thin bars are still reachable. */}
                <span aria-hidden className="absolute inset-0" />

                <div
                  className={cn(
                    "relative w-full overflow-hidden rounded-t-[0.25em] transition-colors duration-200",
                    // The uncovered remainder: an empty column, outlined.
                    "border-t border-[var(--cover-paper)]/20 bg-[var(--cover-paper)]/[0.07]",
                    hover === i && "border-[var(--cover-paper)]/50",
                  )}
                  style={{ height: `${barPct}%` }}
                >
                  <motion.div
                    className="absolute inset-x-0 bottom-0"
                    style={{
                      background:
                        "linear-gradient(to top, var(--cover-load-2), var(--cover-load-3))",
                    }}
                    initial={false}
                    animate={{ height: `${fillPct}%` }}
                    transition={
                      reduce
                        ? { duration: 0 }
                        : {
                            duration: 0.55,
                            // Left-to-right sweep across the day — the
                            // moment the toggle is actually selling.
                            delay: i * 0.014,
                            ease: EASE,
                          }
                    }
                  />
                  {/* Hover wash, so a bar reads as a thing you can open. */}
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-0 bg-[var(--cover-paper)]/15 opacity-0 transition-opacity duration-200",
                      hover === i && "opacity-100",
                    )}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* Read-out for the hovered hour.

            Two elements, and the split is load-bearing: the outer one is
            absolutely placed and carries nothing but opacity, because a
            motion component writes its own `transform` and would clobber
            an inline one. The inner shrink-wrapped box does the clamping,
            translating by a share of its own width so the tip stays inside
            the plot at either end of the day. */}
        <AnimatePresence>
          {cell && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="pointer-events-none absolute top-0 z-10"
              style={{ left: `${((cell.hour + 0.5) / 24) * 100}%` }}
            >
              <div
                className="whitespace-nowrap rounded-[0.5em] border border-[var(--cover-paper)]/15 bg-[var(--cover-ink)]/92 px-[0.7em] py-[0.45em] text-[0.68em] leading-tight shadow-[0_0.8em_2em_-0.6em_rgba(0,0,0,0.9)] backdrop-blur-sm"
                style={{
                  transform: `translateX(-${Math.min(
                    92,
                    Math.max(8, ((cell.hour + 0.5) / 24) * 100),
                  )}%)`,
                }}
              >
                <span className="mono text-[var(--cover-paper)]/55">
                  {hh(cell.hour)}
                </span>
                <span className="mx-[0.5em] text-[var(--cover-paper)]/25">
                  /
                </span>

                {/* Reading an hour that never rang is now possible — the
                    plot tracks the pointer across dead bars too — and
                    "0 calls / 0 answered" would light the accent on the
                    strength of 0 === 0. A silent hour just says so. */}
                {cell.calls === 0 ? (
                  <span className="text-[var(--cover-paper)]/45">
                    the phone didn&rsquo;t ring
                  </span>
                ) : (
                  <>
                    <span className="text-[var(--cover-paper)]">
                      {cell.calls} {cell.calls === 1 ? "call" : "calls"}
                    </span>
                    <span className="mx-[0.5em] text-[var(--cover-paper)]/25">
                      /
                    </span>
                    <span
                      className={
                        covered || cell.answered === cell.calls
                          ? "text-[var(--cover-brand-lit)]"
                          : "text-[var(--cover-paper)]/45"
                      }
                    >
                      {covered ? cell.calls : cell.answered} answered
                    </span>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* axis */}
      <div className="relative mt-[0.6em] h-[1em] border-t border-[var(--cover-paper)]/12">
        {AXIS_HOURS.map((h) => (
          <span
            key={h}
            aria-hidden
            className="mono absolute top-[0.35em] -translate-x-1/2 text-[0.62em] tracking-[0.08em] text-[var(--cover-paper)]/35"
            style={{ left: `${((h + 0.5) / 24) * 100}%` }}
          >
            {String(h).padStart(2, "0")}
          </span>
        ))}
      </div>

      <div className="mt-[1.9em] flex flex-wrap items-center justify-between gap-x-[1.2em] gap-y-[0.5em]">
        <p className="flex items-center gap-[0.6em] text-[0.72em] text-[var(--cover-paper)]/45">
          <span
            aria-hidden
            className="inline-block h-[0.85em] w-[1.6em] shrink-0 rounded-[0.15em] border border-dashed border-[var(--cover-paper)]/25 bg-[var(--cover-paper)]/[0.05]"
          />
          Front desk staffed {hh(staffed[0])}–{hh(staffed[1])} ·{" "}
          <span className="text-[var(--cover-paper)]/70">
            {Math.round(day.offHoursShare * 100)}% of the day&rsquo;s calls
            arrive outside it
          </span>
        </p>

        <p className="flex items-center gap-[0.4em] text-[0.72em] text-[var(--cover-brand-lit)]/75">
          Click any hour to watch it play out
          <ArrowRight className="size-[1.1em]" strokeWidth={2} />
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- *
 * The brief — what this trade's caller actually says
 * ---------------------------------------------------------------- */

function Brief({ ind }: { ind: Industry }) {
  const reduce = useReducedMotion();
  const Icon = ind.icon;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={ind.id + ind.label}
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        // `mode="wait"` empties this column until the outgoing brief is
        // gone, so the exit is deliberately about half the entrance: any
        // longer and the panel reads as a hole between two trades.
        exit={
          reduce
            ? undefined
            : { opacity: 0, y: -8, transition: { duration: 0.16 } }
        }
        transition={{ duration: 0.35, ease: EASE }}
      >
        <div className="flex items-center gap-[0.7em] text-[var(--cover-brand-lit)]">
          <Icon className="size-[1.15em] shrink-0" strokeWidth={1.9} />
          <span className="text-[0.78em] font-semibold uppercase leading-none tracking-[0.16em]">
            {ind.label}
          </span>
        </div>

        <p className="mono mt-[2em] text-[0.62em] uppercase tracking-[0.22em] text-[var(--cover-paper)]/35">
          The call
        </p>
        <p className="mt-[0.7em] text-balance text-[1.15em] leading-[1.4] tracking-[-0.02em] text-[var(--cover-paper)]/90">
          &ldquo;{ind.caller}&rdquo;
        </p>

        <p className="mono mt-[1.7em] text-[0.62em] uppercase tracking-[0.22em] text-[var(--cover-paper)]/35">
          The answer
        </p>
        <p className="mt-[0.7em] text-balance text-[1.05em] leading-[1.45] tracking-[-0.015em] text-[var(--cover-brand-lit)]">
          &ldquo;{ind.agent}&rdquo;
        </p>

        <ul className="mt-[1.8em] flex flex-col gap-[0.7em] border-t border-[var(--cover-paper)]/10 pt-[1.4em]">
          {ind.jobs.map((j, i) => (
            <motion.li
              key={j}
              initial={reduce ? false : { opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.1 + i * 0.07, ease: EASE }}
              className="flex items-baseline gap-[0.8em] text-[0.85em] leading-[1.5] text-[var(--cover-paper)]/70"
            >
              <span className="mono shrink-0 text-[0.8em] text-[var(--cover-brand-lit)]/70">
                {String(i + 1).padStart(2, "0")}
              </span>
              {j}
            </motion.li>
          ))}
        </ul>

        <p className="mt-[1.6em] flex items-center gap-[0.6em] text-[0.8em] text-[var(--cover-paper)]/55">
          <ArrowRight
            className="size-[1.1em] shrink-0 text-[var(--cover-brand-lit)]"
            strokeWidth={2}
          />
          {ind.outcome}
        </p>
      </motion.div>
    </AnimatePresence>
  );
}

/* ---------------------------------------------------------------- *
 * The hour, played out
 * ---------------------------------------------------------------- */

/** Seconds the hour takes to play. One minute of real time ≈ 92ms. */
const PLAY = 5.5;

/**
 * The dial.
 *
 * An hour is a circle, so the hour is drawn as one — and that single
 * decision is what turns a chart into an instrument. A row of horizontal
 * tracks has to teach you its axis before it says anything; a clock face
 * does not, and it puts the one number that matters in the middle instead
 * of at the end of a row.
 *
 * The rings carry the argument. Each concentric ring is one conversation
 * running at the same time as the others, so the two modes are not the same
 * picture in different colours — without an agent everything that got
 * through sits on a single outer ring, because there is one line and it can
 * only ever hold one call; with the agent the hour fills inward, a ring per
 * simultaneous conversation. You do not read that difference. You see it.
 *
 * Every arc draws over the real length of its call, so the sweep is not
 * decoration either: it is the hour passing at ninety-two milliseconds to
 * the minute.
 */

/**
 * Ring radii by concurrency depth, in the 0–100 viewBox.
 *
 * Everything is pulled well inside 50 on purpose: the quarter labels sit at
 * r=47.5 and are drawn *inside* the same viewBox, so a ring stack that runs
 * out to 37 leaves no room and the labels get clipped at the frame.
 */
const LANE_R = [34, 29, 24, 19, 14];
const laneR = (l: number) => LANE_R[Math.min(l, LANE_R.length - 1)];

/** Minute → point on a circle of radius r, with :00 at the top. */
function pt(minute: number, r: number): [number, number] {
  const a = (minute / 60) * Math.PI * 2 - Math.PI / 2;
  return [50 + r * Math.cos(a), 50 + r * Math.sin(a)];
}

function arcPath(from: number, to: number, r: number) {
  const [x0, y0] = pt(from, r);
  const [x1, y1] = pt(Math.min(to, from + 59.5), r);
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${
    to - from > 30 ? 1 : 0
  } 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

const QUARTERS = [0, 15, 30, 45];

function HourDial({
  calls,
  covered,
  handled,
  reduce,
}: {
  calls: HourCall[];
  covered: boolean;
  handled: number;
  reduce: boolean | null;
}) {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[17em]">
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full">
        <defs>
          <linearGradient
            id="ntv-sweep"
            gradientUnits="userSpaceOnUse"
            x1="50"
            y1="6"
            x2="50"
            y2="50"
          >
            <stop
              offset="0%"
              stopColor="var(--cover-brand-lit)"
              stopOpacity="0.95"
            />
            <stop
              offset="100%"
              stopColor="var(--cover-brand-lit)"
              stopOpacity="0"
            />
          </linearGradient>
        </defs>

        {/* The lines themselves, drawn whether or not anything is on them.
            This is the argument standing still: one ring without an agent,
            because there is one line — a ring per simultaneous conversation
            with it. The reader sees the difference before a single arc has
            started to draw. */}
        {(covered
          ? [...new Set(calls.map((c) => c.lane))].sort((a, b) => a - b)
          : [0]
        ).map((l) => (
          <circle
            key={`ring${l}`}
            cx="50"
            cy="50"
            r={laneR(l)}
            fill="none"
            stroke="var(--cover-paper)"
            strokeOpacity="0.1"
            strokeWidth="3"
          />
        ))}

        {/* Sixty minute ticks. The detail that makes it read as an
            instrument rather than as a doughnut chart. */}
        <g>
          {Array.from({ length: 60 }, (_, m) => {
            const major = m % 5 === 0;
            const [x0, y0] = pt(m, major ? 38.6 : 40);
            const [x1, y1] = pt(m, 41.8);
            return (
              <line
                key={m}
                x1={x0}
                y1={y0}
                x2={x1}
                y2={y1}
                stroke="var(--cover-paper)"
                strokeOpacity={major ? 0.34 : 0.14}
                strokeWidth={major ? 0.7 : 0.4}
                strokeLinecap="round"
              />
            );
          })}
        </g>

        {/* The hour completing, as an outer ring. */}
        <g transform="rotate(-90 50 50)">
          <circle
            cx="50"
            cy="50"
            r="44.2"
            fill="none"
            stroke="var(--cover-paper)"
            strokeOpacity="0.08"
            strokeWidth="0.5"
          />
          <motion.circle
            cx="50"
            cy="50"
            r="44.2"
            fill="none"
            stroke="var(--cover-brand-lit)"
            strokeOpacity="0.55"
            strokeWidth="0.7"
            strokeLinecap="round"
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: reduce ? 0 : PLAY, ease: "linear" }}
          />
        </g>

        {/* Ghost tracks — where each call will land, so the hour has a
            shape before a single arc has drawn. */}
        {calls.map((c, i) => {
          const r = covered ? laneR(c.lane) : laneR(0);
          return (
            <path
              key={`g${i}`}
              d={arcPath(c.start, c.start + c.dur, r)}
              fill="none"
              stroke="var(--cover-paper)"
              strokeOpacity="0.09"
              strokeWidth="3"
              strokeLinecap="round"
            />
          );
        })}

        {calls.map((c, i) => {
          // Without an agent, everything that got through is on one ring,
          // because there is one line. With the agent, the hour fills
          // inward. The radius is the whole argument.
          const on = covered || c.answered;
          const r = covered ? laneR(c.lane) : laneR(0);
          const d = arcPath(c.start, c.start + c.dur, r);
          const at = reduce ? 0 : (c.start / 60) * PLAY;
          const over = reduce ? 0 : (c.dur / 60) * PLAY;

          if (!on) {
            return (
              <motion.path
                key={`m${i}`}
                d={d}
                fill="none"
                stroke="var(--cover-paper)"
                strokeWidth="3"
                strokeLinecap="butt"
                strokeDasharray="0.9 1.8"
                initial={reduce ? false : { strokeOpacity: 0 }}
                animate={{ strokeOpacity: 0.3 }}
                transition={{ duration: 0.3, delay: at }}
              />
            );
          }

          return (
            <g key={`h${i}`}>
              {/* bloom, then the line itself */}
              <motion.path
                d={d}
                fill="none"
                stroke="var(--cover-brand-lit)"
                strokeOpacity="0.18"
                strokeWidth="6.5"
                strokeLinecap="round"
                initial={reduce ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: over, delay: at, ease: "linear" }}
              />
              <motion.path
                d={d}
                fill="none"
                stroke="var(--cover-brand-lit)"
                strokeWidth="3"
                strokeLinecap="round"
                initial={reduce ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: over, delay: at, ease: "linear" }}
              />
            </g>
          );
        })}

        {/* The sweep. A bounding rect gives the group a full-dial bbox, so
            `fill-box` puts the rotation origin at the centre rather than at
            the middle of the hand. */}
        {!reduce && (
          <motion.g
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
            initial={{ rotate: 0, opacity: 0 }}
            animate={{ rotate: 360, opacity: [0, 1, 1, 0] }}
            transition={{
              duration: PLAY,
              ease: "linear",
              opacity: { duration: PLAY, times: [0, 0.02, 0.94, 1] },
            }}
          >
            <rect x="0" y="0" width="100" height="100" fill="none" />
            <line
              x1="50"
              y1="6"
              x2="50"
              y2="50"
              stroke="url(#ntv-sweep)"
              strokeWidth="0.9"
            />
            <circle
              cx="50"
              cy="6.4"
              r="1.5"
              fill="var(--cover-brand-lit)"
            />
          </motion.g>
        )}

        {QUARTERS.map((m) => {
          const [x, y] = pt(m, 47.3);
          return (
            <text
              key={m}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="var(--cover-paper)"
              fillOpacity="0.3"
              style={{ fontSize: 3.4, fontFamily: "var(--font-mono)" }}
            >
              {String(m).padStart(2, "0")}
            </text>
          );
        })}
      </svg>

      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="text-center">
          <p className="text-[3em] font-medium leading-none tracking-[-0.05em] text-[var(--cover-brand-lit)]">
            {handled}
          </p>
          <p className="mono mt-[0.7em] text-[0.58em] uppercase tracking-[0.24em] text-[var(--cover-paper)]/45">
            handled
          </p>
          <p className="mono mt-[0.35em] text-[0.58em] tracking-[0.14em] text-[var(--cover-paper)]/30">
            of {calls.length}
          </p>
        </div>
      </div>
    </div>
  );
}

function HourPlayer({
  ind,
  cell,
  covered,
}: {
  ind: Industry;
  cell: HourCell;
  covered: boolean;
}) {
  const reduce = useReducedMotion();
  const calls = useMemo(() => hourCalls(ind, cell.hour), [ind, cell.hour]);
  const [landed, setLanded] = useState(0);

  // One timer per call, fired as the sweep reaches it. The component is
  // remounted by its key whenever the hour or the mode changes, so this
  // never has to reset anything — it only ever counts up from zero.
  useEffect(() => {
    if (reduce) return;
    const timers = calls.map((c, i) =>
      setTimeout(
        () => setLanded((n) => Math.max(n, i + 1)),
        (c.start / 60) * PLAY * 1000 + 140,
      ),
    );
    return () => timers.forEach(clearTimeout);
  }, [calls, reduce]);

  const shown = reduce ? calls.length : landed;
  const seen = calls.slice(0, shown);
  const handled = seen.filter((c) => covered || c.answered).length;
  const lost = shown - handled;
  const lanes = covered
    ? Math.max(1, ...calls.map((c) => c.lane + 1))
    : 1;

  return (
    <div className="grid gap-[2em] md:grid-cols-[17em_1fr] md:items-center md:gap-[2.5em]">
      <HourDial
        calls={calls}
        covered={covered}
        handled={handled}
        reduce={reduce}
      />

      <div>
        {/* The manifest. The dial says how the hour went; this says who was
            on the other end of it, which is the part a business recognises
            as its own. */}
        <div className="mono flex items-center justify-between text-[0.58em] uppercase tracking-[0.22em] text-[var(--cover-paper)]/30">
          <span>Inbound</span>
          <span>{covered ? "Neuro Tech Voice" : "One line"}</span>
        </div>

        <ul className="mt-[1.1em] flex flex-col">
          {calls.map((c, i) => {
            const on = covered || c.answered;
            const at = reduce ? 0 : (c.start / 60) * PLAY;
            return (
              <motion.li
                key={i}
                className="grid grid-cols-[0.9em_3.4em_1fr_auto] items-baseline gap-[0.7em] border-b border-[var(--cover-paper)]/[0.07] py-[0.6em] last:border-b-0"
                // A row waits as a ghost rather than as nothing: empty space
                // that fills over six seconds reads as a panel still
                // loading, and the hour's shape should be legible from the
                // first frame.
                initial={reduce ? false : { opacity: 0.16 }}
                animate={{ opacity: on ? 1 : 0.62 }}
                transition={{ duration: 0.32, delay: at, ease: EASE }}
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-[0.35em] size-[0.5em] shrink-0 rounded-full",
                    on
                      ? "bg-[var(--cover-brand-lit)]"
                      : "border border-[var(--cover-paper)]/40",
                  )}
                />
                <span className="mono text-[0.68em] text-[var(--cover-paper)]/40">
                  {hhmm(cell.hour, c.start)}
                </span>
                <span
                  className={cn(
                    "truncate text-[0.82em] leading-tight",
                    on
                      ? "text-[var(--cover-paper)]/80"
                      : "text-[var(--cover-paper)]/40",
                  )}
                >
                  &ldquo;{c.about}&rdquo;
                </span>
                <span
                  className={cn(
                    "mono text-[0.6em] uppercase tracking-[0.14em]",
                    on
                      ? "text-[var(--cover-brand-lit)]/80"
                      : "text-[var(--cover-paper)]/35",
                  )}
                >
                  {on ? <span className="normal-case">{c.dur} min</span> : "missed"}
                </span>
              </motion.li>
            );
          })}
        </ul>

        <div className="mt-[1.4em] flex flex-wrap items-baseline gap-x-[1.6em] gap-y-[0.4em]">
          <p className="mono text-[0.62em] uppercase tracking-[0.16em] text-[var(--cover-paper)]/40">
            {covered ? "Concurrent lines" : "Lines available"}
            <span className="ml-[0.8em] text-[1.5em] tracking-normal text-[var(--cover-brand-lit)]">
              {lanes}
            </span>
          </p>
          {lost > 0 && (
            <p className="mono text-[0.62em] uppercase tracking-[0.16em] text-[var(--cover-paper)]/40">
              To voicemail
              <span className="ml-[0.8em] text-[1.5em] tracking-normal text-[var(--cover-paper)]/60">
                {lost}
              </span>
            </p>
          )}
        </div>
      </div>

      <p className="text-[0.85em] leading-[1.6] text-[var(--cover-paper)]/55 md:col-span-2">
        {/* Three different true things, and which one is true depends on the
            hour. A quiet hour has no overlap to point at, and an hour with
            the doors shut has a better argument than either — so the copy
            picks rather than asserting the same claim everywhere. */}
        {covered && !cell.staffed ? (
          <>
            Answered at {hh(cell.hour)}, with the front desk closed.{" "}
            <span className="text-[var(--cover-paper)]/85">
              Every one of these would have been a voicemail
            </span>{" "}
            — and a voicemail at this hour is a customer who has already
            called somebody else by morning.
          </>
        ) : covered && lanes > 1 ? (
          <>
            Every call taken, across{" "}
            <span className="text-[var(--cover-paper)]/85">
              {lanes} conversations running at once
            </span>{" "}
            — one ring per simultaneous call. A staffed desk has exactly one
            ring, and that is the whole difference.
          </>
        ) : covered ? (
          <>
            Every call taken on the first ring,{" "}
            <span className="text-[var(--cover-paper)]/85">
              without anyone stepping off the floor
            </span>{" "}
            — no hold, no callback list, nothing queued behind it.
          </>
        ) : cell.staffed ? (
          <>
            One line, one conversation.{" "}
            <span className="text-[var(--cover-paper)]/85">
              {cell.calls - cell.answered} of these never got through
            </span>{" "}
            — the line was still engaged, or {ind.busyReason}.
          </>
        ) : (
          <>
            Nobody was at the desk.{" "}
            <span className="text-[var(--cover-paper)]/85">
              Every one of these went to voicemail
            </span>{" "}
            — the hour is outside {hh(ind.staffed[0])}–{hh(ind.staffed[1])}.
          </>
        )}
      </p>
    </div>
  );
}

function HourModal({
  ind,
  cell,
  covered,
  onCovered,
  onClose,
}: {
  ind: Industry;
  cell: HourCell;
  covered: boolean;
  onCovered: (v: boolean) => void;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const [run, setRun] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  /**
   * The three things that separate a dialog from a div drawn on top.
   *
   * `aria-modal` announces one; it does not make one. Behind the backdrop
   * the page was still scrollable — a drag anywhere on a phone moved the
   * landing page under it, so closing put the reader somewhere else
   * entirely — Tab walked straight out into the navbar, and closing left
   * focus on `<body>`, which sends the next Tab back to the top of the
   * document. A reader who opened 09:00 from the keyboard lost their place
   * to look at it.
   *
   * Runs once per opened hour: `onClose` is memoised upstream so that
   * toggling the mode inside the modal re-renders the parent without
   * tearing this down and snatching focus back to the close button.
   */
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const body = document.body;
    const prev = {
      overflow: body.style.overflow,
      paddingRight: body.style.paddingRight,
    };
    // Hiding the overflow reclaims the scrollbar's width, which shunts the
    // whole page sideways behind a translucent backdrop where it is very
    // visible. Pad by exactly what the bar was taking so nothing moves.
    const bar = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (bar > 0) body.style.paddingRight = `${bar}px`;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const f = panel.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, [tabindex]:not([tabindex="-1"])',
      );
      if (!f?.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      const on = document.activeElement;

      // Wrap at whichever end we are leaving, and pull focus back in if it
      // has escaped already — the backdrop is a sibling of the panel, so a
      // click on it lands focus outside without closing on every browser.
      if (e.shiftKey && (on === first || !panel.current?.contains(on))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (on === last || !panel.current?.contains(on))) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();

    return () => {
      window.removeEventListener("keydown", onKey);
      body.style.overflow = prev.overflow;
      body.style.paddingRight = prev.paddingRight;
      opener?.focus?.();
    };
  }, [onClose]);

  return createPortal(
    // `.cover` again, on the portal root: the palette and the fluid `em`
    // base live on that class, and the modal is mounted on <body>, outside
    // the spread that would otherwise have given it both.
    <div
      className="cover fixed inset-0 z-[100] flex items-center justify-center p-[1em] text-[var(--cover-paper)]"
      style={{ fontFamily: "var(--font-display)" }}
      role="dialog"
      aria-modal="true"
      aria-label={`${ind.label}, ${hh(cell.hour)} — ${cell.calls} calls`}
    >
      <motion.div
        aria-hidden
        onClick={onClose}
        className="absolute inset-0 bg-[var(--cover-ink)]/88 backdrop-blur-md"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
      />

      <motion.div
        ref={panel}
        className="relative max-h-[88dvh] w-full max-w-[46em] overflow-y-auto overscroll-contain rounded-[1.2em] border border-[var(--cover-paper)]/12 bg-[var(--cover-panel)] shadow-[0_3em_7em_-2em_rgba(0,0,0,0.95)]"
        initial={reduce ? false : { opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduce ? undefined : { opacity: 0, y: 10, scale: 0.99 }}
        transition={{ duration: 0.35, ease: EASE }}
      >
        <div className="flex items-start justify-between gap-[1em] border-b border-[var(--cover-paper)]/10 p-[1.6em] md:p-[2em]">
          <div>
            <p className="mono text-[0.62em] uppercase tracking-[0.22em] text-[var(--cover-brand-lit)]">
              {ind.label}
            </p>
            <h3 className="mt-[0.5em] text-[2em] font-medium leading-none tracking-[-0.04em]">
              {hh(cell.hour)}–{hh((cell.hour + 1) % 24)}
            </h3>
            <p className="mt-[0.7em] text-[0.9em] text-[var(--cover-paper)]/55">
              {cell.calls} {cell.calls === 1 ? "call" : "calls"} arrived in
              this hour. Here is every one of them.
            </p>
          </div>

          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-[2.4em] shrink-0 place-items-center rounded-full border border-[var(--cover-paper)]/15 text-[var(--cover-paper)]/60 transition-colors duration-200 hover:border-[var(--cover-paper)]/35 hover:text-[var(--cover-paper)]"
          >
            <X className="size-[1.1em]" strokeWidth={2} />
          </button>
        </div>

        <div className="p-[1.6em] md:p-[2em]">
          <div className="mb-[1.6em] flex flex-wrap items-center justify-between gap-[1em]">
            <div className="flex rounded-full border border-[var(--cover-paper)]/12 bg-[var(--cover-paper)]/[0.05] p-[0.25em] text-[0.72em]">
              {[
                { on: false, label: "Without an agent" },
                { on: true, label: "With Neuro Tech Voice" },
              ].map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  aria-pressed={covered === opt.on}
                  onClick={() => onCovered(opt.on)}
                  className={cn(
                    "relative rounded-full px-[1em] py-[0.5em] leading-none transition-colors duration-200",
                    covered === opt.on
                      ? "text-[var(--cover-ink)]"
                      : "text-[var(--cover-paper)]/55 hover:text-[var(--cover-paper)]/85",
                  )}
                >
                  {covered === opt.on && (
                    <motion.span
                      layoutId="wif-hour-mode"
                      aria-hidden
                      className="absolute inset-0 rounded-full bg-[var(--cover-brand-lit)]"
                      transition={{ duration: reduce ? 0 : 0.4, ease: EASE }}
                    />
                  )}
                  <span className="relative">{opt.label}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setRun((r) => r + 1)}
              className="flex items-center gap-[0.5em] rounded-full border border-[var(--cover-paper)]/15 px-[1em] py-[0.55em] text-[0.72em] leading-none text-[var(--cover-paper)]/60 transition-colors duration-200 hover:border-[var(--cover-paper)]/35 hover:text-[var(--cover-paper)]"
            >
              <RotateCcw className="size-[1.1em]" strokeWidth={2} />
              Replay
            </button>
          </div>

          {/* Remounting is the replay: every timer and every entrance in
              there is keyed off mount, so a new key is a clean run. */}
          <HourPlayer
            key={`${ind.id}-${cell.hour}-${covered}-${run}`}
            ind={ind}
            cell={cell}
            covered={covered}
          />
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

/* ---------------------------------------------------------------- *
 * Section
 * ---------------------------------------------------------------- */

/** Seconds a trade holds while the panel is playing itself. */
const DWELL = 7.8;

export function UseCases() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20% 0px -20% 0px" });

  const [custom, setCustom] = useState<Industry | null>(null);
  const [activeId, setActiveId] = useState(INDUSTRIES[0].id);
  const [flipped, setFlipped] = useState(false);
  // One flag for the whole autoplay: the first deliberate interaction of
  // any kind hands the panel over and it never takes it back.
  const [driving, setDriving] = useState(false);
  const [draft, setDraft] = useState("");
  const [openHour, setOpenHour] = useState<number | null>(null);

  const list = useMemo(
    () => (custom ? [...INDUSTRIES, custom] : INDUSTRIES),
    [custom],
  );
  const active = list.find((i) => i.id === activeId) ?? list[0];
  const day = useMemo(() => modelDay(active), [active]);

  const takeOver = useCallback(() => setDriving(true), []);
  // Stable, because the modal's scroll lock and focus trap are keyed to it:
  // a fresh closure every render would tear both down and re-take focus
  // every time the mode toggle inside the modal re-rendered this section.
  const closeHour = useCallback(() => setOpenHour(null), []);

  // Beat one: the day arrives uncovered, then fills itself. `driving` is a
  // dependency so that a reader who reaches the toggle inside the first
  // second and a half cancels the flip rather than being overruled by it.
  useEffect(() => {
    if (!inView || driving || reduce) return;
    const t = setTimeout(() => setFlipped(true), 1600);
    return () => clearTimeout(t);
  }, [inView, reduce, driving]);

  // Reduced motion has asked us not to run the flip, and the flip is the
  // entire payoff — so it gets the covered day outright instead. Derived
  // rather than written into state, so the toggle still works: once the
  // reader touches anything, `flipped` takes over for both branches.
  const covered = reduce && !driving ? true : flipped;

  // Beat two: walk the trades until the reader takes the controls. An open
  // hour also halts it — advancing the trade under a modal would swap the
  // day out from under the hour the reader is watching.
  const autoplay = inView && !driving && !reduce && openHour === null;
  useEffect(() => {
    if (!autoplay) return;
    const t = setTimeout(() => {
      const i = INDUSTRIES.findIndex((x) => x.id === activeId);
      setActiveId(INDUSTRIES[(i + 1) % INDUSTRIES.length].id);
    }, DWELL * 1000);
    return () => clearTimeout(t);
  }, [autoplay, activeId]);

  const pick = (id: string) => {
    takeOver();
    setActiveId(id);
  };

  const submitCustom = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const label = draft.trim().slice(0, 34);
    if (!label) return;
    takeOver();
    setCustom(customIndustry(label));
    setActiveId("custom");
    setDraft("");
  };

  const answered = covered ? day.total : day.answeredWithout;

  return (
    <section
      id="use-cases"
      className="relative scroll-mt-24 px-[1.6em] py-[6em] md:py-[8em]"
    >
      <div className="relative mx-auto max-w-[76em]">
        {/* header */}
        <div className="mx-auto flex max-w-[40em] flex-col items-center text-center">
          <Reveal>
            <span className="inline-flex items-center gap-[0.55em] rounded-full border border-[var(--cover-brand-lit)]/25 bg-[var(--cover-brand-lit)]/10 px-[1.15em] py-[0.5em] text-[0.72em] font-semibold uppercase leading-none tracking-[0.18em] text-[var(--cover-brand-lit)]">
              <Radio className="size-[1.25em] shrink-0" strokeWidth={2} />
              {USE_CASES_INTRO.eyebrow}
            </span>
          </Reveal>

          <Reveal delay={0.06} className="mt-[1em]">
            <h2 className="text-balance text-[2.8em] font-medium leading-[1.03] tracking-[-0.045em] md:text-[3.4em]">
              {USE_CASES_INTRO.title}
            </h2>
          </Reveal>

          <Reveal
            delay={0.12}
            className="mt-[1.1em] max-w-[34em] text-pretty text-[1.05em] leading-[1.6] text-[var(--cover-paper)]/60"
          >
            {USE_CASES_INTRO.sub}
          </Reveal>
        </div>

        {/* the instrument */}
        <Reveal delay={0.08} y={32} className="mt-[3.5em] md:mt-[4.5em]">
          <div
            ref={ref}
            className="overflow-hidden rounded-[1.2em] border border-[var(--cover-paper)]/12 bg-[var(--cover-panel)] shadow-[0_2em_5em_-1.8em_rgba(0,0,0,0.9)]"
          >
            {/* Selector rail. Scrolls as one row on a phone; wraps and
                centres once there is room, because a centred row inside an
                overflow container puts its own left end out of reach. */}
            <div className="flex gap-[0.4em] overflow-x-auto border-b border-[var(--cover-paper)]/10 px-[1.2em] py-[0.9em] [scrollbar-width:none] md:flex-wrap md:justify-center md:overflow-x-visible [&::-webkit-scrollbar]:hidden">
              {list.map((ind) => {
                const on = ind.id === activeId;
                const Icon = ind.icon;
                return (
                  <button
                    key={ind.id}
                    type="button"
                    onClick={() => pick(ind.id)}
                    onPointerEnter={takeOver}
                    aria-pressed={on}
                    className={cn(
                      "relative flex shrink-0 items-center gap-[0.5em] overflow-hidden rounded-full px-[1em] py-[0.55em] text-[0.78em] leading-none transition-colors duration-200",
                      on
                        ? "bg-[var(--cover-paper)]/10 text-[var(--cover-paper)]"
                        : "text-[var(--cover-paper)]/45 hover:bg-[var(--cover-paper)]/[0.06] hover:text-[var(--cover-paper)]/80",
                    )}
                  >
                    <Icon className="size-[1.15em] shrink-0" strokeWidth={1.8} />
                    {ind.label}

                    {/* dwell hairline — only while the panel is playing itself */}
                    {on && autoplay && (
                      <motion.span
                        key={ind.id}
                        aria-hidden
                        className="absolute inset-x-0 bottom-0 h-[1.5px] origin-left bg-[var(--cover-brand-lit)]"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: DWELL, ease: "linear" }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5">
              {/* the brief */}
              <div className="border-b border-[var(--cover-paper)]/10 p-[1.6em] md:col-span-2 md:border-b-0 md:border-r md:p-[2em]">
                <Brief ind={active} />
              </div>

              {/* The day. Reaching the chart at all stops the carousel: a
                  reader studying an hour must not have the trade swapped
                  under the cursor between deciding to click and clicking. */}
              <div
                className="p-[1.6em] md:col-span-3 md:p-[2em]"
                onPointerEnter={takeOver}
              >
                <div className="flex flex-wrap items-center justify-between gap-[1em]">
                  <div className="flex items-center gap-[0.55em] text-[var(--cover-paper)]/45">
                    <Clock className="size-[1em] shrink-0" strokeWidth={1.9} />
                    <span className="mono text-[0.66em] uppercase tracking-[0.2em]">
                      One day on the line
                    </span>
                  </div>

                  {/* the toggle — the section's whole argument, in one control */}
                  <div className="flex rounded-full border border-[var(--cover-paper)]/12 bg-[var(--cover-paper)]/[0.05] p-[0.25em] text-[0.72em]">
                    {[
                      { on: false, label: "Without an agent" },
                      { on: true, label: "With Neuro Tech Voice" },
                    ].map((opt) => (
                      <button
                        key={opt.label}
                        type="button"
                        aria-pressed={covered === opt.on}
                        onClick={() => {
                          takeOver();
                          setFlipped(opt.on);
                        }}
                        className={cn(
                          "relative rounded-full px-[1em] py-[0.5em] leading-none transition-colors duration-200",
                          covered === opt.on
                            ? "text-[var(--cover-ink)]"
                            : "text-[var(--cover-paper)]/55 hover:text-[var(--cover-paper)]/85",
                        )}
                      >
                        {covered === opt.on && (
                          <motion.span
                            layoutId="wif-mode"
                            aria-hidden
                            className="absolute inset-0 rounded-full bg-[var(--cover-brand-lit)]"
                            transition={{
                              duration: reduce ? 0 : 0.4,
                              ease: EASE,
                            }}
                          />
                        )}
                        <span className="relative">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* The toggle is the section's whole argument and it was
                    silent: `aria-pressed` reports the state of a control,
                    never what flipping it did to the day. This says the
                    outcome, and says it for a change of trade too.

                    Live only once the reader is driving. The panel walks
                    the trades by itself every 7.8s, and a region that
                    announced each of those would talk over the page for as
                    long as the section stayed on screen. Off, it is still
                    read in place — it just stops interrupting. */}
                <p aria-live={driving ? "polite" : "off"} className="sr-only">
                  {active.label}, one day on the line —{" "}
                  {covered
                    ? `with Neuro Tech Voice, all ${day.total} calls answered, ${day.missed} of them recovered.`
                    : `without an agent, ${day.answeredWithout} of ${day.total} calls answered and ${day.missed} to voicemail.`}
                </p>

                <div className="mt-[1.6em]">
                  <DayChart
                    day={day}
                    covered={covered}
                    staffed={active.staffed}
                    label={active.label}
                    onPick={(h) => {
                      takeOver();
                      setOpenHour(h);
                    }}
                  />
                </div>

                {/* the arithmetic */}
                <div className="mt-[1.6em] grid grid-cols-2 gap-[1em] border-t border-[var(--cover-paper)]/10 pt-[1.4em] sm:grid-cols-3">
                  <div>
                    <p className="mono text-[0.6em] uppercase tracking-[0.2em] text-[var(--cover-paper)]/35">
                      Calls in
                    </p>
                    <Tally
                      value={day.total}
                      className="mt-[0.35em] block text-[1.7em] font-medium leading-none tracking-[-0.03em]"
                    />
                  </div>

                  <div>
                    <p className="mono text-[0.6em] uppercase tracking-[0.2em] text-[var(--cover-paper)]/35">
                      Answered
                    </p>
                    <Tally
                      value={answered}
                      className={cn(
                        "mt-[0.35em] block text-[1.7em] font-medium leading-none tracking-[-0.03em] transition-colors duration-500",
                        covered
                          ? "text-[var(--cover-brand-lit)]"
                          : "text-[var(--cover-paper)]",
                      )}
                    />
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <p className="mono text-[0.6em] uppercase tracking-[0.2em] text-[var(--cover-paper)]/35">
                      {covered ? "Recovered" : "To voicemail"}
                    </p>
                    <div className="mt-[0.35em] flex items-baseline gap-[0.5em]">
                      <span
                        className={cn(
                          "text-[1.7em] font-medium leading-none tracking-[-0.03em] transition-colors duration-500",
                          covered
                            ? "text-[var(--cover-brand-lit)]"
                            : "text-[var(--cover-paper)]/45",
                        )}
                      >
                        {covered ? "+" : "−"}
                        {day.missed}
                      </span>
                      <span
                        className={cn(
                          "text-[0.85em] transition-colors duration-500",
                          covered
                            ? "text-[var(--cover-paper)]/70"
                            : "text-[var(--cover-paper)]/35",
                        )}
                      >
                        <Tally value={day.recoveredValue} prefix="$" />
                        <span className="text-[var(--cover-paper)]/35">
                          {" "}
                          / day
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* provenance — this is a model, and it says so */}
            <p className="border-t border-[var(--cover-paper)]/10 bg-[var(--cover-paper)]/[0.025] px-[1.6em] py-[0.9em] text-[0.68em] leading-[1.6] text-[var(--cover-paper)]/40 md:px-[2em]">
              Modelled day, not live telemetry — call shapes are typical of
              each trade, and the figure is expected booked value per recovered
              call, already net of the calls that never convert. Your agent
              runs on your hours, your services and your own calendar.
            </p>
          </div>
        </Reveal>

        {/* the coverage claim, made payable */}
        <Reveal
          delay={0.1}
          className="mx-auto mt-[3em] flex max-w-[42em] flex-col items-center text-center"
        >
          <p className="text-[1.05em] leading-[1.6] text-[var(--cover-paper)]/60">
            Not on the list? Neuro Tech Voice isn&rsquo;t built for a vertical
            — it&rsquo;s briefed on yours.
          </p>

          <form
            onSubmit={submitCustom}
            className="mt-[1.2em] flex w-full max-w-[30em] items-center gap-[0.5em] rounded-full border border-[var(--cover-paper)]/15 bg-[var(--cover-panel)] p-[0.4em] focus-within:border-[var(--cover-brand-lit)]/50"
          >
            <label htmlFor="industry-draft" className="sr-only">
              Your industry
            </label>
            <Building2
              aria-hidden
              className="ml-[0.7em] size-[1.05em] shrink-0 text-[var(--cover-paper)]/35"
              strokeWidth={1.9}
            />
            <input
              id="industry-draft"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onFocus={takeOver}
              maxLength={34}
              placeholder="Veterinary, gyms, property management…"
              className="min-w-0 flex-1 bg-transparent text-[0.9em] text-[var(--cover-paper)] outline-none placeholder:text-[var(--cover-paper)]/30"
            />
            <button
              type="submit"
              className="flex shrink-0 items-center gap-[0.45em] rounded-full bg-[var(--cover-brand-lit)] px-[1.1em] py-[0.65em] text-[0.78em] font-medium leading-none text-[var(--cover-ink)] transition-opacity duration-200 hover:opacity-85"
            >
              Brief the agent
              <ArrowRight className="size-[1.1em]" strokeWidth={2.2} />
            </button>
          </form>
        </Reveal>
      </div>

      <AnimatePresence>
        {openHour !== null && (
          <HourModal
            key="hour"
            ind={active}
            cell={day.cells[openHour]}
            covered={covered}
            onCovered={setFlipped}
            onClose={closeHour}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
