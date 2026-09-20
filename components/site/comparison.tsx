"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Check, Coins, KeyRound, Wrench } from "lucide-react";
import {
  COMPARISON_INTRO,
  COMPARISON_NOTE,
  COMPARISON_SOURCE,
  PART_STATES,
  RIVALS,
  STACK,
  type PartState,
} from "@/lib/site";
import { cn } from "@/lib/utils";
import { CornerDot } from "./corner-dot";
import { CountUp, EASE, Reveal } from "./reveal";

/**
 * The difference — measured against the platforms, not against voicemail.
 *
 * The old section was a six-row tick table against "Voicemail" and
 * "Receptionist", and it gave itself six out of six. Nobody shopping for a
 * voice agent is choosing between this and an answering machine. They have
 * a tab open on ElevenLabs and one on Vapi, and a table that pretends
 * otherwise mostly tells them we have not met our own market.
 *
 * So the comparison is a **bill of materials**: every layer a working
 * phone agent needs, and for each vendor, who supplies it. Four states,
 * because a tick and a cross cannot say the thing that matters here — a
 * layer can be shipped working, run by them but billed as its own line, an
 * account you open yourself, or a job left on your desk.
 *
 * **All five vendors are on screen at once, and that is the design.** An
 * earlier version was a rail you clicked through, one vendor at a time. It
 * was a better-looking panel and a far worse argument: the whole case is a
 * *shape* — four columns that stop halfway down and one that does not —
 * and a shape cannot be perceived one column at a time from memory. A
 * reader who never clicks, which is most of them, saw a single vendor and
 * no comparison at all. Everything here is legible without touching it.
 *
 * Decisions worth keeping, and the ones that replaced the panel:
 *
 *  · **The rule across the middle is the whole argument.** The first five
 *    layers are a voice stack: a solved, competitive, genuinely excellent
 *    market. The last five are one specific business's operations, which
 *    is not a market at all — it is work. Every platform goes dark below
 *    that rule, and that is not a failing on their part. The bottom half
 *    was never what they sold.
 *  · **It is complimentary on purpose, and that is what makes it land.**
 *    Every descriptor is taken from the vendor's own positioning, the note
 *    at the bottom says plainly that these are good products, and the
 *    footer dates the reading and invites correction. A comparison that
 *    sneers reads as a comparison that is lying; one that concedes the
 *    other side's strength reads as one that has counted honestly. We only
 *    need the reader to count the bottom five rows.
 *  · **It is a real `<table>` now.** It used to be fifty divs, each with a
 *    bare `sr-only` state label inside it, which a screen reader announces
 *    as fifty context-free strings — "shipped working, you build it, you
 *    build it" with no way to know whose column or which layer. `<th
 *    scope>` on the vendors and on the layers turns each of those fifty
 *    into "Vapi, reasoning, your account". The grid was never decoration;
 *    it was tabular data pretending not to be.
 *  · **No panel.** The whole board used to sit inside the same rounded,
 *    bordered, shadowed card as five other sections, which is what made
 *    the page read as a brochure rather than as one argument. Hairlines
 *    and space group it now. The card also flattered the table: a scroller
 *    inside a card looks deliberate, a scroller on the open field has to
 *    earn its width, and that pressure is what forced the vendor prose
 *    into the header where it belongs.
 *  · **Who each vendor is for lives in its own column header.** There used
 *    to be a five-line tail under the board restating, in about two
 *    hundred words, what the header already said — and restating it two
 *    hundred pixels below the column it described, so the reader had to
 *    hold a name in memory to use it. Folding it upward makes the header
 *    tall and the section shorter, and puts the fairness device where a
 *    sceptic actually looks: directly above the marks they distrust.
 *  · **The count is split.** It used to add "you build it" and "your
 *    account" together and print one figure, so Vapi showed 8 for a stack
 *    whose own row calls bring-your-own-keys the *cheaper* path. Those are
 *    different costs to a reader — one is work, the other is a signup —
 *    and a comparison that blurs them to make a rival's number bigger is
 *    exactly the kind of thing the source note at the bottom promises we
 *    did not do.
 *
 * The motion is the argument, not decoration (and there is only one piece
 * of it). Every rival's five business-half cells hold at full weight until
 * the second group rule crosses the middle of the viewport, then drop to
 * their true tone on a cascade down each column, four columns falling in
 * parallel while ours holds and its vertical rules draw down as one
 * object. That extinction *is* the section; what was here before was a
 * per-row 0.4→1 fade across four pixels, imperceptible, and re-indexed
 * inside each group so it did not even cascade.
 */

