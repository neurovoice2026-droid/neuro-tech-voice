import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { INT_GOOGLE, INT_RECIPES } from "@/lib/pages/integrations";
import { Frame, Rule, SectionHeading } from "../primitives";

/* ------------------------------------------------------------------ *
 * Two quieter sections: Google Workspace, labelled as the beta it is, and a
 * handful of rules to start with — every one of them buildable today.
 * ------------------------------------------------------------------ */

export function IntGoogle() {
  return (
    <>
      <Frame className="grid gap-6 px-6 pb-10 md:px-12 md:pb-14 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <SectionHeading eyebrow={INT_GOOGLE.eyebrow} className="max-w-[560px]">
          {INT_GOOGLE.title}
        </SectionHeading>
        <p className="max-w-[440px] text-[15px] leading-[22px] text-pp-muted">{INT_GOOGLE.body}</p>
      </Frame>
      <Frame className="grid gap-4 px-4 sm:grid-cols-2 md:px-6 lg:grid-cols-4">
        {INT_GOOGLE.items.map((g) => (
          <div key={g.id} className="flex flex-col rounded-[24px] bg-pp-card p-6">
            <div className="flex items-center justify-between gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-white shadow-[0_0_0_1px_rgb(24_16_40/0.06)]">
                <Image src={g.logo} alt="" width={24} height={24} className="size-6" />
              </span>
              <span className="rounded-full bg-[#551a89]/10 px-2.5 py-1 text-[11px] leading-4 font-medium tracking-[0.04em] text-[#551a89]">
                {INT_GOOGLE.badge}
              </span>
            </div>
            <h3 className="mt-6 text-base leading-6">{g.label}</h3>
            <p className="mt-1 text-[14px] leading-[21px] text-pp-muted">{g.will}</p>
          </div>
        ))}
      </Frame>
      <Frame className="px-6 pt-5 md:px-12">
        <p className="max-w-[760px] text-[12px] leading-[18px] text-pp-muted">{INT_GOOGLE.trademarks}</p>
      </Frame>
    </>
  );
}

export function IntRecipes() {
  return (
    <>
      <Frame className="px-6 pb-10 md:px-12 md:pb-14">
        <SectionHeading eyebrow={INT_RECIPES.eyebrow} className="max-w-[640px]">
          {INT_RECIPES.title}
        </SectionHeading>
      </Frame>
      <Rule />
      <Frame as="section" className="px-2 md:px-6">
        <ul>
          {INT_RECIPES.items.map((r, i) => (
            <li
              key={r.id}
              className="group grid gap-3 border-b border-pp-rule px-4 py-6 transition-colors duration-300 last:border-b-0 hover:bg-pp-band md:grid-cols-[48px_minmax(0,1.2fr)_minmax(0,1fr)] md:items-center md:gap-6 md:px-6"
            >
              <span className="font-[family-name:var(--font-pp-cinema)] text-[26px] leading-none text-[#551a89]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="flex flex-wrap items-center gap-1.5 text-[13px] leading-4">
                <span className="rounded-full border border-pp-hair bg-white px-2.5 py-1.5">{r.trigger}</span>
                <ArrowRight
                  aria-label="then"
                  className="size-3.5 text-pp-muted transition-transform duration-300 group-hover:translate-x-0.5"
                />
                {r.actions.map((a) => (
                  <span key={a} className="rounded-full bg-[#551a89]/10 px-2.5 py-1.5 text-[#3d1266]">
                    {a}
                  </span>
                ))}
              </p>
              <p className="text-[15px] leading-[22px] text-pp-muted">{r.why}</p>
            </li>
          ))}
        </ul>
      </Frame>
      <Rule />
    </>
  );
}
