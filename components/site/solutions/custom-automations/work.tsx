import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { Frame } from "@/components/site/product/primitives";
import { HomeHeading } from "@/components/site/home/heading";
import { TYPE } from "@/components/site/home/type";
import { fill } from "@/components/site/solutions/custom-ai-agents/parts";
import type { WorkData } from "@/lib/pages/custom-automations";
import { WorkInstrument } from "./work-instrument";

/* ------------------------------------------------------------------ *
 * #work — "Can you automate OUR kind of work, however hard?"
 *
 * The workbench above shows what this platform already runs. This is
 * the reader's own work: pick a field (finance, sales, customer service,
 * operations, people and HR, online shops) and how hard the job is (a
 * copy-paste, a process, a pipeline), and a sample of that work appears
 * as the same six moves every job makes — it arrives, it's read, it's
 * entered, it's passed on, it's followed up, and a judgement call — each
 * move once as a person does it by hand and once as the blocks of a flow
 * that does it instead. How hard a job is decides how many of the moves
 * it makes and how many blocks each takes, and the meters over the
 * sample (the workbench's own, worked out from the blocks) climb with
 * it. Under the sample, a legend says where each kind of block in it
 * already runs on this platform, with a way to watch it run; the two
 * kinds this platform runs thinly or not at all (a wait, an approval)
 * are said once, in one sentence, and only under a sample that uses one.
 *
 * SAMPLES, AND SAID SO. Eighteen of them, six fields at three levels,
 * written for this page for no business in particular: no brand, no
 * figure, no client (the data module marks them `// SAMPLE`, and its
 * test holds them free of digits and names). The tag over each says
 * "Sample", and so do the foot and the credits. What is not a sample is
 * the legend: every "Runs here" points at a block this platform runs
 * today, in the workbench or in #breaks.
 *
 * A server component: the heading (its lines rise once, then the key
 * phrase eases into violet), the instrument, which is the client island
 * (work-instrument.tsx), the foot, and the index. The island gets the
 * section's slice of the data module as plain props, with the room's
 * light already taken apart into its pools on the server: the hero
 * room's pearl, mirrored (`roomMirror`), so the two rooms a workbench
 * apart never read as one template. The data module is imported for its
 * types only.
 *
 * THE INDEX is every sample in words, in a closed <details> in the
 * landing's FAQ style, grouped by field (an h4 each), then by level: its
 * title and who does it by hand today, then each move it makes, "by
 * hand" and "as a flow", and what is left for a person and what makes it
 * hard. The room shows one sample at a time; this is where a reader with
 * no script, find-in-page and a screen reader in a hurry get all
 * eighteen at once. Native <details>, so find-in-page opens it. It is
 * drawn here, on the server, once: nothing in it changes with a pick.
 * ------------------------------------------------------------------ */

/**
 * A line as a sentence: a full stop after it unless it already ends in
 * one of its own. The samples' lines are written as captions ("Open each
 * invoice that arrives by email", "Not entered already?"); run together
 * in the index they read as prose, one block's line after another.
 */
function sentence(line: string): string {
  return /[.?!…]$/.test(line) ? line : `${line}.`;
}

export function Work({ data, blobs }: { data: WorkData; blobs: readonly CSSProperties[] }) {
  return (
    <section id="work" aria-labelledby="work-title" className="scroll-mt-8">
      <Frame>
        <HomeHeading id="work-title" eyebrow={data.eyebrow} title={data.title} titleKey={data.key} sub={data.sub} />
        <WorkInstrument data={data} blobs={blobs} />
        <p className={cn(TYPE.meta, "mt-6 max-w-[640px] text-pretty")}>{data.foot}</p>
        <Index data={data} />
      </Frame>
    </section>
  );
}

/** A small uppercase label in mono: a move's name in the index, as the panel prints it. */
const MOVE = cn(TYPE.mono, "text-[11px] leading-4 text-pp-muted uppercase");

/**
 * controls.tsx RING_LIGHT, spelled out. controls.tsx is a client module
 * ("use client"), so what this server component gets from it is a client
 * reference, not the string: imported, the summary rendered with no ring
 * classes at all. breaks.tsx, team.tsx and build.tsx spell it out too.
 */
const RING_LIGHT = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink";

function Index({ data }: { data: WorkData }) {
  return (
    <div className="home-faq mt-10">
      <details className="group border-y border-pp-rule">
        <summary
          className={cn(
            "flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-sm py-3 [&::-webkit-details-marker]:hidden",
            RING_LIGHT,
          )}
        >
          <h3 className={cn(TYPE.body, "font-medium text-pp-ink")}>
            {fill(data.indexSummary, { n: data.samples.length })}
          </h3>
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-full bg-(--home-chip) text-pp-ink transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-open:rotate-45"
          >
            <svg viewBox="0 0 12 12" fill="none" className="size-3">
              <path d="M6 1.25v9.5M1.25 6h9.5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
            </svg>
          </span>
        </summary>
        <div className="grid gap-x-12 gap-y-10 pt-3 pb-8 md:grid-cols-2">
          {data.fields.map((field) => (
            <div key={field.id} className="min-w-0">
              <h4 className={cn(TYPE.body, "font-medium text-pp-ink")}>{field.label}</h4>
              <ul className="mt-3 flex flex-col gap-7">
                {data.levels.map((level) => {
                  const s = data.samples.find((x) => x.field === field.id && x.level === level.id);
                  if (!s) return null;
                  return (
                    <li key={s.id} className="min-w-0">
                      <p className={cn(TYPE.label, "text-pp-muted")}>{level.label}</p>
                      <p className={cn(TYPE.meta, "mt-1.5 font-medium text-pretty text-pp-ink")}>{s.title}</p>
                      <p className={cn(TYPE.meta, "text-pretty")}>{s.who}</p>
                      <dl className="mt-3 flex flex-col gap-2.5">
                        {data.moves.map((m) => {
                          const move = s.moves[m.id];
                          if (!move) return null;
                          return (
                            <div key={m.id} className="min-w-0">
                              <dt className={MOVE}>{m.label}</dt>
                              <dd className={cn(TYPE.meta, "mt-0.5 text-pretty text-pp-ink/80")}>
                                <span className="text-pp-muted">{data.hand}:</span> {sentence(move.hand)}
                              </dd>
                              <dd className={cn(TYPE.meta, "text-pretty text-pp-ink/80")}>
                                <span className="text-pp-muted">{data.flow}:</span>{" "}
                                {move.flow.map((b) => sentence(b.text)).join(" ")}
                              </dd>
                            </div>
                          );
                        })}
                        <div className="min-w-0">
                          <dt className={MOVE}>{data.person}</dt>
                          <dd className={cn(TYPE.meta, "mt-0.5 text-pretty text-pp-ink/80")}>{s.person}</dd>
                        </div>
                        {s.hard && (
                          <div className="min-w-0">
                            <dt className={MOVE}>{data.hard}</dt>
                            <dd className={cn(TYPE.meta, "mt-0.5 text-pretty text-pp-ink/80")}>{s.hard}</dd>
                          </div>
                        )}
                      </dl>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
