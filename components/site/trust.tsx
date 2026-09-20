"use client";

import { useEffect, useRef, useState } from "react";
import { SETUP_LANGS, TRUST } from "@/lib/site";
import { cn } from "@/lib/utils";
import { Frame, Rule, SectionHeading } from "./product/primitives";
import { holdFor, useInView, usePrefersReducedMotion } from "./product/timing";

/**
 * The four doubts, set as an imprint that checks itself while you read it.
 *
 * This is the section most likely to come out generic, because the genre
 * it belongs to — four reassurance tiles with a shield, a lock, a globe
 * and a flag — is one every buyer has already learned to skip. The genre
 * fails for a reason worth naming: those tiles are drawn as *badges*, and
 * a badge is a promise that someone else has audited us. We hold no
 * certification. TRUST's own comment says so. Drawing a shield that
 * stands for nothing is a worse lie than saying nothing at all.
 *
 * So the band is set as an **imprint** — the page at the back of a book
 * where the facts of manufacture are recorded without persuasion: where
 * it was printed, in which face, how many copies. An imprint is not
 * trying to convince anyone. That register is exactly right for four
 * claims whose entire strength is that each of them is checkable.
 *
 * Set in the product-page system (`.pp`): white stock, black ink, the
 * violet accent, hairlines. The section carries the `pp` class itself
 * rather than inheriting it, because on the homepage it sits between a
 * dark hero and a dark footer — exactly how the product pages are built,
 * white body between two dark ends — and it paints its own opaque ground
 * so the run's field cannot show through it.
 *
 * ## The scene
 *
 * The kicker says *before you point a number at it*, and the four entries
 * say *check it yourself*. So the section does the checking, in front of
 * you, one entry at a time. That is the whole mechanism and it plays on
 * its own: a verification pass walks down the imprint, holds an entry in
 * `Checking` for one short beat, then stamps the datum into the right-hand
 * column — `eu-west-1`, `3 triggers`, the live language count, `Romania` —
 * and draws the hairline under the row it has just cleared. The rules are
 * the pass's own progress bar. When the fourth lands, the pass rests:
 * facts do not need re-checking, so nothing here loops.
 *
 * It runs on the house clock from `product/timing.ts`. Each cleared entry
 * is held for `holdFor(note)` — its own note read at 230 words a minute —
 * before the next one is picked up, so the pass never outruns the reader.
 * `useInView` gates it, which means a page in a background tab has no
 * timers, and `usePrefersReducedMotion` hands those readers all four
 * entries already cleared, with every rule ruled and every datum in place.
 *
 * The reader owns it from their first click, tap, tab or key: the pass
 * stops where it is and never resumes, and every remaining entry becomes
 * theirs to check — press `Check` and that row runs its own beat and
 * stamps its own datum. Nothing already cleared is ever taken back.
 *
 * That is the argument. A row that fades in as you scroll past asks you to
 * admire the page. A row that is verified in front of you, and then hands
 * you the button, asks you to verify the next one — which is the only
 * thing this section has ever wanted from anyone.
 *
 * The movement is CSS throughout: opacity and transform transitions on
 * state changes, `animate-in` for the datum landing. No scroll binding, no
 * motion library, and the only thing the page animates is the product
 * doing what the copy says it does.
 *
 *  · **A field key, a statement, a datum.** Every row reads left to right
 *    as an entry rather than as a pitch: the key in a small tracked
 *    caption, the claim in ink at statement size, the machine-readable
 *    value — a region, a count — in mono on the right where an imprint
 *    puts it. Nothing is centred, nothing is boxed, nothing repeats an
 *    icon, and there is no card: hairlines do all the grouping.
 *  · **The counts are derived, never typed.** The languages row reads its
 *    figure from SETUP_LANGS, so a tenth language moves the number here
 *    the same afternoon it is added. A trust section that states a stale
 *    count has disproved itself in the one place it could least afford to.
 *  · **The claims are held at exactly their verified width.** Storage is
 *    storage: the Postgres region really is eu-west-1, and the note points
 *    at the FAQ for the speech and telephony hops rather than rounding the
 *    whole stack up to "EU hosted". The hand-over is real code. Neither
 *    gets an adjective here that the repository cannot answer for.
 */

/**
 * TRUST carries a kicker and the four entries but no heading, and the
 * masthead needs one. Held here rather than added to the frozen constant.
 */
const TITLE = "Four things you can check yourself.";

