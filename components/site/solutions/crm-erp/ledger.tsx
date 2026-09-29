import { cn } from "@/lib/utils";
import { TYPE, WEIGHT } from "@/components/site/home/type";
import type { LedgerCopy, RouteRow } from "@/lib/pages/crm-erp";
import { LedgerFigure } from "./ledger-figures";

/* ------------------------------------------------------------------ *
 * #ledger — "Off the shelf, or built for you?", under #shape's room: the
 * question a buyer brings to any page that sells building one, answered
 * as a comparison of kinds, never of products.
 *
 * THREE ROUTES: off the shelf; off the shelf, extended; built around
 * your process. Each is a small drawing (ledger-figures.tsx), its name,
 * and the same five rows — what it is, when it suits you, what you get,
 * what to watch for, whose it is — so the three are read row against
 * row. Each gets what it is good at, and "built" its own costs (it takes
 * longer to reach its first day, you pay for the build, and it needs
 * looking after). No product is named, priced or scored anywhere on the
 * page, and every line is the owner's (the data module marks each
 * `// OWNER`; its test holds the three to no vendor, no loaded word and
 * no figure).
 *
 * EQUAL WEIGHT. Three identical columns with a hairline between each,
 * the same 40px either side: no highlight, no "recommended", no colour
 * that sets "built" apart; the figures are drawn to one weight too.
 *
 * LAYOUT. From lg three columns, each a subgrid of the ledger's six rows
 * (the head, then the five), so a row starts level across all three
 * however its neighbours wrap. Below lg the routes stack, a hairline
 * between them; from md each row is a term column beside its text
 * (`[10rem | 1fr]`), so the five read as a small table.
 *
 * a11y: each route is a group named by its heading (an h4 under the
 * ledger's h3); its rows are a <dl>. The figures are aria-hidden. The
 * block is the page's `#ledger` anchor (the #checks row "The comparison"
 * links here), with the page's scroll margin, so a jump lands under the
 * header.
 *
 * A server component, with no client code at all. On white: ink (19.11),
 * the terms in muted (6.37), the text at 85% ink.
 * ------------------------------------------------------------------ */

/** The five rows in the order the data module words them. */
const ROWS: readonly RouteRow[] = ["what", "suits", "gives", "watch", "whose"];

export function Ledger({ copy }: { copy: LedgerCopy }) {
  return (
    <div id="ledger" className="erp-ledger mt-16 scroll-mt-8 lg:mt-24">
      <h3
        className="pp-display text-[24px] leading-[30px] tracking-[-0.015em] text-balance text-pp-ink"
        style={{ fontWeight: WEIGHT.h3 }}
      >
        {copy.title}
      </h3>
      <p className={cn(TYPE.lead, "mt-3 max-w-[720px] text-pretty")}>{copy.lead}</p>

      <div className="mt-10 grid gap-y-5 lg:grid-cols-3 lg:grid-rows-[repeat(6,auto)] lg:gap-x-20">
        {copy.routes.map((r, i) => (
          <div
            key={r.id}
            role="group"
            aria-labelledby={`ledger-${r.id}`}
            className={cn(
              "relative grid min-w-0 gap-y-5 lg:row-span-6 lg:grid-rows-subgrid",
              // Stacked, a hairline between. Side by side, one in the middle
              // of each 80px gap, so the three columns are the same width
              // and each hairline has the same 40px either side.
              i > 0 && "mt-3 border-t border-pp-rule pt-8 lg:mt-0 lg:border-t-0 lg:pt-0",
              i > 0 && "lg:before:absolute lg:before:inset-y-0 lg:before:-left-10 lg:before:w-px lg:before:bg-pp-rule",
            )}
          >
            <div className="min-w-0">
              <LedgerFigure id={r.id} />
              <h4 id={`ledger-${r.id}`} className={cn(TYPE.body, "mt-4 font-semibold text-balance text-pp-ink")}>
                {r.label}
              </h4>
            </div>
            <dl className="grid min-w-0 gap-y-5 lg:row-span-5 lg:grid-rows-subgrid">
              {ROWS.map((row) => (
                <div key={row} className="min-w-0 md:grid md:grid-cols-[10rem_minmax(0,1fr)] md:items-baseline md:gap-x-6 lg:block">
                  <dt className={cn(TYPE.label, "text-pp-muted")}>{copy.rows[row]}</dt>
                  <dd className="mt-1.5 text-[15px] leading-[22px] text-pretty text-pp-ink/85 md:mt-0 lg:mt-1.5">{r[row]}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      <p className={cn(TYPE.meta, "mt-10 max-w-[640px] text-pretty")}>{copy.foot}</p>
    </div>
  );
}
