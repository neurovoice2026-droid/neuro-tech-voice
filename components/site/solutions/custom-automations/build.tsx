import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { CornerDot } from "@/components/site/corner-dot";
import { IntentLink } from "@/components/site/intent-link";
import { Frame } from "@/components/site/product/primitives";
import { HomeHeading } from "@/components/site/home/heading";
import { TYPE, WEIGHT } from "@/components/site/home/type";
import type { AutoBuildData } from "@/lib/pages/custom-automations";
import { CheckLine } from "@/components/site/solutions/custom-saas-platforms/check-line";
import { LiveMesh } from "@/components/site/solutions/custom-saas-platforms/live-mesh";

/* ------------------------------------------------------------------ *
 * #build — what would I get, and in what order? And do I need you?
 *
 * The menu's promise as the title ("Every copy-paste between your
 * tools, replaced by a workflow that runs itself.") and its three
 * deliverables as the three stages — a map of the manual steps, the
 * workflows, the alerts — read from the data module rather than
 * retyped, so the menu and the page can't disagree. Each stage says
 * what happens in it, what the reader holds at its end (the hairline
 * block, in the light's accent), where there is one, what this
 * platform's own automations show of that stage ("On ours": signed and
 * retried webhooks, one invoice per payment, a morning job whose steps
 * stand alone; a person texted mid-call, usage emails, every run
 * recorded with its outcome), and how to check it
 * (`CheckLine`: the four maps above, a break in #breaks, or the call).
 *
 * Then, at the foot, "When you don't need us": the product's own
 * self-serve workflows (/product/integrations), for the reader whose
 * whole need is a follow-up after the AI agent's calls. Saying where
 * the line is — set it up yourself in three steps, with no build — is
 * what makes "we automate anything" read as advice rather than a pitch.
 *
 * THE SAAS `Build` GRAMMAR, REBUILT HERE (its build.tsx keys its stage-01
 * drawing to its own stage id and doesn't export its stations). Every
 * class is saas-build.css §9's, imported by the page as it is:
 *
 *   · THE GROUND. A full-bleed wash band (home.css `.home-wash-band`,
 *     whose padding is the section's own) holding three pearl cards in
 *     the #pricing plan-card grammar: each a lit surface (saas.css §2)
 *     whose light flows while it is on screen (`LiveMesh`), each at its
 *     own tempo (1, 1.12, 0.92), and the middle one in the mirror of its
 *     neighbours' light with its pools' headings swapped (`data-swap`),
 *     so no two move or look alike. A card's radius is 26px, set inline
 *     as `--saas-radius`, so the flowing pools are clipped to it.
 *   · THE RAIL (lg and up). Over the cards, a hairline with an electric
 *     line that draws left to right as the section comes up the screen,
 *     and a station over each card that pops as the line reaches it:
 *     `scale` only, on the track's own view timeline. Each station's
 *     place (`--at`, from STATIONS) is the one saas-build.css's
 *     `saas-station-0` to `-2` keyframes stop at; the data module's test
 *     holds the two files' STATIONS equal.
 *   · STACKED (below lg), a short dotted connector down the gutter from
 *     each card to the next, drawn downwards on its own view timeline.
 *     The cards rise as they come (`home-rise`), and from lg a step
 *     apart (`data-col`).
 *   · SIDE BY SIDE, THE PARTS LINE UP. From lg each card is a subgrid of
 *     the list's six rows — the stage, the title, the body, what you
 *     hold, what ours shows, the check — so the "You hold" hairlines run
 *     level across the three cards and the checks sit level at their
 *     feet. The first stage has no "On ours" (the four maps above are
 *     its proof), so its check is placed on the sixth row, and its
 *     fifth, which would otherwise stand empty beside its neighbours'
 *     "On ours", holds a drawing of a map (`MapFigure`, below). Stacked,
 *     there is no row to fill, and no drawing.
 *
 * THE SELF-SERVE CARD stands under the three, apart from the list: the
 * hero room's pearl (`saas-light-room`), five sections below the hero
 * and a different light from the stage cards above it, and STILL — no
 * `LiveMesh`, a grain only — so the page's flowing surfaces stay six and
 * the answer "you may not need us" reads calm. It rises once as it comes
 * (`home-rise`, a little sooner than a card: auto-closing.css §2). Its
 * label and its paragraph on the left; its one link on the right from
 * md, level with the paragraph's last line, a 44px target whose words
 * alone are underlined and whose arrow is held to the last of them.
 *
 * TEXT ON THE LIGHT uses only its measured tokens (--saas-text, --saas-dim,
 * --saas-accent; palette.ts SAAS_INK) — on `stage` at its worst, flowing:
 * 12.06, 7.34 and 5.67; on the still room card 12.42, 7.55 and 5.84 —
 * and no alpha text at all. The heading's key phrase sits on the wash
 * (violet 6.49), never on a card, and may break inside a word below sm
 * rather than run off a 320px screen under a reader's own text spacing;
 * the rail and the connectors are electric on the wash (5.21), marks,
 * and the drawing is the light's own dim and tick, marks too.
 *
 * A server component. The client code is `LiveMesh`'s observer, the
 * heading's reveal and the one route link (IntentLink, which prefetches
 * on intent); the rail, the connectors and the drawing are CSS alone,
 * and all three are hidden from assistive technology: the order is the
 * list's, and what the drawing shows — every step, what it becomes, and
 * what stays with a person — is the first card's own body and "You
 * hold" line, in words. The focus ring is written out here because
 * controls.tsx is a client module.
 * ------------------------------------------------------------------ */

