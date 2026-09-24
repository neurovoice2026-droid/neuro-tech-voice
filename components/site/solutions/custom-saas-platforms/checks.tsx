"use client";

import { useMemo, useRef, useState, type CSSProperties } from "react";
import type { CheckKind, ChecksData, Link } from "@/lib/pages/custom-saas-platforms";
import { cn } from "@/lib/utils";
import { IntentLink } from "@/components/site/intent-link";
import { Frame, PillLink } from "@/components/site/product/primitives";
import { useDeviceTier } from "@/components/site/product/device-tier";
import { usePrefersReducedMotion } from "@/components/site/product/timing";
import { CHIP, ChipRail, RING_LIGHT, centreInRail, useRovingRadio } from "@/components/site/home/controls";
import { HomeHeading } from "@/components/site/home/heading";
import { TYPE } from "@/components/site/home/type";
import { CheckGlyph } from "./check-line";
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
 * muted, with a link where there is somewhere to go. Then, set apart,
 * "The one this page can’t show you": that we will build yours well. It
 * is the only claim no page can hold, so it is not dressed as a row, and
 * it ends on the only way to check it, the call.
 *
 * THE FILTER. Four chips, a radio group (`useRovingRadio`: one tab stop,
 * arrows move and pick at once): every claim, or only those of one kind,
 * each with its count, worked out from the rows so a row added to the
 * data module counts itself. On a phone the chips run in a rail that
 * scrolls sideways, and the one picked is brought to its middle; from lg
 * they sit beside the heading. A change swaps the list as one same-document
 * View Transition (vt.ts): the rows that stay slide to their new places,
 * the rows that go fade where they stood, the rows that come rise 6px
 * into theirs, and "the one this page can’t show you" slides with the
 * list's foot rather than jumping under the rows still fading. The
 * browser animates snapshots on the compositor; the list itself is
 * simply re-rendered, flushed inside the transition's callback. Only
 * transform and opacity move (saas-closing.css §10).
 *
 * NAMED ONLY WHILE OURS RUNS. Each row carries its transition name as a
 * custom property (`--saas-vt: saas-check-<id>`), and saas-closing.css
 * turns it into a `view-transition-name` only under <html
 * data-saas-vt="checks">, which vt.ts sets for the life of our own
 * transition. So the twelve rows are never captured by anyone else's —
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
 * screen reader reads "On the call: The people who build hold…". Links
 * are real anchors: an in-page `#…` a plain one, a route an IntentLink.
 *
 * COLOUR. White ground, the landing's tokens: ink claims (19.11:1),
 * muted tags and ways (6.37), violet links (7.10); the chips are the
 * landing's (`CHIP`: white on electric 5.70 when picked). The glyphs are
 * marks: electric for "now" and "at handover", violet for "on the call".
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

/**
 * A row's way to go and check it: 18px of text and 3px either side, a
 * 24px target. A block, not a flex row, so the underline stops at the
 * words; the arrow is an inline-block, which the underline skips.
 */
function RowLink({ link }: { link: Link }) {
  const className = cn(
    "home-link group mt-1 inline-block min-h-6 rounded-sm py-[3px] text-[13px] leading-[18px]",
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
  return link.href.startsWith("/") ? (
    <IntentLink href={link.href} className={className}>
      {words}
    </IntentLink>
  ) : (
    <a href={link.href} className={className}>
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

  return (
    <section id="checks" aria-labelledby="checks-title" className="scroll-mt-28">
      <Frame>
        <HomeHeading
          id="checks-title"
          eyebrow={data.eyebrow}
          title={data.title}
          titleKey={data.key}
          sub={data.sub}
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

        <ul className="mt-10 border-t border-pp-rule">
          {rows.map((row) => (
            <li
              key={row.id}
              // Named only while our transition runs (saas-closing.css §10).
              className="saas-check grid gap-2 border-b border-pp-rule py-5 lg:grid-cols-[168px_minmax(0,1fr)_minmax(0,1fr)] lg:items-baseline lg:gap-8"
              style={{ "--saas-vt": `saas-check-${row.id}` } as CSSProperties}
            >
              {/* The glyph is centred on the tag's line; the tag's own
                  words carry the baseline the row aligns on at lg. */}
              <p className={cn(TYPE.mono, "flex items-baseline gap-2 text-pp-muted uppercase")}>
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
          ))}
        </ul>

        {/* ── The one this page can’t show you ── apart from the rows, and
            named with them for the transition, so it slides with the
            list's foot instead of jumping under the rows still fading. */}
        <div
          className="saas-check mt-12 grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:gap-12"
          style={{ "--saas-vt": "saas-check-missing" } as CSSProperties}
        >
          <div className="min-w-0">
            <h3 className={cn(TYPE.label, "text-pp-accent")}>{missing.label}</h3>
            <p className={cn(TYPE.lead, "mt-3 max-w-[600px] text-pretty")}>{missing.body}</p>
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
