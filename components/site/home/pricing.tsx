"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { Frame, PillLink } from "@/components/site/product/primitives";
import { HOME_PRICING } from "@/lib/pages/home/pricing";
import {
  CALLS_DEFAULT,
  CALLS_MAX,
  CALLS_MIN,
  HOME_ENTERPRISE,
  HOME_PLANS,
  estimate,
  minutesFmt,
  money,
  planBands,
  type PlanId,
} from "@/lib/pages/home/pricing-math";
import { HomeHeading } from "./heading";
import { ChipRail, RoundButton, Segmented, Sizer, centreInRail, useRovingRadio, CHIP, RING_LIGHT } from "./controls";
import { useStageMotion } from "./motion";
import { PLAN_LIGHTS } from "./palettes";
import { TYPE, WEIGHT } from "./type";
import { Receipt } from "./pricing-receipt";
import { PlanCards, PlanJump } from "./pricing-cards";
import "./pricing.css";

/* ------------------------------------------------------------------ *
 * #pricing — what will I actually pay?
 *
 * The plans first, as colour: five listed cards and Enterprise, each its
 * own pearl mesh, flowing (pricing-cards.tsx), Pro the magenta one in the
 * middle.
 * Then one question (calls on a normal day) and everything else is
 * arithmetic done in front of the reader: the receipt adds the plan fee to
 * that plan's own rate past its allowance, the estimator takes on the
 * colour of whichever plan is the lowest bill at that volume, and — once
 * the reader has changed something — that plan's card is ringed and says
 * so. Every figure comes from `estimate()`, `planBands()` and
 * `HOME_PLANS`; none is typed here.
 *
 * Motion is small and all of it time-based: the receipt's figures run to
 * their new values (0.35s, snapped to the cent); a line whose wording
 * changes rolls in 6px; the slider's plan bands slide when Yearly moves
 * their handovers (0.45s, CSS); the estimator's colours ease (0.3s). On a
 * phone the rail brings the card that fits into view when the fit moves.
 * Reduced motion: all of it instant. The server's markup is the finished
 * state: CALLS_DEFAULT calls, Starter, monthly, nothing ringed.
 * ------------------------------------------------------------------ */

const P = HOME_PRICING;
const E = P.estimator;

// NEW: accessible names the section needs that no page already says.
const BILLING_LABEL = "Billing";
const valueText = (calls: number, minutes: number) =>
  `${calls} ${calls === 1 ? "call" : "calls"} a day, about ${minutesFmt(minutes)} minutes a month`;

type Billing = "monthly" | "yearly";
const BILLING = [
  { id: "monthly", label: P.billing.monthly },
  { id: "yearly", label: P.billing.yearly },
] as const satisfies readonly { id: Billing; label: string }[];

const clamp = (n: number) => Math.min(CALLS_MAX, Math.max(CALLS_MIN, n));
/** Where a volume sits along the thumb's travel, 0 at the first stop, 1 at the last. */
const share = (calls: number) => Math.min(1, Math.max(0, (calls - CALLS_MIN) / (CALLS_MAX - CALLS_MIN)));
/** A share of the thumb's travel as a position on the track: the thumb's centre never reaches the ends. */
const onTrack = (s: number) => (s >= 1 ? "100%" : `calc(12px + (100% - 24px) * ${s})`);

type Bands = ReturnType<typeof planBands>;

/**
 * The track: each plan's band in that plan's signal colour, as a hard-stop
 * gradient whose handovers are registered numbers (pricing.css), so they
 * slide when Yearly moves them.
 */
