"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { CAA_NAMES, SaidPart, Term } from "@/lib/pages/custom-ai-agents";
import { Eyebrow, Frame, SectionTitle } from "@/components/site/product/primitives";
import { useInView, usePrefersReducedMotion } from "@/components/site/product/timing";
import { cn } from "@/lib/utils";
import { Stack, fill } from "./parts";
import { markProved } from "./proved";

/* ------------------------------------------------------------------ *
 * §2 — Heard right.
 *
 * The objection: "it won't catch our street names, our codes, our
 * people." It is a fair one. Speech recognition is trained on ordinary
 * words and guesses at proper ones, and the guesses are exactly the words
 * a heating firm's calls turn on — the firm's own name, the street, the
 * plan code, the person the caller spoke to last time.
 *
 * THE INSTRUMENT is one sentence, heard three ways and stacked so the eye
 * reads straight down the column: what the caller said (the cinema
 * italic, a voice), what a recogniser writes down without a list (muted,
 * the guesses under a dotted line — the house mark for "not settled"),
 * and what it writes down with one. The list sits beside it as chips.
 * Each chip is a switch for one word in the third row: turn "Wrenfield
 * Close" off and "Renfield clothes" comes back. The reader is not told
 * that a keyterm list matters; they take one word off it and watch the
 * sentence break.
 *
 * Three chips (LPG, powerflush, Harbrook) are not in the sentence. That
 * is deliberate: a real list is longer than any one call, and the meter
 * underneath has to count words the reader never sees misheard, or it
 * would be counting a demo rather than a list.
 *
 * TIMING. The rows arrive 400ms apart (300 / 700 / 1100) — long enough
 * that each is read as its own line, short enough that the three still
 * read as one comparison. Row 3 lands wrong on purpose, matching row 2,
 * and holds for 900ms so the reader has registered the mistakes before
 * the first one is fixed. The five heard terms then go on 320ms apart,
 * in reading order, so the corrections sweep left to right through the
 * sentence the way the eye travels; 320ms is just over the 280ms a
 * correction takes to land, so no two swaps overlap. The last three go on
 * together at 3900ms — they change nothing in the sentence, so staging
 * them one by one would be motion without meaning — and the meter comes
 * to rest on the full list. Nothing loops.
 *
 * ZERO LAYOUT SHIFT, three ways:
 *   · the three rows are laid out from the first frame and only made
 *     visible as they land, so the card is its final height before
 *     anything moves;
 *   · row 3 is a stack of whole sentences in one grid cell, not words
 *     swapped in place. Under them sits an invisible sizer in which each
 *     term is a slot as wide as the wider of its two spellings; no word in
 *     any written-down sentence is wider than its slot, so no mix of right
 *     and wrong ever needs more lines than the sizer, and the cell is its
 *     final height at every width. The autoplay is one sentence per step
 *     of the walk, all laid out from the first frame and shown one at a
 *     time: a visibility change, never a reflow. Only once a reader has
 *     touched a chip does a live sentence built from the chips take over,
 *     and its reflows follow their input. Every sentence is set at its
 *     natural word widths, because a slot's spare width reads as a hole
 *     and its underline as a rule under nothing. The acceptance check is
 *     that row 3's height is the same through the autoplay and before and
 *     after every toggle, at 320, 390 and 1440;
 *   · the meter and the action label each sit over an invisible copy of
 *     their widest variant, so a count going from 0 to 56, or "Clear the list" becoming
 *     "Put the list back", cannot push the line under it.
 *
 * NO BREAK INSIDE A TOKEN. Where the text after a term runs straight on
 * ("QM" + "-20417.", "Quillmoor" + "?") the term and that run are glued
 * in a nowrap span, in all three rows alike, so the plan code reads as
 * one token and the three versions of the sentence break the same way.
 *
 * WITHOUT JAVASCRIPT the server paints the finished card, every row shown
 * and the whole list on, as the redline does. Hydration swaps back to the
 * start state below the fold: a visibility change inside a box that is
 * already its final height.
 *
 * COLOUR. Ink for what is written down right, muted with a dotted
 * underline for a guess, and violet only for the underline that draws in
 * under a correction — the product acting. No green: nothing here is a
 * test that held, and "expected, not guaranteed" is the honest claim.
 *
 * THE PAIRING. Point at a chip, tab to it or tap it, and its word lights
 * white in all three rows at once — said, guessed, written down — so the
 * eye can run down the column for one word before switching it. White is
 * the page's "selected" card on the grey instrument, never violet: a
 * preview is the reader looking, not the product acting. It is a peek,
 * not a toggle: only a click on a chip or the action button counts as
 * operating the list (take, markProved); pointing and focusing never do.
 * LPG, powerflush and Harbrook light nothing, because they are not in
 * the sentence — true, and the same point the meter makes. Every term
 * span carries caa-peek from the first frame, so the 160ms fade exists
 * in both directions and a highlight never re-keys a word (no ind-swap
 * replay). Background and box-shadow only: nothing reflows, so row 3's
 * reservation above still holds.
 *
 * THE RAIL'S EDGE. Below md the chips scroll sideways, and the right
 * 28px of the rail fades out (caa-rail-fade) so a cut chip reads as "more
 * this way" rather than as a clipped card. The rail's trailing padding
 * is wider than that fade, so at the end of the scroll the last chip —
 * and its focus ring — sits wholly clear of it.
 * ------------------------------------------------------------------ */

