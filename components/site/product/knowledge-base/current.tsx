"use client";

import { useRef } from "react";
import { CURRENT } from "@/lib/pages/knowledge-base";
import { INK, LINE, MUTED, Node, Ping, ping, svgProps, useLoop, VIOLET, type Motion } from "../line-figure";
import { useMotionKit } from "../motion-kit";
import { Frame, Rule, SectionHeading } from "../primitives";
import { useInView, usePrefersReducedMotion } from "../timing";

/* ------------------------------------------------------------------ *
 * A week of the same question.
 *
 * Along a working week, callers keep asking what an hour costs. A
 * playhead walks the days; each call it passes rings and leaves the
 * answer it got hanging above it. On Wednesday the price list is
 * replaced — the old sheet greys out with its price struck through, the
 * new one drops into place — and every call after the swap answers with
 * the new price.
 * ------------------------------------------------------------------ */

const W = 600;
const H = 300;
const AXIS = 214;
const SWAP = 300;
const X0 = 40;
const X1 = 560;
const DAYS = [72, 186, 300, 414, 528];
const CALLS = [92, 152, 212, 268, 340, 400, 468, 532];
/**
 * Label sizes, in the drawing's own units. On a phone the drawing is shown
 * at about half size, so its labels are drawn larger there to stay legible.
 */
const TEXT = "text-[16px] tracking-[0.01em] max-sm:text-[22px]";
const SMALL = "text-[13px] tracking-[0.01em] max-sm:text-[18px]";

