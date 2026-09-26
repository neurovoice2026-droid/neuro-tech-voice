"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { RigField, Trade } from "@/lib/pages/industries/schema";
import { cn } from "@/lib/utils";
import { Eyebrow, Frame, PillLink, SectionTitle } from "../product/primitives";
import { useInView, usePrefersReducedMotion } from "../product/timing";
import { EMBER_INK, Gate, SETTLED, ToolName } from "./parts";
import { markProved } from "./proved";
import { ArtefactMark } from "./artefacts";

/* ------------------------------------------------------------------ *
 * §3 — Run it. The signature.
 *
 * A call on a rail, and beside it the object that call produces: this
 * trade's own paperwork, drawn empty. The page plays the call once. As
 * the playhead crosses each moment a field lands in the form at exactly
 * the second the information arrived — not all at once at the end — so
 * the causality is legible before anyone has touched anything.
 *
 * Then it hands over the puck. Dragging forward replays it. DRAGGING
 * BACKWARD TAKES IT APART: cross the booking going left and the slot
 * empties, the book_appointment row leaves the log, and the receipt
 * un-writes itself. Nothing else in this category is reversible, and
 * reversibility is not a trick here — it is the argument. It proves that
 * no field on that form is decoration, that each one was caused by a
 * specific second of a specific call, and it lets a sceptic do the thing
 * sceptics do, which is go back and check.
 *
 * The control is a real <input type="range"> drawn invisibly over the
 * rail. One element gives mouse drag, touch drag, keyboard arrows and a
 * spoken value, instead of three separate code paths and an inaccessible
 * instrument. `touch-action: pan-y` on it so a vertical flick scrolls
 * the page straight through the rail — on a phone that single line
 * decides whether this reads as beautiful or as broken.
 * ------------------------------------------------------------------ */

/** The call is 64 seconds. Nobody watches a page for 64 seconds. */
const PLAYBACK_SECONDS = 14;
const STEPS = 1000;

function clock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function RunIt({ trade }: { trade: Trade }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, "-15% 0px");
  const still = usePrefersReducedMotion();

  const [progress, setProgress] = useState(0);
  const [touched, setTouched] = useState(false);

  // Autoplay: one pass, then it stops dead. It never loops — a looping
  // demonstration reads as a screensaver and stops being evidence.
  const raf = useRef(0);
  const started = useRef(false);
  // Unmount only. Cancelling the pass when the section leaves the viewport
  // would strand the call half played, and the `started` guard would then
  // refuse to run it again.
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  useEffect(() => {
    if (still) {
      setProgress(1);
      return;
    }
    if (!inView || touched || started.current) return;
    started.current = true;
    const begin = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - begin) / (PLAYBACK_SECONDS * 1000));
      setProgress(p);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, [inView, still, touched]);

  function take(next: number) {
    cancelAnimationFrame(raf.current);
    started.current = true;
    setTouched(true);
    setProgress(next);
    markProved("run");
  }

  const t = progress * trade.duration;
  const turn = useMemo(() => {
    let current = trade.turns[0];
    for (const x of trade.turns) if (x.at <= t) current = x;
    return current;
  }, [t, trade.turns]);

  // The playback re-renders this section on every frame, but only the rail
  // actually moves every frame. Everything else is handed the last moment
  // it has passed, not the clock, so it renders when that moment changes —
  // a handful of times a call instead of sixty times a second.
  const ranTo = lastAt(trade.toolRuns, t);
  const filledTo = lastAt(trade.rig.fields, t);
  const shown = Math.round(Math.min(1, Math.max(0, (progress - 0.88) / 0.1)) * receiptWords(trade).length);

  return (
    <section id="run" ref={ref} className="scroll-mt-28">
      <Frame className="px-6 md:px-12">
        <Eyebrow>Run it</Eyebrow>
        <SectionTitle className="mt-4 max-w-[760px]">
          Every line on the job card came from a second you can point at
        </SectionTitle>
        <p className="mt-5 max-w-[560px] text-base leading-[25px] text-pp-ink/80">
          One call, on a rail. Drag it forward and it fills in. Drag it back and it comes apart — the
          slot empties, the tool leaves the log, and the confirmation un-writes itself.
        </p>
      </Frame>

      <Frame className="mt-8 px-2 md:mt-10 md:px-4">
        <div className="rounded-[24px] bg-white p-4 shadow-[0_0_0_1px_rgb(24_16_40/0.06)] md:p-7">
          <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10">
            {/* The call. On a phone this comes second: the paperwork is
                the point and the rail is the thing your thumb reaches. */}
            <div className="order-2 lg:order-1">
              <Transcript turns={trade.turns} side={turn.side} text={turn.text} ember={trade.ink.ember} />

              <Rail
                trade={trade}
                progress={progress}
                onScrub={take}
                label={`${clock(t)} of ${clock(trade.duration)} — ${turn.text}`}
              />

              <ToolLog toolRuns={trade.toolRuns} ranTo={ranTo} />
            </div>

            {/* The rig: this trade's own paperwork, drawn empty. */}
            <div className="order-1 lg:order-2">
              <JobCard trade={trade} clockText={clock(t)} filledTo={filledTo} shown={shown} />
            </div>
          </div>
        </div>
      </Frame>

      <Frame className="mt-5 px-6 md:px-12">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <p className="text-[13px] leading-5 text-pp-muted">
            A {trade.duration}-second call, played back in {PLAYBACK_SECONDS}. The clock on the rail is
            the call&rsquo;s own.
          </p>
          <PillLink href="/register" size="sm" className="ml-auto">
            Build this agent
          </PillLink>
        </div>
      </Frame>
    </section>
  );
}

