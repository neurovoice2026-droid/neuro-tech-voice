import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { IntentLink } from "@/components/site/intent-link";
import { Frame } from "@/components/site/product/primitives";
import { HomeHeading } from "@/components/site/home/heading";
import { TYPE, WEIGHT } from "@/components/site/home/type";
import type { GateRow, Link, PathData, StoreLine, Whose } from "@/lib/pages/custom-mobile-applications";
import { CheckLine } from "@/components/site/solutions/custom-saas-platforms/check-line";
import { LiveMesh } from "@/components/site/solutions/custom-saas-platforms/live-mesh";
import { KindTag } from "./glyphs";
import { GateGlyph } from "./gate-glyphs";
import { PathFigure } from "./path-figure";
import { StageFigure } from "./stage-figure";

/* ------------------------------------------------------------------ *
 * #path — "What do I get, in what order? Will it pass the stores? And
 * whose name is it in?"
 *
 * The menu's promise as the title ("An app your customers keep on their
 * home screen.") and its three deliverables as the three stages —
 * designed for iOS and Android, sign-in, payments and push built in,
 * published to both app stores — read from the data module rather than
 * retyped, so the menu and the page can't disagree. Then the rules the
 * stores keep, each in their own words or summarised from their own
 * page, and what we do about it; and last, whose name each thing that
 * keeps the apps in the stores is in.
 *
 * IN ORDER, ON THE WASH BAND (home.css `.home-wash-band`, full bleed,
 * its padding the section's own and inside the reserve):
 *
 *   1. The heading. Its key phrase sits on the wash (violet, 6.49),
 *      never on a card.
 *   2. THE PATH. Seven steps in one list, with a screen-reader-only
 *      heading: every station, both lanes where the platforms part, and
 *      the three gates where the build waits for a yes. Below lg it is
 *      what you see, a rail drawn down its left side (the electric,
 *      5.21 on the wash, a mark) with a node per station; from lg the
 *      list steps out of sight (`lg:sr-only`, still read) and the
 *      drawing takes its place (path-figure.tsx, aria-hidden).
 *   3. THE BETA LINE: every build goes to your testers first, with the
 *      stores' own pages for their test tracks.
 *   4. THE STAGE CARDS, in the SaaS `Build` grammar the Automations page
 *      rebuilt (custom-automations/build.tsx): three pearl cards, each a
 *      lit surface whose light flows while it is on screen (`LiveMesh`,
 *      at 1, 1.12 and 0.92), the middle one in the mirror of its
 *      neighbours' light with its pools' headings swapped (`data-swap`),
 *      radius 26px. From lg each card is a subgrid of the list's six
 *      rows — the stage, the title, the body, what you hold (a hairline
 *      block in the light's accent), what ours shows, the check — so the
 *      parts run level across the three. Stage 01 has no "On ours" (the
 *      sample above is its proof), so its fifth row holds a drawing of
 *      one screen designed for both platforms (stage-figure.tsx).
 *      Stacked, a dotted connector runs down the gutter from each card
 *      to the next (saas-build.css `.saas-link`) and there is no
 *      drawing.
 *   5. THE APPS ALREADY IN THE STORES, only when the owner has named
 *      them (`published`, PUBLISHED_APPS in the data module): a white
 *      card after the stages. While none is named, nothing here.
 *
 * THEN, ON WHITE:
 *
 *   6. THE GATES THE STORES KEEP (`#gates`): six cards, a rail that
 *      scrolls sideways below md, two across from md, three from xl, each
 *      `#gate-<id>` (the #kinds samples
 *      link to them). Each is a glyph and the rule, then Apple's line and
 *      Google Play's where it has one: whose rule, the section it comes
 *      from linked to the store's own page, then the words — a
 *      <blockquote cite> in typographic quotation marks when they are the
 *      store's own, tagged "In their words", or a plain paragraph tagged
 *      "Summarised" when they are ours — and, at the card's foot, what
 *      ours does about it or what yours will, with a link where there's
 *      somewhere to see it. The cards in a row share its height, the
 *      foot lines level at the bottom (a card with one store's line has
 *      the room above its foot).
 *   7. WHOSE NAME IT'S IN (`#own`): a real table (a caption, column and
 *      row headers) of what keeps the apps in the stores and whose it
 *      is, each state with a glyph and in words. Below md each row
 *      stacks into a block (mob-path.css §5), the cells' display, not
 *      the table's, so it stays a table to a screen reader.
 *
 * EVERY EXTERNAL LINK SAYS WHOSE SITE IT OPENS: an arrow for the eye,
 * and the owner's name for a screen reader, worked out from the link's
 * own address (`siteOf`). Each is a 44px-tall target on a 24px line, as
 * `CheckLine`'s links are.
 *
 * TEXT ON THE LIGHT uses only its measured tokens (--saas-text,
 * --saas-dim, --saas-accent; on `stage` at its worst, flowing, 12.06,
 * 7.34 and 5.67); on the wash, ink, muted (5.82) and violet (6.49); on
 * the white cards and the table, the landing's own.
 *
 * MOTION is CSS alone, on each piece's own passage up the screen
 * (mob-path.css): the drawing's strokes, stations, words and gates
 * (§1); the list's rail and nodes (§2); stage 01's drawing (§3); the
 * gates' glyphs (§4); the cards' rise, a step apart from lg
 * (saas-build.css `[data-col]`), and the connectors (`saas-link`). The
 * table is still. Reduced motion, the lite, still and weak tiers and any
 * browser without view timelines get the finished frame (§6): the path
 * whole with every gate open, every glyph drawn, the cards in place.
 *
 * A server component. The client code is `LiveMesh`'s observer, the
 * heading's reveal and the route links (IntentLink, which prefetches on
 * intent). The data module is imported for its types only. The focus
 * ring is written out here because controls.tsx is a client module.
 * ------------------------------------------------------------------ */

