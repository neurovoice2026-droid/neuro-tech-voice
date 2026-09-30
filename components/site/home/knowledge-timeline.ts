import type { Kit } from "@/components/site/product/motion-kit";
import type { KbDoc, KbQuestion } from "@/lib/pages/knowledge-base";

/* ------------------------------------------------------------------ *
 * #knowledge, the clock: what the reading room looks like at rest, and
 * the steps one question takes through it.
 *
 * The steps and their holds are the knowledge-base page's own
 * (knowledge-base/hero.tsx, holdAt): listening, the question, reading
 * all five documents, the page found (or not), the answer. Everything
 * is set or tweened by GSAP from the markup React rendered, so the
 * frame the server drew and the frame a timeline ends on are the same
 * picture, built from the same constants below.
 *
 * Colours are written as rgba(): GSAP interpolates that form, not the
 * space-separated one.
 * ------------------------------------------------------------------ */

type Gsap = Kit["gsap"];
type Timeline = ReturnType<Gsap["timeline"]>;
type Split = Kit["SplitText"];

export type StatusKey = "listening" | "reading" | "found" | "missing" | "answering";
export const STATUS_KEYS: readonly StatusKey[] = ["listening", "reading", "found", "missing", "answering"];

export const ACCENT = "#551a89";
/** A bar still reading, and the one that answered. */
export const FILL_REST = "rgba(85,26,137,0.3)";
export const FILL_WIN = "rgba(85,26,137,1)";
/** The tile's ring at rest, and lifted: same two shadows, so one tweens into the other. */
export const TILE_REST = "0px 0px 0px 1px rgba(24,16,40,0.07), 0px 0px 0px 0px rgba(24,16,40,0)";
export const TILE_LIFT = "0px 0px 0px 1.5px rgba(85,26,137,0.85), 0px 14px 30px -20px rgba(24,16,40,0.35)";
/** How far the documents that did not answer step back. */
export const DIM = 0.55;
export const BEAM_LOSE = 0.2;
export const BEAM_MISS = 0.15;
/** The reading sheet gives way to "not in the documents". */
export const SHEET_DIM = 0;
export const DOT: Record<StatusKey, string> = {
  listening: "rgba(24,16,40,0.3)",
  reading: ACCENT,
  answering: ACCENT,
  found: "rgba(31,138,85,1)", // SETTLED
  missing: "rgba(107,104,120,1)", // muted: the orb has gone grey with it
};
/** The orb's volume through a question. */
export const VOL = { rest: 0.12, listen: 0.15, speak: 0.7, miss: 0.05 } as const;
/** Held on the first answer before the miss (hero.tsx holdAt, the last step). */
export const HOLD = 2.8;

const WORD_ASK = 0.12;
const WORD_SAY = 0.23;
const LIFT = -6;
const CLOSED = "inset(0% 0% 100% 0%)";
const OPEN = "inset(0% 0% 0% 0%)";
const WORD_FROM = { autoAlpha: 0, yPercent: 16, filter: "blur(3px)" };
const WORD_TO = { autoAlpha: 1, yPercent: 0, filter: "blur(0px)", duration: 0.9, ease: "power2.out" };

export type Model = { docs: readonly KbDoc[]; questions: readonly KbQuestion[] };

/** Index of the document that answers question `qi`, or -1 when none does. */
export function winner(m: Model, qi: number) {
  const id = m.questions[qi].doc;
  return id ? m.docs.findIndex((d) => d.id === id) : -1;
}

export function finishedStatus(m: Model, qi: number): StatusKey {
  return winner(m, qi) >= 0 ? "found" : "missing";
}

/** The beams as a timeline leaves them, so beams drawn in later (a resize past lg) can join in. */
export type BeamState = { drawn: boolean; win: number; miss: boolean };

export type Room = {
  stage: HTMLElement;
  tiles: HTMLElement[];
  fills: HTMLElement[];
  ticks: HTMLElement[];
  asks: HTMLElement[];
  answers: HTMLElement[];
  metas: HTMLElement[];
  askWords: Element[][];
  answerWords: Element[][];
  /** Keyed by question: each answered question opens its own page, with its own line marked. */
  pages: Map<number, HTMLElement>;
  marks: Map<number, HTMLElement>;
  sheet: HTMLElement | null;
  sheetLines: HTMLElement | null;
  sheetNote: HTMLElement | null;
  status: Record<StatusKey, HTMLElement | null>;
  /** Holds the status words; its width follows the words showing. */
  statusBox: HTMLElement | null;
  dot: HTMLElement | null;
};

