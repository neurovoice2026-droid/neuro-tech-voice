import type { CSSProperties, ReactNode } from "react";

/* ------------------------------------------------------------------ *
 * #trust — the four small figures, one over each thing you can check.
 *
 * The product pages' line vocabulary at 1:1, drawn on a 112 × 48 plate:
 * 1.6 strokes with round caps, lines that fade in from nothing and stop
 * short of the nodes they meet, dotted strokes for what is secondary or
 * merely possible, nodes on a disc of page stock. Ink throughout; the
 * accent appears once, on the one note that is about the AI itself.
 *
 *   · We keep your transcripts in the EU: a line comes in, crosses a
 *     dotted border and comes to rest at a node inside it. Only our copy
 *     of the transcript comes to rest there; the note says the
 *     recordings never do.
 *   · Hands the call over: three ways in converge on the agent, and a
 *     dotted line runs on from it to a person.
 *   · Tells every caller: the opening line as a waveform, its first two
 *     bars in violet, the rest of the call trailing off dotted.
 *   · An EU company: a folded page, three lines on it, the middle one
 *     led out to where you can look it up. A page — never a seal.
 *
 * Server-rendered and static. They draw on the figure's own passage up
 * the screen (the .home-draw view timeline in home.css, staged per
 * element by trust.css); without view timelines, or with reduced motion,
 * the markup is simply the finished drawing.
 * ------------------------------------------------------------------ */

const W = 112;
const H = 48;
const MID = H / 2;
const LINE = 1.6;
const DOTS = "0.01 4.6";
/** A node's radius, and the page-stock disc that keeps lines off it. */
const R = 4;
const HALO = R + 4;

export type TrustFigureId = "eu" | "handover" | "languages" | "company";

/**
 * When an element runs, as a share of its figure's draw window: it starts
 * at `o` and takes `s`. Read by trust.css.
 */
function at(o: number, s: number) {
  return { "--o": o, "--s": s } as CSSProperties;
}

const solid = {
  stroke: "currentColor",
  strokeWidth: LINE,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const dotted = {
  stroke: "currentColor",
  strokeWidth: LINE,
  strokeLinecap: "round",
  strokeDasharray: DOTS,
} as const;

/** A stroke that fades in from nothing, rightwards from `from` over `run`. */
function Fade({ id, from, run, flip = false }: { id: string; from: number; run: number; flip?: boolean }) {
  return (
    <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={from} x2={from + run} y1="0" y2="0">
      <stop offset="0" stopColor="currentColor" stopOpacity={flip ? 1 : 0} />
      <stop offset="1" stopColor="currentColor" stopOpacity={flip ? 0 : 1} />
    </linearGradient>
  );
}

/** A node on its disc of page stock; it arrives with a small scale-in. */
function Node({ x, y = MID, hollow = false, o, s = 0.16 }: { x: number; y?: number; hollow?: boolean; o: number; s?: number }) {
  return (
    <g className="home-trust-pop" style={at(o, s)}>
      <circle cx={x} cy={y} r={HALO} className="fill-pp-bg" />
      <circle cx={x} cy={y} r={R} className={hollow ? "fill-pp-bg" : "fill-current"} {...solid} />
    </g>
  );
}

function Plate({ i, children }: { i: number; children: ReactNode }) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      fill="none"
      aria-hidden
      data-i={i}
      className="home-draw home-trust-fig block h-12 w-[112px] shrink-0 overflow-visible text-pp-ink"
    >
      {children}
    </svg>
  );
}

/* ─── We keep your transcripts in the EU ─────────────────────────── */

const EU = { left: 46, right: 110, node: 78 };

function Stored({ i }: { i: number }) {
  return (
    <Plate i={i}>
      <defs>
        <Fade id="home-trust-eu-in" from={0} run={30} />
      </defs>
      {/* The region: a border, so a dotted one. */}
      <rect
        x={EU.left}
        y={4}
        width={EU.right - EU.left}
        height={H - 8}
        rx={14}
        strokeOpacity={0.5}
        className="home-trust-wipe"
        style={at(0, 0.45)}
        {...dotted}
      />
      <path d={`M0 ${MID} H${EU.node - HALO}`} pathLength={1} style={at(0.2, 0.62)} {...solid} stroke="url(#home-trust-eu-in)" />
      <Node x={EU.node} o={0.78} />
    </Plate>
  );
}

/* ─── Hands the call to a person ─────────────────────────────────── */

