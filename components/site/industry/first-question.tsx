"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Headphones, Square } from "lucide-react";
import type { CueFile } from "@/lib/audio/cue-types";
import { cueIn } from "@/lib/audio";
import { isSoundOn, unlockFromGesture } from "@/components/site/audio/engine";
import { SOUND_NOTE, SoundButton } from "@/components/site/audio/sound-button";
import { useSounding, useVoiceTrack } from "@/components/site/audio/use-voice-track";
import type { Prong, Trade } from "@/lib/pages/industries/schema";
import {
  TRACK,
  lineCue,
  loadIndustryCues,
  openingFrom,
  openingOf,
  within,
  type IndustrySurface,
} from "@/lib/pages/industries/spoken-timing";
import { cn } from "@/lib/utils";
import { Eyebrow, PillLink, SectionTitle } from "../product/primitives";
import { useInView, usePrefersReducedMotion } from "../product/timing";
import { EMBER, EMBER_INK } from "./parts";
import { markProved, resetProved } from "./proved";

/* ------------------------------------------------------------------ *
 * §1 — The work that comes in on the phone.
 *
 * One hairline enters from the left edge of the viewport, not from the
 * 1176px column: the call arrives from outside the page. It rings, it is
 * answered, and it forks into the three kinds of work this trade's phone
 * actually brings in. The heading is the hole the fork fills — pick a
 * prong and the sentence completes with what the agent does about it.
 *
 * These are ordinary jobs: somebody who needs a plumber for their flat,
 * a table on Friday, a viewing on Saturday. Left alone the page takes
 * the prong that has to happen today, because that is the call which is
 * most expensive to miss. It plays once and stops; nothing here loops.
 *
 * DRAWN IN PIXELS, NOT IN VIEWBOX UNITS. A fixed viewBox on a full-bleed
 * figure scales to fit the shorter axis and centres what is left, which
 * puts a 670px margin either side of a line that was supposed to start
 * at the edge of the screen. So the figure measures itself and works in
 * CSS pixels: strokes stay exactly 1.6px at every width, the answer node
 * lands on the content column's own left rule, and nothing distorts.
 *
 * No GSAP either. Every stroke is a dashoffset under a CSS transition
 * driven by one piece of React state — this is the LCP element on
 * sixteen routes and the last thing it should do is pull a motion
 * library onto the critical path.
 *
 * SOUND. Off until the visitor turns it on; before that this island
 * fetches nothing and adds no work. The voices are AI-generated from the
 * page's own lines (lib/audio/cues/industry-first-question.json, loaded
 * through import() only once sound is on), and the pill under the quote
 * says so. With sound on:
 *   - the opening rings on the ring track's own clock: ringing from its
 *     ring, answered from its pickup, the fork the same beat after it,
 *     and the active prong's line 0.2 s after the fork has drawn;
 *   - turning sound on once the fork is drawn says the active prong's
 *     line (before that, as the fork draws), and a prong pick says the
 *     picked one: both are presses, so they speak under reduced motion
 *     too;
 *   - reduced motion and the still tier never ring or speak by
 *     themselves: a Listen pill beside the sound pill says the active
 *     line.
 * A track that is missing or does not match the text is silence, and
 * the opening keeps its timers. Leaving the screen mid-ring hands the
 * rest of the opening to those timers, from where the ring had got to.
 * Nothing here is announced line by line, so there is no live region to
 * quiet while a line is said.
 * ------------------------------------------------------------------ */

type Phase = "idle" | "ringing" | "answered" | "forked";

const H = 300;
const AXIS = 154;
/** Vertical offset of each prong from the axis. Index matches `trade.prongs`. */
const SPREAD = [-84, 0, 84];

