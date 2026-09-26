import type { ReactNode } from "react";
import { Ban, Check, RotateCw, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE } from "@/components/site/home/type";
import { fill } from "@/components/site/solutions/custom-ai-agents/parts";
import type { BreakAnswer, BreakLane, BreakRow, BreaksData } from "@/lib/pages/custom-automations";

/* ------------------------------------------------------------------ *
 * #breaks — the trace: one run of the sample workflow, drawn to scale
 * from what the platform's own delivery code did with it.
 *
 * THREE LANES, one per step of "Unhappy callers to the CRM", in the
 * workflow's order: the tag, the webhook to the CRM, the Slack message.
 * Each is a row, its lane word on the left in mono and a hairline track
 * across the rest, and what happened on the step sits on its track at
 * the moment it happened, on the clock the build ran the code with
 * (custom-automations.server.ts): 0 is the run's start, and the axis
 * runs to the whole run and a second more, never less than two seconds
 * (`axisMs`), so "Takes it" and "Down all night" are drawn at their own
 * scale, not squeezed or stretched to one width. The ticks under the
 * lanes are when each try on the CRM started ("0 s", "1 s", "5 s").
 *
 * A TRY is a 20px mark on the CRM's track, its glyph saying how it
 * ended, never its colour alone: a tick for an answer the CRM took (a
 * 2xx, settled-lit), a turning arrow for one the code tried again after
 * (ember-lit), a cross for the last, failed one (ember-lit), a barred
 * circle for an address the code refused before sending (lilac). Under
 * it, its answer: "503", "404", "refused". Between two tries, the wait
 * the code slept, a dotted lilac span with its length over it ("waits
 * 1 s"). A try nobody answered is instant as a try but not as a step:
 * its ten seconds of silence run from its mark as a lilac bar, "no
 * answer in 10 s" under the first (and from md, where there is room,
 * under every one). An answer is drawn as instant: the waits and the
 * silences are the code's own, and the requests themselves would add
 * only a few milliseconds each, which the scale note under the lanes
 * says.
 *
 * THE OTHER TWO LANES follow the executor's rule. The tag is the
 * sample's own step and is done at once: a tick at 0. Slack runs when
 * the CRM step is done — a tick a hair after it, when it got through —
 * or never, when it failed: then its whole track is hatched, "Skipped".
 * The whole track, not only what follows the failure: after "Doesn’t
 * answer" that would be the last thirty-sixth of it, a sliver nobody
 * would read as a step that never ran.
 *
 * WHERE THINGS SIT. Every position is a share of the track, laid out in
 * CSS (`place`): 10px in from each end, so a mark at 0 or at the end
 * stays whole on its track, and the shares hold at every width without
 * measuring. The row of words over a track (the waits) and the row under
 * it (the answers, the silences, "Skipped") never meet the marks; the
 * first try's words start at its mark's left edge rather than centring
 * on it, so "refused" never spills past the track's start; and the
 * axis's words are pushed apart to at least 28px from centre to centre
 * (`spread`, in CSS `max()`, so it holds at every width). On a 320px
 * phone the narrowest run apart, "Down all night", keeps its tries 30px
 * apart.
 *
 * MOTION IS THE INSTRUMENT'S (breaks-instrument.tsx), and only on the
 * reader's pointer pick. This draws the finished frame, always: what the
 * server paints, what reduced motion, the still tier, lite before a tap
 * and a pick by keys show, and where every play ends. For a play, the
 * instrument's GSAP finds the drawing's parts by their data attributes
 * (`data-mark`, `data-wait`, `data-silence`, `data-runner` …) and brings
 * them in from nothing, travelling a bead along each lane (the
 * `data-runner` layer, hidden at rest, clipped to its track so nothing
 * it carries can widen the page) and draining the countdown ring beside
 * it over each real wait. The drawing is re-keyed on `playKey` whenever
 * the instrument commits a row, so a play always starts on fresh
 * elements, never on ones an earlier play or fade left styled.
 *
 * ARIA-HIDDEN, all of it but its words. The trace says nothing a screen
 * reader doesn't get better from the run history under it (a real list,
 * every glyph with its word) and from the sentence here, "Tried at 0, 1
 * and 5 seconds after the start.", which is visually hidden. The codes'
 * gloss and the scale note stay readable: they explain the numbers the
 * run history prints too.
 *
 * PURE: no "use client", no hooks, and only types from the data module,
 * so the server section can use its helpers for the no-script index
 * (`triesSentence`), and the instrument renders it as a leaf of its
 * island. Every word arrives in `copy` and `lanes`; only the axis's unit
 * ("s", as the data module's own templates write it) and the list's
 * "and" (Intl.ListFormat's, in British English) are made here.
 * ------------------------------------------------------------------ */

export type TraceCopy = Pick<BreaksData, "wait" | "silent" | "refused" | "skippedMark" | "codes" | "scale" | "tries">;

/** How a try ended, as its mark draws it. */
export type MarkKind = "ok" | "retry" | "fail" | "refused";

