import type { Metadata } from "next";
import { Gap, Rule } from "@/components/site/product/primitives";
import { meshBlobs } from "@/components/site/home/mesh-flow";
import "@/components/site/home/home.css";
// The lite tier's rules (no grain, no home-rise) whichever island loads motion.ts first.
import "@/components/site/home/tier.css";
import "@/components/site/solutions/custom-saas-platforms/saas.css";
import "@/components/site/solutions/custom-saas-platforms/saas-credentials.css"; // Team's tally
import "@/components/site/solutions/custom-saas-platforms/saas-build.css"; // #shape's proto slide, #move's rail, .saas-link, [data-col]
import "@/components/site/solutions/custom-saas-platforms/saas-closing.css"; // #checks
import "@/components/site/solutions/crm-erp/erp.css";
import "@/components/site/solutions/crm-erp/erp-drawing.css";
import "@/components/site/solutions/crm-erp/erp-process.css";
import "@/components/site/solutions/crm-erp/erp-shape.css";
import "@/components/site/solutions/crm-erp/erp-move.css";
import "@/components/site/solutions/crm-erp/erp-core.css";
import {
  ERP_CHECKS,
  ERP_CORE,
  ERP_CREDITS,
  ERP_FAQ,
  ERP_HERO,
  ERP_META,
  ERP_MOVE,
  ERP_PROCESS,
  ERP_SHAPE,
  ERP_START,
  ERP_TEAM,
  ERP_TERMS,
} from "@/lib/pages/crm-erp";
import { SAAS_LIGHTS } from "@/components/site/solutions/custom-saas-platforms/palette";
import { SaasShell } from "@/components/site/solutions/custom-saas-platforms/shell";
import { Hero } from "@/components/site/solutions/custom-saas-platforms/hero";
import { Terms } from "@/components/site/solutions/custom-saas-platforms/terms";
import { Checks } from "@/components/site/solutions/custom-saas-platforms/checks";
import { Faq } from "@/components/site/solutions/custom-saas-platforms/faq";
import { Start } from "@/components/site/solutions/custom-saas-platforms/start";
import { Team } from "@/components/site/solutions/custom-automations/team";
import { ErpDeferred } from "@/components/site/solutions/crm-erp/deferred";
import { Process } from "@/components/site/solutions/crm-erp/process";
import { Shape } from "@/components/site/solutions/crm-erp/shape";
import { Move } from "@/components/site/solutions/crm-erp/move";
import { Core } from "@/components/site/solutions/crm-erp/core";

