"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { gsap as GsapCore } from "gsap";
import { Check, Tag } from "lucide-react";
import type { ActionKind, TriggerId } from "@/lib/pages/integrations";
import { useKitContext } from "@/components/site/product/motion-kit";
import { cn } from "@/lib/utils";
import { ChipRail, RoundButton, Sizer, useRovingRadio } from "./controls";
import { useStageMotion } from "./motion";
import { TYPE } from "./type";

/* ------------------------------------------------------------------ *
 * The relay, standing up. A rail runs down the stage's left gutter
 * through three stations — the call, the rule, where it lands — and one
 * sample run travels it, once, when the stage has the reader's eye:
 *
 *   the call's record rises into place (the call is already over —
 *   nothing here runs mid-conversation) · a bead draws the rail down to
 *   the rule · the trigger it matched rings · each step spins, then
 *   ticks · the bead carries the results down · they land · a tag, if
 *   the rule adds one, lifts off and flies back up onto the call · the
 *   run is marked complete.
 *
 * The server's markup is the finished run, and so is reduced motion.
 * Every block holds the height of its tallest sample, so switching
 * samples never moves the page.
 * ------------------------------------------------------------------ */

type Sentiment = "positive" | "neutral" | "negative";

export type AfterScene = {
  readonly id: string;
  readonly trigger: TriggerId;
  readonly call: {
    readonly number: string;
    readonly status: string;
    readonly duration: string;
    readonly sentiment: Sentiment | null;
    readonly summary: string;
    readonly heard?: { readonly before: string; readonly word: string; readonly after: string };
  };
  readonly actions: readonly { readonly kind: ActionKind; readonly detail: string; readonly result: string }[];
  readonly slack?: { readonly channel: string; readonly text: string };
  readonly tag?: string;
  readonly webhook?: { readonly url: string };
  readonly runDone: string;
};

export type AfterRelayData = {
  /** In picker order; `scenes[i]` is the sample for `triggers[i]`. */
  triggers: readonly { id: TriggerId; label: string; body: string }[];
  scenes: readonly AfterScene[];
  initial: number;
  stepTitle: Readonly<Record<ActionKind, string>>;
  labels: {
    sample: string;
    callTitle: string;
    ruleTitle: string;
    outTitle: string;
    when: string;
    then: string;
    queued: string;
    running: string;
    pick: string;
    pause: string;
    play: string;
    replay: string;
    noSummary: string;
    sentiment: Readonly<Record<Sentiment, string>>;
  };
};

type Labels = AfterRelayData["labels"];

const ACCENT = "#551a89";
/** The tag chip at rest, and lifted for its flight: the same two shadows, so one eases into the other. */
const CHIP_REST = "rgba(85, 26, 137, 0.14) 0px 0px 0px 1px, rgba(24, 16, 40, 0) 0px 14px 24px -12px";
const CHIP_LIFT = "rgba(85, 26, 137, 0.14) 0px 0px 0px 1px, rgba(24, 16, 40, 0.3) 0px 14px 24px -12px";
const RING = "shadow-[0_0_0_1px_rgb(24_16_40/0.06)]";
const RAISED = "shadow-[0_0_0_1px_rgb(24_16_40/0.06),0_14px_30px_-20px_rgb(24_16_40/0.35)]";
/** An output row: stacked on phones, a token column and its content from sm. */
const OUT_ROW = "grid w-full rounded-[16px] bg-white px-4 py-3 sm:items-baseline sm:gap-x-4";

/** Hooks for the timeline, on the live sample only: the sizers underneath carry none. */
type Hook = { "data-a"?: string };
const hooks = (live: boolean) => (name: string): Hook => (live ? { "data-a": name } : {});

type Phase = "rest" | "armed" | "running" | "done";

