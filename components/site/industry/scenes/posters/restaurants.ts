import type { Scene } from "../../shader-stage";

/**
 * The restaurants scene's look without its shader: the palette, the poster
 * that paints before (and instead of) the canvas, and the alt. A module
 * of its own so the trades window on the homepage can show every trade's
 * poster (on a posters-only device) without downloading a single shader.
 */
export const look: Omit<Scene, "frag"> = {
  colors: ["#551a89", "#7c74a6", "#f4f3f7", "#ffffff"],
  /* The cover, laid, as far as stacked gradients can carry it — and they
     have to carry it, because this is what a reader on a slow phone looks
     at until the shader has compiled and what a device with no WebGL is
     left with for good. Solved at 390x488, the band a phone gets, with
     every radius in PIXELS off a centre placed in percentages, so the
     plate stays round rather than becoming an oval on a 21:9 band. The
     timber, the china, the steel and the glass are the shader's own
     literals; the strip above the table edge is the house violet in the
     table's shade.

     RE-SOLVED against the shader's own frame rather than carried over.
     Every vertical position in the first cut of this was six to eight
     points of the band's height too high — the glass sat at 9.8% where
     the render puts its rim at 17.4%, the fork began at 28.6% where the
     render starts it at 36.5% — so the poster and the scene it stands in
     for were two different pictures, and the swap from one to the other
     was a jump. These numbers are sampled off the 390 render. */
  poster:
    // The glass, from its rim down: the bright ring that is the first
    // thing that says GLASS, the bowl with the dark room in its top and
    // the timber through its bottom, the stem, and the foot with its lit
    // edge. Then the fork, the knife, the plate with its rim and the
    // shoulder of its well, what the plate throws on the timber, the
    // pendant's pool, and last the table and the strip above its far edge.
    "radial-gradient(30px 21px at 82% 17.4%, rgba(255,255,255,0) 0 74%, " +
    "rgba(255,255,255,0.72) 80% 92%, rgba(255,255,255,0) 100%), " +
    "radial-gradient(29px 20px at 82% 17.4%, #241a1e 0 52%, #433231 70% 90%, rgba(255,255,255,0) 96%), " +
    "linear-gradient(to bottom, rgba(0,0,0,0) 21.3%, #9a8e88 21.8% 31.8%, rgba(0,0,0,0) 32.3%) " +
    "80.8% 0 / 6px 100% no-repeat, " +
    "radial-gradient(26px 12px at 80% 32.5%, #463833 0 68%, rgba(255,255,255,0.58) 84% 93%, rgba(255,255,255,0) 98%), " +
    "linear-gradient(to bottom, rgba(0,0,0,0) 36.1%, #eceae6 36.5% 42.5%, rgba(0,0,0,0) 42.9%) " +
    "15.6% 0 / 12px 100% no-repeat, " +
    "linear-gradient(to bottom, rgba(0,0,0,0) 36.1%, #d5d2cd 36.5% 59.5%, rgba(0,0,0,0) 59.9%) " +
    "15.6% 0 / 7px 100% no-repeat, " +
    "linear-gradient(to bottom, rgba(0,0,0,0) 39.6%, #cdcac5 40.0% 66.5%, rgba(0,0,0,0) 66.9%) " +
    "80.8% 0 / 8px 100% no-repeat, " +
    "radial-gradient(92px 81px at 48% 51%, #fdfbf7 0 40px, #f3eee4 44px 47px, " +
    "#ffffff 52px 74px, #e8e0d2 77px 80px, #4a3836 82px 84px, rgba(0,0,0,0) 86px), " +
    "radial-gradient(110px 95px at 51.5% 54%, rgba(22,11,11,0.60) 0%, rgba(22,11,11,0) 100%), " +
    "radial-gradient(58% 46% at 28% 38%, rgba(255,230,192,0.13) 0%, rgba(255,230,192,0) 100%), " +
    "linear-gradient(to bottom, #27152b 0 3.2%, #1f1122 5.6%, #1b0e1d 7.6%, " +
    "#573d40 12.5%, #634549 30%, #5a3f42 52%, #4f393c 70%, #c9bdc0 80%, #ffffff 86%)",
  alt: "A place setting on a dark walnut table under a warm pendant, seen from high and slightly to one side: a white china plate, a polished fork to its left, a knife to its right and a clear wine glass beyond them. It is held complete for most of the loop, the glass catching the pendant and opening a patch of warm light on the timber beside its foot. Then the cover is cleared in reverse — glass, knife, fork, plate — and laid again in order, each piece lowered with a small contact and a shadow that widens while it is held and snaps tight the moment it is down.",
};
