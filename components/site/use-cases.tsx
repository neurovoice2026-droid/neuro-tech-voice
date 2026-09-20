"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  animate,
  useInView,
  useMotionValue,
  useReducedMotion,
} from "framer-motion";
import { ArrowRight, Clock } from "lucide-react";
import {
  INDUSTRIES,
  INDUSTRIES_GATEWAY,
  NAV_INDUSTRIES,
  USE_CASES_INTRO,
  type Industry,
} from "@/lib/site";
import { cn } from "@/lib/utils";
import { CornerDot } from "./corner-dot";
import { IntentLink } from "./intent-link";
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
 * So the section is one instrument instead: 24 hourly bars of real call
 * shape, the hours a human is actually at the desk, and one toggle that
 * fills in what the agent picks up. The toggle is the whole section in one
 * gesture — the same day, twice, and the difference between them is the
 * product.
 *
 * Four decisions worth keeping.
 *
 *  · **It sits on the open field, between hairlines.** It used to be drawn
 *    inside a rounded panel, and so was every other section on this page —
 *    the same border, the same pool colour, the same shadow, six times.
 *    That is what made a landing page read as a brochure. Nothing here is
 *    grouped by a card any more; it is grouped by rules and by space, and
 *    the reader's eye travels down one object rather than across six.
 *  · **It plays itself first.** The day arrives uncovered and flips on its
 *    own about a second and a half later, then walks the trades. Anything
 *    that waits to be clicked on a landing page is not seen. The first
 *    interaction of any kind takes the controls for good — autoplay that
 *    fights the reader is worse than none.
 *  · **The dial is not behind a click.** It used to be the third level of
 *    a modal, which is to say roughly nine readers in ten never saw the
 *    single best thing in the file. It is in the section permanently now,
 *    opened on the busiest hour, and it carries the argument the bar chart
 *    cannot make: *one ring without an agent, because there is one line —
 *    a ring per simultaneous conversation with it.* The difference between
 *    the two modes stops being a colour and becomes a shape.
 *  · **It never claims to be telemetry.** The shapes are true to each
 *    trade and the arithmetic is real arithmetic over them, but they are a
 *    model, and the strip at the foot says so. A fabricated dashboard buys
 *    one scroll and costs the whole page's credibility.
 *
 * What was deliberately removed, because removal was the work: the brief
 * column (a third scripted call on a page whose demo section owns that
 * job), the hour modal and its player, and the free-text "not on the
 * list" field. That field interpolated a raw label into "Hi — I'm calling
 * about veterinary" and handed a sceptic something visibly thinner than
 * the eight written trades at exactly the moment they went looking for the
 * seam. The gateway band at the foot answers the same objection with
 * sixteen doors that actually open.
 *
 * Colour and scale are the interior spread's — --cover-brand-lit as the
 * only accent, the --cover-load-* ramp for the bars, and every length in
 * `em` off `.cover`'s fluid base so the whole thing breathes with the
 * viewport.
 */

/** This section's place in the spread. */
const NUMERAL = "04";

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
  };
}

const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

/* ---------------------------------------------------------------- *
 * One hour, call by call
 * ---------------------------------------------------------------- */

