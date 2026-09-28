"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHIP, RING_LIGHT } from "@/components/site/home/controls";
import { TYPE, WEIGHT } from "@/components/site/home/type";
import { useDeviceTier } from "@/components/site/product/device-tier";
import { usePrefersReducedMotion } from "@/components/site/product/timing";
import { fill } from "@/components/site/solutions/custom-ai-agents/parts";
import type {
  ProtoBlock,
  ProtoHotspot,
  ProtoScreen,
  ProtoScreenId,
  PrototypeData,
} from "@/lib/pages/custom-saas-platforms";
import { vtAllowed, withViewTransition } from "./vt";

/* ------------------------------------------------------------------ *
 * #prototype's sample: three screens of a product that doesn't exist,
 * linked the way a real prototype is, so the reader can do the thing the
 * section promises — click through a product before a line of it is
 * written.
 *
 * WHAT IT IS. A white device on a `.home-stage` room: a top bar with the
 * product's placeholder name and where the reader is ("1 Sign up · 2
 * Overview · 3 Plans", the current step in ink), and under it one screen
 * at a time — Create your account, Good morning, Choose a plan. Every
 * screen is drawn in grey: fields are empty bars, the cards and plans
 * carry grey bars where a figure or a price would be, and the chart is
 * columns with no axis. No business, no person, no number anywhere
 * (the data module's test holds the screens to no digit at all). The
 * words are the data module's (SAAS_PROTOTYPE, types only here).
 *
 * THE HOTSPOTS ARE REAL BUTTONS, each named with where it goes ("Upgrade
 * — opens Plans"), the visible label first so a voice command that
 * reads the pill still reaches it. "Show what's clickable" is an
 * `aria-pressed` toggle, pressed from the start: the finished frame is
 * the Sign up screen with its hotspot showing. Pressed, every hotspot
 * wears an electric ring over a violet wash (saas-build.css §8), and a
 * 2px Highlight border in forced colours (saas.css §15); released, they
 * are plain grey buttons. The line under the device says what they do in
 * words that hold either way, since it names the buttons, not their
 * colour: a screen reader, and a forced palette, have no violet to point
 * at. The first time the device is well into view its observer sets
 * `data-seen` on it, once, straight on the DOM (no React state, the
 * LiveMesh way), and the highlighted hotspots pulse twice; a screen
 * reached later pulses its own as they arrive.
 *
 * A PRESS IS A VIEW TRANSITION (vt.ts `withViewTransition`, the DOM API,
 * not React's component): the old screen is captured, the new one is
 * committed synchronously inside the transition, and saas-build.css
 * slides one into the other — forward presses right to left, `back`
 * ones (Sign out, Back, Choose Team, Start again) mirrored, where the
 * browser carries transition types. Whether one may run is asked at the
 * press, never while rendering: the API has to exist, and the reader
 * must not have asked for less motion, and the device must not be lite
 * or still. Where the API is missing but motion is welcome, the change
 * is instant and the new screen lands with the house `ind-swap` rise;
 * with reduced motion, or on a lite or still device, it is simply
 * instant.
 *
 * FOCUS, AND ONE ANNOUNCEMENT. The pressed button leaves with its screen,
 * so focus moves to the new screen's heading (a -1 tab stop, scrolled to
 * never), in an effect that runs only after a press — never on the first
 * paint, where it would pull the page. The heading says where the reader
 * is before its title ("Screen 2 of 3: Good morning", the position for a
 * screen reader only), so the focus move is the whole announcement, said
 * once: there is no live region to say it again. From the keyboard the
 * heading wears the house focus ring, the explorer's inspector heading's
 * (RING_LIGHT, fitted to the words), since the button that was focused
 * has gone; a pointer press shows none. "Start again" goes back to the
 * first screen; on the first screen it is invisible but keeps its place,
 * so the line it sits on never reflows.
 *
 * NOTHING SHIFTS. The device is exactly as tall as its tallest screen,
 * and has no aspect ratio of its own: the screens are content that sits
 * at the top, not a scene that fills a frame (the landing's trades
 * window), so a 4:5 frame only left them over a band of empty white that
 * grew with the width. Every screen is laid into the same grid cell, the
 * live one over three invisible, `aria-hidden`, `inert` copies (the
 * custom AI agents page's `Stack`), so every screen is the same height at
 * every width and font, from the server's first paint; the device clips
 * its rounded corners with `overflow: clip`. The copies carry no
 * view-transition name and no focus target: only the live screen is ever
 * captured or focused.
 *
 * COLOUR. The room is the landing's stage, where muted labels read at
 * 5.39; the device is white, where muted is 6.37 and ink 19.11. The
 * pressed toggle is `CHIP.on` (white on electric, 5.70), the released one
 * white on the stage, as the landing's chips are there.
 * ------------------------------------------------------------------ */

