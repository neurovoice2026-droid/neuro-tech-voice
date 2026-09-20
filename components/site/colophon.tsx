"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { COLOPHON, INTEGRATIONS } from "@/lib/site";
import { CornerDot } from "./corner-dot";
import { Eyebrow, Frame } from "./product/primitives";
import { holdFor, useInView, usePrefersReducedMotion } from "./product/timing";

/**
 * The colophon strip — the first white thing on the page, and the first
 * thing on the page that is doing something rather than arriving.
 *
 * The hero above it is dark and the imprint at the foot of the page is
 * dark; everything between them is the light product system, the same one
 * every mega-menu page is set in. That makes this strip the transition,
 * and a transition is a job you do once, quietly, in one band. It carries
 * `.pp` itself because the homepage's `main` is not a `.pp` main — the
 * tokens have to start somewhere, and they start here.
 *
 * It does NOT try to blend into the hero. A gradient down out of black
 * would be the site apologising for its own structure; the product pages
 * change stock at a hard edge and so does this. The band is --pp-band
 * rather than plain white for exactly one reason: under a black hero,
 * white-on-black-on-white makes the strip read as a gap. The faint violet
 * grey gives it a body, and the hairline under it hands the page off to
 * the open field below.
 *
 * THE SCENE: A CALL WALKING THE STRIP.
 *
 * The sentence on the right is the whole claim of this band — the agent
 * reads your calendar during the call and writes the appointment back
 * before the caller has hung up. So the strip plays that: a head moves
 * along the connected tools, one at a time, the way a live call touches
 * them. The tool in hand comes up to full strength — its own colours, its
 * label in ink, a violet hairline wiping under it for exactly as long as
 * the head holds there — while the rest sit back in grey. The punctuation
 * between entries lights violet as the baton passes through it. When the
 * head reaches the end it starts again, because the next call starts
 * again.
 *
 * That is the argument this band could not make before. Five logos fading
 * up on scroll say "these exist". Five logos being picked up in turn say
 * "these are wired, and something is using them right now".
 *
 * ON THE HOUSE CLOCK. holdFor(label) sets each hold at reading pace,
 * floored at 1.4s; useInView gates the timer so nothing steps off screen
 * or in a background tab; usePrefersReducedMotion gives those readers the
 * scene's most informative frame straight away — every tool lit at once,
 * no timers at all. The movement itself is CSS: React moves an index,
 * transition-* does the animating.
 *
 * THE READER WINS. The first pointer, focus or key event anywhere in the
 * strip stops the walk for good and hands the head to whatever the reader
 * is pointing at. It never takes control back.
 */
