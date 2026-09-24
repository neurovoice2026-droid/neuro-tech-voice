"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHIP, RING_LIGHT, useRovingRadio } from "@/components/site/home/controls";
import { TYPE, WEIGHT } from "@/components/site/home/type";
import { useDeviceTier } from "@/components/site/product/device-tier";
import { usePrefersReducedMotion } from "@/components/site/product/timing";
import { fill } from "@/components/site/solutions/custom-ai-agents/parts";
import type { NeedId, OursKind, ScopeData, ScopePart, ScopePartId } from "@/lib/pages/custom-saas-platforms";
import { CheckLine } from "./check-line";
import { LiveMesh } from "./live-mesh";
import { MapLink } from "./map-link";

/* ------------------------------------------------------------------ *
 * #scope's instrument: the reader's needs on the left, the parts they
 * take on the right, in a pearl room, and one part at a time explained.
 *
 * THE NEEDS are eight toggles in four labelled groups (who uses it, how
 * it charges, what it touches, what it has to hold). Each is a real
 * `aria-pressed` button in the landing's chip colours: the chip grey
 * with a plus while off, electric with a tick while on (white on
 * electric, 5.70:1). The plus and the tick share one slot, so a chip is
 * the same width either way and pressing one never reflows the row. A
 * chip is 44px tall on a phone; from lg, where the column stands beside
 * the room and has to fit a laptop's window under the header, it is a
 * 36px pill with a 44px hit area. Then the tally: how many parts the
 * build now has and how many of those are there because of what the
 * reader picked, and a legend for the three marks a part can carry —
 * under the needs on a phone, and from lg under the room, over its foot
 * line, so the column is only the needs.
 *
 * THE ROOM is a lit surface (saas.css §2) in the scope light: the hero
 * room's pearl, mirrored, flowing while on screen (`LiveMesh` at 0.96,
 * its pools' headings swapped by `data-swap`, so it never moves like the
 * hero room either). In it, the four layers of the menu's stack, each
 * with its parts as tiles, and under them the inspector.
 *
 * A TILE is built or not. Built, it is white, its label in ink and its
 * tag in violet ("Always" for the bones, "Added" for a part a need
 * asked for; violet on white is 7.10:1). Not built, it is only its
 * outline — a dashed hairline on the pearl — with its label and its tag
 * ("Not needed") in the light's dim token (7.31:1 at its worst while the
 * light flows). Its mark says what our platform proves about it: a
 * filled node where it does the part, a half-filled one where it is thin,
 * a hollow ring where it doesn't (in the tick colour on the pearl, 3.58,
 * electric on white, both marks). The selected tile carries a 2px ink
 * ring.
 *
 * THE MOTION is CSS alone, no GSAP, so it costs the same on every device
 * (saas-credentials.css §7). Pressing a need works out which tiles change
 * — built to not built or back — in reading order, and hands each its
 * place in that order as `--k`: the tiles fill or empty one after another,
 * 45ms apart, each easing its fill, colours and outline over 0.3s. A tile
 * that has just been built also gets a ping: an electric ring that swells
 * a little and fades, once, starting as its fill does (a span remounted
 * on a fresh key, so pressing again pings again). The stagger is cleared
 * once it has played, so a later hover or pick is never held back by it.
 * Turning a need on also shows its first new part in the inspector (the
 * part the reader just caused), without moving focus; the inspector's
 * copy lands with the house `ind-swap` rise, and so does the summary
 * (both from the first change on, never on the first paint).
 * With reduced motion the tiles' transitions are pinned to none (the
 * global rule zeroes durations but not the stagger's delays) and the
 * ping is never rendered; the still tier does the same. Lite keeps it:
 * colour changes and one small ring are what lite can afford.
 *
 * THE FINISHED FRAME is the server's: Subscriptions on — ten parts, two
 * of them there because of it — and the inspector on "Each customer’s
 * data, walled off", the part that most often goes wrong silently.
 *
 * NOTHING ABOVE THE READER MOVES WHEN IT CHANGES. The inspector is as
 * tall as the part in it, not the tallest part: its parts run from two
 * short lines to a whole paragraph, and a card reserving the tallest
 * stood a third empty on the part it opens on. So picking a part can
 * move what is under the room — from lg the tally, and the foot line and
 * the sections after it — and only that, and only on the reader's press
 * (a shift right after input is not layout shift). Nothing above it
 * moves: on a phone the needs sit above the room, and from lg they stand
 * beside it, held under the header. One place is the exception: once
 * the reader has scrolled to where the column rides the row's end, a
 * need that changes the inspector would move the column, so the page
 * moves instead and the pressed chip stays put (the layout effect
 * below). A tile's outline is a border in both states — transparent
 * once built, where the white fill runs under it — so filling one never
 * changes its size.
 *
 * KEYBOARD AND SCREEN READERS. The needs are toggles in groups named by
 * their labels. The seventeen tiles are one radio group (`useRovingRadio`:
 * one tab stop, the arrow keys move and select, Home and End jump), under
 * a visually hidden heading that names it; each tile is named by its
 * label, its tag and its mark in words — "Teams and roles, Not needed,
 * Not on ours" — so colour and outline are never the only signal. Every
 * press of a need is announced once in a polite live region ("Added:
 * Subscriptions. 10 parts in this build."). The visible summary is not a
 * live region too: two regions changing on one press would say the
 * count twice.
 *
 * COLOUR. The needs column is on white and uses the landing's tokens.
 * On the pearl, only the light's measured tokens. Built tiles and the
 * inspector are white, where the landing's own muted, violet and ink are
 * safe again, so they are named directly (`--home-*`): inside a lit
 * surface the `--pp-*` tokens point at the light's.
 *
 * Every word arrives in `data` (the server-only data module's SAAS_SCOPE
 * slice, types only here), and every count is filled into its template,
 * but for one: each layer's "3 of 6", set here as the build spec draws
 * it (ScopeData has no field for it yet).
 * ------------------------------------------------------------------ */

