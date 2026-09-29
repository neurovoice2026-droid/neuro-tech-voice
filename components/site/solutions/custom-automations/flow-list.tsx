import type { BlockKind, KindInfo, RunLens } from "@/lib/pages/custom-automations";
import { cn } from "@/lib/utils";
import { HandGlyph, KindGlyph } from "./glyphs";
import { nodeState, pad2, pathOrder, type Frame, type Row } from "./workbench-frame";

/* ------------------------------------------------------------------ *
 * #running — the list (below xl): the same flow as the map, one row per
 * block, top to bottom in the order the run first reaches it.
 *
 * Below 1280px the map's cards would shrink under their words and the
 * hand lane's four windows would crowd, so the drawing gives way to a
 * list that holds both at once: each row is a block of the flow, and
 * beside or under its label, the manual steps it replaced — "was" chips:
 * a hand, the step's number and its words — or, for a block nobody did
 * by hand, the line saying what by hand lacked. What a lens does is told
 * as on the map, from the same frame: a row is a dashed ghost until its
 * block is laid, then built, on the route, passed or current (lifted
 * onto white inside an electric ring, as the map's current card is); its
 * chips are hollow until the step is handed over, then slide the last
 * 8px into place and turn electric; the Running pill sits in the current
 * row's tag line, right after its tag.
 *
 * THE RAIL. A 2px rail runs down the left gutter through a 12px ring per
 * block. Each row owns the rail from its ring down to the next one
 * (`.auto-seg`), which fills electric, top first, once the run has
 * passed its block (a CSS `scale` transition driven by the frame): so
 * the fill reaches the ring the run is on and stops there. A branch that
 * ends, and a group's header, carry the rail past them for the block
 * above. In the tour a bead rides the rail from ring to ring
 * (workbench-timeline.ts), and the ring it reaches pings. The rail's
 * cell sits inside its row's padding (8px above; 8px below a block's
 * row, none below a header's), so the track reaches out through that
 * padding to the row's edges and each segment reaches through it to the
 * next ring's centre: one unbroken line, the first ring to the last.
 *
 * A branch that ends sits under the block it leaves, indented on a
 * dashed hook, its branch's word ("no") in mono before its label, as the
 * map sets the word beside its line; the morning lens's frames are
 * header rows, "In order" and "Side by side", with a 2px bracket down
 * their blocks.
 *
 * FIXED HEIGHT. A row's height depends on its words alone, never on its
 * state: the tag line keeps the pill's 20px whether or not it shows, the
 * chips are always there, and nothing a state changes takes room. So the
 * list is as tall as its lens, whatever the tour has reached, and the
 * reserve that holds the section (deferred.tsx) holds through a tour.
 * From md the chips stand beside the label, so a row is hardly taller
 * than its longest chip and the list fills the stage's width.
 *
 * Like the map the rows are aria-hidden and out of the tab order; the
 * run log, the inspector and the index carry them in words. A pointer
 * may pick a row, which holds its block in the inspector.
 *
 * PURE: no hooks, no "use client".
 * ------------------------------------------------------------------ */

const MONO = "font-[family-name:var(--font-geist-mono)] tabular-nums";

/**
 * The rail's column and the gap after it. A ring's centre sits 12px in and
 * 18px down the rail's cell, which starts inside the row's 8px top padding:
 * 26px down the row.
 */
const ROW = "grid grid-cols-[24px_minmax(0,1fr)] gap-x-3";

/** A row's padding round the rail's cell, above and below, for the rail to reach through. */
const PAD = 8;
/** A ring's centre, down the rail's cell. */
const RING = 18;
/** The foot of a branch end's hook, down the rail's cell (its 1px line sits at 9px). */
const HOOK = 10;

