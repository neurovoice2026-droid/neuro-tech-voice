/* ------------------------------------------------------------------ *
 * Text contrast on a gradient mesh, still and flowing: the maths
 * lib/pages/home.test.ts uses for the #pricing plan cards, lifted into a
 * pure module so a page's own test can hold its meshes to the same bar
 * (lib/pages/custom-saas-platforms.test.ts). home.test.ts keeps its own
 * copy, untouched; the formulas are the same line for line, so a figure
 * measured here matches the one it would measure there.
 *
 * A mesh recipe is a stack of pools over a floor, as CSS paints it:
 *
 *   radial-gradient(RX RY at X% Y%, rgb(R G B / A) P%, …), …, #floor
 *
 * RX and RY are a share of the box (%) or a fixed size (px). A point's
 * colour is the floor with each pool composited over it, from the last
 * listed (bottom) to the first (top), each at the alpha its stops give
 * at that point's distance along the pool's ray.
 *
 * Still (`worstStatic`): the lowest contrast a text colour makes anywhere
 * in a box's content area (`inset` px in from every edge, 24 by default,
 * the cards' padding), over every size the surface renders at.
 *
 * Flowing (`worstMoving`): the mesh in motion (home/mesh-flow.ts, the
 * `*-flow-x` / `*-flow-y` keyframes) moves each pool on its own, sideways
 * by up to `reach.x` of its own width and up and down by `reach.y` of its
 * height, on clocks that never line up. So any pool can be anywhere in its
 * reach while the others are anywhere in theirs, and a dark text colour is
 * held against the darkest the box can get: at every sampled point, each
 * pool at rest and at the least and the most it can put there over its
 * reach, in every combination (`darkestLum`). Dark text on a light mesh
 * only: `worstMoving` throws when the text is not darker than every point
 * it could sit on, where the ratio below would mean nothing.
 *
 * A plain radial panel (`radialAt`, `worstInZone`): a single
 * `radial-gradient(RX% RY% at X% Y%, #hex P%, …)` of opaque stops, such
 * as the landing's deep panel (palettes.ts DEEP_PANEL), sampled only
 * inside the zone of the panel a colour is allowed in.
 *
 * WCAG 2 relative luminance and contrast. No DOM, no vitest: every
 * function is pure (the one cache only remembers a walk's answer) and
 * every parse throws on a recipe it cannot read, so a test can never pass
 * by reading nothing.
 * ------------------------------------------------------------------ */

export type Rgb = [number, number, number];

/** `#rrggbb` → [r, g, b]. */
export const rgb = (hex: string): Rgb => {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error(`mesh-contrast: not a #rrggbb colour: ${hex}`);
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
};

/** `fg` at alpha `a` composited over `bg`. */
export const over = (fg: Rgb, a: number, bg: Rgb): Rgb => fg.map((c, i) => c * a + bg[i] * (1 - a)) as Rgb;

const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** WCAG 2 relative luminance. */
export const lum = ([r, g, b]: Rgb) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

/** WCAG 2 contrast ratio, lighter over darker, whichever way round they are passed. */
export const contrast = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/* ─── A mesh recipe ─────────────────────────────────────────────────── */

export type MeshPool = {
  rx: readonly [number, "%" | "px"];
  ry: readonly [number, "%" | "px"];
  /** The centre, in % of the box. */
  x: number;
  y: number;
  stops: { c: Rgb; a: number; p: number }[];
};

const POOL =
  /radial-gradient\(([\d.]+)(%|px) ([\d.]+)(%|px) at ([\d.]+)% ([\d.]+)%, ((?:rgb\(\d+ \d+ \d+ \/ [\d.]+\) \d+%(?:, )?)+)\)/g;
const STOP = /rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\) (\d+)%/g;

