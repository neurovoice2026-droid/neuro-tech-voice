"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

/**
 * A `Link` that prefetches on intent rather than on sight.
 *
 * By default a link prefetches its route the moment it scrolls into view,
 * and the sign-up and sign-in routes carry the whole form stack with them —
 * a third of a megabyte a visitor reading the page never asked for. This
 * one waits for a pointer over it, a touch or keyboard focus, which still
 * leaves the route ready well before the click lands.
 */
export function IntentLink({
  onPointerEnter,
  onTouchStart,
  onFocus,
  ...props
}: Omit<ComponentProps<typeof Link>, "prefetch">) {
  const [intent, setIntent] = useState(false);

  return (
    <Link
      {...props}
      prefetch={intent ? null : false}
      onPointerEnter={(e) => {
        setIntent(true);
        onPointerEnter?.(e);
      }}
      onTouchStart={(e) => {
        setIntent(true);
        onTouchStart?.(e);
      }}
      onFocus={(e) => {
        setIntent(true);
        onFocus?.(e);
      }}
    />
  );
}
