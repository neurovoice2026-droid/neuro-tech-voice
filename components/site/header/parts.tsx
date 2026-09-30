"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { NavigationMenu } from "@base-ui/react/navigation-menu";
import { SETUP_VOICES, SITE_HEADER, type NavItem } from "@/lib/site";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 * The pieces both mega menus are built out of.
 * ------------------------------------------------------------------ */

/**
 * Moves focus to a hash target after the menu closes.
 *
 * Without it, a keyboard user who picks "Hear the agent take a real call"
 * is handed back to the Product trigger while the page has scrolled three
 * thousand pixels away from it. Base UI's own focus return runs inside its
 * unmount, so this has to land after a frame.
 */
export function focusHashTarget(href: string) {
  const id = href.split("#")[1];
  if (!id) return;
  requestAnimationFrame(() => {
    const el = document.getElementById(id);
    if (!el) return;
    el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
  });
}

type MenuLinkProps = ComponentProps<"a"> & { href: string };

/**
 * A link inside a panel.
 *
 * `prefetch={false}` while the destination routes are still stubs: a mega
 * menu holds twenty-odd links, and prefetching them all on sight would
 * cost a great deal to learn that none of them exist yet.
 */
export function MenuLink({ href, className, children, onClick, ...rest }: MenuLinkProps) {
  return (
    <NavigationMenu.Link
      closeOnClick
      className={className}
      render={<Link href={href} prefetch={false} />}
      onClick={(event) => {
        onClick?.(event);
        if (href.includes("#")) focusHashTarget(href);
      }}
      {...rest}
    >
      {children}
    </NavigationMenu.Link>
  );
}

export function GroupHeading({ id, children }: { id?: string; children: ReactNode }) {
  return (
    // Inset by the 10px a card pads its text by, so a heading sits on the
    // left edge of the words under it rather than of their boxes.
    <p
      id={id}
      className="px-[10px] text-[13px] font-medium leading-[18px] text-[var(--cover-muted)]"
    >
      {children}
    </p>
  );
}

/**
 * A capability or an offer, as a card.
 *
 * The description wraps rather than truncating: an offer cut off at
 * "Agents built on your scripts, data and…" is an offer nobody can read.
 * Nothing in a card changes on hover, so a two-line card cannot make the
 * popup breathe.
 *
 * The card aims for 12px of air above the title's caps and below the
 * description (8px above the first). Untrimmed line boxes carry 5.5px of
 * that at 14/21 and 4.25px at 13/18, so the paddings are set short by
 * those amounts, without relying on `text-box-trim`.
 */
export function ItemCard({
  item,
  describedBy,
  onPreview,
}: {
  item: NavItem;
  describedBy?: string;
  onPreview?: () => void;
}) {
  return (
    <MenuLink
      href={item.href}
      aria-describedby={describedBy}
      onPointerEnter={onPreview}
      onFocus={onPreview}
      className="group block min-w-0 rounded-[8px] px-[10px] pt-[6.5px] pb-[7.75px] first:pt-[2.5px]"
    >
      <span className="block text-[14px] font-medium leading-[21px] tracking-[0.01em] text-[var(--cover-paper)] transition-colors group-hover:text-[var(--cover-muted)]">
        {item.label}
      </span>
      <span className="mt-[0.25px] block text-pretty text-[13px] leading-[18px] text-[var(--cover-muted)]">
        {item.description}
      </span>
    </MenuLink>
  );
}

/* ------------------------------------------------------------------ *
 * "On the line" — the pane that plays a real moment from a real call.
 * ------------------------------------------------------------------ */

export type PaneTurn = { who: "agent" | "client"; text: string };

export type PaneModel =
  | {
      kind: "call";
      key: string;
      context: string;
      turns: PaneTurn[];
      outcome: string;
      /** Reveals the caller's line word by word, for the transcript lens. */
      reveal?: boolean;
    }
  | { kind: "voices"; key: string; context: string };

function Kicker({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-[0.5em] text-[0.6875em] uppercase tracking-[0.12em] text-[var(--cover-paper)]/55">
      <span className="relative grid size-[0.4375em] shrink-0 place-items-center rounded-full bg-[var(--cover-mint)]">
        <span
          aria-hidden
          className="absolute -inset-[0.28em] rounded-full border border-[var(--cover-mint)]/40 motion-safe:animate-[orbHalo_2.2s_ease-out_infinite]"
        />
      </span>
      <span className="truncate">{children}</span>
    </p>
  );
}

