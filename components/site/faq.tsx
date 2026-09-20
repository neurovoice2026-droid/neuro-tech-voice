"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FAQ, FAQ_INTRO } from "@/lib/site";
import { cn } from "@/lib/utils";
import { Frame, PillLink, SectionHeading } from "./product/primitives";
import { holdFor, useInView, usePrefersReducedMotion } from "./product/timing";

/**
 * FAQ — five answers, in the open, in the order the doubts arrive.
 *
 * **Set in the light product system, because that is the house.** Every
 * mega-menu page — the product pages, the solutions page, the sixteen
 * industry pages — is white stock, black ink, one violet accent, Onest
 * over Inter, and one centred `Frame`. This section briefly was not, and a
 * reader arriving here from any of those pages would have been looking at
 * a different company. The substance below is unchanged; only the surface
 * and the palette are. No `--cover-*` token appears in this file, and
 * sizing is rem/px rather than the cover's em base.
 *
 * **The layout is the one the product pages close with.** A short heading
 * column on the left, the list on the right — see `ProductFaq` in
 * components/site/product/closing.tsx. What differs, deliberately, is that
 * nothing here is behind a disclosure. Those pages answer eleven or twelve
 * questions and the drawers earn their keep; five answers in the last
 * section before the price do not. A reader with two questions would have
 * to open five drawers to find them, and a reader with none would see a
 * wall of closed drawers in the one place whose whole job is removing
 * reasons not to sign up. Nothing here is worth making somebody click for,
 * so nothing here is hidden.
 *
 * The earlier version of this section grouped the questions into three
 * lettered stages, three across. Three columns of two or three questions
 * each is a layout that argues about the *taxonomy* of doubt, and a reader
 * with a specific fear has to work out which bucket it was filed under
 * before they can find out whether it was answered. Eight questions needed
 * the scaffolding. Five do not: five fit in one column, read top to bottom
 * in the order the doubts actually arrive, and the first of them is the
 * fear under all the others. The measure is the other reason — these
 * answers run three and four lines, and a three-up sets prose at a width
 * nobody reads prose at.
 *
 * **The answer is body copy, at `text-pp-ink/80`.** The sister pages set a
 * two-line disclosure answer in `text-pp-muted`; these run three and four
 * lines and carry the substance of the section, so they get the heavier of
 * the two pp secondaries — the same one `ProductStart` uses for real body
 * copy. Only the numerals and the eyebrow go to `text-pp-muted`/accent.
 *
 * ## The scene: an objection is answered, then the next one arrives.
 *
 * This section used to animate because the reader scrolled — a stagger of
 * entrance wrappers and five rules drawn off scroll progress. That is
 * decoration: it says nothing except "you moved the wheel". It is gone,
 * along with every framer-motion import.
 *
 * What plays instead is the list working. A single **head** walks the five
 * doubts top to bottom on the house clock: it lands on a row, that row's
 * rule draws violet under it, its numeral lights, its answer settles into
 * place, and the head holds there for `holdFor(question)` — the same
 * reading-pace hold the platform scenes use, never under 1.4s — before the
 * next doubt arrives. Rows the head has not reached yet sit at 40% and are
 * still fully legible and fully in the DOM; nothing is hidden from anyone
 * at any moment, the run is simply the order of the argument being spoken
 * out loud. That is the claim the section makes in words — *these are the
 * five things, they are finite, each one has an answer* — made as motion.
 *
 * The run is one-shot, not a loop. It ends with all five answered and the
 * head resting on the last, which is the state the reader wants to be left
 * in. `useInView` gates it so it never plays to an empty room, the timeout
 * is cleared on unmount and while off screen, and
 * `usePrefersReducedMotion` short-circuits it to the finished state with
 * no timer ever scheduled.
 *
 * **The reader takes it over on first contact and keeps it.** A pointer,
 * a focus or a key anywhere in the list sets `taken`, which opens all five
 * at once and stops the clock for good; hovering or tabbing a row then
 * moves the head there, because at that point the head is the reader's
 * cursor rather than the section's. Nothing takes the wheel back.
 *
 * **The movement itself is CSS.** React only changes which index is the
 * head and how many rows have arrived; `transition-opacity`,
 * `transition-colors` and a `scaleX` on each rule do the animating, at the
 * house's 300/500ms. No easing curve is hand-rolled here.
 *
 * **Headings and paragraphs, not a `<dl>`.** A definition list may only
 * hold `dt`/`dd` or a `div` that directly holds them, and every pair here
 * is wrapped in a stateful row. An `h3` per question is both honest and
 * better: it puts all five in the document outline, so a screen-reader
 * user can jump between them.
 *
 * The file is a client component now, because the scene is state. That
 * costs nothing structural: the FAQPage JSON-LD at the bottom still ships
 * in the server-rendered HTML, and it is still built by mapping the same
 * `FAQ` constant the rows render, so the structured data cannot drift from
 * what is on screen. Nothing in `app/` emits it, and it is the cheapest
 * structured-data win the site has.
 *
 * `where` is drawn as a real action, and only when the constant carries
 * one. Two of the five end somewhere the reader can actually do the thing;
 * the other three have nowhere honest to send anybody, and a greyed-out
 * affordance would be worse than none. It is a secondary `PillLink`,
 * because that is the only button idiom this system has.
 */

