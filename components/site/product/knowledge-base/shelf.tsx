"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { Pause, Play, Volume2 } from "lucide-react";
import { cueIn, type Cue, type CueFile } from "@/lib/audio";
import { KB_SOUND, SHELF, type KbDocKind } from "@/lib/pages/knowledge-base";
import { pastEnd, sayingOf, SHELF_TRACK, shelfDwell } from "@/lib/pages/knowledge-base-voice";
import { cn } from "@/lib/utils";
import { SoundButton } from "@/components/site/audio/sound-button";
import { useVoiceTrack } from "@/components/site/audio/use-voice-track";
import { Frame, SectionHeading } from "../primitives";
import { useInView, usePrefersReducedMotion } from "../timing";
import { SCROLLED_MS, followHalted, followMovedAt, showSaid } from "@/components/site/audio/show-said";
import { loadLate, useListen } from "./meaning";
import { DocBadge } from "./parts";

/* ------------------------------------------------------------------ *
 * What to add, as a shelf of six kinds of document.
 *
 * Each card holds a sheet sketched in a few ruled lines. The card that is
 * "asked" — under the pointer, or next in the shelf's own slow round — has
 * a caller's question rise over its sheet and one of its lines marked, the
 * way the reading room marks the line it answered from.
 *
 * Sound. Each card's question can be heard, from a different caller
 * (AI-generated voices, lib/audio/cues/kb-shelf-asks.json, fetched only
 * once sound is on). With sound on, the first time round the shelf on
 * each entry into view is spoken: each question is said as it rises, and
 * the round waits until it has been. Later rounds are silent, and a card
 * under the pointer never speaks; each card then carries its own control
 * to hear its question. With reduced motion nothing is asked by itself,
 * and Listen says the six questions, each card showing its own as it is
 * said.
 * ------------------------------------------------------------------ */

/** The stage's claim on the site's one sound (components/site/audio/engine.ts). */
const VOICE_ID = "kb-shelf";
/** A read round, ms. */
const ROUND_MS = 2600;

const loadShelf = () => loadLate("kb-shelf-asks");

/** Each card's clip, where it says the card's question as shown. */
function clipsFor(file: CueFile | null | undefined): (Cue | null)[] | null {
  if (!file) return null;
  return SHELF.kinds.map((k, i) => {
    const cue = cueIn(file, SHELF_TRACK(i));
    return sayingOf(cue, k.ask, "caller") && cue ? cue : null;
  });
}

/** A sheet's file type, its ruled lines, and which line answers the card's question. */
const SHEETS: Record<string, { kind: KbDocKind; widths: number[]; hit: number }> = {
  prices: { kind: "PDF", widths: [72, 90, 64, 82, 58], hit: 1 },
  policies: { kind: "DOCX", widths: [86, 60, 78, 92, 66], hit: 2 },
  services: { kind: "MD", widths: [64, 88, 80, 56, 74], hit: 3 },
  visits: { kind: "TXT", widths: [90, 70, 58, 84, 62], hit: 0 },
  access: { kind: "PDF", widths: [60, 84, 92, 68, 76], hit: 1 },
  web: { kind: "URL", widths: [78, 62, 88, 70, 84], hit: 4 },
};

