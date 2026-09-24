import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { Frame } from "@/components/site/product/primitives";
import { HomeHeading } from "@/components/site/home/heading";
import { TYPE, WEIGHT } from "@/components/site/home/type";
import type { BuildData } from "@/lib/pages/custom-saas-platforms";
import { CheckLine } from "./check-line";
import { LiveMesh } from "./live-mesh";

/* ------------------------------------------------------------------ *
 * #build — what would I get, and in what order?
 *
 * The menu's promise as the title ("A production platform, from first
 * prototype to paying customers.") and its three deliverables as the
 * three stages, read from the data module rather than retyped, so the
 * menu and the page can't disagree. Each stage says what happens in it,
 * what the reader holds at its end (the hairline block, in the light's
 * accent), where there is one, what our own platform shows of that stage
 * ("On ours", candid where ours is thin), and how to check it
 * (`CheckLine`: click the sample above, walk through ours on the free
 * trial, or ask on the call).
 *
 * THE GROUND. A full-bleed wash band (home.css `.home-wash-band`, whose
 * padding is the section's own) holding three pearl cards in the #pricing
 * plan-card grammar: each a lit surface (saas.css §2) whose light flows
 * while it is on screen (`LiveMesh`), each at its own tempo (1, 1.12,
 * 0.92), and the middle one in the mirror of its neighbours' light with
 * its pools' headings swapped (`data-swap`), so no two move or look
 * alike. A card's radius is 26px, set inline as `--saas-radius`, so the
 * flowing pools are clipped to it.
 *
 * THE RAIL (lg and up; saas-build.css §9). Over the cards, a hairline
 * with an electric line that draws left to right as the section comes up
 * the screen, and a station over each card that pops as the line reaches
 * it. All of it is driven by one registered number, `--saas-rail`, which
 * the track animates on its own view timeline and its line and stations
 * read; each station's place on the rail (`--at`) is about the left edge
 * of its card's copy. The number rests at 1, so wherever the animation
 * doesn't run — reduced motion, lite, still, weak hardware, a browser
 * without view timelines — the finished frame is a full rail with every
 * station shown.
 *
 * STACKED (below lg), the rail gives way to a short dotted connector in
 * the gutter from each card to the next, drawn downwards on its own view
 * timeline. The cards rise into place as they come (home.css
 * `home-rise`), and side by side from lg a step apart (`data-col`).
 *
 * SIDE BY SIDE, THE PARTS LINE UP. From lg each card is a subgrid of the
 * list's six rows — the stage, the title, the body, what you hold, what
 * ours shows, the check — so the "You hold" hairlines run level across
 * the three cards, and the checks sit level at their feet, whatever the
 * length of the copy above them. The first stage has no "On ours" (the
 * sample above is its proof), so its check is placed on the sixth row.
 *
 * TEXT ON THE LIGHT uses only its measured tokens (--saas-text, --saas-dim,
 * --saas-accent; palette.ts SAAS_INK) — on `stage` at its worst, flowing:
 * 12.07, 7.34 and 5.67 — and no alpha text at all. The heading's key
 * phrase sits on the wash (violet 6.49), never on a card; the rail and
 * the connectors are electric on the wash (5.21), marks.
 *
 * A server component. The client code is `LiveMesh`'s observer and the
 * heading's reveal; the rail and the connectors are CSS alone, and the
 * track and the connectors are hidden from assistive technology: the
 * order is the list's.
 * ------------------------------------------------------------------ */

/**
 * Each station's place on the rail, as a share of its width: about the
 * left edge of each card's copy when the three stand side by side (a
 * card and its gutter are a little over a third of the row).
 */
const STATIONS = [0.02, 0.36, 0.7] as const;

/** Each card's flow tempo: a higher number is slower (#pricing's first card is 1). */
const DRIFT = [1, 1.12, 0.92] as const;

export function Build({
  data,
  blobs,
}: {
  data: BuildData;
  blobs: { stage: readonly CSSProperties[]; mirror: readonly CSSProperties[] };
}) {
  const last = data.stages.length - 1;

  return (
    <section id="build" aria-labelledby="build-title" className="home-wash-band scroll-mt-28">
      <Frame>
        <HomeHeading id="build-title" eyebrow={data.eyebrow} title={data.title} titleKey={data.key} sub={data.sub} />

        <div className="relative mt-10 lg:mt-12">
          {/* The rail: a hairline, the line that draws over it, and a
              station per card (saas-build.css §9). */}
          <div aria-hidden className="saas-track relative mb-4 hidden h-6 lg:block">
            <span className="saas-rail-base absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-pp-ink/12" />
            <span className="saas-rail-line absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-(--home-electric)" />
            {data.stages.map((s, i) => (
              <span
                key={s.id}
                className="saas-station absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-(--home-electric) shadow-[0_0_0_3px_var(--home-wash)]"
                style={{ "--at": STATIONS[i] } as CSSProperties}
              />
            ))}
          </div>

          <ol className="grid gap-4 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-0">
            {data.stages.map((s, i) => {
              // The middle card: the mirrored light, its pools' headings swapped.
              const mirror = i === 1;
              return (
                <li
                  key={s.id}
                  data-col={i}
                  data-swap={mirror ? "" : undefined}
                  className={cn(
                    "saas-lit home-rise p-6 md:p-8",
                    mirror ? "saas-light-stage-m" : "saas-light-stage",
                    "lg:row-span-6 lg:grid lg:grid-rows-subgrid lg:p-6",
                  )}
                  style={{ "--saas-radius": "26px" } as CSSProperties}
                >
                  <LiveMesh blobs={mirror ? blobs.mirror : blobs.stage} drift={DRIFT[i]} />
                  <span aria-hidden className="home-grain" />
                  {/* Stacked, a dotted connector down the gutter to the next card. */}
                  {i < last && (
                    <span
                      aria-hidden
                      className="saas-link absolute top-full left-6 -ml-px h-4 border-l-2 border-dotted border-(--home-electric) md:left-8 lg:hidden"
                    />
                  )}

                  <p className="flex items-baseline gap-2">
                    <span className={cn(TYPE.mono, "text-(--saas-accent)")}>{s.n}</span>
                    <span className={cn(TYPE.label, "text-(--saas-dim)")}>{data.labels.stage}</span>
                  </p>
                  <h3 className={cn(TYPE.h3, "mt-3 text-balance text-(--saas-text)")} style={{ fontWeight: WEIGHT.h3 }}>
                    {s.title}
                  </h3>
                  <p className={cn(TYPE.body, "mt-2 max-w-[38em] text-pretty text-(--saas-text)")}>{s.body}</p>

                  <div className="mt-5 border-t border-(--saas-rule) pt-4">
                    <p className={cn(TYPE.label, "text-(--saas-accent)")}>{data.labels.hold}</p>
                    <p className={cn(TYPE.body, "mt-1 max-w-[38em] text-pretty text-(--saas-text)")}>{s.hold}</p>
                  </div>

                  {s.ours && (
                    <div className="mt-4">
                      <p className={cn(TYPE.label, "text-(--saas-dim)")}>{data.labels.ours}</p>
                      <p className={cn(TYPE.meta, "mt-1 max-w-[42em] text-pretty text-(--saas-dim)")}>{s.ours}</p>
                    </div>
                  )}

                  <CheckLine check={s.check} kinds={data.checkKinds} tone="lit" className="mt-5 lg:row-start-6" />
                </li>
              );
            })}
          </ol>
        </div>
      </Frame>
    </section>
  );
}
