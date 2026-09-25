"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { CHIP, ChipRail, RING_LIGHT, Segmented, centreInRail, useRovingRadio } from "@/components/site/home/controls";
import { TYPE, WEIGHT } from "@/components/site/home/type";
import { usePrefersReducedMotion } from "@/components/site/product/timing";
import { Stack, fill } from "@/components/site/solutions/custom-ai-agents/parts";
import { LiveMesh } from "@/components/site/solutions/custom-saas-platforms/live-mesh";
import type { BlockKind, FieldId, KindShow, LevelId, Sample, WorkData } from "@/lib/pages/custom-automations";
import { FlowGlyph, HandGlyph, KindGlyph } from "./glyphs";
import { MeterRow } from "./meter-row";
import { metersOf } from "./meters";
import { RunLink } from "./run-link";

/* ------------------------------------------------------------------ *
 * #work's instrument: a field and a difficulty on white, and the sample
 * they pick in a pearl room — its six moves by hand and as a flow, what
 * is left for a person, what makes it hard, and where its blocks already
 * run on this platform.
 *
 * THE CONTROLS are two radio groups on white, over the room. "Your
 * field" is six chips in the landing's chip colours (`CHIP`: white on
 * electric, 5.70:1, when chosen), one tab stop with arrow keys that move
 * and pick at once (`useRovingRadio`); on a phone they run in a rail that
 * scrolls sideways edge to edge and brings the chosen one to its middle
 * (the rail only: the page never moves), and from md they wrap. "How
 * hard" is the landing's segmented switch, its white thumb gliding under
 * the level picked, and under it that level's gloss in one line laid
 * over the other two (`Stack`), so the line never jumps and nothing
 * under it moves when the level changes. From lg the two stand side by
 * side, the field on the left and the level in a 420px column on the
 * right, their labels on one line.
 *
 * THE ROOM is a lit surface (saas.css §2) in the hero room's light,
 * mirrored (`roomMirror`, `data-swap`), flowing while on screen
 * (`LiveMesh` at 0.96). Its head is the sample: the tag ("Sample ·
 * Finance · A process", so a sample is never mistaken for a client), the
 * title, who does it by hand today, and the meters, worked out from its
 * blocks (meters.ts), never typed: how many blocks, and whether it takes
 * a rule, AI, a person, a schedule, a guard against doing it twice.
 *
 * THE MOVES PANEL is white on the light (the landing's tokens are safe on
 * it again, so they are named directly, `--home-*`: inside a lit surface
 * the `--pp-*` tokens point at the light's). The same six moves are its
 * rows in every sample, in MOVES' order, and a move a sample doesn't make
 * stays in its place, saying so, so a copy-paste and a pipeline can be
 * read row against row. From md it is a table of three columns: the
 * move, the step by hand, the blocks as a flow. Down its left gutter
 * runs the skeleton, a 2px rail with a dot on each move: filled electric
 * where the move is made, a ring where it isn't, and the rail under a
 * made move electric at 40%, a hairline under one not made — the shape
 * of the job, readable at a glance before a word of it. On a phone each
 * move is a block: its label on the rail, then the step by hand and the
 * blocks under their own small prefixes; a move not made folds into one
 * muted line ("It’s read · Not in this one"). One DOM for both: the
 * rows, row headers and cells are the same elements, and only the
 * prefixes (aria-hidden) and the header row (visually hidden on a phone)
 * change with the width. A block is its kind's glyph (electric, a mark:
 * 5.70), its tag in mono, and its line.
 *
 * UNDER THE PANEL, on the light, what is left for a person, and what
 * makes the job hard (a copy-paste has nothing hard, so it has no cell,
 * and the person's line takes the width). Then the legend, white again:
 * one line per kind of block in the sample, in the order the flow first
 * reaches it. A kind this platform runs says "Runs here" (settled green,
 * 5.50), where, and "Watch it run →", which opens the workbench lens
 * where it runs (`RunLink`, through run-bus.ts) or jumps to the section
 * that shows it (#breaks, the ledger's card for the person told
 * mid-call). A kind it runs thinly or not at all says "Short here" or
 * "Built for yours" (violet, 7.10) and nothing more; the one sentence on
 * why (KINDS_NOTE: a pause of at most thirty seconds, nothing that waits
 * for a person's yes) is printed under the legend only when the sample
 * has a wait or an approval in it, so the page says it once and only
 * where it is true. Where a proof in the legend says "webhook", the
 * plain gloss of the word follows it.
 *
 * THE MOTION is CSS alone (auto-work.css), the slice rule, so it costs
 * the same on every device. Before any pick, each move row plays on its
 * own arrival up the screen: as the row comes up over the fold its dot
 * pops, its rail grows down to the next, and each of its blocks rises
 * 6px as it comes up — a transform only, so a block is always there at
 * full strength and the panel is never an empty or a grey frame, and
 * every row is whole by the time it is 48px clear of the fold. After the
 * reader's first pick the room carries `data-picked`, and the panel is
 * keyed on the sample, so each pick mounts it afresh: the same entrances
 * then play on the clock, row after row (`--o` a row's place of seven),
 * and the meters' pips pop in their order, the whole sample settled in
 * 1.4s. Reduced motion, a browser without view timelines, the
 * lite and still tiers and weak hardware get every move made and every
 * block in place, and a pick is an instant swap.
 *
 * NOTHING ABOVE THE READER MOVES. The room changes height with the
 * sample, and only on the reader's own pick; the controls are above it,
 * so what moves is what is under it. The gloss line holds the tallest of
 * the three glosses. Nothing that can hold focus is ever remounted: the
 * panel that is keyed is text, and focus stays on the chip or the
 * segment that changed the sample.
 *
 * KEYBOARD AND SCREEN READERS. Two radio groups, named by their visible
 * labels ("Your field") or by the same words ("How hard"). The panel is a
 * table named by the sample's title, its first column headed by the
 * caption's own words, whose visible copy is aria-hidden so they are
 * heard once. Each block's tag is followed by a hidden colon ("Rule:
 * Over the approval limit?"), each dot is aria-hidden (the row says
 * whether the move is made in words), and each "Watch it run" link names
 * its kind ("Watch it run: Record"). A pick is announced once, in a
 * polite live region, after the keys have rested ("Finance, A process:
 * Supplier invoices from the inbox into the accounts. 7 blocks."), and
 * nothing is announced on load.
 *
 * THE FINISHED FRAME is the server's: Finance · A process, every move
 * in place, its meters, its legend. With no script the controls do
 * nothing, and the index under the room (work.tsx) holds all eighteen.
 *
 * Every word arrives in `data` (the data module's AUTO_WORK slice, types
 * only here), and every count is filled into its template.
 * ------------------------------------------------------------------ */

