"use client";

import { useEffect, useRef, useState } from "react";
import { PLATFORM } from "@/lib/pages/ai-agents";
import { COMPANY, greetingFor } from "@/lib/site";
import { cn } from "@/lib/utils";
import { Frame, Orb, ORB_MESHES, SectionHeading } from "../primitives";
import { CallLog, Paperwork, Voiceprint } from "./platform-scenes";
import { useInView, usePrefersReducedMotion } from "../timing";

/* ------------------------------------------------------------------ *
 * The platform, as four working corners of it: the agent's settings with
 * a greeting that rewrites itself as you change them, the voice picker,
 * an answer quoted from a document, and a week of calls you can read
 * day by day. Each card is the control, not a picture of one.
 *
 * The settings lead on their own full-width row, text beside the
 * workspace; the other three sit under it as equals.
 * ------------------------------------------------------------------ */

export function AgentsPlatform() {
  return (
    <>
      <Frame className="px-6 pb-10 md:px-12 md:pb-12">
        <SectionHeading eyebrow={PLATFORM.eyebrow} className="max-w-[720px]">
          {PLATFORM.title}
        </SectionHeading>
      </Frame>
      <Frame className="grid gap-4 px-4 pb-4">
        <DesignCard />
        <div className="grid gap-4 lg:grid-cols-3">
          <VoiceCard />
          <KnowledgeCard />
          <MeasureCard />
        </div>
      </Frame>
    </>
  );
}

function Card({
  title,
  body,
  wide = false,
  className,
  children,
}: {
  title: string;
  body: string;
  /** Text beside the content rather than above it. */
  wide?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative flex min-h-[480px] flex-col overflow-hidden rounded-[24px] bg-pp-card",
        wide ? "lg:grid lg:h-[480px] lg:grid-cols-[340px_minmax(0,1fr)]" : "lg:h-[520px]",
        className,
      )}
    >
      <div className={cn("relative z-10 px-7 pt-8", wide ? "lg:pt-10 lg:pr-4" : "max-w-[560px]")}>
        <h3 className={cn("leading-6", wide ? "text-[20px] leading-7" : "text-base")}>{title}</h3>
        <p className="mt-2 text-[15px] leading-[22px] text-pp-muted">{body}</p>
      </div>
      {children}
    </div>
  );
}

/* ─── Design ─────────────────────────────────────────────────────── */

function DesignCard() {
  const d = PLATFORM.design;
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const reduce = usePrefersReducedMotion();
  const [tone, setTone] = useState(1);
  const [lang, setLang] = useState(0);
  const [touched, setTouched] = useState(false);

  // Walks the pad on its own — a new register, then a new language — until
  // the first click takes it over.
  useEffect(() => {
    if (touched || !inView || reduce) return;
    const id = window.setInterval(() => {
      setTone((t) => (t + 1) % d.tones.length);
      setLang((l) => (l + 2) % d.langs.length);
    }, 2600);
    return () => window.clearInterval(id);
  }, [touched, inView, reduce, d.tones.length, d.langs.length]);

  const t = d.tones[tone];
  const greeting = greetingFor({
    lang: d.langs[lang],
    company: d.company,
    agent: d.agent,
    relaxed: t.at[0],
    warm: t.at[1],
  });

  return (
    <Card title={d.title} body={d.body} wide>
      <div ref={ref} className="relative mt-8 ml-7 flex min-h-[360px] flex-1 lg:mt-10 lg:ml-0 lg:min-h-0">
        <div className="absolute inset-0 flex overflow-hidden rounded-tl-2xl bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_12px_32px_-12px_rgb(0_0_0/0.12)]">
          <aside className="hidden w-[164px] shrink-0 flex-col gap-0.5 border-r border-pp-rule p-3 sm:flex">
            <p className="mb-3 px-2 pt-1 text-[12px] font-medium tracking-[-0.03em]">{COMPANY.wordmark}</p>
            <p className="mb-1 rounded-lg border border-pp-hair px-2 py-1.5 text-[12px]">{d.crumb[0]} ▾</p>
            <p className="mt-3 mb-1 px-2 text-[11px] text-pp-muted">Configure</p>
            {d.nav.map((n) => (
              <p
                key={n}
                className={cn(
                  "rounded-lg px-2 py-1.5 text-[12px]",
                  n === d.active ? "bg-pp-card text-pp-ink" : "text-pp-muted",
                )}
              >
                {n}
              </p>
            ))}
          </aside>

          <div className="min-w-0 flex-1 p-4 md:p-5">
            <p className="text-[12px] text-pp-muted">
              {d.crumb[0]} <span className="px-1">/</span>
              <span className="text-pp-ink">{d.crumb[1]}</span>
            </p>

            <p className="mt-5 text-[11px] text-pp-muted">{d.greeting}</p>
            <div className="mt-2 flex items-start gap-3 rounded-2xl border border-pp-hair p-3">
              <Orb mesh={ORB_MESHES.violet} speaking={inView && !reduce} className="mt-0.5 size-7 shrink-0" />
              <p
                key={`${tone}-${lang}`}
                lang={d.langs[lang].code.toLowerCase()}
                className="min-h-[40px] text-[14px] leading-5 animate-in fade-in-0 slide-in-from-bottom-1 duration-500"
              >
                {greeting}
              </p>
            </div>

            <p className="mt-5 text-[11px] text-pp-muted">{d.tone}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {d.tones.map((x, i) => (
                <Chip
                  key={x.id}
                  on={i === tone}
                  onClick={() => {
                    setTouched(true);
                    setTone(i);
                  }}
                  title={x.blurb}
                >
                  {x.label}
                </Chip>
              ))}
            </div>

            <p className="mt-5 text-[11px] text-pp-muted">{d.language}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {d.langs.map((x, i) => (
                <Chip
                  key={x.code}
                  on={i === lang}
                  onClick={() => {
                    setTouched(true);
                    setLang(i);
                  }}
                  title={x.name}
                >
                  {x.code}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function Chip({
  on,
  onClick,
  title,
  children,
}: {
  on: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={on}
      className={cn(
        "h-7 rounded-full px-2.5 text-[12px] transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-pp-ink",
        on ? "bg-pp-ink text-white" : "bg-pp-card text-pp-ink hover:bg-[#ebe8e4]",
      )}
    >
      {children}
    </button>
  );
}

/* ─── Voice, documents, results ─────────────────────────────────── */

function VoiceCard() {
  return (
    <Card title={PLATFORM.voice.title} body={PLATFORM.voice.body}>
      <Voiceprint />
    </Card>
  );
}

function KnowledgeCard() {
  return (
    <Card title={PLATFORM.knowledge.title} body={PLATFORM.knowledge.body}>
      <Paperwork />
    </Card>
  );
}

function MeasureCard() {
  return (
    <Card title={PLATFORM.measure.title} body={PLATFORM.measure.body}>
      <CallLog />
    </Card>
  );
}