const LAST = FAQ.length - 1;

/**
 * `useLayoutEffect` on the client, `useEffect` on the server — the rewind
 * below has to land before the first paint, and React logs a warning for a
 * layout effect during server rendering.
 */
const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function Faq() {
  // Built from the constant, never typed out. An FAQ schema that disagrees
  // with the page is worse than no schema at all.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const listRef = useRef<HTMLDivElement>(null);
  const inView = useInView(listRef, "-15% 0px");
  const reduce = usePrefersReducedMotion();

  // The head starts on the last row so that the server HTML, the first
  // client render and every no-JS reader all show the finished, fully
  // answered list. The layout effect below rewinds it to the first doubt
  // before the browser paints, so the rewind is never seen.
  const [head, setHead] = useState(LAST);
  const [taken, setTaken] = useState(false);

  // Rows that have arrived. Once the reader has the wheel, that is all of
  // them, permanently.
  const open = taken ? FAQ.length : head + 1;

  const rewound = useRef(false);
  useBeforePaint(() => {
    if (rewound.current) return;
    rewound.current = true;
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) setHead(0);
  }, []);

  // A reader who asks for no motion gets the end of the scene — everything
  // answered — and no timer is ever scheduled below.
  useEffect(() => {
    if (reduce) setHead(LAST);
  }, [reduce]);

  // The clock. One doubt at a time, held at reading pace, paused whenever
  // the list is off screen, cleared on unmount.
  useEffect(() => {
    if (taken || reduce || !inView || head >= LAST) return;
    const next = head + 1;
    const id = window.setTimeout(() => setHead(next), holdFor(FAQ[next].q));
    return () => window.clearTimeout(id);
  }, [taken, reduce, inView, head]);

  /** First pointer, focus or key hands the section over for good. */
  function take(index?: number) {
    setTaken(true);
    if (index !== undefined) setHead(index);
  }

  return (
    <Frame as="section" id="faq" className="scroll-mt-24 py-16 md:py-24">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,384px)_minmax(0,1fr)] lg:gap-16">
        {/* The heading column. It stays put on a long list, the way the
            product pages' closing FAQ does — the questions scroll past a
            fixed statement of what they are. */}
        <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-500 fill-mode-both lg:sticky lg:top-28 lg:self-start">
          <SectionHeading eyebrow={FAQ_INTRO.eyebrow}>{FAQ_INTRO.title}</SectionHeading>

          {/* The meter: one mark per doubt, filling as the head reaches it.
              Decorative — it says nothing the numbered rows do not, and it
              carries no text, so it is out of the accessibility tree. */}
          <div aria-hidden className="mt-7 flex items-center gap-1.5">
            {FAQ.map((f, i) => (
              <span
                key={f.q}
                className={cn(
                  "h-px w-7 transition-[background-color,opacity] duration-500 motion-reduce:transition-none",
                  i < open ? "opacity-100" : "opacity-40",
                  i === head && !taken ? "bg-[#551a89]" : i < open ? "bg-pp-ink/40" : "bg-pp-ink/20",
                )}
              />
            ))}
          </div>
        </div>

        {/* One reading column, hanging off a single left edge — which is
            the edge the eye returns to on every line of a four-line
            answer. */}
        <div
          ref={listRef}
          onPointerDown={() => take()}
          onKeyDown={() => take()}
          onFocusCapture={() => take()}
        >
          {FAQ.map((f, i) => {
            const arrived = i < open;
            const lit = i === head;

            return (
              <div
                key={f.q}
                onPointerEnter={() => take(i)}
                onFocusCapture={() => take(i)}
              >
                {/* The rule is the structure: drawing it from the left is
                    drawing the boundary between one doubt and the next,
                    and it is violet for exactly as long as the head is
                    standing on the row below it. */}
                <span
                  aria-hidden
                  className={cn(
                    "block h-px origin-left transition-[transform,background-color] duration-500 motion-reduce:transition-none",
                    arrived ? "scale-x-100" : "scale-x-0",
                    lit ? "bg-[#551a89]" : "bg-pp-rule",
                  )}
                />

                <div
                  className={cn(
                    "-mx-3 grid grid-cols-[auto_1fr] gap-x-4 rounded-2xl px-3 py-7 transition-[opacity,background-color] duration-500 motion-reduce:transition-none md:gap-x-7 md:py-9",
                    arrived ? "opacity-100" : "opacity-40",
                    lit && !taken ? "bg-[#551a89]/[0.025]" : "bg-transparent",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "pt-1.5 font-[family-name:var(--font-geist-mono)] text-[11px] leading-none tracking-[0.18em] transition-colors duration-300 motion-reduce:transition-none",
                      lit ? "text-[#551a89]" : "text-pp-muted",
                    )}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  <div className="min-w-0">
                    <h3
                      className="pp-display text-[20px] leading-[27px] tracking-[-0.02em] text-balance md:text-[24px] md:leading-[31px]"
                      // Inline: `.pp-display` sets 360 outside Tailwind's
                      // layers, so a weight utility would lose to it. Same
                      // 480 `SectionHeading` uses.
                      style={{ fontWeight: 480 }}
                    >
                      {f.q}
                    </h3>
                    <p
                      className={cn(
                        "mt-3 max-w-[640px] text-[15px] leading-[24px] text-pretty text-pp-ink/80 transition-transform duration-500 motion-reduce:transition-none md:text-[16px] md:leading-[26px]",
                        arrived ? "translate-y-0" : "translate-y-1",
                      )}
                    >
                      {f.a}
                    </p>

                    {f.where ? (
                      <PillLink
                        href={f.where.href}
                        variant="secondary"
                        size="sm"
                        className="mt-5"
                      >
                        {f.where.label}
                      </PillLink>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Closes the last row. Without it the stack is five rules with an
              open bottom, which reads as a list that was cut off — so it
              draws only once the fifth doubt has been answered, and the
              closing of the list is the end of the scene. */}
          <span
            aria-hidden
            className={cn(
              "block h-px origin-left bg-pp-rule transition-transform duration-500 motion-reduce:transition-none",
              open >= FAQ.length ? "scale-x-100" : "scale-x-0",
            )}
          />
        </div>
      </div>

      <script
        type="application/ld+json"
        // Our own constants, but escaped anyway: a `<` anywhere in an
        // answer would otherwise be free to close this element early.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
    </Frame>
  );
}
