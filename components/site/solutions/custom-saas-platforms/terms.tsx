import { cn } from "@/lib/utils";
import { IntentLink } from "@/components/site/intent-link";
import { Frame } from "@/components/site/product/primitives";
import { HomeHeading } from "@/components/site/home/heading";
import { TYPE } from "@/components/site/home/type";
import type { TermsData } from "@/lib/pages/custom-saas-platforms";

/* ------------------------------------------------------------------ *
 * #terms — what’s the catch? Before it starts.
 *
 * By here the reader has seen the platform drawn, the scope worked out,
 * a prototype clicked and the three stages laid out. What is left is the
 * practical sceptic: what sets the price and the date, since neither is
 * on the page; what you will want from me; what I end up holding; and
 * what you are not telling me. Four lists answer those four questions,
 * side by side, and nothing else happens here.
 *
 * THE ONLY STILL SECTION ON THE PAGE, on purpose, after a hairline (the
 * page's `Rule`). Every section above it moves when it arrives; after
 * six of them, stillness reads as the end of the argument and the start
 * of the terms. So it is a server component with no "use client", no
 * state and no motion beyond the heading's own line reveal (HomeHeading,
 * shared by every section): it ships no JavaScript of its own, and has
 * nothing to reserve, because nothing in it ever swaps. IntentLink is the
 * site's shared client link, a leaf, not an island this file owns.
 *
 * WHY A LEDGER AND NOT A FEATURE GRID. The four heads are four
 * directions — what moves the quote, theirs to us, ours to them, and
 * what we say before either is asked — and they read best as a ledger
 * the eye can cross in one line: a hairline between the columns
 * (`divide-x`), never cards, because a card says "product tile" and
 * these are terms. The CAA page's `Handover` ledger, in the landing's
 * tokens and with a fourth column.
 *
 * WHY FOUR ACROSS ONLY FROM xl. At 1024 the column is 944px and a
 * four-way split leaves each list 188px: "Access to the accounts it has
 * to live in: your domain, your payment provider, your email sender"
 * would set in eight ragged lines of two words. So from md to below xl
 * the four sit two by two, as the landing's TRUST does (trust.tsx: two
 * from md, four from xl), each head over its own list and a hairline
 * above, the two rules of a row on one line. A list is 336px at 768,
 * 448 at 1024 and 564 at 1279, so a line stays inside the landing's
 * 560px measure: 48 characters at 768, 65 at 1024, 82 at most. Turning
 * each list into a row of the ledger instead (its head in a 200px
 * column, its items beside it) ran the lines to 773px and 121 characters
 * by 1180 and made the section 200–270px taller. Phones stack plainly,
 * and from xl (1176px, 294 a column) the four stand side by side.
 *
 * COLOUR. The bullets are the one mark of violet (`bg-pp-accent`, the
 * body's #6d28d9), small and the same on all four lists, because none of
 * them matters more than the others. "Said up front" is deliberately not
 * set as a warning: nothing in it is bad news, only news. The items are
 * ink at 85% on white, the heads muted (6.37:1 on white).
 *
 * THE LAST PARAGRAPH points away from this page for the reader who needs
 * a phone agent rather than a platform. It sits apart, at reading width,
 * with its two links under it, so it is never mistaken for a term.
 * ------------------------------------------------------------------ */

/** controls.tsx RING_LIGHT, spelled out: controls.tsx is a client module. */
const RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink";

export function Terms({ data }: { data: TermsData }) {
  return (
    <section id="terms" aria-labelledby="terms-title" className="scroll-mt-8">
      <Frame>
        <HomeHeading id="terms-title" eyebrow={data.eyebrow} title={data.title} titleKey={data.key} sub={data.sub} />

        <div className="mt-10 grid gap-8 md:max-xl:grid-cols-2 md:max-xl:gap-x-12 xl:grid-cols-4 xl:gap-0 xl:divide-x xl:divide-pp-rule">
          {data.columns.map((col) => (
            <div
              key={col.id}
              // md–xl: two by two, a hairline above each list; xl: a
              // column with a hairline between.
              className="min-w-0 md:max-xl:border-t md:max-xl:border-pp-rule md:max-xl:pt-6 xl:px-6 xl:first:pl-0 xl:last:pr-0"
            >
              <h3 className={cn(TYPE.label, "text-pp-muted")}>{col.head}</h3>
              {/* Below md, where the four lists stack into one long
                  column, 8px between items rather than 12. */}
              <ul className="mt-3 space-y-2 md:mt-4 md:space-y-3">
                {col.items.map((item) => (
                  <li key={item} className="flex gap-3">
                    {/* 9px down centres a 4px dot on the x-height of a 21px line. */}
                    <span aria-hidden className="mt-[9px] size-1 shrink-0 rounded-full bg-pp-accent" />
                    <span className="min-w-0 text-[14px] leading-[21px] text-pretty text-pp-ink/85">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-10 max-w-[620px] text-[15px] leading-[23px] text-pretty text-pp-ink">{data.after}</p>
        {/* 21px of text in a 44px target, as the landing's standalone
            links are (trades.tsx, doubts.tsx): the row's 2px top and -10px
            bottom margins hand the targets' extra height back, so the
            words sit where a 24px target would put them. Where the two
            wrap onto two lines they stack edge to edge, 44px apart, and
            never share a pixel of target. */}
        <div className="mt-0.5 -mb-2.5 flex flex-wrap gap-x-6">
          {data.links.map((l) => (
            <IntentLink
              key={l.href}
              href={l.href}
              // The underline on the words only, so it never runs on into
              // the arrow.
              className={cn(
                "group inline-flex min-h-11 items-center gap-1.5 rounded-sm text-[14px] leading-[21px] text-pp-ink transition-colors duration-200 hover:text-(--home-plum)",
                RING,
              )}
            >
              <span className="underline decoration-pp-ink/25 decoration-1 underline-offset-[5px] transition-[text-decoration-color] duration-200 group-hover:decoration-current">
                {l.label}
              </span>
              <span aria-hidden className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">
                →
              </span>
            </IntentLink>
          ))}
        </div>
      </Frame>
    </section>
  );
}
