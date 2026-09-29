"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { CHIP, ChipRail, RING_LIGHT, Segmented, centreInRail, useRovingRadio } from "@/components/site/home/controls";
import { TYPE } from "@/components/site/home/type";
import { usePrefersReducedMotion } from "@/components/site/product/timing";
import { fill } from "@/components/site/solutions/custom-ai-agents/parts";
import { LiveMesh } from "@/components/site/solutions/custom-saas-platforms/live-mesh";
import type { KindId, KindsData, Sample, SideId } from "@/lib/pages/custom-mobile-applications";
import { FeatureGlyph, KindTag, PartGlyph } from "./glyphs";
import { MiniPhone } from "./sketch";

/* ------------------------------------------------------------------ *
 * #kinds' instrument: a kind of app and who uses it, on white, and the
 * sample they pick in a pearl room — its first five screens drawn as
 * phones, what it asks of the phone, which of the nine parts behind it
 * already run on this platform, and three lines: where AI comes in, what
 * makes it hard, and the store rule it meets.
 *
 * THE CONTROLS are two radio groups on white, over the room, in the
 * order the room's tag names them. "Kind of app" is six chips in the
 * landing's chip colours (`CHIP`: white on electric, 5.70:1, when
 * chosen), one tab stop with arrow keys that move and pick at once
 * (`useRovingRadio`); they wrap at every width — on a phone in three or
 * four rows, since a sideways rail there showed three whole chips and
 * nothing past them at 390, as if there were only three kinds — and
 * `ChipRail` still brings a chosen chip to its middle should the row
 * ever scroll (the rail only: the page never moves). "Who uses it" is the
 * landing's segmented switch, its white thumb gliding under the side
 * picked; here the thumb carries an electric edge and its label a
 * heavier weight (`mob-switch`, mob.css §5), because a white thumb on
 * the chip-grey track is 1.12:1 and the violet label against the muted
 * one differs by hue alone — the Automations page's fix for its level
 * switch, which lives in a sheet this page doesn't load. From xl the two
 * stand side by side, the chips on the left and the switch on the
 * right, their labels on one line; below xl the switch stands under the
 * chips, which wrap to two rows at md. Kept in the DOM's order at every
 * width, so the keyboard never jumps back up the screen.
 *
 * THE ROOM is a lit surface (saas.css §2) in the hero room's light,
 * mirrored (`roomMirror`, its pools' headings swapped by `data-swap`),
 * flowing while on screen (`LiveMesh` at 1.08), and a region named by
 * the sample's title. Its head is the sample: the tag ("Sample ·
 * Bookings · Your customers", so a sample is never mistaken for a
 * client's app), the title in the display face, and who uses it.
 *
 * THE STORYBOARD is the sample's first five screens, each a mini phone
 * (sketch.tsx) with the screen's name under it, in a list named by its
 * visible label. From md the five stand in one row, 120px wide at md,
 * 150 at lg and 168 from xl, spread across the room; below md they run
 * in a rail of 150px phones that scrolls sideways edge to edge, snapping
 * each to the middle, its ends fading while there is more to see
 * (`home-fade-x`), and scrollable with no script, with a thin scrollbar
 * where a mouse may be (`mob-swipe`, mob.css §2). Where it scrolls it is
 * a tab stop of its own (the arrow keys scroll it), since nothing in it
 * can take focus; where it doesn't, it isn't one.
 *
 * THE CARDS are white plates on the light (the landing's tokens are safe
 * on them again, so they are named directly, `--home-*`: inside a lit
 * surface the `--pp-*` tokens point at the light's), three columns from
 * lg, two at md with the third across their foot, stacked on a phone.
 * Three from lg and not only from xl: two columns there left the needs
 * card a third empty beside the nine parts, and the three balance. Side
 * by side the cards stand as tall as the tallest (the parts), so the
 * needs spread down their card and the lines keep the rule link at its
 * foot, level with the parts card's own link: no card is left with an
 * empty floor.
 *   · "What it asks of the phone": four rows, each a feature's glyph
 *     (electric, a mark), its name, and a tag that says how much the
 *     sample leans on it — "Needs it", white on an electric pill (5.70),
 *     or "Often", violet in an electric ring (7.10), so the difference
 *     never rests on colour alone — and why, in a line.
 *   · "What runs behind it": all nine parts, always, in the data
 *     module's order, so two samples can be read row against row. A part
 *     the sample uses says whether it runs here ("Runs here", settled
 *     green 5.50, with the filled node) or is built for yours ("Built for
 *     yours", violet, with the dotted ring: push, the one part this
 *     platform doesn't run); a part it doesn't use steps back to ink at
 *     60% (about 5:1) and says so beside a dash (`absent`, kept short, so
 *     its tag leaves the part's name room on a phone). Then the
 *     way down to #server, where each part is in full.
 *   · The lines: "With AI", "What makes it hard", and "The store rule it
 *     meets", which is the gate's own title as a link down to its card in
 *     #path (#gate-<id>). At md the three stand in a row across the
 *     plate's width; from lg, in a column of their own.
 *
 * THE SHAPE IS FIXED: five screens, four needs, nine parts and three
 * lines, whatever the pick. The room changes height only where a
 * sentence wraps differently, and only on the reader's pick; nothing
 * above it moves.
 *
 * THE MOTION is CSS alone (mob-kinds.css). Before any pick, the
 * storyboard sketches itself on its own passage up the screen, phone by
 * phone (sketch.tsx). After the reader's first pick the room carries
 * `data-picked`, and each pick mounts the phones and the four needs
 * afresh (keyed on the sample): the phones deal in from 8px below, 40ms
 * apart (`--k`), whole, and the need tags pop, 30ms apart. No view
 * transition. Reduced motion, a browser without view timelines, the lite
 * and still tiers and weak hardware get every screen drawn, and a pick
 * is an instant swap.
 *
 * FOCUS STAYS ON THE CONTROL. Nothing that can hold focus is remounted
 * by a pick: the phones and the need rows are text and drawings, the
 * storyboard's list itself stays (and scrolls back to its first screen),
 * and the rule link only changes its words and its target.
 *
 * KEYBOARD AND SCREEN READERS. Two radio groups, named by their visible
 * labels. A part's row is read as its name and then its answer ("Push:
 * Built for yours"), a need's as its name and its tag, then why. A pick
 * is announced once, in a polite live region, after the keys have
 * rested ("Bookings, Your customers: Book a time, pay a deposit, get
 * reminded."), and nothing is announced on load.
 *
 * THE FINISHED FRAME is the server's: Bookings · Your customers, the
 * phone's own sample above, every screen drawn. With no script the
 * controls do nothing, and the index under the room (kinds.tsx) holds
 * all twelve.
 *
 * Every word arrives in `data` (the data module's MOB_KINDS slice, types
 * only here).
 * ------------------------------------------------------------------ */

