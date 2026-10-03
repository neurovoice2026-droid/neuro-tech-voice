"use client";

import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import { Pause, Play, RotateCcw } from "lucide-react";
import { AGENTS_HERO, REEL, spokenLines, type ReelScene, type SpokenLine } from "@/lib/pages/ai-agents";
import { cueIn, lazyCues, type Cue } from "@/lib/audio";
import { AUTH } from "@/lib/site";
import { cn } from "@/lib/utils";
import { envelopeAt, turnAt } from "@/components/site/audio/cue";
import { isSoundOn, unlockFromGesture } from "@/components/site/audio/engine";
import { SoundButton } from "@/components/site/audio/sound-button";
import { useLazyCues } from "@/components/site/audio/use-lazy-cues";
import { useSounding, useVoiceTrack } from "@/components/site/audio/use-voice-track";
import { IntentLink } from "@/components/site/intent-link";
import { Orb, PillLink, SectionTitle } from "../primitives";
import { gradientPoster, NeatBackdrop, paletteByLuma, SCENE_GRADIENTS } from "./neat-backdrop";
import { holdFor, useInView, usePrefersReducedMotion } from "../timing";

/* ------------------------------------------------------------------ *
 * The cover of the page: a centred headline over a hand of four calls.
 *
 * The calls are dealt as a fan of cards, each lit like a room at the hour
 * its call comes in. Pointing at one lifts it out of the hand and parts
 * its neighbours; choosing it brings it to the front, where it plays its
 * conversation through to what the agent did about it. The hand plays
 * itself card by card until the visitor picks one.
 *
 * The hand is dealt from lg up, shrunk to fit narrower screens down to
 * that; below it the open card stands alone, with the others as chips.
 *
 * Sound. Each call has generated audio (AI-generated voices,
 * lib/audio/cues/agents-hero-reel.json). Nothing plays until the visitor
 * turns sound on with the control under the hand. From then on a call
 * that starts is played on its audio's clock: each line comes up as it is
 * said, its words as they are spoken, and the outcome once the last line
 * is done; pointing at a card no longer swaps the open one. Sound turned
 * on mid-call starts the open call again, spoken; turned off, the call
 * finishes on the same clock in silence and the next one is read-paced.
 * With reduced motion nothing plays by itself: the transport is "Listen".
 * ------------------------------------------------------------------ */

/** The stage's claim on the site's one sound (components/site/audio/engine.ts). */
const VOICE_ID = "agents-hero";

type SpokenScene = { cue: Cue; lines: SpokenLine[] };

/**
 * Each call's audio, where its cue speaks every line of the card as shown.
 * P0: the cue file (a few KB of timings) is fetched as sound goes on, never
 * in the page's first load. A call without one stays read-paced.
 */
const SPOKEN = lazyCues(
  "agents-hero-reel",
  (file): Partial<Record<string, SpokenScene>> =>
    Object.fromEntries(
      REEL.scenes.map((s) => {
        const cue = cueIn(file, `agents-hero-reel/${s.id}`);
        const lines = spokenLines(cue, s.turns);
        return [s.id, cue && lines ? { cue, lines } : undefined];
      }),
    ),
);

/**
 * The card's step at cue time `t` on a spoken run: how many lines have
 * started (0 before the first), and `lines + 1` once the last line has
 * been said, which brings the outcome up.
 */
export function reelStepAt(sp: SpokenScene, t: number) {
  const n = sp.lines.length;
  if (t >= sp.lines[n - 1].end) return n + 1;
  let s = 0;
  while (s < n && sp.lines[s].start <= t) s++;
  return s;
}

/** Spoken: how far the open card's orb swells at the agent's loudest (its read-paced talk loop peaks at 1.035). */
const ORB_SWELL = 0.06;
/** The envelope's speech range (about 0.35 to 0.8) as 0..1. */
const level = (env: number) => Math.min(1, Math.max(0, (env - 0.35) / 0.45));

/** Card size and the distance between card centres in the fan, in px. */
const CARD = { w: 440, h: 548 };
const SLOT = 236;

