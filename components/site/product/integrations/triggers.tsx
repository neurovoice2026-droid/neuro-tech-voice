"use client";

import { useRef } from "react";
import { INT_TRIGGERS, type TriggerId } from "@/lib/pages/integrations";
import { INK, LINE, MUTED, Node, Ping, ping, svgProps, trace, useLoop, VIOLET, type Motion } from "../line-figure";
import { useMotionKit } from "../motion-kit";
import { Frame, SectionHeading } from "../primitives";
import { useInView, usePrefersReducedMotion } from "../timing";

/* ------------------------------------------------------------------ *
 * The four triggers, each drawn as the moment it fires on.
 *
 *   · Call ended — a conversation plays out as a wave and closes on a node.
 *   · Missed call — rings go out, the line reaches for the agent and breaks.
 *   · Negative sentiment — a reading slides along the scale into the red.
 *   · Keyword heard — a reading line passes a transcript and one word lights.
 * ------------------------------------------------------------------ */

const W = 280;
const H = 150;
const EMBER = "#e0663a";
const SMALL = "text-[12px] tracking-[0.01em]";

export function IntTriggers() {
  return (
    <>
      <Frame className="px-6 pb-10 md:px-12 md:pb-14">
        <SectionHeading eyebrow={INT_TRIGGERS.eyebrow} className="max-w-[720px]">
          {INT_TRIGGERS.title}
        </SectionHeading>
      </Frame>
      <Frame className="grid gap-4 px-4 sm:grid-cols-2 md:px-6 lg:grid-cols-4">
        {INT_TRIGGERS.items.map((t) => (
          <Card key={t.id} id={t.id} title={t.title} body={t.body} example={t.example} />
        ))}
      </Frame>
    </>
  );
}

function Card({ id, title, body, example }: { id: TriggerId; title: string; body: string; example: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, "-10% 0px");
  const near = useInView(ref, "25% 0px");
  const reduce = usePrefersReducedMotion();
  const kit = useMotionKit(near && !reduce);
  const motion = { kit, play: inView && !reduce, still: reduce };

  return (
    <div ref={ref} className="flex flex-col overflow-hidden rounded-[24px] bg-pp-card">
      <div className="aspect-[280/150] w-full px-2 pt-3">
        {id === "ended" && <Ended {...motion} />}
        {id === "missed" && <Missed {...motion} />}
        {id === "negative" && <Negative {...motion} />}
        {id === "keyword" && <Keyword {...motion} />}
      </div>
      <div className="flex flex-1 flex-col px-6 pt-4 pb-6">
        <h3 className="text-base leading-6">{title}</h3>
        <p className="mt-1 text-[14px] leading-[21px] text-pp-muted">{body}</p>
        <p className="mt-auto pt-4">
          <span className="inline-block rounded-full bg-white px-2.5 py-1 text-[12px] leading-4 shadow-[0_0_0_1px_rgb(24_16_40/0.06)]">
            {example}
          </span>
        </p>
      </div>
    </div>
  );
}

/* ─── Call ended ─────────────────────────────────────────────────── */

const CALL = trace(24, 196, (x) => {
  const u = (x - 24) / 172;
  return 75 - 26 * Math.pow(Math.sin(Math.PI * u), 1.4) * Math.sin(u * Math.PI * 13) * (1 - u * 0.6);
});

