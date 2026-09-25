import { Check } from "lucide-react";
import type { BlockKind, KindInfo, RunLens } from "@/lib/pages/custom-automations";
import { cn } from "@/lib/utils";
import { KindGlyph } from "./glyphs";
import { boxOf, edgePath, groupBox, labelAt, pinned, placed, VIEW, viewH } from "./workbench-geometry";
import { edgeState, nodeState, type Frame } from "./workbench-frame";

/* ------------------------------------------------------------------ *
 * #running — the map (xl and up): the flow that does the lane's steps,
 * drawn as blocks on one sheet, joined by the lines the run travels.
 *
 * TWO LAYERS, ONE BOX, as the SaaS explorer's map. An <svg viewBox="0 0
 * 1000 h"> carries the lines, the morning lens's frames, the rings the
 * tour pings and the beads that ride a hop; HTML buttons carry the
 * cards, laid over it at their workbench-geometry boxes as percentages
 * of the same aspect-ratio box, so the two meet exactly. The box is as
 * tall as the lens's rows (`viewH`: 344u for three, 220u for two), set
 * inline, so a lens that uses two leaves no empty row under its flow;
 * it changes only with the lens, on the reader's own pick. The cards are
 * HTML because their words are text (find-in-page, a translation, the
 * reader's own font size reach them); the lines are SVG because DrawSVG
 * and MotionPath need paths.
 *
 * EACH LINE IS DRAWN TWICE: a base line, a hairline that shows once both
 * its ends are laid (`data-built`) and turns faint electric while it
 * lies on the run's route (`data-route`); and over it a trace in full
 * electric, shown once the run has travelled it (`data-on`). The tour
 * draws a trace in as the bead rides it; the frame, not the tour,
 * decides that it stays lit. A branch's word ("yes", "no") sits beside
 * its line in electric, and shows with it.
 *
 * A CARD reads its block from the frame (auto-running.css §2): a dashed
 * ghost until the block is laid; solid once built; faint electric on the
 * route; ink once the run has passed it, with a settled tick in its
 * corner; current, an electric ring that eases in, with the Running
 * pill hanging off its foot (the workbench flies the pill from card to
 * card with Flip). A card says what kind of block it is (the glyph and
 * its tag, "Once", "Writes"), what it does (its label), a figure where
 * the lens gives one ("signed · 3 tries"), and, as badges, the numbers
 * of the manual steps it replaced: hollow until each is handed over,
 * electric after, where the lane's disc lands as the flow is built. A
 * branch that ends is a shorter card, dashed, with its label alone. The
 * reader's own pick is an ink ring outside all of that, which closes in
 * once.
 *
 * NOT FOR THE KEYBOARD OR A SCREEN READER. The map is aria-hidden and
 * its cards are out of the tab order: the run log, the inspector and the
 * index below carry every block in words, and the caption says what each
 * step does. A pointer may pick a card, which holds it in the inspector.
 *
 * PURE: no hooks, no "use client". The workbench renders it with its
 * frame; everything it shows is a function of those props, and the
 * `data-auto-*` attributes are the timeline's handles, never state.
 * ------------------------------------------------------------------ */

/** A card's corner in user units: 12px at the map's 1.12px a unit. */
const RING_RX = 11;
/** A group frame's corner. */
const GROUP_RX = 14;

const MONO = "font-[family-name:var(--font-geist-mono)] tabular-nums";

