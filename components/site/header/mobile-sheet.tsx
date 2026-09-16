"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Accordion } from "@base-ui/react/accordion";
import { ArrowRight, Plus } from "lucide-react";
import {
  HEADER_NAV,
  NAV_ANY_INDUSTRY,
  NAV_INDUSTRIES,
  NAV_INDUSTRY_DEFAULT,
  PRODUCT_GROUPS,
  PRODUCT_MENU,
  SITE_HEADER,
  SOLUTIONS_MENU,
  SOLUTION_ITEMS,
  COMPANY,
  customIndustry,
} from "@/lib/site";
import { holdDock, releaseDock } from "@/lib/header-dock";
import { cn } from "@/lib/utils";
import { CallPane, focusHashTarget, type PaneModel } from "./parts";
import { IndustryPicker } from "./industry-picker";

/* ------------------------------------------------------------------ *
 * Below lg: the same bar, the same peel, and everything else behind a
 * toggle.
 *
 * The sheet is a modal dialog, so it brings its own top row — the bar's
 * toggle is inert behind a focus trap. That row reuses the header's own
 * frame and grid classes and the phase attribute lives on <html>, so the
 * Close button lands exactly where the Menu toggle was and the bar never
 * appears to move.
 * ------------------------------------------------------------------ */

export function MobileSheet() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState(NAV_INDUSTRY_DEFAULT);
  const [draft, setDraft] = useState("");
  const pending = useRef<string | null>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  /**
   * Opening forces the peel: the header lifts off the cover as the sheet
   * drops out of it. The hold is not cosmetic either — Base UI's scroll
   * lock moves the page offset onto <body>, which makes `window.scrollY`
   * read 0 and would otherwise re-dock the bar behind the open sheet.
   */
  useEffect(() => {
    if (!open) return;
    holdDock({ lift: true });
    return () => releaseDock();
  }, [open]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 64rem)");
    const onChange = () => {
      if (mq.matches) setOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const industry = NAV_INDUSTRIES.find((i) => i.slug === slug) ?? NAV_INDUSTRIES[0];
  const typed = draft.trim();
  const custom = typed.length >= 2 ? customIndustry(typed) : null;

  const model: PaneModel = custom
    ? {
        kind: "call",
        key: "custom",
        context: PRODUCT_MENU.liveKicker(typed),
        turns: [
          { who: "client", text: custom.caller },
          { who: "agent", text: custom.agent },
        ],
        outcome: custom.outcome,
      }
    : {
        kind: "call",
        key: industry.slug,
        context: PRODUCT_MENU.liveKicker(industry.label),
        turns: [
          { who: "client", text: industry.caller },
          { who: "agent", text: industry.agent },
        ],
        outcome: industry.outcome,
      };

  const industryHref = custom
    ? `/industries?trade=${encodeURIComponent(typed)}`
    : `/industries/${industry.slug}`;
  const industryLabel = custom ? typed : industry.label;

  /**
   * A hash link cannot navigate while the scroll lock is up: the lock's
   * cleanup restores the old offset and undoes the jump. So the sheet
   * closes first and navigates once it has.
   */
  const onHashLink =
    (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (!href.includes("#")) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) {
        return;
      }
      event.preventDefault();
      pending.current = href;
      setOpen(false);
    };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={setOpen}
      onOpenChangeComplete={(isOpen) => {
        if (isOpen || !pending.current) return;
        const href = pending.current;
        pending.current = null;
        router.push(href);
        focusHashTarget(href);
      }}
    >
      <Dialog.Trigger
        ref={toggleRef}
        className="flex size-[max(2.75em,44px)] items-center justify-center gap-[0.5em] rounded-[0.5em] text-[0.95em] leading-none tracking-[-0.03em] sm:w-auto sm:px-[0.75em] lg:hidden"
      >
        <span aria-hidden className="flex flex-col gap-[0.22em]">
          <span className="block h-px w-[1.35em] bg-current" />
          <span className="block h-px w-[1.35em] bg-current" />
        </span>
        <span className="hidden sm:inline">{SITE_HEADER.menu.open}</span>
        <span className="sr-only sm:hidden">{SITE_HEADER.menu.open}</span>
      </Dialog.Trigger>

      {/* To <body>: the header is a container with layout containment, and
          a fixed child of it would size to the bar instead of the screen. */}
      <Dialog.Portal>
        <Dialog.Popup
          finalFocus={toggleRef}
          data-site-header
          data-cursor-cta="off"
          className="hdr-sheet cover hdr-type fixed inset-0 z-[70] flex flex-col bg-[rgb(6_4_10_/_0.97)] text-[var(--cover-paper)] supports-[backdrop-filter:blur(1px)]:bg-[rgb(6_4_10_/_0.9)] supports-[backdrop-filter:blur(1px)]:backdrop-blur-[24px] [container-type:inline-size] lg:hidden"
        >
          <Dialog.Title className="sr-only">{SITE_HEADER.menu.open}</Dialog.Title>

          <div className="hdr-frame shrink-0">
            <div className="hdr-row">
              <span className="hdr-brand justify-self-start">
                <span className="hdr-wordmark text-[1.15em] font-medium leading-none tracking-[-0.07em]">
                  {COMPANY.wordmark}
                </span>
              </span>
              <span />
              <div className="hdr-actions justify-self-end">
                <Dialog.Close className="flex size-[max(2.75em,44px)] items-center justify-center gap-[0.5em] rounded-[0.5em] text-[0.95em] leading-none tracking-[-0.03em] sm:w-auto sm:px-[0.75em]">
                  <span aria-hidden className="relative block size-[1.35em]">
                    <span className="absolute inset-x-0 top-1/2 block h-px bg-current transition-transform duration-200 ease-[cubic-bezier(0.45,0.05,0.25,1)] rotate-45" />
                    <span className="absolute inset-x-0 top-1/2 block h-px bg-current transition-transform duration-200 ease-[cubic-bezier(0.45,0.05,0.25,1)] -rotate-45" />
                  </span>
                  <span className="hidden sm:inline">{SITE_HEADER.menu.close}</span>
                  <span className="sr-only sm:hidden">{SITE_HEADER.menu.close}</span>
                </Dialog.Close>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain px-[1.5em] pt-[1.5em]">
            <Accordion.Root className="flex flex-col">
              <AccordionRow index={0} value="product" label="Product">
                <div className="pb-[1.5em]">
                  {PRODUCT_GROUPS.map((group) => (
                    <div key={group.id} className="mb-[1em]">
                      <p className="mb-[0.35em] text-[0.75em] uppercase tracking-[0.12em] text-[var(--cover-paper)]/50">
                        {group.label}
                      </p>
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.id}
                            href={item.href}
                            prefetch={false}
                            onClick={() => setOpen(false)}
                            className="flex min-h-[44px] items-start gap-[0.7em] py-[0.5em]"
                          >
                            <Icon
                              className="mt-[0.15em] size-[1.125em] shrink-0 text-[var(--cover-paper)]/60"
                              strokeWidth={1.75}
                              aria-hidden
                            />
                            <span>
                              <span className="block text-[1.0625em] font-medium leading-[1.25]">
                                {item.label}
                              </span>
                              <span className="block text-[0.8125em] leading-[1.35] text-[var(--cover-paper)]/55">
                                {item.description}
                              </span>
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  ))}

                  <p className="mb-[0.5em] flex items-baseline justify-between gap-[1em] text-[0.75em] uppercase tracking-[0.12em] text-[var(--cover-paper)]/50">
                    {SITE_HEADER.headings.industries}
                    {/* The same promise the desktop panel makes, rather
                        than the link's own words said twice. */}
                    <span className="normal-case tracking-normal text-[var(--cover-paper)]/60">
                      {NAV_ANY_INDUSTRY.note}
                    </span>
                  </p>

                  {/* Tapping a chip selects it; the card's own link is what
                      navigates. On a phone there is no hover to preview
                      with, so choosing and going have to be two acts. */}
                  <IndustryPicker
                    variant="strip"
                    selected={slug}
                    onSelect={setSlug}
                    draft={draft}
                    onDraft={setDraft}
                  />

                  {/* In the sheet the pane may grow: nothing measures it
                      here the way the popup does, and three clamped lines
                      of dialogue no longer fit a fixed 13.5em on a phone. */}
                  <CallPane model={model} className="mt-[0.75em] h-auto min-h-[13.5em]" />

                  <Link
                    href={industryHref}
                    prefetch={false}
                    onClick={() => setOpen(false)}
                    className="group mt-[0.6em] flex min-h-[44px] items-center gap-[0.45em] text-[0.9375em] font-medium"
                  >
                    {PRODUCT_MENU.seeItFor(industryLabel)}
                    <ArrowRight
                      className="size-[1em] transition-transform group-hover:translate-x-[0.2em]"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                  </Link>
                </div>
              </AccordionRow>

              <AccordionRow index={1} value="solutions" label="Solutions">
                <div className="pb-[1.5em]">
                  {SOLUTION_ITEMS.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        prefetch={false}
                        onClick={() => setOpen(false)}
                        className="flex min-h-[44px] items-start gap-[0.7em] py-[0.5em]"
                      >
                        <Icon
                          className="mt-[0.15em] size-[1.125em] shrink-0 text-[var(--cover-paper)]/60"
                          strokeWidth={1.75}
                          aria-hidden
                        />
                        <span>
                          <span className="block text-[1.0625em] font-medium leading-[1.25]">
                            {item.label}
                          </span>
                          <span className="block text-[0.8125em] leading-[1.35] text-[var(--cover-paper)]/55">
                            {item.description}
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                  <Link
                    href={SOLUTIONS_MENU.footer.link.href}
                    prefetch={false}
                    onClick={() => setOpen(false)}
                    className="group mt-[0.5em] flex min-h-[44px] items-center gap-[0.45em] text-[0.9375em] font-medium"
                  >
                    {SOLUTIONS_MENU.cta.label}
                    <ArrowRight
                      className="size-[1em] transition-transform group-hover:translate-x-[0.2em]"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                  </Link>
                </div>
              </AccordionRow>
            </Accordion.Root>

            {HEADER_NAV.filter((entry) => entry.kind === "link").map((entry, i) => (
              <Link
                key={entry.id}
                href={entry.href}
                prefetch={false}
                onClick={(event) => {
                  onHashLink(entry.href)(event);
                  if (!entry.href.includes("#")) setOpen(false);
                }}
                style={{ "--i": i + 2 } as React.CSSProperties}
                className="hdr-sheet-row flex min-h-[max(3.5em,52px)] items-center border-b border-[var(--cover-paper)]/10 text-[1.5em] leading-[1.15] tracking-[-0.04em]"
              >
                {entry.label}
              </Link>
            ))}

            <div className="h-[2em]" />
          </div>

          <div
            style={{ "--i": 5 } as React.CSSProperties}
            className="hdr-sheet-row sticky bottom-0 grid grid-cols-1 gap-[0.5em] bg-gradient-to-t from-[rgb(6_4_10)] from-60% to-transparent px-[1.5em] pt-[1em] pb-[calc(1em+env(safe-area-inset-bottom))] sm:grid-cols-2"
          >
            <Link
              href={SITE_HEADER.signin.href}
              onClick={() => setOpen(false)}
              className="flex h-[3.25em] min-h-[48px] items-center justify-center rounded-[0.5em] ring-1 ring-[var(--cover-paper)]/20 text-[0.95em] font-medium"
            >
              {SITE_HEADER.signin.label}
            </Link>
            <Link
              href={SITE_HEADER.signup.href}
              onClick={() => setOpen(false)}
              className="flex h-[3.25em] min-h-[48px] items-center justify-center gap-[0.4em] rounded-[0.5em] bg-[var(--cover-paper)] text-[0.95em] font-medium text-[var(--cover-ink)]"
            >
              {SITE_HEADER.signup.label}
              <span aria-hidden>→</span>
            </Link>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function AccordionRow({
  index,
  value,
  label,
  children,
}: {
  index: number;
  value: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Accordion.Item
      value={value}
      style={{ "--i": index } as React.CSSProperties}
      className={cn("hdr-sheet-row border-b border-[var(--cover-paper)]/10")}
    >
      <Accordion.Header>
        <Accordion.Trigger className="flex w-full min-h-[max(3.5em,52px)] items-center justify-between gap-[1em] text-left text-[1.5em] leading-[1.15] tracking-[-0.04em] [&[data-panel-open]_svg]:rotate-45">
          {label}
          <Plus
            className="size-[0.7em] shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.45,0.05,0.25,1)]"
            strokeWidth={1.5}
            aria-hidden
          />
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Panel className="hdr-acc-panel">{children}</Accordion.Panel>
    </Accordion.Item>
  );
}