export function AfterRelay({ data }: { data: AfterRelayData }) {
  const { triggers, scenes, stepTitle, labels: L } = data;
  const stageRef = useRef<HTMLDivElement>(null);
  const m = useStageMotion(stageRef, { id: "after" });
  // `nonce` counts the reader's own plays: 0 is the page's single autoplay.
  const [run, setRun] = useState({ scene: data.initial, nonce: 0 });
  const [phase, setPhase] = useState<Phase>("rest");
  const tlRef = useRef<ReturnType<(typeof GsapCore)["timeline"]> | null>(null);
  const autoplayed = useRef(false);

  const index = run.scene;
  const scene = scenes[index];

  useKitContext(
    m.kit,
    ({ gsap }) => {
      const root = stageRef.current;
      if (!root || m.reduce) return;
      if (run.nonce === 0) {
        if (autoplayed.current) return;
        // Already on screen when GSAP arrived (a #link, a fast scroll): the
        // reader is looking at the finished run, so it stays. Replay is there.
        const box = root.getBoundingClientRect();
        if (box.top < window.innerHeight && box.bottom > 0) {
          autoplayed.current = true;
          return;
        }
      }
      const tl = buildRun(gsap, root, {
        onStart: () => setPhase("running"),
        onComplete: () => setPhase("done"),
      });
      tlRef.current = tl;
      setPhase("armed");
      if (m.playing) {
        autoplayed.current = true;
        tl.play();
      }
      return () => {
        tl.kill();
        tlRef.current = null;
        setPhase("rest");
      };
    },
    { scope: stageRef, dependencies: [run.scene, run.nonce, m.reduce], revertOnUpdate: true },
  );

  // Plays only while the stage has focus, the tab is visible and the reader
  // hasn't paused it; otherwise it waits exactly where it is.
  useEffect(() => {
    const tl = tlRef.current;
    if (!tl || tl.progress() === 1) return;
    if (m.playing) {
      autoplayed.current = true;
      tl.play();
    } else tl.pause();
  }, [m.playing]);

  const play = (i: number) => {
    m.markInteracted();
    m.setPaused(false);
    setRun((r) => ({ scene: i, nonce: r.nonce + 1 }));
  };

  const live = phase === "armed" || phase === "running";

  return (
    <>
      <Picker triggers={triggers} index={index} label={L.pick} onPick={play} />

      <div
        ref={stageRef}
        data-paused={m.playing ? undefined : ""}
        className="group/stage home-rise relative mt-4 min-w-0 rounded-[24px] bg-pp-card p-6 lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:mt-0 lg:p-10"
      >
        <div className="flex h-10 items-center justify-between gap-4">
          <p className={cn(TYPE.label, "text-pp-muted")}>{L.sample}</p>
          {/* Nothing plays with reduced motion, so there is nothing to control. */}
          <div className={cn("flex gap-2", m.reduce && "invisible")}>
            <RoundButton
              icon={m.paused ? "play" : "pause"}
              label={m.paused ? L.play : L.pause}
              onClick={() => m.setPaused(!m.paused)}
              disabled={!live}
            />
            <RoundButton icon="replay" label={L.replay} onClick={() => play(index)} />
          </div>
        </div>

        <div
          aria-hidden
          className="relative mt-4 flex flex-col gap-(--s) [--g:24px] [--s:24px] sm:[--g:32px] lg:mt-6 lg:[--s:32px]"
        >
          {/* Above the stations below it, so the tag flies over them. */}
          <Station i={0} label={L.callTitle} className="z-[1]">
            <div className="relative">
              {/* The empty slot the record rises into. */}
              <span className="absolute inset-0 rounded-[20px] border border-dashed border-pp-ink/10" />
              <Stack scenes={scenes} index={index}>
                {(s, isLive) => <CallCard s={s} L={L} live={isLive} />}
              </Stack>
            </div>
          </Station>

          <Station i={1} label={L.ruleTitle}>
            <Stack scenes={scenes} index={index}>
              {(s, isLive) => (
                <RuleBlock
                  s={s}
                  trigger={triggers[scenes.indexOf(s)]?.label ?? ""}
                  L={L}
                  stepTitle={stepTitle}
                  live={isLive}
                />
              )}
            </Stack>
          </Station>

          <Station i={2} label={L.outTitle}>
            <Stack scenes={scenes} index={index}>
              {(s, isLive) => <LandsBlock s={s} live={isLive} />}
            </Stack>
          </Station>

          <div className="relative grid grid-cols-[var(--g)_minmax(0,1fr)]">
            <Node i={3} settled />
            <p data-a="done" className="col-start-2 row-start-1 text-[13px] leading-4 text-pp-ink">
              {scene.runDone}
            </p>
          </div>
        </div>

        <Summary s={scene} trigger={triggers[index]?.label ?? ""} L={L} stepTitle={stepTitle} />
      </div>
    </>
  );
}

/* ─── The timeline ───────────────────────────────────────────────── */