function all<T extends Element>(root: Element, sel: string) {
  return Array.from(root.querySelectorAll<T>(sel));
}

/** Finds every moving part and splits the spoken lines into words. */
export function collect(stage: HTMLElement, SplitText: Split): Room {
  const asks = all<HTMLElement>(stage, "[data-kb-ask]");
  const answers = all<HTMLElement>(stage, "[data-kb-answer]");
  const status = Object.fromEntries(STATUS_KEYS.map((k) => [k, null])) as Room["status"];
  for (const el of all<HTMLElement>(stage, "[data-kb-status]")) status[el.dataset.kbStatus as StatusKey] = el;
  // The stage is hidden from assistive tech (a list outside it reads the
  // questions and answers), so the split adds no labels of its own.
  const words = (el: HTMLElement) => SplitText.create(el, { type: "words", aria: "none" }).words;
  return {
    stage,
    tiles: all(stage, "[data-kb-tile]"),
    fills: all(stage, "[data-kb-fill]"),
    ticks: all(stage, "[data-kb-tick]"),
    asks,
    answers,
    metas: all(stage, "[data-kb-meta]"),
    askWords: asks.map(words),
    answerWords: answers.map(words),
    pages: new Map(all<HTMLElement>(stage, "[data-kb-page]").map((el) => [Number(el.dataset.kbPage), el])),
    marks: new Map(all<HTMLElement>(stage, "[data-kb-mark]").map((el) => [Number(el.dataset.kbMark), el])),
    sheet: stage.querySelector<HTMLElement>("[data-kb-sheet]"),
    sheetLines: stage.querySelector<HTMLElement>("[data-kb-sheet-lines]"),
    sheetNote: stage.querySelector<HTMLElement>("[data-kb-sheet-note]"),
    status,
    statusBox: stage.querySelector<HTMLElement>("[data-kb-status-box]"),
    dot: stage.querySelector<HTMLElement>("[data-kb-dot]"),
  };
}

/** The beams exist only from lg, and are redrawn on resize, so they are looked up when used. */
function beamsOf(stage: HTMLElement) {
  return {
    groups: all<SVGGElement>(stage, "[data-kb-beam]"),
    draws: all<SVGPathElement>(stage, "[data-kb-draw]"),
    trails: all<SVGPathElement>(stage, "[data-kb-trail]"),
    runner: stage.querySelector<SVGCircleElement>("[data-kb-runner]"),
  };
}

export function setBeams(gsap: Gsap, stage: HTMLElement, s: BeamState) {
  const b = beamsOf(stage);
  b.groups.forEach((g, i) =>
    gsap.set(g, { opacity: !s.drawn ? 1 : s.miss ? BEAM_MISS : s.win < 0 || s.win === i ? 1 : BEAM_LOSE }),
  );
  gsap.set(b.draws, { strokeDashoffset: s.drawn ? 0 : 1 });
  b.trails.forEach((p, i) => gsap.set(p, { strokeDashoffset: s.drawn && s.win === i ? 0 : 1 }));
  if (b.runner) gsap.set(b.runner, { autoAlpha: 0 });
}

export function beamStateFor(m: Model, qi: number | null): BeamState {
  if (qi == null) return { drawn: false, win: -1, miss: false };
  const best = winner(m, qi);
  return { drawn: true, win: best, miss: best < 0 };
}

/**
 * Puts the room in one frame at once: `qi`'s finished frame (the frame the
 * server drew for it), or, with null, the empty room waiting for a caller.
 */