/** controls.tsx RING_LIGHT, spelled out: a ring in the ground's ink (on a light, its text token). */
const RING = "rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink";

/**
 * A link's 44px target on a 24px line, as `CheckLine`'s: the hit area
 * reaches 10px above and below the words, and a link of a word or two
 * ("Start free") is never narrower than 44px either.
 */
const TARGET = "relative inline-flex min-h-6 min-w-11 items-center before:absolute before:inset-x-0 before:-inset-y-2.5";

/** Each card's flow tempo: a higher number is slower (#pricing's first card is 1). */
const DRIFT = [1, 1.12, 0.92] as const;

/**
 * Whose site an external link opens, from its own address: said to a
 * screen reader after its words, while the eye gets the arrow. Only the
 * stores' pages are linked from here (the data module's test holds every
 * external link to https), so two owners cover them; any other address
 * gets the arrow alone.
 */
function siteOf(href: string): string | null {
  if (!/^https:/.test(href)) return null;
  const host = new URL(href).hostname;
  if (host === "apple.com" || host.endsWith(".apple.com")) return "Apple’s site";
  if (/(?:^|\.)(?:google|android)\.com$/.test(host)) return "Google’s site";
  return null;
}

/**
 * A link off this site: its words, the owner's name for a screen reader,
 * and an arrow held to the last word. The underline is on the words
 * alone (`.home-link`); the arrow, an inline block, is never underlined.
 */
function Out({ link, className }: { link: Link; className?: string }) {
  const site = siteOf(link.href);
  const cut = link.label.lastIndexOf(" ") + 1;
  return (
    <a href={link.href} className={cn("home-link", TARGET, RING, className)}>
      <span>
        {link.label.slice(0, cut)}
        <span className="whitespace-nowrap">
          {link.label.slice(cut)}
          {site && <span className="sr-only"> ({site})</span>}
          <span aria-hidden className="ml-0.5 inline-block">
            ↗
          </span>
        </span>
      </span>
    </a>
  );
}

/** A link on this site: through IntentLink for a route, a plain anchor for a place on this page. */
function Here({ link, className }: { link: Link; className?: string }) {
  const cls = cn("home-link", TARGET, RING, className);
  return link.href.startsWith("/") ? (
    <IntentLink href={link.href} className={cls}>
      {link.label}
    </IntentLink>
  ) : (
    <a href={link.href} className={cls}>
      {link.label}
    </a>
  );
}

