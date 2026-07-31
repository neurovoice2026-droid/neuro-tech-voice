"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  CalendarCheck2,
  Check,
  ChevronLeft,
  ChevronRight,
  Play,
  Sparkles,
  TrendingUp,
  User,
} from "lucide-react";
import { SITE_TIME_ZONE } from "@/lib/site";
import { cn } from "@/lib/utils";
import { EASE } from "./reveal";

/**
 * The product, shown as a window.
 *
 * This is the live site's own device: a browser frame — traffic lights, a
 * URL pill — around a panel of real UI, one per feature, alternating sides
 * down the page. The frame is doing a job the copy cannot: it says the
 * thing beside it is software that exists, at a glance, before a word is
 * read.
 *
 * What changed on the way over is only the stock it is printed on. The
 * reference draws white cards on a white page with #8249df on them; here
 * the same panels are set on --cover-panel with --cover-brand-lit as the
 * accent, because that pair is what the cover's palette already validated
 * for small text and chart fills. Nothing was re-hued by eye — every
 * colour below is one of the section's own tokens.
 *
 * Two exceptions, both deliberate:
 *
 *  · The traffic lights keep real red/amber/green, held at 70% so they
 *    read as a window on dark paper rather than as three warning lamps.
 *    Recolouring them purple would stop the frame being a browser.
 *  · --cover-mint carries the two places the reference spends green as a
 *    reading — the agent's online dot, the week's trend — and nowhere
 *    else.
 *
 * Sizing note: everything is in `em` off the section's fluid base, as the
 * rest of the cover is. Where a block sets its own `text-[…em]`, its
 * children's `em` compound against that — so each panel sets scale once,
 * on the wrapper, and never again on a child that also carries a box size.
 */

const LIGHTS = ["#e0655d", "#d9a63c", "#54b257"];

function Panel({
  url,
  children,
  className,
}: {
  url: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-[0.9em] border border-[var(--cover-paper)]/12 bg-[var(--cover-panel)] text-[var(--cover-paper)] shadow-[0_1.6em_3.6em_-1.4em_rgba(0,0,0,0.85)]",
        className,
      )}
    >
      <div className="flex items-center gap-[0.9em] border-b border-[var(--cover-paper)]/10 bg-[var(--cover-paper)]/4 px-[1.1em] py-[0.8em]">
        <span aria-hidden className="flex shrink-0 gap-[0.4em]">
          {LIGHTS.map((c) => (
            <span
              key={c}
              className="size-[0.55em] rounded-full opacity-70"
              style={{ background: c }}
            />
          ))}
        </span>
        <span className="truncate rounded-[0.4em] bg-[var(--cover-ink)]/45 px-[0.75em] py-[0.3em] font-mono text-[0.65em] text-[var(--cover-paper)]/45">
          {url}
        </span>
      </div>

      <div className="p-[1.3em]">{children}</div>
    </div>
  );
}

const WEEK = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * Coverage: 24/7 set large, with the week ticked off beneath it.
 *
 * Seven identical checks is the point rather than a shortfall — the claim
 * beside it is "nights, weekends, and holidays", and a row where one cell
 * could have been empty and none is says that better than a varying chart
 * would.
 */
export function AgentMockup() {
  return (
    <Panel url="app.neurotechvoice.com/agent">
      <div className="flex items-center justify-between gap-[1em]">
        <span className="inline-flex items-center gap-[0.6em] text-[0.88em] font-medium">
          <span className="size-[0.5em] shrink-0 animate-pulse rounded-full bg-[var(--cover-mint)]" />
          Agent online
        </span>
        <span className="shrink-0 rounded-full bg-[var(--cover-mint)]/14 px-[0.85em] py-[0.35em] text-[0.6em] font-semibold uppercase tracking-[0.16em] text-[var(--cover-mint)]">
          Active
        </span>
      </div>

      <div className="mt-[1.3em] flex items-baseline gap-[0.7em]">
        <p className="text-[3.4em] font-medium leading-none tracking-[-0.05em] tabular-nums text-[var(--cover-brand-lit)]">
          24/7
        </p>
        <p className="text-[0.85em] leading-[1.3] text-[var(--cover-paper)]/55">
          coverage, every week
        </p>
      </div>

      <div className="mt-[1.5em] grid grid-cols-7 gap-x-[0.5em] gap-y-[0.6em]">
        {WEEK.map((d, i) => (
          <span
            key={`d${i}`}
            className="text-center text-[0.62em] font-medium uppercase tracking-[0.1em] text-[var(--cover-paper)]/45"
          >
            {d}
          </span>
        ))}

        {WEEK.map((_, i) => (
          <motion.span
            key={`c${i}`}
            initial={{ opacity: 0, scale: 0.5 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.06 * i, duration: 0.4, ease: EASE }}
            className="mx-auto grid size-[1.9em] place-items-center rounded-full bg-[var(--cover-brand-lit)] text-[var(--cover-ink)]"
          >
            <Check className="size-[1em]" strokeWidth={3} />
          </motion.span>
        ))}
      </div>
    </Panel>
  );
}