/**
 * How far the fan is shrunk: 1 wherever the column is 1180px or wider,
 * proportionally less below. `tan(atan2(a, b))` is a/b as a plain number —
 * CSS will not divide one length by another directly — so the fan sizes
 * in the first paint, with no measuring script and no jump.
 */
const DECK_SCALE = "min(1, tan(atan2(100vw - 5rem, 1180px)))";

const spring = { type: "spring", stiffness: 170, damping: 22, mass: 0.9 } as const;

/** Where card `i` sits in a hand of `n`, when card `focus` is the one held up. */
function fan(i: number, focus: number, n: number) {
  const off = i - (n - 1) / 2;
  const d = i - focus;
  const part = d === 0 ? 0 : Math.sign(d) * (54 - (Math.min(Math.abs(d), 3) - 1) * 14);
  return {
    x: off * SLOT + part,
    y: Math.abs(off) * 24 + (d === 0 ? -28 : 0),
    rotate: d === 0 ? 0 : off * 3.4 + Math.sign(d) * 1.6,
    scale: d === 0 ? 1.03 : 0.94,
    zIndex: 20 - Math.abs(d),
  };
}

export function AgentsHero() {
  return (
    <section className="mx-auto w-[calc(100%-2rem)] max-w-[1176px] pt-28 sm:w-[calc(100%-3rem)] md:pt-[148px] lg:w-[calc(100%-5rem)]">
      <div className="mx-auto flex max-w-[820px] flex-col items-center text-center">
        <SectionTitle as="h1" className="max-w-[760px]">
          {AGENTS_HERO.title}
        </SectionTitle>
        <p className="mt-5 max-w-[600px] text-base leading-6 tracking-[0.01em] text-pp-ink/80 md:text-[17px] md:leading-[26px]">
          {AGENTS_HERO.sub}
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          <PillLink href={AGENTS_HERO.primary.href}>{AGENTS_HERO.primary.label}</PillLink>
          <PillLink href={AGENTS_HERO.secondary.href} variant="secondary">
            {AGENTS_HERO.secondary.label}
          </PillLink>
        </div>
        <p className="mt-3 text-[13px] leading-[18px] text-pp-muted">{AGENTS_HERO.note}</p>
      </div>

      <Hand />
    </section>
  );
}

