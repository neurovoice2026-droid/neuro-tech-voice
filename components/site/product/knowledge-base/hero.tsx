"use client";

import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { cueIn, lazyCues } from "@/lib/audio";
import type { CueTurn } from "@/lib/audio/cue-types";
import { KB_HERO, KB_SOUND, ROOM, type KbDoc, type KbQuestion } from "@/lib/pages/knowledge-base";
import { pastEnd, ROOM_VOICE, roomVoice, wordsSaid, type RoomVoice } from "@/lib/pages/knowledge-base-voice";
import { cn } from "@/lib/utils";
import { envelopeAt } from "@/components/site/audio/cue";
import { isSoundOn, unlockFromGesture } from "@/components/site/audio/engine";
import { SoundButton } from "@/components/site/audio/sound-button";
import { useLazyCues } from "@/components/site/audio/use-lazy-cues";
import { useSounding, useVoiceTrack } from "@/components/site/audio/use-voice-track";
import { Orb, PillLink, SectionTitle } from "../primitives";
import { useInView, usePrefersReducedMotion } from "../timing";
import { DocBadge, KB_MESH } from "./parts";

/* ------------------------------------------------------------------ *
 * The cover: a centred headline over the reading room — a small working
 * model of the knowledge base.
 *
 * A caller's question comes in on the right. The agent looks through the
 * five documents on the left: a beam runs to each, and each shows how
 * closely it matches against a tick for "close enough to answer". The
 * best one lifts, its page opens under the orb with the answering line
 * marked, and the answer is spoken. The last question is one no document
 * answers: every match stays under the tick, no page opens, and the agent
 * says so and takes a message instead.
 *
 * One clock of steps drives it, paused off screen; picking a question
 * takes it over. Beams are drawn between measured boxes, so they follow
 * the layout at any width from lg; below lg the room stacks and the
 * beams are left out.
 *
 * Sound. Each question and answer can be heard (AI-generated voices,
 * lib/audio/cues/kb-hero-reading-room.json), once the visitor turns
 * sound on with the control under the room; nothing is fetched before.
 * A question that starts with sound on is played on its clips' clocks:
 * the caller's words land as they are said and the question holds until
 * just after its last word, the search between stays silent and timed as
 * before, and the answer is said the same way, the orb swelling with the
 * voice. Sound turned on mid-question starts it again, spoken; turned
 * off, it finishes on the same clock in silence and the next question is
 * read-paced. With reduced motion nothing plays by itself: the transport
 * is "Listen", which steps the question through as it is said.
 * ------------------------------------------------------------------ */

/** The stage's claim on the site's one sound (components/site/audio/engine.ts). */
const VOICE_ID = "kb-hero";

/**
 * Each question's two clips, where both say its lines as shown; a question
 * without them stays read-paced. P0: the cue file (a few KB of timings) is
 * fetched as sound goes on, never in the page's first load.
 */
const VOICES = lazyCues(
  "kb-hero-reading-room",
  (file): Partial<Record<string, RoomVoice>> =>
    Object.fromEntries(
      ROOM.questions.map((q) => [
        q.id,
        roomVoice(q, cueIn(file, ROOM_VOICE.ask(q.id)), cueIn(file, ROOM_VOICE.answer(q.id))) ?? undefined,
      ]),
    ),
);
/** A question's clips, if they are here. */
const voiceOf = (id: string) => VOICES.get()?.[id];

/**
 * Spoken: the orb swells with the voice (the clip's envelope, at `gain`)
 * instead of breathing on its own; null hands it back to its stylesheet,
 * which eases it home.
 */
function voiceOrb(orb: HTMLElement | null, env: number | null, gain = 1) {
  if (!orb) return;
  if (env === null) {
    orb.style.removeProperty("transition");
    orb.style.removeProperty("scale");
    return;
  }
  orb.style.transition = "none";
  orb.style.scale = String(1 + 0.05 * gain * Math.min(1, Math.max(0, (env - 0.35) / 0.45)));
}

/** Steps of one question: idle, asked, reading, found, answering, done. */
const DONE = 5;

