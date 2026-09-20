"use client";

import {
  memo,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type Ref,
  type RefObject,
} from "react";
import type { CAA_WIRING, SystemId } from "@/lib/pages/custom-ai-agents";
import { cn } from "@/lib/utils";
import { Eyebrow, Frame, SectionTitle } from "@/components/site/product/primitives";
import { useInView, usePrefersReducedMotion } from "@/components/site/product/timing";
import { Gate, ToolName } from "@/components/site/industry/parts";
import { Legend, MadeUp, Node, Stack, fill } from "./parts";
import { markProved } from "./proved";

/* ------------------------------------------------------------------ *
 * §3 — Wired to your systems.
 *
 * The objection: "it has to work with what we already use." Every page
 * in this category answers it with a wall of logos, and a wall of logos
 * is exactly what a sceptic has learned to discount: it never says WHEN
 * the thing reaches your system, or who wrote the end that receives it.
 * Those two facts are the whole truth here, so the instrument is built
 * out of them.
 *
 * THE INSTRUMENT is one sample call on a time axis. Left of the hang-up
 * is what the platform does while the caller is on the line — six real
 * tool calls, at the seconds they ran. Right of it is what happens after:
 * one signed delivery, and the ends that receive it. This is where the
 * page's legend is stated, once, for the whole page: a SOLID line is on
 * the platform today; a DOTTED VIOLET line is built for you on the build.
 * The delivery is solid (the platform sends it); every line out of it to
 * "Your CRM" or "Your helpdesk" is dotted, because that end is our work,
 * not a native integration — and no copy anywhere claims the webhook
 * opens a ticket by itself. Slack comes off the hang-up directly and is
 * solid: it is its own platform action, not a consumer of the webhook.
 * The one in-call connection we might write — a plan check in your own
 * system — is drawn once, dotted, dropping from the 0:31 moment it would
 * serve, and the plan-check control lets the reader take it away and see
 * what "after the call" costs instead.
 *
 * TWO DRAWINGS, ONE CONTAINER QUERY. The axis needs ~640px to say what it
 * says; below that it becomes a vertical list with the same marks in the
 * same order. The switch is a CSS container query on the figure's own
 * wrapper, not the viewport and not a measured width: the server HTML
 * already holds the right drawing for whatever column it lands in, and
 * there is no first frame at the wrong geometry. Both drawings are in the
 * DOM; the one not shown is display:none, so it costs no layout.
 *
 * GEOMETRY (AxisWide). x is a percentage of the figure, y is pixels. Ticks
 * are EVENLY spaced, not proportional to time — the times are printed, and
 * proportional spacing crowded 0:58/1:06/1:12 into one collision. The six
 * labels alternate between two tiers and are centred on their ticks with a
 * half-width of (spacing − 6px): the taller tier's tick lines therefore run
 * in the 12px gutters BETWEEN the lower tier's labels and never through
 * one. That rule is what makes the drawing collision-free from 640px to
 * the 1088px the column tops out at; the spec's 300px box could not hold
 * three-line labels in two tiers plus the plan-check block below, so the
 * box is 460px (fixed, so nothing below it ever moves). The first and last
 * labels are clamped to the figure's edge and to the delivery trunk. The
 * after-call ends sit in one column 60px right of the hang-up — a fixed
 * offset, not a percentage, so each branch can be a fixed 1:1 SVG whose
 * dots never stretch — with their labels in the free space above the axis.
 *
 * TIMING. The 2:14 call plays back in 6s (PLAYBACK_MS) as one position,
 * u, running 0 → 1 along the axis: the during stroke fills to the hang-up
 * (x = 66%, u = 2/3) over 5.28s; then the puck holds on the hang-up for a
 * 200ms beat, and the after stroke eases to its end over the last 520ms,
 * so the signed delivery lands at 6.0s exactly as the stroke that carries
 * it arrives. The beat is the point: the during stroke crawls at the
 * call's pace and the after stroke has a third of the rail in a seventh
 * of the time, and a puck riding the rail straight from one rate into the
 * other lurched at the hang-up — the section's most important moment
 * read as a glitch. A stop, then an eased run, reads as "and then, after
 * the call…". The delivery pin inks as the stroke reaches it, not when
 * the delivery lands a few frames later: everywhere else a node inks when
 * its stroke arrives. One rAF writes u straight onto the elements,
 * so the long stroke is smooth without React rendering sixty times a
 * second; React only hears about the discrete moments (six ticks, the
 * hang-up, the delivery), about ten renders a run. The dotted plan check
 * appears with its own 0:31 moment: it is a lookup made while the caller
 * is on the line, and drawing it after the hang-up would say otherwise.
 * The CRM chip lights at 7.2s — a beat of the demonstration, not a
 * moment of the call, so it is a flag and never a place on the rail — and
 * it rests at ~7.8s once the aside has swapped. It never loops: a
 * looping demonstration reads as a screensaver.
 *
 * THE RAIL. The same u is the reader's to take. A native range input is
 * laid, invisible, over a drawn rail that spans exactly the axis's
 * 2%–98%, so on the wide drawing the puck stands above the very tick it
 * controls. Drag back past 0:58 and the booking un-inks; back across the
 * hang-up and the payload empties; forward and it all lands again. It is
 * the page's one reversible control, and it can be, because every mark is
 * already `invisible` rather than absent: scrubbing moves nothing. The
 * clock by the puck prints only times that happened — 0:00, a moment's
 * own time, 2:14 — never an interpolation: the ticks are evenly spaced,
 * so a time between two of them would be invented. A pointer drags
 * freely and the figure follows it with no lag (`data-caa-drag` zeroes
 * the transitions while the finger moves); arrows and a screen reader's
 * swipe step between the eight moments; a step, a click on the track or
 * Home/End glides there with the house easing rather than jumping.
 *
 * RESERVATION. Every label, row and node is laid out from frame one and
 * is `invisible` until reached; the wide box is a fixed height and the
 * narrow list's rows are always present, so the call playing out moves
 * nothing. The aside, the plan-check notes and the Gate are per-part
 * Stacks: the tallest variant is always reserved.
 *
 * COLOUR. Black = the platform today. Violet only on built-for-you marks
 * (dotted lines, violet-hollow nodes, the badge) and the aside's "when".
 * No green: nothing here is a test that held.
 * ------------------------------------------------------------------ */

type Data = typeof CAA_WIRING;

/** The call is 2:14. Nobody watches a page for 2:14. */
const PLAYBACK_MS = 6000;
/** The hang-up, as a fraction of the playback: the during span is 0–0.88. */
const HANG_P = 0.88;
/** When autoplay reaches the hang-up: 5280ms. */
const HANG_MS = PLAYBACK_MS * HANG_P;
/** The puck's stop on the hang-up before the after stroke runs. */
const HOLD_MS = 200;
/** The CRM chip lights 1.2s after the delivery; the aside swap lands by
 *  ~7.8s. Autoplay's last beat, held as `rested`, never as a position. */
const LIT_MS = 7200;

/** The during span, as a percentage of the figure: 2% → 66%. */
const SPAN = 64;
/** The axis — and the rail drawn over it — runs 2% → 98%: 96% of the box. */
const RAIL = 100 - 4;
/** The hang-up as a rail position: x = 66%, so u = 2/3. */
const U_HANG = SPAN / RAIL;
/** Tick k as a rail position, exactly under tickX(k). */
const tickU = (k: number, n: number) => ((k + 0.5) * (SPAN / n)) / RAIL;
/** The input's resolution: u in thousandths. */
const STEPS = 1000;
/** The drag flag clears this long after release: more than the longest
 *  entrance (ind-land, 280ms) plus its largest delay (the payload's last
 *  row), so nothing that landed in 0ms re-animates when the durations
 *  come back. */
