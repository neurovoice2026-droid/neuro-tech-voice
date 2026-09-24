/* ------------------------------------------------------------------ *
 * /solutions/custom-saas-platforms — the page's pearl lights, for the
 * code that cannot read a CSS variable: the server page, which takes each
 * light apart into its pools (home/mesh-flow.ts `meshBlobs`) and hands
 * the pools to `LiveMesh` as plain props, and the test, which composites
 * every text colour over every light.
 *
 * Five lit surfaces, in the #pricing plan-card grammar (palettes.ts
 * PLAN_LIGHTS): each is a stack of soft pools, every pool a seven-stop
 * gaussian (alpha × 1, .835, .576, .325, .149, .056, 0 at 0/20/35/50/65/
 * 80/100%) so no pool ever shows an edge, under a white sheen at the top,
 * over a pale floor.
 *
 *   room          the hero's room: the landing's climb (aqua → sky →
 *                 lilac → blush → champagne → mint) in one surface
 *   roomMirror    the scope room, the hero's room turned left for right
 *   papers        the credentials card: lilac, champagne, pink pearl,
 *                 periwinkle and cream, in px radii like ENTERPRISE_LIGHT,
 *                 so the wide desktop card and the tall phone card render
 *                 alike
 *   stage         #build's cards 01 and 03: a lilac and sky pearl
 *   stageMirror   #build's card 02, the same pearl turned
 *
 * A surface that repeats another is its mirror, not its copy: the scope
 * room sits a few screens under the hero, and the middle build card
 * between the other two, and two identical grounds that close read as a
 * template. `mirrorMesh` turns every pool's centre left for right and
 * leaves its size, height and colour alone, so the palette is the same
 * and the picture is not.
 *
 * DECLARED TWICE, VALUE FOR VALUE. saas.css sets the same strings as
 * `--saas-ground` and `--saas-floor` on `.pp .saas-light-<name>` (the two
 * mirrors written out literally), because the ground is painted by CSS on
 * the server's first paint and the pools that flow over it are built from
 * these. lib/pages/custom-saas-platforms.test.ts holds CSS to JS, each
 * mirror to `mirrorMesh` of its source, and every token in SAAS_INK to
 * its contrast on every light, still and flowing.
 *
 * A plain module, no "use client": the page reads it on the server and the
 * test reads it under vitest. Nothing in a client chunk needs it: the
 * pools arrive as props and the tokens as CSS.
 * ------------------------------------------------------------------ */

/**
 * The text tokens on every light, the same on all five (saas.css sets them
 * on `.pp .saas-lit`). Measured over every box the page draws a light at,
 * still and at the flow's full reach: text ≥ 12.02, dim ≥ 7.31, accent
 * ≥ 5.65, tick ≥ 3.58 (marks only, never text). The landing's own
 * `--home-violet` and `--home-muted` fall under 4.7 on a flowing pool,
 * which is why a lit surface re-points the `--pp-*` tokens at these.
 */
export const SAAS_INK = { text: "#140a24", dim: "#3d3160", accent: "#5b21b6", tick: "#7c3aed" } as const;

/** Four decimals at most, and no trailing zeros: 100 − 20 prints "80", never "80.0000". */
const num = (n: number) => String(Number(n.toFixed(4)));

/**
 * A light turned left for right: every pool's centre ` at X% ` becomes
 * ` at (100 − X)% `. Sizes (px or %), the vertical centre and every stop
 * are untouched, so `mirrorMesh(mirrorMesh(g)) === g` and the pools stack
 * back into a ground `meshBlobs` can read.
 */
export function mirrorMesh(ground: string): string {
  return ground.replace(/ at ([\d.]+)% /g, (_, x: string) => ` at ${num(100 - Number(x))}% `);
}

export type SaasLightId = "room" | "roomMirror" | "papers" | "stage" | "stageMirror";

export type SaasLight = {
  /** A static stack of radial pools over a floor, top layer first. Painted once as the surface's ground. */
  ground: string;
  /** The ground's trailing colour: what the flowing pools move over. */
  floor: string;
};