function Turn({ turn, reveal, delay }: { turn: PaneTurn; reveal?: boolean; delay: number }) {
  const agent = turn.who === "agent";
  return (
    // Its own animation name: the pane's stagger is set per turn, and an
    // `animation-delay` on an element the pane's `> *` rule cannot reach
    // is a delay on nothing.
    <div className="hdr-pane-step" style={{ animationDelay: `${delay}ms` }}>
      <p className="text-[0.6875em] text-[var(--cover-paper)]/65">
        {agent ? SITE_HEADER.preview.agentTag : SITE_HEADER.preview.callerTag}
      </p>
      <p
        className={cn(
          "mt-[0.2em] line-clamp-3 text-[0.8125em] leading-[1.4]",
          agent
            ? "border-l-2 border-[var(--cover-brand-lit)] pl-[0.625em] text-[var(--cover-paper)]"
            : "text-[var(--cover-paper)]/75",
        )}
      >
        {reveal
          ? turn.text.split(" ").map((word, i) => (
              <span
                key={`${word}-${i}`}
                className="hdr-word"
                style={{ animationDelay: `${i * 35}ms` }}
              >
                {word}{" "}
              </span>
            ))
          : turn.text}
      </p>
    </div>
  );
}

/** Six voices, each with the signature its own pitch and pace draw. */
function VoiceRows() {
  return (
    <div className="mt-[0.75em] flex flex-col gap-[0.35em]">
      {SETUP_VOICES.map((voice) => (
        <div key={voice.id} className="flex items-center gap-[0.6em]">
          <span className="min-w-[4.2em] shrink-0">
            <span className="block text-[0.8125em] font-medium leading-[1.2] text-[var(--cover-paper)]">
              {voice.name}
            </span>
            <span className="block truncate text-[0.6875em] leading-[1.2] text-[var(--cover-paper)]/60">
              {voice.accent}
            </span>
          </span>
          <span aria-hidden className="flex h-[1.1em] flex-1 items-center gap-[0.16em]">
            {Array.from({ length: 8 }, (_, i) => (
              <span
                key={i}
                className="w-[0.14em] rounded-full bg-[var(--cover-brand-lit)]/70"
                style={{
                  height: `${(0.3 + 0.7 * Math.abs(Math.sin(i * (1 + voice.pitch * 3)))) * 100}%`,
                }}
              />
            ))}
          </span>
          <span className="shrink-0 text-[0.625em] tabular-nums text-[var(--cover-paper)]/60">
            {voice.wpm} wpm
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * The instrument, not a caption.
 *
 * Clamped lines and a height it is given rather than one it works out,
 * because everything above it swaps on hover and the popup must not
 * breathe while it does. In the Product panel it is handed the full
 * height of the row — the transcript is the payoff of the whole column,
 * and it was being cut off mid-sentence to leave a void underneath.
 * Hidden from assistive tech: every word in here is a restatement of a
 * link that is already in the panel.
 */
export function CallPane({ model, className }: { model: PaneModel; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none flex h-[13.5em] flex-col overflow-hidden rounded-[0.75em] bg-[var(--cover-panel)] p-[1em]",
        className,
      )}
    >
      <div key={model.key} className="hdr-pane-swap flex min-h-0 flex-1 flex-col">
        <Kicker>{model.context.toUpperCase()}</Kicker>

        {model.kind === "voices" ? (
          <VoiceRows />
        ) : (
          <>
            <div className="mt-[0.75em] flex flex-col gap-[0.75em]">
              {model.turns.map((turn, i) => (
                <Turn
                  key={`${model.key}-${i}`}
                  turn={turn}
                  reveal={model.reveal && turn.who === "client"}
                  delay={i === 0 ? 0 : 120}
                />
              ))}
            </div>

            {model.outcome ? (
              <div
                className="mt-auto border-t border-[var(--cover-paper)]/10 pt-[0.7em]"
                style={{ animationDelay: "240ms" }}
              >
                <p className="truncate text-[0.8125em] text-[var(--cover-paper)]/85">
                  {model.outcome}
                </p>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
