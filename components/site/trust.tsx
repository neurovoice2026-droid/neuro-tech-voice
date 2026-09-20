"use client";

import { motion, useReducedMotion } from "framer-motion";
import { SETUP_LANGS, TRUST } from "@/lib/site";
import { cn } from "@/lib/utils";
import { Frame, Rule, SectionHeading } from "./product/primitives";
import { EASE, Reveal } from "./reveal";

/**
 * The four doubts, set as an imprint rather than as a trust band.
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
 * violet accent, hairlines. That is the client's established design and
 * every mega-menu page already speaks it. The section carries the `pp`
 * class itself rather than inheriting it, because on the homepage it sits
 * between a dark hero and a dark footer — exactly how the product pages
 * are built, white body between two dark ends. It does not try to blend
 * into either, and it paints its own opaque ground so the run's field
 * cannot show through it.
 *
 * What the imprint buys, concretely:
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
 *
 * Motion is the lightest on the page, deliberately, and on white it is
 * lighter still: one short reveal per row and the rules drawing in under
 * them — motion that draws rather than motion that glows. Nothing loops,
 * nothing is bound to scroll, and a reader who has asked for less gets
 * the rules already ruled. An animated fact looks like a fact that
 * needed help.
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

/** The field key: a caption, muted, at the contrast floor's safe side. */
const KEY_TYPE =
  "text-[11px] leading-4 font-medium tracking-[0.14em] text-pp-muted uppercase";

/** The datum: the same register, set in mono because it is a value. */
const DATUM_TYPE =
  "font-[family-name:var(--font-geist-mono)] text-[11px] leading-4 tracking-[0.06em] text-pp-accent uppercase tabular-nums";

/**
 * A hairline that draws itself in from the gutter.
 *
 * Local rather than the primitive `Rule`, because these sit *inside* the
 * column with the rows rather than spanning it on their own, and because
 * this one is the section's only mechanism worth keeping.
 */
function DrawnRule({ delay = 0 }: { delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      aria-hidden
      className="h-px origin-left bg-pp-rule"
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
      // `pp` defines the tokens and the body face; `text-base` puts the
      // section back on a rem/px scale, since the run above it sets a
      // fluid `em` base that nothing here is measured in.
      className="pp relative isolate scroll-mt-24 bg-pp-bg text-base text-pp-ink"
    >
      {/* No inner padding on either Frame: the rows are meant to sit flush
          with the column edge so every hairline under them lands on exactly
          the same two points as the full-column Rule above. */}
      <Frame className="pt-20 pb-10 md:pt-28 md:pb-12">
        <Reveal>
          <SectionHeading eyebrow={TRUST.kicker}>
            {TITLE}
          </SectionHeading>
        </Reveal>
      </Frame>

      <Rule />

      {/* The imprint. Rows, not cards: the rule under each entry is the
          only thing grouping them, which is what keeps this from reading
          as the anatomy strip or the solutions ledger higher up. */}
      <Frame className="pb-20 md:pb-28">
        <dl>
          {TRUST.items.map((item, i) => {
            const entry = ENTRY[item.id];
            const datum =
              item.id === "languages" ? `${langCount} languages` : entry?.datum;

            return (
              <div key={item.id}>
                <Reveal delay={i * 0.06}>
                  <div
                    className={cn(
                      "grid gap-x-8 gap-y-3 py-7",
                      "md:grid-cols-[132px_minmax(0,1fr)_148px] md:items-baseline md:gap-x-12 md:py-9",
                    )}
                  >
                    <div className="flex items-center justify-between gap-4 md:block">
                      <span className={KEY_TYPE}>{entry?.key ?? item.id}</span>
                      {/* Below md the datum rides up beside its key: a
                          right-hand column on a phone is a column of two
                          words with a screen of dead air beside it. */}
                      {datum ? (
                        <span className={cn(DATUM_TYPE, "md:hidden")}>
                          {datum}
                        </span>
                      ) : null}
                    </div>

                    <div>
                      <dt className="text-[19px] leading-7 tracking-[-0.01em] text-pretty md:text-[21px] md:leading-8">
                        {item.label}
                      </dt>
                      <dd className="mt-2 max-w-[62ch] text-[15px] leading-6 text-pretty text-pp-muted md:text-base md:leading-7">
                        {item.note}
                      </dd>
                    </div>

                    {datum ? (
                      <div className={cn(DATUM_TYPE, "hidden text-right md:block")}>
                        {datum}
                      </div>
                    ) : (
                      <div aria-hidden className="hidden md:block" />
                    )}
                  </div>
                </Reveal>

                <DrawnRule delay={i * 0.06 + 0.1} />
              </div>
            );
          })}
        </dl>
      </Frame>
    </section>
  );
}
