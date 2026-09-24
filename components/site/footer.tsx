import Image from "next/image";
import { Mail } from "lucide-react";
import {
  FOOTER,
  COMPANY,
  SITE_TIME_ZONE,
  type FooterColumn,
} from "@/lib/site";
import { IntentLink } from "./intent-link";
import { CornerDot } from "./corner-dot";
import { cn } from "@/lib/utils";

/**
 * The imprint — set on ink, like the cover it closes.
 *
 * This was the last white surface on the page, and by the time everything
 * above it had moved onto the cover's stock it was also the most jarring:
 * eleven sections of dark editorial and then a bright grey slab of legal
 * text, which is not the note to end on. Now the run bookends properly —
 * ink at the top for the cover, ink at the bottom for the imprint, and the
 * spread between them.
 *
 * It carries `.cover` itself rather than sitting inside the spread's
 * wrapper, because the sticky WebGL field belongs to the spread and a
 * colophon does not want a moving background behind its company number.
 * Flat ink, the same token, no field. It is also the one component the two
 * design systems share — every `/product`, `/solutions` and `/industries`
 * route ends on it through `product/shell.tsx` — so it reads only flat
 * data out of `lib/site`, and it may not grow a `.cover`-only dependency
 * that the light pages do not carry. For the same reason there is no
 * motion in here and nothing imported from `./reveal`: this file is a true
 * server component, it ships zero client JavaScript, and it is rendered on
 * twenty-one routes. A single `"use client"` import — a reveal, a tear —
 * would put a bundle under every one of them to animate a sitemap.
 *
 * Below lg every size has a floor. The cover's base bottoms out at 11.5px
 * on a phone, and the imprint is set in fractions of it, so its labels
 * came out at 6.9px and the company's registration at 8.3px. Desktop keeps
 * the authored em sizes exactly.
 *
 * The decisions worth keeping:
 *
 *  · **Nothing here is dimmer than it is readable.** The imprint used to
 *    run /45 headings, /35 registration and a /30 copyright, which made
 *    the company's legal identity — the one block on this site a regulator
 *    or a wary buyer actually comes looking for — the least readable text
 *    in the document. The whole ladder moved up to the floor
 *    `globals.css` sets for paper on ink. Nothing is hidden by being
 *    faint; a reader who does not want it simply does not look down here.
 *  · **The columns are rendered, not named.** The footer used to hardcode
 *    "Product" and "Legal" against two hand-written lists. It now walks
 *    `FOOTER.columns`, so a route added to the header's menus reaches the
 *    sitemap by itself. The alternative was a second list of links to
 *    forget to update, which is how the old footer came to point at a page
 *    that had been renamed.
 *  · **…but only at routes that exist.** `FOOTER.columns` is built out of
 *    the header's menu data, and the header currently advertises pages
 *    that have not been built: four `/product` entries, four `/solutions`
 *    entries, `/case-studies` and `/contact`. A dead link in a nav menu is
 *    a disappointment; ten of them in the imprint of every page on the
 *    site is a site that looks abandoned, and search engines read the
 *    footer as the sitemap. `LIVE` below is the honest list, applied here
 *    and only here. It is a patch, not the fix — see the note on it.
 *  · **Nothing empty is drawn.** `COMPANY` carries four fields the owner
 *    still has to fill — the support address, the trade-register number
 *    and the two ANPC links Romanian law wants on a commercial site. They
 *    are empty strings until then, and an empty string rendered is a
 *    dangling label, a stray separator or a link to nowhere. Every one of
 *    them is behind a truthiness check, so the imprint is correct at every
 *    stage of being filled in rather than only at the end.
 *  · **The year is computed, in the company's own timezone.** It was typed
 *    in as 2026, which is a line that silently becomes a lie on a fixed
 *    date and nobody is ever assigned to fix. Europe/Bucharest rather than
 *    the server's clock, so the turn of the year happens once, where the
 *    company is. This is a server component, so the value is fixed at
 *    render: a statically exported build carries its build year until the
 *    next deploy, which is the correct trade for zero client JS.
 */

/**
 * The marketing routes that are actually built.
 *
 * OWNER / NAV: this belongs in `lib/site.ts` as a property of the nav data
 * — the header renders the same dead entries this list filters out, and it
 * is frozen, so the two now disagree about how many product pages exist.
 * The moment those pages ship, this constant should be deleted rather than
 * extended.
 */
const LIVE = new Set([
  "/product/ai-agents",
  "/product/knowledge-base",
  "/product/integrations",
  "/solutions/custom-ai-agents",
  "/solutions/custom-saas-platforms",
  "/industries",
  "/privacy",
  "/terms",
  "/cookies",
  "/refund-policy",
  "/login",
  "/register",
]);

/** `/industries/<slug>` all resolve; homepage anchors are not routes. */
const exists = (href: string) =>
  LIVE.has(href) || href.startsWith("/industries/") || href.startsWith("/#");

/** One tone for the whole bottom rule, so policies and ANPC match. */
const legalLink =
  "text-[length:max(0.72em,12px)] text-[var(--cover-paper)]/65 transition-colors duration-500 hover:text-[var(--cover-brand-lit)] lg:text-[0.72em]";

