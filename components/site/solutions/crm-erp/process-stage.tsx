"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type RefObject,
} from "react";
import type { gsap as GsapCore } from "gsap";
import { RotateCcw } from "lucide-react";
import type { ProcessView } from "@/lib/pages/crm-erp";
import { cn } from "@/lib/utils";
import { useKitContext, type Kit } from "@/components/site/product/motion-kit";
import { CHIP, ChipRail, RING_LIGHT, RoundButton, Segmented, centreInRail, chipTone, useRovingRadio } from "@/components/site/home/controls";
import { useDocumentVisible, useStageMotion } from "@/components/site/home/motion";
import { TYPE } from "@/components/site/home/type";
import { Stack, fill } from "@/components/site/solutions/custom-ai-agents/parts";
import { ErpTag, HandGlyph } from "./glyphs";
import { ProcessLanes, laneIndex } from "./process-lanes";
import { ProcessList } from "./process-list";
import { CaptionCard, RecordPanel, laneWord } from "./process-panels";
import {
  LAST,
  START,
  arrive,
  frameOf,
  nextStep,
  pad2,
  pickStep,
  stateOf,
  switchView,
  type ProcessState,
  type StageData,
  type StepIndex,
} from "./process-frame";
import { buildBack, buildConsolidate, buildHop, buildTour, letGoOfDwell, placesNow, widthOf, type Comp, type Flight } from "./process-timeline";

