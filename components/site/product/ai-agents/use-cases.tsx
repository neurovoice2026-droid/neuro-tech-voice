"use client";

import { useEffect, useEffectEvent, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Pause, Play } from "lucide-react";
import { USE_CASES, spokenLines, type UseCaseAgent } from "@/lib/pages/ai-agents";
import { cueIn, loadCueFile, type Cue, type CueFile } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { envelopeAt } from "@/components/site/audio/cue";
import { isSoundOn, unlockFromGesture } from "@/components/site/audio/engine";
import { SoundButton } from "@/components/site/audio/sound-button";
import { useSounding, useVoiceTrack } from "@/components/site/audio/use-voice-track";
import { FluidOrb } from "../fluid-orb";
import { Frame, Orb, ORB_MESHES, PillLink, SectionHeading } from "../primitives";
import { useInView, usePrefersReducedMotion } from "../timing";

/* ------------------------------------------------------------------ *
 * Functions, not industries: the same agent working a front desk, a
 * diary, a sales line and a support queue.
 *
 * The stage is a console: on the left the agent itself — its function, a
 * live sphere and the agents under that function; on the right the call
 * as a running transcript, one line after another with who said it and
 * when, over a transport bar with play, sound, progress and a meter.
 *
 * One clock drives it. With sound off it is our own, pacing the words by
 * their count, and the sphere and the meter move with whoever is talking.
 * With sound on it is the clock of the generated audio of this sample
 * conversation (AI-generated voices, lib/audio/cues/
 * agents-use-cases-console.json, fetched only once sound is on and played
 * through the site's one sound, components/site/audio): every word shows
 * as it is said, the sphere and the meter follow the voice's loudness,
 * and the conversation ends when the voice does. Turning sound on here
 * mid-conversation picks the voice up at the word on screen; turning it
 * off lets the conversation finish on the same clock in silence, and the
 * next one is read-paced. With reduced motion nothing plays by itself:
 * the transport is "Listen".
 * ------------------------------------------------------------------ */

const TAB_MESHES = [ORB_MESHES.lagoon, ORB_MESHES.citrus, ORB_MESHES.sunset, ORB_MESHES.violet];

/** Agents whose orb carries its own palette instead of its tab's. */
const AGENT_MESHES: Partial<Record<string, readonly string[]>> = {
  quotes: ORB_MESHES.citrus,
  demo: ORB_MESHES.violet,
};

/** Pacing when a conversation is read rather than heard. */
const WORD_S = 0.3;
const TURN_GAP = 0.8;
const LEAD_IN = 0.7;
const HOLD_END = 2.4;
/** How many past lines each side keeps before they scroll away. */
const KEEP = 4;

/** The stage's claim on the site's one sound (components/site/audio/engine.ts). */
const VOICE_ID = "agents-use-cases";

const trackOf = (tab: string, agent: string) => `agents-use-cases-console/${tab}/${agent}`;

type Planned = {
  sp: "agent" | "client";
  words: string[];
  start: number;
  end: number;
  /** Heard: when each word is said, on the audio's clock. */
  wordAt?: number[];
};

type Conversation = {
  turns: Planned[];
  /** When the voice is done: the transport's length. */
  speech: number;
  /** When the conversation moves on, after the hold. */
  length: number;
  /** Heard: the audio it follows. */
  cue?: Cue;
};

/** The conversation read: each turn paced by its word count. */
export function plan(agent: UseCaseAgent): Conversation {
  let t = LEAD_IN;
  const turns: Planned[] = agent.turns.map((turn) => {
    const words = turn.t.split(" ");
    const start = t;
    const end = start + words.length * WORD_S;
    t = end + TURN_GAP;
    return { sp: turn.sp, words, start, end };
  });
  const speech = turns[turns.length - 1].end;
  return { turns, speech, length: speech + HOLD_END };
}

/**
 * The conversation heard: each turn where its clip is, each word when it
 * is said, the voice's end as the transport's, and the same hold after
 * the last word as when it is read. Null unless the cue speaks every line.
 */
