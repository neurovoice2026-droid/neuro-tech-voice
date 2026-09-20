import type { Trade } from "@/lib/pages/industries/schema";
import { Frame } from "../product/primitives";
import { ShaderStage } from "./shader-stage";

/* ------------------------------------------------------------------ *
 * The signature band.
 *
 * One full-bleed image per trade, and it is the only place on these
 * pages where nothing is being argued. Everything else is an instrument
 * with a claim attached; this is the page taking a breath and showing
 * the reader the thing their phone is actually about — water crossing a
 * ceiling, a floor filling at eight o'clock, a route being run.
 *
 * It sits below the cover on purpose. The hero's standfirst is the LCP
 * element on all sixteen routes and nothing here may compete with it:
 * the canvas has no bytes on the first load, its scene is fetched only
 * when the band gets close, and the shader is not compiled until the
 * reader has done something.
 *
 * Fixed aspect ratios rather than a height, so the band reserves its own
 * space before it has anything to put in it and the page never shifts.
 * ------------------------------------------------------------------ */

export function Signature({ trade }: { trade: Trade }) {
  return (
    <section aria-labelledby={`signature-${trade.slug}`}>
      <div className="relative aspect-[4/5] w-full overflow-hidden sm:aspect-[16/10] lg:aspect-[21/9]">
        <ShaderStage slug={trade.slug} className="absolute inset-0" />

        {/* The shader cuts its own bottom to paper, so this scrim is not the
            main guard any more — it is what protects the kicker over the
            POSTER, on a device with no WebGL, where there is no shader to do
            it. Lighter than it was, so a good scene is not washed twice. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5"
          style={{ background: "linear-gradient(to top, rgb(255 255 255 / 0.92) 0%, rgb(255 255 255 / 0.6) 38%, rgb(255 255 255 / 0) 100%)" }}
        />

        <div className="pointer-events-none absolute inset-0 flex items-end">
          <Frame className="px-6 pb-8 md:px-12 md:pb-12">
            <p
              id={`signature-${trade.slug}`}
              className="max-w-[560px] text-[19px] leading-7 font-medium text-pp-ink md:text-[24px] md:leading-9"
            >
              {trade.kicker}
            </p>
          </Frame>
        </div>
      </div>
    </section>
  );
}