/* ------------------------------------------------------------------ *
 * #process — your process, drawn: a sample business's scattered tools
 * (Today) flown into one system laid out as lanes of who does what, and
 * one customer's order followed through eight steps into one record.
 *
 * THE SPINE OF THE PAGE, AND ITS ONLY AUTOPLAY. The first time the stage
 * has the screen it plays the journey once on its own: Today, the eight
 * places the same customer lives, the "Typed again" marks popping where
 * the details are copied by hand; then the tools fly into their lanes,
 * the marks fly into the record's "One customer record" pill, and a dot
 * carries the order from the enquiry to the month's figures, each step
 * arriving in the caption card (who does it, today and in one system,
 * whether it runs here) and in the record window (its screen, the
 * order's status, one more row of the customer's history). It ends where
 * the server's frame began: One system, the figures, every step passed.
 *
 * STATE is three small values (process-frame.ts `ProcessState`): the
 * view, the step, and whether it has arrived. What the drawing, the
 * rail, the caption card and the record panel show is always
 * `frameOf(steps, state)`, so the server's HTML, the reduced-motion page,
 * the still tier, weak hardware, lite before a tap, a step picked by hand
 * and the tour's own arrivals all draw the same frame for the same place.
 * The finished frame is One system, step 08 arrived (`ERP_PROCESS.initial`).
 *
 * TWO COMPOSITIONS OF THE DRAWING, BOTH IN THE HTML (process-lanes.tsx,
 * process-list.tsx), switched by CSS alone (erp-process.css §1), so the
 * server never guesses the width: from lg the lanes, the stage's full
 * width; below lg the list, a pile of papers in Today and eight rows in
 * One system. `wide` (a media query read with useSyncExternalStore, false
 * on the server) only tells the timelines which one to move, and a
 * change rebuilds the tour where it was.
 *
 * THE LAYOUT, per breakpoint (erp-process.css §1): the controls, the
 * rail, then from lg the lanes, the legend (beside them, on a screen
 * 900px tall or less, where the lanes stop at 880px so the whole stage
 * fits a laptop's), and the caption card beside the record panel,
 * stretched to one height; at md the list down the
 * left beside the caption card and the legend, then the record panel
 * across (at the stage's width its window sets the screen beside the
 * history, so neither of its views stands half empty); below md one
 * column: caption, list, legend, record. The DOM runs controls, rail,
 * lanes, list, legend, caption, record, and only the drawing and the
 * legend (which hold no control) move between places, so focus always
 * runs down the screen: controls, rail, the caption's link, the record's
 * hotspot.
 *
 * MOTION is `useStageMotion` (home/motion.ts): GSAP
 * is fetched when the stage comes near, never with reduced motion, and
 * on a lite device only once the reader has tapped or keyed inside the
 * stage. Everything it runs is built in one `useKitContext` callback,
 * rebuilt — and all of it before reverted — whenever the reader's hand
 * (`nonce`), the width class or reduced motion changes: the tour, while
 * one is wanted (`wantRef`), or the hop of a reader's press on the
 * hotspot. The sheets' flight between the views takes the SaaS explorer's
 * capture pattern, measuring no sheet: where each is drawn is noted just
 * before React moves it (`capture`: its place in the view it is leaving,
 * from the geometry, or where a flight cut short had it), and it is flown
 * after the commit, in a layout effect, from there to its new place
 * (`buildConsolidate` into One system, with the marks and the pill;
 * `buildBack` to Today), by transforms alone: no layout box moves, so
 * nothing shifts. The tour plays only while the stage has the
 * screen (the shared 30% rule) or the reader's hand, the tab is visible,
 * the reader hasn't paused it and no focus is held inside the stage; the
 * first view's waits, besides, for 60% of the drawing on show to be on
 * screen (`seen`: the shared rule starts at 30% of the stage, which from
 * md is the heading, the controls and the rail) with its Pause on screen
 * at the same moment (`transportOn`: below md, and on a screen too short
 * for the controls and the drawing at once, the transport floats, sticky
 * at the screen's top while the stage is on it and a tour has a claim on
 * it (`docked`), so the tour it can pause never plays out of its reach;
 * from md on a taller screen, where the controls row can leave the top
 * before the drawing is in, it waits), unless the reader has pressed
 * Play or taken a step. Built with the stage out of sight, it
 * puts the stage back to Today there and then, so the reader arrives at
 * its first frame; built with any of it in sight, where the reader may
 * have seen the finished frame, it takes that back softly as it starts
 * (the lit traces fade, the sheets fly back). React state is set only at
 * arrivals and commits; GSAP draws the travel in between.
 *
 * THE READER'S HAND, and what it does to the tour:
 *   - the View switch flies the sheets to the other view (Today → One
 *     system with the marks' flight and the pill, the consolidation;
 *     back with the marks fading in), focus staying on the switch;
 *   - a step on the rail jumps there in the view on show, arrived at
 *     once, no travel, focus staying on the radio;
 *   - the hotspot (One system only) moves the order on: the dot rides
 *     the one connector into the next step, which arrives; from step 08
 *     it goes back to 01 with no hop. It is one persistent button whose
 *     words change, so focus stays on it. In its place in Today, "One
 *     system →" does the switch's work, and focus goes on to the hotspot,
 *     since the button pressed has gone with Today's panel;
 *   - "Start again" goes back to Today's first frame (the intro), with
 *     the sheets flown back; focus stays on it (a reserved slot from the
 *     first paint, shown once the reader has touched anything);
 *   - the transport: Pause while a tour plays (WCAG 2.2.2), Play while
 *     paused or before one has run (after a step picked in One system,
 *     the journey carries on from the step after it; otherwise from
 *     Today), Play it again once it has ended;
 *   - focus on the switch, the rail, the caption card or the record
 *     panel holds the tour until it leaves (WCAG 2.4.3): the tour never
 *     changes a view or unchecks a radio a reader is on. (The transport
 *     reads Pause while the tour holds: it is waiting, not paused.)
 * Any of the first four ends the first view's autoplay for good
 * (`markInteracted`). Without motion (reduced motion, the still tier,
 * lite before a tap) each lands its frame at once.
 *
 * NOTHING MOVES BY ITSELF. The drawing has a fixed aspect (the lanes)
 * or fixed rows (the list and the pile, 512px each); the caption card,
 * the record panel, its status and its screen are stacks over every
 * variant (process-panels.tsx), the history always eight rows; the
 * legend's tally a stack of its two lines; the controls keep "Start
 * again"'s slot and the transport's. So the stage is the same height
 * before, during and after a tour, and in either view, which is what
 * deferred.tsx reserves.
 *
 * ACCESSIBILITY. The drawing is aria-hidden; the rail, the caption card,
 * the record panel, the legend and the index under the section
 * (process.tsx) carry its meaning in words. The switch and the rail are
 * radio groups with one tab stop and arrow keys. A polite live region
 * speaks what the reader's own changes do — a step picked, the order
 * moved on, a view switched — at once for a click, Enter or Space, and
 * once the keys rest for a walk of arrows; never the tour.
 * ------------------------------------------------------------------ */

type Timeline = ReturnType<(typeof GsapCore)["timeline"]>;

/** The lanes' breakpoint: Tailwind's lg. */
const LG = "(min-width: 64rem)";

function subscribeWide(onChange: () => void) {
  const mq = window.matchMedia(LG);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

const noop = () => () => {};
/** False on the server and while hydrating; true once the island runs in the browser. */
function useHydrated() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

const useIsoLayoutEffect = typeof document !== "undefined" ? useLayoutEffect : useEffect;

/**
 * True while any part of the element is on screen (false on the server),
 * reading the newest entry a callback carries: a fast pass can land two
 * in one callback.
 */
function useOnScreen(ref: RefObject<Element | null>) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      const newest = entries[entries.length - 1];
      if (newest) setOn(newest.isIntersecting);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return on;
}

