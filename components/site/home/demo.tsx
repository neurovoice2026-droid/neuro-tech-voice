"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { KeyRound, Moon, Phone, Sun, UserRound } from "lucide-react";
import { envelopeAt, turnAt } from "@/components/site/audio/cue";
import { isAudible, isSoundOn, unlockFromGesture } from "@/components/site/audio/engine";
import { SoundButton } from "@/components/site/audio/sound-button";
import { useVoiceTrack } from "@/components/site/audio/use-voice-track";
import { FluidOrb } from "@/components/site/product/fluid-orb";
import { Frame, PillLink } from "@/components/site/product/primitives";
import { useInView } from "@/components/site/product/timing";
import { cueIn, lazyCues } from "@/lib/audio";
import type { Cue } from "@/lib/audio/cue-types";
import { HOME_CALL, type HomeMomentId } from "@/lib/pages/home/call";
import type { HomeCall, HomeLine } from "@/lib/pages/home.server";
import { cn } from "@/lib/utils";
import { CHIP, RING_LIGHT, RoundButton, useRovingRadio } from "./controls";
import {
  IDLE,
  POSTER,
  SpokenClock,
  TOUR,
  scriptFor,
  speaks,
  type Frame as StageFrame,
  type RunRequest,
  type RunVoice,
  type Script,
  type SpokenCalls,
} from "./demo-script";
import { buildRun } from "./demo-timeline";
import { HomeHeading } from "./heading";
import { useStageMotion } from "./motion";
import { MOMENT_LIGHTS } from "./palettes";
import { TYPE, WEIGHT } from "./type";
import "./demo.css";

/* ------------------------------------------------------------------ *
 * #demo — closed is for the door, not the phone.
 *
 * The first thing under the hero, and the page's answer to "does it
 * really take my calls?": a clock the size of the stage, with Ava's orb
 * for its colon, stopped at the worst moment to ring a small business.
 * The reader picks the moment — mid-rush on a Friday, just after closing
 * on a Thursday, a Sunday morning, 3 a.m. — and the clock spins to it,
 * the room takes that hour's light, the studio's door sign says whether
 * anyone is in, the phone rings, the orb picks up and the call plays out
 * under it, a line at a time. It ends with the outcome in the owner's log
 * and the owner where they were all along: still with the client, on the
 * way home, still off, still asleep.
 *
 * The sub is the index. Its four phrases are the four moments, each in
 * its own ink, and the one being dialled is the one that stays lit.
 *
 * Untouched, the stage tours the four (busy, just gone, day off, asleep)
 * while it has the screen, on every device, and ends on the frame the
 * server drew: 3 a.m., booked. It tours again each time it comes back on
 * screen, and after a rest on that frame while it stays; a pick, Play,
 * Pause or Replay hands the stage to the reader for good.
 * That frame is also what a reader without scripts sees, and what reduced
 * motion keeps (picking a moment then switches to its finished frame at
 * once).
 *
 * The run itself is demo-timeline.ts, on demo-script.ts's schedule; this
 * file holds the markup and derives its state from the run's frames.
 *
 * Sound. The four calls are recorded (AI-generated voices, a ring and a
 * pickup; lib/audio/cues/home-demo-call.json). Nothing is fetched and
 * nothing plays until the reader presses the sound control by the
 * transport. With sound on, every run is built on the recordings
 * (demo-script.ts `spoken`) and the audio is its clock: the timeline is
 * never played but set to the clock's time every frame, and the orb
 * follows the recording's loudness while a line is spoken. Turning sound
 * on mid-run restarts the call under way on its recording; turning it
 * off lets that call finish on the same clock, silently, and the calls
 * after it go back to read pacing. A call only plays out loud while the
 * stage is the landing's focused stage; off-screen it pauses with the run.
 * With reduced motion (or the still tier) nothing plays by itself: the
 * transport becomes Listen, which plays the call on screen and swaps its
 * lines in as they are said, with no motion.
 * ------------------------------------------------------------------ */

const ORDER = TOUR;

/** How long the untouched stage rests on the finished frame before it tours again. */
const REST_MS = 6000;
/**
 * A press on the transport this soon after the tour started by itself was
 * aimed at the Play (or Replay) the reader saw, not at the Pause that took
 * its place under their hand.
 */
const TURNED_MS = 600;

/** The eleven cells of a clock figure's strip. */
const CELLS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

/** Every status pill's box, as the old call log's: same height, padding and face. */
const PILL =
  "relative inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[13px] leading-7 whitespace-nowrap sm:gap-2 sm:px-3";

/**
 * The small print on the stage and under it, in the body face as written:
 * sentence case, no tracking. Tabular figures only where a time is set:
 * Inter's tnum widens the hyphen too, and "made-up" would gape. Inside the
 * stage's padding the transport captions wrap rather than run off the
 * stage; they stand side by side only from lg, where the column has room
 * for both, and even there may wrap rather than be cut by the stage.
 */
const SMALL = "text-[12px] leading-[18px]";
const CAPTION = cn("home-demo-tone text-(--d-dim)", SMALL);

const OWNER_ICON = { rush: UserRound, closing: KeyRound, sunday: Sun, night: Moon } as const;

/** The stage's claim on the site's one sound (components/site/audio/engine.ts). */
const VOICE_ID = "demo";

