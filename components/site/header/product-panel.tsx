"use client";

import { useEffect, useMemo, useState } from "react";
import {
  INDUSTRIES,
  NAV_ANY_INDUSTRY,
  NAV_INDUSTRIES,
  NAV_INDUSTRY_DEFAULT,
  PRODUCT_GROUPS,
  PRODUCT_MENU,
  SETUP_VOICES,
  SITE_HEADER,
  TIERS,
  customIndustry,
  type ProductItem,
} from "@/lib/site";
import { CallPane, GroupHeading, ItemCard, MenuLink, type PaneModel } from "./parts";
import { IndustryPicker } from "./industry-picker";
// The site's own hook rather than framer-motion's: this panel is in the
// header of every page, and one hook was bringing the whole motion library
// with it. The panel mounts when the menu opens, long after hydration, so
// this reads the real preference on its first render.
import { usePrefersReducedMotion } from "../product/timing";

/* ------------------------------------------------------------------ *
 * Product — a directory on the left, an instrument on the right.
 *
 * Every value the preview shows is read from data the site already has:
 * the eight trades the use-cases section models, the six voices the setup
 * wizard lists, the first integration, the first tier's price. Nothing in
 * this panel is invented at render time, so the menu cannot drift away
 * from the page it is a menu for.
 * ------------------------------------------------------------------ */

const ALL_ITEMS: ProductItem[] = PRODUCT_GROUPS.flatMap((group) => group.items);

function industryPane(slug: string): PaneModel {
  const industry =
    NAV_INDUSTRIES.find((i) => i.slug === slug) ?? NAV_INDUSTRIES[0];
  return {
    kind: "call",
    key: `industry-${industry.slug}`,
    context: PRODUCT_MENU.liveKicker(industry.label),
    turns: [
      { who: "client", text: industry.caller },
      { who: "agent", text: industry.agent },
    ],
    outcome: industry.outcome,
  };
}

function resolvePane(
  itemId: string | null,
  industry: string,
  draft: string,
): PaneModel {
  // A typed trade outranks everything: it is the most deliberate thing
  // anyone can do in this panel.
  const typed = draft.trim();
  if (typed.length >= 2) {
    const generic = customIndustry(typed);
    return {
      kind: "call",
      key: "custom",
      context: PRODUCT_MENU.liveKicker(typed),
      turns: [
        { who: "client", text: generic.caller },
        { who: "agent", text: generic.agent },
      ],
      outcome: generic.outcome,
    };
  }

  if (!itemId) return industryPane(industry);

  const item = ALL_ITEMS.find((i) => i.id === itemId);
  if (!item) return industryPane(industry);

  // The agent is the thing the industries demonstrate, so its own row
  // shows whichever trade the visitor was last looking at.
  if (item.lens === "industry") return industryPane(industry);

  if (item.lens === "voices") {
    return { kind: "voices", key: item.id, context: item.moment?.context ?? item.label };
  }

  if (item.lens === "transcribe") {
    const trades = INDUSTRIES.find((entry) => entry.id === "trades");
    return {
      kind: "call",
      key: item.id,
      // The turns are a real trade's words; the two lines around them are
      // in lib/site.ts with every other string in this menu.
      context: item.moment?.context ?? item.label,
      turns: trades ? [{ who: "client", text: trades.caller }] : [],
      outcome: item.moment?.outcome ?? "",
      reveal: true,
    };
  }

  const moment = item.moment;
  if (!moment) return industryPane(industry);

  // A voice-led moment names the voice it is read in, from the wizard's
  // own list, rather than describing it.
  const voice = moment.voiceId
    ? SETUP_VOICES.find((v) => v.id === moment.voiceId)
    : undefined;

  return {
    kind: "call",
    key: item.id,
    context: voice
      ? `${voice.name} · ${voice.accent} · ${voice.wpm} wpm`
      : moment.context,
    turns: moment.turns.map((turn) => ({
      who: turn.sp === "agent" ? "agent" : "client",
      text: turn.t,
    })),
    outcome: moment.outcome,
  };
}

