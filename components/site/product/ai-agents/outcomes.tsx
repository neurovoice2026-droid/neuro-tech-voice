"use client";

import { useRef } from "react";
import { OUTCOMES } from "@/lib/pages/ai-agents";
import {
  BG,
  dotted,
  Fade,
  INK,
  label,
  LINE,
  MUTED,
  Node,
  Ping,
  ping,
  svgProps as figureSvg,
  trace,
  useLoop,
  useSvgId,
  DOTS,
  type Motion,
} from "../line-figure";
import { useMotionKit } from "../motion-kit";
import { Frame, Rule, SectionHeading } from "../primitives";
import { useInView, usePrefersReducedMotion } from "../timing";

/* ------------------------------------------------------------------ *
 * Three outcomes, each drawn as a small line figure and set moving.
 *
 * Hairlines, dotted secondary strokes, lines that fade in from nothing
 * and stop short of the nodes they meet, a word or two in grey and black.
 * Each figure argues its column:
 *
 *   · Ringing → Answered: a ring oscillating up to the first-ring line,
 *     then settling flat.
 *   · Enquiries → Qualified: five lines narrowing through three questions;
 *     four stop at a question, one goes through.
 *   · Interruptions → Day back: a working day with calls standing up out
 *     of it, folded back down one by one as the agent passes.
 *
 * GSAP owns the motion: DrawSVG for strokes, MotionPath for the nodes that
 * travel. Each figure plays only while on screen, and rests complete and
 * still when reduced motion is on.
 * ------------------------------------------------------------------ */

type Item = (typeof OUTCOMES.items)[number];

const svgProps = figureSvg(540, 320);

export function AgentsOutcomes() {
  return (
    <>
      <Frame className="px-6 pb-12 md:px-12 md:pb-20">
        <SectionHeading eyebrow={OUTCOMES.eyebrow} className="max-w-[720px]">
          {OUTCOMES.title}
        </SectionHeading>
      </Frame>
      <Rule />
      <Frame className="grid divide-y divide-pp-rule lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        {OUTCOMES.items.map((item) => (
          <Column key={item.id} item={item} />
        ))}
      </Frame>
      <Rule />
    </>
  );
}

function Column({ item }: { item: Item }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, "-10% 0px");
  const near = useInView(ref, "25% 0px");
  const reduce = usePrefersReducedMotion();
  // Reduced motion needs no GSAP at all: the markup rests complete.
  const kit = useMotionKit(near && !reduce);
  const motion = { kit, play: inView && !reduce, still: reduce };

  return (
    // Tablet: figure and words side by side, one outcome per row.
    <div ref={ref} className="flex flex-col md:grid md:grid-cols-2 md:items-center lg:flex">
      <div className="aspect-[540/320] w-full">
        {item.id === "capture" && <Answered labels={item.labels} {...motion} />}
        {item.id === "qualify" && <Qualified labels={item.labels} {...motion} />}
        {item.id === "time" && <DayBack labels={item.labels} {...motion} />}
      </div>
      <div className="p-8 md:py-10 md:pr-12 md:pl-4 lg:p-12 lg:pt-10">
        <h3 className="text-[15px] leading-[22px]">{item.title}</h3>
        <p className="text-[15px] leading-[22px] text-pp-muted">{item.body}</p>
      </div>
    </div>
  );
}

/* ─── 1 · Ringing → Answered ─────────────────────────────────────── */

const RING = { x0: 118, pick: 268, x1: 422, cy: 164, amp: 44, wave: 50 };
const RINGING = trace(RING.x0, RING.pick, (x) =>
  RING.cy - RING.amp * Math.sin((2 * Math.PI * (x - RING.x0)) / RING.wave),
);
const SETTLED = trace(RING.pick, RING.x1, (x) => {
  const u = x - RING.pick;
  return RING.cy - RING.amp * Math.exp(-u / 26) * Math.sin((2 * Math.PI * u) / RING.wave);
});

