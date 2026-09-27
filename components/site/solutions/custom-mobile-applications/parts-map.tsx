import type { PartFace } from "@/lib/pages/custom-mobile-applications";
import { cn } from "@/lib/utils";
import { PartGlyph } from "./glyphs";
import { DASH, DASHED, DOT_R, PORT, VIEW, boxOf, edgePath, pinned, placed } from "./parts-geometry";
import { EDGE_IDS, type Frame } from "./phone-frame";

/* ------------------------------------------------------------------ *
 * #hold — the drawing (lg and up): the nine parts an app talks to, as
 * this platform runs them, and the lines the phone's journey travels
 * between them, beside the phone.
 *
 * TWO LAYERS, ONE BOX, as the SaaS explorer's map and the Automations
 * workbench's. An <svg viewBox="0 0 600 416"> carries the lines, the
 * phone's port and the two dots that ride a hop; HTML cards carry the
 * parts, laid over it at their parts-geometry boxes as percentages of
 * the same aspect-ratio box, so the two meet exactly. The cards are HTML
 * because their words are text (a translation, the reader's own font
 * size reach them); the lines are SVG because DrawSVG and MotionPath
 * need paths.
 *
 * THE PHONE is off the left edge, where the device stands: its port is
 * a ring on the edge, at the API's level, named "The phone" in mono
 * standing on end in the gutter beside it, and every line to or from it
 * runs through the bus down the drawing's left side.
 *
 * EACH LINE IS DRAWN TWICE: a base, a hairline that turns faint
 * electric while it lies on the step's way (`data-route`), and draws
 * once, on the drawing's own passage up the screen (home.css
 * `home-draw`: `pathLength="1"`); and over it a trace, electric and
 * 2px, shown once the step has arrived along it (`data-on`), which the
 * tour draws in with DrawSVG as a dot rides it (phone-timeline.ts). The
 * two lines to and from push are dashed, base and trace alike: push is
 * the part this platform doesn't run, so they carry no `pathLength`
 * (a dash draw would wreck the dash) and fade in on the same timeline
 * instead (mob-hold.css §2); the tour fades their trace in as its dot
 * rides it.
 *
 * A CARD reads its part from the frame (mob-hold.css §2): at rest a
 * hairline; on the step's way a faint electric ring; lit, once the step
 * has arrived, a 2px electric ring and its glyph in electric. Its
 * glyph, its label, and its figure in mono under them (the data
 * module's datum: "83+ routes", "07:00 UTC"). Push is always dashed, in
 * violet, and its figure says "built for yours" in violet (7.10 on
 * white): the one part the page says isn't on this platform. A
 * `.mob-ping` inside each card is the tour's handle for the ring that
 * goes out when a dot reaches it.
 *
 * NOT FOR THE KEYBOARD OR A SCREEN READER. The drawing is aria-hidden
 * and has nothing to press: the caption card beside it names the parts
 * each step talks to in words, #server has every part in full, and the
 * index under the section has the journey. Nothing here is a button.
 *
 * PURE: no hooks, no "use client". The stage renders it with its frame;
 * everything it shows is a function of those props, and the `data-mob-*`
 * attributes are the timeline's handles, never state.
 * ------------------------------------------------------------------ */

const MONO = "font-[family-name:var(--font-geist-mono)] tabular-nums";

export function PartsMap({
  parts,
  frame,
  copy,
  className,
}: {
  parts: readonly PartFace[];
  frame: Frame;
  /** The port's name: "The phone". */
  copy: { phone: string };
  className?: string;
}) {
  return (
    <div aria-hidden className={cn("mob-map relative", className)} style={{ aspectRatio: `${VIEW.w} / ${VIEW.h}` }}>
      <svg
        viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
        fill="none"
        className="mob-map-svg home-draw pointer-events-none absolute inset-0 size-full overflow-visible"
      >
        {EDGE_IDS.map((e) => {
          const dashed = DASHED.has(e);
          return (
            <path
              key={e}
              className={cn("mob-map-edge", dashed && "mob-map-fade")}
              data-mob-edge={e}
              data-route={frame.edges[e] === "route" ? "" : undefined}
              d={edgePath(e)}
              pathLength={dashed ? undefined : 1}
              strokeDasharray={dashed ? DASH : undefined}
            />
          );
        })}
        {EDGE_IDS.map((e) => (
          <path
            key={e}
            id={`mob-e-${e}`}
            className="mob-map-trace"
            data-mob-edge={e}
            data-on={frame.edges[e] === "on" ? "" : undefined}
            d={edgePath(e)}
            strokeDasharray={DASHED.has(e) ? DASH : undefined}
          />
        ))}
        {/* The phone's port: a ring of page stock on the drawing's edge. */}
        <circle className="mob-map-port" cx={PORT.x} cy={PORT.y} r={PORT.r} />
        {/* Two dots: a step's hops overlap, so one may still be landing as the next leaves. */}
        {[0, 1].map((i) => (
          <circle key={i} className="mob-map-dot" data-mob-dot={i} r={DOT_R} cx={0} cy={0} />
        ))}
      </svg>

      {/* "The phone", on end in the gutter beside the port, reading upwards. */}
      <span
        className={cn(
          MONO,
          "mob-map-port-label absolute -translate-x-[calc(100%+6px)] -translate-y-1/2 rotate-180 text-[11px] leading-4 whitespace-nowrap text-pp-muted uppercase [writing-mode:vertical-rl]",
        )}
        style={pinned(PORT.x, PORT.y)}
      >
        {copy.phone}
      </span>

      {parts.map((p) => {
        const none = p.kind === "none";
        return (
          <div
            key={p.id}
            data-mob-part={p.id}
            data-state={frame.parts[p.id]}
            data-kind={p.kind}
            className="mob-card absolute rounded-[12px]"
            style={placed(boxOf(p.id))}
          >
            <span className="mob-ping" />
            {/* The card is its own size container (mob-hold.css §2): too narrow
                for the longest label beside its glyph ("Emails and texts", 101px),
                the glyph steps aside and the label takes the card's width, so no
                label wraps against the card's edges and every card keeps its
                padding above and below. */}
            <span className="mob-card-body flex size-full flex-col justify-center">
              <span className="flex min-w-0 items-center gap-1.5">
                <PartGlyph id={p.id} className="mob-card-glyph" />
                <span className="mob-card-label min-w-0 text-[13px] leading-4 font-medium text-pretty text-pp-ink">
                  {p.label}
                </span>
              </span>
              <span
                className={cn(
                  MONO,
                  "mt-0.5 truncate text-[11px] leading-4",
                  none ? "text-(--home-violet)" : "text-pp-muted",
                )}
              >
                {p.datum}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
