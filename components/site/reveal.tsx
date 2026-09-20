"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useSpring,
  useMotionValue,
  animate,
  type HTMLMotionProps,
} from "framer-motion";
import { cn } from "@/lib/utils";

export const EASE = [0.16, 1, 0.3, 1] as const;

/** Fade + rise into view. The workhorse scroll animation. */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 24,
  once = true,
  as = "div",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  once?: boolean;
  as?: "div" | "span" | "li" | "p" | "h2" | "h3";
} & HTMLMotionProps<"div">) {
  const reduce = useReducedMotion();
  const M = motion[as] as typeof motion.div;

  return (
    <M
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: "-10% 0px -10% 0px" }}
      transition={{ duration: 0.75, delay, ease: EASE }}
      {...rest}
    >
      {children}
    </M>
  );
}

/** Reveal children one after another (used for bullet lists, tiers, etc.). */
export function RevealStagger({
  children,
  className,
  stagger = 0.08,
  once = true,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  once?: boolean;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once, margin: "-8% 0px" }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: stagger } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  y = 18,
}: {
  children: ReactNode;
  className?: string;
  y?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={{
        hidden: reduce ? {} : { opacity: 0, y },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.6, ease: EASE },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Count up to a number once it scrolls into view.
 *
 * `track` exists because the default is an ARRIVAL, not a readout. Without
 * it the animation is seeded from the static `from` prop and re-keyed on
 * `to`, so a figure that changes while the reader is looking at it snaps
 * back to `from` and runs the whole approach again — a price that moves from
 * 240 to 260 drops through zero on its way there, which reads as the number
 * having been wrong rather than having changed. In `track` mode the start is
 * the number currently on screen, so every change is a move from where the
 * eye already is, and `once` is dropped since the figure has to stay live
 * after the first pass.
 *
 * The default path is left exactly as it was: same seed, same deps, same
 * reduced-motion derivation. Only the ref write is new, and it is inert
 * when nothing reads it.
 */
export function CountUp({
  to,
  from = 0,
  duration = 1.4,
  suffix = "",
  prefix = "",
  decimals = 0,
  track = false,
  className,
}: {
  to: number;
  from?: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  /** Re-animate from the value on screen whenever `to` changes. */
  track?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: !track, margin: "-15% 0px" });
  const reduce = useReducedMotion();
  const [val, setVal] = useState(from);
  // The last number actually rendered. A ref and not state: it is read at
  // the top of the next animation, never during a render.
  const shownRef = useRef(from);

  useEffect(() => {
    if (!inView || reduce) return;
    const start = track ? shownRef.current : from;
    const controls = animate(start, to, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        shownRef.current = v;
        setVal(v);
      },
    });
    return () => controls.stop();
  }, [inView, reduce, from, to, duration, track]);

  // Reduced motion gets the destination without the count. Derived here
  // rather than pushed into state from the effect: the value is a pure
  // function of props we already hold, and writing it synchronously inside
  // an effect only buys a second render to arrive at the same number.
  const shown = reduce && inView ? to : val;

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {prefix}
      {shown.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

/** Reveals a heading word-by-word with a clip-mask rise. */
export function WordReveal({
  text,
  className,
  wordClassName,
  delay = 0,
  stagger = 0.05,
  as = "h2",
}: {
  text: string;
  className?: string;
  wordClassName?: string;
  delay?: number;
  stagger?: number;
  as?: "h1" | "h2" | "h3" | "p" | "div";
}) {
  const reduce = useReducedMotion();
  const words = text.split(" ");
  const M = motion[as] as typeof motion.div;

  return (
    <M
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-10% 0px" }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: stagger, delayChildren: delay } },
      }}
    >
      {words.map((w, i) => (
        <span key={i}>
          <motion.span
            className={cn("mr-[0.3em] inline-block", wordClassName)}
            variants={{
              hidden: reduce ? {} : { opacity: 0, y: "0.4em" },
              show: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.6, ease: EASE },
              },
            }}
          >
            {w}
          </motion.span>
        </span>
      ))}
    </M>
  );
}

/**
 * The cover's word-rise, driven by scroll instead of by mount.
 *
 * The hero owns the original as a local `SplitLines`, and this is a
 * deliberate copy of it rather than a shared import. The hero's version is
 * the page's first impression and is frozen: it fires on mount, on a delay
 * ladder tuned against the rest of the opening sequence, and nothing below
 * the fold may acquire the right to change it. Factoring the two together
 * would create exactly that coupling — a prop added for a section halfway
 * down the page landing in the cover. So the geometry is duplicated on
 * purpose and the hero stays the style contract: if the two ever disagree,
 * the hero is right and this follows it.
 *
 * What differs is the trigger, and only the trigger. `whileInView` with a
 * one-shot viewport, because a word that has already risen must not sink
 * back when the reader scrolls past and returns.
 *
 * The mask is padded below the baseline so descenders clear it, then pulled
 * back so line-height is unaffected — the same trick as the hero. The word
 * counter runs across ALL lines rather than restarting per line, so the
 * stagger reads as one continuous sweep down the block instead of several
 * lines each starting over.
 */
export function MaskRise({
  lines,
  delay = 0,
  stagger = 0.045,
  className,
}: {
  lines: readonly string[];
  delay?: number;
  stagger?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  let n = 0;

  return (
    <span className={className}>
      {lines.map((line, li) => (
        <span key={li} className="block">
          {line.split(" ").map((word, wi, arr) => {
            const i = n++;
            return (
              <span
                key={wi}
                className="inline-block -mb-[0.16em] overflow-hidden pb-[0.16em] align-bottom"
              >
                <motion.span
                  className={cn(
                    "inline-block",
                    wi < arr.length - 1 && "pr-[0.24em]",
                  )}
                  initial={reduce ? false : { y: "115%" }}
                  whileInView={{ y: "0%" }}
                  viewport={{ once: true, margin: "-10% 0px" }}
                  transition={{
                    duration: 0.95,
                    delay: delay + i * stagger,
                    ease: EASE,
                  }}
                >
                  {word}
                </motion.span>
              </span>
            );
          })}
        </span>
      ))}
    </span>
  );
}

/** Wraps an element so it drifts toward the cursor — a magnetic pull. */
export function Magnetic({
  children,
  className,
  strength = 0.35,
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 15, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 200, damping: 15, mass: 0.4 });

  const onMove = (e: React.MouseEvent) => {
    if (reduce) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength);
  };
  const reset = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      className={cn("inline-block", className)}
      style={{ x: sx, y: sy }}
      onMouseMove={onMove}
      onMouseLeave={reset}
    >
      {children}
    </motion.div>
  );
}

/** A thin purple progress bar pinned to the top, tracking scroll. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    mass: 0.3,
  });
  return (
    <motion.div
      aria-hidden
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-gradient-to-r from-primary via-primary-soft to-primary"
    />
  );
}
