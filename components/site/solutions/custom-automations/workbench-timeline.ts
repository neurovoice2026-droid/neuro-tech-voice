import type { gsap as GsapCore } from "gsap";
import type { RunLens } from "@/lib/pages/custom-automations";
import { holdFor } from "@/components/site/product/timing";
import { buildOrder, currentsOf, handedTo, landingOf, type Phase } from "./workbench-frame";

/* ------------------------------------------------------------------ *
 * #running — the workbench's GSAP timelines, as plain functions: the
 * hand phase, the build, the run, and the retract that takes a seen
 * route back before a tour from the top.
 *
 * GSAP ONLY TRAVELS; REACT HOLDS EVERY FRAME. What the workbench shows —
 * which blocks are laid, which manual step is handed over, which block
 * is current, which lines are lit, what the caption says — is React's,
 * drawn from `frameOf` (workbench-frame.ts) as data attributes that
 * auto-running.css turns into colour and place. These timelines add only
 * what happens between two frames, and only on elements and properties
 * React never writes: a trace's dash (DrawSVG), a bead riding a line or
 * the rail (MotionPath, `y`), a chip or a disc in flight, a ring's ping,
 * a card's settle as it is laid, the hand glyph's nod. Each arrival is a
 * callback — `onPhase`, `onBuilt`, `onStep` — and React draws it. When
 * the workbench's context is reverted (a lens or a step picked by hand,
 * the window crossing xl, reduced motion switched on) every inline style
 * goes, the discs in flight are cleared from their layer, and what is
 * left is React's frame, exactly.
 *
 * THE TOUR, in four parts (`buildTour` lays them end to end):
 *   0. retract (only when the finished frame is in sight, where the
 *      reader may have seen it): the lit traces draw themselves back
 *      toward their ends, 0.3s, then the frame goes back to by hand and
 *      the blocks fade to ghosts in CSS — taken back, never snapped;
 *   1. hand (xl ≈ 2.6s, below ≈ 1.4s): the hand glyph nods once; at xl
 *      each copy chip appears on its source window's title bar and rides
 *      an arc to its target's (0.9s, 0.45s apart), where the row it lands
 *      on flashes and the chip fades. Below xl there are no windows: the
 *      hollow "was" chips are the steps done by hand, and their hands nod
 *      one after another down the list.
 *   2. build (xl ≈ 2.2s + 0.6s held; below ≈ 1.2s): the blocks are laid
 *      in path order, one beat apart (0.14s at xl, 0.09s below). At xl a
 *      block that replaced manual steps waits for their discs: a copy of
 *      each disc flies an arc from its row in the lane to its badge on
 *      the card (0.55s), and the block is laid as they land — the lane's
 *      disc turns electric and says "now step 06", the badge fills, and
 *      the card settles from 94%. Below xl each row is laid on its beat.
 *      The lines show as both their ends are laid (CSS).
 *   3. run: for each step, the bead rides each hop's trace while the
 *      trace draws (0.4–0.8s by length; the morning's last step fans in
 *      along two lines with two beads at once), the block it reaches
 *      pings, and the step arrives — `onStep(i)`, and React makes the
 *      block current; the Running pill is flown to it by the workbench
 *      (Flip). A ring-only step pings its block twice. Below xl the bead
 *      slides down the rail to the current row's ring instead (0.45s).
 *      Each step holds for as long as its caption takes to read
 *      (`holdFor`); after the last, a 0.8s beat, then the tour is done
 *      and the pill says so. It never loops.
 *
 * MEASURED WHEN IT MOVES. Where a chip, a disc or the list's bead goes
 * is measured by a function-based value, when its tween first renders —
 * not when the timeline is built, which may be while the stage is still
 * a content-visibility box off the screen — and from the layer it moves
 * in, so a scroll in between changes nothing.
 *
 * Client-only functions and no React. The kit that calls them has
 * registered DrawSVGPlugin and MotionPathPlugin (product/motion-kit.ts),
 * and they run inside the workbench's `useKitContext`, so a revert of
 * that context takes back everything they did.
 * ------------------------------------------------------------------ */