/**
 * A single hour, expanded into the calls that made it.
 *
 * Seeded off the trade and the hour rather than random, for three reasons
 * that all matter: the same bar always opens the same hour, so a reader who
 * looks away and back is not told a different story about it; the day model
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
  picked,
  onPick,
}: {
  day: DayModel;
  /** True once the agent is on the line: every bar fills. */
  covered: boolean;
  staffed: [number, number];
  label: string;
  /** The hour currently open on the dial, so the chart can mark it. */
  picked: number;
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
  // which is the one the dial is already showing.
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
        aria-label={`Calls per hour across one day for ${label} — choose an hour to open it on the dial.`}
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
            // The share a staffed desk gets to. It does not move when the
            // toggle does — it is the constant the flip is measured
            // against, which is why both layers below can be driven from
            // it without either of them recomputing the day.
            const ansPct = c.calls ? (c.answered / c.calls) * 100 : 0;

            /**
             * The flip, and why it is two layers rather than one height.
             *
             * A single bar whose fill grows on the toggle is a bar that
             * *changes*; it is not a bar that catches anything. So the
             * missed remainder is its own block sitting on top of the
             * answered mass, and on the flip it translates down by its own
             * height — into the mass — while the mass rises to meet it.
             * The reader watches one quantity move into another instead of
             * watching two states cross-fade, which is the entire claim of
             * this section rendered as a motion rather than as a colour.
             *
             * The stagger is 0.035 and not 0.014. At 0.014 the whole day
             * is 0.32s wide against a 0.55s per-bar duration — every bar is
             * mid-flight at every moment, and the promised left-to-right
             * sweep across the day never renders at all.
             */
            const flip = reduce
              ? // Reduced motion gets the flip, because the flip is the
                // section — it just gets it once, slowly, with no stagger
                // and nothing translating across the screen.
                { duration: 1.1, ease: EASE }
              : { duration: 0.55, delay: i * 0.035, ease: EASE };

            return (
              <button
                key={c.hour}
                type="button"
                ref={(el) => {
                  bars.current[i] = el;
                }}
                tabIndex={i === focusIdx ? 0 : -1}
                disabled={!c.calls}
                aria-label={`${hh(c.hour)}, ${c.calls} calls — open this hour on the dial`}
                aria-current={picked === i ? "true" : undefined}
                onFocus={() => {
                  setRoved(i);
                  setHover(i);
                  // Focus, not just click: arrowing along the chart is the
                  // only way a keyboard reader moves the dial, and a stop
                  // that lights a bar without opening it would leave them
                  // driving half the instrument.
                  if (c.calls) onPick(c.hour);
                }}
                onClick={() => onPick(c.hour)}
                className="group relative flex h-full flex-1 items-end rounded-t-[0.25em] outline-none focus-visible:ring-2 focus-visible:ring-[var(--cover-brand-lit)] enabled:cursor-pointer"
              >
                {/* Full-height hit area, so thin bars are still reachable. */}
                <span aria-hidden className="absolute inset-0" />

                <div
                  className="relative w-full overflow-hidden rounded-t-[0.25em]"
                  style={{ height: `${barPct}%` }}
                >
                  {/* What the desk never got to. */}
                  <motion.span
                    aria-hidden
                    className={cn(
                      "absolute inset-x-0 border-t bg-[var(--cover-paper)]/[0.07] transition-colors duration-200",
                      hover === i
                        ? "border-[var(--cover-paper)]/50"
                        : "border-[var(--cover-paper)]/20",
                    )}
                    style={{
                      bottom: `${ansPct}%`,
                      height: `${100 - ansPct}%`,
                    }}
                    initial={false}
                    animate={{
                      y: reduce ? 0 : covered ? "100%" : "0%",
                      opacity: covered ? 0 : 1,
                    }}
                    transition={flip}
                  />

                  {/* What it did. */}
                  <motion.div
                    className="absolute inset-x-0 bottom-0"
                    style={{
                      background:
                        "linear-gradient(to top, var(--cover-load-2), var(--cover-load-3))",
                    }}
                    initial={false}
                    animate={{ height: `${covered ? 100 : ansPct}%` }}
                    transition={flip}
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

                {/* The hour the dial is holding, marked on the day. Without
                    it the dial below is a claim about an hour the reader
                    cannot locate in the chart they just read. */}
                {picked === i && (
                  <span
                    aria-hidden
                    className="absolute inset-x-0 -bottom-[0.45em] h-[0.15em] bg-[var(--cover-brand-lit)]"
                  />
                )}
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
                <span className="mono text-[var(--cover-paper)]/75">
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
                  <span className="text-[var(--cover-paper)]/75">
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
                          : "text-[var(--cover-paper)]/75"
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
      <div className="relative mt-[0.9em] h-[1em] border-t border-[var(--cover-paper)]/12">
        {AXIS_HOURS.map((h) => (
          <span
            key={h}
            aria-hidden
            className="mono absolute top-[0.35em] -translate-x-1/2 text-[0.62em] tracking-[0.08em] text-[var(--cover-paper)]/45"
            style={{ left: `${((h + 0.5) / 24) * 100}%` }}
          >
            {String(h).padStart(2, "0")}
          </span>
        ))}
      </div>

      <div className="mt-[1.9em] flex flex-wrap items-center justify-between gap-x-[1.2em] gap-y-[0.5em]">
        <p className="flex items-center gap-[0.6em] text-[0.72em] text-[var(--cover-paper)]/75">
          <span
            aria-hidden
            className="inline-block h-[0.85em] w-[1.6em] shrink-0 rounded-[0.15em] border border-dashed border-[var(--cover-paper)]/25 bg-[var(--cover-paper)]/[0.05]"
          />
          Front desk staffed {hh(staffed[0])}–{hh(staffed[1])} ·{" "}
          {Math.round(day.offHoursShare * 100)}% of the day&rsquo;s calls
          arrive outside it
        </p>

        <p className="mono text-[0.66em] uppercase tracking-[0.18em] text-[var(--cover-paper)]/45">
          Any hour opens on the dial below
        </p>
      </div>
    </div>
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
 * through sits on a single ring, because there is one line and it can only
 * ever hold one call; with the agent that ring splits, and the hour fills
 * inward, a ring per simultaneous conversation. You do not read that
 * difference. You see it happen, over 700ms, on the same beat as the bars.
 *
 * Every arc draws over the real length of its call, so the sweep is not
 * decoration either: it is the hour passing at ninety-two milliseconds to
 * the minute.
 */

/**
 * Ring radii by concurrency depth, in the 0–100 viewBox.
 *
 * Everything is pulled well inside 50 on purpose: the quarter labels sit at
 * r=47.3 and are drawn *inside* the same viewBox, so a ring stack that runs
 * out to 37 leaves no room and the labels get clipped at the frame.
 */
const LANE_R = [34, 29, 24, 19, 14];
const laneR = (l: number) => LANE_R[Math.min(l, LANE_R.length - 1)];

/**
 * Minute → point on a circle of radius r, with :00 at the top.
 *
 * Rounded, and that is a correctness fix rather than tidiness. These
 * coordinates land straight in SVG attributes, so React compares the
 * server's serialisation of the double against the client's own. The two
 * runtimes evaluate `Math.cos`/`Math.sin` to different last bits — server
 * rendered `20.274206980904232`, the browser computed `20.274206980904236`
 * — and React reports that as a hydration mismatch and refuses to patch
 * the tree. Three decimals in a 0–100 viewBox is a thousandth of a unit,
 * far under a device pixel at any width this dial is drawn at, and it is
 * identical on both sides.
 */
function pt(minute: number, r: number): [number, number] {
  const a = (minute / 60) * Math.PI * 2 - Math.PI / 2;
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return [round(50 + r * Math.cos(a)), round(50 + r * Math.sin(a))];
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
  const lanes = useMemo(
    () => [...new Set(calls.map((c) => c.lane))].sort((a, b) => a - b),
    [calls],
  );

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
            This is the argument standing still — and then moving: without
            an agent every ring is collapsed onto the outermost one and only
            that one is visible, because there is one line. On the flip they
            split apart, one per simultaneous conversation, over 700ms. The
            reader sees the difference before a single arc has redrawn. */}
        {lanes.map((l) => (
          <motion.circle
            key={`ring${l}`}
            cx="50"
            cy="50"
            // The attribute as well as the target: the server renders this
            // markup with no JavaScript, and a circle whose radius only
            // exists inside an animation target is a circle that is not
            // there until hydration.
            r={laneR(0)}
            fill="none"
            stroke="var(--cover-paper)"
            strokeOpacity="0.1"
            strokeWidth="3"
            initial={false}
            animate={{
              r: covered ? laneR(l) : laneR(0),
              opacity: covered || l === 0 ? 1 : 0,
            }}
            transition={{ duration: reduce ? 0 : 0.7, ease: EASE }}
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

        {/* Everything below is keyed on the mode, so flipping the toggle
            remounts it and the hour replays onto the rings it has just
            split into. A path's `d` cannot be tweened between two radii
            without morphing the command string, and a set of arcs that
            silently teleported inward while the rings glided would read as
            a rendering fault rather than as a change of shape. */}
        <g key={covered ? "with" : "without"}>
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
          {calls.map((c, i) => (
            <path
              key={`g${i}`}
              d={arcPath(
                c.start,
                c.start + c.dur,
                covered ? laneR(c.lane) : laneR(0),
              )}
              fill="none"
              stroke="var(--cover-paper)"
              strokeOpacity="0.09"
              strokeWidth="3"
              strokeLinecap="round"
            />
          ))}

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
              `fill-box` puts the rotation origin at the centre rather than
              at the middle of the hand. */}
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
              <circle cx="50" cy="6.4" r="1.5" fill="var(--cover-brand-lit)" />
            </motion.g>
          )}
        </g>

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
          <Tally
            value={handled}
            className="block text-[3em] font-medium leading-none tracking-[-0.05em] text-[var(--cover-brand-lit)]"
          />
          <p className="mono mt-[0.7em] text-[0.58em] uppercase tracking-[0.24em] text-[var(--cover-paper)]/45">
            handled
          </p>
          <p className="mono mt-[0.35em] text-[0.58em] tracking-[0.14em] text-[var(--cover-paper)]/45">
            of {calls.length}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * The hour, and the sentence that explains it.
 *
 * Four branches, and which one is true depends on the hour rather than on
 * the pitch: a quiet hour has no overlap to point at, an hour with the
 * doors shut has a better argument than either, and an in-hours miss is
 * only believable if the page can say what the team was doing instead —
 * which is what `busyReason` is for. Copy that asserts the same claim at
 * every hour is copy a reader stops reading at the second hour.
 */
function PeakHour({
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

  // The dial restarts on the flip, so the count narrating it restarts too.
  // Adjusted during render rather than from an effect: the reset is a pure
  // function of a prop we already hold, and doing it in an effect would
  // paint one frame of the old hour's total against the new hour's arcs.
  const [mode, setMode] = useState(covered);
  if (mode !== covered) {
    setMode(covered);
    setLanded(0);
  }

  // One timer per call, fired as the sweep reaches it, so the number in the
  // middle of the dial is counting the same arcs the reader is watching
  // draw.
  useEffect(() => {
    if (reduce) return;
    const timers = calls.map((c, i) =>
      setTimeout(
        () => setLanded((n) => Math.max(n, i + 1)),
        (c.start / 60) * PLAY * 1000 + 140,
      ),
    );
    return () => timers.forEach(clearTimeout);
  }, [calls, reduce, covered]);

  const shown = reduce ? calls.length : landed;
  const handled = calls
    .slice(0, shown)
    .filter((c) => covered || c.answered).length;
  const lanes = covered ? Math.max(1, ...calls.map((c) => c.lane + 1)) : 1;

  return (
    <div className="grid gap-[2.4em] md:grid-cols-[17em_minmax(0,1fr)] md:items-center md:gap-[3.2em]">
      <HourDial
        calls={calls}
        covered={covered}
        handled={handled}
        reduce={reduce}
      />

      <div>
        <p className="mono text-[0.66em] uppercase tracking-[0.22em] text-[var(--cover-paper)]/45">
          {cell.calls === Math.max(...ind.volume) ? "Busiest hour" : "This hour"}
        </p>
        <p className="mt-[0.6em] text-[1.9em] font-medium leading-none tracking-[-0.04em]">
          {hh(cell.hour)}–{hh((cell.hour + 1) % 24)}
        </p>

        <p className="mt-[1.2em] max-w-[30em] text-pretty text-[0.95em] leading-[1.6] text-[var(--cover-paper)]/75">
          {covered && !cell.staffed ? (
            <>
              Answered at {hh(cell.hour)}, with the front desk closed.{" "}
              <span className="text-[var(--cover-paper)]">
                Every one of these would have been a voicemail
              </span>{" "}
              — and a voicemail at this hour is a customer who has already
              called somebody else by morning.
            </>
          ) : covered && lanes > 1 ? (
            <>
              Every call taken, across{" "}
              <span className="text-[var(--cover-paper)]">
                {lanes} conversations running at once
              </span>{" "}
              — one ring per simultaneous call. A staffed desk has exactly one
              ring, and that is the whole difference.
            </>
          ) : covered ? (
            <>
              Every call taken on the first ring,{" "}
              <span className="text-[var(--cover-paper)]">
                without anyone stepping off the floor
              </span>{" "}
              — no hold, no callback list, nothing queued behind it.
            </>
          ) : cell.staffed ? (
            <>
              One line, one conversation.{" "}
              <span className="text-[var(--cover-paper)]">
                {cell.calls - cell.answered} of these never got through
              </span>{" "}
              — the line was still engaged, or {ind.busyReason}.
            </>
          ) : (
            <>
              Nobody was at the desk.{" "}
              <span className="text-[var(--cover-paper)]">
                Every one of these went to voicemail
              </span>{" "}
              — the hour is outside {hh(ind.staffed[0])}–{hh(ind.staffed[1])}.
            </>
          )}
        </p>

        <p className="mono mt-[1.4em] text-[0.64em] uppercase tracking-[0.18em] text-[var(--cover-paper)]/45">
          {covered ? "Concurrent lines" : "Lines available"}
          <span className="ml-[0.8em] text-[1.5em] tracking-normal text-[var(--cover-brand-lit)]">
            {lanes}
          </span>
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- *
 * Sixteen doors
 * ---------------------------------------------------------------- */

/**
 * The gateway, and why it is an index rather than sixteen more cards.
 *
 * The instrument above holds eight trades because a day can only be
 * modelled eight ways before the selector stops being readable — and a
 * reader who does not find their own trade in a list of eight concludes
 * the product was not built for them, which is the one objection no amount
 * of craft further down the page can answer. So the section ends with the
 * whole list, and every entry resolves: `/industries/[slug]` is generated
 * for all sixteen.
 *
 * Doors, not cards. Each one is a hairline, an icon at text size and a
 * label, on a tight four-column rhythm — the shape of a contents page,
 * which is exactly what it is. The trade's own outcome line is always in
 * the DOM (so it is read aloud, and so the row never changes height) and
 * comes up on hover or focus, which is the only reward the row needs.
 */
function IndustriesGateway() {
  return (
    <div className="mt-[4.5em] border-t border-[var(--cover-paper)]/12 pt-[2.6em] md:mt-[6em]">
      <div className="flex flex-wrap items-end justify-between gap-x-[2em] gap-y-[1em]">
        <div className="max-w-[40em]">
          <p className="mono text-[0.7em] uppercase tracking-[0.24em] text-[var(--cover-paper)]/45">
            {INDUSTRIES_GATEWAY.kicker}
          </p>
          <h3 className="mt-[0.7em] text-balance text-[1.7em] font-medium leading-[1.12] tracking-[-0.035em]">
            {INDUSTRIES_GATEWAY.title}
          </h3>
          <p className="mt-[0.7em] text-pretty text-[0.95em] leading-[1.6] text-[var(--cover-paper)]/75">
            {INDUSTRIES_GATEWAY.sub}
          </p>
        </div>

        <IntentLink
          href={INDUSTRIES_GATEWAY.href}
          className="group flex items-center gap-[0.5em] text-[0.85em] leading-none text-[var(--cover-brand-lit)] transition-opacity duration-500 hover:opacity-70"
        >
          {INDUSTRIES_GATEWAY.all}
          <ArrowRight
            className="size-[1.1em] transition-transform duration-500 group-hover:translate-x-[0.2em]"
            strokeWidth={2}
          />
        </IntentLink>
      </div>

      <ul className="mt-[2.2em] grid grid-cols-1 gap-x-[2em] sm:grid-cols-2 lg:grid-cols-4">
        {NAV_INDUSTRIES.map((n) => {
          const Icon = n.icon;
          return (
            <li key={n.slug}>
              <IntentLink
                href={`/industries/${n.slug}`}
                className="group grid grid-cols-[1.1em_minmax(0,1fr)] items-start gap-x-[0.7em] border-t border-[var(--cover-paper)]/12 py-[0.85em] transition-colors duration-500 hover:border-[var(--cover-brand-lit)]/45 focus-visible:outline-none focus-visible:border-[var(--cover-brand-lit)]/45"
              >
                <Icon
                  aria-hidden
                  className="mt-[0.2em] size-[1em] text-[var(--cover-paper)]/45 transition-colors duration-500 group-hover:text-[var(--cover-brand-lit)] group-focus-visible:text-[var(--cover-brand-lit)]"
                  strokeWidth={1.9}
                />
                <span className="min-w-0">
                  <span className="block truncate text-[0.92em] leading-snug text-[var(--cover-paper)]/75 transition-colors duration-500 group-hover:text-[var(--cover-paper)] group-focus-visible:text-[var(--cover-paper)]">
                    {n.label}
                  </span>
                  {/* Always present, always the same height — the row must
                      not resize under the cursor, and a screen reader should
                      hear what the door leads to without having to enter. */}
                  <span className="mt-[0.2em] block truncate text-[0.72em] leading-snug text-[var(--cover-brand-lit)]/0 transition-colors duration-500 group-hover:text-[var(--cover-brand-lit)]/85 group-focus-visible:text-[var(--cover-brand-lit)]/85">
                    {n.outcome}
                  </span>
                </span>
              </IntentLink>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------- *
 * Section
 * ---------------------------------------------------------------- */

/** Seconds a trade holds while the instrument is playing itself. */
const DWELL = 7.8;

export function UseCases() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  // Deliberately NOT `once`. With a one-shot observer the 7.8s carousel
  // stayed armed for the rest of the session — re-rendering a chart three
  // screens above the reader, behind the FAQ, until they closed the tab.
  const inView = useInView(ref, { margin: "-20% 0px -20% 0px" });

  const [activeId, setActiveId] = useState(INDUSTRIES[0].id);
  const [flipped, setFlipped] = useState(false);
  // One flag for the whole autoplay: the first deliberate interaction of
  // any kind hands the instrument over and it never takes it back.
  const [driving, setDriving] = useState(false);
  // The hour on the dial. `null` means "whichever is busiest", which is
  // what the dial opens on and what it falls back to on a change of trade —
  // an hour picked in one trade means nothing in the next.
  const [picked, setPicked] = useState<number | null>(null);

  const active = INDUSTRIES.find((i) => i.id === activeId) ?? INDUSTRIES[0];
  const day = useMemo(() => modelDay(active), [active]);

  const peakIdx = day.cells.findIndex((c) => c.calls === day.peak);
  const dialIdx = picked !== null && day.cells[picked]?.calls ? picked : peakIdx;

  const takeOver = () => setDriving(true);

  // Beat one: the day arrives uncovered, then fills itself. `driving` is a
  // dependency so that a reader who reaches the toggle inside the first
  // second and a half cancels the flip rather than being overruled by it.
  //
  // Reduced motion used to be handed `covered = true` outright, which gave
  // those readers the answer without ever showing them the question — the
  // uncovered day is the entire setup, and they were skipped past it. They
  // get the day and the flip, on a longer fuse, with the bars crossing over
  // slowly and without the stagger.
  useEffect(() => {
    if (!inView || driving) return;
    const t = setTimeout(() => setFlipped(true), reduce ? 2600 : 1600);
    return () => clearTimeout(t);
  }, [inView, reduce, driving]);

  const covered = flipped;

  // Beat two: walk the trades until the reader takes the controls.
  const autoplay = inView && !driving && !reduce;
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
    setPicked(null);
  };

  const answered = covered ? day.total : day.answeredWithout;

  return (
    <section
      id="use-cases"
      className="relative scroll-mt-24 px-[1.6em] py-[6em] md:py-[8em]"
    >
      <div className="relative mx-auto max-w-[76em]">
        {/* masthead — on the gutter, not centred. Six identical centred
            headers was the other half of what made this page a brochure. */}
        <Reveal>
          <div className="flex items-center gap-[0.75em]">
            <CornerDot className="size-[0.55em] shrink-0 text-[var(--cover-brand-lit)]" />
            <span className="mono text-[0.7em] uppercase tracking-[0.24em] text-[var(--cover-paper)]/45">
              {NUMERAL}
            </span>
            <span className="mono text-[0.7em] uppercase tracking-[0.24em] text-[var(--cover-paper)]/45">
              {USE_CASES_INTRO.eyebrow}
            </span>
          </div>
        </Reveal>

        <Reveal delay={0.06} className="mt-[0.9em]">
          <h2 className="text-balance text-[2.8em] font-medium leading-[1.03] tracking-[-0.045em] md:text-[3.4em]">
            {USE_CASES_INTRO.title}
          </h2>
        </Reveal>

        <Reveal
          delay={0.12}
          as="p"
          className="mt-[1em] max-w-[44em] text-pretty text-[1.05em] leading-[1.6] text-[var(--cover-paper)]/75"
        >
          {USE_CASES_INTRO.sub}
        </Reveal>

        <div className="mt-[2.4em] h-px bg-[var(--cover-paper)]/12" />

        {/* the instrument */}
        <div ref={ref} className="mt-[2.2em]">
          {/* Selector rail, on a hairline rather than in a row of pills.
              Scrolls as one row on a phone; the dwell draws itself along
              the active trade's rule, so the thing that tells the reader
              the panel is about to move on is the same rule that tells
              them which trade they are looking at. */}
          <div className="flex gap-[1.6em] overflow-x-auto border-b border-[var(--cover-paper)]/12 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {INDUSTRIES.map((ind) => {
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
                    "relative flex shrink-0 items-center gap-[0.5em] whitespace-nowrap pb-[0.9em] text-[0.82em] leading-none outline-none transition-colors duration-500 focus-visible:text-[var(--cover-brand-lit)]",
                    on
                      ? "text-[var(--cover-paper)]"
                      : "text-[var(--cover-paper)]/75 hover:text-[var(--cover-paper)]",
                  )}
                >
                  <Icon className="size-[1.15em] shrink-0" strokeWidth={1.9} />
                  {ind.label}

                  {on &&
                    (autoplay ? (
                      <motion.span
                        key={ind.id}
                        aria-hidden
                        className="absolute inset-x-0 -bottom-px h-px origin-left bg-[var(--cover-brand-lit)]"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: DWELL, ease: "linear" }}
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="absolute inset-x-0 -bottom-px h-px bg-[var(--cover-brand-lit)]"
                      />
                    ))}
                </button>
              );
            })}
          </div>

          {/* Reaching the instrument at all stops the carousel: a reader
              studying an hour must not have the trade swapped under the
              cursor between deciding to click and clicking. */}
          <div onPointerEnter={takeOver}>
            <div className="mt-[1.8em] flex flex-wrap items-center justify-between gap-[1em]">
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
                      "relative rounded-full px-[1em] py-[0.5em] leading-none transition-colors duration-500",
                      covered === opt.on
                        ? "text-[var(--cover-ink)]"
                        : "text-[var(--cover-paper)]/75 hover:text-[var(--cover-paper)]",
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

                Live only once the reader is driving. The instrument walks
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
                picked={dialIdx}
                onPick={(h) => {
                  takeOver();
                  setPicked(h);
                }}
              />
            </div>

            {/* the arithmetic */}
            <div className="mt-[2.2em] grid grid-cols-2 gap-[1.2em] border-t border-[var(--cover-paper)]/12 pt-[1.6em] sm:grid-cols-3">
              <div>
                <p className="mono text-[0.6em] uppercase tracking-[0.2em] text-[var(--cover-paper)]/45">
                  Calls in
                </p>
                <Tally
                  value={day.total}
                  className="mt-[0.35em] block text-[1.7em] font-medium leading-none tracking-[-0.03em]"
                />
              </div>

              <div>
                <p className="mono text-[0.6em] uppercase tracking-[0.2em] text-[var(--cover-paper)]/45">
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
                <p className="mono text-[0.6em] uppercase tracking-[0.2em] text-[var(--cover-paper)]/45">
                  {covered ? "Recovered" : "To voicemail"}
                </p>
                <div className="mt-[0.35em] flex items-baseline gap-[0.5em]">
                  <span
                    className={cn(
                      "text-[1.7em] font-medium leading-none tracking-[-0.03em] transition-colors duration-500",
                      covered
                        ? "text-[var(--cover-brand-lit)]"
                        : "text-[var(--cover-paper)]",
                    )}
                  >
                    {covered ? "+" : "−"}
                    {day.missed}
                  </span>
                  {/* "a day", not a dollar figure. The money that used to
                      sit here was `missed × Industry.value`, and every
                      input to it was ours — see the note on the type.
                      Beside two counts a reader can check against their own
                      phone, the invented number was the one they would test
                      first. */}
                  <span className="text-[0.85em] text-[var(--cover-paper)]/75">
                    calls / day
                  </span>
                </div>
              </div>
            </div>

            {/* The hour, on the dial. It used to be three levels down,
                behind a click, which is to say almost nobody saw it. */}
            <div className="mt-[2.6em] border-t border-[var(--cover-paper)]/12 pt-[2.6em]">
              <PeakHour
                key={`${active.id}-${dialIdx}`}
                ind={active}
                cell={day.cells[dialIdx]}
                covered={covered}
              />
            </div>
          </div>

          {/* provenance — this is a model, and it says so */}
          <p className="mt-[2.4em] max-w-[52em] border-t border-[var(--cover-paper)]/12 pt-[1.2em] text-[0.7em] leading-[1.7] text-[var(--cover-paper)]/75">
            Modelled day, not live telemetry — call shapes are typical of each
            trade, and the counts are what a single line gets through in one,
            nothing more. What a recovered call is worth is your own
            arithmetic. Your agent runs on your hours, your services and your
            own calendar.
          </p>
        </div>

        <IndustriesGateway />
      </div>
    </section>
  );
}
