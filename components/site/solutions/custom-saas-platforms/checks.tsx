"use client";

import { useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import type { CheckKind, CheckRow, ChecksData } from "@/lib/pages/custom-saas-platforms";
import { cn } from "@/lib/utils";
import { IntentLink } from "@/components/site/intent-link";
import { Frame, PillLink } from "@/components/site/product/primitives";
import { useDeviceTier } from "@/components/site/product/device-tier";
import { usePrefersReducedMotion } from "@/components/site/product/timing";
import { CHIP, ChipRail, RING_LIGHT, centreInRail, useRovingRadio } from "@/components/site/home/controls";
import { HomeHeading } from "@/components/site/home/heading";
import { TYPE } from "@/components/site/home/type";
import { CheckGlyph } from "./check-line";
import { requestLens } from "./part-bus";
import { vtAllowed, withViewTransition } from "./vt";

/* ------------------------------------------------------------------ *
 * #checks — how do I check all this? Every claim on the page, and
 * where to check it.
 *
 * The page's argument, gathered into one ledger: each claim the page
 * makes, when it can be checked — now, in this browser; on the call; or
 * at handover — and how. Twelve rows at HEAD, each with a kind tag (the
 * same glyphs as every `CheckLine` above it: a filled node for the thing
 * itself, a hollow one for what is shown on the call, a dotted ring for
 * what you will hold), the claim in ink, and the way to check it in
 * muted, with a link where there is somewhere to go. Then, set apart on
 * a still pearl card, "The one this page can’t show you": that we will
 * build yours well. It is the only claim no page can hold, so it is not
 * dressed as a row, and it ends on the only way to check it, the call.
 *
 * THE KEY heads the ledger: three hairline cells, one per kind in the
 * chips' order, each a small line figure in the landing's #trust
 * vocabulary that draws as it comes up the screen (`KindFigure`,
 * saas-closing.css §10a), over the sub's sentence for that kind. The sub
 * is three sentences, one per kind, so it moves out of the heading into
 * the key instead of being said twice. The key is not a control: while
 * the list shows one kind, the other two figures dim and their words go
 * muted, so it follows the chips without competing with them.
 *
 * THE FILTER. Four chips, a radio group (`useRovingRadio`: one tab stop,
 * arrows move and pick at once): every claim, or only those of one kind,
 * each with its count, worked out from the rows so a row added to the
 * data module counts itself. On a phone the chips run in a rail that
 * scrolls sideways, and the one picked is brought to its middle; from lg
 * they sit beside the heading. A change swaps the list as one same-document
 * View Transition (vt.ts), in three moves that never put text over text:
 * the rows that go fade where they stood; then the rows that stay slide
 * to their new places, and everything under the list — "the one this
 * page can’t show you", #faq, #start — slides the list's change in
 * height with them instead of cutting to its new place under rows still
 * fading; then the rows that come rise 6px into theirs. The browser
 * animates snapshots on the compositor; the list itself is simply
 * re-rendered, flushed inside the transition's callback. Only transform
 * and opacity move (saas-closing.css §10).
 *
 * ON A PHONE, and below lg generally, the three parts of a row stack,
 * and the kind tag heads each run of one kind rather than every row:
 * the ledger reads as three short groups, a fifth shorter, and a screen
 * reader still hears every row's tag. From lg the tag is a column and
 * every row shows its own.
 *
 * NAMED ONLY WHILE OURS RUNS. Each row carries its transition name as a
 * custom property (`--saas-vt: saas-check-<id>`), and saas-closing.css
 * turns it into a `view-transition-name` only under <html
 * data-saas-vt="checks">, which vt.ts sets for the life of our own
 * transition (the boxes under the section are named there too, by
 * selector). So the twelve rows are never captured by anyone else's —
 * #prototype's screen change, say — and outside a filter change they
 * carry no name at all.
 *
 * THE FINISHED FRAME is the server's: "Every claim", all rows. Reduced
 * motion, the lite and still tiers and a browser without the API get an
 * instant filter (`vtAllowed`, read in the handler, never while
 * rendering). With no script at all the chips do nothing and every row is
 * there, which is the frame the chips start on.
 *
 * a11y: the chips are named "Every claim 12" and so on, the group "Show
 * claims"; a polite live region reads "Showing 4 of 12" after a change,
 * and says nothing on load. The kind tag ends in a hidden colon, so a
 * screen reader reads "On the call: Our team holds 20+…". Links
 * are real anchors: an in-page `#…` a plain one (the one that names an
 * explorer lens also asks the explorer to open it), a route an
 * IntentLink.
 *
 * COLOUR. White ground, the landing's tokens: ink claims (19.11:1),
 * muted tags and ways (6.37), violet links (7.10); the chips are the
 * landing's (`CHIP`: white on electric 5.70 when picked). The glyphs are
 * marks: electric for "now" and "at handover", violet for "on the call",
 * and the key's figures are ink with the same accent on the glyph and
 * the one mark that says the kind. The key's words are ink at 80%, muted
 * (6.37) while dimmed. The card is the credentials' papers light, still,
 * in its own measured tokens (saas.css §2): text and accent, and the
 * primary pill.
 * ------------------------------------------------------------------ */

type FilterId = ChecksData["filters"][number]["id"];

/** Each kind's mark on white: electric for now and at handover, violet for on the call. */
const GLYPH: Record<CheckKind, string> = {
  site: "text-(--home-electric)",
  call: "text-(--home-violet)",
  handover: "text-(--home-electric)",
};

/**
 * A chip: 40px drawn, 44px to a finger (2px past each edge; the rail's
 * 8px gap keeps the next row's target clear when the chips wrap at lg).
 */
const FILTER_CHIP = cn(
  "relative inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-sm whitespace-nowrap",
  "before:absolute before:inset-x-0 before:-inset-y-0.5",
  CHIP.ease,
  RING_LIGHT,
);

/** "Showing {n} of {total}", filled. */
const fillShowing = (template: string, n: number, total: number) =>
  template.replace("{n}", String(n)).replace("{total}", String(total));

/* ─── The key: one figure for each way to check ─────────────────── *
 * The landing's #trust figures (home/trust-figures.tsx), in their line
 * vocabulary at 1:1 on the same 112 × 48 plate: 1.6 strokes with round
 * caps, lines that stop short of the nodes they meet, dotted lines for
 * what is still to come, nodes on a disc of page stock. Each opens on its
 * kind's own glyph (CheckGlyph's shape, at a figure's node size, in its
 * GLYPH colour) and leads to what that kind of check is:
 *
 *   · Now, in this browser: the filled node, a line to a browser window,
 *     and a check drawn inside it.
 *   · On the call: the hollow node, a line with a voice on it, and the
 *     person it reaches.
 *   · At handover: the dotted ring, a dotted line, and the folder that
 *     is handed along it.
 *
 * They draw on their own passage up the screen (home.css `.home-draw`,
 * staged per element by saas-closing.css §10a); reduced motion, a browser
 * without view timelines, and the lite and still tiers and weak hardware
 * get the markup, which is the finished drawing. Ink throughout, the
 * accent only on the glyph and the one mark that says the kind (the
 * check, the voice). */

const W = 112;
const H = 48;
const MID = H / 2;
const LINE = 1.6;
/** A dotted line's pitch: the #trust figures' dash, "0.01 4.6", as separate dots. */
const DOT_GAP = 4.6;
/** A node's radius, and the page-stock disc that keeps lines off it. */
const R = 4;
const HALO = R + 4;
/** Where each figure's glyph sits, and where the line from it starts. */
const GLYPH_X = HALO;
const FROM = GLYPH_X + HALO;

/** When an element runs, as a share of its figure's draw window: from `o`, over `s`. Read by §10a. */
function at(o: number, s: number) {
  return { "--o": o, "--s": s } as CSSProperties;
}

const solid = {
  stroke: "currentColor",
  strokeWidth: LINE,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** A rounded rectangle as one path, so it can draw (`pathLength`). */
function box(x0: number, y0: number, x1: number, y1: number, r: number) {
  return (
    `M${x0 + r} ${y0} H${x1 - r} A${r} ${r} 0 0 1 ${x1} ${y0 + r} V${y1 - r} A${r} ${r} 0 0 1 ${x1 - r} ${y1}` +
    ` H${x0 + r} A${r} ${r} 0 0 1 ${x0} ${y1 - r} V${y0 + r} A${r} ${r} 0 0 1 ${x0 + r} ${y0} Z`
  );
}

/** The kind's glyph at a figure's node size, on its disc of page stock; it arrives with a small scale-in. */
function KindNode({ kind }: { kind: CheckKind }) {
  const ring = 4.5;
  return (
    <g className={cn("saas-kind-pop", GLYPH[kind])} style={at(0, 0.16)}>
      <circle cx={GLYPH_X} cy={MID} r={HALO} className="fill-pp-bg" />
      {kind === "site" ? (
        <circle cx={GLYPH_X} cy={MID} r={R} className="fill-current" />
      ) : kind === "call" ? (
        <circle cx={GLYPH_X} cy={MID} r={R} className="fill-pp-bg" {...solid} />
      ) : (
        // Eight round dots on the ring, as CheckGlyph's.
        <circle
          cx={GLYPH_X}
          cy={MID}
          r={ring}
          {...solid}
          strokeDasharray={`0 ${((2 * Math.PI * ring) / 8).toFixed(4)}`}
        />
      )}
    </g>
  );
}

/** Now, in this browser: a line from the filled node to a window, and a check drawn in it. */
const WIN = { x0: 46, x1: 111, y0: 4, y1: 44, bar: 13, r: 6 };

function SiteFigure() {
  const { x0, x1, y0, y1, bar, r } = WIN;
  const y = (bar + y1) / 2;
  const cx = (x0 + x1) / 2;
  return (
    <>
      <path d={`M${FROM} ${MID} H${x0 - 4}`} pathLength={1} style={at(0.1, 0.3)} {...solid} />
      <path d={box(x0, y0, x1, y1, r)} pathLength={1} style={at(0.28, 0.42)} {...solid} />
      <path d={`M${x0} ${bar} H${x1}`} pathLength={1} strokeOpacity={0.35} style={at(0.56, 0.16)} {...solid} />
      {[0, 1, 2].map((k) => (
        <circle
          key={k}
          cx={x0 + 6 + k * 4.5}
          cy={(y0 + bar) / 2}
          r={1.1}
          opacity={0.5}
          className="saas-kind-pop fill-current"
          style={at(0.62 + k * 0.04, 0.1)}
        />
      ))}
      <path
        d={`M${cx - 8} ${y} l5 5 l11 -11`}
        pathLength={1}
        className={GLYPH.site}
        style={at(0.76, 0.22)}
        {...solid}
      />
    </>
  );
}

/** On the call: a line from the hollow node, a voice on it, and the person it reaches. */
const VOICE = [3, 7, 10, 6, 3];
const PERSON = { x: 101, head: 16.5, hr: 4.5, top: 27, foot: 40, span: 9.5 };

function CallFigure() {
  const { x, head, hr, top, foot, span } = PERSON;
  const x0 = 46;
  const gap = 5;
  const x1 = x0 + (VOICE.length - 1) * gap;
  return (
    <>
      <path d={`M${FROM} ${MID} H${x0 - 5}`} pathLength={1} style={at(0.1, 0.24)} {...solid} />
      {VOICE.map((h, k) => {
        const bx = x0 + k * gap;
        return (
          // Each bar opens from the line both ways, like a level.
          <g key={bx} className={GLYPH.call}>
            <path d={`M${bx} ${MID} V${MID - h}`} pathLength={1} style={at(0.28 + k * 0.06, 0.2)} {...solid} />
            <path d={`M${bx} ${MID} V${MID + h}`} pathLength={1} style={at(0.28 + k * 0.06, 0.2)} {...solid} />
          </g>
        );
      })}
      <path d={`M${x1 + 5} ${MID} H${x - span - 3}`} pathLength={1} style={at(0.56, 0.14)} {...solid} />
      <circle cx={x} cy={head} r={hr} pathLength={1} style={at(0.66, 0.2)} {...solid} />
      <path
        d={`M${x - span} ${foot} C${x - span} ${top + 3} ${x - 5} ${top} ${x} ${top} C${x + 5} ${top} ${x + span} ${top + 3} ${x + span} ${foot}`}
        pathLength={1}
        style={at(0.72, 0.26)}
        {...solid}
      />
    </>
  );
}

/** At handover: a dotted line from the dotted ring, and the folder handed along it. */
const FOLDER = { x0: 64, x1: 110, y0: 7, y1: 41, tab: 15 };

function HandoverFigure() {
  const { x0, x1, y0, y1, tab } = FOLDER;
  const flap = y0 + 9;
  return (
    <>
      {/* Still to come: dotted, one dot after another toward the folder. */}
      <g opacity={0.6}>
        {Array.from({ length: Math.floor((x0 - 6 - FROM) / DOT_GAP) + 1 }, (_, k) => (
          <circle
            key={k}
            cx={FROM + k * DOT_GAP}
            cy={MID}
            r={LINE / 2}
            className="saas-kind-pop fill-current"
            style={at(0.1 + k * 0.03, 0.08)}
          />
        ))}
      </g>
      <path
        d={
          `M${x0} ${y0 + 3} A3 3 0 0 1 ${x0 + 3} ${y0} H${x0 + tab - 4} L${x0 + tab} ${y0 + 4} H${x1 - 3}` +
          ` A3 3 0 0 1 ${x1} ${y0 + 7} V${y1 - 3} A3 3 0 0 1 ${x1 - 3} ${y1} H${x0 + 3} A3 3 0 0 1 ${x0} ${y1 - 3} Z`
        }
        pathLength={1}
        style={at(0.42, 0.4)}
        {...solid}
      />
      <path d={`M${x0} ${flap} H${x1}`} pathLength={1} strokeOpacity={0.35} style={at(0.74, 0.14)} {...solid} />
      {[0, 1].map((k) => (
        <path
          key={k}
          d={`M${x0 + 8} ${flap + 9 + k * 7} H${x0 + (k ? 24 : 32)}`}
          pathLength={1}
          strokeOpacity={0.4}
          style={at(0.8 + k * 0.06, 0.12)}
          {...solid}
        />
      ))}
    </>
  );
}

/**
 * One kind's figure on its plate. Aria-hidden: the words beside it say
 * the same thing. Dimmed while the list shows another kind, so the key
 * follows the chips without being one.
 */
function KindFigure({ kind, i, off }: { kind: CheckKind; i: number; off: boolean }) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      fill="none"
      aria-hidden
      data-i={i}
      className={cn(
        "home-draw saas-kind-fig block h-12 w-[112px] shrink-0 overflow-visible text-pp-ink",
        "transition-opacity duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        off && "opacity-30",
      )}
    >
      {kind === "site" ? <SiteFigure /> : kind === "call" ? <CallFigure /> : <HandoverFigure />}
      <KindNode kind={kind} />
    </svg>
  );
}

