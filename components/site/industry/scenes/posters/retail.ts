import type { Scene } from "../../shader-stage";

/**
 * The retail scene's look without its shader: the palette, the poster
 * that paints before (and instead of) the canvas, and the alt. A module
 * of its own so the trades window on the homepage can show every trade's
 * poster (on a posters-only device) without downloading a single shader.
 */
export const look: Omit<Scene, "frag"> = {
  colors: ["#551a89", "#7c74a6", "#f4f3f7", "#ffffff"],
  /* The machine at rest with a receipt half out of it, as far as stacked
     gradients can carry it — and they have to carry it, because this is
     what a reader on a slow phone looks at until the shader has compiled
     and what a device with no WebGL is left with for good. Solved at
     390x488, the band a phone gets. The object's own colours are the
     shader's own literals; everything behind it is the house palette.
     Every part is sized in PIXELS and anchored to the band's CENTRE with
     a pixel offset, which took two goes. A percentage SIZE makes the
     machine a letterbox slab on a 21:9 band and a tower on a 4:5 one,
     because a percentage of the width and a percentage of the height are
     not the same number twice. And a percentage POSITION on a
     pixel-sized layer resolves against the container MINUS that layer,
     so eight layers of different widths at the same percentage walk away
     from each other as the band gets longer — which is how the second
     cut of this came out as a machine, a lid and a receipt standing in
     three different places. calc(50% + Npx) is the fix: every part is
     centred and then moved by a fixed number of pixels, so the whole
     thing holds together at any width. */
  poster:
    // The green power lamp, on the near end of the front face.
    "radial-gradient(circle 5px at 6px 6px, #4ae27c 0 2.5px, rgb(255 255 255 / 0) 5px) " +
    "calc(50% - 37px) calc(50% + 51px) / 12px 12px no-repeat, " +
    // The tear bar: a serrated steel line across the front lip of the slot.
    "repeating-linear-gradient(90deg, #c2c5cf 0 2px, #7d808c 2px 4px) " +
    "calc(50% + 6px) calc(50% - 26px) / 144px 6px no-repeat, " +
    // The print, and the sheet it is on: the straight run standing up out
    // of the slot, and the bow hooking over to the right above it.
    "repeating-linear-gradient(180deg, rgb(26 24 33 / 0.80) 0 2px, rgb(255 255 255 / 0) 2px 8px) " +
    "calc(50% - 10px) calc(50% - 82px) / 93px 100px no-repeat, " +
    "linear-gradient(97deg, #efe9de 0 5%, #fdfcf9 26%, #f4f2ec 62%, #dbd7ce 92%, #bfb9ad 100%) " +
    "calc(50% - 10px) calc(50% - 81px) / 97px 112px no-repeat, " +
    "linear-gradient(184deg, #fdfcf8 0 44%, #ece7dc 76%, #d2ccc0 100%) " +
    "calc(50% + 78px) calc(50% - 134px) / 140px 44px no-repeat, " +
    // The lid, proud of the body, and the body itself, lit from the left.
    "linear-gradient(180deg, #45434f 0 44%, #2d2b37 100%) calc(50%) calc(50% - 14px) / 210px 20px no-repeat, " +
    "linear-gradient(97deg, #403e4b 0 6%, #2d2b37 40%, #201e28 74%, #151419 100%) " +
    "calc(50%) calc(50% + 49px) / 234px 117px no-repeat, " +
    // What it keeps off the counter, the pool of light beside it, the room.
    "radial-gradient(100px 17px at 100px 17px, rgb(85 26 137 / 0.46) 0%, rgb(85 26 137 / 0) 100%) " +
    "calc(50%) calc(50% + 62px) / 200px 34px no-repeat, " +
    "radial-gradient(58% 40% at 20% 36%, rgb(255 255 255 / 0.40) 0%, rgb(255 255 255 / 0) 100%), " +
    "linear-gradient(to bottom, #9c95b9 0%, #ada6c6 26%, #c6c1d8 50%, #e8e6ef 70%, #ffffff 86%)",
  alt: "A till receipt printing: paper ratchets out of the slot of a charcoal thermal printer a line at a time, the print appearing as it clears the steel tear bar, and the receipt bows forward over the front of the machine as it lengthens before being torn off and lifted away — then the next one starts.",
};
