"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Clock, Hash, Play, Star, Webhook } from "lucide-react";
import { INT_RUNS } from "@/lib/pages/integrations";
import { cn } from "@/lib/utils";
import { Frame, SectionHeading } from "../primitives";
import { useInView, usePrefersReducedMotion } from "../timing";

/* ------------------------------------------------------------------ *
 * Knowing a rule still works.
 *
 * A workflow card as the dashboard shows it — trigger, steps, and the
 * three numbers it keeps: runs, last run, success rate. While it is on
 * screen, calls keep coming: each run ticks the counter and plays its two
 * steps beside the card. One run in six, the webhook's endpoint answers
 * 500 — the step fails, the Slack step after it is skipped, and the
 * success rate drops by exactly as much as it should.
 * ------------------------------------------------------------------ */

/** Which runs fail, in a repeating round of six. */
const ROUND = [true, true, true, false, true, true];

type StepState = "idle" | "ok" | "failed" | "skipped" | "running";

export function IntRuns() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, "-15% 0px");
  const reduce = usePrefersReducedMotion();
  const c = INT_RUNS.card;

  const [runs, setRuns] = useState(41);
  const [ok, setOk] = useState(41);
  const [phase, setPhase] = useState(0);
  const [steps, setSteps] = useState<[StepState, StepState]>(["ok", "ok"]);
  const [fresh, setFresh] = useState(false);

  // One run every ~2.4s: webhook, then Slack (or not).
  useEffect(() => {
    if (!inView || reduce) return;
    const success = ROUND[phase % ROUND.length];
    const timers: number[] = [];
    timers.push(
      window.setTimeout(() => {
        setSteps(["running", "idle"]);
        setFresh(false);
      }, 300),
    );
    timers.push(
      window.setTimeout(() => {
        setSteps(success ? ["ok", "running"] : ["failed", "skipped"]);
      }, 1000),
    );
    timers.push(
      window.setTimeout(() => {
        if (success) setSteps(["ok", "ok"]);
        setRuns((r) => r + 1);
        if (success) setOk((o) => o + 1);
        setFresh(true);
      }, success ? 1700 : 1100),
    );
    timers.push(window.setTimeout(() => setPhase((p) => p + 1), success ? 2400 : 3400));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [inView, reduce, phase]);

  const rate = Math.round((ok / runs) * 100);

  return (
    <Frame className="grid gap-10 px-6 md:px-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)] lg:items-center lg:gap-16">
      <div>
        <SectionHeading eyebrow={INT_RUNS.eyebrow} className="max-w-[520px]">
          {INT_RUNS.title}
        </SectionHeading>
        <p className="mt-6 max-w-[500px] text-[16px] leading-[25px] text-pp-ink/80">{INT_RUNS.body}</p>
      </div>

      <div ref={ref} className="rounded-[28px] bg-pp-card p-4 md:p-6">
        {/* The card, as the dashboard draws it */}
        <div className="rounded-2xl bg-white p-5 shadow-[0_0_0_1px_rgb(24_16_40/0.06),0_18px_40px_-30px_rgb(24_16_40/0.45)]">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[15px] leading-5">{c.name}</p>
            <span aria-hidden className="relative h-5 w-9 rounded-full bg-[#551a89]">
              <span className="absolute top-0.5 right-0.5 size-4 rounded-full bg-white" />
            </span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[12px] leading-4">
            <span className="flex items-center gap-1 rounded-full border border-pp-hair px-2.5 py-1">
              <Star className="size-3 text-[#551a89]" />
              {c.trigger}
            </span>
            <ArrowRight className="size-3 text-pp-muted" />
            <span className="flex items-center gap-1 rounded-full bg-pp-card px-2.5 py-1">
              <Webhook className="size-3" />
              {c.actions[0]}
            </span>
            <span className="flex items-center gap-1 rounded-full bg-pp-card px-2.5 py-1">
              <Hash className="size-3" />
              {c.actions[1]}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-pp-rule pt-3 text-[12px] leading-4 whitespace-nowrap text-pp-muted">
            <span className="flex items-center gap-1 tabular-nums">
              <Play className="size-3" />
              <span key={runs} className={cn(!reduce && "animate-in fade-in-0 slide-in-from-bottom-1 duration-300")}>
                {runs}
              </span>{" "}
              {c.runs}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="size-3" /> {fresh || reduce ? c.justNow : c.earlier}
            </span>
            <span
              className={cn(
                "ml-auto rounded-full px-2 py-0.5 tabular-nums transition-colors duration-500",
                rate === 100 ? "bg-[#e6f4ea] text-[#1f6b3f]" : "bg-[#fdf1e6] text-[#9a4a14]",
              )}
            >
              {rate}% {c.success}
            </span>
          </div>
        </div>

        {/* The run in progress */}
        <ol className="mt-4 grid gap-2 sm:grid-cols-2" aria-hidden>
          <Step icon={<Webhook className="size-4" />} label={c.actions[0]} state={steps[0]} />
          <Step icon={<Hash className="size-4" />} label={c.actions[1]} state={steps[1]} />
        </ol>
      </div>
    </Frame>
  );
}

function Step({ icon, label, state }: { icon: React.ReactNode; label: string; state: StepState }) {
  const s = INT_RUNS.steps;
  const text =
    state === "ok"
      ? label === INT_RUNS.card.actions[0]
        ? s.ok
        : s.posted
      : state === "failed"
        ? s.failed
        : state === "skipped"
          ? s.skipped
          : state === "running"
            ? "…"
            : "";
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] leading-[18px] transition-[background-color,opacity] duration-300",
        state === "failed" ? "bg-[#fdecea]" : "bg-white",
        state === "skipped" || state === "idle" ? "opacity-55" : "opacity-100",
      )}
    >
      <span className={cn("shrink-0", state === "failed" ? "text-[#b3261e]" : "text-[#551a89]")}>{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span
        className={cn(
          "shrink-0 font-mono text-[11px]",
          state === "ok" && "text-[#1f6b3f]",
          state === "failed" && "text-[#b3261e]",
          (state === "skipped" || state === "running" || state === "idle") && "text-pp-muted",
        )}
      >
        {text}
      </span>
    </li>
  );
}