/** Every part a row draws: what the instrument fades out before it draws the next row. */
export const TRACE_DRAWN =
  "[data-mark], [data-answer], [data-axis-tick], [data-wait], [data-silence], [data-silence-label], [data-hatch], [data-skipped]";

/** Each end of a track keeps this much, half a mark and no more, so a mark at 0 or at the end stays whole. */
const PAD = 10;
/** The least room between two of the axis's words, centre to centre. */
const TICK_GAP = 28;
/** Slack's tick sits this far past the CRM step's end: it runs after it. */
const HAIR = 6;

/**
 * The span a row is drawn on, in ms: its whole run and a second more,
 * never less than two seconds (spec §5.4.3; the data module's test holds
 * every row's last try inside it).
 */
export function axisMs(durationMs: number) {
  return Math.max(2000, Math.ceil(durationMs / 1000) * 1000 + 1000);
}

/**
 * When each try ended on the build's clock: at once for an answer; for
 * a silence, where the code's wait before the next try began, or the
 * run's end after the last. Worked out from the row, so the ten seconds
 * the scale note names are the code's, never a constant here.
 */
export function endsOf(row: BreakRow): number[] {
  const last = row.attempts.length - 1;
  return row.attempts.map((a, k) => (k < last ? row.attempts[k + 1].at - (row.waits[k] ?? 0) : row.durationMs));
}

/** A try's mark: taken, tried again after, the last and failed, or refused before it was sent. */
export function markOf(answer: BreakAnswer, retry: boolean): MarkKind {
  if (answer === "unsafe") return "refused";
  if (typeof answer === "number" && answer >= 200 && answer < 300) return "ok";
  return retry ? "retry" : "fail";
}

/** Seconds on the build's clock, as the page prints them: "0", "1", "5", "11". */
function secs(ms: number) {
  return String(Math.round(ms / 100) / 10);
}

const LIST = new Intl.ListFormat("en-GB", { style: "long", type: "conjunction" });

/** "Tried once, at the start." or "Tried at 0, 1 and 5 seconds after the start." */
export function triesSentence(row: BreakRow, tries: TraceCopy["tries"]) {
  if (row.attempts.length === 1) return tries.one;
  return fill(tries.many, { times: LIST.format(row.attempts.map((a) => secs(a.at))) });
}

/** A share of the track as a CSS length, 10px in from each end. */
function place(x: number) {
  return `calc(${PAD}px + (100% - ${2 * PAD}px) * ${Number(x.toFixed(4))})`;
}

/** A share of the track's width, for a span. */
function span(w: number) {
  return `calc((100% - ${2 * PAD}px) * ${Number(Math.max(0, w).toFixed(4))})`;
}

/** The axis's words, each at its tick unless that is within 28px of the one before: then 28px on from it. */
function spread(xs: readonly number[]) {
  const out: string[] = [];
  xs.forEach((x, i) => {
    out.push(i === 0 ? place(x) : `max(${place(x)}, ${out[i - 1]} + ${TICK_GAP}px)`);
  });
  return out;
}

const GLYPH: Record<MarkKind, LucideIcon> = { ok: Check, retry: RotateCw, fail: X, refused: Ban };

/** A word under or over a track: mono 10, on-deep-dim, on one line. */
const WORD = cn(TYPE.mono, "absolute text-[10px] leading-[14px] whitespace-nowrap text-(--home-on-deep-dim)");
/** Over the track, clear of the marks. */
const OVER = "bottom-[calc(50%+12px)]";
/** Under the track, clear of the marks. */
const UNDER = "top-[calc(50%+12px)]";

/** A try, or a step done: the 20px mark, centred on its moment. */
function Mark({ id, kind, x, nudge = 0 }: { id: string; kind: MarkKind; x: number; nudge?: number }) {
  const Icon = GLYPH[kind];
  return (
    <span
      className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
      style={{ left: nudge ? `calc(${place(x)} + ${nudge}px)` : place(x) }}
    >
      <span data-mark={id} data-kind={kind} className="auto-mark">
        <Icon aria-hidden className="size-3" strokeWidth={2.25} />
      </span>
    </span>
  );
}

/**
 * The layer a bead travels in, clipped to its track: the runner is the
 * track's width and moves by shares of itself (GSAP `xPercent`), so a
 * bead lands on its mark at any width, and the clip keeps the runner's
 * moved box from ever widening the page. The CRM's runner also carries
 * the countdown ring that drains beside the bead over a wait.
 */
function Runway({ lane }: { lane: BreakLane }) {
  return (
    <span aria-hidden className="absolute inset-0 overflow-hidden">
      <span data-runner={lane} className="auto-runner">
        <span className="auto-runner-bead" />
        {lane === "crm" && (
          <svg data-countdown viewBox="0 0 14 14" fill="none" className="auto-countdown">
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.8" transform="rotate(-90 7 7)" />
          </svg>
        )}
      </span>
    </span>
  );
}

