"use client";

import { useRef } from "react";
import { INT_IDEA } from "@/lib/pages/integrations";
import { INK, LINE, MUTED, Node, Ping, ping, svgProps, trace, useLoop, VIOLET, type Motion } from "../line-figure";
import { useMotionKit } from "../motion-kit";
import { Frame, Rule, SectionHeading } from "../primitives";
import { useInView, usePrefersReducedMotion } from "../timing";

/* ------------------------------------------------------------------ *
 * The idea, as one run at a time.
 *
 * A call plays out as a wave and ends. Its record forms, and forks
 * towards four gates — ended, missed, unhappy, keyword. Each pass of the
 * loop takes a different gate: the record travels to it, it lights while
 * the others dim, and the run continues along one line through the steps
 * that rule has — one step or two — each ringing and ticking off, until
 * the run is logged. Then the next call.
 * ------------------------------------------------------------------ */

/**
 * Label sizes, in the drawing's own units. On a phone the drawing is shown
 * at about half size, so its labels are drawn larger there to stay legible.
 */
const LABEL = "text-[14px] tracking-[0.01em] max-sm:text-[20px]";

const W = 600;
const H = 300;
const MID = 150;
const END = { x: 140, y: MID };
const RECORD = { x: 204, y: MID };
const GATE_X = 306;
const GATES = [60, 120, 180, 240];
const JOIN = { x: 380, y: MID };
const STEPS = [436, 496, 556];
/** How many steps each gate's rule has, in GATES order. */
const USES = [1, 1, 2, 2];

const WAVE = trace(20, END.x - 10, (x) => {
  const u = (x - 20) / (END.x - 30);
  return MID - 24 * Math.sin(Math.PI * u) * Math.sin(u * Math.PI * 9);
});
const fork = (y: number) =>
  `M${RECORD.x + 12} ${MID} C${RECORD.x + 60} ${MID} ${GATE_X - 50} ${y} ${GATE_X} ${y}`;
const merge = (y: number) => `M${GATE_X} ${y} C${GATE_X + 44} ${y} ${JOIN.x - 40} ${MID} ${JOIN.x} ${MID}`;