function buildRun(
  gsap: typeof GsapCore,
  root: HTMLElement,
  on: { onStart: () => void; onComplete: () => void },
) {
  const all = (a: string) => Array.from(root.querySelectorAll<HTMLElement>(`[data-a="${a}"]`));
  const one = (a: string) => root.querySelector<HTMLElement>(`[data-a="${a}"]`);
  const card = all("card");
  const hl = all("hl");
  const ring = all("ring");
  const pdot = all("pdot");
  const nodes = [0, 1, 2, 3].map((i) => all(`node-${i}`));
  const fills = [0, 1, 2].map((i) => all(`fill-${i}`));
  const travs = [0, 1].map((i) => all(`trav-${i}`));
  const dots = [0, 1].map((i) => all(`dot-${i}`));
  const steps = all("step");
  const layer = (row: HTMLElement, s: string) => Array.from(row.querySelectorAll<HTMLElement>(`[data-s="${s}"]`));
  const outs = all("out");
  const src = one("tag-src");
  const dst = one("tag-dst");
  const done = all("done");
  const ping = all("ping");

  // Before the call ends: an empty slot, a dotted rail, every step waiting.
  gsap.set(card, { autoAlpha: 0, y: 12 });
  gsap.set(hl, { scaleX: 0 });
  gsap.set(nodes.flat(), { scale: 0 });
  gsap.set(fills.flat(), { scaleY: 0 });
  gsap.set(ring, { autoAlpha: 0 });
  gsap.set(pdot, { backgroundColor: "rgba(24, 16, 40, 0.2)" });
  for (const row of steps) {
    gsap.set(layer(row, "wait"), { autoAlpha: 1 });
    gsap.set([...layer(row, "run"), ...layer(row, "done"), ...layer(row, "check")], { autoAlpha: 0 });
  }
  gsap.set(outs, { autoAlpha: 0, y: 8 });
  if (src) gsap.set(src, { autoAlpha: 1 });
  if (dst) gsap.set(dst, { autoAlpha: 0 });
  gsap.set(done, { autoAlpha: 0, y: 4 });

  const tl = gsap.timeline({ paused: true, defaults: { ease: "power2.out" }, ...on });

  /** A stretch of rail inks in; its bead is the pen, riding the drawn end. */
  const rail = (i: number, at: number, dur: number, bead = true) => {
    tl.to(fills[i], { scaleY: 1, duration: dur, ease: "power2.inOut" }, at);
    if (!bead) return;
    tl.set(dots[i], { autoAlpha: 1 }, at)
      .fromTo(
        travs[i],
        { yPercent: 0 },
        { yPercent: 100, duration: dur, ease: "power2.inOut", immediateRender: false },
        at,
      )
      // It docks under the next node as that node fills.
      .to(dots[i], { autoAlpha: 0, duration: 0.1, ease: "none" }, at + dur - 0.06);
  };

  // 1 · The record arrives.
  tl.to(card, { autoAlpha: 1, y: 0, duration: 0.4 }, 0).to(nodes[0], { scale: 1, duration: 0.3 }, 0.1);
  let t = 0.55;
  // 2 · The word the rule listens for.
  if (hl.length) {
    tl.to(hl, { scaleX: 1, duration: 0.35 }, t);
    t += 0.45;
  }
  // 3 · Down to the rule; 4 · the trigger it matched rings.
  rail(0, t, 0.6);
  t += 0.6;
  tl.to(nodes[1], { scale: 1, duration: 0.3 }, t - 0.06)
    .to(ring, { autoAlpha: 1, duration: 0.3 }, t)
    .to(pdot, { backgroundColor: ACCENT, duration: 0.3 }, t);
  t += 0.35;
  // 5 · Each step in order: it runs, then it's done.
  for (const row of steps) {
    tl.to(layer(row, "wait"), { autoAlpha: 0, duration: 0.15 }, t).to(
      layer(row, "run"),
      { autoAlpha: 1, duration: 0.2 },
      t + 0.05,
    );
    t += 0.9;
    tl.to(layer(row, "run"), { autoAlpha: 0, duration: 0.15 }, t)
      .to(layer(row, "done"), { autoAlpha: 1, duration: 0.2 }, t + 0.05)
      .fromTo(
        layer(row, "check"),
        { autoAlpha: 0, scale: 0.6 },
        { autoAlpha: 1, scale: 1, duration: 0.3, ease: "back.out(2)", immediateRender: false },
        t + 0.05,
      );
    t += 0.1;
  }
  // 6 · The results travel down and land.
  t += 0.2;
  rail(1, t, 0.6);
  t += 0.6;
  tl.to(nodes[2], { scale: 1, duration: 0.3 }, t - 0.06).to(
    outs,
    { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.08 },
    t,
  );
  t += 0.4 + 0.08 * Math.max(0, outs.length - 1);
  // 7 · The tag goes back onto the call: the same chip, so a pure translate.
  if (src && dst) {
    t += 0.2;
    let from: { x: number; y: number } | null = null;
    // Measured when the flight starts, in the stage's own units (it may
    // still be finishing its rise, scaled a hair under 1).
    const offset = () => {
      if (from) return from;
      const scale = root.getBoundingClientRect().width / root.offsetWidth || 1;
      const a = src.getBoundingClientRect();
      const b = dst.getBoundingClientRect();
      from = { x: (a.left - b.left) / scale, y: (a.top - b.top) / scale };
      return from;
    };
    tl.set(src, { autoAlpha: 0 }, t)
      .set(dst, { autoAlpha: 1, zIndex: 2 }, t)
      // Lifted first, then carried: the rise leads the slide a little.
      .fromTo(
        dst,
        { y: () => offset().y },
        { y: 0, duration: 0.6, ease: "power2.inOut", immediateRender: false },
        t,
      )
      .fromTo(
        dst,
        { x: () => offset().x },
        { x: 0, duration: 0.6, ease: "power3.inOut", immediateRender: false },
        t,
      )
      .fromTo(
        dst,
        { boxShadow: CHIP_REST },
        { boxShadow: CHIP_LIFT, duration: 0.2, immediateRender: false },
        t,
      )
      .to(dst, { boxShadow: CHIP_REST, duration: 0.25 }, t + 0.42)
      .set(dst, { zIndex: "auto" }, t + 0.6);
    t += 0.6;
  }
  // 8 · Complete.
  rail(2, t, 0.3, false);
  t += 0.3;
  tl.to(nodes[3], { scale: 1, duration: 0.3 }, t - 0.06)
    .to(done, { autoAlpha: 1, y: 0, duration: 0.3 }, t)
    .fromTo(
      ping,
      { autoAlpha: 0.6, scale: 1 },
      { autoAlpha: 0, scale: 2.8, duration: 0.8, immediateRender: false },
      t + 0.05,
    );

  return tl;
}

