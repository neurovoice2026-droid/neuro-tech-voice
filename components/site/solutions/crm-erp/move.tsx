import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { Frame } from "@/components/site/product/primitives";
import { HomeHeading } from "@/components/site/home/heading";
import { TYPE, WEIGHT } from "@/components/site/home/type";
import type { MoveData, Whose } from "@/lib/pages/crm-erp";
import { CheckLine } from "@/components/site/solutions/custom-saas-platforms/check-line";
import { LedgerList } from "@/components/site/solutions/custom-saas-platforms/ledger-list";
import { LiveMesh } from "@/components/site/solutions/custom-saas-platforms/live-mesh";
import { MiniLanes } from "./mini-lanes";
import { OutcomeTag, RehearsalFigure } from "./rehearsal-figure";

/* ------------------------------------------------------------------ *
 * #move — "How do we get off our spreadsheets without losing anything?
 * Will it connect to what we keep? Whose is it?"
 *
 * "Without losing a thing" is the owner's word, and the section is its
 * mechanism: every source listed before anything moves, the move
 * rehearsed on a copy as many times as it takes and signed off by the
 * reader, the switch-over once, on a day they choose, and the old files
 * kept readable. The menu's first two deliverables ("Pipeline, stock and
 * invoicing in one place", "Migrated off spreadsheets and legacy
 * tools") are stages 02 and 03, read from the data module rather than
 * retyped, so the menu and the page can't disagree.
 *
 * IN ORDER, ON THE WASH BAND (home.css `.home-wash-band`, full bleed,
 * its padding the section's own and inside the reserve):
 *
 *   1. The heading. Its key phrase sits on the wash (violet, 6.49),
 *      never on a card.
 *   2. THE REHEARSAL (`#rehearsal`): a white card that rises as it comes
 *      (`home-rise`). Its title and, at the right, its tag ("Sample rows
 *      · no one's real data"); the figure (rehearsal-figure.tsx,
 *      aria-hidden): six rows of a spreadsheet moved into five records,
 *      three as they are, one pair merged, one asked about; under it,
 *      the key (each outcome's tag, with its reason), the loop the
 *      rehearsal runs until it's right (Copy · Import · Check · Fix,
 *      round a dotted ring), the tally counted from the rows, the
 *      sign-off; then the index, "The rehearsal, in words", row by row.
 *   3. THE STAGE CARDS, in the SaaS `Build` grammar the Automations page
 *      rebuilt (custom-automations/build.tsx) and the Mobile page reused
 *      (custom-mobile-applications/path.tsx): three pearl cards, each a
 *      lit surface whose light flows while it is on screen (`LiveMesh`,
 *      at 1, 1.12 and 0.92), the middle one in the mirror of its
 *      neighbours' light with its pools' headings swapped (`data-swap`),
 *      radius 26px. From lg a rail runs over them (saas-build.css §9: a
 *      hairline, an electric line drawn left to right as it comes up
 *      the screen, a station over each card at STATIONS), and each card
 *      is a subgrid of the list's six rows — the stage, the title, the
 *      body, what you hold (a hairline block in the light's accent),
 *      what ours shows, the check — so the parts run level across the
 *      three. Stage 01 has no "On ours" (the drawing a section up is its
 *      proof), so its fifth row holds a process mapped in miniature
 *      (mini-lanes.tsx). Stacked, a dotted connector runs down the
 *      gutter from each card to the next (`.saas-link`) and there is no
 *      drawing.
 *
 * THEN, ON WHITE:
 *
 *   4. WHAT YOU KEEP STAYS CONNECTED (`#connect`): what this platform
 *      is connected to today, with the Google connections' beta said
 *      under that list (they are badged Beta in the dashboard; the data
 *      module fails the build when that changes), beside what yours
 *      connects to, each list a `LedgerList`. Two columns from md with a
 *      hairline between them; stacked below.
 *   5. WHOSE IT IS (`#whose`): a real table (a caption, column and row
 *      headers) of the data, the code, the accounts and the old files,
 *      each state with a glyph and in words. Below md each row stacks
 *      into a block (erp-move.css §3), the cells' display, not the
 *      table's, so it stays a table to a screen reader (the Mobile
 *      page's rule).
 *
 * The FAQ's "move", "connect" and "own" rows land on `#rehearsal`,
 * `#connect` and `#whose`, each `scroll-mt-8` under the fixed header.
 *
 * TEXT ON THE LIGHT uses only its measured tokens (--saas-text,
 * --saas-dim, --saas-accent; on `stage` at its worst, flowing, 12.06,
 * 7.34 and 5.67); on the wash, ink, muted (5.82) and violet (6.49); in
 * the white card and the table, the landing's own: the outcomes in the
 * settled green (5.50), violet (7.10) and ember ink (5.92), each in
 * words.
 *
 * MOTION is CSS alone, on each piece's own passage up the screen
 * (erp-move.css): the rehearsal (§1: the leaders draw, each copy slides
 * into its record, the twin merges, each tag pops as its copy lands),
 * stage 01's lanes (§2), the rail and its stations, the cards' rise a
 * step apart and the connectors (saas-build.css §9, as it is). The
 * connect lists and the table are still. Reduced motion, the lite,
 * still and weak tiers and any browser without view timelines get the
 * finished frame (§4): every copy in its record, the rail full, the
 * lanes drawn, the cards in place.
 *
 * A server component. The client code is `LiveMesh`'s observer, the
 * heading's reveal and the checks' route links (IntentLink, which
 * prefetches on intent). The data module is imported for its types
 * only. The focus ring is written out here because controls.tsx is a
 * client module.
 * ------------------------------------------------------------------ */

