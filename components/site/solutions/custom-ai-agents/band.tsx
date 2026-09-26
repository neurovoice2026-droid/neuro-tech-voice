import type { CAA_BAND } from "@/lib/pages/custom-ai-agents";
import { Frame } from "@/components/site/product/primitives";
import { CaaStage } from "./stage";

/* ------------------------------------------------------------------ *
 * The signature band.
 *
 * The one place on this page where nothing is being argued. Every other
 * section is an instrument with a claim attached; this is the breath
 * between the hero and the five of them, and it shows the reader what a
 * custom build actually is: a music-box movement, where the comb is the
 * voice and every pin on the cylinder is one decision somebody at the
 * desk already makes, set by hand, one at a time.
 *
 * It is the trades' Signature, markup for markup, so the band sits on
 * the site exactly as theirs do. Two differences only: the id comes from
 * the data, and the stage is CaaStage — ShaderStage with this page's own
 * scene loader, because this scene is not one of the sixteen trades'.
 *
 * A server component. The only client code here is the stage itself; the
 * kicker, the scrim and the reserved box are HTML from the first byte.
 *
 * It sits below the cover on purpose: the hero's standfirst is the LCP
 * element and nothing here may compete with it. The canvas has no bytes
 * on the first load, the scene is fetched only when the band gets close,
 * and the shader is not compiled until the reader has done something.
 *
 * Fixed aspect ratios rather than a height, so the band reserves its own
 * space before it has anything to put in it and the page never shifts —
 * 4:5 on a phone, where the picture has to stand up; 21:9 on a desktop,
 * where the object sits right and leaves the left open for the kicker.
 * ------------------------------------------------------------------ */

export function Band({ data }: { data: typeof CAA_BAND }) {
  return (
    <section id="band" aria-labelledby={data.id}>
      <div className="relative aspect-[4/5] w-full overflow-hidden sm:aspect-[16/10] lg:aspect-[21/9]">
        <CaaStage className="absolute inset-0" />

        {/* The shader cuts its own bottom to paper; this scrim is what
            protects the kicker over the POSTER, on a device with no WebGL,
            where there is no shader to do it. The same wash as the trades',
            so a good scene is not washed twice. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5"
          style={{ background: "linear-gradient(to top, rgb(255 255 255 / 0.92) 0%, rgb(255 255 255 / 0.6) 38%, rgb(255 255 255 / 0) 100%)" }}
        />

        <div className="pointer-events-none absolute inset-0 flex items-end">
          <Frame className="px-6 pb-8 md:px-12 md:pb-12">
            <p
              id={data.id}
              className="max-w-[560px] text-[19px] leading-7 font-medium text-pp-ink md:text-[24px] md:leading-9"
            >
              {data.kicker}
            </p>
          </Frame>
        </div>
      </div>
    </section>
  );
}
