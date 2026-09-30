import type { Metadata } from "next";
import { Gap, Rule } from "@/components/site/product/primitives";
import { meshBlobs } from "@/components/site/home/mesh-flow";
import "@/components/site/home/home.css";
// The lite tier's rules (no grain, no home-rise) whichever island loads motion.ts first.
import "@/components/site/home/tier.css";
import "@/components/site/solutions/custom-saas-platforms/saas.css";
import "@/components/site/solutions/custom-saas-platforms/saas-credentials.css"; // Team's tally
import "@/components/site/solutions/custom-saas-platforms/saas-build.css"; // proto naming + slide fallback, .saas-link, [data-col]
import "@/components/site/solutions/custom-saas-platforms/saas-closing.css"; // #checks
import "@/components/site/solutions/custom-mobile-applications/mob.css";
import "@/components/site/solutions/custom-mobile-applications/mob-device.css";
import "@/components/site/solutions/custom-mobile-applications/mob-hold.css";
import "@/components/site/solutions/custom-mobile-applications/mob-kinds.css";
import "@/components/site/solutions/custom-mobile-applications/mob-path.css";
import "@/components/site/solutions/custom-mobile-applications/mob-server.css";
import {
  MOB_CHECKS,
  MOB_CREDITS,
  MOB_FAQ,
  MOB_HERO,
  MOB_HOLD,
  MOB_KINDS,
  MOB_META,
  MOB_PATH,
  MOB_SERVER,
  MOB_START,
  MOB_TEAM,
  MOB_TERMS,
} from "@/lib/pages/custom-mobile-applications";
import { SAAS_LIGHTS } from "@/components/site/solutions/custom-saas-platforms/palette";
import { SaasShell } from "@/components/site/solutions/custom-saas-platforms/shell";
import { Hero } from "@/components/site/solutions/custom-saas-platforms/hero";
import { Terms } from "@/components/site/solutions/custom-saas-platforms/terms";
import { Checks } from "@/components/site/solutions/custom-saas-platforms/checks";
import { Faq } from "@/components/site/solutions/custom-saas-platforms/faq";
import { Start } from "@/components/site/solutions/custom-saas-platforms/start";
import { Team } from "@/components/site/solutions/custom-automations/team";
import { MobDeferred } from "@/components/site/solutions/custom-mobile-applications/deferred";
import { Hold } from "@/components/site/solutions/custom-mobile-applications/hold";
import { Kinds } from "@/components/site/solutions/custom-mobile-applications/kinds";
import { Path } from "@/components/site/solutions/custom-mobile-applications/path";
import { Server } from "@/components/site/solutions/custom-mobile-applications/server";

