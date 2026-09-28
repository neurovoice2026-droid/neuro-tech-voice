import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TYPE } from "@/components/site/home/type";
import type { MoveData, Outcome, RowId } from "@/lib/pages/crm-erp";
import {
  LAYOUTS,
  RECORDS,
  ROWS,
  askAt,
  barsOf,
  cardRect,
  copyOffset,
  copyRest,
  leader,
  pct,
  rowBand,
  rowNumberAt,
  rowOrigin,
  slices,
  sourcesOf,
  tagAt,
  type Fig,
} from "./rehearsal-geometry";

/* ------------------------------------------------------------------ *
 * #move — the rehearsal, drawn: six rows of a customer spreadsheet
 * moved into five records of the new system. Three rows move as they
 * are, two turn out to be the same customer typed twice and become one
 * record, and one has no email on file and is asked about. The old rows
 * stay where they were, faded and ticked: the old file is still there to
 * read. Every value is a grey bar; the only words are the sheet's
 * column names, the two titles and each row's outcome.
 *
 * TWO COMPOSITIONS, both in the HTML and switched by CSS at md, so the
 * server never guesses the width (rehearsal-geometry.ts has both):
 * from md the sheet, the tags and the records side by side (960 × 400);
 * below md the sheet over the records (360 × 720), no wider than 400px
 * so a tablet held upright doesn't stand it a thousand pixels tall. The
 * SVG draws every stroke and bar; the words are HTML over it, placed in
 * shares of the box, so they keep their 11–13px while the drawing
 * scales (the Mobile page's path figure's rule).
 *
 *   · THE SHEET: a frame with its column names' band, a hairline under
 *     each row and between the columns, and six rows of bars at 40%
 *     (`.erp-move-row`); from md a small tick at each row's end, in the
 *     settled green, as its copy lands.
 *   · THE TAGS: each row's outcome in mono capitals on a white pill,
 *     "Moved" in the settled green (5.50 on white), "Merged" in violet
 *     (7.10), "Asked" in ember ink (5.92); from md between the sheet and
 *     the records, below md at the row's right end.
 *   · THE RECORDS: white, a hairline, a grey avatar disc and two short
 *     bars of their own under the line the copy fills; the fourth
 *     carries a small ember "?" where its email would be.
 *   · THE LEADERS, from md: a dotted line (ink at 20%) from each row to
 *     its record. A dash draw would wreck a dotted stroke, so each leader
 *     wears a mask (`erp-move-lead-<fig>-<row>`) whose one solid stroke
 *     draws along it with home.css's own `home-draw`, and the dots
 *     appear behind the mask's stroke as it goes. BELOW MD six leaders
 *     side by side would run a few pixels apart, one grey hatch, so the
 *     gutter on the right numbers each row (1 to 6) and says beside each
 *     record which rows it holds ("3+5" for the twins), in mono.
 *   · THE COPIES (`.erp-copy`): each row's four bars, drawn once, where
 *     they rest, in the row's record. The twin's rests there at opacity
 *     0: merged into the record its first copy made.
 *
 * IT PLAYS ON ITS OWN PASSAGE UP THE SCREEN (erp-move.css §1): the
 * box's view timeline, `--erp-rehearsal`, and one window on it. Each
 * piece has its slice of that window (`--o` where it starts, `--s` how
 * much it takes, inline, from the geometry's `slices`): the leaders draw
 * one after another; then each copy slides from its row into its record
 * (`--dx`, `--dy`: its row's place less its own, in user units, which
 * an SVG element's `translate` reads as px), the twin's fading as it
 * lands; and each tag, tick and "?" pops as its copy arrives. The
 * resting style is the finished frame: every copy in its record, the
 * twin merged, every leader, tag and tick shown. That is what reduced
 * motion, the lite, still and weak tiers and a browser without view
 * timelines get.
 *
 * PURE and aria-hidden: the rehearsal card around it (move.tsx) says it
 * all in words — the key, the tally and the index, row by row.
 * ------------------------------------------------------------------ */

/** Each outcome's colour on white: the words keep the meaning, the colour only follows it. */
const TONE: Record<Outcome, string> = {
  moved: "text-(--home-settled)",
  merged: "text-(--home-violet)",
  asked: "text-(--home-ember-ink)",
};

/**
 * An outcome's tag: its word in mono capitals on a white pill. The
 * figure's tags and the key's under it (move.tsx) are the same pill.
 */
export function OutcomeTag({
  outcome,
  children,
  className,
  style,
}: {
  outcome: Outcome;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={cn(
        TYPE.mono,
        "inline-flex h-5 items-center rounded-full border border-pp-rule bg-white px-1.5 text-[11px] leading-4 tracking-[0.02em] whitespace-nowrap uppercase",
        TONE[outcome],
        className,
      )}
      style={style}
    >
      {children}
    </span>
  );
}

