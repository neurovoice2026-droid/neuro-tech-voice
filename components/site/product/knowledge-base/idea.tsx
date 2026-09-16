"use client";

import { useRef } from "react";
import { IDEA } from "@/lib/pages/knowledge-base";
import {
  dotted,
  Fade,
  INK,
  LINE,
  MUTED,
  Node,
  Ping,
  ping,
  svgProps,
  trace,
  useLoop,
  useSvgId,
  VIOLET,
  type Motion,
} from "../line-figure";
import { useMotionKit } from "../motion-kit";
import { Frame, Rule, SectionHeading } from "../primitives";
import { useInView, usePrefersReducedMotion } from "../timing";

/* ------------------------------------------------------------------ *
 * The idea, in two streams.
 *
 * Instructions come in along the top — greeting, manner, what to book —
 * as hollow ink pulses; the documents come in along the bottom as violet
 * ones. Neither alone reaches the answer: only when both have arrived at
 * the agent does the answer line draw out, spoken as a wave.
 * ------------------------------------------------------------------ */

/**
 * Label sizes, in the drawing's own units. On a phone the drawing is shown
 * at about half size, so its labels are drawn larger there to stay legible.
 */
const LABEL = "text-[14px] tracking-[0.01em] max-sm:text-[19px]";

const W = 560;
const H = 360;
const AGENT = { x: 350, y: 180 };
const ANSWER = { x: 508, y: 180 };
/** Where each stream's three lanes start. */
const TOPS = [66, 108, 150].map((y) => ({ x: 132, y }));
const BOTTOM = [214, 256, 298].map((y) => ({ x: 132, y }));

function lane(from: { x: number; y: number }) {
  return `M${from.x} ${from.y} C${from.x + 110} ${from.y} ${AGENT.x - 120} ${AGENT.y} ${AGENT.x} ${AGENT.y}`;
}

const SPOKEN = trace(AGENT.x + 16, ANSWER.x - 14, (x) => {
  const u = (x - AGENT.x - 16) / (ANSWER.x - AGENT.x - 30);
  return AGENT.y - 16 * Math.sin(Math.PI * u) * Math.sin(u * Math.PI * 7);
});

export function KbIdea() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, "-10% 0px");
  const near = useInView(ref, "25% 0px");
  const reduce = usePrefersReducedMotion();
  const kit = useMotionKit(near && !reduce);

  return (
    <>
      <Frame className="grid gap-10 px-6 pb-12 md:px-12 md:pb-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)] lg:items-center lg:gap-16">
        <div>
          <SectionHeading eyebrow={IDEA.eyebrow} className="max-w-[560px]">
            {IDEA.title}
          </SectionHeading>
          <div className="mt-6 flex max-w-[520px] flex-col gap-4 text-[16px] leading-[25px] text-pp-ink/80">
            {IDEA.body.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </div>
        <div ref={ref} className="aspect-[560/360] w-full">
          <Streams kit={kit} play={inView && !reduce} still={reduce} />
        </div>
      </Frame>
      <Rule />
      <Frame className="grid divide-y divide-pp-rule md:grid-cols-3 md:divide-x md:divide-y-0">
        {IDEA.facts.map((f) => (
          <div key={f.id} className="px-6 py-8 md:px-12 md:py-10">
            <h3 className="text-[15px] leading-[22px]">{f.title}</h3>
            <p className="text-[15px] leading-[22px] text-pp-muted">{f.body}</p>
          </div>
        ))}
      </Frame>
      <Rule />
    </>
  );
}

