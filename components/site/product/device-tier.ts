"use client";

import { useSyncExternalStore } from "react";
import { whenIdle, whenIntent } from "./motion-kit";

/* ------------------------------------------------------------------ *
 * How much this device can take, decided once per visit.
 *
 *   full   everything: WebGL at full resolution, stages that play on their own
 *   mid    a touch screen or a window under 1280px: WebGL at a capped
 *          pixel ratio, no grain in the shaders, fewer programs held
 *   lite   a weak device: no WebGL at all (posters and still CSS orbs),
 *          no grain overlays, and a stage plays only once it is tapped
 *   still  the reader asked for reduced motion
 *
 * Lite is read first from what the browser says about itself (2 GB of
 * memory, four cores with 4 GB; Save-Data or a slow connection), then, in
 * the first idle moment after the visitor's first sign of life, from the
 * GPU (no WebGL2 without a performance caveat, a small texture limit, a
 * software or old mobile GPU) and 60 timed frames, and from then on by the
 * GPU loops themselves: one whose quality is at its floor and whose frames
 * are still slow calls `demote()`. The probe's verdict is kept for the
 * tab's session, so it runs once; under reduced motion it waits until
 * motion is back on.
 *
 * The server and the hydrating render always say "full", so the tier only
 * ever changes behaviour after mount and can never cause a hydration
 * mismatch. It is mirrored on <html data-tier> for CSS (home/tier.css).
 *
 * Some lite verdicts are hard and some are soft. Hard: weak hardware
 * declared (memory, cores), or a GPU that is software, blocklisted or on
 * the WEAK_GPU list. Soft: the connection (re-read on every load), and slow
 * frames, from the probe or from demote(), which also come from a busy main
 * thread (a `next dev` compile), a 30Hz power-saving cadence or a hidden
 * tab, not only from weak hardware. Both lower the tier; only a hard one is
 * mirrored as <html data-weak>, for effects that cost neither the network
 * nor the main thread (compositor-only CSS animation) and so only need to
 * stay off hardware that cannot composite them.
 *
 * QA: `?tier=full|mid|lite|still` in the URL, or localStorage "ntv-tier"
 * set to one of those, forces the tier for the page load and turns the
 * probe and demote() off; a forced lite counts as hard. Headless Chrome
 * draws WebGL with SwiftShader, which is rightly "lite": screenshot the
 * WebGL surfaces with ?tier=full.
 * ------------------------------------------------------------------ */

export type DeviceTier = "full" | "mid" | "lite" | "still";

const TIERS: readonly string[] = ["full", "mid", "lite", "still"];
/** The QA override in localStorage, and the probe's verdict in sessionStorage. */
const KEY = "ntv-tier";

/** Software renderers, and mobile GPUs too old for a fragment shader over a whole stage. */
const WEAK_GPU =
  /SwiftShader|llvmpipe|softpipe|Basic Render|Mali-(4\d\d|T[6-8]\d\d|G(31|51|52))\b|Adreno\D*([345]\d\d|6[01]\d)\b|PowerVR/i;

let booted = false;
let forced: DeviceTier | null = null;
let base: "full" | "mid" | "lite" = "full";
/** A hard verdict: weak by declaration or by GPU. */
let weak = false;
let reduce = false;
let tier: DeviceTier = "full";
let settled: Promise<void> = Promise.resolve();
let probed = false;
const listeners = new Set<(tier: DeviceTier) => void>();

function stored(storage: () => Storage) {
  try {
    return storage().getItem(KEY);
  } catch {
    return null;
  }
}

