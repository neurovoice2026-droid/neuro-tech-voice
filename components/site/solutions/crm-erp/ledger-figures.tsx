import type { CSSProperties, ReactElement } from "react";
import { cn } from "@/lib/utils";
import type { RouteId } from "@/lib/pages/crm-erp";

/* ------------------------------------------------------------------ *
 * "Off the shelf, or built for you?" — the three routes' figures: one
 * small line drawing heading each route of the ledger (ledger.tsx), the
 * same picture told three ways. A box is a product; the electric line
 * with its nodes is your process, the page's colour for the work.
 *
 *   · Off the shelf: a product's box, ruled into cells, and your process
 *     bent at every turn to pass through them — the product's shape, not
 *     yours.
 *   · Off the shelf, extended: the same box, a smaller part joined to its
 *     side, and the process carried out of the product into that part —
 *     the few things only your business does, built to fit.
 *   · Built around your process: the process first, straight, its steps
 *     on it, and the box drawn round it last — the system drawn from how
 *     you work.
 *
 * THE #checks KEY'S LINE VOCABULARY (custom-saas-platforms/checks.tsx
 * `KindFigure`), at its size, 112 × 48: 1.6 strokes with round caps, a
 * node on a disc of page stock where it sits on a line, the product's
 * rules at 35%. Ink for the product, electric for the process (5.70 on
 * white, a mark). The three are drawn to one weight, with nothing that
 * sets one apart: the ledger gives the three routes equal weight, and so
 * do their pictures. Aria-hidden: the route's name and its five rows say
 * everything in words.
 *
 * THEY DRAW ON THEIR WAY UP THE SCREEN (home.css `.home-draw`), each
 * element on its own slice of the figure's window (`--o` where it
 * starts, `--s` how much it takes, both shares; erp-shape.css §4, the
 * saas-closing.css §10a rule), the order the picture tells: the box,
 * its rules, then the process through it; the process, its steps, then
 * the box round it. Side by side, from lg, the three start a beat apart
 * (`data-i`, the route's place). Reduced motion, a browser without view
 * timelines, and the lite and still tiers and weak hardware get the
 * markup, which is the finished drawing (erp-shape.css §5).
 *
 * PURE: no "use client", no hooks, types only from the data module.
 * ------------------------------------------------------------------ */

const W = 112;
const H = 48;
const LINE = 1.6;
/** A node's radius, and the disc of page stock that cuts the line under it. */
const R = 2.6;
const HALO = R + 2.2;

/** The routes in the data module's order: each figure's place in its row, for its beat. */
const ORDER: readonly RouteId[] = ["shelf", "extended", "built"];

/** When an element runs, as a share of its figure's draw window: from `o`, over `s`. Read by erp-shape.css §4. */
function at(o: number, s: number) {
  return { "--o": o, "--s": s } as CSSProperties;
}

