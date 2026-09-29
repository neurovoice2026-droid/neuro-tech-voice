import type { ReactElement } from "react";
import { cn } from "@/lib/utils";
import type { GateId } from "@/lib/pages/custom-mobile-applications";

/* ------------------------------------------------------------------ *
 * #path — the six gates' glyphs: one small line drawing for each rule
 * the stores keep, beside the rule's title on its card.
 *
 *   · An account made in the app can be deleted in it: an account card,
 *     and a line struck through it.
 *   · What the app sells decides who takes the payment: a shopping bag,
 *     and a card in front of it.
 *   · The reviewer gets a way in: a key.
 *   · A privacy policy, in the store and in the app: a page, and a lock
 *     on it.
 *   · An app has to do more than a website: a browser window, and a
 *     phone in front of it.
 *   · Sign in with Google on an iPhone? Then a private option too: two
 *     sign-in buttons, one over the other.
 *
 * THE #checks KEY'S LINE VOCABULARY (custom-saas-platforms/checks.tsx
 * `KindFigure`, the Automations guards' figures), at 28 × 28: 1.6
 * strokes with round caps and joins. Ink for the thing the rule is
 * about, and the electric only on the mark that says what the rule asks
 * for — the strike, the card, the key's bit, the lock, the phone, the
 * second button: marks on white (5.70), never text. A shape drawn in
 * front of another is filled white, the card's own ground, so the one
 * behind it stops where it meets it. Aria-hidden: the title beside
 * each says the same thing in words.
 *
 * THEY DRAW ON THEIR WAY UP THE SCREEN (home.css `.home-draw`): every
 * pathLength="1" stroke with home.css's own `home-draw`, on the glyph's
 * own view timeline, and the cards a beat apart across a row by
 * `data-i` (the card's place, mod 4: home.css's four ranges). The white
 * fills never move, and on white they are nothing until their outline
 * draws round them. Reduced motion, a browser without view timelines,
 * and the lite, still and weak tiers get the markup, which is the
 * finished drawing (mob-path.css §4 and §6).
 *
 * PURE: no "use client", no hooks, types only from the data module.
 * ------------------------------------------------------------------ */

const LINE = 1.6;

/** Every stroke here draws, and wears the class the tier pins name it by (mob-path.css §6). */
const solid = {
  className: "mob-path-draw",
  stroke: "currentColor",
  strokeWidth: LINE,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  fill: "none",
} as const;

/** What the rule asks for: electric on white, a mark. */
const MARK = "text-(--home-electric)";

/** A closed rounded rectangle, from its left, top, right and bottom, as one path that draws round from the top left. */
function box(l: number, t: number, r: number, b: number, rad: number) {
  return `M${l + rad} ${t} H${r - rad} A${rad} ${rad} 0 0 1 ${r} ${t + rad} V${b - rad} A${rad} ${rad} 0 0 1 ${r - rad} ${b} H${l + rad} A${rad} ${rad} 0 0 1 ${l} ${b - rad} V${t + rad} A${rad} ${rad} 0 0 1 ${l + rad} ${t} Z`;
}

/** A circle as one path (a circle element takes no dash draw from its top). */
function ring(cx: number, cy: number, r: number) {
  return `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0`;
}

/** A shape in front of another: its outline over a white fill, so what is behind it stops at its edge. */
const front = { ...solid, fill: "#fff" } as const;

const FIGURES: Record<GateId, () => ReactElement> = {
  delete: () => (
    <>
      <path d={box(3.5, 7.5, 24.5, 20.5, 2)} pathLength={1} {...solid} />
      <path d={ring(9.5, 12.3, 1.9)} pathLength={1} {...solid} />
      <path d="M6.8 17.6 a2.7 2.7 0 0 1 5.4 0" pathLength={1} {...solid} />
      <path d="M15 12 H20.5 M15 15.6 H18.8" pathLength={1} {...solid} />
      <path d="M4.5 24.5 L23.5 3.5" pathLength={1} {...solid} className={cn("mob-path-draw", MARK)} />
    </>
  ),
  payments: () => (
    <>
      <path d="M4.5 10.5 H15.5 L16.5 23.5 H3.5 Z" pathLength={1} {...solid} />
      <path d="M7.5 10.5 V8.5 a2.5 2.5 0 0 1 5 0 V10.5" pathLength={1} {...solid} />
      <g className={MARK}>
        <path d={box(12.5, 14, 24.5, 22.5, 1.5)} pathLength={1} {...front} />
        <path d="M12.5 17.2 H24.5" pathLength={1} {...solid} />
      </g>
    </>
  ),
  review: () => (
    <>
      <path d={ring(8.5, 14, 4.5)} pathLength={1} {...solid} />
      <path d="M13 14 H24 M20.5 14 V17.5 M23.5 14 V16.5" pathLength={1} {...solid} className={cn("mob-path-draw", MARK)} />
    </>
  ),
  website: () => (
    <>
      <path d={box(3.5, 5.5, 19.5, 19.5, 2)} pathLength={1} {...solid} />
      <path d="M3.5 9 H19.5" pathLength={1} {...solid} />
      <g className={MARK}>
        <path d={box(16.5, 10, 24.5, 24.5, 2)} pathLength={1} {...front} />
        <path d="M19.5 21.8 H21.5" pathLength={1} {...solid} />
      </g>
    </>
  ),
  privacy: () => (
    <>
      <path d="M6 3.5 H14.5 L19.5 8.5 V24.5 H6 Z" pathLength={1} {...solid} />
      <path d="M14.5 3.5 V8.5 H19.5 M9 12 H15.5 M9 15.5 H12.5" pathLength={1} {...solid} />
      <g className={MARK}>
        <path d={box(14.5, 17, 24.5, 25, 1.5)} pathLength={1} {...front} />
        <path d="M16.8 17 V14.9 a2.7 2.7 0 0 1 5.4 0 V17" pathLength={1} {...solid} />
      </g>
    </>
  ),
  signin: () => (
    <>
      <path d={box(3.5, 5.5, 24.5, 12, 3.25)} pathLength={1} {...solid} />
      <path d={`${ring(7.6, 8.75, 1.2)} M11 8.75 H20`} pathLength={1} {...solid} />
      <g className={MARK}>
        <path d={box(3.5, 16, 24.5, 22.5, 3.25)} pathLength={1} {...solid} />
        <path d={`${ring(7.6, 19.25, 1.2)} M11 19.25 H20`} pathLength={1} {...solid} />
      </g>
    </>
  ),
};

/** A gate's glyph, 28px, drawn in ink with its one mark in the electric. `i` is the card's place, for its beat. */
export function GateGlyph({ id, i, className }: { id: GateId; i: number; className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 28 28"
      data-i={i % 4}
      className={cn("mob-gate-glyph home-draw size-7 shrink-0 overflow-visible text-pp-ink", className)}
    >
      {FIGURES[id]()}
    </svg>
  );
}
