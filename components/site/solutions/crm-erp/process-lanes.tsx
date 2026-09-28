import { memo, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { TYPE } from "@/components/site/home/type";
import { CheckGlyph } from "@/components/site/solutions/custom-saas-platforms/check-line";
import type { CheckKind, Handoff, Kind, ProcessData, ProcessStep } from "@/lib/pages/crm-erp";
import { HandGlyph, StepGlyph } from "./glyphs";
import { PaperFace } from "./papers";
import type { DrawFrame } from "./process-frame";
import { CARD, DOT, LABEL_W, LANES_BOX, LANE_H, PAPER, cardRect, connector, handoff, paperRect, pct } from "./process-geometry";

/* ------------------------------------------------------------------ *
 * #process — the drawing, from lg: the sample business's eight tools
 * scattered as papers (Today), and the same eight as cards in lanes of
 * who does what, joined in the order a customer's order takes (One
 * system). The stage's full width, in a box of fixed aspect
 * (process-geometry.ts), so nothing here is ever measured.
 *
 * EIGHT SHEETS, THE SAME ELEMENTS IN BOTH VIEWS. A sheet is one step:
 * its backing (the white card or paper, its edge and its shadow), its
 * card face (the number, the kind node, the glyph and the label) and its
 * paper face (a drawing of where it lives, its title, where it lives and
 * what goes wrong there), of which the view shows one. Each view's place
 * (a `translate()` of the sheet's box from the drawing's top left, and
 * the paper's turn) is read by erp-drawing.css from custom properties set
 * here from the geometry, in its units; the stage's `data-view` picks the
 * pair. No layout box moves between the views, so a view change is no
 * layout shift, and the sheets are never re-rendered into new places,
 * only restyled: the stage's timeline (process-timeline.ts) flies each
 * from where it was to where it is, from the geometry, measuring none.
 * Each face keeps its own size (a share of the drawing's width,
 * erp-drawing.css §2), centred on its sheet, while the sheet flies, so no
 * word rewraps mid-flight and the face fading out stays where it was.
 *
 * FROM BACK TO FRONT: the four lane bands (a fill that sweeps in with
 * one system, a hairline, the label in the left column); the hand-offs
 * between papers (Today only), under the papers, so each curve leaves
 * from under one and arrives at the next's edge with its arrowhead; the
 * sheets; the connectors between cards (One system only), over them,
 * since they only meet a card at its edge and the travelling dot must
 * land on it, not under it; and the hand-offs' marks ("Typed again",
 * "Counted by hand"), over everything, since in the consolidation they
 * fly to the record window's pill.
 *
 * WHAT THE STAGE SETS (DrawFrame, process-frame.ts): each sheet's state
 * (`rest`, `route` while the dot rides to it, `lit` for the step on
 * show, `visited` for one passed) and each connector's trace (`rest`
 * hidden, `route` faint on the way, `on`). What GSAP moves, and only in
 * travel (the stage's timelines): the sheets' flight, a trace's dash,
 * the dot (`.erp-dot`, resting at opacity 0: the lit card carries the
 * step), the ping round a card that has arrived, and the marks' pop and
 * flight. The drawing's DOM contract with the timeline, from the build
 * spec (§8.1): `.erp-sheet[data-step][data-kind][data-state]` with
 * `.erp-sheet-card`, `.erp-sheet-paper` and `.erp-ping`; `path#erp-c-<i>`
 * and `path.erp-trace[data-edge][data-state][pathLength="1"]`; one
 * `.erp-dot`; `.erp-mark[data-handoff]`; `.erp-lane-fill` with `--k`.
 *
 * aria-hidden, the whole of it: the rail, the caption card, the record
 * panel, the legend and the index say what it shows in words.
 *
 * PURE: no hooks, types only from the data module. The stage (a client
 * island) renders it from the frame, so the server's HTML draws the
 * finished frame, and every frame after is React's. Memoised: while the
 * other composition is on show (`live` false: this one is display:none),
 * a new frame skips it, and it catches up the moment it shows.
 * ------------------------------------------------------------------ */

/** What both compositions take: the steps, the lanes, the hand-offs and their marks' words, the frame, and whether this one is on show. */
export type DrawingProps = {
  steps: readonly ProcessStep[];
  lanes: ProcessData["lanes"];
  handoffs: readonly Handoff[];
  marks: ProcessData["marks"];
  frame: DrawFrame;
  /** The composition on show (the stage's width class): false, a new frame skips it. Unset, always drawn. */
  live?: boolean;
};

/** A composition not on show, before and after: nothing of it to redraw until it shows. */
export const sameWhileHidden = (a: DrawingProps, b: DrawingProps) => a.live === false && b.live === false;

const { w: W, h: H } = LANES_BOX;

/**
 * Each kind's node on a card, the legend's own (glyphs.tsx `ErpTag`):
 * filled for "Runs here", hollow for "Partly here", dotted for "Built for
 * yours", in settled green, muted and violet on the white card (5.50,
 * 6.37, 7.10: marks, beside words the caption card says).
 */
const NODE: Record<Kind, { glyph: CheckKind; tone: string }> = {
  does: { glyph: "site", tone: "text-(--home-settled)" },
  thin: { glyph: "call", tone: "text-(--home-muted)" },
  none: { glyph: "handover", tone: "text-(--home-violet)" },
};

/** The lane each step is on, as an index into the lanes (top to bottom). */
export const laneIndex = (lanes: ProcessData["lanes"], s: ProcessStep) => lanes.findIndex((l) => l.id === s.lane);

/** A step's index, from its id. */
const stepAt = (steps: readonly ProcessStep[], id: string) => steps.findIndex((s) => s.id === id);

/**
 * The card face: the step's number, its kind's node, its glyph and its
 * label, as four children each composition lays out its own way
 * (erp-drawing.css §2 and §5): on the lanes the number and the node over
 * the glyph and the label; in the list's rows all four on one line.
 */
export function SheetCard({ step }: { step: ProcessStep }) {
  return (
    <span className="erp-sheet-card">
      <span className={cn(TYPE.mono, "erp-card-n text-(--home-violet)")}>{step.n}</span>
      <CheckGlyph kind={NODE[step.kind].glyph} className={cn("erp-glyph erp-card-node", NODE[step.kind].tone)} />
      <StepGlyph id={step.id} className="erp-card-glyph text-(--home-electric)" />
      <span className="erp-card-label">{step.label}</span>
    </span>
  );
}

/** The paper face: where the step lives today, drawn, then its title, where it lives, and what goes wrong there. */
export function SheetPaper({ step }: { step: ProcessStep }) {
  return (
    <span className="erp-sheet-paper">
      <span className="erp-paper-face">
        <PaperFace face={step.paper.face} />
      </span>
      <span className="erp-paper-title">{step.paper.title}</span>
      <span className={cn(TYPE.mono, "erp-paper-where")}>{step.paper.where}</span>
      <span className="erp-paper-pain">{step.paper.pain}</span>
    </span>
  );
}

/** A sheet's backing: the white card or paper, its edge (by state) and its shadow, which the flight scales between the two sizes. */
export function SheetBacking() {
  return <span className="erp-sheet-bg" />;
}

/** A hand-off's mark: the hand and its words, in a white pill. */
export function Mark({ index, words, style }: { index: number; words: string; style?: CSSProperties }) {
  return (
    <span className="erp-mark" data-handoff={index} style={style}>
      <HandGlyph className="text-(--home-ember)" />
      <span>{words}</span>
    </span>
  );
}

export const ProcessLanes = memo(function ProcessLanes({ steps, lanes, handoffs, marks, frame }: DrawingProps) {
  const onLane = steps.map((s) => laneIndex(lanes, s));
  const edges = steps.slice(1).map((_, i) => connector(i, onLane));
  const hands = handoffs.map((h) => handoff(stepAt(steps, h.from), stepAt(steps, h.to)));
  // The box's unit (the box is a container: 1u = 0.1cqw, across and down), and each face's own size, a
  // share of the drawing's width, so a face never rewraps while its sheet flies between the two sizes.
  const faces = {
    "--u": `${100 / W}cqw`,
    "--card-w": `${(CARD.w / W) * 100}cqw`,
    "--card-h": `${(CARD.h / W) * 100}cqw`,
    "--paper-w": `${(PAPER.w / W) * 100}cqw`,
    "--paper-h": `${(PAPER.h / W) * 100}cqw`,
  } as CSSProperties;

  return (
    <div className="erp-lanes" style={faces}>
      {/* The lanes: a fill (swept in with one system), a hairline above, the label on the left. */}
      {lanes.map((l, k) => (
        <div key={l.id} className="erp-lane" style={{ top: pct(k * LANE_H, H), height: pct(LANE_H, H) }}>
          <span
            className="erp-lane-fill"
            data-odd={k % 2 === 1 ? "" : undefined}
            data-last={k === lanes.length - 1 ? "" : undefined}
            style={{ "--k": k } as CSSProperties}
          />
          <span className={cn(TYPE.label, "erp-lane-label")} style={{ width: pct(LABEL_W, W) }}>
            {l.label}
          </span>
        </div>
      ))}

      {/* Today's hand-offs, under the papers: each leaves from under one and arrives at the next's edge. */}
      <svg viewBox={`0 0 ${W} ${H}`} className="erp-hands" fill="none">
        {hands.map((h, i) => (
          <g key={handoffs[i].from + handoffs[i].to}>
            <path d={h.d} className="erp-hand" />
            <path d="M-6 -4 L0 0 L-6 4" className="erp-hand-tip" transform={`translate(${h.tip.x} ${h.tip.y}) rotate(${h.tip.angle})`} />
          </g>
        ))}
      </svg>

      {/* The sheets: each view's place from the geometry, in its units (erp-drawing.css §2 reads the pair the view names). */}
      {steps.map((s, i) => {
        const card = cardRect(i, onLane[i]);
        const paper = paperRect(i);
        const place = {
          "--cx": card.x,
          "--cy": card.y,
          "--px": paper.x,
          "--py": paper.y,
          "--pr": `${paper.turn}deg`,
        } as CSSProperties;
        return (
          <div key={s.id} className="erp-sheet" data-step={s.id} data-kind={s.kind} data-state={frame.sheets[i]} style={place}>
            <SheetBacking />
            <SheetCard step={s} />
            <SheetPaper step={s} />
            <span className="erp-sheet-here" />
            <span className="erp-ping" />
          </div>
        );
      })}

      {/* One system's connectors, over the cards they meet at the edge: a base, and its trace. The dot rides them. */}
      <svg viewBox={`0 0 ${W} ${H}`} className="erp-wires" fill="none">
        {edges.map((d, i) => (
          <path key={i} id={`erp-c-${i}`} d={d} className="erp-wire" />
        ))}
        {edges.map((d, i) => (
          <path key={i} d={d} pathLength={1} data-edge={i} data-state={frame.edges[i]} className="erp-trace" />
        ))}
        <circle cx={0} cy={0} r={DOT.r} className="erp-dot" />
      </svg>

      {/* The marks, at the middle of their curves. */}
      {handoffs.map((h, i) => (
        <Mark key={h.from + h.to} index={i} words={marks[h.mark]} style={{ left: pct(hands[i].mid.x, W), top: pct(hands[i].mid.y, H) }} />
      ))}
    </div>
  );
}, sameWhileHidden);
