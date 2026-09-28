import type { Answer, EdgeId, GoId, Move, PartId, Platform, ScreenId, Step, StepId } from "@/lib/pages/custom-mobile-applications";

/* ------------------------------------------------------------------ *
 * #hold — what the phone and the parts beside it show, as a pure
 * function of where the reader is: `frameOf(steps, hold)`.
 *
 * THE FRAME IS NEVER STORED. The stage keeps four small values — the
 * platform, the step, the answer to the notifications question, and
 * whether the step has arrived — and draws whatever this returns, on the
 * server and on every render after. So the finished frame the server
 * paints for readers without script, with reduced motion, on the still
 * tier, on weak hardware and on lite before a tap (iOS, the reminder on
 * the lock screen, notifications allowed, the parts it came through lit)
 * is the same frame the tour lands on, and a reader who picks a step by
 * hand gets exactly what the tour would have shown there. GSAP only adds
 * the travel between two frames (phone-timeline.ts); it never holds one.
 *
 * A STEP, TWICE. Each step is drawn first on its way (`arrived: false`:
 * the screen is there, and the parts and lines it will reach are marked
 * `route`, a faint electric) and then arrived (`arrived: true`: those
 * parts `lit` and those lines `on`). On the lock screen, arriving is
 * also the reminder landing: the notification is simply not there until
 * it does, and the picture is the same height either way. The tour sets
 * the first as it changes the screen and the second when its dot lands;
 * a press without motion sets both at once.
 *
 * THE ANSWER. The permission dialog stands over "You’re booked" while
 * the answer is null; "Allow" and "Don’t allow" send the reader to the
 * lock screen with it, where it decides which reminder lands — the
 * notification, through push, or the text this platform really sends,
 * through its own texts — and so which lines light and which caption is
 * read (the sixth, the step's `deny`). Opening the reminder goes back to
 * "You’re booked" with the answer kept, so the dialog does not ask
 * again.
 *
 * AN EDGE'S ENDS are in its id, `${from}-${to}` (the data module's
 * EdgeId, parts-geometry.ts EDGES), "phone" being the app itself. A step
 * talks to the far ends of its hops, in the order the hops reach them,
 * the phone left out, and then to the parts it only rings (`ring`: step
 * 4 asks about notifications, so it rings push without travelling to
 * it).
 *
 * PURE: no React, no DOM, types only from the server-only data module.
 * The stage, the timeline, the index (hold.tsx) and the page's test all
 * read the same answers from here.
 * ------------------------------------------------------------------ */

/** A step's index: 0 (sign in) to 4 (the reminder). */
export type StepIndex = 0 | 1 | 2 | 3 | 4;

/** Where the reader is. */
export type Hold = { platform: Platform; step: StepIndex; answer: Answer | null; arrived: boolean };

/** How a part or a line reads in a frame (mob-hold.css reads it as `data-state`). */
export type PartState = "rest" | "route" | "lit";
export type EdgeState = "rest" | "route" | "on";

export type Frame = {
  screen: ScreenId;
  /** The answer the device draws: null on "You’re booked" puts the dialog up; on the lock screen, never null. */
  answer: Answer | null;
  arrived: boolean;
  /** Which of the six captions is live: a step's index, or 5 for the reminder by text. */
  caption: number;
  hops: readonly EdgeId[];
  ring: readonly PartId[];
  parts: Record<PartId, PartState>;
  edges: Record<EdgeId, EdgeState>;
  /** The parts this step talks to: the hops' far ends in travel order, the phone left out, the ring last. */
  talks: readonly PartId[];
};

/** Every part, in the data module's PARTS order: the lane's rows and the chips' cells. */
export const PART_IDS = ["signin", "api", "data", "payments", "files", "live", "jobs", "messages", "push"] as const satisfies readonly PartId[];

/** Every edge of the drawing (parts-geometry.ts EDGES holds each one's path). */
export const EDGE_IDS = [
  "phone-signin",
  "phone-api",
  "phone-payments",
  "live-phone",
  "push-phone",
  "messages-phone",
  "signin-data",
  "api-data",
  "payments-api",
  "data-live",
  "jobs-data",
  "jobs-push",
  "jobs-messages",
  "data-files",
] as const satisfies readonly EdgeId[];

/** The last step: the reminder, on the lock screen. */
export const LAST: StepIndex = 4;

/** The step the dialog asks on ("You’re booked"). */
const ASK: StepIndex = 3;

/**
 * The finished frame: iOS, the reminder landed on the lock screen, with
 * notifications allowed. The server's HTML, and what reduced motion, the
 * still tier, weak hardware, lite before a tap and no JavaScript all get.
 * (The data module's `MOB_HOLD.initial` names the same place: `holdOf`.)
 */
export const FINISHED: Hold = { platform: "ios", step: 4, answer: "allow", arrived: true };

/** A step's index from its id. Throws on an id the steps don't have: a typo must not draw an empty phone. */
export function indexOf(steps: readonly Step[], id: StepId): StepIndex {
  const i = steps.findIndex((s) => s.id === id);
  if (i < 0 || i > LAST) throw new Error(`phone: no step "${id}"`);
  return i as StepIndex;
}

/** The place the data module opens on (`MOB_HOLD.initial`), arrived. */
export function holdOf(steps: readonly Step[], initial: { platform: Platform; step: StepId; answer: Answer }): Hold {
  return { platform: initial.platform, step: indexOf(steps, initial.step), answer: initial.answer, arrived: true };
}

