"use client";

import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type Ref,
} from "react";
import type { CAA_HERO, SheetLine, TraceCaller } from "@/lib/pages/custom-ai-agents";
import { cn } from "@/lib/utils";
import { Eyebrow, PillLink, SectionTitle } from "@/components/site/product/primitives";
import { useInView, usePrefersReducedMotion } from "@/components/site/product/timing";
import { Gate, ToolName } from "@/components/site/industry/parts";
import { MadeUp, Node, Stack, fill } from "./parts";
import { markProved } from "./proved";

/* ------------------------------------------------------------------ *
 * §0 — The cover. The sheet by the phone turns into a flow.
 *
 * The objection is the first one every owner raises about a "custom"
 * anything: my business is different, and a template won't know how we
 * work. The answer is not an adjective. It is their own sheet — the
 * scrap of paper taped next to the office phone, with the greeting, the
 * question asked first, the rule nobody breaks and the two calls that go
 * to someone else — and what each line of it became in the agent. So the
 * instrument is exactly that: seven handwritten lines on the left, the
 * flow they became on the right, and a caption (under the flow at lg,
 * under the list below it) saying, line by line, what a line turned into
 * and which tool (if any) does it.
 *
 * THE LINK IS A SHARED INDEX, NOT A BEAM. An earlier draft drew a beam
 * from each sheet line to its node, which needed both boxes measured in
 * a layout effect — on the LCP section, on every visit, before the first
 * paint could settle. Instead the sheet row and its node read one piece
 * of state: the row turns to a white card, the node takes an ink ring,
 * its label goes ink. Nothing moves and nothing is measured, and the pair
 * is still obvious because it is the only pair lit.
 *
 * TWO AUTHORED COMPOSITIONS, SWITCHED BY CSS. Above lg the sheet and the
 * flow sit side by side; below it the flow is a list down a left gutter,
 * because a wide diagram squeezed into 288px is how a hero becomes the
 * weakest thing on a phone. Both are in the server HTML and `lg:` picks
 * one — the other is display:none, so it costs no layout, has no
 * focusable controls, and the server's first paint is already the right
 * geometry at every width. No useWidth, no ResizeObserver, no layout
 * effect: the landscape flow is a fixed-height box whose x positions are
 * percentages of its own width and whose y positions are pixels, so it
 * lays itself out. The only SVG is the book fork, a fixed 48×112 at 1:1,
 * so its 1.6px strokes are 1.6px at every width.
 *
 * GEOMETRY (landscape, box 340px tall, 564–796px wide). The rule is a
 * dimension line across the top at y=58 — a rule it keeps *all call* is
 * not a step on the way, it spans the whole thing, and drawn as a
 * dimension (hairline with end ticks) it can't be confused with the page
 * legend's dotted "built for you". y=58, not 44: at 44 its label sat 22px
 * under the legend in the same 11px caps and the two read as one run of
 * labels; 58 puts its label 20px clear of the legend and its ticks
 * (to ~63) still 11px above Dan's label band (74–118). The spine runs y=170 from 4% to 64%
 * with greet · plan · sort · book at 20% intervals; the two hand-offs
 * leave it vertically (Dan up from sort, the night message down from
 * greet) so they read as leaving the call, not continuing it; the book
 * node forks right into the Saturday / weekday prongs. Labels hang to the
 * right of their vertical so a branch never runs through a word, with
 * one exception: "Books" sits on the stem just before the fork, because
 * under it and above it are where the prongs go. Every label and hit
 * area was checked for overlap with getBoundingClientRect at figure
 * widths 564 (1024 viewport), 700, 796 and at 2560.
 *
 * TIMING. Once, when the cover is in view (it is on load):
 *   240ms   reading — a violet margin tick fades in beside each sheet
 *           line, 140ms apart: the product reading the sheet, top down.
 *   1300ms  drawn — the spine draws over 1400ms (the long stroke the eye
 *           follows), nodes fill 120ms apart as it passes them, the two
 *           branches draw 760ms each as the spine reaches their root,
 *           the prongs draw 400ms in, the rule's dimension line draws.
 *   2900ms  settled — every stroke has landed; the caption (already
 *           showing line 3 since the first paint, because it is the LCP
 *           paragraph's neighbour and must not arrive late) re-lands
 *           with the house ind-swap so the eye is taken to it.
 * Nothing moves after that; it does not loop. A pick jumps to settled,
 * cancels whatever was pending and marks the "sheet" claim proved.
 * Reduced motion is derived, not scheduled: the phase simply *is*
 * settled, caa.css pins the draw-ons, and the fork's inline transitions
 * are dropped, so the first frame is the final one.
 *
 * COLOUR. Black is the platform doing it today: the spine, the nodes,
 * the fork. Violet appears only as the margin ticks — the product's hand
 * on the sheet. No dotted line anywhere in this figure: everything in it
 * is on the platform today, and the page's dotted grammar ("built for
 * you") is stated once, lower down, and never contradicted up here.
 *
 * KEYBOARD. The seven sheet rows (landscape) or the seven list rows
 * (portrait) are the keyboard path; they are pressed buttons, not a
 * radiogroup, so Tab walks them and Space/Enter picks. The landscape
 * flow's nodes and labels duplicate the sheet's function for a pointer,
 * so they are tabIndex -1 and the drawing is aria-hidden: fourteen tab
 * stops for seven choices would be a tax, and the caption carries in
 * words everything the drawing shows.
 *
 * PREVIEW (H1). Pointing at a sheet row with a mouse, or focusing it,
 * shows its pair before you commit: the node takes a *muted* ring (black
 * is the selection's, and the selection always wins), its label goes
 * ink. Pointing at the flow shows the row as a faint white card. One
 * `peek` index, null on the server, so the first paint is unchanged; it
 * is colour, shadow and background only, so nothing moves; and it never
 * picks, never speaks and never marks the claim proved — looking is not
 * operating. Touch taps are not mouse pointers, so a tap stays a pick
 * and no preview is left stuck under a finger.
 *
 * A SAMPLE CALLER (H2). Four callers the sheet already answers — a plan
 * customer, one without, a landlord, someone ringing after six — and a
 * trace of each through the flow *as written*: every ring is a line on
 * the sheet, every outcome is one the page states elsewhere, and the
 * note above the chips says it is the sample sheet, not a live call. At lg a
 * 9px bead runs the drawn geometry; it is placed WITHOUT measuring,
 * exactly like everything else here: one carrier the size of the flow
 * box is translated by `calc(x% + px)` (a percentage translate is of the
 * carrier's own width, which is the box's) and y in pixels, and WAAPI
 * interpolates between those strings. The keyframes are sampled from the
 * same constants that place the nodes and draw the fork, so the bead and
 * the drawing cannot disagree. Each leg eases in and out on its own, so
 * the bead settles on every node that rings — the rhythm of a call
 * being passed along — and runs straight past the ones it only crosses.
 * Below lg there is no bead (list rows have intrinsic heights, and
 * pacing a bead down them would need them measured): the rows ring in
 * order instead. The pick itself is instant and honest — `sel` moves to
 * the line the call ends on at once, the claim is proved, the outcome is
 * announced — and the motion only shows the way there.
 * ------------------------------------------------------------------ */

type Phase = "idle" | "reading" | "drawn" | "settled";
type Data = typeof CAA_HERO;
type LineId = SheetLine["id"];

const READ_AT = 240;
const DRAW_AT = 1300;
const SETTLE_AT = 2900;
/** Margin ticks: one per sheet line, top down. */
const TICK_STAGGER = 140;
/** Spine nodes fill as the stroke passes them. */
const NODE_STAGGER = 120;
/** The prongs start once the spine has nearly reached the book node. */
const PRONG_AT = 400;
const PRONG_STAGGER = 80;
/** One easing for every stroke on the page (matches caa.css). */
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink";

