import type {
  DownRow,
  EdgeId,
  ExplorerData,
  Hop,
  Lens,
  LensId,
  PartId,
  TourLensId,
} from "@/lib/pages/custom-saas-platforms";
import { endsOf } from "./map-geometry";

/* ------------------------------------------------------------------ *
 * #platform — what the drawing shows, as a pure function of where the
 * reader is: `frameOf(data, { lens, step, mask, down })`.
 *
 * THE FRAME IS NEVER STORED. The explorer keeps four small numbers (the
 * lens, the step, the switches' mask and the down table the server
 * worked out) and draws whatever this returns, on the server and on
 * every render after. So the finished frame the server paints for
 * readers without script, with reduced motion, on the still tier and on
 * lite before a tap — the sign-up lens on its last step — is the same
 * frame the tour lands on, and a reader who picks a step by hand gets
 * exactly what the tour would have shown there. GSAP only ever adds the
 * travel between two frames; it never holds one.
 *
 * WHAT A FRAME SAYS, part by part and edge by edge:
 *   current     where the step arrived (its last hop's far end), or the
 *               first part a ring-only step pulses; null before the
 *               first step
 *   passed      every part the lens has touched up to and including
 *               this step, except the current one
 *   route       every part the lens touches at all: drawn faintly, so
 *               the whole path is readable before it is travelled
 *   routeEdges  the lens's edges, faint electric (35%)
 *   traversed   the edges travelled so far, full electric
 *   rings       the parts this step pulses without travelling to
 *   faults      the part this step has fail (an ember slash)
 *   voice       who is speaking to the caller: the last `voice` at or
 *               before this step, in the call and failover lenses only
 *
 * A hop marked `reverse` travels its edge backwards (the nightly job
 * reporting to Stripe, texting through Twilio), so it arrives at the
 * edge's first-named part.
 *
 * STEP −1 is "about to begin": the lens's route drawn and nothing yet
 * travelled. The tour sits there for the moment its first hop is on
 * its way; it is never a resting frame.
 *
 * TAKE A PART DOWN is the fifth lens and has no steps: its frame is the
 * row of the server's down table (custom-saas-platforms.server.ts, the
 * platform's own decideMode) for the switches the reader has flipped.
 * The route the next call takes is drawn travelled end to end, the card
 * it arrives at is current, the gateway is struck through while its
 * switch is down, and the Cartesia or ElevenLabs voice speaks.
 *
 * PURE: no React and no DOM, types only from the server-only data
 * module. The page's test imports `frameOf` and `pathsFor` under vitest.
 * ------------------------------------------------------------------ */

export type Voice = "cartesia" | "elevenlabs";

export type Frame = {
  current: PartId | null;
  passed: ReadonlySet<PartId>;
  route: ReadonlySet<PartId>;
  routeEdges: ReadonlySet<EdgeId>;
  traversed: ReadonlySet<EdgeId>;
  rings: readonly PartId[];
  faults: readonly PartId[];
  voice: Voice | null;
  /** The down table's row, in the `down` lens only. */
  row?: DownRow;
};

/** How a card or a chip shows its part in a frame (saas-explorer.css reads it as `data-state`). */
export type PartState = "current" | "passed" | "route" | "rest";

/** The edge a hop travels. */
export const edgeOf = (h: Hop): EdgeId => (typeof h === "string" ? h : h.edge);

/** True for a hop that travels its edge backwards. */
export const isReverse = (h: Hop): boolean => typeof h !== "string";

/** Where a hop arrives: its edge's second part, or its first when it travels in reverse. */
export function arrivalOf(h: Hop): PartId {
  const [from, to] = endsOf(edgeOf(h));
  return isReverse(h) ? from : to;
}

/** A tour lens by id. Throws on an id the data doesn't have: a typo must not draw an empty map. */
export function lensOf(data: ExplorerData, id: TourLensId): Lens {
  const lens = data.lenses.find((l) => l.id === id);
  if (!lens) throw new Error(`explorer: no lens "${id}"`);
  return lens;
}

/** The ids the lens radios offer, in order: the four tours, then "Take a part down". */
export function lensIds(data: ExplorerData): readonly LensId[] {
  return [...data.lenses.map((l) => l.id), "down"];
}

/** The down table's row for a mask; the table has all sixteen, so a miss is a bug. */
export function rowOf(down: readonly DownRow[], mask: number): DownRow {
  const row = down.find((r) => r.mask === mask);
  if (!row) throw new Error(`explorer: the down table has no row for mask ${mask}`);
  return row;
}

const partsOf = (edges: Iterable<EdgeId>) => {
  const parts = new Set<PartId>();
  for (const e of edges) endsOf(e).forEach((p) => parts.add(p));
  return parts;
};

export function frameOf(
  data: ExplorerData,
  s: { lens: LensId; step: number; mask: number; down: readonly DownRow[] },
): Frame {
  if (s.lens === "down") {
    const row = rowOf(s.down, s.mask);
    const edges = new Set(data.down.routes[row.mode]);
    const route = partsOf(edges);
    const current = data.down.arrives[row.mode];
    return {
      current,
      passed: new Set([...route].filter((p) => p !== current)),
      route,
      routeEdges: edges,
      traversed: edges,
      rings: [],
      faults: s.mask & 1 ? ["gateway"] : [],
      voice: row.mode === "elevenlabs" ? "elevenlabs" : "cartesia",
      row,
    };
  }

  const { steps } = lensOf(data, s.lens);
  const at = Math.max(-1, Math.min(steps.length - 1, Math.trunc(s.step)));
  const hops = steps.flatMap((st) => st.hops ?? []);
  const routeEdges = new Set(hops.map(edgeOf));
  const route = partsOf(routeEdges);
  for (const st of steps) st.ring?.forEach((p) => route.add(p));

  const done = steps.slice(0, at + 1);
  const traversed = new Set(done.flatMap((st) => (st.hops ?? []).map(edgeOf)));
  const step = at >= 0 ? steps[at] : null;
  const last = step?.hops?.at(-1);
  const current = last ? arrivalOf(last) : (step?.ring?.[0] ?? null);

  const touched = partsOf(traversed);
  for (const st of done) st.ring?.forEach((p) => touched.add(p));
  if (current) touched.delete(current);

  let voice: Voice | null = null;
  if (s.lens === "call" || s.lens === "failover") {
    for (const st of done) if (st.voice) voice = st.voice;
  }

  return {
    current,
    passed: touched,
    route,
    routeEdges,
    traversed,
    rings: step?.ring ?? [],
    faults: step?.fault ? [step.fault] : [],
    voice,
  };
}

/** How a part reads in a frame: current (arrived, or pulsed), passed, on the route, or at rest. */
export function stateOf(frame: Frame, id: PartId): PartState {
  if (frame.current === id || frame.rings.includes(id)) return "current";
  if (frame.passed.has(id)) return "passed";
  if (frame.route.has(id)) return "route";
  return "rest";
}

/** The tour lenses a part takes part in: travelled to or from, pulsed, or failed. */
export function pathsFor(data: ExplorerData, part: PartId): TourLensId[] {
  return data.lenses
    .filter((l) =>
      l.steps.some(
        (st) =>
          (st.hops ?? []).some((h) => endsOf(edgeOf(h)).includes(part)) ||
          (st.ring ?? []).includes(part) ||
          st.fault === part,
      ),
    )
    .map((l) => l.id);
}

/** "Step {n} of {total}" → "Step 3 of 7": the data module's templates, filled. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? String(vars[key]) : whole));
}
