"use client";

import {
  Fragment,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type { gsap } from "gsap";
import type { SplitText } from "gsap/SplitText";
import { cn } from "@/lib/utils";
import { IntentLink } from "@/components/site/intent-link";
import { useKitContext, type Kit } from "@/components/site/product/motion-kit";
import type { HomeTrade, HomeTrades } from "@/lib/pages/home.server";
import { ChipRail, centreInRail, useRovingRadio } from "./controls";
import { useStageMotion } from "./motion";
import { loadHomeScene } from "./trade-loaders";
import { TradeStage, type TradeStageHandle } from "./trade-stage";
import { TYPE, WEIGHT } from "./type";

/* ------------------------------------------------------------------ *
 * The trade window: an index of seventeen rows (a rail of chips below
 * 1280), one WebGL window that dissolves from scene to scene, and three
 * cells under it — a caller in that trade, what the agent does, and the
 * line its starting instructions draw.
 *
 * Nothing here plays on its own. A click commits at once; arrow keys move
 * the check and the words at once but hand the scene over only once the
 * keys have rested, so holding an arrow down the list compiles nothing on
 * the way past. A dwelled hover only fetches and compiles, never selects.
 *
 * Every trade's words are in the page, stacked in one grid cell per slot
 * and hidden but the chosen one, so each slot is exactly as tall as its
 * longest variant at every width and a change never moves the page. A
 * change is a hand-over inside those slots: the old kicker's lines lift
 * out of their masks as the new ones rise in, the cells fade across. The
 * iris opens from the row or chip that was pressed.
 * ------------------------------------------------------------------ */

export type TradesCopy = {
  group: string;
  cells: { caller: string; does: string; boundary: string };
  sample: string;
};

type Origin = { x: number; y: number };

/** Index row height (h-9), and the gap that sets the custom build apart. */
const ROW = 36;
const APART = 8;
/** Arrow keys hand the scene over this long after the last press. */
const KEY_REST_MS = 350;
/** A hover this long fetches and compiles the scene; it never selects. */
const DWELL_MS = 120;
const CUSTOM = "custom-ai-agents";

const RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink";

/* ─── the hand-over ─────────────────────────────────────────────────── */

type Slot = "head" | "link" | "cells";

type Live = {
  anim: gsap.core.Tween;
  targets: Element[];
  split?: SplitText;
  phase: "in" | "out";
};

type Swaps = { run(from: number, to: number): void; stop(): void };

/**
 * Moves the words from one trade's variant to another's.
 *
 * The kicker moves by lines: the old lines lift out of their masks while
 * the new ones rise in behind them, and a variant caught mid-move is
 * turned round from where it stands rather than snapped back first, so a
 * quick run of changes stays one motion.
 *
 * Everything else fades across, but only the parts that differ. A label
 * or a rule that reads the same and sits in the same place in both
 * variants is left alone: on a wide screen the cells' labels and rules
 * never move; on a phone, where the cells stack and a longer answer
 * pushes the next label down, those fade across too.
 *
 * React owns which variant is visible (a class). A leaving part borrows
 * `visibility` until it has gone, then gives it back.
 */
function createSwaps({ gsap, SplitText }: Kit, root: HTMLElement): Swaps {
  const live = new Map<HTMLElement, Live>();
  const find = (slot: Slot, i: number) => root.querySelector<HTMLElement>(`[data-swap="${slot}"][data-v="${i}"]`);

  const rest = (el: HTMLElement) => {
    const l = live.get(el);
    if (!l) return;
    live.delete(el);
    l.anim.kill();
    l.split?.revert();
    gsap.set([el, ...l.targets.filter((t) => t.isConnected)], { clearProps: "transform,opacity,visibility" });
  };

  // The label (and, below 1024, the link) are single masked lines; the
  // kicker is split into masked lines between them.
  const linesOf = (el: HTMLElement) => {
    const [label, ...after] = el.querySelectorAll("[data-line]");
    const para = el.querySelector<HTMLElement>("[data-lines]");
    const split = para ? SplitText.create(para, { type: "lines", mask: "lines" }) : undefined;
    return { split, targets: [...(label ? [label] : []), ...(split?.lines ?? []), ...after] };
  };

  const swapLines = (a: HTMLElement, b: HTMLElement, delay: number) => {
    const la = live.get(a);
    if (la?.phase !== "out") {
      la?.anim.kill();
      gsap.set(a, { visibility: "visible" });
      const parts = la ?? linesOf(a);
      const anim = gsap.to(parts.targets, {
        yPercent: -100,
        duration: 0.25,
        ease: "power2.in",
        stagger: 0.02,
        onComplete: () => rest(a),
      });
      live.set(a, { ...parts, anim, phase: "out" });
    }
    const lb = live.get(b);
    lb?.anim.kill();
    const parts = lb ?? linesOf(b);
    const to = { yPercent: 0, duration: 0.45, ease: "power3.out", stagger: 0.06, onComplete: () => rest(b) };
    const anim = lb ? gsap.to(parts.targets, to) : gsap.fromTo(parts.targets, { yPercent: 100 }, { ...to, delay });
    live.set(b, { ...parts, anim, phase: "in" });
  };

  /** The parts of each variant that differ from their counterpart, in words or in place. */
  const differing = (a: HTMLElement, b: HTMLElement) => {
    const pa = [...a.querySelectorAll<HTMLElement>("[data-part]")];
    const pb = [...b.querySelectorAll<HTMLElement>("[data-part]")];
    if (!pa.length) return [[a], [b]];
    const differs = (x: HTMLElement, y?: HTMLElement) =>
      !y || x.textContent !== y.textContent || x.offsetTop !== y.offsetTop || x.offsetHeight !== y.offsetHeight;
    return [pa.filter((x, i) => differs(x, pb[i])), pb.filter((y, i) => differs(y, pa[i]))];
  };

  const swapFade = (a: HTMLElement, b: HTMLElement, delay: number) => {
    // A fade is short: one caught mid-way simply lands before the next begins.
    rest(a);
    rest(b);
    const [out, into] = differing(a, b);
    // Opacity, not autoAlpha: autoAlpha hands `visibility` back as
    // `inherit`, and a leaving part would inherit its hidden variant's
    // `hidden` on the first frame. It keeps `visible` until it has gone.
    if (out.length) {
      gsap.set(out, { visibility: "visible" });
      const anim = gsap.to(out, { opacity: 0, y: -6, duration: 0.2, ease: "power2.in", onComplete: () => rest(a) });
      live.set(a, { anim, targets: out, phase: "out" });
    }
    if (into.length) {
      // Parts in one column share a beat; the columns follow one another.
      const beat = (_: number, t: Element) => delay + 0.06 * Number((t as HTMLElement).dataset.part || 0);
      const anim = gsap.fromTo(
        into,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.4, ease: "power2.out", stagger: beat, onComplete: () => rest(b) },
      );
      live.set(b, { anim, targets: into, phase: "in" });
    }
  };

  return {
    run(from, to) {
      const pair = (slot: Slot) => [find(slot, from), find(slot, to)] as const;
      const [ha, hb] = pair("head");
      if (ha && hb) swapLines(ha, hb, 0.16);
      const [la, lb] = pair("link");
      if (la && lb) swapFade(la, lb, 0.3);
      const [ca, cb] = pair("cells");
      if (ca && cb) swapFade(ca, cb, 0.2);
    },
    stop() {
      for (const el of [...live.keys()]) rest(el);
    },
  };
}