const ROOM: SaasLight = {
  ground:
    "radial-gradient(62% 26% at 20% 0%, rgb(255 255 255 / 0.85) 0%, rgb(255 255 255 / 0.71) 20%, rgb(255 255 255 / 0.49) 35%, rgb(255 255 255 / 0.276) 50%, rgb(255 255 255 / 0.127) 65%, rgb(255 255 255 / 0.048) 80%, rgb(255 255 255 / 0) 100%), radial-gradient(70% 46% at 0% 10%, rgb(158 232 242 / 0.8) 0%, rgb(158 232 242 / 0.668) 20%, rgb(158 232 242 / 0.461) 35%, rgb(158 232 242 / 0.26) 50%, rgb(158 232 242 / 0.119) 65%, rgb(158 232 242 / 0.045) 80%, rgb(158 232 242 / 0) 100%), radial-gradient(60% 40% at 48% 0%, rgb(190 206 255 / 0.7) 0%, rgb(190 206 255 / 0.584) 20%, rgb(190 206 255 / 0.403) 35%, rgb(190 206 255 / 0.227) 50%, rgb(190 206 255 / 0.104) 65%, rgb(190 206 255 / 0.039) 80%, rgb(190 206 255 / 0) 100%), radial-gradient(62% 50% at 100% 26%, rgb(212 190 255 / 0.85) 0%, rgb(212 190 255 / 0.71) 20%, rgb(212 190 255 / 0.49) 35%, rgb(212 190 255 / 0.276) 50%, rgb(212 190 255 / 0.127) 65%, rgb(212 190 255 / 0.048) 80%, rgb(212 190 255 / 0) 100%), radial-gradient(46% 36% at 60% 66%, rgb(244 200 236 / 0.5) 0%, rgb(244 200 236 / 0.417) 20%, rgb(244 200 236 / 0.288) 35%, rgb(244 200 236 / 0.163) 50%, rgb(244 200 236 / 0.074) 65%, rgb(244 200 236 / 0.028) 80%, rgb(244 200 236 / 0) 100%), radial-gradient(72% 50% at 100% 100%, rgb(255 220 178 / 0.8) 0%, rgb(255 220 178 / 0.668) 20%, rgb(255 220 178 / 0.461) 35%, rgb(255 220 178 / 0.26) 50%, rgb(255 220 178 / 0.119) 65%, rgb(255 220 178 / 0.045) 80%, rgb(255 220 178 / 0) 100%), radial-gradient(62% 44% at 6% 96%, rgb(186 238 222 / 0.7) 0%, rgb(186 238 222 / 0.584) 20%, rgb(186 238 222 / 0.403) 35%, rgb(186 238 222 / 0.227) 50%, rgb(186 238 222 / 0.104) 65%, rgb(186 238 222 / 0.039) 80%, rgb(186 238 222 / 0) 100%), #f7f5ff",
  floor: "#f7f5ff",
};

const STAGE: SaasLight = {
  ground:
    "radial-gradient(62% 26% at 20% 0%, rgb(255 255 255 / 0.85) 0%, rgb(255 255 255 / 0.71) 20%, rgb(255 255 255 / 0.49) 35%, rgb(255 255 255 / 0.276) 50%, rgb(255 255 255 / 0.127) 65%, rgb(255 255 255 / 0.048) 80%, rgb(255 255 255 / 0) 100%), radial-gradient(95% 48% at 0% 6%, rgb(207 190 255 / 0.85) 0%, rgb(207 190 255 / 0.71) 20%, rgb(207 190 255 / 0.49) 35%, rgb(207 190 255 / 0.276) 50%, rgb(207 190 255 / 0.127) 65%, rgb(207 190 255 / 0.048) 80%, rgb(207 190 255 / 0) 100%), radial-gradient(85% 44% at 100% 20%, rgb(190 214 255 / 0.75) 0%, rgb(190 214 255 / 0.626) 20%, rgb(190 214 255 / 0.432) 35%, rgb(190 214 255 / 0.244) 50%, rgb(190 214 255 / 0.112) 65%, rgb(190 214 255 / 0.042) 80%, rgb(190 214 255 / 0) 100%), radial-gradient(55% 30% at 70% 55%, rgb(246 212 240 / 0.4) 0%, rgb(246 212 240 / 0.334) 20%, rgb(246 212 240 / 0.23) 35%, rgb(246 212 240 / 0.13) 50%, rgb(246 212 240 / 0.06) 65%, rgb(246 212 240 / 0.022) 80%, rgb(246 212 240 / 0) 100%), radial-gradient(105% 50% at 28% 84%, rgb(214 200 255 / 0.75) 0%, rgb(214 200 255 / 0.626) 20%, rgb(214 200 255 / 0.432) 35%, rgb(214 200 255 / 0.244) 50%, rgb(214 200 255 / 0.112) 65%, rgb(214 200 255 / 0.042) 80%, rgb(214 200 255 / 0) 100%), radial-gradient(85% 44% at 100% 100%, rgb(186 226 250 / 0.7) 0%, rgb(186 226 250 / 0.584) 20%, rgb(186 226 250 / 0.403) 35%, rgb(186 226 250 / 0.227) 50%, rgb(186 226 250 / 0.104) 65%, rgb(186 226 250 / 0.039) 80%, rgb(186 226 250 / 0) 100%), #f6f4ff",
  floor: "#f6f4ff",
};

