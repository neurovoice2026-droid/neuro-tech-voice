import type { EdgeId, LayerId, PartId } from "@/lib/pages/custom-saas-platforms";

/* ------------------------------------------------------------------ *
 * #platform — the drawing's geometry: where each of the seventeen parts
 * sits, and the path every connection takes between two of them.
 *
 * ONE COORDINATE SYSTEM. The drawing is a 1000×490 box in user units
 * (u). MapView lays an <svg viewBox="0 0 1000 490"> and the HTML cards
 * over the same aspect-ratio box, a card's left/top/width/height being
 * its box here as percentages, so the SVG's lines and the HTML's cards
 * meet exactly at every width the map is shown at (xl, where the stage's
 * inner width is 1112px: a card is 156×49px, and 1u is 1.112px).
 *
 * THE COLUMNS read left to right as a request travels: the people who
 * start something (80), the way in that meets them — phone and web (245),
 * the app on Vercel (410 and 575), the live-call gateway and the
 * database (740), and the providers and services at the far edge (905).
 * The five rows keep the phone call along the top (y 130, with Cartesia
 * above and ElevenLabs below it) and the business's browser, the API
 * and the services along the bottom (y 370), so the two lenses a buyer
 * cares most about — the sign-up and the call — each read as one line.
 *
 * THE EDGES are orthogonal polylines. Each starts on its first-named
 * part's card border and ends on its second's (`"stripe-api"` leaves
 * Stripe's bottom and lands on the API's top), which is also the
 * direction a hop travels unless the lens says `reverse`. Where two
 * edges share a trunk (api-smartbill and api-google) they share it
 * exactly, so the drawing shows one line splitting, not two lines side
 * by side. Every edge was checked by a collision script against every
 * card it doesn't connect — sampled at each 1% of every segment, no
 * point comes within 4u of a card's box, and nothing drops below
 * VIEW.h − 10 (lib/pages/custom-saas-platforms.test.ts holds all three).
 *
 * `edgePath` turns a polyline into an SVG `d` with 10u rounded corners
 * (a `Q` at every bend), each corner clamped so it never eats more than
 * half of a segment it shares with another corner. DrawSVG and
 * MotionPath measure the path in these same units, which is why the
 * paths carry no `vector-effect`.
 *
 * PURE: no React, no DOM, types only from the data module. The page's
 * test imports it under vitest, and the explorer, the timeline and the
 * two views all read the same numbers.
 * ------------------------------------------------------------------ */

export type Point = readonly [x: number, y: number];

/** The drawing's box, in user units. */
export const VIEW = { w: 1000, h: 490 } as const;
/** Every card's box, centred on its PLACE. */
export const CARD = { w: 140, h: 44 } as const;
/** The corner radius of every bend in an edge. */
export const RADIUS = 10;

/** Each card's centre. */
export const PLACE: Record<PartId, Point> = {
  caller: [80, 130],
  customer: [80, 370],
  twilio: [245, 130],
  proxy: [245, 370],
  router: [410, 130],
  dashboard: [410, 290],
  cron: [410, 450],
  api: [575, 370],
  workflows: [575, 450],
  gateway: [740, 130],
  supabase: [740, 370],
  cartesia: [905, 50],
  openai: [905, 130],
  elevenlabs: [905, 210],
  stripe: [905, 290],
  smartbill: [905, 370],
  google: [905, 450],
};