function Streams({ kit, play, still }: Motion) {
  const svg = useRef<SVGSVGElement>(null);
  const fadeInk = useSvgId("idea-ink");
  const fadeViolet = useSvgId("idea-violet");
  const f = IDEA.figure;

  useLoop(
    svg,
    (tl, q) => {
      const inst = q(".idea-inst");
      const docs = q(".idea-doc");
      const instLanes = q(".idea-inst-lane") as SVGPathElement[];
      const docLanes = q(".idea-doc-lane") as SVGPathElement[];
      const spoken = q(".idea-spoken")[0];
      const sheets = q(".idea-sheet");

      tl.set([...inst, ...docs], { opacity: 0 }, 0)
        .set(spoken, { drawSVG: "0% 0%" }, 0)
        .set(q(".idea-answer-core"), { attr: { fill: "var(--pp-bg)" } }, 0)
        .set(q(".idea-agent-label"), { opacity: 0.55 }, 0);

      // Instructions arrive first, one after another…
      inst.forEach((p, i) => {
        const at = 0.2 + i * 0.28;
        tl.to(p, { opacity: 1, duration: 0.2 }, at).to(
          p,
          { duration: 1.3, ease: "power2.inOut", motionPath: { path: instLanes[i], align: instLanes[i], alignOrigin: [0.5, 0.5] } },
          at,
        );
        tl.to(p, { opacity: 0, duration: 0.2 }, at + 1.25);
      });

      // …then the documents: each sheet lifts as its facts set off.
      docs.forEach((p, i) => {
        const at = 1.1 + i * 0.28;
        tl.fromTo(sheets[i], { y: 0 }, { y: -4, duration: 0.25, yoyo: true, repeat: 1, ease: "power1.out" }, at - 0.1)
          .to(p, { opacity: 1, duration: 0.2 }, at)
          .to(p, { duration: 1.3, ease: "power2.inOut", motionPath: { path: docLanes[i], align: docLanes[i], alignOrigin: [0.5, 0.5] } }, at)
          .to(p, { opacity: 0, duration: 0.2 }, at + 1.25);
      });

      const met = 1.1 + 2 * 0.28 + 1.3;
      ping(tl, q(".idea-agent-ping"), met, 30);
      tl.to(q(".idea-agent-label"), { opacity: 1, duration: 0.3 }, met)
        .to(spoken, { drawSVG: "0% 100%", duration: 1.2, ease: "power2.out" }, met + 0.15)
        .set(q(".idea-answer-core"), { attr: { fill: INK } }, met + 1.3);
      ping(tl, q(".idea-answer-ping"), met + 1.3);
      tl.to(spoken, { drawSVG: "100% 100%", duration: 0.8, ease: "power2.inOut" }, met + 2.6).to({}, { duration: 0.6 });
    },
    { kit, play, still },
  );

  return (
    // Labels may run into the column's padding on a phone, where they are drawn larger.
    <svg ref={svg} {...svgProps(W, H)} overflow="visible">
      <defs>
        <Fade id={fadeInk} from={132} run={80} />
        <Fade id={fadeViolet} from={132} run={80} color={VIOLET} />
      </defs>

      {/* Instructions */}
      <text x="118" y="34" textAnchor="end" fill={MUTED} className={LABEL}>
        {f.instructions}
      </text>
      {TOPS.map((p, i) => (
        <g key={`i-${i}`}>
          <text x="118" y={p.y + 5} textAnchor="end" fill={INK} className={LABEL}>
            {f.left[i]}
          </text>
          <path
            className="idea-inst-lane"
            d={lane(p)}
            stroke={`url(#${fadeInk})`}
            strokeOpacity="0.5"
            strokeWidth={LINE}
            strokeDasharray={dotted.strokeDasharray}
            strokeLinecap="round"
          />
          <Node x={p.x} y={p.y} hollow r={3.6} />
        </g>
      ))}

      {/* Documents */}
      <text x="20" y={H - 14} fill={VIOLET} className={LABEL}>
        {f.knowledge}
      </text>
      {BOTTOM.map((p, i) => (
        <g key={`d-${i}`}>
          <g className="idea-sheet">
            <rect x="20" y={p.y - 13} width="20" height="26" rx="3" fill="var(--pp-bg)" stroke={VIOLET} strokeWidth={LINE} />
            <line x1="25" x2="35" y1={p.y - 5} y2={p.y - 5} stroke={VIOLET} strokeWidth="1.2" />
            <line x1="25" x2="33" y1={p.y} y2={p.y} stroke={VIOLET} strokeWidth="1.2" />
            <line x1="25" x2="35" y1={p.y + 5} y2={p.y + 5} stroke={VIOLET} strokeWidth="1.2" />
          </g>
          <text x="50" y={p.y + 5} fill={INK} className={LABEL}>
            {f.right[i]}
          </text>
          <path className="idea-doc-lane" d={lane(p)} stroke={`url(#${fadeViolet})`} strokeWidth={LINE} strokeLinecap="round" strokeOpacity="0.8" />
          <Node x={p.x} y={p.y} r={3.6} color={VIOLET} />
        </g>
      ))}

      {/* Travellers */}
      {TOPS.map((_, i) => (
        <Node key={`it-${i}`} className="idea-inst" hollow hidden r={3.4} />
      ))}
      {BOTTOM.map((_, i) => (
        <Node key={`dt-${i}`} className="idea-doc" hidden r={3.4} color={VIOLET} />
      ))}

      {/* The agent, and what it says */}
      <path d={SPOKEN} stroke={INK} strokeOpacity="0.14" strokeWidth={LINE} strokeLinecap="round" />
      <path className="idea-spoken" d={SPOKEN} stroke={INK} strokeWidth={LINE} strokeLinecap="round" />
      <Ping className="idea-agent-ping" x={AGENT.x} y={AGENT.y} />
      <Node x={AGENT.x} y={AGENT.y} r={7} />
      <text className={`idea-agent-label ${LABEL}`} x={AGENT.x} y={AGENT.y + 36} textAnchor="middle" fill={INK}>
        {f.agent}
      </text>
      <Ping className="idea-answer-ping" x={ANSWER.x} y={ANSWER.y} />
      <Node x={ANSWER.x} y={ANSWER.y} hollow={still ? false : true} coreClassName="idea-answer-core" />
      <text x={ANSWER.x} y={ANSWER.y - 26} textAnchor="middle" fill={INK} className={LABEL}>
        {f.answer}
      </text>
    </svg>
  );
}
