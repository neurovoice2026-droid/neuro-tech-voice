import { Fragment } from "react";
import { CornerDot } from "@/components/site/corner-dot";
import { Frame, PillLink } from "@/components/site/product/primitives";
import { HOME, HOME_CREDITS } from "@/lib/pages/home";
import { cn } from "@/lib/utils";
import { HomeHeading } from "./heading";
import { STUDIO_PANEL } from "./palettes";
import { TYPE } from "./type";

/* ------------------------------------------------------------------ *
 * #start — how do I begin: the closing panel, then the page's credits.
 *
 * The panel is the page's last colour: the house poster's light (violet
 * on paper) falling from the top left, under the same film of grain as
 * every gradient on the page. It is brightest behind the heading and
 * deepest under the two actions, so the eye reads the ask and lands on
 * the way in. Nothing loops: the panel settles once as it comes up the
 * screen (home-rise, a view timeline, transform only) and the heading's
 * lines rise out of their masks, and that is all.
 *
 * Under it, set like the imprint that follows, the credits: everything
 * on the page that is a sample, a fiction, in beta or somebody else's
 * trademark, in HOME_CREDITS order. From xl they hang off the FAQ's
 * 384px rail, so the rows start on the line the questions set.
 *
 * A server component. The only client code is HomeHeading's reveal.
 * ------------------------------------------------------------------ */

/** NEW (spec S9): the credits' heading. */
const CREDITS_TITLE = "About this page";

export function Start() {
  const s = HOME.start;
  return (
    <section id="start" aria-labelledby="start-title" className="scroll-mt-28">
      <Frame>
        <div
          className={cn(
            "home-rise relative isolate overflow-hidden rounded-[28px] p-6 md:p-12 lg:px-16 lg:py-20",
            // The ring is drawn inside the box: Deferred contains paint to
            // its own edges, and the panel starts flush with its top.
            "shadow-[inset_0_0_0_1px_rgb(24_16_40/0.06),inset_0_1px_0_rgb(255_255_255/0.7)]",
          )}
          style={{ background: STUDIO_PANEL }}
        >
          <div aria-hidden className="pp-grain pointer-events-none absolute inset-0 opacity-40" />

          <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-baseline-last">
            <div className="min-w-0">
              <HomeHeading id="start-title" size="display" eyebrow={s.eyebrow} title={s.title} className="max-w-[640px]" />
              {/* 22.5em holds "…four screens," (340px in Inter at 16px) and
                  not "…screens, and" (373px), so the sentence breaks at its
                  own comma and sits as one block under the heading's two
                  lines. `pretty`, not `balance`: balance would even the
                  lines out by splitting "four screens". */}
              <p className={cn("mt-5 max-w-[22.5em] text-pretty", TYPE.lead)}>{s.body}</p>
            </div>

            <div className="flex flex-col items-stretch gap-4 sm:items-start lg:items-end">
              {/* Stacked full width on a phone; one row from sm, 8px
                  apart, and 24px apart whenever the row has to wrap. */}
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-x-2 sm:gap-y-6">
                <PillLink href={s.primary.href} className="group">
                  {s.primary.label}
                  {/* The header's and the cover's arrow, so the primary
                      action reads as one thing in all three places. */}
                  <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-[0.2em]">
                    →
                  </span>
                </PillLink>
                <PillLink href={s.secondary.href} variant="secondary">
                  {s.secondary.label}
                </PillLink>
              </div>
              {/* Ink at 70%, not the muted grey: the note sits where the
                  light is deepest, and pp-muted there measures 4.0:1.
                  Each half is kept whole, so a narrow phone breaks it at
                  its own dot rather than leaving "needed" on a line alone;
                  the text itself is the note, character for character. */}
              <p className={cn(TYPE.meta, "text-pp-ink/70 lg:text-right")}>
                {s.note.split(" · ").map((part, i, all) => {
                  const last = i === all.length - 1;
                  return (
                    <Fragment key={part}>
                      <span className="whitespace-nowrap">{last ? part : `${part} ·`}</span>
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
            {CREDITS_TITLE}
          </h3>
          {/* A ledger: a hairline over every row but the first, which the
              rule above already heads. The two columns share their rows, so
              a short entry beside a long one reads as a table row rather
              than as a gap nobody meant. */}
          <dl className="grid gap-x-12 gap-y-4 md:grid-cols-2">
            {HOME_CREDITS.map((c) => (
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