function Answered({ labels, kit, play, still }: { labels: { from: string; to: string; mark: string } } & Motion) {
  const svg = useRef<SVGSVGElement>(null);
  const fade = useSvgId("ring-fade");

  useLoop(
    svg,
    (tl, q) => {
      const [ringing, settled] = [q(".ringing")[0], q(".settled")[0]] as SVGPathElement[];
      const traveller = q(".traveller");
      const core = q(".traveller-core");

      tl.set(traveller, { opacity: 0 }, 0)
        .set(core, { attr: { fill: BG } }, 0)
        .set(settled, { drawSVG: "0% 0%" }, 0)
        .to(ringing, { strokeDashoffset: -46, duration: 3.2 }, 0)
        .to(traveller, { opacity: 1, duration: 0.4 }, 0.1)
        .to(
          traveller,
          { duration: 2.8, ease: "sine.in", motionPath: { path: ringing, align: ringing, alignOrigin: [0.5, 0.5] } },
          0.1,
        )
        .set(core, { attr: { fill: INK } }, 2.9);
      ping(tl, q(".pick-ping"), 2.9);
      tl.to(
        traveller,
        { duration: 1.9, ease: "power3.out", motionPath: { path: settled, align: settled, alignOrigin: [0.5, 0.5] } },
        2.9,
      ).to(settled, { drawSVG: "0% 100%", duration: 1.9, ease: "power3.out" }, 2.9);
      ping(tl, q(".end-ping"), 4.4);
      tl.to(traveller, { opacity: 0, duration: 0.35 }, 4.6)
        .to(settled, { drawSVG: "100% 100%", duration: 0.9, ease: "power2.inOut" }, 6)
        .to({}, { duration: 0.3 });
    },
    { kit, play, still },
  );

  return (
    <svg ref={svg} {...svgProps}>
      <defs>
        <Fade id={fade} from={RING.x0} run={70} />
      </defs>

      <line x1={RING.pick} x2={RING.pick} y1="84" y2="244" strokeOpacity="0.3" {...dotted} />

      <path className="ringing" d={RINGING} {...dotted} stroke={`url(#${fade})`} strokeOpacity="0.75" />
      <path d={SETTLED} {...dotted} strokeOpacity="0.3" />
      <path className="settled" d={SETTLED} stroke={INK} strokeWidth={LINE} strokeLinecap="round" />

      <Ping className="pick-ping" x={RING.pick} y={RING.cy} />
      <Node x={RING.pick} y={RING.cy} />
      <Ping className="end-ping" x={RING.x1} y={RING.cy} />
      <Node x={RING.x1} y={RING.cy} />
      <Node className="traveller" coreClassName="traveller-core" hollow hidden r={4} />

      <text x={RING.x0 + 4} y="100" fill={MUTED} style={label}>
        {labels.from}
      </text>
      <text x={RING.x1} y="138" textAnchor="middle" fill={INK} style={label}>
        {labels.to}
      </text>
      <text x={RING.pick} y="266" textAnchor="middle" fill={MUTED} style={label}>
        {labels.mark}
      </text>
    </svg>
  );
}

/* ─── 2 · Enquiries → Qualified ──────────────────────────────────── */

const Q = { x0: 106, cy: 160, end: 428, gates: [238, 298, 358], narrow: 0.34 };
/** Where each enquiry starts, and the question it stops at (null: it qualifies). */
const LANES: { y: number; stop: number | null }[] = [
  { y: 88, stop: 0 },
  { y: 124, stop: 2 },
  { y: 160, stop: null },
  { y: 196, stop: 1 },
  { y: 232, stop: 0 },
];

function laneEnd(y0: number, stop: number | null) {
  return stop === null
    ? { x: Q.end, y: Q.cy }
    : { x: Q.gates[stop], y: Q.cy + (y0 - Q.cy) * Q.narrow };
}

function lanePath(y0: number, stop: number | null) {
  const e = laneEnd(y0, stop);
  if (stop === null) return `M${Q.x0} ${Q.cy} L${e.x} ${e.y}`;
  return `M${Q.x0} ${y0} C${Q.x0 + 84} ${y0} ${e.x - 70} ${e.y} ${e.x} ${e.y}`;
}

