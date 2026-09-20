"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { holdFor, useInView, usePrefersReducedMotion } from "./product/timing";

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
 *  · **It is a real `<table>`.** `<th scope>` on the vendors and on the
 *    layers turns each of the fifty marks into "Vapi, reasoning, your
 *    account" rather than a context-free string. The grid was never
 *    decoration; it was tabular data pretending not to be.
 *  · **No panel.** The board sits on the open field and is grouped by
 *    hairlines and space, not by a bordered card. On white a card inside a
 *    white page is a second white page, and the page already has one.
 *  · **Who each vendor is for lives in its own column header**, directly
 *    above the marks a sceptic distrusts, rather than two hundred pixels
 *    below the column it describes.
 *  · **The count is split.** Work and a signup are different debts, and a
 *    comparison that adds them together to make a rival's number bigger is
 *    exactly what the source note at the bottom promises we did not do.
 *
 * **THE SCENE: the audit runs itself.**
 *
 * This section used to move because the reader scrolled — an entrance, a
 * count-up, a cascade tied to a scroll position. Scrolling is not an
 * argument. So the board now *performs the count* instead: a reading head
 * walks the bill of materials from layer 01 to layer 10 on the house clock
 * (`holdFor`, floored at 1.4s a layer), gated by `useInView` so it never
 * runs off screen, and three things follow it down the page.
 *
 *   · The row under the head is lit, the way it lights under a pointer —
 *     the scene drives the reader's own instrument, not a second one.
 *   · Every rival cell *below* the head still wears borrowed weight; the
 *     moment the head reads its row, the four rival columns hand that
 *     weight back and go pale, one layer at a time, while ours holds. The
 *     extinction is now paced by the audit rather than by a scroll
 *     position, which is what makes it read as a finding instead of a
 *     transition.
 *   · The ledger at the foot counts what has actually been read. It is not
 *     a number animating to a target; it is a tally incrementing because a
 *     layer just landed on somebody's desk. The label and the colour come
 *     from the final figure, so nothing ever claims "nothing" mid-count.
 *   · Our column's two vertical rules draw down with the head, as one
 *     object, so the column that keeps going visibly keeps going.
 *
 * The movement is CSS throughout — `transition-colors`, `transition-transform`,
 * house durations. React only changes which layer has been read.
 *
 * **The resting markup is the finished board**, and that is load-bearing.
 * The server sends a fully read grid: true tones, full rules, final tally.
 * The scene only rewinds to zero once it has armed on the client, in view,
 * with motion allowed. No JS, a dead effect, or `prefers-reduced-motion`
 * and the reader simply gets the answer.
 *
 * **The reader's first touch ends it for good.** Any pointer, focus or key
 * event on the board stops the clock, finishes the audit instantly, and
 * hands the cross-highlight back to the pointer permanently.
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
 * extinction be honest — the wrench is in the cell from the first paint,
 * and only the weight moves.
 *
 * `build` is the palest mark on the board and it still has a floor. `#8d8899`
 * is 3.4:1 on white and 3.2:1 on the group band, which is the bar for a
 * graphic; the reader is meant to see that something is there and that it
 * is not filled, not to wonder whether the cell is empty.
 */
const TONE: Record<PartState, string> = {
  shipped: "border-pp-accent bg-pp-accent text-white",
  metered: "border-pp-accent/40 bg-pp-accent/10 text-pp-accent",
  byo: "border-dashed border-pp-muted/60 text-pp-muted",
  build: "border-pp-hair text-[#8d8899]",
};

/**
 * The weight a rival cell wears until the head has read its layer.
 *
 * Deliberately not one of the four states: it claims nothing. A cell
 * wearing it is already showing the wrench and already announcing "you
 * build it" to a screen reader — only its weight is borrowed, and it is
 * handed back the instant the audit reaches that row.
 *
 * On white it is the *heaviest* tone in play rather than the brightest
 * one: ink glyph, ink hairline, a grey ground. Draining that to `build`'s
 * bare outline is a loss of weight the eye reads as a column going out.
 */
const HELD = "border-pp-ink/25 bg-pp-ink/[0.06] text-pp-ink";

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

/** Rows per group, resolved once. */
const ROWS = {
  stack: STACK.filter((l) => l.group === "stack"),
  business: STACK.filter((l) => l.group === "business"),
};

/** The order the head reads in: the voice stack first, then the work. */
const SEQ = [...ROWS.stack, ...ROWS.business];
const SEQ_AT = new Map(SEQ.map((l, i) => [l.id, i]));

/**
 * What each vendor leaves you after the first `k` layers have been read —
 * counted from the same data the marks are drawn from, never a hand-typed
 * figure that can drift from the grid above it. Index 0 is an unstarted
 * audit; the last entry is the truth, and the truth is what the server
 * renders. Two numbers, because work and a signup are not the same debt.
 */
const LEDGER_AT = RIVALS.map((r) =>
  SEQ.reduce(
    (acc, l) => {
      const prev = acc[acc.length - 1];
      const state = r.parts[l.id];
      acc.push({
        build: prev.build + (state === "build" ? 1 : 0),
        byo: prev.byo + (state === "byo" ? 1 : 0),
      });
      return acc;
    },
    [{ build: 0, byo: 0 }],
  ),
);
const LEDGER = LEDGER_AT.map((steps) => steps[steps.length - 1]);