/* ─── The picker ─────────────────────────────────────────────────── */

/**
 * The four moments a rule can start on. A list with each moment's
 * meaning from lg up; below that a rail of chips above the stage.
 */
function Picker({
  triggers,
  index,
  label,
  onPick,
}: {
  triggers: AfterRelayData["triggers"];
  index: number;
  label: string;
  onPick: (i: number) => void;
}) {
  const rows = useRovingRadio({ count: triggers.length, index, orientation: "vertical", onChange: onPick });
  const chips = useRovingRadio({ count: triggers.length, index, orientation: "horizontal", onChange: onPick });

  return (
    <>
      <div className="mt-8 lg:hidden">
        <ChipRail label={label}>
          {triggers.map((t, i) => (
            <button
              key={t.id}
              type="button"
              {...chips.getItemProps(i)}
              className={cn(
                "relative h-10 rounded-full px-4 text-[14px] leading-5 whitespace-nowrap transition-colors duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
                "before:absolute before:inset-x-0 before:-inset-y-0.5",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink",
                i === index ? "bg-pp-ink text-white" : "bg-pp-card text-pp-ink hover:bg-[#ebe9f1]",
              )}
            >
              {t.label}
            </button>
          ))}
        </ChipRail>
      </div>

      <div
        {...rows.groupProps}
        aria-label={label}
        className="mt-8 hidden flex-col gap-1 lg:col-start-1 lg:row-start-2 lg:-mx-4 lg:flex"
      >
        {triggers.map((t, i) => (
          <button
            key={t.id}
            type="button"
            {...rows.getItemProps(i)}
            className={cn(
              "group relative rounded-2xl px-4 py-3 text-left transition-colors duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink",
              i === index ? "bg-pp-card" : "hover:bg-pp-card/60",
            )}
          >
            {/* Hangs in the row's padding, so the words line up with the heading. */}
            <span
              aria-hidden
              className={cn(
                "absolute top-[20px] left-[5px] size-1.5 rounded-full transition-colors duration-300",
                i === index ? "bg-[#551a89]" : "bg-pp-ink/15",
              )}
            />
            <span className="block text-[15px] leading-[22px] text-pp-ink">{t.label}</span>
            <span className={cn("mt-0.5 block", TYPE.meta)}>{t.body}</span>
          </button>
        ))}
      </div>
    </>
  );
}

