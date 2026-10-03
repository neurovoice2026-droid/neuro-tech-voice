"use client";

import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cueIn, lazyCues } from "@/lib/audio";
import type { CueFile } from "@/lib/audio/cue-types";
import type { HOME } from "@/lib/pages/home";
import { cn } from "@/lib/utils";
import { envelopeAt } from "@/components/site/audio/cue";
import { isAudible, isSoundOn, unlockFromGesture } from "@/components/site/audio/engine";
import { SoundButton } from "@/components/site/audio/sound-button";
import { useVoiceTrack } from "@/components/site/audio/use-voice-track";
import { FluidOrb } from "@/components/site/product/fluid-orb";
import { DocBadge } from "@/components/site/product/knowledge-base/parts";
import { DOTS, LINE, useSvgId } from "@/components/site/product/line-figure";
import { useKitContext, type Kit } from "@/components/site/product/motion-kit";
import { useInView } from "@/components/site/product/timing";
import { ChipRail, RoundButton, centreInRail, useRovingRadio } from "./controls";
import { useDocumentVisible, useStageMotion } from "./motion";
import { SpokenClock, type RunClip, type RunVoice } from "./demo-script";
import { KB_MESH, MUTED_MESH } from "./palettes";
import { TYPE } from "./type";
import {
  ACCENT,
  BEAM_LOSE,
  BEAM_MISS,
  DIM,
  DOT,
  FILL_REST,
  FILL_WIN,
  SHEET_DIM,
  HOLD,
  STATUS_KEYS,
  TILE_LIFT,
  TILE_REST,
  VOL,
  addClear,
  addQuestion,
  beamStateFor,
  collect,
  finishedStatus,
  setBeams,
  setFrame,
  statusNow,
  winner,
  type BeamState,
  type Hooks,
  type Model,
  type Room,
  type Track,
  type Voiced,
} from "./knowledge-timeline";

/* ------------------------------------------------------------------ *
 * #knowledge, the stage: the knowledge base's reading room, set as a
 * funnel. Five documents across the top; beams fall from each to the
 * reader, one orb; the caller's question on its left, the page it found
 * on its right, the answer underneath.
 *
 * First view plays one question the documents answer, holds it, then
 * the one they don't — every bar stops short of its tick, the orb cools
 * to grey, and the agent says the owner's own fallback line — and stays
 * there. A question picked by hand plays once and holds.
 *
 * Without GSAP (the server's frame, reduced motion, before the kit
 * arrives) React draws the finished frame of one question; the question
 * chips switch that frame outright. Once GSAP is in charge, the parts it
 * moves are remounted (keyed by mode) so no style React drew for the
 * still frame ever fights a tween, and GSAP sets the same frame before
 * the first paint. The orb is outside those keys and is never remounted.
 *
 * Sound. Each question is recorded as two clips, the caller asking and
 * the agent answering (AI-generated voices; the cue file and the audio
 * are fetched only once sound is on). With sound on, a run is built on
 * them (knowledge-timeline.ts `voiced`) and played on the run's clock
 * (demo-script.ts SpokenClock), so the words rise as they are said, the
 * reading beat is silent, and the orb follows the agent's voice (the
 * miss at 40% of it, grey). Sound turned on mid-run restarts the question
 * under way on its recordings; turned off, the question finishes on the
 * same clock and the next one is read-paced. With reduced motion the
 * transport is Listen: the question on screen, asked and then answered,
 * each line coming up as it is said.
 * ------------------------------------------------------------------ */

type Kb = (typeof HOME)["kb"];

const LG = "(min-width: 1024px)";
/** Where a beam leaves its tile, and how far short of the orb it stops. */
const BEAM_GAP_TILE = 8;
const BEAM_GAP_ORB = 10;
/** The angle between neighbouring beams where they meet the orb. */
const BEAM_SPREAD = 15;

const BEAM_INK = "rgb(24 16 40 / 0.34)";
const RING = "shadow-[0_0_0_1px_rgb(24_16_40/0.07)]";

/** The stage's claim on the site's one sound (components/site/audio/engine.ts). */
const VOICE_ID = "knowledge";
/** Listen: the beat between the question and its answer. */
const LISTEN_GAP = 0.6;

/**
 * The questions' recordings. P0: their cue file (a few KB of timings) is
 * fetched as sound goes on, never in the page's first load. A run asked
 * for with sound on waits for it (a moment); without it (a failed fetch)
 * the run is read-paced.
 */
const KB_FILE = lazyCues("home-knowledge-call", (file: CueFile) => file);

/** A question's two recordings, when both exist (and their file is here). */
function voicedFor(id: string | undefined): Voiced | undefined {
  const file = KB_FILE.get();
  const ask = file && id ? cueIn(file, `home-kb/${id}/0`) : undefined;
  const answer = file && id ? cueIn(file, `home-kb/${id}/1`) : undefined;
  return ask && answer ? { ask, answer } : undefined;
}