/** controls.tsx RING_LIGHT, spelled out: a ring in the ground's ink (on a light, its text token). */
const RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink";

/**
 * Each station's place on the rail, as a share of its width: about the
 * left edge of each card's copy when the three stand side by side. The
 * SaaS page's values, because saas-build.css's `saas-station-0` to `-2`
 * keyframes stop there (nothing until this place, whole a twelfth of the
 * draw later) and a keyframe's offset can't read a custom property: the
 * data module's test holds these equal to the SaaS build.tsx's.
 */
const STATIONS = [0.02, 0.36, 0.7] as const;

/** Each card's flow tempo: a higher number is slower (#pricing's first card is 1). */
const DRIFT = [1, 1.12, 0.92] as const;

/* ─── Stage 01's drawing: a map ──────────────────────────────────── *
 * What stage 01 hands over, in miniature: five steps of the work as a
 * person does it today, written down in a row (each a grey bar, its
 * name, and a fainter line under it, its detail); over the middle three
 * a dotted arrow up to a node on a short rail above — the flow software
 * takes them into — and over the two at either end a person, standing
 * on the step that stays with them: the one who starts the work, and
 * the one who makes the call at the end. The landing's figure
 * vocabulary (home/trust-figures.tsx) at 1:1: 1.6 strokes with round
 * caps, dotted for a link, on the SaaS stage-01 plate (226 × 38), so
 * the row it sits in grows no taller than the SaaS drawing's did. Grey
 * in the light's dim, the flow in its tick, the people in its dim at
 * full strength: marks, and never colour alone — the flow is up on a
 * rail, the people are figures standing where the work was.
 *
 * It draws step by step on its own passage up the screen (the
 * `.home-draw` view timeline, staged per element in auto-closing.css §3
 * by `--o` and `--s`): the five steps written down one after another,
 * then the arrows, then the rail and its nodes, then the people.
 * Wherever that doesn't run, the markup is the finished drawing.
 */
