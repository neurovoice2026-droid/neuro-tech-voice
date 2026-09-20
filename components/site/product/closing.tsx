import { IntentLink } from "@/components/site/intent-link";
import { Frame, PillLink, Rule, SectionHeading } from "./primitives";

/* ------------------------------------------------------------------ *
 * How a product page closes: the questions people ask, then the way in.
 *
 * Plain markup — the answers open with the browser's own disclosure, so
 * they work before any script and are all in the HTML for search.
 * ------------------------------------------------------------------ */

type Link = { label: string; href: string };

export type FaqData = {
  eyebrow: string;
  title: string;
  items: readonly { id: string; q: string; a: string }[];
  privacy: Link;
};

export type StartData = {
  eyebrow: string;
  title: string;
  body: string;
  primary: Link;
  secondary: Link;
  note: string;
  more: Link;
};

export function ProductFaq({ data }: { data: FaqData }) {
  return (
    <Frame className="grid gap-8 px-6 pb-10 md:px-12 lg:grid-cols-[384px_minmax(0,1fr)] lg:gap-12 lg:pb-0">
      <div className="flex flex-col items-start gap-6">
        <SectionHeading eyebrow={data.eyebrow}>{data.title}</SectionHeading>
        <PillLink href={data.privacy.href} variant="secondary" size="sm">
          {data.privacy.label}
        </PillLink>
      </div>
      <div className="border-t border-pp-rule">
        {data.items.map((item) => (
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
  );
}

export function ProductStart({ data }: { data: StartData }) {
  return (
    <>
      <Rule />
      <Frame className="grid gap-8 px-6 py-16 md:px-12 md:py-24 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <SectionHeading eyebrow={data.eyebrow} className="max-w-[640px]">
            {data.title}
          </SectionHeading>
          <p className="mt-5 max-w-[560px] text-[16px] leading-[25px] text-pp-ink/80">{data.body}</p>
        </div>
        <div className="flex flex-col items-start gap-3 lg:items-end">
          {/* gap-y is deliberately larger than gap-x: two pills 8px apart
              fail the touch-target spacing rule the moment the row wraps,
              and whether it wraps depends on how long the page's own copy
              is — so it passed on one page and failed on another. */}
          <div className="flex flex-wrap gap-x-2 gap-y-6">
            <PillLink href={data.primary.href}>{data.primary.label}</PillLink>
            <PillLink href={data.secondary.href} variant="secondary">
              {data.secondary.label}
            </PillLink>
          </div>
          <p className="text-[13px] leading-[18px] text-pp-muted">{data.note}</p>
          <IntentLink
            href={data.more.href}
            // 24px tall rather than its 20px line: a standalone link, so it
            // gets the WCAG 2.5.8 minimum target, not the inline-text exemption.
            className="mt-1.5 inline-flex min-h-6 items-center text-[14px] leading-5 underline-offset-4 transition-colors hover:text-[#551a89] hover:underline"
          >
            {data.more.label} →
          </IntentLink>
        </div>
      </Frame>
      <Rule />
    </>
  );
}
