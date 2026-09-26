"use client";

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import type { gsap as GsapCore } from "gsap";
import { Check, Minus, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { RING_DARK, useRovingRadio } from "@/components/site/home/controls";
import { useStageMotion } from "@/components/site/home/motion";
import { TYPE, WEIGHT } from "@/components/site/home/type";
import { useKitContext } from "@/components/site/product/motion-kit";
import { fill } from "@/components/site/solutions/custom-ai-agents/parts";
import { CheckLine } from "@/components/site/solutions/custom-saas-platforms/check-line";
import type { BreakId, BreakLane, BreakRow, BreaksData } from "@/lib/pages/custom-automations";
import { KindGlyph } from "./glyphs";
import { TRACE_DRAWN, Trace, axisMs, endsOf, type TraceCopy } from "./trace";

/* ------------------------------------------------------------------ *
 * #breaks' instrument: a sample workflow, what the CRM does when the
 * workflow sends it a call's details, and what the platform's own
 * delivery code did about it — drawn on a trace, written in the run
 * history, and said plainly: who finds out.
 *
 * THE NIGHT ROOM (auto-breaks.css §1) is a still gradient, the landing's
 * ink to the deep panel's violet, with the house grain: no mesh, no flow,
 * the one dark ground between the pearl rooms above and below it. On it,
 * only the tokens measured against both of its stops (spec §6.3): on-deep
 * for text (15.62:1 at its worst), on-deep-dim for what is secondary
 * (12.02), lilac for labels, waits and the bead (8.37), ember-lit for a
 * failure's mark (10.63) and settled-lit for a success's (11.45). The
 * electric is never text here. The run history is a white card, where the
 * landing's own tokens are safe again and are named directly (`--home-*`).
 *
 * THE LEFT COLUMN (from lg; first, below it): the workflow — "Sample
 * workflow", its name, and its four blocks in a column on a lilac rail:
 * when an unhappy caller hangs up, tag the call, send it to the CRM,
 * tell #managers in Slack — each with its kind's glyph (glyphs.tsx) and
 * its lane's word, the dashboard's own names for the trigger and the
 * steps. Then "What the CRM does": six answers, one radio group. From lg
 * a list of 48px rows, the answer on the left and the code it gives in
 * mono on the right (under it when the column is narrow); on md a 3 × 2
 * grid of chips and on a phone 2 × 3, the code under the answer. Chosen,
 * a row is white with ink (19.1:1); a hover is white at 8% over the
 * night.
 *
 * THE RIGHT COLUMN: the trace (trace.tsx) and the run history; who
 * finds out closes the left one, under the answers (below lg, all of it
 * in one column, in that order).
 *   - The run history is the dashboard's, as RunHistorySheet and
 *     ActionResultList print a run: "Succeeded" or "Failed" in a pill,
 *     then the three steps, "1. Tag the call", each with its state (a
 *     tick, a cross, a dash for skipped: every glyph with its word for a
 *     screen reader) and its line. The CRM's line is the delivery code's
 *     own — `describeDelivery` and ActionResultList's meta, worked out
 *     when the page was built (custom-automations.server.ts) — and so is
 *     the rule that skips Slack after a failure; the tag's and Slack's
 *     lines are the executor's strings. Each row says which of the two it
 *     is: a filled node, "Worked out by the platform’s code", or a hollow
 *     one, "The sample’s own step", in words for a screen reader and in a
 *     legend under the list for the eye. For the private network, a line
 *     more: in the dashboard, that address is refused when the workflow
 *     is saved. Then the file it comes from, under "In the code, for
 *     your developers" (whose code it is, the sub and the legend have
 *     said), and how to see it yourself (CheckLine).
 *   - Who finds out: on ours, a failed run is recorded and nobody is
 *     paged; on yours, a person is told the moment it fails, set apart by
 *     a lilac rule.
 *
 * NOTHING PLAYS ON ITS OWN. The server draws "Down all night", finished,
 * and that is the first paint on every tier; the workbench above stays
 * the page's only autoplay. GSAP comes through `useStageMotion` for its
 * kit alone (fetched as the room comes near; on a lite device only after
 * a tap or a key inside it; never with reduced motion) and the room
 * registers with the stages' focus, so while it fills the screen the
 * workbench's tour holds. A scenario picked BY POINTER, with the kit
 * here, plays:
 *   1. the marks on the trace fade (0.15s); then the new row commits, on
 *      a fresh drawing (`playKey`), and the run history's rows rise into
 *      place one after another (`.auto-row-in`, @starting-style, 60ms
 *      apart) while the pill cross-fades;
 *   2. the tag's bead runs to 0 and its tick pops;
 *   3. on the CRM, each try in turn: after a wait, the bead holds at the
 *      last mark while a lilac ring beside it drains over the code's real
 *      wait — one second, then four — and "waits 1 s" appears, then the
 *      bead moves on; a silence grows its bar over 2.5s (the ten seconds
 *      at four times: the scale note says so) with the bead riding its
 *      end; an answer's mark pops, back.out(2), with its code;
 *   4. Slack's bead runs to the CRM step's end and its tick pops, or the
 *      hatch wipes in, "Skipped".
 * About 1.2s for "Takes it", 7s for "Down all night" and 13s for
 * "Doesn’t answer": the pause is the proof. A new pick during a play
 * stops it and starts the next. Picked BY KEYS — the arrows, Home, End,
 * or Space or Enter, which arrive as clicks with none counted — or with
 * no kit, the row is simply there, finished, and nothing moves. Reduced
 * motion, the still tier, weak hardware and lite before a tap: the
 * same.
 *
 * GSAP ONLY TRAVELS; REACT HOLDS THE FRAME. What the trace and the
 * history show is always the committed row, drawn finished; a play sets
 * the row's parts back to nothing as it starts (in the layout effect,
 * before any paint) and brings each in, ending exactly on the frame React
 * drew. It runs inside `useKitContext`, rebuilt on every commit and on a
 * change of reduced motion, so a revert takes back everything it did.
 *
 * WHAT MAY MOVE. The room changes height only on the reader's own pick
 * (the run history's lines differ from row to row), and nothing above
 * the scenarios moves when it does; a play itself moves nothing's size.
 * Focus never moves: it stays on the radio that was picked.
 *
 * KEYBOARD AND SCREEN READERS. The six answers are one radio group
 * (`useRovingRadio`: one tab stop, the arrows move and pick at once),
 * named by "What the CRM does"; each option's name is its answer and its
 * code ("Down all night, 503, three times"). A pick is said once, in a
 * polite live region — "Failed. crm.example.com answered 503 after 3
 * attempts." — at once for a click, Space or Enter, and 350ms after the
 * arrows rest, so a walk through the six is one line; nothing is said
 * on load. The trace is aria-hidden, its tries said in a sentence; the
 * history is a real list. With no script, the "down" frame, and the
 * index under the section (breaks.tsx) holds all six in words.
 *
 * Every word arrives in `data` (the data module's AUTO_BREAKS slice,
 * types only here) and every result in `table`, the delivery code's rows.
 * ------------------------------------------------------------------ */

type Gsap = typeof GsapCore;
type Timeline = ReturnType<Gsap["timeline"]>;
type Tween = ReturnType<Gsap["to"]>;

/**
 * How a pick arrived: a pointer (it plays); one key, Enter or Space, a
 * click with none counted (finished at once, said at once); or the
 * arrows, Home and End walking the group (finished at once, said once the
 * keys rest).
 */
type Via = "pointer" | "key" | "arrow";

/** The row on the trace and in the history: which, whether it plays, and a fresh count for each commit. */
type Shown = { id: BreakId; play: boolean; n: number };

/** The arrows walking the group: the live region speaks this long after the last press (the landing's rest). */
const KEY_REST_MS = 350;
/** The marks of the row before, fading out. */
const FADE = 0.15;
/** A bead from one point to the next. */
const TRAVEL = 0.3;
/** A mark popping in. */
const POP = 0.22;
/** A line of words, or a bead, appearing. */
const SHOW = 0.15;
/** A silence plays this many times faster than it lasted: the scale note says four. */
const SPEED = 4;

/**
 * What the live region says. The arrows say theirs once the keys rest,
 * so a walk through the answers is one line; everything else at once.
 * Every line drops one still waiting, so an old walk's never lands after
 * a newer pick.
 */
function useLiveLine() {
  const [said, setSaid] = useState("");
  const timer = useRef(0);
  const say = useCallback((line: string, via: Via) => {
    window.clearTimeout(timer.current);
    if (via === "arrow") timer.current = window.setTimeout(() => setSaid(line), KEY_REST_MS);
    else setSaid(line);
  }, []);
  useEffect(() => {
    const t = timer;
    return () => window.clearTimeout(t.current);
  }, []);
  return { said, say };
}

/**
 * One run, played over the finished drawing of `row` (trace.tsx) in
 * `root`: its parts set back to nothing, then brought in lane by lane as
 * the delivery code met them, at the pace described above. Ends on the
 * frame React drew.
 */
function playRow(gsap: Gsap, root: Element, row: BreakRow): Timeline {
  const all = (sel: string) => [...root.querySelectorAll(sel)];
  const one = (sel: string) => root.querySelector(sel);
  const axis = axisMs(row.durationMs);
  // Where a moment sits along a runner, which moves by shares of itself.
  const along = (ms: number) => (ms / axis) * 100;
  const ends = endsOf(row);

  // A row draws only the parts it has (no silence after an answer, no
  // hatch when Slack ran): a selector that finds none is skipped, not
  // handed to GSAP, which would warn of a missing target.
  const set = (sel: string, vars: Parameters<Gsap["set"]>[1]) => {
    const els = all(sel);
    if (els.length) gsap.set(els, vars);
  };
  set("[data-mark]", { opacity: 0, scale: 0.6 });
  set("[data-answer], [data-axis-tick], [data-wait], [data-silence-label], [data-skipped]", { opacity: 0 });
  set("[data-silence], [data-hatch]", { scaleX: 0, transformOrigin: "0% 50%" });
  set("[data-runner]", { opacity: 0, xPercent: 0 });

  const tl = gsap.timeline();
  const pop = (sel: string, position?: string | number) => {
    const el = one(sel);
    if (el) tl.to(el, { opacity: 1, scale: 1, duration: POP, ease: "back.out(2)" }, position);
  };
  const show = (sel: string, position?: string | number) => {
    const els = all(sel);
    if (els.length) tl.to(els, { opacity: 1, duration: SHOW, ease: "power1.out" }, position);
  };

  // The tag: the sample's own step, done at the start.
  const tag = one('[data-runner="tag"]');
  tl.fromTo(tag, { opacity: 0, x: -12 }, { opacity: 1, x: 0, duration: TRAVEL, ease: "power2.out" });
  pop('[data-mark="tag"]');
  tl.to(tag, { opacity: 0, duration: SHOW }, "<");

  // The CRM: each try as the delivery code made it.
  const crm = one('[data-runner="crm"]');
  const ring = one("[data-countdown]");
  tl.to(crm, { opacity: 1, duration: SHOW }, "<");
  row.attempts.forEach((a, k) => {
    if (k > 0) {
      // The code's real wait, in real time: the ring beside the bead drains over it.
      tl.set(ring, { opacity: 1 });
      tl.fromTo(
        ring?.querySelector("circle") ?? null,
        { drawSVG: "0% 100%" },
        { drawSVG: "100% 100%", duration: row.waits[k - 1] / 1000, ease: "none" },
      );
      show(`[data-wait="${k - 1}"]`, "<");
      tl.to(ring, { opacity: 0, duration: 0.1 });
      tl.to(crm, { xPercent: along(a.at), duration: TRAVEL, ease: "power2.inOut" }, "<");
    }
    show(`[data-axis-tick="${k}"]`);
    if (a.answer === "timeout") {
      // Nobody answers: the silence runs from the try, four times faster than it lasted.
      const silence = (ends[k] - a.at) / 1000 / SPEED;
      show(`[data-silence-label="${k}"]`, "<");
      tl.to(one(`[data-silence="${k}"]`), { scaleX: 1, duration: silence, ease: "none" }, "<");
      tl.to(crm, { xPercent: along(ends[k]), duration: silence, ease: "none" }, "<");
      pop(`[data-mark="crm-${k}"]`);
    } else {
      pop(`[data-mark="crm-${k}"]`, "<");
      show(`[data-answer="${k}"]`, "<");
    }
  });
  tl.to(crm, { opacity: 0, duration: SHOW });

  // Slack: after the CRM step, or skipped once it has failed.
  if (row.ok) {
    const slack = one('[data-runner="slack"]');
    tl.to(slack, { opacity: 1, duration: SHOW }, "<");
    tl.to(slack, { xPercent: along(row.durationMs), duration: TRAVEL, ease: "power2.inOut" });
    pop('[data-mark="slack"]');
    tl.to(slack, { opacity: 0, duration: SHOW }, "<");
  } else {
    tl.to(one("[data-hatch]"), { scaleX: 1, duration: TRAVEL, ease: "power2.out" }, "<");
    show("[data-skipped]", "<0.1");
  }
  return tl;
}

/** A step's state in the run history: its glyph and its colour on white, with its word beside it for a screen reader. */
type State = "ok" | "fail" | "skipped";
const STATE: Record<State, { icon: LucideIcon; tone: string }> = {
  ok: { icon: Check, tone: "text-(--home-settled)" },
  fail: { icon: X, tone: "text-(--home-ember-ink)" },
  skipped: { icon: Minus, tone: "text-(--home-muted)" },
};

/**
 * A scenario: from lg a 48px row, the answer left and its code right
 * (under it when the column is narrow); below lg a chip, the code under
 * the answer. Its colours by state are auto-breaks.css §2's.
 */
const SCENARIO = cn(
  "auto-scenario flex min-h-11 w-full cursor-pointer flex-col items-start justify-center gap-0.5 rounded-xl px-3 py-2 text-left",
  "lg:min-h-12 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-x-3 lg:gap-y-0",
  RING_DARK,
);

/**
 * A scenario's code never ends on a lone word: its last two are held
 * together by a no-break space, so a chip two columns wide splits
 * "503, / three times", never "503, three / times". (Balancing alone
 * cannot: it rates 10/5 characters fairer than 4/11.) Said the same.
 */
const keepLastPair = (s: string) => s.replace(/ (?=\S+$)/, "\u00a0");

export function BreaksInstrument({ data, table }: { data: BreaksData; table: readonly BreakRow[] }) {
  const roomRef = useRef<HTMLDivElement>(null);
  const traceRef = useRef<HTMLDivElement>(null);
  const uid = useId();
  const optionsId = `${uid}-options`;

  const { kit, reduce } = useStageMotion(roomRef, { id: "breaks" });
  const [picked, setPicked] = useState<BreakId>(data.initial);
  const [shown, setShown] = useState<Shown>({ id: data.initial, play: false, n: 0 });
  const { said, say } = useLiveLine();
  const fadeRef = useRef<Tween | null>(null);
  const playRef = useRef<Timeline | null>(null);

  const rowOf = (id: BreakId) => table.find((r) => r.id === id) ?? table[0];
  const row = rowOf(shown.id);
  const statusOf = (r: BreakRow) => (r.ok ? data.record.status.completed : data.record.status.failed);

  useEffect(() => {
    const fade = fadeRef;
    return () => {
      fade.current?.kill();
    };
  }, []);

  // The play, over the row just committed: built in the layout effect, so
  // its parts are set back to nothing before the frame is painted. A new
  // commit, or reduced motion switched on, reverts it: what is left is the
  // finished row React drew.
  useKitContext(
    kit,
    (k) => {
      const root = traceRef.current;
      if (!shown.play || reduce || !root) return;
      playRef.current = playRow(k.gsap, root, rowOf(shown.id));
      return () => {
        playRef.current = null;
      };
    },
    { scope: roomRef, dependencies: [shown, reduce], revertOnUpdate: true },
  );

  /** Draws `id` on the trace and in the history, on a fresh drawing: played, or finished at once. */
  const commit = (id: BreakId, play: boolean) => setShown((s) => ({ id, play, n: s.n + 1 }));

  const pick = (id: BreakId, via: Via) => {
    const next = rowOf(id);
    setPicked(id);
    say(fill(data.live, { status: statusOf(next), message: next.message }), via);
    // Whatever was playing or fading stops where it is.
    fadeRef.current?.kill();
    fadeRef.current = null;
    playRef.current?.pause();
    const drawn = traceRef.current?.querySelectorAll(TRACE_DRAWN);
    if (via === "pointer" && kit && !reduce && drawn?.length) {
      // The row before fades, then the new one commits and plays.
      fadeRef.current = kit.gsap.to(drawn, {
        opacity: 0,
        duration: FADE,
        ease: "power1.out",
        overwrite: true,
        onComplete: () => {
          fadeRef.current = null;
          commit(id, true);
        },
      });
      return;
    }
    commit(id, false);
  };

  const index = data.scenarios.findIndex((s) => s.id === picked);
  const radio = useRovingRadio({
    count: data.scenarios.length,
    index,
    orientation: "vertical",
    onChange: (i, via) => pick(data.scenarios[i].id, via === "key" ? "arrow" : via),
  });

  const copy: TraceCopy = {
    wait: data.wait,
    silent: data.silent,
    refused: data.refused,
    skippedMark: data.skippedMark,
    codes: data.codes,
    scale: data.scale,
    tries: data.tries,
  };

  // The run history, in the executor's order and by its rules.
  const steps: readonly { lane: BreakLane; state: State; code: boolean; line: string; meta: string }[] = [
    { lane: "tag", state: "ok", code: false, line: data.record.tag, meta: "" },
    { lane: "crm", state: row.ok ? "ok" : "fail", code: true, line: row.message, meta: row.meta },
    row.ok
      ? { lane: "slack", state: "ok", code: false, line: data.record.slack, meta: "" }
      : { lane: "slack", state: "skipped", code: true, line: data.record.skipped, meta: "" },
  ];
  const stateWord: Record<State, string> = {
    ok: data.record.status.completed,
    fail: data.record.status.failed,
    skipped: data.skippedMark,
  };

  return (
    <div
      ref={roomRef}
      // Under 360px the room gives up 4px of its padding, as the SaaS
      // page's rooms do, so the chips and the run history keep their words.
      className="auto-night relative mt-10 p-5 max-[359px]:p-4 md:p-8 lg:mt-12 lg:p-10"
    >
      <span aria-hidden className="home-grain" />
      {/* From lg two columns: the workflow and the answers on the left, and
          under them who finds out; what the code did on the right, over
          both rows. The second row is the flexible one, so the right
          column's height lands there and "Who finds out" sits right under
          the answers, filling the left column rather than leaving its foot
          empty beside a taller run history. Below lg, one column in the
          reading order: workflow, answers, trace, history, who finds out. */}
      <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:grid-rows-[auto_1fr]">
        {/* ── The workflow, and what the CRM does ── */}
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <p className={cn(TYPE.label, "text-(--home-lilac)")}>{data.workflow.tag}</p>
          <h3 className={cn(TYPE.h3, "mt-1 text-balance text-(--home-on-deep)")} style={{ fontWeight: WEIGHT.h3 }}>
            {data.workflow.name}
          </h3>
          <ol className="mt-4 grid gap-3">
            {[
              { key: "when", kind: "when" as const, word: data.workflow.whenLabel, label: data.workflow.trigger },
              ...data.workflow.steps.map((s) => ({ key: s.lane, kind: s.kind, word: data.lanes[s.lane], label: s.label })),
            ].map((b, i) => (
              <li
                key={b.key}
                className={cn(
                  // The rail: 2px of lilac from each block up to the one before,
                  // on the glyphs' centre line (a border, so forced colours keep it).
                  "auto-step relative grid min-h-12 grid-cols-[14px_44px_minmax(0,1fr)] items-center gap-x-3 rounded-xl bg-white/[0.06] px-3 py-2.5 ring-1 ring-white/10",
                  i > 0 && "before:absolute before:-top-3 before:left-[18px] before:h-3 before:border-l-2 before:border-(--home-lilac)",
                )}
              >
                <KindGlyph kind={b.kind} className="text-(--home-lilac)" />
                <span className={cn(TYPE.mono, "text-[10px] leading-[14px] text-(--home-on-deep-dim) uppercase")}>
                  {b.word}
                  <span className="sr-only">:</span>
                </span>
                <span className="min-w-0 text-[14px] leading-5 text-pretty text-(--home-on-deep)">{b.label}</span>
              </li>
            ))}
          </ol>

          <p id={optionsId} className={cn(TYPE.label, "mt-8 text-(--home-lilac)")}>
            {data.optionsLabel}
          </p>
          <div
            {...radio.groupProps}
            aria-labelledby={optionsId}
            className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-1 lg:gap-1"
          >
            {data.scenarios.map((s, i) => (
              <button
                key={s.id}
                type="button"
                {...radio.getItemProps(i)}
                // Enter and Space arrive as clicks with none counted: a key, as the arrows are.
                onClick={(e) => pick(s.id, e.detail === 0 ? "key" : "pointer")}
                className={SCENARIO}
              >
                {/* Balanced, so a label that wraps splits in halves ("Points inside a /
                    private network"), never ending on a lone word; its code too
                    (keepLastPair). */}
                <span className="text-[14px] leading-5 text-balance">{s.label}</span>
                <span className="sr-only">, </span>
                <span className={cn(TYPE.mono, "auto-hint text-[11px] leading-4 text-balance")}>{keepLastPair(s.hint)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── What the code did: the trace and the run history ── */}
        <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <div ref={traceRef}>
            <Trace row={row} lanes={data.lanes} copy={copy} playKey={shown.n} />
          </div>

          <div data-played={shown.play || undefined} className="auto-record mt-6 rounded-[20px] bg-white p-5 text-(--home-ink) max-[359px]:p-4 md:p-6">
            <div className="flex items-center justify-between gap-4">
              <h3 className={cn(TYPE.label, "text-(--home-muted)")}>{data.record.title}</h3>
              {/* Both pills in one cell, so the change is a cross-fade and the header never reflows. */}
              <p className="grid justify-items-end">
                {([true, false] as const).map((ok) => {
                  const on = ok === row.ok;
                  const Icon = ok ? Check : X;
                  return (
                    <span
                      key={String(ok)}
                      aria-hidden={!on || undefined}
                      className={cn(
                        "auto-status inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[12px] leading-4 font-medium [grid-area:1/1]",
                        ok ? "bg-(--home-settled-soft) text-(--home-settled)" : "bg-(--home-ember-soft) text-(--home-ember-ink)",
                        !on && "opacity-0",
                      )}
                    >
                      <Icon aria-hidden className="size-3" strokeWidth={2.5} />
                      {ok ? data.record.status.completed : data.record.status.failed}
                    </span>
                  );
                })}
              </p>
            </div>

            <ol key={shown.n} className="mt-4 grid gap-3.5">
              {steps.map((s, k) => {
                const { icon: Icon, tone } = STATE[s.state];
                return (
                  <li
                    key={s.lane}
                    className={cn("grid grid-cols-[16px_12px_minmax(0,1fr)] gap-x-2", shown.play && "auto-row-in")}
                    style={shown.play ? ({ "--k": k } as CSSProperties) : undefined}
                  >
                    <span aria-hidden className="grid h-[18px] place-items-center">
                      <span className="auto-src" data-src={s.code ? "code" : "sample"} />
                    </span>
                    <span className="grid h-[18px] place-items-center">
                      <Icon aria-hidden className={cn("size-3", tone)} strokeWidth={2.5} />
                      <span className="sr-only">{stateWord[s.state]}: </span>
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] leading-[18px] font-medium">
                        {k + 1}. {data.record.labels[s.lane]}
                      </p>
                      <p
                        className={cn(
                          "text-[12px] leading-[18px] break-words",
                          s.state === "fail" ? "text-(--home-ember-ink)" : "text-(--home-muted)",
                        )}
                      >
                        {s.line}
                      </p>
                      {s.meta && <p className={cn(TYPE.mono, "text-[11px] leading-4 text-(--home-muted)")}>{s.meta}</p>}
                      <p className="sr-only">{s.code ? data.record.legend.code : data.record.legend.sample}</p>
                    </div>
                  </li>
                );
              })}
            </ol>

            {/* The two marks, for the eye: each row says its own in words. */}
            <p
              aria-hidden
              className={cn(TYPE.mono, "mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] leading-[14px] text-(--home-muted)")}
            >
              <span className="inline-flex items-center gap-1.5">
                <span className="auto-src" data-src="code" />
                {data.record.legend.code}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="auto-src" data-src="sample" />
                {data.record.legend.sample}
              </span>
            </p>

            {row.id === "private" && (
              <p className={cn(TYPE.meta, "mt-3 text-pretty text-(--home-muted)")}>{data.record.privateNote}</p>
            )}

            {/* The file alone: the sub and the legend just above have said whose code it is. */}
            <div className="mt-4 border-t border-pp-rule pt-4">
              <p className={cn(TYPE.mono, "text-[11px] leading-4 break-words text-(--home-muted)")}>
                {data.source.code}:{" "}
                <code translate="no" className="font-[inherit]">
                  {data.source.path}
                </code>
              </p>
              <CheckLine check={data.check} kinds={data.checkKinds} tone="white" className="mt-4" />
            </div>
          </div>
        </div>

        {/* ── Who finds out ── */}
        <div className="min-w-0 lg:col-start-1 lg:row-start-2 lg:self-start">
          <h3 className={cn(TYPE.label, "text-(--home-lilac)")}>{data.sees.label}</h3>
          <p className="mt-2 text-[14px] leading-5 text-pretty text-(--home-on-deep)">{data.sees.ours}</p>
          <p className="mt-3 border-l-2 border-(--home-lilac) pl-3 text-[14px] leading-5 text-pretty text-(--home-on-deep)">
            {data.sees.yours}
          </p>
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {said}
      </p>
    </div>
  );
}
