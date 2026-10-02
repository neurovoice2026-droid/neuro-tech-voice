"use client";

import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";
import { cueIn, loadCueFile, type Cue, type CueFile, type CueTurn } from "@/lib/audio";
import type { CAA_REDLINE, Draft, Status } from "@/lib/pages/custom-ai-agents";
import { cn } from "@/lib/utils";
import { envelopeAt } from "@/components/site/audio/cue";
import { isSoundOn, unlockFromGesture } from "@/components/site/audio/engine";
import { SoundButton } from "@/components/site/audio/sound-button";
import { useVoiceTrack } from "@/components/site/audio/use-voice-track";
import { Eyebrow, Frame, SectionTitle } from "@/components/site/product/primitives";
import { useInView, usePrefersReducedMotion } from "@/components/site/product/timing";
import { ListenButton, Segs, Stack, StatusDot, Turns, afterLastWord, begunAt, levelOf, sayingAt, voicedLines } from "./parts";
import { markProved } from "./proved";

/* ------------------------------------------------------------------ *
 * §1 — Written with your team. The redline.
 *
 * The objection: "I don't have time to write prompts." The honest answer
 * is not that prompts are easy. It is that the owner never has to write
 * one: they say the rule the way they would say it to a new starter, and
 * we write it, ring it, and write it again until a test call keeps it.
 *
 * So the instrument is one rule and its three drafts, each with the test
 * call that judged it. Draft 1 is the owner's own sentence, and the test
 * call shows why a sentence that is perfectly clear to a person is not a
 * rule to an agent. Draft 2 strikes it and writes it properly; the test
 * call finds the hole in that too. Draft 3 strikes one clause and adds
 * the fix, and the test call holds. The page does the whole redraft by
 * itself, once, and rests on the version that held. It never loops: a
 * rule redrafting itself forever would argue that it never settles.
 *
 * THE PEN IS VIOLET, NOT RED. A red strike would say "error", and the
 * first drafts are not errors — they are how every rule starts. Violet
 * is this page's colour for the product being worked on, so the strike
 * and the inked insertion are our hand in the brief. Green appears once,
 * on the one verdict that genuinely held; a rewrite is violet, because
 * a change is the build doing its job, not a failure to hide.
 *
 * THE STRIKE FOLLOWS THE LINE. It is a background layer with
 * `box-decoration-break: clone` (caa.css), not text-decoration, so when
 * the struck sentence wraps — it does at 320px — each line fragment
 * gets its own stroke and they sweep left to right in reading order.
 *
 * TIMING. The draft changes every ~2.3s: long enough to read a verdict
 * of a dozen words, short enough that the whole redraft is over in
 * about 6.8s. Inside a draft the strike comes first (50ms after the new
 * draft is on screen, so the unstruck frame has painted and there is
 * something to transition from), the insertion half a second later —
 * you see what went before you see what replaced it — and the call
 * plays under both at the pace of a turn every ~400ms. The verdict
 * lands last, half a second after the last word, because it is the
 * reason for the next draft.
 *
 * RESERVATION. The draft body, the provenance line, the transcript and
 * the verdict are each laid out once per draft in the same grid cell,
 * invisibly, so the card is the height of its tallest draft on the
 * server's first paint and the redraft moves nothing — not the aside,
 * not the footnote, not the page below. The sizers render every draft
 * complete (struck, inked, every turn) because that is the text each
 * one ends on. The aside also keeps a 260px floor so the grey card
 * does not look starved on the one-turn frames at wide widths.
 *
 * FIRST PAINT IS THE FINISHED RULE. The server renders Draft 3 complete,
 * so a reader without script (and a crawler) gets the version that held.
 * Once hydrated, the section arms itself at Draft 1 — it is below the
 * fold, inside a Deferred box, so the reader never sees the swap — and
 * waits to be scrolled into. Reduced motion never arms: it stays on the
 * finished rule with no clock at all.
 *
 * SOUND (off unless the visitor turns it on; nothing is fetched before).
 * Each draft's test call can be heard: AI-generated voices, the same
 * caller each time (lib/audio/cues/caa-redline-test-calls.json, one track
 * per draft). With sound on the redraft is played on the calls' own
 * clock, which is the master: a draft opens, the pen strikes and inks at
 * the same +50 / +500ms, each turn lands as its voice begins, the line
 * being said carries the margin tick, and the verdict lands half a second
 * after the last word, as it does read-paced. The verdict is then given
 * VERDICT_READ_MS to be read before the next draft's call rings. The
 * whole redraft takes about 45s heard, against 6.8s read.
 *   · It starts spoken only if it can be heard: an autoplay never takes
 *     the sound from another stage, and one that can't claim it runs
 *     read-paced (SCRIPT) instead. A draft pick, or the sound control
 *     here, is a press: it always takes the sound.
 *   · Sound turned on mid-redraft starts the draft on screen again, heard,
 *     and carries on from there; turned off, the draft on screen finishes
 *     on the same clock in silence and the drafts after it are read-paced.
 *   · A draft pick with sound on plays that draft's call, and only it.
 *   · Off screen, the call pauses (and the redraft with it) until it is
 *     back; read-paced, the redraft finishes off screen as before.
 *   · Focus inside the card ends a heard redraft after the draft on
 *     screen, which finishes with its voice.
 *   · Reduced motion: nothing plays by itself. "Listen" plays the draft
 *     on screen, its turns appearing as they are said, at once.
 * With sound off none of this runs, and the section is exactly as above.
 * ------------------------------------------------------------------ */