function Mark({
  state,
  held,
  size = "md",
}: {
  state: PartState;
  /** A rival's business-half cell the head has not reached yet. */
  held?: boolean;
  size?: "md" | "sm";
}) {
  const Icon = ICONS[state];
  return (
    <span
      title={PART_STATES[state].label}
      className={cn(
        "grid place-items-center border transition-colors duration-500",
        size === "md" ? "size-7 rounded-[9px]" : "size-5 rounded-[7px]",
        TONE[state],
        held && HELD,
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
  const reduce = usePrefersReducedMotion();
  const boardRef = useRef<HTMLDivElement>(null);
  const inView = useInView(boardRef, "-10% 0px -10% 0px");

  /**
   * The audit. `head` is how many layers have been read: `SEQ.length` is a
   * finished board, and that is where it rests — on the server, before the
   * scene arms, and forever after the reader touches it.
   */
  const [head, setHead] = useState(SEQ.length);
  const [taken, setTaken] = useState(false);
  const armed = useRef(false);
  const running = head < SEQ.length;

  /** Rewind once, the first time the board is on screen and allowed to move. */
  useEffect(() => {
    if (reduce || taken || !inView || armed.current) return;
    armed.current = true;
    setHead(0);
  }, [reduce, taken, inView]);

  /**
   * One layer at a time, at reading pace. The timer only exists while the
   * board is on screen and untouched, so scrolling away pauses the audit
   * where it stands and unmounting or a first touch clears it outright.
   */
  useEffect(() => {
    if (reduce || taken || !inView || !armed.current || !running) return;
    const t = window.setTimeout(
      () => setHead((h) => Math.min(SEQ.length, h + 1)),
      holdFor(SEQ[head].label),
    );
    return () => window.clearTimeout(t);
  }, [reduce, taken, inView, running, head]);

  /**
   * Cross-highlight, and the handover. Six columns by twelve rows is
   * exactly the size at which the eye loses the row on its way across. The
   * audit lights the row it is reading; the reader's first pointer, focus
   * or key event finishes the audit on the spot and takes the highlight
   * over for the rest of the page's life.
   */
  const [at, setAt] = useState<{ row: string; col: number } | null>(null);
  const take = () => {
    if (taken) return;
    setTaken(true);
    setHead(SEQ.length);
  };
  const autoRow = !taken && running && head > 0 ? SEQ[head - 1].id : null;
  const rowLit = (row: string) => at?.row === row || autoRow === row;
  const colLit = (col: number) => at?.col === col;

  /** The head's position, for our column's two rules. */
  const drawn = useMemo(() => head / SEQ.length, [head]);

  return (
    <Frame
      as="section"
      id="difference"
      className="scroll-mt-28 px-6 py-16 md:px-12 md:py-24"
    >
      {/* masthead — the shared opener, so this section is introduced the
          same way every other page on the site introduces one. */}
      <SectionHeading eyebrow={COMPARISON_INTRO.eyebrow} className="max-w-[860px]">
        {COMPARISON_INTRO.title}
      </SectionHeading>

      <p className="mt-5 max-w-[680px] text-[17px] leading-[26px] text-pretty text-pp-muted md:text-[18px] md:leading-[28px]">
        {COMPARISON_INTRO.sub}
      </p>

      <div aria-hidden className="mt-10 h-px bg-pp-rule" />

      {/* the board */}
      <div className="mt-10 md:mt-12">
        {/* Six columns will not fit a phone, and shrinking them to fit
            would destroy the one thing the grid exists to show. It
            scrolls instead, with a floor wide enough to keep the shape
            intact — and narrow enough that inside the 1176px column it
            never scrolls on a desktop at all. */}
        <div className="overflow-x-auto overscroll-x-contain">
          <div
            ref={boardRef}
            // The handover, captured at the top of the board so every
            // control inside it — hover, focus, keyboard — ends the audit
            // on its first event and keeps it ended.
            onPointerDownCapture={take}
            onPointerMoveCapture={take}
            onFocusCapture={take}
            onKeyDownCapture={take}
            className="relative min-w-[980px]"
          >
            {/* Our column's ground: a violet tint, and two rules that draw
                down with the head. Absolutely placed off the same
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
                      columns go pale all the way down — layer by layer,
                      as the head reads them. */}
                  <tr className={cn("border-y border-pp-rule", BAND)}>
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

                  {ROWS[g.id].map((l) => {
                    const seq = SEQ_AT.get(l.id) ?? 0;
                    const read = seq < head;
                    return (
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
                            <span
                              className={cn(
                                "shrink-0 pt-px text-[11px] leading-5 tracking-[0.08em] tabular-nums transition-colors duration-300",
                                autoRow === l.id ? "text-pp-accent" : "text-pp-muted",
                              )}
                            >
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
                          // Ours never drains, and the voice stack above
                          // the rule is true for everyone from first paint.
                          const held = g.id === "business" && !r.ours && !read;
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
                                <Mark state={state} held={held} />
                                <span className="sr-only">
                                  {PART_STATES[state].label}
                                </span>
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
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
                    // The tally so far, but the wording and the colour
                    // come from the final figure: a column mid-count must
                    // never be allowed to say "nothing" and mean it.
                    const sofar = LEDGER_AT[ci][head];
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
                          {sofar.build}
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
                            + {sofar.byo} on your own account
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
                  // Drawn to the head, as one object down the full table
                  // height — twelve stacked cell borders cannot do that.
                  // Rests fully drawn, which is what the server sends.
                  className="absolute inset-y-0 w-px origin-top bg-pp-accent/40 transition-transform duration-500"
                  style={{ left, transform: `scaleY(${drawn})` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

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
