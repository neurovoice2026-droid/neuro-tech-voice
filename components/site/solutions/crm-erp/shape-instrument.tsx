"use client";

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { CHIP, ChipRail, RING_LIGHT, Segmented, centreInRail, chipTone, useRovingRadio } from "@/components/site/home/controls";
import { TYPE } from "@/components/site/home/type";
import { useDeviceTier } from "@/components/site/product/device-tier";
import { usePrefersReducedMotion } from "@/components/site/product/timing";
import { Stack, fill } from "@/components/site/solutions/custom-ai-agents/parts";
import { LiveMesh } from "@/components/site/solutions/custom-saas-platforms/live-mesh";
import { vtAllowed, withViewTransition } from "@/components/site/solutions/custom-saas-platforms/vt";
import type { BizId, ScopeId, ShapeSample } from "@/lib/pages/crm-erp";
import { ShapeCard, type ShapeCopy } from "./shape-card";

/* ------------------------------------------------------------------ *
 * #shape's instrument: a kind of business and how much of it goes in, on
 * white, and the sample they pick on a white card in a pearl room.
 *
 * THE CONTROLS are two radio groups on white, over the room, in the
 * order the card's tag names them. "Your business" is six chips in the
 * landing's chip colours (`chipTone`: white on electric, 5.70:1, when
 * chosen), one tab stop with arrow keys that move and pick at once
 * (`useRovingRadio`); below lg they run in a rail that scrolls sideways,
 * edge to edge on a phone, its ends fading while there is more to see,
 * and the chosen one is brought to its middle (the rail only: the page
 * never moves); from lg they wrap, every kind in sight. "How much goes
 * in" is the landing's segmented switch (Sales · Operations ·
 * Everything), its thumb edged in electric and its choice set at 500
 * (`erp-switch`, erp.css §5, as #process's view switch): a white thumb on
 * the chip-grey track is 1.12:1 on its own. On a phone the switch takes
 * the width and its segments give up their side padding, and under 360px
 * a pixel of type, so "Everything" at 500 sits in a third of a 320px
 * screen (the Automations "How hard" rule). Beside it from md, under it
 * below, the scope's hint in one line laid over the other two (`Stack`),
 * so nothing under it moves when the scope changes.
 *
 * THE ROOM is a lit surface (saas.css §2) in the hero room's light,
 * mirrored (`roomMirror`, its pools' headings swapped by `data-swap`),
 * flowing while on screen (`LiveMesh` at 1.08), with the grain. It holds
 * the white card and nothing else, so no text ever sits on a flowing
 * pool (the data module's test holds the room's children).
 *
 * THE CARD is the one element on the page wearing `saas-proto-screen`:
 * the SaaS prototype's screen, whose slide this page borrows whole. A
 * business pick is a same-document view transition in vt.ts's "proto"
 * scope, and saas-build.css §8 slides the card as it is — the old
 * picture drifting away and fading over 0.2s, the new one arriving from
 * the other side over 0.28s on the house out-ease, mirrored (`back`)
 * when the pick is to the left of the last. No transition CSS of this
 * page's own. Whether one may run is asked at the pick, never while
 * rendering (`vtAllowed`: the API, no reduced motion, not lite or
 * still), and vt.ts makes the change at once instead whenever the card
 * is under the fixed header. The card is keyed on the business, so each
 * pick mounts it afresh and the pipeline's nodes pop in order
 * (erp-shape.css §3). A scope change is no transition, only states: the
 * group rails fill or empty, top to bottom as the scope grows and bottom
 * to top as it shrinks (`data-dir`), the rows ease their colour, the
 * chips' words swap (erp-shape.css §2).
 *
 * BEFORE ANY PICK the pipeline draws itself on its own passage up the
 * screen. The first business pick sets `data-picked` on the room, and
 * from then on the card simply arrives with each pick: a line that
 * replayed on the scroll after a pick would come up half drawn wherever
 * the card happened to sit.
 *
 * FOCUS STAYS ON THE CONTROL. The chips and the switch live outside the
 * keyed card, so a pick never unmounts the element that has focus.
 *
 * KEYBOARD AND SCREEN READERS. Two radio groups, named by their visible
 * labels. The card is a group named by its title; its parts are three
 * lists under their groups' headings, and a later part ends in
 * "(later)". A pick is said once, in a polite live region ("Wholesale,
 * Operations: 8 of 11 parts in this build."): at once for a click, a tap,
 * Enter or Space, after 350ms of rest for a walk of arrows. Nothing is
 * said on load.
 *
 * THE FINISHED FRAME is the server's: Wholesale · Operations, the sample
 * #process draws, eight of its eleven parts in the build, every stage
 * drawn. With no script the controls do nothing, and the index under the
 * ledger (shape.tsx) holds all six samples in words.
 *
 * Every word arrives in `data` (the data module's ERP_SHAPE slice, types
 * only here), and every count is filled into its template.
 * ------------------------------------------------------------------ */

