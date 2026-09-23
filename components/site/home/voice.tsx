"use client";

import { Fragment, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { gsap as GsapCore } from "gsap";
import { cn } from "@/lib/utils";
import { Frame, Rule } from "@/components/site/product/primitives";
import { useKitContext } from "@/components/site/product/motion-kit";
import { holdFor, useInView } from "@/components/site/product/timing";
import { PLATFORM } from "@/lib/pages/ai-agents";
import { HOME, type HomeRegister } from "@/lib/pages/home";
import type { GreetingRow, GreetingTable } from "@/lib/pages/home.server";
import { ChipRail, RoundButton, Segmented, Sizer, centreInRail, useRovingRadio } from "./controls";
import { HomeHeading } from "./heading";
import { useStageMotion } from "./motion";
import { TYPE } from "./type";
import "./voice.css";

/* ------------------------------------------------------------------ *
 * #how — what the caller hears. The first line the app writes for a
 * made-up business, in any of its languages and three registers, with
 * the sentence that says it is an AI underlined as it lands.
 *
 * Every greeting arrives from the server as data (buildGreetingTable),
 * so no greeting code ships to the browser. The line is one grid cell
 * stacked over invisible copies of each language's longest greeting:
 * the tallest of them holds the height, so no language moves the page.
 *
 * Untouched, the section walks the languages on its own while it has
 * the screen, holding each for as long as it takes to read, with a ring
 * round the pause button counting the hold down. The first choice the
 * reader makes ends the walk for good. With reduced motion it never
 * walks and every choice switches the line at once.
 * ------------------------------------------------------------------ */

type Choice = { lang: string; register: HomeRegister };
type Gsap = typeof GsapCore;

const keyOf = (c: Choice) => `${c.lang}:${c.register}`;
const START: Choice = { lang: "en", register: "professional" };
const textOf = (r: GreetingRow) => r.before + r.disclosure + r.after;

const useIsoLayoutEffect = typeof document !== "undefined" ? useLayoutEffect : useEffect;

/* ─── The line, in pieces ─────────────────────────────────────────── */

/** Words; or, for a script written without spaces, characters, with any Latin run kept whole. */
const WORDS = /\S+|\s+/g;
const CHARS = /[\p{Script=Latin}\d'’-]+|\s+|\S/gu;

/** The business's name never breaks across two lines, in the line or in its sizers. */
const NAME = PLATFORM.design.company;

/**
 * One inline span per piece; the spaces between stay bare text, so the
 * line wraps as plain text would, and the name is one unbreakable piece.
 */
function Pieces({ text, split }: { text: string; split: GreetingRow["split"] }) {
  return text.split(NAME).flatMap((part, n) => [
    ...(n > 0
      ? [
          <span key={`n${n}`} className="home-voice-w whitespace-nowrap">
            {NAME}
          </span>,
        ]
      : []),
    ...(part.match(split === "chars" ? CHARS : WORDS) ?? []).map((p, i) =>
      /^\s+$/.test(p) ? (
        <Fragment key={`${n}-${i}`}>{p}</Fragment>
      ) : (
        <span key={`${n}-${i}`} className="home-voice-w">
          {p}
        </span>
      ),
    ),
  ]);
}

/** A sizer's copy: plain text, with the name held together exactly as the line holds it. */
function Held({ text }: { text: string }) {
  return text.split(NAME).map((part, n) => (
    <Fragment key={n}>
      {n > 0 && <span className="whitespace-nowrap">{NAME}</span>}
      {part}
    </Fragment>
  ));
}

/**
 * How long a greeting stays up once it has landed. `holdFor` counts
 * words by their spaces; a line written without them reads at about
 * two characters a word.
 */
function dwell(r: GreetingRow) {
  const text = textOf(r);
  const words = r.split === "chars" ? "x ".repeat(Math.ceil(Array.from(text.replace(/\s/g, "")).length / 2)) : text;
  return holdFor(words) + 600;
}

/* ─── The motor ───────────────────────────────────────────────────── *
 * Everything the animation needs between renders, in one mutable bag.
 * React owns which greeting is in the DOM; GSAP only ever moves the
 * pieces React put there, and every new greeting gets fresh pieces.
 */

type Motor = {
  /** GSAP, while motion is allowed; null before it arrives and with reduced motion. */
  g: Gsap | null;
  ctx: gsap.Context | null;
  enter: gsap.core.Timeline | null;
  leave: gsap.core.Timeline | null;
  hold: gsap.core.Tween | null;
  /** The latest choice; an exit already under way lands on it. */
  want: Choice;
  /** The greeting in the DOM. */
  shown: string;
  /** Taken down before it was ever seen, waiting to come into view. */
  armed: boolean;
};

type Parts = { words: HTMLElement[]; disc: HTMLElement | null; dot: HTMLElement | null };

function partsOf(line: HTMLElement | null, dot: HTMLElement | null): Parts | null {
  if (!line) return null;
  return {
    words: Array.from(line.querySelectorAll<HTMLElement>(".home-voice-w")),
    disc: line.querySelector<HTMLElement>(".home-voice-d"),
    dot,
  };
}

/** The pieces' starting frame: low, blurred and gone. */
function lower(g: Gsap, p: Parts) {
  if (p.words.length) g.set(p.words, { top: 8, autoAlpha: 0, filter: "blur(3px)" });
  if (p.disc) g.set(p.disc, { autoAlpha: 0, filter: "blur(3px)" });
  if (p.dot) g.set(p.dot, { scale: 0.4 });
}

/**
 * The greeting arrives: its words rise into place, then the sentence
 * that says it is an AI resolves in the gap they left, then its
 * underline inks in (CSS, on data-landed) and the tag's dot answers.
 */
function enter(m: Motor, p: Parts, onLanded: () => void) {
  const g = m.g;
  if (!g || !m.ctx) return;
  m.enter?.kill();
  m.ctx.add(() => {
    lower(g, p);
    const all = p.disc ? [...p.words, p.disc] : p.words;
    const tl = g.timeline({
      onComplete: () => {
        g.set(all, { clearProps: "top,filter,opacity,visibility" });
        m.enter = null;
      },
    });
    if (p.words.length) {
      tl.to(p.words, {
        top: 0,
        autoAlpha: 1,
        filter: "blur(0px)",
        duration: 0.45,
        ease: "power2.out",
        stagger: Math.min(0.02, 0.6 / p.words.length),
      });
    }
    if (p.disc) tl.to(p.disc, { autoAlpha: 1, filter: "blur(0px)", duration: 0.5, ease: "power2.out" }, "-=0.12");
    tl.call(onLanded);
    if (p.dot) tl.to(p.dot, { scale: 1, duration: 0.5, ease: "back.out(2)" }, "<");
    m.enter = tl;
  });
}

/** The greeting leaves, lifting away word by word, faster than it came. */
function leave(m: Motor, p: Parts, ring: Element | null, onDone: () => void) {
  const g = m.g;
  if (!g || !m.ctx) return;
  m.ctx.add(() => {
    const tl = g.timeline({
      onComplete: () => {
        m.leave = null;
        onDone();
      },
    });
    if (p.words.length) {
      tl.to(
        p.words,
        { top: -6, autoAlpha: 0, duration: 0.18, ease: "power2.in", stagger: Math.min(0.012, 0.24 / p.words.length) },
        0,
      );
    }
    if (p.disc) tl.to(p.disc, { autoAlpha: 0, duration: 0.18, ease: "power2.in" }, 0);
    if (p.dot) tl.to(p.dot, { scale: 0.4, duration: 0.18, ease: "power2.in" }, 0);
    if (ring) tl.to(ring, { opacity: 0, duration: 0.18, ease: "power2.in" }, 0);
    m.leave = tl;
  });
}

/* ─── The section ─────────────────────────────────────────────────── */

export function Voice({ table }: { table: GreetingTable }) {
  const v = HOME.voice;
  const { play, pause } = HOME.call.controls;

  const rows = useMemo(() => new Map(table.rows.map((r) => [keyOf(r), r])), [table.rows]);
  /** One chip per language, in the app's own order. */
  const langs = useMemo(() => table.rows.filter((r) => r.register === START.register), [table.rows]);
  const regLabel = (id: HomeRegister) => v.registers.find((r) => r.id === id)?.label ?? id;

  const [choice, setChoice] = useState<Choice>(START);
  const [shown, setShown] = useState(() => keyOf(START));
  const [landed, setLanded] = useState(true);
  const row = rows.get(shown) ?? table.rows[0];

  const stageRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLParagraphElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const motor = useRef<Motor>({
    g: null,
    ctx: null,
    enter: null,
    leave: null,
    hold: null,
    want: START,
    shown: keyOf(START),
    armed: false,
  });

  const { kit, reduce, playing, paused, setPaused, interacted, markInteracted } = useStageMotion(stageRef, {
    id: "how",
  });
  const lineSeen = useInView(lineRef, "0px 0px -15% 0px");
  /** The walk through the languages: until the first choice, never with reduced motion. */
  const touring = !interacted && !reduce;

  // GSAP has arrived. A line still below the screen is taken down, to be
  // set the first time it comes into view; one already seen stays put.
  useKitContext(
    kit,
    ({ gsap }) => {
      const m = motor.current;
      if (reduce) {
        // Reduced motion switched on mid-visit: show the latest choice, whole.
        setLanded(true);
        setShown(keyOf(m.want));
        return;
      }
      m.g = gsap;
      m.ctx = gsap.context(() => {});
      const p = partsOf(lineRef.current, dotRef.current);
      if (p && lineRef.current && lineRef.current.getBoundingClientRect().top > window.innerHeight) {
        lower(gsap, p);
        setLanded(false);
        m.armed = true;
      }
      return () => {
        m.ctx?.revert();
        m.g = m.ctx = m.enter = m.leave = m.hold = null;
        m.armed = false;
      };
    },
    { scope: stageRef, dependencies: [reduce], revertOnUpdate: true },
  );

  // The first sight of a line that was taken down.
  useEffect(() => {
    const m = motor.current;
    if (!lineSeen || !m.armed || !m.g) return;
    const p = partsOf(lineRef.current, dotRef.current);
    if (!p) return;
    m.armed = false;
    enter(m, p, () => setLanded(true));
  }, [lineSeen, kit]);

  // A new greeting is in the DOM: bring it in before it paints.
  const mounted = useRef(false);
  useIsoLayoutEffect(() => {
    const m = motor.current;
    m.shown = shown;
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const p = partsOf(lineRef.current, dotRef.current);
    if (m.g && p) enter(m, p, () => setLanded(true));
  }, [shown]);

  /** Puts `next` on the line: at once without motion, otherwise after the current one has left. */
  function show(next: Choice) {
    const m = motor.current;
    m.want = next;
    const key = keyOf(next);
    const p = partsOf(lineRef.current, dotRef.current);
    if (!m.g || !p) {
      setShown(key);
      return;
    }
    // An exit is under way; it lands on the latest choice.
    if (m.leave) return;
    if (m.armed) {
      m.armed = false;
      if (key === m.shown) enter(m, p, () => setLanded(true));
      else setShown(key);
      return;
    }
    if (key === m.shown) return;
    m.hold?.kill();
    m.hold = null;
    m.enter?.kill();
    m.enter = null;
    setLanded(false);
    leave(m, p, ringRef.current, () => {
      const latest = keyOf(m.want);
      if (latest !== m.shown) setShown(latest);
      else {
        const again = partsOf(lineRef.current, dotRef.current);
        if (again) enter(m, again, () => setLanded(true));
      }
    });
  }

  function choose(next: Choice, byHand: boolean) {
    if (byHand) markInteracted();
    setChoice(next);
    show(next);
  }

  const advance = useEffectEvent(() => {
    const at = table.tour.indexOf(motor.current.want.lang);
    choose({ lang: table.tour[(at + 1) % table.tour.length], register: START.register }, false);
  });

  // The hold: the ring closes while the greeting is up, then the walk
  // moves on. Offscreen, behind another stage, in a hidden tab or paused
  // by hand, it stops where it is and picks up from there.
  const counting = touring && playing && landed && kit !== null;
  const holdMs = dwell(row);
  useEffect(() => {
    const m = motor.current;
    const ring = ringRef.current;
    if (!m.g || !m.ctx || !ring) return;
    if (!counting) {
      m.hold?.pause();
      return;
    }
    if (m.hold) {
      m.hold.resume();
      return;
    }
    const g = m.g;
    m.ctx.add(() => {
      m.hold = g.fromTo(
        ring,
        { strokeDashoffset: 1, opacity: 1 },
        {
          strokeDashoffset: 0,
          duration: holdMs / 1000,
          ease: "none",
          onComplete: () => {
            m.hold = null;
            advance();
          },
        },
      );
    });
  }, [counting, holdMs, shown, kit]);

  // On a phone the chips are a rail: keep the checked one in its middle.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail || rail.scrollWidth <= rail.clientWidth + 1) return;
    const chip = rail.querySelector<HTMLElement>(`[data-lang="${choice.lang}"]`);
    if (chip) centreInRail(rail, chip, reduce);
  }, [choice.lang, reduce]);

  const langIndex = langs.findIndex((l) => l.lang === choice.lang);
  const radios = useRovingRadio({
    count: langs.length,
    index: langIndex,
    orientation: "horizontal",
    onChange: (i) => choose({ lang: langs[i].lang, register: choice.register }, true),
  });

  // Invisible copies that hold the line and the caption at their tallest:
  // each language's longest greeting (table.sizer, the widest of all, is
  // among them), since which one wraps to the most lines depends on the
  // width and on each script's own face. Sizer's markup, with the copy's
  // language on the block itself so it wraps in the line's faces and leading.
  const sizers = useMemo(() => {
    const longest = new Map<string, GreetingRow>();
    for (const r of table.rows) {
      const had = longest.get(r.lang);
      if (!had || textOf(r).length > textOf(had).length) longest.set(r.lang, r);
    }
    return [...longest.values()].map((r) => (
      <div
        key={r.lang}
        aria-hidden
        lang={r.lang}
        dir={r.dir}
        className={cn(TYPE.cinema, "home-voice-script invisible text-balance [grid-area:1/1]")}
      >
        <Held text={textOf(r)} />
      </div>
    ));
  }, [table.rows]);
  const metaSizer = useMemo(() => {
    const label = langs.reduce((a, b) => (b.label.length > a.length ? b.label : a), "");
    const reg = v.registers.reduce((a, b) => (b.label.length > a.length ? b.label : a), "");
    return v.meta(label, reg);
  }, [langs, v]);

  return (
    // Focusable from script only: the FAQ's "Set its register yourself"
    // jumps here and should carry keyboard focus with it.
    <section id="how" aria-labelledby="how-title" tabIndex={-1} className="scroll-mt-28 outline-none">
      <Frame>
        <HomeHeading id="how-title" eyebrow={v.eyebrow} title={v.title} sub={v.sub} />
      </Frame>

      <div ref={stageRef}>
        <Rule className="mt-10 lg:mt-12" />

        <Frame className="flex flex-col items-center py-14 text-center md:py-20">
          <p className={cn(TYPE.label, "text-balance text-pp-muted")}>{v.stageLabel}</p>

          <div className="mt-6 grid w-full max-w-[880px] items-center">
            {sizers}
            <p
              ref={lineRef}
              aria-hidden
              lang={row.lang}
              dir={row.dir}
              data-landed={landed ? "" : undefined}
              className={cn(TYPE.cinema, "home-voice-script text-balance [grid-area:1/1]")}
            >
              <Pieces key={`${shown}-b`} text={row.before} split={row.split} />
              <span key={`${shown}-d`} className="home-disclose home-voice-d">
                {row.disclosure}
              </span>
              <Pieces key={`${shown}-a`} text={row.after} split={row.split} />
            </p>
          </div>
          <p className="sr-only" lang={row.lang} dir={row.dir}>
            {textOf(row)}
          </p>

          <p className="mt-6 inline-flex h-7 items-center gap-2 rounded-full bg-white px-3 text-[13px] shadow-[0_0_0_1px_rgb(24_16_40/0.06)]">
            <span ref={dotRef} aria-hidden className="size-1.5 shrink-0 rounded-full bg-[#551a89]" />
            {v.tag}
          </p>
        </Frame>

        <Rule />

        <Frame className="pt-8">
          <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-x-12">
            <div>
              <div className="flex h-10 items-center">
                <p className={cn(TYPE.label, "text-pp-muted")}>{v.toneLabel}</p>
              </div>
              <Segmented
                label={v.toneLabel}
                options={v.registers}
                value={choice.register}
                onChange={(register) => choose({ lang: choice.lang, register }, true)}
                className="mt-2 w-full md:w-auto max-sm:[&>button]:px-1"
              />
            </div>

            <div className="min-w-0">
              <div className="flex h-10 items-center justify-between gap-4">
                <p id="how-lang" className={cn(TYPE.label, "text-pp-muted")}>
                  {v.languageLabel}
                </p>
                <div
                  className={cn(
                    "relative size-10 transition-[opacity,visibility] duration-300",
                    !touring && "invisible opacity-0",
                  )}
                >
                  <svg
                    aria-hidden
                    viewBox="0 0 50 50"
                    className="home-voice-ring pointer-events-none absolute -top-[5px] -left-[5px] size-[50px] -rotate-90 text-pp-ink/45"
                  >
                    <circle ref={ringRef} cx="25" cy="25" r="24" pathLength={1} fill="none" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                  <RoundButton
                    icon={paused ? "play" : "pause"}
                    label={paused ? play : pause}
                    onClick={() => setPaused(!paused)}
                  />
                </div>
              </div>
              <div onPointerDown={markInteracted}>
                <ChipRail labelledBy="how-lang" railRef={railRef} className="mt-2 md:flex-wrap md:overflow-visible md:snap-none">
                  {langs.map((l, i) => {
                    const on = i === langIndex;
                    return (
                      <button
                        key={l.lang}
                        type="button"
                        data-lang={l.lang}
                        {...radios.getItemProps(i)}
                        className={cn(
                          // The segments' own size and padding, so the two groups read as one row of controls.
                          "relative h-9 rounded-full px-4 text-sm whitespace-nowrap transition-[background-color,color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
                          // 36px drawn, 44px to a finger: the rows' 8px gap is half above, half below.
                          "before:absolute before:inset-x-0 before:-inset-y-1",
                          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink",
                          on ? "bg-pp-ink text-white" : "bg-pp-card text-pp-ink hover:bg-[#eae8ef]",
                        )}
                      >
                        {l.label}
                      </button>
                    );
                  })}
                </ChipRail>
              </div>
            </div>
          </div>

          {/* The rule on the left; on the right, under the transport, what is on the line now. */}
          <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
            <p className={cn(TYPE.meta, "max-w-[560px] text-pretty")}>{v.customNote}</p>
            <div className="grid shrink-0 lg:text-right">
              <Sizer as="span" className={TYPE.mono}>
                {metaSizer}
              </Sizer>
              <p className={cn(TYPE.mono, "text-pp-muted [grid-area:1/1]")}>
                {v.meta(row.label, regLabel(row.register))}
              </p>
            </div>
          </div>
        </Frame>
      </div>
    </section>
  );
}
