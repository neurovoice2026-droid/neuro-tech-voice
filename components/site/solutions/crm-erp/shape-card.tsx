import type { CSSProperties, ReactNode } from "react";
import { ChartColumn, ChartColumnDecreasing, ChartColumnStacked, ChartLine, Table2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE, WEIGHT } from "@/components/site/home/type";
import { Stack, fill } from "@/components/site/solutions/custom-ai-agents/parts";
import type { ReportChart, ScopeId, ShapeData, ShapePart, ShapeSample } from "@/lib/pages/crm-erp";
import { ErpTag } from "./glyphs";

/* ------------------------------------------------------------------ *
 * #shape's card: one sample business, drawn as the system it would get
 * — the parts it would have, which of them go into the build the reader
 * picked, the stages its work moves through, its first reports, where AI
 * comes in and what makes it hard.
 *
 * THE HEAD is the sample: its tag in mono ("Sample · Wholesale ·
 * Operations", so a sample is never mistaken for a client's system), its
 * title in the display face and who it is for. The live head is laid in
 * one grid cell over an invisible, `aria-hidden`, `inert` copy of each of
 * the six, so a pick never changes the head's height; the copies' tags
 * carry the longest scope's name, and the tag is mono, so the live one
 * is never wider than the copy that holds its place. Only the live head
 * carries the title's id, which names the card.
 *
 * "WHAT IT WOULD HAVE" is eleven parts in three groups, always four,
 * four and three (the data module's `sample()` throws otherwise): Sales,
 * Operations, Back office. Each group's head says, in words, whether it
 * is in this build ("In this build", settled green on its soft ground,
 * 4.95) or not yet ("Later", muted on chip grey, 5.69); the scope the
 * reader picked decides, a group being in when its level is at most the
 * scope's. A part row is a 10px node — a filled electric dot in the
 * build, a dotted muted ring when later, so the state never rests on
 * colour — its name (ink, muted when later), why it is there, and, where
 * the same part already runs on this platform, the kind tag of the #core
 * card it would lean on ("Runs here", "Partly here"), read from the data
 * module (`coreKinds`), never typed, unless the part's own line asks more
 * than that card proves, when the part says so itself (`kind`, which can
 * only lower the card's: `partKind`). Down each group's left edge runs a
 * 3px rail, an ink-8% track with an electric fill that empties when the
 * group drops out of the build and fills again, top to bottom, as the
 * scope grows (erp-shape.css §2). A screen reader hears a later part end
 * in "(later)"; the rails and nodes are aria-hidden.
 *
 * THE RIGHT COLUMN, from lg (under the parts below it): the pipeline's
 * name and its six stages on a line (the line grows from the top as the
 * pipeline comes up the screen, and its nodes pop in order, erp-shape.css
 * §3), the three first reports, and the two lines, "With AI" and "What
 * makes it hard". From md each report is a tile, its name over a sketch
 * of the chart it is (bars, a line, won against lost, a table, money by
 * how late it is: the record window's "This month" tiles, at the
 * column's width), so from lg the column holds as much as the eleven
 * parts beside it and its hairline never runs on beside nothing, and at
 * md, where the pipeline and the reports stand side by side under the
 * parts, the reports' column comes out about as tall as the pipeline's;
 * below md each is a line with the small glyph for its chart. The name,
 * the reports and the lines are
 * each a `Stack` over the six samples, and every sample has six stages
 * and three reports, so only a part's why can rewrap on a pick, which is
 * the reader's own input.
 *
 * THE KEY: the two tags with the sentence that says what they mean, and
 * the way down to #core, where every part that runs here is traced to its
 * code, over a hairline: the card's foot, across both columns, so neither
 * column ends on a key pinned to an empty floor.
 *
 * On a white card inside a pearl light: the light re-points the `--pp-*`
 * tokens at its own (saas.css §2), so everything here names the landing's
 * `--home-*` tokens directly — ink 19.11, muted 6.37 on white; electric
 * for nodes, rails and glyphs (5.70, marks).
 *
 * PURE: no "use client" and no hooks, and only types from the data
 * module. The card element itself, with its key, its `data-dir` and the
 * view-transition class, is the island's (shape-instrument.tsx).
 * ------------------------------------------------------------------ */

