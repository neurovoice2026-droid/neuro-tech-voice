import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { Frame } from "@/components/site/product/primitives";
import { HomeHeading } from "@/components/site/home/heading";
import { TYPE } from "@/components/site/home/type";
import type { Kind, ShapeData, ShapeSample } from "@/lib/pages/crm-erp";
import { Ledger } from "./ledger";
import { partKind } from "./shape-card";
import { ShapeInstrument } from "./shape-instrument";

/* ------------------------------------------------------------------ *
 * #shape — "Can it fit OUR kind of business, and how far can it go? Why
 * not buy one?"
 *
 * #process drew one sample business's work into one system. This is the
 * reader's own: pick a kind of business (wholesale, trades and field
 * service, shops and e-commerce, manufacturing, appointments, agencies
 * and services — six of the many we build for, to show the pattern) and
 * how much of it goes in (Sales, Operations, Everything), and a sample
 * of that system appears on a white card in a pearl room: the parts it
 * would have, which of them go into that build, which already run on
 * this platform, the stages its work moves through, its first reports,
 * where AI comes in and what makes it hard. Six samples, one shape:
 * eleven parts in three groups, six stages, three reports and two lines,
 * so two samples read row against row and the room holds its height.
 * The title is the menu's own promise, read: "A CRM or ERP shaped around
 * your process, not the other way round."
 *
 * SAMPLES, AND SAID SO. Written for this page for no business in
 * particular: no brand, no figure, no client (the data module marks them
 * `// SAMPLE`, and its test holds them free of digits and names). The
 * card's tag says "Sample", and so do the foot and the credits. What is
 * not a sample is a part's tag: every "Runs here" and "Partly here" is
 * the kind of the #core card that part leans on, read, and the card's
 * foot links down to it.
 *
 * THEN THE LEDGER, "Off the shelf, or built for you?" (ledger.tsx): the
 * page's answer to "why not buy one?", three kinds of route with equal
 * weight and no product named.
 *
 * A server component: the heading (its lines rise once, then the key
 * phrase eases into violet), the instrument, which is the client island
 * (shape-instrument.tsx), the ledger, the index and the foot. The island
 * gets the section's slice of the data module as plain props, less the
 * heading, the ledger, the index and the foot, with the room's light
 * already taken apart into its pools on the server: the hero room's
 * pearl, mirrored (`roomMirror`), two sections under the hero's own. The
 * data module is imported for its types only.
 *
 * THE INDEX is every sample in words, in a closed <details> in the
 * landing's FAQ style: for each business (an h4) its title and who it's
 * for, its parts by group — each with why it's there and, where it leans
 * on a part that runs here, that in words — its pipeline in order, its
 * first reports, where AI comes in and what makes it hard. The card shows
 * one sample at a time; this is where a reader with no script,
 * find-in-page and a screen reader in a hurry get all six at once.
 * Native <details>, so find-in-page opens it. It is drawn here, on the
 * server, once: nothing in it changes with a pick.
 * ------------------------------------------------------------------ */

export function Shape({ data, blobs }: { data: ShapeData; blobs: readonly CSSProperties[] }) {
  const { eyebrow, title, key, sub, ledger, indexSummary, foot, ...instrument } = data;
  return (
    <section id="shape" aria-labelledby="shape-title" className="scroll-mt-8">
      <Frame>
        <HomeHeading id="shape-title" eyebrow={eyebrow} title={title} titleKey={key} sub={sub} />
        <ShapeInstrument data={instrument} blobs={blobs} />
        <Ledger copy={ledger} />
        <Index data={data} summary={indexSummary} />
        <p className={cn(TYPE.meta, "mt-8 max-w-[640px] text-pretty")}>{foot}</p>
      </Frame>
    </section>
  );
}

/**
 * controls.tsx RING_LIGHT, spelled out: controls.tsx is a client module
 * ("use client"), so what this server component gets from it is a
 * client reference, not the string.
 */
const RING = "rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink";

