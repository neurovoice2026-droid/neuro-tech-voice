import type { Scene } from "../../shader-stage";

/**
 * The insurance scene's look without its shader: the palette, the poster
 * that paints before (and instead of) the canvas, and the alt. A module
 * of its own so the trades window on the homepage can show every trade's
 * poster (on a posters-only device) without downloading a single shader.
 */
export const look: Omit<Scene, "frag"> = {
  colors: ["#551a89", "#7c74a6", "#f4f3f7", "#ffffff"],
  /* What a reader on a slow phone looks at until the shader has compiled,
     and what a device with no WebGL is left with for good. Measured off
     the shader's own frame at 390x488 — the 4:5 band a phone gets, which
     is the band this poster is actually for.

     EVERY LAYER IS ANCHORED TO THE BAND'S CENTRE IN PIXELS, and that is a
     fix rather than a style. A background layer given a percentage
     position is placed at that fraction of (container minus LAYER), so a
     stack of differently sized layers at differing percentages holds
     together only in the band it was solved in and fans out into nonsense
     in any other. Under `calc(50% + Npx)` the layer's CENTRE lands at the
     band's centre plus N whatever the band and whatever the layer, so the
     break is the same break at 390 and at 2560.

     Background layers composite front to back, so an edge that runs at
     an angle is cut the only way a stack of gradients can cut one: by a
     hard stop in a layer that is transparent on one side of it. Two of
     them carry the whole picture — the ROOF, above which the car layer
     is transparent and the room shows through, and the panel's own top
     edge, over which the car's colour is painted back on top of the
     glass. Both lines were least-squares fitted to the shader's own
     projected edges at 390 by 488, which is the band this poster is
     actually for, and both sit within eleven pixels of them.

     The ROOM's stops are the four house colours; the OBJECT's are the
     shader's own literals, so the handover at compile time is not a
     change of colour. */
  poster:
    /* The same paper cut the harness makes in the shader — white below
       0.17 of the band, released by 0.30. Without it the poster is the
       only picture on the page whose foot is still bodywork where the
       kicker is printed, which is the scene bleeding out of the bottom
       of the band on exactly the readers who wait longest for it. */
    "linear-gradient(to top, #ffffff 0 17%, rgb(255 255 255 / 0) 30%), " +
    // the star: five diameters through the impact, ten radial legs
    "linear-gradient(101deg, rgb(255 255 255 / 0) 49.3%, #eef6f3 49.7%, #eef6f3 50.3%, rgb(255 255 255 / 0) 50.7%) calc(50% - 56px) calc(50% - 87px) / 107px 107px no-repeat, " +
    "linear-gradient(9deg, rgb(255 255 255 / 0) 49.3%, #e4f1ec 49.7%, #e4f1ec 50.3%, rgb(255 255 255 / 0) 50.7%) calc(50% - 56px) calc(50% - 87px) / 133px 73px no-repeat, " +
    "linear-gradient(143deg, rgb(255 255 255 / 0) 49.3%, #f2f9f6 49.7%, #f2f9f6 50.3%, rgb(255 255 255 / 0) 50.7%) calc(50% - 56px) calc(50% - 87px) / 60px 88px no-repeat, " +
    "linear-gradient(58deg, rgb(255 255 255 / 0) 49.4%, #dcefe8 49.8%, #dcefe8 50.2%, rgb(255 255 255 / 0) 50.6%) calc(50% - 56px) calc(50% - 87px) / 38px 60px no-repeat, " +
    "linear-gradient(168deg, rgb(255 255 255 / 0) 49.4%, #dcefe8 49.8%, #dcefe8 50.2%, rgb(255 255 255 / 0) 50.6%) calc(50% - 56px) calc(50% - 87px) / 83px 30px no-repeat, " +
    // the concentric fractures hooping the crater, and the crater itself
    "radial-gradient(circle 13px at calc(50% - 56px) calc(50% - 87px), rgb(255 255 255 / 0) 0 10px, rgb(230 244 239 / 0.75) 10.5px 11.2px, rgb(255 255 255 / 0) 13px), " +
    "radial-gradient(circle 9px at calc(50% - 56px) calc(50% - 87px), rgb(255 255 255 / 0) 0 6.2px, rgb(238 249 244 / 0.9) 6.8px 7.4px, rgb(255 255 255 / 0) 9px), " +
    "radial-gradient(circle 8px at calc(50% - 56px) calc(50% - 87px), #f4faf7 0 2.5px, rgb(244 250 247 / 0.45) 4.3px, rgb(244 250 247 / 0) 8px), " +
    "radial-gradient(circle 3px at calc(50% - 56px) calc(50% - 87px), rgb(16 24 22 / 0.78) 0 1px, rgb(16 24 22 / 0) 3px), " +
    // the mirror and camera bracket, hung off the top band
    "radial-gradient(11px 8px at calc(50% + 15px) calc(50% - 161px), #07080a 0 76%, rgb(7 8 10 / 0) 100%), " +
    // the black ceramic frit, fading inward through its lattice of dots
    "linear-gradient(to bottom, #07080a 0 15px, rgb(7 8 10 / 0.45) 24px, rgb(7 8 10 / 0) 40px) calc(50% - 57px) calc(50% - 85px) / 286px 300px no-repeat, " +
    "linear-gradient(to right, #07080a 0 13px, rgb(7 8 10 / 0.40) 21px, rgb(7 8 10 / 0) 36px) calc(50% - 57px) calc(50% - 85px) / 286px 300px no-repeat, " +
    // the wiper, parked along the bottom of the glass
    "linear-gradient(to bottom, rgb(255 255 255 / 0) 0 74%, #16181d 74.5% 79.5%, rgb(255 255 255 / 0) 80%) calc(50% - 57px) calc(50% - 85px) / 286px 300px no-repeat, " +
    // the soft box, laid over so it crosses the lower glass
    "linear-gradient(128deg, rgb(255 255 255 / 0) 42%, rgb(255 253 248 / 0.07) 52%, rgb(255 253 248 / 0.30) 59%, rgb(255 253 248 / 0.30) 64%, rgb(255 253 248 / 0.05) 71%, rgb(255 255 255 / 0) 82%) calc(50% - 57px) calc(50% - 85px) / 286px 300px no-repeat, " +
    /* The roof rail, painted back in the CAR'S colour over the glass
       beneath it. Background layers composite front to back and cannot
       multiply, so a trapezoid is cut the only way a stack of gradients
       can cut one: by putting back what is behind. The cut runs along
       the panel's own top edge — through (65, -9) and (304, 117) of this
       layer's box, which is where the shader's camera puts it. */
    "linear-gradient(208deg, #16171d 0 23.8%, rgb(22 23 29 / 0) 23.8%) calc(50% - 57px) calc(50% - 85px) / 286px 300px no-repeat, " +
    // the glass, and the dark cabin behind it
    "linear-gradient(168deg, #34373f 0%, #262932 40%, #1a1c23 74%, #131419 100%) calc(50% - 57px) calc(50% - 85px) / 286px 300px no-repeat, " +
    /* The car it is set in, cut along the ROOF: transparent above the
       line and bodywork below it, so the room shows over the roof and
       beyond the A-pillar exactly as it does in the shader. That edge,
       and the room down the right of it, is the whole of what says car
       rather than phone on a 4:5 band. */
    "linear-gradient(220deg, rgb(25 26 33 / 0) 0 17.3%, #191a21 17.3%, #0d0e13 100%) calc(50% - 217px) calc(50% - 14px) / 720px 620px no-repeat, " +
    // and the room it is standing in
    "linear-gradient(to top, #ffffff 0%, #f4f3f7 26%, #e4e0ee 58%, #cfc6e4 82%, #b9aed9 100%)",
  alt: "A laminated car windscreen seen close and raked, filling the frame: black ceramic frit round the rim, the dark cabin behind it, and a long soft studio light lying across the curve of the glass. A stone comes in off the road and lands; a white pit opens with a bruise of crushed glass round it, radial cracks run out across the pane in a few branching runs, one arresting before the next begins, and concentric fractures ring the crater. It holds — and then it is clear again, and the stone comes back.",
};
