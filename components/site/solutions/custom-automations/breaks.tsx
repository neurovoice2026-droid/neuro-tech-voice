import { cn } from "@/lib/utils";
import { Frame } from "@/components/site/product/primitives";
import { HomeHeading } from "@/components/site/home/heading";
import { TYPE, WEIGHT } from "@/components/site/home/type";
import { fill } from "@/components/site/solutions/custom-ai-agents/parts";
import type { BreakRow, BreaksData } from "@/lib/pages/custom-automations";
import { BreaksInstrument } from "./breaks-instrument";
import { GuardFigure } from "./guard-figures";
import { triesSentence } from "./trace";

/* ------------------------------------------------------------------ *
 * #breaks — "What happens when it breaks at 3 a.m.?"
 *
 * The question every operations lead asks of an automation, and the one
 * a page can most easily answer with a promise. This one answers with
 * the platform's own code. The reader picks what the CRM does when a
 * sample workflow — an unhappy caller's call, tagged, sent to the CRM,
 * and #managers told in Slack — sends it the call's details: takes it,
 * is busy and then takes it, is down all night, never answers, has
 * moved, or points inside a private network. What happens next is not
 * written for the page. It is what `deliverJson` and `describeDelivery` in
 * lib/workflows/webhook.ts — the functions every customer webhook on
 * this platform goes through — did with that answer when the page was
 * built (custom-automations.server.ts, run once per build against
 * addresses that receive nothing), drawn on a trace to scale and written
 * in the run history word for word as the dashboard prints it. It is the
 * only section that can show the private-network case honestly: its
 * message says "call data", and the sample workflow is about calls.
 *
 * NOTHING HERE PLAYS ON ITS OWN. The server draws "Down all night",
 * finished; a play happens only when the reader picks an answer with a
 * pointer, and the waits in it are the code's real one and four seconds.
 * The workbench above is the page's only autoplay.
 *
 * A server component: the heading (its lines rise once, then the key
 * phrase eases into violet), the instrument in its night room (the
 * client island, breaks-instrument.tsx, which gets the section's slice
 * of the data module and the delivery code's six rows as plain props),
 * then, on white, the four other ways the platform stays safe, and the
 * index. The data module is imported for its types only; the rows come
 * from page.tsx, which built them.
 *
 * THE GUARDS are four hairline cards, each a small line figure that
 * draws on its way up the screen (guard-figures.tsx, auto-breaks.css
 * §5), a title and one sentence: once per call, a time limit on every
 * run, steps that stand alone, nothing done twice. On a phone, a column
 * of cards with each figure beside its words; two across from md, the
 * figure over them, and four from xl. No file paths on a card: the checks and the workbench's
 * index carry those.
 *
 * THE INDEX is all six results in words, in a closed <details> in the
 * landing's FAQ style: each answer, the code it gives, and what the
 * platform recorded — "Failed. crm.example.com answered 503 after 3
 * attempts.", its meta line, and when it tried. The room shows one at a
 * time; this is where a reader with no script, find-in-page and a
 * screen reader in a hurry get all six. Drawn here, once: nothing in it
 * changes with a pick.
 * ------------------------------------------------------------------ */

/** controls.tsx RING_LIGHT, spelled out: controls.tsx is a client module, and this is a server one. */
const RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink";

export function Breaks({ data, table }: { data: BreaksData; table: readonly BreakRow[] }) {
  return (
    <section id="breaks" aria-labelledby="breaks-title" className="scroll-mt-8">
      <Frame>
        <HomeHeading id="breaks-title" eyebrow={data.eyebrow} title={data.title} titleKey={data.key} sub={data.sub} />
        <BreaksInstrument data={data} table={table} />
        <Guards data={data} />
        <Index data={data} table={table} />
      </Frame>
    </section>
  );
}

function Guards({ data }: { data: BreaksData }) {
  return (
    <div className="mt-10">
      <h3 className={cn(TYPE.label, "text-pp-muted")}>{data.guardsTitle}</h3>
      <ul className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.guards.map((g) => (
          <li
            key={g.id}
            // On a phone the figure stands beside the words, as the #checks
            // key's do, so four cards in a column stay short; from md, and
            // under 360px where the words would be left too narrow, over them.
            className="grid min-w-0 grid-cols-[64px_minmax(0,1fr)] items-start gap-x-4 rounded-[20px] border border-pp-rule p-5 max-[359px]:block md:block md:p-6"
          >
            <GuardFigure id={g.id} />
            <div className="min-w-0">
              <h4 className={cn(TYPE.h3, "text-balance text-pp-ink max-[359px]:mt-4 md:mt-5")} style={{ fontWeight: WEIGHT.h3 }}>
                {g.title}
              </h4>
              <p className={cn(TYPE.meta, "mt-1 text-pretty md:mt-2")}>{g.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Index({ data, table }: { data: BreaksData; table: readonly BreakRow[] }) {
  return (
    <div className="home-faq mt-8">
      <details className="group border-y border-pp-rule">
        <summary
          className={cn(
            "flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-sm py-3 [&::-webkit-details-marker]:hidden",
            RING,
          )}
        >
          <h3 className={cn(TYPE.body, "font-medium text-pp-ink")}>{data.indexSummary}</h3>
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-full bg-(--home-chip) text-pp-ink transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-open:rotate-45"
          >
            <svg viewBox="0 0 12 12" fill="none" className="size-3">
              <path d="M6 1.25v9.5M1.25 6h9.5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
            </svg>
          </span>
        </summary>
        <dl className="grid gap-x-12 gap-y-7 pt-3 pb-8 md:grid-cols-2">
          {data.scenarios.map((s) => {
            const row = table.find((r) => r.id === s.id);
            if (!row) return null;
            const status = row.ok ? data.record.status.completed : data.record.status.failed;
            return (
              <div key={s.id} className="min-w-0">
                <dt className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className={cn(TYPE.body, "font-medium text-pp-ink")}>{s.label}</span>
                  <span className={cn(TYPE.mono, "text-pp-muted")}>{s.hint}</span>
                </dt>
                <dd className={cn(TYPE.meta, "mt-1 text-pretty break-words text-pp-ink/80")}>
                  {fill(data.live, { status, message: row.message })}
                </dd>
                {row.meta && <dd className={cn(TYPE.mono, "mt-0.5 text-pp-muted")}>{row.meta}</dd>}
                <dd className={cn(TYPE.meta, "mt-0.5 text-pretty")}>{triesSentence(row, data.tries)}</dd>
              </div>
            );
          })}
        </dl>
      </details>
    </div>
  );
}
