"use client";

import { useEffect, useRef, useState } from "react";
import type { gsap } from "gsap";
import { SETUP_LANGS, TRUST } from "@/lib/site";
import { cn } from "@/lib/utils";
import { ping } from "./product/line-figure";
import { useKitContext, useMotionKit } from "./product/motion-kit";
import { Frame, Rule, SectionHeading } from "./product/primitives";
import { holdFor, useInView, usePrefersReducedMotion } from "./product/timing";

/* ------------------------------------------------------------------ *
 * The four doubts, set as an imprint that checks itself while you read it.
 *
 * This is the section most likely to come out generic, because the genre
 * it belongs to — four reassurance tiles with a shield, a lock, a globe
 * and a flag — is one every buyer has already learned to skip. The genre
 * fails for a reason worth naming: those tiles are drawn as *badges*, and
 * a badge is a promise that someone else has audited us. We hold no
 * certification. TRUST's own comment says so. Drawing a shield that
 * stands for nothing is a worse lie than saying nothing at all.
 *
 * So the band is set as an **imprint** — the page at the back of a book
 * where the facts of manufacture are recorded without persuasion: where
 * it was printed, in which face, how many copies. An imprint is not
 * trying to convince anyone. That register is exactly right for four
 * claims whose entire strength is that each of them is checkable.
 *
 * Set in the product-page system (`.pp`): white stock, black ink, the
 * violet accent, hairlines. The section carries the `pp` class itself
 * rather than inheriting it, because on the homepage it sits between a
 * dark hero and a dark footer — exactly how the product pages are built,
 * white body between two dark ends — and it paints its own opaque ground
 * so the run's field cannot show through it.
 *
 * ## THE SIGNATURE MOVEMENT: the pass is an object, and it rules the line
 *
 * The kicker says *before you point a number at it*, and the four entries
 * say *check it yourself*. So the section does the checking, in front of
 * you, one entry at a time — and the thing doing the checking is on the
 * page rather than implied by its consequences.
 *
 * A violet nib rests in the margin. When an entry is picked up it runs
 * down the gutter, turns into the row, and travels left to right along
 * the row's baseline — and **the hairline under that row is drawn behind
 * it, at exactly its own speed**, because the nib and the rule are one
 * tween of one timeline along one path. Where it stops, at the right-hand
 * column, it sends out a ring and the tick is *written*: two strokes,
 * drawn, not an icon appearing. Then the datum is entered — `eu-west-1`,
 * `3 triggers`, the live language count, `Romania` — and the claim beside
 * it takes full ink.
 *
 * That is the whole argument, and it is why the motion is not decoration.
 * A tick that pops into place is a graphic asserting that something was
 * checked. A tick that is drawn at the end of a line somebody ran is the
 * check itself, performed where you can watch it. The rules under the
 * rows are not a frame around the list — they are the pass's own record
 * of how far it has got, which is why a row has no rule until it has one.
 *
 * Built on the house stack: GSAP through `useMotionKit`/`useKitContext`,
 * MotionPathPlugin carrying the nib along the gutter-and-baseline route
 * it is given for each row, DrawSVGPlugin drawing the rule behind it and
 * the tick at the end of it, and the shared `ping()` from the line-figure
 * kit for the arrival — the same ring every arrival on this site gets.
 *
 * TWO DELIBERATE DEPARTURES FROM THE DRAWING KIT. The rule and the tick
 * have no faint ghost twin under them, which every other drawn stroke in
 * this house does. A ghost is a stroke that already exists and is being
 * inked in; here the mark is being made for the first time, and a tick
 * printed faintly in advance would say the row was verified before anyone
 * checked it. That is the one thing this section may never say.
 *
 * THE ROUTE IS MEASURED, NOT AUTHORED. The rows are prose and their
 * heights depend on the viewport, so the path cannot be a constant. It is
 * built from the live geometry when the beat starts and written onto the
 * route path with `attr: { d }` inside the context, so the context
 * reverts it like everything else.
 *
 * ## The clock, and who owns it
 *
 * The pass runs on the house clock from `product/timing.ts`. Each cleared
 * entry is held for `holdFor(note)` — its own note read at 230 words a
 * minute — before the next is picked up, so the pass never outruns the
 * reader. The beat itself is no longer a `setTimeout`: it is the
 * timeline's own length, and the row clears on `onComplete`, so what the
 * state says and what the page has drawn cannot drift apart.
 *
 * `useInView` gates both the fetch and the play, at the house's two
 * margins, so a page in a background tab has no timeline running and a
 * section that has never been near the screen has not downloaded GSAP.
 * `usePrefersReducedMotion` hands those readers all four entries already
 * cleared, every rule ruled and every datum in place — a complete still
 * imprint, and not one line of GSAP is ever fetched for it, because the
 * markup rests complete on its own.
 *
 * The reader owns it from their first click, tap, tab or key: the pass
 * stops where it is and never resumes, and every remaining entry becomes
 * theirs to check — press `Check` and that row runs the same beat, the
 * nib runs to it, and it stamps its own datum. Nothing already cleared is
 * ever taken back, and the nib goes to whichever row was asked for, in
 * whatever order it is asked.
 *
 * CSS still does the small state changes, as it should: the hover on the
 * button, the colour the claim settles into, the three-way swap of
 * Check / Checking / the datum in a reservation stack that reserves its
 * own width so nothing below the row can move. GSAP owns the composed
 * movement and nothing else.
 *
 *  · **A field key, a statement, a datum.** Every row reads left to right
 *    as an entry rather than as a pitch: the key in a small tracked
 *    caption, the claim in ink at statement size, the machine-readable
 *    value — a region, a count — in mono on the right where an imprint
 *    puts it. Nothing is centred, nothing is boxed, nothing repeats an
 *    icon, and there is no card: hairlines do all the grouping.
 *  · **The counts are derived, never typed.** The languages row reads its
 *    figure from SETUP_LANGS, so a tenth language moves the number here
 *    the same afternoon it is added. A trust section that states a stale
 *    count has disproved itself in the one place it could least afford to.
 *  · **The claims are held at exactly their verified width.** Storage is
 *    storage: the Postgres region really is eu-west-1, and the note points
 *    at the FAQ for the speech and telephony hops rather than rounding the
 *    whole stack up to "EU hosted". The hand-over is real code. Neither
 *    gets an adjective here that the repository cannot answer for.
 * ------------------------------------------------------------------ */