/* ─── The rail ───────────────────────────────────────────────────── */

function Station({
  i,
  label,
  className,
  children,
}: {
  i: number;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("relative grid grid-cols-[var(--g)_minmax(0,1fr)]", className)}>
      <Segment i={i} bead={i < 2} />
      <Node i={i} />
      <p className={cn("col-start-2 row-start-1", TYPE.label, "text-pp-muted")}>{label}</p>
      <div className="col-start-2 row-start-2 mt-3 min-w-0">{children}</div>
    </div>
  );
}

/** A station's mark on the rail: hollow until the run reaches it. */
function Node({ i, settled = false }: { i: number; settled?: boolean }) {
  return (
    <span className="relative z-[1] col-start-1 row-start-1 mt-[3.5px] size-[9px] justify-self-center rounded-full bg-pp-card shadow-[inset_0_0_0_1.5px_rgb(24_16_40/0.18)]">
      {settled && (
        <span
          data-a="ping"
          className="invisible absolute inset-0 rounded-full border border-[#1f8a55] opacity-0"
        />
      )}
      <span
        data-a={`node-${i}`}
        className={cn("absolute inset-0 rounded-full", settled ? "bg-[#1f8a55]" : "bg-[#551a89]")}
      />
    </span>
  );
}

/**
 * The rail from this station's node to the next one's, centre to centre
 * (the nodes sit on top): a dotted line, the ink that draws over it, and
 * the bead that draws it.
 */
function Segment({ i, bead }: { i: number; bead: boolean }) {
  return (
    <span className="pointer-events-none absolute top-2 bottom-[calc(-1*(var(--s)_+_8px))] left-[calc(var(--g)/2_-_1px)] w-0.5">
      <span className="absolute inset-0 [background-image:radial-gradient(circle,rgb(24_16_40/0.26)_0.8px,transparent_1.2px)] [background-size:2px_5px] bg-repeat-y" />
      <span data-a={`fill-${i}`} className="absolute inset-y-0 left-[0.25px] w-[1.5px] origin-top rounded-full bg-[#551a89]" />
      {bead && (
        <span data-a={`trav-${i}`} className="absolute inset-0">
          <span
            data-a={`dot-${i}`}
            className="invisible absolute top-0 left-1/2 size-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#551a89] opacity-0"
          />
        </span>
      )}
    </span>
  );
}

/**
 * Every sample of a block in one grid cell: the live one on top, the
 * others invisible underneath, so the block is always as tall as its
 * tallest sample.
 */
function Stack({
  scenes,
  index,
  children,
}: {
  scenes: readonly AfterScene[];
  index: number;
  children: (s: AfterScene, live: boolean) => ReactNode;
}) {
  return (
    <div className="relative grid grid-cols-[minmax(0,1fr)]">
      {scenes.map((s, i) =>
        i === index ? (
          <div key={s.id} className="min-w-0 [grid-area:1/1]">
            {children(s, true)}
          </div>
        ) : (
          <Sizer key={s.id} className="min-w-0">
            {children(s, false)}
          </Sizer>
        ),
      )}
    </div>
  );
}

/* ─── The blocks ─────────────────────────────────────────────────── */

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-pp-card px-2.5 text-[12px] leading-4 whitespace-nowrap text-pp-ink/70">
      {children}
    </span>
  );
}

/** One chip, drawn the same wherever it is, so its flight never resizes it. */
function TagChip({ tag, hook, className }: { tag: string; hook: Hook; className?: string }) {
  return (
    <span
      {...hook}
      className={cn(
        "relative inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-[#f1ecf8] pr-2.5 pl-2 font-[family-name:var(--font-geist-mono)] text-[12px] leading-4 whitespace-nowrap text-[#551a89]",
        className,
      )}
      style={{ boxShadow: CHIP_REST }}
    >
      <Tag aria-hidden className="size-3" strokeWidth={2} />
      {tag}
    </span>
  );
}

