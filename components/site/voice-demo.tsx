"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronRight, Pause, RotateCcw } from "lucide-react";
import {
  VOICE_DEMO as C,
  VOICE_DEMO_SCRIPT as SCRIPT,
  type DemoTurn,
} from "@/lib/site";
import { cn } from "@/lib/utils";
import { Frame, Orb, ORB_MESHES } from "./product/primitives";
import { holdFor, useInView, usePrefersReducedMotion } from "./product/timing";

/**
 * THE CALL ANSWERS ITSELF.
 *
 * The scene is a phone call taking place. Scroll the section into view and
 * the agent picks up on the first beat, the caller asks for an appointment,
 * the agent reads a calendar out loud, the caller chooses, and the agent
 * writes the booking down — twenty-one seconds, start to finish, then a
 * breath and the next call. Beside it the operations log fills in as it
 * happens: answered, calendar read, appointment written, confirmation sent,
 * each stamped at the second of the call that earned it.
 *
 * That is the argument, and it is why the scene plays rather than arrives.
 * A section that animates because the reader scrolled is decoration: the
 * page moved, nothing was demonstrated. This section moves because the
 * product is working. Nobody has to press anything to find out what Neuro
 * Tech Voice does — it is doing it, and the log is the receipt.
 *
 * **The clock is the house clock.** `holdFor(line)` gives every turn its
 * length at a reading pace and the words divide that length between them,
 * so a long line takes longer and no word outruns the eye. `useInView`
 * gates the whole loop, so a backgrounded tab runs nothing, and the single
 * timer is cleared on every change and on unmount.
 *
 * **The movement is CSS.** React only advances one integer, `head`; the
 * `animate-in` reveals and the `transition-*` utilities do the animating,
 * at the house's own 300 and 500ms. There is no framer-motion in this file
 * and no hand-rolled curve.
 *
 * **The reader can take it.** The first pointer, key or focus event inside
 * the stage hands the transport over for good: the call in progress plays
 * out, but nothing auto-starts again and the pill below the orb is the only
 * thing that moves the scene from then on. `usePrefersReducedMotion` readers
 * get the finished call — every stamp struck, the bar full — the instant it
 * mounts, and no timer ever starts.
 *
 * **THE ORB IS THE LIGHT SYSTEM'S ORB.** What used to sit here was a WebGL
 * plasma sphere with a neural core, a 2D layer of particles, synapses,
 * ribbons and an equalizer ring, on its own rAF outside React, reading the
 * `--cover-orb-*` ramp off `.cover` at runtime. On white it had nowhere to
 * stand: additive light drawn on paper is dirt, and the palette it sampled
 * does not exist on this section any more. So it is gone, and the page's
 * own `<Orb mesh={ORB_MESHES.violet}>` takes its place — pure CSS, a mesh
 * of the product's violet drifting under a film of grain, breathing on
 * `data-speaking` while a line is being spoken and resting in the silence
 * between two turns. Three hundred lines of shader for a sphere nobody can
 * hear was never the argument; the argument is the log beside it.
 *
 * **Two speakers, told apart three ways and never by one.** The label above
 * the line carries the colour (violet for the agent — the product acting;
 * muted for the caller), the label carries the name in words, and the type
 * carries the voice: the caller is quoted in the cinema serif, italic,
 * because a caller is a voice that was heard, and the agent is set upright
 * because what the agent says is what was written for it. That is the same
 * law the light pages set every transcript by, and it is why the orb does
 * not need to change hue to mean something.
 *
 * There is no recording in this repository, and nothing here pretends
 * otherwise: what plays is the transcript, at the pace the conversation
 * took. `audioSrc` is the seam left open for the day there is something to
 * hear; nothing in the scene has to move to take it.
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
 * The call, written out as beats, once, at module load.
 *
 * A beat is one tick of the scene: a word arriving, or the silence at the
 * end of a turn. The component holds a single integer — which beat we are
 * on — and everything on screen is read off this table. That is what makes
 * the scene cheap enough to leave running: one `setTimeout` at a time, one
 * state update per beat, and every derived value a lookup.
 *
 * The pacing is the house's, not a number invented here. `holdFor(line)`
 * says how long a line of that length should sit before the next one, at a
 * comfortable reading speed with a 1.4s floor; the words of the line divide
 * that time between them. A long sentence takes longer to say, a short one
 * lands and lingers, and the whole call adds up to something a caller would
 * recognise as a call.
 */
type Beat = {
  /** Which turn of the cut is on screen. */
  line: number;
  /** How many of that turn's words have been said. */
  shown: number;
  /** Words said in the whole call so far — what the bar tracks. */
  spoken: number;
  /** Whether a voice is mid-line right now. The orb breathes on this. */
  speaks: boolean;
  /** How long this beat holds before the next one. */
  wait: number;
};

