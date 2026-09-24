import type { CSSProperties } from "react";
import { Frame } from "@/components/site/product/primitives";
import { HomeHeading } from "@/components/site/home/heading";
import type { ScopeData } from "@/lib/pages/custom-saas-platforms";
import { ScopeInstrument } from "./scope-instrument";

/* ------------------------------------------------------------------ *
 * #scope — what goes into mine, and what makes it harder?
 *
 * The question a buyer asks right after "what have you built": fine, but
 * what would mine take? The answer is an instrument, not a list. The
 * reader picks what their product needs — teams with roles, an admin for
 * their staff, subscriptions, usage billing, the tools their customers
 * already use, data brought over, something live, data that must stay in
 * one region — and the parts it takes fill in across the four layers
 * every platform has (the menu's own stack: web app, database, payments,
 * hosting). Eight parts are always there, the bones; the rest arrive with
 * the needs that ask for them.
 *
 * Every part says two things, plainly and in that order: what usually
 * breaks there, and what the platform this page runs on does about it.
 * That is where the hard parts live — the session checked on the server,
 * the security policy on every page, the rows walled off per customer,
 * the webhook nobody can forge, the invoice issued once however often
 * the payment notice retries — each led by the failure a non-technical
 * founder would recognise, before the mechanism. And where our platform
 * proves nothing (it has no teams, a thin admin, and it never imported
 * anyone's data), the part says so, in the same place and the same
 * voice: "Thin on ours", "Not on ours".
 *
 * NO PRICE, NO DATE. The parts a reader picks are what a quote is made
 * of, and the section says that in its sub and its foot; nothing here
 * counts money or weeks, and the only figures are how many parts.
 *
 * The section is a server component: the heading (its lines rise once,
 * then the key phrase eases into violet) and the instrument, which is
 * the client island (scope-instrument.tsx). The instrument gets its slice
 * of the data module and the room's pools as plain props: the words, and
 * the scope room's light — the hero room's, mirrored (palette.ts
 * `mirrorMesh`), so the two rooms a few screens apart never read as one
 * template.
 * ------------------------------------------------------------------ */

export function Scope({ data, blobs }: { data: ScopeData; blobs: readonly CSSProperties[] }) {
  return (
    <section id="scope" aria-labelledby="scope-title" className="scroll-mt-28">
      <Frame>
        <HomeHeading id="scope-title" eyebrow={data.eyebrow} title={data.title} titleKey={data.key} sub={data.sub} />
        <ScopeInstrument data={data} blobs={blobs} />
      </Frame>
    </section>
  );
}
