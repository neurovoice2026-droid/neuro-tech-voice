"use client";

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type RefObject,
} from "react";
import type { gsap as GsapCore } from "gsap";
import type { RunLens, RunLensId, RunNode, RunningData } from "@/lib/pages/custom-automations";
import { cn } from "@/lib/utils";
import { useKitContext, type Kit } from "@/components/site/product/motion-kit";
import { CHIP, ChipRail, RING_LIGHT, RoundButton, centreInRail, useRovingRadio } from "@/components/site/home/controls";
import { useDocumentVisible, useStageMotion } from "@/components/site/home/motion";
import { TYPE, WEIGHT } from "@/components/site/home/type";
import { Stack } from "@/components/site/solutions/custom-ai-agents/parts";
import { CheckLine } from "@/components/site/solutions/custom-saas-platforms/check-line";
import { FlowGlyph, HandGlyph, KindGlyph } from "./glyphs";
import { MeterRow } from "./meter-row";
import { metersOf } from "./meters";
import { useRunRequest, type RunVia } from "./run-bus";
import { FlowList } from "./flow-list";
import { FlowMap } from "./flow-map";
import { ToolLane } from "./tool-lane";
import { blocksOf, currentsOf, fill, frameOf, inspected, lensOf, pad2, stepOfNode, type Phase } from "./workbench-frame";
import { buildTour } from "./workbench-timeline";

/* ------------------------------------------------------------------ *
 * #running — the workbench: the automations this platform runs on, each
 * taken from the steps a person would do by hand to the flow that does
 * them, and a run through it from start to finish.
 *
 * THE SPINE OF THE PAGE, AND ITS ONLY AUTOPLAY. The reader picks one of
 * four automations, simplest first — a customer paying (first, and the
 * one that plays on its own), the morning's jobs, a document added, a
 * call ending — and sees three things in turn: the manual steps across
 * the tools they are done in, the flow built from them block by block,
 * each step handed to the block that replaced it, and a run travelling
 * the flow step by step. Under the drawing, the meters say what makes the
 * lens hard, and the caption says what the drawing shows.
 *
 * STATE is a few small values and a selection: the lens, the phase (by
 * hand, or built), the step (−1 before the run), while the tour builds
 * the flow the blocks laid so far, and the block in the inspector. What
 * the drawing shows is always `frameOf(lens, { phase, step, laid })`
 * (workbench-frame.ts), so the server's HTML, the reduced-motion page,
 * the still tier, weak hardware, lite before a tap, a step picked by
 * hand and the tour's own arrivals all draw the same frame for the same
 * place. The finished frame is "A customer pays", built, on its last
 * step: every manual row reads "now step 01…07", "Marked done" is
 * current, and the pill reads Done.
 *
 * TWO COMPOSITIONS, BOTH IN THE HTML, in one stage: from xl the hand lane
 * of tool windows over the map (ToolLane, FlowMap), below it the list
 * (FlowList), switched by CSS alone, so the server never guesses the
 * width. `wide` (a media query read with useSyncExternalStore, false on
 * the server) only tells the timelines which one to animate, and a
 * change rebuilds the tour where it was.
 *
 * MOTION is `useStageMotion` (home/motion.ts): GSAP is fetched when the
 * stage comes near, never with reduced motion, and on a lite device only
 * once the reader has tapped or keyed inside the stage — or asked for a
 * run from elsewhere on the page. Everything it runs is built in one `useKitContext` callback,
 * rebuilt — and everything before it reverted — whenever the lens, the
 * width class, the reader's hand (`nonce`) or reduced motion changes: the
 * tour, when one is wanted (`wantRef`) — the first view's, until the
 * reader takes over, or one the reader asked for with a pointer pick or
 * the transport. It plays only while the stage has the screen (or the
 * reader's hand), the tab is visible and the reader hasn't paused it.
 * Built with the workbench off the screen, it puts the frame back to by
 * hand there and then; built with any of it in sight, or focus inside it,
 * where the reader may have seen the finished frame or be on it, it takes
 * that frame back softly as it starts (the traces retract, the blocks
 * fade to ghosts). Each arrival
 * is a callback that sets React's state (`onPhase`, `onBuilt`,
 * `onStep`); GSAP only draws the travel in between
 * (workbench-timeline.ts). The Running pill flies between blocks: its
 * box is read just before React moves it; after the commit, in a layout
 * effect, the pill in its new block is set back onto that box by a
 * translate and flown home (0.6s, power3.inOut, the SaaS pill's). One read
 * each side: Flip's measure (the SaaS pill's) forced style and layout at
 * every step, a dropped frame each take-off on a mid-range phone, and its
 * `absolute` emptied the list row's pill slot mid-flight.
 *
 * THE READER'S HAND, and what it does to the tour:
 *   - a lens by pointer: the whole tour of that lens, hand → build →
 *     run; by keys — arrows, Enter or Space — or with no GSAP to play
 *     it: the lens's finished frame, and nothing moves;
 *   - a step: jump to it (built), and the tour stops;
 *   - the transport: Pause while a tour plays (WCAG 2.2.2), Play it while
 *     paused or before one has started (after a step picked by hand, the
 *     run carries on from there), Play it again once done;
 *   - a block (a card on the map, a row in the list): the inspector holds
 *     it, and where the inspector is below the screen, the page scrolls
 *     just far enough to show it, so a pick is never a tap that seems to
 *     do nothing;
 *   - focus on a control inside the caption card, the run log or the
 *     inspector: the tour holds there until focus leaves, so it never
 *     swaps a focused link away (WCAG 2.4.3), nor checks and unchecks the
 *     step radio a screen reader is on, moving the log's tab stop under
 *     it; the reader's hand inside the inspector — a focus, a click —
 *     also holds the block it shows. (The transport still reads Pause
 *     while the tour holds: it is waiting, not paused.) The inspector's
 *     heading is a focus target, not a control: a block picked while
 *     focus is on a link in the inspector moves it there before the
 *     link goes, and focus there never holds the tour.
 * A lens, a step or a block picked ends the first view's autoplay for
 * good (`markInteracted`); a first-view tour still waiting to play is
 * dropped with it, and the frame is the finished one.
 *
 * THE INSPECTOR FOLLOWS THE DRAWING from md, where it stands beside the
 * run log, sticky under the header: it shows the block the run is on (or,
 * before the first hop, the block it is about to reach), and the
 * reader's pick once there is one. Below md it sits under the log, and
 * does not follow a tour: while one plays it holds the lens's last block,
 * so nothing below it moves by itself, and its line says that is what it
 * shows; once none plays it follows the step the reader chose, by
 * pointer or by key, as it does from md, so a keyboard reader can bring
 * any block of the run into it (workbench-frame.ts `inspected`).
 *
 * WHAT MAY MOVE, and why nothing does by itself. The caption is a stack
 * over every line of the live lens (its two phase lines and each step's
 * caption), as tall as the longest; the meters' row keeps its height
 * whatever it says; the list is as tall as its lens whatever the tour has
 * reached; the map is a box of its lens's proportions (as many rows as
 * the lens uses, workbench-geometry.ts `viewH`), fixed while the lens
 * is, and the lane's "now step" lines keep their room; from md the run
 * log is taller than the inspector's longest block, so the sticky
 * inspector never moves the page (the measure pass checks it at every
 * width); below md the inspector changes only on the reader's own step,
 * block or lens, and its line (three laid over each other) never
 * changes height. A lens changes only by
 * the reader's own click or key, which the layout-shift score excuses,
 * and the rail that changes it sits above the stage.
 *
 * "WATCH IT RUN" from elsewhere on the page (#work's legend) arrives
 * through run-bus.ts, with how the link was pressed: a pointer's click
 * picks the lens as a pointer on its chip does — its whole tour plays,
 * once the stage has the screen — Enter or Space as those keys do — its
 * finished frame, nothing plays — the stage comes up under the header,
 * focus moves to the lens's chip, and one more look after 400ms catches
 * a content-visibility box above that landed the scroll short. The
 * hero's links here ("Watch one run") are plain jumps while the first
 * view's tour is still to play; once it has played, or the reader has
 * taken over, a click on one is taken over the same way, for the lens on
 * the stage (`onHeroClick`).
 *
 * ACCESSIBILITY. The map and the list are aria-hidden; the keyboard's and
 * the screen reader's path is the hand lane (real text, xl), the run log,
 * the inspector, and the index under the section (running.tsx). The
 * lenses and the steps are radio groups with one tab stop and arrow
 * keys. A polite live region speaks what the reader's own choices change
 * — a step, a lens by key — and never the tour, which would talk over
 * everything; arrows walking the lenses or the steps say theirs once the
 * keys rest, so a walk is one line. Focus is never dropped: a lens
 * change keeps it on its chip, and nothing that holds focus is ever
 * unmounted by the tour.
 * ------------------------------------------------------------------ */

