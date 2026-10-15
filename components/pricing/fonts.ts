import { Instrument_Sans } from "next/font/google";

/**
 * The plan cards' display face in the app: Instrument Sans, the homepage's
 * (components/site/home/fonts.ts `homeDisplay`). The same options, so it is
 * the same self-hosted file, and the same variable (--font-pp-display,
 * which `.pp-display` reads). Not preloaded: only the pages that show plan
 * cards (onboarding's launch step, billing) declare it, on the cards'
 * wrapper (PlanTiers), and the file is fetched when a card is painted.
 */
export const planTierDisplay = Instrument_Sans({
  variable: "--font-pp-display",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});
