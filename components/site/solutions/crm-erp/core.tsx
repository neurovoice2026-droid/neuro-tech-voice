import type { CSSProperties, ReactNode } from "react";
import { Check, FileSpreadsheet, PhoneCall, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { Frame } from "@/components/site/product/primitives";
import { HomeHeading } from "@/components/site/home/heading";
import { TYPE, WEIGHT } from "@/components/site/home/type";
import type { CoreData, CoreId, CorePart, UnderCell } from "@/lib/pages/crm-erp";
import { CheckLine } from "@/components/site/solutions/custom-saas-platforms/check-line";
import { CoreGlyph, ErpTag } from "./glyphs";

/* ------------------------------------------------------------------ *
 * #core — "Is any of this real?"
 *
 * Every step of #process names the part of this platform it already
 * runs in and links here; the hero's plates and its evidence strip do
 * too. This is where they land: the nine parts a CRM has to get right,
 * in the menu's stack order (Sales, Inventory, Invoicing, Reporting),
 * each with what ours does, a figure counted from its code, what yours
 * gets, and how to check it. Seven run here. One runs in part (the
 * customer's record: on this platform a customer is their phone number,
 * and its card opens "Partly on ours" rather than pretend otherwise). One
 * is not here at all, stock, orders, purchasing and roles, and its card
 * says so, once: the page's one caveat, said where it is, and built for
 * yours. The sub counts all of that from the data (`CORE_PARTS`), so
 * the words can't drift from the cards.
 *
 * THE NIGHT ROOM. White heading, then the cards on a still night — the
 * landing's ink to the deep panel's violet, top to bottom, the gradient
 * the Automations page's #breaks and the Mobile page's #server measured
 * (`.erp-night`, erp-core.css §1): no mesh and no flow, so the second
 * half of the page gets a ground no light near it shares. On it, in the
 * room's own tokens (spec §5.4): "One customer", with a person, in lilac
 * (8.37 at its worst); the tag in on-deep-dim (12.02); "Under every
 * record" in on-deep (15.62); nothing in the electric (3.17: never text
 * here). The cards and cells are white (18.04 against the room), so
 * inside them the landing's tokens hold: ink, muted (6.37), violet for
 * the datums and "Built for yours" (7.10), settled for "Runs here"
 * (5.50), the electric for marks.
 *
 * THE WIRE (aria-hidden, behind the cards): one customer, and every
 * part plugged into their record. From md a lilac bus runs along the
 * top from the person, level with its label, to the last column, with a
 * drop down the middle of each column to the last row: three from lg,
 * two at md. Below md, one wire down the left side, 12px in, the cards
 * indented 24px beside it, drawn from the person to the first card and
 * then from each card to the next. Wherever the wire meets a card — its
 * top edge from md, its left side below — a port: an 8px lilac ring.
 * The last card (exports), alone in the fifth row at md and spanning
 * both columns, takes a port from each drop there.
 *
 * THE TOKEN (aria-hidden): the customer, travelling. A 12px on-deep
 * disc ringed in the electric (a mark, 3.17: over the 3:1 a mark needs)
 * that rides the wire as it draws. From md it sits on the bus, at the
 * left end of a box exactly as wide as it, and the box slides with the
 * line, so the token is always at the line's drawing end, and rests at
 * the last column's drop. Below md it rides down the left wire from the
 * first card's port to the last card's, on a track as tall as that
 * (placed on the list's own grid lines, so it spans exactly the ports
 * whatever the cards' heights), keeping pace with the wire's foot.
 *
 * THE CARDS, one per part, an <article id="core-<id>"> each — #process's
 * captions, the hero and the FAQ's "users" row link to them — with the
 * layer it belongs to, its kind in words and the glyph for it (glyphs.tsx
 * `ErpTag`: filled, hollow, dotted, so the answer never rests on
 * colour), its datum, its glyph and title, what ours does (under "On
 * ours" for a part that runs here; the other two open with what they
 * are, "Partly on ours" and "Not on ours", so no label says the opposite
 * over them), what yours gets (under "In yours"), and how to check it
 * (`CheckLine`). The part built for yours is edged in dashed violet,
 * with no shadow. From md, where cards share a row, three whose words
 * are short beside the longest in theirs draw what they say under them
 * (aria-hidden: the words say it), so none stands hollow between its
 * words and its check, a tile taking whatever its row leaves: the
 * part built for yours, its parts to come on #shape's dotted "Later"
 * nodes; the usage card, a ledger of calls, each billed once; and the
 * exports card, the sheet a file opens as.
 *
 * UNDER EVERY RECORD: four compact white cells for what runs beneath
 * every part at once — every table walled off, the plan and billing
 * kept from the browser, the database changed only by migration, the
 * jobs that run themselves — each with its figure.
 *
 * THE INDEX, under the room: where each part lives in the code, for the
 * reader's developers, in a closed <details> in the landing's FAQ style
 * (native, so find-in-page opens it). The paths are the code's words,
 * never translated. Then the foot: it's a drawing, not a live feed.
 *
 * MOTION is CSS alone, on the room's passage up the screen (erp-core.css
 * §2): the bus draws from the person with the token riding its end, the
 * drops fall, and each port pops as its drop reaches it; below md each
 * stretch of the wire draws on its card's own pass, and the token rides
 * down with the wire's foot. The room and its cards rise (home.css
 * `home-rise`), a step apart across a row from lg (§3). Reduced motion,
 * the lite, still and weak tiers and any browser without view timelines
 * get the finished frame (§4): the wire whole, every port shown, the
 * token at the end, the cards in place.
 *
 * A server component, with no island of its own: the client code is
 * the heading's reveal and `CheckLine`'s route links (IntentLink). The
 * data module is imported for its types only. The focus ring is written
 * out here because controls.tsx is a client module.
 * ------------------------------------------------------------------ */

/** controls.tsx RING_LIGHT, spelled out: a ring in the ground's ink. */
const RING = "rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink";

/**
 * Each card's row, as a share of the rows, at md (two across, the last
 * alone in the fifth) and from lg (three across): when its drop reaches
 * it, so its port pops then (erp-core.css §2). Below md each card's
 * port keeps time with its own card instead.
 */
function rows(i: number, total: number) {
  const md = Math.ceil(total / 2);
  const lg = Math.ceil(total / 3);
  return {
    "--r-md": Math.floor(i / 2) / md,
    "--r-lg": Math.floor(i / 3) / lg,
  } as CSSProperties;
}

/** A port: an 8px lilac ring where the wire meets a card. Below md on its left side, from md on its top edge. */
const PORT = "erp-core-port absolute size-2 rounded-full border-2 border-(--home-lilac) bg-(--home-ink)";

/** The token: the customer, a 12px on-deep disc in an electric ring, centred on the point its box carries. */
const TOKEN = "erp-token absolute size-3 -translate-1/2 rounded-full bg-(--home-on-deep) ring-2 ring-(--home-electric)";

/** Eight round dots on a 3.75-radius ring (CheckGlyph's dotted ring, #shape's "Later"): a part still to come. */
const DOTS = "0 2.9452";

/**
 * The card built for yours, drawn as what it says: each part its title
 * names ("Quotes, orders, stock and roles"), on a line of its own with
 * #shape's "Later" node, a dotted violet ring, as a part still to be
 * built. Read from the title, never typed, and aria-hidden: the title
 * says the same in words.
 */
function ToBuild({ title }: { title: string }) {
  const names = title.split(/, | and /).map((n) => n.charAt(0).toUpperCase() + n.slice(1));
  return (
    <ul aria-hidden className="mt-4 hidden flex-col gap-2 border-t border-pp-rule pt-4 md:flex">
      {names.map((n) => (
        <li key={n} className="flex items-center gap-2.5 text-[14px] leading-5 text-pp-ink">
          <svg viewBox="0 0 10 10" className="erp-glyph size-2.5 overflow-visible text-(--home-violet)">
            <circle cx={5} cy={5} r={3.75} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeDasharray={DOTS} />
          </svg>
          {n}
        </li>
      ))}
    </ul>
  );
}

/**
 * A figure's tile that takes what its card has spare: its minimum height
 * (enough for its first lines), and as tall as the tallest card in its
 * row leaves it, its lines going on down it and fading out at its foot.
 * The lines stand out of the flow (`LINES`, in the clipped `FADE`), so
 * they never make the card taller than the tile's minimum does.
 */
const TILE = "mt-4 hidden flex-1 rounded-xl p-3 shadow-[inset_0_0_0_1px_rgb(20_10_36/0.08)]";
const FADE = "relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_bottom,#000_calc(100%-16px),transparent)]";
const LINES = "absolute inset-x-0 top-0";

/** A grey value's bar (the record window's): the ledger's and the sheet's. GrayText under forced colours (erp-core.css §5). */
const BAR = "erp-core-bar block h-2 rounded-full";

/** The usage ledger's lines: each call's bar and its minutes' bar, by the line's place (fixed, so it never jitters). */
const LEDGER_W = [
  ["w-[74%]", "w-[42%]"],
  ["w-[58%]", "w-[60%]"],
  ["w-[82%]", "w-[34%]"],
  ["w-[66%]", "w-[50%]"],
  ["w-[70%]", "w-[38%]"],
  ["w-[54%]", "w-[56%]"],
  ["w-[78%]", "w-[46%]"],
  ["w-[62%]", "w-[40%]"],
] as const;

/**
 * The usage card's ledger (aria-hidden): calls, each a line with the
 * call and its minutes as grey bars (no figure, no name) and one tick,
 * billed once; three lines at least, more where the card has room. The
 * card says it in words.
 */
function UsageLedger() {
  return (
    <div aria-hidden className={cn(TILE, "min-h-[100px] md:flex")}>
      <div className={FADE}>
        <ul className={cn(LINES, "flex flex-col gap-2")}>
          {LEDGER_W.map(([call, minutes], i) => (
            <li key={i} className="grid h-5 shrink-0 grid-cols-[14px_minmax(0,1.6fr)_minmax(0,1fr)_14px] items-center gap-x-3">
              <PhoneCall size={14} strokeWidth={1.75} className="erp-glyph text-(--home-electric)" />
              <span className={cn(BAR, "bg-pp-ink/8", call)} />
              <span className={cn(BAR, "bg-pp-ink/8", minutes)} />
              <Check size={14} strokeWidth={2.25} className="erp-glyph text-(--home-settled)" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** The export's sheet: each row's three cells, by the row's place (fixed); the first row is the heads. */
const SHEET_W = [
  ["w-[70%]", "w-[56%]", "w-[64%]"],
  ["w-[84%]", "w-[40%]", "w-[72%]"],
  ["w-[62%]", "w-[52%]", "w-[46%]"],
  ["w-[76%]", "w-[44%]", "w-[58%]"],
  ["w-[58%]", "w-[60%]", "w-[68%]"],
  ["w-[80%]", "w-[36%]", "w-[50%]"],
  ["w-[66%]", "w-[48%]", "w-[62%]"],
  ["w-[72%]", "w-[42%]", "w-[54%]"],
] as const;

/**
 * The exports card's file (aria-hidden): a spreadsheet's glyph beside
 * its sheet, the heads darker than the rows, in grey bars (no figure);
 * two rows at least, more where the card has room.
 */
function ExportSheet() {
  return (
    <div aria-hidden className={cn(TILE, "mt-3 min-h-[50px] gap-3 lg:flex")}>
      <FileSpreadsheet size={16} strokeWidth={1.75} className="erp-glyph shrink-0 text-(--home-electric)" />
      <div className={FADE}>
        <div className={cn(LINES, "grid auto-rows-[8px] grid-cols-3 gap-x-3 gap-y-1.5 pt-1")}>
          {SHEET_W.map((row, r) => row.map((w, c) => <span key={`${r}-${c}`} className={cn(BAR, r === 0 ? "bg-pp-ink/14" : "bg-pp-ink/8", w)} />))}
        </div>
      </div>
    </div>
  );
}

/**
 * A card's figure, under what yours gets, where its words alone would
 * leave it hollow beside a longer card in its row: the part built for
 * yours drawn as its parts to come, the usage card's ledger (both from
 * md, where the cards share rows), and the exports card's sheet (from
 * lg, where it shares one; at md it stands alone). On a phone each card
 * is its own row, and none is drawn.
 */
const FIGURE: Partial<Record<CoreId, (part: CorePart) => ReactNode>> = {
  yours: (part) => <ToBuild title={part.title} />,
  usage: () => <UsageLedger />,
  exports: () => <ExportSheet />,
};

function Card({ part, data, i, total }: { part: CorePart; data: CoreData; i: number; total: number }) {
  const last = i === total - 1;
  // Alone in the last row at md, spanning both columns: its port sits under each drop.
  const wide = last && total % 2 === 1;
  // The datum, unless it only says the kind again ("built for yours").
  const datum = part.datum.toLowerCase() !== data.kinds[part.kind].toLowerCase();
  return (
    <li className={cn("erp-core-item relative min-w-0 md:row-span-3 md:grid md:grid-rows-subgrid md:gap-y-0", wide && "md:col-span-2 lg:col-span-1")}>
      <article
        id={`core-${part.id}`}
        aria-labelledby={`core-${part.id}-title`}
        data-col={i % 3}
        data-kind={part.kind}
        className="erp-core-card home-rise relative flex h-full scroll-mt-8 flex-col rounded-[20px] bg-white p-4 text-pp-ink min-[360px]:p-5 md:row-span-3 md:grid md:grid-rows-subgrid md:gap-y-0"
      >
        {/* The layer and the kind, then the datum: at the right while it fits beside them, under them once it doesn't
            (from md the row's track is the tallest in its row of cards, so a row that fits keeps to the top of it). */}
        <div className="flex flex-wrap content-start items-center justify-between gap-x-3 gap-y-1">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className={cn(TYPE.mono, "text-pp-muted uppercase")}>
              {data.layers[part.layer]}
              <span className="sr-only">, </span>
            </span>
            <ErpTag kind={part.kind} copy={data.kinds} tone="white" />
          </p>
          {datum && (
            <p className={cn(TYPE.mono, "text-right whitespace-nowrap text-(--home-violet)")}>
              <span className="sr-only">: </span>
              {part.datum}
            </p>
          )}
        </div>
        <h3 id={`core-${part.id}-title`} className={cn(TYPE.h3, "mt-4 flex items-start gap-2 text-balance")} style={{ fontWeight: WEIGHT.h3 }}>
          {/* On the first line's middle (its 28px line, the glyph's 14px), where a title runs to two. */}
          <CoreGlyph id={part.id} className="mt-[7px] text-(--home-electric)" />
          {part.title}
        </h3>
        <div className="flex flex-1 flex-col">
          {/* "On ours" over what ours does; the other two open with what they are, so no label says the opposite over them. */}
          {part.kind === "does" && <p className={cn(TYPE.label, "mt-4 text-pp-muted")}>{data.labels.ours}</p>}
          <p className={cn(TYPE.body, "text-pretty text-pp-ink", part.kind === "does" ? "mt-1" : "mt-4")}>{part.ours}</p>
          <p className={cn(TYPE.label, "mt-4 text-pp-muted")}>{data.labels.yours}</p>
          <p className="mt-1 text-[13px] leading-[18px] text-pretty text-pp-ink/80">{part.yours}</p>
          {FIGURE[part.id]?.(part)}
          <div className="mt-auto pt-5">
            <CheckLine check={part.check} kinds={data.checkKinds} tone="white" />
          </div>
        </div>
      </article>

      {/* Where the wire meets the card, and below md the wire on to the next one. */}
      <span
        aria-hidden
        className={cn(PORT, "top-6 -left-4 md:-top-1 md:left-1/2 md:-translate-x-1/2", wide && "md:left-[calc((100%-16px)/4)] lg:left-1/2")}
        style={rows(i, total)}
      />
      {wide && (
        <span
          aria-hidden
          className={cn(PORT, "-top-1 left-[calc(100%-(100%-16px)/4)] hidden -translate-x-1/2 md:block lg:hidden")}
          style={rows(i, total)}
        />
      )}
      {!last && <span aria-hidden className="erp-core-seg absolute top-7 -bottom-11 -left-[13px] w-0.5 rounded-full bg-(--home-lilac) md:hidden" />}
    </li>
  );
}

function Cell({ cell }: { cell: UnderCell }) {
  return (
    <li className="erp-core-cell min-w-0 rounded-2xl bg-white p-4 text-pp-ink">
      <h4 className={cn(TYPE.body, "font-medium text-balance")}>{cell.title}</h4>
      <p className={cn(TYPE.mono, "mt-1 text-(--home-violet)")}>{cell.datum}</p>
      <p className="mt-2 text-[13px] leading-[18px] text-pretty text-pp-ink/80">{cell.text}</p>
    </li>
  );
}

function Index({ data }: { data: CoreData }) {
  return (
    <div className="home-faq mt-10">
      <details className="group border-y border-pp-rule">
        <summary
          className={cn("flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 [&::-webkit-details-marker]:hidden", RING)}
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
                  <CoreGlyph id={p.id} className="text-(--home-electric)" />
                  {p.title}
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

export function Core({ data }: { data: CoreData }) {
  const total = data.parts.length;
  return (
    <section id="core" aria-labelledby="core-title" className="scroll-mt-8">
      <Frame>
        <HomeHeading id="core-title" eyebrow={data.eyebrow} title={data.title} titleKey={data.key} sub={data.sub} />

        <div className="erp-night home-rise relative mt-10 p-5 md:p-8 lg:mt-12 lg:p-10">
          <span aria-hidden className="home-grain" />
          <p className={cn(TYPE.mono, "text-pretty text-(--home-on-deep-dim) md:text-right")}>{data.tag}</p>

          {/* The wire's box: its view timeline (erp-core.css §2) runs from the person to the last row. */}
          <div className="erp-core-wires relative mt-4 md:mt-5">
            {/* The customer, and the bus from them along the top (md and up) to the last column's drop, the token riding its end. */}
            <div className="flex h-6 items-center">
              <p className={cn(TYPE.mono, "flex shrink-0 items-center tracking-[0.08em] text-(--home-lilac) uppercase")}>
                <span className="grid w-6 place-items-center">
                  <UserRound aria-hidden size={14} strokeWidth={1.75} className="erp-glyph" />
                </span>
                <span className="ml-1.5">{data.bus}</span>
              </p>
              <span aria-hidden className="relative z-[1] ml-3 hidden h-0.5 flex-1 md:mr-[calc((100%-16px)/4)] md:block lg:mr-[calc((100%-48px)/6)]">
                <span className="erp-core-bus absolute inset-0 rounded-full bg-(--home-lilac)" />
                <span className="erp-token-x absolute inset-0">
                  <span className={cn(TOKEN, "top-1/2 left-0")} />
                </span>
              </span>
            </div>
            {/* The drops, one down the middle of each column, behind the cards: two at md, three from lg. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-3 bottom-0 hidden md:grid md:grid-cols-2 md:gap-x-4 lg:grid-cols-3 lg:gap-x-6"
            >
              {[0, 1, 2].map((c) => (
                <span
                  key={c}
                  className={cn("erp-core-drop h-full w-0.5 justify-self-center rounded-full bg-(--home-lilac)", c === 2 && "md:hidden lg:block")}
                />
              ))}
            </div>
            {/* Below md: the wire from the foot of the person (its glyph's 14px, centred on the row) down to the first card's port. */}
            <span aria-hidden className="erp-core-wire absolute top-[20px] left-[11px] h-[56px] w-0.5 rounded-full bg-(--home-lilac) md:hidden" />

            <ul className="relative mt-6 grid gap-4 pl-6 md:grid-cols-2 md:pl-0 lg:grid-cols-3 lg:gap-6">
              {/* Below md, the token's track: from the first card's port (28px into its row) to the last one's (28px into
                  the last row: the row lines end before the 16px gap), so the token rests on the last port. */}
              <li
                aria-hidden
                className="erp-token-track pointer-events-none absolute top-7 -bottom-11 left-3 z-[1] w-0 md:hidden"
                style={{ gridRow: `1 / ${total}` }}
              >
                <span className="erp-token-y absolute inset-0">
                  <span className={cn(TOKEN, "top-0 left-0")} />
                </span>
              </li>
              {data.parts.map((part, i) => (
                <Card key={part.id} part={part} data={data} i={i} total={total} />
              ))}
            </ul>
          </div>

          <h3 className={cn(TYPE.label, "mt-10 text-(--home-on-deep) md:mt-12")}>{data.underTitle}</h3>
          <ul className="mt-4 grid gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-4">
            {data.under.map((cell) => (
              <Cell key={cell.id} cell={cell} />
            ))}
          </ul>
        </div>

        <Index data={data} />
        <p className={cn(TYPE.meta, "mt-8 max-w-[640px] text-pretty")}>{data.foot}</p>
      </Frame>
    </section>
  );
}
