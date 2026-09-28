"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { gsap } from "gsap";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import { CALLS } from "@/lib/pages/ai-agents";
import { cn } from "@/lib/utils";
import { useKitContext, useMotionKit } from "../motion-kit";
import { Frame, Orb, PillLink, SectionHeading } from "../primitives";
import { paletteByLuma, SCENE_GRADIENTS } from "./neat-backdrop";
import { useInView, usePrefersReducedMotion } from "../timing";

/* ------------------------------------------------------------------ *
 * The calls, played back — set like the dialogue cards of a trailer: one
 * line at a time, centred, in a cinema serif, each word easing up out of a
 * light blur as it is spoken.
 *
 * A single GSAP timeline per call drives everything that moves — the
 * words, the speaker card, the orb's breathing, the scrubber and the
 * chapter line under the call's title — so pause, resume and the end of
 * the call are one state and nothing can drift out of step with it.
 * ------------------------------------------------------------------ */

/** Seconds per spoken word, and the rest after a line lands. */
const WORD = 0.23;
const REST = 1.05;
const OUTCOME_HOLD = 2.8;

/** Each call borrows one of the hero reel's palettes, so its orb matches a panel above. */
const CALL_PALETTE: Record<string, string> = {
  trades: "booking",
  restaurants: "qualify",
  law: "support",
};

function paletteFor(id: string) {
  const g = SCENE_GRADIENTS[CALL_PALETTE[id]];
  return g ? paletteByLuma(g) : ["#2E1E12", "#573921", "#77593F", "#A08060", "#CDAE89"];
}

