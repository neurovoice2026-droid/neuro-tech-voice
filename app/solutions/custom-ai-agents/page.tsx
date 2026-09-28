import type { Metadata } from "next";
import { ProductShell } from "@/components/site/product/shell";
import { Deferred, Gap, Rule } from "@/components/site/product/primitives";
import { ProductFaq, ProductStart } from "@/components/site/product/closing";
import {
  CAA_BAND,
  CAA_FAQ,
  CAA_HANDOVER,
  CAA_HERO,
  CAA_META,
  CAA_NAMES,
  CAA_RECEIPT,
  CAA_REDLINE,
  CAA_REHEARSAL,
  CAA_START,
  CAA_WIRING,
} from "@/lib/pages/custom-ai-agents";
import "@/components/site/solutions/custom-ai-agents/caa.css";
import { Hero } from "@/components/site/solutions/custom-ai-agents/hero";
import { Band } from "@/components/site/solutions/custom-ai-agents/band";
import { Redline } from "@/components/site/solutions/custom-ai-agents/redline";
import { Names } from "@/components/site/solutions/custom-ai-agents/names";
import { Wiring } from "@/components/site/solutions/custom-ai-agents/wiring";
import { Rehearsal } from "@/components/site/solutions/custom-ai-agents/rehearsal";
import { Handover } from "@/components/site/solutions/custom-ai-agents/handover";
import { Receipt } from "@/components/site/solutions/custom-ai-agents/receipt";

/* ------------------------------------------------------------------ *
 * /solutions/custom-ai-agents — "The build, watched".
 *
 * Why static: nothing here depends on who is looking. No cookies(),
 * headers() or searchParams, so the route prerenders (○) and the copy
 * is in the HTML for search and for anyone without script. The data
 * module is server-only; each instrument gets its slice here as plain,
 * serialisable props, so the supplier names and platform constants it
 * reads never reach a client chunk.
 *
 * Why the hero is not deferred: its sub paragraph is the LCP, and a
 * content-visibility box above the fold would hold that paint back for
 * nothing. Everything below the cover sits in a Deferred box.
 *
 * The sizes are measured, not guessed: each is the block's height at a
 * 390px-wide phone — the tallest reserved variant plus its trailing Gap,
 * with autoplay finished — rounded UP to the next 50. Measured 568, 1690,
 * 1332, 3194, 2258, 1700 and 3020px; every instrument reserves its
 * tallest state, so the heights held constant through autoplay too.
 * Wiring's tallest variant is the one with motion: under reduced motion
 * its Replay button is display:none (72px shorter, 3122), so measuring
 * there alone would under-reserve for most readers. Its scrub rail's
 * fixed 64px strip is counted in the 3194.
 * Handover measured exactly 1700, so it takes the next step (1750)
 * rather than sit on the line a font-metric wobble could cross. An underestimate
 * makes the scrollbar jump when the box renders, so it is a bug; a
 * modest overestimate only costs a slightly long scrollbar until then.
 * caa.css is imported here, once, so its rules ship with this route only.
 * ------------------------------------------------------------------ */

export const metadata: Metadata = {
  title: CAA_META.title,
  description: CAA_META.description,
  alternates: { canonical: "/solutions/custom-ai-agents" },
};

export default function CustomAiAgentsPage() {
  return (
    <ProductShell>
      {/* One sceptical objection per section, in the order owners raise
          them: "a template won't know how we work" (the sheet becomes a
          flow), a breath (the music box), "I don't have time to write
          prompts" (one rule, redrafted and rung), "it won't catch our
          names" (the keyterm list), "it has to work with what we use"
          (one call on a time axis), "it'll embarrass us live" (the test
          sheet), then what we ask and say up front, the receipt of what
          was shown, the questions, and the way in. */}
      <Hero data={CAA_HERO} />
      <Gap />
      <Deferred size={600}>
        <Band data={CAA_BAND} />
        <Gap />
      </Deferred>
      <Deferred size={1700}>
        <Redline data={CAA_REDLINE} />
        <Gap />
      </Deferred>
      <Deferred size={1350}>
        <Names data={CAA_NAMES} />
        <Gap />
      </Deferred>
      <Deferred size={3200}>
        <Wiring data={CAA_WIRING} />
        <Gap />
      </Deferred>
      <Deferred size={2300}>
        <Rehearsal data={CAA_REHEARSAL} />
        <Gap />
      </Deferred>
      {/* The only still section: a rule above it marks the change of
          register from instruments to terms. */}
      <Deferred size={1750}>
        <Rule />
        <Gap className="h-16 md:h-24" />
        <Handover data={CAA_HANDOVER} />
        <Gap />
      </Deferred>
      {/* One box for the close, so the receipt, questions and start are
          never measured against each other's placeholder. */}
      <Deferred size={3050}>
        <Receipt data={CAA_RECEIPT} />
        <Gap className="h-16 md:h-24" />
        <ProductFaq data={CAA_FAQ} />
        <Gap className="h-16 md:h-24" />
        <ProductStart data={CAA_START} />
        <Gap className="h-16 md:h-24" />
      </Deferred>
    </ProductShell>
  );
}
