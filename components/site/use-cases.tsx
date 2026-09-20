"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { gsap } from "gsap";
import { ArrowRight, Clock } from "lucide-react";
import {
  INDUSTRIES,
  INDUSTRIES_GATEWAY,
  NAV_INDUSTRIES,
  USE_CASES_INTRO,
  type Industry,
} from "@/lib/site";
import { cn } from "@/lib/utils";
import { IntentLink } from "./intent-link";
import { useKitContext, useMotionKit } from "./product/motion-kit";
import { Frame, PillLink, SectionHeading } from "./product/primitives";
import { holdFor, useInView, usePrefersReducedMotion } from "./product/timing";

/**
 * Who it's for — "one day on the line", played out.
 *
 * **The scene.** This section is not a chart that arrives; it is a day
 * that runs. Land on it and the clock starts at midnight and walks the
 * twenty-four hours of one trade's phone line, an hour at a time. Each
 * hour rises into the chart as it happens; the dial below opens that same
 * hour and draws every call in it at its real minute and over its real
 * length; the three counts at the foot climb as the calls land, because
 * they are a running total of the hours that have happened rather than a
 * number counting up at a reader who scrolled past. By 23:00 the day is
 * whole and the reader has watched it cost itself.
 *
 * Then the section makes its argument. The clock parks on the busiest
 * hour and plays it at minute resolution — one line, one conversation,
 * and the calls that arrived while it was engaged drawn as broken arcs
 * that never became anything. It holds there long enough to read, and
 * then it puts the agent on: the toggle slides, the missed remainder of
 * every bar folds down into the answered mass in one sweep across the
 * day, and the single ring on the dial splits into one ring per
 * simultaneous conversation while the same hour redraws onto it, whole.
 * The same day, twice, and the difference between them is the product.
 * Then the next trade, and it starts over.
 *
 * That is the argument this section could never make as an entrance. A
 * row that fades in tells the reader the page has loaded. A day that
 * plays itself out and then gets answered tells them what they are
 * losing, in their own trade, in the order it happens.
 *
 * **The signature movement: the hour, lived, on one clock.** The dial is
 * where this section's argument actually happens, so it is the one thing
 * here built as composed movement rather than as a state change — a single
 * paused GSAP timeline, per hour, per mode. The hand sweeping the face, the
 * thin ring closing around the outside, every call drawn as an arc starting
 * at its own minute and taking its own length, the tally in the middle and
 * the sentence beside it are all tweens and callbacks of that one timeline.
 * They are therefore in phase by construction.
 *
 * They were not before. Each arc used to carry its own CSS transition with
 * a hand-computed `transition-delay`, the hand carried another, the ring a
 * third, and a `setTimeout` per call advanced the count — four independent
 * clocks that agreed only because they had all been told the same number,
 * and drifted the moment the tab was throttled or a frame was long. An hour
 * whose hand and whose calls disagree is not a measurement, it is a
 * decoration, and this section is only worth anything if it is a
 * measurement.
 *
 * The plugins, and only where they mean something. **DrawSVG** draws the
 * arcs and the hour ring, because a conversation is a line being laid down
 * over its own duration, not a shape being revealed; the calls that never
 * got through are dotted, so they are faded in at the minute they rang —
 * DrawSVG on a dashed stroke would solidify it. **SplitText** carries the
 * verdict beside the dial, because that sentence is the reading of the hour
 * and it should arrive as language, word after word, while the hand is
 * still going round. Nothing here travels a route that a rotation does not
 * already describe, so there is no MotionPath: a plugin used for the sake
 * of using it is the same decoration in a more expensive form.
 *
 * **What stays CSS, on purpose.** GSAP owns the composed movement; it does
 * not own every change of state. The rings splitting apart on the flip is
 * one radius per ring under a 500ms transition, the bars rise by height as
 * the day reaches them, the toggle's pill slides, a hovered bar washes. All
 * of those are one state becoming another and the browser is better at them
 * than a timeline would be.
 *
 * **The rest of the clock is the house's.** `useInView` at two margins —
 * the outer one fetches GSAP, the inner one plays the timeline; nothing is
 * fetched until the section is near and nothing plays off screen.
 * `usePrefersReducedMotion` is served a *finished* hour rather than an
 * absence: the arcs rest drawn in the markup, so a reader who wants no
 * motion never downloads GSAP at all and still sees the whole hour. The
 * beat the flipped day holds for is `holdFor` of the very sentence the live
 * region reads out — reading pace, not a round number.
 *
 * Five decisions worth keeping.
 *
 *  · **It is set in the light `pp` system, like every other marketing page
 *    on this site.** White stock, black ink, violet #551a89 for the one
 *    thing that is active, Onest display over Inter body, and every length
 *    in px/rem — the cover's fluid `em` base does not exist here. The
 *    instrument itself sits on one soft `--pp-card` panel, which is the
 *    house's way of saying "this is an object you operate" without
 *    reaching for a border and a shadow. Everything else on the section —
 *    the masthead, the gateway — stands on the open field between
 *    hairlines, so the page still reads as one spread rather than as a
 *    stack of boxes.
 *  · **The reader takes it over for good, on the first real interaction.**
 *    A pointer *down*, a focus or a key — not a cursor that merely crossed
 *    the panel on its way down the page. Crossing it only holds the clock
 *    where it stands, so a trade never swaps under someone reading a
 *    tooltip; the moment they actually operate something, the day
 *    completes, the clock stops and never starts again.
 *  · **The dial is not behind a click.** It used to be the third level of
 *    a modal, which is to say roughly nine readers in ten never saw the
 *    single best thing in the file. It is in the section permanently now,
 *    and it carries the argument the bar chart cannot make: *one ring
 *    without an agent, because there is one line — a ring per simultaneous
 *    conversation with it.* The difference between the two modes stops
 *    being a colour and becomes a shape.
 *  · **On white, the motion draws rather than glows.** Nothing is lit from
 *    behind: a bloom that read as depth on near-black reads as a smudge on
 *    #ffffff, so the arcs are ink on paper with only the faintest weight
 *    behind them.
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
 */

