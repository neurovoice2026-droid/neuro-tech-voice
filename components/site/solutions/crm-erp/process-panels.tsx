import { memo } from "react";
import { cn } from "@/lib/utils";
import { TYPE } from "@/components/site/home/type";
import { Stack, fill } from "@/components/site/solutions/custom-ai-agents/parts";
import type { ProcessStep, ProcessView } from "@/lib/pages/crm-erp";
import { ErpTag, HandGlyph, LaneGlyph } from "./glyphs";
import { LAST, pad2, type DrawFrame, type RowState, type StageData } from "./process-frame";
import { ScreenView } from "./record-screens";

/* ------------------------------------------------------------------ *
 * #process — the two panels under the drawing: the caption card (what
 * this step is, who does it, today and in one system, and whether it
 * already runs here), and the record panel (Today's hand-offs, or the
 * sample's one system: the customer's record window).
 *
 * THEY NEVER CHANGE HEIGHT. The stage is the same height before, during
 * and after a tour, in either view (deferred.tsx reserves it once), so
 * everything here that changes is laid over every variant it can take:
 *   - the caption card lays the intro and the step over each other, as
 *     tall as the taller; the step's words are two `Stack`s over the
 *     eight steps (what the step is, then "On ours"), and under them its
 *     link, one persistent element whose words and target change, so a
 *     reader's focus on it is never dropped as the step changes. Within
 *     a step the Today and In one system lines are both always printed,
 *     the current view's in ink and the other muted (erp-process.css §3),
 *     and "Who" keeps the room of both its words (the lane's, and its
 *     Today word: "By itself" is someone's hand today), so a switch
 *     changes a colour and a word, and nothing moves;
 *   - the record panel is its two views in one grid cell, as tall as the
 *     taller (the window), the view not on show faded out and under the
 *     other by the stage's `data-view` (erp-process.css §4), and
 *     `aria-hidden` here, its one button inert. Hidden, not unmounted:
 *     the hotspot is one persistent button, and a reader's focus on it
 *     is never dropped;
 *   - in the window, the status chip is a `Stack` over the eight
 *     statuses; the screen a `Stack` over the eight screens; the history
 *     always eight rows, each keeping room for the wider of its lane and
 *     "To come"; and the hotspot keeps room for the longest of its eight
 *     labels. So a step changes words and colours, never a line break
 *     that would move the row under it.
 *
 * THE WINDOW, in a product's grammar: its chrome (three dots and "Your
 * system · sample"), a header strip that stays put while the body
 * changes (the pill "One customer record", which the tour's "Typed
 * again" marks fly into, the customer with a grey-bar avatar, and the
 * order's status), the body (the step's screen beside the customer's
 * history, stacked where the panel is narrow: a container query on the
 * panel, whose width is the stage's below lg and five eighths of it
 * from lg), and the foot: the ringed hotspot, which moves the order on,
 * and its hint.
 *
 * TODAY'S PANEL, in the window's place: each hand-off where the same
 * details are typed again or counted by hand, with the two tools it runs
 * between, and at its foot, where the hotspot stands in One system, a
 * ringed "One system →" that switches the view.
 *
 * PURE. No "use client" and no hooks, and only types from the data
 * module. The stage (process-stage.tsx, the client island) renders both
 * panels from the frame (process-frame.ts), so the server's first paint
 * and every render after draw the same thing for the same place. The
 * focus ring is written out, not imported from the landing's controls,
 * which are a client module.
 * ------------------------------------------------------------------ */

/** controls.tsx RING_LIGHT, spelled out: this module is pure, and controls.tsx is a client module. */
const RING = "rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink";

/** A label: the landing's label role, muted. */
const LABEL = cn(TYPE.label, "text-pp-muted");

/** The two panels' card: white, 20px round, a hairline and the landing's soft drop. */
const CARD = "rounded-[20px] bg-white shadow-[0_0_0_1px_rgb(20_10_36/0.08),0_1px_2px_rgb(20_10_36/0.04)]";

/** "Step 4 of 8 · Order": a step's mark line, and the caption card's name. */
export const markOf = (data: StageData, i: number) =>
  `${fill(data.stepOf, { n: i + 1, total: data.steps.length })} · ${data.steps[i].label}`;

/**
 * Who does a step, in a view: the lane's words ("Sales", "Operations",
 * "Accounts", "By itself"), or, in Today, the lane's Today word where it
 * has one: what runs by itself in one system is someone's hand today.
 */