/** An edge's two ends, "phone" being the app itself. */
export function endsOf(edge: EdgeId): readonly [PartId | "phone", PartId | "phone"] {
  const [from, to] = edge.split("-") as [PartId | "phone", PartId | "phone"];
  return [from, to];
}

/** On the lock screen there is always an answer: a step reached with none is the notification allowed. */
function answerAt(step: StepIndex, answer: Answer | null): Answer | null {
  return step === LAST ? (answer ?? "allow") : answer;
}

const denied = (step: StepIndex, answer: Answer | null) => step === LAST && answerAt(step, answer) === "deny";

/** The hops a step travels: on the lock screen, the text's when the reader said no. */
export function hopsOf(steps: readonly Step[], s: Pick<Hold, "step" | "answer">): readonly EdgeId[] {
  const step = steps[s.step];
  return denied(s.step, s.answer) && step.deny ? step.deny.hops : step.hops;
}

/** The parts a step talks to: the hops' far ends in travel order, the phone left out, then what it rings. */
export function talksOf(steps: readonly Step[], s: Pick<Hold, "step" | "answer">): PartId[] {
  const out: PartId[] = [];
  const add = (p: PartId | "phone") => {
    if (p !== "phone" && !out.includes(p)) out.push(p);
  };
  for (const edge of hopsOf(steps, s)) endsOf(edge).forEach(add);
  for (const p of steps[s.step].ring ?? []) add(p);
  return out;
}

/** Each part as a frame reads it: the step's own parts on the route, lit once it has arrived, the rest at rest. */
export function partsOf(steps: readonly Step[], s: Pick<Hold, "step" | "answer" | "arrived">): Record<PartId, PartState> {
  const talks = new Set(talksOf(steps, s));
  const on: PartState = s.arrived ? "lit" : "route";
  return Object.fromEntries(PART_IDS.map((p) => [p, talks.has(p) ? on : "rest"])) as Record<PartId, PartState>;
}

/** What the phone and the parts beside it show at `s`. */
export function frameOf(steps: readonly Step[], s: Hold): Frame {
  const step = steps[s.step];
  if (!step) throw new Error(`phone: no step at ${s.step}`);
  const hops = hopsOf(steps, s);
  const travelled = new Set<EdgeId>(hops);
  const on: EdgeState = s.arrived ? "on" : "route";
  return {
    screen: step.screen,
    answer: answerAt(s.step, s.answer),
    arrived: s.arrived,
    caption: denied(s.step, s.answer) ? steps.length : s.step,
    hops,
    ring: step.ring ?? [],
    parts: partsOf(steps, s),
    edges: Object.fromEntries(EDGE_IDS.map((e) => [e, travelled.has(e) ? on : "rest"])) as Record<EdgeId, EdgeState>,
    talks: talksOf(steps, s),
  };
}

/**
 * Where each hotspot goes, and the move the phone makes getting there.
 * The next place is always on its way (`arrived: false`): the stage lands
 * it at once without motion, or when the hops have played with it.
 */
export const GO: Record<GoId, (s: Hold) => { next: Hold; move: Move }> = {
  "signin.go": (s) => ({ next: { ...s, step: 1, arrived: false }, move: "mob-forward" }),
  "choose.go": (s) => ({ next: { ...s, step: 2, arrived: false }, move: "mob-sheet-up" }),
  "pay.back": (s) => ({ next: { ...s, step: 1, arrived: false }, move: "mob-sheet-down" }),
  "pay.go": (s) => ({ next: { ...s, step: ASK, answer: null, arrived: false }, move: "mob-forward" }),
  "booked.allow": (s) => ({ next: { ...s, step: LAST, answer: "allow", arrived: false }, move: "mob-lock" }),
  "booked.deny": (s) => ({ next: { ...s, step: LAST, answer: "deny", arrived: false }, move: "mob-lock" }),
  // Back to "You’re booked" with the answer kept: the dialog doesn't ask again.
  "lock.open": (s) => ({ next: { ...s, step: ASK, arrived: false }, move: "mob-unlock" }),
};

/** The move a hotspot makes, wherever it is pressed from. */
export const moveOf = (go: GoId): Move => GO[go](FINISHED).move;

/** The move each pair of neighbouring steps makes, forwards and back: the hotspots' own. */
const NEIGHBOURS: Record<string, Move> = {
  "0>1": "mob-forward",
  "1>0": "mob-back",
  "1>2": "mob-sheet-up",
  "2>1": "mob-sheet-down",
  "2>3": "mob-forward",
  "3>2": "mob-back",
  "3>4": "mob-lock",
  "4>3": "mob-unlock",
};

/**
 * The move between two places: a platform switch morphs the phone; a
 * neighbouring step makes its hotspot's move; any other step slides
 * forward or back.
 */
export function moveBetween(from: Hold, to: Hold): Move {
  if (from.platform !== to.platform) return "mob-platform";
  return NEIGHBOURS[`${from.step}>${to.step}`] ?? (to.step < from.step ? "mob-back" : "mob-forward");
}

/**
 * A step picked on the rail: on its way, with the answer it asks for.
 * "You’re booked" puts the question up again (its caption says it is
 * asked); the reminder keeps the answer given, or allows, with none;
 * the others keep whatever was said.
 */
export function pickStep(s: Hold, step: StepIndex): Hold {
  const answer = step === ASK ? null : answerAt(step, s.answer);
  return { ...s, step, answer, arrived: false };
}

/** A step's number as the rail prints it: two figures, "03". */
export const pad2 = (n: number) => String(n).padStart(2, "0");
