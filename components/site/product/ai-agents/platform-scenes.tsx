"use client";

import { useEffect, useRef, useState } from "react";
import type { gsap } from "gsap";
import { AnimatePresence, motion } from "framer-motion";
import { PLATFORM } from "@/lib/pages/ai-agents";
import { cn } from "@/lib/utils";
import { useKitContext, useMotionKit } from "../motion-kit";
import { useInView, usePrefersReducedMotion } from "../timing";

/* ------------------------------------------------------------------ *
 * The three smaller platform cards, each a small working product scene:
 *
 *   · Voiceprint — a live signature of the chosen voice, its waves shaped
 *     by the voice's pitch and pace and eased into the next voice's shape.
 *   · Paperwork — a caller's question, the document it lands on, the line
 *     that answers it lit up, and the agent's reply carrying the source.
 *   · Call log — the week as a ring of outcomes with running totals, over
 *     a log that keeps filling as calls finish.
 *
 * Unlike the monochrome line figures further up, these are drawn as
 * product surfaces: white panels, violet and ember accents, real type.
 * ------------------------------------------------------------------ */

const VIOLET = "#551a89";
const EMBER = "#e0663a";
const LILAC = "#b8a2dc";
const panel = "rounded-2xl bg-white shadow-[0_0_0_1px_rgb(24_16_40/0.06),0_14px_32px_-18px_rgb(24_16_40/0.22)]";

/* ─── Voiceprint ─────────────────────────────────────────────────── */

type Voice = (typeof PLATFORM.voice.voices)[number];

function shapeOf(v: Voice) {
  return { pitch: v.pitch, pace: Math.max(0, Math.min(1, (v.wpm - 125) / 60)) };
}

const PRINT = { w: 320, h: 132, layers: 4 };

