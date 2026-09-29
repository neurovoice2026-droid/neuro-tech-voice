"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Prong, Trade } from "@/lib/pages/industries/schema";
import { cn } from "@/lib/utils";
import { Eyebrow, PillLink, SectionTitle } from "../product/primitives";
import { useInView, usePrefersReducedMotion } from "../product/timing";
import { EMBER, EMBER_INK } from "./parts";
import { markProved } from "./proved";

/* ------------------------------------------------------------------ *
 * §1 — The work that comes in on the phone.
 *
 * One hairline enters from the left edge of the viewport, not from the
 * 1176px column: the call arrives from outside the page. It rings, it is
 * answered, and it forks into the three kinds of work this trade's phone
 * actually brings in. The heading is the hole the fork fills — pick a
 * prong and the sentence completes with what the agent does about it.
 *
 * These are ordinary jobs: somebody who needs a plumber for their flat,
 * a table on Friday, a viewing on Saturday. Left alone the page takes
 * the prong that has to happen today, because that is the call which is
 * most expensive to miss. It plays once and stops; nothing here loops.
 *
 * DRAWN IN PIXELS, NOT IN VIEWBOX UNITS. A fixed viewBox on a full-bleed
 * figure scales to fit the shorter axis and centres what is left, which
 * puts a 670px margin either side of a line that was supposed to start
 * at the edge of the screen. So the figure measures itself and works in
 * CSS pixels: strokes stay exactly 1.6px at every width, the answer node
 * lands on the content column's own left rule, and nothing distorts.
 *
 * No GSAP either. Every stroke is a dashoffset under a CSS transition
 * driven by one piece of React state — this is the LCP element on
 * sixteen routes and the last thing it should do is pull a motion
 * library onto the critical path.
 * ------------------------------------------------------------------ */

type Phase = "idle" | "ringing" | "answered" | "forked";

