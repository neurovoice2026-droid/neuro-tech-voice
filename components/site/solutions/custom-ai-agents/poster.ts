import type { Scene } from "@/components/site/industry/shader-stage";

/*
  The music box's look without its shader: the palette, the poster that
  paints before (and instead of) the canvas, and the alt. A module of its
  own so the trades window on the homepage can show this row's poster (on
  a posters-only device) without downloading the shader.
*/

/* The poster below was measured against the shader's 4:5 frame as it was
   first drawn — focal length 1.55, lifted 0.08 — and the frame has since
   been pulled back and lifted to clear the kicker (see main() in
   scene.ts). Only the focal length and the lift changed, and that is an
   exact similarity of the picture: a zoom about the frame's centre and a
   vertical shift. So
   the measured numbers stay as they were measured and are carried into
   the new frame here, rather than re-guessed off a new render; angles and
   the percentage stops inside a box do not change under a similarity, so
   only positions and pixel lengths go through it.
     K     the zoom, new focal length over old
     LIFT  the new lift less the zoomed old one, in half-heights
   A background-position of calc(50% + x) scales as x does, because the
   box it places scales with it. */
const PH = 488;
const K = 1.07 / 1.55;
const LIFT = 0.282 - 0.08 * K;
const len = (n: number) => `${+(n * K).toFixed(2)}px`;
const ay = (y: number) => `${+((PH / 2) * (1 - K - LIFT) + K * y).toFixed(2)}px`;
const ax = (x: number) => `calc(50% ${x < 0 ? "-" : "+"} ${len(Math.abs(x))})`;
/* A box, by its measured position and size. */
const box = (x: number, y: number, w: number, h: number) => `${ax(x)} ${ay(y)} / ${len(w)} ${len(h)} no-repeat`;