export function Voiceprint() {
  const v = PLATFORM.voice;
  const rootRef = useRef<HTMLDivElement>(null);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const pitchRef = useRef<HTMLSpanElement>(null);
  const paceRef = useRef<HTMLSpanElement>(null);
  const inView = useInView(rootRef);
  const near = useInView(rootRef, "25% 0px");
  const reduce = usePrefersReducedMotion();
  const kit = useMotionKit(near);

  const [pick, setPick] = useState(0);
  const [touched, setTouched] = useState(false);
  const voice = v.voices[pick];
  const shape = useRef(shapeOf(v.voices[0]));

  // Cycles through the voices on its own until one is chosen.
  useEffect(() => {
    if (touched || !inView || reduce) return;
    const id = window.setInterval(() => setPick((p) => (p + 1) % v.voices.length), 4200);
    return () => window.clearInterval(id);
  }, [touched, inView, reduce, v.voices.length]);

  // A new voice: the wave shape and both meters ease over to it.
  useKitContext(
    kit,
    ({ gsap }) => {
      const next = shapeOf(voice);
      gsap.to(shape.current, { ...next, duration: reduce ? 0 : 1.1, ease: "power3.inOut" });
      gsap.to(pitchRef.current, { scaleX: 0.12 + next.pitch * 0.88, duration: reduce ? 0 : 0.9, ease: "power3.out" });
      gsap.to(paceRef.current, { scaleX: 0.12 + next.pace * 0.88, duration: reduce ? 0 : 0.9, ease: "power3.out" });
    },
    { dependencies: [pick, reduce] },
  );

  // The waves, redrawn on GSAP's ticker while the card is on screen.
  useEffect(() => {
    const { w, h, layers } = PRINT;
    const mid = h / 2;
    let t = 0;
    const draw = (dt: number) => {
      const { pitch, pace } = shape.current;
      t += dt * (0.7 + pace * 1.1);
      for (let k = 0; k < layers; k++) {
        const el = pathRefs.current[k];
        if (!el) continue;
        const freq = 1.6 + pitch * 3.4 + k * 0.28;
        const lift = (1 - k * 0.2) * (0.78 + 0.22 * Math.sin(t * 1.3 + k * 1.7));
        let d = "";
        for (let x = 0; x <= w; x += 4) {
          const u = x / w;
          const envelope = Math.pow(Math.sin(Math.PI * u), 1.3);
          const syllables = 0.62 + 0.38 * Math.sin(Math.PI * 2 * u * (1.2 + pace * 2.4) - t * 2.1 + k);
          const y = mid + 40 * lift * envelope * syllables * Math.sin(Math.PI * 2 * freq * u + t * 3 + k * 0.9);
          d += `${x ? "L" : "M"}${x} ${y.toFixed(2)}`;
        }
        el.setAttribute("d", d);
      }
    };
    draw(0);
    if (!kit || !inView || reduce) return;
    const { ticker } = kit.gsap;
    const tick = (_time: number, deltaMs: number) => draw(Math.min(deltaMs, 50) / 1000);
    ticker.add(tick);
    return () => ticker.remove(tick);
  }, [kit, inView, reduce]);

  const pitchWord = voice.pitch < 0.35 ? "Low" : voice.pitch < 0.65 ? "Mid" : "High";

  return (
    <div ref={rootRef} className={cn(panel, "mx-7 mt-6 mb-7 flex flex-1 flex-col p-4")}>
      <div key={voice.id} className="animate-in fade-in-0 slide-in-from-bottom-1 duration-500">
        <p className="pp-display text-[22px] leading-7" style={{ fontWeight: 480 }}>
          {voice.name}
        </p>
        <p className="text-[12px] leading-4 text-pp-muted">
          {voice.accent} · {voice.register}
        </p>
      </div>

      <svg viewBox={`0 0 ${PRINT.w} ${PRINT.h}`} className="mt-3 h-auto w-full flex-1" aria-hidden fill="none">
        <defs>
          <linearGradient id="vp-stroke" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor={VIOLET} />
            <stop offset="1" stopColor={EMBER} />
          </linearGradient>
        </defs>
        <line
          x1="0"
          x2={PRINT.w}
          y1={PRINT.h / 2}
          y2={PRINT.h / 2}
          stroke="rgb(24 16 40 / 0.12)"
          strokeDasharray="0.01 5"
          strokeLinecap="round"
          strokeWidth="1.5"
        />
        {Array.from({ length: PRINT.layers }, (_, k) => (
          <path
            key={k}
            ref={(el) => {
              pathRefs.current[k] = el;
            }}
            stroke="url(#vp-stroke)"
            strokeWidth={[2.2, 1.6, 1.2, 1][k]}
            strokeOpacity={[1, 0.5, 0.28, 0.16][k]}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>

      <div className="mt-3 grid grid-cols-2 gap-4">
        {[
          { label: v.pitch, value: pitchWord, ref: pitchRef },
          { label: v.pace, value: v.wpm(voice.wpm), ref: paceRef },
        ].map((m) => (
          <div key={m.label}>
            <div className="flex items-baseline justify-between text-[11px] leading-4">
              <span className="text-pp-muted">{m.label}</span>
              <span className="tabular-nums">{m.value}</span>
            </div>
            <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-pp-card">
              <span
                ref={m.ref}
                className="block h-full origin-left rounded-full bg-gradient-to-r from-[#551a89] to-[#e0663a]"
                style={{ transform: "scaleX(0.5)" }}
              />
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2" role="group" aria-label={v.title}>
        {v.voices.map((x, i) => (
          <button
            key={x.id}
            type="button"
            aria-pressed={i === pick}
            aria-label={`${x.name}, ${x.accent}`}
            onClick={() => {
              setTouched(true);
              setPick(i);
            }}
            className={cn(
              "grid size-9 place-items-center rounded-full text-[13px] transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink",
              i === pick ? "bg-pp-ink text-white" : "bg-pp-card text-pp-ink hover:bg-[#ebe9f1]",
            )}
          >
            {x.name[0]}
          </button>
        ))}
        <span className="ml-auto truncate text-[12px] text-pp-muted">{voice.note}</span>
      </div>
    </div>
  );
}

/* ─── Paperwork ──────────────────────────────────────────────────── */

export function Paperwork() {
  const k = PLATFORM.knowledge;
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, "-10% 0px");
  const near = useInView(rootRef, "25% 0px");
  const reduce = usePrefersReducedMotion();
  const kit = useMotionKit(near);
  const [index, setIndex] = useState(0);
  const doc = k.docs[index];
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  useKitContext(
    kit,
    ({ gsap, SplitText }) => {
      const q = gsap.utils.selector(rootRef);
      if (reduce) {
        gsap.set(q(".pw-reveal"), { autoAlpha: 1 });
        gsap.set(q(".pw-mark"), { scaleX: 1 });
        gsap.set(q(".pw-link"), { scaleX: 1, scaleY: 1 });
        gsap.set(q(".pw-link-dot"), { autoAlpha: 1 });
        return;
      }

      // Route the connector from the answering line out and down to the reply.
      const docs = q(".pw-docs")[0] as HTMLElement;
      const clauseBox = (q(".pw-clause")[0] as HTMLElement).getBoundingClientRect();
      const docsBox = docs.getBoundingClientRect();
      const y = clauseBox.top + clauseBox.height / 2 - docsBox.top;
      const x0 = clauseBox.right - docsBox.left + 14;
      const x1 = docsBox.width * 0.84;
      gsap.set(q(".pw-link-h"), { left: x0, top: y, width: Math.max(0, x1 - x0) });
      gsap.set(q(".pw-link-v"), { left: x1, top: y, height: Math.max(0, docsBox.height - y + 12) });
      gsap.set(q(".pw-link-dot"), { left: x0 - 3, top: y - 3 });

      // Split for motion only: the words stay plain text to a screen reader.
      const question = SplitText.create(q(".pw-question")[0], { type: "words", aria: "none" });
      const answer = SplitText.create(q(".pw-answer")[0], { type: "words", aria: "none" });

      const tl = gsap.timeline({
        paused: true,
        onComplete: () => setIndex((i) => (i + 1) % k.docs.length),
      });

      tl.set(q(".pw-reveal"), { autoAlpha: 0 })
        .set(q(".pw-mark"), { scaleX: 0 })
        .set(q(".pw-link-h"), { scaleX: 0, scaleY: 1 })
        .set(q(".pw-link-v"), { scaleX: 1, scaleY: 0 })
        .set(q(".pw-link-dot"), { autoAlpha: 0, scale: 0.4 })
        .set(q(".pw-scan"), { autoAlpha: 0, y: 0 })
        .fromTo(q(".pw-sheet"), { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, ease: "power3.out" }, 0)
        .to(q(".pw-ask"), { autoAlpha: 1, duration: 0.3 }, 0.2)
        .fromTo(
          question.words,
          { autoAlpha: 0, y: 6 },
          { autoAlpha: 1, y: 0, duration: 0.45, ease: "power2.out", stagger: 0.07 },
          0.3,
        );

      // The scan runs down the page and settles on the answering line.
      const clause = q(".pw-clause")[0] as HTMLElement;
      const sheet = q(".pw-sheet-body")[0] as HTMLElement;
      const stop = clause.offsetTop - 4;
      tl.to(q(".pw-scan"), { autoAlpha: 1, duration: 0.2 }, ">+0.2")
        .fromTo(q(".pw-scan"), { y: 0 }, { y: sheet.clientHeight - 22, duration: 0.9, ease: "sine.inOut" }, "<")
        .to(q(".pw-scan"), { y: stop, duration: 0.55, ease: "power3.out" })
        .to(q(".pw-mark"), { scaleX: 1, duration: 0.45, ease: "power2.out" }, ">-0.1")
        .to(q(".pw-clause-text"), { autoAlpha: 1, duration: 0.3 }, "<0.1")
        .to(q(".pw-scan"), { autoAlpha: 0, duration: 0.3 }, "<")
        .to(q(".pw-link-dot"), { autoAlpha: 1, scale: 1, duration: 0.25, ease: "back.out(2)" }, ">-0.1")
        .to(q(".pw-link-h"), { scaleX: 1, duration: 0.35, ease: "power2.inOut" }, ">-0.05")
        .to(q(".pw-link-v"), { scaleY: 1, duration: 0.4, ease: "power2.inOut" }, ">-0.05")
        .to(q(".pw-reply"), { autoAlpha: 1, duration: 0.3 }, ">-0.1")
        .fromTo(
          answer.words,
          { autoAlpha: 0, y: 6 },
          { autoAlpha: 1, y: 0, duration: 0.45, ease: "power2.out", stagger: 0.06 },
          "<0.1",
        )
        .to(q(".pw-source"), { autoAlpha: 1, duration: 0.4 }, ">-0.2")
        .to({}, { duration: 2.4 })
        .to(q(".pw-fade"), { autoAlpha: 0, duration: 0.45, ease: "power1.in" });

      tlRef.current = tl;
      return () => {
        tlRef.current = null;
      };
    },
    { scope: rootRef, dependencies: [index, reduce], revertOnUpdate: true },
  );

  useEffect(() => {
    const tl = tlRef.current;
    if (!tl) return;
    if (inView) tl.play();
    else tl.pause();
  }, [inView, index, reduce, kit]);

  return (
    <div ref={rootRef} className="relative mx-7 mt-6 mb-7 flex flex-1 flex-col gap-3">
      {/* The question */}
      <div className={cn(panel, "pw-fade pw-ask pw-reveal px-3.5 py-2.5")}>
        <p className="text-[10px] leading-4 font-medium tracking-[0.12em] text-pp-muted uppercase">{k.asks}</p>
        <p key={`q-${index}`} className="pw-question text-[13px] leading-[18px]">
          {doc.question}
        </p>
      </div>

      {/* The document, with the other two behind it */}
      <div className="pw-docs relative flex-1">
        <span aria-hidden className="absolute top-2 left-3 h-[calc(100%-8px)] w-[64%] -rotate-3 rounded-lg bg-white/60 shadow-[0_0_0_1px_rgb(24_16_40/0.05)]" />
        <span aria-hidden className="absolute top-1 left-1.5 h-[calc(100%-4px)] w-[64%] rotate-2 rounded-lg bg-white/80 shadow-[0_0_0_1px_rgb(24_16_40/0.05)]" />
        <div className="pw-fade pw-sheet absolute top-0 left-0 flex h-full w-[64%] flex-col rounded-lg bg-white p-3 shadow-[0_0_0_1px_rgb(24_16_40/0.07),0_10px_24px_-14px_rgb(24_16_40/0.3)]">
          <p className="flex items-center gap-1.5 text-[10px] leading-4 font-medium">
            <span className="size-2 rounded-[2px] bg-[#551a89]" />
            {doc.name}
          </p>
          <div className="pw-sheet-body relative mt-2 flex flex-1 flex-col gap-2 overflow-hidden">
            {[82, 64, -1, 74, 58, 70].map((width, i) =>
              width < 0 ? (
                <div key={i} className="pw-clause relative h-[18px]">
                  <span className="pw-mark absolute inset-0 origin-left rounded bg-[#551a89]/12" style={{ transform: "scaleX(0)" }} />
                  <span className="absolute top-1/2 left-0 h-1.5 w-[88%] -translate-y-1/2 rounded-full bg-pp-card" />
                  <span className="pw-clause-text pw-reveal invisible absolute inset-0 truncate px-1 text-[10px] leading-[18px] text-[#551a89]">
                    {doc.clause}
                  </span>
                </div>
              ) : (
                <span key={i} className="block h-1.5 rounded-full bg-pp-card" style={{ width: `${width}%` }} />
              ),
            )}
            <span className="pw-scan invisible absolute inset-x-0 top-0 h-[22px] rounded bg-gradient-to-b from-transparent via-[#551a89]/15 to-transparent" />
          </div>
        </div>

        {/* From the answering line, out and down to the reply */}
        <span aria-hidden className="pw-link-dot invisible absolute size-1.5 rounded-full bg-[#551a89]" />
        <span
          aria-hidden
          className="pw-link pw-link-h absolute h-px origin-left bg-[#551a89]/55"
          style={{ transform: "scaleX(0)" }}
        />
        <span
          aria-hidden
          className="pw-link pw-link-v absolute w-px origin-top bg-[#551a89]/55"
          style={{ transform: "scaleY(0)" }}
        />
      </div>

      {/* The reply */}
      <div className="pw-fade pw-reply pw-reveal invisible rounded-2xl bg-pp-ink px-3.5 py-2.5 text-white">
        <p className="text-[10px] leading-4 font-medium tracking-[0.12em] text-white/60 uppercase">{k.answers}</p>
        <p key={`a-${index}`} className="pw-answer text-[13px] leading-[18px]">
          {doc.answer}
        </p>
        <p className="pw-source pw-reveal invisible mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-0.5 text-[10px] leading-4 text-white/80">
          <span className="size-1.5 rounded-full bg-[#b8a2dc]" />
          {k.from} · {doc.name}
        </p>
      </div>
    </div>
  );
}

/* ─── Call log ───────────────────────────────────────────────────── */

const OUTCOME_COLOR: Record<string, string> = { booked: VIOLET, answered: LILAC, handover: EMBER };

export function CallLog() {
  const m = PLATFORM.measure;
  const rootRef = useRef<HTMLDivElement>(null);
  const totalRef = useRef<HTMLSpanElement>(null);
  const countRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const inView = useInView(rootRef, "-10% 0px");
  const near = useInView(rootRef, "25% 0px");
  const reduce = usePrefersReducedMotion();
  const kit = useMotionKit(near);

  // The ring and the totals draw once, the first time the card is seen.
  const drawn = useRef(false);

  useKitContext(
    kit,
    ({ gsap }) => {
      if (!inView || drawn.current) return;
      drawn.current = true;
      const q = gsap.utils.selector(rootRef);
      let start = 0;
      m.outcomes.forEach((o, i) => {
        const len = o.share * 100 - 1.6;
        gsap.fromTo(
          q(`.cl-arc-${o.id}`),
          { attr: { "stroke-dasharray": `0 100`, "stroke-dashoffset": -start } },
          {
            attr: { "stroke-dasharray": `${len} ${100 - len}`, "stroke-dashoffset": -start },
            duration: reduce ? 0 : 1.1,
            delay: reduce ? 0 : 0.15 + i * 0.35,
            ease: "power3.inOut",
          },
        );
        start += o.share * 100;
        const counter = { n: 0 };
        gsap.to(counter, {
          n: Math.round(o.share * m.total),
          duration: reduce ? 0 : 1.4,
          delay: reduce ? 0 : 0.15 + i * 0.35,
          ease: "power2.out",
          onUpdate: () => {
            const el = countRefs.current[i];
            if (el) el.textContent = String(Math.round(counter.n));
          },
        });
      });
      const total = { n: 0 };
      gsap.to(total, {
        n: m.total,
        duration: reduce ? 0 : 1.6,
        ease: "power2.out",
        onUpdate: () => {
          if (totalRef.current) totalRef.current.textContent = String(Math.round(total.n));
        },
      });
    },
    { scope: rootRef, dependencies: [inView, reduce] },
  );

  // The log keeps filling: a finished call arrives every so often.
  const [head, setHead] = useState(0);
  useEffect(() => {
    if (!inView || reduce) return;
    const id = window.setInterval(() => setHead((h) => h + 1), 1700);
    return () => window.clearInterval(id);
  }, [inView, reduce]);

  const rows = Array.from({ length: 4 }, (_, i) => {
    const n = head - i;
    const entry = m.log[((n % m.log.length) + m.log.length) % m.log.length];
    return { key: n, ...entry };
  });
  const labelOf = (id: string) => m.outcomes.find((o) => o.id === id)?.label ?? id;

  return (
    <div ref={rootRef} className={cn(panel, "mx-7 mt-6 mb-7 flex flex-1 flex-col p-4")}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] leading-4 font-medium tracking-[0.12em] text-pp-muted uppercase">{m.period}</p>
        <span className="rounded-full bg-pp-card px-2 py-0.5 text-[10px] text-pp-muted">{m.sample}</span>
      </div>

      <div className="mt-3 flex items-center gap-4">
        <div className="relative size-[92px] shrink-0">
          <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
            <circle cx="50" cy="50" r="40" fill="none" stroke="rgb(24 16 40 / 0.06)" strokeWidth="11" />
            {m.outcomes.map((o) => (
              <circle
                key={o.id}
                className={`cl-arc-${o.id}`}
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke={OUTCOME_COLOR[o.id]}
                strokeWidth="11"
                pathLength={100}
                strokeDasharray="0 100"
              />
            ))}
          </svg>
          <span className="absolute inset-0 grid place-items-center text-center leading-none">
            <span>
              <span ref={totalRef} className="pp-display block text-[20px] tabular-nums" style={{ fontWeight: 480 }}>
                0
              </span>
              <span className="text-[10px] text-pp-muted">{m.calls}</span>
            </span>
          </span>
        </div>

        <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
          {m.outcomes.map((o, i) => (
            <li key={o.id} className="flex items-center gap-2 text-[12px] leading-4">
              <span className="size-2 shrink-0 rounded-full" style={{ background: OUTCOME_COLOR[o.id] }} />
              <span className="min-w-0 flex-1 truncate text-pp-muted">{o.label}</span>
              <span
                ref={(el) => {
                  countRefs.current[i] = el;
                }}
                className="tabular-nums"
              >
                0
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative mt-4 flex-1 overflow-hidden border-t border-pp-rule pt-3 [mask-image:linear-gradient(to_bottom,#000_70%,transparent)]">
        <ul className="flex flex-col gap-1.5">
          <AnimatePresence initial={false}>
            {rows.map((r) => (
              <motion.li
                key={r.key}
                layout="position"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ layout: { type: "spring", stiffness: 260, damping: 30 }, duration: 0.4 }}
                className="flex items-center gap-2.5 rounded-lg px-1 py-1 text-[12px] leading-4"
              >
                <span className="w-9 shrink-0 text-pp-muted tabular-nums">{r.time}</span>
                <span className="min-w-0 flex-1 truncate">{r.intent}</span>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px] leading-4"
                  style={{
                    color: r.outcome === "answered" ? "#3b2a55" : OUTCOME_COLOR[r.outcome],
                    background: `color-mix(in oklab, ${OUTCOME_COLOR[r.outcome]} 14%, transparent)`,
                  }}
                >
                  {labelOf(r.outcome)}
                </span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>
    </div>
  );
}
