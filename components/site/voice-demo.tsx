"use client";

import { useEffect, useRef, useState } from "react";
import type { gsap } from "gsap";
import { ArrowRight, ChevronRight, Pause, RotateCcw } from "lucide-react";
import {
  VOICE_DEMO as C,
  VOICE_DEMO_SCRIPT as SCRIPT,
  type DemoTurn,
} from "@/lib/site";
import { cn } from "@/lib/utils";
import { ping } from "./product/line-figure";
import { useKitContext, useMotionKit } from "./product/motion-kit";
import { Frame, Orb, ORB_MESHES } from "./product/primitives";
import { holdFor, useInView, usePrefersReducedMotion } from "./product/timing";

/**
 * THE CALL AND ITS RECEIPT RUN ON ONE CLOCK.
 *
 * The scene is a phone call taking place. The section comes on screen, the
 * agent picks up on the first beat, the caller asks for an appointment, the
 * agent reads a diary out loud, the caller chooses, and the agent writes the
 * booking down. Beside it the operations log fills in as it happens:
 * answered, calendar read, appointment written, confirmation sent.
 *
 * **The signature movement is that the two are the same object.** A single
 * GSAP timeline speaks the call — every word of every line, staggered at the
 * pace that line would take to say — and the four log rows are `tl.call()`s
 * standing at their own second of that same timeline. The stamp does not
 * appear near the moment it describes; it appears AT it, because there is
 * only one playhead and both are on it. That is the claim the section makes
 * and it is the one a printed list cannot make: not "the agent can book an
 * appointment" but "at 0:07 of this call it read the diary, and here is the
 * second it did". Pause, resume, replay and the progress bar are the same
 * one playhead too, so nothing in the scene can drift out of step with the
 * thing it is reporting on.
 *
 * Before this, the call was a table of beats advanced by a `setTimeout` and
 * a word count in React state — one render of the whole section per spoken
 * word, about a hundred and ten of them per call, and a log whose rows only
 * agreed with the transcript because both counted the same integer. They
 * agree now by construction.
 *
 * **SplitText, and nothing else.** The line is split into words and the
 * words arrive out of a light blur, up off the baseline — the house's own
 * word reveal, verbatim. No DrawSVG: nothing in this section is a mark being
 * made. No MotionPath: nothing travels a route. The one punctuation the
 * house allows itself is `ping()`, and it is on the log node at the instant
 * that row is earned, because that is an arrival and the house pings every
 * arrival.
 *
 * **The clock is still the house clock.** `holdFor(line)` gives every turn
 * its length at a reading pace and the words of the line divide it between
 * them, so a long line takes longer and no word outruns the eye. The
 * stamps beside the log are read off that same score, not measured
 * somewhere else and printed here.
 *
 * **Nothing is downloaded before it is wanted.** `near` fetches GSAP at 25%
 * of a screen out, in the browser's first idle moment; `inView` plays and
 * pauses the timeline, so a call off screen or in a hidden tab costs
 * nothing. With `prefers-reduced-motion` the kit is never fetched at all:
 * the markup rests on the finished call — the outcome on screen, every
 * stamp struck, the bar full — the instant it mounts.
 *
 * **The reader can take it.** The first pointer, key or focus inside the
 * stage hands the transport over for good: the call in flight plays out,
 * but nothing auto-replays again and the pill under the orb is the only
 * thing that moves the scene from then on. Hover is not an interaction.
 *
 * **CSS still does the small state changes.** The transport's hover and
 * press, the log's ring filling, the speaker mark crossing between "someone
 * is speaking" and "paused" — those are transitions, as they should be.
 * GSAP owns the call; it does not own the buttons.
 *
 * **THE ORB IS THE LIGHT SYSTEM'S ORB.** What used to sit here was a WebGL
 * plasma sphere with a neural core, a 2D layer of particles, synapses,
 * ribbons and an equalizer ring, on its own rAF outside React, reading the
 * `--cover-orb-*` ramp off `.cover` at runtime. On white it had nowhere to
 * stand: additive light drawn on paper is dirt, and the palette it sampled
 * does not exist on this section any more. So it is gone, and the page's
 * own `<Orb mesh={ORB_MESHES.violet}>` takes its place — pure CSS, a mesh
 * of the product's violet under a film of grain, breathing while a line is
 * being spoken and resting in the silence between two turns. The timeline
 * says when; the CSS keyframe does the breathing.
 *
 * **Two speakers, told apart three ways and never by one.** The mark above
 * the line carries the colour (violet for the agent — the product acting;
 * muted for the caller), it carries the name in words, and the type carries
 * the voice: the caller is quoted in the cinema serif, italic, because a
 * caller is a voice that was heard, and the agent is set upright because
 * what the agent says is what was written for it.
 *
 * **Who reads what.** The stage is hidden from assistive technology — four
 * lines stacked in one cell would be read as one run-on paragraph, and a
 * live region streaming words would be unusable. The whole call is in the
 * `<details>` below, unedited and server-rendered, and the one line that
 * only the scene states — the outcome — is announced once, politely, when
 * the call reaches it.
 *
 * There is no recording in this repository, and nothing here pretends
 * otherwise: what plays is the transcript, at the pace the conversation
 * took. `audioSrc` is the seam left open for the day there is something to
 * hear; the timeline is the clock either way.
 */

