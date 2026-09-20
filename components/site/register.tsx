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
import { animate, motion, useInView, useReducedMotion } from "framer-motion";
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
import { CornerDot } from "./corner-dot";
import { EASE, MaskRise, Reveal } from "./reveal";

/**
 * Register — the three settings that decide what a caller actually hears.
 *
 * This replaces a four-screen setup wizard that used to stand here. The
 * wizard's premise was "live in ten minutes", and it spent two of its four
 * screens proving a thing nobody disputes: that a form can be filled in.
 * The reader was asked to name a company, pick a sector from the same eight
 * trades the industries section already owns, and press Continue three
 * times — and at the end of it had learned nothing about the product that
 * the first screen had not already shown them. A stepper is an argument
 * about effort. The argument worth making here is about *range*.
 *
 * So what survives is the one screen that was doing real work, opened out
 * into a single composition with no steps in it at all.
 *
 * Decisions worth keeping:
 *
 *  · **Register is a plane, not six cards.** The app offers six named
 *    personalities, which is a fine control and a poor argument — six cards
 *    say the agent has six settings. Plotted on two axes with a puck free
 *    between them, the same six say register is continuous and that a
 *    business can sit anywhere in it. Dragging rewrites the greeting under
 *    your hand, which is the only proof of that claim that matters.
 *  · **It is already speaking when you get here.** Nothing is asked of the
 *    reader before the section makes its case: the brief is filled, the
 *    greeting is read at the selected voice's own pace, and a second and a
 *    half after the section settles the puck drifts from Professional to
 *    Casual on its own so the sentence visibly rewrites itself before
 *    anybody has touched anything. The drift is handed over permanently on
 *    the first pointer, focus or key event — it demonstrates once and then
 *    it is the reader's instrument, never a loop playing over their input.
 *  · **Only the words that changed rise.** The drift crosses the `relaxed`
 *    threshold and not the `warm` one, which is chosen and not incidental:
 *    the opening formula is rewritten while the offer that follows it holds
 *    perfectly still. Eight words lift out of their clipping boxes and five
 *    do not move at all, and that difference is the whole demonstration —
 *    the reader can see exactly which part of the sentence the control they
 *    have not yet touched is wired to. It is the hero's own word-rise,
 *    spent on causation rather than on arrival.
 *  · **Nine languages, written rather than translated.** The chips under
 *    the plane carry each language's own name, because that is the evidence
 *    before anyone clicks: the formal register is held in all eight of the
 *    nine that have one, and a Polish caller gets a Polish sentence rather
 *    than the English one run through a dictionary. It is the strongest
 *    single thing on this page and it costs one row.
 *  · **The voice is read, not played, and it says so.** There is no audio
 *    here. A play button that produced silence would undo everything the
 *    rest of the section earns, so the control *reads*: the greeting
 *    crosses the voice's own signature at the voice's own words per minute,
 *    and those two numbers really are what differ between these voices.
 *    The four voice product pages do not exist yet, so nothing in this
 *    block links anywhere — the capability is demonstrated instead of
 *    advertised. The signature is drawn as one continuous envelope and not
 *    as a row of bars, because the header's Product menu already draws
 *    these same six voices as bars and two identical charts of the same
 *    data in one session is one chart too many.
 *  · **The clock is real.** It counts wall time from the reader's first
 *    touch, it pauses when the section leaves the viewport or the tab goes
 *    to the background, and nothing on the page can skip it to the end. A
 *    fabricated countdown that always lands at 09:5x would be the same
 *    trick as a fabricated dashboard and would cost the same thing. Which
 *    is why the copy has a branch for going past ten minutes: a page that
 *    invites you to measure it has to survive the measurement.
 *
 * `#how` is load-bearing and stays: the close's third receipt and the
 * second FAQ answer both point at this id.
 *
 * Two layout notes, both deliberate. The composition draws no card — the
 * section sits on the open field and is grouped by rules and space. The
 * pad's own square is the exception and it is an instrument surface rather
 * than a panel: a scatter plot with no plotting field is unreadable. And
 * the greeting comes *first* in the DOM, ordered back to the right column
 * from `md` up. On a phone the old version put it below the fold while you
 * dragged — you could not see the thing you were changing — and the helper
 * text hard-coded "the greeting on the right" on a screen that has no
 * right. Source order now reads the way the argument does at every width:
 * here is what the caller hears, and here is the control that wrote it.
 */