/** controls.tsx RING_LIGHT, spelled out: controls.tsx is a client module, and this is a server component. */
const RING = "rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink";

/**
 * Each station's place on the rail, as a share of its width: about the
 * left edge of each card's copy when the three stand side by side. The
 * SaaS page's values, because saas-build.css's `saas-station-0` to `-2`
 * keyframes stop there and a keyframe's offset can't read a custom
 * property: the data module's test holds these equal to the Automations
 * build.tsx's, and those to the keyframes.
 */
const STATIONS = [0.02, 0.36, 0.7] as const;

/** Each card's flow tempo: a higher number is slower (#pricing's first card is 1). */
const DRIFT = [1, 1.12, 0.92] as const;

/* ─── The rehearsal ──────────────────────────────────────────────── */

/**
 * The loop the rehearsal runs until it's right: a dotted ring with a
 * node at each quarter, where its four words stand beside it. The
 * electric, a mark on white (5.70).
 */
function LoopGlyph() {
  return (
    <svg aria-hidden viewBox="0 0 28 28" className="erp-glyph size-7 overflow-visible text-(--home-electric)" fill="none">
      <circle cx="14" cy="14" r="10" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeDasharray="0.01 3.93" />
      {[
        [14, 4],
        [24, 14],
        [14, 24],
        [4, 14],
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={2.6} fill="currentColor" />
      ))}
      {/* The way round, clockwise: a small head on the ring, between the first node and the second. */}
      <path d="M21.9 4.6 L21.7 7.6 L18.7 7.3" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** An index's summary: the landing's FAQ row, with its heading and the plus that turns. */
function Summary({ children }: { children: string }) {
  return (
    <summary
      className={cn("flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 [&::-webkit-details-marker]:hidden", RING)}
    >
      <h4 className={cn(TYPE.body, "font-medium text-balance text-pp-ink")}>{children}</h4>
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-full bg-(--home-chip) text-pp-ink transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-open:rotate-45"
      >
        <svg viewBox="0 0 12 12" fill="none" className="size-3">
          <path d="M6 1.25v9.5M1.25 6h9.5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
        </svg>
      </span>
    </summary>
  );
}

function Rehearsal({ data }: { data: MoveData["rehearsal"] }) {
  const outcomes = Object.keys(data.outcomes) as (keyof typeof data.outcomes)[];
  const [first, ...rest] = data.loop.nodes;
  return (
    <div
      id="rehearsal"
      className={cn(
        "erp-rehearsal home-rise mt-10 scroll-mt-8 rounded-[24px] bg-white p-5 md:p-8 lg:mt-12",
        "shadow-[0_1px_2px_rgb(20_10_36/0.06),0_24px_48px_-32px_rgb(20_10_36/0.25)]",
      )}
    >
      <div className="flex flex-col gap-1 md:flex-row md:items-baseline md:justify-between md:gap-6">
        <h3 className={cn(TYPE.h3, "text-balance text-pp-ink")} style={{ fontWeight: WEIGHT.h3 }}>
          {data.title}
        </h3>
        <p className={cn(TYPE.mono, "text-pp-muted")}>{data.tag}</p>
      </div>

      <RehearsalFigure data={data} className="mt-6 md:mt-8" />

      {/* The key and the loop: what each tag means, and how the rehearsal runs until it's right. */}
      <div className="mt-6 grid gap-5 border-t border-pp-rule pt-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-10">
        <ul className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
          {outcomes.map((o) => (
            <li key={o} className="flex items-center gap-2">
              <OutcomeTag outcome={o}>{data.outcomes[o].tag}</OutcomeTag>
              {data.outcomes[o].why && (
                <span className={cn(TYPE.meta, "text-pretty")}>
                  <span className="sr-only">: </span>
                  {data.outcomes[o].why}
                </span>
              )}
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3">
          <LoopGlyph />
          <div className="min-w-0">
            <p className={cn(TYPE.label, "text-pp-muted")}>{data.loop.label}</p>
            <p className={cn(TYPE.mono, "mt-0.5 text-pp-ink")}>
              {first}
              {rest.map((n) => (
                <span key={n}>
                  <span aria-hidden> · </span>
                  <span className="sr-only">, then </span>
                  {n}
                </span>
              ))}
            </p>
          </div>
        </div>
      </div>

      <p className={cn(TYPE.body, "mt-6 text-pretty text-pp-ink")}>{data.tally}</p>
      <p className={cn(TYPE.meta, "mt-1 text-pretty")}>{data.foot}</p>

      {/* The figure in words, row by row: closed on first paint, native <details> so find-in-page opens it. */}
      <div className="home-faq mt-6">
        <details className="group border-y border-pp-rule">
          <Summary>{data.indexSummary}</Summary>
          <div className="pt-3 pb-6">
            <ol className="flex flex-col gap-2">
              {data.rows.map((r) => (
                <li key={r.id} className={cn(TYPE.meta, "text-pretty text-pp-ink/80")}>
                  {data.index[r.id]}
                </li>
              ))}
            </ol>
            <p className={cn(TYPE.meta, "mt-4 text-pretty text-pp-ink")}>{data.tally}</p>
          </div>
        </details>
      </div>
    </div>
  );
}

/* ─── Whose it is ────────────────────────────────────────────────── */

/**
 * A state's glyph: a filled node in the settled green for yours, an
 * arrow in violet for handed to you, a hollow violet ring for agreed
 * first. Always beside the state in words.
 */
function WhoseGlyph({ whose }: { whose: Whose }) {
  const line = { stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" } as const;
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className={cn("erp-glyph size-4 overflow-visible", whose === "yours" ? "text-(--home-settled)" : "text-(--home-violet)")}
    >
      {whose === "yours" ? (
        <circle cx="8" cy="8" r="4.5" fill="currentColor" />
      ) : whose === "handed" ? (
        <path d="M2 8 H13.5 M9.5 4 L13.5 8 L9.5 12" {...line} />
      ) : (
        <circle cx="8" cy="8" r="4.5" {...line} />
      )}
    </svg>
  );
}

function Whose({ own }: { own: MoveData["own"] }) {
  const head = cn(TYPE.label, "py-3 pr-6 text-left align-bottom text-pp-muted");
  return (
    <div id="whose" className="mt-16 scroll-mt-8 lg:mt-24">
      <h3 className={cn(TYPE.h3, "text-balance text-pp-ink")} style={{ fontWeight: WEIGHT.h3 }}>
        {own.title}
      </h3>
      <p className={cn(TYPE.lead, "mt-2 max-w-[640px] text-pretty")}>{own.sub}</p>
      <table className="erp-whose mt-6 w-full border-collapse">
        {/* The h3 above names it to the eye; the caption, to a screen reader. */}
        <caption className="sr-only">{own.title}</caption>
        <thead>
          <tr className="border-b border-pp-rule max-md:sr-only">
            <th scope="col" className={cn(head, "md:w-64")}>
              {own.head.what}
            </th>
            <th scope="col" className={cn(head, "md:w-44")}>
              {own.head.whose}
            </th>
            <th scope="col" className={cn(head, "pr-0")}>
              {own.head.how}
            </th>
          </tr>
        </thead>
        <tbody>
          {own.rows.map((r) => (
            <tr key={r.id} className="border-b border-pp-rule">
              <th scope="row" className={cn(TYPE.body, "py-4 pr-6 text-left align-top font-medium text-pretty text-pp-ink")}>
                {r.what}
              </th>
              <td className="py-4 pr-6 align-top">
                <span className={cn(TYPE.body, "inline-flex items-center gap-2 whitespace-nowrap text-pp-ink")}>
                  <WhoseGlyph whose={r.whose} />
                  {own.states[r.whose]}
                </span>
              </td>
              <td className={cn(TYPE.body, "py-4 align-top text-pretty text-pp-ink/80")}>{r.how}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── The section ────────────────────────────────────────────────── */

export function Move({
  data,
  blobs,
}: {
  data: MoveData;
  blobs: { stage: readonly CSSProperties[]; mirror: readonly CSSProperties[] };
}) {
  const last = data.stages.length - 1;
  const { stays } = data;

  return (
    <section id="move" aria-labelledby="move-title" className="scroll-mt-8">
      <div className="home-wash-band">
        <Frame>
          <HomeHeading
            id="move-title"
            eyebrow={data.eyebrow}
            title={data.title}
            titleKey={data.key}
            sub={data.sub}
            className="max-sm:[&_.home-key]:[overflow-wrap:anywhere]"
          />

          <Rehearsal data={data.rehearsal} />

          <div className="relative mt-10 lg:mt-12">
            {/* The rail: a hairline, the line that draws over it, and a station per card (saas-build.css §9). */}
            <div aria-hidden className="saas-track relative mb-4 hidden h-6 lg:block">
              <span className="saas-rail-base absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-pp-ink/12" />
              <span className="saas-rail-line absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-(--home-electric)" />
              {data.stages.map((s, i) => (
                <span
                  key={s.id}
                  data-i={i}
                  className="saas-station absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-(--home-electric) shadow-[0_0_0_3px_var(--home-wash)]"
                  style={{ "--at": STATIONS[i] } as CSSProperties}
                />
              ))}
            </div>

            <ol className="grid gap-4 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-0">
              {data.stages.map((s, i) => {
                // The middle card: the mirrored light, its pools' headings swapped.
                const mirror = i === 1;
                return (
                  <li
                    key={s.id}
                    data-col={i}
                    data-swap={mirror ? "" : undefined}
                    className={cn(
                      "erp-move-card saas-lit home-rise p-6 md:p-8",
                      mirror ? "saas-light-stage-m" : "saas-light-stage",
                      "lg:row-span-6 lg:grid lg:grid-rows-subgrid lg:p-6",
                    )}
                    style={{ "--saas-radius": "26px" } as CSSProperties}
                  >
                    <LiveMesh blobs={mirror ? blobs.mirror : blobs.stage} drift={DRIFT[i]} />
                    <span aria-hidden className="home-grain" />
                    {/* Stacked, a dotted connector down the gutter to the next card. */}
                    {i < last && (
                      <span
                        aria-hidden
                        className="saas-link absolute top-full left-6 -ml-px h-4 border-l-2 border-dotted border-(--home-electric) md:left-8 lg:hidden"
                      />
                    )}

                    <p className="flex items-baseline gap-2">
                      <span className={cn(TYPE.mono, "text-(--saas-accent)")}>{s.n}</span>
                      <span className={cn(TYPE.label, "text-(--saas-dim)")}>{data.labels.stage}</span>
                    </p>
                    <h3 className={cn(TYPE.h3, "mt-3 text-balance text-(--saas-text)")} style={{ fontWeight: WEIGHT.h3 }}>
                      {s.title}
                    </h3>
                    <p className={cn(TYPE.body, "mt-2 max-w-[38em] text-pretty text-(--saas-text)")}>{s.body}</p>

                    <div className="mt-5 border-t border-(--saas-rule) pt-4">
                      <p className={cn(TYPE.label, "text-(--saas-accent)")}>{data.labels.hold}</p>
                      <p className={cn(TYPE.body, "mt-1 max-w-[38em] text-pretty text-(--saas-text)")}>{s.hold}</p>
                    </div>

                    {s.ours ? (
                      <div className="mt-4">
                        <p className={cn(TYPE.label, "text-(--saas-dim)")}>{data.labels.ours}</p>
                        <p className={cn(TYPE.meta, "mt-1 max-w-[42em] text-pretty text-(--saas-dim)")}>{s.ours}</p>
                      </div>
                    ) : (
                      // In the row where the others say what ours shows, a process mapped (from lg only).
                      <MiniLanes className="mt-5" />
                    )}

                    <CheckLine check={s.check} kinds={data.checkKinds} tone="lit" className="mt-5 lg:row-start-6" />
                  </li>
                );
              })}
            </ol>
          </div>
        </Frame>
      </div>

      <Frame>
        {/* What you keep stays connected: this platform's connections today, beside what yours connects to. */}
        <div id="connect" className="mt-16 scroll-mt-8 lg:mt-24">
          <h3 className={cn(TYPE.h3, "text-balance text-pp-ink")} style={{ fontWeight: WEIGHT.h3 }}>
            {stays.title}
          </h3>
          <p className={cn(TYPE.lead, "mt-2 max-w-[640px] text-pretty")}>{stays.sub}</p>
          <div className="mt-8 grid gap-10 md:grid-cols-2 md:gap-0">
            <div className="min-w-0 md:pr-10">
              <h4 className={cn(TYPE.label, "text-pp-muted")}>{stays.here.head}</h4>
              <LedgerList items={stays.here.items} />
              <p className={cn(TYPE.meta, "mt-4 max-w-[480px] text-pretty")}>{stays.beta}</p>
            </div>
            <div className="min-w-0 md:border-l md:border-pp-rule md:pl-10">
              <h4 className={cn(TYPE.label, "text-pp-muted")}>{stays.yours.head}</h4>
              <LedgerList items={stays.yours.items} />
            </div>
          </div>
        </div>

        <Whose own={data.own} />
      </Frame>
    </section>
  );
}