/** The spine, left to right: where each step sits, as % of the flow box. */
const SPINE: readonly { id: LineId; x: number }[] = [
  { id: "greet", x: 4 },
  { id: "plan", x: 24 },
  { id: "sort", x: 44 },
  { id: "book", x: 64 },
];
/** y of the spine, the rule's dimension line, and the two branch ends (px). */
const SPINE_Y = 170;
const RULE_Y = 58;
const DAN_Y = 96;
const NIGHT_Y = 262;
/** The fork: a fixed 48×112 drawing whose (0,56) is the book node. */
const FORK = { w: 48, h: 112, top: SPINE_Y - 56 };
const PRONG_Y = [SPINE_Y - 52, SPINE_Y + 52];
/** The upper prong's cubic, in fork coordinates; the lower one is its
 *  mirror (y → 112 − y). The drawn path and the bead's route are both
 *  built from these four points, so the bead rides the stroke. */
const PRONG_CUBIC: readonly (readonly [number, number])[] = [
  [0, 56],
  [36, 56],
  [12, 4],
  [48, 4],
];
function prongCubic(k: number) {
  return PRONG_CUBIC.map(([x, y]) => [x, k === 0 ? y : FORK.h - y] as const);
}
/** "M0 56 C36 56 12 4 48 4" — the same path string as when it was typed in. */
function prongPath(k: number) {
  const [a, b, c, d] = prongCubic(k).map((p) => p.join(" "));
  return `M${a} C${b} ${c} ${d}`;
}

/* H2 — the trace. Times in ms. */
/** The bead fades in on the greeting before it sets off. The greeting
 *  rings once the bead is fully in (at 80% of this), not at 0: a ring
 *  with no bead on it reads as the call starting somewhere else. */
const TRACE_IN = 200;
/** A leg (node to ringing node) lasts BASE + PER_PX × its length: ~300ms for one spine step. */
const LEG_BASE = 200;
const LEG_PER_PX = 0.75;
/** Width the bead is PACED at. Timing only: every position is a % of the real box. */
const PACE_W = 680;
/** Samples per leg. Linear between them, eased across them, so the
 *  speed is a staircase with one step per sample: at 12 the steps were
 *  ~25ms apart and read as a stutter on a 120Hz screen; at 32 they are
 *  ~10ms, under a frame at 120Hz. ~140 keyframes a trace is nothing. */
const LEG_SAMPLES = 32;
/** The bead fades this long after reaching the end, over the same again. */
const BEAD_OUT = 200;
/** After the end rings, the passed nodes let go and the rule returns. */
const RESOLVE = 400;
/** A node's ring: grows 2.6× and fades. */
const RING_MS = 600;
/** Below lg: rows ring this far apart, and each keeps a faint tint this long. */
const P_RING_STAGGER = 260;
const P_TINT_MS = 400;
/** Below lg, when the list has to be brought up first: the rings wait for the scroll. */
const SCROLL_LEAD = 420;

