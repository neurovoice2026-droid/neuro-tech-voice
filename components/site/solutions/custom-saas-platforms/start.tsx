import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { CornerDot } from "@/components/site/corner-dot";
import { IntentLink } from "@/components/site/intent-link";
import { Frame } from "@/components/site/product/primitives";
import { HomeHeading } from "@/components/site/home/heading";
import { TYPE } from "@/components/site/home/type";
import type { CreditsData, StartData } from "@/lib/pages/custom-saas-platforms";

/* ------------------------------------------------------------------ *
 * #start — how do I start? The close, then the page's credits.
 *
 * THE PANEL is the page's one dark ground: the landing's deep panel
 * (`.home-deep`, home.css `--home-deep`, palettes.ts DEEP_PANEL), night
 * violet at the top left opening to electric at the bottom right, under
 * the film of grain every dark ground on the landing wears (its
 * `::after`; none on the lite tier, tier.css). It is static: no light
 * flows here, because text sits all over it and a moving dark mesh could
 * not be held to its contrast. Nothing loops. The panel settles once as
 * it comes up the screen (`home-rise`, a view timeline, transform only)
 * and the heading's lines rise out of their masks, and that is all.
 *
 * ITS COLOURS ARE PLACED BY MEASUREMENT (spec §6.3, held by the page's
 * test over the panel's wide and narrow sizes). On-deep (#f1ecff) and the
 * heading's paper read everywhere on the panel, 4.93 and 4.85 at the
 * electric corner. Lilac, the eyebrow and the key phrase, reads only in
 * the darker top left: within 62% of the width and 62% of the height
 * where the actions sit beside the text (xl), the top 45% where they
 * stack under it (below xl). On-deep-dim, the body, reads within 70% ×
 * 85% at xl, the top 70% below (it ends 81% and at most 66% down). So
 * the layout keeps both there: the heading opens the panel at its top
 * left, the body under it in the same column. From xl the actions and
 * the note — on-deep and white only — take the bottom right, where the
 * light is brightest, and the text column is what they leave of the
 * row, which holds the key inside the left 55% of the panel at every
 * width from 1280 up. Below xl (lg
 * included, where beside the actions the heading would set in four
 * lines) the actions stack under the body, so the heading and the body
 * take the top of the panel and the actions its foot.
 *
 * The heading has no `sub`: HomeHeading's dark sub is paper-dim, which
 * was never measured on this panel. The body is set here instead, in
 * on-deep-dim, inside its zone.
 *
 * THE ACTIONS. The phone call first — a build starts with one, there is
 * no form — as a white pill: HomeHeading's PillLink would be ink on ink
 * here. Then the free trial, outlined, for the reader who wants to try
 * the platform the page is about before calling. Both are 44px, both
 * ring in white for the keyboard (controls.tsx RING_DARK, spelled out,
 * because controls.tsx is a client module and this one is not). On a
 * phone, where they stack full width, their words may wrap (a reader's
 * own letter and word spacing can make them wider than the panel); from
 * sm, side by side, they never do. The note under them sets each half as
 * an inline block, so a narrow phone breaks it at its own dot, and a half
 * wider than the line still wraps inside itself rather than running out
 * of the panel.
 *
 * THE CREDITS follow, set like the imprint under them: everything on the
 * page that is a sample, a drawing, a floor or somebody else's trademark,
 * in SAAS_CREDITS order, with every trademark line. The landing Start's
 * credits layout, copied: from xl they hang off the FAQ's 384px rail, so
 * the rows start on the line the questions set.
 *
 * A server component. The only client code is the heading's reveal and
 * the trial link's prefetch on intent.
 * ------------------------------------------------------------------ */

/** controls.tsx RING_DARK, spelled out: a white ring on the deep panel. */
const RING_DARK = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

/** TYPE.lead and TYPE.meta without their colours: on the panel, the colour is the zone's. */
const LEAD_SIZE = "text-[16px] leading-[25px]";
const META_SIZE = "text-[13px] leading-[18px]";

