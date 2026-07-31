"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { NAV_LINKS, AUTH, COMPANY } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * The bar — the last thing on the page still speaking the old language.
 *
 * It was a white pill with a light-purple button, and once everything
 * underneath it had moved onto the cover's ink it was the one element
 * arguing with the whole page — and the one element present on every
 * single screen of it. A visitor scrolling the interior spread saw eleven
 * sections of one design system with a twelfth floating on top.
 *
 * Same behaviour as before, unchanged: the cover owns the first screen and
 * carries its own quick-nav, so the bar stays out of the way until that
 * screen has gone by. Only the stock changed — ink, a hairline, the
 * cover's own brand accent on the single primary action.
 *
 * It carries `.cover` itself so the palette and the fluid `em` base
 * resolve here too; it is `fixed`, so it can never inherit them from the
 * spread it floats over.
 */

function Wordmark() {
  return (
    <Link href="#top" className="flex items-center" aria-label={COMPANY.name}>
      <Image
        src={COMPANY.logo}
        alt={COMPANY.name}
        width={2999}
        height={2148}
        priority
        className="h-[1.9em] w-auto"
      />
    </Link>
  );
}

export function Navbar() {
  const [past, setPast] = useState(false);
  const [open, setOpen] = useState(false);

  // The cover owns the first screen and carries its own quick-nav, so this
  // bar stays out of the way until the cover has scrolled past.
  useEffect(() => {
    const onScroll = () => setPast(window.scrollY > window.innerHeight * 0.85);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const shown = past || open;

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <motion.header
      initial={false}
      animate={{ y: shown ? 0 : -96, opacity: shown ? 1 : 0 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      aria-hidden={!shown}
      className={cn(
        "cover fixed inset-x-0 top-3 z-50 px-4 text-[var(--cover-paper)] sm:top-4",
        !shown && "pointer-events-none",
      )}
      style={{ fontFamily: "var(--font-display)" }}
    >
      <nav className="mx-auto flex max-w-[62em] items-center justify-between gap-[1em] rounded-full border border-[var(--cover-paper)]/12 bg-[var(--cover-ink)]/80 px-[0.9em] py-[0.55em] shadow-[0_1em_2.5em_-0.8em_rgba(0,0,0,0.85)] backdrop-blur-xl sm:px-[1.1em]">
        <div className="pl-[0.4em]">
          <Wordmark />
        </div>

        <div className="hidden items-center gap-[0.2em] md:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-full px-[1em] py-[0.55em] text-[0.82em] leading-none text-[var(--cover-paper)]/55 transition-colors duration-200 hover:bg-[var(--cover-paper)]/[0.07] hover:text-[var(--cover-paper)]"
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-[0.4em] md:flex">
          <Link
            href={AUTH.signin}
            className="rounded-full px-[1em] py-[0.55em] text-[0.82em] leading-none text-[var(--cover-paper)]/65 transition-colors duration-200 hover:text-[var(--cover-paper)]"
          >
            Sign in
          </Link>
          <Link
            href={AUTH.signup}
            className="rounded-full bg-[var(--cover-brand-lit)] px-[1.2em] py-[0.6em] text-[0.82em] font-medium leading-none text-[var(--cover-ink)] transition-opacity duration-200 hover:opacity-85"
          >
            Start free
          </Link>
        </div>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
          className="flex size-[2.4em] items-center justify-center rounded-full text-[var(--cover-paper)]/80 transition-colors duration-200 hover:text-[var(--cover-paper)] md:hidden"
        >
          {open ? (
            <X className="size-[1.2em]" strokeWidth={2} />
          ) : (
            <Menu className="size-[1.2em]" strokeWidth={2} />
          )}
        </button>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.24 }}
            className="mx-auto mt-[0.6em] max-w-[62em] overflow-hidden rounded-[1.4em] border border-[var(--cover-paper)]/12 bg-[var(--cover-ink)]/95 p-[0.5em] shadow-[0_1.5em_3em_-1em_rgba(0,0,0,0.9)] backdrop-blur-xl md:hidden"
          >
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="block rounded-[1em] px-[1.1em] py-[0.9em] text-[0.95em] text-[var(--cover-paper)]/85 transition-colors duration-200 hover:bg-[var(--cover-paper)]/[0.07] hover:text-[var(--cover-paper)]"
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-[0.5em] flex flex-col gap-[0.5em] border-t border-[var(--cover-paper)]/10 p-[0.5em] pt-[0.9em]">
              <Link
                href={AUTH.signin}
                onClick={() => setOpen(false)}
                className="rounded-full px-[1.1em] py-[0.75em] text-center text-[0.85em] leading-none text-[var(--cover-paper)]/65"
              >
                Sign in
              </Link>
              <Link
                href={AUTH.signup}
                onClick={() => setOpen(false)}
                className="rounded-full bg-[var(--cover-brand-lit)] px-[1.1em] py-[0.85em] text-center text-[0.85em] font-medium leading-none text-[var(--cover-ink)]"
              >
                Start free
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
