import type { Scene } from "../../shader-stage";

/**
 * The hospitality scene's look without its shader: the palette, the poster
 * that paints before (and instead of) the canvas, and the alt. A module
 * of its own so the trades window on the homepage can show every trade's
 * poster (on a posters-only device) without downloading a single shader.
 */
export const look: Omit<Scene, "frag"> = {
  colors: ["#551a89", "#7c74a6", "#f4f3f7", "#ffffff"],
  /* The bell at rest, as far as stacked gradients can carry it — and they
     have to carry it, because this is what a reader on a slow phone sees
     until the shader has compiled and what a device with no WebGL is left
     with for good. Solved at 390x488, the band a phone gets, with every
     radius in PIXELS off a centre placed in percentages so the dome stays
     round rather than becoming an egg on the wider band.

     The dome's tones are the shader's studio, not the room: a bright bank
     at the top, the deck's cream below the belt, and the belt itself a
     dark NEUTRAL. The first cut painted that belt house violet and the
     poster had the same two-tone plastic look the shader did. */
  poster:
    // The brass button, stem and collar.
    "radial-gradient(17px 8px at 50% 22.0%, #e6bd72 0 55%, #a97c30 84%, rgb(255 255 255 / 0) 100%), " +
    "radial-gradient(5px 16px at 50% 26.2%, #d9ab55 0 72%, #a2762c 94%, rgb(255 255 255 / 0) 100%), " +
    "radial-gradient(19px 8px at 50% 29.9%, #e0b25e 0 55%, #8f6722 88%, rgb(255 255 255 / 0) 100%), " +
    // The dark belt the studio's deck edge lays across every polished dome,
    // and the bank burning above it. These sit OVER the dome, because a
    // radial gradient runs concentric and a belt never can.
    "radial-gradient(84px 7px at 50% 48.4%, #3a3b41 0 38%, rgb(58 59 65 / 0) 100%), " +
    "radial-gradient(46px 30px at 42% 39.5%, rgb(255 255 255 / 0.95) 0 18%, rgb(255 255 255 / 0) 72%), " +
    // The dome itself: the bank, the sweep, the flag, the deck.
    "radial-gradient(87px 63px at 50% 43.8%, " +
    "#f8f8f7 0 26%, #d5d6d8 46%, #8e9196 64%, #c2c4c8 78%, #edeeee 92%, rgb(255 255 255 / 0) 100%), " +
    // The stepped foot: the lit top of the plinth, its rim, and the wider
    // foot ring under it.
    "radial-gradient(101px 8px at 50% 56.4%, #f5f5f4 0 60%, #a7a8ab 88%, rgb(255 255 255 / 0) 100%), " +
    "radial-gradient(104px 11px at 50% 57.8%, #cbccce 0 55%, #6c6d72 86%, rgb(255 255 255 / 0) 100%), " +
    "radial-gradient(112px 7px at 50% 59.6%, #b2b3b7 0 60%, #5c5d63 88%, rgb(255 255 255 / 0) 100%), " +
    // The dome mirrored in the polished stone, and the shadow it drops —
    // the shadow is the room's, so it keeps the room's tint.
    "radial-gradient(78px 24px at 50% 63.5%, rgb(129 130 136 / 0.42) 0%, rgb(129 130 136 / 0) 100%), " +
    "radial-gradient(152px 20px at 57% 61.6%, rgb(85 26 137 / 0.20) 0%, rgb(85 26 137 / 0) 100%), " +
    // A ring of sound, already out across the counter.
    "radial-gradient(196px 28px at 50% 61.0%, rgb(255 255 255 / 0) 0 60%, rgb(255 255 255 / 0.55) 73%, rgb(255 255 255 / 0) 88%), " +
    // The figuring in the stone, the pool of light on the wall, and then
    // the wall, the desk's back edge at 54% and the counter under it.
    "radial-gradient(56% 8% at 24% 76%, rgb(99 95 92 / 0.16) 0%, rgb(99 95 92 / 0) 100%), " +
    "radial-gradient(48% 6% at 76% 86%, rgb(99 95 92 / 0.13) 0%, rgb(99 95 92 / 0) 100%), " +
    "radial-gradient(46% 24% at 22% 34%, rgb(255 255 255 / 0.55) 0%, rgb(255 255 255 / 0) 100%), " +
    "linear-gradient(to bottom, #6f6690 0%, #b3aacb 22%, #e8e4f0 44%, #d6cfe3 52%, " +
    "#efe9e0 56%, #e6e0d6 70%, #f6f3ee 86%, #ffffff 100%)",
  alt: "A polished chrome desk bell on a pale marble counter, low and close: the brass plunger drops, the dome shivers as it rings, and rings of sound go out across the stone — then a pause, and it is struck again.",
};