/**
 * A row's way to go and check it: 18px of text and 3px either side, a
 * 24px box, and a 44px target — the box's `::before` reaches 10px past
 * its top and bottom, into the words above and the row's own 20px foot,
 * clear of the next row. It stands on its own line, not in a sentence,
 * so it gets the whole target, as the landing's standalone links do. A
 * block, not a flex row, so the underline stops at the words; the arrow
 * is an inline-block, which the underline skips.
 *
 * A link that names one of the explorer's lenses ("Take a part down")
 * opens it, as MapLink opens a part: a real `#platform` anchor first, so
 * with no script the browser jumps to the drawing; with script a plain
 * primary click writes the fragment without a jump and asks the explorer
 * (part-bus.ts `requestLens`), which picks the lens, brings the stage up
 * and focuses the lens's chip. A modified click falls through untouched.
 */
function RowLink({ link }: { link: NonNullable<CheckRow["link"]> }) {
  const className = cn(
    "home-link group relative mt-1 inline-block min-h-6 rounded-sm py-[3px] text-[13px] leading-[18px]",
    "before:absolute before:inset-x-0 before:-inset-y-2.5",
    RING_LIGHT,
  );
  const words = (
    <>
      {link.label}
      <span aria-hidden className="ml-1 inline-block transition-transform duration-200 group-hover:translate-x-0.5">
        →
      </span>
    </>
  );
  if (link.href.startsWith("/")) {
    return (
      <IntentLink href={link.href} className={className}>
        {words}
      </IntentLink>
    );
  }
  const lens = link.lens;
  const onClick = lens
    ? (e: MouseEvent<HTMLAnchorElement>) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        history.replaceState(null, "", link.href);
        requestLens(lens);
      }
    : undefined;
  return (
    <a href={link.href} className={className} onClick={onClick}>
      {words}
    </a>
  );
}

