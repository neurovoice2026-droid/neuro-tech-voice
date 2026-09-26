import { cn } from "@/lib/utils";
import { Frame } from "@/components/site/product/primitives";
import { HomeHeading } from "@/components/site/home/heading";
import { TYPE } from "@/components/site/home/type";
import { CheckLine } from "@/components/site/solutions/custom-saas-platforms/check-line";
import type { RunningData } from "@/lib/pages/custom-automations";
import { Ledger } from "./ledger";
import { Workbench } from "./workbench";
import { pad2, pathOrder } from "./workbench-frame";

/* ------------------------------------------------------------------ *
 * #running — "Is it real? How complex does it get?"
 *
 * Anyone can say "we automate anything". This section shows what we
 * have automated: the automations this platform runs on, each taken
 * from the steps a person would do by hand to the flow that does them
 * instead, drawn from the platform's code and held to it by the page's
 * test. Four are taken apart in the workbench (a client island,
 * workbench.tsx), simplest first — a customer paying, the morning's
 * jobs, a document added, a call ending — and its tour is the page's
 * only autoplay; six more are listed under it, in plain words, as the
 * ledger (ledger.tsx).
 *
 * A server component. It sets the section and its heading, hands the
 * workbench its slice of the copy as plain props (everything but the
 * ledger, which is drawn here), and closes with the index and the foot.
 * The data module is imported for its types only.
 *
 * THE INDEX is every automation above in words, in a closed <details>
 * in the landing's FAQ style: for each lens (`#run-<lens>`), what is
 * done by hand, the blocks that do it in the order the run reaches them
 * (label — what it does; a branch that ends under the block it leaves),
 * the files each lives in, and how to check it; then the ledger's six,
 * with the longer list behind the workflows card and their files. It is
 * the keyboard's and the screen reader's way through the drawing, which
 * is aria-hidden, and the place a developer finds the paths no card face
 * shows. Native <details>, so find-in-page opens it, and a reader with
 * no script reads all of it.
 *
 * GROUND. The section is white; the workbench's stage is a `.home-stage`
 * room inside the island, and the heading's key phrase stays on white,
 * where violet reads (never on a mesh). The ledger's cards and the
 * index are white too: the next lit surface is #work's room, a whole
 * workbench below the hero's.
 * ------------------------------------------------------------------ */

const RING = "rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink";

export function Running({ data }: { data: RunningData }) {
  const { ledger, ...bench } = data;
  return (
    <section id="running" aria-labelledby="running-title" className="scroll-mt-8">
      <Frame>
        <HomeHeading id="running-title" eyebrow={data.eyebrow} title={data.title} titleKey={data.key} sub={data.sub} />
        <Workbench data={bench} />
        <Ledger ledger={ledger} kinds={data.kinds} />
        <Index data={data} />
        <p className={cn(TYPE.meta, "mt-8 max-w-[640px] text-pretty")}>{data.foot}</p>
      </Frame>
    </section>
  );
}

/** A label over its list, inside the index. */
function Sub({ children }: { children: string }) {
  return <p className={cn(TYPE.label, "mt-5 text-pp-muted")}>{children}</p>;
}

/** The files a block or a card lives in, one per line, never translated. */
function Files({ files }: { files: readonly string[] }) {
  return (
    <ul className="mt-1.5">
      {files.map((f) => (
        <li key={f} className={cn(TYPE.mono, "break-all text-pp-muted")} translate="no">
          {f}
        </li>
      ))}
    </ul>
  );
}

function Index({ data }: { data: RunningData }) {
  return (
    <div className="home-faq mt-10">
      {/* Arriving on /…#run-<lens>, the browser opens the <details> for the
          fragment before React hydrates: its `open` is the browser's, not a
          mismatch. */}
      <details className="group border-y border-pp-rule" suppressHydrationWarning>
        <summary
          className={cn(
            "flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-sm py-3 [&::-webkit-details-marker]:hidden",
            RING,
          )}
        >
          {/* A heading, as the SaaS FAQ's questions are: the lens and ledger
              h4s below nest under it, not under the ledger's h3 above. */}
          <h3 className={cn(TYPE.body, "font-medium text-balance text-pp-ink")}>{data.indexSummary}</h3>
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
          {data.lenses.map((lens) => {
            const files = [...new Set(lens.nodes.flatMap((n) => n.files))];
            return (
              <div key={lens.id} id={`run-${lens.id}`} className="min-w-0 scroll-mt-8">
                <h4 className={cn(TYPE.body, "font-medium text-pp-ink")}>{lens.label}</h4>
                <Sub>{data.indexHand}</Sub>
                <ol className="mt-1.5 flex flex-col gap-1">
                  {lens.manual.map((m, i) => (
                    <li key={m.id} className={cn(TYPE.meta, "grid grid-cols-[24px_minmax(0,1fr)] text-pretty text-pp-ink/80")}>
                      <span aria-hidden className={cn(TYPE.mono, "text-pp-muted")}>
                        {pad2(i + 1)}
                      </span>
                      {m.text}
                    </li>
                  ))}
                </ol>
                <Sub>{data.indexFlow}</Sub>
                <ol className="mt-1.5 flex flex-col gap-1.5">
                  {pathOrder(lens).flatMap((row) =>
                    row.kind === "group"
                      ? []
                      : [
                          <li key={row.node.id} className={cn(TYPE.meta, "text-pretty", row.kind === "end" && "pl-6")}>
                            {row.kind === "end" && row.label && (
                              <span className={cn(TYPE.mono, "mr-1.5 text-pp-muted")}>{row.label} →</span>
                            )}
                            <span className="font-medium text-pp-ink">{row.node.label}</span>
                            {" — "}
                            <span className="text-pp-ink/80">{row.node.detail}</span>
                          </li>,
                        ],
                  )}
                </ol>
                {lens.foot && <p className={cn(TYPE.meta, "mt-3 text-pretty")}>{lens.foot}</p>}
                <Sub>{data.code}</Sub>
                <Files files={files} />
                <CheckLine check={lens.check} kinds={data.checkKinds} tone="white" className="mt-4" />
              </div>
            );
          })}
          <div className="min-w-0 md:col-span-2">
            <h4 className={cn(TYPE.body, "font-medium text-pp-ink")}>{data.ledger.title}</h4>
            <dl className="mt-3 grid gap-x-12 gap-y-6 md:grid-cols-2">
              {data.ledger.cards.map((card) => (
                <div key={card.id} className="min-w-0">
                  <dt className={cn(TYPE.meta, "font-medium text-pp-ink")}>{card.title}</dt>
                  <dd className={cn(TYPE.meta, "mt-1 text-pretty text-pp-ink/80")}>{card.body}</dd>
                  {card.more && <dd className={cn(TYPE.meta, "mt-1 text-pretty text-pp-ink/80")}>{card.more}</dd>}
                  <dd>
                    <Files files={card.files} />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </details>
    </div>
  );
}