/* ------------------------------------------------------------------ *
 * /solutions/custom-mobile-applications — "The half you don’t see".
 *
 * The argument: any app, for iOS and Android, for any business — we
 * design, build and publish it — and the half of every app a buyer never
 * sees (sign-in, an API, a database, payments, files, a live connection,
 * jobs that run themselves, emails and texts) already runs here, on the
 * platform this page is served from: our own, for AI phone agents, the
 * proof and never the limit. The repository holds no app of ours in a
 * store, so the page claims none (PUBLISHED_APPS, null until the owner
 * names one). It shows instead a sample app to hold, with the parts each
 * step talks to drawn beside it; any kind of app mapped onto the same
 * parts; the path through both stores with the stores' own rules beside
 * it, and whose name each thing is in; the server side, counted from the
 * code. After that: who builds it, the terms, how to check each claim,
 * and how to start.
 *
 * THE DESIGN SYSTEM IS THE SIBLINGS', imported rather than copied, and
 * not one of their lines changes for this page: the SaaS shell (the
 * light header, the `pp home-body saas-page` main with its preloaded
 * faces, the jump and settle helpers, the footer), its lights (palette.ts
 * SAAS_LIGHTS, no new recipe), its width-aware reserve (through this
 * page's `MobDeferred`, deferred.tsx), its hero, terms, checks, FAQ and
 * start sections as they are, and the Automations page's #team, each
 * handed this page's words. #checks' view-transition filter works here
 * unchanged: saas-closing.css names the boxes after it by #faq and
 * #start, the ids this page gives them too. And the phone's live screen
 * wears `saas-proto-screen`, the SaaS prototype's class, so vt.ts's
 * "proto" scope (its guard against a screen under the header included)
 * and saas-build.css's naming of that screen apply to it unchanged; the
 * platform's own moves are types under that scope, in mob-device.css.
 * Nothing else here wears the class, so the name stays unique.
 * lib/pages/custom-mobile-applications.test.ts holds that contract, and
 * the order of the boxes below.
 *
 * Why static, and not async: nothing here depends on who is looking, and
 * nothing is awaited. No cookies(), headers() or searchParams, so the
 * route prerenders (○) and the copy is in the HTML for search and for
 * anyone without script. Every word lives in the server-only data module
 * (lib/pages/custom-mobile-applications.ts), which reads its facts from
 * their sources and throws at build when one drifts — the reminder text
 * included, rendered by the platform's own pure template when the module
 * is evaluated, so there is no `.server` module and no table to wait
 * for. Each section gets its slice here as plain, serialisable props, and
 * the islands import its types only, so nothing the module reads reaches
 * a client chunk.
 *
 * One thing is worked out here, once, at build time, and handed down as
 * data: the pearl lights taken apart into their pools (home/mesh-flow.ts
 * `meshBlobs` over palette.ts SAAS_LIGHTS), for every surface whose light
 * flows (`LiveMesh`). The recipes and their parser stay on the server;
 * the client gets style objects. #kinds' room wears the hero room's light
 * mirrored, #path's middle card the mirror of its neighbours, and #team's
 * card the papers light, so no two lit surfaces in sight of each other
 * match. #server's night room is a still gradient and takes no pools.
 *
 * Why the hero is not deferred: it holds the LCP (the h1 from md up, the
 * sub below md), and a content-visibility box above the fold would hold
 * that paint back for nothing. Everything below the cover sits in a
 * `MobDeferred` box: the landing's `HomeDeferred`, with a reserve that
 * follows the width inside each tier (deferred.tsx). A reserve off the
 * truth moves the page under the reader when its box first paints, and
 * lands a jump past it in the wrong place; what the reserves leave, a
 * page that opens part-way down (settle.tsx) and every same-page jump
 * (jumps.tsx) catch, through the SaaS shell.
 *
 * The CSS is route-scoped and imported here, once, so it ships with this
 * route only: the landing's tokens and shared classes (home.css), its
 * tier rules (tier.css — home/motion.ts imports it too, but not every
 * island here loads motion.ts), the four SaaS sheets whose rules the
 * reused parts carry (saas.css: the lights, the lit surface, the mesh
 * flow, the hero's plates, the view-transition root, the lite tier;
 * saas-credentials.css: the tally #team counts with; saas-build.css: the
 * "proto" screen's name and its slide where types aren't supported, the
 * dotted links between #path's cards, the columns' rise; saas-closing.css:
 * #checks' key figures and filter), then this page's own: mob.css first
 * (the shared marks and keyframes, the tier and reduced-motion pins,
 * forced colours), and each group of sections' file after it, in page
 * order — the device, #hold, #kinds, #path, #server — so a section's pin
 * wins a tie with the shared sheet. saas-explorer.css and the Automations
 * sheets are not imported: nothing here uses their classes. Every rule in
 * this page's own files is under `.pp`, or on <html> where it has to be,
 * and every class and keyframe is prefixed `mob-`.
 * ------------------------------------------------------------------ */

