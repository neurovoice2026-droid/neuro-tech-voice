"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { KeyRound, Moon, Phone, Sun, UserRound } from "lucide-react";
import { FluidOrb } from "@/components/site/product/fluid-orb";
import { Frame, PillLink } from "@/components/site/product/primitives";
import { useInView } from "@/components/site/product/timing";
import { HOME_CALL, type HomeMomentId } from "@/lib/pages/home/call";
import type { HomeCall, HomeLine } from "@/lib/pages/home.server";
import { cn } from "@/lib/utils";
import { CHIP, RING_LIGHT, RoundButton, useRovingRadio } from "./controls";
import { IDLE, POSTER, TOUR, scriptFor, type Frame as StageFrame, type RunRequest } from "./demo-script";
import { buildRun } from "./demo-timeline";
import { HomeHeading } from "./heading";
import { useStageMotion } from "./motion";
import { MOMENT_LIGHTS } from "./palettes";
import { TYPE, WEIGHT } from "./type";
import "./demo.css";

/* ------------------------------------------------------------------ *
 * #demo — closed is for the door, not the phone.
 *
 * The first thing under the hero, and the page's answer to "does it
 * really take my calls?": a clock the size of the stage, with Ava's orb
 * for its colon, stopped at the worst moment to ring a small business.
 * The reader picks the moment — mid-rush on a Friday, just after closing
 * on a Thursday, a Sunday morning, 3 a.m. — and the clock spins to it,
 * the room takes that hour's light, the studio's door sign says whether
 * anyone is in, the phone rings, the orb picks up and the call plays out
 * under it, a line at a time. It ends with the outcome in the owner's log
 * and the owner where they were all along: still with the client, on the
 * way home, still off, still asleep.
 *
 * The sub is the index. Its four phrases are the four moments, each in
 * its own ink, and the one being dialled is the one that stays lit.
 *
 * Untouched, the stage tours the four once (busy, just gone, day off,
 * asleep) while it has the screen, and ends on the frame the server drew:
 * 3 a.m., booked.
 * That frame is also what a reader without scripts sees, what reduced
 * motion keeps (picking a moment then switches to its finished frame at
 * once), and what a weak device shows until it is tapped.
 *
 * The run itself is demo-timeline.ts, on demo-script.ts's schedule; this
 * file holds the markup and derives its state from the run's frames.
 * ------------------------------------------------------------------ */

const ORDER = TOUR;

/** The eleven cells of a clock figure's strip. */
const CELLS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

/** Every status pill's box, as the old call log's: same height, padding and face. */
const PILL =
  "relative inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[13px] leading-7 whitespace-nowrap sm:gap-2 sm:px-3";

/**
 * The small print on the stage and under it, in the body face as written:
 * sentence case, no tracking. Tabular figures only where a time is set:
 * Inter's tnum widens the hyphen too, and "made-up" would gape. Inside the
 * stage's padding a phone gives the transport captions 255px at 375 (one
 * line each) and 200px at 320, where they wrap rather than run off the
 * stage; they stand side by side only from md, where the column has room
 * for both.
 */
const SMALL = "text-[12px] leading-[18px]";
const CAPTION = cn("home-demo-tone text-(--d-dim) md:whitespace-nowrap", SMALL);

const OWNER_ICON = { rush: UserRound, closing: KeyRound, sunday: Sun, night: Moon } as const;

const REST: StageFrame = {
  target: POSTER,
  moment: POSTER,
  line: -1,
  listening: false,
  ended: true,
  done: true,
};