/* ------------------------------------------------------------------ *
 * The visible cut of the call
 * ------------------------------------------------------------------ */

/**
 * The script is nine turns and a hundred and four words, and on screen it
 * was all of them — a full call read aloud at speaking pace, which is over
 * a minute of a reader watching words appear before anything is decided.
 * Four turns carry the entire argument: the caller asks, the agent offers
 * real times, the caller picks, the agent writes it down. Everything cut
 * here is still on the page, one disclosure away, unedited.
 *
 * Indices rather than copies, because the lines themselves live in
 * lib/site.ts and there must be exactly one place they are written. The cut
 * alternates speakers on purpose — two turns from the same voice in a row
 * reads as a dropped line, not as an edit.
 */
const CUT = [1, 4, 5, 6] as const;
const CALL: DemoTurn[] = CUT.map((i) => SCRIPT[i]);

/** The beat before the first word: the phone being picked up. */
const ANSWER_MS = 700;
/** The silence between one speaker stopping and the next starting. */
const GAP_MS = 700;
/** How long the finished call stands before the agent answers the next one. */
const REPLAY_MS = 3600;

/* ------------------------------------------------------------------ *
 * The score
 * ------------------------------------------------------------------ */

/**
 * The call, written out as seconds, once, at module load.
 *
 * Every number the timeline is built from is here, and every one of them is
 * derived rather than chosen. `holdFor(line)` says how long a line of that
 * length should take at a comfortable speaking pace with a 1.4s floor; the
 * words of the line divide that time between them, so the stagger is the
 * line's own speed rather than a constant. A long sentence takes longer to
 * say, a short one lands and lingers, and the whole call adds up to
 * something a caller would recognise as a call.
 *
 * `lineAt` is the second each turn's first word is spoken and `runMs` is
 * the second the last one stops — which is also what the log stamps
 * against, so the receipt and the transcript cannot disagree.
 */
const SCORE = (() => {
  /** ms from the start of the call to the first word of each turn. */
  const lineAt: number[] = [];
  let at = ANSWER_MS;

  CALL.forEach((turn, line) => {
    lineAt[line] = at;
    at += holdFor(turn.t) + GAP_MS;
  });

  return { lineAt, runMs: at };
})();

/** Seconds, which is what GSAP is built in. */
const ANSWER = ANSWER_MS / 1000;
const GAP = GAP_MS / 1000;
const RUN_SEC = SCORE.runMs / 1000;
/** The rest after the outcome lands, before the call reads as complete. */
const DONE_HOLD = 0.9;