/** Live voice waveform. Bars breathe unless reduced motion is asked for. */
function Waveform({ bars = 30 }: { bars?: number }) {
  const reduce = useReducedMotion();

  return (
    <div className="flex h-[2.4em] flex-1 items-center gap-[0.16em]">
      {Array.from({ length: bars }).map((_, i) => {
        const base = 0.26 + 0.74 * Math.abs(Math.sin(i * 0.7));
        return (
          <motion.span
            key={i}
            className="w-[0.16em] flex-1 rounded-full bg-[var(--cover-brand-lit)]/75"
            style={{ height: "100%", transformOrigin: "center" }}
            animate={
              reduce
                ? { scaleY: base }
                : { scaleY: [base * 0.35, base, base * 0.5] }
            }
            transition={{
              duration: 0.8 + (i % 5) * 0.12,
              repeat: Infinity,
              ease: "easeInOut",
              delay: (i % 7) * 0.06,
            }}
          />
        );
      })}
    </div>
  );
}

/** A call in progress: the waveform, then the two lines that matter. */
export function VoiceMockup() {
  return (
    <Panel url="app.neurotechvoice.com/agent/voice">
      <div className="flex items-center gap-[0.9em] rounded-[0.7em] bg-[var(--cover-paper)]/5 px-[0.9em] py-[0.8em]">
        <span className="grid size-[2.2em] shrink-0 place-items-center rounded-full bg-[var(--cover-brand-lit)] text-[var(--cover-ink)]">
          <Play
            className="size-[0.9em] translate-x-[0.06em]"
            fill="currentColor"
            strokeWidth={0}
          />
        </span>

        <Waveform />

        <span className="shrink-0 font-mono text-[0.68em] tabular-nums text-[var(--cover-paper)]/50">
          0:12
        </span>
      </div>

      <div className="mt-[1.2em] flex items-start gap-[0.6em]">
        <span className="mt-[0.15em] grid size-[1.5em] shrink-0 place-items-center rounded-full bg-[var(--cover-paper)]/8 text-[var(--cover-paper)]/50">
          <User className="size-[0.8em]" strokeWidth={2} />
        </span>
        <p className="max-w-[80%] rounded-[0.7em] rounded-tl-[0.2em] bg-[var(--cover-paper)]/7 px-[0.9em] py-[0.6em] text-[0.85em] leading-[1.45] text-[var(--cover-paper)]/85">
          Hi, I&rsquo;d like to book a demo for next week.
        </p>
      </div>

      <div className="mt-[0.7em] flex items-start justify-end gap-[0.6em]">
        <p className="max-w-[80%] rounded-[0.7em] rounded-tr-[0.2em] bg-[var(--cover-brand-lit)] px-[0.9em] py-[0.6em] text-[0.85em] leading-[1.45] text-[var(--cover-ink)]">
          I&rsquo;d love to help! Let me check our calendar&hellip;
        </p>
        <span className="mt-[0.15em] grid size-[1.5em] shrink-0 place-items-center rounded-full bg-[var(--cover-brand-lit)]/15 text-[var(--cover-brand-lit)]">
          <Sparkles className="size-[0.8em]" strokeWidth={2} />
        </span>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * The calendar's clock.
 * ------------------------------------------------------------------ */

/** The calendar date in `tz` as `[year, month, day]`, month 1-based. */
function zonedDate(tz: string, at: number): [number, number, number] {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const read = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  return [read("year"), read("month"), read("day")];
}

/** Milliseconds from `at` to the next midnight in `tz`. */
function untilMidnight(tz: string, at: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const read = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  return (
    ((23 - read("hour")) * 60 * 60 +
      (59 - read("minute")) * 60 +
      (60 - read("second"))) *
    1000
  );
}

/**
 * Today, in the company's timezone, read as a store rather than at render.
 *
 * This page is prerendered, so `new Date()` during render is the *build's*
 * date: the calendar would ship frozen at deploy and then disagree with
 * the browser the moment it hydrated. Same `useSyncExternalStore` shape as
 * the hero's clock, and for the same reason — the server snapshot is a
 * deliberate blank, and the real date arrives on mount. The panel is faded
 * out and well below the fold by then, so the blank frame is never seen.
 *
 * `subscribe` re-reads at the next local midnight, so a tab left open
 * overnight rolls the date over on its own. It never sleeps more than an
 * hour: a DST change moves midnight after the timer is already armed, and
 * re-reading hourly makes that self-correcting rather than an off-by-one
 * day until the next reload.
 */
const TODAY = {
  subscribe(onChange: () => void) {
    let id: ReturnType<typeof setTimeout>;
    const arm = () => {
      const wait = Math.min(
        untilMidnight(SITE_TIME_ZONE, Date.now()),
        60 * 60 * 1000,
      );
      id = setTimeout(() => {
        onChange();
        arm();
      }, wait + 1000);
    };
    arm();
    return () => clearTimeout(id);
  },
  /** `YYYY-M-D`. A string, so React compares snapshots by value. */
  get: () => zonedDate(SITE_TIME_ZONE, Date.now()).join("-"),
  getOnServer: () => "",
};

const MONTH_LABEL = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

/**
 * The month, with the slot the agent took.
 *
 * The booking is tomorrow — which is exactly what the line under the grid
 * claims — so the grid shows *tomorrow's* month rather than today's. On
 * the last day of a month that rolls the whole panel forward, and it has
 * to: the highlighted cell must never fall outside the month on screen.
 *
 * All the arithmetic is done on UTC-anchored dates. That is not a timezone
 * choice, it is the way to keep it honest — these are calendar operations
 * (which weekday does the 1st fall on, how many days in the month) and
 * doing them on local dates would let a DST hour shift a date across
 * midnight and silently move the grid by a day.
 */
export function CalendarMockup() {
  const today = useSyncExternalStore(
    TODAY.subscribe,
    TODAY.get,
    TODAY.getOnServer,
  );

  let label = " ";
  let booked = 0;
  // `null` is an empty cell: the blanks that pad the month into whole
  // weeks, and — before mount — the whole grid.
  let cells: (number | null)[] = Array.from({ length: 35 }, () => null);

  if (today) {
    const [y, m, d] = today.split("-").map(Number);
    // Day overflow normalises, so the 32nd of July is simply 1 August.
    const booking = new Date(Date.UTC(y, m - 1, d + 1));
    const year = booking.getUTCFullYear();
    const month = booking.getUTCMonth();
    const first = new Date(Date.UTC(year, month, 1));
    // Day 0 of the next month is the last day of this one.
    const length = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

    label = MONTH_LABEL.format(first);
    booked = booking.getUTCDate();
    cells = [
      ...Array.from<null>({ length: first.getUTCDay() }).fill(null),
      ...Array.from({ length }, (_, i) => i + 1),
    ];
  }

  // Close the last row, or the grid's bottom-right corner hangs open.
  while (cells.length % 7) cells.push(null);

  return (
    <Panel url="app.neurotechvoice.com/calendar">
      <div className="flex items-center justify-between">
        <p className="text-[1.05em] font-medium tracking-[-0.02em]">{label}</p>
        <span aria-hidden className="flex items-center gap-[0.7em] text-[var(--cover-paper)]/35">
          <ChevronLeft className="size-[0.9em]" strokeWidth={2} />
          <ChevronRight className="size-[0.9em]" strokeWidth={2} />
        </span>
      </div>

      {/* Scale is set once, here: every `em` below compounds off 0.82. */}
      <div className="mt-[1em] grid grid-cols-7 gap-y-[0.25em] text-[0.82em]">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span
            key={i}
            className="pb-[0.7em] text-center text-[0.75em] font-medium uppercase tracking-[0.1em] text-[var(--cover-paper)]/40"
          >
            {d}
          </span>
        ))}

        {cells.map((d, i) =>
          d === null ? (
            // Sized rather than bare: an all-blank row has no numbered
            // cell to take its height from, and the pre-mount grid would
            // collapse to nothing and then shove the panel open.
            <span key={`e${i}`} className="mx-auto size-[2.2em]" />
          ) : (
            <span
              key={`d${d}`}
              className={cn(
                "relative mx-auto grid size-[2.2em] place-items-center rounded-[0.45em] tabular-nums",
                d === booked
                  ? "bg-[var(--cover-brand-lit)] font-semibold text-[var(--cover-ink)]"
                  : "text-[var(--cover-paper)]/65",
              )}
            >
              {d}
              {d === booked && (
                <span className="absolute -right-[0.15em] -top-[0.15em] size-[0.5em] rounded-full border border-[var(--cover-brand-lit)] bg-[var(--cover-panel)]" />
              )}
            </span>
          ),
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.3, duration: 0.5, ease: EASE }}
        className="mt-[1.2em] flex items-center gap-[0.8em] rounded-[0.6em] bg-[var(--cover-paper)]/5 px-[0.9em] py-[0.8em]"
      >
        <span className="grid size-[1.9em] shrink-0 place-items-center rounded-full bg-[var(--cover-brand-lit)]/15 text-[var(--cover-brand-lit)]">
          <CalendarCheck2 className="size-[1em]" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p className="text-[0.85em] font-medium">Demo Call booked</p>
          <p className="truncate text-[0.75em] text-[var(--cover-paper)]/50">
            Tomorrow, 2:00 PM, confirmed automatically
          </p>
        </div>
      </motion.div>
    </Panel>
  );
}

