"use client";

import { useSyncExternalStore } from "react";
import { whenIdle, whenIntent } from "./motion-kit";

/* ------------------------------------------------------------------ *
 * How much this device can take.
 *
 *   full   everything: WebGL at full resolution
 *   mid    a touch screen, a window under 1280px, or frames that came out
 *          slow: WebGL at a capped pixel ratio, no grain in the shaders,
 *          fewer programs held
 *   lite   weak hardware: no WebGL at all (posters and still CSS orbs),
 *          no grain overlays
 *   still  the reader asked for reduced motion
 *
 * The tier decides how the pictures are DRAWN, never whether the stages
 * play: on full, mid and lite alike every stage tours on its own (lite
 * tours its cheap, WebGL-free version). Only `still` holds them.
 *
 * Lite is a HARD verdict only: weak hardware declared (2 GB of memory, or
 * four cores with 4 GB), a GPU that is software, blocklisted or on the
 * WEAK_GPU list, or a reader who asked to save data (Save-Data, a 2G
 * connection). The hardware verdict is kept for the tab's session (under
 * "ntv-weak"; the old "ntv-tier" verdict is ignored) and mirrored as
 * <html data-weak>; the connection is read again on every load.
 *
 * Slow frames are a SOFT verdict: they also come from the page's own work
 * (hydration, a section rendered as it scrolls in, a shader compile), a
 * 30Hz power-saving cadence or a busy machine, so they only ever take a
 * visit from full to mid, are never kept, and never stop a stage. The
 * probe that looks for them runs once per page load, after the GPU check,
 * once scrolling has rested and the main thread is idle; it judges the
 * median frame, so a few long frames (the page's own work) cannot condemn
 * a good machine. A GPU loop at its quality floor whose frames stay slow
 * calls `demote()`, which does the same: full to mid, never lower.
 *
 * The server and the hydrating render always say "full", so the tier only
 * ever changes behaviour after mount and can never cause a hydration
 * mismatch. It is mirrored on <html data-tier> for CSS (home/tier.css).
 *
 * QA: `?tier=full|mid|lite|still` in the URL, or localStorage "ntv-tier"
 * set to one of those, forces the tier for the page load and turns the
 * probe and demote() off; a forced lite counts as hard. Headless Chrome
 * draws WebGL with SwiftShader, which is rightly "lite": screenshot the
 * WebGL surfaces with ?tier=full.
 * ------------------------------------------------------------------ */

export type DeviceTier = "full" | "mid" | "lite" | "still";

const TIERS: readonly string[] = ["full", "mid", "lite", "still"];
/** The QA override, in localStorage. */
const KEY = "ntv-tier";
/**
 * The tab's hard verdict, in sessionStorage. Not "ntv-tier": that key also
 * held the old probe's soft "lite", which must not outlive this version.
 */
const WEAK_KEY = "ntv-weak";

/** Software renderers, and mobile GPUs too old for a fragment shader over a whole stage. */
const WEAK_GPU =
  /SwiftShader|llvmpipe|softpipe|Basic Render|Mali-(4\d\d|T[6-8]\d\d|G(31|51|52))\b|Adreno\D*([345]\d\d|6[01]\d)\b|PowerVR/i;

/** The probe times this many frames, or for this long, whichever ends first. */
const PROBE_FRAMES = 90;
const PROBE_MS = 2500;
/** A median frame over this (under 40 fps, sustained) is slow: mid, never lite. */
const SLOW_MEDIAN_MS = 25;
/** The probe starts once scrolling has rested this long, and waits no longer than QUIET_MAX_MS for it. */
const QUIET_MS = 400;
const QUIET_MAX_MS = 4000;

let booted = false;
let forced: DeviceTier | null = null;
let base: "full" | "mid" | "lite" = "full";
/** A hard verdict: weak by declaration or by GPU. */
let weak = false;
let reduce = false;
let tier: DeviceTier = "full";
let settled: Promise<void> = Promise.resolve();
let probed = false;
/** weakGpu()'s answer once asked: it creates a context, so it runs at most once per page load. */
let gpuVerdict: boolean | null = null;
const listeners = new Set<(tier: DeviceTier) => void>();

