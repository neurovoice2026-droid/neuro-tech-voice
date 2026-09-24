import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 * #credentials — the accreditations as a tally: one node for each, in
 * rows of ten, and a plus after the last when the count is a floor.
 *
 * It sits over the "20+" numeral and says the same thing a second way,
 * for the eye rather than the reader: twenty separate things, each held
 * by a person, not one badge. It is aria-hidden for that reason — the
 * numeral and its caption carry the meaning in words, and a screen
 * reader hearing twenty-one shapes would learn nothing more.
 *
 * THE GEOMETRY (the build spec's, fixed): nodes of radius 5 on a 16u
 * pitch, ten to a row, rows 20u apart; the plus, two 1.6u strokes 10u
 * long, sits one pitch after the last node, in the same row. The box is
 * ten pitches plus 24u wide, so a plus after a full row still fits, and
 * it is drawn at 1:1, so every stroke lands on the pixel grid it was
 * drawn for. Marks only, in the light's tick colour (`--saas-tick`,
 * 3.58:1 at its worst on a flowing pool, over the 3:1 a mark needs), and
 * no halo round the nodes: the pearl is their ground.
 *
 * THE MOTION is CSS alone (saas-credentials.css §5). The tally carries
 * its own view timeline, and each node takes a slice of one window on
 * it — `--o` where its pop starts, `--s` how much it takes, both shares
 * of the window, the #trust figures' slice rule — so the nodes scale in
 * one after another in reading order as the tally comes up the screen,
 * and the plus lands last. Scale only, never opacity: a node is either
 * arriving or there. It is tied to scroll, not the clock, so it is never
 * a count-up: nothing ever reads a number that isn't true.
 *
 * THE FINISHED FRAME is this markup. Reduced motion, a browser without
 * view timelines, the lite and still tiers and weak hardware all get
 * every node drawn and the plus in place.
 *
 * A server component with no state: the count arrives as a number from
 * the data module (ACCREDITATIONS, owner-stated), so a new accreditation
 * is one more node here and nothing else changes.
 * ------------------------------------------------------------------ */

const PITCH = 16;
const R = 5;
const PER_ROW = 10;
const ROW = 20;
/** The plus's arms: 10u across, so 5u either side of its centre. */
const ARM = 5;
const STROKE = 1.6;

/** When a mark pops, as a share of the tally's window: from `o`, over `s`. Read by §5. */
function slice(o: number, s: number) {
  return { "--o": o, "--s": s } as CSSProperties;
}

export function Tally({
  count,
  orMore,
  className,
}: {
  count: number;
  orMore: boolean;
  /** Spacing from the block above: the tally sets none of its own. */
  className?: string;
}) {
  const n = Math.max(0, Math.floor(count));
  const rows = Math.max(1, Math.ceil(n / PER_ROW));
  const w = PER_ROW * PITCH + 24;
  const h = rows * ROW;
  const at = (k: number) => ({ x: PITCH / 2 + (k % PER_ROW) * PITCH, y: ROW / 2 + Math.floor(k / PER_ROW) * ROW });
  // One pitch after the last node, in its row (where a first node would
  // have gone, when there are none).
  const last = n > 0 ? at(n - 1) : { x: PITCH / 2 - PITCH, y: ROW / 2 };
  const plus = { x: last.x + PITCH, y: last.y };

  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      fill="none"
      className={cn("saas-tally block h-auto max-w-full overflow-visible text-(--saas-tick)", className)}
    >
      {Array.from({ length: n }, (_, k) => {
        const { x, y } = at(k);
        // The nodes share the first 80% of the window in reading order,
        // each popping over a fifth of it, so neighbours overlap and the
        // row runs as one gesture rather than twenty ticks.
        return <circle key={k} className="saas-pop" cx={x} cy={y} r={R} fill="currentColor" style={slice((k / n) * 0.8, 0.2)} />;
      })}
      {orMore && (
        <g
          className="saas-pop"
          stroke="currentColor"
          strokeWidth={STROKE}
          strokeLinecap="round"
          style={slice(0.85, 0.2)}
        >
          <line x1={plus.x - ARM} y1={plus.y} x2={plus.x + ARM} y2={plus.y} />
          <line x1={plus.x} y1={plus.y - ARM} x2={plus.x} y2={plus.y + ARM} />
        </g>
      )}
    </svg>
  );
}
