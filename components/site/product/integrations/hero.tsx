"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState, type CSSProperties } from "react";
import { Check, Hash, Loader2, Pause, Play, Tag, Timer, Webhook } from "lucide-react";
import { cueIn, loadCueFile, type Cue } from "@/lib/audio";
import {
  INT_HERO,
  keywordAt,
  RELAY,
  RELAY_EXCERPT,
  TRIGGERS,
  type ActionKind,
  type RelayScene,
} from "@/lib/pages/integrations";
import { cn } from "@/lib/utils";
import { isSoundOn, unlockFromGesture } from "@/components/site/audio/engine";
import { SoundButton } from "@/components/site/audio/sound-button";
import { useTabVisible, useVoiceTrack } from "@/components/site/audio/use-voice-track";
import { PillLink, SectionTitle } from "../primitives";
import { useInView, usePrefersReducedMotion } from "../timing";

/* ------------------------------------------------------------------ *
 * The cover: a centred headline over the relay — one workflow run, end
 * to end.
 *
 * A call's record arrives on the left: number, length, how it went, its
 * summary (and, for a keyword rule, the line the word was heard in). A
 * beam runs to the one rule in the middle it matches; the rule's steps
 * run one at a time, each spinning, then ticking off with its result; and
 * whatever a step produced lands on the right — the message the team
 * sees, the request a system receives — while a tag is written back onto
 * the call itself, exactly where the product puts it.
 *
 * One clock of steps drives it, paused off screen; picking a rule below
 * takes it over. Beams are measured between boxes, from lg up.
 *
 * Sound. The keyword rule's line can be heard: a short generated excerpt
 * (AI-generated voice, never a recording; lib/audio/cues/
 * post-call-keyword-excerpt.json, fetched only once sound is on). With
 * sound on, that scene plays its excerpt as the record arrives, and the
 * rule matches as the caller says the word, on the excerpt's clock.
 * Turning sound on here plays that scene. With reduced motion nothing
 * plays by itself; on that scene the transport is "Listen".
 * ------------------------------------------------------------------ */

/** The stage's claim on the site's one sound (components/site/audio/engine.ts). */
const VOICE_ID = "int-relay";

/**
 * The excerpt's cue file is P2: fetched on first use, once sound is on.
 * A failed fetch resolves to null and the scene stays silent, exactly as
 * with sound off.
 */
function loadExcerpt(): Promise<Cue | null> {
  return Promise.resolve()
    .then(() => loadCueFile(RELAY_EXCERPT.surface))
    .then((file) => (file && cueIn(file, RELAY_EXCERPT.id)) ?? null)
    .catch(() => null);
}

type Excerpt = { cue: Cue; wordAt: number };

/** A scene's excerpt, where it says the scene's line as shown, and where it says the keyword. */
function voiceOf(s: RelayScene, cue: Cue | null | undefined): Excerpt | null {
  const at = s.call.heard && cue ? keywordAt(cue, s.call.heard) : null;
  return cue && at !== null ? { cue, wordAt: at } : null;
}

const ICON: Record<ActionKind, typeof Webhook> = { webhook: Webhook, slack: Hash, tag: Tag, wait: Timer };
const TITLE: Record<ActionKind, string> = {
  webhook: "Send webhook",
  slack: "Notify Slack",
  tag: "Tag the call",
  wait: "Wait",
};

/** Steps: 0 idle · 1 record · 2 matched · 3…3+n-1 action running · 3+n done. */
function holdAt(step: number, n: number) {
  if (step === 0) return 450;
  if (step === 1) return 1700;
  if (step === 2) return 1200;
  if (step < 3 + n) return 1150;
  return 3400;
}

type Beam = { d: string; key: string };