/* ---------------------------------------------------------------- *
 * The two inks an SVG stroke needs as a literal
 * ---------------------------------------------------------------- */

/** `--pp-accent`, for the strokes and fills a Tailwind token cannot reach. */
const VIOLET = "#551a89";
/** The ink `--pp-rule` and `--pp-hair` are mixed from, for strokes at our own alpha. */
const INK = "#181028";

/** The house small-caps label, used for every readout caption below. */
const LABEL =
  "text-[11px] leading-4 font-medium tracking-[0.12em] text-pp-muted uppercase";

/* ---------------------------------------------------------------- *
 * The clock
 *
 * Three beats and nothing else. An hour that rang holds long enough to
 * register as an event; an hour that was silent is over almost before it
 * starts, which is what makes the dead stretch before dawn read as dead.
 * `PLAY` is the house's own 4200ms — the same beat `platform-scenes`
 * cycles a voice on — and it is how long one hour takes to play out at
 * minute resolution, so a sixty-minute circle is drawn in 4.2 seconds and
 * every arc on it is scaled to that.
 * ---------------------------------------------------------------- */

/** One hour of the day, while the day is running. */
const HOUR_BEAT = 330;
/** An hour nobody called in. */
const QUIET_BEAT = 110;
/** One hour, played out call by call. */
const PLAY = 4200;
/** The pause between two acts. */
const BEAT = 520;

/** Which act the instrument is in. */
type Act = "day" | "hour" | "covered";

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

/** The last hour at or before `h` that actually rang. */
function lastRung(cells: HourCell[], h: number, fallback: number) {
  for (let i = Math.min(h, 23); i >= 0; i--) if (cells[i].calls) return i;
  return fallback;
}

/* ---------------------------------------------------------------- *
 * The day
 * ---------------------------------------------------------------- */

const AXIS_HOURS = [0, 3, 6, 9, 12, 15, 18, 21];

/**
 * The chart, and why nothing in it counts up.
 *
 * Every bar is two blocks in a clipped box whose height is zero until the
 * day's head reaches that hour. So the chart does not appear — it is
 * *written*, left to right, one hour at a time, and by the time it is
 * whole the reader has watched it happen rather than watched it arrive.
 *
 * The flip is two layers rather than one height, and that is the whole
 * claim of the section rendered as a motion. A single bar whose fill grows
 * on the toggle is a bar that *changes*; it is not a bar that catches
 * anything. So the missed remainder is its own block sitting on top of the
 * answered mass, and on the flip it translates down by its own height —
 * into the mass — while the mass rises to meet it. One quantity moving
 * into another, not two states cross-fading.
 *
 * The stagger is 35ms and not 14ms. At 14ms the whole day is 0.32s wide
 * against a 500ms per-bar duration — every bar is mid-flight at every
 * moment, and the promised left-to-right sweep across the day never
 * renders at all.
 */
