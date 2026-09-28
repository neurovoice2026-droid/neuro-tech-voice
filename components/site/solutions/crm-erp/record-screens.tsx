import { memo } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE } from "@/components/site/home/type";
import type { Screen, ScreenBlock } from "@/lib/pages/crm-erp";

/* ------------------------------------------------------------------ *
 * #process — the record window's screens: what the sample's one system
 * shows at each step, in the product grammar of a real CRM screen.
 *
 * THE WORDS ARE LABELS, THE VALUES ARE GREY BARS. A screen is a title
 * and two to four labelled blocks (the data module's `Screen`): a field
 * with its label over the value's bar; a table's three column heads over
 * two or three rows of bars, and a total; a status chip in words; an
 * order's stages as a strip of pills, the current one filled; a small
 * calendar with one slot booked; three chart panels, each labelled over
 * its sketch; a ticked line. So it reads as a working screen, never an
 * empty wireframe, and never shows a name, a price or a figure that
 * would pretend to be a customer's: the sample is for no business in
 * particular, and the test holds every label to words, no digits.
 *
 * NOTHING JITTERS. Every bar's width comes from a fixed list, picked by
 * the block's and the row's place, never at random, so a screen is drawn
 * the same on the server and on every render, and the eight screens'
 * stack (process-panels.tsx) is as tall as the tallest of them at every
 * width. A block never grows with its words: labels are single words or
 * short phrases (at most 28 characters), set on one line or wrapping
 * inside their own row.
 *
 * COLOUR, on the window's white: labels and heads in muted (6.37), words
 * in ink; the bars ink at 8%, the calendar's cells ink at 6%: shapes, no
 * text. The `done` chip settled on settled-soft (4.95), the `wait` chip
 * violet on the stage colour (6.01); the current stage white on electric
 * (5.70), the rest muted in a hairline; the tick settled (5.50); the
 * booked slot and the sketches' marks electric (5.70, marks only).
 *
 * PURE. No "use client" and no hooks, and only types from the data
 * module, so the stage (a client island) renders it and the server's
 * first paint is the same screen. Every glyph is aria-hidden: the words
 * beside it say it.
 * ------------------------------------------------------------------ */

/** A value's bar: ink at 8%, 8px tall, fully rounded (GrayText under forced colours: erp-process.css §6). */
const BAR = "erp-bar block h-2 rounded-full bg-pp-ink/8";

/** A block's label, and a table's column heads: the landing's label role, muted. */
const LABEL = cn(TYPE.label, "text-pp-muted");

/** The widths a field's bar takes, by the field's place on its screen (60–80% of the column). */
const FIELD_W = ["w-[72%]", "w-[60%]", "w-[80%]", "w-[66%]"] as const;

/** A table's cells, by row: the item (wide), the quantity (short), the price (right, medium). */
const CELL_W = [
  ["w-[78%]", "w-[40%]", "w-[64%]"],
  ["w-[62%]", "w-[30%]", "w-[56%]"],
  ["w-[70%]", "w-[46%]", "w-[60%]"],
] as const;

/** A chip in words: the sample's state, done or waiting. */
const CHIP_TONE = {
  done: "bg-(--home-settled-soft) text-(--home-settled)",
  wait: "bg-(--home-stage) text-(--home-violet)",
} as const;

function Field({ label, at }: { label: string; at: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className={LABEL}>{label}</p>
      <span aria-hidden className={cn(BAR, FIELD_W[at % FIELD_W.length])} />
    </div>
  );
}

function Lines({ heads, rows, total }: { heads: readonly [string, string, string]; rows: number; total?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[minmax(0,2.2fr)_minmax(0,0.8fr)_minmax(0,1fr)] gap-x-3 border-b border-pp-rule pb-1.5">
        {heads.map((h, i) => (
          <p key={h} className={cn(LABEL, i === 2 && "text-right")}>
            {h}
          </p>
        ))}
      </div>
      <div aria-hidden className="flex flex-col gap-2.5 py-0.5">
        {CELL_W.slice(0, rows).map((row, r) => (
          <div key={r} className="grid grid-cols-[minmax(0,2.2fr)_minmax(0,0.8fr)_minmax(0,1fr)] items-center gap-x-3">
            <span className={cn(BAR, row[0])} />
            <span className={cn(BAR, row[1])} />
            <span className={cn(BAR, row[2], "justify-self-end")} />
          </div>
        ))}
      </div>
      {total && (
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-3 border-t border-pp-rule pt-1.5">
          <p className={LABEL}>{total}</p>
          <span aria-hidden className={cn(BAR, "h-2.5 w-[58%] justify-self-end bg-pp-ink/12")} />
        </div>
      )}
    </div>
  );
}

function Chip({ label, tone }: { label: string; tone: "done" | "wait" }) {
  return (
    <p>
      <span className={cn("inline-flex h-7 items-center rounded-full px-3 text-[12px] leading-4 font-medium", CHIP_TONE[tone])}>
        {label}
      </span>
    </p>
  );
}