/**
 * TRUST carries a kicker and the four entries but no heading, and the
 * masthead needs one. Held here rather than added to the frozen constant.
 */
const TITLE = "Four things you can check yourself.";

/**
 * The imprint's left key and right value, per TRUST id.
 *
 * Kept beside the render and not in `lib/site.ts` because these are
 * typography, not copy: the key is the field name an imprint would print
 * in the margin, and the datum is the same fact as the row's label reduced
 * to the shortest machine-readable form — a region or a count.
 *
 * `languages` has no literal: its datum is computed from SETUP_LANGS at
 * render. `handover` counts the conditions its own note names — a question
 * it cannot answer, a caller who asks for a person, a word you pick — so
 * the figure and the sentence beside it cannot drift apart.
 */
const ENTRY: Record<string, { key: string; datum: string | null }> = {
  eu: { key: "Storage", datum: "eu-west-1" },
  handover: { key: "Hand-over", datum: "3 triggers" },
  languages: { key: "Languages", datum: null },
  company: { key: "Entity", datum: "Romania" },
};

/**
 * The pass's one fixed beat, and the nib's speed.
 *
 * `LEAD` is the pause before the first entry is picked up, so the section
 * is not already working the instant it crosses the fold. Everything
 * after it is read off `holdFor` or off the route's own length: the nib
 * covers `SPEED` pixels a second, clamped, so a long row and a short row
 * are the same journey at the same pace and the only difference between
 * them is how far there was to go.
 */
const LEAD = 600;
const SPEED = 900;
const TRAVEL_MIN = 0.45;
const TRAVEL_MAX = 1.05;
/** The radius the gutter turns into the row on. */
const CORNER = 18;

