"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { PLATFORM, platformGreetingKey, type PlatformGreetings } from "@/lib/pages/ai-agents";
import { cueIn, loadCueFile, type Cue, type CueFile } from "@/lib/audio";
import { COMPANY } from "@/lib/site";
import { cn } from "@/lib/utils";
import { isSoundOn } from "@/components/site/audio/engine";
import { showSaid } from "@/components/site/audio/show-said";
import { SoundButton } from "@/components/site/audio/sound-button";
import { useVoiceTrack } from "@/components/site/audio/use-voice-track";
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
 *
 * Sound. One control beside the section's title turns sound on for the
 * three cards that speak, all with AI-generated voices and none before
 * the visitor asks: the greeting is said in its language and tone (the
 * app's own greeting, which says it is an AI), a voice is heard when it
 * is picked, and each document's question and answer are said the first
 * time they come round while the card is on screen.
 * ------------------------------------------------------------------ */

/** What the section's sound control asks of the greeting card: say the greeting on screen (bringing it on screen first). */
type Greeter = { speak: () => void };

export function AgentsPlatform({ greetings }: { greetings: PlatformGreetings }) {
  const greeterRef = useRef<Greeter | null>(null);
  return (
    <>
      <Frame className="flex flex-col gap-5 px-6 pb-10 md:flex-row md:items-end md:justify-between md:px-12 md:pb-12">
        <SectionHeading eyebrow={PLATFORM.eyebrow} className="max-w-[720px]">
          {PLATFORM.title}
        </SectionHeading>
        <SoundButton
          variant="pill"
          tone="light"
          className="shrink-0 md:max-w-[340px] md:justify-end"
          onChange={(on) => {
            if (on) greeterRef.current?.speak();
          }}
        />
      </Frame>
      <Frame className="grid gap-4 px-4 pb-4">
        <DesignCard greeterRef={greeterRef} greetings={greetings} />
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
        // The three-up cards are 520px from xl, as they always were; at lg the columns are narrow enough
        // that the copy and the scenes need more, so there the cards grow rather than clip.
        wide ? "lg:grid lg:h-[480px] lg:grid-cols-[340px_minmax(0,1fr)]" : "lg:min-h-[520px] xl:h-[520px]",
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

/** The stage's claim on the site's one sound (components/site/audio/engine.ts). */
const VOICE_ID = "agents-greeting";
/** A press waits this long at most for its card to come on screen (the scroll it starts, a cue file loading). */
const PRESS_WAIT_MS = 6000;
/** Read: the walk's step. Spoken: the walk moves on this long after the voice has finished. */
const WALK_MS = 2600;
const AFTER_VOICE_MS = 900;

/**
 * The greeting the app writes for this language and tone (lib/voice/greetings.ts, run on the
 * server: ai-agents.server.ts): it says it is an AI.
 */
function greetingOf(greetings: PlatformGreetings, code: string, tone: string) {
  return greetings[platformGreetingKey(code, tone)] ?? "";
}

/** The greeting's clip, where it says the line as shown (one turn, the same display words). */
function greetingCue(greetings: PlatformGreetings, file: CueFile | null, code: string, tone: string): Cue | undefined {
  const cue = file ? cueIn(file, `agents-platform-greeting/${code.toLowerCase()}/${tone}/0`) : undefined;
  const words = greetingOf(greetings, code, tone).split(" ").length;
  return cue && cue.turns.length === 1 && cue.turns[0].words.length === words ? cue : undefined;
}

function DesignCard({
  greeterRef,
  greetings,
}: {
  greeterRef: RefObject<Greeter | null>;
  greetings: PlatformGreetings;
}) {
  const d = PLATFORM.design;
  const ref = useRef<HTMLDivElement>(null);
  /** The greeting as it is said: what the sound control brings on screen. */
  const sayRef = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  // The voice needs the card well on screen, not a sliver of it at an edge.
  const voiceView = useInView(ref, "-15% 0px");
  const reduce = usePrefersReducedMotion();
  const [tone, setTone] = useState(1);
  const [lang, setLang] = useState(0);
  const [touched, setTouched] = useState(false);

  const track = useVoiceTrack(VOICE_ID, { active: voiceView });
  const trackRef = useRef(track);
  useEffect(() => {
    trackRef.current = track;
  });
  /** The greetings' cue file (P1): fetched once sound is on, never before. */
  const [cues, setCues] = useState<CueFile | null>(null);
  const soundOn = track.on;
  useEffect(() => {
    if (!soundOn || cues) return;
    let live = true;
    void loadCueFile("agents-platform-greeting").then((f) => {
      if (live && f) setCues(f);
    });
    return () => {
      live = false;
    };
  }, [soundOn, cues]);
  /** Sound is on and the clips are here: greetings are said, and the walk keeps time with them. */
  const voiced = soundOn && !!cues;
  /** Bumped when the visitor asks for the greeting on screen (a chip, the sound control): it is said again. */
  const [asked, setAsked] = useState(0);
  /** When the visitor last asked (a chip, the sound control): a press is honoured once the card is on screen, if soon. */
  const pressRef = useRef(0);
  /** Spoken: the voice is saying the greeting now (the orb speaks with it). */
  const [saying, setSaying] = useState(false);

  // Walks the pad on its own — a new register, then a new language — until
  // the first click takes it over.
  useEffect(() => {
    if (touched || !inView || reduce || voiced) return;
    const id = window.setInterval(() => {
      setTone((t) => (t + 1) % d.tones.length);
      setLang((l) => (l + 2) % d.langs.length);
    }, WALK_MS);
    return () => window.clearInterval(id);
  }, [touched, inView, reduce, voiced, d.tones.length, d.langs.length]);

  const t = d.tones[tone];
  const greeting = greetingOf(greetings, d.langs[lang].code, t.id);
  const cue = greetingCue(greetings, cues, d.langs[lang].code, t.id);

  // With sound on, each greeting is said as it comes in. On the walk, the
  // next one comes 900ms after the voice ends (2600ms if it has no clip);
  // after the first click, only the greetings the visitor picks are said.
  useEffect(() => {
    if (!voiced || !voiceView) return;
    const walking = !touched && !reduce;
    // A press still waiting for the card (scrolled to it, or its clips loading) is said once it is here.
    const press = pressRef.current > 0 && performance.now() - pressRef.current < PRESS_WAIT_MS;
    pressRef.current = 0;
    if (!walking && !press) return;
    let timer = 0;
    let raf = 0;
    const step = () => {
      setTone((x) => (x + 1) % d.tones.length);
      setLang((x) => (x + 2) % d.langs.length);
    };
    if (!cue) {
      if (walking) timer = window.setTimeout(step, WALK_MS);
      return () => window.clearTimeout(timer);
    }
    const after = greetingCue(
      greetings,
      cues,
      d.langs[(lang + 2) % d.langs.length].code,
      d.tones[(tone + 1) % d.tones.length].id,
    );
    trackRef.current.play(cue, 0, { press, next: walking ? after : undefined });
    const { start, end } = cue.turns[0];
    let was = false;
    const frame = () => {
      const now = trackRef.current.time();
      const over = now >= end;
      const is = !over && now >= start;
      if (is !== was) {
        was = is;
        setSaying(is);
      }
      if (over) {
        if (walking) timer = window.setTimeout(step, AFTER_VOICE_MS);
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      setSaying(false);
    };
  }, [voiced, voiceView, touched, reduce, tone, lang, asked, cue, cues, greetings, d.tones, d.langs]);

  /** The visitor asked for a greeting (a chip, or sound turned on): say it, if sound is on. */
  const ask = () => {
    if (!isSoundOn()) return;
    pressRef.current = performance.now();
    setAsked((n) => n + 1);
  };
  /**
   * Sound turned on with the section's control: the greeting on screen is
   * said. On a phone the control sits above the card, whose greeting may
   * still be below the fold; it is brought on screen first, by the least
   * scroll that shows it and with the control kept on screen where both
   * fit, so the visitor sees the words as they are said (with the greeting
   * on screen, the card is in the band the voice needs), and the press
   * waits for it.
   */
  const speak = () => {
    if (!isSoundOn()) return;
    showSaid(sayRef.current, reduce);
    ask();
  };
  useEffect(() => {
    greeterRef.current = { speak };
  });

  return (
    <Card title={d.title} body={d.body} wide>
      <div
        ref={ref}
        className="relative mt-8 ml-7 flex min-h-[440px] flex-1 sm:min-h-[400px] md:min-h-[360px] lg:mt-10 lg:ml-0 lg:min-h-0"
      >
        {/* Below lg the window sits in the flow, so the card grows to hold all of it (a phone wraps the
            greeting and the chips onto more lines than the reserve allows); from lg it fills the fixed card. */}
        <div className="absolute inset-0 flex overflow-hidden rounded-tl-2xl bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_12px_32px_-12px_rgb(0_0_0/0.12)] max-lg:relative max-lg:flex-1">
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
            <div ref={sayRef} className="mt-2 flex items-start gap-3 rounded-2xl border border-pp-hair p-3">
              <Orb
                mesh={ORB_MESHES.violet}
                // With sound on it speaks while the voice does; read, while the walk runs.
                speaking={voiced ? saying : inView && !reduce}
                className="mt-0.5 size-7 shrink-0"
              />
              <p
                key={`${tone}-${lang}`}
                lang={d.langs[lang].code.toLowerCase()}
                className="min-h-[40px] text-[14px] leading-5 animate-in fade-in-0 slide-in-from-bottom-1 duration-500"
              >
                {greeting}
              </p>
            </div>

            <p className="mt-5 text-[11px] text-pp-muted">{d.tone}</p>
            {/* On touch the chips take 44px taps (tap-44); the wider gaps keep one chip's tap off the next. */}
            <div className="mt-2 flex flex-wrap gap-1.5 any-pointer-coarse:gap-x-3 any-pointer-coarse:gap-y-4">
              {d.tones.map((x, i) => (
                <Chip
                  key={x.id}
                  on={i === tone}
                  onClick={() => {
                    setTouched(true);
                    setTone(i);
                    ask();
                  }}
                  title={x.blurb}
                >
                  {x.label}
                </Chip>
              ))}
            </div>

            <p className="mt-5 text-[11px] text-pp-muted">{d.language}</p>
            <div className="mt-2 flex flex-wrap gap-1.5 any-pointer-coarse:gap-x-3 any-pointer-coarse:gap-y-4">
              {d.langs.map((x, i) => (
                <Chip
                  key={x.code}
                  on={i === lang}
                  onClick={() => {
                    setTouched(true);
                    setLang(i);
                    ask();
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
        "tap-44 relative h-7 rounded-full px-2.5 text-[12px] transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-pp-ink",
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
