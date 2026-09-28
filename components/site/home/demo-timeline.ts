import type { gsap as Gsap } from "gsap";
import type { HomeMomentId } from "@/lib/pages/home/call";
import { BEAT, IDLE, frameAt, type Frame, type LinePlan, type Script } from "./demo-script";

/* ------------------------------------------------------------------ *
 * #demo's timeline: one run of the stage — the tour, or one call a
 * reader dialled — built as a paused GSAP timeline over the section's
 * markup, at the times demo-script.ts computes.
 *
 * The markup holds every copy the stage can show (every line of every
 * call, every owner line, every pill, every day), stacked in their own
 * cells; the timeline only ever moves transform and opacity. At the
 * start of a run every copy already on screen is taken over at the
 * opacity it has, and every other copy is hidden inline, so nothing CSS
 * or React decides while the run plays can show a copy the run has not
 * brought in. A run is never reverted, only killed: the next run starts
 * from wherever this one left the stage.
 *
 * `onFrame` is called on every update with what the run's time implies
 * (frameAt), so the section derives its state from the timeline instead
 * of from callbacks dropped into it.
 * ------------------------------------------------------------------ */

type G = typeof Gsap;
type Tl = ReturnType<G["timeline"]>;
type Vars = Parameters<G["set"]>[1];

export type RunCall = {
  id: HomeMomentId;
  digits: readonly number[];
  open: boolean;
};

/** One clock cell's share of a strip: eleven cells, 0–9 and 0 again, so the wrap is seamless. */
const CELL = 100 / 11;

