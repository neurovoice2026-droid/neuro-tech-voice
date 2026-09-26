"use client";

import { useEffect, useRef, useState } from "react";
import type { gsap } from "gsap";
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
import { useKitContext, useMotionKit } from "./product/motion-kit";
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
 * **THE SIGNATURE MOVEMENT: one column keeps going, and you watch it.**
 *
 * The whole case is a *shape* — four columns that stop halfway down and one
 * that does not — and a shape argued in prose is a shape nobody counts. So
 * the board performs the count, and there is exactly one thing moving while
 * it does: **the audit descending the bill of materials.**
 *
 * It is one GSAP timeline, and it has two hands, which are the two halves
 * of the same sentence:
 *
 *   · **Our column's two edges are DRAWN**, from the top of the board to
 *     the bottom, in one unbroken constant-speed stroke that never pauses
 *     at a layer and never stops early. `DrawSVGPlugin` on two real SVG
 *     strokes, each over its own faint ghost — the route was always there;
 *     the ink is the audit proving it. This is the only thing on the page
 *     that is literally drawn, and it is the only column that keeps going.
 *     A `scaleY` on a div would have said the same thing by stretching,
 *     which is not what a column doing its job looks like.
 *   · **In its wake, the four rival columns hand back borrowed weight.**
 *     Every rival cell in the business half carries a held overlay — ink
 *     glyph, ink hairline, grey ground — over the pale `build` mark that is
 *     the truth underneath. As the audit reads a layer, that row's four
 *     overlays fade out on a 0.06s stagger, left to right, so the loss
 *     sweeps across the board as one finding instead of flipping as four
 *     simultaneous events. Ours has no overlay: there is nothing to hand
 *     back.
 *
 * At the turn — the moment the audit crosses the rule out of the voice
 * stack and into the work — the words **"Not a market — work"** arrive one
 * at a time, `SplitText`, because that clause is the finding and a finding
 * should reach the reader as language rather than as a block that was
 * already there. Until the audit gets there the board does not name the
 * bottom half at all; the rule and the group are drawn, the verdict on them
 * is not yet in. The label on the stack half never moves: the voice stack
 * is not contested, it is true for everyone from the first paint, and
 * animating it too would be decoration wearing the finding's coat.
 *
 * No `MotionPathPlugin` here. Nothing in this section travels a route; it
 * descends a column, and a straight fall dressed up as a path would be a
 * plugin used for the look of it.
 *
 * **The clock is still the house's, and still `holdFor`** — floored at 1.4s
 * a layer, one `tl.call` per layer. React is told only *which layer has
 * been read*, and the three things that follow from that are small state
 * changes the browser tweens, which is what CSS transitions are for: the
 * row under the head lights the way it lights under a pointer, its numeral
 * takes accent, and the ledger at the foot ticks. That tally is not a
 * number animating to a target — it increments because a layer just landed
 * on somebody's desk — and its wording and colour come from the *final*
 * figure, so no column ever claims "nothing" mid-count.
 *
 * **The resting markup is the finished board**, and that is load-bearing.
 * The server sends a fully read grid: true tones, full rules, final tally.
 * GSAP is fetched only when the board comes near, and its first act is to
 * *rewind* that finished board to zero. With `prefers-reduced-motion` the
 * kit is never fetched at all, so there is nothing to serve a still state
 * to — the still state is the markup. No JS, a dead effect, a failed import
 * and the reader simply gets the answer.
 *
 * **The reader's first touch ends it for good.** Any pointer, focus or key
 * event on the board runs the timeline to its end on the spot, stops the
 * clock, and hands the cross-highlight back to the pointer permanently.
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
 * The weight a rival cell wears until the audit has read its layer.
 *
 * Deliberately not one of the four states: it claims nothing. It is drawn
 * as a separate mark laid *over* the true one, `aria-hidden` and resting at
 * `opacity: 0`, so the cell underneath is showing the wrench and announcing
 * "you build it" to a screen reader from the first paint. Only the weight
 * is borrowed, and GSAP fades it off the instant the audit reaches that row.
 *
 * An overlay rather than a colour tween, and that is deliberate too: the
 * only property the timeline touches is opacity on an element React never
 * restyles, so the context can revert to the finished board exactly, with
 * no computed colours to read back and nothing to clear.
 *
 * On white it is the *heaviest* tone in play rather than the brightest one:
 * ink glyph, ink hairline, a grey ground. Losing it down to `build`'s bare
 * outline is a loss of weight the eye reads as a column going out.
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
  drain,
  size = "md",
}: {
  state: PartState;
  /**
   * The classes the timeline finds this cell's held overlay by, for a
   * rival's business-half cell. Absent everywhere else — our column has
   * nothing to hand back, and the voice stack above the rule is true for
   * everyone from the first paint.
   */
  drain?: string;
  size?: "md" | "sm";
}) {
  const Icon = ICONS[state];
  const box = size === "md" ? "size-7 rounded-[9px]" : "size-5 rounded-[7px]";
  const glyph = size === "md" ? "size-3.5" : "size-2.5";
  return (
    <span className="relative grid place-items-center">
      <span
        title={PART_STATES[state].label}
        className={cn("grid place-items-center border", box, TONE[state])}
      >
        <Icon className={glyph} strokeWidth={2.2} aria-hidden />
      </span>
      {drain && (
        // Rests invisible, which is the finished board. GSAP raises it when
        // it rewinds and takes it off again as the audit passes. Inline,
        // because opacity is the one property the timeline writes here and
        // a utility class would fight it.
        <span
          aria-hidden
          style={{ opacity: 0 }}
          className={cn(
            drain,
            "pointer-events-none absolute inset-0 grid place-items-center border",
            box,
            HELD,
          )}
        >
          <Icon className={glyph} strokeWidth={2.2} aria-hidden />
        </span>
      )}
    </span>
  );
}

