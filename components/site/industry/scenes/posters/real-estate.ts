import type { Scene } from "../../shader-stage";

/**
 * The real-estate scene's look without its shader: the palette, the poster
 * that paints before (and instead of) the canvas, and the alt. A module
 * of its own so the trades window on the homepage can show every trade's
 * poster (on a posters-only device) without downloading a single shader.
 */
export const look: Omit<Scene, "frag"> = {
  colors: ["#551a89", "#7c74a6", "#f4f3f7", "#ffffff"],
  /* The door, shut, as far as stacked backgrounds can carry it — and
     they have to carry it, because this is what a reader on a slow phone
     looks at until the shader has compiled, and what a device with no
     WebGL is left with for good.

     Every layer is sized in PIXELS and placed from the band's own CENTRE
     with calc(), not by percentage. A percentage background-position
     aligns the same fraction of the IMAGE with that fraction of the
     CONTAINER, so a fixed-size layer placed that way slides relative to
     every other one the moment the band changes width: the first cut of
     this drew the panels off the leaf and the handle out in the wall on
     a tablet. calc(50% + Npx) is centre-then-offset, and it holds at
     every width. The only warm thing in it is the light getting out
     round the edges and through the letterplate, which is the picture
     the shader then animates. */
  poster:
    /* Solved at 135 pixels to the metre, so the leaf is 900 by 1960 in
       the same proportion the shader builds it in and the letterplate
       lands on the lock rail rather than across the handle. */
    // The brass: the lever on the stile and the letterplate on the rail.
    "radial-gradient(circle 7px at calc(50% + 63px) calc(50% - 21px), #e8c983 0 5px, rgb(255 255 255 / 0) 7px), " +
    "linear-gradient(#e2c07a, #9c7f45) calc(50% + 53px) calc(50% - 19px) / 20px 5px no-repeat, " +
    "linear-gradient(#e0bd75, #8e7239) calc(50% + 10px) calc(50% - 9px) / 45px 13px no-repeat, " +
    /* The four panels, the upper pair long and the lower pair short —
       each one drawn twice: the field, and behind it a slightly larger
       rectangle running light at the top left to dark at the bottom
       right, which is the cove of the moulding and the only thing that
       tells a reader at a glance that this is a panelled door. */
    "linear-gradient(158deg, #29513e, #0d1e15) calc(50% - 19px) calc(50% - 86px) / 36px 129px no-repeat, " +
    "linear-gradient(158deg, #29513e, #0d1e15) calc(50% + 39px) calc(50% - 86px) / 36px 129px no-repeat, " +
    "linear-gradient(158deg, #29513e, #0d1e15) calc(50% - 19px) calc(50% + 37px) / 36px 66px no-repeat, " +
    "linear-gradient(158deg, #29513e, #0d1e15) calc(50% + 39px) calc(50% + 37px) / 36px 66px no-repeat, " +
    "linear-gradient(150deg, #4a7b60, #0f2118) calc(50% - 19px) calc(50% - 86px) / 42px 135px no-repeat, " +
    "linear-gradient(150deg, #4a7b60, #0f2118) calc(50% + 39px) calc(50% - 86px) / 42px 135px no-repeat, " +
    "linear-gradient(150deg, #4a7b60, #0f2118) calc(50% - 19px) calc(50% + 37px) / 42px 72px no-repeat, " +
    "linear-gradient(150deg, #4a7b60, #0f2118) calc(50% + 39px) calc(50% + 37px) / 42px 72px no-repeat, " +
    // The leaf, and the warm light getting out all round its edges.
    "linear-gradient(104deg, #1f3e2e, #11241a) calc(50% + 10px) calc(50% - 35px) / 121px 265px no-repeat, " +
    "linear-gradient(rgb(255 209 156 / 0.72), rgb(255 179 110 / 0.72)) calc(50% + 10px) calc(50% - 35px) / 127px 271px no-repeat, " +
    // The architrave round it, and the stone sill under it.
    "linear-gradient(#fcfbff, #e3dfee) calc(50% + 10px) calc(50% - 40px) / 163px 287px no-repeat, " +
    "linear-gradient(#d6d1e4, #a29bbc) calc(50% + 10px) calc(50% + 103px) / 178px 13px no-repeat, " +
    // What the hall throws onto the paving, the glow round the opening,
    // and then the wall and the ground it all stands in.
    "radial-gradient(160px 56px at calc(50% + 6px) calc(50% + 132px), rgb(255 190 120 / 0.44) 0%, rgb(255 190 120 / 0) 100%), " +
    "radial-gradient(210px 250px at calc(50% + 10px) calc(50% - 10px), rgb(255 196 132 / 0.17) 0%, rgb(255 196 132 / 0) 100%), " +
    "linear-gradient(to bottom, #8b83a6 0%, #a49dbd 33%, #c6c1d8 60%, #ece9f3 82%, #ffffff 100%)",
  alt: "A deep green panelled front door with an aged brass lever and letterplate, hung in a white architrave: it swings open from a rendered wall and the warm light of a hall lamp spills out across the stone threshold and widens over the paving, holds, then eases back to shut while the camera drifts slowly in and out.",
};
