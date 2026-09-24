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
} from "react";
import type { gsap as GsapCore } from "gsap";
import type {
  DownRow,
  EdgeId,
  ExplorerData,
  LensId,
  Part,
  PartId,
  Step,
  TourLensId,
} from "@/lib/pages/custom-saas-platforms";
import { cn } from "@/lib/utils";
import { useKitContext, type FlipKit } from "@/components/site/product/motion-kit";
import { useInView } from "@/components/site/product/timing";
import { CHIP, ChipRail, RING_LIGHT, RoundButton, centreInRail, useRovingRadio } from "@/components/site/home/controls";
import { useDocumentVisible, useStageMotion } from "@/components/site/home/motion";
import { TYPE, WEIGHT } from "@/components/site/home/type";
import { Stack } from "@/components/site/solutions/custom-ai-agents/parts";
import { CheckLine } from "./check-line";
import { fill, frameOf, lensIds, lensOf, pathsFor, rowOf } from "./explorer-frame";
import { buildDraw, buildTour } from "./explorer-timeline";
import { MapView } from "./map-view";
import { markPartShown, partShown, useLensRequest, usePartRequest } from "./part-bus";
import { StackView } from "./stack-view";
import { Switchboard } from "./switchboard";

/* ------------------------------------------------------------------ *
 * #platform — the explorer: the platform behind this site, drawn from
 * its code, and five ways to watch something go through it.
 *
 * THE SPINE OF THE PAGE, AND ITS ONLY AUTOPLAY. The reader picks
 * something that happens — a business signing up and paying (first, and
 * the one that plays on its own: this page sells platforms), a phone
 * call, a voice provider failing, the morning's jobs — and follows it
 * through the parts that handle it, step by step. The fifth lens, "Take
 * a part down", hands the reader four switches instead of steps, and
 * shows where the next call goes, as the platform's own routing code
 * answered it for all sixteen combinations at build time.
 *
 * STATE is four small values and a selection: the lens, the step, the
 * switches' mask, the part in the inspector. What the drawing shows is
 * always `frameOf(data, { lens, step, mask, down })` (explorer-frame.ts),
 * so the server's HTML, the reduced-motion page, the still tier, lite
 * before a tap, a step picked by hand and the tour's own arrivals all
 * draw the same frame for the same place. The finished frame is the
 * sign-up lens on its last step, SmartBill current, Step 7 of 7.
 *
 * TWO COMPOSITIONS, BOTH IN THE HTML: the map from xl (MapView), the
 * stacked bands below it (StackView), switched by CSS alone, so the
 * server never has to guess the width. `wide` (a media query read with
 * useSyncExternalStore, false on the server) only tells the timelines
 * which one to animate, and a change rebuilds the tour where it was.
 *
 * MOTION is `useStageMotion` (home/motion.ts) with Flip in the kit: GSAP
 * is fetched when the stage comes near, never with reduced motion, and on
 * a lite device only once the reader has tapped or keyed inside the
 * stage or used a control. Everything it runs is built in one
 * `useKitContext` callback, rebuilt — and everything before it reverted —
 * whenever the lens, the width class, the reader's hand (`nonce`) or
 * reduced motion changes:
 *   - the draw (xl, once, only if the drawing is still below the screen
 *     when GSAP arrives — the useLineReveal rule), played when the stage
 *     comes into view;
 *   - the tour, when one is wanted (`wantRef`): the first view's, until
 *     the reader takes over; or one the reader asked for with a pointer
 *     pick or the transport. It plays only while the stage has the
 *     screen (or the reader's hand), the tab is visible and the reader
 *     hasn't paused it, and not before the draw has finished (nor, on
 *     its own, before the inspector has its room: WHAT MAY MOVE). Built
 *     with the drawing still below the screen, it rewinds the frame
 *     there and then; built with the drawing in sight, where the reader
 *     may have seen the finished route, it takes the lit route back
 *     softly as it starts, as the landing's knowledge stage clears its
 *     last answer before the next.
 * Each arrival is `onStep(i)`, which sets the step, so React draws the
 * frame; GSAP only draws the travel in between (explorer-timeline.ts).
 * The Speaking pill changes card by Flip: its box is recorded just
 * before React moves it, and flown after the commit, in a layout effect.
 * In "Take a part down" each switch swaps the route at once (the frame),
 * and with GSAP present the old trace retracts as the new one draws.
 *
 * THE INSPECTOR FOLLOWS THE DRAWING until the reader picks a part: it
 * shows the current part (`shown = part ?? frame.current`, or before
 * the first hop the part the tour is about to reach), so it is never an
 * empty box, and moves with the tour. A pick holds it on that part — and
 * so does the reader's hand inside it (a focus or a click there), so a
 * link or a chip under the reader's finger or focus is never swapped
 * away by the tour. A lens from the rail or a step lets it follow again.
 *
 * THE READER'S HAND, and what it does to the tour:
 *   - a lens by pointer: step 1 at once, and that lens's tour plays;
 *     by keys — arrows, Enter or Space (or with no GSAP to play it): the
 *     lens's last step, its finished frame, and nothing moves;
 *   - a step: jump to it, and the tour stops;
 *   - the transport: Pause while a tour plays (WCAG 2.2.2), Play it
 *     while paused or before one has started, Play it again once done;
 *   - a card or chip: the inspector holds that part; below xl, where the
 *     inspector sits under the caption and the steps, the page scrolls
 *     just far enough to show it;
 *   - a switch: the next call's route, at once;
 *   - focus inside the caption (its check link): the tour holds there
 *     until focus leaves, so the tour never takes a focused link away
 *     (WCAG 2.4.3), as the carousel pattern stops for keyboard focus.
 * Any of the first two, or a switch, ends the first view's autoplay for
 * good (`markInteracted`).
 *
 * "SEE IT ON THE MAP" from elsewhere on the page arrives through
 * part-bus.ts (MapLink), or as a `#part-<id>` fragment on load: the part
 * is selected, its card (or chip) scrolled to the middle of the screen
 * (or higher, just far enough that the inspector's heading shows under
 * it, where the two fit on one screen), where its ring and a one-time
 * pulse mark it, and focus moved to that heading, which names the part,
 * with one more look after 400ms in case a content-visibility box above
 * landed the scroll short. Both defer their state into a frame (never a
 * synchronous setState in an effect).
 *
 * ACCESSIBILITY. The drawing is aria-hidden; the index below it — every
 * part in words, each with "Show it on the drawing" — is the keyboard's
 * and the screen reader's path, with `#part-<id>` anchors that also work
 * with no script at all (the browser opens the <details>). The lenses
 * and the steps are radio groups with one tab stop and arrow keys; the
 * switches are `aria-pressed` toggles. A polite live region speaks what
 * the reader's own choices change — a step, a lens, the next call's
 * route — and never the tour, which would talk over everything.
 *
 * WHAT MAY MOVE. The blocks the tour changes are laid over every variant
 * it can give them, so the tour never moves anything: the caption over
 * the live lens's steps, and the inspector over every part while a tour
 * may still move it. Otherwise the inspector keeps room for the part it
 * shows alone — at rest, paused, or held by the reader. What the reader
 * does changes that room at once; what happens by itself — GSAP
 * arriving and a tour being built, a tour ending — changes it only
 * while the index under it is off the screen (`roomy`), so the index
 * never jumps in front of a reader who did nothing, whichever way they
 * came, and the first view's tour waits for that room before it plays.
 * From lg the inspector stands beside the step list, sticky under the
 * header as the page's other short columns are, and the list is about as
 * tall as its room or taller (13px short of Proxy's, the tallest part,
 * at 1024), so there the room follows at once. The caption, the step list
 * and the switches take only the live lens's height: a lens changes only
 * by the reader's own click or key, which the layout-shift score
 * excuses, the server draws the lens the client starts on, and the rail
 * that changes it sits above the stage. A lens picked from the inspector
 * by key keeps the chip that was pressed where it was, whatever moved
 * above it.
 * ------------------------------------------------------------------ */

