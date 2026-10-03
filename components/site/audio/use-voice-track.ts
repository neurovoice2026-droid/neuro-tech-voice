"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Cue } from "@/lib/audio/cue-types";
import { usePrefersReducedMotion } from "@/components/site/product/timing";
import * as engine from "./engine";

/* ------------------------------------------------------------------ *
 * A stage's voice: its claim on the site's one sound (engine.ts), and a
 * clock that never stops being the conversation's.
 *
 * While the stage owns the element, `time()` is the audio's clock. When
 * it loses it (a press elsewhere, sound turned off, a file that will not
 * play), the clock carries on silently from the same second, so a
 * timeline driven by it never jumps; it pauses with the tab and when the
 * stage leaves view. With sound off a stage never calls `play` and keeps
 * its read pacing.
 *
 * Autoplay rules: a stage's own run calls `play(cue)` and claims only
 * while it is `active` (on screen; on the landing, the focused stage),
 * only if nobody else is playing, and never under reduced motion or the
 * `still` tier. A press on the stage's own control calls
 * `play(cue, at, { press: true })`, which always wins. Under reduced
 * motion the transport becomes "Listen" (`listen`), a press that also
 * turns sound on: `play(cue, 0, { press: true, unlock: true })`.
 *
 * An autoplay claims only once its stage has stayed on screen for
 * DWELL_MS: until then its clock holds where the run starts. A page that
 * scrolls itself (a client navigation smooth-scrolling to the top, or
 * back to where it was) carries stages through the viewport for a moment
 * each, and none of them may start a voice in passing. A press made
 * outside the visitor's own gesture (a cue that was still loading when it
 * was pressed) counts as one only while its stage is still on screen.
 * ------------------------------------------------------------------ */

/** How long a stage stays on screen before its autoplay may take the sound. */
const DWELL_MS = 400;

/** The events a visitor's own press arrives in. */
const GESTURES = new Set(["click", "keydown", "keyup", "pointerdown", "pointerup", "mousedown", "mouseup", "touchend"]);

/** True inside the dispatch of the visitor's own press (a click or key handler), false in a timer or a promise. */
function inGesture() {
  if (typeof window === "undefined") return false;
  // window.event is the event being dispatched, and undefined outside one.
  const e = (window as Window & { event?: Event }).event;
  return !!e && e.isTrusted && GESTURES.has(e.type);
}

export type PlayOptions = {
  /** A press on this stage's own control: takes the sound from any other owner, and plays under reduced motion. */
  press?: boolean;
  /** Also turn sound on (the press is a gesture): the "Listen" transport. Call it inside the click. */
  unlock?: boolean;
  /** The file this stage plays next, fetched at low priority once this one passes its middle. */
  next?: Pick<Cue, "src"> | string;
};

export type VoiceTrack = {
  /** The visitor turned sound on: build the run on the spoken schedule. */
  on: boolean;
  /** Sound on, unlocked, and this stage owns the element: what it plays is heard. */
  audible: boolean;
  /** Reduced motion or the `still` tier: nothing autoplays; the transport says "Listen". */
  listen: boolean;
  /**
   * Starts `cue` at cue time `at` (without it: carries on from where a
   * paused run of the same cue stopped, else from 0). Audible when it can
   * claim the element; otherwise the same clock runs silently. True when
   * audible. A run refused outright (autoplay off-screen or under reduced
   * motion) leaves the clock as it was and returns false.
   */
  play: (cue: Cue, at?: number, o?: PlayOptions) => boolean;
  pause: () => void;
  /** Moves the clock (and the audio, while audible) to cue time `t`. */
  seek: (t: number) => void;
  /** The conversation's clock: cue seconds, 0 to the cue's dur. Read it every frame. */
  time: () => number;
  /** The run reached the cue's end (audible or not). Cleared by play and by a seek back. */
  ended: boolean;
  /** Another stage's press took the sound; this run carries on silently. Cleared by play. */
  preempted: boolean;
  /** An autoplay is waiting out DWELL_MS (its stage just came on screen): the clock holds, and it claims next. */
  waiting: () => boolean;
};

export type VoiceTrackOptions = {
  /** On screen (the stage's own in-view state; the focused stage on the landing). False pauses and releases. */
  active?: boolean;
  onEnded?: () => void;
  /** Another stage's press took the sound (`by` is its id). */
  onPreempt?: (by: string) => void;
};

const useIsoLayoutEffect = typeof document !== "undefined" ? useLayoutEffect : useEffect;

type TierModule = typeof import("@/components/site/product/device-tier");
/** device-tier, once fetched: imported only when sound goes on, so a page that has no other use for it never loads it. */
let tierModule: TierModule | null = null;
let tierLoad: Promise<TierModule> | null = null;
const loadTier = () =>
  (tierLoad ??= import("@/components/site/product/device-tier").then((m) => (tierModule = m)));
const off = () => false;

/** sound.on, for rendering: false on the server and while hydrating. */
export function useSoundOn() {
  return useSyncExternalStore(engine.subscribe, engine.isSoundOn, off);
}

