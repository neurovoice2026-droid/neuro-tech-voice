/* ------------------------------------------------------------------ *
 * Following the words a press asked to hear.
 *
 * A press asked to hear a stage whose words, on a narrow screen, can sit
 * far from the control that was pressed (cards stacked one under another,
 * a caption under a long list). `showSaid` brings the words being said on
 * screen when they are not, so a reader who follows the captions sees
 * them as they are heard. The rules:
 *
 *   · Only when the words are not already on screen, and by the least the
 *     page can move to show them (never centring them).
 *   · The control that was pressed stays on screen too, wherever the two
 *     fit on it together.
 *   · Only for a run a press started (a Sound control, a Listen, a pick):
 *     never for a stage that started by itself. Once the reader scrolls by
 *     hand (the wheel, a drag, a scroll key, the scrollbar), nothing
 *     follows any more until their next press (`armFollow`): they are
 *     driving.
 *
 * A smooth scroll is checked once it has ended: a page whose sections
 * above render as the scroll passes them (content-visibility) can grow
 * under it, leaving the words short of the screen; they are then brought
 * on screen at once. Under reduced motion every move is instant.
 *
 * Where the two do not fit together, the control is left behind. Then,
 * while sound is on and it is off screen, a copy of it (pressed) waits at
 * the bottom of the screen (the dock, sound-dock.ts), so sound can always
 * be turned off where the reader is: pressing it presses the control.
 * ------------------------------------------------------------------ */

/**
 * The press being followed: the control pressed, whether the reader has
 * scrolled by hand since, and whether a follow has moved the page since.
 */
export type Press = { keep: Element | null; halted: boolean; moved: boolean };
let press: Press | null = null;
let watching = false;
/** Drops the check pending after a smooth follow scroll (see `recheck`). */
let dropCheck: (() => void) | null = null;
/** When a follow last moved the page (performance.now()). */
let movedAt = -Infinity;

/** Keys that scroll the page when nothing on it takes them. */
const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " ", "Spacebar"]);
/** Below this much travel a touch is a tap, not a drag. */
const DRAG_PX = 10;

const typingIn = (t: EventTarget | null) =>
  t instanceof Element && !!t.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])");
const pressable = (t: EventTarget | null) =>
  t instanceof Element &&
  !!t.closest("button, a[href], summary, [role='button'], [role='radio'], [role='switch'], [role='checkbox'], [role='tab']");

/** The reader moved the page by hand: nothing follows until their next press. */
function byHand() {
  if (press) press.halted = true;
  dropCheck?.();
}

function watch() {
  if (watching) return;
  watching = true;
  const passive = { capture: true, passive: true };
  window.addEventListener("wheel", (e) => e.deltaY !== 0 && byHand(), passive);
  let y0 = 0;
  window.addEventListener("touchstart", (e) => (y0 = e.touches[0]?.clientY ?? 0), passive);
  window.addEventListener(
    "touchmove",
    (e) => {
      const t = e.touches[0];
      if (t && Math.abs(t.clientY - y0) > DRAG_PX) byHand();
    },
    passive,
  );
  // Bubbling, so a control that takes its own keys (a radio group's arrows) has said so by now.
  window.addEventListener("keydown", (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || !SCROLL_KEYS.has(e.key) || typingIn(e.target)) return;
    // Space on a control presses it.
    if ((e.key === " " || e.key === "Spacebar") && pressable(e.target)) return;
    byHand();
  });
  // The page's own scrollbar, taken hold of.
  window.addEventListener(
    "pointerdown",
    (e) => {
      const root = document.documentElement;
      if (e.target === root && e.clientX >= root.clientWidth) byHand();
    },
    passive,
  );
}

/** The control the event being dispatched (a click, a key) was on, if any. */
function pressedControl(): Element | null {
  const t = (window as Window & { event?: Event }).event?.target;
  return t instanceof Element ? t.closest("button, a[href], [role='button'], [role='radio']") : null;
}

/**
 * A press asked a stage to be heard (a Sound control turned on, a Listen,
 * a pick): from now on what it starts may bring its words on screen
 * (showSaid), keeping `keep` (by default the control being pressed) on
 * screen with them where both fit. Call it inside the press. The reader's
 * own scrolling ends it.
 */
export function armFollow(keep?: Element | null) {
  if (typeof window === "undefined") return;
  watch();
  dropCheck?.();
  const p = { keep: keep ?? pressedControl(), halted: false, moved: false };
  press = p;
  // A dock up for the last press goes until this one moves the page.
  void dockModule?.then((m) => m.dockFor(p));
}

/** Sound turned off: the run carries on silently, and nothing follows it until the next press. */
export function endFollow() {
  byHand();
}

