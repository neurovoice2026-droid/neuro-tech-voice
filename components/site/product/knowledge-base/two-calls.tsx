"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { RotateCcw } from "lucide-react";
import { TWO_CALLS, type TwoCallsTurn } from "@/lib/pages/knowledge-base";
import { cn } from "@/lib/utils";
import { Frame, Orb, SectionHeading } from "../primitives";
import { holdFor, useInView, usePrefersReducedMotion } from "../timing";
import { KB_MESH } from "./parts";

/* ------------------------------------------------------------------ *
 * Two calls side by side, on one clock.
 *
 * The same caller asks the same question of two agents: one with
 * instructions only, one with the documents behind it. Each line lands in
 * both at once, so the only thing that differs is the answer — and then
 * the ending: one panel settles into a call back nobody has made yet, the
 * other lights up with an answer given on the call.
 *
 * It plays once, the first time it is seen, and holds its ending.
 * ------------------------------------------------------------------ */

const DONE = 4;
const MUTED_MESH = ["#4a4852", "#7a7884", "#a9a7b2", "#d4d2da", "#f3f2f6"] as const;

export function KbTwoCalls() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, "-20% 0px");
  const reduce = usePrefersReducedMotion();
  const [step, setStep] = useState(0);
  const [started, setStarted] = useState(false);

  const calls = TWO_CALLS.calls;
  const shown = reduce ? DONE : step;

  useEffect(() => {
    if (reduce || step >= DONE) return;
    if (!inView && !started) return;
    const longest = (i: number) =>
      calls.reduce((m, c) => Math.max(m, holdFor(c.turns[i - 1]?.t ?? "")), 0);
    // A touch quicker than reading pace: the point is the contrast, not the script.
    const delay = step === 0 ? 500 : step <= 3 ? Math.max(1200, longest(step) * 0.7) : 0;
    const id = window.setTimeout(() => {
      setStarted(true);
      setStep((s) => s + 1);
    }, delay);
    return () => window.clearTimeout(id);
  }, [inView, started, step, reduce, calls]);

  return (
    <>
      <Frame className="px-6 pb-10 md:px-12 md:pb-14">
        <SectionHeading eyebrow={TWO_CALLS.eyebrow} className="max-w-[780px]">
          {TWO_CALLS.title}
        </SectionHeading>
      </Frame>

      <Frame className="px-4 md:px-6">
        <div ref={ref} className="grid gap-4 md:grid-cols-2">
          {calls.map((c) => {
            const ended = shown >= DONE;
            return (
              <div
                key={c.id}
                className={cn(
                  "relative flex min-h-[460px] flex-col overflow-hidden rounded-[24px] p-6 transition-[background-color,box-shadow] duration-700 md:p-7",
                  c.good
                    ? ended
                      ? "bg-white shadow-[0_0_0_1.5px_rgb(85_26_137/0.4),0_30px_60px_-40px_rgb(85_26_137/0.5)]"
                      : "bg-pp-card"
                    : "bg-pp-card",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Orb
                      mesh={c.good ? KB_MESH : MUTED_MESH}
                      speaking={!reduce && shown === 2}
                      className="size-9"
                    />
                    <div>
                      <p className="text-[15px] leading-5">{c.label}</p>
                      <p className="text-[12px] leading-4 text-pp-muted">{TWO_CALLS.sample}</p>
                    </div>
                  </div>
                </div>

                <ol aria-live="polite" className="mt-7 flex flex-col gap-3">
                  {c.turns.map((turn, i) =>
                    shown > i ? <Line key={i} turn={turn} live={!reduce && shown === i + 1} /> : null,
                  )}
                </ol>

                <div
                  className={cn(
                    "mt-auto flex items-center gap-2.5 pt-6 transition-[opacity,translate] duration-700",
                    ended ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
                  )}
                  aria-hidden={!ended}
                >
                  <span className="relative grid size-2.5 place-items-center">
                    {!c.good && ended && !reduce && (
                      <span className="absolute inset-0 animate-ping rounded-full bg-[#e0663a]/50" />
                    )}
                    <span className={cn("relative size-2.5 rounded-full", c.good ? "bg-[#1f8a55]" : "bg-[#e0663a]")} />
                  </span>
                  <p className="text-[14px] leading-5">{c.outcome}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex flex-col items-start justify-between gap-4 px-2 sm:flex-row sm:items-center">
          <p className="font-[family-name:var(--font-pp-cinema)] text-[22px] leading-[1.25] italic md:text-[26px]">
            {TWO_CALLS.note}
          </p>
          {!reduce && (
            <button
              type="button"
              onClick={() => {
                setStarted(true);
                setStep(0);
              }}
              className="pp-shadow-btn inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-white px-3.5 text-sm text-pp-ink transition-colors hover:bg-pp-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink"
            >
              <RotateCcw className="size-3.5" />
              {TWO_CALLS.replay}
            </button>
          )}
        </div>
      </Frame>
    </>
  );
}

function Line({ turn, live }: { turn: TwoCallsTurn; live: boolean }) {
  const client = turn.sp === "client";
  return (
    <li
      className={cn(
        "flex max-w-[90%] flex-col gap-1 animate-in fade-in-0 slide-in-from-bottom-2 duration-500",
        client ? "self-end items-end" : "self-start items-start",
      )}
    >
      <span className="text-[11px] leading-4 text-pp-muted">{TWO_CALLS.labels[turn.sp]}</span>
      <span
        className={cn(
          "rounded-[16px] px-3.5 py-2.5 text-[15px] leading-[22px]",
          client ? "bg-pp-ink text-white" : "bg-white text-pp-ink shadow-[0_0_0_1px_rgb(24_16_40/0.08)]",
        )}
      >
        {live
          ? turn.t.split(" ").map((w, i) => (
              <span
                key={i}
                className="animate-in fade-in-0 fill-mode-both duration-300"
                style={{ animationDelay: `${i * 60}ms` } as CSSProperties}
              >
                {w}{" "}
              </span>
            ))
          : turn.t}
      </span>
    </li>
  );
}
