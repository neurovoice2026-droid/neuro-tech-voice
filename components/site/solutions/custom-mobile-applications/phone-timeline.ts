import type { gsap as GsapCore } from "gsap";
import type { Answer, EdgeId, GoId, Move, PartId, Step } from "@/lib/pages/custom-mobile-applications";
import { holdFor } from "@/components/site/product/timing";
import { DASHED } from "./parts-geometry";
import { LAST, endsOf, hopsOf, moveOf, talksOf, type Hold, type StepIndex } from "./phone-frame";

/* ------------------------------------------------------------------ *
 * #hold — the phone's GSAP timelines, as plain functions: the tour (the
 * page's one autoplay), and the hops a reader's own press plays.
 *
 * GSAP ONLY TRAVELS; REACT HOLDS EVERY FRAME. What the phone and the
 * parts beside it show — the screen, the dialog, the notification, which
 * parts are on the step's way and which are lit, which lines are on,
 * the caption, the rail — is React's, drawn from `frameOf`
 * (phone-frame.ts) as props and data attributes. These timelines add
 * only what happens between two frames, and only on elements and
 * properties React never writes: a trace's dash (DrawSVG), a dot riding
 * a line (MotionPath), a ring's ping, the rail's dwell fill, the finger
 * and its ripple. Each arrival is a callback — `onEnter`, `onArrive`,
 * `onPress`, `onDone` — and React draws it. When the stage's context is
 * reverted (a press or a pick by hand, the window crossing md or lg,
 * reduced motion switched on) every inline style goes, and what is left
 * is React's frame, exactly.
 *
 * THE TOUR runs the journey once, from the step it takes up on to the
 * reminder, and ends on the finished frame:
 *   0. rewind (only when the finished frame may have been seen): the lit
 *      traces fade, 0.3s, and the phone goes back to "Welcome back" with
 *      the platform's own move back;
 *   1. each step: the screen arrives on its way (`onEnter`, or the
 *      previous step's press); after the move's own time, the hops — at
 *      lg a dot rides each line as DrawSVG draws its trace (0.45s, the
 *      two long returns to the phone 0.7s, each overlapping the last by
 *      0.05s), the card it reaches pinging; at md and below the lane's
 *      rows or the chips ping in turn, 0.3s apart — then the step arrives
 *      (`onArrive`: the parts lit, the lines on, and on the lock screen
 *      the reminder lands) and a part it only rings pings twice;
 *   2. the dwell: the rail's current fill runs 0 → 1 for as long as the
 *      caption takes to read (`holdFor`, 3.9–4.4s), counted from the
 *      arrival;
 *   3. the finger (not on the last step): a 26px disc fades in at the
 *      phone's lower right 0.8s before the dwell ends, glides to the
 *      hotspot — measured as the glide starts, so a platform switch in
 *      between is followed — presses it (a ripple goes out), and the
 *      press is the hotspot's own (`onPress`, GO): the next screen
 *      arrives with the move a reader's press would make. On "You’re
 *      booked" it presses Allow.
 * After the reminder's dwell, a last beat, then `onDone`. It never loops.
 *
 * MEASURED WHEN IT MOVES. Where the finger starts and where it goes are
 * function-based values, read when their tween first renders — not when
 * the timeline is built, which may be while the stage is a content-
 * visibility box off the screen — and from the stage it moves in.
 *
 * Client-only functions and no React. The kit that calls them has
 * registered DrawSVGPlugin and MotionPathPlugin (product/motion-kit.ts),
 * and they run inside the stage's `useKitContext`, so a revert of that
 * context takes back everything they did.
 * ------------------------------------------------------------------ */

type Gsap = typeof GsapCore;
type Timeline = ReturnType<Gsap["timeline"]>;

/** Which of the three compositions the hops play on: the drawing (lg+), the lane (md) or the chips. */
export type View = "map" | "lane" | "chips";

/**
 * How long each move runs (mob-device.css §5): a reader's press as a view
 * transition, the tour's own as the new screen's entry: the hops wait
 * for it, since the page behind a transition is held still until it
 * ends. iOS's 0.36s for the slides and the sheet (Android's are 0.3s),
 * the lock 0.4s, the unlock 0.28s, the platform's morph 0.42s.
 */
