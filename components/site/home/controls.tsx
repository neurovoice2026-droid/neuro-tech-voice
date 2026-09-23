"use client";

import { useRef, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { Minus, Pause, Play, Plus, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 * The landing's controls: a round transport button, radio groups with
 * one tab stop and arrow keys, the segmented switch, the chip colours,
 * and a chip rail that scrolls sideways on its own without ever moving
 * the page.
 *
 * Every target is at least 44px to a finger even where the drawn shape
 * is smaller, and every focus ring shows on white, on the dark band and
 * on the deep panel. Colour changes only with state: a selection eases
 * its fill and text over 180ms, and nothing else about a control moves
 * but its press.
 * ------------------------------------------------------------------ */

const ICONS = { play: Play, pause: Pause, replay: RotateCcw, minus: Minus, plus: Plus } as const;

/** A focus ring that reads on white stock. */
export const RING_LIGHT = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink";
/** The same ring on the dark band and the deep panel. */
export const RING_DARK = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

/**
 * A chip's colours by state. One chip language for the whole body: the
 * language picker, the after-call picker, the knowledge questions.
 * Selected is an electric fill with white text (5.70:1); unselected is
 * the chip grey on white, or white on a stage, where the chip grey would
 * vanish. Pair with `CHIP.ease`; the chip's shape stays the section's own.
 */
export const CHIP = {
  on: "bg-(--home-electric) text-white",
  off: "bg-(--home-chip) text-(--home-ink) hover:bg-(--home-stage)",
  offOnStage: "bg-white text-(--home-ink) hover:bg-(--home-wash)",
  ease: "transition-[background-color,color] duration-180 ease-[cubic-bezier(0.16,1,0.3,1)]",
} as const;

/** `CHIP.on` or the unselected colours for the ground the chip sits on. */
export function chipTone(on: boolean, ground: "white" | "stage" = "white") {
  return on ? CHIP.on : ground === "stage" ? CHIP.offOnStage : CHIP.off;
}

const ROUND_TONE = {
  light: cn("pp-shadow-btn bg-white text-pp-ink hover:bg-pp-card", RING_LIGHT),
  dark: cn("text-(--home-paper) ring-1 ring-white/15 hover:bg-white/[0.08]", RING_DARK),
  // On `.home-deep`: a faint white disc, so the control reads as one.
  deep: cn("bg-white/[0.08] text-(--home-on-deep) ring-1 ring-white/[0.14] hover:bg-white/[0.14]", RING_DARK),
} as const;

/** Each tone's resting fill, as its hover: what an aria-disabled button keeps under the pointer. */
const HOVER_AT_REST = {
  light: "hover:bg-white",
  dark: "hover:bg-transparent",
  deep: "hover:bg-white/[0.08]",
} as const;

export function RoundButton({
  icon,
  label,
  onClick,
  tone = "light",
  size = 40,
  pressed,
  disabled = false,
  ariaDisabled = false,
  className,
}: {
  icon: keyof typeof ICONS;
  /** The button's whole accessible name: it shows only an icon. */
  label: string;
  onClick: () => void;
  tone?: "light" | "dark" | "deep";
  size?: 40 | 44;
  /** For a true on/off toggle only; a button whose label changes (Pause → Play) leaves it unset. */
  pressed?: boolean;
  /** Truly unavailable: out of the tab order. */
  disabled?: boolean;
  /**
   * Does nothing right now but keeps its place in the tab order, as a
   * stepper at the end of its range: drawn disabled, announced as
   * disabled, and a press is ignored. Focus stays put, which the native
   * attribute would not allow.
   */
  ariaDisabled?: boolean;
  className?: string;
}) {
  const Icon = ICONS[icon];
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      aria-disabled={ariaDisabled || undefined}
      disabled={disabled}
      onClick={ariaDisabled ? undefined : onClick}
      className={cn(
        "relative grid shrink-0 place-items-center rounded-full transition-[background-color,color,scale] duration-200 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40",
        "aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:active:scale-100",
        // The 40px disc still takes a 44px tap.
        "before:absolute before:-inset-0.5 before:rounded-full",
        size === 44 ? "size-11" : "size-10",
        ROUND_TONE[tone],
        // No hover fill on a control that would do nothing.
        ariaDisabled && HOVER_AT_REST[tone],
        className,
      )}
    >
      <Icon aria-hidden className={cn("size-4", (icon === "play" || icon === "pause") && "fill-current")} />
    </button>
  );
}

export type RadioItemProps = {
  role: "radio";
  "aria-checked": boolean;
  tabIndex: 0 | -1;
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
  onClick: () => void;
  ref: (el: HTMLElement | null) => void;
};

/**
 * A radio group's keyboard: one tab stop (the checked item, or the first
 * while none is), arrows move and check at once, wrapping at the ends,
 * Home and End jump. Both arrow pairs work in either orientation, as the
 * ARIA radio pattern has it. `via` tells a key from a click, so a section
 * can debounce expensive work behind a held arrow key but not behind a
 * click (Space and Enter arrive as clicks).
 */
export function useRovingRadio({
  count,
  index,
  orientation,
  onChange,
}: {
  count: number;
  index: number;
  orientation: "vertical" | "horizontal";
  onChange: (i: number, via: "key" | "pointer") => void;
}) {
  const items = useRef<(HTMLElement | null)[]>([]);
  const stop = index >= 0 && index < count ? index : 0;

  function getItemProps(i: number): RadioItemProps {
    return {
      role: "radio",
      "aria-checked": i === index,
      tabIndex: i === stop ? 0 : -1,
      onKeyDown: (e) => {
        const last = count - 1;
        const to =
          e.key === "ArrowRight" || e.key === "ArrowDown"
            ? i === last ? 0 : i + 1
            : e.key === "ArrowLeft" || e.key === "ArrowUp"
              ? i === 0 ? last : i - 1
              : e.key === "Home"
                ? 0
                : e.key === "End"
                  ? last
                  : -1;
        if (to < 0) return;
        e.preventDefault();
        onChange(to, "key");
        items.current[to]?.focus();
      },
      onClick: () => onChange(i, "pointer"),
      ref: (el) => {
        items.current[i] = el;
      },
    };
  }

  return {
    getItemProps,
    /** Spread on the element that wraps the radios. */
    groupProps: { role: "radiogroup", "aria-orientation": orientation } as const,
  };
}

/**
 * Two or three choices in one pill: the house tabs look, as a radio
 * group, on a chip-grey track. The segments share the width equally, so
 * the white pill under the checked one glides by whole widths with no
 * measuring; the checked label is violet (7.10:1 on the pill), the rest
 * muted (5.69:1 on the track).
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  const index = options.findIndex((o) => o.id === value);
  const { getItemProps, groupProps } = useRovingRadio({
    count: options.length,
    index,
    orientation: "horizontal",
    onChange: (i) => onChange(options[i].id),
  });

  return (
    <div
      {...groupProps}
      aria-label={label}
      className={cn(
        "relative inline-grid auto-cols-fr grid-flow-col rounded-full bg-(--home-chip) p-1 shadow-[0_0_0_1px_rgb(24_16_40/0.06)]",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pp-shadow-btn absolute inset-y-1 left-1 rounded-full bg-white transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          index < 0 && "hidden",
        )}
        style={{
          width: `calc((100% - 8px) / ${options.length})`,
          transform: `translateX(${Math.max(0, index) * 100}%)`,
        }}
      />
      {options.map((o, i) => (
        <button
          key={o.id}
          type="button"
          {...getItemProps(i)}
          className={cn(
            "relative h-9 rounded-full px-4 text-sm whitespace-nowrap transition-colors duration-180 ease-[cubic-bezier(0.16,1,0.3,1)]",
            // The container's padding counts: a 44px-tall target.
            "before:absolute before:inset-x-0 before:-inset-y-1",
            RING_LIGHT,
            i === index ? "text-(--home-violet)" : "text-pp-muted hover:text-pp-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * A row of chips that scrolls sideways when it outgrows the column,
 * snapping each chip to the middle. On phones it runs to the screen's
 * edges; its ends fade only while there is more to scroll that way
 * (home.css). Given a label it is a radio group, for `useRovingRadio`
 * items. Every child snaps to centre, to match `centreInRail`.
 */
export function ChipRail({
  label,
  labelledBy,
  railRef,
  children,
  className,
}: {
  label?: string;
  labelledBy?: string;
  railRef?: Ref<HTMLDivElement>;
  children: ReactNode;
  className?: string;
}) {
  const group = Boolean(label || labelledBy);
  return (
    <div
      ref={railRef}
      role={group ? "radiogroup" : undefined}
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-orientation={group ? "horizontal" : undefined}
      className={cn(
        "home-fade-x flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain [scrollbar-width:none] *:shrink-0 *:snap-center [&::-webkit-scrollbar]:hidden",
        // Room for the focus ring, which the scroll box would otherwise clip.
        "-mx-1 px-1 py-1 max-md:-mx-4 max-md:px-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Scrolls the rail so `item` sits in its middle. The rail only: the page
 * never moves, which asking the item to scroll itself into view cannot
 * promise (it scrolls every scrollable ancestor, the page included).
 */
export function centreInRail(rail: HTMLElement, item: HTMLElement, reduce: boolean) {
  const r = rail.getBoundingClientRect();
  const it = item.getBoundingClientRect();
  rail.scrollTo({
    left: rail.scrollLeft + (it.left - r.left) - (r.width - it.width) / 2,
    behavior: reduce ? "instant" : "smooth",
  });
}

/**
 * The invisible copy that holds a cycling block at its tallest: put the
 * longest variant in it, in the same grid cell as the live one.
 */
export function Sizer({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  /** `span` inside phrasing content. */
  as?: "div" | "span";
}) {
  return (
    <Tag aria-hidden className={cn("invisible [grid-area:1/1]", className)}>
      {children}
    </Tag>
  );
}
