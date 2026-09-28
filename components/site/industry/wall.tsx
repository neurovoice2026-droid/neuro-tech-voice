"use client";

import { useEffect, useRef, useState } from "react";
import type { Trade } from "@/lib/pages/industries/schema";
import { cn } from "@/lib/utils";
import { Eyebrow, Frame, SectionTitle } from "../product/primitives";
import { useInView, usePrefersReducedMotion } from "../product/timing";
import { EMBER, EMBER_INK } from "./parts";
import { markProved } from "./proved";

/* ------------------------------------------------------------------ *
 * §4 — The wall, and the retraction.
 *
 * The objection: it will make something up and land me in trouble. The
 * interesting thing about the agent is not what it says, it is what it
 * will not say, and that you cannot talk it out of it.
 *
 * So the instrument is pressure. Four detents, labelled in the words a
 * pushy caller really escalates through. The refusal's WORDING changes
 * at each one; its shape never does.
 *
 * And at the third detent, the thing nobody in this category has
 * shipped: the agent begins to say the forbidden sentence — and is cut
 * off mid-word. The half-sentence stays on screen, struck through, as a
 * record of what was nearly said, with the clause that stopped it named
 * in the margin. Owners are not afraid the agent will be stupid. They
 * are afraid it will be confident, and this is the only honest way to
 * answer that: show it starting to be wrong, and stopping.
 * ------------------------------------------------------------------ */

type Beat = "begins" | "cut" | "instead";

