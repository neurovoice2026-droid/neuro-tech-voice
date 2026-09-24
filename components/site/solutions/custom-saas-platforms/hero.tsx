import { Fragment, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { CornerDot } from "@/components/site/corner-dot";
import { Frame, PillLink } from "@/components/site/product/primitives";
import { HomeEyebrow, KeyedTitle } from "@/components/site/home/heading";
import { TYPE, WEIGHT } from "@/components/site/home/type";
import type { HeroData } from "@/lib/pages/custom-saas-platforms";
import { FlowToggle, LiveMesh } from "./live-mesh";

/* ------------------------------------------------------------------ *
 * #top — anyone can say "complete SaaS". What have you built?
 *
 * The answer is in the h1 before it is anywhere else: we build complete
 * SaaS platforms, and you are on one of them. Beside it, the proof in
 * one picture: a pearl room (the landing's climb of aqua, sky, lilac,
 * blush, champagne and mint in one surface) holding four white plates,
 * one per layer of the menu's stack — web app, database, payments,
 * hosting — each naming what runs that layer under this very site and
 * one figure the site's own tests count from the repository. Under both,
 * a strip of the page's three pieces of evidence, each a link down to
 * where it is shown: the accreditations, the grants, and this platform.
 *
 * THE H1 IS NEVER SPLIT. It is on screen at load, and hiding a heading
 * the reader is already looking at to raise it again is a flash, not an
 * entrance. It is set at WEIGHT.h2, not display's 440: type.ts has weight
 * follow the ground, and the landing's two display headings sit on dark;
 * this one is on white. Its key phrase is violet from the first paint
 * (`KeyedTitle` with no reveal around it).
 *
 * THE LCP is the h1 from md up, in Instrument Sans, and the sub below md,
 * in Inter; the shell preloads both faces. Plain server text with nothing
 * keyed on the clock, and this section is the one not in a Deferred box,
 * so nothing holds its paint back. The h1 is drawn in a fallback sized to
 * the face until the face arrives, Arial's or, where there is no Arial,
 * Roboto's (shell.tsx, saas.css §0), so its lines break where the face's
 * will and nothing under it moves when it swaps in.
 *
 * THE ROOM moves in three ways, all of them cheap. Its light flows while
 * it is on screen (`LiveMesh`: #pricing's compositor pools, saas.css §3;
 * slower than the plan cards, at 1.12, because the room is bigger). The
 * plates assemble once on load, rising into place one after another, and
 * come apart a little as the room scrolls out of the top of the screen,
 * the top plate lifting and the bottom one dropping (saas.css §4). Both
 * are transform only, so no plate is ever faded, and the second rides the
 * `translate` property so it composes with the first. The room keeps
 * 16px between the plates and what is above and below them, and neither
 * movement leaves it: the plates rise from at most 16px low, so the
 * room's foot line is never under one, and part by at most 15px.
 *
 * THE READER'S PAUSE. The room's light, and every other on the page,
 * loops while it is on screen, behind text, so the room's heading row
 * carries the control that stops them all (`FlowToggle`, WCAG 2.2.2): on
 * the first surface that moves, and drawn only while something flows.
 *
 * THE FINISHED FRAME is the server's markup: reduced motion, the still
 * tier and weak hardware get the plates in place on the light standing
 * still. On lite the plates stand still and the light keeps flowing
 * unless the hardware itself is weak (<html data-weak>), as on the plan
 * cards.
 *
 * TEXT ON THE LIGHT uses only the light's measured tokens (--saas-text,
 * --saas-dim, --saas-accent; palette.ts SAAS_INK): the landing's own
 * muted and violet fall under 4.7 on a flowing pool. The plates are
 * white, so on them the landing's tokens are safe again and are used:
 * muted labels (6.37 on white) and violet figures (7.10).
 *
 * A server component. The client code is `LiveMesh`'s observer, the
 * pause, and the two leaves from home/heading. The focus ring is written out here, not
 * imported: controls.tsx is a client module, and a server component would
 * get a reference to its RING_LIGHT, not the string.
 * ------------------------------------------------------------------ */

/** controls.tsx RING_LIGHT, spelled out: a ring in the ground's ink. */
const RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink";

/** The one arrow that answers the pointer: down 2px, over 200ms. */
const DOWN = "ml-1 inline-block transition-transform duration-200 group-hover:translate-y-0.5";

/**
 * A white plate on the pearl: the landing's card shadow, a hairline drawn
 * inside so the plate's edge reads on the palest part of the light.
 *
 * The layer's label keeps its own width and the figure takes the rest,
 * flush right, balanced over two lines where the plate is too narrow for
 * one. The other way round (the figure `auto`), the figure took the whole
 * row at 320–329px and the letter-spaced label ran into it:
 * "PAYMENTS7 Stripe event types".
 */
const PLATE = cn(
  "saas-plate grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 rounded-2xl bg-white px-4 py-3",
  "shadow-[0_1px_2px_rgb(20_10_36/0.06),inset_0_0_0_1px_rgb(20_10_36/0.06)]",
);

/**
 * PillLink's secondary pill (product/primitives), spelled out for an
 * in-page `#…`, as RING is. PillLink sends every href but an external one
 * through IntentLink, a Next Link, which takes a same-page fragment over
 * itself: a router push and its own smooth scroll, so the browser's
 * fragment navigation (the focus start point, `:target`) never happened,
 * and a click something else had handled was one jumps.tsx leaves alone.
 * "Explore the platform" landed #platform 211px low at 320 and stayed
 * there. A plain anchor, as every other in-page link on the page is
 * (check-line.tsx), gets the browser's jump and the one more look.
 */
const PILL_HASH = cn(
  "inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full px-5 text-base whitespace-nowrap",
  "pp-shadow-btn bg-white text-pp-ink transition-[background-color,color,scale] duration-200 hover:bg-pp-card active:scale-[0.97]",
  RING,
);

export function Hero({ data, blobs }: { data: HeroData; blobs: readonly CSSProperties[] }) {
  return (
    <section id="top" aria-labelledby="top-title" className="scroll-mt-8">
      {/* The header is fixed and see-through while docked, so the hero
          clears it with its own padding (the custom-ai-agents precedent). */}
      <Frame className="pt-28 md:pt-[148px]">
        {/* One column to lg, the text first: on a phone the claim and the
            way in come before the picture. From lg the room stands to the
            right of the text at 440px, and at 500px from xl. */}
        <div
          className={cn(
            "grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:items-center lg:gap-12",
            "xl:grid-cols-[minmax(0,1fr)_500px] xl:gap-16",
          )}
        >
          <div className="min-w-0">
            <HomeEyebrow className="mb-4">{data.eyebrow}</HomeEyebrow>
            <h1 id="top-title" className={cn(TYPE.display, "max-w-[14em]")} style={{ fontWeight: WEIGHT.h2 }}>
              <KeyedTitle title={data.title} titleKey={data.key} />
            </h1>
            {/* The LCP below md (the h1 is, from md). */}
            <p className={cn(TYPE.lead, "mt-5 max-w-[34em] text-pretty")}>{data.sub}</p>

            {/* Stacked full width on a phone; one row from sm, 8px apart,
                and 24px apart whenever the row has to wrap (the landing's
                #start). */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-x-2 sm:gap-y-6">
              <PillLink href={data.primary.href} className="group">
                {data.primary.label}
                {/* The header's and the landing's arrow, so the call reads
                    as the same action everywhere it appears. */}
                <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-[0.2em]">
                  →
                </span>
              </PillLink>
              {data.secondary.href.startsWith("#") ? (
                <a href={data.secondary.href} className={PILL_HASH}>
                  {data.secondary.label}
                </a>
              ) : (
                <PillLink href={data.secondary.href} variant="secondary">
                  {data.secondary.label}
                </PillLink>
              )}
            </div>
            {/* Each half an inline block, so a narrow phone breaks the note
                at its own dot rather than inside the number, and a half
                wider than the column (text spacing overrides at 320px)
                still wraps inside itself instead of overflowing; the text
                itself is the note, character for character. */}
            <p className={cn(TYPE.meta, "mt-4 text-pp-ink/70")}>
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

          {/* The room: a lit surface (saas.css §2), its flowing light first
              and its grain second, then the content. Capped at 560px while
              it sits under the text, so on a tablet it stays a picture
              rather than a band. `.saas-room` names the view timeline the
              plates come apart on. */}
          <div className="saas-lit saas-light-room saas-room min-w-0 p-5 md:max-w-[560px] md:p-6">
            <LiveMesh blobs={blobs} drift={1.12} />
            <span aria-hidden className="home-grain" />

            {/* A heading, so the list below it sits under one: the section's
                only other heading is the h1. Beside it, the pause for every
                flowing light on the page; the row keeps the button's 40px
                whether or not it is drawn, so nothing moves when it is. */}
            <div className="flex min-h-10 items-center justify-between gap-3">
              <h2 className={cn(TYPE.label, "flex items-center gap-2 text-(--saas-dim)")}>
                <CornerDot className="size-2.5" />
                {data.room.tag}
              </h2>
              <FlowToggle pause={data.room.flow.pause} play={data.room.flow.play} />
            </div>

            {/* One list, one plate per layer, in the menu's order. The
                figure is the plate's first line, read right after its layer:
                it is what the site's tests hold true. The last line is set
                pretty, so it never ends on one word ("07:00 / UTC" at xl,
                "fiscal / invoices" at lg). `--i` staggers the assembly and
                sets how far each plate moves apart. */}
            <dl className="mt-4 grid gap-2">
              {data.room.plates.map((p, i) => (
                <div key={p.layer} className={PLATE} style={{ "--i": i } as CSSProperties}>
                  <dt className={cn(TYPE.label, "text-(--home-muted)")}>{p.layer}</dt>
                  <dd className={cn(TYPE.mono, "text-right text-balance text-(--home-violet)")}>{p.datum}</dd>
                  <dd className="col-span-2 mt-1 text-[15px] leading-[22px] font-medium text-pp-ink">{p.name}</dd>
                  <dd className={cn(TYPE.meta, "col-span-2 text-pretty text-pp-ink/70")}>{p.runs}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
              <p className={cn(TYPE.meta, "max-w-[30em] text-pretty text-(--saas-dim)")}>{data.room.foot}</p>
              {/* A block, not a flex row: a flex parent would carry its
                  underline into the arrow and break it across the gap. The
                  arrow is an inline block, so the underline stops at the
                  words. 18px of line and 3px either side: a 24px target. */}
              <a
                href={data.room.link.href}
                className={cn(
                  "home-link group relative inline-block min-h-6 rounded-sm py-[3px] text-[13px] leading-[18px]",
                  "before:absolute before:inset-x-0 before:-inset-y-2.5",
                  RING,
                )}
              >
                {data.room.link.label}
                <span aria-hidden className={DOWN}>
                  ↓
                </span>
              </a>
            </div>
          </div>
        </div>

        {/* The evidence, as three ways down the page: a row of three from
            sm between hairlines, three rows on a phone. Each is one link,
            44px tall at the least, its label, what it is and a line on it,
            and nothing in it is hidden from a screen reader but the arrow. */}
        <nav aria-label={data.proofLabel} className="mt-12 grid border-y border-pp-rule sm:grid-cols-3 lg:mt-16">
          {data.proof.map((p) => (
            <a
              key={p.label}
              href={p.href}
              className={cn(
                "group block min-h-11 border-t border-pp-rule py-5 first:border-t-0",
                "sm:border-t-0 sm:border-l sm:px-6 sm:first:border-l-0 sm:first:pl-0 sm:last:pr-0",
                RING,
              )}
            >
              <span className={cn(TYPE.label, "block text-pp-muted")}>{p.label}</span>
              <span className={cn(TYPE.h3, "mt-1 block")} style={{ fontWeight: WEIGHT.h3 }}>
                {p.term}
              </span>
              <span className={cn(TYPE.meta, "mt-1 block text-pretty")}>
                {p.detail}
                <span aria-hidden className={DOWN}>
                  ↓
                </span>
              </span>
            </a>
          ))}
        </nav>
      </Frame>
    </section>
  );
}
