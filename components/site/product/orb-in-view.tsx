"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/* ------------------------------------------------------------------ *
 * An orb that rests while nobody can see it.
 *
 * A mesh orb is two infinite CSS animations under a blur, and an infinite
 * animation costs a style recalculation every frame whether it is on
 * screen or not: a product page with nine orbs down its length was paying
 * for eighteen of them from the footer. So each orb is watched, and while
 * it is off screen it carries `data-away`, which the stylesheet answers by
 * taking its animations off altogether (`.pp-orb[data-away]`). Paused,
 * they would still keep the orb's four or five composited layers; off,
 * the orb is plain paint until it comes near again. Each animation starts
 * from the picture the orb rests in, so it picks up without a jump, and
 * the margin starts it before the orb reaches the screen.
 *
 * It renders as moving until it has been measured (the server and the
 * hydrating render cannot know). A caller's own `still` is left as it
 * is: that orb is paused where it stands, on screen or off.
 * ------------------------------------------------------------------ */

/** Starts just before the orb reaches the screen, so it is already moving when it arrives. */
const MARGIN = "12% 0px";

type Watch = (seen: boolean) => void;

let shared: IntersectionObserver | null = null;
const watchers = new WeakMap<Element, Watch>();

/** One observer for every orb on the page, rather than one each. */
function observe(el: Element, fn: Watch) {
  shared ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries) watchers.get(e.target)?.(e.isIntersecting);
    },
    { rootMargin: MARGIN },
  );
  watchers.set(el, fn);
  shared.observe(el);
  return () => {
    watchers.delete(el);
    shared?.unobserve(el);
  };
}

export function OrbInView({
  still,
  speaking,
  className,
  style,
  children,
}: {
  still: boolean;
  speaking: boolean;
  className: string;
  style: CSSProperties;
  children: ReactNode;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [away, setAway] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    return observe(el, (seen) => setAway(!seen));
  }, []);

  return (
    <span
      ref={ref}
      aria-hidden
      data-speaking={speaking ? "" : undefined}
      data-still={still ? "" : undefined}
      data-away={away && !still ? "" : undefined}
      className={className}
      style={style}
    >
      {children}
    </span>
  );
}