/** How long the stagger and the ping take to play out, past the last tile's delay. */
const SETTLE_MS = 700;
/** The stagger's step: saas-credentials.css §7 multiplies `--k` by the same 45ms. */
const STEP_MS = 45;

const useIsoLayoutEffect = typeof document !== "undefined" ? useLayoutEffect : useEffect;

/** The map link's arrow: it nudges along under the pointer. */
const ARROW = "ml-1 inline-block transition-transform duration-200 group-hover:translate-x-0.5";

/**
 * A link's words with the arrow held to the last of them, so a label that
 * wraps on a phone never leaves the arrow on a line of its own.
 */
function Arrowed({ label }: { label: string }) {
  const at = label.lastIndexOf(" ") + 1;
  return (
    <>
      {label.slice(0, at)}
      <span className="whitespace-nowrap">
        {label.slice(at)}
        <span aria-hidden className={ARROW}>
          →
        </span>
      </span>
    </>
  );
}

/** The parts a set of needs builds: the bones, and every part any of the needs asks for. */
function builtBy(parts: readonly ScopePart[], needs: ReadonlySet<NeedId>): ReadonlySet<ScopePartId> {
  return new Set(parts.filter((p) => p.needs.length === 0 || p.needs.some((n) => needs.has(n))).map((p) => p.id));
}

/**
 * What our platform proves about a part, as a mark in `currentColor`:
 * a filled node (done on ours), a half-filled one (thin on ours), a
 * hollow ring (not on ours). 8px across, the house node.
 */
function KindGlyph({ kind, className }: { kind: OursKind; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 10 10" className={cn("size-2.5 shrink-0 overflow-visible", className)}>
      {kind === "does" ? (
        <circle cx="5" cy="5" r="4" fill="currentColor" />
      ) : (
        <>
          <circle cx="5" cy="5" r="3.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
          {/* The left half, filled: done in part. */}
          {kind === "thin" && <path d="M5 1.75a3.25 3.25 0 0 0 0 6.5Z" fill="currentColor" />}
        </>
      )}
    </svg>
  );
}