export function IntIdea() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, "-10% 0px");
  const near = useInView(ref, "25% 0px");
  const reduce = usePrefersReducedMotion();
  const kit = useMotionKit(near && !reduce);

  return (
    <>
      <Frame className="grid gap-10 px-6 pb-12 md:px-12 md:pb-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,600px)] lg:items-center lg:gap-16">
        <div>
          <SectionHeading eyebrow={INT_IDEA.eyebrow} className="max-w-[560px]">
            {INT_IDEA.title}
          </SectionHeading>
          <div className="mt-6 flex max-w-[520px] flex-col gap-4 text-[16px] leading-[25px] text-pp-ink/80">
            {INT_IDEA.body.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </div>
        <div ref={ref} className="aspect-[600/300] w-full">
          <Runs kit={kit} play={inView && !reduce} still={reduce} />
        </div>
      </Frame>
      <Rule />
      <Frame className="grid divide-y divide-pp-rule md:grid-cols-3 md:divide-x md:divide-y-0">
        {INT_IDEA.facts.map((f) => (
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

function Runs({ kit, play, still }: Motion) {
  const svg = useRef<SVGSVGElement>(null);
  const f = INT_IDEA.figure;

  useLoop(
    svg,
    (tl, q) => {
      const pulse = q(".rn-pulse");
      const wave = q(".rn-wave")[0] as SVGPathElement;
      const forks = q(".rn-fork") as SVGPathElement[];
      const merges = q(".rn-merge") as SVGPathElement[];
      const gates = q(".rn-gate");
      const gateLabels = q(".rn-gate-label");
      const steps = q(".rn-step");
      const ticks = q(".rn-tick");
      const logged = q(".rn-logged");
      const PASS = 5;

      tl.set(pulse, { opacity: 0 }, 0)
        .set(ticks, { drawSVG: "0% 0%" }, 0)
        .set(logged, { opacity: 0 }, 0);

      GATES.forEach((_, k) => {
        const t = k * PASS;
        const used = USES[k];
        tl.set(pulse, { x: 20, y: MID, opacity: 0 }, t)
          .set([...gates, ...gateLabels], { opacity: 1 }, t)
          .set(q(".rn-gate-core"), { attr: { fill: "var(--pp-bg)" } }, t)
          .set(steps, { opacity: 1 }, t)
          .set(ticks, { drawSVG: "0% 0%" }, t)
          .set(logged, { opacity: 0 }, t)
          .to(pulse, { opacity: 1, duration: 0.2 }, t + 0.1)
          .to(pulse, { duration: 1, ease: "sine.inOut", motionPath: { path: wave } }, t + 0.1);
        ping(tl, q(".rn-end-ping"), t + 1.1, 20);
        tl.to(pulse, { x: RECORD.x, y: MID, duration: 0.35, ease: "power2.inOut" }, t + 1.15)
          .fromTo(q(".rn-record"), { y: 0 }, { y: -4, duration: 0.2, yoyo: true, repeat: 1 }, t + 1.45)
          .to(pulse, { duration: 0.6, ease: "power2.inOut", motionPath: { path: forks[k] } }, t + 1.6);
        // The gate this call matches lights; the others step back.
        tl.to(gates.filter((_, i) => i !== k), { opacity: 0.3, duration: 0.3 }, t + 2.1)
          .to(gateLabels.filter((_, i) => i !== k), { opacity: 0.35, duration: 0.3 }, t + 2.1)
          .set(q(".rn-gate-core")[k], { attr: { fill: VIOLET } }, t + 2.2)
          .to(steps.filter((_, i) => i >= used), { opacity: 0.25, duration: 0.3 }, t + 2.2);
        ping(tl, [q(".rn-gate-ping")[k]], t + 2.2, 20);
        tl.to(pulse, { duration: 0.5, ease: "power2.inOut", motionPath: { path: merges[k] } }, t + 2.25);
        for (let s = 0; s < used; s++) {
          const at = t + 2.75 + s * 0.55;
          tl.to(pulse, { x: STEPS[s], y: MID, duration: 0.4, ease: "power2.inOut" }, at);
          ping(tl, [q(".rn-step-ping")[s]], at + 0.4, 18);
          tl.to(ticks[s], { drawSVG: "0% 100%", duration: 0.3, ease: "power2.out" }, at + 0.4);
        }
        const doneAt = t + 2.75 + used * 0.55 + 0.1;
        tl.to(pulse, { opacity: 0, duration: 0.25 }, doneAt).to(logged, { opacity: 1, duration: 0.4 }, doneAt);
      });
      tl.to({}, { duration: 0.2 });
    },
    { kit, play, still },
  );

  return (
    <svg ref={svg} {...svgProps(W, H)} overflow="visible">
      {/* The call, and where it ends */}
      <path d={WAVE} stroke={INK} strokeOpacity="0.2" strokeWidth={LINE} strokeLinecap="round" />
      <path className="rn-wave" d={WAVE} stroke="none" />
      <Ping className="rn-end-ping" x={END.x} y={END.y} />
      <Node x={END.x} y={END.y} />
      {/* Above its node, so it never meets the record's label below. */}
      <text x={END.x} y={END.y - 26} textAnchor="middle" fill={MUTED} className={LABEL}>
        {f.call}
      </text>

      {/* Its record */}
      <g className="rn-record">
        <rect x={RECORD.x - 9} y={MID - 12} width="18" height="24" rx="3" fill="var(--pp-bg)" stroke={INK} strokeWidth={LINE} />
        <line x1={RECORD.x - 4} x2={RECORD.x + 4} y1={MID - 4} y2={MID - 4} stroke={INK} strokeWidth="1.2" />
        <line x1={RECORD.x - 4} x2={RECORD.x + 2} y1={MID + 1} y2={MID + 1} stroke={INK} strokeWidth="1.2" />
        <line x1={RECORD.x - 4} x2={RECORD.x + 4} y1={MID + 6} y2={MID + 6} stroke={INK} strokeWidth="1.2" />
      </g>
      <text x={RECORD.x} y={MID + 36} textAnchor="middle" fill={MUTED} className={LABEL}>
        {f.record}
      </text>

      {/* Four gates */}
      {GATES.map((y, i) => (
        <g key={y}>
          <path className="rn-fork" d={fork(y)} stroke={INK} strokeOpacity="0.28" strokeWidth={LINE} strokeDasharray="0.01 4.6" strokeLinecap="round" />
          <path className="rn-merge" d={merge(y)} stroke={INK} strokeOpacity="0.28" strokeWidth={LINE} strokeDasharray="0.01 4.6" strokeLinecap="round" />
          <g className="rn-gate">
            <Ping className="rn-gate-ping" x={GATE_X} y={y} color={VIOLET} />
            <Node x={GATE_X} y={y} hollow r={4} color={VIOLET} coreClassName="rn-gate-core" />
          </g>
          {/* A halo of page stock, so the dotted routes pass behind the words. */}
          <text
            className={`rn-gate-label ${LABEL}`}
            x={GATE_X}
            y={y - 14}
            textAnchor="middle"
            fill={INK}
            stroke="var(--pp-bg)"
            strokeWidth={6}
            strokeLinejoin="round"
            paintOrder="stroke"
          >
            {f.triggers[i]}
          </text>
        </g>
      ))}

      {/* One line through the rule's steps */}
      <line x1={JOIN.x} x2={STEPS[STEPS.length - 1]} y1={MID} y2={MID} stroke={INK} strokeOpacity="0.3" strokeWidth={LINE} strokeLinecap="round" />
      <circle cx={JOIN.x} cy={MID} r="2.5" fill={INK} />
      {STEPS.map((x, i) => (
        <g key={x}>
          <g className="rn-step">
            <Ping className="rn-step-ping" x={x} y={MID} />
            <Node x={x} y={MID} r={5} />
            <text x={x} y={MID + 30} textAnchor="middle" fill={MUTED} className={LABEL}>
              {f.steps[i]}
            </text>
          </g>
          <path
            className="rn-tick"
            d={`M${x - 6} ${MID - 20} L${x - 1.5} ${MID - 15} L${x + 7} ${MID - 25}`}
            stroke="#1f8a55"
            strokeWidth={LINE * 1.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      ))}
      <text x={STEPS[1]} y={MID + 58} textAnchor="middle" fill={MUTED} className={LABEL}>
        {f.stepsCaption}
      </text>
      <text className={`rn-logged ${LABEL}`} x={STEPS[STEPS.length - 1]} y={MID - 44} textAnchor="end" fill="#1f6b3f">
        {f.logged}
      </text>

      <Node className="rn-pulse" hidden r={4} color={VIOLET} />
    </svg>
  );
}
