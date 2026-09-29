"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CAA_REHEARSAL, SPEAKERS, STATUS_LABEL, TestRow } from "@/lib/pages/custom-ai-agents";
import { cn } from "@/lib/utils";
import { IntentLink } from "@/components/site/intent-link";
import { Eyebrow, Frame, SectionTitle } from "@/components/site/product/primitives";
import { useInView, usePrefersReducedMotion } from "@/components/site/product/timing";
import { ToolName } from "@/components/site/industry/parts";
import { MadeUp, Segs, Stack, StatusDot, Turns, fill } from "./parts";
import { markProved } from "./proved";

/* ------------------------------------------------------------------ *
 * §4 — Tested before launch.
 *
 * The objection: "it'll embarrass us on a live call". Every vendor says
 * their agent is tested; the word costs nothing. So the instrument is
 * the thing a test actually leaves behind — a test sheet — and it keeps
 * its failures in view. Two of six calls went wrong: one misheard a plan
 * number, one didn't know it didn't do oil boilers. Neither row is
 * hidden or tidied into a green tick. Each carries what changed (a line
 * in the brief, a document) and, indented beneath it, the call rung
 * again. A sheet of six greens would read as a brochure; a sheet that
 * shows the two it caught reads as a process somebody ran.
 *
 * THE BAR IS THE CALL'S OWN LENGTH against the test-call cap (secs /
 * capSeconds, the cap handed in as a number so this client file never
 * imports call-protocol). It says two true things at once: these were
 * real calls of real length, and none of them came near the limit. It
 * is a transform (scaleX), never a width, so filling it moves nothing.
 *
 * THE RHYTHM. One row every 800ms — the bar fills in 480, the result
 * lands 120 after it has finished, then 200 of air before the next row
 * — because a result that lands while its bar is still moving reads as
 * a guess. A changed row's re-ring takes its own 800ms slot straight
 * after its result, so the fix visibly comes before the sheet moves on.
 * Six rows plus two re-rings from 300ms is 6.7s, and then the selection
 * goes back to "fast", the first row that failed: the page rests on the
 * catch, not on a pass. It plays once and never loops.
 *
 * SELECTION FOLLOWS THE RUNNING ROW so the aside plays the transcript of
 * whatever is being rung. Within a changed row the aside tells it in the
 * sheet's order too: "What changed" lands with the row's result, "Rung
 * again" with the re-ring's. Both are always laid out (`invisible`, not
 * absent), so revealing them moves nothing.
 *
 * RESERVATION. The aside is one Stack over all six rows, whole variants
 * rather than part by part: parts stacked separately would reserve the
 * oil row's change block under the landlord's two-line transcript and
 * leave a hole in the middle of every short row. As one variant each row
 * reads top to bottom with its air at the foot, and the Stack still
 * holds the cell at the tallest row (oil) at every width. In the list,
 * every result, sub-row and duration is laid out from the first frame
 * and only becomes visible, so nothing below the card ever moves.
 *
 * COLOUR. Green only where a test genuinely held — StatusDot decides
 * that from the status, never this file. Every change is violet (the
 * product being worked on, not a failure to hide). The bars are ink:
 * a duration is a fact, not a verdict. No ember: nothing here is urgent.
 *
 * A PICK RINGS THE ROW AGAIN, on the sheet only. The picked row's bar
 * runs from nothing to its recorded length and its result lands at the
 * same 600ms it did in the autoplay; a changed row's re-ring then takes
 * its own 800ms slot, so even on a replay the fix comes after the catch.
 * It is a replay of what the sheet already says — the same length, the
 * same result, the same order — so it can never show a pass the row did
 * not get, and nothing in it claims a new call was made. The aside is
 * deliberately not replayed: re-typing a transcript slows reading, and
 * below lg it would play out of sight. Replays are counted per row, so
 * picking one row never re-keys another's result. Under reduced motion
 * there is no replay at all; the finished sheet is simply there.
 *
 * PHONE. The status column would leave the scenario 70px at 320, so
 * below `sm` a row is one column in reading order — what was tried, how
 * long it ran, how it went — and from `sm` the result steps up beside
 * the scenario, where a sheet's result column belongs.
 * ------------------------------------------------------------------ */

type Data = typeof CAA_REHEARSAL;

/* The data module is server-only, so its label maps can't be imported as
   values here. Typed as `typeof` those maps, so a word that drifts from
   the data file is a compile error rather than a quiet mismatch. */
const STATUS: typeof STATUS_LABEL = {
  held: "Held",
  rewritten: "Rewritten",
  brief: "Changed the brief",
  document: "Changed a document",
};
const WHO: typeof SPEAKERS = { caller: "Caller", agent: "Agent" };