function Qualified({
  labels,
  kit,
  play,
  still,
}: { labels: { from: string; to: string; gates: readonly string[] } } & Motion) {
  const svg = useRef<SVGSVGElement>(null);
  const fade = useSvgId("lane-fade");

  useLoop(
    svg,
    (tl, q) => {
      const lanes = q(".lane") as SVGPathElement[];
      const pulses = q(".pulse");
      const cores = q(".pulse-core");
      const gates = q(".gate");
      const SPEED = 128; // units per second
      const flash = (gate: Element, at: number) =>
        tl.to(gate, { strokeOpacity: 0.9, duration: 0.16, yoyo: true, repeat: 1, ease: "power1.out" }, at);

      tl.set(pulses, { opacity: 0, y: 0 }, 0).set(cores, { attr: { fill: INK } }, 0);

      LANES.forEach((lane, i) => {
        const path = lanes[i];
        const start = [0, 0.3, 0.8, 0.5, 0.14][i];
        const dur = path.getTotalLength() / SPEED;

        tl.to(pulses[i], { opacity: 1, duration: 0.3 }, start).to(
          pulses[i],
          { duration: dur, ease: "sine.inOut", motionPath: { path, align: path, alignOrigin: [0.5, 0.5] } },
          start,
        );

        if (lane.stop !== null) {
          // Stopped at its question: the gate registers it and it drops away.
          flash(gates[lane.stop], start + dur - 0.08);
          tl.set(cores[i], { attr: { fill: BG } }, start + dur)
            .to(pulses[i], { opacity: 0, y: "+=14", duration: 0.8, ease: "power2.in" }, start + dur + 0.2);
        } else {
          // Through all three, touching each on the way.
          Q.gates.forEach((g, gi) => flash(gates[gi], start + dur * ((g - Q.x0) / (Q.end - Q.x0)) - 0.08));
          ping(tl, q(".q-ping"), start + dur);
          tl.to(pulses[i], { opacity: 0, duration: 0.4 }, start + dur + 0.3);
        }
      });

      tl.to({}, { duration: 1.2 });
    },
    { kit, play, still },
  );

  return (
    <svg ref={svg} {...svgProps}>
      <defs>
        <Fade id={fade} from={Q.x0} run={90} />
      </defs>

      {Q.gates.map((g, i) => (
        <g key={g}>
          <line className="gate" x1={g} x2={g} y1="76" y2="244" strokeOpacity="0.28" {...dotted} />
          <text x={g} y="266" textAnchor="middle" fill={MUTED} style={label}>
            {labels.gates[i]}
          </text>
        </g>
      ))}

      {LANES.map((lane) => {
        const qualifies = lane.stop === null;
        return (
          <path
            key={lane.y}
            className="lane"
            d={lanePath(lane.y, lane.stop)}
            stroke={`url(#${fade})`}
            strokeOpacity={qualifies ? 1 : 0.55}
            strokeWidth={LINE}
            strokeDasharray={qualifies ? undefined : DOTS}
            strokeLinecap="round"
          />
        );
      })}

      {LANES.map((lane) => {
        if (lane.stop === null) return null;
        const e = laneEnd(lane.y, lane.stop);
        return <Node key={lane.y} x={e.x} y={e.y} hollow r={3.8} />;
      })}

      <Ping className="q-ping" x={Q.end} y={Q.cy} />
      <Node x={Q.end} y={Q.cy} />
      {LANES.map((lane) => (
        <Node key={lane.y} className="pulse" coreClassName="pulse-core" hidden r={3.4} />
      ))}

      <text x={Q.x0} y="72" fill={MUTED} style={label}>
        {labels.from}
      </text>
      <text x={Q.end} y="136" textAnchor="middle" fill={INK} style={label}>
        {labels.to}
      </text>
    </svg>
  );
}

/* ─── 3 · Interruptions → Day back ───────────────────────────────── */

const DAY = { x0: 116, x1: 424, y: 222 };
const INTERRUPTIONS = [
  { x: 160, h: 72 },
  { x: 204, h: 118 },
  { x: 246, h: 58 },
  { x: 296, h: 132 },
  { x: 340, h: 86 },
  { x: 384, h: 104 },
];