export function AgentsCalls() {
  const calls = CALLS.items;
  const stageRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const chapterRef = useRef<HTMLSpanElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  const inView = useInView(stageRef, "-10% 0px");
  const near = useInView(stageRef, "25% 0px");
  const reduce = usePrefersReducedMotion();
  const kit = useMotionKit(near);

  const [index, setIndex] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const [announce, setAnnounce] = useState("");

  const call = calls[index];
  const palette = paletteFor(call.id);

  useKitContext(
    kit,
    ({ gsap, SplitText }) => {
      const q = gsap.utils.selector(stageRef);
      const lines = q(".cine-line");
      const outcome = q(".cine-outcome")[0];
      const speakers = q(".cine-speaker");
      const orb = q(".cine-orb");

      gsap.set([...lines, outcome], { autoAlpha: 0 });
      gsap.set(speakers, { autoAlpha: 0 });

      if (reduce) {
        // Nothing moves: the call simply reads as finished.
        gsap.set(outcome, { autoAlpha: 1 });
        gsap.set(q(".cine-speaker-outcome"), { autoAlpha: 1 });
        return;
      }

      // The stage is hidden from assistive tech (the live region reads the
      // call), so the split adds no labels of its own.
      const splits = lines.map((l) => SplitText.create(l, { type: "words", aria: "none" }));
      const outcomeSplit = SplitText.create(outcome, { type: "words", aria: "none" });
      // Each word on its own compositor layer, so the fade, the rise and the
      // light blur are GPU work rather than a repaint of the line per frame.
      gsap.set([...splits.flatMap((sp) => sp.words), ...outcomeSplit.words], {
        willChange: "transform, opacity, filter",
        force3D: true,
      });

      const setBar = gsap.quickSetter(barRef.current, "scaleX");
      const setChapter = gsap.quickSetter(chapterRef.current, "scaleX");

      const tl = gsap.timeline({
        paused: true,
        onUpdate: () => {
          setBar(tl.progress());
          setChapter(tl.progress());
        },
        onComplete: () => setFinished(true),
      });

      const showSpeaker = (sel: string, at: number) => {
        // Out, then in: two labels crossing in the same spot read as neither.
        tl.to(speakers, { autoAlpha: 0, duration: 0.22, ease: "power1.in" }, at - 0.1).to(
          q(sel),
          { autoAlpha: 1, duration: 0.4, ease: "power2.out" },
          at + 0.14,
        );
      };

      let t = 0.45;
      call.turns.forEach((turn, i) => {
        const words = splits[i].words;
        const speak = words.length * WORD;
        const end = t + speak + REST;

        tl.call(() => setAnnounce(`${CALLS.labels[turn.sp]}: ${turn.t}`), [], t);
        showSpeaker(turn.sp === "agent" ? ".cine-speaker-agent" : ".cine-speaker-client", t - 0.15);

        tl.set(lines[i], { autoAlpha: 1, yPercent: 0, filter: "blur(0px)" }, t).fromTo(
          words,
          { autoAlpha: 0, yPercent: 16, filter: "blur(3px)" },
          {
            autoAlpha: 1,
            yPercent: 0,
            filter: "blur(0px)",
            duration: 0.9,
            ease: "power2.out",
            stagger: WORD,
          },
          t,
        );

        if (turn.sp === "agent") {
          // The orb breathes for as long as the agent is speaking.
          const beats = Math.max(1, Math.round(speak / 0.7));
          tl.to(
            orb,
            { scale: 1.06, duration: 0.35, ease: "sine.inOut", yoyo: true, repeat: beats * 2 - 1 },
            t,
          );
        }

        tl.to(
          lines[i],
          { autoAlpha: 0, yPercent: -10, filter: "blur(3px)", duration: 0.6, ease: "power2.inOut" },
          end - 0.55,
        );
        t = end;
      });

      tl.call(() => setAnnounce(`${CALLS.labels.outcome}: ${call.outcome}`), [], t);
      showSpeaker(".cine-speaker-outcome", t - 0.15);
      tl.set(outcome, { autoAlpha: 1 }, t)
        .fromTo(
          outcomeSplit.words,
          { autoAlpha: 0, yPercent: 16, filter: "blur(3px)" },
          { autoAlpha: 1, yPercent: 0, filter: "blur(0px)", duration: 1, ease: "power2.out", stagger: 0.06 },
          t,
        )
        .fromTo(
          q(".cine-check"),
          { scale: 0, autoAlpha: 0 },
          { scale: 1, autoAlpha: 1, duration: 0.6, ease: "back.out(2.2)" },
          t + 0.1,
        )
        .to({}, { duration: OUTCOME_HOLD });

      tlRef.current = tl;
      return () => {
        tlRef.current = null;
      };
    },
    { scope: stageRef, dependencies: [call.id, reduce], revertOnUpdate: true },
  );

  // A call that has finished hands over to the next until somebody takes control.
  useEffect(() => {
    if (!finished || !autoplay || !inView) return;
    const id = window.setTimeout(() => {
      setFinished(false);
      setIndex((i) => (i + 1) % calls.length);
    }, 500);
    return () => window.clearTimeout(id);
  }, [finished, autoplay, inView, calls.length]);

  // Plays while on screen and not paused by hand.
  useEffect(() => {
    const tl = tlRef.current;
    if (!tl) return;
    if (inView && !paused && !finished) tl.play();
    else tl.pause();
  }, [inView, paused, finished, call.id, reduce, kit]);

  const go = (i: number) => {
    setAutoplay(false);
    setPaused(false);
    setFinished(false);
    // The same call keeps its timeline, so picking it again starts it over.
    if (i === index) tlRef.current?.restart();
    setIndex(i);
  };

  const toggle = () => {
    const tl = tlRef.current;
    if (finished) {
      setFinished(false);
      setPaused(false);
      tl?.restart();
      return;
    }
    setAutoplay(false);
    setPaused((p) => !p);
  };

  const orbGlow = {
    "--glow-hi": palette[4],
    "--glow-mid": palette[2],
  } as CSSProperties;

  return (
    <>
      <Frame className="flex flex-col gap-5 px-6 pb-10 md:flex-row md:items-end md:justify-between md:px-12 md:pb-12">
        <SectionHeading eyebrow={CALLS.eyebrow} className="max-w-[600px]">
          {CALLS.title}
        </SectionHeading>
        <PillLink href={CALLS.cta.href} variant="secondary" size="sm" className="self-start md:self-auto">
          {CALLS.cta.label}
        </PillLink>
      </Frame>

      <Frame className="px-4 pb-10 md:px-6 md:pb-16">
        <div
          ref={stageRef}
          style={orbGlow}
          className="relative flex min-h-[560px] flex-col overflow-hidden rounded-[24px] bg-pp-card text-pp-ink md:min-h-[600px] xl:min-h-[640px]"
        >
          {/* A soft light from the call's own palette, behind the orb. */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div
              key={call.id}
              className="absolute inset-0 animate-in fade-in-0 duration-1000"
              style={{
                background:
                  "radial-gradient(42% 46% at 50% 44%, color-mix(in oklab, var(--glow-hi) 38%, transparent), transparent 72%), radial-gradient(70% 55% at 50% 110%, color-mix(in oklab, var(--glow-mid) 16%, transparent), transparent 70%)",
              }}
            />
            <div className="pp-grain absolute inset-0 opacity-[0.18]" />
          </div>

          <div className="relative flex items-start justify-between gap-4 p-5 md:p-7">
            <div key={call.id} className="min-w-0 animate-in fade-in-0 duration-700">
              <p className="text-[11px] leading-4 font-medium tracking-[0.18em] text-pp-muted uppercase">
                {CALLS.kicker} · {call.trade}
              </p>
              <p className="mt-1 text-[15px] leading-[22px]">{call.headline}</p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <RoundButton label={CALLS.labels.prev} onClick={() => go((index - 1 + calls.length) % calls.length)}>
                <ChevronLeft className="size-4" />
              </RoundButton>
              <RoundButton label={CALLS.labels.next} onClick={() => go((index + 1) % calls.length)}>
                <ChevronRight className="size-4" />
              </RoundButton>
            </div>
          </div>

          <div className="relative flex flex-1 flex-col items-center justify-center px-6 text-center md:px-16">
            <div className="cine-orb mb-6 md:mb-8">
              <Orb key={call.id} mesh={palette} className="size-16 animate-in fade-in-0 zoom-in-90 duration-700 md:size-24" />
            </div>

            <div aria-hidden className="relative mb-4 h-4 w-40">
              {(["client", "agent", "outcome"] as const).map((sp) => (
                <p
                  key={sp}
                  className={`cine-speaker cine-speaker-${sp} invisible absolute inset-0 text-[11px] leading-4 font-medium tracking-[0.22em] text-pp-muted uppercase`}
                >
                  {CALLS.labels[sp]}
                </p>
              ))}
            </div>

            <div aria-hidden className="relative grid w-full max-w-[920px] place-items-center">
              {call.turns.map((turn, i) => (
                <p
                  key={`${call.id}-${i}`}
                  className="cine-line invisible col-start-1 row-start-1 font-[family-name:var(--font-pp-cinema)] text-[26px] leading-[1.18] font-medium text-balance md:text-[38px] lg:text-[44px]"
                >
                  {turn.t}
                </p>
              ))}
              <p
                key={`${call.id}-outcome`}
                className="cine-outcome invisible col-start-1 row-start-1 flex items-center justify-center gap-3 font-[family-name:var(--font-pp-cinema)] text-[26px] leading-[1.18] font-medium italic md:text-[38px] lg:text-[44px]"
              >
                <span className="cine-check inline-block size-2.5 shrink-0 rounded-full bg-[#1f8a55] md:size-3" />
                <span>{call.outcome}</span>
              </p>
            </div>

            <p className="sr-only" aria-live="polite">
              {announce}
            </p>
          </div>

          <div className="relative flex items-center gap-4 p-5 md:p-7">
            <RoundButton
              label={finished ? CALLS.labels.replay : paused ? CALLS.labels.play : CALLS.labels.pause}
              onClick={toggle}
            >
              {finished ? (
                <RotateCcw className="size-4" />
              ) : paused ? (
                <Play className="size-4 fill-current" />
              ) : (
                <Pause className="size-4 fill-current" />
              )}
            </RoundButton>
            <div className="relative mx-auto h-[2px] w-full max-w-[520px] overflow-hidden rounded-full bg-pp-ink/10">
              {/* Transform set inline, not with a scale utility: GSAP writes
                  `transform`, and Tailwind's scale classes use the separate
                  `scale` property, which would multiply it back to zero. */}
              <span
                ref={barRef}
                className="absolute inset-0 origin-left bg-pp-ink"
                style={{ transform: `scaleX(${reduce ? 1 : 0})` }}
              />
            </div>
            <PillLink href={CALLS.build.href} size="sm" className="hidden sm:inline-flex">
              {CALLS.build.label}
            </PillLink>
          </div>
        </div>

        <div className="mt-6 grid gap-2 md:grid-cols-3 md:gap-6">
          {calls.map((c, i) => {
            const on = i === index;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => go(i)}
                aria-pressed={on}
                className={cn(
                  "group relative rounded-2xl p-4 text-left transition-colors duration-500 md:p-5",
                  on ? "text-pp-ink" : "text-pp-muted hover:text-pp-ink",
                )}
              >
                <span className="block font-[family-name:var(--font-pp-cinema)] text-[19px] leading-[1.3] font-medium">
                  {/* The caller's first words: the agent's greeting is the same on every call. */}
                  “{c.turns.find((t) => t.sp === "client")?.t}”
                </span>
                <span className="mt-4 block text-[14px] leading-5 font-medium">{c.outcome}</span>
                <span className="block text-[13px] leading-[18px] text-pp-muted">{c.trade}</span>
                <span aria-hidden className="absolute inset-x-4 bottom-0 h-px overflow-hidden bg-pp-ink/[0.06] md:inset-x-5">
                  {on && (
                    <span
                      ref={chapterRef}
                      className="absolute inset-0 origin-left bg-pp-ink/60"
                      style={{ transform: `scaleX(${reduce ? 1 : 0})` }}
                    />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </Frame>
    </>
  );
}

function RoundButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="pp-shadow-btn grid size-9 shrink-0 place-items-center rounded-full bg-white text-pp-ink transition-colors hover:bg-pp-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink"
    >
      {children}
    </button>
  );
}