/** The section's place in the page's running order. */
const SECTION_N = "05";

const ICONS: Record<PartState, typeof Check> = {
  shipped: Check,
  metered: Coins,
  byo: KeyRound,
  build: Wrench,
};

/**
 * One ramp, from in-the-box to on-your-desk.
 *
 * Every state carries an icon as well as a weight, and not as decoration:
 * encoded in colour alone this grid would be unreadable to anyone who
 * cannot separate the lit fill from the dim one, which is the single most
 * common way a chart like this fails. It is also what lets the extinction
 * below be honest — the wrench is in the cell from the first paint, and
 * only the weight moves.
 */
const TONE: Record<PartState, string> = {
  shipped:
    "border-[var(--cover-brand-lit)]/55 bg-[var(--cover-brand-lit)] text-[var(--cover-ink)]",
  metered:
    "border-[var(--cover-brand-lit)]/45 bg-[var(--cover-brand-lit)]/16 text-[var(--cover-brand-lit)]",
  byo: "border-dashed border-[var(--cover-paper)]/35 text-[var(--cover-paper)]/75",
  // Dim is the point, but the glyph still has to clear the contrast floor:
  // the reader is meant to see that something is there and that it is not
  // lit, not to wonder whether the cell is empty. So the distance between
  // lit and dark is carried by the fill and the border, which are
  // decoration, and not by the mark, which is the data.
  build: "border-[var(--cover-paper)]/10 text-[var(--cover-paper)]/45",
};

/**
 * The transient weight the rival columns borrow before the extinction.
 *
 * Deliberately not one of the four states: it claims nothing. A cell
 * wearing it is already showing the wrench and already announcing "you
 * build it" to a screen reader — only its weight is borrowed, and it is
 * handed back the moment the rule crosses.
 *
 * Expressed as overrides under `data-hold`, so the resting markup is the
 * true state and the borrowed weight only exists while an attribute says so.
 * That attribute is set from JS, on the client, after a measurement — so
 * the server render, a browser that never runs the effect, and a reader
 * who asked for less motion all get the finished grid and none of the
 * theatre.
 */
const HELD = [
  "group-data-[hold=on]/board:border-[var(--cover-paper)]/45",
  "group-data-[hold=on]/board:bg-[var(--cover-paper)]/12",
  "group-data-[hold=on]/board:text-[var(--cover-paper)]/90",
].join(" ");

/**
 * Column geometry, hoisted once. The colgroup, the tint band behind our
 * column and the two vertical rules all read it, so the rules cannot drift
 * off the column they are supposed to be drawing.
 */
const LABEL_COL = 20;
const RIVAL_COL = (100 - LABEL_COL) / RIVALS.length;
const OURS_AT = Math.max(
  0,
  RIVALS.findIndex((r) => r.ours),
);
const COLS = {
  label: `${LABEL_COL}%`,
  rival: `${RIVAL_COL}%`,
  oursLeft: `${LABEL_COL + OURS_AT * RIVAL_COL}%`,
  oursRight: `${LABEL_COL + (OURS_AT + 1) * RIVAL_COL}%`,
};

/**
 * The page's one easing curve, spelled for CSS. Derived from EASE rather
 * than retyped, because a second curve is the thing this page is not
 * allowed to grow.
 */
const EASE_CSS = `cubic-bezier(${EASE.join(",")})`;

const GROUPS = [
  { id: "stack" as const, label: "The voice stack", note: "A solved, competitive market" },
  { id: "business" as const, label: "Your business", note: "Not a market — work" },
];

