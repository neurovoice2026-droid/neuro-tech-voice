"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowRight, Check, Hash } from "lucide-react";
import { INT_BUILDER } from "@/lib/pages/integrations";
import { cn } from "@/lib/utils";
import { Frame, PillLink, SectionHeading } from "../primitives";
import { useInView, usePrefersReducedMotion } from "../timing";

/* ------------------------------------------------------------------ *
 * How little it takes, shown rather than claimed.
 *
 * The dashboard's New workflow dialog plays itself: a pointer taps
 * "Missed call", Next; ticks "Notify Slack" and pastes the link, Next;
 * types a name and creates it — and the finished workflow appears with
 * its switch on. Beside it, the same three steps in words.
 *
 * One list of timed phases drives the dialog and the pointer; the pointer
 * is placed over whichever control the phase names, measured in place, so
 * it lands on the real button at any width.
 * ------------------------------------------------------------------ */

type Target = "missed" | "next" | "slack" | "create" | null;

/** Each phase: which screen, what the pointer is over, whether it presses, how long it lasts. */
const PHASES: { screen: 1 | 2 | 3 | 4; target: Target; press?: boolean; ms: number }[] = [
  { screen: 1, target: null, ms: 900 },
  { screen: 1, target: "missed", ms: 850 },
  { screen: 1, target: "missed", press: true, ms: 500 },
  { screen: 1, target: "next", ms: 750 },
  { screen: 1, target: "next", press: true, ms: 350 },
  { screen: 2, target: "slack", ms: 850 },
  { screen: 2, target: "slack", press: true, ms: 1600 },
  { screen: 2, target: "next", ms: 750 },
  { screen: 2, target: "next", press: true, ms: 350 },
  { screen: 3, target: "create", ms: 1700 },
  { screen: 3, target: "create", press: true, ms: 400 },
  { screen: 4, target: null, ms: 3200 },
];

