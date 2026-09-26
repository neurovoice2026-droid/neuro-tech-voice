import Image from "next/image";
import { Check } from "lucide-react";
import { AGENT_INTEGRATIONS, GET_STARTED, TRUST } from "@/lib/pages/ai-agents";
import { Eyebrow, Frame, PillLink, Rule, SectionHeading } from "../primitives";

/* ------------------------------------------------------------------ *
 * The page's static sections: what it connects to, how the data is
 * handled, and the three ways in. The short ones are a heading and one
 * action beside the list they introduce.
 * ------------------------------------------------------------------ */

function Split({
  eyebrow,
  title,
  cta,
  children,
}: {
  eyebrow: string;
  title: string;
  cta: { label: string; href: string };
  children: React.ReactNode;
}) {
  return (
    <Frame className="grid gap-8 px-6 py-14 md:grid-cols-[384px_minmax(0,1fr)] md:gap-12 md:px-12 md:py-20">
      <div className="flex flex-col items-start gap-6">
        <div>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="mt-3 text-[22px] leading-[30px] text-balance md:text-2xl md:leading-8">{title}</h2>
        </div>
        <PillLink href={cta.href} variant="secondary" size="sm">
          {cta.label}
        </PillLink>
      </div>
      {children}
    </Frame>
  );
}

export function AgentsIntegrations() {
  return (
    <Split eyebrow={AGENT_INTEGRATIONS.eyebrow} title={AGENT_INTEGRATIONS.title} cta={AGENT_INTEGRATIONS.cta}>
      <div className="flex flex-col gap-6">
        <ul className="grid grid-cols-1 gap-x-12 gap-y-4 sm:grid-cols-2 md:max-w-[520px]">
          {AGENT_INTEGRATIONS.items.map((i) => (
            <li key={i.label} className="flex h-7 items-center gap-3 text-lg leading-7">
              <Image src={i.logo} alt="" width={20} height={20} className="size-5" />
              {i.label}
            </li>
          ))}
        </ul>
        <p className="max-w-[520px] text-[12px] leading-[18px] text-pp-muted">{AGENT_INTEGRATIONS.trademarks}</p>
      </div>
    </Split>
  );
}

export function AgentsTrust() {
  return (
    <Split eyebrow={TRUST.eyebrow} title={TRUST.title} cta={TRUST.cta}>
      <ul className="grid grid-cols-1 gap-x-12 gap-y-4 sm:grid-cols-2 md:max-w-[560px]">
        {TRUST.items.map((i) => (
          <li key={i.id} className="flex min-h-7 items-center gap-3 text-[15px] leading-[22px] md:text-base">
            <span className="grid size-5 shrink-0 place-items-center rounded-full border border-pp-hair">
              <Check className="size-3" strokeWidth={2} />
            </span>
            {i.label}
          </li>
        ))}
      </ul>
    </Split>
  );
}

export function AgentsGetStarted() {
  return (
    <>
      <Frame className="px-6 pt-20 pb-10 md:px-12 md:pt-28 md:pb-12">
        <SectionHeading eyebrow={GET_STARTED.eyebrow}>{GET_STARTED.title}</SectionHeading>
      </Frame>
      <Rule />
      <Frame className="grid md:grid-cols-3 md:divide-x md:divide-pp-rule max-md:divide-y max-md:divide-pp-rule">
        {GET_STARTED.columns.map((c) => (
          <div key={c.id} className="flex flex-col px-6 py-10 md:px-12 md:py-12">
            <h3 className="text-[15px] leading-[22px]">{c.title}</h3>
            <p className="text-[15px] leading-[22px] text-pp-muted">{c.body}</p>
            <PillLink href={c.cta.href} variant={c.cta.variant} className="mt-7 w-full">
              {c.cta.label}
            </PillLink>
            <ul className="mt-7 flex flex-col">
              {c.points.map((p) => (
                <li
                  key={p}
                  className="flex items-start gap-3 border-b border-pp-rule py-2.5 text-[14px] leading-5 text-pp-muted last:border-b-0"
                >
                  <Check className="mt-0.5 size-3.5 shrink-0 text-pp-ink" strokeWidth={2} />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Frame>
    </>
  );
}