type Data = typeof CAA_REDLINE;

type Beat = { draft: number; reached: number; verdict: boolean; struck: boolean; inked: boolean };

/** Before the first call rings: Draft 1, nobody has spoken yet. */
const START: Beat = { draft: 0, reached: 0, verdict: false, struck: false, inked: false };

/** A draft finished: struck, inked, every turn heard and the verdict in. */
const done = (draft: number, turns: number): Beat => ({ draft, reached: turns, verdict: true, struck: true, inked: true });

/*
 * The redraft, as absolute times from the moment the card comes into
 * view. Each draft opens with only the caller's opening line showing
 * (the same caller each time, so it is the fixed point the eye returns
 * to), then strike, ink, the rest of the call, and the verdict.
 */
const SCRIPT: readonly (readonly [number, Partial<Beat>])[] = [
  [250, { reached: 1 }],
  [700, { reached: 2 }],
  [1300, { verdict: true }],

  [2300, { draft: 1, reached: 1, verdict: false, struck: false, inked: false }],
  [2350, { struck: true }],
  [2600, { reached: 2 }],
  [2800, { inked: true }],
  [3000, { reached: 3 }],
  [3400, { reached: 4 }],
  [4300, { verdict: true }],

  [4700, { draft: 2, reached: 1, verdict: false, struck: false, inked: false }],
  [4750, { struck: true }],
  [5000, { reached: 2 }],
  [5200, { inked: true }],
  [5400, { reached: 3 }],
  [5800, { reached: 4 }],
  [6300, { verdict: true }],
];

/*
 * Two §4 strings this island needs but does not receive. The data module
 * exports them as their own values (SPEAKERS, STATUS_LABEL), and it is
 * server-only, so a client file may not import them; the page hands this
 * section CAA_REDLINE alone. Copied verbatim — keep in step with
 * lib/pages/custom-ai-agents.ts.
 */
const SPEAKERS = { caller: "Caller", agent: "Agent" } as const;
const STATUS_LABEL: Record<Status, string> = {
  held: "Held",
  rewritten: "Rewritten",
  brief: "Changed the brief",
  document: "Changed a document",
};

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink";
const LABEL = "text-[11px] leading-4 font-medium tracking-[0.12em] text-pp-muted uppercase";

/* ---------- sound ---------- */

/** This section's claim on the site's one sound (components/site/audio/engine.ts). */
const VOICE_ID = "caa-redline";
/** Heard, the pen moves as it does read-paced: the strike 50ms into the draft, the ink half a second in. */
const STRIKE_S = 0.05;
const INK_S = 0.5;
/** The verdict lands this long after the call's last word, as it does read-paced. */
const VERDICT_AFTER_S = 0.5;
/** Heard, the verdict is read this long before the next draft's call rings (a dozen words at ~230 wpm). */
export const VERDICT_READ_MS = 2400;
/** Where each draft opens in SCRIPT, so the read-paced redraft can take over at any draft. */
export const DRAFT_AT: readonly number[] = [0, ...SCRIPT.filter(([, patch]) => patch.draft !== undefined).map(([at]) => at)];

