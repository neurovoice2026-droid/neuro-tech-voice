import type { gsap as GsapCore } from "gsap";
import type { ProcessStep, ProcessView } from "@/lib/pages/crm-erp";
import type { Kit } from "@/components/site/product/motion-kit";
import { holdFor } from "@/components/site/product/timing";
import { LAST, type StepIndex } from "./process-frame";
import { sheetPlace } from "./process-geometry";

/* ------------------------------------------------------------------ *
 * #process — the stage's GSAP timelines, as plain functions: the tour
 * (the page's one autoplay), the consolidation and its way back (the
 * sheets' flight between the two compositions), and the hop a reader's
 * own press on the hotspot plays.
 *
 * GSAP ONLY TRAVELS; REACT HOLDS EVERY FRAME. What the stage shows — the
 * view, which sheet is lit and which passed, which connectors are on,
 * the caption, the record's history, status and screen, the rail — is
 * React's, drawn from `frameOf` (process-frame.ts) as props and data
 * attributes. These timelines add only what happens between two frames,
 * and only on what React never writes: a sheet's flight, a
 * trace's dash, the travelling dot, the marks' pop and their flight into
 * the record's pill, the pill's pop, a ping, the rail's dwell. Each
 * change of frame is a callback — `onRewind`, `onConsolidate`,
 * `onEnter`, `onArrive`, `onDone` — and React draws it. When the stage's
 * context is reverted (a reader's hand, the window crossing lg, reduced
 * motion switched on) every inline style goes, and what is left is
 * React's frame, exactly.
 *
 * THE TOUR runs the journey once and never loops (SPEC §4.2.6):
 *   0. take back (only when the finished frame may have been seen): the
 *      lit traces fade, 0.3s, then the stage goes back to Today with the
 *      sheets flown back (`onRewind`; the flight is the stage's, 0.6s);
 *   1. Today: the "Typed again" marks pop, 0.15s apart, while the intro
 *      is read (`holdFor` of it, 4.66s);
 *   2. one system: `onConsolidate`, and the stage flies the sheets into
 *      their lanes (0.9s), the marks into the record's pill, and pops the
 *      pill (`buildConsolidate`, from the stage's layout effect, once
 *      React has committed the new place);
 *   3. step 01: the dot appears on its card and the step arrives; then
 *      each step after it: on its way (`onEnter`), the dot rides the one
 *      connector into it while its trace draws (0.6s), and it arrives
 *      (`onArrive`: the card lit, the caption, the history, the status
 *      and the screen) with a ping;
 *   4. the dwell: the rail's current fill runs 0 → 1 for as long as the
 *      step's "In one system" line takes to read (`holdFor`, 2.84–3.36s);
 * then a last beat, and `onDone`. About 36s, which the page's test
 * computes from the same data.
 *
 * MEASURED WHEN IT MOVES. Where a mark flies to (the pill) and where the
 * list's dot goes (a row's centre) are function-based values, read when
 * their tween first renders, not when the timeline is built, which may be
 * while the stage is a content-visibility box off the screen.
 *
 * WHAT A SECTION'S CSS MAY BE DOING. Every element GSAP moves here also
 * has a state CSS draws (a trace's colour, a mark's fade by view): each
 * run sets `transition: none` on what it moves while it moves it, and
 * hands it back afterwards, so a transition never drags GSAP's frames
 * behind it. The one exception is the marks' flight into the pill: the
 * drawing transitions only their opacity (erp-drawing.css §4), which
 * fades them out as they fly, and a `transition: none` would cancel that
 * fade and snap them out before they left. A trace drawn with `pathLength="1"` (the drawing's contract,
 * for home.css's draw) is drawn by its dash offset in those units, which
 * DrawSVG can't measure; one without it by DrawSVG.
 *
 * THE FLIGHTS MEASURE NO SHEET. Each view's place of every sheet is the
 * geometry's (process-geometry.ts `sheetPlace`), in pixels for the
 * composition's width, read once; a sheet's layout box never moves
 * (erp-drawing.css §2: each place is a transform of it), so the commit
 * that changes the view shifts no layout, and the flight is transforms
 * alone: the sheet's translate and turn, from where it was drawn to its
 * new place, and its backing's scale, from the size it was to its own.
 * Where it was drawn is its place in the view it left, or, when a flight
 * is cut short by another, where that flight had it (`placesNow`: GSAP's
 * own numbers, not a measure). No width or height is ever tweened, and
 * nothing is read between the writes.
 *
 * Client-only functions and no React. The kit that calls them has
 * registered DrawSVG and MotionPath (product/motion-kit.ts). The tour and
 * the hop run inside the stage's `useKitContext`, so a revert takes back
 * everything they did. The flights (`buildConsolidate`, `buildBack`) are
 * built after React's commit, outside it, and are never reverted: the
 * stage completes one it is done with (its end hands every sheet back to
 * its CSS place), and a new one starts from where the last had them.
 * ------------------------------------------------------------------ */

