import type { Scene } from "../../shader-stage";

/**
 * The financial-services scene's look without its shader: the palette, the poster
 * that paints before (and instead of) the canvas, and the alt. A module
 * of its own so the trades window on the homepage can show every trade's
 * poster (on a posters-only device) without downloading a single shader.
 */
export const look: Omit<Scene, "frag"> = {
  colors: ["#551a89", "#7c74a6", "#f4f3f7", "#ffffff"],
  /* The form on the desk, as far as stacked gradients can carry it — and
     they have to carry it, because this is what a reader on a slow phone
     looks at until the shader has compiled and what a device with no
     WebGL is left with for good. Solved at 390x488, the band a phone
     gets, with every layer given its own size in PIXELS off a position
     computed against the remaining space, because a percentage size is
     measured against width and height separately and the same stop that
     is a sheet on a 4:5 band is a stripe on a 21:9 one. The paper, the
     blue rule and the red are the shader's own literals. */
  poster: [
    // the figures in the boxes, and the total in its heavier one — at the
    // size the shader now sets them, a little over half the depth of the
    // box rather than four fifths of it, and re-centred on the same spot
    // they held before, because a background position is measured against
    // the space the layer leaves over
    "repeating-linear-gradient(90deg, #15171d 0 9px, rgb(0 0 0 / 0) 9px 14px) 59.1% 56.3% / 74px 14px no-repeat",
    "repeating-linear-gradient(90deg, #191b21 0 8px, rgb(0 0 0 / 0) 8px 13px) 59.0% 45.4% / 68px 12px no-repeat",
    "repeating-linear-gradient(90deg, #191b21 0 8px, rgb(0 0 0 / 0) 8px 13px) 59.0% 38.3% / 68px 12px no-repeat",
    "repeating-linear-gradient(90deg, #191b21 0 8px, rgb(0 0 0 / 0) 8px 13px) 59.0% 31.2% / 68px 12px no-repeat",
    // the total's double-ruled box, then the three blue-ruled ones
    "linear-gradient(#1b1d23 0 2px, #f5f4f1 2px 29px, #1b1d23 29px) 49.5% 56.5% / 184px 31px no-repeat",
    "linear-gradient(#8ea3c0 0 2px, #f4f6f8 2px 24px, #8ea3c0 24px) 49.5% 45.5% / 180px 26px no-repeat",
    "linear-gradient(#8ea3c0 0 2px, #f4f6f8 2px 24px, #8ea3c0 24px) 49.5% 38.1% / 180px 26px no-repeat",
    "linear-gradient(#8ea3c0 0 2px, #f4f6f8 2px 24px, #8ea3c0 24px) 49.5% 30.7% / 180px 26px no-repeat",
    // the head: a hairline rule, the title, and the one red rule
    "linear-gradient(#2a2c33, #2a2c33) 49.5% 25.5% / 176px 2px no-repeat",
    "repeating-linear-gradient(90deg, #1d1f26 0 5px, rgb(0 0 0 / 0) 5px 8px) 49.5% 23.3% / 176px 7px no-repeat",
    "linear-gradient(#b52024, #b52024) 49.1% 21.1% / 170px 5px no-repeat",
    // the sheet itself, and it is the brightest thing in the picture
    "linear-gradient(162deg, #fdfcfa, #ece9e4) 49.4% 35.2% / 212px 244px no-repeat",
    // where it meets the desk, and it is a crack rather than a cushion: a
    // hard, dark, seven-pixel core sitting on the sheet's own foot at
    // 67.6% of the band, and then a much weaker bed opening out behind it.
    // The core is nearly neutral because a contact is light taken away and
    // what is left of this room in it is only a trace of the violet fill;
    // the wide part is where the fill still reaches, so it keeps the tint.
    // These are the two numbers the shader's own contact resolves to at the
    // foot of the sheet, so the poster and the scene are the same picture.
    "radial-gradient(104px 7px at 49.7% 67.6%, rgb(24 19 34 / 0.62) 0%, rgb(24 19 34 / 0) 100%)",
    "radial-gradient(132px 30px at 50.2% 68.6%, rgb(46 36 66 / 0.17) 0%, rgb(46 36 66 / 0) 100%)",
    // the pool of light the work is under, and the desk it falls on — the
    // house's own lavender rolling off to white, like every other band
    "radial-gradient(74% 46% at 50% 39%, rgb(255 255 255 / 0.30) 0%, rgb(255 255 255 / 0) 100%)",
    "linear-gradient(to bottom, #b3aac9 0%, #b6aecb 44%, #c0b9d3 68%, #cdc7dd 77%, #e6e2ef 88%, #ffffff 97%)",
  ].join(", "),
  alt: "A self-assessment tax return lying on a pale lavender desk, photographed from almost directly above: a red deadline rule across the head of the form, a title block, and ruled boxes running down the page. Figures are written into the boxes in ink, one at a time, in the order somebody works down a return, and the total arrives last in a heavier double-ruled box — then the sheet is drawn away off the top of the frame and a fresh blank form slides in underneath it.",
};
