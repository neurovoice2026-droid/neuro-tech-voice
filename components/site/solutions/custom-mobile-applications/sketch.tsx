import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { MiniScreen, SketchBlock } from "@/lib/pages/custom-mobile-applications";

/* ------------------------------------------------------------------ *
 * #kinds — a sample's first screens, each drawn as a mini phone: the
 * storyboard in the room (kinds-instrument.tsx).
 *
 * A LINE DRAWING, NOT A SCREENSHOT. Each screen is a phone outline in
 * the landing's figure vocabulary (home/trust-figures.tsx: 1.6 strokes,
 * round caps; the SaaS page's `Screens` in build.tsx at phone scale), a
 * neutral pill at its top, a title bar and a home bar, and in it the
 * screen's one or two blocks from a fixed vocabulary of eighteen —
 * search, a list, a grid, a card, a map, a calendar, fields, a button,
 * a pay sheet, a chat, a chart, a camera, a code, a signature, a
 * picture, a notification, a progress ring, a done tick — each drawn to
 * fit whatever box the screen gives it: a list repeats its rows to its
 * height, a grid its tiles, a chat its bubbles; a code, a ring or a tick
 * sits in the middle of its box at its own size. Grey throughout (the
 * landing's chip grey for fills, ink at 12% for their edges, ink at 20%
 * and 10% for the bars that stand for words), but for the six blocks
 * that need something of the phone itself — a map, a camera, a code, a
 * notification, a pay sheet, a signature — which are drawn in the
 * light's tick violet (`--saas-tick`, electric on the white glass: 5.70,
 * a mark), so the picture points at what the card beside it lists under
 * "What it asks of the phone". No word, digit, brand or logo is drawn:
 * the screen's name is the list item's text, under the drawing.
 *
 * THE GEOMETRY is a 120 × 246 box, the device's own 1 : 2.05, drawn at
 * 120px wide (md), 150 (below md and lg) and 168 (xl): the strokes keep
 * their width at every size (`non-scaling-stroke`), but for the outline.
 * Its dash draw is a `pathLength` one, which Chromium measures on the
 * unscaled path and paints on the scaled one, so on a non-scaling
 * stroke the one dash would cover only 1/scale of the outline and leave
 * its left edge undrawn. The outline scales with the drawing instead,
 * its width 1.6 ÷ the scale per size (`--mob-sk-w`, set beside the
 * widths in kinds-instrument.tsx; mob-kinds.css §1). The blocks are laid
 * in a 96 × 180 content box. A search bar and a button keep their own
 * height (the button at the foot of its box, where an app puts its one
 * action); two other blocks share the box by weight, so a map or a
 * camera takes more of it than a card or a pair of fields.
 *
 * THE MOTION is CSS alone (mob-kinds.css §1), on the storyboard's own
 * `.home-draw` view timeline. Before any pick, phone `i` takes its slice
 * of the board's passage (from `i × 0.12`, for 0.3 of it, the SaaS
 * stage-01 slice rule), and within it the outline draws (home.css's
 * `home-draw`, the one path here with a `pathLength`), then the glass
 * and its chrome, then each block, fade in (`mob-fade-in`, the
 * `.mob-sk-fade` groups). Each element carries its own `--o` (where it
 * starts) and `--s` (how much it takes) inline. Wherever that doesn't
 * run — reduced motion, the lite and still tiers, weak hardware, a
 * browser without view timelines, and after the reader's first pick —
 * the markup is the finished drawing.
 *
 * Colours are classes (mob-kinds.css §1), not utilities, so forced
 * colours can hand every one of them to the system in one place (§5).
 *
 * PURE. No "use client" and no hooks, and only types from the data
 * module: a leaf the client island renders.
 * ------------------------------------------------------------------ */

/** The blocks that need something of the phone itself: drawn in tick violet. */
export const PHONE_BLOCKS: ReadonlySet<SketchBlock> = new Set<SketchBlock>(["map", "camera", "code", "notice", "pay", "sign"]);

