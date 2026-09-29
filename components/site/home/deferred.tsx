import type { CSSProperties, ReactNode } from "react";

/** A section's real height at each Tailwind tier: under md, md, lg, xl. */
export type Reserve = readonly [phone: number, tablet: number, laptop: number, desktop: number];

/**
 * `Deferred` (product/primitives) with a reserve per breakpoint.
 *
 * The product pages are short enough that one reserve, sized at 1440, is
 * close everywhere. The landing is not: its sections run 40–90% taller on
 * a phone, and `.pp` turns scroll anchoring off, so a single desktop
 * reserve put `/#pricing` and the FAQ's in-page links hundreds of pixels
 * off on a phone while the sections above them were still skipped. Each
 * tier gets its own measured height; `auto` then keeps whatever a section
 * last rendered at, so the reserve only matters before first paint.
 */
export function HomeDeferred({ children, size }: { children: ReactNode; size: Reserve }) {
  const [sm, md, lg, xl] = size;
  const style = {
    "--home-cis-sm": `${sm}px`,
    "--home-cis-md": `${md}px`,
    "--home-cis-lg": `${lg}px`,
    "--home-cis-xl": `${xl}px`,
  } as CSSProperties;
  return (
    <div className="home-deferred" style={style}>
      {children}
    </div>
  );
}