export function planSpoken(agent: UseCaseAgent, cue: Cue): Conversation | null {
  const lines = spokenLines(cue, agent.turns);
  if (!lines) return null;
  const turns: Planned[] = agent.turns.map((turn, i) => ({
    sp: turn.sp,
    words: turn.t.split(" "),
    start: lines[i].start,
    end: lines[i].end,
    wordAt: lines[i].words.map((w) => lines[i].start + w),
  }));
  const last = turns[turns.length - 1];
  return { turns, speech: cue.dur, length: Math.max(cue.dur + 0.8, last.end + HOLD_END), cue };
}

/** How many words of each turn show at time t. */
export function revealAt(turns: Planned[], t: number) {
  return turns.map((p) => {
    if (t < p.start) return 0;
    if (p.wordAt) {
      let n = 0;
      while (n < p.wordAt.length && p.wordAt[n] <= t) n++;
      return n;
    }
    const per = Math.max(0.05, (p.end - p.start) / p.words.length);
    return Math.min(p.words.length, Math.floor((t - p.start) / per) + 1);
  });
}

/**
 * Where the voice picks up a conversation that was being read at `t`:
 * at the next word to show, so the words on screen stay and the voice
 * carries on from them; in the gap after a line that is already whole.
 */
export function heardFrom(read: Conversation, heard: Conversation, t: number) {
  const shown = revealAt(read.turns, t);
  let i = -1;
  shown.forEach((n, k) => {
    if (n > 0) i = k;
  });
  if (i < 0) return 0;
  const p = heard.turns[i];
  const at = p.wordAt ?? [];
  const n = shown[i];
  if (n < at.length) return Math.max(p.start, n > 0 ? at[n - 1] : 0, at[n] - 0.05);
  return p.end;
}

/** Voice to sphere and meter: the envelope's speech range (about 0.35 to 0.8) onto 0 to 1. */
const level = (env: number) => Math.min(1, Math.max(0, (env - 0.35) / 0.45));

