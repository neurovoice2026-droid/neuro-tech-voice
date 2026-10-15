"use client";

import {
  useEffect,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type MouseEventHandler,
  type ReactNode,
  type RefObject,
} from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { HOME_PRICING } from "@/lib/pages/home/pricing";
import { money, wholeMoney } from "@/lib/pages/home/pricing-math";
import { WEIGHT } from "@/components/site/home/type";
import { TIER_BLOBS, type TierLight } from "./lights";
import "./plan-tier.css";

/* ------------------------------------------------------------------ *
 * A plan card, as the homepage draws it (#pricing) and the app shows it
 * (onboarding, billing): presentational only, the same markup wherever
 * it is used, so a plan reads and looks the same before and after
 * sign-up.
 *
 * A card is a pearl mesh (plan-tier.css `.home-plan-light[data-plan]`)
 * under a fine grain, with its flowing copy on top (`Mesh`; it flows only
 * while `data-live` is set, `useLiveMeshes`). Top to bottom it reads: the
 * name and the pick's badge, the fee and what it is a day and a year, the
 * allowance and the price of extra minutes past it, the way in, and what
 * it has. Enterprise is a card of its own (`EnterpriseTierCard`): a name,
 * a line instead of a fee, what it has and the way in.
 *
 * The caller supplies the words and figures (the homepage from its price
 * list, the app from PLANS through plan-tier-view.ts) and the parts only
 * it has: the homepage's "lowest bill" tab and band, the app's selected
 * or current state and its buttons. Nothing here knows which page it is
 * on.
 * ------------------------------------------------------------------ */

const P = HOME_PRICING;

/** The classes every listed card carries; a caller appends its own layout. */
export const TIER_CARD = "home-plan home-plan-light";
/** The classes of an Enterprise card. */
export const ENTERPRISE_CARD = "home-plan home-plan-light home-plan-enterprise";

/** The flowing copy of a card's mesh (plan-tier.css "The mesh in motion"). */
export function Mesh({ blobs }: { blobs: CSSProperties[] }) {
  return (
    <span aria-hidden className="home-plan-mesh">
      {blobs.map((style, n) => (
        <span key={n} style={style} />
      ))}
    </span>
  );
}

/**
 * The meshes flow only on the cards that are on screen: `data-live` is
 * toggled straight on each `.home-plan` inside the container, so no render.
 */
export function useLiveMeshes(railRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const rail = railRef.current;
    if (!rail || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) e.target.toggleAttribute("data-live", e.isIntersecting);
    });
    rail.querySelectorAll(".home-plan").forEach((li) => io.observe(li));
    return () => io.disconnect();
  }, [railRef]);
}

/**
 * A span that rolls in (`.home-pricing-in`) when it mounts after the
 * reader's first change — which is when a key change (Yearly, a new plan)
 * remounts it — and never merely because `changed` flipped under it.
 */
export function RollIn({ animate, className, ...rest }: { animate: boolean } & HTMLAttributes<HTMLSpanElement>) {
  const [on] = useState(animate);
  return <span className={cn(className, on && "home-pricing-in")} {...rest} />;
}

/** "$207.50" → ["$207", "50"]; whole-dollar fees print without cents. */
function splitMoney(n: number) {
  const [dollars, c = "00"] = money(n).split(".");
  return { dollars, cents: c === "00" ? null : c };
}

/**
 * A card's fee, in the display face, with what it is said as. A month by
 * default ("/mo", "$49.00 a month"); `unit` and `spoken` say anything else
 * (the trial's "for 14 days").
 */
export function Fee({
  fee,
  pick,
  annual,
  changed,
  unit = P.plan.perMonth,
  spoken,
}: {
  fee: number;
  pick: boolean;
  annual: boolean;
  changed: boolean;
  unit?: string;
  spoken?: string;
}) {
  const { dollars, cents: c } = splitMoney(fee);
  return (
    <p className="flex items-baseline gap-1 whitespace-nowrap">
      <RollIn
        key={annual ? "yearly" : "monthly"}
        animate={changed}
        aria-hidden
        className={cn("home-plan-fee pp-display tracking-[-0.025em] tabular-nums", pick && "home-plan-fee-pick")}
        style={{ fontWeight: WEIGHT.num }}
      >
        {dollars}
        {c && <span className="ml-px align-[0.72em] text-[0.5em] leading-none tracking-normal">.{c}</span>}
      </RollIn>
      <span aria-hidden className="text-[13px] leading-[18px] text-(--plan-dim)">
        {unit}
      </span>
      <span className="sr-only">
        {spoken ?? (
          <>
            {money(fee)}
            {annual ? P.plan.aMonthYearly : P.plan.aMonth}
          </>
        )}
      </span>
    </p>
  );
}

