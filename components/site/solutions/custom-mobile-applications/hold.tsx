import { cn } from "@/lib/utils";
import { Frame } from "@/components/site/product/primitives";
import { HomeHeading } from "@/components/site/home/heading";
import { TYPE } from "@/components/site/home/type";
import type { Answer, HoldData, PartId, SampleApp, ScreenId } from "@/lib/pages/custom-mobile-applications";
import { PhoneStage } from "./phone-stage";
import { LAST, pad2, talksOf, type StepIndex } from "./phone-frame";
import { Routes } from "./routes";

/* ------------------------------------------------------------------ *
 * #hold — "Show me an app. iOS and Android: one or two? What's behind
 * it?"
 *
 * THE SPINE OF THE PAGE, AND ITS ONLY AUTOPLAY. A sample booking app on
 * a phone the reader can hold (phone-stage.tsx, the client island):
 * switch it between iOS and Android, press through it — sign in, choose
 * a time, pay, booked and asked about notifications, the reminder on the
 * lock screen later — and beside it, the parts of this platform each
 * step talks to light up, drawn from the platform's own code. It plays
 * the journey once on its own when it first has the screen, and can be
 * paused. The argument of the page in one picture: the half of every app
 * a buyer never sees already runs here.
 *
 * Then "Two apps or one?" (routes.tsx): the three routes to both
 * platforms, native, one codebase or the code you already have, chosen
 * with you.
 *
 * A server component. It sets the section and its heading, hands the
 * stage its slice of the copy as plain props (everything but the
 * routes, the index and the foot, which are drawn here), and closes with
 * the index and the foot. The data module is imported for its types
 * only.
 *
 * THE INDEX is the journey in words, in a closed <details> in the
 * landing's FAQ style: each step's number and name with the screen it
 * shows, its caption, and the parts it talks to (the reminder twice, as
 * a notification allowed and as a text when it isn't), then what each
 * platform shows differently, then the reminder text word for word, the
 * time cut out where the platform's template puts it. The phone shows
 * one screen at a time and the parts beside it are aria-hidden: this is
 * where a reader with no script, find-in-page and a screen reader in a
 * hurry get the whole journey at once. Native <details>, so
 * find-in-page opens it; drawn here, once, since nothing in it changes.
 *
 * GROUND. The section is white; the stage is a `.home-stage` room inside
 * the island (never lit: the hero's pearl room is one screen up, and
 * #kinds' is next), and the heading's key phrase stays on white, where
 * violet reads. The routes and the index are on white too.
 * ------------------------------------------------------------------ */

/** controls.tsx RING_LIGHT, spelled out: controls.tsx is a client module, and this is a server component. */
const RING = "rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink";

/**
 * Where the platform's reminder template puts the time (`{when}`), cut
 * out of the text the index quotes: the words around it are the
 * template's own (REMINDER_TEXT), and the time was never fixed.
 */
const WHEN = "[the time]";

export function Hold({ data }: { data: HoldData }) {
  const { routes, indexSummary, indexReminder, foot, ...stage } = data;
  return (
    <section id="hold" aria-labelledby="hold-title" className="scroll-mt-8">
      <Frame>
        <HomeHeading id="hold-title" eyebrow={data.eyebrow} title={data.title} titleKey={data.key} sub={data.sub} />
        <PhoneStage data={stage} />
        <Routes copy={routes} />
        <Index data={data} summary={indexSummary} reminder={indexReminder} />
        <p className={cn(TYPE.meta, "mt-8 max-w-[640px] text-pretty")}>{foot}</p>
      </Frame>
    </section>
  );
}

/** A screen's own title, as the phone draws it. */
function titleOf(app: SampleApp, screen: ScreenId): string {
  return app[screen].title;
}

/** A small uppercase label in mono: an answer's name in the index. */
const MARK = cn(TYPE.mono, "text-pp-muted");

function Index({ data, summary, reminder }: { data: HoldData; summary: string; reminder: string }) {
  const label = (id: PartId) => data.parts.find((p) => p.id === id)?.label ?? id;
  const talks = (step: StepIndex, answer: Answer | null) =>
    `${data.talks}: ${talksOf(data.steps, { step, answer }).map(label).join(", ")}.`;
  const ask = data.app.booked.ask.android;
  const last = data.steps[LAST];

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
          <ol className="flex min-w-0 flex-col gap-6">
            {data.steps.map((s, i) => {
              const k = i as StepIndex;
              return (
                <li key={s.id} className="grid min-w-0 grid-cols-[28px_minmax(0,1fr)] items-baseline gap-x-2">
                  <span aria-hidden className={cn(TYPE.mono, "text-(--home-violet)")}>
                    {pad2(i + 1)}
                  </span>
                  <div className="min-w-0">
                    <h4 className={cn(TYPE.body, "font-medium text-pretty text-pp-ink")}>
                      {s.label} — {titleOf(data.app, s.screen)}
                    </h4>
                    {k === LAST && last.deny ? (
                      <dl className="mt-1.5 flex flex-col gap-2.5">
                        <div>
                          <dt className={MARK}>{ask.allow}</dt>
                          <dd className={cn(TYPE.meta, "mt-0.5 text-pretty text-pp-ink/80")}>{s.caption}</dd>
                          <dd className={cn(TYPE.meta, "text-pretty")}>{talks(k, "allow")}</dd>
                        </div>
                        <div>
                          <dt className={MARK}>{ask.deny}</dt>
                          <dd className={cn(TYPE.meta, "mt-0.5 text-pretty text-pp-ink/80")}>{last.deny.caption}</dd>
                          <dd className={cn(TYPE.meta, "text-pretty")}>{talks(k, "deny")}</dd>
                        </div>
                      </dl>
                    ) : (
                      <>
                        <p className={cn(TYPE.meta, "mt-1 text-pretty text-pp-ink/80")}>{s.caption}</p>
                        <p className={cn(TYPE.meta, "text-pretty")}>{talks(k, null)}</p>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="min-w-0">
            <h4 className={cn(TYPE.label, "text-pp-muted")}>{data.platformLabel}</h4>
            <ul className="mt-2 flex flex-col gap-1.5">
              {data.platforms.map((p) => (
                <li key={p.id} className={cn(TYPE.meta, "text-pretty text-pp-ink/80")}>
                  {data.notes[p.id]}
                </li>
              ))}
            </ul>
            <h4 className={cn(TYPE.label, "mt-8 text-pp-muted")}>{reminder}</h4>
            <p className={cn(TYPE.body, "mt-2 max-w-[34em] text-pretty text-pp-ink")}>
              {data.reminder.before}
              <span className="text-pp-muted">{WHEN}</span>
              {data.reminder.after}
            </p>
          </div>
        </div>
      </details>
    </div>
  );
}