export const metadata: Metadata = {
  title: MOB_META.title,
  description: MOB_META.description,
  alternates: { canonical: "/solutions/custom-mobile-applications" },
  // A page's openGraph and twitter replace the layout's whole (metadata merges shallowly), so each is set in full.
  openGraph: {
    type: "website",
    siteName: "Neuro Tech Voice",
    url: "/solutions/custom-mobile-applications",
    title: MOB_META.title,
    description: MOB_META.description,
  },
  twitter: { card: "summary_large_image", title: MOB_META.title, description: MOB_META.description },
};

/** Each flowing surface's pools, worked out once per build (#server's still night room takes none). */
const BLOBS = {
  room: meshBlobs(SAAS_LIGHTS.room.ground),
  roomMirror: meshBlobs(SAAS_LIGHTS.roomMirror.ground),
  papers: meshBlobs(SAAS_LIGHTS.papers.ground),
  stage: meshBlobs(SAAS_LIGHTS.stage.ground),
  stageMirror: meshBlobs(SAAS_LIGHTS.stageMirror.ground),
};

export default function CustomMobileApplicationsPage() {
  return (
    <SaasShell>
      {/* Ten sections, one sceptical question each, in the order a founder
          asks them: what do you build, and why believe you (the hero);
          show me an app — iOS and Android, one or two, and what's behind
          it (the phone you hold, the page's spine and its only autoplay,
          then "Two apps or one?"); can you build our kind of app, however
          hard (whatever your app); what do I get, in what order, will it
          pass the stores, and whose name is it in (the path to both
          stores); who runs the server, and is any of it real (the half
          you don't see); who builds it, and why trust them (the team);
          what's the catch (the terms, after a rule: the only still
          section); how do I check all this (the checks); the doubts that
          remain; and how to start, then the credits.

          The grounds keep a rhythm down the page: white with a pearl
          room, a still stage room holding the phone then white with three
          drawn figures, white with the room's mirror, a wash band with
          three flowing stage cards then white, white over a still night
          room with a drawn wire and white cards, white with a pearl card,
          a rule then still white, white with drawn figures and a still
          pearl card, white, then the deep panel and the dark footer.

          Each box's reserve is its row in deferred.tsx `RESERVES`, in
          this order: its height at each of 49 widths. Any change to a
          section's height changes its row there. */}
      <Hero data={MOB_HERO} blobs={BLOBS.room} />
      <Gap />
      <MobDeferred box="hold">
        <Hold data={MOB_HOLD} />
        <Gap />
      </MobDeferred>
      <MobDeferred box="kinds">
        <Kinds data={MOB_KINDS} blobs={BLOBS.roomMirror} />
        <Gap />
      </MobDeferred>
      <MobDeferred box="path">
        <Path data={MOB_PATH} blobs={{ stage: BLOBS.stage, mirror: BLOBS.stageMirror }} />
        <Gap />
      </MobDeferred>
      <MobDeferred box="server">
        <Server data={MOB_SERVER} />
        <Gap />
      </MobDeferred>
      <MobDeferred box="team">
        <Team data={MOB_TEAM} blobs={BLOBS.papers} />
        <Gap />
      </MobDeferred>
      {/* The only still section: a rule above it marks the change of
          register from instruments to terms. */}
      <MobDeferred box="terms">
        <Rule />
        <Gap className="h-16 md:h-24" />
        <Terms data={MOB_TERMS} />
        {/* Its last link's 44px target reaches 10px past the section's foot:
            the empty Gap after it lets the pointer through to it. */}
        <Gap className="pointer-events-none" />
      </MobDeferred>
      <MobDeferred box="checks">
        <Checks data={MOB_CHECKS} />
        <Gap />
      </MobDeferred>
      <MobDeferred box="faq">
        <Faq data={MOB_FAQ} />
        <Gap />
      </MobDeferred>
      <MobDeferred box="start">
        <Start data={MOB_START} credits={MOB_CREDITS} />
        <Gap className="h-16 md:h-24" />
      </MobDeferred>
    </SaasShell>
  );
}
