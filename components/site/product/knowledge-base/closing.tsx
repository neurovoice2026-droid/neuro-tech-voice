import { KB_FAQ, KB_START } from "@/lib/pages/knowledge-base";
import { IntentLink } from "@/components/site/intent-link";
import { Frame, PillLink, Rule, SectionHeading } from "../primitives";

/* ------------------------------------------------------------------ *
 * The page's close: the questions people ask about a knowledge base, and
 * the way in. Plain markup — the answers open with the browser's own
 * disclosure, so they work before any script and are all in the HTML
 * for search.
 * ------------------------------------------------------------------ */

export function KbFaq() {
  return (
    <>
      <Frame className="grid gap-8 px-6 pb-10 md:px-12 lg:grid-cols-[384px_minmax(0,1fr)] lg:gap-12 lg:pb-0">
        <div className="flex flex-col items-start gap-6">
          <SectionHeading eyebrow={KB_FAQ.eyebrow}>{KB_FAQ.title}</SectionHeading>
          <PillLink href={KB_FAQ.privacy.href} variant="secondary" size="sm">
            {KB_FAQ.privacy.label}
          </PillLink>
        </div>
        <div className="border-t border-pp-rule">
          {KB_FAQ.items.map((item) => (
            <details key={item.id} className="group border-b border-pp-rule">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[16px] leading-6 transition-colors hover:text-[#551a89] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink [&::-webkit-details-marker]:hidden">
                {item.q}
                <span
                  aria-hidden
                  className="relative grid size-6 shrink-0 place-items-center rounded-full border border-pp-hair transition-transform duration-300 group-open:rotate-45"
                >
                  <span className="absolute h-px w-2.5 bg-current" />
                  <span className="absolute h-2.5 w-px bg-current" />
                </span>
              </summary>
              <p className="max-w-[640px] pb-6 text-[15px] leading-[23px] text-pp-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </Frame>
    </>
  );
}

export function KbStart() {
  return (
    <>
      <Rule />
      <Frame className="grid gap-8 px-6 py-16 md:px-12 md:py-24 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <SectionHeading eyebrow={KB_START.eyebrow} className="max-w-[640px]">
            {KB_START.title}
          </SectionHeading>
          <p className="mt-5 max-w-[560px] text-[16px] leading-[25px] text-pp-ink/80">{KB_START.body}</p>
        </div>
        <div className="flex flex-col items-start gap-3 lg:items-end">
          <div className="flex flex-wrap gap-2">
            <PillLink href={KB_START.primary.href}>{KB_START.primary.label}</PillLink>
            <PillLink href={KB_START.secondary.href} variant="secondary">
              {KB_START.secondary.label}
            </PillLink>
          </div>
          <p className="text-[13px] leading-[18px] text-pp-muted">{KB_START.note}</p>
          <IntentLink
            href={KB_START.more.href}
            className="mt-2 text-[14px] leading-5 underline-offset-4 transition-colors hover:text-[#551a89] hover:underline"
          >
            {KB_START.more.label} →
          </IntentLink>
        </div>
      </Frame>
      <Rule />
    </>
  );
}