/** A priced card's fee block: the fee, what it is a day, and the other billing period in one line. */
export function TierPrice({
  fee,
  perDay,
  yearlyFee,
  yearTotal,
  yearOff,
  pick,
  annual,
  changed,
}: {
  /** The fee a month on the billing shown (yearly: the year over twelve). */
  fee: number;
  /** That fee over the days of a month. */
  perDay: number;
  /** The fee a month on yearly billing. */
  yearlyFee: number;
  /** What a year costs up front, and what that takes off twelve monthly fees. */
  yearTotal: number;
  yearOff: number;
  pick: boolean;
  annual: boolean;
  changed: boolean;
}) {
  return (
    <>
      <Fee fee={fee} pick={pick} annual={annual} changed={changed} />
      <p className="mt-1 text-[15px] leading-[22px] font-medium text-(--plan-accent)">
        <RollIn key={annual ? "yearly" : "monthly"} animate={changed} className="block">
          {P.plan.perDay(money(perDay))}
        </RollIn>
      </p>
      <p className="mt-0.5 grid text-[13px] leading-[18px] text-(--plan-dim)">
        <span aria-hidden={annual} className={cn("[grid-area:1/1]", annual && "invisible")}>
          {P.plan.onYearly(wholeMoney(yearlyFee))}
        </span>
        <span aria-hidden={!annual} className={cn("[grid-area:1/1]", !annual && "invisible")}>
          {P.plan.yearly(wholeMoney(yearTotal), wholeMoney(yearOff))}
        </span>
      </p>
    </>
  );
}

/** The allowance: the minutes in the fee, then the lines about them; `children` follow (the homepage's band). */
export function TierAllowance({
  included,
  notes,
  children,
}: {
  included: string;
  notes: readonly string[];
  children?: ReactNode;
}) {
  return (
    <>
      <p className="text-[15px] leading-[22px] font-medium text-(--plan-text)">{included}</p>
      {notes.map((note) => (
        <p key={note} className="text-[13px] leading-[18px] text-(--plan-dim)">
          {note}
        </p>
      ))}
      {children}
    </>
  );
}