/**
 * Every lit surface on the page, by the class suffix it wears in saas.css
 * (`room` → `.saas-light-room`, `roomMirror` → `.saas-light-room-m`,
 * `papers`, `stage`, `stageMirror` → `.saas-light-stage-m`).
 */
export const SAAS_LIGHTS: Record<SaasLightId, SaasLight> = {
  room: ROOM,
  roomMirror: { ground: mirrorMesh(ROOM.ground), floor: ROOM.floor },
  papers: {
    ground:
      "radial-gradient(520px 200px at 18% 0%, rgb(255 255 255 / 0.8) 0%, rgb(255 255 255 / 0.668) 20%, rgb(255 255 255 / 0.461) 35%, rgb(255 255 255 / 0.26) 50%, rgb(255 255 255 / 0.12) 65%, rgb(255 255 255 / 0.045) 80%, rgb(255 255 255 / 0) 100%), radial-gradient(460px 280px at 0% 20%, rgb(214 196 255 / 0.9) 0%, rgb(214 196 255 / 0.752) 20%, rgb(214 196 255 / 0.519) 35%, rgb(214 196 255 / 0.292) 50%, rgb(214 196 255 / 0.134) 65%, rgb(214 196 255 / 0.051) 80%, rgb(214 196 255 / 0) 100%), radial-gradient(460px 260px at 34% 100%, rgb(255 226 170 / 0.8) 0%, rgb(255 226 170 / 0.668) 20%, rgb(255 226 170 / 0.461) 35%, rgb(255 226 170 / 0.26) 50%, rgb(255 226 170 / 0.12) 65%, rgb(255 226 170 / 0.045) 80%, rgb(255 226 170 / 0) 100%), radial-gradient(420px 260px at 62% 0%, rgb(246 200 236 / 0.7) 0%, rgb(246 200 236 / 0.585) 20%, rgb(246 200 236 / 0.404) 35%, rgb(246 200 236 / 0.227) 50%, rgb(246 200 236 / 0.105) 65%, rgb(246 200 236 / 0.04) 80%, rgb(246 200 236 / 0) 100%), radial-gradient(460px 280px at 100% 100%, rgb(196 206 255 / 0.85) 0%, rgb(196 206 255 / 0.71) 20%, rgb(196 206 255 / 0.49) 35%, rgb(196 206 255 / 0.276) 50%, rgb(196 206 255 / 0.127) 65%, rgb(196 206 255 / 0.048) 80%, rgb(196 206 255 / 0) 100%), radial-gradient(320px 200px at 86% 30%, rgb(255 240 214 / 0.6) 0%, rgb(255 240 214 / 0.501) 20%, rgb(255 240 214 / 0.346) 35%, rgb(255 240 214 / 0.195) 50%, rgb(255 240 214 / 0.09) 65%, rgb(255 240 214 / 0.034) 80%, rgb(255 240 214 / 0) 100%), #fbf7ff",
    floor: "#fbf7ff",
  },
  stage: STAGE,
  stageMirror: { ground: mirrorMesh(STAGE.ground), floor: STAGE.floor },
};
