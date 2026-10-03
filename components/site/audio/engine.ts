import type { Cue } from "@/lib/audio/cue-types";

/* ------------------------------------------------------------------ *
 * The site's one sound.
 *
 * A module-level singleton, with no provider: one lazily created
 * <audio> element (preload none, playsinline) plays every voice on the
 * site, so two can never sound at once. It does not go through Web
 * Audio: iOS keeps a media element audible with the ring switch on
 * silent, a gesture unlocks the element itself, and there is no CORS.
 *
 * Sound is off until the visitor presses a sound control. Before that
 * the element does not exist, and nothing is fetched: no audio, and no
 * cue (the stages load industry cues only once sound is on). The choice
 * is kept in this module, so it survives client-side navigation and is
 * forgotten on a full reload.
 *
 * Stages share the element by owner id:
 *
 *   claim(id)        take it; refused while another owner is playing,
 *                    unless `force` (an explicit press), which preempts
 *   play(id, track)  start (or carry on with) a file from a cue time
 *   pause/seek(id)   only ever act for the current owner
 *   release(id)      give it back (off-screen, unmount)
 *   clock(id)        the owner's cue time, smoothed
 *
 * The tab going hidden pauses it; coming back resumes it only if the
 * owner still wants it playing. Past the middle of a file, the owner's
 * next file is fetched at low priority, so it starts at once; at most one
 * file fetched ahead is ever waiting to be played (warm).
 *
 * React reads the store through useSyncExternalStore (use-voice-track.ts).
 * ------------------------------------------------------------------ */

/** What the element needs of a cue: a Cue fits. */
export type Track = Pick<Cue, "src" | "offset"> & { dur?: number };

export type OwnerHandlers = {
  /** The file played to its end. */
  onEnded?: () => void;
  /**
   * The element was taken from this owner: by `by` (an explicit press
   * elsewhere), or, with `by` null, because sound was turned off or the
   * file could not play. `at` is the cue time it had reached, so the
   * owner can carry on silently on the same schedule.
   */
  onPreempt?: (at: number, by: string | null) => void;
};

/** A tenth of a second of silence, inline: starting it inside the gesture unlocks the element without a request. */
const SILENT =
  "data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==";

/** The clock never runs ahead of the element's last reading by more than this (a stall it was not told of). */
const MAX_AHEAD_S = 0.5;
/** A reading this far behind the clock is a jump (a stall it was not told of): the clock follows it at once. */
const JUMP_S = 0.3;
/** A reading less far behind is most likely a late one: the clock eases this share of the way towards it. */
const EASE = 0.1;
/*
 * The stall watchdog. A request that hangs never errors, and every stage
 * waits on the clock, so a file that does not move is given up in the
 * end: the owner carries on silently, as on an error, and the next play
 * loads the file afresh. But a slow network is not a hung one. While the
 * file's bytes are arriving (its progress events), each arrival gives it
 * STALL_MS again, up to START_MAX_MS; its first byte may take
 * FIRST_BYTE_MS (a slow link's latency).
 */
/** Once bytes of the file are arriving, this long without another (or without it moving) is a stall. */
const STALL_MS = 2500;
/**
 * How long the first byte of a file may take to come: a slow link's
 * latency (a DevTools "Slow 3G" link, 2 s, brings a file's first bytes at
 * 2.5 s; 3 s at 3.6 s), short of a request that never answers.
 */
const FIRST_BYTE_MS = 4000;
/** However steadily its bytes come, a file that has not moved this long after it was asked for is given up. */
const START_MAX_MS = 15000;
/** How often the watchdog looks. */
const WATCH_MS = 250;

let on = false;
/** A gesture has started the element: from now on it may play. */
let unlocked = false;
let owner: string | null = null;
let handlers: OwnerHandlers = {};
/** The owner wants it playing: set by play, cleared by pause, release, end and loss. */
let wants = false;
/** Paused because the tab went hidden: resume when it is back, if the owner still wants it. */
let hiddenHold = false;
let el: HTMLAudioElement | null = null;
/** The file the element holds for an owner; null while it holds nothing, or the unlock clip. */
let loaded: Required<Track> | null = null;
/** A seek asked for before the file's metadata arrived (media seconds). */
let pendingSeek: number | null = null;
/** The owner's next file, fetched once the current one passes its middle. */
let next: string | null = null;
const warmed = new Set<string>();
/**
 * The file fetched ahead that has not played yet, and its fetch while it is
 * still arriving. There is at most one: a stage that leaves view before its
 * warmed file plays holds the one slot until that file plays, so a reader
 * scrolling through with sound on is never sent more than one file the page
 * does not play. An owner that lets go stops a fetch still under way.
 */
