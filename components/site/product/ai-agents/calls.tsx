"use client";

import { useEffect, useEffectEvent, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { gsap } from "gsap";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import { CALLS, spokenLines, type SpokenLine } from "@/lib/pages/ai-agents";
import { cueIn, lazyCues, type Cue } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { envelopeAt, turnAt } from "@/components/site/audio/cue";
import { isAudible, isSounding, isSoundOn, unlockFromGesture } from "@/components/site/audio/engine";
import { SOUND_NOTE, SoundButton } from "@/components/site/audio/sound-button";
import { useLazyCues } from "@/components/site/audio/use-lazy-cues";
import { useVoiceTrack } from "@/components/site/audio/use-voice-track";
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
 *
 * Sound. Each call has generated audio (AI-generated voices,
 * lib/audio/cues/agents-sample-calls.json), played only once the visitor
 * turns sound on beside the transport. A call that starts with sound on
 * is built on its audio's schedule: each line comes in as its clip
 * starts, each word as it is said, and the orb swells with the agent's
 * voice; the timeline stays paused and the audio's clock sets its time
 * every frame, so pause, the end and the scrubber follow the voice. The
 * outcome then plays on GSAP's own clock. Sound turned on mid-call starts
 * the call again, spoken; turned off, the call finishes on the same clock
 * in silence and the next is read-paced. While the voice is heard, the
 * live region stops reading each line out (the outcome is still read).
 * With reduced motion nothing plays by itself: the transport is "Listen".
 * ------------------------------------------------------------------ */

/** Seconds per spoken word, and the rest after a line lands. */
const WORD = 0.23;
const REST = 1.05;
const OUTCOME_HOLD = 2.8;
/** Where the first line lands on a read-paced timeline; a spoken one puts its first line there too. */
const FIRST_LINE = 0.45;
/** A line starts to leave this long before the next one comes in, as on a read-paced timeline. */
const LINE_OUT = 0.55;
/** How far the orb swells at full voice (the read-paced breathing peaks at 1.06). */
const ORB_SWELL = 0.07;

/** The stage's claim on the site's one sound (components/site/audio/engine.ts). */
const VOICE_ID = "agents-calls";

type SpokenCall = { cue: Cue; lines: SpokenLine[] };

/**
 * Each call's audio, where its cue speaks every line as shown. P0: the cue
 * file (a few KB of timings) is fetched as sound goes on, never in the
 * page's first load. A call without one stays read-paced.
 */
const SPOKEN = lazyCues(
  "agents-sample-calls",
  (file): Partial<Record<string, SpokenCall>> =>
    Object.fromEntries(
      CALLS.items.map((c) => {
        const cue = cueIn(file, `agents-sample-calls/${c.id}`);
        const lines = spokenLines(cue, c.turns);
        return [c.id, cue && lines ? { cue, lines } : undefined];
      }),
    ),
);

/**
 * A spoken call's timeline: the audio starts at `T0` (so the first line
 * lands at FIRST_LINE, as it does read-paced), each line comes in at its
 * clip's start and leaves before the next comes in (no sooner than 0.3 s
 * before its own clip ends), and the outcome comes up when the audio ends.
 */
export function spokenCallPlan(sp: SpokenCall) {
  const T0 = Math.max(0, FIRST_LINE - sp.lines[0].start);
  const outcome = T0 + Math.max(sp.cue.dur, sp.lines[sp.lines.length - 1].end);
  const lines = sp.lines.map((l, i) => {
    const at = T0 + l.start;
    const next = sp.lines[i + 1];
    const nextAt = next ? T0 + next.start : outcome;
    const out = Math.max(at + 0.2, Math.min(nextAt - 0.15, Math.max(nextAt - LINE_OUT, T0 + l.end - 0.3)));
    return { at, out, words: l.words };
  });
  return { T0, lines, outcome };
}

/** Voice to orb: the envelope's speech range (about 0.35 to 0.8) onto 0 to 1. */
const level = (env: number) => Math.min(1, Math.max(0, (env - 0.35) / 0.45));

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
  /** This run is built on its audio's schedule (sound was on when it started). */
  const [spoken, setSpoken] = useState(false);
  /** A new spoken run of the same call: rebuilds its timeline. Only ever moves with sound involved. */
  const [runId, setRunId] = useState(0);
  /** Reduced motion: the Listen transport. */
  const [listen, setListen] = useState<"playing" | "paused" | null>(null);

  const track = useVoiceTrack(VOICE_ID, { active: inView });
  const trackRef = useRef(track);
  useEffect(() => {
    trackRef.current = track;
  });
  /** The next run was the visitor's own choice: it may take the sound from another stage. */
  const pressRef = useRef(false);
  /** A spoken timeline's drive: its call's audio, its plan, the orb's setter; null when read-paced. */
  const driveRef = useRef<{
    sp: SpokenCall;
    plan: ReturnType<typeof spokenCallPlan>;
    setOrb: (scale: number) => void;
    fresh: boolean;
  } | null>(null);
  const noteId = useId();

  const call = calls[index];
  const palette = paletteFor(call.id);
  /** The calls' audio, once its timings are here (fetched as sound goes on). */
  const spokenAll = useLazyCues(SPOKEN, track.on);
  /** This call has audio; before its timings are here (sound off), every call is taken to have it, as each does. */
  const voiced = spokenAll ? !!spokenAll[call.id] : !SPOKEN.settled();

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
      // No will-change on the words: a layer held for every word of every
      // line (57 to 94 of them while a call plays) cost more to keep than the
      // few words tweening at once cost to paint. The tweens promote the ones
      // in flight for as long as they move.

      const setBar = gsap.quickSetter(barRef.current, "scaleX");
      const setChapter = gsap.quickSetter(chapterRef.current, "scaleX");
      const sp = spoken ? SPOKEN.get()?.[call.id] : undefined;

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

      if (sp) {
        // Spoken: every line where its clip is, its words as they are said; the orb follows the voice (below).
        const plan = spokenCallPlan(sp);
        call.turns.forEach((turn, i) => {
          const line = plan.lines[i];
          const words = splits[i].words;
          const last = line.words[line.words.length - 1] ?? 0;
          // While a voice is heard (this call's or another stage's), the live region would only talk over it.
          tl.call(() => {
            if (!isAudible(VOICE_ID) && !isSounding()) setAnnounce(`${CALLS.labels[turn.sp]}: ${turn.t}`);
          }, [], line.at);
          showSpeaker(turn.sp === "agent" ? ".cine-speaker-agent" : ".cine-speaker-client", line.at - 0.15);
          tl.set(lines[i], { autoAlpha: 1, yPercent: 0, filter: "blur(0px)" }, line.at).fromTo(
            words,
            { autoAlpha: 0, yPercent: 16, filter: "blur(3px)" },
            {
              autoAlpha: 1,
              yPercent: 0,
              filter: "blur(0px)",
              duration: 0.9,
              ease: "power2.out",
              stagger: (k: number) => line.words[k] ?? last,
            },
            line.at,
          );
          tl.to(
            lines[i],
            { autoAlpha: 0, yPercent: -10, filter: "blur(3px)", duration: 0.6, ease: "power2.inOut" },
            line.out,
          );
        });
        const t = plan.outcome;
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

        // "scale" is a CSSPlugin alias (scaleX + scaleY) that quickSetter cannot take: it would try
        // setAttribute("scaleX,scaleY") and throw, aborting the spoken run. Set both axes instead.
        const setScaleX = gsap.quickSetter(orb, "scaleX") as (v: number) => void;
        const setScaleY = gsap.quickSetter(orb, "scaleY") as (v: number) => void;
        const setOrb = (scale: number) => {
          setScaleX(scale);
          setScaleY(scale);
        };
        setOrb(1);
        tlRef.current = tl;
        driveRef.current = { sp, plan, setOrb, fresh: true };
        return () => {
          setOrb(1);
          tlRef.current = null;
          driveRef.current = null;
        };
      }

      let t = 0.45;
      call.turns.forEach((turn, i) => {
        const words = splits[i].words;
        const speak = words.length * WORD;
        const end = t + speak + REST;

        // Not while another stage's voice is heard: the live region would talk over it.
        tl.call(() => {
          if (!isSounding()) setAnnounce(`${CALLS.labels[turn.sp]}: ${turn.t}`);
        }, [], t);
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
    { scope: stageRef, dependencies: [call.id, reduce, spoken, runId], revertOnUpdate: true },
  );

  /**
   * Starts call `i` from the top: spoken when sound is on and it has
   * audio, read-paced otherwise. `press` is the visitor's own choice.
   */
  const startRun = (i: number, press: boolean) => {
    // Sound on, and the calls' timings not here yet: the run starts once they are (a moment).
    const ask = ++cueWait.current;
    if (isSoundOn() && !SPOKEN.settled()) {
      void SPOKEN.load().then(() => {
        if (ask === cueWait.current) startLater.current(i, press);
      });
      return;
    }
    const speak = !reduce && !!SPOKEN.get()?.[calls[i].id] && isSoundOn() && (press || !trackRef.current.listen);
    pressRef.current = press;
    if (speak || spoken) {
      // A new timeline, on the schedule this run needs.
      setSpoken(speak);
      setRunId((r) => r + 1);
      if (!speak) trackRef.current.pause();
    } else if (i === index) {
      // The same call keeps its timeline, so picking it again starts it over.
      tlRef.current?.restart();
    }
    setIndex(i);
  };
  /** Bumped by every run asked for: one waiting for the calls' timings starts only if it is still the last. */
  const cueWait = useRef(0);
  const startLater = useRef(startRun);
  useLayoutEffect(() => {
    startLater.current = startRun;
  });
  const nextCall = useEffectEvent(() => startRun((index + 1) % calls.length, false));

  // A call that has finished hands over to the next until somebody takes control.
  useEffect(() => {
    if (!finished || !autoplay || !inView) return;
    const id = window.setTimeout(() => {
      setFinished(false);
      nextCall();
    }, 500);
    return () => window.clearTimeout(id);
  }, [finished, autoplay, inView, calls.length]);

  // Plays while on screen and not paused by hand.
  useEffect(() => {
    const tl = tlRef.current;
    if (!tl) return;
    const drive = driveRef.current;
    const go = inView && !paused && !finished;
    if (!drive) {
      if (go) tl.play();
      else tl.pause();
      return;
    }
    // Spoken: the audio's clock sets the timeline's time until the voice ends; the outcome runs on its own.
    const voice = trackRef.current;
    if (!go) {
      voice.pause();
      tl.pause();
      return;
    }
    if (tl.time() >= drive.plan.outcome) {
      tl.play();
      return;
    }
    tl.pause();
    const press = pressRef.current;
    pressRef.current = false;
    const after = SPOKEN.get()?.[calls[(index + 1) % calls.length].id];
    voice.play(drive.sp.cue, drive.fresh ? 0 : undefined, { press, next: after?.cue });
    drive.fresh = false;
    const { cue } = drive.sp;
    let raf = 0;
    const frame = () => {
      const t = trackRef.current.time();
      tl.time(drive.plan.T0 + t);
      const turn = turnAt(cue, t);
      drive.setOrb(turn && turn.sp === "agent" && t <= turn.end ? 1 + ORB_SWELL * level(envelopeAt(cue, t)) : 1);
      if (t >= cue.dur) {
        drive.setOrb(1);
        tl.play();
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      drive.setOrb(1);
    };
  }, [inView, paused, finished, call.id, reduce, kit, spoken, runId, index, calls]);

  // Off screen, the hook pauses the voice: the transport says Listen again, and a press carries on.
  useEffect(() => {
    if (!inView) setListen((l) => (l === "playing" ? "paused" : l));
  }, [inView]);

  // Listen (reduced motion): the call's lines swap in whole as they are said, then it reads finished again.
  const listenSp = spokenAll?.[call.id];
  useEffect(() => {
    const sp = listenSp;
    const root = stageRef.current;
    if (listen !== "playing" || !sp || !root) return;
    const lines = Array.from(root.querySelectorAll<HTMLElement>(".cine-line"));
    const outcome = root.querySelector<HTMLElement>(".cine-outcome");
    const speaker = (sel: string) => root.querySelector<HTMLElement>(`.cine-speaker-${sel}`);
    const show = (el: HTMLElement | null, on: boolean) => {
      if (!el) return;
      el.style.visibility = on ? "visible" : "hidden";
      el.style.opacity = on ? "1" : "0";
    };
    let current = -2;
    let raf = 0;
    const frame = () => {
      const t = trackRef.current.time();
      const over = t >= sp.cue.dur;
      let k = -1;
      if (!over) while (k + 1 < sp.lines.length && sp.lines[k + 1].start <= t) k++;
      if (k !== current || over) {
        current = k;
        lines.forEach((el, i) => show(el, i === k));
        show(outcome, over);
        const who = over ? "outcome" : k >= 0 ? (call.turns[k].sp === "agent" ? "agent" : "client") : "";
        (["client", "agent", "outcome"] as const).forEach((x) => show(speaker(x), x === who));
      }
      if (barRef.current) barRef.current.style.transform = `scaleX(${over ? 1 : Math.min(1, t / sp.cue.dur)})`;
      if (over) {
        setListen(null);
        setAnnounce(`${CALLS.labels.outcome}: ${call.outcome}`);
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [listen, call, listenSp]);

  /** A press (Listen, or the sound control) made before the calls' timings had arrived: answered when they do. */
  const pendingPress = useRef<"listen" | "sound" | null>(null);
  /** Ends a Listen early (another call was picked): the stage reads finished again. */
  const stopListen = () => {
    pendingPress.current = null;
    if (!listen) return;
    trackRef.current.pause();
    setListen(null);
    const root = stageRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>(".cine-line, .cine-speaker").forEach((el) => {
      el.style.visibility = "hidden";
      el.style.opacity = "0";
    });
    root.querySelectorAll<HTMLElement>(".cine-outcome, .cine-speaker-outcome").forEach((el) => {
      el.style.visibility = "visible";
      el.style.opacity = "1";
    });
    if (barRef.current) barRef.current.style.transform = "scaleX(1)";
  };

  /** Listen: plays the open call's audio, turning sound on (the press unlocks it), or pauses it. */
  const toggleListen = (unlock: boolean) => {
    const sp = SPOKEN.get()?.[call.id];
    if (!sp) {
      // The calls' timings aren't here yet: sound goes on in this press, and Listen starts when they arrive.
      if (SPOKEN.settled()) return;
      if (unlock) unlockFromGesture();
      pendingPress.current = "listen";
      return;
    }
    if (listen === "playing") {
      trackRef.current.pause();
      setListen("paused");
      return;
    }
    trackRef.current.play(sp.cue, listen ? undefined : 0, { press: true, unlock });
    setListen("playing");
  };

  const go = (i: number) => {
    setAutoplay(false);
    setPaused(false);
    setFinished(false);
    stopListen();
    startRun(i, true);
  };

  const toggle = () => {
    if (reduce && voiced) {
      toggleListen(true);
      return;
    }
    const tl = tlRef.current;
    if (finished) {
      setFinished(false);
      setPaused(false);
      if (spoken || (isSoundOn() && SPOKEN.get()?.[call.id])) startRun(index, true);
      else tl?.restart();
      return;
    }
    setAutoplay(false);
    // Resuming a spoken call is a press: it takes the sound back.
    if (paused) pressRef.current = true;
    setPaused((p) => !p);
  };

  // Sound turned on here: the call on screen starts again from the top, spoken (Listen, with reduced motion).
  const onSound = (on: boolean) => {
    if (!on) return;
    const sp = SPOKEN.get()?.[call.id];
    if (!sp) {
      // The calls' timings are on their way (sound went on in this press): answered once they are here.
      if (!SPOKEN.settled()) pendingPress.current = "sound";
      return;
    }
    if (reduce) {
      // A Listen under way since sound went off carries on heard, from where its clock is.
      if (listen === "playing") trackRef.current.play(sp.cue, undefined, { press: true });
      else toggleListen(false);
      return;
    }
    setFinished(false);
    setPaused(false);
    startRun(index, true);
  };

  // The calls' timings have arrived: a press made while they were on their way is answered now.
  const answerPending = useEffectEvent(() => {
    const press = pendingPress.current;
    pendingPress.current = null;
    if (!press || !isSoundOn()) return;
    if (press === "sound") onSound(true);
    else toggleListen(false);
  });
  useEffect(() => {
    if (listenSp) answerPending();
  }, [listenSp]);

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

          <div className="relative flex flex-wrap items-center gap-x-4 gap-y-2 p-5 md:flex-nowrap md:p-7">
            <RoundButton
              label={
                reduce && voiced
                  ? listen === "playing"
                    ? CALLS.labels.pause
                    : CALLS.labels.listen
                  : finished
                    ? CALLS.labels.replay
                    : paused
                      ? CALLS.labels.play
                      : CALLS.labels.pause
              }
              onClick={toggle}
              tap={reduce && voiced}
            >
              {reduce && voiced ? (
                listen === "playing" ? (
                  <Pause className="size-4 fill-current" />
                ) : (
                  <Play className="size-4 fill-current" />
                )
              ) : finished ? (
                <RotateCcw className="size-4" />
              ) : paused ? (
                <Play className="size-4 fill-current" />
              ) : (
                <Pause className="size-4 fill-current" />
              )}
            </RoundButton>
            <SoundButton
              variant="round"
              tone="light"
              caption="none"
              describedBy={noteId}
              onChange={onSound}
            />
            {/* The sound control's caption: beside it from md, on its own line under the transport on a phone. */}
            <span
              id={noteId}
              className="order-last basis-full text-[12px] leading-4 text-pp-muted md:order-none md:basis-auto md:shrink-0"
            >
              {SOUND_NOTE}
            </span>
            <div className="relative mx-auto h-[2px] max-w-[520px] min-w-0 flex-1 overflow-hidden rounded-full bg-pp-ink/10">
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
  tap = false,
  children,
}: {
  label: string;
  onClick: () => void;
  /** A 44px tap around the 36px disc (the Listen transport). */
  tap?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "pp-shadow-btn grid size-9 shrink-0 place-items-center rounded-full bg-white text-pp-ink transition-colors hover:bg-pp-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink",
        tap && "relative before:absolute before:-inset-1 before:rounded-full",
      )}
    >
      {children}
    </button>
  );
}
