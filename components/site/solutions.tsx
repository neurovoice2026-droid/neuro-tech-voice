"use client";

import { useEffect, useRef, useState } from "react";
import { SOLUTIONS_INTRO, SOLUTION_ITEMS } from "@/lib/site";
import { cn } from "@/lib/utils";
import { Frame, PillLink, SectionHeading } from "./product/primitives";
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
 * **The scene: the ledger fills itself in.** A spec sheet that fades up as
 * you scroll is a brochure with a transition on it — the movement belongs
 * to the reader's wheel, not to us. So the section does the thing a
 * commission actually does: it gets *signed off*, line by line, while you
 * watch. A head walks the ledger top to bottom; on the row it is standing
 * on, each deliverable is struck — its hairline lengthens and takes the
 * violet — at `holdFor()` reading pace, so a line is marked only once you
 * could have read it; then the four stack tokens land left to right,
 * because the stack is what the deliverables were built out of and it
 * should arrive after them, not with them. A violet rule grows along the
 * row's bottom edge as its four marks land, so the ledger is visibly
 * ruling itself. The head then moves down, and what it leaves behind stays
 * struck: the argument is the accumulation, a sheet that was blank when
 * you arrived and is fully specified by the time you reach the price.
 *
 * The pass runs once and rests on the complete sheet — a marketing band
 * that re-erases its own ledger every thirty seconds is a nervous tic, and
 * one that keeps a timer alive after it has said everything is a bug.
 * `useInView` gates it so nothing advances off screen, every timeout is
 * cleared, and `usePrefersReducedMotion` is handed the finished sheet on
 * the first frame with no timer at all. The first pointer, focus or key
 * from the reader ends the pass permanently and completes the sheet in the
 * same breath — nobody is made to wait for a line they are already reading
 * — after which hovering a row is the only thing that lights one, because
 * from then on the ledger is theirs. Nothing here ever starts from zero
 * opacity: an unplayed row is a legible row, dimmer by a third at worst.
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
 * The score. One beat per deliverable, held at reading pace off its own
 * text, then one shorter beat for the stack — a list of four names is
 * scanned, not read, so it does not earn a reading-pace hold. Flat rather
 * than nested so the playhead is a single integer and "how far has row N
 * got" is a count, which is what the row rendering wants anyway.
 */
const BEATS = SOLUTION_ITEMS.flatMap((item, row) => [
  ...item.deliverables.map((d) => ({ row, hold: holdFor(d) })),
  { row, hold: 760 },
]);

/** Marks in a finished row: every deliverable struck, plus the stack. */
const MARKS_PER_ROW = (item: (typeof SOLUTION_ITEMS)[number]) => item.deliverables.length + 1;

export function Solutions() {
  const reduce = usePrefersReducedMotion();
  const ledgerRef = useRef<HTMLUListElement>(null);
  const inView = useInView(ledgerRef, "-10% 0px -10% 0px");

  /** The playhead: how many beats of BEATS have been struck. */
  const [head, setHead] = useState(0);
  /** Set by the reader's first pointer/focus/key. Never unset. */
  const [taken, setTaken] = useState(false);
  /** Which row the reader is pointing at, once the sheet is theirs. */
  const [pointed, setPointed] = useState<number | null>(null);

  const settled = reduce || taken || head >= BEATS.length;

  useEffect(() => {
    if (settled || !inView) return;
    const id = window.setTimeout(() => setHead((h) => h + 1), BEATS[head].hold);
    return () => window.clearTimeout(id);
  }, [settled, inView, head]);

  /**
   * The lit row. While the pass runs it is wherever the head stands; once
   * the sheet is settled it is whatever the reader is pointing at, and
   * nothing at all when they are pointing at nothing.
   */
  const lit = settled ? pointed : BEATS[head].row;

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
        {/* masthead — on the gutter, not centred */}
        <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-500 fill-mode-both">
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
          className="mt-10 border-t border-pp-rule md:mt-12"
          onPointerLeave={() => setPointed(null)}
        >
          {SOLUTION_ITEMS.map((item, index) => {
            const Icon = item.icon;
            const total = MARKS_PER_ROW(item);
            /* Marks struck in this row: all of them once the sheet is
               settled, otherwise the beats the head has already played. */
            const struck = settled
              ? total
              : BEATS.slice(0, head).filter((b) => b.row === index).length;
            const stackIn = struck >= total;
            const isLit = lit === index;

            return (
              <li
                key={item.id}
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
                    growing along the bottom edge, over the grey one. */}
                <span
                  aria-hidden
                  className="absolute inset-x-0 -bottom-px h-px origin-left bg-pp-accent/70 transition-[width] duration-500"
                  style={{ width: `${(struck / total) * 100}%` }}
                />

                {/* rail: the mark and the line number */}
                <div className="flex items-center gap-3 md:block">
                  <Icon
                    className={cn(
                      "size-5 shrink-0 transition-colors duration-500",
                      struck > 0 ? "text-pp-accent" : "text-pp-muted/50",
                    )}
                    strokeWidth={1.75}
                    aria-hidden
                  />
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
                  <p className="mt-2 max-w-[360px] text-[14px] leading-[21px] text-pretty text-pp-muted md:text-[15px] md:leading-[23px]">
                    {item.promise}
                  </p>
                </div>

                {/* the specification */}
                <div className="min-w-0">
                  <div className="grid gap-x-8 gap-y-2 sm:grid-cols-[76px_minmax(0,1fr)]">
                    {/* 3px down so the 16px label sits on the first 21px item line. */}
                    <p className={cn(FIELD, "sm:pt-[3px]")}>Delivers</p>
                    <ul className="space-y-2">
                      {item.deliverables.map((d, i) => {
                        const marked = i < struck;
                        return (
                          <li key={d} className="flex gap-3">
                            {/* A rule, not a bullet — the page groups with
                                hairlines and this is the smallest one. 10px
                                down centres it on a 21px line. It lengthens
                                and takes the violet when the line is struck. */}
                            <span
                              aria-hidden
                              className={cn(
                                "mt-[10px] h-px shrink-0 transition-all duration-300",
                                marked ? "w-6 bg-pp-accent" : "w-3 bg-pp-hair",
                              )}
                            />
                            <span
                              className={cn(
                                "min-w-0 text-[14px] leading-[21px] transition-colors duration-300",
                                marked ? "text-pp-ink/85" : "text-pp-ink/50",
                              )}
                            >
                              {d}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div className="mt-5 grid gap-x-8 gap-y-2 border-t border-pp-rule pt-5 sm:grid-cols-[76px_minmax(0,1fr)]">
                    <p className={FIELD}>Stack</p>
                    <div className="flex flex-wrap items-center gap-y-2">
                      {item.stack.map((s, i) => (
                        /* Left to right, 80ms apart — `x` and not `y`: the
                           row is a line of a specification and is read
                           across. Never from zero: an unplayed row has to
                           stay readable. */
                        <span
                          key={s}
                          style={{ transitionDelay: stackIn ? `${i * 80}ms` : "0ms" }}
                          className={cn(
                            "mono text-[11px] leading-4 tracking-[0.14em] text-pp-ink uppercase transition-all duration-500",
                            stackIn ? "translate-x-0 opacity-100" : "-translate-x-1 opacity-35",
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
        <PillLink
          href={SOLUTIONS_INTRO.href}
          variant="secondary"
          className="mt-9 animate-in fade-in-0 slide-in-from-bottom-2 duration-500 fill-mode-both"
        >
          {SOLUTIONS_INTRO.cta}
        </PillLink>
      </Frame>
    </section>
  );
}