let warmSrc: string | null = null;
let warmFetch: AbortController | null = null;
/** The stall watchdog: runs while the owner wants the file playing. */
let watchdog = 0;
/** When the current wait began (the element was asked to play or seek, or last moved), and the reading it last moved at. */
let waitAt = 0;
let progressRaw = -1;
/** When bytes of a file last arrived. */
let dataAt = 0;
/**
 * When the last file given up had not had a byte (0: it had, or none was
 * given up): the network looks dead, not slow, so the next file's first
 * byte gets only STALL_MS, if it is asked for within DEAD_FOR_MS (and
 * until a byte of any file arrives). Only the next: a file given up under
 * that shorter wait gives the one after it FIRST_BYTE_MS again, or a link
 * that came back slow (its first bytes after STALL_MS) would never be
 * heard again.
 */
let deadAt = 0;
/** How long a dead network is taken to stay dead. */
const DEAD_FOR_MS = 10000;

/* The smoothed clock: media seconds = wall seconds × rate + skew, while the element runs. */
let skew = 0;
let skewSet = false;
let lastRaw = -1;
let lastOut = 0;

const listeners = new Set<() => void>();
let emitting = false;
function flush() {
  if (!emitting) return;
  emitting = false;
  listeners.forEach((l) => l());
}
/**
 * Tells the subscribers (React, through useSyncExternalStore) that the
 * store changed: once for any number of changes, after the next paint.
 * Every stage on a page subscribes, and a sound press changes the store
 * inside its click: re-rendering them all there would make the press one
 * long task. The engine's own state is current at once (isSoundOn() and
 * the rest read it), and a render for any other reason reads it fresh.
 */
function emit() {
  if (emitting) return;
  emitting = true;
  if (typeof requestAnimationFrame === "function" && !document.hidden) {
    requestAnimationFrame(() => setTimeout(flush, 0));
  }
  // A hidden tab runs no frames; this one also covers a tab hidden before the frame came.
  setTimeout(flush, 100);
}

/** Calls `onChange` whenever sound, the owner or the element's play state changes; returns the unsubscribe. */
export function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** sound.on: the visitor has turned sound on, in this visit. False on the server. */
export const isSoundOn = () => on;
/** The owner holding the element, or null. */
export const currentOwner = () => owner;
/** Sound is on, unlocked, and `id` owns the element: what it plays is heard. */
export const isAudible = (id: string) => on && unlocked && owner === id;
/** Something is sounding now (sound on, an owner, the element running). */
export const isSounding = () => on && owner !== null && !!el && !el.paused && loaded !== null;

function element(): HTMLAudioElement {
  if (el) return el;
  const a = new Audio();
  a.preload = "none";
  a.setAttribute("playsinline", "");
  a.addEventListener("ended", ended);
  a.addEventListener("timeupdate", warmNext);
  a.addEventListener("loadedmetadata", applyPendingSeek);
  // Bytes are arriving (however slowly): a slow file, not a hung one.
  const fed = () => {
    dataAt = performance.now();
    deadAt = 0;
  };
  a.addEventListener("progress", fed);
  a.addEventListener("loadedmetadata", fed);
  a.addEventListener("loadeddata", fed);
  a.addEventListener("play", emit);
  a.addEventListener("pause", emit);
  a.addEventListener("error", () => {
    if (!loaded) return;
    // The owner carries on silently; the next play loads the file afresh.
    lose(null);
    loaded = null;
  });
  document.addEventListener("visibilitychange", visibility);
  el = a;
  return a;
}

/**
 * Turns sound on. Call it synchronously inside the click (or key) handler
 * of a sound control: on iOS an element may play only once a gesture has
 * started it, so it starts here (a silent inline clip, unless a stage
 * plays its own file in the same handler, which unlocks it as well).
 * Sets the audio session to "playback" where there is one, so a phone's
 * silent switch does not mute the voices.
 */
export function unlockFromGesture() {
  if (typeof window === "undefined") return;
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  try {
    if (session) session.type = "playback";
  } catch {}
  const a = element();
  if (!unlocked) {
    unlocked = true;
    if (loaded && owner && wants) {
      a.play().catch(failed);
    } else {
      loaded = null;
      a.src = SILENT;
      a.play().catch(failed);
    }
  }
  if (!on) {
    on = true;
    emit();
  }
}

/** Turns sound off: the element pauses and its owner is told, so it can carry on silently. */
export function soundOff() {
  if (!on) return;
  on = false;
  if (owner) lose(null);
  emit();
}

