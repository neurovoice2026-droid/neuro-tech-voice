"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { USE_CASES, type UseCaseAgent } from "@/lib/pages/ai-agents";
import { cn } from "@/lib/utils";
import { FluidOrb } from "../fluid-orb";
import { Frame, Orb, ORB_MESHES, PillLink, SectionHeading } from "../primitives";
import { useInView, usePrefersReducedMotion } from "../timing";

/* ------------------------------------------------------------------ *
 * Functions, not industries: the same agent working a front desk, a
 * diary, a sales line and a support queue.
 *
 * The stage is a console: on the left the agent itself — its function, a
 * live sphere and the agents under that function; on the right the call
 * as a running transcript, one line after another with who said it and
 * when, over a transport bar with play, sound, progress and a meter.
 *
 * One clock drives it — the recording's, when the agent has one, so the
 * words stay on the voice — and the sphere and the meter move with
 * whoever is talking, or with the real signal once the sound is on.
 * ------------------------------------------------------------------ */

const TAB_MESHES = [ORB_MESHES.lagoon, ORB_MESHES.citrus, ORB_MESHES.sunset, ORB_MESHES.violet];

/** Agents whose orb carries its own palette instead of its tab's. */
const AGENT_MESHES: Partial<Record<string, readonly string[]>> = {
  quotes: ORB_MESHES.citrus,
  demo: ORB_MESHES.violet,
};

/** Pacing when a conversation has no recorded timings. */
const WORD_S = 0.3;
const TURN_GAP = 0.8;
const LEAD_IN = 0.7;
const HOLD_END = 2.4;
/** How many past lines each side keeps before they scroll away. */
const KEEP = 4;

type Planned = { sp: "agent" | "client"; words: string[]; start: number; end: number };

function plan(agent: UseCaseAgent) {
  let t = LEAD_IN;
  const turns: Planned[] = agent.turns.map((turn, i) => {
    const words = turn.t.split(" ");
    const start = agent.timings?.[i] ?? t;
    const next = agent.timings?.[i + 1];
    const end = next !== undefined ? Math.max(start + 0.4, next - 0.3) : start + words.length * WORD_S;
    t = end + TURN_GAP;
    return { sp: turn.sp, words, start, end };
  });
  const speech = turns[turns.length - 1].end;
  return { turns, speech, length: speech + HOLD_END };
}

function revealAt(turns: Planned[], t: number) {
  return turns.map((p) => {
    if (t < p.start) return 0;
    const per = Math.max(0.05, (p.end - p.start) / p.words.length);
    return Math.min(p.words.length, Math.floor((t - p.start) / per) + 1);
  });
}