export function Start({ data, credits }: { data: StartData; credits: CreditsData }) {
  return (
    <section id="start" aria-labelledby="start-title" className="scroll-mt-8">
      <Frame>
        <div className="home-deep home-rise relative overflow-hidden rounded-[28px] p-6 md:p-12 lg:px-16 lg:py-20">
          {/* One column below xl, held to the panel: an implicit auto column
              would grow to the widest thing that cannot wrap, and the
              panel's overflow-hidden would cut every line on the right.
              Not from lg: the two pills are some 450px that never wrap,
              and beside them at 1024–1255 the heading would get 330–490px
              and set in three or four lines, "whatever you / already
              have" split across two. From xl the text column is 558px
              or more, and the key's line (546px) fits whole. */}
          <div className="grid grid-cols-[minmax(0,1fr)] gap-10 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
            <div className="min-w-0">
              <HomeHeading
                id="start-title"
                size="display"
                tone="dark"
                eyebrow={data.eyebrow}
                title={data.title}
                titleKey={data.key}
                // KeyedTitle holds the key's last two words together. At
                // display size on a phone, with a reader's own letter and
                // word spacing, the pair can be wider than the panel, which
                // would cut it; there, and only when nothing else fits, it
                // may break inside a word rather than lose one.
                className="max-w-[640px] max-sm:[&_.home-key]:[overflow-wrap:anywhere]"
              />
              {/* 22.5em (360px in Inter at 16px): a comfortable block
                  under the heading's lines. `pretty`, not `balance`: the
                  body is three sentences and should set as one block. */}
              <p className={cn(LEAD_SIZE, "mt-5 max-w-[22.5em] text-pretty text-(--home-on-deep-dim)")}>{data.body}</p>
            </div>

            <div className="flex flex-col items-stretch gap-4 sm:items-start xl:items-end">
              {/* Stacked full width on a phone, 44px at the least and
                  free to wrap; one row from sm, 8px apart, and 24px apart
                  whenever the row has to wrap. */}
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-x-2 sm:gap-y-6">
                {/* A plain anchor, not PillLink: a `tel:` needs no
                    prefetch, and PillLink's primary is ink, which would
                    vanish into the panel. */}
                <a
                  href={data.primary.href}
                  className={cn(
                    "group inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full px-5 py-2.5 text-center text-base sm:py-0 sm:whitespace-nowrap",
                    "bg-white text-(--home-ink) transition-[background-color,scale] duration-200 hover:bg-(--home-stage) active:scale-[0.97]",
                    RING_DARK,
                  )}
                >
                  {data.primary.label}
                  {/* The header's and the cover's arrow, so the primary
                      action reads as one thing wherever it is. */}
                  <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-[0.2em]">
                    →
                  </span>
                </a>
                <IntentLink
                  href={data.secondary.href}
                  className={cn(
                    "inline-flex min-h-11 shrink-0 items-center justify-center rounded-full px-5 py-2.5 text-center text-base sm:py-0 sm:whitespace-nowrap",
                    "text-(--home-on-deep) ring-1 ring-white/30 transition-[background-color,scale] duration-200 hover:bg-white/[0.08] active:scale-[0.97]",
                    RING_DARK,
                  )}
                >
                  {data.secondary.label}
                </IntentLink>
              </div>
              {/* On-deep, not dim: the note sits where the panel is
                  brightest, where only on-deep is measured to read. Each
                  half is an inline block, so a narrow phone breaks the
                  note at its own dot, and a half too wide for the line
                  wraps inside itself; the text itself is the note,
                  character for character. */}
              <p className={cn(META_SIZE, "text-(--home-on-deep) tabular-nums xl:text-right")}>
                {data.note.split(" · ").map((part, i, all) => {
                  const last = i === all.length - 1;
                  return (
                    <Fragment key={part}>
                      <span className="inline-block max-w-full">{last ? part : `${part} ·`}</span>
                      {!last && " "}
                    </Fragment>
                  );
                })}
              </p>
            </div>
          </div>
        </div>
      </Frame>

      <Frame className="mt-16 border-t border-pp-rule pt-8 md:pt-10">
        <section
          aria-labelledby="credits-title"
          // The rail from xl only: at lg it would leave the two columns
          // 232px each, and every term would wrap.
          className="grid gap-6 xl:grid-cols-[384px_minmax(0,1fr)] xl:items-baseline xl:gap-12"
        >
          {/* Block, with the dot inline: a flex heading would take its
              baseline from the SVG, and the row aligns on baselines. */}
          <h3 id="credits-title" className={cn(TYPE.label, "text-pp-muted")}>
            <CornerDot className="mr-2 inline-block size-2.5 align-middle" />
            {credits.title}
          </h3>
          {/* A ledger: a hairline over every row but the first (and, from
              md, the second), which the rule above already heads. The two
              columns share their rows, so a short entry beside a long one
              reads as a table row rather than as a gap nobody meant. */}
          <dl className="grid gap-x-12 gap-y-4 md:grid-cols-2">
            {credits.items.map((c) => (
              <div
                key={c.term}
                className="min-w-0 border-t border-pp-rule pt-4 first:border-t-0 first:pt-0 md:nth-2:border-t-0 md:nth-2:pt-0"
              >
                <dt className={TYPE.body} style={{ fontWeight: 500 }}>
                  {c.term}
                </dt>
                <dd className={cn("mt-1 text-pretty", TYPE.meta)}>{c.detail}</dd>
              </div>
            ))}
          </dl>
        </section>
      </Frame>
    </section>
  );
}