/** A draft's test call as heard: its track, its turns as shown, when its verdict lands. */
export type DraftVoice = { cue: Cue; turns: CueTurn[]; verdictAt: number };

/** The track for `draft`, if it says that draft's call as written; null leaves the draft read-paced. */
export function draftVoice(cue: Cue | null | undefined, draft: Pick<Draft, "turns">): DraftVoice | null {
  const turns = voicedLines(cue, draft.turns);
  if (!cue || !turns || turns.length !== cue.turns.length || !turns.length) return null;
  return { cue, turns, verdictAt: afterLastWord(cue, turns[turns.length - 1], VERDICT_AFTER_S) };
}

/** Where a heard draft is at cue time `t`, and the turn being said (-1 for none). */
export function spokenBeat(v: DraftVoice, draft: number, t: number): Beat & { saying: number } {
  const verdict = t >= v.verdictAt;
  return {
    draft,
    reached: begunAt(v.turns, t),
    verdict,
    struck: t >= STRIKE_S,
    inked: t >= INK_S,
    saying: verdict ? -1 : sayingAt(v.turns, t),
  };
}

/** SCRIPT from draft `k` on, its times from that draft's opening. */
export function scriptFrom(k: number): (readonly [number, Partial<Beat>])[] {
  const base = DRAFT_AT[k] ?? 0;
  return SCRIPT.filter(([at]) => at >= base).map(([at, patch]) => [at - base, patch] as const);
}

const sameBeat = (a: Beat, b: Beat) =>
  a.draft === b.draft && a.reached === b.reached && a.verdict === b.verdict && a.struck === b.struck && a.inked === b.inked;

// False on the server and while hydrating, true after: lets the first
// paint be the finished rule and the hydrated section arm itself without
// setting state in an effect.
const noop = () => () => {};
const useHydrated = () =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

