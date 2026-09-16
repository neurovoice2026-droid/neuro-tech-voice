"use client";

import { useState } from "react";
import { SITE_HEADER, SOLUTIONS_MENU, SOLUTION_ITEMS } from "@/lib/site";
import { GroupHeading, ItemCard, MenuLink } from "./parts";

/* ------------------------------------------------------------------ *
 * Solutions — five offers, and what actually arrives when you buy one.
 *
 * No autoplay here. Product is a demo; this is a considered read, and a
 * plate that changed under someone comparing two offers would be working
 * against them.
 * ------------------------------------------------------------------ */

export function SolutionsPanel() {
  const [activeId, setActiveId] = useState(SOLUTION_ITEMS[0].id);
  const active = SOLUTION_ITEMS.find((item) => item.id === activeId) ?? SOLUTION_ITEMS[0];

  // 282px columns, 864px across. The list keeps the first column and the
  // build sheet spans the other two.
  return (
    <div className="grid w-[min(864px,calc(100vw-32px))] grid-cols-[282px_minmax(0,1fr)]">
      <div className="flex flex-col pt-[23.75px] pb-[18px] pl-[18px]">
        {/* Product's columns are headed; this one was the only list in
            either panel without a name over it. */}
        <GroupHeading>{SITE_HEADER.headings.solutions}</GroupHeading>
        <div className="mt-[15.75px] flex flex-col">
          {SOLUTION_ITEMS.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              describedBy={`sol-${item.id}-desc`}
              onPreview={() => setActiveId(item.id)}
            />
          ))}
        </div>

        {/* The plate is decorative, so everything only it says is mirrored
            here for a screen reader — without lengthening the link's own
            accessible name. */}
        <div className="sr-only">
          {SOLUTION_ITEMS.map((item) => (
            <span key={item.id} id={`sol-${item.id}-desc`}>
              {item.promise} {item.deliverables.join(". ")}.
            </span>
          ))}
        </div>

        <div className="mt-auto pt-[16px]">
          <MenuLink
            href={SOLUTIONS_MENU.footer.link.href}
            className="block rounded-[8px] px-[10px] py-[2.5px] text-[14px] font-medium leading-[21px] tracking-[0.01em] text-[var(--cover-paper)] transition-colors hover:text-[var(--cover-muted)]"
          >
            <span className="font-normal text-[var(--cover-muted)]">
              {SOLUTIONS_MENU.footer.text}
            </span>{" "}
            {SOLUTIONS_MENU.footer.link.label}
          </MenuLink>
        </div>
      </div>

      {/* The build sheet. Stretched to the list beside it, which never
          changes height, with a clamped promise: it follows the pointer down
          five offers and the popup must not breathe. */}
      <div className="p-[18px]">
        <div className="flex h-full flex-col rounded-[12px] bg-[var(--cover-panel)] p-[20px]">
          <div key={active.id} className="hdr-pane-swap flex min-h-0 flex-1 flex-col">
            <p aria-hidden className="text-[13px] font-medium leading-[18px] text-[var(--cover-muted)]">
              {SOLUTIONS_MENU.sheetKicker(active.label)}
            </p>

            <p
              aria-hidden
              className="mt-[8px] line-clamp-2 text-[17px] font-medium leading-[25px] tracking-[0.01em] text-balance text-[var(--cover-paper)]"
            >
              {active.promise}
            </p>

            <ul aria-hidden className="mt-[12px] flex flex-col gap-[4px]">
              {active.deliverables.map((line) => (
                <li
                  key={line}
                  className="text-[14px] leading-[21px] tracking-[0.01em] text-[var(--cover-paper)]"
                >
                  {line}
                </li>
              ))}
            </ul>

            <div aria-hidden className="mt-[14px] flex flex-wrap gap-[6px]">
              {active.stack.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-[var(--cover-paper)]/10 px-[10px] text-[12px] leading-[22px] text-[var(--cover-muted)]"
                >
                  {chip}
                </span>
              ))}
            </div>

            <div className="mt-auto pt-[16px]">
              <MenuLink
                href={SOLUTIONS_MENU.cta.href(active.id)}
                className="flex h-[36px] items-center justify-center rounded-full bg-[var(--cover-paper)] px-[16px] text-[14px] font-medium text-[var(--cover-ink)] transition-colors duration-300 hover:bg-[var(--cover-brand)]"
              >
                {SOLUTIONS_MENU.cta.label}
                <span className="sr-only"> about {active.label}</span>
              </MenuLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
