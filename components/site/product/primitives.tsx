import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { IntentLink } from "@/components/site/intent-link";
import { CornerDot } from "@/components/site/corner-dot";

/* ------------------------------------------------------------------ *
 * The light product-page system.
 *
 * Every mega-menu page is set in these few parts: one centred column,
 * sections introduced by a violet eyebrow carrying the cover's corner-dot
 * mark, headings in Onest over Inter body copy, and pill actions.
 * ------------------------------------------------------------------ */

/**
 * A stretch of page below the fold that the browser may leave unrendered
 * until it comes near the screen: no style, layout or paint for it on
 * arrival, and no fonts fetched for text nobody can see yet. `size` is a
 * first guess at its height; once it has rendered, its real height is
 * remembered in place of the guess.
 *
 * Paint is contained to the box, so anything drawn past its edges — a
 * card's shadow — needs the spacing that follows it inside the box too.
 */
export function Deferred({ children, size }: { children: ReactNode; size: number }) {
  return (
    <div className="[content-visibility:auto]" style={{ containIntrinsicSize: `auto ${size}px` }}>
      {children}
    </div>
  );
}

/** The page column. Everything on a product page sits inside one. */
export function Frame({
  children,
  className,
  as: Tag = "div",
  id,
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section";
  id?: string;
}) {
  return (
    <Tag
      id={id}
      className={cn(
        "relative mx-auto w-[calc(100%-2rem)] max-w-[1176px] sm:w-[calc(100%-3rem)] lg:w-[calc(100%-5rem)]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/** A hairline across the column. */
export function Rule({ className }: { className?: string }) {
  return (
    <Frame className={cn("h-px", className)}>
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-pp-rule" />
    </Frame>
  );
}

/** Vertical breathing room between sections. */
export function Gap({ className }: { className?: string }) {
  return <Frame className={cn("h-20 md:h-32", className)}>{null}</Frame>;
}

export function PillLink({
  href,
  children,
  variant = "primary",
  size = "md",
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
  size?: "sm" | "md";
  className?: string;
}) {
  const external = /^(tel:|mailto:|https?:)/.test(href);
  const classes = cn(
    "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full whitespace-nowrap transition-[background-color,color,scale] duration-200 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink",
    size === "md" ? "h-11 px-5 text-base" : "h-9 px-3.5 text-sm",
    variant === "primary"
      ? "bg-pp-ink text-white hover:bg-[#2b2a28]"
      : "pp-shadow-btn bg-white text-pp-ink hover:bg-pp-card",
    className,
  );
  return external ? (
    <a href={href} className={classes}>
      {children}
    </a>
  ) : (
    <IntentLink href={href} className={classes}>
      {children}
    </IntentLink>
  );
}

export function SectionTitle({
  children,
  className,
  as: Tag = "h2",
  size = Tag === "h1" ? "h1" : "h2",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  /** `p` is for an invisible sizer set exactly like a heading beside it. */
  as?: "h1" | "h2" | "p";
  size?: "h1" | "h2";
  "aria-hidden"?: boolean;
}) {
  return (
    <Tag
      {...rest}
      className={cn(
        "pp-display text-balance",
        size === "h1"
          ? "text-[36px] leading-[40px] tracking-[-0.02em] md:text-[48px] md:leading-[52px]"
          : "text-[28px] leading-[34px] md:text-[36px] md:leading-[42px]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/** The small violet label that opens a section, marked with the cover's corner dot. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "flex items-center gap-2 text-[12px] leading-4 font-medium tracking-[0.14em] text-pp-accent uppercase",
        className,
      )}
    >
      <CornerDot className="size-2.5" />
      {children}
    </p>
  );
}

/** Eyebrow and heading for every section below the hero. */
export function SectionHeading({
  eyebrow,
  children,
  className,
  titleClassName,
}: {
  eyebrow: string;
  children: ReactNode;
  className?: string;
  titleClassName?: string;
}) {
  return (
    <div className={className}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2
        className={cn(
          "pp-display mt-4 text-[30px] leading-[36px] tracking-[-0.025em] text-balance md:text-[40px] md:leading-[46px]",
          titleClassName,
        )}
        // Inline: `.pp-display` sets the hero's 360 outside Tailwind's layers,
        // which would beat a weight utility.
        style={{ fontWeight: 480 }}
      >
        {children}
      </h2>
    </div>
  );
}

export type OrbTint = { a: string; b: string; c: string };

/**
 * A voice sphere. Pure CSS; `speaking` makes it breathe.
 *
 * Given a `mesh` — five colours, darkest first, usually the palette of the
 * surface it sits on — it is painted as a moving mesh gradient under a film
 * of grain instead of the three-light `tint` version.
 */
export function Orb({
  tint,
  mesh,
  speaking = false,
  className,
  style,
}: {
  tint?: OrbTint;
  mesh?: readonly string[];
  speaking?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  if (mesh && mesh.length > 0) {
    // Pads a short palette by repeating its ends, so every slot has a colour.
    const m = Array.from({ length: 5 }, (_, i) =>
      mesh[Math.round((i * (mesh.length - 1)) / 4)],
    );
    return (
      <span
        aria-hidden
        data-speaking={speaking ? "" : undefined}
        className={cn("pp-orb pp-orb-mesh block", className)}
        style={
          {
            "--m0": m[0],
            "--m1": m[1],
            "--m2": m[2],
            "--m3": m[3],
            "--m4": m[4],
            ...style,
          } as CSSProperties
        }
      >
        <span className="pp-mesh-flow" />
        <span className="pp-mesh-flow pp-mesh-flow-b" />
        <span className="pp-mesh-shade" />
        <span className="pp-noise" />
      </span>
    );
  }

  const t = tint ?? ORB_TINTS.dusk;
  return (
    <span
      aria-hidden
      data-speaking={speaking ? "" : undefined}
      className={cn("pp-orb block", className)}
      style={
        {
          "--orb-a": t.a,
          "--orb-b": t.b,
          "--orb-c": t.c,
          ...style,
        } as CSSProperties
      }
    >
      <span className="pp-grain absolute inset-0 z-10 opacity-60" />
    </span>
  );
}

/**
 * Vivid palettes for mesh orbs that do not sit on a coloured panel.
 *
 * Not sorted by lightness like a panel's palette: each slot is placed for
 * where the mesh puts it — m0 the deep accent low on the right, m1 the
 * middle, m2 the body, m3 the lower left, m4 the light upper left.
 */
export const ORB_MESHES = {
  lagoon: ["#1f6fd6", "#46a8f0", "#5da544", "#8fcf5e", "#e9fbef"],
  sunset: ["#e0433a", "#f47a3c", "#f39ac2", "#ffc46b", "#fff1d6"],
  violet: ["#4b2bd6", "#8b5cf6", "#e27ad6", "#7cc0ff", "#f3ecff"],
  citrus: ["#138a64", "#4fc98a", "#d9e84c", "#ffd84d", "#fffbe3"],
} satisfies Record<string, readonly string[]>;

/** Tints shared across the product pages, so an orb means the same thing everywhere. */
export const ORB_TINTS = {
  lagoon: { a: "#2bd4c4", b: "#2f6fe0", c: "#8ec9e8" },
  moss: { a: "#b9e36b", b: "#2e9b7a", c: "#9fd3b4" },
  dusk: { a: "#c08cf2", b: "#551a89", c: "#b8a2dc" },
  ember: { a: "#ffc27a", b: "#e0663a", c: "#f2b58e" },
  slate: { a: "#b8c6dc", b: "#4a5a78", c: "#9aa8bd" },
} satisfies Record<string, OrbTint>;
