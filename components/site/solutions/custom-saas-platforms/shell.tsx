import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { siteHeader } from "@/components/site/fonts";
import { homeDisplay } from "@/components/site/home/fonts";
import { Deferred } from "@/components/site/product/primitives";

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
 * THE FACES. `homeDisplay` (home/fonts.ts) is the only Instrument Sans
 * loader on the page. It is not preloaded: the h1 swaps in late behind
 * next/font's size-adjusted fallback, so nothing shifts, and the h1 is
 * not the largest paint. The hero's sub is, and it is set in Inter, so
 * `siteHeader.variable` is declared here — the loader called from the
 * page is the one Next preloads — while the root layout's copy of it
 * stays preload-free for the app. Cormorant is not loaded: this page has
 * no spoken lines. Geist Mono comes from the root layout, as everywhere.
 *
 * The header is fixed and see-through while docked, so there is no top
 * padding here: the hero clears it with its own (pt-28 md:pt-[148px],
 * the custom-ai-agents precedent). `overflow-x-clip`, not hidden, so the
 * explorer's and the prototype's sticky columns still stick. The footer
 * sits in a Deferred box exactly as ProductShell has it: it is the last
 * thing on the page and nobody lands on it.
 * ------------------------------------------------------------------ */

export function SaasShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader tone="light" />
      <main
        id="content"
        // Named and focusable so the header's skip link has somewhere to land.
        tabIndex={-1}
        className={`pp home-body ${homeDisplay.variable} ${siteHeader.variable} relative flex-1 overflow-x-clip outline-none`}
      >
        {children}
      </main>
      <Deferred size={560}>
        <Footer />
      </Deferred>
    </>
  );
}
