"use client";

import { useRef, useState } from "react";
import { MEANING, type MeaningSet } from "@/lib/pages/knowledge-base";
import { cn } from "@/lib/utils";
import { INK, LINE, MUTED, Node, Ping, ping, svgProps, useLoop, VIOLET } from "../line-figure";
import { useMotionKit, type Kit } from "../motion-kit";
import { Frame, Rule, SectionHeading } from "../primitives";
import { useInView, usePrefersReducedMotion } from "../timing";

/* ------------------------------------------------------------------ *
 * A map of meaning.
 *
 * Everything the agent has read sits in loose constellations by topic —
 * prices, cancelling, aftercare, hours, getting in. A question appears in
 * the open middle, listens for a beat, then travels. Three different
 * phrasings of the same question take three different routes, and all of
 * them arrive at the same constellation: the nearest three points link to
 * it, the topic lights up and the rest of the map dims.
 *
 * The routes, links and nearest points are computed once from the layout
 * below; GSAP draws the wake and links (DrawSVG), carries the question
 * (MotionPath) and reports which phrasing is up so the words beside the
 * map change in step.
 * ------------------------------------------------------------------ */

const W = 600;
const H = 440;
const CENTRE = { x: 300, y: 214 };
/**
 * Label sizes, in the drawing's own units. On a phone the drawing is shown
 * at about half size, so its labels are drawn larger there to stay legible.
 */
const TOPIC = "text-[16px] tracking-[0.01em] max-sm:text-[25px]";
const LABEL = "text-[14px] tracking-[0.01em] max-sm:text-[20px]";
/** The card the map sits on; GSAP needs the colour itself, not the token. */
const CARD = "#f4f3f7";

const CLUSTERS: Record<string, { x: number; y: number; above: boolean }> = {
  prices: { x: 124, y: 112, above: true },
  cancel: { x: 470, y: 104, above: true },
  aftercare: { x: 300, y: 350, above: false },
  hours: { x: 500, y: 318, above: false },
  access: { x: 104, y: 318, above: false },
};

/** Seven points in a loose disc, scattered by the golden angle. */
function pointsFor(id: string) {
  const c = CLUSTERS[id];
  const seed = id.length * 0.7;
  return Array.from({ length: 7 }, (_, i) => {
    const a = i * 2.39996 + seed;
    const r = 10 + 30 * Math.sqrt((i + 0.5) / 7);
    return { x: +(c.x + Math.cos(a) * r).toFixed(1), y: +(c.y + Math.sin(a) * r * 0.82).toFixed(1) };
  });
}

const POINTS = Object.fromEntries(Object.keys(CLUSTERS).map((id) => [id, pointsFor(id)]));

/** Where a question stops: short of the constellation, on the side facing the middle. */
function approachFor(id: string) {
  const c = CLUSTERS[id];
  const dx = CENTRE.x - c.x;
  const dy = CENTRE.y - c.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: +(c.x + (dx / len) * 76).toFixed(1), y: +(c.y + (dy / len) * 76).toFixed(1) };
}

function nearest(id: string, from: { x: number; y: number }) {
  return [...POINTS[id]].sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y)).slice(0, 3);
}

/** Three routes to the same place, bowed one way, straight, and the other. */
function routesFor(id: string) {
  const to = approachFor(id);
  const mx = (CENTRE.x + to.x) / 2;
  const my = (CENTRE.y + to.y) / 2;
  const nx = -(to.y - CENTRE.y);
  const ny = to.x - CENTRE.x;
  const len = Math.hypot(nx, ny) || 1;
  return [-70, 8, 70].map((bow) => {
    const cx = mx + (nx / len) * bow;
    const cy = my + (ny / len) * bow;
    return `M${CENTRE.x} ${CENTRE.y} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${to.x} ${to.y}`;
  });
}