type Gsap = typeof GsapCore;
type Timeline = ReturnType<Gsap["timeline"]>;

/** The hand phase's length, chips and all. */
const HAND = { wide: 2.6, narrow: 1.4 } as const;
/** A copy chip: fading in on its source, its flight, the gap between two chips, how high its arc rises. */
const CHIP = { first: 0.35, show: 0.15, fly: 0.9, stagger: 0.45, lift: 36 } as const;
/** The row a chip lands on flashes this long. */
const FLASH = 0.3;
/** One block laid after another, as the flow is built. */
const BEAT = { wide: 0.14, narrow: 0.09 } as const;
/** A disc's flight from the lane to its block, and how high its arc rises above the lane. */
const FLIGHT = { fly: 0.55, lift: 40 } as const;
/** The built flow, held before the run starts. */
const HELD = { wide: 0.6, narrow: 0.3 } as const;
/** A hop on the map: at least, at most, and seconds per user unit of line. */
const HOP = { min: 0.4, max: 0.8, per: 1 / 320 } as const;
/** The list's bead sliding from ring to ring. */
const SLIDE = 0.45;
/** A ring's ping, and how far it grows: round a card, and round a 12px ring on the rail. */
const PING = { dur: 0.5, map: 1.35, list: 2.4 } as const;
/** A seen route taking itself back, then the frame fading back to by hand (CSS, 0.3s) before the hand phase. */
const RETRACT = 0.3;
const FADE_BACK = 0.45;
/** After the last step, before the tour is done. */
const DONE_BEAT = 0.8;

const viewOf = (root: Element, wide: boolean) => root.querySelector(`[data-view="${wide ? "map" : "list"}"]`);

/** Runs `measure` once, the first time any of its values is asked for. */
function lazy<T>(measure: () => T): () => T {
  let value: T | undefined;
  let done = false;
  return () => {
    if (!done) {
      value = measure();
      done = true;
    }
    return value as T;
  };
}

/**
 * An arc through points measured when its tween first renders: GSAP calls
 * a function-based plugin value then (gsap-core's `_processVars`), though
 * its types only admit one for a number or a string.
 */
function arc(points: () => { x: number; y: number }[]): MotionPath.Vars {
  return (() => ({ path: points(), curviness: 1.25 })) as unknown as MotionPath.Vars;
}

/** An element's top-left and centre within a layer, in px. */
function within(layer: Element, el: Element) {
  const l = layer.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return { x: r.left - l.left, y: r.top - l.top, cx: r.left - l.left + r.width / 2, cy: r.top - l.top + r.height / 2 };
}

/** A ring pings round the block the run reaches. */
function ping(tl: Timeline, view: Element, id: string, wide: boolean, at: number) {
  const ring = view.querySelector(`[data-auto-ring="${id}"]`);
  if (!ring) return;
  // An SVG rect scales from its own top left unless told otherwise.
  tl.fromTo(
    ring,
    { opacity: 0.9, scale: 1, transformOrigin: "50% 50%" },
    { opacity: 0, scale: wide ? PING.map : PING.list, duration: PING.dur, ease: "power2.out", immediateRender: false },
    at,
  );
}

/**
 * The hand phase: the steps a person does, before anything is built. The
 * hand glyph nods; at xl the copy chips ride from window to window. The
 * frame is React's (phase "hand"): every block a ghost, no line drawn.
 */