/** How long the keys rest before a pick is announced: a held arrow is one announcement, not six. */
const REST_MS = 350;

/** A white plate on the pearl: the hero plates' shadow, a hairline drawn inside so its edge reads on the palest pool. */
const PLATE = "rounded-[20px] bg-white shadow-[0_1px_2px_rgb(20_10_36/0.06),inset_0_0_0_1px_rgb(20_10_36/0.06)]";

/**
 * A field chip: 40px drawn, 44px to a finger (2px past each edge; the
 * rail's 8px gap keeps the next row's target clear where the chips wrap
 * from md), as the #checks filter draws its chips.
 */
const FIELD_CHIP = cn(
  "relative inline-flex h-10 cursor-pointer items-center rounded-full px-4 text-sm whitespace-nowrap",
  "before:absolute before:inset-x-0 before:-inset-y-0.5",
  CHIP.ease,
  RING_LIGHT,
);

/**
 * A move row's columns from md: the move, by hand, as a flow. The row
 * keeps a 20px gutter on its left for the skeleton at every width, so
 * the move's column is 128px here and 148px with it (164px from lg).
 */
const COLUMNS = "md:grid md:grid-cols-[128px_minmax(0,1fr)_minmax(0,1.25fr)] md:gap-x-6 lg:grid-cols-[144px_minmax(0,1fr)_minmax(0,1.25fr)]";

