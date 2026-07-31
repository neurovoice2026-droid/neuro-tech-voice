"use client";

import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal, WordReveal } from "./reveal";

/**
 * Filled disc with a rounded-square bite out of it.
 *
 * The cover's punctuation mark: it corners the primary button and divides
 * the colophon strip. Shared so anything continuing the cover downward
 * carries the same mark rather than an approximation of it.
 */
export function CornerDot({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 6 6" fill="none" aria-hidden className={className}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3 0a3 3 0 110 6 3 3 0 010-6ZM1.493 1.167a.326.326 0 00-.326.326v3.014c0 .18.146.326.326.326h3.014a.326.326 0 00.326-.326V1.493a.326.326 0 00-.326-.326H1.493Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Small purple pill label above a section title. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
      {children}
    </span>
  );
}

/** Reusable centered section header (eyebrow + title + sub). */
export function SectionHeader({
  eyebrow,
  title,
  sub,
  align = "center",
  className,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  align?: "center" | "start";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      <Reveal>
        <Eyebrow>{eyebrow}</Eyebrow>
      </Reveal>
      <WordReveal
        text={title}
        delay={0.05}
        as="h2"
        className="max-w-2xl text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-[2.7rem]"
      />
      {sub && (
        <Reveal
          delay={0.12}
          className="max-w-xl text-pretty text-base leading-relaxed text-muted-foreground"
        >
          {sub}
        </Reveal>
      )}
    </div>
  );
}

/**
 * A bullet on the cover's stock.
 *
 * The light-theme `CheckItem` below in `rem` and `--primary`; this one on
 * --cover-panel in `em`, so it scales with the cover's fluid base like
 * everything else inside `.cover`. Shared rather than copied because the
 * interior spread and the demo spread run the same list treatment, and two
 * inline copies would drift the first time one of them was tuned.
 */
export function CoverCheck({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-[0.7em]">
      <span className="mt-[0.1em] grid size-[1.35em] shrink-0 place-items-center rounded-full bg-[var(--cover-brand-lit)]/14 text-[var(--cover-brand-lit)]">
        <Check className="size-[0.8em]" strokeWidth={3} />
      </span>
      <span className="text-[0.95em] leading-[1.5] text-[var(--cover-paper)]/80">
        {children}
      </span>
    </li>
  );
}

/** A bullet with a purple check chip. */
export function CheckItem({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <Check className="size-3.5" strokeWidth={2.5} />
      </span>
      <span className="text-sm leading-relaxed text-muted-foreground sm:text-[0.95rem]">
        {children}
      </span>
    </li>
  );
}
