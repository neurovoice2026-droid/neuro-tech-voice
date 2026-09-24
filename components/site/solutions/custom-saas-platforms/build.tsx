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
 * it. The track names its own view timeline, and the line and each
 * station animate nothing but `scale` on it, so the compositor draws the
 * rail; each station's place on the rail (`--at`) is about the left edge
 * of its card's copy, and `data-i` picks its keyframes. Nothing else
 * scales them, so wherever the animation doesn't run — reduced motion,
 * lite, still, weak hardware, a browser without view timelines — the
 * finished frame is a full rail with every station shown.
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
 * sample above is its proof), so its check is placed on the sixth row,
 * and its fifth, which would otherwise stand empty mid-card beside its
 * neighbours' "On ours", holds a drawing of that sample (`Screens`,
 * below). Stacked, there is no row to fill, and no drawing.
 *
 * TEXT ON THE LIGHT uses only its measured tokens (--saas-text, --saas-dim,
 * --saas-accent; palette.ts SAAS_INK) — on `stage` at its worst, flowing:
 * 12.07, 7.34 and 5.67 — and no alpha text at all. The heading's key
 * phrase sits on the wash (violet 6.49), never on a card, and may break
 * inside a word below sm rather than run off a 320px screen under a
 * reader's own text spacing (its last two words are held together); the
 * rail and the connectors are electric on the wash (5.21), marks, and the
 * drawing is the light's own dim and tick, marks too.
 *
 * A server component. The client code is `LiveMesh`'s observer and the
 * heading's reveal; the rail, the connectors and the drawing are CSS
 * alone, and all three are hidden from assistive technology: the order is
 * the list's, and the check under the drawing says where the sample is.
 * ------------------------------------------------------------------ */

/**
 * Each station's place on the rail, as a share of its width: about the
 * left edge of each card's copy when the three stand side by side (a
 * card and its gutter are a little over a third of the row). The rail's
 * keyframes repeat these (saas-build.css §9, `saas-station-0` to `-2`:
 * nothing until this place, whole a twelfth of the draw later), since a
 * keyframe's offset can't read a custom property: change one, change the
 * other.
 */
const STATIONS = [0.02, 0.36, 0.7] as const;

/** Each card's flow tempo: a higher number is slower (#pricing's first card is 1). */
const DRIFT = [1, 1.12, 0.92] as const;

/* ─── Stage 01's drawing ─────────────────────────────────────────── *
 * The sample above (prototype-demo.tsx) in miniature: its three screens
 * — Sign up, Overview, Plans — each a frame with grey bars where its
 * words and figures are and its button in the light's tick violet, and a
 * dotted link from each button on to the screen it opens. The landing's
 * figure vocabulary (home/trust-figures.tsx) at 1:1: 1.6 strokes with
 * round caps, dotted for the link, on a plate the height of a trust
 * figure's, so the row it sits in never grows past its neighbours'.
 *
 * It draws screen by screen on its own passage up the screen (the
 * `.home-draw` view timeline, staged per element in saas-build.css §9 by
 * `--o` and `--s`); wherever that doesn't run, the markup is the
 * finished drawing.
 */
const SCREEN = { w: 56, h: 36, gap: 28, r: 5 } as const;
const LINE = 1.6;
const DOTS = "0.01 4.6";
/** The plate: three screens and the two gaps between them, and half a stroke all round. */
const PLATE = { w: 3 * SCREEN.w + 2 * SCREEN.gap + 2, h: SCREEN.h + 2 } as const;
/** Where a screen's button sits, from its frame's corner: a pill, low on the right. */
const BUTTON = { x0: 36, x1: 48, y: 29, w: 5 } as const;
/** How far into the plate's draw each screen starts: one after another. */
const STEP = 0.34;

/**
 * Each screen's grey, from its frame's corner: its title's length, then
 * each bar's [left, right, middle, height] as it shows, caps and all
 * (the fields, the cards, the plans), and the chart's columns as
 * [x, height] up from the Overview's baseline.
 */
const SCREENS: readonly {
  title: number;
  bars: readonly (readonly [number, number, number, number])[];
  cols: readonly (readonly [number, number])[];
}[] = [
  { title: 20, bars: [[7, 36, 16, 4], [7, 36, 23, 4]], cols: [] },
  { title: 24, bars: [[7, 21, 16, 5], [25, 39, 16, 5]], cols: [[8, 5], [12, 8], [16, 6], [20, 9], [24, 7]] },
  { title: 18, bars: [[7, 25, 18.5, 8], [29, 47, 18.5, 8]], cols: [] },
];
const BASELINE = 31;

/** A bar's stroke, from its left end to its right, the round caps inside the ends. */
function bar(x: number, y: number, [x0, x1, by, w]: readonly [number, number, number, number]) {
  return `M${x + x0 + w / 2} ${y + by} H${x + x1 - w / 2}`;
}

/** When an element draws, as a share of the plate's pass: from `o`, for `s`. */
function at(o: number, s: number) {
  return { "--o": o, "--s": s } as CSSProperties;
}