/* ------------------------------------------------------------------ */

/** The latest `at` that `t` has reached, or -1 before the first. */
function lastAt(items: readonly { at: number }[], t: number) {
  let last = -1;
  for (const x of items) if (x.at <= t && x.at > last) last = x.at;
  return last;
}

const wordCache = new WeakMap<Trade, string[]>();
function receiptWords(trade: Trade) {
  let words = wordCache.get(trade);
  if (!words) wordCache.set(trade, (words = trade.rig.receipt.split(" ")));
  return words;
}

/**
 * The line being spoken. Every turn of the call is laid out underneath it
 * in the same cell, invisibly, so the transcript is as tall as the longest
 * turn and the rail below it never moves while the call plays.
 */
const Transcript = memo(function Transcript({
  turns,
  side,
  text,
  ember,
}: {
  turns: Trade["turns"];
  side: "caller" | "agent";
  text: string;
  ember: boolean;
}) {
  return (
    <div className="grid min-h-[92px] md:min-h-[84px]">
      <div className="[grid-area:1/1]">
        <Line side={side} text={text} ember={ember} live />
      </div>
      {turns.map((x) => (
        <div key={`${x.side}-${x.at}`} aria-hidden className="invisible [grid-area:1/1]">
          <Line side={x.side} text={x.text} ember={ember} />
        </div>
      ))}
    </div>
  );
});

function Line({ side, text, ember, live }: { side: "caller" | "agent"; text: string; ember: boolean; live?: boolean }) {
  return (
    <>
      <p className="text-[11px] leading-4 font-medium tracking-[0.12em] uppercase" style={{ color: side === "caller" ? "#6b6878" : ember ? EMBER_INK : "#551a89" }}>
        {side === "caller" ? "Caller" : "Agent"}
      </p>
      <p
        key={live ? text : undefined}
        className={cn(
          "mt-2 text-[17px] leading-7 md:text-[19px] md:leading-8",
          live && "ind-swap",
          side === "caller"
            ? "font-[family-name:var(--font-pp-cinema)] text-pp-ink italic"
            : "text-pp-ink",
        )}
      >
        {text}
      </p>
    </>
  );
}

/**
 * The last three tools the call has run. Three rows are always reserved,
 * as an invisible list under the live one, so the log filling up does not
 * push the page down on a phone, where it is the last thing in the card.
 */
