"use client";

import { useEffect, useEffectEvent, useRef, useState, type CSSProperties } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { cueIn, loadCueFile, type CueFile } from "@/lib/audio";
import { KB_SOUND, TWO_CALLS, type TwoCallsTurn } from "@/lib/pages/knowledge-base";
import { TWO_CALLS_TRACK, twoCallsAt, twoCallsVoice, type TwoCallsVoice } from "@/lib/pages/knowledge-base-voice";
import { cn } from "@/lib/utils";
import { envelopeAt } from "@/components/site/audio/cue";
import { isSoundOn, unlockFromGesture } from "@/components/site/audio/engine";
import { armFollow, showSaid } from "@/components/site/audio/show-said";
import { SoundButton } from "@/components/site/audio/sound-button";
import { useSounding, useVoiceTrack } from "@/components/site/audio/use-voice-track";
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
 *
 * Sound. The two calls can be heard (AI-generated voices, one track,
 * lib/audio/cues/kb-two-calls.json, fetched only once sound is on). Two
 * calls can't be heard at once, so with sound on they are said in turn:
 * the question both callers ask, once; then the first agent's answer,
 * the second's, and each caller's reply. Each line comes up as it is
 * said, its words as they are spoken, on the audio's clock; the call not
 * speaking dims, and each orb swells with its agent's voice. Off screen
 * the run waits; "Replay both" replays it, spoken. With reduced motion
 * nothing plays by itself: the transport is "Listen".
 * ------------------------------------------------------------------ */

const DONE = 4;
const MUTED_MESH = ["#4a4852", "#7a7884", "#a9a7b2", "#d4d2da", "#f3f2f6"] as const;

/** The stage's claim on the site's one sound (components/site/audio/engine.ts). */
const VOICE_ID = "kb-two-calls";

type SpokenAt = ReturnType<typeof twoCallsAt>;

const sameAt = (a: SpokenAt | null, b: SpokenAt) =>
  !!a && a.current === b.current && a.said === b.said && a.shown.every((n, p) => n === b.shown[p]);

/** Spoken: an orb swells with its agent's voice (the envelope); null hands it back to its stylesheet. */
function voiceOrb(orb: HTMLElement | null | undefined, env: number | null) {
  if (!orb) return;
  if (env === null) {
    orb.style.removeProperty("transition");
    orb.style.removeProperty("scale");
    return;
  }
  orb.style.transition = "none";
  orb.style.scale = String(1 + 0.08 * Math.min(1, Math.max(0, (env - 0.35) / 0.45)));
}

/** A spoken word fades in over this long from the moment it is said. */
const SAID_FADE_S = 0.12;