/** Counts are written as words in the summary ("six", "two"). */
const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const word = (n: number) => WORDS[n] ?? String(n);

/** The first beat waits for the card to settle into view. */
const LEAD_MS = 300;
/** One row: bar 480, result +120, air 200. */
const ROW_MS = 800;
/** When the result lands within its row's slot. */
const LAND_MS = 600;
/** The bar's fill, shared by the CSS transition (autoplay) and the WAAPI
    replay (a pick), so a replayed ring moves exactly as it first did. */
const BAR_MS = 480;
const EASE = "cubic-bezier(0.22,1,0.36,1)";
/** ind-land's own length (globals.css): a result has finished rising this long after it starts. */
const RISE_MS = 280;
/** Anything that says the reader has taken the page back from a pick's pending scroll. */
const HANDS = ["wheel", "touchstart", "pointerdown", "keydown"] as const;

/** Seconds as the call log prints them: 84 → "1:24". */
function clock(secs: number) {
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
}

/** Every ring on the sheet, in the order it happened: each row, and each re-ring straight after its row. */
function stepsOf(rows: readonly TestRow[]) {
  const steps: { row: number; again: boolean }[] = [];
  rows.forEach((r, i) => {
    steps.push({ row: i, again: false });
    if (r.again) steps.push({ row: i, again: true });
  });
  return steps;
}

