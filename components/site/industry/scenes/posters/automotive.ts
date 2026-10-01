import type { Scene } from "../../shader-stage";

/**
 * The automotive scene's look without its shader: the palette, the poster
 * that paints before (and instead of) the canvas, and the alt. A module
 * of its own so the trades window on the homepage can show every trade's
 * poster (on a posters-only device) without downloading a single shader.
 */
export const look: Omit<Scene, "frag"> = {
  colors: ["#551a89", "#7c74a6", "#f4f3f7", "#ffffff"],
  /* The assembly, seated, as far as stacked gradients can carry it — and
     they have to carry it, because this is what a reader on a slow phone
     looks at until the shader has compiled and what a device with no
     WebGL is left with for good. Solved at 390x488, the band a phone
     gets: every radius is in PIXELS off a centre placed in percentages,
     so the disc stays round and the same stop is not a hub on one band
     and a moon on the other.

     The colours are the shader's own materials, not the house palette:
     iron greys, a red caliper, zinc nuts, on a violet-grey wall over the
     bench the disc stands on, going to paper at the foot. A poster in
     violet under a scene in iron and red is a flash of the wrong picture
     on every first paint — and a poster with the disc in mid-air under a
     scene that stands it on a bench is the same mistake in geometry. */
  poster:
    // The five nuts on the hub face, on the studs' own 36-degree phase,
    // so none of them sits at twelve or six o'clock. Zinc plating.
    "radial-gradient(circle 15px at 58.5% 36.0%, #e4e7ee 0 13px, rgb(255 255 255 / 0) 15px), " +
    "radial-gradient(circle 15px at 46.8% 32.9%, #d3d8e1 0 13px, rgb(255 255 255 / 0) 15px), " +
    "radial-gradient(circle 15px at 39.5% 40.9%, #c0c6d1 0 13px, rgb(255 255 255 / 0) 15px), " +
    "radial-gradient(circle 15px at 46.8% 48.9%, #b6bcc8 0 13px, rgb(255 255 255 / 0) 15px), " +
    "radial-gradient(circle 15px at 58.5% 45.8%, #d3d8e1 0 13px, rgb(255 255 255 / 0) 15px), " +
    // The caliper, clamped over the rim at eleven o'clock, in its paint.
    "radial-gradient(52px 44px at 30.7% 21.2%, #c9382c 0 46%, #a51f16 74%, rgb(255 255 255 / 0) 100%), " +
    // The disc: bore, hub flange, hat, web, the friction ring with its
    // machined band, and the lit lip at the rim. Every radius is the
    // shader's own proportion times the 122px the disc actually measures
    // on a 390x488 band — flange at 0.48 of the disc's radius, stud
    // circle at 0.335, web at 0.65, swept band from 0.60 out.
    "radial-gradient(circle 122px at 50% 40.9%, " +
    "#ded9ec 0 16px, #6d665e 18px 33px, #7d766d 35px 53px, #4a443e 56px 60px, " +
    "#6e675f 62px 67px, #55504a 69px 77px, #a8a7a9 78px 107px, #c3c2c4 108px 112px, " +
    "#4f4a45 113px 115px, rgb(255 255 255 / 0) 117px), " +
    /* THE CONTACT, which the poster had no more of than the shader did:
       a disc floating on a wall with an offset smudge behind it. The
       disc's own stops put its rim at 116px below a centre at 40.9%, so
       it lands at 64.9% of the band — and these two layers are under it
       and nowhere else. The tight one is the seam: half as wide as the
       disc, a few pixels deep, and the darkest thing in the poster. The
       wide one is the bench losing the room as it leaves the rim. Both
       are violet-black rather than grey, because what is left in a
       shadow here is the room. */
    "radial-gradient(58px 7px at 50% 64.8%, rgb(24 14 34 / 0.80) 0%, rgb(26 16 38 / 0.46) 58%, rgb(85 26 137 / 0) 100%), " +
    "radial-gradient(146px 40px at 50% 66.6%, rgb(48 30 72 / 0.34) 0%, rgb(85 26 137 / 0) 100%), " +
    /* The pool of light, and then the room: a violet-grey wall down to
       the bench line at 65%, the bench top under it going to the paper
       the kicker is printed on. The one tone break is at the contact, so
       the disc is standing on something and not in front of it. */
    "radial-gradient(62% 52% at 50% 41%, rgb(255 255 255 / 0.58) 0%, rgb(255 255 255 / 0) 100%), " +
    "linear-gradient(to bottom, #8b80b0 0%, #a9a2c4 26%, #d8d2e6 58%, #cec7df 65%, #e6e2f0 76%, #ffffff 92%)",
  alt: "A front brake assembling itself on a workbench: a cast-iron cross-drilled disc drifts in and settles on its rim, in its own dark contact shadow; a red caliper closes over the rim on the bracket behind it; and five zinc-plated wheel nuts travel in along the studs and turn as they thread down — then the whole thing releases and comes apart again while the camera arcs slowly round from edge-on to face-on.",
};
