import { memo, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { TYPE } from "@/components/site/home/type";
import { LIST, PILE_PAPER, listRow, pileRect } from "./process-geometry";
import { Mark, SheetBacking, SheetCard, SheetPaper, sameWhileHidden, type DrawingProps } from "./process-lanes";

/* ------------------------------------------------------------------ *
 * #process — the drawing, below lg: the same eight sheets as the lanes
 * (process-lanes.tsx), laid for a narrower stage. 512px tall at every
 * width and in both views, so the stage never changes height with them.
 *
 * ONE SYSTEM: eight rows of 64px, in the order the customer's order
 * takes. Down the left, a 24px rail with a node on each row (the list's
 * connectors: the dot rides it from row to row); then the lane that does
 * the step, a mono chip; then the step's card (its glyph, number, label
 * and kind node), filling the rest of the row. The lanes' columns become
 * the rows' order, and their lanes the chips: who does each step is
 * still said on every row.
 *
 * TODAY: the same sheets as a loose pile of papers, two across and four
 * down in 128px cells, each turned 2° one way or the other; the strip
 * drawing where each lives shows from sm, where the papers are wide
 * enough for it. There are no curves between them here: each hand-off's
 * mark ("Typed again", "Counted by hand") sits on the corner of the
 * paper it hands to.
 *
 * Every place is set from the geometry as custom properties
 * (erp-drawing.css §5 reads the pair the view names, as a `translate()`
 * of each sheet's box from the list's top left, so no layout box moves),
 * the sheets are the same elements in both views, and the stage's
 * timeline flies them between the two, as on the lanes. The nodes on the rail take their state from the sheets'
 * (a passed step's node filled, the step on show's ringed, the one the
 * dot rides to faint), since the card beside each already says it.
 *
 * aria-hidden with the rest of the drawing (process-stage.tsx). PURE: no
 * hooks, types only from the data module. Memoised as the lanes are: a
 * new frame skips it while the lanes are on show.
 * ------------------------------------------------------------------ */

/** A hand-off mark's place in the pile: the top corner of the paper it hands to, on the side away from the other column. */
function markAt(step: number): CSSProperties {
  const p = pileRect(step);
  return {
    top: `${p.y}px`,
    ...(p.x === 0 ? { left: "12px" } : { right: "8px" }),
  };
}

export const ProcessList = memo(function ProcessList({ steps, lanes, handoffs, marks, frame }: DrawingProps) {
  const laneOf = (id: string) => lanes.find((l) => l.id === id)?.label ?? id;
  const stepAt = (id: string) => steps.findIndex((s) => s.id === id);

  return (
    <div className="erp-list" style={{ height: `${LIST.h}px` }}>
      {/* The rail down the left, its node per row, and the dot that rides it. */}
      <span className="erp-list-rail" />
      {steps.map((s, i) => (
        <span key={s.id} className="erp-list-node" data-state={frame.sheets[i]} style={{ top: `${listRow(i).y + LIST.row / 2}px` }} />
      ))}

      {/* Who does each step: the lane, a chip at the head of its row. */}
      {steps.map((s, i) => (
        <span key={s.id} className={cn(TYPE.mono, "erp-list-lane")} style={{ top: `${listRow(i).y + LIST.row / 2}px` }}>
          {laneOf(s.lane)}
        </span>
      ))}

      {steps.map((s, i) => {
        const pile = pileRect(i);
        const place = {
          "--ly": `${listRow(i).y}px`,
          // The pile's two columns, 8px apart: the list is a container, so 50cqw is half its width.
          "--qx": pile.x === 0 ? "0px" : `calc(50cqw + ${PILE_PAPER.gap / 2}px)`,
          "--qy": `${pile.y}px`,
          "--qr": `${pile.turn}deg`,
        } as CSSProperties;
        return (
          <div key={s.id} className="erp-sheet" data-step={s.id} data-kind={s.kind} data-state={frame.sheets[i]} style={place}>
            <SheetBacking />
            <SheetCard step={s} />
            <SheetPaper step={s} />
            <span className="erp-ping" />
          </div>
        );
      })}

      <span className="erp-dot" style={{ top: `${LIST.row / 2}px` }} />

      {handoffs.map((h, i) => (
        <Mark key={h.from + h.to} index={i} words={marks[h.mark]} style={markAt(stepAt(h.to))} />
      ))}
    </div>
  );
}, sameWhileHidden);