export function buildHand(gsap: Gsap, root: Element, o: { lens: RunLens; wide: boolean }): Timeline {
  const tl = gsap.timeline();
  const view = viewOf(root, o.wide);
  tl.to({}, { duration: o.wide ? HAND.wide : HAND.narrow }, 0);
  if (!view) return tl;

  const hand = view.querySelector("[data-auto-hand]");
  if (hand) tl.to(hand, { keyframes: { scale: [1, 1.25, 1], easeEach: "power1.inOut" }, duration: 0.5 }, 0.1);

  // Below xl the list's "was" chips are the steps done by hand: their hands nod
  // one after another, top to bottom, as a person works down the list.
  if (!o.wide) {
    const hands = [...view.querySelectorAll(".auto-was-hand")];
    const gap = hands.length > 1 ? Math.min(0.12, 0.8 / (hands.length - 1)) : 0;
    hands.forEach((el, i) => {
      tl.to(el, { keyframes: { scale: [1, 1.3, 1], easeEach: "power1.inOut" }, duration: 0.4 }, 0.3 + i * gap);
    });
    return tl;
  }
  const layer = view.querySelector("[data-auto-chips]");
  if (!layer) return tl;
  o.lens.copies.forEach((c, i) => {
    const chip = layer.querySelector<HTMLElement>(`[data-auto-chip="${i}"]`);
    const from = view.querySelector(`[data-auto-window="${c.from}"] [data-auto-bar]`);
    const to = view.querySelector(`[data-auto-window="${c.to}"] [data-auto-bar]`);
    if (!chip || !from || !to) return;
    const landing = landingOf(o.lens, c);
    const flash = landing ? view.querySelector(`[data-auto-manual="${landing}"] .auto-flash`) : null;
    // From the middle of the source's title bar to the middle of the target's, over an arc.
    const path = lazy(() => {
      const a = within(layer, from);
      const b = within(layer, to);
      const w = chip.offsetWidth / 2;
      const h = chip.offsetHeight / 2;
      const start = { x: a.cx - w, y: a.cy - h };
      const end = { x: b.cx - w, y: b.cy - h };
      return { start, mid: { x: (start.x + end.x) / 2, y: Math.min(start.y, end.y) - CHIP.lift }, end };
    });
    const at = CHIP.first + i * CHIP.stagger;
    tl.set(chip, { x: () => path().start.x, y: () => path().start.y, opacity: 0 }, at);
    tl.to(chip, { opacity: 1, duration: CHIP.show, ease: "power1.out" }, at);
    tl.to(
      chip,
      {
        motionPath: arc(() => [path().mid, path().end]),
        duration: CHIP.fly,
        ease: "power1.inOut",
      },
      at + CHIP.show,
    );
    const lands = at + CHIP.show + CHIP.fly;
    if (flash) {
      tl.to(flash, { keyframes: { opacity: [0, 1, 0] }, duration: FLASH, ease: "none" }, lands - 0.05);
    }
    tl.to(chip, { opacity: 0, duration: CHIP.show, ease: "power1.in" }, lands);
  });
  return tl;
}

/**
 * The build: the blocks laid one by one in path order, `onBuilt(id)` as
 * each is. At xl a block that replaced manual steps is laid as their
 * discs land on it, each flown from its row in the lane.
 */
