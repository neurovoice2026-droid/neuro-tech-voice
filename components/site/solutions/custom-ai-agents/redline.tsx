"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import type { CAA_REDLINE, Status } from "@/lib/pages/custom-ai-agents";
import { cn } from "@/lib/utils";
import { Eyebrow, Frame, SectionTitle } from "@/components/site/product/primitives";
import { useInView, usePrefersReducedMotion } from "@/components/site/product/timing";
import { Segs, Stack, StatusDot, Turns } from "./parts";
import { markProved } from "./proved";

/* ------------------------------------------------------------------ *
 * §1 — Written with your team. The redline.
 *
 * The objection: "I don't have time to write prompts." The honest answer
 * is not that prompts are easy. It is that the owner never has to write
 * one: they say the rule the way they would say it to a new starter, and
 * we write it, ring it, and write it again until a test call keeps it.
 *
 * So the instrument is one rule and its three drafts, each with the test
 * call that judged it. Draft 1 is the owner's own sentence, and the test
 * call shows why a sentence that is perfectly clear to a person is not a
 * rule to an agent. Draft 2 strikes it and writes it properly; the test
 * call finds the hole in that too. Draft 3 strikes one clause and adds
 * the fix, and the test call holds. The page does the whole redraft by
 * itself, once, and rests on the version that held. It never loops: a
 * rule redrafting itself forever would argue that it never settles.
 *
 * THE PEN IS VIOLET, NOT RED. A red strike would say "error", and the
 * first drafts are not errors — they are how every rule starts. Violet
 * is this page's colour for the product being worked on, so the strike
 * and the inked insertion are our hand in the brief. Green appears once,
 * on the one verdict that genuinely held; a rewrite is violet, because
 * a change is the build doing its job, not a failure to hide.
 *
 * THE STRIKE FOLLOWS THE LINE. It is a background layer with
 * `box-decoration-break: clone` (caa.css), not text-decoration, so when
 * the struck sentence wraps — it does at 320px — each line fragment
 * gets its own stroke and they sweep left to right in reading order.
 *
 * TIMING. The draft changes every ~2.3s: long enough to read a verdict
 * of a dozen words, short enough that the whole redraft is over in
 * about 6.8s. Inside a draft the strike comes first (50ms after the new
 * draft is on screen, so the unstruck frame has painted and there is
 * something to transition from), the insertion half a second later —
 * you see what went before you see what replaced it — and the call
 * plays under both at the pace of a turn every ~400ms. The verdict
 * lands last, half a second after the last word, because it is the
 * reason for the next draft.
 *
 * RESERVATION. The draft body, the provenance line, the transcript and
 * the verdict are each laid out once per draft in the same grid cell,
 * invisibly, so the card is the height of its tallest draft on the
 * server's first paint and the redraft moves nothing — not the aside,
 * not the footnote, not the page below. The sizers render every draft
 * complete (struck, inked, every turn) because that is the text each
 * one ends on. The aside also keeps a 260px floor so the grey card
 * does not look starved on the one-turn frames at wide widths.
 *
 * FIRST PAINT IS THE FINISHED RULE. The server renders Draft 3 complete,
 * so a reader without script (and a crawler) gets the version that held.
 * Once hydrated, the section arms itself at Draft 1 — it is below the
 * fold, inside a Deferred box, so the reader never sees the swap — and
 * waits to be scrolled into. Reduced motion never arms: it stays on the
 * finished rule with no clock at all.
 * ------------------------------------------------------------------ */

type Data = typeof CAA_REDLINE;

type Beat = { draft: number; reached: number; verdict: boolean; struck: boolean; inked: boolean };

/** Before the first call rings: Draft 1, nobody has spoken yet. */
const START: Beat = { draft: 0, reached: 0, verdict: false, struck: false, inked: false };

/** A draft finished: struck, inked, every turn heard and the verdict in. */
const done = (draft: number, turns: number): Beat => ({ draft, reached: turns, verdict: true, struck: true, inked: true });

/*
 * The redraft, as absolute times from the moment the card comes into
 * view. Each draft opens with only the caller's opening line showing
 * (the same caller each time, so it is the fixed point the eye returns
 * to), then strike, ink, the rest of the call, and the verdict.
 */
const SCRIPT: readonly (readonly [number, Partial<Beat>])[] = [
  [250, { reached: 1 }],
  [700, { reached: 2 }],
  [1300, { verdict: true }],

  [2300, { draft: 1, reached: 1, verdict: false, struck: false, inked: false }],
  [2350, { struck: true }],
  [2600, { reached: 2 }],
  [2800, { inked: true }],
  [3000, { reached: 3 }],
  [3400, { reached: 4 }],
  [4300, { verdict: true }],

  [4700, { draft: 2, reached: 1, verdict: false, struck: false, inked: false }],
  [4750, { struck: true }],
  [5000, { reached: 2 }],
  [5200, { inked: true }],
  [5400, { reached: 3 }],
  [5800, { reached: 4 }],
  [6300, { verdict: true }],
];