/* ─── pieces ────────────────────────────────────────────────────────── */

/** Every trade's variant of one slot, stacked in one cell; only the chosen one shows. */
function Stack({
  slot,
  index,
  trades,
  render,
  className,
  itemClassName,
}: {
  slot: Slot;
  index: number;
  trades: readonly HomeTrade[];
  render: (t: HomeTrade) => ReactNode;
  className?: string;
  itemClassName?: string;
}) {
  return (
    <div className={cn("grid", className)}>
      {trades.map((t, i) => (
        <div
          key={t.key}
          data-swap={slot}
          data-v={i}
          className={cn("[grid-area:1/1]", itemClassName, i !== index && "invisible")}
        >
          {render(t)}
        </div>
      ))}
    </div>
  );
}

/**
 * One cell: a hairline, a label, and what it says; each a part of column
 * `col`. Side by side, the three cells share their rows (a subgrid), so a
 * label that wraps in a narrow column pushes every column's words down
 * together and they still start on one line.
 */
function Cell({ col, label, children }: { col: number; label: ReactNode; children: ReactNode }) {
  return (
    <div className="lg:row-span-3 lg:grid lg:grid-rows-subgrid lg:items-baseline">
      <div data-part={col} aria-hidden className="h-px bg-pp-rule" />
      <p data-part={col} className={cn(TYPE.label, "mt-5 flex min-h-5 items-center gap-2 self-start text-pp-muted")}>
        {label}
      </p>
      <div data-part={col} className="mt-3 max-w-[600px]">
        {children}
      </div>
    </div>
  );
}

