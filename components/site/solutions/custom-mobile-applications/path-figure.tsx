import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { TYPE } from "@/components/site/home/type";
import type { GateMark, PathData, Platform, StationId } from "@/lib/pages/custom-mobile-applications";

/* ------------------------------------------------------------------ *
 * #path — the path, drawn (lg and up): one line from a prototype to
 * both stores, forked where the two platforms go their own ways and
 * joined again for the updates.
 *
 *   · THE STEM runs from the prototype through the design and the
 *     build: one app, one server, one team.
 *   · THE FORK. After the build the line splits in two lanes, iOS above
 *     and Android below, each with its own beta (TestFlight, a testing
 *     track), its own store's review and its own store.
 *   · THE JOIN. The lanes meet again for the updates, which go the same
 *     way every time.
 *   · THE GATES. Three places the build waits for a yes: yours, after
 *     the designs; your testers', after each beta; and each store's,
 *     drawn as the review station itself. Each gate is two posts with an
 *     arm hung from each, and its arms stand open: the finished frame is
 *     a path walked, every gate passed.
 *
 * THE GEOMETRY. An SVG on a 1000 × 180 plane, in a box of the same
 * aspect (1176 × 212 at xl, 944 × 170 at 1024), with every word in HTML
 * over it, placed in shares of the box, so the labels keep their type
 * size while the drawing scales. Each station stands at its `at` from
 * the data module (x = 1000 · at): the stations and the gates are read,
 * never retyped, and the test holds the data's places to the strokes
 * below. The stem is y 90 from x 20 to 480; the fork, two cubics to
 * (540, 40) and (540, 140); the lanes, level to 900; the join, two
 * cubics back to (950, 90), and the stem again to 990. Stations are
 * white discs with an electric ring; the review is a gate on each lane.
 * The lane words sit above the iOS lane and under the Android lane, the
 * stem's under the stem, a forked station's own name between its two
 * lanes (the stage both are in: "Beta" between TestFlight and the
 * testing track), and the gates' own words above theirs, in violet.
 *
 * THE COLOURS ARE THE WASH BAND'S (spec §5.3): the line and the rings
 * electric (5.21 on the wash, marks), the gates and their words violet
 * (6.49), every other word muted (5.82), in mono at 11px.
 *
 * IT DRAWS ON ITS OWN PASSAGE UP THE SCREEN (mob-path.css §1): the
 * box's view timeline, `--mob-path`, and one window on it, from 4% into
 * the box's pass for 32% of it. Each piece takes its slice of that
 * window (`--o` where it starts, `--s` how much it takes, inline): the
 * stem, then the fork and both lanes, then the join and the end, each
 * drawn with home.css's `home-draw`; each station pops (mob.css
 * `mob-pop`) as the line reaches it, its words fading in with it
 * (`mob-fade-in`); each gate's arms swing open (`mob-gate-l`,
 * `mob-gate-r`) after the line has passed its posts. The stations'
 * slices are `SLICES` below, which the data module's test reads and
 * holds to the strokes' timing: a station pops within a slice's width of
 * the moment its stroke reaches it, in the stations' order. Wherever
 * none of that runs — reduced motion, the lite, still and weak tiers,
 * any browser without view timelines — the markup is the finished
 * frame: the path whole, every station and word shown, the gates open.
 *
 * PURE and aria-hidden: the list beside it (path.tsx) carries every
 * station, lane and gate in words at every width, and is what a screen
 * reader reads here too.
 * ------------------------------------------------------------------ */

/** Where each station pops, as a share of the window: as its stroke reaches it (the test holds these to the strokes). */
// prettier-ignore
const SLICES = {
  prototype: 0.02,
  design: 0.13,
  build: 0.26,
  beta: 0.42,
  review: 0.62,
  live: 0.72,
  updates: 0.88,
} as const satisfies Record<StationId, number>;

/** How long a station takes to pop, and its words to fade in. */
const POP = 0.05;

/** Each stroke's slice, [o, s]: the stem to the fork, the fork and both lanes, the join and the end. */
const STROKES = { stem: [0, 0.3], lanes: [0.3, 0.45], join: [0.75, 0.15] } as const;

/**
 * Each gate's slice, [o, s]: yours and your testers' open just after the
 * line has passed their posts; the stores' review is its station, and
 * opens as that station pops.
 */