function Ended(motion: Motion) {
  const svg = useRef<SVGSVGElement>(null);
  useLoop(
    svg,
    (tl, q) => {
      tl.set(q(".en-wave"), { drawSVG: "0% 0%" }, 0)
        .set(q(".en-tail"), { drawSVG: "0% 0%" }, 0)
        .set(q(".en-core"), { attr: { fill: "var(--pp-card)" } }, 0)
        .set(q(".en-label"), { opacity: 0 }, 0)
        .to(q(".en-wave"), { drawSVG: "0% 100%", duration: 1.8, ease: "none" }, 0.2)
        .to(q(".en-tail"), { drawSVG: "0% 100%", duration: 0.35, ease: "power2.out" }, 2)
        .set(q(".en-core"), { attr: { fill: INK } }, 2.35);
      ping(tl, q(".en-ping"), 2.35, 20);
      tl.to(q(".en-label"), { opacity: 1, duration: 0.3 }, 2.4)
        .to([q(".en-wave")[0], q(".en-tail")[0]], { opacity: 0.25, duration: 0.6 }, 3.6)
        .to({}, { duration: 0.8 })
        .set([q(".en-wave")[0], q(".en-tail")[0]], { opacity: 1 });
    },
    motion,
  );
  return (
    <svg ref={svg} {...svgProps(W, H)}>
      <path d={CALL} stroke={INK} strokeOpacity="0.1" strokeWidth={LINE} strokeLinecap="round" />
      <path className="en-wave" d={CALL} stroke={INK} strokeWidth={LINE} strokeLinecap="round" />
      <line className="en-tail" x1="196" x2="226" y1="75" y2="75" stroke={INK} strokeWidth={LINE} strokeLinecap="round" />
      <Ping className="en-ping" x={236} y={75} />
      <Node x={236} y={75} coreClassName="en-core" />
      <text className={`en-label ${SMALL}`} x="236" y="108" textAnchor="middle" fill={MUTED}>
        {INT_TRIGGERS.figure.ended}
      </text>
    </svg>
  );
}

/* ─── Missed call ────────────────────────────────────────────────── */

