import type { Scene } from "../../shader-stage";

/**
 * The salons-spas scene's look without its shader: the palette, the poster
 * that paints before (and instead of) the canvas, and the alt. A module
 * of its own so the trades window on the homepage can show every trade's
 * poster (on a posters-only device) without downloading a single shader.
 */
export const look: Omit<Scene, "frag"> = {
  colors: ["#551a89", "#8579ab", "#f4f3f7", "#ffffff"],
  /* The station top, as far as stacked gradients can carry it — and they
     have to carry it, because this is what a reader on a slow phone looks
     at until the shader has compiled, and what a device with no WebGL is
     left with for good. Solved at 390x487, the band a phone gets, and laid
     out the way the phone tier lays it out: the pair down on the counter
     running the diagonal, blades up to the right, rings and rest low and
     left, the comb behind them, two cuttings on the top and a soft dark
     under everything where it touches. Every chain is spaced under its own
     radius, or a chain of circles reads as a row of beads rather than as a
     tapered stroke — which is what the first cut of this did. */
  poster:
    "radial-gradient(circle 5px at 67.18% 48.87%, #4e3220 0 2.2px, rgb(255 255 255 / 0) 3.2px), " +
    "radial-gradient(circle 5px at 69.23% 49.18%, #4e3220 0 2.2px, rgb(255 255 255 / 0) 3.2px), " +
    "radial-gradient(circle 5px at 71.08% 49.62%, #4e3220 0 2.2px, rgb(255 255 255 / 0) 3.2px), " +
    "radial-gradient(circle 5px at 72.56% 50.31%, #4e3220 0 2.2px, rgb(255 255 255 / 0) 3.2px), " +
    "radial-gradient(circle 5px at 73.64% 51.27%, #4e3220 0 2.2px, rgb(255 255 255 / 0) 3.2px), " +
    "radial-gradient(circle 5px at 74.36% 52.46%, #4e3220 0 2.2px, rgb(255 255 255 / 0) 3.2px), " +
    "radial-gradient(circle 5px at 74.87% 53.80%, #4e3220 0 2.2px, rgb(255 255 255 / 0) 3.2px), " +
    "radial-gradient(circle 5px at 30.77% 71.87%, #4e3220 0 2.2px, rgb(255 255 255 / 0) 3.2px), " +
    "radial-gradient(circle 5px at 32.99% 70.94%, #4e3220 0 2.2px, rgb(255 255 255 / 0) 3.2px), " +
    "radial-gradient(circle 5px at 35.01% 70.16%, #4e3220 0 2.2px, rgb(255 255 255 / 0) 3.2px), " +
    "radial-gradient(circle 5px at 36.67% 69.61%, #4e3220 0 2.2px, rgb(255 255 255 / 0) 3.2px), " +
    "radial-gradient(circle 5px at 37.91% 69.34%, #4e3220 0 2.2px, rgb(255 255 255 / 0) 3.2px), " +
    "radial-gradient(circle 5px at 38.80% 69.30%, #4e3220 0 2.2px, rgb(255 255 255 / 0) 3.2px), " +
    "radial-gradient(circle 5px at 39.49% 69.40%, #4e3220 0 2.2px, rgb(255 255 255 / 0) 3.2px), " +
    "radial-gradient(circle 12px at 57.95% 34.09%, #c8cad0 0 10.0px, rgb(255 255 255 / 0) 11.0px), " +
    "radial-gradient(circle 12px at 59.69% 33.57%, #caccd2 0 9.6px, rgb(255 255 255 / 0) 10.6px), " +
    "radial-gradient(circle 12px at 61.42% 33.06%, #ccced4 0 9.3px, rgb(255 255 255 / 0) 10.3px), " +
    "radial-gradient(circle 11px at 63.16% 32.55%, #cdcfd5 0 8.9px, rgb(255 255 255 / 0) 9.9px), " +
    "radial-gradient(circle 11px at 64.90% 32.03%, #cfd1d7 0 8.5px, rgb(255 255 255 / 0) 9.5px), " +
    "radial-gradient(circle 11px at 66.64% 31.52%, #d1d3d9 0 8.2px, rgb(255 255 255 / 0) 9.2px), " +
    "radial-gradient(circle 10px at 68.38% 31.01%, #d3d5db 0 7.8px, rgb(255 255 255 / 0) 8.8px), " +
    "radial-gradient(circle 10px at 70.11% 30.49%, #d4d6dc 0 7.4px, rgb(255 255 255 / 0) 8.4px), " +
    "radial-gradient(circle 10px at 71.85% 29.98%, #d6d8de 0 7.1px, rgb(255 255 255 / 0) 8.1px), " +
    "radial-gradient(circle 9px at 73.59% 29.47%, #d8dae0 0 6.7px, rgb(255 255 255 / 0) 7.7px), " +
    "radial-gradient(circle 9px at 75.33% 28.95%, #dadce2 0 6.3px, rgb(255 255 255 / 0) 7.3px), " +
    "radial-gradient(circle 8px at 77.07% 28.44%, #dcdee4 0 6.0px, rgb(255 255 255 / 0) 7.0px), " +
    "radial-gradient(circle 8px at 78.80% 27.93%, #dddfe5 0 5.6px, rgb(255 255 255 / 0) 6.6px), " +
    "radial-gradient(circle 8px at 80.54% 27.41%, #dfe1e7 0 5.2px, rgb(255 255 255 / 0) 6.2px), " +
    "radial-gradient(circle 7px at 82.28% 26.90%, #e1e3e9 0 4.9px, rgb(255 255 255 / 0) 5.9px), " +
    "radial-gradient(circle 7px at 84.02% 26.39%, #e3e5eb 0 4.5px, rgb(255 255 255 / 0) 5.5px), " +
    "radial-gradient(circle 7px at 85.75% 25.87%, #e4e6ec 0 4.1px, rgb(255 255 255 / 0) 5.1px), " +
    "radial-gradient(circle 6px at 87.49% 25.36%, #e6e8ee 0 3.8px, rgb(255 255 255 / 0) 4.8px), " +
    "radial-gradient(circle 6px at 89.23% 24.85%, #e8eaf0 0 3.4px, rgb(255 255 255 / 0) 4.4px), " +
    "radial-gradient(circle 11px at 57.95% 37.58%, #a7a9af 0 9.0px, rgb(255 255 255 / 0) 10.0px), " +
    "radial-gradient(circle 11px at 59.63% 37.23%, #a9abb1 0 8.7px, rgb(255 255 255 / 0) 9.7px), " +
    "radial-gradient(circle 11px at 61.31% 36.89%, #acaeb4 0 8.3px, rgb(255 255 255 / 0) 9.3px), " +
    "radial-gradient(circle 10px at 62.99% 36.55%, #aeb0b6 0 8.0px, rgb(255 255 255 / 0) 9.0px), " +
    "radial-gradient(circle 10px at 64.67% 36.21%, #b0b2b8 0 7.7px, rgb(255 255 255 / 0) 8.7px), " +
    "radial-gradient(circle 10px at 66.35% 35.87%, #b2b4ba 0 7.3px, rgb(255 255 255 / 0) 8.3px), " +
    "radial-gradient(circle 9px at 68.03% 35.52%, #b5b7bd 0 7.0px, rgb(255 255 255 / 0) 8.0px), " +
    "radial-gradient(circle 9px at 69.72% 35.18%, #b7b9bf 0 6.7px, rgb(255 255 255 / 0) 7.7px), " +
    "radial-gradient(circle 9px at 71.40% 34.84%, #b9bbc1 0 6.3px, rgb(255 255 255 / 0) 7.3px), " +
    "radial-gradient(circle 8px at 73.08% 34.50%, #bcbec4 0 6.0px, rgb(255 255 255 / 0) 7.0px), " +
    "radial-gradient(circle 8px at 74.76% 34.15%, #bec0c6 0 5.7px, rgb(255 255 255 / 0) 6.7px), " +
    "radial-gradient(circle 8px at 76.44% 33.81%, #c0c2c8 0 5.3px, rgb(255 255 255 / 0) 6.3px), " +
    "radial-gradient(circle 7px at 78.12% 33.47%, #c2c4ca 0 5.0px, rgb(255 255 255 / 0) 6.0px), " +
    "radial-gradient(circle 7px at 79.80% 33.13%, #c5c7cd 0 4.7px, rgb(255 255 255 / 0) 5.7px), " +
    "radial-gradient(circle 7px at 81.48% 32.79%, #c7c9cf 0 4.3px, rgb(255 255 255 / 0) 5.3px), " +
    "radial-gradient(circle 6px at 83.16% 32.44%, #c9cbd1 0 4.0px, rgb(255 255 255 / 0) 5.0px), " +
    "radial-gradient(circle 6px at 84.84% 32.10%, #cbcdd3 0 3.7px, rgb(255 255 255 / 0) 4.7px), " +
    "radial-gradient(circle 6px at 86.52% 31.76%, #ced0d6 0 3.3px, rgb(255 255 255 / 0) 4.3px), " +
    "radial-gradient(circle 5px at 88.21% 31.42%, #d0d2d8 0 3.0px, rgb(255 255 255 / 0) 4.0px), " +
    "radial-gradient(circle 18px at 53.08% 35.73%, #b7b9bf 0 16.0px, rgb(255 255 255 / 0) 17.0px), " +
    "radial-gradient(circle 13px at 52.82% 35.32%, #e0b75f 0 10.5px, rgb(255 255 255 / 0) 11.5px), " +
    "radial-gradient(circle 7px at 52.05% 34.70%, #f3da9c 0 4.2px, rgb(255 255 255 / 0) 5.2px), " +
    "radial-gradient(circle 11px at 50.26% 34.91%, #b4b6bc 0 8.2px, rgb(255 255 255 / 0) 9.2px), " +
    "radial-gradient(circle 11px at 47.88% 35.41%, #b2b4ba 0 8.1px, rgb(255 255 255 / 0) 9.1px), " +
    "radial-gradient(circle 10px at 45.50% 35.92%, #afb1b7 0 7.9px, rgb(255 255 255 / 0) 8.9px), " +
    "radial-gradient(circle 10px at 43.12% 36.42%, #adafb5 0 7.8px, rgb(255 255 255 / 0) 8.8px), " +
    "radial-gradient(circle 10px at 40.75% 36.92%, #abadb3 0 7.6px, rgb(255 255 255 / 0) 8.6px), " +
    "radial-gradient(circle 10px at 38.37% 37.43%, #a8aab0 0 7.5px, rgb(255 255 255 / 0) 8.5px), " +
    "radial-gradient(circle 10px at 35.99% 37.93%, #a6a8ae 0 7.3px, rgb(255 255 255 / 0) 8.3px), " +
    "radial-gradient(circle 10px at 33.61% 38.44%, #a3a5ab 0 7.2px, rgb(255 255 255 / 0) 8.2px), " +
    "radial-gradient(circle 10px at 31.24% 38.94%, #a1a3a9 0 7.0px, rgb(255 255 255 / 0) 8.0px), " +
    "radial-gradient(circle 9px at 28.86% 39.44%, #9fa1a7 0 6.9px, rgb(255 255 255 / 0) 7.9px), " +
    "radial-gradient(circle 9px at 26.48% 39.95%, #9c9ea4 0 6.7px, rgb(255 255 255 / 0) 7.7px), " +
    "radial-gradient(circle 9px at 24.10% 40.45%, #9a9ca2 0 6.6px, rgb(255 255 255 / 0) 7.6px), " +
    "radial-gradient(circle 11px at 51.03% 37.99%, #a7a9af 0 8.2px, rgb(255 255 255 / 0) 9.2px), " +
    "radial-gradient(circle 11px at 48.79% 39.29%, #a5a7ad 0 8.1px, rgb(255 255 255 / 0) 9.1px), " +
    "radial-gradient(circle 10px at 46.55% 40.60%, #a2a4aa 0 7.9px, rgb(255 255 255 / 0) 8.9px), " +
    "radial-gradient(circle 10px at 44.31% 41.91%, #a0a2a8 0 7.8px, rgb(255 255 255 / 0) 8.8px), " +
    "radial-gradient(circle 10px at 42.07% 43.21%, #9ea0a6 0 7.6px, rgb(255 255 255 / 0) 8.6px), " +
    "radial-gradient(circle 10px at 39.84% 44.52%, #9c9ea4 0 7.5px, rgb(255 255 255 / 0) 8.5px), " +
    "radial-gradient(circle 10px at 37.60% 45.83%, #999ba1 0 7.3px, rgb(255 255 255 / 0) 8.3px), " +
    "radial-gradient(circle 10px at 35.36% 47.13%, #97999f 0 7.2px, rgb(255 255 255 / 0) 8.2px), " +
    "radial-gradient(circle 10px at 33.12% 48.44%, #95979d 0 7.0px, rgb(255 255 255 / 0) 8.0px), " +
    "radial-gradient(circle 9px at 30.89% 49.75%, #93959b 0 6.9px, rgb(255 255 255 / 0) 7.9px), " +
    "radial-gradient(circle 9px at 28.65% 51.05%, #909298 0 6.7px, rgb(255 255 255 / 0) 7.7px), " +
    "radial-gradient(circle 9px at 26.41% 52.36%, #8e9096 0 6.6px, rgb(255 255 255 / 0) 7.6px), " +
    "radial-gradient(circle 27px at 19.23% 41.07%, rgb(255 255 255 / 0) 0 10.9px, #b9bbc1 11.7px 24.1px, rgb(255 255 255 / 0) 25.1px), " +
    "radial-gradient(circle 27px at 22.56% 54.41%, rgb(255 255 255 / 0) 0 10.9px, #aaacb2 11.7px 24.1px, rgb(255 255 255 / 0) 25.1px), " +
    "radial-gradient(circle 8px at 23.33% 58.32%, #a2a4aa 0 5.6px, rgb(255 255 255 / 0) 6.6px), " +
    "radial-gradient(circle 8px at 23.72% 59.96%, #9fa1a7 0 5.4px, rgb(255 255 255 / 0) 6.4px), " +
    "radial-gradient(circle 8px at 24.10% 61.60%, #9c9ea4 0 5.3px, rgb(255 255 255 / 0) 6.3px), " +
    "radial-gradient(circle 8px at 24.49% 63.24%, #999ba1 0 5.2px, rgb(255 255 255 / 0) 6.2px), " +
    "radial-gradient(circle 7px at 24.87% 64.89%, #96989e 0 5.0px, rgb(255 255 255 / 0) 6.0px), " +
    "radial-gradient(circle 5px at 11.28% 37.17%, #33333a 0 2.4px, rgb(255 255 255 / 0) 3.4px), " +
    "radial-gradient(circle 4px at 13.33% 39.63%, #26262c 0 1.9px, rgb(255 255 255 / 0) 2.9px), " +
    "radial-gradient(circle 5px at 14.87% 35.06%, #33333a 0 2.4px, rgb(255 255 255 / 0) 3.4px), " +
    "radial-gradient(circle 4px at 16.92% 37.53%, #26262c 0 1.9px, rgb(255 255 255 / 0) 2.9px), " +
    "radial-gradient(circle 5px at 18.46% 32.96%, #33333a 0 2.4px, rgb(255 255 255 / 0) 3.4px), " +
    "radial-gradient(circle 4px at 20.51% 35.42%, #26262c 0 1.9px, rgb(255 255 255 / 0) 2.9px), " +
    "radial-gradient(circle 5px at 22.05% 30.85%, #33333a 0 2.4px, rgb(255 255 255 / 0) 3.4px), " +
    "radial-gradient(circle 4px at 24.10% 33.32%, #26262c 0 1.9px, rgb(255 255 255 / 0) 2.9px), " +
    "radial-gradient(circle 5px at 25.64% 28.75%, #33333a 0 2.4px, rgb(255 255 255 / 0) 3.4px), " +
    "radial-gradient(circle 4px at 27.69% 31.21%, #26262c 0 1.9px, rgb(255 255 255 / 0) 2.9px), " +
    "radial-gradient(circle 5px at 29.23% 26.64%, #33333a 0 2.4px, rgb(255 255 255 / 0) 3.4px), " +
    "radial-gradient(circle 4px at 31.28% 29.11%, #26262c 0 1.9px, rgb(255 255 255 / 0) 2.9px), " +
    "radial-gradient(circle 5px at 32.82% 24.54%, #33333a 0 2.4px, rgb(255 255 255 / 0) 3.4px), " +
    "radial-gradient(circle 4px at 34.87% 27.00%, #26262c 0 1.9px, rgb(255 255 255 / 0) 2.9px), " +
    "radial-gradient(circle 5px at 36.41% 22.43%, #33333a 0 2.4px, rgb(255 255 255 / 0) 3.4px), " +
    "radial-gradient(circle 4px at 38.46% 24.90%, #26262c 0 1.9px, rgb(255 255 255 / 0) 2.9px), " +
    "radial-gradient(circle 5px at 40.00% 20.33%, #33333a 0 2.4px, rgb(255 255 255 / 0) 3.4px), " +
    "radial-gradient(circle 4px at 42.05% 22.79%, #26262c 0 1.9px, rgb(255 255 255 / 0) 2.9px), " +
    "radial-gradient(circle 9px at 7.69% 32.85%, #3a3a42 0 6.2px, rgb(255 255 255 / 0) 7.2px), " +
    "radial-gradient(circle 9px at 9.64% 31.73%, #3b3b43 0 6.2px, rgb(255 255 255 / 0) 7.2px), " +
    "radial-gradient(circle 9px at 11.59% 30.61%, #3b3b44 0 6.2px, rgb(255 255 255 / 0) 7.2px), " +
    "radial-gradient(circle 9px at 13.54% 29.49%, #3c3c44 0 6.2px, rgb(255 255 255 / 0) 7.2px), " +
    "radial-gradient(circle 9px at 15.49% 28.36%, #3d3d45 0 6.2px, rgb(255 255 255 / 0) 7.2px), " +
    "radial-gradient(circle 9px at 17.44% 27.24%, #3e3e46 0 6.2px, rgb(255 255 255 / 0) 7.2px), " +
    "radial-gradient(circle 9px at 19.38% 26.12%, #3e3e47 0 6.2px, rgb(255 255 255 / 0) 7.2px), " +
    "radial-gradient(circle 9px at 21.33% 25.00%, #3f3f48 0 6.2px, rgb(255 255 255 / 0) 7.2px), " +
    "radial-gradient(circle 9px at 23.28% 23.87%, #404048 0 6.2px, rgb(255 255 255 / 0) 7.2px), " +
    "radial-gradient(circle 9px at 25.23% 22.75%, #414149 0 6.2px, rgb(255 255 255 / 0) 7.2px), " +
    "radial-gradient(circle 9px at 27.18% 21.63%, #41414a 0 6.2px, rgb(255 255 255 / 0) 7.2px), " +
    "radial-gradient(circle 9px at 29.13% 20.51%, #42424b 0 6.2px, rgb(255 255 255 / 0) 7.2px), " +
    "radial-gradient(circle 9px at 31.08% 19.38%, #43434c 0 6.2px, rgb(255 255 255 / 0) 7.2px), " +
    "radial-gradient(circle 9px at 33.03% 18.26%, #44444c 0 6.2px, rgb(255 255 255 / 0) 7.2px), " +
    "radial-gradient(circle 9px at 34.97% 17.14%, #44444d 0 6.2px, rgb(255 255 255 / 0) 7.2px), " +
    "radial-gradient(circle 9px at 36.92% 16.02%, #45454e 0 6.2px, rgb(255 255 255 / 0) 7.2px), " +
    "radial-gradient(60px 42px at 25% 58%, rgb(54 46 74 / 0.40) 0%, rgb(54 46 74 / 0) 100%), " +
    "radial-gradient(90px 40px at 62% 40%, rgb(54 46 74 / 0.30) 0%, rgb(54 46 74 / 0) 100%), " +
    "radial-gradient(72px 40px at 27% 31%, rgb(54 46 74 / 0.24) 0%, rgb(54 46 74 / 0) 100%), " +
    "radial-gradient(78% 52% at 46% 40%, rgb(255 255 255 / 0.82) 0%, rgb(255 255 255 / 0) 100%), " +
    "linear-gradient(to bottom, #b4aecb 0%, #c4c0d8 22%, #ddd9ea 48%, #f2f1f7 72%, #ffffff 90%)",
  alt: "Looking down on a salon station top: a pair of polished Japanese shears lying on the counter with the brass tension dial bright at the pivot, a black carbon cutting comb behind them, and the morning's cut hair scattered around — and the blades open slowly and shut, over and over, the soft dark under them moving as they go.",
};
