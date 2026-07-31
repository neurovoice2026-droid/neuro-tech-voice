"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";
import { CornerDot } from "./ui";

/**
 * The cover's primary action, carried by the pointer.
 *
 * On the cover the button is not a place you travel to — the whole frame is
 * the button, and the pointer is what says so. The native cursor is hidden
 * while it is over the cover and the CTA rides in its place, so the action
 * is wherever the visitor is already looking. Clicking anywhere on the cover
 * takes it.
 *
 * The static button in the corner is not replaced, it is the same control in
 * its other state: it shows whenever this one is not armed, which covers
 * touch, keyboard, and a pointer parked outside the cover.
 *
 * Armed only under `(hover: hover) and (pointer: fine)`. A touch device has
 * no cursor to transform and no hover to preview with, so hiding its only
 * visible CTA behind a tap would cost the conversion the cover exists for.
 */

const FINE_POINTER = "(hover: hover) and (pointer: fine)";

/** Elements that own their own cursor and their own click. */
const INTERACTIVE = "a,button,[role='button'],input,textarea,select,summary";

/** Kept off the pointer so the chip labels the cursor rather than buries it. */
const OFFSET = 16;

type Props = {
  targetRef: React.RefObject<HTMLElement | null>;
  href: string;
  label: string;
  /** Lets the cover hide its static button while the pointer carries it. */
  onArmedChange?: (armed: boolean) => void;
};

export function CursorCta({ targetRef, href, label, onArmedChange }: Props) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [armed, setArmed] = useState(false);
  const [flip, setFlip] = useState(false);
  const chipRef = useRef<HTMLDivElement>(null);
  const point = useRef({ x: 0, y: 0 });

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  // Enough lag to read as weight, not enough to feel disconnected from the
  // hand. Reduced motion pins the chip to the pointer instead.
  const x = useSpring(rawX, { stiffness: 850, damping: 55, mass: 0.32 });
  const y = useSpring(rawY, { stiffness: 850, damping: 55, mass: 0.32 });

  /** Should the pointer be carrying the CTA at its current position? */
  const evaluate = useCallback(() => {
    const el = targetRef.current;
    if (!el) return false;

    const { x: px, y: py } = point.current;
    const r = el.getBoundingClientRect();
    if (px < r.left || px > r.right || py < r.top || py > r.bottom) return false;

    // A quick-nav link under the pointer wins: it gets its own cursor back
    // and its own destination, rather than being overruled by the cover.
    return !document.elementFromPoint(px, py)?.closest(INTERACTIVE);
  }, [targetRef]);

  useEffect(() => {
    onArmedChange?.(armed);
  }, [armed, onArmedChange]);

  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;
    if (!window.matchMedia(FINE_POINTER).matches) return;

    const sync = () => {
      setArmed(evaluate());
      // Near the right edge the chip would run off the viewport, so it
      // swaps to the other side of the pointer.
      const w = chipRef.current?.offsetWidth ?? 0;
      setFlip(point.current.x + OFFSET * 2 + w > window.innerWidth);
    };

    /** Drop the chip at the pointer rather than sweeping it across the page. */
    const place = (e: PointerEvent) => {
      point.current = { x: e.clientX, y: e.clientY };
      rawX.set(e.clientX);
      rawY.set(e.clientY);
      x.jump(e.clientX);
      y.jump(e.clientY);
    };

    const onEnter = (e: PointerEvent) => {
      place(e);
      sync();
    };

    const onMove = (e: PointerEvent) => {
      point.current = { x: e.clientX, y: e.clientY };
      rawX.set(e.clientX);
      rawY.set(e.clientY);
      sync();
    };

    const onLeave = () => setArmed(false);

    const onClick = (e: MouseEvent) => {
      // Only the bare cover navigates; a real link inside it keeps its own.
      if (!evaluate()) return;
      e.preventDefault();
      router.push(href);
    };

    // Scrolling moves the cover out from under a stationary pointer, and
    // that fires no pointer event of its own.
    const onScroll = () => sync();

    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("click", onClick);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("blur", onLeave);

    return () => {
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("click", onClick);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("blur", onLeave);
    };
  }, [evaluate, href, rawX, rawY, router, targetRef, x, y]);

  return (
    <AnimatePresence>
      {armed && (
        <motion.div
          ref={chipRef}
          aria-hidden
          initial={{ opacity: 0, scale: 0.82 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.82 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          style={{ x: reduce ? rawX : x, y: reduce ? rawY : y }}
          className="pointer-events-none fixed left-0 top-0 z-[60] will-change-transform"
        >
          {/* The pointer's own translate lives on the parent, so the offset
              that keeps the chip clear of the cursor gets its own box. */}
          <div
            style={{
              transform: `translate(${flip ? `calc(-100% - ${OFFSET}px)` : `${OFFSET}px`}, ${OFFSET}px)`,
            }}
          >
            <span className="inline-grid select-none text-[1.05em] leading-[1.2] tracking-[-0.04em]">
              <span className="col-start-1 row-start-1 grid grid-cols-2 grid-rows-2 rounded-[0.2em] bg-[var(--cover-paper)] p-[0.33em] text-[var(--cover-ink)] shadow-[0_0.8em_2em_-0.6em_rgba(0,0,0,0.75)]">
                <CornerDot className="size-[0.3em] justify-self-start" />
                <CornerDot className="size-[0.3em] justify-self-end" />
                <CornerDot className="size-[0.3em] self-end justify-self-start" />
                <CornerDot className="size-[0.3em] self-end justify-self-end" />
              </span>
              <span className="col-start-1 row-start-1 z-10 flex items-center gap-[0.45em] whitespace-nowrap px-[1em] py-[0.8em] text-[var(--cover-ink)]">
                {label}
                <span>→</span>
              </span>
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