export function Redline({ data }: { data: Data }) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, "-15% 0px");
  const still = usePrefersReducedMotion();
  const hydrated = useHydrated();
  const { drafts } = data;
  const last = drafts.length - 1;

  const [beat, setBeat] = useState<Beat>(START);
  const [touched, setTouched] = useState(false);

  /* ---------- sound (see the header) ---------- */
  /** The run in progress is a press here (a pick, the sound control, Listen): it takes the sound, and keeps it for its drafts. Cleared when another stage's press takes it. */
  const pressed = useRef(false);
  const track = useVoiceTrack(VOICE_ID, {
    active: inView,
    onPreempt: () => {
      pressed.current = false;
    },
  });
  const trackRef = useRef(track);
  useEffect(() => {
    trackRef.current = track;
  });
  /** Each draft's call as heard: undefined until fetched (once sound is on), null for a draft whose track doesn't say it as written. */
  const [voice, setVoice] = useState<(DraftVoice | null)[] | undefined>(undefined);
  /** A heard run: the draft being heard, and whether the drafts after it follow (the redraft) or not (a pick). */
  const [speaking, setSpeaking] = useState<{ draft: number; chain: boolean } | null>(null);
  /** The turn whose voice is playing, for the margin tick; -1 for none. */
  const [saying, setSaying] = useState(-1);
  /** Reduced motion: the Listen transport. */
  const [listen, setListen] = useState<"playing" | "paused" | null>(null);
  /** The heard run's place: its draft, and the verdict's reading time left (ms; -1 while the call plays). */
  const run = useRef({ draft: 0, chain: false, dwell: -1 });
  /** How the redraft is being paced: SCRIPT, heard, or neither (not started, or finished). */
  const pacing = useRef<"script" | "spoken" | null>(null);
  /** A press that came before the tracks had arrived: it starts its conversation when they do. */
  const pending = useRef<"sound" | "listen" | null>(null);
  /** The heard run left the screen: when it is back, the call carries on. */
  const away = useRef(false);
  const asideRef = useRef<HTMLElement>(null);
  /** Nothing plays by itself: reduced motion, or the still tier. */
  const listenMode = still || track.listen;

  // What is on screen. Unhydrated and reduced motion both show the rule
  // that held; a pick always wins, so a reduced-motion reader can still
  // walk the drafts. So does Listen, while it plays.
  const view: Beat = !hydrated || (still && !touched && !speaking) ? done(last, drafts[last].turns.length) : beat;

  const started = useRef(false);
  const timers = useRef<number[]>([]);
  // Unmount only. Scrolling past mid-redraft must not strand the rule on
  // Draft 2 with the `started` guard refusing to finish it.
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  /**
   * Draft `k`'s call, heard from its first word: true when it plays. False
   * (and nothing changes) without its track, with sound off, or when an
   * autoplay can't take the sound; the caller then reads the draft instead.
   */
  const speak = (k: number, chain: boolean, press: boolean, v = voice, unlock = false) => {
    const dv = v?.[k];
    const t = trackRef.current;
    if (!dv || !(unlock || isSoundOn())) return false;
    const next = chain ? v?.[k + 1]?.cue.src : undefined;
    if (!t.play(dv.cue, 0, { press, unlock, next })) {
      // Refused (another stage is playing, or sound went off): no silent spoken clock left running.
      t.pause();
      return false;
    }
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    pressed.current = press;
    run.current = { draft: k, chain, dwell: -1 };
    pacing.current = "spoken";
    away.current = false;
    setBeat({ draft: k, reached: 0, verdict: false, struck: false, inked: false });
    setSaying(-1);
    setSpeaking({ draft: k, chain });
    return true;
  };

  /** The read-paced redraft, from draft `k` on (SCRIPT, shifted to start now). */
  const readFrom = (k: number) => {
    timers.current.forEach(window.clearTimeout);
    if (k === 0) setBeat(START);
    pacing.current = "script";
    timers.current = scriptFrom(k).map(([at, patch]) =>
      window.setTimeout(() => setBeat((b) => ({ ...b, ...patch })), at),
    );
  };

  /** A heard run is over (or given up): no tick, no Listen, the draft as it stands. */
  const stopSpeaking = () => {
    setSpeaking(null);
    setSaying(-1);
    setListen(null);
    if (pacing.current === "spoken") pacing.current = null;
  };

  /**
   * The press of the sound control here (or Listen): this section's
   * conversation, heard. With reduced motion, the draft on screen. Mid-
   * redraft, the draft on screen again from its start, and the redraft on
   * from there. Before the redraft has played, nothing yet: it will be
   * heard when it starts. After it, the draft on screen, once.
   */
  const converse = (v: (DraftVoice | null)[], asListen: boolean) => {
    if (asListen) {
      if (speak(view.draft, false, true, v)) setListen("playing");
      return;
    }
    if (!started.current) return;
    const mid =
      (pacing.current === "script" && !(beat.draft === last && beat.verdict)) ||
      (pacing.current === "spoken" && run.current.chain);
    speak(mid ? beat.draft : view.draft, mid, true, v);
  };

  // The tracks are fetched once sound is on, never before.
  const onFile = useEffectEvent((file: CueFile | null) => {
    if (!file) {
      // Not fetched (a flaky connection): a press made meanwhile is dropped; sound on again retries.
      pending.current = null;
      return;
    }
    const v = drafts.map((d, k) => draftVoice(cueIn(file, data.voice.tracks[k]), d));
    setVoice(v);
    const p = pending.current;
    pending.current = null;
    if (p) converse(v, p === "listen");
  });
  useEffect(() => {
    if (!track.on || voice !== undefined) return;
    let live = true;
    void loadCueFile(data.voice.surface).then((file) => {
      if (live) onFile(file);
    });
    return () => {
      live = false;
    };
  }, [track.on, voice, data.voice.surface]);

  /** Heard from the start, if sound is on and it can be: false leaves the redraft to SCRIPT. */
  const speakFromStart = useEffectEvent(() => !!voice && !listenMode && trackRef.current.on && speak(0, true, false));

  useEffect(() => {
    if (still || !inView || started.current) return;
    started.current = true;
    if (speakFromStart()) return;
    pacing.current = "script";
    timers.current = SCRIPT.map(([at, patch]) =>
      window.setTimeout(() => setBeat((b) => ({ ...b, ...patch })), at),
    );
  }, [inView, still]);

  /** A heard draft's verdict has been read: the next draft, heard if it can be, else read-paced from there. */
  const nextDraft = useEffectEvent((k: number) => {
    if (speak(k, true, pressed.current)) return;
    stopSpeaking();
    readFrom(k);
  });
  const finishSpeaking = useEffectEvent(() => stopSpeaking());

  // The heard run, frame by frame on the call's clock: turns, the pen, the
  // verdict and the tick; then the verdict's reading time, then the next draft.
  useEffect(() => {
    if (!speaking || !voice || !inView || listen === "paused") return;
    const aside = asideRef.current;
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      const r = run.current;
      const dv = voice[r.draft];
      if (!dv) return finishSpeaking();
      if (r.dwell < 0) {
        const t = trackRef.current.time();
        const { saying: k, ...b } = spokenBeat(dv, r.draft, t);
        setBeat((prev) => (sameBeat(prev, b) ? prev : b));
        setSaying(k);
        if (aside && !still) aside.style.setProperty("--caa-level", String(levelOf(envelopeAt(dv.cue, t))));
        if (b.verdict) {
          if (!r.chain || r.draft >= drafts.length - 1) return finishSpeaking();
          r.dwell = VERDICT_READ_MS;
        }
      } else {
        r.dwell -= dt;
        if (r.dwell <= 0) return nextDraft(r.draft + 1);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      aside?.style.removeProperty("--caa-level");
    };
  }, [speaking, voice, inView, listen, still, drafts.length]);

  /** Back on screen, but the run may not take the sound back (another stage's press took it, and nothing plays by itself here): the draft reads complete. */
  const readOn = useEffectEvent(() => {
    const k = run.current.draft;
    stopSpeaking();
    setBeat(done(k, drafts[k].turns.length));
  });
  // Off screen the call pauses (use-voice-track), and a Listen with it: its transport says Listen
  // again, and the visitor's press no longer holds the sound for the drafts after it. Back on screen it
  // carries on from where it stopped, as a run rather than a press: it claims the sound only if nobody
  // else is playing (else silently, on the same clock). Where nothing plays by itself (reduced motion,
  // the still tier), only a press carries it on: a Listen waits for one, and anything else reads complete.
  const listenAway = useEffectEvent(() => setListen((l) => (l === "playing" ? "paused" : l)));
  useEffect(() => {
    if (!speaking) return;
    if (!inView) {
      away.current = true;
      pressed.current = false;
      listenAway();
      return;
    }
    if (!away.current) return;
    away.current = false;
    const r = run.current;
    const dv = voice?.[r.draft];
    const t = trackRef.current;
    if (!dv || r.dwell >= 0 || t.time() >= dv.cue.dur) return;
    if (t.listen) {
      if (!listen) readOn();
    } else t.play(dv.cue);
  }, [speaking, inView, voice, listen]);

  const onSound = (on: boolean) => {
    // Off: the draft being heard finishes in silence on the same clock (use-voice-track); the next is read-paced.
    if (!on) return;
    if (voice === undefined) {
      pending.current = listenMode ? "listen" : "sound";
      return;
    }
    converse(voice, listenMode);
  };

  /** Listen (reduced motion): the draft on screen, heard, turning sound on (the press is the gesture); or pause it. */
  const toggleListen = () => {
    const t = trackRef.current;
    if (listen === "playing") {
      t.pause();
      setListen("paused");
      return;
    }
    if (listen === "paused" && speaking) {
      setListen("playing");
      const dv = voice?.[run.current.draft];
      if (dv && run.current.dwell < 0) {
        pressed.current = true;
        t.play(dv.cue, undefined, { press: true, unlock: true });
      }
      return;
    }
    if (voice === undefined) {
      // Not fetched yet: sound goes on in this press, and the draft plays when its track arrives.
      unlockFromGesture();
      pending.current = "listen";
      return;
    }
    if (speak(view.draft, false, true, voice, true)) setListen("playing");
  };

  function pick(i: number) {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    started.current = true;
    setTouched(true);
    markProved("redline");
    // Sound on: the picked draft's call, heard, its turns landing as they're said.
    if (speak(i, false, true)) {
      if (listenMode) setListen("playing");
      return;
    }
    // A heard draft still finishing in silence (sound was turned off) gives way.
    if (speaking) {
      track.pause();
      stopSpeaking();
    }
    setBeat(done(i, drafts[i].turns.length));
  }

  // Not a pick: no touched, no markProved. Only the clock stops. A heard
  // draft finishes with its voice, and the redraft ends there.
  function settle() {
    if (touched || still) return;
    if (speaking) {
      if (run.current.dwell >= 0) stopSpeaking();
      else run.current.chain = false;
      return;
    }
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    started.current = true;
    setBeat(done(view.draft, drafts[view.draft].turns.length));
  }

  // Roving tabindex: one Tab stop for the rail, arrows walk it and select
  // as they go, as a radio group does.
  const radios = useRef<(HTMLButtonElement | null)[]>([]);
  function onKey(e: KeyboardEvent<HTMLButtonElement>) {
    const n = drafts.length;
    const to =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? (view.draft + 1) % n
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? (view.draft - 1 + n) % n
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? n - 1
              : -1;
    if (to < 0) return;
    e.preventDefault();
    pick(to);
    radios.current[to]?.focus();
  }

  const d = drafts[view.draft];

  return (
    <section id="redline" ref={ref} className="scroll-mt-28">
      <Frame className="px-6 md:px-12">
        <Eyebrow>{data.eyebrow}</Eyebrow>
        <SectionTitle className="mt-4 max-w-[820px]">{data.title}</SectionTitle>
        <p className="mt-5 max-w-[560px] text-base leading-[25px] text-pp-ink/80">{data.body}</p>
        {/* Sound: off until pressed. Outside the card, so pressing it is
            never focus inside the card (which would settle the redraft). */}
        <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-3">
          {listenMode && (voice === undefined || voice[view.draft]) && (
            <ListenButton playing={listen === "playing"} labels={data.voice} onClick={toggleListen} />
          )}
          <SoundButton variant="pill" tone="light" onChange={onSound} />
        </div>
      </Frame>

      <Frame className="mt-8 px-2 md:px-4">
        {/* Focus inside the card settles the redraft where it stands, so
            the radio a keyboard reader is on never loses aria-checked (or
            its tab stop) under them, and nothing moves for longer than 5s
            without their say (WCAG 2.2.2). It finishes the draft on screen
            rather than jumping to the last one: a jump would move the check
            off the focused radio, the very thing this prevents. A mouse
            click focuses before it clicks, so pick() still wins. */}
        <div
          onFocus={settle}
          className="rounded-[24px] bg-white p-4 shadow-[0_0_0_1px_rgb(24_16_40/0.06)] md:p-7"
        >
          {/* The rail. A bar per draft, inked up to the one showing, so the
              rail reads as progress through the redraft, not as tabs. */}
          <div role="radiogroup" aria-label={data.railLabel} className="flex items-start gap-1.5">
            {drafts.map((x, i) => {
              const on = i === view.draft;
              return (
                <button
                  key={x.n}
                  ref={(el) => {
                    radios.current[i] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  // Named by its visible label ("Draft 2, As written"), not by
                  // an aria-label: a spoken name has to contain the words on
                  // the button (WCAG 2.5.3), and the radiogroup already says
                  // "2 of 3".
                  tabIndex={on ? 0 : -1}
                  onClick={() => pick(i)}
                  onKeyDown={onKey}
                  className={cn(
                    "group flex h-auto min-h-11 min-w-0 flex-1 flex-col items-stretch gap-2 pt-2 text-left",
                    FOCUS,
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "h-1 w-full rounded-full transition-colors duration-200",
                      i <= view.draft ? "bg-black" : "bg-pp-rule",
                    )}
                  />
                  {/* n and sub sit on one line when there is room and wrap
                      (sub under n) on a phone, where a third of the card is
                      about 76px. */}
                  <span
                    className={cn(
                      "flex flex-wrap gap-x-2 text-[11px] leading-4 tracking-[0.1em] uppercase transition-colors duration-200",
                      on ? "text-pp-ink" : "text-pp-muted group-hover:text-pp-ink",
                    )}
                  >
                    <span className="font-medium">{x.n}</span>
                    <span className="sr-only">, </span>
                    <span>{x.sub}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {/* Heard after a pick only: the autoplay walks three drafts in
              under seven seconds and must not talk over the page. The region
              is live from the first paint and empty until the first pick,
              because screen readers announce only changes to a region that
              was already live; flipping aria-live on in the same commit as
              the first text would leave that first pick unspoken. */}
          <p className="sr-only" aria-live="polite">
            {touched ? `${d.n}: ${STATUS_LABEL[d.status]}` : ""}
          </p>

          {/* The aside is 380px, not narrower, at lg: its turns wrap less, so
              the grey card is about as tall as the rule column and the card
              has no empty block at its lower left once Draft 3 lands. */}
          <div className="mt-6 grid gap-7 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-10">
            {/* At lg the column is a flex column the height of the aside, and
                the provenance note sits at its foot, level with the verdict
                (lg:pb-5 matches the aside's p-5). Even with the larger rule
                and the wider aside, the call runs a few lines past Draft 3,
                and a note stranded under the rule would leave that space as
                a hole at the card's lower left; at the foot it reads as the
                card's own footing beside "Held". */}
            <div className="min-w-0 lg:flex lg:flex-col lg:pb-5">
              <p className={LABEL}>{data.labels.rule}</p>

              {/* The draft body. The live copy carries the live pen; the
                  sizers are every draft finished, which is the text each
                  ends on — the pen changes paint, never a line break.
                  The rule is the section's subject, so at lg it is set larger
                  to hold its own beside the denser aside; the sizers take the
                  same size, so the reserve still fits the tallest draft. */}
              <div className="mt-3 grid content-start text-[19px] leading-[30px] text-pp-ink lg:text-[23px] lg:leading-[36px]">
                <p key={view.draft} className="ind-swap [grid-area:1/1]">
                  <Segs segs={d.segs} struck={view.struck} inked={view.inked} />
                </p>
                {drafts.map((x, i) => (
                  <p key={i} aria-hidden inert className="invisible [grid-area:1/1]">
                    <Segs segs={x.segs} struck inked />
                  </p>
                ))}
              </div>

              <Stack
                items={drafts}
                live={view.draft}
                className="mt-3 lg:mt-auto lg:pt-6"
                render={(x) => <p className="text-[13px] leading-5 text-pp-muted">{x.from}</p>}
              />
            </div>

            <aside ref={asideRef} className="flex min-h-[260px] min-w-0 flex-col rounded-2xl bg-pp-card p-5">
              <p className={cn(LABEL, "border-b border-pp-hair pb-3")}>{data.labels.test}</p>

              {/* The call. Turns land one by one, keyed on the draft so each
                  new draft's call is heard afresh; unreached turns are laid
                  out invisibly, and every draft's full call is reserved
                  under it (Drafts 2 and 3, four turns, set the height). */}
              <div className="mt-4 grid flex-1 content-start">
                <div className="[grid-area:1/1]">
                  <Turns
                    turns={d.turns}
                    labels={SPEAKERS}
                    size="sm"
                    reached={view.reached}
                    landKey={`d${view.draft}`}
                    saying={speaking && saying >= 0 ? saying : undefined}
                  />
                </div>
                {drafts.map((x, i) => (
                  <div key={i} aria-hidden inert className="invisible [grid-area:1/1]">
                    <Turns turns={x.turns} labels={SPEAKERS} size="sm" />
                  </div>
                ))}
              </div>

              {/* The verdict: the reason for the next draft. Reserved from the
                  first frame, invisible until the call has been heard. */}
              <div className="mt-4 grid content-start border-t border-pp-hair pt-3">
                <div
                  key={view.verdict ? `v${view.draft}` : "wait"}
                  className={cn("[grid-area:1/1]", view.verdict ? "ind-land" : "invisible")}
                >
                  <Verdict label={data.labels.verdict} text={d.verdict} status={d.status} />
                </div>
                {drafts.map((x, i) => (
                  <div key={i} aria-hidden inert className="invisible [grid-area:1/1]">
                    <Verdict label={data.labels.verdict} text={x.verdict} status={x.status} />
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </Frame>

      <Frame className="mt-5 px-6 md:px-12">
        <p className="max-w-[620px] text-[13px] leading-5 text-pp-muted">{data.foot}</p>
      </Frame>
    </section>
  );
}

/**
 * What the test call showed. The status word sits beside its dot, so the
 * colour is never the only thing saying whether the rule held.
 */
function Verdict({ label, text, status }: { label: string; text: string; status: Status }) {
  return (
    <div className="flex items-start gap-2">
      {/* 16px status line beside a 20px text line: 2px down centres them. */}
      <StatusDot status={status} label={STATUS_LABEL[status]} className="mt-0.5 shrink-0" />
      <p className="min-w-0 text-[13px] leading-5 text-pp-ink">
        <span className="sr-only">{label}: </span>
        {text}
      </p>
    </div>
  );
}