/** How far a match must reach to be answered from; the tick on each bar. */
export const THRESHOLD = 0.6;

function holdAt(step: number, q: KbQuestion) {
  const words = (t: string) => t.trim().split(/\s+/).length;
  switch (step) {
    case 0:
      return 450;
    case 1:
      return Math.max(1300, words(q.ask) * 120 + 700);
    case 2:
      return 1800;
    case 3:
      return 1300;
    case 4:
      return Math.max(2000, words(q.answer) * 190 + 900);
    default:
      return 2800;
  }
}

export function KbHero() {
  return (
    <section className="mx-auto w-[calc(100%-2rem)] max-w-[1176px] pt-28 sm:w-[calc(100%-3rem)] md:pt-[148px] lg:w-[calc(100%-5rem)]">
      <div className="mx-auto flex max-w-[840px] flex-col items-center text-center">
        <SectionTitle as="h1" className="max-w-[760px]">
          {KB_HERO.title}
        </SectionTitle>
        <p className="mt-5 max-w-[640px] text-base leading-6 tracking-[0.01em] text-pp-ink/80 md:text-[17px] md:leading-[26px]">
          {KB_HERO.sub}
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          <PillLink href={KB_HERO.primary.href}>{KB_HERO.primary.label}</PillLink>
          <PillLink href={KB_HERO.secondary.href} variant="secondary">
            {KB_HERO.secondary.label}
          </PillLink>
        </div>
        <p className="mt-3 text-[13px] leading-[18px] text-pp-muted">{KB_HERO.note}</p>
      </div>

      <ReadingRoom />
    </section>
  );
}

type Beam = { d: string };