export function buildBuild(
  gsap: Gsap,
  root: Element,
  o: { lens: RunLens; wide: boolean; onBuilt: (id: string) => void },
): Timeline {
  const tl = gsap.timeline();
  const view = viewOf(root, o.wide);
  const beat = o.wide ? BEAT.wide : BEAT.narrow;
  const order = buildOrder(o.lens);
  // The discs each block receives: the manual steps handed to it first.
  const gets = new Map<string, string[]>();
  for (const [m, id] of handedTo(o.lens)) gets.set(id, [...(gets.get(id) ?? []), m]);
  // The layer the discs fly in: over the whole stage, lane and map alike.
  const fly = o.wide ? root.querySelector<HTMLElement>("[data-auto-fly]") : null;

  let end = 0;
  order.forEach((node, k) => {
    const at = k * beat;
    let laid = at;
    const discs = fly && view ? (gets.get(node.id) ?? []) : [];
    discs.forEach((m, j) => {
      const disc = view?.querySelector<HTMLElement>(`[data-auto-manual="${m}"] .auto-disc`);
      const badge = view?.querySelector<HTMLElement>(`[data-auto-badge="${node.id}"] [data-m="${m}"]`);
      if (!disc || !badge || !fly) return;
      // A copy of the disc, as it reads before it's handed over (its number, not the tick).
      const clone = disc.cloneNode(true) as HTMLElement;
      clone.removeAttribute("data-handed");
      clone.classList.add("auto-flight");
      fly.appendChild(clone);
      const path = lazy(() => {
        const a = within(fly, disc);
        const b = within(fly, badge);
        const half = disc.offsetWidth / 2;
        const start = { x: a.x, y: a.y };
        const finish = { x: b.cx - half, y: b.cy - half };
        return { start, mid: { x: (start.x + finish.x) / 2, y: Math.min(start.y, finish.y) - FLIGHT.lift }, finish };
      });
      const t = at + j * 0.06;
      tl.set(clone, { x: () => path().start.x, y: () => path().start.y, scale: 1, opacity: 1 }, t);
      tl.to(
        clone,
        {
          motionPath: arc(() => [path().mid, path().finish]),
          // The badge is 16px to the disc's 20.
          scale: 0.8,
          duration: FLIGHT.fly,
          ease: "power2.inOut",
        },
        t,
      );
      tl.set(clone, { opacity: 0 }, t + FLIGHT.fly);
      laid = Math.max(laid, t + FLIGHT.fly);
    });
    tl.call(() => o.onBuilt(node.id), undefined, laid);
    const card = o.wide && view ? view.querySelector(`[data-auto-node="${node.id}"]`) : null;
    if (card) {
      tl.fromTo(card, { scale: 0.94 }, { scale: 1, duration: 0.35, ease: "power3.out", immediateRender: false }, laid);
    }
    end = Math.max(end, laid);
  });
  tl.to({}, { duration: o.wide ? HELD.wide : HELD.narrow }, end);
  return tl;
}

/** How long a hop takes on the map, by its line's length in user units. */
function hopFor(trace: SVGPathElement): number {
  const len = typeof trace.getTotalLength === "function" ? trace.getTotalLength() : 0;
  return Math.min(HOP.max, Math.max(HOP.min, len * HOP.per));
}

/**
 * The run, from step `from` to the last: the bead rides each hop (the
 * rail's bead, below xl), the block reached pings, `onStep(i)` arrives,
 * and the step holds for its caption. `onDone` after a last beat.
 */
export function buildRun(
  gsap: Gsap,
  root: Element,
  o: { lens: RunLens; wide: boolean; from: number; onStep: (i: number) => void; onDone?: () => void },
): Timeline {
  const tl = gsap.timeline();
  const { steps } = o.lens;
  const from = Math.max(0, Math.min(steps.length - 1, o.from));
  const view = viewOf(root, o.wide);
  const currents = currentsOf(o.lens);
  // The frame before `from` is where the run takes up.
  tl.call(() => o.onStep(from - 1), undefined, 0);
  if (!view) return tl;

  const beads = o.wide ? [...view.querySelectorAll<SVGGElement>(".auto-bead")] : [];
  const rows = o.wide ? null : view.querySelector("[data-auto-rows]");
  const railBead = rows?.querySelector<HTMLElement>(".auto-bead-list") ?? null;
  /** Where the rail's bead sits on a block's ring, measured when it moves. */
  const ringY = (id: string | null) => () => {
    const ring = id && rows ? rows.querySelector(`[data-auto-node="${id}"] .auto-rail-dot`) : null;
    return ring && rows ? within(rows, ring).cy - 4.5 : 0;
  };

  let t = 0;
  for (let i = from; i < steps.length; i++) {
    const step = steps[i];
    // A beat before the first hop; after that, time to read the step just shown.
    t += i === from ? 0.3 : holdFor(steps[i - 1].caption) / 1000;
    let arrive = t;

    if (o.wide) {
      (step.hops ?? []).forEach((h, k) => {
        const trace = view.querySelector<SVGPathElement>(`[data-auto-trace="${h}"]`);
        if (!trace) return;
        const dur = hopFor(trace);
        tl.fromTo(
          trace,
          { opacity: 1, drawSVG: "0% 0%" },
          { drawSVG: "0% 100%", duration: dur, ease: "power2.inOut", immediateRender: false },
          t,
        );
        const bead = beads[k] ?? beads[0];
        if (bead) {
          tl.set(bead, { opacity: 1 }, t);
          tl.to(
            bead,
            { motionPath: { path: trace, align: trace, alignOrigin: [0.5, 0.5] }, duration: dur, ease: "power2.inOut" },
            t,
          );
          tl.set(bead, { opacity: 0 }, t + dur);
        }
        arrive = Math.max(arrive, t + dur);
      });
    } else if (railBead) {
      const y = ringY(currents[i]);
      if (i === from) {
        // The bead appears on the ring the run takes up from, and slides on if that isn't this step's.
        tl.set(railBead, { y: ringY(from > 0 ? currents[from - 1] : currents[i]), opacity: 0 }, t);
        tl.to(railBead, { opacity: 1, duration: 0.2 }, t);
        arrive = t + 0.2;
        if (from > 0) {
          tl.to(railBead, { y, duration: SLIDE, ease: "power2.inOut" }, arrive);
          arrive += SLIDE;
        }
      } else {
        tl.to(railBead, { y, duration: SLIDE, ease: "power2.inOut" }, t);
        arrive = t + SLIDE;
      }
    }

    const reached = currents[i];
    if (reached) ping(tl, view, reached, o.wide, arrive);
    const n = i;
    tl.call(() => o.onStep(n), undefined, arrive);
    // A step that travels nowhere pings what it touches, twice.
    if (!step.hops?.length) for (const id of step.ring ?? []) ping(tl, view, id, o.wide, arrive + PING.dur);
    t = arrive;
  }

  t += DONE_BEAT;
  if (railBead) tl.to(railBead, { opacity: 0, duration: 0.3 }, t - 0.3);
  if (o.onDone) tl.call(o.onDone, undefined, t);
  else tl.to({}, { duration: 0 }, t);
  return tl;
}