function stored(storage: () => Storage, key: string) {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

function keepWeak() {
  try {
    sessionStorage.setItem(WEAK_KEY, "weak");
  } catch {}
}

function update() {
  const next: DeviceTier = forced ?? (reduce ? "still" : base);
  document.documentElement.dataset.tier = next;
  document.documentElement.toggleAttribute("data-weak", forced ? forced === "lite" : weak);
  if (next === tier) return;
  tier = next;
  listeners.forEach((l) => l(next));
}

/** What the browser says about itself: "weak" hardware, a "lite" (data-saving) connection, or null. */
function weakByDeclaration(): "weak" | "lite" | null {
  const n = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  const memory = n.deviceMemory ?? 8;
  if (memory <= 2 || (n.hardwareConcurrency <= 4 && memory <= 4)) return "weak";
  if (n.connection?.saveData || /^(slow-2g|2g)$/.test(n.connection?.effectiveType ?? "")) return "lite";
  return null;
}

/** The GPU as WebGL reports it: true for one that should get no WebGL at all. */
function weakGpu() {
  // A context the browser would only give with a major performance caveat
  // (software rendering, a blocklisted driver) is refused outright.
  const gl = document.createElement("canvas").getContext("webgl2", { failIfMajorPerformanceCaveat: true });
  if (!gl) return true;
  let renderer = String(gl.getParameter(gl.RENDERER));
  // Chromium masks RENDERER; the debug extension (deprecated in Firefox, which needs it not) tells.
  const info = /^WebKit/.test(renderer) ? gl.getExtension("WEBGL_debug_renderer_info") : null;
  if (info) renderer = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
  const small = gl.getParameter(gl.MAX_TEXTURE_SIZE) < 4096;
  gl.getExtension("WEBGL_lose_context")?.loseContext();
  return small || WEAK_GPU.test(renderer);
}

/**
 * weakGpu(), asked at most once per page load (the probe and gpuIsWeak()
 * share the answer). A weak GPU is a hard verdict: lite, kept for the tab.
 * A check that could not run leaves the declared tier.
 */
function checkGpu() {
  if (gpuVerdict === null) {
    try {
      gpuVerdict = weakGpu();
    } catch {
      gpuVerdict = false;
    }
  }
  if (gpuVerdict && !weak) {
    weak = true;
    base = "lite";
    keepWeak();
    update();
  }
  return gpuVerdict;
}

/**
 * Resolves once scrolling has rested for QUIET_MS and the main thread is
 * idle, or QUIET_MAX_MS after it was asked, whichever comes first: the
 * frames a scroll renders (sections coming in, their effects measuring)
 * are the page's work, not the device's.
 */
function whenQuiet() {
  return new Promise<void>((resolve) => {
    const events = ["scroll", "wheel", "touchmove", "resize"] as const;
    let timer = 0;
    let cancelIdle: (() => void) | undefined;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      events.forEach((e) => window.removeEventListener(e, arm, true));
      clearTimeout(timer);
      clearTimeout(cap);
      cancelIdle?.();
      resolve();
    };
    function arm() {
      clearTimeout(timer);
      cancelIdle?.();
      cancelIdle = undefined;
      timer = window.setTimeout(() => (cancelIdle = whenIdle(finish)), QUIET_MS);
    }
    const cap = window.setTimeout(finish, QUIET_MAX_MS);
    events.forEach((e) => window.addEventListener(e, arm, { capture: true, passive: true }));
    arm();
  });
}

/**
 * Up to PROBE_FRAMES frames, for at most PROBE_MS: true when the median
 * frame is slow. The median, not the worst: a long frame or two is the
 * page's own work, and says nothing about the machine. A tab hidden
 * midway starts over once it is back.
 */
