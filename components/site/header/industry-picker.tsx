"use client";

import Form from "next/form";
import { useId, useRef } from "react";
import { CornerDownLeft, Plus } from "lucide-react";
import { NAV_ANY_INDUSTRY, NAV_INDUSTRIES } from "@/lib/site";
import { cn } from "@/lib/utils";
import { MenuLink } from "./parts";

/* ------------------------------------------------------------------ *
 * The industries picker, in both of its shapes.
 *
 * `grid` is the desktop panel's second column: sixteen trades that are
 * real links. `strip` is the sheet's: the same sixteen as chips that
 * *select* rather than navigate, because on a phone the preview is the
 * only way to see what picking one would mean.
 *
 * The field underneath is the point of the whole column. The product is
 * industry-agnostic, so a list of sixteen has to end with a way to say
 * "not one of those" — and what a visitor types goes through the same
 * `customIndustry()` helper the use-cases section uses, so an unlisted
 * trade gets an honest generic rather than a fabricated one.
 * ------------------------------------------------------------------ */

type Props = {
  variant: "grid" | "strip";
  selected: string;
  onSelect: (slug: string) => void;
  draft: string;
  onDraft: (value: string) => void;
  /** True while the field has focus or content — see the typing exception. */
  onPinnedChange?: (pinned: boolean) => void;
  hoverIntentMs?: number;
  className?: string;
};

