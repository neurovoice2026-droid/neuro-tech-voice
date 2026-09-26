"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Fragment,
  type Dispatch,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from "react";
import type { gsap } from "gsap";
import { RotateCcw } from "lucide-react";
import {
  SETUP_LANGS,
  SETUP_VOICES,
  TONES,
  greetingFor,
  type SetupLang,
  type SetupVoice,
  type Tone,
} from "@/lib/site";
import { cn } from "@/lib/utils";
import { useKitContext, useMotionKit } from "./product/motion-kit";
import { Frame, SectionHeading } from "./product/primitives";
import { holdFor, useInView, usePrefersReducedMotion } from "./product/timing";

/**
 * Register — the three settings that decide what a caller actually hears.
 *
 * THE SIGNATURE MOVEMENT is one hand crossing one plane and one voice
 * reading what the crossing wrote. It is a single GSAP timeline per
 * utterance, and it runs in three joined beats:
 *
 *   1. **The hand travels.** The puck is not repositioned; it goes. It
 *      follows a drawn route from the tone it was on to the tone it is
 *      going to — bowed a little off the straight line, because a hand
 *      crossing a plane arcs, and a straight lerp between two points is
 *      exactly the "six presets" reading this section exists to refuse —
 *      and it leaves a violet trail behind it, drawn stroke-first so the
 *      route appears *because* the hand went that way. Its duration is the
 *      route's own length over a constant speed: a long move across the
 *      register takes longer than a short one, which is the whole claim
 *      that register is a distance rather than a list.
 *   2. **The gate flashes as the hand passes it.** Both axes threshold at
 *      the midpoint — `relaxed > 0.5` picks the opening formula, `warm >
 *      0.5` picks the offer — so the two centre lines of the plane are not
 *      grid, they are gates. The one that is crossed lights violet at the
 *      instant the puck is over it, which is found by inverting the
 *      travel's ease rather than by halving its clock. That flash is the
 *      cause; everything in the next beat is its effect.
 *   3. **The voice reads the result.** The greeting inks left to right at
 *      the chosen voice's own words per minute, the violet fill crosses
 *      that voice's signature on the same clock, the playhead travels with
 *      it — and every word the gate rewrote rises into place *under the
 *      head as it reaches that word*. Words the gate left alone simply
 *      ink. So the reader watches the sentence being written, and the only
 *      words that are written are the ones the move was responsible for.
 *
 * Why that and not six separate effects. Every one of those parts existed
 * before as its own CSS transition, fed the same numbers and therefore in
 * step only by coincidence: the puck eased on `transition-[left,top]`, the
 * trail did not exist, the rewritten words ran an `animate-in` on a React
 * remount, the sweep ran a `clip-path` transition, and each word's colour
 * flipped on a hand-computed `transitionDelay`. Four clocks that agreed is
 * not one movement, and next to a page whose figures are single timelines
 * it read as four things happening near each other. It is now one object:
 * the hand causes the gate, the gate causes the rewrite, and the reading
 * is what delivers it.
 *
 * THE TOUR. The section answers the same phone four times over, for four
 * different businesses, while you watch. The order is the argument:
 *
 *   1. **Professional · English · Sarah.** The resting frame.
 *   2. **Casual · English · Sarah.** The hand travels right and crosses
 *      the `relaxed` gate and not the `warm` one, so the opening formula
 *      is rewritten under the reading head and the offer that follows it
 *      holds perfectly still. One axis, isolated.
 *   3. **Friendly · English · Laura.** The hand travels up, the `warm`
 *      gate flashes instead, and the complement happens. Two stops have
 *      now shown exactly which half of the sentence each half of the pad
 *      is wired to, without asking the reader to do a thing.
 *   4. **Friendly · Română · George.** The hand does not move at all — no
 *      travel, no gate. The language and the voice do, the whole sentence
 *      is replaced in Romanian, and it is read back more slowly because
 *      George reads more slowly. A register that survives being translated
 *      is the section's strongest claim and this is the frame that makes it.
 *
 * Then it closes back onto stop 1 and goes round again.
 *
 * THE CLOCK is still the house clock, `product/timing.ts`. Each stop is
 * held for `max(holdFor(greeting), the voice's own reading time)` plus a
 * beat to settle, and the timeline is authored to fit inside that hold —
 * the travel and the reading together are always shorter than the dwell,
 * so the sentence is never cut off by the next hand moving. `useInView`
 * gates everything: off screen the tour's timer is cleared and the
 * timeline is paused where it stands.
 *
 * REDUCED MOTION IS A THIRD COMPOSITION, not an absence. The markup rests
 * *finished* — every word in ink, the signature fully swept, the playhead
 * gone, no trail — and the timeline is what rewinds it and plays it
 * forward. So a reader who asked for no motion gets a complete, read
 * sentence, a reader with no JavaScript gets the same, and GSAP is never
 * fetched at all in the first case: `useMotionKit(near && !reduce)`.
 *
 * HANDOVER IS PERMANENT, and it completes rather than interrupts. The
 * first pointer, focus or key event anywhere in the instrument runs the
 * current movement to its end and pauses it — the hand lands, the sentence
 * finishes — and from that frame the pad is the reader's. Their own moves
 * are small state changes and stay CSS: the puck eases to a tone they
 * clicked, instantly follows a finger that is dragging it. GSAP is for the
 * composed movement, not for everything. What the reader still gets is the
 * reading: cross a gate with your own hand and the sentence re-reads
 * itself, with the words you changed arriving under the head.
 *
 * Decisions worth keeping from the version this replaces:
 *
 *  · **Register is a plane, not six cards.** The app offers six named
 *    personalities, which is a fine control and a poor argument — six cards
 *    say the agent has six settings. Plotted on two axes with a puck free
 *    between them, the same six say register is continuous and that a
 *    business can sit anywhere in it. Dragging rewrites the greeting under
 *    your hand, which is the only proof of that claim that matters.
 *  · **Only the words that changed rise.** The tour's stops are chosen so
 *    that each move crosses one threshold, and the common-prefix/suffix
 *    diff below marks precisely which words are new. Eight words lift and
 *    five do not move at all, and that difference is the demonstration.
 *  · **Nine languages, written rather than translated.** The chips under the
 *    plane carry each language's own name, because that is the evidence
 *    before anyone clicks: the formal register is held in all eight of the
 *    nine that have one, and a Polish caller gets a Polish sentence rather
 *    than the English one run through a dictionary.
 *  · **The voice is read, not played, and it says so.** There is no audio
 *    here. A play button that produced silence would undo everything the
 *    rest of the section earns, so the control *reads*: the greeting crosses
 *    the voice's own signature at the voice's own words per minute, and
 *    those two numbers really are what differ between these voices.
 *  · **The clock is real.** It counts wall time from the reader's first
 *    touch — not from the tour's, which is nobody's setup time — it pauses
 *    when the section leaves the viewport or the tab goes to the background,
 *    and nothing on the page can skip it to the end.
 *
 * NO SHADER BAND HERE, and that is a decision rather than an omission. A
 * `ShaderStage` scene is mixed into paper across the bottom third of its
 * band by `guarded()`, which is why every one on this site is a full-bleed
 * breath between instruments. This section *is* an instrument — a pad the
 * reader drags and nine chips they press — and a scene behind it would cost
 * the pad its legibility to say nothing.
 *
 * `#how` is load-bearing and stays: the close's third receipt and the
 * second FAQ answer both point at this id.
 *
 * THE LIGHT SYSTEM. This section is set in `pp`, like every other marketing
 * page on the site: white stock, black ink, one violet, `Frame` for the
 * column and `SectionHeading` for the opener. The instrument is a grey
 * `pp-card` because that is how the light system marks off a *working*
 * surface; white is the selected state inside it; and heavy glows are out,
 * because on white a halo reads as dirt. Everything draws, sweeps or fills.
 *
 * Two layout notes, both deliberate. The greeting comes *first* in the DOM,
 * ordered back to the right column from `md` up, so source order reads the
 * way the argument does at every width: here is what the caller hears, and
 * here is the control that wrote it. And the greeting is set in the cinema
 * face, the house idiom for a spoken line played back on the page.
 */

