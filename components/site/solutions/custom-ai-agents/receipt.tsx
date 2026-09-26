"use client";

import { useEffect, useRef, useState } from "react";
import type { CAA_RECEIPT } from "@/lib/pages/custom-ai-agents";
import { IntentLink } from "@/components/site/intent-link";
import { Eyebrow, Frame, PillLink, SectionTitle } from "@/components/site/product/primitives";
import { useInView, usePrefersReducedMotion } from "@/components/site/product/timing";
import { cn } from "@/lib/utils";
import { Stack } from "./parts";
import { useProved, type CaaClaim } from "./proved";

/* ------------------------------------------------------------------ *
 * §6 — What you just watched.
 *
 * The close is a receipt, as on the trades: not a summary and not a row
 * of tiles, but the five claims the page made, each with the node the
 * figures use — inked if the reader worked the instrument that proves
 * it, hollow if they walked past. A hollow row is a link back to its
 * instrument, so "Try it" is literally true.
 *
 * WHY IT IS HONEST ABOUT WHAT IT DID NOT SHOW. Every instrument above ran
 * on Quillmoor Heating, a firm we made up. The one claim a sceptic
 * actually cares about — that it fits *their* business — was never
 * demonstrated, and the page says so in a block of its own, in violet
 * (the product acting: the one thing only a call with us can do), with
 * the call as its only action. Beside it, "When you don't need us" sends
 * the reader who doesn't need a build to the self-serve setup. A page
 * selling custom work that names the case where you shouldn't buy it is
 * more believable about the cases where you should.
 *
 * WHY A CLIENT COMPONENT. The inked state lives in the page-local store
 * (proved.ts) that the instruments write to. Its server snapshot is
 * EMPTY, so the server and the first client render both draw every row
 * hollow and hydration agrees; the rows ink on the next render if the
 * reader has already operated something.
 *
 * WHY THE INK WAITS FOR THE READER. A claim is proved up in the Wiring
 * or the Names, long before the reader scrolls here, so a node that
 * filled the moment its claim was proved would always fill off screen
 * and the receipt would arrive already written. Instead the node inks
 * where it can be seen: when the list first crosses into the middle of
 * the viewport (-20% top and bottom, so a list glimpsed at the very
 * edge does not spend it), every row that is proved but not yet shown
 * inked fills, in list order, 110ms apart, over the node's existing
 * 300ms colour transition. That is the whole of it — no ring, no bounce,
 * no count: the page is reading back what the reader did, not
 * congratulating them. Rows the reader proves later ink on the next
 * return, as their own small batch. A row never un-inks, so scrolling
 * away and back replays nothing.
 *
 * THE WORD DOES NOT WAIT. The status follows the store (`proved`), not
 * the ink (`shown`), so assistive technology and a reader who looks at
 * the words are never told anything false, even during the stagger; only
 * the node, which is aria-hidden, is paced. Observing the list is not
 * operating anything, so nothing here calls markProved. Under reduced
 * motion the node inks as soon as the claim is proved and `caa-calm`
 * pins its transition off.
 *
 * RESERVATION. "Proved" and "Try it" are different widths, and the
 * status sits at the end of a flex row whose text may wrap. Were the
 * word to swap in place, a row could re-wrap and push every row below
 * it. So the status is a two-variant Stack: always as wide as the wider
 * word, the row never reflows when it inks.
 *
 * COLOUR. The inked node is black, not violet or green: proving a claim
 * is the reader's act, not the product's and not a test result, and the
 * figures above use ink for "done". The row text stays ink either way —
 * the node and the word carry the state, so colour is never the only
 * carrier, and a hollow row does not look disabled (it is the most
 * useful link in the list).
 * ------------------------------------------------------------------ */

const LINK =
  "inline-flex min-h-6 items-center text-[14px] leading-5 underline-offset-4 transition-colors hover:text-[#551a89] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink";

/** Gap between one node inking and the next, in list order. */
const STAGGER_MS = 110;