/* ---------------------------------------------------------------- *
 * Copy and constants owned by this section
 * ---------------------------------------------------------------- */

/**
 * The masthead's words live here rather than in `lib/site.ts`.
 *
 * The constant that used to supply them, `HOW_INTRO`, went out with the
 * wizard — it was written about a stepper ("four screens, ten minutes")
 * and there is no stepper left to describe. `lib/site.ts` is frozen, so
 * the replacement is declared at module scope here. If this copy is ever
 * wanted in two places it should be promoted back into the data file.
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

/**
 * Where the unattended drift starts and ends.
 *
 * Professional → Casual crosses the `relaxed` midpoint and stays below the
 * `warm` one, so `greetingFor` swaps the opening formula and leaves the
 * offer alone. That is what makes the rewrite legible: a drift that flipped
 * both thresholds would replace the whole sentence, and a sentence that
 * replaces itself entirely shows movement without showing cause.
 */
const DRIFT_FROM = TONES[1];
const DRIFT_TO = TONES[3];

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

const mmss = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

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

/** Monospace field label. Held at /45 — the caption floor, not below it. */
function Key({ children }: { children: React.ReactNode }) {
  return (
    <p className="mono text-[0.62em] uppercase leading-none tracking-[0.24em] text-[var(--cover-paper)]/45">
      {children}
    </p>
  );
}

/* ---------------------------------------------------------------- *
 * The register pad
 * ---------------------------------------------------------------- */