export const MOVE_S: Record<Move, number> = {
  "mob-forward": 0.36,
  "mob-back": 0.36,
  "mob-sheet-up": 0.36,
  "mob-sheet-down": 0.36,
  "mob-lock": 0.4,
  "mob-unlock": 0.28,
  "mob-platform": 0.42,
};

/** A hop, the two long returns to the phone, and how much each overlaps the last. */
const HOP = { dur: 0.45, long: 0.7, overlap: 0.05 } as const;
const LONG: ReadonlySet<EdgeId> = new Set<EdgeId>(["push-phone", "messages-phone"]);
/** The lane's rows and the chips ping this far apart. */
const TURN = 0.3;
/** A ping: how long, and how it grows and fades. */
const PING = { dur: 0.5, from: 0.96, to: 1.12, opacity: 0.6 } as const;
/** The finger: fading in, gliding, pressing, fading out, and how long before the dwell's end it starts. */
const FINGER = { show: 0.18, glide: 0.6, press: 0.16, hide: 0.2, lead: 0.8, size: 26 } as const;
/** The ripple under the finger's press, and its size. */
const RIPPLE = { dur: 0.3, size: 44 } as const;
/** A seen frame's lit traces fading before the tour takes the phone back. */
const REWIND = 0.3;
/** Before the first hop of a tour that takes up without a move. */
const BEAT = 0.2;
/** After the reminder's dwell, before the tour is done. */
const DONE_BEAT = 0.8;
/** After an arrival, when GSAP lets go of the traces React now holds lit (a commit lands a frame or two later). */
const LET_GO = 0.15;

/** The hotspot the tour presses on each step but the last: the journey's way forward, notifications allowed. */
export const TOUR_GO: readonly GoId[] = ["signin.go", "choose.go", "pay.go", "booked.allow"];

/** The answer the tour gives: none until the reminder, where it has allowed notifications. */
const tourAnswer = (k: StepIndex): Answer | null => (k === LAST ? "allow" : null);

/** An element's box within the stage, in px: its top-left, and its centre. */
function within(layer: Element, el: Element) {
  const l = layer.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return { x: r.left - l.left, y: r.top - l.top, cx: r.left - l.left + r.width / 2, cy: r.top - l.top + r.height / 2, w: r.width, h: r.height };
}

/** The ring that goes out round a part as the step reaches it, in the composition on show. */
function ping(tl: Timeline, root: Element, view: View, id: PartId, at: number) {
  const ring = root.querySelector(`.mob-${view} [data-mob-part="${id}"] .mob-ping`);
  if (!ring) return;
  tl.fromTo(
    ring,
    { opacity: PING.opacity, scale: PING.from },
    { opacity: 0, scale: PING.to, duration: PING.dur, ease: "power2.out", immediateRender: false },
    at,
  );
}

/**
 * A step's hops, from `at`: on the drawing, a dot rides each line as its
 * trace draws (a dashed one fades in instead: a dash draw would wreck
 * its dash), and the card it reaches pings; on the lane or the chips,
 * each part the step talks to pings in turn. Then the parts it only
 * rings ping, twice. Returns when the step arrives.
 */
