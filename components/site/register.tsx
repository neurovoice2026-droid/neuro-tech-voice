"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
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
import { Frame, SectionHeading } from "./product/primitives";
import { holdFor, useInView, usePrefersReducedMotion } from "./product/timing";

/**
 * Register — the three settings that decide what a caller actually hears.
 *
 * THE SCENE. This section answers the same phone four times over, for four
 * different businesses, while you watch. Nothing here is an entrance and
 * nothing here waits for a scroll: the instrument runs the moment it is on
 * screen, moving its own controls and reading out loud what they wrote.
 *
 * The tour is four stops, and the order is the argument:
 *
 *   1. **Professional · English · Sarah.** The resting frame. The greeting
 *      reads itself across the voice's signature at Sarah's own 158 words
 *      per minute, and that is the whole of the first beat.
 *   2. **Casual · English · Sarah.** The puck travels right and nothing
 *      else changes. It crosses the `relaxed` midpoint and not the `warm`
 *      one, so the opening formula is rewritten and the offer that follows
 *      it holds perfectly still. One axis, isolated.
 *   3. **Friendly · English · Laura.** The puck travels up. Now `warm`
 *      crosses and `relaxed` does not, so the complement happens: the offer
 *      is rewritten and the opening holds. The other axis, isolated. Two
 *      stops have now shown the reader exactly which half of the sentence
 *      each half of the pad is wired to, without asking them to do a thing.
 *   4. **Friendly · Română · George.** The pad does not move at all. The
 *      language and the voice do, the entire sentence is replaced in
 *      Romanian, and it is read back more slowly because George reads more
 *      slowly. A register that survives being translated is the section's
 *      strongest claim and this is the frame that makes it.
 *
 * Then it closes back onto stop 1 and goes round again.
 *
 * Why a tour and not a reveal. The section used to be animated by the
 * reader's scrollbar — wrappers that faded the heading in, a mask that rose
 * the greeting's words, a single unattended drift from Professional to
 * Casual that fired once and then stopped for good. All of it moved because
 * somebody scrolled, which is decoration. None of it moved because the
 * product was doing something, which is the only kind of motion that argues
 * for anything. A pad that walks itself across four businesses is the
 * product working; a row that fades up is a row that fades up.
 *
 * THE CLOCK is the house clock, `components/site/product/timing.ts`. Each
 * stop is held for `max(holdFor(greeting), the voice's own reading time)`
 * plus a beat to settle — so the line is never cut off before it can be
 * read, and never before the voice has finished crossing it. `useInView`
 * gates the whole thing: off screen the timer is cleared and the reading is
 * shown complete, because there is nobody there to watch it happen.
 *
 * THE MOVEMENT IS CSS. React changes four pieces of state per stop and the
 * stylesheet does the rest: the puck and its crosshair ease to the new
 * point on a `transition-[left,top] duration-500`, the chips ink over on
 * `transition-colors duration-300`, the words that changed rise out of
 * their own clipping boxes on `animate-in slide-in-from-bottom`, and the
 * read head is one `clip-path` transition running linearly over the exact
 * number of seconds the caption claims. There is no per-frame loop and no
 * animation library in this file.
 *
 * HANDOVER IS PERMANENT. The first pointer, focus or key event anywhere in
 * the instrument stops the tour for good and starts the reader's clock. The
 * pad is under their hand from that frame, wherever the tour had got to;
 * nothing takes it back and no loop plays over their input.
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
 *    that each move crosses one threshold, and a word whose key survives the
 *    rewrite never re-runs its rise. Eight words lift and five do not move
 *    at all, and that difference is the demonstration.
 *  · **Nine languages, written rather than translated.** The chips under the
 *    plane carry each language's own name, because that is the evidence
 *    before anyone clicks: the formal register is held in all eight of the
 *    nine that have one, and a Polish caller gets a Polish sentence rather
 *    than the English one run through a dictionary.
 *  · **The voice is read, not played, and it says so.** There is no audio
 *    here. A play button that produced silence would undo everything the
 *    rest of the section earns, so the control *reads*: the greeting crosses
 *    the voice's own signature at the voice's own words per minute, and
 *    those two numbers really are what differ between these voices. The
 *    signature is drawn as one continuous envelope and not as a row of bars,
 *    because the header's Product menu already draws these same six voices
 *    as bars.
 *  · **The clock is real.** It counts wall time from the reader's first
 *    touch — not from the tour's, which is nobody's setup time — it pauses
 *    when the section leaves the viewport or the tab goes to the background,
 *    and nothing on the page can skip it to the end. Which is why the copy
 *    has a branch for going past ten minutes: a page that invites you to
 *    measure it has to survive the measurement.
 *
 * `#how` is load-bearing and stays: the close's third receipt and the
 * second FAQ answer both point at this id.
 *
 * THE LIGHT SYSTEM. This section is set in `pp`, like every other marketing
 * page on the site: white stock, black ink, one violet, `Frame` for the
 * column and `SectionHeading` for the opener.
 *
 *  · **The instrument is a card**, because a grey `pp-card` is how the light
 *    system marks off a *working* surface from the page, and the pad, the
 *    greeting and the chips are one instrument that ought to be held
 *    together. The instrument sits on grey and the argument around it sits
 *    on white.
 *  · **White is the selected state inside it**, exactly as on the keyterm
 *    rail: the pad's plotting field is white on the grey card, and an
 *    unselected chip is a white pill. Violet is reserved for the thing that
 *    is actually moving — the puck, the crosshair, the part of the signature
 *    already read, the live tone.
 *  · **Heavy glows are out.** On white, a halo reads as dirt. Everything
 *    draws, sweeps or fills: the signature is swept, the crosshair is a
 *    hairline, and the puck's ring is a thin flat one rather than a bloom.
 *
 * Two layout notes, both deliberate. The greeting comes *first* in the DOM,
 * ordered back to the right column from `md` up. On a phone the old version
 * put it below the fold while you dragged — you could not see the thing you
 * were changing — and the helper text hard-coded "the greeting on the
 * right" on a screen that has no right. Source order now reads the way the
 * argument does at every width: here is what the caller hears, and here is
 * the control that wrote it. And the greeting is set in the cinema face,
 * the house idiom for a spoken line played back on the page — the one thing
 * in this section that is a voice rather than interface copy.
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
 * `professional → casual` crosses the `relaxed` midpoint alone, so
 * `greetingFor` swaps the opening formula and leaves the offer. `casual →
 * friendly` crosses `warm` alone and does the opposite. The third move
 * leaves the pad untouched and changes only language and voice. Every stop
 * isolates one variable except the last one, which closes the loop — a tour
 * where everything changed at once would show movement without showing
 * cause, which is the failure mode of every scroll animation ever written.
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
  onChange,
  onEngage,
}: {
  relaxed: number;
  warm: number;
  onChange: (relaxed: number, warm: number) => void;
  /** Fired on the first pointer, focus or key event the pad receives. */
  onEngage: () => void;
}) {
  const reduce = usePrefersReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const active = nearestTone(relaxed, warm).id;

  /**
   * Everything the pad plots eases on the same clock, except under a drag.
   *
   * The puck belongs *under* the pointer, not trailing it, so a drag is
   * unsmoothed; every other way the value can change — a tone dot, an arrow
   * key, the tour walking to the next stop — is a discrete jump, and a jump
   * that eases is the travel the reader is meant to follow.
   */
  const travel = dragging || reduce ? "duration-0" : "duration-500";

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
      {/* the plane */}
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 size-full"
      >
        {[25, 50, 75].map((p) => (
          <g key={p} stroke="#181028" strokeOpacity="0.08">
            <line x1={p} y1="0" x2={p} y2="100" strokeWidth="0.35" />
            <line x1="0" y1={p} x2="100" y2={p} strokeWidth="0.35" />
          </g>
        ))}
      </svg>

      {/* crosshair through the puck — travels with it, on the same clock */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 w-px bg-pp-accent/25 transition-[left] ease-out",
          travel,
        )}
        style={{ left: `${relaxed * 100}%` }}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 h-px bg-pp-accent/25 transition-[top] ease-out",
          travel,
        )}
        style={{ top: `${(1 - warm) * 100}%` }}
      />

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

      {/* The puck.
          Its position is a style and its travel is a class: `left`/`top`
          are declared here so the puck is in the correct place on the
          first paint whether or not anything is moving, and the CSS
          transition carries it to the next point. Handing the same pair
          to an animation library looked equivalent and was not — with no
          initial value to animate from it resolves `auto`, declines the
          unit change to a percentage, and leaves the puck pinned in the
          corner while every label around it reads right.

          Its ring is a flat 6px of 10% violet rather than a bloom: on
          white a soft glow reads as a smudge, and what this mark has to
          say is only "the puck is here". */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute size-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-pp-accent bg-pp-bg shadow-[0_0_0_6px_color-mix(in_srgb,var(--pp-accent)_10%,transparent)] transition-[left,top] ease-out",
          travel,
        )}
        style={{
          left: `${relaxed * 100}%`,
          top: `${(1 - warm) * 100}%`,
        }}
      />

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