export function laneWord(data: Pick<StageData, "lanes">, s: ProcessStep, view: ProcessView) {
  const l = data.lanes.find((x) => x.id === s.lane);
  if (!l) return s.lane;
  const today = "today" in l && typeof l.today === "string" ? l.today : l.label;
  return view === "today" ? today : l.label;
}

/* ─── The caption card ────────────────────────────────────────────── */

/**
 * What a step is and who does it, and its two lines: the top of the
 * step's caption. Memoised, as the stacks' leaves all are: a new frame
 * redraws only what it changes, and a switch of view none of it (which
 * of "Who"'s two words shows, and which line is in ink, is the stage's
 * `data-view`'s, erp-process.css §3).
 */
const StepTop = memo(function StepTop({ data, i }: { data: StageData; i: number }) {
  const s = data.steps[i];
  const words = { today: laneWord(data, s, "today"), one: laneWord(data, s, "one") };
  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className={cn(TYPE.mono, "text-pp-muted")}>{markOf(data, i)}</p>
        <p className="flex items-center gap-2">
          <span className={LABEL}>{data.caption.who}</span>
          <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-(--home-chip) pr-2.5 pl-2 text-[12px] leading-4 whitespace-nowrap text-pp-ink">
            <LaneGlyph id={s.lane} className="text-(--home-electric)" />
            {/* Both words in one cell: the chip keeps the wider's room in either view, and the view
                not on show hides its word (visibility, so a screen reader skips it too). */}
            <span className="grid">
              <span data-word="today" className="erp-who-word [grid-area:1/1]">
                {words.today}
              </span>
              <span data-word="one" className="erp-who-word [grid-area:1/1]">
                {words.one}
              </span>
            </span>
          </span>
        </p>
      </div>
      <dl className="mt-4 flex flex-col gap-3">
        <div className="erp-line" data-line="today">
          <dt className={LABEL}>{data.caption.today}</dt>
          <dd className={cn(TYPE.body, "erp-line-text mt-1 text-pretty xl:text-[16px] xl:leading-6")}>{s.today}</dd>
        </div>
        <div className="erp-line" data-line="one">
          <dt className={LABEL}>{data.caption.system}</dt>
          <dd className={cn(TYPE.body, "erp-line-text mt-1 text-pretty xl:text-[16px] xl:leading-6")}>{s.system}</dd>
        </div>
      </dl>
    </div>
  );
});

/** "On ours": the tag, and the fact. */
const StepOurs = memo(function StepOurs({ data, i }: { data: StageData; i: number }) {
  const s = data.steps[i];
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className={LABEL}>{data.caption.ours}</p>
        <ErpTag kind={s.kind} copy={data.kinds} tone="white" />
      </div>
      <p className="mt-2 text-[13px] leading-[19px] text-pretty text-pp-ink/80">{s.ours}</p>
    </div>
  );
});

/**
 * The step's link to the #core card that proves its "On ours": one
 * element whatever the step, its words and target changing, so focus on
 * it is never dropped. Worded by the card it opens (coreKinds), not by the
 * step's own kind: stock, built for yours, links to the booking rule that
 * runs here. Every wording laid in one cell, so it keeps the widest's room.
 */
function SeeLink({ data, i }: { data: StageData; i: number }) {
  const s = data.steps[i];
  const words = [...new Set(Object.values(data.caption.see))];
  const see = data.caption.see[data.coreKinds[s.core]];
  return (
    <a href={`#core-${s.core}`} className={cn("group -mb-2.5 grid min-h-11 items-center self-start text-[14px] leading-[21px] text-pp-ink", RING)}>
      <span className="inline-flex items-center gap-1 [grid-area:1/1]">
        <span className="home-link">{see}</span>
        <span aria-hidden className="inline-block transition-transform duration-200 group-hover:translate-y-0.5">
          ↓
        </span>
      </span>
      {words.map((w) => (
        <span key={w} aria-hidden className="invisible [grid-area:1/1]">
          {w} ↓
        </span>
      ))}
    </a>
  );
}

/**
 * The intro, before a step is picked: the line, then the eight places the
 * same customer lives today, each the tool it lives in and where. The
 * drawing above is aria-hidden; this is Today's scatter in words.
 */