const PLATE = { w: 226, h: 38 } as const;
const LINE = 1.6;
const DOTS = "0.01 4.6";
/** A step as written down: a bar and the fainter line under it, and how thick each is. */
const STEP = { w: 30, sub: 14, bar: 2.4, detail: 4 } as const;
/** Five steps, the first and last flush with the plate, half a stroke in. */
const COUNT = 5;
const PITCH = (PLATE.w - 2 - STEP.w) / (COUNT - 1);
/** What becomes of each step on the map: taken into the flow, or kept by a person. */
const FATE: readonly ("flow" | "person")[] = ["person", "flow", "flow", "flow", "person"];
/**
 * The drawing's rows, down from the plate's top: the rail and its nodes;
 * an arrow's head and its tail; a person's head and the foot of their
 * shoulders; the step's bar and the line under it.
 */
const Y = { rail: 6, tip: 11, tail: 25, head: 18.5, shoulders: 26, bar: 29.5, detail: 34.5 } as const;
/** A flow node's radius (a 5u disc), a person's head (3u across) and their shoulders' arc (5u across). */
const NODE = 2.5;
const HEAD = 1.5;
const SHOULDER = 2.5;
/** How far the rail runs past its end nodes, so it reads as a rail and not a line between two dots. */
const RUN_ON = 10;

const left = (k: number) => 1 + k * PITCH;
const mid = (k: number) => left(k) + STEP.w / 2;

/** When an element draws, as a share of the figure's pass: from `o`, for `s`. Read by auto-closing.css §3. */
function at(o: number, s: number) {
  return { "--o": o, "--s": s } as CSSProperties;
}

