import { cn } from "@/lib/utils";
import { Frame, PillLink } from "@/components/site/product/primitives";
import { HOME } from "@/lib/pages/home";
import { HomeHeading } from "./heading";
import { TYPE, WEIGHT } from "./type";
import "./doubts.css";

/* ------------------------------------------------------------------ *
 * #faq — what still worries me. Five doubts, in the order they arrive,
 * as five native <details> rows, all closed.
 *
 * A server component: nothing here runs in the browser but the
 * heading's reveal. The answers are in the server's HTML, so Ctrl+F
 * finds them and opens their row; the height eases open in CSS
 * (home.css, .home-faq) and every other state is a selector on
 * [open], :hover, :active or :focus-visible (doubts.css).
 *
 * At lg the heading column stays in view while the rows beside it
 * open, so a long answer never leaves the reader without the question
 * of the section. Below lg it is one column, heading first.
 *
 * The ordinals are the title's own promise, "in the order they
 * arrive", made visible; they are hidden from assistive tech, which
 * gets five h3 questions and no numbering noise.
 *
 * Two answers end somewhere the reader can do the thing (set the
 * register, work out the bill). Those are in-page fragments, so they
 * are plain anchors: the browser's own jump, honouring each target's
 * scroll-margin, with no route to prefetch and no client code.
 * ------------------------------------------------------------------ */

export function Doubts() {
  const f = HOME.faq;

  // Built from the constant the rows render, never typed out: structured
  // data that disagrees with the page is worse than none. Carried over
  // from the landing's previous FAQ (components/site/faq.tsx).
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: f.items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-28">
      <Frame className="grid gap-10 lg:grid-cols-[384px_minmax(0,1fr)] lg:gap-12">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <HomeHeading id="faq-title" eyebrow={f.eyebrow} title={f.title} />
          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
            <PillLink
              href={f.talk.href}
              variant="secondary"
              size="sm"
              // 36px pill, 44px target: the hit area reaches 4px past
              // each edge, clear of anything else that takes a tap.
              className="relative after:absolute after:inset-x-0 after:-inset-y-1"
            >
              {f.talk.label}
            </PillLink>
            <p className={cn(TYPE.meta, "tabular-nums")} translate="no">
              {f.phone}
            </p>
          </div>
        </div>

        <div className="home-faq border-t border-pp-rule">
          {f.items.map((item, i) => (
            <details key={item.q} className="home-doubts-row border-b border-pp-rule pb-[15px]">
              <summary className="home-doubts-q flex items-baseline pt-[26px] pb-[10px]">
                <span aria-hidden className={cn(TYPE.mono, "home-doubts-n w-8 shrink-0 text-pp-muted md:w-14")}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className={cn(TYPE.h3, "min-w-0 flex-1 text-pretty")} style={{ fontWeight: WEIGHT.h3 }}>
                  {item.q}
                </h3>
                {/* 32px disc on a 28px line: -2px above and below centres it
                    on the first line and keeps it out of the row's height. */}
                <span
                  aria-hidden
                  className="home-doubts-disc -my-0.5 ml-4 grid size-8 shrink-0 place-items-center self-start rounded-full md:ml-6"
                >
                  <svg viewBox="0 0 12 12" fill="none" className="size-3">
                    <path d="M6 1.25v9.5M1.25 6h9.5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
                  </svg>
                </span>
              </summary>

              <div className="home-doubts-a pb-[10px] pl-8 md:pl-14">
                {/* 600, not the 640 ceiling: these answers run six to nine
                    lines, and at 640 a line of Inter 16 holds ~85
                    characters. 600 brings it to ~78. */}
                <p className={cn(TYPE.lead, "max-w-[600px] text-pretty")}>{item.a}</p>
                {item.where ? (
                  // 22px of text in a 44px target; the -10px bottom margin
                  // hands the target's lower half back to the row's padding,
                  // so a row that ends on a link keeps the same 26px foot.
                  <a
                    href={item.where.href}
                    className="home-doubts-where group/where mt-1 -mb-2.5 inline-flex min-h-11 items-center gap-1.5 rounded-full text-[15px] leading-[22px] text-pp-ink transition-colors duration-200 hover:text-[#551a89] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink"
                  >
                    {/* The underline on the words only: on the flex parent it
                        would carry into the arrow and break across the gap. */}
                    <span className="underline decoration-pp-ink/25 decoration-1 underline-offset-[5px] transition-[text-decoration-color] duration-200 group-hover/where:decoration-current">
                      {item.where.label}
                    </span>
                    <span aria-hidden className="home-doubts-arrow">
                      →
                    </span>
                  </a>
                ) : null}
              </div>
            </details>
          ))}
        </div>
      </Frame>

      <script
        type="application/ld+json"
        // Our own constants, escaped anyway: a `<` in an answer would
        // otherwise be free to close this element early.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
    </section>
  );
}