/** When a piece plays, as shares of the figure's window: from `o`, for `s`. Read by erp-move.css §1. */
function at([o, s]: readonly [number, number]) {
  return { "--o": o, "--s": s } as CSSProperties;
}

/** Grey bars: the record's own and the avatar a shade lighter than a row's values. */
const GREY = { bar: 0.18, own: 0.1 } as const;

/** A row's bars from an origin: its values, as grey bars. */
function Bars({ fig, id, x, y }: { fig: Fig; id: RowId; x: number; y: number }) {
  return barsOf(fig, id).map((b) => (
    <rect key={b.x} x={x + b.x} y={y + b.y} width={b.w} height={b.h} rx={b.h / 2} fill="currentColor" fillOpacity={GREY.bar} />
  ));
}

/** A small tick, centred on (x, y). */
const tick = (x: number, y: number) => `M${x - 4} ${y} L${x - 1.2} ${y + 2.8} L${x + 4} ${y - 3}`;

/** A row of the data's, by id: the geometry's rows and the data's are the same six (the page's test holds them). */
function rowOf(data: MoveData["rehearsal"], id: RowId) {
  const row = data.rows.find((r) => r.id === id);
  if (!row) throw new Error(`rehearsal-figure: the data has no row "${id}"`);
  return row;
}

/** The second of a merged pair, whose copy joins its twin's record and rests there merged. */
const isTwin = (data: MoveData["rehearsal"], id: RowId) => {
  const { with: first } = rowOf(data, id);
  return first !== undefined && ROWS.indexOf(first) < ROWS.indexOf(id);
};