/** Arrows walking the chips or the switch: the live region speaks this long after the last press (the landing's rest). */
const KEY_REST_MS = 350;

/** A pick's input: a walk of arrows (or Home, End) waits for the keys to rest; a pointer, Enter or Space doesn't. */
type Via = "pointer" | "key";

/**
 * A business chip: 40px drawn, 44px to a finger (2px past each edge; the
 * rail's 8px gap keeps the next row's target clear where the chips wrap
 * from lg), as the #checks filter draws its chips.
 */
const BIZ_CHIP = cn(
  "relative inline-flex h-10 cursor-pointer items-center rounded-full px-4 text-sm whitespace-nowrap",
  "before:absolute before:inset-x-0 before:-inset-y-0.5",
  CHIP.ease,
  RING_LIGHT,
);

/** The card's edge on the pearl: the hero plates' shadow, a hairline drawn inside so it reads on the palest pool. */
const CARD_EDGE = "shadow-[0_1px_2px_rgb(20_10_36/0.06),inset_0_0_0_1px_rgb(20_10_36/0.06),0_24px_48px_-32px_rgb(20_10_36/0.25)]";

/**
 * What the live region says: a walk of arrows says its line once the keys
 * rest, anything else at once; a repeat alternates a trailing no-break
 * space so it is heard again (#process's stage does the same).
 */
