"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, Coins, GitCompare, KeyRound, Wrench } from "lucide-react";
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
import { Reveal, EASE } from "./reveal";

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
 * Two decisions worth keeping:
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
 */

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
 * common way a chart like this fails.
 */
const TONE: Record<PartState, string> = {
  shipped:
    "border-[var(--cover-brand-lit)]/55 bg-[var(--cover-brand-lit)] text-[var(--cover-ink)]",
  metered:
    "border-[var(--cover-brand-lit)]/45 bg-[var(--cover-brand-lit)]/16 text-[var(--cover-brand-lit)]",
  byo: "border-dashed border-[var(--cover-paper)]/30 text-[var(--cover-paper)]/55",
  // Dim is the point, but the icon still has to be discernible — the reader
  // is meant to see that something is there and that it is not lit, not to
  // wonder whether the cell is empty.
  build: "border-[var(--cover-paper)]/10 bg-[var(--cover-paper)]/[0.03] text-[var(--cover-paper)]/32",
};

/** Label column, then one per vendor. Kept in one place — five grids use it. */
const COLS = {
  gridTemplateColumns: `minmax(11em, 1.85fr) repeat(${RIVALS.length}, minmax(6.4em, 1fr))`,
};

function Cell({ state, rivalOurs }: { state: PartState; rivalOurs?: boolean }) {
  const Icon = ICONS[state];
  return (
    <div
      className={cn(
        "flex items-center justify-center px-[0.4em] py-[0.55em]",
        rivalOurs && "bg-[var(--cover-brand-lit)]/[0.05]",
      )}
    >
      <span
        title={PART_STATES[state].label}
        className={cn(
          "grid size-[1.9em] place-items-center rounded-[0.4em] border transition-colors duration-300",
          TONE[state],
        )}
      >
        <Icon className="size-[0.95em]" strokeWidth={2.4} aria-hidden />
        <span className="sr-only">{PART_STATES[state].label}</span>
      </span>
    </div>
  );
}