/** A recipe's pools, top first as CSS lists them, and its floor. */
export function parseMesh(ground: string): { pools: MeshPool[]; floor: Rgb } {
  const pools = [...ground.matchAll(POOL)].map((m) => ({
    rx: [Number(m[1]), m[2] as "%" | "px"] as const,
    ry: [Number(m[3]), m[4] as "%" | "px"] as const,
    x: Number(m[5]),
    y: Number(m[6]),
    stops: [...m[7].matchAll(STOP)].map((st) => ({
      c: [Number(st[1]), Number(st[2]), Number(st[3])] as Rgb,
      a: Number(st[4]),
      p: Number(st[5]),
    })),
  }));
  const floor = ground.match(/, (#[0-9a-f]{6})$/)?.[1];
  // Every pool the recipe lists must have been read, or a figure would be measured over less than CSS paints.
  if (!floor || !pools.length || pools.length !== (ground.match(/radial-gradient\(/g) ?? []).length) {
    throw new Error(`mesh-contrast: a recipe it cannot read: ${ground.slice(0, 80)}…`);
  }
  return { pools, floor: rgb(floor) };
}

/** A pool's alpha at `t`% along its ray, interpolated between its stops. */
export function alphaAt(stops: { a: number; p: number }[], t: number): number {
  if (t <= stops[0].p) return stops[0].a;
  for (let k = 0; k < stops.length - 1; k++) {
    const [s0, s1] = [stops[k], stops[k + 1]];
    if (t <= s1.p) return s0.a + ((s1.a - s0.a) * (t - s0.p)) / (s1.p - s0.p);
  }
  return stops[stops.length - 1].a;
}

/** A pool's radii on a W × H box, in px. */
const radiiOf = (p: MeshPool, W: number, H: number) => [
  p.rx[1] === "px" ? p.rx[0] : (p.rx[0] / 100) * W,
  p.ry[1] === "px" ? p.ry[0] : (p.ry[0] / 100) * H,
];

/** The colour CSS paints at (px, py) of a W × H box: the floor, then every pool bottom-up. */
export function colourAt(mesh: ReturnType<typeof parseMesh>, px: number, py: number, W: number, H: number): Rgb {
  let out = mesh.floor;
  for (let k = mesh.pools.length - 1; k >= 0; k--) {
    const p = mesh.pools[k];
    const [rx, ry] = radiiOf(p, W, H);
    const t = Math.hypot((px - (p.x / 100) * W) / rx, (py - (p.y / 100) * H) / ry) * 100;
    const a = alphaAt(p.stops, t);
    if (a > 0) out = over(p.stops[0].c, a, out);
  }
  return out;
}

/** The lowest contrast `fg` makes anywhere in each box's content area, the mesh at rest (a 41 × 81 grid). */
export function worstStatic(ground: string, fg: string, boxes: readonly [number, number][], inset = 24): number {
  const mesh = parseMesh(ground);
  const text = rgb(fg);
  let min = Infinity;
  for (const [W, H] of boxes) {
    for (let i = 0; i <= 40; i++) {
      for (let j = 0; j <= 80; j++) {
        const px = inset + ((W - 2 * inset) * i) / 40;
        const py = inset + ((H - 2 * inset) * j) / 80;
        min = Math.min(min, contrast(text, colourAt(mesh, px, py, W, H)));
      }
    }
  }
  return min;
}

/* ─── The mesh in motion ────────────────────────────────────────────── */

/** A keyframes block's body, `@keyframes name {` up to its closing brace at the start of a line. */
export function keyframesBody(css: string, name: string): string {
  const at = css.indexOf(`@keyframes ${name} {`);
  if (at < 0) throw new Error(`mesh-contrast: no @keyframes ${name}`);
  return css.slice(at + `@keyframes ${name} {`.length, css.indexOf("\n}", at));
}

/**
 * How far the flow carries a pool, as a share of its own size: the largest
 * `translate: X% 0` in the sideways keyframes and the largest
 * `transform: translate3d(0, Y%, 0)` in the up-and-down ones.
 */
export function flowReach(css: string, xName: string, yName: string): { x: number; y: number } {
  const most = (body: string, re: RegExp) => {
    const values = [...body.matchAll(re)].map((m) => Math.abs(Number(m[1])) / 100);
    if (!values.length) throw new Error("mesh-contrast: a flow keyframes block with no offsets");
    return Math.max(...values);
  };
  return {
    x: most(keyframesBody(css, xName), /translate: (-?[\d.]+)%? 0;/g),
    y: most(keyframesBody(css, yName), /transform: translate3d\(0, (-?[\d.]+)%, 0\);/g),
  };
}

// The walk below is the costly part and depends only on the mesh, never on
// the text colour: remembered per recipe, box set, reach and inset, so
// asking it for four tokens costs one walk (home.test.ts's `darkest` map).
const darkest = new Map<string, number>();

/** The lowest luminance anywhere in each box's content area, wherever its pools can be (a 13 × 25 grid). */
export function darkestLum(
  ground: string,
  boxes: readonly [number, number][],
  reach: { x: number; y: number },
  inset = 24,
): number {
  const key = JSON.stringify([ground, boxes, reach, inset]);
  const known = darkest.get(key);
  if (known !== undefined) return known;
  const mesh = parseMesh(ground);
  const bottomUp = [...mesh.pools].reverse();
  let min = Infinity;
  for (const [W, H] of boxes) {
    for (let i = 0; i <= 12; i++) {
      for (let j = 0; j <= 24; j++) {
        const px = inset + ((W - 2 * inset) * i) / 12;
        const py = inset + ((H - 2 * inset) * j) / 24;
        // What each pool can put here: at rest, and the least and the most over its reach.
        const options = bottomUp.map((p) => {
          const [rw, rh] = radiiOf(p, W, H);
          const [cx, cy] = [(p.x / 100) * W, (p.y / 100) * H];
          const alphas: number[] = [];
          for (const fx of [-1, -0.5, 0, 0.5, 1]) {
            for (const fy of [-1, -0.5, 0, 0.5, 1]) {
              const [ox, oy] = [fx * reach.x * 2 * rw, fy * reach.y * 2 * rh];
              alphas.push(alphaAt(p.stops, Math.hypot((px - cx - ox) / rw, (py - cy - oy) / rh) * 100));
            }
          }
          return [...new Set([alphas[12], Math.min(...alphas), Math.max(...alphas)])];
        });
        const walk = (n: number, below: Rgb) => {
          if (n === bottomUp.length) {
            min = Math.min(min, lum(below));
            return;
          }
          for (const a of options[n]) walk(n + 1, a > 0 ? over(bottomUp[n].stops[0].c, a, below) : below);
        };
        walk(0, mesh.floor);
      }
    }
  }
  darkest.set(key, min);
  return min;
}

/** The lowest contrast a dark `fg` makes against the darkest its boxes can get while the mesh flows. */
export function worstMoving(
  ground: string,
  fg: string,
  boxes: readonly [number, number][],
  reach: { x: number; y: number },
  inset = 24,
): number {
  const f = lum(rgb(fg));
  const bg = darkestLum(ground, boxes, reach, inset);
  if (f >= bg) throw new Error(`mesh-contrast: ${fg} is not darker than every point of its mesh`);
  return (bg + 0.05) / (f + 0.05);
}

/* ─── A plain radial panel ──────────────────────────────────────────── */

const RADIAL = /^radial-gradient\(([\d.]+)% ([\d.]+)% at ([\d.]+)% ([\d.]+)%, ((?:#[0-9a-f]{6} [\d.]+%(?:, )?)+)\)$/;

/** The colour of a single radial gradient of opaque `#hex P%` stops at (x, y) of a W × H panel. */
export function radialAt(gradient: string, x: number, y: number, W: number, H: number): Rgb {
  const m = gradient.match(RADIAL);
  if (!m) throw new Error(`mesh-contrast: a panel it cannot read: ${gradient.slice(0, 80)}…`);
  const [rx, ry, cx, cy] = [m[1], m[2], m[3], m[4]].map(Number);
  const stops = [...m[5].matchAll(/(#[0-9a-f]{6}) ([\d.]+)%/g)].map((s) => ({ c: rgb(s[1]), p: Number(s[2]) }));
  const t = Math.hypot((x - (cx / 100) * W) / ((rx / 100) * W), (y - (cy / 100) * H) / ((ry / 100) * H)) * 100;
  if (t <= stops[0].p) return stops[0].c;
  for (let k = 0; k < stops.length - 1; k++) {
    const [s0, s1] = [stops[k], stops[k + 1]];
    if (t <= s1.p) {
      const f = (t - s0.p) / (s1.p - s0.p);
      return s0.c.map((v, i) => v + (s1.c[i] - v) * f) as Rgb;
    }
  }
  return stops[stops.length - 1].c;
}

/**
 * The lowest contrast `fg` makes inside a zone of the panel, over every
 * size the panel renders at. `zone` is [x0, y0, x1, y1] in fractions of
 * the panel ([0, 0, 1, 1] is anywhere), sampled on a 41 × 41 grid.
 */
export function worstInZone(
  gradient: string,
  fg: string,
  boxes: readonly [number, number][],
  zone: readonly [number, number, number, number],
): number {
  const text = rgb(fg);
  const [x0, y0, x1, y1] = zone;
  let min = Infinity;
  for (const [W, H] of boxes) {
    for (let i = 0; i <= 40; i++) {
      for (let j = 0; j <= 40; j++) {
        const x = (x0 + ((x1 - x0) * i) / 40) * W;
        const y = (y0 + ((y1 - y0) * j) / 40) * H;
        min = Math.min(min, contrast(text, radialAt(gradient, x, y, W, H)));
      }
    }
  }
  return min;
}
