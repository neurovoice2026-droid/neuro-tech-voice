import type { CSSProperties } from "react";

/* ------------------------------------------------------------------ *
 * A plan card's mesh taken apart into its pools, so each pool can move
 * on its own (pricing.css "The mesh in motion").
 *
 * A mesh recipe (palettes.ts PLAN_LIGHTS, ENTERPRISE_LIGHT) is a stack of
 * `radial-gradient(RX RY at X% Y%, stops…)` pools over a floor colour.
 * Each pool becomes one element the size of its ellipse, placed where the
 * pool sat, painted with the same stops (`closest-side`, so the ellipse
 * fills its box); the stops fall to nothing at the rim, so the element
 * has no edge to show wherever it goes. Laid out at rest, the elements
 * stack back into the recipe exactly.
 *
 * The elements live in the card's mesh clip, CLIP px inside the card, but
 * every position is worked out against the card itself: a share P of the
 * card, measured from the clip, is P of the clip plus (2P − 1)·CLIP px.
 * ------------------------------------------------------------------ */

/** How far inside the card the flowing mesh is clipped, so the card's own lit edge shows around it. */
export const CLIP = 1;

export type MeshPool = {
  rx: number;
  ry: number;
  /** "%" of the card, or "px" for a recipe drawn at a fixed size (Enterprise). */
  unit: "%" | "px";
  /** The centre, in % of the card. */
  x: number;
  y: number;
  /** The colour stops, as written in the recipe. */
  stops: string;
};

const POOL = /^radial-gradient\(([\d.]+)(%|px) ([\d.]+)(%|px) at ([\d.]+)% ([\d.]+)%, (.*)\)$/;

/** A recipe's pools, top first as CSS lists them, and its floor. */
export function meshPools(ground: string): { pools: MeshPool[]; floor: string } {
  const pools: MeshPool[] = [];
  let at = 0;
  for (;;) {
    const start = ground.indexOf("radial-gradient(", at);
    if (start < 0) break;
    let depth = 0;
    let end = start + "radial-gradient".length;
    for (; end < ground.length; end++) {
      if (ground[end] === "(") depth++;
      else if (ground[end] === ")" && --depth === 0) break;
    }
    const m = ground.slice(start, end + 1).match(POOL);
    if (!m || m[2] !== m[4]) throw new Error(`mesh-flow: a pool it cannot read: ${ground.slice(start, start + 60)}`);
    pools.push({ rx: +m[1], ry: +m[3], unit: m[2] as "%" | "px", x: +m[5], y: +m[6], stops: m[7] });
    at = end + 1;
  }
  const floor = ground.match(/, (#[0-9a-f]{6})$/)?.[1];
  if (!floor || !pools.length) throw new Error("mesh-flow: a recipe without pools or a floor");
  return { pools, floor };
}

const num = (n: number) => String(Number(n.toFixed(4)));
/** calc() for `percent` of the card plus `px`, measured from the clip. */
const fromClip = (percent: number, px: number) => {
  const extra = ((2 * percent) / 100) * CLIP + px;
  return `calc(${num(percent)}% ${extra < 0 ? "-" : "+"} ${num(Math.abs(extra))}px)`;
};

/** One pool's element: where it sits at rest and what it paints. */
export function poolStyle(p: MeshPool): CSSProperties {
  const [w, h] = [2 * p.rx, 2 * p.ry];
  const background = `radial-gradient(closest-side, ${p.stops})`;
  if (p.unit === "px") {
    return {
      left: fromClip(p.x, -CLIP - p.rx),
      top: fromClip(p.y, -CLIP - p.ry),
      width: `${num(w)}px`,
      height: `${num(h)}px`,
      background,
    };
  }
  return {
    left: fromClip(p.x - p.rx, -CLIP),
    top: fromClip(p.y - p.ry, -CLIP),
    width: fromClip(w, 0),
    height: fromClip(h, 0),
    background,
  };
}

/** Every pool's element, bottom first: in DOM order the top pool paints last. */
export function meshBlobs(ground: string): CSSProperties[] {
  return meshPools(ground).pools.map(poolStyle).reverse();
}
