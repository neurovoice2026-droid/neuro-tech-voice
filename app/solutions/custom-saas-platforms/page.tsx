import type { Metadata } from "next";
import { Gap, Rule } from "@/components/site/product/primitives";
import { HomeDeferred } from "@/components/site/home/deferred";
import { meshBlobs } from "@/components/site/home/mesh-flow";
import "@/components/site/home/home.css";
// The lite tier's rules (no grain, no home-rise) whichever island loads motion.ts first.
import "@/components/site/home/tier.css";
import "@/components/site/solutions/custom-saas-platforms/saas.css";
import "@/components/site/solutions/custom-saas-platforms/saas-credentials.css";
import "@/components/site/solutions/custom-saas-platforms/saas-explorer.css";
import "@/components/site/solutions/custom-saas-platforms/saas-build.css";
import "@/components/site/solutions/custom-saas-platforms/saas-closing.css";
import {
  SAAS_BUILD,
  SAAS_CHECKS,
  SAAS_CREDENTIALS,
  SAAS_CREDITS,
  SAAS_FAQ,
  SAAS_HERO,
  SAAS_META,
  SAAS_PLATFORM,
  SAAS_PROTOTYPE,
  SAAS_SCOPE,
  SAAS_START,
  SAAS_TERMS,
} from "@/lib/pages/custom-saas-platforms";
import { buildDownTable } from "@/lib/pages/custom-saas-platforms.server";
import { SAAS_LIGHTS } from "@/components/site/solutions/custom-saas-platforms/palette";
import { SaasShell } from "@/components/site/solutions/custom-saas-platforms/shell";
import { Hero } from "@/components/site/solutions/custom-saas-platforms/hero";
import { Credentials } from "@/components/site/solutions/custom-saas-platforms/credentials";
import { Platform } from "@/components/site/solutions/custom-saas-platforms/platform";
import { Scope } from "@/components/site/solutions/custom-saas-platforms/scope";
import { Prototype } from "@/components/site/solutions/custom-saas-platforms/prototype";
import { Build } from "@/components/site/solutions/custom-saas-platforms/build";
import { Terms } from "@/components/site/solutions/custom-saas-platforms/terms";
import { Checks } from "@/components/site/solutions/custom-saas-platforms/checks";
import { Faq } from "@/components/site/solutions/custom-saas-platforms/faq";
import { Start } from "@/components/site/solutions/custom-saas-platforms/start";

/* ------------------------------------------------------------------ *
 * /solutions/custom-saas-platforms — "You’re on one of them".
 *
 * The argument: we build complete SaaS platforms, however complex, and
 * the platform this page is served from is one of them. Every claim on
 * the page says how to check it — now, in this browser; on the call; or
 * at handover — and the credentials say exactly what they are: personal
 * accreditations and company grants, never a certification.
 *
 * Why static: nothing here depends on who is looking. No cookies(),
 * headers() or searchParams, so the route prerenders (○) and the copy is
 * in the HTML for search and for anyone without script. Every word lives
 * in the server-only data module (lib/pages/custom-saas-platforms.ts),
 * which reads its facts from their sources and throws at build when one
 * drifts; each section gets its slice here as plain, serialisable props,
 * so nothing the module reads reaches a client chunk.
 *
 * Two things are worked out here, once, at build time, and handed down
 * as data:
 *
 *   - "Take a part down", the explorer's fifth lens: the platform's own
 *     routing policy (lib/voice/mode.ts `decideMode`) run for all sixteen
 *     combinations of its four switches. It lives in the `.server` module
 *     so mode.ts's graph never loads with the page's words, and nothing
 *     it reads is the environment.
 *   - The pearl lights taken apart into their pools (home/mesh-flow.ts
 *     `meshBlobs` over palette.ts SAAS_LIGHTS), for every surface whose
 *     light flows (`LiveMesh`). The recipes and their parser stay on the
 *     server; the client gets style objects. The scope room wears the
 *     hero room's light mirrored, and #build's middle card the mirror of
 *     its neighbours, so no two surfaces in sight of each other match.
 *
 * Why the hero is not deferred: it holds the LCP (the h1 from md up, the
 * sub below md), and a content-visibility box above the fold would hold
 * that paint back for nothing. Everything below the cover sits in a `HomeDeferred` box with
 * a reserve per Tailwind tier, as on the landing. A reserve far from the
 * truth moves the page under the reader when its box first paints, and
 * lands a jump past it in the wrong place: see the reserves below, and
 * the one more look every same-page jump gets (jumps.tsx).
 *
 * The CSS is route-scoped and imported here, once, so it ships with this
 * route only: the landing's tokens and shared classes (home.css), its
 * tier rules (tier.css — home/motion.ts imports it too, but not every
 * island here loads motion.ts), the page's shared rules (saas.css: the
 * lights, the lit surface, the mesh flow, the hero's plates, the
 * view-transition root, the lite tier), then each group of sections' own
 * file. Every rule in the page's own files is under `.pp`, or on <html>
 * where it has to be, and every class and keyframe is prefixed `saas-`.
 * ------------------------------------------------------------------ */

