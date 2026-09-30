import { Fragment, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { IntentLink } from "@/components/site/intent-link";
import { Frame } from "@/components/site/product/primitives";
import { HomeHeading } from "@/components/site/home/heading";
import { TYPE, WEIGHT } from "@/components/site/home/type";
import { ACCREDITATIONS } from "@/lib/pages/custom-saas-platforms";
import type { TeamData } from "@/lib/pages/custom-automations";
import { CheckLine } from "@/components/site/solutions/custom-saas-platforms/check-line";
import { LiveMesh } from "@/components/site/solutions/custom-saas-platforms/live-mesh";
import { LineReveal } from "@/components/site/solutions/custom-saas-platforms/reveal";
import { Tally } from "@/components/site/solutions/custom-saas-platforms/tally";

/* ------------------------------------------------------------------ *
 * #team — who builds it, and why trust them?
 *
 * The SaaS page's two strongest cards, said once more and said short:
 * the people who would map and build the reader's automations hold 20+
 * personal Claude accreditations from Anthropic, and the company holds
 * startup grants from Cartesia and ElevenLabs, whose technology runs
 * inside this platform. The whole account of each — what it is, where
 * it runs on the platform, how to see it — lives on the SaaS page's
 * #credentials, and the grants column links there (`more`) rather than
 * repeating it. Every word, the figure and the grantors' names are read
 * from the data module (AUTO_TEAM), which takes the credentials from the
 * SaaS module itself, so the two pages can never disagree.
 *
 * ONE CARD, THREE COLUMNS. On one pearl card (the `papers` light, the
 * SaaS credentials card's, flowing), from lg:
 *
 *   · the figure: a tally of one node per accreditation, "20+" set large
 *     in the display face under it, and what they are in a line;
 *   · what that means for an automation: the people who hold them are
 *     the ones who'd build it, and they build with Claude, this platform
 *     included; then, once on this page and only here, what they are
 *     not: a certification of the company; then how to check them;
 *   · the grants: the column's head says "awarded to our company" once,
 *     for every name; each grantor by name, set as a name in the display
 *     face and never as a logo; where their technology runs; the link to
 *     the SaaS page; what a grant is not; how to check it.
 *
 * A hairline in the light's rule colour stands between the columns, the
 * same 40px either side of it, and it runs the card's full height, so
 * the columns are sized to end near one line rather than leave a tall
 * empty strip beside a full one. From lg the grants' column is a little
 * wider than the middle one (1.1 to 1): it holds the most, and at that
 * ratio the three end within about 50px of each other at xl, where 1.2
 * to 1 the other way left the middle 108px short. At md the figure sits
 * over its words on the left and the grants stand on the right, one
 * hairline down the middle, the left column the wider (3 to 2) because
 * it holds two blocks to the grants' one; at 768 the grants end 12px
 * short of it, where halves left them 180px short. On a phone the three
 * stack, a hairline between each. The card is compact on purpose — the
 * section about 670px at xl, where the SaaS card alone is 900 — because
 * the SaaS page tells the long version and this one links to it.
 *
 * NOTHING HERE IS A BADGE. No seal, no shield, no logo, no image: the
 * accreditations are personal and the page says so, and a badge-shaped
 * thing beside that sentence would say otherwise, whatever its caption.
 *
 * THE MOTION, the SaaS card's, all of it cheap and none of it hiding a
 * word for long:
 *   · the card rises as it enters (`home-rise`, the landing's view
 *     timeline; off on lite by tier.css);
 *   · its light flows while it is on screen (`LiveMesh` at 1.06, the
 *     plan cards' band), and stands still where saas.css's gates say;
 *   · the tally's nodes pop in reading order on the tally's own view
 *     timeline, the plus last (saas-credentials.css §5, imported by the
 *     page as it is);
 *   · the numeral's line rises once out of its mask (`LineReveal`). The
 *     figure rises already reading "20+": never a count-up, which would
 *     show numbers that were never true on the way.
 * The finished frame is the server's markup: reduced motion, the still
 * tier and weak hardware get a still ground, every node drawn and the
 * numeral in place.
 *
 * TEXT ON THE LIGHT uses only its measured tokens (--saas-text, --saas-dim,
 * --saas-accent; palette.ts SAAS_INK) — on `papers` at this card's boxes,
 * at its worst while flowing: 11.41, 6.94 and 5.36 — and the tick colour
 * for marks only (3.40: the tally, the check glyphs). The heading's key
 * phrase sits on the white page, never on the card.
 *
 * A server component. The client code is `LiveMesh`'s observer, the
 * numeral's reveal, the heading's, and the one route link (IntentLink,
 * which prefetches on intent). The focus ring is written out here because
 * controls.tsx is a client module. Being on the server, it reads the
 * tally's count straight from ACCREDITATIONS, the object the figure's
 * words are made from, so the nodes and the numeral cannot disagree.
 * ------------------------------------------------------------------ */

/** controls.tsx RING_LIGHT, spelled out: a ring in the ground's ink (on a light, its text token). */
const RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink";

/**
 * The inline link to the SaaS page's credentials: a block, not a flex
 * row, so its underline stops at the words and never runs into the
 * arrow; 22px of line and 1px either side, and a hit area 10px taller
 * each way (`before:`), a 44px target with no change to layout.
 */
const LINK = cn("home-link group relative inline-block min-h-6 rounded-sm py-px", "before:absolute before:inset-x-0 before:-inset-y-2.5", TYPE.body, RING);
const ARROW = "ml-1 inline-block transition-transform duration-200 group-hover:translate-x-0.5";

/** Each column's small heading, in the light's accent. */
const HEAD = cn(TYPE.label, "text-(--saas-accent)");

/** The hairline between two columns, in the light's own rule colour. */
const HAIR = "border-(--saas-rule)";

/**
 * A link's words with the arrow held to the last of them, so a label that
 * wraps on a phone never leaves the arrow on a line of its own. A label
 * with a comma ("What each one is, and how to see it") keeps its last
 * clause whole with the arrow, so a narrow column breaks it at the comma
 * rather than stranding "it →" on a line of its own; one without a comma
 * holds only its last word.
 */
function Arrowed({ label }: { label: string }) {
  const comma = label.lastIndexOf(", ");
  const at = comma >= 0 ? comma + 2 : label.lastIndexOf(" ") + 1;
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
 * A line kept whole at each comma ("Startup grants, awarded to our
 * company"; "Claude accreditations, from Anthropic"), so a narrow column
 * breaks it there rather than leaving a word on its own. A line with no
 * comma is left to wrap.
 */
function Halves({ text }: { text: string }) {
  const parts = text.split(", ");
  if (parts.length < 2) return text;
  return parts.map((part, i) => {
    const last = i === parts.length - 1;
    return (
      <Fragment key={i}>
        <span className="whitespace-nowrap">{last ? part : `${part},`}</span>
        {!last && " "}
      </Fragment>
    );
  });
}

export function Team({ data, blobs }: { data: TeamData; blobs: readonly CSSProperties[] }) {
  const acc = data.accreditations;
  const grants = data.grants;
  // "20+": the plus is the floor's own mark, set in the accent as the
  // tally's plus is set in the tick, so the two read as one sign.
  const floor = acc.figure.endsWith("+");
  const whole = floor ? acc.figure.slice(0, -1) : acc.figure;

  return (
    <section id="team" aria-labelledby="team-title" className="scroll-mt-8">
      <Frame>
        {/* The key's held pair, "Claude accreditations", is 289px at 30px
            and a 320 phone's heading is 288: under 359 the heading steps
            down to 28px, where the pair fits whole (the SaaS credentials
            heading's rule). `overflow-wrap` stays as the last resort for
            a reader's text-spacing override, which widens the pair past
            any line. */}
        <HomeHeading
          id="team-title"
          className={cn(
            "max-[359px]:[&_h2]:text-[28px] max-[359px]:[&_h2]:leading-[34px]",
            "max-sm:[&_.home-key]:[overflow-wrap:anywhere]",
          )}
          eyebrow={data.eyebrow}
          title={data.title}
          titleKey={data.key}
          sub={data.sub}
        />

        {/* The papers card: its flowing light first, its grain second,
            then the content (saas.css §2). */}
        <div className="saas-lit saas-light-papers home-rise mt-10 p-6 md:p-10 lg:mt-12 lg:p-12">
          <LiveMesh blobs={blobs} drift={1.06} />
          <span aria-hidden className="home-grain" />

          {/* Phone: one column, a hairline over the second and the third.
              md: the figure over its words on the left, the grants on the
              right over both rows (the second row takes whatever height
              the grants need past the figure's, so the words sit right
              under the figure); the left column 3 to 2 the wider, so the
              grants end near where the words do (12px short at 768, 30
              at 900, where halves left 180 and 134). lg: three across,
              the figure's column as wide as its caption's two halves,
              then the words and the grants at 1 to 1.1, a hairline before
              each, 40px either side. At xl that ends the words 48px short
              of the grants and the figure 54 (1.2 to 1 the other way left
              108 and 92), puts the grants' head on one line, and keeps
              both check lines and the words' `isnt` on one line each. */}
          <div
            className={cn(
              "grid gap-10",
              "md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] md:grid-rows-[auto_1fr] md:gap-x-10 md:gap-y-6",
              "lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,1.1fr)] lg:grid-rows-none lg:gap-10",
            )}
          >
            {/* ── The figure ── */}
            <div className="min-w-0 lg:max-w-56">
              <h3 className={HEAD}>{acc.label}</h3>
              <Tally count={ACCREDITATIONS.count} orMore={ACCREDITATIONS.orMore} className="mt-5" />
              {/* The figure is read once, here, as plain text. The numeral
                  below is for the eye only: while the reveal waits and
                  plays, GSAP's SplitText (`aria: "auto"`) puts an
                  aria-label on the <p> and aria-hidden on every line in it,
                  and a paragraph cannot carry a name, so a screen reader
                  would get nothing. Hidden whole, the numeral can do that
                  without anything lost. The wrapper is a plain block: the
                  numeral's margin collapses through it and sr-only is taken
                  out of flow, so nothing moves. (The proper fix is in
                  useLineReveal/reveal.tsx, which this page cannot change.) */}
              <p className="sr-only">{acc.figure}</p>
              <div aria-hidden>
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
              </div>
              <p className={cn(TYPE.meta, "mt-1 text-(--saas-dim)")}>
                <Halves text={acc.caption} />
              </p>
            </div>

            {/* ── What they mean for a build ── */}
            <div
              className={cn(
                "min-w-0 border-t pt-10",
                HAIR,
                "md:col-start-1 md:border-t-0 md:pt-0",
                "lg:col-start-2 lg:row-start-1 lg:border-l lg:pl-10",
              )}
            >
              <p className={cn(TYPE.body, "max-w-[34em] text-pretty text-(--saas-text)")}>{acc.body}</p>
              {/* The page's one word on what they are not. */}
              <p className={cn(TYPE.meta, "mt-4 max-w-[34em] text-pretty text-(--saas-dim)")}>{acc.isnt}</p>
              <CheckLine check={acc.check} kinds={data.checkKinds} tone="lit" className="mt-4" />
            </div>

            {/* ── The grants ── */}
            <div
              className={cn(
                "min-w-0 border-t pt-10",
                HAIR,
                "md:col-start-2 md:row-span-2 md:row-start-1 md:border-t-0 md:border-l md:pt-0 md:pl-10",
                "lg:col-start-3 lg:row-span-1",
              )}
            >
              {/* "Startup grants, awarded to our company": said once, for every name. */}
              <h3 className={HEAD}>
                <Halves text={grants.label} />
              </h3>
              {/* Names, set in the display face: never a logo. */}
              <ul className="mt-4">
                {grants.names.map((name) => (
                  <li
                    key={name}
                    className="pp-display text-[26px] leading-[30px] tracking-[-0.015em] text-(--saas-text)"
                    style={{ fontWeight: 500 }}
                  >
                    {name}
                  </li>
                ))}
              </ul>
              <p className={cn(TYPE.body, "mt-4 max-w-[34em] text-pretty text-(--saas-text)")}>{grants.line}</p>
              {/* What each one is, where it runs and how to see it: the
                  SaaS page's #credentials, a route, so IntentLink. */}
              <IntentLink href={grants.more.href} className={cn(LINK, "mt-2")}>
                <Arrowed label={grants.more.label} />
              </IntentLink>
              <p className={cn(TYPE.meta, "mt-4 max-w-[34em] text-pretty text-(--saas-dim)")}>{grants.isnt}</p>
              <CheckLine check={grants.check} kinds={data.checkKinds} tone="lit" className="mt-4" />
            </div>
          </div>
        </div>
      </Frame>
    </section>
  );
}
