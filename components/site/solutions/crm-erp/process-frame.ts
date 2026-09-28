import type { ProcessData, ProcessStep, ProcessView, StepId } from "@/lib/pages/crm-erp";

/* ------------------------------------------------------------------ *
 * #process — what the drawing, the rail, the caption card and the
 * record window show, as a pure function of where the reader is:
 * `frameOf(steps, state)`.
 *
 * THE FRAME IS NEVER STORED. The stage keeps three small values — the
 * view (Today or One system), the step (or none, in Today, before one is
 * picked) and whether that step has arrived — and draws whatever this
 * returns, on the server and on every render after. So the finished
 * frame the server paints for readers without script, with reduced
 * motion, on the still tier, on weak hardware and on lite before a tap
 * (One system, the order followed to the month's figures, every card
 * passed and the last one lit, every connector on, every history row
 * reached) is the same frame the tour lands on, and a reader who picks a
 * step by hand gets exactly what the tour would have shown there. GSAP
 * only adds the travel between two frames (process-timeline.ts): the
 * sheets' flight between the two compositions, a trace drawing, the dot
 * riding it, a ping, the rail's dwell. It never holds one.
 *
 * TODAY. The sample's eight tools, scattered: no connector is drawn, so
 * every edge is at rest; the picked step's paper is ringed (`lit`), the
 * rest at rest. Before a step is picked the caption card reads the
 * intro. The record window behind Today's panel (the record panel is a
 * stack of its two views, as tall as the taller) keeps One system's
 * rows, status and screen at the same step, so a switch back finds the
 * order where it was; with none picked, step 01's on its way.
 *
 * ONE SYSTEM, STEP k. The sheets before k are passed (`visited`), k is
 * lit once it has arrived (`route` while the dot is on its way to it),
 * the ones after it at rest; the connectors behind it are on, the one
 * into it on once it has arrived (`route` on the way); the history's
 * rows before it are reached, its own current once it has arrived; the
 * order's status is k's once it has arrived, the step before's on the
 * way. The caption card, the status chip and the window's screen all
 * change on the arrival, together, with the card lighting: one beat, as
 * the dot lands. So a step on its way still shows the last one's words,
 * status and screen (step 01 on its way, from the consolidation, shows
 * its own: there is nothing before it).
 *
 * PURE: no React, no DOM, types only from the server-only data module.
 * The stage, the timeline, the drawing (process-lanes.tsx,
 * process-list.tsx), the index (process.tsx) and the page's test all
 * read the same answers from here.
 * ------------------------------------------------------------------ */

/** What the stage is handed: everything #process's data holds but the index and the foot, which the server draws. */
export type StageData = Omit<ProcessData, "indexSummary" | "index" | "foot">;

/** A step's index: 0 (the enquiry) to 7 (the month's figures). */
export type StepIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Where the reader is. `step` is null only in Today, before a step is picked (the intro caption). */
export type ProcessState = { view: ProcessView; step: StepIndex | null; arrived: boolean };

/** How a sheet reads (the drawing's `data-state`): at rest, the step on its way, the step itself, a step passed. */
export type SheetState = "rest" | "route" | "lit" | "visited";
/** How a connector's trace reads: hidden, faint on the way, on. */
export type EdgeState = "rest" | "route" | "on";
/** How a row of the record's history reads. */
export type RowState = "reached" | "current" | "tocome";

export type DrawFrame = {
  view: ProcessView;
  /** Which of the caption card's nine variants is live: 0 the intro, 1–8 a step. */
  caption: number;
  /** By step. */
  sheets: readonly SheetState[];
  /** Seven: edge i joins step i and step i + 1. */
  edges: readonly EdgeState[];
  /** The record's history, by step. */
  rows: readonly RowState[];
  /** The step whose status the chip shows. */
  status: StepIndex;
  /** The screen the record window shows. */
  screen: StepIndex;
  /** The rail: the radio checked (none in Today before a pick), and each dwell track full or empty. */
  rail: { checked: StepIndex | null; filled: readonly boolean[] };
};

/** Eight steps; seven connectors between them. */
export const STEP_COUNT = 8;
export const EDGE_COUNT = STEP_COUNT - 1;
/** The last step: the month's figures. */
export const LAST: StepIndex = 7;

/** Today, before a step is picked: the tour's first frame, and where "Start again" goes. */
export const START: ProcessState = { view: "today", step: null, arrived: true };