export const metadata: Metadata = {
  title: SAAS_META.title,
  description: SAAS_META.description,
  alternates: { canonical: "/solutions/custom-saas-platforms" },
  // A page's openGraph and twitter replace the layout's whole (metadata merges shallowly), so each is set in full.
  openGraph: {
    type: "website",
    siteName: "Neuro Tech Voice",
    url: "/solutions/custom-saas-platforms",
    title: SAAS_META.title,
    description: SAAS_META.description,
  },
  twitter: { card: "summary_large_image", title: SAAS_META.title, description: SAAS_META.description },
};

/** Each lit surface's pools, worked out once per build. */
const BLOBS = {
  room: meshBlobs(SAAS_LIGHTS.room.ground),
  roomMirror: meshBlobs(SAAS_LIGHTS.roomMirror.ground),
  papers: meshBlobs(SAAS_LIGHTS.papers.ground),
  stage: meshBlobs(SAAS_LIGHTS.stage.ground),
  stageMirror: meshBlobs(SAAS_LIGHTS.stageMirror.ground),
};

export default function CustomSaasPlatformsPage() {
  const down = buildDownTable();
  return (
    <SaasShell>
      {/* Ten sections, one sceptical question each, in the order a buyer
          asks them: what have you built (the hero); who are you, and why
          believe you (the credentials); is that platform real or a demo
          (the explorer, the page's spine and its only autoplay); what goes
          into mine, and what makes it harder (the scope); will I see it
          before I pay for code (the prototype); what would I get, and in
          what order (the build); what's the catch (the terms, after a
          rule: the only still section); how do I check all this (the
          checks); the doubts that remain; and how to start, then the
          credits.

          The grounds keep a rhythm down the page: white with a pearl
          room, a pearl card, a stage, a pearl room, a stage, a wash band
          with pearl cards, white and still, white with drawn figures and
          a pearl card, white, then the deep panel and the dark footer.

          Reserves are [<768, md, lg, xl] and are measured, not guessed:
          each is the box's height at 393, 768, 1024 and 1440 with
          ?tier=full, after scrolling the page through so every box has
          rendered — the explorer's tour played out, #checks on "Every
          claim", the explorer's index and every FAQ row closed —
          including the box's trailing Gap (and, for #build, its wash
          band's own padding; for the terms, the Rule and the Gap above
          them), to the pixel, as the landing's are. Measured:
            credentials  1438 · 1371 · 1010 ·  902
            platform     2172 · 2076 · 1588 · 1773   (first paint)
            scope        2436 · 1865 · 1519 · 1365
            prototype    1303 · 1235 ·  762 ·  762
            build        1841 · 1677 · 1207 · 1029
            terms        1749 · 1563 · 1437 ·  957
            checks       2411 · 1976 · 1831 · 1701
            faq          1117 · 1027 ·  933 ·  849
            start        1704 · 1322 · 1314 · 1228
          1280 measures the same as 1440 (the Frame's cap), so the xl
          figure holds across the tier. The phone figure is taken at 393,
          the middle of the phones people hold: from 360 to 430 the boxes
          lose some 1,450px between them, and the figures this page had
          before, taken at 375 and rounded up to the next 50, were 80–255px
          over every box at 412–430.
          The explorer is measured on the lens it opens on (only the
          reader's own pick changes the lens, and with it the step list's
          height), and at its first paint: below xl it paints shorter than
          it ends up on the full tier with motion (2172 at 393, then 2326
          once the tour has sized it; 2076 then 2142 at 768), and it is the
          first paint that moves the page when the box renders, the same
          on every tier. The growth after comes from its own script, which
          the browser anchors. The prototype reserves its tallest screen;
          the scope is measured in its opening state (its inspector sizes
          to the part shown, and only the reader's pick changes it).

          Exact, and never rounded up: a reserve off the truth either way
          moves something when its box first paints. A box above the
          screen that paints shorter pulls the page up under a reader
          scrolling back up after a reload or a deep link (a CLS of 0.61
          at 390px and 1.02 at 412px, when every reserve here was measured
          at 375 and rounded up to the next 50), and a jump that passes it
          lands that much off. Scroll anchoring is back on for this page
          (saas.css §14), and holds the page still when a box above paints
          while the reader is still, but Chrome does not anchor a box that
          paints because the reader scrolled up to it, and Safari anchors
          nothing. What the reserves cannot catch, jumps.tsx does: every
          same-page jump gets one more look once it has settled. Any change
          to a section's height changes its reserve here. */}
      <Hero data={SAAS_HERO} blobs={BLOBS.room} />
      <Gap />
      <HomeDeferred size={[1438, 1371, 1010, 902]}>
        <Credentials data={SAAS_CREDENTIALS} blobs={BLOBS.papers} />
        <Gap />
      </HomeDeferred>
      <HomeDeferred size={[2172, 2076, 1588, 1773]}>
        <Platform data={SAAS_PLATFORM} down={down} />
        <Gap />
      </HomeDeferred>
      <HomeDeferred size={[2436, 1865, 1519, 1365]}>
        <Scope data={SAAS_SCOPE} blobs={BLOBS.roomMirror} />
        <Gap />
      </HomeDeferred>
      <HomeDeferred size={[1303, 1235, 762, 762]}>
        <Prototype data={SAAS_PROTOTYPE} />
        <Gap />
      </HomeDeferred>
      <HomeDeferred size={[1841, 1677, 1207, 1029]}>
        <Build data={SAAS_BUILD} blobs={{ stage: BLOBS.stage, mirror: BLOBS.stageMirror }} />
        <Gap />
      </HomeDeferred>
      {/* The only still section: a rule above it marks the change of
          register from instruments to terms. */}
      <HomeDeferred size={[1749, 1563, 1437, 957]}>
        <Rule />
        <Gap className="h-16 md:h-24" />
        <Terms data={SAAS_TERMS} />
        <Gap />
      </HomeDeferred>
      <HomeDeferred size={[2411, 1976, 1831, 1701]}>
        <Checks data={SAAS_CHECKS} />
        <Gap />
      </HomeDeferred>
      <HomeDeferred size={[1117, 1027, 933, 849]}>
        <Faq data={SAAS_FAQ} />
        <Gap />
      </HomeDeferred>
      <HomeDeferred size={[1704, 1322, 1314, 1228]}>
        <Start data={SAAS_START} credits={SAAS_CREDITS} />
        <Gap className="h-16 md:h-24" />
      </HomeDeferred>
    </SaasShell>
  );
}