/** The lit traces draw themselves back toward their ends: a seen route taken back before a tour from the top. */
export function retract(gsap: Gsap, root: Element, o: { wide: boolean }): Timeline {
  const tl = gsap.timeline();
  tl.to({}, { duration: RETRACT }, 0);
  const view = o.wide ? viewOf(root, true) : null;
  const lit = view ? [...view.querySelectorAll(".auto-trace[data-on]")] : [];
  if (lit.length) {
    tl.fromTo(
      lit,
      { opacity: 1, drawSVG: "0% 100%" },
      { drawSVG: "100% 100%", duration: RETRACT, ease: "power2.in", immediateRender: false },
      0,
    );
  }
  return tl;
}

export type TourOptions = {
  lens: RunLens;
  /** The map (xl) or the list. */
  wide: boolean;
  /** "hand": the whole tour, from by hand; a number: the run alone, from that step. */
  from: "hand" | number;
  /** The frame on screen may have been seen: take it back softly (retract, then fade) before the hand phase. */
  clear: boolean;
  /** The frame goes back to by hand, or the build begins (every block a ghost, then laid one by one). */
  onPhase: (phase: Phase) => void;
  onBuilt: (id: string) => void;
  onStep: (i: number) => void;
  onStart?: () => void;
  onDone: () => void;
};

/** A whole tour, built paused: the workbench decides when it plays. */
export function buildTour(gsap: Gsap, root: Element, o: TourOptions): Timeline {
  const tl = gsap.timeline({ paused: true, onStart: o.onStart });
  let t = 0;
  let from = 0;
  if (o.from === "hand") {
    if (o.clear) {
      tl.add(retract(gsap, root, o), 0);
      t = RETRACT;
    }
    tl.call(() => o.onPhase("hand"), undefined, t);
    if (o.clear) t += FADE_BACK;
    const hand = buildHand(gsap, root, o);
    tl.add(hand, t);
    t += hand.duration();
    tl.call(() => o.onPhase("built"), undefined, t);
    const build = buildBuild(gsap, root, o);
    tl.add(build, t);
    t += build.duration();
  } else {
    from = o.from;
  }
  tl.add(buildRun(gsap, root, { lens: o.lens, wide: o.wide, from, onStep: o.onStep, onDone: o.onDone }), t);
  return tl;
}