/**
 * The week's calls, and the two numbers the dashboard leads with.
 *
 * The bars carry a full-height track behind them so a quiet day still
 * reads as a measured day rather than as a gap, and the seven values sum
 * to the 247 printed underneath — the chart and the stat are the same
 * week, not two decorations that happen to sit together.
 */
export function AnalyticsMockup() {
  const calls = [22, 36, 30, 44, 34, 50, 31];
  const peak = Math.max(...calls);

  return (
    <Panel url="app.neurotechvoice.com/analytics">
      <div className="flex items-baseline justify-between gap-[1em]">
        <p className="text-[0.95em] font-medium">Calls this week</p>
        <span className="inline-flex shrink-0 items-center gap-[0.35em] rounded-full bg-[var(--cover-mint)]/14 px-[0.75em] py-[0.3em] text-[0.68em] font-semibold tabular-nums text-[var(--cover-mint)]">
          <TrendingUp className="size-[1em]" strokeWidth={2.5} />
          +12%
        </span>
      </div>

      <div className="mt-[1.3em] flex h-[6.5em] items-end gap-[0.5em]">
        {calls.map((v, i) => (
          /* h-full on the column matters: the fill's height is a percentage
             and a percentage resolves against its parent. Left to auto
             height, every bar collapses to nothing. */
          <div key={i} className="relative flex h-full flex-1 items-end">
            <span
              aria-hidden
              className="absolute inset-0 rounded-[0.3em] bg-[var(--cover-paper)]/10"
            />
            <motion.span
              className="relative w-full rounded-[0.3em] bg-[var(--cover-brand-lit)]"
              initial={{ scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.05 * i, duration: 0.6, ease: EASE }}
              style={{
                height: `${Math.round((v / peak) * 100)}%`,
                transformOrigin: "bottom",
              }}
            />
          </div>
        ))}
      </div>

      <div className="mt-[0.7em] grid grid-cols-7 gap-[0.5em]">
        {WEEK.map((d, i) => (
          <span
            key={i}
            className="text-center text-[0.62em] font-medium uppercase tracking-[0.1em] text-[var(--cover-paper)]/40"
          >
            {d}
          </span>
        ))}
      </div>

      <div className="mt-[1.3em] grid grid-cols-2 gap-[0.7em]">
        {[
          { value: "247", label: "calls this week" },
          { value: "94%", label: "positive sentiment" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-[0.6em] bg-[var(--cover-paper)]/5 px-[0.9em] py-[0.8em]"
          >
            <p className="text-[1.5em] font-medium leading-none tracking-[-0.04em] tabular-nums">
              {s.value}
            </p>
            <p className="mt-[0.5em] text-[0.72em] text-[var(--cover-paper)]/50">
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </Panel>
  );
}
