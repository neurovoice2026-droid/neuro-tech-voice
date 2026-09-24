import { cn } from "@/lib/utils";
import { Frame } from "@/components/site/product/primitives";
import { HomeHeading } from "@/components/site/home/heading";
import { TYPE } from "@/components/site/home/type";
import type { DownRow, ExplorerData } from "@/lib/pages/custom-saas-platforms";
import { Explorer } from "./explorer";

/* ------------------------------------------------------------------ *
 * #platform — "Is that a real platform or a demo?"
 *
 * The large project the page promises is the one the reader is on, so
 * this section shows it: the platform behind this site, drawn from its
 * code, part by part — the phone carrier and the proxy at its edge, the
 * app on Vercel, the live-call gateway on Fly.io, and the services it
 * relies on — with every figure on the drawing counted from the
 * repository and held there by the page's test. The explorer (a client
 * island, explorer.tsx) walks one thing that happens through it at a
 * time, and lets the reader take parts down to see where the next call
 * goes.
 *
 * A server component. It sets the section and its heading, hands the
 * explorer its slice of the copy and the down table (worked out once,
 * at build time, by the platform's own routing code in page.tsx's
 * `buildDownTable()`), both as plain props, and closes with the foot:
 * who drew it, and how the failover it shows was checked. The data
 * module is imported for its types only.
 *
 * The section's ground is white; the drawing sits on a `.home-stage`
 * room inside the explorer, and the heading's key phrase stays on white,
 * where violet reads (never on a mesh).
 * ------------------------------------------------------------------ */

export function Platform({ data, down }: { data: ExplorerData; down: readonly DownRow[] }) {
  return (
    <section id="platform" aria-labelledby="platform-title" className="scroll-mt-28">
      <Frame>
        <HomeHeading id="platform-title" eyebrow={data.eyebrow} title={data.title} titleKey={data.key} sub={data.sub} />
        <Explorer data={data} down={down} />
        <p className={cn(TYPE.meta, "mt-8 max-w-[640px] text-pretty")}>{data.foot}</p>
      </Frame>
    </section>
  );
}