export function IndustryPicker({
  variant,
  selected,
  onSelect,
  draft,
  onDraft,
  onPinnedChange,
  hoverIntentMs = 0,
  className,
}: Props) {
  const fieldId = useId();
  const intent = useRef(0);
  const focused = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // A diagonal sweep across sixteen rows should not strobe the preview,
  // so the pointer has to rest on one. Focus switches immediately: a
  // keyboard is already deliberate.
  const scheduleIntent = (slug: string) => {
    window.clearTimeout(intent.current);
    intent.current = window.setTimeout(() => onSelect(slug), hoverIntentMs);
  };
  const cancelIntent = () => window.clearTimeout(intent.current);

  const pin = (next: boolean) => {
    focused.current = next;
    onPinnedChange?.(next || draft.trim().length > 0);
  };

  const field = (
    <Form
      action={NAV_ANY_INDUSTRY.action}
      aria-label={NAV_ANY_INDUSTRY.formLabel}
      className={cn(
        "flex items-center border border-[var(--cover-paper)]/15 bg-[var(--cover-paper)]/[0.03]",
        variant === "grid"
          ? "mt-[12px] h-[40px] gap-[8px] rounded-[8px] pl-[10px] pr-[4px]"
          : "mt-[0.75em] h-[2.5em] gap-[0.5em] rounded-[0.5em] pl-[0.75em] pr-[0.35em]",
      )}
    >
      <label htmlFor={fieldId} className="sr-only">
        {NAV_ANY_INDUSTRY.fieldLabel}
      </label>
      <input
        id={fieldId}
        ref={inputRef}
        name={NAV_ANY_INDUSTRY.param}
        value={draft}
        maxLength={NAV_ANY_INDUSTRY.maxLength}
        placeholder={NAV_ANY_INDUSTRY.placeholder}
        autoComplete="off"
        onChange={(event) => {
          onDraft(event.target.value);
          onPinnedChange?.(focused.current || event.target.value.trim().length > 0);
        }}
        onFocus={() => pin(true)}
        onBlur={() => pin(false)}
        onKeyDown={(event) => {
          // The panel's composite walks rows with the arrow keys, which
          // would otherwise take the caret out of the field mid-word.
          // Escape is deliberately left alone — the way out never closes.
          if (
            ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(
              event.key,
            )
          ) {
            event.stopPropagation();
          }
        }}
        // max(16px, …) so iOS does not zoom the viewport on focus.
        style={{ fontSize: variant === "grid" ? "14px" : "max(16px, 0.8125em)" }}
        className={cn(
          "min-w-0 flex-1 bg-transparent text-[var(--cover-paper)] outline-none",
          variant === "grid"
            ? "placeholder:text-[var(--cover-muted)]"
            : "placeholder:text-[var(--cover-paper)]/60",
        )}
      />
      <button
        type="submit"
        disabled={draft.trim().length < NAV_ANY_INDUSTRY.minLength}
        // Before anything is typed there is no trade to name, and
        // "See it for Your industry" is not a sentence.
        aria-label={
          draft.trim()
            ? NAV_ANY_INDUSTRY.submitLabel(draft.trim())
            : NAV_ANY_INDUSTRY.formLabel
        }
        className={cn(
          "grid shrink-0 place-items-center text-[var(--cover-paper)]/70 transition-colors hover:bg-[var(--cover-paper)]/10 hover:text-[var(--cover-paper)] disabled:pointer-events-none disabled:opacity-35",
          variant === "grid"
            ? "h-[30px] rounded-[6px] px-[10px] text-[13px] font-medium"
            : "size-[1.85em] rounded-[0.35em]",
        )}
      >
        {/* The desktop menu carries no icons, so there the key is a word. */}
        {variant === "grid" ? (
          NAV_ANY_INDUSTRY.submit
        ) : (
          <CornerDownLeft className="size-[0.875em]" strokeWidth={1.75} aria-hidden />
        )}
      </button>
    </Form>
  );

  if (variant === "strip") {
    return (
      <div className={className}>
        <div className="hdr-strip -mx-[1.5em] flex gap-[0.5em] overflow-x-auto px-[1.5em] pb-[0.15em]">
          {NAV_INDUSTRIES.map((industry) => {
            const Icon = industry.icon;
            const active = industry.slug === selected && draft.trim().length === 0;
            return (
              <button
                key={industry.slug}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  onDraft("");
                  onSelect(industry.slug);
                }}
                className={cn(
                  "flex h-[2.5em] shrink-0 scroll-ml-[1.5em] snap-start items-center gap-[0.45em] rounded-full border px-[0.875em] text-[0.875em] transition-colors",
                  active
                    ? "border-transparent bg-[var(--cover-paper)] text-[var(--cover-ink)]"
                    : "border-[var(--cover-paper)]/15 text-[var(--cover-paper)]/85",
                )}
              >
                <Icon className="size-[1em] shrink-0" strokeWidth={1.75} aria-hidden />
                {industry.label}
              </button>
            );
          })}
          {/* The last chip in a strip of chips has to behave like one: it
              hands the visitor to the field, which is the only place an
              unlisted trade can be said. */}
          <button
            type="button"
            onClick={() => inputRef.current?.focus()}
            className="flex h-[2.5em] shrink-0 items-center gap-[0.45em] rounded-full border border-dashed border-[var(--cover-paper)]/25 px-[0.875em] text-[0.875em] text-[var(--cover-paper)]/70"
          >
            <Plus className="size-[1em]" strokeWidth={1.75} aria-hidden />
            Any industry
          </button>
        </div>
        {field}
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      {/* DOM order runs down column one then column two, so what Tab and
          the arrow keys walk is what the eye reads. */}
      {/* Three columns of six: 14/21 links, 2.5px of padding around the
          line box. */}
      <div className="grid grid-flow-col grid-cols-3 grid-rows-6">
        {NAV_INDUSTRIES.map((industry) => (
          <MenuLink
            key={industry.slug}
            href={`/industries/${industry.slug}`}
            onPointerEnter={() => scheduleIntent(industry.slug)}
            onPointerLeave={cancelIntent}
            onFocus={() => {
              cancelIntent();
              onSelect(industry.slug);
            }}
            className="block min-w-0 truncate rounded-[8px] px-[10px] py-[2.5px] text-[14px] font-medium leading-[21px] tracking-[0.01em] text-[var(--cover-paper)] transition-colors hover:text-[var(--cover-muted)]"
          >
            {industry.label}
          </MenuLink>
        ))}
      </div>
      {field}
    </div>
  );
}