/** Every word the card and its controls print: the section's slice, less the heading, the ledger, the index and the foot. */
export type ShapeCopy = Omit<ShapeData, "eyebrow" | "title" | "key" | "sub" | "ledger" | "indexSummary" | "foot">;

/** controls.tsx RING_LIGHT, spelled out: this module stays pure, and controls.tsx is a client module. */
const RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink";

/** A block's name on the white card: the landing's label, in its muted. */
const LABEL = cn(TYPE.label, "text-(--home-muted)");

/** The card's hairlines: the landing's rule on white (the light's own would be re-pointed). */
const HAIR = "border-[rgb(20_10_36/0.1)]";

/**
 * A link in the card, in the body's 15/22 type: a 44px target however
 * many lines it takes (a box of at least 24px, reaching 10px past it
 * either way), its arrow never wrapping away from its last word.
 */
const LINK = cn(
  "home-link group relative inline-flex min-h-6 items-center rounded-sm text-[15px] leading-[22px] text-pretty before:absolute before:inset-x-0 before:-inset-y-2.5",
  RING,
);

/** Each chart's glyph below md, where a report is a line (the charts: the data module's `ReportChart`). */
const REPORT_ICON: Record<ReportChart, LucideIcon> = {
  bars: ChartColumn,
  line: ChartLine,
  split: ChartColumnStacked,
  table: Table2,
  age: ChartColumnDecreasing,
};

/** The bars' heights in a report's sketch, in its 32 units: fixed, so it draws the same on every render. */
const SKETCH_BARS = [10, 15, 12, 18, 14, 21, 17, 24, 19, 26, 22, 29] as const;
/** Won and lost, six pairs of heights. */
const SKETCH_SPLIT = [
  [22, 9],
  [15, 12],
  [26, 7],
  [18, 11],
  [28, 8],
  [17, 14],
] as const;
/** Money by how late it is: four bars falling away, as the record window's "Money owed" tile draws it. */
const SKETCH_AGE = [28, 19, 12, 7] as const;
/** The table's three rows, each three cells' [x, width] in its 160 units: the record window's table, smaller; the last cell the figure. */
const SKETCH_ROWS = [
  [[0, 62], [78, 30], [124, 36]],
  [[0, 50], [78, 22], [130, 30]],
  [[0, 56], [78, 34], [126, 34]],
] as const;

/**
 * A first report's sketch, from md, where the report is a tile (the
 * record window's "This month" tiles, at the column's width): the chart
 * the report is, in the report's own terms — bars over time, a line,
 * won against lost, a table with its figures, money by how late it is —
 * in electric marks and the landing's lilac, never a figure, and never
 * grey alone. Drawn in `currentColor` (the lilac by its own `color`), so
 * forced colours keep every mark; stretched to the tile
 * (`preserveAspectRatio="none"`), the line's stroke kept even.
 */
