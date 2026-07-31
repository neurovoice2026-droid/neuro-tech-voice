"use client";

import { INTEGRATIONS, INTEGRATIONS_INTRO } from "@/lib/site";
import { CornerDot } from "./ui";

/**
 * The colophon strip.
 *
 * A magazine cover does not stop at the image — it runs a technical line
 * under it: the credits, the plate, the issue. That is what this is. It
 * stays on the cover's ink so the fold below the portrait is a change of
 * register rather than a change of site, and it inherits the cover's own
 * tokens and fluid em-scale by wearing the same `.cover` class.
 *
 * Everything here is the hero's vocabulary reused, not restated: the
 * corner-dot as punctuation, the mono technical caps of the clock strip,
 * the display face at tight tracking, the hairline rules, the grain.
 */
export function Marquee() {
  // Duplicated so the -50% translate loops seamlessly.
  const items = [...INTEGRATIONS, ...INTEGRATIONS];
  const count = String(INTEGRATIONS.length).padStart(2, "0");

  return (
    <section
      aria-label={INTEGRATIONS_INTRO.title}
      className="cover cover-grain relative isolate overflow-clip bg-[var(--cover-ink)] text-[var(--cover-paper)]"
      style={{ fontFamily: "var(--font-display)" }}
    >
      {/* Hairlines, not borders: the cover has no boxes in it. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-[var(--cover-paper)]/12"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px bg-[var(--cover-paper)]/12"
      />

      <div className="flex flex-col gap-[1.4em] py-[2.2em] md:flex-row md:items-center md:gap-[2.4em] md:py-[1.8em]">
        {/* Plate: the same numeric register as the cover's clock and era. */}
        <div className="flex shrink-0 items-center gap-[0.9em] px-[1.6em] md:pr-0">
          <span className="flex items-center gap-[0.5em] text-[0.7em] uppercase leading-none tracking-[0.24em] opacity-45">
            <CornerDot className="size-[0.55em]" />
            {INTEGRATIONS_INTRO.eyebrow}
          </span>
          <span className="text-[0.7em] leading-none tabular-nums opacity-45">
            {count}
          </span>
          <span
            aria-hidden
            className="hidden h-[1.6em] w-px bg-[var(--cover-paper)]/15 md:block"
          />
          <p className="hidden max-w-[15em] text-balance text-[0.85em] leading-[1.4] tracking-[-0.02em] opacity-70 lg:block">
            {INTEGRATIONS_INTRO.title}
          </p>
        </div>

        {/* The crawl. Masked at both ends so names arrive out of the dark
            and leave into it, rather than clipping at a hard edge. */}
        <div className="mask-edges-x relative min-w-0 flex-1 overflow-hidden">
          <ul className="flex w-max animate-marquee items-center gap-[2.4em] pr-[2.4em] hover:[animation-play-state:paused] motion-reduce:animate-none motion-reduce:overflow-x-auto">
            {items.map((it, i) => {
              const Icon = it.icon;
              return (
                <li
                  key={i}
                  className="group flex shrink-0 items-center gap-[0.7em]"
                >
                  <Icon
                    className="size-[0.95em] shrink-0 opacity-40 transition-[opacity,color] duration-500 group-hover:opacity-100 group-hover:text-[var(--cover-brand)]"
                    strokeWidth={1.5}
                  />
                  <span className="whitespace-nowrap text-[1.15em] leading-none tracking-[-0.035em] opacity-80 transition-opacity duration-500 group-hover:opacity-100">
                    {it.label}
                  </span>
                  {/* Punctuation between entries, never after the last one
                      visually — the loop makes every item interior. */}
                  <CornerDot
                    aria-hidden
                    className="ml-[1.7em] size-[0.34em] shrink-0 opacity-25"
                  />
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
