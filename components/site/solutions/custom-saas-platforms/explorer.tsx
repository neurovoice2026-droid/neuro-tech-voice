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
import { CHIP, ChipRail, RING_LIGHT, RoundButton, useRovingRadio } from "@/components/site/home/controls";
import { useDocumentVisible, useStageMotion } from "@/components/site/home/motion";
import { TYPE, WEIGHT } from "@/components/site/home/type";
import { Stack } from "@/components/site/solutions/custom-ai-agents/parts";
import { CheckLine } from "./check-line";
import { fill, frameOf, lensIds, lensOf, pathsFor, rowOf } from "./explorer-frame";
import { buildDraw, buildTour } from "./explorer-timeline";
import { MapView } from "./map-view";
import { usePartRequest } from "./part-bus";
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
 *   - the draw (xl, once, only if the stage is still below the screen
 *     when GSAP arrives — the useLineReveal rule), played when the stage
 *     comes into view;
 *   - the tour, when one is wanted (`wantRef`): the first view's, until
 *     the reader takes over; or one the reader asked for with a pointer
 *     pick or the transport. It plays only while the stage has the
 *     screen (or the reader's hand), the tab is visible and the reader
 *     hasn't paused it, and not before the draw has finished.
 * Each arrival is `onStep(i)`, which sets the step, so React draws the
 * frame; GSAP only draws the travel in between (explorer-timeline.ts).
 * The Speaking pill changes card by Flip: its box is recorded just
 * before React moves it, and flown after the commit, in a layout effect.
 * In "Take a part down" each switch swaps the route at once (the frame),
 * and with GSAP present the old trace retracts as the new one draws.
 *
 * THE READER'S HAND, and what it does to the tour:
 *   - a lens by pointer: step 1 at once, and that lens's tour plays;
 *     by keys (or with no GSAP to play it): the lens's last step, its
 *     finished frame, and nothing moves;
 *   - a step: jump to it, and the tour stops;
 *   - the transport: Pause while a tour plays (WCAG 2.2.2), Play it
 *     while paused or before one has started, Play it again once done;
 *   - a card or chip: the inspector shows that part, and nothing moves;
 *   - a switch: the next call's route, at once.
 * Any of the first two, or a switch, ends the first view's autoplay for
 * good (`markInteracted`).
 *
 * "SEE IT ON THE MAP" from elsewhere on the page arrives through
 * part-bus.ts (MapLink), or as a `#part-<id>` fragment on load: the part
 * is selected, #platform scrolled to, and focus moved to the inspector's
 * heading, with one more look after 400ms in case a content-visibility
 * box above landed the scroll short. Both defer their state into a frame
 * (never a synchronous setState in an effect).
 *
 * ACCESSIBILITY. The drawing is aria-hidden; the index below it — every
 * part in words, each with "Show it on the drawing" — is the keyboard's
 * and the screen reader's path, with `#part-<id>` anchors that also work
 * with no script at all (the browser opens the <details>). The lenses
 * and the steps are radio groups with one tab stop and arrow keys; the
 * switches are `aria-pressed` toggles. A polite live region speaks what
 * the reader's own choices change — a step, a lens, the next call's
 * route — and never the tour, which would talk over everything. Every
 * block whose words change (the caption, the step list, the switches,
 * the inspector) is laid over its every variant, so nothing below it
 * ever moves.
 * ------------------------------------------------------------------ */

type Timeline = ReturnType<(typeof GsapCore)["timeline"]>;
type FlipState = ReturnType<FlipKit["Flip"]["getState"]>;

/** The map composition's breakpoint: Tailwind's xl. */
const XL = "(min-width: 80rem)";

function subscribeWide(onChange: () => void) {
  const mq = window.matchMedia(XL);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

const useIsoLayoutEffect = typeof document !== "undefined" ? useLayoutEffect : useEffect;

/** A tour to build the next time the kit context runs: which lens, and from which step. */
type Want = { lens: TourLensId; from: number };
type Tour = "idle" | "running" | "done";

/** A step row, in the live list and in the sizers that hold the tallest lens's height. */
const STEP_ROW =
  "grid w-full grid-cols-[28px_minmax(0,1fr)] items-baseline gap-x-2 rounded-xl px-3 py-[13px] text-left";

/** A lens chip on white: the landing's chip colours, a 44px target round a 36px pill. */
const LENS_CHIP = cn(
  "relative h-9 cursor-pointer rounded-full px-4 text-[13px] leading-5 whitespace-nowrap",
  "before:absolute before:inset-x-0 before:-inset-y-1",
  CHIP.ease,
  RING_LIGHT,
);

export function Explorer({ data, down }: { data: ExplorerData; down: readonly DownRow[] }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const inspectorRef = useRef<HTMLHeadingElement>(null);

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
  const [lens, setLens] = useState<LensId>(data.initial);
  const [step, setStep] = useState(initial.steps.length - 1);
  const [mask, setMask] = useState(0);
  const [part, setPart] = useState<PartId | null>(null);
  const [tour, setTour] = useState<Tour>("idle");
  const [nonce, setNonce] = useState(0);
  const [said, setSaid] = useState("");

  const frame = useMemo(() => frameOf(data, { lens, step, mask, down }), [data, lens, step, mask, down]);
  const tourLens = lens === "down" ? null : lensOf(data, lens);
  const isDown = tourLens === null;

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

  // An explicit pick plays even while another stage would hold the focus.
  const run = playing || (interacted && onScreen && visible && !paused && !reduce);

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
      if (!root || reduce) return;
      const below = root.getBoundingClientRect().top >= window.innerHeight;

      if (!drawn.current) {
        drawn.current = true;
        if (wide && below) drawRef.current = buildDraw(k.gsap, root, { onComplete: syncTour });
      }

      const want = wantRef.current;
      if (want && want.lens === lens) {
        const id = want.lens;
        tlRef.current = buildTour(k.gsap, root, {
          lens: lensOf(data, id),
          from: want.from,
          wide,
          onStart: () => setTour("running"),
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

  const pickStep = (i: number) => {
    if (!tourLens) return;
    markInteracted();
    wantRef.current = null;
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

  /** Selects a part, brings #platform into view and moves focus to the inspector. */
  const showPart = (id: PartId) => {
    setPart(id);
    const section = document.getElementById("platform");
    const go = () => section?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    go();
    requestAnimationFrame(() => inspectorRef.current?.focus({ preventScroll: true }));
    // A content-visibility box above may have rendered at its real height
    // mid-scroll and landed it short: one more look.
    window.setTimeout(() => {
      if (!section) return;
      const margin = parseFloat(getComputedStyle(section).scrollMarginTop) || 0;
      if (Math.abs(section.getBoundingClientRect().top - margin) > 4) go();
    }, 400);
  };

  const request = usePartRequest();
  const onRequest = useEffectEvent((id: PartId) => showPart(id));
  useEffect(() => {
    if (!request) return;
    const raf = requestAnimationFrame(() => onRequest(request.id));
    return () => cancelAnimationFrame(raf);
  }, [request]);

  // Arrived on /…#part-<id>: the same, once.
  useEffect(() => {
    const asked = /^#part-([a-z]+)$/.exec(window.location.hash)?.[1];
    const id = data.parts.find((p) => p.id === asked)?.id;
    if (!id) return;
    const raf = requestAnimationFrame(() => onRequest(id));
    return () => cancelAnimationFrame(raf);
  }, [data.parts]);

  /* ─── What the controls and the text blocks show ────────────────── */

  const ids = lensIds(data);
  const lensLabel = (id: LensId) => (id === "down" ? data.down.label : lensOf(data, id).label);
  const lensRadio = useRovingRadio({
    count: ids.length,
    index: ids.indexOf(lens),
    orientation: "horizontal",
    onChange: (i, via) => pickLens(ids[i], via),
  });

  // In "Take a part down" the step list stays in the layout, invisible, on the first lens.
  const listed = tourLens ?? initial;
  const stepRadio = useRovingRadio({
    count: listed.steps.length,
    index: tourLens ? step : -1,
    orientation: "vertical",
    onChange: (i) => pickStep(i),
  });

  const captions = useMemo(
    () => data.lenses.flatMap((l) => l.steps.map((s, i) => ({ total: l.steps.length, lens: l.id, s, i }))),
    [data.lenses],
  );
  const captionAt = Math.max(
    0,
    captions.findIndex((c) => c.lens === listed.id && c.i === Math.max(0, step)),
  );

  // One caption per answer the routing code can give, not per mask.
  const answers = useMemo(() => {
    const seen = new Map<string, DownRow>();
    for (const r of down) if (!seen.has(`${r.mode}:${r.reason}`)) seen.set(`${r.mode}:${r.reason}`, r);
    return [...seen.values()];
  }, [down]);
  const row = frame.row;
  const answerAt = row ? Math.max(0, answers.findIndex((r) => r.mode === row.mode && r.reason === row.reason)) : 0;

  const inspectable = useMemo(() => [...data.parts, null], [data.parts]);
  const partAt = part ? data.parts.findIndex((p) => p.id === part) : data.parts.length;

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
      <div ref={stageRef}>
        {/* What happens, and the transport, on white above the stage. */}
        <div className="flex items-center gap-3">
          <ChipRail label={data.lensesAria} className="min-w-0 flex-1 max-md:mr-0 max-md:pr-1">
            {ids.map((id, i) => (
              <button
                key={id}
                type="button"
                {...lensRadio.getItemProps(i)}
                className={cn(LENS_CHIP, id === lens ? CHIP.on : CHIP.off)}
              >
                {lensLabel(id)}
              </button>
            ))}
          </ChipRail>
          <RoundButton icon={button.icon} label={button.label} onClick={transport} disabled={reduce || isDown} />
        </div>

        <MapView data={data} frame={frame} selected={part} onPick={setPart} />
        <StackView data={data} frame={frame} selected={part} onPick={setPart} />

        {/* The caption: the step in words, or where the next call goes. Both
            kinds share one cell, each over all of its variants. */}
        <div className="mt-4 grid rounded-[20px] bg-white p-5 shadow-[0_0_0_1px_rgb(20_10_36/0.08)] md:p-6">
          <div className={cn("min-w-0 [grid-area:1/1]", isDown && "invisible")} inert={isDown} aria-hidden={isDown || undefined}>
            <Stack
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
          </div>
          <div className={cn("min-w-0 [grid-area:1/1]", !isDown && "invisible")} inert={!isDown} aria-hidden={!isDown || undefined}>
            <Stack
              items={answers}
              live={answerAt}
              render={(r) => (
                <div>
                  <p className={cn(TYPE.label, "text-pp-muted")}>{data.down.resultLabel}</p>
                  <p className={cn(TYPE.h3, "mt-1.5")} style={{ fontWeight: WEIGHT.h3 }}>
                    {data.down.modes[r.mode].name}
                  </p>
                  <p className={TYPE.meta}>{data.down.modes[r.mode].via}</p>
                  <p className={cn(TYPE.body, "mt-3 max-w-[680px] text-pretty text-pp-ink")}>{data.down.whys[r.reason]}</p>
                </div>
              )}
            />
          </div>
        </div>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:gap-12">
        {/* Every step of the lens, or the switches: one cell, both reserved. */}
        <div className="grid min-w-0 content-start">
          <div className={cn("min-w-0 [grid-area:1/1]", isDown && "invisible")} inert={isDown} aria-hidden={isDown || undefined}>
            <h3 className={cn(TYPE.label, "text-pp-muted")}>{data.stepsTitle}</h3>
            <div className="-mx-3 mt-3 grid">
              <div
                {...stepRadio.groupProps}
                aria-label={data.stepsAria}
                className="flex min-w-0 flex-col gap-1 [grid-area:1/1]"
              >
                {listed.steps.map((s, i) => (
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
              {/* The tallest lens's list holds the height, so no lens moves what's below. */}
              {data.lenses.map((l) => (
                <div key={l.id} aria-hidden inert className="invisible flex flex-col gap-1 [grid-area:1/1]">
                  {l.steps.map((s, i) => (
                    <div key={s.id} className={STEP_ROW}>
                      <StepRow n={i} step={s} on={false} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <Stack
              className="mt-4"
              items={data.lenses}
              live={Math.max(0, data.lenses.findIndex((l) => l.id === listed.id))}
              swap={false}
              render={(l) => (l.foot ? <p className={cn(TYPE.meta, "text-pretty")}>{l.foot}</p> : null)}
            />
          </div>

          <div className={cn("min-w-0 [grid-area:1/1]", !isDown && "invisible")} inert={!isDown} aria-hidden={!isDown || undefined}>
            <h3 className={cn(TYPE.label, "text-pp-muted")}>{data.down.label}</h3>
            <div className="mt-3">
              <Switchboard copy={data.down} mask={mask} onToggle={toggle} onReset={resetDown} />
            </div>
          </div>
        </div>

        {/* The part: what the reader picked on the drawing, or asked for from elsewhere. */}
        <div className="min-w-0">
          <h3
            ref={inspectorRef}
            tabIndex={-1}
            className={cn(TYPE.label, "w-fit rounded-sm text-pp-muted outline-none", RING_LIGHT)}
          >
            {data.partTitle}
          </h3>
          <Stack
            className="mt-3"
            items={inspectable}
            live={partAt}
            render={(p) =>
              p ? (
                <PartDetail data={data} part={p} lens={lens} onLens={pickLens} />
              ) : (
                <p className={cn(TYPE.body, "text-pretty text-pp-muted")}>{data.hint}</p>
              )
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
      <div className="home-faq mt-12">
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
              <div key={p.id} id={`part-${p.id}`} className="min-w-0 scroll-mt-28">
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
                      "home-link inline-flex min-h-6 cursor-pointer items-center rounded-sm text-[13px] leading-[18px]",
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

/** One step: its number in mono, its words, and the daily job's step name where it has one. */
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
      <span className="min-w-0">
        <span className={cn(TYPE.meta, "block text-pretty", on && "text-pp-ink")}>{step.text}</span>
        {step.cron && (
          <code className={cn(TYPE.mono, "mt-0.5 block truncate text-pp-muted")} translate="no">
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
  onLens: (id: LensId, via: "key" | "pointer") => void;
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
                // finished frame, as the lens radios give a keyboard.
                onClick={(e) => onLens(id, e.detail === 0 ? "key" : "pointer")}
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
          className={cn("home-link mt-4 inline-flex min-h-6 items-center rounded-sm text-[15px] leading-[22px]", RING_LIGHT)}
        >
          {data.grantLink.label}
        </a>
      )}
    </div>
  );
}
