/* ------------------------------------------------------------------ *
 * Where the header is: printed on the cover, or lifted off it.
 *
 * The phase is a single attribute on <html> rather than React state, an
 * inline style, or an attribute React renders. Three things follow from
 * that and all three are the point:
 *
 *   · the correct phase can exist before React does, written by the boot
 *     script during HTML parsing, so a mid-page reload paints the pill on
 *     its first frame instead of painting the docked bar and correcting;
 *   · nothing React commits can clobber it, and nothing can hydrate-
 *     mismatch on it;
 *   · the whole morph is CSS keyed off that attribute, which is why no
 *     part of this file animates anything.
 *
 * `data-nav`        the phase. Absent reads as docked (the CSS default).
 * `data-nav-motion` transitions exist only while this is present.
 * `data-nav-hold`   scroll reads are ignored (a menu or the sheet owns
 *                   the page).
 * `data-nav-lift` / `data-nav-land`  a flip just happened, in that
 *                   direction. The two glints are gated on these so they
 *                   fire on a real flip and never on arming motion.
 * ------------------------------------------------------------------ */

/** px — at or past this, the masthead peels off the cover. */
export const DETACH_AT = 64;
/** px — at or under this, it lands back on it. 48px of hysteresis between. */
export const REDOCK_AT = 16;

/** How long the lift/land flags stay up: the longer of the two timelines. */
const GLINT_MS = 1200;

export type DockPhase = "docked" | "detached";

declare global {
  interface Window {
    /** Installed by HEADER_BOOT so the client store can take the attribute over. */
    __ntvNavStop?: () => void;
  }
}

/**
 * The pre-hydration half, as a string.
 *
 * Deliberately free of TS and of anything SWC would down-level into a
 * helper: it is inlined into the document verbatim and runs during
 * parsing, before any module exists to hold a helper. The thresholds are
 * interpolated from the constants above so the two halves cannot drift.
 *
 * It bails on the same two flags the store does — `data-nav-hold`, and
 * Base UI's own `data-base-ui-scroll-locked`, because that lock moves the
 * page offset onto <body> and makes `window.scrollY` read 0, which would
 * silently re-dock the header behind an open sheet.
 */
export const HEADER_BOOT = `(function(){
  if (location.pathname !== '/') return;
  var r = document.documentElement, s = null;
  function read(){
    if (stopped) return;
    if (r.hasAttribute('data-nav-hold') || r.hasAttribute('data-base-ui-scroll-locked')) return;
    var y = window.scrollY > 0 ? window.scrollY : 0;
    var n = s === 'detached' ? (y <= ${REDOCK_AT} ? 'docked' : 'detached')
                             : (y >= ${DETACH_AT} ? 'detached' : 'docked');
    if (n === s) return;
    var first = s === null;
    s = n; r.setAttribute('data-nav', n);
    // The masthead's opening beat belongs to a fresh load that starts at
    // the top and to nothing else. Decided here, during parsing, so the
    // markup itself can ship visible: no script, no entrance, but also no
    // invisible navigation.
    if (first && n === 'docked') r.setAttribute('data-nav-entrance', '');
  }
  var t = 0, stopped = false;
  function onScroll(){
    if (stopped || t) return;
    t = requestAnimationFrame(function(){ t = 0; read(); });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('pageshow', read);
  // Hands the attribute over for good. Without detaching the listeners the
  // boot script stays a second writer for the life of the document: it
  // would re-add data-nav on /login after stop() cleared it, and on the
  // homepage it would race the store inside the hysteresis band, where the
  // two disagree by design.
  window.__ntvNavStop = function(){
    stopped = true;
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('pageshow', read);
    if (t) { cancelAnimationFrame(t); t = 0; }
    s = null;
    delete window.__ntvNavStop;
  };
  read();
})();`;

let phase: DockPhase = "docked";
const listeners = new Set<() => void>();
const flips = new Set<(phase: DockPhase) => void>();

let holds = 0;
let scrollFrame = 0;
let motionFrame = 0;
let glintTimer = 0;
let live = false;

function root() {
  return document.documentElement;
}

/** Something else owns the scroll position; whatever we'd read is a lie. */
function frozen() {
  const r = root();
  return (
    r.hasAttribute("data-nav-hold") ||
    r.hasAttribute("data-base-ui-scroll-locked")
  );
}

function resolve(from: DockPhase, y: number): DockPhase {
  return from === "detached"
    ? y <= REDOCK_AT
      ? "docked"
      : "detached"
    : y >= DETACH_AT
      ? "detached"
      : "docked";
}

/** Flags the direction of a flip so the crease and the seam can key off it. */
function glint(next: DockPhase) {
  const r = root();
  if (!r.hasAttribute("data-nav-motion")) return;
  r.removeAttribute("data-nav-lift");
  r.removeAttribute("data-nav-land");
  r.setAttribute(next === "detached" ? "data-nav-lift" : "data-nav-land", "");
  window.clearTimeout(glintTimer);
  glintTimer = window.setTimeout(() => {
    r.removeAttribute("data-nav-lift");
    r.removeAttribute("data-nav-land");
  }, GLINT_MS);
}

