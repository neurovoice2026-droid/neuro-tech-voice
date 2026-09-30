"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { gsap } from "gsap";
import { cn } from "@/lib/utils";
import type { Kit } from "@/components/site/product/motion-kit";
import { AVG_CALL_MIN, DAYS_PER_MONTH } from "@/lib/site";
import { HOME_PRICING } from "@/lib/pages/home/pricing";
import { minutesFmt, money, perCallOf, perMinute, smallMoney, type Estimate } from "@/lib/pages/home/pricing-math";
import { RING_LIGHT, Sizer } from "./controls";
import { RollIn } from "./pricing-cards";
import { WEIGHT } from "./type";

/* ------------------------------------------------------------------ *
 * #your-bill's receipt: which plan is the lowest bill, the whole
 * arithmetic, one line per factor, the total it adds up to, and that
 * total restated a day and a call. In the body face throughout, figures
 * tabular; the plan's name and the total wear the plan's own ink.
 *
 * The figures in the right-hand column run to their new value (0.35s,
 * snapped to the cent, so every frame is a price that could be on a
 * bill) instead of cutting; the words beside them change at once,
 * because they say what is being added, not how much. The allowance
 * line and the overage line are two faces of one cell (pricing.css).
 * ------------------------------------------------------------------ */

const P = HOME_PRICING;

// NEW (spec S6): the receipt's line templates. Every number in them is
// read from the estimate, the plan or the constants the estimate uses.
const line = {
  volume: (calls: number) =>
    `${calls} ${calls === 1 ? "call" : "calls"} × ${AVG_CALL_MIN} min × ${DAYS_PER_MONTH} days`,
  fee: (plan: string, annual: boolean) => `${plan} plan fee${annual ? ` · ${P.billing.billedYearly}` : ""}`,
  over: (e: Estimate) =>
    `${minutesFmt(e.overMinutes)} min past ${minutesFmt(e.plan.minutes)} × ${perMinute(e.plan.overage)}`,
  under: (e: Estimate) => `Included in the plan: ${minutesFmt(e.minutes)} of ${minutesFmt(e.plan.minutes)} min`,
};

const asMinutes = (n: number) => `${minutesFmt(n)} min`;

/** The longest fee line: Business, billed yearly. */
const LONGEST_FEE = line.fee("Business", true);

/** The longest reframe, to hold the line's height: $33.00 a day at Scale's top. */
const LONGEST_REFRAME = P.estimator.reframe("$33.00", "$1.63");

/**
 * A number that runs to its new value. The span's text is written by the
 * tween, never by React after the first paint: React renders the value
 * the server printed and leaves the node alone from then on.
 */
function Figure({
  value,
  format,
  snap,
  kit,
  reduce,
  className,
  style,
}: {
  value: number;
  format: (n: number) => string;
  /** The step every frame lands on: 0.01 for money, 1 for minutes. */
  snap: number;
  kit: Kit | null;
  reduce: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [first] = useState(() => format(value));
  const shown = useRef(value);
  const tween = useRef<gsap.core.Tween | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    tween.current?.kill();
    tween.current = null;
    if (!kit || reduce || shown.current === value) {
      shown.current = value;
      el.textContent = format(value);
      return;
    }
    const proxy = { v: shown.current };
    tween.current = kit.gsap.to(proxy, {
      v: value,
      duration: 0.35,
      ease: "power2.out",
      snap: { v: snap },
      onUpdate: () => {
        shown.current = proxy.v;
        el.textContent = format(proxy.v);
      },
      onComplete: () => {
        tween.current = null;
      },
    });
  }, [value, format, snap, kit, reduce]);

  useEffect(
    () => () => {
      tween.current?.kill();
    },
    [],
  );

  return (
    <span ref={ref} className={className} style={style}>
      {first}
    </span>
  );
}