type Gsap = typeof GsapCore;
type Timeline = ReturnType<Gsap["timeline"]>;

/** Which composition is on show, and so which one GSAP moves: the lanes (lg and up) or the list. */
export type Comp = "lanes" | "list";

/** A sheet as drawn, in pixels in its composition: its box before the turn, and the turn about its centre (degrees). */
export type Place = { x: number; y: number; w: number; h: number; turn: number };

/** What a flight flies from: the composition, its width, each sheet's place as drawn (step order), and each step's lane (the lanes' index). */
export type Flight = { comp: Comp; width: number; from: readonly Place[]; lanes: readonly number[] };

/** The house out-ease, cubic-bezier(0.16, 1, 0.3, 1), as GSAP names its nearest. */
const HOUSE = "expo.out";

/** Every length the tour and the hand's motion take, in seconds (SPEC §4.2.6). */
export const TIMING = {
  /** The lit traces fading before the tour takes the frame back. */
  rewind: 0.3,
  /** The sheets flown back to Today. */
  back: { dur: 0.6, stagger: 0.03 },
  /** The sheets flown into one system: the last lands at 7 × 0.04 + 0.9 = 1.18s. */
  into: { dur: 0.9, stagger: 0.04 },
  /** A picked step's lit traces fading in once the last sheet has landed. */
  trace: 0.3,
  /** The consolidation, from its commit to the dot appearing on step 01. */
  consolidate: 1.6,
  /** The marks' pop in Today: from Today's start, each this long, this far apart. */
  pop: { at: 0.3, dur: 0.4, gap: 0.15 },
  /** The marks' flight into the pill: from the commit, each this long, this far apart. */
  fly: { at: 0.2, dur: 0.6, gap: 0.06 },
  /** The pill's pop, from the commit. */
  pill: { at: 0.9, dur: 0.3 },
  /** The dot appearing on step 01's card. */
  appear: 0.25,
  /** One hop: the dot riding a connector, the trace drawing under it. */
  hop: 0.6,
  /** A ping round the card that has arrived. */
  ping: 0.5,
  /** After an arrival, when GSAP lets go of the trace React now holds on (a commit lands a frame or two later). */
  letGo: 0.15,
  /** Before the first hop of a tour that carries on from a step. */
  beat: 0.2,
  /** After the last dwell, before the tour is done. */
  done: 0.6,
  /** After the consolidation's commit, when the marks' flight is handed back: the CSS fade by view is over by 0.9s. */
  landed: 1.2,
} as const;

/** A ping: how it grows and fades. */
const PING = { from: 0.96, to: 1.12, opacity: 0.6 } as const;

/** The two compositions' roots. */
const compOf = (root: ParentNode, comp: Comp) => root.querySelector(`.erp-${comp}`);