/** A small uppercase word in mono on white: a move's name, a block's tag, a prefix. */
const MONO_TAG = cn(TYPE.mono, "text-[10px] leading-4 text-(--home-muted) uppercase");

/** The sample a field and a level pick: there is one for each pair (the data module's test holds all eighteen). */
function sampleOf(samples: readonly Sample[], field: FieldId, level: LevelId): Sample {
  return samples.find((s) => s.field === field && s.level === level) ?? samples[0];
}

export function WorkInstrument({ data, blobs }: { data: WorkData; blobs: readonly CSSProperties[] }) {
  const reduce = usePrefersReducedMotion();
  const uid = useId();
  const fieldsId = `${uid}-fields`;
  const titleId = `${uid}-title`;

  const [choice, setChoice] = useState<{ field: FieldId; level: LevelId }>(data.initial);
  // Set by the reader's first pick: from then on the panel replays on the
  // clock (auto-work.css §3) instead of on its passage up the screen.
  const [picked, setPicked] = useState(false);
  // What the live region last said: empty until the reader picks.
  const [said, setSaid] = useState("");
  const rest = useRef(0);
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timers = rest;
    return () => window.clearTimeout(timers.current);
  }, []);

  const sample = sampleOf(data.samples, choice.field, choice.level);
  const fieldIndex = data.fields.findIndex((f) => f.id === choice.field);
  const levelIndex = data.levels.findIndex((l) => l.id === choice.level);
  const fieldLabel = data.fields[fieldIndex]?.label ?? "";
  const levelLabel = data.levels[levelIndex]?.label ?? "";

  /** The sample's blocks in the order its moves make them, and the kinds among them in the order the flow first reaches each. */
  const { blocks, kinds } = useMemo(() => {
    const all = data.moves.flatMap((m) => sample.moves[m.id]?.flow ?? []).map((b) => b.kind);
    return { blocks: all, kinds: [...new Set(all)] };
  }, [data.moves, sample]);
  const meters = useMemo(() => metersOf(blocks), [blocks]);
  // The one sentence on a wait or an approval, only where the sample has one.
  const thin = kinds.some((k) => data.kinds[k].ours !== "does");
  // The plain gloss of "webhook", only where a proof in the legend uses the word.
  const glossed = kinds.some((k) => /\bwebhooks?\b/i.test(data.kinds[k].proof ?? ""));

  /** Shows a sample: the room swaps to it now, and the live region says so once the keys rest. */
  function show(field: FieldId, level: LevelId) {
    if (field === choice.field && level === choice.level) return;
    const next = sampleOf(data.samples, field, level);
    const words = fill(data.live, {
      field: data.fields.find((f) => f.id === field)?.label ?? "",
      level: data.levels.find((l) => l.id === level)?.label ?? "",
      title: next.title,
      blocks: data.moves.reduce((n, m) => n + (next.moves[m.id]?.flow.length ?? 0), 0),
    });
    setChoice({ field, level });
    setPicked(true);
    window.clearTimeout(rest.current);
    rest.current = window.setTimeout(() => setSaid(words), REST_MS);
  }

  function pickField(i: number) {
    const next = data.fields[i]?.id;
    if (!next) return;
    // On a phone the rail scrolls: bring the chosen chip to its middle
    // (the rail only; the page never moves).
    const rail = railRef.current;
    const chip = rail?.querySelector<HTMLElement>(`[data-field="${next}"]`);
    if (rail && chip && rail.scrollWidth > rail.clientWidth) centreInRail(rail, chip, reduce);
    show(next, choice.level);
  }

  const radio = useRovingRadio({
    count: data.fields.length,
    index: fieldIndex,
    orientation: "horizontal",
    onChange: (i) => pickField(i),
  });

  return (
    <>
      {/* ── The controls ── on white. From lg side by side, their labels
          on one line and the chips level with the switch; below lg the
          level's block under the field's. */}
      <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-start lg:gap-8">
        <div className="min-w-0">
          <p id={fieldsId} className={cn(TYPE.label, "text-pp-muted")}>
            {data.fieldsLabel}
          </p>
          {/* On a phone a rail that scrolls sideways edge to edge; from md
              the chips wrap where they must (one row at md, where the level
              is under them, two at lg, one again from xl). 10px under
              the label, and the rail's own 4px, put the chips' middle level
              with the switch's beside them. */}
          <ChipRail
            labelledBy={fieldsId}
            railRef={railRef}
            className="mt-2.5 md:flex-wrap md:snap-none md:overflow-visible"
          >
            {data.fields.map((f, i) => {
              const on = i === fieldIndex;
              return (
                <button
                  key={f.id}
                  type="button"
                  data-field={f.id}
                  {...radio.getItemProps(i)}
                  className={cn(FIELD_CHIP, on ? CHIP.on : CHIP.off)}
                >
                  {f.label}
                </button>
              );
            })}
          </ChipRail>
        </div>

        <div className="min-w-0">
          <p className={cn(TYPE.label, "text-pp-muted")}>{data.levelLabel}</p>
          {/* The whole width on a phone, at most 420px from md. A phone's
              segments give up their side padding, and under 360px a
              pixel of type, so "A copy-paste" sits inside a third of a
              320px window with air either side: 89px of words at 14px ran
              past a 93px segment's padding, 82px at 13px don't. */}
          <Segmented
            label={data.levelLabel}
            options={data.levels}
            value={choice.level}
            onChange={(level) => show(choice.field, level)}
            className="mt-3 w-full md:max-w-[420px] max-sm:[&>button]:px-1 max-[359px]:[&>button]:text-[13px]"
          />
          {/* The level's gloss, laid over the other two so the line holds
              the tallest and nothing under it moves. No entrance of its own:
              the switch's thumb is the motion here. */}
          <Stack
            className="mt-2"
            items={data.levels}
            live={Math.max(0, levelIndex)}
            swap={false}
            render={(l) => <p className={cn(TYPE.meta, "text-pretty")}>{l.gloss}</p>}
          />
        </div>
      </div>

      {/* ── The room ── */}
      <div
        className="auto-work saas-lit saas-light-room-m mt-6 p-5 md:p-8 lg:p-10"
        data-swap=""
        data-picked={picked ? "" : undefined}
      >
        <LiveMesh blobs={blobs} drift={0.96} />
        <span aria-hidden className="home-grain" />

        {/* The head: on the light, in its own tokens. */}
        <div className="min-w-0">
          <p className={cn(TYPE.label, "text-(--saas-dim)")}>{fill(data.tag, { field: fieldLabel, level: levelLabel })}</p>
          <h3
            id={titleId}
            className={cn(TYPE.h3, "mt-2 text-balance text-(--saas-text)")}
            style={{ fontWeight: WEIGHT.h3 }}
          >
            {sample.title}
          </h3>
          <p className={cn(TYPE.meta, "mt-1 text-pretty text-(--saas-dim)")}>{sample.who}</p>
          {/* Keyed on the sample, so after a pick its pips pop in again (auto-work.css §4). */}
          <MeterRow key={sample.id} meters={meters} copy={data.meters} tone="lit" className="mt-3" />
        </div>

        <MovesPanel key={sample.id} data={data} sample={sample} titleId={titleId} />

        {/* What stays a person's, and what makes it hard: on the light. */}
        <dl className={cn("mt-6 grid gap-6", sample.hard && "md:grid-cols-2")}>
          <div className="min-w-0">
            <dt className={cn(TYPE.label, "text-(--saas-accent)")}>{data.person}</dt>
            <dd className={cn(TYPE.body, "mt-2 text-pretty text-(--saas-text)")}>{sample.person}</dd>
          </div>
          {sample.hard && (
            <div className="min-w-0">
              <dt className={cn(TYPE.label, "text-(--saas-accent)")}>{data.hard}</dt>
              <dd className={cn(TYPE.body, "mt-2 text-pretty text-(--saas-text)")}>{sample.hard}</dd>
            </div>
          )}
        </dl>

        {/* ── The legend ── white: where each kind of block in the sample already runs. */}
        <div className={cn(PLATE, "mt-6 p-4 md:p-6")}>
          <h4 className={cn(TYPE.label, "text-(--home-muted)")}>{data.proofTitle}</h4>
          {/* Two columns from md: one would leave the plate's right half
              empty beside a short proof. */}
          <ul className="mt-4 grid gap-x-8 gap-y-5 md:grid-cols-2">
            {kinds.map((k) => (
              <LegendItem key={k} data={data} kind={k} />
            ))}
          </ul>
          {glossed && <p className={cn(TYPE.meta, "mt-5 text-pretty text-(--home-muted)")}>{data.gloss}</p>}
          {thin && (
            <p className={cn(TYPE.meta, glossed ? "mt-2" : "mt-5", "text-pretty text-(--home-muted)")}>{data.kindsNote}</p>
          )}
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {said}
      </p>
    </>
  );
}