/** A line's name in the index: the landing's label, muted. */
const TERM = cn(TYPE.label, "text-pp-muted");
/** An answer. */
const ANSWER = cn(TYPE.meta, "text-pretty text-pp-ink/80");

/** A kind's words in the index, in the colour its tag wears on white: settled for "Runs here" (5.50), muted for "Partly here" (6.37). */
const KIND_INK: Record<Exclude<Kind, "none">, string> = {
  does: "text-(--home-settled)",
  thin: "text-pp-muted",
};

/**
 * A line as a sentence: a full stop after it unless it already ends in
 * one of its own. The samples' lines are written as captions; in the
 * index they read as prose.
 */
function sentence(line: string): string {
  return /[.?!…]$/.test(line) ? line : `${line}.`;
}

function Index({ data, summary }: { data: ShapeData; summary: string }) {
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
        <div className="grid gap-x-12 gap-y-10 pt-3 pb-8 md:grid-cols-2">
          {data.samples.map((s) => (
            <Sample key={s.id} data={data} sample={s} />
          ))}
        </div>
      </details>
    </div>
  );
}

/** One sample in words: the card, line by line. */
function Sample({ data, sample }: { data: ShapeData; sample: ShapeSample }) {
  const business = data.businesses.find((b) => b.id === sample.id)?.label ?? sample.id;
  return (
    <div className="min-w-0">
      <h4 className={cn(TYPE.body, "font-medium text-pp-ink")}>{business}</h4>
      <p className={cn(TYPE.meta, "mt-1.5 font-medium text-pretty text-pp-ink")}>{sample.title}</p>
      <p className={cn(TYPE.meta, "text-pretty")}>{sample.who}</p>
      <dl className="mt-3 flex flex-col gap-2.5">
        <div className="min-w-0">
          <dt className={TERM}>{data.partsTitle}</dt>
          <dd className="mt-1 flex flex-col gap-2">
            {data.scopes.map((level) => (
              <div key={level.id} className="min-w-0">
                <p className={cn(TYPE.meta, "font-medium text-pp-ink")}>{data.levels[level.id]}</p>
                <ul className="mt-0.5 flex flex-col gap-1">
                  {sample.parts
                    .filter((p) => p.level === level.id)
                    .map((p) => {
                      const kind = partKind(data.coreKinds, p);
                      return (
                        <li key={p.label} className={ANSWER}>
                          <span className="text-pp-ink">{p.label}</span>: {sentence(p.why)}
                          {kind && <span className={cn(TYPE.mono, "ml-1.5 uppercase", KIND_INK[kind])}>{data.kinds[kind]}</span>}
                        </li>
                      );
                    })}
                </ul>
              </div>
            ))}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className={TERM}>{data.pipelineTitle}</dt>
          <dd className={cn(ANSWER, "mt-0.5")}>
            <p className="text-pp-ink">{sample.pipeline.name}:</p>
            <ol className="flex flex-wrap gap-x-1.5">
              {sample.pipeline.stages.map((stage, i) => (
                <li key={i}>
                  {stage}
                  {i < sample.pipeline.stages.length - 1 ? (
                    <span aria-hidden className="ml-1.5 text-pp-muted">
                      ·
                    </span>
                  ) : (
                    "."
                  )}
                </li>
              ))}
            </ol>
          </dd>
        </div>
        <div className="min-w-0">
          <dt className={TERM}>{data.reportsTitle}</dt>
          <dd className="mt-0.5">
            <ul className="flex flex-col gap-1">
              {sample.reports.map((r) => (
                <li key={r} className={ANSWER}>
                  {sentence(r)}
                </li>
              ))}
            </ul>
          </dd>
        </div>
        <div className="min-w-0">
          <dt className={TERM}>{data.aiLabel}</dt>
          <dd className={cn(ANSWER, "mt-0.5")}>{sentence(sample.ai)}</dd>
        </div>
        <div className="min-w-0">
          <dt className={TERM}>{data.hardLabel}</dt>
          <dd className={cn(ANSWER, "mt-0.5")}>{sentence(sample.hard)}</dd>
        </div>
      </dl>
    </div>
  );
}