/** Each connection, from its first-named part's border to its second's. */
export const EDGES: Record<EdgeId, readonly Point[]> = {
  "caller-twilio": [
    [150, 130],
    [175, 130],
  ],
  "twilio-router": [
    [315, 130],
    [340, 130],
  ],
  "router-gateway": [
    [480, 130],
    [670, 130],
  ],
  "gateway-openai": [
    [810, 130],
    [835, 130],
  ],
  "gateway-cartesia": [
    [740, 108],
    [740, 50],
    [835, 50],
  ],
  "gateway-elevenlabs": [
    [760, 152],
    [760, 210],
    [835, 210],
  ],
  "customer-proxy": [
    [150, 370],
    [175, 370],
  ],
  "proxy-dashboard": [
    [245, 348],
    [245, 290],
    [340, 290],
  ],
  "proxy-api": [
    [315, 370],
    [505, 370],
  ],
  "dashboard-stripe": [
    [480, 290],
    [835, 290],
  ],
  "stripe-api": [
    [905, 312],
    [905, 334],
    [620, 334],
    [620, 348],
  ],
  "api-supabase": [
    [645, 370],
    [670, 370],
  ],
  "api-smartbill": [
    [612, 392],
    [612, 412],
    [895, 412],
    [895, 392],
  ],
  "api-google": [
    [612, 392],
    [612, 412],
    [895, 412],
    [895, 428],
  ],
  "api-workflows": [
    [560, 392],
    [560, 428],
  ],
  "workflows-google": [
    [645, 450],
    [835, 450],
  ],
  "twilio-api": [
    [260, 152],
    [260, 250],
    [545, 250],
    [545, 348],
  ],
  "router-elevenlabs": [
    [430, 152],
    [430, 172],
    [885, 172],
    [885, 188],
  ],
  "cron-api": [
    [430, 428],
    [430, 408],
    [530, 408],
    [530, 392],
  ],
  "gateway-api": [
    [690, 152],
    [690, 322],
    [600, 322],
    [600, 348],
  ],
};

/** Every edge id, in the order the drawing lays them (and the draw walks them). */
export const EDGE_IDS = Object.keys(EDGES) as EdgeId[];

/** The layers, top to bottom, and their parts in reading order: the stacked composition's bands. */
export const LAYER_ORDER: Record<LayerId, readonly PartId[]> = {
  people: ["caller", "customer"],
  edge: ["twilio", "proxy"],
  app: ["router", "dashboard", "api", "workflows", "cron"],
  calls: ["gateway", "cartesia", "openai", "elevenlabs"],
  services: ["supabase", "stripe", "smartbill", "google"],
};

/** The layers in band order. */
export const LAYERS = Object.keys(LAYER_ORDER) as LayerId[];

/** Each part's layer, read back from LAYER_ORDER so the two can never disagree. */
export const LAYER_OF = Object.fromEntries(
  LAYERS.flatMap((layer) => LAYER_ORDER[layer].map((id) => [id, layer] as const)),
) as Record<PartId, LayerId>;

/** An edge's two parts, in its direction of travel. Part ids never contain "-". */
export function endsOf(edge: EdgeId): readonly [from: PartId, to: PartId] {
  const [from, to] = edge.split("-") as [PartId, PartId];
  return [from, to];
}

/** A card's box as percentages of the drawing: how MapView places the HTML card over the SVG. */
export function cardBox(id: PartId) {
  const [x, y] = PLACE[id];
  const pct = (n: number) => `${Number(n.toFixed(4))}%`;
  return {
    left: pct(((x - CARD.w / 2) / VIEW.w) * 100),
    top: pct(((y - CARD.h / 2) / VIEW.h) * 100),
    width: pct((CARD.w / VIEW.w) * 100),
    height: pct((CARD.h / VIEW.h) * 100),
  };
}

const num = (n: number) => String(Number(n.toFixed(2)));

/**
 * An SVG `d` for a polyline, its bends rounded to RADIUS with a `Q` whose
 * control point is the corner itself. A corner may take the whole of an
 * end segment but only half of a segment it shares with another corner,
 * so two bends close together never overlap.
 */
export function edgePath(points: readonly Point[]): string {
  const n = points.length - 1;
  if (n < 1) return "";
  const len = (a: Point, b: Point) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const toward = (from: Point, to: Point, d: number): Point => {
    const l = len(from, to) || 1;
    return [from[0] + ((to[0] - from[0]) * d) / l, from[1] + ((to[1] - from[1]) * d) / l];
  };
  let d = `M${num(points[0][0])} ${num(points[0][1])}`;
  for (let i = 1; i < n; i++) {
    const [prev, at, next] = [points[i - 1], points[i], points[i + 1]];
    const before = i - 1 === 0 ? len(prev, at) : len(prev, at) / 2;
    const after = i + 1 === n ? len(at, next) : len(at, next) / 2;
    const r = Math.min(RADIUS, before, after);
    const a = toward(at, prev, r);
    const b = toward(at, next, r);
    d += ` L${num(a[0])} ${num(a[1])} Q${num(at[0])} ${num(at[1])} ${num(b[0])} ${num(b[1])}`;
  }
  d += ` L${num(points[n][0])} ${num(points[n][1])}`;
  return d;
}