export function KbTwoCalls() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, "-20% 0px");
  const reduce = usePrefersReducedMotion();

  // The section waits in a content-visibility box, laid out only as it nears the screen, and its cards
  // hold an invisible copy of each call (their final height): laid out then, mid-scroll, that text costs
  // a long frame on a phone. Once the fonts are in and the page is idle, a size read lays it out ahead.
  useEffect(() => {
    let live = true;
    let cancel = () => {};
    void document.fonts.ready.then(() => {
      if (!live) return;
      const layOut = () => void ref.current?.getBoundingClientRect();
      if (typeof window.requestIdleCallback === "function") {
        const id = window.requestIdleCallback(layOut, { timeout: 4000 });
        cancel = () => window.cancelIdleCallback(id);
      } else {
        const id = window.setTimeout(layOut, 1500);
        cancel = () => window.clearTimeout(id);
      }
    });
    return () => {
      live = false;
      cancel();
    };
  }, []);
  const [step, setStep] = useState(0);
  const [started, setStarted] = useState(false);

  const calls = TWO_CALLS.calls;

  /* ─── Sound ──────────────────────────────────────────────────────── */
  /** The run was started by a press here. Cleared when another stage's press takes the sound. */
  const pressed = useRef(false);
  const track = useVoiceTrack(VOICE_ID, {
    active: inView,
    onPreempt: () => {
      pressed.current = false;
    },
  });
  const trackRef = useRef(track);
  useEffect(() => {
    trackRef.current = track;
  });
  const sounding = useSounding();
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);
  /** The two calls' track, read against the lines shown: undefined until fetched (sound on), null without one that fits. */
  const [voice, setVoice] = useState<TwoCallsVoice | null | undefined>(undefined);
  /** A spoken run is under way (sound was on when it started): the audio's clock places every line. */
  const [spoken, setSpoken] = useState(false);
  /** Where the spoken run is. */
  const [at, setAt] = useState<SpokenAt | null>(null);
  /** Reduced motion: the Listen transport. */
  const [listen, setListen] = useState<"playing" | "paused" | null>(null);
  /** The last run was heard to its end: its outcomes are announced, the lines having been voiced. */
  const [heard, setHeard] = useState(false);
  /** A press that came before the track had arrived: it starts the run when it does. */
  const pending = useRef<"sound" | "listen" | null>(null);

  /**
   * Starts the spoken run from its first word. False (and nothing
   * changes) without a track, without sound, or when it would start by
   * itself where it may not: off screen, under reduced motion or the still tier.
   */
  const beginSpoken = (v: TwoCallsVoice | null | undefined, press: boolean, unlock = false) => {
    const t = trackRef.current;
    if (!v || !(unlock || isSoundOn()) || (!press && (t.listen || !inView))) return false;
    pressed.current = press;
    setStarted(true);
    setStep(1);
    setHeard(false);
    setSpoken(true);
    setAt(twoCallsAt(v, calls.length, 0));
    t.play(v.cue, 0, { press, unlock });
    return true;
  };
  /** The lead-in is over: the run starts, spoken if it can be. */
  const beginFromLead = useEffectEvent(() => beginSpoken(voice, false));
  const onTrack = useEffectEvent((file: CueFile) => {
    const v = twoCallsVoice(cueIn(file, TWO_CALLS_TRACK), calls);
    setVoice(v);
    const press = pending.current;
    pending.current = null;
    if (!press) return;
    if (press === "listen") setListen(v ? "playing" : null);
    beginSpoken(v, true);
  });

  /** Bumped by a press made while the track isn't here (a fetch that failed): it is asked for again. */
  const [refetch, setRefetch] = useState(0);
  // The track is fetched once sound is on, never before.
  useEffect(() => {
    if (!track.on || voice !== undefined) return;
    let live = true;
    void loadCueFile("kb-two-calls").then((file) => {
      if (!live) return;
      if (file) onTrack(file);
      // Not fetched (a flaky connection): a press made meanwhile is dropped; the next press (or sound turned on again) retries.
      else pending.current = null;
    });
    return () => {
      live = false;
    };
  }, [track.on, voice, refetch]);

  const shown = reduce && !spoken ? DONE : step;
  /** The spoken run's position; null while read-paced. */
  const sp = spoken && voice ? at : null;
  /** A voice is sounding (these lines', or another stage's): no announcing each one over it. */
  const quiet = (spoken && track.audible) || sounding;

  useEffect(() => {
    if (reduce || step >= DONE || spoken) return;
    if (!inView && !started) return;
    const longest = (i: number) =>
      calls.reduce((m, c) => Math.max(m, holdFor(c.turns[i - 1]?.t ?? "")), 0);
    // A touch quicker than reading pace: the point is the contrast, not the script.
    const delay = step === 0 ? 500 : step <= 3 ? Math.max(1200, longest(step) * 0.7) : 0;
    const id = window.setTimeout(() => {
      if (step === 0 && beginFromLead()) return;
      setStarted(true);
      setStep((s) => s + 1);
    }, delay);
    return () => window.clearTimeout(id);
  }, [inView, started, step, reduce, calls, spoken]);

  // The spoken run, frame by frame on the audio's clock: lines, words, the dimmed call and the orbs.
  useEffect(() => {
    if (!spoken || !voice || !inView || listen === "paused") return;
    const orbs = panelRefs.current.map((el) => el?.querySelector<HTMLElement>(".pp-orb"));
    let voiced = -1;
    let raf = 0;
    const frame = () => {
      const t = trackRef.current.time();
      const now = twoCallsAt(voice, calls.length, t);
      // The words of the line being said: each fades in over SAID_FADE_S from its start, set from the
      // clock every frame (React's state puts up the lines; it never writes these opacities).
      const said = now.current >= 0 ? voice.turns[now.current].turn : null;
      ref.current?.querySelectorAll<HTMLElement>("[data-said-word]").forEach((w) => {
        const at = said?.words[Number(w.dataset.saidWord)]?.[1] ?? Infinity;
        const v = String(Math.round(Math.min(1, Math.max(0, (t - at) / SAID_FADE_S)) * 1000) / 1000);
        if (w.style.opacity !== v) w.style.opacity = v;
      });
      setAt((prev) => (sameAt(prev, now) ? prev : now));
      // The orb of the call whose agent is speaking follows the voice.
      const cur = now.current >= 0 ? voice.turns[now.current] : null;
      const agent = cur && cur.turn.sp === "agent" && cur.panel !== null && !reduce ? cur.panel : -1;
      if (agent !== voiced) {
        voiceOrb(orbs[voiced], null);
        voiced = agent;
      }
      if (agent >= 0) voiceOrb(orbs[agent], envelopeAt(voice.cue, t));
      if (t >= voice.cue.dur) {
        voiceOrb(orbs[voiced], null);
        setHeard(trackRef.current.audible);
        setSpoken(false);
        setAt(null);
        setListen(null);
        setStep(DONE);
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      voiceOrb(orbs[voiced], null);
    };
  }, [spoken, voice, inView, listen, reduce, calls.length]);

  /** The spoken run can't carry on (another stage's press took the sound where nothing may start by itself): it reads on from where it is. */
  const readOn = useEffectEvent(() => {
    const lines = at ? Math.min(...at.shown) : 0;
    setSpoken(false);
    setAt(null);
    setListen(null);
    setStep(Math.max(1, Math.min(DONE, lines)));
  });
  // Off screen, the voice pauses (the hook): the visitor's press no longer holds the sound for this
  // run, and a Listen reads "Listen" again, carried on by a press.
  const listenAway = useEffectEvent(() => setListen((l) => (l === "playing" ? "paused" : l)));
  useEffect(() => {
    if (inView) return;
    pressed.current = false;
    listenAway();
  }, [inView]);

  // Back on screen mid-run: the audio carries on from where it stopped, claiming the sound only if
  // nobody else is playing (otherwise silently, on the same clock).
  useEffect(() => {
    if (!spoken || !voice || !inView || listen === "paused") return;
    if (trackRef.current.time() >= voice.cue.dur) return;
    if (!pressed.current && trackRef.current.listen) readOn();
    else trackRef.current.play(voice.cue);
  }, [spoken, voice, inView, listen]);

  /** The call whose line is being said (null for the shared question, or none), and that line. */
  const speaking = sp && voice && sp.current >= 0 ? voice.turns[sp.current] : null;
  const speakingPanel = speaking ? speaking.panel : null;
  const speakingLine = speaking ? speaking.line : -1;
  // Below md the two calls are stacked, the controls under the second: on a run this section's
  // own press started (or Listen), the call that is speaking is brought on screen when its line is
  // not, so the words can be read as they are said. The question both callers ask is in both calls:
  // whichever copy is nearer. A run that started by itself never moves the page.
  useEffect(() => {
    if (speakingLine < 0 || !pressed.current) return;
    const lineIn = (p: number) => panelRefs.current[p]?.querySelectorAll("ol[data-call-lines] > li")[speakingLine];
    showSaid(speakingPanel === null ? calls.map((_, p) => lineIn(p)) : lineIn(speakingPanel), reduce, "(max-width: 767px)");
  }, [speakingPanel, speakingLine, reduce, calls]);

  const replay = () => {
    if (beginSpoken(voice, true)) return;
    // Read-paced (sound off): a spoken run still finishing in silence gives way.
    if (spoken) trackRef.current.pause();
    setSpoken(false);
    setAt(null);
    setStarted(true);
    setStep(0);
  };

  /** Listen (reduced motion): plays both calls, turning sound on (the press unlocks it), or pauses them. */
  const toggleListen = () => {
    if (listen === "playing") {
      trackRef.current.pause();
      setListen("paused");
      return;
    }
    armFollow();
    if (listen === "paused" && spoken && voice) {
      pressed.current = true;
      setListen("playing");
      trackRef.current.play(voice.cue, undefined, { press: true, unlock: true });
      return;
    }
    if (voice === undefined) {
      // The track isn't here yet: sound goes on in this press, and the run starts when it arrives.
      unlockFromGesture();
      pending.current = "listen";
      setRefetch((n) => n + 1);
      return;
    }
    if (beginSpoken(voice, true, true)) setListen("playing");
  };

  // Sound turned on here: the calls start again from the question, spoken (Listen, with reduced motion).
  const onSound = (on: boolean) => {
    if (!on) return;
    if (voice === undefined) {
      pending.current = reduce ? "listen" : "sound";
      setRefetch((n) => n + 1);
      return;
    }
    if (beginSpoken(voice, true) && reduce) setListen("playing");
  };

  return (
    <>
      <Frame className="px-6 pb-10 md:px-12 md:pb-14">
        <SectionHeading eyebrow={TWO_CALLS.eyebrow} className="max-w-[780px]">
          {TWO_CALLS.title}
        </SectionHeading>
      </Frame>

      <Frame className="px-4 md:px-6">
        <div ref={ref} className="grid gap-4 md:grid-cols-2">
          {calls.map((c, p) => {
            const ended = !sp && shown >= DONE;
            /** Lines up: read-paced, the shared step; spoken, as far as this call has been said. */
            const lines = sp ? sp.shown[p] : shown;
            const cur = sp && voice && sp.current >= 0 ? voice.turns[sp.current] : null;
            /** The line of this call being said now, if it is this call's turn (or both calls' shared question). */
            const saying = cur && (cur.panel === null || cur.panel === p) ? cur.line : -1;
            return (
              <div
                key={c.id}
                ref={(el) => {
                  panelRefs.current[p] = el;
                }}
                className={cn(
                  "relative flex min-h-[460px] flex-col overflow-hidden rounded-[24px] p-6 transition-[background-color,box-shadow] duration-700 md:p-7",
                  c.good
                    ? ended
                      ? "bg-white shadow-[0_0_0_1.5px_rgb(85_26_137/0.4),0_30px_60px_-40px_rgb(85_26_137/0.5)]"
                      : "bg-pp-card"
                    : "bg-pp-card",
                  (track.on || sp) && "transition-[background-color,box-shadow,opacity]",
                  // The call that isn't speaking steps back while the other one does.
                  cur && cur.panel !== null && cur.panel !== p && "opacity-[0.55]",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {/* Spoken, the orb follows its agent's voice itself (voiceOrb), not its own breathing. */}
                    <Orb
                      mesh={c.good ? KB_MESH : MUTED_MESH}
                      speaking={!reduce && shown === 2 && !sp}
                      className="size-9"
                    />
                    <div>
                      <p className="text-[15px] leading-5">{c.label}</p>
                      <p className="text-[12px] leading-4 text-pp-muted">{TWO_CALLS.sample}</p>
                    </div>
                  </div>
                </div>

                {/* An invisible copy of the whole call holds the card at its final height from the start, so
                    the lines come up without moving what is below it (the two calls stack on a phone). It
                    never animates: its lines' entrance would run, unseen, as the section comes into view. */}
                <div className="mt-7 grid">
                  <ol aria-hidden className="invisible flex flex-col gap-3 [grid-area:1/1] [&>li]:animate-none">
                    {c.turns.map((turn, i) => (
                      <Line key={i} turn={turn} spoken live={false} />
                    ))}
                  </ol>
                  <ol data-call-lines aria-live={quiet ? "off" : "polite"} className="flex flex-col gap-3 [grid-area:1/1]">
                    {c.turns.map((turn, i) =>
                      lines > i ? (
                        <Line
                          key={i}
                          turn={turn}
                          spoken={!!sp}
                          live={!reduce && !sp && shown === i + 1}
                          said={sp && !reduce && saying === i ? sp.said : undefined}
                          mark={!!listen && saying === i}
                        />
                      ) : null,
                    )}
                  </ol>
                </div>

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

        {track.on && (
          // With the lines voiced, the outcomes are still announced.
          <p className="sr-only" aria-live="polite">
            {heard && shown >= DONE ? calls.map((c) => `${c.label}: ${c.outcome}.`).join(" ") : ""}
          </p>
        )}

        <div className="mt-5 flex flex-col items-start justify-between gap-4 px-2 sm:flex-row sm:items-center">
          <p className="font-[family-name:var(--font-pp-cinema)] text-[22px] leading-[1.25] italic md:text-[26px]">
            {TWO_CALLS.note}
          </p>
          {!reduce && (
            <button
              type="button"
              onClick={replay}
              className="pp-shadow-btn tap-44 relative inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-white px-3.5 text-sm text-pp-ink transition-colors hover:bg-pp-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink"
            >
              <RotateCcw className="size-3.5" />
              {TWO_CALLS.replay}
            </button>
          )}
          {reduce && voice !== null && (
            // Reduced motion: nothing plays by itself; Listen plays both calls, each line swapping in whole as it is said.
            <button
              type="button"
              onClick={toggleListen}
              className="pp-shadow-btn relative inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-white px-3.5 text-sm text-pp-ink transition-colors before:absolute before:inset-x-0 before:-inset-y-1 hover:bg-pp-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink"
            >
              {listen === "playing" ? <Pause className="size-3.5 fill-current" /> : <Play className="size-3.5 fill-current" />}
              {listen === "playing" ? KB_SOUND.pause : KB_SOUND.listen}
            </button>
          )}
        </div>
        <div className="mt-4 px-2">
          <SoundButton variant="pill" tone="light" onChange={onSound} />
        </div>
      </Frame>
    </>
  );
}

function Line({
  turn,
  spoken = false,
  live,
  said,
  mark = false,
}: {
  turn: TwoCallsTurn;
  /** Put up on the audio's clock: no fade of its own, its words show as they are said. */
  spoken?: boolean;
  live: boolean;
  /** Spoken: how many of its words have been said; each shows as it is. */
  said?: number;
  /** Listen (reduced motion): a still mark on the line being said. */
  mark?: boolean;
}) {
  const client = turn.sp === "client";
  return (
    <li
      className={cn(
        "flex max-w-[90%] flex-col gap-1 animate-in slide-in-from-bottom-2 duration-500",
        !spoken && "fade-in-0",
        client ? "self-end items-end" : "self-start items-start",
      )}
    >
      <span className="text-[11px] leading-4 text-pp-muted">{TWO_CALLS.labels[turn.sp]}</span>
      <span
        className={cn(
          "rounded-[16px] px-3.5 py-2.5 text-[15px] leading-[22px]",
          client ? "bg-pp-ink text-white" : "bg-white text-pp-ink shadow-[0_0_0_1px_rgb(24_16_40/0.08)]",
          mark && "outline-2 outline-offset-2 outline-[#551a89]/60",
        )}
      >
        {said !== undefined
          ? turn.t.split(" ").map((w, i) => (
              // Hidden until the frame loop shows it, from the clock, as it is said; React never writes it again.
              <span key={i} data-said-word={i} style={{ opacity: 0 }}>
                {w}{" "}
              </span>
            ))
          : live
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