const H = 300;
const AXIS = 154;
/** Vertical offset of each prong from the axis. Index matches `trade.prongs`. */
const SPREAD = [-84, 0, 84];

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setWidth(el.getBoundingClientRect().width);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export function FirstQuestion({ trade }: { trade: Trade }) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, "-10% 0px");
  const still = usePrefersReducedMotion();

  const urgent = Math.max(0, trade.prongs.findIndex((p) => p.urgent));
  const [phase, setPhase] = useState<Phase>("idle");
  const [picked, setPicked] = useState<number | null>(null);

  // The opening beat, once.
  //
  // `started` is a ref rather than state on purpose: the three steps are
  // one chain, and an effect that depended on `phase` would clear the
  // timers for the steps that had not happened yet, so the call would
  // ring forever. Nothing in these dependencies may change mid-chain.
  const started = useRef(false);
  const timers = useRef<number[]>([]);

  // Cancel only on unmount. If the cleanup ran whenever `inView` changed, a
  // reader who scrolled past and back inside the first two seconds would
  // cancel the chain — and `started` would then refuse to restart it, so the
  // call would ring for the life of the page.
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  useEffect(() => {
    if (still) {
      setPhase("forked");
      return;
    }
    if (!inView || started.current) return;
    started.current = true;
    timers.current = [
      window.setTimeout(() => setPhase("ringing"), 240),
      window.setTimeout(() => setPhase("answered"), 2000),
      window.setTimeout(() => setPhase("forked"), 2560),
    ];
  }, [inView, still]);

  const active = picked ?? urgent;
  const prong = trade.prongs[active];
  const forked = phase === "forked";
  const answered = phase === "answered" || forked;

  function pick(index: number) {
    started.current = true;
    setPhase("forked");
    setPicked(index);
    markProved("fork");
  }

  return (
    <section id="top" ref={ref} className="pt-28 md:pt-[148px]">
      <div className="mx-auto w-[calc(100%-2rem)] max-w-[1176px] sm:w-[calc(100%-3rem)] lg:w-[calc(100%-5rem)]">
        <Eyebrow>{trade.label}</Eyebrow>

        <p className="mt-6 text-[15px] leading-6 text-pp-muted md:text-base">{trade.kicker}</p>

        {/* Reserved height: the sentence completes differently for each
            prong and nothing below it may move when it does — the fork is
            right under it, and a prong that grows the heading by a line
            pulls the next button out from under the finger that picked it.
            A fixed min-height could only guess at two lines, and a third
            line depends on the width, so every ending is laid out in the
            same grid cell, invisibly, and the cell is as tall as the
            longest one at whatever width this is. The two-line minimum
            stays, so a short trade keeps the rhythm it was designed with. */}
        <div className="mt-2 grid min-h-[80px] max-w-[900px] md:min-h-[108px]">
          <SectionTitle as="h1" className="[grid-area:1/1]">
            <span className="text-pp-muted">It </span>
            <span
              key={prong.id}
              className="ind-swap inline-block"
              style={prong.urgent && trade.ink.ember ? { color: EMBER } : undefined}
            >
              {prong.does}.
            </span>
          </SectionTitle>
          {trade.prongs.map((p) => (
            <SectionTitle key={p.id} as="p" size="h1" aria-hidden className="invisible [grid-area:1/1]">
              <span>It </span>
              <span className="inline-block">{p.does}.</span>
            </SectionTitle>
          ))}
        </div>

        <p className="mt-5 max-w-[600px] text-base leading-6 tracking-[0.01em] text-pp-ink/80 md:text-[17px] md:leading-[26px]">
          {trade.standfirst}
        </p>

        <div className="mt-7 flex flex-wrap gap-x-2 gap-y-6">
          <PillLink href="#run">Run a call</PillLink>
          <PillLink href="/register" variant="secondary">
            Start free
          </PillLink>
        </div>
        <p className="mt-3 text-[13px] leading-[18px] text-pp-muted">Free for 14 days. No card needed.</p>
      </div>

      {/* Full-bleed: the call comes in from outside the column. */}
      <div className="mt-10 md:mt-14">
        <Fork trade={trade} active={active} phase={phase} answered={answered} forked={forked} onPick={pick} />
      </div>

      <div className="mx-auto mt-8 w-[calc(100%-2rem)] max-w-[1176px] sm:w-[calc(100%-3rem)] lg:w-[calc(100%-5rem)]">
        <div className="max-w-[620px] border-t border-pp-rule pt-5">
          <p className="font-[family-name:var(--font-pp-cinema)] text-[19px] leading-7 text-pp-ink italic md:text-[21px] md:leading-8">
            &ldquo;{prong.caller}&rdquo;
          </p>
          <p className="mt-3 text-[15px] leading-[23px] text-pp-muted">{prong.asks}</p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * The fork.
 *
 * One component, two authored compositions. Above lg the call runs left
 * to right across the whole viewport; below it the call runs down the
 * left gutter and the prongs go right, which is the way a fork wants to
 * read in a narrow column. The portrait version is drawn, not a squeezed
 * copy of the landscape one — scaling a wide figure into 358px is how a
 * signature visual becomes the weakest thing on a phone.
 * ------------------------------------------------------------------ */

function Fork({
  trade,
  active,
  phase,
  answered,
  forked,
  onPick,
}: {
  trade: Trade;
  active: number;
  phase: Phase;
  answered: boolean;
  forked: boolean;
  onPick: (i: number) => void;
}) {
  const [ref, width] = useWidth();
  const portrait = width > 0 && width < 1024;
  const ringing = phase !== "idle";

  // The column this page's prose sits in, so the answer node can land on
  // its left rule instead of floating at an arbitrary percentage.
  const column = Math.min(1176, width - (width >= 1024 ? 80 : width >= 640 ? 48 : 32));
  const columnLeft = Math.max(0, (width - column) / 2);

  const answerX = portrait ? 46 : Math.max(columnLeft, 300);
  // The prongs run out towards the far edge rather than stopping at the
  // column, so the figure is as wide as the call that arrived. 300px is
  // kept back for the labels; the floor stops the fork collapsing into
  // the answer node on a narrow laptop.
  const endX = portrait ? 96 : Math.max(answerX + 260, width - 300);
  const height = portrait ? 372 : H;
  const axis = portrait ? 62 : AXIS;
  const rows = portrait ? [116, 208, 300] : SPREAD.map((d) => AXIS + d);

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block" fill="none" aria-hidden>
          {/* The line in. Landscape: from the edge of the screen. Portrait:
              down the gutter from above. */}
          <path
            d={portrait ? `M${answerX} 0 V${axis}` : `M0 ${axis} H${answerX}`}
            stroke="#000"
            strokeWidth="1.6"
            pathLength="1"
            strokeDasharray="1"
            strokeDashoffset={ringing ? 0 : 1}
            style={{ transition: "stroke-dashoffset 1400ms cubic-bezier(0.22,1,0.36,1)" }}
          />

          {/* Three rings, marching, while it is still unanswered. */}
          {[0, 1, 2].map((i) => {
            const gap = portrait ? 16 : Math.min(76, Math.max(28, (answerX - 40) / 4));
            const cx = portrait ? answerX : answerX - (3 - i) * gap;
            const cy = portrait ? 12 + i * gap : axis;
            return (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r="4.6"
                stroke="#6b6878"
                strokeWidth="1.6"
                className={ringing && !answered ? "ind-ring" : undefined}
                opacity={ringing && !answered ? undefined : 0}
                style={{ animationDelay: `${i * 210}ms` }}
              />
            );
          })}

          {/* Answered. */}
          <circle cx={answerX} cy={axis} r="9.5" fill="var(--pp-bg)" />
          <circle
            cx={answerX}
            cy={axis}
            r="4.6"
            fill={answered ? "#000" : "var(--pp-bg)"}
            stroke="#000"
            strokeWidth="1.6"
            style={{ transition: "fill 420ms ease" }}
          />
          {!portrait && (
            <text x={answerX} y={axis - 22} textAnchor="middle" fontSize="11" letterSpacing="0.12em" fill="#6b6878">
              {answered ? "ANSWERED" : "RINGING"}
            </text>
          )}

          {/* The fork. */}
          {trade.prongs.map((p, i) => {
            const on = forked && i === active;
            const ink = prongInk(p, trade, on);
            const y = rows[i];
            const bend = portrait ? 34 : Math.min(190, (endX - answerX) * 0.3);
            const d = portrait
              ? `M${answerX} ${axis} V${y - bend} C ${answerX} ${y - bend / 2}, ${answerX + 14} ${y}, ${endX} ${y}`
              : `M${answerX} ${axis} C ${answerX + bend} ${axis}, ${answerX + bend * 1.15} ${y}, ${answerX + bend * 2} ${y} H ${endX}`;
            return (
              <path
                key={p.id}
                d={d}
                stroke={ink}
                strokeWidth="1.6"
                strokeDasharray={on ? "1" : "0.0016 0.0075"}
                pathLength="1"
                strokeDashoffset={forked ? 0 : 1}
                opacity={forked ? (on ? 1 : 0.5) : 0}
                style={{
                  transition:
                    "stroke-dashoffset 760ms cubic-bezier(0.22,1,0.36,1), opacity 400ms ease, stroke 320ms ease",
                  transitionDelay: `${i * 80}ms`,
                }}
              />
            );
          })}

          {trade.prongs.map((p, i) => {
            const on = forked && i === active;
            const ink = prongInk(p, trade, on);
            return (
              <g key={p.id} opacity={forked ? 1 : 0} style={{ transition: "opacity 360ms ease 480ms" }}>
                <circle cx={endX} cy={rows[i]} r="9.5" fill="var(--pp-bg)" />
                <circle
                  cx={endX}
                  cy={rows[i]}
                  r="4.4"
                  fill={on ? ink : "var(--pp-bg)"}
                  stroke={ink}
                  strokeWidth="1.6"
                  style={{ transition: "fill 320ms ease, stroke 320ms ease" }}
                />
              </g>
            );
          })}
        </svg>
      )}

      {/* The labels are real buttons over the figure, so the fork is
          keyboard-operable and reads as three choices rather than as a
          picture with text in it. */}
      <div className="absolute inset-0">
        {trade.prongs.map((p, i) => {
          const on = i === active;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onPick(i)}
              aria-pressed={on}
              className={cn(
                "absolute flex min-h-11 -translate-y-1/2 items-center rounded-full pr-3 text-left transition-opacity duration-300",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink",
                forked ? "opacity-100" : "pointer-events-none opacity-0",
              )}
              style={{ left: endX + 20, top: rows[i] }}
            >
              <span
                className={cn(
                  "block text-[15px] leading-5 transition-colors",
                  on ? "text-pp-ink" : "text-pp-muted hover:text-pp-ink",
                )}
                style={on ? { color: labelInk(p, trade) } : undefined}
              >
                {p.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Ember is the urgency ink and it is allowed exactly once: on the kind
 * of work that has to happen today, and only on the trades where that
 * is genuinely true. Everywhere else the selected prong is black.
 */
function prongInk(prong: Prong, trade: Trade, selected: boolean) {
  if (!selected) return "#6b6878";
  return prong.urgent && trade.ink.ember ? EMBER : "#000000";
}

/** The same ink for a 15px label, dark enough to read on white. */
function labelInk(prong: Prong, trade: Trade) {
  return prong.urgent && trade.ink.ember ? EMBER_INK : "#000000";
}
