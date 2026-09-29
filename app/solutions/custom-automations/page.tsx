import type { Metadata } from "next";
import { Gap, Rule } from "@/components/site/product/primitives";
import { meshBlobs } from "@/components/site/home/mesh-flow";
import "@/components/site/home/home.css";
// The lite tier's rules (no grain, no home-rise) whichever island loads motion.ts first.
import "@/components/site/home/tier.css";
import "@/components/site/solutions/custom-saas-platforms/saas.css";
import "@/components/site/solutions/custom-saas-platforms/saas-credentials.css";
import "@/components/site/solutions/custom-saas-platforms/saas-build.css";
import "@/components/site/solutions/custom-saas-platforms/saas-closing.css";
import "@/components/site/solutions/custom-automations/auto.css";
import "@/components/site/solutions/custom-automations/auto-running.css";
import "@/components/site/solutions/custom-automations/auto-work.css";
import "@/components/site/solutions/custom-automations/auto-breaks.css";
import "@/components/site/solutions/custom-automations/auto-closing.css";
import {
  AUTO_BREAKS,
  AUTO_BUILD,
  AUTO_CHECKS,
  AUTO_CREDITS,
  AUTO_FAQ,
  AUTO_HERO,
  AUTO_META,
  AUTO_RUNNING,
  AUTO_START,
  AUTO_TEAM,
  AUTO_TERMS,
  AUTO_WORK,
} from "@/lib/pages/custom-automations";
import { buildBreakTable } from "@/lib/pages/custom-automations.server";
import { SAAS_LIGHTS } from "@/components/site/solutions/custom-saas-platforms/palette";
import { SaasShell } from "@/components/site/solutions/custom-saas-platforms/shell";
import { Hero } from "@/components/site/solutions/custom-saas-platforms/hero";
import { Terms } from "@/components/site/solutions/custom-saas-platforms/terms";
import { Checks } from "@/components/site/solutions/custom-saas-platforms/checks";
import { Faq } from "@/components/site/solutions/custom-saas-platforms/faq";
import { Start } from "@/components/site/solutions/custom-saas-platforms/start";
import { AutoDeferred } from "@/components/site/solutions/custom-automations/deferred";
import { Running } from "@/components/site/solutions/custom-automations/running";
import { Work } from "@/components/site/solutions/custom-automations/work";
import { Breaks } from "@/components/site/solutions/custom-automations/breaks";
import { Team } from "@/components/site/solutions/custom-automations/team";
import { AutoBuild } from "@/components/site/solutions/custom-automations/build";

/* ------------------------------------------------------------------ *
 * /solutions/custom-automations — "Already running".
 *
 * The argument: whatever the work, for any business, we automate it, and
 * this platform — our own, for AI phone agents — runs on ours: the
 * proof, not the limit. Anyone can say "we automate anything"; this page
 * shows the automations the platform it is served from runs every day,
 * each taken from the steps a person would do by hand to the flow that
 * does them. Then it maps any field and any difficulty onto the same
 * blocks, and breaks a step on purpose so the platform's own delivery
 * code can say what happens. After that: who builds it, how a build goes
 * and when you don't need us, the terms, how to check each claim, and
 * how to start. The credentials are said once, in #team, as what they
 * are — personal accreditations and company grants, never a
 * certification — with a link to the SaaS page's for the rest.
 *
 * THE DESIGN SYSTEM IS THE SAAS PAGE'S, imported rather than copied, and
 * not one of its lines changes for this page: its shell (the light
 * header, the `pp home-body saas-page` main with its preloaded faces,
 * the jump and settle helpers, the footer), its lights (palette.ts
 * SAAS_LIGHTS, no new recipe), its width-aware reserve (through this
 * page's `AutoDeferred`, deferred.tsx), and its hero, terms, checks, FAQ
 * and start sections as they are, handed this page's words. #checks'
 * view-transition filter works here unchanged: saas-closing.css names
 * the boxes after it by #faq and #start, the ids this page gives them
 * too. lib/pages/custom-automations.test.ts holds that contract, and the
 * order of the boxes below.
 *
 * Why static: nothing here depends on who is looking. No cookies(),
 * headers() or searchParams, so the route prerenders (○) and the copy is
 * in the HTML for search and for anyone without script. Every word lives
 * in the server-only data module (lib/pages/custom-automations.ts),
 * which reads its facts from their sources and throws at build when one
 * drifts; each section gets its slice here as plain, serialisable props,
 * and the islands import its types only, so nothing the module reads
 * reaches a client chunk.
 *
 * Two things are worked out here, once, at build time, and handed down
 * as data:
 *
 *   - "When it breaks", #breaks' table: what becomes of a step when the
 *     CRM it sends to takes the call, is busy, is down all night, never
 *     answers, has moved or points inside a private network, answered by
 *     the platform's own delivery code (lib/workflows/webhook.ts
 *     `deliverJson` and `describeDelivery`), run once per scenario
 *     against a scripted receiver and a clock that only moves when told.
 *     It lives in the `.server` module so that webhook.ts and
 *     lib/security/ssrf.ts, which pull node:crypto, node:dns and
 *     node:net, load there, in the prerender, and never with the page's
 *     words; `Breaks` hands its island the table's plain rows. It is the
 *     only reason this page is `async` where the SaaS one is not: the
 *     delivery code is, so its table is awaited. That keeps the route
 *     static, as the landing's `await buildHomeTrades()` does: nothing
 *     it waits on is a request, a timer or the network, and Cache
 *     Components is off (next.config.ts), so a page that awaits pure
 *     work still prerenders. If the code stops doing what a scenario
 *     says, the build fails naming it.
 *   - The pearl lights taken apart into their pools (home/mesh-flow.ts
 *     `meshBlobs` over palette.ts SAAS_LIGHTS), for every surface whose
 *     light flows (`LiveMesh`). The recipes and their parser stay on the
 *     server; the client gets style objects. The #work room wears the
 *     hero room's light mirrored, a whole workbench below it; #build's
 *     middle card wears the mirror of its neighbours; and the card at
 *     #build's foot is the hero room's light held still, five sections
 *     down, so it takes no pools. No two lit surfaces in sight of each
 *     other match.
 *
 * Why the hero is not deferred: it holds the LCP (the h1 from md up, the
 * sub below md), and a content-visibility box above the fold would hold
 * that paint back for nothing. Everything below the cover sits in an
 * `AutoDeferred` box: the landing's `HomeDeferred`, with a reserve that
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
 * saas-credentials.css: the tally #team counts with; saas-build.css:
 * #build's rail and stations; saas-closing.css: #checks' key figures and
 * filter), then this page's own: auto.css first (the shared marks and
 * keyframes, the tier pins, forced colours), and each group of sections'
 * file after it, in page order, so a section's pin wins a tie with the
 * shared sheet. saas-explorer.css is not imported: nothing here uses its
 * classes. Every rule in this page's own files is under `.pp`, or on
 * <html> where it has to be, and every class and keyframe is prefixed
 * `auto-`.
 * ------------------------------------------------------------------ */