function LinkColumn({ column }: { column: FooterColumn }) {
  const links = column.links.filter((l) => exists(l.href));
  if (links.length === 0) return null;

  // Industries is sixteen links and every other column is four or fewer.
  // Left as one list it draws a tower twice the height of the imprint
  // beside it; split into two tracks it reads as one column of the same
  // weight as its neighbours, which is what it is.
  const dense = links.length > 8;

  return (
    <nav aria-label={column.title} className="flex flex-col gap-[1.1em]">
      {/* A real heading, not a styled paragraph: this is how the sitemap
          is navigated without sight — jump the headings, then read the one
          list you wanted. */}
      <h2 className="mono text-[length:max(0.6em,11px)] font-semibold uppercase tracking-[0.22em] text-[var(--cover-paper)]/60 lg:text-[0.6em]">
        {column.title}
      </h2>
      <ul
        className={cn(
          dense
            ? "columns-2 gap-x-[1.4em] [&>li]:mb-[0.7em] [&>li]:break-inside-avoid"
            : "flex flex-col gap-[0.7em]",
        )}
      >
        {links.map((l) => (
          <li key={l.href}>
            <IntentLink
              href={l.href}
              className="text-[length:max(0.85em,14px)] text-[var(--cover-paper)]/75 transition-colors duration-500 hover:text-[var(--cover-brand-lit)] lg:text-[0.85em]"
            >
              {l.label}
            </IntentLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Footer() {
  const year = new Intl.DateTimeFormat("en-GB", {
    timeZone: SITE_TIME_ZONE,
    year: "numeric",
  }).format(new Date());

  return (
    <footer
      className="cover relative bg-[var(--cover-ink)] text-[var(--cover-paper)]"
      style={{ fontFamily: "var(--font-display)" }}
    >
      <div className="mx-auto max-w-[76em] px-[1.6em] py-[4.5em]">
        {/* The imprint keeps its own track at every width — the sitemap
            wraps around it rather than pushing it below the fold. */}
        <div className="grid gap-[3em] sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1.35fr_1fr_1fr]">
          <div className="flex flex-col gap-[1.3em] sm:col-span-2 lg:col-span-1">
            <IntentLink
              href="/#top"
              className="flex w-fit items-center"
              aria-label={COMPANY.name}
            >
              <Image
                src={COMPANY.logo}
                alt={COMPANY.name}
                width={2999}
                height={2148}
                // Drawn at 2.2em tall, never more than ~52px wide. Without
                // this the only candidate is the 3840w file, 51KB of logo
                // for a mark the size of a thumbnail.
                sizes="56px"
                className="h-[2.2em] w-auto"
              />
            </IntentLink>

            {/* The registration block. An address on an `address` element
                and a legal name that leads it: this is the identity the
                law, a bank and a suspicious buyer all read, and it is set
                to be read rather than to be tucked away. */}
            <address className="flex flex-col gap-[0.35em] text-[length:max(0.72em,12px)] not-italic leading-[1.6] text-[var(--cover-paper)]/70 lg:text-[0.72em]">
              <span className="text-[var(--cover-paper)]/85">
                {COMPANY.legalName}
              </span>
              <span>{COMPANY.cui}</span>
              <span className="max-w-[24em]">{COMPANY.address}</span>
            </address>

            {/* The phone lives in the page's close, a few hundred pixels
                above this, where it is an invitation. Printed twice it
                stops being one. */}
            {COMPANY.email ? (
              <a
                href={`mailto:${COMPANY.email}`}
                className="inline-flex w-fit items-center gap-[0.55em] text-[length:max(0.85em,14px)] text-[var(--cover-paper)]/75 transition-colors duration-500 hover:text-[var(--cover-brand-lit)] lg:text-[0.85em]"
              >
                <Mail className="size-[1.05em]" strokeWidth={1.9} />
                {COMPANY.email}
              </a>
            ) : null}
          </div>

          {FOOTER.columns.map((column) => (
            <LinkColumn key={column.title} column={column} />
          ))}
        </div>

        <div className="mt-[3.5em] flex flex-col gap-[1.2em] border-t border-[var(--cover-paper)]/12 pt-[1.8em] lg:flex-row lg:items-center lg:justify-between">
          <p className="mono flex items-center gap-[1em] text-[length:max(0.62em,11px)] uppercase tracking-[0.16em] text-[var(--cover-paper)]/55 lg:text-[0.62em]">
            <CornerDot className="size-[0.7em] shrink-0 text-[var(--cover-brand-lit)]/50" />
            © {year} {COMPANY.legalName} — all rights reserved
          </p>

          {/* The four policies, and only those. The consumer-protection
              links that used to sit beside them were Romanian; the product
              sells internationally, where they point a reader at a body
              with no jurisdiction over them. lib/site.ts records why. */}
          <nav aria-label="Legal">
            <ul className="flex flex-wrap items-center gap-x-[1.4em] gap-y-[0.6em]">
              {FOOTER.legal.map((l) => (
                <li key={l.href}>
                  <IntentLink href={l.href} className={legalLink}>
                    {l.label}
                  </IntentLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