/* ------------------------------------------------------------------ *
 * /solutions/crm-erp — "Your process, drawn".
 *
 * The argument: any CRM or ERP, shaped around how you work — we design
 * and build CRMs, ERPs and anything between, for any business, of any
 * size and complexity, in whatever technology suits it — and the hard
 * parts already run here, on the platform this page is served from: our
 * own, for AI phone agents, the proof and never the limit. It shows a
 * sample business's scattered tools gathered into one system, laid out
 * as lanes of who does what, with one customer followed through eight
 * steps into one record, each step tagged with whether the same part
 * runs here and the card that proves it; any kind of business, and how
 * much of it goes in, drawn as a sample, then a fair "Off the shelf, or
 * built for you?"; the move off spreadsheets and old tools (a rehearsal,
 * three stages, what stays connected, whose it is); and the parts a CRM
 * has to get right, counted from this platform's code, with what it
 * lacks (stock, orders, purchasing, roles) marked once and built for
 * yours. After that: who builds it, the terms, how to check each claim,
 * the questions, and how to start.
 *
 * THE DESIGN SYSTEM IS THE SIBLINGS', imported rather than copied, and
 * not one of their lines changes for this page: the SaaS shell (the
 * light header, the `pp home-body saas-page` main with its preloaded
 * faces, the jump and settle helpers, the footer), its lights (palette.ts
 * SAAS_LIGHTS, no new recipe), its width-aware reserve (through this
 * page's `ErpDeferred`, deferred.tsx), its hero, terms, checks, FAQ and
 * start sections as they are, and the Automations page's #team, each
 * handed this page's words. #checks' view-transition filter works here
 * unchanged: saas-closing.css names the boxes after it by #faq and
 * #start, the ids this page gives them too. And #shape's card wears
 * `saas-proto-screen`, the SaaS prototype's class, so vt.ts's "proto"
 * scope (its guard against a card under the header included) and
 * saas-build.css's slide of that screen, with its `back` type, apply to
 * a business pick unchanged. Nothing else here wears the class, so the
 * name stays unique; #process's record window changes its body with the
 * tour's own entrance, not a view transition. lib/pages/crm-erp.test.ts
 * holds that contract, the order of the imports above and the order of
 * the boxes below.
 *
 * Why static, and not async: nothing here depends on who is looking, and
 * nothing is awaited. No cookies(), headers() or searchParams, so the
 * route prerenders (○) and the copy is in the HTML for search and for
 * anyone without script. Every word lives in the server-only data module
 * (lib/pages/crm-erp.ts), which reads its facts from their sources —
 * the platform's own constants, the siblings' modules — and throws at
 * build when one drifts. Each section gets its slice here as plain,
 * serialisable props, and the islands import its types only, so nothing
 * the module reads reaches a client chunk.
 *
 * One thing is worked out here, once, at build time, and handed down as
 * data: the pearl lights taken apart into their pools (home/mesh-flow.ts
 * `meshBlobs` over palette.ts SAAS_LIGHTS), for every surface whose light
 * flows (`LiveMesh`). The recipes and their parser stay on the server;
 * the client gets style objects. #shape's room wears the hero room's
 * light mirrored, #move's middle card the mirror of its neighbours, and
 * #team's card the papers light, so no two lit surfaces in sight of each
 * other match. #process's stage and #core's night room are still, and
 * take no pools.
 *
 * Why the hero is not deferred: it holds the LCP (the h1 from md up, the
 * sub below md), and a content-visibility box above the fold would hold
 * that paint back for nothing. Everything below the cover sits in an
 * `ErpDeferred` box: the landing's `HomeDeferred`, with a reserve that
 * follows the width inside each tier (deferred.tsx). A reserve off the
 * truth moves the page under the reader when its box first paints, and
 * lands a jump past it in the wrong place (the hero's jumps, #process's
 * links to each #core card, a shared link to #ledger or #connect); what
 * the reserves leave, a page that opens part-way down (settle.tsx) and
 * every same-page jump (jumps.tsx) catch, through the SaaS shell.
 *
 * The CSS is route-scoped and imported here, once, so it ships with this
 * route only: the landing's tokens and shared classes (home.css), its
 * tier rules (tier.css — home/motion.ts imports it too, but not every
 * island here loads motion.ts), the four SaaS sheets whose rules the
 * reused parts carry (saas.css: the lights, the lit surface, the mesh
 * flow, the hero's plates, the view-transition root, the lite tier;
 * saas-credentials.css: the tally #team counts with; saas-build.css: the
 * "proto" screen's name and its slide, #move's rail and stations, the
 * dotted links between its cards, the columns' rise; saas-closing.css:
 * #checks' key figures and filter), then this page's own: erp.css first
 * (the shared keyframes and marks, forced colours, the reduced-motion
 * and still pins, the two switches, the mono face's fallback), then the
 * drawing both of #process's compositions share (erp-drawing.css), and
 * each section's file after it, in page order — #process, #shape, #move,
 * #core — so a section's pin wins a tie with the shared sheet. The SaaS
 * explorer's sheet and the Automations and Mobile pages' sheets are not
 * imported: nothing here uses their classes. Every rule in this page's
 * own files is under `.pp`, or on <html> where it has to be, and every
 * class and keyframe is prefixed `erp-`.
 * ------------------------------------------------------------------ */

