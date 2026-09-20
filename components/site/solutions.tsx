"use client";

import { useEffect, useRef, useState } from "react";
import type { gsap } from "gsap";
import { SOLUTIONS_INTRO, SOLUTION_ITEMS } from "@/lib/site";
import { cn } from "@/lib/utils";
import { Frame, PillLink, SectionHeading } from "./product/primitives";
import { useKitContext, useMotionKit } from "./product/motion-kit";
import { holdFor, useInView, usePrefersReducedMotion } from "./product/timing";

/**
 * The second business — the one the homepage never admitted to.
 *
 * The agent is a product you buy. These five are work you commission, and
 * until now a visitor met them only by opening the mega menu. That is
 * backwards. A company that can build you a CRM is *more* credible selling
 * you a phone agent, not less, and the agent is the cheapest possible proof
 * that the building is real. This band is what makes the site read as a
 * company rather than as a single-feature tool, which is why it sits here,
 * immediately before the price: the reader should know who they are buying
 * from before they are asked what it costs.
 *
 * **It is a spec sheet, not five cards.** The section has to carry "we know
 * what we are doing", and a grid of tiles is the shape of a brochure — it
 * asks to be admired and gives the eye nothing to check. What we actually
 * hold per item is a promise, three deliverables and a four-part stack.
 * That is a *specification*, and a specification is the only page furniture
 * that reads as competence rather than as marketing, because it can be
 * disagreed with. So: one ruled row per item, fields labelled in the small
 * caps the product pages label with, the stack in mono because a stack is a
 * list of names and setting it as prose would be a lie about what it is.
 * Hairlines and the label gutter do the grouping; nothing is boxed — which
 * matters more here than anywhere, because on white stock a card is the
 * loudest object available and this band has five of everything.
 *
 * **Set in `pp`, like every other marketing page on the site.** White
 * stock, black ink, violet only on the mark and the eyebrow, `#f4f3f7`
 * unused because nothing here is a card. Hairlines are `--pp-rule` and they
 * all sit on one inset: the ledger draws its own top edge as the first
 * row's border rather than borrowing the page-level `<Rule />`, whose frame
 * is 24/48px wider than the padded rows and would have left the spec sheet
 * with one hairline overhanging the rest. In a ledger that is not a detail.
 *
 * **Vertical rhythm is half a `<Gap />` on each side** (`py-10 md:py-16`),
 * so two adjacent homepage bands add up to exactly the 80/128px the product
 * pages put between sections. If a neighbouring section sets its own
 * heavier padding the seam grows; the fix is there, not here.
 *
 * **One link, and it is the intro's.** Four of the five solution pages do
 * not exist. A section whose entire job is to look like we know what we are
 * doing cannot afford to walk a reader into a 404 — that single dead click
 * costs more than the whole band earns. So the four are named in full, with
 * their promise and their stack, and are simply not links. No "coming
 * soon" either: an unlinked heading reads as a capability, an unlinked
 * heading with a badge on it reads as a roadmap. The one that does exist is
 * a secondary pill, because a pill is the site's only button and a lone
 * underlined sentence at the foot of a spec sheet reads as a footnote.
 *
 * ── THE MOVEMENT ──────────────────────────────────────────────────────
 *
 * **The signature movement is a pen: the ledger is signed off, line by
 * line, and the marks are drawn rather than switched on.** That is the
 * whole argument of the band. A specification you watch being *completed*
 * is a claim somebody is standing behind; a specification that fades up as
 * you scroll is a brochure with a transition on it, and the movement in
 * that case belongs to the reader's wheel rather than to us. So one GSAP
 * timeline owns the pass, and it owns all of it at once:
 *
 *  · a violet hairline descends the left gutter, `DrawSVG`n from the top of
 *    the ledger to the bottom — the head, made literal. It is the only
 *    object on screen that crosses the whole section, which is what makes
 *    five rows read as one movement instead of five;
 *  · as it reaches a row, that row's promise arrives **as language** —
 *    `SplitText` words out of a light blur, at reading pace, because the
 *    promise is the sentence being committed to;
 *  · then each deliverable is *struck*: its hairline is drawn left to
 *    right, in violet, past the grey stub that stood there — a mark being
 *    made, not a width transitioning. Each strike lands at `holdFor()` of
 *    its own text, so a line is signed only once you could have read it;
 *  · the row's bottom rule is drawn along with the strikes, so the ledger
 *    is visibly ruling itself as it is filled;
 *  · the four stack tokens land last and left to right, on one real
 *    stagger, because the stack is what the deliverables were built out of
 *    and it should arrive after them rather than with them.
 *
 * No `MotionPath`: nothing here travels a route, it is written on a line,
 * and a traveller would be an animation looking for a job. No shader band
 * either — a scene behind a specification would be decoration behind the
 * one section on the page that has to read as sober.
 *
 * The pass runs once and rests on the complete sheet — a marketing band
 * that re-erases its own ledger every thirty seconds is a nervous tic.
 * `useInView` fetches the kit a quarter-screen early and plays the timeline
 * only once the ledger is properly on screen, pausing it the moment it
 * leaves. `usePrefersReducedMotion` never loads GSAP at all: the markup
 * **rests complete** — every mark drawn, every rule ruled, every token in
 * place — and the timeline's opening `.set()` is what knocks it back to
 * blank. The first pointer, focus or key from the reader ends the pass
 * permanently: the context reverts, which restores that same finished
 * sheet in one frame, so nobody is made to wait for a line they are
 * already reading. From then on hovering a row is the only thing that
 * lights one, because from then on the ledger is theirs. Nothing here ever
 * starts from zero opacity: an unplayed row is a legible row, dimmer by a
 * third at worst.
 */