export const look: Omit<Scene, "frag"> = {
  colors: ["#551a89", "#7c74a6", "#f4f3f7", "#ffffff"],
  /* The movement as stacked gradients — what a slow phone shows until the
     shader compiles, and what a device without WebGL keeps. Solved at
     390x488 against the shader's own frame at uTime 2: every position
     below came off a grid laid over that render, every colour off a pixel
     sample of it, and the two were overlaid at half opacity to check.
     The numbers are the ones measured then; ax, ay, len and box carry
     them into the frame the shader draws now (see above them).

     Each angled edge is a HARD STOP on a linear gradient whose angle is
     the edge's normal, solved from two measured points — the cylinder is
     two such bands (its near end is fatter than its far one, so one band
     cannot hold both edges), the comb base one, the bedplate one. A
     gradient can only cut with parallel lines, so the bedplate's two
     other edges are cut by MASKS painted in the table's own colour, and
     that is why the table under all of this is a flat #f4f3f7 rather
     than the house wash: a mask is invisible only against a flat ground.

     Every gradient that ends on a colour also ends on a transparent stop,
     because a CSS gradient carries its last colour out to the edge of its
     box. The top fade is in pixels, not per cent, so on a tall band it
     never reaches the cylinder.

     Layers, top to bottom: haze, pins, arbor, right bridge, end caps,
     cylinder (lower, upper), screws, comb base, teeth shade, teeth,
     contact, masks, bedplate, table. */
  poster: [
    `linear-gradient(to bottom, #ffffff 0, rgb(255 255 255 / 0) ${ay(132)})`,
    // pins: dark steel with a bright top
    ...[[-47, 157], [-32, 155], [-16, 161], [20, 177], [45, 197], [77, 220], [38, 229]].map(
      ([x, y]) =>
        `radial-gradient(${len(4.5)} ${len(4)} at ${ax(x)} ${ay(y)}, #eef0f4 0 22%, #6a6e76 50%, #2a2c31 82%, rgb(42 44 49 / 0) 100%)`,
    ),
    // the arbor's end, by the right bridge
    `radial-gradient(${len(5)} ${len(3.5)} at ${ax(108)} ${ay(240)}, #c9ccd2 0 30%, #4a4d54 80%, rgb(74 77 84 / 0) 100%)`,
    // right bridge: a steel post lit on its left, with its top face
    `linear-gradient(to right, #8b9099 0%, #5b5f67 45%, #34373d 100%) ${box(116, 212, 22, 66)}`,
    `linear-gradient(to bottom, #d7dae0 0 ${len(5)}, rgb(215 218 224 / 0) ${len(5)}) ${box(116, 212, 22, 66)}`,
    // the cylinder's end caps: the near one with a bright rim
    `radial-gradient(${len(9)} ${len(42)} at ${ax(114)} ${ay(221)}, #3f3218 0 55%, #c8a14f 72%, #f0d58a 82%, rgb(240 213 138 / 0) 100%)`,
    `radial-gradient(${len(6)} ${len(27)} at ${ax(-85)} ${ay(187)}, #4a3a1c 0 55%, #c9a24e 78%, rgb(201 162 78 / 0) 100%)`,
    // the cylinder: lower half parallel to its bottom edge, going dark …
    `linear-gradient(194.11deg, rgb(244 243 247 / 0) 46.48%, #c4a25a 46.79%, #9c7f45 50.74%, #6f5831 56.23%, #3f321b 61.71%, #1d170d 65.36%, #15110b 67.19%, rgb(244 243 247 / 0) 67.68%) ${box(15, 150, 204, 118)}`,
    // … upper half parallel to its top edge, carrying the key's streak
    `linear-gradient(185.86deg, rgb(244 243 247 / 0) 22.68%, #b8923f 23.25%, #f3dc8e 24.67%, #e9c874 28.95%, #fff3c8 35.37%, #fffbea 40.37%, #f1d88f 45.36%, #c8a45a 51.78%, #9c7f45 60.34%, rgb(244 243 247 / 0) 60.77%) ${box(15, 148, 204, 120)}`,
    // the comb's three screws
    ...[[-113, 243], [-49, 263], [35, 290]].map(
      ([x, y]) =>
        `radial-gradient(${len(6)} ${len(3.5)} at ${ax(x)} ${ay(y)}, #f7f8fa 0 35%, #8d9199 70%, rgb(141 145 153 / 0) 100%)`,
    ),
    // the comb base: light top face, a bright arris, a dark front face
    `linear-gradient(193.42deg, rgb(244 243 247 / 0) 39.79%, #d9dce3 40.17%, #f1f3f7 43.32%, #c4c8cf 46.48%, #6c7077 47.11%, #474a51 52.15%, #2e3035 57.83%, rgb(244 243 247 / 0) 59.09%) ${box(-26, 225, 222, 110)}`,
    // the teeth go greyer to the right, as the overhead sweep leaves them
    `linear-gradient(to right, rgb(40 42 50 / 0) 0%, rgb(40 42 50 / 0.34) 100%) ${box(-5, 208, 184, 86)}`,
    // twelve teeth, measured at 126deg and a 14.6px pitch; three boxes so
    // none of them reaches out from under the comb base
    ...[[-66, 208, 62, 54], [-5, 221, 60, 55], [56, 236, 62, 57]].map(
      ([x, y, w, h]) =>
        `repeating-linear-gradient(126deg, #eceef3 0 ${len(3)}, #cdd0d7 ${len(3)} ${len(10.6)}, #8d9098 ${len(10.6)} ${len(11.6)}, #17181b ${len(11.6)} ${len(14.6)}) ${box(x, y, w, h)}`,
    ),
    // contact under the bedplate's front edge, in the house ink
    `linear-gradient(202.02deg, rgb(85 26 137 / 0) 50.12%, rgb(85 26 137 / 0.22) 50.37%, rgb(85 26 137 / 0.12) 51.2%, rgb(85 26 137 / 0) 55.76%) ${box(-30, 236, 282, 146)}`,
    // masks: the bedplate's far-left edge, its right face, its far-right edge
    `linear-gradient(155.82deg, #f4f3f7 67.93%, rgb(244 243 247 / 0) 68.53%) ${box(-109, 110, 172, 142)}`,
    `linear-gradient(118.69deg, rgb(244 243 247 / 0) 39.55%, #6e5327 39.91%, #4a3616 42.75%, #f4f3f7 43.46%) ${box(145, 262, 104, 103)}`,
    // and the corner past the near edge, where no angled mask can reach
    `linear-gradient(#f4f3f7, #f4f3f7) ${box(151, 364, 90, 20)}`,
    `linear-gradient(202.25deg, #f4f3f7 62.34%, rgb(244 243 247 / 0) 62.93%) ${box(81, 140, 232, 126)}`,
    // the bedplate: satin brass, and its front face in shadow
    `linear-gradient(202.02deg, #a47a32 7.58%, #bf9244 41.56%, #cda052 59.91%, #e2bb6a 61.77%, #7a5a28 61.94%, #4a3616 64.32%, rgb(244 243 247 / 0) 64.53%) ${box(-4, 183, 330, 184)}`,
    // the table: flat on purpose (see above)
    "#f4f3f7",
  ].join(", "),
  alt: "A brass music-box movement on a pale table, seen close: a pinned brass cylinder turning slowly above a steel comb of twelve graded teeth. As each pin comes round it lifts a tooth, lets it go, and the tooth shivers; the pins are set so the plucks run up and down the comb like a tune.",
};
