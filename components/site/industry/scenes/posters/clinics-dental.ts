import type { Scene } from "../../shader-stage";

/**
 * The clinics-dental scene's look without its shader: the palette, the poster
 * that paints before (and instead of) the canvas, and the alt. A module
 * of its own so the trades window on the homepage can show every trade's
 * poster (on a posters-only device) without downloading a single shader.
 */
export const look: Omit<Scene, "frag"> = {
  colors: ["#551a89", "#a996c0", "#f4f3f7", "#ffffff"],
  /* The same frame, as far as stacked gradients carry one: the room pale
     at the head of the band and paper at its foot, the light the mirror
     is throwing off to one side, and the instrument itself — the round
     face with the studio's horizon curving across it, dark above and
     bright below, set in its steel bezel, then the shank, the ferrule,
     the teal ID ring and the handle running away right and down,
     narrowing as it goes because that is what perspective does to it.

     EVERY TONE BELOW WAS READ OFF THE SHADER'S OWN FRAME with a pixel
     sampler rather than picked by eye, which is the only way a poster and
     a canvas end up being the same object instead of two near-misses —
     and it matters more than usual here, because the last version of both
     was violet and the fix had to reach the thing a phone actually looks
     at while the shader is still compiling. The wall runs #ab9ac1 to
     white, the way the canvas does; the face carries the horizon; the
     steel is neutral; the ID ring is the one saturated colour. It
     keeps its aspect ('meet', never 'none'), because an instrument
     stretched to fit a band is a different object, and its viewBox is
     padded so 'contain' stays height-bound at 4:5 and at 21:9 alike —
     which puts the head where the shader puts it, so the canvas fading
     in over the poster does not make it jump. On a slow phone this is
     what the reader looks at until the shader has compiled, and on a
     device with no WebGL it is the whole artwork. */
  poster: [
    `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 132 74' preserveAspectRatio='xMidYMid meet'><defs><linearGradient id='s' gradientUnits='userSpaceOnUse' x1='56' y1='32.5' x2='54.7' y2='37.74'><stop offset='0' stop-color='%239a9aa4'/><stop offset='0.22' stop-color='%236c7082'/><stop offset='0.48' stop-color='%23838c9a'/><stop offset='0.74' stop-color='%2388919e'/><stop offset='1' stop-color='%236f7680'/></linearGradient><linearGradient id='m' x1='0.18' y1='0' x2='0.40' y2='1'><stop offset='0' stop-color='%234e5156'/><stop offset='0.18' stop-color='%2363666a'/><stop offset='0.38' stop-color='%23c9c9c7'/><stop offset='0.68' stop-color='%23e1ded9'/><stop offset='1' stop-color='%23e6e3de'/></linearGradient><linearGradient id='b' x1='0.12' y1='0' x2='0.66' y2='1'><stop offset='0' stop-color='%23d4d7dc'/><stop offset='0.40' stop-color='%239aa0aa'/><stop offset='1' stop-color='%233c4149'/></linearGradient><radialGradient id='k'><stop offset='0' stop-color='%23423a5c' stop-opacity='0.66'/><stop offset='0.55' stop-color='%23423a5c' stop-opacity='0.30'/><stop offset='1' stop-color='%23423a5c' stop-opacity='0'/></radialGradient><radialGradient id='r' cx='0.38' cy='0.30'><stop offset='0' stop-color='%23f3f0f7'/><stop offset='0.62' stop-color='%23ded9e8'/><stop offset='1' stop-color='%23cbc4da'/></radialGradient></defs><ellipse cx='46' cy='52.2' rx='23' ry='5.8' fill='url(%23k)' opacity='0.62'/><ellipse cx='73' cy='48.4' rx='13.4' ry='2.1' fill='url(%23k)'/><ellipse cx='118' cy='53.2' rx='6.8' ry='1.9' fill='url(%23k)'/><ellipse cx='73' cy='45.0' rx='10.6' ry='3.15' fill='url(%23r)'/><polygon points='56,32.5 58.5,38.5 119,52.5 119,49.2' fill='url(%23s)'/><polygon points='67.6,35.4 74.6,37.3 76.4,42.9 69.6,41.3' fill='url(%23s)'/><polygon points='74.9,37.4 79.0,38.5 80.7,43.7 76.6,42.8' fill='%230e4746'/><ellipse cx='39' cy='29.6' rx='19.3' ry='16.4' fill='url(%23m)'/><ellipse cx='39' cy='30' rx='20.4' ry='17.4' fill='none' stroke='url(%23b)' stroke-width='2.6'/><path d='M23.6 20.4 A20.4 17.4 0 0 1 38 12.6' fill='none' stroke='%23eceff3' stroke-width='1.5' stroke-linecap='round' opacity='0.85'/></svg>") 50% 46% / contain no-repeat`,
    // The patch it is throwing, broad and off to one side. Fainter than it
    // was, because the wall under it is now pale: a white patch driven hard
    // onto a near-white wall is a second blob rather than a light.
    "radial-gradient(46% 42% at 74% 27%, rgb(252 253 255 / 0.40) 0%, rgb(252 253 255 / 0) 100%)",
    /* And the room, now in two parts: the wall down to the horizon and the
       table from the horizon to the paper the harness cuts at the foot.
       Every stop is read off the canvas down a column clear of the
       instrument, with the section's own white scrim divided back out
       again — sampling through it and then painting under it is how a
       poster ends up a stop and a half lighter than the thing it stands
       in for. */
    "linear-gradient(180deg, #ab9ac1 0%, #b0a1c5 16%, #b9accb 29%, #c0b5d1 41%, #c8bfd7 47%, #cfc7dc 52%, #bcb2cc 56%, #a79db8 60%, #8b7fa2 65%, #837799 71%, #c1bacc 76%, #ffffff 84%, #ffffff 100%)",
  ].join(", "),
  alt: "A stainless dental mouth mirror lying on a bracket table, close to the lens and turning on the axis of its own handle: the rhodium face sharp and bright, with the studio's horizon curving across it and the operating lamp in it as a hard white oval, set in a steel bezel — then the shank, the ferrule, the teal silicone ID ring and the knurled handle running away behind it, whole to its rounded butt. The handle rests across a rolled cotton and the butt sits down on the table itself, each in its own dark contact shadow, and the mirror head is held clear of the table between them. Twice a turn the face comes square to the lens and fills with the light; twice it shows its turned steel back instead. On the pale lavender wall beyond, the patch of light the mirror throws sweeps across the frame each time the face comes round to the lamp.",
};