function slowByFrames(): Promise<boolean> {
  return new Promise((resolve) => {
    let gaps: number[] = [];
    let last = 0;
    let raf = 0;
    let started = performance.now();
    const finish = () => {
      cancelAnimationFrame(raf);
      clearInterval(watch);
      document.removeEventListener("visibilitychange", restart);
      // Under ten frames in PROBE_MS is under four a second: slow by any measure.
      if (gaps.length < 10) return resolve(true);
      const sorted = [...gaps].sort((a, b) => a - b);
      resolve(sorted[sorted.length >> 1] > SLOW_MEDIAN_MS);
    };
    const tick = (now: number) => {
      if (last) gaps.push(now - last);
      last = now;
      if (gaps.length >= PROBE_FRAMES || now - started >= PROBE_MS) return finish();
      raf = requestAnimationFrame(tick);
    };
    function restart() {
      cancelAnimationFrame(raf);
      gaps = [];
      last = 0;
      started = performance.now();
      if (!document.hidden) raf = requestAnimationFrame(tick);
    }
    // A frame that never comes (a background tab) must not hold the verdict forever.
    const watch = window.setInterval(() => {
      if (!document.hidden && performance.now() - started >= PROBE_MS + 500) finish();
    }, 500);
    document.addEventListener("visibilitychange", restart);
    restart();
  });
}

/**
 * The GPU check, then the frame probe, once per page load, unless the tab
 * already has a hard verdict. `settled` is the promise the GPU loops wait
 * on: it resolves with the GPU check (in the first idle moment after the
 * visitor's first sign of life), so a weak GPU never compiles a shader.
 * The frames are judged later, once scrolling has rested, and can only
 * take the visit from full to mid.
 */
function probe() {
  if (probed || forced || weak) return;
  probed = true;
  settled = whenIntent()
    .then(() => new Promise<void>((r) => void whenIdle(r)))
    .then(() => {
      if (checkGpu()) return;
      void whenQuiet()
        .then(slowByFrames)
        .then((slow) => {
          if (slow) demote();
        })
        .catch(() => {});
    })
    // A probe that could not run leaves the declared tier.
    .catch(() => {});
}

function boot() {
  if (booted || typeof window === "undefined") return;
  booted = true;

  const asked = new URLSearchParams(location.search).get("tier") ?? stored(() => localStorage, KEY);
  forced = asked && TIERS.includes(asked) ? (asked as DeviceTier) : null;

  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  reduce = motion.matches;
  motion.addEventListener("change", (e) => {
    reduce = e.matches;
    // Reduced motion put the probe off; with motion back on it runs first.
    if (!reduce) probe();
    update();
  });

  if (!forced) {
    const small = matchMedia("(pointer: coarse)").matches || innerWidth < 1280;
    const declared = weakByDeclaration();
    weak = stored(() => sessionStorage, WEAK_KEY) === "weak" || declared === "weak";
    base = weak || declared === "lite" ? "lite" : small ? "mid" : "full";
    if (weak) keepWeak();
    // Reduced motion is "still" whatever the probe would say: it waits.
    else if (!reduce) probe();
  }
  update();
}

/** The tier now. Boots detection on first call; client only. */
export function getTier(): DeviceTier {
  boot();
  return tier;
}

/**
 * The tier once the GPU check has had its say (at once when the verdict
 * is cached, forced or declared; otherwise in the first idle moment after
 * the visitor's first sign of life). Anything that would create a WebGL
 * context waits for this, so a weak device never pays for the compile it
 * would throw away. Stages that only move the DOM do not wait for it.
 */
export function whenTierSettled(): Promise<DeviceTier> {
  boot();
  return settled.then(() => tier);
}

