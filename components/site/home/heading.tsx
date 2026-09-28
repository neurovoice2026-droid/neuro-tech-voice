"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import type { gsap } from "gsap";
import type { SplitText } from "gsap/SplitText";
import { cn } from "@/lib/utils";
import { useDeviceTier } from "@/components/site/product/device-tier";
import { useKitContext, useMotionKit } from "@/components/site/product/motion-kit";
import { Eyebrow } from "@/components/site/product/primitives";
import { useInView, usePrefersReducedMotion } from "@/components/site/product/timing";
import { TYPE, WEIGHT } from "./type";

/* ------------------------------------------------------------------ *
 * How every landing section opens: eyebrow, heading, one line of sub,
 * and at most one action beside it.
 *
 * Each heading carries one coloured phrase, its payoff (`titleKey`):
 * violet on light, lilac on night and on the deep panel, muted on the
 * one quiet heading (home.css `.home-key`).
 *
 * The heading's lines rise out of their own masks the first time it
 * comes into view, once, and the phrase eases from ink into its colour
 * after the lines have landed. It is only ever hidden while it is still
 * below the screen: a heading the reader has already seen (on screen
 * when GSAP arrives, or scrolled past, or landed on from a #link) stays
 * exactly as the server drew it, in colour. With reduced motion, or on a
 * device too weak to spend a frame on it, nothing is split at all.
 * ------------------------------------------------------------------ */

/** The section's small label. Violet on light (the body's --pp-accent), lilac on dark; the corner dot follows the text. */
export function HomeEyebrow({
  children,
  tone = "light",
  className,
}: {
  children: ReactNode;
  tone?: "light" | "dark";
  className?: string;
}) {
  return <Eyebrow className={cn(tone === "dark" && "text-(--home-lilac)", className)}>{children}</Eyebrow>;
}

/** A hyphenated word never breaks at its hyphen ("follow- / up"). */
function keepHyphens(text: string, prefix: string): ReactNode[] {
  return text.split(/(\S+-\S+)/).map((part, i) =>
    i % 2 ? (
      <span key={`${prefix}${i}`} className="whitespace-nowrap">
        {part}
      </span>
    ) : (
      <Fragment key={`${prefix}${i}`}>{part}</Fragment>
    ),
  );
}

/** Up to this many characters the phrase never breaks; past it, only its last two words are held together. */
const NOWRAP_KEY = 14;

/**
 * A title with its key phrase marked: the last occurrence of `titleKey`
 * wrapped in `.home-key`. A short phrase never wraps; a longer one keeps
 * its last two words together with a no-break space, so it never leaves
 * one word on a line of its own. A title without the phrase in it is
 * drawn plain (home.test.ts holds every key to its title).
 */
export function KeyedTitle({
  title,
  titleKey,
  keyTone,
  lit = false,
}: {
  title: string;
  titleKey?: string;
  keyTone?: "quiet" | "spectrum";
  /** On night or the deep panel. */
  lit?: boolean;
}) {
  const at = titleKey ? title.lastIndexOf(titleKey) : -1;
  if (!titleKey || at < 0) return <>{keepHyphens(title, "t")}</>;
  const short = titleKey.length <= NOWRAP_KEY;
  const words = short ? titleKey : titleKey.replace(/ (?=\S+$)/, " ");
  return (
    <>
      {keepHyphens(title.slice(0, at), "a")}
      <span
        className={cn(
          "home-key",
          short && "whitespace-nowrap",
          lit && "home-key-lit",
          keyTone === "quiet" && "home-key-quiet",
          keyTone === "spectrum" && "home-key-spectrum",
        )}
      >
        {keepHyphens(words, "k")}
      </span>
      {keepHyphens(title.slice(at + titleKey.length), "b")}
    </>
  );
}