/**
 * The call log — what the agent DID, stamped as it does it.
 *
 * This is the half of the demo that is not a transcript, and it is the half
 * that sells. Anyone can print a conversation; the claim worth making is
 * that four things happened to a calendar while it was going on. So the
 * column beside the orb is an operations log, and each row is unstamped
 * until the moment in the call that earns it.
 *
 * `at` is an index into CUT, or one of the two ends of the run. The stamps
 * are the call's own clock, read off the score above — not a latency figure
 * measured somewhere else and printed here. The section already says what
 * this is; the log does not get to quietly claim more.
 */
type LogRow = { label: string; detail: string; at: number | "start" | "end" };

const LOG: LogRow[] = [
  { label: "Answered", detail: "First ring. No queue, no menu.", at: "start" },
  { label: "Calendar read", detail: "Two free slots, offered by name.", at: 1 },
  { label: "Appointment written", detail: "Wednesday, 3:00 PM.", at: 3 },
  { label: "Confirmation sent", detail: "Text to the caller's number.", at: "end" },
];

/**
 * When each row fires, and what it reads.
 *
 * Two numbers, and they are not the same one. `at` is the second of the
 * timeline the row is struck on — the pickup completing, the first word of
 * a turn, the last word of the call. `ms` is what the stamp says. They
 * differ once, at the top: "Answered" is struck when the phone is actually
 * picked up, 0.7s in, and reads 0:00, because 0:00 is when the call
 * started. Both are constants, because it is the same call every time it
 * runs. The animation is not the number changing — it is the number
 * LANDING, at the second of the conversation that produced it, which is the
 * one fact a static list cannot state.
 */
const MARKS = LOG.map((row) => {
  if (row.at === "start") return { at: ANSWER, ms: 0 };
  if (row.at === "end") return { at: RUN_SEC, ms: SCORE.runMs };
  return { at: SCORE.lineAt[row.at] / 1000, ms: SCORE.lineAt[row.at] };
});

/**
 * The stage's own labels.
 *
 * Not from lib/site.ts, and that is the point: VOICE_DEMO's strings are
 * "Pre-recorded demo", "Press play", "Playing…". Every one of them promises
 * a recording, and there is no recording. The file is frozen, so the honest
 * words live here until it can be retoned.
 */
const TAG = {
  idle: "Not yet running",
  paused: "Paused",
  done: "Call complete",
} as const;

const RUN = {
  idle: "Run the call",
  playing: "Pause",
  paused: "Resume",
  done: "Run it again",
} as const;

const DISCLOSURE = "Read the whole call";

/** m:ss, from the call's own clock. */
function stampOf(ms: number) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

type Phase = "idle" | "playing" | "paused" | "done";

/** The type set on every line of the call, agent or caller. */
const LINE_TYPE =
  "font-[family-name:var(--font-pp-cinema)] text-[23px] leading-[1.28] font-medium text-balance md:text-[30px]";
/** The speaker mark above it. */
const MARK_TYPE =
  "flex items-center gap-2 text-[11px] leading-4 font-medium tracking-[0.18em] uppercase";

/**
 * The call, playing.
 *
 * `audioSrc` is the seam this was rebuilt to leave open. Nothing about the
 * layout assumes silence — the orb breathes on a boolean, the transport is
 * a transport, and the clock the log stamps against is a table of seconds.
 * When a cleared recording exists, pass it: the element below is driven
 * from the same playhead as everything else, and the only other change the
 * page needs is the sentence in ./demo that currently says there is no
 * audio.
 */
