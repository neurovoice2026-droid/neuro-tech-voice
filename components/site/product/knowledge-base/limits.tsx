"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { gsap } from "gsap";
import { Pause, Play } from "lucide-react";
import { cueIn, loadCueFile, type Cue } from "@/lib/audio";
import { KB_SOUND, LIMITS } from "@/lib/pages/knowledge-base";
import { LIMITS_FALLBACK, LIMITS_TRACKS, sayingOf, type PassBeat } from "@/lib/pages/knowledge-base-voice";
import { SoundButton } from "@/components/site/audio/sound-button";
import { INK, LINE, MUTED, Node, Ping, ping, svgProps, useLoop, useSvgId, VIOLET, type Motion } from "../line-figure";
import { useMotionKit } from "../motion-kit";
import { Frame, Rule, SectionHeading } from "../primitives";
import { useInView, usePrefersReducedMotion } from "../timing";
import {
  loadLate,
  NO_REQUEST,
  useListen,
  usePassVoice,
  useSpokenPass,
  type PassRequest,
  type PassVoice,
} from "./meaning";

/* ------------------------------------------------------------------ *
 * Where the documents stop.
 *
 * A question arrives on the left. A sweep passes over five documents and
 * each rises to how well it matches — every one of them short of the
 * dotted line marked "close enough to answer". The route up to "Answer"
 * starts, falters and breaks off; a second route bends down instead and
 * lands on "Message for the team", which rings.
 *
 * Sound. The question and the fallback line can be heard (AI-generated
 * voices; the reading room's clips for the same question, fetched only
 * once sound is on). With sound on, the first round each time the figure
 * comes into view is spoken: the caller asks as the question arrives, and
 * the fallback line is said as the route lands, the figure holding its
 * ending until it has been. Later rounds are silent. With reduced motion
 * the figure stays still and Listen plays both lines, each label marked
 * while it is said.
 * ------------------------------------------------------------------ */

/** The stage's claim on the site's one sound (components/site/audio/engine.ts). */
const VOICE_ID = "kb-limits";
/** On the figure's timeline: the question arrives, the route lands on the fallback, the round starts to fade. */
const ASK_AT = 0.1;
const LAND_AT = 4.4;
const FADE_AT = 6.4;

const NONE: readonly Cue[] = [];

/** The question and the fallback line, each said as shown: from this figure's own cue file, or else the reading room's (the same clips). */
async function loadLines(): Promise<[Cue, Cue] | null> {
  for (const t of LIMITS_TRACKS) {
    const file = t.surface === "kb-hero-reading-room" ? await loadCueFile(t.surface) : await loadLate(t.surface);
    const ask = file ? cueIn(file, t.ask) : undefined;
    const answer = file ? cueIn(file, t.answer) : undefined;
    if (ask && answer && sayingOf(ask, LIMITS_FALLBACK.ask, "caller") && sayingOf(answer, LIMITS_FALLBACK.answer, "agent")) {
      return [ask, answer];
    }
  }
  return null;
}

/**
 * Label sizes, in the drawing's own units. On a phone the drawing is shown
 * at about half size, so its labels are drawn larger there to stay legible.
 */
const LABEL = "text-[14px] tracking-[0.01em] max-sm:text-[19px]";
const SMALL = "text-[12px] tracking-[0.01em] max-sm:text-[16px]";

const W = 600;
/** The part of the drawing that has anything in it. */
const VIEW = "0 50 600 270";
const Q = { x: 36, y: 196 };
const BASE = 262;
const TALL = 150;
const THRESHOLD = 0.6;
const LINE_Y = BASE - TALL * THRESHOLD;
const BARS = [0.22, 0.14, 0.1, 0.3, 0.26].map((m, i) => ({ x: 128 + i * 58, m }));
const SWEEP = { from: 104, to: 384 };
const ANSWER = { x: 548, y: 90 };
const MESSAGE = { x: 548, y: 244 };
const FROM = { x: 404, y: 196 };
const TO_ANSWER = `M${FROM.x} ${FROM.y} C${FROM.x + 70} ${FROM.y} ${ANSWER.x - 60} ${ANSWER.y} ${ANSWER.x} ${ANSWER.y}`;
const TO_MESSAGE = `M${FROM.x} ${FROM.y} C${FROM.x + 70} ${FROM.y} ${MESSAGE.x - 70} ${MESSAGE.y} ${MESSAGE.x} ${MESSAGE.y}`;

