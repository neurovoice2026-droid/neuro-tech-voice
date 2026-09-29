"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import { Pause, Play, RotateCcw } from "lucide-react";
import { AGENTS_HERO, REEL, type ReelScene } from "@/lib/pages/ai-agents";
import { AUTH } from "@/lib/site";
import { cn } from "@/lib/utils";
import { IntentLink } from "@/components/site/intent-link";
import { Orb, PillLink, SectionTitle } from "../primitives";
import { gradientPoster, NeatBackdrop, paletteByLuma, SCENE_GRADIENTS } from "./neat-backdrop";
import { holdFor, useInView, usePrefersReducedMotion } from "../timing";

/* ------------------------------------------------------------------ *
 * The cover of the page: a centred headline over a hand of four calls.
 *
 * The calls are dealt as a fan of cards, each lit like a room at the hour
 * its call comes in. Pointing at one lifts it out of the hand and parts
 * its neighbours; choosing it brings it to the front, where it plays its
 * conversation through to what the agent did about it. The hand plays
 * itself card by card until the visitor picks one.
 *
 * The hand is dealt from lg up, shrunk to fit narrower screens down to
 * that; below it the open card stands alone, with the others as chips.
 * ------------------------------------------------------------------ */

/** Card size and the distance between card centres in the fan, in px. */
const CARD = { w: 440, h: 548 };
const SLOT = 236;

/**
 * How far the fan is shrunk: 1 wherever the column is 1180px or wider,
 * proportionally less below. `tan(atan2(a, b))` is a/b as a plain number —
 * CSS will not divide one length by another directly — so the fan sizes
 * in the first paint, with no measuring script and no jump.
 */
const DECK_SCALE = "min(1, tan(atan2(100vw - 5rem, 1180px)))";

const spring = { type: "spring", stiffness: 170, damping: 22, mass: 0.9 } as const;

/** Where card `i` sits in a hand of `n`, when card `focus` is the one held up. */
function fan(i: number, focus: number, n: number) {
  const off = i - (n - 1) / 2;
  const d = i - focus;
  const part = d === 0 ? 0 : Math.sign(d) * (54 - (Math.min(Math.abs(d), 3) - 1) * 14);
  return {
    x: off * SLOT + part,
    y: Math.abs(off) * 24 + (d === 0 ? -28 : 0),
    rotate: d === 0 ? 0 : off * 3.4 + Math.sign(d) * 1.6,
    scale: d === 0 ? 1.03 : 0.94,
    zIndex: 20 - Math.abs(d),
  };
}

export function AgentsHero() {
  return (
    <section className="mx-auto w-[calc(100%-2rem)] max-w-[1176px] pt-28 sm:w-[calc(100%-3rem)] md:pt-[148px] lg:w-[calc(100%-5rem)]">
      <div className="mx-auto flex max-w-[820px] flex-col items-center text-center">
        <SectionTitle as="h1" className="max-w-[760px]">
          {AGENTS_HERO.title}
        </SectionTitle>
        <p className="mt-5 max-w-[600px] text-base leading-6 tracking-[0.01em] text-pp-ink/80 md:text-[17px] md:leading-[26px]">
          {AGENTS_HERO.sub}
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          <PillLink href={AGENTS_HERO.primary.href}>{AGENTS_HERO.primary.label}</PillLink>
          <PillLink href={AGENTS_HERO.secondary.href} variant="secondary">
            {AGENTS_HERO.secondary.label}
          </PillLink>
        </div>
        <p className="mt-3 text-[13px] leading-[18px] text-pp-muted">{AGENTS_HERO.note}</p>
      </div>

      <Hand />
    </section>
  );
}

