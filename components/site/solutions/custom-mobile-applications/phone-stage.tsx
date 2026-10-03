"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type RefObject,
} from "react";
import type { gsap as GsapCore } from "gsap";
import { RotateCcw } from "lucide-react";
import type { GoId, HoldData, Move, PartId, Platform } from "@/lib/pages/custom-mobile-applications";
import { cn } from "@/lib/utils";
import { useKitContext } from "@/components/site/product/motion-kit";
import { RING_LIGHT, RoundButton, Segmented, useRovingRadio } from "@/components/site/home/controls";
import { useDocumentVisible, useStageMotion } from "@/components/site/home/motion";
import { TYPE } from "@/components/site/home/type";
import { Stack, fill } from "@/components/site/solutions/custom-ai-agents/parts";
import { vtAllowed, withViewTransition } from "@/components/site/solutions/custom-saas-platforms/vt";
import { Device, type Leaving } from "./device";
import { KindTag, PartGlyph } from "./glyphs";
import { PartsChips, PartsLane } from "./parts-lane";
import { PartsMap } from "./parts-map";
import { GO, LAST, frameOf, holdOf, moveBetween, pad2, pickStep, talksOf, type Hold, type StepIndex } from "./phone-frame";
import { MOVE_S, buildHops, buildTour, type View } from "./phone-timeline";
import { noteWords } from "./screens";

/* ------------------------------------------------------------------ *
 * #hold — the phone you hold: a sample booking app on a device the
 * reader can switch between iOS and Android and press through, and
 * beside it the parts of this platform each step talks to.
 *
 * THE SPINE OF THE PAGE, AND ITS ONLY AUTOPLAY. One customer, five
 * steps: sign in, choose a time, pay, booked (and asked about
 * notifications), and later the reminder on the lock screen. Each step
 * changes the phone's screen the way its platform does (a reader's press
 * as a view transition under the SaaS prototype's `"proto"` scope, with
 * the platform's own move as its type; the tour's own moves as the new
 * screen's entry, never a transition the reader didn't start:
 * mob-device.css §5), and the parts it
 * talks to — sign-in, the API, the database, payments, the live
 * connection, the daily job, push, the texts — light beside it, with a
 * dot riding each line on the way (phone-timeline.ts). The first time
 * the stage has the screen it plays the journey once on its own, a
 * finger pressing each ringed button in turn, and ends where it began:
 * the reminder landed.
 *
 * STATE is four small values (phone-frame.ts `Hold`): the platform, the
 * step, the answer to the notifications question, and whether the step
 * has arrived. What the phone and the parts show is always
 * `frameOf(steps, hold)`, so the server's HTML, the reduced-motion
 * page, the still tier, weak hardware, lite before a tap, a step picked
 * by hand and the tour's own arrivals all draw the same frame for the
 * same place. The finished frame is iOS, the reminder landed,
 * notifications allowed (`MOB_HOLD.initial`).
 *
 * THREE COMPOSITIONS OF THE PARTS, ALL IN THE HTML, switched by CSS
 * alone (mob-hold.css §1), so the server never guesses the width: from
 * lg the drawing beside the phone (PartsMap), at md the lane (PartsLane),
 * below md the chips, each under the caption card (PartsChips). `wide` and `md`
 * (media queries read with useSyncExternalStore, false on the server)
 * only tell the timelines which one to animate, and a change rebuilds
 * the tour where it was.
 *
 * THE LAYOUT, per breakpoint (mob-hold.css §1): below md one column —
 * the controls, the phone with its platform line and hint, the rail, the
 * caption card, the chips. From md two columns: the phone's (260px; from
 * lg a quarter of the stage, but never taller than the screen has room
 * for nor under 256px, so the phone, the rail and the caption are read
 * together while the tour plays) down the left, and on the right the
 * rail, then the caption card, then the lane at md or the drawing from
 * lg. The DOM runs in that order too, so focus never jumps back up the
 * stage. At md the caption card grows to end level with the phone's
 * column, its "Talks to" at its foot; from lg the drawing takes that
 * height, as large as it allows, its key (the tag and the kinds' legend)
 * in the band beside it wherever the column is wide for its height, so
 * no band stands empty.
 *
 * MOTION is `useStageMotion` (home/motion.ts): GSAP is fetched when the
 * stage comes near, never with reduced motion, and on a lite device only
 * once the reader has tapped or keyed inside the stage. Everything it
 * runs is built in one `useKitContext` callback, rebuilt — and all of
 * it before reverted — whenever the reader's hand (`nonce`), the width
 * class or reduced motion changes: the tour, while one is wanted
 * (`wantRef`), or the hops of a reader's own press. The tour plays only
 * while the stage has the screen (or the reader's hand), the tab is
 * visible, the reader hasn't paused it and no platform switch is
 * morphing the phone; the first view's waits, besides, for most of the
 * phone itself to be on screen (`seen`, 60% of it: the shared rule
 * starts at 30% of the stage, which from md is the heading and a third
 * of the phone, its first step's finger below the fold), unless the
 * reader has pressed Play or taken a step. Built with the stage out of
 * sight, it puts the phone back to "Welcome back" there and then, so the
 * reader arrives at its first frame; built with any of it in sight,
 * where the reader may have seen the finished frame, it takes that back
 * softly as it starts (the lit lines fade, the screen moves back). React
 * state is set only at arrivals; GSAP draws the travel in between.
 *
 * THE READER'S HAND, and what it does to the tour:
 *   - a hotspot (every ringed button on the phone) presses through the
 *     sample as the tour's finger does, and the new step's hops play
 *     once where motion is allowed; focus goes to the new screen's
 *     heading, since the button pressed has gone with its screen;
 *   - a step on the rail jumps there (the "You’re booked" step asks
 *     about notifications again), focus staying on the radio;
 *   - "Start again" goes back to "Welcome back", focus on its heading;
 *   - the platform switch morphs the phone to the other platform's
 *     conventions (focus stays on the switch) and does NOT take the tour
 *     over: the tour waits for the morph, then carries on at the same
 *     step on the other platform;
 *   - the transport: Pause while a tour plays (WCAG 2.2.2), Play while
 *     paused or before one has run (after a step picked by hand, the
 *     journey carries on from there), Play it again once it has ended;
 *   - focus inside the phone's column, the rail or the caption card
 *     holds the tour until it leaves (WCAG 2.4.3): the tour never
 *     unmounts a button or unchecks a radio a reader is on. (The
 *     transport still reads Pause while the tour holds: it is waiting,
 *     not paused.) The screen's heading is a focus target, not a
 *     control, so focus there never holds it.
 * A hotspot, a rail pick, the notification or "Start again" ends the
 * first view's autoplay for good (`markInteracted`).
 *
 * NOTHING MOVES BY ITSELF. The phone has a fixed aspect, and its
 * overlays (the sheet, the dialog, the notification) sit inside it; the
 * platform line and the caption card's words are stacks over every
 * variant (`Stack`), as tall as the longest; the rail, the hint row and
 * the parts have fixed rows; the drawing has a fixed aspect. So the
 * section is the same height before, during and after a tour, and after
 * a platform switch, which is what deferred.tsx reserves.
 *
 * ACCESSIBILITY. The phone is a group of real headings and buttons
 * (device.tsx); its drawn chrome, the parts beside it and the finger are
 * aria-hidden, and the caption card names what each step talks to in
 * words. The platform switch and the rail are radio groups with one tab
 * stop and arrow keys. A polite live region speaks what the reader's
 * own changes do — a step picked, a platform switched — at once for a
 * click, Enter or Space, and once the keys rest for a walk of arrows;
 * never the tour. After a hotspot, the focused heading is the
 * announcement, and where the reminder lands on the lock screen after it
 * (the hops' arrival, a second or two later), the region says the
 * reminder too, so the step's one control never arrives unheard. The
 * index under the section (hold.tsx) has the whole journey in words.
 * ------------------------------------------------------------------ */

