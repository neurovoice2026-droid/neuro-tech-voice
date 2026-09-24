import type { Metadata } from "next";
import { Gap, Rule } from "@/components/site/product/primitives";
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
import { SaasDeferred } from "@/components/site/solutions/custom-saas-platforms/deferred";
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
 * the platform this page is served from is one of them. The claims that
 * matter most say how to check them — now, in this browser; on the call;
 * or in your build — and the credentials say exactly what they are: personal
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
 * that paint back for nothing. Everything below the cover sits in a
 * `SaasDeferred` box: the landing's `HomeDeferred`, with a reserve that
 * follows the width inside each tier, measured (deferred.tsx). A reserve
 * off the truth moves the page under the reader when its box first
 * paints, and lands a jump past it in the wrong place; what the reserves
 * leave, a page that opens part-way down (settle.tsx) and every
 * same-page jump (jumps.tsx) catch.
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

          Each box's reserve is its row in deferred.tsx `RESERVES`: a
          height measured at each of 40 widths, not guessed, so any change
          to a section's height changes its row there. */}
      <Hero data={SAAS_HERO} blobs={BLOBS.room} />
      <Gap />
      <SaasDeferred box="credentials">
        <Credentials data={SAAS_CREDENTIALS} blobs={BLOBS.papers} />
        <Gap />
      </SaasDeferred>
      <SaasDeferred box="platform">
        <Platform data={SAAS_PLATFORM} down={down} />
        <Gap />
      </SaasDeferred>
      <SaasDeferred box="scope">
        <Scope data={SAAS_SCOPE} blobs={BLOBS.roomMirror} />
        <Gap />
      </SaasDeferred>
      <SaasDeferred box="prototype">
        <Prototype data={SAAS_PROTOTYPE} />
        <Gap />
      </SaasDeferred>
      <SaasDeferred box="build">
        <Build data={SAAS_BUILD} blobs={{ stage: BLOBS.stage, mirror: BLOBS.stageMirror }} />
        <Gap />
      </SaasDeferred>
      {/* The only still section: a rule above it marks the change of
          register from instruments to terms. */}
      <SaasDeferred box="terms">
        <Rule />
        <Gap className="h-16 md:h-24" />
        <Terms data={SAAS_TERMS} />
        <Gap />
      </SaasDeferred>
      <SaasDeferred box="checks">
        <Checks data={SAAS_CHECKS} />
        <Gap />
      </SaasDeferred>
      <SaasDeferred box="faq">
        <Faq data={SAAS_FAQ} />
        <Gap />
      </SaasDeferred>
      <SaasDeferred box="start">
        <Start data={SAAS_START} credits={SAAS_CREDITS} />
        <Gap className="h-16 md:h-24" />
      </SaasDeferred>
    </SaasShell>
  );
}