const RELEASE_MS = 650;
/** A first change this big (in thousandths) under a press is a click on
 *  the track, not a drag: it glides there instead of snapping. */
const JUMP = 24;

/** Screen-reader confirmation on a user replay. Not in the data module's
 *  §4 copy: it is never shown, only announced (flagged for the assembler). */
const REPLAYED = "Call played again";

const CHIP =
  "min-h-11 shrink-0 rounded-full px-4 text-[14px] leading-none whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink";

/**
 * Where the call is, as one small integer: 0…n = moments reached, n+1 the
 * hang-up, n+2 the delivery. Children get this, never u, so they render
 * when a moment changes — about ten times a run, however fast the reader
 * drags. The plan check is not on this scale: it is not a moment of the
 * call but a connection hanging off one (0:31), and it follows that tick.
 */
function stepAtU(u: number, n: number) {
  if (u >= 1) return n + 2;
  if (u >= U_HANG) return n + 1;
  let k = 0;
  while (k < n && u >= tickU(k, n)) k++;
  return k;
}

/** The rail's stops: the start, each moment, the hang-up, the delivery. */
function detents(n: number) {
  return [0, ...Array.from({ length: n }, (_, k) => tickU(k, n)), U_HANG, 1];
}

/**
 * Autoplay's u at a playback time. Up to the hang-up it reproduces the
 * time clock it replaced frame for frame: the during stroke was
 * (ms / 6000) / 0.88 = ms / 5280, and tick k landed at (k + ½) / n of
 * 5280ms — which is tickU(k). After it, the moments keep their times but
 * not the old pace: a HOLD_MS beat on the hang-up, then the after stroke
 * eases (cubic in-out) through the 520ms that are left, arriving at 1 at
 * 6.0s as before. Linear here was a 3.7× jump in the puck's speed.
 */