export const metadata: Metadata = {
  title: AUTO_META.title,
  description: AUTO_META.description,
  alternates: { canonical: "/solutions/custom-automations" },
  // A page's openGraph and twitter replace the layout's whole (metadata merges shallowly), so each is set in full.
  openGraph: {
    type: "website",
    siteName: "Neuro Tech Voice",
    url: "/solutions/custom-automations",
    title: AUTO_META.title,
    description: AUTO_META.description,
  },
  twitter: { card: "summary_large_image", title: AUTO_META.title, description: AUTO_META.description },
};

/** Each flowing surface's pools, worked out once per build (#build's still card at its foot takes none). */
const BLOBS = {
  room: meshBlobs(SAAS_LIGHTS.room.ground),
  roomMirror: meshBlobs(SAAS_LIGHTS.roomMirror.ground),
  papers: meshBlobs(SAAS_LIGHTS.papers.ground),
  stage: meshBlobs(SAAS_LIGHTS.stage.ground),
  stageMirror: meshBlobs(SAAS_LIGHTS.stageMirror.ground),
};

export default async function CustomAutomationsPage() {
  const table = await buildBreakTable();
  return (
    <SaasShell>
      {/* Ten sections, one sceptical question each, in the order an
          operations lead asks them: what have you actually automated
          (the hero); is it real, and how complex does it get (the
          workbench, the page's spine and its only autoplay, then six
          more that run by themselves here); can you automate our kind of
          work, however hard (fields by difficulty); what happens when it
          breaks at 3 a.m. (played only on the reader's pick); who builds
          it, and why trust them (the team); what would I get, in what
          order, and do I even need you (the build); what's the catch
          (the terms, after a rule: the only still section); how do I
          check all this (the checks); the doubts that remain; and how to
          start, then the credits.

          The grounds keep a rhythm down the page: white with a pearl
          room, a wash-to-stage room with a drawing then white cards,
          white with the room's mirror, a still night room then white,
          white with a pearl card, a wash band with three flowing stage
          cards and a still room card, a rule then still white, white
          with drawn figures and a still pearl card, white, then the deep
          panel and the dark footer.

          Each box's reserve is its row in deferred.tsx `RESERVES`, in
          this order: its height measured at each of 40 widths. Any
          change to a section's height changes its row there. */}
      <Hero data={AUTO_HERO} blobs={BLOBS.room} />
      <Gap />
      <AutoDeferred box="running">
        <Running data={AUTO_RUNNING} />
        <Gap />
      </AutoDeferred>
      <AutoDeferred box="work">
        <Work data={AUTO_WORK} blobs={BLOBS.roomMirror} />
        <Gap />
      </AutoDeferred>
      <AutoDeferred box="breaks">
        <Breaks data={AUTO_BREAKS} table={table} />
        <Gap />
      </AutoDeferred>
      <AutoDeferred box="team">
        <Team data={AUTO_TEAM} blobs={BLOBS.papers} />
        <Gap />
      </AutoDeferred>
      <AutoDeferred box="build">
        <AutoBuild data={AUTO_BUILD} blobs={{ stage: BLOBS.stage, mirror: BLOBS.stageMirror }} />
        <Gap />
      </AutoDeferred>
      {/* The only still section: a rule above it marks the change of
          register from instruments to terms. */}
      <AutoDeferred box="terms">
        <Rule />
        <Gap className="h-16 md:h-24" />
        <Terms data={AUTO_TERMS} />
        <Gap />
      </AutoDeferred>
      <AutoDeferred box="checks">
        <Checks data={AUTO_CHECKS} />
        <Gap />
      </AutoDeferred>
      <AutoDeferred box="faq">
        <Faq data={AUTO_FAQ} />
        <Gap />
      </AutoDeferred>
      <AutoDeferred box="start">
        <Start data={AUTO_START} credits={AUTO_CREDITS} />
        <Gap className="h-16 md:h-24" />
      </AutoDeferred>
    </SaasShell>
  );
}