/**
 * The six moves, by hand and as a flow: a table from md, a block per move
 * on a phone (the header comment above). Keyed on the sample by its
 * parent, so a pick mounts it afresh and its entrances replay.
 */
function MovesPanel({ data, sample, titleId }: { data: WorkData; sample: Sample; titleId: string }) {
  const last = data.moves.length - 1;
  return (
    <div className={cn(PLATE, "auto-moves mt-6 p-4 md:p-6")}>
      {/* The caption's words are the first column's header, below: heard
          there, once. */}
      <p aria-hidden className={cn(TYPE.label, "text-(--home-muted)")}>
        {data.movesCaption}
      </p>
      <div role="table" aria-labelledby={titleId} className="mt-3">
        <div role="row" className={cn("pb-2 pl-5 max-md:sr-only", COLUMNS)}>
          {/* In the grid as an empty cell over the moves; only its words are hidden. */}
          <span role="columnheader">
            <span className="sr-only">{data.movesCaption}</span>
          </span>
          <span role="columnheader" className={cn(TYPE.label, "flex items-center gap-1.5 text-(--home-muted)")}>
            <HandGlyph className="text-(--home-electric)" />
            {data.hand}
          </span>
          <span role="columnheader" className={cn(TYPE.label, "flex items-center gap-1.5 text-(--home-muted)")}>
            <FlowGlyph className="text-(--home-electric)" />
            {data.flow}
          </span>
        </div>

        {data.moves.map((m, i) => {
          const move = sample.moves[m.id];
          // Its turn on the clock after a pick (auto-work.css §3); before one, each row plays as it arrives (§2).
          const slice = { "--o": i / 7 } as CSSProperties;
          const skeleton = (
            <>
              {/* The rail from this move's dot down to the next one's, under the dots. */}
              {i < last && <span aria-hidden className="auto-spine" />}
              <span aria-hidden className="auto-move-dot" />
            </>
          );

          if (!move) {
            // Not made: one muted line on a phone, "—" and the words from md.
            return (
              <div
                key={m.id}
                role="row"
                className={cn(
                  "auto-move relative flex flex-wrap items-baseline gap-x-1.5 border-t border-pp-rule py-3 pl-5 md:items-start",
                  COLUMNS,
                )}
                style={slice}
              >
                {skeleton}
                <span role="rowheader" className={cn(MONO_TAG, "pt-[3px] text-[11px]")}>
                  {m.label}
                </span>
                <span role="cell" className="max-md:sr-only md:text-[15px] md:leading-[22px] md:text-(--home-muted)">
                  <span aria-hidden>—</span>
                  <span className="sr-only">{data.absent}</span>
                </span>
                <span role="cell" className={cn(TYPE.meta, "text-(--home-muted) md:pt-0.5")}>
                  <span aria-hidden className="md:hidden">
                    ·{" "}
                  </span>
                  {data.absent}
                </span>
              </div>
            );
          }

          return (
            <div
              key={m.id}
              role="row"
              data-made=""
              className={cn("auto-move relative grid gap-y-1.5 border-t border-pp-rule py-3 pl-5 md:gap-y-0", COLUMNS)}
              style={slice}
            >
              {skeleton}
              <span role="rowheader" className={cn(MONO_TAG, "pt-[3px] text-[11px]")}>
                {m.label}
              </span>
              <p role="cell" className="text-[15px] leading-[22px] text-pretty text-(--home-ink)/80">
                <span aria-hidden className={cn(MONO_TAG, "mr-2 md:hidden")}>
                  {data.hand}
                </span>
                {move.hand}
              </p>
              <div role="cell" className="min-w-0 max-md:mt-1 md:pt-px">
                <span aria-hidden className={cn(MONO_TAG, "mb-1.5 block md:hidden")}>
                  {data.flow}
                </span>
                <ul className="flex flex-col gap-1.5">
                  {move.flow.map((b, k) => (
                    <li
                      key={k}
                      className="auto-block grid grid-cols-[auto_minmax(0,1fr)] gap-x-1.5"
                      style={{ "--b": k } as CSSProperties}
                    >
                      <KindGlyph kind={b.kind} className="mt-[3px] text-(--home-electric)" />
                      <span className="text-[14px] leading-5 text-pretty text-(--home-ink)">
                        <span className={cn(MONO_TAG, "mr-1.5")}>{data.kinds[b.kind].tag}</span>
                        <span className="sr-only">: </span>
                        {b.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** "Watch it run →", as the #checks rows set their links: 18px of text in a 24px box, a 44px target. */
const WATCH = cn(
  "home-link group relative mt-1.5 inline-block min-h-6 rounded-sm py-[3px] text-[13px] leading-[18px]",
  "before:absolute before:inset-x-0 before:-inset-y-2.5",
  RING_LIGHT,
);

/**
 * Where a kind runs: a workbench lens opens in the workbench (`RunLink`);
 * an anchor (#breaks, a ledger card) is a plain jump. The link's name
 * carries the kind, so a list of them never reads as six of the same.
 */
function Watch({ show, label, tag }: { show: KindShow; label: string; tag: string }) {
  const words = (
    <>
      {label}
      <span className="sr-only">: {tag}</span>
      <span aria-hidden className="ml-1 inline-block transition-transform duration-200 group-hover:translate-x-0.5">
        →
      </span>
    </>
  );
  if ("lens" in show) {
    return (
      <RunLink lens={show.lens} className={WATCH}>
        {words}
      </RunLink>
    );
  }
  return (
    <a href={show.href} className={WATCH}>
      {words}
    </a>
  );
}

/** One kind of block in the legend: its glyph and tag, whether it runs here, and if it does, where. */
function LegendItem({ data, kind }: { data: WorkData; kind: BlockKind }) {
  const info = data.kinds[kind];
  const runs = info.ours === "does";
  return (
    <li className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-2.5">
      <KindGlyph kind={kind} className="mt-px text-(--home-electric)" />
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-x-2.5">
          <span className={MONO_TAG}>{info.tag}</span>
          <span className="sr-only">: </span>
          <span className={cn(MONO_TAG, runs ? "text-(--home-settled)" : "text-(--home-violet)")}>{data.ours[info.ours]}</span>
        </p>
        {info.ours === "does" && (
          <>
            <p className={cn(TYPE.meta, "mt-1 text-pretty text-(--home-ink)/80")}>{info.proof}</p>
            <Watch show={info.show} label={data.watch} tag={info.tag} />
          </>
        )}
      </div>
    </li>
  );
}