/** The eight sheets of the composition on show, in step order: the flights' targets. */
export const sheetsOf = (root: ParentNode, comp: Comp) => [...root.querySelectorAll<HTMLElement>(`.erp-${comp} .erp-sheet`)];

/** A sheet's backing: what a flight scales between the two sizes. */
const backingOf = (sheet: Element) => sheet.querySelector<HTMLElement>(".erp-sheet-bg");

/** The composition's width in pixels: the one length a flight reads. Zero while it isn't laid out. */
export const widthOf = (root: ParentNode, comp: Comp) => compOf(root, comp)?.clientWidth ?? 0;

/**
 * Where each sheet is drawn now: its place in `view` (the one the stage
 * is in, or flying to), or, while a flight is under way (`flying`), where
 * that flight has it: the translate and turn GSAP holds on the sheet, and
 * the scale on its backing, about the box of `view`'s size. GSAP's own
 * numbers, read from its cache: no sheet is measured.
 */
export function placesNow(gsap: Gsap, root: ParentNode, o: { comp: Comp; view: ProcessView; width: number; lanes: readonly number[]; flying: boolean }): Place[] {
  return sheetsOf(root, o.comp).map((sheet, i) => {
    const box = sheetPlace(o.comp, o.view, i, o.width, o.lanes);
    if (!o.flying) return box;
    const bg = backingOf(sheet);
    const n = (el: Element | null, p: string, rest: number) => (el ? Number(gsap.getProperty(el, p)) : rest);
    const [w, h] = [box.w * n(bg, "scaleX", 1), box.h * n(bg, "scaleY", 1)];
    const [cx, cy] = [n(sheet, "x", box.x) + box.w / 2, n(sheet, "y", box.y) + box.h / 2];
    return { x: cx - w / 2, y: cy - h / 2, w, h, turn: n(sheet, "rotation", box.turn) };
  });
}

/** What a flight wrote on a sheet and its backing: handed back at its end, when CSS holds the same place. */
const FLOWN = "transform,translate,rotate,scale";

/**
 * Flies every sheet from `o.from` to its place in `view`: from where it
 * was drawn (its centre, its turn, its size by its backing's scale) to
 * its new box, `stagger` apart. Every sheet's transform is read into
 * GSAP's cache before any is written, so nothing is read between the
 * writes. The lit card's own dot, on the edge of the card's box, waits
 * for the backing to reach it. At the end every inline style goes, and CSS
 * holds the same place.
 */
function fly(gsap: Gsap, tl: Timeline, root: ParentNode, o: Flight & { view: ProcessView; dur: number; stagger: number; ease: string }) {
  if (o.width <= 0) return;
  const sheets = sheetsOf(root, o.comp);
  const backs = sheets.map(backingOf);
  for (const el of [...sheets, ...backs]) if (el) gsap.getProperty(el, "x");
  sheets.forEach((sheet, i) => {
    const to = sheetPlace(o.comp, o.view, i, o.width, o.lanes);
    const from = o.from[i] ?? to;
    const at = i * o.stagger;
    const tween = { duration: o.dur, ease: o.ease, immediateRender: true };
    tl.fromTo(
      sheet,
      { x: from.x + from.w / 2 - to.w / 2, y: from.y + from.h / 2 - to.h / 2, rotation: from.turn },
      { x: to.x, y: to.y, rotation: to.turn, ...tween },
      at,
    );
    const bg = backs[i];
    if (bg) tl.fromTo(bg, { scaleX: from.w / to.w, scaleY: from.h / to.h }, { scaleX: 1, scaleY: 1, ...tween }, at);
  });
  const end = (sheets.length - 1) * o.stagger + o.dur;
  tl.set(
    [...sheets, ...backs].filter((el): el is HTMLElement => el !== null),
    { clearProps: FLOWN },
    end,
  );
  const dots = sheets.map((s) => s.querySelector(".erp-sheet-here")).filter((el): el is HTMLElement => el !== null);
  if (dots.length) {
    gsap.set(dots, { opacity: 0 });
    tl.set(dots, { clearProps: "opacity" }, end);
  }
}