function CallCard({ s, L, live }: { s: AfterScene; L: Labels; live: boolean }) {
  const a = hooks(live);
  const c = s.call;
  return (
    <div {...a("card")} className={cn("relative flex h-full flex-col rounded-[20px] bg-white p-4 sm:p-5", RAISED)}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="text-[17px] leading-6 tabular-nums">{c.number}</p>
        <Chip>{c.status}</Chip>
      </div>
      <p className={cn("mt-2 text-pretty", TYPE.body, !c.summary && "text-pp-muted")}>{c.summary || L.noSummary}</p>
      {c.heard && (
        <p className="mt-3 rounded-xl bg-pp-card px-3 py-2 text-[13px] leading-[18px] text-pp-muted">
          {c.heard.before}
          <span className="relative text-pp-ink">
            <span
              {...a("hl")}
              className="absolute -inset-x-0.5 inset-y-0 origin-left rounded-[4px] bg-[#551a89]/12"
            />
            <span className="relative">{c.heard.word}</span>
          </span>
          {c.heard.after}
        </p>
      )}
      {/* The record's footer, pinned: how long, how it went, and the tags a rule writes. */}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        <span className={cn(TYPE.mono, "mr-1 text-pp-muted")}>{c.duration}</span>
        {c.sentiment && <Chip>{L.sentiment[c.sentiment]}</Chip>}
        {s.tag && <TagChip tag={s.tag} hook={a("tag-dst")} />}
      </div>
    </div>
  );
}