/** The band of the screen words can be read in: below the site's header, down to the bottom edge, clear of the dock. */
function band() {
  const h = window.innerHeight;
  const bar = document.querySelector("[data-site-header] .hdr-frame")?.getBoundingClientRect();
  // Docked on a phone the bar ends at 56px; floating on a desktop, higher. Either way, keep clear of it.
  const top = Math.min(Math.max(bar && bar.bottom > 0 ? bar.bottom : 0, 56) + 8, h / 3);
  return { top, bottom: h - (press && !press.halted ? DOCK_ROOM : 0) };
}

/** The foot of the screen the dock may take: words are followed to above it. */
const DOCK_ROOM = 64;

/** The dock (sound-dock.ts), fetched the first time a follow moves the page: most visits never need it. */
let dockModule: Promise<typeof import("./sound-dock")> | null = null;

/** A follow moved the page: from now on the dock stands in for the control pressed whenever it is off screen. */
function moved() {
  const p = press;
  if (!p) return;
  p.moved = true;
  void (dockModule ??= import("./sound-dock")).then((m) => m.dockFor(p));
}

/** A block too tall to show whole is shown once this much of it, from its top, is on screen. */
const TALL_SHOWN_PX = 120;

/**
 * How far the page must scroll (px, signed) to show `r` whole in the band,
 * keeping `k` on screen too when both fit; 0 when `r` is shown already.
 * Too tall to show whole, it is shown when its top is in the band with
 * some of it under it; otherwise its top goes to the top of the band.
 */
function travel(r: DOMRect, k: DOMRect | null, b: { top: number; bottom: number }) {
  const room = b.bottom - b.top;
  if (r.height > room) return r.top >= b.top && r.top <= b.bottom - TALL_SHOWN_PX ? 0 : r.top - b.top;
  if (r.top >= b.top && r.bottom <= b.bottom) return 0;
  // Any move in [lo, hi] shows it; the least is the end nearer 0.
  let lo = r.bottom - b.bottom;
  let hi = r.top - b.top;
  if (k && k.height > 0 && Math.max(r.bottom, k.bottom) - Math.min(r.top, k.top) <= room) {
    lo = Math.max(lo, k.bottom - b.bottom);
    hi = Math.min(hi, k.top - b.top);
  }
  return lo > 0 ? lo : hi;
}

/** The least move that shows one of `els` (whichever needs least): 0 if one is on screen already. */
function leastTravel(els: readonly Element[]) {
  const b = band();
  const keep = press?.keep?.isConnected ? press.keep.getBoundingClientRect() : null;
  let best = Infinity;
  for (const el of els) {
    const by = Math.round(travel(el.getBoundingClientRect(), keep, b));
    if (Math.abs(by) < Math.abs(best)) best = by;
  }
  return Number.isFinite(best) ? best : 0;
}

/** Once a smooth follow scroll has ended: words still short of the screen (the page grew under it) come on at once. */
function recheck(els: readonly Element[]) {
  dropCheck?.();
  let timer = 0;
  const done = () => {
    document.removeEventListener("scrollend", check);
    window.clearTimeout(timer);
    if (dropCheck === done) dropCheck = null;
  };
  const check = () => {
    done();
    if (press?.halted) return;
    const by = leastTravel(els.filter((e) => e.isConnected));
    if (by === 0) return;
    movedAt = performance.now();
    moved();
    window.scrollBy({ top: by, behavior: "instant" });
  };
  dropCheck = done;
  document.addEventListener("scrollend", check);
  // A browser without scrollend, or a scroll that never started.
  timer = window.setTimeout(check, 1500);
}

/**
 * Brings the words being said (`el`, or of several copies of them the one
 * that needs the least move) on screen when they are not, while `query`
 * matches (the stacked layout), as the rules above say. Call it only for
 * a run a press started. True when it moved the page: whatever now sits
 * under a resting mouse pointer was not pointed at (SCROLLED_MS).
 */
export function showSaid(
  el: Element | readonly (Element | null | undefined)[] | null | undefined,
  reduce: boolean,
  query = "all",
) {
  if (typeof window === "undefined" || press?.halted || !window.matchMedia(query).matches) return false;
  const els = (Array.isArray(el) ? el : [el]).filter((e): e is Element => !!e && e.isConnected);
  if (els.length === 0) return false;
  const by = leastTravel(els);
  if (by === 0) return false;
  movedAt = performance.now();
  moved();
  window.scrollBy({ top: by, behavior: reduce ? "instant" : "smooth" });
  if (!reduce) recheck(els);
  return true;
}

/** When a follow last moved the page (performance.now()); -Infinity if never. */
export const followMovedAt = () => movedAt;

/** The reader has scrolled by hand since the last press: nothing follows (and the page moving is theirs). */
export const followHalted = () => !!press?.halted;

/** How long after showSaid scrolled the page a pointer "entering" something is the page moving under it, not the hand. */
export const SCROLLED_MS = 1200;