function Lane({ word, children }: { word: string; children: ReactNode }) {
  return (
    <div className="auto-lane grid h-14 grid-cols-[48px_minmax(0,1fr)] items-center">
      <span className={cn(TYPE.mono, "text-[11px] leading-4 text-(--home-on-deep-dim) uppercase")}>{word}</span>
      <div className="auto-track relative h-full min-w-0">{children}</div>
    </div>
  );
}

export function Trace({
  row,
  lanes,
  copy,
  playKey,
}: {
  row: BreakRow;
  lanes: Record<BreakLane, string>;
  copy: TraceCopy;
  /** Changes whenever the instrument commits a row: the drawing is mounted afresh for it. */
  playKey: number;
}) {
  const axis = axisMs(row.durationMs);
  const x = (ms: number) => ms / axis;
  const ends = endsOf(row);
  const ticks = spread(row.attempts.map((a) => x(a.at)));
  const done = x(row.durationMs);

  return (
    <div className="min-w-0">
      <div key={playKey} aria-hidden className="auto-lanes" data-row={row.id}>
        {/* The tag: the sample's own step, done at the start. */}
        <Lane word={lanes.tag}>
          <Runway lane="tag" />
          <Mark id="tag" kind="ok" x={0} />
        </Lane>

        {/* The CRM: every try the delivery code made, and what it did between them. */}
        <Lane word={lanes.crm}>
          {row.waits.map((ms, k) => {
            const to = row.attempts[k + 1]?.at ?? ends[k] + ms;
            const from = to - ms;
            return (
              <span key={`w${k}`}>
                <span data-wait={k} className="auto-wait" style={{ left: place(x(from)), width: span(x(to) - x(from)) }} />
                <span
                  data-wait={k}
                  className={cn(WORD, OVER, "-translate-x-1/2 text-(--home-lilac)")}
                  style={{ left: place(x((from + to) / 2)) }}
                >
                  {fill(copy.wait, { s: Number(secs(ms)) })}
                </span>
              </span>
            );
          })}
          {row.attempts.map((a, k) =>
            a.answer === "timeout" ? (
              <span key={`s${k}`}>
                <span
                  data-silence={k}
                  className="auto-silence"
                  style={{ left: place(x(a.at)), width: span(x(ends[k]) - x(a.at)) }}
                />
                {/* Every silence is the same ten seconds: named under the first
                    always, and under the rest only where their bars have room. */}
                <span
                  data-silence-label={k}
                  className={cn(WORD, UNDER, "text-(--home-lilac)", k > 0 && "max-md:hidden")}
                  style={{ left: `calc(${place(x(a.at))} - ${PAD}px)` }}
                >
                  {fill(copy.silent, { s: Number(secs(ends[k] - a.at)) })}
                </span>
              </span>
            ) : null,
          )}
          <Runway lane="crm" />
          {row.attempts.map((a, k) => {
            const answer = a.answer === "unsafe" ? copy.refused : typeof a.answer === "number" ? String(a.answer) : null;
            return (
              <span key={`t${k}`}>
                <Mark id={`crm-${k}`} kind={markOf(a.answer, a.retry)} x={x(a.at)} />
                {answer && (
                  <span
                    data-answer={k}
                    className={cn(WORD, UNDER, k > 0 && "-translate-x-1/2")}
                    // The first try's words start at its mark's edge, so they never
                    // spill past the track's start; the rest centre under their mark.
                    style={{ left: k === 0 ? `calc(${place(x(a.at))} - ${PAD}px)` : place(x(a.at)) }}
                  >
                    {answer}
                  </span>
                )}
              </span>
            );
          })}
        </Lane>

        {/* Slack: after the CRM step, or skipped once it has failed. */}
        <Lane word={lanes.slack}>
          {row.ok ? (
            <>
              <Runway lane="slack" />
              <Mark id="slack" kind="ok" x={done} nudge={HAIR} />
            </>
          ) : (
            <>
              <span data-hatch="" className="auto-hatch" style={{ left: place(0), width: span(1) }} />
              <span data-skipped="" className={cn(WORD, UNDER, "right-0")}>
                {copy.skippedMark}
              </span>
            </>
          )}
        </Lane>

        {/* When each try on the CRM started. */}
        <div className="grid h-7 grid-cols-[48px_minmax(0,1fr)]">
          <span />
          <div className="relative min-w-0">
            {row.attempts.map((a, k) => (
              <span key={a.at}>
                <span
                  data-axis-tick={k}
                  className="absolute top-0 h-1.5 border-l border-(--home-on-deep-dim)/50"
                  style={{ left: place(x(a.at)) }}
                />
                <span data-axis-tick={k} className={cn(WORD, "top-2 -translate-x-1/2")} style={{ left: ticks[k] }}>
                  {secs(a.at)} s
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <p className={cn(TYPE.meta, "mt-3 text-pretty text-(--home-on-deep-dim)")}>{copy.codes}</p>
      <p className={cn(TYPE.meta, "mt-1 text-pretty text-(--home-on-deep-dim)")}>{copy.scale}</p>
      <p className="sr-only">{triesSentence(row, copy.tries)}</p>
    </div>
  );
}