export function ProductPanel({
  autoplay,
  onPinnedChange,
}: {
  autoplay: boolean;
  /** True while the industry field is holding focus or text. */
  onPinnedChange?: (pinned: boolean) => void;
}) {
  const reduce = usePrefersReducedMotion();
  // Which trade is on screen and which capability is on screen are two
  // different questions, so they are two pieces of state rather than one
  // tagged union with a ref remembering the other half: hovering
  // "AI Agents" has to keep whichever trade was already being shown.
  const [industry, setIndustry] = useState(NAV_INDUSTRY_DEFAULT);
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  // Which of the two owns the pane. A typed trade outranks the rows, but
  // only until the visitor previews one — previewing must not destroy what
  // they typed, and the keyboard route back to the field (Shift+Tab across
  // the grid) previews every row on the way.
  const [typed, setTyped] = useState(false);
  const [handedOver, setHandedOver] = useState(false);

  /**
   * The pane demonstrates itself for the two seconds before anyone moves,
   * and then gets out of the way for good. It restarts on the next open,
   * never mid-session: a thing that starts moving again after you have
   * touched it is a thing you have to fight.
   */
  useEffect(() => {
    if (!autoplay || handedOver || reduce) return;
    const id = window.setInterval(() => {
      setIndustry((current) => {
        const at = NAV_INDUSTRIES.findIndex((entry) => entry.slug === current);
        return NAV_INDUSTRIES[(at + 1) % NAV_INDUSTRIES.length].slug;
      });
    }, PRODUCT_MENU.autoplayMs);
    return () => window.clearInterval(id);
  }, [autoplay, handedOver, reduce]);

  const model = useMemo(
    () => resolvePane(activeItem, industry, typed ? draft : ""),
    [activeItem, industry, typed, draft],
  );

  const handOver = () => {
    if (!handedOver) setHandedOver(true);
  };

  // A 282px first column and a 658px second one whose list runs in three
  // 207px columns. Top paddings are set to the caps, less the half-leading
  // an untrimmed line box adds back (4.25px on a 13/18 label).
  return (
    <div className="grid w-[min(940px,calc(100vw-32px))] grid-cols-[282px_minmax(0,1fr)]">
      {/* A — capabilities */}
      <div
        className="pt-[23.75px] pb-[18px] pl-[18px]"
        onPointerMove={handOver}
        onFocusCapture={handOver}
        onKeyDownCapture={handOver}
      >
        {PRODUCT_GROUPS.map((group, index) => (
          <div
            key={group.id}
            role="group"
            aria-labelledby={`nav-${group.id}`}
            className={index > 0 ? "mt-[29.75px]" : undefined}
          >
            <GroupHeading id={`nav-${group.id}`}>{group.label}</GroupHeading>
            <div className="mt-[15.75px] flex flex-col">
              {group.items.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onPreview={() => {
                    setTyped(false);
                    setActiveItem(item.id);
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* B — industries, the call they preview, and the way out */}
      <div
        className="flex min-w-0 flex-col px-[18px] pt-[23.75px] pb-[18px]"
        onPointerMove={handOver}
        onFocusCapture={handOver}
        onKeyDownCapture={handOver}
      >
        <div className="flex items-baseline justify-between gap-[16px]">
          <GroupHeading>{SITE_HEADER.headings.industries}</GroupHeading>
          {/* The industry-agnostic promise, stated in the furniture and
              not only in the list underneath it. */}
          <span className="shrink-0 px-[10px] text-[13px] leading-[18px] text-[var(--cover-muted)]">
            {NAV_ANY_INDUSTRY.note}
          </span>
        </div>
        <IndustryPicker
          variant="grid"
          className="mt-[15.75px]"
          selected={industry}
          hoverIntentMs={PRODUCT_MENU.hoverIntentMs}
          draft={draft}
          onPinnedChange={onPinnedChange}
          onDraft={(value) => {
            setDraft(value);
            setTyped(true);
            setActiveItem(null);
          }}
          onSelect={(slug) => {
            setTyped(false);
            setActiveItem(null);
            setIndustry(slug);
          }}
        />

        {/* C — on the line, under the trades it plays. It takes whatever
            height the capabilities column leaves, so the transcript is
            never cut off to make room for a void. */}
        <CallPane model={model} className="mt-[16px] h-auto min-h-[176px] flex-1" />

        <div className="mt-[10px] flex items-center justify-between gap-[16px]">
          <MenuLink
            href={PRODUCT_MENU.demo.href}
            className="rounded-[8px] px-[10px] py-[2.5px] text-[14px] font-medium leading-[21px] tracking-[0.01em] text-[var(--cover-paper)] transition-colors hover:text-[var(--cover-muted)]"
          >
            {PRODUCT_MENU.demo.label}
          </MenuLink>
          <MenuLink
            href={PRODUCT_MENU.price.href}
            className="rounded-[8px] px-[10px] py-[2.5px] text-[14px] font-medium leading-[21px] tracking-[0.01em] text-[var(--cover-paper)] transition-colors hover:text-[var(--cover-muted)]"
          >
            {PRODUCT_MENU.price.label(TIERS[0].monthly)}
          </MenuLink>
        </div>
      </div>
    </div>
  );
}