type Timeline = ReturnType<(typeof GsapCore)["timeline"]>;
type Tween = ReturnType<(typeof GsapCore)["fromTo"]>;

/** What the workbench is handed: everything #running's data holds but the ledger, which the server draws. */
export type WorkbenchData = Omit<RunningData, "ledger">;

/** The map composition's breakpoint: Tailwind's xl. */
const XL = "(min-width: 80rem)";
/** Tailwind's md: from here the inspector stands beside the run log, and follows the drawing. */
const MD = "(min-width: 48rem)";

/** One subscription per query, made once, so React never resubscribes between renders. */
const subscribers = new Map<string, (onChange: () => void) => () => void>();
function subscribeTo(query: string) {
  let subscribe = subscribers.get(query);
  if (!subscribe) {
    subscribe = (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    };
    subscribers.set(query, subscribe);
  }
  return subscribe;
}

/** A media query's answer: false on the server and while hydrating, so the first client render agrees. */
function useMedia(query: string) {
  return useSyncExternalStore(
    subscribeTo(query),
    () => window.matchMedia(query).matches,
    () => false,
  );
}

const useIsoLayoutEffect = typeof document !== "undefined" ? useLayoutEffect : useEffect;

/**
 * True while any part of the element is on screen (false on the server):
 * product/timing.ts's `useInView`, reading the newest entry a callback
 * carries rather than the first. A fast pass over the stage — a smooth
 * jump, a fling, PageDown pressed quickly — can land two in one callback,
 * the first still on screen and the last off it, and the first alone
 * would keep the stage "on screen" until the reader came back to it.
 * (home/motion.ts `useStageFocus` reads the first entry too, and so can
 * leave this stage focused after it has gone: the tour checks this hook
 * as well, never `playing` alone.)
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

/** A tour to build the next time the kit context runs: which lens, and from where — the top (by hand), or a step. */
type Want = { lens: RunLensId; from: "hand" | number };
type Tour = "idle" | "running" | "done";