export function IntHero() {
  return (
    <section className="mx-auto w-[calc(100%-2rem)] max-w-[1176px] pt-28 sm:w-[calc(100%-3rem)] md:pt-[148px] lg:w-[calc(100%-5rem)]">
      <div className="mx-auto flex max-w-[840px] flex-col items-center text-center">
        <SectionTitle as="h1" className="max-w-[780px]">
          {INT_HERO.title}
        </SectionTitle>
        <p className="mt-5 max-w-[660px] text-base leading-6 tracking-[0.01em] text-pp-ink/80 md:text-[17px] md:leading-[26px]">
          {INT_HERO.sub}
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          <PillLink href={INT_HERO.primary.href}>{INT_HERO.primary.label}</PillLink>
          <PillLink href={INT_HERO.secondary.href} variant="secondary">
            {INT_HERO.secondary.label}
          </PillLink>
        </div>
        <p className="mt-3 text-[13px] leading-[18px] text-pp-muted">{INT_HERO.note}</p>
      </div>

      <Relay />
    </section>
  );
}

function Relay() {
  const scenes: readonly RelayScene[] = RELAY.scenes;
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const callRef = useRef<HTMLDivElement>(null);
  const triggerRefs = useRef<(HTMLLIElement | null)[]>([]);
  const actionRefs = useRef<(HTMLLIElement | null)[]>([]);
  const outRefs = useRef<Partial<Record<ActionKind, HTMLDivElement | null>>>({});
  const inView = useInView(rootRef);
  // The voice needs the stage well on screen, not a sliver of it at an edge.
  const voiceView = useInView(rootRef, "-15% 0px");
  const reduce = usePrefersReducedMotion();

  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const [paused, setPaused] = useState(false);
  const [beams, setBeams] = useState<Beam[]>([]);

  /* ─── Sound ──────────────────────────────────────────────────────── */
  /** The excerpt has played to its end (or no excerpt is playing). */
  const done = useRef(true);
  /** The scene was started by a press here. Cleared when another stage's press takes the sound. */
  const pressed = useRef(false);
  const track = useVoiceTrack(VOICE_ID, {
    active: voiceView,
    onEnded: () => {
      done.current = true;
    },
    onPreempt: () => {
      pressed.current = false;
    },
  });
  const trackRef = useRef(track);
  useEffect(() => {
    trackRef.current = track;
  });
  /** The excerpt: undefined until fetched (sound on), null when it isn't there. */
  const [excerpt, setExcerpt] = useState<Cue | null | undefined>(undefined);
  /** This scene's line plays on the excerpt's clock (sound was on when it started). */
  const [spoken, setSpoken] = useState(false);
  /** Reduced motion: the Listen transport. */
  const [listen, setListen] = useState<"playing" | "paused" | null>(null);
  /** A press that came before the excerpt had arrived: it plays when it does. */
  const pending = useRef<"sound" | "listen" | null>(null);
  const keyIndex = scenes.findIndex((s) => s.call.heard);

  const scene = scenes[index];
  const n = scene.actions.length;
  const final = 3 + n;
  const voice = useMemo(() => voiceOf(scene, excerpt), [scene, excerpt]);
  const listening = listen === "playing";
  const shown = reduce && !listen ? final : step;
  // A spoken scene (or a Listen) runs while the voice may, well on screen; one read as written as it always has.
  const tabVisible = useTabVisible();
  // A spoken scene also holds while the tab is hidden: the engine pauses the excerpt then, and the
  // relay must not step on without it (timers still fire in a hidden tab).
  const running =
    (spoken || listen ? voiceView : inView) && !paused && (!reduce || listening) && (!(spoken || listen) || tabVisible);

  /**
   * Starts scene `i` at its record: with its excerpt when sound is on and
   * it has one, otherwise as written. `press` is the visitor's own choice
   * (it takes the sound from any other stage); `unlock` also turns sound
   * on (Listen: the press is the gesture).
   */
  const beginScene = (i: number, press: boolean, unlock = false, cue = excerpt) => {
    const v = voiceOf(scenes[i], cue);
    const t = trackRef.current;
    // Nothing starts a voice by itself under reduced motion or the still tier (the hook refuses it too).
    const speak = !!v && (unlock || isSoundOn()) && (press || !t.listen);
    setIndex(i);
    setStep(1);
    setSpoken(speak);
    if (!speak) {
      t.pause();
      return;
    }
    pressed.current = press;
    done.current = false;
    t.play(v.cue, 0, { press, unlock });
  };
  /** The idle beat is over: the scene starts, with its excerpt if it can. */
  const beginNext = useEffectEvent((i: number) => beginScene(i, false));
  const onExcerpt = useEffectEvent((cue: Cue | null) => {
    setExcerpt(cue);
    const press = pending.current;
    pending.current = null;
    if (!press || keyIndex < 0 || !voiceOf(scenes[keyIndex], cue)) return;
    setAutoplay(false);
    setPaused(false);
    if (press === "listen") setListen("playing");
    beginScene(keyIndex, true, false, cue);
  });

  // The excerpt is fetched once sound is on, never before.
  useEffect(() => {
    if (!track.on || excerpt !== undefined) return;
    let live = true;
    void loadExcerpt().then((cue) => {
      if (live) onExcerpt(cue);
    });
    return () => {
      live = false;
    };
  }, [track.on, excerpt]);

  useEffect(() => {
    if (!running) return;
    if (step === final && (!autoplay || listen)) return;
    // The record holds until the keyword is said (below).
    if (spoken && step === 1) return;
    const id = window.setTimeout(() => {
      if (step === 0) beginNext(index);
      else if (step < final) setStep(step + 1);
      else {
        setIndex((index + 1) % scenes.length);
        setStep(0);
        setSpoken(false);
      }
    }, holdAt(step, n));
    return () => window.clearTimeout(id);
  }, [running, step, final, n, index, autoplay, scenes.length, spoken, listen]);

  // The record holds on the excerpt's clock until the caller says the keyword: the rule matches as it is heard.
  const spokenVoice = spoken ? voice : null;
  useEffect(() => {
    if (!spokenVoice || !running || step !== 1) return;
    let raf = 0;
    const frame = () => {
      if (done.current || trackRef.current.time() >= spokenVoice.wordAt) {
        // Listen goes straight to the finished run; the excerpt says its last words over it.
        setStep(listen ? final : 2);
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [spokenVoice, running, step, listen, final]);

  // Listen ends with the excerpt.
  const listenOver = !!listen && spoken && step === final && track.ended;
  useEffect(() => {
    if (!listenOver) return;
    const id = window.setTimeout(() => setListen(null), 0);
    return () => window.clearTimeout(id);
  }, [listenOver]);

  // Off screen, the voice pauses (the hook): the visitor's press no longer holds the sound for this
  // scene, and a Listen reads "Listen" again, carried on by a press.
  const listenAway = useEffectEvent(() => setListen((l) => (l === "playing" ? "paused" : l)));
  useEffect(() => {
    if (voiceView) return;
    pressed.current = false;
    listenAway();
  }, [voiceView]);

  // Back on screen (or unpaused) mid-excerpt: it carries on from where it stopped, claiming the sound
  // only if nobody else is playing (otherwise silently, on the same clock).
  // Taken by another stage's press where nothing may start by itself (reduced motion, the still tier): the scene reads on.
  const readOn = useEffectEvent(() => setSpoken(false));
  useEffect(() => {
    if (!spokenVoice || !running || done.current) return;
    if (!pressed.current && trackRef.current.listen) readOn();
    else trackRef.current.play(spokenVoice.cue);
  }, [spokenVoice, running]);

  const recorded = shown >= 1;
  const matched = shown >= 2;
  /** How many actions have finished. */
  const doneCount = Math.max(0, Math.min(n, shown - 3));
  const runningAt = shown >= 3 && shown < final ? shown - 3 : -1;
  const finished = shown >= final;
  const doneKinds = new Set(scene.actions.slice(0, doneCount).map((a) => a.kind));
  const triggerIndex = TRIGGERS.findIndex((t) => t.id === scene.trigger);

  // Beams: record → matched rule, and each finished step → what it produced.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      if (!window.matchMedia("(min-width: 1024px)").matches) {
        setBeams([]);
        return;
      }
      const s = stage.getBoundingClientRect();
      const curve = (a: DOMRect, b: DOMRect, fromRight = true) => {
        const x1 = (fromRight ? a.right : a.left) - s.left;
        const y1 = a.top - s.top + Math.min(a.height / 2, 28);
        const x2 = b.left - s.left;
        const y2 = b.top - s.top + Math.min(b.height / 2, 28);
        const bend = Math.max(28, (x2 - x1) * 0.5);
        return `M${x1.toFixed(1)} ${y1.toFixed(1)} C${(x1 + bend).toFixed(1)} ${y1.toFixed(1)} ${(x2 - bend).toFixed(1)} ${y2.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
      };
      const next: Beam[] = [];
      const call = callRef.current?.getBoundingClientRect();
      const trig = triggerRefs.current[triggerIndex]?.getBoundingClientRect();
      if (call && trig) next.push({ key: "trigger", d: curve(call, trig) });
      scene.actions.forEach((a, i) => {
        if (a.kind === "tag" || a.kind === "wait") return;
        const row = actionRefs.current[i]?.getBoundingClientRect();
        const out = outRefs.current[a.kind]?.getBoundingClientRect();
        if (row && out) next.push({ key: `a${i}`, d: curve(row, out) });
      });
      setBeams(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    return () => ro.disconnect();
    // Re-measured per scene: the outputs on the right differ in height.
  }, [index, triggerIndex, scene.actions]);

  const pick = (i: number) => {
    setAutoplay(false);
    setPaused(false);
    if (reduce) {
      if (listen) trackRef.current.pause();
      setListen(null);
      setSpoken(false);
      setIndex(i);
      setStep(1);
      return;
    }
    beginScene(i, true);
  };

  const toggle = () => {
    if (step === final && !autoplay) {
      beginScene(index, true);
      setPaused(false);
      return;
    }
    if (spoken && voice && !done.current) {
      if (!paused) trackRef.current.pause();
      else {
        // Resuming is a press: it takes the sound back.
        pressed.current = true;
        trackRef.current.play(voice.cue, undefined, { press: true });
      }
    }
    setPaused((p) => !p);
  };

  /** Listen (reduced motion): plays the keyword scene's excerpt, turning sound on (the press unlocks it), or pauses it. */
  const toggleListen = () => {
    if (listen === "playing") {
      trackRef.current.pause();
      setListen("paused");
      return;
    }
    if (listen === "paused" && spoken && voice) {
      pressed.current = true;
      setListen("playing");
      if (!done.current) trackRef.current.play(voice.cue, undefined, { press: true, unlock: true });
      return;
    }
    if (excerpt === undefined) {
      // The excerpt isn't here yet: sound goes on in this press, and it plays when it arrives.
      unlockFromGesture();
      pending.current = "listen";
      return;
    }
    if (!voice) return;
    setListen("playing");
    beginScene(index, true, true);
  };

  // Sound turned on here: the keyword scene plays, with its excerpt (Listen, with reduced motion).
  const onSound = (on: boolean) => {
    if (!on || keyIndex < 0) return;
    if (excerpt === undefined) {
      pending.current = reduce ? "listen" : "sound";
      return;
    }
    if (!voiceOf(scenes[keyIndex], excerpt)) return;
    setAutoplay(false);
    setPaused(false);
    if (reduce) setListen("playing");
    beginScene(keyIndex, true);
  };

  const beamOn = (key: string) => {
    if (key === "trigger") return matched;
    const i = Number(key.slice(1));
    return doneCount > i;
  };

  return (
    <div ref={rootRef} className="mt-10 md:mt-12">
      <div ref={stageRef} className="relative overflow-hidden rounded-[28px] bg-pp-card">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(40% 50% at 50% 40%, rgb(176 139 232 / 0.18), transparent 70%), radial-gradient(40% 40% at 90% 100%, rgb(126 226 168 / 0.12), transparent 70%)",
          }}
        />
        <div aria-hidden className="pp-grain pointer-events-none absolute inset-0 opacity-[0.16]" />

        {beams.length > 0 && (
          <svg aria-hidden className="pointer-events-none absolute inset-0 size-full" fill="none">
            {beams.map((b) => (
              <g key={`${scene.id}-${b.key}`}>
                <path d={b.d} stroke="rgb(24 16 40 / 0.1)" strokeWidth="1.3" strokeDasharray="0.01 5" strokeLinecap="round" />
                <path
                  d={b.d}
                  pathLength={1}
                  stroke="#551a89"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeDasharray="1 1"
                  style={{
                    strokeDashoffset: beamOn(b.key) ? 0 : 1,
                    transition: reduce ? "none" : "stroke-dashoffset 650ms cubic-bezier(0.2, 0.8, 0.2, 1)",
                  }}
                />
              </g>
            ))}
          </svg>
        )}

        <div className="relative grid grid-cols-[minmax(0,1fr)] gap-6 p-4 pt-14 sm:p-6 sm:pt-14 lg:min-h-[540px] lg:grid-cols-[240px_minmax(0,1fr)_minmax(0,300px)] lg:gap-6 lg:p-8 xl:grid-cols-[300px_minmax(0,1fr)_minmax(0,380px)] xl:gap-10">
          {/* The call's record */}
          <div className="flex min-w-0 flex-col">
            <ColumnTitle>{RELAY.callTitle}</ColumnTitle>
            <div
              ref={callRef}
              key={`call-${scene.id}`}
              className={cn(
                "rounded-2xl bg-white p-4 shadow-[0_0_0_1px_rgb(24_16_40/0.06),0_14px_30px_-20px_rgb(24_16_40/0.35)] transition-[opacity,translate] duration-500",
                recorded ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[17px] leading-6 tabular-nums">{scene.call.number}</p>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] leading-4",
                    scene.trigger === "missed" ? "bg-[#fbe9e4] text-[#a2391c]" : "bg-pp-card text-pp-muted",
                  )}
                >
                  {scene.call.status}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-[12px] leading-4 text-pp-muted">
                <span className="tabular-nums">{scene.call.duration}</span>
                {scene.call.sentiment && (
                  <>
                    <span>·</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5",
                        scene.call.sentiment === "negative" && "bg-[#fbe9e4] text-[#a2391c]",
                        scene.call.sentiment === "neutral" && "bg-pp-card",
                        scene.call.sentiment === "positive" && "bg-[#e6f4ea] text-[#1f6b3f]",
                      )}
                    >
                      {RELAY.sentiment[scene.call.sentiment]}
                    </span>
                  </>
                )}
              </div>

              {scene.call.heard && (
                <p
                  className={cn(
                    "mt-3 rounded-xl bg-pp-card px-3 py-2 text-[13px] leading-[19px] text-pp-muted",
                    // Listen (reduced motion): a still mark on the line while it is said.
                    listen && "outline-2 outline-offset-2 outline-[#551a89]/60",
                  )}
                >
                  {scene.call.heard.before}
                  <span className="relative text-pp-ink">
                    <span
                      aria-hidden
                      className="absolute -inset-x-0.5 inset-y-0 origin-left rounded bg-[#551a89]/15"
                      style={{
                        transform: `scaleX(${matched ? 1 : 0})`,
                        transition: reduce ? "none" : "transform 500ms cubic-bezier(0.2, 0.8, 0.2, 1)",
                      }}
                    />
                    <span className="relative">{scene.call.heard.word}</span>
                  </span>
                  {scene.call.heard.after}
                  {track.on && voice && <span className="mt-1 block text-[11px] leading-4">{RELAY.excerpt}</span>}
                </p>
              )}

              <p className="mt-3 text-[13px] leading-[19px]">
                {scene.call.summary || <span className="text-pp-muted">{RELAY.noSummary}</span>}
                {scene.tag && (
                  <span
                    className={cn(
                      "ml-1 rounded bg-[#551a89]/10 px-1 font-mono text-[12px] text-[#551a89] transition-opacity duration-500",
                      doneKinds.has("tag") ? "opacity-100" : "opacity-0",
                    )}
                    aria-hidden={!doneKinds.has("tag")}
                  >
                    [tag:{scene.tag}]
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* The rule */}
          <div className="flex min-w-0 flex-col">
            <ColumnTitle>{RELAY.ruleTitle}</ColumnTitle>
            <p className="text-[11px] leading-4 text-pp-muted">{RELAY.when}</p>
            <ul className="mt-2 grid grid-cols-2 gap-1.5 lg:grid-cols-1">
              {TRIGGERS.map((t, i) => {
                const on = matched && i === triggerIndex;
                return (
                  <li
                    key={t.id}
                    ref={(el) => {
                      triggerRefs.current[i] = el;
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] leading-[18px] transition-[background-color,color,box-shadow,opacity] duration-500",
                      on
                        ? "bg-white text-pp-ink shadow-[0_0_0_1.5px_rgb(85_26_137/0.5),0_10px_24px_-16px_rgb(85_26_137/0.6)]"
                        : matched
                          ? "text-pp-muted opacity-50"
                          : "bg-white/40 text-pp-muted",
                    )}
                  >
                    <span className={cn("size-1.5 shrink-0 rounded-full", on ? "bg-[#551a89]" : "bg-pp-ink/20")} />
                    {t.label}
                  </li>
                );
              })}
            </ul>

            <p className="mt-5 text-[11px] leading-4 text-pp-muted">{RELAY.then}</p>
            <ol className="mt-2 flex flex-col gap-1.5">
              {scene.actions.map((a, i) => {
                const Icon = ICON[a.kind];
                const done = i < doneCount;
                const busy = i === runningAt;
                return (
                  <li
                    key={`${scene.id}-${i}`}
                    ref={(el) => {
                      actionRefs.current[i] = el;
                    }}
                    className={cn(
                      "flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 shadow-[0_0_0_1px_rgb(24_16_40/0.06)] transition-opacity duration-500",
                      matched ? "opacity-100" : "opacity-40",
                    )}
                  >
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-pp-card text-[11px] tabular-nums text-pp-muted">
                      {i + 1}
                    </span>
                    <Icon className="size-4 shrink-0 text-[#551a89]" strokeWidth={1.8} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] leading-[18px]">{TITLE[a.kind]}</span>
                      <span className="block truncate text-[11px] leading-4 text-pp-muted">{a.detail}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 text-[11px] leading-4">
                      {done ? (
                        <>
                          <span className="text-[#1f6b3f]">{a.result}</span>
                          <span className="grid size-4 place-items-center rounded-full bg-[#1f8a55] text-white animate-in zoom-in-50 duration-300">
                            <Check className="size-2.5" strokeWidth={3} />
                          </span>
                        </>
                      ) : busy ? (
                        <>
                          <span className="text-pp-muted">{RELAY.running}</span>
                          <Loader2 className="size-3.5 animate-spin text-[#551a89]" />
                        </>
                      ) : (
                        <span className="text-pp-muted">{RELAY.queued}</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>

            <p
              className={cn(
                "mt-4 flex items-center gap-2 text-[12px] leading-4 transition-[opacity,translate] duration-500",
                finished ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
              )}
              aria-live="polite"
            >
              <span className="size-1.5 rounded-full bg-[#1f8a55]" />
              {finished ? RELAY.runDone(n) : ""}
            </p>
          </div>

          {/* What it produced */}
          <div className="flex min-w-0 flex-col">
            <ColumnTitle>{RELAY.outTitle}</ColumnTitle>
            <div className="flex flex-col gap-3">
              {scene.webhook && (
                <div
                  ref={(el) => {
                    outRefs.current.webhook = el;
                  }}
                  className={cn(
                    "overflow-hidden rounded-2xl bg-[#17131f] text-white shadow-[0_18px_36px_-24px_rgb(24_16_40/0.7)] transition-[opacity,translate] duration-500",
                    doneKinds.has("webhook") ? "translate-y-0 opacity-100" : "translate-y-2 opacity-30",
                  )}
                >
                  <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3.5 py-2 text-[11px] leading-4">
                    <span className="truncate font-mono text-white/70">
                      <span className="text-[#b8a2dc]">POST</span> {scene.webhook.url}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-1.5 py-px font-mono transition-colors duration-300",
                        doneKinds.has("webhook") ? "bg-[#1f8a55]/30 text-[#9be3b8]" : "bg-white/10 text-white/50",
                      )}
                    >
                      {doneKinds.has("webhook") ? "200" : "…"}
                    </span>
                  </div>
                  <Payload scene={scene} live={doneKinds.has("webhook") && !reduce} />
                </div>
              )}

              {scene.slack && (
                <div
                  ref={(el) => {
                    outRefs.current.slack = el;
                  }}
                  className={cn(
                    "rounded-2xl bg-white p-3.5 shadow-[0_0_0_1px_rgb(24_16_40/0.06),0_14px_30px_-20px_rgb(24_16_40/0.35)] transition-[opacity,translate] duration-500",
                    doneKinds.has("slack") ? "translate-y-0 opacity-100" : "translate-y-2 opacity-30",
                  )}
                >
                  <p className="flex items-center gap-1.5 text-[12px] leading-4 text-pp-muted">
                    <Hash className="size-3.5" />
                    {scene.slack.channel.replace("#", "")}
                  </p>
                  <div className="mt-2.5 flex gap-2.5">
                    {/* Posted as whatever the team named its incoming webhook. */}
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#551a89] text-white">
                      <Webhook className="size-4" strokeWidth={1.8} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[12px] leading-4">
                        Call alerts <span className="text-pp-muted">· just now</span>
                      </p>
                      <p className="mt-1 text-[13px] leading-[19px]">{scene.slack.text}</p>
                    </div>
                  </div>
                </div>
              )}

              {scene.tag && !scene.slack && (
                <p
                  className={cn(
                    "text-[12px] leading-4 text-pp-muted transition-opacity duration-500",
                    doneKinds.has("tag") ? "opacity-100" : "opacity-0",
                  )}
                >
                  The tag is written onto the call&apos;s summary, on the left.
                </p>
              )}
            </div>
          </div>
        </div>

        {reduce && scene.call.heard && (excerpt === undefined || voice) && (
          // Reduced motion: nothing plays by itself; on the keyword scene, Listen plays its excerpt.
          <button
            type="button"
            onClick={toggleListen}
            aria-label={listening ? RELAY.pause : RELAY.listen}
            className="pp-shadow-btn absolute top-4 right-4 grid size-9 place-items-center rounded-full bg-white text-pp-ink transition-colors before:absolute before:-inset-1 before:rounded-full hover:bg-pp-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink lg:top-auto lg:bottom-4"
          >
            {listening ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
          </button>
        )}
        {!reduce && (
          <button
            type="button"
            onClick={toggle}
            aria-label={step === final && !autoplay ? RELAY.play : paused ? RELAY.play : RELAY.pause}
            className="pp-shadow-btn absolute top-4 right-4 grid size-9 lg:top-auto lg:bottom-4 place-items-center rounded-full bg-white text-pp-ink transition-colors hover:bg-pp-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink"
          >
            {paused || (step === final && !autoplay) ? <Play className="size-4 fill-current" /> : <Pause className="size-4 fill-current" />}
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-start">
        <p className="shrink-0 text-[12px] leading-4 text-pp-muted md:pt-2.5 md:pr-2">{RELAY.pick}</p>
        <div
          role="group"
          aria-label={RELAY.pick}
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] md:flex-wrap md:overflow-visible"
        >
          {scenes.map((x, i) => {
            const on = i === index;
            return (
              <button
                key={x.id}
                type="button"
                onClick={() => pick(i)}
                aria-pressed={on}
                className={cn(
                  "relative h-9 shrink-0 overflow-hidden rounded-full px-3.5 text-[13px] whitespace-nowrap transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink",
                  on ? "bg-pp-ink text-white" : "bg-pp-card text-pp-ink hover:bg-[#ebe9f1]",
                )}
              >
                {x.label}
                {on && autoplay && !reduce && (
                  <span
                    aria-hidden
                    className="absolute inset-x-3 bottom-1 h-px origin-left bg-white/60"
                    style={{ transform: `scaleX(${shown / final})`, transition: "transform 600ms ease-out" }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3">
        <SoundButton variant="pill" tone="light" onChange={onSound} />
      </div>
    </div>
  );
}

function ColumnTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[11px] leading-4 font-medium tracking-[0.14em] text-pp-muted uppercase">{children}</p>
  );
}

/**
 * An excerpt of the request body — the real shape, nested under "call" —
 * typed out line by line once the step has run.
 */
function Payload({ scene, live }: { scene: RelayScene; live: boolean }) {
  const lines: { key: string | null; value: string; depth: number; comma: boolean }[] = [
    { key: "event", value: '"workflow_triggered"', depth: 1, comma: true },
    { key: "call", value: "{", depth: 1, comma: false },
    { key: "caller_number", value: `"${scene.call.number.replace(/\s/g, "")}"`, depth: 2, comma: true },
    { key: "duration_seconds", value: String(toSeconds(scene.call.duration)), depth: 2, comma: true },
    { key: "sentiment", value: scene.call.sentiment ? `"${scene.call.sentiment}"` : "null", depth: 2, comma: true },
    { key: "summary", value: scene.call.summary ? `"${truncate(scene.call.summary, 30)}"` : "null", depth: 2, comma: false },
    { key: null, value: "}", depth: 1, comma: false },
  ];
  return (
    <pre className="overflow-x-auto px-3.5 py-3 font-mono text-[11px] leading-[18px] text-white/85">
      <span className="text-white/50">{"{"}</span>
      {lines.map((l, i) => (
        <span
          key={`${scene.id}-${i}`}
          className={cn("block", live && "animate-in fade-in-0 slide-in-from-left-1 fill-mode-both duration-300")}
          style={{ paddingLeft: `${l.depth * 12}px`, ...(live ? { animationDelay: `${i * 80}ms` } : null) } as CSSProperties}
        >
          {l.key && (
            <>
              <span className="text-[#b8a2dc]">&quot;{l.key}&quot;</span>:{" "}
            </>
          )}
          <span className={l.value === "{" || l.value === "}" ? "text-white/50" : "text-[#f2c6a0]"}>{l.value}</span>
          {l.comma ? "," : ""}
        </span>
      ))}
      <span className="text-white/50">{"}"}</span>
    </pre>
  );
}

function toSeconds(mmss: string) {
  const [m, s] = mmss.split(":").map(Number);
  return m * 60 + s;
}

function truncate(text: string, n: number) {
  return text.length > n ? `${text.slice(0, n - 1)}…` : text;
}
