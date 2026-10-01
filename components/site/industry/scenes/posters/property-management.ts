import type { Scene } from "../../shader-stage";

/**
 * The property-management scene's look without its shader: the palette, the poster
 * that paints before (and instead of) the canvas, and the alt. A module
 * of its own so the trades window on the homepage can show every trade's
 * poster (on a posters-only device) without downloading a single shader.
 */
export const look: Omit<Scene, "frag"> = {
  colors: ["#551a89", "#7c74a6", "#f4f3f7", "#ffffff"],
  /* The panel on its wall, as far as stacked gradients can carry it —
     and they have to carry it, because this is what a reader on a slow
     phone looks at until the shader has compiled and what a device with
     no WebGL is left with for good. Solved at 390x488, the band a phone
     gets, and every layer is sized as a share of the band rather than in
     pixels, so the plate is the same plate on a 21:9 strip and a 4:5
     crop. A background position is measured against the space the layer
     leaves over, which is why none of these percentages is round: each
     one is solved from the edge its shape is meant to land on.

     It carries the SAME four-word answer as the shader, which is the only
     job it has: a neutral steel plate, a black grille and white cards. The
     first cut of this poster had a violet-grey faceplate and lilac cards,
     so a reader on a slow phone got the lavender picture even after the
     shader had stopped drawing it. */
  poster: [
    // The glare off the one window that stays lit.
    "radial-gradient(closest-side, rgba(255,206,140,0.80), rgba(255,170,70,0)) no-repeat 47.2% 40.9% / 36% 22%",
    /* That window itself: amber through a milky lens, hottest in the middle.
       The values are read off the shader's own lit card rather than picked —
       255,255,176 in the middle of it and 255,213,127 at the ends — because a
       poster that is a shade more saturated than the thing it stands in for is
       a reader watching the picture change under them when the shader lands. */
    "radial-gradient(64% 135% at 50% 50%, #ffffb0 0%, #ffd57f 54%, #f5b455 100%) no-repeat 43.0% 42.6% / 27.7% 4.4%",
    // The other four name cards: white card, a little darker down the plate.
    "linear-gradient(#f4ecdf, #e6ddcd) no-repeat 43.0% 36.1% / 27.7% 4.4%",
    "linear-gradient(#ede5d8, #dfd6c7) no-repeat 43.0% 49.0% / 27.7% 4.4%",
    "linear-gradient(#e7dfd3, #d8cfc2) no-repeat 43.0% 55.4% / 27.7% 4.4%",
    "linear-gradient(#e0d8cd, #d1c8bc) no-repeat 43.0% 61.8% / 27.7% 4.4%",
    // The five call buttons, moulded black ABS. The second is the pressed one.
    "radial-gradient(closest-side, #3a3a3e, #17171a) no-repeat 66.8% 36.2% / 5.7% 4.1%",
    "radial-gradient(closest-side, #46372a, #221913) no-repeat 66.8% 42.6% / 5.7% 4.1%",
    "radial-gradient(closest-side, #36363a, #151518) no-repeat 66.8% 49.0% / 5.7% 4.1%",
    "radial-gradient(closest-side, #323236, #131316) no-repeat 66.8% 55.3% / 5.7% 4.1%",
    "radial-gradient(closest-side, #2e2e32, #111114) no-repeat 66.8% 61.7% / 5.7% 4.1%",
    /* The speaker grille: a black drilled insert, and the steel lip round it.
       Nothing goes over it. The poster used to carry an amber talk ring here
       as well, matching a ring the shader drew; both are gone, because the
       grille has no lamp behind it and the halo was invented hardware. */
    "radial-gradient(closest-side, #1b1a18 0%, #201f1c 64%, #403e3a 88%, #9d9a95 95%, rgba(0,0,0,0) 100%) no-repeat 50% 19.8% / 19.6% 15.6%",
    /* The faceplate: brushed steel, lit from the lamp above and to the left.
       Warm-neutral, because that is what the shader measures at 172,167,159 —
       not the cool grey it was first written as and certainly not the
       #a29eb8 / #8b85a8 violet-grey it was before that, which is what a reader
       on a slow phone was looking at while everyone argued about the shader. */
    "linear-gradient(168deg, #d9d6d1 0%, #c6c2bc 32%, #a8a49e 66%, #8d8a84 100%) no-repeat 50% 28.6% / 44.3% 52.1%",
    // The shadow it keeps off the wall, tight, down and right of that lamp.
    "linear-gradient(rgba(58,38,78,0.30), rgba(58,38,78,0.30)) no-repeat 51.6% 30.5% / 44.3% 52.1%",
    // The pool of light over the door, and the wall it lands on.
    "radial-gradient(62% 46% at 28% 12%, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0) 100%)",
    "linear-gradient(to bottom, #a29dc0 0%, #b0abca 22%, #c9c5da 46%, #ebe9f1 72%, #ffffff 90%)",
  ].join(", "),
  alt: "A brushed stainless door entry panel screwed to a wall, seen straight on and close: a black perforated speaker grille at the top, and five black call buttons down the right with a printed white name card in a lit window beside each one. The buttons light one after another in warm amber as residents press them, each fading away over about a second — and one of them stays lit, held, because that call was the one that was answered.",
};
