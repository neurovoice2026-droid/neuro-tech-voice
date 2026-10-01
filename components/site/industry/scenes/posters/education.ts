import type { Scene } from "../../shader-stage";

/**
 * The education scene's look without its shader: the palette, the poster
 * that paints before (and instead of) the canvas, and the alt. A module
 * of its own so the trades window on the homepage can show every trade's
 * poster (on a posters-only device) without downloading a single shader.
 */
export const look: Omit<Scene, "frag"> = {
  colors: ["#551a89", "#a996c0", "#f4f3f7", "#ffffff"],
  /* The picture a phone with no WebGL is left with, and the one thing a
     stack of gradients can actually draw better than it can draw a
     ceiling: a tower. Four front faces with a hard seam between each,
     one side face down the right and one top face across, all on the
     same background-size and the same background-position so the four
     layers cannot drift apart — which is what happens the moment two
     layers of different sizes are positioned by percentage. Laid out
     for the 4:5 band, because that is the band where a poster is what
     the reader actually gets.

     The blocks carry the shader's own four pigments in the shader's own
     order — vermilion at the foot, then cobalt, chrome yellow and leaf
     green — at roughly the value a front face comes out at under the
     window. The shade down the right is one translucent violet wash
     over all four, so each block darkens in its own hue rather than
     toward a single grey. Everything that is NOT a block — the floor,
     the mat, the shadow, the seams — is an interpolation of the four
     colours above and the house violet. */
  poster:
    // the shaded side of the stack: one violet wash, so every block
    // darkens in its own colour
    "linear-gradient(to right, rgb(58 30 92 / 0) 0 75%, rgb(49 24 78 / 0.50) 75%, rgb(41 19 66 / 0.62) 100%) 47% 42% / 92px 210px no-repeat, " +
    // the top face of the top block, catching the window
    "linear-gradient(to bottom, #93c680 0 5.5%, rgb(255 255 255 / 0) 5.5%) 47% 42% / 92px 210px no-repeat, " +
    // four painted blocks, seamed, green at the top and vermilion at the foot
    "linear-gradient(to bottom, #4c9040 0 23.5%, #3b2059 23.5% 25.5%, " +
    "#d9a021 25.5% 48.5%, #3b2059 48.5% 50.5%, #27578f 50.5% 73.5%, " +
    "#3b2059 73.5% 75.5%, #a93627 75.5% 100%) 47% 42% / 92px 210px no-repeat, " +
    /* What it keeps off the floor, and nothing else down there. The mat
       that used to be under this went with the one in the shader, and for
       the same reason: a soft violet ellipse with no edge is read as a
       shadow, and a shadow under nothing is a fault. What is left is the
       contact — and it is a TINT, a grey-violet at four tenths rather
       than the near-house-violet at a half that was here, because a
       shadow on a pale floor is that floor with less light on it. */
    "radial-gradient(34% 7% at 53% 68.5%, rgb(150 138 170 / 0.44) 0%, rgb(150 138 170 / 0) 100%), " +
    "linear-gradient(to bottom, #ffffff 0%, #f8f6fb 22%, #efebf6 48%, #f6f3fa 64%, #ffffff 86%, #ffffff 100%)",
  alt: "A tower of painted wooden nursery blocks — vermilion, cobalt, chrome yellow and leaf green, chipped back to bare beech along the arrises, each with a letter cut into its face and filled with enamel, white on the dark blocks and black on the yellow — standing a few degrees out of true on a pale floor with two or three spare blocks lying behind it, while another block is carried in through the air to be set on top and the camera draws back as the tower grows.",
};
