import { Inter, Inter_Tight } from "next/font/google";

/**
 * The marketing site's faces, called from the marketing pages themselves so
 * Next preloads them only there. The root layout declares the same fonts with
 * preload off (so the CSS variables exist everywhere, portals included,
 * without the sign-in pages and the dashboard preloading ~90 KB of fonts they
 * never paint). Identical options give identical self-hosted files, so a page
 * that uses both declarations still downloads each file once.
 */
export const siteDisplay = Inter_Tight({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

export const siteHeader = Inter({
  variable: "--font-header",
  subsets: ["latin"],
  display: "swap",
});

/** Put on the marketing page's main wrapper: defines the variables and triggers the preload. */
export const siteFontVariables = `${siteDisplay.variable} ${siteHeader.variable}`;
