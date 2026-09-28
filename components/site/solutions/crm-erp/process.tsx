import { cn } from "@/lib/utils";
import { Frame } from "@/components/site/product/primitives";
import { HomeHeading } from "@/components/site/home/heading";
import { TYPE } from "@/components/site/home/type";
import type { ProcessData, ProcessStep } from "@/lib/pages/crm-erp";
import { pad2 } from "./process-frame";
import { laneWord } from "./process-panels";
import { ProcessStage } from "./process-stage";

/* ------------------------------------------------------------------ *
 * #process — "Will it fit OUR process, not force us into someone
 * else's?"
 *
 * THE SPINE OF THE PAGE, AND ITS ONLY AUTOPLAY. A sample business that
 * quotes, sells from stock, delivers and invoices, drawn twice: Today,
 * its eight tools scattered (an inbox, a quote template, someone's
 * memory, the order sheet, the stock sheet, a shared calendar, the
 * invoicing program, the month-end figures), with the places the same
 * details are typed again marked in ember; and in one system, the same
 * eight steps laid out as lanes of who does each (sales, operations,
 * accounts, and what runs by itself), one customer's order followed from
 * the first call to the month's figures into one record. Every step says
 * who does it, what it is like today and in one system, and whether the
 * same part already runs on this platform, with the #core card that
 * proves it (process-stage.tsx, the client island). It plays once on
 * its own when it first has the screen, and can be paused, switched and
 * walked by hand. The argument of the page in one picture: yours is
 * drawn around how you work, and the hard parts under it already run
 * here.
 *
 * A server component. It sets the section and its heading, hands the
 * stage its slice of the copy as plain props (everything but the index
 * and the foot, which are drawn here), and closes with the index and the
 * foot. The data module is imported for its types only.
 *
 * THE INDEX is the journey in words, in a closed <details> in the
 * landing's FAQ style: each step's number and name, who does it, what it
 * is like today (the tool it lives in, where, and what goes wrong, then
 * the line), in one system, and on this platform (the tag in words, the
 * fact, and the files it runs in, in mono); then where the details are
 * typed again today, and both tallies. The drawing is aria-hidden and
 * the stage shows one step at a time: this is where a reader with no
 * script, find-in-page and a screen reader in a hurry get the whole
 * journey at once. Native <details>, so find-in-page opens it; drawn
 * here, once, since nothing in it changes.
 *
 * GROUND. The section is white; the stage is a still `.home-stage` room
 * inside the island (never lit: the hero's pearl room is one screen up,
 * and #shape's is next), and the heading's key phrase stays on white,
 * where violet reads. The index and the foot are on white too.
 * ------------------------------------------------------------------ */

/** controls.tsx RING_LIGHT, spelled out: controls.tsx is a client module, and this is a server component. */
const RING = "rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink";

export function Process({ data }: { data: ProcessData }) {
  const { indexSummary, index, foot, ...stage } = data;
  return (
    <section id="process" aria-labelledby="process-title" className="scroll-mt-8">
      <Frame>
        <HomeHeading id="process-title" eyebrow={data.eyebrow} title={data.title} titleKey={data.key} sub={data.sub} />
        <ProcessStage data={stage} />
        <Index data={data} summary={indexSummary} words={index} />
        <p className={cn(TYPE.meta, "mt-8 max-w-[640px] text-pretty")}>{foot}</p>
      </Frame>
    </section>
  );
}

/** An answer's name in the index: the landing's label, muted. */
const TERM = cn(TYPE.label, "text-pp-muted");
/** An answer. */
const ANSWER = cn(TYPE.meta, "mt-0.5 text-pretty text-pp-ink/80");

