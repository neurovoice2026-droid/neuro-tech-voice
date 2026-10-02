"use client";

import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import type { Cue, CueFile } from "@/lib/audio/cue-types";
import { isSoundOn, unlockFromGesture } from "@/components/site/audio/engine";
import { useSounding, useVoiceTrack } from "@/components/site/audio/use-voice-track";
import type { Trade } from "@/lib/pages/industries/schema";
import { TRACK, benchDwell, lineCue, saidBy, within } from "@/lib/pages/industries/spoken-timing";
import { cn } from "@/lib/utils";
import { Eyebrow, Frame, SectionTitle } from "../product/primitives";
import { useInView, usePrefersReducedMotion } from "../product/timing";
import { StageSound, useStageCues } from "./first-question";
import { Gate, ToolName } from "./parts";
import { markProved } from "./proved";

/* ------------------------------------------------------------------ *
 * §2 — The bench.
 *
 * The objection this answers is the first one every owner raises: it
 * won't understand how my customers talk. So the instrument is the
 * trade's own vocabulary, said as badly as people really say it — "thing
 * on the wall making a kettle noise", "tail lift needed at the drop" —
 * and what the agent reaches for when it hears it.
 *
 * The honest sentence under the heading is load-bearing and it is spent
 * early on purpose: these are the same fourteen tools on all sixteen of
 * these pages. What changes per trade is which one a sentence lands on,
 * and that is a more convincing claim than pretending each trade gets a
 * different machine.
 *
 * SOUND. Each chip can be heard as a caller says it (AI-generated
 * voices, lib/audio/cues/industry-bench-intents.json, fetched only once
 * sound is on and the bench is a screen away). With sound on the
 * autoplay says its four chips, and each holds for max(2.6 s, its line
 * + 0.7 s) on the clip's own clock before the next; a chip without a
 * track holds for the read pace, silently. A pick says the picked chip;
 * the sound pill, turned on, says the chip on screen (mid-autoplay, the
 * rest of the autoplay is then said too). Reduced motion and the still
 * tier never autoplay sound: a Listen pill says the chip on screen.
 * Off screen the autoplay waits, and carries on when it is back; sound
 * turned off or taken by another section's press lets it finish on the
 * same clock, silently. Nothing here is announced chip by chip, so there
 * is no live region to quiet while a chip is said.
 * ------------------------------------------------------------------ */

const CYCLE_MS = 2600;

/** The section's claim on the site's one sound (components/site/audio/engine.ts). */
const VOICE_ID = "industry-bench-intents";
/** With sound on as the autoplay starts, how long it waits for its cue file before it reads instead. */
const CUE_WAIT_MS = 1200;
/** A frame gap longer than this (a hidden tab) does not count towards a chip's rest. */
const MAX_FRAME_S = 0.1;

/** The autoplay, said: the chip on screen and how far through its hold it is. */
type SpokenRun = {
  chip: number;
  /** Autoplay steps still to come after this chip. */
  left: number;
  cue: Cue | undefined;
  /** The clip runs on the track's clock (heard, or silently after a refusal); else on `wall`. */
  played: boolean;
  /** Seconds since the chip came up, on a plain clock that stops off screen. */
  wall: number;
  /** Where its line has been said; from there the hold runs on the plain clock. */
  end: number;
  /** How long the chip holds, from the start of its track. */
  dwell: number;
  /** Seconds rested since the line was said; null while it is being said. */
  rested: number | null;
  /** It left the screen mid-line: the line carries on when it is back. */
  away: boolean;
};