/** What a plan has: a head line and a ticked list (two columns from xl on a wide card, or `columns`). */
export function PerkList({
  head,
  items,
  wide = false,
  columns,
}: {
  head: string;
  items: readonly string[];
  wide?: boolean;
  /** The wide list's column classes, in place of the homepage's `xl:grid-cols-2 xl:gap-x-8`. */
  columns?: string;
}) {
  return (
    <div className="home-plan-perks">
      <p className="text-[13px] leading-[18px] text-(--plan-dim)">{head}</p>
      <ul className={cn("mt-3 grid gap-2.5", wide && (columns ?? "xl:grid-cols-2 xl:gap-x-8"))}>
        {items.map((text, k) => (
          <li key={k} className="flex gap-2.5 text-[14px] leading-5 text-(--plan-text)">
            <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-(--plan-tick)" strokeWidth={2.25} />
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The pick's badge: white, magenta, a four-point star ("Our pick", "Most popular"). */
export function PickBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-white px-2.5 text-[12px] leading-4 font-medium text-[#a21caf] shadow-[0_1px_2px_rgb(162_28_175/0.18)]">
      <svg aria-hidden viewBox="0 0 10 10" className="size-2.5 fill-current">
        <path d="M5 0c.4 2.6 2.4 4.6 5 5-2.6.4-4.6 2.4-5 5-.4-2.6-2.4-4.6-5-5 2.6-.4 4.6-2.4 5-5Z" />
      </svg>
      {children}
    </span>
  );
}

/** A card's name, focusable from script (the homepage's jump chips land a keyboard in the card they show). */
function TierName({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3
      id={id}
      tabIndex={-1}
      className="pp-display text-[20px] leading-[26px] tracking-[-0.01em] text-(--plan-text) outline-none"
      style={{ fontWeight: WEIGHT.h3 }}
    >
      {children}
    </h3>
  );
}

/** What the app adds to a card for choosing: the card is the chosen plan, or the plan the organization is on. */
export type TierState = "selected" | "current";

type CardRootProps = {
  /** `li` in a list of cards (the homepage), `div` elsewhere. */
  as?: "li" | "div";
  id?: string;
  /** The card's own id (`data-card`): the homepage's jump chips and estimator find cards by it. */
  cardId: string;
  /** The light it wears (`data-plan`). */
  light: TierLight;
  /** Its place in the row (`data-i`): staggers the entrance and the mesh's tempo. */
  i: number;
  /** The h3's id; the card is labelled by it. */
  nameId: string;
  /** The full class list: `TIER_CARD` / `ENTERPRISE_CARD` plus the caller's layout. */
  className: string;
  /** The app's state: ringed in ink, with a tab (plan-tier.css "Choosing, in the app"). */
  state?: TierState;
  /** The app's locked card (its choice cannot change right now). */
  disabled?: boolean;
  /** The whole card selects (a pointer convenience; the card's own button is the control). */
  onClick?: MouseEventHandler<HTMLElement>;
  /** Drawn over the card's edge, after its ground: the homepage's fitting tab, the app's state tab. */
  overlay?: ReactNode;
  name: string;
};

/**
 * A listed plan's card. The homepage passes its "lowest bill" tab as
 * `overlay` and its "cheapest for" line inside `allowance`; the app
 * passes its state and its button.
 */
export function PlanTierCard({
  as: Root = "li",
  pick,
  current,
  badge,
  price,
  allowance,
  action,
  perks,
  ...card
}: CardRootProps & {
  /** Our recommendation: the magenta pearl's ring, drop, larger fee and magenta button. */
  pick: boolean;
  /** The homepage's fitting card (`aria-current`). */
  current?: boolean;
  /** The pick's badge text. */
  badge?: string | null;
  price: ReactNode;
  allowance: ReactNode;
  action: ReactNode;
  perks: ReactNode;
}) {
  const { id, cardId, light, i, nameId, className, state, disabled, onClick } = card;
  return (
    <Root
      id={id}
      data-card={cardId}
      data-plan={light}
      data-tone="light"
      data-pick={pick || undefined}
      data-i={i}
      data-state={state}
      data-disabled={disabled || undefined}
      data-pickable={onClick && !disabled ? true : undefined}
      aria-labelledby={nameId}
      aria-current={current ? "true" : undefined}
      className={className}
      onClick={disabled ? undefined : onClick}
    >
      <Mesh blobs={TIER_BLOBS[light]} />
      <span aria-hidden className="home-grain" />
      {pick && <span aria-hidden className="home-plan-ring" />}
      {card.overlay}

      <div className="home-plan-head flex items-start justify-between gap-3">
        <TierName id={nameId}>{card.name}</TierName>
        {badge && <PickBadge>{badge}</PickBadge>}
      </div>

      <div className="home-plan-price mt-4">{price}</div>

      <div className="home-plan-allowance mt-5 border-t border-(--plan-rule) pt-4">{allowance}</div>

      <div className="home-plan-action mt-5">{action}</div>

      <div className="mt-5 border-t border-(--plan-rule) pt-4">{perks}</div>
    </Root>
  );
}

/** The sales-led rung's card: a name, a line in place of a fee, what it has and the way in. */
export function EnterpriseTierCard({
  as: Root = "li",
  tagline,
  line,
  perks,
  action,
  ...card
}: CardRootProps & {
  /** In the display face where a fee would be ("Priced with you", "From $1,000 a month"). */
  tagline: string;
  line: string;
  perks: ReactNode;
  action: ReactNode;
}) {
  const { id, cardId, light, i, nameId, className, state, disabled, onClick } = card;
  return (
    <Root
      id={id}
      data-card={cardId}
      data-plan={light}
      data-tone="light"
      data-i={i}
      data-state={state}
      data-disabled={disabled || undefined}
      data-pickable={onClick && !disabled ? true : undefined}
      aria-labelledby={nameId}
      className={className}
      onClick={disabled ? undefined : onClick}
    >
      <Mesh blobs={TIER_BLOBS[light]} />
      <span aria-hidden className="home-grain" />
      {card.overlay}
      <div className="home-plan-enterprise-id">
        <TierName id={nameId}>{card.name}</TierName>
        <p
          className="pp-display mt-3 text-[28px] leading-[32px] tracking-[-0.02em] text-(--plan-text)"
          style={{ fontWeight: 500 }}
        >
          {tagline}
        </p>
        <p className="mt-2 text-[14px] leading-5 text-(--plan-dim)">{line}</p>
      </div>
      <div className="home-plan-enterprise-perks">{perks}</div>
      <div className="home-plan-enterprise-cta">{action}</div>
    </Root>
  );
}