function Step({ data, s, i, words }: { data: ProcessData; s: ProcessStep; i: number; words: ProcessData["index"] }) {
  // Who does it: the lane, and, where it differs, who does it today (what runs by itself is someone's hand today).
  const [today, one] = [laneWord(data, s, "today"), laneWord(data, s, "one")];
  return (
    <li className="grid min-w-0 grid-cols-[28px_minmax(0,1fr)] items-baseline gap-x-2">
      <span aria-hidden className={cn(TYPE.mono, "text-(--home-violet)")}>
        {pad2(i + 1)}
      </span>
      <div className="min-w-0">
        <h4 className={cn(TYPE.body, "font-medium text-pretty text-pp-ink")}>
          <span className="sr-only">{pad2(i + 1)} · </span>
          {s.label}
        </h4>
        <dl className="mt-1.5 flex flex-col gap-2">
          <div>
            <dt className={TERM}>{words.who}</dt>
            <dd className={ANSWER}>
              {today === one ? (
                one
              ) : (
                <>
                  <span className={cn(TYPE.mono, "mr-1.5 text-pp-muted")}>{words.today}</span>
                  {today}
                  <span aria-hidden> · </span>
                  <span className="sr-only">; </span>
                  <span className={cn(TYPE.mono, "mr-1.5 text-pp-muted")}>{words.system}</span>
                  {one}
                </>
              )}
            </dd>
          </div>
          <div>
            <dt className={TERM}>{words.today}</dt>
            <dd className={ANSWER}>
              {s.paper.title}, {s.paper.where.charAt(0).toLowerCase() + s.paper.where.slice(1)}:{" "}
              <span className="text-(--home-ember-ink)">{s.paper.pain.charAt(0).toLowerCase() + s.paper.pain.slice(1)}</span>. {s.today}
            </dd>
          </div>
          <div>
            <dt className={TERM}>{words.system}</dt>
            <dd className={ANSWER}>{s.system}</dd>
          </div>
          <div>
            <dt className={TERM}>{words.ours}</dt>
            <dd className={ANSWER}>
              <span className={cn(TYPE.mono, "mr-1.5 uppercase", s.kind === "does" ? "text-(--home-settled)" : s.kind === "none" ? "text-(--home-violet)" : "text-pp-muted")}>
                {data.kinds[s.kind]}
                <span className="sr-only">:</span>
              </span>
              {s.ours}
            </dd>
            {s.files.length > 0 && (
              <dd className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
                <span className={cn(TYPE.mono, "text-pp-muted")}>
                  {words.code}
                  <span className="sr-only">:</span>
                </span>
                {s.files.map((f) => (
                  <code key={f} translate="no" className={cn(TYPE.mono, "break-all text-pp-ink")}>
                    {f}
                  </code>
                ))}
              </dd>
            )}
          </div>
        </dl>
      </div>
    </li>
  );
}

function Index({ data, summary, words }: { data: ProcessData; summary: string; words: ProcessData["index"] }) {
  const label = (id: ProcessStep["id"]) => data.steps.find((s) => s.id === id)?.label ?? id;
  return (
    <div className="home-faq mt-10">
      <details className="group border-y border-pp-rule">
        <summary
          className={cn(
            "flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 [&::-webkit-details-marker]:hidden",
            RING,
          )}
        >
          <h3 className={cn(TYPE.body, "font-medium text-balance text-pp-ink")}>{summary}</h3>
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-full bg-(--home-chip) text-pp-ink transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-open:rotate-45"
          >
            <svg viewBox="0 0 12 12" fill="none" className="size-3">
              <path d="M6 1.25v9.5M1.25 6h9.5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
            </svg>
          </span>
        </summary>
        {/* The eight steps down two columns from md, 01–04 then 05–08 (in DOM order, so they read
            in order down each), then across the width the hand-offs, two columns of them, and the
            two tallies: nothing stands beside a column of air. */}
        <div className="flex flex-col gap-10 pt-3 pb-8">
          <ol className="grid min-w-0 gap-x-12 gap-y-6 md:grid-flow-col md:grid-cols-2 md:grid-rows-[repeat(4,auto)]">
            {data.steps.map((s, i) => (
              <Step key={s.id} data={data} s={s} i={i} words={words} />
            ))}
          </ol>
          <div className="min-w-0 border-t border-pp-rule pt-6">
            <h4 className={TERM}>{words.handoffs}</h4>
            <ul className="mt-2 grid gap-x-12 gap-y-3 md:grid-cols-2">
              {data.handoffs.map((h) => (
                <li key={`${h.from}-${h.to}`} className="min-w-0">
                  <p className={cn(TYPE.meta, "text-pretty text-pp-ink")}>
                    <span className="font-medium">
                      {label(h.from)} <span aria-hidden>→</span>
                      <span className="sr-only">to</span> {label(h.to)}
                    </span>
                    <span className="text-(--home-ember-ink)"> · {data.marks[h.mark]}</span>
                  </p>
                  <p className={ANSWER}>{h.text}</p>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-col gap-2">
              {data.views.map((v) => (
                <p key={v.id} className={cn(TYPE.meta, "text-pretty text-pp-ink/80")}>
                  <span className={cn(TYPE.mono, "mr-1.5 text-pp-muted")}>{v.label}</span>
                  {data.tally[v.id]}
                </p>
              ))}
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}
