import type { Scene } from "../../shader-stage";

/**
 * The logistics scene's look without its shader: the palette, the poster
 * that paints before (and instead of) the canvas, and the alt. A module
 * of its own so the trades window on the homepage can show every trade's
 * poster (on a posters-only device) without downloading a single shader.
 */
export const look: Omit<Scene, "frag"> = {
  colors: ["#551a89", "#7c74a6", "#f4f3f7", "#ffffff"],
  /* The line at rest, as far as stacked gradients can carry it — and they
     have to carry it, because this is what a reader on a slow phone looks
     at until the shader has compiled and what a device with no WebGL is
     left with for good. Solved against the SHADER'S OWN 390x488 frame,
     layer by layer and measured off it rather than guessed: the post and
     its spar where the render puts them, the scan head on the end of it,
     the kraft block under that with its white label, the roller crowns,
     the channel and its legs. The violet is the building; the brown, the
     white and the red are the objects, which is the same division the
     shader makes — and it is the same object in the same place, so the
     picture does not jump when the shader finally arrives. */
  poster: [
    /* The paper cut comes FIRST, because the harness applies its own last:
       guarded() mixes the bottom of every band to white from 0.30 of the
       height down to 0.17, and a poster whose legs and channel run on
       under that line is a poster that does not match the picture it is
       standing in for. Same two numbers, same direction. */
    "linear-gradient(to top, #ffffff 0 17%, rgba(255,255,255,0) 30%)",
    /* The beam. It LEANS, because the shader's does — the fan is tilted
       off vertical, and it STOPS ON THE CROWN, because the shader's does
       too: a scan line ends at the first surface it meets, and the board
       is that surface. This box used to run 140px down the picture, which
       carried the poster's line through the face of the carton and onto
       the rollers under it — the same fault the shader had, in the layer
       a reader on a slow phone actually looks at. So: one box the size of
       the stroke the render really draws, measured off the shader's own
       390 frame at the still's uTime of 2.0 — head at (203,121), crown at
       (213,153) — and a gradient turned across it at the stroke's own
       angle, which makes a straight line of any slope out of two stops. */
    "linear-gradient(76deg, rgba(232,38,26,0) calc(50% - 1.6px), rgba(233,46,34,0.88) calc(50% - 1.6px), rgba(233,46,34,0.88) calc(50% + 1.6px), rgba(232,38,26,0) calc(50% + 1.6px)) calc(50% + 13px) calc(50% - 107px) / 24px 36px no-repeat",
    "linear-gradient(76deg, rgba(232,38,26,0) calc(50% - 8px), rgba(236,74,60,0.17) calc(50% - 8px), rgba(236,74,60,0.17) calc(50% + 8px), rgba(232,38,26,0) calc(50% + 8px)) calc(50% + 13px) calc(50% - 107px) / 24px 36px no-repeat",
    /* The scan head on its cantilever: the box, the spar, the post. */
    "linear-gradient(#26262e, #101015) calc(50% + 11px) calc(50% - 142px) / 27px 40px no-repeat",
    "linear-gradient(#83878f, #565a64) calc(50% - 70px) calc(50% - 161px) / 146px 12px no-repeat",
    "linear-gradient(#6b6f7a, #50545e) calc(50% - 139px) calc(50% - 101px) / 12px 133px no-repeat",
    /* The label: carrier block, two ruled lines of address, the barcode. */
    "repeating-linear-gradient(to right, #14131a 0 2px, rgba(255,255,255,0) 2px 5px) calc(50% + 34px) calc(50% - 37px) / 46px 16px no-repeat",
    "linear-gradient(#44434b, #44434b) calc(50% + 51px) calc(50% - 52px) / 25px 3px no-repeat",
    "linear-gradient(#3c3b43, #3c3b43) calc(50% + 53px) calc(50% - 59px) / 29px 3px no-repeat",
    "linear-gradient(#0f0e14, #0f0e14) calc(50% + 23px) calc(50% - 58px) / 23px 9px no-repeat",
    "linear-gradient(#f8f7f3, #eceae5) calc(50% + 39px) calc(50% - 46px) / 64px 42px no-repeat",
    /* The carton: a lit crown, kraft board, a scuffed foot. Every one of
       these five tones was read off the shader's own 390 frame rather
       than picked, which is why the poster does not warm up by half a
       stop the moment the canvas takes over. */
    "linear-gradient(#cb956d 0 7%, #9a6a45 7% 11%, #7a5340 11% 28%, #6e4b37 28% 84%, #4f3628 84% 100%) calc(50% + 21px) calc(50% - 47px) / 226px 101px no-repeat",
    /* The side guide, the roller crowns, the channel rail and its legs. */
    "linear-gradient(#8d919c, #6f7380) 50% calc(50% - 39px) / 100% 6px no-repeat",
    "repeating-linear-gradient(to right, #3c3f48 0 2px, #5a5d69 2px 4px, #969aa6 4px 15px, #3f424c 15px 17px) 50% calc(50% + 3px) / 100% 68px no-repeat",
    "linear-gradient(#5f5d6b 0 9%, #504e5d 9% 100%) 50% calc(50% + 76px) / 100% 74px no-repeat",
    "repeating-linear-gradient(to right, rgba(0,0,0,0) 0 96px, #63616f 96px 110px, rgba(0,0,0,0) 110px 190px) 50% calc(50% + 135px) / 100% 46px no-repeat",
    /* The building, in the order the shader builds it: the wall going
       violet as it climbs, the pool of light where the station is — and
       the shader puts that pool at the middle of the LINE, not the middle
       of the band, so on a phone it sits a sixth of the way in — then the
       vignette last and over the top of both. */
    "linear-gradient(to right, rgba(85,26,137,0.10) 0%, rgba(85,26,137,0) 26%, rgba(85,26,137,0) 74%, rgba(85,26,137,0.10) 100%)",
    "radial-gradient(64% 58% at 16% 46%, rgba(255,255,255,0.56) 0%, rgba(255,255,255,0) 100%)",
    "linear-gradient(#b0abcb 0%, #c2bed8 30%, #d2cfe1 58%, #eae9f1 86%, #f8f7fb 100%)",
  ].join(", "),
  alt: "A kraft cardboard parcel with a white shipping label, sitting on a galvanised roller conveyor and seen from the side and low, standing under a scan head on a cantilevered post while a red laser line is drawn across the top of it. The rollers turn, the bed indexes one parcel along every couple of seconds, and the next parcel arrives under the head as this one leaves.",
};
