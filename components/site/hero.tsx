"use client";

import Link from "next/link";
import { useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { HERO_COVER as C, COVER_ART, COVER_FOCAL } from "@/lib/site";
import { DepthPortrait } from "./depth-portrait";
import { CornerDot } from "./ui";
import { cn } from "@/lib/utils";

/** COVER_FOCAL as numbers, for the shader's cover mapping. */
const FOCAL: [number, number] = [0.5, 0.406];

const EASE = [0.16, 1, 0.3, 1] as const;

/* ------------------------------------------------------------------ *
 * Geometric label glyphs. Each quick-nav column is flagged by one, set
 * outside the column's left edge so it hangs into the gutter.
 * ------------------------------------------------------------------ */
const GLYPHS = {
  triangle: <path d="M0 0L14 14H0V0Z" fill="currentColor" />,
  circle: <circle cx="7" cy="7" r="7" fill="currentColor" />,
  square: <rect width="14" height="14" fill="currentColor" />,
} as const;

function Glyph({ name, className }: { name: keyof typeof GLYPHS; className?: string }) {
  return (
    <svg viewBox="0 0 14 14" fill="none" aria-hidden className={className}>
      {GLYPHS[name]}
    </svg>
  );
}

/** The 10px squares that bracket the headline block's four corners. */
function CornerMarks() {
  const reduce = useReducedMotion();
  // Flush to the block's edges, exactly as the reference sets them
  // (`top:1.375em; right:100%` and friends).
  const at = {
    tl: "top-[1.375em] right-full mr-[0.7em]",
    tr: "top-[1.375em] left-full ml-[0.7em]",
    bl: "bottom-[0.125em] right-full mr-[0.7em]",
    br: "bottom-[0.125em] left-full ml-[0.7em]",
  };
  return (
    <>
      {Object.entries(at).map(([k, pos], i) => (
        <motion.span
          key={k}
          aria-hidden
          className={cn("absolute block size-[0.625em] bg-current", pos)}
          initial={reduce ? false : { opacity: 0, scale: 0.4 }}
          animate={reduce ? undefined : { opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 1.15 + i * 0.07, ease: EASE }}
        />
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Word-by-word mask reveal — the signature motion of the reference.
 * Each word rides up out of its own clipping box.
 * ------------------------------------------------------------------ */
function SplitLines({
  lines,
  delay = 0,
  stagger = 0.045,
  className,
}: {
  lines: readonly string[];
  delay?: number;
  stagger?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  let n = 0;

  return (
    <span className={className}>
      {lines.map((line, li) => (
        <span key={li} className="block">
          {line.split(" ").map((word, wi, arr) => {
            const i = n++;
            return (
              // The mask is padded below the baseline so descenders clear
              // it, then pulled back so line-height is unaffected.
              <span
                key={wi}
                className="inline-block -mb-[0.16em] overflow-hidden pb-[0.16em] align-bottom"
              >
                <motion.span
                  className={cn(
                    "inline-block",
                    wi < arr.length - 1 && "pr-[0.24em]",
                  )}
                  initial={reduce ? false : { y: "115%" }}
                  animate={reduce ? undefined : { y: "0%" }}
                  transition={{
                    duration: 0.95,
                    delay: delay + i * stagger,
                    ease: EASE,
                  }}
                >
                  {word}
                </motion.span>
              </span>
            );
          })}
        </span>
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Live clock in the company's own timezone.
 * Renders placeholders until mounted so server and client markup agree.
 * ------------------------------------------------------------------ */
/** Ticks once a second; reports 0 on the server so hydration matches. */
const SECONDS = {
  subscribe(onChange: () => void) {
    const id = setInterval(onChange, 1000);
    return () => clearInterval(id);
  },
  get: () => Math.floor(Date.now() / 1000),
  getOnServer: () => 0,
};

function Clock() {
  const epoch = useSyncExternalStore(
    SECONDS.subscribe,
    SECONDS.get,
    SECONDS.getOnServer,
  );
  const now = epoch ? new Date(epoch * 1000) : null;

  const time = now
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: C.timeZone,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(now)
    : "--:--:--";

  // Romania runs EET in winter, EEST in summer — read it off the offset.
  let zone = "";
  if (now) {
    const offset =
      new Intl.DateTimeFormat("en-US", {
        timeZone: C.timeZone,
        timeZoneName: "longOffset",
      })
        .formatToParts(now)
        .find((p) => p.type === "timeZoneName")?.value ?? "";
    zone = offset.includes("+03") ? "EEST" : "EET";
  }

  return (
    <div className="flex flex-col items-start gap-[0.25em]">
      <p className="text-[0.75em] leading-[1.1] tabular-nums">{time}</p>
      <div className="flex items-center gap-[0.6em] text-[0.75em] leading-[1.1] opacity-60">
        <span className="min-w-[2.6em]">{zone || " "}</span>
        <span>{C.place}</span>
      </div>
    </div>
  );
}

/** Four bars keeping time — a voice product's answer to a sound toggle. */
function Equalizer() {
  return (
    <div
      aria-hidden
      className="flex h-[1.1em] w-[2em] items-end justify-center gap-[0.16em]"
    >
      {[0.55, 1, 0.4, 0.78].map((h, i) => (
        <span
          key={i}
          className="w-[0.14em] bg-current"
          style={{
            height: `${h * 100}%`,
            transformOrigin: "bottom",
            animation: `equalize ${0.8 + i * 0.22}s ease-in-out ${i * 0.13}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Primary call to action. The reference keeps this button near-invisible;
 * on a conversion page it has to carry weight, so it is inverted to paper
 * and flips to the brand purple on hover.
 * ------------------------------------------------------------------ */
function CoverCta() {
  return (
    <Link
      href={C.cta.href}
      className="group inline-grid select-none text-[1.25em] leading-[1.2] tracking-[-0.04em]"
    >
      <span className="col-start-1 row-start-1 grid grid-cols-2 grid-rows-2 rounded-[0.2em] bg-[var(--cover-paper)] p-[0.33em] text-[var(--cover-ink)] transition-colors duration-500 group-hover:bg-[var(--cover-brand)] group-hover:text-[var(--cover-paper)]">
        <CornerDot className="size-[0.3em] justify-self-start transition-transform duration-500 group-hover:-translate-x-[0.12em] group-hover:-translate-y-[0.12em]" />
        <CornerDot className="size-[0.3em] justify-self-end transition-transform duration-500 group-hover:-translate-y-[0.12em] group-hover:translate-x-[0.12em]" />
        <CornerDot className="size-[0.3em] self-end justify-self-start transition-transform duration-500 group-hover:-translate-x-[0.12em] group-hover:translate-y-[0.12em]" />
        <CornerDot className="size-[0.3em] self-end justify-self-end transition-transform duration-500 group-hover:translate-x-[0.12em] group-hover:translate-y-[0.12em]" />
      </span>
      <span className="col-start-1 row-start-1 z-10 flex items-center gap-[0.45em] whitespace-nowrap px-[1em] py-[0.8em] text-[var(--cover-ink)] transition-colors duration-500 group-hover:text-[var(--cover-paper)]">
        {C.cta.label}
        <span className="transition-transform duration-500 group-hover:translate-x-[0.25em]">
          →
        </span>
      </span>
    </Link>
  );
}

/* ------------------------------------------------------------------ *
 * Mobile menu. Below md the three quick-nav columns cannot sit side by
 * side without crowding the figure, so they move behind a toggle and
 * open as a full-height sheet.
 * ------------------------------------------------------------------ */
/** false while server-rendering, true once mounted — the portal needs a DOM. */
const MOUNTED = {
  subscribe: () => () => {},
  get: () => true,
  getOnServer: () => false,
};

function MobileMenu() {
  const [open, setOpen] = useState(false);
  const mounted = useSyncExternalStore(
    MOUNTED.subscribe,
    MOUNTED.get,
    MOUNTED.getOnServer,
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        // Distinct from the site navbar's toggle, which carries the same
        // action but lives outside the cover.
        aria-label="Open cover menu"
        className="flex items-center gap-[0.5em] text-[0.95em] leading-none tracking-[-0.03em] md:hidden"
      >
        <span className="flex flex-col gap-[0.22em]">
          <span className="block h-px w-[1.35em] bg-current" />
          <span className="block h-px w-[1.35em] bg-current" />
        </span>
        Menu
      </button>

      {/* Portalled to <body>: the cover's content layer carries a parallax
          transform, and a transformed ancestor becomes the containing block
          for `fixed` descendants — the sheet would size and clip to it
          instead of the viewport. */}
      {mounted &&
        createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: EASE }}
              data-cover-menu
              style={{ backgroundColor: "rgba(6,4,10,0.985)" }}
              className="cover fixed inset-0 z-[100] flex flex-col overflow-y-auto px-[1.5em] py-[1.5em] text-[var(--cover-paper)] backdrop-blur-md md:hidden"
            >
            <div className="flex items-center justify-between">
              <span className="text-[1.15em] font-medium leading-none tracking-[-0.07em]">
                {C.wordmark}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="text-[0.95em] leading-none tracking-[-0.03em]"
              >
                Close
              </button>
            </div>

            <nav className="mt-[2.5em] flex flex-col gap-[2em]">
              {C.columns.map((col, i) => (
                <motion.div
                  key={col.label}
                  initial={{ opacity: 0, y: "0.6em" }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.06 + i * 0.06, ease: EASE }}
                >
                  <div className="relative mb-[0.7em] flex items-center gap-[0.5em] opacity-60">
                    <Glyph name={col.glyph} className="size-[0.6em]" />
                    <span className="text-[0.85em] uppercase tracking-[0.12em]">
                      {col.label}
                    </span>
                  </div>
                  <div className="flex flex-col gap-[0.55em]">
                    {col.links.map((l) => (
                      <Link
                        key={l.label}
                        href={l.href}
                        onClick={() => setOpen(false)}
                        className="text-[1.5em] leading-[1.15] tracking-[-0.04em]"
                      >
                        {l.label}
                      </Link>
                    ))}
                  </div>
                </motion.div>
              ))}
            </nav>

            <div className="mt-auto pt-[2em]">
              <CoverCta />
            </div>
            </motion.div>
          )}
        </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Quick-nav: the utility grid across the top of the cover.
 * ------------------------------------------------------------------ */
function QuickNav() {
  const reduce = useReducedMotion();
  const fade = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: "0.6em" },
    animate: reduce ? undefined : { opacity: 1, y: 0 },
    transition: { duration: 0.8, delay, ease: EASE },
  });

  // Desktop column starts, lifted verbatim from the reference's grid.
  const starts = ["md:col-start-3", "md:col-start-5", "md:col-start-7"];

  return (
    <nav
      aria-label="Quick links"
      className="flex w-full items-start justify-between gap-[1em] md:grid md:grid-cols-12 md:gap-[0.25em]"
    >
      <motion.div {...fade(0.1)} className="md:col-span-2 md:col-start-1">
        <Link
          href="#top"
          // Held back below lg, where the quick-nav's first column starts
          // close enough that a full-size wordmark collides with its glyph.
          className="text-[1.15em] font-medium leading-none tracking-[-0.07em] lg:text-[1.6em]"
        >
          {C.wordmark}
        </Link>
      </motion.div>

      {C.columns.map((col, i) => (
        <motion.div
          key={col.label}
          {...fade(0.16 + i * 0.06)}
          className={cn(
            "hidden md:col-span-2 md:flex md:flex-col md:items-start md:gap-[0.6em] md:pt-[0.5em]",
            starts[i],
          )}
        >
          <div className="relative flex items-center">
            <Glyph
              name={col.glyph}
              className="absolute right-[calc(100%+0.4em)] size-[0.7em]"
            />
            <span className="text-[1.25em] leading-[1.2] tracking-[-0.025em]">
              {col.label}
            </span>
          </div>
          <div className="flex flex-col items-start gap-[0.4em]">
            {col.links.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                className="cover-link text-[0.875em] leading-[1.3] tracking-[-0.03em] opacity-70 transition-opacity hover:opacity-100"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </motion.div>
      ))}

      {/* `md:contents` dissolves this wrapper at md so the clock rejoins
          the 12-column grid, while below md it groups with the toggle. */}
      <div className="flex items-start gap-[1.5em] md:contents">
        <motion.div
          {...fade(0.34)}
          className="md:col-span-2 md:col-start-9 md:pt-[0.5em]"
        >
          <Clock />
        </motion.div>
        <motion.div {...fade(0.4)}>
          <MobileMenu />
        </motion.div>
      </div>


      <motion.div
        {...fade(0.4)}
        // "Discover" is the first thing the reference drops (below 991px),
        // while its three link columns survive all the way down.
        className="hidden lg:col-span-1 lg:col-start-12 lg:flex lg:flex-col lg:items-end lg:pt-[0.5em]"
      >
        <div className="flex items-center gap-[0.8em]">
          <span className="text-[0.875em] leading-[1.3] tracking-[-0.03em]">
            {C.scrollLabel}
          </span>
          <span className="relative block h-[2.4em] w-px overflow-hidden">
            <span
              className="absolute inset-0 bg-current"
              style={{ opacity: 0.22 }}
            />
            <motion.span
              className="absolute inset-x-0 top-0 h-1/3 bg-current"
              initial={false}
              animate={reduce ? undefined : { y: ["-110%", "320%"] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            />
          </span>
        </div>
      </motion.div>
    </nav>
  );
}

/* ------------------------------------------------------------------ *
 * The cover.
 * ------------------------------------------------------------------ */
export function Hero() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);

  /* One crop at every width. The cover used to art-direct a taller crop
     onto phones, which kept the whole silhouette in frame but rendered the
     head about a third smaller — and the dissolve scales with the head, so
     the tear came out too fine to read and phones got a smooth face where
     the desktop got filaments. The wide crop fills a phone frame edge to
     edge instead: the head reads as a poster and the effect is identical
     because it is literally the same artwork at the same relative size.
     The trade is the outer edge of the ears at very narrow aspects. */
  const art = COVER_ART.landscape;

  // The portrait drifts down as the cover scrolls away, exactly the
  // parallax the reference runs on its own background layer.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const portraitY = useTransform(scrollYProgress, [0, 1], ["0%", "16%"]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "-8%"]);
  const contentFade = useTransform(scrollYProgress, [0, 0.75], [1, 0]);

  return (
    <section
      id="top"
      ref={ref}
      className="cover relative isolate min-h-[100dvh] overflow-clip bg-[var(--cover-ink)] text-[var(--cover-paper)]"
      style={{ fontFamily: "var(--font-display)" }}
    >
      {/* Portrait */}
      <motion.div
        aria-hidden
        style={{ y: reduce ? 0 : portraitY }}
        className="absolute inset-0 -z-10 scale-[1.08]"
      >
        {/* Base layer: server-rendered, carries the LCP, and stays put if
            WebGL2 is unavailable or the visitor prefers reduced motion.

            One crop at every width, anchored on the eyes, so the phone and
            the desktop are the same picture — full-bleed cover, no bars,
            no drifting face. */}
        {/* Deliberately a raw <img>, not next/image: DepthPortrait loads
            this exact file as a WebGL texture via new Image(), so routing
            it through the optimizer would serve a second, different file
            and pay for the artwork twice. It is already a hand-derived
            webp at the size it is displayed at. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={COVER_ART.landscape.src}
          alt=""
          fetchPriority="high"
          decoding="async"
          // Graded down hard: the source render is brighter and more
          // saturated than this palette wants.
          className="absolute inset-0 size-full object-cover brightness-[0.82] contrast-[1.18] saturate-[0.88]"
          style={{ objectPosition: COVER_FOCAL }}
        />
        {/* Depth-map parallax, fading in over the still once compiled. */}
        <DepthPortrait
          art={art}
          focal={FOCAL}
          className="absolute inset-0 size-full brightness-[0.82] contrast-[1.18] saturate-[0.88]"
        />
      </motion.div>

      {/* Scrims: lift the top nav and bottom headline off the portrait. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          // Darkens from just under half height so the headline keeps its
          // contrast when a short or narrow window crops the backlit glow
          // up behind the type.
          background:
            "linear-gradient(to bottom, rgba(6,4,10,0.72) 0%, rgba(6,4,10,0.10) 20%, rgba(6,4,10,0.26) 44%, rgba(6,4,10,0.66) 62%, rgba(6,4,10,0.90) 82%, var(--cover-ink) 100%)",
        }}
      />
      {/* Purple pigment wash + a vignette that pulls the frame back to ink. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(62% 50% at 52% 32%, rgba(var(--cover-brand-rgb),0.16), transparent 72%), radial-gradient(105% 88% at 50% 46%, transparent 34%, rgba(6,4,10,0.55) 76%, rgba(6,4,10,0.92) 100%)",
        }}
      />
      <div aria-hidden className="cover-grain absolute inset-0 -z-10" />

      {/* Content */}
      <motion.div
        style={{ y: reduce ? 0 : contentY, opacity: reduce ? 1 : contentFade }}
        className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-[var(--size-container)] flex-col justify-between gap-[4em] px-[1.5em] pb-[2em] pt-[1.5em] md:gap-[6em] md:pt-[0.75em]"
      >
        <QuickNav />

        {/* Headline block sits on columns 5–9, leaving room for the
            corner marks to bracket it and for the CTA to sit far left. */}
        <div className="relative flex flex-col items-center gap-[1.5em] sm:gap-[3em] md:grid md:grid-cols-12 md:items-end md:gap-0">
          <div className="order-2 md:absolute md:left-0 md:top-0 md:order-none md:pt-[1em]">
            <CoverCta />
          </div>

          {/* `w-max` mirrors the reference's `place-self:center`: the block
              is only as wide as its longest line, so the corner marks
              bracket the type itself rather than the whole grid area. */}
          <div className="relative order-1 flex flex-col items-center gap-[0.85em] text-center sm:gap-[1.4em] md:order-none md:col-span-4 md:col-start-5 md:w-max md:justify-self-center md:gap-[3em]">
            <CornerMarks />
            {/* Held down on short phones so four wrapped lines still clear
                the chin instead of riding up over the face. */}
            <h1 className="text-balance text-[1.8em] font-medium leading-[1.04] tracking-[-0.04em] sm:text-[2.5em]">
              <SplitLines lines={C.headline} delay={0.45} />
            </h1>
            <p className="text-[1.8em] font-medium leading-[1.04] tracking-[-0.04em] sm:text-[2.5em]">
              <SplitLines lines={[C.era]} delay={1.05} />
            </p>
          </div>

          <div className="order-3 hidden md:col-span-2 md:col-start-11 md:order-none md:flex md:justify-end md:self-end">
            <Equalizer />
          </div>
        </div>
      </motion.div>
    </section>
  );
}
