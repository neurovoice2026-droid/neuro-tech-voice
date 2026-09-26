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
import { CornerDot } from "./corner-dot";

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
  /** `armed`, readable from a listener without re-subscribing it. */
  const live = useRef(false);
  // Null whenever the pointer's position is unknown — it left the document,
  // or it has never been here. A stale coordinate is worse than none: the
  // scroll re-evaluation would arm the chip somewhere nobody is pointing.
  const point = useRef<{ x: number; y: number } | null>(null);

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

    const p = point.current;
    if (!p) return false;

    // While a menu or the sheet is open, the click that dismisses it must
    // dismiss it — not land on the cover and navigate to /register.
    if (document.documentElement.hasAttribute("data-nav-hold")) return false;

    const r = el.getBoundingClientRect();
    if (p.x < r.left || p.x > r.right || p.y < r.top || p.y > r.bottom) {
      return false;
    }

    const hit = document.elementFromPoint(p.x, p.y);
    if (!hit) return false;

    // The header floats over the cover without being part of it, and so
    // will anything else that ever does — a panel, the sheet, a toast.
    // Testing containment rather than naming them fixes the class of bug:
    // whatever is on top owns the pointer, and only the cover's own
    // pixels arm the chip.
    if (!el.contains(hit)) return false;
    if (hit.closest('[data-cursor-cta="off"]')) return false;

    // A link under the pointer wins: it gets its own cursor back and its
    // own destination, rather than being overruled by the cover.
    return !hit.closest(INTERACTIVE);
  }, [targetRef]);

  useEffect(() => {
    onArmedChange?.(armed);
  }, [armed, onArmedChange]);

  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;
    if (!window.matchMedia(FINE_POINTER).matches) return;

    /**
     * The expensive half — a hit test and a layout read — so it runs at
     * most once a frame, however fast the mouse reports.
     */
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        sync();
      });
    };

    const sync = () => {
      const next = evaluate();
      // The chip arrives at the pointer, not at wherever it was last
      // seen: while it is down the springs are not being fed.
      if (next && !live.current) {
        const p = point.current;
        if (p) {
          rawX.set(p.x);
          rawY.set(p.y);
          x.jump(p.x);
          y.jump(p.y);
        }
      }
      live.current = next;
      setArmed(next);
      // Near the right edge the chip would run off the viewport, so it
      // swaps to the other side of the pointer.
      const w = chipRef.current?.offsetWidth ?? 0;
      const px = point.current?.x ?? 0;
      setFlip(px + OFFSET * 2 + w > window.innerWidth);
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

    // Tracked at the window rather than on the cover: a pointer moving
    // across the header is still moving, and the cover would never hear
    // about it.
    const onMove = (e: PointerEvent) => {
      point.current = { x: e.clientX, y: e.clientY };
      // Only while the chip is up: two springs animating for something
      // nobody can see is two springs animating on every mouse move
      // anywhere on the site, including across the header's own menus.
      if (live.current) {
        rawX.set(e.clientX);
        rawY.set(e.clientY);
      }
      schedule();
    };

    const onLeave = () => {
      point.current = null;
      live.current = false;
      setArmed(false);
    };

    const onBlur = () => {
      live.current = false;
      setArmed(false);
    };

    const onClick = (e: MouseEvent) => {
      // Only the bare cover navigates; a real link inside it keeps its own.
      if (!evaluate()) return;
      e.preventDefault();
      router.push(href);
    };

    // Scrolling moves the cover out from under a stationary pointer, and
    // that fires no pointer event of its own.
    const onScroll = () => {
      if (!point.current) return;
      schedule();
    };

    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("click", onClick);
    window.addEventListener("pointermove", onMove);
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("blur", onBlur);

    return () => {
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("click", onClick);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("blur", onBlur);
      cancelAnimationFrame(frame);
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