export function Colophon() {
  const reduce = usePrefersReducedMotion();
  const rootRef = useRef<HTMLElement>(null);
  const inView = useInView(rootRef, "-10% 0px");

  // -1 is "every tool lit": the still frame of the scene, which is what
  // the server renders, what reduced motion keeps, and what the strip
  // falls back to before it has ever played.
  const [head, setHead] = useState(-1);
  const [taken, setTaken] = useState(false);

  const running = inView && !reduce && !taken;

  // The walk keeps its own cursor so the timer can chain on each entry's
  // own hold without a state updater ever doing work on the side.
  const cursor = useRef(-1);
  useEffect(() => {
    if (!running) return;
    let id = 0;
    const step = () => {
      const next = cursor.current < 0 ? 0 : (cursor.current + 1) % INTEGRATIONS.length;
      cursor.current = next;
      setHead(next);
      id = window.setTimeout(step, holdFor(INTEGRATIONS[next].label));
    };
    // The first tool is picked up on the same clock as every other one.
    id = window.setTimeout(step, holdFor(INTEGRATIONS[0].label));
    return () => window.clearTimeout(id);
  }, [running]);

  const takeOver = useCallback(() => setTaken(true), []);
  const point = (i: number) => {
    setTaken(true);
    cursor.current = i;
    setHead(i);
  };

  // Reduced motion, and the untouched first frame, light everything.
  const all = head < 0;

  return (
    <section
      ref={rootRef}
      aria-label={COLOPHON.line}
      className="pp relative isolate"
      onPointerDownCapture={takeOver}
      onFocusCapture={takeOver}
      onKeyDownCapture={takeOver}
    >
      {/* The band and its closing hairline are full-bleed: the strip is a
          rule across the page, so its edges cannot stop at the measure the
          content sits on. */}
      <div className="border-b border-pp-hair bg-pp-band">
        <Frame className="flex flex-col gap-6 py-8 md:flex-row md:items-center md:gap-10 md:py-9">
          {/* Plate: the section eyebrow every pp section opens with, plus
              the count, which is the one numeral on the strip. */}
          <div className="flex shrink-0 items-center gap-3">
            <Eyebrow>{COLOPHON.kicker}</Eyebrow>
            <span aria-hidden className="h-4 w-px bg-pp-rule" />
            <span className="text-[12px] leading-4 tabular-nums text-pp-muted">
              {String(INTEGRATIONS.length).padStart(2, "0")}
            </span>
          </div>

          {/* The five marks. They wrap rather than scroll; at the narrowest
              width that is two lines of logos, which costs nothing and keeps
              every name selectable and findable by the browser's own search. */}
          <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-x-6 gap-y-3">
            {INTEGRATIONS.map((it, i) => {
              const live = all || head === i;
              // The dot after an entry is the baton: it lights while the
              // head is on that entry and on its way to the next.
              const passing = !all && head === i;
              return (
                <li
                  key={it.label}
                  className="flex items-center gap-6"
                  onPointerEnter={() => point(i)}
                >
                  <span className="relative flex items-center gap-2.5 pb-1">
                    {/* The vendor's own mark, not the lucide glyph beside it in
                        the constant. A monoline calendar icon is a drawing of the
                        category, and a reader scanning this strip is checking for
                        one specific logo — the glyph answers "calendars" when the
                        question was "mine". Decorative, because the label next to
                        it says the same thing and would be announced twice. */}
                    <Image
                      src={it.mark}
                      alt=""
                      width={24}
                      height={24}
                      className={`size-5 shrink-0 transition duration-300 ${
                        live ? "opacity-100 saturate-100" : "opacity-55 saturate-0"
                      }`}
                    />
                    <span
                      className={`whitespace-nowrap text-[15px] leading-6 tracking-[-0.01em] transition-colors duration-300 ${
                        live ? "text-pp-ink" : "text-pp-muted"
                      }`}
                    >
                      {it.label}
                    </span>
                    {/* The hold, drawn. It wipes across for exactly as long as
                        the head stays here, then leaves with the head. */}
                    <span
                      aria-hidden
                      className={`absolute inset-x-0 bottom-0 h-px origin-left bg-pp-accent transition-transform ease-linear ${
                        passing ? "scale-x-100" : "scale-x-0"
                      }`}
                      style={{ transitionDuration: passing ? `${holdFor(it.label)}ms` : "200ms" }}
                    />
                  </span>
                  {/* Punctuation between entries, never after the last one. */}
                  {i < INTEGRATIONS.length - 1 && (
                    <CornerDot
                      className={`size-1.5 shrink-0 transition-colors duration-300 ${
                        passing ? "text-pp-accent" : "text-pp-muted/45"
                      }`}
                    />
                  )}
                </li>
              );
            })}
          </ul>

          {/* The only sentence on the strip, and the only thing here that says
              what an integration actually does during a call. It outranks the
              logos, so it never hides. */}
          <p className="max-w-[46ch] shrink-0 text-pretty text-[14px] leading-5 text-pp-muted md:max-w-[34ch] md:text-right">
            {COLOPHON.line}
          </p>
        </Frame>
      </div>
    </section>
  );
}