function clockText(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export function AgentsUseCases() {
  const tabs = USE_CASES.tabs;
  const stageRef = useRef<HTMLDivElement>(null);
  const inView = useInView(stageRef, "-15% 0px");
  const reduce = usePrefersReducedMotion();

  const [tab, setTab] = useState(0);
  const [agent, setAgent] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const [paused, setPaused] = useState(false);

  const track = useVoiceTrack(VOICE_ID, { active: inView });
  const sounding = useSounding();
  /** The console's cue file: fetched once sound is on, never before. */
  const [cues, setCues] = useState<CueFile | null>(null);
  /** The conversation (by key) that is heard: it runs on its audio's clock. */
  const [heardKey, setHeardKey] = useState<string | null>(null);
  /** Reduced motion: the Listen transport, and the last line said so far. */
  const [listen, setListen] = useState<{ state: "playing" | "paused"; upTo: number } | null>(null);

  const t = tabs[tab];
  const a: UseCaseAgent = t.agents[agent];
  const mesh = TAB_MESHES[tab % TAB_MESHES.length];
  const stageMesh = AGENT_MESHES[a.id] ?? mesh;
  const cue = cues ? cueIn(cues, trackOf(t.id, a.id)) : undefined;
  const read = useMemo(() => plan(a), [a]);
  const heard = useMemo(() => (cue ? planSpoken(a, cue) : null), [a, cue]);
  // Words shown per turn, tagged with the conversation they belong to so a
  // switch never paints one frame of the old progress over the new lines.
  const convKey = `${t.id}-${a.id}`;
  const conversation = heardKey === convKey && heard ? heard : read;
  const running = inView && !reduce && !paused;
  /** Reduced motion: the transport is Listen, unless the cue file has arrived without this conversation in it. */
  const listenMode = reduce && !(cues && !heard);

  const [reveal, setReveal] = useState<{ key: string; counts: number[] }>({ key: "", counts: [] });
  const shown = reduce
    ? conversation.turns.map((p, i) => (!listen || i <= listen.upTo ? p.words.length : 0))
    : reveal.key === convKey
      ? reveal.counts
      : conversation.turns.map(() => 0);

  // Shared with the render loop and the sphere without re-rendering.
  const clock = useRef(0);
  const volume = useRef(0);
  const autoplayRef = useRef(autoplay);
  // The transport bar is written straight to the DOM every frame.
  const progressRef = useRef<HTMLSpanElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const meterRef = useRef<HTMLSpanElement>(null);
  const noteId = useId();

  /** Heard: where the next play starts (undefined carries on from where it stopped), and whether it was a press. */
  const startAt = useRef<number | undefined>(0);
  const pressRef = useRef(false);
  const trackRef = useRef(track);
  const cuesRef = useRef(cues);
  const now = useRef({ tab, agent, convKey, read, heard, heardKey, listen });
  useEffect(() => {
    autoplayRef.current = autoplay;
  }, [autoplay]);
  useEffect(() => {
    trackRef.current = track;
    cuesRef.current = cues;
    now.current = { tab, agent, convKey, read, heard, heardKey, listen };
  });

  // The cue file, once the visitor has turned sound on (here or anywhere on the page).
  const soundOn = track.on;
  useEffect(() => {
    if (!soundOn || cues) return;
    let live = true;
    void loadCueFile("agents-use-cases-console").then((f) => {
      if (live && f) setCues(f);
    });
    return () => {
      live = false;
    };
  }, [soundOn, cues]);

  /** The conversation `ti`/`ai` is heard if sound is on and its audio speaks it (a press also under the still tier). */
  const heardKeyFor = (ti: number, ai: number, press: boolean, file = cuesRef.current) => {
    const tb = tabs[ti];
    const ag = tb.agents[ai];
    if (reduce || !file || !isSoundOn() || (!press && trackRef.current.listen)) return null;
    return spokenLines(cueIn(file, trackOf(tb.id, ag.id)), ag.turns) ? `${tb.id}-${ag.id}` : null;
  };

  /** Moves to a conversation, from its top: heard or read, as heardKeyFor says. */
  const goTo = (ti: number, ai: number, press: boolean) => {
    startAt.current = 0;
    pressRef.current = press;
    setHeardKey(heardKeyFor(ti, ai, press));
    setTab(ti);
    setAgent(ai);
  };

  // The end of a conversation: on to the next one, unless one was picked, which plays again.
  const nextConversation = useEffectEvent(() => {
    const n = now.current;
    if (n.agent + 1 < tabs[n.tab].agents.length) goTo(n.tab, n.agent + 1, false);
    else goTo((n.tab + 1) % tabs.length, 0, false);
  });
  const playAgain = useEffectEvent((heardCue: Cue) => {
    // Sound went off during it: it is read from now on.
    if (!isSoundOn()) setHeardKey(null);
    else trackRef.current.play(heardCue, 0);
  });

  // The clock: the audio's when the conversation is heard, otherwise our
  // own. A new conversation starts it from the top.
  useEffect(() => {
    const heardCue = conversation.cue;
    let raf = 0;
    let prev = performance.now();
    let lastKey = "";
    /** Seconds since the voice ended, for the hold before moving on. */
    let afterEnd = 0;

    const advance = () => {
      if (!autoplayRef.current) {
        // Picked by hand: stay on it and play it again.
        clock.current = 0;
        afterEnd = 0;
        if (heardCue) playAgain(heardCue);
        return false;
      }
      nextConversation();
      return true;
    };

    const tick = (now: number) => {
      const dt = Math.min((now - prev) / 1000, 0.1);
      prev = now;

      let time: number;
      if (heardCue) {
        // The voice's clock; past its end, the hold runs on ours.
        const v = trackRef.current.time();
        if (v >= heardCue.dur) afterEnd += dt;
        else afterEnd = 0;
        time = v + afterEnd;
        clock.current = time;
      } else {
        clock.current += dt;
        time = clock.current;
      }

      const next = revealAt(conversation.turns, time);
      const key = next.join(",");
      if (key !== lastKey) {
        lastKey = key;
        setReveal({ key: convKey, counts: next });
      }

      // What moves the sphere: the voice's loudness when the conversation
      // is heard, the shape of the conversation when it is read.
      if (heardCue) {
        volume.current = level(envelopeAt(heardCue, time));
      } else {
        const speaking = conversation.turns.find((p) => time >= p.start && time <= p.end);
        volume.current = !speaking
          ? 0
          : speaking.sp === "agent"
            ? 0.5 + 0.32 * Math.sin(time * 8.3) * Math.sin(time * 2.9)
            : 0.16 + 0.08 * Math.sin(time * 6.1);
      }

      const length = conversation.length;
      const spoken = conversation.speech;
      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${Math.min(1, time / spoken)})`;
      }
      if (timeRef.current) {
        timeRef.current.textContent = `${clockText(Math.min(time, spoken))} / ${clockText(spoken)}`;
      }
      const bars = meterRef.current?.children;
      if (bars) {
        for (let i = 0; i < bars.length; i++) {
          const wobble = 0.55 + 0.45 * Math.sin(time * (7 + i * 1.7) + i * 2.1);
          const h = 0.18 + 0.82 * volume.current * wobble;
          (bars[i] as HTMLElement).style.transform = `scaleY(${h.toFixed(3)})`;
        }
      }
      if (time >= length && advance()) return;
      raf = requestAnimationFrame(tick);
    };

    if (!running) {
      volume.current = 0;
      return;
    }
    if (heardCue) {
      // Starts it, or carries on from where it stopped (off screen, paused by hand).
      const n = now.current;
      const nextTab = tabs[n.agent + 1 < tabs[n.tab].agents.length ? n.tab : (n.tab + 1) % tabs.length];
      const nextAgent = nextTab.agents[n.agent + 1 < tabs[n.tab].agents.length ? n.agent + 1 : 0];
      const after = cuesRef.current ? cueIn(cuesRef.current, trackOf(nextTab.id, nextAgent.id)) : undefined;
      trackRef.current.play(heardCue, startAt.current, { press: pressRef.current, next: after });
      startAt.current = undefined;
      pressRef.current = false;
    }
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (heardCue) trackRef.current.pause();
    };
  }, [running, conversation, convKey, agent, t.agents.length, tab, tabs.length, tabs]);

  // Reset on a new conversation, apart from the running loop above so that
  // scrolling away and back does not rewind it.
  const lastConversation = useRef(conversation);
  useEffect(() => {
    if (lastConversation.current === conversation) return;
    lastConversation.current = conversation;
    clock.current = 0;
  }, [conversation]);

  /**
   * Sound turned on here: the conversation on screen is heard from the
   * word it has reached (one already heard carries on from its second).
   */
  const hearNow = (file: CueFile) => {
    const n = now.current;
    const tb = tabs[n.tab];
    const ag = tb.agents[n.agent];
    const c = cueIn(file, trackOf(tb.id, ag.id));
    const h = c ? planSpoken(ag, c) : null;
    if (!c || !h) return;
    if (n.heardKey === n.convKey) {
      trackRef.current.play(c, trackRef.current.time(), { press: true });
      return;
    }
    startAt.current = heardFrom(n.read, h, clock.current);
    pressRef.current = true;
    setHeardKey(n.convKey);
  };

  /** Listen (reduced motion): plays the conversation on screen, or pauses it. */
  const toggleListen = (file: CueFile) => {
    const n = now.current;
    const tb = tabs[n.tab];
    const ag = tb.agents[n.agent];
    const c = cueIn(file, trackOf(tb.id, ag.id));
    if (!c || !planSpoken(ag, c)) return;
    if (n.listen?.state === "playing") {
      trackRef.current.pause();
      setListen({ ...n.listen, state: "paused" });
      return;
    }
    setHeardKey(n.convKey);
    trackRef.current.play(c, n.listen ? undefined : 0, { press: true });
    setListen({ state: "playing", upTo: n.listen?.upTo ?? -1 });
  };

  /** Runs `then` with the cue file, fetching it first if it has not arrived. */
  const withCues = (then: (file: CueFile) => void) => {
    if (cues) return then(cues);
    void loadCueFile("agents-use-cases-console").then((f) => {
      if (!f) return;
      setCues(f);
      then(f);
    });
  };

  // Listen: lines swap in whole as they are said; at the end the transcript reads complete again.
  const listening = listen?.state === "playing";
  // Off screen, the hook pauses the voice: the transport says Listen again, and a press carries on.
  useEffect(() => {
    if (!inView) setListen((l) => (l?.state === "playing" ? { ...l, state: "paused" } : l));
  }, [inView]);
  useEffect(() => {
    const heardCue = conversation.cue;
    if (!listening || !heardCue) return;
    let raf = 0;
    const frame = () => {
      const time = trackRef.current.time();
      const over = time >= heardCue.dur;
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${over ? 0 : Math.min(1, time / heardCue.dur)})`;
      if (timeRef.current) {
        timeRef.current.textContent = `${clockText(over ? 0 : time)} / ${clockText(heardCue.dur)}`;
      }
      if (over) {
        setListen(null);
        return;
      }
      let upTo = -1;
      conversation.turns.forEach((p, i) => {
        if (p.start <= time) upTo = i;
      });
      setListen((l) => (l && l.upTo !== upTo ? { ...l, upTo } : l));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [listening, conversation]);

  /** Ends a Listen early (another conversation was picked). */
  const stopListen = () => {
    if (!listen) return;
    trackRef.current.pause();
    setListen(null);
  };

  const pickTab = (i: number) => {
    setAutoplay(false);
    stopListen();
    goTo(i, 0, true);
  };
  const pickAgent = (i: number) => {
    setAutoplay(false);
    stopListen();
    goTo(tab, i, true);
  };

  const transport = () => {
    if (listenMode) {
      // Listen turns sound on: the press unlocks it, before the cue file is fetched.
      unlockFromGesture();
      withCues(toggleListen);
      return;
    }
    setAutoplay(false);
    // Resuming a heard conversation is a press: it takes the sound back.
    if (paused) pressRef.current = true;
    setPaused((p) => !p);
  };

  const onSound = (on: boolean) => {
    if (!on) return;
    if (listenMode) {
      // A Listen under way since sound went off carries on heard, from where its clock is.
      const heardCue = conversation.cue;
      if (listening && heardCue) trackRef.current.play(heardCue, undefined, { press: true });
      else withCues(toggleListen);
      return;
    }
    setPaused(false);
    withCues(hearNow);
  };

  const lines: Line[] = conversation.turns.map((p, i) => ({
    key: `${t.id}-${a.id}-${i}`,
    sp: p.sp,
    at: clockText(p.start),
    text: p.words.slice(0, shown[i] ?? 0).join(" "),
  }));
  const said = lines.filter((l) => l.text);
  const last = said[said.length - 1];
  const player = USE_CASES.player;
  /** A voice is sounding (this conversation's or another stage's): the live region does not read each line over it. */
  const quiet = track.audible || sounding;
  // The live region reads each line once, as it arrives, unless a voice is sounding then. It is never
  // filled again afterwards: a voice stopping must not re-read a line that came up while it spoke, or
  // one read long before.
  const lastKey = last ? last.key : "";
  const [announced, setAnnounced] = useState({ key: "", text: "" });
  if (announced.key !== lastKey) {
    setAnnounced({
      key: lastKey,
      text: last && !quiet ? `${last.sp === "agent" ? player.agent : player.client}: ${a.turns[lines.indexOf(last)].t}` : "",
    });
  } else if (quiet && announced.text) {
    setAnnounced({ key: lastKey, text: "" });
  }

  return (
    <>
      <Frame className="px-6 pb-8 md:px-12">
        <SectionHeading eyebrow={USE_CASES.eyebrow} className="max-w-[600px]">
          {USE_CASES.title}
        </SectionHeading>
        <div
          role="tablist"
          aria-label={USE_CASES.title}
          className="mt-8 flex w-fit max-w-full gap-1 overflow-x-auto rounded-full p-1 shadow-[0_0_0_1px_rgb(0_0_0/0.06)] [scrollbar-width:none]"
        >
          {tabs.map((x, i) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              id={`uc-tab-${x.id}`}
              aria-selected={i === tab}
              aria-controls="uc-stage"
              onClick={() => pickTab(i)}
              className={cn(
                "h-8 shrink-0 rounded-full px-3.5 text-sm transition-colors duration-200",
                i === tab ? "pp-shadow-btn bg-white text-pp-ink" : "text-pp-muted hover:text-pp-ink",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
      </Frame>

      <Frame className="px-4 pb-4">
        <div
          ref={stageRef}
          id="uc-stage"
          role="tabpanel"
          aria-labelledby={`uc-tab-${t.id}`}
          className="grid grid-cols-[minmax(0,1fr)] overflow-hidden rounded-[24px] bg-pp-card lg:h-[600px] lg:grid-cols-[340px_minmax(0,1fr)]"
        >
          {/* The agent: its function, the sphere, and the agents under it. */}
          <div className="flex flex-col p-5 md:p-6 lg:border-r lg:border-pp-rule">
            <div>
              <p className="text-[15px] leading-[22px]">{t.label}</p>
              <p className="text-[13px] leading-[18px] text-pp-muted">{t.summary}</p>
            </div>

            <div className="my-8 flex justify-center lg:my-auto">
              <FluidOrb
                colors={stageMesh}
                volume={volume}
                running={running}
                still={reduce}
                className="size-[180px] md:size-[212px]"
              />
            </div>

            <div className="flex flex-col gap-1">
              {t.agents.map((x, i) => {
                const on = i === agent;
                return (
                  <button
                    key={x.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => pickAgent(i)}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors duration-200",
                      on ? "bg-white shadow-[0_0_0_1px_rgb(24_16_40/0.06)]" : "hover:bg-white/50",
                    )}
                  >
                    <Orb
                      mesh={AGENT_MESHES[x.id] ?? mesh}
                      className={cn("size-7 shrink-0 transition-opacity", on ? "opacity-100" : "opacity-45")}
                    />
                    <span className="min-w-0">
                      <span className={cn("block text-[14px] leading-5", on ? "text-pp-ink" : "text-pp-muted")}>
                        {x.name}
                      </span>
                      <span className="block truncate text-[12px] leading-4 text-pp-muted">{x.job}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* The call: a running transcript over the transport. */}
          <div className="flex min-h-[460px] flex-col bg-white/55 lg:min-h-0">
            <div className="flex items-center justify-between gap-4 border-b border-pp-rule px-5 py-4 md:px-6">
              <div className="min-w-0">
                <p className="text-[11px] leading-4 font-medium tracking-[0.14em] text-pp-muted uppercase">
                  {player.transcript}
                </p>
                <p className="truncate text-[15px] leading-[22px]">
                  {a.name} <span className="text-pp-muted">· {a.job}</span>
                </p>
              </div>
              <PillLink href={USE_CASES.cta.href} variant="secondary" size="sm">
                {USE_CASES.cta.label}
              </PillLink>
            </div>

            <Transcript
              lines={said}
              labels={player}
              className="flex-1"
              // Listen: whole lines, no motion, and a still mark on the one being said.
              instant={!!listen}
              current={listen && listen.upTo >= 0 ? lines[listen.upTo]?.key : undefined}
            />

            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 border-t border-pp-rule px-4 py-3 md:gap-x-3 md:px-6">
              <button
                type="button"
                onClick={transport}
                aria-label={
                  listenMode ? (listening ? player.pause : player.listen) : paused ? player.play : player.pause
                }
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-full bg-pp-ink text-white transition-transform duration-200 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink",
                  // Listen: a 44px tap around the 36px disc.
                  listenMode && "relative before:absolute before:-inset-1 before:rounded-full",
                )}
              >
                {(listenMode ? !listening : paused) ? (
                  <Play className="size-4 fill-current" />
                ) : (
                  <Pause className="size-4 fill-current" />
                )}
              </button>

              <SoundButton variant="pill" tone="light" caption="none" describedBy={noteId} onChange={onSound} />

              <span aria-hidden className="relative h-[3px] min-w-0 flex-1 overflow-hidden rounded-full bg-pp-ink/10">
                <span
                  ref={progressRef}
                  className="absolute inset-0 origin-left rounded-full bg-pp-accent"
                  style={{ transform: "scaleX(0)" }}
                />
              </span>

              <span ref={timeRef} className="shrink-0 text-[12px] text-pp-muted tabular-nums">
                0:00 / {clockText(conversation.speech)}
              </span>

              <span ref={meterRef} aria-hidden className="hidden h-5 shrink-0 items-center gap-[3px] sm:flex">
                {Array.from({ length: 12 }, (_, i) => (
                  <span
                    key={i}
                    className="h-full w-[3px] origin-center rounded-full bg-pp-accent/70"
                    style={{ transform: "scaleY(0.18)" }}
                  />
                ))}
              </span>

              {/* The sound control's caption, on its own line under the transport. */}
              <span id={noteId} className="basis-full text-[12px] leading-4 text-pp-muted">
                {USE_CASES.sound.note}
              </span>
            </div>
          </div>

          <p className="sr-only" aria-live="polite">
            {announced.key === lastKey ? announced.text : ""}
          </p>
        </div>
      </Frame>
    </>
  );
}

type Line = { key: string; sp: "agent" | "client"; at: string; text: string };

/**
 * The call, top to bottom, newest at the foot. A new or growing line pushes
 * the rest up; Motion animates only their position, so text never scales,
 * and the top of the column fades lines out as they leave.
 */
function Transcript({
  lines,
  labels,
  className,
  instant = false,
  current,
}: {
  lines: Line[];
  labels: { agent: string; client: string };
  className?: string;
  /** Lines appear whole and in place, with no motion (Listen, reduced motion). */
  instant?: boolean;
  /** The line being said, marked (Listen). */
  current?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none relative min-h-[240px] overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,#000_32%)]",
        className,
      )}
    >
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-4 px-5 pb-5 md:px-6">
        <AnimatePresence initial={false}>
          {lines.slice(-KEEP * 2).map((l) => (
            <motion.div
              key={l.key}
              layout={instant ? false : "position"}
              initial={instant ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={instant ? undefined : { opacity: 0, transition: { duration: 0.25 } }}
              transition={{
                layout: { type: "spring", stiffness: 220, damping: 30, mass: 0.9 },
                opacity: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
                y: { duration: 0.55, ease: [0.16, 1, 0.3, 1] },
              }}
              className={cn(
                "grid grid-cols-[64px_minmax(0,1fr)] gap-3 md:grid-cols-[76px_minmax(0,1fr)]",
                l.key === current && "rounded-md outline-1 outline-offset-4 outline-pp-accent/40",
              )}
            >
              <span className="pt-[3px]">
                <span
                  className={cn(
                    "block text-[11px] leading-4 font-medium tracking-[0.1em] uppercase",
                    l.sp === "agent" ? "text-pp-accent" : "text-pp-muted",
                  )}
                >
                  {l.sp === "agent" ? labels.agent : labels.client}
                </span>
                <span className="block text-[11px] leading-4 text-pp-muted/80 tabular-nums">{l.at}</span>
              </span>
              <p className={cn("text-[15px] leading-[23px]", l.sp === "agent" ? "text-pp-ink" : "text-pp-ink/70")}>
                {l.text}
              </p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
