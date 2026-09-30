import type { Metadata } from "next";
import { ProductShell } from "@/components/site/product/shell";
import { Deferred, Gap } from "@/components/site/product/primitives";
import { ProductFaq, ProductStart } from "@/components/site/product/closing";
import { IntHero } from "@/components/site/product/integrations/hero";
import { IntBuilder } from "@/components/site/product/integrations/builder";
import { IntIdea } from "@/components/site/product/integrations/idea";
import { IntTriggers } from "@/components/site/product/integrations/triggers";
import { IntActions, IntPayload } from "@/components/site/product/integrations/actions";
import { IntRuns } from "@/components/site/product/integrations/runs";
import { IntGoogle, IntRecipes } from "@/components/site/product/integrations/later";
import { INT_FAQ, INT_META, INT_START } from "@/lib/pages/integrations";

export const metadata: Metadata = {
  title: INT_META.title,
  description: INT_META.description,
  alternates: { canonical: "/product/integrations" },
};

export default function IntegrationsPage() {
  return (
    <ProductShell>
      <IntHero />
      <Gap className="mt-16 md:mt-24" />
      {/* How little it takes first — then what a workflow is, what starts
          one, what it can do and send, how you know it worked, what is in
          beta, and where to begin. Nothing below the cover is rendered until
          it is close. */}
      <Deferred size={800}>
        <IntBuilder />
        <Gap />
      </Deferred>
      <Deferred size={900}>
        <IntIdea />
        <Gap />
      </Deferred>
      <Deferred size={800}>
        <IntTriggers />
        <Gap />
      </Deferred>
      <Deferred size={900}>
        <IntActions />
        <Gap />
      </Deferred>
      {/* One box for the two: rendered together, so nothing in one is ever
          measured against the other's placeholder. */}
      <Deferred size={1600}>
        <IntPayload />
        <Gap />
        <IntRuns />
        <Gap />
      </Deferred>
      <Deferred size={600}>
        <IntRecipes />
        <Gap />
      </Deferred>
      <Deferred size={600}>
        <IntGoogle />
        <Gap />
      </Deferred>
      <Deferred size={1100}>
        <ProductFaq data={INT_FAQ} />
        <Gap className="h-16 md:h-24" />
        <ProductStart data={INT_START} />
        <Gap className="h-16 md:h-24" />
      </Deferred>
    </ProductShell>
  );
}
