import type { ExplorerData, PartId } from "@/lib/pages/custom-saas-platforms";
import { cn } from "@/lib/utils";
import { TYPE } from "@/components/site/home/type";
import { CARD, EDGES, EDGE_IDS, PLACE, cardBox, edgePath } from "./map-geometry";
import { stateOf, type Frame } from "./explorer-frame";

/* ------------------------------------------------------------------ *
 * #platform — the map composition (xl and up): the platform drawn as
 * seventeen cards on one sheet, joined by the twenty connections the
 * code makes between them.
 *
 * TWO LAYERS, ONE BOX. An <svg viewBox="0 0 1000 490"> carries the
 * lines, and HTML buttons carry the cards, laid over it at their
 * map-geometry boxes as percentages of the same aspect-ratio box, so the
 * two meet exactly. The cards are HTML because their words are text (a
 * browser's find-in-page, a translation, the reader's own font size all
 * reach them); the lines are SVG because DrawSVG and MotionPath need
 * paths. Each edge is drawn twice: a base line, hairline ink, faint
 * electric while it lies on the lens's route (`data-route`); and over it
 * a trace in full electric, shown once the lens has travelled it
 * (`data-on`). The tour draws a trace in as the bead rides it; the
 * frame, not the tour, decides that it stays lit. No `vector-effect` on
 * either: DrawSVG measures in user units.
 *
 * Above the lines, in the SVG: one ring per card, invisible at rest,
 * which the tour pings as a hop arrives; and the bead, which rides each
 * hop (explorer-timeline.ts). Both are GSAP's alone and hold no state.
 *
 * A CARD reads its part's state from the frame (saas-explorer.css):
 * at rest a hairline; on the lens's route a firmer one; passed, ink;
 * current, an electric ring that eases in. The reader's own pick in the
 * inspector is an ink outline outside all of those, which pulses in
 * once, so a card brought to the screen from elsewhere on the page is
 * found at a glance. A grant part
 * (Cartesia, ElevenLabs) carries a violet GRANT tag. A part that has
 * failed has its name struck through in ember — a short stroke that
 * draws itself across the name (a CSS `scale`, so it needs no GSAP and
 * reads finished under reduced motion) — and its figure gives way to the
 * word FAILED (DOWN in "Take a part down"), so the state is never colour
 * alone. The Speaking pill hangs off the bottom right of whichever voice
 * is speaking; the explorer flies it between cards with Flip.
 *
 * NOT FOR THE KEYBOARD OR A SCREEN READER. The whole drawing is
 * aria-hidden and its cards are out of the tab order (tabIndex −1): the
 * same parts, their words and a "Show it on the drawing" button are in
 * the explorer's index below, which is the keyboard's and the screen
 * reader's way through, and the caption says in words what each step
 * shows. A pointer may still pick a card, which holds it in the
 * inspector.
 *
 * PURE: no hooks, no "use client". The explorer renders it with its
 * frame and an `onPick`; everything it shows is a function of those.
 * ------------------------------------------------------------------ */

/** Every edge's `d`, worked out once: the geometry never changes. */
const PATHS = Object.fromEntries(EDGE_IDS.map((id) => [id, edgePath(EDGES[id])])) as Record<
  (typeof EDGE_IDS)[number],
  string
>;

/** The card's corner in user units: 12px at the map's 1.112px a unit. */
const RING_RX = 11;

/** Geist Mono at the card's size, for the figure under each name. */
const MONO = "font-[family-name:var(--font-geist-mono)] tabular-nums";

export function MapView({
  data,
  frame,
  selected,
  onPick,
}: {
  data: ExplorerData;
  frame: Frame;
  selected: PartId | null;
  onPick: (id: PartId) => void;
}) {
  // In "Take a part down" a struck part is down, not failed.
  const faultWord = frame.row ? data.down.downTag : data.failed;
  return (
    <div data-view="map" className="home-stage relative isolate mt-4 hidden rounded-[28px] p-8 xl:block">
      <span aria-hidden className="home-grain" />
      {/* What this is and isn't, where the eye lands first: top right, at xl. */}
      <p className={cn(TYPE.label, "mb-4 text-right text-pp-muted")}>{data.tag}</p>

      <div className="relative aspect-[1000/490]">
        <svg
          aria-hidden
          viewBox="0 0 1000 490"
          className="pointer-events-none absolute inset-0 size-full overflow-visible"
        >
          {EDGE_IDS.map((id) => (
            <path
              key={id}
              className="saas-edge"
              data-edge={id}
              data-route={frame.routeEdges.has(id) ? "" : undefined}
              d={PATHS[id]}
            />
          ))}
          {EDGE_IDS.map((id) => (
            <path
              key={id}
              className="saas-trace"
              data-trace={id}
              data-on={frame.traversed.has(id) ? "" : undefined}
              d={PATHS[id]}
            />
          ))}
          {data.parts.map((p) => {
            const [x, y] = PLACE[p.id];
            return (
              <rect
                key={p.id}
                className="saas-ring"
                data-ring={p.id}
                x={x - CARD.w / 2}
                y={y - CARD.h / 2}
                width={CARD.w}
                height={CARD.h}
                rx={RING_RX}
              />
            );
          })}
          <circle className="saas-bead" r={5} />
        </svg>

        {data.parts.map((p) => {
          const fault = frame.faults.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              tabIndex={-1}
              aria-hidden
              className="saas-card absolute flex cursor-pointer flex-col justify-center rounded-[12px] px-3 text-left"
              data-part={p.id}
              data-state={stateOf(frame, p.id)}
              data-fault={fault ? "" : undefined}
              data-selected={selected === p.id ? "" : undefined}
              style={cardBox(p.id)}
              onClick={() => onPick(p.id)}
            >
              {/* The name, struck through in ember when the part has failed. */}
              <span className="relative w-fit max-w-full">
                <span className="block truncate text-[12.5px] leading-4 font-medium text-(--home-ink)">{p.label}</span>
                <span className="saas-slash">
                  <span />
                </span>
              </span>
              {/* The figure, or the word for what went wrong, in one line's height. */}
              <span className="relative grid">
                <span
                  className={cn(
                    MONO,
                    "truncate text-[11px] leading-[14px] text-(--home-muted) [grid-area:1/1]",
                    fault && "invisible",
                  )}
                >
                  {p.datum}
                </span>
                <span className={cn("saas-tag saas-tag-fault [grid-area:1/1]", !fault && "invisible")}>{faultWord}</span>
              </span>
              {p.grant && <span className="saas-tag saas-grant absolute top-1.5 right-2.5">{data.grant}</span>}
              {frame.voice === p.id && (
                <span className="saas-voice absolute right-2.5 -bottom-2.5" data-flip-id="voice">
                  {data.speaking}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