export function HomeHeading({
  id,
  eyebrow,
  title,
  titleKey,
  keyTone,
  sub,
  action,
  tone = "light",
  size = "h2",
  align = "left",
  className,
}: {
  /** Goes on the h2, for the section's aria-labelledby. */
  id?: string;
  eyebrow?: string;
  /** A string, so the key phrase can be found in it; a node is drawn as given, with no phrase marked. */
  title: ReactNode;
  /** The phrase in `title` that takes colour: the section's `key`, exactly as the title spells it. */
  titleKey?: string;
  /** "quiet": the phrase in muted rather than in colour (#faq only). */
  keyTone?: "quiet" | "spectrum";
  sub?: ReactNode;
  action?: ReactNode;
  /** "dark" on the night band and on the deep panel: paper heading, lilac eyebrow and phrase. */
  tone?: "light" | "dark";
  size?: "h2" | "display";
  align?: "left" | "center";
  className?: string;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  useLineReveal(titleRef);
  const dark = tone === "dark";
  const center = align === "center";
  // Beside the text at lg when left-aligned; under the sub otherwise.
  const beside = action != null && !center;

  return (
    <div
      className={cn(
        beside && "lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-12",
        center && "flex flex-col items-center text-center",
        dark && "text-(--home-paper)",
        className,
      )}
    >
      <div className={cn("min-w-0", center && "flex flex-col items-center")}>
        {eyebrow && (
          <HomeEyebrow tone={tone} className={cn("mb-4", center && "justify-center")}>
            {eyebrow}
          </HomeEyebrow>
        )}
        <h2 ref={titleRef} id={id} className={TYPE[size]} style={{ fontWeight: WEIGHT[size] }}>
          {typeof title === "string" ? (
            <KeyedTitle title={title} titleKey={titleKey} keyTone={keyTone} lit={dark} />
          ) : (
            title
          )}
        </h2>
        {sub && (
          <p className={cn("mt-4 max-w-[600px] text-pretty", TYPE.lead, dark && "text-(--home-paper-dim)")}>{sub}</p>
        )}
      </div>
      {action && <div className={cn("mt-6", beside && "lg:mt-0")}>{action}</div>}
    </div>
  );
}

/** How long a reveal waits on a font that has not arrived before it splits anyway. */
const FONT_WAIT_MS = 3000;

/**
 * True once the element's own face has loaded (and whatever else the
 * page was fetching), so lines are measured in the font they will be
 * drawn in. Split in the fallback face, a heading re-splits when the
 * real one lands and its lines shift under the reader.
 */
function useFontsSettled(ref: RefObject<HTMLElement | null>, wanted: boolean) {
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!wanted || settled) return;
    let live = true;
    const done = () => {
      if (live) setSettled(true);
    };
    const el = ref.current;
    const fonts = typeof document !== "undefined" ? document.fonts : undefined;
    let load: Promise<unknown> = Promise.resolve();
    if (fonts && el) {
      try {
        const font = getComputedStyle(el).font;
        if (font) load = fonts.load(font, el.textContent || undefined).catch(() => undefined);
      } catch {
        // An unparsable shorthand: fonts.ready below still covers it.
      }
      load = load.then(() => fonts.ready);
    }
    const timer = window.setTimeout(done, FONT_WAIT_MS);
    load.then(done, done);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [ref, wanted, settled]);

  return settled;
}

/**
 * Lines rising out of their masks, once, when the element first comes
 * into view. Never on a heading the reader may already have seen, never
 * with reduced motion or on the lite tier, and the split is undone the
 * moment it has played, so the finished heading is the server's markup
 * again.
 *
 * While split, the heading carries `data-ink`, which holds its key
 * phrase in the heading's own ink (home.css); one frame after the split
 * is undone the attribute goes, and the phrase eases into its colour.
 */
export function useLineReveal(ref: RefObject<HTMLElement | null>, { delay = 0 }: { delay?: number } = {}) {
  const reduce = usePrefersReducedMotion();
  const tier = useDeviceTier();
  // Nothing moves: the heading stays exactly as the server drew it, in colour.
  const still = reduce || tier === "lite" || tier === "still";
  const near = useInView(ref, "25% 0px");
  const inView = useInView(ref, "0px 0px -15% 0px");
  const fonts = useFontsSettled(ref, near && !still);
  const kit = useMotionKit(near && !still && fonts);
  const reveal = useRef<gsap.core.Timeline | null>(null);
  const split = useRef<SplitText | null>(null);
  // Seen once, whole: from then on it is never hidden again.
  const seen = useRef(false);
  const go = useRef(false);

  useKitContext(
    kit,
    ({ gsap, SplitText }) => {
      const el = ref.current;
      if (!el || still || seen.current) return;
      // Any part of it on screen, or above: hiding it now would be a flash.
      if (el.getBoundingClientRect().top < window.innerHeight) {
        seen.current = true;
        return;
      }
      let raf = 0;
      el.setAttribute("data-ink", "");
      split.current = SplitText.create(el, {
        type: "lines",
        mask: "lines",
        // Re-split if the column changes width while the heading waits
        // below the screen; the reveal returned below carries its
        // progress across. Stopped the moment it starts to play.
        autoSplit: true,
        onSplit: (s) => {
          const tl = gsap.timeline({
            paused: !go.current,
            onComplete: () => {
              seen.current = true;
              reveal.current = null;
              split.current = null;
              s.revert();
              // The server's markup back, in ink for one frame; then the
              // phrase eases into its colour (home.css `.home-key`).
              raf = requestAnimationFrame(() => el.removeAttribute("data-ink"));
            },
          });
          tl.from(s.lines, { yPercent: 100, duration: 0.8, ease: "power3.out", stagger: 0.08 }, delay);
          reveal.current = tl;
          return tl;
        },
      });
      return () => {
        cancelAnimationFrame(raf);
        reveal.current = null;
        split.current = null;
        el.removeAttribute("data-ink");
      };
    },
    // Reduced motion, or a drop to the lite tier, mid-way puts the server's markup back.
    { scope: ref, dependencies: [still], revertOnUpdate: true },
  );

  useEffect(() => {
    if (!inView) return;
    go.current = true;
    // From here the lines are fixed: a re-split mid-flight, for a late
    // font or a resize, would shift them under the reader.
    split.current?.kill();
    reveal.current?.play();
  }, [inView, kit]);
}