function trackStyle(bands: Bands): CSSProperties {
  const ends = HOME_PLANS.map((plan, i) => {
    const upTo = HOME_PLANS.slice(0, i + 1).map((p) => p.id);
    const last = bands.filter((b) => upTo.includes(b.id)).at(-1);
    return last ? share(last.to + 0.5) : 0;
  });
  const stops = HOME_PLANS.map((plan, i) => {
    const color = PLAN_LIGHTS[plan.id].signal;
    if (i === HOME_PLANS.length - 1) return `${color} 0`;
    const at = ends[i] >= 1 ? "100%" : `calc(12px + (100% - 24px) * var(--home-pricing-b${i + 1}))`;
    return `${color} 0 ${at}`;
  });
  return Object.fromEntries([
    ["--bands", `linear-gradient(90deg, ${stops.join(", ")})`],
    ...ends.slice(0, -1).map((e, i) => [`--home-pricing-b${i + 1}`, e]),
  ]) as CSSProperties;
}

/** The longest band sentence, to hold the line's height (Sizer). */
const LONGEST_BAND = E.band("Business", 42, 75, false, false);

export function Pricing() {
  const labelId = useId();
  const stageRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLOListElement>(null);
  const m = useStageMotion(stageRef, { id: "pricing" });
  const { markInteracted } = m;
  const quick = m.reduce || m.tier === "lite";

  const [calls, setCalls] = useState<number>(CALLS_DEFAULT);
  const [annual, setAnnual] = useState(false);
  const [changed, setChanged] = useState(false);
  const [said, setSaid] = useState("");

  const est = useMemo(() => estimate(calls, annual), [calls, annual]);
  const bands = useMemo(() => planBands(annual), [annual]);
  const band = bands.find((b) => b.id === est.plan.id);
  const bandAt = band ? bands.indexOf(band) : -1;

  /* ─── What the reader does. ─────────────────────────────────────── */
  const latest = useRef(est);
  useEffect(() => {
    latest.current = est;
  }, [est]);
  const sayTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(sayTimer.current), []);

  const change = useCallback(
    (nextCalls: number, nextAnnual: boolean) => {
      markInteracted();
      setChanged(true);
      setCalls(clamp(Math.round(nextCalls)));
      setAnnual(nextAnnual);
      // The total, said once the reader lets go.
      window.clearTimeout(sayTimer.current);
      sayTimer.current = window.setTimeout(() => {
        const e = latest.current;
        setSaid(
          `${e.callsDay} ${e.callsDay === 1 ? "call" : "calls"} a day. ${E.total}: ${money(e.total)}. ${e.plan.name}.`,
        );
      }, 600);
    },
    [markInteracted],
  );

  // On the rail, the card that fits comes into view when it is first ringed
  // (the reader's first change) and whenever the fit moves after that.
  const lastFit = useRef<PlanId | null>(null);
  useEffect(() => {
    if (!changed || lastFit.current === est.plan.id) return;
    lastFit.current = est.plan.id;
    const rail = railRef.current;
    const li = rail?.querySelector<HTMLElement>(`[data-plan="${est.plan.id}"]`);
    if (rail && li && rail.scrollWidth > rail.clientWidth) centreInRail(rail, li, quick);
  }, [changed, est.plan.id, quick]);

  const railPresets = useRef<HTMLDivElement>(null);
  const preset = useRovingRadio({
    count: E.presets.length,
    index: E.presets.findIndex((p) => p.callsDay === calls),
    orientation: "horizontal",
    onChange: (i) => {
      change(E.presets[i].callsDay, annual);
      // On a phone the rail scrolls: bring the chosen chip to its middle.
      const rail = railPresets.current;
      const item = rail?.querySelector<HTMLElement>(`[data-preset="${i}"]`);
      if (rail && item && rail.scrollWidth > rail.clientWidth) centreInRail(rail, item, quick);
    },
  });

  const track = useMemo(() => trackStyle(bands), [bands]);
  // The handover notches, one at the start of every band but the first.
  const notches = bands.slice(1).map((b) => ({ id: b.id, left: onTrack(share(b.from - 0.5)) }));

  return (
    <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-28">
      <Frame>
        <HomeHeading
          id="pricing-title"
          eyebrow={P.eyebrow}
          title={P.title}
          titleKey={P.key}
          keyTone="spectrum"
          sub={P.sub}
          action={
            <div className="flex items-center gap-3">
              <Segmented
                label={BILLING_LABEL}
                options={BILLING}
                value={annual ? "yearly" : "monthly"}
                onChange={(v) => change(calls, v === "yearly")}
              />
              <span
                className={cn(
                  "inline-flex h-7 items-center rounded-full px-3 text-[13px] leading-[18px] font-medium transition-[background-color,color] duration-200",
                  annual ? "bg-(--home-electric) text-white" : "bg-[rgb(124_58_237/0.12)] text-(--home-violet)",
                )}
                translate="no"
              >
                {P.annualNote}
              </span>
            </div>
          }
        />

        <PlanJump annual={annual} railRef={railRef} reduce={quick} />

        <PlanCards
          annual={annual}
          changed={changed}
          fitId={est.plan.id}
          calls={calls}
          bands={bands}
          railRef={railRef}
        />
        <p className="mt-4 text-[13px] leading-[18px] text-pp-muted">
          {P.vat} {P.footnote}
        </p>

        {/* #your-bill: the FAQ's "Work out the bill" lands here. Focusable
            from script only, so the jump carries keyboard focus with it.
            It wears the colours of the plan that is the lowest bill. */}
        <div
          id="your-bill"
          tabIndex={-1}
          ref={stageRef}
          data-plan={est.plan.id}
          className="home-plan-light home-pricing-panel home-rise mt-14 scroll-mt-28 rounded-[28px] p-5 outline-none sm:p-7 lg:mt-16 lg:p-8 xl:p-10"
        >
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-10">
            <div className="flex min-w-0 flex-col">
              <h3 className={cn(TYPE.h3, "text-pp-ink")} style={{ fontWeight: WEIGHT.h3 }}>
                {E.title}
              </h3>
              <p id={labelId} className="mt-4 text-[13px] leading-[18px] font-medium text-pp-muted">
                {E.label}
              </p>

              <div className="mt-3 flex items-center gap-3">
                <RoundButton
                  icon="minus"
                  size={44}
                  label={E.fewer}
                  onClick={() => change(calls - 1, annual)}
                  ariaDisabled={calls <= CALLS_MIN}
                />
                <span
                  aria-hidden
                  className="home-pricing-tint pp-display min-w-[3ch] text-center text-[48px] leading-[52px] tracking-[-0.02em] text-(--plan-ink) tabular-nums sm:text-[56px] sm:leading-[60px]"
                  style={{ fontWeight: WEIGHT.display }}
                >
                  {calls}
                </span>
                <RoundButton
                  icon="plus"
                  size={44}
                  label={E.more}
                  onClick={() => change(calls + 1, annual)}
                  ariaDisabled={calls >= CALLS_MAX}
                />
              </div>

              <ChipRail labelledBy={labelId} railRef={railPresets} className="mt-5">
                {E.presets.map((p, i) => {
                  const on = p.callsDay === calls;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      {...preset.getItemProps(i)}
                      data-preset={i}
                      className={cn(
                        "relative inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm whitespace-nowrap",
                        "before:absolute before:inset-x-0 before:-inset-y-1",
                        CHIP.ease,
                        RING_LIGHT,
                        on ? "bg-(--plan-ink) text-white" : "pp-shadow-btn bg-white text-pp-ink hover:bg-[#fbfaff]",
                      )}
                    >
                      {!on && (
                        <span
                          aria-hidden
                          data-plan={estimate(p.callsDay, annual).plan.id}
                          className="home-plan-light home-plan-dot size-1.5 shrink-0 rounded-full"
                        />
                      )}
                      {p.label}
                      <span className={cn("transition-colors duration-200", on ? "text-white/85" : "text-pp-muted")}>
                        {` · ${p.callsDay} ${E.perDayUnit}`}
                      </span>
                    </button>
                  );
                })}
              </ChipRail>

              <div className="mt-7 lg:mt-auto lg:pt-8">
                <div className="relative">
                  {/* A notch at each handover, so the bands read as zones. It
                      sits under the input: the track hides its middle and
                      the thumb passes over it. */}
                  <div aria-hidden className="pointer-events-none absolute inset-0">
                    {notches.map((n) => (
                      <span
                        key={n.id}
                        className="home-pricing-tick absolute top-1/2 h-3.5 w-px -translate-x-1/2 -translate-y-1/2 bg-[rgb(24_16_40/0.28)]"
                        style={{ left: n.left }}
                      />
                    ))}
                  </div>
                  <input
                    type="range"
                    min={CALLS_MIN}
                    max={CALLS_MAX}
                    step={1}
                    value={calls}
                    onChange={(ev) => change(Number(ev.currentTarget.value), annual)}
                    aria-labelledby={labelId}
                    aria-valuetext={valueText(calls, est.minutes)}
                    className="home-range home-pricing-range relative"
                    style={track}
                  />
                </div>
                {/* Which plan is the cheapest around here, in words. */}
                <p className="mt-2 grid text-[14px] leading-5 text-pp-ink">
                  <Sizer as="span">{LONGEST_BAND}</Sizer>
                  <span className="[grid-area:1/1]">
                    {band && (
                      <>
                        <span className="home-pricing-tint font-medium text-(--plan-ink)">{est.plan.name}</span>
                        {E.band("", band.from, band.to, bandAt === 0, bandAt === bands.length - 1)}
                      </>
                    )}
                  </span>
                </p>
                <p className="mt-3 text-[13px] leading-[18px] text-pp-muted">
                  {E.beyond.pre}
                  <a href={HOME_ENTERPRISE.cta.href} className={cn("home-link rounded-sm", RING_LIGHT)}>
                    {E.beyond.link}
                  </a>
                  {E.beyond.post}
                </p>
              </div>
            </div>

            <Receipt
              estimate={est}
              annual={annual}
              kit={m.reduce ? null : m.kit}
              reduce={m.reduce}
              changed={changed}
              announce={said}
            />
          </div>
        </div>

        <ul className="mt-10 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
          {P.facts.map((f) => (
            <li key={f.title} className="flex gap-3">
              <span
                aria-hidden
                className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[rgb(124_58_237/0.12)] text-(--home-violet)"
              >
                <svg viewBox="0 0 12 12" fill="none" className="size-2.5">
                  <path
                    d="M2.5 6.2 5 8.5l4.5-5"
                    stroke="currentColor"
                    strokeWidth={1.75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <div>
                <p className="text-[15px] leading-[22px] font-medium text-pp-ink">{f.title}</p>
                <p className="mt-0.5 text-[13px] leading-[18px] text-pp-muted">{f.body}</p>
              </div>
            </li>
          ))}
        </ul>

        <div aria-hidden className="mt-12 h-px bg-pp-rule" />
        <div className="mt-8 grid gap-4 lg:grid-cols-[384px_minmax(0,1fr)_auto] lg:items-start lg:gap-8">
          <h3 className={cn(TYPE.h3, "text-pretty")} style={{ fontWeight: WEIGHT.h3 }}>
            {P.trial.headline}
          </h3>
          <p className={cn(TYPE.body, "max-w-[600px] text-pretty text-pp-ink/80")}>{P.trial.body}</p>
          <div className="mt-2 lg:mt-0">
            <PillLink href={P.trial.href}>{P.trial.cta}</PillLink>
          </div>
        </div>

        <div className="home-faq mt-10 border-y border-pp-rule">
          <details className="home-pricing-note">
            <summary className="home-pricing-note-q flex items-center justify-between gap-6 py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink">
              <h3 className={cn(TYPE.h3, "min-w-0")} style={{ fontWeight: WEIGHT.h3 }}>
                {P.note.summary}
              </h3>
              <span aria-hidden className="home-pricing-disc grid size-8 shrink-0 place-items-center rounded-full">
                <svg viewBox="0 0 12 12" fill="none" className="size-3">
                  <path d="M6 1.25v9.5M1.25 6h9.5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
                </svg>
              </span>
            </summary>
            <p className={cn(TYPE.body, "max-w-[640px] pb-6 text-pretty text-pp-ink/80")}>{P.note.body}</p>
          </details>
        </div>
      </Frame>
    </section>
  );
}