/** The section's claim on the site's one sound (components/site/audio/engine.ts). */
const VOICE_ID = "industry-first-question";
/** With sound on at arrival, how long the opening waits for its cue file before it rings silently. */
const CUE_WAIT_MS = 1200;
/** A ring that has not started this long after it was asked for is a stall: the timers take over. */
const STALL_MS = 1500;

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setWidth(el.getBoundingClientRect().width);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export function FirstQuestion({ trade }: { trade: Trade }) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, "-10% 0px");
  const still = usePrefersReducedMotion();

  const urgent = Math.max(0, trade.prongs.findIndex((p) => p.urgent));
  const [phase, setPhase] = useState<Phase>("idle");
  const [picked, setPicked] = useState<number | null>(null);

  // The opening beat, once.
  //
  // `started` is a ref rather than state on purpose: the three steps are
  // one chain, and an effect that depended on `phase` would clear the
  // timers for the steps that had not happened yet, so the call would
  // ring forever. Nothing in these dependencies may change mid-chain.
  const started = useRef(false);
  const timers = useRef<number[]>([]);

  // Cancel only on unmount. If the cleanup ran whenever `inView` changed, a
  // reader who scrolled past and back inside the first two seconds would
  // cancel the chain — and `started` would then refuse to restart it, so the
  // call would ring for the life of the page.
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  // This section opens every trade's page, so its arrival is the page's: the
  // receipt at the bottom starts empty rather than inked by the trade the
  // reader came from (the store is per document, and a menu link keeps the
  // document). Before paint, so the old rows are never drawn.
  useLayoutEffect(() => resetProved(), [trade.slug]);

  /* ── The voice ───────────────────────────────────────────────────── */

  /** Called when the track this section plays reaches its end: the ring's, during the opening. */
  const onTrackEnd = useRef<(() => void) | null>(null);
  const track = useVoiceTrack(VOICE_ID, { active: inView, onEnded: () => onTrackEnd.current?.() });
  const { fileRef: cueFile, load: loadCues } = useStageCues("industry-first-question", track.on);
  const playing = useSounding() && track.audible;
  /** The opening is ringing on the ring track: its frame loop. */
  const ringRun = useRef<{ raf: number } | null>(null);
  /** The line is to be said as the fork draws (sound went on before it had): whether as a press. */
  const sayAtFork = useRef<boolean | null>(null);

  const active = picked ?? urgent;
  const prong = trade.prongs[active];
  const forked = phase === "forked";
  const answered = phase === "answered" || forked;

  /** What the timers and the frame loop read: the latest render's values, not the ones that set them up. */
  const live = useRef({ active, inView, listen: track.listen, alive: true });
  useLayoutEffect(() => {
    live.current = { active, inView, listen: track.listen, alive: true };
  });
  useEffect(
    () => () => {
      live.current.alive = false;
      if (ringRun.current) cancelAnimationFrame(ringRun.current.raf);
    },
    [],
  );

  /** Says prong `i`'s opening line; a press takes the sound from any other section. Silence without a track. */
  function sayLine(i: number, press: boolean) {
    const p = trade.prongs[i];
    const say = (file: CueFile | null) => {
      if (!live.current.alive) return;
      const cue = lineCue(file, TRACK.prong(trade.slug, p), p.caller);
      if (cue) track.play(cue, 0, { press });
      // A line with no track is silence: a press stops whatever this section was saying.
      else if (press) track.pause();
    };
    const file = cueFile.current;
    if (file) say(file);
    else void loadCues().then(say);
  }

  function fork() {
    setPhase("forked");
    const press = sayAtFork.current;
    if (press === null) return;
    sayAtFork.current = null;
    sayLine(live.current.active, press);
  }

  /**
   * The opening as it always ran without sound, picked up `from` ms into
   * it: the step it should be at already, at once, and timers for the
   * rest. From 0 these are the three timers it always had.
   */
  function readOpening(from = 0) {
    const step = (phase: Phase) => (phase === "forked" ? fork() : setPhase(phase));
    const { now, later } = openingFrom(from);
    if (now) step(now);
    timers.current = later.map((s) => window.setTimeout(() => step(s.phase), s.in));
  }

  /**
   * Stops the ring and lets the timers finish the opening, from `at`
   * seconds into it. The line still comes as the fork draws, if it may
   * (on screen, with sound on).
   */
  function handOver(at: number) {
    const run = ringRun.current;
    if (!run) return;
    cancelAnimationFrame(run.raf);
    ringRun.current = null;
    onTrackEnd.current = null;
    track.pause();
    sayAtFork.current = false;
    readOpening(at * 1000);
  }

  /**
   * The opening on the ring track's clock (sound on): ringing from its
   * ring, answered from its pickup; once it ends, the fork and then the
   * active prong's line. Without a usable ring, the timers, from where
   * the opening would have got to.
   */
  function ringOpening(file: CueFile | null, began: number) {
    const ring = file ? cueIn(file, TRACK.ring(trade.slug)) : undefined;
    const opening = openingOf(ring);
    const L = live.current;
    if (!L.alive) return;
    if (!ring || !opening || !isSoundOn() || L.listen || !L.inView) return readOpening(performance.now() - began);
    const p = trade.prongs[L.active];
    sayAtFork.current = null;
    track.play(ring, 0, { next: lineCue(file, TRACK.prong(trade.slug, p), p.caller) });

    const asked = performance.now();
    const run = { raf: 0 };
    const frame = () => {
      const t = track.time();
      // Asked for and never started (a stalled file): the timers ring it instead, from the top.
      if (t <= 0 && performance.now() - asked > STALL_MS) return handOver(0);
      setPhase(t >= opening.answered ? "answered" : t >= opening.ringing ? "ringing" : "idle");
      run.raf = requestAnimationFrame(frame);
    };
    run.raf = requestAnimationFrame(frame);
    ringRun.current = run;

    onTrackEnd.current = () => {
      onTrackEnd.current = null;
      cancelAnimationFrame(run.raf);
      ringRun.current = null;
      setPhase("answered");
      // The fork and the line come a beat after the pickup, past the end of the ring's short track.
      timers.current = [
        window.setTimeout(() => setPhase("forked"), Math.max(0, (opening.forked - ring.dur) * 1000)),
        window.setTimeout(() => sayLine(live.current.active, false), Math.max(0, (opening.line - ring.dur) * 1000)),
      ];
    };
  }

  // The effects below call the latest render's steps.
  const steps = useRef({ readOpening, ringOpening, handOver });
  useLayoutEffect(() => {
    steps.current = { readOpening, ringOpening, handOver };
  });

  useEffect(() => {
    if (still) {
      setPhase("forked");
      return;
    }
    if (!inView || started.current) return;
    started.current = true;
    // Without sound (and under the still tier, where nothing autoplays) the
    // opening is the timers it always was.
    if (!isSoundOn() || live.current.listen) {
      steps.current.readOpening();
      return;
    }
    // Sound on before the page arrived: it rings, once its cue file is here.
    sayAtFork.current = false;
    const began = performance.now();
    void within(loadCues(), CUE_WAIT_MS).then((file) => steps.current.ringOpening(file, began));
  }, [inView, still, loadCues]);

  // Off the screen mid-ring: the track has paused and let go; the timers finish the opening from there.
  useEffect(() => {
    if (!inView && ringRun.current) steps.current.handOver(track.time());
  }, [inView, track]);

  function pick(index: number) {
    // A step of the opening still pending ("answered" at two seconds) must
    // not land on top of the reader's pick and fold the fork back up.
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    started.current = true;
    sayAtFork.current = null;
    setPhase("forked");
    setPicked(index);
    markProved("fork");
    // With sound on, a pick says the caller's line: a press, so under reduced motion too.
    if (isSoundOn()) sayLine(index, true);
  }

  /** The sound pill, inside its click: turning sound on says the line on screen (or as the fork draws). */
  function onSound(on: boolean) {
    if (!on) return;
    if (phase === "forked") sayLine(active, true);
    else if (!ringRun.current) sayAtFork.current = true;
  }

  /** Listen (reduced motion, the still tier): says the active line, and turns sound on; pressed again, stops. */
  function onListen() {
    if (playing) return track.pause();
    unlockFromGesture();
    sayLine(active, true);
  }

  return (
    <section id="top" ref={ref} className="pt-28 md:pt-[148px]">
      <div className="mx-auto w-[calc(100%-2rem)] max-w-[1176px] sm:w-[calc(100%-3rem)] lg:w-[calc(100%-5rem)]">
        <Eyebrow>{trade.label}</Eyebrow>

        <p className="mt-6 text-[15px] leading-6 text-pp-muted md:text-base">{trade.kicker}</p>

        {/* Reserved height: the sentence completes differently for each
            prong and nothing below it may move when it does — the fork is
            right under it, and a prong that grows the heading by a line
            pulls the next button out from under the finger that picked it.
            A fixed min-height could only guess at two lines, and a third
            line depends on the width, so every ending is laid out in the
            same grid cell, invisibly, and the cell is as tall as the
            longest one at whatever width this is. The two-line minimum
            stays, so a short trade keeps the rhythm it was designed with. */}
        <div className="mt-2 grid min-h-[80px] max-w-[900px] md:min-h-[108px]">
          <SectionTitle as="h1" className="[grid-area:1/1]">
            <span className="text-pp-muted">It </span>
            <span
              key={prong.id}
              className="ind-swap inline-block"
              style={prong.urgent && trade.ink.ember ? { color: EMBER } : undefined}
            >
              {prong.does}.
            </span>
          </SectionTitle>
          {trade.prongs.map((p) => (
            <SectionTitle key={p.id} as="p" size="h1" aria-hidden className="invisible [grid-area:1/1]">
              <span>It </span>
              <span className="inline-block">{p.does}.</span>
            </SectionTitle>
          ))}
        </div>

        <p className="mt-5 max-w-[600px] text-base leading-6 tracking-[0.01em] text-pp-ink/80 md:text-[17px] md:leading-[26px]">
          {trade.standfirst}
        </p>

        <div className="mt-7 flex flex-wrap gap-x-2 gap-y-6">
          <PillLink href="#run">Run a call</PillLink>
          <PillLink href="/register" variant="secondary">
            Start free
          </PillLink>
        </div>
        <p className="mt-3 text-[13px] leading-[18px] text-pp-muted">Free for 14 days. No card needed.</p>
      </div>

      {/* Full-bleed: the call comes in from outside the column. */}
      <div className="mt-10 md:mt-14">
        <Fork trade={trade} active={active} phase={phase} answered={answered} forked={forked} onPick={pick} />
      </div>

      <div className="mx-auto mt-8 w-[calc(100%-2rem)] max-w-[1176px] sm:w-[calc(100%-3rem)] lg:w-[calc(100%-5rem)]">
        <div className="max-w-[620px] border-t border-pp-rule pt-5">
          <p className="font-[family-name:var(--font-pp-cinema)] text-[19px] leading-7 text-pp-ink italic md:text-[21px] md:leading-8">
            &ldquo;{prong.caller}&rdquo;
          </p>
          <p className="mt-3 text-[15px] leading-[23px] text-pp-muted">{prong.asks}</p>
          <StageSound className="mt-5" listen={track.listen} playing={playing} onSound={onSound} onListen={onListen} />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Sound, as every industry section carries it.
 *
 * The site's one sound switch (SoundButton: the same state on every
 * control on the page) with the caption the honesty rule asks for, and,
 * under reduced motion or the still tier, where nothing plays by itself,
 * a Listen pill that plays the section's line on screen. The run-it
 * call has its own transport ("Listen to the call") built from the same
 * pill. Shared from here because this island is on every trade page
 * anyway.
 * ------------------------------------------------------------------ */