/** Takes the element from its owner, pausing it, and tells the owner. */
function lose(by: string | null) {
  const was = owner;
  const h = handlers;
  const reached = was ? clock(was) : NaN;
  const at = Number.isFinite(reached) ? Math.max(0, reached) : 0;
  el?.pause();
  owner = null;
  handlers = {};
  wants = false;
  hiddenHold = false;
  next = null;
  warmFetch?.abort();
  emit();
  if (was) h.onPreempt?.(at, by);
}

/**
 * Takes the element for `id`. Refused while sound is off, and while
 * another owner is playing, unless `force` (an explicit press), which
 * preempts it. Claiming again refreshes the handlers.
 */
export function claim(id: string, h: OwnerHandlers = {}, { force = false }: { force?: boolean } = {}) {
  if (!on) return false;
  if (owner === id) {
    handlers = h;
    return true;
  }
  if (owner !== null) {
    if (wants && !force) return false;
    lose(id);
  }
  owner = id;
  handlers = h;
  wants = false;
  emit();
  return true;
}

/**
 * Plays `track` for its owner from cue time `at`. Without `at`, the file
 * it already holds carries on from where it is (and a new one starts at
 * its beginning). `next` is the file the stage will play after this one.
 * False when `id` does not own the element or sound is off.
 */
export function play(id: string, track: Track, at?: number, { next: after }: { next?: string } = {}) {
  if (!on || owner !== id) return false;
  const a = element();
  const fresh = loaded?.src !== track.src;
  loaded = { src: track.src, offset: track.offset, dur: track.dur ?? NaN };
  if (track.src === warmSrc) {
    // The file fetched ahead is playing: the slot is free again.
    warmSrc = null;
    warmFetch = null;
  }
  if (fresh) {
    pendingSeek = at !== undefined && at > 0 ? at + track.offset : null;
    a.src = track.src;
  } else if (at !== undefined) {
    seekMedia(Math.max(0, at + track.offset));
  }
  wants = true;
  hiddenHold = false;
  next = after ?? null;
  reanchor();
  watch();
  if (document.hidden) {
    // The tab is in the background: it starts when the reader is back.
    hiddenHold = true;
  } else {
    a.play().catch(failed);
  }
  emit();
  return true;
}

/** Pauses the owner's file where it is. */
export function pause(id: string) {
  if (owner !== id) return;
  wants = false;
  hiddenHold = false;
  el?.pause();
}

/** Moves the owner's file to cue time `at`, playing or paused. */
export function seek(id: string, at: number) {
  if (owner !== id || !loaded) return;
  seekMedia(Math.max(0, at + loaded.offset));
}

/** Gives the element back: it pauses, and the next claim needs no force. */
export function release(id: string) {
  if (owner !== id) return;
  el?.pause();
  owner = null;
  handlers = {};
  wants = false;
  hiddenHold = false;
  next = null;
  warmFetch?.abort();
  emit();
}

/**
 * Fetches a file into the HTTP cache at low priority, once, and only with
 * sound on; not while another file fetched ahead has yet to play (warmSrc).
 */
export function warm(src: string) {
  if (!on || warmed.has(src) || loaded?.src === src || warmSrc !== null) return;
  warmed.add(src);
  warmSrc = src;
  const ac = new AbortController();
  warmFetch = ac;
  const done = () => {
    if (warmFetch === ac) warmFetch = null;
  };
  fetch(src, { priority: "low", signal: ac.signal })
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
    .then(done, () => {
      // Failed or stopped: nothing was kept, so it holds no slot and may be fetched again.
      done();
      warmed.delete(src);
      if (warmSrc === src) warmSrc = null;
    });
}

/**
 * The owner's cue time (seconds), NaN for anyone else: the element's
 * currentTime minus the cue's offset, carried forward with
 * performance.now() between readings, because Firefox and Safari update
 * currentTime coarsely and a frame must not see the clock stand still
 * and then jump.
 *
 * Each new reading re-anchors the clock, as a lower bound: a reading
 * ahead of the clock moves it forward at once; one a little behind is
 * most likely late (taken before it was handed over), so the clock only
 * eases towards it; one far behind is a stall, followed at once. While
 * playing the clock never steps back short of that, and never runs more
 * than MAX_AHEAD_S past the last reading. Paused, seeking or waiting for
 * data, it is the reading itself.
 */