/** cubic-bezier(x1, y1, x2, y2) as a function, to pace the bead in JS
 *  (WAAPI can ease a whole animation, not each leg of one). */
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const at = (a: number, b: number, t: number) => 3 * a * (1 - t) * (1 - t) * t + 3 * b * (1 - t) * t * t + t * t * t;
  return (x: number) => {
    let lo = 0;
    let hi = 1;
    for (let n = 0; n < 24; n++) {
      const mid = (lo + hi) / 2;
      if (at(x1, x2, mid) < x) lo = mid;
      else hi = mid;
    }
    return at(y1, y2, (lo + hi) / 2);
  };
}
/** In and out on every leg: the bead settles on each node that rings. */
const LEG_EASE = bezier(0.45, 0.05, 0.25, 1);
/** When, as a fraction of the leg's time, the eased bead has covered `y` of it. */
function unease(y: number) {
  let lo = 0;
  let hi = 1;
  for (let n = 0; n < 24; n++) {
    const mid = (lo + hi) / 2;
    if (LEG_EASE(mid) < y) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** A point in the flow box: x as `p`% of its width plus `px`, y in px. */
type Pt = { p: number; px: number; y: number };
const spinePt = (id: LineId): Pt => ({ p: SPINE.find((s) => s.id === id)?.x ?? 0, px: 0, y: SPINE_Y });
const DAN_PT: Pt = { p: 44, px: 0, y: DAN_Y };
const NIGHT_PT: Pt = { p: 4, px: 0, y: NIGHT_Y };

/** The way from one node to another, as the drawing runs: along the
 *  spine, up to Dan from the sort node, down to the night message from
 *  the greeting. Straight runs need no midpoints — the spine is straight. */
function way(from: LineId, to: LineId): Pt[] {
  if (to === "dan") return [...way(from, "sort"), DAN_PT];
  if (to === "night") return [...way(from, "greet"), NIGHT_PT];
  if (from === to) return [spinePt(to)];
  return [spinePt(from), spinePt(to)];
}

/** The book node out along prong k, sampled on its own cubic. */
function prongWay(k: number): Pt[] {
  const [a, b, c, d] = prongCubic(k);
  return Array.from({ length: 9 }, (_, j) => {
    const t = j / 8;
    const u = 1 - t;
    const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
    const x = w[0] * a[0] + w[1] * b[0] + w[2] * c[0] + w[3] * d[0];
    const y = w[0] * a[1] + w[1] * b[1] + w[2] * c[1] + w[3] * d[1];
    return { p: 64, px: x, y: FORK.top + y };
  });
}

const gap = (a: Pt, b: Pt) => Math.hypot(((b.p - a.p) / 100) * PACE_W + b.px - a.px, b.y - a.y);

/** Where along a polyline a distance `d` falls. */
function along(pts: readonly Pt[], d: number): Pt {
  for (let j = 1; j < pts.length; j++) {
    const g = gap(pts[j - 1], pts[j]);
    if (d <= g || j === pts.length - 1) {
      const f = g === 0 ? 1 : Math.min(1, d / g);
      const [a, b] = [pts[j - 1], pts[j]];
      return { p: a.p + (b.p - a.p) * f, px: a.px + (b.px - a.px) * f, y: a.y + (b.y - a.y) * f };
    }
    d -= g;
  }
  return pts[pts.length - 1];
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const place = (q: Pt) => `translate(calc(${r2(q.p)}% + ${r2(q.px)}px), ${r2(q.y)}px)`;

/** The stops a trace rings at lg: the caller's lines, then its prong. */
function wideStops(c: TraceCaller): string[] {
  return c.prong === undefined ? [...c.rings] : [...c.rings, `prong${c.prong}`];
}

/**
 * The bead's route as keyframes, and when it arrives at each stop.
 * Every leg is sampled LEG_SAMPLES times on the leg's own easing, so a
 * single linear animation carries per-leg easing, turns the Dan corner
 * and follows the fork's curve without any of it being measured.
 */
function beadRoute(c: TraceCaller) {
  const legs: Pt[][] = [];
  for (let k = 1; k < c.rings.length; k++) legs.push(way(c.rings[k - 1], c.rings[k]));
  if (c.prong !== undefined) legs.push(prongWay(c.prong));
  const start = spinePt(c.rings[0]);
  const marks: { t: number; q: Pt }[] = [
    { t: 0, q: start },
    { t: TRACE_IN, q: start },
  ];
  // The greeting rings when the bead has faded fully in (the dot's
  // opacity keyframe in ring()), though the bead still leaves at TRACE_IN.
  const arrive = [Math.round(TRACE_IN * 0.8)];
  let t = TRACE_IN;
  for (const pts of legs) {
    // Time fractions to sample: evenly, plus the exact moment the bead
    // reaches each corner of the leg. Without the corners, linear frames
    // either side of Dan's turn would cut it on the diagonal.
    const fs = Array.from({ length: LEG_SAMPLES }, (_, s) => (s + 1) / LEG_SAMPLES);
    let len = 0;
    const ends: number[] = [];
    for (let j = 1; j < pts.length; j++) {
      len += gap(pts[j - 1], pts[j]);
      ends.push(len);
    }
    for (const d of ends.slice(0, -1)) fs.push(unease(d / len));
    fs.sort((a, b) => a - b);
    const dur = LEG_BASE + LEG_PER_PX * len;
    for (const f of fs) marks.push({ t: t + f * dur, q: along(pts, LEG_EASE(f) * len) });
    t += dur;
    arrive.push(Math.round(t));
  }
  // The last frame's offset is pinned to exactly 1: a rounding error that
  // left it at 0.9994 would let WAAPI add an implicit end frame at the
  // static transform, and a `forwards` fill would park the bead back on
  // the greeting.
  const frames: Keyframe[] = marks.map(({ t: at, q }, j) => ({
    offset: j === marks.length - 1 ? 1 : at / t,
    transform: place(q),
  }));
  return { frames, arrive, total: t };
}

export function Hero({ data }: { data: Data }) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, "-10% 0px");
  const still = usePrefersReducedMotion();

  // The data module is `as const`, so each line is its own literal type
  // and `quote` / `under` exist on only some of them. Widening to the
  // declared row type once lets every renderer below read them plainly.
  const lines: readonly SheetLine[] = data.lines;
  const callers: readonly TraceCaller[] = data.trace.callers;

  const [clock, setClock] = useState<Phase>("idle");
  const [sel, setSel] = useState<number>(data.settleOn);
  const [touched, setTouched] = useState(false);
  // Bumped when the choreography settles: re-keys the caption so it lands
  // with the house ind-swap even though the selection did not change.
  const [lands, setLands] = useState(0);
  const [said, setSaid] = useState("");
  // H1: the line being pointed at or focused. Never a selection.
  const [peek, setPeek] = useState<number | null>(null);
  // H2: the checked caller; the caller whose outcome is showing (it lands
  // when the trace arrives, so the two differ while one is running); and
  // the running trace — how many stops have rung, and (below lg) how many
  // have let go of their tint. `wide` is which composition is showing.
  const [caller, setCaller] = useState<number | null>(null);
  const [shown, setShown] = useState<number | null>(null);
  const [run, setRun] = useState<{ c: number; wide: boolean; rung: number; fade: number } | null>(null);

  // Reduced motion is a derived phase, not a scheduled one: there is no
  // frame at "idle" to flash through and no setState in an effect.
  const phase: Phase = still ? "settled" : clock;

  // `started` is a ref, not state: the three steps are one chain, and an
  // effect that depended on the phase would cancel the steps not yet run.
  const started = useRef(false);
  const timers = useRef<number[]>([]);
  const captionRef = useRef<HTMLDivElement>(null);
  // The running trace's beats and its WAAPI animations, so a new pick (of
  // a caller or a line) can stop it cleanly wherever it is.
  const beats = useRef<number[]>([]);
  const anims = useRef<Animation[]>([]);
  // Below lg a caller pick can glide the page up under the finger. A tap
  // that arrives while it glides lands on whatever slid under the finger —
  // a sheet row, never the chip the reader was aiming at — so line picks
  // are ignored until the lift has landed. Caller picks are not: the chips
  // move away from the finger, and the keyboard's arrows must never be
  // refused (onKey focuses the chip it asked to check).
  const liftUntil = useRef(0);

  // Cancel only on unmount. A cleanup on every `inView` change would kill
  // the chain for a reader who scrolled away inside three seconds, and
  // `started` would then refuse to restart it — the figure would stop
  // half-drawn for the life of the page.
  useEffect(
    () => () => {
      timers.current.forEach(window.clearTimeout);
      beats.current.forEach(window.clearTimeout);
      anims.current.forEach((a) => a.cancel());
    },
    [],
  );

  useEffect(() => {
    if (still || !inView || started.current) return;
    started.current = true;
    timers.current = [
      window.setTimeout(() => setClock("reading"), READ_AT),
      window.setTimeout(() => setClock("drawn"), DRAW_AT),
      window.setTimeout(() => {
        setClock("settled");
        setLands((n) => n + 1);
      }, SETTLE_AT),
    ];
  }, [inView, still]);

  /** Any pick: the choreography jumps to settled and stops for good. */
  function take() {
    started.current = true;
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    setClock("settled");
    setTouched(true);
  }

  /** Stop a trace wherever it is. The bead and rings are WAAPI over a
   *  static opacity 0, so cancelling them leaves nothing on screen. */
  function halt() {
    beats.current.forEach(window.clearTimeout);
    beats.current = [];
    anims.current.forEach((a) => a.cancel());
    anims.current = [];
  }

  function pick(i: number) {
    if (performance.now() < liftUntil.current) return;
    take();
    halt();
    // A caller stays linked only while the picked line is where its call
    // ends. Any other line unchecks it and the outcome Stack goes back to
    // its reserved no-break-space variant, so nothing moves — and no
    // caller is left checked beside a line its call never reached. Picked
    // mid-trace on the caller's own end line, the trace stops and its
    // outcome lands now rather than never: it is still what that caller gets.
    const c = run ? run.c : caller;
    if (c !== null && lines[i].id !== callers[c].ends) {
      setCaller(null);
      setShown(null);
    } else if (run) setShown(run.c);
    setRun(null);
    setSel(i);
    // Announced on a pick only — never during the autoplay, which would
    // talk over the heading a screen reader is still reading.
    setSaid(`${fill(data.became, { n: lines[i].n })}: ${lines[i].became}`);
    markProved("sheet");
    // Below lg the caption sits under all eight rows — most of a screen
    // down on a phone, always out of view on a landscape one — so a pick
    // would change words the reader can't see. Bring it up, but only when
    // it is cut off by the fold and only on a pick: the autoplay never
    // scrolls anyone. Not an inline caption in the tapped row: that would
    // collapse the row above and jump the tapped one under the finger.
    // Its height never changes (both Stacks reserve), so this reads the
    // same box before and after the pick.
    const box = captionRef.current;
    if (!box || window.matchMedia("(min-width: 1024px)").matches) return;
    if (box.getBoundingClientRect().bottom <= window.innerHeight) return;
    box.scrollIntoView({ block: "nearest", behavior: still ? "auto" : "smooth" });
  }

  /**
   * Ring sample caller `c` through the sheet. Everything a reader is told
   * happens now, on the pick: `sel` moves to the line the call ends on
   * (so the caption and the pressed row agree with it at once), the claim
   * is proved, the outcome is announced. What follows is only the way
   * there, drawn — and under reduced motion there is none: the outcome
   * is simply shown.
   */
  function ring(c: number) {
    const who = callers[c];
    take();
    halt();
    setCaller(c);
    setSel(indexOf(lines, who.ends));
    markProved("sheet");
    // The same words twice would not be re-read, so a repeat pick of the
    // same caller alternates a trailing no-break space (as Wiring's replay).
    const line = `${who.label}: ${who.outcome}`;
    setSaid((s) => (s === line ? `${line} ` : line));
    const root = ref.current;
    if (still || !root) {
      setShown(c);
      setRun(null);
      return;
    }

    const wide = window.matchMedia("(min-width: 1024px)").matches;
    const side = wide ? "L" : "P";
    const stops = wide ? wideStops(who) : [...who.rings];
    let arrive: number[];
    let total: number;
    if (wide) {
      const route = beadRoute(who);
      ({ arrive, total } = route);
      const carrier = root.querySelector<HTMLElement>("[data-caa-bead]");
      const dot = carrier?.firstElementChild;
      const out = total + BEAD_OUT;
      const span = out + BEAD_OUT;
      if (carrier && dot) {
        anims.current.push(
          carrier.animate(route.frames, { duration: total, easing: "linear", fill: "forwards" }),
          dot.animate(
            [
              { opacity: 0 },
              { opacity: 1, offset: (TRACE_IN * 0.8) / span },
              { opacity: 1, offset: out / span },
              { opacity: 0 },
            ],
            { duration: span, fill: "forwards" },
          ),
        );
      }
    } else {
      // On a phone the chips sit above the list, and the reader who taps
      // one is usually looking at the chips with the list under the fold.
      // The test is the row the call ENDS on, not the first to ring: with
      // the chips in view the greeting row often sits just above the fold
      // while Dan, the night message and the booking ring below it, so a
      // first-row test let whole traces play off-screen. When the end row
      // is cut off, scroll by the least that shows it (16px clear of the
      // fold) — which also keeps the greeting on screen whenever the whole
      // run fits — and let the scroll land before the first ring. Only on
      // a pick: the autoplay never scrolls anyone.
      let lead = 0;
      const last = root
        .querySelector(`[data-caa-ring="P:${who.rings[who.rings.length - 1]}"]`)
        ?.closest("button");
      const need = last ? last.getBoundingClientRect().bottom - (window.innerHeight - 16) : 0;
      if (need > 0) {
        window.scrollBy({ top: need, behavior: "smooth" });
        lead = SCROLL_LEAD;
        liftUntil.current = performance.now() + SCROLL_LEAD + 150;
      }
      arrive = stops.map((_, k) => lead + k * P_RING_STAGGER);
      total = arrive[arrive.length - 1];
    }

    // Each stop rings as the call reaches it: a 1.2px ring grows and fades
    // from the node (fill none, so it is the static opacity 0 before and
    // after), and the node keeps the selection's ink ring until the end.
    stops.forEach((id, k) => {
      const el = root.querySelector<HTMLElement>(`[data-caa-ring="${side}:${id}"]`);
      const a = el?.animate(
        [
          { transform: "scale(1)", opacity: 0.7 },
          { transform: "scale(2.6)", opacity: 0 },
        ],
        { duration: RING_MS, delay: arrive[k], easing: "ease-out" },
      );
      if (a) anims.current.push(a);
    });

    setShown(null);
    setRun({ c, wide, rung: 1, fade: 0 });
    const at = (ms: number, f: () => void) => beats.current.push(window.setTimeout(f, ms));
    for (let k = 1; k < stops.length; k++) at(arrive[k], () => setRun((r) => r && { ...r, rung: k + 1 }));
    if (!wide) {
      for (let k = 0; k < stops.length; k++) at(arrive[k] + P_TINT_MS, () => setRun((r) => r && { ...r, fade: k + 1 }));
    }
    at(total, () => setShown(c));
    at(total + (wide ? RESOLVE : P_TINT_MS), () => setRun(null));
  }

  function onPeek(i: number, on: boolean) {
    setPeek((p) => (on ? i : p === i ? null : p));
  }

  // What the running trace has reached (and, below lg, is still tinting).
  let trace: Trace = null;
  if (run) {
    const stops = run.wide ? wideStops(callers[run.c]) : callers[run.c].rings;
    trace = { lit: new Set(stops.slice(0, run.rung)), tint: new Set(stops.slice(run.fade, run.rung)) };
  }

  // The prong a finished booking trace answered with. Derived, not stored:
  // it holds while the outcome shows and `sel` is still the line the call
  // ended on, so a pick anywhere else lets go of it with no extra clear.
  const held =
    !run && shown !== null && sel === indexOf(lines, callers[shown].ends) ? (callers[shown].prong ?? null) : null;

  const view: View = {
    data,
    lines,
    sel,
    reading: phase !== "idle",
    drawn: phase === "drawn" || phase === "settled",
    still,
    onPick: pick,
    peek,
    onPeek,
    trace,
    held,
    runProng: run ? (callers[run.c].prong ?? null) : null,
  };
  const caption = { data, lines, sel, lands, swap: touched || lands > 0 };
  const sample = { data, callers, value: caller, shown, onPick: ring };
  const hint = <p className="mt-4 text-[13px] leading-5 text-pp-muted">{data.pickHint}</p>;

  return (
    <section id="top" ref={ref} className="scroll-mt-28">
      <div className="mx-auto w-[calc(100%-2rem)] max-w-[1176px] pt-28 sm:w-[calc(100%-3rem)] md:pt-[148px] lg:w-[calc(100%-5rem)]">
        <Eyebrow>{data.eyebrow}</Eyebrow>
        <p className="mt-6 text-[15px] leading-6 text-pp-muted md:text-base">{data.kicker}</p>
        <SectionTitle as="h1" className="mt-3 max-w-[860px]">
          {data.title}
        </SectionTitle>
        {/* The LCP. Plain server text, nothing keyed on the clock. */}
        <p className="mt-5 max-w-[600px] text-base leading-6 tracking-[0.01em] text-pp-ink/80 md:text-[17px] md:leading-[26px]">
          {data.sub}
        </p>
        <div className="mt-7 flex flex-wrap gap-x-2 gap-y-6">
          <PillLink href={data.primary.href}>{data.primary.label}</PillLink>
          <PillLink href={data.secondary.href} variant="secondary">
            {data.secondary.label}
          </PillLink>
        </div>
        <p className="mt-3 text-[13px] leading-[18px] text-pp-muted">{data.note}</p>

        {/* The hint sits right under the thing you pick, and the caption
            comes after it. The caption's Stacks reserve the tallest line, so
            under a short line there is always slack; with the caption last,
            that slack falls beside the sheet (lg) or at the section's foot
            (below lg) and reads as spacing — not as a hole between the
            caption and an instruction stranded under it. At lg the caption
            moves into the flow's column, which was otherwise empty under
            the 340px drawing. Two copies, one displayed: the other is
            display:none, so it takes no layout and is out of the a11y tree,
            and the sr-only live region below stays the only announcement. */}
        <div className="mt-12 md:mt-16">
          <Landscape
            {...view}
            className="hidden lg:grid"
            hint={hint}
            caption={<Caption {...caption} className="mt-6" />}
            sample={<Callers {...sample} className="mt-6 border-t border-pp-rule pt-5" />}
          />
          {/* Below lg the callers come BEFORE the list, so the rows a trace
              rings are on screen under the reader's thumb when they tap. */}
          <div className="lg:hidden">
            <Callers {...sample} className="mb-8" />
            <Portrait {...view} />
            {hint}
          </div>
        </div>

        <Caption {...caption} ref={captionRef} className="mt-8 max-w-[680px] scroll-mt-28 lg:hidden" />
        <p className="sr-only" aria-live="polite">
          {said}
        </p>
      </div>
    </section>
  );
}

type View = {
  data: Data;
  lines: readonly SheetLine[];
  sel: number;
  reading: boolean;
  drawn: boolean;
  still: boolean;
  onPick: (i: number) => void;
  /** H1: the line pointed at or focused, and how to set / clear it. */
  peek: number | null;
  onPeek: (i: number, on: boolean) => void;
  /** H2: the stops a running trace has rung (and, below lg, still tints). */
  trace: Trace;
  /** H2: the prong a finished booking trace answered with, while it holds. */
  held: number | null;
  /** H2: the prong the running trace is heading for, if it books. */
  runProng: number | null;
};

type Trace = { lit: ReadonlySet<string>; tint: ReadonlySet<string> } | null;

/** Mouse-only hover handlers for a preview: a touch "hover" would stick
 *  under the finger after the tap that picks. */
function hover(i: number, onPeek: View["onPeek"]) {
  return {
    onPointerEnter: (e: PointerEvent) => {
      if (e.pointerType === "mouse") onPeek(i, true);
    },
    onPointerLeave: (e: PointerEvent) => {
      if (e.pointerType === "mouse") onPeek(i, false);
    },
  };
}

/** Hover plus focus, for the rows that are the keyboard path. */
function preview(i: number, onPeek: View["onPeek"]) {
  return { ...hover(i, onPeek), onFocus: () => onPeek(i, true), onBlur: () => onPeek(i, false) };
}

/** The ring a stop sends out when the trace reaches it: static opacity 0,
 *  centred on its node, animated only by `ring()`. */
function RingOut({ id, size }: { id: string; size: number }) {
  return (
    <span
      aria-hidden
      data-caa-ring={id}
      className="pointer-events-none absolute top-1/2 left-1/2 block rounded-full border-[1.2px] border-black opacity-0"
      style={{ width: size, height: size, margin: -size / 2 }}
    />
  );
}

function indexOf(lines: readonly SheetLine[], id: LineId) {
  return lines.findIndex((l) => l.id === id);
}

/** A stroke's inline transition, or none at all under reduced motion. */
function stroke(still: boolean, property: string, ms: number, delay: number): CSSProperties | undefined {
  return still ? { transition: "none" } : { transition: `${property} ${ms}ms ${EASE} ${delay}ms` };
}

/** Delay for a node's fill. Node puts its colour transition on its inner
 *  core, so the delay rides in on a custom property the core reads. */
function fillDelay(still: boolean, ms: number): CSSProperties {
  return { "--caa-d": still ? "0ms" : `${ms}ms` } as CSSProperties;
}
const CORE_DELAY = "[&>span]:[transition-delay:var(--caa-d)]";

/* ------------------------------------------------------------------ *
 * Landscape (lg and up): the sheet, and the flow it became.
 * ------------------------------------------------------------------ */

function Landscape({
  className,
  hint,
  caption,
  sample,
  ...v
}: View & { className?: string; hint: ReactNode; caption: ReactNode; sample: ReactNode }) {
  // Column 1: the sheet and, under it, the hint for the rows you pick.
  // Column 2: the flow, the sample callers straight under it, and then
  // what the picked line became. The callers sit between the drawing and
  // the caption — not after the caption, where the addendum first put
  // them — because a trace is only worth watching if the flow is on screen
  // when you ring it: under the caption the chips were ~650px below the
  // flow's top, so on a 768–900px screen the click scrolled the drawing
  // away; here they are ~420px below it and the pair fits from ~600px up.
  return (
    <div className={cn("grid-cols-[340px_minmax(0,1fr)] items-start gap-10", className)}>
      <div className="min-w-0">
        <Sheet {...v} />
        {hint}
      </div>
      <div className="min-w-0">
        <Flow {...v} />
        {sample}
        {caption}
      </div>
    </div>
  );
}

function Sheet({ data, lines, sel, reading, still, onPick, peek, onPeek }: View) {
  return (
    <div className="rounded-2xl bg-pp-card p-5">
      {/* The firm tag drops under the title rather than squeezing it: 300px
          is not wide enough for both on one line, and the tag must stay
          whole — it is what says none of this is a real client. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-pp-hair pb-3">
        <p className="text-[13px] leading-5 font-medium text-pp-ink">{data.sheet.title}</p>
        <MadeUp>{data.sheet.firm}</MadeUp>
      </div>
      <div role="group" aria-label={data.groupLabel} className="mt-2 space-y-0.5">
        {lines.map((line, i) => {
          const on = sel === i;
          // Previewed from the flow (or from itself): half the selected
          // card, with no edge — "this one", not yet "picked".
          const pv = peek === i && !on;
          return (
            <button
              key={line.id}
              type="button"
              aria-pressed={on}
              onClick={() => onPick(i)}
              {...preview(i, onPeek)}
              className={cn(
                "caa-calm relative flex min-h-11 w-full items-start gap-3 rounded-lg px-2 py-2 text-left text-[15px] leading-[22px]",
                "transition-[background-color,box-shadow,color] duration-200",
                FOCUS,
                on
                  ? "bg-white text-pp-ink shadow-[0_0_0_1px_rgb(24_16_40/0.06)]"
                  : pv
                    ? "bg-white/60 text-pp-ink"
                    : "text-pp-ink/75 hover:text-pp-ink",
              )}
            >
              {/* The margin tick: the product's pen down the side of the
                  sheet, one line at a time. Opacity only, so it moves nothing. */}
              <span
                aria-hidden
                className={cn(
                  "absolute top-2 bottom-2 left-0 w-[1.6px] bg-[#551a89]",
                  reading ? "opacity-100" : "opacity-0",
                )}
                style={stroke(still, "opacity", 300, i * TICK_STAGGER)}
              />
              {/* leading-6 matches the handwriting's 24px line, so the number
                  sits on the first written line rather than above it. */}
              <span className="w-4 shrink-0 text-[11px] leading-6 text-pp-muted tabular-nums">{line.n}</span>
              <span className="font-[family-name:var(--font-pp-cinema)] text-[17px] leading-[24px] italic">
                {line.written}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Flow({ data, lines, sel, drawn, still, onPick, peek, onPeek, trace, held }: View) {
  const price = indexOf(lines, "price");
  const dan = indexOf(lines, "dan");
  const night = indexOf(lines, "night");
  const book = indexOf(lines, "book");
  // While a sample caller is traced, the ink rings follow the call (each
  // stop keeps one once reached) instead of the selection, and the rule
  // is inked the whole way: it holds on every call, so it holds on this one.
  const lit = (i: number) => (trace ? trace.lit.has(lines[i].id) : sel === i);
  const ruleOn = trace ? true : sel === price;
  // A preview shows only where the selection does not: black stays the
  // selection's, so a preview ring is muted.
  const pv = (i: number) => peek === i && !lit(i);
  const node = (on: boolean, p = false) =>
    cn(
      CORE_DELAY,
      "caa-calm transition-shadow duration-200",
      on ? "shadow-[0_0_0_1.6px_#000]" : p && "shadow-[0_0_0_1.6px_var(--pp-muted)]",
    );
  const label = (on: boolean, p = false) =>
    cn(
      "caa-calm text-[13px] leading-[18px] transition-colors duration-200",
      on || p ? "text-pp-ink" : "text-pp-muted hover:text-pp-ink",
    );

  return (
    // aria-hidden: the drawing duplicates the sheet rows (the keyboard and
    // screen-reader path) and the caption says in words what it draws.
    // Its controls are tabIndex -1, so nothing hidden can take focus.
    <div aria-hidden className="relative h-[340px]">
      <p className="absolute top-0 left-0 text-[11px] leading-4 tracking-[0.1em] text-pp-muted uppercase">
        {data.flowTitle}
      </p>
      {/* The key. nowrap: a wrapped legend would drop onto the rule's label. */}
      <div className="absolute top-0 right-0 flex gap-x-4 text-[11px] leading-4 tracking-[0.1em] whitespace-nowrap text-pp-muted uppercase">
        <span className="inline-flex items-center gap-1.5">
          <Node state="ink" size="sm" />
          {data.legend.step}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <RuleGlyph />
          {data.legend.rule}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <HandoffGlyph />
          {data.legend.handoff}
        </span>
      </div>

      {/* The rule it keeps all call: a dimension line across the whole
          flow. Its label and a 38px band over the line are one target:
          38, not 44, so the band (top 36–74) stops where Dan's 44px node
          and label targets begin, and one tap can't land on both. It is
          still the full width of the flow, so it is no harder to hit.
          flex + justify-start because a button centres its content
          vertically, which would drop the label onto its own line (the
          step labels below are pinned to their tops the same way). */}
      <button
        type="button"
        tabIndex={-1}
        onClick={() => onPick(price)}
        {...hover(price, onPeek)}
        className="group absolute right-[3%] left-[3%] flex h-[38px] flex-col justify-start text-left"
        style={{ top: RULE_Y - 22 }}
      >
        {/* A preview inks the label only: the line's colour is kept for
            the selection, as the nodes keep black for it. */}
        <span
          className={cn(
            "caa-calm block text-[11px] leading-4 tracking-[0.1em] uppercase transition-colors duration-200",
            ruleOn || pv(price) ? "text-pp-ink" : "text-pp-muted group-hover:text-pp-ink",
          )}
        >
          {data.railLabel}
        </span>
        <span
          className="caa-draw-x absolute inset-x-0 top-[21.2px] h-[1.6px]"
          style={{ transform: `scaleX(${drawn ? 1 : 0})` }}
        >
          <span className={cn("block h-full transition-colors duration-200", ruleOn ? "bg-black" : "bg-pp-muted")} />
        </span>
        {/* End ticks, 1.6×10, centred on the ends: the left one with the
            first of the stroke, the right one as the stroke arrives. */}
        {[0, 1].map((end) => (
          <span
            key={end}
            className={cn(
              "absolute top-[17px] h-[10px] w-[1.6px]",
              end === 0 ? "left-[-0.8px]" : "right-[-0.8px]",
              ruleOn ? "bg-black" : "bg-pp-muted",
              drawn ? "opacity-100" : "opacity-0",
            )}
            // The colour eases with the line's own 200ms (Tailwind's default
            // curve), so the ticks never go black on a line still grey. Set
            // inline beside the draw-on's opacity: an inline transition would
            // override a class one anyway.
            style={
              still
                ? { transition: "none" }
                : {
                    transition: `opacity 240ms ${EASE} ${end === 0 ? 0 : 900}ms, background-color 200ms cubic-bezier(0.4, 0, 0.2, 1) 0ms`,
                  }
            }
          />
        ))}
      </button>

      {/* The spine. Transform only, set inline: Tailwind v4's scale-*
          utilities write the `scale` property, which caa-draw-x (a
          `transform` transition) would not animate. */}
      <span
        className="caa-draw-x absolute left-[4%] h-[1.6px] w-[60%] bg-black"
        style={{ top: SPINE_Y - 0.8, transform: `scaleX(${drawn ? 1 : 0})` }}
      />

      {/* Dan leaves the call upward from the sort node… */}
      <span
        className="caa-draw-y-up absolute left-[44%] ml-[-0.8px] w-[1.6px] bg-black"
        style={{
          top: DAN_Y,
          height: SPINE_Y - DAN_Y,
          transform: `scaleY(${drawn ? 1 : 0})`,
          transitionDelay: still ? undefined : "360ms",
        }}
      />
      {/* …and the night message downward from the greeting. */}
      <span
        className="caa-draw-y absolute left-[4%] ml-[-0.8px] w-[1.6px] bg-black"
        style={{
          top: SPINE_Y,
          height: NIGHT_Y - SPINE_Y,
          transform: `scaleY(${drawn ? 1 : 0})`,
          transitionDelay: still ? undefined : "120ms",
        }}
      />

      {/* The book fork: fixed 1:1, so the strokes are exactly 1.6px. Both
          prongs leave the node level with the spine before bending, so the
          lower one clears "Books"' neighbours and reads as a fork, not a V. */}
      <svg
        width={FORK.w}
        height={FORK.h}
        viewBox={`0 0 ${FORK.w} ${FORK.h}`}
        fill="none"
        className="absolute left-[64%] block overflow-visible"
        style={{ top: FORK.top }}
        aria-hidden
      >
        {[prongPath(0), prongPath(1)].map((d, k) => (
          <path
            key={d}
            d={d}
            stroke="#000"
            strokeWidth="1.6"
            pathLength={1}
            strokeDasharray="1"
            strokeDashoffset={drawn ? 0 : 1}
            style={stroke(still, "stroke-dashoffset", 760, PRONG_AT + k * PRONG_STAGGER)}
          />
        ))}
      </svg>

      {/* Nodes on the spine, each a 44px target centred on its dot. */}
      {SPINE.map(({ id, x }, k) => {
        const i = indexOf(lines, id);
        return (
          <button
            key={id}
            type="button"
            tabIndex={-1}
            onClick={() => onPick(i)}
            {...hover(i, onPeek)}
            className="absolute ml-[-22px] mt-[-22px] grid size-11 place-items-center rounded-full"
            style={{ left: `${x}%`, top: SPINE_Y, ...fillDelay(still, k * NODE_STAGGER) }}
          >
            <Node state={drawn ? "ink" : "hollow"} className={node(lit(i), pv(i))} />
            <RingOut id={`L:${id}`} size={19} />
          </button>
        );
      })}

      {/* Step labels hang under-right of their node, clear of the night
          branch that drops from the greeting. max-w 18% of a 20% pitch
          leaves every pair at least 2% (11px at 564px) apart. */}
      {SPINE.filter((s) => s.id !== "book").map(({ id, x }) => {
        const i = indexOf(lines, id);
        return (
          <button
            key={id}
            type="button"
            tabIndex={-1}
            onClick={() => onPick(i)}
            {...hover(i, onPeek)}
            className={cn("absolute flex min-h-11 max-w-[18%] flex-col justify-start text-left", label(lit(i), pv(i)))}
            style={{ left: `calc(${x}% + 14px)`, top: SPINE_Y + 24 }}
          >
            <span className="block">{lines[i].node}</span>
          </button>
        );
      })}
      {/* "Books" sits on the stem just before the fork: below and above the
          node is where the prongs run. Right edge 24px short of the node's
          centre, so its 44px target never meets the node's. */}
      <button
        type="button"
        tabIndex={-1}
        onClick={() => onPick(book)}
        {...hover(book, onPeek)}
        className={cn("absolute flex h-11 items-end text-right", label(lit(book), pv(book)))}
        style={{ right: "calc(36% + 24px)", top: SPINE_Y - 52 }}
      >
        <span className="block pb-[2px] whitespace-nowrap">{lines[book].node}</span>
      </button>

      {/* The two hand-offs, each a node at the end of its branch. */}
      {[
        { i: dan, x: 44, y: DAN_Y, d: 360 + 600 },
        { i: night, x: 4, y: NIGHT_Y, d: 120 + 600 },
      ].map(({ i, x, y, d }) => (
        <div key={lines[i].id}>
          <button
            type="button"
            tabIndex={-1}
            onClick={() => onPick(i)}
            {...hover(i, onPeek)}
            className="absolute ml-[-22px] mt-[-22px] grid size-11 place-items-center rounded-full"
            style={{ left: `${x}%`, top: y, ...fillDelay(still, d) }}
          >
            <Node state={drawn ? "ink" : "hollow"} className={node(lit(i), pv(i))} />
            <RingOut id={`L:${lines[i].id}`} size={19} />
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={() => onPick(i)}
            {...hover(i, onPeek)}
            className={cn("absolute mt-[-22px] flex h-11 items-center whitespace-nowrap", label(lit(i), pv(i)))}
            style={{ left: `calc(${x}% + 24px)`, top: y }}
          >
            {lines[i].node}
          </button>
        </div>
      ))}

      {/* The prong ends: small nodes (outcomes of one step, not steps). */}
      {/* A trace that books rings one prong only — the one its caller
          gets — so the two outcomes of the one step read apart. And the
          answer stays drawn until the next pick: once the trace resolves,
          `held` keeps that prong ringed and inked, and only the other
          label goes back to muted — "plan" and "no plan" never end on the
          same picture. */}
      {data.prongs.map((text, k) => {
        const end = trace ? trace.lit.has(`prong${k}`) : held === k;
        return (
          <div key={text}>
            <span
              className="absolute mt-[-6.5px] ml-[-6.5px] block"
              style={{ left: `calc(64% + ${FORK.w}px)`, top: PRONG_Y[k], ...fillDelay(still, PRONG_AT + 700 + k * PRONG_STAGGER) }}
            >
              <Node state={drawn ? "ink" : "hollow"} size="sm" className={node(end)} />
              <RingOut id={`L:prong${k}`} size={13} />
            </span>
            <button
              type="button"
              tabIndex={-1}
              onClick={() => onPick(book)}
              {...hover(book, onPeek)}
              className={cn(
                "absolute mt-[-22px] flex h-11 items-center whitespace-nowrap",
                label(trace ? end : held !== null ? held === k : sel === book, pv(book)),
              )}
              style={{ left: `calc(64% + ${FORK.w + 6.5 + 14}px)`, top: PRONG_Y[k] }}
            >
              {text}
            </button>
          </div>
        );
      })}

      {/* H2's bead. One carrier the size of this box, moved by
          translate(calc(x% + px), ypx) — a % translate is of the carrier's
          own width, which is the box's — with the bead at its top-left.
          overflow-clip keeps the translated carrier out of the page's
          scrollable width; the bead itself never leaves the box. */}
      <span aria-hidden className="pointer-events-none absolute inset-0 overflow-clip">
        <span data-caa-bead className="absolute inset-0 block" style={{ transform: place(spinePt("greet")) }}>
          <span className="absolute top-0 left-0 block size-[9px] -translate-1/2 rounded-full bg-black opacity-0 shadow-[0_0_0_2px_var(--pp-bg)]" />
        </span>
      </span>
    </div>
  );
}

/** Legend glyph for the rule: a 16px dimension line with 5px end ticks. */
function RuleGlyph() {
  return (
    <span aria-hidden className="relative inline-block h-[13px] w-4 shrink-0">
      <span className="absolute inset-x-0 top-[5.7px] h-[1.6px] bg-pp-muted" />
      <span className="absolute top-[4px] left-0 h-[5px] w-[1.6px] bg-pp-muted" />
      <span className="absolute top-[4px] right-0 h-[5px] w-[1.6px] bg-pp-muted" />
    </span>
  );
}

/** Legend glyph for a hand-off: a short stub leaving the line, and its node. */
function HandoffGlyph() {
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center">
      <span className="h-[1.6px] w-[7px] bg-black" />
      <Node state="ink" size="sm" className="-ml-[3px]" />
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Portrait (below lg): one list down a left gutter.
 *
 * Two verticals in the gutter: the rule at x=6 (muted, the length of the
 * whole list — it holds all call) and the spine at x=26 (black, the call
 * itself). Row 0 is the rule, so the thing that holds throughout is read
 * first; then the steps in the order a call meets them, then the two
 * hand-offs, whose nodes sit off the spine on a short ink stub.
 *
 * Both verticals are drawn per row, inside each row's button, rather than
 * as one line behind the list: the rows are positioned (for their own
 * nodes) and a selected row's card background would otherwise paint over
 * a line underneath it. Per-row segments also mean the list's height is
 * whatever its text makes it — nothing here is measured.
 *
 * The gutter is 56px, not the 48 first drawn: a hand-off node has to sit
 * far enough off the spine for its stub to read as a stub (10px) rather
 * than as a smudge on the node's edge.
 * ------------------------------------------------------------------ */

/** x of the rule and of the spine in the gutter; y of a row's node. */
const P_RULE = 6;
const P_SPINE = 26;
const P_HAND = 46;
const P_ROW_Y = 20;

function Portrait({
  data,
  lines,
  sel,
  drawn,
  still,
  onPick,
  peek,
  onPeek,
  trace,
  held,
  runProng,
  className,
}: View & { className?: string }) {
  const price = indexOf(lines, "price");
  const order = [price, ...data.portraitOrder.map((id) => indexOf(lines, id))];
  const last = order.length - 1;
  // The rule holds on every call, so a traced call inks it too.
  const ruleOn = trace ? true : sel === price;
  // "Line 3" is the caption's own "Line {n} became" without its verb, so
  // the two can never drift apart in wording.
  const lineLabel = (n: number) => fill(data.became, { n }).replace(/\s+became$/, "");

  return (
    <div role="group" aria-label={data.groupLabel} className={cn("max-w-[680px]", className)}>
      {order.map((i, r) => {
        const line = lines[i];
        const isRule = r === 0;
        const handoff = line.kind === "handoff";
        // A trace moves `sel` on the pick, but the row it ends on only
        // *shows* selected once the call reaches it; until then the rows
        // it passes through are tinted in turn. aria-pressed is the truth
        // throughout.
        const on = sel === i && (!trace || trace.lit.has(line.id));
        const tint = !on && ((peek === i && sel !== i) || (trace?.tint.has(line.id) ?? false));
        // The node's knock-out disc takes the row's colour, so a tinted
        // row never shows a white coin around its node.
        const knock = on ? "bg-pp-card" : tint ? "bg-[color-mix(in_srgb,var(--pp-card)_50%,var(--pp-bg))]" : undefined;
        return (
          <button
            key={line.id}
            type="button"
            aria-pressed={sel === i}
            onClick={() => onPick(i)}
            {...preview(i, onPeek)}
            className={cn(
              "caa-calm relative grid min-h-11 w-full grid-cols-[56px_minmax(0,1fr)] gap-x-2 rounded-xl py-3 pr-3 text-left transition-colors duration-200",
              FOCUS,
              on ? "bg-pp-card" : tint && "bg-pp-card/50",
            )}
          >
            {/* The rule's segment of the gutter, from row 0's tick to just
                above the last row's bottom, where the lower tick closes it. */}
            <span
              aria-hidden
              className="caa-draw-y absolute ml-[-0.8px] w-[1.6px]"
              style={{
                left: P_RULE,
                top: isRule ? P_ROW_Y : 0,
                bottom: r === last ? 12 : 0,
                transform: `scaleY(${drawn ? 1 : 0})`,
                transitionDelay: still ? undefined : `${r * 90}ms`,
              }}
            >
              <span className={cn("block h-full transition-colors duration-200", ruleOn ? "bg-black" : "bg-pp-muted")} />
            </span>
            {(isRule || r === last) && (
              <span
                aria-hidden
                className={cn(
                  "caa-calm absolute h-[1.6px] w-[10px] transition-colors duration-200",
                  ruleOn ? "bg-black" : "bg-pp-muted",
                )}
                style={isRule ? { left: P_RULE - 5, top: P_ROW_Y - 0.8 } : { left: P_RULE - 5, bottom: 11.2 }}
              />
            )}

            {/* The spine's segment: from the greeting's node down to the
                last hand-off's stub. */}
            {!isRule && (
              <span
                aria-hidden
                className="caa-draw-y absolute ml-[-0.8px] w-[1.6px] bg-black"
                style={{
                  left: P_SPINE,
                  top: r === 1 ? P_ROW_Y : 0,
                  ...(r === last ? { height: P_ROW_Y } : { bottom: 0 }),
                  transform: `scaleY(${drawn ? 1 : 0})`,
                  transitionDelay: still ? undefined : `${(r - 1) * 110}ms`,
                }}
              />
            )}
            {handoff && (
              <span
                aria-hidden
                className="caa-draw-x absolute h-[1.6px] bg-black"
                style={{
                  left: P_SPINE,
                  width: P_HAND - P_SPINE - 9.5,
                  top: P_ROW_Y - 0.8,
                  transform: `scaleX(${drawn ? 1 : 0})`,
                  transitionDelay: still ? undefined : `${r * 110 + 300}ms`,
                }}
              />
            )}
            {!isRule && (
              <span
                aria-hidden
                className="absolute mt-[-9.5px] ml-[-9.5px] block"
                style={{ left: handoff ? P_HAND : P_SPINE, top: P_ROW_Y, ...fillDelay(still, (r - 1) * NODE_STAGGER) }}
              >
                <Node
                  state={drawn ? "ink" : "hollow"}
                  className={cn(CORE_DELAY, "caa-calm transition-[background-color] duration-200", knock)}
                />
                <RingOut id={`P:${line.id}`} size={19} />
              </span>
            )}

            <span className="col-start-2 block min-w-0">
              <span className="block text-[11px] leading-4 text-pp-muted tabular-nums">{lineLabel(line.n)}</span>
              <span className="mt-0.5 block font-[family-name:var(--font-pp-cinema)] text-[15px] leading-[22px] text-pp-muted italic">
                {line.written}
              </span>
              <span className="mt-1 block text-[15px] leading-[22px] text-pp-ink">
                {isRule ? data.railLabel : line.node}
              </span>
              {/* The fork's two outcomes, one span each, so a booking trace
                  can ink the one its caller gets as the call reaches the
                  row, and hold it after: below lg this is the only place
                  "plan" and "no plan" differ. Colour only, same text. */}
              {line.kind === "fork" && (
                <span className="mt-0.5 block text-[13px] leading-5 text-pp-muted">
                  {data.prongs.map((p, k) => (
                    <Fragment key={p}>
                      {k ? " / " : ""}
                      <span
                        className={cn(
                          "caa-calm transition-colors duration-200",
                          (held === k || (runProng === k && trace?.lit.has("book"))) && "text-pp-ink",
                        )}
                      >
                        {p}
                      </span>
                    </Fragment>
                  ))}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * H2's control: four sample callers, and what the sheet does with each.
 *
 * A radiogroup with a roving tab stop (the checked chip, or the first
 * while none is): one Tab in, arrows move and ring, as Wiring's radios.
 * Rendered twice — beside the flow at lg, above the list below it — and
 * only one is ever displayed, so the other is display:none: no layout,
 * no tab stops, not in the accessibility tree.
 *
 * The outcome is a reservation Stack of the four outcomes plus an empty
 * line (a no-break space, so the empty state has a line box), so the
 * block is its final height in the server HTML and a trace landing moves
 * nothing. It is not announced from here: the hero's one polite region
 * speaks it, on a pick only.
 * ------------------------------------------------------------------ */

// transition-[color], not -colors: a checked state snaps. Cross-fading
// the background with the text passes through grey-on-grey, and the label
// vanishes for a frame right under the finger; only hover's text eases.
const CHIP =
  "caa-calm min-h-11 shrink-0 rounded-full px-4 text-[14px] leading-none whitespace-nowrap transition-[color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink";

function Callers({
  data,
  callers,
  value,
  shown,
  onPick,
  className,
}: {
  data: Data;
  callers: readonly TraceCaller[];
  value: number | null;
  shown: number | null;
  onPick: (c: number) => void;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const stop = value ?? 0;
  function onKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const last = callers.length - 1;
    const to =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? i === last ? 0 : i + 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? i === 0 ? last : i - 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : -1;
    if (to < 0) return;
    e.preventDefault();
    onPick(to);
    refs.current[to]?.focus();
  }
  const outcomes = [" ", ...callers.map((c) => c.outcome)];
  return (
    <div className={className}>
      {/* The note comes before the chips, not after the outcome: it is the
          condition the trace is read under, and with the outcome last the
          Stack's reserve falls at the block's foot as margin rather than as
          a hole between the chips and a stranded line. */}
      <p className="text-[11px] leading-4 font-medium tracking-[0.12em] text-pp-muted uppercase">{data.trace.label}</p>
      <p className="mt-1 text-[13px] leading-5 text-pp-muted">{data.trace.note}</p>
      <div role="radiogroup" aria-label={data.trace.groupAria} className="mt-3 flex flex-wrap gap-2">
        {callers.map((c, i) => (
          <button
            key={c.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={i === value}
            tabIndex={i === stop ? 0 : -1}
            onClick={() => onPick(i)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(CHIP, i === value ? "bg-pp-ink text-white" : "bg-pp-card text-pp-muted hover:text-pp-ink")}
          >
            {c.label}
          </button>
        ))}
      </div>
      <Stack
        items={outcomes}
        live={shown === null ? 0 : shown + 1}
        className="mt-4"
        render={(o) => <p className="text-[15px] leading-[23px] text-pretty text-pp-ink">{o}</p>}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * The caption: what the picked line became.
 *
 * Two reservation stacks, not four. The label row (which line, which
 * tools, which gate) is stacked on its own so it never jumps; the text
 * under it — the greeting's quote, the body, the "underneath" strip — is
 * stacked as one block. Stacked as three separate parts, every line but
 * the first would show a blank the height of the greeting between its
 * label and its body; stacked together, the reserved space falls at the
 * bottom, where an empty band reads as margin rather than as something
 * missing. Either way the cell is as tall as its tallest line at this
 * width and nothing below it ever moves.
 * ------------------------------------------------------------------ */

function Caption({
  data,
  lines,
  sel,
  lands,
  swap,
  className,
  ref,
}: {
  data: Data;
  lines: readonly SheetLine[];
  sel: number;
  lands: number;
  swap: boolean;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}) {
  return (
    <div ref={ref} className={cn("border-t border-pp-rule pt-5", className)}>
      <Stack
        key={`head-${lands}`}
        items={lines}
        live={sel}
        swap={swap}
        render={(l) => (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-[11px] leading-4 tracking-[0.1em] text-pp-muted uppercase">
              {fill(data.became, { n: l.n })}
            </span>
            {l.tools.length > 0 ? (
              l.tools.map((t) => <ToolName key={t} tool={t} className="rounded-full bg-pp-card px-2 py-0.5 text-pp-ink" />)
            ) : (
              <span className="text-[13px] leading-5 text-pp-muted">{data.noTools}</span>
            )}
            {l.gate ? <Gate tool={l.gate} /> : null}
          </div>
        )}
      />
      <Stack
        key={`body-${lands}`}
        items={lines}
        live={sel}
        swap={swap}
        className="mt-3"
        render={(l) => (
          <div>
            {l.quote ? (
              <p className="mb-3 font-[family-name:var(--font-pp-cinema)] text-[19px] leading-7 text-pp-ink italic md:text-[21px] md:leading-8">
                &ldquo;{l.quote}&rdquo;
              </p>
            ) : null}
            <p className="text-[15px] leading-[23px] text-pp-ink">{l.became}</p>
            {l.under ? (
              <div className="mt-3 rounded-xl bg-pp-card p-4">
                <p className="text-[11px] leading-4 tracking-[0.1em] text-pp-accent uppercase">{l.under.label}</p>
                <p className="mt-1.5 text-[13px] leading-5 text-pp-muted">{l.under.body}</p>
              </div>
            ) : null}
          </div>
        )}
      />
    </div>
  );
}