/**
 * The imprint's left key and right value, per TRUST id.
 *
 * Kept beside the render and not in `lib/site.ts` because these are
 * typography, not copy: the key is the field name an imprint would print
 * in the margin, and the datum is the same fact as the row's label reduced
 * to the shortest machine-readable form — a region or a count.
 *
 * `languages` has no literal: its datum is computed from SETUP_LANGS at
 * render. `handover` counts the conditions its own note names — a question
 * it cannot answer, a caller who asks for a person, a word you pick — so
 * the figure and the sentence beside it cannot drift apart.
 */
const ENTRY: Record<string, { key: string; datum: string | null }> = {
  eu: { key: "Storage", datum: "eu-west-1" },
  handover: { key: "Hand-over", datum: "3 triggers" },
  languages: { key: "Languages", datum: null },
  company: { key: "Entity", datum: "Romania" },
};

/**
 * The pass's two fixed beats. Everything else is read off `holdFor`.
 *
 * `LEAD` is the pause before the first entry is picked up, so the section
 * is not already working the instant it crosses the fold. `BEAT` is how
 * long an entry sits in `Checking` — short, because a check that takes
 * visible effort reads as a check that might fail.
 */
const LEAD = 600;
const BEAT = 900;

/** The field key: a caption, muted, at the contrast floor's safe side. */
const KEY_TYPE =
  "text-[11px] leading-4 font-medium tracking-[0.14em] text-pp-muted uppercase";

/** The datum: the same register, set in mono because it is a value. */
const DATUM_TYPE =
  "font-[family-name:var(--font-geist-mono)] text-[11px] leading-4 tracking-[0.06em] tabular-nums uppercase";

export function Trust() {
  // Derived, not restated: the count is whatever the greeting library
  // actually ships, read at render from the same array the setup flow uses.
  const langCount = SETUP_LANGS.length;
  const items = TRUST.items;

  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, "-15% 0px");
  const reduce = usePrefersReducedMotion();

  /** One flag per entry: has the pass cleared it yet. */
  const [cleared, setCleared] = useState<boolean[]>(() => items.map(() => false));
  /** The entry currently held in `Checking`, or null between beats. */
  const [active, setActive] = useState<number | null>(null);
  /** Set by the reader's first click, tap, tab or key. Never unset. */
  const [taken, setTaken] = useState(false);

  // The next entry the pass would pick up: the first one still uncleared.
  const next = cleared.indexOf(false);

  // A reader who has asked for less gets the finished imprint at once —
  // every entry cleared, every datum in place — and no timer ever starts.
  useEffect(() => {
    if (!reduce) return;
    setActive(null);
    setCleared(items.map(() => true));
  }, [reduce, items]);

  // Pick up the next entry. Only the autoplay pass does this, and only
  // while the section is on screen and the reader has not taken over.
  const picking = inView && !reduce && !taken && active === null && next !== -1;
  useEffect(() => {
    if (!picking) return;
    // Hold the entry just cleared for as long as its own note takes to
    // read; before the first one, only the lead-in.
    const wait = next === 0 ? LEAD : holdFor(items[next - 1].note);
    const t = setTimeout(() => setActive(next), wait);
    return () => clearTimeout(t);
  }, [picking, next, items]);

  // Resolve whatever is being checked — the pass's pick or the reader's.
  useEffect(() => {
    if (active === null || reduce || !inView) return;
    const t = setTimeout(() => {
      setCleared((c) => c.map((v, j) => (j === active ? true : v)));
      setActive(null);
    }, BEAT);
    return () => clearTimeout(t);
  }, [active, reduce, inView]);

  /** The reader's first interaction stops the pass for good. */
  const take = () => setTaken(true);

  /** A row the reader checks themselves: same beat, their finger on it. */
  const check = (i: number) => {
    setTaken(true);
    if (cleared[i] || active !== null) return;
    if (reduce) {
      setCleared((c) => c.map((v, j) => (j === i ? true : v)));
      return;
    }
    setActive(i);
  };

  return (
    <section
      ref={ref}
      id="trust"
      // `pp` defines the tokens and the body face; `text-base` puts the
      // section back on a rem/px scale, since the run above it sets a
      // fluid `em` base that nothing here is measured in.
      className="pp relative isolate scroll-mt-24 bg-pp-bg text-base text-pp-ink"
    >
      {/* No inner padding on either Frame: the rows are meant to sit flush
          with the column edge so every hairline under them lands on exactly
          the same two points as the full-column Rule above. */}
      <Frame className="pt-20 pb-10 md:pt-28 md:pb-12">
        <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-500 fill-mode-both">
          <SectionHeading eyebrow={TRUST.kicker}>
            {TITLE}
          </SectionHeading>
        </div>
      </Frame>

      <Rule />

      {/* The imprint. Rows, not cards: the rule under each entry is the
          only thing grouping them, which is what keeps this from reading
          as the anatomy strip or the solutions ledger higher up. The rules
          arrive as the pass clears the rows above them. */}
      <Frame className="pb-20 md:pb-28">
        <dl onPointerDownCapture={take} onFocusCapture={take} onKeyDownCapture={take}>
          {items.map((item, i) => {
            const entry = ENTRY[item.id];
            const datum =
              item.id === "languages" ? `${langCount} languages` : entry?.datum;
            const done = cleared[i];
            const busy = active === i;

            return (
              <div key={item.id}>
                <div
                  className={cn(
                    "relative grid grid-cols-[minmax(0,1fr)_auto] gap-x-8 gap-y-3 py-7",
                    "md:grid-cols-[132px_minmax(0,1fr)_148px] md:items-baseline md:gap-x-12 md:py-9",
                  )}
                >
                  {/* The wash under the entry being checked: the only place
                      on this white stock where the accent is a surface. */}
                  <span
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute -inset-x-4 inset-y-0 rounded-lg bg-pp-accent/[0.04] transition-opacity duration-500",
                      busy ? "opacity-100" : "opacity-0",
                    )}
                  />

                  <span className={cn(KEY_TYPE, "relative md:row-start-1 md:col-start-1")}>
                    {entry?.key ?? item.id}
                  </span>

                  {/* The stamp. Below md it rides up beside its key: a
                      right-hand column on a phone is a column of two words
                      with a screen of dead air beside it. */}
                  {datum ? (
                    <Stamp
                      datum={datum}
                      done={done}
                      busy={busy}
                      onCheck={() => check(i)}
                      className="relative justify-self-end md:row-start-1 md:col-start-3"
                    />
                  ) : (
                    <span aria-hidden className="md:row-start-1 md:col-start-3" />
                  )}

                  <div className="relative col-span-2 md:col-span-1 md:row-start-1 md:col-start-2">
                    <dt
                      className={cn(
                        "text-[19px] leading-7 tracking-[-0.01em] text-pretty transition-colors duration-500 md:text-[21px] md:leading-8",
                        done ? "text-pp-ink" : "text-pp-ink/60",
                      )}
                    >
                      {item.label}
                    </dt>
                    <dd className="mt-2 max-w-[62ch] text-[15px] leading-6 text-pretty text-pp-muted md:text-base md:leading-7">
                      {item.note}
                    </dd>
                  </div>
                </div>

                {/* Drawn as the entry above it clears, from the gutter in. */}
                <div
                  aria-hidden
                  className={cn(
                    "h-px origin-left bg-pp-rule transition-transform duration-700 ease-out",
                    done ? "scale-x-100" : "scale-x-0",
                  )}
                />
              </div>
            );
          })}
        </dl>
      </Frame>
    </section>
  );
}