function Missed(motion: Motion) {
  const svg = useRef<SVGSVGElement>(null);
  useLoop(
    svg,
    (tl, q) => {
      tl.set(q(".ms-reach"), { attr: { x2: 92 } }, 0).set(q(".ms-break"), { opacity: 0, scale: 0.4, transformOrigin: "50% 50%" }, 0);
      [0.1, 0.7, 1.3].forEach((at) => ping(tl, q(".ms-ring"), at, 34));
      tl.to(q(".ms-reach"), { attr: { x2: 168 }, duration: 0.9, ease: "power2.out" }, 1.6)
        .to(q(".ms-break"), { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(2.4)" }, 2.45)
        .to(q(".ms-agent"), { opacity: 0.35, duration: 0.4 }, 2.5)
        .to({}, { duration: 1.6 })
        .to(q(".ms-break"), { opacity: 0, duration: 0.3 })
        .to(q(".ms-agent"), { opacity: 1, duration: 0.3 }, "<");
    },
    motion,
  );
  return (
    <svg ref={svg} {...svgProps(W, H)}>
      <line x1="92" x2="212" y1="75" y2="75" stroke={INK} strokeOpacity="0.2" strokeWidth={LINE} strokeDasharray="0.01 4.6" strokeLinecap="round" />
      <line className="ms-reach" x1="92" x2="168" y1="75" y2="75" stroke={INK} strokeWidth={LINE} strokeLinecap="round" />
      <Ping className="ms-ring" x={78} y={75} />
      <Node x={78} y={75} r={6} />
      <text className={SMALL} x="78" y="112" textAnchor="middle" fill={MUTED}>
        {INT_TRIGGERS.figure.caller}
      </text>
      <g className="ms-break">
        <line x1="176" x2="186" y1="70" y2="80" stroke={EMBER} strokeWidth={LINE * 1.2} strokeLinecap="round" />
        <line x1="186" x2="176" y1="70" y2="80" stroke={EMBER} strokeWidth={LINE * 1.2} strokeLinecap="round" />
      </g>
      <g className="ms-agent">
        <Node x={222} y={75} hollow r={6} />
        <text className={SMALL} x="222" y="112" textAnchor="middle" fill={MUTED}>
          {INT_TRIGGERS.figure.agent}
        </text>
      </g>
    </svg>
  );
}

/* ─── Negative sentiment ─────────────────────────────────────────── */

function Negative(motion: Motion) {
  const svg = useRef<SVGSVGElement>(null);
  useLoop(
    svg,
    (tl, q) => {
      const marker = q(".ng-marker");
      tl.set(marker, { x: 0 }, 0)
        .set(q(".ng-zone"), { attr: { stroke: INK }, opacity: 0.25 }, 0)
        .set(q(".ng-label-neg"), { attr: { fill: MUTED } }, 0)
        .to(marker, { x: 60, duration: 0.8, ease: "sine.inOut" }, 0.2)
        .to(marker, { x: 40, duration: 0.5, ease: "sine.inOut" })
        .to(marker, { x: 150, duration: 1, ease: "power2.inOut" })
        .to(q(".ng-zone"), { attr: { stroke: EMBER }, opacity: 1, duration: 0.3 }, "<0.7")
        .to(q(".ng-label-neg"), { attr: { fill: EMBER }, duration: 0.3 }, "<");
      ping(tl, q(".ng-ping"), 2.6, 22);
      tl.to({}, { duration: 1.6 }).to(marker, { x: 0, duration: 0.8, ease: "power2.inOut" });
    },
    motion,
  );
  const y = 72;
  return (
    <svg ref={svg} {...svgProps(W, H)}>
      <line x1="40" x2="170" y1={y} y2={y} stroke={INK} strokeOpacity="0.25" strokeWidth={LINE * 2} strokeLinecap="round" />
      <line className="ng-zone" x1="176" x2="240" y1={y} y2={y} stroke={INK} strokeOpacity="1" opacity="0.25" strokeWidth={LINE * 2} strokeLinecap="round" />
      {[40, 105, 170, 240].map((x) => (
        <line key={x} x1={x} x2={x} y1={y - 6} y2={y + 6} stroke={INK} strokeOpacity="0.2" strokeWidth={LINE} />
      ))}
      <text className={SMALL} x="40" y={y + 34} fill={MUTED}>
        {INT_TRIGGERS.figure.positive}
      </text>
      <text className={SMALL} x="118" y={y + 34} textAnchor="middle" fill={MUTED}>
        {INT_TRIGGERS.figure.neutral}
      </text>
      <text className={`ng-label-neg ${SMALL}`} x="240" y={y + 34} textAnchor="end" fill={MUTED}>
        {INT_TRIGGERS.figure.negative}
      </text>
      <g className="ng-marker">
        <Ping className="ng-ping" x={60} y={y} color={EMBER} />
        <Node x={60} y={y} r={5} color={VIOLET} />
      </g>
    </svg>
  );
}

/* ─── Keyword heard ──────────────────────────────────────────────── */

const LINES = [
  { y: 48, w: 176 },
  { y: 72, w: 150, word: { x: 112, w: 58 } },
  { y: 96, w: 190 },
];

function Keyword(motion: Motion) {
  const svg = useRef<SVGSVGElement>(null);
  useLoop(
    svg,
    (tl, q) => {
      tl.set(q(".kw-scan"), { attr: { x1: 40, x2: 40 }, opacity: 0 }, 0)
        .set(q(".kw-word"), { attr: { fill: INK }, fillOpacity: 0.12 }, 0)
        .set(q(".kw-chip"), { opacity: 0, y: 6 }, 0)
        .to(q(".kw-scan"), { opacity: 1, duration: 0.2 }, 0.2)
        .to(q(".kw-scan"), { attr: { x1: 240, x2: 240 }, duration: 1.8, ease: "none" }, 0.2)
        .to(q(".kw-word"), { attr: { fill: VIOLET }, fillOpacity: 0.6, duration: 0.25 }, 0.2 + ((112 - 40) / 200) * 1.8)
        .to(q(".kw-chip"), { opacity: 1, y: 0, duration: 0.4, ease: "back.out(2)" }, 1.4)
        .to(q(".kw-scan"), { opacity: 0, duration: 0.2 }, 2)
        .to({}, { duration: 1.6 });
    },
    motion,
  );
  return (
    <svg ref={svg} {...svgProps(W, H)}>
      {LINES.map((l) => (
        <g key={l.y}>
          <rect x="40" y={l.y - 4} width={l.w} height="8" rx="4" fill={INK} fillOpacity="0.08" />
          {l.word && <rect className="kw-word" x={l.word.x} y={l.y - 5} width={l.word.w} height="10" rx="5" fill={VIOLET} fillOpacity="0.6" />}
        </g>
      ))}
      <line className="kw-scan" x1="40" x2="40" y1="34" y2="110" stroke={VIOLET} strokeWidth={LINE} opacity="0" />
      <g className="kw-chip">
        <rect x="150" y="116" width="92" height="22" rx="11" fill={VIOLET} />
        <text className={SMALL} x="196" y="131" textAnchor="middle" fill="#fff">
          {INT_TRIGGERS.figure.word}
        </text>
      </g>
    </svg>
  );
}
