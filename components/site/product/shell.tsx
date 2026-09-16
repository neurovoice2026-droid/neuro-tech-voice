import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { ppCinema, ppDisplay } from "./fonts";
import { Deferred } from "./primitives";

/**
 * The frame every light product page is built in: the header in its light
 * tone, a `.pp` main that owns the tokens and the display face, and the
 * site's imprint underneath.
 */
export function ProductShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader tone="light" />
      <main
        id="content"
        tabIndex={-1}
        // No top padding: the header is fixed and see-through while docked,
        // so each page's hero clears it with its own top margin.
        className={`pp ${ppDisplay.variable} ${ppCinema.variable} relative flex-1 overflow-x-clip outline-none`}
      >
        {children}
      </main>
      <Deferred size={560}>
        <Footer />
      </Deferred>
    </>
  );
}