const IntroCaption = memo(function IntroCaption({ data }: { data: StageData }) {
  return (
    <div className="flex min-w-0 flex-col">
      <p className={cn(TYPE.mono, "text-pp-muted")}>{data.intro.mark}</p>
      <p className="mt-2 text-[17px] leading-[25px] tracking-[-0.005em] text-pretty text-pp-ink lg:text-[18px] lg:leading-[27px]">
        {data.intro.text}
      </p>
      <ol className="mt-4 flex flex-col gap-1.5 border-t border-pp-rule pt-3.5">
        {data.steps.map((s, i) => (
          <li key={s.id} className="flex min-w-0 items-baseline gap-2.5 text-[13px] leading-[18px]">
            <span aria-hidden className={cn(TYPE.mono, "text-[11px] leading-[18px] text-(--home-violet)")}>
              {pad2(i + 1)}
            </span>
            <span className="text-pp-ink">{s.paper.title}</span>
            {/* Never cut: where the row has no room (a 320 phone, a reader's own text spacing) it wraps. */}
            <span className={cn(TYPE.mono, "min-w-0 text-[11px] leading-[18px] text-pretty text-pp-muted")}>
              <span className="sr-only">, </span>
              {s.paper.where}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
});

/**
 * The caption card: the intro, or the step the reader is on, as a group
 * named by its mark line ("Step 4 of 8 · Order"), the two laid in one
 * cell (the one not on show hidden and inert). The step's words follow
 * each other down the card, "On ours" right under its lines, whatever
 * height the card is stretched to beside the record panel: what it has
 * spare stands at its foot, under the link to the #core card that proves
 * the step's "On ours". `swap` false (lite and still): the words change
 * at once.
 */
export function CaptionCard({
  data,
  frame,
  swap = true,
  className,
}: {
  data: StageData;
  frame: DrawFrame;
  swap?: boolean;
  className?: string;
}) {
  const step = frame.caption === 0 ? null : frame.caption - 1;
  const name = step === null ? data.intro.mark : markOf(data, step);
  // The step layer shows the last step while the intro is on show: hidden, and inert.
  const at = step ?? LAST;
  return (
    <div role="group" aria-label={name} className={cn(CARD, "erp-caption grid min-w-0 grid-cols-[minmax(0,1fr)] content-start p-5 md:p-6", className)}>
      <div key={step === null ? "intro" : "step"} inert={step !== null} className={cn("min-w-0 [grid-area:1/1]", step !== null ? "invisible" : swap && "ind-swap")}>
        <IntroCaption data={data} />
      </div>
      <div inert={step === null} className={cn("flex min-w-0 flex-col [grid-area:1/1]", step === null && "invisible")}>
        <Stack
          className="grid-cols-[minmax(0,1fr)]"
          items={data.steps}
          live={at}
          swap={swap}
          render={(_, i) => <StepTop data={data} i={i} />}
        />
        <div className="mt-4 flex min-w-0 flex-col border-t border-pp-rule pt-3.5">
          <Stack className="grid-cols-[minmax(0,1fr)]" items={data.steps} live={at} swap={swap} render={(_, i) => <StepOurs data={data} i={i} />} />
          <SeeLink data={data} i={at} />
        </div>
      </div>
    </div>
  );
}

/* ─── The record panel ────────────────────────────────────────────── */

/** The hotspot's shape: a 44px white pill, ringed in electric 2px clear of it (erp-process.css §4), its focus ring outside the ring. */
const HOT = cn(
  "erp-hot relative inline-flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-white px-4 text-[14px] leading-5 font-medium text-pp-ink",
  "transition-[background-color,scale] duration-200 hover:bg-(--home-wash) active:scale-[0.97]",
  "focus-visible:outline-2 focus-visible:outline-offset-[5px] focus-visible:outline-pp-ink",
);

/** Today's hand-offs, their words fixed: memoised, so a switch of view redraws none of them. */
const TodayList = memo(function TodayList({ data }: { data: StageData }) {
  const step = (id: ProcessStep["id"]) => data.steps.find((s) => s.id === id);
  return (
    <ul className="mt-3 flex flex-col">
      {data.handoffs.map((h) => {
        const [from, to] = [step(h.from), step(h.to)];
        return (
          <li
            key={`${h.from}-${h.to}`}
            className="grid grid-cols-[28px_minmax(0,1fr)] gap-x-2.5 border-t border-pp-rule py-2.5 first:border-t-0"
          >
            <span aria-hidden className="mt-px grid size-6 place-items-center rounded-full bg-(--home-ember-soft) text-(--home-ember)">
              <HandGlyph />
            </span>
            <div className="min-w-0">
              {/* The steps, the two tools the details are copied between, and the mark: one
                  line where the panel is wide, wrapping where it isn't. */}
              <p className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <span className="text-[15px] leading-[22px] font-medium text-pp-ink">
                  {from?.label} <span aria-hidden>→</span>
                  <span className="sr-only">to</span> {to?.label}
                </span>
                <span className={cn(TYPE.mono, "text-[11px] leading-4 text-pp-muted")}>
                  {from?.paper.where} <span aria-hidden>→</span>
                  <span className="sr-only">to</span> {to?.paper.where}
                </span>
                <span className="ml-auto text-[12px] leading-4 text-(--home-ember-ink)">{data.marks[h.mark]}</span>
              </p>
              <p className="mt-1 text-[13px] leading-[19px] text-pretty text-pp-ink/80">{h.text}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
});

/**
 * Today: where the same details are typed again, or counted by hand, as
 * the work moves — each hand-off with the two tools it runs between —
 * and, at its foot, the way into one system: a ringed button in the
 * hotspot's place, which switches the view as the switch above does.
 */
function TodayPanel({ data, hidden, onView }: { data: StageData; hidden: boolean; onView: () => void }) {
  const one = data.views.find((v) => v.id === "one")?.label ?? "";
  return (
    <div role="group" aria-labelledby="erp-today-title" aria-hidden={hidden || undefined} className="erp-record-today flex min-w-0 flex-col">
      <div className="px-5 pt-5 md:px-6 md:pt-6">
        <h3 id="erp-today-title" className="text-[17px] leading-[24px] font-medium text-balance text-pp-ink">
          {data.record.todayTitle}
        </h3>
        <TodayList data={data} />
      </div>
      <div className="erp-window-foot mt-auto border-t border-pp-rule px-4 py-[7px]">
        <button type="button" onClick={onView} data-erp-hot="view" inert={hidden} className={HOT}>
          {one}
          <span aria-hidden>→</span>
        </button>
        <p className={cn(TYPE.meta, "erp-window-hint min-w-0 text-pretty")}>{data.record.todayFoot}</p>
      </div>
    </div>
  );
}

/** A history row's node: filled for a step reached, ringed for the current one, dotted for one to come. */
function RowNode() {
  return <span aria-hidden className="erp-row-node mt-[5px] block size-2 shrink-0 rounded-full" />;
}

/** One row of the customer's history: memoised, so a frame redraws only the rows whose state it changes. */
const HistoryRow = memo(function HistoryRow({ step, state, lane, toCome }: { step: ProcessStep; state: RowState; lane: string; toCome: string }) {
  return (
    <li
      data-state={state}
      aria-current={state === "current" ? "step" : undefined}
      className="erp-row grid grid-cols-[8px_minmax(0,1fr)_auto] gap-x-2.5 text-[13px] leading-[18px]"
    >
      <RowNode />
      <span className="erp-row-text min-w-0 text-pretty">
        {step.history}
        {state === "tocome" && <span className="sr-only"> (to come)</span>}
      </span>
      {/* The lane, or "To come": both laid in one cell, so the row keeps the wider's room whatever it says. */}
      <span className={cn(TYPE.mono, "grid text-right text-[11px] leading-[18px] text-pp-muted")}>
        <span className={cn("[grid-area:1/1]", state === "tocome" && "invisible")}>{lane}</span>
        <span aria-hidden className={cn("[grid-area:1/1]", state !== "tocome" && "invisible")}>
          {toCome}
        </span>
      </span>
    </li>
  );
});

function RecordWindow({ data, frame, swap, onGo }: { data: StageData; frame: DrawFrame; swap: boolean; onGo: () => void }) {
  const go = data.steps[frame.screen].go;
  const paid = data.steps[LAST].status;
  const hidden = frame.view !== "one";
  return (
    <div role="group" aria-labelledby="erp-record-pill" aria-hidden={hidden || undefined} className="erp-record-one erp-window flex min-w-0 flex-col">
      {/* The chrome: three dots and the window's name. */}
      <div aria-hidden className="flex h-8 items-center gap-3 border-b border-pp-rule px-4">
        <span className="flex gap-1.5">
          <span className="size-1.5 rounded-full bg-pp-ink/12" />
          <span className="size-1.5 rounded-full bg-pp-ink/12" />
          <span className="size-1.5 rounded-full bg-pp-ink/12" />
        </span>
        <span className={cn(TYPE.mono, "truncate text-pp-muted")}>{data.record.chrome}</span>
      </div>

      {/* The header strip: the record, which stays put while the body changes. The pill
          and the customer share the avatar's line where the window has the room (from
          about 490px), and the customer goes under the pill where it hasn't. Where the
          window is narrow the avatar goes, then the status drops under the customer
          (erp-process.css §4), so the pill keeps its one line. */}
      <div className="erp-record-head flex items-center gap-x-3 gap-y-2 border-b border-pp-rule px-4 py-2.5">
        <span aria-hidden className="erp-record-avatar size-9 shrink-0 rounded-full bg-pp-ink/8" />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          {/* The window's name, and the panel's heading, as Today's title is in its place: the
              step's screen under it is an h4 (record-screens.tsx). */}
          <h3 className="flex">
            <span
              id="erp-record-pill"
              className="erp-pill inline-flex h-5 items-center rounded-full bg-(--home-electric)/10 px-2 text-[12px] leading-4 font-normal whitespace-nowrap text-(--home-violet)"
            >
              {data.record.pill}
            </span>
          </h3>
          {/* Its words never change, so on a narrow phone it wraps rather than cut off beside the widest status. */}
          <p className="min-w-0 text-[15px] leading-[22px] font-medium text-pretty text-pp-ink">{data.record.customer}</p>
        </div>
        <div className="erp-record-status flex shrink-0 flex-col items-end gap-1">
          <p className={LABEL}>{data.record.statusLabel}</p>
          <Stack
            className="justify-items-end"
            items={data.steps}
            live={frame.status}
            swap={swap}
            render={(s) => (
              <p
                className={cn(
                  "inline-flex h-6 items-center rounded-full px-2.5 text-[12px] leading-4 font-medium whitespace-nowrap",
                  s.status === paid ? "bg-(--home-settled-soft) text-(--home-settled)" : "bg-(--home-stage) text-(--home-violet)",
                )}
              >
                {s.status}
              </p>
            )}
          />
        </div>
      </div>

      {/* The body: the step's screen beside the customer's history, or over it where the window is narrow. */}
      <div className="erp-window-body flex-1 px-4 pt-3.5 pb-4">
        <Stack
          className="erp-window-screen min-w-0"
          items={data.steps}
          live={frame.screen}
          swap={false}
          render={(s) => <ScreenView screen={s.screen} className="erp-screen" />}
        />
        <div className="erp-window-history min-w-0">
          <p id="erp-history-title" className={LABEL}>
            {data.record.history}
          </p>
          <ul aria-labelledby="erp-history-title" className="mt-2.5 flex flex-col gap-1.5">
            {data.steps.map((s, i) => (
              <HistoryRow
                key={s.id}
                step={s}
                state={frame.rows[i]}
                lane={data.lanes.find((l) => l.id === s.lane)?.label ?? s.lane}
                toCome={data.record.toCome}
              />
            ))}
          </ul>
        </div>
      </div>

      {/* The foot: the ringed hotspot moves the order on. One button whose
          words change, as wide as its longest label, so focus stays on it
          and nothing beside it moves. 7px round it: its focus ring (5px
          out, 2px wide) just clear of the card's clip. */}
      <div className="erp-window-foot border-t border-pp-rule px-4 py-[7px]">
        <button type="button" onClick={onGo} aria-label={go.aria} data-erp-hot="go" inert={hidden} className={HOT}>
          <span className="grid">
            <span className="[grid-area:1/1]">{go.label}</span>
            {data.steps.map((s) => (
              <span key={s.id} aria-hidden className="invisible [grid-area:1/1]">
                {s.go.label}
              </span>
            ))}
          </span>
          <span aria-hidden>→</span>
        </button>
        <p className={cn(TYPE.meta, "erp-window-hint min-w-0 text-pretty")}>{data.record.hint}</p>
      </div>
    </div>
  );
}

/**
 * The record panel: Today's hand-offs, or the sample's one system, in
 * one cell, the other view hidden by the stage's `data-view`. `onGo` is
 * the hotspot: the stage moves the order on. `onView` is Today's way in:
 * the stage switches to One system. `swap` false (lite and still): the
 * order's status changes at once.
 */
export function RecordPanel({
  data,
  frame,
  swap = true,
  onGo,
  onView,
  className,
}: {
  data: StageData;
  frame: DrawFrame;
  swap?: boolean;
  onGo: () => void;
  onView: () => void;
  className?: string;
}) {
  return (
    <div className={cn(CARD, "erp-record grid min-w-0 overflow-clip", className)}>
      <TodayPanel data={data} hidden={frame.view !== "today"} onView={onView} />
      <RecordWindow data={data} frame={frame} swap={swap} onGo={onGo} />
    </div>
  );
}
