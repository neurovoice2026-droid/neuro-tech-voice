"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HOME } from "@/lib/pages/home";
import { cn } from "@/lib/utils";
import { FluidOrb } from "@/components/site/product/fluid-orb";
import { DocBadge } from "@/components/site/product/knowledge-base/parts";
import { DOTS, LINE, useSvgId } from "@/components/site/product/line-figure";
import { useKitContext, type Kit } from "@/components/site/product/motion-kit";
import { useInView } from "@/components/site/product/timing";
import { ChipRail, RoundButton, centreInRail, useRovingRadio } from "./controls";
import { useDocumentVisible, useStageMotion } from "./motion";
import { KB_MESH, MUTED_MESH } from "./palettes";
import { TYPE } from "./type";
import {
  ACCENT,
  BEAM_LOSE,
  BEAM_MISS,
  DIM,
  DOT,
  FILL_REST,
  FILL_WIN,
  SHEET_DIM,
  HOLD,
  STATUS_KEYS,
  TILE_LIFT,
  TILE_REST,
  VOL,
  addClear,
  addQuestion,
  beamStateFor,
  collect,
  finishedStatus,
  setBeams,
  setFrame,
  statusNow,
  winner,
  type BeamState,
  type Hooks,
  type Model,
  type Room,
  type Track,
} from "./knowledge-timeline";

/* ------------------------------------------------------------------ *
 * #knowledge, the stage: the knowledge base's reading room, set as a
 * funnel. Five documents across the top; beams fall from each to the
 * reader, one orb; the caller's question on its left, the page it found
 * on its right, the answer underneath.
 *
 * First view plays one question the documents answer, holds it, then
 * the one they don't — every bar stops short of its tick, the orb cools
 * to grey, and the agent says the owner's own fallback line — and stays
 * there. A question picked by hand plays once and holds.
 *
 * Without GSAP (the server's frame, reduced motion, before the kit
 * arrives) React draws the finished frame of one question; the question
 * chips switch that frame outright. Once GSAP is in charge, the parts it
 * moves are remounted (keyed by mode) so no style React drew for the
 * still frame ever fights a tween, and GSAP sets the same frame before
 * the first paint. The orb is outside those keys and is never remounted.
 * ------------------------------------------------------------------ */

type Kb = (typeof HOME)["kb"];

const LG = "(min-width: 1024px)";
/** Where a beam leaves its tile, and how far short of the orb it stops. */
const BEAM_GAP_TILE = 8;
const BEAM_GAP_ORB = 10;
/** The angle between neighbouring beams where they meet the orb. */
const BEAM_SPREAD = 15;

const BEAM_INK = "rgb(24 16 40 / 0.34)";
const RING = "shadow-[0_0_0_1px_rgb(24_16_40/0.07)]";