export function Demo({ calls }: { calls: HomeCall[] }) {
  const c = HOME_CALL;
  const byId = useMemo(
    () => Object.fromEntries(calls.map((call) => [call.id, call])) as Record<HomeMomentId, HomeCall>,
    [calls],
  );

  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  /** Read by the orb every frame. */
  const voice = useRef(IDLE);
  const digitPos = useRef<number[]>([...byId[POSTER].digits]);
  const tlRef = useRef<ReturnType<typeof buildRun>>(null);
  const runner = useRef<((req: RunRequest) => void) | null>(null);
  const pending = useRef<RunRequest | null>(null);
  const frameRef = useRef<StageFrame>(REST);
  const momentRef = useRef<HomeMomentId>(POSTER);
  /** The reader started the run under way (a pick, Play, Replay), so its ends are announced. */
  const readerRun = useRef(false);
  /** The reader's last pick: what Replay plays again. */
  const pickedRef = useRef<HomeMomentId | null>(null);
  const debounce = useRef(0);

  const m = useStageMotion(sectionRef, { id: "demo" });
  const { kit, reduce, playing, paused, setPaused, interacted, markInteracted, tier } = m;
  const lite = tier === "lite";
  const liteRef = useRef(lite);
  // The tour waits for the stage itself to be properly on screen, not the heading above it.
  const stageSeen = useInView(stageRef, "0px 0px -15% 0px");

  /** The moment being dialled: the checked key (drawn filled) and the lit phrase of the sub. */
  const [target, setTarget] = useState<HomeMomentId>(POSTER);
  /** The room's light, the clock, the owner and every copy at rest. */
  const [moment, setMoment] = useState<HomeMomentId>(POSTER);
  const [ended, setEnded] = useState(true);
  const [listening, setListening] = useState(false);
  /** A run is under way. */
  const [live, setLive] = useState(false);
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const [announce, setAnnounce] = useState("");

  useEffect(() => {
    liteRef.current = lite;
  }, [lite]);

  // State from the run's frames, set only when it changes.
  const onFrame = useRef<(f: StageFrame) => void>(() => {});
  useLayoutEffect(() => {
    onFrame.current = (f) => {
      const was = frameRef.current;
      frameRef.current = f;
      if (f.target !== was.target) setTarget(f.target);
      if (f.moment !== was.moment) {
        momentRef.current = f.moment;
        setMoment(f.moment);
      }
      if (f.listening !== was.listening) setListening(f.listening);
      if (f.ended !== was.ended) {
        setEnded(f.ended);
        // Spoken when a call the reader started ends. Never during the untouched tour.
        if (f.ended && readerRun.current) setAnnounce(announceFor(f.target));
      }
      if (f.done && !was.done) {
        setDone(true);
        setLive(false);
      }
    };
  });

  // The call's words, not the array's identity: a refreshed server payload
  // hands down an equal but new array, which must not rebuild the stage.
  const sig = calls.map((call) => `${call.id}@${call.time}:${call.lines.map((l) => l.t).join("|")}`).join("/");

  // The runner: kills whatever run is going and builds the next from where
  // the stage stands. Never with reduced motion; torn down (to the frame at
  // rest of whatever moment the stage had reached) when that changes.
  useLayoutEffect(() => {
    const root = sectionRef.current;
    if (!kit || reduce || !root) return;
    const { gsap } = kit;
    runner.current = (req) => {
      tlRef.current?.kill();
      const script = scriptFor(calls, { ...req, from: momentRef.current });
      frameRef.current = { ...frameRef.current, done: false };
      // Cleared at the start, so the same call ending again is a change the reader hears.
      setAnnounce("");
      tlRef.current = buildRun({
        gsap,
        root,
        script,
        calls,
        lite: liteRef.current,
        voice,
        digitPos: digitPos.current,
        onFrame: (f) => onFrame.current(f),
      });
      setDone(false);
      setLive(true);
      setRunKey((k) => k + 1);
    };
    const waiting = pending.current;
    pending.current = null;
    if (waiting) runner.current(waiting);

    return () => {
      runner.current = null;
      tlRef.current?.kill();
      tlRef.current = null;
      gsap.set(gsap.utils.toArray<HTMLElement>(".home-demo-anim, .home-demo-fx", root), {
        clearProps: "transform,opacity,visibility,willChange",
      });
      voice.current = IDLE;
      digitPos.current = [...byId[momentRef.current].digits];
      const f = frameRef.current;
      frameRef.current = {
        ...f,
        target: f.moment,
        listening: false,
        ended: true,
        done: true,
      };
      setTarget(f.moment);
      setListening(false);
      setEnded(true);
      setLive(false);
      setDone(true);
    };
    // `calls` and `byId` are keyed by `sig`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kit, reduce, sig]);

  const request = (req: RunRequest, byReader: boolean) => {
    readerRun.current = byReader;
    if (runner.current) runner.current(req);
    else pending.current = req;
  };

  const announceFor = (id: HomeMomentId) => {
    const call = byId[id];
    return c.announce(call.day, call.time, call.outcomeLabel);
  };

  // The tour: once, untouched, once the stage has had the screen for a moment.
  useEffect(() => {
    if (started || interacted || !kit || !playing || !stageSeen || lite || reduce) return;
    const id = window.setTimeout(() => {
      setStarted(true);
      request({ kind: "tour", ids: TOUR, from: momentRef.current }, false);
    }, 900);
    return () => window.clearTimeout(id);
  }, [started, interacted, kit, playing, stageSeen, lite, reduce]);

  // Plays while it has the stage and is not paused by hand.
  useEffect(() => {
    const tl = tlRef.current;
    if (!tl || done) return;
    if (playing && started) tl.play();
    else tl.pause();
  }, [playing, started, done, runKey]);

  useEffect(() => () => window.clearTimeout(debounce.current), []);

  /** Reduced motion: the moment's finished frame, at once, and its outcome spoken. */
  const jump = (id: HomeMomentId) => {
    frameRef.current = { ...REST, target: id, moment: id };
    momentRef.current = id;
    digitPos.current = [...byId[id].digits];
    setTarget(id);
    setMoment(id);
    setEnded(true);
    setAnnounce("");
    window.setTimeout(() => setAnnounce(announceFor(id)), 60);
  };

  const dial = (id: HomeMomentId) => {
    if (reduce) return jump(id);
    setStarted(true);
    request({ kind: "single", ids: [id], from: momentRef.current }, true);
  };

  const radio = useRovingRadio({
    count: ORDER.length,
    index: ORDER.indexOf(target),
    orientation: "horizontal",
    onChange: (i, via) => {
      const id = ORDER[i];
      markInteracted();
      setPaused(false);
      // Checked, filled and lit at once, even while an arrow key is still walking or GSAP is on its way.
      setTarget(id);
      pickedRef.current = id;
      window.clearTimeout(debounce.current);
      // A held arrow key walks the keys; only where it stops is dialled. The run
      // under way holds still meanwhile, so it cannot light a key of its own.
      if (via === "key" && !reduce) {
        tlRef.current?.pause();
        debounce.current = window.setTimeout(() => dial(id), 450);
      } else dial(id);
    },
  });

  const onTransport = () => {
    markInteracted();
    if (!started || done) {
      setPaused(false);
      setStarted(true);
      // Again what was played: the tour, unless the reader has picked (or the device is weak).
      const again = pickedRef.current ?? (liteRef.current ? target : null);
      request(
        again
          ? { kind: "single", ids: [again], from: momentRef.current }
          : { kind: "tour", ids: TOUR, from: momentRef.current },
        true,
      );
      return;
    }
    setPaused(!paused);
  };

  const control: "play" | "pause" | "replay" =
    reduce || (started && done) ? "replay" : !started || paused ? "play" : "pause";
  const L = MOMENT_LIGHTS[moment];
  const now = byId[moment];
  const booked = moment === "night" && ended;
  // The caller's lean toward blue is for the shader only: the CSS stand-in would cut to it.
  const shaderColors = listening ? L.listen : L.orb;
  // The orb moves only while a call does.
  const orbStill = reduce || !playing || !live;
  const OwnerIcon = OWNER_ICON[moment];

  return (
    <section
      ref={sectionRef}
      id="demo"
      aria-labelledby="demo-title"
      data-target={target}
      data-live={live || undefined}
      // Not scroll-mt-28 like the rest: the section clears the header pill
      // with its own top padding, so /#demo lands on its top edge.
      className="home-demo relative scroll-mt-0"
    >
      <Frame className="relative pt-[120px] pb-14 md:pt-[136px] lg:pt-[152px]">
        <HomeHeading
          id="demo-title"
          size="display"
          eyebrow={c.eyebrow}
          title={c.title}
          titleKey={c.key}
          sub={<Phrased sub={c.sub} phrases={c.phrases} />}
        />

        {/* The picker, above the stage at every width: the order it is read in. */}
        <div className="mt-8 lg:mt-10">
          <p id="demo-pick" className={cn(TYPE.label, "text-pp-muted")}>
            {c.picker.legend}
          </p>
          <div
            {...radio.groupProps}
            aria-labelledby="demo-pick"
            className="mt-3 grid max-w-[928px] grid-cols-2 gap-2 sm:grid-cols-4 md:gap-3"
          >
            {ORDER.map((id, i) => {
              const on = target === id;
              const call = byId[id];
              const label = c.picker.keys[id];
              return (
                <button
                  key={id}
                  type="button"
                  {...radio.getItemProps(i)}
                  data-key={id}
                  aria-label={c.picker.name(label, call.day, call.time)}
                  className={cn(
                    "home-demo-fx relative flex h-[60px] min-w-0 flex-col justify-center rounded-2xl px-3 text-left active:scale-[0.97] max-[359px]:px-2.5 md:h-16 md:flex-row md:items-center md:justify-start md:gap-3 md:px-3.5",
                    CHIP.ease,
                    RING_LIGHT,
                    on ? "bg-(--ink) text-white" : "bg-white text-pp-ink ring-1 ring-pp-hair hover:bg-(--home-wash)",
                  )}
                  style={
                    {
                      "--ink": MOMENT_LIGHTS[id].ink,
                      "--disc": MOMENT_LIGHTS[id].disc,
                    } as CSSProperties
                  }
                >
                  <span
                    aria-hidden
                    data-key-disc
                    className={cn(
                      "home-demo-fx hidden size-8 shrink-0 place-items-center rounded-full [background:var(--disc)] md:grid",
                      on && "ring-2 ring-white/70",
                    )}
                  >
                    <Phone className="home-demo-fx size-3.5 text-white" strokeWidth={2.25} />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="flex items-center gap-1.5 truncate text-[14px] leading-[18px] font-medium max-[359px]:text-[13px] md:text-[15px] md:leading-5">
                      {/* On the smallest phones the label needs the dot's room. */}
                      <span
                        aria-hidden
                        className="size-2 shrink-0 rounded-full [background:var(--disc)] max-[359px]:hidden md:hidden"
                      />
                      {label}
                    </span>
                    <span className={cn("mt-0.5 tabular-nums", SMALL, on ? "text-white" : "text-pp-muted")}>
                      {call.day.slice(0, 3)} {call.time}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* The stage. */}
        <div
          ref={stageRef}
          data-moment={moment}
          data-tone={L.tone}
          data-booked={booked || undefined}
          className="home-demo-stage relative isolate mt-5 overflow-hidden rounded-[24px] px-4 pt-5 pb-4 shadow-[0_0_0_1px_rgb(24_16_40/0.06)] [contain:layout_paint] md:mt-6 md:rounded-[28px] md:px-8 md:pt-8 md:pb-6 lg:rounded-[32px] lg:px-11 lg:pt-10 lg:pb-7"
          style={{ "--num": L.num, "--wave": L.wave } as CSSProperties}
        >
          {ORDER.map((id) => (
            <div
              key={id}
              aria-hidden
              data-lit={id === moment || undefined}
              className="home-demo-ground absolute inset-0 -z-10"
              style={{ background: MOMENT_LIGHTS[id].ground }}
            />
          ))}
          <div aria-hidden className="home-grain" />

          {/* The picture: hidden from assistive tech, which gets the transcripts below. */}
          <div aria-hidden className="home-demo-picture">
            {/* Status: the door sign and the day and time, then the phase of the call on
                its own centred line (its copies differ in width, so they sit in one cell). */}
            <div className="flex items-center justify-center gap-3">
              <span className="home-demo-sign home-demo-fx grid justify-items-center">
                {(["open", "closed"] as const).map((f) => (
                  <span
                    key={f}
                    data-sign={f}
                    data-on={(now.open ? "open" : "closed") === f || undefined}
                    className="home-demo-anim home-demo-sign-face inline-flex h-6 items-center rounded-full px-2.5 text-[10px] leading-none font-semibold tracking-[0.16em] uppercase [grid-area:1/1]"
                  >
                    {c.sign[f]}
                  </span>
                ))}
              </span>
              <span className="grid justify-items-start">
                {ORDER.map((id) => (
                  <span
                    key={id}
                    data-day={id}
                    data-on={id === moment || undefined}
                    className={cn("home-demo-anim home-demo-tone text-(--d-ink) [grid-area:1/1]", TYPE.label)}
                  >
                    {byId[id].day} <span className="tabular-nums">{byId[id].time}</span>
                  </span>
                ))}
              </span>
            </div>
            <div className="mt-2 grid justify-items-center">
              {(["ringing", "picked", "ended"] as const).map((p) => (
                <span
                  key={p}
                  data-phase={p}
                  data-on={p === "ended" || undefined}
                  className={cn(
                    "home-demo-anim home-demo-tone inline-flex items-center gap-2 text-(--d-dim) [grid-area:1/1]",
                    TYPE.label,
                  )}
                >
                  {/* The ringing phase's dot is the one that pulses with the rings. */}
                  <span
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      p === "ringing" ? "home-demo-dot home-demo-fx bg-(--d-caller)" : "bg-(--d-agent)",
                    )}
                  />
                  {c.status[p]}
                </span>
              ))}
            </div>

            {/* The clock: the orb is its colon. */}
            <div
              translate="no"
              className="home-demo-lockup relative isolate mt-4 flex items-center justify-center md:mt-6"
            >
              <span className="home-demo-wave home-demo-fx" />
              <span className="home-demo-wave home-demo-fx" />
              <Figures digits={[now.digits[0], now.digits[1]]} from={0} />
              <div className="home-demo-orb home-demo-fx relative z-20 shrink-0">
                <FluidOrb
                  colors={L.orb}
                  shaderColors={shaderColors}
                  volume={voice}
                  still={orbStill}
                  gate="intent"
                  className="size-full"
                />
              </div>
              <Figures digits={[now.digits[2], now.digits[3]]} from={2} />
            </div>

            {/* The call, a line at a time; the line before in the smaller row above it. */}
            <div className="mx-auto mt-5 max-w-[680px] text-center md:mt-8">
              <div className="grid items-end overflow-clip pb-[0.14em] max-md:hidden">
                {calls.map((call) =>
                  call.lines.map((line, i) => (
                    <p
                      key={`${call.id}-${i}`}
                      data-row="prev"
                      data-call={call.id}
                      data-i={i}
                      data-on={(call.id === moment && i === call.lines.length - 2) || undefined}
                      className="home-demo-anim text-[13px] leading-[18px] text-balance [grid-area:1/1]"
                    >
                      <Line line={line} speaker={c.speakers[line.sp]} small />
                    </p>
                  )),
                )}
              </div>
              <div className="mt-2 grid items-center overflow-clip pb-[0.14em]">
                {calls.map((call) =>
                  call.lines.map((line, i) => (
                    <p
                      key={`${call.id}-${i}`}
                      data-row="cur"
                      data-call={call.id}
                      data-i={i}
                      data-on={(call.id === moment && i === call.lines.length - 1) || undefined}
                      className="home-demo-anim text-[15px] leading-[22px] font-medium text-balance [grid-area:1/1] md:text-[19px] md:leading-[28px]"
                    >
                      <Line line={line} speaker={c.speakers[line.sp]} />
                    </p>
                  )),
                )}
              </div>
            </div>

            {/* The owner, and the outcome in their log. */}
            <div className="home-demo-tone mt-5 border-t border-(--d-rule) pt-4 md:mt-7 md:flex md:items-end md:justify-between md:gap-6 md:pt-5">
              <div className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-(--d-tile)">
                  <OwnerIcon className="home-demo-tone size-4 text-(--d-agent)" strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <p className={cn("home-demo-tone text-(--d-dim)", TYPE.label)}>{c.owner.label}</p>
                  <div className="mt-1 grid">
                    {ORDER.flatMap((id) =>
                      (["before", "after"] as const).map((when) => {
                        const o = c.owner.moments[id];
                        return (
                          <div
                            key={`${id}-${when}`}
                            data-owner={id}
                            data-when={when}
                            data-on={(id === moment && when === "after") || undefined}
                            className="home-demo-anim [grid-area:1/1]"
                          >
                            <p
                              className="home-demo-tone pp-display text-[19px] leading-[26px] tracking-[-0.01em] text-(--d-agent)"
                              style={{ fontWeight: WEIGHT.h3 }}
                            >
                              {when === "before" ? o.before : o.after}
                            </p>
                            <p className="home-demo-tone text-[13px] leading-[18px] text-(--d-dim)">
                              {when === "after" ? o.clause : " "}
                            </p>
                          </div>
                        );
                      }),
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-3 md:mt-0 md:text-right">
                <p className={cn("home-demo-tone mb-2 text-(--d-dim) max-md:hidden", TYPE.label)}>{c.owner.log}</p>
                <div className="grid justify-items-start md:justify-items-end">
                  {calls.map((call) => (
                    <span
                      key={call.id}
                      data-pill={call.id}
                      data-on={call.id === moment || undefined}
                      className={cn("home-demo-anim [grid-area:1/1]", PILL, PILL_TONE[call.outcome])}
                    >
                      <span aria-hidden className={cn("relative size-1.5 shrink-0 rounded-full", DOT[call.outcome])}>
                        <span
                          className={cn(
                            "home-demo-ping home-demo-fx absolute inset-0 rounded-full opacity-0",
                            DOT[call.outcome],
                          )}
                        />
                      </span>
                      {call.outcomeLabel}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* The transport, and what the stage is: a made-up business, with no audio. */}
          <div className="mt-5 grid grid-cols-[40px_minmax(0,1fr)] items-center gap-x-4 md:mt-6">
            <RoundButton
              icon={control}
              label={c.controls[control]}
              onClick={onTransport}
              disabled={reduce}
              tone={L.tone === "night" ? "dark" : "light"}
            />
            <div className="flex min-w-0 flex-col gap-1 md:flex-row md:justify-between md:gap-4">
              <p className={CAPTION}>{c.stageLabel}</p>
              <p className={CAPTION}>{c.caption}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
          <p className={cn("text-pretty text-pp-muted", SMALL)}>{c.foot}</p>
          <PillLink href={c.cta.href} variant="secondary">
            {c.cta.label}
          </PillLink>
        </div>
      </Frame>

      <div className="sr-only">
        <h3>{c.transcriptTitle}</h3>
        {calls.map((call) => (
          <div key={call.id}>
            <h4>
              {c.picker.keys[call.id]} — {call.day} {call.time}, {c.sign[call.open ? "open" : "closed"]}
            </h4>
            <p>
              {c.owner.label}: {c.owner.moments[call.id].before}
            </p>
            <ol>
              {call.lines.map((line, i) => (
                <li key={i}>
                  {c.speakers[line.sp]}: {line.t}
                </li>
              ))}
              <li>Outcome: {call.outcomeLabel}</li>
            </ol>
            <p>
              {c.owner.label}: {c.owner.moments[call.id].after} {c.owner.moments[call.id].clause}
            </p>
          </div>
        ))}
      </div>
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
    </section>
  );
}

/**
 * Each outcome's pill on the stage: the hand-over and the answer on white,
 * the move in the after-closing green on white, the booking in ember on the night.
 */
const PILL_TONE: Record<HomeCall["outcome"], string> = {
  handover: "bg-white text-(--home-ink) shadow-[0_0_0_1px_rgb(20_10_36/0.08)]",
  moved: "bg-white text-(--home-closing-ink) shadow-[0_0_0_1px_rgb(4_120_87/0.18)]",
  answered: "bg-white text-(--home-ink) shadow-[0_0_0_1px_rgb(20_10_36/0.08)]",
  booked: "bg-[rgb(238_84_35/0.16)] text-(--home-ember-lit)",
};

/** Flagged is told apart by shape as well as colour: a hollow dot. */
const DOT: Record<HomeCall["outcome"], string> = {
  handover: "shadow-[inset_0_0_0_1.5px_var(--home-flagged)]",
  moved: "bg-[#059669]",
  answered: "bg-(--home-electric)",
  booked: "bg-(--home-ember)",
};

/** A marked phrase in a line: the booked slot turns ember at the end, the hours take the agent's colour, the move its green. */
const MARK: Record<NonNullable<HomeLine["markTone"]>, string> = {
  booked: "home-booked",
  answered: "home-demo-tone text-(--d-answer)",
  moved: "home-demo-tone text-(--d-moved)",
};

/** Two clock figures: a strip each, standing at its figure. */
function Figures({ digits, from }: { digits: [number, number]; from: number }) {
  return (
    <span className="relative z-10 flex">
      {digits.map((d, i) => (
        <span key={from + i} className="home-demo-col home-demo-fx">
          <span
            className="home-demo-strip home-demo-fx pp-display"
            style={{ "--d": d, fontWeight: 440 } as CSSProperties}
          >
            {CELLS.map((n, k) => (
              <span key={k}>{n}</span>
            ))}
          </span>
        </span>
      ))}
    </span>
  );
}

/** One spoken line: the speaker's tag, then the words, its mark picked out. */
function Line({ line, speaker, small = false }: { line: HomeLine; speaker: string; small?: boolean }) {
  const agent = line.sp === "agent";
  let words: ReactNode = line.t;
  if (line.mark) {
    const at = line.t.indexOf(line.mark);
    words = (
      <>
        {line.t.slice(0, at)}
        <span className={cn("whitespace-nowrap", MARK[line.markTone ?? "answered"])}>{line.mark}</span>
        {line.t.slice(at + line.mark.length)}
      </>
    );
  }
  return (
    <>
      <span
        className={cn(
          "home-demo-tone mr-2.5 inline-block align-[0.12em] text-[10px] leading-none font-semibold tracking-[0.16em] uppercase md:text-[11px]",
          agent ? "text-(--d-agent)" : "text-(--d-caller)",
          small && "md:text-[10px]",
        )}
      >
        {speaker}
      </span>
      <span
        className={cn("home-demo-tone", agent ? (small ? "text-(--d-dim)" : "text-(--d-ink)") : "text-(--d-caller)")}
      >
        {words}
      </span>
    </>
  );
}

/** The sub, its four phrases each wrapped in its moment's ink. */
function Phrased({ sub, phrases }: { sub: string; phrases: Record<HomeMomentId, string> }) {
  const marks = (Object.entries(phrases) as [HomeMomentId, string][])
    .map(([id, text]) => ({ id, text, at: sub.indexOf(text) }))
    .sort((a, b) => a.at - b.at);
  const out: ReactNode[] = [];
  let from = 0;
  for (const mk of marks) {
    out.push(sub.slice(from, mk.at));
    out.push(
      <span key={mk.id} data-m={mk.id} className="home-demo-phrase whitespace-nowrap">
        {mk.text}
      </span>,
    );
    from = mk.at + mk.text.length;
  }
  out.push(sub.slice(from));
  return <>{out}</>;
}