function DayChart({
  day,
  covered,
  head,
  staffed,
  label,
  picked,
  onPick,
}: {
  day: DayModel;
  /** True once the agent is on the line: every bar fills. */
  covered: boolean;
  /** The last hour the day has reached. Bars past it are not up yet. */
  head: number;
  staffed: [number, number];
  label: string;
  /** The hour currently open on the dial, so the chart can mark it. */
  picked: number;
  onPick: (hour: number) => void;
}) {
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
        className="relative h-[190px] select-none md:h-[236px]"
        onPointerMove={track}
        onPointerLeave={() => setHover(null)}
      >
        {/* The hours a human is at the desk. Everything outside this band
            is, without an agent, a call nobody hears. White on the card,
            because on this stock the lit hours are the paper showing
            through rather than a wash laid over it. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 border-x border-dashed border-pp-hair bg-white/70"
          style={{
            left: `${(staffed[0] / 24) * 100}%`,
            width: `${((staffed[1] - staffed[0]) / 24) * 100}%`,
          }}
        />

        <div className="relative flex h-full items-end gap-[2px]" onKeyDown={rove}>
          {day.cells.map((c, i) => {
            const barPct = day.peak ? (c.calls / day.peak) * 100 : 0;
            // The share a staffed desk gets to. It does not move when the
            // toggle does — it is the constant the flip is measured
            // against, which is why both layers below can be driven from
            // it without either of them recomputing the day.
            const ansPct = c.calls ? (c.answered / c.calls) * 100 : 0;
            /** Has the day got here yet? */
            const up = head >= i;

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
                className="group relative flex h-full flex-1 items-end rounded-t-[3px] outline-none focus-visible:ring-2 focus-visible:ring-pp-accent focus-visible:ring-offset-1 focus-visible:ring-offset-pp-card enabled:cursor-pointer"
              >
                {/* Full-height hit area, so thin bars are still reachable. */}
                <span aria-hidden className="absolute inset-0" />

                {/* The hour, as the day reaches it. Height, not opacity:
                    the bar is written upward out of the axis, which is
                    what a call arriving looks like. */}
                <div
                  className="relative w-full overflow-hidden rounded-t-[3px] transition-[height] duration-300 ease-out motion-reduce:transition-none"
                  style={{ height: `${up ? barPct : 0}%` }}
                >
                  {/* What the desk never got to. A grey block on the card,
                      one step darker than the stock it sits on — the
                      quantity is present but unlit, which is the whole
                      point of it. On the flip it drops into the mass. */}
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-x-0 border-t bg-[rgb(24_16_40/0.09)] transition-[transform,opacity] duration-500 motion-reduce:transition-none",
                      hover === i ? "border-pp-ink/45" : "border-pp-hair",
                    )}
                    style={{
                      bottom: `${ansPct}%`,
                      height: `${100 - ansPct}%`,
                      transform: covered ? "translateY(100%)" : "none",
                      opacity: covered ? 0 : 1,
                      transitionDelay: `${i * 35}ms`,
                    }}
                  />

                  {/* What it did. Flat violet: on white a gradient reads as
                      a smudge where on near-black it read as depth. */}
                  <div
                    className="absolute inset-x-0 bottom-0 bg-pp-accent transition-[height] duration-500 motion-reduce:transition-none"
                    style={{
                      height: `${covered ? 100 : ansPct}%`,
                      transitionDelay: `${i * 35}ms`,
                    }}
                  />

                  {/* Hover wash, so a bar reads as a thing you can open. */}
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-0 bg-pp-ink/[0.07] opacity-0 transition-opacity duration-200",
                      hover === i && "opacity-100",
                    )}
                  />
                </div>

                {/* The hour the dial is holding, marked on the day. While
                    the day is running that is the hour that just rang, so
                    this is also the playhead. */}
                {picked === i && (
                  <span
                    aria-hidden
                    className="absolute inset-x-0 -bottom-[6px] h-[2px] bg-pp-accent"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Read-out for the hovered hour.

            Two elements, and the split is load-bearing: the outer one is
            absolutely placed and carries the reveal, because the inner
            shrink-wrapped box writes its own `transform` to clamp itself
            — translating by a share of its own width so the tip stays
            inside the plot at either end of the day. */}
        {cell && (
          <div
            key={cell.hour}
            className="pointer-events-none absolute top-0 z-10 animate-in fade-in-0 duration-200 motion-reduce:animate-none"
            style={{ left: `${((cell.hour + 0.5) / 24) * 100}%` }}
          >
            <div
              className="whitespace-nowrap rounded-[10px] border border-pp-hair bg-white px-3 py-2 text-[12px] leading-tight shadow-[0_12px_28px_-14px_rgb(24_16_40/0.5)]"
              style={{
                transform: `translateX(-${Math.min(
                  92,
                  Math.max(8, ((cell.hour + 0.5) / 24) * 100),
                )}%)`,
              }}
            >
              <span className="mono text-pp-muted">{hh(cell.hour)}</span>
              <span className="mx-2 text-pp-ink/25">/</span>

              {/* Reading an hour that never rang is now possible — the
                  plot tracks the pointer across dead bars too — and
                  "0 calls / 0 answered" would light the accent on the
                  strength of 0 === 0. A silent hour just says so. */}
              {cell.calls === 0 ? (
                <span className="text-pp-muted">
                  the phone didn&rsquo;t ring
                </span>
              ) : (
                <>
                  <span className="text-pp-ink">
                    {cell.calls} {cell.calls === 1 ? "call" : "calls"}
                  </span>
                  <span className="mx-2 text-pp-ink/25">/</span>
                  <span
                    className={
                      covered || cell.answered === cell.calls
                        ? "font-medium text-pp-accent"
                        : "text-pp-muted"
                    }
                  >
                    {covered ? cell.calls : cell.answered} answered
                  </span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* axis */}
      <div className="relative mt-3.5 h-4 border-t border-pp-hair">
        {AXIS_HOURS.map((h) => (
          <span
            key={h}
            aria-hidden
            className="mono absolute top-1.5 -translate-x-1/2 text-[11px] leading-4 tracking-[0.08em] text-pp-muted"
            style={{ left: `${((h + 0.5) / 24) * 100}%` }}
          >
            {String(h).padStart(2, "0")}
          </span>
        ))}
      </div>

      <div className="mt-7 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <p className="flex items-center gap-2.5 text-[13px] leading-5 text-pp-muted">
          <span
            aria-hidden
            className="inline-block h-3 w-6 shrink-0 rounded-[2px] border border-dashed border-pp-hair bg-white"
          />
          Front desk staffed {hh(staffed[0])}–{hh(staffed[1])} ·{" "}
          {Math.round(day.offHoursShare * 100)}% of the day&rsquo;s calls
          arrive outside it
        </p>

        <p className={LABEL}>Any hour opens on the dial below</p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- *
 * The hour, played out
 * ---------------------------------------------------------------- */

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
 * difference. You see it happen, over 500ms, on the same beat as the bars.
 *
 * The ring split is a change of state and stays a CSS transition: one
 * radius per ring, 500ms, on the same beat as the bars folding. GSAP is
 * for the hour being lived, not for a toggle.
 *
 * Every arc draws over the real length of its call, and it starts at the
 * minute it rang. `run` in `PeakHour` is how long this whole hour is
 * taking, and each call's position and duration on the timeline are its
 * own minute and its own length scaled into it. During the day's walk that
 * is one hour-beat and the hour flicks past; when the clock parks on an
 * hour it is `PLAY`, and the hour is lived.
 *
 * The drawing itself belongs to the timeline in `PeakHour`: this component
 * is the face, and every stroke on it that moves is marked with a class for
 * that timeline to take hold of. Which is also why nothing here carries an
 * inline dash — a stroke with no `stroke-dasharray` on it is a stroke that
 * rests *drawn*, so the hour is whole before GSAP has arrived and stays
 * whole for a reader who has asked for no motion.
 *
 * Drawn in ink on paper. Every neutral is `INK` at a stated alpha rather
 * than a paper colour at one, because the surface under the dial is the
 * light card and a stroke that lightens toward it disappears.
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
  lived,
}: {
  calls: HourCall[];
  covered: boolean;
  handled: number;
  /**
   * True while this hour is being played out at minute resolution rather
   * than flicking past under the day's walk. The hand is only legible —
   * and only honest — when the hour is actually being lived.
   */
  lived: boolean;
}) {
  const lanes = useMemo(
    () => [...new Set(calls.map((c) => c.lane))].sort((a, b) => a - b),
    [calls],
  );

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[280px]">
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
            <stop offset="0%" stopColor={VIOLET} stopOpacity="0.8" />
            <stop offset="100%" stopColor={VIOLET} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* The lines themselves, drawn whether or not anything is on them.
            This is the argument standing still — and then moving: without
            an agent every ring is collapsed onto the outermost one and only
            that one is visible, because there is one line. On the flip they
            split apart, one per simultaneous conversation. The reader sees
            the difference before a single arc has redrawn.

            The radius is set twice on purpose. As an attribute it is what
            the server renders and what a browser without the CSS `r`
            property falls back to; as a style it is what animates. */}
        {lanes.map((l) => {
          const r = covered ? laneR(l) : laneR(0);
          return (
            <circle
              key={`ring${l}`}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={INK}
              strokeOpacity="0.1"
              strokeWidth="3"
              className="transition-all duration-500 motion-reduce:transition-none"
              style={
                {
                  r: `${r}px`,
                  opacity: covered || l === 0 ? 1 : 0,
                } as CSSProperties
              }
            />
          );
        })}

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
                stroke={INK}
                strokeOpacity={major ? 0.36 : 0.16}
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
              stroke={INK}
              strokeOpacity="0.1"
              strokeWidth="0.5"
            />
            <circle
              className="uc-hour-ring"
              cx="50"
              cy="50"
              r="44.2"
              fill="none"
              stroke={VIOLET}
              strokeOpacity="0.55"
              strokeWidth="0.7"
              strokeLinecap="round"
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
              stroke={INK}
              strokeOpacity="0.08"
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

            if (!on) {
              // A call that arrived and became nothing: broken, unlit, and
              // it appears at the minute it rang rather than drawing,
              // because there was no conversation to draw. Dotted, so the
              // timeline fades it in — DrawSVG on a dashed stroke writes
              // over the dash array and solidifies the line.
              return (
                <path
                  key={`m${i}`}
                  className={`uc-missed uc-c${i}`}
                  d={d}
                  fill="none"
                  stroke={INK}
                  strokeOpacity="0.34"
                  strokeWidth="3"
                  strokeLinecap="butt"
                  strokeDasharray="0.9 1.8"
                />
              );
            }

            return (
              <g key={`h${i}`}>
                {/* A faint violet bed under the line rather than a bloom
                    around it: on white, light thrown outward is a smudge,
                    but a wider stroke of the same ink at low alpha reads
                    as weight. Then the line itself, drawn over it. Both
                    carry the call's class, so one tween draws the pair. */}
                <path
                  className={`uc-draw uc-c${i}`}
                  d={d}
                  fill="none"
                  stroke={VIOLET}
                  strokeOpacity="0.14"
                  strokeWidth="6.5"
                  strokeLinecap="round"
                />
                <path
                  className={`uc-draw uc-c${i}`}
                  d={d}
                  fill="none"
                  stroke={VIOLET}
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </g>
            );
          })}

          {/* The hand, walking the hour. Rotated by the timeline about the
              dial's own centre with `svgOrigin`, which is why there is no
              bounding rect here any more: the group's bbox is the hand, and
              a transform-box trick to work around that is a transform GSAP
              would then have to fight. */}
          {lived && (
            <g className="uc-hand">
              <line
                x1="50"
                y1="6"
                x2="50"
                y2="50"
                stroke="url(#ntv-sweep)"
                strokeWidth="0.9"
              />
              <circle cx="50" cy="6.4" r="1.5" fill={VIOLET} />
            </g>
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
              fill={INK}
              fillOpacity="0.45"
              style={{ fontSize: 3.4, fontFamily: "var(--font-mono)" }}
            >
              {String(m).padStart(2, "0")}
            </text>
          );
        })}
      </svg>

      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="text-center">
          {/* No count-up. This number is a tally of the arcs that have
              actually landed, so it climbs because the hour is happening
              rather than because something told it to run to a total. */}
          <span className="block text-[44px] leading-none font-medium tracking-[-0.04em] text-pp-accent tabular-nums md:text-[52px]">
            {handled.toLocaleString("en-US")}
          </span>
          <p className={cn(LABEL, "mt-3")}>handled</p>
          <p className="mono mt-1.5 text-[11px] leading-4 tracking-[0.12em] text-pp-muted">
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
 *
 * **This is where the section's one timeline lives**, because the dial and
 * the sentence beside it are one event and were being driven as two. The
 * hand, the closing ring, every arc, the tally under them and the words of
 * the verdict are now tweens and callbacks of a single paused timeline,
 * rebuilt whenever the hour, the mode or the pace changes and reverted by
 * the context before each rebuild.
 */
