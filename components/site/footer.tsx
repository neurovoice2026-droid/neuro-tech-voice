import Link from "next/link";
import Image from "next/image";
import { Phone } from "lucide-react";
import { FOOTER, COMPANY } from "@/lib/site";
import { CornerDot } from "./ui";

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
 * Flat ink, the same token, no field.
 */

function LinkColumn({
  title,
  links,
}: {
  title: string;
  links: readonly { label: string; href: string }[];
}) {
  return (
    <div className="flex flex-col gap-[1.1em]">
      <p className="mono text-[0.6em] font-semibold uppercase tracking-[0.22em] text-[var(--cover-paper)]/45">
        {title}
      </p>
      <ul className="flex flex-col gap-[0.7em]">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="text-[0.85em] text-[var(--cover-paper)]/55 transition-colors duration-200 hover:text-[var(--cover-brand-lit)]"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  return (
    <footer
      className="cover cover-grain relative bg-[var(--cover-ink)] text-[var(--cover-paper)]"
      style={{ fontFamily: "var(--font-display)" }}
    >
      <div className="mx-auto max-w-[76em] px-[1.6em] py-[4.5em]">
        <div className="grid gap-[3em] md:grid-cols-[1.7fr_1fr_1fr]">
          <div className="flex flex-col gap-[1.3em]">
            <Link
              href="#top"
              className="flex items-center"
              aria-label={COMPANY.name}
            >
              <Image
                src={COMPANY.logo}
                alt={COMPANY.name}
                width={2999}
                height={2148}
                className="h-[2.2em] w-auto"
              />
            </Link>

            <p className="max-w-[22em] text-[0.88em] leading-[1.6] text-[var(--cover-paper)]/50">
              {FOOTER.tagline}
            </p>

            <div className="flex flex-col gap-[0.35em] text-[0.72em] leading-[1.6] text-[var(--cover-paper)]/35">
              <span className="text-[var(--cover-paper)]/60">
                {COMPANY.legalName}
              </span>
              <span>{COMPANY.cui}</span>
              <span className="max-w-[24em]">{COMPANY.address}</span>
            </div>

            <a
              href={COMPANY.phoneHref}
              className="inline-flex items-center gap-[0.55em] text-[0.85em] text-[var(--cover-paper)]/55 transition-colors duration-200 hover:text-[var(--cover-brand-lit)]"
            >
              <Phone className="size-[1.05em]" strokeWidth={1.9} />
              {COMPANY.phone}
            </a>
          </div>

          <LinkColumn title="Product" links={FOOTER.product} />
          <LinkColumn title="Legal" links={FOOTER.legal} />
        </div>

        <div className="mt-[3.5em] flex flex-wrap items-center gap-[1em] border-t border-[var(--cover-paper)]/10 pt-[1.8em]">
          <CornerDot className="size-[0.7em] shrink-0 text-[var(--cover-brand-lit)]/50" />
          <p className="mono text-[0.62em] uppercase tracking-[0.16em] text-[var(--cover-paper)]/30">
            © 2026 {COMPANY.legalName} — all rights reserved
          </p>
        </div>
      </div>
    </footer>
  );
}
