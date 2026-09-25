import type {
  BlockKind,
  ManualId,
  RunEdge,
  RunGroupId,
  RunLens,
  RunLensId,
  RunNode,
} from "@/lib/pages/custom-automations";

/* ------------------------------------------------------------------ *
 * #running — what the workbench shows, as a pure function of where the
 * reader is: `frameOf(lens, { phase, step, laid })`.
 *
 * THE FRAME IS NEVER STORED. The workbench keeps a few small values (the
 * lens, the phase, the step, and while a flow is being built the blocks
 * laid so far) and draws whatever this returns, on the server and on
 * every render after. So the finished frame the server paints for
 * readers without script, with reduced motion, on the still tier, on
 * weak hardware and on lite before a tap — "A customer pays", built, on
 * its last step, "Marked done" current and every manual step handed over
 * — is the same frame the tour lands on, and a reader who picks a step
 * by hand gets exactly what the tour would have shown there. GSAP only
 * ever adds the travel between two frames (workbench-timeline.ts); it
 * never holds one.
 *
 * THE TWO PHASES, and the build between them:
 *   hand    the steps a person does, in their tools: nothing built yet,
 *           every block a dashed ghost, no line drawn, no step handed
 *           over, and the caption says how many steps across how many
 *           tools;
 *   built   the flow that does them: each block laid, each manual step
 *           handed to the first block that replaced it (its disc in the
 *           lane turns electric and says "now step 03"), and the run
 *           travelling it step by step.
 * While the tour builds the flow, `laid` names the blocks laid so far —
 * one at a time, in path order (`pathOrder`: left to right on the map,
 * top to bottom in the list) — and the rest are still ghosts; a manual
 * step is handed over once the block it lands in is laid. Everywhere
 * else `laid` is left out, and every block is laid.
 *
 * WHAT A FRAME SAYS, block by block and line by line:
 *   current    the block the step arrived at: its last hop's far end, or
 *              the first block a ring-only step pulses (a hop into a
 *              group — the morning lens's "Side by side" — arrives at
 *              that step's ring); null before the first step
 *   passed     every block the run reached before this one
 *   route      every block the run reaches at all, and each group it
 *              enters: the path, marked before it is travelled
 *   traversed  the lines hopped up to and including this step
 *   entered    the groups the run has entered so far
 *   handed     the manual steps already handed to a block
 *   nowStep    where each manual step lands: the first step of the run
 *              whose current block replaced it, 1-based (it never
 *              changes; the lane shows it once the step is handed over)
 *   laid       the blocks laid; `building` while some are still ghosts
 *
 * STEP −1 is "about to run": the flow built and its route marked, and
 * nothing travelled yet. The tour sits there between the build and the
 * first hop; it is never a resting frame the reader is left on.
 *
 * PURE: no React and no DOM, types only from the server-only data
 * module. lib/pages/custom-automations.test.ts imports it under vitest
 * and holds `nowSteps`, the finished frame and the meters' order to the
 * build spec. The server section (running.tsx, the index) reads
 * `pathOrder` and `branchOf` from here too, so the index lists the
 * blocks in the order the list and the map lay them.
 * ------------------------------------------------------------------ */

export type Phase = "hand" | "built";

/** Where the reader is: the phase, the step (−1 before the first), and, mid-build, the blocks laid so far. */
export type Place = { phase: Phase; step: number; laid?: ReadonlySet<string> | null };

export type Frame = {
  phase: Phase;
  step: number;
  current: string | null;
  passed: ReadonlySet<string>;
  route: ReadonlySet<string>;
  traversed: ReadonlySet<string>;
  entered: ReadonlySet<string>;
  handed: ReadonlySet<ManualId>;
  nowStep: Readonly<Partial<Record<ManualId, number>>>;
  laid: ReadonlySet<string>;
  /** Some blocks are laid and some are still ghosts: the tour is building the flow. */
  building: boolean;
};

/** How a block reads in a frame (auto-running.css reads it as `data-state`). */
export type NodeState = "ghost" | "built" | "route" | "passed" | "current" | "off";

/** A line as the frame draws it: shown once both its ends are laid, faint electric on the route, full once travelled. */
export type EdgeState = { built: boolean; route: boolean; on: boolean };

/** A lens by id. Throws on an id the data doesn't have: a typo must not draw an empty workbench. */
export function lensOf(data: { lenses: readonly RunLens[] }, id: RunLensId): RunLens {
  const lens = data.lenses.find((l) => l.id === id);
  if (!lens) throw new Error(`workbench: no lens "${id}"`);
  return lens;
}

/** "Step {n} of {total}" → "Step 3 of 8": the data module's templates, filled. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? String(vars[key]) : whole));
}

/** A step's number as the workbench prints it: two figures, "03". */
export const pad2 = (n: number) => String(n).padStart(2, "0");

