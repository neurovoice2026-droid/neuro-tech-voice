import { Check } from "lucide-react";
import type { RunLens } from "@/lib/pages/custom-automations";
import { cn } from "@/lib/utils";
import { TYPE } from "@/components/site/home/type";
import { fill, pad2, type Frame } from "./workbench-frame";

/* ------------------------------------------------------------------ *
 * #running — the hand lane (xl and up): the steps a person does today,
 * in the tools they do them in, one window per tool.
 *
 * WHAT IT SHOWS. Up to four windows side by side, each a white sheet
 * with a title bar (three dots and the tool's plain name: "Invoicing
 * software", never a brand) and the manual steps done in it, in number
 * order. A window's share of the lane is its share of the steps, never
 * less than its title and its longest word need: so a tool with three
 * steps is wide and short rather than tall beside three one-step
 * windows stretched to its height, the lane is as short as its words
 * allow, and no title is cut. Every step has a number disc: hollow while it is still done by
 * hand; electric with a tick once it has been handed to a block of the
 * flow (`data-handed`, from the frame), and under its words, in violet,
 * where the run now does it: "now step 06". That line always takes its
 * room, invisible until the step is handed over, so the lane never
 * changes height as the flow is built or taken back. While the run is on
 * the block that replaced a step, that step's row lights in the wash
 * (`data-now`), so the lane and the map say the same thing at once.
 *
 * THE COPY CHIPS. Over the lane lies a layer of chips, one per copy the
 * lens names ("Company details", "Invoice number"): a white pill with the
 * label and a grey bar where the value would be — never a value. They
 * rest invisible; in the tour's hand phase each rides an arc from its
 * source window's title bar to its target's, and the target's matching
 * row flashes as it lands (workbench-timeline.ts `buildHand`), so the
 * copy-paste between tools is seen before the flow replaces it. As the
 * flow is built, each disc flies from its row to the block that replaced
 * it (`buildBuild`); the lane's disc, then its "now step", turn as it
 * lands.
 *
 * FOR EVERY READER. This lane is real text: a group named "By hand",
 * each window's steps an ordered list numbered as the lens numbers them,
 * each handed step's "now step 06" read after it. Nothing in it takes
 * focus; the index below the section carries the same steps with the
 * rest of the lens, for every width. The discs, the dots, the flash and
 * the chips are aria-hidden: they say nothing the words don't.
 *
 * PURE: no hooks and no "use client". The workbench renders it with its
 * frame; the data attributes are the timeline's handles
 * (`data-auto-window`, `data-auto-bar`, `data-auto-manual`,
 * `data-auto-chips`, `data-auto-chip`), never state.
 * ------------------------------------------------------------------ */

/** The plate shadow the landing's white sheets sit on a stage with. */
const SHEET = "shadow-[0_1px_2px_rgb(20_10_36/0.06),inset_0_0_0_1px_rgb(20_10_36/0.06)]";

export function ToolLane({
  lens,
  frame,
  copy,
}: {
  lens: RunLens;
  frame: Frame;
  copy: { hand: string; nowStep: string };
}) {
  const number = (id: string) => lens.manual.findIndex((m) => m.id === id) + 1;
  // Each window's column: its steps' share of the lane, at least its title's width.
  const columns = lens.tools
    .map((tool) => `minmax(min-content,${Math.max(1, lens.manual.filter((m) => m.tool === tool.id).length)}fr)`)
    .join(" ");
  return (
    <div className="relative mt-3">
      <div role="group" aria-label={copy.hand} className="grid gap-3" style={{ gridTemplateColumns: columns }}>
        {lens.tools.map((tool) => (
          <div key={tool.id} data-auto-window={tool.id} className={cn("auto-window min-w-0 rounded-[14px] bg-white", SHEET)}>
            <p data-auto-bar className="flex h-7 items-center gap-1 px-3">
              <span aria-hidden className="flex shrink-0 gap-1">
                <span className="size-[5px] rounded-full bg-[#dcd6ea]" />
                <span className="size-[5px] rounded-full bg-[#dcd6ea]" />
                <span className="size-[5px] rounded-full bg-[#dcd6ea]" />
              </span>
              <span className={cn(TYPE.label, "ml-2 min-w-0 truncate text-pp-muted")}>{tool.label}</span>
            </p>
            <ol className="px-3 pb-2">
              {lens.manual
                .filter((m) => m.tool === tool.id)
                .map((m) => {
                  const handed = frame.handed.has(m.id);
                  const at = frame.nowStep[m.id];
                  // The run is on the block that replaced this step: the row lights with it.
                  const now = frame.phase === "built" && at !== undefined && at === frame.step + 1;
                  return (
                    <li
                      key={m.id}
                      value={number(m.id)}
                      data-auto-manual={m.id}
                      data-now={now ? "" : undefined}
                      className="auto-manual relative -mx-1.5 grid grid-cols-[20px_minmax(0,1fr)] gap-x-2 rounded-lg px-1.5 py-1.5"
                    >
                      <span aria-hidden className="auto-flash absolute inset-0 rounded-lg" />
                      <span
                        aria-hidden
                        className="auto-disc relative mt-px grid size-5 place-items-center rounded-full"
                        data-handed={handed ? "" : undefined}
                      >
                        <span className="auto-disc-n font-[family-name:var(--font-geist-mono)] text-[10px] leading-none tabular-nums [grid-area:1/1]">
                          {number(m.id)}
                        </span>
                        <Check className="auto-disc-tick size-3 [grid-area:1/1]" strokeWidth={2.5} />
                      </span>
                      <span className="relative min-w-0">
                        <span className="block text-[13px] leading-[18px] text-pp-ink">{m.text}</span>
                        {at !== undefined && (
                          <span
                            className={cn(
                              TYPE.mono,
                              "auto-nowstep mt-0.5 block text-[11px] leading-4 text-(--home-violet)",
                            )}
                            data-handed={handed ? "" : undefined}
                          >
                            {fill(copy.nowStep, { n: pad2(at) })}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
            </ol>
          </div>
        ))}
      </div>

      {/* The copy chips: a label and a grey bar, never a value. GSAP places and flies them. */}
      <div aria-hidden data-auto-chips className="pointer-events-none absolute inset-0">
        {lens.copies.map((c, i) => (
          <span
            key={`${c.from}-${c.to}`}
            data-auto-chip={i}
            className="auto-chip absolute top-0 left-0 inline-flex h-6 items-center gap-2 rounded-full bg-white px-2.5"
          >
            <span className={cn(TYPE.mono, "text-[11px] leading-4 whitespace-nowrap text-pp-ink")}>{c.label}</span>
            <span className="h-1 w-[22px] rounded-full bg-pp-ink/15" />
          </span>
        ))}
      </div>
    </div>
  );
}