/** A column chart's shape, drawn in the screen's grey: no axis, no figure. */
const BARS = [38, 54, 46, 62, 57, 74, 66, 84] as const;

/** The screen on show, and whether it arrives with the house swap (no View Transitions API). */
type Shown = { id: ProtoScreenId; swap: boolean };

/** A grey bar where a word or a figure would be. */
function Bar({ className }: { className: string }) {
  return <span aria-hidden className={cn("block rounded-full bg-pp-ink/8", className)} />;
}

/**
 * One block of a sample screen. Fields and the chart run the screen's
 * width; cards and plans stand two to a row.
 */
function Block({ block }: { block: ProtoBlock }) {
  if (block.kind === "chart") {
    return (
      <div aria-hidden className="col-span-2 flex h-20 items-end gap-1.5 rounded-lg bg-(--home-stage) px-4 pt-4 pb-3 md:h-24">
        {BARS.map((h, i) => (
          <span key={i} className="flex-1 rounded-t-[3px] bg-white" style={{ height: `${h}%` }} />
        ))}
      </div>
    );
  }
  if (block.kind === "field") {
    return (
      <div className="col-span-2 max-w-[360px]">
        <p className={TYPE.meta}>{block.label}</p>
        {/* An empty input, drawn: nothing here takes a keystroke. */}
        <span
          aria-hidden
          className="mt-1.5 block h-10 rounded-lg bg-(--home-chip) shadow-[inset_0_0_0_1px_rgb(20_10_36/0.06)]"
        />
      </div>
    );
  }
  const plan = block.kind === "plan";
  return (
    <div className="min-w-0 rounded-xl p-3 ring-1 ring-pp-rule">
      <p className={cn(TYPE.meta, plan && "font-medium text-pp-ink")}>{block.label}</p>
      {/* Where the figure (a card) or the price (a plan) would be. */}
      <Bar className="mt-2 h-5 w-1/2" />
      <Bar className="mt-1.5 h-2 w-3/4" />
      {plan && <Bar className="mt-1.5 h-2 w-2/3" />}
    </div>
  );
}

/**
 * A sample screen: its title, its blocks and its hotspots. Drawn live
 * (with a focus target and presses) and as an invisible copy that only
 * holds the device at its tallest screen.
 */
function Screen({
  screen,
  titleRef,
  position,
  onGo,
}: {
  screen: ProtoScreen;
  /** The live screen's heading, where focus goes after a press. The copies have none. */
  titleRef?: RefObject<HTMLHeadingElement | null>;
  /** "Screen 2 of 3", said before the title, for a screen reader only. The copies have none. */
  position?: string;
  onGo?: (hotspot: ProtoHotspot) => void;
}) {
  return (
    <>
      <h3
        ref={titleRef}
        tabIndex={titleRef ? -1 : undefined}
        className={cn(TYPE.h3, "w-fit rounded-sm", RING_LIGHT)}
        style={{ fontWeight: WEIGHT.h3 }}
      >
        {position && <span className="sr-only">{position}: </span>}
        {screen.title}
      </h3>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {screen.blocks.map((b, i) => (
          <Block key={i} block={b} />
        ))}
      </div>
      <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
        {screen.hotspots.map((h) => (
          <button
            key={h.label}
            type="button"
            // "Create account — opens Overview": the pill's own words, then where it goes.
            aria-label={h.aria}
            onClick={onGo ? () => onGo(h) : undefined}
            className={cn(
              "saas-hot min-h-11 cursor-pointer rounded-full bg-(--home-chip) px-4 text-[14px] leading-5 font-medium text-(--home-ink)",
              "transition-[background-color,box-shadow,scale] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.97]",
              RING_LIGHT,
            )}
          >
            {h.label}
          </button>
        ))}
      </div>
    </>
  );
}