/** Arrows walking the rail or the switch: the live region speaks this long after the last press (the landing's rest). */
const KEY_REST_MS = 350;

/** How much of the drawing on show must be on screen before the first view's tour plays. */
const SEEN_AT = 0.6;

/** A radio group's arrows (and Home, End) walk; its Enter and Space, and a pointer, arrive as clicks. */
type Via = "pointer" | "arrow";

/**
 * What the live region says: a walk of the rail's or the switch's arrows
 * says its line once the keys rest; everything else at once; a repeat
 * alternates a trailing no-break space so it is heard again; `hush`
 * empties it (the Mobile stage's).
 */
function useLiveLine() {
  const [said, setSaid] = useState("");
  const timer = useRef(0);
  const hush = useCallback(() => {
    window.clearTimeout(timer.current);
    setSaid("");
  }, []);
  const say = useCallback((line: string, via: Via) => {
    window.clearTimeout(timer.current);
    const speak = () => setSaid((prev) => (prev === line ? `${line} ` : line));
    if (via === "arrow") timer.current = window.setTimeout(speak, KEY_REST_MS);
    else speak();
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { said, say, hush };
}

/**
 * What the kit context builds next: the tour, from Today (taking the
 * finished frame back first when it may have been seen), from a step it
 * carries on after, or from wherever the stage is (`here`: a rebuild
 * mid-tour, the window crossing lg); or the hop of a reader's press.
 */
type Want =
  | { kind: "tour"; from: "today" | StepIndex | "here"; rewind: boolean; first: boolean }
  | { kind: "hop"; to: StepIndex };
type Tour = "idle" | "running" | "done";

/** A capture waiting for React's commit: the sheets fly from where it noted them to the view it names. */
type Capture = { to: ProcessView; flight: Flight };

/**
 * Ends a flight where it was going: every sheet at its place for the view
 * it was flying to, its inline transforms taken off (CSS holds the same
 * place), the marks and the pill handed back. A new capture has already
 * noted where the flight had the sheets, so the next one starts there.
 */
function finish(tl: Timeline | null) {
  if (!tl) return;
  tl.progress(1);
  tl.kill();
}

/**
 * A step on the rail. Below lg a chip ("01 Enquiry", 40px drawn, a 44px
 * target) with its dwell track along its foot; from lg a cell of the
 * drawing's column grid: the number and the label over the track, at
 * least 44px tall, the current label in ink. The label is never cut: a
 * reader's own text spacing wraps it, and the cell grows.
 */
const STEP = cn(
  "group relative inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-[13px] leading-5 whitespace-nowrap",
  "before:absolute before:inset-x-0 before:-inset-y-0.5",
  "lg:h-auto lg:min-h-11 lg:min-w-0 lg:flex-col lg:items-stretch lg:justify-end lg:gap-2 lg:rounded-md lg:px-0 lg:pb-1 lg:text-left lg:whitespace-normal lg:before:inset-y-0",
  CHIP.ease,
  RING_LIGHT,
);

export function ProcessStage({ data }: { data: StageData }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const lanesRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const dockRef = useRef<HTMLDivElement>(null);

  const { kit, reduce, playing, paused, setPaused, interacted, markInteracted, tier } = useStageMotion(stageRef, {
    id: "erp-process",
  });
  // Lite and still: every change lands at once, the caption's and the record's words too (no `ind-swap`).
  const swap = tier !== "lite" && tier !== "still";
  const wide = useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(LG).matches,
    () => false,
  );
  const comp: Comp = wide ? "lanes" : "list";
  const onScreen = useOnScreen(stageRef);
  const visible = useDocumentVisible();
  const hydrated = useHydrated();

  const steps = data.steps;
  const [state, setState] = useState<ProcessState>(() => stateOf(steps, data.initial));
  const [tour, setTour] = useState<Tour>("idle");
  const [nonce, setNonce] = useState(0);
  // A press or the tour has changed the frame: the window's screens make their entry from now on, never on the first paint.
  const [entered, setEntered] = useState(false);
  // The view has changed once (a switch, "Start again", the tour): the record panel's view coming in fades up from now on.
  const [switched, setSwitched] = useState(false);
  // Most of the drawing on show has been on screen once: the first view's tour may play.
  const [seen, setSeen] = useState(false);
  // The transport is on screen, clear of the site's header: the first view's tour may start.
  const [transportOn, setTransportOn] = useState(false);
  const { said, say, hush } = useLiveLine();

  const frame = useMemo(() => frameOf(steps, state), [steps, state]);
  // Each step's lane, top to bottom: where its card stands on the lanes, for the flights.
  const laneIdx = useMemo(() => steps.map((s) => laneIndex(data.lanes, s)), [steps, data.lanes]);
  // Where motion is: GSAP here and wanted. Without it, every change lands its frame at once.
  const motion = kit !== null && !reduce;

  // The place the stage is at, for callbacks that outlive a render: the timeline's.
  const stateRef = useRef(state);
  useIsoLayoutEffect(() => {
    stateRef.current = state;
  }, [state]);
  // Focus is on the switch, the rail, the caption card or the record panel: the tour waits there. A ref,
  // not state: focus moving between controls pauses and resumes the timeline, and redraws nothing.
  const heldRef = useRef(false);

  const kitRef = useRef<Kit | null>(null);
  const tlRef = useRef<Timeline | null>(null);
  const flightTl = useRef<Timeline | null>(null);
  const captureRef = useRef<Capture | null>(null);
  // The first view's tour, until the reader takes over or it has played.
  const wantRef = useRef<Want | null>({ kind: "tour", from: "today", rewind: false, first: true });
  const runRef = useRef(false);
  // The switch's last input was a walk of its arrows: its line waits for the keys to rest, as the rail's does.
  // The shared Segmented hands a key and a click to onChange alike, so its wrapper reads the input first.
  const viaKey = useRef(false);

  // Nothing plays while focus is held inside the stage (`heldRef`), nor off
  // the screen by this stage's own look, whatever the page's focus says. The
  // first view's tour waits for the drawing itself (`seen`) and its Pause
  // (`transportOn`) to start; once under way, the shared rules alone. Play,
  // or any step the reader takes, starts it at once.
  const free = onScreen && visible && !paused && !reduce && ((playing && (tour !== "idle" || (seen && transportOn))) || interacted);
  const freeRef = useRef(free);
  /** The tour plays while it is free to and no focus holds it. */
  const applyRun = useCallback(() => {
    runRef.current = freeRef.current && !heldRef.current;
    tlRef.current?.paused(!runRef.current);
  }, []);
  useEffect(() => {
    freeRef.current = free;
    applyRun();
  }, [free, applyRun]);
  const setHeld = useCallback(
    (on: boolean) => {
      if (heldRef.current === on) return;
      heldRef.current = on;
      applyRun();
    },
    [applyRun],
  );

  // The first view's cue: most of the drawing on show on screen, now (never
  // latched: with the transport's own, both must hold at the same moment, so
  // the tour never starts with the drawing gone past the screen's foot, as a
  // phone on its side would have it). The composition not on show is
  // display:none and never intersects.
  useEffect(() => {
    const els = [lanesRef.current, listRef.current].filter((e): e is HTMLDivElement => e !== null);
    if (els.length === 0) return;
    const on = new Map<Element, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) on.set(e.target, e.isIntersecting && e.intersectionRatio >= SEEN_AT - 0.01);
        setSeen([...on.values()].some(Boolean));
      },
      { threshold: [0, SEEN_AT] },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // The transport on screen, below the site's header (about 56–66px), whole: the first view's tour may start.
  useEffect(() => {
    const el = dockRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        const newest = entries[entries.length - 1];
        if (newest) setTransportOn(newest.isIntersecting && newest.intersectionRatio > 0.99);
      },
      { rootMargin: "-64px 0px 0px 0px", threshold: [0, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /**
   * Notes where every sheet is drawn before React moves them to `to`, for
   * the flight after the commit: from the geometry, measuring none (a
   * flight cut short gives where it had them). Only where motion is:
   * without it the view changes at once, and nothing is left captured.
   * Weak hardware (`<html data-weak>`, and ?tier=lite) is without it too,
   * though a tap has fetched GSAP: the drawing's sheet pins every fade the
   * flight's faces and connectors cross by (erp-drawing.css §7), so the
   * view lands at once there, the tour's consolidation and take-back too.
   */
  const capture = (to: ProcessView) => {
    const k = kitRef.current;
    const root = stageRef.current;
    if (!k || !root || reduce || document.documentElement.hasAttribute("data-weak")) {
      captureRef.current = null;
      return;
    }
    const width = widthOf(root, comp);
    const flying = flightTl.current?.isActive() ?? false;
    const from = placesNow(k.gsap, root, { comp, view: stateRef.current.view, width, lanes: laneIdx, flying });
    captureRef.current = { to, flight: { comp, width, from, lanes: laneIdx } };
  };

  /** Moves the stage to `next`: the frame is React's from the commit. */
  const go = (next: ProcessState) => {
    stateRef.current = next;
    setState(next);
  };

  useKitContext(
    kit,
    (k) => {
      kitRef.current = k;
      const root = stageRef.current;
      const want = wantRef.current;
      if (!root) return;
      const release = () => {
        tlRef.current = null;
        finish(flightTl.current);
        flightTl.current = null;
        letGoOfDwell(root);
      };
      if (reduce) {
        // Reduced motion switched on mid-journey: the step lands where it is.
        if (want) {
          wantRef.current = null;
          setTour("idle");
        }
        if (!stateRef.current.arrived) go(arrive(stateRef.current));
        return release;
      }
      if (!want) {
        // Rebuilt with nothing wanted (a pick, a switch, the window crossing lg
        // under a hop): the step the hop was bringing lands where it is.
        if (!stateRef.current.arrived) go(arrive(stateRef.current));
        return release;
      }

      if (want.kind === "hop") {
        wantRef.current = null;
        const to = want.to;
        const hop = buildHop(k.gsap, root, {
          comp,
          steps,
          to,
          onArrive: () => setState((s) => (s.step === to && !s.arrived ? arrive(s) : s)),
        });
        return () => {
          hop.kill();
          release();
        };
      }

      // The tour. The first view's decides how it takes the frame over: seen
      // (any of the stage on screen, or focus inside it), the finished frame
      // is taken back softly as the tour starts; unseen, the stage goes back
      // to Today now, so the reader arrives at the tour's first frame.
      let { from, rewind } = want;
      if (want.first) {
        const r = root.getBoundingClientRect();
        const inSight = heldRef.current || (r.top < window.innerHeight && r.bottom > 0);
        if (inSight) rewind = stateRef.current.view === "one";
        else {
          go(START);
          rewind = false;
        }
      }
      if (from === "here") {
        // A rebuild mid-tour: carry on from where the stage is, the step on its way landed.
        const s = stateRef.current;
        if (!s.arrived) go(arrive(s));
        from = s.view === "today" || s.step === null ? "today" : s.step;
      }
      const resume = () => {
        wantRef.current = { kind: "tour", from: "here", rewind: false, first: false };
      };
      tlRef.current = buildTour(k.gsap, root, {
        steps,
        comp,
        from,
        rewind,
        intro: data.intro.text,
        onStart: () => setTour("running"),
        onRewind: () => {
          capture("today");
          setEntered(true);
          setSwitched(true);
          go(START);
          resume();
        },
        onToday: () => {
          const s = stateRef.current;
          if (s.view !== "today" || s.step !== null) go(START);
          resume();
        },
        onConsolidate: () => {
          capture("one");
          setEntered(true);
          setSwitched(true);
          go({ view: "one", step: 0, arrived: false });
          resume();
        },
        onEnter: (s) => {
          go({ view: "one", step: s, arrived: false });
          resume();
        },
        onArrive: (s) => {
          setEntered(true);
          setState((x) => (x.step === s && !x.arrived ? arrive(x) : x));
          resume();
        },
        onDone: () => {
          wantRef.current = null;
          setTour("done");
        },
      });
      tlRef.current.paused(!runRef.current);
      return release;
    },
    { scope: stageRef, dependencies: [nonce, comp, reduce], revertOnUpdate: true },
  );

  // The sheets fly to their new places once React has moved them: into one
  // system (with the marks' flight and the pill), or back to Today. The
  // capture is consumed whatever happens, so a stale one is never flown.
  // Declared after the kit context, so a rebuild's revert has run first.
  useIsoLayoutEffect(() => {
    const cap = captureRef.current;
    if (!cap || cap.to !== state.view) return;
    captureRef.current = null;
    const k = kitRef.current;
    const root = stageRef.current;
    if (!k || !root || reduce) return;
    finish(flightTl.current);
    flightTl.current = cap.to === "one" ? buildConsolidate(k, root, cap.flight) : buildBack(k, root, cap.flight);
  }, [state.view, reduce]);

  // Focus is never dropped (WCAG 2.4.3), but should a focused element go
  // with a frame, no blur says so: the hold lets go once focus is no
  // longer inside the stage, so the tour is never left waiting on it.
  useIsoLayoutEffect(() => {
    if (heldRef.current && !stageRef.current?.contains(document.activeElement)) setHeld(false);
  }, [frame]);

  // The rail keeps the current step in sight wherever it scrolls (the rail
  // moves, never the page), as the landing's rails do; from lg it never
  // overflows. Measured only once the stage is on screen: until then the
  // deferred box may not be laid out.
  useEffect(() => {
    const rail = railRef.current;
    if (!onScreen || !rail || rail.scrollWidth <= rail.clientWidth) return;
    const chip = rail.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]');
    if (chip) centreInRail(rail, chip, reduce);
  }, [frame.rail.checked, onScreen, reduce]);

  /* ─── The reader's hand ─────────────────────────────────────────── */

  const viewOf = (v: ProcessView) => data.views.find((x) => x.id === v)?.label ?? v;
  const liveView = (s: ProcessState) => fill(data.liveView, { view: viewOf(s.view), tally: data.tally[s.view] });
  const liveLine = (s: ProcessState) => {
    if (s.step === null) return liveView(s);
    const step = steps[s.step];
    return fill(data.live, {
      n: s.step + 1,
      total: steps.length,
      label: step.label,
      who: laneWord(data, steps[s.step], s.view),
      line: s.view === "today" ? step.today : step.system,
    });
  };

  /** The first view's autoplay hands over for good, and any tour stops where it is; the rebuild that follows reverts it. */
  const takeOver = () => {
    markInteracted();
    tlRef.current?.pause();
    wantRef.current = null;
    setTour("idle");
    setEntered(true);
  };
  const rebuild = () => setNonce((n) => n + 1);

  const switchTo = (v: ProcessView) => {
    const s = stateRef.current;
    if (v === s.view) return;
    takeOver();
    const next = switchView(s, v);
    capture(next.view);
    setSwitched(true);
    go(next);
    rebuild();
    say(liveView(next), viaKey.current ? "arrow" : "pointer");
  };

  const pickRail = (k: StepIndex, via: Via) => {
    takeOver();
    const next = pickStep(stateRef.current, k);
    go(next);
    rebuild();
    say(liveLine(next), via);
  };

  const onGo = () => {
    takeOver();
    const { next, hop } = nextStep(stateRef.current);
    if (hop !== null && motion) {
      go(next);
      wantRef.current = { kind: "hop", to: hop };
    } else go(arrive(next));
    rebuild();
    say(liveLine(arrive(next)), "pointer");
  };

  // Today's way into one system (the record panel's foot): the switch's
  // work, then focus to the hotspot in its place, since the button pressed
  // has gone with Today's panel.
  const toHot = useRef(false);
  const viewOne = () => {
    toHot.current = true;
    switchTo("one");
  };
  useIsoLayoutEffect(() => {
    if (!toHot.current) return;
    toHot.current = false;
    if (state.view === "one") stageRef.current?.querySelector<HTMLElement>('[data-erp-hot="go"]')?.focus({ preventScroll: true });
  }, [state.view]);

  const restart = () => {
    takeOver();
    if (stateRef.current.view !== "today") {
      capture("today");
      setSwitched(true);
    }
    go(START);
    rebuild();
    say(liveView(START), "pointer");
  };

  const transport = () => {
    if (tour === "running") {
      setPaused(!paused);
      return;
    }
    markInteracted();
    hush();
    setPaused(false);
    setTour("running");
    setEntered(true);
    // The first view's tour, built and waiting for its moment: this is it.
    const waiting = tlRef.current;
    if (tour === "idle" && waiting && waiting.progress() === 0 && wantRef.current?.kind === "tour") return;
    // After a step picked in One system, carry on from the step after it; otherwise the whole journey.
    const s = stateRef.current;
    wantRef.current =
      tour === "idle" && s.view === "one" && s.step !== null && s.step < LAST
        ? { kind: "tour", from: s.step, rewind: false, first: false }
        : { kind: "tour", from: "today", rewind: s.view === "one", first: false };
    rebuild();
  };

  /** Focus on the switch, the rail, the caption card or the record panel: the tour waits until it leaves. */
  const holdProps = {
    onFocus: () => setHeld(true),
    onBlur: (e: FocusEvent<HTMLElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget)) setHeld(false);
    },
  };

  /* ─── What the controls and the words show ──────────────────────── */

  const rail = useRovingRadio({
    count: steps.length,
    index: frame.rail.checked ?? -1,
    orientation: "horizontal",
    onChange: (i, via) => pickRail(i as StepIndex, via === "key" ? "arrow" : "pointer"),
  });

  const button =
    tour === "running"
      ? paused
        ? { icon: "play" as const, label: data.transport.play }
        : { icon: "pause" as const, label: data.transport.pause }
      : tour === "done"
        ? { icon: "replay" as const, label: data.transport.replay }
        : { icon: "play" as const, label: data.transport.play };
  // Drawn only where a tour can run: after hydration, and never with reduced motion or the still tier. Its slot is kept.
  const canTour = hydrated && !reduce;
  // A tour has a claim on the screen: the first view's autoplay, awake and waiting for the drawing (never lite
  // before a tap, whose kit waits for it), or a tour under way, paused or not. Only then, on a phone or a short
  // screen, does the transport float at the screen's top (erp-process.css §1); otherwise it keeps its slot.
  const docked = canTour && (tour === "running" || (tour === "idle" && !interacted && kit !== null));
  const viewAt = Math.max(
    0,
    data.views.findIndex((v) => v.id === frame.view),
  );

  return (
    <div className="mt-10 md:mt-12">
      {/* data-view: which composition's places the sheets take, which caption line is in
          ink, which record view shows (erp-drawing.css, erp-process.css). data-entered:
          the frame has changed once, so the window's screens make their entry from now on;
          data-switched: the view has, so the record's view coming in fades up. data-docked:
          a tour has a claim on the screen, so the transport may float (erp-process.css §1). */}
      <div
        ref={stageRef}
        data-view={frame.view}
        data-entered={entered ? "" : undefined}
        data-switched={switched ? "" : undefined}
        data-docked={docked ? "" : undefined}
        className="erp-stage home-stage relative isolate rounded-[28px] p-4 md:p-6 xl:p-8"
      >
        <span aria-hidden className="home-grain" />

        <div className="erp-stage-grid relative">
          {/* The controls: the view, the tag, "Start again" and the transport (erp-process.css §1). */}
          <div className="erp-stage-controls">
            {/* The wrapper reads the input before the switch's own keydown calls
                onChange: a walk of arrows (or Home, End) waits for the keys to rest.
                `erp-switch` edges the thumb and weights the choice (erp.css §5).
                Focus here holds the tour. */}
            <div
              className="erp-stage-switch"
              onKeyDownCapture={(e) => {
                viaKey.current = e.key.startsWith("Arrow") || e.key === "Home" || e.key === "End";
              }}
              onPointerDownCapture={() => {
                viaKey.current = false;
              }}
              {...holdProps}
            >
              {/* Its segments narrow under 390, so the switch and the transport share a 320 phone's line;
                  there a label a reader's own spacing widens (WCAG 1.4.12) wraps inside its segment,
                  which grows, rather than run past the thumb and the track. */}
              <Segmented
                label={data.viewLabel}
                options={data.views}
                value={state.view}
                onChange={switchTo}
                className="erp-switch max-[389px]:[&>button]:h-auto max-[389px]:[&>button]:min-h-9 max-[389px]:[&>button]:px-2.5 max-[389px]:[&>button]:py-1 max-[389px]:[&>button]:leading-4 max-[389px]:[&>button]:whitespace-normal"
              />
            </div>
            <p className={cn(TYPE.mono, "erp-stage-tag text-pretty text-pp-muted")}>{data.tag.replaceAll(" · ", " · ")}</p>
            <button
              type="button"
              onClick={restart}
              className={cn(
                "erp-stage-again relative inline-flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-sm text-pp-ink",
                "transition-[background-color,scale] duration-200 hover:bg-white/70 active:scale-[0.97]",
                RING_LIGHT,
                // Out of sight and out of the tab order until the reader has touched anything, its place kept.
                !interacted && "invisible",
              )}
            >
              <RotateCcw aria-hidden className="size-3.5" strokeWidth={1.75} />
              {data.restart}
            </button>
            {/* The transport's slot in the row: the dock below stands over it (erp-process.css §1). */}
            <span aria-hidden className="erp-stage-play invisible size-10" />
          </div>

          {/* The transport, next in the DOM (so in focus order after "Start again"), in a dock
              over its slot: while a tour has a claim on the screen (`docked`), below md or on a
              short screen, sticky at the screen's top while the stage is on it, so the tour's
              Pause never leaves the reader's reach (erp-process.css §1). Drawn only where a
              tour can run. */}
          <div ref={dockRef} className="erp-stage-dock">
            {canTour && <RoundButton icon={button.icon} label={button.label} onClick={transport} className="erp-stage-transport" />}
          </div>

          {/* The journey: eight radios, one tab stop, arrows pick. One group at every
              width: chips below lg, the drawing's columns from lg. Focus here holds the tour. */}
          <div className="erp-stage-rail min-w-0" {...holdProps}>
            <ChipRail
              label={data.stepsLabel}
              railRef={railRef}
              className="erp-rail lg:grid lg:grid-cols-[11.2%_repeat(8,11.1%)] lg:gap-0 lg:overflow-visible lg:py-0 lg:snap-none lg:[mask-image:none] lg:[-webkit-mask-image:none]"
            >
              {steps.map((s, i) => {
                const on = frame.rail.checked === i;
                const fillState = frame.rail.filled[i] ? (on ? "current" : "passed") : "later";
                return (
                  <button
                    key={s.id}
                    type="button"
                    {...rail.getItemProps(i)}
                    className={cn(
                      STEP,
                      chipTone(on, "stage"),
                      "lg:bg-transparent lg:hover:bg-transparent",
                      on ? "lg:font-medium lg:text-pp-ink" : "lg:text-pp-muted lg:hover:text-pp-ink",
                      i === 0 && "lg:col-start-2",
                    )}
                  >
                    <span className="flex min-w-0 items-baseline gap-1.5 lg:px-0.5">
                      <span className={cn(TYPE.mono, "lg:font-normal lg:text-(--home-violet)", !on && "text-pp-muted")}>{pad2(i + 1)}</span>{" "}
                      <span className="min-w-0 lg:[overflow-wrap:anywhere]">{s.label}</span>
                    </span>
                    {/* The track, the tour's run of the dwell (`data-erp-run`, GSAP's alone:
                        a span no rule scales, so a revert leaves nothing on it), and in it
                        the frame's fill (CSS's `scale`, by state). The two scales multiply. */}
                    <span aria-hidden className="erp-dwell absolute inset-x-3.5 bottom-1.5 block h-0.5 overflow-hidden rounded-full lg:relative lg:inset-auto lg:mr-3">
                      <span data-erp-run={i} className="absolute inset-0 origin-left">
                        <span data-erp-dwell={i} data-state={fillState} className="absolute inset-0 rounded-full" />
                      </span>
                    </span>
                  </button>
                );
              })}
            </ChipRail>
          </div>

          {/* The drawing, twice: CSS shows one (erp-process.css §1). Both aria-hidden: the
              rail, the caption card, the record panel, the legend and the index say it. */}
          <div ref={lanesRef} aria-hidden className="erp-stage-lanes min-w-0">
            <ProcessLanes steps={steps} lanes={data.lanes} handoffs={data.handoffs} marks={data.marks} frame={frame} live={wide} />
          </div>
          <div ref={listRef} aria-hidden className="erp-stage-list min-w-0">
            <ProcessList steps={steps} lanes={data.lanes} handoffs={data.handoffs} marks={data.marks} frame={frame} live={!wide} />
          </div>

          {/* The legend: the tally for the view on show, and the drawing's key. */}
          <div className="erp-stage-legend min-w-0">
            <Stack
              className="erp-tally min-w-0"
              items={data.views}
              live={viewAt}
              swap={swap}
              render={(v) => <p className="text-[14px] leading-5 text-pretty text-pp-ink">{data.tally[v.id]}</p>}
            />
            {/* From lg the key keeps one line beside the tally, which wraps instead. */}
            <p aria-hidden className="erp-key flex flex-wrap items-center gap-x-4 gap-y-2 lg:shrink-0 lg:flex-nowrap">
              <ErpTag kind="does" copy={data.kinds} tone="stage" />
              <ErpTag kind="thin" copy={data.kinds} tone="stage" />
              <ErpTag kind="none" copy={data.kinds} tone="stage" />
              <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-white pr-2.5 pl-2 text-[12px] leading-4 text-(--home-ember-ink) shadow-[0_0_0_1px_rgb(20_10_36/0.08)]">
                <HandGlyph className="text-(--home-ember)" />
                {data.legend.typed}
              </span>
            </p>
          </div>

          {/* The caption card and the record panel. Focus in either holds the tour. */}
          <div className="erp-stage-caption flex min-w-0" {...holdProps}>
            <CaptionCard data={data} frame={frame} swap={swap} className="flex-1" />
          </div>
          <div className="erp-stage-record flex min-w-0" {...holdProps}>
            <RecordPanel data={data} frame={frame} swap={swap} onGo={onGo} onView={viewOne} className="flex-1" />
          </div>
        </div>
      </div>

      {/* Atomic: a repeat that only adds a no-break space is read whole. */}
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {said}
      </p>
    </div>
  );
}