export function Receipt({ data }: { data: typeof CAA_RECEIPT }) {
  const proved = useProved();
  const still = usePrefersReducedMotion();
  const listRef = useRef<HTMLUListElement>(null);
  const inView = useInView(listRef, "-20% 0px");
  // Rows already inked in front of the reader, each with the delay it
  // inked on. Presence is the state; the number only paces the batch.
  const [shown, setShown] = useState<Readonly<Partial<Record<CaaClaim, number>>>>({});
  const rows = data.rows;

  useEffect(() => {
    if (!inView || still || proved.length === 0) return;
    // One frame later, one render for the whole batch. The fresh rows are
    // worked out inside the updater so `shown` need not be a dependency
    // (it would re-run this effect on its own write); an updater that
    // finds nothing new returns the same object and React bails out.
    const raf = requestAnimationFrame(() =>
      setShown((s) => {
        const fresh = rows.filter((r) => proved.includes(r.id) && !(r.id in s));
        if (fresh.length === 0) return s;
        return { ...s, ...Object.fromEntries(fresh.map((r, i) => [r.id, i * STAGGER_MS])) };
      }),
    );
    return () => cancelAnimationFrame(raf);
  }, [inView, proved, still, rows]);

  // The two words the status Stack reserves between.
  const words = [data.tryIt, data.proved] as const;

  return (
    <section id="receipt" className="scroll-mt-28">
      <Frame className="px-6 md:px-12">
        <Eyebrow>{data.eyebrow}</Eyebrow>
        <SectionTitle className="mt-4 max-w-[820px]">{data.title}</SectionTitle>
      </Frame>

      <Frame className="mt-8 px-6 md:px-12">
        <ul ref={listRef} className="max-w-[820px] divide-y divide-pp-rule border-y border-pp-rule">
          {data.rows.map((row) => {
            const done = proved.includes(row.id);
            const on = still ? done : row.id in shown;
            return (
              <li key={row.id}>
                <a
                  href={row.href}
                  className="flex items-baseline gap-4 py-4 text-pp-ink transition-colors hover:text-pp-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink"
                >
                  <span
                    aria-hidden
                    className="caa-calm mt-[7px] size-2.5 shrink-0 self-start rounded-full border-[1.6px] transition-[background-color,border-color] duration-300"
                    style={{
                      borderColor: on ? "#000" : "var(--pp-hair)",
                      background: on ? "#000" : "transparent",
                      // Only the fill is staggered; nothing ever un-inks.
                      transitionDelay: on ? `${shown[row.id] ?? 0}ms` : "0ms",
                    }}
                  />
                  <span className="min-w-0 text-[16px] leading-6">{row.said}</span>
                  <Stack
                    items={words}
                    live={done ? 1 : 0}
                    render={(w) => w}
                    // The row lands inked while the reader is elsewhere; a
                    // rise on arrival would be motion nobody asked for.
                    swap={false}
                    className="ml-auto shrink-0 text-right text-[11px] leading-4 tracking-[0.1em] text-pp-muted uppercase"
                  />
                </a>
              </li>
            );
          })}
        </ul>
      </Frame>

      <Frame className="mt-10 px-6 md:px-12">
        <div className="grid max-w-[820px] gap-8 md:grid-cols-2 md:gap-10">
          <div className="flex flex-col items-start">
            <p className="text-[11px] leading-4 font-medium tracking-[0.12em] text-pp-accent uppercase">
              {data.missing.label}
            </p>
            <p className="mt-3 text-[15px] leading-[23px] text-pp-ink">{data.missing.body}</p>
            <PillLink href={data.missing.cta.href} variant="secondary" size="md" className="mt-5">
              {data.missing.cta.label}
            </PillLink>
          </div>
          <div className="flex flex-col items-start">
            <p className="text-[11px] leading-4 font-medium tracking-[0.12em] text-pp-muted uppercase">
              {data.selfServe.label}
            </p>
            <p className="mt-3 text-[15px] leading-[23px] text-pp-ink">{data.selfServe.body}</p>
            <IntentLink href={data.selfServe.link.href} className={cn(LINK, "mt-4")}>
              {data.selfServe.link.label} →
            </IntentLink>
          </div>
        </div>
      </Frame>
    </section>
  );
}