const SCORE = (() => {
  const beats: Beat[] = [];
  /** ms from the start of the call to the first word of each turn. */
  const lineAt: number[] = [];
  let at = ANSWER_MS;
  let spoken = 0;

  CALL.forEach((turn, line) => {
    const words = turn.t.split(" ");
    const per = holdFor(turn.t) / words.length;
    lineAt[line] = at;

    words.forEach((_, i) => {
      spoken += 1;
      beats.push({ line, shown: i + 1, spoken, speaks: true, wait: per });
      at += per;
    });

    // The turn ends: the last word stays up, the orb rests, nobody speaks.
    beats.push({ line, shown: words.length, spoken, speaks: false, wait: GAP_MS });
    at += GAP_MS;
  });

  return { beats, lineAt, words: spoken, runMs: at };
})();

const BEATS = SCORE.beats;
/** The last head: one past the final beat, where the call reads complete. */
const END = BEATS.length + 1;

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
 * When each row fires, in beats and in seconds.
 *
 * Both are constants, because the call is the same call every time it runs.
 * The animation is not the number changing — it is the number LANDING, at
 * the second of the conversation that produced it, which is the one fact a
 * static list cannot state.
 */
const MARKS = LOG.map((row) => {
  if (row.at === "start") return { head: 1, ms: 0 };
  if (row.at === "end") return { head: END, ms: SCORE.runMs };
  const first = BEATS.findIndex((b) => b.line === row.at);
  return { head: first + 1, ms: SCORE.lineAt[row.at as number] };
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

/**
 * The call, playing.
 *
 * `audioSrc` is the seam this was rebuilt to leave open. Nothing about the
 * layout assumes silence — the orb breathes on a boolean, the transport is
 * a transport, and the clock the log stamps against is a table of numbers.
 * When a cleared recording exists, pass it: the element below is driven
 * from the one state the scene has, and the only other change the page
 * needs is the sentence in ./demo that currently says there is no audio.
 */
export function VoiceDemo({ audioSrc }: { audioSrc?: string } = {}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const inView = useInView(stageRef, "-10% 0px");
  const reduce = usePrefersReducedMotion();

  /** 0 = the phone ringing, 1..BEATS.length = a beat, END = call complete. */
  const [head, setHead] = useState(0);
  const [paused, setPaused] = useState(false);
  /** The reader has touched the section, so the scene stops driving itself. */
  const [taken, setTaken] = useState(false);

  /*
    Reduced motion: the finished call, immediately and permanently. Every
    stamp struck, the bar full, the outcome on screen — the most informative
    state there is, and not one timer to get to it. Derived at render rather
    than written into state, so there is no effect, no cascading render and
    no frame in which the scene is blank.
  */
  const at = reduce ? END : head;

  /** The clock may tick. */
  const live = inView && !paused && !reduce;
  /** A call is actually in progress. */
  const running = live && at < END;

  /*
    The whole engine. One timer, holding the current beat for as long as the
    score says, then advancing by one. It does not run off screen, it does
    not run when the reader has paused it, it does not run under reduced
    motion, and it does not restart the call once the reader has taken the
    transport. React strict mode, a resize, a tab switch — every path out of
    here clears the timeout.
  */
  useEffect(() => {
    if (!live) return;
    if (head >= END && taken) return;

    const wait =
      head === 0 ? ANSWER_MS
      : head < END ? BEATS[head - 1].wait
      : REPLAY_MS;

    const id = window.setTimeout(
      () => setHead((h) => (h >= END ? 0 : h + 1)),
      wait,
    );
    return () => window.clearTimeout(id);
  }, [live, head, taken]);

  // The audio seam, driven from the same one state.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (running) void el.play().catch(() => {});
    else el.pause();
  }, [running]);

  useEffect(() => {
    if (head === 0 && audioRef.current) audioRef.current.currentTime = 0;
  }, [head]);

  /*
    The handover. A deliberate pointer, key or focus inside the stage and the
    scene never starts itself again — the call already running plays out, but
    the pill below the orb is the reader's from then on, permanently. Hover
    is not an interaction: passing a mouse over a section should not stop it
    telling you what the product does.
  */
  const take = () => setTaken(true);

  const beat = at > 0 && at < END ? BEATS[at - 1] : null;
  const line = beat ? beat.line : -1;
  const shown = beat ? beat.shown : 0;
  // The orb breathes only while a voice is actually mid-line. Paused, off
  // screen or complete, it rests — a sphere pulsing at a stopped call is
  // the kind of movement that means nothing.
  const speaking = live && beat !== null && beat.speaks;
  const progress = at >= END ? 1 : beat ? beat.spoken / SCORE.words : 0;

  /*
    "idle" only when the phone is genuinely not ringing — head 0 AND stopped.
    The 700ms of ring at the top of every loop is part of the call, so the
    transport reads "Pause" through it rather than flickering back to
    "Run the call" once a minute.
  */
  const phase: Phase =
    at >= END ? "done"
    : at === 0 && !running ? "idle"
    : paused ? "paused"
    : "playing";

  const toggle = () => {
    take();
    // Under reduced motion the call is already complete and nothing is
    // moving, so there is nothing for the transport to do. It stays on the
    // page rather than vanishing under a media query.
    if (reduce) return;
    if (phase === "done") {
      setHead(0);
      setPaused(false);
      return;
    }
    setPaused(phase === "playing");
  };

  const turn = line >= 0 ? CALL[line] : null;
  const isAgent = turn?.sp === "agent";
  const words = turn ? turn.t.split(" ") : [];

  const tag =
    phase === "paused" ? TAG.paused
    : phase === "done" ? TAG.done
    : turn ? `${isAgent ? C.agentName : C.callerName} is speaking`
    : TAG.idle;

  const RunIcon =
    phase === "playing" ? Pause : phase === "done" ? RotateCcw : ArrowRight;

  /** The row the call is working on right now — lit, but not yet stamped. */
  const working = running ? MARKS.findIndex((m) => at < m.head) : -1;

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
              overlaying it clipped the label. */}
          <p
            className={cn(
              "mt-6 flex items-center gap-2 text-[11px] leading-4 font-medium tracking-[0.18em] uppercase transition-colors duration-500",
              turn && isAgent ? "text-pp-accent" : "text-pp-muted",
            )}
          >
            <span aria-hidden className="size-[5px] shrink-0 rounded-full bg-current" />
            {tag}
          </p>

          {/* The line itself. Fixed minimum height so the transport below
              never jumps as lines of different lengths come and go. */}
          <div className="mt-5 flex min-h-[176px] w-full max-w-[640px] flex-col items-center justify-start md:min-h-[190px]">
            <p
              className={cn(
                "font-[family-name:var(--font-pp-cinema)] text-[23px] leading-[1.28] font-medium text-balance text-pp-ink md:text-[30px]",
                // The caller is a voice that was heard; the agent says what
                // was written for it. Never the only signal — the label
                // above already names and colours the speaker.
                turn && !isAgent && "italic",
              )}
            >
              {phase === "done" ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-2.5 text-pp-accent italic",
                    !reduce && "animate-in fade-in-0 duration-500 fill-mode-both",
                  )}
                >
                  <span
                    aria-hidden
                    className="inline-block size-2.5 shrink-0 rounded-full bg-pp-accent"
                  />
                  {C.captionDone}
                </span>
              ) : (
                words.map((w, i) => (
                  /*
                    A word is said, and it arrives: out of a short blur, up
                    off the baseline, over the house's 500ms. The key carries
                    the line, so every turn mounts a fresh set of spans and
                    the first word of a line animates like all the others;
                    the unsaid ones hold their space at zero opacity so the
                    line never reflows underneath the one being spoken.

                    No transform on the type itself beyond the lift — scale
                    was the one thing the eye could catch, because type
                    growing back to size wobbles its own sidebearings, and on
                    a word already translating and defocusing that is the
                    part that reads as a pop.
                  */
                  /*
                    The space is a sibling of the word, never a child of it.
                    Inside the `inline-block` it disappeared: CSS trims
                    whitespace at the edges of an inline-block box, so every
                    line rendered as one run-on string — "Theboiler'smaking".
                    Outside, between two inline-blocks, it is ordinary inline
                    whitespace and sets exactly as the font intends.
                  */
                  <Fragment key={`${line}-${i}`}>
                    <span
                      className={cn(
                        "inline-block",
                        i < shown
                          ? "animate-in fade-in-0 blur-in-4 slide-in-from-bottom-1 duration-500 fill-mode-both"
                          : "opacity-0",
                      )}
                    >
                      {w}
                    </span>
                    {i < words.length - 1 ? " " : ""}
                  </Fragment>
                ))
              )}
            </p>
          </div>

          {/* The transport. A plain white pill, the house's button-that-is-
              not-a-link, and not a round ▶: there is nothing to hear, and a
              play triangle on a voice page is a promise of audio however
              carefully the copy above it is worded. */}
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
              Words spoken, not seconds elapsed, and the only place a length
              is hard-coded: 300ms of linear width, which is shorter than the
              beat that moves it, so the bar is always caught up and never
              sliding on its own.
            */}
            <div
              className="h-full bg-pp-ink transition-[width] duration-300 ease-linear"
              style={{ width: `${(progress * 100).toFixed(1)}%` }}
            />
          </div>
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
              const struck = at >= MARKS[i].head;
              return (
                <li
                  key={row.label}
                  className="border-t border-pp-rule py-4 first:border-t-0 first:pt-0"
                >
                  <div className="flex items-center gap-3">
                    {/* The node grammar the light pages draw everywhere: a
                        ring that fills, never one that grows, so a row
                        landing moves nothing under it. */}
                    <span
                      aria-hidden
                      className={cn(
                        "size-[9px] shrink-0 rounded-full border-[1.6px] transition-[background-color,border-color] duration-300",
                        struck ? "border-pp-accent bg-pp-accent"
                        : working === i ? "border-pp-accent bg-transparent"
                        : "border-pp-muted bg-transparent",
                      )}
                    />
                    <span
                      className={cn(
                        "text-[15px] leading-[22px] font-medium transition-colors duration-300",
                        struck ? "text-pp-ink" : "text-pp-ink/70",
                      )}
                    >
                      {row.label}
                    </span>
                    <span className="ml-auto text-[12px] leading-4 tabular-nums tracking-[0.1em]">
                      {struck ? (
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
        which is also the answer to the caption above never being announced:
        the words stream one at a time up there, and a live region reading
        them would be unusable.

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
