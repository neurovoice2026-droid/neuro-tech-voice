import type { CSSProperties, ReactElement } from "react";
import { cn } from "@/lib/utils";
import type { BreakGuardId } from "@/lib/pages/custom-automations";

/* ------------------------------------------------------------------ *
 * #breaks — the four guards' figures: one small line drawing for each
 * other way the platform stays safe when something goes wrong, over the
 * guard's title and sentence on its card.
 *
 *   · Once per call: news of a call arriving twice — the first goes
 *     through the gate, the second stops short of it — and one run.
 *   · A time limit on every run: a run's clock, a line running on from
 *     it, and the limit it can't pass.
 *   · Failures stay contained: three steps setting out from one start,
 *     the middle one failing, the other two reaching their ends.
 *   · A Stripe event done once: an event reaching its record, done, and the
 *     same event again, turned back at the door.
 *
 * THE #checks KEY'S LINE VOCABULARY (custom-saas-platforms/checks.tsx
 * `KindFigure`, after the landing's #trust figures), at 64 × 36: 1.6
 * strokes with round caps, lines that stop short of what they meet,
 * nodes that pop in. Ink throughout, muted for what doesn't go through
 * (the second arrival, the step that fails), and the electric only on
 * the marks that say what the guard guarantees: the gate, the limit,
 * the ends reached, the tick. Aria-hidden: the title and the sentence
 * beside each say the same thing in words, and no card shows a file
 * path.
 *
 * THEY DRAW ON THEIR WAY UP THE SCREEN (home.css `.home-draw`), each
 * element in its own slice of the figure's window (`--o` where it
 * starts, `--s` how much it takes, as shares; auto-breaks.css §5), the
 * glyph's order: what arrives, the line it takes, what it reaches. The
 * four start a beat apart across a row (`data-i`, the guard's place).
 * Reduced motion, a browser without view timelines, and the lite and
 * still tiers and weak hardware get the markup, which is the finished
 * drawing.
 *
 * PURE: no "use client", no hooks, types only from the data module.
 * ------------------------------------------------------------------ */

const W = 64;
const H = 36;
const LINE = 1.6;

/** The guards in the order the data module lists them: each figure's place in its row, for its beat. */
const ORDER: readonly BreakGuardId[] = ["once", "budget", "alone", "twice"];

/** When an element runs, as a share of its figure's draw window: from `o`, over `s`. Read by auto-breaks.css §5. */
function at(o: number, s: number) {
  return { "--o": o, "--s": s } as CSSProperties;
}

