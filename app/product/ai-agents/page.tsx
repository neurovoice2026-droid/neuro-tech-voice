import type { Metadata } from "next";
import { ProductShell } from "@/components/site/product/shell";
import { Deferred, Gap, Rule } from "@/components/site/product/primitives";
import { AgentsHero } from "@/components/site/product/ai-agents/hero";
import { AgentsOutcomes } from "@/components/site/product/ai-agents/outcomes";
import { AgentsCalls } from "@/components/site/product/ai-agents/calls";
import { AgentsPlatform } from "@/components/site/product/ai-agents/platform";
import { AgentsUseCases } from "@/components/site/product/ai-agents/use-cases";
import {
  AgentsGetStarted,
  AgentsIntegrations,
  AgentsTrust,
} from "@/components/site/product/ai-agents/sections";
import { AGENTS_META } from "@/lib/pages/ai-agents";

export const metadata: Metadata = {
  title: AGENTS_META.title,
  description: AGENTS_META.description,
  alternates: { canonical: "/product/ai-agents" },
};

export default function AiAgentsPage() {
  return (
    <ProductShell>
      <AgentsHero />
      <Gap className="mt-16 md:mt-24" />
      {/* Hear it first, then see it work a whole function, then what it
          changes, then what it runs on — and only then the fine print.
          None of it is on the first screen, so none of it is rendered
          until it is close. */}
      <Deferred size={900}>
        <AgentsCalls />
        <Rule />
        <Gap />
      </Deferred>
      <Deferred size={1000}>
        <AgentsUseCases />
        <Gap />
      </Deferred>
      <Deferred size={1000}>
        <AgentsOutcomes />
        <Gap />
      </Deferred>
      <Deferred size={1400}>
        <AgentsPlatform />
        <Rule />
      </Deferred>
      <Deferred size={1500}>
        <AgentsIntegrations />
        <Rule />
        <AgentsTrust />
        <Rule />
        <AgentsGetStarted />
        <Rule />
        <Gap className="h-16 md:h-24" />
      </Deferred>
    </ProductShell>
  );
}