/** The composition's hand-off marks, in hand-off order. */
function marksOf(root: ParentNode, comp: Comp) {
  const marks = [...root.querySelectorAll<HTMLElement>(`.erp-${comp} .erp-mark`)];
  return marks.sort((a, b) => Number(a.dataset.handoff ?? 0) - Number(b.dataset.handoff ?? 0));
}

/** An element's centre, in the viewport. */
function centre(el: Element) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** The rail's dwell for step `k`: the span its fill sits in, GSAP's alone (no rule scales it; erp-process.css §2). */
const runOf = (root: ParentNode, k: number) => root.querySelector<HTMLElement>(`[data-erp-run="${k}"]`);

/**
 * The ring that goes out round a card as its step arrives. On the lanes
 * the card; on the list, the row: the same sheet, laid out for One system.
 */
function ping(tl: Timeline, root: ParentNode, comp: Comp, step: ProcessStep, at: number) {
  const ring = root.querySelector(`.erp-${comp} .erp-sheet[data-step="${step.id}"] .erp-ping`);
  if (!ring) return;
  tl.set(ring, { transition: "none" }, at);
  tl.fromTo(
    ring,
    { opacity: PING.opacity, scale: PING.from },
    { opacity: 0, scale: PING.to, duration: TIMING.ping, ease: "power2.out", immediateRender: false },
    at,
  );
  tl.set(ring, { clearProps: "opacity,transform,transition" }, at + TIMING.ping);
}

/** A trace's dash, drawn from nothing to whole over `dur`: in its own units where it has pathLength="1", by DrawSVG otherwise. */
function drawTrace(tl: Timeline, trace: SVGPathElement, at: number, dur: number) {
  tl.set(trace, { transition: "none", opacity: 1 }, at);
  if (trace.getAttribute("pathLength") === "1") {
    tl.fromTo(
      trace,
      { strokeDasharray: "1 1", strokeDashoffset: 1 },
      { strokeDashoffset: 0, duration: dur, ease: "power2.inOut", immediateRender: false },
      at,
    );
  } else {
    tl.fromTo(trace, { drawSVG: "0% 0%" }, { drawSVG: "0% 100%", duration: dur, ease: "power2.inOut", immediateRender: false }, at);
  }
}

/** What GSAP wrote on a trace: handed back once React holds it on. */
const DRAWN = "opacity,strokeDasharray,strokeDashoffset,transition";

/**
 * The dot rides into step `k`, from `at`, and the trace under it draws;
 * the dot hides as it lands, and the card pings. Returns the arrival.
 * On the lanes it rides connector k − 1 (`#erp-c-<k−1>`) by MotionPath;
 * on the list it drops by `y` from row k − 1's centre to row k's.
 */
function ride(gsap: Gsap, tl: Timeline, root: ParentNode, o: { comp: Comp; steps: readonly ProcessStep[]; to: StepIndex; at: number }) {
  const { comp, to, at } = o;
  const box = compOf(root, comp);
  const dot = box?.querySelector<HTMLElement | SVGElement>(".erp-dot");
  const land = at + TIMING.hop;
  if (comp === "lanes") {
    const path = box?.querySelector<SVGPathElement>(`#erp-c-${to - 1}`);
    const trace = box?.querySelector<SVGPathElement>(`.erp-trace[data-edge="${to - 1}"]`);
    if (trace) drawTrace(tl, trace, at, TIMING.hop);
    if (dot && path) {
      tl.set(dot, { transition: "none", opacity: 1, scale: 1 }, at);
      tl.to(
        dot,
        { motionPath: { path, align: path, alignOrigin: [0.5, 0.5], autoRotate: false }, duration: TIMING.hop, ease: "power2.inOut" },
        at,
      );
      tl.set(dot, { opacity: 0 }, land);
    }
    if (trace) tl.set(trace, { clearProps: DRAWN }, land + TIMING.letGo);
  } else if (dot) {
    const row = (k: number) => box?.querySelector(`.erp-sheet[data-step="${o.steps[k].id}"]`);
    // The dot's `y` that puts its centre on row k's: measured as the tween starts.
    const yAt = (k: number) => {
      const r = row(k);
      if (!r) return 0;
      return Number(gsap.getProperty(dot, "y")) + (centre(r).y - centre(dot).y);
    };
    tl.set(dot, { transition: "none", opacity: 1, scale: 1, y: () => yAt(to - 1) }, at);
    tl.to(dot, { y: () => yAt(to), duration: TIMING.hop, ease: "power2.inOut" }, at);
    tl.set(dot, { opacity: 0 }, land);
  }
  ping(tl, root, comp, o.steps[to], land);
  return land;
}

