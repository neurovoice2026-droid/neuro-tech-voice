import { cn } from "@/lib/utils";
import { IntentLink } from "@/components/site/intent-link";
import { TYPE, WEIGHT } from "@/components/site/home/type";
import type { BlockKind, KindInfo, RunningData } from "@/lib/pages/custom-automations";
import { KindGlyph } from "./glyphs";

/* ------------------------------------------------------------------ *
 * #running — "Six more that run by themselves here": the ledger under
 * the workbench.
 *
 * The workbench takes four of the platform's automations apart; these
 * are six more it runs every day, each on a white card: the kind of
 * block that does the work (its glyph and tag, as on the workbench's
 * cards), what starts it ("A booking is cancelled or moved"), a figure
 * where there is one to count ("3 a call, at most", "80% · 100%", held
 * by the page's test), the title, and a sentence or two in plain words.
 * The self-serve workflows card links to the product page where
 * customers build their own. Each card is a link target, `#run-<id>`
 * (#work's legend sends "A person" to `#run-notify`), with the page's
 * scroll margin, so a jump lands under the header.
 *
 * NO FILE PATHS ON A CARD FACE: the files and the longer list behind the
 * workflows card are in the index below (running.tsx), under "In the
 * code, for your developers", where the workbench's blocks keep theirs.
 *
 * MOTION: each card rises as it enters (home.css `home-rise`, a view
 * timeline, transform only); side by side, from lg, a step apart by
 * column (`data-col`, auto-running.css §4), as the SaaS page's #build
 * cards do. The lite tier and reduced motion show them in place.
 *
 * A server component: no state, no script. The glyph is lucide's line
 * icon, rendered in place; the link prefetches on intent (IntentLink).
 * ------------------------------------------------------------------ */

/** The focus ring on white (controls.tsx's, written out: this is a server component). */
const RING = "rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink";

export function Ledger({
  ledger,
  kinds,
}: {
  ledger: RunningData["ledger"];
  kinds: Record<BlockKind, KindInfo>;
}) {
  return (
    <div className="mt-16">
      {/* A group label, as #breaks' "And the other ways it stays safe" is: small
          and muted over the cards' display titles. Balanced: under 360px it wraps. */}
      <h3 className={cn(TYPE.label, "text-balance text-pp-muted")}>{ledger.title}</h3>
      <ul className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {ledger.cards.map((card, i) => (
          <li
            key={card.id}
            id={`run-${card.id}`}
            data-col={i % 3}
            className="auto-ledger home-rise flex scroll-mt-8 flex-col rounded-[20px] bg-white p-6 shadow-[0_0_0_1px_rgb(20_10_36/0.08)]"
          >
            <p className="flex items-center justify-between gap-4">
              <span
                className={cn(
                  TYPE.mono,
                  "inline-flex min-w-0 items-center gap-1.5 text-[10px] leading-4 tracking-[0.06em] text-pp-muted uppercase",
                )}
              >
                <KindGlyph kind={card.kind} className="text-(--home-electric)" />
                {kinds[card.kind].tag}
              </span>
              {card.figure && <span className={cn(TYPE.mono, "shrink-0 text-(--home-violet)")}>{card.figure}</span>}
            </p>
            <p className={cn(TYPE.mono, "mt-4 text-[11px] leading-4 text-pp-muted")}>{card.when}</p>
            {/* A heading under the ledger's h3, as #breaks' guards are: the
                six are reached by heading, not read as paragraphs. */}
            <h4 className={cn(TYPE.h3, "mt-1 text-balance")} style={{ fontWeight: WEIGHT.h3 }}>
              {card.title}
            </h4>
            <p className={cn(TYPE.meta, "mt-2 text-pretty text-pp-ink/80")}>{card.body}</p>
            {card.link && (
              <p className="mt-auto pt-4">
                <IntentLink
                  href={card.link.href}
                  className={cn(
                    "home-link group relative inline-block min-h-6 py-px text-[15px] leading-[22px] whitespace-nowrap",
                    "before:absolute before:inset-x-0 before:-inset-y-2.5",
                    RING,
                  )}
                >
                  {card.link.label}
                  {/* Named for its card in a links list ("See them: Workflows
                      you set up yourself"), still starting with what it shows. */}
                  <span className="sr-only">: {card.title}</span>
                  <span
                    aria-hidden
                    className="ml-1 inline-block transition-transform duration-200 group-hover:translate-x-0.5"
                  >
                    →
                  </span>
                </IntentLink>
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