function Stages({ items, current }: { items: readonly string[]; current: number }) {
  return (
    <ol className="flex flex-wrap gap-1.5">
      {items.map((s, i) => (
        <li
          key={s}
          aria-current={i === current ? "step" : undefined}
          className={cn(
            "inline-flex h-7 items-center rounded-full px-2.5 text-[12px] leading-4",
            i === current
              ? "bg-(--home-electric) font-medium text-white"
              : "text-pp-muted shadow-[inset_0_0_0_1px_rgb(20_10_36/0.12)]",
          )}
        >
          {s}
        </li>
      ))}
    </ol>
  );
}

/** A week of three rows, one slot booked: the third row's fifth cell. */
const SLOT = 2 * 7 + 4;

function Slots({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4">
      <span aria-hidden className="grid grid-cols-[repeat(7,12px)] gap-1">
        {Array.from({ length: 21 }, (_, i) => (
          <span key={i} data-on={i === SLOT ? "" : undefined} className={cn("erp-bar size-3 rounded-[3px]", i === SLOT ? "bg-(--home-electric)" : "bg-pp-ink/6")} />
        ))}
      </span>
      <p className="flex items-center gap-2 text-[13px] leading-[18px] text-pp-ink">
        <span aria-hidden className="size-2 rounded-full bg-(--home-electric)" />
        {label}
      </p>
    </div>
  );
}

/** Three sketches, one per panel: bars, a line, a column. Marks only, no numbers. */
function Sketch({ at }: { at: number }) {
  if (at === 1) {
    return (
      <svg aria-hidden viewBox="0 0 64 28" className="h-7 w-full" preserveAspectRatio="none">
        <path d="M2 22 L14 18 L26 20 L38 11 L50 13 L62 5" fill="none" stroke="var(--home-electric)" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
    );
  }
  const heights = at === 0 ? [10, 16, 12, 20, 24] : [26, 18, 12];
  return (
    <span aria-hidden className={cn("flex h-7 items-end gap-1", at === 2 && "justify-start")}>
      {heights.map((h, i) => (
        <span
          key={i}
          data-on=""
          className={cn("erp-bar block rounded-[2px]", at === 0 ? "w-2 bg-(--home-electric)" : "w-3 bg-(--home-lilac)")}
          style={{ height: h }}
        />
      ))}
    </span>
  );
}

/** Three tiles, one per panel: its label, then its sketch at the tile's foot, so the three sketches share a baseline however the labels wrap. */
function Panels({ items }: { items: readonly [string, string, string] }) {
  return (
    <ul className="grid grid-cols-3 gap-2">
      {items.map((label, i) => (
        <li key={label} className="flex min-w-0 flex-col gap-2 rounded-xl p-2.5 shadow-[inset_0_0_0_1px_rgb(20_10_36/0.08)]">
          <p className={cn(LABEL, "tracking-[0.08em] text-pretty")}>{label}</p>
          <div className="mt-auto">
            <Sketch at={i} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Tick({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2 text-[13px] leading-[18px] text-pp-ink">
      <Check aria-hidden className="size-3.5 shrink-0 text-(--home-settled)" strokeWidth={2.25} />
      {label}
    </p>
  );
}

function Block({ block, at }: { block: ScreenBlock; at: number }) {
  switch (block.kind) {
    case "field":
      return <Field label={block.label} at={at} />;
    case "lines":
      return <Lines heads={block.heads} rows={block.rows} total={block.total} />;
    case "chip":
      return <Chip label={block.label} tone={block.tone} />;
    case "stages":
      return <Stages items={block.items} current={block.current} />;
    case "slots":
      return <Slots label={block.label} />;
    case "panels":
      return <Panels items={block.items} />;
    case "tick":
      return <Tick label={block.label} />;
  }
}

/**
 * One screen of the record window: its title (an h3, under the window's
 * header strip, which names the record) and its blocks, in order. A
 * field's bar takes its width from the field's place among the screen's
 * fields, so two fields in a row never draw the same bar. Memoised: the
 * window's stack lays all eight, and a new frame redraws none of them.
 */
export const ScreenView = memo(function ScreenView({ screen, className }: { screen: Screen; className?: string }) {
  // Each block's place: a field's among the screen's fields, any other block's among them all.
  const at = screen.blocks.map((b, i) => (b.kind === "field" ? screen.blocks.slice(0, i).filter((x) => x.kind === "field").length : i));
  return (
    <div className={cn("flex min-w-0 flex-col gap-3.5", className)}>
      <h3 className="text-[15px] leading-[22px] font-medium text-pp-ink">{screen.title}</h3>
      {screen.blocks.map((b, i) => (
        <Block key={i} block={b} at={at[i]} />
      ))}
    </div>
  );
});
