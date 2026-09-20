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
import { Frame, SectionHeading } from "./product/primitives";
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
 * **It is set in the light `pp` system, not the cover's dark one.** This
 * page is the front door to twenty-one routes that are all white stock,
 * black ink and one violet, and a table drawn in a second palette reads as
 * a different company's table — which is the last thing a comparison can
 * afford. So the surfaces are white, the rules are pp hairlines, the
 * masthead is the shared `SectionHeading`, and every length is rem or px.
 * The cover's fluid `em` base does not exist under `.pp`; a `1.9em` mark
 * here would size off whatever text happened to be above it.
 *
 * Decisions worth keeping, and the ones that replaced the panel:
 *
 *  · **The rule across the middle is the whole argument.** The first five
 *    layers are a voice stack: a solved, competitive, genuinely excellent
 *    market. The last five are one specific business's operations, which
 *    is not a market at all — it is work. Every platform goes pale below
 *    that rule, and that is not a failing on their part. The bottom half
 *    was never what they sold.
 *  · **It is complimentary on purpose, and that is what makes it land.**
 *    Every descriptor is taken from the vendor's own positioning, the note
 *    at the bottom says plainly that these are good products, and the
 *    footer dates the reading and invites correction. A comparison that
 *    sneers reads as a comparison that is lying; one that concedes the
 *    other side's strength reads as one that has counted honestly. We only
 *    need the reader to count the bottom five rows.
 *  · **It is a real `<table>`.** It used to be fifty divs, each with a
 *    bare `sr-only` state label inside it, which a screen reader announces
 *    as fifty context-free strings — "shipped working, you build it, you
 *    build it" with no way to know whose column or which layer. `<th
 *    scope>` on the vendors and on the layers turns each of those fifty
 *    into "Vapi, reasoning, your account". The grid was never decoration;
 *    it was tabular data pretending not to be.
 *  · **No panel.** The board sits on the open field and is grouped by
 *    hairlines and space, not by a bordered card. On white that matters
 *    more than it did on ink: a card inside a white page is a second white
 *    page, and the page already has one. The absence also flatters
 *    nothing — a scroller on the open field has to earn its width, and
 *    that pressure is what forced the vendor prose into the header where
 *    it belongs.
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
 * of it). Every rival's five business-half cells hold at full ink until
 * the second group rule crosses the middle of the viewport, then drain to
 * their true tone on a cascade down each column, four columns fading in
 * parallel while ours holds and its vertical rules draw down as one
 * object. **On white the extinction runs the other way round from the
 * cover's**: there is no lit fill to put out, so the held state is the
 * heaviest thing on the board — inked glyph, grey ground, solid edge — and
 * what the rule takes away is weight, leaving four columns of hairline
 * outlines. Nothing glows, nothing darkens; the columns simply go pale.
 */

const ICONS: Record<PartState, typeof Check> = {
  shipped: Check,
  metered: Coins,
  byo: KeyRound,
  build: Wrench,
};

/**
 * One ramp, from in-the-box to on-your-desk, drawn for white stock.
 *
 * Every state carries an icon as well as a tone, and not as decoration:
 * encoded in colour alone this grid would be unreadable to anyone who
 * cannot separate the filled mark from the outlined one, which is the
 * single most common way a chart like this fails. It is also what lets the
 * extinction below be honest — the wrench is in the cell from the first
 * paint, and only the weight moves.
 *
 * `build` is the palest mark on the board and it still has a floor. `#8d8899`
 * is 3.4:1 on white and 3.2:1 on the group band, which is the bar for a
 * graphic; the reader is meant to see that something is there and that it
 * is not filled, not to wonder whether the cell is empty. Anything lighter
 * and the bottom half of the table stops being data and becomes a texture.
 */
const TONE: Record<PartState, string> = {
  shipped: "border-pp-accent bg-pp-accent text-white",
  metered: "border-pp-accent/40 bg-pp-accent/10 text-pp-accent",
  byo: "border-dashed border-pp-muted/60 text-pp-muted",
  build: "border-pp-hair text-[#8d8899]",
};

/**
 * The transient weight the rival columns borrow before the extinction.
 *
 * Deliberately not one of the four states: it claims nothing. A cell
 * wearing it is already showing the wrench and already announcing "you
 * build it" to a screen reader — only its weight is borrowed, and it is
 * handed back the moment the rule crosses.
 *
 * On white it is the *heaviest* tone in play rather than the brightest
 * one: ink glyph, ink hairline, a grey ground. Draining that to `build`'s
 * bare outline is a loss of weight the eye reads as a column going out,
 * where the cover's version read as a light being switched off. Glow would
 * have been the literal translation and it would have looked like dirt.
 *
 * Expressed as overrides under `data-hold`, so the resting markup is the
 * true state and the borrowed weight only exists while an attribute says so.
 * That attribute is set from JS, on the client, after a measurement — so
 * the server render, a browser that never runs the effect, and a reader
 * who asked for less motion all get the finished grid and none of the
 * theatre.
 */
