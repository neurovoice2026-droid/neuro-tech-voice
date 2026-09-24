import type { ReactNode } from "react";
import { Instrument_Sans } from "next/font/google";
import { SiteHeader } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { siteHeader } from "@/components/site/fonts";
import { Deferred } from "@/components/site/product/primitives";
import { Jumps } from "./jumps";

/* ------------------------------------------------------------------ *
 * The frame /solutions/custom-saas-platforms is built in: the header in
 * its light tone, a `.pp home-body` main that owns the landing's tokens
 * and faces, and the site's imprint underneath.
 *
 * WHY NOT ProductShell. That shell is the frame every other light product
 * page uses, and it would be one import. It also calls product/fonts.ts,
 * which declares Onest under the same `--font-pp-display` variable the
 * landing's Instrument Sans uses: this page is set in the landing's faces
 * and on its tokens (`.pp.home-body`, home.css), and two loaders for one
 * variable would download both and paint whichever the cascade picked.
 * So the page gets the landing's wrapper instead, as app/page.tsx builds
 * it below the frozen hero, and ProductShell's footer arrangement
 * unchanged.
 *
 * THE FACES. The h1 is set in Instrument Sans above the fold, and it is
 * the largest paint from md up (the Inter sub is, below md), so the
 * display face is preloaded here (`saasDisplay`, below) rather than
 * taken from the landing's `homeDisplay`, which is not: on "/" the face
 * first appears below the hero. The Inter sub is the other half:
 * `siteHeader.variable` is declared here — the loader called from the
 * page is the one Next preloads — while the root layout's copy of it
 * stays preload-free for the app. Cormorant is not loaded: this page has
 * no spoken lines. Geist Mono comes from the root layout, as everywhere.
 *
 * `saas-page` names this page's <main> for the few rules that must not
 * reach the landing, whose wrapper is `.pp.home-body` too, and whose
 * sheets stay loaded after a client-side trip from here: scroll anchoring
 * back on, the scroll padding, the instant load-time jump (saas.css §14)
 * and the forced-colours states (§15). `Jumps` gives every same-page
 * jump one more look once it has settled (jumps.tsx).
 *
 * The header is fixed and see-through while docked, so there is no top
 * padding here: the hero clears it with its own (pt-28 md:pt-[148px],
 * the custom-ai-agents precedent). `overflow-x-clip`, not hidden, so the
 * explorer's and the prototype's sticky columns still stick. The footer
 * sits in a Deferred box exactly as ProductShell has it: it is the last
 * thing on the page and nobody lands on it.
 * ------------------------------------------------------------------ */

/**
 * The display face, as home/fonts.ts `homeDisplay` declares it but
 * preloaded, because here it sets the h1. It is the only Instrument Sans
 * loader this route calls: Next serves a preloaded face from its own
 * URL, and two rules for one family would leave the later one painting
 * and the preload possibly unused.
 *
 * NOTHING MOVES WHEN IT SWAPS IN, on any device. Until it arrives the h1
 * is drawn in a fallback sized to it: a system face under overrides that
 * give it Instrument Sans's width and line box, so the lines break where
 * the face's will. next/font makes one such face, on Arial, but Android
 * has no Arial: there the h1 fell through to Inter, a wider face, took a
 * fourth line at 384–393px, and the CTAs under it jumped 40px when the
 * face arrived. So the page names two, both in saas.css §0: Arial (or a
 * metric twin of it), then Roboto, which every Android has. next/font's
 * own is turned off: Turbopack drops it the moment `fallback` is set, and
 * the Arial face here is the same one, worked out the same way.
 */
const saasDisplay = Instrument_Sans({
  variable: "--font-pp-display",
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: false,
  // Single quotes: Turbopack embeds the list in a double-quoted string.
  fallback: ["'Instrument Sans Arial Fallback'", "'Instrument Sans Roboto Fallback'"],
});

export function SaasShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader tone="light" />
      <main
        id="content"
        // Named and focusable so the header's skip link has somewhere to land.
        tabIndex={-1}
        className={`pp home-body saas-page ${saasDisplay.variable} ${siteHeader.variable} relative flex-1 overflow-x-clip outline-none`}
      >
        {children}
        <Jumps />
      </main>
      <Deferred size={560}>
        <Footer />
      </Deferred>
    </>
  );
}