/** A beat, in seconds: the house clock, floored at 1.4s a layer. */
const BEATS = SEQ.map((l) => holdFor(l.label) / 1000);
/** A breath before the first layer, so the board is seen before it is read. */
const LEAD = 0.35;
/** When the audit lands on each layer, and when it has finished. */
const AT = BEATS.reduce<number[]>((acc, b) => [...acc, acc[acc.length - 1] + b], [LEAD]);
const RUN = AT[AT.length - 1];
/** The turn: the first layer below the rule, where the voice stack ends. */
const TURN_AT = AT[SEQ.findIndex((l) => l.group === "business")];

export function Comparison() {
  const boardRef = useRef<HTMLDivElement>(null);
  // Two margins, two jobs: `near` fetches GSAP, `inView` plays the audit.
  const inView = useInView(boardRef, "-10% 0px -10% 0px");
  const near = useInView(boardRef, "25% 0px");
  const reduce = usePrefersReducedMotion();
  // `near && !reduce`, not `near`: the markup already rests on the finished
  // board, so with reduced motion GSAP is never downloaded at all and there
  // is no still state left for it to set.
  const kit = useMotionKit(near && !reduce);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  /**
   * The audit. `head` is how many layers have been read: `SEQ.length` is a
   * finished board, and that is where it rests — on the server, before the
   * timeline rewinds it, and forever after the reader touches it. The
   * timeline owns it; React only renders it.
   */
  const [beat, setBeat] = useState(SEQ.length);
  const [taken, setTaken] = useState(false);
  // Derived, not stored, for the two states that end the audit outright:
  // reduced motion is live and can arrive mid-count, and the reader's first
  // touch is permanent. Neither has a beat to wait for.
  const head = reduce || taken ? SEQ.length : beat;
  const running = head < SEQ.length;

  useKitContext(
    kit,
    ({ gsap, SplitText }) => {
      // A reverted context rests on the finished board, which is exactly
      // what reduced motion should see. Nothing to build.
      if (reduce) return;

      const q = gsap.utils.selector(boardRef);
      const rules = q(".cp-rule");
      const turn = q(".cp-turn")[0] as HTMLElement | undefined;

      // Split for motion only: the words stay plain text to a screen
      // reader, and the context reverts the split — never call .revert().
      const split = turn ? SplitText.create(turn, { type: "words", aria: "none" }) : null;

      const tl = gsap.timeline({ paused: true });

      // The whole resting state, set at the top, before anything moves.
      tl.set(q(".cp-drain"), { opacity: 1 }, 0).set(rules, { drawSVG: "0% 0%" }, 0);
      if (split) {
        // Each word on its own compositor layer, so the rise and the blur
        // are GPU work rather than a repaint of the line per frame.
        gsap.set(split.words, { willChange: "transform, opacity, filter", force3D: true });
        tl.set(split.words, { autoAlpha: 0 }, 0);
      }

      // One unbroken stroke, at one speed, for the whole length of the
      // audit: the column that keeps going does not pause at a layer.
      tl.to(rules, { drawSVG: "0% 100%", duration: RUN, ease: "none" }, 0);

      SEQ.forEach((l, i) => {
        const at = AT[i];
        // The layer has been read. Everything that follows from that — the
        // lit row, the numeral, the tally — is CSS off one integer.
        tl.call(() => setBeat(i + 1), [], at);

        // ...and the four rivals hand their borrowed weight back, left to
        // right across the board, as one sweep rather than four events.
        const drain = q(`.cp-drain-${l.id}`);
        if (drain.length) {
          tl.to(
            drain,
            { opacity: 0, duration: 0.45, ease: "power2.out", stagger: 0.06 },
            at + 0.18,
          );
        }
      });

      // The finding, arriving as language at the moment it is proved.
      if (split) {
        tl.fromTo(
          split.words,
          { autoAlpha: 0, yPercent: 16, filter: "blur(3px)" },
          {
            autoAlpha: 1,
            yPercent: 0,
            filter: "blur(0px)",
            duration: 0.9,
            ease: "power2.out",
            stagger: 0.06,
            immediateRender: false,
          },
          TURN_AT - 0.45,
        );
      }

      // The board rests on its ending. Written as an empty tween, never a
      // delay, so the timeline's own length is the truth.
      tl.to({}, { duration: 0.9 }, RUN);

      // The rewind. Those `set`s at position zero render the moment the
      // timeline is built, so the tally is wound back with them rather than
      // a beat later on the first play — a board holding borrowed weight
      // under a finished count would be the one frame that lies.
      //
      // A reader who touched it before GSAP arrived gets the answer instead.
      if (taken) tl.progress(1);
      else setBeat(0);

      tlRef.current = tl;
      return () => {
        tlRef.current = null;
      };
    },
    // `revertOnUpdate` because the callback splits text and sets inline
    // styles; reverting puts the finished board back, which is the point.
    { scope: boardRef, dependencies: [reduce], revertOnUpdate: true },
  );

  /**
   * Plays while on screen, and never again once the reader has taken over.
   * `kit` is in the deps because the timeline is built asynchronously,
   * after the kit arrives.
   */
  useEffect(() => {
    const tl = tlRef.current;
    if (!tl) return;
    if (inView && !reduce && !taken) tl.play();
    else tl.pause();
  }, [inView, reduce, taken, kit]);

  /**
   * Cross-highlight, and the handover. Six columns by twelve rows is
   * exactly the size at which the eye loses the row on its way across. The
   * audit lights the row it is reading; the reader's first pointer, focus
   * or key event runs the timeline to its end on the spot and takes the
   * highlight over for the rest of the page's life.
   */
  const [at, setAt] = useState<{ row: string; col: number } | null>(null);
  const take = () => {
    if (taken) return;
    setTaken(true);
    // Seeking suppresses the timeline's own callbacks, which is what we
    // want: the board finishes, the clock does not replay its beats. `head`
    // is derived from `taken`, so the count finishes with it.
    tlRef.current?.progress(1).pause();
  };
  const autoRow = !taken && running && head > 0 ? SEQ[head - 1].id : null;
  const rowLit = (row: string) => at?.row === row || autoRow === row;
  const colLit = (col: number) => at?.col === col;

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
                          {/* The turn's note is the one clause on this board
                              that arrives as language: SplitText reaches for
                              this leaf, and only on the business half. */}
                          <span className={g.id === "business" ? "cp-turn" : undefined}>
                            {g.note}
                          </span>
                        </span>
                      </span>
                    </th>
                  </tr>

                  {ROWS[g.id].map((l) => {
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
                          const drain =
                            g.id === "business" && !r.ours
                              ? `cp-drain cp-drain-${l.id}`
                              : undefined;
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
                                <Mark state={state} drain={drain} />
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
                rather than as something the row hairlines cut through.

                Real SVG strokes, and the one thing on this board that is
                drawn rather than revealed — DrawSVG needs geometry, and
                the argument needs a stroke that keeps going rather than a
                box that stretches. Each carries a faint ghost twin over
                which the ink is laid: the column's route was always there;
                the audit is what inks it.

                `viewBox="0 0 1 100"` against a one-pixel-wide box, so the
                stroke is always exactly one device pixel across and the
                line is always exactly a hundred user units long however
                tall the board grows. DrawSVG's dash arithmetic is then in
                those hundred units and survives every reflow. They rest
                fully drawn, which is what the server sends. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-20"
            >
              {([COLS.oursLeft, COLS.oursRight] as const).map((left) => (
                <svg
                  key={left}
                  className="absolute inset-y-0 w-px"
                  style={{ left }}
                  viewBox="0 0 1 100"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <line
                    className="stroke-pp-accent"
                    x1="0.5"
                    x2="0.5"
                    y1="0"
                    y2="100"
                    strokeOpacity="0.1"
                    strokeWidth="1"
                  />
                  <line
                    className="cp-rule stroke-pp-accent"
                    x1="0.5"
                    x2="0.5"
                    y1="0"
                    y2="100"
                    strokeOpacity="0.4"
                    strokeWidth="1"
                  />
                </svg>
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
