import type { Scene } from "../../shader-stage";

/**
 * The veterinary scene's look without its shader: the palette, the poster
 * that paints before (and instead of) the canvas, and the alt. A module
 * of its own so the trades window on the homepage can show every trade's
 * poster (on a posters-only device) without downloading a single shader.
 */
export const look: Omit<Scene, "frag"> = {
  colors: ["#551a89", "#7c74a6", "#f4f3f7", "#ffffff"],
  /* The collar at rest with the tag lying flat, as far as stacked
     gradients can carry it — and they have to carry it, because this is
     what a reader on a slow phone looks at until the shader has compiled
     and what a device with no WebGL is left with for good. Solved at
     390x488, the band a phone gets: the tag's radii are in PIXELS off a
     centre placed with calc(), because a percentage radius is measured
     against width and height separately and the same stop that is a disc
     on a 4:5 band is a long lens shape on a 21:9 one. First layer is the
     topmost. */
  poster: [
    // The two engraved lines, and the punched hole above them.
    "radial-gradient(31px 5px at calc(50% + 38px) 42.4%, rgb(104 70 20 / 0.62), rgb(104 70 20 / 0) 100%)",
    "radial-gradient(27px 4px at calc(50% + 38px) 47.6%, rgb(104 70 20 / 0.52), rgb(104 70 20 / 0) 100%)",
    "radial-gradient(9px 5px at calc(50% + 38px) 37.8%, rgb(36 24 8 / 0.85) 0 50%, rgb(36 24 8 / 0) 100%)",
    // The brass tag, and the ring engraved round its edge.
    "radial-gradient(70px 38px at calc(50% + 38px) 45%, rgb(0 0 0 / 0) 0 88%, rgb(120 84 30 / 0.55) 92%, rgb(0 0 0 / 0) 96%)",
    "radial-gradient(78px 43px at calc(50% + 38px) 45%, " +
      "#f4d694 0 26%, #ddb059 56%, #bb8939 82%, #96692a 93%, rgb(255 255 255 / 0) 100%)",
    // What it keeps off the counter, down and to the right of the key.
    "radial-gradient(92px 28px at calc(50% + 54px) 48.6%, rgb(85 26 137 / 0.24), rgb(85 26 137 / 0) 100%)",
    // The steel buckle, sitting ON the strap where the shader puts it. The
    // first cut of this poster had it floating a few per cent below, and on
    // a band with no WebGL that is the whole difference between a dog
    // collar and a strip of leather.
    "radial-gradient(7px 13px at 20.8% 31%, #f4f6f8 0 46%, rgb(255 255 255 / 0) 100%)",
    "radial-gradient(31px 20px at 18.6% 31%, rgb(58 40 22 / 0.80) 0 33%, #d5dae1 44%, #a3a9b2 74%, #767c85 88%, rgb(255 255 255 / 0) 96%)",
    // The cream linen stitch down both edges of the strap. Dashes rather
    // than lines, because a continuous thread is a pinstripe and a dashed
    // one is a saddle stitch — and the dash is in PIXELS, so it stays a
    // stitch on a 21:9 band instead of stretching into a dotted rule.
    "repeating-linear-gradient(90deg, rgb(214 200 158 / 0.92) 0 7px, rgb(214 200 158 / 0) 7px 13px) 0 27.4% / 100% 2px no-repeat",
    "repeating-linear-gradient(90deg, rgb(206 192 150 / 0.78) 0 7px, rgb(206 192 150 / 0) 7px 13px) 0 34.4% / 100% 2px no-repeat",
    // The strap: a slow bow across the band, its far edge catching the key
    // and its near edge burnished almost black.
    "radial-gradient(150% 9.4% at 50% 30.8%, #8b5d37 0 34%, #79502e 62%, #593919 86%, #3a250f 96%, rgb(255 255 255 / 0) 100%)",
    // and what the strap keeps off the counter
    "radial-gradient(150% 12% at 51% 35.6%, rgb(85 26 137 / 0.22), rgb(85 26 137 / 0) 100%)",
    // The pool of light the work is under, and then the counter itself.
    "radial-gradient(78% 58% at 52% 43%, rgb(255 255 255 / 0.66), rgb(255 255 255 / 0) 100%)",
    "linear-gradient(to bottom, #b0a8c9 0%, #cbc6dc 20%, #e6e4ee 50%, #f8f7fb 80%, #ffffff 100%)",
  ].join(", "),
  alt: "A tan leather dog collar lying in a slow curve across a pale counter, seen close and low: pebbled grain, a cream stitched edge, and a steel buckle the collar is fastened through — the tail running under the frame and showing through its window, the doubled end climbing over the frame to wrap the centre bar, and the tongue dropping from that bar into a punched hole. A brass name tag lies loose in front of it. Someone has flicked the tag: it spins fast enough to smear its engraving into a plain ring of brass, slows, tips onto its rim and rattles like a dropped coin settling, then lies flat with the name and number readable — and after a pause it is flicked again.",
};