/* ---------------------------------------------------------------- *
 * Copy and constants owned by this section
 * ---------------------------------------------------------------- */

/**
 * The heading's words live here rather than in `lib/site.ts`.
 *
 * The constant that used to supply them, `HOW_INTRO`, went out with the
 * setup wizard this section replaced — it was written about a stepper
 * ("four screens, ten minutes") and there is no stepper left to describe.
 * `lib/site.ts` is frozen, so the replacement is declared at module scope
 * here. If this copy is ever wanted in two places it should be promoted
 * back into the data file.
 */
const KICKER = "What the caller hears";
const TITLE = "Register is a place, not a preset.";
const SUB =
  "Six named tones, and the agent can sit anywhere between them. Move it and the greeting rewrites itself — in whichever of nine languages it answers, each one written natively rather than translated out of the English.";

/** The business the demo answers for. Fixed, so nothing is ever half-built. */
const DEMO_COMPANY = "Acme Dental";
const DEMO_AGENT = "Sarah";

/** The ten minutes the setup claim is measured against, in ms. */
const BUDGET = 10 * 60 * 1000;

const toneById = (id: string) => TONES.find((t) => t.id === id) ?? TONES[0];
const langByCode = (code: string) =>
  SETUP_LANGS.find((l) => l.code === code) ?? SETUP_LANGS[0];
const voiceById = (id: string) =>
  SETUP_VOICES.find((v) => v.id === id) ?? SETUP_VOICES[0];

type Stop = { tone: Tone; lang: SetupLang; voice: SetupVoice };

/**
 * The tour. Four businesses, in the order that makes each move legible.
 *
 * `professional → casual` crosses the `relaxed` gate alone, so `greetingFor`
 * swaps the opening formula and leaves the offer. `casual → friendly`
 * crosses `warm` alone and does the opposite. The third move leaves the pad
 * untouched and changes only language and voice. Every stop isolates one
 * variable except the last one, which closes the loop — a tour where
 * everything changed at once would show movement without showing cause,
 * which is the failure mode of every scroll animation ever written.
 */
const STOPS: Stop[] = [
  {
    tone: toneById("professional"),
    lang: langByCode("EN"),
    voice: voiceById("sarah"),
  },
  {
    tone: toneById("casual"),
    lang: langByCode("EN"),
    voice: voiceById("sarah"),
  },
  {
    tone: toneById("friendly"),
    lang: langByCode("EN"),
    voice: voiceById("laura"),
  },
  {
    tone: toneById("friendly"),
    lang: langByCode("RO"),
    voice: voiceById("george"),
  },
];

/** The beat between a line finishing and the next hand moving. */
const SETTLE = 900;

/**
 * How fast the hand crosses the plane, in pad units per second, and the two
 * ends it is held between.
 *
 * Constant speed is the point, exactly as it is down every lane of the
 * `Qualified` figure: the moves are the same journey, so the only thing
 * that can differ between them is how far it is. The floor stops a nudge
 * from being a flicker; the ceiling keeps the longest move — corner to
 * corner, which the tour never makes — inside the stop's own dwell.
 */
const HAND_SPEED = 70;
const HAND_MIN = 0.34;
const HAND_MAX = 1;

/** Travel between two resting points. The house ease for exactly that. */
const TRAVEL_EASE = "power2.inOut";

/** The house focus ring on the light pages. */
const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink";

/** The eleven-pixel field label the light system uses for every instrument. */
const LABEL =
  "text-[11px] leading-4 font-medium tracking-[0.12em] text-pp-muted uppercase";

/**
 * The chip, straight off the keyterm rail: a 44px pill, white at rest on
 * the grey card, inked when it is the one in force.
 */
const CHIP =
  "inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-[14px] leading-none whitespace-nowrap transition-colors duration-300";
const CHIP_ON = "bg-pp-ink text-white";
const CHIP_OFF = "bg-white text-pp-muted hover:text-pp-ink";

/** The plane's own hairline, the colour the gates rest at. */
const GRID = "#181028";

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

const mmss = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/** How long a voice takes to read a sentence, in seconds, at its own pace. */
const readSecs = (wordCount: number, wpm: number) =>
  Math.max(2.2, (wordCount / wpm) * 60);