const GATE_SLICES: Record<GateMark["id"], readonly [number, number]> = {
  yes: [0.2, 0.06],
  testers: [0.53, 0.06],
  review: [SLICES.review, POP],
};

/** The plane, and the rows everything stands on. */
const VIEW = { w: 1000, h: 180 } as const;
const Y = { stem: 90, ios: 40, android: 140 } as const;
/** Label rows' centres: above the iOS lane, above the stem (a gate's words), under the stem, under the Android lane. */
const ROW = { ios: 16, gate: 63, stem: 112, android: 164 } as const;
/** Where the stem starts and ends, the fork and join's ends, and where the lanes run level. */
const X = { start: 20, fork: 480, lane: 540, laneEnd: 900, join: 950, end: 990 } as const;
/** The lane names stand by the fork. */
const LANE_NAME_X = 505;
/** A station's disc; a gate's posts, their distance from the line, and its arms. */
const DISC = 6;
const POST = 3;
const REACH = 12;
const LINE = 1.8;

const LANE_Y: Record<Platform, number> = { ios: Y.ios, android: Y.android };
const LANE_ROW: Record<Platform, number> = { ios: ROW.ios, android: ROW.android };
const PLATFORMS: readonly Platform[] = ["ios", "android"];

/** When a piece draws, as a share of the window: from `o`, for `s`. Read by mob-path.css §1. */
function at(o: number, s: number) {
  return { "--o": o, "--s": s } as CSSProperties;
}

