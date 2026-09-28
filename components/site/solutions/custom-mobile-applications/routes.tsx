import type { RouteId, RoutesCopy } from "@/lib/pages/custom-mobile-applications";
import { cn } from "@/lib/utils";
import { TYPE, WEIGHT } from "@/components/site/home/type";

/* ------------------------------------------------------------------ *
 * #hold — "Two apps or one?", under the stage: the question the phone's
 * iOS | Android switch raises, answered the way the owner answers it —
 * whatever technology the product or the client calls for, chosen with
 * them, never imposed.
 *
 * THREE ROUTES, the terms' ledger grammar: side by side from md, a
 * hairline between them; stacked below md, a hairline above each. Each
 * is a small drawing, its name, the tools it means in mono violet (7.10
 * on white) and a sentence on what it is for:
 *   · native, for each — Swift and SwiftUI, Kotlin and Jetpack Compose;
 *   · one codebase for both — React Native with Expo, Flutter;
 *   · the code you already have — read first, then carried on or begun
 *     again, and why.
 * The foot says what stays the same whichever it is: the prototype, the
 * server and the path through both stores. Every line is the owner's
 * (the data module marks them `// OWNER`) and every named technology is
 * credited in #start.
 *
 * THE DRAWINGS (`RouteFigure`, 96 × 64, aria-hidden: the words beside
 * each say it all) use the landing's figure vocabulary: 1.6 strokes with
 * round caps, dotted for what is already there, a node on a disc of page
 * stock where a line divides. Two phones stand at the right of each, 20
 * × 36 outlines in ink with a home bar, and the code runs into them from
 * the left in violet, the page's colour for what we build:
 *   · native: two trunks, each turning up into its own phone;
 *   · shared: one trunk, which divides at a node under the first phone;
 *   · yours: a dotted trunk from the edge — the code as it is — turning
 *     solid, then dividing as the shared one does.
 * They draw on their own passage up the screen (home.css `home-draw`,
 * `data-i` 0–2 staggering the three); the dotted stroke keeps its own
 * dash, so it carries no `pathLength` and simply stands there. Wherever
 * that doesn't run (reduced motion, lite, still, weak: mob-hold.css §7),
 * the markup is the finished drawing.
 *
 * A server component, with no client code at all.
 * ------------------------------------------------------------------ */

const W = 96;
const H = 64;
const LINE = 1.6;
const DOTS = "0.01 4.6";
/** The two phones: their left edges, their top, and their size. */
const PHONE = { a: 40, b: 70, top: 4, w: 20, h: 36, r: 4 } as const;
const BOTTOM = PHONE.top + PHONE.h;
/** A phone's middle, where a trunk turns up into it. */
const MID = { a: PHONE.a + PHONE.w / 2, b: PHONE.b + PHONE.w / 2 } as const;
/** A bend's radius, and a node's (on its disc of page stock). */
const BEND = 6;
const NODE = 2.2;
const HALO = NODE + 2;

const solid = { stroke: "currentColor", strokeWidth: LINE, strokeLinecap: "round", strokeLinejoin: "round" } as const;
/** A stroke that draws on the figure's passage (home.css `home-draw`), with the class the tier pins name it by (mob-hold.css §7). */
const drawn = { pathLength: 1, className: "mob-stroke", ...solid } as const;

/** A phone's outline, a rounded rectangle drawn as one path (home.css draws `path[pathLength]` only), and its home bar. */
function Phone({ x }: { x: number }) {
  const { top, w, h, r } = PHONE;
  const d =
    `M${x + r} ${top} H${x + w - r} Q${x + w} ${top} ${x + w} ${top + r} V${top + h - r} ` +
    `Q${x + w} ${top + h} ${x + w - r} ${top + h} H${x + r} Q${x} ${top + h} ${x} ${top + h - r} ` +
    `V${top + r} Q${x} ${top} ${x + r} ${top} Z`;
  return (
    <g className="text-pp-ink">
      <path d={d} {...drawn} />
      <path d={`M${x + 7} ${top + h - 5} H${x + w - 7}`} {...drawn} strokeOpacity={0.5} />
    </g>
  );
}

/** A trunk along `y` from `x0`, turning up into the phone whose middle is `mx`. */
const turnUp = (x0: number, y: number, mx: number) => `M${x0} ${y} H${mx - BEND} Q${mx} ${y} ${mx} ${y - BEND} V${BOTTOM}`;

function Node({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={HALO} className="fill-pp-bg" />
      <circle cx={x} cy={y} r={NODE} fill="currentColor" />
    </g>
  );
}

function RouteFigure({ id, i }: { id: RouteId; i: number }) {
  // native: two trunks; shared and yours: one, dividing under the first phone.
  const split = 54;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      fill="none"
      aria-hidden
      data-i={i}
      className="mob-route-fig home-draw block h-16 w-24 shrink-0 overflow-visible"
    >
      <g className="text-(--home-violet)">
        {id === "native" ? (
          <>
            <path d={turnUp(2, 50, MID.a)} {...drawn} />
            <path d={turnUp(2, 58, MID.b)} {...drawn} />
          </>
        ) : (
          <>
            {id === "yours" && <path d={`M2 ${split} H20`} {...solid} strokeDasharray={DOTS} />}
            <path d={turnUp(id === "yours" ? 25 : 2, split, MID.b)} {...drawn} />
            <path d={`M${MID.a} ${split} V${BOTTOM}`} {...drawn} />
            <Node x={MID.a} y={split} />
          </>
        )}
      </g>
      <Phone x={PHONE.a} />
      <Phone x={PHONE.b} />
    </svg>
  );
}

export function Routes({ copy, className }: { copy: RoutesCopy; className?: string }) {
  return (
    <div className={cn("mt-12 lg:mt-16", className)}>
      <h3 className={cn(TYPE.h3, "text-balance")} style={{ fontWeight: WEIGHT.h3 }}>
        {copy.title}
      </h3>
      <p className={cn(TYPE.lead, "mt-2 max-w-[44em] text-pretty")}>{copy.lead}</p>
      <ul className="mt-8 grid gap-6 md:grid-cols-3 md:gap-0 md:divide-x md:divide-pp-rule">
        {copy.items.map((r, i) => (
          <li
            key={r.id}
            // Stacked, a hairline above each; side by side, one between.
            className="min-w-0 border-t border-pp-rule pt-6 md:border-t-0 md:px-6 md:pt-0 md:first:pl-0 md:last:pr-0"
          >
            <RouteFigure id={r.id} i={i} />
            <h4 className={cn(TYPE.body, "mt-4 font-semibold text-pp-ink")}>{r.label}</h4>
            <p className={cn(TYPE.mono, "mt-1 text-pretty text-(--home-violet)")}>{r.tools}</p>
            <p className={cn(TYPE.meta, "mt-2 max-w-[36em] text-pretty")}>{r.body}</p>
          </li>
        ))}
      </ul>
      <p className={cn(TYPE.meta, "mt-8 max-w-[640px] text-pretty")}>{copy.foot}</p>
    </div>
  );
}
