import type { gsap as GsapCore } from "gsap";
import type { Lens, PartId } from "@/lib/pages/custom-saas-platforms";
import { holdFor } from "@/components/site/product/timing";
import { EDGE_IDS, PLACE, endsOf } from "./map-geometry";
import { arrivalOf, edgeOf, isReverse, type Voice } from "./explorer-frame";

/* ------------------------------------------------------------------ *
 * #platform — the explorer's two GSAP timelines, as plain functions:
 * the drawing assembling itself once, and a tour travelling one lens.
 *
 * GSAP ONLY TRAVELS; REACT HOLDS EVERY FRAME. What a step shows — which
 * card is current, which edges are lit, who is speaking, what failed —
 * is React's, drawn from `frameOf` as data attributes that
 * saas-explorer.css turns into colour. These timelines add only what
 * happens between two frames, and only on elements and properties React
 * never writes: a trace's dash (DrawSVG), the bead riding an edge
 * (MotionPath), the rings that ping round a card on arrival, and a
 * card's scale while the drawing assembles. When the timeline is
 * reverted (a lens or a step picked by hand, the window crossing xl,
 * reduced motion switched on) every one of those inline styles goes, and
 * what is left is React's frame, exactly: nothing GSAP drew can outlive
 * it or disagree with it.
 *
 * THE DRAW (xl only, once). The edges draw themselves column by column,
 * the way a request travels — people, then the carriers and the edge,
 * the app, the gateway and the database, the providers — each in 0.5s,
 * starting at 0, .25, .5, .8 and 1.05s. Each card sits a touch small
 * (0.92) and settles as the first edge into it lands, so the drawing
 * reads as parts being connected rather than lines appearing. About
 * 1.6s in all, and the cards' words are never hidden, only scaled.
 *
 * THE TOUR. For each step, each hop: the edge's trace draws from its
 * start (or from its end, for a hop that travels in reverse) while the
 * bead rides it, 0.7s; the ring round the card it reaches pings. Then
 * the step arrives — `onStep(i)`, and React makes the card current —
 * and holds for as long as its caption takes to read (`holdFor`). A
 * hop over an edge already travelled in this lens rides the bead only:
 * its trace is lit already, and drawing it again would blink. A step
 * with no hops (a breaker opening, a job re-syncing agents) pings its
 * parts twice instead. When a step changes who is speaking, the tour
 * calls `onVoice(v, commit)` rather than `onStep`: the explorer records
 * where the Speaking pill is (Flip), then commits the step, and flies
 * the pill to its new card after React has moved it. At the end, a beat
 * for the last ping, then `onDone`. It never loops.
 *
 * BELOW XL there is no map, so no bead and no traces: the stacked
 * composition's chips ping in the same order and at a quicker pace, and
 * the rail beside the bands follows the current part's band in CSS.
 *
 * The tour starts by calling `onStep(from − 1)`, so whatever frame was
 * showing becomes the one just before its first hop — step −1, the
 * route and nothing travelled, for a tour from the top.
 *
 * Client-only functions and no React. The kit that calls them has
 * registered DrawSVGPlugin and MotionPathPlugin (product/motion-kit.ts),
 * and they run inside the explorer's `useKitContext`, so a revert of that
 * context takes back everything they did.
 * ------------------------------------------------------------------ */

type Gsap = typeof GsapCore;

/** One hop on the map: the trace draws and the bead rides it. */
const HOP = 0.7;
/** One hop in the stacked composition, where only the chips ping. */
const HOP_NARROW = 0.45;
/** An edge's draw when the drawing assembles. */
const DRAW = 0.5;
/** When each column's edges start drawing: people, edge, app, gateway and database, providers. */
const COLUMN_AT = [0, 0.25, 0.5, 0.8, 1.05] as const;
/** How far a ring grows as it pings: round a map card, and round a chip, which is smaller. */
const REACH = { map: 1.35, stack: 1.12 } as const;
const PING = 0.5;

/** Which column of the drawing a part stands in, by its x. */
function columnOf(id: PartId): number {
  const x = PLACE[id][0];
  return x <= 80 ? 0 : x <= 245 ? 1 : x <= 575 ? 2 : x <= 740 ? 3 : 4;
}

/**
 * The drawing assembling itself, once, the first time the map is shown
 * with the stage still below the screen. Built paused: the explorer plays
 * it when the stage comes into view.
 */