export function KbLimits() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, "-10% 0px");
  const near = useInView(ref, "25% 0px");
  const reduce = usePrefersReducedMotion();
  const kit = useMotionKit(near && !reduce);

  /* ─── Sound ──────────────────────────────────────────────────────── */
  const { track, voice } = usePassVoice(VOICE_ID, inView);
  /** The two lines' clips: undefined until fetched (sound on), null without ones that fit. */
  const [lines, setLines] = useState<[Cue, Cue] | null | undefined>(undefined);
  useEffect(() => {
    if (!track.on || lines !== undefined) return;
    let live = true;
    void loadLines().then((l) => {
      if (live) setLines(l);
    });
    return () => {
      live = false;
    };
  }, [track.on, lines]);
  const beats = useMemo<PassBeat[]>(
    () =>
      lines
        ? [
            { at: ASK_AT, cue: lines[0] },
            { at: LAND_AT, cue: lines[1], hold: FADE_AT },
          ]
        : [],
    [lines],
  );
  const [request, setRequest] = useState<PassRequest>(NO_REQUEST);
  const listen = useListen(track, lines === undefined ? undefined : (lines ?? NONE), inView);

  // Sound turned on here: the round starts again, spoken (Listen, with reduced motion).
  const onSound = (on: boolean) => {
    if (!on) return;
    if (reduce) listen.soundOn();
    else setRequest((r) => ({ n: r.n + 1, key: "limits", press: true }));
  };

  return (
    <>
      <Frame className="px-6 pb-10 md:px-12 md:pb-14">
        <SectionHeading eyebrow={LIMITS.eyebrow} className="max-w-[720px]">
          {LIMITS.title}
        </SectionHeading>
      </Frame>
      <Rule />
      <Frame className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:divide-x lg:divide-pp-rule">
        <div ref={ref} className="w-full self-center px-4 py-8 md:px-8 lg:py-12">
          <div className="aspect-[600/270] w-full">
            <Figure
              kit={kit}
              play={inView && !reduce}
              still={reduce}
              beats={beats}
              voice={voice}
              request={request}
              saying={listen.at}
            />
          </div>
          {track.on && (
            // With sound on the fallback line is said: here is its transcript, the caption of the node it lands on.
            <p className="mt-3 text-[13px] leading-5 text-pp-muted">
              <span className={listen.at === 1 ? "text-[#551a89]" : "text-pp-ink"}>{LIMITS.figure.message}:</span>{" "}
              “{LIMITS_FALLBACK.answer}”
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {reduce && lines !== null && (
              // Reduced motion: the figure stays still; Listen says the question and the fallback line.
              <button
                type="button"
                onClick={listen.toggle}
                className="pp-shadow-btn relative inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-white px-3.5 text-sm text-pp-ink transition-colors before:absolute before:inset-x-0 before:-inset-y-1 hover:bg-pp-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink"
              >
                {listen.playing ? <Pause className="size-3.5 fill-current" /> : <Play className="size-3.5 fill-current" />}
                {listen.playing ? KB_SOUND.pause : KB_SOUND.listen}
              </button>
            )}
            <SoundButton variant="pill" tone="light" onChange={onSound} />
          </div>
        </div>
        <div className="flex flex-col border-t border-pp-rule lg:border-t-0">
          <ul className="grid flex-1 sm:grid-cols-2">
            {LIMITS.points.map((p, i) => (
              <li
                key={p.id}
                className={
                  "border-pp-rule px-6 py-8 md:px-10 " +
                  (i < 2 ? "border-b " : "max-sm:border-b ") +
                  (i % 2 === 0 ? "sm:border-r" : "")
                }
              >
                <h3 className="text-[15px] leading-[22px]">{p.title}</h3>
                <p className="text-[15px] leading-[22px] text-pp-muted">{p.body}</p>
              </li>
            ))}
          </ul>
          <p className="border-t border-pp-rule px-6 py-6 text-[13px] leading-5 text-pp-muted md:px-10">{LIMITS.honest}</p>
        </div>
      </Frame>
      <Rule />
    </>
  );
}

function Figure({
  kit,
  play,
  still,
  beats,
  voice,
  request,
  saying,
}: Motion & {
  /** Sound on: the two clips, where they are said on the timeline. */
  beats: readonly PassBeat[];
  voice: PassVoice;
  request: PassRequest;
  /** Listen (reduced motion): the line being said, 0 the question, 1 the fallback; -1 for none. */
  saying: number;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const clip = useSvgId("limits-clip");
  const f = LIMITS.figure;

  useLoop(
    svg,
    (tl, q) => {
      tlRef.current = tl;
      const bars = q(".lim-bar");
      const sweep = q(".lim-sweep");
      const answerRoute = q(".lim-to-answer")[0];
      const messageRoute = q(".lim-to-message")[0];
      const traveller = q(".lim-traveller");
      const breakMark = q(".lim-break");

      tl.set(bars, { attr: { y: BASE, height: 0 } }, 0)
        .set(sweep, { attr: { x1: SWEEP.from, x2: SWEEP.from }, opacity: 0 }, 0)
        .set([answerRoute, messageRoute], { drawSVG: "0% 0%", opacity: 1 }, 0)
        .set(traveller, { opacity: 0 }, 0)
        .set(breakMark, { opacity: 0, scale: 0.5, transformOrigin: "50% 50%" }, 0)
        .set(q(".lim-message-core"), { attr: { fill: "var(--pp-bg)" } }, 0);

      ping(tl, q(".lim-q-ping"), ASK_AT, 26);
      // The sweep reads across; each document rises as it is passed.
      tl.to(sweep, { opacity: 1, duration: 0.2 }, 0.5).to(
        sweep,
        { attr: { x1: SWEEP.to, x2: SWEEP.to }, duration: 1.6, ease: "sine.inOut" },
        0.5,
      );
      BARS.forEach((b, i) => {
        tl.to(
          bars[i],
          { attr: { y: BASE - TALL * b.m, height: TALL * b.m }, duration: 0.6, ease: "power3.out" },
          0.55 + ((b.x - SWEEP.from) / (SWEEP.to - SWEEP.from)) * 1.6,
        );
      });
      tl.to(sweep, { opacity: 0, duration: 0.3 }, 2.1)
        // Up towards an answer — and it breaks off.
        .to(answerRoute, { drawSVG: "0% 42%", duration: 0.7, ease: "power2.out" }, 2.3)
        .to(breakMark, { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(2.4)" }, 2.95)
        .to(answerRoute, { opacity: 0.25, duration: 0.5 }, 3.2)
        // Down to the team instead.
        .to(messageRoute, { drawSVG: "0% 100%", duration: 1, ease: "power2.inOut" }, 3.4)
        .to(traveller, { opacity: 1, duration: 0.2 }, 3.4)
        .to(traveller, { duration: 1, ease: "power2.inOut", motionPath: { path: messageRoute as SVGPathElement } }, 3.4)
        .set(q(".lim-message-core"), { attr: { fill: VIOLET } }, LAND_AT)
        .to(traveller, { opacity: 0, duration: 0.25 }, LAND_AT);
      ping(tl, q(".lim-message-ping"), LAND_AT, 30);
      tl.to([answerRoute, messageRoute, breakMark], { opacity: 0, duration: 0.6 }, FADE_AT)
        .to(bars, { attr: { y: BASE, height: 0 }, duration: 0.6, ease: "power2.in" }, FADE_AT)
        .to({}, { duration: 0.4 });
    },
    { kit, play, still },
  );
  // Sound on: the first round of each entry into view is said, the figure following each clip.
  useSpokenPass(tlRef, { figure: "limits", play, kit, beats, voice, request });

  return (
    <svg ref={svg} {...svgProps(W, 250)} viewBox={VIEW}>
      <defs>
        <clipPath id={clip}>
          <rect x="0" y="0" width={W} height={BASE} />
        </clipPath>
      </defs>

      {/* The question */}
      <text x={Q.x - 20} y={Q.y - 62} fill={saying === 0 ? VIOLET : INK} className={LABEL}>
        {f.question}
      </text>
      <line x1={Q.x} x2={SWEEP.from} y1={Q.y} y2={Q.y} stroke={INK} strokeOpacity="0.3" strokeWidth={LINE} strokeDasharray="0.01 4.6" strokeLinecap="round" />
      <Ping className="lim-q-ping" x={Q.x} y={Q.y} />
      <Node x={Q.x} y={Q.y} />

      {/* Five documents, and the line a match must reach */}
      <line x1={SWEEP.from} x2={SWEEP.to} y1={BASE} y2={BASE} stroke={INK} strokeOpacity="0.3" strokeWidth={LINE} strokeLinecap="round" />
      {BARS.map((b, i) => (
        <g key={i}>
          <rect x={b.x - 12} y={BASE - TALL} width="24" height={TALL} rx="3" fill={INK} fillOpacity="0.03" />
          <rect
            className="lim-bar"
            x={b.x - 12}
            y={BASE - TALL * b.m}
            width="24"
            height={TALL * b.m}
            rx="3"
            fill={VIOLET}
            fillOpacity="0.55"
            clipPath={`url(#${clip})`}
          />
          <text
            x={b.x + 4}
            y={BASE + 16}
            textAnchor="end"
            transform={`rotate(-32 ${b.x + 4} ${BASE + 16})`}
            fill={MUTED}
            className={SMALL}
          >
            {f.docs[i]}
          </text>
        </g>
      ))}
      <line x1={SWEEP.from - 8} x2={SWEEP.to + 8} y1={LINE_Y} y2={LINE_Y} stroke={INK} strokeWidth={LINE} strokeDasharray="0.01 4.6" strokeLinecap="round" />
      <text x={SWEEP.from} y={LINE_Y - 12} fill={MUTED} className={LABEL}>
        {f.threshold}
      </text>
      <line className="lim-sweep" x1={SWEEP.from} x2={SWEEP.from} y1={BASE - TALL - 6} y2={BASE} stroke={VIOLET} strokeWidth={LINE} opacity="0" />

      {/* Two ways on */}
      <path d={TO_ANSWER} stroke={INK} strokeOpacity="0.14" strokeWidth={LINE} strokeDasharray="0.01 4.6" strokeLinecap="round" />
      {/* At rest (and before the motion loads) the figure shows its ending. */}
      <path className="lim-to-answer" d={TO_ANSWER} stroke={INK} strokeWidth={LINE} strokeLinecap="round" opacity="0" />
      <g className="lim-break">
        <line x1="464" x2="476" y1="144" y2="156" stroke="#e0663a" strokeWidth={LINE * 1.2} strokeLinecap="round" />
        <line x1="476" x2="464" y1="144" y2="156" stroke="#e0663a" strokeWidth={LINE * 1.2} strokeLinecap="round" />
      </g>
      <Node x={ANSWER.x} y={ANSWER.y} hollow />
      <text x={ANSWER.x} y={ANSWER.y - 22} textAnchor="middle" fill={MUTED} className={LABEL}>
        {f.answer}
      </text>

      <path d={TO_MESSAGE} stroke={INK} strokeOpacity="0.14" strokeWidth={LINE} strokeDasharray="0.01 4.6" strokeLinecap="round" />
      <path className="lim-to-message" d={TO_MESSAGE} stroke={VIOLET} strokeWidth={LINE} strokeLinecap="round" />
      <Ping className="lim-message-ping" x={MESSAGE.x} y={MESSAGE.y} color={VIOLET} />
      <Node x={MESSAGE.x} y={MESSAGE.y} color={VIOLET} coreClassName="lim-message-core" />
      <text x={MESSAGE.x} y={MESSAGE.y + 34} textAnchor="end" fill={saying === 1 ? VIOLET : INK} className={LABEL}>
        {f.message}
      </text>
      <Node className="lim-traveller" hidden r={3.4} color={VIOLET} />
      <circle cx={FROM.x} cy={FROM.y} r="3" fill={INK} />
    </svg>
  );
}
