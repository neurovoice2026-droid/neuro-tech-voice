import { Cormorant_Garamond, Onest } from "next/font/google";

/**
 * The product pages' display face. Loaded here rather than in the root
 * layout, so the homepage and the app never download it.
 */
export const ppDisplay = Onest({
  variable: "--font-pp-display",
  // Only the Latin file is preloaded; the page is set in English.
  subsets: ["latin"],
  display: "swap",
});

/**
 * The caption face for calls played back on the page — set like the
 * dialogue card of a film trailer rather than like interface copy.
 */
export const ppCinema = Cormorant_Garamond({
  variable: "--font-pp-cinema",
  subsets: ["latin"],
  weight: ["500"],
  style: ["normal", "italic"],
  display: "swap",
  // Only set below the fold, so it is fetched when used rather than
  // competing with the cover for the first second on a phone.
  preload: false,
});