function commit(next: DockPhase) {
  const r = root();
  // Scrolling settles on the same phase for every frame but two, and a
  // root attribute write is a style invalidation whose candidate set is
  // the whole document. Written only when it would actually say something
  // different — `primeDock` is what restores it after `stop()`.
  if (next === phase && r.getAttribute("data-nav") === next) return;
  const changed = next !== phase;
  phase = next;
  r.setAttribute("data-nav", next);
  if (!changed) return;
  // The opening beat is over the moment the header moves.
  r.removeAttribute("data-nav-entrance");
  glint(next);
  // The menu closes itself from here, before the bar morphs: a panel is
  // anchored to the frame, and an anchor that moves mid-open makes the
  // positioner chase it.
  flips.forEach((fn) => fn(next));
  listeners.forEach((fn) => fn());
}

/** One scrollY read, no layout reads. */
export function syncDock() {
  if (typeof window === "undefined" || frozen()) return;
  commit(resolve(phase, window.scrollY > 0 ? window.scrollY : 0));
}

function onScroll() {
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0;
    syncDock();
  });
}

/**
 * Two frames, then transitions exist.
 *
 * One mechanism covers every case that must not animate: mount, a
 * restored scroll position, a resize, and a bfcache restore. There is no
 * boot-window heuristic and no timer to tune.
 */
function armMotion() {
  cancelAnimationFrame(motionFrame);
  motionFrame = requestAnimationFrame(() => {
    motionFrame = requestAnimationFrame(() => {
      motionFrame = 0;
      root().setAttribute("data-nav-motion", "");
    });
  });
}

function onPageShow() {
  root().removeAttribute("data-nav-motion");
  syncDock();
  armMotion();
}

function start() {
  if (live) return;
  live = true;
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  window.addEventListener("orientationchange", onScroll);
  window.addEventListener("hashchange", onScroll);
  window.addEventListener("pageshow", onPageShow);
  syncDock();
  armMotion();
}

function stop() {
  live = false;
  window.removeEventListener("scroll", onScroll);
  window.removeEventListener("resize", onScroll);
  window.removeEventListener("orientationchange", onScroll);
  window.removeEventListener("hashchange", onScroll);
  window.removeEventListener("pageshow", onPageShow);
  cancelAnimationFrame(scrollFrame);
  cancelAnimationFrame(motionFrame);
  window.clearTimeout(glintTimer);
  scrollFrame = 0;
  motionFrame = 0;
  holds = 0;
  phase = "docked";
  // /login must not inherit the homepage's header state.
  const r = root();
  for (const a of [
    "data-nav",
    "data-nav-motion",
    "data-nav-entrance",
    "data-nav-hold",
    "data-nav-lift",
    "data-nav-land",
  ]) {
    r.removeAttribute(a);
  }
}

/**
 * Takes the attribute over from the boot script, before paint.
 *
 * Called from a layout effect rather than from `subscribe`, which React
 * runs in a passive effect — a frame too late for a soft navigation from
 * /login, where the boot script never ran for this document.
 */
export function primeDock() {
  if (typeof window === "undefined") return;
  window.__ntvNavStop?.();
  const booted: DockPhase =
    root().getAttribute("data-nav") === "detached" ? "detached" : "docked";
  if (frozen()) {
    commit(booted);
    return;
  }
  commit(resolve(booted, window.scrollY > 0 ? window.scrollY : 0));
}

export function subscribeDock(onChange: () => void) {
  listeners.add(onChange);
  start();
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0) stop();
  };
}

export function getDockPhase(): DockPhase {
  return phase;
}

export function getServerDockPhase(): DockPhase {
  return "docked";
}

/** Fires on a real phase change, before anything re-renders. */
export function onDockFlip(fn: (phase: DockPhase) => void) {
  flips.add(fn);
  return () => {
    flips.delete(fn);
  };
}

/**
 * Freezes the phase while a surface owns the page.
 *
 * `lift` additionally forces the detached look, which the sheet wants and
 * a hovered desktop panel does not: opening the sheet should peel the bar
 * off the cover, while hovering "Product" at the top of the page should
 * leave the masthead exactly where it is.
 */
export function holdDock(options?: { lift?: boolean }) {
  if (typeof window === "undefined") return;
  holds += 1;
  root().setAttribute("data-nav-hold", "");
  if (options?.lift) commit("detached");
}

export function releaseDock() {
  if (typeof window === "undefined") return;
  holds = Math.max(0, holds - 1);
  if (holds > 0) return;
  root().removeAttribute("data-nav-hold");
  syncDock();
  /*
    Base UI tears its scroll lock down in a `setTimeout(0)`, which is after
    this runs: the sync above still sees `data-base-ui-scroll-locked` and
    bails. Closing the sheet at the very top of the page would then strand
    the header detached forever, because restoring an offset of 0 changes
    nothing and fires no scroll event to correct it.

    So the read is repeated behind the unlock. Both are cheap — one
    `scrollY` read and, at most, one attribute write.
  */
  window.setTimeout(syncDock, 0);
  requestAnimationFrame(syncDock);
}