/** Either kind of link, by where it goes. */
function AnyLink({ link, className }: { link: Link; className?: string }) {
  return /^https?:/.test(link.href) ? <Out link={link} className={className} /> : <Here link={link} className={className} />;
}

/* ─── The path, in words ─────────────────────────────────────────── */

/**
 * A gate as a mark beside its words, drawn as the figure draws one: a
 * post either side of the path, an arm hung from each and standing open
 * (55° towards the way the path goes), and the path running through, in
 * the electric. The gate violet, like the drawing's.
 */
function GateMark() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="mob-glyph size-4 overflow-visible" fill="none">
      <path d="M1 8 H15" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" className="text-(--home-electric)" />
      <path d="M5 2 L10.7 6 M5 14 L10.7 10" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
      <circle cx="5" cy="2" r="1.8" fill="currentColor" />
      <circle cx="5" cy="14" r="1.8" fill="currentColor" />
    </svg>
  );
}

/**
 * Every station in order, with its lanes where the platforms part and a
 * gate after it where the build waits: the drawing's content in words.
 * Visible below lg as a rail with a node per station; from lg read by a
 * screen reader only, beside the aria-hidden drawing.
 */
function Steps({ path }: { path: PathData["path"] }) {
  const total = path.stations.length;
  return (
    <div className="mob-steps relative mt-10 lg:mt-0">
      {/* The rail: from the first node's centre to the last's (each node sits on its step's first line, 22px tall). */}
      <span aria-hidden className="mob-rail absolute top-[11px] bottom-[11px] left-1 w-0.5 rounded-full bg-(--home-electric) lg:hidden" />
      <ol aria-labelledby="path-list-title" className="flex flex-col gap-5 lg:sr-only">
        {path.stations.map((s, i) => {
          const gate = path.gates.find((g) => g.after === s.id);
          return (
            <li key={s.id} className="relative grid grid-cols-[22px_minmax(0,1fr)] gap-x-2 pl-7">
              <span
                aria-hidden
                className="mob-rail-node absolute top-1.5 left-0 size-2.5 rounded-full bg-(--home-electric) shadow-[0_0_0_3px_var(--home-wash)] lg:hidden"
                style={{ "--o": i / total } as CSSProperties}
              />
              <span className={cn(TYPE.mono, "leading-[22px] text-pp-muted")}>{s.n}</span>
              <span className={cn(TYPE.body, "text-pretty text-pp-ink")}>{s.long}</span>
              {s.lanes && (
                <span className={cn(TYPE.mono, "col-start-2 mt-1 grid gap-x-5 gap-y-0.5 text-pp-muted sm:max-w-[440px] sm:grid-cols-2")}>
                  {(["ios", "android"] as const).map((p) => (
                    <span key={p} className="whitespace-nowrap">
                      <span className="text-pp-ink">{path.lanes[p]}</span>
                      <span aria-hidden> · </span>
                      <span className="sr-only">: </span>
                      {s.lanes![p]}
                    </span>
                  ))}
                </span>
              )}
              {gate && (
                <span className={cn(TYPE.mono, "col-start-2 mt-2 flex items-center gap-2 text-(--home-violet)")}>
                  <GateMark />
                  <span>
                    {path.gateWord}
                    <span aria-hidden> · </span>
                    <span className="sr-only">: </span>
                    {gate.label}
                  </span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ─── The stores' rules ──────────────────────────────────────────── */

/** One store's line on a gate card: whose rule, where it's from, then the words, quoted or summarised. */
function StoreQuote({ line, labels }: { line: StoreLine; labels: PathData["gates"]["labels"] }) {
  return (
    <div className="mt-5">
      <p className="flex flex-wrap items-center gap-x-2.5">
        <span className={cn(TYPE.label, "text-pp-ink")}>{line.store}</span>
        <Out link={{ label: line.ref, href: line.href }} className={TYPE.mono} />
      </p>
      {line.quote ? (
        <blockquote cite={line.href} className="mt-1.5 border-l-2 border-(--home-electric) pl-3">
          <p className={cn(TYPE.body, "text-pretty text-pp-ink")}>“{line.text}”</p>
        </blockquote>
      ) : (
        <p className={cn(TYPE.body, "mt-1.5 border-l-2 border-dotted border-pp-muted pl-3 text-pretty text-pp-ink/80")}>
          {line.text}
        </p>
      )}
      <p className={cn(TYPE.mono, "mt-1.5 pl-3.5 text-pp-muted")}>{line.quote ? labels.quote : labels.summary}</p>
    </div>
  );
}

function GateCard({ row, i, labels }: { row: GateRow; i: number; labels: PathData["gates"]["labels"] }) {
  const { side } = row;
  return (
    <article
      id={`gate-${row.id}`}
      aria-labelledby={`gate-${row.id}-title`}
      // Every card takes its row's height (from md, where the rail is a grid),
      // its foot level with its neighbour's: the foot's line is what the eye
      // runs across the row. Two to a row at every width from md, so the
      // data's order pairs cards alike (two stores' lines beside two, then
      // Apple's alone beside Apple's alone) and no card stands a store's
      // quote short of its neighbour; three to a row put one beside two, a
      // 160–190px band above the foot.
      className="flex h-full scroll-mt-8 flex-col rounded-[20px] bg-white p-6 shadow-[0_1px_2px_rgb(20_10_36/0.06)] ring-1 ring-pp-rule"
    >
      <div className="flex items-start gap-3">
        <GateGlyph id={row.id} i={i} />
        <h4 id={`gate-${row.id}-title`} className={cn(TYPE.body, "pt-0.5 font-semibold text-balance text-pp-ink")}>
          {row.title}
        </h4>
      </div>
      <StoreQuote line={row.apple} labels={labels} />
      {row.google && <StoreQuote line={row.google} labels={labels} />}
      {/* What ours does about it, or what yours will: at the card's foot, level across a row. */}
      <div className="mt-auto pt-6">
        <div className="border-t border-pp-rule pt-4">
          <p>
            <KindTag kind={side.kind === "ours" ? "does" : "none"} copy={{ does: labels.ours, none: labels.yours }} tone="white" />
          </p>
          <p className={cn(TYPE.meta, "mt-1.5 text-pretty text-pp-ink/80")}>{side.text}</p>
          {side.link && <AnyLink link={side.link} className={cn(TYPE.meta, "mt-1")} />}
        </div>
      </div>
    </article>
  );
}

/* ─── Whose name it's in ─────────────────────────────────────────── */

/** A state's glyph: a filled key for yours, a key with an arrow for handed to you, a dotted ring for agreed first. */
function WhoseGlyph({ whose }: { whose: Whose }) {
  const line = { stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" } as const;
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="mob-glyph size-4 overflow-visible text-(--home-electric)">
      {whose === "yours" ? (
        <>
          <circle cx="5" cy="8" r="3.4" fill="currentColor" />
          <path d="M8.4 8 H15 M12.5 8 V10.6 M14.6 8 V10" {...line} />
        </>
      ) : whose === "handed" ? (
        <>
          <circle cx="4" cy="11" r="2.4" {...line} />
          <path d="M6.4 11 H12 M10.5 11 V12.8" {...line} />
          <path d="M4 4 H13 M10.6 1.8 L13 4 L10.6 6.2" {...line} />
        </>
      ) : (
        <circle cx="8" cy="8" r="5.5" {...line} strokeDasharray="0 3.45" />
      )}
    </svg>
  );
}

function Own({ own }: { own: PathData["own"] }) {
  const head = cn(TYPE.label, "py-3 pr-6 text-left align-bottom text-pp-muted");
  return (
    <div id="own" className="mt-16 scroll-mt-8">
      <h3 className={cn(TYPE.h3, "text-balance text-pp-ink")} style={{ fontWeight: WEIGHT.h3 }}>
        {own.title}
      </h3>
      <p className={cn(TYPE.lead, "mt-2 max-w-[640px] text-pretty")}>{own.sub}</p>
      <table className="mob-own mt-6 w-full border-collapse">
        <caption className="sr-only">{own.title}</caption>
        <thead>
          <tr className="border-b border-pp-rule max-md:sr-only">
            <th scope="col" className={cn(head, "md:w-[30%]")}>
              {own.head.what}
            </th>
            <th scope="col" className={cn(head, "md:w-[20%]")}>
              {own.head.whose}
            </th>
            <th scope="col" className={cn(head, "pr-0")}>
              {own.head.how}
            </th>
          </tr>
        </thead>
        <tbody>
          {own.rows.map((r) => (
            <tr key={r.id} className="border-b border-pp-rule">
              <th scope="row" className={cn(TYPE.body, "py-4 pr-6 text-left align-top font-medium text-pretty text-pp-ink")}>
                {r.what}
              </th>
              <td className="py-4 pr-6 align-top">
                <span className={cn(TYPE.body, "inline-flex items-center gap-2 whitespace-nowrap text-pp-ink")}>
                  <WhoseGlyph whose={r.whose} />
                  {own.states[r.whose]}
                </span>
              </td>
              <td className="py-4 align-top">
                <p className={cn(TYPE.body, "text-pretty text-pp-ink/80")}>{r.quote ? `“${r.how}”` : r.how}</p>
                {r.link && <AnyLink link={r.link} className={cn(TYPE.meta, "mt-1")} />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── The section ────────────────────────────────────────────────── */

/** A label over its text inside a stage card, in the light's token. */
function Labelled({ label, tone, children }: { label: string; tone: "accent" | "dim"; children: ReactNode }) {
  return (
    <>
      <p className={cn(TYPE.label, tone === "accent" ? "text-(--saas-accent)" : "text-(--saas-dim)")}>{label}</p>
      {children}
    </>
  );
}

export function Path({
  data,
  blobs,
}: {
  data: PathData;
  blobs: { stage: readonly CSSProperties[]; mirror: readonly CSSProperties[] };
}) {
  const last = data.stages.length - 1;
  const published = data.published;
  const labels = data.labels;

  return (
    <section id="path" aria-labelledby="path-title" className="scroll-mt-8">
      <div className="home-wash-band">
        <Frame>
          <HomeHeading
            id="path-title"
            eyebrow={data.eyebrow}
            title={data.title}
            titleKey={data.key}
            sub={data.sub}
            className="max-sm:[&_.home-key]:[overflow-wrap:anywhere]"
          />

          {/* The path: one list for every width and every reader, and from lg the drawing for the eye. */}
          <h3 id="path-list-title" className="sr-only">
            {data.path.title}
          </h3>
          <PathFigure path={data.path} className="mt-12 hidden lg:block" />
          <Steps path={data.path} />

          {/* Before review, every build goes to your testers: the stores' own pages for their tracks. */}
          <div className="mt-8 flex flex-wrap items-center gap-x-4 lg:mt-6">
            <p className={cn(TYPE.meta, "text-pretty")}>{data.path.beta.text}</p>
            {/* Wrapped onto two lines on a phone, a row gap their 44px targets meet in, never overlap. */}
            <ul className="flex flex-wrap gap-x-4 gap-y-5">
              {data.path.beta.links.map((l) => (
                <li key={l.href}>
                  <Out link={l} className={TYPE.meta} />
                </li>
              ))}
            </ul>
          </div>

          <ol className="mt-10 grid gap-4 lg:mt-12 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-0">
            {data.stages.map((s, i) => {
              // The middle card: the mirrored light, its pools' headings swapped.
              const mirror = i === 1;
              return (
                <li
                  key={s.id}
                  data-col={i}
                  data-swap={mirror ? "" : undefined}
                  className={cn(
                    "mob-path-card saas-lit home-rise p-6 md:p-8",
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
                    <Labelled label={data.labels.hold} tone="accent">
                      <p className={cn(TYPE.body, "mt-1 max-w-[38em] text-pretty text-(--saas-text)")}>{s.hold}</p>
                    </Labelled>
                  </div>

                  {/* What ours shows, and under the owner switch (lib publishedCopy) the
                      apps already in the stores, each under its own label, in one row of
                      the subgrid: "In the stores", never "On ours", which everywhere on
                      the page means this platform. */}
                  {s.ours || s.published ? (
                    <div className="mt-4">
                      {s.ours && (
                        <Labelled label={labels.ours} tone="dim">
                          <p className={cn(TYPE.meta, "mt-1 max-w-[42em] text-pretty text-(--saas-dim)")}>{s.ours}</p>
                        </Labelled>
                      )}
                      {s.published && (
                        <div className={s.ours ? "mt-4" : undefined}>
                          <Labelled label={labels.published} tone="dim">
                            <p className={cn(TYPE.meta, "mt-1 max-w-[42em] text-pretty text-(--saas-dim)")}>{s.published}</p>
                          </Labelled>
                        </div>
                      )}
                    </div>
                  ) : (
                    // In the row where the others say what ours shows, one screen designed for both platforms (from lg only).
                    <StageFigure className="mt-4" />
                  )}

                  <CheckLine check={s.check} kinds={data.checkKinds} tone="lit" className="mt-5 lg:row-start-6" />
                </li>
              );
            })}
          </ol>

          {/* The apps already in the stores: only once the owner has named them. */}
          {published && (
            <div
              id="published"
              className="mt-10 scroll-mt-8 rounded-[26px] bg-white p-6 shadow-[0_1px_2px_rgb(20_10_36/0.06),0_24px_48px_-32px_rgb(20_10_36/0.25)] md:p-8 lg:mt-12"
            >
              <h3 className={cn(TYPE.h3, "text-balance text-pp-ink")} style={{ fontWeight: WEIGHT.h3 }}>
                {published.title}
              </h3>
              <ul className="mt-5 grid gap-x-10 gap-y-6 md:grid-cols-2 xl:grid-cols-3">
                {published.apps.map((a) => (
                  <li key={a.name} className="min-w-0">
                    <h4 className={cn(TYPE.body, "font-semibold text-pp-ink")}>{a.name}</h4>
                    <p className={cn(TYPE.meta, "mt-1 text-pretty")}>{a.what}</p>
                    <ul className="mt-1.5 flex flex-wrap gap-x-4">
                      {a.links.map((l) => (
                        <li key={l.href}>
                          <Out link={l} className={TYPE.body} />
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Frame>
      </div>

      <Frame>
        {/* The gates the stores keep: each rule in their words or summarised, and what we do about it. */}
        <div id="gates" className="mt-16 scroll-mt-8 lg:mt-24">
          <h3 className={cn(TYPE.h3, "text-balance text-pp-ink")} style={{ fontWeight: WEIGHT.h3 }}>
            {data.gates.title}
          </h3>
          <p className={cn(TYPE.lead, "mt-2 max-w-[640px] text-pretty")}>{data.gates.sub}</p>
          {/* Below md a rail that scrolls sideways, each card a thumb's width with
              the next peeking in (as #kinds' storyboard), so six cards of two
              stores' words don't stand 3,000px tall on a phone; its cards' links
              are its tab stops, each scrolled into view as it takes focus, and a
              #gate-<id> link scrolls it to its card. From md, the grid. */}
          <ul
            className={cn(
              "mt-8 flex snap-x snap-mandatory items-start gap-4 overflow-x-auto overscroll-x-contain py-1",
              // Its scrollbar hidden to a finger, thin where a mouse may be (`mob-swipe`, mob.css §2).
              "mob-swipe -mx-4 scroll-px-4 px-4 sm:-mx-6 sm:scroll-px-6 sm:px-6",
              "md:mx-0 md:grid md:snap-none md:grid-cols-2 md:items-stretch md:overflow-visible md:px-0 md:py-0 lg:gap-6",
            )}
          >
            {data.gates.rows.map((row, i) => (
              <li key={row.id} className="w-[min(320px,calc(100%-2.5rem))] min-w-0 shrink-0 snap-start md:w-auto">
                <GateCard row={row} i={i} labels={data.gates.labels} />
              </li>
            ))}
          </ul>
        </div>

        <Own own={data.own} />
      </Frame>
    </section>
  );
}