const solid = {
  stroke: "currentColor",
  strokeWidth: LINE,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** The guarantee: electric on white (5.70, a mark). */
const MARK = "text-(--home-electric)";
/** What doesn't go through: muted (6.37). */
const QUIET = "text-pp-muted";
/** A node that pops in rather than draws. */
const POP = "auto-guard-pop fill-current";

/** Once per call: two arrivals, one gate, one run. */
function OnceFigure() {
  return (
    <>
      <circle cx={5} cy={10} r={2} className={POP} style={at(0, 0.12)} />
      <circle cx={5} cy={26} r={2} className={cn(POP, QUIET)} style={at(0.06, 0.12)} />
      {/* The first arrival reaches the gate. */}
      <path d="M9 10 C18 10 20 18 26.5 18" pathLength={1} style={at(0.12, 0.3)} {...solid} />
      {/* The second stops short of it, barred. */}
      <g className={QUIET}>
        <path d="M9 26 C14 26 17 24.5 19.5 23.2" pathLength={1} style={at(0.18, 0.22)} {...solid} />
        <path d="M20.2 19.6 L23 25" pathLength={1} style={at(0.42, 0.1)} {...solid} />
      </g>
      {/* The gate: once per call. */}
      <circle cx={31} cy={18} r={3.5} className={cn(POP, MARK)} style={at(0.42, 0.14)} />
      <path d="M35.5 18 H48.5" pathLength={1} style={at(0.56, 0.18)} {...solid} />
      {/* It runs, once. */}
      <path d="M51 18 l3.5 3.5 l7 -7" pathLength={1} className={MARK} style={at(0.74, 0.22)} {...solid} />
    </>
  );
}

/** A time limit on every run: the run's clock, and the line that ends at the limit. */
function BudgetFigure() {
  return (
    <>
      <path d="M12 8 A10 10 0 1 1 12 28 A10 10 0 1 1 12 8" pathLength={1} style={at(0, 0.34)} {...solid} />
      <path d="M12 12.5 V18 L16 20.5" pathLength={1} style={at(0.28, 0.14)} {...solid} />
      <path d="M25.5 18 H47.5" pathLength={1} style={at(0.42, 0.26)} {...solid} />
      {/* The limit, and the run's end on it. */}
      <path d="M53 7 V29" pathLength={1} className={MARK} style={at(0.62, 0.18)} {...solid} />
      <circle cx={53} cy={18} r={3} className={cn(POP, MARK)} style={at(0.78, 0.16)} />
    </>
  );
}

/** Failures stay contained: three from one start, the middle one failing, the others reaching their ends. */
function AloneFigure() {
  return (
    <>
      <circle cx={5} cy={18} r={3} className={POP} style={at(0, 0.14)} />
      <path d="M9 16.5 C14 14 14 8 20 8 H49.5" pathLength={1} style={at(0.12, 0.42)} {...solid} />
      <g className={QUIET}>
        <path d="M9.5 18 H29" pathLength={1} style={at(0.14, 0.2)} {...solid} />
        <path d="M33 15 l6 6 M39 15 l-6 6" pathLength={1} style={at(0.36, 0.12)} {...solid} />
      </g>
      <path d="M9 19.5 C14 22 14 28 20 28 H49.5" pathLength={1} style={at(0.16, 0.42)} {...solid} />
      <circle cx={54} cy={8} r={2.75} className={cn(POP, MARK)} style={at(0.58, 0.14)} />
      <circle cx={54} cy={28} r={2.75} className={cn(POP, MARK)} style={at(0.64, 0.14)} />
    </>
  );
}

/** A Stripe event done once: an event reaches its record, done; the same event again is turned back. */
function TwiceFigure() {
  return (
    <>
      <circle cx={4} cy={11} r={2} className={POP} style={at(0, 0.12)} />
      <path d="M8 11 H36" pathLength={1} style={at(0.08, 0.26)} {...solid} />
      <path
        d="M43 6 H57 A3 3 0 0 1 60 9 V27 A3 3 0 0 1 57 30 H43 A3 3 0 0 1 40 27 V9 A3 3 0 0 1 43 6 Z"
        pathLength={1}
        style={at(0.26, 0.34)}
        {...solid}
      />
      <path d="M44.5 18.5 l3.5 3.5 l7 -7" pathLength={1} className={MARK} style={at(0.58, 0.2)} {...solid} />
      {/* The same event, again: acknowledged at the door, and not done. */}
      <g className={QUIET}>
        <circle cx={4} cy={25} r={2} className={POP} style={at(0.46, 0.12)} />
        <path d="M8 25 H31 A3.25 3.25 0 0 1 31 31.5 H22" pathLength={1} style={at(0.52, 0.3)} {...solid} />
        <path d="M25 29 L22 31.5 L25 34" pathLength={1} style={at(0.8, 0.12)} {...solid} />
      </g>
    </>
  );
}

const FIGURES: Record<BreakGuardId, () => ReactElement> = {
  once: OnceFigure,
  budget: BudgetFigure,
  alone: AloneFigure,
  twice: TwiceFigure,
};

/** One guard's figure, 64 × 36, drawn on its way up the screen. Aria-hidden: the card's words say it. */
export function GuardFigure({ id }: { id: BreakGuardId }) {
  const Figure = FIGURES[id];
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      fill="none"
      aria-hidden
      data-i={ORDER.indexOf(id)}
      className="home-draw auto-guard-fig block h-9 w-16 shrink-0 overflow-visible text-pp-ink"
    >
      <Figure />
    </svg>
  );
}