/** The kinds of the blocks a lens's flow is made of, for its meters: a branch that ends (`end`) is not a block that runs. */
export function blocksOf(lens: RunLens): BlockKind[] {
  return lens.nodes.filter((n) => !n.end).map((n) => n.kind);
}

const isNode = (lens: RunLens, id: string) => lens.nodes.some((n) => n.id === id);

function edgeOf(lens: RunLens, id: string): RunEdge {
  const edge = lens.edges.find((e) => e.id === id);
  if (!edge) throw new Error(`workbench: the "${lens.id}" lens has no edge "${id}"`);
  return edge;
}

/**
 * What each step of the run reaches, in order: the far end of each hop
 * (a block, or a group the hop enters), then the blocks it rings, and
 * the block that step leaves current.
 */
function runOf(lens: RunLens) {
  return lens.steps.map((s) => {
    const hops = (s.hops ?? []).map((h) => edgeOf(lens, h));
    const reached = [...hops.map((e) => e.to), ...(s.ring ?? [])];
    const arrival = hops.at(-1)?.to;
    const current = arrival && isNode(lens, arrival) ? arrival : (s.ring?.[0] ?? null);
    return { hops, reached, current };
  });
}

/** The block each step leaves current, in step order. */
export function currentsOf(lens: RunLens): (string | null)[] {
  return runOf(lens).map((s) => s.current);
}

/** The step (1-based) at which a block is current, or null for a block the run never stops at. */
export function stepOfNode(lens: RunLens, id: string): number | null {
  const at = currentsOf(lens).indexOf(id);
  return at < 0 ? null : at + 1;
}

/**
 * Where each manual step lands: the first step of the run (1-based) whose
 * current block replaced it. The lane prints it as "now step 03" once the
 * step has been handed over.
 */
export function nowSteps(lens: RunLens): Partial<Record<ManualId, number>> {
  const byId = new Map(lens.nodes.map((n) => [n.id, n]));
  const currents = currentsOf(lens);
  const out: Partial<Record<ManualId, number>> = {};
  for (const m of lens.manual) {
    const at = currents.findIndex((c) => c !== null && (byId.get(c)?.was ?? []).includes(m.id));
    if (at >= 0) out[m.id] = at + 1;
  }
  return out;
}

/* ─── The blocks in path order: the list's rows, the build's beats ─── */

export type Row =
  /** A block the flow runs, in the order the run first reaches it. */
  | { kind: "node"; node: RunNode; group?: RunGroupId }
  /** A branch that ends here, under the block it branches from, with the branch's word ("no"). */
  | { kind: "end"; node: RunNode; from: string; label?: string; group?: RunGroupId }
  /** The morning lens's frames: "In order", "Side by side", as a header before their first block. */
  | { kind: "group"; id: RunGroupId; label: string };

/**
 * The blocks as the list lays them, top to bottom, and as the map is
 * built, left to right: every block the run reaches, in the order it
 * first reaches it (never reached, in the data's order, last); each
 * branch that ends right under the block it leaves; and before a group's
 * first block, the group's header.
 */
export function pathOrder(lens: RunLens): Row[] {
  const first = new Map<string, number>();
  runOf(lens).forEach((s, i) => s.reached.forEach((id) => first.has(id) || first.set(id, i)));
  const main = lens.nodes
    .filter((n) => !n.end)
    .map((n, i) => ({ n, at: first.get(n.id) ?? lens.steps.length + i, i }))
    .sort((a, b) => a.at - b.at || a.i - b.i)
    .map(({ n }) => n);

  const rows: Row[] = [];
  const opened = new Set<RunGroupId>();
  for (const node of main) {
    if (node.group && !opened.has(node.group)) {
      opened.add(node.group);
      const label = lens.groups?.find((g) => g.id === node.group)?.label ?? node.group;
      rows.push({ kind: "group", id: node.group, label });
    }
    rows.push({ kind: "node", node, group: node.group });
    for (const e of lens.edges) {
      if (e.from !== node.id) continue;
      const end = lens.nodes.find((n) => n.id === e.to && n.end);
      if (end) rows.push({ kind: "end", node: end, from: node.id, label: e.label, group: node.group });
    }
  }
  return rows;
}

/** The blocks in path order: each is laid on its own beat as the tour builds the flow. */
export function buildOrder(lens: RunLens): RunNode[] {
  return pathOrder(lens).flatMap((r) => (r.kind === "group" ? [] : [r.node]));
}

/** The block each manual step is handed to as the flow is built: the first, in path order, that replaced it. */
export function handedTo(lens: RunLens): Map<ManualId, string> {
  const to = new Map<ManualId, string>();
  for (const n of buildOrder(lens)) for (const m of n.was ?? []) if (!to.has(m)) to.set(m, n.id);
  return to;
}