function useLiveLine() {
  const [said, setSaid] = useState("");
  const timer = useRef(0);
  const say = useCallback((line: string, via: Via) => {
    window.clearTimeout(timer.current);
    const speak = () => setSaid((prev) => (prev === line ? `${line}\u00a0` : line));
    if (via === "key") timer.current = window.setTimeout(speak, KEY_REST_MS);
    else speak();
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { said, say };
}

/** The sample a business picks: there is one for each (the data module's test holds all six). */
function sampleOf(samples: readonly ShapeSample[], biz: BizId): ShapeSample {
  return samples.find((s) => s.id === biz) ?? samples[0];
}

type Choice = {
  biz: BizId;
  scope: ScopeId;
  /** Set by the first business pick: the card arrives with each pick, and the pipeline no longer draws on the scroll. */
  picked: boolean;
  /** Which way the last scope change went: the group rails fill top to bottom, or empty bottom to top. */
  dir: "grow" | "shrink";
};

export function ShapeInstrument({ data, blobs }: { data: ShapeCopy; blobs: readonly CSSProperties[] }) {
  const reduce = usePrefersReducedMotion();
  const tier = useDeviceTier();
  const uid = useId();
  const bizLabelId = `${uid}-biz`;
  const scopeLabelId = `${uid}-scope`;
  const titleId = `${uid}-title`;

  const [choice, setChoice] = useState<Choice>({ ...data.initial, picked: false, dir: "grow" });
  const { said, say } = useLiveLine();
  const railRef = useRef<HTMLDivElement>(null);
  // The switch's last input was a walk of its arrows: its line waits for the keys to rest.
  // The shared Segmented hands a key and a click to onChange alike, so its wrapper reads the input first.
  const viaKey = useRef(false);

  const sample = sampleOf(data.samples, choice.biz);
  const bizIndex = data.businesses.findIndex((b) => b.id === choice.biz);
  const scopeIndex = Math.max(0, data.scopes.findIndex((s) => s.id === choice.scope));

  /** The live line for a pick: the business, the scope, and how many of the sample's parts go in. */
  function lineFor(biz: BizId, scope: ScopeId): string {
    const s = sampleOf(data.samples, biz);
    const reach = data.scopes.findIndex((x) => x.id === scope);
    const n = s.parts.filter((p) => data.scopes.findIndex((x) => x.id === p.level) <= reach).length;
    return fill(data.live, {
      business: data.businesses.find((b) => b.id === biz)?.label ?? "",
      scope: data.scopes[reach]?.label ?? "",
      n,
      total: s.parts.length,
    });
  }

  function pickBiz(i: number, via: Via) {
    const next = data.businesses[i]?.id;
    if (!next || next === choice.biz) return;
    // Below lg the rail scrolls: bring the chosen chip to its middle (the rail only; the page never moves).
    const rail = railRef.current;
    const chip = rail?.querySelector<HTMLElement>(`[data-biz="${next}"]`);
    if (rail && chip && rail.scrollWidth > rail.clientWidth) centreInRail(rail, chip, reduce);
    // The card slides to the new sample (saas-build.css §8), mirrored for a pick to the left.
    withViewTransition("proto", () => setChoice((c) => ({ ...c, biz: next, picked: true })), {
      allowed: vtAllowed(reduce, tier),
      types: i < bizIndex ? ["back"] : [],
    });
    say(lineFor(next, choice.scope), via);
  }

  function pickScope(next: ScopeId) {
    if (next === choice.scope) return;
    const to = data.scopes.findIndex((s) => s.id === next);
    setChoice((c) => ({ ...c, scope: next, dir: to > data.scopes.findIndex((s) => s.id === c.scope) ? "grow" : "shrink" }));
    say(lineFor(choice.biz, next), viaKey.current ? "key" : "pointer");
  }

  const radio = useRovingRadio({
    count: data.businesses.length,
    index: bizIndex,
    orientation: "horizontal",
    onChange: pickBiz,
  });

  return (
    <>
      {/* ── The controls ── on white, the business over the scope. */}
      <div className="mt-10 flex flex-col gap-6">
        <div className="min-w-0">
          <p id={bizLabelId} className={cn(TYPE.label, "text-pp-muted")}>
            {data.bizLabel}
          </p>
          {/* Below lg a rail that scrolls sideways; from lg the chips wrap.
              10px under the label, and the rail's own 4px. */}
          <ChipRail
            labelledBy={bizLabelId}
            railRef={railRef}
            className="erp-shape-chips mt-2.5 lg:flex-wrap lg:snap-none lg:overflow-visible"
          >
            {data.businesses.map((b, i) => (
              <button
                key={b.id}
                type="button"
                data-biz={b.id}
                {...radio.getItemProps(i)}
                className={cn(BIZ_CHIP, chipTone(i === bizIndex))}
              >
                {b.label}
              </button>
            ))}
          </ChipRail>
        </div>

        <div className="min-w-0">
          <p id={scopeLabelId} className={cn(TYPE.label, "text-pp-muted")}>
            {data.scopeLabel}
          </p>
          <div className="mt-3 md:flex md:items-center md:gap-6">
            {/* The wrapper reads the input before the switch's own keydown calls onChange. */}
            <div
              className="shrink-0"
              onKeyDownCapture={(e) => {
                viaKey.current = e.key.startsWith("Arrow") || e.key === "Home" || e.key === "End";
              }}
              onPointerDownCapture={() => {
                viaKey.current = false;
              }}
            >
              <Segmented
                label={data.scopeLabel}
                options={data.scopes}
                value={choice.scope}
                onChange={pickScope}
                className="erp-switch w-full sm:w-[360px] max-sm:[&>button]:px-1 max-[359px]:[&>button]:text-[13px]"
              />
            </div>
            <Stack
              className="mt-2 min-w-0 md:mt-0 md:flex-1"
              items={data.scopes}
              live={scopeIndex}
              swap={false}
              render={(s) => <p className={cn(TYPE.meta, "text-pretty")}>{s.hint}</p>}
            />
          </div>
        </div>
      </div>

      {/* ── The room ── the pools, the grain and the card: nothing else on the light. */}
      <div
        className="erp-room saas-lit saas-light-room-m home-rise mt-6 p-4 md:p-6 lg:p-8"
        data-swap=""
        data-picked={choice.picked ? "" : undefined}
      >
        <LiveMesh blobs={blobs} drift={1.08} />
        <span aria-hidden className="home-grain" />
        {/* The card: white, and the one element on the page wearing the prototype's screen class. */}
        <div
          key={choice.biz}
          role="group"
          aria-labelledby={titleId}
          data-dir={choice.dir}
          className={cn("erp-shape-card saas-proto-screen min-w-0 rounded-[22px] bg-white p-5 md:p-7 lg:p-8", CARD_EDGE)}
        >
          <ShapeCard data={data} sample={sample} scope={choice.scope} titleId={titleId} />
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {said}
      </p>
    </>
  );
}