/** The tab's verdict: "weak" (hard), "lite" (soft: slow frames) or "ok". */
function keep(verdict: "weak" | "lite" | "ok") {
  try {
    sessionStorage.setItem(KEY, verdict);
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

/** What the browser says about itself: "weak" hardware, a "lite" connection, or null. */
function weakByDeclaration(): "weak" | "lite" | null {
  const n = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  const memory = n.deviceMemory ?? 8;
  if (memory <= 2 || (n.hardwareConcurrency <= 4 && memory <= 4)) return "weak";
  if (n.connection?.saveData || /^(slow-2g|2g|3g)$/.test(n.connection?.effectiveType ?? "")) return "lite";
  return null;
}

/**
 * The GPU as WebGL reports it, then 60 frames: "weak" for a GPU that
 * should get lite, "lite" for frames that are slow, "ok" otherwise.
 */
function weakByProbe(): Promise<"weak" | "lite" | "ok"> {
  // A context the browser would only give with a major performance caveat
  // (software rendering, a blocklisted driver) is refused outright.
  const gl = document.createElement("canvas").getContext("webgl2", { failIfMajorPerformanceCaveat: true });
  if (!gl) return Promise.resolve("weak");
  let renderer = String(gl.getParameter(gl.RENDERER));
  // Chromium masks RENDERER; the debug extension (deprecated in Firefox, which needs it not) tells.
  const info = /^WebKit/.test(renderer) ? gl.getExtension("WEBGL_debug_renderer_info") : null;
  if (info) renderer = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
  const small = gl.getParameter(gl.MAX_TEXTURE_SIZE) < 4096;
  gl.getExtension("WEBGL_lose_context")?.loseContext();
  if (small || WEAK_GPU.test(renderer)) return Promise.resolve("weak");

  return new Promise((resolve) => {
    const gaps: number[] = [];
    let last = 0;
    const tick = (now: number) => {
      // A gap this long is a background tab, not a slow frame.
      if (last && now - last < 500) gaps.push(now - last);
      last = now;
      if (gaps.length < 60) return void requestAnimationFrame(tick);
      gaps.sort((a, b) => a - b);
      // The median over 20ms, or two frames over 50ms.
      resolve(gaps[30] > 20 || gaps[58] > 50 ? "lite" : "ok");
    };
    requestAnimationFrame(tick);
  });
}

/**
 * The GPU and frame probe, once per tab session, unless a verdict is
 * already in. `settled` is the promise the GPU loops wait on, so it is
 * replaced before any tier change that would let them draw.
 */
function probe() {
  if (probed || forced || weak || stored(() => sessionStorage)) return;
  probed = true;
  settled = whenIntent()
    .then(() => new Promise<void>((r) => void whenIdle(r)))
    .then(weakByProbe)
    .then(
      (verdict) => {
        keep(verdict);
        if (verdict === "weak") weak = true;
        if (verdict !== "ok") demote();
        update();
      },
      // A probe that could not run leaves the declared tier, uncached.
      () => {},
    );
}

function boot() {
  if (booted || typeof window === "undefined") return;
  booted = true;

  const asked = new URLSearchParams(location.search).get("tier") ?? stored(() => localStorage);
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
    const verdict = stored(() => sessionStorage);
    const small = matchMedia("(pointer: coarse)").matches || innerWidth < 1280;
    const declared = weakByDeclaration();
    weak = verdict === "weak" || declared === "weak";
    base = weak || declared === "lite" || verdict === "lite" ? "lite" : small ? "mid" : "full";
    if (weak) keep("weak");
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
 * The tier once the probe has had its say (at once when the verdict is
 * cached, forced or declared). Anything that would create a WebGL context
 * waits for this, so a weak device never pays for the compile it would
 * throw away.
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

/** Drops this visit (and the tab's session) to lite. Ignored under a forced tier. */
export function demote() {
  boot();
  if (forced || base === "lite") return;
  base = "lite";
  keep(weak ? "weak" : "lite");
  update();
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

const subscribe = (onChange: () => void) => onTierChange(onChange);
const snapshot = () => tier;
const serverSnapshot = (): DeviceTier => "full";

/** The device tier, for rendering. "full" on the server and while hydrating. */
export function useDeviceTier(): DeviceTier {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