/**
 * Line numbers for the ledger. Two digits so the rail stays a fixed
 * optical width and the labels start on one vertical.
 */
const lineNo = (i: number) => String(i + 1).padStart(2, "0");

/**
 * Caption tone — field names, never substance. The product pages' label:
 * Inter small caps in the muted violet-grey, which clears 5.6:1 on white.
 * Mono is reserved here for things that are literally names (the line
 * number, the stack), so that the two tones mean different things.
 */
const FIELD = "text-[11px] leading-4 font-medium tracking-[0.12em] text-pp-muted uppercase";

/**
 * The two literals GSAP needs as values rather than as classes: the house
 * violet and the muted grey at half strength, which is where an unstruck
 * row's mark sits. Tailwind writes them as classes; a tween needs numbers.
 */
const ACCENT = "#551a89";
const UNSTRUCK = "rgba(107, 104, 120, 0.5)";

/** One row of the score, in seconds from the start of the pass. */
type RowScore = {
  /** When the head arrives at the row. */
  start: number;
  /** When each deliverable is struck. */
  marks: number[];
  /** When the stack lands. */
  stack: number;
  /** When the row is finished and the head moves on. */
  end: number;
};

/**
 * The score. One beat per deliverable, held at reading pace off its own
 * text, then one shorter beat for the stack — a list of four names is
 * scanned, not read, so it does not earn a reading-pace hold. Held in
 * seconds because that is what a timeline position is, and precomputed at
 * module load because it is the same for every reader.
 */
const SCORE: RowScore[] = (() => {
  let t = 0;
  return SOLUTION_ITEMS.map((item) => {
    const start = t;
    const marks = item.deliverables.map((d) => (t += holdFor(d) / 1000));
    const stack = (t += 0.76);
    return { start, marks, stack, end: t };
  });
})();