/** Step 01's arrival: the dot appears on its card (on the lanes, at the head of the first connector), and hides as the step arrives. */
function appear(gsap: Gsap, tl: Timeline, root: ParentNode, o: { comp: Comp; steps: readonly ProcessStep[]; at: number }) {
  const box = compOf(root, o.comp);
  const dot = box?.querySelector<HTMLElement | SVGElement>(".erp-dot");
  const land = o.at + TIMING.appear;
  if (dot) {
    if (o.comp === "lanes") {
      const path = box?.querySelector<SVGPathElement>("#erp-c-0");
      if (path) {
        tl.set(dot, { motionPath: { path, align: path, alignOrigin: [0.5, 0.5], start: 0, end: 0 } }, o.at);
      }
    } else {
      const first = box?.querySelector(`.erp-sheet[data-step="${o.steps[0].id}"]`);
      tl.set(
        dot,
        { y: () => (first ? Number(gsap.getProperty(dot, "y")) + (centre(first).y - centre(dot).y) : 0) },
        o.at,
      );
    }
    tl.set(dot, { transition: "none" }, o.at);
    tl.fromTo(dot, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: TIMING.appear, ease: HOUSE, immediateRender: false }, o.at);
    tl.set(dot, { opacity: 0 }, land);
  }
  ping(tl, root, o.comp, o.steps[0], land);
  return land;
}

/** The marks' pop in Today: each grows from 60%, 0.15s after the one before. */
function popMarks(tl: Timeline, root: ParentNode, comp: Comp, at: number) {
  const marks = marksOf(root, comp);
  if (!marks.length) return;
  tl.set(marks, { transition: "none" }, at);
  marks.forEach((m, i) => {
    tl.fromTo(m, { scale: 0.6 }, { scale: 1, duration: TIMING.pop.dur, ease: HOUSE, immediateRender: false }, at + i * TIMING.pop.gap);
  });
  const end = at + (marks.length - 1) * TIMING.pop.gap + TIMING.pop.dur;
  tl.set(marks, { clearProps: "transform,transition" }, end);
}

/**
 * The consolidation, once React has committed One system: the sheets fly
 * from where they were drawn into their lanes (or their rows), the
 * "Typed again" marks fly into the record's pill and go (the drawing's
 * CSS fades them by view; the flight only moves them), and the pill
 * pops as they reach it. Built playing, by the stage's layout effect.
 */
