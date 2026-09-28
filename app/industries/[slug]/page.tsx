import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductShell } from "@/components/site/product/shell";
import { Deferred, Gap, Rule } from "@/components/site/product/primitives";
import { FirstQuestion } from "@/components/site/industry/first-question";
import { Signature } from "@/components/site/industry/signature";
import { Bench } from "@/components/site/industry/bench";
import { RunIt } from "@/components/site/industry/run-it";
import { Wall } from "@/components/site/industry/wall";
import { Relay } from "@/components/site/industry/relay";
import { Rules } from "@/components/site/industry/rules";
import { GoLive } from "@/components/site/industry/go-live";
import { Ledger } from "@/components/site/industry/ledger";
import { IndustryFaq, IndustryStart } from "@/components/site/industry/closing";
import { INDUSTRY_SLUGS, tradeFor } from "@/lib/pages/industries";

/**
 * Sixteen trades are in the menu; only the ones with written data have a
 * page. An unknown slug is a 404 rather than a generic template, so the
 * route stays fully prerendered — which is what keeps it on the static
 * branch of the CSP — and so a trade is never represented by a page that
 * does not know its vocabulary.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return INDUSTRY_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const trade = tradeFor(slug);
  if (!trade) return {};
  return {
    title: `${trade.label} — an agent that answers your phone`,
    description: trade.standfirst,
    alternates: { canonical: `/industries/${slug}` },
  };
}

export default async function IndustryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const trade = tradeFor(slug);
  if (!trade) notFound();

  /*
    Deferred sizes are measured, not guessed: each one is the tallest trade's
    real height for that block on a phone. An estimate well under the truth
    makes the page collapse by thousands of pixels the moment a block scrolls
    out of view, and rects taken during that reflow put one section's button
    on top of the next section's rows.

    The sceptic's objections, in the order they actually arrive: it won't
    understand my callers → fine, but does anything really happen → it'll
    make something up → what about the calls it can't take → it won't
    know how we work → it'll take weeks. Then the receipt.

    Nothing below the cover renders until it is close to the viewport.
  */
  return (
    <ProductShell>
      <FirstQuestion trade={trade} />
      <Gap />
      {/* The trade's own image, full bleed. Its aspect ratios are fixed, so
          the band holds its own space and the scene costs nothing until the
          reader is nearly on it. */}
      <Deferred size={520}>
        <Signature trade={trade} />
        <Gap />
      </Deferred>
      <Deferred size={880}>
        <Bench trade={trade} />
        <Gap />
      </Deferred>
      <Deferred size={1320}>
        <RunIt trade={trade} />
        <Gap />
      </Deferred>
      <Deferred size={1320}>
        <Wall trade={trade} />
        <Gap />
      </Deferred>
      <Deferred size={1080}>
        <Relay trade={trade} />
        <Gap />
      </Deferred>
      <Deferred size={1020}>
        <Rules trade={trade} />
        <Gap />
      </Deferred>
      <Deferred size={1260}>
        <Rule />
        <Gap className="h-16 md:h-24" />
        <GoLive trade={trade} />
        <Gap />
      </Deferred>
      <Deferred size={4200}>
        <Ledger trade={trade} />
        <Gap />
        <IndustryFaq trade={trade} />
        <Gap className="h-16 md:h-24" />
        <IndustryStart trade={trade} />
        <Gap className="h-16 md:h-24" />
      </Deferred>
    </ProductShell>
  );
}