export function Rehearsal({ data }: { data: Data }) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, "-15% 0px");
  const still = usePrefersReducedMotion();

  const rows: readonly TestRow[] = data.rows;
  const steps = useMemo(() => stepsOf(rows), [rows]);
  const total = steps.length;
  // Where each row's own ring and its re-ring sit in the sequence.
  const first = rows.map((_, i) => steps.findIndex((s) => s.row === i && !s.again));
  const again = rows.map((_, i) => steps.findIndex((s) => s.row === i && s.again));

  // `begun`: rings whose bar has started. `done`: rings whose result has
  // landed. Two counters, not one, because the bar and the result are two
  // beats of the same ring and the sheet shows the gap between them.
  const [ranBegun, setBegun] = useState(0);
  const [ranDone, setDone] = useState(0);
  const [running, setRunning] = useState<number>(data.settleOn);
  const [picked, setPicked] = useState<number | null>(null);
  // How many times each row has been rung again by a pick. Per row, not
  // one shared nonce: a shared count would re-key every row's result on
  // any pick and replay rows nobody touched.
  const [rings, setRings] = useState<Readonly<Record<number, number>>>({});
  // What the live region says after a pick; `n` alternates its trailing
  // no-break space so picking the same row twice is announced twice.
  const [said, setSaid] = useState<{ row: number; n: number } | null>(null);

  // Reduced motion and a pick both mean "the finished sheet", derived here
  // rather than written into state from an effect: no extra render, and the
  // chain below can keep running to its end without being able to undo a pick.
  const final = still || picked !== null;
  const begun = final ? steps.length : ranBegun;
  const done = final ? steps.length : ranDone;
  const sel = picked ?? (still ? data.settleOn : running);

  // The chain, once. `started` is a ref so no dependency change can ever
  // restart it; the timers are cleared only on unmount, because a reader
  // who scrolls away mid-sheet should come back to a finished sheet, not
  // a sheet frozen at row three with `started` refusing to run it again.
  const started = useRef(false);
  const timers = useRef<number[]>([]);
  const excerptRef = useRef<HTMLDivElement>(null);
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);
  // A pick's pending scroll to the excerpt (see `pick`); calling it drops
  // the timer and its listeners. A no-op when nothing is pending.
  const follow = useRef<() => void>(() => {});
  useEffect(() => () => follow.current(), []);

  useEffect(() => {
    if (still || !inView || started.current) return;
    started.current = true;
    const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
    steps.forEach((s, k) => {
      const t = LEAD_MS + k * ROW_MS;
      at(t, () => {
        setBegun(k + 1);
        setRunning(s.row);
      });
      at(t + LAND_MS, () => setDone(k + 1));
    });
    // All rings rung: rest on the first row that failed.
    at(LEAD_MS + total * ROW_MS, () => setRunning(data.settleOn));
  }, [inView, still, steps, total, data.settleOn]);

  function pick(i: number) {
    // A pick finishes the sheet at once: the reader asked for a row, not
    // for the rest of the demonstration.
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    started.current = true;
    setPicked(i);
    markProved("rehearsal");
    if (!still) setRings((r) => ({ ...r, [i]: (r[i] ?? 0) + 1 }));
    setSaid((s) => ({ row: i, n: (s?.n ?? 0) + 1 }));
    // Below lg the excerpt sits under all six rows — up to two screens
    // away on a landscape phone — so a pick would change a transcript the
    // reader can't see. Bring it up, but only when it is actually below
    // the fold and only on a pick: the autoplay never scrolls anyone.
    // `nearest` moves the page as little as it can; the card's scroll
    // margin keeps its top clear of the docked header.
    //
    // It waits for the replay. Bringing the excerpt up carries the picked
    // row 400–700px off the top of a phone, so scrolling at once would ring
    // the row again where nobody can see it. The page moves once the row's
    // last result has landed — the re-ring's, for a changed row — so the
    // reader watches the call ring, then is taken to what was said. Any
    // hand on the page before then (a scroll, a tap, a key) cancels it:
    // the reader is driving and is never pulled back.
    follow.current();
    const box = excerptRef.current;
    if (!box || window.matchMedia("(min-width: 1024px)").matches) return;
    const bring = () => {
      if (box.getBoundingClientRect().top < window.innerHeight) return;
      box.scrollIntoView({ block: "nearest", behavior: still ? "auto" : "smooth" });
    };
    if (still) return bring();
    const t = window.setTimeout(() => {
      stop();
      bring();
    }, (rows[i].again ? ROW_MS : 0) + LAND_MS + RISE_MS);
    const stop = () => {
      window.clearTimeout(t);
      HANDS.forEach((e) => window.removeEventListener(e, stop));
      follow.current = () => {};
    };
    // Added after this click's own pointerdown, so only a later hand counts.
    HANDS.forEach((e) => window.addEventListener(e, stop, { passive: true }));
    follow.current = stop;
  }

  const calls = rows.length;
  const changes = rows.filter((r) => r.again).length;

  return (
    <section id="rehearsal" ref={ref} className="scroll-mt-28">
      <Frame className="px-6 md:px-12">
        <Eyebrow>{data.eyebrow}</Eyebrow>
        {/* 680 + balance: two even lines at every desktop width, so the
            heading keeps the page's two-line rhythm and never ends a lone
            long line on its bare closing apostrophe. */}
        <SectionTitle className="mt-4 max-w-[680px] text-balance">{data.title}</SectionTitle>
        <p className="mt-5 max-w-[560px] text-base leading-[25px] text-pp-ink/80">{data.body}</p>
      </Frame>

      <Frame className="mt-8 px-2 md:px-4">
        <div className="grid gap-7 rounded-[24px] bg-pp-card p-4 md:p-7 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10">
          {/* The sheet. */}
          <div className="min-w-0">
            <MadeUp className="block">{data.tag}</MadeUp>
            <p className="mt-2 mb-5 max-w-[520px] text-[15px] leading-[23px] text-pp-ink">
              {fill(data.summary, { calls: word(calls), changes: word(changes) })}
            </p>

            <ol aria-label={data.listAria} className="divide-y divide-pp-rule border-y border-pp-rule">
              {rows.map((row, i) => {
                const k = first[i];
                const j = again[i];
                // `still` never counts a replay, but a reader can switch
                // reduced motion on after picking: read it as none then too.
                const replay = still ? 0 : (rings[i] ?? 0);
                return (
                  <li key={row.id} className="py-1.5">
                    <button
                      type="button"
                      aria-pressed={sel === i}
                      onClick={() => pick(i)}
                      className={cn(
                        // -mx-2 px-2 always, so the white of the selection
                        // bleeds past the text without the text moving.
                        "-mx-2 block min-h-11 w-[calc(100%+1rem)] rounded-xl px-2 py-2.5 text-left transition-colors duration-200",
                        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink",
                        sel === i ? "bg-white" : "hover:bg-white/50",
                      )}
                    >
                      <Ring
                        top={
                          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                            <span className="text-[15px] leading-[22px] text-pp-ink">{row.scenario}</span>
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[11px] leading-4 tracking-[0.06em] text-pp-muted uppercase transition-colors duration-200",
                                // On the white of a selected row the badge
                                // switches to grey so it stays a chip.
                                sel === i ? "bg-pp-card" : "bg-white",
                              )}
                            >
                              {data.badge}
                            </span>
                          </span>
                        }
                        secs={row.secs}
                        cap={data.cap}
                        capSeconds={data.capSeconds}
                        status={row.status}
                        begun={begun > k}
                        landed={done > k}
                        replay={replay}
                        delay={0}
                      />

                      {row.again && (
                        // The re-ring: always laid out, visible once rung.
                        <span
                          className={cn(
                            "mt-3 ml-4 block border-l border-pp-hair pl-3",
                            begun > j ? "ind-land" : "invisible",
                          )}
                          key={begun > j ? "rung" : "rest"}
                        >
                          <Ring
                            top={
                              <span className="block text-[11px] leading-4 font-medium tracking-[0.1em] text-pp-muted uppercase sm:pt-[3px]">
                                {data.rerung}
                              </span>
                            }
                            secs={row.again.secs}
                            cap={data.cap}
                            capSeconds={data.capSeconds}
                            status="held"
                            begun={begun > j}
                            landed={done > j}
                            replay={replay}
                            // Its own slot straight after the row's, as
                            // in the autoplay: the fix follows the catch.
                            delay={ROW_MS}
                          />
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* The transcript of the selected row. Sticky beside a tall sheet
              on a wide screen, so the call you picked stays in view. */}
          <div className="min-w-0 lg:sticky lg:top-28 lg:self-start">
            <div ref={excerptRef} className="scroll-mt-28 rounded-2xl bg-white p-5">
              <p className="border-b border-pp-hair pb-3 text-[11px] leading-4 font-medium tracking-[0.12em] text-pp-muted uppercase">
                {data.excerpt}
              </p>
              <Stack
                className="mt-4"
                items={rows}
                live={sel}
                render={(row, i) => (
                  <Aside
                    row={row}
                    data={data}
                    changed={done > first[i]}
                    rerung={again[i] >= 0 && done > again[i]}
                  />
                )}
              />
            </div>
          </div>
        </div>
        {/* Silent through the autoplay; speaks only on a pick. Composed
            from words already on the sheet — the scenario, its result and,
            for a changed row, the re-ring's — so it says nothing the page
            doesn't. The trailing no-break space alternates so a second
            pick of the same row is a change and is announced again. */}
        <p className="sr-only" aria-live="polite">
          {said
            ? `${rows[said.row].scenario} · ${STATUS[rows[said.row].status]}${
                rows[said.row].again ? ` · ${data.rerung} · ${STATUS.held}` : ""
              }${said.n % 2 ? "" : " "}`
            : ""}
        </p>
      </Frame>

      <Frame className="mt-5 px-6 md:px-12">
        <p className="max-w-[620px] text-[13px] leading-5 text-pp-muted">{data.foot}</p>
      </Frame>
    </section>
  );
}

/* ------------------------------------------------------------------ */

/**
 * One ring on the sheet: what was tried, how long the call ran against
 * the cap, and how it went. Used for a row and, indented, for its re-ring,
 * so the two read as the same kind of line.
 *
 * Below `sm` it is one column in reading order; from `sm` the result
 * takes a right-hand column on the first line. Placement is explicit
 * rather than DOM order so a screen reader still hears scenario, then
 * duration, then result.
 */
function Ring({
  top,
  secs,
  cap,
  capSeconds,
  status,
  begun,
  landed,
  replay = 0,
  delay = 0,
}: {
  top: ReactNode;
  secs: number;
  cap: string;
  capSeconds: number;
  status: TestRow["status"];
  begun: boolean;
  landed: boolean;
  /** Times a pick has rung this line again; 0 until the first. */
  replay?: number;
  /** When this line's replay starts, in ms after the pick. */
  delay?: number;
}) {
  const f = Math.min(1, secs / capSeconds);
  const bar = useRef<HTMLSpanElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  // The replayed bar is WAAPI, not the CSS transition: the inline style
  // already holds the final scaleX, so the animation only has to run from
  // nothing back to where React has it, and ends exactly there. `backwards`
  // holds it empty through its delay (the re-ring waits for its slot).
  // Cancelled on the next pick and on unmount, so replays never stack.
  // The readout replays with it: it arrives as the bar reaches it, as in
  // the autoplay, where it is invisible until `begun`. Without this, a
  // re-ring would show "0:52 of 3:00" beside an empty bar for up to its
  // whole delay, which reads as a mismatch rather than a replay. Opacity
  // only, so nothing reflows.
  useEffect(() => {
    if (!replay || !begun) return;
    const a = bar.current?.animate([{ transform: "scaleX(0)" }, { transform: `scaleX(${f})` }], {
      duration: BAR_MS,
      delay,
      easing: EASE,
      fill: "backwards",
    });
    // Starts 120ms before the bar ends, so the two finish together.
    const b = label.current?.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 200,
      delay: delay + BAR_MS - 120,
      easing: "ease-out",
      fill: "backwards",
    });
    return () => {
      a?.cancel();
      b?.cancel();
    };
  }, [replay, begun, delay, f]);

  return (
    <span className="grid grid-cols-[minmax(0,1fr)] gap-y-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-4">
      <span className="min-w-0 sm:col-start-1 sm:row-start-1">{top}</span>

      <span className="flex items-center gap-3 sm:col-span-2 sm:row-start-2">
        <span aria-hidden className="relative h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-pp-rule">
          <span
            ref={bar}
            className="absolute inset-y-0 left-0 w-full origin-left bg-pp-ink transition-transform duration-[480ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            style={{
              transform: `scaleX(${begun ? f : 0})`,
              // Once replayed, the sheet is final and `begun` never flips
              // again, so the transition has nothing left to do — and a
              // transition outranks an animation in the cascade: a pick
              // made before this line's autoplay beat would otherwise run
              // the CSS fill over the replay's held-empty delay.
              transitionProperty: replay ? "none" : undefined,
            }}
          />
        </span>
        {/* Laid out from the start; shown once the call has been rung. */}
        <span
          ref={label}
          className={cn(
            "shrink-0 text-[11px] leading-4 text-pp-muted tabular-nums",
            !begun && "invisible",
          )}
        >
          {clock(secs)} {cap}
        </span>
      </span>

      <span className="flex sm:col-start-2 sm:row-start-1 sm:self-start sm:pt-[3px]">
        {/* A replay re-keys the result so it lands again, LAND_MS into the
            line's slot as in the autoplay; ind-land fills `both`, so the
            result stays out through the delay and then rises once. */}
        <span
          key={`${landed ? "on" : "off"}:${replay}`}
          className={cn("flex", landed ? "ind-land" : "invisible")}
          style={{ animationDelay: replay ? `${delay + LAND_MS}ms` : undefined }}
        >
          <StatusDot status={status} label={STATUS[status]} />
        </span>
      </span>
    </span>
  );
}

