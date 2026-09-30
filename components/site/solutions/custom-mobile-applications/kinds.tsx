import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { Frame } from "@/components/site/product/primitives";
import { HomeHeading } from "@/components/site/home/heading";
import { TYPE } from "@/components/site/home/type";
import type { KindsData, Sample } from "@/lib/pages/custom-mobile-applications";
import { KindsInstrument } from "./kinds-instrument";

/* ------------------------------------------------------------------ *
 * #kinds — "Can you build OUR kind of app, however hard?"
 *
 * The phone above is one booking app. This is the reader's own: pick a
 * kind of app (bookings, shops, delivery and field work, health and
 * care, learning, money and loyalty) and who uses it (your customers or
 * your staff), and a sample of that app appears in a pearl room — its
 * first five screens drawn as phones, what it asks of the phone itself
 * (a camera, a scanner, a location with the phone locked, a wallet…),
 * which of the nine parts behind every app it uses and which of those
 * already run on this platform, where AI comes in, what makes it hard,
 * and the store rule it meets, linked to that rule's card in #path.
 * Twelve samples, one shape: five screens, four needs, nine parts,
 * three lines, so two samples read row against row and the room holds
 * its height.
 *
 * SAMPLES, AND SAID SO. Written for this page for no business in
 * particular: no brand, no figure, no client (the data module marks them
 * `// SAMPLE`, and its test holds them free of digits and names). The
 * tag over each says "Sample", and so do the foot and the credits. What
 * is not a sample is the parts card: every "Runs here" is a part this
 * platform runs today, in full in #server.
 *
 * A server component: the heading (its lines rise once, then the key
 * phrase eases into violet), the instrument, which is the client island
 * (kinds-instrument.tsx), the index, and the foot. The island gets the
 * section's slice of the data module as plain props, with the room's
 * light already taken apart into its pools on the server: the hero
 * room's pearl, mirrored (`roomMirror`), so the two rooms two sections
 * apart never read as one template. The data module is imported for its
 * types only.
 *
 * THE INDEX is every sample in words, in a closed <details> in the
 * landing's FAQ style, grouped by kind (an h4 each), then by who uses
 * it: its title and who it's for, its first screens in order, what it
 * asks of the phone with each need's tag and why, which parts it uses —
 * those that run here, the one built for yours, and those it doesn't
 * need — then where AI comes in, what makes it hard, and the store rule
 * it meets, linked. The room shows one sample at a time; this is where a
 * reader with no script, find-in-page and a screen reader in a hurry get
 * all twelve at once. Native <details>, so find-in-page opens it. It is
 * drawn here, on the server, once: nothing in it changes with a pick.
 * ------------------------------------------------------------------ */

export function Kinds({ data, blobs }: { data: KindsData; blobs: readonly CSSProperties[] }) {
  const { eyebrow, title, key, sub, indexSummary, foot, ...instrument } = data;
  return (
    <section id="kinds" aria-labelledby="kinds-title" className="scroll-mt-8">
      <Frame>
        <HomeHeading id="kinds-title" eyebrow={eyebrow} title={title} titleKey={key} sub={sub} />
        <KindsInstrument data={instrument} blobs={blobs} />
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

/** A small uppercase label in mono: a line's name in the index. */
const MARK = cn(TYPE.mono, "text-[11px] leading-4 text-pp-muted uppercase");

/**
 * A line as a sentence: a full stop after it unless it already ends in
 * one of its own. The samples' lines are written as captions ("AI
 * suggests the next free time that suits them"); in the index they read
 * as prose.
 */
function sentence(line: string): string {
  return /[.?!…]$/.test(line) ? line : `${line}.`;
}

function Index({ data, summary }: { data: KindsData; summary: string }) {
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
          {data.kinds.map((kind) => (
            <div key={kind.id} className="min-w-0">
              <h4 className={cn(TYPE.body, "font-medium text-pp-ink")}>{kind.label}</h4>
              <ul className="mt-3 flex flex-col gap-7">
                {data.sides.map((side) => {
                  const s = data.samples.find((x) => x.kind === kind.id && x.side === side.id);
                  if (!s) return null;
                  return (
                    <li key={s.id} className="min-w-0">
                      <p className={cn(TYPE.label, "text-pp-muted")}>{side.label}</p>
                      <p className={cn(TYPE.meta, "mt-1.5 font-medium text-pretty text-pp-ink")}>{s.title}</p>
                      <p className={cn(TYPE.meta, "text-pretty")}>{s.who}</p>
                      <Lines data={data} sample={s} />
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

/** One sample in words: the room's cards, line by line. */
function Lines({ data, sample }: { data: KindsData; sample: Sample }) {
  const labelOf = (id: string) => data.features.find((f) => f.id === id)?.label ?? id;
  const used = data.parts.filter((p) => sample.parts.includes(p.id));
  const runs = used.filter((p) => p.kind === "does");
  const yours = used.filter((p) => p.kind === "none");
  const unused = data.parts.filter((p) => !sample.parts.includes(p.id));
  const gate = data.gates.find((g) => g.id === sample.rule);
  const list = (parts: typeof used) => sentence(parts.map((p) => p.label).join(", "));
  const dd = cn(TYPE.meta, "text-pretty text-pp-ink/80");

  return (
    <dl className="mt-3 flex flex-col gap-2.5">
      <div className="min-w-0">
        <dt className={MARK}>{data.screensLabel}</dt>
        <dd className={cn(dd, "mt-0.5")}>
          <ol className="flex flex-wrap gap-x-1.5">
            {sample.screens.map((screen, i) => (
              <li key={i}>
                {screen.name}
                {i < sample.screens.length - 1 ? (
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
        <dt className={MARK}>{data.phoneTitle}</dt>
        <dd className={cn(dd, "mt-0.5")}>
          <ul className="flex flex-col gap-1">
            {sample.phone.map((need) => (
              <li key={need.id}>
                <span className="text-pp-ink">{labelOf(need.id)}</span>
                <span className="text-pp-muted">, {data.needs[need.need]}:</span> {sentence(need.why)}
              </li>
            ))}
          </ul>
        </dd>
      </div>
      <div className="min-w-0">
        <dt className={MARK}>{data.serverTitle}</dt>
        <dd className={cn(dd, "mt-0.5")}>
          <span className="text-pp-muted">{data.ours.does}:</span> {list(runs)}
        </dd>
        {yours.length > 0 && (
          <dd className={dd}>
            <span className="text-pp-muted">{data.ours.none}:</span> {list(yours)}
          </dd>
        )}
        {unused.length > 0 && (
          <dd className={dd}>
            <span className="text-pp-muted">{data.absent}:</span> {list(unused)}
          </dd>
        )}
      </div>
      <div className="min-w-0">
        <dt className={MARK}>{data.aiLabel}</dt>
        <dd className={cn(dd, "mt-0.5")}>{sentence(sample.ai)}</dd>
      </div>
      <div className="min-w-0">
        <dt className={MARK}>{data.hardLabel}</dt>
        <dd className={cn(dd, "mt-0.5")}>{sample.hard}</dd>
      </div>
      <div className="min-w-0">
        <dt className={MARK}>{data.ruleLabel}</dt>
        <dd className={cn(TYPE.meta, "mt-0.5")}>
          <a
            href={`#gate-${sample.rule}`}
            className={cn(
              "home-link relative inline-flex min-h-6 items-center text-pretty before:absolute before:inset-x-0 before:-inset-y-2.5",
              RING,
            )}
          >
            {gate?.title}
          </a>
        </dd>
      </div>
    </dl>
  );
}
