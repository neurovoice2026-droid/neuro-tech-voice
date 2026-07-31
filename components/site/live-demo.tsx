"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  useInView,
  useReducedMotion,
} from "framer-motion";
import { PhoneCall, CalendarCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { CoverCheck } from "./ui";
import { Reveal } from "./reveal";
import { VoiceDemo } from "./voice-demo";

/**
 * The demo spread — the interior spread's second turn.
 *
 * Every word here is the one that was here before. What changed is the
 * stock it is printed on: this section used to be a light page with the
 * site's `bg-mesh`, `--primary` at #8249df, Geist, and a white card. It
 * now runs the features section's world exactly — the sticky WebGL field
 * with its CSS still underneath, the grain, the two scrims that bridge it
 * to the ink above and below, --cover-paper on --cover-field-low,
 * --cover-brand-lit as the only accent, --cover-panel for the card, and
 * Inter Tight at 500.
 *
 * Which also means every length inside is now in `em` rather than `rem`.
 * That is not cosmetic: `.cover` sets a fluid `font-size`, so `rem` sizes
 * would sit at a fixed pixel scale while everything around them breathed
 * with the viewport, and the card would drift out of step with the panels
 * one section above it.
 */

type Turn = { who: "caller" | "agent"; text: string };

const TURNS: Turn[] = [
  { who: "caller", text: "Hi, do you have any openings this week?" },
  {
    who: "agent",
    text: "We do! I've got Thursday at 2 PM or Friday morning — which works better?",
  },
  { who: "caller", text: "Thursday at 2 is perfect." },
  {
    who: "agent",
    text: "Done — you're booked for Thursday at 2:00 PM. A confirmation is on its way to your email.",
  },
];

// Cumulative timeline of events that plays once the card scrolls into view.
const EVENTS: { t: number; typing?: boolean; show?: number; booked?: boolean }[] =
  [
    { t: 400, show: 1 },
    { t: 800, typing: true },
    { t: 1300, typing: false, show: 2 },
    { t: 900, show: 3 },
    { t: 700, typing: true },
    { t: 1300, typing: false, show: 4 },
    { t: 700, booked: true },
  ];

function TinyWave() {
  const reduce = useReducedMotion();
  return (
    <div className="flex h-[1.3em] items-center gap-[0.12em]">
      {Array.from({ length: 18 }).map((_, i) => {
        const base = 0.3 + 0.7 * Math.abs(Math.sin(i * 0.9));
        return (
          <motion.span
            key={i}
            className="w-[0.14em] rounded-full bg-[var(--cover-brand-lit)]/75"
            style={{ height: "100%", transformOrigin: "center" }}
            animate={
              reduce ? { scaleY: base } : { scaleY: [base * 0.4, base, base * 0.5] }
            }
            transition={{
              duration: 0.7 + (i % 4) * 0.12,
              repeat: Infinity,
              ease: "easeInOut",
              delay: (i % 6) * 0.05,
            }}
          />
        );
      })}
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex w-fit items-center gap-[0.3em] rounded-[0.9em] rounded-bl-[0.2em] bg-[var(--cover-paper)]/8 px-[0.9em] py-[0.75em]">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-[0.4em] rounded-full bg-[var(--cover-paper)]/45"
          animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.15,
          }}
        />
      ))}
    </div>
  );
}