export function Wall({ trade }: { trade: Trade }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, "-20% 0px");
  const still = usePrefersReducedMotion();
  const { wall } = trade;

  const [at, setAt] = useState(0);
  const [touched, setTouched] = useState(false);

  // Walks 1 → 2 → 3 once and rests on the retraction, wall intact.
  const started = useRef(false);
  const timers = useRef<number[]>([]);
  // Unmount only — see the note in first-question.tsx. A reader who scrolls
  // past mid-walk must not be left staring at detent one.
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  useEffect(() => {
    if (still) {
      setAt(wall.retraction.atDetent);
      return;
    }
    if (!inView || touched || started.current) return;
    started.current = true;
    timers.current = [
      window.setTimeout(() => setAt(1), 1500),
      window.setTimeout(() => setAt(wall.retraction.atDetent), 3600),
    ];
  }, [inView, touched, still, wall.retraction.atDetent]);

  function pick(i: number) {
    started.current = true;
    setTouched(true);
    setAt(i);
    markProved("wall");
  }

  const detent = wall.detents[at];
  const isRetraction = at === wall.retraction.atDetent;
  const crossed = at === wall.detents.length - 1;

  return (
    <section id="wall" ref={ref} className="scroll-mt-28">
      <Frame className="px-6 md:px-12">
        <Eyebrow>The wall</Eyebrow>
        <SectionTitle className="mt-4 max-w-[860px]">
          <span className="text-pp-muted">It will not </span>
          {wall.never}
        </SectionTitle>
        <p className="mt-5 max-w-[560px] text-base leading-[25px] text-pp-ink/80">
          Lean on it. The words change as the caller pushes; the answer does not. Push all the way and
          the only thing that gives is that it stops arguing and fetches a person.
        </p>
      </Frame>

      <Frame className="mt-8 px-2 md:px-4">
        <div className="rounded-[24px] bg-white p-4 shadow-[0_0_0_1px_rgb(24_16_40/0.06)] md:p-7">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
            <div>
              {/* The pressure rail. Four detents, harder each time. */}
              <div
                role="radiogroup"
                aria-label="How hard the caller pushes"
                className="flex items-center gap-1.5"
              >
                {wall.detents.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    role="radio"
                    aria-checked={i === at}
                    aria-label={`Pressure ${i + 1} of ${wall.detents.length}`}
                    onClick={() => pick(i)}
                    className="group flex h-11 flex-1 items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink"
                  >
                    <span
                      className="h-1 w-full rounded-full transition-colors duration-200"
                      style={{
                        background:
                          i > at
                            ? "var(--pp-rule)"
                            : i === wall.detents.length - 1 && crossed
                              ? "#551a89"
                              : trade.ink.ember
                                ? EMBER
                                : "#000",
                      }}
                    />
                  </button>
                ))}
              </div>

              <p className="mt-1 text-[11px] leading-4 tracking-[0.1em] text-pp-muted uppercase">
                {crossed ? "It stops arguing" : `Pressure ${at + 1} of ${wall.detents.length}`}
              </p>

              {/* Each part of the exchange is laid out once per detent in the
                  same cell, invisibly — the retraction at its fullest, with
                  the answer it gives instead — so the walk from one detent to
                  the next, which plays by itself, never moves a line: not the
                  Agent label under a caller line that wraps differently, and
                  not anything below the card. */}
              <div className="mt-7 min-h-[230px]">
                <p className="text-[11px] leading-4 font-medium tracking-[0.12em] text-pp-muted uppercase">
                  Caller
                </p>
                <div className="mt-2 grid content-start">
                  <p
                    key={`c-${at}`}
                    className="ind-swap font-[family-name:var(--font-pp-cinema)] text-[21px] leading-8 text-pp-ink italic [grid-area:1/1] md:text-[24px] md:leading-9"
                  >
                    &ldquo;{detent.caller}&rdquo;
                  </p>
                  {wall.detents.map((d, i) => (
                    <p
                      key={i}
                      aria-hidden
                      className="invisible font-[family-name:var(--font-pp-cinema)] text-[21px] leading-8 italic [grid-area:1/1] md:text-[24px] md:leading-9"
                    >
                      &ldquo;{d.caller}&rdquo;
                    </p>
                  ))}
                </div>

                <p className="mt-6 text-[11px] leading-4 font-medium tracking-[0.12em] uppercase" style={{ color: "#551a89" }}>
                  Agent
                </p>

                <div className="grid content-start">
                  <div className="[grid-area:1/1]">
                    {isRetraction ? (
                      <Retraction key={`r-${at}`} wall={wall} ember={trade.ink.ember} still={still} />
                    ) : (
                      <p key={`a-${at}`} className="ind-swap mt-2 max-w-[560px] text-[17px] leading-7 text-pp-ink">
                        {detent.agent}
                      </p>
                    )}
                  </div>
                  {wall.detents.map((d, i) => (
                    <div key={i} aria-hidden className="invisible [grid-area:1/1]">
                      {i === wall.retraction.atDetent ? (
                        <div className="mt-2 max-w-[560px]">
                          <p className="text-[17px] leading-7">
                            {wall.retraction.begins}
                            <span className="font-light">|</span>
                          </p>
                          <p className="mt-1 text-[11px] leading-4 tracking-[0.1em] uppercase">Stopped mid-word</p>
                          <p className="mt-4 text-[17px] leading-7">{wall.retraction.instead}</p>
                        </div>
                      ) : (
                        <p className="mt-2 max-w-[560px] text-[17px] leading-7">{d.agent}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* The clause. Quoted, and sourced, because "it won't do that"
                is worth nothing next to the sentence that stops it. */}
            <aside className="rounded-2xl bg-pp-card p-5">
              <p className="text-[11px] leading-4 font-medium tracking-[0.12em] text-pp-muted uppercase">
                What stops it
              </p>
              <p className="mt-3 text-[15px] leading-[23px] text-pp-ink">&ldquo;{wall.clause}&rdquo;</p>
              <p className="mt-4 border-t border-pp-hair pt-3 text-[13px] leading-5 text-pp-muted">
                {wall.clauseSource}
              </p>
            </aside>
          </div>
        </div>
      </Frame>

      <Frame className="mt-5 px-6 md:px-12">
        <p className="max-w-[620px] text-[13px] leading-5 text-pp-muted">{wall.crosses}</p>
      </Frame>
    </section>
  );
}

/**
 * The half-sentence.
 *
 * It types, it is cut mid-word, and what was nearly said stays on screen
 * struck through rather than being tidied away — the record is the
 * point. Then the answer it is actually allowed to give arrives under it.
 */
function Retraction({
  wall,
  ember,
  still,
}: {
  wall: Trade["wall"];
  ember: boolean;
  still: boolean;
}) {
  const [beat, setBeat] = useState<Beat>(still ? "instead" : "begins");

  useEffect(() => {
    if (still) return;
    const cut = window.setTimeout(() => setBeat("cut"), 1250);
    const instead = window.setTimeout(() => setBeat("instead"), 1950);
    return () => {
      window.clearTimeout(cut);
      window.clearTimeout(instead);
    };
  }, [still]);

  // The strike is a graphic and may use the warm ember; the label under it
  // is 11px and may not.
  const ink = ember ? EMBER : "#551a89";
  const labelInk = ember ? EMBER_INK : "#551a89";

  return (
    <div className="mt-2 max-w-[560px]">
      <p
        className={cn(
          "text-[17px] leading-7 transition-all duration-300",
          beat === "begins" ? "ind-type text-pp-ink" : "text-pp-muted line-through decoration-2",
        )}
        style={beat !== "begins" ? { textDecorationColor: ink } : undefined}
      >
        {wall.retraction.begins}
        {beat === "begins" && <span className="ind-caret">|</span>}
      </p>

      {beat !== "begins" && (
        <p className="ind-swap mt-1 text-[11px] leading-4 tracking-[0.1em] uppercase" style={{ color: labelInk }}>
          Stopped mid-word
        </p>
      )}

      {beat === "instead" && (
        <p className="ind-swap mt-4 text-[17px] leading-7 text-pp-ink">{wall.retraction.instead}</p>
      )}
    </div>
  );
}