const solid = {
  stroke: "currentColor",
  strokeWidth: LINE,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** A stroke that draws on the figure's passage, with the class the slices and the tier pins name it by (never `[pathLength]`). */
const drawn = { pathLength: 1, className: "erp-route-line", ...solid } as const;

/** The process: electric (5.70 on white, a mark). */
const PROCESS = "text-(--home-electric)";

/** A rounded rectangle as one path, so it can draw (home.css draws `path[pathLength]` only). */
function box(x0: number, y0: number, x1: number, y1: number, r: number) {
  return (
    `M${x0 + r} ${y0} H${x1 - r} A${r} ${r} 0 0 1 ${x1} ${y0 + r} V${y1 - r} A${r} ${r} 0 0 1 ${x1 - r} ${y1}` +
    ` H${x0 + r} A${r} ${r} 0 0 1 ${x0} ${y1 - r} V${y0 + r} A${r} ${r} 0 0 1 ${x0 + r} ${y0} Z`
  );
}

/** A step of the process: a filled node on its disc of page stock, popping in (erp-shape.css §4). */
function Node({ x, y, o }: { x: number; y: number; o: number }) {
  return (
    <g className={cn("erp-route-pop", PROCESS)} style={at(o, 0.12)}>
      <circle cx={x} cy={y} r={HALO} className="erp-route-knock fill-pp-bg" />
      <circle cx={x} cy={y} r={R} fill="currentColor" />
    </g>
  );
}

/** A product's box and its rules: `cols` columns and two rows. */
function Product({ x0, x1, cols, o }: { x0: number; x1: number; cols: number; o: number }) {
  const y0 = 4;
  const y1 = 44;
  const w = (x1 - x0) / cols;
  return (
    <>
      <path d={box(x0, y0, x1, y1, 5)} style={at(o, 0.32)} {...drawn} />
      {Array.from({ length: cols - 1 }, (_, k) => (
        <path
          key={k}
          d={`M${x0 + w * (k + 1)} ${y0} V${y1}`}
          strokeOpacity={0.35}
          style={at(o + 0.22 + k * 0.05, 0.14)}
          {...drawn}
        />
      ))}
      <path d={`M${x0} ${H / 2} H${x1}`} strokeOpacity={0.35} style={at(o + 0.3, 0.14)} {...drawn} />
    </>
  );
}

/** Off the shelf: the process bends through the product's cells, row to row. */
function ShelfFigure() {
  const x0 = 36;
  const w = 24;
  const mid = (k: number) => x0 + w * (k + 0.5);
  return (
    <>
      <Product x0={x0} x1={x0 + 3 * w} cols={3} o={0} />
      <g className={PROCESS}>
        <path d={`M10 34 H${mid(0)} V14 H${mid(1)} V34 H${mid(2)} V14`} style={at(0.48, 0.4)} {...drawn} />
      </g>
      <Node x={6} y={34} o={0.42} />
      <Node x={mid(2)} y={14} o={0.86} />
    </>
  );
}

/** Off the shelf, extended: the same product, a part joined to its side, and the process carried out into it. */
function ExtendedFigure() {
  const x0 = 28;
  const w = 18;
  const x1 = x0 + 3 * w;
  const mid = (k: number) => x0 + w * (k + 0.5);
  const part = { x0: 90, x1: 108, y0: 14, y1: 34 };
  return (
    <>
      <Product x0={x0} x1={x1} cols={3} o={0} />
      <g className={PROCESS}>
        {/* The part built for you, and the short joint that fixes it to the product. */}
        <path d={box(part.x0, part.y0, part.x1, part.y1, 4)} style={at(0.36, 0.2)} {...drawn} />
        <path
          d={`M10 34 H${mid(0)} V14 H${mid(1)} V34 H${mid(2)} V${H / 2} H${(part.x0 + part.x1) / 2}`}
          style={at(0.5, 0.36)}
          {...drawn}
        />
      </g>
      <Node x={6} y={34} o={0.44} />
      <Node x={(part.x0 + part.x1) / 2} y={H / 2} o={0.86} />
    </>
  );
}

/** Built around your process: the process first, straight, its steps on it, then the box drawn round it. */
function BuiltFigure() {
  const steps = [40, 62, 84];
  return (
    <>
      <g className={PROCESS}>
        <path d="M10 24 H98" style={at(0.06, 0.36)} {...drawn} />
      </g>
      <Node x={6} y={H / 2} o={0} />
      {steps.map((x, k) => (
        <Node key={x} x={x} y={H / 2} o={0.2 + k * 0.1} />
      ))}
      <Node x={102} y={H / 2} o={0.5} />
      <path d={box(22, 8, 108, 40, 6)} style={at(0.56, 0.4)} {...drawn} />
    </>
  );
}

const FIGURES: Record<RouteId, () => ReactElement> = {
  shelf: ShelfFigure,
  extended: ExtendedFigure,
  built: BuiltFigure,
};

/** One route's figure, 112 × 48, drawn on its way up the screen. Aria-hidden: the route's words say it. */
export function LedgerFigure({ id }: { id: RouteId }) {
  const Figure = FIGURES[id];
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      fill="none"
      aria-hidden
      data-i={ORDER.indexOf(id)}
      className="home-draw erp-route-fig block h-12 w-[112px] shrink-0 overflow-visible text-pp-ink"
    >
      <Figure />
    </svg>
  );
}