function Hand() {
  const scenes = REEL.scenes;
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef);
  // The voice needs the reel well on screen, not a sliver of it at an edge:
  // a call it starts must be one the visitor can see.
  const voiceView = useInView(rootRef, "-15% 0px");
  const reduce = usePrefersReducedMotion();

  const [active, setActive] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  /** Turns shown so far; `turns.length + 1` means the outcome is up too. */
  const [step, setStep] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const [paused, setPaused] = useState(false);
  /** This run plays on its audio's clock (sound was on when it started). */
  const [spoken, setSpoken] = useState(false);
  /** Counts spoken runs, so a new one of the same call restarts the clock's frame loop. */
  const [runId, setRunId] = useState(0);
  /** Reduced motion: the Listen transport's state, and the lines said so far. */
  const [listen, setListen] = useState<{ state: "playing" | "paused"; shown: number } | null>(null);

  const track = useVoiceTrack(VOICE_ID, { active: voiceView });
  const sounding = useSounding();
  const trackRef = useRef(track);
  const stepRef = useRef(step);
  useEffect(() => {
    trackRef.current = track;
    stepRef.current = step;
  });
  /** The spoken run's clock (cue seconds), for a line to read as it comes up. */
  const clock = useCallback(() => trackRef.current.time(), []);

  const scene = scenes[active];
  /** The calls' audio, once its timings are here (fetched as sound goes on). */
  const spokenAll = useLazyCues(SPOKEN, track.on);
  const sp = spokenAll?.[scene.id];
  const done = step > scene.turns.length;
  // A spoken run plays while the voice may (well on screen); a read-paced one as it always has.
  const running = (spoken ? voiceView : inView) && !paused && !reduce;
  const soundOn = track.on;

  /** The call after `i`, whose file is fetched while this one plays. */
  const nextSrc = (i: number) => SPOKEN.get()?.[scenes[(i + 1) % scenes.length].id]?.cue.src;
  /** Bumped by every run asked for: one waiting for the calls' timings starts only if it is still the last. */
  const cueWait = useRef(0);

  /**
   * Starts call `i` at its first line: on its audio's clock when sound is
   * on and it has audio (from its ring, if the track has one), otherwise
   * read-paced. `press` is the visitor's own choice, which takes the
   * sound from any other stage.
   */
  const startRun = (i: number, press: boolean, waited = false) => {
    // Sound on, and the calls' timings not here yet: the run starts once they are (a moment). A
    // press asks again for timings that could not be fetched before (once: then it reads on).
    const ask = ++cueWait.current;
    if (isSoundOn() && !waited && (!SPOKEN.settled() || (press && !SPOKEN.get()))) {
      void SPOKEN.load().then(() => {
        if (ask === cueWait.current) startLater.current(i, press, true);
      });
      return;
    }
    const voice = SPOKEN.get()?.[scenes[i].id];
    // Nothing starts a voice by itself under reduced motion or the still tier (the hook refuses it too).
    const speak = !!voice && isSoundOn() && (press || !trackRef.current.listen);
    setSpoken(speak);
    if (!speak) {
      trackRef.current.pause();
      setStep(1);
      return;
    }
    // From the top of the file: the first line comes up when the audio's clock reaches it, not before the audio has started.
    const from = 0;
    setRunId((r) => r + 1);
    setStep(reelStepAt(voice, from));
    trackRef.current.play(voice.cue, from, { press, next: nextSrc(i) });
  };
  const startLater = useRef(startRun);
  useLayoutEffect(() => {
    startLater.current = startRun;
  });
  /** The lead-in is over: the run starts, spoken or read-paced. */
  const beginRun = useEffectEvent((i: number) => startRun(i, false));

  useEffect(() => {
    if (!running) return;
    const n = scene.turns.length;
    // A spoken run's lines follow the audio's clock (below); only the lead-in and the outcome are timed here.
    if (spoken && step <= n) return;
    let delay: number;
    if (step === 0) delay = 800;
    else if (step <= n) delay = holdFor(scene.turns[step - 1].t);
    // While a card is under the pointer it stays up, outcome showing.
    else if (autoplay && hover === null) delay = 2600;
    else return;

    const id = window.setTimeout(() => {
      // The lead-in is over: startRun puts the first line up (or leaves it to the audio's clock).
      if (step === 0) beginRun(active);
      else if (step <= n) setStep(step + 1);
      else {
        setActive((active + 1) % scenes.length);
        setStep(0);
        setSpoken(false);
      }
    }, delay);
    return () => window.clearTimeout(id);
  }, [running, step, active, autoplay, hover, scene, scenes.length, spoken]);

  // A spoken run: the lines come up as the audio's clock reaches them, and the outcome once the last is said.
  useEffect(() => {
    if (!spoken || !running || !sp) return;
    const n = sp.lines.length;
    let raf = 0;
    const frame = () => {
      const s = reelStepAt(sp, trackRef.current.time());
      setStep((prev) => (prev === s || prev > n ? prev : s));
      if (s <= n) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [spoken, running, sp, runId]);

  // Back on screen (or unpaused) mid-call: the audio carries on from where it stopped.
  useEffect(() => {
    if (!spoken || !running || !sp) return;
    if (stepRef.current > sp.lines.length || trackRef.current.time() >= sp.cue.dur) return;
    trackRef.current.play(sp.cue);
  }, [spoken, running, sp]);

  // Listen (reduced motion): lines swap in whole as they are said; the card reads complete again at the end.
  const listening = listen?.state === "playing";
  // Off screen, the hook pauses the voice: the transport says Listen again, and a press carries on.
  const listenAway = useEffectEvent(() => setListen((l) => (l?.state === "playing" ? { ...l, state: "paused" } : l)));
  useEffect(() => {
    if (!voiceView) listenAway();
  }, [voiceView]);
  useEffect(() => {
    if (!listening || !sp) return;
    const n = sp.lines.length;
    let raf = 0;
    const frame = () => {
      const t = trackRef.current.time();
      if (t >= sp.cue.dur) {
        setListen(null);
        return;
      }
      const shown = Math.min(n, reelStepAt(sp, t));
      setListen((l) => (l && l.shown !== shown ? { ...l, shown } : l));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [listening, sp]);

  /** A press (Listen, or the sound control) made before the calls' timings had arrived: answered when they do. */
  const pendingPress = useRef<"listen" | "sound" | null>(null);
  /** Stops a Listen in progress (another card was chosen). */
  const stopListen = () => {
    pendingPress.current = null;
    if (!listen) return;
    trackRef.current.pause();
    setListen(null);
  };

  // Reduced motion: no clock at all, the open card simply reads complete.
  const shown = reduce ? (listen ? listen.shown : scene.turns.length + 1) : step;
  // With sound on, pointing at a card never swaps the open one, so it never lifts in its place either.
  const focus = soundOn ? active : (hover ?? active);
  /** A voice is sounding (this stage's or another's): no per-line announcements over it. */
  const quiet = track.audible || sounding;

  const open = (i: number) => {
    setAutoplay(false);
    setPaused(false);
    if (i === active) return;
    stopListen();
    setActive(i);
    setStep(1);
    if (!reduce) startRun(i, true);
  };

  // Pointing at a card plays its call on it straight away, first line up.
  // Not with sound on: a hover never starts a voice.
  const preview = (i: number) => {
    setHover(i);
    if (i === active || isSoundOn()) return;
    stopListen();
    setPaused(false);
    setActive(i);
    setStep(1);
    if (!reduce) startRun(i, false);
  };

  const toggle = () => {
    if (reduce) {
      // Listen: plays the open call's audio, and turns sound on (the press unlocks it).
      if (!sp) {
        // Here, but without this call: nothing to say.
        if (SPOKEN.get()) return;
        // The calls' timings aren't here yet (or could not be fetched, and are asked for again): sound
        // goes on in this press, and Listen starts when they arrive.
        unlockFromGesture();
        pendingPress.current = "listen";
        void SPOKEN.load();
        return;
      }
      if (listen?.state === "playing") {
        trackRef.current.pause();
        setListen({ ...listen, state: "paused" });
        return;
      }
      trackRef.current.play(sp.cue, listen ? undefined : 0, { press: true, unlock: true });
      setListen({ state: "playing", shown: listen?.shown ?? 0 });
      return;
    }
    if (done && !autoplay) {
      setPaused(false);
      if (sp && isSoundOn()) {
        startRun(active, true);
      } else {
        setStep(0);
        setSpoken(false);
      }
      return;
    }
    setPaused((p) => !p);
    if (spoken && sp) {
      if (!paused) trackRef.current.pause();
      else if (step <= sp.lines.length) trackRef.current.play(sp.cue, undefined, { press: true });
    }
  };

  // Sound turned on here: the open call starts again from its first line, spoken (Listen, with reduced motion).
  const onSound = (on: boolean) => {
    if (!on) return;
    if (!sp) {
      // The calls' timings are on their way (sound went on in this press, or a fetch that failed is
      // asked for again): answered once they are here.
      if (!SPOKEN.get()) {
        pendingPress.current = "sound";
        void SPOKEN.load();
      }
      return;
    }
    if (reduce) {
      trackRef.current.play(sp.cue, 0, { press: true });
      setListen({ state: "playing", shown: 0 });
      return;
    }
    setPaused(false);
    startRun(active, true);
  };

  // The calls' timings have arrived: a press made while they were on their way is answered now.
  const answerPending = useEffectEvent(() => {
    const press = pendingPress.current;
    pendingPress.current = null;
    if (!press || !sp || !isSoundOn()) return;
    if (press === "sound") return onSound(true);
    trackRef.current.play(sp.cue, 0, { press: true });
    setListen({ state: "playing", shown: 0 });
  });
  useEffect(() => {
    if (sp) answerPending();
  }, [sp]);

  return (
    <div ref={rootRef} className="mt-10 max-lg:mx-auto max-lg:max-w-[560px] md:mt-12">
      <div
        role="group"
        aria-roledescription="carousel"
        aria-label={REEL.kicker}
        onPointerLeave={() => setHover(null)}
        style={{ "--deck": DECK_SCALE } as CSSProperties}
        className="relative lg:h-[calc(640px*var(--deck))]"
      >
        <div className="lg:absolute lg:inset-x-0 lg:top-0 lg:h-[640px] lg:origin-top lg:[scale:var(--deck)]">
          {scenes.map((s, i) => {
            const isOpen = i === active;
            const place = fan(i, focus, scenes.length);
            return (
              <motion.div
                key={s.id}
                initial={false}
                animate={{ x: place.x, y: place.y, rotate: place.rotate, scale: place.scale }}
                transition={reduce ? { duration: 0 } : spring}
                onPointerEnter={(e) => {
                  if (e.pointerType === "mouse") preview(i);
                }}
                style={{ zIndex: place.zIndex, transformOrigin: "50% 115%", width: CARD.w, height: CARD.h }}
                className={cn(
                  "overflow-hidden rounded-[28px] shadow-[0_30px_60px_-30px_rgb(24_16_40/0.55),0_0_0_1px_rgb(255_255_255/0.06)]",
                  // Desktop: dealt from the middle of the stage. Smaller screens:
                  // the open card alone, full width, no fan.
                  "lg:absolute lg:top-6 lg:left-1/2 lg:-ml-[220px]",
                  "max-lg:relative max-lg:h-[480px]! max-lg:w-full! max-lg:transform-none!",
                  !isOpen && "max-lg:hidden",
                )}
              >
                <Light scene={s} />

                {isOpen ? (
                  <OpenCard
                    key={s.id}
                    scene={s}
                    shown={shown}
                    onToggle={toggle}
                    paused={paused || reduce}
                    done={done && !autoplay}
                    progress={autoplay && !reduce ? { index: i, count: scenes.length } : null}
                    spoken={spoken && !reduce ? sp?.lines : undefined}
                    voice={spoken && !reduce ? sp?.cue : undefined}
                    running={running}
                    clock={clock}
                    // Before its timings are here (sound off, or a fetch that failed), every call is
                    // offered: each has its audio, and a press asks for the timings again.
                    listen={
                      reduce && (sp || !spokenAll)
                        ? { playing: listening, current: listen ? listen.shown - 1 : -1 }
                        : null
                    }
                    quiet={quiet}
                  />
                ) : (
                  <ClosedCard
                    scene={s}
                    lifted={hover === i}
                    // A card under the hand shows only the edge beside the held
                    // card, so its content hugs that edge.
                    side={i > focus ? "right" : "left"}
                    onOpen={() => open(i)}
                  />
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Below lg the hand is one card wide; these pick the others. */}
      <div className="mt-3 grid grid-cols-2 gap-2 lg:hidden">
        {scenes.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => open(i)}
            aria-pressed={i === active}
            className={cn(
              "tap-44 relative h-10 rounded-full px-3 text-[13px] transition-colors",
              i === active ? "bg-pp-ink text-white" : "bg-pp-card text-pp-ink",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex justify-center lg:mt-6">
        <SoundButton variant="pill" tone="light" onChange={onSound} />
      </div>
      {soundOn && (
        // With this stage's own lines voiced, its outcome is still announced: only when this stage holds the
        // sound, never because another stage's voice started (that would announce it over that voice).
        <p className="sr-only" aria-live="polite">
          {track.audible && shown > scene.turns.length ? scene.outcome : ""}
        </p>
      )}
    </div>
  );
}

/** The orb takes its colours from the card it sits on. */
function orbMesh(scene: ReelScene) {
  const gradient = SCENE_GRADIENTS[scene.id];
  return gradient ? paletteByLuma(gradient) : undefined;
}

/** The room the call happens in: a Neat gradient, or three lights and grain. */
function Light({ scene }: { scene: ReelScene }) {
  const gradient = SCENE_GRADIENTS[scene.id];
  if (gradient) {
    return (
      <div aria-hidden className="absolute inset-0" style={{ background: gradientPoster(gradient) }}>
        <NeatBackdrop config={gradient} />
      </div>
    );
  }

  const [shadow, body, highlight] = scene.light;
  return (
    <div
      aria-hidden
      className="absolute inset-0"
      style={{
        background: `radial-gradient(120% 90% at 78% 12%, ${highlight}cc 0%, transparent 42%),
          radial-gradient(90% 80% at 18% 100%, ${body} 0%, transparent 70%),
          ${shadow}`,
      }}
    >
      <div className="pp-grain absolute inset-0 opacity-40" />
    </div>
  );
}

function CardHeader({ scene }: { scene: ReelScene }) {
  return (
    <div className="flex items-start justify-between gap-3 p-5">
      <p className="pp-display text-[21px] leading-[26px] text-white" style={{ fontWeight: 480 }}>
        {scene.label}
      </p>
      <span className="shrink-0 rounded-full bg-black/25 px-2.5 py-1 text-[11px] leading-4 text-white/85 backdrop-blur-md">
        {scene.time}
      </span>
    </div>
  );
}

/** A card still in the hand: what the call is, and what came of it. */
function ClosedCard({
  scene,
  lifted,
  side,
  onOpen,
}: {
  scene: ReelScene;
  lifted: boolean;
  side: "left" | "right";
  onOpen: () => void;
}) {
  const right = side === "right";
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group absolute inset-0 flex flex-col p-5 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white",
        right ? "items-end text-right" : "items-start text-left",
      )}
    >
      <span className={cn("flex w-[200px] flex-col gap-1.5", right ? "items-end" : "items-start")}>
        <span className="rounded-full bg-black/25 px-2.5 py-1 text-[11px] leading-4 text-white/85 backdrop-blur-md">
          {scene.time}
        </span>
        <span className="pp-display text-[21px] leading-[26px] text-white" style={{ fontWeight: 480 }}>
          {scene.label}
        </span>
      </span>

      <span className={cn("flex w-[200px] flex-1 items-center", right ? "justify-end pr-10" : "justify-start pl-10")}>
        <Orb
          mesh={orbMesh(scene)}
          className={cn(
            "size-24 transition-[scale,opacity] duration-500",
            lifted ? "scale-110 opacity-100" : "opacity-80",
          )}
        />
      </span>

      <span className={cn("flex w-[200px] flex-col gap-3", right ? "items-end" : "items-start")}>
        <span
          className={cn(
            "rounded-full bg-white px-3 py-1.5 text-[12px] leading-4 text-pp-ink transition-[opacity,translate] duration-300",
            lifted ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
          )}
        >
          {REEL.pick}
        </span>
        <span className={cn("flex items-start gap-2 text-[13px] leading-[18px] text-white/85", right && "flex-row-reverse")}>
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#7ee2a8]" />
          {scene.outcome}
        </span>
      </span>
    </button>
  );
}

/** The card held up: the call, played. */
function OpenCard({
  scene,
  shown,
  paused,
  done,
  progress,
  onToggle,
  spoken,
  voice,
  running,
  clock,
  listen,
  quiet,
}: {
  scene: ReelScene;
  shown: number;
  paused: boolean;
  done: boolean;
  progress: { index: number; count: number } | null;
  onToggle: () => void;
  /** A spoken run: each line's word times, so the newest line's words land as they are said. */
  spoken?: SpokenLine[];
  /** A spoken run: its audio, whose loudness the orb follows while the agent speaks. */
  voice?: Cue;
  /** The run's clock can move (on screen, not paused): the frame loops run only then. */
  running: boolean;
  /** A spoken run: the audio's clock (cue seconds), read as a line comes up. */
  clock?: () => number;
  /** Reduced motion: the transport is Listen; `current` is the line being said (-1 for none). */
  listen: { playing: boolean; current: number } | null;
  /** The lines are being voiced: the list stops announcing each one. */
  quiet: boolean;
}) {
  const said = Math.min(shown, scene.turns.length);
  const turns = scene.turns.slice(0, said);
  const last = turns[turns.length - 1];
  // The card holds three lines and the outcome; older lines fall away.
  const from = Math.max(0, said - 3);
  // Read-paced, the orb runs its talk loop while the agent's line is the newest. Spoken, it follows
  // the voice itself instead (below): swelling with the agent's loudness, still through the silences.
  const speaking = !voice && !!last && last.sp === "agent" && shown <= scene.turns.length && !paused;
  const outcome = shown > scene.turns.length;
  const orbBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const orb = orbBox.current?.querySelector<HTMLElement>(".pp-orb");
    if (!voice || !clock || !orb) return;
    const set = (scale: number | null) => {
      if (scale === null) {
        orb.style.removeProperty("transition");
        orb.style.removeProperty("scale");
        return;
      }
      orb.style.transition = "none";
      orb.style.scale = String(Math.round(scale * 1000) / 1000);
    };
    const at = (t: number) => {
      const turn = turnAt(voice, t);
      return turn && turn.sp === "agent" && t <= turn.end ? 1 + ORB_SWELL * level(envelopeAt(voice, t)) : 1;
    };
    // Paused or off screen, the clock stands still: the orb holds where it is, with no frame loop.
    set(at(clock()));
    if (!running) return () => set(null);
    let raf = 0;
    const frame = () => {
      const t = clock();
      if (t >= voice.dur) {
        set(null);
        return;
      }
      set(at(t));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      set(null);
    };
  }, [voice, clock, running]);

  return (
    <div className="absolute inset-0 flex flex-col animate-in fade-in-0 duration-300 fill-mode-backwards">
      {/* Backwards, not both: the fade ends on the card's own style, so
          holding that end looked the same and only kept the card on a
          composited layer (a filter animation "in effect") for good. */}
      <CardHeader scene={scene} />

      <div ref={orbBox} className="pointer-events-none flex justify-center pt-1">
        <Orb mesh={orbMesh(scene)} speaking={speaking} className="size-[96px] sm:size-[120px]" />
      </div>

      <ol aria-live={quiet ? "off" : "polite"} className="flex min-h-0 flex-1 flex-col justify-end gap-2 px-5 pt-4">
        {turns.slice(from).map((turn, j, shown) => (
          <li
            key={from + j}
            className={cn(
              "w-fit max-w-[88%] rounded-[16px] px-3 py-2 text-[13px] leading-[18px] animate-in slide-in-from-bottom-2 duration-500",
              // Read-paced, the bubble fades in; spoken, its words do, each on the audio's clock (Words).
              !spoken && "fade-in-0",
              turn.sp === "agent" ? "bg-white text-pp-ink" : "ml-auto bg-white/15 text-white backdrop-blur-md",
              // A phone-width card wraps every line twice over: two lines fit under the orb, not three.
              j === 0 && shown.length === 3 && "max-sm:hidden",
              // Listen: a still mark on the line being said.
              listen && from + j === listen.current && "outline-2 outline-offset-2 outline-white/80",
            )}
          >
            <Words
              text={turn.t}
              live={!listen && from + j === said - 1}
              at={spoken?.[from + j]?.words}
              since={spoken && clock ? () => clock() - spoken[from + j].start : undefined}
              running={running && !paused}
            />
          </li>
        ))}
        <li
          className={cn(
            "mt-1 flex w-fit items-center gap-2 rounded-full bg-black/35 px-3 py-1.5 text-[12px] leading-4 text-white backdrop-blur-md transition-[opacity,translate] duration-500",
            outcome ? "opacity-100" : "translate-y-1 opacity-0",
          )}
          aria-hidden={!outcome}
        >
          <span className="size-1.5 rounded-full bg-[#7ee2a8]" />
          {scene.outcome}
        </li>
      </ol>

      <div className="flex items-center justify-between gap-3 p-5">
        <IntentLink
          href={AUTH.signup}
          // lg: the held card is drawn at 0.83 at 1024px, so the tap is set 54px to come out at 44.
          className="tap-44 relative text-[13px] leading-[18px] text-white/80 underline-offset-4 transition-colors hover:text-white hover:underline lg:[--tap-half:27px]"
        >
          {scene.link} →
        </IntentLink>
        <button
          type="button"
          onClick={onToggle}
          aria-label={
            listen ? (listen.playing ? REEL.pause : REEL.listen) : done ? REEL.replay : paused ? REEL.play : REEL.pause
          }
          className={cn(
            "tap-44 relative grid size-9 shrink-0 place-items-center rounded-full bg-black/30 text-white backdrop-blur-md transition-colors hover:bg-black/50 focus-visible:outline-2 focus-visible:outline-white lg:[--tap-half:27px]",
            // Listen: a 44px tap around the 36px disc.
            listen && "relative before:absolute before:-inset-1 before:rounded-full",
          )}
        >
          {listen ? (
            listen.playing ? (
              <Pause className="size-4 fill-current" />
            ) : (
              <Play className="size-4 fill-current" />
            )
          ) : done ? (
            <RotateCcw className="size-4" />
          ) : paused ? (
            <Play className="size-4 fill-current" />
          ) : (
            <Pause className="size-4 fill-current" />
          )}
        </button>
      </div>

      {progress && (
        <div aria-hidden className="absolute inset-x-5 bottom-2 flex gap-1">
          {Array.from({ length: progress.count }, (_, i) => (
            <span
              key={i}
              className={cn("h-[2px] flex-1 rounded-full", i === progress.index ? "bg-white/80" : "bg-white/20")}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** A spoken word fades in over this long from the moment it is said. */
const SAID_FADE_S = 0.12;

/**
 * The newest line arrives a word at a time; older lines are already
 * settled. Read-paced, 45ms apart; spoken (`at`, `since`), each word as it
 * is said: every frame reads the audio's clock and sets each word's
 * opacity from it, so a slow start, a stall or a dropped frame never puts
 * a word up before its sound.
 */
function Words({
  text,
  live,
  at,
  since,
  running,
}: {
  text: string;
  live: boolean;
  at?: number[];
  since?: () => number;
  running: boolean;
}) {
  if (!live) return <>{text}</>;
  if (at && since) return <SaidWords text={text} at={at} since={since} running={running} />;
  return (
    <>
      {text.split(" ").map((w, i) => (
        // Backwards: hidden through its delay, then its own style once in (see the card above).
        <span
          key={i}
          className="animate-in fade-in-0 fill-mode-backwards duration-300"
          style={{ animationDelay: `${i * 45}ms` } as CSSProperties}
        >
          {w}{" "}
        </span>
      ))}
    </>
  );
}

/**
 * A spoken line's words, each shown from its start on the clock (`since`:
 * seconds since the line's start). Paused or off screen (`running` false)
 * the clock stands still: the words are set once, with no frame loop, and
 * the loop picks up again when it runs.
 */
function SaidWords({ text, at, since, running }: { text: string; at: number[]; since: () => number; running: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const sinceRef = useRef(since);
  useLayoutEffect(() => {
    sinceRef.current = since;
  });
  // Set before the first paint, then every frame until the last word is fully up.
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    const words = Array.from(box.children) as HTMLElement[];
    let raf = 0;
    const paint = () => {
      const t = sinceRef.current();
      let all = true;
      words.forEach((w, i) => {
        const o = Math.min(1, Math.max(0, (t - (at[i] ?? 0)) / SAID_FADE_S));
        if (o < 1) all = false;
        const v = o >= 1 ? "" : String(Math.round(o * 1000) / 1000);
        if (w.style.opacity !== v) w.style.opacity = v;
      });
      if (!all && running) raf = requestAnimationFrame(paint);
    };
    paint();
    return () => cancelAnimationFrame(raf);
  }, [at, running]);
  return (
    <span ref={ref} className="contents">
      {text.split(" ").map((w, i) => (
        <span key={i}>
          {w}{" "}
        </span>
      ))}
    </span>
  );
}