/** The field key: a caption, muted, at the contrast floor's safe side. */
const KEY_TYPE =
  "text-[11px] leading-4 font-medium tracking-[0.14em] text-pp-muted uppercase";

/** The datum: the same register, set in mono because it is a value. */
const DATUM_TYPE =
  "font-[family-name:var(--font-geist-mono)] text-[11px] leading-4 tracking-[0.06em] tabular-nums uppercase";

export function Trust() {
  // Derived, not restated: the count is whatever the greeting library
  // actually ships, read at render from the same array the setup flow uses.
  const langCount = SETUP_LANGS.length;
  const items = TRUST.items;

  const ref = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDListElement>(null);
  // Two margins, two jobs: `near` fetches GSAP, `inView` plays the beat.
  const inView = useInView(ref, "-15% 0px");
  const near = useInView(ref, "25% 0px");
  const reduce = usePrefersReducedMotion();
  // `near && !reduce`: with reduced motion the markup already rests in its
  // finished state, so GSAP is never downloaded at all.
  const kit = useMotionKit(near && !reduce);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  /** Where the nib was left standing, in the rail's own pixels. */
  const restY = useRef(0);

  /** One flag per entry: has the pass cleared it yet. */
  const [cleared, setCleared] = useState<boolean[]>(() => items.map(() => false));
  /** The entry currently being checked, or null between beats. */
  const [active, setActive] = useState<number | null>(null);
  /** Set by the reader's first click, tap, tab or key. Never unset. */
  const [taken, setTaken] = useState(false);

  // The next entry the pass would pick up: the first one still uncleared.
  const next = cleared.indexOf(false);

  const clear = (i: number) =>
    setCleared((c) => c.map((v, j) => (j === i ? true : v)));

  // A reader who has asked for less gets the finished imprint at once —
  // every entry cleared, every datum in place — and no timer ever starts.
  useEffect(() => {
    if (!reduce) return;
    setActive(null);
    setCleared(items.map(() => true));
  }, [reduce, items]);

  // Pick up the next entry. Only the autoplay pass does this, and only
  // while the section is on screen, the kit has arrived, and the reader
  // has not taken over.
  const picking =
    inView && !reduce && !taken && !!kit && active === null && next !== -1;
  useEffect(() => {
    if (!picking) return;
    // Hold the entry just cleared for as long as its own note takes to
    // read; before the first one, only the lead-in.
    const wait = next === 0 ? LEAD : holdFor(items[next - 1].note);
    const t = setTimeout(() => setActive(next), wait);
    return () => clearTimeout(t);
  }, [picking, next, items]);

  /* ---------------------------------------------------------------- *
   * The beat. One timeline per entry checked, built from the live
   * geometry of that row: the nib runs the gutter and the baseline, the
   * rule is drawn behind it at its own speed, the ring goes out where it
   * stops and the tick is written there.
   * ---------------------------------------------------------------- */
  useKitContext(
    kit,
    ({ gsap }) => {
      if (active === null) return;
      const q = gsap.utils.selector(listRef);

      const rail = q(".ts-rail")[0] as unknown as SVGSVGElement | undefined;
      const route = q(".ts-route")[0] as unknown as SVGPathElement | undefined;
      const nib = q(".ts-nib")[0] as unknown as SVGGElement | undefined;
      const ring = q(".ts-ring") as unknown as SVGCircleElement[];
      const ruleBox = q(".ts-rule")[active] as unknown as SVGSVGElement | undefined;
      const ruleLine = q(".ts-rule-line")[active] as unknown as SVGLineElement | undefined;
      const tick = q(".ts-tick")[active] as unknown as SVGPathElement | undefined;
      const dot = q(".ts-dot")[active] as unknown as SVGCircleElement | undefined;
      const mark = q(".ts-mark")[active] as unknown as SVGSVGElement | undefined;
      if (!rail || !route || !nib || !ruleBox || !ruleLine || !tick || !mark) return;

      const railBox = rail.getBoundingClientRect();
      const markBox = mark.getBoundingClientRect();
      const lineBox = ruleBox.getBoundingClientRect();
      if (railBox.width < 1 || railBox.height < 1) return;

      // The rail carries its own pixels: a viewBox equal to its measured
      // box means one user unit is one CSS pixel, which is what lets a
      // route measured off the DOM be walked without a scale factor.
      const W = railBox.width;
      const H = railBox.height;
      const x0 = 1;
      const x1 = markBox.left + markBox.width / 2 - railBox.left;
      const y = lineBox.top - railBox.top + 0.5;
      // The ring goes out from the mark itself, directly above where the
      // nib stops, so the arrival and the tick are the same event even
      // though the rule and the mark sit on different baselines.
      const markY = markBox.top + markBox.height / 2 - railBox.top;
      const from = restY.current || 0;

      // Down the gutter, round the corner, out along the row. A run of
      // less than a corner's worth is not a turn, so it is not drawn as one.
      const dir = y >= from ? 1 : -1;
      const turn = Math.abs(y - from) > CORNER + 2;
      const d = turn
        ? `M${x0} ${from} L${x0} ${y - CORNER * dir} Q${x0} ${y} ${x0 + CORNER} ${y} L${x1} ${y}`
        : `M${x0} ${y} L${x1} ${y}`;

      gsap.set(rail, { attr: { viewBox: `0 0 ${W} ${H}` } });
      gsap.set(route, { attr: { d } });

      const total = route.getTotalLength() || 1;
      // The horizontal leg is the one the rule is drawn along, so the rule
      // and the nib are the same motion rather than two that agree.
      const hLen = Math.max(1, x1 - (turn ? x0 + CORNER : x0));
      const run = Math.min(TRAVEL_MAX, Math.max(TRAVEL_MIN, total / SPEED));
      const ruleAt = run * ((total - hLen) / total);
      const ruleRun = Math.max(0.2, run - ruleAt);
      const land = run;

      const tl = gsap.timeline({
        paused: true,
        onComplete: () => {
          restY.current = y;
          clear(active);
          setActive(null);
        },
      });

      // The whole resting state, set at the top, before anything moves.
      tl.set(nib, { opacity: 0 }, 0)
        .set(ring, { opacity: 0, attr: { cx: x1, cy: markY, r: 5 } }, 0)
        .set(ruleBox, { autoAlpha: 1 }, 0)
        .set(ruleLine, { drawSVG: "0% 0%" }, 0)
        .set(tick, { autoAlpha: 1, drawSVG: "0% 0%" }, 0)
        // The nib arrives in the margin, then runs its route at one pace:
        // `none`, because a playhead that eases is a playhead whose rule
        // would have to ease with it to stay honest.
        .to(nib, { opacity: 1, duration: 0.2 }, 0)
        .to(
          nib,
          {
            duration: run,
            ease: "none",
            motionPath: { path: route, align: route, alignOrigin: [0.5, 0.5] },
          },
          0,
        )
        // Drawn behind the nib, at the nib's own speed.
        .to(ruleLine, { drawSVG: "0% 100%", duration: ruleRun, ease: "none" }, ruleAt);

      // Every arrival in this house is punctuated by a ring.
      ping(tl, ring, land, 20);

      tl.to(dot ?? [], { autoAlpha: 0, duration: 0.2 }, land)
        // The mark, written rather than revealed.
        .to(tick, { drawSVG: "0% 100%", duration: 0.45, ease: "power2.out" }, land + 0.05)
        .to(nib, { opacity: 0, duration: 0.25 }, land + 0.3)
        // A rest before the row is handed back to the page, written as an
        // empty tween rather than a delay.
        .to({}, { duration: 0.15 });

      tlRef.current = tl;
      return () => {
        tlRef.current = null;
      };
    },
    // `revertOnUpdate` because the callback sets inline styles, writes the
    // route's `d` and leaves DrawSVG dashes behind.
    { scope: listRef, dependencies: [active, reduce], revertOnUpdate: true },
  );

  // Plays while on screen. `kit` is in the deps because the timeline is
  // built asynchronously, after the kit arrives.
  useEffect(() => {
    const tl = tlRef.current;
    if (!tl) return;
    if (inView && !reduce) tl.play();
    else tl.pause();
  }, [inView, reduce, kit, active]);

  /** The reader's first interaction stops the pass for good. */
  const take = () => setTaken(true);

  /** A row the reader checks themselves: same beat, their finger on it. */
  const check = (i: number) => {
    setTaken(true);
    if (cleared[i] || active !== null) return;
    // No kit, or none wanted: the row simply clears. The imprint is never
    // left waiting on a library that is not coming.
    if (reduce || !kit) {
      clear(i);
      return;
    }
    setActive(i);
  };

  return (
    <section
      ref={ref}
      id="trust"
      // `pp` defines the tokens and the body face; `text-base` puts the
      // section back on a rem/px scale, since the run above it sets a
      // fluid `em` base that nothing here is measured in.
      className="pp relative isolate scroll-mt-24 bg-pp-bg text-base text-pp-ink"
    >
      {/* No inner padding on either Frame: the rows are meant to sit flush
          with the column edge so every hairline under them lands on exactly
          the same two points as the full-column Rule above. */}
      <Frame className="pt-20 pb-10 md:pt-28 md:pb-12">
        {/* Painted at full strength from the first frame. An entrance fade
            here would be the page asking to be admired, which is the one
            register this section has to stay out of. */}
        <SectionHeading eyebrow={TRUST.kicker}>{TITLE}</SectionHeading>
      </Frame>

      <Rule />

      {/* The imprint. Rows, not cards: the rule under each entry is the
          only thing grouping them, which is what keeps this from reading
          as the anatomy strip or the solutions ledger higher up. The rules
          arrive as the nib rules them. */}
      <Frame className="pb-20 md:pb-28">
        <dl
          ref={listRef}
          className="relative"
          onPointerDownCapture={take}
          onFocusCapture={take}
          onKeyDownCapture={take}
        >
          {/* The pass, as an object. One rail over the whole list, so the
              nib's route from one row to the next is one continuous space
              rather than four boxes it has to teleport between. Its
              viewBox is written at the start of each beat from its own
              measured size, so one user unit is one CSS pixel. */}
          <svg
            aria-hidden
            className="ts-rail pointer-events-none absolute -inset-x-4 inset-y-0 overflow-visible text-pp-accent"
            fill="none"
            preserveAspectRatio="none"
          >
            {/* A path that exists only to guide the nib. */}
            <path className="ts-route" d="M0 0" stroke="none" fill="none" />
            <circle
              className="ts-ring"
              cx="0"
              cy="0"
              r="5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              opacity="0"
            />
            {/* Parked at the origin, invisible, until the route moves it. */}
            <g className="ts-nib" opacity="0">
              <circle cx="0" cy="0" r="3.4" fill="currentColor" />
            </g>
          </svg>

          {items.map((item, idx) => {
            const entry = ENTRY[item.id];
            const datum =
              item.id === "languages" ? `${langCount} languages` : entry?.datum;
            const done = cleared[idx];
            const busy = active === idx;

            return (
              <div key={item.id}>
                <div
                  className={cn(
                    "relative grid grid-cols-[minmax(0,1fr)_auto] gap-x-8 gap-y-3 py-7",
                    "md:grid-cols-[132px_minmax(0,1fr)_148px] md:items-baseline md:gap-x-12 md:py-9",
                  )}
                >
                  {/* The wash under the entry being checked: the only place
                      on this white stock where the accent is a surface. */}
                  <span
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute -inset-x-4 inset-y-0 rounded-lg bg-pp-accent/[0.04] transition-opacity duration-500",
                      busy ? "opacity-100" : "opacity-0",
                    )}
                  />

                  <span className={cn(KEY_TYPE, "relative md:col-start-1 md:row-start-1")}>
                    {entry?.key ?? item.id}
                  </span>

                  {/* The stamp. Below md it rides up beside its key: a
                      right-hand column on a phone is a column of two words
                      with a screen of dead air beside it. */}
                  {datum ? (
                    <Stamp
                      datum={datum}
                      field={entry?.key ?? item.id}
                      done={done}
                      busy={busy}
                      onCheck={() => check(idx)}
                      className="relative justify-self-end md:col-start-3 md:row-start-1"
                    />
                  ) : (
                    <span aria-hidden className="md:col-start-3 md:row-start-1" />
                  )}

                  <div className="relative col-span-2 md:col-span-1 md:col-start-2 md:row-start-1">
                    <dt
                      className={cn(
                        "text-[19px] leading-7 tracking-[-0.01em] text-pretty transition-colors duration-500 md:text-[21px] md:leading-8",
                        done ? "text-pp-ink" : "text-pp-ink/60",
                      )}
                    >
                      {item.label}
                    </dt>
                    <dd className="mt-2 max-w-[62ch] text-[15px] leading-6 text-pretty text-pp-muted md:text-base md:leading-7">
                      {item.note}
                    </dd>
                  </div>
                </div>

                {/* Ruled by the nib as it crosses. Without GSAP — no
                    JavaScript, or reduced motion — an SVG stroke rests
                    fully drawn, so a cleared row's rule is simply there. */}
                <svg
                  aria-hidden
                  viewBox="0 0 100 1"
                  preserveAspectRatio="none"
                  className={cn(
                    "ts-rule block h-px w-full overflow-visible text-pp-rule",
                    done ? "visible" : "invisible",
                  )}
                >
                  <line
                    className="ts-rule-line"
                    x1="0"
                    y1="0.5"
                    x2="100"
                    y2="0.5"
                    stroke="currentColor"
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              </div>
            );
          })}
        </dl>
      </Frame>
    </section>
  );
}