export function buildConsolidate(kit: Kit, root: HTMLElement, o: Flight): Timeline {
  const { gsap } = kit;
  const tl = gsap.timeline();
  fly(gsap, tl, root, { ...o, view: "one", dur: TIMING.into.dur, stagger: TIMING.into.stagger, ease: "power3.inOut" });
  // The traces a picked step has on (Today at step 08, then One system): held
  // back until the last sheet lands, as the lit card's own dot is, then faded
  // to their state's (on, or faint on the way) and handed back to the frame.
  // Set before the first paint: this runs in the stage's layout effect.
  const traces = [...root.querySelectorAll<SVGPathElement>(`.erp-${o.comp} .erp-trace:not([data-state="rest"])`)];
  if (traces.length && o.width > 0) {
    const landed = (sheetsOf(root, o.comp).length - 1) * TIMING.into.stagger + TIMING.into.dur;
    gsap.set(traces, { opacity: 0, transition: "none" });
    tl.to(
      traces,
      { opacity: (_: number, el: Element) => (el.getAttribute("data-state") === "route" ? 0.4 : 1), duration: TIMING.trace, ease: HOUSE },
      landed,
    );
    tl.set(traces, { clearProps: "opacity,transition" }, landed + TIMING.trace);
  }
  const pill = root.querySelector<HTMLElement>(".erp-pill");
  const marks = marksOf(root, o.comp);
  if (pill && marks.length) {
    // Their opacity is left to the drawing's CSS (it fades them from 0.6s as the view changes, a transition
    // on opacity alone): stopping their transition here would snap them out before they leave.
    marks.forEach((m, i) => {
      const at = TIMING.fly.at + i * TIMING.fly.gap;
      tl.to(
        m,
        {
          x: () => Number(gsap.getProperty(m, "x")) + (centre(pill).x - centre(m).x),
          y: () => Number(gsap.getProperty(m, "y")) + (centre(pill).y - centre(m).y),
          scale: 0.4,
          duration: TIMING.fly.dur,
          ease: "power2.in",
        },
        at,
      );
    });
    tl.set(marks, { clearProps: "transform" }, TIMING.landed);
  }
  if (pill) {
    tl.fromTo(pill, { scale: 0.6 }, { scale: 1, duration: TIMING.pill.dur, ease: HOUSE, immediateRender: false }, TIMING.pill.at);
    tl.set(pill, { clearProps: "transform" }, TIMING.pill.at + TIMING.pill.dur);
  }
  return tl;
}

/** The way back: the sheets fly from where they were drawn back to Today's scatter (or pile). The marks fade in by CSS. */
export function buildBack(kit: Kit, root: HTMLElement, o: Flight): Timeline {
  const tl = kit.gsap.timeline();
  fly(kit.gsap, tl, root, { ...o, view: "today", dur: TIMING.back.dur, stagger: TIMING.back.stagger, ease: "power3.out" });
  return tl;
}

/**
 * The hop a reader's press on the hotspot plays: the dot rides into step
 * `to` and the step arrives. Built playing: the reader asked for it.
 */
export function buildHop(
  gsap: Gsap,
  root: HTMLElement,
  o: { comp: Comp; steps: readonly ProcessStep[]; to: StepIndex; onArrive: () => void },
): Timeline {
  const tl = gsap.timeline();
  const land = ride(gsap, tl, root, { comp: o.comp, steps: o.steps, to: o.to, at: 0 });
  tl.call(o.onArrive, undefined, land);
  return tl;
}

/** Hands the rail's dwell back to the frame: whatever a run left on its span goes (React writes no style there). */
export function letGoOfDwell(root: ParentNode) {
  for (const run of root.querySelectorAll<HTMLElement>("[data-erp-run]")) run.removeAttribute("style");
}

export type TourOptions = {
  steps: readonly ProcessStep[];
  comp: Comp;
  /** Where it takes up: "today" for the whole journey, or the step the order is at, to carry on from the step after. */
  from: "today" | StepIndex;
  /** The finished frame on screen may have been seen: fade its lit traces, and fly back to Today. */
  rewind: boolean;
  /** The intro's words, read by holdFor: Today's dwell. */
  intro: string;
  onStart?: () => void;
  /** Back to Today, before a step (the stage flies the sheets back). */
  onRewind: () => void;
  /** Today's first frame: the intro, no step picked. */
  onToday: () => void;
  /** One system, step 01 on its way (the stage flies the sheets and the marks). */
  onConsolidate: () => void;
  /** Step k on its way: its card and the connector into it on the route. */
  onEnter: (k: StepIndex) => void;
  /** Step k has arrived. */
  onArrive: (k: StepIndex) => void;
  onDone: () => void;
};