export function buildRun({
  gsap,
  root,
  script,
  calls,
  lite,
  voice,
  digitPos,
  onFrame,
}: {
  gsap: G;
  root: HTMLElement;
  script: Script;
  calls: readonly RunCall[];
  /** No spin, one ring, no swing: a weak device's run. */
  lite: boolean;
  /** Read by the orb every frame. */
  voice: { current: number };
  /** Where each clock figure stands (0–10, fractional mid-spin); written as the strips move. */
  digitPos: number[];
  onFrame: (f: Frame) => void;
}): Tl | null {
  const all = <T extends Element = HTMLElement>(sel: string) => [...root.querySelectorAll<T & HTMLElement>(sel)];
  const one = (sel: string) => root.querySelector<HTMLElement>(sel);
  const byId = new Map(calls.map((c) => [c.id, c]));

  const strips = all(".home-demo-strip");
  const cols = all(".home-demo-col");
  const [waveA, waveB] = all(".home-demo-wave");
  const orb = one(".home-demo-orb");
  const sign = one(".home-demo-sign");
  const dot = one(".home-demo-dot");
  if (strips.length !== 4 || cols.length !== 4 || !waveA || !waveB || !orb || !sign || !dot) return null;

  const cur = (id: string, i: number) => one(`[data-row="cur"][data-call="${id}"][data-i="${i}"]`);
  const prev = (id: string, i: number) => one(`[data-row="prev"][data-call="${id}"][data-i="${i}"]`);
  const owner = (id: string, when: "before" | "after") => one(`[data-owner="${id}"][data-when="${when}"]`);
  const pill = (id: string) => one(`[data-pill="${id}"]`);
  const phase = (p: "ringing" | "picked" | "ended") => one(`[data-phase="${p}"]`);
  const day = (id: string) => one(`[data-day="${id}"]`);
  const face = (open: boolean) => one(`[data-sign="${open ? "open" : "closed"}"]`);

  /* Take the stage over. One style read per copy, no layout. */
  const shown = new Set<HTMLElement>();
  for (const el of all(".home-demo-anim")) {
    const cs = getComputedStyle(el);
    const opacity = Number(cs.opacity);
    if (cs.visibility !== "hidden" && opacity > 0.01) {
      shown.add(el);
      gsap.set(el, { autoAlpha: opacity });
    } else gsap.set(el, { autoAlpha: 0 });
  }
  // The figures as they stand. `y` is zeroed because GSAP reads the CSS
  // rest transform in as pixels, which would double every yPercent.
  strips.forEach((strip, c) => gsap.set(strip, { y: 0, yPercent: -digitPos[c] * CELL }));
  // Where each figure will stand as each call's spin starts: now, then the call before's time.
  const pos = [...digitPos];

  const tl = gsap.timeline({
    paused: true,
    onUpdate: () => onFrame(frameAt(script, tl.time())),
  });

  const bringIn = (el: HTMLElement | null, at: number, from: Vars = {}, duration = 0.45) => {
    if (!el) return;
    tl.fromTo(
      el,
      { autoAlpha: 0, yPercent: 0, scale: 1, ...from },
      {
        autoAlpha: 1,
        yPercent: 0,
        scale: 1,
        duration,
        ease: "power3.out",
        immediateRender: false,
      },
      at,
    );
    shown.add(el);
  };
  const takeOut = (el: HTMLElement | null, at: number, to: Vars = {}, duration = 0.3) => {
    if (!el || !shown.has(el)) return;
    tl.to(el, { autoAlpha: 0, duration, ease: "power2.in", ...to }, at);
    shown.delete(el);
  };
  /** Fully on screen by `at + duration`: from wherever it stands if it is showing at all, else brought in. */
  const settle = (el: HTMLElement | null, at: number, from: Vars = {}, duration = 0.45) => {
    if (!el) return;
    if (!shown.has(el)) return bringIn(el, at, from, duration);
    tl.to(el, { autoAlpha: 1, yPercent: 0, scale: 1, duration, ease: "power3.out" }, at);
  };
  const say = (to: number, at: number, duration: number, ease: string) =>
    tl.to(voice, { current: to, duration, ease }, at);
  /* A run killed mid-beat leaves its flourishes where they stood: a ring
     half-spread, a dot mid-pulse, the orb mid-breath, the sign mid-swing,
     the figures mid-blink. They settle back before anything else moves. */
  gsap.set([waveA, waveB], { autoAlpha: 0 });
  const flourishes = [dot, sign, orb, ...all("[data-key]"), ...all("[data-key-disc]"), ...all("[data-key-disc] svg")];
  tl.to(flourishes, { scale: 1, rotation: 0, duration: 0.25, ease: "power2.out" }, 0);
  tl.to(cols, { autoAlpha: 1, duration: 0.2, ease: "power1.out" }, 0);
  // GSAP writes `scale: none` inline on anything it transforms, which would
  // beat the keys' own `active:scale-[0.97]` press for the rest of the visit.
  const keys = all("[data-key]");
  const release = (at: number, els: HTMLElement[]) => tl.set(els, { clearProps: "transform" }, at);
  release(0.26, keys);

  const shiver = (at: number) => {
    say(0.24, at, 0.06, "power2.out");
    say(0.1, at + 0.06, 0.3, "sine.inOut");
  };

  script.segs.forEach((seg) => {
    const { T, id } = seg;
    const call = byId.get(id);
    if (!call) return;
    const key = one(`[data-key="${id}"]`);
    const disc = one(`[data-key="${id}"] [data-key-disc]`);

    /* The tour presses the key it dials, as a hand would. */
    if (script.kind === "tour" && key) {
      tl.to(key, { scale: 0.97, duration: 0.09, ease: "power2.out" }, T).to(
        key,
        { scale: 1, duration: 0.16, ease: "power2.out" },
        T + 0.09,
      );
      release(T + 0.26, [key]);
    }

    /* Clear: the last call's lines, outcome, owner and phase leave. */
    for (const el of [...shown]) {
      const d = el.dataset;
      if (d.row) takeOut(el, T, { yPercent: -25 }, BEAT.clear);
      else if (d.pill) takeOut(el, T, { scale: 0.92, ease: "power1.in" }, 0.25);
      else if (d.owner) takeOut(el, T, { yPercent: -20 }, 0.25);
      else if (d.phase) takeOut(el, T, {}, 0.2);
    }
    say(0.08, T, BEAT.clear, "sine.inOut");

    /* Spin: every figure turns forward a full turn and on to its new value. */
    if (!lite) {
      const spinAt = T + BEAT.spinAt;
      tl.set(strips, { willChange: "transform" }, spinAt);
      strips.forEach((strip, c) => {
        const from = pos[c];
        const to = from + 10 + ((((call.digits[c] - from) % 10) + 10) % 10);
        const proxy = { p: from };
        const setY = gsap.quickSetter(strip, "yPercent") as (v: number) => void;
        tl.to(
          proxy,
          {
            p: to,
            duration: BEAT.spin,
            ease: "power3.inOut",
            onUpdate: () => {
              const at = ((proxy.p % 10) + 10) % 10;
              digitPos[c] = at;
              setY(-at * CELL);
            },
          },
          spinAt + c * BEAT.spinStagger,
        );
      });
      tl.set(strips, { willChange: "auto" }, spinAt + BEAT.spin + 3 * BEAT.spinStagger + 0.05);
      call.digits.forEach((d, c) => (pos[c] = d));
    } else {
      // A weak device cuts: the figures blink out, change, and come back.
      tl.to(cols, { autoAlpha: 0, duration: 0.15, ease: "power1.in" }, T + 0.45);
      strips.forEach((strip, c) =>
        tl.set(
          strip,
          {
            yPercent: -call.digits[c] * CELL,
            onComplete: () => {
              digitPos[c] = call.digits[c];
            },
          },
          T + BEAT.switchAt,
        ),
      );
      tl.to(cols, { autoAlpha: 1, duration: 0.25, ease: "power1.out" }, T + BEAT.switchAt + 0.02);
    }

    /* Switch: the day, and the door sign if it turns. (The room's light is CSS, on `moment`.)
       Both are driven to their end state rather than tested for being on screen: a run
       killed mid-crossfade leaves both copies of each half-visible, and this is where
       the next run puts that right. */
    const sw = T + BEAT.switchAt;
    for (const m of calls) if (m.id !== id) takeOut(day(m.id), sw, { yPercent: -40, ease: "power1.in" }, 0.2);
    settle(day(id), sw + 0.02, { yPercent: 40 }, 0.35);
    const want = face(call.open);
    const other = face(!call.open);
    const turns = !!want && (!shown.has(want) || (!!other && shown.has(other)));
    takeOut(other, sw, {}, 0.25);
    settle(want, sw, {}, 0.25);
    if (turns) {
      if (!lite)
        tl.fromTo(
          sign,
          { rotation: 8 },
          {
            rotation: 0,
            duration: 0.9,
            ease: "elastic.out(1, 0.45)",
            immediateRender: false,
          },
          sw,
        );
    }

    /* Where the owner is. */
    bringIn(owner(id, "before"), T + 0.7, { yPercent: 30 });

    /* It rings, twice. */
    const ringA = T + BEAT.ringA;
    const ringB = T + BEAT.ringB;
    bringIn(phase("ringing"), ringA, {}, 0.2);
    tl.fromTo(
      dot,
      { scale: 1 },
      {
        scale: 1.8,
        duration: 0.25,
        ease: "power2.out",
        yoyo: true,
        repeat: 3,
        immediateRender: false,
      },
      ringA,
    );
    tl.fromTo(
      waveA,
      { scale: 0.54, autoAlpha: 0.5 },
      {
        scale: 1,
        autoAlpha: 0,
        duration: 0.95,
        ease: "power2.out",
        immediateRender: false,
      },
      ringA,
    );
    if (!lite) {
      tl.fromTo(
        waveB,
        { scale: 0.54, autoAlpha: 0.5 },
        {
          scale: 1,
          autoAlpha: 0,
          duration: 0.95,
          ease: "power2.out",
          immediateRender: false,
        },
        ringB,
      );
    }
    if (disc) {
      for (const at of [ringA, ringB]) {
        tl.fromTo(
          disc,
          { scale: 1 },
          {
            scale: 1.2,
            duration: 0.2,
            ease: "power2.out",
            yoyo: true,
            repeat: 1,
            immediateRender: false,
          },
          at,
        );
      }
      const phone = disc.querySelector("svg");
      if (phone)
        tl.to(
          phone,
          {
            keyframes: { rotation: [-10, 10, -8, 8, 0] },
            duration: 0.5,
            ease: "none",
          },
          ringA,
        );
    }
    shiver(ringA);
    shiver(ringB);

    /* It draws in, and picks up. */
    tl.set(orb, { willChange: "transform" }, T + BEAT.inhale)
      .to(orb, { scale: 0.965, duration: 0.16, ease: "power2.in" }, T + BEAT.inhale)
      .to(orb, { scale: 1, duration: 0.9, ease: "expo.out" }, T + BEAT.pickup)
      .set(orb, { willChange: "auto" }, T + BEAT.pickup + 0.95);
    takeOut(phase("ringing"), T + BEAT.pickup, {}, 0.2);
    bringIn(phase("picked"), T + BEAT.pickup, {}, 0.2);
    say(0.62, T + BEAT.pickup, 0.12, "sine.out");
    say(0.14, T + BEAT.pickup + 0.12, 0.4, "sine.inOut");

    /* The call, a line at a time: the line before steps up into the smaller row above. */
    seg.lines.forEach((line, k) => {
      const at = line.at;
      if (k === 0) bringIn(cur(id, 0), at, { yPercent: 40 });
      else {
        takeOut(cur(id, k - 1), at - 0.05, { yPercent: -30 });
        if (k >= 2) takeOut(prev(id, k - 2), at - 0.05, { yPercent: -30 });
        bringIn(prev(id, k - 1), at + 0.05, { yPercent: 35 }, 0.4);
        bringIn(cur(id, k), at + 0.1, { yPercent: 40 });
      }
      if (line.sp === "agent") speak(line, at);
      else say(0.18, at, 0.4, "sine.inOut");
    });

    /* The end: the outcome lands in the owner's log, and the owner is still where they were. */
    const end = seg.end;
    takeOut(phase("picked"), end, {}, 0.2);
    bringIn(phase("ended"), end, {}, 0.2);
    const p = pill(id);
    bringIn(p, end, { scale: 0.7 }, 0.4);
    if (p) {
      const ping = p.querySelector<HTMLElement>(".home-demo-ping");
      if (ping)
        tl.fromTo(
          ping,
          { scale: 1, autoAlpha: 0.6 },
          {
            scale: 2.4,
            autoAlpha: 0,
            duration: 0.6,
            ease: "power2.out",
            immediateRender: false,
          },
          end + 0.1,
        );
    }
    takeOut(owner(id, "before"), end, { yPercent: -20 }, 0.25);
    bringIn(owner(id, "after"), end + 0.3, { yPercent: 30 });
    say(IDLE, end, 0.6, "sine.inOut");
  });

  // The run lasts exactly as long as the script says, so `done` lands on its last frame.
  tl.to({}, { duration: 0 }, script.total);
  return tl;

  /** The orb's voice while Ava speaks: a lift on every word, stronger for longer words, falling back between them. */
  function speak(line: LinePlan, at: number) {
    const count = Math.min(line.words, Math.floor((line.hold - 0.4) / line.spacing));
    for (let k = 0; k < count; k++) {
      const t = at + k * line.spacing;
      const peak = 0.52 + Math.min(0.3, line.lengths[k] * 0.03);
      say(peak, t, 0.09, "sine.out");
      say(0.44, t + 0.09, line.spacing - 0.09, "sine.inOut");
    }
    say(IDLE, at + count * line.spacing, 0.5, "sine.inOut");
  }
}