export function FlowMap({
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
  const number = (id: string) => lens.manual.findIndex((m) => m.id === id) + 1;
  const groups = (lens.groups ?? []).map((g) => ({ ...g, box: groupBox(lens, g.id) }));
  const edges = lens.edges.map((e) => ({ e, d: edgePath(lens, e), s: edgeState(lens, frame, e) }));
  const h = viewH(lens);

  return (
    <div className="auto-map relative mt-3" style={{ aspectRatio: `${VIEW.w} / ${h}` }}>
      <svg
        aria-hidden
        viewBox={`0 0 ${VIEW.w} ${h}`}
        className="pointer-events-none absolute inset-0 size-full overflow-visible"
      >
        {groups.map((g) => (
          <rect
            key={g.id}
            className="auto-frame"
            data-on={frame.entered.has(g.id) ? "" : undefined}
            data-built={frame.laid.size > 0 ? "" : undefined}
            x={g.box.x}
            y={g.box.y}
            width={g.box.w}
            height={g.box.h}
            rx={GROUP_RX}
          />
        ))}
        {edges.map(({ e, d, s }) => (
          <path
            key={e.id}
            className="auto-edge"
            data-auto-edge={e.id}
            data-built={s.built ? "" : undefined}
            data-route={s.route ? "" : undefined}
            d={d}
          />
        ))}
        {edges.map(({ e, d, s }) => (
          <path key={e.id} className="auto-trace" data-auto-trace={e.id} data-on={s.on ? "" : undefined} d={d} />
        ))}
        {lens.nodes.map((n) => {
          const b = boxOf(n);
          return (
            <rect
              key={n.id}
              className="auto-ring"
              data-auto-ring={n.id}
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              rx={RING_RX}
            />
          );
        })}
        {/* Two beads: the morning's last step fans in along two lines at once. */}
        {[0, 1].map((i) => (
          <g key={i} className="auto-bead" data-i={i}>
            <circle r={13} className="auto-bead-halo" />
            <circle r={7} />
          </g>
        ))}
      </svg>

      {groups.map((g) => (
        <span
          key={g.id}
          aria-hidden
          className="auto-group-tab absolute -translate-y-1/2 px-1.5 text-[11px] leading-4 font-medium tracking-[0.14em] whitespace-nowrap uppercase"
          data-on={frame.entered.has(g.id) ? "" : undefined}
          data-built={frame.laid.size > 0 ? "" : undefined}
          style={pinned(g.box.x + 12, g.box.y, h)}
        >
          {g.label}
        </span>
      ))}

      {edges.map(({ e, s }) => {
        const at = labelAt(lens, e);
        if (!at) return null;
        return (
          <span
            key={e.id}
            aria-hidden
            className={cn(
              MONO,
              "auto-branch absolute text-[10px] leading-3",
              at.side === "right" ? "-translate-y-1/2" : "-translate-x-1/2 -translate-y-full",
            )}
            data-built={s.built ? "" : undefined}
            style={pinned(at.x, at.y, h)}
          >
            {e.label}
          </span>
        );
      })}

      {lens.nodes.map((n) => {
        const state = nodeState(frame, n);
        const current = state === "current";
        return (
          <button
            key={n.id}
            type="button"
            tabIndex={-1}
            aria-hidden
            data-auto-node={n.id}
            data-state={state}
            data-picked={picked === n.id ? "" : undefined}
            className={cn(
              "auto-node absolute flex cursor-pointer flex-col justify-center rounded-[12px] px-2.5 text-left",
              n.end ? "auto-end py-1" : "py-[5px]",
            )}
            style={placed(boxOf(n), h)}
            onClick={() => onPick(n.id)}
            // A press keeps focus where it was: this is aria-hidden, and focus
            // landing on it would be lost to a screen reader.
            onMouseDown={(e) => e.preventDefault()}
          >
            <span className="auto-pick" />
            {/* Passed: a settled tick on the card's corner, clear of its tag and badges. */}
            {!n.end && (
              <span className="auto-tick absolute -top-2 -right-2 grid size-4 place-items-center rounded-full bg-white">
                <Check className="size-3" strokeWidth={3} />
              </span>
            )}
            {n.end ? (
              <span className="auto-node-label line-clamp-2 text-[12px] leading-4">{n.label}</span>
            ) : (
              <>
                <span className="flex h-4 min-w-0 items-center gap-1">
                  <KindGlyph kind={n.kind} className="size-3.5 text-(--home-electric)" />
                  <span className={cn(MONO, "auto-node-tag min-w-0 truncate text-[10px] leading-3 tracking-[0.06em] uppercase")}>
                    {copy.kinds[n.kind].tag}
                  </span>
                  <span data-auto-badge={n.id} className="ml-auto flex shrink-0 items-center gap-0.5">
                    {(n.was ?? []).map((m) => (
                      <span
                        key={m}
                        data-m={m}
                        className={cn(MONO, "auto-badge grid size-4 place-items-center rounded-full text-[9px] leading-none")}
                        data-handed={frame.handed.has(m) ? "" : undefined}
                      >
                        {number(m)}
                      </span>
                    ))}
                  </span>
                </span>
                <span className="auto-node-label mt-0.5 line-clamp-2 text-[12.5px] leading-4 font-medium">{n.label}</span>
                {n.datum && (
                  <span className={cn(MONO, "auto-node-datum truncate text-[10px] leading-[13px]")}>{n.datum}</span>
                )}
              </>
            )}
            {current && (
              <span
                className="auto-pill absolute right-2 -bottom-2.5 rounded-full px-2 text-[11px] leading-4 font-medium whitespace-nowrap"
                data-flip-id="auto-pill"
              >
                {copy.pill}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
