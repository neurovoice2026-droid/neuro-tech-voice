import type { Scene } from "../../shader-stage";

/**
 * The home-services scene's look without its shader: the palette, the poster
 * that paints before (and instead of) the canvas, and the alt. A module
 * of its own so the trades window on the homepage can show every trade's
 * poster (on a posters-only device) without downloading a single shader.
 */
export const look: Omit<Scene, "frag"> = {
  colors: ["#551a89", "#7c7aa8", "#eef1f6", "#ffffff"],
  /* The same picture as far as stacked gradients can carry one, solved
     at 390x488 - the band a phone gets, and the only band where a poster
     really matters, because it is what a reader on a slow connection
     looks at until the shader has compiled and what a device with no
     WebGL is left with for good. The wall, the bowl with its rolled rim,
     the chrome arch standing on the back of it, and the bead at the
     mouth. Every stop is an exact interpolation of the four colours
     above and the house violet, since CSS cannot mix them at paint time
     and a hand-picked near-miss is precisely the drift the palette
     exists to stop. */
  poster: [
    /* Every radius is in PIXELS off a centre placed with calc(), and every
       number was measured off the shader's own frame at 390x488 — the band
       a phone gets, which is the band this poster is actually for. A
       percentage radius is measured against width and height separately,
       so the same stop that is a round bead on a 21:9 band is a tall oval
       on a 4:5 one. */
    // The bead at the aerator, which is the whole subject.
    "radial-gradient(circle 8px at calc(50% + 43px) 39.5%, #ffffff 0 4px, rgb(255 255 255 / 0) 8px)",
    // The aerator collar at the mouth.
    "radial-gradient(17px 6px at calc(50% + 42px) 37.1%, #7c8088 0 52%, #1e2025 88%, rgb(255 255 255 / 0) 100%)",
    /* The pivot, then the lever — and in that order, because the first
       layer of a CSS background is the one on TOP, and what is nearest
       the eye here is the collar. This used to be a single ellipse
       floating in the gap between the two legs with the bead hanging
       under its near end: the same fault the shader had, drawn in CSS.
       An ellipse tapers to nothing at both ends, so it could not touch
       anything even where it overlapped, and the poster is what a phone
       on a slow connection looks at for as long as the compile takes.

       So it is now the two parts the shader has. The collar is a BAR, a
       fifth wider than the leg it wraps and standing a little proud of
       it on both sides, with the chrome's own section across it. The arm
       is a second bar running out of it, and it stops INSIDE the collar
       rather than at its edge, so no rounding of a percentage can open a
       seam between them. Every POSITION is read off the shader's own
       frame at 390x488: the leg is 27px across at x 294, the collar 33px
       at 291, the arm 11px deep from x 258 to the collar.

       The COLOUR is not read off that frame, and that is deliberate. The
       poster's chrome is graded a good deal deeper than the shader's is
       — a stack of gradients cannot carry a mirror, so it carries a dark
       tube with one hard bright streak instead, and every leg in this
       poster is on that grade. Two bars dropped in at the shader's own
       lighter values came back looking pasted onto the tap rather than
       turned out of it. So both use the LEGS' section, lifted one step
       because a collar standing proud of its column and a lever facing
       the bounce card both do catch more light than the column does. */
    "linear-gradient(to right, rgb(255 255 255 / 0) 0 2%, #232529 8%, #7a7f89 21%, #a9adb5 34%, #767d8a 55%, #4a5161 78%, #333842 95%, rgb(255 255 255 / 0) 100%) calc(50% + 112.5px) 33.2% / 33px 21px no-repeat",
    "linear-gradient(to bottom, #202227 0 8%, #a6aab2 19%, #949aa4 36%, #848b97 56%, #6b7280 78%, #3a3f4a 90%, #202329 97%) calc(50% + 82.5px) 34.6% / 39px 11px no-repeat",
    /* The two legs, and they are BARS rather than the stretched ellipses
       every earlier cut of this poster used. An ellipse tapers at both
       ends, and a tapered leg under a blob of an arc is why two attempts
       at this came back reading as an exclamation mark. A layer with its
       own size and position is a rectangle, and a rectangle with the
       chrome's own section across it — dark edge, the bounce card's hard
       bright streak at a third, mid, dark edge — is a tube. That streak
       is the whole difference between chrome and a grey pipe, in the
       poster exactly as in the shader.

       The x offset works out at 50% of the band plus a fixed number of
       pixels whatever the band is wide, because a mixed background
       position resolves to (container - layer) * p + length, and the
       layer's own width is in that subtraction. */
    "linear-gradient(to right, rgb(255 255 255 / 0) 0 3%, #191a1d 9%, #6a6f79 22%, #9da1a9 34%, #6b7280 54%, #414857 78%, #2b2f39 95%, rgb(255 255 255 / 0) 100%) calc(50% + 42.5px) 27.1% / 30px 74px no-repeat",
    "linear-gradient(to right, rgb(255 255 255 / 0) 0 3%, #191a1d 9%, #6a6f79 22%, #9da1a9 34%, #6b7280 54%, #414857 78%, #2b2f39 95%, rgb(255 255 255 / 0) 100%) calc(50% + 112.5px) 32.0% / 30px 150px no-repeat",
    /* The OPENING under the arch, punched back out of the arc below it in
       the wall's own colour. CSS can draw an annulus but it cannot open
       one at the bottom, and a closed ring standing on two legs reads as
       a hand mirror — which is what two earlier attempts at this poster
       looked like. Two ellipses: the eye of the arch, and the gap that
       runs down between the legs under it. */
    "radial-gradient(21px 20px at calc(50% + 77px) 26.2%, #ecedf4 0 92%, rgb(236 237 244 / 0) 100%)",
    "radial-gradient(21px 34px at calc(50% + 77px) 32.4%, #eef0f5 0 92%, rgb(238 240 245 / 0) 100%)",
    // The arc itself, and the sweep caught along its outer shoulder.
    "radial-gradient(7px 13px at calc(50% + 53px) 21.3%, #a8acb4 0 44%, rgb(255 255 255 / 0) 100%)",
    "radial-gradient(49px 46px at calc(50% + 77px) 26.6%, #565b66 0 50%, #292c33 86%, rgb(255 255 255 / 0) 100%)",
    // The base flange, standing on the deck at the back of the basin.
    "radial-gradient(17px 6px at calc(50% + 111px) 53.5%, #6f737b 0 52%, #1e2025 88%, rgb(255 255 255 / 0) 100%)",
    /* The bowl: the glaze inside it, the rolled rim round it and the body
       under that, the last of it going into the paper the kicker is
       printed on — which is what the shader does too. */
    "radial-gradient(178px 31px at calc(50% - 10px) 60.7%, #ffffff 0 52%, #f2eeee 78%, #d9d4dc 96%, rgb(255 255 255 / 0) 100%)",
    "radial-gradient(215px 38px at calc(50% - 10px) 59.6%, #ffffff 0 80%, #bcb9c1 93%, rgb(255 255 255 / 0) 100%)",
    "radial-gradient(202px 62px at calc(50% - 10px) 63.9%, #ffffff 0 60%, #ece9ef 84%, #c9c5d3 96%, rgb(255 255 255 / 0) 100%)",
    // The pool of light the work is under.
    "radial-gradient(64% 44% at 62% 42%, rgb(255 255 255 / 0.50) 0%, rgb(255 255 255 / 0) 100%)",
    /* And the wall, deepening as it climbs the way the shader's does.
       Every stop is an exact interpolation of the four colours above and
       the house violet, since CSS cannot mix them at paint time and a
       hand-picked near-miss is precisely the drift the palette exists to
       stop: #d7d9e6 is 20% of the mid violet in the pale, #dddfea 15%,
       #e3e5ee 10%, #e7eaf1 6%, and #f7f8fb is halfway from the pale to
       paper. */
    "linear-gradient(to bottom, #d7d9e6 0%, #dddfea 13%, #e3e5ee 26%, #e7eaf1 42%, #e7eaf1 54%, #f7f8fb 76%, #ffffff 92%)",
  ].join(", "),
  alt: "A chrome mixer tap over a white glazed basin set into a pale stone counter, seen close and in three-quarter profile so the gooseneck's arch stands clear of the column. A bead of water gathers at the aerator, sags, lets go and falls towards you, and breaks on the porcelain in a crown of seven droplets with a ring running out across the wet patch. Then the mouth starts loading again."
};