/** A step row in the run log: its number, and the step's short title. */
const STEP_ROW = "grid w-full grid-cols-[28px_minmax(0,1fr)] items-baseline gap-x-2 rounded-xl px-3 py-[13px] text-left";

/**
 * The checked step row: the wash, and an electric hairline inside its
 * edge (5.21 on the wash, 5.70 on white), so the row the run is on reads
 * by a shape as well as a tint — the wash alone is 1.09 against the page,
 * and a hovered row draws almost the same tint. Inset, so it follows the
 * row's corners and never meets the focus ring, an ink outline 2px out;
 * the same electric edge the list's current row wears. (SPEC §5 and the
 * SaaS explorer's log mark it with the tint alone.)
 */
const STEP_ON = "bg-(--home-wash) shadow-[inset_0_0_0_1px_var(--home-electric)]";

/** A lens chip on white: the landing's chip colours, a 44px target round a 36px pill. */
const LENS_CHIP = cn(
  "relative h-9 cursor-pointer rounded-full px-4 text-[13px] leading-5 whitespace-nowrap",
  "before:absolute before:inset-x-0 before:-inset-y-1",
  CHIP.ease,
  RING_LIGHT,
);

/** The lens rail: a scroller below md (to the screen's edges, the chosen chip centred), wrapping from md, one row from lg. */
const LENS_RAIL = "min-w-0 flex-1 max-md:mr-0 max-md:pr-1 md:flex-wrap md:overflow-visible md:snap-none";

/** How much of the inspector a pick brings on screen: all of it, up to half the screen. */
const INSPECTOR_SHOWN = 0.5;

/** Arrows walking the lenses or the steps: the live region speaks this long after the last press (the landing's rest). */
const KEY_REST_MS = 350;

/**
 * How a choice arrived: a pointer; one key (Enter or Space, which arrive
 * as clicks with none counted, or a request from elsewhere on the page);
 * or the arrows (Home, End) walking a radio group, a stop per press.
 */
type Via = "pointer" | "key" | "arrow";

/** A radio group's own keys are its arrows, Home and End: a walk. Its Enter and Space arrive as clicks. */
const walked = (via: "key" | "pointer"): Via => (via === "key" ? "arrow" : via);

/**
 * What the live region says. Arrows walking the lenses or the steps say
 * their line once the keys rest, so a walk is one line; everything else
 * at once; and every line, or `hush`, drops one still waiting, so an old
 * walk's line never lands after a newer choice (the SaaS explorer's).
 */
