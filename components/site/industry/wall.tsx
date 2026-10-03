"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { CueFile } from "@/lib/audio/cue-types";
import { isSoundOn, unlockFromGesture } from "@/components/site/audio/engine";
import { armFollow, showSaid } from "@/components/site/audio/show-said";
import { useSounding, useVoiceTrack } from "@/components/site/audio/use-voice-track";
import type { Trade } from "@/lib/pages/industries/schema";
import {
  displayWords,
  sameWallFrame,
  wallFrameAt,
  wallScript,
  wallSegment,
  within,
  type WallFrame,
  type WallScript,
} from "@/lib/pages/industries/spoken-timing";
import { cn } from "@/lib/utils";
import { Eyebrow, Frame, SectionTitle } from "../product/primitives";
import { useInView, usePrefersReducedMotion } from "../product/timing";
import { StageSound, useStageCues } from "./first-question";
import { EMBER, EMBER_INK } from "./parts";
import { markProved } from "./proved";

/* ------------------------------------------------------------------ *
 * §4 — The wall, and the retraction.
 *
 * The objection: it will make something up and land me in trouble. The
 * interesting thing about the agent is not what it says, it is what it
 * will not say, and that you cannot talk it out of it.
 *
 * So the instrument is pressure. Four detents, labelled in the words a
 * pushy caller really escalates through. The refusal's WORDING changes
 * at each one; its shape never does.
 *
 * And at the third detent, the thing nobody in this category has
 * shipped: the agent begins to say the forbidden sentence — and is cut
 * off mid-word. The half-sentence stays on screen, struck through, as a
 * record of what was nearly said, with the clause that stopped it named
 * in the margin. Owners are not afraid the agent will be stupid. They
 * are afraid it will be confident, and this is the only honest way to
 * answer that: show it starting to be wrong, and stopping.
 *
 * SOUND. The exchange can be heard, dramatised with AI-generated voices
 * (one track per trade, lib/audio/cues/industry/wall-retraction/<slug>.json,
 * fetched only once sound is on and the wall is a screen away), and the
 * label under it says so. With sound on the audio's clock runs the
 * wall: the walk plays detents one to three as they are said, each
 * caller's line coming up as it is spoken and the agent's answer as it
 * answers; at the retraction the half-sentence appears word by word as
 * it is said, is struck where its clip is cut, and the answer it gives
 * instead comes in as it starts. Then it stops, on the retraction, as
 * it always did. A pressure pick says that detent (the fourth only ever
 * on a pick); the sound pill, turned on, says the walk on from the
 * detent on screen, or that detent alone once the walk is over. Reduced
 * motion and the still tier never play by themselves: a Listen pill says
 * the detent on screen, every line swapping in whole. Off screen the
 * exchange waits and carries on when it is back; sound turned off, or
 * taken by another section's press, lets it finish silently on the same
 * clock. Nothing here is announced line by line, so there is no live
 * region to quiet while it is heard. A track that is missing or does
 * not match the lines is silence: the wall walks as it always did.
 * ------------------------------------------------------------------ */

type Beat = "begins" | "cut" | "instead";

/** The section's claim on the site's one sound (components/site/audio/engine.ts). */
const VOICE_ID = "industry-wall-retraction";
/** With sound on as the walk starts, how long it waits for its cue file before it walks silently. */
const CUE_WAIT_MS = 1200;
/** The walk as it always ran, read-paced (ms): detent two, then the retraction. */
const WALK_MS = [1500, 3600] as const;
/** The micro-caption every sound control carries, with the wall's own word for what it plays. */
const DRAMATISED = "Dramatised · AI-generated voices · sample call";

/** A stretch of the exchange being said: detents `first` to `last`, stopping at `to` on the track. */
type SpokenRun = {
  script: WallScript;
  last: number;
  to: number;
  /** Started by a press here, and nothing has taken the sound since. */
  pressed: boolean;
  /** It left the screen mid-way: it carries on when it is back. */
  away: boolean;
};