export function setFrame(gsap: Gsap, room: Room, m: Model, qi: number | null, lg: boolean) {
  const q = qi == null ? null : m.questions[qi];
  const best = qi == null ? -1 : winner(m, qi);
  const hit = best >= 0;
  const status: StatusKey = qi == null ? "listening" : hit ? "found" : "missing";

  for (const k of STATUS_KEYS) {
    const el = room.status[k];
    if (el) gsap.set(el, { autoAlpha: k === status ? 1 : 0, y: 0 });
  }
  if (room.dot) gsap.set(room.dot, { backgroundColor: DOT[status], scale: 1 });
  if (room.statusBox) gsap.set(room.statusBox, { width: room.status[status]?.offsetWidth ?? "auto" });

  const lines = [room.asks, room.answers, room.metas];
  for (const set of lines) set.forEach((el, i) => gsap.set(el, { autoAlpha: i === qi ? 1 : 0, yPercent: 0, y: 0, filter: "blur(0px)" }));
  gsap.set([...room.askWords.flat(), ...room.answerWords.flat()], { autoAlpha: 1, yPercent: 0, filter: "blur(0px)" });

  room.fills.forEach((el, i) =>
    gsap.set(el, { scaleX: q ? q.match[i] : 0, backgroundColor: hit && i === best ? FILL_WIN : FILL_REST }),
  );
  room.tiles.forEach((el, i) =>
    gsap.set(el, {
      y: hit && i === best && lg ? LIFT : 0,
      boxShadow: hit && i === best ? TILE_LIFT : TILE_REST,
      opacity: hit && i !== best ? DIM : 1,
    }),
  );
  gsap.set(room.ticks, { opacity: 1 });

  room.pages.forEach((el, k) => gsap.set(el, { autoAlpha: k === qi ? 1 : 0, clipPath: k === qi ? OPEN : CLOSED }));
  room.marks.forEach((el, k) => gsap.set(el, { scaleX: k === qi ? 1 : 0 }));
  if (room.sheet) gsap.set(room.sheet, { autoAlpha: hit ? 0 : 1 });
  const missed = q != null && !hit;
  if (room.sheetLines) gsap.set(room.sheetLines, { opacity: missed ? SHEET_DIM : 1 });
  if (room.sheetNote) gsap.set(room.sheetNote, { autoAlpha: missed ? 1 : 0, y: 0 });

  setBeams(gsap, room.stage, beamStateFor(m, qi));
}

/** What a timeline under construction knows about the frame it will start from. */
export type Track = { status: StatusKey };

/** The status on screen right now, read off the pill. */
export function statusNow(gsap: Gsap, room: Room): StatusKey {
  return STATUS_KEYS.find((k) => Number(gsap.getProperty(room.status[k], "autoAlpha")) > 0.5) ?? "listening";
}

export type Hooks = {
  vol: { current: number };
  setMuted: (muted: boolean) => void;
  setSelected: (i: number) => void;
  /** Kept current as the timeline plays, for beams that are drawn in mid-way. */
  beams: { current: BeamState };
};

/** Out, then in, in the same place: two labels crossing at once read as neither. */
function status(tl: Timeline, room: Room, track: Track, key: StatusKey, at: number) {
  if (track.status === key) return;
  const others = STATUS_KEYS.filter((k) => k !== key)
    .map((k) => room.status[k])
    .filter((el): el is HTMLElement => el != null);
  tl.to(others, { autoAlpha: 0, y: -4, duration: 0.2, ease: "power2.in" }, at);
  const el = room.status[key];
  if (el) tl.fromTo(el, { autoAlpha: 0, y: 4 }, { autoAlpha: 1, y: 0, duration: 0.3, ease: "power2.out", immediateRender: false }, at + 0.14);
  if (room.dot) tl.to(room.dot, { backgroundColor: DOT[key], duration: 0.3, ease: "power2.out" }, at + 0.1);
  // The pill grows or shrinks to its new words; measured now, with the fonts in.
  if (room.statusBox && el) tl.to(room.statusBox, { width: el.offsetWidth, duration: 0.35, ease: "power2.inOut" }, at + 0.06);
  track.status = key;
}

/**
 * Takes the room from whatever it shows back to empty. Every step is a
 * `to` from the current value, so it starts cleanly from a finished frame,
 * a half-played one, or a room that is already empty.
 */
