import type { Metadata } from "next";
import { ProductShell } from "@/components/site/product/shell";
import { Deferred, Eyebrow, Frame, Gap, PillLink, SectionTitle } from "@/components/site/product/primitives";
import { IntentLink } from "@/components/site/intent-link";
import { NAV_INDUSTRIES } from "@/lib/site";
import { tradeFor } from "@/lib/pages/industries";

export const metadata: Metadata = {
  title: "Industries",
  description:
    "The same agent, your trade's vocabulary. A page for each of the sixteen trades whose phones we answer, with the calls they really get.",
  alternates: { canonical: "/industries" },
};

/* ------------------------------------------------------------------ *
 * The index.
 *
 * A ruled list rather than a grid of tiles, and each row carries the one
 * thing that makes that trade's phone unlike the other fifteen — which
 * is the only reason to have sixteen pages rather than one. A row for a
 * trade we have not written yet is not a link: an empty page is worse
 * than an honest gap.
 * ------------------------------------------------------------------ */

export default function IndustriesPage() {
  const rows = NAV_INDUSTRIES.map((entry) => ({ entry, trade: tradeFor(entry.slug) }));

  return (
    <ProductShell>
      <section className="pt-28 md:pt-[148px]">
        <Frame className="px-6 md:px-12">
          <Eyebrow>Industries</Eyebrow>
          <SectionTitle as="h1" className="mt-4 max-w-[860px]">
            One agent. Sixteen ways of answering a phone.
          </SectionTitle>
          <p className="mt-5 max-w-[600px] text-base leading-6 tracking-[0.01em] text-pp-ink/80 md:text-[17px] md:leading-[26px]">
            The tools are the same on every one of these pages. What changes is the vocabulary it
            expects, the paperwork a call has to produce, and the one thing it is never allowed to say.
          </p>
          <div className="mt-7 flex flex-wrap gap-x-2 gap-y-6">
            <PillLink href="/register">Start free</PillLink>
            <PillLink href="/#pricing" variant="secondary">
              See the plans
            </PillLink>
          </div>
        </Frame>
      </section>

      <Gap />

      <Deferred size={1200}>
        <Frame className="px-6 md:px-12">
          <ul>
            {rows.map(({ entry, trade }) => {
              const line = trade ? trade.kicker : entry.caller;
              const body = (
                <>
                  <span className="text-[19px] leading-7 md:text-[22px] md:leading-8">{entry.label}</span>
                  <span className="mt-1 block max-w-[560px] text-[14px] leading-[21px] text-pp-muted md:mt-0 md:ml-auto md:max-w-[420px] md:text-right">
                    {line}
                  </span>
                </>
              );
              return (
                <li key={entry.slug} className="border-b border-pp-rule first:border-t">
                  {trade ? (
                    <IntentLink
                      href={`/industries/${entry.slug}`}
                      className="flex flex-col py-5 text-pp-ink transition-colors hover:text-pp-accent md:flex-row md:items-baseline md:gap-8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink"
                    >
                      {body}
                    </IntentLink>
                  ) : (
                    <div className="flex flex-col py-5 text-pp-muted md:flex-row md:items-baseline md:gap-8">
                      {body}
                      <span className="mt-2 text-[11px] tracking-[0.1em] uppercase md:mt-0">Coming</span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <p className="mt-8 max-w-[620px] text-[13px] leading-5 text-pp-muted">
            Not on the list? The agent is not built from a fixed set of trades — it takes the
            vocabulary you give it, and the trade only decides what it knows on the first day.
          </p>
        </Frame>
      </Deferred>

      <Gap className="h-16 md:h-24" />
    </ProductShell>
  );
}
