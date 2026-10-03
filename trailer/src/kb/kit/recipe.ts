/**
 * A pearl mesh RECIPE (a CSS stack of `radial-gradient(RX RY at X% Y%, stops…)` pools over a floor
 * colour — palettes.ts PLAN_LIGHTS[id].ground, PRICING_PANEL, STUDIO_PANEL) taken apart into its
 * pools and set flowing exactly as the site does it (components/site/home/mesh-flow.ts +
 * components/site/home/pricing.css "The mesh in motion"): every pool on its own path, sideways on
 * one clock and up-and-down on another, a wave about rest (it leaves rest at full speed and eases
 * into each turn), reaching 16 % of its own width either side and 20 % of its height, with the
 * site's per-pool periods (4–7.4 s) and headings. At t = 0 the pools stack back into the recipe
 * exactly. Pure functions of time; no React.
 */

export type RecipeStop = readonly [u: number, rgb: string, a: number];
export type RecipePool = { rx: number; ry: number; unit: '%' | 'px'; x: number; y: number; stops: RecipeStop[] };
export type Recipe = { pools: RecipePool[]; floor: string };

const POOL = /^radial-gradient\(([\d.]+)(%|px) ([\d.]+)(%|px) at ([\d.]+)% ([\d.]+)%, (.*)\)$/;

function parseStops(s: string): RecipeStop[] {
  const out: RecipeStop[] = [];
  // rgb(r g b / a) p%  |  #rrggbb p%
  const re = /(rgb\((\d+) (\d+) (\d+)(?: \/ ([\d.]+))?\)|#([0-9a-f]{6}))\s+([\d.]+)%/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m[6]) {
      const n = parseInt(m[6], 16);
      out.push([+m[7] / 100, `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`, 1]);
    } else out.push([+m[7] / 100, `${m[2]},${m[3]},${m[4]}`, m[5] === undefined ? 1 : +m[5]]);
  }
  return out;
}

const cache = new Map<string, Recipe>();

/** A recipe's pools, BOTTOM first (paint order), and its floor (the trailing colour, else the last stop's). */
export function parseRecipe(ground: string): Recipe {
  const hit = cache.get(ground);
  if (hit) return hit;
  const pools: RecipePool[] = [];
  let at = 0;
  for (;;) {
    const start = ground.indexOf('radial-gradient(', at);
    if (start < 0) break;
    let depth = 0;
    let end = start + 'radial-gradient'.length;
    for (; end < ground.length; end++) {
      if (ground[end] === '(') depth++;
      else if (ground[end] === ')' && --depth === 0) break;
    }
    const m = ground.slice(start, end + 1).match(POOL);
    if (!m || m[2] !== m[4]) throw new Error(`recipe: a pool it cannot read: ${ground.slice(start, start + 60)}`);
    pools.push({ rx: +m[1], ry: +m[3], unit: m[2] as '%' | 'px', x: +m[5], y: +m[6], stops: parseStops(m[7]) });
    at = end + 1;
  }
  if (!pools.length) throw new Error('recipe: no pools');
  const tail = ground.match(/, (#[0-9a-f]{6})\s*$/i)?.[1];
  const last = pools[pools.length - 1].stops.at(-1);
  const floor = tail ?? (last ? `rgb(${last[1]})` : '#ffffff');
  const r = { pools: pools.reverse(), floor };
  cache.set(ground, r);
  return r;
}

/** pricing.css nth-child(1…7): [fx s, fy s, x heading, y heading] (normal = +1, reverse = −1) */
const FLOW: readonly (readonly [number, number, number, number])[] = [
  [4, 5.3, 1, -1],
  [5, 4.3, -1, -1],
  [5.9, 6.4, 1, 1],
  [4.5, 5.6, -1, 1],
  [6.6, 4.6, 1, -1],
  [5.4, 7.4, -1, 1],
  [7.2, 6.1, 1, -1],
];

export type RecipePoolAt = { x: number; y: number; rx: number; ry: number; color: string; a: number; stops: RecipeStop[] };

/**
 * The recipe's pools in frame px at time t (30 fps frames). `drift` × the site's reach. The site
 * numbers its pools top first (CSS order): pool k of the CSS list takes nth-child(k + 1)'s clocks.
 */
export function recipeAt(r: Recipe, t: number, W: number, H: number, drift = 1): { floor: string; pools: RecipePoolAt[] } {
  const n = r.pools.length;
  const sec = t / 30;
  return {
    floor: r.floor,
    pools: r.pools.map((p, i) => {
      const cssIndex = n - 1 - i;
      const [fx, fy, hx, hy] = FLOW[cssIndex % FLOW.length];
      const rx = p.unit === '%' ? (p.rx / 100) * W : p.rx;
      const ry = p.unit === '%' ? (p.ry / 100) * H : p.ry;
      const x = (p.x / 100) * W + hx * 0.16 * 2 * rx * drift * Math.sin((2 * Math.PI * sec) / fx);
      const y = (p.y / 100) * H + hy * 0.2 * 2 * ry * drift * Math.sin((2 * Math.PI * sec) / fy);
      return { x, y, rx, ry, color: '#000000', a: 1, stops: p.stops };
    }),
  };
}
