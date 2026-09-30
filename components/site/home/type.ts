/* ------------------------------------------------------------------ *
 * The landing's type scale, locked. Nine roles and no others.
 *
 * Display is Instrument Sans on "/" (components/site/home/fonts.ts),
 * Inter carries body and labels, Geist Mono measured values, Cormorant
 * spoken lines only.
 *
 * Weights are not in the classes: `.pp-display` sets its weight outside
 * Tailwind's layers, which beats a weight utility on the same element,
 * so every heading sets `style={{ fontWeight: WEIGHT.x }}` instead
 * (home.css gives an unset one 460). Weight follows the ground: the two
 * display headings sit on dark and run lighter. Nothing is bold for
 * emphasis; hierarchy is size, ink against muted, and one coloured
 * phrase per heading (HomeHeading's `titleKey`).
 * ------------------------------------------------------------------ */

export const TYPE = {
  /** S1 and S9 only. */
  display:
    "pp-display text-[36px] leading-[40px] tracking-[-0.03em] md:text-[48px] md:leading-[52px] text-balance",
  h2: "pp-display text-[30px] leading-[36px] tracking-[-0.025em] md:text-[40px] md:leading-[46px] text-balance",
  h3: "pp-display text-[19px] leading-[28px] tracking-[-0.01em]",
  lead: "text-[16px] leading-[25px] text-pp-ink/80",
  body: "text-[15px] leading-[22px]",
  meta: "text-[13px] leading-[18px] text-pp-muted",
  label: "text-[11px] leading-4 font-medium tracking-[0.14em] uppercase",
  mono: "font-[family-name:var(--font-geist-mono)] text-[12px] leading-[18px] tabular-nums",
  /** Spoken lines only. */
  cinema: "home-cinema text-[26px] leading-[32px] md:text-[40px] md:leading-[48px]",
  cinemaSm: "home-cinema text-[26px] leading-[32px]",
} as const;

/**
 * `num` is every figure set in the display face (286, the day count,
 * $49.00, the plan prices), always with `tabular-nums`: Instrument Sans
 * has true tabular figures, so columns of prices line up.
 */
export const WEIGHT = { display: 440, h2: 500, h3: 520, num: 460 } as const;