export function KbCurrent() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, "-10% 0px");
  const near = useInView(ref, "25% 0px");
  const reduce = usePrefersReducedMotion();
  const kit = useMotionKit(near && !reduce);

  return (
    <>
      <Frame className="grid gap-10 px-6 md:px-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,600px)] lg:items-center lg:gap-16">
        <div>
          <SectionHeading eyebrow={CURRENT.eyebrow} className="max-w-[520px]">
            {CURRENT.title}
          </SectionHeading>
          <ul className="mt-8 flex max-w-[480px] flex-col">
            {CURRENT.points.map((p, i) => (
              <li key={p} className="flex gap-4 border-t border-pp-rule py-4 text-[15px] leading-[22px] last:border-b">
                <span className="w-5 shrink-0 text-pp-muted tabular-nums">{i + 1}</span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div ref={ref} className="aspect-[600/300] w-full">
          <Week kit={kit} play={inView && !reduce} still={reduce} />
        </div>
      </Frame>
      <Rule className="mt-16 md:mt-24" />
    </>
  );
}

function Week({ kit, play, still }: Motion) {
  const svg = useRef<SVGSVGElement>(null);
  const f = CURRENT.figure;

  useLoop(
    svg,
    (tl, q) => {
      const head = q(".wk-head");
      const tags = q(".wk-tag");
      const oldSheet = q(".wk-old");
      const newSheet = q(".wk-new");
      const strike = q(".wk-strike")[0];
      const swapLine = q(".wk-swap")[0];
      const RUN = 6;
      const at = (x: number) => ((x - X0) / (X1 - X0)) * RUN + 0.3;

      tl.set(head, { attr: { x1: X0, x2: X0 }, opacity: 0 }, 0)
        .set(tags, { opacity: 0, y: 6 }, 0)
        .set(oldSheet, { opacity: 1 }, 0)
        .set(newSheet, { opacity: 0, y: -12 }, 0)
        .set(strike, { drawSVG: "0% 0%" }, 0)
        .set(swapLine, { attr: { y1: AXIS } }, 0)
        .set(q(".wk-swap-label"), { opacity: 0 }, 0)
        .to(head, { opacity: 1, duration: 0.3 }, 0.1)
        .to(head, { attr: { x1: X1, x2: X1 }, duration: RUN, ease: "none" }, 0.3);

      CALLS.forEach((x, i) => {
        ping(tl, q(`.wk-ping-${i}`), at(x), 18);
        tl.to(tags[i], { opacity: 1, y: 0, duration: 0.45, ease: "back.out(2)" }, at(x) + 0.05);
      });

      const swap = at(SWAP);
      // Dotted, so it grows by its end point rather than by DrawSVG, which would solidify it.
      tl.to(swapLine, { attr: { y1: 52 }, duration: 0.5, ease: "power2.out" }, swap - 0.2)
        .to(q(".wk-swap-label"), { opacity: 1, duration: 0.4 }, swap - 0.1)
        .to(strike, { drawSVG: "0% 100%", duration: 0.35, ease: "power2.out" }, swap)
        .to(oldSheet, { opacity: 0.4, duration: 0.5 }, swap + 0.2)
        .to(newSheet, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }, swap + 0.15)
        .to(head, { opacity: 0, duration: 0.3 }, 0.3 + RUN)
        .to([...tags, ...newSheet, q(".wk-swap-label")[0]], { opacity: 0, duration: 0.6 }, RUN + 2.4)
        .to(swapLine, { attr: { y1: AXIS }, duration: 0.5 }, RUN + 2.4)
        .to(strike, { drawSVG: "100% 100%", duration: 0.4 }, RUN + 2.4)
        .to(oldSheet, { opacity: 1, duration: 0.6 }, RUN + 2.6)
        .to({}, { duration: 0.3 });
    },
    { kit, play, still },
  );

  return (
    <svg ref={svg} {...svgProps(W, H)}>
      <text x={X0} y="22" fill={MUTED} className={SMALL}>
        {f.asked}
      </text>

      {/* The two sheets */}
      <g className="wk-old">
        <rect x="60" y="60" width="200" height="70" rx="10" fill="var(--pp-bg)" stroke={INK} strokeOpacity="0.2" strokeWidth={LINE} />
        <text x="76" y="88" fill={INK} className={SMALL}>
          {f.old.name} · {f.old.version}
        </text>
        <text x="76" y="116" fill={INK} className={TEXT}>
          {f.old.price}
        </text>
        <line className="wk-strike" x1="74" x2="118" y1="110" y2="110" stroke="#e0663a" strokeWidth={LINE * 1.2} strokeLinecap="round" />
      </g>
      <g className="wk-new">
        <rect x="350" y="60" width="200" height="70" rx="10" fill="var(--pp-bg)" stroke={VIOLET} strokeWidth={LINE} />
        <text x="366" y="88" fill={VIOLET} className={SMALL}>
          {f.next.name} · {f.next.version}
        </text>
        <text x="366" y="116" fill={INK} className={TEXT}>
          {f.next.price}
        </text>
      </g>

      {/* The swap */}
      <line className="wk-swap" x1={SWAP} x2={SWAP} y1="52" y2={AXIS} stroke={VIOLET} strokeWidth={LINE} strokeDasharray="0.01 4.6" strokeLinecap="round" />
      <text className={`wk-swap-label ${SMALL}`} x={SWAP + 10} y="44" fill={VIOLET}>
        {f.swap}
      </text>

      {/* The week */}
      <line x1={X0} x2={X1} y1={AXIS} y2={AXIS} stroke={INK} strokeOpacity="0.3" strokeWidth={LINE} strokeDasharray="0.01 4.6" strokeLinecap="round" />
      {DAYS.map((x, i) => (
        <text key={x} x={x} y={AXIS + 42} textAnchor="middle" fill={MUTED} className={SMALL}>
          {f.days[i]}
        </text>
      ))}
      {CALLS.map((x, i) => {
        const after = x > SWAP;
        return (
          <g key={x}>
            <g className="wk-tag">
              <rect x={x - 25} y={AXIS - 50} width="50" height="30" rx="15" fill={after ? VIOLET : "var(--pp-card)"} />
              <text x={x} y={AXIS - 29.5} textAnchor="middle" fill={after ? "#fff" : INK} className={SMALL}>
                {after ? f.next.price : f.old.price}
              </text>
            </g>
            <Ping className={`wk-ping-${i}`} x={x} y={AXIS} color={after ? VIOLET : INK} />
            <Node x={x} y={AXIS} r={3.6} color={after ? VIOLET : INK} />
          </g>
        );
      })}
      <line className="wk-head" x1={X0} x2={X0} y1={AXIS - 60} y2={AXIS + 14} stroke={VIOLET} strokeWidth={LINE} opacity="0" />
    </svg>
  );
}