export function IntBuilder() {
  const b = INT_BUILDER;
  const m = b.mock;
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, "-15% 0px");
  const reduce = usePrefersReducedMotion();

  const [phase, setPhase] = useState(0);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [typed, setTyped] = useState(0);

  const p = PHASES[reduce ? PHASES.length - 1 : phase];
  const screen = p.screen;
  const pickedTrigger = phase >= 2 || reduce;
  const pickedSlack = phase >= 6 || reduce;

  useEffect(() => {
    if (!inView || reduce) return;
    const id = window.setTimeout(() => setPhase((n) => (n + 1) % PHASES.length), PHASES[phase].ms);
    return () => window.clearTimeout(id);
  }, [inView, reduce, phase]);

  // Typing: the link after Slack is ticked, the name on the last screen.
  const typingText = phase === 6 ? m.slackValue : phase === 9 ? m.nameValue : null;
  useEffect(() => {
    if (!typingText) return;
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      setTyped(n);
      if (n >= typingText.length) window.clearInterval(id);
    }, 900 / typingText.length);
    return () => {
      window.clearInterval(id);
      setTyped(0);
    };
  }, [typingText]);

  // The pointer goes to whatever the phase is about.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !p.target) return;
    const el = dialog.querySelector<HTMLElement>(`[data-target="${p.target}"]`);
    if (!el) return;
    const d = dialog.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setPointer({ x: r.left - d.left + r.width * 0.62, y: r.top - d.top + r.height * 0.6 });
  }, [p.target, screen]);

  const slackText = phase > 6 || reduce ? m.slackValue : phase === 6 ? m.slackValue.slice(0, typed) : "";
  const nameText = phase > 9 || reduce ? m.nameValue : phase === 9 ? m.nameValue.slice(0, typed) : "";

  return (
    <Frame className="grid gap-10 px-6 md:px-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] lg:items-center lg:gap-16">
      <div>
        <SectionHeading eyebrow={b.eyebrow} className="max-w-[520px]">
          {b.title}
        </SectionHeading>
        <p className="mt-6 max-w-[500px] text-[16px] leading-[25px] text-pp-ink/80">{b.body}</p>
        <ol className="mt-8 flex max-w-[500px] flex-col">
          {b.steps.map((s, i) => {
            const on = !reduce && screen === i + 1;
            return (
              <li key={s.id} className="flex gap-4 border-t border-pp-rule py-4 last:border-b">
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full text-[13px] tabular-nums transition-colors duration-300",
                    on ? "bg-pp-ink text-white" : "bg-pp-card text-pp-ink",
                  )}
                >
                  {i + 1}
                </span>
                <span>
                  <span className="block text-[15px] leading-[22px]">{s.title}</span>
                  <span className="block text-[15px] leading-[22px] text-pp-muted">{s.body}</span>
                </span>
              </li>
            );
          })}
        </ol>
        <PillLink href={b.cta.href} variant="secondary" size="sm" className="mt-8">
          {b.cta.label}
        </PillLink>
      </div>

      <div ref={rootRef} aria-hidden className="rounded-[28px] bg-pp-card p-3 sm:p-6">
        <div
          ref={dialogRef}
          className="relative overflow-hidden rounded-2xl bg-white p-5 shadow-[0_0_0_1px_rgb(24_16_40/0.06),0_24px_48px_-32px_rgb(24_16_40/0.5)] sm:p-6"
        >
          {/* Header and steps */}
          <p className="text-[16px] leading-6">{m.title}</p>
          <div className="mt-3 flex items-center gap-2 text-[12px] leading-4">
            {m.stepLabels.map((label, i) => {
              const n = i + 1;
              const done = screen > n;
              const current = screen === n;
              return (
                <span key={label} className="flex items-center gap-2">
                  <span
                    className={cn(
                      "grid size-5 place-items-center rounded-full text-[11px] transition-colors duration-300",
                      done ? "bg-[#1f8a55] text-white" : current ? "bg-[#551a89] text-white" : "bg-pp-card text-pp-muted",
                    )}
                  >
                    {done ? <Check className="size-3" strokeWidth={3} /> : n}
                  </span>
                  <span className={current ? "text-pp-ink" : "text-pp-muted"}>{label}</span>
                  {i < m.stepLabels.length - 1 && <span className="h-px w-4 bg-pp-hair sm:w-6" />}
                </span>
              );
            })}
          </div>

          <div className="relative mt-5 h-[252px]">
            {/* 1 · When */}
            <Screen on={screen === 1}>
              <p className="text-[12px] leading-4 text-pp-muted">{m.whenPrompt}</p>
              <div className="mt-3 grid gap-1.5">
                {m.triggers.map((t, i) => {
                  const selected = i === 1 && pickedTrigger;
                  return (
                    <div
                      key={t}
                      data-target={i === 1 ? "missed" : undefined}
                      className={cn(
                        "flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-[13px] leading-[18px] transition-colors duration-300",
                        selected ? "border-[#551a89] bg-[#551a89]/[0.06]" : "border-pp-hair",
                      )}
                    >
                      {t}
                      {selected && <Check className="size-3.5 text-[#551a89]" strokeWidth={2.5} />}
                    </div>
                  );
                })}
              </div>
            </Screen>

            {/* 2 · What */}
            <Screen on={screen === 2}>
              <p className="text-[12px] leading-4 text-pp-muted">{m.whatPrompt}</p>
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                {m.actions.map((a, i) => {
                  const selected = i === 0 && pickedSlack;
                  return (
                    <div
                      key={a}
                      data-target={i === 0 ? "slack" : undefined}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] leading-[18px] transition-colors duration-300",
                        selected ? "border-[#551a89] bg-[#551a89]/[0.06]" : "border-pp-hair",
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-4 shrink-0 place-items-center rounded border transition-colors duration-300",
                          selected ? "border-[#551a89] bg-[#551a89] text-white" : "border-pp-hair",
                        )}
                      >
                        {selected && <Check className="size-2.5" strokeWidth={3} />}
                      </span>
                      <span className="truncate">{a}</span>
                    </div>
                  );
                })}
              </div>
              <div
                className={cn(
                  "mt-4 transition-[opacity,translate] duration-300",
                  pickedSlack ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
                )}
              >
                <p className="flex items-center gap-1.5 text-[12px] leading-4">
                  <Hash className="size-3.5 text-[#551a89]" />
                  {m.slackField}
                </p>
                <p className="mt-1.5 h-9 truncate rounded-lg border border-pp-hair px-3 font-mono text-[12px] leading-[34px] text-pp-ink">
                  {slackText}
                  {phase === 6 && <Caret />}
                </p>
              </div>
            </Screen>

            {/* 3 · Name */}
            <Screen on={screen === 3}>
              <p className="text-[12px] leading-4 text-pp-muted">{m.namePrompt}</p>
              <p className="mt-2 h-10 truncate rounded-lg border border-pp-hair px-3 text-[14px] leading-[38px]">
                {nameText}
                {phase === 9 && <Caret />}
              </p>
              <div className="mt-4 rounded-xl bg-pp-card p-3.5 text-[12px] leading-4">
                <p className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-white px-2.5 py-1">{m.triggers[1]}</span>
                  <ArrowRight className="size-3 text-pp-muted" />
                  <span className="rounded-full bg-white px-2.5 py-1">{m.actions[0]}</span>
                </p>
              </div>
            </Screen>

            {/* Done */}
            <Screen on={screen === 4}>
              <p className="flex items-center gap-2 text-[13px] leading-[18px] text-[#1f6b3f]">
                <span className="grid size-5 place-items-center rounded-full bg-[#1f8a55] text-white">
                  <Check className="size-3" strokeWidth={3} />
                </span>
                {m.created}
              </p>
              <div className="mt-4 rounded-xl p-4 shadow-[0_0_0_1px_rgb(24_16_40/0.08),0_12px_28px_-20px_rgb(24_16_40/0.4)]">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-[14px] leading-5">{m.nameValue}</p>
                  <span className="flex shrink-0 items-center gap-2 text-[12px] leading-4 text-[#1f6b3f]">
                    {m.live}
                    <span className="relative h-5 w-9 rounded-full bg-[#551a89]">
                      <span className="absolute top-0.5 right-0.5 size-4 rounded-full bg-white" />
                    </span>
                  </span>
                </div>
                <p className="mt-3 flex flex-wrap items-center gap-1.5 text-[12px] leading-4">
                  <span className="rounded-full border border-pp-hair px-2.5 py-1">{m.triggers[1]}</span>
                  <ArrowRight className="size-3 text-pp-muted" />
                  <span className="rounded-full bg-pp-card px-2.5 py-1">{m.actions[0]}</span>
                </p>
              </div>
            </Screen>
          </div>

          {/* Footer */}
          <div className={cn("mt-5 flex justify-end transition-opacity duration-300", screen === 4 && "opacity-0")}>
            <span
              data-target={screen === 3 ? "create" : "next"}
              className={cn(
                "rounded-full px-4 py-2 text-[13px] leading-[18px] text-white transition-[background-color,scale] duration-150",
                p.press && (p.target === "next" || p.target === "create") ? "scale-95 bg-[#3d1266]" : "bg-[#551a89]",
              )}
            >
              {screen === 3 ? m.create : m.next}
            </span>
          </div>

          {/* The pointer */}
          {!reduce && pointer && screen !== 4 && (
            <span
              className="pointer-events-none absolute top-0 left-0 z-10 transition-transform duration-700 ease-[cubic-bezier(0.45,0,0.2,1)]"
              style={{ transform: `translate(${pointer.x}px, ${pointer.y}px)` }}
            >
              <span
                className={cn(
                  "absolute -top-3 -left-3 size-6 rounded-full bg-[#551a89]/25 transition-[scale,opacity] duration-300",
                  p.press ? "scale-100 opacity-100" : "scale-50 opacity-0",
                )}
              />
              <svg width="18" height="22" viewBox="0 0 18 22" className="relative drop-shadow-[0_2px_3px_rgb(0_0_0/0.25)]">
                <path d="M1.5 1.5v16.2l4.3-3.9 2.8 6.4 2.9-1.3-2.8-6.2h5.8z" fill="#000" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            </span>
          )}
        </div>
      </div>
    </Frame>
  );
}

function Screen({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "absolute inset-0 transition-[opacity,translate] duration-400",
        on ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-3 opacity-0",
      )}
    >
      {children}
    </div>
  );
}

function Caret() {
  return <span className="ml-px inline-block h-[1.1em] w-px translate-y-[0.2em] animate-pulse bg-pp-ink" />;
}
