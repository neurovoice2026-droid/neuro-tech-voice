"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHIP, RING_LIGHT, useRovingRadio } from "@/components/site/home/controls";
import { TYPE, WEIGHT } from "@/components/site/home/type";
import { useDeviceTier } from "@/components/site/product/device-tier";
import { usePrefersReducedMotion } from "@/components/site/product/timing";
import { Stack, fill } from "@/components/site/solutions/custom-ai-agents/parts";
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
 * `aria-pressed` button, 44px tall, in the landing's chip colours: the
 * chip grey with a plus while off, electric with a tick while on (white
 * on electric, 5.70:1). The plus and the tick share one slot, so a chip
 * is the same width either way and pressing one never reflows the row.
 * Under them, how many parts the build now has and how many of those are
 * there because of what the reader picked, and a legend for the three
 * marks a part can carry.
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
 * copy lands with the house `ind-swap` rise, and so does the summary.
 * With reduced motion the tiles' transitions are pinned to none (the
 * global rule zeroes durations but not the stagger's delays) and the
 * ping is never rendered; the still tier does the same. Lite keeps it:
 * colour changes and one small ring are what lite can afford.
 *
 * THE FINISHED FRAME is the server's: Subscriptions on — ten parts, two
 * of them there because of it — and the inspector on "Each customer’s
 * data, walled off", the part that most often goes wrong silently.
 *
 * NOTHING MOVES WHEN IT CHANGES. The inspector is a `Stack` (the custom
 * AI agents page's reservation stack): every part's copy laid into one
 * grid cell, invisible, with the live one over them, so the inspector is
 * as tall as its tallest part from the first paint and picking another
 * never shifts the page. A tile's outline is a border in both states —
 * transparent once built, where the white fill runs under it — so
 * filling one never changes its size.
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
  // The tiles the last press flipped, in reading order, and a fresh key
  // for each press, so the pings remount even when the same tiles flip.
  const [changed, setChanged] = useState<{ ids: readonly ScopePartId[]; nonce: number }>({ ids: [], nonce: 0 });
  // What the live region last said: empty until the reader presses a need.
  const [said, setSaid] = useState("");
  const settle = useRef(0);

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

  const radio = useRovingRadio({
    count: order.length,
    index: order.indexOf(part),
    orientation: "horizontal",
    onChange: (i) => setPart(order[i]),
  });

  function toggle(id: NeedId) {
    const on = !needs.has(id);
    const next = new Set(needs);
    if (on) next.add(id);
    else next.delete(id);
    const after = builtBy(data.parts, next);
    const flipped = order.filter((p) => built.has(p) !== after.has(p));

    setNeeds(next);
    setChanged((c) => ({ ids: flipped, nonce: c.nonce + 1 }));
    // The part the reader just caused, shown without taking their focus.
    if (on && flipped.length > 0) setPart(flipped[0]);
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

  const inspected = Math.max(
    0,
    data.parts.findIndex((p) => p.id === part),
  );

  return (
    <div
      className={cn(
        "mt-10 grid gap-8 lg:mt-12 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-12",
        "xl:grid-cols-[320px_minmax(0,1fr)]",
      )}
    >
      {/* ── The needs ── on white. From lg, on a screen tall enough to
          hold the whole column under the header, it holds still while the
          room beside it is read, so a need is always a press away from
          the parts it changes; on a shorter one it scrolls, so its foot is
          never cut off. */}
      <div className="min-w-0 lg:self-start lg:[@media(min-height:52rem)]:sticky lg:[@media(min-height:52rem)]:top-28">
        <h3 className={cn(TYPE.label, "text-pp-muted")}>{data.needsTitle}</h3>
        <div className="mt-4 grid gap-6 md:grid-cols-2 lg:grid-cols-1">
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
                          onClick={() => toggle(n.id)}
                          className={cn(
                            // One line is a 44px pill; a label too long for
                            // the column wraps inside it rather than
                            // spilling out of it.
                            "inline-flex min-h-11 max-w-full cursor-pointer items-center gap-1.5 rounded-[22px] px-4 py-2.5",
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

        {/* The count, re-keyed so it lands with the house rise when it
            changes (never on the first paint). Not a live region: the
            announcement below says it once. */}
        <p className={cn(TYPE.body, "mt-6 text-pretty text-pp-ink")}>
          <span key={changed.nonce} className={cn("block", changed.nonce > 0 && "ind-swap")}>
            {summary}
          </span>
        </p>
        <p aria-live="polite" className="sr-only">
          {said}
        </p>

        <ul className={cn(TYPE.meta, "mt-4 flex flex-wrap gap-x-5 gap-y-2")}>
          {(Object.keys(data.kinds) as OursKind[]).map((kind) => (
            <li key={kind} className="inline-flex items-center gap-2">
              <KindGlyph kind={kind} className="text-(--home-electric)" />
              {data.kinds[kind]}
            </li>
          ))}
        </ul>
      </div>

      {/* ── The room ── */}
      <div className="min-w-0">
        <div className="saas-lit saas-light-room-m p-4 md:p-6" data-swap="">
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
                            "rounded-2xl px-3 py-2.5 text-left",
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
              it. Every part's copy is laid in underneath the live one, so
              it is always the height of the tallest. */}
          <div className="mt-5 rounded-[20px] bg-white p-5 shadow-[0_1px_2px_rgb(20_10_36/0.06)] md:p-6">
            <Stack
              items={data.parts}
              live={inspected}
              render={(p) => (
                <div className="min-w-0">
                  <p className={cn(TYPE.label, "text-(--home-muted)")}>{data.inspector.title}</p>
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h4 className={cn(TYPE.h3, "text-balance text-(--home-ink)")} style={{ fontWeight: WEIGHT.h3 }}>
                      {p.label}
                    </h4>
                    <span className={cn(TYPE.mono, "inline-flex items-center gap-1.5 text-(--home-violet)")}>
                      <KindGlyph kind={p.kind} className="text-(--home-electric)" />
                      {data.kinds[p.kind]}
                    </span>
                  </div>
                  <dl className="mt-4 grid gap-4 md:grid-cols-2 md:gap-6">
                    <div className="min-w-0">
                      <dt className={cn(TYPE.label, "text-(--home-muted)")}>{data.inspector.breaks}</dt>
                      <dd className={cn(TYPE.body, "mt-1 text-pretty text-(--home-ink)")}>{p.breaks}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className={cn(TYPE.label, "text-(--home-muted)")}>{data.inspector.ours}</dt>
                      <dd className={cn(TYPE.body, "mt-1 text-pretty text-(--home-ink)")}>{p.ours}</dd>
                    </div>
                  </dl>
                  {p.check && <CheckLine check={p.check} kinds={data.checkKinds} tone="white" className="mt-4" />}
                  {p.map && (
                    <MapLink
                      part={p.map}
                      className={cn(
                        "home-link group mt-3 inline-block min-h-6 rounded-sm py-px",
                        TYPE.body,
                        RING_LIGHT,
                      )}
                    >
                      <Arrowed label={data.inspector.map} />
                    </MapLink>
                  )}
                </div>
              )}
            />
          </div>
        </div>
        <p className={cn(TYPE.meta, "mt-4 max-w-[640px] text-pretty")}>{data.foot}</p>
      </div>
    </div>
  );
}