const solid = { stroke: "currentColor", strokeWidth: LINE, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** A horizontal stroke `w` thick from `x0` to `x1`, the round caps inside the ends. */
function bar(x0: number, x1: number, y: number, w: number) {
  return `M${x0 + w / 2} ${y} H${x1 - w / 2}`;
}

function MapFigure() {
  const flow = FATE.flatMap((f, k) => (f === "flow" ? [k] : []));
  const first = flow[0];
  const last = flow[flow.length - 1];
  return (
    <svg
      viewBox={`0 0 ${PLATE.w} ${PLATE.h}`}
      width={PLATE.w}
      height={PLATE.h}
      fill="none"
      aria-hidden
      className="auto-map-fig home-draw mt-5 hidden max-w-full overflow-visible text-(--saas-dim) lg:block"
    >
      {/* The steps, written down one after another. */}
      {FATE.map((_, k) => (
        <g key={k}>
          <path
            d={bar(left(k), left(k) + STEP.w, Y.bar, STEP.bar)}
            pathLength={1}
            style={at(k * 0.12, 0.1)}
            {...solid}
            strokeWidth={STEP.bar}
            strokeOpacity={0.55}
          />
          <path
            d={bar(left(k), left(k) + STEP.sub, Y.detail, STEP.detail)}
            pathLength={1}
            style={at(k * 0.12 + 0.03, 0.08)}
            {...solid}
            strokeWidth={STEP.detail}
            strokeOpacity={0.14}
          />
        </g>
      ))}

      {/* The flow, in the tick: an arrow up from each step software
          takes, the rail they join, a node on it for each. The arrows
          are dotted, which a dash draw would wreck, so they fade in on
          their slices (`.auto-map-fade`); a node pops as the rail
          reaches it. */}
      <g className="text-(--saas-tick)">
        {flow.map((k, i) => (
          <g key={k} className="auto-map-fade" style={at(0.6 + i * 0.03, 0.1)}>
            <path d={`M${mid(k)} ${Y.tail} V${Y.tip + 3.5}`} {...solid} strokeDasharray={DOTS} />
            <path d={`M${mid(k) - 2.2} ${Y.tip + 2.2} L${mid(k)} ${Y.tip} L${mid(k) + 2.2} ${Y.tip + 2.2}`} {...solid} />
          </g>
        ))}
        <path
          d={`M${mid(first) - RUN_ON} ${Y.rail} H${mid(last) + RUN_ON}`}
          pathLength={1}
          style={at(0.68, 0.14)}
          {...solid}
        />
        {flow.map((k, i) => (
          <circle
            key={k}
            cx={mid(k)}
            cy={Y.rail}
            r={NODE}
            fill="currentColor"
            className="auto-map-fade auto-map-dot"
            style={at(0.7 + i * 0.04, 0.08)}
          />
        ))}
      </g>

      {/* The people, each standing on the step that stays with them. */}
      {FATE.map((f, k) =>
        f === "person" ? (
          <g key={k}>
            <path
              d={`M${mid(k) - HEAD} ${Y.head} a${HEAD} ${HEAD} 0 1 0 ${2 * HEAD} 0 a${HEAD} ${HEAD} 0 1 0 ${-2 * HEAD} 0`}
              pathLength={1}
              style={at(k === 0 ? 0.8 : 0.84, 0.08)}
              {...solid}
            />
            <path
              d={`M${mid(k) - SHOULDER} ${Y.shoulders} A${SHOULDER} ${SHOULDER} 0 0 1 ${mid(k) + SHOULDER} ${Y.shoulders}`}
              pathLength={1}
              style={at(k === 0 ? 0.83 : 0.87, 0.08)}
              {...solid}
            />
          </g>
        ) : null,
      )}
    </svg>
  );
}

export function AutoBuild({
  data,
  blobs,
}: {
  data: AutoBuildData;
  blobs: { stage: readonly CSSProperties[]; mirror: readonly CSSProperties[] };
}) {
  const last = data.stages.length - 1;
  const self = data.selfServe;
  // The link's arrow is held to its last word (the credentials' `Arrowed`).
  const cut = self.link.label.lastIndexOf(" ") + 1;

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
                  {/* In the row where the others say what ours shows, the
                      map itself, drawn (from lg only: stacked, there is
                      no row to fill). */}
                  {s.id === "map" && <MapFigure />}

                  <CheckLine check={s.check} kinds={data.checkKinds} tone="lit" className="mt-5 lg:row-start-6" />
                </li>
              );
            })}
          </ol>
        </div>

        {/* When you don't need us: a still room card, its grain and no
            flowing light (saas.css §2 without `LiveMesh`). */}
        <div
          className={cn(
            "saas-lit saas-light-room home-rise auto-selfserve mt-10 grid gap-4 p-6 lg:mt-12",
            "md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:gap-12 md:p-8",
          )}
          style={{ "--saas-radius": "26px" } as CSSProperties}
        >
          <span aria-hidden className="home-grain" />
          <div className="min-w-0">
            <h3 className={cn(TYPE.label, "flex items-center gap-2 text-(--saas-accent)")}>
              <CornerDot className="size-2.5 shrink-0" />
              {self.label}
            </h3>
            <p className={cn(TYPE.body, "mt-3 max-w-[44em] text-pretty text-(--saas-text)")}>{self.body}</p>
          </div>
          {/* 22px of words in a 44px target. The -10px foot hands the
              target's extra height back to the card's padding, and from
              md the -10px head too, so the words sit level with the
              paragraph's last line. On a phone the head stays, so a label
              that wraps onto two lines (at 320) still stands clear of the
              paragraph above it. The underline is on the words alone
              (`.home-link`, which a lit surface sets in its accent), and
              the arrow, an inline block, is held to the last word and
              never underlined. */}
          <IntentLink
            href={self.link.href}
            className={cn(
              "group -mb-2.5 inline-flex min-h-11 items-center self-start rounded-sm md:-mt-2.5 md:self-end",
              TYPE.body,
              RING,
            )}
          >
            <span className="home-link">
              {self.link.label.slice(0, cut)}
              <span className="whitespace-nowrap">
                {self.link.label.slice(cut)}
                <span aria-hidden className="ml-1 inline-block transition-transform duration-200 group-hover:translate-x-0.5">
                  →
                </span>
              </span>
            </span>
          </IntentLink>
        </div>
      </Frame>
    </section>
  );
}