const stroke = { stroke: "currentColor", strokeWidth: LINE, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" } as const;

/** A word over the plane, centred on (x, y) unless it hangs from the stem's ends. */
function Label({
  x,
  y,
  o,
  align = "center",
  tone = "muted",
  children,
}: {
  x: number;
  y: number;
  o: number;
  align?: "start" | "center" | "end";
  tone?: "muted" | "gate";
  children: string;
}) {
  return (
    <span
      className={cn(
        TYPE.mono,
        "mob-path-label absolute -translate-y-1/2 text-[11px] leading-4 whitespace-nowrap",
        align === "center" && "-translate-x-1/2",
        align === "end" && "-translate-x-full",
        tone === "gate" ? "text-(--home-violet)" : "text-pp-muted",
      )}
      style={{ left: `${(x / VIEW.w) * 100}%`, top: `${(y / VIEW.h) * 100}%`, ...at(o, POP) }}
    >
      {children}
    </span>
  );
}

/**
 * A gate across the line at (x, y): a post either side of it, and an arm
 * hung from each that meets the other's across the line when closed. At
 * rest the arms stand open, 55° towards the way the line goes
 * (mob-path.css §1); the open is the animation's far end.
 */
function Gate({ x, y, o, s }: { x: number; y: number; o: number; s: number }) {
  return (
    <g className="text-(--home-violet)">
      <path d={`M${x} ${y - REACH} V${y}`} className="mob-path-arm" data-arm="l" style={at(o, s)} {...stroke} strokeWidth={2} />
      <path d={`M${x} ${y} V${y + REACH}`} className="mob-path-arm" data-arm="r" style={at(o, s)} {...stroke} strokeWidth={2} />
      <circle cx={x} cy={y - REACH} r={POST} fill="currentColor" className="mob-path-pop" style={at(o, s)} />
      <circle cx={x} cy={y + REACH} r={POST} fill="currentColor" className="mob-path-pop" style={at(o, s)} />
    </g>
  );
}

function Disc({ x, y, o }: { x: number; y: number; o: number }) {
  return (
    <circle
      cx={x}
      cy={y}
      r={DISC}
      fill="#fff"
      stroke="currentColor"
      strokeWidth={2}
      className="mob-path-pop mob-path-stop"
      style={at(o, POP)}
    />
  );
}

export function PathFigure({ path, className }: { path: PathData["path"]; className?: string }) {
  const stations = path.stations;
  const xOf = (a: number) => a * VIEW.w;
  // The review gate is drawn as its station: a gate whose place is its station's.
  const drawnAsStation = (g: GateMark) => stations.some((s) => s.id === g.after && s.at === g.at);
  const standalone = path.gates.filter((g) => !drawnAsStation(g));
  const forked = stations.filter((s) => s.lanes);
  const stem = stations.filter((s) => !s.lanes);
  const first = stem[0];
  const last = stem[stem.length - 1];

  return (
    <div aria-hidden className={cn("mob-path-fig relative aspect-[1000/180]", className)}>
      <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="absolute inset-0 size-full overflow-visible">
        {/* The line: the stem, the fork and both lanes, the join and the end. */}
        <g className="text-(--home-electric)">
          <path d={`M${X.start} ${Y.stem} H${X.fork}`} pathLength={1} className="mob-path-draw" style={at(...STROKES.stem)} {...stroke} />
          {PLATFORMS.map((p) => {
            const y = LANE_Y[p];
            const mid = (X.fork + X.lane) / 2;
            const back = (X.laneEnd + X.join) / 2;
            return (
              <g key={p}>
                <path
                  d={`M${X.fork} ${Y.stem} C${mid} ${Y.stem} ${mid} ${y} ${X.lane} ${y} H${X.laneEnd}`}
                  pathLength={1} className="mob-path-draw"
                  style={at(...STROKES.lanes)}
                  {...stroke}
                />
                <path
                  d={`M${X.laneEnd} ${y} C${back} ${y} ${back} ${Y.stem} ${X.join} ${Y.stem} H${X.end}`}
                  pathLength={1} className="mob-path-draw"
                  style={at(...STROKES.join)}
                  {...stroke}
                />
              </g>
            );
          })}

          {/* The stations on the stem, and those on each lane, but the review: that one is a gate. */}
          {stem.map((s) => (
            <Disc key={s.id} x={xOf(s.at)} y={Y.stem} o={SLICES[s.id]} />
          ))}
          {forked.flatMap((s) =>
            path.gates.some((g) => g.after === s.id && drawnAsStation(g))
              ? []
              : PLATFORMS.map((p) => <Disc key={`${s.id}-${p}`} x={xOf(s.at)} y={LANE_Y[p]} o={SLICES[s.id]} />),
          )}
        </g>

        {/* The gates: yours on the stem, your testers' on each lane after the beta, and each store's review. */}
        {path.gates.map((g) => {
          const [o, s] = GATE_SLICES[g.id];
          return stations.find((st) => st.id === g.after)?.lanes ? (
            PLATFORMS.map((p) => <Gate key={`${g.id}-${p}`} x={xOf(g.at)} y={LANE_Y[p]} o={o} s={s} />)
          ) : (
            <Gate key={g.id} x={xOf(g.at)} y={Y.stem} o={o} s={s} />
          );
        })}
      </svg>

      {/* The stem's words: the first from its start, the last to its end, the rest centred on their stations. */}
      {stem.map((s) => (
        <Label
          key={s.id}
          x={s === first ? X.start + 4 : s === last ? X.end : xOf(s.at)}
          y={ROW.stem}
          o={SLICES[s.id]}
          align={s === first ? "start" : s === last ? "end" : "center"}
        >
          {s.label}
        </Label>
      ))}
      {/* Each lane's name by the fork, its words for each station on it, and each forked station's own name between the lanes. */}
      {PLATFORMS.map((p) => (
        <Label key={p} x={LANE_NAME_X} y={LANE_ROW[p]} o={STROKES.lanes[0]}>
          {path.lanes[p]}
        </Label>
      ))}
      {forked.flatMap((s) => [
        ...PLATFORMS.map((p) => (
          <Label key={`${s.id}-${p}`} x={xOf(s.at)} y={LANE_ROW[p]} o={SLICES[s.id]}>
            {s.lanes![p]}
          </Label>
        )),
        // The stage both lanes are in, between them, where the stem would run.
        <Label key={s.id} x={xOf(s.at)} y={Y.stem} o={SLICES[s.id]}>
          {s.label}
        </Label>,
      ])}
      {/* A gate's own words: over the stem, or over the iOS lane (the Android lane's gate is the same one). */}
      {standalone.map((g) => {
        const onLanes = stations.find((st) => st.id === g.after)?.lanes;
        return (
          <Label key={g.id} x={xOf(g.at)} y={onLanes ? ROW.ios : ROW.gate} o={GATE_SLICES[g.id][0]} tone="gate">
            {g.label}
          </Label>
        );
      })}
    </div>
  );
}