export function Bench({ trade }: { trade: Trade }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, "-15% 0px");
  const still = usePrefersReducedMotion();

  const [active, setActive] = useState(0);
  const [touched, setTouched] = useState(false);

  /* ── The voice ───────────────────────────────────────────────────── */

  /** A screen away: with sound on, the chips' cues are fetched now, so the first one is said on time. */
  const near = useInView(ref, "100% 0px");
  const track = useVoiceTrack(VOICE_ID, { active: inView });
  const trackRef = useRef(track);
  useEffect(() => {
    trackRef.current = track;
  });
  const { fileRef, load } = useStageCues("industry-bench-intents", track.on && near);
  const playing = useSounding() && track.audible;
  /** The autoplay, said. Null while it reads silently, and once it is over. */
  const spoken = useRef<SpokenRun | null>(null);
  /** The said autoplay is under way: its frame loop runs while the bench is on screen. */
  const [speaking, setSpeaking] = useState(false);
  /** The silent autoplay is under way, and how many of its three steps it has taken. */
  const reading = useRef(false);
  const steps = useRef(0);
  /** The latest press that asked for a chip's line: a slower load for an older one must not play over it. */
  const asked = useRef(0);
  /** The reader has picked a chip: an autoplay still waiting for its cues must not start after that. */
  const picked = useRef(false);

  // Plays three, then stops on the third. A rail that cycles forever
  // reads as a screensaver and stops being something you operate.
  const started = useRef(false);
  const cycle = useRef(0);
  const railRef = useRef<HTMLDivElement>(null);
  /** The last change of chip was the autoplay's, not the reader's. */
  const stepped = useRef(false);
  // Unmount only — see the note in first-question.tsx.
  useEffect(() => () => window.clearInterval(cycle.current), []);

  /** The autoplay at read pace, as it always ran: the steps still to come, one a beat. */
  function readOn(from: number) {
    let step = from;
    steps.current = step;
    reading.current = true;
    cycle.current = window.setInterval(() => {
      step += 1;
      steps.current = step;
      if (step >= 3) {
        window.clearInterval(cycle.current);
        reading.current = false;
      }
      stepped.current = true;
      setActive((a) => (a + 1) % Math.min(trade.intents.length, 16));
    }, CYCLE_MS);
  }

  /** Chip `k`'s line, if its track says it as written. */
  const chipCue = (file: CueFile | null, k: number) =>
    lineCue(file, TRACK.intent(trade.slug, k), trade.intents[k]?.chip ?? "");

  /** The autoplay, said, from chip `chip` with `left` steps to come; the first chip as a press when one started it. */
  function speakOn(file: CueFile | null, chip: number, left: number, press: boolean) {
    const cue = chipCue(file, chip);
    const played = !!cue && trackRef.current.play(cue, 0, { press });
    spoken.current = {
      chip,
      left,
      cue,
      played,
      wall: 0,
      end: cue ? saidBy(cue) : 0,
      dwell: benchDwell(cue),
      rested: null,
      away: false,
    };
    setSpeaking(true);
  }

  /** The autoplay starts, said if sound is on and the cues are here in time, else read as it always was. */
  const startAutoplay = useEffectEvent(() => {
    if (!isSoundOn() || track.listen) return readOn(0);
    void within(load(), CUE_WAIT_MS).then((file) => {
      // The reader picked a chip meanwhile: the autoplay is over before it began.
      if (picked.current || spoken.current || reading.current) return;
      if (file && isSoundOn()) speakOn(file, 0, 3, false);
      else readOn(0);
    });
  });

  useEffect(() => {
    if (!inView || touched || still || started.current) return;
    started.current = true;
    startAutoplay();
  }, [inView, touched, still, trade.intents.length]);

  /** The said autoplay moves on to its next chip, or ends on the one it is on. */
  const nextChip = useEffectEvent(() => {
    const run = spoken.current;
    if (!run) return;
    if (run.left <= 0) {
      spoken.current = null;
      setSpeaking(false);
      return;
    }
    const next = (run.chip + 1) % Math.min(trade.intents.length, 16);
    stepped.current = true;
    setActive(next);
    speakOn(fileRef.current, next, run.left - 1, false);
  });

  // The said autoplay, frame by frame: the line on its clip's clock, then the rest of the hold.
  useEffect(() => {
    if (!speaking || !inView) return;
    const run = spoken.current;
    if (run?.away) {
      run.away = false;
      // Back on screen mid-line: it carries on from where it was.
      if (run.cue && run.played && run.rested === null && trackRef.current.time() < run.end) {
        trackRef.current.play(run.cue);
      }
    }
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const r = spoken.current;
      if (!r) return;
      const dt = Math.min(MAX_FRAME_S, Math.max(0, (now - last) / 1000));
      last = now;
      r.wall += dt;
      if (r.rested === null) {
        const at = r.played ? trackRef.current.time() : r.wall;
        if (!r.cue || at >= r.end) r.rested = Math.max(0, at - r.end);
      } else {
        r.rested += dt;
      }
      if (r.rested !== null && r.end + r.rested >= r.dwell) {
        nextChip();
        if (!spoken.current) return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      if (spoken.current) spoken.current.away = true;
    };
  }, [speaking, inView]);

  /** Says chip `k`, as a press (it wins the sound, and plays under reduced motion). */
  function sayChip(k: number) {
    const ask = ++asked.current;
    const say = (file: CueFile | null) => {
      if (ask !== asked.current) return;
      const cue = chipCue(file, k);
      // A chip with no track is silence: whatever this section was saying stops with the pick.
      if (cue) trackRef.current.play(cue, 0, { press: true });
      else trackRef.current.pause();
    };
    const file = fileRef.current;
    if (file) say(file);
    else void load().then(say);
  }

  /** The sound pill, inside its click: on, the chip on screen is said, and an autoplay under way carries on said. */
  function onSound(on: boolean) {
    if (!on) return;
    const run = spoken.current;
    if (run) {
      // Said silently since sound went off: the chip on screen starts again, heard, and the hold with it.
      const cue = chipCue(fileRef.current, run.chip);
      run.played = !!cue && trackRef.current.play(cue, 0, { press: true });
      run.cue = cue;
      run.wall = 0;
      run.rested = null;
      return;
    }
    if (reading.current && !track.listen) {
      // Mid-autoplay: the rest of it is said, from the chip on screen.
      window.clearInterval(cycle.current);
      reading.current = false;
      const left = 3 - steps.current;
      const chip = active;
      const file = fileRef.current;
      if (file) speakOn(file, chip, left, true);
      else
        void load().then((f) => {
          if (picked.current || spoken.current || reading.current) return;
          if (f) speakOn(f, chip, left, true);
          else readOn(3 - left);
        });
      return;
    }
    sayChip(active);
  }

  /** Listen (reduced motion, the still tier): says the chip on screen, turning sound on; pressed again, stops. */
  function onListen() {
    if (playing) return track.pause();
    unlockFromGesture();
    sayChip(active);
  }

  // On a phone the rail scrolls sideways, and the autoplay can land on a
  // chip past its edge. Bring that chip in, by scrolling the rail alone:
  // scrollIntoView would move the page under a reader who is reading.
  useEffect(() => {
    if (!stepped.current) return;
    stepped.current = false;
    const rail = railRef.current;
    const chip = rail?.children[active];
    if (!rail || !(chip instanceof HTMLElement) || rail.scrollWidth <= rail.clientWidth) return;
    const r = rail.getBoundingClientRect();
    const c = chip.getBoundingClientRect();
    // 16px is the rail's own padding: the chip lands where the first one sits.
    if (c.left >= r.left + 16 && c.right <= r.right - 16) return;
    rail.scrollTo({ left: rail.scrollLeft + c.left - r.left - 16, behavior: "smooth" });
  }, [active]);

  function pick(i: number) {
    // The reader's pick is final: the autoplay stops here, even mid-cycle.
    window.clearInterval(cycle.current);
    started.current = true;
    stepped.current = false;
    setTouched(true);
    setActive(i);
    markProved("bench");
    // Said or read, the autoplay is over; with sound on, the picked chip is said.
    picked.current = true;
    reading.current = false;
    if (spoken.current) {
      spoken.current = null;
      setSpeaking(false);
    }
    if (isSoundOn()) sayChip(i);
  }

  const intents = trade.intents.slice(0, 16);

  return (
    <section id="bench" ref={ref} className="scroll-mt-28">
      <Frame className="px-6 md:px-12">
        <Eyebrow>Their words</Eyebrow>
        <SectionTitle className="mt-4 max-w-[820px]">
          Say it the way your callers say it, and watch what it reaches for
        </SectionTitle>
        <p className="mt-5 max-w-[560px] text-base leading-[25px] text-pp-ink/80">
          The agent has fourteen tools. It has the same fourteen on every one of these pages — what
          changes with your trade is which one a sentence lands on, and how much of the job is done by
          the time it puts the phone down.
        </p>
      </Frame>

      <Frame className="mt-8 px-2 md:px-4">
        <div className="rounded-[24px] bg-pp-card p-4 md:p-7">
          {/* Edge to edge on a phone with the next chip peeking, so it is
              obvious the rail scrolls. Wrapped on a wide screen. */}
          <div
            ref={railRef}
            className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden"
          >
            {trade.intents.slice(0, 16).map((x, i) => (
              <button
                key={x.chip}
                type="button"
                onClick={() => pick(i)}
                aria-pressed={i === active}
                className={cn(
                  "min-h-11 shrink-0 rounded-full px-4 text-[14px] leading-none whitespace-nowrap transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink",
                  i === active
                    ? "bg-pp-ink text-white"
                    : "bg-white text-pp-muted hover:text-pp-ink",
                )}
              >
                {x.chip}
              </button>
            ))}
          </div>

          {/* Each part of the answer is laid out once per chip in the same
              cell, invisibly, so every part is as tall as its longest version
              and the autoplay — which runs without anyone touching it —
              never moves a line, in the card or below it. Stacked part by
              part rather than whole: a quote that wraps to a second line
              would otherwise push down what the agent reached for. */}
          <div className="mt-6 grid gap-6 md:mt-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-10">
            <div>
              <p className="text-[11px] leading-4 font-medium tracking-[0.12em] text-pp-muted uppercase">
                It hears
              </p>
              <Stack
                className="mt-2"
                live={active}
                items={intents}
                render={(x) => (
                  <p className="font-[family-name:var(--font-pp-cinema)] text-[21px] leading-8 text-pp-ink italic md:text-[24px] md:leading-9">
                    &ldquo;{x.chip}&rdquo;
                  </p>
                )}
              />
              <StageSound className="mt-4" listen={track.listen} playing={playing} onSound={onSound} onListen={onListen} />
            </div>

            <div>
              {/* Top-aligned, not baseline: both are 11px on a 16px line so it
                  reads the same, and a tool with no gate leaves the stack with
                  no baseline of its own — which moved this row mid-autoplay. */}
              <div className="flex items-start gap-3">
                <p className="text-[11px] leading-4 font-medium tracking-[0.12em] text-pp-muted uppercase">
                  It reaches for
                </p>
                <Stack
                  className="ml-auto justify-items-end"
                  live={active}
                  fade={false}
                  items={intents}
                  render={(x) => <Gate tool={x.reaches} />}
                />
              </div>
              <Stack
                live={active}
                items={intents}
                render={(x) => (
                  <>
                    <p className="mt-2">
                      <ToolName tool={x.reaches} className="text-[15px] text-pp-ink" />
                    </p>
                    <p className="mt-3 text-[15px] leading-[23px] text-pp-muted">{x.then}</p>
                  </>
                )}
              />
            </div>
          </div>
        </div>
      </Frame>

      <Frame className="mt-5 px-6 md:px-12">
        <p className="max-w-[620px] text-[13px] leading-5 text-pp-muted">
          The words on those chips are the trade&rsquo;s, not ours:{" "}
          {trade.jargon.slice(0, 6).join(", ")}. Get one of them wrong on the phone and the person on
          the other end knows within a sentence.
        </p>
      </Frame>
    </section>
  );
}

/**
 * One part of the answer, as it is for the active chip, laid over every
 * chip's version of the same part. The versions are invisible and hidden
 * from assistive tech; they are only there to hold the cell open at the
 * height of the longest one. The live one fades in each time the chip
 * changes, as it always did.
 */
function Stack<T>({
  items,
  live,
  render,
  fade = true,
  className,
}: {
  items: readonly T[];
  live: number;
  render: (item: T) => ReactNode;
  fade?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("grid content-start", className)}>
      <div key={live} className={cn("[grid-area:1/1]", fade && "ind-swap")}>
        {render(items[live])}
      </div>
      {items.map((x, i) => (
        <div key={i} aria-hidden className="invisible [grid-area:1/1]">
          {render(x)}
        </div>
      ))}
    </div>
  );
}