export function buildDraw(gsap: Gsap, root: Element, o: { onComplete?: () => void } = {}): gsap.core.Timeline {
  const tl = gsap.timeline({ paused: true, onComplete: o.onComplete });
  const view = root.querySelector('[data-view="map"]');
  if (!view) return tl;

  const lands = new Map<PartId, number>();
  for (const id of EDGE_IDS) {
    const [from, to] = endsOf(id);
    const at = COLUMN_AT[columnOf(from)];
    // The base line and its trace together, so a lit edge draws lit.
    const lines = view.querySelectorAll(`[data-edge="${id}"], [data-trace="${id}"]`);
    tl.fromTo(lines, { drawSVG: "0% 0%" }, { drawSVG: "0% 100%", duration: DRAW, ease: "power2.inOut" }, at);
    lands.set(to, Math.min(lands.get(to) ?? Infinity, at + DRAW));
  }

  view.querySelectorAll<HTMLElement>(".saas-card").forEach((card) => {
    const at = lands.get(card.dataset.part as PartId) ?? 0;
    tl.fromTo(card, { scale: 0.92 }, { scale: 1, duration: 0.4, ease: "power3.out" }, at);
  });
  return tl;
}

export type TourOptions = {
  lens: Lens;
  /** The first step to travel to; the frame before it is shown first. */
  from: number;
  /** The map (xl) or the stacked composition. */
  wide: boolean;
  /** A step has arrived (−1 or `from − 1` at the start): show it. */
  onStep: (i: number) => void;
  /** A step that changes who is speaking has arrived: record the pill, then `commit()` the step. */
  onVoice: (v: Voice, commit: () => void) => void;
  onStart?: () => void;
  onDone: () => void;
};

/** One lens, travelled from `from` to its last step. Built paused: the explorer decides when it plays. */
export function buildTour(gsap: Gsap, root: Element, o: TourOptions): gsap.core.Timeline {
  const tl = gsap.timeline({ paused: true, onStart: o.onStart, onComplete: o.onDone });
  const { steps } = o.lens;
  const from = Math.max(0, Math.min(steps.length - 1, o.from));
  tl.call(() => o.onStep(from - 1), undefined, 0);

  const view = root.querySelector(`[data-view="${o.wide ? "map" : "stack"}"]`);
  if (!view) return tl;
  const bead = o.wide ? view.querySelector(".saas-bead") : null;
  const reach = o.wide ? REACH.map : REACH.stack;

  const ping = (id: PartId, at: number) => {
    const ring = view.querySelector(o.wide ? `[data-ring="${id}"]` : `[data-part="${id}"] .saas-chip-ring`);
    if (!ring) return;
    // An SVG rect scales from its own top left unless told otherwise.
    tl.fromTo(
      ring,
      { opacity: 0.9, scale: 1, transformOrigin: "50% 50%" },
      { opacity: 0, scale: reach, duration: PING, ease: "power2.out", immediateRender: false },
      at,
    );
  };

  // What the frame before `from` already shows lit, and who is already speaking.
  const lit = new Set(steps.slice(0, from).flatMap((st) => (st.hops ?? []).map(edgeOf)));
  let voice: Voice | null = null;
  for (const st of steps.slice(0, from)) if (st.voice) voice = st.voice;

  // The playhead as the tour is laid out. Pings run on past an arrival
  // and would stretch the timeline's own duration, so arrivals are placed
  // by this cursor, never by `tl.duration()`.
  let t = 0;
  for (let i = from; i < steps.length; i++) {
    const step = steps[i];
    // A beat before the first hop; after that, time to read the step just shown.
    t += i === from ? 0.3 : holdFor(steps[i - 1].text) / 1000;

    for (const hop of step.hops ?? []) {
      const edge = edgeOf(hop);
      const reverse = isReverse(hop);
      const trace = o.wide ? view.querySelector<SVGPathElement>(`[data-trace="${edge}"]`) : null;
      if (trace) {
        if (!lit.has(edge)) {
          tl.fromTo(
            trace,
            { opacity: 1, drawSVG: reverse ? "100% 100%" : "0% 0%" },
            { drawSVG: "0% 100%", duration: HOP, ease: "power2.inOut", immediateRender: false },
            t,
          );
        }
        if (bead) {
          tl.set(bead, { opacity: 1 }, t).to(
            bead,
            {
              duration: HOP,
              ease: "power2.inOut",
              motionPath: {
                path: trace,
                align: trace,
                alignOrigin: [0.5, 0.5],
                start: reverse ? 1 : 0,
                end: reverse ? 0 : 1,
              },
            },
            t,
          );
        }
        t += HOP;
      } else {
        t += HOP_NARROW;
      }
      lit.add(edge);
      ping(arrivalOf(hop), t);
    }
    if (bead && step.hops?.length) tl.set(bead, { opacity: 0 }, t);

    const n = i;
    const arrive = () => o.onStep(n);
    if (step.voice && step.voice !== voice) {
      const v = step.voice;
      voice = v;
      tl.call(() => o.onVoice(v, arrive), undefined, t);
    } else {
      tl.call(arrive, undefined, t);
    }

    // A step that travels nowhere pings what it touches, twice.
    for (const id of step.ring ?? []) {
      ping(id, t);
      ping(id, t + PING);
    }
  }

  // Let the last ping finish before the tour says it is done.
  tl.to({}, { duration: PING }, t);
  return tl;
}
