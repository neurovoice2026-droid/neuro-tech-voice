"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";
import { useLineReveal } from "@/components/site/home/heading";

/* ------------------------------------------------------------------ *
 * The landing heading's line reveal (home/heading.tsx `useLineReveal`)
 * on an element that is not a heading: #credentials' "20+" numeral.
 *
 * The line rises out of its own mask once, the first time the element
 * comes into view, and the split is undone the moment it has played, so
 * the finished element is the server's markup again. It is only ever
 * hidden while it is still below the screen: one already seen (on screen
 * when GSAP arrives, scrolled past, landed on from a #link) stays exactly
 * as the server drew it, and with reduced motion, or on the lite and
 * still tiers, nothing is split at all.
 *
 * NOT A COUNT-UP. The figure is never animated through false interim
 * values; the whole line rises, already reading its one true number.
 *
 * A client island of its own so the section around it (credentials.tsx)
 * stays a server component and ships nothing else.
 * ------------------------------------------------------------------ */

export function LineReveal({
  as: Tag = "p",
  className,
  style,
  children,
}: {
  /** A block element: SplitText cuts lines out of the box it is given. */
  as?: "p" | "div";
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  // Typed as the paragraph, the default; a div shares every member the reveal touches.
  const ref = useRef<HTMLParagraphElement>(null);
  useLineReveal(ref);
  return (
    <Tag ref={ref} className={className} style={style}>
      {children}
    </Tag>
  );
}