function DayBack({
  labels,
  kit,
  play,
  still,
}: { labels: { from: string; to: string; start: string; end: string } } & Motion) {
  const svg = useRef<SVGSVGElement>(null);

  useLoop(
    svg,
    (tl, q) => {
      const RUN = 4;
      const START = 0.3;
      const span = DAY.x1 - DAY.x0;
      const stems = q(".stem");
      const heads = q(".head");
      const agent = q(".agent");
      const focus = q(".focus");
      const done = q(".day-back");

      tl.set(agent, { x: 0, opacity: 0 }, 0)
        .set(focus, { drawSVG: "0% 0%", opacity: 1 }, 0)
        .set(done, { opacity: 0 }, 0)
        .to(agent, { opacity: 1, duration: 0.3 }, START)
        .to(agent, { x: span, duration: RUN, ease: "sine.inOut" }, START)
        .to(focus, { drawSVG: "0% 100%", duration: RUN, ease: "sine.inOut" }, START);

      // Inverse of sine.inOut: when the agent reaches x.
      const timeAt = (x: number) => START + (Math.acos(1 - 2 * ((x - DAY.x0) / span)) / Math.PI) * RUN;

      INTERRUPTIONS.forEach((c, i) => {
        const at = timeAt(c.x) - 0.12;
        tl.to(stems[i], { attr: { y1: DAY.y }, duration: 0.55, ease: "power3.inOut" }, at)
          .to(heads[i], { y: c.h, scale: 0.4, svgOrigin: `${c.x} ${DAY.y - c.h}`, duration: 0.55, ease: "power3.inOut" }, at)
          .to(heads[i], { opacity: 0, duration: 0.25 }, at + 0.45);
      });

      const end = START + RUN;
      ping(tl, q(".day-ping"), end);
      tl.to(done, { opacity: 1, duration: 0.6 }, end)
        .to(agent, { opacity: 0, duration: 0.3 }, end + 0.15)
        // The next morning: the calls stand back up and the line goes quiet.
        .to(focus, { opacity: 0, duration: 0.7 }, end + 1.8)
        .to(done, { opacity: 0, duration: 0.7 }, end + 1.8);
      INTERRUPTIONS.forEach((c, i) => {
        const at = end + 2 + i * 0.07;
        tl.to(stems[i], { attr: { y1: DAY.y - c.h }, duration: 0.7, ease: "power3.out" }, at)
          .to(heads[i], { y: 0, scale: 1, opacity: 1, duration: 0.7, ease: "power3.out" }, at);
      });
      tl.to({}, { duration: 0.5 });
    },
    { kit, play, still },
  );

  return (
    <svg ref={svg} {...svgProps}>
      <line x1={DAY.x0} x2={DAY.x1} y1={DAY.y} y2={DAY.y} strokeOpacity="0.3" {...dotted} />
      <line
        className="focus"
        x1={DAY.x0}
        x2={DAY.x1}
        y1={DAY.y}
        y2={DAY.y}
        stroke={INK}
        strokeWidth={LINE}
        strokeLinecap="round"
        opacity="0"
      />

      {INTERRUPTIONS.map((c) => (
        <line
          key={c.x}
          className="stem"
          x1={c.x}
          x2={c.x}
          y1={DAY.y - c.h}
          y2={DAY.y}
          strokeOpacity="0.4"
          {...dotted}
        />
      ))}
      {INTERRUPTIONS.map((c) => (
        <Node key={c.x} className="head" x={c.x} y={DAY.y - c.h} hollow r={3.8} />
      ))}

      <Node x={DAY.x0} y={DAY.y} hollow r={4} />
      <Ping className="day-ping" x={DAY.x1} y={DAY.y} />
      <Node x={DAY.x1} y={DAY.y} />
      <g className="agent" opacity="0">
        <Node x={DAY.x0} y={DAY.y} />
      </g>

      <text x={DAY.x0} y="72" fill={MUTED} style={label}>
        {labels.from}
      </text>
      <text
        className="day-back"
        x={DAY.x1}
        y="196"
        textAnchor="middle"
        fill={INK}
        style={label}
        opacity={still ? 1 : 0}
      >
        {labels.to}
      </text>
      <text x={DAY.x0} y="250" textAnchor="middle" fill={MUTED} style={label}>
        {labels.start}
      </text>
      <text x={DAY.x1} y="250" textAnchor="middle" fill={MUTED} style={label}>
        {labels.end}
      </text>
    </svg>
  );
}
