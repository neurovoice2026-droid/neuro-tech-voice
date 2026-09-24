import { cn } from "@/lib/utils";
import { Frame } from "@/components/site/product/primitives";
import { HomeHeading } from "@/components/site/home/heading";
import { TYPE } from "@/components/site/home/type";
import type { PrototypeData } from "@/lib/pages/custom-saas-platforms";
import { PrototypeDemo } from "./prototype-demo";

/* ------------------------------------------------------------------ *
 * #prototype — will I see it before I pay for code?
 *
 * Yes, and here is what that looks like: a three-screen sample the
 * reader can click through (prototype-demo.tsx), on the landing's stage,
 * beside the argument for it. A build's first deliverable is a prototype
 * — every screen that matters, linked so it can be used — because that
 * is where the product gets argued about while a change is still a
 * redraw, not a rewrite. The sample is labelled as a sample on the
 * stage itself and under it, and made for no product in particular:
 * placeholder words, grey bars where figures and prices would be, no
 * business and no person invented for it.
 *
 * LAYOUT. One column to lg, in reading order: the heading, the sample,
 * then what a prototype settles. From lg, two columns: the heading and
 * the list stand left at 384px, one over the other, and the sample
 * stands right across both rows, sticky under the header, so it stays
 * in reach while the list beside it is read. (The shell's main is
 * `overflow-x-clip`, not hidden, so the sticky column still sticks.)
 *
 * WHAT A PROTOTYPE SETTLES is an ordered list — the four questions a
 * prototype answers before anything is built — each item under its own
 * hairline with a mono ordinal in violet (7.10 on white), which a screen
 * reader skips: the list already says where it is. Two to a row at md,
 * where the section is one wide column; one again beside the sample.
 *
 * The motion is the sample's: a view transition between screens and a
 * one-time pulse on the hotspots (saas-build.css §8). This half is a
 * server component and ships nothing but the heading's line reveal; the
 * heading's key phrase is on white, never on a mesh.
 * ------------------------------------------------------------------ */

export function Prototype({ data }: { data: PrototypeData }) {
  return (
    <section id="prototype" aria-labelledby="prototype-title" className="scroll-mt-28">
      <Frame
        className={cn(
          "grid gap-10",
          "lg:grid-cols-[384px_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-x-12 lg:gap-y-10",
        )}
      >
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <HomeHeading
            id="prototype-title"
            eyebrow={data.eyebrow}
            title={data.title}
            titleKey={data.key}
            sub={data.sub}
          />
        </div>

        <div className="min-w-0 lg:sticky lg:top-28 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          <PrototypeDemo data={data} />
        </div>

        <div className="min-w-0 lg:col-start-1 lg:row-start-2">
          <h3 className={cn(TYPE.label, "text-pp-muted")}>{data.settles.title}</h3>
          <ol className="mt-4 grid gap-3 md:grid-cols-2 md:gap-x-8 lg:grid-cols-1">
            {data.settles.items.map((item, i) => (
              <li
                key={item}
                className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 border-t border-pp-rule pt-3"
              >
                <span aria-hidden className={cn(TYPE.mono, "text-(--home-violet)")}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className={cn(TYPE.body, "text-pretty")}>{item}</span>
              </li>
            ))}
          </ol>
          <p className={cn(TYPE.meta, "mt-6 max-w-[34em] text-pretty")}>{data.foot}</p>
        </div>
      </Frame>
    </section>
  );
}