function PeakHour({
  ind,
  cell,
  covered,
  span,
  reduce,
}: {
  ind: Industry;
  cell: HourCell;
  covered: boolean;
  span: number;
  reduce: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Two margins, two jobs: `near` fetches GSAP, `inView` plays the hour.
  const inView = useInView(ref, "-10% 0px");
  const near = useInView(ref, "25% 0px");
  // `near && !reduce`, not `near`: with reduced motion the markup already
  // rests on the finished hour — every arc drawn, the ring closed, no hand
  // — so there is nothing for GSAP to put right and no reason to fetch it.
  const kit = useMotionKit(near && !reduce);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  const calls = useMemo(() => hourCalls(ind, cell.hour), [ind, cell.hour]);

  /** Is this hour being lived, or is the day's walk flicking past it? */
  const lived = !reduce && span >= 1000;
  /** How long the whole hour takes, in GSAP's units. */
  const run = (reduce ? 0 : span) / 1000;
  const hourKey = `${ind.id}:${cell.hour}`;

  const [landed, setLanded] = useState(0);

  // A new hour, a new mode or a new pace is a new scene, and the count
  // narrating it starts again with it. Adjusted during render rather than
  // from an effect: the reset is a pure function of props we already hold,
  // and doing it in an effect would paint one frame of the old hour's total
  // against the new hour's arcs.
  const scene = `${hourKey}:${covered}:${run}`;
  const [built, setBuilt] = useState(scene);
  if (built !== scene) {
    setBuilt(scene);
    setLanded(0);
  }

  useKitContext(
    kit,
    ({ gsap, SplitText }) => {
      // A reader can turn the preference on after GSAP has already been
      // fetched for them, and the kit does not unload. There is nothing to
      // put right when that happens: the context has just reverted every
      // inline style this callback ever wrote, and what is left underneath
      // is the markup — which rests on the hour finished. So the honest
      // reduced-motion state here is no timeline at all.
      if (reduce) return;

      const q = gsap.utils.selector(ref);
      // Every one of these can legitimately be empty — an hour outside the
      // staffed window has nothing drawn on it, a covered hour has nothing
      // dotted, and the hand is only in the DOM while the hour is lived —
      // and GSAP warns about a tween with no targets. So each is checked
      // rather than handed over blind.
      const drawn = q(".uc-draw");
      const dotted = q(".uc-missed");
      const hand = q(".uc-hand");
      const ring = q(".uc-hour-ring");
      const label = q(".uc-hour-label");
      const verdict = q(".uc-verdict")[0] as HTMLElement | undefined;

      const tl = gsap.timeline({ paused: true });

      // The whole resting state, set at the top: an hour that has not
      // happened yet. Nothing in the markup says this, because the markup
      // has to rest on the hour *finished* for anyone GSAP never reaches.
      tl.set(ring, { drawSVG: "0% 0%" }, 0);
      if (drawn.length) tl.set(drawn, { drawSVG: "0% 0%" }, 0);
      if (dotted.length) tl.set(dotted, { autoAlpha: 0 }, 0);
      if (hand.length) tl.set(hand, { rotation: 0, svgOrigin: "50 50" }, 0);

      if (lived && verdict) {
        // Split for motion only: the words stay plain text to a screen
        // reader, and the context reverts the split when it reverts —
        // never call `.revert()` here. The paragraph carries a React key
        // that changes with its own text, so the node a split is holding
        // is never the node React has since rewritten.
        const split = SplitText.create(verdict, { type: "words", aria: "none" });
        // Each word on its own compositor layer, so the fade, the rise and
        // the blur are GPU work rather than a repaint of the line.
        gsap.set(split.words, {
          willChange: "transform, opacity, filter",
          force3D: true,
        });

        tl.fromTo(
          label,
          { autoAlpha: 0, y: 10 },
          { autoAlpha: 1, y: 0, duration: 0.5, ease: "power3.out" },
          0,
        ).fromTo(
          split.words,
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
      } else {
        // The day's walk opens a new hour every third of a second. A
        // sentence that re-staggered at that rate would never be a
        // sentence, so while the clock is only passing through, the
        // reading of the hour simply stands there.
        tl.set([...label, ...(verdict ? [verdict] : [])], { autoAlpha: 1, y: 0 }, 0);
      }

      // The hour itself, at constant speed, because a minute is a minute:
      // the hand, the ring closing round the outside and every call on the
      // face are tweens of this one timeline and cannot drift apart.
      tl.to(ring, { drawSVG: "0% 100%", duration: run, ease: "none" }, 0);
      if (hand.length) {
        tl.to(hand, { rotation: 360, duration: run, ease: "none" }, 0);
      }

      calls.forEach((c, i) => {
        // The call's own minute, and the call's own length, scaled into
        // however long this hour is taking.
        const at = (c.start / 60) * run;
        const arc = q(`.uc-c${i}`);

        if (covered || c.answered) {
          tl.to(
            arc,
            {
              drawSVG: "0% 100%",
              duration: Math.max(0.06, (c.dur / 60) * run),
              ease: "none",
            },
            at,
          );
        } else {
          tl.to(arc, { autoAlpha: 1, duration: Math.min(0.3, run), ease: "none" }, at);
        }

        // The tally is a callback on the same clock as the arc it is
        // counting, which is the whole reason it can be trusted: it is not
        // a number running to a total, it is the hour being added up as it
        // happens.
        tl.call(() => setLanded((n) => Math.max(n, i + 1)), undefined, at);
      });

      tlRef.current = tl;
      return () => {
        tlRef.current = null;
      };
    },
    // `revertOnUpdate` because the callback splits text and sets inline
    // styles on every stroke in the dial.
    {
      scope: ref,
      dependencies: [hourKey, covered, run, lived, reduce],
      revertOnUpdate: true,
    },
  );

  // Plays while on screen. `kit` is in the deps because the timeline is
  // built asynchronously, after the kit arrives; the rest are there because
  // a rebuilt timeline needs telling again.
  useEffect(() => {
    const tl = tlRef.current;
    if (!tl) return;
    if (inView && !reduce) tl.play();
    else tl.pause();
  }, [inView, reduce, kit, hourKey, covered, run, lived]);

  // Until GSAP is here — and for a reader who has asked for no motion —
  // the markup rests on the finished hour, so the tally has to agree with
  // it rather than sit at nought under a dial that is already full.
  const shown = kit && !reduce ? landed : calls.length;
  const handled = calls
    .slice(0, shown)
    .filter((c) => covered || c.answered).length;
  const lanes = covered ? Math.max(1, ...calls.map((c) => c.lane + 1)) : 1;

  return (
    <div
      ref={ref}
      className="grid gap-9 md:grid-cols-[280px_minmax(0,1fr)] md:items-center md:gap-14"
    >
      <HourDial
        calls={calls}
        covered={covered}
        handled={handled}
        lived={lived}
      />

      <div>
        <p className={LABEL}>
          {cell.calls === Math.max(...ind.volume) ? "Busiest hour" : "This hour"}
        </p>
        <p className="uc-hour-label mt-2.5 text-[30px] leading-none font-medium tracking-[-0.03em] text-pp-ink md:text-[36px]">
          {hh(cell.hour)}–{hh((cell.hour + 1) % 24)}
        </p>

        {/* Keyed on the hour and the mode, and that key is load-bearing
            twice over: the verdict on this hour is replaced rather than
            cross-faded into the other one, and a SplitText is never left
            holding a node whose text React has changed underneath it. */}
        <p
          key={`${cell.hour}-${covered}`}
          className="uc-verdict mt-5 max-w-[480px] text-[15px] leading-[24px] text-pretty text-pp-muted md:text-base md:leading-[26px]"
        >
          {covered && !cell.staffed ? (
            <>
              Answered at {hh(cell.hour)}, with the front desk closed.{" "}
              <span className="text-pp-ink">
                Every one of these would have been a voicemail
              </span>{" "}
              — and a voicemail at this hour is a customer who has already
              called somebody else by morning.
            </>
          ) : covered && lanes > 1 ? (
            <>
              Every call taken, across{" "}
              <span className="text-pp-ink">
                {lanes} conversations running at once
              </span>{" "}
              — one ring per simultaneous call. A staffed desk has exactly one
              ring, and that is the whole difference.
            </>
          ) : covered ? (
            <>
              Every call taken on the first ring,{" "}
              <span className="text-pp-ink">
                without anyone stepping off the floor
              </span>{" "}
              — no hold, no callback list, nothing queued behind it.
            </>
          ) : cell.staffed ? (
            <>
              One line, one conversation.{" "}
              <span className="text-pp-ink">
                {cell.calls - cell.answered} of these never got through
              </span>{" "}
              — the line was still engaged, or {ind.busyReason}.
            </>
          ) : (
            <>
              Nobody was at the desk.{" "}
              <span className="text-pp-ink">
                Every one of these went to voicemail
              </span>{" "}
              — the hour is outside {hh(ind.staffed[0])}–{hh(ind.staffed[1])}.
            </>
          )}
        </p>

        <p className={cn(LABEL, "mt-7 flex items-baseline gap-3")}>
          {covered ? "Concurrent lines" : "Lines available"}
          <span className="text-[18px] leading-none tracking-normal text-pp-accent tabular-nums">
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
 * which is exactly what it is. It stands on the open white field rather
 * than in a panel, because the one soft surface in this section is the
 * instrument and a second one would flatten the difference between
 * "operate this" and "read this". The trade's own outcome line is always
 * in the DOM (so it is read aloud, and so the row never changes height)
 * and comes up on hover or focus, which is the only reward the row needs.
 */
function IndustriesGateway() {
  return (
    <div className="border-t border-pp-rule pt-12 md:pt-16">
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
        <div className="max-w-[560px]">
          <p className={LABEL}>{INDUSTRIES_GATEWAY.kicker}</p>
          <h3
            className="pp-display mt-4 text-[26px] leading-[32px] tracking-[-0.025em] text-balance md:text-[32px] md:leading-[38px]"
            // Inline: `.pp-display` sets 360 outside Tailwind's layers, so
            // a weight utility would lose to it. Matches SectionHeading.
            style={{ fontWeight: 480 }}
          >
            {INDUSTRIES_GATEWAY.title}
          </h3>
          <p className="mt-4 max-w-[520px] text-[15px] leading-[24px] text-pretty text-pp-muted md:text-base md:leading-[26px]">
            {INDUSTRIES_GATEWAY.sub}
          </p>
        </div>

        <PillLink
          href={INDUSTRIES_GATEWAY.href}
          variant="secondary"
          size="sm"
          className="group"
        >
          {INDUSTRIES_GATEWAY.all}
          <ArrowRight
            className="size-4 transition-transform duration-500 group-hover:translate-x-0.5"
            strokeWidth={2}
          />
        </PillLink>
      </div>

      <ul className="mt-10 grid grid-cols-1 gap-x-10 sm:grid-cols-2 lg:grid-cols-4">
        {NAV_INDUSTRIES.map((n) => {
          const Icon = n.icon;
          return (
            <li key={n.slug}>
              <IntentLink
                href={`/industries/${n.slug}`}
                className="group grid grid-cols-[18px_minmax(0,1fr)] items-start gap-x-3 border-t border-pp-rule py-3.5 transition-colors duration-500 hover:border-pp-accent/45 focus-visible:border-pp-accent/45 focus-visible:outline-none"
              >
                <Icon
                  aria-hidden
                  className="mt-0.5 size-4 text-pp-muted transition-colors duration-500 group-hover:text-pp-accent group-focus-visible:text-pp-accent"
                  strokeWidth={1.9}
                />
                <span className="min-w-0">
                  <span className="block truncate text-[15px] leading-6 text-pp-ink">
                    {n.label}
                  </span>
                  {/* Always present, always the same height — the row must
                      not resize under the cursor, and a screen reader should
                      hear what the door leads to without having to enter. */}
                  <span className="mt-0.5 block truncate text-[12px] leading-4 text-pp-accent/0 transition-colors duration-500 group-hover:text-pp-accent group-focus-visible:text-pp-accent">
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

export function UseCases() {
  const reduce = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, "-20% 0px -20% 0px");

  const [activeId, setActiveId] = useState(INDUSTRIES[0].id);
  /** How far into the day the clock has got. -1 is midnight, nothing yet. */
  const [head, setHead] = useState(-1);
  const [act, setAct] = useState<Act>("day");
  const [covered, setCovered] = useState(false);
  // One flag for the whole autoplay: the first deliberate interaction of
  // any kind hands the instrument over and it never takes it back.
  const [driving, setDriving] = useState(false);
  // A cursor resting on the panel is not an interaction, but it is a reason
  // not to swap the trade out from under it. Holding is not surrender.
  const [held, setHeld] = useState(false);
  // The hour on the dial once the reader is driving. `null` means
  // "whichever is busiest" — an hour picked in one trade means nothing in
  // the next, so a change of trade drops it.
  const [picked, setPicked] = useState<number | null>(null);

  const active = INDUSTRIES.find((i) => i.id === activeId) ?? INDUSTRIES[0];
  const day = useMemo(() => modelDay(active), [active]);
  const peakIdx = day.cells.findIndex((c) => c.calls === day.peak);

  /** Runs only on screen, only before the reader takes over, never on a
   *  cursor that is resting on the panel, and never under reduced motion. */
  const playing = inView && !driving && !held && !reduce;

  const takeOver = () => {
    setDriving(true);
    // Hand it over whole. Half a day on the screen is worse than no day,
    // and the reader who just reached for a control wants the instrument,
    // not the animation they interrupted.
    setHead(23);
  };

  const pickTrade = (id: string) => {
    takeOver();
    setActiveId(id);
    setPicked(null);
  };

  // Reduced motion gets the end of the scene, immediately: the whole day,
  // answered, on the busiest hour. Never a blank chart, and no timers.
  //
  // Adjusted during render rather than from an effect, and that is the
  // difference between arriving at the finished state and painting the
  // empty one first. `usePrefersReducedMotion` is false on the server and
  // on the first client render so that hydration matches, which means the
  // instrument does start at midnight — but React re-renders before it
  // commits, so nobody ever sees it there. The flip is still theirs
  // afterwards: this fires once, when the preference is learned.
  const [reduced, setReduced] = useState(reduce);
  if (reduced !== reduce) {
    setReduced(reduce);
    if (reduce) {
      setHead(23);
      setAct("covered");
      setCovered(true);
    }
  }

  // What the covered day is holding for: exactly as long as the sentence
  // that describes it takes to read, at the house's reading pace.
  const verdict = covered
    ? `with Neuro Tech Voice, all ${day.total} calls answered, ${day.missed} of them recovered.`
    : `without an agent, ${day.answeredWithout} of ${day.total} calls answered and ${day.missed} to voicemail.`;
  const read = holdFor(verdict);

  /**
   * The clock. One timer at a time, cleared on every change and on
   * unmount, and it does not exist at all unless the instrument is on
   * screen and still playing itself.
   *
   *   day      the hours walk, one at a time, midnight to midnight
   *   hour     the clock parks on the busiest hour and lives it
   *   covered  the agent goes on, the day flips, the hour replays
   *            — held for as long as the verdict takes to read
   *   →        the next trade, from midnight
   */
  useEffect(() => {
    if (!playing) return;
    let t: number;

    if (act === "day") {
      if (head < 23) {
        const next = head + 1;
        t = window.setTimeout(
          () => setHead(next),
          active.volume[next] ? HOUR_BEAT : QUIET_BEAT,
        );
      } else {
        t = window.setTimeout(() => setAct("hour"), BEAT);
      }
    } else if (act === "hour") {
      t = window.setTimeout(() => {
        setCovered(true);
        setAct("covered");
      }, PLAY + BEAT);
    } else {
      t = window.setTimeout(() => {
        const i = INDUSTRIES.findIndex((x) => x.id === activeId);
        setActiveId(INDUSTRIES[(i + 1) % INDUSTRIES.length].id);
        setHead(-1);
        setCovered(false);
        setAct("day");
      }, PLAY + read);
    }

    return () => window.clearTimeout(t);
  }, [playing, act, head, activeId, active, read]);

  // Which hour the dial is holding. While the day walks it is the hour that
  // just rang — the dial is the chart's playhead, magnified — and from the
  // moment the clock parks, or the reader takes over, it is theirs.
  const dialIdx =
    driving || reduce
      ? picked !== null && day.cells[picked]?.calls
        ? picked
        : peakIdx
      : act === "day" && head >= 0
        ? lastRung(day.cells, head, peakIdx)
        : peakIdx;

  // How long the open hour takes to play: one beat while the day is
  // running past it, the full 4.2s once the clock stops on it.
  const span = !driving && act === "day" ? HOUR_BEAT : PLAY;

  // The day so far. The counts at the foot are a running total of the hours
  // that have happened, which is why nothing in this section counts up at
  // anybody: the number moves because the day moved.
  const sofar = day.cells.slice(0, head + 1);
  const callsIn = sofar.reduce((s, c) => s + c.calls, 0);
  const gotThrough = sofar.reduce((s, c) => s + c.answered, 0);
  const answered = covered ? callsIn : gotThrough;
  const missed = callsIn - gotThrough;

  // The rule under the active trade fills as its day runs, so the thing
  // that says "this panel is about to move on" is the same rule that says
  // which trade you are looking at.
  const progress = act === "day" ? (head + 1) / 24 : 1;
  const beat = head >= 0 && !active.volume[head] ? QUIET_BEAT : HOUR_BEAT;

  return (
    <section id="use-cases" className="scroll-mt-28 py-20 md:py-28">
      {/* masthead — on the gutter, not centred, and in the house opener:
          violet eyebrow with the corner dot, then the display line. It does
          not perform an entrance: the instrument below is the motion, and
          a heading that slides in first only delays it. */}
      <Frame className="px-6 md:px-12">
        <SectionHeading eyebrow={USE_CASES_INTRO.eyebrow}>
          {USE_CASES_INTRO.title}
        </SectionHeading>

        <p className="mt-5 max-w-[620px] text-base leading-[26px] text-pretty text-pp-muted">
          {USE_CASES_INTRO.sub}
        </p>
      </Frame>

      {/* the instrument, on the one soft surface in this section */}
      <Frame className="mt-10 px-2 md:mt-14 md:px-4">
        <div
          ref={ref}
          // A click, a focus or a key is an interaction and takes the
          // instrument for good. Merely crossing it holds the clock where
          // it stands — and only for a mouse, because a touch that enters
          // and never leaves would be a scene frozen for the rest of the
          // session. `pointerdown` would be that same bug on a phone:
          // every scroll begins with a finger on this panel.
          onClickCapture={takeOver}
          onFocusCapture={takeOver}
          onKeyDownCapture={takeOver}
          onPointerEnter={(e) => {
            if (e.pointerType === "mouse") setHeld(true);
          }}
          onPointerLeave={() => setHeld(false)}
          className="rounded-[24px] bg-pp-card p-5 md:rounded-[32px] md:p-9"
        >
          {/* Selector rail, on a hairline rather than in a row of pills.
              Scrolls as one row on a phone. */}
          <div className="flex gap-6 overflow-x-auto border-b border-pp-hair [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {INDUSTRIES.map((ind) => {
              const on = ind.id === activeId;
              const Icon = ind.icon;
              return (
                <button
                  key={ind.id}
                  type="button"
                  onClick={() => pickTrade(ind.id)}
                  aria-pressed={on}
                  className={cn(
                    "relative flex min-h-11 shrink-0 items-center gap-2 pb-3 text-[14px] leading-none whitespace-nowrap outline-none transition-colors duration-500 focus-visible:text-pp-accent",
                    on ? "text-pp-ink" : "text-pp-muted hover:text-pp-ink",
                  )}
                >
                  <Icon className="size-4 shrink-0" strokeWidth={1.9} />
                  {ind.label}

                  {on && (
                    <span
                      aria-hidden
                      className="absolute inset-x-0 -bottom-px h-[2px] origin-left bg-pp-accent transition-transform ease-linear motion-reduce:transition-none"
                      style={{
                        transform: `scaleX(${driving || reduce ? 1 : progress})`,
                        transitionDuration: `${beat}ms`,
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 text-pp-muted">
                <Clock className="size-4 shrink-0" strokeWidth={1.9} />
                <span className={LABEL}>One day on the line</span>
              </div>

              {/* the toggle — the section's whole argument, in one control.
                  Two equal columns with one pill sliding between them, so
                  the mode change is a movement rather than a swap. */}
              <div className="rounded-full border border-pp-hair bg-white p-1 text-[13px]">
                <div className="relative grid grid-cols-2">
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 w-1/2 rounded-full bg-pp-ink transition-transform duration-300 motion-reduce:transition-none"
                    style={{
                      transform: covered ? "translateX(100%)" : "translateX(0)",
                    }}
                  />
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
                        setCovered(opt.on);
                      }}
                      className={cn(
                        "relative rounded-full px-4 py-2 leading-none transition-colors duration-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink",
                        covered === opt.on
                          ? "text-white"
                          : "text-pp-muted hover:text-pp-ink",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* The toggle is the section's whole argument and it was
                silent: `aria-pressed` reports the state of a control,
                never what flipping it did to the day. This says the
                outcome, and says it for a change of trade too.

                Live only once the reader is driving. The instrument plays
                a day and then the next trade's day by itself, and a region
                that announced each of those would talk over the page for
                as long as the section stayed on screen. Off, it is still
                read in place — it just stops interrupting. */}
            <p aria-live={driving ? "polite" : "off"} className="sr-only">
              {active.label}, one day on the line — {verdict}
            </p>

            <div className="mt-7">
              <DayChart
                day={day}
                covered={covered}
                head={head}
                staffed={active.staffed}
                label={active.label}
                picked={dialIdx}
                onPick={(h) => {
                  takeOver();
                  setPicked(h);
                }}
              />
            </div>

            {/* the arithmetic, as it accrues */}
            <div className="mt-9 grid grid-cols-2 gap-6 border-t border-pp-hair pt-7 sm:grid-cols-3">
              <div>
                <p className={LABEL}>Calls in</p>
                <span className="mt-2 block text-[28px] leading-none font-medium tracking-[-0.03em] text-pp-ink tabular-nums md:text-[32px]">
                  {callsIn.toLocaleString("en-US")}
                </span>
              </div>

              <div>
                <p className={LABEL}>Answered</p>
                <span
                  className={cn(
                    "mt-2 block text-[28px] leading-none font-medium tracking-[-0.03em] tabular-nums transition-colors duration-500 md:text-[32px]",
                    covered ? "text-pp-accent" : "text-pp-ink",
                  )}
                >
                  {answered.toLocaleString("en-US")}
                </span>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <p className={LABEL}>
                  {covered ? "Recovered" : "To voicemail"}
                </p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span
                    className={cn(
                      "text-[28px] leading-none font-medium tracking-[-0.03em] tabular-nums transition-colors duration-500 md:text-[32px]",
                      covered ? "text-pp-accent" : "text-pp-ink",
                    )}
                  >
                    {covered ? "+" : "−"}
                    {missed}
                  </span>
                  {/* "a day", not a dollar figure. The money that used to
                      sit here was `missed × Industry.value`, and every
                      input to it was ours — see the note on the type.
                      Beside two counts a reader can check against their own
                      phone, the invented number was the one they would test
                      first. */}
                  <span className="text-[14px] leading-5 text-pp-muted">
                    calls / day
                  </span>
                </div>
              </div>
            </div>

            {/* The hour, on the dial. It used to be keyed on the trade, the
                hour and the pace so that a new hour arrived as a fresh set
                of un-drawn strokes — which is what a remount is for when
                the drawing is a CSS transition that needs a start frame.
                The timeline inside does that properly now: it is rebuilt on
                those same three, the context reverts the last one before it
                does, and the component below is allowed to stay alive. */}
            <div className="mt-10 border-t border-pp-hair pt-10">
              <PeakHour
                ind={active}
                cell={day.cells[dialIdx]}
                covered={covered}
                span={span}
                reduce={reduce}
              />
            </div>
          </div>

          {/* provenance — this is a model, and it says so */}
          <p className="mt-9 max-w-[680px] border-t border-pp-hair pt-5 text-[12px] leading-[20px] text-pp-muted">
            Modelled day, not live telemetry — call shapes are typical of each
            trade, and the counts are what a single line gets through in one,
            nothing more. What a recovered call is worth is your own
            arithmetic. Your agent runs on your hours, your services and your
            own calendar.
          </p>
        </div>
      </Frame>

      <Frame className="mt-16 px-6 md:mt-24 md:px-12">
        <IndustriesGateway />
      </Frame>
    </section>
  );
}