/** The trade's own page. Styled once in trades.css: it is in the page thirty-four times. */
function PageLink({ trade, className }: { trade: HomeTrade; className?: string }) {
  return (
    <IntentLink href={trade.href} className={cn("home-trades-link", className)}>
      <span>{trade.linkLabel}</span>
      <span aria-hidden>→</span>
    </IntentLink>
  );
}

/** Where the iris opens: the pressed row's height on the window's left edge, or the chip's x on its top edge. */
function originFrom(el: HTMLElement | null | undefined, win: HTMLElement | null, from: "index" | "rail"): Origin | undefined {
  if (!el || !win) return undefined;
  const w = win.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  if (!w.width || !w.height) return undefined;
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  return from === "index"
    ? { x: 0, y: clamp(1 - (r.top + r.height / 2 - w.top) / w.height) }
    : { x: clamp((r.left + r.width / 2 - w.left) / w.width), y: 1 };
}

/* ─── the window ────────────────────────────────────────────────────── */

export function TradesWindow({ data, copy }: { data: HomeTrades; copy: TradesCopy }) {
  const trades = data.trades;
  const opening = Math.max(0, trades.findIndex((t) => t.key === data.initial.key));
  const custom = trades.findIndex((t) => t.key === CUSTOM);
  const groupId = useId();

  /** The checked trade: the index, the rail and the words follow it at once. */
  const [index, setIndex] = useState(opening);
  /** The scene the window is asked for: at once on a click, after a rest on keys. */
  const [scene, setScene] = useState(data.initial.key);
  const [origin, setOrigin] = useState<Origin>();
  /** What the live region last said. Empty until someone picks a trade. */
  const [said, setSaid] = useState("");

  const rootRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<TradeStageHandle>(null);
  const rows = useRef<(HTMLElement | null)[]>([]);
  const chips = useRef<(HTMLElement | null)[]>([]);
  const keyTimer = useRef(0);
  const dwellTimer = useRef(0);

  const { kit, reduce } = useStageMotion(cardRef, { id: "trades" });

  const choose = (i: number, via: "key" | "pointer", from: "index" | "rail") => {
    const t = trades[i];
    if (!t) return;
    setIndex(i);
    setOrigin(originFrom(from === "index" ? rows.current[i] : chips.current[i], windowRef.current, from));
    const commit = () => {
      setScene(t.key);
      setSaid(`${t.label}: ${t.kicker}`);
    };
    window.clearTimeout(keyTimer.current);
    if (via === "key") keyTimer.current = window.setTimeout(commit, KEY_REST_MS);
    else commit();
  };

  const indexRadio = useRovingRadio({
    count: trades.length,
    index,
    orientation: "vertical",
    onChange: (i, via) => choose(i, via, "index"),
  });
  const railRadio = useRovingRadio({
    count: trades.length,
    index,
    orientation: "horizontal",
    onChange: (i, via) => choose(i, via, "rail"),
  });

  // Hover prefetches, and only for a mouse: a finger's hover is its tap.
  const dwell = (key: string) => (e: ReactPointerEvent) => {
    if (e.pointerType !== "mouse" || key === scene) return;
    window.clearTimeout(dwellTimer.current);
    dwellTimer.current = window.setTimeout(() => stageRef.current?.prepare(key), DWELL_MS);
  };
  const undwell = () => window.clearTimeout(dwellTimer.current);

  useEffect(
    () => () => {
      window.clearTimeout(keyTimer.current);
      window.clearTimeout(dwellTimer.current);
    },
    [],
  );

  // The hand-over, built once GSAP is here; with reduced motion it never is,
  // and React's class swap is the whole change.
  const swaps = useRef<Swaps | null>(null);
  useKitContext(
    kit,
    (k) => {
      const root = rootRef.current;
      if (reduce || !root) return;
      const s = createSwaps(k, root);
      swaps.current = s;
      return () => {
        s.stop();
        if (swaps.current === s) swaps.current = null;
      };
    },
    { scope: rootRef, dependencies: [reduce], revertOnUpdate: true },
  );

  // Before paint, right after React has moved the visible class: nothing
  // flashes at full strength before its tween takes hold.
  const shown = useRef(index);
  useLayoutEffect(() => {
    const from = shown.current;
    shown.current = index;
    if (from === index) return;
    swaps.current?.run(from, index);
  }, [index]);

  // The rail keeps the checked chip in its middle, and only the rail moves.
  const railSettled = useRef(false);
  useEffect(() => {
    if (!railSettled.current) {
      railSettled.current = true;
      return;
    }
    const rail = railRef.current;
    const chip = chips.current[index];
    if (rail && chip && rail.offsetParent !== null) centreInRail(rail, chip, reduce);
  }, [index, reduce]);

  const offset = (i: number) => i * ROW + (custom >= 0 && i >= custom ? APART : 0);

  return (
    <div ref={rootRef}>
      <p id={groupId} className="sr-only">
        {copy.group}
      </p>

      {/* Below 1280: the trades as a rail of chips over the window. */}
      <ChipRail labelledBy={groupId} railRef={railRef} className="mt-10 lg:mt-12 xl:hidden">
        {trades.map((t, i) => {
          const p = railRadio.getItemProps(i);
          return (
            <button
              key={t.key}
              type="button"
              {...p}
              ref={(el) => {
                p.ref(el);
                chips.current[i] = el;
              }}
              onPointerEnter={dwell(t.key)}
              onPointerLeave={undwell}
              className={cn(
                "relative h-9 rounded-full px-3.5 text-sm whitespace-nowrap transition-[background-color,color,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
                // A 44px target inside the rail's padding.
                "before:absolute before:inset-x-0 before:-inset-y-1",
                RING,
                i === index ? "pp-shadow-btn bg-white text-pp-ink" : "bg-pp-card text-pp-ink/70 hover:text-pp-ink",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </ChipRail>

      <div
        ref={cardRef}
        className={cn(
          "home-rise mt-3 rounded-[28px] bg-pp-card p-2 xl:mt-12 xl:grid xl:grid-cols-[264px_minmax(0,1fr)] xl:gap-2",
          "shadow-[0_0_0_1px_rgb(24_16_40/0.06),0_14px_30px_-20px_rgb(24_16_40/0.35)]",
        )}
      >
        {/* From 1280: the index, one row per trade, the custom build set apart. */}
        <div {...indexRadio.groupProps} aria-labelledby={groupId} className="relative hidden xl:block">
          <span
            aria-hidden
            className="pp-shadow-btn absolute inset-x-0 top-0 h-9 rounded-full bg-white transition-transform duration-[450ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ transform: `translateY(${offset(index)}px)` }}
          />
          {trades.map((t, i) => {
            const p = indexRadio.getItemProps(i);
            const on = i === index;
            return (
              <Fragment key={t.key}>
                {i === custom && <span aria-hidden className="mx-3 block h-px bg-pp-hair" style={{ marginBlock: (APART - 1) / 2 }} />}
                <button
                  type="button"
                  {...p}
                  ref={(el) => {
                    p.ref(el);
                    rows.current[i] = el;
                  }}
                  onPointerEnter={dwell(t.key)}
                  onPointerLeave={undwell}
                  className={cn(
                    "group relative grid h-9 w-full grid-cols-[32px_minmax(0,1fr)] items-center rounded-full px-3 text-left",
                    "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-pp-ink",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      TYPE.mono,
                      "text-[11px] transition-colors duration-200",
                      on ? "text-pp-accent" : "text-pp-muted",
                    )}
                  >
                    {t.ordinal}
                  </span>
                  <span
                    className={cn(
                      TYPE.body,
                      "truncate transition-colors duration-200",
                      on ? "text-pp-ink" : "text-pp-ink/70 group-hover:text-pp-ink",
                    )}
                  >
                    {t.label}
                  </span>
                </button>
              </Fragment>
            );
          })}
        </div>

        {/* The window and its caption share one sheet of paper: every scene
            fades to white at its foot, and the caption is set on that white —
            over the foot itself from 1024, continuing below it on phones. */}
        <div className="relative min-w-0 overflow-hidden rounded-[20px] bg-white shadow-[0_0_0_1px_rgb(24_16_40/0.06)]">
          <div
            ref={windowRef}
            className="relative aspect-[4/5] md:aspect-[16/10] lg:aspect-[16/9] xl:aspect-auto xl:h-[620px]"
          >
            <TradeStage
              ref={stageRef}
              sceneKey={scene}
              load={loadHomeScene}
              initialPoster={data.initial.poster}
              initialAlt={data.initial.alt}
              origin={origin}
              className="absolute inset-0"
            />
            {/* The scene turns to paper at its foot by itself; this keeps the
                words over it as legible on a poster, where it cannot. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-[34%]"
              style={{
                background:
                  "linear-gradient(to top, rgb(255 255 255 / 0.9), rgb(255 255 255 / 0.55) 45%, rgb(255 255 255 / 0))",
              }}
            />
          </div>

          <div className="relative -mt-10 px-5 pb-3 sm:px-6 sm:pb-4 lg:pointer-events-none lg:absolute lg:inset-x-8 lg:bottom-6 lg:mt-0 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-8 lg:p-0">
            <Stack
              slot="head"
              index={index}
              trades={trades}
              itemClassName="self-start lg:self-end"
              render={(t) => (
                <>
                  <p className={cn(TYPE.label, "overflow-clip text-pp-muted")}>
                    <span data-line className="block">
                      {t.label}
                    </span>
                  </p>
                  <p data-lines className={cn(TYPE.h3, "mt-2 max-w-[520px] text-pp-ink")} style={{ fontWeight: WEIGHT.h3 }}>
                    {t.kicker}
                  </p>
                  {/* Below 1024 the link follows the kicker as its last line. */}
                  <p className="-mx-1 -mb-1 overflow-clip px-1 py-1 lg:hidden">
                    <span data-line className="block">
                      <PageLink trade={t} className="min-h-11" />
                    </span>
                  </p>
                </>
              )}
            />
            <Stack
              slot="link"
              index={index}
              trades={trades}
              // Lifted 2px so its baseline sits on the kicker's last line.
              className="hidden lg:mb-0.5 lg:grid"
              itemClassName="justify-self-end self-end"
              render={(t) => (
                <PageLink
                  trade={t}
                  className="pointer-events-auto before:absolute before:-inset-x-2 before:-inset-y-[13px]"
                />
              )}
            />
          </div>
        </div>
      </div>

      {/* A caller in that trade, what the agent does with them, and where it
          stops. One stacked variant per trade holds all three cells, so the
          room kept for the longest sits once, at the foot, never as a hole
          inside a cell. From 1280 the first column is the index's width and
          the second starts on the caption's left edge (8 + 264 + 8 + 32 −
          32 of gap = 280), so the cells hang off the card above them. */}
      <Stack
        slot="cells"
        index={index}
        trades={trades}
        className="mt-8 lg:mt-10"
        itemClassName="grid content-start gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-x-8 lg:gap-y-0 xl:grid-cols-[280px_minmax(0,1fr)_minmax(0,1fr)]"
        render={(t) => (
          <>
            <Cell
              col={0}
              label={
                <>
                  {t.callerLabel}
                  {t.callerIsSample && <span className="home-trades-sample">{copy.sample}</span>}
                </>
              }
            >
              <p className={cn(TYPE.cinemaSm, "text-pretty text-pp-ink italic")}>{t.caller}</p>
            </Cell>
            <Cell col={1} label={copy.cells.does}>
              <p className={cn(TYPE.body, "text-pretty text-pp-ink/80")}>{t.does}</p>
            </Cell>
            <Cell col={2} label={copy.cells.boundary}>
              <p className={cn(TYPE.body, "text-pretty text-pp-ink")}>“{t.boundary}”</p>
              <p className={cn(TYPE.meta, "mt-2 text-pretty")}>{t.boundaryNote}</p>
            </Cell>
          </>
        )}
      />

      <p className="sr-only" aria-live="polite">
        {said}
      </p>
    </div>
  );
}
