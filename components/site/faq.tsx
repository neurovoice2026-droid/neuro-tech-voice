"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { gsap } from "gsap";
import { FAQ, FAQ_INTRO } from "@/lib/site";
import { cn } from "@/lib/utils";
import { useKitContext, useMotionKit } from "./product/motion-kit";
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
 * ## THE MOVEMENT: THE LIST RULES ITSELF, ONE DOUBT AT A TIME.
 *
 * The section's claim is that the doubts are *finite and ordered* — that
 * there are five of them, that they arrive in this sequence, and that each
 * one is closed before the next is allowed in. So the signature movement
 * is the ruling: a hairline is **drawn**, left to right, under each doubt
 * as the list reaches it, and the bottom rule — the one that closes the
 * stack — is only drawn once the fifth has been answered. A list that
 * finishes ruling itself is a list that has run out of doubts, which is
 * the only thing this section wants the reader to feel before the price.
 *
 * That is `DrawSVGPlugin` on a real `<line>`, on one GSAP timeline per
 * beat, through `useMotionKit`/`useKitContext` like every other animated
 * section in the house. It replaced five `scale-x` transitions, which drew
 * nothing: a rule that scales is a rule that was always there being
 * stretched, and a rule that is drawn is a boundary being made.
 *
 * **`SplitText` on the question, and only on the question.** The doubt the
 * head has just reached says itself, word by word at 35ms, rising out of a
 * 2px blur — because a question is language arriving, not a block landing.
 * The words never fade from nothing: they are already on screen at the
 * row's resting 40% and they stay legible the whole way through. Nothing
 * on this page is ever hidden from anybody; the run is the order of the
 * argument being spoken out loud, not a reveal.
 *
 * No `MotionPathPlugin` — nothing here travels a route — and no shader
 * band. Five doubts on white stock is the last text before the price, and
 * a scene behind it would be the only thing on the page with nothing to
 * say.
 *
 * **Every hold is still `holdFor(question)`** — the house's reading pace,
 * never under 1.4s — and it is still React that decides which doubt is
 * live. GSAP owns the composed movement inside a beat; CSS keeps the small
 * state changes it is good at: the row lifting from 40% to full, the rule
 * going violet under the live doubt, the numeral taking ink, the meter.
 *
 * The run is one-shot, not a loop. It ends with all five answered, the
 * stack closed, and the head resting on the last — the state the reader
 * wants to be left in. `useInView` gates the clock at `-15%` and the kit
 * at `25%`, so nothing plays to an empty room and GSAP is never fetched
 * for a section that is never reached; the timeout is cleared on unmount
 * and off screen; `useKitContext` reverts every tween and every split when
 * the section leaves.
 *
 * **Reduced motion is the finished composition, not an absence.** The
 * markup rests complete — all five rules drawn, every answer at rest — so
 * the kit is asked for with `near && !reduce` and a reader who wants no
 * motion never downloads GSAP at all. The undrawn state is put on by a
 * layout effect before the first paint, which is also what gives the
 * server HTML and a no-JS reader the whole ruled list.
 *
 * **The reader takes it over on first contact and keeps it.** A pointer,
 * a focus or a key anywhere in the list sets `taken`, which rules the rest
 * of the stack at once and stops the clock for good; hovering or tabbing a
 * row then moves the head there, because at that point the head is the
 * reader's cursor rather than the section's. Nothing takes the wheel back.
 *
 * **Headings and paragraphs, not a `<dl>`.** A definition list may only
 * hold `dt`/`dd` or a `div` that directly holds them, and every pair here
 * is wrapped in a stateful row. An `h3` per question is both honest and
 * better: it puts all five in the document outline, so a screen-reader
 * user can jump between them.
 *
 * The file is a client component, because the scene is state. That costs
 * nothing structural: the FAQPage JSON-LD at the bottom still ships in the
 * server-rendered HTML, and it is still built by mapping the same `FAQ`
 * constant the rows render, so the structured data cannot drift from what
 * is on screen. Nothing in `app/` emits it, and it is the cheapest
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
 * The undrawn rule, put on before the first paint and never taken off by
 * React again. The `<line>` is 100 user units long, so a 100-unit dash
 * with a 100-unit offset hides it exactly; DrawSVG then owns both
 * properties from the moment the kit arrives.
 *
 * There is no ghost twin under these strokes, which is the one place this
 * file departs from the house figure idiom — and it departs for the house
 * reason. A ghost is 10–30% of INK; `--pp-rule` is 7%, so the ghost would
 * be the darker of the two and the rule would look drawn before it was.
 */