/**
 * A section's cue file, loaded through import() once sound is on (or on
 * a Listen press), never before. `fileRef` holds it once it is here, so
 * a click can play at once instead of after a promise; a failed load is
 * forgotten and tried again on the next call.
 */
export function useStageCues(surface: IndustrySurface, on: boolean) {
  const fileRef = useRef<CueFile | null>(null);
  const pending = useRef<Promise<CueFile | null> | null>(null);
  const load = useCallback(() => {
    if (fileRef.current) return Promise.resolve(fileRef.current);
    pending.current ??= loadIndustryCues(surface).then((file) => {
      pending.current = null;
      fileRef.current = file;
      return file;
    });
    return pending.current;
  }, [surface]);
  useEffect(() => {
    if (on) void load();
  }, [on, load]);
  return { fileRef, load };
}

/** A pill in the sound control's own style (components/site/audio/sound.css), for a transport. */
export function ListenPill({
  label,
  icon: Icon,
  onPress,
  describedBy,
  small,
}: {
  label: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  onPress: () => void;
  describedBy?: string;
  /** A filled stop or pause glyph reads better a size down. */
  small?: boolean;
}) {
  return (
    <span className="snd" data-variant="pill" data-tone="light">
      <button type="button" className="snd-btn" aria-describedby={describedBy} onClick={onPress}>
        <Icon aria-hidden className={cn("shrink-0", small ? "size-3 fill-current" : "size-4")} />
        <span>{label}</span>
      </button>
    </span>
  );
}

