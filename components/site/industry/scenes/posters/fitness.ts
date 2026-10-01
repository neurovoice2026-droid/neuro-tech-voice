import type { Scene } from "../../shader-stage";

/**
 * The fitness scene's look without its shader: the palette, the poster
 * that paints before (and instead of) the canvas, and the alt. A module
 * of its own so the trades window on the homepage can show every trade's
 * poster (on a posters-only device) without downloading a single shader.
 */
export const look: Omit<Scene, "frag"> = {
  colors: ["#551a89", "#7c74a6", "#f4f3f7", "#ffffff"],
  /* The dumbbell at rest on the mat, as far as stacked gradients can carry
     it — and they have to carry it, because this is what a reader on a slow
     phone looks at until the shader has compiled and what a device with no
     WebGL is left with for good. Every radius is in PIXELS off a centre
     placed with calc(), because a percentage radius is measured against
     width and height separately: the same stop that is a head on a 21:9
     band is a tall oval on a 4:5 one. The heads and the grip are the
     shader's own three materials; the wall is the house palette. */
  poster: [
    /* The two cast heads. Radii and spacing in PIXELS off a centre placed
       with calc(), because a percentage radius is measured against width and
       height separately and the same stop that is a round head on a 21:9 band
       is a tall oval on a 4:5 one. Every number here was measured off the
       shader's own frame at 390x488 — the band a phone gets, which is the
       band this poster is actually for: it is what a reader on a slow phone
       looks at until the shader has compiled, and what a device with no WebGL
       is left with for good. The near head carries a little more light than
       the far one, the way it does in the scene. */
    "radial-gradient(circle 72px at calc(50% - 86px) 44%, #181b21 0 52px, #1e222a 56px 64px, #2b303a 67px 69px, #0b0c10 70px 71px, rgb(255 255 255 / 0) 72px)",
    "radial-gradient(circle 72px at calc(50% + 86px) 44%, #1f232a 0 52px, #262a33 56px 64px, #353a46 67px 69px, #0e0f13 70px 71px, rgb(255 255 255 / 0) 72px)",
    // the knurled steel grip between them
    "radial-gradient(90px 6px at 50% 43.6%, #dcdfe5 0 26%, #979ca6 60%, #43464e 88%, rgb(255 255 255 / 0) 100%)",
    /* What it keeps off the mat. A head's centre is at 44% and its radius is
       72px, so the iron meets the rubber at 44% + 72px, and on the 488px band
       this poster is measured for that is 58.8% — which is where the seam
       goes, one under each head and not one wide smear under both. The seam
       is the darkest thing in the picture, as it is in the scene, and then a
       single soft pool in front of the pair of them. */
    "radial-gradient(54px 9px at calc(50% - 86px) 58.9%, rgb(5 4 9 / 0.96) 0 12%, rgb(6 5 11 / 0.62) 42%, rgb(8 6 13 / 0) 100%)",
    "radial-gradient(54px 9px at calc(50% + 86px) 58.9%, rgb(5 4 9 / 0.96) 0 12%, rgb(6 5 11 / 0.62) 42%, rgb(8 6 13 / 0) 100%)",
    "radial-gradient(158px 22px at 50% 60.6%, rgb(9 7 15 / 0.80) 0%, rgb(9 7 15 / 0) 100%)",
    // the matting: violet-charcoal EPDM, running back to a horizon at 58%
    "linear-gradient(to top, #4b4360 0%, #332d44 14%, #3a3449 34%, rgb(58 52 73 / 0.55) 39.5%, rgb(58 52 73 / 0) 42.5%)",
    // the pool of light on the wall the work is under — a pool ON a violet
    // wall, which is the number the shader had to come down on too
    "radial-gradient(70% 48% at 50% 50%, rgb(255 255 255 / 0.46) 0%, rgb(255 255 255 / 0) 100%)",
    // and the wall
    "linear-gradient(to top, #f3f1f8 0%, #e8e5f1 36%, #c9c4de 74%, #a8a3c4 100%)",
  ].join(", "),
  alt: "A black cast-iron dumbbell on violet-charcoal speckled rubber matting, seen from just above floor level: two round heads on a bright knurled steel grip, each head sitting in its own dark contact shadow. It is pulled off the mat on a strict count, held at the top with the iron ringing on the grip, lowered under control over twice as long as the pull, and set back down — then again, while a strip light crosses the wall behind it.",
};
