import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Frame, PillLink } from "@/components/site/product/primitives";
import { HOME } from "@/lib/pages/home";
import { HomeHeading } from "./heading";
import { TrustFigure } from "./trust-figures";
import { TYPE, WEIGHT } from "./type";
import "./trust.css";

/* ------------------------------------------------------------------ *
 * #trust — can I trust you with my callers?
 *
 * Four things you can check yourself, in four hairline cells: a small
 * line figure labelled with the one datum you can look up, the claim,
 * and the part of its note we can stand behind. Then the data-handling
 * checklist as plain chips, and the privacy policy.
 *
 * A server component, and quiet: the only motion is the figures drawing
 * on their way up the screen (CSS view timelines, trust.css) and the
 * heading's reveal. The figures share one midline, and the datums sit on
 * it, so across the row the four read as one register.
 * ------------------------------------------------------------------ */

/**
 * Hairlines between the cells: one column, 2 × 2 from md, a row of four
 * from xl. Four columns wait for xl because at 1024 each note would get
 * 172px and run to a dozen lines.
 */
const CELL = [
  "md:pr-8 xl:pl-0",
  "border-t md:border-t-0 md:border-l md:pl-8 xl:pr-8",
  "border-t md:pr-8 xl:border-t-0 xl:border-l xl:pl-8",
  "border-t md:border-l md:pl-8 xl:border-t-0 xl:pr-0",
] as const;

export function Trust() {
  const t = HOME.trust;
  return (
    <section id="trust" aria-labelledby="trust-title" className="scroll-mt-28">
      <Frame>
        <HomeHeading id="trust-title" eyebrow={t.eyebrow} title={t.title} />

        <ul className="mt-10 grid border-y border-pp-rule md:grid-cols-2 lg:mt-12 xl:grid-cols-4">
          {t.items.map((item, i) => (
            // The datum is the figure's label, so it sits on the figure's
            // midline; it comes last in the markup, read after the note.
            // In the row of four every claim takes two lines, so the notes
            // start on one line across the row.
            <li
              key={item.id}
              className={cn("grid grid-cols-[auto_minmax(0,1fr)] content-start gap-x-3 border-pp-rule py-6 md:py-8", CELL[i])}
            >
              <TrustFigure id={item.id} i={i} />
              <h3 className={cn("col-span-2 mt-5 text-balance xl:max-w-[12em]", TYPE.h3)} style={{ fontWeight: WEIGHT.h3 }}>
                {item.label}
              </h3>
              <p className={cn("col-span-2 mt-2 max-w-[560px] text-pretty", TYPE.meta, "text-pp-ink/70")}>
                {item.note}
              </p>
              <p className={cn("col-start-2 row-start-1 self-center text-pp-muted", TYPE.mono)}>{t.datums[i]}</p>
            </li>
          ))}
        </ul>

        {/* From xl the chips take the first three columns and the policy
            link sits in the fourth, on the cell's text edge, centred on the
            last row of chips (it is 44px to their 36, hence the 4px). */}
        <div className="mt-8 flex flex-col items-start gap-8 xl:grid xl:grid-cols-4 xl:items-end xl:gap-0">
          {/* On a phone no two chips fit side by side, and eight pills in a
              column read as a stack of buttons: there it is a plain two-column
              list, and the chips start at sm. */}
          <ul className="grid w-full grid-cols-2 gap-x-4 gap-y-3 sm:flex sm:w-auto sm:flex-wrap sm:gap-2 xl:col-span-3">
            {t.checklist.map((c) => (
              <li
                key={c.id}
                className="flex items-start gap-2 text-[13px] leading-[18px] text-balance sm:inline-flex sm:h-9 sm:items-center sm:gap-1.5 sm:rounded-full sm:bg-white sm:px-3.5 sm:text-[14px] sm:leading-5 sm:whitespace-nowrap sm:shadow-[0_0_0_1px_rgb(24_16_40/0.06)]"
              >
                <Check aria-hidden className="mt-0.5 size-3.5 shrink-0 sm:mt-0" strokeWidth={1.75} />
                {c.label}
              </li>
            ))}
          </ul>
          <PillLink href={t.cta.href} variant="secondary" className="xl:-mb-1 xl:ml-8 xl:justify-self-start">
            {t.cta.label}
          </PillLink>
        </div>
      </Frame>
    </section>
  );
}
