"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  NavigationMenu,
  type NavigationMenuRoot,
} from "@base-ui/react/navigation-menu";
import { ChevronDown } from "lucide-react";
import { HEADER_NAV, SITE_HEADER } from "@/lib/site";
import { holdDock, onDockFlip, releaseDock } from "@/lib/header-dock";
import { focusHashTarget } from "./parts";
import { ProductPanel } from "./product-panel";
import { SolutionsPanel } from "./solutions-panel";

/* ------------------------------------------------------------------ *
 * The desktop nav, and the two panels that hang off it.
 *
 * Base UI owns every hard part here — the diagonal corridor between a
 * trigger and its panel, instant panel-to-panel switching once mounted,
 * suppressing hover opens on touch, the patient-click window that stops
 * a click closing what a hover just opened, composite keyboard handling,
 * focus guards around the portalled panel, and `aria-expanded` kept
 * honest for hover opens as well as clicks.
 *
 * Three things are ours: the panel hangs off the *pill* rather than off
 * the trigger, typing in the industry field survives a pointer drifting
 * away, and a phase flip closes the menu before the bar morphs under it.
 * ------------------------------------------------------------------ */

/** How far the page may scroll under a pointer-opened panel before it goes. */
const SCROLL_CLOSE_PX = 48;

export function MegaMenu({
  frameRef,
}: {
  frameRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [menu, setMenu] = useState<string | null>(null);
  const positionerRef = useRef<HTMLDivElement>(null);
  /** True while the industry field has focus or content. */
  const pinned = useRef(false);
  const pointerOpened = useRef(false);
  // Drives what the Product panel does on open, so it is state rather
  // than a ref: a menu opened from the keyboard must not start playing
  // itself under someone who is reading it.
  const [openedByKeyboard, setOpenedByKeyboard] = useState(false);

  // A panel is anchored to the frame, so the frame must not morph while
  // one is open: the header holds the phase for as long as the menu is up.
  useEffect(() => {
    if (!menu) return;
    holdDock();
    return () => releaseDock();
  }, [menu]);

  // Belt and braces for the case the hold cannot cover — a flip from
  // anywhere else closes the menu before the bar moves.
  useEffect(() => onDockFlip(() => setMenu(null)), []);

  useEffect(() => {
    const close = () => setMenu(null);
    const mq = window.matchMedia("(min-width: 64rem)");
    const onBreakpoint = () => {
      if (!mq.matches) setMenu(null);
    };
    window.addEventListener("hashchange", close);
    window.addEventListener("popstate", close);
    mq.addEventListener("change", onBreakpoint);
    return () => {
      window.removeEventListener("hashchange", close);
      window.removeEventListener("popstate", close);
      mq.removeEventListener("change", onBreakpoint);
    };
  }, []);

  // A panel opened by pointer is incidental and should not ride the page
  // down. One opened by keyboard is being read, so it stays.
  useEffect(() => {
    if (!menu || !pointerOpened.current) return;
    const from = window.scrollY;
    const onScroll = () => {
      if (Math.abs(window.scrollY - from) < SCROLL_CLOSE_PX) return;
      if (positionerRef.current?.contains(document.activeElement)) return;
      setMenu(null);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [menu]);

  const handleValueChange = (
    next: string | null,
    details: NavigationMenuRoot.ChangeEventDetails,
  ) => {
    // Typing is a commitment; a pointer drifting off the panel is not.
    // Every other way out — Escape, an outside press, focus leaving, a
    // link — still closes, so the escape hatch is never removed.
    if (next === null && pinned.current && details.reason === "trigger-hover") {
      details.cancel();
      return;
    }

    if (next === null) {
      pinned.current = false;
    } else {
      // Enter and Space on a focused trigger arrive as a *click* with a
      // detail of 0, not as a KeyboardEvent — so checking only for the
      // latter let the preview play itself under the one visitor who
      // cannot glance past it.
      const byKeyboard =
        details.reason === "list-navigation" ||
        (details.reason === "trigger-press" &&
          (details.event instanceof KeyboardEvent ||
            (details.event instanceof MouseEvent && details.event.detail === 0)));
      setOpenedByKeyboard(byKeyboard);
      pointerOpened.current = !byKeyboard;
    }

    setMenu(next);
  };

  return (
    <NavigationMenu.Root
      value={menu}
      onValueChange={handleValueChange}
      // 80ms rather than 0: a panel that fires instantly fires at anyone
      // sweeping the bar toward Start free.
      delay={80}
      closeDelay={160}
      aria-label={SITE_HEADER.navLabel}
      className="hidden lg:block"
    >
      <NavigationMenu.List className="hdr-navlist flex list-none items-center gap-[0.1em]">
        {HEADER_NAV.map((entry) =>
          entry.kind === "menu" ? (
            <NavigationMenu.Item key={entry.id} value={entry.id}>
              <NavigationMenu.Trigger className="hdr-trigger">
                {entry.label}
                <NavigationMenu.Icon className="hdr-chev">
                  <ChevronDown
                    className="size-[0.85em]"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                </NavigationMenu.Icon>
              </NavigationMenu.Trigger>
              <NavigationMenu.Content
                className="hdr-menu-content"
                role="group"
                aria-label={entry.label}
              >
                {entry.id === "product" ? (
                  <ProductPanel
                    autoplay={!openedByKeyboard}
                    // The typing exception, wired: the panel tells us when
                    // its field is holding something worth protecting.
                    onPinnedChange={(next) => {
                      pinned.current = next;
                    }}
                  />
                ) : (
                  <SolutionsPanel />
                )}
              </NavigationMenu.Content>
            </NavigationMenu.Item>
          ) : (
            <NavigationMenu.Item key={entry.id}>
              <NavigationMenu.Link
                className="hdr-navlink"
                render={<Link href={entry.href} prefetch={false} />}
                onClick={() => {
                  if (entry.href.includes("#")) focusHashTarget(entry.href);
                }}
              >
                {entry.label}
              </NavigationMenu.Link>
            </NavigationMenu.Item>
          ),
        )}
      </NavigationMenu.List>

      {/* To <body>, never into the header: the header is an inline-size
          container, which makes it a containing block for fixed
          descendants and would trap the panel inside the bar. */}
      <NavigationMenu.Portal>
        <NavigationMenu.Positioner
          ref={positionerRef}
          // The pill, centred — the one box whose horizontal position is
          // the same for both menus and in both header states, so the
          // morph never slides sideways.
          anchor={frameRef}
          positionMethod="fixed"
          side="bottom"
          align="center"
          sideOffset={10}
          collisionPadding={16}
          // Required: the default would flip a tall panel above a header
          // that is already at the top of the viewport.
          collisionAvoidance={{ side: "none", align: "shift" }}
          data-site-header
          data-cursor-cta="off"
          className="cover hdr-type z-[55] transition-[top,left] duration-[320ms] ease-[cubic-bezier(0.45,0.05,0.25,1)] data-[instant]:transition-none"
        >
          {/* A div, not the default nav: the Root is already a navigation
              landmark and a second, unnamed one is a real defect. */}
          <NavigationMenu.Popup
            render={<div />}
            className="hdr-menu-popup relative text-[var(--cover-paper)]"
          >
            <span
              aria-hidden
              className="hdr-menu-wipe absolute inset-x-0 top-0 z-10 h-px bg-[var(--cover-paper)]/25"
            />
            <NavigationMenu.Viewport className="hdr-menu-viewport" />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Root>
  );
}
