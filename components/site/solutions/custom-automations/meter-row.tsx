import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { TYPE } from "@/components/site/home/type";
import type { MeterCopy } from "@/lib/pages/custom-automations";
import { METER_FLAGS, type Meters } from "./meters";

/* ------------------------------------------------------------------ *
 * "What makes it hard", as one line: how many blocks a flow takes, then
 * a pip for each of the five things that make one harder (a rule, AI, a
 * person, a schedule, a guard against doing it twice), filled when the
 * flow has it and a ring when it doesn't. Under the workbench's caption
 * for the lens on screen, and beside each #work sample, so the lenses
 * and the levels can be seen to climb. The meters are worked out from
 * the blocks (meters.ts), never typed.
 *
 * THE WORDS. A description list: "Blocks" and its count, then each
 * meter's word with its answer. The answer is the pip for the eye and
 * ": yes" / ": no" for a screen reader, which hears "Rules: yes"; the
 * pip is aria-hidden. Filled against hollow, so the answer never rests
 * on colour alone, and forced colours keep the two shapes (auto.css
 * §5). The label ("What makes it hard") comes first: a visible
 * `TYPE.label` on white and on a stage, visually hidden on a pearl
 * light, where the row sits under the sample's own head and reads as
 * part of it.
 *
 * THE TONES, as check-line.tsx's. `white` and `stage` use the landing's
 * tokens: words muted (6.37 on white, 5.39 on the stage), the count in
 * ink, the pips electric (marks: 5.70 and 4.82). `lit` sits on a pearl
 * light and uses only the light's measured tokens: words `--saas-dim`,
 * the count `--saas-text`, and the pips the light's tick, which auto.css
 * §1 sets inside `.saas-lit` (3.40 at its worst, flowing: a mark). The
 * type is mono at 11px, as the explorer's small datums are.
 *
 * NOTHING MOVES WHEN IT CHANGES. The words are the same for every flow
 * and the count holds two figures' room, so a lens or a sample with
 * more blocks never widens the line into a wrap, and the row keeps its
 * height (one line from md, two on a phone) whatever it shows.
 *
 * THE POP. Each pip carries its place in the row as `--k` (0–4), for a
 * section that pops them in order when its flow changes (#work's time
 * mode, auto-work.css §4: `auto-pop`, 40ms apart). The row itself
 * declares no motion: a pip is filled or not, and auto.css eases only
 * its colour.
 *
 * PURE. No "use client" and no hooks; the copy arrives as a prop
 * (`METER_COPY`, from the data module through each section's data), so
 * a server section and the client islands can both render it without
 * the server-only module reaching a client chunk.
 * ------------------------------------------------------------------ */

export type MeterTone = "white" | "lit" | "stage";

/** The label, when it is shown: the landing's on white and on a stage. */
const LABEL: Record<MeterTone, string> = {
  white: cn(TYPE.label, "text-pp-muted"),
  stage: cn(TYPE.label, "text-pp-muted"),
  lit: "sr-only",
};

/** Every word on the row. */
const WORD: Record<MeterTone, string> = {
  white: "text-pp-muted",
  stage: "text-pp-muted",
  lit: "text-(--saas-dim)",
};

/** The block count. */
const FIGURE: Record<MeterTone, string> = {
  white: "text-pp-ink",
  stage: "text-pp-ink",
  lit: "text-(--saas-text)",
};

/** A pip's mark: electric on white and on a stage; on a light, auto.css §1 sets the tick. */
const MARK: Record<MeterTone, string> = {
  white: "text-(--home-electric)",
  stage: "text-(--home-electric)",
  lit: "",
};

const MONO = cn(TYPE.mono, "text-[11px] leading-4");

export function MeterRow({
  meters,
  copy,
  tone,
  className,
}: {
  meters: Meters;
  copy: MeterCopy;
  tone: MeterTone;
  /** Spacing from the block above (`mt-3`): the row sets none of its own. */
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className={LABEL[tone]}>{copy.label}</p>
      <dl className={cn(MONO, WORD[tone], "flex flex-wrap items-center gap-x-4 gap-y-1", tone !== "lit" && "mt-2")}>
        <div className="flex items-baseline gap-1.5">
          <dt>{copy.parts}</dt>
          {/* Two figures' room, so a count of ten never widens the row into a wrap:
              1.2em is two Geist Mono figures at any size (each 0.6em). Never `ch`
              (or any glyph-relative unit): on this shell, whose saas.css keys
              rules on `html:has(main.saas-page)`, one such unit in the document
              makes every DOM insertion restyle the whole page (20–50ms each). */}
          <dd className={cn("min-w-[1.2em]", FIGURE[tone])}>{meters.blocks}</dd>
        </div>
        {METER_FLAGS.map((flag, k) => {
          const on = meters[flag];
          return (
            <div key={flag} className="flex items-center">
              <dt className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className={cn("auto-pip", MARK[tone])}
                  data-on={on ? "" : undefined}
                  style={{ "--k": k } as CSSProperties}
                />
                {copy[flag]}
              </dt>
              <dd className="sr-only">: {on ? copy.yes : copy.no}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