/**
 * The four calls' recordings. P0: their cue file (a few KB of timings) is
 * fetched as sound goes on, never in the page's first load, and the audio
 * itself only as each call plays. A run asked for with sound on waits for
 * the file (a moment); without it (a failed fetch) it is read-paced. A
 * moment with no track, or one that no longer speaks its lines
 * (demo-script.ts `speaks`), stays read-paced and silent.
 */
const CUES = lazyCues(
  "home-demo-call",
  (file) => Object.fromEntries(TOUR.map((id) => [id, cueIn(file, `home-demo/${id}`)])) as SpokenCalls,
);

/** The orb's voice while a line is said, off the recording's loudness: Ava's lines move it, the caller's only stir it. */
function voiceOf(sp: "agent" | "caller", level: number) {
  return sp === "agent" ? Math.min(0.86, 0.3 + 0.62 * level) : 0.15 + 0.08 * level;
}

/** Where a recording picks up: its pickup sound, else its first line. */
const pickupOf = (cue: Cue) => cue.sfx.find((s) => s.kind === "pickup")?.start ?? cue.turns[0]?.start ?? 0;

/** A Listen run (reduced motion): the call, the line being said, and where the call is up to. */
type Listen = {
  id: HomeMomentId;
  /** The line on the stage, -1 before the greeting. */
  line: number;
  phase: "ringing" | "picked";
  running: boolean;
};

const REST: StageFrame = {
  target: POSTER,
  moment: POSTER,
  line: -1,
  listening: false,
  ended: true,
  done: true,
};