type Timeline = ReturnType<(typeof GsapCore)["timeline"]>;
type FlipState = ReturnType<FlipKit["Flip"]["getState"]>;

/** The map composition's breakpoint: Tailwind's xl. */
const XL = "(min-width: 80rem)";
/** Tailwind's lg: from here the inspector stands beside the step list, not under it. */
const LG = "(min-width: 64rem)";

function subscribeWide(onChange: () => void) {
  const mq = window.matchMedia(XL);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

const useIsoLayoutEffect = typeof document !== "undefined" ? useLayoutEffect : useEffect;

/** A tour to build the next time the kit context runs: which lens, and from which step. */
type Want = { lens: TourLensId; from: number };
type Tour = "idle" | "running" | "done";

/** A step row: its number, and the step's short title. */
const STEP_ROW =
  "grid w-full grid-cols-[28px_minmax(0,1fr)] items-baseline gap-x-2 rounded-xl px-3 py-[13px] text-left";

/** A lens chip on white: the landing's chip colours, a 44px target round a 36px pill. */
const LENS_CHIP = cn(
  "relative h-9 cursor-pointer rounded-full px-4 text-[13px] leading-5 whitespace-nowrap",
  "before:absolute before:inset-x-0 before:-inset-y-1",
  CHIP.ease,
  RING_LIGHT,
);

/**
 * The lens rail: a scroller below md (it runs to the screen's edges and
 * centres the chosen chip); two rows from md, where one row would hide the
 * last lens with nothing to scroll it by on a mouse; and from lg one row,
 * its chips a touch tighter until xl so all five fit beside the transport
 * with room for a classic scrollbar.
 */
const LENS_RAIL = "min-w-0 flex-1 max-md:mr-0 max-md:pr-1 md:max-lg:flex-wrap md:max-lg:overflow-visible md:max-lg:snap-none lg:max-xl:gap-1.5";

/** How much of the inspector a pick below xl brings on screen: all of it, up to half the screen. */
const INSPECTOR_SHOWN = 0.5;

/** Room kept under the inspector's heading when "See it on the map" brings it on screen: its focus ring and a breath. */
const HEADING_CLEAR = 24;

export function Explorer({ data, down }: { data: ExplorerData; down: readonly DownRow[] }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const inspectorRef = useRef<HTMLHeadingElement>(null);
  const partColRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef<HTMLDivElement>(null);

  const { kit, reduce, playing, paused, setPaused, interacted, markInteracted } = useStageMotion(stageRef, {
    id: "platform",
    flip: true,
  });
  const wide = useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(XL).matches,
    () => false,
  );
  const onScreen = useInView(stageRef);
  const drawNow = useInView(stageRef, "0px 0px -20% 0px");
  const visible = useDocumentVisible();

  const initial = lensOf(data, data.initial);
  const ids = lensIds(data);
  const [lens, setLens] = useState<LensId>(data.initial);
  const [step, setStep] = useState(initial.steps.length - 1);
  const [mask, setMask] = useState(0);
  const [part, setPart] = useState<PartId | null>(null);
  const [tour, setTour] = useState<Tour>("idle");
  const [nonce, setNonce] = useState(0);
  const [said, setSaid] = useState("");
  // Focus is inside the caption: the tour waits there, so it never unmounts a focused link.
  const [held, setHeld] = useState(false);
  // A tour is built and hasn't ended: it may still move the inspector.
  const [touring, setTouring] = useState(false);
  // `touring`, as the inspector's room follows it: only while the inspector
  // is off the screen — and at once when a tour starts playing.
  const [roomy, setRoomy] = useState(false);

  const frame = useMemo(() => frameOf(data, { lens, step, mask, down }), [data, lens, step, mask, down]);
  const tourLens = lens === "down" ? null : lensOf(data, lens);
  const isDown = tourLens === null;
  // Before the first hop (step −1) the inspector shows the part the tour is about to reach.
  const opening = useMemo(
    () => (lens === "down" ? null : frameOf(data, { lens, step: 0, mask: 0, down }).current),
    [data, lens, down],
  );
  /** What the inspector shows: the reader's pick, or else the part the drawing is on. */
  const shown = part ?? frame.current ?? opening;

  const kitRef = useRef<FlipKit | null>(null);
  const tlRef = useRef<Timeline | null>(null);
  const drawRef = useRef<Timeline | null>(null);
  const drawn = useRef(false);
  // The first view's tour, until the reader takes over or it has played.
  const wantRef = useRef<Want | null>({ lens: data.initial, from: 0 });
  const runRef = useRef(false);
  const flipRef = useRef<{ state: FlipState; selector: string } | null>(null);
  const flipTl = useRef<Timeline | null>(null);
  const prevRoute = useRef<ReadonlySet<EdgeId> | null>(null);
  // A lens chip in the inspector pressed by key: where it was, so it stays there as the list above changes.
  const anchorRef = useRef<{ el: HTMLElement; top: number } | null>(null);

  // An explicit pick plays even while another stage would hold the focus;
  // nothing plays while focus is inside the caption. The first view's tour
  // also waits for the inspector's room (`roomy`), unless the reader holds a
  // part there: below lg, arriving from below with the index still on
  // screen, it starts a scroll later rather than push the index down.
  const run =
    !held && ((playing && (roomy || part !== null)) || (interacted && onScreen && visible && !paused && !reduce));

  /** The tour plays while it may, and never before the drawing has finished assembling. */
  const syncTour = useCallback(() => {
    const tl = tlRef.current;
    if (!tl) return;
    const drawing = drawRef.current !== null && drawRef.current.progress() < 1;
    tl.paused(!runRef.current || drawing);
  }, []);

  useEffect(() => {
    runRef.current = run;
    syncTour();
  }, [run, syncTour]);

  useEffect(() => {
    if (drawNow) drawRef.current?.play();
  }, [drawNow]);

  // The inspector's room for every part follows a tour built or ended by
  // itself only while the index under it is off the screen: growing or
  // shrinking it then would move the index in front of a reader who did
  // nothing — GSAP arriving as they scroll up to the stage from below, or
  // a tour they started ending as they read the part. From lg the list
  // beside it is about as tall as the room, or taller, so it follows at once.
  useEffect(() => {
    const index = indexRef.current;
    if (roomy === touring || !index) return;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || window.matchMedia(LG).matches) setRoomy(touring);
    });
    io.observe(index);
    return () => io.disconnect();
  }, [roomy, touring]);

  /** Records the Speaking pill's box before React moves it, for the Flip after the commit. */
  function captureVoice(atWide: boolean) {
    const k = kitRef.current;
    const root = stageRef.current;
    if (!k || !root) return;
    const selector = `[data-view="${atWide ? "map" : "stack"}"] .saas-voice`;
    flipRef.current = { state: k.Flip.getState(root.querySelectorAll(selector)), selector };
  }

  useKitContext(
    kit,
    (k) => {
      kitRef.current = k;
      const root = stageRef.current;
      const want = wantRef.current;
      const wanted = !!root && !reduce && want !== null && want.lens === lens;
      setTouring(wanted);
      if (!root || reduce) return;
      // The drawing itself, not the rail above it: a stage whose rail is on
      // screen and whose drawing is not has shown the reader nothing yet.
      const view = root.querySelector(`[data-view="${wide ? "map" : "stack"}"]`) ?? root;
      const below = view.getBoundingClientRect().top >= window.innerHeight;

      if (!drawn.current) {
        drawn.current = true;
        if (wide && below) drawRef.current = buildDraw(k.gsap, root, { onComplete: syncTour });
      }

      if (wanted) {
        const id = want.lens;
        tlRef.current = buildTour(k.gsap, root, {
          lens: lensOf(data, id),
          from: want.from,
          wide,
          // In sight, the frame on screen may have been seen: the tour takes its route back softly.
          clear: !below,
          onStart: () => {
            setTour("running");
            // Playing, it has taken its room: kept once it ends, while the reader may be looking.
            setRoomy(true);
          },
          onStep: (i) => {
            // A rebuild (the window crossing xl) carries on from the next step.
            wantRef.current = { lens: id, from: i + 1 };
            setStep(i);
          },
          onVoice: (_v, commit) => {
            captureVoice(wide);
            commit();
          },
          onDone: () => {
            wantRef.current = null;
            setTour("done");
            setTouring(false);
          },
        });
        // Out of sight, the frame goes back to before the first hop now, so
        // the drawing assembles without the finished route on it.
        if (below) setStep(want.from - 1);
        syncTour();
      }

      return () => {
        tlRef.current = null;
        // A draw that never played is owed to the next run, if the stage is still out of sight then.
        if (drawRef.current?.progress() === 0) drawn.current = false;
        drawRef.current = null;
        flipTl.current?.revert();
        flipTl.current = null;
      };
    },
    { scope: stageRef, dependencies: [lens, wide, nonce, reduce], revertOnUpdate: true },
  );

  // The Speaking pill flies to its new card once React has moved it. The
  // capture is consumed whatever happens, so a stale one is never flown.
  useIsoLayoutEffect(() => {
    const capture = flipRef.current;
    flipRef.current = null;
    const k = kitRef.current;
    const root = stageRef.current;
    if (!capture || !k || !root || reduce) return;
    flipTl.current?.revert();
    flipTl.current = k.Flip.from(capture.state, {
      targets: root.querySelectorAll(capture.selector),
      duration: 0.6,
      ease: "power3.inOut",
      absolute: true,
      // The first voice of a call has nowhere to fly from: it grows in place.
      onEnter: (els) => k.gsap.fromTo(els, { scale: 0.5 }, { scale: 1, duration: 0.4, ease: "power3.out" }),
    });
  }, [frame, reduce]);

  // "Take a part down": a switch swaps the route at once; on the map, with
  // GSAP here, the old trace retracts while the new one draws in.
  useIsoLayoutEffect(() => {
    const before = prevRoute.current;
    prevRoute.current = lens === "down" ? frame.traversed : null;
    const k = kitRef.current;
    const map = stageRef.current?.querySelector('[data-view="map"]');
    if (!before || lens !== "down" || !k || !map || !wide || reduce) return;
    const gone = [...before].filter((e) => !frame.traversed.has(e));
    const came = [...frame.traversed].filter((e) => !before.has(e));
    if (gone.length === 0 && came.length === 0) return;
    const traces = (ids: EdgeId[]) => ids.flatMap((id) => [...map.querySelectorAll(`[data-trace="${id}"]`)]);
    const tl = k.gsap.timeline();
    if (gone.length) {
      tl.fromTo(
        traces(gone),
        { opacity: 1, drawSVG: "0% 100%" },
        { drawSVG: "100% 100%", duration: 0.35, ease: "power2.in" },
        0,
      );
    }
    if (came.length) {
      tl.fromTo(
        traces(came),
        { drawSVG: "0% 0%" },
        { drawSVG: "0% 100%", duration: 0.35, ease: "power2.out" },
        gone.length ? 0.2 : 0,
      );
    }
    return () => {
      tl.revert();
    };
  }, [frame, lens, wide, reduce]);

  // A lens pressed by key in the inspector: the caption above it (and below
  // lg the step list) has just changed height, so the page moves by as
  // much, and the chip under the reader's focus stays where it was. Run
  // after every commit, not only a new lens's: the press always commits
  // (pickLens bumps `nonce`), so the anchor is spent by the press that set
  // it — the current lens's own chip included — and never outlives it.
  useIsoLayoutEffect(() => {
    const a = anchorRef.current;
    anchorRef.current = null;
    if (!a || !a.el.isConnected) return;
    const moved = a.el.getBoundingClientRect().top - a.top;
    if (Math.abs(moved) >= 1) window.scrollBy({ top: moved, behavior: "instant" });
  });

  // The rail keeps the chosen lens in sight wherever it scrolls (the rail
  // moves, never the page), as the landing's rails do. Measured only once
  // the stage is on screen: until then the Deferred box may not be laid out.
  useEffect(() => {
    const rail = railRef.current;
    if (!onScreen || !rail) return;
    const chip = rail.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]');
    if (chip && rail.scrollWidth > rail.clientWidth) centreInRail(rail, chip, reduce);
  }, [lens, onScreen, reduce]);

  /* ─── The reader's hand ─────────────────────────────────────────── */

  const stepLine = (id: TourLensId, i: number) => {
    const { steps } = lensOf(data, id);
    return fill(data.live, { n: i + 1, total: steps.length, text: steps[i].text });
  };
  const downLine = (m: number) => {
    const row = rowOf(down, m);
    return fill(data.down.live, { name: data.down.modes[row.mode].name, why: data.down.whys[row.reason] });
  };

  const pickLens = (id: LensId, via: "key" | "pointer") => {
    markInteracted();
    wantRef.current = null;
    setLens(id);
    setNonce((n) => n + 1);
    if (id === "down") {
      setTour("idle");
      setSaid(downLine(mask));
      return;
    }
    const last = lensOf(data, id).steps.length - 1;
    if (via === "pointer" && kit && !reduce) {
      wantRef.current = { lens: id, from: 0 };
      setStep(-1);
      setTour("running");
      setPaused(false);
      return;
    }
    setStep(last);
    setTour("idle");
    setSaid(stepLine(id, last));
  };

  /** A lens from the rail: the inspector follows the drawing again. */
  const pickRail = (i: number, via: "key" | "pointer") => {
    setPart(null);
    pickLens(ids[i], via);
  };

  /**
   * A lens from the inspector's "On these paths": the part stays (the
   * click or focus there has already held it). By pointer the lens plays,
   * so the page brings the stage up to watch it; by key nothing plays, and
   * the chip stays under the reader's focus while the list above changes.
   */
  const pickPathLens = (id: TourLensId, via: "key" | "pointer", chip: HTMLElement) => {
    // The current lens's own chip changes nothing above it: nothing to hold.
    if (via === "key" && id !== lens) anchorRef.current = { el: chip, top: chip.getBoundingClientRect().top };
    pickLens(id, via);
    if (via === "key") return;
    const stage = stageRef.current;
    if (stage && stage.getBoundingClientRect().top < 0) {
      requestAnimationFrame(() => stage.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }));
    }
  };

  const pickStep = (i: number) => {
    if (!tourLens) return;
    markInteracted();
    wantRef.current = null;
    setPart(null);
    setStep(i);
    setTour("idle");
    setNonce((n) => n + 1);
    setSaid(stepLine(tourLens.id, i));
  };

  const last = tourLens ? tourLens.steps.length - 1 : 0;
  const transport = () => {
    if (!tourLens) return;
    if (tour === "running") {
      setPaused(!paused);
      return;
    }
    markInteracted();
    setPaused(false);
    setTour("running");
    // The first view's tour, built and waiting for its moment: this is it.
    const waiting = tlRef.current;
    if (tour === "idle" && waiting && waiting.progress() === 0) return;
    // After a step picked by hand, carry on from there; otherwise from the top.
    wantRef.current = { lens: tourLens.id, from: tour === "idle" && step >= 0 && step < last ? step + 1 : 0 };
    setNonce((n) => n + 1);
  };

  const toggle = (bit: 1 | 2 | 4 | 8) => {
    markInteracted();
    captureVoice(wide);
    const next = mask ^ bit;
    setMask(next);
    setSaid(downLine(next));
  };

  const resetDown = () => {
    captureVoice(wide);
    setMask(0);
    setSaid(downLine(0));
    // The reset hides itself; focus goes to the first switch rather than to nothing.
    rootRef.current?.querySelector<HTMLElement>(".saas-toggle")?.focus();
  };

  /** The part's card or chip in whichever composition is showing (the other one has no box). */
  const cardOf = (id: PartId) =>
    [...(stageRef.current?.querySelectorAll<HTMLElement>(`[data-part="${id}"]`) ?? [])].find(
      (el) => el.getClientRects().length > 0,
    ) ?? null;

  /**
   * Where "See it on the map" puts the page, as a scrollY: the card in the
   * middle of the screen below the page's scroll padding (saas.css §14);
   * or, where the inspector's heading — which takes the focus — would then
   * fall below the screen, higher by just as much, so long as the card's
   * top stays clear of the header. Where the two can't share one screen (a
   * phone, mostly) the card keeps the middle: it is what the link promised.
   */
  const aimAt = (id: PartId) => {
    const card = cardOf(id)?.getBoundingClientRect();
    if (!card) return null;
    const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    let by = card.top + card.height / 2 - (pad + (window.innerHeight - pad) / 2);
    const col = partColRef.current;
    const head = inspectorRef.current;
    if (col && head) {
      // The heading's own place in the page: from lg the column is sticky, and
      // stuck under the header it sits off it. Unstuck it starts at its row's top.
      const at = getComputedStyle(col).position === "sticky" ? col.parentElement : col;
      const top = (at ?? col).getBoundingClientRect().top;
      const bottom = top + head.getBoundingClientRect().bottom - col.getBoundingClientRect().top + HEADING_CLEAR;
      const over = bottom - by - window.innerHeight;
      if (over > 0 && over <= card.top - by - pad) by += over;
    }
    return window.scrollY + by;
  };

  /**
   * "See it on the map": holds the part, brings its card (or chip) into
   * view (`aimAt`) — the drawing, as the words promise, with the pick's
   * ring on it — and moves focus to the inspector's heading, which names
   * the part, so the next Tab is in the part's own words.
   */
  const showPart = (id: PartId) => {
    setPart(id);
    const go = (top: number | null) => {
      if (top !== null) window.scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
    };
    go(aimAt(id));
    requestAnimationFrame(() => inspectorRef.current?.focus({ preventScroll: true }));
    // A content-visibility box above may have rendered at its real height
    // mid-scroll and landed it off its mark: one more look.
    window.setTimeout(() => {
      const top = aimAt(id);
      if (top !== null && Math.abs(top - window.scrollY) > 8) go(top);
    }, 400);
  };

  /**
   * A card or chip picked by pointer: the inspector holds it. The
   * inspector sits under the caption (below lg, under the steps too), so
   * on a phone, a tablet or a short laptop screen it is often below the
   * screen: then the page scrolls just far enough to show it — all of it,
   * or half a screen of it — and a pick is never a tap that seems to do
   * nothing. The cards are aria-hidden, so focus stays put.
   */
  const pickPart = (id: PartId) => {
    setPart(id);
    requestAnimationFrame(() => {
      const col = partColRef.current;
      if (!col) return;
      const r = col.getBoundingClientRect();
      const by = r.top + Math.min(r.height, window.innerHeight * INSPECTOR_SHOWN) - window.innerHeight;
      if (by > 0) window.scrollBy({ top: by, behavior: reduce ? "instant" : "smooth" });
    });
  };

  /** The reader's hand inside the inspector — a focus, a click — holds what it shows. */
  const holdPart = () => setPart((p) => p ?? shown);

  const request = usePartRequest();
  const onRequest = useEffectEvent((id: PartId) => showPart(id));
  useEffect(() => {
    if (!request) return;
    const raf = requestAnimationFrame(() => onRequest(request.id));
    return () => cancelAnimationFrame(raf);
  }, [request]);

  // Arrived on /…#part-<id>: the same, once per history entry. A fragment
  // this entry has already shown (a map link wrote it, or an arrival was
  // served) is passed over, so Back to the entry and a reload keep the
  // reader's place (part-bus.ts `partShown`).
  useEffect(() => {
    const asked = /^#part-([a-z]+)$/.exec(window.location.hash)?.[1];
    const id = data.parts.find((p) => p.id === asked)?.id;
    if (!id || partShown(id)) return;
    const raf = requestAnimationFrame(() => {
      markPartShown(id);
      onRequest(id);
    });
    return () => cancelAnimationFrame(raf);
  }, [data.parts]);

  /**
   * A lens asked for from elsewhere on the page (#checks' "Take a part
   * down"): picked as a key picks it — nothing plays, the tour rests, the
   * live region says where the next call goes — with the inspector back
   * on the drawing. The stage comes up under the nav (and the rail then
   * brings the chip into view, as it does for any lens once the stage is
   * on screen), and focus moves to the lens's own chip, so the next Tab
   * reaches its switches. A content-visibility box above may render at
   * its real height mid-scroll: one more look, as `showPart` takes.
   */
  const showLens = (id: LensId) => {
    setPart(null);
    pickLens(id, "key");
    const stage = stageRef.current;
    if (!stage) return;
    const go = () => stage.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    go();
    requestAnimationFrame(() =>
      railRef.current
        ?.querySelectorAll<HTMLElement>('[role="radio"]')
        [ids.indexOf(id)]?.focus({ preventScroll: true }),
    );
    window.setTimeout(() => {
      // Where scrollIntoView puts it: the page's scroll padding (saas.css §14) plus the stage's margin.
      const at =
        (parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0) +
        parseFloat(getComputedStyle(stage).scrollMarginTop);
      const off = stage.getBoundingClientRect().top - at;
      if (Math.abs(off) > 8) go();
    }, 400);
  };

  const lensRequest = useLensRequest();
  const onLensRequest = useEffectEvent((id: LensId) => showLens(id));
  useEffect(() => {
    if (!lensRequest) return;
    const raf = requestAnimationFrame(() => onLensRequest(lensRequest.id));
    return () => cancelAnimationFrame(raf);
  }, [lensRequest]);

  /* ─── What the controls and the text blocks show ────────────────── */

  const lensLabel = (id: LensId) => (id === "down" ? data.down.label : lensOf(data, id).label);
  const lensRadio = useRovingRadio({
    count: ids.length,
    index: ids.indexOf(lens),
    orientation: "horizontal",
    onChange: (i, via) => pickRail(i, via),
  });

  // In "Take a part down" there is no list; the hook still wants a count.
  const listed = tourLens ?? initial;
  const stepRadio = useRovingRadio({
    count: listed.steps.length,
    index: tourLens ? step : -1,
    orientation: "vertical",
    onChange: (i) => pickStep(i),
  });

  // The live lens's captions: the tour never leaves its lens, and a lens
  // changes only by the reader's hand.
  const captions = useMemo(() => listed.steps.map((s, i) => ({ total: listed.steps.length, s, i })), [listed]);
  const captionAt = Math.min(Math.max(0, step), captions.length - 1);

  // One caption per answer the routing code can give, not per mask.
  const answers = useMemo(() => {
    const seen = new Map<string, DownRow>();
    for (const r of down) if (!seen.has(`${r.mode}:${r.reason}`)) seen.set(`${r.mode}:${r.reason}`, r);
    return [...seen.values()];
  }, [down]);
  const row = frame.row;
  const answerAt = row ? Math.max(0, answers.findIndex((r) => r.mode === row.mode && r.reason === row.reason)) : 0;

  const inspectable = useMemo(() => [...data.parts, null], [data.parts]);
  const partAt = shown ? data.parts.findIndex((p) => p.id === shown) : data.parts.length;
  const shownPart = inspectable[partAt];
  // Room for every part only while a tour may move the inspector (WHAT MAY MOVE).
  const reserveAll = part === null && !paused && (tour === "running" || roomy);

  const button =
    tour === "running"
      ? paused
        ? { icon: "play" as const, label: data.transport.play }
        : { icon: "pause" as const, label: data.transport.pause }
      : tour === "done"
        ? { icon: "replay" as const, label: data.transport.replay }
        : { icon: "play" as const, label: data.transport.play };

  return (
    <div ref={rootRef} className="mt-10 md:mt-12">
      {/* scroll-mt: a lens picked from the inspector brings the stage up clear of the nav. */}
      <div ref={stageRef} className="scroll-mt-8">
        {/* What happens, and the transport, on white above the stage. */}
        <div className="flex items-center gap-3">
          <ChipRail label={data.lensesAria} railRef={railRef} className={LENS_RAIL}>
            {ids.map((id, i) => (
              <button
                key={id}
                type="button"
                {...lensRadio.getItemProps(i)}
                // Enter and Space arrive as clicks with none counted: a key, as the arrows are.
                onClick={(e) => pickRail(i, e.detail === 0 ? "key" : "pointer")}
                className={cn(LENS_CHIP, "lg:max-xl:px-3", id === lens ? CHIP.on : CHIP.off)}
              >
                {lensLabel(id)}
              </button>
            ))}
          </ChipRail>
          <RoundButton icon={button.icon} label={button.label} onClick={transport} disabled={reduce || isDown} />
        </div>

        <MapView data={data} frame={frame} selected={part} onPick={pickPart} />
        <StackView data={data} frame={frame} selected={part} onPick={pickPart} />

        {/* The caption: the step in words, or where the next call goes — the
            live kind alone, over all of its variants (the tour's steps, the
            switches' answers). Focus inside it (a step's check link) holds
            the tour, which would otherwise swap the focused link away. */}
        <div
          className="mt-4 rounded-[20px] bg-white p-5 shadow-[0_0_0_1px_rgb(20_10_36/0.08)] md:p-6"
          onFocus={() => setHeld(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setHeld(false);
          }}
        >
          {tourLens ? (
            <Stack
              key="steps"
              items={captions}
              live={captionAt}
              render={(c) => (
                <div>
                  <p className={cn(TYPE.mono, "text-pp-muted")}>{fill(data.stepOf, { n: c.i + 1, total: c.total })}</p>
                  <p className={cn(TYPE.body, "mt-1.5 max-w-[680px] text-pretty text-pp-ink")}>{c.s.text}</p>
                  {c.s.check && <CheckLine check={c.s.check} kinds={data.kinds} tone="white" className="mt-3" />}
                </div>
              )}
            />
          ) : (
            <Stack
              key="down"
              items={answers}
              live={answerAt}
              render={(r) => (
                // From lg the why stands beside the answer, level with its name, so an
                // answer is hardly taller than a step's caption, and the card changes
                // little as the reader goes between the two.
                <div className="lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-x-10">
                  <div>
                    <p className={cn(TYPE.label, "text-pp-muted")}>{data.down.resultLabel}</p>
                    <p className={cn(TYPE.h3, "mt-1.5")} style={{ fontWeight: WEIGHT.h3 }}>
                      {data.down.modes[r.mode].name}
                    </p>
                    <p className={cn(TYPE.meta, "text-pretty")}>{data.down.modes[r.mode].via}</p>
                  </div>
                  <p className={cn(TYPE.body, "mt-3 max-w-[680px] text-pretty text-pp-ink lg:mt-[26px]")}>
                    {data.down.whys[r.reason]}
                  </p>
                </div>
              )}
            />
          )}
        </div>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:gap-12">
        {/* Every step of the lens, or the switches: only the live one, at its own height. */}
        <div className="min-w-0">
          {tourLens ? (
            <>
              <h3 className={cn(TYPE.label, "text-pp-muted")}>{data.stepsTitle}</h3>
              <div
                {...stepRadio.groupProps}
                aria-label={data.stepsAria}
                className="-mx-3 mt-3 flex min-w-0 flex-col gap-1"
              >
                {tourLens.steps.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    {...stepRadio.getItemProps(i)}
                    className={cn(
                      STEP_ROW,
                      "group cursor-pointer transition-colors duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
                      RING_LIGHT,
                      i === step ? "bg-(--home-wash)" : "hover:bg-(--home-wash)/60",
                    )}
                  >
                    <StepRow n={i} step={s} on={i === step} />
                  </button>
                ))}
              </div>
              {tourLens.foot && <p className={cn(TYPE.meta, "mt-4 text-pretty")}>{tourLens.foot}</p>}
            </>
          ) : (
            <>
              <h3 className={cn(TYPE.label, "text-pp-muted")}>{data.down.label}</h3>
              <div className="mt-3">
                <Switchboard copy={data.down} mask={mask} onToggle={toggle} onReset={resetDown} />
              </div>
            </>
          )}
        </div>

        {/* The part: the one the drawing is on, or the reader's pick. Laid
            over every part while a tour may change it, else over its own
            (`reserveAll`). From lg it stays in sight beside a longer list,
            under the header, as the page's other short columns do. */}
        <div
          ref={partColRef}
          className="min-w-0 lg:sticky lg:top-28 lg:self-start"
          onFocusCapture={holdPart}
          onClickCapture={holdPart}
        >
          {/* Focus lands here from "Show it on the drawing": its name says which part. */}
          <h3 ref={inspectorRef} tabIndex={-1} className={cn(TYPE.label, "w-fit rounded-sm text-pp-muted", RING_LIGHT)}>
            {data.partTitle}
            {shownPart && <span className="sr-only">: {shownPart.label}</span>}
          </h3>
          {/* Which it is — following the drawing, or the reader's pick — in one reserved line. */}
          <p className="mt-1 grid">
            <span className={cn(TYPE.meta, "text-pretty [grid-area:1/1]", part !== null && "invisible")}>{data.hint}</span>
            <span className={cn(TYPE.meta, "text-pretty [grid-area:1/1]", part === null && "invisible")}>{data.picked}</span>
          </p>
          <Stack
            className="mt-4"
            items={inspectable}
            live={partAt}
            // A sizer that isn't reserved renders nothing, so it takes no room.
            render={(p, i) =>
              p && (reserveAll || i === partAt) ? (
                <PartDetail data={data} part={p} lens={lens} onLens={pickPathLens} />
              ) : null
            }
          />
        </div>
      </div>

      {/* Every part in words: the keyboard's and the screen reader's way through
          the drawing, and where a #part-<id> link lands with no script.
          Arriving on /…#part-<id>, the browser opens the <details> for the
          fragment before React hydrates, so its `open` is the browser's, not
          a mismatch: suppressHydrationWarning keeps it (and React leaves the
          row open, which is where the fragment pointed). */}
      <div ref={indexRef} className="home-faq mt-12">
        <details className="group border-y border-pp-rule" suppressHydrationWarning>
          <summary
            className={cn(
              "flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-sm py-3 [&::-webkit-details-marker]:hidden",
              RING_LIGHT,
            )}
          >
            <span className={cn(TYPE.body, "font-medium text-pp-ink")}>
              {fill(data.indexSummary, { n: data.parts.length })}
            </span>
            <span
              aria-hidden
              className="grid size-8 shrink-0 place-items-center rounded-full bg-(--home-chip) text-pp-ink transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-open:rotate-45"
            >
              <svg viewBox="0 0 12 12" fill="none" className="size-3">
                <path d="M6 1.25v9.5M1.25 6h9.5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
              </svg>
            </span>
          </summary>
          <dl className="grid gap-x-12 gap-y-7 pt-3 pb-8 md:grid-cols-2">
            {data.parts.map((p) => (
              <div key={p.id} id={`part-${p.id}`} className="min-w-0 scroll-mt-8">
                <dt className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className={cn(TYPE.body, "font-medium text-pp-ink")}>{p.label}</span>
                  <span className={cn(TYPE.mono, "text-pp-muted")}>{p.datum}</span>
                </dt>
                <dd className={cn(TYPE.meta, "mt-1 text-pretty text-pp-ink/80")}>{p.does}</dd>
                <dd className="mt-1.5">
                  <button
                    type="button"
                    onClick={() => showPart(p.id)}
                    className={cn(
                      "home-link relative inline-flex min-h-6 cursor-pointer items-center rounded-sm text-[13px] leading-[18px]",
                      "before:absolute before:inset-x-0 before:-inset-y-2.5",
                      RING_LIGHT,
                    )}
                  >
                    {data.showIt}
                  </button>
                </dd>
              </div>
            ))}
          </dl>
        </details>
      </div>

      <p aria-live="polite" className="sr-only">
        {said}
      </p>
    </div>
  );
}

