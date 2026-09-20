"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ChevronRight, Pause, RotateCcw } from "lucide-react";
import {
  VOICE_DEMO as C,
  VOICE_DEMO_SCRIPT as SCRIPT,
  type DemoTurn,
} from "@/lib/site";
import { cn } from "@/lib/utils";
import { Frame, Orb, ORB_MESHES } from "./product/primitives";
import { EASE } from "./reveal";

/**
 * A real call, reconstructed and replayed. Silently, and it says so.
 *
 * There is no recording in this repository. The file used to call itself
 * "the pre-recorded call, played back", and every label it printed —
 * "Pre-recorded demo", "Press play", "Playing…" — sold a reader on audio
 * that has never existed. What actually runs is the transcript, revealed at
 * the pace the conversation took. That is a genuinely useful thing to show
 * and a dishonest thing to dress as a recording, so the transport says what
 * it does and ./demo states the concession in the sub above it. `audioSrc`
 * is the seam left open for the day there is something to hear; nothing
 * here has to move to take it.
 *
 * **THE ORB IS THE LIGHT SYSTEM'S ORB.** What used to sit here was a WebGL
 * plasma sphere with a neural core, a 2D layer of particles, synapses,
 * ribbons and an equalizer ring, on its own rAF outside React, reading the
 * `--cover-orb-*` ramp off `.cover` at runtime. On white it had nowhere to
 * stand: additive light drawn on paper is dirt, and the palette it sampled
 * does not exist on this section any more. So it is gone, and the page's
 * own `<Orb mesh={ORB_MESHES.violet}>` takes its place — pure CSS, a mesh
 * of the product's violet drifting under a film of grain, breathing on
 * `data-speaking` while a line is being spoken. Three hundred lines of
 * shader for a sphere nobody can hear was never the argument; the argument
 * is the log beside it.
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
 * Motion is scroll- and clock-bound, not decorative. Words still arrive one
 * at a time out of a short blur, the stamps still land at the instant the
 * script earns them, and the bar still tracks words spoken. What is gone is
 * everything that only glowed.
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

const GAP_MS = 700;
const TOTAL_WORDS = CALL.reduce((s, l) => s + l.t.split(" ").length, 0);

/**
 * The call log — what the agent DID, stamped as it does it.
 *
 * This is the half of the demo that is not a transcript, and it is the half
 * that sells. Anyone can print a conversation; the claim worth making is
 * that four things happened to a calendar while it was going on. So the
 * column beside the orb is an operations log, and each line stays blank
 * until the moment in the script that earns it.
 *
 * `at` is an index into CUT, or one of the two ends of the run. The stamps
 * are the reconstruction's own clock — elapsed time since the replay
 * started, paused when it is paused — and not a latency figure we measured
 * somewhere else and printed here. The section already says what this is;
 * the log does not get to quietly claim more.
 */
type LogRow = { label: string; detail: string; at: number | "start" | "end" };

const LOG: LogRow[] = [
  { label: "Answered", detail: "First ring. No queue, no menu.", at: "start" },
  { label: "Calendar read", detail: "Two free slots, offered by name.", at: 1 },
  { label: "Appointment written", detail: "Wednesday, 3:00 PM.", at: 3 },
  { label: "Confirmation sent", detail: "Text to the caller's number.", at: "end" },
];

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

/**
 * Longer words linger, short ones flow — clamped so the rhythm holds.
 *
 * The clamp is deliberately narrow. Each word's reveal runs far longer than
 * the gap to the next one, so several are always mid-flight; widening the
 * spread makes that overlap lurch between two and six words and the stream
 * reads as ticking rather than flowing. The average is unchanged, so the
 * call still takes the same time end to end.
 */
function wordDelay(w: string) {
  return Math.max(200, Math.min(360, 235 * 0.6 + w.replace(/[^a-zA-Z0-9]/g, "").length * 30));
}

function wordsBefore(line: number, word: number) {
  let c = 0;
  for (let i = 0; i < line; i++) c += CALL[i].t.split(" ").length;
  return c + word;
}

