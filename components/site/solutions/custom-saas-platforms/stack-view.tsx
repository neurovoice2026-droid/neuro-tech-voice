import type { ExplorerData, LayerId, PartId } from "@/lib/pages/custom-saas-platforms";
import { cn } from "@/lib/utils";
import { TYPE } from "@/components/site/home/type";
import { LAYERS, LAYER_OF, LAYER_ORDER } from "./map-geometry";
import { stateOf, type Frame } from "./explorer-frame";

/* ------------------------------------------------------------------ *
 * #platform — the stacked composition (below xl): the same seventeen
 * parts, as five bands, one per layer, top to bottom — the people, the
 * way in (phone and web), the app, the live calls, the services.
 *
 * Below 1280px the map's cards would shrink under 156×49px and its
 * lines would crowd, so the drawing gives way to the layers the map is
 * organised by. What a lens does is told the same way — the same frame,
 * the same state on every chip (current, passed, on the route, at rest),
 * the same ember strike and FAILED for a part that failed, the same
 * Speaking pill — only without lines between the chips. In their place
 * a 2px rail runs down the left gutter, and its electric fill reaches
 * down to the band the current part is in, easing there as the tour
 * moves (a CSS transition on `scale`, driven by the frame).
 *
 * FIXED HEIGHTS. Each band is exactly as tall as its chips need at each
 * breakpoint — a label, then one, two or three rows of 40px chips — so
 * no tour, no failure and no pill ever changes the stage's height, and
 * the explorer's reserve (page.tsx) holds at every width:
 *   people, edge        two chips, one row everywhere          76
 *   calls, services     four chips: two rows, then one at lg   124 / 76
 *   app                 five chips: three rows, two at md,
 *                       one at lg                              172 / 124 / 76
 *
 * A chip is a label over its figure, both truncating before they could
 * wrap, so a 141px chip on a 375px phone holds the longest of them; below
 * 360px the stage, the bands and the chips give up a little padding and
 * the figure drops to 10px, so a 120px chip on a 320px phone still does.
 * The Speaking pill takes the figure's place on the chip whose voice is
 * speaking, in the figure's own line (a size smaller than on the map,
 * and a pixel over each side of the line, so the chip's words never
 * move), and gives way to FAILED where both would be.
 *
 * Like the map's cards the chips are aria-hidden and out of the tab
 * order; the index is the keyboard's way through. A pointer may pick a
 * chip, which holds it in the inspector (and, when the inspector is below
 * the screen, scrolls the page to it: the explorer's `pickPart`).
 *
 * PURE: no hooks, no "use client".
 * ------------------------------------------------------------------ */

/** Each band's height per breakpoint: a 16px label, 8px, rows of 40px chips 8px apart, 12px below. */
const BAND: Record<LayerId, string> = {
  people: "h-[76px]",
  edge: "h-[76px]",
  app: "h-[172px] md:h-[124px] lg:h-[76px]",
  calls: "h-[124px] lg:h-[76px]",
  services: "h-[124px] lg:h-[76px]",
};

const MONO = "font-[family-name:var(--font-geist-mono)] tabular-nums";

export function StackView({
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
  const byId = new Map(data.parts.map((p) => [p.id, p]));
  const at = frame.current ?? frame.rings[0] ?? null;
  const band = at ? LAYERS.indexOf(LAYER_OF[at]) : -1;
  const faultWord = frame.row ? data.down.downTag : data.failed;

  return (
    <div data-view="stack" className="mt-4 xl:hidden">
      <p className={cn(TYPE.label, "text-pp-muted")}>{data.tag}</p>

      <div className="home-stage relative isolate mt-3 rounded-[28px] p-4 max-[359px]:p-3 md:p-6">
        <span aria-hidden className="home-grain" />
        {LAYERS.map((layer, b) => (
          <div
            key={layer}
            data-band={layer}
            data-on={b <= band ? "" : undefined}
            className={cn("relative pl-5 max-[359px]:pl-4 md:pl-6", BAND[layer])}
          >
            <span aria-hidden className="saas-rail absolute inset-y-0 left-0 w-0.5 overflow-hidden">
              <span className="saas-rail-fill absolute inset-0" />
            </span>
            <p
              className={cn(
                TYPE.label,
                "transition-colors duration-300",
                b === band ? "text-pp-ink" : "text-pp-muted",
              )}
            >
              {data.layers[layer]}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
              {LAYER_ORDER[layer].map((id) => {
                const p = byId.get(id);
                if (!p) return null;
                const fault = frame.faults.includes(id);
                const speaking = frame.voice === id && !fault;
                return (
                  <button
                    key={id}
                    type="button"
                    tabIndex={-1}
                    aria-hidden
                    className="saas-chip relative flex h-10 min-w-0 cursor-pointer flex-col items-start justify-center rounded-full px-3.5 text-left max-[359px]:px-2.5"
                    data-part={id}
                    data-state={stateOf(frame, id)}
                    data-fault={fault ? "" : undefined}
                    data-selected={selected === id ? "" : undefined}
                    onClick={() => onPick(id)}
                  >
                    <span className="saas-chip-ring" />
                    <span className="relative w-fit max-w-full">
                      <span className="block truncate text-[13px] leading-4 font-medium text-(--home-ink)">{p.label}</span>
                      <span className="saas-slash">
                        <span />
                      </span>
                    </span>
                    <span className="relative grid w-full">
                      <span
                        className={cn(
                          MONO,
                          "truncate text-[11px] leading-[14px] text-(--home-muted) [grid-area:1/1] max-[359px]:text-[10px]",
                          (fault || speaking) && "invisible",
                        )}
                      >
                        {p.datum}
                      </span>
                      <span className={cn("saas-tag saas-tag-fault [grid-area:1/1]", !fault && "invisible")}>
                        {faultWord}
                      </span>
                      {speaking && (
                        <span className="saas-voice -my-px justify-self-start [grid-area:1/1]" data-flip-id="voice">
                          {data.speaking}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