/**
 * One step in the list: its number in mono, its short title, and the
 * daily job's step name where it has one — under the title below lg, and
 * from lg level with it on the right, as the index sets a part's figure
 * beside its name (it drops under the title only if the two can't share
 * the line). The step's sentence is the caption's alone, so the two never
 * say the same thing twice.
 */
function StepRow({ n, step, on }: { n: number; step: Step; on: boolean }) {
  return (
    <>
      <span
        className={cn(
          TYPE.mono,
          "transition-colors duration-200",
          on ? "text-(--home-electric)" : "text-pp-muted group-hover:text-pp-ink",
        )}
      >
        {String(n + 1).padStart(2, "0")}
      </span>
      <span className="min-w-0 lg:flex lg:flex-wrap lg:items-baseline lg:justify-between lg:gap-x-3 lg:gap-y-0.5">
        <span className={cn(TYPE.meta, "block text-pretty", on && "text-pp-ink")}>{step.title}</span>
        {step.cron && (
          <code className={cn(TYPE.mono, "mt-0.5 block min-w-0 truncate text-pp-muted lg:mt-0")} translate="no">
            {step.cron}
          </code>
        )}
      </span>
    </>
  );
}

/** The inspector's body for one part. */
function PartDetail({
  data,
  part,
  lens,
  onLens,
}: {
  data: ExplorerData;
  part: Part;
  lens: LensId;
  onLens: (id: TourLensId, via: "key" | "pointer", chip: HTMLElement) => void;
}) {
  const paths = pathsFor(data, part.id);
  return (
    <div>
      <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className={TYPE.h3} style={{ fontWeight: WEIGHT.h3 }}>
          {part.label}
        </span>
        <span className={cn(TYPE.mono, "text-pp-muted")}>{part.datum}</span>
      </p>
      <p className={cn(TYPE.body, "mt-2 text-pretty text-pp-ink")}>{part.does}</p>
      {part.facts && <p className={cn(TYPE.meta, "mt-2 text-pretty")}>{part.facts}</p>}
      {paths.length > 0 && (
        <div className="mt-5">
          <p className={cn(TYPE.label, "text-pp-muted")}>{data.onPaths}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {paths.map((id) => (
              <button
                key={id}
                type="button"
                aria-current={id === lens || undefined}
                // A key (Enter, Space) arrives with no clicks counted: the lens's
                // finished frame, as the lens radios give a keyboard too.
                onClick={(e) => onLens(id, e.detail === 0 ? "key" : "pointer", e.currentTarget)}
                className={cn(LENS_CHIP, "px-3.5", id === lens ? CHIP.on : CHIP.off)}
              >
                {lensOf(data, id).label}
              </button>
            ))}
          </div>
        </div>
      )}
      {part.check && <CheckLine check={part.check} kinds={data.kinds} tone="white" className="mt-5" />}
      {part.grant && (
        <a
          href={data.grantLink.href}
          className={cn(
            "home-link relative mt-4 inline-flex min-h-6 items-center rounded-sm text-[15px] leading-[22px]",
            "before:absolute before:inset-x-0 before:-inset-y-2.5",
            RING_LIGHT,
          )}
        >
          {data.grantLink.label}
        </a>
      )}
    </div>
  );
}