function nearestTone(relaxed: number, warm: number): Tone {
  let best = TONES[0];
  let bestD = Infinity;
  for (const t of TONES) {
    const d = (t.at[0] - relaxed) ** 2 + (t.at[1] - warm) ** 2;
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}

type At = readonly [number, number];

/** Pad coordinates, 0–100. Warm is up, so the y axis is inverted here. */
const px = (a: At) => a[0] * 100;
const py = (a: At) => (1 - a[1]) * 100;

/**
 * The route the hand takes between two points of the plane.
 *
 * A quadratic bowed a tenth of its own length off the straight line: enough
 * that the move reads as a stroke somebody made rather than as an
 * interpolation between two presets, never enough to leave the square.
 */
function routePath(from: At, to: At) {
  const x0 = px(from);
  const y0 = py(from);
  const x1 = px(to);
  const y1 = py(to);
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const bow = len * 0.1;
  const cx = (x0 + x1) / 2 - (dy / len) * bow;
  const cy = (y0 + y1) / 2 + (dx / len) * bow;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} Q${cx.toFixed(2)} ${cy.toFixed(2)} ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/**
 * Where along a move a threshold is crossed, or null if it is not.
 *
 * Both axes gate at the midpoint — see `greetingFor` — so this is the share
 * of the move at which the sentence is rewritten.
 */
function gateAt(from: number, to: number) {
  if (from > 0.5 === to > 0.5) return null;
  return clamp01((0.5 - from) / (to - from));
}

/**
 * The moment an eased travel is `u` of the way there.
 *
 * The inverse of the ease, by bisection. The gate has to flash as the puck
 * passes over it and not when the tween's clock says half, which is the
 * same reason the `Day back` figure inverts its `sine.inOut` rather than
 * spacing its stems evenly. (The route bows, so the hand's x is not exactly
 * linear in its progress along it; over a tenth-length bow that is a couple
 * of hundredths of a second, well inside the flash itself.)
 */
function whenAt(ease: (p: number) => number, u: number) {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (ease(mid) < u) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Field label. `--pp-muted` on both stocks is 5.6:1, so it needs no floor. */
function Key({ children }: { children: React.ReactNode }) {
  return <p className={LABEL}>{children}</p>;
}

/* ---------------------------------------------------------------- *
 * The register pad
 * ---------------------------------------------------------------- */

function RegisterPad({
  relaxed,
  warm,
  route,
  eased,
  dragging,
  setDragging,
  onChange,
  onEngage,
}: {
  relaxed: number;
  warm: number;
  /** The `d` of the move the hand is on, drawn behind it as it goes. */
  route: string;
  /**
   * True when the hand is the reader's rather than the timeline's: their
   * moves are small state changes, and a small state change is CSS.
   */
  eased: boolean;
  dragging: boolean;
  setDragging: Dispatch<SetStateAction<boolean>>;
  onChange: (relaxed: number, warm: number) => void;
  /** Fired on the first pointer, focus or key event the pad receives. */
  onEngage: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const active = nearestTone(relaxed, warm).id;

  const at = (e: ReactPointerEvent) => {
    const r = box.current?.getBoundingClientRect();
    if (!r?.width || !r.height) return;
    onChange(
      clamp01((e.clientX - r.left) / r.width),
      // Warm is up. Screen y grows downward, so the axis is inverted here
      // rather than everywhere else that reads it.
      clamp01(1 - (e.clientY - r.top) / r.height),
    );
  };

  const key = (e: ReactKeyboardEvent) => {
    // Shift is the coarse step. Without it a reader crossing the plane by
    // keyboard needs twenty-five presses, which is not a control.
    const d = e.shiftKey ? 0.14 : 0.045;
    const dx = e.key === "ArrowRight" ? d : e.key === "ArrowLeft" ? -d : 0;
    const dy = e.key === "ArrowUp" ? d : e.key === "ArrowDown" ? -d : 0;
    if (!dx && !dy) return;
    e.preventDefault();
    onEngage();
    onChange(clamp01(relaxed + dx), clamp01(warm + dy));
  };

  return (
    <div
      ref={box}
      role="group"
      aria-label="Register — drag to place the agent between the named tones, or choose one directly."
      tabIndex={0}
      onKeyDown={key}
      onFocus={onEngage}
      onPointerDown={(e) => {
        // Capture, so a drag that leaves the square keeps feeding it
        // instead of dropping the puck wherever the pointer crossed out.
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(true);
        onEngage();
        at(e);
      }}
      onPointerMove={(e) => dragging && at(e)}
      onPointerUp={(e) => {
        e.currentTarget.releasePointerCapture(e.pointerId);
        setDragging(false);
      }}
      onPointerCancel={() => setDragging(false)}
      className={cn(
        // A white plotting field on the grey card: the light system's
        // "this is the surface you operate" mark, the same white the
        // unselected chips are cut from.
        "relative aspect-square w-full max-w-[380px] touch-none rounded-[20px] border border-pp-hair bg-pp-bg outline-none select-none",
        FOCUS,
        dragging ? "cursor-grabbing" : "cursor-crosshair",
      )}
    >
      {/* The plane.
          A square viewBox with the default `preserveAspectRatio`, because
          the box is `aspect-square`: the mapping is uniform, which is what
          lets the hand travel a real path through it without the route
          coming out stretched in one axis. Everything that moves lives in
          here, and the root `<svg>` clips it — which is what lets the
          crosshair be two long lines carried by the puck rather than two
          separate elements told the same number. */}
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        className="absolute inset-0 size-full"
      >
        {[25, 75].map((p) => (
          <g key={p} stroke={GRID} strokeOpacity="0.08" strokeWidth="1" vectorEffect="non-scaling-stroke">
            <line x1={p} y1="0" x2={p} y2="100" />
            <line x1="0" y1={p} x2="100" y2={p} />
          </g>
        ))}

        {/* The gates. These two are not grid: `relaxed > 0.5` chooses the
            opening formula and `warm > 0.5` chooses the offer, so crossing
            one of them is what rewrites the sentence. The timeline lights
            whichever one the hand passes over, at the instant it does. */}
        <line
          className="rg-gate-x"
          x1="50"
          y1="0"
          x2="50"
          y2="100"
          stroke={GRID}
          strokeOpacity="0.08"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        <line
          className="rg-gate-y"
          x1="0"
          y1="50"
          x2="100"
          y2="50"
          stroke={GRID}
          strokeOpacity="0.08"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />

        {/* Ghost, then ink: the pair every drawn stroke in this house is
            made of. Both rest invisible, because a trail's finished state
            is no trail — the route ahead comes up faintly as the hand sets
            off and the ink is drawn along it by the hand itself.

            These two are the only strokes in the plane without
            `non-scaling-stroke`, and that is deliberate: DrawSVG works by
            writing a dash array measured in the path's own user units, and
            a stroke drawn in screen space would read those as pixels and
            tile the trail instead of revealing it. Their widths are in pad
            units for the same reason. */}
        <path
          className="rg-route-ghost"
          d={route}
          fill="none"
          stroke={GRID}
          strokeWidth="0.3"
          strokeLinecap="round"
          style={{ opacity: 0 }}
        />
        <path
          className="rg-route"
          d={route}
          fill="none"
          stroke="var(--pp-accent)"
          strokeWidth="0.42"
          strokeLinecap="round"
          style={{ opacity: 0 }}
        />

        {/* The hand: the puck and the crosshair through it, as one object.
            The two hairlines run well past the square and are clipped by
            the SVG viewport, so wherever the group is put the crosshair
            spans the plane — the crosshair travels with the puck by
            construction rather than by being handed the same number.

            Its position is the `transform` attribute so it is in the right
            place on the server's first paint and under a dragging finger;
            the timeline writes the same attribute while the tour drives,
            and `eased` is what decides which of the two is in charge.

            The ring is a flat 6px of 10% violet rather than a bloom: on
            white a soft glow reads as a smudge, and what this mark has to
            say is only "the puck is here". */}
        <g
          className={cn(
            "rg-hand",
            eased && !dragging && "transition-transform duration-500 ease-out motion-reduce:transition-none",
          )}
          transform={`translate(${px([relaxed, warm]).toFixed(3)} ${py([relaxed, warm]).toFixed(3)})`}
        >
          <line
            x1="0"
            y1="-140"
            x2="0"
            y2="140"
            stroke="var(--pp-accent)"
            strokeOpacity="0.25"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1="-140"
            y1="0"
            x2="140"
            y2="0"
            stroke="var(--pp-accent)"
            strokeOpacity="0.25"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          <circle
            r="3.2"
            fill="none"
            stroke="var(--pp-accent)"
            strokeOpacity="0.1"
            strokeWidth="6"
            vectorEffect="non-scaling-stroke"
          />
          <circle
            r="2.4"
            fill="var(--pp-bg)"
            stroke="var(--pp-accent)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      </svg>

      {TONES.map((t) => {
        const on = active === t.id;
        // Labels near an edge would run out of the square, so the anchor
        // flips instead of the point moving.
        const anchor =
          t.at[0] > 0.72
            ? "translate(-100%, -50%)"
            : t.at[0] < 0.28
              ? "translate(0, -50%)"
              : "translate(-50%, -50%)";
        // Pixels, not em: the light system has no em base, and these push
        // a fixed 11px label clear of a fixed 7px dot at every pad width.
        const pad =
          t.at[0] > 0.72
            ? { paddingRight: "18px" }
            : t.at[0] < 0.28
              ? { paddingLeft: "18px" }
              : { paddingTop: "26px" };

        return (
          <div key={t.id}>
            <button
              type="button"
              onClick={() => {
                onEngage();
                onChange(t.at[0], t.at[1]);
              }}
              aria-pressed={on}
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2 rounded-full p-2 outline-none",
                FOCUS,
              )}
              style={{ left: `${t.at[0] * 100}%`, top: `${(1 - t.at[1]) * 100}%` }}
            >
              <span className="sr-only">
                {t.label} — {t.blurb}
              </span>
              <span
                aria-hidden
                className={cn(
                  "block size-[7px] rounded-full transition-colors duration-500",
                  on ? "bg-pp-accent" : "bg-pp-muted/45",
                )}
              />
            </button>

            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute text-[11px] leading-4 font-medium tracking-[0.06em] whitespace-nowrap transition-colors duration-500",
                on ? "text-pp-accent" : "text-pp-muted",
              )}
              style={{
                left: `${t.at[0] * 100}%`,
                top: `${(1 - t.at[1]) * 100}%`,
                transform: anchor,
                ...pad,
              }}
            >
              {t.label}
            </span>
          </div>
        );
      })}

      {/* axes */}
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-3 left-4 text-[11px] leading-4 tracking-[0.14em] text-pp-muted uppercase"
      >
        measured
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute right-4 bottom-3 text-[11px] leading-4 tracking-[0.14em] text-pp-muted uppercase"
      >
        relaxed
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute top-3 left-4 text-[11px] leading-4 tracking-[0.14em] text-pp-muted uppercase"
      >
        warm
      </span>
    </div>
  );
}