/** Rows per group, resolved once. `business` also indexes the cascade. */
const ROWS = {
  stack: STACK.filter((l) => l.group === "stack"),
  business: STACK.filter((l) => l.group === "business"),
};

/**
 * What each vendor leaves you, counted from the same data the marks are
 * drawn from — never a hand-typed figure that can drift from the grid
 * above it. Two numbers, because work and a signup are not the same debt.
 */
const LEDGER = RIVALS.map((r) => ({
  build: STACK.filter((l) => r.parts[l.id] === "build").length,
  byo: STACK.filter((l) => r.parts[l.id] === "byo").length,
}));

function Mark({
  state,
  holdable,
  delay,
}: {
  state: PartState;
  /** One of the rival cells that goes out below the second rule. */
  holdable: boolean;
  delay: number;
}) {
  const Icon = ICONS[state];
  return (
    <span
      title={PART_STATES[state].label}
      // The cascade. Inline, and therefore unconditional — a class cannot
      // beat an inline style, so the delay applies to the borrow as well
      // as to the extinction. Which is fine: the board only ever arms
      // while the second rule is still below the fold, so every cell that
      // borrows weight does it off-screen.
      style={{
        transitionTimingFunction: EASE_CSS,
        transitionDelay: `${delay}s`,
      }}
      className={cn(
        "grid size-[1.9em] place-items-center rounded-[0.4em] border transition-colors duration-500",
        TONE[state],
        holdable && HELD,
      )}
    >
      <Icon className="size-[0.95em]" strokeWidth={2.4} aria-hidden />
    </span>
  );
}