const solid = { stroke: "currentColor", strokeWidth: LINE, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** A rounded frame, drawn clockwise from its top-left corner. */
function frame(x: number, y: number) {
  const { w, h, r } = SCREEN;
  return [
    `M${x + r} ${y} H${x + w - r} A${r} ${r} 0 0 1 ${x + w} ${y + r}`,
    `V${y + h - r} A${r} ${r} 0 0 1 ${x + w - r} ${y + h}`,
    `H${x + r} A${r} ${r} 0 0 1 ${x} ${y + h - r}`,
    `V${y + r} A${r} ${r} 0 0 1 ${x + r} ${y} Z`,
  ].join(" ");
}

function Screens() {
  return (
    <svg
      viewBox={`0 0 ${PLATE.w} ${PLATE.h}`}
      width={PLATE.w}
      height={PLATE.h}
      fill="none"
      aria-hidden
      className="saas-screens home-draw mt-5 hidden max-w-full overflow-visible text-(--saas-dim) lg:block"
    >
      {SCREENS.map((s, k) => {
        const x = 1 + k * (SCREEN.w + SCREEN.gap);
        const y = 1;
        const o = k * STEP;
        const last = k === SCREENS.length - 1;
        // The link leaves just past this frame, at the button's height, and
        // stops short of the next one with its head.
        const tip = x + SCREEN.w + SCREEN.gap - 3;
        return (
          <g key={x}>
            {/* The screen's white comes up with its edge, rather than
                waiting for it as a blank. */}
            <rect
              x={x}
              y={y}
              width={SCREEN.w}
              height={SCREEN.h}
              rx={SCREEN.r}
              className="saas-screens-fade fill-white/70"
              style={at(o, 0.26)}
            />
            <path d={frame(x, y)} pathLength={1} style={at(o, 0.26)} {...solid} />
            <path
              d={bar(x, y, [7, 7 + s.title, 8, 2.4])}
              pathLength={1}
              style={at(o + 0.12, 0.1)}
              {...solid}
              strokeWidth={2.4}
              strokeOpacity={0.55}
            />
            {s.bars.map((b, i) => (
              <path
                key={b.join()}
                d={bar(x, y, b)}
                pathLength={1}
                style={at(o + 0.15 + i * 0.03, 0.1)}
                {...solid}
                strokeWidth={b[3]}
                strokeOpacity={0.14}
              />
            ))}
            {s.cols.map(([cx, h], i) => (
              <path
                key={cx}
                d={`M${x + cx} ${y + BASELINE} V${y + BASELINE - h}`}
                pathLength={1}
                style={at(o + 0.17 + i * 0.015, 0.08)}
                {...solid}
                strokeWidth={2.6}
                strokeOpacity={0.24}
              />
            ))}
            <g className="text-(--saas-tick)">
              <path
                d={bar(x, y, [BUTTON.x0, BUTTON.x1, BUTTON.y, BUTTON.w])}
                pathLength={1}
                style={at(o + 0.21, 0.07)}
                {...solid}
                strokeWidth={BUTTON.w}
              />
              {!last && (
                <>
                  <path
                    d={`M${x + SCREEN.w + 4} ${y + BUTTON.y} H${tip - 4}`}
                    className="saas-screens-fade"
                    style={at(o + 0.26, 0.08)}
                    {...solid}
                    strokeDasharray={DOTS}
                  />
                  <path
                    d={`M${tip - 3} ${y + BUTTON.y - 3} L${tip} ${y + BUTTON.y} L${tip - 3} ${y + BUTTON.y + 3}`}
                    pathLength={1}
                    style={at(o + 0.3, 0.06)}
                    {...solid}
                  />
                </>
              )}
            </g>
          </g>
        );
      })}
    </svg>
  );
}

export function Build({
  data,
  blobs,
}: {
  data: BuildData;
  blobs: { stage: readonly CSSProperties[]; mirror: readonly CSSProperties[] };
}) {
  const last = data.stages.length - 1;

  return (
    <section id="build" aria-labelledby="build-title" className="home-wash-band scroll-mt-8">
      <Frame>
        <HomeHeading
          id="build-title"
          eyebrow={data.eyebrow}
          title={data.title}
          titleKey={data.key}
          sub={data.sub}
          className="max-sm:[&_.home-key]:[overflow-wrap:anywhere]"
        />

        <div className="relative mt-10 lg:mt-12">
          {/* The rail: a hairline, the line that draws over it, and a
              station per card (saas-build.css §9). */}
          <div aria-hidden className="saas-track relative mb-4 hidden h-6 lg:block">
            <span className="saas-rail-base absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-pp-ink/12" />
            <span className="saas-rail-line absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-(--home-electric)" />
            {data.stages.map((s, i) => (
              <span
                key={s.id}
                data-i={i}
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
                  {/* In the row where the others say what ours shows, the sample
                      itself, drawn (from lg only: stacked, there is no row to fill). */}
                  {s.id === "prototype" && <Screens />}

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