const HELD = [
  "group-data-[hold=on]/board:border-pp-ink/25",
  "group-data-[hold=on]/board:bg-pp-ink/[0.06]",
  "group-data-[hold=on]/board:text-pp-ink",
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

/**
 * The cross-highlight wash, and the group band.
 *
 * Both are translucent ink rather than `bg-pp-card`, and that is
 * load-bearing: our column's violet ground is painted *under* the table,
 * so an opaque grey cell would erase the one piece of colour the board
 * has. Tinting instead lets the violet read through every band and every
 * lit row.
 */
const LIT_COL = "bg-[rgb(24_16_40/0.045)]";
const LIT_ROW = "bg-[rgb(24_16_40/0.03)]";
const BAND = "bg-[rgb(24_16_40/0.035)]";

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
  size = "md",
}: {
  state: PartState;
  /** One of the rival cells that drains below the second rule. */
  holdable?: boolean;
  delay?: number;
  size?: "md" | "sm";
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
      style={
        delay === undefined
          ? undefined
          : { transitionTimingFunction: EASE_CSS, transitionDelay: `${delay}s` }
      }
      className={cn(
        "grid place-items-center border transition-colors duration-500",
        size === "md" ? "size-7 rounded-[9px]" : "size-5 rounded-[7px]",
        TONE[state],
        holdable && HELD,
      )}
    >
      <Icon
        className={size === "md" ? "size-3.5" : "size-2.5"}
        strokeWidth={2.2}
        aria-hidden
      />
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
   * story. We borrow the heavy weight only after measuring that the second
   * rule is still below the fold: inking the rival columns up under a
   * reader who has already scrolled to them would play the argument
   * backwards. No JS, no measurement, no borrow. Reduced motion returns
   * before the measurement and the grid is simply finished.
   *
   * The trigger is the second rule itself, because the rule is the claim.
   * `-40%` on both edges narrows the observer's band to a strip across the
   * middle of the viewport, so the columns go pale under the reader's eye
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
    <Frame
      as="section"
      id="difference"
      className="scroll-mt-28 px-6 py-16 md:px-12 md:py-24"
    >
      {/* masthead — the shared opener, so this section is introduced the
          same way every other page on the site introduces one. */}
      <Reveal>
        <SectionHeading eyebrow={COMPARISON_INTRO.eyebrow} className="max-w-[860px]">
          {COMPARISON_INTRO.title}
        </SectionHeading>
      </Reveal>

      <Reveal
        delay={0.08}
        as="p"
        className="mt-5 max-w-[680px] text-[17px] leading-[26px] text-pretty text-pp-muted md:text-[18px] md:leading-[28px]"
      >
        {COMPARISON_INTRO.sub}
      </Reveal>

      <div aria-hidden className="mt-10 h-px bg-pp-rule" />

      {/* the board */}
      <Reveal delay={0.06} y={24} className="mt-10 md:mt-12">
        {/* Six columns will not fit a phone, and shrinking them to fit
            would destroy the one thing the grid exists to show. It
            scrolls instead, with a floor wide enough to keep the shape
            intact — and narrow enough that inside the 1176px column it
            never scrolls on a desktop at all. */}
        <div className="overflow-x-auto overscroll-x-contain">
          <div ref={boardRef} className="group/board relative min-w-[980px]">
            {/* Our column's ground: a violet tint, and two rules that draw
                down as the rivals drain. Absolutely placed off the same
                percentages as the colgroup so the rule is one continuous
                object rather than twelve borders stacked end to end. */}
            <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
              <div
                className="absolute inset-y-0 bg-pp-accent/[0.05]"
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
                <tr className="border-b border-pp-hair">
                  <th
                    scope="col"
                    className="px-1 pt-1 pb-4 text-left align-bottom font-normal"
                  >
                    <span className="block text-[11px] leading-4 font-medium tracking-[0.14em] text-pp-muted uppercase">
                      What a working phone agent needs
                    </span>
                  </th>

                  {RIVALS.map((r, ci) => (
                    <th
                      key={r.id}
                      scope="col"
                      onMouseEnter={() => setAt({ row: "", col: ci })}
                      className={cn(
                        "px-3 pt-1 pb-4 text-left align-bottom font-normal transition-colors duration-300",
                        colLit(ci) && LIT_COL,
                      )}
                    >
                      <span
                        className={cn(
                          "block text-center text-[15px] leading-5 text-balance",
                          r.ours ? "font-medium text-pp-accent" : "text-pp-ink",
                        )}
                      >
                        {r.name}
                      </span>
                      <span className="mt-2 block text-center text-[11px] leading-4 font-medium tracking-[0.1em] text-pp-muted uppercase">
                        {r.kind}
                      </span>
                      {/* The fairness device, in the vendor's own words,
                          directly above its own column. No
                          time-to-first-call clause: `live` was a figure
                          nobody outside this file could check, and a
                          claim about somebody else's speed is the one
                          cell in a comparison a reader is right to
                          distrust. */}
                      <span className="mt-3.5 block text-[12px] leading-[17px] text-pp-muted">
                        For {r.who.toLowerCase()}.
                      </span>
                      <span className="mt-1.5 block text-[12px] leading-[17px] text-pp-muted">
                        {r.billing}.
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>

              {GROUPS.map((g) => (
                <tbody key={g.id}>
                  {/* The rule. Below the second one, four of the five
                      columns go pale all the way down. */}
                  <tr
                    ref={g.id === "business" ? ruleRef : undefined}
                    className={cn("border-y border-pp-rule", BAND)}
                  >
                    <th
                      scope="rowgroup"
                      colSpan={RIVALS.length + 1}
                      className="px-1 py-3 text-left font-normal"
                    >
                      {/* Two tracked labels on one baseline ran together
                          into a single unreadable string — the tracking
                          that makes them read as rules is the same
                          tracking that swallows a plain gap. Hence the
                          divider, which travels with the note so a wrap
                          breaks before it rather than leaving it
                          dangling off the first line. */}
                      <span className="flex flex-wrap items-baseline gap-x-1">
                        <span className="text-[11px] leading-4 font-medium tracking-[0.14em] text-pp-accent uppercase">
                          {g.label}
                        </span>
                        <span className="text-[11px] leading-4 tracking-[0.1em] text-pp-muted uppercase">
                          <span aria-hidden className="mr-3 text-pp-muted/45">
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
                        "border-b border-pp-rule transition-colors duration-300 last:border-b-0",
                        rowLit(l.id) && LIT_ROW,
                      )}
                    >
                      <th
                        scope="row"
                        onMouseEnter={() => setAt({ row: l.id, col: -1 })}
                        className="px-1 py-3 text-left align-middle font-normal"
                      >
                        <span className="flex items-start gap-3">
                          <span className="shrink-0 pt-px text-[11px] leading-5 tracking-[0.08em] text-pp-muted tabular-nums">
                            {l.n}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[15px] leading-5 text-pp-ink">
                              {l.label}
                            </span>
                            <span className="mt-1 block text-[12px] leading-[17px] text-pp-muted">
                              {l.note}
                            </span>
                          </span>
                        </span>
                      </th>

                      {RIVALS.map((r, ci) => {
                        const state = r.parts[l.id];
                        // Only the rivals' business half ever holds.
                        // Ours never drains, and the voice stack above the
                        // rule is true for everyone from first paint.
                        const holdable = g.id === "business" && !r.ours;
                        return (
                          <td
                            key={r.id}
                            onMouseEnter={() => setAt({ row: l.id, col: ci })}
                            className={cn(
                              "px-2 py-3 text-center transition-colors duration-300",
                              colLit(ci) && LIT_COL,
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

              <tfoot className="border-t border-pp-hair">
                <tr>
                  <th
                    scope="row"
                    className="px-1 py-6 text-left align-top font-normal"
                  >
                    <span className="block text-[11px] leading-4 font-medium tracking-[0.14em] text-pp-muted uppercase">
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
                          "px-2 py-6 text-center align-top transition-colors duration-300",
                          colLit(ci) && LIT_COL,
                        )}
                      >
                        <p
                          className={cn(
                            "pp-display text-[34px] leading-none tabular-nums",
                            build === 0 ? "text-pp-accent" : "text-pp-ink",
                          )}
                          // Inline: `.pp-display` sets 360 outside Tailwind's
                          // layers, which would beat a weight utility.
                          style={{ fontWeight: 480 }}
                        >
                          <CountUp to={build} duration={0.9} />
                        </p>
                        <p className="mt-2.5 text-[11px] leading-4 font-medium tracking-[0.1em] text-pp-muted uppercase">
                          {build === 0
                            ? "nothing"
                            : `to build, of ${STACK.length}`}
                        </p>
                        {/* Counted apart, never added in. An account you
                            open is a different debt from a layer you
                            write, and summing them flatters us at the
                            expense of being true. */}
                        {byo > 0 && (
                          <p className="mt-1.5 text-[11px] leading-4 font-medium tracking-[0.1em] text-pp-muted uppercase">
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
                  className="absolute inset-y-0 w-px origin-top scale-y-100 bg-pp-accent/40 transition-transform duration-[900ms] group-data-[hold=on]/board:scale-y-0 group-data-[hold=on]/board:duration-0"
                  style={{ left, transitionTimingFunction: EASE_CSS }}
                />
              ))}
            </div>
          </div>
        </div>
      </Reveal>

      {/* the legend — four states, spelled out */}
      <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3 border-t border-pp-rule pt-5">
        {(["shipped", "metered", "byo", "build"] as PartState[]).map((s) => (
          <span key={s} className="flex items-center gap-2.5 text-[13px] leading-5">
            <Mark state={s} size="sm" />
            <span className="text-pp-ink">{PART_STATES[s].label}</span>
            <span className="hidden text-pp-muted sm:inline">
              — {PART_STATES[s].note}
            </span>
          </span>
        ))}
      </div>

      {/* the concession, and the receipts */}
      <div className="mt-8 border-t border-pp-rule pt-7">
        <p className="max-w-[720px] text-[15px] leading-[24px] text-pp-muted">
          {COMPARISON_NOTE}
        </p>
        <p className="mt-4 max-w-[720px] text-[13px] leading-[21px] text-pp-muted">
          {COMPARISON_SOURCE}
        </p>
      </div>
    </Frame>
  );
}