/**
 * The selected row's transcript and what came of it, told in the sheet's
 * order: the call; if it failed, what changed and the call rung again;
 * the tools it used; where to read more. Parts a row doesn't have are
 * simply absent — the Stack around this holds the height.
 */
function Aside({
  row,
  data,
  changed,
  rerung,
}: {
  row: TestRow;
  data: Data;
  changed: boolean;
  rerung: boolean;
}) {
  const label = "text-[11px] leading-4 font-medium tracking-[0.12em] uppercase";
  return (
    <div>
      <p className="text-[13px] leading-5 font-medium text-pp-ink">{row.scenario}</p>

      {row.change && <p className={cn(label, "mt-4 text-pp-muted")}>{data.firstCall}</p>}
      <Turns turns={row.turns} labels={WHO} size="sm" className={row.change ? "mt-2" : "mt-4"} />

      {row.change && (
        <div
          key={changed ? "change:on" : "change:off"}
          className={cn("mt-5 border-t border-pp-hair pt-4", changed ? "ind-land" : "invisible")}
        >
          <p className={cn(label, "text-pp-accent")}>{data.changed}</p>
          {row.change.segs.length > 0 && (
            <p className="mt-2 text-[15px] leading-[23px] text-pp-ink">
              <Segs segs={row.change.segs} struck={changed} inked={changed} />
            </p>
          )}
          {row.change.note && <p className="mt-2 text-[13px] leading-5 text-pp-ink">{row.change.note}</p>}
        </div>
      )}

      {row.again && (
        <div
          key={rerung ? "again:on" : "again:off"}
          className={cn("mt-5 border-t border-pp-hair pt-4", rerung ? "ind-land" : "invisible")}
        >
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <p className={cn(label, "text-pp-muted")}>
              {data.rerung} · <span className="tabular-nums">{clock(row.again.secs)}</span>
            </p>
            <StatusDot status="held" label={STATUS.held} />
          </div>
          <Turns turns={row.again.turns} labels={WHO} size="sm" className="mt-2" />
        </div>
      )}

      {row.tools && (
        <div className="mt-5 border-t border-pp-hair pt-4">
          <p className={cn(label, "text-pp-muted")}>{data.tools}</p>
          <p className="mt-2 flex flex-wrap gap-1.5">
            {row.tools.map((t) => (
              <ToolName key={t} tool={t} className="rounded-full bg-pp-card px-2 py-0.5 text-pp-ink" />
            ))}
          </p>
        </div>
      )}

      {row.link && (
        <p className="mt-4">
          <IntentLink
            href={row.link.href}
            className="inline-flex min-h-6 items-center text-[14px] leading-5 underline-offset-4 transition-colors hover:text-[#551a89] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink"
          >
            {row.link.label} →
          </IntentLink>
        </p>
      )}
    </div>
  );
}