export function Comparison() {
  const reduce = useReducedMotion();

  const groups = [
    {
      id: "stack" as const,
      label: "The voice stack",
      note: "A solved, competitive market",
    },
    {
      id: "business" as const,
      label: "Your business",
      note: "Not a market — work",
    },
  ];

  return (
    <section
      id="difference"
      className="relative scroll-mt-24 px-[1.6em] py-[6em] md:py-[8em]"
    >
      <div className="relative mx-auto max-w-[76em]">
        {/* header */}
        <div className="mx-auto flex max-w-[42em] flex-col items-center text-center">
          <Reveal>
            <span className="inline-flex items-center gap-[0.55em] rounded-full border border-[var(--cover-brand-lit)]/25 bg-[var(--cover-brand-lit)]/10 px-[1.15em] py-[0.5em] text-[0.72em] font-semibold uppercase leading-none tracking-[0.18em] text-[var(--cover-brand-lit)]">
              <GitCompare className="size-[1.25em] shrink-0" strokeWidth={2} />
              {COMPARISON_INTRO.eyebrow}
            </span>
          </Reveal>

          <Reveal delay={0.06} className="mt-[1em]">
            <h2 className="text-balance text-[2.8em] font-medium leading-[1.03] tracking-[-0.045em] md:text-[3.4em]">
              {COMPARISON_INTRO.title}
            </h2>
          </Reveal>

          <Reveal
            delay={0.12}
            className="mt-[1.1em] max-w-[38em] text-pretty text-[1.05em] leading-[1.6] text-[var(--cover-paper)]/60"
          >
            {COMPARISON_INTRO.sub}
          </Reveal>
        </div>

        {/* the board */}
        <Reveal delay={0.08} y={32} className="mt-[3.5em] md:mt-[4.5em]">
          <div className="overflow-hidden rounded-[1.2em] border border-[var(--cover-paper)]/12 bg-[var(--cover-panel)] shadow-[0_2em_5em_-1.8em_rgba(0,0,0,0.9)]">
            {/* Five columns will not fit a phone, and shrinking them to fit
                would destroy the one thing the grid exists to show. It
                scrolls instead, with a floor wide enough to keep the shape
                intact. */}
            <div className="overflow-x-auto [scrollbar-width:thin]">
              <div className="min-w-[42em]">
                {/* vendor headers */}
                <div
                  className="grid items-end border-b border-[var(--cover-paper)]/12"
                  style={COLS}
                >
                  <div className="px-[1.4em] pb-[0.9em] pt-[1.4em]">
                    <p className="mono text-[0.6em] uppercase tracking-[0.22em] text-[var(--cover-paper)]/35">
                      What a working phone agent needs
                    </p>
                  </div>

                  {RIVALS.map((r) => (
                    <div
                      key={r.id}
                      className={cn(
                        "px-[0.5em] pb-[0.9em] pt-[1.4em] text-center",
                        r.ours &&
                          "rounded-t-[0.6em] border-x border-t border-[var(--cover-brand-lit)]/25 bg-[var(--cover-brand-lit)]/[0.07]",
                      )}
                    >
                      <p
                        className={cn(
                          "text-[0.92em] leading-tight",
                          r.ours
                            ? "font-medium text-[var(--cover-brand-lit)]"
                            : "text-[var(--cover-paper)]/75",
                        )}
                      >
                        {r.name}
                      </p>
                      <p className="mono mt-[0.5em] text-[0.55em] uppercase leading-[1.4] tracking-[0.12em] text-[var(--cover-paper)]/28">
                        {r.kind}
                      </p>
                    </div>
                  ))}
                </div>

                {groups.map((g) => (
                  <div key={g.id}>
                    {/* The rule. Below the second one, four of the five
                        columns go dark all the way down. */}
                    <div
                      className="grid items-center border-b border-[var(--cover-paper)]/10 bg-[var(--cover-paper)]/[0.03]"
                      style={COLS}
                    >
                      {/* Two mono labels on one baseline ran together into
                          a single unreadable string — the tracking that
                          makes them read as rules is the same tracking that
                          swallows a plain gap. Hence the divider. */}
                      <div className="flex flex-wrap items-baseline gap-x-[0.2em] px-[1.4em] py-[0.6em]">
                        <p className="mono text-[0.6em] uppercase tracking-[0.22em] text-[var(--cover-brand-lit)]/70">
                          {g.label}
                        </p>
                        {/* The rule travels with the note rather than
                            sitting between the two, so a wrap breaks before
                            it instead of leaving it dangling off the end of
                            the first line. */}
                        <p className="mono text-[0.55em] uppercase tracking-[0.14em] text-[var(--cover-paper)]/28">
                          <span aria-hidden className="mr-[0.9em] opacity-60">
                            /
                          </span>
                          {g.note}
                        </p>
                      </div>
                      {RIVALS.map((r) => (
                        <div
                          key={r.id}
                          className={cn(
                            "h-full",
                            r.ours &&
                              "border-x border-[var(--cover-brand-lit)]/25 bg-[var(--cover-brand-lit)]/[0.07]",
                          )}
                        />
                      ))}
                    </div>

                    {STACK.filter((l) => l.group === g.id).map((l, i) => (
                      <motion.div
                        key={l.id}
                        // Never from zero opacity: these rows are the
                        // section, and anything starting invisible stays
                        // invisible if the animation does not run — which
                        // is what a backgrounded tab does to rAF.
                        initial={reduce ? false : { opacity: 0.4, y: 4 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-10% 0px" }}
                        transition={{
                          duration: 0.4,
                          delay: i * 0.04,
                          ease: EASE,
                        }}
                        className="grid items-stretch border-b border-[var(--cover-paper)]/[0.06] last:border-b-0"
                        style={COLS}
                      >
                        <div className="flex items-center gap-[0.8em] px-[1.4em] py-[0.5em]">
                          <span className="mono shrink-0 text-[0.6em] tracking-[0.1em] text-[var(--cover-paper)]/25">
                            {l.n}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[0.88em] leading-tight text-[var(--cover-paper)]/85">
                              {l.label}
                            </span>
                            <span className="mt-[0.25em] block text-[0.72em] leading-tight text-[var(--cover-paper)]/32">
                              {l.note}
                            </span>
                          </span>
                        </div>

                        {RIVALS.map((r) => (
                          <div
                            key={r.id}
                            className={cn(
                              "flex items-center justify-center",
                              r.ours &&
                                "border-x border-[var(--cover-brand-lit)]/25",
                            )}
                          >
                            <Cell state={r.parts[l.id]} rivalOurs={r.ours} />
                          </div>
                        ))}
                      </motion.div>
                    ))}
                  </div>
                ))}

                {/* the count, under each column */}
                <div
                  className="grid items-start border-t border-[var(--cover-paper)]/12"
                  style={COLS}
                >
                  <div className="px-[1.4em] py-[1.1em]">
                    <p className="mono text-[0.6em] uppercase tracking-[0.22em] text-[var(--cover-paper)]/35">
                      Left on your desk
                    </p>
                  </div>

                  {RIVALS.map((r) => {
                    const build = STACK.filter(
                      (l) => r.parts[l.id] === "build",
                    ).length;
                    const byo = STACK.filter(
                      (l) => r.parts[l.id] === "byo",
                    ).length;
                    return (
                      <div
                        key={r.id}
                        className={cn(
                          "px-[0.5em] py-[1.1em] text-center",
                          r.ours &&
                            "rounded-b-[0.6em] border-x border-b border-[var(--cover-brand-lit)]/25 bg-[var(--cover-brand-lit)]/[0.07]",
                        )}
                      >
                        <p
                          className={cn(
                            "mono text-[1.9em] leading-none tabular-nums",
                            build === 0
                              ? "text-[var(--cover-brand-lit)]"
                              : "text-[var(--cover-paper)]/80",
                          )}
                        >
                          {build + byo}
                        </p>
                        <p className="mono mt-[0.6em] text-[0.55em] uppercase leading-[1.5] tracking-[0.12em] text-[var(--cover-paper)]/30">
                          {build === 0 ? "nothing" : `of 10 layers`}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* the legend — four states, spelled out */}
            <div className="flex flex-wrap gap-x-[1.6em] gap-y-[0.6em] border-t border-[var(--cover-paper)]/10 px-[1.6em] py-[0.9em] md:px-[2em]">
              {(["shipped", "metered", "byo", "build"] as PartState[]).map(
                (s) => {
                  const Icon = ICONS[s];
                  return (
                    <span
                      key={s}
                      className="flex items-center gap-[0.5em] text-[0.72em] leading-none text-[var(--cover-paper)]/50"
                    >
                      <span
                        className={cn(
                          "grid size-[1.5em] shrink-0 place-items-center rounded-[0.3em] border",
                          TONE[s],
                        )}
                      >
                        <Icon
                          className="size-[0.85em]"
                          strokeWidth={2.4}
                          aria-hidden
                        />
                      </span>
                      <span className="text-[var(--cover-paper)]/80">
                        {PART_STATES[s].label}
                      </span>
                      <span className="hidden text-[var(--cover-paper)]/35 sm:inline">
                        — {PART_STATES[s].note}
                      </span>
                    </span>
                  );
                },
              )}
            </div>

            {/* Who each one is for, in one line — the fairness device, and
                the part that stops the grid reading as a hatchet job. */}
            <div className="border-t border-[var(--cover-paper)]/10 px-[1.6em] py-[1.2em] md:px-[2em]">
              <ul className="flex flex-col gap-[0.7em]">
                {RIVALS.map((r) => (
                  <li
                    key={r.id}
                    className={cn(
                      "text-[0.78em] leading-[1.6]",
                      r.ours
                        ? "text-[var(--cover-paper)]/70"
                        : "text-[var(--cover-paper)]/45",
                    )}
                  >
                    <span
                      className={cn(
                        r.ours
                          ? "text-[var(--cover-brand-lit)]"
                          : "text-[var(--cover-paper)]/80",
                      )}
                    >
                      {r.name}
                    </span>{" "}
                    — built for {r.who.toLowerCase()}. {r.billing}.{" "}
                    <span className="text-[var(--cover-paper)]/30">
                      First answered call: {r.live.toLowerCase()}.
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* the concession, and the receipts */}
            <div className="border-t border-[var(--cover-paper)]/10 bg-[var(--cover-paper)]/[0.025] px-[1.6em] py-[1.2em] md:px-[2em]">
              <p className="max-w-[52em] text-[0.82em] leading-[1.65] text-[var(--cover-paper)]/55">
                {COMPARISON_NOTE}
              </p>
              <p className="mt-[0.9em] max-w-[52em] text-[0.68em] leading-[1.6] text-[var(--cover-paper)]/30">
                {COMPARISON_SOURCE}
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