export function KbMeaning() {
  const sets: readonly MeaningSet[] = MEANING.sets;
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, "-10% 0px");
  const near = useInView(ref, "25% 0px");
  const reduce = usePrefersReducedMotion();
  const kit = useMotionKit(near && !reduce);

  const [setIndex, setSetIndex] = useState(0);
  const [phrase, setPhrase] = useState(0);
  const set = sets[setIndex];
  const topic = MEANING.topics.find((t) => t.id === set.topic)!;

  return (
    <>
      <Frame className="px-6 pb-10 md:px-12 md:pb-14">
        <SectionHeading eyebrow={MEANING.eyebrow} className="max-w-[760px]">
          {MEANING.title}
        </SectionHeading>
      </Frame>

      <Frame className="px-4 md:px-6">
        <div className="grid overflow-hidden rounded-[24px] bg-pp-card lg:grid-cols-[380px_minmax(0,1fr)]">
          <div className="flex flex-col gap-6 p-6 md:p-8 lg:border-r lg:border-pp-rule">
            <div role="group" aria-label={MEANING.eyebrow} className="flex flex-wrap gap-1.5">
              {sets.map((s, i) => {
                const t = MEANING.topics.find((x) => x.id === s.topic)!;
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={i === setIndex}
                    onClick={() => {
                      setSetIndex(i);
                      setPhrase(0);
                    }}
                    className={cn(
                      "h-8 rounded-full px-3 text-[13px] transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink",
                      i === setIndex ? "bg-pp-ink text-white" : "bg-white text-pp-ink hover:bg-pp-bg",
                    )}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            <div>
              <p className="text-[11px] leading-4 font-medium tracking-[0.14em] text-pp-muted uppercase">{MEANING.asked}</p>
              <ol className="mt-3 flex flex-col gap-2">
                {set.phrasings.map((p, i) => (
                  <li
                    key={`${set.id}-${i}`}
                    className={cn(
                      "rounded-2xl px-3.5 py-2.5 text-[15px] leading-[21px] transition-[background-color,color,box-shadow] duration-500",
                      i === phrase && !reduce
                        ? "bg-white text-pp-ink shadow-[0_0_0_1px_rgb(85_26_137/0.35),0_12px_24px_-16px_rgb(85_26_137/0.5)]"
                        : "text-pp-muted",
                    )}
                  >
                    “{p}”
                  </li>
                ))}
              </ol>
            </div>

            <div className="mt-auto">
              <p className="text-[11px] leading-4 font-medium tracking-[0.14em] text-pp-muted uppercase">{MEANING.landsOn}</p>
              <p className="mt-2 text-[15px] leading-[22px]">
                <span className="text-[#551a89]">{topic.label}</span>
                <span className="text-pp-muted"> — {set.answer}</span>
              </p>
            </div>
          </div>

          <div ref={ref} className="relative aspect-[600/440] w-full self-center">
            <MeaningMap key={set.id} set={set} kit={kit} play={inView && !reduce} still={reduce} onPhrase={setPhrase} />
          </div>
        </div>
      </Frame>

      <Frame className="mt-4 grid divide-y divide-pp-rule md:grid-cols-3 md:divide-x md:divide-y-0">
        {MEANING.steps.map((s, i) => (
          <div key={s.id} className="px-6 py-8 md:px-12 md:py-10">
            <p className="font-[family-name:var(--font-pp-cinema)] text-[28px] leading-none text-[#551a89]">
              {String(i + 1).padStart(2, "0")}
            </p>
            <h3 className="mt-4 text-[15px] leading-[22px]">{s.title}</h3>
            <p className="text-[15px] leading-[22px] text-pp-muted">{s.body}</p>
          </div>
        ))}
      </Frame>
      <Rule />
    </>
  );
}

function MeaningMap({
  set,
  kit,
  play,
  still,
  onPhrase,
}: {
  set: MeaningSet;
  kit: Kit | null;
  play: boolean;
  still: boolean;
  onPhrase: (i: number) => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const to = approachFor(set.topic);
  const routes = routesFor(set.topic);
  const links = nearest(set.topic, to);

  useLoop(
    svg,
    (tl, q) => {
      const node = q(".mm-question");
      const wakes = q(".mm-route") as SVGPathElement[];
      const lines = q(".mm-link");
      const target = q(`.mm-dot-${set.topic}`);
      const others = q(".mm-dot").filter((d) => !target.includes(d));
      const labels = q(".mm-label");
      const targetLabel = q(`.mm-label-${set.topic}`);
      const STEP = 4.2;

      tl.set(wakes, { drawSVG: "0% 0%", opacity: 1 }, 0)
        .set(lines, { drawSVG: "0% 0%", opacity: 1 }, 0)
        .set(node, { opacity: 0 }, 0);

      set.phrasings.forEach((_, k) => {
        const t = k * STEP;
        const wake = wakes[k];
        tl.call(() => onPhrase(k), [], t + 0.01)
          .set(node, { x: CENTRE.x, y: CENTRE.y, opacity: 0, scale: 0.4, transformOrigin: "50% 50%" }, t)
          .to(node, { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(2)" }, t + 0.05);
        ping(tl, q(".mm-listen"), t + 0.3, 34);
        // The question sits at the origin, so the path's own coordinates are where it goes.
        tl.to(node, { duration: 1, ease: "power2.inOut", motionPath: { path: wake } }, t + 0.9)
          .to(wake, { drawSVG: "0% 100%", duration: 1, ease: "power2.inOut" }, t + 0.9)
          .to(lines, { drawSVG: "0% 100%", duration: 0.45, ease: "power2.out", stagger: 0.08 }, t + 1.9)
          .to(target, { attr: { r: 4.6 }, fill: VIOLET, stroke: VIOLET, duration: 0.4, ease: "power2.out", stagger: 0.03 }, t + 1.95)
          .to(others, { opacity: 0.25, duration: 0.5 }, t + 1.95)
          .to(labels, { opacity: 0.35, duration: 0.5 }, t + 1.95)
          .to(targetLabel, { opacity: 1, fill: VIOLET, duration: 0.4 }, t + 1.95);
        ping(tl, q(".mm-arrive"), t + 1.9, 40);
        tl.to([node, ...lines], { opacity: 0, duration: 0.45 }, t + 3.5)
          .to(wake, { drawSVG: "100% 100%", duration: 0.6, ease: "power2.in" }, t + 3.3)
          .to(target, { attr: { r: 3 }, fill: CARD, stroke: INK, duration: 0.5 }, t + 3.5)
          .to([...others, ...labels], { opacity: 1, duration: 0.5 }, t + 3.5)
          .to(targetLabel, { fill: INK, duration: 0.5 }, t + 3.5)
          .set(lines, { opacity: 1, drawSVG: "0% 0%" }, t + 4.0);
      });
    },
    { kit, play, still },
  );

  return (
    <svg ref={svg} {...svgProps(W, H)}>
      {/* Constellations */}
      {Object.entries(CLUSTERS).map(([id, c]) => {
        const topic = MEANING.topics.find((t) => t.id === id)!;
        const lit = still && id === set.topic;
        return (
          <g key={id}>
            {POINTS[id].map((p, i) => (
              <circle
                key={i}
                className={`mm-dot mm-dot-${id}`}
                cx={p.x}
                cy={p.y}
                r={lit ? 4.6 : 3}
                fill={lit ? VIOLET : CARD}
                stroke={lit ? VIOLET : INK}
                strokeWidth={LINE * 0.8}
              />
            ))}
            <text
              className={`mm-label mm-label-${id} ${TOPIC}`}
              x={c.x}
              y={c.above ? c.y - 50 : c.y + 60}
              textAnchor="middle"
              fill={lit ? VIOLET : INK}
            >
              {topic.label}
            </text>
          </g>
        );
      })}

      {/* The open middle, where a question is heard */}
      <circle cx={CENTRE.x} cy={CENTRE.y} r="22" stroke={INK} strokeOpacity="0.12" strokeWidth={LINE} strokeDasharray="0.01 4.6" strokeLinecap="round" />
      <Ping className="mm-listen" x={CENTRE.x} y={CENTRE.y} color={VIOLET} />

      {/* Three routes, three links, one arrival */}
      {routes.map((d, i) => (
        <path key={i} className="mm-route" d={d} stroke={VIOLET} strokeOpacity="0.45" strokeWidth={LINE} strokeDasharray="0.01 4.6" strokeLinecap="round" opacity={still ? 0 : 1} />
      ))}
      {links.map((p, i) => (
        <line
          key={i}
          className="mm-link"
          x1={to.x}
          y1={to.y}
          x2={p.x}
          y2={p.y}
          stroke={VIOLET}
          strokeWidth={LINE * 0.9}
          strokeLinecap="round"
          opacity={still ? 1 : 0}
        />
      ))}
      <Ping className="mm-arrive" x={to.x} y={to.y} color={VIOLET} />
      <g className="mm-question" opacity={still ? 1 : 0} transform={still ? `translate(${to.x} ${to.y})` : undefined}>
        <circle r="11" fill={VIOLET} fillOpacity="0.12" />
        <Node r={5} color={VIOLET} />
      </g>

      <text x={CENTRE.x} y={CENTRE.y + 46} textAnchor="middle" fill={MUTED} className={LABEL}>
        {MEANING.asked}
      </text>
    </svg>
  );
}