/** Listen plays only a pair that speaks the two lines as written: one turn each, the same display words. */
function listenable(q: { id: string; ask: string; answer: string } | undefined): Voiced | undefined {
  const v = voicedFor(q?.id);
  const fits = (cue: Voiced["ask"], text: string) =>
    cue.dur > 0 && cue.turns.length === 1 && cue.turns[0].words.length === text.split(" ").length;
  return v && q && fits(v.ask, q.ask) && fits(v.answer, q.answer) ? v : undefined;
}

/** The orb's volume under a clip, off its loudness: it hears the caller, speaks the answer, and only murmurs the miss. */
function volOf(tag: string | undefined, level: number) {
  if (tag === "ask") return VOL.listen + 0.08 * level;
  if (tag === "miss") return Math.max(VOL.miss, 0.4 * level);
  return Math.min(0.85, 0.15 + 0.8 * level);
}

/** A run under way: its questions, and where each starts and finishes on its timeline. */
type Run = { ids: number[]; starts: number[]; ends: number[]; press: boolean; announce: boolean };

/** A Listen run (reduced motion): the question, and which of its two lines is being said. */
type Listen = { qi: number; part: "ask" | "answer"; running: boolean };

export function KnowledgeStage({
  room,
  questions,
  sequence,
  threshold,
  className,
}: {
  room: Kb["room"];
  questions: Kb["questions"];
  sequence: Kb["sequence"];
  threshold: number;
  className?: string;
}) {
  const model = useMemo<Model>(() => ({ docs: room.docs, questions }), [room.docs, questions]);
  const stageRef = useRef<HTMLDivElement>(null);
  const uid = useSvgId("kb");

  const { kit, reduce, playing, paused, setPaused, interacted, markInteracted, pinFocus } = useStageMotion(stageRef, {
    id: "knowledge",
  });
  const onScreen = useInView(stageRef);
  // Some of the stage is in the top third of the screen. Below lg the stage is taller than a phone's
  // screen, with the documents and the page they open under its fold when it takes the focus: its
  // first view waits for this, so the run is not over before the reader has scrolled down to it.
  const upScreen = useInView(stageRef, "0px 0px -65% 0px");
  const visible = useDocumentVisible();
  const animated = kit != null && !reduce;

  // The frame the server draws, and reduced motion keeps: the sequence's last question, the miss.
  const readyIndex = Math.max(0, questions.findIndex((q) => q.id === sequence[sequence.length - 1]));
  const [still, setStill] = useState(readyIndex);
  const [selected, setSelected] = useState(readyIndex);
  const [orbMuted, setOrbMuted] = useState(winner(model, readyIndex) < 0);
  const [done, setDone] = useState(false);
  /** A run has been built: until then nothing plays, and the transport offers Play. */
  const [begun, setBegun] = useState(false);
  const [beams, setBeamPaths] = useState<string[]>([]);

  const vol = useRef<number>(VOL.miss);
  const kitRef = useRef<Kit | null>(null);
  const roomRef = useRef<Room | null>(null);
  const tlRef = useRef<ReturnType<Kit["gsap"]["timeline"]> | null>(null);
  const beamRef = useRef<BeamState>(beamStateFor(model, readyIndex));
  const stillRef = useRef(still);
  const railRef = useRef<HTMLDivElement>(null);
  const railMoved = useRef(false);
  const started = useRef(false);
  const runRef = useRef(false);
  /** The run under way, as built; its clock while it runs on recordings (null: its timeline plays itself). */
  const runInfo = useRef<Run | null>(null);
  const spokenRef = useRef(false);
  const clockRef = useRef<SpokenClock | null>(null);
  const frames = useRef(0);
  /** The next resume was the reader's Play: it may take the sound back from another stage. */
  const pressResume = useRef(false);
  const [listen, setListen] = useState<Listen | null>(null);
  const listenClock = useRef<SpokenClock | null>(null);
  const listenLoop = useRef(0);
  /** Bumped by every Listen press (and its end): one waiting for the recordings' timings goes ahead only if it is still the last. */
  const listenWait = useRef(0);

  // An explicit pick plays even while another stage holds the focus.
  const run = playing || (interacted && onScreen && visible && !paused && !reduce);

  // The stage's voice: it may sound while the stage runs; a Listen run (reduced motion) while it is on screen.
  const track = useVoiceTrack(VOICE_ID, { active: reduce ? onScreen && visible : run });
  const trackRef = useRef(track);
  useLayoutEffect(() => {
    trackRef.current = track;
  });
  // The recordings' timings are fetched as sound goes on (here or on any other stage).
  const soundOn = track.on;
  useEffect(() => {
    if (soundOn) void KB_FILE.load();
  }, [soundOn]);
  /** Bumped by every run asked for: a run waiting for the recordings' timings goes ahead only if it is still the last. */
  const cueWait = useRef(0);
  const voiceApi = useMemo<RunVoice>(
    () => ({
      play: (cue, at, o) => trackRef.current.play(cue, at, o),
      pause: () => trackRef.current.pause(),
      time: () => trackRef.current.time(),
      audible: () => isAudible(VOICE_ID),
      waiting: () => trackRef.current.waiting(),
    }),
    [],
  );

  // A run on recordings: every frame the clock's time (the audio's while a clip is heard) is the
  // timeline's, and under a clip the orb's volume follows the recording's loudness.
  const stopFrames = useCallback(() => {
    cancelAnimationFrame(frames.current);
    frames.current = 0;
  }, []);
  const runFrames = useCallback(() => {
    if (frames.current) return;
    const frame = (now: number) => {
      frames.current = 0;
      const clock = clockRef.current;
      const tl = tlRef.current;
      if (!clock || !tl) return;
      const t = clock.tick(now);
      tl.time(Math.max(0, t));
      const at = clock.clipAt(t);
      if (at) vol.current = volOf(at.clip.tag, envelopeAt(at.clip.cue, at.at));
      if (clock.playing) frames.current = requestAnimationFrame(frame);
    };
    frames.current = requestAnimationFrame(frame);
  }, []);

  useEffect(() => {
    stillRef.current = still;
  }, [still]);

  useEffect(() => {
    runRef.current = run;
    const clock = clockRef.current;
    if (!clock) {
      tlRef.current?.paused(!run);
      return;
    }
    if (run) {
      clock.start(performance.now(), pressResume.current || undefined);
      runFrames();
    } else {
      clock.stop();
      stopFrames();
    }
    pressResume.current = false;
  }, [run, runFrames, stopFrames]);

  // Outside GSAP the orb's volume follows the still frame.
  useEffect(() => {
    if (!animated) vol.current = winner(model, still) < 0 ? VOL.miss : VOL.rest;
  }, [animated, still, model]);

  useKitContext(
    kit,
    ({ gsap, SplitText }) => {
      const stage = stageRef.current;
      if (reduce || !stage) return;
      const r = collect(stage, SplitText);
      const lg = window.matchMedia(LG).matches;
      // A frame the reader can already see is kept; one they can't yet
      // see is cleared, so the first thing they watch is the call.
      const box = stage.getBoundingClientRect();
      const seen = box.bottom > 0 && box.top < window.innerHeight;
      const at = seen ? stillRef.current : null;
      setFrame(gsap, r, model, at, lg);
      beamRef.current = beamStateFor(model, at);
      vol.current = at != null && winner(model, at) < 0 ? VOL.miss : VOL.rest;
      setOrbMuted(at != null && winner(model, at) < 0);
      roomRef.current = r;
      kitRef.current = { gsap, SplitText };
      return () => {
        tlRef.current?.kill();
        tlRef.current = null;
        clockRef.current?.stop();
        clockRef.current = null;
        runInfo.current = null;
        stopFrames();
        roomRef.current = null;
        kitRef.current = null;
      };
    },
    { scope: stageRef, dependencies: [reduce], revertOnUpdate: true },
  );

  const hooks = useMemo<Hooks>(() => ({ vol, setMuted: setOrbMuted, setSelected, beams: beamRef }), []);

  /**
   * Replaces whatever is playing with a fresh timeline built by `build`.
   * With sound on it is built on the recordings and runs on their clock
   * (the clock waits out `delay` itself); `press`: the reader asked.
   */
  const start = useCallback(
    (
      build: (tl: ReturnType<Kit["gsap"]["timeline"]>, r: Room, track: Track, lg: boolean, spoken: boolean) => RunClip[],
      delay = 0,
      press = false,
    ) => {
      const k = kitRef.current;
      const r = roomRef.current;
      if (!k || !r) return;
      setBegun(true);
      tlRef.current?.kill();
      clockRef.current?.stop();
      clockRef.current = null;
      stopFrames();
      const spoken = isSoundOn() && KB_FILE.get() !== null;
      const tl = k.gsap.timeline({ paused: true, delay, onComplete: () => setDone(true) });
      const clips = build(tl, r, { status: statusNow(k.gsap, r) }, window.matchMedia(LG).matches, spoken);
      tlRef.current = tl;
      spokenRef.current = spoken;
      if (!clips.length) {
        tl.paused(!runRef.current);
        return;
      }
      const clock = new SpokenClock(clips, tl.duration(), voiceApi, { press, from: -delay });
      clockRef.current = clock;
      if (runRef.current) {
        clock.start(performance.now());
        runFrames();
      }
    },
    [voiceApi, runFrames, stopFrames],
  );

  // As each question after the first starts: a run built with sound on while it is now off (or
  // the other way round) is rebuilt from that question for the sound as it is.
  const onBoundary = useRef<(n: number) => void>(() => {});

  /** Plays questions `ids` in turn, holding between them; the first view's sequence and a pick alike. */
  const playFrom = useCallback(
    (ids: number[], { delay = 0, press = false, announce = true }: { delay?: number; press?: boolean; announce?: boolean } = {}) => {
      // Sound on, and the recordings' timings not here yet: the run waits for them (a moment), the
      // one under way carrying on meanwhile. A newer run asked for drops it.
      const ask = ++cueWait.current;
      if (isSoundOn() && !KB_FILE.settled()) {
        void KB_FILE.load().then(() => {
          if (ask === cueWait.current) playLater.current(ids, { delay, press, announce });
        });
        return;
      }
      const info: Run = { ids, starts: [], ends: [], press, announce };
      runInfo.current = info;
      start(
        (tl, r, track, lg, spoken) => {
          const clips: RunClip[] = [];
          ids.forEach((qi, n) => {
            if (n > 0) {
              tl.to({}, { duration: HOLD });
              tl.call(() => onBoundary.current(n), [], tl.duration());
            }
            info.starts.push(tl.duration());
            addClear(tl, r, track, hooks);
            const voiced = spoken ? voicedFor(questions[qi]?.id) : undefined;
            clips.push(...addQuestion(tl, r, model, qi, track, hooks, { lg, announce, voiced }));
            info.ends.push(tl.duration());
          });
          return clips;
        },
        delay,
        press,
      );
    },
    [start, questions, hooks, model],
  );
  const playLater = useRef(playFrom);
  useLayoutEffect(() => {
    playLater.current = playFrom;
  });

  useLayoutEffect(() => {
    onBoundary.current = (n) => {
      const info = runInfo.current;
      if (!info || spokenRef.current === (isSoundOn() && KB_FILE.get() !== null)) return;
      // Once the timeline has finished the update it is in: the rebuild kills it.
      queueMicrotask(() => {
        if (runInfo.current === info) playFrom(info.ids.slice(n), { press: info.press, announce: info.announce });
      });
    };
  });

  const playSequence = useCallback(
    (delay = 0, press = false) => {
      const ids = sequence.map((id) => questions.findIndex((q) => q.id === id)).filter((i) => i >= 0);
      playFrom(ids, { delay, press, announce: true });
    },
    [playFrom, sequence, questions],
  );

  /** One question, picked: a press, so it may take the sound from another stage. */
  const playOne = useCallback((qi: number) => playFrom([qi], { press: true, announce: false }), [playFrom]);

  // First view: once the stage has the reader's attention, a beat, then the sequence. Below lg it also
  // waits for the stage to come up the screen; the transport's Play starts it wherever it is.
  useEffect(() => {
    if (!animated || !run || started.current) return;
    if (!upScreen && !window.matchMedia(LG).matches) return;
    started.current = true;
    playSequence(0.4);
  }, [animated, run, playSequence, upScreen]);

  // The question on the stage stays in sight on a rail that scrolls (the rail moves, never
  // the page): it opens on the checked chip, and follows the selection from then on.
  // Measured only once the stage is on screen: until then the Deferred box may not be laid out.
  useEffect(() => {
    const rail = railRef.current;
    if (!onScreen || !rail) return;
    const chip = rail.querySelectorAll<HTMLElement>("[role=radio]")[selected];
    if (chip && rail.scrollWidth > rail.clientWidth) centreInRail(rail, chip, reduce || !railMoved.current);
    railMoved.current = true;
  }, [selected, reduce, onScreen]);

  // Beams drawn in after GSAP took over (a window widened past lg) join the frame on screen.
  const hasBeams = beams.length > 0;
  useEffect(() => {
    const k = kitRef.current;
    const stage = stageRef.current;
    if (!animated || !hasBeams || !k || !stage) return;
    setBeams(k.gsap, stage, beamRef.current);
  }, [animated, hasBeams]);

  // The beams run between measured boxes, so they meet the tiles and the orb at any width from lg.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const mq = window.matchMedia(LG);
    let frame = 0;
    const measure = () => {
      frame = 0;
      if (!mq.matches) return;
      const s = stage.getBoundingClientRect();
      // The stage rises in slightly scaled (home-rise): measure in its own pixels.
      const k = s.width / (stage.offsetWidth || s.width) || 1;
      const orb = stage.querySelector<HTMLElement>("[data-kb-orb]");
      const slots = Array.from(stage.querySelectorAll<HTMLElement>("[data-kb-slot]"));
      if (!orb || slots.length === 0) return;
      const o = orb.getBoundingClientRect();
      const radius = o.width / 2 / k;
      const ox = (o.left - s.left) / k + radius;
      const oy = (o.top - s.top) / k + radius;
      const mid = (slots.length - 1) / 2;
      const f = (n: number) => n.toFixed(1);
      const next = slots.map((slot, i) => {
        const t = slot.getBoundingClientRect();
        const sx = (t.left - s.left + t.width / 2) / k;
        const sy = (t.bottom - s.top) / k + BEAM_GAP_TILE;
        const a = ((-90 + (i - mid) * BEAM_SPREAD) * Math.PI) / 180;
        const ex = ox + (radius + BEAM_GAP_ORB) * Math.cos(a);
        const ey = oy + (radius + BEAM_GAP_ORB) * Math.sin(a);
        const h = Math.max(24, ey - sy);
        // It leaves its tile straight down and arrives along the orb's radius.
        const c1y = sy + h * 0.6;
        const c2x = ex + Math.cos(a) * h * 0.55;
        const c2y = ey + Math.sin(a) * h * 0.55;
        return `M${f(sx)} ${f(sy)} C${f(sx)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(ex)} ${f(ey)}`;
      });
      setBeamPaths((prev) => (prev.length === next.length && prev.every((d, i) => d === next[i]) ? prev : next));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const ro = new ResizeObserver(schedule);
    ro.observe(stage);
    mq.addEventListener("change", schedule);
    return () => {
      ro.disconnect();
      mq.removeEventListener("change", schedule);
      cancelAnimationFrame(frame);
    };
  }, []);

  /* ─── Listen (reduced motion and the still tier) ─────────────────── *
   * Nothing plays by itself. Listen plays the question on screen: the
   * caller asks (the answer is not up yet), then the agent answers (the
   * answer comes up, the question steps back), with no motion. */
  const stopListenFrames = useCallback(() => {
    cancelAnimationFrame(listenLoop.current);
    listenLoop.current = 0;
  }, []);
  const endListen = useCallback(() => {
    listenWait.current++;
    listenClock.current?.stop();
    listenClock.current = null;
    stopListenFrames();
    setListen(null);
  }, [stopListenFrames]);
  const pauseListen = useCallback(() => {
    listenWait.current++;
    listenClock.current?.stop();
    stopListenFrames();
    setListen((l) => (l && l.running ? { ...l, running: false } : l));
  }, [stopListenFrames]);
  const runListenFrames = () => {
    if (listenLoop.current) return;
    const frame = (now: number) => {
      listenLoop.current = 0;
      const clock = listenClock.current;
      if (!clock) return;
      const t = clock.tick(now);
      if (clock.done) return endListen();
      const part = t >= clock.clips[1].at ? "answer" : "ask";
      setListen((l) => (l && l.part !== part ? { ...l, part } : l));
      if (clock.playing) listenLoop.current = requestAnimationFrame(frame);
    };
    listenLoop.current = requestAnimationFrame(frame);
  };
  /** Plays question `qi`, or carries on with the one paused; called inside the press. */
  const listenTo = (qi: number) => {
    const held = listenClock.current;
    if (held && listen?.qi === qi) {
      held.start(performance.now(), true);
      setListen({ ...listen, running: true });
      runListenFrames();
      return;
    }
    if (!KB_FILE.get()) {
      // The recordings' timings are on their way (sound went on in this press): it plays once they are here.
      const ask = ++listenWait.current;
      void KB_FILE.load().then((f) => {
        if (f && ask === listenWait.current) listenLater.current(qi);
      });
      return;
    }
    const v = listenable(questions[qi]);
    if (!v) return;
    endListen();
    const answerAt = v.ask.dur + LISTEN_GAP;
    const clock = new SpokenClock(
      [
        { at: 0, cue: v.ask, tag: "ask" },
        { at: answerAt, cue: v.answer, tag: "answer" },
      ],
      answerAt + v.answer.dur,
      voiceApi,
      { press: true },
    );
    listenClock.current = clock;
    setListen({ qi, part: "ask", running: true });
    clock.start(performance.now());
    runListenFrames();
  };
  const listenLater = useRef(listenTo);
  useLayoutEffect(() => {
    listenLater.current = listenTo;
  });
  const onListen = () => {
    if (listen?.running) return pauseListen();
    // The press is the gesture that lets audio play, and turns sound on for the visit.
    unlockFromGesture();
    listenTo(still);
  };
  useEffect(() => {
    if (!onScreen) pauseListen();
  }, [onScreen, pauseListen]);
  // The tab hidden mid-Listen: the hook lets the sound go, so the clock holds where it is. Back, the
  // line under way is said again from that second, as the stage's own run does.
  const onTab = useEffectEvent((shown: boolean) => {
    const clock = listenClock.current;
    if (!clock || !listen?.running) return;
    if (!shown) {
      clock.stop();
      stopListenFrames();
      return;
    }
    clock.start(performance.now(), true);
    runListenFrames();
  });
  useEffect(() => onTab(visible), [visible]);
  useEffect(() => {
    if (!reduce) endListen();
  }, [reduce, endListen]);
  useEffect(() => () => endListen(), [endListen]);

  /**
   * The sound control. On: the question under way starts again on its
   * recordings (the next one, once it has landed); at rest, what the
   * transport would replay. Off: the engine has already silenced the
   * stage, and the question finishes on its clock.
   */
  const onSound = (on: boolean) => {
    // This stage's own press: it takes the landing's focus, so it is the one that plays and is
    // heard, not the stage that happens to cover more of the screen (off: it lets it go).
    pinFocus(on);
    if (!on) return;
    if (reduce) return listenTo(still);
    // GSAP is not here yet: the first run will be built on the recordings.
    if (!animated || !kitRef.current) return;
    started.current = true;
    setPaused(false);
    setDone(false);
    runRef.current = true;
    const info = runInfo.current;
    const tl = tlRef.current;
    if (info && tl && !done && info.ids.length) {
      const t = clockRef.current ? clockRef.current.t : tl.time();
      let n = 0;
      info.starts.forEach((at, j) => {
        if (t >= at) n = j;
      });
      if (t >= info.ends[n] && n + 1 < info.ids.length) n++;
      playFrom(info.ids.slice(n), { press: true, announce: info.announce });
    } else if (interacted) playOne(selected);
    else playSequence(0, true);
  };

  const pick = (i: number) => {
    setSelected(i);
    // A pick is the reader taking over, whether or not GSAP has arrived yet:
    // the first-view sequence never starts after one.
    started.current = true;
    markInteracted();
    if (!animated) {
      endListen();
      setStill(i);
      return;
    }
    setPaused(false);
    setDone(false);
    runRef.current = true;
    playOne(i);
  };

  const { getItemProps } = useRovingRadio({
    count: questions.length,
    index: selected,
    orientation: "horizontal",
    onChange: (i) => pick(i),
  });

  const transport = () => {
    if (reduce) return onListen();
    if (!started.current && !interacted && kitRef.current) {
      // The first view has not started yet (below lg it waits for the stage to come up the screen):
      // the button offers Play, and the press starts it here and now.
      started.current = true;
      setPaused(false);
      runRef.current = true;
      playSequence(0, true);
      return;
    }
    if (!done) {
      // Play after Pause is the reader's own press: the question may take the sound back.
      if (paused) pressResume.current = true;
      setPaused(!paused);
      return;
    }
    setDone(false);
    setPaused(false);
    runRef.current = true;
    if (interacted) playOne(selected);
    else playSequence(0, true);
  };

  // ── The still frame (everything below is drawn by React only while GSAP is not in charge) ──
  const mode = animated ? "a" : "s";
  const stat = !animated;
  const sq = questions[still];
  const sBest = winner(model, still);
  const sHit = sBest >= 0;
  /** A Listen run on the question on screen: which line is being said. */
  const lq = listen && listen.qi === still ? listen : null;
  const sStatus = lq ? (lq.part === "ask" ? "listening" : sHit ? "answering" : "missing") : finishedStatus(model, still);
  const orbColors = animated ? (orbMuted ? MUTED_MESH : KB_MESH) : sHit ? KB_MESH : MUTED_MESH;
  const hits = questions.map((q, qi) => ({ q, qi, doc: winner(model, qi) })).filter((x) => x.doc >= 0);

  const button = reduce
    ? lq?.running
      ? { icon: "pause" as const, label: room.pause }
      : { icon: "listen" as const, label: room.listen }
    : done
      ? { icon: "replay" as const, label: room.replay }
      : paused || (animated && !begun && !interacted)
        ? { icon: "play" as const, label: room.play }
        : { icon: "pause" as const, label: room.pause };

  return (
    <div
      ref={stageRef}
      className={cn(
        "home-knowledge-room home-rise relative isolate overflow-hidden rounded-[24px] bg-pp-card p-6 lg:p-10",
        className,
      )}
    >
      {/* The reader's light, and grain over it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: "radial-gradient(40% 50% at 50% 55%, rgb(85 26 137 / 0.08), transparent)" }}
      />
      <div aria-hidden className="pp-grain pointer-events-none absolute inset-0 -z-10 opacity-40" />

      {/* Beams: tile to orb, measured, lg only. */}
      <svg key={`beams-${mode}`} aria-hidden className="pointer-events-none absolute inset-0 -z-[5] hidden size-full lg:block" fill="none">
        {beams.map((d, i) => {
          const lit = stat && sHit && i === sBest;
          const groupOpacity = stat ? (sHit ? (lit ? 1 : BEAM_LOSE) : BEAM_MISS) : undefined;
          return (
            <g key={i} data-kb-beam style={groupOpacity != null ? { opacity: groupOpacity } : undefined}>
              <mask id={`${uid}m${i}`} maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
                <path
                  data-kb-draw
                  d={d}
                  pathLength={1}
                  stroke="#fff"
                  strokeWidth={12}
                  strokeDasharray="1 1"
                  style={{ strokeDashoffset: stat ? 0 : 1 }}
                />
              </mask>
              <path
                d={d}
                mask={`url(#${uid}m${i})`}
                stroke={BEAM_INK}
                strokeWidth={LINE}
                strokeDasharray={DOTS}
                strokeLinecap="round"
              />
              <path
                data-kb-trail
                d={d}
                pathLength={1}
                stroke={ACCENT}
                strokeWidth={1.5}
                strokeDasharray="1 1"
                style={{ strokeDashoffset: lit ? 0 : 1 }}
              />
            </g>
          );
        })}
        {beams.length > 0 && (
          <circle data-kb-runner r={2.5} fill={ACCENT} stroke="#f4f3f7" strokeWidth={2} style={{ opacity: 0, visibility: "hidden" }} />
        )}
      </svg>

      {/* Top: what this is, the sound, and where it is up to. */}
      <div className="flex flex-col gap-4 [grid-area:top] lg:flex-row lg:items-center lg:gap-3">
        <p aria-hidden className={cn(TYPE.label, "text-balance text-pp-muted lg:mr-auto lg:pr-1")}>
          {room.sample}
        </p>
        <SoundButton variant="round" onChange={onSound} />
        <div className="flex items-center justify-between gap-3 lg:justify-end">
          <p
            key={`status-${mode}`}
            aria-hidden
            className={cn("inline-flex h-8 items-center gap-2 rounded-full bg-white px-3 text-[13px] leading-[18px]", RING)}
          >
            <span
              data-kb-dot
              className="size-2 shrink-0 rounded-full"
              style={stat ? { backgroundColor: DOT[sStatus] } : { backgroundColor: DOT.listening }}
            />
            {/* Sized to the words showing: still, only they take up room; under GSAP the box's width is tweened. */}
            <span data-kb-status-box className="relative grid overflow-hidden">
              {STATUS_KEYS.map((k) => (
                <span
                  key={k}
                  data-kb-status={k}
                  className={cn(
                    "justify-self-start whitespace-nowrap [grid-area:1/1]",
                    stat && k !== sStatus && "invisible absolute top-0 left-0",
                  )}
                >
                  {room.status[k]}
                </span>
              ))}
            </span>
          </p>
          <RoundButton
            icon={button.icon}
            label={button.label}
            onClick={transport}
            disabled={reduce && KB_FILE.get() !== null && !listenable(sq)}
          />
        </div>
      </div>

      {/* The documents: a row of tiles from lg, a list of rows (names aligned past a fixed badge column) below it. */}
      <ol key={`docs-${mode}`} aria-hidden className="mt-6 grid gap-2 [grid-area:docs] lg:mb-[112px] lg:grid-cols-5 lg:gap-4">
        {room.docs.map((d, i) => {
          const win = stat && sHit && i === sBest;
          const dim = stat && sHit && i !== sBest;
          return (
            <li key={d.id} data-kb-slot className="min-w-0">
              <div
                data-kb-tile
                className={cn(
                  // A phone stacks the name over its bar, so the name gets the width;
                  // from sm they share one line; from lg each is a tile.
                  "grid h-11 grid-cols-[44px_minmax(0,1fr)] content-center items-center gap-x-3 gap-y-1.5 rounded-2xl bg-white px-3",
                  "sm:grid-cols-[44px_minmax(0,1fr)_minmax(72px,32%)] sm:gap-y-0",
                  "lg:block lg:h-auto lg:p-3",
                  win && "lg:-translate-y-1.5",
                )}
                style={stat ? { boxShadow: win ? TILE_LIFT : TILE_REST, opacity: dim ? DIM : 1 } : { boxShadow: TILE_REST }}
              >
                <span className="row-span-2 flex sm:row-span-1">
                  <DocBadge kind={d.kind} />
                </span>
                <p className="truncate text-[13px] leading-[18px] lg:mt-3">{d.name}</p>
                <span className="relative block h-1 rounded-full bg-pp-ink/[0.08] lg:mt-3">
                  <span
                    data-kb-fill
                    className="absolute inset-0 origin-left rounded-full"
                    style={
                      stat
                        ? { backgroundColor: win ? FILL_WIN : FILL_REST, transform: `scaleX(${sq.match[i] ?? 0})` }
                        : { backgroundColor: FILL_REST }
                    }
                  />
                  <span
                    data-kb-tick
                    className="absolute -top-[3px] h-2.5 w-px bg-pp-ink/40"
                    style={{ left: `${threshold * 100}%` }}
                  />
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      {/* The caller. */}
      <div
        key={`caller-${mode}`}
        aria-hidden
        className="mt-6 [grid-area:caller] lg:mt-0 lg:max-w-[320px] lg:self-center lg:justify-self-end lg:text-right"
      >
        <p className={cn(TYPE.label, "text-pp-muted")}>{room.caller}</p>
        <div className="mt-2 grid">
          {questions.map((q, i) => (
            <p
              key={q.id}
              data-kb-ask
              className={cn(
                TYPE.cinemaSm,
                "text-balance italic [grid-area:1/1]",
                !(stat && i === still) && "invisible",
                // Listen: the question steps back while it is answered.
                lq?.part === "answer" && "text-pp-muted",
              )}
            >
              {q.ask}
            </p>
          ))}
        </div>
      </div>

      {/* The reader. Never remounted: one WebGL context for the life of the page. */}
      <div aria-hidden className="mt-8 justify-self-center [grid-area:orb] md:self-center lg:mt-0">
        <div data-kb-orb className="size-[140px] lg:size-[184px]">
          <FluidOrb
            colors={orbColors}
            volume={vol}
            running={!paused}
            still={reduce || paused}
            gate="intent"
            className="size-full"
          />
        </div>
      </div>

      {/* The page it found, or the sheet it was still reading. */}
      <div
        key={`peek-${mode}`}
        aria-hidden
        className="mt-6 grid w-full [grid-area:peek] md:mt-8 md:self-center lg:mt-0 lg:max-w-[320px]"
      >
        <div
          data-kb-sheet
          className={cn(
            "relative rounded-[20px] border border-dashed border-[rgb(24_16_40/0.14)] p-4 [grid-area:1/1]",
            stat && sHit && "invisible",
          )}
        >
          {/* A sheet still being read… */}
          <div data-kb-sheet-lines className="flex flex-col gap-2.5" style={stat && !sHit ? { opacity: SHEET_DIM } : undefined}>
            <span className="block h-2 w-24 rounded-full bg-pp-ink/[0.07]" />
            {[86, 64, 78].map((w, i) => (
              <span
                key={i}
                className={cn("block h-2 rounded-full bg-pp-ink/[0.05]", i > 0 && "max-md:hidden", i === 0 && "mt-1.5")}
                style={{ width: `${w}%` }}
              />
            ))}
          </div>
          {/* …or the place a page would be, and none is. */}
          <p
            data-kb-sheet-note
            className={cn(
              "absolute inset-0 flex items-center justify-center gap-2 text-[13px] leading-[18px] text-pp-muted",
              !(stat && !sHit) && "invisible",
            )}
          >
            {room.status.missing}
          </p>
        </div>
        {hits.map(({ q, qi, doc }) => {
          const d = room.docs[doc];
          const open = stat && qi === still;
          return (
            <div
              key={q.id}
              data-kb-page={qi}
              className={cn(
                "rounded-[20px] bg-white p-4 outline-1 -outline-offset-1 outline-[rgb(24_16_40/0.07)] [grid-area:1/1]",
                !open && "invisible",
              )}
            >
              <p className="flex items-center gap-2 text-[13px] leading-[18px]">
                <DocBadge kind={d.kind} small />
                <span className="truncate">{d.name}</span>
              </p>
              <ul className="mt-2.5 flex flex-col gap-0.5">
                {d.lines.map((line, li) => {
                  const marked = li === q.line;
                  return (
                    <li
                      key={li}
                      className={cn(
                        "relative -mx-1.5 rounded-md px-1.5 py-1 text-[13px] leading-5 text-pretty",
                        marked ? "text-pp-ink" : "text-pp-muted max-md:hidden",
                      )}
                    >
                      {marked && (
                        <span
                          data-kb-mark={qi}
                          className="absolute inset-0 origin-left rounded-md bg-[#551a89]/12"
                          style={stat ? { transform: `scaleX(${open ? 1 : 0})` } : undefined}
                        />
                      )}
                      <span className="relative">{line}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {/* The answer, and where it came from. */}
      <div
        key={`answer-${mode}`}
        aria-hidden
        className="mt-8 w-full [grid-area:answer] lg:mx-auto lg:max-w-[760px] lg:text-center"
      >
        {/* Each answer with its source right under it; the stack holds the tallest pair. */}
        <div className="grid">
          {questions.map((q, i) => {
            const doc = winner(model, i);
            // Listen: the answer comes up when it is said.
            const hidden = (!(stat && i === still) || lq?.part === "ask") && "invisible";
            return (
              <div key={q.id} className="[grid-area:1/1]">
                <p data-kb-answer className={cn(TYPE.cinemaSm, "text-balance", hidden)}>
                  {q.answer}
                </p>
                <p data-kb-meta className={cn(TYPE.meta, "mt-3 flex items-center gap-2 lg:justify-center", hidden)}>
                  <span
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: doc >= 0 ? DOT.found : DOT.missing }}
                  />
                  {doc >= 0 ? (
                    <span>
                      {room.foundIn} <span className="text-pp-ink">{room.docs[doc].name}</span>
                    </span>
                  ) : (
                    <span>{room.fallback}</span>
                  )}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* The questions. */}
      <div className="mt-8 [grid-area:ctrl]">
        <ChipRail label={room.pick} railRef={railRef} className="max-lg:-mx-6 max-lg:px-6 lg:justify-center-safe">
          {questions.map((q, i) => (
            <button
              key={q.id}
              type="button"
              {...getItemProps(i)}
              className={cn(
                "relative h-9 rounded-full px-3.5 text-[13px] whitespace-nowrap transition-[background-color,color,box-shadow] duration-200",
                "before:absolute before:inset-x-0 before:-inset-y-1",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink",
                i === selected ? "bg-pp-ink text-white" : cn("bg-white text-pp-ink hover:bg-white/70", RING),
              )}
            >
              {q.ask}
            </button>
          ))}
        </ChipRail>
      </div>
    </div>
  );
}
