"use client";

import { memo, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { Headphones, Pause, Play } from "lucide-react";
import type { Cue, CueFile } from "@/lib/audio/cue-types";
import { unlockFromGesture } from "@/components/site/audio/engine";
import { useVoiceTrack } from "@/components/site/audio/use-voice-track";
import type { RigField, Trade } from "@/lib/pages/industries/schema";
import { articleFor, spokenCall } from "@/lib/pages/industries/spoken-timing";
import { cn } from "@/lib/utils";
import { Eyebrow, Frame, PillLink, SectionTitle } from "../product/primitives";
import { useInView, usePrefersReducedMotion } from "../product/timing";
import { EMBER_INK, Gate, SETTLED, ToolName } from "./parts";
import { markProved } from "./proved";
import { ArtefactMark } from "./artefacts";
import { ListenPill, StageSound, useStageCues } from "./first-question";

/* ------------------------------------------------------------------ *
 * §3 — Run it. The signature.
 *
 * A call on a rail, and beside it the object that call produces: this
 * trade's own paperwork, drawn empty. The page plays the call once. As
 * the playhead crosses each moment a field lands in the form at exactly
 * the second the information arrived — not all at once at the end — so
 * the causality is legible before anyone has touched anything.
 *
 * Then it hands over the puck. Dragging forward replays it. DRAGGING
 * BACKWARD TAKES IT APART: cross the booking going left and the slot
 * empties, the book_appointment row leaves the log, and the receipt
 * un-writes itself. Nothing else in this category is reversible, and
 * reversibility is not a trick here — it is the argument. It proves that
 * no field on that form is decoration, that each one was caused by a
 * specific second of a specific call, and it lets a sceptic do the thing
 * sceptics do, which is go back and check.
 *
 * The control is a real <input type="range"> drawn invisibly over the
 * rail. One element gives mouse drag, touch drag, keyboard arrows and a
 * spoken value, instead of three separate code paths and an inaccessible
 * instrument. `touch-action: pan-y` on it so a vertical flick scrolls
 * the page straight through the rail — on a phone that single line
 * decides whether this reads as beautiful or as broken.
 *
 * LISTEN. The call can also be heard, at its own pace: "Listen to the
 * call" plays it once at 1x with AI-generated voices (one track per
 * trade, lib/audio/cues/industry-run-it-call.json, fetched only once
 * sound is on or on that press). While it plays the audio's clock is
 * the rail's: each line swaps in as it is said, and the tools and the
 * fields land between the same two lines as written, re-timed to the
 * recording (spokenCall in lib/pages/industries/spoken-timing.ts).
 * Dragging the puck seeks the audio. The silent 14-second pass is the
 * one it always was, on the authored clock, and it never makes a sound.
 * Off screen the call pauses, and plays on when it is back; another
 * section's press takes the sound and the call runs on silently; sound
 * turned off lets it finish silently. Under reduced motion lines swap
 * in whole. A trade without a track that says its call as written has
 * no Listen control at all (`listenSeconds` null, from the page).
 * Nothing here is announced line by line, so there is no live region to
 * quiet while the call is heard.
 * ------------------------------------------------------------------ */

/** The call is 64 seconds. Nobody watches a page for 64 seconds. */
const PLAYBACK_SECONDS = 14;
const STEPS = 1000;

/** The section's claim on the site's one sound (components/site/audio/engine.ts). */
const VOICE_ID = "industry-run-it-call";

/** The 1x listen mode: not started, under way, paused by the reader, or heard to the end. */
type Listening = "off" | "playing" | "paused" | "ended";

function clock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function RunIt({
  trade,
  listenSeconds = null,
}: {
  trade: Trade;
  /** The spoken call's length in whole seconds, from its track (the page reads it); null: no track, no Listen. */
  listenSeconds?: number | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, "-15% 0px");
  /** A screen away: with sound on, the call's cues are fetched now, so a press plays at once. */
  const near = useInView(ref, "100% 0px");
  const still = usePrefersReducedMotion();

  const [progress, setProgress] = useState(0);
  const [touched, setTouched] = useState(false);

  /* ── The voice ───────────────────────────────────────────────────── */

  const canListen = listenSeconds !== null;
  const track = useVoiceTrack(VOICE_ID, { active: inView });
  const trackRef = useRef(track);
  useEffect(() => {
    trackRef.current = track;
  });
  const { fileRef, load } = useStageCues("industry-run-it-call", track.on && near && canListen);
  /** The call's track and the trade re-timed to it, once a press has asked for it. */
  const [spoken, setSpoken] = useState<{ cue: Cue; trade: Trade } | null>(null);
  const [listening, setListening] = useState<Listening>("off");
  /** What the section draws from: the call as spoken while listening, else as written. */
  const shownTrade = listening !== "off" && spoken ? spoken.trade : trade;
  /** Reduced motion or the still tier, listening: lines and fields swap in whole. */
  const instant = listening !== "off" && track.listen;

  // Autoplay: one pass, then it stops dead. It never loops — a looping
  // demonstration reads as a screensaver and stops being evidence.
  //
  // The pass runs only while the section is on screen: a reader who scrolls
  // away mid-call leaves it paused where it was (no frame a second spent on
  // a rail nobody is looking at), and it plays on from there when they come
  // back. `finished` only stops a pass that already reached the end from
  // starting over; a touch stops it for good.
  const raf = useRef(0);
  const played = useRef(0);
  const finished = useRef(false);

  useEffect(() => {
    // Listening, the audio's clock drives the rail (below); the silent pass gives way for good.
    if (listening !== "off") return;
    if (still) {
      setProgress(1);
      return;
    }
    if (!inView || touched || finished.current) return;
    const begin = performance.now() - played.current * PLAYBACK_SECONDS * 1000;
    const tick = (now: number) => {
      const p = Math.min(1, (now - begin) / (PLAYBACK_SECONDS * 1000));
      played.current = p;
      setProgress(p);
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else finished.current = true;
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [inView, still, touched, listening]);

  // Listening: the rail is the audio's clock, frame by frame, until the call ends.
  useEffect(() => {
    if (listening !== "playing" || !spoken || !inView) return;
    let frame = 0;
    const tick = () => {
      const at = trackRef.current.time();
      setProgress(Math.min(1, at / spoken.cue.dur));
      if (at >= spoken.cue.dur) {
        setListening("ended");
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [listening, spoken, inView]);

  // Back on screen mid-call: it plays on from where it paused (the track let go when it left), as a
  // run, not a press: it claims the sound only if nobody else is playing, else carries on silently.
  const away = useRef(false);
  const playOn = useEffectEvent(() => {
    if (listening !== "playing" || !spoken) return;
    const voice = trackRef.current;
    if (voice.time() >= spoken.cue.dur) return;
    // Under reduced motion only a press may play: the run waits for one.
    if (!voice.play(spoken.cue) && voice.listen) setListening("paused");
  });
  // Off screen under reduced motion (or the still tier): the call pauses with the track, and the transport says so.
  const pauseAway = useEffectEvent(() => {
    if (listening === "playing" && trackRef.current.listen) setListening("paused");
  });
  useEffect(() => {
    if (!inView) {
      away.current = true;
      pauseAway();
      return;
    }
    if (!away.current) return;
    away.current = false;
    playOn();
  }, [inView]);

  /** Plays the call from cue time `at`, on its spoken clock. Nothing happens without a track that says it as written. */
  function listenFrom(file: CueFile | null, at: number) {
    const call = spokenCall(trade, file);
    if (!call) return;
    setSpoken(call);
    setListening("playing");
    setProgress(Math.min(1, at / call.cue.dur));
    trackRef.current.play(call.cue, at, { press: true });
  }

  /** Inside a press: sound goes on with it, and the call plays from the top once its cues are here. */
  function listenFromTop() {
    unlockFromGesture();
    const file = fileRef.current;
    if (file) listenFrom(file, 0);
    else void load().then((f) => listenFrom(f, 0));
  }

  /** Inside a press: the paused (or silently running) call plays on, heard, from where it is. */
  function listenOn() {
    if (!spoken) return;
    unlockFromGesture();
    setListening("playing");
    trackRef.current.play(spoken.cue, undefined, { press: true });
  }

  /** "Listen to the call" / Pause / Play. */
  function onTransport() {
    if (listening === "playing") {
      trackRef.current.pause();
      setListening("paused");
    } else if (listening === "paused") {
      listenOn();
    } else {
      listenFromTop();
    }
  }

  /** This section's sound pill, inside its click: on, the call is heard, from where it is or from the top. */
  function onSound(on: boolean) {
    if (!on || !canListen) return;
    if (listening === "playing" || listening === "paused") listenOn();
    else listenFromTop();
  }

  function take(next: number) {
    cancelAnimationFrame(raf.current);
    setTouched(true);
    setProgress(next);
    markProved("run");
    // Listening, the puck seeks the audio; past the end, the call waits there for Play.
    if (listening !== "off" && spoken) {
      trackRef.current.seek(next * spoken.cue.dur);
      if (listening === "ended" && next < 1) setListening("paused");
    }
  }

  const t = progress * shownTrade.duration;
  const turn = useMemo(() => {
    let current = shownTrade.turns[0];
    for (const x of shownTrade.turns) if (x.at <= t) current = x;
    return current;
  }, [t, shownTrade.turns]);

  // The playback re-renders this section on every frame, but only the rail
  // actually moves every frame. Everything else is handed the last moment
  // it has passed, not the clock, so it renders when that moment changes —
  // a handful of times a call instead of sixty times a second.
  const ranTo = lastAt(shownTrade.toolRuns, t);
  const filledTo = lastAt(shownTrade.rig.fields, t);
  const shown = Math.round(Math.min(1, Math.max(0, (progress - 0.88) / 0.1)) * receiptWords(trade).length);
  /** The length the caption gives: the call's as written, or as heard once it is being listened to. */
  const seconds = listening !== "off" && spoken ? Math.floor(spoken.trade.duration) : trade.duration;

  return (
    <section id="run" ref={ref} className="scroll-mt-28">
      <Frame className="px-6 md:px-12">
        <Eyebrow>Run it</Eyebrow>
        <SectionTitle className="mt-4 max-w-[760px]">
          Every line on the job card came from a second you can point at
        </SectionTitle>
        <p className="mt-5 max-w-[560px] text-base leading-[25px] text-pp-ink/80">
          One call, on a rail. Drag it forward and it fills in. Drag it back and it comes apart — the
          slot empties, the tool leaves the log, and the confirmation un-writes itself.
        </p>
      </Frame>

      <Frame className="mt-8 px-2 md:mt-10 md:px-4">
        <div className="rounded-[24px] bg-white p-4 shadow-[0_0_0_1px_rgb(24_16_40/0.06)] md:p-7">
          <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10">
            {/* The call. On a phone this comes second: the paperwork is
                the point and the rail is the thing your thumb reaches. */}
            <div className="order-2 lg:order-1">
              <Transcript
                turns={shownTrade.turns}
                side={turn.side}
                text={turn.text}
                ember={trade.ink.ember}
                instant={instant}
              />

              <Rail
                trade={shownTrade}
                progress={progress}
                onScrub={take}
                label={`${clock(t)} of ${clock(shownTrade.duration)} — ${turn.text}`}
              />

              {canListen && (
                <StageSound
                  className="mt-3"
                  listen={track.listen}
                  playing={listening === "playing"}
                  onSound={onSound}
                  transport={(describedBy) => (
                    <ListenPill
                      label={
                        listening === "playing"
                          ? "Pause"
                          : listening === "paused"
                            ? "Play"
                            : `Listen to the call · ${clock(listenSeconds)}`
                      }
                      icon={listening === "playing" ? Pause : listening === "paused" ? Play : Headphones}
                      small={listening === "playing" || listening === "paused"}
                      onPress={onTransport}
                      describedBy={describedBy}
                    />
                  )}
                />
              )}

              <ToolLog toolRuns={shownTrade.toolRuns} ranTo={ranTo} instant={instant} />
            </div>

            {/* The rig: this trade's own paperwork, drawn empty. */}
            <div className="order-1 lg:order-2">
              <JobCard trade={shownTrade} clockText={clock(t)} filledTo={filledTo} shown={shown} instant={instant} />
            </div>
          </div>
        </div>
      </Frame>

      <Frame className="mt-5 px-6 md:px-12">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <p className="text-[13px] leading-5 text-pp-muted">
            {canListen && listenSeconds !== null && listening === "off" ? (
              // The silent pass keeps the written call's clock, which is not the recording's length: the
              // sentence gives only the recording's (the same as the Listen control's), and says which
              // clock the rail keeps.
              <>
                Played back in {PLAYBACK_SECONDS} seconds, or listen to the whole call ({clock(listenSeconds)}) at its own
                pace. The clock on the rail keeps the written call&rsquo;s time.
              </>
            ) : (
              <>
                {articleFor(seconds)} {seconds}-second call, played back in {PLAYBACK_SECONDS}
                {canListen && ", or listen to it at its own pace"}. The clock on the rail is the call&rsquo;s own.
              </>
            )}
          </p>
          <PillLink href="/register" size="sm" className="ml-auto">
            Build this agent
          </PillLink>
        </div>
      </Frame>
    </section>
  );
}

/* ------------------------------------------------------------------ */

/** The latest `at` that `t` has reached, or -1 before the first. */
function lastAt(items: readonly { at: number }[], t: number) {
  let last = -1;
  for (const x of items) if (x.at <= t && x.at > last) last = x.at;
  return last;
}

const wordCache = new WeakMap<Trade, string[]>();
function receiptWords(trade: Trade) {
  let words = wordCache.get(trade);
  if (!words) wordCache.set(trade, (words = trade.rig.receipt.split(" ")));
  return words;
}

/**
 * The line being spoken. Every turn of the call is laid out underneath it
 * in the same cell, invisibly, so the transcript is as tall as the longest
 * turn and the rail below it never moves while the call plays.
 */
const Transcript = memo(function Transcript({
  turns,
  side,
  text,
  ember,
  instant = false,
}: {
  turns: Trade["turns"];
  side: "caller" | "agent";
  text: string;
  ember: boolean;
  /** Listening under reduced motion: the line swaps in whole, with no fade. */
  instant?: boolean;
}) {
  return (
    <div className="grid min-h-[92px] md:min-h-[84px]">
      <div className="[grid-area:1/1]">
        <Line side={side} text={text} ember={ember} live instant={instant} />
      </div>
      {turns.map((x) => (
        <div key={`${x.side}-${x.at}`} aria-hidden className="invisible [grid-area:1/1]">
          <Line side={x.side} text={x.text} ember={ember} />
        </div>
      ))}
    </div>
  );
});

function Line({
  side,
  text,
  ember,
  live,
  instant,
}: {
  side: "caller" | "agent";
  text: string;
  ember: boolean;
  live?: boolean;
  instant?: boolean;
}) {
  return (
    <>
      <p className="text-[11px] leading-4 font-medium tracking-[0.12em] uppercase" style={{ color: side === "caller" ? "#6b6878" : ember ? EMBER_INK : "#551a89" }}>
        {side === "caller" ? "Caller" : "Agent"}
      </p>
      <p
        key={live ? text : undefined}
        className={cn(
          "mt-2 text-[17px] leading-7 md:text-[19px] md:leading-8",
          live && !instant && "ind-swap",
          side === "caller"
            ? "font-[family-name:var(--font-pp-cinema)] text-pp-ink italic"
            : "text-pp-ink",
        )}
      >
        {text}
      </p>
    </>
  );
}

/**
 * The last three tools the call has run. Three rows are always reserved,
 * as an invisible list under the live one, so the log filling up does not
 * push the page down on a phone, where it is the last thing in the card.
 */
const ToolLog = memo(function ToolLog({
  toolRuns,
  ranTo,
  instant = false,
}: {
  toolRuns: Trade["toolRuns"];
  ranTo: number;
  /** Listening under reduced motion: rows arrive without a fade. */
  instant?: boolean;
}) {
  const runs = toolRuns.filter((r) => r.at <= ranTo).slice(-3);
  const row = "flex items-baseline gap-3 border-b border-pp-rule pb-1.5";
  return (
    <div className="mt-5 min-h-[76px]">
      <p className="text-[11px] leading-4 font-medium tracking-[0.12em] text-pp-muted uppercase">
        Tools it ran
      </p>
      <div className="mt-2 grid">
        <ul className="space-y-1.5 [grid-area:1/1]">
          {runs.map((r) => (
            <li key={`${r.tool}-${r.at}`} className={instant ? row : `ind-row ${row}`}>
              <ToolName tool={r.tool} className="text-pp-ink" />
              <span className="ml-auto text-[11px] text-pp-muted tabular-nums">{r.ms} ms</span>
            </li>
          ))}
          {runs.length === 0 && (
            <li className="text-[13px] leading-5 text-pp-muted">Nothing yet — it is still listening.</li>
          )}
        </ul>
        <ul aria-hidden className="invisible space-y-1.5 [grid-area:1/1]">
          {toolRuns.slice(0, 3).map((r) => (
            <li key={`${r.tool}-${r.at}`} className={row}>
              <ToolName tool={r.tool} />
              <span className="ml-auto text-[11px] tabular-nums">{r.ms} ms</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
});

/**
 * The rail. Ticks are the turns; marks under it are the tools. The puck
 * is drawn; the thing that actually moves is an invisible range input
 * lying over the whole rail.
 */
function Rail({
  trade,
  progress,
  onScrub,
  label,
}: {
  trade: Trade;
  progress: number;
  onScrub: (p: number) => void;
  label: string;
}) {
  const pct = progress * 100;
  return (
    <div className="relative mt-4 h-16 select-none">
      {/* the rail */}
      <div className="absolute top-1/2 right-0 left-0 h-px -translate-y-1/2 bg-pp-rule" />
      <div
        className="absolute top-1/2 left-0 h-px -translate-y-1/2 bg-pp-ink"
        style={{ width: `${pct}%` }}
      />

      {/* the turns */}
      {trade.turns.map((x) => (
        <span
          key={`${x.side}-${x.at}`}
          className={cn(
            "absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors duration-200",
            x.at <= progress * trade.duration ? "bg-pp-ink" : "bg-pp-rule",
          )}
          style={{ left: `${(x.at / trade.duration) * 100}%` }}
        />
      ))}

      {/* the tools */}
      {trade.toolRuns.map((r) => (
        <span
          key={`${r.tool}-${r.at}`}
          className="absolute top-1/2 h-3 w-px translate-y-1 transition-opacity duration-200"
          style={{
            left: `${(r.at / trade.duration) * 100}%`,
            background: "#551a89",
            opacity: r.at <= progress * trade.duration ? 1 : 0.2,
          }}
        />
      ))}

      {/* the clock */}
      <span
        className="absolute top-0 -translate-x-1/2 text-[11px] text-pp-muted tabular-nums"
        style={{ left: `${pct}%` }}
      >
        {clock(progress * trade.duration)}
      </span>

      {/* the puck */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_1.6px_#000]"
        style={{ left: `${pct}%` }}
      />

      <input
        type="range"
        min={0}
        max={STEPS}
        step={1}
        value={Math.round(progress * STEPS)}
        onChange={(e) => onScrub(Number(e.target.value) / STEPS)}
        aria-label="Scrub the call"
        aria-valuetext={label}
        className="absolute inset-0 h-full w-full cursor-grab opacity-0 active:cursor-grabbing"
        style={{ touchAction: "pan-y" }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * The job card.
 *
 * Hand-drawn for this trade, not a rounded rectangle with a different
 * label on it: a ruled form with the fields a heating engineer's office
 * actually writes down, in the order a call fills them. If these are
 * drawn lazily across sixteen trades the whole per-trade promise
 * collapses, so the shape is the thing to protect in review.
 * ------------------------------------------------------------------ */

// The receipt writes itself over the last stretch of the call and
// un-writes itself word by word on the way back. A fade would say the
// same thing less precisely: the point is that the sentence is being
// *produced* by the call, so it has to come apart the way it was made.
const JobCard = memo(function JobCard({
  trade,
  clockText,
  filledTo,
  shown,
  instant = false,
}: {
  trade: Trade;
  clockText: string;
  filledTo: number;
  shown: number;
  /** Listening under reduced motion: fields land without a fade. */
  instant?: boolean;
}) {
  const words = receiptWords(trade);
  return (
    <div className="rounded-2xl bg-pp-card p-5">
      <div className="flex items-center justify-between border-b border-pp-hair pb-3">
        <div className="flex items-center gap-3">
          <ArtefactMark form={trade.rig.form} />
          <p className="text-[13px] leading-5 font-medium text-pp-ink">{trade.rig.title}</p>
        </div>
        <span className="text-[11px] text-pp-muted tabular-nums">{clockText}</span>
      </div>

      <dl className="mt-1">
        {trade.rig.fields.map((f) => (
          <Field key={f.id} field={f} on={f.at <= filledTo} instant={instant} />
        ))}
      </dl>

      <div className="mt-4 min-h-[44px] border-t border-pp-hair pt-3">
        <p className="text-[13px] leading-5" style={{ color: trade.ink.settled ? SETTLED : "#551a89" }}>
          {words.map((w, i) => (
            <span key={i} className="transition-opacity duration-150" style={{ opacity: i < shown ? 1 : 0 }}>
              {w}{" "}
            </span>
          ))}
        </p>
      </div>
    </div>
  );
});

function Field({ field, on, instant }: { field: RigField; on: boolean; instant?: boolean }) {
  return (
    <div
      className={cn(
        "border-b border-pp-hair/60 py-2.5 last:border-b-0",
        !field.onPhone && "hidden lg:block",
      )}
    >
      {/* Wraps: in the 340px column, or on a phone, a long label beside a
          long gate otherwise squeezes both into two-word stacks. When they
          do not fit side by side the gate drops under the label. */}
      <dt className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-[11px] leading-4 tracking-[0.06em] text-pp-muted uppercase">{field.label}</span>
        {/* Always laid out, and only shown once the field lands, so a gate
            that needs a line of its own does not add it mid-call. */}
        {field.from !== "caller" && <Gate tool={field.from} className={on ? "ml-auto" : "invisible ml-auto"} />}
      </dt>
      {/* The value is laid out before it arrives, invisibly, so the card is
          its full height from the first frame: on a phone the transcript
          and the rail sit under it, and a card that grew a line with each
          field would walk them down the screen while the call plays. */}
      <dd className="relative mt-1 min-h-[22px]">
        <span
          key={on ? "on" : "off"}
          aria-hidden={on ? undefined : true}
          className={cn("block text-[15px] leading-[22px] text-pp-ink", on ? !instant && "ind-land" : "invisible")}
        >
          {field.value}
        </span>
        {!on && (
          /* An empty rule, so the form has a shape before it has content
             and the reader can see what has not happened yet. */
          <span aria-hidden className="absolute inset-x-0 top-0 block h-px w-2/3 bg-pp-hair" />
        )}
      </dd>
    </div>
  );
}