export function Checks({ data }: { data: ChecksData }) {
  const reduce = usePrefersReducedMotion();
  const tier = useDeviceTier();
  const [filter, setFilter] = useState<FilterId>("all");
  // What the live region last said: empty until the reader picks a chip,
  // so nothing is announced on load.
  const [said, setSaid] = useState("");
  const railRef = useRef<HTMLDivElement>(null);

  const total = data.rows.length;
  const counts = useMemo(() => {
    const c: Record<FilterId, number> = { all: data.rows.length, site: 0, call: 0, handover: 0 };
    for (const r of data.rows) c[r.kind] += 1;
    return c;
  }, [data.rows]);
  const rows = filter === "all" ? data.rows : data.rows.filter((r) => r.kind === filter);

  function pick(i: number) {
    const next = data.filters[i]?.id;
    if (!next || next === filter) return;
    const words = fillShowing(data.showing, counts[next], total);
    // On a phone the rail scrolls: bring the chosen chip to its middle
    // (the rail only; the page never moves).
    const rail = railRef.current;
    const chip = rail?.querySelector<HTMLElement>(`[data-filter="${next}"]`);
    if (rail && chip && rail.scrollWidth > rail.clientWidth) centreInRail(rail, chip, reduce);
    withViewTransition(
      "checks",
      () => {
        setFilter(next);
        setSaid(words);
      },
      { allowed: vtAllowed(reduce, tier) },
    );
  }

  const radio = useRovingRadio({
    count: data.filters.length,
    index: data.filters.findIndex((f) => f.id === filter),
    orientation: "horizontal",
    onChange: (i) => pick(i),
  });

  const missing = data.missing;

  // The key, in the chips' order. Its words are the sub's three
  // sentences, one per kind, so the sub moves under the heading into the
  // key rather than being said twice; if it ever stops being one
  // sentence per kind, it stays whole under the heading and the key is
  // pictures alone.
  const kinds = data.filters.flatMap((f) => (f.id === "all" ? [] : [f.id]));
  const sentences = data.sub.split(/(?<=\.)\s+/);
  const perKind = sentences.length === kinds.length;

  return (
    <section id="checks" aria-labelledby="checks-title" className="scroll-mt-8">
      <Frame>
        <HomeHeading
          id="checks-title"
          eyebrow={data.eyebrow}
          title={data.title}
          titleKey={data.key}
          sub={perKind ? undefined : data.sub}
          action={
            // Beside the heading from lg, under it below. At lg the column
            // is 944px and one row of four chips (~600px) would leave the
            // heading 300: there the rail wraps into two rows of two at
            // 344px, right-aligned; from xl it is one row. On a phone it
            // scrolls sideways, edge to edge, as every landing rail does.
            <ChipRail
              label={data.filtersAria}
              railRef={railRef}
              className="lg:max-w-[344px] lg:flex-wrap lg:justify-end lg:snap-none lg:overflow-visible xl:max-w-none"
            >
              {data.filters.map((f, i) => {
                const on = f.id === filter;
                return (
                  <button
                    key={f.id}
                    type="button"
                    {...radio.getItemProps(i)}
                    data-filter={f.id}
                    className={cn(FILTER_CHIP, on ? CHIP.on : CHIP.off)}
                  >
                    {f.label}
                    <span
                      className={cn(
                        TYPE.mono,
                        "transition-colors duration-180 ease-[cubic-bezier(0.16,1,0.3,1)]",
                        on ? "text-white" : "text-pp-muted",
                      )}
                    >
                      {counts[f.id]}
                    </span>
                  </button>
                );
              })}
            </ChipRail>
          }
        />

        {/* ── The key ── one cell per kind, in the chips' order: its figure,
            and the sub's sentence for it. The #trust cells' hairlines, the
            ledger's own top rule closing them, so the key heads the
            ledger: a column on a phone, each figure beside its words on
            their midline, and three across from md, the words under. Not
            a control (the chips are): a kind the list is not showing
            only dims. */}
        <div className="mt-10 grid border-t border-pp-rule md:grid-cols-3 lg:mt-12">
          {kinds.map((kind, i) => {
            const off = filter !== "all" && filter !== kind;
            return (
              <div
                key={kind}
                className={cn(
                  "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-5 border-pp-rule py-4 md:block md:py-6",
                  i > 0 && "border-t md:border-t-0 md:border-l md:pl-6",
                  i < kinds.length - 1 && "md:pr-6",
                )}
              >
                <KindFigure kind={kind} i={i} off={off} />
                {perKind && (
                  <p
                    className={cn(
                      TYPE.body,
                      "text-pretty transition-colors duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] md:mt-4",
                      off ? "text-pp-muted" : "text-pp-ink/80",
                    )}
                  >
                    {sentences[i]}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <ul className="border-t border-pp-rule">
          {rows.map((row, i) => {
            // Below lg the tag heads each run of one kind instead of
            // repeating on every row (six "Now, in this browser" in a
            // row is six lines a phone scrolls past), and the rows sit
            // 16px from their hairlines rather than 20. Every row still
            // reads its own tag to a screen reader, and from lg, where
            // the tag is a column, every row shows it. Worked out on the
            // rows showing, so a filter's first row always has its tag.
            const opens = i === 0 || rows[i - 1].kind !== row.kind;
            return (
              <li
                key={row.id}
                // Named only while our transition runs (saas-closing.css §10).
                className="saas-check grid gap-2 border-b border-pp-rule py-4 lg:grid-cols-[168px_minmax(0,1fr)_minmax(0,1fr)] lg:items-baseline lg:gap-8 lg:py-5"
                style={{ "--saas-vt": `saas-check-${row.id}` } as CSSProperties}
              >
                {/* The glyph is centred on the tag's line; the tag's own
                    words carry the baseline the row aligns on at lg. */}
                <p
                  className={cn(
                    TYPE.mono,
                    "flex items-baseline gap-2 text-pp-muted uppercase",
                    !opens && "max-lg:sr-only",
                  )}
                >
                  <CheckGlyph kind={row.kind} className={cn("self-center", GLYPH[row.kind])} />
                  <span>
                    {data.kinds[row.kind]}
                    <span className="sr-only">:</span>
                  </span>
                </p>
                <p className="text-[15px] leading-[22px] text-pretty text-pp-ink" style={{ fontWeight: 500 }}>
                  {row.claim}
                </p>
                <div className="min-w-0">
                  <p className={cn(TYPE.meta, "text-pretty")}>{row.how}</p>
                  {row.link && <RowLink link={row.link} />}
                </div>
              </li>
            );
          })}
        </ul>

        {/* ── The one this page can’t show you ── apart from the rows, on
            a card of the credentials' pearl, standing still (no flow: it
            is a paper to read, and the page's last light before the deep
            panel), rising once as it comes up the screen. Named with the
            rows for the transition, so it slides with the list's foot
            instead of jumping under the rows still fading. Its words take
            the light's own tokens (saas.css §2). */}
        <div
          className="saas-check saas-lit saas-light-papers home-rise mt-12 grid gap-6 p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:gap-12 md:p-10 lg:p-12"
          style={{ "--saas-vt": "saas-check-missing" } as CSSProperties}
        >
          <span aria-hidden className="home-grain" />
          <div className="min-w-0">
            <h3 className={cn(TYPE.label, "text-(--saas-accent)")}>{missing.label}</h3>
            <p className="mt-3 max-w-[600px] text-[16px] leading-[25px] text-pretty text-(--saas-text)">{missing.body}</p>
          </div>
          <PillLink href={missing.cta.href} className="group justify-self-start">
            {missing.cta.label}
            {/* The header's and the cover's arrow, as on every way to the call. */}
            <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-[0.2em]">
              →
            </span>
          </PillLink>
        </div>

        <p aria-live="polite" className="sr-only">
          {said}
        </p>
      </Frame>
    </section>
  );
}