/** True while some stage's voice is sounding. */
export function useSounding() {
  return useSyncExternalStore(engine.subscribe, engine.isSounding, off);
}

function subscribeVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

/**
 * False while the tab is hidden; true on the server. The engine pauses the
 * voice with the tab, and a stage that steps a spoken run on timers holds
 * them too, so the run never moves on without its voice.
 */
export function useTabVisible() {
  return useSyncExternalStore(
    subscribeVisibility,
    () => !document.hidden,
    () => true,
  );
}

type Clock = {
  mode: "idle" | "audio" | "silent";
  cue: Cue | null;
  /** Silent: the clock's reading at `since`; audio: its last reading. */
  at: number;
  since: number;
  running: boolean;
  /** Stopped by the tab going hidden: runs again when it is back. */
  held: boolean;
  ended: boolean;
  timer: number;
  /** An autoplay waiting out DWELL_MS before it claims the sound (the clock holds meanwhile). */
  dwell: number;
};

export function useVoiceTrack(id: string, { active = true, onEnded, onPreempt }: VoiceTrackOptions = {}): VoiceTrack {
  const on = useSoundOn();
  const audible = useSyncExternalStore(
    engine.subscribe,
    () => engine.isAudible(id),
    off,
  );
  const reducedMotion = usePrefersReducedMotion();
  // The tier is read only once sound is on: reading it boots device-tier
  // (a WebGL2 context, a frame probe, html[data-tier]), which a page with
  // no other use for it must not pay for while silent, in bytes either: the
  // module itself is fetched then. With sound off, `listen` is reduced
  // motion alone (the `still` tier is reduced motion, or a QA override).
  const [tier, setTier] = useState<TierModule | null>(tierModule);
  useEffect(() => {
    if (!on || tier) return;
    let live = true;
    void loadTier().then((m) => {
      if (live) setTier(m);
    });
    return () => {
      live = false;
    };
  }, [on, tier]);
  const subscribeTier = useCallback((cb: () => void) => (on && tier ? tier.onTierChange(cb) : () => {}), [on, tier]);
  const still = useSyncExternalStore(subscribeTier, () => !!tier && on && tier.getTier() === "still", off);
  const listen = reducedMotion || still;
  const [ended, setEnded] = useState(false);
  const [preempted, setPreempted] = useState(false);

  const clock = useRef<Clock>({
    mode: "idle",
    cue: null,
    at: 0,
    since: 0,
    running: false,
    held: false,
    ended: false,
    timer: 0,
    dwell: 0,
  });
  const live = useRef({ active, listen, onEnded, onPreempt, since: 0 });
  /**
   * False once the stage has unmounted. A cue that was still loading when
   * the visitor pressed, and a dwell timer, may call back after that (a
   * client navigation away): they must not claim the sound for a stage no
   * page shows.
   */
  const alive = useRef(true);
  useIsoLayoutEffect(() => {
    const L = live.current;
    // When the stage came (back) on screen: an autoplay waits DWELL_MS from then.
    const since = active ? (L.active && L.since ? L.since : performance.now()) : 0;
    live.current = { active, listen, onEnded, onPreempt, since };
  });

  const clamp = useCallback((t: number) => {
    const dur = clock.current.cue?.dur ?? Infinity;
    return Math.max(0, Math.min(dur, t));
  }, []);

  const silentNow = useCallback(() => {
    const c = clock.current;
    return c.running ? c.at + (performance.now() - c.since) / 1000 : c.at;
  }, []);

  const finish = useCallback(() => {
    const c = clock.current;
    clearTimeout(c.timer);
    clearTimeout(c.dwell);
    c.mode = "silent";
    c.at = c.cue?.dur ?? c.at;
    c.running = false;
    c.ended = true;
    setEnded(true);
    live.current.onEnded?.();
  }, []);

  /** Runs (or holds) the silent clock from `at`, and sets its end. */
  const goSilent = useCallback(
    (at: number, running: boolean) => {
      const c = clock.current;
      clearTimeout(c.timer);
      c.mode = "silent";
      c.at = clamp(at);
      c.since = performance.now();
      c.running = running && !document.hidden;
      c.held = running && document.hidden;
      if (c.running && c.cue) c.timer = window.setTimeout(finish, Math.max(0, (c.cue.dur - c.at) * 1000));
    },
    [clamp, finish],
  );

  const handlers = useMemo<engine.OwnerHandlers>(
    () => ({
      onEnded: () => {
        if (clock.current.mode === "audio") finish();
      },
      onPreempt: (at, by) => {
        const c = clock.current;
        if (c.mode !== "audio") return;
        goSilent(at, c.running);
        if (by !== null) {
          setPreempted(true);
          live.current.onPreempt?.(by);
        }
      },
    }),
    [finish, goSilent],
  );

  const time = useCallback(() => {
    const c = clock.current;
    if (c.mode === "audio") {
      const t = engine.clock(id);
      if (Number.isFinite(t)) return (c.at = clamp(t));
      // Lost without word (should not happen): carry on silently from the last reading.
      goSilent(c.at, c.running);
    }
    return c.mode === "silent" ? clamp(silentNow()) : 0;
  }, [id, clamp, goSilent, silentNow]);

  /** Takes the sound and plays `cue` from `from`, or runs the same clock silently when the sound can't be had. */
  const start = useCallback(
    (cue: Cue, from: number, carryOn: boolean, press: boolean, next: string | undefined) => {
      const c = clock.current;
      if (!alive.current) return false;
      if (
        engine.claim(id, handlers, { force: press }) &&
        engine.play(id, cue, carryOn && c.mode === "audio" ? undefined : from, { next })
      ) {
        c.mode = "audio";
        c.at = from;
        c.running = true;
        return true;
      }
      goSilent(from, true);
      return false;
    },
    [id, handlers, goSilent],
  );

  const play = useCallback(
    (cue: Cue, at?: number, o: PlayOptions = {}) => {
      const c = clock.current;
      const L = live.current;
      // Unmounted (a cue that finished loading after the visitor navigated away): nothing to play for.
      if (!alive.current) return false;
      // A press that arrives after its stage has left the screen (its cue was still loading) is no press.
      const press = !!o.press && (L.active || inGesture());
      if (!press && (L.listen || !L.active)) return false;
      if (o.unlock) engine.unlockFromGesture();
      const same = c.cue === cue && !c.ended && c.mode !== "idle";
      const from = clamp(at ?? (same ? time() : 0));
      const carryOn = same && at === undefined;
      clearTimeout(c.timer);
      clearTimeout(c.dwell);
      c.dwell = 0;
      c.cue = cue;
      c.ended = false;
      c.held = false;
      setEnded(false);
      setPreempted(false);
      const next = typeof o.next === "string" ? o.next : o.next?.src;
      // Not for a press, nor for a stage that holds the sound already (its run goes on to its next file).
      const wait =
        press || !engine.isSoundOn() || engine.currentOwner() === id ? 0 : L.since + DWELL_MS - performance.now();
      if (wait > 0) {
        // Just on screen: the clock holds at `from` until the stage has stayed, then the run claims as usual.
        if (c.mode === "audio") engine.pause(id);
        goSilent(from, false);
        c.dwell = window.setTimeout(() => {
          c.dwell = 0;
          if (alive.current && live.current.active && c.cue === cue && !c.ended) start(cue, c.at, false, false, next);
        }, wait);
        return true;
      }
      return start(cue, from, carryOn, press, next);
    },
    [id, clamp, time, goSilent, start],
  );

  const pause = useCallback(() => {
    const c = clock.current;
    clearTimeout(c.dwell);
    c.dwell = 0;
    if (c.mode === "audio") {
      engine.pause(id);
      c.at = time();
    } else if (c.mode === "silent") {
      c.at = clamp(silentNow());
      clearTimeout(c.timer);
    }
    c.running = false;
    c.held = false;
  }, [id, time, clamp, silentNow]);

  const seek = useCallback(
    (t: number) => {
      const c = clock.current;
      const to = clamp(t);
      if (c.ended && to < (c.cue?.dur ?? 0)) {
        c.ended = false;
        setEnded(false);
      }
      if (c.mode === "audio") {
        engine.seek(id, to);
        c.at = to;
      } else if (c.mode === "silent") {
        goSilent(to, c.running);
      }
    },
    [id, clamp, goSilent],
  );

  // Off-screen: pause and release. The stage plays again when it is back.
  useEffect(() => {
    if (active) return;
    const c = clock.current;
    clearTimeout(c.dwell);
    c.dwell = 0;
    if (c.mode === "audio") {
      c.at = time();
      engine.release(id);
      c.mode = "silent";
    } else if (c.mode === "silent") {
      c.at = clamp(silentNow());
    }
    clearTimeout(c.timer);
    c.running = false;
    c.held = false;
  }, [active, id, time, clamp, silentNow]);

  // The silent clock stops with the tab, as the audio does (engine.ts), and runs again when it is back.
  useEffect(() => {
    const onVisibility = () => {
      const c = clock.current;
      if (c.mode !== "silent") return;
      if (document.hidden && c.running) {
        const at = silentNow();
        goSilent(at, false);
        c.held = true;
      } else if (!document.hidden && c.held) {
        goSilent(c.at, true);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [goSilent, silentNow]);

  // Unmount (or a new id): give the sound back, and refuse any play that
  // arrives later (a cue still loading when the visitor navigated away).
  // Set again on setup, so a StrictMode re-mount plays as before.
  useEffect(() => {
    const c = clock.current;
    alive.current = true;
    return () => {
      alive.current = false;
      clearTimeout(c.timer);
      clearTimeout(c.dwell);
      c.dwell = 0;
      c.running = false;
      engine.release(id);
    };
  }, [id]);

  const waiting = useCallback(() => clock.current.dwell !== 0, []);

  return useMemo(
    () => ({ on, audible, listen, play, pause, seek, time, ended, preempted, waiting }),
    [on, audible, listen, play, pause, seek, time, ended, preempted, waiting],
  );
}
