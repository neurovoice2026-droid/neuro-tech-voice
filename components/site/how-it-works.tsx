"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  motion,
  AnimatePresence,
  animate,
  useInView,
  useMotionValue,
  useReducedMotion,
} from "framer-motion";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  Hash,
  RotateCcw,
  Timer,
} from "lucide-react";
import {
  HOW_INTRO,
  INDUSTRIES,
  SETUP_LANGS,
  SETUP_STEPS,
  SETUP_VOICES,
  TONES,
  greetingFor,
  type Industry,
  type SetupLang,
  type SetupVoice,
  type Tone,
} from "@/lib/site";
import { cn } from "@/lib/utils";
import { Reveal, EASE } from "./reveal";

/**
 * How it works — the setup, handed over.
 *
 * The section used to be three tiles: an icon, a numeral, a sentence. The
 * sentence said "live in under 10 minutes", which is the one claim on this
 * page a tile is structurally unable to make. Nothing about a tile is
 * timed. A reader who does not already believe the number is given no way
 * to test it, and a reader who does gains nothing from reading it.
 *
 * So the section hands over the wizard instead. Every decision below is one
 * the real four screens ask for — the company and its trade, the register
 * and the language, the voice — and a clock runs while the reader makes
 * them. The claim is not asserted anywhere in this file. It is measured,
 * and the measurement is the reader's own.
 *
 * Three decisions worth keeping:
 *
 *  · **The clock is real.** It counts wall time from the first interaction,
 *    and it pauses when the section leaves the viewport or the tab goes to
 *    the background, because it is measuring a setup rather than a visit. A
 *    fabricated countdown that always lands at 09:5x would be the same
 *    trick as a fabricated dashboard, and it would cost the same thing.
 *    Which is why the result copy has a branch for going over ten minutes:
 *    a page that dares you to beat a number has to survive you not doing it.
 *  · **Register is a plane, not six cards.** The wizard offers six named
 *    personalities, which is a fine control and a poor argument — six cards
 *    say the agent has six settings. Plotted on two axes with a puck free
 *    between them, the same six say register is continuous and that a
 *    business can sit anywhere in it. Dragging rewrites the greeting under
 *    your hand, which is the only proof of the claim that matters.
 *  · **The voice is read, not previewed.** There is no audio on this page.
 *    A play button that produces silence would undo everything the rest of
 *    the panel earns, so the control says *read*: the greeting crosses the
 *    voice's own signature at the voice's own words per minute. Those two
 *    numbers really are what differ between these voices, and they are
 *    printed next to it.
 *
 * Colour and scale are the interior spread's — --cover-panel for the
 * instrument, --cover-brand-lit as the only accent, every length in `em`
 * off `.cover`'s fluid base. Nothing here is borrowed from the product's
 * own onboarding but its questions.
 */

/* ---------------------------------------------------------------- *
 * Small shared bits
 * ---------------------------------------------------------------- */

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

const mmss = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/** The ten minutes the section is being measured against, in ms. */
const BUDGET = 10 * 60 * 1000;

/** Defaults the panel opens on, so nothing is ever half-built. */
const FALLBACK_COMPANY = "Acme Dental";
const FALLBACK_AGENT = "Sarah";

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

/**
 * A voice's signature, from its own two numbers.
 *
 * Deliberately not seeded noise. Noise would draw a waveform that looks
 * different per voice while meaning nothing, which is the decorative
 * version of this control; a carrier at the voice's pitch under a speech
 * envelope, roughened at a rate set by its pace, draws one that differs
 * because the voice differs. Low and slow reads as long swells, high and
 * quick as a tight chatter, and that is what those voices are.
 */
function signature(v: SetupVoice, n: number) {
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    const carrier = Math.sin(t * Math.PI * 2 * (2.5 + v.pitch * 5.5));
    const grain = Math.sin(t * Math.PI * 2 * (9 + v.wpm / 18));
    // Speech tails off at both ends of a phrase; a flat block reads as a
    // meter rather than as an utterance.
    const env = Math.sin(t * Math.PI) ** 0.55;
    return (0.22 + 0.78 * Math.abs(carrier * 0.72 + grain * 0.28)) * env;
  });
}