/**
 * The finished frame: One system, step 08 arrived. The server's HTML, and
 * what reduced motion, the still tier, weak hardware, lite before a tap
 * and no JavaScript all get (the data module's `ERP_PROCESS.initial`
 * names the same place: `stateOf`).
 */
export const FINISHED: ProcessState = { view: "one", step: LAST, arrived: true };

/** A step's number as the rail, the cards and the index print it: two figures, "03". */
export const pad2 = (n: number) => String(n).padStart(2, "0");

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** A step's index from its id. Throws on an id the steps don't have: a typo must not draw an empty stage. */
export function indexOf(steps: readonly ProcessStep[], id: StepId): StepIndex {
  const i = steps.findIndex((s) => s.id === id);
  if (i < 0 || i > LAST) throw new Error(`process: no step "${id}"`);
  return i as StepIndex;
}

/** The place the data module opens on (`ERP_PROCESS.initial`), arrived. */
export function stateOf(steps: readonly ProcessStep[], initial: { view: ProcessView; step: StepId }): ProcessState {
  return { view: initial.view, step: indexOf(steps, initial.step), arrived: true };
}

/** One system at step k: the history, the status, the screen and the rail, which Today keeps too. */
function recordAt(k: StepIndex, arrived: boolean) {
  const shown: StepIndex = arrived ? k : (Math.max(0, k - 1) as StepIndex);
  return {
    rows: range(STEP_COUNT).map((i): RowState => (i < k ? "reached" : i === k && arrived ? "current" : "tocome")),
    status: shown,
    screen: shown,
    caption: shown + 1,
    rail: { checked: k, filled: range(STEP_COUNT).map((i) => i <= k) },
  };
}

/** What the stage shows at `s`. */
export function frameOf(steps: readonly ProcessStep[], s: ProcessState): DrawFrame {
  if (steps.length !== STEP_COUNT) throw new Error(`process: ${steps.length} steps, not ${STEP_COUNT}`);
  if (s.view === "today") {
    const at = s.step;
    // Before a pick: step 01 on its way behind the Today panel, no radio checked, no track full.
    const rec = recordAt(at ?? 0, at === null ? false : s.arrived);
    return {
      view: "today",
      caption: at === null ? 0 : at + 1,
      sheets: range(STEP_COUNT).map((i): SheetState => (i === at ? "lit" : "rest")),
      edges: range(EDGE_COUNT).map((): EdgeState => "rest"),
      rows: rec.rows,
      status: rec.status,
      screen: rec.screen,
      rail: at === null ? { checked: null, filled: range(STEP_COUNT).map(() => false) } : rec.rail,
    };
  }
  // One system with no step (never set by the stage, which switches to step 01): step 01 arrived.
  const k: StepIndex = s.step ?? 0;
  const arrived = s.step === null ? true : s.arrived;
  const rec = recordAt(k, arrived);
  return {
    view: "one",
    caption: rec.caption,
    sheets: range(STEP_COUNT).map((i): SheetState => (i < k ? "visited" : i === k ? (arrived ? "lit" : "route") : "rest")),
    edges: range(EDGE_COUNT).map((i): EdgeState => (i < k - 1 ? "on" : i === k - 1 ? (arrived ? "on" : "route") : "rest")),
    rows: rec.rows,
    status: rec.status,
    screen: rec.screen,
    rail: rec.rail,
  };
}

/** A rail pick: that step in the current view, arrived at once. No travel. */
export function pickStep(s: ProcessState, k: StepIndex): ProcessState {
  return { ...s, step: k, arrived: true };
}

/**
 * The View switch: the other view at the same step. One system from
 * Today's intro opens on step 01, arrived: the journey's start.
 */
export function switchView(s: ProcessState, view: ProcessView): ProcessState {
  if (view === s.view) return s;
  return { view, step: view === "one" ? (s.step ?? 0) : s.step, arrived: true };
}

/**
 * The hotspot (One system only): the order moves on to the next step,
 * on its way along the one connector into it (`hop`, the step it rides
 * to). From step 08 it goes back to 01 with no hop, arrived.
 */
export function nextStep(s: ProcessState): { next: ProcessState; hop: StepIndex | null } {
  const k = s.step ?? LAST;
  if (k === LAST) return { next: { view: "one", step: 0, arrived: true }, hop: null };
  const to = (k + 1) as StepIndex;
  return { next: { view: "one", step: to, arrived: false }, hop: to };
}

/** The frame a state lands on: the same place, arrived. */
export const arrive = (s: ProcessState): ProcessState => (s.arrived ? s : { ...s, arrived: true });