const UNDRAWN = { strokeDasharray: "100", strokeDashoffset: "100" } as const;

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
  // Two margins, two jobs: `near` fetches GSAP, `inView` runs the section.
  const inView = useInView(listRef, "-15% 0px");
  const near = useInView(listRef, "25% 0px");
  const reduce = usePrefersReducedMotion();
  // `near && !reduce`: with reduced motion the markup already rests
  // complete — every rule drawn, every answer at rest — so the kit is
  // never fetched at all.
  const kit = useMotionKit(near && !reduce);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  // The head starts on the last row so that the server HTML, the first
  // client render and every no-JS reader all show the finished, fully
  // ruled list. The layout effect below rewinds it to the first doubt and
  // takes the rules off, before the browser paints.
  const [head, setHead] = useState(LAST);
  const [taken, setTaken] = useState(false);
  const [armed, setArmed] = useState(false);

  // Rows that have arrived. Once the reader has the wheel, that is all of
  // them, permanently.
  const open = taken ? FAQ.length : head + 1;

  const rewound = useRef(false);
  useBeforePaint(() => {
    if (rewound.current) return;
    rewound.current = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setHead(0);
    setArmed(true);
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

  // How many rules this section has already drawn. A beat only ever draws
  // the ones that are new; the ones behind it are set, not re-animated, so
  // a rule is never drawn twice in front of the reader.
  const ruled = useRef(0);

  useKitContext(
    kit,
    ({ gsap, SplitText }) => {
      const q = gsap.utils.selector(listRef);
      const rules = q(".fq-rule");
      const close = q(".fq-close");
      const answers = q(".fq-answer");
      const questions = q(".fq-question");

      // The setting can flip to `reduce` under a kit that has already
      // arrived. Then nothing moves: the list simply reads as finished.
      if (reduce) {
        gsap.set([...rules, ...close], { drawSVG: "0% 100%" });
        gsap.set(answers, { y: 0 });
        ruled.current = FAQ.length;
        return;
      }

      const shown = taken ? FAQ.length : head + 1;
      const from = Math.min(ruled.current, shown);
      ruled.current = shown;

      const arriving = rules.slice(from, shown);
      const rising = answers.slice(from, shown);
      const spoken = shown - 1 >= from ? questions[shown - 1] : undefined;

      const tl = gsap.timeline({ paused: true });

      // The whole resting state of this beat, set at the top, before
      // anything moves.
      tl.set(rules.slice(0, from), { drawSVG: "0% 100%" }, 0)
        .set(answers.slice(0, from), { y: 0 }, 0)
        .set(arriving, { drawSVG: "0% 0%" }, 0)
        .set(rising, { y: 6 }, 0)
        .set(close, { drawSVG: "0% 0%" }, 0);

      // The ruling: the boundary under each new doubt, made left to right.
      if (arriving.length) {
        tl.to(arriving, { drawSVG: "0% 100%", duration: 0.6, ease: "power2.out", stagger: 0.06 }, 0);
      }

      // The doubt says itself. Split for motion only — the words stay
      // plain text to a screen reader, and the context reverts the split
      // when the beat rebuilds, so `.revert()` is never called by hand.
      if (spoken) {
        const split = SplitText.create(spoken, { type: "words", aria: "none" });
        // Each word on its own compositor layer, so the rise and the
        // light blur are GPU work rather than a repaint of the line.
        tl.set(split.words, { yPercent: 14, filter: "blur(2px)", willChange: "transform, filter", force3D: true }, 0)
          .to(
            split.words,
            { yPercent: 0, filter: "blur(0px)", duration: 0.7, ease: "power2.out", stagger: 0.035 },
            0.12,
          );
      }

      // The answer settles under it. Opacity is the row's, and the row's
      // is CSS: an answer the head has not reached is at 40% and legible,
      // never absent.
      if (rising.length) {
        tl.to(rising, { y: 0, duration: 0.5, ease: "power3.out", stagger: 0.06 }, 0.2);
      }

      // The stack closes only when the fifth doubt has been answered.
      if (shown >= FAQ.length) {
        tl.to(close, { drawSVG: "0% 100%", duration: 0.6, ease: "power2.out" }, ">-0.25")
          // A rest on the ending, written as an empty tween.
          .to({}, { duration: 0.6 });
      }

      tlRef.current = tl;
      return () => {
        tlRef.current = null;
      };
    },
    // `revertOnUpdate` because every beat sets inline styles and splits a
    // question; nothing from the beat before may outlive it.
    { scope: listRef, dependencies: [head, taken, reduce], revertOnUpdate: true },
  );

  // Plays while on screen. `kit` is in the deps because the timeline is
  // built asynchronously, after the kit arrives.
  useEffect(() => {
    const tl = tlRef.current;
    if (!tl) return;
    if (inView && !reduce) tl.play();
    else tl.pause();
  }, [inView, reduce, kit, head, taken]);

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
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeading eyebrow={FAQ_INTRO.eyebrow}>{FAQ_INTRO.title}</SectionHeading>

          {/* The meter: one mark per doubt, filling as the head reaches it.
              Decorative — it says nothing the numbered rows do not, and it
              carries no text, so it is out of the accessibility tree. A
              colour and an opacity are what a CSS transition is for; GSAP
              is for the ruling. */}
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
              <div key={f.q} onPointerEnter={() => take(i)} onFocusCapture={() => take(i)}>
                {/* The rule is the structure: drawing it is drawing the
                    boundary between one doubt and the next, and it is
                    violet for exactly as long as the head is standing on
                    the row below it. The stroke is one user unit in a
                    one-unit-tall box, so it is a hairline at every width
                    without a non-scaling-stroke — which would put the dash
                    pattern in device pixels and break the draw. */}
                <svg
                  aria-hidden
                  className="block h-px w-full"
                  viewBox="0 0 100 1"
                  preserveAspectRatio="none"
                >
                  <line
                    className={cn(
                      "fq-rule transition-colors duration-500 motion-reduce:transition-none",
                      lit ? "stroke-[#551a89]" : "stroke-pp-rule",
                    )}
                    x1="0"
                    y1="0.5"
                    x2="100"
                    y2="0.5"
                    strokeWidth="1"
                    style={armed ? UNDRAWN : undefined}
                  />
                </svg>

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
                      className="fq-question pp-display text-[20px] leading-[27px] tracking-[-0.02em] text-balance md:text-[24px] md:leading-[31px]"
                      // Inline: `.pp-display` sets 360 outside Tailwind's
                      // layers, so a weight utility would lose to it. Same
                      // 480 `SectionHeading` uses.
                      style={{ fontWeight: 480 }}
                    >
                      {f.q}
                    </h3>
                    {/* No `translate-y` utility here: Tailwind v4 writes
                        the standalone `translate` property, which would
                        compose on top of the `transform` GSAP writes. The
                        answer rests at zero and GSAP lifts it. */}
                    <p className="fq-answer mt-3 max-w-[640px] text-[15px] leading-[24px] text-pretty text-pp-ink/80 md:text-[16px] md:leading-[26px]">
                      {f.a}
                    </p>

                    {f.where ? (
                      <PillLink href={f.where.href} variant="secondary" size="sm" className="mt-5">
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
          <svg aria-hidden className="block h-px w-full" viewBox="0 0 100 1" preserveAspectRatio="none">
            <line
              className="fq-close stroke-pp-rule"
              x1="0"
              y1="0.5"
              x2="100"
              y2="0.5"
              strokeWidth="1"
              style={armed ? UNDRAWN : undefined}
            />
          </svg>
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
