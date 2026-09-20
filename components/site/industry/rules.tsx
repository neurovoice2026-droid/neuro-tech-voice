"use client";

import { useState } from "react";
import type { Trade } from "@/lib/pages/industries/schema";
import { cn } from "@/lib/utils";
import { Eyebrow, Frame, SectionTitle } from "../product/primitives";
import { markProved } from "./proved";

/* ------------------------------------------------------------------ *
 * §6 — Your rules.
 *
 * The objection: it won't know how we do things. The answer is that the
 * trade only seeds the brief — the brief is yours, and flipping a line
 * of it visibly changes how a call goes.
 *
 * Three honest toggles rather than a free-text box: there is no backend
 * here, nothing to inject a prompt into, and a text field on a marketing
 * page that pretends to reconfigure a live agent would be a lie with an
 * input caret in it.
 * ------------------------------------------------------------------ */

export function Rules({ trade }: { trade: Trade }) {
  const [on, setOn] = useState(() => trade.rules.map((r) => r.on));

  function flip(i: number) {
    setOn((prev) => prev.map((v, j) => (j === i ? !v : v)));
    markProved("rules");
  }

  return (
    <section id="rules" className="scroll-mt-28">
      <Frame className="px-6 md:px-12">
        <Eyebrow>Your rules</Eyebrow>
        <SectionTitle className="mt-4 max-w-[820px]">
          It starts briefed for your trade. The brief is yours to change.
        </SectionTitle>
        <p className="mt-5 max-w-[560px] text-base leading-[25px] text-pp-ink/80">
          Your trade decides what it knows on day one. You decide the rest — and every line you change
          shows up in how the next call goes, not in a settings page nobody reads.
        </p>
      </Frame>

      <Frame className="mt-8 px-2 md:px-4">
        <div className="rounded-[24px] bg-white p-4 shadow-[0_0_0_1px_rgb(24_16_40/0.06)] md:p-7">
          <ul className="divide-y divide-pp-rule">
            {trade.rules.map((rule, i) => (
              <li key={rule.label} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-start gap-4">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on[i]}
                    onClick={() => flip(i)}
                    className="mt-0.5 shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink"
                  >
                    <span
                      className={cn(
                        "flex h-6 w-10 items-center rounded-full p-0.5 transition-colors duration-200",
                        on[i] ? "bg-pp-ink" : "bg-pp-rule",
                      )}
                    >
                      <span
                        className={cn(
                          "size-5 rounded-full bg-white transition-transform duration-200",
                          on[i] && "translate-x-4",
                        )}
                      />
                    </span>
                    <span className="sr-only">{rule.label}</span>
                  </button>

                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-[16px] leading-6 transition-colors",
                        on[i] ? "text-pp-ink" : "text-pp-muted",
                      )}
                    >
                      {rule.label}
                    </p>
                    <p className="mt-1.5 min-h-[40px] text-[14px] leading-5 text-pp-muted">
                      {on[i] ? (
                        <span key="on" className="ind-swap block">
                          {rule.changes}
                        </span>
                      ) : (
                        <span key="off" className="ind-swap block text-pp-muted/70">
                          Off. The call goes ahead without it.
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Frame>

      <Frame className="mt-5 px-6 md:px-12">
        <p className="max-w-[620px] text-[13px] leading-5 text-pp-muted">
          Same agent, your vocabulary. The trade seeds the prompt; everything after that is yours, and
          you can read the whole of it in the dashboard rather than guessing at what it was told.
        </p>
      </Frame>
    </section>
  );
}
