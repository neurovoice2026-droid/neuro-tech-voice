"use client";

import { useEffect, useState, useSyncExternalStore, type RefObject } from "react";

/**
 * How long a line stays the newest one before the next arrives: long
 * enough to read at a comfortable 230 words a minute, never under 1.4s.
 */
export function holdFor(text: string) {
  const words = text.trim().split(/\s+/).length;
  return Math.max(1400, words * 260 + 500);
}

/** True while any part of the element is on screen. Starts false on the server. */
export function useInView(ref: RefObject<Element | null>, margin = "0px") {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      rootMargin: margin,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, margin]);
  return inView;
}

const REDUCE = "(prefers-reduced-motion: reduce)";

function subscribeReduce(onChange: () => void) {
  const mq = window.matchMedia(REDUCE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** False on the server and on the first client render, so hydration matches. */
export function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReduce,
    () => window.matchMedia(REDUCE).matches,
    () => false,
  );
}