/** Monospace field label, used down the whole panel. */
function Key({ children }: { children: React.ReactNode }) {
  return (
    <p className="mono text-[0.58em] uppercase tracking-[0.24em] text-[var(--cover-paper)]/35">
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
}: {
  relaxed: number;
  warm: number;
  onChange: (relaxed: number, warm: number) => void;
}) {
  const reduce = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

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
    onChange(clamp01(relaxed + dx), clamp01(warm + dy));
  };

  return (
    <div>
      <div
        ref={box}
        role="group"
        aria-label="Register — drag to place the agent between the named tones, or choose one directly."
        tabIndex={0}
        onKeyDown={key}
        onPointerDown={(e) => {
          // Capture, so a drag that leaves the square keeps feeding it
          // instead of dropping the puck wherever the pointer crossed out.
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
          at(e);
        }}
        onPointerMove={(e) => dragging && at(e)}
        onPointerUp={(e) => {
          e.currentTarget.releasePointerCapture(e.pointerId);
          setDragging(false);
        }}
        onPointerCancel={() => setDragging(false)}
        className={cn(
          "relative aspect-square w-full max-w-[21em] touch-none select-none rounded-[0.9em] border border-[var(--cover-paper)]/12 bg-[var(--cover-ink)]/35 outline-none",
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
          const on = nearestTone(relaxed, warm).id === t.id;
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
                onClick={() => onChange(t.at[0], t.at[1])}
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
                    "block size-[0.42em] rounded-full transition-colors duration-200",
                    on
                      ? "bg-[var(--cover-brand-lit)]"
                      : "bg-[var(--cover-paper)]/30",
                  )}
                />
              </button>

              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute whitespace-nowrap text-[0.62em] leading-none transition-colors duration-200",
                  on
                    ? "text-[var(--cover-brand-lit)]"
                    : "text-[var(--cover-paper)]/35",
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
            not anything is animating at all. */}
        <div
          aria-hidden
          className="pointer-events-none absolute size-[1.15em] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--cover-brand-lit)] bg-[var(--cover-ink)] shadow-[0_0_0_0.35em_rgba(192,172,224,0.12)]"
          style={{
            left: `${relaxed * 100}%`,
            top: `${(1 - warm) * 100}%`,
            transitionProperty: "left, top",
            // Dragging must not be smoothed — the puck belongs under the
            // pointer, not trailing it.
            transitionDuration: dragging || reduce ? "0ms" : "320ms",
            transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />

        {/* axes */}
        <span
          aria-hidden
          className="mono pointer-events-none absolute bottom-[0.6em] left-[0.8em] text-[0.55em] uppercase tracking-[0.2em] text-[var(--cover-paper)]/25"
        >
          measured
        </span>
        <span
          aria-hidden
          className="mono pointer-events-none absolute bottom-[0.6em] right-[0.8em] text-[0.55em] uppercase tracking-[0.2em] text-[var(--cover-paper)]/25"
        >
          relaxed
        </span>
        <span
          aria-hidden
          className="mono pointer-events-none absolute left-[0.8em] top-[0.7em] text-[0.55em] uppercase tracking-[0.2em] text-[var(--cover-paper)]/25"
        >
          warm
        </span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- *
 * The voice, read rather than played
 * ---------------------------------------------------------------- */

const SIG_BARS = 44;

function VoiceReader({
  voice,
  text,
  run,
}: {
  voice: SetupVoice;
  text: string;
  run: number;
}) {
  const reduce = useReducedMotion();
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);
  const bars = useMemo(() => signature(voice, SIG_BARS), [voice]);
  // The whole point of `wpm`: the same greeting takes George four seconds
  // longer than Laura, and you can see it take them.
  const secs = Math.max(2.4, (words.length / voice.wpm) * 60);

  const mv = useMotionValue(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (reduce) return;
    // Rewound before the subscription rather than after, so the reset costs
    // no render of its own — the state is already 0 when it lands.
    mv.set(0);
    const controls = animate(mv, 1, { duration: secs, ease: "linear" });
    const unsub = mv.on("change", setProgress);
    return () => {
      controls.stop();
      unsub();
    };
  }, [mv, secs, run, text, voice.id, reduce]);

  // Reduced motion has asked for no sweep, and the sweep is the control —
  // so it gets the finished reading outright. Derived rather than written
  // from the effect, as CountUp and Tally do it: the value is a pure
  // function of a prop we already hold.
  const at = reduce ? 1 : progress;
  const spoken = Math.round(at * words.length);

  return (
    <div>
      <div className="flex items-end gap-[0.12em] h-[3.4em]">
        {bars.map((h, i) => {
          const lit = i / (SIG_BARS - 1) <= at;
          return (
            <span
              key={i}
              className={cn(
                "flex-1 rounded-full transition-colors duration-150",
                lit
                  ? "bg-[var(--cover-brand-lit)]"
                  : "bg-[var(--cover-paper)]/15",
              )}
              style={{ height: `${Math.max(4, h * 100)}%` }}
            />
          );
        })}
      </div>

      <p className="mt-[1.1em] text-[1.05em] leading-[1.55] tracking-[-0.015em]">
        {words.map((w, i) => (
          <span
            key={i}
            className={cn(
              "transition-colors duration-150",
              i < spoken
                ? "text-[var(--cover-paper)]"
                : "text-[var(--cover-paper)]/28",
            )}
          >
            {w}{" "}
          </span>
        ))}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- *
 * The brief — the artifact the four steps are assembling
 * ---------------------------------------------------------------- */

function Field({
  label,
  value,
  ready,
  provisional,
}: {
  label: string;
  value: string;
  ready: boolean;
  /** True while the value is still the default we filled in for them. */
  provisional?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-[1em] border-b border-[var(--cover-paper)]/[0.07] py-[0.6em]">
      <Key>{label}</Key>
      {ready ? (
        <motion.span
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          className={cn(
            "min-w-0 truncate text-right text-[0.85em] leading-tight",
            provisional
              ? "text-[var(--cover-paper)]/40"
              : "text-[var(--cover-paper)]/85",
          )}
        >
          {value}
        </motion.span>
      ) : (
        <span
          aria-hidden
          className="h-px w-[4.5em] shrink-0 border-b border-dashed border-[var(--cover-paper)]/20"
        />
      )}
    </div>
  );
}

function Brief({
  step,
  company,
  companyTyped,
  trade,
  agentName,
  agentTyped,
  tone,
  lang,
  voice,
  greeting,
  live,
}: {
  step: number;
  company: string;
  companyTyped: boolean;
  trade: Industry;
  agentName: string;
  agentTyped: boolean;
  tone: Tone;
  lang: SetupLang;
  voice: SetupVoice;
  greeting: string;
  live: boolean;
}) {
  return (
    <div className="relative">
      <div className="flex items-baseline justify-between gap-[1em]">
        <Key>Agent brief</Key>
        <span className="mono text-[0.58em] uppercase tracking-[0.24em] text-[var(--cover-paper)]/25">
          {live ? "sealed" : "drafting"}
        </span>
      </div>

      <div className="mt-[1.2em]">
        <Field label="Account" value={company} ready provisional={!companyTyped} />
        <Field label="Sector" value={trade.label} ready />
        <Field
          label="Agent"
          value={agentName}
          ready={step >= 1}
          provisional={!agentTyped}
        />
        <Field label="Register" value={tone.label} ready={step >= 1} />
        <Field label="Language" value={lang.name} ready={step >= 1} />
        <Field
          label="Voice"
          value={`${voice.name} · ${voice.accent.replace("English · ", "")}`}
          ready={step >= 2}
        />
      </div>

      {/* The greeting is the artifact's headline — it is the one line every
          caller hears, and it is assembled from four of the six fields
          above. Held back until the register exists to write it. */}
      <div className="mt-[1.6em]">
        <Key>Opens with</Key>
        {/* Keyed on the sentence so a new one rises in, but with nothing
            waiting on the old one to leave. The register pad rewrites this
            line mid-drag; a queued exit would put a hole in it at exactly
            the moment the reader is watching to see whether it responds. */}
        {step >= 1 ? (
          <motion.p
            key={greeting}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="mt-[0.7em] text-balance text-[1.05em] leading-[1.45] tracking-[-0.02em] text-[var(--cover-brand-lit)]"
          >
            &ldquo;{greeting}&rdquo;
          </motion.p>
        ) : (
          <p className="mt-[0.7em] text-[0.9em] leading-[1.5] text-[var(--cover-paper)]/30">
            Written once the agent has a register.
          </p>
        )}
      </div>

      {/* Standing orders come from the trade, not from the reader — which is
          the quiet argument of step one. Choosing a sector is not filing
          paperwork; it is what the agent already knows on day zero. */}
      <div className="mt-[1.6em]">
        <Key>Standing orders</Key>
        <ul className="mt-[0.8em] flex flex-col gap-[0.55em]">
          {trade.jobs.map((j, i) => (
            <motion.li
              key={j}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: i * 0.06, ease: EASE }}
              className="flex items-baseline gap-[0.7em] text-[0.8em] leading-[1.45] text-[var(--cover-paper)]/60"
            >
              <span className="mono shrink-0 text-[0.8em] text-[var(--cover-brand-lit)]/60">
                {String(i + 1).padStart(2, "0")}
              </span>
              {j}
            </motion.li>
          ))}
        </ul>
      </div>

      <AnimatePresence>
        {live && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, rotate: -14 }}
            animate={{ opacity: 1, scale: 1, rotate: -9 }}
            transition={{ type: "spring", stiffness: 260, damping: 16 }}
            className="pointer-events-none absolute -right-[0.4em] bottom-[1em] grid place-items-center rounded-[0.4em] border-2 border-[var(--cover-brand-lit)]/70 px-[0.9em] py-[0.45em]"
          >
            <span className="mono text-[0.62em] font-semibold uppercase leading-none tracking-[0.2em] text-[var(--cover-brand-lit)]/80">
              In service
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------------------------------------------------------- *
 * Section
 * ---------------------------------------------------------------- */

const LAUNCH_CHECKS = [
  { icon: Hash, label: "Number connected", note: "No porting, no hardware" },
  { icon: CalendarCheck, label: "Calendar linked", note: "Writes straight in" },
  { icon: Timer, label: "Answering", note: "First ring, every hour" },
];

export function HowItWorks() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-15% 0px -15% 0px" });

  const [step, setStep] = useState(0);
  const [company, setCompany] = useState("");
  const [trade, setTrade] = useState<Industry>(INDUSTRIES[0]);
  const [agentName, setAgentName] = useState("");
  const [relaxed, setRelaxed] = useState(TONES[1].at[0]);
  const [warm, setWarm] = useState(TONES[1].at[1]);
  const [lang, setLang] = useState<SetupLang>(SETUP_LANGS[0]);
  const [voice, setVoice] = useState<SetupVoice>(SETUP_VOICES[0]);
  const [read, setRead] = useState(0);

  const [ms, setMs] = useState(0);
  const [running, setRunning] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [splits, setSplits] = useState<Record<string, number>>({});

  /**
   * The clock. Wall time, from the first interaction, paused whenever the
   * reader is not actually doing the setup. Deltas rather than a start
   * timestamp, so every pause simply stops accumulating instead of having
   * to be subtracted back out afterwards.
   *
   * Backgrounding is caught by the size of the tick rather than by
   * `document.hidden`. A tick far longer than its own interval means the
   * timer was throttled, which is what a background tab or a sleeping
   * machine does to it — and that time was not spent on the setup. Reading
   * the visibility API directly looked cleaner and was wrong: window
   * managers report `hidden` for windows that are plainly on screen, and a
   * clock that silently refuses to run makes the panel look broken rather
   * than honest.
   */
  useEffect(() => {
    if (!running || stopped || !inView) return;
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const d = now - last;
      last = now;
      if (d < 1000) setMs((m) => m + d);
    }, 200);
    return () => clearInterval(id);
  }, [running, stopped, inView]);

  // Idempotent: React bails out when the value is unchanged, so wiring this
  // to every control on the panel costs nothing after the first one.
  const begin = useCallback(() => setRunning(true), []);

  const tone = useMemo(() => nearestTone(relaxed, warm), [relaxed, warm]);
  const companyTyped = company.trim().length > 0;
  const agentTyped = agentName.trim().length > 0;
  const shownCompany = companyTyped ? company.trim() : FALLBACK_COMPANY;
  const shownAgent = agentTyped ? agentName.trim() : FALLBACK_AGENT;

  const greeting = useMemo(
    () =>
      greetingFor({
        lang,
        company: shownCompany,
        agent: shownAgent,
        relaxed,
        warm,
      }),
    [lang, shownCompany, shownAgent, relaxed, warm],
  );

  const go = (to: number) => {
    begin();
    if (to > step) {
      // Stamp every step we are leaving behind, so jumping the rail forward
      // cannot leave a gap in the splits.
      setSplits((s) => {
        const next = { ...s };
        for (let i = step; i < to; i++) next[SETUP_STEPS[i].id] = ms;
        return next;
      });
    }
    if (to >= 3) setStopped(true);
    setStep(Math.min(3, Math.max(0, to)));
  };

  const reset = () => {
    setStep(0);
    setCompany("");
    setTrade(INDUSTRIES[0]);
    setAgentName("");
    setRelaxed(TONES[1].at[0]);
    setWarm(TONES[1].at[1]);
    setLang(SETUP_LANGS[0]);
    setVoice(SETUP_VOICES[0]);
    setMs(0);
    setRunning(false);
    setStopped(false);
    setSplits({});
  };

  const live = step >= 3;
  const underBudget = ms <= BUDGET;

  return (
    <section
      id="how"
      className="relative scroll-mt-24 px-[1.6em] py-[6em] md:py-[8em]"
    >
      <div className="relative mx-auto max-w-[76em]">
        {/* header */}
        <div className="mx-auto flex max-w-[40em] flex-col items-center text-center">
          <Reveal>
            <span className="inline-flex items-center gap-[0.55em] rounded-full border border-[var(--cover-brand-lit)]/25 bg-[var(--cover-brand-lit)]/10 px-[1.15em] py-[0.5em] text-[0.72em] font-semibold uppercase leading-none tracking-[0.18em] text-[var(--cover-brand-lit)]">
              <Timer className="size-[1.25em] shrink-0" strokeWidth={2} />
              {HOW_INTRO.eyebrow}
            </span>
          </Reveal>

          <Reveal delay={0.06} className="mt-[1em]">
            <h2 className="text-balance text-[2.8em] font-medium leading-[1.03] tracking-[-0.045em] md:text-[3.4em]">
              {HOW_INTRO.title}
            </h2>
          </Reveal>

          <Reveal
            delay={0.12}
            className="mt-[1.1em] max-w-[34em] text-pretty text-[1.05em] leading-[1.6] text-[var(--cover-paper)]/60"
          >
            {HOW_INTRO.sub}
          </Reveal>
        </div>

        {/* the instrument */}
        <Reveal delay={0.08} y={32} className="mt-[3.5em] md:mt-[4.5em]">
          <div
            ref={ref}
            className="overflow-hidden rounded-[1.2em] border border-[var(--cover-paper)]/12 bg-[var(--cover-panel)] shadow-[0_2em_5em_-1.8em_rgba(0,0,0,0.9)]"
          >
            {/* rail + clock */}
            {/* Four steps and a clock cannot share a phone's width: at
                flex-1 each they squeeze to about fifty pixels and the whole
                rail becomes ellipses. So on a phone the steps keep their
                natural width and scroll as one row, and the clock drops
                below them onto a line of its own. From `md` up it is the
                single row it always was. */}
            <div className="flex flex-col gap-[0.7em] border-b border-[var(--cover-paper)]/10 px-[1.2em] py-[0.9em] md:flex-row md:items-stretch md:gap-[1.4em] md:px-[2em]">
              <div className="flex min-w-0 flex-1 items-stretch gap-[0.3em] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {SETUP_STEPS.map((s, i) => {
                  const done = i < step;
                  const on = i === step;
                  const Icon = s.icon;
                  const split = splits[s.id];

                  return (
                    <button
                      key={s.id}
                      type="button"
                      // Forward is the wizard's own affordance; back is free,
                      // because a reader who wants to re-drag the register
                      // should not have to re-run the whole setup to reach it.
                      onClick={() => go(i)}
                      aria-current={on ? "step" : undefined}
                      className={cn(
                        "group relative w-[11em] shrink-0 rounded-[0.6em] px-[0.7em] py-[0.55em] text-left transition-colors duration-200 md:w-auto md:min-w-0 md:flex-1",
                        on
                          ? "bg-[var(--cover-paper)]/[0.07]"
                          : "hover:bg-[var(--cover-paper)]/[0.04]",
                      )}
                    >
                      <span className="flex items-center gap-[0.5em]">
                        <span
                          aria-hidden
                          className={cn(
                            "grid size-[1.5em] shrink-0 place-items-center rounded-full transition-colors duration-300",
                            done
                              ? "bg-[var(--cover-brand-lit)] text-[var(--cover-ink)]"
                              : on
                                ? "border border-[var(--cover-brand-lit)] text-[var(--cover-brand-lit)]"
                                : "border border-[var(--cover-paper)]/20 text-[var(--cover-paper)]/35",
                          )}
                        >
                          {done ? (
                            <Check className="size-[0.85em]" strokeWidth={3} />
                          ) : (
                            <Icon className="size-[0.85em]" strokeWidth={2} />
                          )}
                        </span>
                        <span
                          className={cn(
                            "truncate text-[0.8em] leading-none transition-colors duration-200",
                            on
                              ? "text-[var(--cover-paper)]"
                              : done
                                ? "text-[var(--cover-paper)]/70"
                                : "text-[var(--cover-paper)]/40",
                          )}
                        >
                          {s.label}
                        </span>
                      </span>

                      <span className="mono mt-[0.5em] block truncate text-[0.58em] uppercase tracking-[0.14em] text-[var(--cover-paper)]/30">
                        {split !== undefined ? mmss(split) : s.decides}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* The claim, running. */}
              <div className="flex shrink-0 items-baseline justify-between gap-[0.8em] border-t border-[var(--cover-paper)]/10 pt-[0.7em] md:flex-col md:items-end md:justify-center md:border-l md:border-t-0 md:pl-[1.4em] md:pt-0">
                <span
                  className={cn(
                    "mono text-[1.5em] leading-none tabular-nums transition-colors duration-500",
                    stopped
                      ? "text-[var(--cover-brand-lit)]"
                      : running
                        ? "text-[var(--cover-paper)]"
                        : "text-[var(--cover-paper)]/30",
                  )}
                >
                  {mmss(ms)}
                </span>
                <span className="mono text-[0.58em] uppercase tracking-[0.2em] text-[var(--cover-paper)]/30 md:mt-[0.5em]">
                  {stopped ? "to live" : running ? "elapsed" : "of 10:00"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5">
              {/* controls */}
              <div
                className="border-b border-[var(--cover-paper)]/10 p-[1.6em] md:col-span-3 md:border-b-0 md:border-r md:p-[2em]"
                onPointerDown={begin}
              >
                {/* Keyed and enter-only, with no AnimatePresence around it.
                    `mode="wait"` holds the outgoing step until its exit
                    finishes, which buys a blank column between every two
                    steps and — because a hidden document runs no rAF at all
                    — strands the panel on the old step outright if the tab
                    is backgrounded across the transition. The step content
                    is the panel; it does not get to be conditional on an
                    animation completing. */}
                <div>
                  <motion.div
                    key={step}
                    initial={reduce ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.32, ease: EASE }}
                  >
                    {step === 0 && (
                      <div>
                        <Key>Who the agent answers for</Key>
                        <input
                          value={company}
                          onChange={(e) => {
                            begin();
                            setCompany(e.target.value.slice(0, 38));
                          }}
                          onFocus={begin}
                          placeholder={FALLBACK_COMPANY}
                          aria-label="Company name"
                          className="mt-[0.6em] w-full border-b border-[var(--cover-paper)]/15 bg-transparent pb-[0.4em] text-[1.9em] font-medium leading-tight tracking-[-0.035em] text-[var(--cover-paper)] outline-none transition-colors duration-200 placeholder:text-[var(--cover-paper)]/22 focus:border-[var(--cover-brand-lit)]/60"
                        />

                        <div className="mt-[2em]">
                          <Key>Sector</Key>
                          <div className="mt-[0.8em] flex flex-wrap gap-[0.4em]">
                            {INDUSTRIES.map((ind) => {
                              const on = ind.id === trade.id;
                              const Icon = ind.icon;
                              return (
                                <button
                                  key={ind.id}
                                  type="button"
                                  onClick={() => {
                                    begin();
                                    setTrade(ind);
                                  }}
                                  aria-pressed={on}
                                  aria-label={ind.label}
                                  title={ind.label}
                                  className={cn(
                                    "grid size-[2.9em] place-items-center rounded-[0.6em] border transition-colors duration-200",
                                    on
                                      ? "border-[var(--cover-brand-lit)]/60 bg-[var(--cover-brand-lit)]/12 text-[var(--cover-brand-lit)]"
                                      : "border-[var(--cover-paper)]/12 text-[var(--cover-paper)]/40 hover:border-[var(--cover-paper)]/30 hover:text-[var(--cover-paper)]/75",
                                  )}
                                >
                                  <Icon
                                    className="size-[1.2em]"
                                    strokeWidth={1.8}
                                  />
                                </button>
                              );
                            })}
                          </div>

                          <motion.p
                            key={trade.id}
                            initial={reduce ? false : { opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, ease: EASE }}
                            className="mt-[1.1em] max-w-[26em] text-[0.9em] leading-[1.6] text-[var(--cover-paper)]/55"
                          >
                            <span className="text-[var(--cover-paper)]">
                              {trade.label}.
                            </span>{" "}
                            Your agent starts pre-briefed — it already
                            {" "}{trade.jobs[0].toLowerCase()}, before you have
                            written a word of script.
                          </motion.p>
                        </div>
                      </div>
                    )}

                    {step === 1 && (
                      <div className="grid gap-[2em] lg:grid-cols-[21em_1fr] lg:gap-[2.5em]">
                        <div>
                          <Key>Register</Key>
                          <div className="mt-[0.8em]">
                            <RegisterPad
                              relaxed={relaxed}
                              warm={warm}
                              onChange={(r, w) => {
                                begin();
                                setRelaxed(r);
                                setWarm(w);
                              }}
                            />
                          </div>
                          <p className="mt-[1em] text-[0.85em] leading-[1.5]">
                            <span className="text-[var(--cover-brand-lit)]">
                              {tone.label}
                            </span>
                            <span className="text-[var(--cover-paper)]/50">
                              {" "}
                              — {tone.blurb.toLowerCase()}.
                            </span>
                          </p>
                        </div>

                        <div>
                          <Key>Agent name</Key>
                          <input
                            value={agentName}
                            onChange={(e) => {
                              begin();
                              setAgentName(e.target.value.slice(0, 22));
                            }}
                            onFocus={begin}
                            placeholder={FALLBACK_AGENT}
                            aria-label="Agent name"
                            className="mt-[0.5em] w-full border-b border-[var(--cover-paper)]/15 bg-transparent pb-[0.35em] text-[1.35em] font-medium leading-tight tracking-[-0.03em] text-[var(--cover-paper)] outline-none transition-colors duration-200 placeholder:text-[var(--cover-paper)]/22 focus:border-[var(--cover-brand-lit)]/60"
                          />
                          <p className="mt-[0.6em] text-[0.78em] leading-[1.5] text-[var(--cover-paper)]/35">
                            What it calls itself on the call.
                          </p>

                          <div className="mt-[1.8em]">
                            <Key>Answers in</Key>
                            <div className="mt-[0.8em] flex flex-wrap gap-[0.35em]">
                              {SETUP_LANGS.map((l) => {
                                const on = l.code === lang.code;
                                return (
                                  <button
                                    key={l.code}
                                    type="button"
                                    onClick={() => {
                                      begin();
                                      setLang(l);
                                    }}
                                    aria-pressed={on}
                                    aria-label={l.name}
                                    className={cn(
                                      "mono rounded-[0.45em] border px-[0.7em] py-[0.45em] text-[0.68em] leading-none tracking-[0.1em] transition-colors duration-200",
                                      on
                                        ? "border-[var(--cover-brand-lit)]/60 bg-[var(--cover-brand-lit)]/12 text-[var(--cover-brand-lit)]"
                                        : "border-[var(--cover-paper)]/12 text-[var(--cover-paper)]/40 hover:border-[var(--cover-paper)]/30 hover:text-[var(--cover-paper)]/75",
                                    )}
                                  >
                                    {l.code}
                                  </button>
                                );
                              })}
                            </div>
                            <p className="mt-[0.9em] max-w-[24em] text-[0.8em] leading-[1.55] text-[var(--cover-paper)]/40">
                              The greeting on the right rewrites itself as you
                              move — every one of these is the agent&rsquo;s
                              own sentence, not a translation of the English.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {step === 2 && (
                      <div>
                        <div className="flex flex-wrap items-baseline justify-between gap-[0.8em]">
                          <Key>What the caller hears</Key>
                          <button
                            type="button"
                            onClick={() => {
                              begin();
                              setRead((r) => r + 1);
                            }}
                            className="flex items-center gap-[0.45em] rounded-full border border-[var(--cover-paper)]/15 px-[0.9em] py-[0.45em] text-[0.7em] leading-none text-[var(--cover-paper)]/55 transition-colors duration-200 hover:border-[var(--cover-paper)]/35 hover:text-[var(--cover-paper)]"
                          >
                            <RotateCcw className="size-[1.05em]" strokeWidth={2} />
                            Read again
                          </button>
                        </div>

                        <div className="mt-[1em] rounded-[0.8em] border border-[var(--cover-paper)]/10 bg-[var(--cover-ink)]/30 p-[1.2em]">
                          <VoiceReader
                            key={`${voice.id}-${read}`}
                            voice={voice}
                            text={greeting}
                            run={read}
                          />
                        </div>

                        <div className="mt-[1.4em] grid gap-[0.4em] sm:grid-cols-2">
                          {SETUP_VOICES.map((v) => {
                            const on = v.id === voice.id;
                            const sig = signature(v, 18);
                            return (
                              <button
                                key={v.id}
                                type="button"
                                onClick={() => {
                                  begin();
                                  setVoice(v);
                                }}
                                aria-pressed={on}
                                className={cn(
                                  "flex items-center gap-[0.9em] rounded-[0.6em] border px-[0.9em] py-[0.7em] text-left transition-colors duration-200",
                                  on
                                    ? "border-[var(--cover-brand-lit)]/50 bg-[var(--cover-brand-lit)]/[0.08]"
                                    : "border-[var(--cover-paper)]/10 hover:border-[var(--cover-paper)]/25",
                                )}
                              >
                                <span
                                  aria-hidden
                                  className="flex h-[1.8em] w-[3.4em] shrink-0 items-center gap-[0.1em]"
                                >
                                  {sig.map((h, i) => (
                                    <span
                                      key={i}
                                      className={cn(
                                        "flex-1 rounded-full transition-colors duration-200",
                                        on
                                          ? "bg-[var(--cover-brand-lit)]"
                                          : "bg-[var(--cover-paper)]/25",
                                      )}
                                      style={{
                                        height: `${Math.max(6, h * 100)}%`,
                                      }}
                                    />
                                  ))}
                                </span>

                                <span className="min-w-0">
                                  <span
                                    className={cn(
                                      "block truncate text-[0.9em] leading-none",
                                      on
                                        ? "text-[var(--cover-paper)]"
                                        : "text-[var(--cover-paper)]/70",
                                    )}
                                  >
                                    {v.name}
                                  </span>
                                  <span className="mono mt-[0.45em] block truncate text-[0.6em] uppercase tracking-[0.12em] text-[var(--cover-paper)]/35">
                                    {v.register} · {v.wpm} wpm
                                  </span>
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        <p className="mt-[1.2em] text-[0.78em] leading-[1.55] text-[var(--cover-paper)]/35">
                          Silent on this page — the bars are the voice&rsquo;s
                          own pitch and pace, and the greeting crosses them at
                          the speed it would really be spoken.{" "}
                          <span className="text-[var(--cover-paper)]/55">
                            {voice.note}
                          </span>
                        </p>
                      </div>
                    )}

                    {step === 3 && (
                      <div>
                        <Key>Live</Key>
                        <p className="mt-[0.7em] max-w-[22em] text-[1.9em] font-medium leading-[1.08] tracking-[-0.04em]">
                          {shownAgent} is answering for {shownCompany}.
                        </p>

                        <ul className="mt-[1.8em] flex flex-col gap-[0.2em]">
                          {LAUNCH_CHECKS.map((c, i) => {
                            const Icon = c.icon;
                            return (
                              <motion.li
                                key={c.label}
                                initial={reduce ? false : { opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{
                                  duration: 0.4,
                                  delay: 0.15 + i * 0.22,
                                  ease: EASE,
                                }}
                                className="flex items-center gap-[0.8em] border-b border-[var(--cover-paper)]/[0.07] py-[0.75em] last:border-b-0"
                              >
                                <span className="grid size-[1.8em] shrink-0 place-items-center rounded-full bg-[var(--cover-brand-lit)]/14 text-[var(--cover-brand-lit)]">
                                  <Icon className="size-[0.95em]" strokeWidth={2} />
                                </span>
                                <span className="min-w-0 flex-1 truncate text-[0.9em] text-[var(--cover-paper)]/85">
                                  {c.label}
                                </span>
                                <span className="mono shrink-0 text-[0.6em] uppercase tracking-[0.14em] text-[var(--cover-paper)]/35">
                                  {c.note}
                                </span>
                              </motion.li>
                            );
                          })}
                        </ul>

                        {/* The measurement, handed back. Both branches are
                            written, because a clock you cannot lose to is
                            not a clock — and a reader who spent fourteen
                            minutes dragging the register pad has learned
                            more about the product than one who rushed. */}
                        <motion.p
                          initial={reduce ? false : { opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.5, delay: 0.85 }}
                          className="mt-[1.8em] max-w-[30em] text-[0.95em] leading-[1.6] text-[var(--cover-paper)]/60"
                        >
                          {underBudget ? (
                            <>
                              Set up in{" "}
                              <span className="text-[var(--cover-brand-lit)]">
                                {mmss(ms)}
                              </span>
                              , of the ten minutes we claimed. The real thing
                              is these same four screens — the only step this
                              page couldn&rsquo;t take for you is pointing a
                              number at it.
                            </>
                          ) : (
                            <>
                              <span className="text-[var(--cover-brand-lit)]">
                                {mmss(ms)}
                              </span>{" "}
                              — over our ten, and we&rsquo;ll take it: you
                              were reading, not setting up. The decisions were
                              four, and you have already made all of them.
                            </>
                          )}
                        </motion.p>
                      </div>
                    )}
                  </motion.div>
                </div>

                {/* nav */}
                <div className="mt-[2em] flex items-center justify-between gap-[1em] border-t border-[var(--cover-paper)]/10 pt-[1.4em]">
                  <button
                    type="button"
                    onClick={() => (live ? reset() : go(step - 1))}
                    disabled={!live && step === 0}
                    className="flex items-center gap-[0.5em] rounded-full px-[0.9em] py-[0.55em] text-[0.78em] leading-none text-[var(--cover-paper)]/45 transition-colors duration-200 enabled:hover:text-[var(--cover-paper)] disabled:opacity-0"
                  >
                    {live ? (
                      <>
                        <RotateCcw className="size-[1.05em]" strokeWidth={2} />
                        Run it again
                      </>
                    ) : (
                      "Back"
                    )}
                  </button>

                  {!live && (
                    <button
                      type="button"
                      onClick={() => go(step + 1)}
                      className="flex items-center gap-[0.5em] rounded-full bg-[var(--cover-brand-lit)] px-[1.3em] py-[0.7em] text-[0.8em] font-medium leading-none text-[var(--cover-ink)] transition-opacity duration-200 hover:opacity-85"
                    >
                      {step === 2 ? "Put it live" : "Continue"}
                      <ArrowRight className="size-[1.1em]" strokeWidth={2.2} />
                    </button>
                  )}
                </div>
              </div>

              {/* the brief */}
              <div className="p-[1.6em] md:col-span-2 md:p-[2em]">
                <Brief
                  step={step}
                  company={shownCompany}
                  companyTyped={companyTyped}
                  trade={trade}
                  agentName={shownAgent}
                  agentTyped={agentTyped}
                  tone={tone}
                  lang={lang}
                  voice={voice}
                  greeting={greeting}
                  live={live}
                />
              </div>
            </div>

            {/* provenance — the clock is real, and it says what it measures */}
            <p className="border-t border-[var(--cover-paper)]/10 bg-[var(--cover-paper)]/[0.025] px-[1.6em] py-[0.9em] text-[0.68em] leading-[1.6] text-[var(--cover-paper)]/40 md:px-[2em]">
              The clock is your own — it starts when you touch something and
              stops when you go live, and it pauses whenever this panel is
              off-screen or the tab is in the background. Nine languages here;
              the app carries more, along with the instruction sheet this
              brief is the front page of.
            </p>
          </div>
        </Reveal>

        {/* One line for a screen reader, on the one thing the whole panel
            exists to state. Live only once the reader is driving it. */}
        <p aria-live="polite" className="sr-only">
          {live
            ? `Setup complete in ${mmss(ms)}. ${shownAgent} is answering for ${shownCompany} in ${lang.name}, in the ${voice.name} voice, ${tone.label.toLowerCase()} register.`
            : `Step ${step + 1} of 4, ${SETUP_STEPS[step].label}.`}
        </p>
      </div>
    </section>
  );
}
