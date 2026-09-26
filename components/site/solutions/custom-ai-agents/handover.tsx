import type { CAA_HANDOVER } from "@/lib/pages/custom-ai-agents";
import { IntentLink } from "@/components/site/intent-link";
import { Eyebrow, Frame, SectionTitle } from "@/components/site/product/primitives";

/* ------------------------------------------------------------------ *
 * §5 — Before it starts.
 *
 * The objection is no longer "will it work". Five instruments have
 * answered that one way or another. What is left is the practical
 * sceptic: what will you want from me, what do I end up holding, and
 * what are you not telling me. Three lists answer those three questions,
 * side by side, and nothing else happens here.
 *
 * THE ONLY STILL SECTION ON THE PAGE, on purpose. Every section above is
 * an instrument that moves when it arrives; after five of them,
 * stillness reads as the end of the argument. The reader has watched the
 * build — this is the page putting its pen down and handing over the
 * terms. So it is a server component with no "use client", no state and
 * no motion: it ships no JavaScript of its own, and there is nothing to
 * reserve because nothing ever swaps. (IntentLink is the site's shared
 * client link; it is a leaf, not an island this file owns.)
 *
 * WHY THREE COLUMNS AND NOT A FEATURE GRID. The three heads are three
 * directions of obligation — theirs to us, ours to them, and what we say
 * before either is asked — and they read best as a ledger the eye can
 * cross in one line. A hairline between them (`divide-x`) rather than
 * cards, because a card says "product tile" and these are terms.
 *
 * WHY THE BREAKPOINT IS lg, NOT md. At 768px the column is 624px and a
 * three-way split leaves the middle list 144px wide: "A brief written
 * with your team, kept in the dashboard…" would set in six ragged lines
 * of three words. So between md and lg each list becomes a row instead —
 * its head in a fixed left column, its items beside it, a hairline above
 * — which is the same ledger turned on its side. Phones stack plainly.
 *
 * COLOUR. The bullets are the one mark of violet: small, product-accent
 * dots, the same size on all three lists, because none of the three is
 * more important than the others. "Said up front" is deliberately not
 * coloured as a warning — nothing in it is bad news, only news.
 *
 * THE LAST PARAGRAPH is the conservative ownership line (who edits after
 * launch is agreed when the build is quoted). It sits apart, at reading
 * width, because it is the one term the page leaves open and it should
 * not hide inside a bullet list.
 * ------------------------------------------------------------------ */

export function Handover({ data }: { data: typeof CAA_HANDOVER }) {
  return (
    <section id="handover" className="scroll-mt-28">
      <Frame className="px-6 md:px-12">
        <Eyebrow>{data.eyebrow}</Eyebrow>
        <SectionTitle className="mt-4 max-w-[820px]">{data.title}</SectionTitle>
        <p className="mt-5 max-w-[560px] text-base leading-[25px] text-pp-ink/80">{data.body}</p>
      </Frame>

      <Frame className="mt-10 px-6 md:px-12">
        <div className="grid gap-8 lg:grid-cols-3 lg:gap-0 lg:divide-x lg:divide-pp-rule">
          {data.columns.map((col) => (
            <div
              key={col.head}
              // md–lg: a row of the ledger (head left, items right) with a
              // hairline above; lg: a column with a hairline between.
              className="min-w-0 md:max-lg:grid md:max-lg:grid-cols-[200px_minmax(0,1fr)] md:max-lg:gap-x-8 md:max-lg:border-t md:max-lg:border-pp-rule md:max-lg:pt-6 lg:px-8 lg:first:pl-0 lg:last:pr-0"
            >
              {/* md–lg: 3px down so the 16px head sits on the first 21px item line. */}
              <h3 className="text-[11px] leading-4 font-medium tracking-[0.12em] text-pp-muted uppercase md:max-lg:pt-[3px]">
                {col.head}
              </h3>
              <ul className="mt-4 space-y-3 md:max-lg:mt-0">
                {col.items.map((item) => (
                  <li key={item} className="flex gap-3">
                    {/* 9px down centres a 4px dot on the x-height of a 21px line. */}
                    <span aria-hidden className="mt-[9px] size-1 shrink-0 rounded-full bg-pp-accent" />
                    <span className="min-w-0 text-[14px] leading-[21px] text-pp-ink/85">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-10 max-w-[620px] text-[15px] leading-[23px] text-pp-ink">{data.after}</p>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
          {data.links.map((l) => (
            <IntentLink
              key={l.href}
              href={l.href}
              className="inline-flex min-h-6 items-center text-[14px] leading-5 underline-offset-4 transition-colors hover:text-[#551a89] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink"
            >
              {l.label} →
            </IntentLink>
          ))}
        </div>
      </Frame>
    </section>
  );
}