function CallCard() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20% 0px" });
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(0);
  const [typing, setTyping] = useState(false);
  const [booked, setBooked] = useState(false);

  useEffect(() => {
    if (!inView || reduce) return;
    let cum = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    EVENTS.forEach((ev) => {
      cum += ev.t;
      timers.push(
        setTimeout(() => {
          if (ev.typing !== undefined) setTyping(ev.typing);
          if (ev.show !== undefined) setShown((s) => Math.max(s, ev.show!));
          if (ev.booked) setBooked(true);
        }, cum),
      );
    });
    return () => timers.forEach(clearTimeout);
  }, [inView, reduce]);

  // Reduced motion skips straight to the finished call — the whole
  // transcript, already booked. Derived rather than written into state from
  // the effect, which would be a synchronous setState and a second render
  // to reach a value both branches already know.
  const shownNow = reduce && inView ? TURNS.length : shown;
  const bookedNow = (reduce && inView) || booked;

  return (
    <div
      ref={ref}
      className="relative mx-auto w-full max-w-[26em] overflow-hidden rounded-[1.4em] border border-[var(--cover-paper)]/12 bg-[var(--cover-panel)] text-[var(--cover-paper)] shadow-[0_1.8em_4em_-1.5em_rgba(0,0,0,0.85)]"
    >
      {/* The corner light the light-theme card got from `.glow-blob`. That
          utility is built on --primary-rgb, which is the site's #8249df and
          the one purple this section is not allowed to show, so the same
          gesture is drawn here from the cover's own accent. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-[4em] -top-[4em] size-[10em] rounded-full opacity-25 blur-[3em]"
        style={{ background: "var(--cover-brand-lit)" }}
      />

      {/* call header */}
      <div className="relative flex items-center justify-between border-b border-[var(--cover-paper)]/10 px-[1.2em] py-[1em]">
        <div className="flex items-center gap-[0.8em]">
          <span className="relative grid size-[2.5em] place-items-center rounded-full bg-[var(--cover-brand-lit)]/15 text-[var(--cover-brand-lit)]">
            <PhoneCall className="size-[1.25em]" strokeWidth={2} />
            <span className="absolute -right-[0.1em] -top-[0.1em] size-[0.65em] animate-pulse rounded-full bg-[var(--cover-mint)] ring-2 ring-[var(--cover-panel)]" />
          </span>
          <div>
            <p className="text-[0.88em] font-medium">On a call</p>
            <p className="text-[0.75em] text-[var(--cover-paper)]/50">
              Incoming · connected
            </p>
          </div>
        </div>
        <TinyWave />
      </div>

      {/* transcript */}
      <div className="relative flex min-h-[17em] flex-col gap-[0.75em] p-[1.2em]">
        {TURNS.slice(0, shownNow).map((turn, i) => (
          <motion.div
            key={i}
            initial={reduce ? false : { opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "flex",
              turn.who === "agent" ? "justify-end" : "justify-start",
            )}
          >
            <div
              className={cn(
                "max-w-[85%] px-[0.9em] py-[0.65em] text-[0.85em] leading-[1.45]",
                turn.who === "agent"
                  ? "rounded-[0.9em] rounded-br-[0.2em] bg-[var(--cover-brand-lit)] text-[var(--cover-ink)]"
                  : "rounded-[0.9em] rounded-bl-[0.2em] bg-[var(--cover-paper)]/7 text-[var(--cover-paper)]/85",
              )}
            >
              {turn.text}
            </div>
          </motion.div>
        ))}

        <AnimatePresence>
          {typing && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex justify-start"
            >
              <TypingDots />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {bookedNow && (
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="mt-auto flex items-center gap-[0.8em] rounded-[0.8em] border border-[var(--cover-brand-lit)]/25 bg-[var(--cover-brand-lit)]/8 p-[0.8em]"
            >
              <span className="grid size-[2.2em] shrink-0 place-items-center rounded-full bg-[var(--cover-brand-lit)] text-[var(--cover-ink)]">
                <CalendarCheck className="size-[1.15em]" strokeWidth={2} />
              </span>
              <div>
                <p className="text-[0.85em] font-medium">Meeting booked</p>
                <p className="text-[0.75em] text-[var(--cover-paper)]/50">
                  Thursday, 2:00 PM · added to Google Calendar
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function LiveDemo() {
  return (
    <section
      id="demo"
      className="relative scroll-mt-24 px-[1.6em] py-[6em] md:py-[8em]"
    >
      <div className="relative mx-auto grid max-w-[76em] grid-cols-1 items-center gap-[3em] md:grid-cols-2 md:gap-[4.5em]">
        <Reveal className="flex flex-col items-start">
          <span className="inline-flex items-center gap-[0.55em] rounded-full border border-[var(--cover-brand-lit)]/25 bg-[var(--cover-brand-lit)]/10 px-[1.15em] py-[0.5em] text-[0.72em] font-semibold uppercase leading-none tracking-[0.18em] text-[var(--cover-brand-lit)]">
            <PhoneCall className="size-[1.25em] shrink-0" strokeWidth={2} />
            See it in action
          </span>

          <h2 className="mt-[1em] max-w-[11em] text-balance text-[2.2em] font-medium leading-[1.06] tracking-[-0.04em] md:text-[2.7em]">
            Watch a call become a booking
          </h2>

          <p className="mt-[1em] max-w-[27em] text-pretty text-[1.02em] leading-[1.65] text-[var(--cover-paper)]/65">
            No menus, no hold music, no forms. Your agent greets the caller,
            understands what they need, checks your calendar, and locks in the
            meeting, all in one natural conversation.
          </p>

          <ul className="mt-[1.8em] flex flex-col gap-[0.85em]">
            <CoverCheck>Greets and qualifies every caller</CoverCheck>
            <CoverCheck>Checks real-time availability</CoverCheck>
            <CoverCheck>Books and confirms on the spot</CoverCheck>
          </ul>
        </Reveal>

        <Reveal delay={0.1}>
          <CallCard />
        </Reveal>
      </div>

      {/* The call itself, playable. The pair above states what happens; this
          lets the reader sit through it at the pace it actually runs. */}
      <div className="relative mx-auto max-w-[76em]">
        <VoiceDemo />
      </div>
    </section>
  );
}