export function addClear(tl: Timeline, room: Room, track: Track, hooks: Hooks) {
  const at = tl.duration();
  const b = beamsOf(room.stage);
  const lines = [...room.asks, ...room.answers, ...room.metas];
  const pages = [...room.pages.values()];

  tl.to(lines, { autoAlpha: 0, yPercent: -10, filter: "blur(3px)", duration: 0.45, ease: "power2.inOut" }, at)
    .set(lines, { yPercent: 0, y: 0, filter: "blur(0px)" }, at + 0.46)
    .to(room.fills, { scaleX: 0, backgroundColor: FILL_REST, duration: 0.4, ease: "power2.inOut" }, at)
    .to(room.tiles, { y: 0, boxShadow: TILE_REST, opacity: 1, duration: 0.4, ease: "power2.inOut" }, at)
    .to(room.ticks, { opacity: 1, duration: 0.2 }, at)
    .to(b.groups, { opacity: 0, duration: 0.3, ease: "power2.in" }, at)
    .set([...b.draws, ...b.trails], { strokeDashoffset: 1 }, at + 0.32)
    .set(b.groups, { opacity: 1 }, at + 0.32)
    .call(() => void (hooks.beams.current = { drawn: false, win: -1, miss: false }), [], at + 0.32)
    .to(pages, { autoAlpha: 0, duration: 0.3, ease: "power2.in" }, at)
    .set(pages, { clipPath: CLOSED }, at + 0.32)
    .set([...room.marks.values()], { scaleX: 0 }, at + 0.32)
    .call(hooks.setMuted, [false], at)
    .to(hooks.vol, { current: VOL.rest, duration: 0.45, ease: "sine.inOut" }, at);
  if (b.runner) tl.to(b.runner, { autoAlpha: 0, duration: 0.15 }, at);
  if (room.sheet) tl.to(room.sheet, { autoAlpha: 1, duration: 0.3, ease: "power2.out" }, at + 0.15);
  if (room.sheetLines) tl.to(room.sheetLines, { opacity: 1, duration: 0.3, ease: "power2.out" }, at);
  if (room.sheetNote) tl.to(room.sheetNote, { autoAlpha: 0, duration: 0.2, ease: "power2.in" }, at);
  if (room.dot) tl.to(room.dot, { scale: 1, duration: 0.2 }, at);
  status(tl, room, track, "listening", at);
  tl.to({}, { duration: 0.1 }, at + 0.45);
}