type Timeline = ReturnType<(typeof GsapCore)["timeline"]>;

/** What the stage is handed: everything #hold's data holds but the routes, the index and the foot, which the server draws. */
export type StageData = Omit<HoldData, "routes" | "indexSummary" | "indexReminder" | "foot">;

/** The drawing's breakpoint (Tailwind's lg), and the lane's (md). */
const LG = "(min-width: 64rem)";
const MD = "(min-width: 48rem)";

/** One subscription per query, made once, so React never resubscribes between renders. */
const subscribers = new Map<string, (onChange: () => void) => () => void>();
function subscribeTo(query: string) {
  let subscribe = subscribers.get(query);
  if (!subscribe) {
    subscribe = (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    };
    subscribers.set(query, subscribe);
  }
  return subscribe;
}

/** A media query's answer: false on the server and while hydrating, so the first client render agrees. */
function useMedia(query: string) {
  return useSyncExternalStore(
    subscribeTo(query),
    () => window.matchMedia(query).matches,
    () => false,
  );
}

const noop = () => () => {};
/** False on the server and while hydrating; true once the island runs in the browser. */
function useHydrated() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

const useIsoLayoutEffect = typeof document !== "undefined" ? useLayoutEffect : useEffect;

/**
 * True while any part of the element is on screen (false on the server),
 * reading the newest entry a callback carries (the Automations
 * workbench's): a fast pass can land two in one callback.
 */
function useOnScreen(ref: RefObject<Element | null>) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      const newest = entries[entries.length - 1];
      if (newest) setOn(newest.isIntersecting);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return on;
}

/** Arrows walking the rail or the switch: the live region speaks this long after the last press (the landing's rest). */
const KEY_REST_MS = 350;

/** How long the tour waits for a platform switch's morph (0.42s) before it carries on. */
const SWITCH_MS = 450;

/** How much of the phone must be on screen before its ringed buttons pulse, once. */
const SEEN_AT = 0.6;