/** The branch an end block hangs off: the block it leaves and the branch's word. */
export function branchOf(lens: RunLens, id: string): { from: string; label?: string } | null {
  const e = lens.edges.find((edge) => edge.to === id);
  return e ? { from: e.from, label: e.label } : null;
}

/* ─── The frame ─────────────────────────────────────────────────── */

export function frameOf(lens: RunLens, place: Place): Frame {
  const hand = place.phase === "hand";
  const last = lens.steps.length - 1;
  const at = hand ? -1 : Math.max(-1, Math.min(last, Math.trunc(place.step)));
  const run = runOf(lens);

  const route = new Set<string>();
  run.forEach((s) => s.reached.forEach((id) => route.add(id)));

  const done = run.slice(0, at + 1);
  const traversed = new Set(done.flatMap((s) => s.hops.map((e) => e.id)));
  const current = at >= 0 ? run[at].current : null;
  const groups = new Set((lens.groups ?? []).map((g) => g.id as string));
  const passed = new Set<string>();
  const entered = new Set<string>();
  for (const s of done) {
    for (const id of s.reached) {
      if (groups.has(id)) entered.add(id);
      else passed.add(id);
    }
  }
  if (current) passed.delete(current);

  const all = lens.nodes.map((n) => n.id);
  const laid = hand ? new Set<string>() : new Set(place.laid ? all.filter((id) => place.laid?.has(id)) : all);
  const to = handedTo(lens);
  const handed = new Set(lens.manual.map((m) => m.id).filter((m) => laid.has(to.get(m) ?? "")));

  return {
    phase: place.phase,
    step: at,
    current,
    passed,
    route,
    traversed,
    entered,
    handed,
    nowStep: nowSteps(lens),
    laid,
    building: !hand && laid.size < all.length,
  };
}

/**
 * How a block reads: a ghost until it is laid; then current, passed, on
 * the route, or off it (a branch that ends, or a block this run never
 * reaches: dashed and muted); and, while the flow is still being built,
 * simply built — solid, before the route is marked on it.
 */
export function nodeState(frame: Frame, node: RunNode): NodeState {
  if (frame.phase === "hand" || !frame.laid.has(node.id)) return "ghost";
  if (frame.current === node.id) return "current";
  if (frame.passed.has(node.id)) return "passed";
  if (node.end || !frame.route.has(node.id)) return "off";
  return frame.building ? "built" : "route";
}

/**
 * The block the workbench's inspector shows. The reader's pick, when
 * there is one. Otherwise, from md, where it stands beside the run log,
 * the block the drawing is on (before the first hop, the one the run is
 * about to reach). Below md it sits under the log, where a block's
 * change of height moves everything after it: there it does not follow
 * a tour, and holds the run's last block while one plays, but it does
 * follow the reader's own step, picked by pointer or by key, whenever
 * none plays. Before the flow is built (the first view's by-hand frame,
 * waiting for its tour) it holds the last block too, so nothing moves
 * when that tour starts.
 */
export function inspected(
  lens: RunLens,
  o: { pick: string | null; frame: Frame; md: boolean; touring: boolean },
): string | null {
  if (o.pick !== null) return o.pick;
  const currents = currentsOf(lens);
  if (o.md) return o.frame.current ?? currents[0] ?? null;
  const closing = currents.at(-1) ?? null;
  return o.touring ? closing : (o.frame.current ?? closing);
}

/** Whether a group has a member laid: a line into it shows once it has. */
function groupLaid(lens: RunLens, frame: Frame, id: string) {
  return lens.nodes.some((n) => n.group === id && frame.laid.has(n.id));
}

/** How a line reads: shown once both its ends are laid, faint electric on the route, full electric once travelled. */
export function edgeState(lens: RunLens, frame: Frame, edge: RunEdge): EdgeState {
  const laid = (id: string) => frame.laid.has(id) || groupLaid(lens, frame, id);
  const hopped = lens.steps.some((s) => s.hops?.includes(edge.id));
  return {
    built: laid(edge.from) && laid(edge.to),
    // The route is marked once the flow stands, as the blocks' is.
    route: hopped && !frame.building,
    on: frame.traversed.has(edge.id),
  };
}

/**
 * The row of a tool window a copy chip lands on: the target tool's
 * manual step that shares the most words with the chip's label
 * ("Company details" → "Type the customer’s company details into …"),
 * or its first. The lane flashes it as the chip arrives.
 */
export function landingOf(lens: RunLens, copy: { to: string; label: string }): ManualId | null {
  const words = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[’']s\b/g, "")
        .split(/[^a-z]+/)
        .filter((w) => w.length >= 4),
    );
  const want = words(copy.label);
  let best: { id: ManualId; score: number } | null = null;
  for (const m of lens.manual) {
    if (m.tool !== copy.to) continue;
    const score = [...words(m.text)].filter((w) => want.has(w)).length;
    if (!best || score > best.score) best = { id: m.id, score };
  }
  return best?.id ?? null;
}