export function clock(id: string): number {
  if (owner !== id || !el || !loaded) return NaN;
  // A seek asked for before the metadata arrived is where the clock is.
  if (pendingSeek !== null) return pendingSeek - loaded.offset;
  const a = el;
  const raw = a.currentTime;
  const moving = !a.paused && !a.seeking && !a.ended && a.readyState >= 3;
  if (!moving) {
    skewSet = false;
    lastRaw = lastOut = raw;
    return raw - loaded.offset;
  }
  const wall = (performance.now() / 1000) * a.playbackRate;
  // The first moving frame often still reads what the loading frames read:
  // anchor on it all the same, or a skew left from the last clip runs the
  // clock up to MAX_AHEAD_S ahead of the audio for a frame.
  if (raw !== lastRaw || !skewSet) {
    lastRaw = raw;
    const s = raw - wall;
    if (!skewSet || s > skew || skew - s > JUMP_S) skew = s;
    else skew -= (skew - s) * EASE;
    skewSet = true;
  }
  let t = Math.min(wall + skew, raw + MAX_AHEAD_S);
  if (t < lastOut && lastOut - t < JUMP_S) t = lastOut;
  lastOut = t;
  return t - loaded.offset;
}

/** Forget the clock's history: the next reading is taken as it is (after a load or a seek). */
function reanchor() {
  skewSet = false;
  lastRaw = -1;
  lastOut = 0;
}

function seekMedia(t: number) {
  const a = element();
  waitAt = performance.now();
  if (a.readyState >= 1) {
    a.currentTime = t;
    pendingSeek = null;
  } else {
    pendingSeek = t;
  }
  reanchor();
}

function applyPendingSeek() {
  if (pendingSeek === null || !el) return;
  if (Math.abs(el.currentTime - pendingSeek) > 0.02) el.currentTime = pendingSeek;
  pendingSeek = null;
  reanchor();
}

function ended() {
  if (!owner || !loaded) return;
  wants = false;
  const h = handlers;
  emit();
  h.onEnded?.();
}

function warmNext() {
  if (!el || !next || !loaded || !on) return;
  const length = Number.isFinite(el.duration) ? el.duration : loaded.dur + loaded.offset;
  if (el.currentTime > length / 2) {
    const src = next;
    next = null;
    warm(src);
  }
}

/** Arms the stall watchdog: a wait for the element to move begins now. */
function watch() {
  waitAt = performance.now();
  progressRaw = -1;
  if (!watchdog) watchdog = window.setInterval(checkStall, WATCH_MS);
}

function checkStall() {
  const a = el;
  if (!a || !owner || !wants || !loaded || !on) {
    window.clearInterval(watchdog);
    watchdog = 0;
    return;
  }
  const now = performance.now();
  // Held for the tab: not a stall.
  if (hiddenHold || document.hidden) {
    waitAt = now;
    return;
  }
  const moving = !a.paused && !a.seeking && a.readyState >= 3;
  if (moving && a.currentTime !== progressRaw) {
    progressRaw = a.currentTime;
    waitAt = now;
    return;
  }
  // Bytes have come since the wait began: it may run on while they keep coming.
  const fed = dataAt > waitAt;
  const dead = deadAt > 0 && waitAt - deadAt < DEAD_FOR_MS;
  const limit = fed
    ? Math.min(dataAt + STALL_MS, waitAt + START_MAX_MS)
    : waitAt + (dead ? STALL_MS : FIRST_BYTE_MS);
  if (now < limit) return;
  // Given up: the owner carries on silently from where its clock is, and the
  // element lets go of the request, so a later play loads the file afresh.
  // The wait is shortened once at most (see deadAt).
  deadAt = !fed && !dead ? now : 0;
  window.clearInterval(watchdog);
  watchdog = 0;
  lose(null);
  if (owner !== null) return;
  loaded = null;
  pendingSeek = null;
  a.removeAttribute("src");
  a.load();
}

/**
 * A play() that did not start. An abort is a newer load or a pause and
 * means nothing. A refusal means the browser wants a gesture after all:
 * sound goes back off, so every sound control says so, and the next
 * press unlocks again. Anything else (a missing file, a codec) drops the
 * owner, who carries on silently.
 */
function failed(e: unknown) {
  if (e instanceof DOMException && e.name === "AbortError") return;
  const refused = e instanceof DOMException && e.name === "NotAllowedError";
  if (refused) unlocked = false;
  if (loaded && owner) lose(null);
  if (refused) on = false;
  emit();
}

function visibility() {
  const a = el;
  if (!a) return;
  if (document.hidden) {
    if (owner && wants && !a.paused) {
      hiddenHold = true;
      a.pause();
    }
  } else if (hiddenHold) {
    hiddenHold = false;
    if (owner && wants && on) {
      reanchor();
      waitAt = performance.now();
      a.play().catch(failed);
    }
  }
}