const HAND = { agent: 54, person: 104 };
const WAYS = [6, MID, H - 6].map((y) =>
  y === MID
    ? `M0 ${MID} H${HAND.agent - HALO}`
    : `M0 ${y} C22 ${y} 28 ${MID} ${HAND.agent - HALO} ${MID}`,
);

function Handover({ i }: { i: number }) {
  return (
    <Plate i={i}>
      <defs>
        <Fade id="home-trust-hand-in" from={0} run={26} />
      </defs>
      {WAYS.map((d, k) => (
        <path
          key={d}
          d={d}
          pathLength={1}
          style={at([0.06, 0, 0.12][k], 0.5)}
          {...solid}
          stroke="url(#home-trust-hand-in)"
          strokeOpacity={k === 1 ? 1 : 0.7}
        />
      ))}
      <Node x={HAND.agent} hollow o={0.56} />
      {/* Only if it comes to that: dotted. */}
      <path
        d={`M${HAND.agent + HALO} ${MID} H${HAND.person - HALO}`}
        className="home-trust-wipe"
        style={at(0.66, 0.2)}
        strokeOpacity={0.6}
        {...dotted}
      />
      <Node x={HAND.person} o={0.84} />
    </Plate>
  );
}

/* ─── Tells every caller it is an AI ─────────────────────────────── */

/** Half-heights of the opening line's seven bars; the first two say it. */
const BARS = [9, 15, 11, 18, 7, 13, 5];
const BAR = { x0: 4, gap: 8 };
const TAIL = BAR.x0 + (BARS.length - 1) * BAR.gap + 10;

function Disclosure({ i }: { i: number }) {
  return (
    <Plate i={i}>
      <defs>
        <Fade id="home-trust-said-tail" from={TAIL} run={W - 4 - TAIL} flip />
      </defs>
      {BARS.map((h, k) => {
        const x = BAR.x0 + k * BAR.gap;
        const o = k * 0.075;
        return (
          // Each bar opens from the midline both ways, like a level.
          <g key={x} className={k < 2 ? "text-pp-accent" : undefined}>
            <path d={`M${x} ${MID} V${MID - h}`} pathLength={1} style={at(o, 0.3)} {...solid} />
            <path d={`M${x} ${MID} V${MID + h}`} pathLength={1} style={at(o, 0.3)} {...solid} />
          </g>
        );
      })}
      {/* The rest of the call, trailing off. */}
      <path
        d={`M${TAIL} ${MID} H${W - 4}`}
        className="home-trust-wipe"
        style={at(0.62, 0.3)}
        {...dotted}
        stroke="url(#home-trust-said-tail)"
      />
    </Plate>
  );
}

/* ─── An EU company, under EU law ────────────────────────────────── */

const PAGE = { x0: 1, x1: 33, y0: 4, y1: 44, fold: 9 };
/** Name, CUI, address; the CUI's line sits on the row's shared midline. */
const TEXT = [
  { y: MID - 7, x1: 21 },
  { y: MID, x1: 26 },
  { y: MID + 7, x1: 19 },
];
const LOOKUP = 104;

function Company({ i }: { i: number }) {
  const { x0, x1, y0, y1, fold } = PAGE;
  const cui = TEXT[1];
  return (
    <Plate i={i}>
      <path
        d={`M${x1 - fold} ${y0} H${x0} V${y1} H${x1} V${y0 + fold} Z`}
        pathLength={1}
        style={at(0, 0.55)}
        {...solid}
      />
      <path d={`M${x1 - fold} ${y0} V${y0 + fold} H${x1}`} pathLength={1} style={at(0.42, 0.16)} {...solid} />
      {TEXT.map((t, k) => (
        <path
          key={t.y}
          d={`M${x0 + 6} ${t.y} H${t.x1}`}
          pathLength={1}
          style={at(0.5 + k * 0.08, 0.14)}
          strokeOpacity={k === 1 ? 1 : 0.4}
          {...solid}
        />
      ))}
      {/* The registration number, led out to where it can be looked up. */}
      <path
        d={`M${x1 + 5} ${cui.y} H${LOOKUP - HALO}`}
        className="home-trust-wipe"
        style={at(0.74, 0.16)}
        strokeOpacity={0.6}
        {...dotted}
      />
      <Node x={LOOKUP} y={cui.y} hollow o={0.88} s={0.12} />
    </Plate>
  );
}

export function TrustFigure({ id, i }: { id: TrustFigureId; i: number }) {
  switch (id) {
    case "eu":
      return <Stored i={i} />;
    case "handover":
      return <Handover i={i} />;
    case "languages":
      return <Disclosure i={i} />;
    case "company":
      return <Company i={i} />;
  }
}