export function StageSound({
  listen,
  playing,
  onSound,
  onListen,
  transport,
  note = SOUND_NOTE,
  className,
}: {
  /** Reduced motion or the still tier: nothing plays by itself, so Listen is offered. */
  listen: boolean;
  /** This section's voice is sounding now: Listen reads Stop. */
  playing: boolean;
  onSound: (on: boolean) => void;
  onListen?: () => void;
  /** A transport of the section's own in place of Listen (the run-it call's), given the caption's id. */
  transport?: (describedBy: string) => ReactNode;
  /** The micro-caption: "AI-generated voices · sample call", or a longer line that contains it. */
  note?: string;
  className?: string;
}) {
  const noteId = useId();
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2", className)}>
      {transport
        ? transport(noteId)
        : listen &&
          onListen && (
            <ListenPill
              label={playing ? "Stop" : "Listen"}
              icon={playing ? Square : Headphones}
              small={playing}
              onPress={onListen}
              describedBy={noteId}
            />
          )}
      <SoundButton variant="pill" tone="light" onChange={onSound} caption="none" describedBy={noteId} />
      <span id={noteId} className="min-w-0 text-[12px] leading-4 text-pretty text-pp-muted">
        {note}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * The fork.
 *
 * One component, two authored compositions. Above lg the call runs left
 * to right across the whole viewport; below it the call runs down the
 * left gutter and the prongs go right, which is the way a fork wants to
 * read in a narrow column. The portrait version is drawn, not a squeezed
 * copy of the landscape one — scaling a wide figure into 358px is how a
 * signature visual becomes the weakest thing on a phone.
 * ------------------------------------------------------------------ */

function Fork({
  trade,
  active,
  phase,
  answered,
  forked,
  onPick,
}: {
  trade: Trade;
  active: number;
  phase: Phase;
  answered: boolean;
  forked: boolean;
  onPick: (i: number) => void;
}) {
  const [ref, width] = useWidth();
  const portrait = width > 0 && width < 1024;
  const ringing = phase !== "idle";

  // The column this page's prose sits in, so the answer node can land on
  // its left rule instead of floating at an arbitrary percentage.
  const column = Math.min(1176, width - (width >= 1024 ? 80 : width >= 640 ? 48 : 32));
  const columnLeft = Math.max(0, (width - column) / 2);

  const answerX = portrait ? 46 : Math.max(columnLeft, 300);
  // The prongs run out towards the far edge rather than stopping at the
  // column, so the figure is as wide as the call that arrived. 300px is
  // kept back for the labels; the floor stops the fork collapsing into
  // the answer node on a narrow laptop.
  const endX = portrait ? 96 : Math.max(answerX + 260, width - 300);
  const height = portrait ? 372 : H;
  const axis = portrait ? 62 : AXIS;
  const rows = portrait ? [116, 208, 300] : SPREAD.map((d) => AXIS + d);

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block" fill="none" aria-hidden>
          {/* The line in. Landscape: from the edge of the screen. Portrait:
              down the gutter from above. */}
          <path
            d={portrait ? `M${answerX} 0 V${axis}` : `M0 ${axis} H${answerX}`}
            stroke="#000"
            strokeWidth="1.6"
            pathLength="1"
            strokeDasharray="1"
            strokeDashoffset={ringing ? 0 : 1}
            style={{ transition: "stroke-dashoffset 1400ms cubic-bezier(0.22,1,0.36,1)" }}
          />

          {/* Three rings, marching, while it is still unanswered. */}
          {[0, 1, 2].map((i) => {
            const gap = portrait ? 16 : Math.min(76, Math.max(28, (answerX - 40) / 4));
            const cx = portrait ? answerX : answerX - (3 - i) * gap;
            const cy = portrait ? 12 + i * gap : axis;
            return (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r="4.6"
                stroke="#6b6878"
                strokeWidth="1.6"
                className={ringing && !answered ? "ind-ring" : undefined}
                opacity={ringing && !answered ? undefined : 0}
                style={{ animationDelay: `${i * 210}ms` }}
              />
            );
          })}

          {/* Answered. */}
          <circle cx={answerX} cy={axis} r="9.5" fill="var(--pp-bg)" />
          <circle
            cx={answerX}
            cy={axis}
            r="4.6"
            fill={answered ? "#000" : "var(--pp-bg)"}
            stroke="#000"
            strokeWidth="1.6"
            style={{ transition: "fill 420ms ease" }}
          />
          {!portrait && (
            <text x={answerX} y={axis - 22} textAnchor="middle" fontSize="11" letterSpacing="0.12em" fill="#6b6878">
              {answered ? "ANSWERED" : "RINGING"}
            </text>
          )}

          {/* The fork. */}
          {trade.prongs.map((p, i) => {
            const on = forked && i === active;
            const ink = prongInk(p, trade, on);
            const y = rows[i];
            const bend = portrait ? 34 : Math.min(190, (endX - answerX) * 0.3);
            const d = portrait
              ? `M${answerX} ${axis} V${y - bend} C ${answerX} ${y - bend / 2}, ${answerX + 14} ${y}, ${endX} ${y}`
              : `M${answerX} ${axis} C ${answerX + bend} ${axis}, ${answerX + bend * 1.15} ${y}, ${answerX + bend * 2} ${y} H ${endX}`;
            return (
              <path
                key={p.id}
                d={d}
                stroke={ink}
                strokeWidth="1.6"
                strokeDasharray={on ? "1" : "0.0016 0.0075"}
                pathLength="1"
                strokeDashoffset={forked ? 0 : 1}
                opacity={forked ? (on ? 1 : 0.5) : 0}
                style={{
                  transition:
                    "stroke-dashoffset 760ms cubic-bezier(0.22,1,0.36,1), opacity 400ms ease, stroke 320ms ease",
                  transitionDelay: `${i * 80}ms`,
                }}
              />
            );
          })}

          {trade.prongs.map((p, i) => {
            const on = forked && i === active;
            const ink = prongInk(p, trade, on);
            return (
              <g key={p.id} opacity={forked ? 1 : 0} style={{ transition: "opacity 360ms ease 480ms" }}>
                <circle cx={endX} cy={rows[i]} r="9.5" fill="var(--pp-bg)" />
                <circle
                  cx={endX}
                  cy={rows[i]}
                  r="4.4"
                  fill={on ? ink : "var(--pp-bg)"}
                  stroke={ink}
                  strokeWidth="1.6"
                  style={{ transition: "fill 320ms ease, stroke 320ms ease" }}
                />
              </g>
            );
          })}
        </svg>
      )}

      {/* The labels are real buttons over the figure, so the fork is
          keyboard-operable and reads as three choices rather than as a
          picture with text in it. */}
      <div className="absolute inset-0">
        {trade.prongs.map((p, i) => {
          const on = i === active;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onPick(i)}
              aria-pressed={on}
              // Out of the tab order and hidden from assistive tech until the
              // fork has drawn them: a key can otherwise reach, and press, a
              // choice nobody can see yet.
              tabIndex={forked ? undefined : -1}
              aria-hidden={!forked || undefined}
              className={cn(
                "absolute flex min-h-11 -translate-y-1/2 items-center rounded-full pr-3 text-left transition-opacity duration-300",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink",
                forked ? "opacity-100" : "pointer-events-none opacity-0",
              )}
              style={{ left: endX + 20, top: rows[i] }}
            >
              <span
                className={cn(
                  "block text-[15px] leading-5 transition-colors",
                  on ? "text-pp-ink" : "text-pp-muted hover:text-pp-ink",
                )}
                style={on ? { color: labelInk(p, trade) } : undefined}
              >
                {p.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Ember is the urgency ink and it is allowed exactly once: on the kind
 * of work that has to happen today, and only on the trades where that
 * is genuinely true. Everywhere else the selected prong is black.
 */
function prongInk(prong: Prong, trade: Trade, selected: boolean) {
  if (!selected) return "#6b6878";
  return prong.urgent && trade.ink.ember ? EMBER : "#000000";
}

/** The same ink for a 15px label, dark enough to read on white. */
function labelInk(prong: Prong, trade: Trade) {
  return prong.urgent && trade.ink.ember ? EMBER_INK : "#000000";
}
