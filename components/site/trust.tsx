"use client";

import { motion, useReducedMotion } from "framer-motion";
import { SETUP_LANGS, TRUST } from "@/lib/site";
import { cn } from "@/lib/utils";
import { CornerDot } from "./corner-dot";
import { EASE, Reveal } from "./reveal";

/**
 * The four doubts, set as a colophon rather than as a trust band.
 *
 * This is the section most likely to come out generic, because the genre
 * it belongs to — four reassurance tiles with a shield, a lock, a globe
 * and a flag — is one every buyer has already learned to skip. The genre
 * fails for a reason worth naming: those tiles are drawn as *badges*, and
 * a badge is a promise that someone else has audited us. We hold no
 * certification. TRUST's own comment says so. Drawing a shield that
 * stands for nothing is a worse lie than saying nothing at all.
 *
 * So the band is set as a **colophon** — the imprint page at the back of
 * a book, where the facts of manufacture are recorded without persuasion:
 * where it was printed, in which face, how many copies. A colophon is not
 * trying to convince anyone. That register is exactly right for four
 * claims whose entire strength is that each of them is checkable.
 *
 * What that buys, concretely:
 *
 *  · **A field key, a statement, a datum.** Every row reads left to right
 *    as an entry rather than as a pitch: the key in mono at caption
 *    weight, the claim in the display face, the machine-readable value —
 *    a region, a count — in mono on the right where a colophon puts it.
 *    Nothing is centred, nothing is boxed, nothing repeats an icon.
 *  · **The counts are derived, never typed.** The languages row reads its
 *    figure from SETUP_LANGS, so a tenth language moves the number here
 *    the same afternoon it is added. A trust section that states a stale
 *    count has disproved itself in the one place it could least afford to.
 *  · **The claims are held at exactly their verified width.** Storage is
 *    storage: the Postgres region really is eu-west-1, and the note points
 *    at the FAQ for the speech and telephony hops rather than rounding the
 *    whole stack up to "EU hosted". The hand-over is real code. Neither
 *    gets an adjective here that the repository cannot answer for.
 *
 * Motion is the lightest on the page, deliberately. These are facts and
 * they should arrive plainly: one short reveal per row, the rules wiping
 * in under them, nothing bound to scroll and nothing that loops. An
 * animated fact looks like a fact that needed help.
 */

/**
 * TRUST carries a kicker and the four entries but no heading, and the
 * masthead needs one. Held here rather than added to the frozen constant.
 */
const TITLE = "Four things you can check yourself.";

/** The section's own numeral in the page sequence — FAQ behind, close ahead. */
const NUMERAL = "11";

/**
 * The colophon's left key and right value, per TRUST id.
 *
 * Kept beside the render and not in `lib/site.ts` because these are
 * typography, not copy: the key is the field name a colophon would print
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

/** Field key and datum share one register; only the alignment differs. */
const MONO =
  "font-mono text-[0.7em] uppercase leading-none tracking-[0.24em]";

/** A hairline that wipes in from the gutter, or is simply there. */
function Rule({ delay = 0 }: { delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      aria-hidden
      className="h-px origin-left bg-[var(--cover-paper)]/12"
      initial={reduce ? false : { scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ duration: 0.8, delay, ease: EASE }}
    />
  );
}

export function Trust() {
  // Derived, not restated: the count is whatever the greeting library
  // actually ships, read at render from the same array the setup flow uses.
  const langCount = SETUP_LANGS.length;

  return (
    <section
      id="trust"
      className="relative scroll-mt-24 px-[1.6em] py-[6em] md:py-[8em]"
    >
      <div className="relative mx-auto max-w-[76em]">
        {/* Masthead — left on the gutter, same as every band below the fold. */}
        <Reveal>
          <div className="flex items-center gap-[0.6em] text-[var(--cover-paper)]/45">
            <CornerDot className="size-[0.55em]" />
            <span className="font-mono text-[0.7em] uppercase leading-none tracking-[0.24em]">
              {NUMERAL}
            </span>
            <span className="font-mono text-[0.7em] uppercase leading-none tracking-[0.24em]">
              {TRUST.kicker}
            </span>
          </div>

          <h2 className="mt-[0.7em] text-balance text-[2.8em] font-medium leading-[1.03] tracking-[-0.045em] md:text-[3.4em]">
            {TITLE}
          </h2>
        </Reveal>

        <div className="mt-[1.8em]">
          <Rule />
        </div>

        {/* The imprint. Rows, not cards: the rule under each entry is the
            only thing grouping them, which is what keeps this from reading
            as the anatomy strip or the solutions ledger higher up. */}
        <dl className="mt-0">
          {TRUST.items.map((item, i) => {
            const entry = ENTRY[item.id];
            const datum =
              item.id === "languages" ? `${langCount} languages` : entry?.datum;

            return (
              <div key={item.id}>
                <Reveal delay={i * 0.06}>
                  <div
                    className={cn(
                      "grid gap-x-[1.6em] gap-y-[0.7em] py-[1.6em]",
                      "md:grid-cols-[7em_minmax(0,1fr)_11em] md:items-baseline md:py-[1.9em]",
                    )}
                  >
                    {/* The field key. A caption, so /45 is within the floor. */}
                    <div
                      className={cn(
                        MONO,
                        "flex items-center justify-between gap-[1em] text-[var(--cover-paper)]/45 md:block",
                      )}
                    >
                      <span>{entry?.key ?? item.id}</span>
                      {/* Below md the datum rides up beside its key: a
                          right-hand column on a phone is a column of two
                          words with a screen of dead air beside it. */}
                      {datum ? (
                        <span className="text-[var(--cover-brand-lit)] md:hidden">
                          {datum}
                        </span>
                      ) : null}
                    </div>

                    <div>
                      <dt className="text-[1.35em] font-medium leading-[1.25] tracking-[-0.03em]">
                        {item.label}
                      </dt>
                      {/* Substance, so it never drops below /75. */}
                      <dd className="mt-[0.5em] max-w-[44em] text-pretty text-[1em] leading-[1.6] text-[var(--cover-paper)]/75">
                        {item.note}
                      </dd>
                    </div>

                    {datum ? (
                      <div
                        className={cn(
                          MONO,
                          "hidden text-right tabular-nums text-[var(--cover-brand-lit)] md:block",
                        )}
                      >
                        {datum}
                      </div>
                    ) : (
                      <div aria-hidden className="hidden md:block" />
                    )}
                  </div>
                </Reveal>

                <Rule delay={i * 0.06 + 0.1} />
              </div>
            );
          })}
        </dl>
      </div>
    </section>
  );
}
