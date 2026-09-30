import type { CSSProperties } from "react";
import { Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { Frame } from "@/components/site/product/primitives";
import { HomeHeading } from "@/components/site/home/heading";
import { TYPE, WEIGHT } from "@/components/site/home/type";
import type { Part, ServerData } from "@/lib/pages/custom-mobile-applications";
import { CheckLine } from "@/components/site/solutions/custom-saas-platforms/check-line";
import { KindTag, PartGlyph } from "./glyphs";

/* ------------------------------------------------------------------ *
 * #server — "Who runs the server? Is any of this real?"
 *
 * Almost every app talks to a server, and the reader never sees it.
 * This is the half the page's title promises: the nine parts an app
 * talks to, in full, eight of which this platform — our own product for
 * AI phone agents — already runs, each with what any app needs of it,
 * what ours does, a figure counted from the code, and how to check it.
 * The ninth, push, is the one this platform lacks, and its card says so:
 * the page's one caveat about it. The sub says the rest in words: yours
 * gets its own, built with your app.
 *
 * THE NIGHT ROOM. White heading, then the cards on a still night — the
 * landing's ink to the deep panel's violet, top to bottom, the gradient
 * the Automations page's #breaks measured (`.mob-night`, mob-server.css
 * §1): no mesh and no flow, so the second half of the page gets a
 * ground of its own that no light near it shares. On it, in the room's
 * own tokens (spec §5.4): "The app", with a phone, in lilac (8.37 at its
 * worst); the tag in on-deep-dim (12.02); nothing in the electric (3.35:
 * never text here). The cards are white (18.04 against the room), so
 * inside them the landing's tokens hold: ink, muted (6.37), violet for
 * the datums and "Built for yours" (7.10), settled for "Runs here"
 * (5.50), the electric for marks.
 *
 * THE WIRE (aria-hidden, behind the cards). From lg a lilac bus runs
 * along the top from the phone, level with its label, to the last
 * column, with a drop down the middle of each column to the last row;
 * at md, two drops; below md, one wire down the left side, 12px in, the
 * cards indented 24px beside it, drawn from the phone to the first card
 * and then from each card to the next. Wherever the wire meets a card —
 * its top edge from md, its left side below — a port: an 8px lilac
 * ring. So each card reads as a part plugged into what the app talks
 * to. The push card, which spans both columns as the last at md, takes
 * a port from both drops there.
 *
 * THE CARDS, one per part in the data module's order (`PARTS`: the same
 * list #hold's drawing and #kinds' rows use, so a part is never called
 * two names): an <article id="server-<id>"> — #hold's and #kinds' links
 * land on it — with its kind in words and the check glyph for it
 * (glyphs.tsx `KindTag`), its datum, its glyph and title, what an app
 * needs of it, what ours does (under "On ours"), and how to check it
 * (`CheckLine`). The push card is drawn dashed in violet, with no
 * shadow: built for yours; its words open with "Not on ours", so it has
 * no "On ours" label over them.
 *
 * THE INDEX, under the room: where each part lives in the code, for the
 * reader's developers, in a closed <details> in the landing's FAQ style
 * (native, so find-in-page opens it). The paths are the code's words,
 * never translated. Then the foot: it's a drawing, not a live feed.
 *
 * MOTION is CSS alone, on the room's own passage up the screen
 * (mob-server.css §2): the bus draws from the phone, the drops fall, and
 * each port pops as its drop reaches it; below md each stretch of the
 * wire draws on its card's own pass. The room and its cards rise
 * (home.css `home-rise`), a step apart across a row from lg (§3).
 * Reduced motion, the lite, still and weak tiers and any browser
 * without view timelines get the finished frame (§4): the wire whole,
 * every port shown, the cards in place.
 *
 * A server component, with no island of its own: the client code is
 * the heading's reveal and `CheckLine`'s route links (IntentLink). The
 * data module is imported for its types only. The focus ring is written
 * out here because controls.tsx is a client module.
 * ------------------------------------------------------------------ */

/** controls.tsx RING_LIGHT, spelled out: a ring in the ground's ink. */
const RING = "rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink";

/**
 * Each card's row, as a share of the rows, at md (two across, push alone
 * in the fifth) and from lg (three across): when its drop reaches it,
 * so its port pops then (mob-server.css §2). Below md each card's port
 * keeps time with its own card instead.
 */
function rows(i: number, total: number) {
  const md = Math.ceil(total / 2);
  const lg = Math.ceil(total / 3);
  return { "--r-md": Math.floor(i / 2) / md, "--r-lg": Math.floor(i / 3) / lg } as CSSProperties;
}

/** A port: an 8px lilac ring where the wire meets a card. Below md on its left side, from md on its top edge. */
const PORT = "mob-port absolute size-2 rounded-full border-2 border-(--home-lilac) bg-(--home-ink)";

function Card({ part, data, i, total }: { part: Part; data: ServerData; i: number; total: number }) {
  const last = i === total - 1;
  // Alone in the last row at md, spanning both columns: its port sits under each drop.
  const wide = last && total % 2 === 1;
  return (
    <li className={cn("mob-server-item relative min-w-0", wide && "md:col-span-2 lg:col-span-1")}>
      <article
        id={`server-${part.id}`}
        aria-labelledby={`server-${part.id}-title`}
        data-col={i % 3}
        data-kind={part.kind}
        className="mob-server-card home-rise relative flex h-full scroll-mt-8 flex-col rounded-[20px] bg-white p-4 text-pp-ink min-[344px]:p-5"
      >
        {/* The datum stays whole: where it can't stand beside the tag, it goes under
            it. Under 344px (where every datum fits beside its tag, and a
            reserve width, with 343 measured beside it: deferred.tsx) the
            card's padding gives its words 8px more measure. */}
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <KindTag kind={part.kind} copy={data.kinds} tone="white" />
          {/* The datum, unless it only says the kind again (push's "built for yours"). */}
          {part.datum.toLowerCase() !== data.kinds[part.kind].toLowerCase() && (
            <span className={cn(TYPE.mono, "text-right whitespace-nowrap text-(--home-violet)")}>
              <span className="sr-only">: </span>
              {part.datum}
            </span>
          )}
        </div>
        <h3
          id={`server-${part.id}-title`}
          className={cn(TYPE.h3, "mt-4 flex items-center gap-2 text-balance")}
          style={{ fontWeight: WEIGHT.h3 }}
        >
          <PartGlyph id={part.id} className="text-(--home-electric)" />
          {part.title}
        </h3>
        <p className={cn(TYPE.label, "mt-4 text-pp-muted")}>{data.labels.forApp}</p>
        <p className={cn(TYPE.meta, "mt-1 text-pretty")}>{part.forApp}</p>
        {/* "On ours" over what ours does; push's words open with "Not on ours", so no label says the opposite over them. */}
        {part.kind === "does" && <p className={cn(TYPE.label, "mt-4 text-pp-muted")}>{data.labels.ours}</p>}
        <p className={cn(TYPE.body, "text-pretty text-pp-ink", part.kind === "does" ? "mt-1" : "mt-4")}>{part.ours}</p>
        <div className="mt-auto pt-5">
          <CheckLine check={part.check} kinds={data.checkKinds} tone="white" />
        </div>
      </article>

      {/* Where the wire meets the card, and below md the wire on to the next one. */}
      <span
        aria-hidden
        className={cn(
          PORT,
          "top-6 -left-4 md:-top-1 md:left-1/2 md:-translate-x-1/2",
          wide && "md:left-[calc((100%-16px)/4)] lg:left-1/2",
        )}
        style={rows(i, total)}
      />
      {wide && (
        <span
          aria-hidden
          className={cn(PORT, "-top-1 left-[calc(100%-(100%-16px)/4)] hidden -translate-x-1/2 md:block lg:hidden")}
          style={rows(i, total)}
        />
      )}
      {!last && (
        <span aria-hidden className="mob-seg absolute top-7 -bottom-11 -left-[13px] w-0.5 rounded-full bg-(--home-lilac) md:hidden" />
      )}
    </li>
  );
}

function Index({ data }: { data: ServerData }) {
  return (
    <div className="home-faq mt-10">
      <details className="group border-y border-pp-rule">
        <summary
          className={cn(
            "flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 [&::-webkit-details-marker]:hidden",
            RING,
          )}
        >
          <h3 className={cn(TYPE.body, "font-medium text-balance text-pp-ink")}>{data.indexSummary}</h3>
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-full bg-(--home-chip) text-pp-ink transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-open:rotate-45"
          >
            <svg viewBox="0 0 12 12" fill="none" className="size-3">
              <path d="M6 1.25v9.5M1.25 6h9.5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
            </svg>
          </span>
        </summary>
        <div className="pt-3 pb-8">
          <p className={cn(TYPE.label, "text-pp-muted")}>{data.labels.code}</p>
          <div className="mt-4 grid gap-x-12 gap-y-6 md:grid-cols-2 lg:grid-cols-3">
            {data.parts.map((p) => (
              <div key={p.id} className="min-w-0">
                <h4 className={cn(TYPE.body, "flex items-center gap-2 font-medium text-pp-ink")}>
                  <PartGlyph id={p.id} className="text-(--home-electric)" />
                  {p.label}
                </h4>
                {p.files.length > 0 ? (
                  <ul className="mt-1.5">
                    {p.files.map((f) => (
                      <li key={f} className={cn(TYPE.mono, "break-all text-pp-muted")} translate="no">
                        {f}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={cn(TYPE.meta, "mt-1.5")}>{data.kinds[p.kind]}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}

export function Server({ data }: { data: ServerData }) {
  const total = data.parts.length;
  return (
    <section id="server" aria-labelledby="server-title" className="scroll-mt-8">
      <Frame>
        <HomeHeading id="server-title" eyebrow={data.eyebrow} title={data.title} titleKey={data.key} sub={data.sub} />

        <div className="mob-night home-rise relative mt-10 p-5 md:p-8 lg:mt-12 lg:p-10">
          <span aria-hidden className="home-grain" />
          <p className={cn(TYPE.mono, "text-pretty text-(--home-on-deep-dim) md:text-right")}>{data.tag}</p>

          <div className="relative mt-4 md:mt-5">
            {/* The app, and the bus from it along the top (md and up) to the last column's drop. */}
            <div className="flex h-6 items-center">
              <p className={cn(TYPE.mono, "flex shrink-0 items-center tracking-[0.08em] text-(--home-lilac) uppercase")}>
                <span className="grid w-6 place-items-center">
                  <Smartphone aria-hidden size={14} strokeWidth={1.75} className="mob-glyph" />
                </span>
                <span className="ml-1.5">{data.bus}</span>
              </p>
              <span
                aria-hidden
                className="mob-bus ml-3 hidden h-0.5 flex-1 rounded-full bg-(--home-lilac) md:mr-[calc((100%-16px)/4)] md:block lg:mr-[calc((100%-48px)/6)]"
              />
            </div>
            {/* The drops, one down the middle of each column, behind the cards: two at md, three from lg. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-3 bottom-0 hidden md:grid md:grid-cols-2 md:gap-x-4 lg:grid-cols-3 lg:gap-x-6"
            >
              {[0, 1, 2].map((c) => (
                <span
                  key={c}
                  className={cn("mob-drop h-full w-0.5 justify-self-center rounded-full bg-(--home-lilac)", c === 2 && "md:hidden lg:block")}
                />
              ))}
            </div>
            {/* Below md: the wire from the foot of the phone (its glyph's 14px, centred on the row) down to the first card's port. */}
            <span aria-hidden className="mob-wire absolute top-[20px] left-[11px] h-[56px] w-0.5 rounded-full bg-(--home-lilac) md:hidden" />

            <ul className="mt-6 grid gap-4 pl-6 md:grid-cols-2 md:pl-0 lg:grid-cols-3 lg:gap-6">
              {data.parts.map((part, i) => (
                <Card key={part.id} part={part} data={data} i={i} total={total} />
              ))}
            </ul>
          </div>
        </div>

        <Index data={data} />
        <p className={cn(TYPE.meta, "mt-8 max-w-[640px] text-pretty")}>{data.foot}</p>
      </Frame>
    </section>
  );
}