export const metadata: Metadata = {
  title: ERP_META.title,
  description: ERP_META.description,
  alternates: { canonical: "/solutions/crm-erp" },
  // A page's openGraph and twitter replace the layout's whole (metadata merges shallowly), so each is set in full.
  openGraph: {
    type: "website",
    siteName: "Neuro Tech Voice",
    url: "/solutions/crm-erp",
    title: ERP_META.title,
    description: ERP_META.description,
  },
  twitter: { card: "summary_large_image", title: ERP_META.title, description: ERP_META.description },
};

/** Each flowing surface's pools, worked out once per build (#process's stage and #core's night room are still, and take none). */
const BLOBS = {
  room: meshBlobs(SAAS_LIGHTS.room.ground),
  roomMirror: meshBlobs(SAAS_LIGHTS.roomMirror.ground),
  papers: meshBlobs(SAAS_LIGHTS.papers.ground),
  stage: meshBlobs(SAAS_LIGHTS.stage.ground),
  stageMirror: meshBlobs(SAAS_LIGHTS.stageMirror.ground),
};

export default function CrmErpPage() {
  return (
    <SaasShell>
      {/* Ten sections, one sceptical question each, in the order an owner
          asks them: what do you build, and why believe you (the hero);
          will it fit our process, not force us into someone else's (your
          process, drawn: the page's spine and its only autoplay); can it
          fit our kind of business, how far can it go, and why not buy one
          (shaped around yours, then "Off the shelf, or built for you?");
          how do we get off our spreadsheets without losing anything, will
          it connect to what we keep, and whose is it (the move); is any
          of this real (what a CRM has to get right, already running
          here); who builds it, and why trust them (the team); what's the
          catch (the terms, after a rule: the only still section); how do
          I check all this (the checks); the doubts that remain; and how
          to start, then the credits.

          The grounds keep a rhythm down the page: white with a pearl
          room, a still stage room holding the lanes and the record
          window, white controls over the room's mirror then the ledger on
          white with three drawn figures, a wash band with a white figure
          card and three flowing stage cards then white, white over a
          still night room with a drawn wire, a riding token and white
          cards, white with a pearl card, a rule then still white, white
          with drawn figures and a still pearl card, white, then the deep
          panel and the dark footer.

          Each box's reserve is its row in deferred.tsx `RESERVES`, in
          this order: its height at each of the widths in `RESERVE_AT`.
          Any change to a section's height changes its row there. */}
      <Hero data={ERP_HERO} blobs={BLOBS.room} />
      <Gap />
      <ErpDeferred box="process">
        <Process data={ERP_PROCESS} />
        <Gap />
      </ErpDeferred>
      <ErpDeferred box="shape">
        <Shape data={ERP_SHAPE} blobs={BLOBS.roomMirror} />
        <Gap />
      </ErpDeferred>
      <ErpDeferred box="move">
        <Move data={ERP_MOVE} blobs={{ stage: BLOBS.stage, mirror: BLOBS.stageMirror }} />
        <Gap />
      </ErpDeferred>
      <ErpDeferred box="core">
        <Core data={ERP_CORE} />
        <Gap />
      </ErpDeferred>
      <ErpDeferred box="team">
        <Team data={ERP_TEAM} blobs={BLOBS.papers} />
        <Gap />
      </ErpDeferred>
      {/* The only still section: a rule above it marks the change of
          register from instruments to terms. */}
      <ErpDeferred box="terms">
        <Rule />
        <Gap className="h-16 md:h-24" />
        <Terms data={ERP_TERMS} />
        {/* Its last link's 44px target reaches past the section's foot:
            the empty Gap after it lets the pointer through to it. */}
        <Gap className="pointer-events-none" />
      </ErpDeferred>
      <ErpDeferred box="checks">
        <Checks data={ERP_CHECKS} />
        <Gap />
      </ErpDeferred>
      <ErpDeferred box="faq">
        <Faq data={ERP_FAQ} />
        <Gap />
      </ErpDeferred>
      <ErpDeferred box="start">
        <Start data={ERP_START} credits={ERP_CREDITS} />
        <Gap className="h-16 md:h-24" />
      </ErpDeferred>
    </SaasShell>
  );
}
