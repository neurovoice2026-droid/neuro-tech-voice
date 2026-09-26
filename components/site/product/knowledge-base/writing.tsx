"use client";

import { useEffect, useRef } from "react";
import type { gsap } from "gsap";
import { WRITING } from "@/lib/pages/knowledge-base";
import { useKitContext, useMotionKit } from "../motion-kit";
import { Frame, Rule, SectionHeading } from "../primitives";
import { useInView, usePrefersReducedMotion } from "../timing";
import { DocBadge } from "./parts";

/* ------------------------------------------------------------------ *
 * The same policy, rewritten for the phone.
 *
 * A sheet shows the clause as a contract would put it. A reading line
 * passes down it and the legal paragraph comes apart word by word, dimming
 * and softening out of focus; in its place the version a caller needs
 * sets itself line by line, each fact underlined as it lands. It holds,
 * then turns back, so the two can be compared.
 *
 * One GSAP timeline, SplitText for the words; the tips beside it are
 * plain text.
 * ------------------------------------------------------------------ */

export function KbWriting() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, "-10% 0px");
  const near = useInView(ref, "25% 0px");
  const reduce = usePrefersReducedMotion();
  const kit = useMotionKit(near && !reduce);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  useKitContext(
    kit,
    ({ gsap, SplitText }) => {
      const q = gsap.utils.selector(ref);
      const split = SplitText.create(q(".wr-before-text")[0], { type: "words", aria: "none" });

      const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 0.6 });
      tl.set(q(".wr-after"), { autoAlpha: 0 })
        .set(q(".wr-after-line"), { autoAlpha: 0, y: 10 })
        .set(q(".wr-mark"), { scaleX: 0 })
        .set(q(".wr-label-after"), { autoAlpha: 0 })
        .set(q(".wr-scan"), { autoAlpha: 0, y: 0 })
        .to({}, { duration: 1.6 })
        .to(q(".wr-scan"), { autoAlpha: 1, duration: 0.2 })
        .to(q(".wr-scan"), { y: () => (q(".wr-before")[0] as HTMLElement).offsetHeight - 6, duration: 1.4, ease: "sine.inOut" }, "<")
        .to(
          split.words,
          { autoAlpha: 0.1, filter: "blur(2px)", y: -3, duration: 0.5, ease: "power1.in", stagger: 0.035 },
          "<0.1",
        )
        .to(q(".wr-scan"), { autoAlpha: 0, duration: 0.25 })
        .to(q(".wr-label-before"), { autoAlpha: 0, duration: 0.3 }, "<")
        .to(q(".wr-label-after"), { autoAlpha: 1, duration: 0.3 })
        .to(q(".wr-before"), { autoAlpha: 0, duration: 0.3 }, "<")
        .set(q(".wr-after"), { autoAlpha: 1 }, "<")
        .to(q(".wr-after-line"), { autoAlpha: 1, y: 0, duration: 0.6, ease: "power3.out", stagger: 0.28 }, "<")
        .to(q(".wr-mark"), { scaleX: 1, duration: 0.5, ease: "power2.out", stagger: 0.28 }, "<0.35")
        .to({}, { duration: 3.2 })
        .to(q(".wr-after"), { autoAlpha: 0, duration: 0.4 })
        .to(q(".wr-label-after"), { autoAlpha: 0, duration: 0.3 }, "<")
        .set(q(".wr-before"), { autoAlpha: 1 })
        .to(q(".wr-label-before"), { autoAlpha: 1, duration: 0.3 })
        .to(split.words, { autoAlpha: 1, filter: "blur(0px)", y: 0, duration: 0.45, stagger: 0.012 }, "<");

      tlRef.current = tl;
      return () => {
        tlRef.current = null;
      };
    },
    { scope: ref, dependencies: [] },
  );

  // Plays while on screen.
  useEffect(() => {
    const tl = tlRef.current;
    if (!tl) return;
    if (inView && !reduce) tl.play();
    else tl.pause();
  }, [inView, reduce, kit]);

  return (
    <>
      <Frame className="px-6 pb-10 md:px-12 md:pb-14">
        <SectionHeading eyebrow={WRITING.eyebrow} className="max-w-[720px]">
          {WRITING.title}
        </SectionHeading>
      </Frame>
      <Rule />
      <Frame className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:divide-x lg:divide-pp-rule">
        <div className="px-4 py-8 md:px-6 lg:py-12 lg:pr-12">
          <div ref={ref} className="relative overflow-hidden rounded-[24px] bg-pp-card px-5 pt-5 pb-10 md:px-10 md:pt-8 md:pb-14">
            <div className="relative h-5">
              <p className="wr-label-before absolute inset-0 motion-reduce:invisible text-[11px] leading-5 font-medium tracking-[0.14em] text-pp-muted uppercase">
                {WRITING.before.label}
              </p>
              <p className="wr-label-after invisible absolute inset-0 motion-reduce:visible text-[11px] leading-5 font-medium tracking-[0.14em] text-[#551a89] uppercase">
                {WRITING.after.label}
              </p>
            </div>

            <div className="relative mt-4 rounded-2xl bg-white p-5 shadow-[0_0_0_1px_rgb(24_16_40/0.06),0_20px_40px_-28px_rgb(24_16_40/0.4)] md:p-7">
              <p className="flex items-center gap-2 text-[12px] leading-4 text-pp-muted">
                <DocBadge kind="DOCX" small />
                Cancellation policy
              </p>
              <div className="mt-4 grid">
                <div className="wr-before relative col-start-1 row-start-1 motion-reduce:invisible">
                  <p className="wr-before-text text-[15px] leading-[24px] text-pp-ink/75">{WRITING.before.text}</p>
                  <span
                    aria-hidden
                    className="wr-scan invisible absolute inset-x-0 top-0 h-6 rounded bg-gradient-to-b from-transparent via-[#551a89]/15 to-transparent"
                  />
                </div>
                {/* With reduced motion there is no rewrite to watch: the caller's version simply shows. */}
                <div className="wr-after invisible col-start-1 row-start-1 motion-reduce:visible">
                  <p className="wr-after-line text-[17px] leading-6" style={{ fontWeight: 500 }}>
                    {WRITING.after.heading}
                  </p>
                  <ul className="mt-3 flex flex-col gap-2">
                    {WRITING.after.lines.map((l) => (
                      <li key={l} className="wr-after-line relative w-fit text-[15px] leading-[22px]">
                        <span aria-hidden className="wr-mark absolute inset-x-0 bottom-0.5 h-2 origin-left rounded-sm bg-[#551a89]/15" />
                        <span className="relative">{l}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        <ul className="grid border-t border-pp-rule sm:grid-cols-2 lg:border-t-0">
          {WRITING.tips.map((t) => (
            <li key={t.id} className="border-b border-pp-rule px-6 py-7 sm:odd:border-r md:px-10 sm:[&:nth-last-child(-n+2)]:border-b-0">
              <h3 className="text-[15px] leading-[22px]">{t.title}</h3>
              <p className="text-[15px] leading-[22px] text-pp-muted">{t.body}</p>
            </li>
          ))}
        </ul>
      </Frame>
      <Rule />
    </>
  );
}