/** One question, from the caller's first word to the answer landing. */
export function addQuestion(
  tl: Timeline,
  room: Room,
  m: Model,
  qi: number,
  track: Track,
  hooks: Hooks,
  { lg, announce }: { lg: boolean; announce: boolean },
) {
  const q = m.questions[qi];
  const best = winner(m, qi);
  const hit = best >= 0;
  const b = beamsOf(room.stage);
  let t = tl.duration();

  if (announce) tl.call(hooks.setSelected, [qi], t);

  // 1 · Listening.
  status(tl, room, track, "listening", t);
  tl.to(hooks.vol, { current: VOL.listen, duration: 0.45, ease: "sine.inOut" }, t);
  t += 0.45;

  // 2 · The question, a word at a time out of a light blur.
  const asked = room.askWords[qi];
  tl.set(room.asks[qi], { autoAlpha: 1, yPercent: 0, filter: "blur(0px)" }, t)
    .set(asked, WORD_FROM, t)
    .to(asked, { ...WORD_TO, stagger: WORD_ASK }, t);
  t += Math.max(1.3, asked.length * WORD_ASK + 0.7);

  // 3 · Reading: every document is weighed against the question.
  status(tl, room, track, "reading", t);
  if (room.dot) tl.to(room.dot, { scale: 1.6, duration: 0.45, ease: "sine.inOut", yoyo: true, repeat: 3 }, t);
  tl.to(room.fills, { scaleX: (i: number) => q.match[i] ?? 0, duration: 0.6, ease: "power2.out", stagger: 0.08 }, t)
    .to(b.draws, { strokeDashoffset: 0, duration: 0.7, ease: "power2.inOut", stagger: 0.05 }, t)
    .call(() => void (hooks.beams.current = { drawn: true, win: -1, miss: false }), [], t);
  t += 1.8;

  if (hit) {
    // 4 · Found: its tile lifts, the rest step back, a dot carries the page down to the reader.
    status(tl, room, track, "found", t);
    tl.to(room.tiles[best], { y: lg ? LIFT : 0, boxShadow: TILE_LIFT, duration: 0.35, ease: "power2.out" }, t)
      .to(room.fills[best], { backgroundColor: FILL_WIN, duration: 0.35, ease: "power2.out" }, t)
      .to(room.tiles.filter((_, i) => i !== best), { opacity: DIM, duration: 0.3, ease: "power2.out" }, t)
      .to(b.groups.filter((_, i) => i !== best), { opacity: BEAM_LOSE, duration: 0.3, ease: "power2.out" }, t)
      .call(() => void (hooks.beams.current = { drawn: true, win: best, miss: false }), [], t);

    let open = t + 0.35;
    const path = b.trails[best];
    if (b.runner && path?.getAttribute("d")) {
      tl.set(b.runner, { autoAlpha: 1, scale: 1, transformOrigin: "50% 50%" }, t + 0.15)
        .to(
          b.runner,
          {
            motionPath: { path, align: path, alignOrigin: [0.5, 0.5] },
            duration: 0.6,
            ease: "power2.inOut",
            immediateRender: false,
          },
          t + 0.15,
        )
        .to(path, { strokeDashoffset: 0, duration: 0.6, ease: "power2.inOut" }, t + 0.15)
        .to(b.runner, { autoAlpha: 0, scale: 0.4, duration: 0.2, ease: "power2.in" }, t + 0.72);
      open = t + 0.7;
    }

    const page = room.pages.get(qi);
    const mark = room.marks.get(qi);
    if (room.sheet) tl.to(room.sheet, { autoAlpha: 0, duration: 0.25, ease: "power2.out" }, open);
    if (page) tl.set(page, { autoAlpha: 1, clipPath: CLOSED }, open).to(page, { clipPath: OPEN, duration: 0.4, ease: "power3.out" }, open);
    if (mark) tl.to(mark, { scaleX: 1, duration: 0.35, ease: "power2.out" }, open + 0.4);
    t = Math.max(t + 1.3, open + 0.95);

    // 5 · Answering, in its own words, from that line.
    status(tl, room, track, "answering", t);
  } else {
    // 6 · The honest miss: nothing reaches the tick, and the reader goes quiet and grey.
    status(tl, room, track, "missing", t);
    tl.to(room.ticks, { keyframes: { opacity: [1, 0.3, 1] }, duration: 0.4, ease: "none" }, t)
      .to(b.groups, { opacity: BEAM_MISS, duration: 0.3, ease: "power2.out" }, t)
      .call(() => void (hooks.beams.current = { drawn: true, win: -1, miss: true }), [], t)
      .call(hooks.setMuted, [true], t)
      .to(hooks.vol, { current: VOL.miss, duration: 0.5, ease: "sine.inOut" }, t);
    if (room.sheetLines) tl.to(room.sheetLines, { opacity: SHEET_DIM, duration: 0.35, ease: "power2.out" }, t);
    if (room.sheetNote) tl.fromTo(room.sheetNote, { autoAlpha: 0, y: 4 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: "power2.out", immediateRender: false }, t + 0.15);
    t += 1.3;
  }

  const said = room.answerWords[qi];
  const speak = said.length * WORD_SAY;
  tl.set(room.answers[qi], { autoAlpha: 1, yPercent: 0, filter: "blur(0px)" }, t)
    .set(said, WORD_FROM, t)
    .to(said, { ...WORD_TO, stagger: WORD_SAY }, t);
  if (hit) {
    tl.to(hooks.vol, { current: VOL.speak, duration: 0.35, ease: "sine.inOut" }, t).to(
      hooks.vol,
      { current: VOL.rest, duration: 0.6, ease: "sine.inOut" },
      t + speak,
    );
  }
  const landed = t + speak + 0.5;
  tl.fromTo(
    room.metas[qi],
    { autoAlpha: 0, y: 4 },
    { autoAlpha: 1, y: 0, duration: 0.4, ease: "power2.out", immediateRender: false },
    landed,
  );
  if (hit) status(tl, room, track, "found", landed);
  tl.to({}, { duration: 0.5 }, landed);
}
