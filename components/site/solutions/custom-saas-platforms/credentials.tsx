import { Fragment, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { IntentLink } from "@/components/site/intent-link";
import { Frame } from "@/components/site/product/primitives";
import { HomeHeading } from "@/components/site/home/heading";
import { TYPE, WEIGHT } from "@/components/site/home/type";
import { ACCREDITATIONS, type CredentialsData } from "@/lib/pages/custom-saas-platforms";
import { CheckLine } from "./check-line";
import { LiveMesh } from "./live-mesh";
import { MapLink } from "./map-link";
import { LineReveal } from "./reveal";
import { Tally } from "./tally";

/* ------------------------------------------------------------------ *
 * #credentials — who are you, and why believe you?
 *
 * The owner's two strongest cards, laid face up and described exactly.
 * On one pearl card (the `papers` light: lilac, champagne, pink pearl,
 * periwinkle and cream, flowing), two columns and a strip under them:
 *
 *   · Personal accreditations. A tally of one node per accreditation,
 *     the figure "20+" set large in the display face, and then what they
 *     are: held by the people who build, not by the company — so they
 *     are the people who would build yours — and what they are not: a
 *     security or compliance certification of the company.
 *   · Startup grants. Each grantor by name, set as a name and never as
 *     a logo, what the grant is (awarded to the company), and where that
 *     grantor's technology runs on this very platform, with a link to
 *     the same part on the explorer's drawing (`MapLink`). Then what a
 *     grant is not: an endorsement of this page or of any build we quote.
 *   · What none of these is, in the homepage's own words: "There is no
 *     certification badge on this site, because we hold none." The
 *     sentence is read from the TRUST band by id in the data module, so
 *     the two pages can never disagree.
 *
 * Each column ends on how to check it (`CheckLine`): while the owner has
 * no public link to the certificates or the grants, "On the call"; the
 * day a link exists it is set in the data module and the line becomes a
 * link, with nothing to change here. Every sentence, the figure and the
 * grantors are read from the data module, so a third grantor is one more
 * row and every sentence still reads true.
 *
 * NOTHING HERE IS A BADGE. No seal, no shield, no logo, no image at all:
 * the TRUST line says the site holds no certification, and a badge-shaped
 * thing beside it would say otherwise, whatever its caption.
 *
 * THE MOTION, all of it cheap, and none of it hiding a word for long:
 *   · the card rises as it enters (`home-rise`, the landing's view
 *     timeline; off on lite by tier.css);
 *   · its light flows while it is on screen (`LiveMesh` at 1.5: the pools
 *     are px-sized like #pricing's Enterprise card, so on a card this
 *     wide they take the slower tempo to look the same);
 *   · the tally's nodes pop in reading order on the tally's own view
 *     timeline (saas-credentials.css §5), the plus last;
 *   · the numeral's line rises once out of its mask (`LineReveal`,
 *     SplitText via the landing heading's `useLineReveal`). The whole
 *     figure rises already reading "20+": it is never a count-up, which
 *     would show numbers that were never true on the way.
 * The finished frame is the server's markup: reduced motion, the still
 * tier and weak hardware get a still ground, every node drawn and the
 * numeral in place.
 *
 * TEXT ON THE LIGHT uses only its measured tokens (--saas-text, --saas-dim,
 * --saas-accent; palette.ts SAAS_INK) — on `papers` at its worst, flowing:
 * 12.48, 7.59 and 5.87 — and the tick colour for marks only (3.72). The
 * landing's muted and violet fall under 4.7 on a flowing pool and are
 * never used here; saas.css re-points `--pp-*` and `.home-link` inside a
 * lit surface in case one slips in.
 *
 * LAYOUT. One column on a phone, the grants under a hairline; the same at
 * md with more padding, and the closing strip becomes a label beside its
 * text. From lg the two columns stand side by side, a hairline between.
 *
 * A server component. The client code is `LiveMesh`'s observer, the
 * numeral's reveal, the heading's, and the two map links; the focus ring
 * is written out here because controls.tsx is a client module. Being on
 * the server, it reads the tally's count straight from ACCREDITATIONS,
 * the same source the figure's words are made from, so the nodes and
 * the numeral cannot disagree.
 * ------------------------------------------------------------------ */

/** controls.tsx RING_LIGHT, spelled out: a ring in the ground's ink (on a light, its text token). */
const RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink";

/**
 * An inline link with a trailing arrow that nudges under the pointer. A
 * block, not a flex row, so its underline stops at the words and never
 * runs into the arrow; 22px of line and 1px either side, a 24px target.
 */
const LINK = cn("home-link group inline-block min-h-6 rounded-sm py-px", TYPE.body, RING);
const ARROW = "ml-1 inline-block transition-transform duration-200 group-hover:translate-x-0.5";

/**
 * A link's words with the arrow held to the last of them, so a label that
 * wraps on a phone never leaves the arrow on a line of its own.
 */
function Arrowed({ label }: { label: string }) {
  const at = label.lastIndexOf(" ") + 1;
  return (
    <>
      {label.slice(0, at)}
      <span className="whitespace-nowrap">
        {label.slice(at)}
        <span aria-hidden className={ARROW}>
          →
        </span>
      </span>
    </>
  );
}

/**
 * "Startup grant · awarded to our company", each half kept whole, so a
 * narrow card breaks the line at its own dot rather than leaving a word
 * on its own (the hero note's rule).
 */
function Halves({ text }: { text: string }) {
  return text.split(" · ").map((part, i, all) => {
    const last = i === all.length - 1;
    return (
      <Fragment key={i}>
        <span className="whitespace-nowrap">{last ? part : `${part} ·`}</span>
        {!last && " "}
      </Fragment>
    );
  });
}

/** Each column's small heading, in the light's accent. */
const HEAD = cn(TYPE.label, "text-(--saas-accent)");

export function Credentials({ data, blobs }: { data: CredentialsData; blobs: readonly CSSProperties[] }) {
  const acc = data.accreditations;
  const grants = data.grants;
  // "20+": the plus is the floor's own mark, set in the accent as the
  // tally's plus is set in the tick, so the two read as one sign.
  const floor = acc.figure.endsWith("+");
  const whole = floor ? acc.figure.slice(0, -1) : acc.figure;

  return (
    <section id="credentials" aria-labelledby="credentials-title" className="scroll-mt-28">
      <Frame>
        <HomeHeading
          id="credentials-title"
          eyebrow={data.eyebrow}
          title={data.title}
          titleKey={data.key}
          sub={data.sub}
        />

        {/* The papers card: its flowing light first, its grain second,
            then the content (saas.css §2). */}
        <div className="saas-lit saas-light-papers home-rise mt-10 p-6 md:p-10 lg:mt-12 lg:p-14">
          <LiveMesh blobs={blobs} drift={1.5} />
          <span aria-hidden className="home-grain" />

          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-0">
            {/* ── The accreditations ── */}
            <div className="min-w-0 lg:pr-12">
              <h3 className={HEAD}>{acc.label}</h3>
              <Tally count={ACCREDITATIONS.count} orMore={ACCREDITATIONS.orMore} className="mt-5" />
              <LineReveal
                className={cn(
                  "pp-display mt-4 text-[72px] leading-[72px] tracking-[-0.04em] text-(--saas-text) tabular-nums",
                  "md:text-[96px] md:leading-[88px]",
                )}
                style={{ fontWeight: WEIGHT.num }}
              >
                {whole}
                {floor && <span className="text-(--saas-accent)">+</span>}
              </LineReveal>
              <p className={cn(TYPE.meta, "mt-1 text-(--saas-dim)")}>{acc.caption}</p>

              {/* A line, not a heading: the column's heading is its label. */}
              <p className={cn(TYPE.h3, "mt-6 text-balance text-(--saas-text)")} style={{ fontWeight: WEIGHT.h3 }}>
                {acc.title}
              </p>
              <p className={cn(TYPE.body, "mt-2 max-w-[34em] text-pretty text-(--saas-text)")}>{acc.body}</p>
              <p className={cn(TYPE.meta, "mt-4 max-w-[34em] text-pretty text-(--saas-dim)")}>{acc.isnt}</p>
              <CheckLine check={acc.check} kinds={data.checkKinds} tone="lit" className="mt-4" />
            </div>

            {/* ── The grants ── */}
            <div className="min-w-0 border-t border-(--saas-rule) pt-10 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-12">
              <h3 className={HEAD}>{grants.label}</h3>
              <ul className="mt-5 divide-y divide-(--saas-rule)">
                {grants.rows.map((g) => (
                  <li key={g.id} className="py-5 first:pt-0">
                    {/* A name, set in the display face: never a logo. */}
                    <p
                      className="pp-display text-[26px] leading-[30px] tracking-[-0.015em] text-(--saas-text)"
                      style={{ fontWeight: 500 }}
                    >
                      {g.grantor}
                    </p>
                    <p className={cn(TYPE.label, "mt-1 text-(--saas-dim)")}>
                      <Halves text={grants.kind} />
                    </p>
                    <p className={cn(TYPE.label, "mt-4 text-(--saas-dim)")}>{grants.whereLabel}</p>
                    <p className={cn(TYPE.body, "mt-1 max-w-[34em] text-pretty text-(--saas-text)")}>{g.runs}</p>
                    {/* To the same part on the explorer's drawing: a real
                        #part-… anchor, taken over by script (map-link.tsx). */}
                    <MapLink part={g.part} className={cn(LINK, "mt-2")}>
                      <Arrowed label={grants.mapLink} />
                    </MapLink>
                  </li>
                ))}
              </ul>
              <p className={cn(TYPE.meta, "mt-4 max-w-[34em] text-pretty text-(--saas-dim)")}>{grants.isnt}</p>
              <CheckLine check={grants.check} kinds={data.checkKinds} tone="lit" className="mt-4" />
            </div>
          </div>

          {/* ── What none of these is ── the homepage's own sentence, and a
              way to the company facts it stands beside. */}
          <div className="mt-10 border-t border-(--saas-rule) pt-6 md:grid md:grid-cols-[200px_minmax(0,1fr)] md:gap-8">
            <h3 className={HEAD}>{data.none.label}</h3>
            <div className="mt-3 min-w-0 md:mt-0">
              <p className={cn(TYPE.body, "max-w-[46em] text-pretty text-(--saas-text)")}>{data.none.text}</p>
              <IntentLink href={data.none.link.href} className={cn(LINK, "mt-2")}>
                <Arrowed label={data.none.link.label} />
              </IntentLink>
            </div>
          </div>
        </div>
      </Frame>
    </section>
  );
}
