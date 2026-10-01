import type { Scene } from "../../shader-stage";

/**
 * The law-firms scene's look without its shader: the palette, the poster
 * that paints before (and instead of) the canvas, and the alt. A module
 * of its own so the trades window on the homepage can show every trade's
 * poster (on a posters-only device) without downloading a single shader.
 */
export const look: Omit<Scene, "frag"> = {
  colors: ["#551a89", "#a996c0", "#f4f3f7", "#ffffff"],
  /* The seal lifted clear of its own impression, as far as stacked
     gradients can carry it — and they have to carry it, because this is
     what a reader on a slow phone looks at until the shader has compiled
     and what a device with no WebGL is left with for good. Solved at
     390x488, the band a phone gets, and measured off the shader's own
     frame at uTime two rather than guessed: every centre and radius below
     came off a row-by-row scan of that render.

     AND EVERY RADIAL GRADIENT HERE ENDS ON A TRANSPARENT STOP. The cut
     this replaces did not: four of its blobs ended on an opaque colour,
     and a radial gradient carries its last stop out to the corners of the
     box. Three brass ellipses each filled the whole band with their own
     dark rim, the topmost of them won, and what the poster actually
     painted — on every phone slow enough to see it, and for good on
     anything without WebGL — was a brown rectangle with a small gold
     stalk in the middle of it. It is the one part of this band nobody
     screenshots, because by the time you look the canvas is over it. */
  poster:
    // The finial, the knob and the shaft of the seal, held above the page.
    "radial-gradient(11px 7px at 43.2% 14.5%, #dab76e 0 45%, #9a7639 84%, rgb(255 255 255 / 0) 100%), " +
    "radial-gradient(29px 19px at 43.2% 19.7%, #e9c680 0%, #c1964c 44%, #7b5b29 80%, #402f14 95%, rgb(255 255 255 / 0) 100%), " +
    "linear-gradient(90deg, rgb(255 255 255 / 0) 0 40.3%, #6d5124 40.3% 41.5%, #cfa758 41.5% 44.6%, #7d5b28 44.6% 46.4%, rgb(255 255 255 / 0) 46.4%) 50% 25.4% / 100% 9.8% no-repeat, " +
    // The knurled collar, the turned boss and the broad die under them.
    // Their vertical extents OVERLAP on purpose: three ellipses with
    // daylight between them is a snowman, not a turned handle.
    "radial-gradient(27px 12px at 43.8% 34.2%, #d5ac5f 0%, #9d7535 54%, #4c3718 86%, rgb(255 255 255 / 0) 100%), " +
    "radial-gradient(38px 17px at 43.8% 38.8%, #dab264 0%, #a27939 56%, #503a19 88%, rgb(255 255 255 / 0) 100%), " +
    "radial-gradient(57px 20px at 43.7% 44.3%, #f1cc7f 0%, #b98843 40%, #75541f 74%, #33240b 94%, rgb(255 255 255 / 0) 100%), " +
    "radial-gradient(55px 9px at 43.7% 47.3%, #3b2b12 0 52%, rgb(59 43 18 / 0) 100%), " +
    // What the lifted seal keeps off the sheet, down and right of the key.
    "radial-gradient(84px 19px at 52.5% 51.8%, rgb(85 26 137 / 0.22) 0%, rgb(85 26 137 / 0) 100%), " +
    // The impression: the raised squeeze-out rim, the struck face inside
    // it, and the thickness of cooled wax standing off the page.
    "radial-gradient(89px 36px at 50.3% 61.1%, rgb(255 255 255 / 0) 0 60%, #932019 66%, #c4382b 76%, #6e1210 90%, rgb(255 255 255 / 0) 100%), " +
    "radial-gradient(62px 24px at 48.8% 60.2%, rgb(255 255 255 / 0) 0 78%, rgb(198 62 48 / 0.34) 88%, rgb(255 255 255 / 0) 100%), " +
    "radial-gradient(40px 15px at 45.5% 58.6%, rgb(222 71 56 / 0.85) 0%, rgb(222 71 56 / 0) 100%), " +
    "radial-gradient(84px 32px at 47.5% 59.4%, #a3201a 0%, #7a1513 52%, #4a0b0c 86%, rgb(74 11 12 / 0) 100%), " +
    "radial-gradient(80px 16px at 50.3% 65.0%, #4c0a0b 0 58%, #2a0506 86%, rgb(42 5 6 / 0) 100%), " +
    "radial-gradient(104px 26px at 56.5% 63.6%, rgb(85 26 137 / 0.24) 0%, rgb(85 26 137 / 0) 100%), " +
    // The type on the deed: the body block over the wax, and a signature
    // rule either side of it, which is where a seal goes on a sealed deed.
    "linear-gradient(90deg, #6a635b 0 100%) 11.4% 61.4% / 15% 0.8% no-repeat, " +
    "linear-gradient(90deg, #6a635b 0 100%) 93.1% 62.6% / 17% 0.8% no-repeat, " +
    "linear-gradient(90deg, #7a746d 0 100%) 74.0% 53.6% / 42% 0.7% no-repeat, " +
    "linear-gradient(90deg, #837d76 0 100%) 70.0% 52.2% / 46% 0.6% no-repeat, " +
    "linear-gradient(90deg, #8a847d 0 100%) 73.0% 50.9% / 44% 0.6% no-repeat, " +
    "linear-gradient(90deg, #8a847d 0 100%) 68.0% 49.6% / 48% 0.5% no-repeat, " +
    /* The sheet of cream laid paper, and the wall behind the whole thing.
       The scene has the sheet's near corner running back into the room at
       the left, and a wedge of wall in the bottom corner with it; every
       shape a CSS gradient can make of that at one aspect becomes a
       violet cloud at another, so the poster carries the sheet edge to
       edge. It has about a second and a half to be right. */
    "linear-gradient(to bottom, rgb(255 255 255 / 0) 0 48%, #f4edda 51% 78%, rgb(244 237 218 / 0) 88%), " +
    "linear-gradient(to bottom, #bfb0d0 0%, #c8bbd7 24%, #c6b9d5 44%, #b09ac7 58%, #9d82ba 68%, #e4dcef 84%, #ffffff 94%)",
  alt: "A heavy brass desk seal stamping a document: it comes down out of the top of the frame onto a pool of deep red sealing wax lying on a sheet of cream laid paper, drives in, rebounds, and is drawn up and back out of the way — leaving an impression, a spread disc with a raised rim round it and the scales of justice struck in relief inside a beaded border, with the seal standing over it. The camera is low and close to the sheet, so the strike is read in profile.",
};