/* ---------------------------------------------------------------- *
 * The greeting, spoken
 * ---------------------------------------------------------------- */

const WAVE_POINTS = 108;

/**
 * A voice's signature, from its own two numbers.
 *
 * Deliberately not seeded noise. Noise would draw an envelope that looks
 * different per voice while meaning nothing, which is the decorative
 * version of this mark; a carrier at the voice's pitch under a speech
 * envelope, roughened at a rate set by its pace, draws one that differs
 * because the voice differs. Low and slow reads as long swells, high and
 * quick as a tight chatter, and that is what those voices are.
 */
function amplitudes(v: SetupVoice, n: number) {
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    const carrier = Math.sin(t * Math.PI * 2 * (2.5 + v.pitch * 5.5));
    const grain = Math.sin(t * Math.PI * 2 * (9 + v.wpm / 18));
    // Speech tails off at both ends of a phrase; a flat block reads as a
    // meter rather than as an utterance.
    const env = Math.sin(t * Math.PI) ** 0.55;
    return (0.2 + 0.8 * Math.abs(carrier * 0.72 + grain * 0.28)) * env;
  });
}

/**
 * The envelope as one closed path, mirrored about the centreline.
 *
 * Filled rather than stroked because the viewBox is scaled non-uniformly
 * to the strip's width — a stroke would come out thick at one end of the
 * sentence and hairline at the other.
 */