export function ScopeInstrument({ data, blobs }: { data: ScopeData; blobs: readonly CSSProperties[] }) {
  const reduce = usePrefersReducedMotion();
  const tier = useDeviceTier();
  // No ping at all where nothing should move; lite keeps it.
  const calm = reduce || tier === "still";
  const uid = useId();
  const partsId = `${uid}-parts`;

  const [needs, setNeeds] = useState<ReadonlySet<NeedId>>(() => new Set(data.initial));
  const [part, setPart] = useState<ScopePartId>(data.initialPart);
  // Set by the first pick, so the inspector's rise never plays on the first paint.
  const [moved, setMoved] = useState(false);
  // The tiles the last press flipped, in reading order, and a fresh key
  // for each press, so the pings remount even when the same tiles flip.
  const [changed, setChanged] = useState<{ ids: readonly ScopePartId[]; nonce: number }>({ ids: [], nonce: 0 });
  // What the live region last said: empty until the reader presses a need.
  const [said, setSaid] = useState("");
  const settle = useRef(0);
  // The row and the needs column, and the need just pressed: where it
  // stood, where the row ended, and whether the column was riding that
  // end (see the layout effect below).
  const rowRef = useRef<HTMLDivElement>(null);
  const needsRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<{ el: HTMLElement; top: number; foot: number; riding: boolean } | null>(null);

  useEffect(() => {
    const timers = settle;
    return () => window.clearTimeout(timers.current);
  }, []);

  const byId = useMemo(() => new Map(data.parts.map((p) => [p.id, p])), [data.parts]);
  /** The tiles in reading order: layer by layer, as they are drawn. */
  const order = useMemo(() => data.layers.flatMap((l) => l.parts), [data.layers]);
  const built = useMemo(() => builtBy(data.parts, needs), [data.parts, needs]);
  const picked = data.parts.filter((p) => p.needs.length > 0 && built.has(p.id)).length;
  const summary = fill(needs.size > 0 ? data.summary.some : data.summary.none, { n: built.size, k: picked });
  const shown = byId.get(part) ?? data.parts[0];

  /** Puts a part in the inspector. */
  function show(id: ScopePartId) {
    setPart(id);
    setMoved(true);
  }

  const radio = useRovingRadio({
    count: order.length,
    index: order.indexOf(part),
    orientation: "horizontal",
    onChange: (i) => show(order[i]),
  });

  function toggle(id: NeedId, chip: HTMLElement) {
    const foot = rowRef.current?.getBoundingClientRect().bottom ?? 0;
    const riding = Math.abs((needsRef.current?.getBoundingClientRect().bottom ?? 0) - foot) < 1;
    anchorRef.current = { el: chip, top: chip.getBoundingClientRect().top, foot, riding };
    const on = !needs.has(id);
    const next = new Set(needs);
    if (on) next.add(id);
    else next.delete(id);
    const after = builtBy(data.parts, next);
    const flipped = order.filter((p) => built.has(p) !== after.has(p));

    setNeeds(next);
    setChanged((c) => ({ ids: flipped, nonce: c.nonce + 1 }));
    // The part the reader just caused, shown without taking their focus.
    if (on && flipped.length > 0) show(flipped[0]);
    const label = data.needs.find((n) => n.id === id)?.label ?? "";
    setSaid(fill(on ? data.live.added : data.live.removed, { label, n: after.size }));

    // Once the stagger and the pings have played, clear them, so a hover
    // or a pick on a tile that was part of it is never delayed.
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(
      () => setChanged((c) => ({ ids: [], nonce: c.nonce })),
      flipped.length * STEP_MS + SETTLE_MS,
    );
  }

  // THE PRESSED NEED STAYS PUT. From lg the needs column is held under the
  // header until the row's end comes up to its own, and from there it
  // rides that end; the end moves whenever the inspector changes height.
  // So a press there moves the column, and the chip under the reader's
  // pointer or focus with it, unless the page moves by as much, as it
  // does here (the explorer's lens chips are held the same way). Riding
  // before the press, the column goes wherever the row's end goes: the
  // page holds the end where it was. Held under the header before, it
  // moved only because a shorter inspector brought the end up past it:
  // the page moves by as much, and it is held again. On a phone, a short
  // window, or anywhere the column was not moved, this does nothing. Run
  // after every commit, not only a press's: every press commits (the
  // nonce), so it spends the anchor.
  useIsoLayoutEffect(() => {
    const a = anchorRef.current;
    anchorRef.current = null;
    if (!a || !a.el.isConnected) return;
    const shift = a.el.getBoundingClientRect().top - a.top;
    if (Math.abs(shift) < 1) return;
    const by = a.riding ? (rowRef.current?.getBoundingClientRect().bottom ?? a.foot) - a.foot : shift;
    window.scrollBy({ top: by, behavior: "instant" });
  });

  return (
    <div
      ref={rowRef}
      className={cn(
        "mt-10 grid lg:mt-12 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-x-12",
        "xl:grid-cols-[320px_minmax(0,1fr)]",
      )}
    >
      {/* ── The needs ── on white. From lg the column stands down the
          whole instrument and holds still under the header while the room
          beside it is read, so every need is a press away from the parts
          it changes. Its 36px chips keep it to some 510px, so it sticks in
          any window 39.5rem tall (its 7rem top, the column, and a little
          air): a 1366×768 laptop's, browser, taskbar and all. In a shorter
          one it scrolls, so its foot is never cut off. */}
      <div
        ref={needsRef}
        className="min-w-0 lg:col-start-1 lg:row-span-3 lg:row-start-1 lg:self-start lg:[@media(min-height:39.5rem)]:sticky lg:[@media(min-height:39.5rem)]:top-28">
        <h3 className={cn(TYPE.label, "text-pp-muted")}>{data.needsTitle}</h3>
        <div className="mt-4 grid gap-6 md:grid-cols-2 lg:grid-cols-1 lg:gap-5">
          {data.groups.map((g) => {
            const labelId = `${uid}-${g.id}`;
            return (
              <div key={g.id} role="group" aria-labelledby={labelId} className="min-w-0">
                <p id={labelId} className={cn(TYPE.label, "text-pp-muted")}>
                  {g.label}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {data.needs
                    .filter((n) => n.group === g.id)
                    .map((n) => {
                      const on = needs.has(n.id);
                      const Icon = on ? Check : Plus;
                      return (
                        <button
                          key={n.id}
                          type="button"
                          aria-pressed={on}
                          onClick={(e) => toggle(n.id, e.currentTarget)}
                          className={cn(
                            // One line is a 44px pill; a label too long for
                            // the column wraps inside it rather than
                            // spilling out of it.
                            "relative inline-flex min-h-11 max-w-full cursor-pointer items-center gap-1.5 rounded-[22px] px-4 py-2.5",
                            // From lg a 36px pill, as the landing's
                            // segmented switch draws its options, whose
                            // hit area still runs 44px tall: 4px into the
                            // 8px between rows, so two rows' areas meet
                            // and never overlap.
                            "lg:min-h-9 lg:rounded-[18px] lg:py-2 lg:before:absolute lg:before:inset-x-0 lg:before:-inset-y-1",
                            "text-left text-[14px] leading-5 active:scale-[0.97]",
                            CHIP.ease,
                            RING_LIGHT,
                            on ? CHIP.on : CHIP.off,
                          )}
                        >
                          <Icon aria-hidden className="size-3.5 shrink-0" strokeWidth={1.75} />
                          {n.label}
                        </button>
                      );
                    })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── The tally ── under the needs on a phone, the answer right
          under the question; from lg under the room, the legend first as
          a key under the figure it explains, then the count, beside the
          foot line it goes with. Not focusable, so moving it moves no
          stop in the tab order, and it reads after the needs either way.
          From lg it is never the page's scroll anchor: it comes before
          the room in the document, so Chrome would pick it first, and a
          press that changed the inspector's height would then hold the
          tally still and move the room instead. Passed over, the anchor
          is in the room, and only what is under the room moves. */}
      <div className="mt-6 flex min-w-0 flex-col gap-4 lg:col-start-2 lg:row-start-2 lg:mt-4 lg:[overflow-anchor:none]">
        {/* The count, re-keyed so it lands with the house rise when it
            changes (never on the first paint). Not a live region: the
            announcement below says it once. */}
        <p className={cn(TYPE.body, "text-pretty text-pp-ink")}>
          <span key={changed.nonce} className={cn("block", changed.nonce > 0 && "ind-swap")}>
            {summary}
          </span>
        </p>
        <p aria-live="polite" className="sr-only">
          {said}
        </p>

        <ul className={cn(TYPE.meta, "flex flex-wrap gap-x-5 gap-y-2 lg:order-first")}>
          {(Object.keys(data.kinds) as OursKind[]).map((kind) => (
            <li key={kind} className="inline-flex items-center gap-2">
              <KindGlyph kind={kind} className="text-(--home-electric)" />
              {data.kinds[kind]}
            </li>
          ))}
        </ul>
      </div>

      {/* ── The room ── */}
      <div className="mt-8 min-w-0 lg:col-start-2 lg:row-start-1 lg:mt-0">
        {/* Under 360px the room and its tiles give up 4px of padding
            apiece, so "Subscriptions", the longest word on a tile, still
            fits its column (the demo's tiles do the same). */}
        <div className="saas-lit saas-light-room-m p-4 max-[359px]:p-3 md:p-6" data-swap="">
          <LiveMesh blobs={blobs} drift={0.96} />
          <span aria-hidden className="home-grain" />

          {/* Names the radio group, and puts the layers' headings under
              one: the page reads h2, h3 (the needs), h3 (the parts), h4. */}
          <h3 id={partsId} className="sr-only">
            {data.partsAria}
          </h3>
          <div role="radiogroup" aria-labelledby={partsId} className="grid gap-5">
            {data.layers.map((layer) => {
              const count = layer.parts.filter((id) => built.has(id)).length;
              return (
                <div key={layer.name} className="min-w-0">
                  <div className="flex items-baseline justify-between gap-4">
                    <h4 className={cn(TYPE.label, "text-(--saas-dim)")}>{layer.name}</h4>
                    <span className={cn(TYPE.mono, "text-(--saas-dim)")}>
                      {count} of {layer.parts.length}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
                    {layer.parts.map((id) => {
                      const p = byId.get(id);
                      if (!p) return null;
                      const on = built.has(id);
                      const tag = !on ? data.tags.off : p.needs.length > 0 ? data.tags.added : data.tags.always;
                      const k = changed.ids.indexOf(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          {...radio.getItemProps(order.indexOf(id))}
                          // "Teams and roles, Not needed, Not on ours": the
                          // visible words first and in order, then the mark
                          // in words, so colour is never the only signal.
                          aria-label={`${p.label}, ${tag}, ${data.kinds[p.kind]}`}
                          data-on={on || undefined}
                          data-kind={p.kind}
                          style={k >= 0 ? ({ "--k": k } as CSSProperties) : undefined}
                          className={cn(
                            "saas-tile grid min-h-16 cursor-pointer grid-cols-[auto_minmax(0,1fr)] content-start gap-x-2",
                            "rounded-2xl px-3 py-2.5 text-left max-[359px]:px-2",
                            RING_LIGHT,
                          )}
                        >
                          <KindGlyph kind={p.kind} className="saas-glyph mt-[5px]" />
                          <span className="text-[14px] leading-5 font-medium text-pretty">{p.label}</span>
                          <span className={cn(TYPE.mono, "saas-tag col-start-2 mt-1 text-[10.5px] leading-4 uppercase")}>
                            {tag}
                          </span>
                          {on && k >= 0 && !calm && <span key={changed.nonce} aria-hidden className="saas-ping" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── The inspector ── white, so the landing's tokens are safe on
              it. As tall as the part in it: re-keyed on each pick, so the
              new part's copy lands with the house rise. */}
          <div className="mt-5 rounded-[20px] bg-white p-5 shadow-[0_1px_2px_rgb(20_10_36/0.06)] md:p-6">
            <div key={shown.id} className={cn("min-w-0", moved && "ind-swap")}>
              <p className={cn(TYPE.label, "text-(--home-muted)")}>{data.inspector.title}</p>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h4 className={cn(TYPE.h3, "text-balance text-(--home-ink)")} style={{ fontWeight: WEIGHT.h3 }}>
                  {shown.label}
                </h4>
                <span className={cn(TYPE.mono, "inline-flex items-center gap-1.5 text-(--home-violet)")}>
                  <KindGlyph kind={shown.kind} className="text-(--home-electric)" />
                  {data.kinds[shown.kind]}
                </span>
              </div>
              <dl className="mt-4 grid gap-4 md:grid-cols-2 md:gap-6">
                <div className="min-w-0">
                  <dt className={cn(TYPE.label, "text-(--home-muted)")}>{data.inspector.breaks}</dt>
                  <dd className={cn(TYPE.body, "mt-1 text-pretty text-(--home-ink)")}>{shown.breaks}</dd>
                </div>
                <div className="min-w-0">
                  <dt className={cn(TYPE.label, "text-(--home-muted)")}>{data.inspector.ours}</dt>
                  <dd className={cn(TYPE.body, "mt-1 text-pretty text-(--home-ink)")}>{shown.ours}</dd>
                </div>
              </dl>
              {shown.check && <CheckLine check={shown.check} kinds={data.checkKinds} tone="white" className="mt-4" />}
              {shown.map && (
                <MapLink
                  part={shown.map}
                  className={cn("home-link group relative mt-3 inline-block min-h-6 rounded-sm py-px", "before:absolute before:inset-x-0 before:-inset-y-2.5", TYPE.body, RING_LIGHT)}
                >
                  <Arrowed label={data.inspector.map} />
                </MapLink>
              )}
            </div>
          </div>
        </div>
      </div>
      <p className={cn(TYPE.meta, "mt-4 max-w-[640px] text-pretty lg:col-start-2 lg:row-start-3 lg:mt-1")}>{data.foot}</p>
    </div>
  );
}