function uAt(ms: number) {
  if (ms <= HANG_MS) return (U_HANG * ms) / HANG_MS;
  if (ms <= HANG_MS + HOLD_MS) return U_HANG;
  if (ms < PLAYBACK_MS) {
    const t = (ms - HANG_MS - HOLD_MS) / (PLAYBACK_MS - HANG_MS - HOLD_MS);
    return U_HANG + (1 - U_HANG) * (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
  }
  return 1;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** m:ss — the rehearsal sheet's helper, copied (a client file may not share it). */
const clock = (secs: number) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
/** The glide's curve: a quartic ease-out, close to the house
 *  cubic-bezier(0.22, 1, 0.36, 1) — quick to leave, long to settle. */
const settle = (t: number) => 1 - (1 - t) ** 4;

/**
 * What the rail says it is at, from existing copy only. Never the plan
 * check: it is not a place on the rail.
 */
function railText(data: Data, step: number) {
  const n = data.events.length;
  if (step <= 0) return `${clock(0)} · ${data.lanes.during}`;
  if (step <= n) {
    const e = data.events[step - 1];
    return fill(data.live, { at: e.at, tool: e.tool, effect: e.effect });
  }
  if (step === n + 1) return `${data.lanes.hungUp} · ${data.lanes.trigger}`;
  return `${data.delivery.mark} · ${data.delivery.label} · ${data.delivery.sub}`;
}

/** The call's length, from the payload it delivers (duration_seconds). */
function callSeconds(data: Data) {
  const row = data.payload.rows.find((r) => r.key === "duration_seconds");
  return row && "value" in row ? Number(row.value) : 0;
}

/* True after hydration; false in the server HTML and the frame that
   hydrates it. A copy of redline.tsx's, which is not exported. */
const noop = () => () => {};
const useHydrated = () =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

/** "Solid — on the platform today" → "on the platform today", for the spoken list. */
const tail = (s: string) => s.slice(s.indexOf("—") + 1).trim();

export function Wiring({ data }: { data: Data }) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, "-15% 0px");
  const still = usePrefersReducedMotion();
  const hydrated = useHydrated();
  const n = data.events.length;
  const FINAL = n + 2;
  const D = detents(n);

  const [step, setStep] = useState(0);
  /** Autoplay has come to rest (the chip-lighting beat). */
  const [rested, setRested] = useState(false);
  const [sel, setSel] = useState(() => Math.max(0, data.systems.findIndex((s) => s.id === data.settleOn)));
  const [plan, setPlan] = useState<number>(() =>
    Math.max(0, data.planCheck.options.findIndex((o) => o.id === data.planCheck.initial)),
  );
  const [touched, setTouched] = useState(false);
  const [run, setRun] = useState(0);

  // The axis strokes, the rail's ink, the puck and the input's value are
  // written straight onto the elements, by autoplay and by the reader's
  // hand alike. Their JSX style is a constant, so a React render never
  // touches them again and cannot fight the frame loop or the finger.
  const during = useRef<HTMLSpanElement>(null);
  const after = useRef<HTMLSpanElement>(null);
  /** The delivery pin's wrapper, flagged `data-on` once the stroke reaches it. */
  const deliv = useRef<HTMLSpanElement>(null);
  const inked = useRef<HTMLSpanElement>(null);
  const carrier = useRef<HTMLSpanElement>(null);
  const input = useRef<HTMLInputElement>(null);
  /** Where the call is. A ref, never state: it changes every frame. */
  const uRef = useRef(0);
  /** The input's value as last written or read: a one-unit change from it
   *  is a screen reader's swipe, which should step a whole moment. */
  const lastV = useRef(0);
  /** A pointer is pressed on the rail; while it is, the browser owns the
   *  input's value and nothing here writes it. */
  const pointerDown = useRef(false);
  /** The press has moved the value at least once (a drag, not a click). */
  const dragged = useRef(false);
  /** The press is a finger or a pen, whose first change may be a scroll. */
  const touchy = useRef(false);
  /** That first change, held until the gesture shows what it is. */
  const pending = useRef<number | null>(null);
  const dragTimer = useRef(0);

  const paintU = (u: number, sync = true) => {
    // The delivery pin sits 28px along the after stroke, so it inks at the
    // u where the stroke's tip reaches it, not at the delivery (u = 1): a
    // stroke running on through a hollow node reads as a skipped station.
    // offsetWidth is the layout width, blind to the scaleX below; it is
    // read before anything is written, and only transforms are ever
    // written here, so the read forces no layout. Hidden (the narrow
    // drawing is showing) it is 0, and the pin is not seen anyway.
    const reach = U_HANG + (1 - U_HANG) * (28 / (after.current?.offsetWidth || Infinity));
    deliv.current?.toggleAttribute("data-on", u >= reach);
    if (during.current) during.current.style.transform = `scaleX(${Math.min(1, u / U_HANG)})`;
    if (after.current) after.current.style.transform = `scaleX(${clamp01((u - U_HANG) / (1 - U_HANG))})`;
    if (inked.current) inked.current.style.transform = `scaleX(${u})`;
    // A percentage translate is of the carrier's own width, which is the
    // rail's: its right edge, where the puck sits, lands at 2% + u·96%
    // without a single measurement.
    if (carrier.current) carrier.current.style.transform = `translateX(${(u - 1) * 100}%)`;
    if (sync && !pointerDown.current && input.current) {
      const v = Math.round(u * STEPS);
      input.current.value = String(v);
      lastV.current = v;
    }
  };

  const raf = useRef(0);
  const started = useRef(false);
  const played = useRef(0);
  const stepRef = useRef(0);

  /** Put the call at u; React hears only if that crossed a moment. The
   *  step is read from `stepU`, which is u except near a glide's end. */
  const apply = (u: number, sync = true, stepU = u) => {
    uRef.current = u;
    paintU(u, sync);
    const s = stepAtU(stepU, n);
    if (s !== stepRef.current) {
      stepRef.current = s;
      setStep(s);
    }
  };

  // Every way a press can end — on the input, anywhere on the page, a
  // scroll that took the gesture over, focus leaving — lands here. The
  // flag outlives the press by RELEASE_MS; see the constant.
  const release = useCallback(() => {
    if (!pointerDown.current) return;
    pointerDown.current = false;
    clearTimeout(dragTimer.current);
    dragTimer.current = window.setTimeout(() => {
      if (ref.current) delete ref.current.dataset.caaDrag;
    }, RELEASE_MS);
  }, []);

  // Unmount only. Cancelling when the section scrolls away would strand
  // the call half drawn, and `started` would refuse to run it again.
  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
      clearTimeout(dragTimer.current);
      window.removeEventListener("pointerup", release);
    },
    [release],
  );

  useEffect(() => {
    if (still) {
      cancelAnimationFrame(raf.current);
      apply(1);
      return;
    }
    if (run === 0) {
      // The first pass: once, when the section is first seen, unless the
      // reader has already operated it (then it is already complete).
      if (!inView || started.current) return;
      started.current = true;
    } else {
      // A replay runs once per click, not again whenever inView flips.
      if (played.current === run) return;
      played.current = run;
    }
    cancelAnimationFrame(raf.current);
    stepRef.current = 0;
    setStep(0);
    setRested(false);
    apply(0);
    const begin = performance.now();
    const tick = (now: number) => {
      const ms = now - begin;
      apply(uAt(ms));
      if (ms < LIT_MS) raf.current = requestAnimationFrame(tick);
      else setRested(true);
    };
    raf.current = requestAnimationFrame(tick);
    // apply/n are derived from stable props and refs; the clock is keyed
    // on what can actually restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, run, still]);

  /**
   * The reader is driving now: the playback stops where it stands. A chip
   * or plan-check pick keeps the call exactly there — it does not jump to
   * the end — because the rail is how the reader finishes it.
   */
  function take() {
    started.current = true;
    cancelAnimationFrame(raf.current);
    setTouched(true);
    markProved("wiring");
  }

  function replay() {
    started.current = true;
    setTouched(true);
    setRun((r) => r + 1);
    markProved("wiring");
  }

  /**
   * Travel to u with the house easing: a keyboard step, a swipe, Home/End
   * or a click on the track. Every mark that the travel crosses lands in
   * order, on its own transition, as it does in the playback. The input
   * already holds the destination, so the frames leave it alone.
   */
  function glide(to: number) {
    const from = uRef.current;
    if (still || Math.abs(to - from) < 1e-6) return apply(to, false);
    const ms = Math.min(560, 240 + 400 * Math.abs(to - from));
    const begin = performance.now();
    const frame = (now: number) => {
      const t = Math.min(1, (now - begin) / ms);
      const e = settle(t);
      // The last frame is `to` itself, not from + (to − from): moments are
      // compared with >=, and a float one ulp short of a detent would stop
      // a step before the moment it names.
      const u = t < 1 ? from + (to - from) * e : to;
      // The step lands when the eye does. The quartic has the puck 85% of
      // the way there about a fifth into the glide; waiting for the exact
      // detent on the last frame left it sitting on the tick with nothing
      // happening. The tick's own colour transition covers the last ~15%
      // of travel. Moments crossed earlier in a long glide still land in
      // order, from u.
      apply(u, false, e >= 0.85 ? to : u);
      if (t < 1) raf.current = requestAnimationFrame(frame);
    };
    raf.current = requestAnimationFrame(frame);
  }

  /** Write a destination into the input (its value is the truth for the next step). */
  function hold(u: number) {
    const v = Math.round(u * STEPS);
    if (input.current) input.current.value = String(v);
    lastV.current = v;
  }

  /** The next stop past `from` in a direction, or null at the end. The
   *  1e-3 margin absorbs the input's rounding to thousandths. */
  function next(from: number, forward: boolean) {
    const to = forward ? D.find((d) => d > from + 1e-3) : [...D].reverse().find((d) => d < from - 1e-3);
    return to ?? null;
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    const forward = e.key === "ArrowRight" || e.key === "ArrowUp";
    if (!forward && e.key !== "ArrowLeft" && e.key !== "ArrowDown") return; // Home/End/Page keys stay native
    e.preventDefault();
    // From the input's value, not u: mid-glide, u is still travelling and
    // a quick second press must go one past the destination, not to it.
    const to = next(lastV.current / STEPS, forward);
    if (to === null) return;
    take();
    hold(to);
    glide(to);
  }

  function onRail(e: ChangeEvent<HTMLInputElement>) {
    const v = Number(e.currentTarget.value);
    const was = lastV.current;
    if (v === was) return;
    if (pointerDown.current) {
      // A finger's first change is held back. Chrome moves the value the
      // instant a finger lands on the track, before it knows whether the
      // gesture is a scroll; a scroll that starts on the rail must leave
      // no trace — not a step, not a proved claim. A second change means
      // the finger is dragging; a lift with no second change is a tap
      // (onUp); a scroll ends in pointercancel (onCancel).
      if (touchy.current && pending.current === null && !dragged.current) {
        pending.current = v;
        return;
      }
      const tap = pending.current !== null;
      pending.current = null;
      lastV.current = v;
      take();
      const click = !tap && !dragged.current && Math.abs(v - was) > JUMP;
      dragged.current = true;
      if (click) return glide(v / STEPS);
      // A drag: everything follows the finger in 0ms until RELEASE_MS
      // after it lets go. A pending clear from the last press is dropped,
      // or it would switch the easing back on mid-drag.
      clearTimeout(dragTimer.current);
      const s = ref.current;
      if (s && s.dataset.caaDrag === undefined) s.dataset.caaDrag = "";
      return apply(v / STEPS);
    }
    lastV.current = v;
    take();
    // No pointer: Home/End, Page keys, or a screen reader's swipe, which
    // calls stepUp/stepDown (one unit) and never fires keydown. A swipe
    // steps a whole moment, as the arrows do.
    let to = v / STEPS;
    if (Math.abs(v - was) === 1) {
      to = next(was / STEPS, v > was) ?? was / STEPS;
      hold(to);
    }
    glide(to);
  }

  function onPress(e: PointerEvent<HTMLInputElement>) {
    pointerDown.current = true;
    dragged.current = false;
    pending.current = null;
    touchy.current = e.pointerType !== "mouse";
    // A press that ends off the input still ends. `once`, and removed on
    // unmount; a second add of the same listener is a no-op.
    window.addEventListener("pointerup", release, { once: true });
  }

  /** A finger lifted without dragging: it was a tap on the track, and
   *  the call glides to where it landed. */
  function onUp() {
    const v = pending.current;
    pending.current = null;
    release();
    if (v === null) return;
    lastV.current = v;
    take();
    glide(v / STEPS);
  }

  /** The browser took the gesture for a scroll: put the value back. */
  function onCancel() {
    if (pending.current !== null) hold(uRef.current);
    pending.current = null;
    release();
  }

  const lit = touched || rested || still;
  const system = data.systems[sel].id;
  const checkDuring = data.planCheck.options[plan].id === "during";
  // The server HTML, the no-JS page and the frame that hydrates it show
  // the payload full; after that it waits for the call. Under reduced
  // motion it is full until the reader scrubs, and then it follows the
  // rail like everything else (instantly: ind-land is pinned there).
  const delivered = !hydrated || step >= FINAL || (still && !touched);
  const total = callSeconds(data);
  const at = step === 0 ? clock(0) : step <= n ? data.events[step - 1].at : clock(total);

  return (
    <section id="wiring" ref={ref} className="scroll-mt-28">
      <Frame className="px-6 md:px-12">
        <Eyebrow>{data.eyebrow}</Eyebrow>
        <SectionTitle className="mt-4 max-w-[820px]">{data.title}</SectionTitle>
        <p className="mt-5 max-w-[560px] text-base leading-[25px] text-pp-ink/80">{data.body}</p>
      </Frame>

      <Frame className="mt-8 px-2 md:px-4">
        <div className="rounded-[24px] bg-white p-4 shadow-[0_0_0_1px_rgb(24_16_40/0.06)] md:p-7">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-pp-hair pb-3">
            <p className="text-[13px] leading-5 font-medium text-pp-ink">{data.header}</p>
            <MadeUp>{data.tag}</MadeUp>
          </div>

          {/* The page's one statement of the legend. */}
          <Legend solid={data.legend.solid} dotted={data.legend.dotted} className="mt-4" />

          <Radios
            label={data.systemsLabel}
            items={data.systems.map((s) => s.chip)}
            value={sel}
            onPick={(i) => {
              setSel(i);
              take();
            }}
            className="mt-5"
          />

          {/* THE RAIL, in its own fixed 64px strip, outside the figure's
              aria-hidden: it is the one part of the drawing that is a
              control. Its drawn line spans the axis's 2%–98% in the same
              box as the figure, so on the wide drawing the puck stands over
              the tick it controls. mt-5 here and mt-1 on the figure keep the
              card exactly 64px taller than before (the Deferred reserve
              counts on it), and put the rail nearer the drawing it drives
              than the chips above it. */}
          <div className="caa-follow relative mt-5 h-16 rounded-lg select-none has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-pp-ink">
            {/* The track, then its ink: the figure's own 1.6px stroke,
                hair and black, centred on y = 32. */}
            <span aria-hidden className="absolute top-[31.2px] right-[2%] left-[2%] h-[1.6px] bg-pp-hair" />
            <span
              aria-hidden
              ref={inked}
              className="absolute top-[31.2px] right-[2%] left-[2%] h-[1.6px] origin-left bg-black"
              style={{ transform: "scaleX(0)" }}
            />
            {/* The nine stops: the start and the call's eight moments. Stop
                i is reached exactly when step >= i, so they colour from
                React's step, not from u. The hang-up is a tick, the
                dimension line's end, not a dot. No violet: nothing on the
                rail is built for you. */}
            {D.map((d, i) => (
              <span
                key={i}
                aria-hidden
                className={cn(
                  "absolute -translate-x-1/2 transition-colors duration-200 motion-reduce:transition-none",
                  i === n + 1 ? "top-[27px] h-2.5 w-[1.6px]" : "top-[29px] size-1.5 rounded-full",
                  step >= i ? "bg-black" : "bg-pp-muted/45",
                )}
                style={{ left: `calc(2% + ${d * RAIL}%)` }}
              />
            ))}
            <span aria-hidden className="pointer-events-none absolute inset-y-0 right-[2%] left-[2%]">
              {/* As wide as the rail, moved by its own width: see paintU. */}
              <span ref={carrier} className="absolute inset-0" style={{ transform: "translateX(-100%)" }}>
                {/* Re-rendered only when the step changes: never a time
                    between two moments. */}
                <span className="absolute top-0 right-0 translate-x-1/2 text-[11px] leading-4 whitespace-nowrap text-pp-muted tabular-nums">
                  {at}
                </span>
                <span className="absolute top-[22px] right-[-10px] size-5 rounded-full bg-white shadow-[0_0_0_1.6px_#000]" />
              </span>
            </span>
            {/* The hit area. Uncontrolled: the frames write its value, and
                a programmatic write fires no onChange, so the playback can
                never mark the claim proved. A form control does not stretch
                between left and right, so its width is set: the rail's 96%
                plus the 44px thumb, whose centre then travels 2% → 98%. */}
            <input
              ref={input}
              type="range"
              min={0}
              max={STEPS}
              step={1}
              defaultValue={0}
              aria-label={data.scrub}
              aria-valuetext={railText(data, step)}
              onChange={onRail}
              onKeyDown={onKey}
              onPointerDown={onPress}
              onPointerUp={onUp}
              onPointerCancel={onCancel}
              onLostPointerCapture={release}
              onBlur={release}
              className="caa-scrub absolute top-0 h-full cursor-grab opacity-0 active:cursor-grabbing"
              style={{ left: "calc(2% - 22px)", width: "calc(96% + 44px)", touchAction: "pan-y" }}
            />
          </div>

          {/* The figure is a picture of the call; the words are in the list
              after it. `@container` is what the two drawings query;
              `caa-follow` lets it keep pace with a dragging finger. */}
          <div aria-hidden className="caa-follow mt-1 @container">
            <AxisWide
              className="hidden @min-[640px]:block"
              data={data}
              step={step}
              system={lit ? system : null}
              planDuring={checkDuring}
              duringRef={during}
              afterRef={after}
              delivRef={deliv}
            />
            <AxisNarrow
              className="@min-[640px]:hidden"
              data={data}
              step={step}
              system={lit ? system : null}
              planDuring={checkDuring}
            />
          </div>

          <SpokenCall data={data} />

          {/* Two rows at lg: the payload spans both, and Replay drops to the
              foot of the left column's second row, so it closes the column
              that was left short instead of hanging alone under both. Below
              lg the DOM order is the reading order; the layout is static. */}
          <div className="mt-8 grid gap-7 lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[auto_1fr] lg:gap-x-10 lg:gap-y-6">
            <div>
              {/* Re-keyed once when the chip lights, so the CRM aside lands
                  with the house swap as the call comes to rest. */}
              <div key={lit ? "lit" : "rest"}>
                <Stack
                  items={data.systems}
                  live={sel}
                  render={(s) => (
                    <p className="text-[11px] leading-4 font-medium tracking-[0.12em] text-pp-accent uppercase">{s.when}</p>
                  )}
                />
                <Stack
                  items={data.systems}
                  live={sel}
                  className="mt-2"
                  render={(s) => <p className="text-[15px] leading-[23px] text-pp-ink">{s.how}</p>}
                />
                {/* Always reserved: the calendar's gate is the only one, and
                    the other three leave its line empty rather than closing it. */}
                <Stack
                  items={data.systems}
                  live={sel}
                  className="mt-3"
                  render={(s) => (s.gate ? <Gate tool={s.gate} /> : null)}
                />
              </div>

              <PlanCheck
                data={data}
                value={plan}
                onPick={(i) => {
                  setPlan(i);
                  take();
                }}
              />
            </div>

            <Payload data={data} highlight={!checkDuring} delivered={delivered} className="lg:row-span-2" />

            {/* Hidden, not removed, under reduced motion: there is nothing to
                replay when the call is drawn complete, and the media query
                applies from the first paint. Unmounting it on the hook's
                answer would pull everything below up ~68px after hydration. */}
            <button
              type="button"
              onClick={replay}
              className="min-h-11 justify-self-start rounded-full bg-pp-card px-4 text-[14px] text-pp-ink transition-colors hover:bg-pp-hair focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink motion-reduce:hidden lg:col-start-1 lg:row-start-2 lg:self-end"
            >
              {data.replay}
            </button>
          </div>
          {/* Silent through autoplay; speaks only when the reader asked, and
              never under reduced motion, where nothing is played again. The
              trailing no-break space alternates so a second replay is a
              change the screen reader announces again. */}
          <p className="sr-only" aria-live="polite">
            {run > 0 && !still ?`${REPLAYED}${run % 2 ? "" : " "}` : ""}
          </p>
        </div>
      </Frame>

      <Frame className="mt-5 px-6 md:px-12">
        <p className="max-w-[620px] text-[13px] leading-5 text-pp-muted">{data.foot}</p>
        {data.trademarks.map((t) => (
          <p key={t} className="mt-2 max-w-[620px] text-[12px] leading-[18px] text-pp-muted">
            {t}
          </p>
        ))}
      </Frame>
    </section>
  );
}

/* ------------------------------------------------------------------ */

/**
 * A row of radio chips: roving tabindex (only the checked one is a tab
 * stop), arrows and Home/End move and select, as a radio group should.
 */
function Radios({
  label,
  labelledBy,
  items,
  value,
  onPick,
  className,
}: {
  label?: string;
  labelledBy?: string;
  items: readonly string[];
  value: number;
  onPick: (i: number) => void;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  function onKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const last = items.length - 1;
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
  return (
    <div role="radiogroup" aria-label={label} aria-labelledby={labelledBy} className={cn("flex flex-wrap gap-2", className)}>
      {items.map((x, i) => (
        <button
          key={x}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={i === value}
          tabIndex={i === value ? 0 : -1}
          onClick={() => onPick(i)}
          onKeyDown={(e) => onKey(e, i)}
          className={cn(CHIP, i === value ? "bg-pp-ink text-white" : "bg-pp-card text-pp-muted hover:text-pp-ink")}
        >
          {x}
        </button>
      ))}
    </div>
  );
}

/** A workflow action's name, set exactly as ToolName sets a voice tool's
 *  (ToolName is typed to voice tools; send_webhook and notify_slack are not). */
function Mark({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("font-[family-name:var(--font-geist-mono)] text-[11px] tracking-[0.02em]", className)}>
      {children}
    </span>
  );
}

/**
 * The plan check, during or after. The choice is the page's one honest
 * trade-off in miniature: during needs something built and gives the
 * caller an answer on the line; after needs nothing and gives them none.
 */
function PlanCheck({ data, value, onPick }: { data: Data; value: number; onPick: (i: number) => void }) {
  const id = useId();
  const { planCheck } = data;
  return (
    <div className="mt-6 border-t border-pp-hair pt-5">
      <p id={id} className="text-[11px] leading-4 font-medium tracking-[0.12em] text-pp-muted uppercase">
        {planCheck.label}
      </p>
      <Radios
        labelledBy={id}
        items={planCheck.options.map((o) => o.label)}
        value={value}
        onPick={onPick}
        className="mt-3"
      />
      <Stack
        items={planCheck.options}
        live={value}
        className="mt-3"
        render={(o) => <p className="text-[13px] leading-5 text-pp-muted">{o.note}</p>}
      />
    </div>
  );
}

/**
 * What the delivery carries, trimmed. A definition list, never a <pre>: a
 * <pre> cannot wrap and would scroll sideways at 320px. With the plan
 * checked after the call, the plan number's row is lifted — that row is
 * where the office would read it.
 *
 * It is empty until the delivery lands. The foot says the payload is
 * "sent after the call"; the card now shows it: before the hang-up each
 * value is only a hairline — run-it's empty field — and when the signed
 * delivery lands the values drop in top to bottom, 40ms apart. Scrub back
 * before it and they empty at once, with no exit (an exit would claim
 * something was taken back). The keys stay: they are the shape of what
 * will arrive, and a screen reader keeps reading them. The text is laid
 * out whether it shows or not, so the card never changes height.
 */
const Payload = memo(function Payload({
  data,
  highlight,
  delivered,
  className,
}: {
  data: Data;
  highlight: boolean;
  delivered: boolean;
  className?: string;
}) {
  const { payload } = data;
  // The label ends in the signature header's name. It is held together by
  // nowrap, never by U+2011: a developer copies it from here, and a string
  // of non-breaking hyphens would never match the real header.
  const cut = payload.label.lastIndexOf(" ");
  // The stagger counts only rows that carry a value: `call` and
  // `extracted` are headings, and a gap in the cascade would read as a
  // value that failed to arrive.
  const valued = payload.rows.filter((r) => "value" in r);
  return (
    <div className={cn("rounded-2xl bg-pp-card p-5", className)}>
      <p className="text-[11px] leading-4 tracking-[0.1em] break-words text-pp-muted uppercase">
        {payload.label.slice(0, cut + 1)}
        <span className="whitespace-nowrap">{payload.label.slice(cut + 1)}</span>
      </p>
      {/* caa-follow: while the rail is dragged, the values land in 0ms. */}
      <dl className="caa-follow mt-3">
        {payload.rows.map((r) => {
          const has = "value" in r;
          const i = valued.indexOf(r);
          return (
            <div
              key={`${r.depth}:${r.key}`}
              className={cn(
                "-mx-2 grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 rounded-md py-1 pr-2 transition-colors duration-300 max-[400px]:grid-cols-1",
                highlight && r.key === "plan_number" && "bg-white",
              )}
              style={{ paddingLeft: 8 + r.depth * 16 }}
            >
              <dt className="font-[family-name:var(--font-geist-mono)] text-[13px] leading-5 break-words text-pp-muted">
                {r.key}
              </dt>
              <dd
                aria-hidden={has && !delivered ? true : undefined}
                className="relative font-[family-name:var(--font-geist-mono)] text-[13px] leading-5 break-words text-pp-ink"
              >
                {has && (
                  <>
                    <span
                      key={delivered ? "on" : "off"}
                      className={delivered ? "ind-land" : "invisible"}
                      style={delivered ? { animationDelay: `${i * 40}ms` } : undefined}
                    >
                      {r.value}
                    </span>
                    {/* The empty field, on the first line's centre. */}
                    <span
                      aria-hidden
                      className="absolute inset-x-0 top-[10px] h-px bg-pp-hair transition-opacity duration-200 motion-reduce:transition-none"
                      style={{ opacity: delivered ? 0 : 1 }}
                    />
                  </>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="mt-3 border-t border-pp-hair pt-3 text-[13px] leading-5 text-pp-muted">{payload.foot}</p>
    </div>
  );
});

/**
 * The call in words, for anyone who cannot see the drawing. Static: it
 * reads the same whether or not the playback has run, and it says which
 * ends are built for you in the legend's own words.
 */
function SpokenCall({ data }: { data: Data }) {
  const { written } = data;
  return (
    <ol className="sr-only" aria-label={data.header}>
      {data.events.map((e) => (
        <li key={e.id}>{fill(data.live, { at: e.at, tool: e.tool, effect: e.effect })}</li>
      ))}
      <li>{`${written.label} · ${written.badge} · ${written.sub}`}</li>
      <li>{`${data.lanes.hungUp} · ${data.lanes.trigger}`}</li>
      <li>{`${data.delivery.mark} · ${data.delivery.label} · ${data.delivery.sub}`}</li>
      {data.after.map((a) => (
        <li key={a.id}>
          {`${"mark" in a ? `${a.mark} · ` : ""}${a.to} · ${a.effect} · ${tail(a.kind === "built" ? data.legend.dotted : data.legend.solid)}`}
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------ *
 * The drawings. Both receive the step, the lit system and the plan
 * choice — never the clock — and are memoised, so they render about ten
 * times a run.
 * ------------------------------------------------------------------ */

type DrawProps = {
  data: Data;
  step: number;
  /** The chip that is lit, or null before the call comes to rest. */
  system: SystemId | null;
  planDuring: boolean;
  className?: string;
};

/** Marks for other systems step back once a chip is lit. */
function dim(system: SystemId | null, systems: readonly SystemId[]) {
  return system !== null && !systems.includes(system);
}

/*
 * How a dimmed mark steps back. The glyphs (nodes, stubs, strokes) fade
 * by opacity. The words fade by colour instead: 40% opacity over the
 * muted grey is about 1.8:1, and on a phone most of the call list sits in
 * that state, facts included. So an ink line goes to muted (still 5:1
 * and above) and a muted line stays muted. The difference between the
 * chosen system's rows and the rest is then carried by ink against muted
 * titles and by the faded glyphs, and every word stays readable.
 */
const glyph = (faded: boolean) => cn("transition-opacity duration-300 motion-reduce:transition-none", faded && "opacity-40");
const ink = (faded: boolean) =>
  cn("transition-colors duration-300 motion-reduce:transition-none", faded ? "text-pp-muted" : "text-pp-ink");

/** Everything the signed delivery can reach: the built ends' systems. */
function deliverySystems(data: Data): SystemId[] {
  return data.after.filter((a) => a.kind === "built").flatMap((a) => [...a.systems]);
}

function writtenSystems(data: Data): readonly SystemId[] {
  return data.events.find((e) => e.id === data.written.from)?.systems ?? [];
}

// AxisWide geometry, in px down the 460px box. See the header comment.
const G = {
  H: 460,
  AXIS: 256,
  /** Node of the upper tier (odd ticks): its label ends 10px above it, and
   *  may start as high as y=28, under the lane heads. */
  UP: 124,
  /** Node of the lower tier (even ticks): its label starts under the upper
   *  tier's nodes, so the two tiers never share a line of height. */
  LOW: 230,
  /** After-call ends above the axis (built), in order. */
  ENDS: [36, 136] as const,
  /** Slack, below the axis, clear of the delivery label. */
  SLACK: 360,
  /** The plan check's node, below the hang-up label. */
  WRITTEN: 330,
};
/** The six ticks share the during span (2%–66%, SPAN) evenly. */
const tickX = (i: number, n: number) => 2 + (i + 0.5) * (SPAN / n);
/** Hang-up, delivery and the column of ends: fixed px offsets past 66%. */
const HANG = "66%";
const DELIV = "calc(66% + 28px)";
const ENDX = "calc(66% + 60px)";
const END_LABEL = "calc(66% + 74px)";

/** The box a tick's label may occupy. Centred on the tick, half-width
 *  (spacing − 6px), so the other tier's tick lines pass in the gaps; the
 *  first is clamped to the figure's edge, the last to the delivery trunk. */
function labelBox(i: number, n: number): CSSProperties {
  const s = SPAN / n;
  const x = tickX(i, n);
  if (i === 0) return { left: 0, width: `calc(${x + s}% - 6px)` };
  if (i === n - 1) return { left: `calc(${x - s}% + 6px)`, width: `calc(${66 - (x - s)}% + 14px)` };
  return { left: `calc(${x - s}% + 6px)`, width: `calc(${2 * s}% - 12px)` };
}

function nodeAt(x: string, y: number, size: "md" | "sm"): CSSProperties {
  const r = size === "md" ? 9.5 : 6.5;
  return { left: `calc(${x} - ${r}px)`, top: y - r };
}

/** A Node placed by its centre. (Node itself takes no style: it is shared.) */
function Pin({
  x,
  y,
  size = "md",
  className,
  ref,
  ...node
}: {
  x: string;
  y: number;
  size?: "md" | "sm";
  className?: string;
  ref?: Ref<HTMLSpanElement>;
} & Omit<Parameters<typeof Node>[0], "size" | "className">) {
  return (
    <span ref={ref} className={cn("absolute block", className)} style={nodeAt(x, y, size)}>
      <Node {...node} size={size} />
    </span>
  );
}

const AxisWide = memo(function AxisWide({
  data,
  step,
  system,
  planDuring,
  duringRef,
  afterRef,
  delivRef,
  className,
}: DrawProps & {
  duringRef: RefObject<HTMLSpanElement | null>;
  afterRef: RefObject<HTMLSpanElement | null>;
  delivRef: RefObject<HTMLSpanElement | null>;
}) {
  const n = data.events.length;
  const hung = step >= n + 1;
  const delivered = step >= n + 2;
  const written = data.events.findIndex((e) => e.id === data.written.from);
  // The plan check drops from its own moment: it lands as the 0:31 tick
  // does, and goes when the reader scrubs back before it. Never after the
  // hang-up — it is a lookup made while the caller is on the line.
  const writtenOn = planDuring && step > written;
  const wx = `${tickX(written, n)}%`;
  const writtenFaded = dim(system, writtenSystems(data));
  const deliveryFaded = dim(system, deliverySystems(data));
  // Built ends take the slots above the axis in order; the platform's own
  // (Slack) goes below, off the hang-up.
  const builtIds = data.after.filter((a) => a.kind === "built").map((a) => a.id);

  return (
    <div className={cn("relative select-none", className)} style={{ height: G.H }}>
      {/* Lane heads: the two spans named once, each ruled to its end. */}
      <div className="absolute top-0 flex items-center gap-3" style={{ left: "2%", width: "calc(64% - 14px)" }}>
        <span className="text-[11px] leading-4 tracking-[0.1em] whitespace-nowrap text-pp-muted uppercase">{data.lanes.during}</span>
        <span className="h-px flex-1 bg-pp-hair" />
      </div>
      <div className="absolute top-0 flex items-center gap-3" style={{ left: HANG, right: "2%" }}>
        <span className="text-[11px] leading-4 tracking-[0.1em] whitespace-nowrap text-pp-muted uppercase">{data.lanes.after}</span>
        <span className="h-px flex-1 bg-pp-hair" />
      </div>

      {/* The axis: a hair track for the whole call, inked by the clock. */}
      <span className="absolute h-[1.6px] bg-pp-hair" style={{ left: "2%", right: "2%", top: G.AXIS - 0.8 }} />
      <span
        ref={duringRef}
        className="absolute h-[1.6px] origin-left bg-black"
        style={{ left: "2%", width: `${SPAN}%`, top: G.AXIS - 0.8, transform: "scaleX(0)" }}
      />
      <span
        ref={afterRef}
        className="absolute h-[1.6px] origin-left bg-black"
        style={{ left: HANG, width: "32%", top: G.AXIS - 0.8, transform: "scaleX(0)" }}
      />

      {/* The six moments. */}
      {data.events.map((e, i) => {
        const on = step > i;
        const y = i % 2 ? G.UP : G.LOW;
        const x = `${tickX(i, n)}%`;
        const faded = dim(system, e.systems);
        return (
          <div key={e.id}>
            <span
              className={cn("absolute w-[1.6px] bg-pp-hair", glyph(faded))}
              style={{ left: `calc(${x} - 0.8px)`, top: y, height: G.AXIS - y }}
            >
              <span
                className="block h-full w-full origin-bottom bg-black transition-transform duration-300 ease-out motion-reduce:transition-none"
                style={{ transform: on ? "scaleY(1)" : "scaleY(0)" }}
              />
            </span>
            <Pin x={x} y={y} size="sm" state={on ? "ink" : "hollow"} className={glyph(faded)} />
            <div
              key={on ? "on" : "off"}
              className={cn("absolute text-center", on ? "ind-land" : "invisible")}
              style={{ ...labelBox(i, n), bottom: G.H - (y - 10) }}
            >
              <p className="text-[11px] leading-4 text-pp-muted tabular-nums">{e.at}</p>
              <p className="leading-4">
                <ToolName tool={e.tool} className={ink(faded)} />
              </p>
              <p className={cn("mt-0.5 text-[13px] leading-[18px]", ink(faded))}>{e.effect}</p>
            </div>
          </div>
        );
      })}

      {/* The one in-call connection we'd write: dotted, from 0:31 down. */}
      {/* The wrapper fades the whole connection in; dimming is per part,
          below it, so the words dim by colour and the marks by opacity. */}
      <div
        className="transition-opacity duration-[400ms] motion-reduce:transition-none"
        style={{ opacity: writtenOn ? 1 : 0 }}
      >
        <span
          className={cn("caa-dots-v absolute", glyph(writtenFaded))}
          style={{ left: `calc(${wx} - 0.8px)`, top: G.AXIS + 4, height: G.WRITTEN - G.AXIS - 4 }}
        />
        <Pin x={wx} y={G.WRITTEN} state="violet-hollow" className={glyph(writtenFaded)} />
        <div className="absolute" style={{ left: `calc(${wx} + 18px)`, top: G.WRITTEN - 9, width: "min(340px, calc(48% - 44px))" }}>
          <p className={cn("text-[13px] leading-[18px] font-medium", ink(writtenFaded))}>{data.written.label}</p>
          <p className="mt-1 text-[11px] leading-4 tracking-[0.1em] text-pp-accent uppercase">{data.written.badge}</p>
          <p className="mt-1.5 text-[13px] leading-[18px] text-pp-muted">{data.written.sub}</p>
        </div>
      </div>

      {/* The hang-up: where "during" ends and every after-call action fires. */}
      <Pin x={HANG} y={G.AXIS} state={hung ? "ink" : "hollow"} />
      <div
        key={hung ? "on" : "off"}
        className={cn("absolute text-right", hung ? "ind-land" : "invisible")}
        style={{ right: "calc(34% + 14px)", top: G.AXIS + 12 }}
      >
        <p className="text-[11px] leading-4 font-medium tracking-[0.1em] whitespace-nowrap text-pp-ink uppercase">{data.lanes.hungUp}</p>
        <p className="text-[11px] leading-4 tracking-[0.1em] whitespace-nowrap text-pp-muted uppercase">{data.lanes.trigger}</p>
      </div>

      {/* The after-call ends. Built ones rise from the delivery, dotted;
          Slack drops from the hang-up itself, solid. Each branch is a fixed
          1:1 SVG — the column is a px offset, so nothing is ever stretched. */}
      {data.after.map((a, i) => {
        const isBuilt = a.kind === "built";
        const y = isBuilt ? G.ENDS[builtIds.indexOf(a.id)] : G.SLACK;
        const faded = dim(system, a.systems);
        return (
          <div key={a.id}>
            {isBuilt ? (
              <svg
                className="absolute overflow-visible transition-opacity duration-[400ms] motion-reduce:transition-none"
                style={{
                  left: DELIV,
                  top: y,
                  // Inline, so it carries the dim too: a class could not beat it.
                  opacity: delivered ? (faded ? 0.4 : 1) : 0,
                  transitionDelay: delivered ? `${i * 80}ms` : "0ms",
                }}
                width="32"
                height={G.AXIS - y}
                viewBox={`0 0 32 ${G.AXIS - y}`}
                fill="none"
              >
                <path
                  d={`M0 ${G.AXIS - y} L0 16 Q0 0 16 0 L32 0`}
                  stroke="#551a89"
                  strokeWidth="1.6"
                  strokeDasharray="0.01 4.6"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg
                className={cn("absolute overflow-visible", glyph(faded))}
                style={{ left: HANG, top: G.AXIS }}
                width="60"
                height={y - G.AXIS}
                viewBox={`0 0 60 ${y - G.AXIS}`}
                fill="none"
              >
                <path
                  d={`M0 0 L0 ${y - G.AXIS - 16} Q0 ${y - G.AXIS} 16 ${y - G.AXIS} L60 ${y - G.AXIS}`}
                  stroke="#000"
                  strokeWidth="1.6"
                  pathLength={1}
                  strokeDasharray="1"
                  className="transition-[stroke-dashoffset] duration-[760ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
                  style={{ strokeDashoffset: delivered ? 0 : 1, transitionDelay: delivered ? `${i * 80}ms` : "0ms" }}
                />
              </svg>
            )}
            <Pin
              x={ENDX}
              y={y}
              size="sm"
              state={isBuilt ? "violet-hollow" : "ink"}
              className={cn(glyph(faded), !delivered && "opacity-0")}
            />
            <div
              key={delivered ? "on" : "off"}
              className={cn("absolute", delivered ? "ind-land" : "invisible")}
              style={{ left: END_LABEL, right: 0, top: y - 8, animationDelay: `${i * 80}ms` }}
            >
              <p className="flex flex-wrap gap-x-2 leading-4">
                {"mark" in a && <Mark className={ink(faded)}>{a.mark}</Mark>}
                <Mark className="text-pp-muted">{a.to}</Mark>
              </p>
              <p className={cn("mt-0.5 text-[13px] leading-[18px]", ink(faded))}>{a.effect}</p>
            </div>
          </div>
        );
      })}

      {/* The signed delivery: on the platform, so solid and inked. The node
          inks from `data-on`, which the frame loop sets the moment the after
          stroke's tip reaches it (see paintU) — the stroke never runs on
          through a hollow node. Its words, the ends and the payload still
          wait for the delivery itself. The core takes Node's own ink
          colours; its 420ms colour transition is zeroed by the drag flag. */}
      <div>
        <Pin
          ref={delivRef}
          x={DELIV}
          y={G.AXIS}
          state={delivered ? "ink" : "hollow"}
          className={cn(glyph(deliveryFaded), "[&[data-on]>span>span]:border-black [&[data-on]>span>span]:bg-black")}
        />
        <div
          key={delivered ? "on" : "off"}
          className={cn("absolute", delivered ? "ind-land" : "invisible")}
          style={{ left: "calc(66% + 19px)", right: 0, top: G.AXIS + 14 }}
        >
          <p className="leading-4">
            <Mark className={ink(deliveryFaded)}>{data.delivery.mark}</Mark>
          </p>
          <p className={cn("text-[13px] leading-[18px] font-medium", ink(deliveryFaded))}>{data.delivery.label}</p>
          <p className="text-[11px] leading-4 text-pp-muted">{data.delivery.sub}</p>
        </div>
      </div>
    </div>
  );
});

/* ------------------------------------------------------------------ *
 * AxisNarrow — the same call as a list, for columns under 640px.
 *
 * The axis runs down the left gutter. Each row carries its own stretch of
 * it, from its node's centre to the next row's (every node sits 18px
 * below its row's top, so the stretches meet exactly whatever each row's
 * text wraps to). A stretch inks the moment the node above it is
 * reached, over the 760ms before the next one lands, so the line reads as
 * one stroke travelling down the call.
 *
 * The order is the wide drawing's topology, read top to bottom: the six
 * moments; the plan check we'd build, branching off dotted; the hang-up;
 * Slack, branching off solid (it fires from the hang-up, not from the
 * delivery); the signed delivery; then the dotted trunk out of the
 * delivery to the two ends we'd build.
 * ------------------------------------------------------------------ */

function Stretch({ on, dotted, ms = 760, delay = 0 }: { on: boolean; dotted?: boolean; ms?: number; delay?: number }) {
  if (dotted)
    return (
      <span
        className="caa-dots-v absolute top-[18px] left-[9.2px] h-full transition-opacity duration-[400ms] motion-reduce:transition-none"
        style={{ opacity: on ? 1 : 0, transitionDelay: on ? `${delay}ms` : "0ms" }}
      />
    );
  return (
    <span className="absolute top-[18px] left-[9.2px] h-full w-[1.6px] bg-pp-hair">
      <span
        className="block h-full w-full origin-top bg-black transition-transform ease-out motion-reduce:transition-none"
        style={{ transform: on ? "scaleY(1)" : "scaleY(0)", transitionDuration: `${ms}ms`, transitionDelay: on ? `${delay}ms` : "0ms" }}
      />
    </span>
  );
}

/** A branch off the axis to an indented node: the stub from x=10 to it. */
function Stub({ on, dotted, faded }: { on: boolean; dotted?: boolean; faded?: boolean }) {
  return (
    <span
      className={cn(
        "absolute top-[17.2px] left-[10px] w-[19px] transition-opacity duration-[400ms] motion-reduce:transition-none",
        dotted ? "caa-dots-h" : "h-[1.6px] bg-black",
      )}
      style={{ opacity: on ? (faded ? 0.4 : 1) : 0 }}
    />
  );
}

const ROW = "relative grid gap-x-2 py-2.5";
const MAIN = "grid-cols-[28px_minmax(0,1fr)]";
const INDENT = "grid-cols-[56px_minmax(0,1fr)]";
/** Centres a node on x=10 (main) or x=38 (indented), 18px below the row top. */
const ON_AXIS = "relative z-[1] mt-[-1.5px] ml-[0.5px]";
const INDENTED = "relative z-[1] mt-[-1.5px] ml-[28.5px]";

const AxisNarrow = memo(function AxisNarrow({ data, step, system, planDuring, className }: DrawProps) {
  const n = data.events.length;
  const hung = step >= n + 1;
  const delivered = step >= n + 2;
  // In list order: after the last moment, before the hang-up — still in
  // the call, as on the wide drawing.
  const writtenOn = planDuring && step >= n;
  const slack = data.after.filter((a) => a.kind !== "built");
  const built = data.after.filter((a) => a.kind === "built");
  const land = (on: boolean) => (on ? "ind-land" : "invisible");
  // Dimming goes on a row's own marks (glyph) and words (ink), never on
  // the row: the axis stretch running through it belongs to the whole call.
  const writtenFaded = dim(system, writtenSystems(data));
  const deliveryFaded = dim(system, deliverySystems(data));

  return (
    <ol className={className}>
      {data.events.map((e, i) => {
        const on = step > i;
        const faded = dim(system, e.systems);
        return (
          <li key={e.id} className={cn(ROW, MAIN)}>
            {/* The last moment's stretch runs on past the plan-check row to
                the hang-up in 440ms — the time the playback has left. */}
            <Stretch on={on} ms={i === n - 1 ? 220 : 760} />
            <Node state={on ? "ink" : "hollow"} className={cn(ON_AXIS, glyph(faded))} />
            <div key={on ? "on" : "off"} className={land(on)}>
              <p className="flex flex-wrap items-baseline gap-x-2 leading-4">
                <span className="text-[11px] text-pp-muted tabular-nums">{e.at}</span>
                <ToolName tool={e.tool} className={ink(faded)} />
              </p>
              <p className={cn("mt-0.5 text-[13px] leading-[18px]", ink(faded))}>{e.effect}</p>
            </div>
          </li>
        );
      })}

      {/* Always laid out; only its marks fade, so the list never changes height. */}
      <li className={cn(ROW, INDENT)}>
        <Stretch on={step >= n} ms={220} delay={220} />
        <Stub on={writtenOn} dotted faded={writtenFaded} />
        <Node
          state="violet-hollow"
          className={cn(
            INDENTED,
            "transition-opacity duration-[400ms] motion-reduce:transition-none",
            !writtenOn ? "opacity-0" : writtenFaded && "opacity-40",
          )}
        />
        <div className={cn("transition-opacity duration-[400ms] motion-reduce:transition-none", !writtenOn && "opacity-0")}>
          <p className={cn("text-[13px] leading-[18px] font-medium", ink(writtenFaded))}>{data.written.label}</p>
          <p className="mt-1 text-[11px] leading-4 tracking-[0.1em] text-pp-accent uppercase">{data.written.badge}</p>
          <p className="mt-1.5 text-[13px] leading-[18px] text-pp-muted">{data.written.sub}</p>
        </div>
      </li>

      <li className={cn(ROW, MAIN)}>
        <Stretch on={hung} ms={360} />
        <Node state={hung ? "ink" : "hollow"} className={ON_AXIS} />
        <div key={hung ? "on" : "off"} className={land(hung)}>
          <p className="text-[11px] leading-4 font-medium tracking-[0.1em] text-pp-ink uppercase">{data.lanes.hungUp}</p>
          <p className="text-[11px] leading-4 tracking-[0.1em] text-pp-muted uppercase">{data.lanes.trigger}</p>
        </div>
      </li>

      {slack.map((a) => {
        const faded = dim(system, a.systems);
        return (
          <li key={a.id} className={cn(ROW, INDENT)}>
            <Stretch on={hung} ms={360} delay={360} />
            <Stub on={delivered} faded={faded} />
            <Node state="ink" className={cn(INDENTED, glyph(faded), !delivered && "opacity-0")} />
            <div key={delivered ? "on" : "off"} className={land(delivered)}>
              <p className="flex flex-wrap gap-x-2 leading-4">
                {"mark" in a && <Mark className={ink(faded)}>{a.mark}</Mark>}
                <Mark className="text-pp-muted">{a.to}</Mark>
              </p>
              <p className={cn("mt-0.5 text-[13px] leading-[18px]", ink(faded))}>{a.effect}</p>
            </div>
          </li>
        );
      })}

      <li className={cn(ROW, MAIN)}>
        {/* From here down the trunk is dotted: the receiving ends are ours. */}
        <Stretch on={delivered} dotted />
        <Node state={delivered ? "ink" : "hollow"} className={cn(ON_AXIS, glyph(deliveryFaded))} />
        <div key={delivered ? "on" : "off"} className={land(delivered)}>
          <p className="leading-4">
            <Mark className={ink(deliveryFaded)}>{data.delivery.mark}</Mark>
          </p>
          <p className={cn("text-[13px] leading-[18px] font-medium", ink(deliveryFaded))}>{data.delivery.label}</p>
          <p className="text-[11px] leading-4 text-pp-muted">{data.delivery.sub}</p>
        </div>
      </li>

      {built.map((a, i) => {
        const faded = dim(system, a.systems);
        return (
          <li key={a.id} className={cn(ROW, INDENT)}>
            {i < built.length - 1 && <Stretch on={delivered} dotted delay={(i + 1) * 80} />}
            <Stub on={delivered} dotted faded={faded} />
            <Node state="violet-hollow" className={cn(INDENTED, glyph(faded), !delivered && "opacity-0")} />
            <div key={delivered ? "on" : "off"} className={land(delivered)} style={{ animationDelay: `${i * 80}ms` }}>
              <p className="leading-4">
                <Mark className="text-pp-muted">{a.to}</Mark>
              </p>
              <p className={cn("mt-0.5 text-[13px] leading-[18px]", ink(faded))}>{a.effect}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
});