export function Wall({ trade }: { trade: Trade }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, "-20% 0px");
  const still = usePrefersReducedMotion();
  const { wall } = trade;

  const [at, setAt] = useState(0);
  const [touched, setTouched] = useState(false);

  // Walks 1 → 2 → 3 once and rests on the retraction, wall intact.
  const started = useRef(false);
  const timers = useRef<number[]>([]);
  // Unmount only — see the note in first-question.tsx. A reader who scrolls
  // past mid-walk must not be left staring at detent one.
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  /* ── The voice ───────────────────────────────────────────────────── */

  /** A screen away: with sound on, the exchange's cues are fetched now, so the walk is said on time. */
  const near = useInView(ref, "100% 0px");
  const run = useRef<SpokenRun | null>(null);
  const track = useVoiceTrack(VOICE_ID, {
    active: inView,
    onPreempt: () => {
      if (run.current) run.current.pressed = false;
    },
  });
  const trackRef = useRef(track);
  useEffect(() => {
    trackRef.current = track;
  });
  const { fileRef, load } = useStageCues("industry-wall-retraction", trade.slug, track.on && near);
  const playing = useSounding() && track.audible;
  /** A stretch of the exchange is being said: its frame loop runs while the wall is on screen. */
  const [speaking, setSpeaking] = useState(false);
  /** The wall as the audio has it; null: as it always was, read-paced. */
  const [frame, setFrame] = useState<WallFrame | null>(null);
  /** The read-paced walk is under way. */
  const walking = useRef(false);
  /** The latest press that asked for a stretch: a slower load for an older one must not play over it. */
  const asked = useRef(0);
  /** A pick has been made (the state, for callbacks that outlive the render that made them). */
  const touchedRef = useRef(false);
  /** Reduced motion or the still tier, heard: every line swaps in whole. */
  const instant = track.listen;

  /** The walk as it always ran, picked up `from` ms after it began. From 0 these are its two timers. */
  function readWalk(from = 0) {
    walking.current = true;
    timers.current = [
      window.setTimeout(() => setAt(1), Math.max(0, WALK_MS[0] - from)),
      window.setTimeout(
        () => {
          walking.current = false;
          setAt(wall.retraction.atDetent);
        },
        Math.max(0, WALK_MS[1] - from),
      ),
    ];
  }

  /** Says detents `first` to `last` on the audio's clock. */
  function sayStretch(script: WallScript, first: number, last: number, press: boolean) {
    const { from, to } = wallSegment(script, first, last);
    // A press the hook refused (the wall left the screen while its cues loaded, or sound went off) changes nothing.
    // An autoplay that can't take the sound is said silently, on the same clock.
    if (!trackRef.current.play(script.cue, from, { press }) && press) return;
    run.current = { script, last, to, pressed: press, away: false };
    setFrame(wallFrameAt(script, from));
    setAt(first);
    setSpeaking(true);
  }

  /** As a press: says detents `first` to `last` once the cues are here; silence (and the wall as it was) without a track. */
  function sayPressed(first: number, last: number) {
    const ask = ++asked.current;
    const go = (file: CueFile | null) => {
      const script = wallScript(trade, file);
      if (script && ask === asked.current) sayStretch(script, first, last, true);
    };
    const file = fileRef.current;
    if (file) go(file);
    else void load().then(go);
  }

  /** The walk starts (at `began`): said if sound is on and the cues are here in time, else read as it always was. */
  const startWalk = useEffectEvent((began: number) => {
    if (!isSoundOn() || track.listen) return readWalk();
    const ask = asked.current;
    void within(load(), CUE_WAIT_MS).then((file) => {
      // A pick meanwhile is final: the walk is over before it began.
      if (ask !== asked.current || touchedRef.current) return;
      const script = wallScript(trade, file);
      if (script && isSoundOn()) sayStretch(script, 0, wall.retraction.atDetent, false);
      else readWalk(performance.now() - began);
    });
  });

  useEffect(() => {
    if (still) {
      setAt(wall.retraction.atDetent);
      return;
    }
    if (!inView || touched || started.current) return;
    started.current = true;
    startWalk(performance.now());
  }, [inView, touched, still, wall.retraction.atDetent]);

  /** The stretch has been said: the wall rests on its last frame, as the read-paced walk rests on the retraction. */
  const stopAt = useEffectEvent((last: WallFrame) => {
    trackRef.current.pause();
    run.current = null;
    setFrame(last);
    setSpeaking(false);
  });

  /** Back on screen under reduced motion (or the still tier), where only a press plays: the stretch ends where it was. */
  const endAway = useEffectEvent(() => {
    run.current = null;
    setSpeaking(false);
  });

  // The stretch being said, frame by frame on the audio's clock: the detent, the answer, the cut.
  useEffect(() => {
    if (!speaking || !inView) return;
    const current = run.current;
    if (current?.away) {
      current.away = false;
      // Back on screen mid-way: it carries on from where it was, as a run rather than a press: it
      // claims the sound only if nobody else is playing (else silently, on the same clock).
      if (trackRef.current.time() < current.to && !trackRef.current.play(current.script.cue) && trackRef.current.listen) {
        endAway();
        return;
      }
    }
    let raf = 0;
    const tick = () => {
      const r = run.current;
      if (!r) return;
      const t = Math.min(trackRef.current.time(), r.to);
      const now = wallFrameAt(r.script, t);
      setFrame((prev) => (sameWallFrame(prev, now) ? prev : now));
      setAt(now.at);
      if (t >= r.to) return stopAt(now);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (run.current) run.current.away = true;
    };
  }, [speaking, inView]);

  /** The exchange (the caller's line and the answer): what a press here says. */
  const exchangeRef = useRef<HTMLDivElement>(null);
  /**
   * Below lg the stage is taller than a phone's screen, and the exchange can sit under the header
   * while the sound control is on screen: a press here brings it on screen when it is not, by the
   * least scroll and keeping the control on screen too (show-said.ts), so what is said can be read.
   */
  const showExchange = () => showSaid(exchangeRef.current, still || track.listen, "(max-width: 1023px)");

  /** The sound pill, inside its click: on, the walk is said on from the detent on screen, or that detent alone. */
  function onSound(on: boolean) {
    if (!on) return;
    showExchange();
    const r = run.current;
    if (r) {
      // Said silently since sound went off: heard again, from the start of the detent on screen.
      sayStretch(r.script, at, r.last, true);
    } else if (walking.current && !track.listen) {
      // Mid-walk: the rest of the walk is said, from the detent on screen.
      timers.current.forEach(window.clearTimeout);
      timers.current = [];
      walking.current = false;
      sayPressed(at, wall.retraction.atDetent);
    } else {
      sayPressed(at, at);
    }
  }

  /** Listen (reduced motion, the still tier): says the detent on screen, turning sound on; pressed again, stops. */
  function onListen() {
    if (playing) {
      trackRef.current.pause();
      run.current = null;
      setSpeaking(false);
      return;
    }
    armFollow();
    showExchange();
    unlockFromGesture();
    sayPressed(at, at);
  }

  function pick(i: number) {
    // The reader's pick is final: a step of the walk still pending must not
    // land on top of it.
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    started.current = true;
    setTouched(true);
    setAt(i);
    markProved("wall");
    // Said or read, the walk is over. With sound on, the picked detent is said.
    touchedRef.current = true;
    walking.current = false;
    asked.current++;
    if (run.current) {
      trackRef.current.pause();
      run.current = null;
      setSpeaking(false);
    }
    if (frame) setFrame(null);
    if (isSoundOn()) sayPressed(i, i);
  }

  const detent = wall.detents[at];
  const isRetraction = at === wall.retraction.atDetent;
  const crossed = at === wall.detents.length - 1;

  return (
    <section id="wall" ref={ref} className="scroll-mt-28">
      <Frame className="px-6 md:px-12">
        <Eyebrow>The wall</Eyebrow>
        <SectionTitle className="mt-4 max-w-[860px]">
          <span className="text-pp-muted">It will not </span>
          {wall.never}
        </SectionTitle>
        <p className="mt-5 max-w-[560px] text-base leading-[25px] text-pp-ink/80">
          Lean on it. The words change as the caller pushes; the answer does not. Push all the way and
          the only thing that gives is that it stops arguing and fetches a person.
        </p>
      </Frame>

      <Frame className="mt-8 px-2 md:px-4">
        <div className="rounded-[24px] bg-white p-4 shadow-[0_0_0_1px_rgb(24_16_40/0.06)] md:p-7">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
            <div>
              {/* The pressure rail. Four detents, harder each time. */}
              <div
                role="radiogroup"
                aria-label="How hard the caller pushes"
                className="flex items-center gap-1.5"
              >
                {wall.detents.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    role="radio"
                    aria-checked={i === at}
                    aria-label={`Pressure ${i + 1} of ${wall.detents.length}`}
                    onClick={() => pick(i)}
                    className="group flex h-11 flex-1 items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink"
                  >
                    <span
                      className="h-1 w-full rounded-full transition-colors duration-200"
                      style={{
                        background:
                          i > at
                            ? "var(--pp-rule)"
                            : i === wall.detents.length - 1 && crossed
                              ? "#551a89"
                              : trade.ink.ember
                                ? EMBER
                                : "#000",
                      }}
                    />
                  </button>
                ))}
              </div>

              <p className="mt-1 text-[11px] leading-4 tracking-[0.1em] text-pp-muted uppercase">
                {crossed ? "It stops arguing" : `Pressure ${at + 1} of ${wall.detents.length}`}
              </p>

              {/* Each part of the exchange is laid out once per detent in the
                  same cell, invisibly — the retraction at its fullest, with
                  the answer it gives instead — so the walk from one detent to
                  the next, which plays by itself, never moves a line: not the
                  Agent label under a caller line that wraps differently, and
                  not anything below the card. */}
              <div ref={exchangeRef} className="mt-7 min-h-[230px]">
                <p className="text-[11px] leading-4 font-medium tracking-[0.12em] text-pp-muted uppercase">
                  Caller
                </p>
                <div className="mt-2 grid content-start">
                  <p
                    key={`c-${at}`}
                    className={`${frame && instant ? "" : "ind-swap "}font-[family-name:var(--font-pp-cinema)] text-[21px] leading-8 text-pp-ink italic [grid-area:1/1] md:text-[24px] md:leading-9`}
                  >
                    &ldquo;{detent.caller}&rdquo;
                  </p>
                  {wall.detents.map((d, i) => (
                    <p
                      key={i}
                      aria-hidden
                      className="invisible font-[family-name:var(--font-pp-cinema)] text-[21px] leading-8 italic [grid-area:1/1] md:text-[24px] md:leading-9"
                    >
                      &ldquo;{d.caller}&rdquo;
                    </p>
                  ))}
                </div>

                <p className="mt-6 text-[11px] leading-4 font-medium tracking-[0.12em] uppercase" style={{ color: "#551a89" }}>
                  Agent
                </p>

                <div className="grid content-start">
                  <div className="[grid-area:1/1]">
                    {frame ? (
                      // Heard: the answer comes up as the agent starts it.
                      frame.answered &&
                      (isRetraction ? (
                        <SpokenRetraction
                          key={`s-${at}`}
                          wall={wall}
                          ember={trade.ink.ember}
                          beat={frame.at === at && frame.beat ? frame.beat : "instead"}
                          words={frame.words}
                          instant={instant}
                        />
                      ) : (
                        <p
                          key={`a-${at}`}
                          className={cn(!instant && "ind-swap", "mt-2 max-w-[560px] text-[17px] leading-7 text-pp-ink")}
                        >
                          {detent.agent}
                        </p>
                      ))
                    ) : isRetraction ? (
                      <Retraction key={`r-${at}`} wall={wall} ember={trade.ink.ember} still={still} />
                    ) : (
                      <p key={`a-${at}`} className="ind-swap mt-2 max-w-[560px] text-[17px] leading-7 text-pp-ink">
                        {detent.agent}
                      </p>
                    )}
                  </div>
                  {wall.detents.map((d, i) => (
                    <div key={i} aria-hidden className="invisible [grid-area:1/1]">
                      {i === wall.retraction.atDetent ? (
                        <div className="mt-2 max-w-[560px]">
                          <p className="text-[17px] leading-7">
                            {wall.retraction.begins}
                            <span className="font-light">|</span>
                          </p>
                          <p className="mt-1 text-[11px] leading-4 tracking-[0.1em] uppercase">Stopped mid-word</p>
                          <p className="mt-4 text-[17px] leading-7">{wall.retraction.instead}</p>
                        </div>
                      ) : (
                        <p className="mt-2 max-w-[560px] text-[17px] leading-7">{d.agent}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <StageSound
                className="mt-6"
                listen={track.listen}
                playing={playing}
                onSound={onSound}
                onListen={onListen}
                note={DRAMATISED}
              />
            </div>

            {/* The clause. Quoted, and sourced, because "it won't do that"
                is worth nothing next to the sentence that stops it. */}
            <aside className="rounded-2xl bg-pp-card p-5">
              <p className="text-[11px] leading-4 font-medium tracking-[0.12em] text-pp-muted uppercase">
                What stops it
              </p>
              <p className="mt-3 text-[15px] leading-[23px] text-pp-ink">&ldquo;{wall.clause}&rdquo;</p>
              <p className="mt-4 border-t border-pp-hair pt-3 text-[13px] leading-5 text-pp-muted">
                {wall.clauseSource}
              </p>
            </aside>
          </div>
        </div>
      </Frame>

      <Frame className="mt-5 px-6 md:px-12">
        <p className="max-w-[620px] text-[13px] leading-5 text-pp-muted">{wall.crosses}</p>
      </Frame>
    </section>
  );
}

/**
 * The half-sentence.
 *
 * It types, it is cut mid-word, and what was nearly said stays on screen
 * struck through rather than being tidied away — the record is the
 * point. Then the answer it is actually allowed to give arrives under it.
 */
function Retraction({
  wall,
  ember,
  still,
}: {
  wall: Trade["wall"];
  ember: boolean;
  still: boolean;
}) {
  const [beat, setBeat] = useState<Beat>(still ? "instead" : "begins");

  useEffect(() => {
    if (still) return;
    const cut = window.setTimeout(() => setBeat("cut"), 1250);
    const instead = window.setTimeout(() => setBeat("instead"), 1950);
    return () => {
      window.clearTimeout(cut);
      window.clearTimeout(instead);
    };
  }, [still]);

  // The strike is a graphic and may use the warm ember; the label under it
  // is 11px and may not.
  const ink = ember ? EMBER : "#551a89";
  const labelInk = ember ? EMBER_INK : "#551a89";

  return (
    <div className="mt-2 max-w-[560px]">
      <p
        className={cn(
          "text-[17px] leading-7 transition-all duration-300",
          beat === "begins" ? "ind-type text-pp-ink" : "text-pp-muted line-through decoration-2",
        )}
        style={beat !== "begins" ? { textDecorationColor: ink } : undefined}
      >
        {wall.retraction.begins}
        {beat === "begins" && <span className="ind-caret">|</span>}
      </p>

      {beat !== "begins" && (
        <p className="ind-swap mt-1 text-[11px] leading-4 tracking-[0.1em] uppercase" style={{ color: labelInk }}>
          Stopped mid-word
        </p>
      )}

      {beat === "instead" && (
        <p className="ind-swap mt-4 text-[17px] leading-7 text-pp-ink">{wall.retraction.instead}</p>
      )}
    </div>
  );
}

/**
 * The half-sentence, heard: the same record as Retraction, on the
 * audio's clock instead of its timers. The words appear as they are said
 * (all at once when lines swap in whole), the strike lands where the
 * clip is cut, and the answer it gives instead comes in as it starts.
 */
function SpokenRetraction({
  wall,
  ember,
  beat,
  words,
  instant,
}: {
  wall: Trade["wall"];
  ember: boolean;
  beat: Beat;
  /** Words of `begins` said so far. */
  words: number;
  instant: boolean;
}) {
  const ink = ember ? EMBER : "#551a89";
  const labelInk = ember ? EMBER_INK : "#551a89";
  const said = instant ? wall.retraction.begins : displayWords(wall.retraction.begins).slice(0, words).join(" ");

  return (
    <div className="mt-2 max-w-[560px]">
      <p
        className={cn(
          "text-[17px] leading-7 transition-all duration-300",
          beat === "begins" ? "text-pp-ink" : "text-pp-muted line-through decoration-2",
        )}
        style={beat !== "begins" ? { textDecorationColor: ink } : undefined}
      >
        {beat === "begins" ? said : wall.retraction.begins}
        {beat === "begins" && <span className="ind-caret">|</span>}
      </p>

      {beat !== "begins" && (
        <p
          className={cn(!instant && "ind-swap", "mt-1 text-[11px] leading-4 tracking-[0.1em] uppercase")}
          style={{ color: labelInk }}
        >
          Stopped mid-word
        </p>
      )}

      {beat === "instead" && (
        <p className={cn(!instant && "ind-swap", "mt-4 text-[17px] leading-7 text-pp-ink")}>
          {wall.retraction.instead}
        </p>
      )}
    </div>
  );
}
