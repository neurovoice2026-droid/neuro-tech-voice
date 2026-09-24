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
 * Why the hero is not deferred: its sub is the LCP, and a
 * content-visibility box above the fold would hold that paint back for
 * nothing. Everything below the cover sits in a `HomeDeferred` box with
 * a reserve per Tailwind tier, as on the landing: `.pp` turns scroll
 * anchoring off, so a reserve far from the truth moves the page under
 * the reader when its box renders, and sends a `#credentials` or
 * `#part-…` jump to the wrong place.
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
          with pearl cards, white and still, white, white, then the deep
          panel and the dark footer.

          Reserves are [<768, md, lg, xl] and are measured, not guessed:
          each is the box's height at 375, 768, 1024 and 1440 with
          ?tier=full, after scrolling the page through so every box has
          rendered — the explorer's tour played out, #checks on "Every
          claim", the explorer's index and every FAQ row closed —
          including the box's trailing Gap (and, for #build, its wash
          band's own padding; for the terms, the Rule and the Gap above
          them), rounded UP to the next 50. Measured:
            credentials  1863 · 1611 · 1174 · 1084
            platform     2736 · 2500 · 2010 · 2195
            scope        2724 · 1990 · 1684 · 1512
            prototype    1409 · 1235 ·  762 ·  762
            build        1982 · 1677 · 1225 · 1049
            terms        1838 · 1563 · 1437 ·  957
            checks       2527 · 2117 · 1594 · 1532
            faq          1309 · 1107 · 1041 ·  929
            start        1932 · 1358 · 1266 · 1228
          1280 measures the same as 1440 (the Frame's cap), so the xl
          figure holds across the tier. The explorer, the scope and the
          prototype each reserve their tallest state (every lens's list,
          every caption and inspector, the tallest screen), so the heights
          are the same on the full and lite tiers and under reduced motion,
          and hold through autoplay. A result on a boundary takes the next
          step — the platform's 2500 at md, and #build's 1049 at xl, a pixel
          short of one, which a font-metric wobble could cross. An
          underestimate makes the page jump when a box renders, so it is a
          bug; a modest overestimate only costs a slightly long scrollbar
          until then. */}
      <Hero data={SAAS_HERO} blobs={BLOBS.room} />
      <Gap />
      <HomeDeferred size={[1900, 1650, 1200, 1100]}>
        <Credentials data={SAAS_CREDENTIALS} blobs={BLOBS.papers} />
        <Gap />
      </HomeDeferred>
      <HomeDeferred size={[2750, 2550, 2050, 2200]}>
        <Platform data={SAAS_PLATFORM} down={down} />
        <Gap />
      </HomeDeferred>
      <HomeDeferred size={[2750, 2000, 1700, 1550]}>
        <Scope data={SAAS_SCOPE} blobs={BLOBS.roomMirror} />
        <Gap />
      </HomeDeferred>
      <HomeDeferred size={[1450, 1250, 800, 800]}>
        <Prototype data={SAAS_PROTOTYPE} />
        <Gap />
      </HomeDeferred>
      <HomeDeferred size={[2000, 1700, 1250, 1100]}>
        <Build data={SAAS_BUILD} blobs={{ stage: BLOBS.stage, mirror: BLOBS.stageMirror }} />
        <Gap />
      </HomeDeferred>
      {/* The only still section: a rule above it marks the change of
          register from instruments to terms. */}
      <HomeDeferred size={[1850, 1600, 1450, 1000]}>
        <Rule />
        <Gap className="h-16 md:h-24" />
        <Terms data={SAAS_TERMS} />
        <Gap />
      </HomeDeferred>
      <HomeDeferred size={[2550, 2150, 1600, 1550]}>
        <Checks data={SAAS_CHECKS} />
        <Gap />
      </HomeDeferred>
      <HomeDeferred size={[1350, 1150, 1050, 950]}>
        <Faq data={SAAS_FAQ} />
        <Gap />
      </HomeDeferred>
      <HomeDeferred size={[1950, 1400, 1300, 1250]}>
        <Start data={SAAS_START} credits={SAAS_CREDITS} />
        <Gap className="h-16 md:h-24" />
      </HomeDeferred>
    </SaasShell>
  );
}