/*
 * Two §4 strings this island needs but does not receive. The data module
 * exports them as their own values (SPEAKERS, STATUS_LABEL), and it is
 * server-only, so a client file may not import them; the page hands this
 * section CAA_REDLINE alone. Copied verbatim — keep in step with
 * lib/pages/custom-ai-agents.ts.
 */
const SPEAKERS = { caller: "Caller", agent: "Agent" } as const;
const STATUS_LABEL: Record<Status, string> = {
  held: "Held",
  rewritten: "Rewritten",
  brief: "Changed the brief",
  document: "Changed a document",
};

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink";
const LABEL = "text-[11px] leading-4 font-medium tracking-[0.12em] text-pp-muted uppercase";

// False on the server and while hydrating, true after: lets the first
// paint be the finished rule and the hydrated section arm itself without
// setting state in an effect.
const noop = () => () => {};
const useHydrated = () =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

export function Redline({ data }: { data: Data }) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, "-15% 0px");
  const still = usePrefersReducedMotion();
  const hydrated = useHydrated();
  const { drafts } = data;
  const last = drafts.length - 1;

  const [beat, setBeat] = useState<Beat>(START);
  const [touched, setTouched] = useState(false);

  // What is on screen. Unhydrated and reduced motion both show the rule
  // that held; a pick always wins, so a reduced-motion reader can still
  // walk the drafts.
  const view: Beat = !hydrated || (still && !touched) ? done(last, drafts[last].turns.length) : beat;

  const started = useRef(false);
  const timers = useRef<number[]>([]);
  // Unmount only. Scrolling past mid-redraft must not strand the rule on
  // Draft 2 with the `started` guard refusing to finish it.
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  useEffect(() => {
    if (still || !inView || started.current) return;
    started.current = true;
    timers.current = SCRIPT.map(([at, patch]) =>
      window.setTimeout(() => setBeat((b) => ({ ...b, ...patch })), at),
    );
  }, [inView, still]);

  function pick(i: number) {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    started.current = true;
    setTouched(true);
    setBeat(done(i, drafts[i].turns.length));
    markProved("redline");
  }

  // Not a pick: no touched, no markProved. Only the clock stops.
  function settle() {
    if (touched || still) return;
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    started.current = true;
    setBeat(done(view.draft, drafts[view.draft].turns.length));
  }

  // Roving tabindex: one Tab stop for the rail, arrows walk it and select
  // as they go, as a radio group does.
  const radios = useRef<(HTMLButtonElement | null)[]>([]);
  function onKey(e: KeyboardEvent<HTMLButtonElement>) {
    const n = drafts.length;
    const to =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? (view.draft + 1) % n
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? (view.draft - 1 + n) % n
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? n - 1
              : -1;
    if (to < 0) return;
    e.preventDefault();
    pick(to);
    radios.current[to]?.focus();
  }

  const d = drafts[view.draft];

  return (
    <section id="redline" ref={ref} className="scroll-mt-28">
      <Frame className="px-6 md:px-12">
        <Eyebrow>{data.eyebrow}</Eyebrow>
        <SectionTitle className="mt-4 max-w-[820px]">{data.title}</SectionTitle>
        <p className="mt-5 max-w-[560px] text-base leading-[25px] text-pp-ink/80">{data.body}</p>
      </Frame>

      <Frame className="mt-8 px-2 md:px-4">
        {/* Focus inside the card settles the redraft where it stands, so
            the radio a keyboard reader is on never loses aria-checked (or
            its tab stop) under them, and nothing moves for longer than 5s
            without their say (WCAG 2.2.2). It finishes the draft on screen
            rather than jumping to the last one: a jump would move the check
            off the focused radio, the very thing this prevents. A mouse
            click focuses before it clicks, so pick() still wins. */}
        <div
          onFocus={settle}
          className="rounded-[24px] bg-white p-4 shadow-[0_0_0_1px_rgb(24_16_40/0.06)] md:p-7"
        >
          {/* The rail. A bar per draft, inked up to the one showing, so the
              rail reads as progress through the redraft, not as tabs. */}
          <div role="radiogroup" aria-label={data.railLabel} className="flex items-start gap-1.5">
            {drafts.map((x, i) => {
              const on = i === view.draft;
              return (
                <button
                  key={x.n}
                  ref={(el) => {
                    radios.current[i] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  // Named by its visible label ("Draft 2, As written"), not by
                  // an aria-label: a spoken name has to contain the words on
                  // the button (WCAG 2.5.3), and the radiogroup already says
                  // "2 of 3".
                  tabIndex={on ? 0 : -1}
                  onClick={() => pick(i)}
                  onKeyDown={onKey}
                  className={cn(
                    "group flex h-auto min-h-11 min-w-0 flex-1 flex-col items-stretch gap-2 pt-2 text-left",
                    FOCUS,
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "h-1 w-full rounded-full transition-colors duration-200",
                      i <= view.draft ? "bg-black" : "bg-pp-rule",
                    )}
                  />
                  {/* n and sub sit on one line when there is room and wrap
                      (sub under n) on a phone, where a third of the card is
                      about 76px. */}
                  <span
                    className={cn(
                      "flex flex-wrap gap-x-2 text-[11px] leading-4 tracking-[0.1em] uppercase transition-colors duration-200",
                      on ? "text-pp-ink" : "text-pp-muted group-hover:text-pp-ink",
                    )}
                  >
                    <span className="font-medium">{x.n}</span>
                    <span className="sr-only">, </span>
                    <span>{x.sub}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {/* Heard after a pick only: the autoplay walks three drafts in
              under seven seconds and must not talk over the page. The region
              is live from the first paint and empty until the first pick,
              because screen readers announce only changes to a region that
              was already live; flipping aria-live on in the same commit as
              the first text would leave that first pick unspoken. */}
          <p className="sr-only" aria-live="polite">
            {touched ? `${d.n}: ${STATUS_LABEL[d.status]}` : ""}
          </p>

          {/* The aside is 380px, not narrower, at lg: its turns wrap less, so
              the grey card is about as tall as the rule column and the card
              has no empty block at its lower left once Draft 3 lands. */}
          <div className="mt-6 grid gap-7 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-10">
            {/* At lg the column is a flex column the height of the aside, and
                the provenance note sits at its foot, level with the verdict
                (lg:pb-5 matches the aside's p-5). Even with the larger rule
                and the wider aside, the call runs a few lines past Draft 3,
                and a note stranded under the rule would leave that space as
                a hole at the card's lower left; at the foot it reads as the
                card's own footing beside "Held". */}
            <div className="min-w-0 lg:flex lg:flex-col lg:pb-5">
              <p className={LABEL}>{data.labels.rule}</p>

              {/* The draft body. The live copy carries the live pen; the
                  sizers are every draft finished, which is the text each
                  ends on — the pen changes paint, never a line break.
                  The rule is the section's subject, so at lg it is set larger
                  to hold its own beside the denser aside; the sizers take the
                  same size, so the reserve still fits the tallest draft. */}
              <div className="mt-3 grid content-start text-[19px] leading-[30px] text-pp-ink lg:text-[23px] lg:leading-[36px]">
                <p key={view.draft} className="ind-swap [grid-area:1/1]">
                  <Segs segs={d.segs} struck={view.struck} inked={view.inked} />
                </p>
                {drafts.map((x, i) => (
                  <p key={i} aria-hidden inert className="invisible [grid-area:1/1]">
                    <Segs segs={x.segs} struck inked />
                  </p>
                ))}
              </div>

              <Stack
                items={drafts}
                live={view.draft}
                className="mt-3 lg:mt-auto lg:pt-6"
                render={(x) => <p className="text-[13px] leading-5 text-pp-muted">{x.from}</p>}
              />
            </div>

            <aside className="flex min-h-[260px] min-w-0 flex-col rounded-2xl bg-pp-card p-5">
              <p className={cn(LABEL, "border-b border-pp-hair pb-3")}>{data.labels.test}</p>

              {/* The call. Turns land one by one, keyed on the draft so each
                  new draft's call is heard afresh; unreached turns are laid
                  out invisibly, and every draft's full call is reserved
                  under it (Drafts 2 and 3, four turns, set the height). */}
              <div className="mt-4 grid flex-1 content-start">
                <div className="[grid-area:1/1]">
                  <Turns
                    turns={d.turns}
                    labels={SPEAKERS}
                    size="sm"
                    reached={view.reached}
                    landKey={`d${view.draft}`}
                  />
                </div>
                {drafts.map((x, i) => (
                  <div key={i} aria-hidden inert className="invisible [grid-area:1/1]">
                    <Turns turns={x.turns} labels={SPEAKERS} size="sm" />
                  </div>
                ))}
              </div>

              {/* The verdict: the reason for the next draft. Reserved from the
                  first frame, invisible until the call has been heard. */}
              <div className="mt-4 grid content-start border-t border-pp-hair pt-3">
                <div
                  key={view.verdict ? `v${view.draft}` : "wait"}
                  className={cn("[grid-area:1/1]", view.verdict ? "ind-land" : "invisible")}
                >
                  <Verdict label={data.labels.verdict} text={d.verdict} status={d.status} />
                </div>
                {drafts.map((x, i) => (
                  <div key={i} aria-hidden inert className="invisible [grid-area:1/1]">
                    <Verdict label={data.labels.verdict} text={x.verdict} status={x.status} />
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </Frame>

      <Frame className="mt-5 px-6 md:px-12">
        <p className="max-w-[620px] text-[13px] leading-5 text-pp-muted">{data.foot}</p>
      </Frame>
    </section>
  );
}

/**
 * What the test call showed. The status word sits beside its dot, so the
 * colour is never the only thing saying whether the rule held.
 */
function Verdict({ label, text, status }: { label: string; text: string; status: Status }) {
  return (
    <div className="flex items-start gap-2">
      {/* 16px status line beside a 20px text line: 2px down centres them. */}
      <StatusDot status={status} label={STATUS_LABEL[status]} className="mt-0.5 shrink-0" />
      <p className="min-w-0 text-[13px] leading-5 text-pp-ink">
        <span className="sr-only">{label}: </span>
        {text}
      </p>
    </div>
  );
}
