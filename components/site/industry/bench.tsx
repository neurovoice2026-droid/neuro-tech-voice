"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Trade } from "@/lib/pages/industries/schema";
import { cn } from "@/lib/utils";
import { Eyebrow, Frame, SectionTitle } from "../product/primitives";
import { useInView, usePrefersReducedMotion } from "../product/timing";
import { Gate, ToolName } from "./parts";
import { markProved } from "./proved";

/* ------------------------------------------------------------------ *
 * §2 — The bench.
 *
 * The objection this answers is the first one every owner raises: it
 * won't understand how my customers talk. So the instrument is the
 * trade's own vocabulary, said as badly as people really say it — "thing
 * on the wall making a kettle noise", "tail lift needed at the drop" —
 * and what the agent reaches for when it hears it.
 *
 * The honest sentence under the heading is load-bearing and it is spent
 * early on purpose: these are the same fourteen tools on all sixteen of
 * these pages. What changes per trade is which one a sentence lands on,
 * and that is a more convincing claim than pretending each trade gets a
 * different machine.
 * ------------------------------------------------------------------ */

const CYCLE_MS = 2600;

export function Bench({ trade }: { trade: Trade }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, "-15% 0px");
  const still = usePrefersReducedMotion();

  const [active, setActive] = useState(0);
  const [touched, setTouched] = useState(false);

  // Plays three, then stops on the third. A rail that cycles forever
  // reads as a screensaver and stops being something you operate.
  const started = useRef(false);
  const cycle = useRef(0);
  // Unmount only — see the note in first-question.tsx.
  useEffect(() => () => window.clearInterval(cycle.current), []);

  useEffect(() => {
    if (!inView || touched || still || started.current) return;
    started.current = true;
    let step = 0;
    cycle.current = window.setInterval(() => {
      step += 1;
      if (step >= 3) window.clearInterval(cycle.current);
      setActive((a) => (a + 1) % Math.min(trade.intents.length, 16));
    }, CYCLE_MS);
  }, [inView, touched, still, trade.intents.length]);

  function pick(i: number) {
    setTouched(true);
    setActive(i);
    markProved("bench");
  }

  const intents = trade.intents.slice(0, 16);

  return (
    <section id="bench" ref={ref} className="scroll-mt-28">
      <Frame className="px-6 md:px-12">
        <Eyebrow>Their words</Eyebrow>
        <SectionTitle className="mt-4 max-w-[820px]">
          Say it the way your callers say it, and watch what it reaches for
        </SectionTitle>
        <p className="mt-5 max-w-[560px] text-base leading-[25px] text-pp-ink/80">
          The agent has fourteen tools. It has the same fourteen on every one of these pages — what
          changes with your trade is which one a sentence lands on, and how much of the job is done by
          the time it puts the phone down.
        </p>
      </Frame>

      <Frame className="mt-8 px-2 md:px-4">
        <div className="rounded-[24px] bg-pp-card p-4 md:p-7">
          {/* Edge to edge on a phone with the next chip peeking, so it is
              obvious the rail scrolls. Wrapped on a wide screen. */}
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
            {trade.intents.slice(0, 16).map((x, i) => (
              <button
                key={x.chip}
                type="button"
                onClick={() => pick(i)}
                aria-pressed={i === active}
                className={cn(
                  "min-h-11 shrink-0 rounded-full px-4 text-[14px] leading-none whitespace-nowrap transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink",
                  i === active
                    ? "bg-pp-ink text-white"
                    : "bg-white text-pp-muted hover:text-pp-ink",
                )}
              >
                {x.chip}
              </button>
            ))}
          </div>

          {/* Each part of the answer is laid out once per chip in the same
              cell, invisibly, so every part is as tall as its longest version
              and the autoplay — which runs without anyone touching it —
              never moves a line, in the card or below it. Stacked part by
              part rather than whole: a quote that wraps to a second line
              would otherwise push down what the agent reached for. */}
          <div className="mt-6 grid gap-6 md:mt-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-10">
            <div>
              <p className="text-[11px] leading-4 font-medium tracking-[0.12em] text-pp-muted uppercase">
                It hears
              </p>
              <Stack
                className="mt-2"
                live={active}
                items={intents}
                render={(x) => (
                  <p className="font-[family-name:var(--font-pp-cinema)] text-[21px] leading-8 text-pp-ink italic md:text-[24px] md:leading-9">
                    &ldquo;{x.chip}&rdquo;
                  </p>
                )}
              />
            </div>

            <div>
              {/* Top-aligned, not baseline: both are 11px on a 16px line so it
                  reads the same, and a tool with no gate leaves the stack with
                  no baseline of its own — which moved this row mid-autoplay. */}
              <div className="flex items-start gap-3">
                <p className="text-[11px] leading-4 font-medium tracking-[0.12em] text-pp-muted uppercase">
                  It reaches for
                </p>
                <Stack
                  className="ml-auto justify-items-end"
                  live={active}
                  fade={false}
                  items={intents}
                  render={(x) => <Gate tool={x.reaches} />}
                />
              </div>
              <Stack
                live={active}
                items={intents}
                render={(x) => (
                  <>
                    <p className="mt-2">
                      <ToolName tool={x.reaches} className="text-[15px] text-pp-ink" />
                    </p>
                    <p className="mt-3 text-[15px] leading-[23px] text-pp-muted">{x.then}</p>
                  </>
                )}
              />
            </div>
          </div>
        </div>
      </Frame>

      <Frame className="mt-5 px-6 md:px-12">
        <p className="max-w-[620px] text-[13px] leading-5 text-pp-muted">
          The words on those chips are the trade&rsquo;s, not ours:{" "}
          {trade.jargon.slice(0, 6).join(", ")}. Get one of them wrong on the phone and the person on
          the other end knows within a sentence.
        </p>
      </Frame>
    </section>
  );
}

/**
 * One part of the answer, as it is for the active chip, laid over every
 * chip's version of the same part. The versions are invisible and hidden
 * from assistive tech; they are only there to hold the cell open at the
 * height of the longest one. The live one fades in each time the chip
 * changes, as it always did.
 */
function Stack<T>({
  items,
  live,
  render,
  fade = true,
  className,
}: {
  items: readonly T[];
  live: number;
  render: (item: T) => ReactNode;
  fade?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("grid content-start", className)}>
      <div key={live} className={cn("[grid-area:1/1]", fade && "ind-swap")}>
        {render(items[live])}
      </div>
      {items.map((x, i) => (
        <div key={i} aria-hidden className="invisible [grid-area:1/1]">
          {render(x)}
        </div>
      ))}
    </div>
  );
}