/** When the rows land, from the moment the card is on screen. */
const ROW_AT = [300, 700, 1100] as const;
/** The five heard terms go on in reading order, 320ms apart. */
const WALK_AT = [2000, 2320, 2640, 2960, 3280] as const;
/** The rest of the list goes on together; the sentence doesn't change. */
const REST_AT = 3900;

/** The eleven-pixel field label every instrument on the page uses. */
const LABEL = "text-[11px] leading-4 font-medium tracking-[0.12em] text-pp-muted uppercase";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink";

const noop = () => () => {};
/** False on the server and through hydration, true after: the redline's hook. */
const useHydrated = () =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

export function Names({ data }: { data: typeof CAA_NAMES }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, "-15% 0px");
  const still = usePrefersReducedMotion();
  const hydrated = useHydrated();

  // Widened once to the declared shape: the `as const` tuple is a union
  // of literal objects, and only some of them carry `misheard`.
  const terms: readonly Term[] = data.terms;
  const all = terms.map((t) => t.id);
  const walk = data.walk as readonly string[];

  const [on, setOn] = useState<ReadonlySet<string>>(() => new Set());
  const [landed, setLanded] = useState(0);
  const [touched, setTouched] = useState(false);
  // The chip being looked at (hover, focus or the last tap). Visual only:
  // it is never announced and never counts as operating the list.
  const [peek, setPeek] = useState<string | null>(null);
  // Leaving or blurring a chip clears only its own peek, so moving the
  // mouse onto chip B before chip A's blur lands never blanks B.
  const unpeek = (id: string) => setPeek((p) => (p === id ? null : p));
  /** Every occurrence of a term carries the fade; the one looked at is lit. */
  const lit = (id: string) => cn("caa-peek", peek === id && "caa-peek-on");

  // What is painted. Before hydration that is the finished card, so a
  // reader without JavaScript (or a crawler that doesn't run it) gets the
  // sentence and the list, not three empty rows.
  const rows = hydrated ? landed : 3;
  const onNow: ReadonlySet<string> = hydrated ? on : new Set(all);

  const started = useRef(false);
  // Set by the reader's first touch. Reduced motion lands the final state
  // on every inView change; it must not undo chips a reader switched off.
  const taken = useRef(false);
  const timers = useRef<number[]>([]);
  // Unmount only — see the note in industry/first-question.tsx: clearing
  // on an inView change would strand the chain half-played.
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  useEffect(() => {
    if (still) {
      // Final state, no clock: every row shown, the whole list on. Also
      // finishes an autoplay the OS setting interrupted mid-walk.
      if (taken.current) return;
      started.current = true;
      timers.current.forEach(window.clearTimeout);
      timers.current = [];
      setLanded(3);
      setOn(new Set(all));
      return;
    }
    if (!inView || started.current) return;
    started.current = true;
    timers.current = [
      ...ROW_AT.map((t, i) => window.setTimeout(() => setLanded(i + 1), t)),
      ...WALK_AT.map((t, i) =>
        window.setTimeout(() => setOn((s) => new Set([...s, walk[i]])), t),
      ),
      window.setTimeout(() => setOn(new Set(all)), REST_AT),
    ];
    // `all` and `walk` come from static props; they never change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, still]);

  function take() {
    started.current = true;
    taken.current = true;
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    // A reader who reaches for a chip before row 3 has landed would be
    // switching a word they can't see.
    setLanded(3);
    setTouched(true);
    markProved("names");
  }

  function toggle(id: string) {
    take();
    setOn((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const empty = onNow.size === 0;
  function action() {
    take();
    // Every word just changed, so no single one is "the word you touched";
    // a tap-left peek (Safari never blurs the chip) would point at one.
    setPeek(null);
    setOn(empty ? new Set(all) : new Set());
  }

  // Derived from the data, never typed: the count and the characters of
  // whichever chips are on, against the platform's own limits.
  const meterFor = (ids: ReadonlySet<string>) =>
    fill(data.meter, {
      n: ids.size,
      max: data.limits.max,
      chars: terms.reduce((sum, t) => sum + (ids.has(t.id) ? t.term.length : 0), 0),
      maxChars: data.limits.maxChars,
    });

  const byId = new Map(terms.map((t) => [t.id, t]));
  const said: readonly SaidPart[] = data.said;

  // Which step of the walk is written down: how many walk terms are on,
  // in order. Untouched, `on` only ever grows along the walk, so this is
  // the whole state; once a reader has touched a chip the live sentence
  // takes over and this is no longer read.
  const stepAt = walk.findIndex((id) => !onNow.has(id));
  const step = stepAt === -1 ? walk.length : stepAt;

  /** Row 3 as written with `ids` on; `draw` and `swap` say which words animate. */
  const written = (ids: ReadonlySet<string>, draw: (id: string) => boolean, swap: (id: string) => boolean) =>
    glueRuns(said, (id) => {
      const t = byId.get(id);
      if (!t) return null;
      if (!t.misheard) return <span className={lit(id)}>{t.term}</span>;
      // The highlight goes on a wrapper, not on Word's caa-ins span: that
      // rule's `background` shorthand and `transition` would fight
      // caa-peek's, and the violet underline would lose its draw-in.
      return (
        <span className={lit(id)}>
          <Word term={t.term} misheard={t.misheard} on={ids.has(id)} draw={draw(id)} swap={swap(id)} />
        </span>
      );
    });

  return (
    <section id="names" className="scroll-mt-28">
      <Frame className="px-6 md:px-12">
        <Eyebrow>{data.eyebrow}</Eyebrow>
        <SectionTitle className="mt-4 max-w-[820px]">{data.title}</SectionTitle>
        <p className="mt-5 max-w-[560px] text-base leading-[25px] text-pp-ink/80">{data.body}</p>
      </Frame>

      <Frame className="mt-8 px-2 md:px-4">
        <div
          ref={ref}
          className="grid gap-7 rounded-[24px] bg-pp-card p-4 md:p-7 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10"
        >
          {/* Left: one sentence, three ways. Every row is in the layout
              from the first frame; `invisible` until it lands. */}
          <div className="min-w-0 divide-y divide-pp-hair">
            <Row label={data.labels.said} shown={rows >= 1} enter="ind-land">
              <p className="font-[family-name:var(--font-pp-cinema)] text-[21px] leading-8 text-pp-ink italic md:text-[24px] md:leading-9">
                &ldquo;
                {glueRuns(said, (id) => (
                  <span className={lit(id)}>{byId.get(id)?.term}</span>
                ))}
                &rdquo;
              </p>
            </Row>

            <Row label={data.labels.without} shown={rows >= 2} enter="ind-row">
              <p className="text-[17px] leading-7 text-pp-muted">
                {glueRuns(said, (id) => {
                  const t = byId.get(id);
                  return t?.misheard ? (
                    <span className={cn(GUESS, lit(id))}>{t.misheard}</span>
                  ) : (
                    <span className={lit(id)}>{t?.term}</span>
                  );
                })}
              </p>
            </Row>

            <Row label={data.labels.with} shown={rows >= 3} enter="ind-land">
              {/* The stack: the sizer, one sentence per step of the walk,
                  and the live one. Only the one showing is visible, so
                  only it is in the accessibility tree. */}
              <div data-caa-names-with className="grid text-[17px] leading-7 text-pp-ink">
                <p aria-hidden inert className="invisible [grid-area:1/1]">
                  {glueRuns(said, (id) => {
                    const t = byId.get(id);
                    if (!t) return null;
                    return t.misheard ? <Slot term={t.term} misheard={t.misheard} /> : <span>{t.term}</span>;
                  })}
                </p>
                {Array.from({ length: walk.length + 1 }, (_, k) => {
                  const ids = new Set(walk.slice(0, k));
                  const fresh = k > 0 ? walk[k - 1] : null;
                  const showing = !touched && step === k;
                  return (
                    <p key={k} className={cn("[grid-area:1/1]", !showing && "invisible")}>
                      {written(
                        ids,
                        // The word this step corrects draws its underline
                        // as the step shows; the ones before it already have.
                        (id) => id !== fresh || showing,
                        (id) => id === fresh && showing && hydrated,
                      )}
                    </p>
                  );
                })}
                {/* Kept in step with the chips all along, invisibly, so a
                    reader's first touch changes one word, not all of them. */}
                <p className={cn("[grid-area:1/1]", !touched && "invisible")}>
                  {written(
                    onNow,
                    (id) => onNow.has(id),
                    () => true,
                  )}
                </p>
              </div>
            </Row>
          </div>

          {/* Right: the list. */}
          <div className="min-w-0">
            <p className={LABEL}>{data.labels.list}</p>
            {/* A chip rail on a phone — edge to edge inside the card, with
                the next chip peeking so it's plain the rail scrolls, and
                scrolling only itself. Wrapped from md up. A scroller clips
                on both axes (overflow-x forces it), so the rail carries 4px
                above and below for the focus ring, and scroll padding so a
                chip tabbed to lands clear of the edge, ring and all. The
                right edge fades (caa-rail-fade, 28px), so the trailing
                padding and scroll padding are 40px: the last chip at the
                end of the scroll, and any chip tabbed to, stops past the
                fade with its 4px ring fully drawn. From md the rail wraps,
                the fade is gone and all of it resets to zero. */}
            <div
              role="group"
              aria-label={data.labels.groupAria}
              className="caa-rail-fade -mx-4 mt-2 flex scroll-pr-10 scroll-pl-4 gap-2 overflow-x-auto py-1 pr-10 pl-4 [scrollbar-width:none] md:mx-0 md:mt-3 md:flex-wrap md:overflow-visible md:scroll-px-0 md:px-0 md:pt-0 [&::-webkit-scrollbar]:hidden"
            >
              {terms.map((t) => {
                const pressed = onNow.has(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={pressed}
                    // A tap sets the peek itself: Safari never focuses a
                    // button on tap, so onFocus alone would miss touch. On
                    // touch it stays on the word the tap just switched.
                    onClick={() => {
                      toggle(t.id);
                      setPeek(t.id);
                    }}
                    // Mouse only: a touch "hover" would fire on every tap
                    // and scroll, and the tap above already covers it.
                    onPointerEnter={(e) => e.pointerType === "mouse" && setPeek(t.id)}
                    onPointerLeave={(e) => e.pointerType === "mouse" && unpeek(t.id)}
                    onBlur={() => unpeek(t.id)}
                    onFocus={(e) => {
                      setPeek(t.id);
                      // Chrome doesn't scroll a rail to a chip that is only
                      // partly in it, so a keyboard reader could focus a
                      // chip they can't see. Only keyboard focus needs it:
                      // Chrome also focuses on a touch tap, and a tap already
                      // put the chip under the finger — scrolling there
                      // slides the next chip under a second tap.
                      if (e.currentTarget.matches(":focus-visible"))
                        e.currentTarget.scrollIntoView({
                          block: "nearest",
                          inline: "nearest",
                          behavior: still ? "auto" : "smooth",
                        });
                    }}
                    className={cn(
                      "min-h-11 shrink-0 rounded-full px-4 text-[14px] leading-none whitespace-nowrap transition-colors",
                      FOCUS,
                      pressed ? "bg-pp-ink text-white" : "bg-white text-pp-muted hover:text-pp-ink",
                    )}
                  >
                    {/* Softened only on the ink chip: on the white one the muted
                        text is already quiet, and 70% of it drops to 2.9:1. */}
                    <span className={cn("mr-1.5 text-[11px]", pressed && "opacity-70")}>{t.kind}</span>
                    {t.term}
                  </button>
                );
              })}
            </div>

            {/* The live count, over an invisible copy of the full list's
                count: the widest the line gets, so it never re-wraps. It
                speaks only once the reader has touched something — during
                autoplay it would chatter eight times unasked. */}
            <Stack
              className="mt-4 min-w-[30ch] text-[13px] leading-5 text-pp-muted tabular-nums"
              items={[onNow, new Set(all)] as const}
              live={0}
              swap={false}
              render={(ids) => <p aria-live={touched ? "polite" : undefined}>{meterFor(ids)}</p>}
            />

            <button
              type="button"
              onClick={action}
              className={cn(
                "mt-4 inline-flex min-h-11 items-center rounded-full bg-white px-4 text-[14px] leading-none text-pp-ink transition-colors hover:text-[#551a89]",
                FOCUS,
              )}
            >
              {/* The same reservation as Stack, in spans: Stack renders divs,
                  and a button may hold phrasing content only. */}
              <span className="inline-grid content-start justify-items-center">
                <span key={String(empty)} className="ind-swap block [grid-area:1/1]">
                  {empty ? data.labels.restore : data.labels.clear}
                </span>
                {[data.labels.clear, data.labels.restore].map((l) => (
                  <span key={l} aria-hidden inert className="invisible block [grid-area:1/1]">
                    {l}
                  </span>
                ))}
              </span>
            </button>
          </div>
        </div>
      </Frame>

      <Frame className="mt-5 px-6 md:px-12">
        <p className="max-w-[620px] text-[13px] leading-5 text-pp-muted">{data.foot}</p>
      </Frame>
    </section>
  );
}

/** A guess, as the recogniser wrote it: muted, under a dotted line. */
const GUESS =
  "text-pp-muted underline decoration-[#6b6878] decoration-dotted decoration-[1.6px] underline-offset-4";

/**
 * The sentence, with each term glued to the text that runs straight on
 * from it ("QM" + "-20417.", "Quillmoor" + "?") in one nowrap span, so
 * no line ever breaks between a code and its number. All three rows and
 * the sizer are built with it, so they break alike.
 */
function glueRuns(said: readonly SaidPart[], renderTerm: (id: string) => ReactNode): ReactNode[] {
  const out: ReactNode[] = [];
  for (let i = 0; i < said.length; i++) {
    const p = said[i];
    if ("text" in p) {
      out.push(<span key={i}>{p.text}</span>);
      continue;
    }
    const next = said[i + 1];
    const glue = next !== undefined && "text" in next ? (/^\S*/.exec(next.text)?.[0] ?? "") : "";
    if (next === undefined || !("text" in next) || glue === "") {
      out.push(<span key={i}>{renderTerm(p.term)}</span>);
      continue;
    }
    out.push(
      <span key={i} className="whitespace-nowrap">
        {renderTerm(p.term)}
        {glue}
      </span>,
      <span key={`${i}+`}>{next.text.slice(glue.length)}</span>,
    );
    i++;
  }
  return out;
}

function Row({
  label,
  shown,
  enter,
  children,
}: {
  label: string;
  shown: boolean;
  enter: "ind-land" | "ind-row";
  children: ReactNode;
}) {
  return (
    // Keyed on `shown` so the row mounts fresh the moment it lands and
    // plays its entrance; before that it holds its space, invisibly.
    <div className="py-5 first:pt-0 last:pb-0">
      <div key={String(shown)} className={shown ? enter : "invisible"}>
        <p className={LABEL}>{label}</p>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}

/**
 * One word of row 3 as written down: the term in ink, or the guess under
 * its dotted line. Set at its own width — holding the space is the
 * sizer's job, not the word's — so the sentence reads as ordinary text,
 * with no hole beside a short word.
 *
 * The outer span stays mounted so the correction's violet underline
 * (caa-ins) can draw in, under the word and only the word. The word is
 * re-keyed so it rises in with the house ind-swap when it changes. The
 * dotted underline sits on the inner span because a text decoration does
 * not reach into an inline-block descendant.
 */
function Word({
  term,
  misheard,
  on,
  draw,
  swap,
}: {
  term: string;
  misheard: string;
  on: boolean;
  draw: boolean;
  swap: boolean;
}) {
  return (
    <span className={cn("caa-ins", on && draw && "caa-ins-on")}>
      <span key={String(on)} className={cn("inline-block", !on && GUESS, swap && "ind-swap")}>
        {on ? term : misheard}
      </span>
    </span>
  );
}

/**
 * The sizer's word: both spellings in one inline-grid cell, as wide as
 * the wider of them. Never seen; it only fixes how many lines row 3 can
 * ever need, whichever words are right.
 */
function Slot({ term, misheard }: { term: string; misheard: string }) {
  return (
    <span className="inline-grid align-baseline">
      <span className="[grid-area:1/1]">{misheard}</span>
      <span className="[grid-area:1/1]">{term}</span>
    </span>
  );
}
