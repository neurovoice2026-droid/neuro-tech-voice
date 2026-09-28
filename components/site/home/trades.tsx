import { IntentLink } from "@/components/site/intent-link";
import { Frame } from "@/components/site/product/primitives";
import { HOME } from "@/lib/pages/home";
import type { HomeTrades } from "@/lib/pages/home.server";
import { HomeHeading } from "./heading";
import { TradesWindow } from "./trades-window";
import "./trades.css";

/* ------------------------------------------------------------------ *
 * #use-cases — your trade: sixteen industries and the custom build.
 *
 * The page's second signature. The reader picks a trade and the window
 * dissolves to that trade's scene, drawn live; under it, one caller in
 * that trade, what the agent does with them, and the first thing its
 * starting instructions tell it never to do, quoted.
 *
 * A server component on purpose: it reads the copy here and hands the
 * window only the strings it shows, so the landing's copy modules stay
 * out of this section's client chunk.
 * ------------------------------------------------------------------ */

export function Trades({ data }: { data: HomeTrades }) {
  const t = HOME.trades;
  return (
    <section id="use-cases" aria-labelledby="use-cases-title" className="scroll-mt-28">
      <Frame>
        <HomeHeading
          id="use-cases-title"
          eyebrow={t.eyebrow}
          title={t.title}
          sub={t.sub}
          action={
            <IntentLink
              href={t.all.href}
              className="group/all -my-[11px] inline-flex min-h-11 items-center gap-1.5 text-[15px] leading-[22px] text-pp-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink"
            >
              {/* The underline is the words' own, so it stops short of the arrow. */}
              <span className="underline decoration-pp-ink/25 underline-offset-4 transition-[text-decoration-color] duration-200 group-hover/all:decoration-pp-ink">
                {t.all.label}
              </span>
              <span
                aria-hidden
                className="inline-block transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/all:translate-x-0.5"
              >
                →
              </span>
            </IntentLink>
          }
        />
        <TradesWindow data={data} copy={{ group: t.group, cells: t.cells, sample: t.sample }} />
      </Frame>
    </section>
  );
}