function ReadingRoom() {
  const docs: readonly KbDoc[] = ROOM.docs;
  const questions: readonly KbQuestion[] = ROOM.questions;

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const orbRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<(HTMLLIElement | null)[]>([]);
  const inView = useInView(rootRef);
  // The voice needs the room well on screen, not a sliver of it at an edge.
  const voiceView = useInView(rootRef, "-15% 0px");
  const reduce = usePrefersReducedMotion();

  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const [paused, setPaused] = useState(false);
  const [beams, setBeams] = useState<Beam[]>([]);
  /** This question plays on its clips' clocks (sound was on when it started). */
  const [spoken, setSpoken] = useState(false);
  /** Spoken: how many words of the line being said have been said. */
  const [said, setSaid] = useState(0);
  /** Reduced motion: the Listen transport. */
  const [listen, setListen] = useState<"playing" | "paused" | null>(null);
  /** The question was started by a press here: its answer takes the sound as well. Cleared when another stage's press takes it. */
  const pressed = useRef(false);
  /** When the clip being followed reached its end (performance.now()); null while it plays. */
  const endedAt = useRef<number | null>(null);

  const track = useVoiceTrack(VOICE_ID, {
    active: voiceView,
    onEnded: () => {
      endedAt.current = performance.now();
    },
    onPreempt: () => {
      pressed.current = false;
    },
  });
  const trackRef = useRef(track);
  useEffect(() => {
    trackRef.current = track;
  });
  const sounding = useSounding();

  const q = questions[index];
  /** Every question's clips, once their timings are here (fetched as sound goes on). */
  const voices = useLazyCues(VOICES, track.on);
  const voice = spoken ? voices?.[q.id] : undefined;
  /** This question has clips; before their timings are here (sound off), every question is taken to have them, as each does. */
  const voiced = voices ? !!voices[q.id] : !VOICES.settled();
  const listening = listen === "playing";
  // Reduced motion: no clock at all, the question simply reads complete, unless Listen steps it through.
  const shown = reduce && !listen ? DONE : step;
  // A spoken question (or a Listen) runs while the voice may, well on screen; a read-paced one as it always has.
  const running = (spoken || listen ? voiceView : inView) && !paused && (!reduce || listening);
  /** A voice is sounding (these lines', or another stage's): no announcing each one over it. */
  const quiet = (spoken && track.audible) || sounding;

  /**
   * Starts question `i` at its first line: on its clips' clocks when sound
   * is on and it has them, otherwise read-paced. `press` is the visitor's
   * own choice, which takes the sound from any other stage; `unlock` also
   * turns sound on (Listen: the press is the gesture).
   */
  const beginQuestion = (i: number, press: boolean, unlock = false) => {
    // Sound on, and the clips' timings not here yet: the question starts once they are (a moment).
    const ask = ++cueWait.current;
    if ((unlock || isSoundOn()) && !VOICES.settled()) {
      if (unlock) unlockFromGesture();
      void VOICES.load().then(() => {
        if (ask === cueWait.current) beginLater.current(i, press);
      });
      return;
    }
    const v = voiceOf(questions[i].id);
    const t = trackRef.current;
    // Nothing starts a voice by itself under reduced motion or the still tier (the hook refuses it too).
    const speak = !!v && (unlock || isSoundOn()) && (press || !t.listen);
    pressed.current = speak && press;
    setIndex(i);
    setStep(1);
    setSaid(0);
    setSpoken(speak);
    if (!speak) {
      t.pause();
      return;
    }
    endedAt.current = null;
    t.play(v.ask, 0, { press, unlock, next: v.answer.src });
  };
  /** Bumped by every question started: one waiting for the clips' timings starts only if it is still the last. */
  const cueWait = useRef(0);
  const beginLater = useRef(beginQuestion);
  useLayoutEffect(() => {
    beginLater.current = beginQuestion;
  });
  /** The idle beat is over: the question starts, spoken or read-paced. */
  const beginNext = useEffectEvent((i: number) => beginQuestion(i, false));

  /** The search is over: the answer comes, said from its first word. */
  const answer = useEffectEvent(() => {
    setStep(4);
    setSaid(0);
    const v = voiceOf(q.id);
    if (!v) return;
    // Taken by another stage's press where nothing may start by itself (reduced motion, the still tier): the answer is read-paced.
    if (!pressed.current && trackRef.current.listen) {
      setSpoken(false);
      return;
    }
    endedAt.current = null;
    const after = autoplay && !listen ? voiceOf(questions[(index + 1) % questions.length].id) : undefined;
    trackRef.current.play(v.answer, 0, { press: pressed.current, next: after?.ask.src });
  });

  useEffect(() => {
    if (!running) return;
    if (step === DONE && (!autoplay || listen)) return;
    // A spoken line holds on its clip's clock (below); the beats around it are timed here.
    if (spoken && (step === 1 || step === 4)) return;
    const id = window.setTimeout(() => {
      if (step === 0) beginNext(index);
      else if (step === 3 && spoken) answer();
      else if (step < DONE) setStep(step + 1);
      else {
        setIndex((index + 1) % questions.length);
        setStep(0);
        setSpoken(false);
      }
    }, holdAt(step, q));
    return () => window.clearTimeout(id);
  }, [running, step, index, autoplay, q, questions.length, spoken, listen]);

  // A spoken line: its words land as they are said, and it holds until just after the last one.
  useEffect(() => {
    if (!voice || !running || (step !== 1 && step !== 4)) return;
    const cue = step === 1 ? voice.ask : voice.answer;
    const turn = cue.turns[0];
    const until = turn.end + (step === 1 ? ROOM_VOICE.askTail : ROOM_VOICE.answerTail);
    const orb = step === 4 && !reduce ? (orbRef.current?.querySelector<HTMLElement>(".pp-orb") ?? null) : null;
    // The answer that isn't in the documents is said more quietly by the orb.
    const gain = q.doc ? 1 : 0.4;
    // The line's words: each fades in over SAID_FADE_S from its start, set from the clock every frame.
    const words = Array.from(stageRef.current?.querySelectorAll<HTMLElement>("[data-said-word]") ?? []);
    let raf = 0;
    const frame = () => {
      const t = pastEnd(trackRef.current.time(), cue, endedAt.current, performance.now());
      showSaid(words, turn, t);
      setSaid(wordsSaid(turn, t));
      voiceOrb(orb, envelopeAt(cue, t), gain);
      if (t >= until) {
        voiceOrb(orb, null);
        // Listen ends with the answer: the question reads complete again.
        if (step === 4) setListen(null);
        setStep(step + 1);
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      voiceOrb(orb, null);
    };
  }, [voice, running, step, reduce, q.doc]);

  // Off screen, the voice pauses (the hook): the visitor's press no longer holds the sound for this
  // question, and a Listen reads "Listen" again, carried on by a press.
  const listenAway = useEffectEvent(() => setListen((l) => (l === "playing" ? "paused" : l)));
  useEffect(() => {
    if (voiceView) return;
    pressed.current = false;
    listenAway();
  }, [voiceView]);

  // Back on screen (or unpaused) mid-line: the clip carries on from where it stopped, claiming the
  // sound only if nobody else is playing (otherwise silently, on the same clock).
  const readOn = useEffectEvent(() => setSpoken(false));
  useEffect(() => {
    if (!voice || !running || (step !== 1 && step !== 4) || endedAt.current !== null) return;
    // Taken by another stage's press where nothing may start by itself: the rest of the question is read-paced.
    if (!pressed.current && trackRef.current.listen) readOn();
    else trackRef.current.play(step === 1 ? voice.ask : voice.answer);
  }, [voice, running, step]);

  // Beams run from each document's edge to the orb; re-measured whenever
  // the room changes size.
  useEffect(() => {
    const stage = stageRef.current;
    const orb = orbRef.current;
    if (!stage || !orb) return;
    const measure = () => {
      if (!window.matchMedia("(min-width: 1024px)").matches) {
        setBeams([]);
        return;
      }
      const s = stage.getBoundingClientRect();
      const o = orb.getBoundingClientRect();
      const ox = o.left - s.left + 6;
      const oy = o.top - s.top + o.height / 2;
      setBeams(
        tileRefs.current.map((tile) => {
          if (!tile) return { d: "" };
          const t = tile.getBoundingClientRect();
          const x = t.right - s.left;
          const y = t.top - s.top + t.height / 2;
          const bend = Math.max(40, (ox - x) * 0.55);
          return { d: `M${x.toFixed(1)} ${y.toFixed(1)} C${(x + bend).toFixed(1)} ${y.toFixed(1)} ${(ox - bend).toFixed(1)} ${oy.toFixed(1)} ${ox.toFixed(1)} ${oy.toFixed(1)}` };
        }),
      );
    };
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    return () => ro.disconnect();
  }, []);

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
    beginQuestion(i, true);
  };

  const toggle = () => {
    if (step === DONE && !autoplay) {
      beginQuestion(index, true);
      setPaused(false);
      return;
    }
    if (spoken && (step === 1 || step === 4)) {
      const v = voiceOf(q.id);
      if (!paused) trackRef.current.pause();
      else if (v && endedAt.current === null) {
        // Resuming is a press: it takes the sound back.
        pressed.current = true;
        trackRef.current.play(step === 1 ? v.ask : v.answer, undefined, { press: true });
      }
    }
    setPaused((p) => !p);
  };

  /** Listen (reduced motion): steps the question through as it is said, turning sound on (the press unlocks it), or pauses it. */
  const toggleListen = () => {
    if (!voiced) return;
    const v = voiceOf(q.id);
    if (listen === "playing") {
      trackRef.current.pause();
      setListen("paused");
      return;
    }
    setListen("playing");
    if (listen === "paused" && spoken && v) {
      if ((step === 1 || step === 4) && endedAt.current === null) {
        pressed.current = true;
        trackRef.current.play(step === 1 ? v.ask : v.answer, undefined, { press: true, unlock: true });
      }
      return;
    }
    beginQuestion(index, true, true);
  };

  // Sound turned on here: the question starts again from its first line, spoken (Listen, with reduced motion).
  const onSound = (on: boolean) => {
    if (!on || !voiced) return;
    setPaused(false);
    if (reduce) setListen("playing");
    beginQuestion(index, true);
  };

  const best = q.doc ? docs.findIndex((d) => d.id === q.doc) : -1;
  const missing = best < 0;
  const reading = shown >= 2;
  const settled = shown >= 3;
  const status =
    shown <= 1
      ? ROOM.status.listening
      : shown === 2
        ? ROOM.status.reading
        : shown === 4
          ? ROOM.status.answering
          : missing
            ? ROOM.status.missing
            : ROOM.status.found;
  const tone = shown === 2 || shown === 4 ? "busy" : shown >= 3 ? (missing ? "missing" : "found") : "idle";

  return (
    <div ref={rootRef} className="mt-10 md:mt-12">
      <div ref={stageRef} className="relative overflow-hidden rounded-[28px] bg-pp-card">
        {/* The orb's own light, behind everything. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(38% 46% at 50% 30%, rgb(176 139 232 / 0.22), transparent 70%), radial-gradient(40% 40% at 50% 100%, rgb(242 198 160 / 0.18), transparent 70%)",
          }}
        />
        <div aria-hidden className="pp-grain pointer-events-none absolute inset-0 opacity-[0.16]" />

        {beams.length > 0 && (
          <svg aria-hidden className="pointer-events-none absolute inset-0 size-full" fill="none">
            {beams.map((b, i) => {
              if (!b.d) return null;
              const isBest = i === best;
              return (
                <g key={i}>
                  <path d={b.d} stroke="rgb(24 16 40 / 0.1)" strokeWidth="1.3" strokeDasharray="0.01 5" strokeLinecap="round" />
                  <path
                    d={b.d}
                    stroke="rgb(85 26 137 / 0.45)"
                    strokeWidth="1.2"
                    strokeDasharray="3 7"
                    strokeLinecap="round"
                    className="transition-opacity duration-500"
                    style={{ opacity: shown === 2 ? 0.35 + q.match[i] * 0.65 : 0 }}
                  >
                    {shown === 2 && !reduce && (
                      <animate attributeName="stroke-dashoffset" from="20" to="0" dur="0.8s" repeatCount="indefinite" />
                    )}
                  </path>
                  <path
                    d={b.d}
                    pathLength={1}
                    stroke="#551a89"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeDasharray="1 1"
                    style={{
                      strokeDashoffset: settled && isBest ? 0 : 1,
                      transition: reduce ? "none" : "stroke-dashoffset 700ms cubic-bezier(0.2, 0.8, 0.2, 1)",
                    }}
                  />
                </g>
              );
            })}
          </svg>
        )}
        {/* What travels the beam once the page is found. */}
        {beams[best]?.d && (
          <span
            aria-hidden
            className="pointer-events-none absolute top-0 left-0 size-2 rounded-full bg-[#551a89] shadow-[0_0_0_4px_rgb(85_26_137/0.15)]"
            style={{
              offsetPath: `path("${beams[best].d}")`,
              offsetDistance: settled ? "100%" : "0%",
              opacity: shown === 3 ? 1 : 0,
              transition: reduce ? "none" : "offset-distance 800ms cubic-bezier(0.45, 0, 0.2, 1), opacity 300ms",
            }}
          />
        )}

        <div className="relative grid gap-3 p-3 sm:p-4 lg:h-[500px] lg:grid-cols-[292px_minmax(0,1fr)_348px] lg:gap-0 lg:p-0">
          {/* The documents */}
          <div className="rounded-[20px] bg-white/50 p-4 max-lg:order-last lg:rounded-none lg:bg-transparent lg:p-6">
            <p className="text-[11px] leading-4 font-medium tracking-[0.14em] text-pp-muted uppercase">{ROOM.sample}</p>
            <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 lg:gap-2.5">
              {docs.map((d, i) => {
                const isBest = i === best;
                return (
                  <li
                    key={d.id}
                    ref={(el) => {
                      tileRefs.current[i] = el;
                    }}
                    className={cn(
                      "relative rounded-2xl bg-white px-3.5 py-3 shadow-[0_0_0_1px_rgb(24_16_40/0.06),0_10px_24px_-18px_rgb(24_16_40/0.3)] transition-[opacity,translate,box-shadow] duration-500",
                      settled && isBest && "shadow-[0_0_0_1.5px_rgb(85_26_137/0.55),0_16px_32px_-18px_rgb(85_26_137/0.45)] lg:translate-x-2",
                      settled && !isBest && "opacity-60",
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <DocBadge kind={d.kind} />
                      <span className="min-w-0 flex-1 truncate text-[13px] leading-5">{d.name}</span>
                    </div>
                    <span className="relative mt-2.5 block h-1 overflow-hidden rounded-full bg-pp-card">
                      <span
                        className={cn(
                          "absolute inset-y-0 left-0 w-full origin-left rounded-full",
                          q.match[i] >= THRESHOLD ? "bg-[#551a89]" : "bg-[#b8a2dc]",
                        )}
                        style={{
                          transform: `scaleX(${reading ? q.match[i] : 0})`,
                          transition: reduce
                            ? "none"
                            : `transform ${reading ? 900 : 300}ms cubic-bezier(0.2, 0.8, 0.2, 1) ${shown === 2 ? i * 90 : 0}ms`,
                        }}
                      />
                      <span
                        aria-hidden
                        className="absolute inset-y-0 w-px bg-pp-ink/30"
                        style={{ left: `${THRESHOLD * 100}%` }}
                      />
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* The agent, and the page it found */}
          <div className="flex flex-col items-center rounded-[20px] px-4 pt-5 pb-5 lg:rounded-none lg:px-8 lg:pt-8">
            <StatusPill tone={tone} label={status} />
            <div ref={orbRef} className="relative mt-5 size-[104px] lg:mt-7 lg:size-[140px]">
              {/* Spoken, the orb follows the voice itself (voiceOrb), not its own breathing. */}
              <Orb mesh={KB_MESH} speaking={shown === 4 && !paused && !reduce && !spoken} className="size-full" />
            </div>
            <Page key={q.id} doc={best >= 0 ? docs[best] : null} line={q.line} open={settled} reduce={reduce} />
          </div>

          {/* The call */}
          <div className="flex min-h-[248px] flex-col rounded-[20px] bg-white/70 p-5 max-lg:order-first lg:rounded-none lg:border-l lg:border-pp-rule lg:bg-white/55 lg:p-6">
            <p className="text-[11px] leading-4 font-medium tracking-[0.14em] text-pp-muted uppercase">Sample call</p>
            <ol aria-live={quiet ? "off" : "polite"} className="mt-4 flex flex-col gap-2.5">
              {shown >= 1 && (
                <Bubble
                  key={`${q.id}-ask`}
                  who="client"
                  label={ROOM.caller}
                  text={q.ask}
                  live={shown === 1 && !reduce}
                  said={spoken && !reduce && shown === 1 ? said : undefined}
                  mark={!!listen && shown === 1}
                />
              )}
              {shown >= 4 && (
                <Bubble
                  key={`${q.id}-answer`}
                  who="agent"
                  label={missing ? `${ROOM.agent} · ${ROOM.fallback}` : ROOM.agent}
                  text={q.answer}
                  live={shown === 4 && !reduce}
                  said={spoken && !reduce && shown === 4 ? said : undefined}
                  mark={!!listen && shown === 4}
                />
              )}
            </ol>
            {track.on && (
              // With this stage's own lines voiced, its outcome is still announced: only while this stage
              // holds the sound, never because another stage's voice started (it would speak over it).
              <p className="sr-only" aria-live="polite">
                {track.audible && shown >= DONE
                  ? missing
                    ? ROOM.missingOutcome
                    : `${ROOM.foundIn} · ${docs[best].name}`
                  : ""}
              </p>
            )}

            <div className="mt-auto flex items-end justify-between gap-3 pt-5">
              <p
                className={cn(
                  "flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[12px] leading-4 shadow-[0_0_0_1px_rgb(24_16_40/0.08)] transition-[opacity,translate] duration-500",
                  shown >= DONE ? "opacity-100" : "translate-y-1 opacity-0",
                )}
                aria-hidden={shown < DONE}
              >
                <span className={cn("size-1.5 shrink-0 rounded-full", missing ? "bg-[#e0663a]" : "bg-[#1f8a55]")} />
                {missing ? ROOM.missingOutcome : `${ROOM.foundIn} · ${docs[best].name}`}
              </p>
              {reduce && voiced && (
                // Reduced motion: nothing plays by itself; Listen steps the question through as it is said.
                <button
                  type="button"
                  onClick={toggleListen}
                  aria-label={listening ? KB_SOUND.pause : KB_SOUND.listen}
                  className="pp-shadow-btn relative grid size-9 shrink-0 place-items-center rounded-full bg-white text-pp-ink transition-colors before:absolute before:-inset-1 before:rounded-full hover:bg-pp-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink"
                >
                  {listening ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
                </button>
              )}
              {!reduce && (
                <button
                  type="button"
                  onClick={toggle}
                  aria-label={step === DONE && !autoplay ? ROOM.replay : paused ? ROOM.play : ROOM.pause}
                  className="pp-shadow-btn grid size-9 shrink-0 place-items-center rounded-full bg-white text-pp-ink transition-colors hover:bg-pp-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink"
                >
                  {step === DONE && !autoplay ? (
                    <RotateCcw className="size-4" />
                  ) : paused ? (
                    <Play className="size-4 fill-current" />
                  ) : (
                    <Pause className="size-4 fill-current" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* The questions; the one playing carries its progress. */}
      <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-start">
        <p className="shrink-0 text-[12px] leading-4 text-pp-muted md:pt-2.5 md:pr-2">{ROOM.pick}</p>
        <div
          role="group"
          aria-label={ROOM.pick}
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] md:flex-wrap md:overflow-visible"
        >
          {questions.map((x, i) => {
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
                {x.ask}
                {on && autoplay && !reduce && (
                  <span
                    aria-hidden
                    key={`${x.id}-${index}`}
                    className="absolute inset-x-3 bottom-1 h-px origin-left bg-white/60"
                    style={{
                      transform: `scaleX(${shown / DONE})`,
                      transition: "transform 600ms ease-out",
                    }}
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

function StatusPill({ tone, label }: { tone: "idle" | "busy" | "found" | "missing"; label: string }) {
  return (
    // A fixed width, so the pill doesn't resize (and nudge the page) as its words change.
    <p className="flex h-8 w-[216px] items-center justify-center gap-2 rounded-full bg-white px-3 text-[12px] leading-4 shadow-[0_0_0_1px_rgb(24_16_40/0.08)]">
      <span className="relative grid size-2 place-items-center">
        {tone === "busy" && <span className="absolute inset-0 animate-ping rounded-full bg-[#551a89]/40" />}
        <span
          className={cn(
            "relative size-2 rounded-full transition-colors duration-300",
            tone === "idle" && "bg-pp-ink/40",
            tone === "busy" && "bg-[#551a89]",
            tone === "found" && "bg-[#1f8a55]",
            tone === "missing" && "bg-[#e0663a]",
          )}
        />
      </span>
      <span key={label} className="animate-in fade-in-0 duration-300">
        {label}
      </span>
    </p>
  );
}

/** The page the answer came from, with its answering line marked. */
function Page({ doc, line, open, reduce }: { doc: KbDoc | null; line: number; open: boolean; reduce: boolean }) {
  return (
    <div className="relative mt-6 h-[164px] w-full max-w-[400px] lg:mt-8">
      {/* Before anything is found: a sheet still being read. */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 flex flex-col gap-2.5 rounded-2xl border border-dashed border-pp-hair p-4 transition-opacity duration-500",
          open ? "opacity-0" : "opacity-100",
        )}
      >
        {[70, 88, 56, 80].map((w, i) => (
          <span key={i} className="block h-2 rounded-full bg-pp-ink/[0.05]" style={{ width: `${w}%` }} />
        ))}
      </div>

      {doc ? (
        <div
          className={cn(
            "absolute inset-0 rounded-2xl bg-white p-4 shadow-[0_0_0_1px_rgb(24_16_40/0.06),0_18px_40px_-22px_rgb(24_16_40/0.4)] transition-[opacity,translate] duration-500",
            open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
          )}
        >
          <p className="flex items-center gap-2 text-[12px] leading-4 text-pp-muted">
            <DocBadge kind={doc.kind} small />
            <span className="truncate text-pp-ink">{doc.name}</span>
          </p>
          <ul className="mt-3 flex flex-col gap-1">
            {doc.lines.map((l, i) => {
              const hit = i === line;
              return (
                <li key={i} className="relative rounded-md px-2 py-1 text-[13px] leading-[18px]">
                  <span
                    aria-hidden
                    className="absolute inset-0 origin-left rounded-md bg-[#551a89]/10"
                    style={{
                      transform: `scaleX(${open && hit ? 1 : 0})`,
                      transition: reduce ? "none" : "transform 600ms cubic-bezier(0.2, 0.8, 0.2, 1) 350ms",
                    }}
                  />
                  <span className={cn("relative", hit ? "text-[#3d1266]" : "text-pp-muted")}>{l}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div
          className={cn(
            "absolute inset-0 grid place-items-center rounded-2xl border border-dashed border-[#e0663a]/50 bg-white/40 p-4 text-center transition-opacity duration-500",
            open ? "opacity-100" : "opacity-0",
          )}
        >
          <p className="max-w-[240px] text-[13px] leading-[18px] text-pp-muted">
            <span className="block text-pp-ink">{ROOM.status.missing}</span>
            None of the five comes close enough to answer from.
          </p>
        </div>
      )}
    </div>
  );
}

function Bubble({
  who,
  label,
  text,
  live,
  said,
  mark = false,
}: {
  who: "client" | "agent";
  label: string;
  text: string;
  live: boolean;
  /** Spoken: how many of its words have been said; each shows as it is. */
  said?: number;
  /** Listen (reduced motion): a still mark on the line being said. */
  mark?: boolean;
}) {
  return (
    <li
      className={cn(
        "flex max-w-[92%] flex-col gap-1 animate-in fade-in-0 slide-in-from-bottom-2 duration-500",
        who === "client" ? "self-end items-end" : "self-start items-start",
      )}
    >
      <span className="text-[11px] leading-4 text-pp-muted">{label}</span>
      <span
        className={cn(
          "rounded-[16px] px-3.5 py-2.5 text-[14px] leading-5",
          who === "client" ? "bg-pp-ink text-white" : "bg-white text-pp-ink shadow-[0_0_0_1px_rgb(24_16_40/0.08)]",
          mark && "outline-2 outline-offset-2 outline-[#551a89]/60",
        )}
      >
        <Words text={text} live={live} said={said} />
      </span>
    </li>
  );
}

/** A spoken word fades in over this long from the moment it is said. */
const SAID_FADE_S = 0.12;

/** Sets each `[data-said-word]` span's opacity from the clock: hidden until its word is said, then a short fade. */
function showSaid(words: readonly HTMLElement[], turn: CueTurn, t: number) {
  words.forEach((w, i) => {
    const at = turn.words[i]?.[1] ?? Infinity;
    const o = Math.min(1, Math.max(0, (t - at) / SAID_FADE_S));
    const v = String(Math.round(o * 1000) / 1000);
    if (w.style.opacity !== v) w.style.opacity = v;
  });
}

/**
 * The line being spoken arrives a word at a time; settled lines are plain
 * text. Read-paced, 70ms apart; spoken (`said`), each word as the audio's
 * clock reaches it: the frame loop sets their opacity (showSaid), so they
 * start hidden and React never writes it again.
 */
function Words({ text, live, said }: { text: string; live: boolean; said?: number }) {
  if (said !== undefined) {
    return (
      <>
        {text.split(" ").map((w, i) => (
          <span key={i} data-said-word="" style={{ opacity: 0 }}>
            {w}{" "}
          </span>
        ))}
      </>
    );
  }
  if (!live) return <>{text}</>;
  return (
    <>
      {text.split(" ").map((w, i) => (
        <span
          key={i}
          className="animate-in fade-in-0 fill-mode-both duration-300"
          style={{ animationDelay: `${i * 70}ms` } as CSSProperties}
        >
          {w}{" "}
        </span>
      ))}
    </>
  );
}