/**
 * The right-hand column: a button until the entry is cleared, the datum
 * after. Fixed width, so the row does not shift as the words change.
 */
function Stamp({
  datum,
  done,
  busy,
  onCheck,
  className,
}: {
  datum: string;
  done: boolean;
  busy: boolean;
  onCheck: () => void;
  className?: string;
}) {
  if (done) {
    return (
      <span
        className={cn(
          DATUM_TYPE,
          "inline-flex items-center gap-1.5 text-pp-accent md:w-[148px] md:justify-end",
          className,
        )}
      >
        <svg
          aria-hidden
          viewBox="0 0 12 12"
          className="size-3 animate-in fade-in-0 zoom-in-50 duration-300"
        >
          <path
            d="M2.5 6.4 4.9 8.8 9.5 3.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="animate-in fade-in-0 slide-in-from-bottom-1 duration-300 fill-mode-both">
          {datum}
        </span>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onCheck}
      className={cn(
        DATUM_TYPE,
        "inline-flex items-center gap-1.5 rounded-full text-pp-muted transition-colors duration-200 hover:text-pp-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-pp-ink md:w-[148px] md:justify-end",
        className,
      )}
    >
      <span aria-hidden className="relative grid size-2 place-items-center">
        {busy ? (
          <span className="absolute inset-0 animate-ping rounded-full bg-pp-accent/40" />
        ) : null}
        <span
          className={cn(
            "relative size-2 rounded-full transition-colors duration-300",
            busy ? "bg-pp-accent" : "bg-pp-ink/25",
          )}
        />
      </span>
      <span key={busy ? "busy" : "idle"} className="animate-in fade-in-0 duration-300">
        {busy ? "Checking" : "Check"}
      </span>
    </button>
  );
}