/**
 * The right-hand column: one mark and one label, in one place.
 *
 * The mark — the idle dot and the tick that replaces it — is a single SVG
 * that is mounted for the life of the section, because a tick that is
 * drawn cannot be a tick that has just been mounted. The button is an
 * overlay over the whole cell rather than a wrapper around it, for the
 * same reason: the control can come and go without taking the mark with
 * it. The three labels sit in one grid cell so the cell is as wide as the
 * widest of them from the server's first paint and nothing moves when
 * they swap.
 */
function Stamp({
  datum,
  field,
  done,
  busy,
  onCheck,
  className,
}: {
  datum: string;
  field: string;
  done: boolean;
  busy: boolean;
  onCheck: () => void;
  className?: string;
}) {
  return (
    <span
      className={cn(
        DATUM_TYPE,
        "relative inline-flex items-center gap-1.5 transition-colors duration-500 md:w-[148px] md:justify-end",
        done ? "text-pp-accent" : "text-pp-muted",
        className,
      )}
    >
      <svg aria-hidden viewBox="0 0 12 12" className="ts-mark size-3 overflow-visible">
        {/* Not yet checked. It goes out under the ring as the tick starts. */}
        <circle
          className={cn("ts-dot", done && "invisible")}
          cx="6"
          cy="6"
          r="2"
          fill="currentColor"
        />
        {/* Written by the timeline. No ghost twin under it: a tick printed
            in advance would say the row was verified before anyone looked. */}
        <path
          className={cn("ts-tick", !done && "invisible")}
          d="M2.5 6.4 4.9 8.8 9.5 3.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <span className="grid justify-items-end">
        <Word live={!done && !busy}>Check</Word>
        <Word live={busy}>Checking</Word>
        <Word live={done}>{datum}</Word>
      </span>

      {/* The control, while there is still something to check. */}
      {done ? null : (
        <button
          type="button"
          onClick={onCheck}
          className="absolute inset-0 cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-pp-ink"
        >
          <span className="sr-only">Check {field.toLowerCase()}</span>
        </button>
      )}
    </span>
  );
}

/** One of the label's three states, all laid into the same cell. */
function Word({ live, children }: { live: boolean; children: React.ReactNode }) {
  return (
    <span
      aria-hidden={!live}
      className={cn(
        "col-start-1 row-start-1 whitespace-nowrap transition-opacity duration-300",
        live ? "opacity-100" : "opacity-0",
      )}
    >
      {children}
    </span>
  );
}