const ToolLog = memo(function ToolLog({ toolRuns, ranTo }: { toolRuns: Trade["toolRuns"]; ranTo: number }) {
  const runs = toolRuns.filter((r) => r.at <= ranTo).slice(-3);
  const row = "flex items-baseline gap-3 border-b border-pp-rule pb-1.5";
  return (
    <div className="mt-5 min-h-[76px]">
      <p className="text-[11px] leading-4 font-medium tracking-[0.12em] text-pp-muted uppercase">
        Tools it ran
      </p>
      <div className="mt-2 grid">
        <ul className="space-y-1.5 [grid-area:1/1]">
          {runs.map((r) => (
            <li key={`${r.tool}-${r.at}`} className={`ind-row ${row}`}>
              <ToolName tool={r.tool} className="text-pp-ink" />
              <span className="ml-auto text-[11px] text-pp-muted tabular-nums">{r.ms} ms</span>
            </li>
          ))}
          {runs.length === 0 && (
            <li className="text-[13px] leading-5 text-pp-muted">Nothing yet — it is still listening.</li>
          )}
        </ul>
        <ul aria-hidden className="invisible space-y-1.5 [grid-area:1/1]">
          {toolRuns.slice(0, 3).map((r) => (
            <li key={`${r.tool}-${r.at}`} className={row}>
              <ToolName tool={r.tool} />
              <span className="ml-auto text-[11px] tabular-nums">{r.ms} ms</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
});

/**
 * The rail. Ticks are the turns; marks under it are the tools. The puck
 * is drawn; the thing that actually moves is an invisible range input
 * lying over the whole rail.
 */
function Rail({
  trade,
  progress,
  onScrub,
  label,
}: {
  trade: Trade;
  progress: number;
  onScrub: (p: number) => void;
  label: string;
}) {
  const pct = progress * 100;
  return (
    <div className="relative mt-4 h-16 select-none">
      {/* the rail */}
      <div className="absolute top-1/2 right-0 left-0 h-px -translate-y-1/2 bg-pp-rule" />
      <div
        className="absolute top-1/2 left-0 h-px -translate-y-1/2 bg-pp-ink"
        style={{ width: `${pct}%` }}
      />

      {/* the turns */}
      {trade.turns.map((x) => (
        <span
          key={`${x.side}-${x.at}`}
          className={cn(
            "absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors duration-200",
            x.at <= progress * trade.duration ? "bg-pp-ink" : "bg-pp-rule",
          )}
          style={{ left: `${(x.at / trade.duration) * 100}%` }}
        />
      ))}

      {/* the tools */}
      {trade.toolRuns.map((r) => (
        <span
          key={`${r.tool}-${r.at}`}
          className="absolute top-1/2 h-3 w-px translate-y-1 transition-opacity duration-200"
          style={{
            left: `${(r.at / trade.duration) * 100}%`,
            background: "#551a89",
            opacity: r.at <= progress * trade.duration ? 1 : 0.2,
          }}
        />
      ))}

      {/* the clock */}
      <span
        className="absolute top-0 -translate-x-1/2 text-[11px] text-pp-muted tabular-nums"
        style={{ left: `${pct}%` }}
      >
        {clock(progress * trade.duration)}
      </span>

      {/* the puck */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_1.6px_#000]"
        style={{ left: `${pct}%` }}
      />

      <input
        type="range"
        min={0}
        max={STEPS}
        step={1}
        value={Math.round(progress * STEPS)}
        onChange={(e) => onScrub(Number(e.target.value) / STEPS)}
        aria-label="Scrub the call"
        aria-valuetext={label}
        className="absolute inset-0 h-full w-full cursor-grab opacity-0 active:cursor-grabbing"
        style={{ touchAction: "pan-y" }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * The job card.
 *
 * Hand-drawn for this trade, not a rounded rectangle with a different
 * label on it: a ruled form with the fields a heating engineer's office
 * actually writes down, in the order a call fills them. If these are
 * drawn lazily across sixteen trades the whole per-trade promise
 * collapses, so the shape is the thing to protect in review.
 * ------------------------------------------------------------------ */

// The receipt writes itself over the last stretch of the call and
// un-writes itself word by word on the way back. A fade would say the
// same thing less precisely: the point is that the sentence is being
// *produced* by the call, so it has to come apart the way it was made.
const JobCard = memo(function JobCard({
  trade,
  clockText,
  filledTo,
  shown,
}: {
  trade: Trade;
  clockText: string;
  filledTo: number;
  shown: number;
}) {
  const words = receiptWords(trade);
  return (
    <div className="rounded-2xl bg-pp-card p-5">
      <div className="flex items-center justify-between border-b border-pp-hair pb-3">
        <div className="flex items-center gap-3">
          <ArtefactMark form={trade.rig.form} />
          <p className="text-[13px] leading-5 font-medium text-pp-ink">{trade.rig.title}</p>
        </div>
        <span className="text-[11px] text-pp-muted tabular-nums">{clockText}</span>
      </div>

      <dl className="mt-1">
        {trade.rig.fields.map((f) => (
          <Field key={f.id} field={f} on={f.at <= filledTo} />
        ))}
      </dl>

      <div className="mt-4 min-h-[44px] border-t border-pp-hair pt-3">
        <p className="text-[13px] leading-5" style={{ color: trade.ink.settled ? SETTLED : "#551a89" }}>
          {words.map((w, i) => (
            <span key={i} className="transition-opacity duration-150" style={{ opacity: i < shown ? 1 : 0 }}>
              {w}{" "}
            </span>
          ))}
        </p>
      </div>
    </div>
  );
});

function Field({ field, on }: { field: RigField; on: boolean }) {
  return (
    <div
      className={cn(
        "border-b border-pp-hair/60 py-2.5 last:border-b-0",
        !field.onPhone && "hidden lg:block",
      )}
    >
      {/* Wraps: in the 340px column, or on a phone, a long label beside a
          long gate otherwise squeezes both into two-word stacks. When they
          do not fit side by side the gate drops under the label. */}
      <dt className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-[11px] leading-4 tracking-[0.06em] text-pp-muted uppercase">{field.label}</span>
        {/* Always laid out, and only shown once the field lands, so a gate
            that needs a line of its own does not add it mid-call. */}
        {field.from !== "caller" && <Gate tool={field.from} className={on ? "ml-auto" : "invisible ml-auto"} />}
      </dt>
      {/* The value is laid out before it arrives, invisibly, so the card is
          its full height from the first frame: on a phone the transcript
          and the rail sit under it, and a card that grew a line with each
          field would walk them down the screen while the call plays. */}
      <dd className="relative mt-1 min-h-[22px]">
        <span
          key={on ? "on" : "off"}
          aria-hidden={on ? undefined : true}
          className={cn("block text-[15px] leading-[22px] text-pp-ink", on ? "ind-land" : "invisible")}
        >
          {field.value}
        </span>
        {!on && (
          /* An empty rule, so the form has a shape before it has content
             and the reader can see what has not happened yet. */
          <span aria-hidden className="absolute inset-x-0 top-0 block h-px w-2/3 bg-pp-hair" />
        )}
      </dd>
    </div>
  );
}
