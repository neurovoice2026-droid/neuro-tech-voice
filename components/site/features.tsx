"use client";

import { Sparkles } from "lucide-react";
import { FEATURES, FEATURES_INTRO, type Feature } from "@/lib/site";
import { cn } from "@/lib/utils";
import { CoverCheck } from "./ui";
import { DissolveText } from "./dissolve-text";
import {
  AgentMockup,
  AnalyticsMockup,
  CalendarMockup,
  VoiceMockup,
} from "./mockups";
import { Reveal } from "./reveal";

/**
 * Features, laid out as the live site lays them out.
 *
 * The structure is the reference's, beat for beat: a centred header — a
 * pill eyebrow, a big statement, one line of subhead — and then four
 * full-width bands, each a claim on one side and a window on the product
 * on the other, sides alternating down the page. That alternation is what
 * keeps four long entries from reading as a list, and the window is what
 * makes each claim land as a thing that exists rather than as a promise.
 *
 * What is emphatically *not* the reference's is the colour and the type.
 * This section keeps the cover's world exactly as it stood: the sticky
 * WebGL field and its CSS fallback, the grain, the two scrims that bridge
 * it to the ink above and below, --cover-paper on --cover-field-low,
 * --cover-brand-lit as the only accent, Inter Tight at 500, and the fluid
 * `em` scale that makes the whole composition breathe with the viewport
 * instead of snapping at breakpoints. The reference's white cards and
 * #8249df do not appear anywhere; its *arrangement* does.
 *
 * The headings keep the cover's dissolve, for the same reason: it is part
 * of how type is set here, not decoration layered on top of it.
 */

/** Copy pairs with its panel by `id` — see the Feature type in site.ts. */
const MOCKUPS: Record<Feature["id"], () => React.JSX.Element> = {
  agent: AgentMockup,
  voice: VoiceMockup,
  calendar: CalendarMockup,
  analytics: AnalyticsMockup,
};

function Entry({ feature, index }: { feature: Feature; index: number }) {
  // Odd entries put the window on the left. Order is swapped rather than
  // the columns re-declared, so the text stays first in the DOM and the
  // reading order survives the single-column layout.
  const flip = index % 2 === 1;
  const Mockup = MOCKUPS[feature.id];
  const Icon = feature.icon;

  return (
    <article className="grid items-center gap-[3em] md:grid-cols-2 md:gap-[4.5em]">
      <div className={cn(flip && "md:order-2")}>
        <Reveal y={20}>
          <span className="inline-flex items-center gap-[0.6em] text-[0.72em] font-semibold uppercase leading-none tracking-[0.2em] text-[var(--cover-brand-lit)]">
            <Icon className="size-[1.3em] shrink-0" strokeWidth={1.9} />
            {feature.kicker}
          </span>
        </Reveal>

        <Reveal y={20} delay={0.06} className="mt-[0.85em]">
          <DissolveText
            as="h3"
            text={feature.title}
            className="max-w-[13em] text-[2em] font-medium leading-[1.08] tracking-[-0.04em] md:text-[2.4em]"
          />
        </Reveal>

        <Reveal
          y={16}
          delay={0.12}
          className="mt-[1em] max-w-[27em] text-[1.02em] leading-[1.65] text-[var(--cover-paper)]/65"
        >
          {feature.body}
        </Reveal>

        <Reveal y={16} delay={0.18} className="mt-[1.6em]">
          <ul className="flex flex-col gap-[0.85em]">
            {feature.bullets.map((b) => (
              <CoverCheck key={b}>{b}</CoverCheck>
            ))}
          </ul>
        </Reveal>
      </div>

      <Reveal y={28} delay={0.1} className={cn(flip && "md:order-1")}>
        <Mockup />
      </Reveal>
    </article>
  );
}

export function Features() {
  return (
    <section
      id="features"
      className="relative scroll-mt-24 px-[1.6em] py-[6em] md:py-[8em]"
    >
      <div className="relative mx-auto max-w-[76em]">
        <div className="mx-auto flex max-w-[36em] flex-col items-center text-center">
          <Reveal>
            <span className="inline-flex items-center gap-[0.55em] rounded-full border border-[var(--cover-brand-lit)]/25 bg-[var(--cover-brand-lit)]/10 px-[1.15em] py-[0.5em] text-[0.72em] font-semibold uppercase leading-none tracking-[0.18em] text-[var(--cover-brand-lit)]">
              <Sparkles className="size-[1.25em] shrink-0" strokeWidth={2} />
              {FEATURES_INTRO.eyebrow}
            </span>
          </Reveal>

          <Reveal delay={0.06} className="mt-[1em]">
            <h2 className="text-balance text-[2.8em] font-medium leading-[1.03] tracking-[-0.045em] md:text-[3.4em]">
              {FEATURES_INTRO.title}
            </h2>
          </Reveal>

          <Reveal
            delay={0.12}
            className="mt-[1.1em] max-w-[30em] text-pretty text-[1.05em] leading-[1.6] text-[var(--cover-paper)]/60"
          >
            {FEATURES_INTRO.sub}
          </Reveal>
        </div>

        <div className="mt-[5.5em] flex flex-col gap-[6em] md:mt-[7.5em] md:gap-[8em]">
          {FEATURES.map((f, i) => (
            <Entry key={f.id} feature={f} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