/** m:ss, from the replay's own clock. */
function stampOf(ms: number) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

type Phase = "idle" | "playing" | "paused" | "done";

/**
 * The call, replayed.
 *
 * `audioSrc` is the seam this was rebuilt to leave open. Nothing about the
 * layout assumes silence — the orb breathes on a boolean, the transport is
 * a transport, and the clock the log stamps against is one number. When a
 * cleared recording exists, pass it: the element below is driven from the
 * same two places the loop is (start and pause), and the only other change
 * the page needs is the sentence in ./demo that currently says there is no
 * audio.
 */
export function VoiceDemo({ audioSrc }: { audioSrc?: string } = {}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const reduce = useReducedMotion();

  const [phase, setPhase] = useState<Phase>("idle");
  const [line, setLine] = useState(-1);
  const [revealed, setRevealed] = useState(0);
  /** Words restored on resume — they reappear without re-animating. */
  const [restored, setRestored] = useState(0);
  const [spoken, setSpoken] = useState(0);
  /**
   * Whether a line is being spoken right now — the orb's breathing, and
   * nothing else. Explicit state rather than `line >= 0`, because the run
   * holds the last line on screen through the pause between turns and the
   * orb must rest there, exactly where the old engine was told `speak(null)`.
   */
  const [speaking, setSpeaking] = useState(false);
  /** Elapsed ms at which each log row fired; -1 until it does. */
  const [stamps, setStamps] = useState<number[]>(() => LOG.map(() => -1));

  // The exact resume point, and the flag that unwinds the async loop.
  const pos = useRef({ line: 0, word: 0 });
  const cancelled = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  /*
    The replay's clock. Accumulated rather than read off one start time,
    because the reader can pause: a wall-clock difference would keep
    counting through the pause and stamp the booking a minute late for
    someone who stopped to read a line twice.
  */
  const clock = useRef({ accum: 0, since: 0 });
  const elapsed = () =>
    clock.current.accum +
    (clock.current.since ? performance.now() - clock.current.since : 0);

  const fire = useCallback((i: number) => {
    const at = elapsed();
    setStamps((s) => (s[i] >= 0 ? s : s.map((v, k) => (k === i ? at : v))));
  }, []);

  useEffect(
    () => () => {
      cancelled.current = true;
      timers.current.forEach(clearTimeout);
    },
    [],
  );

  const wait = (ms: number) =>
    new Promise<void>((res) => {
      timers.current.push(setTimeout(res, ms));
    });

  const play = useCallback(async () => {
    cancelled.current = false;
    setPhase("playing");

    // Start over only if we finished, or were never mid-conversation.
    const fresh = pos.current.line === 0 && pos.current.word === 0;
    if (fresh) {
      setSpoken(0);
      setStamps(LOG.map(() => -1));
      clock.current.accum = 0;
    }
    clock.current.since = performance.now();
    if (audioRef.current) void audioRef.current.play().catch(() => {});

    LOG.forEach((row, i) => {
      if (row.at === "start") fire(i);
    });

    let done = wordsBefore(pos.current.line, pos.current.word);
    setSpoken(done);

    for (let li = pos.current.line; li < CALL.length; li++) {
      if (cancelled.current) return;
      const turn = CALL[li];
      const words = turn.t.split(" ");
      const from = li === pos.current.line ? pos.current.word : 0;

      setSpeaking(true);
      setLine(li);
      // Reduced motion gets the sequence without the travel: marking every
      // word as restored is what switches the reveal to `transition-none`,
      // so the line still arrives word by word and nothing slides or blurs.
      setRestored(reduce ? words.length : from);
      setRevealed(from);

      LOG.forEach((row, i) => {
        if (row.at === li) fire(i);
      });

      for (let i = from; i < words.length; i++) {
        if (cancelled.current) return;
        setRevealed(i + 1);
        done++;
        setSpoken(done);
        pos.current = { line: li, word: i + 1 };
        await wait(wordDelay(words[i]));
      }
      if (cancelled.current) return;

      pos.current = { line: li + 1, word: 0 };
      setSpeaking(false);
      await wait(GAP_MS);
    }

    if (cancelled.current) return;
    LOG.forEach((row, i) => {
      if (row.at === "end") fire(i);
    });
    clock.current.accum = elapsed();
    clock.current.since = 0;
    setSpeaking(false);
    setLine(-1);
    setSpoken(TOTAL_WORDS);
    pos.current = { line: 0, word: 0 };
    setPhase("done");
  }, [fire, reduce]);

  const toggle = () => {
    if (phase === "playing") {
      // Freeze everything; `pos` already holds the exact word to resume on.
      cancelled.current = true;
      timers.current.forEach(clearTimeout);
      timers.current = [];
      clock.current.accum = elapsed();
      clock.current.since = 0;
      audioRef.current?.pause();
      setSpeaking(false);
      setPhase("paused");
    } else {
      void play();
    }
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

  return (
    <Frame className="mt-12 md:mt-16">
      <div className="grid grid-cols-1 items-start gap-10 md:grid-cols-[minmax(0,1fr)_minmax(250px,320px)] md:gap-12">
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
                <span className="inline-flex items-center gap-2.5 text-pp-accent italic">
                  <span
                    aria-hidden
                    className="inline-block size-2.5 shrink-0 rounded-full bg-pp-accent"
                  />
                  {C.captionDone}
                </span>
              ) : (
                words.map((w, i) => (
                  /*
                    No scale. It was the one transform the eye could catch:
                    type growing back to size wobbles its own sidebearings, and
                    on a word that is already translating and defocusing it is
                    the part that reads as a pop.

                    And a gentler curve than the site's EASE. Expo-out is built
                    for a one-shot arrival — it spends its motion in the first
                    quarter and coasts, which is right for a section sliding
                    into view and wrong here, where the coast is invisible and
                    every word lands on the same hard tick. This spreads the
                    travel across the whole 820ms, so each word is still
                    settling as the next three begin and the line resolves as
                    one continuous movement.
                  */
                  <span
                    key={`${line}-${i}`}
                    className={cn(
                      "inline-block will-change-[opacity,transform,filter]",
                      i < revealed
                        ? "translate-y-0 opacity-100 blur-0"
                        : "translate-y-[7px] opacity-0 blur-[5px]",
                      i < restored
                        ? "transition-none"
                        : "transition-[opacity,transform,filter] duration-[820ms] ease-[cubic-bezier(.2,.7,.3,1)]",
                    )}
                  >
                    {w}
                    {i < words.length - 1 ? " " : ""}
                  </span>
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
            <div
              className="h-full bg-pp-ink transition-[width] duration-300 ease-linear"
              style={{ width: `${((spoken / TOTAL_WORDS) * 100).toFixed(1)}%` }}
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
            Every row is legible before the call runs — the reader who never
            presses anything still learns what the agent does. The only thing
            the replay adds is the stamp, and that is the whole animation:
            the time appears at the instant the script earns it, which is the
            one fact a static list cannot state.
          */}
          <ol className="mt-4">
            {LOG.map((row, i) => {
              const at = stamps[i];
              const struck = at >= 0;
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
                        "size-[9px] shrink-0 rounded-full border-[1.6px] transition-[background-color,border-color] duration-[420ms]",
                        struck
                          ? "border-pp-accent bg-pp-accent"
                          : "border-pp-muted bg-transparent",
                      )}
                    />
                    <span className="text-[15px] leading-[22px] font-medium text-pp-ink">
                      {row.label}
                    </span>
                    <span className="ml-auto text-[12px] leading-4 tabular-nums tracking-[0.1em]">
                      {struck ? (
                        <motion.span
                          initial={reduce ? false : { opacity: 0, y: "-0.35em" }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.45, ease: EASE }}
                          className="block text-pp-accent"
                        >
                          {stampOf(at)}
                        </motion.span>
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