/** One word of the greeting, and whether this render is the one that changed it. */
type SpokenWord = { w: string; key: string; changed: boolean };

function SpokenGreeting({
  greeting,
  voice,
  run,
  live,
}: {
  greeting: string;
  voice: SetupVoice;
  /** Bumped to re-read the sentence — every tour stop, and "Read again". */
  run: number;
  /** The section is on screen — the read has something to be watched by. */
  live: boolean;
}) {
  const reduce = usePrefersReducedMotion();

  /**
   * The previous sentence, held so the next one can be diffed against it.
   *
   * Kept in state and written from an effect rather than in a ref mutated
   * during render: under StrictMode a render runs twice, and a generation
   * counter incremented in the render body would count both passes and
   * mis-mark which words are new.
   */
  const [shown, setShown] = useState(() => ({
    text: greeting,
    prev: "",
    gen: 0,
  }));

  useEffect(() => {
    setShown((s) =>
      s.text === greeting ? s : { text: greeting, prev: s.text, gen: s.gen + 1 },
    );
  }, [greeting]);

  /**
   * Common prefix, common suffix, and everything between them is new.
   *
   * Keys carry the position a word was matched *from* — head words by their
   * index from the start, tail words by their distance from the end — so a
   * rewrite that changes the word count does not shuffle the keys of the
   * words that held still, which would remount them and rise them too.
   *
   * The keys are the whole of the rise's logic. A changed word is a new
   * element, so its `animate-in` runs once on mount; an unchanged word is
   * the same element React had before, so nothing runs on it at all. That
   * is why the tour's stops are worth choosing carefully: cross one
   * threshold and half the sentence lifts while the other half sits
   * perfectly still, which is a far better explanation of what the pad does
   * than any label could be.
   */
  const words = useMemo<SpokenWord[]>(() => {
    const next = shown.text.split(/\s+/).filter(Boolean);
    const prev = shown.prev ? shown.prev.split(/\s+/).filter(Boolean) : [];

    let head = 0;
    while (head < prev.length && head < next.length && prev[head] === next[head])
      head++;

    let tail = 0;
    while (
      tail < prev.length - head &&
      tail < next.length - head &&
      prev[prev.length - 1 - tail] === next[next.length - 1 - tail]
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
            : `m${shown.gen}:${i}`,
      };
    });
  }, [shown]);

  const secs = readSecs(words.length, voice.wpm);

  /**
   * The read head, as two renders and then no more.
   *
   * `reading` is armed false and flipped true on the next frame, and every
   * moving part below is a CSS transition keyed off that one boolean: the
   * violet fill's `clip-path` crosses the signature over `secs` linearly,
   * the playhead travels with it, and each word's colour flips 200ms after
   * the head reaches it. The whole reading therefore costs two renders
   * rather than sixty a second, and it stays exactly in step with the
   * duration the caption prints.
   *
   * The double `requestAnimationFrame` is not superstition: one frame can
   * coalesce with the commit that armed it, and a transition whose start
   * and end styles land in the same paint does not run.
   */
  const [reading, setReading] = useState(false);
  useEffect(() => {
    if (reduce || !live) {
      setReading(false);
      return;
    }
    setReading(false);
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setReading(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [reduce, live, run, voice.id]);

  // Reduced motion asked for no sweep, and off-screen there is nobody to
  // watch one — both get the finished reading outright rather than a
  // sentence sitting dimmed at the quieter of its two tones.
  const done = reduce || !live;
  const sweeping = reading && !done;
  const swept = done || reading;
  const d = useMemo(() => wavePath(voice), [voice]);

  /** The stagger the rewritten words rise on, counted over them alone. */
  let risen = 0;

  return (
    <div>
      {/* The cinema face, italic, inside quotation marks: the house idiom
          for a line that is *heard* rather than read off an interface. */}
      <p className="font-[family-name:var(--font-pp-cinema)] text-[21px] leading-8 text-pp-ink italic md:text-[24px] md:leading-9">
        <span aria-hidden className="text-pp-muted">
          &ldquo;
        </span>
        {words.map((word, i) => {
          const rise = word.changed ? risen++ : -1;
          return (
            <span key={word.key}>
              {/* The clip box. Padded below the baseline so descenders
                  clear it and pulled back out so line-height is
                  unaffected, and padded on the right for the italic — the
                  clip would otherwise shave the lean off a Cormorant f or
                  y permanently, not only during the rise. */}
              <span
                className={cn(
                  "inline-block -mb-[0.16em] -mr-[0.08em] overflow-hidden pr-[0.08em] pb-[0.16em] align-bottom transition-colors",
                  swept ? "text-pp-ink" : "text-pp-muted",
                )}
                style={{
                  // The head reaches this word at its own share of the
                  // reading, so the line lights left to right at exactly
                  // the words per minute printed under it.
                  transitionDuration: sweeping ? "200ms" : "0ms",
                  transitionDelay: sweeping
                    ? `${((i / Math.max(1, words.length)) * secs).toFixed(2)}s`
                    : "0s",
                }}
              >
                <span
                  className={cn(
                    "inline-block",
                    word.changed &&
                      "animate-in fade-in-0 slide-in-from-bottom-[115%] duration-500 fill-mode-both ease-out",
                  )}
                  style={
                    rise >= 0 ? { animationDelay: `${rise * 45}ms` } : undefined
                  }
                >
                  {word.w}
                </span>
              </span>{" "}
            </span>
          );
        })}
        <span aria-hidden className="text-pp-muted">
          &rdquo;
        </span>
      </p>

      {/* The reading. Silent, and the caption says so. */}
      <div className="mt-6">
        <div className="relative h-10 w-full">
          <svg
            aria-hidden
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 size-full"
          >
            <path d={d} fill="var(--pp-ink)" fillOpacity="0.1" />
          </svg>
          <div
            aria-hidden
            className="absolute inset-0 transition-[clip-path] ease-linear"
            style={{
              clipPath: swept ? "inset(0 0 0 0)" : "inset(0 100% 0 0)",
              transitionDuration: sweeping ? `${secs.toFixed(2)}s` : "0s",
            }}
          >
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
              read as part of the chart rather than as a position in it. */}
          <div
            aria-hidden
            className="absolute inset-y-0 w-px bg-pp-accent"
            style={{
              left: swept ? "100%" : "0%",
              opacity: swept ? 0 : 1,
              transitionProperty: "left, opacity",
              transitionTimingFunction: "linear, linear",
              transitionDuration: sweeping ? `${secs.toFixed(2)}s, 200ms` : "0s, 0s",
              transitionDelay: sweeping ? `0s, ${secs.toFixed(2)}s` : "0s, 0s",
            }}
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
  const inView = useInView(ref, "-15% 0px -15% 0px");

  /**
   * The instrument's state, and the tour writes exactly the same four
   * pieces of it that the reader's hands do. That is why the handover costs
   * nothing to implement: the tour is not a separate mode, it is a hand on
   * the controls, and taking that hand off leaves everything where it was.
   *
   * Reduced motion opens on the stop the tour closes its loop on, complete
   * and fully read — every control labelled, the whole sentence in ink, no
   * timers anywhere. Which is the same frame as the first, because the loop
   * comes home.
   */
  const [relaxed, setRelaxed] = useState(STOPS[0].tone.at[0]);
  const [warm, setWarm] = useState(STOPS[0].tone.at[1]);
  const [lang, setLang] = useState<SetupLang>(STOPS[0].lang);
  const [voice, setVoice] = useState<SetupVoice>(STOPS[0].voice);
  const [run, setRun] = useState(0);
  const [cursor, setCursor] = useState(0);

  const [handedOver, setHandedOver] = useState(false);

  const [ms, setMs] = useState(0);
  const [running, setRunning] = useState(false);

  /**
   * The handover. Both writes are idempotent — React bails out when the
   * value is unchanged — so wiring this to the whole instrument through a
   * capture handler costs nothing after the first event, and there is no
   * path back: once the reader has touched anything the tour never moves
   * on its own again.
   */
  const engage = useCallback(() => {
    setHandedOver(true);
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
   * How long this stop is held: the house reading pace, floored by the time
   * the chosen voice actually needs to cross the sentence, plus a beat.
   *
   * `holdFor` alone would cut George off mid-line — he reads at 134 wpm and
   * a Romanian greeting is long — and the voice's own duration alone would
   * flick past a short English line before it can be read. The maximum of
   * the two is the only honest number: the line is legible *and* the
   * signature has finished being swept before the next hand moves.
   */
  const dwell = useMemo(() => {
    const n = greeting.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(holdFor(greeting), readSecs(n, voice.wpm) * 1000) + SETTLE;
  }, [greeting, voice.wpm]);

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
          writes and the two chip rails — they are one object and the card
          is how the light system says so.

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
              <SpokenGreeting
                greeting={greeting}
                voice={voice}
                run={run}
                live={inView}
              />
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
                  rises once on mount. Enter-only and nothing waits on the
                  old line to leave, so the row can be clicked along without
                  a hole opening under it. */}
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