function useLiveLine() {
  const [said, setSaid] = useState("");
  const timer = useRef(0);
  // Hushed, the region empties (an emptied polite region says nothing), so
  // the next line is a change and is spoken, even the one it last held.
  const hush = useCallback(() => {
    window.clearTimeout(timer.current);
    setSaid("");
  }, []);
  // A line the region already holds would change nothing in it and never be
  // spoken: a repeat alternates a trailing no-break space, so the same
  // choice made again (a step, a block picked, the step again) is heard.
  const say = useCallback((line: string, via?: Via) => {
    window.clearTimeout(timer.current);
    const speak = () => setSaid((prev) => (prev === line ? `${line}\u00a0` : line));
    if (via === "arrow") timer.current = window.setTimeout(speak, KEY_REST_MS);
    else speak();
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { said, say, hush };
}

export function Workbench({ data }: { data: WorkbenchData }) {
  const benchRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const blockColRef = useRef<HTMLDivElement>(null);
  const inspectorRef = useRef<HTMLHeadingElement>(null);

  const { kit, reduce, tier, playing, paused, setPaused, interacted, markInteracted } = useStageMotion(stageRef, {
    id: "running",
  });
  const wide = useMedia(XL);
  const md = useMedia(MD);
  const onScreen = useOnScreen(stageRef);
  const visible = useDocumentVisible();

  const ids = useMemo(() => data.lenses.map((l) => l.id), [data.lenses]);
  const initial = lensOf(data, data.initial);
  const [lensId, setLensId] = useState<RunLensId>(data.initial);
  const [phase, setPhase] = useState<Phase>("built");
  const [step, setStep] = useState(initial.steps.length - 1);
  // The blocks laid while the tour builds the flow; null: every block.
  const [laid, setLaid] = useState<ReadonlySet<string> | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [tour, setTour] = useState<Tour>("idle");
  const [nonce, setNonce] = useState(0);
  // Focus is inside the caption card, the run log or the inspector: the tour waits there.
  const [held, setHeld] = useState(false);
  const { said, say, hush } = useLiveLine();

  const lens = lensOf(data, lensId);
  const last = lens.steps.length - 1;
  const frame = useMemo(() => frameOf(lens, { phase, step, laid }), [lens, phase, step, laid]);
  const meters = useMemo(() => metersOf(blocksOf(lens)), [lens]);
  const touring = tour === "running";
  /** What the inspector shows: the reader's pick, or the block the drawing is on (below md, the last while a tour plays). */
  const shown = useMemo(() => inspected(lens, { pick, frame, md, touring }), [lens, pick, frame, md, touring]);

  const kitRef = useRef<Kit | null>(null);
  const tlRef = useRef<Timeline | null>(null);
  // The first view's tour, until the reader takes over or it has played.
  const wantRef = useRef<Want | null>({ lens: data.initial, from: "hand" });
  const runRef = useRef(false);
  const wideRef = useRef(wide);
  // The Running pill's box before a step moves it (null: there was none), and its flight.
  const pillFrom = useRef<{ box: DOMRect | null; selector: string } | null>(null);
  const pillTween = useRef<Tween | null>(null);

  // An explicit pick plays even while another stage would hold the focus;
  // nothing plays while focus is inside the caption card, the run log or
  // the inspector, nor off the screen by this stage's own look, whatever
  // the page's focus says (useOnScreen).
  const run = !held && onScreen && visible && !paused && !reduce && (playing || interacted);

  const syncTour = useCallback(() => {
    tlRef.current?.paused(!runRef.current);
  }, []);

  useEffect(() => {
    runRef.current = run;
    syncTour();
  }, [run, syncTour]);

  useEffect(() => {
    wideRef.current = wide;
  }, [wide]);

  /** Reads the Running pill's box before React moves it — where it is seen, mid-flight too — for its flight after the commit. */
  const capturePill = useCallback(() => {
    const root = stageRef.current;
    if (!kitRef.current || !root) return;
    const selector = `[data-view="${wideRef.current ? "map" : "list"}"] .auto-pill`;
    pillFrom.current = { box: root.querySelector(selector)?.getBoundingClientRect() ?? null, selector };
  }, []);

  useKitContext(
    kit,
    (k) => {
      kitRef.current = k;
      const root = stageRef.current;
      const want = wantRef.current;
      if (!root) return;
      if (reduce) {
        // Reduced motion switched on mid-tour: the frame settles where it
        // can be read — built, on the step it had reached or the last.
        if (want) {
          wantRef.current = null;
          setPhase("built");
          setLaid(null);
          setStep((s) => (s < 0 ? lensOf(data, lensId).steps.length - 1 : s));
          setTour("idle");
        }
        return;
      }
      if (!want || want.lens !== lensId) return;
      // Seen: any of the workbench on screen — the stage, the caption card,
      // the run log, the inspector — or focus inside it (`held`, read fresh:
      // the kit's arrival renders with it), so a frame the reader can see,
      // or is on, is never swapped out from under them. Out of sight the
      // frame goes back to by hand now, so the reader arrives at the tour's
      // first frame; in sight the tour takes the frame back softly as it
      // starts, which it does only once focus has left (`run`).
      const r = (benchRef.current ?? root).getBoundingClientRect();
      const seen = held || (r.top < window.innerHeight && r.bottom > 0);
      if (want.from === "hand" && !seen) {
        setPhase("hand");
        setStep(-1);
        setLaid(null);
      }
      const id = want.lens;
      tlRef.current = buildTour(k.gsap, root, {
        lens: lensOf(data, id),
        wide,
        from: want.from,
        clear: want.from === "hand" && seen && phase !== "hand",
        onStart: () => setTour("running"),
        onPhase: (p) => {
          setPhase(p);
          setStep(-1);
          setLaid(p === "built" ? new Set<string>() : null);
        },
        onBuilt: (block) => setLaid((prev) => new Set(prev ?? []).add(block)),
        onStep: (i) => {
          // A rebuild (the window crossing xl) carries on from the next step.
          if (i >= 0) wantRef.current = { lens: id, from: i + 1 };
          capturePill();
          setLaid(null);
          setStep(i);
        },
        onDone: () => {
          wantRef.current = null;
          setTour("done");
        },
      });
      syncTour();

      return () => {
        tlRef.current = null;
        // The discs in flight are GSAP's own copies: nothing of them outlives the tour.
        root.querySelector("[data-auto-fly]")?.replaceChildren();
        pillTween.current?.revert();
        pillTween.current = null;
      };
    },
    { scope: stageRef, dependencies: [lensId, wide, nonce, reduce], revertOnUpdate: true },
  );

  // The Running pill flies to its new block once React has moved it: set
  // back by a translate onto the box it left, then home, so the one read
  // after the commit is the new box. The capture is consumed whatever
  // happens, so a stale one is never flown.
  useIsoLayoutEffect(() => {
    const capture = pillFrom.current;
    pillFrom.current = null;
    const k = kitRef.current;
    const root = stageRef.current;
    if (!capture || !k || !root || reduce) return;
    // A flight still under way lets go first: the box read was where it was seen.
    pillTween.current?.revert();
    pillTween.current = null;
    const pill = root.querySelector<HTMLElement>(capture.selector);
    if (!pill) return;
    const from = capture.box;
    if (!from) {
      // The run's first block has nowhere to fly from: the pill grows in place.
      pillTween.current = k.gsap.fromTo(
        pill,
        { scale: 0.5 },
        { scale: 1, duration: 0.4, ease: "power3.out", clearProps: "transform" },
      );
      return;
    }
    const now = pill.getBoundingClientRect();
    pillTween.current = k.gsap.fromTo(
      pill,
      { x: from.left - now.left, y: from.top - now.top },
      { x: 0, y: 0, duration: 0.6, ease: "power3.inOut", clearProps: "transform" },
    );
  }, [frame, reduce]);

  // The rail keeps the chosen lens in sight wherever it scrolls (the rail
  // moves, never the page). Measured only once the stage is on screen:
  // until then the deferred box may not be laid out.
  useEffect(() => {
    const rail = railRef.current;
    if (!onScreen || !rail) return;
    const chip = rail.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]');
    if (chip && rail.scrollWidth > rail.clientWidth) centreInRail(rail, chip, reduce);
  }, [lensId, onScreen, reduce]);

  /* ─── The reader's hand ─────────────────────────────────────────── */

  const stepLine = (i: number) => fill(data.live, { n: i + 1, total: lens.steps.length, text: lens.steps[i].caption });

  /**
   * The first view's autoplay hands over for good. A first-view tour
   * that is built but hasn't started (it may have put the frame back to
   * by hand, out of sight) is dropped, and the finished frame returns.
   */
  const takeOver = () => {
    markInteracted();
    if (tour === "running" || !wantRef.current) return;
    wantRef.current = null;
    setPhase("built");
    setLaid(null);
    setStep((s) => (s < 0 ? last : s));
    setNonce((n) => n + 1);
  };

  const pickLens = (id: RunLensId, via: Via) => {
    markInteracted();
    wantRef.current = null;
    setPick(null);
    setLensId(id);
    setNonce((n) => n + 1);
    if (via === "pointer" && kit && !reduce) {
      // The tour plays, from by hand, and says nothing. A new lens is drawn
      // by hand at once; the lens on screen is taken back softly by the tour.
      hush();
      wantRef.current = { lens: id, from: "hand" };
      if (id !== lensId) {
        setPhase("hand");
        setStep(-1);
        setLaid(null);
      }
      setTour("running");
      setPaused(false);
      return;
    }
    const next = lensOf(data, id);
    setPhase("built");
    setLaid(null);
    setStep(next.steps.length - 1);
    setTour("idle");
    say(fill(data.liveLens, { label: next.label, total: next.steps.length, blocks: metersOf(blocksOf(next)).blocks }), via);
  };

  const pickStep = (i: number, via: Via) => {
    markInteracted();
    wantRef.current = null;
    setPick(null);
    setPhase("built");
    setLaid(null);
    setStep(i);
    setTour("idle");
    setNonce((n) => n + 1);
    say(stepLine(i), via);
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
    // The first view's tour, built and waiting for its moment: this is it.
    const waiting = tlRef.current;
    if (tour === "idle" && waiting && waiting.progress() === 0 && wantRef.current) return;
    // After a step picked by hand, carry on from there; otherwise from the top.
    const resume = tour === "idle" && phase === "built" && step >= 0 && step < last;
    wantRef.current = { lens: lensId, from: resume ? step + 1 : "hand" };
    setNonce((n) => n + 1);
  };

  /**
   * A block picked on the map or in the list: the inspector holds it. It
   * sits under the stage (below md under the run log too), often below
   * the screen: then the page scrolls just far enough to show it — all of
   * it, or half a screen of it — so a pick is never a tap that seems to
   * do nothing. The cards and rows are aria-hidden, so focus stays put.
   */
  const pickBlock = (id: string) => {
    takeOver();
    // Focus on a link in the inspector's block (a check's, say: Tab, a
    // modified click, a right-click put it there) would go down with the
    // block the pick swaps out, to <body>, and its blur, fired inside
    // React's commit, never reaches the hold, which would keep the tour
    // waiting for good: it moves to the inspector's heading first.
    const col = blockColRef.current;
    const heading = inspectorRef.current;
    const active = document.activeElement;
    if (id !== shown && col && heading && active !== heading && col.contains(active)) {
      heading.focus({ preventScroll: true });
    }
    setPick(id);
    requestAnimationFrame(() => {
      if (!col) return;
      const r = col.getBoundingClientRect();
      const by = r.top + Math.min(r.height, window.innerHeight * INSPECTOR_SHOWN) - window.innerHeight;
      if (by > 0) window.scrollBy({ top: by, behavior: reduce ? "instant" : "smooth" });
    });
  };

  /** The reader's hand inside the inspector — a focus, a click — holds what it shows. */
  const holdBlock = () => setPick((p) => p ?? shown);

  /**
   * Focus on a control inside a block the tour may change: the tour waits
   * until it leaves. The inspector's heading is no control — only where a
   * pick puts focus it would otherwise drop — so focus there (a click on
   * the words, or that move) never holds it: a stray click on a label
   * never stills the page's one autoplay under a button reading Pause.
   */
  const holdProps = {
    onFocus: (e: FocusEvent<HTMLElement>) => setHeld(e.target !== inspectorRef.current),
    onBlur: (e: FocusEvent<HTMLElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget)) setHeld(false);
    },
  };

  /**
   * A lens asked for from elsewhere on the page (#work's "Watch it run"):
   * picked as the link was pressed — a pointer's click plays its tour, as
   * a pointer on its chip does, and says nothing; Enter or Space, reduced
   * motion or the still tier give its finished frame, and the live region
   * says which lens — the stage comes up under the header, and focus moves
   * to the lens's chip. The tour plays once the stage has the screen. With
   * no kit yet (the stage was never near: the reader came to #work by the
   * menu; or a lite device, where nothing inside the stage was tapped —
   * the pick is the go-ahead, and fetches it), the tour waits for it from
   * the finished frame, as the first view's does: a link that says
   * "Watch it run" costs the fetch, and so it runs. (SPEC §5.2 had lite
   * before a tap give the finished frame, to save the fetch; a pick fetches
   * the kit whatever happens, `markInteracted`.) A content-visibility box
   * above may render at its real height mid-scroll: one more look after
   * 400ms.
   */
  const showLens = (id: RunLensId, via: RunVia) => {
    const play = via === "pointer" && !reduce;
    pickLens(id, play ? "pointer" : "key");
    if (play && !kit) wantRef.current = { lens: id, from: "hand" };
    const stage = stageRef.current;
    if (!stage) return;
    const go = () => stage.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    go();
    requestAnimationFrame(() =>
      railRef.current?.querySelectorAll<HTMLElement>('[role="radio"]')[ids.indexOf(id)]?.focus({ preventScroll: true }),
    );
    window.setTimeout(() => {
      // Where scrollIntoView puts it: the page's scroll padding (saas.css §14) plus the stage's margin.
      const at =
        (parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0) +
        parseFloat(getComputedStyle(stage).scrollMarginTop);
      if (Math.abs(stage.getBoundingClientRect().top - at) > 8) go();
    }, 400);
  };

  const request = useRunRequest();
  const onRequest = useEffectEvent((id: RunLensId, via: RunVia) => showLens(id, via));
  useEffect(() => {
    if (!request) return;
    const raf = requestAnimationFrame(() => onRequest(request.id, request.via));
    return () => cancelAnimationFrame(raf);
  }, [request]);

  /**
   * The hero's links here ("Watch one run", "Watch them run", "Running
   * here") are the shared hero's plain jumps, which the shell's Jumps
   * lands. While the first view's tour is still to play, a jump is all
   * they need: the stage arrives, and it plays. Once that tour has played,
   * or the reader has taken over, a jump would land on a still frame under
   * a link that promised a run, so a plain primary click is taken over as
   * a RunLink's is (run-link.tsx): no fragment left, and the lens on the
   * stage shown as the click asked — a pointer's plays its tour, a key's
   * gives its finished frame, focus on its chip. So too a pointer's click
   * on lite before a tap, where the first view's tour would never start.
   * Never with reduced motion: nothing plays, and the jump stands. On the
   * document, so it runs before Jumps' listener on the window, which
   * leaves a click already prevented alone.
   */
  const onHeroClick = useEffectEvent((e: MouseEvent) => {
    if (reduce || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const target = e.target instanceof Element ? e.target : null;
    if (!target?.closest('#top a[href="#running"]')) return;
    const via: RunVia = e.detail === 0 ? "key" : "pointer";
    if (wantRef.current && (kit || tier !== "lite" || via === "key")) return;
    e.preventDefault();
    history.replaceState(null, "", location.pathname + location.search);
    showLens(lensId, via);
  });
  useEffect(() => {
    const onClick = (e: MouseEvent) => onHeroClick(e);
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  /* ─── What the controls and the text blocks show ────────────────── */

  const lensRadio = useRovingRadio({
    count: ids.length,
    index: ids.indexOf(lensId),
    orientation: "horizontal",
    onChange: (i, via) => pickLens(ids[i], walked(via)),
  });
  const stepRadio = useRovingRadio({
    count: lens.steps.length,
    index: phase === "built" ? step : -1,
    orientation: "vertical",
    onChange: (i, via) => pickStep(i, walked(via)),
  });

  // The live lens's lines: its two phases, then each step's caption.
  const captions = useMemo(
    () => [
      { mark: data.phase.hand, text: lens.hand },
      { mark: data.phase.built, text: lens.built },
      ...lens.steps.map((s, i) => ({ mark: fill(data.stepOf, { n: i + 1, total: lens.steps.length }), text: s.caption })),
    ],
    [data.phase, data.stepOf, lens],
  );
  const captionAt = phase === "hand" ? 0 : step < 0 ? 1 : step + 2;
  // The xl strip beside "By itself": where the run is, in a line. Before
  // the flow is built it says so in its own words: "By hand" there would
  // read against the lane's label on the same line, and the lane above and
  // the caption below already say it.
  const strip =
    phase === "hand"
      ? { mark: data.phase.waiting, title: "" }
      : step < 0
        ? { mark: data.phase.built, title: "" }
        : { mark: fill(data.stepOf, { n: pad2(step + 1), total: pad2(lens.steps.length) }), title: lens.steps[step].title };

  const pill = !touring && step === last ? data.pill.done : data.pill.running;
  // The morning lens's step names in the daily route, beside each title from lg: the block each step reaches.
  const cronAt = useMemo(
    () => currentsOf(lens).map((id) => lens.nodes.find((n) => n.id === id)?.cron ?? null),
    [lens],
  );
  const kinds = data.kinds;
  const shownNode = lens.nodes.find((n) => n.id === shown) ?? null;

  const button =
    tour === "running"
      ? paused
        ? { icon: "play" as const, label: data.transport.play }
        : { icon: "pause" as const, label: data.transport.pause }
      : tour === "done"
        ? { icon: "replay" as const, label: data.transport.replay }
        : { icon: "play" as const, label: data.transport.play };

  return (
    <div ref={benchRef} className="mt-10 md:mt-12">
      {/* scroll-mt: "Watch it run" brings the stage up clear of the header. */}
      <div ref={stageRef} className="scroll-mt-8">
        <div className="flex items-center gap-3">
          <ChipRail label={data.lensesAria} railRef={railRef} className={LENS_RAIL}>
            {data.lenses.map((l, i) => (
              <button
                key={l.id}
                type="button"
                {...lensRadio.getItemProps(i)}
                // Enter and Space arrive as clicks with none counted: a key, as the arrows are.
                onClick={(e) => pickLens(l.id, e.detail === 0 ? "key" : "pointer")}
                className={cn(LENS_CHIP, l.id === lensId ? CHIP.on : CHIP.off)}
              >
                {l.label}
              </button>
            ))}
          </ChipRail>
          <RoundButton icon={button.icon} label={button.label} onClick={transport} disabled={reduce} />
        </div>

        {/* data-paused: while a tour waits, what is in flight is hidden, never
            parked over the words the reader stopped to read (auto-running.css §5). */}
        <div
          data-paused={touring && !run ? "" : undefined}
          className="home-stage relative isolate mt-4 rounded-[28px] p-4 max-[359px]:p-3 md:p-6 xl:p-7"
        >
          <span aria-hidden className="home-grain" />

          {/* xl: the hand lane over the map. */}
          <div data-view="map" className="hidden xl:block">
            <div className="flex items-center justify-between gap-6">
              <p className={cn(TYPE.label, "flex items-center gap-2 text-pp-muted")}>
                <span data-auto-hand className="inline-flex">
                  <HandGlyph className="size-3.5 text-(--home-electric)" />
                </span>
                {data.lanes.hand}
              </p>
              <p className={cn(TYPE.label, "text-pp-muted")}>{data.tag}</p>
            </div>
            <ToolLane lens={lens} frame={frame} copy={{ hand: data.lanes.hand, nowStep: data.nowStep }} />
            <div className="mt-5 flex items-center justify-between gap-6">
              <p className={cn(TYPE.label, "flex shrink-0 items-center gap-2 text-pp-muted")}>
                <FlowGlyph className="size-3.5 text-(--home-electric)" />
                {data.lanes.flow}
              </p>
              {/* Where the run is, for the eye on the map; the caption below says it in full.
                  One 18px line, set: the mono mark and the sans title sit on one baseline a
                  pixel apart, so the line would be 19px with a title and 18px without, and
                  the section would move by a pixel while a tour plays. */}
              <p aria-hidden className="flex h-[18px] min-w-0 items-baseline gap-2">
                <span className={cn(TYPE.mono, "shrink-0 text-pp-muted")}>{strip.mark}</span>
                <span className="min-w-0 truncate text-[13px] leading-[18px] text-pp-ink">{strip.title}</span>
              </p>
            </div>
            <FlowMap lens={lens} frame={frame} picked={pick} onPick={pickBlock} copy={{ kinds, pill }} />
          </div>

          {/* Below xl: the list, the same flow with its manual steps under each block. */}
          <div data-view="list" className="xl:hidden">
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
              <p className={cn(TYPE.label, "flex items-center gap-2 text-pp-muted")}>
                <span data-auto-hand className="inline-flex">
                  <HandGlyph className="size-3.5 text-(--home-electric)" />
                </span>
                {data.lanes.hand}
                <span aria-hidden>→</span>
                <FlowGlyph className="size-3.5 text-(--home-electric)" />
                {data.lanes.flow}
              </p>
              {/* Balanced: where it wraps (under 360px), in two halves, not a lone "feed". */}
              <p className={cn(TYPE.label, "text-balance text-pp-muted")}>{data.tag}</p>
            </div>
            <FlowList lens={lens} frame={frame} picked={pick} onPick={pickBlock} copy={{ kinds, pill }} />
          </div>

          {/* Where the discs fly as the flow is built: over the lane and the map alike. */}
          <div aria-hidden data-auto-fly className="pointer-events-none absolute inset-0" />
        </div>

        {/* The meters, then the caption: the live lens's lines laid over each
            other, so the card is as tall as the longest and never moves. */}
        <div
          className="mt-4 rounded-[20px] bg-white p-5 shadow-[0_0_0_1px_rgb(20_10_36/0.08)] md:p-6"
          {...holdProps}
        >
          <MeterRow meters={meters} copy={data.meters} tone="white" />
          <Stack
            className="mt-4 border-t border-pp-rule pt-4"
            items={captions}
            live={captionAt}
            render={(c) => (
              <div>
                <p className={cn(TYPE.mono, "text-pp-muted")}>{c.mark}</p>
                <p className={cn(TYPE.body, "mt-1.5 max-w-[680px] text-pretty text-pp-ink")}>{c.text}</p>
              </div>
            )}
          />
        </div>
      </div>

      {/* From md the block stands beside the run log; up to lg the log takes
          the narrower column, as its titles are short and a block's
          sentences long. Below md the two stack. */}
      <div className="mt-10 grid gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-8 lg:grid-cols-2 lg:gap-12">
        {/* Focus in the log holds the tour: it never checks and unchecks the radio a screen reader is on. */}
        <div className="min-w-0" {...holdProps}>
          <h3 className={cn(TYPE.label, "text-pp-muted")}>{data.logTitle}</h3>
          {/* From md the rows hang 12px into the gutter, so their numbers line
              up with the heading; below md the gutter is 16px, and a checked
              row's edge (STEP_ON) would sit 4px from the screen's: the rows
              keep to the column there, their numbers 12px in. */}
          <div {...stepRadio.groupProps} aria-label={data.logAria} className="mt-3 flex min-w-0 flex-col gap-1 md:-mx-3">
            {lens.steps.map((s, i) => {
              const on = phase === "built" && i === step;
              const done = phase === "built" && i < step;
              return (
                <button
                  key={s.id}
                  type="button"
                  {...stepRadio.getItemProps(i)}
                  className={cn(
                    STEP_ROW,
                    "group cursor-pointer transition-[background-color,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
                    RING_LIGHT,
                    on ? STEP_ON : "hover:bg-(--home-wash)/60",
                  )}
                >
                  <span className="flex items-center gap-[3px]">
                    <span
                      className={cn(
                        TYPE.mono,
                        "transition-colors duration-200",
                        on ? "text-(--home-electric)" : "text-pp-muted group-hover:text-pp-ink",
                      )}
                    >
                      {pad2(i + 1)}
                    </span>
                    <svg
                      aria-hidden
                      viewBox="0 0 10 10"
                      className={cn("auto-log-tick size-2.5 shrink-0 text-(--home-settled)", !done && "invisible")}
                    >
                      <path d="M2 5.2 4.2 7.4 8 3" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="min-w-0 lg:flex lg:flex-wrap lg:items-baseline lg:justify-between lg:gap-x-3 lg:gap-y-0.5">
                    <span className={cn(TYPE.body, "block text-pretty", on ? "text-pp-ink" : "text-pp-ink/80")}>{s.title}</span>
                    {cronAt[i] && (
                      <code className={cn(TYPE.mono, "mt-0.5 hidden min-w-0 truncate text-pp-muted lg:mt-0 lg:block")} translate="no">
                        {cronAt[i]}
                      </code>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          {lens.foot && <p className={cn(TYPE.meta, "mt-4 text-pretty")}>{lens.foot}</p>}
          <CheckLine check={lens.check} kinds={data.checkKinds} tone="white" className="mt-5" />
        </div>

        {/* The block: the one the run is on (below md, the last while a tour plays), or the reader's pick. */}
        <div
          ref={blockColRef}
          className="min-w-0 md:sticky md:top-28 md:self-start"
          onFocusCapture={holdBlock}
          onClickCapture={holdBlock}
          {...holdProps}
        >
          {/* Where a pick puts focus that was on a link in the block it swaps
              out (pickBlock): a target, not a control, so it never holds the tour. */}
          <h3 ref={inspectorRef} tabIndex={-1} className={cn(TYPE.label, "w-fit rounded-sm text-pp-muted", RING_LIGHT)}>
            {data.blockTitle}
            {shownNode && <span className="sr-only">: {shownNode.label}</span>}
          </h3>
          {/* Which it is — the block the run is on; below md, while a tour
              plays, the run's last (a line that exists below md alone); or
              the reader's pick — laid over each other in one reserved line. */}
          <p className="mt-1 grid">
            <span
              className={cn(TYPE.meta, "text-pretty [grid-area:1/1]", pick !== null ? "invisible" : touring && "max-md:invisible")}
            >
              {data.hint}
            </span>
            <span className={cn(TYPE.meta, "text-pretty [grid-area:1/1] md:hidden", (pick !== null || !touring) && "invisible")}>
              {data.hintTour}
            </span>
            <span className={cn(TYPE.meta, "text-pretty [grid-area:1/1]", pick === null && "invisible")}>{data.picked}</span>
          </p>
          {shownNode && <BlockDetail data={data} lens={lens} node={shownNode} />}
        </div>
      </div>

      {/* Atomic: a repeat that only adds a no-break space is read whole. */}
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {said}
      </p>
    </div>
  );
}

/** The inspector's body for one block. */
function BlockDetail({ data, lens, node }: { data: WorkbenchData; lens: RunLens; node: RunNode }) {
  const manual = new Map(lens.manual.map((m, i) => [m.id, { ...m, n: i + 1 }]));
  const at = stepOfNode(lens, node.id);
  const was = (node.was ?? []).flatMap((m) => manual.get(m) ?? []);
  return (
    <div className="mt-4">
      <p className={TYPE.h3} style={{ fontWeight: WEIGHT.h3 }}>
        {node.label}
      </p>
      <p className={cn(TYPE.mono, "mt-1 flex items-center gap-1.5 text-[11px] leading-4 tracking-[0.06em] text-pp-muted uppercase")}>
        <KindGlyph kind={node.kind} className="text-(--home-electric)" />
        {data.kinds[node.kind].tag}
      </p>
      <p className={cn(TYPE.body, "mt-3 text-pretty text-pp-ink")}>{node.detail}</p>
      {/* The manual steps it replaced, under "By hand, this was". A block
          that replaced none says what doing it by hand lacked, and that line
          says "by hand" itself ("By hand, the only record was someone's
          memory."), so it stands without the label, as it does in the list. */}
      {was.length > 0 ? (
        <div className="mt-5">
          <p className={cn(TYPE.label, "text-pp-muted")}>{data.was}</p>
          <ol className="mt-2 flex flex-col gap-1.5">
            {was.map((m) => (
              <li key={m.id} value={m.n} className="grid grid-cols-[24px_minmax(0,1fr)] items-baseline gap-x-1">
                <span aria-hidden className={cn(TYPE.mono, "text-(--home-violet)")}>
                  {pad2(m.n)}
                </span>
                <span className={cn(TYPE.meta, "text-pretty text-pp-ink/80")}>{m.text}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        node.fresh && <p className={cn(TYPE.meta, "mt-5 text-pretty")}>{node.fresh}</p>
      )}
      <p className={cn(TYPE.meta, "mt-4 text-pretty text-pp-ink/80")}>
        {at !== null ? fill(data.onRun, { n: at, total: lens.steps.length }) : data.offRun}
      </p>
      {node.check && <CheckLine check={node.check} kinds={data.checkKinds} tone="white" className="mt-4" />}
      <div className="mt-5">
        <p className={cn(TYPE.label, "text-pp-muted")}>{data.code}</p>
        <ul className="mt-1.5">
          {node.files.map((f) => (
            <li key={f} className={cn(TYPE.mono, "break-all text-pp-muted")} translate="no">
              {f}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