function ReportSketch({ chart }: { chart: ReportChart }) {
  const svg = "block h-8 w-full overflow-visible";
  if (chart === "line") {
    return (
      <svg aria-hidden viewBox="0 0 160 32" preserveAspectRatio="none" className={cn(svg, "text-(--home-electric)")}>
        <path
          d="M2 26 L22 21 L42 23 L62 15 L82 17 L102 10 L122 12 L142 7 L158 4"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
  }
  if (chart === "table") {
    return (
      <svg aria-hidden viewBox="0 0 160 32" preserveAspectRatio="none" className={cn(svg, "text-(--home-ink)")}>
        {SKETCH_ROWS.map((row, r) =>
          row.map(([x, w], c) =>
            c === row.length - 1 ? (
              <rect key={`${r}-${x}`} x={x} y={3 + r * 11} width={w} height={5} rx={1} fill="currentColor" className="text-(--home-lilac)" />
            ) : (
              <rect key={`${r}-${x}`} x={x} y={3 + r * 11} width={w} height={5} rx={1} fill="currentColor" fillOpacity={0.14} />
            ),
          ),
        )}
      </svg>
    );
  }
  if (chart === "split") {
    return (
      <svg aria-hidden viewBox="0 0 160 32" preserveAspectRatio="none" className={cn(svg, "text-(--home-electric)")}>
        {SKETCH_SPLIT.map(([won, lost], i) => (
          <g key={i}>
            <rect x={4 + i * 26.5} y={32 - won} width={9} height={won} rx={1} fill="currentColor" />
            <rect x={15 + i * 26.5} y={32 - lost} width={9} height={lost} rx={1} fill="currentColor" className="text-(--home-lilac)" />
          </g>
        ))}
      </svg>
    );
  }
  if (chart === "age") {
    return (
      <svg aria-hidden viewBox="0 0 160 32" preserveAspectRatio="none" className={cn(svg, "text-(--home-lilac)")}>
        {SKETCH_AGE.map((h, i) => (
          <rect key={i} x={2 + i * 40} y={32 - h} width={30} height={h} rx={1.5} fill="currentColor" />
        ))}
      </svg>
    );
  }
  return (
    <svg aria-hidden viewBox="0 0 160 32" preserveAspectRatio="none" className={cn(svg, "text-(--home-electric)")}>
      {SKETCH_BARS.map((h, i) => (
        <rect key={i} x={2 + i * 13.2} y={32 - h} width={6} height={h} rx={1} fill="currentColor" />
      ))}
    </svg>
  );
}

/** Eight round dots on a 3.75-radius ring (CheckGlyph's dotted ring): a part still to come. */
const DOTS = "0 2.9452";

/**
 * A name that never breaks inside itself, for the tag, where "Trades and
 * field service" is one name and the tag wraps only after a "·": its
 * spaces no-break (U+00A0), and a word joiner (U+2060, drawn as nothing)
 * after each hyphen, so the face's own hyphen stays.
 */
function unbroken(name: string): string {
  return name.replaceAll(" ", "\u00a0").replaceAll("-", "-\u2060");
}

/** The last word of a label kept with the arrow after it, so the arrow never starts a line alone. */
function Arrowed({ label, arrow }: { label: string; arrow: "↓" }) {
  const cut = label.lastIndexOf(" ");
  return (
    <span>
      {cut < 0 ? "" : label.slice(0, cut + 1)}
      <span className="whitespace-nowrap">
        {cut < 0 ? label : label.slice(cut + 1)}
        <span aria-hidden className="ml-1 inline-block transition-transform duration-200 group-hover:translate-y-0.5">
          {arrow}
        </span>
      </span>
    </span>
  );
}

/**
 * A part's node: a white disc that cuts the group's rail, and on it a
 * filled electric dot (in the build) or a dotted muted ring (later), the
 * page's own marks for "there" and "still to come" (CheckGlyph's).
 * Colours are erp-shape.css §2's, so forced colours can hand them over.
 */
function PartNode({ later }: { later: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 10 10" className="mt-1.5 size-2.5 overflow-visible">
      <circle cx={5} cy={5} r={6.5} className="erp-part-knock" />
      {later ? (
        <circle cx={5} cy={5} r={3.75} fill="none" strokeWidth={1.6} strokeLinecap="round" strokeDasharray={DOTS} className="erp-part-ring" />
      ) : (
        <circle cx={5} cy={5} r={4} className="erp-part-dot" />
      )}
    </svg>
  );
}

/** A part's tag: "Runs here" or "Partly here". */
export type PartKind = ShapeData["coreKinds"][keyof ShapeData["coreKinds"]];

/**
 * A part's tag: the kind of the #core card it leans on, or none. A part
 * whose own line claims more than that card proves carries its own kind
 * (`kind: "thin"`), which only ever lowers the card's: "Deliveries:
 * booked, loaded and signed for" leans on the booking rule, which runs
 * here, but is only partly here itself. Never raised: a part marked
 * "thin" on a card that is itself only partly here stays partly here.
 */
export function partKind(coreKinds: ShapeData["coreKinds"], p: ShapePart): PartKind | null {
  if (!p.core) return null;
  const own = "kind" in p ? (p as { kind?: unknown }).kind : undefined;
  return own === "thin" ? "thin" : coreKinds[p.core];
}

/** A line held at its tallest across the six samples: the live one over an invisible copy of each (`Stack`). */
function Held({ data, live, render }: { data: ShapeCopy; live: number; render: (s: ShapeSample) => ReactNode }) {
  return <Stack items={data.samples} live={live} swap={false} render={render} />;
}

export function ShapeCard({
  data,
  sample,
  scope,
  titleId,
}: {
  data: ShapeCopy;
  sample: ShapeSample;
  scope: ScopeId;
  /** The id the live title carries, which names the card (the island's `useId`). */
  titleId: string;
}) {
  const live = Math.max(
    0,
    data.samples.findIndex((s) => s.id === sample.id),
  );
  // The scopes are in level order (the data module's LEVEL_OF): a group is in
  // the build when its level is at most the scope's.
  const reach = data.scopes.findIndex((s) => s.id === scope);
  const scopeLabel = data.scopes[reach]?.label ?? "";
  // The copies' tags carry the longest scope name: in mono, the widest.
  const widest = data.scopes.reduce((a, s) => (s.label.length > a.length ? s.label : a), "");
  const bizOf = (s: ShapeSample) => data.businesses.find((b) => b.id === s.id)?.label ?? "";
  const kindOf = (p: ShapePart) => partKind(data.coreKinds, p);

  const head = (s: ShapeSample, scopeName: string, id?: string) => (
    <>
      <p className={cn(TYPE.mono, "text-pretty text-(--home-muted)")}>
        {fill(data.tag, {
          business: unbroken(bizOf(s)),
          scope: unbroken(scopeName),
        })}
      </p>
      <h3
        id={id}
        className="pp-display mt-2 text-[22px] leading-[28px] tracking-[-0.01em] text-balance text-(--home-ink)"
        style={{ fontWeight: WEIGHT.h3 }}
      >
        {s.title}
      </h3>
      <p className={cn(TYPE.meta, "mt-1 text-pretty text-(--home-muted)")}>{s.who}</p>
    </>
  );

  return (
    <>
      {/* ── The head ── the live sample over all six, so a pick never moves what's under it. */}
      <div className="grid content-start">
        <div className="[grid-area:1/1]">{head(sample, scopeLabel, titleId)}</div>
        {data.samples.map((s) => (
          <div key={s.id} aria-hidden inert className="invisible [grid-area:1/1]">
            {head(s, widest)}
          </div>
        ))}
      </div>

      {/* ── The body ── from lg two columns, 7 : 5, a hairline between: the
          parts on the left, the pipeline, the reports and the lines on the
          right. Below lg one column, the parts first; at md the pipeline and
          the reports side by side under them. The key closes the card
          across both, under a hairline. */}
      <div className="mt-7 grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="min-w-0 lg:pr-10">
          <p className={LABEL}>{data.partsTitle}</p>
          <div className="mt-4 flex flex-col gap-5">
            {data.scopes.map((level, g) => {
              const later = g > reach;
              const parts = sample.parts.filter((p) => p.level === level.id);
              return (
                <div key={level.id} data-state={later ? "later" : "in"} className="erp-group min-w-0" style={{ "--g": g } as CSSProperties}>
                  <h4 className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <span className={LABEL}>{data.levels[level.id]}</span>
                    <span className="sr-only">: </span>
                    <span className={cn(TYPE.label, "erp-group-chip inline-flex h-6 shrink-0 items-center rounded-full px-2.5 tracking-[0.1em]")}>
                      {later ? data.later : data.inBuild}
                    </span>
                  </h4>
                  <div className="relative mt-1.5">
                    <span aria-hidden className="erp-group-rail absolute top-2 bottom-2 left-[3.5px] w-[3px] overflow-hidden rounded-full">
                      <span className="erp-group-fill absolute inset-0 rounded-full" />
                    </span>
                    <ul className="relative">
                      {parts.map((p) => (
                        <li
                          key={p.label}
                          data-state={later ? "later" : "in"}
                          className="erp-part grid min-w-0 grid-cols-[10px_minmax(0,1fr)] gap-x-3 py-2"
                        >
                          <PartNode later={later} />
                          <div className="min-w-0">
                            {/* The tag at the row's right, or under the name
                                where the two don't fit side by side. */}
                            <p className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                              <span className="min-w-0 text-[15px] leading-[22px] font-medium text-pretty">{p.label}</span>
                              {kindOf(p) && (
                                <>
                                  <span className="sr-only">: </span>
                                  <ErpTag kind={kindOf(p) ?? "thin"} copy={data.kinds} tone="white" />
                                </>
                              )}
                            </p>
                            <p className="mt-0.5 text-[13px] leading-[18px] text-pretty text-(--home-muted)">
                              {p.why}
                              {later && <span className="sr-only"> ({data.later.toLowerCase()})</span>}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className={cn("mt-8 min-w-0 border-t pt-7 lg:mt-0 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-10", HAIR)}>
          <div className="md:grid md:grid-cols-2 md:gap-x-8 lg:block">
            <div className="min-w-0">
              <p className={LABEL}>{data.pipelineTitle}</p>
              <div className="mt-2">
                <Held
                  data={data}
                  live={live}
                  render={(s) => <p className="text-[15px] leading-[22px] font-medium text-pretty text-(--home-ink)">{s.pipeline.name}</p>}
                />
              </div>
              {/* Six stages on a line, 32px a row: the line grows from the top as
              they come up the screen, and the nodes pop in order (erp-shape.css §3). */}
              <div className="erp-pipe relative mt-3">
                <span aria-hidden className="erp-pipe-line absolute top-4 bottom-4 left-1 w-0.5 rounded-full" />
                <ol className="relative">
                  {sample.pipeline.stages.map((stage, k) => (
                    <li key={k} className="flex h-8 min-w-0 items-center gap-3 text-[14px] leading-5 text-(--home-ink)">
                      <span aria-hidden className="erp-pipe-node size-2.5 shrink-0 rounded-full" style={{ "--k": k } as CSSProperties} />
                      <span className="min-w-0 truncate">{stage}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
            <div className="mt-7 min-w-0 md:mt-0 lg:mt-7">
              <p className={LABEL}>{data.reportsTitle}</p>
              <div className="mt-3">
                <Held
                  data={data}
                  live={live}
                  render={(s) => (
                    <ul className="flex flex-col gap-2.5 md:gap-2">
                      {s.reports.map((r, k) => {
                        const chart = s.charts[k];
                        const Icon = REPORT_ICON[chart];
                        return (
                          <li
                            key={k}
                            className="grid min-w-0 grid-cols-[14px_minmax(0,1fr)] gap-x-2.5 md:grid-cols-1 md:gap-y-2.5 md:rounded-xl md:p-3 md:shadow-[inset_0_0_0_1px_rgb(20_10_36/0.08)]"
                          >
                            <Icon aria-hidden size={14} strokeWidth={1.75} className="erp-glyph mt-[3px] text-(--home-electric) md:hidden" />
                            <span className="text-[14px] leading-5 text-pretty text-(--home-ink)">{r}</span>
                            <span className="hidden md:block">
                              <ReportSketch chart={chart} />
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                />
              </div>
            </div>
          </div>

          <dl className="mt-7 flex flex-col gap-5">
            <div className="min-w-0">
              <dt className={LABEL}>{data.aiLabel}</dt>
              <dd className="mt-1.5">
                <Held data={data} live={live} render={(s) => <p className="text-[15px] leading-[22px] text-pretty text-(--home-ink)">{s.ai}</p>} />
              </dd>
            </div>
            <div className="min-w-0">
              <dt className={LABEL}>{data.hardLabel}</dt>
              <dd className="mt-1.5">
                <Held data={data} live={live} render={(s) => <p className="text-[15px] leading-[22px] text-pretty text-(--home-ink)">{s.hard}</p>} />
              </dd>
            </div>
          </dl>
        </div>

        {/* ── The foot ── the key, and the way down to the code, across the
            card under a hairline. The tags are the key's picture; the
            sentence under them says the same in words. */}
        <div className="mt-8 min-w-0 lg:col-span-2">
          <div className={cn("flex flex-col gap-4 border-t pt-5", HAIR)}>
            <div className="min-w-0">
              <p aria-hidden className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <ErpTag kind="does" copy={data.kinds} tone="white" />
                <ErpTag kind="thin" copy={data.kinds} tone="white" />
              </p>
              <p className={cn(TYPE.meta, "mt-2 max-w-[560px] text-pretty text-(--home-muted)")}>{data.legend}</p>
            </div>
            <p>
              <a href={data.full.href} className={LINK}>
                <Arrowed label={data.full.label} arrow="↓" />
              </a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