function RegisterPad({
  relaxed,
  warm,
  onChange,
  onEngage,
  driven,
}: {
  relaxed: number;
  warm: number;
  onChange: (relaxed: number, warm: number) => void;
  /** Fired on the first pointer, focus or key event the pad receives. */
  onEngage: () => void;
  /**
   * True while something other than the pointer is writing the value every
   * frame. The CSS ease below is for discrete jumps; left over a per-frame
   * animation it makes the puck trail its own coordinates.
   */
  driven?: boolean;
}) {
  const reduce = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
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
        "relative aspect-square w-full max-w-[24em] touch-none select-none rounded-[0.9em] border border-[var(--cover-paper)]/12 bg-[var(--cover-ink)]/30 outline-none",
        "focus-visible:border-[var(--cover-brand-lit)]/60 focus-visible:ring-2 focus-visible:ring-[var(--cover-brand-lit)]/40",
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
          <g key={p} stroke="var(--cover-paper)" strokeOpacity="0.07">
            <line x1={p} y1="0" x2={p} y2="100" strokeWidth="0.35" />
            <line x1="0" y1={p} x2="100" y2={p} strokeWidth="0.35" />
          </g>
        ))}
      </svg>

      {/* crosshair through the puck */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 w-px bg-[var(--cover-brand-lit)]/20"
        style={{ left: `${relaxed * 100}%` }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 h-px bg-[var(--cover-brand-lit)]/20"
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
        const pad =
          t.at[0] > 0.72
            ? { paddingRight: "1.35em" }
            : t.at[0] < 0.28
              ? { paddingLeft: "1.35em" }
              : { paddingTop: "2.1em" };

        return (
          <div key={t.id}>
            <button
              type="button"
              onClick={() => {
                onEngage();
                onChange(t.at[0], t.at[1]);
              }}
              aria-pressed={on}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full p-[0.5em] outline-none focus-visible:ring-2 focus-visible:ring-[var(--cover-brand-lit)]"
              style={{ left: `${t.at[0] * 100}%`, top: `${(1 - t.at[1]) * 100}%` }}
            >
              <span className="sr-only">
                {t.label} — {t.blurb}
              </span>
              <span
                aria-hidden
                className={cn(
                  "block size-[0.42em] rounded-full transition-colors duration-500",
                  on
                    ? "bg-[var(--cover-brand-lit)]"
                    : "bg-[var(--cover-paper)]/45",
                )}
              />
            </button>

            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute whitespace-nowrap text-[0.62em] leading-none transition-colors duration-500",
                on
                  ? "text-[var(--cover-brand-lit)]"
                  : "text-[var(--cover-paper)]/55",
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
          Its position is a style, not an animation target. Handing
          `left`/`top` to framer looked equivalent and was not: with no
          initial value to animate from it resolves `auto`, declines the
          unit change to a percentage, and leaves the puck pinned in the
          corner of the pad — the control reading exactly wrong while
          every label around it reads right. Declared here and eased by
          CSS, it is in the correct place on the first paint whether or
          not anything is animating at all.

          Its halo used to be a literal `rgba(192,172,224,0.12)` — the
          brand accent written out by hand. `.cover.hdr-light` flips these
          tokens, and a literal survives the flip as the wrong colour, so
          it is mixed off the token instead. */}
      <div
        aria-hidden
        className="pointer-events-none absolute size-[1.15em] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--cover-brand-lit)] bg-[var(--cover-ink)] shadow-[0_0_0_0.35em_color-mix(in_srgb,var(--cover-brand-lit)_12%,transparent)]"
        style={{
          left: `${relaxed * 100}%`,
          top: `${(1 - warm) * 100}%`,
          transitionProperty: "left, top",
          // Dragging must not be smoothed — the puck belongs under the
          // pointer, not trailing it. Neither must the drift, which writes
          // both coordinates on every frame of its own.
          transitionDuration: dragging || driven || reduce ? "0ms" : "320ms",
          transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      />

      {/* axes */}
      <span
        aria-hidden
        className="mono pointer-events-none absolute bottom-[0.6em] left-[0.8em] text-[0.55em] uppercase tracking-[0.2em] text-[var(--cover-paper)]/45"
      >
        measured
      </span>
      <span
        aria-hidden
        className="mono pointer-events-none absolute bottom-[0.6em] right-[0.8em] text-[0.55em] uppercase tracking-[0.2em] text-[var(--cover-paper)]/45"
      >
        relaxed
      </span>
      <span
        aria-hidden
        className="mono pointer-events-none absolute left-[0.8em] top-[0.7em] text-[0.55em] uppercase tracking-[0.2em] text-[var(--cover-paper)]/45"
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
  /** Bumped to re-read the same sentence. */
  run: number;
  /** The section is on screen — the read has something to be watched by. */
  live: boolean;
}) {
  const reduce = useReducedMotion();

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

  const secs = Math.max(2.2, (words.length / voice.wpm) * 60);

  /**
   * The duration is read through a ref so that a sentence rewritten *under*
   * a reading does not restart it. A rewrite mid-read is precisely what the
   * drift is demonstrating; restarting the sweep at that moment would wipe
   * the demonstration and reset the one clock on screen that is not the
   * section's clock.
   */
  const durRef = useRef(secs);
  useEffect(() => {
    durRef.current = secs;
  });

  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (reduce || !live) return;
    setProgress(0);
    const controls = animate(0, 1, {
      duration: durRef.current,
      ease: "linear",
      onUpdate: setProgress,
    });
    return () => controls.stop();
  }, [reduce, live, run, voice.id]);

  // Reduced motion asked for no sweep, and off-screen there is nobody to
  // watch one — both get the finished reading outright rather than a
  // sentence sitting dimmed at the quieter of its two tones.
  const at = reduce || !live ? 1 : progress;
  const spokenTo = Math.round(at * words.length);
  const d = useMemo(() => wavePath(voice), [voice]);

  /**
   * Memoised on the word count spoken, not on the sweep's own value.
   *
   * The sweep re-renders this component sixty times a second and the
   * sentence is a dozen `motion` components — but the only thing in it that
   * the sweep can change is which words are lit, which happens a dozen
   * times across the whole reading. Holding the element identity between
   * those steps lets React skip the subtree on every frame in between.
   */
  const line = useMemo(
    () => (
      <p className="text-[1.8em] font-medium leading-[1.15] tracking-[-0.04em]">
        {words.map((word, i) => (
          <span key={word.key}>
            <MaskRise
              lines={[word.w]}
              // Every word goes through the same primitive and the same
              // geometry; only the key decides which of them are new, and
              // a word whose key survives never re-runs its rise.
              className={cn(
                "inline-block transition-colors duration-200",
                i < spokenTo
                  ? "text-[var(--cover-paper)]"
                  : "text-[var(--cover-paper)]/75",
              )}
            />{" "}
          </span>
        ))}
      </p>
    ),
    [words, spokenTo],
  );

  return (
    <div>
      {line}

      {/* The reading. Silent, and the caption says so. */}
      <div className="mt-[1.4em]">
        <div className="relative h-[2.4em] w-full">
          <svg
            aria-hidden
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 size-full"
          >
            <path d={d} fill="var(--cover-paper)" fillOpacity="0.16" />
          </svg>
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ clipPath: `inset(0 ${(1 - at) * 100}% 0 0)` }}
          >
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 size-full"
            >
              <path d={d} fill="var(--cover-brand-lit)" fillOpacity="0.9" />
            </svg>
          </div>
          {at < 1 && (
            <div
              aria-hidden
              className="absolute inset-y-0 w-px bg-[var(--cover-brand-lit)]"
              style={{ left: `${at * 100}%` }}
            />
          )}
        </div>

        <p className="mono mt-[0.8em] text-[0.62em] uppercase leading-none tracking-[0.18em] text-[var(--cover-paper)]/45">
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
  const reduce = useReducedMotion();

  const ref = useRef<HTMLDivElement>(null);
  // Two readings of the same element, for two different jobs. The clock
  // needs to know whether the reader is still here, every time; the demo
  // needs to fire once and never again.
  const inView = useInView(ref, { margin: "-15% 0px -15% 0px" });
  const arrived = useInView(ref, {
    once: true,
    margin: "-20% 0px -20% 0px",
  });

  const [relaxed, setRelaxed] = useState(DRIFT_FROM.at[0]);
  const [warm, setWarm] = useState(DRIFT_FROM.at[1]);
  const [lang, setLang] = useState<SetupLang>(SETUP_LANGS[0]);
  const [voice, setVoice] = useState<SetupVoice>(SETUP_VOICES[0]);
  const [run, setRun] = useState(0);

  const [handedOver, setHandedOver] = useState(false);
  const [drifting, setDrifting] = useState(false);

  const [ms, setMs] = useState(0);
  const [running, setRunning] = useState(false);

  /**
   * The handover. Both writes are idempotent — React bails out when the
   * value is unchanged — so wiring this to every control costs nothing
   * after the first one, and there is no path back: once the reader has
   * touched the pad the section never moves on its own again.
   */
  const engage = useCallback(() => {
    setHandedOver(true);
    setRunning(true);
  }, []);

  /**
   * The unattended drift. Professional → Casual, once, a beat after the
   * section settles.
   *
   * It writes the same two numbers the pointer writes, which is why it can
   * be interrupted by simply not running: the cleanup stops the animation
   * and the puck stays exactly where the drift had got to, under the
   * reader's hand from that frame on.
   */
  useEffect(() => {
    if (reduce || handedOver || !arrived) return;
    let controls: ReturnType<typeof animate> | undefined;
    const id = setTimeout(() => {
      setDrifting(true);
      controls = animate(0, 1, {
        duration: 1.15,
        ease: EASE,
        onUpdate: (p) => {
          setRelaxed(DRIFT_FROM.at[0] + (DRIFT_TO.at[0] - DRIFT_FROM.at[0]) * p);
          setWarm(DRIFT_FROM.at[1] + (DRIFT_TO.at[1] - DRIFT_FROM.at[1]) * p);
        },
        onComplete: () => setDrifting(false),
      });
    }, 1600);

    return () => {
      clearTimeout(id);
      controls?.stop();
      setDrifting(false);
    };
  }, [reduce, handedOver, arrived]);

  /**
   * The clock. Wall time, from the reader's first touch, paused whenever
   * they are not actually here. Deltas rather than a start timestamp, so a
   * pause simply stops accumulating instead of having to be subtracted back
   * out afterwards.
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
    const id = setInterval(() => {
      const now = Date.now();
      const d = now - last;
      last = now;
      if (d < 1000) setMs((m) => m + d);
    }, 200);
    return () => clearInterval(id);
  }, [running, inView]);

  const tone = useMemo(() => nearestTone(relaxed, warm), [relaxed, warm]);

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

  const over = ms > BUDGET;

  const chip =
    "shrink-0 rounded-[0.5em] border px-[0.85em] py-[0.5em] text-left leading-none transition-colors duration-500 outline-none focus-visible:ring-2 focus-visible:ring-[var(--cover-brand-lit)]/50";
  const chipOn =
    "border-[var(--cover-brand-lit)]/55 bg-[var(--cover-brand-lit)]/12 text-[var(--cover-brand-lit)]";
  const chipOff =
    "border-[var(--cover-paper)]/12 text-[var(--cover-paper)]/75 hover:border-[var(--cover-paper)]/35 hover:text-[var(--cover-paper)]";

  return (
    <section
      id="how"
      className="relative scroll-mt-24 px-[1.6em] py-[6em] md:py-[8em]"
    >
      <div className="relative mx-auto max-w-[76em]">
        {/* masthead */}
        <Reveal>
          <div className="flex items-center gap-[0.7em]">
            <CornerDot className="size-[0.55em]" />
            <span className="mono text-[0.7em] uppercase tracking-[0.24em] text-[var(--cover-paper)]/45">
              07
            </span>
            <span className="mono text-[0.7em] uppercase tracking-[0.24em] text-[var(--cover-paper)]/45">
              {KICKER}
            </span>
          </div>

          <h2 className="mt-[0.9em] text-balance text-[2.8em] font-medium leading-[1.03] tracking-[-0.045em] md:text-[3.4em]">
            {TITLE}
          </h2>

          <p className="mt-[1em] max-w-[44em] text-pretty text-[1.05em] leading-[1.6] text-[var(--cover-paper)]/75">
            {SUB}
          </p>

          <div className="mt-[2.2em] h-px bg-[var(--cover-paper)]/12" />
        </Reveal>

        {/* the instrument */}
        <div
          ref={ref}
          className="mt-[3em] grid gap-[3em] md:mt-[3.6em] md:grid-cols-12 md:gap-[3.5em]"
        >
          {/* What the caller hears. First in source, right-hand column from
              md up — see the note at the top of the file. Not wrapped in a
              Reveal: its own words rising out of their clipping boxes are
              the arrival, and a fade underneath them would be a second
              animation saying the same thing more quietly. */}
          <div className="order-1 md:order-2 md:col-span-5">
            <div className="flex items-baseline justify-between gap-[1em]">
              <Key>Opens with</Key>
              <button
                type="button"
                onClick={() => {
                  engage();
                  setRun((r) => r + 1);
                }}
                className="mono flex items-center gap-[0.45em] text-[0.62em] uppercase leading-none tracking-[0.18em] text-[var(--cover-paper)]/45 outline-none transition-colors duration-500 hover:text-[var(--cover-paper)] focus-visible:text-[var(--cover-paper)]"
              >
                <RotateCcw className="size-[1.15em]" strokeWidth={2.2} />
                Read again
              </button>
            </div>

            <div className="mt-[1.1em]">
              <SpokenGreeting
                greeting={greeting}
                voice={voice}
                run={run}
                live={arrived}
              />
            </div>

            {/* The voice showcase. Six voices, one row, and not one of them
                links anywhere: the library, the cloning, the synthesis and
                the transcription pages do not exist yet, and a capability
                is better demonstrated than promised. */}
            <div className="mt-[2.4em] border-t border-[var(--cover-paper)]/12 pt-[1.6em]">
              <Key>Read by</Key>
              <div className="mt-[0.9em] flex gap-[0.4em] overflow-x-auto pb-[0.3em] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                      className={cn(chip, on ? chipOn : chipOff)}
                    >
                      <span className="block text-[0.85em] leading-none">
                        {v.name}
                      </span>
                      <span className="mono mt-[0.5em] block text-[0.58em] uppercase leading-none tracking-[0.12em] opacity-70">
                        {v.wpm} wpm
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Keyed and enter-only, with no AnimatePresence — nothing
                  waits on the old line to leave, so the row can be clicked
                  along without a hole opening under it. */}
              <motion.p
                key={voice.id}
                initial={reduce ? false : { opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="mt-[1.1em] max-w-[28em] text-[0.88em] leading-[1.6] text-[var(--cover-paper)]/75"
              >
                {voiceNote(voice)}
              </motion.p>
            </div>
          </div>

          {/* The control that wrote it. */}
          <Reveal y={28} className="order-2 md:order-1 md:col-span-7">
            <div className="flex items-baseline justify-between gap-[1em]">
              <Key>Register</Key>
              <span className="flex items-baseline gap-[0.6em]">
                <span
                  className={cn(
                    "mono text-[1.15em] leading-none tabular-nums transition-colors duration-500",
                    running
                      ? "text-[var(--cover-paper)]"
                      : "text-[var(--cover-paper)]/45",
                  )}
                >
                  {mmss(ms)}
                </span>
                <span className="mono text-[0.62em] uppercase leading-none tracking-[0.2em] text-[var(--cover-paper)]/45">
                  {over ? "past our ten" : running ? "tuning" : "of 10:00"}
                </span>
              </span>
            </div>

            <div className="mt-[1.1em]">
              <RegisterPad
                relaxed={relaxed}
                warm={warm}
                onChange={(r, w) => {
                  setRelaxed(r);
                  setWarm(w);
                }}
                onEngage={engage}
                driven={drifting}
              />
            </div>

            <p className="mt-[1.2em] max-w-[24em] text-[0.95em] leading-[1.55]">
              <span className="text-[var(--cover-brand-lit)]">{tone.label}</span>
              <span className="text-[var(--cover-paper)]/75">
                {" "}
                — {tone.blurb.toLowerCase()}.
              </span>
            </p>

            {/* Nine languages, under the plane, each in its own writing.
                The chip is the evidence before anybody clicks it. */}
            <div className="mt-[2.4em] border-t border-[var(--cover-paper)]/12 pt-[1.6em]">
              <Key>Answers in</Key>
              <div className="mt-[0.9em] flex flex-wrap gap-[0.35em]">
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
                      className={cn(
                        chip,
                        "text-[0.85em]",
                        on ? chipOn : chipOff,
                      )}
                    >
                      {l.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </Reveal>
        </div>

        {/* provenance — the clock is real, and it says what it measures */}
        <div className="mt-[3.2em] border-t border-[var(--cover-paper)]/12 pt-[1.4em]">
          <p className="max-w-[52em] text-[0.82em] leading-[1.7] text-[var(--cover-paper)]/75">
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
            the voice&rsquo;s own pitch, and the sentence crosses it at the
            words per minute that voice really reads at. Nine languages here;
            the app carries more.
          </p>
        </div>

        {/* One line for a screen reader, on the one thing this section
            exists to state. The tone label is deliberately left out of it:
            it changes continuously under a drag, and a live region that
            fires six times per gesture announces nothing. */}
        <p aria-live="polite" className="sr-only">
          {`In ${lang.name}, read by ${voice.name}, ${voice.accent}: “${greeting}”`}
        </p>
      </div>
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
