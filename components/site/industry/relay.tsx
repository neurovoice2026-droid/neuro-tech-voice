"use client";

import { useEffect, useRef, useState } from "react";
import type { Trade } from "@/lib/pages/industries/schema";
import { Eyebrow, Frame, SectionTitle } from "../product/primitives";
import { useInView, usePrefersReducedMotion } from "../product/timing";
import { ToolName } from "./parts";
import { markProved } from "./proved";

/* ------------------------------------------------------------------ *
 * §5 — The relay.
 *
 * The objection: what about the calls it can't handle? The answer only
 * counts if it is measured, so the instrument is a stopwatch. The
 * caller's line keeps running — they are still talking, they never hear
 * a hold — while a second short line leaves it and lands on a person.
 *
 * The number is the argument. Everything else on screen is there to
 * make the number believable.
 * ------------------------------------------------------------------ */

export function Relay({ trade }: { trade: Trade }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, "-20% 0px");
  const still = usePrefersReducedMotion();
  const { relay } = trade;

  const [run, setRun] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (still) {
      setElapsed(relay.seconds);
      return;
    }
    if (!inView && run === 0) return;
    setElapsed(0);
    const begin = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const e = Math.min(relay.seconds, ((now - begin) / 1000) * (relay.seconds / 2.4));
      setElapsed(e);
      if (e < relay.seconds) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, run, still, relay.seconds]);

  const progress = relay.seconds ? elapsed / relay.seconds : 1;
  const landed = progress > 0.98;

  return (
    <section id="relay" ref={ref} className="scroll-mt-28">
      <Frame className="px-6 md:px-12">
        <Eyebrow>The relay</Eyebrow>
        <SectionTitle className="mt-4 max-w-[860px]">
          {relay.who[0].toUpperCase() + relay.who.slice(1)} knows in{" "}
          <span className="tabular-nums">{relay.seconds}</span> seconds
        </SectionTitle>
        <p className="mt-5 max-w-[580px] text-base leading-[25px] text-pp-ink/80">{relay.because}</p>
      </Frame>

      <Frame className="mt-8 px-2 md:px-4">
        <div className="rounded-[24px] bg-pp-card p-5 md:p-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-12">
            <div>
              <Figure progress={progress} landed={landed} who={relay.who} />

              <div className="mt-6 flex items-baseline gap-4">
                <p className="text-[34px] leading-none text-pp-ink tabular-nums md:text-[44px]">
                  {elapsed.toFixed(1)}
                  <span className="ml-1 text-[15px] text-pp-muted">s</span>
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setRun((r) => r + 1);
                    markProved("relay");
                  }}
                  className="ml-auto min-h-11 rounded-full bg-white px-4 text-[14px] text-pp-ink shadow-[0_0_0_1px_rgb(24_16_40/0.06)] transition-colors hover:bg-pp-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink"
                >
                  Run it again
                </button>
              </div>
              <p className="mt-1 text-[13px] leading-5 text-pp-muted">
                The caller is still talking. They never hear a hold, and they are never told to ring back.
              </p>
            </div>

            <aside>
              <p className="text-[11px] leading-4 font-medium tracking-[0.12em] text-pp-muted uppercase">
                What lands with them
              </p>
              <ul className="mt-3 space-y-2">
                {relay.carries.map((c) => (
                  <li key={c} className="border-b border-pp-hair pb-2 text-[15px] leading-[22px] text-pp-ink">
                    {c}
                  </li>
                ))}
              </ul>
              <p className="mt-4 flex flex-wrap gap-x-3 gap-y-1">
                {relay.by.map((tool) => (
                  <ToolName key={tool} tool={tool} className="text-pp-muted" />
                ))}
              </p>
            </aside>
          </div>
        </div>
      </Frame>
    </section>
  );
}

/*
  The figure's words are set in HTML, not in the SVG. Text inside a scaled
  viewBox shrinks with the card, and on a phone the 560-unit drawing came
  out at under half size — the caption was 4.6px and the name of the
  person being fetched was 5.8px. So the drawing scales and the words do
  not, and a phone gets its own proportions of the same drawing rather
  than a shrunken copy of the wide one.
*/

type Geometry = {
  w: number;
  h: number;
  /** Where the branch leaves the call, and where it lands. */
  from: number;
  to: [number, number];
  branch: string;
};

const WIDE: Geometry = {
  w: 560,
  h: 102,
  from: 180,
  to: [520, 90],
  branch: "M180 12 C 240 12, 250 90, 330 90 H 520",
};

const NARROW: Geometry = {
  w: 320,
  h: 116,
  from: 100,
  to: [300, 104],
  branch: "M100 12 C 150 12, 158 104, 214 104 H 300",
};

function Figure({ progress, landed, who }: { progress: number; landed: boolean; who: string }) {
  return (
    <div aria-hidden>
      <p className="text-[11px] leading-4 tracking-[0.1em] text-[#6b6878] uppercase">
        The caller, still on the line
      </p>
      <Drawing g={NARROW} progress={progress} landed={landed} className="mt-1 sm:hidden" />
      <Drawing g={WIDE} progress={progress} landed={landed} className="mt-1 hidden sm:block" />
      {/* Ends just short of the node, as the SVG label did. */}
      <p
        className="mt-1 ml-auto max-w-[85%] pr-[10.6%] text-right text-[14px] leading-5 text-balance transition-colors duration-[240ms] sm:max-w-[70%] sm:pr-[9.6%]"
        style={{ color: landed ? "#000" : "#6b6878" }}
      >
        {who}
      </p>
    </div>
  );
}

function Drawing({
  g,
  progress,
  landed,
  className,
}: {
  g: Geometry;
  progress: number;
  landed: boolean;
  className: string;
}) {
  const [x, y] = g.to;
  return (
    <svg viewBox={`0 0 ${g.w} ${g.h}`} className={`h-auto w-full ${className}`} fill="none">
      {/* the call, still running */}
      <path d={`M0 12 H${g.w}`} stroke="#6b6878" strokeWidth="1.6" strokeDasharray="0.01 4.6" strokeLinecap="round" />

      {/* the branch */}
      <path
        d={g.branch}
        stroke="#551a89"
        strokeWidth="1.6"
        pathLength="1"
        strokeDasharray="1"
        strokeDashoffset={1 - progress}
      />
      <circle cx={g.from} cy="12" r="9" fill="var(--pp-card)" />
      <circle cx={g.from} cy="12" r="4.4" fill="#551a89" />

      {/* the person */}
      <circle cx={x} cy={y} r="9" fill="var(--pp-card)" />
      <circle
        cx={x}
        cy={y}
        r="4.4"
        fill={landed ? "#551a89" : "var(--pp-card)"}
        stroke="#551a89"
        strokeWidth="1.6"
        style={{ transition: "fill 240ms ease" }}
      />
    </svg>
  );
}