function playHops(
  tl: Timeline,
  root: Element,
  o: { steps: readonly Step[]; view: View; step: StepIndex; answer: Answer | null; at: number },
): number {
  const s = { step: o.step, answer: o.answer };
  let arrive = o.at;
  if (o.view === "map") {
    const dots = [...root.querySelectorAll<SVGCircleElement>(".mob-map [data-mob-dot]")];
    let t = o.at;
    hopsOf(o.steps, s).forEach((edge, i) => {
      const trace = root.querySelector<SVGPathElement>(`#mob-e-${edge}`);
      const dur = LONG.has(edge) ? HOP.long : HOP.dur;
      if (trace) {
        if (DASHED.has(edge)) {
          tl.fromTo(trace, { opacity: 0 }, { opacity: 1, duration: dur, ease: "power1.in", immediateRender: false }, t);
        } else {
          tl.fromTo(
            trace,
            { opacity: 1, drawSVG: "0% 0%" },
            { drawSVG: "0% 100%", duration: dur, ease: "power2.inOut", immediateRender: false },
            t,
          );
        }
        const dot = dots[i % 2];
        if (dot) {
          tl.set(dot, { opacity: 1 }, t);
          tl.to(
            dot,
            { motionPath: { path: trace, align: trace, alignOrigin: [0.5, 0.5], autoRotate: false }, duration: dur, ease: "power2.inOut" },
            t,
          );
          tl.set(dot, { opacity: 0 }, t + dur);
        }
      }
      const to = endsOf(edge)[1];
      if (to !== "phone") ping(tl, root, "map", to, t + dur);
      arrive = t + dur;
      t = arrive - HOP.overlap;
    });
  } else {
    const ring = new Set(o.steps[o.step].ring ?? []);
    const reached = talksOf(o.steps, s).filter((p) => !ring.has(p));
    reached.forEach((p, i) => ping(tl, root, o.view, p, o.at + i * TURN));
    arrive = o.at + reached.length * TURN;
  }
  for (const p of o.steps[o.step].ring ?? []) {
    ping(tl, root, o.view, p, arrive);
    ping(tl, root, o.view, p, arrive + PING.dur);
  }
  return arrive;
}

/**
 * GSAP lets go of the traces it drew, once React holds them lit: nothing
 * inline outlives an arrival. Only where it drew them, the drawing on
 * show (below lg it is display:none and GSAP never touches it), and only
 * what it wrote there (DrawSVG's dash and the fades' opacity): clearing
 * "all" would make GSAP parse each trace's transform, and on a hidden
 * SVG path that measures it by adding a copy to the page, a forced layout
 * of the whole document per trace at every arrival.
 */
const DRAWN = "opacity,strokeDasharray,strokeDashoffset";
function letGo(tl: Timeline, root: Element, view: View, at: number) {
  if (view !== "map") return;
  const traces = root.querySelectorAll(".mob-map .mob-map-trace");
  if (traces.length) tl.set(traces, { clearProps: DRAWN }, at);
}

/**
 * The rail's dwell for step `k`: the span its fill sits in, which no rule
 * scales (mob-hold.css §4), so what GSAP saves and puts back there is
 * nothing, and the fill's own scale stays the frame's.
 */
const fillOf = (root: Element, k: number) => root.querySelector(`[data-mob-dwell="${k}"]`);

/**
 * The hops a reader's own press plays — a hotspot, a rail pick, "Start
 * again" — once the move has run, then `onArrive`. Built playing: the
 * reader asked for it.
 */
export function buildHops(
  gsap: Gsap,
  root: Element,
  o: { steps: readonly Step[]; view: View; hold: Hold; delay: number; onArrive: () => void },
): Timeline {
  const tl = gsap.timeline();
  const arrive = playHops(tl, root, { steps: o.steps, view: o.view, step: o.hold.step, answer: o.hold.answer, at: o.delay });
  tl.call(o.onArrive, undefined, arrive);
  letGo(tl, root, o.view, arrive + LET_GO);
  return tl;
}

export type TourOptions = {
  steps: readonly Step[];
  view: View;
  /** The step the tour takes up on: 0 for the whole journey, or where a reader's pick left it. */
  from: StepIndex;
  /** The frame on screen may have been seen: fade its lit traces, and go back with a move. */
  rewind: boolean;
  /** The step the tour takes up on: its screen, on its way. */
  onEnter: (k: StepIndex) => void;
  /** The step has arrived: its parts lit, its lines on, the reminder landed. */
  onArrive: (k: StepIndex) => void;
  /** The finger pressed a hotspot: the next screen, as a reader's press would bring it. */
  onPress: (go: GoId) => void;
  onStart?: () => void;
  onDone: () => void;
};