/** The drawing's box: the device's own aspect, 1 : 2.05. */
const VIEW = { w: 120, h: 246 } as const;
/** The phone's outline: half a stroke in from the box, its corners at 16. */
const PHONE = { x: 1, y: 1, w: 118, h: 244, r: 16 } as const;
/** Where every screen's blocks are laid: under the title bar, over the home bar. */
const CONTENT = { x: 12, y: 44, w: 96, h: 180 } as const;
/** The air between a screen's two blocks. */
const GAP = 8;

type Box = { x: number; y: number; w: number; h: number };

/** The two blocks that keep their own height, whatever the box: a search bar, and a button. */
const FIXED: Partial<Record<SketchBlock, number>> = { search: 16, button: 20 };
/** How much of a shared box each other block takes, against the block beside it. */
const WEIGHT: Record<SketchBlock, number> = {
  search: 0,
  button: 0,
  list: 1,
  grid: 1,
  card: 0.8,
  map: 1.3,
  calendar: 1,
  field: 0.6,
  pay: 0.8,
  chat: 1,
  chart: 0.9,
  camera: 1.3,
  code: 1,
  sign: 0.8,
  media: 0.9,
  notice: 0.7,
  ring: 0.9,
  check: 0.7,
};

/** The content box shared out: one block takes it all, two take their fixed heights, then the rest by weight. */
function layout(blocks: MiniScreen["blocks"]): Box[] {
  const { x, y, w, h } = CONTENT;
  if (blocks.length === 1) return [{ x, y, w, h }];
  const [a, b] = blocks;
  const room = h - GAP;
  const fa = FIXED[a];
  const fb = FIXED[b];
  const ha = fa ?? (fb !== undefined ? room - fb : Math.round((room * WEIGHT[a]) / (WEIGHT[a] + WEIGHT[b])));
  return [
    { x, y, w, h: ha },
    { x, y: y + ha + GAP, w, h: room - ha },
  ];
}

/** When an element draws, as a share of the board's pass: from `o`, for `s` (mob-kinds.css §1). */
function at(o: number, s: number) {
  return { "--o": o, "--s": s } as CSSProperties;
}

