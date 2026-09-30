import { Cormorant_Garamond, Instrument_Sans } from "next/font/google";

/* ------------------------------------------------------------------ *
 * The landing body's two faces, called from app/page.tsx only.
 *
 * A font is preloaded by the page that calls its loader, so "/" loads
 * these and never the product pages' Onest (product/fonts.ts), which
 * keep theirs. Both declare the same variables the pp system reads
 * (`.pp-display`, `.home-cinema`), so nothing below the wrapper changes.
 * ------------------------------------------------------------------ */

/**
 * The display face on "/": a variable grotesk (400–700, so no weight
 * list) with true tabular figures. Not preloaded: the first thing it
 * sets is the call's heading, below the hero, and a preload would only
 * compete with the hero's own fonts and stylesheet for the first paint
 * on a slow line. `swap` with the size-adjusted fallback next/font
 * generates keeps the late swap from moving anything.
 */
export const homeDisplay = Instrument_Sans({
  variable: "--font-pp-display",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

/**
 * Spoken lines. The same options as product/fonts.ts `ppCinema`, so the
 * self-hosted file is the same one and a visitor coming from a product
 * page already has it.
 */
export const homeCinema = Cormorant_Garamond({
  variable: "--font-pp-cinema",
  subsets: ["latin"],
  weight: ["500"],
  style: ["normal", "italic"],
  display: "swap",
  // Only set below the fold, so it is fetched when used rather than
  // competing with the cover for the first second on a phone.
  preload: false,
});