export function Comparison() {
  const reduce = useReducedMotion();

  /**
   * The extinction, and it is the whole section.
   *
   * One attribute on the board, flipped twice and never through React
   * state: the cells' held weight and the two vertical rules are both
   * plain CSS transitions keyed off `data-hold`, so the sixty marks change
   * together on the compositor instead of through sixty re-renders, and
   * the resting markup — the one the server sends — is already the truth.
   *
   * Nothing here starts from zero opacity, and the rule that forbids it
   * is the reason the whole thing is built inside out. These rows are the
   * section; anything that starts invisible stays invisible if the
   * animation never runs — which is what a backgrounded tab does to rAF,
   * and what a failed hydration does to everything. So the animated state
   * is the *borrowed* one and the resting state is the finished grid,
   * rather than the other way round.
   *
   * Armed, not merely mounted, and the difference is the degradation
   * story. We borrow the lit weight only after measuring that the second
   * rule is still below the fold: lighting the rival columns up under a
   * reader who has already scrolled to them would play the argument
   * backwards. No JS, no measurement, no borrow. Reduced motion returns
   * before the measurement and the grid is simply finished.
   *
   * The trigger is the second rule itself, because the rule is the claim.
   * `-40%` on both edges narrows the observer's band to a strip across the
   * middle of the viewport, so the columns go out under the reader's eye
   * rather than somewhere off the bottom of the screen.
   */
  const boardRef = useRef<HTMLDivElement>(null);
  const ruleRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    if (reduce) return;
    const rule = ruleRef.current;
    const board = boardRef.current;
    if (!rule || !board) return;
    if (rule.getBoundingClientRect().top <= window.innerHeight) return;

    board.dataset.hold = "on";
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        delete board.dataset.hold;
        io.disconnect();
      },
      { rootMargin: "-40% 0px -40% 0px" },
    );
    io.observe(rule);
    return () => io.disconnect();
  }, [reduce]);

  /**
   * Cross-highlight. Six columns by twelve rows is exactly the size at
   * which the eye loses the row on its way across, and the cells already
   * carried `transition-colors` for a hover nothing ever triggered. A
   * pointer aid only: nothing here is focusable, and nothing is conveyed
   * by it that the row and column headers do not already say.
   */
  const [at, setAt] = useState<{ row: string; col: number } | null>(null);
  const rowLit = (row: string) => at?.row === row;
  const colLit = (col: number) => at?.col === col;

  return (
    <section
      id="difference"
      className="relative scroll-mt-24 px-[1.6em] py-[6em] md:py-[8em]"
    >
      <div className="relative mx-auto max-w-[76em]">
        {/* masthead */}
        <Reveal>
          <span className="mono flex items-center gap-[0.8em] text-[0.7em] uppercase leading-none tracking-[0.24em] text-[var(--cover-paper)]/45">
            <CornerDot className="size-[0.55em] shrink-0" />
            {SECTION_N}
            <span>{COMPARISON_INTRO.eyebrow}</span>
          </span>
        </Reveal>

        <Reveal delay={0.06} className="mt-[1.1em]">
          <h2 className="text-balance text-[2.8em] font-medium leading-[1.03] tracking-[-0.045em] md:text-[3.4em]">
            {COMPARISON_INTRO.title}
          </h2>
        </Reveal>

        <Reveal
          delay={0.12}
          as="p"
          className="mt-[1.1em] max-w-[44em] text-pretty text-[1.05em] leading-[1.6] text-[var(--cover-paper)]/75"
        >
          {COMPARISON_INTRO.sub}
        </Reveal>

        <div
          aria-hidden
          className="mt-[2.2em] h-px bg-[var(--cover-paper)]/12"
        />

        {/* the board */}
        <Reveal delay={0.08} y={32} className="mt-[2.6em] md:mt-[3.2em]">
          {/* Six columns will not fit a phone, and shrinking them to fit
              would destroy the one thing the grid exists to show. It
              scrolls instead, with a floor wide enough to keep the shape
              intact — and wide enough that on any desktop it never
              scrolls at all. */}
          <div className="overflow-x-auto overscroll-x-contain">
            <div ref={boardRef} className="group/board relative min-w-[68em]">
              {/* Our column's ground: a tint, and two rules that draw down
                  as the rivals go out. Absolutely placed off the same
                  percentages as the colgroup so the rule is one continuous
                  object rather than twelve borders stacked end to end. */}
              <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
                <div
                  className="absolute inset-y-0 bg-[var(--cover-brand-lit)]/[0.05]"
                  style={{ left: COLS.oursLeft, width: COLS.rival }}
                />
              </div>

              <table
                onMouseLeave={() => setAt(null)}
                className="relative z-10 w-full table-fixed border-collapse text-left"
              >
                <caption className="sr-only">
                  Every layer a working phone agent needs, and who supplies
                  it — {RIVALS.map((r) => r.name).join(", ")}.
                </caption>

                <colgroup>
                  <col style={{ width: COLS.label }} />
                  {RIVALS.map((r) => (
                    <col key={r.id} style={{ width: COLS.rival }} />
                  ))}
                </colgroup>

                <thead>
                  <tr className="border-b border-[var(--cover-paper)]/12">
                    <th
                      scope="col"
                      className="align-bottom px-[0.2em] pb-[0.9em] pt-[0.2em] text-left font-normal"
                    >
                      <span className="mono text-[0.6em] uppercase tracking-[0.22em] text-[var(--cover-paper)]/45">
                        What a working phone agent needs
                      </span>
                    </th>

                    {RIVALS.map((r, ci) => (
                      <th
                        key={r.id}
                        scope="col"
                        onMouseEnter={() => setAt({ row: "", col: ci })}
                        className={cn(
                          "align-bottom px-[0.6em] pb-[0.9em] pt-[0.2em] text-left font-normal transition-colors duration-300",
                          colLit(ci) && "bg-[var(--cover-paper)]/[0.05]",
                        )}
                      >
                        <span
                          className={cn(
                            "block text-center text-[0.92em] leading-tight",
                            r.ours
                              ? "font-medium text-[var(--cover-brand-lit)]"
                              : "text-[var(--cover-paper)]/90",
                          )}
                        >
                          {r.name}
                        </span>
                        <span className="mono mt-[0.5em] block text-center text-[0.55em] uppercase leading-[1.45] tracking-[0.12em] text-[var(--cover-paper)]/45">
                          {r.kind}
                        </span>
                        {/* The fairness device, in the vendor's own words,
                            directly above its own column. No
                            time-to-first-call clause: `live` was a figure
                            nobody outside this file could check, and a
                            claim about somebody else's speed is the one
                            cell in a comparison a reader is right to
                            distrust. */}
                        <span className="mt-[0.9em] block text-[0.62em] leading-[1.45] text-[var(--cover-paper)]/75">
                          For {r.who.toLowerCase()}.
                        </span>
                        <span className="mt-[0.4em] block text-[0.62em] leading-[1.45] text-[var(--cover-paper)]/75">
                          {r.billing}.
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>

                {GROUPS.map((g) => (
                  <tbody key={g.id}>
                    {/* The rule. Below the second one, four of the five
                        columns go dark all the way down. */}
                    <tr
                      ref={g.id === "business" ? ruleRef : undefined}
                      className="border-y border-[var(--cover-paper)]/12 bg-[var(--cover-paper)]/[0.03]"
                    >
                      <th
                        scope="rowgroup"
                        colSpan={RIVALS.length + 1}
                        className="px-[0.2em] py-[0.7em] text-left font-normal"
                      >
                        {/* Two mono labels on one baseline ran together
                            into a single unreadable string — the tracking
                            that makes them read as rules is the same
                            tracking that swallows a plain gap. Hence the
                            divider, which travels with the note so a wrap
                            breaks before it rather than leaving it
                            dangling off the first line. */}
                        <span className="flex flex-wrap items-baseline gap-x-[0.2em]">
                          <span className="mono text-[0.6em] uppercase tracking-[0.22em] text-[var(--cover-brand-lit)]/80">
                            {g.label}
                          </span>
                          <span className="mono text-[0.55em] uppercase tracking-[0.14em] text-[var(--cover-paper)]/45">
                            <span aria-hidden className="mr-[0.9em] opacity-60">
                              /
                            </span>
                            {g.note}
                          </span>
                        </span>
                      </th>
                    </tr>

                    {ROWS[g.id].map((l, i) => (
                      <tr
                        key={l.id}
                        className={cn(
                          "border-b border-[var(--cover-paper)]/[0.06] transition-colors duration-300 last:border-b-0",
                          rowLit(l.id) && "bg-[var(--cover-paper)]/[0.04]",
                        )}
                      >
                        <th
                          scope="row"
                          onMouseEnter={() => setAt({ row: l.id, col: -1 })}
                          className="px-[0.2em] py-[0.55em] text-left align-middle font-normal"
                        >
                          <span className="flex items-start gap-[0.8em]">
                            <span className="mono shrink-0 pt-[0.15em] text-[0.6em] tracking-[0.1em] text-[var(--cover-paper)]/45">
                              {l.n}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-[0.88em] leading-tight text-[var(--cover-paper)]/95">
                                {l.label}
                              </span>
                              <span className="mt-[0.3em] block text-[0.72em] leading-[1.35] text-[var(--cover-paper)]/75">
                                {l.note}
                              </span>
                            </span>
                          </span>
                        </th>

                        {RIVALS.map((r, ci) => {
                          const state = r.parts[l.id];
                          // Only the rivals' business half ever holds.
                          // Ours never dims, and the voice stack above the
                          // rule is true for everyone from first paint.
                          const holdable = g.id === "business" && !r.ours;
                          return (
                            <td
                              key={r.id}
                              onMouseEnter={() => setAt({ row: l.id, col: ci })}
                              className={cn(
                                "px-[0.4em] py-[0.55em] text-center transition-colors duration-300",
                                colLit(ci) && "bg-[var(--cover-paper)]/[0.05]",
                              )}
                            >
                              <span className="inline-grid place-items-center">
                                <Mark
                                  state={state}
                                  holdable={holdable}
                                  delay={i * 0.06}
                                />
                                <span className="sr-only">
                                  {PART_STATES[state].label}
                                </span>
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                ))}

                <tfoot className="border-t border-[var(--cover-paper)]/12">
                  <tr>
                    <th
                      scope="row"
                      className="px-[0.2em] py-[1.1em] text-left align-top font-normal"
                    >
                      <span className="mono text-[0.6em] uppercase tracking-[0.22em] text-[var(--cover-paper)]/45">
                        Left on your desk
                      </span>
                    </th>

                    {RIVALS.map((r, ci) => {
                      const { build, byo } = LEDGER[ci];
                      return (
                        <td
                          key={r.id}
                          onMouseEnter={() => setAt({ row: "", col: ci })}
                          className={cn(
                            "px-[0.5em] py-[1.1em] text-center align-top transition-colors duration-300",
                            colLit(ci) && "bg-[var(--cover-paper)]/[0.05]",
                          )}
                        >
                          <p
                            className={cn(
                              "mono text-[1.9em] leading-none tabular-nums",
                              build === 0
                                ? "text-[var(--cover-brand-lit)]"
                                : "text-[var(--cover-paper)]/90",
                            )}
                          >
                            <CountUp to={build} duration={0.9} />
                          </p>
                          <p className="mono mt-[0.6em] text-[0.55em] uppercase leading-[1.5] tracking-[0.12em] text-[var(--cover-paper)]/45">
                            {build === 0
                              ? "nothing"
                              : `to build, of ${STACK.length}`}
                          </p>
                          {/* Counted apart, never added in. An account you
                              open is a different debt from a layer you
                              write, and summing them flatters us at the
                              expense of being true. */}
                          {byo > 0 && (
                            <p className="mono mt-[0.5em] text-[0.55em] uppercase leading-[1.5] tracking-[0.12em] text-[var(--cover-paper)]/45">
                              + {byo} on your own account
                            </p>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>

              {/* Above the table, so the rule reads as one unbroken object
                  rather than as something the row hairlines cut through. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 z-20"
              >
                {([COLS.oursLeft, COLS.oursRight] as const).map((left) => (
                  <div
                    key={left}
                    // The resting state is DRAWN, and collapsing it is
                    // instant because that only ever happens off-screen at
                    // arm time. One element per edge, full table height:
                    // the rule has to draw down as a single object, which
                    // twelve stacked cell borders cannot do.
                    className="absolute inset-y-0 w-px origin-top scale-y-100 bg-[var(--cover-brand-lit)]/35 transition-transform duration-[900ms] group-data-[hold=on]/board:scale-y-0 group-data-[hold=on]/board:duration-0"
                    style={{ left, transitionTimingFunction: EASE_CSS }}
                  />
                ))}
              </div>
            </div>
          </div>
        </Reveal>

        {/* the legend — four states, spelled out */}
        <div className="mt-[1.4em] flex flex-wrap gap-x-[1.6em] gap-y-[0.6em] border-t border-[var(--cover-paper)]/12 pt-[1em]">
          {(["shipped", "metered", "byo", "build"] as PartState[]).map((s) => {
            const Icon = ICONS[s];
            return (
              <span
                key={s}
                className="flex items-center gap-[0.5em] text-[0.72em] leading-none"
              >
                <span
                  className={cn(
                    "grid size-[1.5em] shrink-0 place-items-center rounded-[0.3em] border",
                    TONE[s],
                  )}
                >
                  <Icon className="size-[0.85em]" strokeWidth={2.4} aria-hidden />
                </span>
                <span className="text-[var(--cover-paper)]/90">
                  {PART_STATES[s].label}
                </span>
                <span className="hidden text-[var(--cover-paper)]/45 sm:inline">
                  — {PART_STATES[s].note}
                </span>
              </span>
            );
          })}
        </div>

        {/* the concession, and the receipts */}
        <div className="mt-[1.6em] border-t border-[var(--cover-paper)]/12 pt-[1.4em]">
          <p className="max-w-[52em] text-[0.82em] leading-[1.65] text-[var(--cover-paper)]/75">
            {COMPARISON_NOTE}
          </p>
          <p className="mt-[0.9em] max-w-[52em] text-[0.68em] leading-[1.6] text-[var(--cover-paper)]/45">
            {COMPARISON_SOURCE}
          </p>
        </div>
      </div>
    </section>
  );
}