export function KnowledgeStage({
  room,
  questions,
  sequence,
  threshold,
  className,
}: {
  room: Kb["room"];
  questions: Kb["questions"];
  sequence: Kb["sequence"];
  threshold: number;
  className?: string;
}) {
  const model = useMemo<Model>(() => ({ docs: room.docs, questions }), [room.docs, questions]);
  const stageRef = useRef<HTMLDivElement>(null);
  const uid = useSvgId("kb");

  const { kit, reduce, playing, paused, setPaused, interacted, markInteracted } = useStageMotion(stageRef, {
    id: "knowledge",
  });
  const onScreen = useInView(stageRef);
  const visible = useDocumentVisible();
  const animated = kit != null && !reduce;

  // The frame the server draws, and reduced motion keeps: the sequence's last question, the miss.
  const readyIndex = Math.max(0, questions.findIndex((q) => q.id === sequence[sequence.length - 1]));
  const [still, setStill] = useState(readyIndex);
  const [selected, setSelected] = useState(readyIndex);
  const [orbMuted, setOrbMuted] = useState(winner(model, readyIndex) < 0);
  const [done, setDone] = useState(false);
  const [beams, setBeamPaths] = useState<string[]>([]);

  const vol = useRef<number>(VOL.miss);
  const kitRef = useRef<Kit | null>(null);
  const roomRef = useRef<Room | null>(null);
  const tlRef = useRef<ReturnType<Kit["gsap"]["timeline"]> | null>(null);
  const beamRef = useRef<BeamState>(beamStateFor(model, readyIndex));
  const stillRef = useRef(still);
  const railRef = useRef<HTMLDivElement>(null);
  const railMoved = useRef(false);
  const started = useRef(false);
  const runRef = useRef(false);

  // An explicit pick plays even while another stage holds the focus.
  const run = playing || (interacted && onScreen && visible && !paused && !reduce);

  useEffect(() => {
    stillRef.current = still;
  }, [still]);

  useEffect(() => {
    runRef.current = run;
    tlRef.current?.paused(!run);
  }, [run]);

  // Outside GSAP the orb's volume follows the still frame.
  useEffect(() => {
    if (!animated) vol.current = winner(model, still) < 0 ? VOL.miss : VOL.rest;
  }, [animated, still, model]);

  useKitContext(
    kit,
    ({ gsap, SplitText }) => {
      const stage = stageRef.current;
      if (reduce || !stage) return;
      const r = collect(stage, SplitText);
      const lg = window.matchMedia(LG).matches;
      // A frame the reader can already see is kept; one they can't yet
      // see is cleared, so the first thing they watch is the call.
      const box = stage.getBoundingClientRect();
      const seen = box.bottom > 0 && box.top < window.innerHeight;
      const at = seen ? stillRef.current : null;
      setFrame(gsap, r, model, at, lg);
      beamRef.current = beamStateFor(model, at);
      vol.current = at != null && winner(model, at) < 0 ? VOL.miss : VOL.rest;
      setOrbMuted(at != null && winner(model, at) < 0);
      roomRef.current = r;
      kitRef.current = { gsap, SplitText };
      return () => {
        tlRef.current?.kill();
        tlRef.current = null;
        roomRef.current = null;
        kitRef.current = null;
      };
    },
    { scope: stageRef, dependencies: [reduce], revertOnUpdate: true },
  );

  const hooks = useMemo<Hooks>(() => ({ vol, setMuted: setOrbMuted, setSelected, beams: beamRef }), []);

  /** Replaces whatever is playing with a fresh timeline built by `build`. */
  const start = useCallback(
    (build: (tl: ReturnType<Kit["gsap"]["timeline"]>, r: Room, track: Track, lg: boolean) => void, delay = 0) => {
      const k = kitRef.current;
      const r = roomRef.current;
      if (!k || !r) return;
      tlRef.current?.kill();
      const tl = k.gsap.timeline({ paused: true, delay, onComplete: () => setDone(true) });
      build(tl, r, { status: statusNow(k.gsap, r) }, window.matchMedia(LG).matches);
      tlRef.current = tl;
      tl.paused(!runRef.current);
    },
    [],
  );

  const playSequence = useCallback(
    (delay = 0) => {
      const ids = sequence.map((id) => questions.findIndex((q) => q.id === id)).filter((i) => i >= 0);
      start((tl, r, track, lg) => {
        ids.forEach((qi, n) => {
          if (n > 0) tl.to({}, { duration: HOLD });
          addClear(tl, r, track, hooks);
          addQuestion(tl, r, model, qi, track, hooks, { lg, announce: true });
        });
      }, delay);
    },
    [start, sequence, questions, hooks, model],
  );

  const playOne = useCallback(
    (qi: number) => {
      start((tl, r, track, lg) => {
        addClear(tl, r, track, hooks);
        addQuestion(tl, r, model, qi, track, hooks, { lg, announce: false });
      });
    },
    [start, hooks, model],
  );

  // First view: once the stage has the reader's attention, a beat, then the sequence.
  useEffect(() => {
    if (!animated || !run || started.current) return;
    started.current = true;
    playSequence(0.4);
  }, [animated, run, playSequence]);

  // The question on the stage stays in sight on a rail that scrolls (the rail moves, never
  // the page): it opens on the checked chip, and follows the selection from then on.
  // Measured only once the stage is on screen: until then the Deferred box may not be laid out.
  useEffect(() => {
    const rail = railRef.current;
    if (!onScreen || !rail) return;
    const chip = rail.querySelectorAll<HTMLElement>("[role=radio]")[selected];
    if (chip && rail.scrollWidth > rail.clientWidth) centreInRail(rail, chip, reduce || !railMoved.current);
    railMoved.current = true;
  }, [selected, reduce, onScreen]);

  // Beams drawn in after GSAP took over (a window widened past lg) join the frame on screen.
  const hasBeams = beams.length > 0;
  useEffect(() => {
    const k = kitRef.current;
    const stage = stageRef.current;
    if (!animated || !hasBeams || !k || !stage) return;
    setBeams(k.gsap, stage, beamRef.current);
  }, [animated, hasBeams]);

  // The beams run between measured boxes, so they meet the tiles and the orb at any width from lg.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const mq = window.matchMedia(LG);
    let frame = 0;
    const measure = () => {
      frame = 0;
      if (!mq.matches) return;
      const s = stage.getBoundingClientRect();
      // The stage rises in slightly scaled (home-rise): measure in its own pixels.
      const k = s.width / (stage.offsetWidth || s.width) || 1;
      const orb = stage.querySelector<HTMLElement>("[data-kb-orb]");
      const slots = Array.from(stage.querySelectorAll<HTMLElement>("[data-kb-slot]"));
      if (!orb || slots.length === 0) return;
      const o = orb.getBoundingClientRect();
      const radius = o.width / 2 / k;
      const ox = (o.left - s.left) / k + radius;
      const oy = (o.top - s.top) / k + radius;
      const mid = (slots.length - 1) / 2;
      const f = (n: number) => n.toFixed(1);
      const next = slots.map((slot, i) => {
        const t = slot.getBoundingClientRect();
        const sx = (t.left - s.left + t.width / 2) / k;
        const sy = (t.bottom - s.top) / k + BEAM_GAP_TILE;
        const a = ((-90 + (i - mid) * BEAM_SPREAD) * Math.PI) / 180;
        const ex = ox + (radius + BEAM_GAP_ORB) * Math.cos(a);
        const ey = oy + (radius + BEAM_GAP_ORB) * Math.sin(a);
        const h = Math.max(24, ey - sy);
        // It leaves its tile straight down and arrives along the orb's radius.
        const c1y = sy + h * 0.6;
        const c2x = ex + Math.cos(a) * h * 0.55;
        const c2y = ey + Math.sin(a) * h * 0.55;
        return `M${f(sx)} ${f(sy)} C${f(sx)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(ex)} ${f(ey)}`;
      });
      setBeamPaths((prev) => (prev.length === next.length && prev.every((d, i) => d === next[i]) ? prev : next));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const ro = new ResizeObserver(schedule);
    ro.observe(stage);
    mq.addEventListener("change", schedule);
    return () => {
      ro.disconnect();
      mq.removeEventListener("change", schedule);
      cancelAnimationFrame(frame);
    };
  }, []);

  const pick = (i: number) => {
    setSelected(i);
    // A pick is the reader taking over, whether or not GSAP has arrived yet:
    // the first-view sequence never starts after one.
    started.current = true;
    markInteracted();
    if (!animated) {
      setStill(i);
      return;
    }
    setPaused(false);
    setDone(false);
    runRef.current = true;
    playOne(i);
  };

  const { getItemProps } = useRovingRadio({
    count: questions.length,
    index: selected,
    orientation: "horizontal",
    onChange: (i) => pick(i),
  });

  const transport = () => {
    if (!done) {
      setPaused(!paused);
      return;
    }
    setDone(false);
    setPaused(false);
    runRef.current = true;
    if (interacted) playOne(selected);
    else playSequence();
  };

  // ── The still frame (everything below is drawn by React only while GSAP is not in charge) ──
  const mode = animated ? "a" : "s";
  const stat = !animated;
  const sq = questions[still];
  const sBest = winner(model, still);
  const sHit = sBest >= 0;
  const sStatus = finishedStatus(model, still);
  const orbColors = animated ? (orbMuted ? MUTED_MESH : KB_MESH) : sHit ? KB_MESH : MUTED_MESH;
  const hits = questions.map((q, qi) => ({ q, qi, doc: winner(model, qi) })).filter((x) => x.doc >= 0);

  const button = reduce
    ? { icon: "replay" as const, label: room.replay }
    : done
      ? { icon: "replay" as const, label: room.replay }
      : paused
        ? { icon: "play" as const, label: room.play }
        : { icon: "pause" as const, label: room.pause };

  return (
    <div
      ref={stageRef}
      className={cn(
        "home-knowledge-room home-rise relative isolate overflow-hidden rounded-[24px] bg-pp-card p-6 lg:p-10",
        className,
      )}
    >
      {/* The reader's light, and grain over it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: "radial-gradient(40% 50% at 50% 55%, rgb(85 26 137 / 0.08), transparent)" }}
      />
      <div aria-hidden className="pp-grain pointer-events-none absolute inset-0 -z-10 opacity-40" />

      {/* Beams: tile to orb, measured, lg only. */}
      <svg key={`beams-${mode}`} aria-hidden className="pointer-events-none absolute inset-0 -z-[5] hidden size-full lg:block" fill="none">
        {beams.map((d, i) => {
          const lit = stat && sHit && i === sBest;
          const groupOpacity = stat ? (sHit ? (lit ? 1 : BEAM_LOSE) : BEAM_MISS) : undefined;
          return (
            <g key={i} data-kb-beam style={groupOpacity != null ? { opacity: groupOpacity } : undefined}>
              <mask id={`${uid}m${i}`} maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
                <path
                  data-kb-draw
                  d={d}
                  pathLength={1}
                  stroke="#fff"
                  strokeWidth={12}
                  strokeDasharray="1 1"
                  style={{ strokeDashoffset: stat ? 0 : 1 }}
                />
              </mask>
              <path
                d={d}
                mask={`url(#${uid}m${i})`}
                stroke={BEAM_INK}
                strokeWidth={LINE}
                strokeDasharray={DOTS}
                strokeLinecap="round"
              />
              <path
                data-kb-trail
                d={d}
                pathLength={1}
                stroke={ACCENT}
                strokeWidth={1.5}
                strokeDasharray="1 1"
                style={{ strokeDashoffset: lit ? 0 : 1 }}
              />
            </g>
          );
        })}
        {beams.length > 0 && (
          <circle data-kb-runner r={2.5} fill={ACCENT} stroke="#f4f3f7" strokeWidth={2} style={{ opacity: 0, visibility: "hidden" }} />
        )}
      </svg>

      {/* Top: what this is, and where it is up to. */}
      <div className="flex flex-col gap-4 [grid-area:top] lg:flex-row lg:items-center lg:justify-between">
        <p aria-hidden className={cn(TYPE.label, "text-balance text-pp-muted")}>
          {room.sample}
        </p>
        <div className="flex items-center justify-between gap-3 lg:justify-end">
          <p
            key={`status-${mode}`}
            aria-hidden
            className={cn("inline-flex h-8 items-center gap-2 rounded-full bg-white px-3 text-[13px] leading-[18px]", RING)}
          >
            <span
              data-kb-dot
              className="size-2 shrink-0 rounded-full"
              style={stat ? { backgroundColor: DOT[sStatus] } : { backgroundColor: DOT.listening }}
            />
            {/* Sized to the words showing: still, only they take up room; under GSAP the box's width is tweened. */}
            <span data-kb-status-box className="relative grid overflow-hidden">
              {STATUS_KEYS.map((k) => (
                <span
                  key={k}
                  data-kb-status={k}
                  className={cn(
                    "justify-self-start whitespace-nowrap [grid-area:1/1]",
                    stat && k !== sStatus && "invisible absolute top-0 left-0",
                  )}
                >
                  {room.status[k]}
                </span>
              ))}
            </span>
          </p>
          <RoundButton icon={button.icon} label={button.label} onClick={transport} disabled={reduce} />
        </div>
      </div>

      {/* The documents: a row of tiles from lg, a list of rows (names aligned past a fixed badge column) below it. */}
      <ol key={`docs-${mode}`} aria-hidden className="mt-6 grid gap-2 [grid-area:docs] lg:mb-[112px] lg:grid-cols-5 lg:gap-4">
        {room.docs.map((d, i) => {
          const win = stat && sHit && i === sBest;
          const dim = stat && sHit && i !== sBest;
          return (
            <li key={d.id} data-kb-slot className="min-w-0">
              <div
                data-kb-tile
                className={cn(
                  // A phone stacks the name over its bar, so the name gets the width;
                  // from sm they share one line; from lg each is a tile.
                  "grid h-11 grid-cols-[44px_minmax(0,1fr)] content-center items-center gap-x-3 gap-y-1.5 rounded-2xl bg-white px-3",
                  "sm:grid-cols-[44px_minmax(0,1fr)_minmax(72px,32%)] sm:gap-y-0",
                  "lg:block lg:h-auto lg:p-3",
                  win && "lg:-translate-y-1.5",
                )}
                style={stat ? { boxShadow: win ? TILE_LIFT : TILE_REST, opacity: dim ? DIM : 1 } : { boxShadow: TILE_REST }}
              >
                <span className="row-span-2 flex sm:row-span-1">
                  <DocBadge kind={d.kind} />
                </span>
                <p className="truncate text-[13px] leading-[18px] lg:mt-3">{d.name}</p>
                <span className="relative block h-1 rounded-full bg-pp-ink/[0.08] lg:mt-3">
                  <span
                    data-kb-fill
                    className="absolute inset-0 origin-left rounded-full"
                    style={
                      stat
                        ? { backgroundColor: win ? FILL_WIN : FILL_REST, transform: `scaleX(${sq.match[i] ?? 0})` }
                        : { backgroundColor: FILL_REST }
                    }
                  />
                  <span
                    data-kb-tick
                    className="absolute -top-[3px] h-2.5 w-px bg-pp-ink/40"
                    style={{ left: `${threshold * 100}%` }}
                  />
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      {/* The caller. */}
      <div
        key={`caller-${mode}`}
        aria-hidden
        className="mt-6 [grid-area:caller] lg:mt-0 lg:max-w-[320px] lg:self-center lg:justify-self-end lg:text-right"
      >
        <p className={cn(TYPE.label, "text-pp-muted")}>{room.caller}</p>
        <div className="mt-2 grid">
          {questions.map((q, i) => (
            <p
              key={q.id}
              data-kb-ask
              className={cn(TYPE.cinemaSm, "text-balance italic [grid-area:1/1]", !(stat && i === still) && "invisible")}
            >
              {q.ask}
            </p>
          ))}
        </div>
      </div>

      {/* The reader. Never remounted: one WebGL context for the life of the page. */}
      <div aria-hidden className="mt-8 justify-self-center [grid-area:orb] md:self-center lg:mt-0">
        <div data-kb-orb className="size-[140px] lg:size-[184px]">
          <FluidOrb
            colors={orbColors}
            volume={vol}
            running={!paused}
            still={reduce || paused}
            gate="intent"
            className="size-full"
          />
        </div>
      </div>

      {/* The page it found, or the sheet it was still reading. */}
      <div
        key={`peek-${mode}`}
        aria-hidden
        className="mt-6 grid w-full [grid-area:peek] md:mt-8 md:self-center lg:mt-0 lg:max-w-[320px]"
      >
        <div
          data-kb-sheet
          className={cn(
            "relative rounded-[20px] border border-dashed border-[rgb(24_16_40/0.14)] p-4 [grid-area:1/1]",
            stat && sHit && "invisible",
          )}
        >
          {/* A sheet still being read… */}
          <div data-kb-sheet-lines className="flex flex-col gap-2.5" style={stat && !sHit ? { opacity: SHEET_DIM } : undefined}>
            <span className="block h-2 w-24 rounded-full bg-pp-ink/[0.07]" />
            {[86, 64, 78].map((w, i) => (
              <span
                key={i}
                className={cn("block h-2 rounded-full bg-pp-ink/[0.05]", i > 0 && "max-md:hidden", i === 0 && "mt-1.5")}
                style={{ width: `${w}%` }}
              />
            ))}
          </div>
          {/* …or the place a page would be, and none is. */}
          <p
            data-kb-sheet-note
            className={cn(
              "absolute inset-0 flex items-center justify-center gap-2 text-[13px] leading-[18px] text-pp-muted",
              !(stat && !sHit) && "invisible",
            )}
          >
            {room.status.missing}
          </p>
        </div>
        {hits.map(({ q, qi, doc }) => {
          const d = room.docs[doc];
          const open = stat && qi === still;
          return (
            <div
              key={q.id}
              data-kb-page={qi}
              className={cn(
                "rounded-[20px] bg-white p-4 outline-1 -outline-offset-1 outline-[rgb(24_16_40/0.07)] [grid-area:1/1]",
                !open && "invisible",
              )}
            >
              <p className="flex items-center gap-2 text-[13px] leading-[18px]">
                <DocBadge kind={d.kind} small />
                <span className="truncate">{d.name}</span>
              </p>
              <ul className="mt-2.5 flex flex-col gap-0.5">
                {d.lines.map((line, li) => {
                  const marked = li === q.line;
                  return (
                    <li
                      key={li}
                      className={cn(
                        "relative -mx-1.5 rounded-md px-1.5 py-1 text-[13px] leading-5 text-pretty",
                        marked ? "text-pp-ink" : "text-pp-muted max-md:hidden",
                      )}
                    >
                      {marked && (
                        <span
                          data-kb-mark={qi}
                          className="absolute inset-0 origin-left rounded-md bg-[#551a89]/12"
                          style={stat ? { transform: `scaleX(${open ? 1 : 0})` } : undefined}
                        />
                      )}
                      <span className="relative">{line}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {/* The answer, and where it came from. */}
      <div
        key={`answer-${mode}`}
        aria-hidden
        className="mt-8 w-full [grid-area:answer] lg:mx-auto lg:max-w-[760px] lg:text-center"
      >
        {/* Each answer with its source right under it; the stack holds the tallest pair. */}
        <div className="grid">
          {questions.map((q, i) => {
            const doc = winner(model, i);
            const hidden = !(stat && i === still) && "invisible";
            return (
              <div key={q.id} className="[grid-area:1/1]">
                <p data-kb-answer className={cn(TYPE.cinemaSm, "text-balance", hidden)}>
                  {q.answer}
                </p>
                <p data-kb-meta className={cn(TYPE.meta, "mt-3 flex items-center gap-2 lg:justify-center", hidden)}>
                  <span
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: doc >= 0 ? DOT.found : DOT.missing }}
                  />
                  {doc >= 0 ? (
                    <span>
                      {room.foundIn} <span className="text-pp-ink">{room.docs[doc].name}</span>
                    </span>
                  ) : (
                    <span>{room.fallback}</span>
                  )}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* The questions. */}
      <div className="mt-8 [grid-area:ctrl]">
        <ChipRail label={room.pick} railRef={railRef} className="max-lg:-mx-6 max-lg:px-6 lg:justify-center-safe">
          {questions.map((q, i) => (
            <button
              key={q.id}
              type="button"
              {...getItemProps(i)}
              className={cn(
                "relative h-9 rounded-full px-3.5 text-[13px] whitespace-nowrap transition-[background-color,color,box-shadow] duration-200",
                "before:absolute before:inset-x-0 before:-inset-y-1",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink",
                i === selected ? "bg-pp-ink text-white" : cn("bg-white text-pp-ink hover:bg-white/70", RING),
              )}
            >
              {q.ask}
            </button>
          ))}
        </ChipRail>
      </div>
    </div>
  );
}
