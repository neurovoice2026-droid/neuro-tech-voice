import type { Metadata } from "next";
import { ProductShell } from "@/components/site/product/shell";
import { Deferred, Gap } from "@/components/site/product/primitives";
import { KbHero } from "@/components/site/product/knowledge-base/hero";
import { KbIdea } from "@/components/site/product/knowledge-base/idea";
import { KbMeaning } from "@/components/site/product/knowledge-base/meaning";
import { KbShelf } from "@/components/site/product/knowledge-base/shelf";
import { KbTwoCalls } from "@/components/site/product/knowledge-base/two-calls";
import { KbLimits } from "@/components/site/product/knowledge-base/limits";
import { KbCurrent } from "@/components/site/product/knowledge-base/current";
import { KbWriting } from "@/components/site/product/knowledge-base/writing";
import { KbFaq, KbStart } from "@/components/site/product/knowledge-base/closing";
import { KB_META } from "@/lib/pages/knowledge-base";

export const metadata: Metadata = {
  title: KB_META.title,
  description: KB_META.description,
  alternates: { canonical: "/product/knowledge-base" },
};

export default function KnowledgeBasePage() {
  return (
    <ProductShell>
      <KbHero />
      <Gap className="mt-16 md:mt-24" />
      {/* What it is, how it finds things, what to give it, why it matters,
          where it stops, how to keep it right — then the questions and the
          way in. Nothing below the cover is rendered until it is close. */}
      <Deferred size={900}>
        <KbIdea />
        <Gap />
      </Deferred>
      <Deferred size={1100}>
        <KbMeaning />
        <Gap />
      </Deferred>
      <Deferred size={1000}>
        <KbShelf />
        <Gap />
      </Deferred>
      <Deferred size={800}>
        <KbTwoCalls />
        <Gap />
      </Deferred>
      <Deferred size={800}>
        <KbLimits />
        <Gap />
      </Deferred>
      <Deferred size={700}>
        <KbCurrent />
        <Gap />
      </Deferred>
      <Deferred size={900}>
        <KbWriting />
        <Gap />
      </Deferred>
      <Deferred size={1100}>
        <KbFaq />
        <Gap className="h-16 md:h-24" />
        <KbStart />
        <Gap className="h-16 md:h-24" />
      </Deferred>
    </ProductShell>
  );
}