/**
 * How long the screen a tour's push leaves may stay, at most: its slide is
 * 0.36s and it goes when the slide ends; where the slide never runs (lite,
 * still, weak: mob-device.css §6), it goes after this.
 */
const LEAVE_MS = 600;

/** A radio group's arrows (and Home, End) walk; its Enter and Space, and a pointer, arrive as clicks. */
type Via = "pointer" | "arrow";

/**
 * What the live region says: a walk of the rail's or the switch's arrows
 * says its line once the keys rest; everything else at once; a repeat alternates a
 * trailing no-break space so it is heard again; `hush` empties it (the
 * workbench's).
 */
function useLiveLine() {
  const [said, setSaid] = useState("");
  const timer = useRef(0);
  const hush = useCallback(() => {
    window.clearTimeout(timer.current);
    setSaid("");
  }, []);
  const say = useCallback((line: string, via: Via) => {
    window.clearTimeout(timer.current);
    const speak = () => setSaid((prev) => (prev === line ? `${line}\u00a0` : line));
    if (via === "arrow") timer.current = window.setTimeout(speak, KEY_REST_MS);
    else speak();
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { said, say, hush };
}

/** How long a view transition may hold back the scroll to a heading out of sight: the longest move is 0.42s. */
const REVEAL_WAIT_MS = 800;

/**
 * Brings the heading a press has focused into view when it is out of
 * sight: above the fixed header's foot, or below the screen. The nearest
 * scroll that shows it, which its scroll margin (globals.css, 5rem for
 * every focus target) keeps clear of the header; smooth or not as the
 * page's own scroll behaviour says. While a view transition of ours runs
 * (<html data-saas-vt>) it waits for its end: a scroll during one would
 * carry the screen's picture across the page with it. Only if the
 * heading still has focus by then. Returns its cleanup.
 */
function reveal(title: HTMLElement): () => void {
  const show = () => {
    if (document.activeElement !== title) return;
    const bar = document.querySelector("header[data-site-header]")?.getBoundingClientRect().bottom ?? 0;
    const r = title.getBoundingClientRect();
    if (r.top < Math.max(bar, 0) || r.bottom > window.innerHeight) title.scrollIntoView({ block: "nearest" });
  };
  const root = document.documentElement;
  if (!root.hasAttribute("data-saas-vt")) {
    show();
    return () => {};
  }
  let timer = 0;
  const done = () => {
    watch.disconnect();
    window.clearTimeout(timer);
    show();
  };
  const watch = new MutationObserver(() => {
    if (!root.hasAttribute("data-saas-vt")) done();
  });
  watch.observe(root, { attributes: true, attributeFilter: ["data-saas-vt"] });
  timer = window.setTimeout(done, REVEAL_WAIT_MS);
  return () => {
    watch.disconnect();
    window.clearTimeout(timer);
  };
}

/**
 * Hands the rail's dwell back to the frame once the stage's context has
 * reverted (GSAP runs a context's cleanups after reverting its tweens):
 * whatever inline style a run of the dwell left on its span goes, so each
 * fill is the frame's alone, full for a step passed or current and empty
 * for one to come. React writes no style there.
 */
function letGoOfDwell(root: HTMLElement) {
  for (const run of root.querySelectorAll<HTMLElement>("[data-mob-dwell]")) run.removeAttribute("style");
}

/** The view-transition type each platform's moves carry (mob-device.css §5). */
const PLATFORM_TYPE: Record<Platform, string> = { ios: "mob-ios", android: "mob-android" };

/**
 * What the kit context builds next: the tour, from a step (on the first
 * view it decides for itself whether to take the finished frame back
 * softly), or the hops of a reader's own press, after its move.
 */
type Want = { kind: "tour"; from: StepIndex; first: boolean } | { kind: "hops"; delay: number };
type Tour = "idle" | "running" | "done";

/** The phone's column: the device, a 280px picture below md, and its column's width from md. */
const PHONE_BOX = "mx-auto w-[min(280px,100%)] md:w-full";

/** A step on the rail: its number and its name over the dwell track, a 44px target. */
// tap-44: a step narrower than 44px (a short name on a 320px phone) still takes a 44px tap.
const STEP = "tap-44 group relative flex min-h-11 min-w-0 cursor-pointer flex-col justify-end gap-2 rounded-md pt-1 text-left";

export function PhoneStage({ data }: { data: StageData }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  const { kit, reduce, tier, playing, paused, setPaused, interacted, markInteracted } = useStageMotion(stageRef, {
    id: "mob-hold",
  });
  const wide = useMedia(LG);
  const md = useMedia(MD);
  const view: View = wide ? "map" : md ? "lane" : "chips";
  const onScreen = useOnScreen(stageRef);
  const visible = useDocumentVisible();
  const hydrated = useHydrated();

  const steps = data.steps;
  const [hold, setHold] = useState<Hold>(() => holdOf(steps, data.initial));
  const [tour, setTour] = useState<Tour>("idle");
  const [nonce, setNonce] = useState(0);
  // Focus is on a control inside the phone's column, the rail or the caption card: the tour waits there.
  const [held, setHeld] = useState(false);
  // A platform switch is morphing the phone: the tour waits for it.
  const [switching, setSwitching] = useState(false);
  // A press or a tour arrival has changed the screen: its overlays make their entries from now on, never on the first paint.
  const [entered, setEntered] = useState(false);
  // The tour's own last move, which the new screen makes as its entry (mob-device.css §5); null after any other change.
  const [entry, setEntry] = useState<Move | null>(null);
  // Most of the phone has been on screen once: its ringed buttons pulse.
  const [seen, setSeen] = useState(false);
  // The screen a tour's iOS push is leaving, drawn once more as it slides away (device.tsx); null otherwise.
  const [leaving, setLeaving] = useState<Omit<Leaving, "onEnd"> | null>(null);
  const { said, say, hush } = useLiveLine();

  const frame = useMemo(() => frameOf(steps, hold), [steps, hold]);

  // Six captions: each step's, then the reminder's by text.
  const captions = useMemo(
    () => [
      ...steps.map((s, i) => ({ mark: `${fill(data.stepOf, { n: i + 1, total: steps.length })} · ${s.label}`, text: s.caption })),
      {
        mark: `${fill(data.stepOf, { n: LAST + 1, total: steps.length })} · ${steps[LAST].label}`,
        text: steps[LAST].deny?.caption ?? steps[LAST].caption,
      },
    ],
    [steps, data.stepOf],
  );
  // And the parts each of the six talks to.
  const talks = useMemo(
    () => [
      ...steps.map((_, i) => talksOf(steps, { step: i as StepIndex, answer: i === LAST ? "allow" : null })),
      talksOf(steps, { step: LAST, answer: "deny" }),
    ],
    [steps],
  );
  const touring = tour === "running";
  // Where motion is: GSAP here and wanted. Without it, a press lands its step arrived at once.
  const motion = kit !== null && !reduce;

  // The place the phone is at, for callbacks that outlive a render: the
  // timeline's, and the view transitions', whose update runs a frame later.
  const holdRef = useRef(hold);
  useIsoLayoutEffect(() => {
    holdRef.current = hold;
  }, [hold]);
  const heldRef = useRef(held);
  useIsoLayoutEffect(() => {
    heldRef.current = held;
  }, [held]);

  const tlRef = useRef<Timeline | null>(null);
  // The first view's tour, until the reader takes over or it has played.
  const wantRef = useRef<Want | null>({ kind: "tour", from: 0, first: true });
  const runRef = useRef(false);
  const switchTimer = useRef(0);
  const leaveTimer = useRef(0);
  const leaveKey = useRef(0);
  // Set by a press, read once after the commit it causes: focus goes to the new screen's heading.
  const moved = useRef(false);
  // Calls off a reveal still waiting for a view transition to end.
  const unreveal = useRef<() => void>(() => {});
  // The switch's last input was a walk of its arrows: its note waits for the keys to rest, as the rail's does.
  // The shared Segmented hands a key and a click to onChange alike, so its wrapper reads the input first.
  const viaKey = useRef(false);

  // Nothing plays while focus is inside the phone's column, the rail or the
  // caption card, while a switch morphs the phone, nor off the screen by
  // this stage's own look, whatever the page's focus says. The first view's
  // tour waits for the phone itself (`seen`) too: the shared rule's 30% of
  // the stage is, from md, the heading and the top of the phone, and step
  // one's finger would press Sign in below the fold. Play, or any step the
  // reader takes, starts it at once.
  const run = !held && !switching && onScreen && visible && !paused && !reduce && ((playing && seen) || interacted);

  useEffect(() => {
    runRef.current = run;
    tlRef.current?.paused(!run);
  }, [run]);

  useEffect(
    () => () => {
      window.clearTimeout(switchTimer.current);
      window.clearTimeout(leaveTimer.current);
    },
    [],
  );

  /** The screen a push was leaving has gone: its slide has ended, or its time is up. */
  const gone = useCallback((key: number) => {
    setLeaving((l) => (l?.key === key ? null : l));
  }, []);

  // The pulse's cue: most of the phone on screen, once.
  useEffect(() => {
    const el = phoneRef.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(
      (entries) => {
        // The last entry is the element as it is now: a busy main thread can hand one callback several.
        if (!entries[entries.length - 1]?.isIntersecting) return;
        setSeen(true);
        io.disconnect();
      },
      { threshold: SEEN_AT },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);

  // After a press, the new screen's heading takes focus (the button pressed
  // has gone with the old screen), without moving the page when it is in
  // sight; out of sight (above the header's foot or below the screen, as
  // after "Start again" or a press at the phone's foot on a laptop), it is
  // brought into view (`reveal`). Never on the first paint.
  useIsoLayoutEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    const title = titleRef.current;
    if (!title) return;
    title.focus({ preventScroll: true });
    // A later press's reveal replaces this one's; the arrival that follows a press leaves it be.
    unreveal.current();
    unreveal.current = reveal(title);
  }, [hold]);
  useEffect(() => {
    const off = unreveal;
    return () => off.current();
  }, []);

  /**
   * The phone goes to `next`, making `move`: a reader's press inside a
   * view transition where one may run and the screen changes, at once
   * otherwise. With `hops`, the new step's hops play once the move has
   * run. With `vt: false` (the tour's own moves) no view transition
   * starts: while one runs the browser hit-tests the whole page as <html>,
   * so a transition the reader didn't start would swallow their click
   * (Pause among them), and a scroll during it would leave the screen's
   * picture behind. The new screen makes the move as its entry instead
   * (`data-move`, mob-device.css §5), inside the glass's own clip; and
   * where that move is an iOS push, which moves both screens, the screen
   * it leaves is drawn once more for the push's time, sliding away under
   * or over it (`leaving`), so the glass never stands empty.
   */
  const change = (next: Hold, move: Move, o: { focus?: boolean; hops?: boolean; vt?: boolean } = {}) => {
    const h = holdRef.current;
    const same = h.step === next.step && h.platform === next.platform && h.answer === next.answer;
    const animate = !same && vtAllowed(reduce, tier) && o.vt !== false;
    const was = frameOf(steps, h);
    const push =
      o.vt === false &&
      !same &&
      (move === "mob-forward" || move === "mob-back") &&
      h.platform === "ios" &&
      next.platform === "ios" &&
      was.screen !== frameOf(steps, next).screen;
    const left = push
      ? { key: ++leaveKey.current, move, platform: h.platform, screen: was.screen, answer: was.answer, arrived: was.arrived }
      : null;
    window.clearTimeout(leaveTimer.current);
    if (left) leaveTimer.current = window.setTimeout(() => gone(left.key), LEAVE_MS);
    if (o.focus) moved.current = true;
    withViewTransition(
      "proto",
      () => {
        holdRef.current = next;
        setHold(next);
        setEntered(true);
        setEntry(o.vt === false && !same ? move : null);
        setLeaving(left);
        if (o.hops) {
          wantRef.current = { kind: "hops", delay: animate ? MOVE_S[move] : 0 };
          setNonce((n) => n + 1);
        }
      },
      { allowed: animate, types: [PLATFORM_TYPE[next.platform], move] },
    );
  };

  /** The tour's own moves: into the step it takes up on, and each hotspot its finger presses. */
  const enterStep = (k: StepIndex) => {
    wantRef.current = { kind: "tour", from: k, first: false };
    const h = holdRef.current;
    const next = { ...pickStep(h, k), answer: k === LAST ? ("allow" as const) : null, arrived: false };
    change(next, moveBetween(h, next), { vt: false });
  };
  const tourPress = (go: GoId) => {
    const { next, move } = GO[go](holdRef.current);
    wantRef.current = { kind: "tour", from: next.step, first: false };
    change(next, move, { vt: false });
  };

  useKitContext(
    kit,
    (k) => {
      const root = stageRef.current;
      const want = wantRef.current;
      if (!root) return;
      if (reduce) {
        // Reduced motion switched on mid-journey: the step lands where it is.
        if (want) {
          wantRef.current = null;
          setHold((h) => (h.arrived ? h : { ...h, arrived: true }));
          setTour("idle");
        }
        return;
      }
      if (!want) {
        // Rebuilt with nothing wanted (the width class changed under a press's
        // hops): the step those hops were bringing lands where it is.
        if (!holdRef.current.arrived) setHold((h) => ({ ...h, arrived: true }));
        return;
      }

      if (want.kind === "hops") {
        wantRef.current = null;
        const hops = buildHops(k.gsap, root, {
          steps,
          view,
          hold: holdRef.current,
          delay: want.delay,
          onArrive: () => {
            setHold((h) => (h.arrived ? h : { ...h, arrived: true }));
            // A press that led to the lock screen: focus is on its heading, and
            // the reminder has only now arrived under it. Say it.
            const h = holdRef.current;
            const answer = frameOf(steps, h).answer;
            if (h.step === LAST && answer !== null && document.activeElement === titleRef.current) {
              say(noteWords(data.app, answer, data.reminder), "pointer");
            }
          },
        });
        return () => {
          hops.kill();
          letGoOfDwell(root);
        };
      }

      // The tour. The first view's decides how it takes the frame over:
      // seen (any of the stage on screen, or focus inside it), the finished
      // frame is taken back softly as the tour starts; unseen, the phone goes
      // back to its first step now, so the reader arrives at the tour's start.
      let rewind = holdRef.current.step !== want.from;
      if (want.first) {
        const r = root.getBoundingClientRect();
        const inSight = heldRef.current || (r.top < window.innerHeight && r.bottom > 0);
        if (!inSight) {
          const start: Hold = { ...holdRef.current, step: 0, answer: null, arrived: false };
          holdRef.current = start;
          setHold(start);
          setEntry(null);
          setLeaving(null);
          rewind = false;
        }
      }
      tlRef.current = buildTour(k.gsap, root, {
        steps,
        view,
        from: want.from,
        rewind,
        onStart: () => setTour("running"),
        onEnter: enterStep,
        onArrive: (s) => {
          setEntered(true);
          setHold((h) => (h.step === s && !h.arrived ? { ...h, arrived: true } : h));
        },
        onPress: tourPress,
        onDone: () => {
          wantRef.current = null;
          setTour("done");
        },
      });
      tlRef.current.paused(!runRef.current);
      return () => {
        tlRef.current = null;
        letGoOfDwell(root);
      };
    },
    { scope: stageRef, dependencies: [nonce, view, reduce], revertOnUpdate: true },
  );

  /* ─── The reader's hand ─────────────────────────────────────────── */

  /** The first view's autoplay hands over for good, and any tour stops where it is. */
  const takeOver = () => {
    markInteracted();
    // The press's own hops rebuild the context, which reverts the tour; until then it holds still.
    tlRef.current?.pause();
    wantRef.current = null;
    setTour("idle");
  };

  const onGo = (go: GoId) => {
    takeOver();
    const { next, move } = GO[go](holdRef.current);
    change({ ...next, arrived: !motion }, move, { focus: true, hops: motion });
  };

  const restart = () => {
    takeOver();
    const h = holdRef.current;
    const next: Hold = { ...h, step: 0, answer: null, arrived: !motion };
    change(next, moveBetween(h, next), { focus: true, hops: motion });
  };

  const liveLine = (h: Hold) => {
    const f = frameOf(steps, h);
    return fill(data.live, {
      platform: data.platforms.find((p) => p.id === h.platform)?.label ?? h.platform,
      n: h.step + 1,
      total: steps.length,
      label: steps[h.step].label,
      caption: captions[f.caption].text,
    });
  };

  const pickRail = (k: StepIndex, via: Via) => {
    takeOver();
    const h = holdRef.current;
    const next = { ...pickStep(h, k), arrived: !motion };
    change(next, moveBetween(h, next), { hops: motion });
    say(liveLine(next), via);
  };

  /** The other platform: the phone morphs, the tour waits for it and carries on, and the note is said. */
  const switchTo = (p: Platform) => {
    const h = holdRef.current;
    if (p === h.platform) return;
    setSwitching(true);
    window.clearTimeout(switchTimer.current);
    switchTimer.current = window.setTimeout(() => setSwitching(false), SWITCH_MS);
    withViewTransition(
      "proto",
      () => {
        holdRef.current = { ...holdRef.current, platform: p };
        setHold((x) => ({ ...x, platform: p }));
        // The same screen, morphed: no entry of the other platform's replays on it, and no leaving one stays.
        setEntry(null);
        setLeaving(null);
      },
      { allowed: vtAllowed(reduce, tier), types: ["mob-platform", PLATFORM_TYPE[p]] },
    );
    say(fill(data.liveSwitch, { note: data.notes[p] }), viaKey.current ? "arrow" : "pointer");
  };

  const transport = () => {
    if (tour === "running") {
      setPaused(!paused);
      return;
    }
    markInteracted();
    hush();
    setPaused(false);
    setTour("running");
    // The first view's tour, built and waiting for its moment: this is it.
    const waiting = tlRef.current;
    if (tour === "idle" && waiting && waiting.progress() === 0 && wantRef.current?.kind === "tour") return;
    // After a step picked by hand, carry on from there; otherwise from the top.
    const h = holdRef.current;
    const from: StepIndex = tour === "idle" && h.step < LAST ? h.step : 0;
    wantRef.current = { kind: "tour", from, first: false };
    setNonce((n) => n + 1);
  };

  /**
   * Focus on a control inside the phone's column, the rail or the caption
   * card: the tour waits until it leaves. The screen's heading is only
   * where a press puts focus, so focus there (a click on its words) never
   * holds it.
   */
  const holdProps = {
    onFocus: (e: FocusEvent<HTMLElement>) => setHeld(e.target !== titleRef.current),
    onBlur: (e: FocusEvent<HTMLElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget)) setHeld(false);
    },
  };

  /* ─── What the controls and the words show ──────────────────────── */

  const rail = useRovingRadio({
    count: steps.length,
    index: hold.step,
    orientation: "horizontal",
    onChange: (i, via) => pickRail(i as StepIndex, via === "key" ? "arrow" : "pointer"),
  });

  const partOf = (id: PartId) => data.parts.find((p) => p.id === id);
  const platformAt = data.platforms.findIndex((p) => p.id === hold.platform);

  const button =
    tour === "running"
      ? paused
        ? { icon: "play" as const, label: data.transport.play }
        : { icon: "pause" as const, label: data.transport.pause }
      : tour === "done"
        ? { icon: "replay" as const, label: data.transport.replay }
        : { icon: "play" as const, label: data.transport.play };
  // Drawn only where a tour can run: after hydration, and never with reduced motion or the still tier.
  const canTour = hydrated && !reduce;

  return (
    <div className="mt-10 md:mt-12">
      {/* data-paused: while a tour waits, the finger is hidden, never parked over the screen (mob-hold.css §5).
          data-played: a press or the tour has moved the phone, so the drawing's lit
          lines are React's from now on, never the scroll's fade (mob-hold.css §2). */}
      <div
        ref={stageRef}
        data-paused={touring && !run ? "" : undefined}
        data-played={entered ? "" : undefined}
        className="mob-stage home-stage relative isolate rounded-[28px] p-4 md:p-8"
      >
        <span aria-hidden className="home-grain" />

        <div className="relative flex flex-wrap items-center gap-3">
          {/* The wrapper reads the input before the switch's own keydown calls
              onChange: a walk of arrows (or Home, End) waits for the keys to rest.
              `mob-switch` edges the thumb and weights the choice (mob.css §5). */}
          <div
            className="contents"
            onKeyDownCapture={(e) => {
              viaKey.current = e.key.startsWith("Arrow") || e.key === "Home" || e.key === "End";
            }}
            onPointerDownCapture={() => {
              viaKey.current = false;
            }}
          >
            <Segmented
              label={data.platformLabel}
              options={data.platforms}
              value={hold.platform}
              onChange={switchTo}
              className="mob-switch"
            />
          </div>
          {/* Below md the tag takes its own line under the switch and the transport. */}
          <p className={cn(TYPE.mono, "text-pretty text-pp-muted max-md:order-last max-md:basis-full md:min-w-0 md:flex-1")}>
            {data.tag}
          </p>
          {canTour && (
            <RoundButton icon={button.icon} label={button.label} onClick={transport} size={44} className="ml-auto" />
          )}
        </div>

        <div className="mob-stage-grid mt-6">
          {/* The phone, its platform line and its hint: focus here holds the tour. */}
          <div className="mob-stage-phone min-w-0" {...holdProps}>
            <div
              ref={phoneRef}
              data-mob-phone=""
              data-enter={entered ? "" : undefined}
              data-move={entry ?? undefined}
              className={PHONE_BOX}
            >
              <Device
                platform={hold.platform}
                screen={frame.screen}
                answer={frame.answer}
                arrived={frame.arrived}
                app={data.app}
                reminder={data.reminder}
                label={data.tag}
                leaving={leaving && { ...leaving, onEnd: () => gone(leaving.key) }}
                live={{
                  titleRef,
                  position: fill(data.stepOf, { n: hold.step + 1, total: steps.length }),
                  onGo,
                  seen,
                }}
              />
            </div>
            <Stack
              className="mt-3 text-center md:text-left"
              items={data.platforms}
              live={Math.max(0, platformAt)}
              // Ink at 80%, not the muted grey: its first line stands in the device's shadow.
              render={(p) => <p className={cn(TYPE.meta, "text-pretty text-pp-ink/80")}>{data.notes[p.id]}</p>}
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <p className={cn(TYPE.meta, "min-w-0 flex-1 basis-40 text-pretty")}>{data.hint}</p>
              <button
                type="button"
                onClick={restart}
                className={cn(
                  "pp-shadow-btn relative inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-white px-3.5 text-sm text-pp-ink",
                  "transition-[background-color,scale] duration-200 hover:bg-(--home-wash) active:scale-[0.97]",
                  // A 36px pill, a 44px target.
                  "before:absolute before:inset-x-0 before:-inset-y-1",
                  RING_LIGHT,
                  // Out of sight and out of the tab order on the first step, its place kept.
                  hold.step === 0 && "invisible",
                )}
              >
                <RotateCcw aria-hidden className="size-3.5" strokeWidth={1.75} />
                {data.restart}
              </button>
            </div>
          </div>

          {/* The journey: five radios, one tab stop, arrows pick. Focus here holds the tour. */}
          <div
            {...rail.groupProps}
            aria-label={data.stepsLabel}
            className="mob-stage-rail grid grid-cols-[repeat(5,minmax(min-content,1fr))] gap-2 sm:gap-3"
            {...holdProps}
          >
            {steps.map((s, i) => {
              const state = i < hold.step ? "passed" : i === hold.step ? "current" : "later";
              const current = i === hold.step;
              return (
                <button key={s.id} type="button" {...rail.getItemProps(i)} className={cn(STEP, RING_LIGHT)}>
                  {/* Number over name in the narrow column at md, side by side from lg. */}
                  <span className="flex flex-col gap-0.5 lg:flex-row lg:items-baseline lg:gap-x-1.5">
                    <span
                      aria-hidden
                      className={cn(TYPE.mono, "transition-colors duration-200", current ? "text-(--home-electric)" : "text-pp-muted")}
                    >
                      {pad2(i + 1)}
                    </span>
                    {/* 12px below 360, so five names and their 8px gaps fit a 256px rail
                        with more than a word space between each two. One line each below
                        md (a two-word name wrapped to "Sign / in" at 320); the columns are
                        sized by their names, so the short ones give way. */}
                    <span
                      className={cn(
                        "text-[13px] leading-4 max-[359px]:text-[12px] max-md:whitespace-nowrap",
                        current ? "text-pp-ink" : "text-pp-ink/80 group-hover:text-pp-ink",
                      )}
                    >
                      {s.label}
                    </span>
                  </span>
                  {/* The track, the tour's run of the dwell (`data-mob-dwell`, GSAP's alone:
                      a span no rule scales, so a revert leaves nothing on it), and in it
                      the frame's fill (CSS's `scale`, by state). The two scales multiply. */}
                  <span aria-hidden className="mob-dwell relative block h-[3px] overflow-hidden rounded-full">
                    <span data-mob-dwell={i} className="absolute inset-0 origin-left">
                      <span data-state={state} className="mob-dwell-fill absolute inset-0 rounded-full" />
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mob-stage-side min-w-0">
            {/* The caption card: the step's words, and what it talks to at its foot. Focus here holds the tour. */}
            <div
              className="mob-stage-caption flex min-w-0 flex-col rounded-[20px] bg-white p-5 shadow-[0_0_0_1px_rgb(20_10_36/0.08)]"
              {...holdProps}
            >
              <Stack
                items={captions}
                live={frame.caption}
                render={(c) => (
                  <div>
                    <p className={cn(TYPE.mono, "text-pp-muted")}>{c.mark}</p>
                    <p className={cn(TYPE.body, "mt-1.5 max-w-[680px] text-pretty text-pp-ink")}>{c.text}</p>
                  </div>
                )}
              />
              <span aria-hidden className="min-h-4 flex-1" />
              {/* Its foot: "Talks to" and the link over the parts below lg, all on
                  one line from lg (mob-hold.css §1). */}
              <div className="mob-stage-talks border-t border-pp-rule pt-4">
                <p className={cn(TYPE.label, "mob-stage-talks-label text-pp-muted")}>{data.talks}</p>
                <Stack
                  className="mob-stage-talks-parts min-w-0"
                  items={talks}
                  live={frame.caption}
                  render={(ids) => (
                    <ul className="flex flex-wrap gap-1.5">
                      {ids.map((id) => {
                        const p = partOf(id);
                        return (
                          <li
                            key={id}
                            className={cn(
                              TYPE.mono,
                              "inline-flex items-center gap-1.5 rounded-full bg-(--home-chip) py-1 pr-2.5 pl-2 text-pp-ink",
                            )}
                          >
                            <PartGlyph
                              id={id}
                              className={p?.kind === "none" ? "text-(--home-violet)" : "text-(--home-electric)"}
                            />
                            {p?.label ?? id}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                />
                <a
                  href={data.full.href}
                  className={cn(
                    "mob-stage-talks-link group -my-2.5 inline-flex min-h-11 items-center gap-1 rounded-sm text-[14px] leading-[21px] whitespace-nowrap text-pp-ink",
                    RING_LIGHT,
                  )}
                >
                  <span className="home-link">{data.full.label}</span>
                  <span aria-hidden className="inline-block transition-transform duration-200 group-hover:translate-y-0.5">
                    ↓
                  </span>
                </a>
              </div>
            </div>

            {/* The parts: the chips (below md), the lane (md) or the drawing (lg),
                under the caption card; CSS shows one. The drawing fills what the
                phone's column leaves it (`mob-stage-fit`, mob-hold.css §1): its
                key (the tag, and from lg where the column has room the kinds'
                legend) over it, or in the band beside it. */}
            <div aria-hidden className="mob-stage-parts min-w-0">
              <div className="mob-stage-fit">
                <div className="mob-stage-figure">
                  <div className="mob-stage-key">
                    {/* Each "·" glued to the word before it: in the band beside the
                        drawing the tag wraps, and a line never starts with one. */}
                    <p className={cn(TYPE.mono, "text-pretty text-pp-muted")}>{data.partsTag.replaceAll(" · ", "\u00a0· ")}</p>
                    <p className="mob-stage-legend">
                      <KindTag kind="does" copy={data.kinds} tone="stage" />
                      <KindTag kind="none" copy={data.kinds} tone="stage" />
                    </p>
                  </div>
                  <PartsMap parts={data.parts} frame={frame} copy={{ phone: data.phone }} className="hidden lg:block" />
                </div>
              </div>
              <PartsLane parts={data.parts} frame={frame} className="hidden md:flex lg:hidden" />
              <PartsChips parts={data.parts} frame={frame} kinds={data.kinds} className="md:hidden" />
            </div>
          </div>
        </div>

        {/* The tour's finger and its ripple: GSAP's alone, at nothing at rest. */}
        <span aria-hidden data-mob-finger="" className="mob-finger" />
        <span aria-hidden data-mob-ripple="" className="mob-ripple" />
      </div>

      {/* Atomic: a repeat that only adds a no-break space is read whole. */}
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {said}
      </p>
    </div>
  );
}
