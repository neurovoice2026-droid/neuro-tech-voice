"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { COMPANY, SITE_HEADER } from "@/lib/site";
import { IntentLink } from "../intent-link";
import { primeDock, subscribeDock } from "@/lib/header-dock";
import { MegaMenu } from "./mega-menu";
import { MobileSheet } from "./mobile-sheet";

/* ------------------------------------------------------------------ *
 * The site header.
 *
 * One page-level element, rendered outside the hero's transformed content
 * layer — a transformed ancestor becomes the containing block for `fixed`
 * descendants, which is the same trap the cover's old menu had to portal
 * around.
 *
 * At the top of the page this is not a bar over the cover, it is the
 * cover's masthead: the frame's content box is the hero content layer's
 * content box, so the wordmark sits on the headline grid's left rule and
 * the actions land on the column where the equalizer is. Past 64px it
 * peels off into a pill. All of that is CSS keyed off an attribute on
 * <html> — see lib/header-dock.ts for why none of it is React state.
 * ------------------------------------------------------------------ */

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function SiteHeader({
  tone = "cover",
}: {
  /**
   * `cover` is the homepage's masthead, printed on the dark cover. `light`
   * is the same header on the light product pages: black type, and white
   * glass once it peels off. The menus and the sheet do not change.
   */
  tone?: "cover" | "light";
} = {}) {
  const frameRef = useRef<HTMLDivElement>(null);

  // Before paint, so a soft navigation from /login arrives in the right
  // state rather than correcting after its first frame.
  useIsoLayoutEffect(() => {
    primeDock();
  }, []);

  // Nothing here renders off the phase: the morph is CSS keyed off the
  // attribute, and the opening beat is a CSS animation gated on another.
  // This only owns the store's lifetime — the listeners come up with the
  // header and go down with it.
  useEffect(() => subscribeDock(() => {}), []);

  return (
    <header
      data-site-header
      data-cursor-cta="off"
      // `container-type` so `100cqw` is the width without the scrollbar,
      // which `100vw` gets wrong on Windows. The cost is that nothing may
      // be portalled in here — see the menu and the sheet.
      className={`cover hdr-type ${tone === "light" ? "hdr-light" : ""} pointer-events-none fixed inset-x-0 top-0 z-50 text-[var(--cover-paper)] [container-type:inline-size]`}
    >
      <a href="#content" className="hdr-skip">
        {SITE_HEADER.skip}
      </a>

      <div ref={frameRef} className="hdr-frame">
        <div aria-hidden className="hdr-shadow" />
        <div aria-hidden className="hdr-plate">
          <div className="hdr-crease" />
        </div>
        <div aria-hidden className="hdr-rim" />

        <div className="hdr-row">
          <div
            style={{ "--i": 0 } as React.CSSProperties}
            className="hdr-enter hdr-brand justify-self-start"
          >
            <IntentLink
              href="/#top"
              className="hdr-wordmark text-[1.15em] font-medium leading-none tracking-[-0.07em]"
            >
              {COMPANY.wordmark}
              {/* The name read aloud starts with the one on screen. */}
              <span className="sr-only"> — {COMPANY.name}</span>
            </IntentLink>
          </div>

          <div
            style={{ "--i": 1 } as React.CSSProperties}
            className="hdr-enter justify-self-center"
          >
            <MegaMenu frameRef={frameRef} />
          </div>

          <div
            style={{ "--i": 3 } as React.CSSProperties}
            className="hdr-enter hdr-actions flex items-center gap-[0.35em] justify-self-end"
          >
            <IntentLink
              href={SITE_HEADER.signin.href}
              className="hidden h-[2.5em] items-center rounded-[0.5em] px-[1em] text-[0.875em] font-medium text-[var(--cover-paper)]/85 transition-colors hover:bg-[var(--cover-paper)]/[0.08] hover:text-[var(--cover-paper)] md:inline-flex"
            >
              {SITE_HEADER.signin.label}
            </IntentLink>

            <IntentLink
              href={SITE_HEADER.signup.href}
              // The same inversion the cover's own button and the cursor
              // chip use, so the primary action reads as one thing in
              // three places.
              className="hdr-startfree group inline-flex h-[2.25em] items-center gap-[0.4em] rounded-[0.5em] bg-[var(--cover-paper)] px-[1.125em] text-[0.875em] font-medium text-[var(--cover-ink)] transition-colors duration-300 hover:bg-[var(--cover-brand)] hover:text-[var(--cover-paper)] active:scale-[0.97] lg:h-[2.5em]"
            >
              {SITE_HEADER.signup.label}
              <span
                aria-hidden
                className="transition-transform duration-300 group-hover:translate-x-[0.2em]"
              >
                →
              </span>
            </IntentLink>

            <MobileSheet />
          </div>
        </div>
      </div>
    </header>
  );
}
