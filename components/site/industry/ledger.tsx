"use client";

import type { Trade } from "@/lib/pages/industries/schema";
import { Eyebrow, Frame, SectionTitle } from "../product/primitives";
import { OurEstimate } from "./parts";
import { useProved, type Claim } from "./proved";

/* ------------------------------------------------------------------ *
 * §8 — What you just proved.
 *
 * The close is a receipt, not a summary and not a row of tiles. Each
 * claim the page made, with the same node grammar the figures use:
 * inked if you worked the instrument that proves it, hollow if you
 * walked past. Tapping a hollow one takes you back to it.
 *
 * The last row is the only claim on the page that was never
 * demonstrated, and it says so. That row is where the money argument
 * lives — our own estimate, with the reasoning attached, and no annual
 * total, because every figure of that shape we checked in this category
 * turned out to be a per-call number multiplied by a call volume the
 * reader never agreed to.
 * ------------------------------------------------------------------ */

const ROWS: { id: Claim; href: string; said: string }[] = [
  { id: "fork", href: "#top", said: "Three kinds of call come in, and it knows which is which" },
  { id: "bench", href: "#bench", said: "It understands how your callers actually talk" },
  { id: "run", href: "#run", said: "Every line on the paperwork came from a second of the call" },
  { id: "wall", href: "#wall", said: "It will not say the thing that would land you in trouble" },
  { id: "relay", href: "#relay", said: "When it can't finish a call, a person knows while the caller is still there" },
  { id: "rules", href: "#rules", said: "The brief is yours to change" },
];

export function Ledger({ trade }: { trade: Trade }) {
  const proved = useProved();

  return (
    <section>
      <Frame className="px-6 md:px-12">
        <Eyebrow>What you just proved</Eyebrow>
        <SectionTitle className="mt-4 max-w-[760px]">
          Six claims. You operated the ones that are filled in.
        </SectionTitle>
      </Frame>

      <Frame className="mt-8 px-6 md:px-12">
        <ul className="max-w-[820px]">
          {ROWS.map((row) => {
            const on = proved.includes(row.id);
            return (
              <li key={row.id} className="border-b border-pp-rule">
                <a
                  href={row.href}
                  className="flex items-baseline gap-4 py-4 transition-colors hover:text-pp-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink"
                >
                  <span
                    aria-hidden
                    className="mt-[7px] size-2.5 shrink-0 rounded-full border-[1.6px] transition-colors"
                    style={{
                      borderColor: on ? "#000" : "var(--pp-hair)",
                      background: on ? "#000" : "transparent",
                    }}
                  />
                  <span className={on ? "text-[16px] leading-6 text-pp-ink" : "text-[16px] leading-6 text-pp-muted"}>
                    {row.said}
                  </span>
                  <span className="ml-auto shrink-0 text-[11px] tracking-[0.1em] text-pp-muted uppercase">
                    {on ? "Proved" : "Try it"}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>

        {/* The one claim this page did not demonstrate, said plainly. */}
        <div className="mt-10 max-w-[820px] border-t border-pp-rule pt-8">
          <p className="text-[11px] leading-4 font-medium tracking-[0.12em] text-pp-muted uppercase">
            The one we did not demonstrate
          </p>
          <div className="mt-4 grid gap-8 md:grid-cols-2">
            <OurEstimate value={trade.missRate.value} reasoning={trade.missRate.reasoning} />
            <OurEstimate value={trade.valuePerCall.value} reasoning={trade.valuePerCall.reasoning} />
          </div>

          {trade.citations.length > 0 && (
            <dl className="mt-8 space-y-4">
              {trade.citations.map((c) => (
                <div key={c.publisher} className="border-t border-pp-hair pt-3">
                  <dt className="text-[14px] leading-[21px] text-pp-ink">{c.claim}</dt>
                  <dd className="mt-1 text-[12px] leading-[18px] text-pp-muted">
                    {c.publisher}, {c.date}. {c.sample}
                    {c.interest ? ` ${c.interest}` : ""}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </Frame>
    </section>
  );
}