export function Solutions() {
  const ledgerRef = useRef<HTMLUListElement>(null);
  // Two margins, two jobs: `near` fetches GSAP, `inView` plays the pass.
  const inView = useInView(ledgerRef, "-10% 0px -10% 0px");
  const near = useInView(ledgerRef, "25% 0px");
  const reduce = usePrefersReducedMotion();
  // `near && !reduce`: with reduced motion the sheet is already complete in
  // the markup, so the library is never fetched at all.
  const kit = useMotionKit(near && !reduce);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  /** Which row the head is standing on. */
  const [active, setActive] = useState(0);
  /** Set by the reader's first pointer/focus/key. Never unset. */
  const [taken, setTaken] = useState(false);
  /** The pass has said everything it has to say. */
  const [done, setDone] = useState(false);
  /** Which row the reader is pointing at, once the sheet is theirs. */
  const [pointed, setPointed] = useState<number | null>(null);

  const settled = reduce || taken || done;

  useKitContext(
    kit,
    ({ gsap, SplitText }) => {
      // Handed over before the kit arrived, or nothing to play: the revert
      // that brought us here has already restored the finished sheet.
      if (taken || reduce) return;

      const q = gsap.utils.selector(ledgerRef);
      const rail = q(".sl-rail-ink")[0] as Element | undefined;
      if (!rail) return;

      const tl = gsap.timeline({ paused: true, onComplete: () => setDone(true) });

      // The whole blank sheet, set at the top, before anything is written.
      tl.set(rail, { drawSVG: "0% 0%" }, 0)
        .set(q(".sl-mark"), { drawSVG: "0% 0%" }, 0)
        .set(q(".sl-row-rule"), { drawSVG: "0% 0%" }, 0)
        .set(q(".sl-icon"), { color: UNSTRUCK }, 0)
        .set(q(".sl-line"), { opacity: 0.58 }, 0)
        .set(q(".sl-token"), { opacity: 0.35, x: -4 }, 0);

      SOLUTION_ITEMS.forEach((item, row) => {
        const score = SCORE[row];
        const rowSel = `[data-sl-row="${row}"]`;
        const marks = q(`${rowSel} .sl-mark`);
        const lines = q(`${rowSel} .sl-line`);
        const rule = q(`${rowSel} .sl-row-rule`);
        const promise = q(`${rowSel} .sl-promise`)[0] as HTMLElement | undefined;
        const total = item.deliverables.length + 1;

        // The head arrives, and the rail is drawn down to this row's foot.
        tl.call(() => setActive(row), [], score.start).to(
          rail,
          {
            drawSVG: `0% ${(((row + 1) / SOLUTION_ITEMS.length) * 100).toFixed(2)}%`,
            duration: score.end - score.start,
            ease: "none",
          },
          score.start,
        );

        if (promise) {
          // Split for motion only: the words stay plain text to a screen
          // reader, and the context reverts the split — never call
          // .revert() by hand. The promise never goes to zero: an unplayed
          // row has to stay readable.
          const split = SplitText.create(promise, { type: "words", aria: "none" });
          // Each word on its own compositor layer, so the fade, the rise
          // and the light blur are GPU work rather than a repaint per frame.
          gsap.set(split.words, { willChange: "transform, opacity, filter", force3D: true });
          tl.fromTo(
            split.words,
            { autoAlpha: 0.4, yPercent: 8, filter: "blur(2px)" },
            {
              autoAlpha: 1,
              yPercent: 0,
              filter: "blur(0px)",
              duration: 0.55,
              ease: "power2.out",
              stagger: 0.045,
              immediateRender: false,
            },
            score.start,
          );
        }

        score.marks.forEach((at, i) => {
          // The mark is drawn, past the grey stub it replaces.
          tl.to(marks[i], { drawSVG: "0% 100%", duration: 0.45, ease: "power2.out" }, at)
            .to(lines[i], { opacity: 1, duration: 0.35, ease: "power2.out" }, at)
            .to(
              rule,
              {
                drawSVG: `0% ${((((i + 1) / total) * 100)).toFixed(2)}%`,
                duration: 0.5,
                ease: "power2.out",
              },
              at,
            );
          // The mark inks on the first strike, not on arrival: the row is
          // signed when a line is, not when it is looked at.
          if (i === 0) tl.to(q(`${rowSel} .sl-icon`), { color: ACCENT, duration: 0.4 }, at);
        });

        // The stack lands last, and left to right: it is read across.
        tl.to(
          q(`${rowSel} .sl-token`),
          { opacity: 1, x: 0, duration: 0.5, ease: "power3.out", stagger: 0.07 },
          score.stack,
        ).to(rule, { drawSVG: "0% 100%", duration: 0.5, ease: "power2.out" }, score.stack);
      });

      tlRef.current = tl;
      return () => {
        tlRef.current = null;
      };
    },
    // `revertOnUpdate` because the callback splits text and sets inline
    // styles — and because reverting is exactly how the handover completes
    // the sheet: the finished state is the markup's own.
    { scope: ledgerRef, dependencies: [reduce, taken], revertOnUpdate: true },
  );

  // Plays while on screen, and nowhere else. `kit` is in the deps because
  // the timeline is built asynchronously, after the kit arrives.
  useEffect(() => {
    const tl = tlRef.current;
    if (!tl) return;
    if (inView && !reduce && !taken) tl.play();
    else tl.pause();
  }, [inView, reduce, taken, kit]);

  /**
   * The lit row. While the pass runs it is wherever the head stands; once
   * the sheet is settled it is whatever the reader is pointing at, and
   * nothing at all when they are pointing at nothing.
   */
  const lit = settled ? pointed : active;

  /** Ends the pass for good. Idempotent, so it can sit on every handler. */
  const takeOver = () => setTaken(true);

  return (
    <section
      id="solutions"
      className="scroll-mt-28 py-10 md:py-16"
      onFocusCapture={takeOver}
      onKeyDownCapture={takeOver}
    >
      <Frame className="px-6 md:px-12">
        {/* masthead — on the gutter, not centred. No entrance: a heading
            that fades in because you scrolled to it is the decoration this
            section was rebuilt to get rid of. */}
        <div>
          <SectionHeading eyebrow={SOLUTIONS_INTRO.kicker} className="max-w-[820px]">
            {SOLUTIONS_INTRO.title}
          </SectionHeading>

          <p className="mt-5 max-w-[620px] text-base leading-[25px] text-pretty text-pp-muted">
            {SOLUTIONS_INTRO.sub}
          </p>
        </div>

        {/* the ledger. Its top edge is the first row's own hairline, so every
            rule in the section sits on one vertical. */}
        <ul
          ref={ledgerRef}
          className="relative mt-10 border-t border-pp-rule md:mt-12"
          onPointerLeave={() => setPointed(null)}
        >
          {/* The head, made literal: one hairline down the gutter, drawn
              from the top of the ledger to the bottom over the whole pass.
              Ghost then ink, the pair every drawn stroke here is made of.
              Desktop only — at one column the gutter is the page margin. */}
          <svg
            aria-hidden
            viewBox="0 0 1 100"
            preserveAspectRatio="none"
            className="pointer-events-none absolute -left-5 top-0 hidden h-full w-px overflow-visible md:block"
          >
            <line
              x1="0.5"
              y1="0"
              x2="0.5"
              y2="100"
              className="text-pp-rule"
              stroke="currentColor"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <line
              className="sl-rail-ink text-pp-accent"
              x1="0.5"
              y1="0"
              x2="0.5"
              y2="100"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {SOLUTION_ITEMS.map((item, index) => {
            const Icon = item.icon;
            const isLit = lit === index;

            return (
              <li
                key={item.id}
                data-sl-row={index}
                onPointerEnter={() => {
                  takeOver();
                  setPointed(index);
                }}
                className={cn(
                  "relative grid gap-x-10 gap-y-5 border-b border-pp-rule py-7 transition-opacity duration-500 md:grid-cols-[40px_minmax(200px,1fr)_minmax(0,1.35fr)] md:py-9",
                  isLit ? "opacity-100" : "opacity-[0.72]",
                )}
              >
                {/* The row rules itself as its marks land: a violet hairline
                    drawn along the bottom edge, over the grey one. */}
                <svg
                  aria-hidden
                  viewBox="0 0 100 1"
                  preserveAspectRatio="none"
                  className="pointer-events-none absolute inset-x-0 -bottom-px h-px w-full overflow-visible"
                >
                  <line
                    className="sl-row-rule text-pp-accent/70"
                    x1="0"
                    y1="0.5"
                    x2="100"
                    y2="0.5"
                    stroke="currentColor"
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>

                {/* rail: the mark and the line number */}
                <div className="flex items-center gap-3 md:block">
                  {/* Colour is GSAP's here, so no transition utility to
                      fight it; it rests inked, and the timeline is what
                      takes it back to grey. */}
                  <Icon className="sl-icon size-5 shrink-0 text-pp-accent" strokeWidth={1.75} aria-hidden />
                  {/* 4px down on desktop so the numeral clears the 20px mark
                      without the rail claiming a line of its own. */}
                  <span
                    className={cn(
                      "mono text-[11px] leading-4 tracking-[0.18em] transition-colors duration-500 md:mt-4 md:block",
                      isLit ? "text-pp-ink" : "text-pp-muted",
                    )}
                  >
                    {lineNo(index)}
                  </span>
                </div>

                {/* what it is */}
                <div className="min-w-0">
                  <h3 className="text-[19px] leading-7 tracking-[-0.01em] text-balance text-pp-ink md:text-[21px] md:leading-8">
                    {item.label}
                  </h3>
                  <p className="sl-promise mt-2 max-w-[360px] text-[14px] leading-[21px] text-pretty text-pp-muted md:text-[15px] md:leading-[23px]">
                    {item.promise}
                  </p>
                </div>

                {/* the specification */}
                <div className="min-w-0">
                  <div className="grid gap-x-8 gap-y-2 sm:grid-cols-[76px_minmax(0,1fr)]">
                    {/* 3px down so the 16px label sits on the first 21px item line. */}
                    <p className={cn(FIELD, "sm:pt-[3px]")}>Delivers</p>
                    <ul className="space-y-2">
                      {item.deliverables.map((d) => (
                        <li key={d} className="flex gap-3">
                          {/* A rule, not a bullet — the page groups with
                              hairlines and this is the smallest one. 10px
                              down centres it on a 21px line. The grey stub
                              is the unstruck mark; the violet one is drawn
                              over and past it when the line is signed. */}
                          <svg
                            aria-hidden
                            viewBox="0 0 24 2"
                            className="mt-[10px] h-px w-6 shrink-0 overflow-visible"
                          >
                            <line
                              x1="0"
                              y1="1"
                              x2="12"
                              y2="1"
                              className="text-pp-hair"
                              stroke="currentColor"
                              strokeWidth="1"
                              vectorEffect="non-scaling-stroke"
                            />
                            <line
                              className="sl-mark text-pp-accent"
                              x1="0"
                              y1="1"
                              x2="24"
                              y2="1"
                              stroke="currentColor"
                              strokeWidth="1"
                              strokeLinecap="round"
                              vectorEffect="non-scaling-stroke"
                            />
                          </svg>
                          <span className="sl-line min-w-0 text-[14px] leading-[21px] text-pp-ink/85">
                            {d}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-5 grid gap-x-8 gap-y-2 border-t border-pp-rule pt-5 sm:grid-cols-[76px_minmax(0,1fr)]">
                    <p className={FIELD}>Stack</p>
                    <div className="flex flex-wrap items-center gap-y-2">
                      {item.stack.map((s, i) => (
                        /* No Tailwind translate-* on anything GSAP touches:
                           Tailwind v4 writes the standalone `translate`
                           property, which composes on top of the transform
                           GSAP writes. The offset is the timeline's. */
                        <span
                          key={s}
                          className={cn(
                            "sl-token mono text-[11px] leading-4 tracking-[0.14em] text-pp-ink uppercase",
                            i > 0 && "ml-3 border-l border-pp-hair pl-3",
                          )}
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {/*
          The only destination in the band. It is the intro's, not the first
          row's: hanging the link off one of five otherwise identical rows
          would imply the other four are links a reader has failed to find.
        */}
        <PillLink href={SOLUTIONS_INTRO.href} variant="secondary" className="mt-9">
          {SOLUTIONS_INTRO.cta}
        </PillLink>
      </Frame>
    </section>
  );
}