function wavePath(v: SetupVoice) {
  const a = amplitudes(v, WAVE_POINTS);
  const x = (i: number) => ((i / (WAVE_POINTS - 1)) * 100).toFixed(2);
  const top = a.map((h, i) => `${x(i)},${(50 - h * 46).toFixed(2)}`);
  const bottom = a
    .map((h, i) => `${x(i)},${(50 + h * 46).toFixed(2)}`)
    .reverse();
  return `M${top.join("L")}L${bottom.join("L")}Z`;
}

/** One word of the greeting, and whether the last move is what wrote it. */
type SpokenWord = { w: string; key: string; changed: boolean };

/**
 * The sentence, and the diff that says which of its words are new.
 *
 * Common prefix, common suffix, and everything between them is new. Keys
 * carry the position a word was matched *from* — head words by their index
 * from the start, tail words by their distance from the end — so a rewrite
 * that changes the word count does not shuffle the keys of the words that
 * held still.
 *
 * The keys are the whole of the rise's logic. A changed word is a new
 * element; an unchanged word is the same element React had before. That is
 * why the tour's stops are worth choosing carefully: cross one gate and
 * half the sentence lifts while the other half sits perfectly still, which
 * is a far better explanation of what the pad does than any label could be.
 *
 * On the very first reading there is no previous sentence to diff against,
 * so every word counts as new and the whole greeting writes itself in. That
 * is the right opening and it costs nothing to allow.
 */
function diff(text: string, prev: string, gen: number): SpokenWord[] {
  const next = text.split(/\s+/).filter(Boolean);
  const was = prev ? prev.split(/\s+/).filter(Boolean) : [];

  let head = 0;
  while (head < was.length && head < next.length && was[head] === next[head])
    head++;

  let tail = 0;
  while (
    tail < was.length - head &&
    tail < next.length - head &&
    was[was.length - 1 - tail] === next[next.length - 1 - tail]
  )
    tail++;

  return next.map((w, i) => {
    const isHead = i < head;
    const isTail = i >= next.length - tail;
    return {
      w,
      changed: !isHead && !isTail,
      key: isHead
        ? `h${i}:${w}`
        : isTail
          ? `t${next.length - i}:${w}`
          : `m${gen}:${i}`,
    };
  });
}

