"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { HERO_COVER as C, COVER_ART, COVER_FOCAL } from "@/lib/site";
import { DepthPortrait } from "./depth-portrait";
import { CursorCta } from "./cursor-cta";
import { CornerDot } from "./corner-dot";
import { cn } from "@/lib/utils";

/** COVER_FOCAL as numbers, for the shader's cover mapping. */
const FOCAL: [number, number] = [0.5, 0.406];

const EASE = [0.16, 1, 0.3, 1] as const;

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
 * The cover.
 * ------------------------------------------------------------------ */
export function Hero() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);

  // True while the pointer is carrying the CTA. The corner button and the
  // cursor are one control in two states, so exactly one of them shows.
  const [cursorArmed, setCursorArmed] = useState(false);

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
      style={{
        fontFamily: "var(--font-display)",
        // The chip IS the cursor while it is armed, so the native one goes.
        cursor: cursorArmed ? "none" : undefined,
      }}
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

      {/* The rule the masthead is stuck to.
          It belongs to the cover rather than to the header, which is the
          whole point of it: as the plate withdraws to pill width the line
          is uncovered at both ends — the mark revealed by the departure —
          and then it scrolls away with the hero. Outside the parallax
          layer so it holds still under the bar it answers to. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-[var(--site-header-h)] z-10"
      >
        <div className="mx-auto w-full max-w-[var(--size-container)] px-[1.5em]">
          <div className="relative h-px w-full bg-[var(--cover-paper)]/12">
            {/* Flashes once, on contact, when the header lands back on it. */}
            <span className="hdr-seam absolute inset-0 origin-left bg-[var(--cover-brand-lit)] opacity-0" />
          </div>
        </div>
      </div>

      {/* Content */}
      <motion.div
        style={{ y: reduce ? 0 : contentY, opacity: reduce ? 1 : contentFade }}
        className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-[var(--size-container)] flex-col justify-between gap-[4em] px-[1.5em] pb-[2em] pt-0 md:gap-[6em]"
      >
        {/* The fixed site header sits over this strip. It is a page-level
            element — it cannot live in here, because this layer carries a
            transform and a transformed ancestor becomes the containing
            block for `fixed` children. */}
        <div aria-hidden className="h-[var(--site-header-h)] shrink-0" />

        {/* Headline block sits on columns 5–9, leaving room for the
            corner marks to bracket it and for the CTA to sit far left. */}
        <div className="relative flex flex-col items-center gap-[1.5em] sm:gap-[3em] md:grid md:grid-cols-12 md:items-end md:gap-0">
          {/* Steps aside while the pointer carries the same action — but
              comes back for a keyboard, which has no pointer to carry it. */}
          <div
            className={cn(
              "order-2 transition-opacity duration-300 focus-within:opacity-100 md:absolute md:left-0 md:top-0 md:order-none md:pt-[1em]",
              cursorArmed && "opacity-0",
            )}
          >
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

      {/* Deliberately outside the content layer: that layer carries the
          parallax transform, and a transformed ancestor becomes the
          containing block for `fixed` children — the chip would then track
          the drifting layer instead of the pointer. */}
      <CursorCta
        targetRef={ref}
        href={C.cta.href}
        label={C.cta.label}
        onArmedChange={setCursorArmed}
      />
    </section>
  );
}