/** How long the keys rest before a pick is announced: a held arrow is one announcement, not six. */
const REST_MS = 350;

/** A white plate on the pearl: the hero plates' shadow, a hairline drawn inside so its edge reads on the palest pool. */
const PLATE = "rounded-[20px] bg-white shadow-[0_1px_2px_rgb(20_10_36/0.06),inset_0_0_0_1px_rgb(20_10_36/0.06)]";

/**
 * A kind's chip: 40px drawn, 44px to a finger (2px past each edge; the
 * rail's 8px gap keeps the next row's target clear where the chips wrap
 * from md), as the #checks filter draws its chips.
 */
const KIND_CHIP = cn(
  "relative inline-flex h-10 cursor-pointer items-center rounded-full px-4 text-sm whitespace-nowrap",
  "before:absolute before:inset-x-0 before:-inset-y-0.5",
  CHIP.ease,
  RING_LIGHT,
);

/** A card's title on white: the landing's label, in its muted. */
const CARD_TITLE = cn(TYPE.label, "text-balance text-(--home-muted)");

/**
 * A link in a card, in the body's 15/22 type: a 44px target to a finger
 * however many lines it takes (a box of at least 24px, reaching 10px past
 * it either way, as CheckLine's links reach), its arrow never wrapping
 * away from its last word.
 */
const LINK = cn(
  "home-link group relative inline-flex min-h-6 items-center rounded-sm text-[15px] leading-[22px] text-pretty before:absolute before:inset-x-0 before:-inset-y-2.5",
  RING_LIGHT,
);

/**
 * A name that never breaks inside itself: its spaces no-break (U+00A0)
 * and its hyphens non-breaking (U+2011, which Inter draws as a hyphen),
 * for the sample's tag, where "Delivery and field work" and "Your
 * customers" are one name each and the tag wraps only after a "·".
 */