export function KbShelf() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, "-15% 0px");
  const reduce = usePrefersReducedMotion();
  const [round, setRound] = useState(0);
  const [held, setHeld] = useState<number | null>(null);

  /* ─── Sound ──────────────────────────────────────────────────────── */
  /** When the clip being said reached its end (performance.now()); null while it plays. */
  const endedAt = useRef<number | null>(null);
  /** The pass was started by a press here. Cleared when another stage's press takes the sound. */
  const pressed = useRef(false);
  const track = useVoiceTrack(VOICE_ID, {
    active: inView,
    onEnded: () => {
      endedAt.current = performance.now();
    },
    onPreempt: () => {
      pressed.current = false;
    },
  });
  const trackRef = useRef(track);
  useEffect(() => {
    trackRef.current = track;
  });
  /**
   * The questions' clips: undefined until fetched (sound on), and after a fetch that failed, until
   * the next Listen (or sound turned on again) asks again.
   */
  const [file, setFile] = useState<CueFile | null | undefined>(undefined);
  /** Bumped by a Listen pressed before the clips are here: a fetch that failed is asked for again. */
  const [refetch, setRefetch] = useState(0);
  useEffect(() => {
    if (!track.on || file !== undefined) return;
    let live = true;
    void loadShelf().then((f) => {
      if (live && f) setFile(f);
    });
    return () => {
      live = false;
    };
  }, [track.on, file, refetch]);
  const clips = useMemo(() => clipsFor(file), [file]);
  /** A spoken time round the shelf: how many cards it has left to ask. */
  const [pass, setPass] = useState<number | null>(null);
  /** A card whose question was asked for with its own control: it stays asked while it is said. */
  const [picked, setPicked] = useState<number | null>(null);
  /** The card whose clip the track holds, so a round that is held and let go carries on rather than starting again. */
  const playing = useRef(-1);
  /** Bumped by the sound control: the round's card is said again even when the pass count has not changed. */
  const [restart, setRestart] = useState(0);

  // Into view with sound on: one spoken time round the shelf (never under reduced motion or the still tier). Out of view, it ends.
  const onEntry = useEffectEvent((into: boolean) => {
    // A round this shelf's own press started, carried through the edge of the view by its own
    // follow scroll (the page above can grow under it): it is not over, and carries on.
    const following =
      pressed.current && pass !== null && !followHalted() && performance.now() - followMovedAt() < SCROLLED_MS;
    if (!into) {
      if (following) return;
      setPass(null);
      setPicked(null);
      return;
    }
    if (pressed.current && pass !== null) return;
    if (clips && track.on && !track.listen && !reduce) {
      pressed.current = false;
      setPass(SHELF.kinds.length);
    }
  });
  useEffect(() => {
    onEntry(inView);
  }, [inView]);

  // The read round. A spoken round takes over once its clips are here (until then, and without them, the shelf reads on).
  const voicing = pass !== null && !!clips;
  useEffect(() => {
    if (!inView || reduce || held !== null || voicing || picked !== null) return;
    const id = window.setInterval(() => setRound((r) => (r + 1) % SHELF.kinds.length), ROUND_MS);
    return () => window.clearInterval(id);
  }, [inView, reduce, held, voicing, picked]);

  /** The time round can't carry on spoken (another stage's press took the sound where nothing may start by itself): the shelf reads on. */
  const endPass = useEffectEvent(() => setPass(null));
  // A spoken round: the card's question is said as it rises, and the round waits until it has been.
  useEffect(() => {
    if (pass === null || !inView || held !== null || picked !== null || !clips) return;
    if (!pressed.current && trackRef.current.listen) {
      endPass();
      return;
    }
    const advance = () => {
      setRound((r) => (r + 1) % SHELF.kinds.length);
      setPass((p) => (p !== null && p > 1 ? p - 1 : null));
    };
    const cue = clips[round];
    if (!cue) {
      // A card without its clip keeps the read round.
      const id = window.setTimeout(advance, ROUND_MS);
      return () => window.clearTimeout(id);
    }
    const t = trackRef.current;
    if (playing.current === round && endedAt.current === null) {
      // Let go (pointer, view) mid-question: it carries on, claiming the sound only if nobody else is playing.
      t.play(cue);
    } else {
      playing.current = round;
      endedAt.current = null;
      t.play(cue, 0, { press: pressed.current, next: clips[(round + 1) % clips.length]?.src });
    }
    const until = shelfDwell(ROUND_MS / 1000, cue.turns[0]);
    let raf = 0;
    const frame = () => {
      if (pastEnd(trackRef.current.time(), cue, endedAt.current, performance.now()) >= until) {
        playing.current = -1;
        advance();
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      // Held under the pointer, or out of view: it waits where it is (unless the track has moved on to another clip).
      if (playing.current === round) trackRef.current.pause();
    };
  }, [pass, inView, held, picked, clips, round, restart]);

  // A card asked for with its own control is let go a moment after its question has been said.
  const pickedDone = picked !== null && track.ended;
  useEffect(() => {
    if (!pickedDone) return;
    const id = window.setTimeout(() => setPicked(null), 600);
    return () => window.clearTimeout(id);
  }, [pickedDone]);

  /** A card's own control (sound on): it is asked, and its question said. */
  const hear = (i: number) => {
    const cue = clips?.[i];
    if (!cue) return;
    setPass(null);
    setPicked(i);
    playing.current = -1;
    endedAt.current = null;
    trackRef.current.play(cue, 0, { press: true });
  };

  // Reduced motion: Listen says the six questions, each card showing its own as it is said.
  const listenCues = useMemo(() => (clips ? clips.filter((c): c is Cue => !!c) : file === undefined ? undefined : []), [clips, file]);
  const listen = useListen(track, listenCues, inView);
  const listening = listen.at >= 0 && clips ? clips.indexOf(listenCues?.[listen.at] ?? null) : -1;

  // Sound turned on here: a spoken time round the shelf, from the card that is up (Listen, with reduced motion).
  const onSound = (on: boolean) => {
    if (!on) return;
    if (reduce) {
      listen.soundOn();
      return;
    }
    setPicked(null);
    pressed.current = true;
    playing.current = -1;
    setPass(SHELF.kinds.length);
    // A round already on its first card (the same pass count) says that card again too.
    setRestart((n) => n + 1);
  };

  const asked = held ?? picked ?? (reduce ? listening : round);

  /** Each card's question bubble: the caption of what is said. */
  const bubbles = useRef<(HTMLParagraphElement | null)[]>([]);
  // Below lg the cards stand one under another, the sound control under the last: a round this
  // shelf's own press started (or Listen) brings the card being asked on screen, so its question
  // can be read as it is said. A round that started by itself never moves the page. A press that
  // says the card on screen again (`restart`) brings it on screen too.
  const follow = reduce ? listening : voicing ? round : -1;
  useEffect(() => {
    if (follow < 0 || (!reduce && !pressed.current)) return;
    showSaid(bubbles.current[follow], reduce, "(max-width: 1023px)");
  }, [follow, reduce, restart]);
  /** The pointer came over card `i` (at `at`, the event's time): it holds the shelf there, unless the page just moved the card under it. */
  const hold = (i: number, at: number) => {
    if (at - followMovedAt() < SCROLLED_MS) return;
    setHeld(i);
  };

  return (
    <>
      <Frame className="px-6 pb-10 md:px-12 md:pb-14">
        <SectionHeading eyebrow={SHELF.eyebrow} className="max-w-[820px]">
          {SHELF.title}
        </SectionHeading>
      </Frame>

      <Frame className="px-4 md:px-6">
        <div ref={ref} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SHELF.kinds.map((k, i) => {
            const on = asked === i;
            const sheet = SHEETS[k.id];
            return (
              <div
                key={k.id}
                onPointerEnter={(e) => hold(i, e.timeStamp)}
                onPointerLeave={() => setHeld(null)}
                className="relative flex flex-col overflow-hidden rounded-[24px] bg-pp-card p-6 md:p-7"
              >
                {track.on && clips?.[i] && (
                  // With sound on: this card's question, said on request (never on hover).
                  <button
                    type="button"
                    onClick={() => hear(i)}
                    aria-label={KB_SOUND.hear(k.ask)}
                    className="absolute top-3 right-3 z-10 grid size-9 place-items-center rounded-full bg-white text-pp-ink shadow-[0_0_0_1px_rgb(24_16_40/0.1)] transition-colors before:absolute before:-inset-1 before:rounded-full hover:bg-pp-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink"
                  >
                    <Volume2 className="size-4" />
                  </button>
                )}
                <div className="relative h-[168px]">
                  {/* The sheet */}
                  <div
                    className={cn(
                      "absolute inset-x-6 top-2 bottom-0 rounded-t-xl bg-white p-4 shadow-[0_0_0_1px_rgb(24_16_40/0.06),0_16px_32px_-22px_rgb(24_16_40/0.35)] transition-transform duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
                      on ? "-translate-y-1" : "translate-y-2",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <DocBadge kind={sheet.kind} small />
                      <span className="block h-1.5 w-16 rounded-full bg-pp-ink/15" />
                    </div>
                    <div className="mt-3.5 flex flex-col gap-2">
                      {sheet.widths.map((w, j) => (
                        <span key={j} className="relative block h-1.5 rounded-full bg-pp-ink/[0.07]" style={{ width: `${w}%` }}>
                          {j === sheet.hit && (
                            <span
                              aria-hidden
                              className="absolute -inset-x-1 -inset-y-1 origin-left rounded bg-[#551a89]/15"
                              style={{
                                transform: `scaleX(${on ? 1 : 0})`,
                                transition: reduce ? "none" : "transform 600ms cubic-bezier(0.2, 0.8, 0.2, 1) 250ms",
                              }}
                            />
                          )}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* The question it answers */}
                  <p
                    ref={(el) => {
                      bubbles.current[i] = el;
                    }}
                    aria-hidden
                    className={cn(
                      "absolute right-2 bottom-5 max-w-[80%] rounded-[14px] bg-pp-ink px-3 py-2 text-[13px] leading-[18px] text-white shadow-[0_12px_24px_-12px_rgb(0_0_0/0.45)] transition-[opacity,translate] duration-500",
                      on ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
                    )}
                  >
                    “{k.ask}”
                  </p>
                </div>

                <h3 className="mt-6 text-base leading-6">{k.title}</h3>
                <p className="mt-1 text-[15px] leading-[22px] text-pp-muted">{k.body}</p>
                {/* Read aloud as part of the card, whether or not it is showing. */}
                <p className="sr-only">Answers questions like “{k.ask}”</p>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 px-2">
          {reduce && listenCues?.length !== 0 && (
            // Reduced motion: nothing is asked by itself; Listen says the six questions.
            <button
              type="button"
              onClick={() => {
                if (file === undefined) setRefetch((n) => n + 1);
                listen.toggle();
              }}
              className="pp-shadow-btn relative inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-white px-3.5 text-sm text-pp-ink transition-colors before:absolute before:inset-x-0 before:-inset-y-1 hover:bg-pp-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink"
            >
              {listen.playing ? <Pause className="size-3.5 fill-current" /> : <Play className="size-3.5 fill-current" />}
              {listen.playing ? KB_SOUND.pause : KB_SOUND.listen}
            </button>
          )}
          <SoundButton variant="pill" tone="light" onChange={onSound} />
        </div>

        <div className="mt-4 flex flex-col gap-4 rounded-[24px] border border-pp-hair px-6 py-5 md:flex-row md:items-center md:justify-between md:px-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[12px] leading-4 font-medium tracking-[0.14em] text-pp-muted uppercase">
              {SHELF.formats.title}
            </span>
            {SHELF.formats.items.map((f) => (
              <span key={f} className="rounded-full bg-pp-card px-2.5 py-1 text-[12px] leading-4">
                {f}
              </span>
            ))}
            <span className="text-[13px] leading-[18px] text-pp-muted">· {SHELF.formats.limit}</span>
          </div>
          <p className="text-[13px] leading-[18px] text-pp-muted md:max-w-[380px] md:text-right">{SHELF.formats.tip}</p>
        </div>
      </Frame>
    </>
  );
}