/** Calls `fn` with every new tier; returns the unsubscribe. */
export function onTierChange(fn: (tier: DeviceTier) => void) {
  boot();
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

/**
 * A GPU loop at its quality floor whose frames are still slow: the rest of
 * the visit draws at mid. Never lower than mid, never kept past the page,
 * never a reason for a stage to stop. Ignored under a forced tier.
 */
export function demote() {
  boot();
  if (forced || base !== "full") return;
  base = "mid";
  update();
}

/**
 * True when this device must get no WebGL at all, asked now rather than
 * after the visitor's first sign of life: for a surface that draws on load.
 * A forced tier answers for itself (only a forced lite is weak); otherwise
 * a hard verdict already in (declared, or kept for the tab) is weak, and
 * the GPU is checked at once, at most once per page load, sharing its
 * answer with the probe. A weak GPU makes the visit lite, as the probe would.
 * False on the server.
 */
export function gpuIsWeak(): boolean {
  boot();
  if (typeof window === "undefined") return false;
  if (forced) return forced === "lite";
  return weak || checkGpu();
}

/**
 * True under the QA override (`?tier=` in the URL, or localStorage
 * "ntv-tier"): the probe and demote() are off, and so is any GPU loop's
 * own retreat to its poster. A forced tier asks to see what it forces.
 */
export function isForced() {
  boot();
  return forced !== null;
}

/** True for a tier that may create a WebGL context. */
export function drawsWebGL(t: DeviceTier) {
  return t === "full" || t === "mid";
}

/**
 * A runtime governor for a GPU loop. Feed it every frame's gap (ms); it
 * answers true once 6 of the last 10 were over 34ms (under 30 fps), then
 * starts a fresh window.
 */
export function slowFrames() {
  let bits = 0;
  let seen = 0;
  return (gap: number) => {
    bits = ((bits << 1) | (gap > 34 ? 1 : 0)) & 1023;
    seen = Math.min(seen + 1, 10);
    let slow = 0;
    for (let b = bits; b; b &= b - 1) slow++;
    if (seen < 10 || slow < 6) return false;
    bits = 0;
    seen = 0;
    return true;
  };
}

/** A judged frame gap over this, with resolution whole, is slow: the GPU loops' fixed threshold. */
export const SLOW_MS = 26;
/** A frame gap under this, with resolution given up, is a frame to spare. */
export const FAST_MS = 20;
/** Judged frame gaps a reading of the frame cadence is taken over. */
const CADENCE_FRAMES = 30;
/**
 * Judged frames an adopted cadence holds for before it is put to the test
 * again; doubled at each adoption, up to the most.
 */
const CADENCE_HOLD_FRAMES = 300;
const CADENCE_HOLD_MAX_FRAMES = 4800;
/**
 * The longest a display's own frame interval is taken to be: 30Hz (33.3ms)
 * and a little slack. A floor whose frames come slower than this is
 * waiting on something other than the display (a GPU, a busy main thread),
 * and is never adopted as a cadence.
 */
const CADENCE_MAX_MS = 36;
/** The most floor readings in a row a cadence has to pass before it is adopted (see frameCadence). */
const CADENCE_NEED_MAX = 64;

/** The median of some gaps (sorts them in place). */
const median = (gaps: number[]) => gaps.sort((a, b) => a - b)[gaps.length >> 1];

/**
 * SLOW_MS and FAST_MS take a display at 60Hz or better for granted. A
 * browser or an OS power saver can hold every frame to 30Hz, and there
 * each gap is about 33ms, "slow": the resolution went to its floor in
 * the first second and stayed there, for nothing, since a quarter of the
 * pixels comes no faster than the display allows.
 *
 * So the frames at the floor are read, CADENCE_FRAMES gaps at a time, and
 * set against the frames full resolution gave before the step down: the
 * median of each, like with like (the last CADENCE_FRAMES gaps read above
 * the floor, taken as the step from full is made). When the floor's are
 * no faster, slower than any display at 50Hz or better gives (their 10th
 * percentile: the display's own interval) and on average no slower than a
 * display can be (CADENCE_MAX_MS), the cadence is the display's: `read`
 * says so, the caller hands the resolution back, and from then on a gap
 * is slow only well past that cadence, and one at it is a frame to spare.
 * A floor that did bring faster frames changes nothing, so a GPU that
 * cannot keep up gives up resolution exactly as before, even when some of
 * its frames at full made the display's interval; a floor slower than any
 * display is left to the caller's floor verdict; and frames well under the
 * adopted cadence (the saver switched off) put the fixed thresholds back.
 *
 * A floor read while the page itself kept the main thread busy can look
 * like a slow display too, so an adopted cadence only holds for a while
 * (CADENCE_HOLD_FRAMES, twice as long after each adoption): then the fixed
 * thresholds judge again, and a display that really is slow is read and
 * adopted afresh, at longer and longer intervals. And full resolution,
 * given back under an adopted cadence, that steps down again while it
 * holds could not keep to it: the cadence was not the display's alone (a
 * GPU just at its edge, its frames now on it, now a vsync past). It is
 * dropped there, and the next is adopted only once twice as many floor
 * readings in a row have passed (up to CADENCE_NEED_MAX), so a device on
 * the edge settles at its floor instead of trading resolution back and
 * forth; a cadence that holds for its whole term puts that back to one.
 *
 * The industry band and the trade stage step from full to their floor;
 * the cover portrait (depth-portrait.tsx) steps down a level at a time,
 * so it reads every level under full as `floor`. A cadence never outlives
 * a step down from full, so resolution given up is always judged against
 * the fixed thresholds.
 */
export function frameCadence() {
  /** The display's interval, once the frames have shown it is the limit; 0: none, the fixed thresholds. */
  let cadence = 0;
  /** The last CADENCE_FRAMES gaps read above the floor since the last step. */
  const above: number[] = [];
  /** Their median when resolution last stepped down from full; 0: nothing to set the floor against. */
  let before = 0;
  /** Judged gaps since the last step, and whether every one was at the floor. */
  const gaps: number[] = [];
  let floorOnly = true;
  /** Floor readings in a row that must pass before a cadence is adopted, and how many have. */
  let need = 1;
  let passed = 0;
  /** Judged frames the adopted cadence still holds for, and how long the next adoption holds. */
  let holds = 0;
  let hold = CADENCE_HOLD_FRAMES;

  return {
    /** A judged gap above the floor: true when it is slow. */
    slow: (gap: number) => gap > Math.max(SLOW_MS, cadence * 1.25),
    /** A judged gap with resolution given up: true when it is a frame to spare. */
    fast: (gap: number) => gap < Math.max(FAST_MS, cadence * 1.2),
    /** The adopted cadence (ms), or 0 while the fixed thresholds judge. */
    interval: () => cadence,
    /** Resolution just stepped down (`fromFull`: from full) or back up. */
    stepped(fromFull = false) {
      if (fromFull) {
        if (cadence) {
          // Given back under the cadence, full resolution could not keep to it.
          cadence = 0;
          need = Math.min(CADENCE_NEED_MAX, need * 2);
        }
        before = above.length ? median(above) : 0;
      }
      above.length = 0;
      gaps.length = 0;
      floorOnly = true;
      passed = 0;
    },
    /**
     * Reads one judged gap (`floor`: drawn at the lowest resolution). True
     * when the floor proved no faster than full resolution was before the
     * step down from it, at a cadence a display can have: the caller puts
     * the resolution back. `adopt` false (the caller's own floor verdict
     * is under way) reads the gap but lets no reading pass.
     */
    read(gap: number, floor: boolean, adopt = true) {
      if (cadence && --holds <= 0) {
        // Held for its whole term: the next adoption needs one reading again.
        cadence = 0;
        need = 1;
      }
      if (!floor) {
        above.push(gap);
        if (above.length > CADENCE_FRAMES) above.shift();
      }
      gaps.push(gap);
      floorOnly &&= floor;
      if (gaps.length < CADENCE_FRAMES) return false;
      const mid = median(gaps);
      const p = gaps[Math.floor(CADENCE_FRAMES / 10)];
      const mean = gaps.reduce((sum, g) => sum + g, 0) / CADENCE_FRAMES;
      const wholeAtFloor = floorOnly;
      gaps.length = 0;
      floorOnly = true;
      if (cadence && p < cadence * 0.75) cadence = 0;
      const display =
        adopt &&
        wholeAtFloor &&
        before > 0 &&
        p > FAST_MS &&
        mean <= CADENCE_MAX_MS &&
        mid >= before * 0.85;
      passed = display ? passed + 1 : 0;
      if (passed < need) return false;
      passed = 0;
      cadence = p;
      before = 0;
      holds = hold;
      hold = Math.min(CADENCE_HOLD_MAX_FRAMES, hold * 2);
      return true;
    },
  };
}

const subscribe = (onChange: () => void) => onTierChange(onChange);
const snapshot = () => tier;
const serverSnapshot = (): DeviceTier => "full";

/** The device tier, for rendering. "full" on the server and while hydrating. */
export function useDeviceTier(): DeviceTier {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
