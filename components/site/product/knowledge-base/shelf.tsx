"use client";

import { useEffect, useRef, useState } from "react";
import { SHELF, type KbDocKind } from "@/lib/pages/knowledge-base";
import { cn } from "@/lib/utils";
import { Frame, SectionHeading } from "../primitives";
import { useInView, usePrefersReducedMotion } from "../timing";
import { DocBadge } from "./parts";

/* ------------------------------------------------------------------ *
 * What to add, as a shelf of six kinds of document.
 *
 * Each card holds a sheet sketched in a few ruled lines. The card that is
 * "asked" — under the pointer, or next in the shelf's own slow round — has
 * a caller's question rise over its sheet and one of its lines marked, the
 * way the reading room marks the line it answered from.
 * ------------------------------------------------------------------ */

/** A sheet's file type, its ruled lines, and which line answers the card's question. */
const SHEETS: Record<string, { kind: KbDocKind; widths: number[]; hit: number }> = {
  prices: { kind: "PDF", widths: [72, 90, 64, 82, 58], hit: 1 },
  policies: { kind: "DOCX", widths: [86, 60, 78, 92, 66], hit: 2 },
  services: { kind: "MD", widths: [64, 88, 80, 56, 74], hit: 3 },
  visits: { kind: "TXT", widths: [90, 70, 58, 84, 62], hit: 0 },
  access: { kind: "PDF", widths: [60, 84, 92, 68, 76], hit: 1 },
  web: { kind: "URL", widths: [78, 62, 88, 70, 84], hit: 4 },
};

export function KbShelf() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, "-15% 0px");
  const reduce = usePrefersReducedMotion();
  const [round, setRound] = useState(0);
  const [held, setHeld] = useState<number | null>(null);

  useEffect(() => {
    if (!inView || reduce || held !== null) return;
    const id = window.setInterval(() => setRound((r) => (r + 1) % SHELF.kinds.length), 2600);
    return () => window.clearInterval(id);
  }, [inView, reduce, held]);

  const asked = held ?? (reduce ? -1 : round);

  return (
    <>
      <Frame className="px-6 pb-10 md:px-12 md:pb-14">
        <SectionHeading eyebrow={SHELF.eyebrow} className="max-w-[820px]">
          {SHELF.title}
        </SectionHeading>
      </Frame>

      <Frame className="px-4 md:px-6">
        <div ref={ref} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SHELF.kinds.map((k, i) => {
            const on = asked === i;
            const sheet = SHEETS[k.id];
            return (
              <div
                key={k.id}
                onPointerEnter={() => setHeld(i)}
                onPointerLeave={() => setHeld(null)}
                className="relative flex flex-col overflow-hidden rounded-[24px] bg-pp-card p-6 md:p-7"
              >
                <div className="relative h-[168px]">
                  {/* The sheet */}
                  <div
                    className={cn(
                      "absolute inset-x-6 top-2 bottom-0 rounded-t-xl bg-white p-4 shadow-[0_0_0_1px_rgb(24_16_40/0.06),0_16px_32px_-22px_rgb(24_16_40/0.35)] transition-transform duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
                      on ? "-translate-y-1" : "translate-y-2",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <DocBadge kind={sheet.kind} small />
                      <span className="block h-1.5 w-16 rounded-full bg-pp-ink/15" />
                    </div>
                    <div className="mt-3.5 flex flex-col gap-2">
                      {sheet.widths.map((w, j) => (
                        <span key={j} className="relative block h-1.5 rounded-full bg-pp-ink/[0.07]" style={{ width: `${w}%` }}>
                          {j === sheet.hit && (
                            <span
                              aria-hidden
                              className="absolute -inset-x-1 -inset-y-1 origin-left rounded bg-[#551a89]/15"
                              style={{
                                transform: `scaleX(${on ? 1 : 0})`,
                                transition: reduce ? "none" : "transform 600ms cubic-bezier(0.2, 0.8, 0.2, 1) 250ms",
                              }}
                            />
                          )}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* The question it answers */}
                  <p
                    aria-hidden
                    className={cn(
                      "absolute right-2 bottom-5 max-w-[80%] rounded-[14px] bg-pp-ink px-3 py-2 text-[13px] leading-[18px] text-white shadow-[0_12px_24px_-12px_rgb(0_0_0/0.45)] transition-[opacity,translate] duration-500",
                      on ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
                    )}
                  >
                    “{k.ask}”
                  </p>
                </div>

                <h3 className="mt-6 text-base leading-6">{k.title}</h3>
                <p className="mt-1 text-[15px] leading-[22px] text-pp-muted">{k.body}</p>
                {/* Read aloud as part of the card, whether or not it is showing. */}
                <p className="sr-only">Answers questions like “{k.ask}”</p>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-col gap-4 rounded-[24px] border border-pp-hair px-6 py-5 md:flex-row md:items-center md:justify-between md:px-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[12px] leading-4 font-medium tracking-[0.14em] text-pp-muted uppercase">
              {SHELF.formats.title}
            </span>
            {SHELF.formats.items.map((f) => (
              <span key={f} className="rounded-full bg-pp-card px-2.5 py-1 text-[12px] leading-4">
                {f}
              </span>
            ))}
            <span className="text-[13px] leading-[18px] text-pp-muted">· {SHELF.formats.limit}</span>
          </div>
          <p className="text-[13px] leading-[18px] text-pp-muted md:max-w-[380px] md:text-right">{SHELF.formats.tip}</p>
        </div>
      </Frame>
    </>
  );
}