/** The whole tour, built paused: the stage decides when it plays. */
export function buildTour(gsap: Gsap, root: HTMLElement, o: TourOptions): Timeline {
  const tl = gsap.timeline({ paused: true, onStart: o.onStart });
  const finger = root.querySelector<HTMLElement>("[data-mob-finger]");
  const ripple = root.querySelector<HTMLElement>("[data-mob-ripple]");
  const phone = root.querySelector<HTMLElement>("[data-mob-phone]");

  let t = 0;
  if (o.rewind) {
    const lit = o.view === "map" ? [...root.querySelectorAll(".mob-map .mob-map-trace[data-on]")] : [];
    if (lit.length) {
      tl.fromTo(lit, { opacity: 1 }, { opacity: 0, duration: REWIND, ease: "power1.in", immediateRender: false }, 0);
    }
    t = REWIND;
  }
  const first = fillOf(root, o.from);
  if (first) tl.set(first, { scaleX: 0 }, t);
  tl.call(() => o.onEnter(o.from), undefined, t);
  letGo(tl, root, o.view, t + LET_GO);
  t += o.rewind ? MOVE_S["mob-back"] : BEAT;

  for (let k = o.from; k <= LAST; k++) {
    const step = k as StepIndex;
    const arrive = playHops(tl, root, { steps: o.steps, view: o.view, step, answer: tourAnswer(step), at: t });
    tl.call(() => o.onArrive(step), undefined, arrive);
    letGo(tl, root, o.view, arrive + LET_GO);

    const dwell = holdFor(o.steps[step].caption) / 1000;
    const fill = fillOf(root, step);
    if (fill) tl.to(fill, { scaleX: 1, duration: dwell, ease: "none" }, arrive);
    const end = arrive + dwell;

    if (step === LAST) {
      if (fill) tl.set(fill, { clearProps: "transform" }, end + DONE_BEAT);
      tl.call(o.onDone, undefined, end + DONE_BEAT);
      break;
    }

    const go = TOUR_GO[step];
    const hotspot = () => root.querySelector(`[data-mob-go="${go}"]`);
    const start = end - FINGER.lead;
    const pressAt = start + FINGER.show + FINGER.glide;
    const pressed = pressAt + FINGER.press;
    const half = FINGER.size / 2;
    if (finger && phone) {
      // From the phone's lower right, to the hotspot's centre, each read as its tween starts.
      const from = () => {
        const p = within(root, phone);
        return { x: p.x + p.w - 64, y: p.y + p.h - 112 };
      };
      const to = () => {
        const el = hotspot();
        return el ? within(root, el) : null;
      };
      tl.set(finger, { x: () => from().x, y: () => from().y, scale: 1, opacity: 0 }, start);
      tl.to(finger, { opacity: 1, duration: FINGER.show, ease: "power1.out" }, start);
      tl.to(
        finger,
        {
          x: () => (to()?.cx ?? from().x + half) - half,
          y: () => (to()?.cy ?? from().y + half) - half,
          duration: FINGER.glide,
          ease: "power2.inOut",
        },
        start + FINGER.show,
      );
      tl.to(finger, { keyframes: { scale: [1, 0.92, 1] }, duration: FINGER.press, ease: "none" }, pressAt);
      tl.to(finger, { opacity: 0, duration: FINGER.hide, ease: "power1.in" }, pressed);
      if (ripple) {
        const r = RIPPLE.size / 2;
        tl.set(ripple, { x: () => (to()?.cx ?? 0) - r, y: () => (to()?.cy ?? 0) - r, scale: 0.6, opacity: 0.35 }, pressAt);
        tl.to(ripple, { scale: 1.4, opacity: 0, duration: RIPPLE.dur, ease: "power2.out" }, pressAt);
      }
    }

    // The press: this step's fill is the frame's now (passed), the next one's starts empty.
    if (fill) tl.set(fill, { clearProps: "transform" }, pressed);
    const next = fillOf(root, step + 1);
    if (next) tl.set(next, { scaleX: 0 }, pressed);
    tl.call(() => o.onPress(go), undefined, pressed);
    t = pressed + MOVE_S[moveOf(go)];
  }
  return tl;
}