/** Strokes keep their width at every size the phone is drawn at. */
const EDGE = { strokeWidth: 1, vectorEffect: "non-scaling-stroke" } as const;
const MARK = { strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", vectorEffect: "non-scaling-stroke" } as const;

/** The phone's outline, drawn clockwise from the end of its top-left corner, closed. */
const OUTLINE = (() => {
  const { x, y, w, h, r } = PHONE;
  return [
    `M${x + r} ${y} H${x + w - r} A${r} ${r} 0 0 1 ${x + w} ${y + r}`,
    `V${y + h - r} A${r} ${r} 0 0 1 ${x + w - r} ${y + h}`,
    `H${x + r} A${r} ${r} 0 0 1 ${x} ${y + h - r}`,
    `V${y + r} A${r} ${r} 0 0 1 ${x + r} ${y} Z`,
  ].join(" ");
})();

/** A bar that stands for a line of words: ink at 20% (`bar`) or at 10% (`faint`). */
function Bar({ x, y, w, h = 3, tone = "faint" }: { x: number; y: number; w: number; h?: number; tone?: "bar" | "faint" | "knock" }) {
  return <rect className={`mob-sk-${tone}`} x={x} y={y} width={Math.max(h, w)} height={h} rx={h / 2} />;
}

/* ─── The eighteen blocks ─────────────────────────────────────────── *
 * Each draws into its box, and none past it. The shapes are the
 * landing's: rounded rectangles, round caps, dots. Proportions are the
 * phone's, so a list row is a finger's height, a button a thumb's width. */

function Search({ x, y, w }: Box) {
  return (
    <>
      <rect className="mob-sk-grey" x={x} y={y} width={w} height={16} rx={8} {...EDGE} />
      <circle className="mob-sk-ink" cx={x + 9} cy={y + 7.5} r={3} fill="none" {...MARK} />
      <path className="mob-sk-ink" d={`M${x + 11.3} ${y + 9.8} l2.2 2.2`} fill="none" {...MARK} />
      <Bar x={x + 18} y={y + 6.5} w={w * 0.42} />
    </>
  );
}

function Button({ x, y, w, h }: Box) {
  const top = y + h - 20;
  return (
    <>
      <rect className="mob-sk-bar" x={x + 4} y={top} width={w - 8} height={20} rx={10} />
      <Bar x={x + w / 2 - 14} y={top + 8.5} w={28} tone="knock" />
    </>
  );
}

/** Rows of a finger's height: a round thumbnail, a line and a shorter one, a hairline under each but the last. */
const ROW = 26;
const LONG = [0.66, 0.52, 0.72, 0.58, 0.62, 0.48, 0.7];
const SHORT = [0.42, 0.48, 0.34, 0.52, 0.38, 0.44, 0.36];
function List({ x, y, w, h }: Box) {
  const n = Math.max(1, Math.floor((h + 4) / ROW));
  const text = w - 22;
  return (
    <>
      {Array.from({ length: n }, (_, r) => {
        const ry = y + r * ROW;
        return (
          <g key={r}>
            <circle className="mob-sk-grey" cx={x + 8} cy={ry + 10} r={7} {...EDGE} />
            <Bar x={x + 22} y={ry + 5} w={text * LONG[r % LONG.length]} h={4} tone="bar" />
            <Bar x={x + 22} y={ry + 12.5} w={text * SHORT[r % SHORT.length]} />
            {r < n - 1 && <path className="mob-sk-line" d={`M${x + 22} ${ry + 22.5} H${x + w}`} fill="none" {...EDGE} />}
          </g>
        );
      })}
    </>
  );
}

/** Two columns of tiles, each with a line under it, as many rows as fit. */
function Grid({ x, y, w, h }: Box) {
  const tw = (w - 8) / 2;
  const th = Math.round(tw * 0.82);
  const cell = th + 14;
  const rows = Math.max(1, Math.floor((h + 4) / cell));
  return (
    <>
      {Array.from({ length: rows * 2 }, (_, k) => {
        const tx = x + (k % 2) * (tw + 8);
        const ty = y + Math.floor(k / 2) * cell;
        return (
          <g key={k}>
            <rect className="mob-sk-grey" x={tx} y={ty} width={tw} height={th} rx={7} {...EDGE} />
            <Bar x={tx + 1} y={ty + th + 5} w={tw * (k % 3 === 1 ? 0.52 : 0.7)} />
          </g>
        );
      })}
    </>
  );
}

/**
 * A card: a thumbnail, a title and a line beside it, two lines under them
 * where it has the height, and where it has more, the details a card like
 * that lists (a label and its value to a row, under a hairline), as far
 * as it goes: a booking's time and place, an order's items.
 */
function Card({ x, y, w, h }: Box) {
  const ch = Math.min(h, 132);
  const rows = Math.max(0, Math.floor((ch - 58) / 16));
  return (
    <>
      <rect className="mob-sk-grey" x={x} y={y} width={w} height={ch} rx={9} {...EDGE} />
      <rect className="mob-sk-faint" x={x + 8} y={y + 8} width={18} height={18} rx={5} />
      <Bar x={x + 32} y={y + 10} w={(w - 40) * 0.72} h={4} tone="bar" />
      <Bar x={x + 32} y={y + 18} w={(w - 40) * 0.5} />
      {ch >= 50 && (
        <>
          <Bar x={x + 8} y={y + 34} w={w - 16} />
          <Bar x={x + 8} y={y + 41} w={(w - 16) * 0.7} />
        </>
      )}
      {rows > 0 && <path className="mob-sk-line" d={`M${x + 8} ${y + 52.5} H${x + w - 8}`} fill="none" {...EDGE} />}
      {Array.from({ length: rows }, (_, r) => {
        const value = [30, 22, 36, 26][r % 4];
        return (
          <g key={r}>
            <Bar x={x + 8} y={y + 61 + r * 16} w={[24, 32, 20, 28][r % 4]} />
            <Bar x={x + w - 8 - value} y={y + 60.5 + r * 16} w={value} h={4} tone="bar" />
          </g>
        );
      })}
    </>
  );
}

/** A map: its roads in grey, the route in tick violet from a hollow start to a pin. */
function MapBlock({ x, y, w, h }: Box) {
  const p = (fx: number, fy: number) => `${x + w * fx} ${y + h * fy}`;
  const end = { cx: x + w * 0.74, cy: y + h * 0.24 };
  return (
    <>
      <rect className="mob-sk-tick" x={x} y={y} width={w} height={h} rx={9} {...EDGE} />
      <path className="mob-sk-line" d={`M${x} ${y + h * 0.36} H${x + w} M${x + w * 0.3} ${y} V${y + h} M${p(0.5, 1)} L${p(1, 0.58)}`} fill="none" {...EDGE} />
      <path className="mob-sk-tickline" d={`M${p(0.2, 0.8)} L${p(0.3, 0.56)} L${p(0.6, 0.5)} L${end.cx} ${end.cy + 6}`} fill="none" {...MARK} />
      <circle className="mob-sk-glass mob-sk-tickline" cx={x + w * 0.2} cy={y + h * 0.8} r={2.6} {...MARK} />
      <circle className="mob-sk-ticksolid" cx={end.cx} cy={end.cy} r={5} />
      <circle className="mob-sk-knock" cx={end.cx} cy={end.cy} r={1.8} />
    </>
  );
}

/** A month: its name, then up to five weeks of days as dots, one of them chosen. */
function Calendar({ x, y, w, h }: Box) {
  const cw = w / 7;
  const weeks = Math.max(2, Math.min(5, Math.floor((h - 12) / 15)));
  return (
    <>
      <Bar x={x + 2} y={y + 1} w={34} h={4} tone="bar" />
      {Array.from({ length: weeks * 7 }, (_, k) => {
        const cx = x + cw * (k % 7) + cw / 2;
        const cy = y + 18 + Math.floor(k / 7) * 15;
        return k === 10 ? (
          <g key={k}>
            <circle className="mob-sk-bar" cx={cx} cy={cy} r={6} />
            <circle className="mob-sk-knock" cx={cx} cy={cy} r={1.8} />
          </g>
        ) : (
          <circle key={k} className="mob-sk-faint" cx={cx} cy={cy} r={2.2} />
        );
      })}
    </>
  );
}

/** Fields: a label over each box, two where they fit. */
function Field({ x, y, w, h }: Box) {
  const n = h >= 52 ? 2 : 1;
  return (
    <>
      {Array.from({ length: n }, (_, k) => {
        const fy = y + k * 30;
        return (
          <g key={k}>
            <Bar x={x + 1} y={fy} w={k === 0 ? 26 : 34} />
            <rect className="mob-sk-grey" x={x} y={fy + 6} width={w} height={17} rx={5} {...EDGE} />
          </g>
        );
      })}
    </>
  );
}

/** A pay sheet in tick violet: a card, its two lines, and the button that pays. */
function Pay({ x, y, w, h }: Box) {
  const ph = Math.min(h, 76);
  return (
    <>
      <rect className="mob-sk-tick" x={x} y={y} width={w} height={ph} rx={10} {...EDGE} />
      <rect className="mob-sk-glass mob-sk-tickline" x={x + 8} y={y + 9} width={20} height={13} rx={2.5} {...EDGE} />
      <path className="mob-sk-tickline" d={`M${x + 8} ${y + 13.5} H${x + 28}`} fill="none" {...EDGE} />
      <Bar x={x + 34} y={y + 10} w={30} h={4} tone="bar" />
      <Bar x={x + 34} y={y + 17} w={20} />
      <rect className="mob-sk-ticksolid" x={x + 8} y={y + ph - 22} width={w - 16} height={14} rx={7} />
      <Bar x={x + w / 2 - 10} y={y + ph - 16.5} w={20} tone="knock" />
    </>
  );
}

/** A conversation: their bubbles grey on the left, yours darker on the right, as many as fit. */
const BUBBLES = [0.62, 0.5, 0.7, 0.44, 0.56, 0.48, 0.66];
function Chat({ x, y, w, h }: Box) {
  const n = Math.max(2, Math.floor((h + 6) / 22));
  return (
    <>
      {Array.from({ length: n }, (_, k) => {
        const by = y + k * 22;
        const bw = w * BUBBLES[k % BUBBLES.length];
        return k % 2 === 0 ? (
          <rect key={k} className="mob-sk-grey" x={x} y={by} width={bw} height={16} rx={8} {...EDGE} />
        ) : (
          <rect key={k} className="mob-sk-bar" x={x + w - bw} y={by + 1} width={bw} height={14} rx={7} />
        );
      })}
    </>
  );
}

/** A chart: its title, six columns on a baseline, the tallest darker. */
const COLUMNS = [0.45, 0.7, 0.55, 1, 0.62, 0.82];
function Chart({ x, y, w, h }: Box) {
  const base = y + h - 3;
  const cw = 9;
  const step = (w - 8 - cw) / (COLUMNS.length - 1);
  const top = y + 12;
  return (
    <>
      <Bar x={x + 1} y={y + 1} w={30} h={4} tone="bar" />
      {COLUMNS.map((f, k) => {
        const tall = (base - top) * f;
        return (
          <rect
            key={k}
            className={f === 1 ? "mob-sk-bar" : "mob-sk-faint"}
            x={x + 4 + k * step}
            y={base - tall}
            width={cw}
            height={tall}
            rx={2.5}
          />
        );
      })}
      <path className="mob-sk-line" d={`M${x} ${base + 0.5} H${x + w}`} fill="none" {...EDGE} />
    </>
  );
}

/** A camera in tick violet: the viewfinder with its corners and a focus square, and the shutter under it where there's room. */
function Camera({ x, y, w, h }: Box) {
  const shutter = h >= 70;
  const vh = shutter ? h - 28 : h;
  const i = 7;
  const l = 10;
  const cx = x + w / 2;
  const cy = y + vh / 2;
  return (
    <>
      <rect className="mob-sk-tick" x={x} y={y} width={w} height={vh} rx={9} {...EDGE} />
      <path
        className="mob-sk-tickline"
        d={[
          `M${x + i} ${y + i + l} V${y + i} H${x + i + l}`,
          `M${x + w - i - l} ${y + i} H${x + w - i} V${y + i + l}`,
          `M${x + w - i} ${y + vh - i - l} V${y + vh - i} H${x + w - i - l}`,
          `M${x + i + l} ${y + vh - i} H${x + i} V${y + vh - i - l}`,
        ].join(" ")}
        fill="none"
        {...MARK}
      />
      <rect className="mob-sk-tickline" x={cx - 10} y={cy - 10} width={20} height={20} rx={4} fill="none" {...EDGE} />
      {shutter && (
        <>
          <circle className="mob-sk-glass mob-sk-tickline" cx={cx} cy={y + h - 11} r={10} {...EDGE} />
          <circle className="mob-sk-ticksolid" cx={cx} cy={y + h - 11} r={7} />
        </>
      )}
    </>
  );
}

/** A code in tick violet, in the middle of its box: three finder squares and a scatter of dots, inside the scanner's corners. */
const DOTS: readonly (readonly [number, number])[] = [
  [0.55, 0.12], [0.7, 0.22], [0.5, 0.36], [0.62, 0.5], [0.8, 0.44], [0.14, 0.58], [0.3, 0.66],
  [0.5, 0.7], [0.66, 0.66], [0.82, 0.62], [0.58, 0.84], [0.74, 0.82], [0.86, 0.86], [0.4, 0.84],
];
function Code({ x, y, w, h }: Box) {
  const s = Math.min(w - 32, h - 20, 64);
  const sx = x + (w - s) / 2;
  const sy = y + (h - s) / 2;
  const m = 7;
  const l = 9;
  const finder = (fx: number, fy: number) => (
    <g key={`${fx}-${fy}`}>
      <rect className="mob-sk-tickline" x={fx} y={fy} width={13} height={13} rx={2.5} fill="none" {...EDGE} />
      <rect className="mob-sk-ticksolid" x={fx + 4} y={fy + 4} width={5} height={5} rx={1} />
    </g>
  );
  return (
    <>
      <path
        className="mob-sk-tickline"
        d={[
          `M${sx - m} ${sy - m + l} V${sy - m} H${sx - m + l}`,
          `M${sx + s + m - l} ${sy - m} H${sx + s + m} V${sy - m + l}`,
          `M${sx + s + m} ${sy + s + m - l} V${sy + s + m} H${sx + s + m - l}`,
          `M${sx - m + l} ${sy + s + m} H${sx - m} V${sy + s + m - l}`,
        ].join(" ")}
        fill="none"
        {...MARK}
      />
      {finder(sx, sy)}
      {finder(sx + s - 13, sy)}
      {finder(sx, sy + s - 13)}
      {DOTS.map(([fx, fy]) => (
        <rect key={`${fx}-${fy}`} className="mob-sk-ticksolid" x={sx + s * fx - 2} y={sy + s * fy - 2} width={4} height={4} rx={1} />
      ))}
    </>
  );
}

/** A signature in tick violet: the pad, the line to sign on with its cross, and the stroke of a name across it. */
function Sign({ x, y, w, h }: Box) {
  const sh = Math.min(h, 66);
  const line = y + sh - 14;
  return (
    <>
      <rect className="mob-sk-grey" x={x} y={y} width={w} height={sh} rx={8} {...EDGE} />
      <path className="mob-sk-line" d={`M${x + 18} ${line} H${x + w - 10}`} fill="none" {...EDGE} />
      <path className="mob-sk-ink" d={`M${x + 9} ${line - 5} l4 4 M${x + 13} ${line - 5} l-4 4`} fill="none" {...MARK} />
      <path
        className="mob-sk-tickline"
        d={`M${x + 20} ${line - 6} C${x + 26} ${line - 26} ${x + 32} ${line - 24} ${x + 32} ${line - 12} S${x + 40} ${line - 22} ${x + 48} ${line - 16} S${x + 58} ${line - 6} ${x + 66} ${line - 18} S${x + 76} ${line - 12} ${x + w - 14} ${line - 16}`}
        fill="none"
        {...MARK}
      />
    </>
  );
}

/** A picture: a frame with a hill and a sun, as tall as its box allows. */
function Media({ x, y, w, h }: Box) {
  const mh = Math.min(h, 150);
  const p = (fx: number, fy: number) => `${x + w * fx} ${y + mh * fy}`;
  return (
    <>
      <rect className="mob-sk-grey" x={x} y={y} width={w} height={mh} rx={8} {...EDGE} />
      <path className="mob-sk-faint" d={`M${p(0.08, 0.88)} L${p(0.38, 0.52)} L${p(0.54, 0.7)} L${p(0.68, 0.56)} L${p(0.92, 0.88)} Z`} />
      <circle className="mob-sk-faint" cx={x + w * 0.72} cy={y + mh * 0.28} r={Math.min(7, mh * 0.1)} />
    </>
  );
}

/**
 * A notification in tick violet. On a screen of its own it is the lock
 * screen: the date and the time over it, the new notification, an older
 * one in grey under it, and the two round buttons at the foot; beside
 * another block, the card alone.
 */
function Notice({ x, y, w, h }: Box) {
  const lock = h >= 110;
  const cy = lock ? y + 40 : y;
  const card = (top: number, tone: "tick" | "grey") => (
    <>
      <rect className={`mob-sk-${tone}`} x={x} y={top} width={w} height={36} rx={9} {...EDGE} />
      <rect className={tone === "tick" ? "mob-sk-ticksolid" : "mob-sk-bar"} x={x + 7} y={top + 8} width={11} height={11} rx={3} />
      <Bar x={x + 24} y={top + 9} w={w * (tone === "tick" ? 0.44 : 0.36)} h={4} tone={tone === "tick" ? "bar" : "faint"} />
      <Bar x={x + 24} y={top + 17} w={w * (tone === "tick" ? 0.62 : 0.54)} />
      <Bar x={x + 24} y={top + 24} w={w * (tone === "tick" ? 0.36 : 0.3)} />
    </>
  );
  return (
    <>
      {lock && (
        <>
          <Bar x={x + w / 2 - 15} y={y + 2} w={30} />
          <Bar x={x + w / 2 - 25} y={y + 10} w={50} h={12} tone="bar" />
        </>
      )}
      {card(cy, "tick")}
      {lock && (
        <>
          {card(cy + 44, "grey")}
          <circle className="mob-sk-grey" cx={x + 11} cy={y + h - 11} r={10} {...EDGE} />
          <circle className="mob-sk-grey" cx={x + w - 11} cy={y + h - 11} r={10} {...EDGE} />
        </>
      )}
    </>
  );
}

/** A progress ring in the middle of its box: the track, and most of the way round it. */
function Ring({ x, y, w, h }: Box) {
  const r = Math.max(12, Math.min(24, h / 2 - 8, w / 2 - 10));
  const cx = x + w / 2;
  const cy = y + h / 2;
  // 70% of the way round, clockwise from the top.
  const a = 0.7 * 2 * Math.PI;
  const ex = cx + r * Math.sin(a);
  const ey = cy - r * Math.cos(a);
  return (
    <>
      <circle className="mob-sk-line" cx={cx} cy={cy} r={r} fill="none" strokeWidth={5} vectorEffect="non-scaling-stroke" />
      <path
        className="mob-sk-mid"
        d={`M${cx} ${cy - r} A${r} ${r} 0 1 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`}
        fill="none"
        strokeWidth={5}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <Bar x={cx - 9} y={cy - 2} w={18} h={4} tone="bar" />
    </>
  );
}

/** Done: a disc with a tick in the middle of its box, and a line under it. */
function Check({ x, y, w, h }: Box) {
  const r = Math.max(10, Math.min(26, h / 2 - 12));
  const cx = x + w / 2;
  const cy = y + h / 2 - 5;
  return (
    <>
      <circle className="mob-sk-grey" cx={cx} cy={cy} r={r} {...EDGE} />
      <path
        className="mob-sk-mid"
        d={`M${cx - r * 0.4} ${cy + r * 0.02} L${cx - r * 0.1} ${cy + r * 0.32} L${cx + r * 0.42} ${cy - r * 0.28}`}
        fill="none"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <Bar x={cx - 18} y={cy + r + 7} w={36} />
    </>
  );
}

const DRAW: Record<SketchBlock, (b: Box) => ReactNode> = {
  search: Search,
  list: List,
  grid: Grid,
  card: Card,
  map: MapBlock,
  calendar: Calendar,
  field: Field,
  button: Button,
  pay: Pay,
  chat: Chat,
  chart: Chart,
  camera: Camera,
  code: Code,
  sign: Sign,
  media: Media,
  notice: Notice,
  ring: Ring,
  check: Check,
};

/**
 * One of a sample's first screens, drawn: aria-hidden, since its name is
 * printed under it. `i` is its place in the storyboard (0–4), which sets
 * its slice of the board's passage: it starts at `i × 0.12` and is whole
 * 0.3 later.
 */
export function MiniPhone({ screen, i, className }: { screen: MiniScreen; i: number; className?: string }) {
  const o = i * 0.12;
  const boxes = layout(screen.blocks);
  return (
    <svg
      viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
      aria-hidden
      className={cn("mob-sketch block h-auto w-full overflow-visible", className)}
    >
      {/* The glass comes up with its edge, rather than waiting for it as a blank. */}
      <rect
        className="mob-sk-fade mob-sk-glass"
        x={PHONE.x}
        y={PHONE.y}
        width={PHONE.w}
        height={PHONE.h}
        rx={PHONE.r}
        style={at(o, 0.16)}
      />
      {/* The one stroke that draws: scaled with the drawing, its width set per
          size in CSS (mob-kinds.css §1), since a pathLength dash on a
          non-scaling stroke covers only 1/scale of the outline in Chromium. */}
      <path
        className="mob-sk-edge"
        d={OUTLINE}
        pathLength={1}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={at(o, 0.16)}
      />
      {/* The chrome every screen has: the pill at the top, the title, the home bar. */}
      <g className="mob-sk-fade" style={at(o + 0.06, 0.1)}>
        <rect className="mob-sk-bar" x={VIEW.w / 2 - 15} y={9} width={30} height={8} rx={4} />
        <Bar x={CONTENT.x} y={27} w={44} h={7} tone="bar" />
        <Bar x={VIEW.w / 2 - 16} y={233} w={32} />
      </g>
      {screen.blocks.map((block, k) => (
        <g
          key={`${block}-${k}`}
          data-block={block}
          className="mob-sk-fade"
          style={at(o + 0.1 + k * 0.08, 0.12)}
        >
          {DRAW[block](boxes[k])}
        </g>
      ))}
    </svg>
  );
}