export function VoiceDemo({ audioSrc }: { audioSrc?: string } = {}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  // Two margins, two jobs: `near` fetches GSAP, `inView` plays the call.
  const inView = useInView(stageRef, "-10% 0px");
  const near = useInView(stageRef, "25% 0px");
  const reduce = usePrefersReducedMotion();
  // `near && !reduce`, not `near`: with reduced motion the markup below
  // already rests on the finished call, so the kit is never fetched at all.
  const kit = useMotionKit(near && !reduce);

  /** How many log rows the call has earned. Four changes per run, not a hundred. */
  const [struck, setStruck] = useState(0);
  /** A voice is mid-line right now. The orb breathes on this. */
  const [voiced, setVoiced] = useState(false);
  /** The call has reached its outcome. */
  const [finished, setFinished] = useState(false);
  /** The reader stopped it by hand. */
  const [paused, setPaused] = useState(false);
  /** The reader has touched the section, so the scene stops driving itself. */
  const [taken, setTaken] = useState(false);
  /** The one thing only the scene says, announced once when it says it. */
  const [announce, setAnnounce] = useState("");

  /** The timeline may run. */
  const live = inView && !paused && !finished && !reduce;

  useKitContext(
    kit,
    ({ gsap, SplitText }) => {
      // Reduced motion never gets here: the kit is not fetched for it, and
      // if the setting is flipped mid-visit the context reverts and the
      // markup's own `motion-reduce:` resting state is what shows.
      if (reduce) return;

      const q = gsap.utils.selector(stageRef);
      const lines = q(".vd-line");
      const done = q(".vd-done")[0];
      const doneText = q(".vd-done-text")[0];
      const speakers = q(".vd-speaker");
      const pings = q(".vd-ping");
      if (!done || !doneText) return;

      // Split for motion only: the stage is hidden from assistive tech, the
      // full call is in the disclosure below, and the context reverts the
      // split on unmount — never call .revert() by hand.
      const splits = lines.map((l) => SplitText.create(l, { type: "words", aria: "none" }));
      const doneSplit = SplitText.create(doneText, { type: "words", aria: "none" });
      // Each word on its own compositor layer, so the fade, the rise and the
      // light blur are GPU work rather than a repaint of the line per frame.
      gsap.set([...splits.flatMap((sp) => sp.words), ...doneSplit.words], {
        willChange: "transform, opacity, filter",
        force3D: true,
      });

      const setBar = gsap.quickSetter(barRef.current, "scaleX");
      // The rows are struck in order, so the count is the whole state. Read
      // off the playhead rather than fired by a callback, which is what
      // makes a restart, a pause and a scrub all land in the same place.
      let rows = 0;

      const tl = gsap.timeline({
        paused: true,
        onUpdate: () => {
          setBar(tl.progress());
          const now = tl.time();
          let n = 0;
          // A loop and not a filter: this runs once a frame for as long as
          // the section is on screen, and it must not allocate to do it.
          while (n < MARKS.length && now >= MARKS[n].at) n += 1;
          if (n !== rows) {
            rows = n;
            setStruck(n);
          }
        },
        onComplete: () => setFinished(true),
      });

      // Out, then in: two labels crossing in the same spot read as neither.
      const showSpeaker = (sel: string, at: number) => {
        tl.to(speakers, { autoAlpha: 0, duration: 0.22, ease: "power1.in" }, at - 0.1).to(
          q(sel),
          { autoAlpha: 1, duration: 0.4, ease: "power2.out" },
          at + 0.14,
        );
      };

      tl.set([...lines, done], { autoAlpha: 0 }, 0)
        .set(speakers, { autoAlpha: 0 }, 0)
        .call(() => setAnnounce(""), [], 0);

      let t = ANSWER;
      CALL.forEach((turn, i) => {
        const words = splits[i].words;
        const speak = holdFor(turn.t) / 1000;
        const end = t + speak + GAP;

        showSpeaker(turn.sp === "agent" ? ".vd-speaker-agent" : ".vd-speaker-caller", t - 0.15);
        tl.call(() => setVoiced(true), [], t);

        // The line's own speed: its words share the time the line takes.
        tl.set(lines[i], { autoAlpha: 1, yPercent: 0, filter: "blur(0px)" }, t).fromTo(
          words,
          { autoAlpha: 0, yPercent: 16, filter: "blur(3px)" },
          {
            autoAlpha: 1,
            yPercent: 0,
            filter: "blur(0px)",
            duration: 0.9,
            ease: "power2.out",
            stagger: speak / words.length,
          },
          t,
        );

        tl.call(() => setVoiced(false), [], t + speak);
        tl.to(
          lines[i],
          { autoAlpha: 0, yPercent: -10, filter: "blur(3px)", duration: 0.6, ease: "power2.inOut" },
          end - 0.55,
        );
        t = end;
      });

      // The outcome, at the second the call reaches it.
      showSpeaker(".vd-speaker-done", RUN_SEC - 0.15);
      tl.call(() => setAnnounce(C.captionDone), [], RUN_SEC);
      tl.set(done, { autoAlpha: 1 }, RUN_SEC)
        .fromTo(
          doneSplit.words,
          { autoAlpha: 0, yPercent: 16, filter: "blur(3px)" },
          { autoAlpha: 1, yPercent: 0, filter: "blur(0px)", duration: 1, ease: "power2.out", stagger: 0.06 },
          RUN_SEC,
        )
        .fromTo(
          q(".vd-done-dot"),
          { scale: 0, autoAlpha: 0 },
          { scale: 1, autoAlpha: 1, duration: 0.6, ease: "back.out(2.2)" },
          RUN_SEC + 0.1,
        );

      // The arrival mark the whole house uses, on the row that just earned
      // its stamp. Written last so every ping sits on top of the timeline it
      // punctuates rather than inside the reveal it belongs to.
      MARKS.forEach((m, i) => {
        const dot = pings[i];
        if (dot) ping(tl, [dot], m.at, 13);
      });

      // A rest, appended after everything and written as an empty tween
      // rather than a delay, so the outcome is read before the call reports
      // itself complete.
      tl.to({}, { duration: DONE_HOLD });

      tlRef.current = tl;
      return () => {
        tlRef.current = null;
      };
    },
    // `revertOnUpdate` because the callback splits text and sets inline styles.
    { scope: stageRef, dependencies: [reduce], revertOnUpdate: true },
  );

  // Plays while on screen. `kit` is in the deps because the timeline is
  // built asynchronously, after the kit arrives.
  useEffect(() => {
    const tl = tlRef.current;
    if (!tl) return;
    if (live) tl.play();
    else tl.pause();
  }, [live, kit]);

  /*
    A finished call stands for a beat and then the agent answers the next
    one — until the reader has taken the transport, after which the scene
    never starts itself again.
  */
  useEffect(() => {
    if (!finished || taken || !inView || reduce) return;
    const id = window.setTimeout(() => {
      setAnnounce("");
      setFinished(false);
      tlRef.current?.restart();
    }, REPLAY_MS);
    return () => window.clearTimeout(id);
  }, [finished, taken, inView, reduce]);

  // The audio seam, driven from the same playhead as everything else.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (live) void el.play().catch(() => {});
    else el.pause();
  }, [live]);

  /*
    The handover. A deliberate pointer, key or focus inside the stage and the
    scene never replays itself again — the call already running plays out,
    but the pill below the orb is the reader's from then on, permanently.
    Hover is not an interaction: passing a mouse over a section should not
    stop it telling you what the product does.
  */
  const take = () => setTaken(true);

  /*
    "idle" only when the call is genuinely not running — off screen, before
    it has been reached. The 700ms of ring at the top of every run is part of
    the call, so the transport reads "Pause" through it rather than
    flickering back to "Run the call" once a minute.
  */
  const phase: Phase =
    reduce || finished ? "done"
    : paused ? "paused"
    : live ? "playing"
    : "idle";

  const toggle = () => {
    take();
    // Under reduced motion the call is already complete and nothing is
    // moving, so there is nothing for the transport to do. It stays on the
    // page rather than vanishing under a media query.
    if (reduce) return;
    if (finished) {
      setAnnounce("");
      setFinished(false);
      setPaused(false);
      tlRef.current?.restart();
      return;
    }
    setPaused((p) => !p);
  };

  // The orb breathes only while a voice is actually mid-line. Paused, off
  // screen or complete, it rests — a sphere pulsing at a stopped call is the
  // kind of movement that means nothing.
  const speaking = voiced && phase === "playing";
  /** The state label takes the mark's place whenever nobody is speaking. */
  const held = phase === "idle" || phase === "paused";
  /** Rows earned. Reduced motion reads the finished receipt straight away. */
  const rows = reduce ? LOG.length : struck;
  /** The row the call is working on right now — lit, but not yet stamped. */
  const working = phase === "playing" && rows < LOG.length ? rows : -1;

  const RunIcon =
    phase === "playing" ? Pause : phase === "done" ? RotateCcw : ArrowRight;

  return (
    <Frame className="mt-12 md:mt-16">
      <div
        ref={stageRef}
        onPointerDown={take}
        onKeyDown={take}
        onFocusCapture={take}
        className="grid grid-cols-1 items-start gap-10 md:grid-cols-[minmax(0,1fr)_minmax(250px,320px)] md:gap-12"
      >
        {/* ---------- the stage: the orb, and the line it is on ---------- */}
        {/*
          The one soft surface in the section. A card at --pp-card holds the
          thing that is moving, and everything that is merely true — the log,
          the transcript — stays on the open white page beside it. That is the
          light system's way of saying "look here" without a glow.
        */}
        <div className="relative flex flex-col items-center overflow-hidden rounded-[24px] bg-pp-card px-5 py-10 text-center md:px-10 md:py-14">
          <Orb
            mesh={ORB_MESHES.violet}
            speaking={speaking}
            className="size-20 md:size-28"
          />

          {/* Speaker mark. Under the orb rather than over it — the orb is a
              circle and the copy is longest on the narrowest screens, so
              overlaying it clipped the label.

              Four labels in one grid cell, so nothing below can move when
              they change. The three the timeline owns crossfade between
              themselves; the reader's own state — not started, paused —
              takes the cell from all of them at once, which is why it is a
              wrapper's opacity and not a fifth thing for GSAP to fight over. */}
          <div aria-hidden className="mt-6 grid h-4 w-full place-items-center">
            <div
              className={cn(
                "col-start-1 row-start-1 grid place-items-center transition-opacity duration-300",
                held && "opacity-0",
              )}
            >
              <p className={cn("vd-speaker vd-speaker-agent invisible col-start-1 row-start-1 text-pp-accent", MARK_TYPE)}>
                <span className="size-[5px] shrink-0 rounded-full bg-current" />
                {C.agentName} is speaking
              </p>
              <p className={cn("vd-speaker vd-speaker-caller invisible col-start-1 row-start-1 text-pp-muted", MARK_TYPE)}>
                <span className="size-[5px] shrink-0 rounded-full bg-current" />
                {C.callerName} is speaking
              </p>
              {/* With reduced motion the call reads as over from the first
                  frame, so this is the one label that rests visible. */}
              <p
                className={cn(
                  "vd-speaker vd-speaker-done invisible col-start-1 row-start-1 text-pp-accent motion-reduce:visible",
                  MARK_TYPE,
                )}
              >
                <span className="size-[5px] shrink-0 rounded-full bg-current" />
                {TAG.done}
              </p>
            </div>
            <p
              className={cn(
                "col-start-1 row-start-1 text-pp-muted transition-opacity duration-300",
                MARK_TYPE,
                !held && "opacity-0",
              )}
            >
              <span className="size-[5px] shrink-0 rounded-full bg-current" />
              {phase === "paused" ? TAG.paused : TAG.idle}
            </p>
          </div>

          {/* The call itself. Every line of it is in this one grid cell from
              the server's first paint, invisible, at the height of the
              tallest — so a turn arriving moves nothing under it and the
              transport below never jumps. */}
          <div
            aria-hidden
            className="mt-5 grid min-h-[176px] w-full max-w-[640px] content-start justify-items-center md:min-h-[190px]"
          >
            {CALL.map((turn, i) => (
              <p
                key={CUT[i]}
                className={cn(
                  "vd-line invisible col-start-1 row-start-1 text-pp-ink",
                  LINE_TYPE,
                  // The caller is a voice that was heard; the agent says what
                  // was written for it. Never the only signal — the mark
                  // above already names and colours the speaker.
                  turn.sp !== "agent" && "italic",
                )}
              >
                {turn.t}
              </p>
            ))}

            {/* The outcome. It rests visible under reduced motion, which is
                why it is authored here rather than mounted on a state
                change: there is one composition, and the timeline either
                plays into it or it is simply already there. */}
            <p
              className={cn(
                "vd-done invisible col-start-1 row-start-1 flex items-center justify-center gap-2.5 text-pp-accent italic motion-reduce:visible",
                LINE_TYPE,
              )}
            >
              {/* No Tailwind scale utility here: GSAP writes `transform`, and
                  Tailwind v4's `scale-*` sets the separate `scale` property,
                  which would multiply it back to nothing. */}
              <span className="vd-done-dot inline-block size-2.5 shrink-0 rounded-full bg-pp-accent" />
              <span className="vd-done-text">{C.captionDone}</span>
            </p>
          </div>

          {/* The transport. A plain white pill, the house's button-that-is-
              not-a-link, and not a round ▶: there is nothing to hear, and a
              play triangle on a voice page is a promise of audio however
              carefully the copy above it is worded.

              It is also the first button in this section, and ./demo's
              projectionist finds it that way and reads its caption to learn
              what a running call looks like. Nothing may be added above it. */}
          <button
            type="button"
            onClick={toggle}
            // `hover:bg-pp-band` and not the primitives' `hover:bg-pp-card`:
            // this pill stands ON a pp-card surface, and dimming it to the
            // card colour would make it disappear into the stage.
            className="pp-shadow-btn mt-2 inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-white px-5 text-base whitespace-nowrap text-pp-ink transition-[background-color,scale] duration-200 hover:bg-pp-band active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink"
          >
            <RunIcon className="size-4 shrink-0" strokeWidth={2} />
            {RUN[phase]}
          </button>

          <div
            aria-hidden
            className="mt-8 h-[2px] w-full max-w-[420px] overflow-hidden rounded-full bg-pp-ink/10"
          >
            {/*
              The playhead, and nothing else — no second clock to keep in
              step with the first. `tl.progress()` is written straight to the
              transform by a quickSetter once a frame, so the bar is the
              timeline rather than a transition chasing it.

              Transform set inline, not with a scale utility, for the same
              reason as the outcome's dot above.
            */}
            <span
              ref={barRef}
              className="block h-full origin-left bg-pp-ink"
              style={{ transform: `scaleX(${reduce ? 1 : 0})` }}
            />
          </div>

          {/* The one line the scene states and the disclosure below does
              not: what the call actually achieved. Announced once, when the
              call reaches it, rather than streamed word by word. */}
          <p className="sr-only" aria-live="polite">
            {reduce ? C.captionDone : announce}
          </p>
        </div>

        {/* ---------- the call log ---------- */}
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-[11px] leading-4 font-medium tracking-[0.18em] text-pp-muted uppercase">
              Call log
            </h3>
            <span aria-hidden className="h-px flex-1 bg-pp-rule" />
          </div>

          {/*
            Every row is legible before the call reaches it — the reader who
            arrives mid-call still learns what the agent does. What the scene
            adds is the moment: the node fills and the stamp lands at the
            second of the conversation that produced it, and the row the
            agent is working on right now carries an open accent ring until
            it does.
          */}
          <ol className="mt-4">
            {LOG.map((row, i) => {
              const done = i < rows;
              return (
                <li
                  key={row.label}
                  className="border-t border-pp-rule py-4 first:border-t-0 first:pt-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="relative flex size-[9px] shrink-0 items-center justify-center">
                      {/* The arrival mark: one ring out of the node at the
                          instant the row is earned. It is the house's own
                          `ping`, on the house's own timeline — the same
                          punctuation every figure on the product pages
                          gives to something landing. */}
                      <svg
                        aria-hidden
                        viewBox="0 0 28 28"
                        className="pointer-events-none absolute top-1/2 left-1/2 size-7 -translate-x-1/2 -translate-y-1/2 overflow-visible"
                        fill="none"
                      >
                        <circle
                          className="vd-ping"
                          cx="14"
                          cy="14"
                          r="4.4"
                          stroke="var(--pp-accent)"
                          strokeWidth="1.6"
                          opacity="0"
                        />
                      </svg>
                      {/* The node grammar the light pages draw everywhere: a
                          ring that fills, never one that grows, so a row
                          landing moves nothing under it. */}
                      <span
                        aria-hidden
                        className={cn(
                          "size-[9px] rounded-full border-[1.6px] transition-[background-color,border-color] duration-300",
                          done ? "border-pp-accent bg-pp-accent"
                          : working === i ? "border-pp-accent bg-transparent"
                          : "border-pp-muted bg-transparent",
                        )}
                      />
                    </span>
                    <span
                      className={cn(
                        "text-[15px] leading-[22px] font-medium transition-colors duration-300",
                        done ? "text-pp-ink" : "text-pp-ink/70",
                      )}
                    >
                      {row.label}
                    </span>
                    <span className="ml-auto text-[12px] leading-4 tabular-nums tracking-[0.1em]">
                      {done ? (
                        <span
                          className={cn(
                            "block text-pp-accent",
                            !reduce &&
                              "animate-in fade-in-0 slide-in-from-top-1 duration-300 fill-mode-both",
                          )}
                        >
                          {stampOf(MARKS[i].ms)}
                        </span>
                      ) : (
                        <span className="block text-pp-muted">—:——</span>
                      )}
                    </span>
                  </div>
                  <p className="mt-1 pl-[21px] text-[14px] leading-5 text-pp-muted">
                    {row.detail}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      {/* ---------- the whole call, on request ---------- */}
      {/*
        A native `details`, so it works before hydration and so the full
        script is in the accessibility tree whether or not anyone opens it —
        which is also the answer to the stage above being hidden from it:
        four lines share one cell up there, and a live region reading them
        as they are spoken would be unusable.

        Set exactly like every other transcript on the light pages: a
        coloured speaker label, then the line. No bubbles and no two-column
        chat — a transcript is a script, and the page's one card is upstairs
        where the call is actually running.
      */}
      <details className="group mt-12 border-t border-pp-rule pt-6 md:mt-16">
        <summary className="inline-flex cursor-pointer list-none items-center gap-2 text-[12px] leading-4 font-medium tracking-[0.14em] text-pp-muted uppercase transition-colors duration-300 hover:text-pp-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-pp-ink [&::-webkit-details-marker]:hidden">
          <ChevronRight
            aria-hidden
            className="size-3.5 shrink-0 transition-transform duration-300 group-open:rotate-90"
            strokeWidth={2}
          />
          {DISCLOSURE}
        </summary>

        <ol className="mt-6 flex max-w-[720px] flex-col gap-5">
          {SCRIPT.map((b, i) => {
            const agent = b.sp === "agent";
            return (
              <li key={i}>
                <p
                  className={cn(
                    "text-[11px] leading-4 font-medium tracking-[0.12em] text-pretty uppercase",
                    agent ? "text-pp-accent" : "text-pp-muted",
                  )}
                >
                  {agent ? C.agentName : C.callerName}
                </p>
                {agent ? (
                  <p className="mt-1 text-[16px] leading-[26px] text-pp-ink">{b.t}</p>
                ) : (
                  <p className="mt-1 font-[family-name:var(--font-pp-cinema)] text-[19px] leading-7 text-pp-ink italic md:text-[21px] md:leading-8">
                    &ldquo;{b.t}&rdquo;
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      </details>

      {audioSrc ? (
        <audio ref={audioRef} src={audioSrc} preload="none" className="hidden" />
      ) : null}
    </Frame>
  );
}
