import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 * #path — stage 01's drawing: one screen, designed for both platforms.
 *
 * What stage 01 hands over, in miniature: the same screen twice, on two
 * phones side by side — a title and three bars of content — each with
 * its own platform's way round the app at its foot. On the left, a tab
 * bar: a hairline over three icons, each with its label, the one you're
 * on in the tick. On the right, a navigation bar: the same three icons
 * and labels, with the one you're on set in a pill. The phones are
 * drawn generically, as the sample above is: a pill cut into one screen
 * and a punch-hole in the other, no logo and no real device.
 *
 * It fills stage 01's fifth row from lg (path.tsx), where its
 * neighbours say what ours shows: the first stage's proof is the sample
 * above, which you can hold. Stacked, there is no row to fill and no
 * drawing. 64 × 120 a phone, a gap between them, at 1:1, so the row it
 * sits in grows no taller than its neighbours' "On ours" does.
 *
 * A landing figure (`.home-draw`), in the #build maps' grammar
 * (custom-automations/build.tsx `MapFigure`): 1.6 strokes with round
 * caps; the light's own dim for the phones and their bars, its tick for
 * the tab you're on and its pill — marks on a pearl light, never text.
 * It draws one phone at a time on its own passage up the screen, each
 * element on its own slice (`--o` where it starts, `--s` how much it
 * takes, inline; mob-path.css §3): the left phone in the first 45% of
 * the window, the right one from halfway, each outline first, then its
 * title, its bars and its tab bar. The pill cut, the punch-hole and the
 * active tab's pill are fills, which a dash draw can't reach, so they
 * fade in on their slices (`.mob-plat-fade`, mob.css's `mob-fade-in`).
 * Wherever that doesn't run — reduced motion, a browser without view
 * timelines, the lite, still and weak tiers — the markup is the
 * finished drawing.
 *
 * PURE and aria-hidden: stage 01's own body and "You hold" line say the
 * same thing in words.
 * ------------------------------------------------------------------ */

const PHONE = { w: 64, h: 120, r: 11 } as const;
const GAP = 26;
/** Half a stroke of room all round, so the outlines' round edges aren't clipped. */
const PAD = 1;
const VIEW = { w: PHONE.w * 2 + GAP + PAD * 2, h: PHONE.h + PAD * 2 } as const;
const LINE = 1.6;

/** Down from a phone's top: the title, the three bars, the tab bar's hairline, its icons and their labels. */
const Y = { title: 22, bars: [36, 48, 60], rule: 96, icon: 105, label: 114 } as const;
/** Each bar's length, left to right from the screen's margin: the same screen on both phones. */
const BARS = [48, 38, 44] as const;
const MARGIN = 8;
/** The three tabs' centres, across a phone. */
const TABS = [14, 32, 50] as const;
/** The tab you're on: the second, as the sample's own tab bar has it. */
const ACTIVE = 1;

/** When an element draws, as a share of the figure's pass: from `o`, for `s`. Read by mob-path.css §3. */
function at(o: number, s: number) {
  return { "--o": o, "--s": s } as CSSProperties;
}

const solid = { stroke: "currentColor", strokeWidth: LINE, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" } as const;

/** A phone's outline from its left edge, as one path that draws round from the top left. */
function outline(x: number) {
  const { w, h, r } = PHONE;
  const t = PAD;
  return `M${x + r} ${t} H${x + w - r} A${r} ${r} 0 0 1 ${x + w} ${t + r} V${t + h - r} A${r} ${r} 0 0 1 ${x + w - r} ${t + h} H${x + r} A${r} ${r} 0 0 1 ${x} ${t + h - r} V${t + r} A${r} ${r} 0 0 1 ${x + r} ${t} Z`;
}

/** A tab's icon: a small rounded square, as one path. */
function icon(cx: number, cy: number) {
  const s = 2.6;
  return `M${cx - s + 1} ${cy - s} H${cx + s - 1} A1 1 0 0 1 ${cx + s} ${cy - s + 1} V${cy + s - 1} A1 1 0 0 1 ${cx + s - 1} ${cy + s} H${cx - s + 1} A1 1 0 0 1 ${cx - s} ${cy + s - 1} V${cy - s + 1} A1 1 0 0 1 ${cx - s + 1} ${cy - s} Z`;
}

function Phone({ x, o, bar }: { x: number; o: number; bar: "tabs" | "nav" }) {
  const top = PAD;
  return (
    <g>
      <path d={outline(x)} pathLength={1} className="mob-path-draw" style={at(o, 0.14)} {...solid} />
      {/* The system's own cut in the glass: a pill on one, a punch-hole on the other. */}
      {bar === "tabs" ? (
        <rect x={x + 25} y={top + 5} width={14} height={4} rx={2} fill="currentColor" className="mob-plat-fade" style={at(o + 0.1, 0.06)} />
      ) : (
        <circle cx={x + PHONE.w / 2} cy={top + 7} r={2} fill="currentColor" className="mob-plat-fade" style={at(o + 0.1, 0.06)} />
      )}

      {/* The same screen on both: a title and three bars. */}
      <path
        d={`M${x + MARGIN} ${top + Y.title} H${x + MARGIN + 26}`}
        pathLength={1} className="mob-path-draw"
        style={at(o + 0.15, 0.06)}
        {...solid}
        strokeWidth={3}
        strokeOpacity={0.7}
      />
      {Y.bars.map((y, k) => (
        <path
          key={y}
          d={`M${x + MARGIN + 2.5} ${top + y} H${x + MARGIN + BARS[k] - 2.5}`}
          pathLength={1} className="mob-path-draw"
          style={at(o + 0.2 + k * 0.04, 0.06)}
          {...solid}
          strokeWidth={5}
          strokeOpacity={0.18}
        />
      ))}

      {/* The way round the app: a tab bar under a hairline, or a navigation bar with the tab you're on in a pill. */}
      {bar === "tabs" ? (
        <path
          d={`M${x + 4} ${top + Y.rule} H${x + PHONE.w - 4}`}
          pathLength={1} className="mob-path-draw"
          style={at(o + 0.33, 0.06)}
          {...solid}
          strokeOpacity={0.35}
        />
      ) : (
        <rect
          x={x + TABS[ACTIVE] - 8}
          y={top + Y.icon - 5}
          width={16}
          height={10}
          rx={5}
          fill="currentColor"
          fillOpacity={0.2}
          className="mob-plat-fade text-(--saas-tick)"
          style={at(o + 0.33, 0.06)}
        />
      )}
      {TABS.map((cx, k) => (
        <g key={cx} className={cn(k === ACTIVE && "text-(--saas-tick)")}>
          <path d={icon(x + cx, top + Y.icon)} pathLength={1} className="mob-path-draw" style={at(o + 0.36 + k * 0.02, 0.05)} {...solid} strokeWidth={1.4} />
          <path
            d={`M${x + cx - 4} ${top + Y.label} H${x + cx + 4}`}
            pathLength={1} className="mob-path-draw"
            style={at(o + 0.39 + k * 0.02, 0.04)}
            {...solid}
            strokeOpacity={k === ACTIVE ? 1 : 0.45}
          />
        </g>
      ))}
    </g>
  );
}

/** Stage 01's fifth row, from lg: the same screen on two phones, each with its own platform's way round. */
export function StageFigure({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
      width={VIEW.w}
      height={VIEW.h}
      className={cn("mob-plat-fig home-draw hidden max-w-full overflow-visible text-(--saas-dim) lg:block", className)}
    >
      <Phone x={PAD} o={0} bar="tabs" />
      <Phone x={PAD + PHONE.w + GAP} o={0.5} bar="nav" />
    </svg>
  );
}