export function PrototypeDemo({ data }: { data: PrototypeData }) {
  const reduce = usePrefersReducedMotion();
  const tier = useDeviceTier();
  const first = data.screens[0];
  const [shown, setShown] = useState<Shown>({ id: first.id, swap: false });
  // "Show what's clickable": pressed from the start, the finished frame.
  const [marked, setMarked] = useState(true);
  const device = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  // Set by a press, read once by the effect that moves focus after it.
  const moved = useRef(false);

  const screen = data.screens.find((s) => s.id === shown.id) ?? first;

  // The pulse's cue: `data-seen` on the device the first time most of it
  // is on screen, set once and left, straight on the DOM.
  useEffect(() => {
    const el = device.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        el.setAttribute("data-seen", "");
        io.disconnect();
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // After a press, the new screen's heading takes focus: the button that
  // was pressed has gone with the old screen.
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    title.current?.focus({ preventScroll: true });
  }, [shown]);

  function go(to: ProtoScreenId, dir: ProtoHotspot["dir"]) {
    const next = data.screens.find((s) => s.id === to);
    if (!next || next.id === shown.id) return;
    const allowed = vtAllowed(reduce, tier);
    // No API, but motion welcome: the new screen rises in with the house swap.
    const swap = !allowed && !reduce && tier !== "lite" && tier !== "still";
    moved.current = true;
    withViewTransition(
      "proto",
      () => setShown({ id: next.id, swap }),
      { allowed, types: [dir] },
    );
  }

  return (
    <div className="home-stage relative isolate rounded-[28px] p-4 md:p-8">
      <span aria-hidden className="home-grain" />

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <p className={cn(TYPE.label, "text-pp-muted")}>{data.tag}</p>
        <button
          type="button"
          aria-pressed={marked}
          onClick={() => setMarked((m) => !m)}
          className={cn(
            "relative h-9 shrink-0 cursor-pointer rounded-full px-4 text-[14px] leading-5 active:scale-[0.97]",
            // A 36px pill, a 44px target.
            "before:absolute before:inset-x-0 before:-inset-y-1",
            !marked && "pp-shadow-btn",
            CHIP.ease,
            RING_LIGHT,
            marked ? CHIP.on : CHIP.offOnStage,
          )}
        >
          {data.toggle}
        </button>
      </div>

      {/* The device. Not hidden from assistive technology: its screens
          are real headings and its hotspots real buttons. */}
      <div
        ref={device}
        role="group"
        aria-label={data.frameAria}
        data-hotspots={marked ? "" : undefined}
        className={cn(
          "saas-proto mt-4 flex flex-col overflow-clip rounded-[18px] bg-white",
          "shadow-[0_0_0_1px_var(--pp-rule),0_1px_2px_rgb(20_10_36/0.06),0_24px_48px_-28px_rgb(20_10_36/0.3)]",
        )}
      >
        <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-pp-rule px-4">
          <p className="pp-display flex min-w-0 items-center gap-2 text-[13px] leading-4 text-pp-ink" style={{ fontWeight: 500 }}>
            <span aria-hidden className="size-3 shrink-0 rounded-[4px] bg-(--home-lilac)" />
            <span className="truncate">{data.product}</span>
          </p>
          {/* Where the reader is. On a phone the other steps keep only
              their numbers on screen, and their names for a screen reader. */}
          <ol className={cn(TYPE.mono, "flex shrink-0 items-center gap-1.5 text-[11px] leading-4")}>
            {data.screens.map((s, i) => {
              const current = s.id === screen.id;
              return (
                <li
                  key={s.id}
                  aria-current={current ? "step" : undefined}
                  className={cn("flex items-center gap-1.5 whitespace-nowrap", current ? "text-pp-ink" : "text-pp-muted")}
                >
                  {i > 0 && (
                    <span aria-hidden className="text-pp-muted">
                      ·
                    </span>
                  )}
                  <span>{s.n}</span>
                  <span className={cn(!current && "max-sm:sr-only")}>{s.step}</span>
                </li>
              );
            })}
          </ol>
        </div>

        {/* The live screen over an invisible copy of each: the cell is as
            tall as the tallest. Only the live one is named for the view
            transition (saas-build.css §8) and keyed, so it is a new element
            for every screen. */}
        <div className="grid flex-1">
          <div
            key={`live-${screen.id}`}
            className={cn("saas-proto-screen min-w-0 p-5 [grid-area:1/1] md:p-8", shown.swap && "ind-swap")}
          >
            <Screen
              screen={screen}
              titleRef={title}
              position={fill(data.live, { n: screen.n, total: data.screens.length })}
              onGo={(h) => go(h.to, h.dir)}
            />
          </div>
          {data.screens.map((s) => (
            <div key={`copy-${s.id}`} aria-hidden inert className="invisible min-w-0 p-5 [grid-area:1/1] md:p-8">
              <Screen screen={s} />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {/* What the hotspots do, in words true with the highlight on or off.
            It takes the room "Start again" leaves and wraps inside it, so the
            button keeps its place on the line at every width. */}
        <p className={cn(TYPE.meta, "min-w-0 flex-1 basis-40 text-pretty")}>{data.hint}</p>
        <button
          type="button"
          onClick={() => go(first.id, "back")}
          className={cn(
            "pp-shadow-btn relative inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-white px-3.5 text-sm text-pp-ink",
            "transition-[background-color,scale] duration-200 hover:bg-(--home-wash) active:scale-[0.97]",
            "before:absolute before:inset-x-0 before:-inset-y-1",
            RING_LIGHT,
            // Out of sight and out of the tab order on the first screen, its place kept.
            screen.id === first.id && "invisible",
          )}
        >
          <RotateCcw aria-hidden className="size-3.5" strokeWidth={1.75} />
          {data.restart}
        </button>
      </div>
    </div>
  );
}