function unbroken(name: string): string {
  return name.replace(/ /g, " ").replace(/-/g, "‑");
}

/** The sample a kind and a side pick: there is one for each pair (the data module's test holds all twelve). */
function sampleOf(samples: readonly Sample[], kind: KindId, side: SideId): Sample {
  return samples.find((s) => s.kind === kind && s.side === side) ?? samples[0];
}

/** The last word of a label kept with the arrow after it, so the arrow never starts a line alone. */
function Arrowed({ label, arrow }: { label: string; arrow: "→" | "↓" }) {
  const cut = label.lastIndexOf(" ");
  const head = cut < 0 ? "" : label.slice(0, cut + 1);
  const tail = cut < 0 ? label : label.slice(cut + 1);
  return (
    <span>
      {head}
      <span className="whitespace-nowrap">
        {tail}
        <span
          aria-hidden
          className={cn(
            "ml-1 inline-block transition-transform duration-200",
            arrow === "→" ? "group-hover:translate-x-0.5" : "group-hover:translate-y-0.5",
          )}
        >
          {arrow}
        </span>
      </span>
    </span>
  );
}

export function KindsInstrument({
  data,
  blobs,
}: {
  data: Omit<KindsData, "eyebrow" | "title" | "key" | "sub" | "indexSummary" | "foot">;
  blobs: readonly CSSProperties[];
}) {
  const reduce = usePrefersReducedMotion();
  const uid = useId();
  const kindsId = `${uid}-kinds`;
  const titleId = `${uid}-title`;
  const screensId = `${uid}-screens`;
  const phoneId = `${uid}-phone`;
  const serverId = `${uid}-server`;

  const [choice, setChoice] = useState<{ kind: KindId; side: SideId }>(data.initial);
  // Set by the reader's first pick: from then on the phones deal in and
  // the tags pop on the clock (mob-kinds.css §2) instead of the storyboard
  // sketching itself on its passage up the screen.
  const [picked, setPicked] = useState(false);
  // What the live region last said: empty until the reader picks.
  const [said, setSaid] = useState("");
  // Whether the storyboard scrolls sideways (below md): only then is it a tab stop.
  const [scrolls, setScrolls] = useState(false);
  const rest = useRef(0);
  const railRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const timers = rest;
    return () => window.clearTimeout(timers.current);
  }, []);

  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const measure = () => setScrolls(board.scrollWidth > board.clientWidth + 1);
    // No first read here: at mount #kinds is still a skipped content-visibility
    // box, and reading its geometry in the hydration task forced its whole
    // layout there (100ms and more on a slow phone). The observer's first
    // callback, once the box renders, sets it instead.
    const ro = new ResizeObserver(measure);
    ro.observe(board);
    return () => ro.disconnect();
  }, []);

  const sample = sampleOf(data.samples, choice.kind, choice.side);
  const kindIndex = data.kinds.findIndex((k) => k.id === choice.kind);
  const kindLabel = data.kinds[kindIndex]?.label ?? "";
  const sideLabel = data.sides.find((s) => s.id === choice.side)?.label ?? "";
  const gate = data.gates.find((g) => g.id === sample.rule);

  /** Shows a sample: the room swaps to it now, and the live region says so once the keys rest. */
  function show(kind: KindId, side: SideId) {
    if (kind === choice.kind && side === choice.side) return;
    const next = sampleOf(data.samples, kind, side);
    const words = fill(data.live, {
      kind: data.kinds.find((k) => k.id === kind)?.label ?? "",
      side: data.sides.find((s) => s.id === side)?.label ?? "",
      title: next.title,
    });
    setChoice({ kind, side });
    setPicked(true);
    // A new sample opens on its first screen, wherever the last one was scrolled to.
    const board = boardRef.current;
    if (board && board.scrollLeft > 0) board.scrollTo({ left: 0, behavior: "instant" });
    window.clearTimeout(rest.current);
    rest.current = window.setTimeout(() => setSaid(words), REST_MS);
  }

  function pickKind(i: number) {
    const next = data.kinds[i]?.id;
    if (!next) return;
    // On a phone the rail scrolls: bring the chosen chip to its middle
    // (the rail only; the page never moves).
    const rail = railRef.current;
    const chip = rail?.querySelector<HTMLElement>(`[data-kind="${next}"]`);
    if (rail && chip && rail.scrollWidth > rail.clientWidth) centreInRail(rail, chip, reduce);
    show(next, choice.side);
  }

  const radio = useRovingRadio({
    count: data.kinds.length,
    index: kindIndex,
    orientation: "horizontal",
    onChange: (i) => pickKind(i),
  });

  return (
    <>
      {/* ── The controls ── on white. From xl side by side, their labels
          on one line and the chips level with the switch; below xl the
          switch's block under the chips'. */}
      <div className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start xl:gap-8">
        <div className="min-w-0">
          <p id={kindsId} className={cn(TYPE.label, "text-pp-muted")}>
            {data.kindsLabel}
          </p>
          {/* The chips wrap where they must, every kind in sight: three or four
              rows on a phone, two at md, one from lg. 10px under the
              label, and the rail's own 4px, put the chips' middle level with
              the switch's beside them from xl. */}
          <ChipRail labelledBy={kindsId} railRef={railRef} className="mt-2.5 flex-wrap snap-none overflow-visible">
            {data.kinds.map((k, i) => {
              const on = i === kindIndex;
              return (
                <button
                  key={k.id}
                  type="button"
                  data-kind={k.id}
                  {...radio.getItemProps(i)}
                  className={cn(KIND_CHIP, on ? CHIP.on : CHIP.off)}
                >
                  {k.label}
                </button>
              );
            })}
          </ChipRail>
        </div>

        <div className="min-w-0">
          <p className={cn(TYPE.label, "text-pp-muted")}>{data.sideLabel}</p>
          {/* The whole width on a phone, as wide as its words from md.
              `mob-switch` edges the thumb in electric and sets the chosen
              label at 500 (mob.css §5), as on #hold's platform switch. */}
          <Segmented
            label={data.sideLabel}
            options={data.sides}
            value={choice.side}
            onChange={(side) => show(choice.kind, side)}
            className="mob-switch mt-3 w-full md:w-auto"
          />
        </div>
      </div>

      {/* ── The room ── */}
      <div
        role="region"
        aria-labelledby={titleId}
        className="mob-kinds saas-lit saas-light-room-m home-rise mt-6 p-4 md:p-8 lg:p-10"
        data-swap=""
        data-picked={picked ? "" : undefined}
      >
        <LiveMesh blobs={blobs} drift={1.08} />
        <span aria-hidden className="home-grain" />

        {/* The head: on the light, in its own tokens. The tag's names are
            unbroken, and its template glues each "·" to the word before
            it, so on a phone it wraps only after a "·". */}
        <div className="min-w-0">
          <p className={cn(TYPE.label, "text-(--saas-dim)")}>
            {fill(data.tag, { kind: unbroken(kindLabel), side: unbroken(sideLabel) })}
          </p>
          <h3
            id={titleId}
            className="pp-display mt-2 text-[26px] leading-[30px] tracking-[-0.015em] text-balance text-(--saas-text)"
            style={{ fontWeight: 500 }}
          >
            {sample.title}
          </h3>
          <p className={cn(TYPE.meta, "mt-1.5 text-pretty text-(--saas-dim)")}>{sample.who}</p>
        </div>

        {/* ── The storyboard ── the first five screens. The list stays;
            its phones are keyed on the sample, so a pick deals them in
            afresh (mob-kinds.css §2). */}
        <p id={screensId} className={cn(TYPE.label, "mt-7 text-(--saas-dim)")}>
          {data.screensLabel}
        </p>
        <ol
          ref={boardRef}
          aria-labelledby={screensId}
          tabIndex={scrolls ? 0 : undefined}
          className={cn(
            "mob-board home-draw home-fade-x mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-2",
            // Its scrollbar hidden to a finger, thin where a mouse may be (`mob-swipe`, mob.css §2).
            "mob-swipe -mx-4 px-4",
            "md:mx-0 md:snap-none md:justify-between md:gap-0 md:overflow-visible md:px-0 md:pb-0",
            // A tab stop below md only, where it scrolls: its ring drawn inside
            // its box, since its fade's mask clips whatever paints outside it
            // (the mask itself comes off while it has focus, mob-kinds.css §1).
            "rounded-md focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-pp-ink",
          )}
        >
          {sample.screens.map((screen, i) => (
            <li
              key={`${sample.id}-${i}`}
              className={cn(
                "mob-shot w-[150px] shrink-0 snap-center md:w-[120px] lg:w-[150px] xl:w-[168px]",
                // The outline's width, 1.6px on screen at each of those sizes (sketch.tsx).
                "[--mob-sk-w:1.28px] md:[--mob-sk-w:1.6px] lg:[--mob-sk-w:1.28px] xl:[--mob-sk-w:1.143px]",
              )}
              style={{ "--k": i } as CSSProperties}
            >
              <MiniPhone screen={screen} i={i} />
              <span className="mt-2.5 block text-center text-[13px] leading-[18px] text-balance text-(--saas-text)">
                {screen.name}
              </span>
            </li>
          ))}
        </ol>

        {/* ── The cards ── white. Three columns from lg; two at md, the
            lines across their foot; stacked on a phone. */}
        <div className="mt-6 grid gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,0.95fr)]">
          <div className={cn(PLATE, "flex min-w-0 flex-col p-5")}>
            <h4 id={phoneId} className={CARD_TITLE}>
              {data.phoneTitle}
            </h4>
            {/* Keyed on the sample, so after a pick the tags pop in again. */}
            <ul aria-labelledby={phoneId} className="mt-4 flex flex-1 flex-col justify-between gap-4">
              {sample.phone.map((need, k) => (
                <li key={`${sample.id}-${need.id}`} className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-2.5">
                  <FeatureGlyph id={need.id} className="mt-1 text-(--home-electric)" />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[15px] leading-[22px] font-medium text-(--home-ink)">
                        {data.features.find((f) => f.id === need.id)?.label}
                      </span>
                      <span className="sr-only">, </span>
                      <span
                        className={cn(TYPE.mono, "mob-need inline-flex h-5 items-center rounded-full px-2 text-[11px] leading-4 uppercase")}
                        data-need={need.need}
                        style={{ "--k": k } as CSSProperties}
                      >
                        {data.needs[need.need]}
                      </span>
                    </p>
                    <p className={cn(TYPE.meta, "mt-0.5 text-pretty text-(--home-muted)")}>{need.why}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className={cn(PLATE, "flex min-w-0 flex-col p-5")}>
            <h4 id={serverId} className={CARD_TITLE}>
              {data.serverTitle}
            </h4>
            <ul aria-labelledby={serverId} className="mt-2 divide-y divide-pp-rule">
              {data.parts.map((p) => {
                const used = sample.parts.includes(p.id);
                return (
                  <li
                    key={p.id}
                    data-used={used ? "" : undefined}
                    className={cn(
                      "mob-kpart grid min-h-8 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5 py-1",
                      !used && "text-(--home-ink)/60",
                    )}
                  >
                    <PartGlyph id={p.id} className={used ? "text-(--home-electric)" : undefined} />
                    <span className={cn("min-w-0 text-[14px] leading-5", used && "text-(--home-ink)")}>{p.label}</span>
                    <span className="sr-only">: </span>
                    {used ? (
                      <KindTag kind={p.kind} copy={data.ours} tone="white" />
                    ) : (
                      <span className={cn(TYPE.mono, "mob-tag inline-flex items-center gap-1.5 uppercase")}>
                        <svg aria-hidden viewBox="0 0 10 10" className="mob-glyph size-2.5 overflow-visible">
                          <path d="M2 5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                        {data.absent}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="mt-auto pt-4">
              <a href={data.full.href} className={LINK}>
                <Arrowed label={data.full.label} arrow="↓" />
              </a>
            </p>
          </div>

          <dl
            className={cn(
              PLATE,
              "grid min-w-0 content-start gap-5 p-5 md:col-span-2 md:grid-cols-3 md:gap-6 lg:col-span-1 lg:grid-cols-1 lg:content-between lg:gap-5",
            )}
          >
            <div className="min-w-0">
              <dt className={CARD_TITLE}>{data.aiLabel}</dt>
              <dd className="mt-2 text-[15px] leading-[22px] text-pretty text-(--home-ink)">{sample.ai}</dd>
            </div>
            <div className="min-w-0">
              <dt className={CARD_TITLE}>{data.hardLabel}</dt>
              <dd className="mt-2 text-[15px] leading-[22px] text-pretty text-(--home-ink)">{sample.hard}</dd>
            </div>
            <div className="min-w-0">
              <dt className={CARD_TITLE}>{data.ruleLabel}</dt>
              <dd className="mt-2">
                <a href={`#gate-${sample.rule}`} className={LINK}>
                  <Arrowed label={gate?.title ?? ""} arrow="→" />
                </a>
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {said}
      </p>
    </>
  );
}