function Composition({ fig, data, className }: { fig: Fig; data: MoveData["rehearsal"]; className?: string }) {
  const L = LAYOUTS[fig];
  const { w, h } = L.view;
  const { sheet } = L;
  const place = (x: number, y: number) => ({ left: pct(x, w), top: pct(y, h) });
  const bottom = sheet.y + sheet.h;
  const r = 8;
  const hair = { stroke: "currentColor", strokeOpacity: 0.07, strokeWidth: 1 } as const;
  // The leaders, from md; below md the gutter's numbers stand in for them.
  const leaders = fig === "wide" ? ROWS : [];
  const gutter = cn(TYPE.mono, "absolute -translate-x-1/2 -translate-y-1/2 text-[11px] leading-4 whitespace-nowrap text-pp-muted");

  return (
    <div className={cn("relative", className)} style={{ aspectRatio: `${w} / ${h}` }}>
      <svg viewBox={`0 0 ${w} ${h}`} fill="none" className="absolute inset-0 size-full overflow-visible text-pp-ink">
        <defs>
          {/* Each leader's mask: one solid stroke along it that draws, and shows the dots behind it as it goes. */}
          {leaders.map((id) => (
            <mask key={id} id={`erp-move-lead-${fig}-${id}`} maskUnits="userSpaceOnUse" x={-8} y={-8} width={w + 16} height={h + 16}>
              <path
                d={leader(fig, id)}
                pathLength={1}
                className="erp-move-lead-draw"
                style={at(slices(id).leader)}
                stroke="#fff"
                strokeWidth={10}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </mask>
          ))}
        </defs>

        {/* The sheet: its frame, its column names' band, and the rules between its rows and its columns. */}
        <g className="erp-move-sheet">
          <path
            d={`M${sheet.x} ${sheet.y + r} A${r} ${r} 0 0 1 ${sheet.x + r} ${sheet.y} H${sheet.x + sheet.w - r} A${r} ${r} 0 0 1 ${sheet.x + sheet.w} ${sheet.y + r} V${sheet.y + L.head} H${sheet.x} Z`}
            fill="currentColor"
            fillOpacity={0.035}
          />
          {ROWS.map((id) => {
            const band = rowBand(fig, id);
            return <path key={id} d={`M${sheet.x} ${band.y} H${sheet.x + sheet.w}`} {...hair} />;
          })}
          {L.cols.slice(1).map((c) => (
            <path key={c} d={`M${sheet.x + c - L.rule} ${sheet.y} V${bottom}`} {...hair} />
          ))}
          <rect x={sheet.x} y={sheet.y} width={sheet.w} height={sheet.h} rx={r} stroke="currentColor" strokeOpacity={0.14} strokeWidth={1.5} />
        </g>

        {/* The rows, kept in the sheet at 40%: the old file stays readable. */}
        <g className="erp-move-row" opacity={0.4}>
          {ROWS.map((id) => {
            const [x, y] = rowOrigin(fig, id);
            return <Bars key={id} fig={fig} id={id} x={x} y={y} />;
          })}
        </g>

        {/* From md, a tick at each row's end once its copy has landed. */}
        {L.tick !== null &&
          ROWS.map((id) => (
            <path
              key={id}
              d={tick(L.tick!, rowBand(fig, id).y + L.row / 2)}
              className="erp-move-tick text-(--home-settled)"
              style={at(slices(id).tag)}
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

        {/* The leaders, dotted, each drawn behind its own mask (from md). */}
        {leaders.map((id) => (
          <path
            key={id}
            d={leader(fig, id)}
            mask={`url(#erp-move-lead-${fig}-${id})`}
            className="erp-move-lead"
            stroke="currentColor"
            strokeOpacity={0.2}
            strokeWidth={2}
            strokeDasharray="0.01 5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {/* The records: white, a hairline, an avatar and two short bars of their own. */}
        {Array.from({ length: RECORDS }, (_, i) => {
          const c = cardRect(fig, i);
          return (
            <g key={i}>
              <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={L.card.r} fill="#fff" className="erp-move-record" stroke="currentColor" strokeOpacity={0.14} strokeWidth={1.5} />
              <circle cx={c.x + L.disc.cx} cy={c.y + L.disc.cy} r={L.disc.r} fill="currentColor" fillOpacity={GREY.own} />
              {L.own.bars.map(([x, bw]) => (
                <rect key={x} x={c.x + x} y={c.y + L.own.y - L.own.h / 2} width={bw} height={L.own.h} rx={L.own.h / 2} fill="currentColor" fillOpacity={GREY.own} />
              ))}
            </g>
          );
        })}

        {/* Each row's copy, at rest in its record; the twin's merged there, at 0. */}
        {ROWS.map((id) => {
          const [x, y] = copyRest(fig, id);
          const { dx, dy } = copyOffset(fig, id);
          return (
            <g
              key={id}
              className="erp-copy"
              data-merged={isTwin(data, id) ? "" : undefined}
              style={{ "--dx": `${dx}px`, "--dy": `${dy}px`, ...at(slices(id).copy) } as CSSProperties}
            >
              <Bars fig={fig} id={id} x={x} y={y} />
            </g>
          );
        })}
      </svg>

      {/* The words: the two titles, the column names, each row's tag, and the "?". */}
      <span className="absolute text-[13px] leading-[18px] font-medium whitespace-nowrap text-pp-ink" style={place(...L.sheetTitle)}>
        {data.sheet}
      </span>
      {/* Each column's name on the band's middle line, no wider than its column: one a reader's own
          spacing widens (WCAG 1.4.12) wraps down into the band, hyphenated where it can be, never
          into the next name or past the sheet's edge. */}
      {data.columns.map((name, c) => (
        <span
          key={name}
          className={cn(TYPE.mono, "absolute -translate-y-2 text-[11px] leading-4 hyphens-auto text-pp-muted [overflow-wrap:anywhere]")}
          style={{ ...place(sheet.x + L.cols[c], sheet.y + L.head / 2), maxWidth: pct((L.cols[c + 1] ?? sheet.w) - L.cols[c] - 4, w) }}
        >
          {name}
        </span>
      ))}
      <span className="absolute text-[13px] leading-[18px] font-medium whitespace-nowrap text-pp-ink" style={place(...L.cardsTitle)}>
        {data.cards}
      </span>
      {ROWS.map((id) => {
        const { outcome } = rowOf(data, id);
        return (
          <OutcomeTag
            key={id}
            outcome={outcome}
            className={cn("erp-move-tag absolute -translate-y-1/2", L.tag.align === "center" ? "-translate-x-1/2" : "-translate-x-full")}
            style={{ ...place(...tagAt(fig, id)), ...at(slices(id).tag) }}
          >
            {data.outcomes[outcome].tag}
          </OutcomeTag>
        );
      })}
      {/* Below md: each row's number, and beside each record the rows it holds. */}
      {fig === "narrow" &&
        ROWS.map((id, k) => (
          <span key={id} className={gutter} style={place(...rowNumberAt(id))}>
            {k + 1}
          </span>
        ))}
      {fig === "narrow" &&
        Array.from({ length: RECORDS }, (_, i) => {
          const { at: where, rows } = sourcesOf(i);
          return (
            <span key={i} className={cn(gutter, rows.length > 1 && "text-(--home-violet)")} style={place(...where)}>
              {rows}
            </span>
          );
        })}
      {ROWS.map((id) => {
        const ask = askAt(fig, id);
        return ask ? (
          <span
            key={id}
            className={cn(
              TYPE.mono,
              "erp-move-ask absolute grid size-4 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-(--home-ember-ink) bg-white text-[11px] leading-none text-(--home-ember-ink)",
            )}
            style={{ ...place(...ask), ...at(slices(id).tag) }}
          >
            ?
          </span>
        ) : null;
      })}
    </div>
  );
}

/** Both compositions, in one box that carries the view timeline: from md side by side, below md one over the other. */
export function RehearsalFigure({ data, className }: { data: MoveData["rehearsal"]; className?: string }) {
  return (
    <div aria-hidden className={cn("erp-rehearsal-fig", className)}>
      <Composition fig="wide" data={data} className="hidden md:block" />
      <Composition fig="narrow" data={data} className="mx-auto max-w-[400px] md:hidden" />
    </div>
  );
}