function Hand() {
  const scenes = REEL.scenes;
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef);
  const reduce = usePrefersReducedMotion();

  const [active, setActive] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  /** Turns shown so far; `turns.length + 1` means the outcome is up too. */
  const [step, setStep] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const [paused, setPaused] = useState(false);

  const scene = scenes[active];
  const done = step > scene.turns.length;
  const running = inView && !paused && !reduce;

  useEffect(() => {
    if (!running) return;
    const n = scene.turns.length;
    let delay: number;
    if (step === 0) delay = 800;
    else if (step <= n) delay = holdFor(scene.turns[step - 1].t);
    // While a card is under the pointer it stays up, outcome showing.
    else if (autoplay && hover === null) delay = 2600;
    else return;

    const id = window.setTimeout(() => {
      if (step <= n) setStep(step + 1);
      else {
        setActive((active + 1) % scenes.length);
        setStep(0);
      }
    }, delay);
    return () => window.clearTimeout(id);
  }, [running, step, active, autoplay, hover, scene, scenes.length]);

  // Reduced motion: no clock at all, the open card simply reads complete.
  const shown = reduce ? scene.turns.length + 1 : step;
  const focus = hover ?? active;

  const open = (i: number) => {
    setAutoplay(false);
    setPaused(false);
    if (i === active) return;
    setActive(i);
    setStep(1);
  };

  // Pointing at a card plays its call on it straight away, first line up.
  const preview = (i: number) => {
    setHover(i);
    if (i === active) return;
    setPaused(false);
    setActive(i);
    setStep(1);
  };

  const toggle = () => {
    if (done && !autoplay) {
      setStep(0);
      setPaused(false);
      return;
    }
    setPaused((p) => !p);
  };

  return (
    <div ref={rootRef} className="mt-10 max-lg:mx-auto max-lg:max-w-[560px] md:mt-12">
      <div
        role="group"
        aria-roledescription="carousel"
        aria-label={REEL.kicker}
        onPointerLeave={() => setHover(null)}
        style={{ "--deck": DECK_SCALE } as CSSProperties}
        className="relative lg:h-[calc(640px*var(--deck))]"
      >
        <div className="lg:absolute lg:inset-x-0 lg:top-0 lg:h-[640px] lg:origin-top lg:[scale:var(--deck)]">
          {scenes.map((s, i) => {
            const isOpen = i === active;
            const place = fan(i, focus, scenes.length);
            return (
              <motion.div
                key={s.id}
                initial={false}
                animate={{ x: place.x, y: place.y, rotate: place.rotate, scale: place.scale }}
                transition={reduce ? { duration: 0 } : spring}
                onPointerEnter={(e) => {
                  if (e.pointerType === "mouse") preview(i);
                }}
                style={{ zIndex: place.zIndex, transformOrigin: "50% 115%", width: CARD.w, height: CARD.h }}
                className={cn(
                  "overflow-hidden rounded-[28px] shadow-[0_30px_60px_-30px_rgb(24_16_40/0.55),0_0_0_1px_rgb(255_255_255/0.06)]",
                  // Desktop: dealt from the middle of the stage. Smaller screens:
                  // the open card alone, full width, no fan.
                  "lg:absolute lg:top-6 lg:left-1/2 lg:-ml-[220px]",
                  "max-lg:relative max-lg:h-[480px]! max-lg:w-full! max-lg:transform-none!",
                  !isOpen && "max-lg:hidden",
                )}
              >
                <Light scene={s} />

                {isOpen ? (
                  <OpenCard
                    key={s.id}
                    scene={s}
                    shown={shown}
                    onToggle={toggle}
                    paused={paused || reduce}
                    done={done && !autoplay}
                    progress={autoplay && !reduce ? { index: i, count: scenes.length } : null}
                  />
                ) : (
                  <ClosedCard
                    scene={s}
                    lifted={hover === i}
                    // A card under the hand shows only the edge beside the held
                    // card, so its content hugs that edge.
                    side={i > focus ? "right" : "left"}
                    onOpen={() => open(i)}
                  />
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Below lg the hand is one card wide; these pick the others. */}
      <div className="mt-3 grid grid-cols-2 gap-2 lg:hidden">
        {scenes.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => open(i)}
            aria-pressed={i === active}
            className={cn(
              "h-10 rounded-full px-3 text-[13px] transition-colors",
              i === active ? "bg-pp-ink text-white" : "bg-pp-card text-pp-ink",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The orb takes its colours from the card it sits on. */
function orbMesh(scene: ReelScene) {
  const gradient = SCENE_GRADIENTS[scene.id];
  return gradient ? paletteByLuma(gradient) : undefined;
}

/** The room the call happens in: a Neat gradient, or three lights and grain. */
function Light({ scene }: { scene: ReelScene }) {
  const gradient = SCENE_GRADIENTS[scene.id];
  if (gradient) {
    return (
      <div aria-hidden className="absolute inset-0" style={{ background: gradientPoster(gradient) }}>
        <NeatBackdrop config={gradient} />
      </div>
    );
  }

  const [shadow, body, highlight] = scene.light;
  return (
    <div
      aria-hidden
      className="absolute inset-0"
      style={{
        background: `radial-gradient(120% 90% at 78% 12%, ${highlight}cc 0%, transparent 42%),
          radial-gradient(90% 80% at 18% 100%, ${body} 0%, transparent 70%),
          ${shadow}`,
      }}
    >
      <div className="pp-grain absolute inset-0 opacity-40" />
    </div>
  );
}

function CardHeader({ scene }: { scene: ReelScene }) {
  return (
    <div className="flex items-start justify-between gap-3 p-5">
      <p className="pp-display text-[21px] leading-[26px] text-white" style={{ fontWeight: 480 }}>
        {scene.label}
      </p>
      <span className="shrink-0 rounded-full bg-black/25 px-2.5 py-1 text-[11px] leading-4 text-white/85 backdrop-blur-md">
        {scene.time}
      </span>
    </div>
  );
}

/** A card still in the hand: what the call is, and what came of it. */
function ClosedCard({
  scene,
  lifted,
  side,
  onOpen,
}: {
  scene: ReelScene;
  lifted: boolean;
  side: "left" | "right";
  onOpen: () => void;
}) {
  const right = side === "right";
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group absolute inset-0 flex flex-col p-5 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white",
        right ? "items-end text-right" : "items-start text-left",
      )}
    >
      <span className={cn("flex w-[200px] flex-col gap-1.5", right ? "items-end" : "items-start")}>
        <span className="rounded-full bg-black/25 px-2.5 py-1 text-[11px] leading-4 text-white/85 backdrop-blur-md">
          {scene.time}
        </span>
        <span className="pp-display text-[21px] leading-[26px] text-white" style={{ fontWeight: 480 }}>
          {scene.label}
        </span>
      </span>

      <span className={cn("flex w-[200px] flex-1 items-center", right ? "justify-end pr-10" : "justify-start pl-10")}>
        <Orb
          mesh={orbMesh(scene)}
          className={cn(
            "size-24 transition-[scale,opacity] duration-500",
            lifted ? "scale-110 opacity-100" : "opacity-80",
          )}
        />
      </span>

      <span className={cn("flex w-[200px] flex-col gap-3", right ? "items-end" : "items-start")}>
        <span
          className={cn(
            "rounded-full bg-white px-3 py-1.5 text-[12px] leading-4 text-pp-ink transition-[opacity,translate] duration-300",
            lifted ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
          )}
        >
          {REEL.pick}
        </span>
        <span className={cn("flex items-start gap-2 text-[13px] leading-[18px] text-white/85", right && "flex-row-reverse")}>
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#7ee2a8]" />
          {scene.outcome}
        </span>
      </span>
    </button>
  );
}

/** The card held up: the call, played. */
function OpenCard({
  scene,
  shown,
  paused,
  done,
  progress,
  onToggle,
}: {
  scene: ReelScene;
  shown: number;
  paused: boolean;
  done: boolean;
  progress: { index: number; count: number } | null;
  onToggle: () => void;
}) {
  const said = Math.min(shown, scene.turns.length);
  const turns = scene.turns.slice(0, said);
  const last = turns[turns.length - 1];
  // The card holds three lines and the outcome; older lines fall away.
  const from = Math.max(0, said - 3);
  const speaking = !!last && last.sp === "agent" && shown <= scene.turns.length && !paused;
  const outcome = shown > scene.turns.length;

  return (
    <div className="absolute inset-0 flex flex-col animate-in fade-in-0 duration-300 fill-mode-both">
      <CardHeader scene={scene} />

      <div className="pointer-events-none flex justify-center pt-1">
        <Orb mesh={orbMesh(scene)} speaking={speaking} className="size-[96px] sm:size-[120px]" />
      </div>

      <ol aria-live="polite" className="flex min-h-0 flex-1 flex-col justify-end gap-2 px-5 pt-4">
        {turns.slice(from).map((turn, j, shown) => (
          <li
            key={from + j}
            className={cn(
              "w-fit max-w-[88%] rounded-[16px] px-3 py-2 text-[13px] leading-[18px] animate-in fade-in-0 slide-in-from-bottom-2 duration-500",
              turn.sp === "agent" ? "bg-white text-pp-ink" : "ml-auto bg-white/15 text-white backdrop-blur-md",
              // A phone-width card wraps every line twice over: two lines fit under the orb, not three.
              j === 0 && shown.length === 3 && "max-sm:hidden",
            )}
          >
            <Words text={turn.t} live={from + j === said - 1} />
          </li>
        ))}
        <li
          className={cn(
            "mt-1 flex w-fit items-center gap-2 rounded-full bg-black/35 px-3 py-1.5 text-[12px] leading-4 text-white backdrop-blur-md transition-[opacity,translate] duration-500",
            outcome ? "opacity-100" : "translate-y-1 opacity-0",
          )}
          aria-hidden={!outcome}
        >
          <span className="size-1.5 rounded-full bg-[#7ee2a8]" />
          {scene.outcome}
        </li>
      </ol>

      <div className="flex items-center justify-between gap-3 p-5">
        <IntentLink
          href={AUTH.signup}
          className="text-[13px] leading-[18px] text-white/80 underline-offset-4 transition-colors hover:text-white hover:underline"
        >
          {scene.link} →
        </IntentLink>
        <button
          type="button"
          onClick={onToggle}
          aria-label={done ? REEL.replay : paused ? REEL.play : REEL.pause}
          className="grid size-9 shrink-0 place-items-center rounded-full bg-black/30 text-white backdrop-blur-md transition-colors hover:bg-black/50 focus-visible:outline-2 focus-visible:outline-white"
        >
          {done ? (
            <RotateCcw className="size-4" />
          ) : paused ? (
            <Play className="size-4 fill-current" />
          ) : (
            <Pause className="size-4 fill-current" />
          )}
        </button>
      </div>

      {progress && (
        <div aria-hidden className="absolute inset-x-5 bottom-2 flex gap-1">
          {Array.from({ length: progress.count }, (_, i) => (
            <span
              key={i}
              className={cn("h-[2px] flex-1 rounded-full", i === progress.index ? "bg-white/80" : "bg-white/20")}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** The newest line arrives a word at a time; older lines are already settled. */
function Words({ text, live }: { text: string; live: boolean }) {
  if (!live) return <>{text}</>;
  return (
    <>
      {text.split(" ").map((w, i) => (
        <span
          key={i}
          className="animate-in fade-in-0 fill-mode-both duration-300"
          style={{ animationDelay: `${i * 45}ms` } as CSSProperties}
        >
          {w}{" "}
        </span>
      ))}
    </>
  );
}