export function Receipt({
  estimate: e,
  annual,
  kit,
  reduce,
  changed,
  announce,
}: {
  estimate: Estimate;
  annual: boolean;
  kit: Kit | null;
  reduce: boolean;
  /** The reader has changed something: wording changes may animate from now on. */
  changed: boolean;
  /** The total, said once the reader stops (polite, debounced by the parent). */
  announce: string;
}) {
  const over = e.overMinutes > 0;
  const small = "text-[13px] leading-5";
  const per = perCallOf(e);

  // Each face of the drum keeps the last estimate it was showing, so the
  // face rolling away still says what it said, not the new numbers.
  const [underE, setUnderE] = useState(e);
  const [overE, setOverE] = useState(e);
  if (!over && underE !== e) setUnderE(e);
  if (over && overE !== e) setOverE(e);

  return (
    <div className="flex flex-col rounded-[20px] bg-white p-6 shadow-[0_0_0_1px_rgb(24_16_40/0.06),0_24px_48px_-32px_rgb(36_16_79/0.35)]">
      {/* On a phone the link takes a line of its own, so the row is two lines there, always, and one from sm. */}
      <div className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={cn(small, "whitespace-nowrap text-pp-muted")}>{P.estimator.lowest}</span>
        <span
          aria-hidden
          data-plan={e.plan.id}
          className="home-plan-light home-plan-swatch size-4 shrink-0 rounded-[5px]"
        />
        <RollIn
          key={e.plan.id}
          animate={changed}
          className="home-pricing-tint text-[15px] leading-[22px] font-medium whitespace-nowrap text-(--plan-ink)"
        >
          {e.plan.name}
        </RollIn>
        <a
          href={`#plan-${e.plan.id}`}
          className={cn(
            "home-pricing-tint rounded-sm text-[13px] leading-[18px] whitespace-nowrap text-(--plan-ink) underline decoration-current/35 underline-offset-[0.22em] hover:decoration-current max-sm:basis-full sm:ml-auto",
            RING_LIGHT,
          )}
        >
          {P.estimator.see}
          <span aria-hidden> ↑</span>
        </a>
      </div>
      <dl className={cn(small, "grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-3 tabular-nums")}>
        <dt className="text-pp-muted">{line.volume(e.callsDay)}</dt>
        <dd className="text-right font-medium text-pp-ink">
          <Figure value={e.minutes} format={asMinutes} snap={1} kit={kit} reduce={reduce} />
        </dd>

        {/* Held at its longest wording, so Yearly never changes the receipt's height. */}
        <dt className="grid text-pp-muted">
          <Sizer as="span">{LONGEST_FEE}</Sizer>
          <RollIn key={`${e.plan.id}-${annual}`} animate={changed} className="block [grid-area:1/1]">
            {line.fee(e.plan.name, annual)}
          </RollIn>
        </dt>
        <dd className="text-right font-medium text-pp-ink">
          <Figure value={e.fee} format={money} snap={0.01} kit={kit} reduce={reduce} />
        </dd>

        <dt className="grid text-pp-muted">
          <span data-face="under" aria-hidden={over} className="home-pricing-face">
            {line.under(over ? underE : e)}
          </span>
          <span data-face="over" aria-hidden={!over} className="home-pricing-face">
            {line.over(over ? e : overE)}
          </span>
        </dt>
        <dd className="text-right font-medium text-pp-ink">
          <Figure value={e.overCost} format={money} snap={0.01} kit={kit} reduce={reduce} />
        </dd>
      </dl>

      <div aria-hidden className="my-5 h-px bg-pp-rule" />

      <div className="grid gap-1 sm:flex sm:items-baseline sm:justify-between sm:gap-4">
        <p className={cn(small, "text-pp-muted")}>{P.estimator.total}</p>
        <Figure
          value={e.total}
          format={money}
          snap={0.01}
          kit={kit}
          reduce={reduce}
          className="home-pricing-tint pp-display text-[44px] leading-[48px] tracking-[-0.02em] text-(--plan-ink) tabular-nums"
          style={{ fontWeight: WEIGHT.num }}
        />
      </div>
      <p className={cn(small, "mt-2 grid text-pp-muted")}>
        <Sizer as="span">{LONGEST_REFRAME}</Sizer>
        <span className="[grid-area:1/1]">{P.estimator.reframe(money(per.day), smallMoney(per.call))}</span>
      </p>
      <p className="mt-3 text-[12px] leading-4 text-pp-muted">
        {P.estimator.assumptions} {P.estimator.numberNote}
      </p>

      {/* The total, once the reader lets go. Never during the intro. */}
      <p aria-live="polite" aria-atomic className="sr-only">
        {announce}
      </p>
    </div>
  );
}
