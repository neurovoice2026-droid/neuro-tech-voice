import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 * #move — stage 01's drawing: a process, mapped.
 *
 * What stage 01 hands over, in miniature: the work drawn as lanes of
 * who does what, and the steps a customer's order passes through, one
 * after another, joined where the work goes from one person to the
 * next. Four hairline lanes, eight small nodes and the elbows between
 * them: the shape of the sample #process draws above (two steps in
 * sales, a follow-up that runs by itself, the order back in sales, two
 * in operations, the invoice in accounts, the figures by themselves),
 * as a map of yours would be drawn. No words: stage 01's own body and
 * "You hold" line say it, and #process is the drawing in full.
 *
 * It fills stage 01's fifth row from lg (move.tsx), where its
 * neighbours say what ours shows: stage 01's proof is the drawing a
 * section up. Stacked, there is no row to fill and no drawing. On the
 * SaaS stage-01 plate (226 × 38) at 1:1, so the row it sits in grows no
 * taller than its neighbours' "On ours" does: the Automations map's and
 * the Mobile phones' rule.
 *
 * A landing figure (`.home-draw`), in the #build maps' grammar
 * (custom-automations/build.tsx `MapFigure`): 1.6 strokes with round
 * caps; the lanes in the light's own dim, faint, and the nodes and
 * elbows in its tick — marks on a pearl light, never text. It draws on
 * its own passage up the screen, each element on its own slice (`--o`
 * where it starts, `--s` how much it takes, inline; erp-move.css §2):
 * the four lanes together, then node by node, each elbow drawing on to
 * the next node as the one before it pops. Wherever that doesn't run —
 * reduced motion, a browser without view timelines, the lite, still and
 * weak tiers — the markup is the finished drawing.
 *
 * PURE and aria-hidden.
 * ------------------------------------------------------------------ */

const PLATE = { w: 226, h: 38 } as const;
/** Four lanes, a quarter of the plate each: sales, operations, accounts, by itself (#process's order). */
const LANE_Y = [4.75, 14.25, 23.75, 33.25] as const;
/** Each step's lane, in the order a customer's order passes through them (the sample's, lib/pages/crm-erp STEPS). */
const STEP_LANE = [0, 0, 3, 0, 1, 1, 2, 3] as const;
/** The first node's centre, the step between nodes, a node's radius, and an elbow's corner. */
const X0 = 8;
const PITCH = 30;
const NODE = 2.5;
const CORNER = 3;
const LINE = 1.6;

const x = (i: number) => X0 + i * PITCH;
const y = (i: number) => LANE_Y[STEP_LANE[i]];

/** When a node pops, as a share of the figure's pass; its elbow on to the next starts just after. */
const nodeAt = (i: number) => 0.22 + 0.1 * i;

/** When an element draws, as a share of the figure's pass: from `o`, for `s`. Read by erp-move.css §2. */
function at(o: number, s: number) {
  return { "--o": o, "--s": s } as CSSProperties;
}

const solid = { stroke: "currentColor", strokeWidth: LINE, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" } as const;

/** The elbow from node `i` to node `i + 1`: along the lane, or across to the next one at the gutter's middle, with round corners. */
function elbow(i: number) {
  const x0 = x(i) + NODE;
  const x1 = x(i + 1) - NODE;
  const y0 = y(i);
  const y1 = y(i + 1);
  if (y0 === y1) return `M${x0} ${y0} H${x1}`;
  const mid = (x(i) + x(i + 1)) / 2;
  const dir = y1 > y0 ? 1 : -1;
  return `M${x0} ${y0} H${mid - CORNER} Q${mid} ${y0} ${mid} ${y0 + dir * CORNER} V${y1 - dir * CORNER} Q${mid} ${y1} ${mid + CORNER} ${y1} H${x1}`;
}

/** Stage 01's fifth row, from lg: a process mapped as lanes of who does what. */
export function MiniLanes({ className }: { className?: string }) {
  const steps = STEP_LANE.map((_, i) => i);
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${PLATE.w} ${PLATE.h}`}
      width={PLATE.w}
      height={PLATE.h}
      className={cn("erp-mini home-draw hidden max-w-full overflow-visible text-(--saas-dim) lg:block", className)}
    >
      {/* The lanes, faint hairlines the width of the plate, drawn together. */}
      {LANE_Y.map((ly, k) => (
        <path
          key={ly}
          d={`M0.5 ${ly} H${PLATE.w - 0.5}`}
          pathLength={1}
          className="erp-mini-draw"
          style={at(0.02 * k, 0.18)}
          {...solid}
          strokeWidth={1}
          strokeOpacity={0.3}
        />
      ))}

      {/* The steps, in the tick: each node, and the elbow on to the next. */}
      <g className="text-(--saas-tick)">
        {steps.slice(0, -1).map((i) => (
          <path key={i} d={elbow(i)} pathLength={1} className="erp-mini-draw" style={at(nodeAt(i) + 0.03, 0.07)} {...solid} />
        ))}
        {steps.map((i) => (
          <circle key={i} cx={x(i)} cy={y(i)} r={NODE} fill="currentColor" className="erp-mini-node" style={at(nodeAt(i), 0.05)} />
        ))}
      </g>
    </svg>
  );
}