export function FlowList({
  lens,
  frame,
  picked,
  onPick,
  copy,
}: {
  lens: RunLens;
  frame: Frame;
  picked: string | null;
  onPick: (id: string) => void;
  copy: { kinds: Record<BlockKind, KindInfo>; pill: string };
}) {
  const rows = pathOrder(lens);
  const manual = new Map(lens.manual.map((m, i) => [m.id, { ...m, n: i + 1 }]));
  // The block whose passing fills each row's stretch of rail: its own, or the one above it.
  const fills: (string | null)[] = [];
  let above: string | null = null;
  for (const r of rows) {
    if (r.kind === "node") above = r.node.id;
    fills.push(r.kind === "end" ? r.from : above);
  }
  // Where each group's bracket ends: its last row.
  const groupEnd = new Map<string, number>();
  rows.forEach((r, i) => {
    if (r.kind !== "group" && r.group) groupEnd.set(r.group, i);
  });

  const rail = (i: number, row: Row) => {
    const last = i === rows.length - 1;
    const fill = fills[i];
    // A header's row has no bottom padding; a block's has 8px.
    const below = row.kind === "group" ? 0 : PAD;
    return (
      <span aria-hidden className="relative block">
        {/* The track: from the first ring's centre, through every row's padding, to the last
            ring's centre (the last row's top edge + 26px), or its hook if it ends. */}
        <span
          className="auto-rail absolute left-[11px] w-0.5"
          style={{
            top: i === 0 ? RING : -PAD,
            ...(last ? { height: PAD + (row.kind === "end" ? HOOK : RING) } : { bottom: -below }),
          }}
        />
        {!last && (
          // From this row's ring down through its padding and the next row's to the next ring's centre.
          <span
            className="auto-seg absolute left-[11px] w-0.5"
            style={{ top: RING, bottom: -(below + PAD + RING) }}
            data-on={fill !== null && frame.passed.has(fill) ? "" : undefined}
          />
        )}
        {row.kind === "node" && (
          <>
            <span className="auto-rail-dot absolute top-3 left-1.5 size-3 rounded-full" data-state={nodeState(frame, row.node)} />
            <span data-auto-ring={row.node.id} className="auto-ring-dot absolute top-3 left-1.5 size-3 rounded-full" />
          </>
        )}
      </span>
    );
  };

  return (
    <div data-auto-rows className="relative isolate mt-4">
      {rows.map((row, i) => {
        if (row.kind === "group") {
          return (
            <div key={`group-${row.id}`} aria-hidden className={cn(ROW, "min-h-9 pt-2")}>
              {rail(i, row)}
              <span className="relative block pl-4">
                <span className="auto-bracket absolute top-2 bottom-0 left-0 w-0.5 rounded-t-full" />
                <span className="block text-[11px] leading-4 font-medium tracking-[0.14em] text-pp-muted uppercase">
                  {row.label}
                </span>
              </span>
            </div>
          );
        }
        const { node } = row;
        const state = nodeState(frame, node);
        const last = row.group !== undefined && groupEnd.get(row.group) === i;
        return (
          <button
            key={node.id}
            type="button"
            tabIndex={-1}
            aria-hidden
            data-auto-node={node.id}
            data-state={state}
            data-picked={picked === node.id ? "" : undefined}
            className={cn(ROW, "auto-row relative min-h-11 w-full cursor-pointer rounded-xl py-2 pr-2 text-left")}
            onClick={() => onPick(node.id)}
            // A press keeps focus where it was: this is aria-hidden, and focus
            // landing on it would be lost to a screen reader.
            onMouseDown={(e) => e.preventDefault()}
          >
            <span className="auto-pick" />
            {rail(i, row)}
            <span className={cn("relative block min-w-0", row.group && "pl-4")}>
              {row.group && (
                <span
                  className={cn("auto-bracket absolute left-0 w-0.5", last ? "-top-2 bottom-2 rounded-b-full" : "-inset-y-2")}
                />
              )}
              {row.kind === "end" ? (
                <span className="relative flex min-h-7 items-start gap-2 pl-7">
                  <span className="auto-hook absolute top-[9px] -left-[23px] w-[47px] border-t border-dashed" />
                  <span className="auto-end-dot mt-[5px] size-2 shrink-0 rounded-full border border-dashed" />
                  <span className="min-w-0 text-[13px] leading-[18px] text-pp-muted">
                    {row.label && <span className={cn(MONO, "auto-branch mr-2 text-[11px]")}>{row.label}</span>}
                    {node.label}
                  </span>
                </span>
              ) : (
                <span className="block min-w-0 md:grid md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-x-6 lg:gap-x-8">
                  <span className="block min-w-0">
                    <span className="flex h-5 min-w-0 items-center gap-1.5">
                      <KindGlyph kind={node.kind} className="size-3.5 text-(--home-electric)" />
                      <span className={cn(MONO, "min-w-0 truncate text-[10px] leading-3 tracking-[0.06em] text-pp-muted uppercase")}>
                        {copy.kinds[node.kind].tag}
                      </span>
                      {/* Right after the tag, near the label it speaks for, in the tag line's own 20px. */}
                      <span className="ml-1 flex h-5 shrink-0 items-center">
                        {state === "current" && (
                          <span
                            className="auto-pill rounded-full px-2 text-[11px] leading-4 font-medium whitespace-nowrap"
                          >
                            {copy.pill}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="auto-row-label mt-0.5 block text-[15px] leading-[22px] text-pretty">{node.label}</span>
                  </span>
                  {/* From md beside the label, level with it. */}
                  <span className="mt-1.5 block min-w-0 md:mt-0 md:pt-5">
                    {node.was?.length ? (
                      <span className="flex flex-col items-start gap-1">
                        {node.was.map((m) => {
                          const step = manual.get(m);
                          if (!step) return null;
                          return (
                            <span
                              key={m}
                              className="auto-was flex max-w-full items-start gap-1.5 rounded-lg px-2 py-1"
                              data-handed={frame.handed.has(m) ? "" : undefined}
                            >
                              <HandGlyph className="auto-was-hand mt-0.5 size-3.5" />
                              <span className={cn(MONO, "auto-was-n shrink-0 text-[11px] leading-[18px]")}>{pad2(step.n)}</span>
                              <span className="min-w-0 text-[13px] leading-[18px] text-pretty text-pp-ink">{step.text}</span>
                            </span>
                          );
                        })}
                      </span>
                    ) : node.fresh ? (
                      <span className="block text-[13px] leading-[18px] text-pretty text-pp-muted md:pt-1">
                        {node.fresh}
                      </span>
                    ) : null}
                  </span>
                </span>
              )}
            </span>
          </button>
        );
      })}
      {/* The bead that rides the rail in the tour: GSAP's alone, invisible at rest. */}
      <span aria-hidden className="auto-bead-list absolute top-0 left-[7.5px] size-[9px] rounded-full" />
    </div>
  );
}