/** Holds, in seconds: the time a line takes to read (product/timing.ts). */
const readFor = (text: string) => holdFor(text) / 1000;

/** The whole tour, built paused: the stage decides when it plays. */
export function buildTour(gsap: Gsap, root: HTMLElement, o: TourOptions): Timeline {
  const tl = gsap.timeline({ paused: true, onStart: o.onStart });
  // The step the order is at, and when its dwell starts (null: none, the tour carries on from it at once).
  let k: StepIndex;
  let dwellAt: number | null;

  if (o.from === "today") {
    let t = 0;
    if (o.rewind) {
      const lit = [...root.querySelectorAll(`.erp-${o.comp} .erp-trace[data-state="on"]`)];
      if (lit.length) {
        tl.set(lit, { transition: "none" }, 0);
        tl.fromTo(lit, { opacity: 1 }, { opacity: 0, duration: TIMING.rewind, ease: "power1.in", immediateRender: false }, 0);
      }
      tl.call(o.onRewind, undefined, TIMING.rewind);
      // Hidden by the frame once in Today (every edge at rest): handed back after the commit.
      if (lit.length) tl.set(lit, { clearProps: "opacity,transition" }, TIMING.rewind + TIMING.letGo);
      t = TIMING.rewind + TIMING.back.dur;
    } else {
      tl.call(o.onToday, undefined, 0);
    }
    // Today: the marks pop while the intro is read.
    popMarks(tl, root, o.comp, t + TIMING.pop.at);
    t += readFor(o.intro);
    tl.call(o.onConsolidate, undefined, t);
    // Step 01's dwell starts empty from the consolidation on: the rail checks it as the sheets fly.
    const first = runOf(root, 0);
    if (first) tl.set(first, { scaleX: 0 }, t);
    t += TIMING.consolidate;
    const land = appear(gsap, tl, root, { comp: o.comp, steps: o.steps, at: t });
    tl.call(() => o.onArrive(0), undefined, land);
    k = 0;
    dwellAt = land;
  } else {
    // Carrying on from a step the reader picked: after a beat, straight on to the next.
    k = o.from;
    dwellAt = null;
  }

  // Each step's dwell (the rail's fill running for as long as its line takes to read), then the hop into the next.
  let t = dwellAt ?? TIMING.beat;
  for (;;) {
    const run = runOf(root, k);
    if (dwellAt !== null) {
      const dwell = readFor(o.steps[k].system);
      if (run) tl.to(run, { scaleX: 1, duration: dwell, ease: "none" }, t);
      t += dwell;
    }
    if (k === LAST) {
      if (run) tl.set(run, { clearProps: "transform" }, t + TIMING.done);
      tl.call(o.onDone, undefined, t + TIMING.done);
      break;
    }
    const next = (k + 1) as StepIndex;
    // This step's fill is the frame's now (passed); the next one's starts empty.
    if (run) tl.set(run, { clearProps: "transform" }, t);
    const nextRun = runOf(root, next);
    if (nextRun) tl.set(nextRun, { scaleX: 0 }, t);
    tl.call(() => o.onEnter(next), undefined, t);
    const land = ride(gsap, tl, root, { comp: o.comp, steps: o.steps, to: next, at: t });
    tl.call(() => o.onArrive(next), undefined, land);
    t = land;
    k = next;
    dwellAt = land;
  }
  return tl;
}

/** The tour's length from Today, in seconds, as the timeline above lays it out (the page's test holds the spec's sum under 40s). */
export function tourLength(steps: readonly ProcessStep[], intro: string) {
  return (
    readFor(intro) +
    TIMING.consolidate +
    TIMING.appear +
    (steps.length - 1) * TIMING.hop +
    steps.reduce((sum, s) => sum + readFor(s.system), 0) +
    TIMING.done
  );
}