export function Demo({ calls }: { calls: HomeCall[] }) {
  const c = HOME_CALL;
  const byId = useMemo(
    () => Object.fromEntries(calls.map((call) => [call.id, call])) as Record<HomeMomentId, HomeCall>,
    [calls],
  );

  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  /** Read by the orb every frame. */
  const voice = useRef(IDLE);
  const digitPos = useRef<number[]>([...byId[POSTER].digits]);
  const tlRef = useRef<ReturnType<typeof buildRun>>(null);
  const runner = useRef<((req: RunRequest) => void) | null>(null);
  const pending = useRef<RunRequest | null>(null);
  const frameRef = useRef<StageFrame>(REST);
  const momentRef = useRef<HomeMomentId>(POSTER);
  /** The reader started the run under way (a pick, Play, Replay), so its ends are announced. */
  const readerRun = useRef(false);
  /** The reader's last pick: what Replay plays again. */
  const pickedRef = useRef<HomeMomentId | null>(null);
  const debounce = useRef(0);
  /** The run under way, as built. */
  const scriptRef = useRef<Script | null>(null);
  /** It was built with sound on (on the recordings, where there are any). */
  const spokenRef = useRef(false);
  /** Its clock while it runs on recordings; null for a read-paced run, which its timeline plays itself. */
  const clockRef = useRef<SpokenClock | null>(null);
  const frameLoop = useRef(0);
  /** The next run was asked for by the reader's sound press: its first call may take the sound from another stage. */
  const pressFirst = useRef(false);
  /** The next resume was the reader's Play: it may take the sound from another stage. */
  const pressResume = useRef(false);
  const listenClock = useRef<SpokenClock | null>(null);
  const listenLoop = useRef(0);
  /** Bumped by every Listen press (and its end): one waiting for the recordings' timings goes ahead only if it is still the last. */
  const listenWait = useRef(0);
  /** The sound press's rebuild, waiting for the frame after the press to be painted (see onSound). */
  const soundFrame = useRef(0);
  const soundTimer = useRef(0);

  const m = useStageMotion(sectionRef, { id: "demo" });
  const { kit, reduce, playing, paused, setPaused, interacted, markInteracted, tier } = m;
  const lite = tier === "lite";
  const liteRef = useRef(lite);
  // The tour waits for the stage itself to be on screen, not the heading above it: its top
  // above the bottom 15% of the screen (with the section holding the screen, see useStageMotion),
  // so it starts for a reader parked on the heading or landing on /#demo, on laptops and phones.
  const stageSeen = useInView(stageRef, "0px 0px -15% 0px");

  // The stage's voice. A run sounds only while the stage plays (the landing's focused stage, the
  // tab visible, not paused by hand); a Listen run (reduced motion) while the stage is on screen.
  const track = useVoiceTrack(VOICE_ID, { active: reduce ? stageSeen : playing });
  const trackRef = useRef(track);
  useLayoutEffect(() => {
    trackRef.current = track;
  });
  // The recordings' timings are fetched as sound goes on (here or on any other stage).
  const soundOn = track.on;
  useEffect(() => {
    if (soundOn) void CUES.load();
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

  /** A Listen run (reduced motion only): the call being played and the line it is on. */
  const [listen, setListen] = useState<Listen | null>(null);
  /** The moment being dialled: the checked key (drawn filled) and the lit phrase of the sub. */
  const [target, setTarget] = useState<HomeMomentId>(POSTER);
  /** The room's light, the clock, the owner and every copy at rest. */
  const [moment, setMoment] = useState<HomeMomentId>(POSTER);
  const [ended, setEnded] = useState(true);
  const [listening, setListening] = useState(false);
  /** A run is under way. */
  const [live, setLive] = useState(false);
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const [announce, setAnnounce] = useState("");

  useEffect(() => {
    liteRef.current = lite;
  }, [lite]);

  // State from the run's frames, set only when it changes.
  const onFrame = useRef<(f: StageFrame) => void>(() => {});
  useLayoutEffect(() => {
    onFrame.current = (f) => {
      const was = frameRef.current;
      frameRef.current = f;
      if (f.target !== was.target) setTarget(f.target);
      if (f.moment !== was.moment) {
        momentRef.current = f.moment;
        setMoment(f.moment);
      }
      if (f.listening !== was.listening) setListening(f.listening);
      if (f.ended !== was.ended) {
        setEnded(f.ended);
        // Spoken when a call the reader started ends. Never during the untouched tour.
        if (f.ended && readerRun.current) setAnnounce(announceFor(f.target));
      }
      if (f.done && !was.done) {
        setDone(true);
        setLive(false);
      }
    };
  });

  // A run on recordings: every frame, the clock's time (the audio's while a call is heard) is
  // the timeline's, and while a line is said the orb follows the recording's loudness.
  const stopFrames = useCallback(() => {
    cancelAnimationFrame(frameLoop.current);
    frameLoop.current = 0;
  }, []);
  const runFrames = useCallback(() => {
    if (frameLoop.current) return;
    const frame = (now: number) => {
      frameLoop.current = 0;
      const clock = clockRef.current;
      const tl = tlRef.current;
      if (!clock || !tl) return;
      const t = clock.tick(now);
      tl.time(t);
      const at = clock.clipAt(t);
      const turn = at && turnAt(at.clip.cue, at.at);
      if (at && turn && at.at <= turn.end) voice.current = voiceOf(turn.sp, envelopeAt(at.clip.cue, at.at));
      if (clock.playing) frameLoop.current = requestAnimationFrame(frame);
    };
    frameLoop.current = requestAnimationFrame(frame);
  }, []);

  // As each call after the first starts: a run built with sound on while it is now off (or the
  // other way round) is rebuilt from this call, so the calls still to come follow the sound as
  // it is. The call under way when it changed finished on the schedule it was built on.
  const onCall = useRef<(k: number) => void>(() => {});
  useLayoutEffect(() => {
    onCall.current = (k) => {
      const script = scriptRef.current;
      if (!script || spokenRef.current === (isSoundOn() && CUES.get() !== null)) return;
      const ids = script.segs.slice(k).map((seg) => seg.id);
      // Once the timeline has finished the update it is in: the rebuild kills it.
      queueMicrotask(() => {
        if (scriptRef.current === script) request({ kind: script.kind, ids, from: momentRef.current }, readerRun.current);
      });
    };
  });

  // The call's words, not the array's identity: a refreshed server payload
  // hands down an equal but new array, which must not rebuild the stage.
  const sig = calls.map((call) => `${call.id}@${call.time}:${call.lines.map((l) => l.t).join("|")}`).join("/");

  // The runner: kills whatever run is going and builds the next from where
  // the stage stands. Never with reduced motion; torn down (to the frame at
  // rest of whatever moment the stage had reached) when that changes.
  useLayoutEffect(() => {
    const root = sectionRef.current;
    if (!kit || reduce || !root) return;
    const { gsap } = kit;
    const run = (req: RunRequest) => {
      // Sound on, and the recordings' timings not here yet: the run waits for them (a moment), the
      // one under way carrying on meanwhile. A newer request, or the runner torn down, drops it.
      const ask = ++cueWait.current;
      if (isSoundOn() && !CUES.settled()) {
        void CUES.load().then(() => {
          if (ask === cueWait.current && runner.current === run) run(req);
        });
        return;
      }
      tlRef.current?.kill();
      clockRef.current?.stop();
      clockRef.current = null;
      stopFrames();
      // Sound on: the run is built on the recordings, whether or not this stage gets to be heard.
      const cues = isSoundOn() ? CUES.get() : null;
      const spoken = cues !== null;
      const script = scriptFor(calls, { ...req, from: momentRef.current }, cues ?? undefined);
      frameRef.current = { ...frameRef.current, done: false };
      // Cleared at the start, so the same call ending again is a change the reader hears.
      setAnnounce("");
      tlRef.current = buildRun({
        gsap,
        root,
        script,
        calls,
        lite: liteRef.current,
        voice,
        digitPos: digitPos.current,
        onFrame: (f) => onFrame.current(f),
        onCall: (k) => onCall.current(k),
      });
      scriptRef.current = script;
      spokenRef.current = spoken;
      const clips = script.segs.flatMap((seg) => (seg.cue ? [{ at: seg.T, cue: seg.cue }] : []));
      clockRef.current =
        tlRef.current && clips.length
          ? new SpokenClock(clips, script.total, voiceApi, {
              press: readerRun.current,
              pressFirst: pressFirst.current || readerRun.current,
            })
          : null;
      pressFirst.current = false;
      setDone(false);
      setLive(true);
      setRunKey((k) => k + 1);
    };
    runner.current = run;
    const waiting = pending.current;
    pending.current = null;
    if (waiting) runner.current(waiting);

    return () => {
      runner.current = null;
      tlRef.current?.kill();
      tlRef.current = null;
      clockRef.current?.stop();
      clockRef.current = null;
      scriptRef.current = null;
      stopFrames();
      gsap.set(gsap.utils.toArray<HTMLElement>(".home-demo-anim, .home-demo-fx", root), {
        clearProps: "transform,opacity,visibility,willChange",
      });
      voice.current = IDLE;
      digitPos.current = [...byId[momentRef.current].digits];
      const f = frameRef.current;
      frameRef.current = {
        ...f,
        target: f.moment,
        listening: false,
        ended: true,
        done: true,
      };
      setTarget(f.moment);
      setListening(false);
      setEnded(true);
      setLive(false);
      setDone(true);
    };
    // `calls` and `byId` are keyed by `sig`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kit, reduce, sig]);

  const request = (req: RunRequest, byReader: boolean) => {
    readerRun.current = byReader;
    if (runner.current) runner.current(req);
    else pending.current = req;
  };

  const announceFor = (id: HomeMomentId) => {
    const call = byId[id];
    return c.announce(call.day, call.time, call.outcomeLabel);
  };

  // The tour, while the reader has not touched a control: once the stage has
  // had the screen for a moment, again whenever it comes back to it after a
  // tour, and, while it stays, again after a rest on the finished frame.
  const showing = playing && stageSeen;
  const away = useRef(false);
  /** When the tour last started by itself (see TURNED_MS). */
  const autoAt = useRef(-Infinity);
  useEffect(() => {
    if (!showing && done) away.current = true;
  }, [showing, done]);
  useEffect(() => {
    if (interacted || !kit || !showing || reduce || (started && !done)) return;
    const id = window.setTimeout(
      () => {
        away.current = false;
        autoAt.current = performance.now();
        setStarted(true);
        request({ kind: "tour", ids: TOUR, from: momentRef.current }, false);
      },
      !started || away.current ? 900 : REST_MS,
    );
    return () => window.clearTimeout(id);
  }, [started, done, interacted, kit, showing, reduce]);

  // Plays while it has the stage and is not paused by hand. A run on recordings is never
  // played: its clock runs (and its call sounds) instead, and sets the timeline's time.
  useEffect(() => {
    const tl = tlRef.current;
    if (!tl || done) return;
    const clock = clockRef.current;
    const go = playing && started;
    if (!clock) {
      if (go) tl.play();
      else tl.pause();
      return;
    }
    tl.pause();
    if (go) {
      clock.start(performance.now(), pressResume.current || undefined);
      runFrames();
    } else {
      clock.stop();
      stopFrames();
    }
    pressResume.current = false;
  }, [playing, started, done, runKey, runFrames, stopFrames]);

  useEffect(
    () => () => {
      window.clearTimeout(debounce.current);
      cancelAnimationFrame(soundFrame.current);
      window.clearTimeout(soundTimer.current);
    },
    [],
  );

  /* ─── Listen (reduced motion and the still tier) ─────────────────── *
   * Nothing plays by itself. Listen plays the call on screen from its
   * first ring: the stage swaps each line in as it is said (no words
   * walking in, no tweens), the line being said is the large one, and
   * the finished frame and its outcome come back as the call ends. */
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
  const runListenFrames = (id: HomeMomentId) => {
    if (listenLoop.current) return;
    const frame = (now: number) => {
      listenLoop.current = 0;
      const clock = listenClock.current;
      if (!clock) return;
      const t = clock.tick(now);
      if (clock.done) {
        endListen();
        setAnnounce(announceFor(id));
        return;
      }
      const cue = clock.clips[0].cue;
      const line = turnAt(cue, t)?.i ?? -1;
      const phase = t >= pickupOf(cue) ? "picked" : "ringing";
      setListen((l) => (l && (l.line !== line || l.phase !== phase) ? { ...l, line, phase } : l));
      if (clock.playing) listenLoop.current = requestAnimationFrame(frame);
    };
    listenLoop.current = requestAnimationFrame(frame);
  };
  /** Plays the call on screen, or carries on with the one paused; called inside the press. */
  const listenTo = (id: HomeMomentId) => {
    const held = listenClock.current;
    if (held && listen?.id === id) {
      held.start(performance.now(), true);
      setListen({ ...listen, running: true });
      runListenFrames(id);
      return;
    }
    const cues = CUES.get();
    if (!cues) {
      // The recordings' timings are on their way (sound went on in this press): the call plays once they are here.
      const ask = ++listenWait.current;
      void CUES.load().then((c) => {
        if (c && ask === listenWait.current) listenLater.current(id);
      });
      return;
    }
    const cue = cues[id];
    if (!speaks(byId[id], cue)) return;
    endListen();
    const clock = new SpokenClock([{ at: 0, cue }], cue.dur, voiceApi, { press: true });
    listenClock.current = clock;
    setAnnounce("");
    setListen({ id, line: -1, phase: "ringing", running: true });
    clock.start(performance.now());
    runListenFrames(id);
  };
  const listenLater = useRef(listenTo);
  useLayoutEffect(() => {
    listenLater.current = listenTo;
  });
  const pauseListen = useCallback(() => {
    listenWait.current++;
    listenClock.current?.stop();
    stopListenFrames();
    setListen((l) => (l && l.running ? { ...l, running: false } : l));
  }, [stopListenFrames]);
  const onListen = () => {
    if (listen?.running) return pauseListen();
    // The press is the gesture that lets audio play, and turns sound on for the visit.
    unlockFromGesture();
    listenTo(target);
  };
  // Off screen, a Listen run pauses (Listen carries it on); without reduced motion there is none.
  useEffect(() => {
    if (!stageSeen) pauseListen();
  }, [stageSeen, pauseListen]);
  useEffect(() => {
    if (!reduce) endListen();
  }, [reduce, endListen]);
  useEffect(() => () => endListen(), [endListen]);

  /**
   * The sound control. On: the call under way starts again from its
   * first ring on its recording (or the next call, once this one has
   * ended); at rest, the call on screen plays. Off: the engine has
   * already silenced the stage, and the run finishes on its clock.
   */
  const onSound = (on: boolean) => {
    cancelAnimationFrame(soundFrame.current);
    window.clearTimeout(soundTimer.current);
    soundFrame.current = 0;
    // This stage's own press: it takes the landing's focus (it plays, and no other stage speaks).
    m.pinFocus(on);
    if (!on) return;
    if (reduce) return listenTo(target);
    setPaused(false);
    pressFirst.current = true;
    // The click itself only turns sound on (SoundButton unlocks the element inside it). Rebuilding
    // the run on the recordings (a new script and timeline) is the heavy part: it runs once the
    // frame after the press has been painted, so the press answers at once and is not one long
    // task. The run plays on the audio's clock from its start, so nothing is lost by the wait.
    soundFrame.current = requestAnimationFrame(() => {
      soundFrame.current = 0;
      soundTimer.current = window.setTimeout(restartSpoken, 0);
    });
  };
  /** Sound just turned on: the call under way starts again on its recording (or the call on screen plays). */
  const restartSpoken = () => {
    if (!isSoundOn()) return;
    const script = scriptRef.current;
    const tl = tlRef.current;
    if (live && script && tl && script.segs.length) {
      const t = clockRef.current ? clockRef.current.t : tl.time();
      let k = 0;
      script.segs.forEach((seg, i) => {
        if (t >= seg.T) k = i;
      });
      if (t >= script.segs[k].end && k + 1 < script.segs.length) k++;
      request({ kind: script.kind, ids: script.segs.slice(k).map((seg) => seg.id), from: momentRef.current }, readerRun.current);
      return;
    }
    setStarted(true);
    request({ kind: "single", ids: [target], from: momentRef.current }, true);
  };

  /** Reduced motion: the moment's finished frame, at once, and its outcome spoken. */
  const jump = (id: HomeMomentId) => {
    endListen();
    frameRef.current = { ...REST, target: id, moment: id };
    momentRef.current = id;
    digitPos.current = [...byId[id].digits];
    setTarget(id);
    setMoment(id);
    setEnded(true);
    setAnnounce("");
    window.setTimeout(() => setAnnounce(announceFor(id)), 60);
  };

  const dial = (id: HomeMomentId) => {
    if (reduce) return jump(id);
    setStarted(true);
    request({ kind: "single", ids: [id], from: momentRef.current }, true);
  };

  const radio = useRovingRadio({
    count: ORDER.length,
    index: ORDER.indexOf(target),
    orientation: "horizontal",
    onChange: (i, via) => {
      const id = ORDER[i];
      markInteracted();
      setPaused(false);
      // Checked, filled and lit at once, even while an arrow key is still walking or GSAP is on its way.
      setTarget(id);
      pickedRef.current = id;
      window.clearTimeout(debounce.current);
      // A held arrow key walks the keys; only where it stops is dialled. The run
      // under way holds still meanwhile, so it cannot light a key of its own.
      if (via === "key" && !reduce) {
        tlRef.current?.pause();
        clockRef.current?.stop();
        stopFrames();
        debounce.current = window.setTimeout(() => dial(id), 450);
      } else dial(id);
    },
  });

  const onTransport = () => {
    markInteracted();
    if (!started || done) {
      setPaused(false);
      setStarted(true);
      // Again what was played: the tour, unless the reader has picked.
      const again = pickedRef.current;
      request(
        again
          ? { kind: "single", ids: [again], from: momentRef.current }
          : { kind: "tour", ids: TOUR, from: momentRef.current },
        true,
      );
      return;
    }
    // The tour started by itself a moment ago and turned the Play the reader
    // was pressing into Pause: the press asked for the tour, so it plays on,
    // theirs now (no loop after it).
    if (!paused && performance.now() - autoAt.current < TURNED_MS) return;
    // Play after Pause is the reader's own press: the call may take the sound back.
    if (paused) pressResume.current = true;
    setPaused(!paused);
  };

  const control: "play" | "pause" | "replay" =
    reduce || (started && done) ? "replay" : !started || paused ? "play" : "pause";
  // Reduced motion: the transport is Listen, for the call on screen, when it has a recording.
  const loadedCues = CUES.get();
  const transport = reduce
    ? {
        icon: listen?.running ? ("pause" as const) : ("listen" as const),
        label: listen?.running ? c.controls.pause : c.controls.listen,
        onClick: onListen,
        // Until the timings are here (sound off) every call is offered: each has its recording.
        disabled: loadedCues !== null && !speaks(byId[target], loadedCues[target]),
      }
    : { icon: control, label: c.controls[control], onClick: onTransport, disabled: false };
  const L = MOMENT_LIGHTS[moment];
  const now = byId[moment];
  /** The call a Listen run is playing, if it is the one on screen; at rest, null. */
  const heard = listen && listen.id === moment ? listen : null;
  const booked = moment === "night" && ended && !heard;
  /** The rows on screen at rest are the call's last two lines; during a Listen run, the line being said and the one before. */
  const lineOn = (call: HomeCall, i: number, row: "cur" | "prev") => {
    if (call.id !== moment) return false;
    const last = heard ? heard.line : call.lines.length - 1;
    return i === (row === "cur" ? last : last - 1);
  };
  // The caller's lean toward blue is for the shader only: the CSS stand-in would cut to it.
  const shaderColors = listening ? L.listen : L.orb;
  // The orb moves only while a call does.
  const orbStill = reduce || !playing || !live;
  const OwnerIcon = OWNER_ICON[moment];

  return (
    <section
      ref={sectionRef}
      id="demo"
      aria-labelledby="demo-title"
      data-target={target}
      data-live={live || undefined}
      // Not scroll-mt-28 like the rest: the section clears the header pill
      // with its own top padding, so /#demo lands on its top edge.
      className="home-demo relative scroll-mt-0"
    >
      <Frame className="relative pt-[120px] pb-14 md:pt-[136px] lg:pt-[152px]">
        <HomeHeading
          id="demo-title"
          size="display"
          eyebrow={c.eyebrow}
          title={c.title}
          titleKey={c.key}
          sub={<Phrased sub={c.sub} phrases={c.phrases} />}
        />

        {/* The picker, above the stage at every width: the order it is read in. */}
        <div className="mt-8 lg:mt-10">
          <p id="demo-pick" className={cn(TYPE.label, "text-pp-muted")}>
            {c.picker.legend}
          </p>
          <div
            {...radio.groupProps}
            aria-labelledby="demo-pick"
            className="mt-3 grid max-w-[928px] grid-cols-2 gap-2 sm:grid-cols-4 md:gap-3"
          >
            {ORDER.map((id, i) => {
              const on = target === id;
              const call = byId[id];
              const label = c.picker.keys[id];
              return (
                <button
                  key={id}
                  type="button"
                  {...radio.getItemProps(i)}
                  data-key={id}
                  aria-label={c.picker.name(label, call.day, call.time)}
                  className={cn(
                    "home-demo-fx relative flex h-[60px] min-w-0 flex-col justify-center rounded-2xl px-3 text-left active:scale-[0.97] max-[359px]:px-2.5 md:h-16 md:flex-row md:items-center md:justify-start md:gap-3 md:px-3.5",
                    CHIP.ease,
                    RING_LIGHT,
                    on ? "bg-(--ink) text-white" : "bg-white text-pp-ink ring-1 ring-pp-hair hover:bg-(--home-wash)",
                  )}
                  style={
                    {
                      "--ink": MOMENT_LIGHTS[id].ink,
                      "--disc": MOMENT_LIGHTS[id].disc,
                    } as CSSProperties
                  }
                >
                  <span
                    aria-hidden
                    data-key-disc
                    className={cn(
                      "home-demo-fx hidden size-8 shrink-0 place-items-center rounded-full [background:var(--disc)] md:grid",
                      on && "ring-2 ring-white/70",
                    )}
                  >
                    <Phone className="home-demo-fx size-3.5 text-white" strokeWidth={2.25} />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="flex items-center gap-1.5 truncate text-[14px] leading-[18px] font-medium max-[359px]:text-[13px] md:text-[15px] md:leading-5">
                      {/* On the smallest phones the label needs the dot's room. */}
                      <span
                        aria-hidden
                        className="size-2 shrink-0 rounded-full [background:var(--disc)] max-[359px]:hidden md:hidden"
                      />
                      {label}
                    </span>
                    <span className={cn("mt-0.5 tabular-nums", SMALL, on ? "text-white" : "text-pp-muted")}>
                      {call.day.slice(0, 3)} {call.time}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* The stage. */}
        <div
          ref={stageRef}
          data-moment={moment}
          data-tone={L.tone}
          data-booked={booked || undefined}
          className="home-demo-stage relative isolate mt-5 overflow-hidden rounded-[24px] px-4 pt-5 pb-4 shadow-[0_0_0_1px_rgb(24_16_40/0.06)] [contain:layout_paint] md:mt-6 md:rounded-[28px] md:px-8 md:pt-8 md:pb-6 lg:rounded-[32px] lg:px-11 lg:pt-10 lg:pb-7"
          style={{ "--num": L.num, "--wave": L.wave } as CSSProperties}
        >
          {ORDER.map((id) => (
            <div
              key={id}
              aria-hidden
              data-lit={id === moment || undefined}
              className="home-demo-ground absolute inset-0 -z-10"
              style={{ background: MOMENT_LIGHTS[id].ground }}
            />
          ))}
          <div aria-hidden className="home-grain" />

          {/* The picture: hidden from assistive tech, which gets the transcripts below. */}
          <div aria-hidden className="home-demo-picture">
            {/* Status: the door sign and the day and time, then the phase of the call on
                its own centred line (its copies differ in width, so they sit in one cell). */}
            <div className="flex items-center justify-center gap-3">
              <span className="home-demo-sign home-demo-fx grid justify-items-center">
                {(["open", "closed"] as const).map((f) => (
                  <span
                    key={f}
                    data-sign={f}
                    data-on={(now.open ? "open" : "closed") === f || undefined}
                    className="home-demo-anim home-demo-sign-face inline-flex h-6 items-center rounded-full px-2.5 text-[10px] leading-none font-semibold tracking-[0.16em] uppercase [grid-area:1/1]"
                  >
                    {c.sign[f]}
                  </span>
                ))}
              </span>
              <span className="grid justify-items-start">
                {ORDER.map((id) => (
                  <span
                    key={id}
                    data-day={id}
                    data-on={id === moment || undefined}
                    className={cn("home-demo-anim home-demo-tone text-(--d-ink) [grid-area:1/1]", TYPE.label)}
                  >
                    {byId[id].day} <span className="tabular-nums">{byId[id].time}</span>
                  </span>
                ))}
              </span>
            </div>
            <div className="mt-2 grid justify-items-center">
              {(["ringing", "picked", "ended"] as const).map((p) => (
                <span
                  key={p}
                  data-phase={p}
                  data-on={p === (heard ? heard.phase : "ended") || undefined}
                  className={cn(
                    "home-demo-anim home-demo-tone inline-flex items-center gap-2 text-(--d-dim) [grid-area:1/1]",
                    TYPE.label,
                  )}
                >
                  {/* The ringing phase's dot is the one that pulses with the rings. */}
                  <span
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      p === "ringing" ? "home-demo-dot home-demo-fx bg-(--d-caller)" : "bg-(--d-agent)",
                    )}
                  />
                  {c.status[p]}
                </span>
              ))}
            </div>

            {/* The clock: the orb is its colon. */}
            <div
              translate="no"
              className="home-demo-lockup relative isolate mt-4 flex items-center justify-center md:mt-6"
            >
              <span className="home-demo-wave home-demo-fx" />
              <span className="home-demo-wave home-demo-fx" />
              <Figures digits={[now.digits[0], now.digits[1]]} from={0} />
              <div className="home-demo-orb home-demo-fx relative z-20 shrink-0">
                <FluidOrb
                  colors={L.orb}
                  shaderColors={shaderColors}
                  volume={voice}
                  still={orbStill}
                  gate="intent"
                  className="size-full"
                />
              </div>
              <Figures digits={[now.digits[2], now.digits[3]]} from={2} />
            </div>

            {/* The call, a line at a time; the line before in the smaller row above it. */}
            <div className="mx-auto mt-5 max-w-[680px] text-center md:mt-8">
              <div className="grid items-end overflow-clip pb-[0.14em] max-md:hidden">
                {calls.map((call) =>
                  call.lines.map((line, i) => (
                    <p
                      key={`${call.id}-${i}`}
                      data-row="prev"
                      data-call={call.id}
                      data-i={i}
                      data-on={lineOn(call, i, "prev") || undefined}
                      className="home-demo-anim text-[13px] leading-[18px] text-balance [grid-area:1/1]"
                    >
                      <Line line={line} speaker={c.speakers[line.sp]} small />
                    </p>
                  )),
                )}
              </div>
              <div className="mt-2 grid items-center overflow-clip pb-[0.14em]">
                {calls.map((call) =>
                  call.lines.map((line, i) => (
                    <p
                      key={`${call.id}-${i}`}
                      data-row="cur"
                      data-call={call.id}
                      data-i={i}
                      data-on={lineOn(call, i, "cur") || undefined}
                      className="home-demo-anim text-[15px] leading-[22px] font-medium text-balance [grid-area:1/1] md:text-[19px] md:leading-[28px]"
                    >
                      <Line line={line} speaker={c.speakers[line.sp]} />
                    </p>
                  )),
                )}
              </div>
            </div>

            {/* The owner, and the outcome in their log. */}
            <div className="home-demo-tone mt-5 border-t border-(--d-rule) pt-4 md:mt-7 md:flex md:items-end md:justify-between md:gap-6 md:pt-5">
              <div className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-(--d-tile)">
                  <OwnerIcon className="home-demo-tone size-4 text-(--d-agent)" strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <p className={cn("home-demo-tone text-(--d-dim)", TYPE.label)}>{c.owner.label}</p>
                  <div className="mt-1 grid">
                    {ORDER.flatMap((id) =>
                      (["before", "after"] as const).map((when) => {
                        const o = c.owner.moments[id];
                        return (
                          <div
                            key={`${id}-${when}`}
                            data-owner={id}
                            data-when={when}
                            data-on={(id === moment && when === (heard ? "before" : "after")) || undefined}
                            className="home-demo-anim [grid-area:1/1]"
                          >
                            <p
                              className="home-demo-tone pp-display text-[19px] leading-[26px] tracking-[-0.01em] text-(--d-agent)"
                              style={{ fontWeight: WEIGHT.h3 }}
                            >
                              {when === "before" ? o.before : o.after}
                            </p>
                            <p className="home-demo-tone text-[13px] leading-[18px] text-(--d-dim)">
                              {when === "after" ? o.clause : " "}
                            </p>
                          </div>
                        );
                      }),
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-3 md:mt-0 md:text-right">
                <p className={cn("home-demo-tone mb-2 text-(--d-dim) max-md:hidden", TYPE.label)}>{c.owner.log}</p>
                <div className="grid justify-items-start md:justify-items-end">
                  {calls.map((call) => (
                    <span
                      key={call.id}
                      data-pill={call.id}
                      data-on={(call.id === moment && !heard) || undefined}
                      className={cn("home-demo-anim [grid-area:1/1]", PILL, PILL_TONE[call.outcome])}
                    >
                      <span aria-hidden className={cn("relative size-1.5 shrink-0 rounded-full", DOT[call.outcome])}>
                        <span
                          className={cn(
                            "home-demo-ping home-demo-fx absolute inset-0 rounded-full opacity-0",
                            DOT[call.outcome],
                          )}
                        />
                      </span>
                      {call.outcomeLabel}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* The transport, the sound, and what the stage is: a made-up business, voiced by generated voices. */}
          <div className="mt-5 grid grid-cols-[40px_40px_minmax(0,1fr)] items-center gap-x-4 md:mt-6">
            <RoundButton
              icon={transport.icon}
              label={transport.label}
              onClick={transport.onClick}
              disabled={transport.disabled}
              tone={L.tone === "night" ? "dark" : "light"}
            />
            {/* Its note is the caption beside it, which says the voices are generated. */}
            <SoundButton
              variant="round"
              tone={L.tone === "night" ? "dark" : "light"}
              caption="none"
              describedBy="demo-voices"
              onChange={onSound}
            />
            {/* The sound control's caption first, beside it; then what the stage is. */}
            <div className="flex min-w-0 flex-col gap-1 lg:flex-row lg:justify-between lg:gap-4">
              <p id="demo-voices" className={CAPTION}>
                {c.caption}
              </p>
              <p className={cn(CAPTION, "lg:shrink-0 lg:text-right")}>{c.stageLabel}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
          <p className={cn("text-pretty text-pp-muted", SMALL)}>{c.foot}</p>
          <PillLink href={c.cta.href} variant="secondary">
            {c.cta.label}
          </PillLink>
        </div>
      </Frame>

      <div className="sr-only">
        <h3>{c.transcriptTitle}</h3>
        {calls.map((call) => (
          <div key={call.id}>
            <h4>
              {c.picker.keys[call.id]} — {call.day} {call.time}, {c.sign[call.open ? "open" : "closed"]}
            </h4>
            <p>
              {c.owner.label}: {c.owner.moments[call.id].before}
            </p>
            <ol>
              {call.lines.map((line, i) => (
                <li key={i}>
                  {c.speakers[line.sp]}: {line.t}
                </li>
              ))}
              <li>Outcome: {call.outcomeLabel}</li>
            </ol>
            <p>
              {c.owner.label}: {c.owner.moments[call.id].after} {c.owner.moments[call.id].clause}
            </p>
          </div>
        ))}
      </div>
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
    </section>
  );
}

/**
 * Each outcome's pill on the stage: the hand-over and the answer on white,
 * the move in the after-closing green on white, the booking in ember on the night.
 */
const PILL_TONE: Record<HomeCall["outcome"], string> = {
  handover: "bg-white text-(--home-ink) shadow-[0_0_0_1px_rgb(20_10_36/0.08)]",
  moved: "bg-white text-(--home-closing-ink) shadow-[0_0_0_1px_rgb(4_120_87/0.18)]",
  answered: "bg-white text-(--home-ink) shadow-[0_0_0_1px_rgb(20_10_36/0.08)]",
  booked: "bg-[rgb(238_84_35/0.16)] text-(--home-ember-lit)",
};

/** Flagged is told apart by shape as well as colour: a hollow dot. */
const DOT: Record<HomeCall["outcome"], string> = {
  handover: "shadow-[inset_0_0_0_1.5px_var(--home-flagged)]",
  moved: "bg-[#059669]",
  answered: "bg-(--home-electric)",
  booked: "bg-(--home-ember)",
};

/** A marked phrase in a line: the booked slot turns ember at the end, the hours take the agent's colour, the move its green. */
const MARK: Record<NonNullable<HomeLine["markTone"]>, string> = {
  booked: "home-booked",
  answered: "home-demo-tone text-(--d-answer)",
  moved: "home-demo-tone text-(--d-moved)",
};

/** Two clock figures: a strip each, standing at its figure. */
function Figures({ digits, from }: { digits: [number, number]; from: number }) {
  return (
    <span className="relative z-10 flex">
      {digits.map((d, i) => (
        <span key={from + i} className="home-demo-col home-demo-fx">
          <span
            className="home-demo-strip home-demo-fx pp-display"
            style={{ "--d": d, fontWeight: 440 } as CSSProperties}
          >
            {CELLS.map((n, k) => (
              <span key={k}>{n}</span>
            ))}
          </span>
        </span>
      ))}
    </span>
  );
}

/** One spoken line: the speaker's tag, then the words, its mark picked out. */
function Line({ line, speaker, small = false }: { line: HomeLine; speaker: string; small?: boolean }) {
  const agent = line.sp === "agent";
  let words: ReactNode = line.t;
  if (line.mark) {
    const at = line.t.indexOf(line.mark);
    words = (
      <>
        {line.t.slice(0, at)}
        <span className={cn("whitespace-nowrap", MARK[line.markTone ?? "answered"])}>{line.mark}</span>
        {line.t.slice(at + line.mark.length)}
      </>
    );
  }
  return (
    <>
      <span
        className={cn(
          "home-demo-tone mr-2.5 inline-block align-[0.12em] text-[10px] leading-none font-semibold tracking-[0.16em] uppercase md:text-[11px]",
          agent ? "text-(--d-agent)" : "text-(--d-caller)",
          small && "md:text-[10px]",
        )}
      >
        {speaker}
      </span>
      <span
        className={cn("home-demo-tone", agent ? (small ? "text-(--d-dim)" : "text-(--d-ink)") : "text-(--d-caller)")}
      >
        {words}
      </span>
    </>
  );
}

/** The sub, its four phrases each wrapped in its moment's ink. */
function Phrased({ sub, phrases }: { sub: string; phrases: Record<HomeMomentId, string> }) {
  const marks = (Object.entries(phrases) as [HomeMomentId, string][])
    .map(([id, text]) => ({ id, text, at: sub.indexOf(text) }))
    .sort((a, b) => a.at - b.at);
  const out: ReactNode[] = [];
  let from = 0;
  for (const mk of marks) {
    out.push(sub.slice(from, mk.at));
    out.push(
      <span key={mk.id} data-m={mk.id} className="home-demo-phrase whitespace-nowrap">
        {mk.text}
      </span>,
    );
    from = mk.at + mk.text.length;
  }
  out.push(sub.slice(from));
  return <>{out}</>;
}
