import type { PartFace, PartKind } from "@/lib/pages/custom-mobile-applications";
import { cn } from "@/lib/utils";
import { KindTag, PartGlyph } from "./glyphs";
import type { Frame } from "./phone-frame";

/* ------------------------------------------------------------------ *
 * #hold — the parts beside the phone where the drawing has no room: the
 * lane (md) and the chips (below md). The same nine parts, in the same
 * order as the data module's PARTS, lit by the same frame, so a step
 * reads alike at every width: the parts it is on its way to in a faint
 * electric ring, the parts it reached lit in a 2px one, the rest at a
 * hairline (mob-hold.css §3).
 *
 *   · THE LANE (md, 768–1023): nine rows of 40px under the caption card
 *     in the column beside the phone, each the part's glyph, its label
 *     and, right-aligned in mono, its figure — the drawing's card laid on
 *     its side.
 *   · THE CHIPS (below md): a 3 × 3 grid under the caption card, each
 *     chip the glyph over the label, as small as a word; the figures are
 *     the drawing's and #server's, and the caption card above says which
 *     parts this step talks to in words. Under them, the two kind tags:
 *     a chip has no room for "built for yours", so the dashed one is
 *     explained once, by its glyph's own shape.
 *
 * Push is dashed wherever it stands, and its figure is violet: the one
 * part the page says isn't on this platform.
 *
 * All three compositions (drawing, lane, chips) are in the HTML at once,
 * and CSS alone shows the one that fits (mob-hold.css §1), so the server
 * never guesses the width. Each row and chip carries a `.mob-ping`, the
 * tour's handle for the ring that goes out as the step reaches it
 * (phone-timeline.ts: in turn, 0.3s apart).
 *
 * Aria-hidden, as the drawing is: the caption card names the parts in
 * words, and #server has each in full. Pure leaves: no hooks, no
 * "use client".
 * ------------------------------------------------------------------ */

const MONO = "font-[family-name:var(--font-geist-mono)] tabular-nums";

/** md: nine 40px rows, glyph · label · figure. Nothing here is pressed, so no row needs a 44px target. */
export function PartsLane({ parts, frame, className }: { parts: readonly PartFace[]; frame: Frame; className?: string }) {
  return (
    <ul aria-hidden className={cn("mob-lane flex flex-col gap-1", className)}>
      {parts.map((p) => (
        <li
          key={p.id}
          data-mob-part={p.id}
          data-state={frame.parts[p.id]}
          data-kind={p.kind}
          className="mob-row relative flex h-10 min-w-0 items-center gap-2 rounded-[12px] px-3"
        >
          <span className="mob-ping" />
          <PartGlyph id={p.id} className="mob-row-glyph" />
          <span className="min-w-0 truncate text-[13px] leading-[18px] font-medium text-pp-ink">{p.label}</span>
          <span
            className={cn(
              MONO,
              "ml-auto shrink-0 pl-2 text-[11px] leading-4",
              p.kind === "none" ? "text-(--home-violet)" : "text-pp-muted",
            )}
          >
            {p.datum}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Below md: a 3 × 3 grid of chips, glyph over label, then the two kind tags. */
export function PartsChips({
  parts,
  frame,
  kinds,
  className,
}: {
  parts: readonly PartFace[];
  frame: Frame;
  /** "Runs here" | "Built for yours". */
  kinds: Record<PartKind, string>;
  className?: string;
}) {
  return (
    <div aria-hidden className={cn("mob-chips", className)}>
      <ul className="grid grid-cols-3 gap-2">
        {parts.map((p) => (
          <li
            key={p.id}
            data-mob-part={p.id}
            data-state={frame.parts[p.id]}
            data-kind={p.kind}
            className="mob-chip relative flex min-h-10 min-w-0 flex-col items-center justify-center gap-1 rounded-[12px] px-1.5 py-2 text-center"
          >
            <span className="mob-ping" />
            <PartGlyph id={p.id} className="mob-chip-glyph" />
            <span className="text-[13px] leading-4 text-balance text-pp-ink max-[359px]:text-[12px]">{p.label}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
        <KindTag kind="does" copy={kinds} tone="stage" />
        <KindTag kind="none" copy={kinds} tone="stage" />
      </p>
    </div>
  );
}