function clockText(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

type AudioGraph = { ctx: AudioContext; analyser: AnalyserNode; data: Uint8Array<ArrayBuffer> };

export function AgentsUseCases() {
  const tabs = USE_CASES.tabs;
  const stageRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const inView = useInView(stageRef, "-15% 0px");
  const reduce = usePrefersReducedMotion();

  const [tab, setTab] = useState(0);
  const [agent, setAgent] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);

  const t = tabs[tab];
  const a: UseCaseAgent = t.agents[agent];
  const mesh = TAB_MESHES[tab % TAB_MESHES.length];
  const stageMesh = AGENT_MESHES[a.id] ?? mesh;
  const conversation = useMemo(() => plan(a), [a]);
  const running = inView && !reduce && !paused;

  // Words shown per turn, tagged with the conversation they belong to so a
  // switch never paints one frame of the old progress over the new lines.
  const convKey = `${t.id}-${a.id}`;
  const [reveal, setReveal] = useState<{ key: string; counts: number[] }>({ key: "", counts: [] });
  const shown = reduce
    ? conversation.turns.map((p) => p.words.length)
    : reveal.key === convKey
      ? reveal.counts
      : conversation.turns.map(() => 0);

  // Shared with the render loop and the sphere without re-rendering.
  const clock = useRef(0);
  const volume = useRef(0);
  const mutedRef = useRef(true);
  const autoplayRef = useRef(autoplay);
  const audioGraph = useRef<AudioGraph | null>(null);
  // The transport bar is written straight to the DOM every frame.
  const progressRef = useRef<HTMLSpanElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const meterRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    autoplayRef.current = autoplay;
  }, [autoplay]);

  // The clock: the recording's when there is one, otherwise our own. A new
  // conversation starts it from the top.
  useEffect(() => {
    const audio = audioRef.current;
    const recorded = !!(audio && a.audio);
    let raf = 0;
    let prev = performance.now();
    let lastKey = "";
    /** Seconds since the recording ended, for the hold before moving on. */
    let afterEnd = 0;

    const advance = () => {
      if (!autoplayRef.current) {
        // Picked by hand: stay on it and play it again.
        clock.current = 0;
        afterEnd = 0;
        if (recorded) {
          audio!.currentTime = 0;
          void audio!.play().catch(() => {});
        }
        return false;
      }
      if (agent + 1 < t.agents.length) setAgent(agent + 1);
      else {
        setAgent(0);
        setTab((tab + 1) % tabs.length);
      }
      return true;
    };

    const tick = (now: number) => {
      const dt = Math.min((now - prev) / 1000, 0.1);
      prev = now;

      let time: number;
      if (recorded && audio!.ended) {
        // The recording stops its own clock at the end; the hold runs on ours.
        afterEnd += dt;
        time = (audio!.duration || 0) + afterEnd;
      } else if (recorded && !audio!.paused) {
        afterEnd = 0;
        time = audio!.currentTime;
        clock.current = time;
      } else {
        // No recording — or the browser would not start it: keep moving.
        clock.current += dt;
        time = clock.current;
      }

      const next = revealAt(conversation.turns, time);
      const key = next.join(",");
      if (key !== lastKey) {
        lastKey = key;
        setReveal({ key: convKey, counts: next });
      }

      // What moves the sphere: the real signal when it is audible, the
      // shape of the conversation when it is not.
      const graph = audioGraph.current;
      if (recorded && graph && !mutedRef.current) {
        graph.analyser.getByteTimeDomainData(graph.data);
        let sum = 0;
        for (let i = 0; i < graph.data.length; i++) {
          const v = (graph.data[i] - 128) / 128;
          sum += v * v;
        }
        volume.current = Math.min(1, Math.sqrt(sum / graph.data.length) * 4.2);
      } else {
        const speaking = conversation.turns.find((p) => time >= p.start && time <= p.end);
        volume.current = !speaking
          ? 0
          : speaking.sp === "agent"
            ? 0.5 + 0.32 * Math.sin(time * 8.3) * Math.sin(time * 2.9)
            : 0.16 + 0.08 * Math.sin(time * 6.1);
      }

      const length = recorded
        ? Math.max(conversation.length, (audio!.duration || 0) + 0.8)
        : conversation.length;
      const spoken = recorded && audio!.duration ? audio!.duration : conversation.speech;
      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${Math.min(1, time / spoken)})`;
      }
      if (timeRef.current) {
        timeRef.current.textContent = `${clockText(Math.min(time, spoken))} / ${clockText(spoken)}`;
      }
      const bars = meterRef.current?.children;
      if (bars) {
        for (let i = 0; i < bars.length; i++) {
          const wobble = 0.55 + 0.45 * Math.sin(time * (7 + i * 1.7) + i * 2.1);
          const h = 0.18 + 0.82 * volume.current * wobble;
          (bars[i] as HTMLElement).style.transform = `scaleY(${h.toFixed(3)})`;
        }
      }
      if (time >= length && advance()) return;
      raf = requestAnimationFrame(tick);
    };

    if (!running) {
      audio?.pause();
      volume.current = 0;
      return;
    }
    if (recorded) void audio!.play().catch(() => {});
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, conversation, convKey, a.audio, agent, t.agents.length, tab, tabs.length]);

  // Reset on a new conversation, apart from the running loop above so that
  // scrolling away and back does not rewind it.
  const lastConversation = useRef(conversation);
  useEffect(() => {
    if (lastConversation.current === conversation) return;
    lastConversation.current = conversation;
    clock.current = 0;
    const audio = audioRef.current;
    if (audio && a.audio) audio.currentTime = 0;
  }, [conversation, a.audio]);

  const toggleSound = () => {
    const audio = audioRef.current;
    if (!audio || !a.audio) return;
    // The graph is built on the first click, inside the gesture the
    // browser needs before it will let a page make sound.
    if (!audioGraph.current) {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaElementSource(audio).connect(analyser);
      analyser.connect(ctx.destination);
      audioGraph.current = { ctx, analyser, data: new Uint8Array(new ArrayBuffer(analyser.fftSize)) };
    }
    void audioGraph.current.ctx.resume();
    const next = !muted;
    audio.muted = next;
    mutedRef.current = next;
    setMuted(next);
    if (!next && audio.paused && running) void audio.play().catch(() => {});
  };

  const pickTab = (i: number) => {
    setAutoplay(false);
    setTab(i);
    setAgent(0);
  };
  const pickAgent = (i: number) => {
    setAutoplay(false);
    setAgent(i);
  };

  const lines: Line[] = conversation.turns.map((p, i) => ({
    key: `${t.id}-${a.id}-${i}`,
    sp: p.sp,
    at: clockText(p.start),
    text: p.words.slice(0, shown[i] ?? 0).join(" "),
  }));
  const said = lines.filter((l) => l.text);
  const last = said[said.length - 1];
  const sound = USE_CASES.sound;
  const player = USE_CASES.player;

  return (
    <>
      <Frame className="px-6 pb-8 md:px-12">
        <SectionHeading eyebrow={USE_CASES.eyebrow} className="max-w-[600px]">
          {USE_CASES.title}
        </SectionHeading>
        <div
          role="tablist"
          aria-label={USE_CASES.title}
          className="mt-8 flex w-fit max-w-full gap-1 overflow-x-auto rounded-full p-1 shadow-[0_0_0_1px_rgb(0_0_0/0.06)] [scrollbar-width:none]"
        >
          {tabs.map((x, i) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              id={`uc-tab-${x.id}`}
              aria-selected={i === tab}
              aria-controls="uc-stage"
              onClick={() => pickTab(i)}
              className={cn(
                "h-8 shrink-0 rounded-full px-3.5 text-sm transition-colors duration-200",
                i === tab ? "pp-shadow-btn bg-white text-pp-ink" : "text-pp-muted hover:text-pp-ink",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
      </Frame>

      <Frame className="px-4 pb-4">
        <div
          ref={stageRef}
          id="uc-stage"
          role="tabpanel"
          aria-labelledby={`uc-tab-${t.id}`}
          className="grid grid-cols-[minmax(0,1fr)] overflow-hidden rounded-[24px] bg-pp-card lg:h-[600px] lg:grid-cols-[340px_minmax(0,1fr)]"
        >
          <audio ref={audioRef} src={a.audio} muted playsInline preload="auto" />

          {/* The agent: its function, the sphere, and the agents under it. */}
          <div className="flex flex-col p-5 md:p-6 lg:border-r lg:border-pp-rule">
            <div>
              <p className="text-[15px] leading-[22px]">{t.label}</p>
              <p className="text-[13px] leading-[18px] text-pp-muted">{t.summary}</p>
            </div>

            <div className="my-8 flex justify-center lg:my-auto">
              <FluidOrb
                colors={stageMesh}
                volume={volume}
                running={running}
                still={reduce}
                className="size-[180px] md:size-[212px]"
              />
            </div>

            <div className="flex flex-col gap-1">
              {t.agents.map((x, i) => {
                const on = i === agent;
                return (
                  <button
                    key={x.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => pickAgent(i)}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors duration-200",
                      on ? "bg-white shadow-[0_0_0_1px_rgb(24_16_40/0.06)]" : "hover:bg-white/50",
                    )}
                  >
                    <Orb
                      mesh={AGENT_MESHES[x.id] ?? mesh}
                      className={cn("size-7 shrink-0 transition-opacity", on ? "opacity-100" : "opacity-45")}
                    />
                    <span className="min-w-0">
                      <span className={cn("block text-[14px] leading-5", on ? "text-pp-ink" : "text-pp-muted")}>
                        {x.name}
                      </span>
                      <span className="block truncate text-[12px] leading-4 text-pp-muted">{x.job}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* The call: a running transcript over the transport. */}
          <div className="flex min-h-[460px] flex-col bg-white/55 lg:min-h-0">
            <div className="flex items-center justify-between gap-4 border-b border-pp-rule px-5 py-4 md:px-6">
              <div className="min-w-0">
                <p className="text-[11px] leading-4 font-medium tracking-[0.14em] text-pp-muted uppercase">
                  {player.transcript}
                </p>
                <p className="truncate text-[15px] leading-[22px]">
                  {a.name} <span className="text-pp-muted">· {a.job}</span>
                </p>
              </div>
              <PillLink href={USE_CASES.cta.href} variant="secondary" size="sm">
                {USE_CASES.cta.label}
              </PillLink>
            </div>

            <Transcript lines={said} labels={player} className="flex-1" />

            <div className="flex items-center gap-2.5 border-t border-pp-rule px-4 py-3 md:gap-3 md:px-6">
              <button
                type="button"
                onClick={() => {
                  setAutoplay(false);
                  setPaused((p) => !p);
                }}
                aria-label={paused ? player.play : player.pause}
                className="grid size-9 shrink-0 place-items-center rounded-full bg-pp-ink text-white transition-transform duration-200 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink"
              >
                {paused ? <Play className="size-4 fill-current" /> : <Pause className="size-4 fill-current" />}
              </button>

              <button
                type="button"
                onClick={toggleSound}
                aria-disabled={!a.audio}
                aria-pressed={!muted}
                // The spoken name starts with the word on the button.
                aria-label={`${muted ? sound.unmute : sound.mute}${a.audio ? "" : ` (${sound.unavailable})`}`}
                title={!a.audio ? sound.unavailable : undefined}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-2 rounded-full px-3 text-[13px] shadow-[0_0_0_1px_rgb(24_16_40/0.1)] transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink",
                  a.audio ? "bg-white hover:bg-pp-card" : "cursor-default bg-white/60 text-pp-muted",
                )}
              >
                {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                <span className="hidden sm:inline">{muted ? sound.unmute : sound.mute}</span>
              </button>

              <span aria-hidden className="relative h-[3px] min-w-0 flex-1 overflow-hidden rounded-full bg-pp-ink/10">
                <span
                  ref={progressRef}
                  className="absolute inset-0 origin-left rounded-full bg-pp-accent"
                  style={{ transform: "scaleX(0)" }}
                />
              </span>

              <span ref={timeRef} className="shrink-0 text-[12px] text-pp-muted tabular-nums">
                0:00 / {clockText(conversation.speech)}
              </span>

              <span ref={meterRef} aria-hidden className="hidden h-5 shrink-0 items-center gap-[3px] sm:flex">
                {Array.from({ length: 12 }, (_, i) => (
                  <span
                    key={i}
                    className="h-full w-[3px] origin-center rounded-full bg-pp-accent/70"
                    style={{ transform: "scaleY(0.18)" }}
                  />
                ))}
              </span>
            </div>
          </div>

          <p className="sr-only" aria-live="polite">
            {last ? `${last.sp === "agent" ? player.agent : player.client}: ${a.turns[lines.indexOf(last)].t}` : ""}
          </p>
        </div>
      </Frame>
    </>
  );
}

type Line = { key: string; sp: "agent" | "client"; at: string; text: string };

/**
 * The call, top to bottom, newest at the foot. A new or growing line pushes
 * the rest up; Motion animates only their position, so text never scales,
 * and the top of the column fades lines out as they leave.
 */
function Transcript({
  lines,
  labels,
  className,
}: {
  lines: Line[];
  labels: { agent: string; client: string };
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none relative min-h-[240px] overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,#000_32%)]",
        className,
      )}
    >
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-4 px-5 pb-5 md:px-6">
        <AnimatePresence initial={false}>
          {lines.slice(-KEEP * 2).map((l) => (
            <motion.div
              key={l.key}
              layout="position"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.25 } }}
              transition={{
                layout: { type: "spring", stiffness: 220, damping: 30, mass: 0.9 },
                opacity: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
                y: { duration: 0.55, ease: [0.16, 1, 0.3, 1] },
              }}
              className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 md:grid-cols-[76px_minmax(0,1fr)]"
            >
              <span className="pt-[3px]">
                <span
                  className={cn(
                    "block text-[11px] leading-4 font-medium tracking-[0.1em] uppercase",
                    l.sp === "agent" ? "text-pp-accent" : "text-pp-muted",
                  )}
                >
                  {l.sp === "agent" ? labels.agent : labels.client}
                </span>
                <span className="block text-[11px] leading-4 text-pp-muted/80 tabular-nums">{l.at}</span>
              </span>
              <p className={cn("text-[15px] leading-[23px]", l.sp === "agent" ? "text-pp-ink" : "text-pp-ink/70")}>
                {l.text}
              </p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