function SpokenGreeting({
  words,
  voice,
  secs,
}: {
  words: SpokenWord[];
  voice: SetupVoice;
  /** How long this voice takes to cross this sentence, at its own pace. */
  secs: number;
}) {
  const d = useMemo(() => wavePath(voice), [voice]);

  return (
    <div>
      {/* The cinema face, italic, inside quotation marks: the house idiom
          for a line that is *heard* rather than read off an interface.

          It rests finished — every word in ink, nothing displaced. The
          timeline is what takes it back to the start of the reading and
          plays it forward, so with reduced motion, with no JavaScript, or
          in the moment before the kit lands, what is on the page is a
          complete sentence rather than a dimmed one waiting for something. */}
      <p className="font-[family-name:var(--font-pp-cinema)] text-[21px] leading-8 text-pp-ink italic md:text-[24px] md:leading-9">
        <span aria-hidden className="text-pp-muted">
          &ldquo;
        </span>
        {words.map((word, i) => (
          <Fragment key={word.key}>
            {/* The clip box. Padded below the baseline so descenders clear
                it and pulled back out so line-height is unaffected, and
                padded on the right for the italic — the clip would
                otherwise shave the lean off a Cormorant f or y
                permanently, not only during the rise. */}
            <span className="rg-word inline-block -mb-[0.16em] -mr-[0.08em] overflow-hidden pr-[0.08em] pb-[0.16em] align-bottom">
              <span
                className={cn("inline-block", word.changed && "rg-rise")}
                data-at={i}
              >
                {word.w}
              </span>
            </span>{" "}
          </Fragment>
        ))}
        <span aria-hidden className="text-pp-muted">
          &rdquo;
        </span>
      </p>

      {/* The reading. Silent, and the caption says so. */}
      <div className="mt-6">
        <div className="rg-strip relative h-10 w-full">
          <svg
            aria-hidden
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 size-full"
          >
            <path d={d} fill="var(--pp-ink)" fillOpacity="0.1" />
          </svg>
          {/* Rests fully swept — the reading is finished until the timeline
              rewinds it. */}
          <div aria-hidden className="rg-sweep absolute inset-0">
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 size-full"
            >
              <path d={d} fill="var(--pp-accent)" fillOpacity="0.85" />
            </svg>
          </div>
          {/* The playhead travels with the fill and is gone the moment the
              sentence is finished — an edge parked at the far right would
              read as part of the chart rather than as a position in it. No
              Tailwind `translate-*` on it: GSAP writes `transform`, and
              Tailwind v4's utilities write the separate `translate`
              property, which would compose on top of it. */}
          <div
            aria-hidden
            className="rg-head absolute inset-y-0 left-0 w-px bg-pp-accent"
            style={{ opacity: 0 }}
          />
        </div>

        <p className="mt-3 text-[11px] leading-4 tracking-[0.1em] text-pp-muted tabular-nums uppercase">
          {voice.name} · {voice.wpm} wpm · {secs.toFixed(1)}s · silent on this
          page
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- *
 * Section
 * ---------------------------------------------------------------- */

export function Register() {
  const reduce = usePrefersReducedMotion();

  const ref = useRef<HTMLDivElement>(null);
  // Two margins, two jobs: `near` fetches GSAP, `inView` plays the timeline
  // and runs the reader's clock.
  const inView = useInView(ref, "-15% 0px -15% 0px");
  const near = useInView(ref, "25% 0px");
  // `near && !reduce`, because the markup rests finished: with reduced
  // motion there is nothing for GSAP to do and it is never downloaded.
  const kit = useMotionKit(near && !reduce);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  /**
   * The instrument's state, and the tour writes exactly the same four
   * pieces of it that the reader's hands do. That is why the handover costs
   * nothing to implement: the tour is not a separate mode, it is a hand on
   * the controls, and taking that hand off leaves everything where it was.
   */
  const [relaxed, setRelaxed] = useState(STOPS[0].tone.at[0]);
  const [warm, setWarm] = useState(STOPS[0].tone.at[1]);
  const [lang, setLang] = useState<SetupLang>(STOPS[0].lang);
  const [voice, setVoice] = useState<SetupVoice>(STOPS[0].voice);
  const [run, setRun] = useState(0);
  const [cursor, setCursor] = useState(0);
  const [dragging, setDragging] = useState(false);

  const [handedOver, setHandedOver] = useState(false);
  const takenRef = useRef(false);

  const [ms, setMs] = useState(0);
  const [running, setRunning] = useState(false);

  /**
   * The handover, and it completes rather than interrupts.
   *
   * Whatever the tour was in the middle of runs to its end and stops there
   * — the hand lands on its tone, the sentence finishes being read — so
   * nothing is left moving under the reader's own. It is guarded by a ref
   * rather than by the state it sets, because the click that triggers it
   * usually sets three other things in the same batch, and this has to
   * happen before that commit rebuilds the timeline.
   */
  const engage = useCallback(() => {
    if (!takenRef.current) {
      takenRef.current = true;
      tlRef.current?.progress(1).pause();
      setHandedOver(true);
    }
    setRunning(true);
  }, []);

  const greeting = useMemo(
    () =>
      greetingFor({
        lang,
        company: DEMO_COMPANY,
        agent: DEMO_AGENT,
        relaxed,
        warm,
      }),
    [lang, relaxed, warm],
  );

  /**
   * The sentence as it is on screen, and the one before it.
   *
   * Adjusted during render rather than from an effect: the timeline is
   * built in a layout effect and selects these very words, so the markup
   * and the movement have to be agreed within a single commit. A generation
   * counter mutated in a ref during render would count StrictMode's second
   * pass; re-deriving it and letting React re-render before it commits does
   * not, because the second pass finds the text already current.
   */
  const [shown, setShown] = useState(() => ({ text: greeting, prev: "", gen: 0 }));
  const current =
    shown.text === greeting
      ? shown
      : { text: greeting, prev: shown.text, gen: shown.gen + 1 };
  if (current !== shown) setShown(current);

  const words = useMemo(
    () => diff(current.text, current.prev, current.gen),
    [current.text, current.prev, current.gen],
  );
  const secs = readSecs(words.length, voice.wpm);

  /** Where the hand came from, and the route it takes to get here. */
  const from = STOPS[(cursor + STOPS.length - 1) % STOPS.length].tone.at;
  const route = useMemo(
    () => routePath(from, [relaxed, warm]),
    [from, relaxed, warm],
  );

  /**
   * How long this stop is held: the house reading pace, floored by the time
   * the chosen voice actually needs to cross the sentence, plus a beat.
   *
   * `holdFor` alone would cut George off mid-line — he reads at 134 wpm and
   * a Romanian greeting is long — and the voice's own duration alone would
   * flick past a short English line before it can be read. The maximum of
   * the two is the only honest number, and it is also the budget the
   * timeline below is authored against: the travel plus the reading is
   * always shorter than the dwell, so no sentence is cut off by the next
   * hand moving.
   */
  const dwell = useMemo(
    () => Math.max(holdFor(greeting), secs * 1000) + SETTLE,
    [greeting, secs],
  );

  /* ---------------------------------------------------------------- *
   * The movement: one timeline per utterance
   * ---------------------------------------------------------------- */

  useKitContext(
    kit,
    ({ gsap }) => {
      const root = ref.current;
      if (!root) return;
      const q = gsap.utils.selector(ref);

      // Read once, here, rather than written twice: these are the light
      // system's own tokens and the timeline has to interpolate real
      // colours, not `var()` strings.
      const style = getComputedStyle(root);
      const ink = style.getPropertyValue("--pp-ink").trim() || "#000000";
      const muted = style.getPropertyValue("--pp-muted").trim() || "#6b6878";
      const accent = style.getPropertyValue("--pp-accent").trim() || "#551a89";

      // `gsap.utils.selector` is typed against the HTML scope it was built
      // from, so the two SVG grabs are cast at the grab site.
      const hand = q(".rg-hand")[0] as unknown as SVGGElement | undefined;
      const trail = q(".rg-route")[0] as unknown as SVGPathElement | undefined;
      const ghost = q(".rg-route-ghost");
      const line = q(".rg-word");
      const risers = q(".rg-rise");
      const sweep = q(".rg-sweep");
      const head = q(".rg-head");
      const strip = q(".rg-strip")[0] as HTMLElement | undefined;
      if (!line.length || !strip) return;

      const tl = gsap.timeline({ paused: true });

      /* 1 — the hand travels, and the gate it passes flashes.
         Only while the tour has the instrument: once the reader has it,
         their own moves are theirs and CSS carries the puck. `run > 0`
         keeps the very first frame still, because nothing moved to get
         there. */
      let reads = 0;
      const moved = from[0] !== relaxed || from[1] !== warm;
      if (!handedOver && run > 0 && moved && hand && trail) {
        const dur = Math.min(
          HAND_MAX,
          Math.max(HAND_MIN, trail.getTotalLength() / HAND_SPEED),
        );
        const ease = gsap.parseEase(TRAVEL_EASE) as (p: number) => number;

        tl.set(ghost, { opacity: 0.14 }, 0)
          .set(trail, { opacity: 1, drawSVG: "0% 0%" }, 0)
          .to(trail, { drawSVG: "0% 100%", duration: dur, ease: TRAVEL_EASE }, 0)
          .to(
            hand,
            { duration: dur, ease: TRAVEL_EASE, motionPath: { path: trail } },
            0,
          );

        // The gate is struck as the puck is over it, not when the clock is
        // half spent — so the flash is a cause the reader can see, and the
        // words it governs arrive in the reading that follows.
        const gates: [string, number | null][] = [
          [".rg-gate-x", gateAt(from[0], relaxed)],
          [".rg-gate-y", gateAt(from[1], warm)],
        ];
        for (const [sel, u] of gates) {
          if (u === null) continue;
          const at = whenAt(ease, u) * dur;
          tl.to(
            q(sel),
            {
              attr: { stroke: accent, "stroke-opacity": 0.85 },
              duration: 0.18,
              ease: "power1.out",
            },
            at,
          ).to(
            q(sel),
            {
              attr: { stroke: GRID, "stroke-opacity": 0.08 },
              duration: 0.8,
              ease: "power2.inOut",
            },
            at + 0.22,
          );
        }

        // The voice starts as the hand settles, and the trail retracts
        // behind it: the move has been made, and the plane is cleared so
        // the sentence is the only thing left to watch.
        reads = Math.max(0, dur - 0.25);
        tl.to(trail, { drawSVG: "100% 100%", duration: 0.6, ease: "power2.inOut" }, dur)
          .to(ghost, { opacity: 0, duration: 0.45 }, dur)
          .set([trail, ...ghost], { opacity: 0 }, dur + 0.6);
      }

      /* 2 — the voice reads it.
         One pace, `secs / words`, drives all four: the ink crossing the
         sentence, the words the gate rewrote arriving under the head, the
         violet crossing the signature, and the playhead. They are one
         movement because they are one clock. */
      const step = secs / line.length;

      tl.set(line, { color: muted }, 0)
        .set(risers, { autoAlpha: 0, yPercent: 115 }, 0)
        .set(sweep, { clipPath: "inset(0% 100% 0% 0%)" }, 0)
        .set(head, { x: 0, autoAlpha: 1 }, 0)
        .to(line, { color: ink, duration: 0.2, ease: "none", stagger: step }, reads)
        .to(
          risers,
          {
            autoAlpha: 1,
            yPercent: 0,
            duration: 0.5,
            ease: "power3.out",
            // Each rewritten word rises as the head reaches *its* place in
            // the sentence, which is why the offset is read off the word
            // rather than counted over the risers alone.
            stagger: (_i: number, el: Element) =>
              Number((el as HTMLElement).dataset.at ?? 0) * step,
          },
          reads,
        )
        .to(sweep, { clipPath: "inset(0% 0% 0% 0%)", duration: secs, ease: "none" }, reads)
        .to(head, { x: () => strip.clientWidth, duration: secs, ease: "none" }, reads)
        .to(head, { autoAlpha: 0, duration: 0.2 }, reads + secs);

      // Rendered at zero here, inside the layout effect, because this
      // section's markup rests *finished* rather than empty. A paused
      // timeline does not apply its own first frame until something asks
      // it to, and without this the browser would paint one frame of the
      // read sentence before the reading rewound it.
      tl.pause(0);

      tlRef.current = tl;
      return () => {
        tlRef.current = null;
      };
    },
    // Every one of these is a new utterance. A drag is not: the pad's value
    // changes sixty times a second and the sentence only when it crosses a
    // gate, which is exactly when `greeting` changes and not before.
    {
      scope: ref,
      dependencies: [current.text, voice.id, run, cursor, reduce],
      revertOnUpdate: true,
    },
  );

  // Plays while on screen. `kit` is in the deps because the timeline is
  // built asynchronously, after the kit arrives; the rest are there because
  // a rebuilt timeline needs telling again.
  useEffect(() => {
    const tl = tlRef.current;
    if (!tl) return;
    if (inView && !reduce) tl.play();
    else tl.pause();
  }, [inView, reduce, kit, current.text, voice.id, run, cursor]);

  /**
   * The tour. One timer, one stop at a time, cleared on unmount and
   * whenever the section leaves the viewport — a marketing page with a loop
   * running in a background tab is a bug, and a demonstration nobody is
   * watching is not a demonstration.
   */
  useEffect(() => {
    if (reduce || handedOver || !inView) return;
    const id = window.setTimeout(() => {
      const next = (cursor + 1) % STOPS.length;
      const stop = STOPS[next];
      setRelaxed(stop.tone.at[0]);
      setWarm(stop.tone.at[1]);
      setLang(stop.lang);
      setVoice(stop.voice);
      setRun((r) => r + 1);
      setCursor(next);
    }, dwell);
    return () => window.clearTimeout(id);
  }, [reduce, handedOver, inView, cursor, dwell]);

  /**
   * The clock. Wall time, from the reader's first touch — never from the
   * tour's, which is nobody's setup time — paused whenever they are not
   * actually here. Deltas rather than a start timestamp, so a pause simply
   * stops accumulating instead of having to be subtracted back out
   * afterwards.
   *
   * Backgrounding is caught by the size of the tick rather than by
   * `document.hidden`. A tick far longer than its own interval means the
   * timer was throttled, which is what a background tab or a sleeping
   * machine does to it — and that time was not spent here. Reading the
   * visibility API directly looked cleaner and was wrong: window managers
   * report `hidden` for windows that are plainly on screen, and a clock
   * that silently refuses to run makes the section look broken rather than
   * honest.
   */
  useEffect(() => {
    if (!running || !inView) return;
    let last = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      const d = now - last;
      last = now;
      if (d < 1000) setMs((m) => m + d);
    }, 200);
    return () => window.clearInterval(id);
  }, [running, inView]);

  const tone = useMemo(() => nearestTone(relaxed, warm), [relaxed, warm]);

  const over = ms > BUDGET;

  return (
    <section id="how" className="scroll-mt-28 py-20 md:py-28">
      <Frame className="px-6 md:px-12">
        <SectionHeading eyebrow={KICKER}>{TITLE}</SectionHeading>
        <p className="mt-5 max-w-[620px] text-base leading-[25px] text-pp-muted">
          {SUB}
        </p>
      </Frame>

      {/* The instrument. One grey card holding the pad, the sentence it
          writes and the two chip rails — they are one object, the card is
          how the light system says so, and it is also the timeline's scope:
          the hand, the gates, the words and the signature are selected out
          of this one element, which is what lets them be one movement.

          The three capture handlers are the handover, wired once for the
          whole instrument rather than control by control: the first
          pointer, focus or key event anywhere inside stops the tour for
          good, whether it lands on the pad, a chip, or the read button. */}
      <Frame className="mt-8 px-2 md:px-4">
        <div
          ref={ref}
          onPointerDownCapture={engage}
          onFocusCapture={engage}
          onKeyDownCapture={engage}
          className="grid gap-9 rounded-[24px] bg-pp-card p-5 md:grid-cols-12 md:gap-10 md:p-8"
        >
          {/* What the caller hears. First in source, right-hand column from
              md up — see the note at the top of the file. */}
          <div className="order-1 min-w-0 md:order-2 md:col-span-5">
            <div className="flex items-baseline justify-between gap-4">
              <Key>Opens with</Key>
              <button
                type="button"
                onClick={() => {
                  engage();
                  setRun((r) => r + 1);
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-full text-[11px] leading-4 font-medium tracking-[0.12em] text-pp-muted uppercase transition-colors duration-300 outline-none hover:text-pp-ink",
                  FOCUS,
                )}
              >
                <RotateCcw className="size-3.5" strokeWidth={2.2} />
                Read again
              </button>
            </div>

            <div className="mt-4">
              <SpokenGreeting words={words} voice={voice} secs={secs} />
            </div>

            {/* The voice showcase. Six voices, one row, and not one of them
                links anywhere: the library, the cloning, the synthesis and
                the transcription pages do not exist yet, and a capability
                is better demonstrated than promised. */}
            <div className="mt-8 border-t border-pp-hair pt-6">
              <Key>Read by</Key>
              <div className="mt-3 -mx-1 flex gap-2 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {SETUP_VOICES.map((v) => {
                  const on = v.id === voice.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        engage();
                        setVoice(v);
                        setRun((r) => r + 1);
                      }}
                      aria-pressed={on}
                      className={cn(CHIP, FOCUS, on ? CHIP_ON : CHIP_OFF)}
                    >
                      {v.name}
                      {/* Softened only on the ink chip: the muted grey on
                          white is already quiet, and 70% of it drops
                          under 3:1. */}
                      <span
                        className={cn(
                          "ml-2 text-[11px] tabular-nums",
                          on && "opacity-70",
                        )}
                      >
                        {v.wpm} wpm
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Keyed, so the note for a new voice is a new element and
                  rises once on mount. A one-line label swapping is a small
                  state change and stays CSS; the section's movement is the
                  reading beside it. */}
              <p
                key={voice.id}
                className="mt-4 max-w-[360px] text-[14px] leading-[22px] text-pp-muted animate-in fade-in-0 slide-in-from-bottom-1 duration-300 fill-mode-both"
              >
                {voiceNote(voice)}
              </p>
            </div>
          </div>

          {/* The control that wrote it. */}
          <div className="order-2 min-w-0 md:order-1 md:col-span-7">
            <div className="flex items-baseline justify-between gap-4">
              <Key>Register</Key>
              <span className="flex items-baseline gap-2">
                <span
                  className={cn(
                    "text-[17px] leading-none tabular-nums transition-colors duration-500",
                    running ? "text-pp-ink" : "text-pp-muted",
                  )}
                >
                  {mmss(ms)}
                </span>
                <span className="text-[11px] leading-4 tracking-[0.12em] text-pp-muted uppercase">
                  {over ? "past our ten" : running ? "tuning" : "of 10:00"}
                </span>
              </span>
            </div>

            <div className="mt-4">
              <RegisterPad
                relaxed={relaxed}
                warm={warm}
                route={route}
                // The timeline owns the hand only while the tour does, and
                // only once it exists; every other way the puck can move is
                // the reader's own and is carried by CSS.
                eased={!kit || handedOver || reduce}
                dragging={dragging}
                setDragging={setDragging}
                onChange={(r, w) => {
                  setRelaxed(r);
                  setWarm(w);
                }}
                onEngage={engage}
              />
            </div>

            <p className="mt-5 max-w-[380px] text-[15px] leading-[23px]">
              <span className="text-pp-accent transition-colors duration-300">
                {tone.label}
              </span>
              <span className="text-pp-muted"> — {tone.blurb.toLowerCase()}.</span>
            </p>

            {/* Nine languages, under the plane, each in its own writing.
                The chip is the evidence before anybody clicks it. */}
            <div className="mt-8 border-t border-pp-hair pt-6">
              <Key>Answers in</Key>
              <div className="mt-3 flex flex-wrap gap-2">
                {SETUP_LANGS.map((l) => {
                  const on = l.code === lang.code;
                  return (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => {
                        engage();
                        setLang(l);
                        setRun((r) => r + 1);
                      }}
                      aria-pressed={on}
                      className={cn(CHIP, FOCUS, on ? CHIP_ON : CHIP_OFF)}
                    >
                      {l.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </Frame>

      {/* provenance — the clock is real, and it says what it measures */}
      <Frame className="mt-8 px-6 md:px-12">
        <p className="max-w-[720px] text-[13px] leading-[21px] text-pp-muted">
          The clock is your own: it starts when you first touch the pad, it
          pauses whenever this section is off-screen or the tab is in the
          background, and nothing here can skip it to the end.{" "}
          {over ? (
            <>
              You are past our ten minutes, and we will take it — you were
              reading, not setting up.
            </>
          ) : (
            <>
              Ten minutes is what we claim the whole setup takes; this is the
              only part of it that needs a decision.
            </>
          )}{" "}
          There is no audio on this page — the envelope under the greeting is
          the voice&rsquo;s own pitch, and the sentence crosses it at the words
          per minute that voice really reads at. Nine languages here; the app
          carries more.
        </p>

        {/* One line for a screen reader, on the one thing this section
            exists to state. The tone label is deliberately left out of it:
            it changes continuously under a drag, and a live region that
            fires six times per gesture announces nothing.

            It is silent until the reader takes the instrument over. The
            tour changes all three settings four times a minute, and a live
            region narrating an animation nobody asked for is an interruption
            rather than information; the text is always present to be read on
            demand, and it starts announcing the moment the changes are the
            reader's own. */}
        <p aria-live={handedOver ? "polite" : "off"} className="sr-only">
          {`In ${lang.name}, read by ${voice.name}, ${voice.accent}: “${greeting}”`}
        </p>
      </Frame>
    </section>
  );
}

/**
 * The voice's own note, with its accent and register attached.
 *
 * Its own function only so the JSX above stays a layout and not a string
 * concatenation — `note` is a sentence, the other two are labels, and they
 * are punctuated differently.
 */
function voiceNote(v: SetupVoice) {
  return `${v.note} ${v.accent.replace(" · ", ", ")} · ${v.register.replace(" · ", ", ")}.`;
}