function RuleBlock({
  s,
  trigger,
  L,
  stepTitle,
  live,
}: {
  s: AfterScene;
  trigger: string;
  L: Labels;
  stepTitle: AfterRelayData["stepTitle"];
  live: boolean;
}) {
  const a = hooks(live);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-y-2 sm:grid-cols-[48px_minmax(0,1fr)] sm:gap-x-4 sm:gap-y-3">
      <p className={cn(TYPE.meta, "sm:pt-[7px]")}>{L.when}</p>
      <div>
        <span
          className={cn(
            "relative inline-flex h-8 items-center gap-2 rounded-full bg-white px-3.5 text-[13px] leading-[18px]",
            RING,
          )}
        >
          <span {...a("pdot")} className="size-1.5 rounded-full bg-[#551a89]" />
          {trigger}
          <span
            {...a("ring")}
            className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_1.5px_rgb(85_26_137/0.55)]"
          />
        </span>
      </div>
      <p className={cn(TYPE.meta, "max-sm:mt-2 sm:pt-[14px]")}>{L.then}</p>
      <ol className={cn("rounded-[20px] bg-white", RING)}>
        {s.actions.map((act, i) => (
          <li
            key={i}
            {...a("step")}
            className={cn(
              "grid grid-cols-[20px_minmax(0,1fr)_16px] items-center gap-x-3 gap-y-1 px-4 py-3 [grid-template-areas:'n_m_i'_'._t_.']",
              "sm:grid-cols-[20px_minmax(0,1fr)_auto_16px] sm:[grid-template-areas:'n_m_t_i']",
              i > 0 && "border-t border-pp-rule",
            )}
          >
            <span className="grid size-5 place-items-center rounded-full bg-pp-card font-[family-name:var(--font-geist-mono)] text-[11px] leading-none text-pp-muted tabular-nums [grid-area:n]">
              {i + 1}
            </span>
            <span className="min-w-0 [grid-area:m]">
              <span className={cn("block", TYPE.body)}>{stepTitle[act.kind]}</span>
              <span className={cn("block truncate text-pp-muted", TYPE.mono)}>{act.detail}</span>
            </span>
            <span className="grid justify-items-start text-[13px] leading-[18px] [grid-area:t] sm:justify-items-end">
              <span data-s="wait" className="invisible text-pp-muted opacity-0 [grid-area:1/1]">
                {L.queued}
              </span>
              <span data-s="run" className="invisible text-pp-muted opacity-0 [grid-area:1/1]">
                {L.running}
              </span>
              <span data-s="done" className="text-[#1f8a55] [grid-area:1/1]">
                {act.result}
              </span>
            </span>
            <span className="grid size-4 place-items-center [grid-area:i]">
              <span data-s="wait" className="invisible size-1.5 rounded-full bg-pp-ink/20 opacity-0 [grid-area:1/1]" />
              <span
                data-s="run"
                className="invisible size-3.5 animate-spin rounded-full border-[1.5px] border-[#551a89]/20 border-t-[#551a89] opacity-0 [grid-area:1/1] group-data-[paused]/stage:[animation-play-state:paused]"
              />
              <span
                data-s="check"
                className="grid size-4 place-items-center rounded-full bg-[#1f8a55] text-white [grid-area:1/1]"
              >
                <Check className="size-2.5" strokeWidth={3} />
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function LandsBlock({ s, live }: { s: AfterScene; live: boolean }) {
  const a = hooks(live);
  const hook = s.actions.find((x) => x.kind === "webhook");
  return (
    <div className="flex flex-col items-start gap-2">
      {/* Each row: a mono token (the method, the channel), then what
          arrived there. */}
      {s.webhook && (
        <div
          {...a("out")}
          className={cn(
            OUT_ROW,
            "grid-cols-[auto_minmax(0,1fr)] [grid-template-areas:'m_s'_'u_u'] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:[grid-template-areas:'m_u_s']",
            RING,
          )}
        >
          <p className={cn(TYPE.mono, "[grid-area:m]")}>POST</p>
          <p className={cn(TYPE.mono, "min-w-0 text-pp-muted [grid-area:u] [overflow-wrap:anywhere] max-sm:mt-1")}>
            {breakable(s.webhook.url)}
          </p>
          {hook && (
            <p className={cn(TYPE.mono, "flex items-center gap-1.5 justify-self-end text-[#1f8a55] [grid-area:s]")}>
              <span className="size-1.5 rounded-full bg-[#1f8a55]" />
              {hook.result}
            </p>
          )}
        </div>
      )}
      {s.slack && (
        <div {...a("out")} className={cn(OUT_ROW, "sm:grid-cols-[auto_minmax(0,1fr)]", RING)}>
          <p className={cn(TYPE.mono, "text-pp-muted")}>{s.slack.channel}</p>
          <p className="text-[13px] leading-[18px] text-pretty max-sm:mt-1">{quiet(s.slack.text)}</p>
        </div>
      )}
      {/* Its landing place is the call: in the finished run it has already flown. */}
      {s.tag && (
        <div {...a("out")} className="flex">
          <TagChip tag={s.tag} hook={a("tag-src")} className="invisible opacity-0" />
        </div>
      )}
    </div>
  );
}

/**
 * The message exactly as the product posts it, emoji included, but the
 * emoji in greys: it is the only full-colour glyph on the page.
 */
function quiet(text: string) {
  const m = /^([\uD800-\uDBFF][\uDC00-\uDFFF]\uFE0F?)(\s*)/.exec(text);
  if (!m) return text;
  return (
    <>
      <span className="inline-block grayscale">{m[1]}</span>
      {m[2]}
      {text.slice(m[0].length)}
    </>
  );
}

/** A URL that may wrap after any single slash, never inside "//" or a word. */
function breakable(url: string) {
  return url.split(/(?<=[^/]\/)(?!\/)/).map((part, i) => (
    <span key={i}>
      {i > 0 && <wbr />}
      {part}
    </span>
  ));
}

/** What the stage shows, for a screen reader: the finished run, never narrated live. */
function Summary({
  s,
  trigger,
  L,
  stepTitle,
}: {
  s: AfterScene;
  trigger: string;
  L: Labels;
  stepTitle: AfterRelayData["stepTitle"];
}) {
  const c = s.call;
  const hook = s.actions.find((x) => x.kind === "webhook");
  const lands = [
    s.webhook && `POST ${s.webhook.url}${hook ? `, ${hook.result}` : ""}`,
    s.slack && `${s.slack.channel}: ${s.slack.text}`,
    s.tag && `${stepTitle.tag}: ${s.tag}`,
  ].filter(Boolean);
  return (
    <div className="sr-only">
      <p>
        {L.callTitle}: {c.number}, {c.status}, {c.duration}
        {c.sentiment ? `, ${L.sentiment[c.sentiment]}` : ""}. {c.summary || L.noSummary}
        {c.heard ? ` “${c.heard.before}${c.heard.word}${c.heard.after}”` : ""}
      </p>
      <p>
        {L.ruleTitle}: {L.when} {trigger}. {L.then}:
      </p>
      <ol>
        {s.actions.map((act, i) => (
          <li key={i}>
            {stepTitle[act.kind]}, {act.detail}: {act.result}.
          </li>
        ))}
      </ol>
      <p>
        {L.outTitle}: {lands.join(" · ")}
      </p>
      <p>{s.runDone}</p>
    </div>
  );
}
