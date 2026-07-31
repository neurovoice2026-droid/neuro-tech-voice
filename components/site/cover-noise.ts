/**
 * The cover's noise, as GLSL source.
 *
 * Perlin plus the domain-warped fbm built on it — ported from the
 * Unicorn.studio project the cover reproduces, and the only source of
 * motion anywhere in the cover's world.
 *
 * It lives in its own module because two shaders now run it: the hero's
 * portrait dissolve (`depth-portrait.tsx`) and the field the interior
 * spread sits on (`cover-field.tsx`). Copying it would let them drift —
 * one retuned octave count and the page carries two different effects
 * that are meant to be the same one. Shared, "the features section churns
 * like the hero" is true by construction rather than by matching numbers
 * in two files.
 */
export const COVER_NOISE_GLSL = /* glsl */ `
vec3 hash33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.11369, 0.13787));
  p3 += dot(p3, p3.yxz + 19.19);
  return -1.0 + 2.0 * fract(vec3(
    (p3.x + p3.y) * p3.z,
    (p3.x + p3.z) * p3.y,
    (p3.y + p3.z) * p3.x
  ));
}

float perlin(vec3 p) {
  vec3 pi = floor(p), pf = p - pi;
  vec3 w = pf * pf * (3.0 - 2.0 * pf);
  float n000 = dot(pf - vec3(0, 0, 0), hash33(pi + vec3(0, 0, 0)));
  float n100 = dot(pf - vec3(1, 0, 0), hash33(pi + vec3(1, 0, 0)));
  float n010 = dot(pf - vec3(0, 1, 0), hash33(pi + vec3(0, 1, 0)));
  float n110 = dot(pf - vec3(1, 1, 0), hash33(pi + vec3(1, 1, 0)));
  float n001 = dot(pf - vec3(0, 0, 1), hash33(pi + vec3(0, 0, 1)));
  float n101 = dot(pf - vec3(1, 0, 1), hash33(pi + vec3(1, 0, 1)));
  float n011 = dot(pf - vec3(0, 1, 1), hash33(pi + vec3(0, 1, 1)));
  float n111 = dot(pf - vec3(1, 1, 1), hash33(pi + vec3(1, 1, 1)));
  return mix(
    mix(mix(n000, n100, w.x), mix(n010, n110, w.x), w.y),
    mix(mix(n001, n101, w.x), mix(n011, n111, w.x), w.y),
    w.z
  );
}

const mat2 rotHalf = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));

float fbm(vec3 st) {
  float value = 0.0;
  float amp = 0.25;
  const float aM = 0.1 + 0.86 * 0.65;   // the reference's amplitude falloff
  vec2 shift = vec2(100.0);
  // 8 octaves, as the reference. Each is 2.5x finer than the last, so
  // the last few are what make the filaments hair-thin rather than
  // blobby — dropping them visibly coarsens the dissolve.
  for (int i = 0; i < 8; i++) {
    value += amp * perlin(st);
    st.xy *= rotHalf * 2.5;
    st.xy += shift;
    amp *= aM;
  }
  return value;
}
`;

/**
 * The cover's clock, shared by both shaders.
 *
 * `FLOW` is calibrated against the reference: with the mouse held still
 * its dissolve churns at ~16.5 mean luma delta per 2s over the subject.
 * The raw speed values alone leave the field almost frozen, so the
 * runtime clearly scales them — this is that missing factor.
 *
 * `CYCLE` is the period, in seconds, of the whole -> apart -> whole
 * breath. Both shaders read the same one, so the field's bloom swells on
 * the portrait's beat instead of alongside it — from the page's point of
 * view there is one effect running behind everything, not two.
 */
export const COVER_FLOW = 30;
export const COVER_CYCLE = 12;

/**
 * 0 while whole, 1 while fully apart.
 *
 * A raised cosine, and deliberately nothing more. Easing each leg and
 * clamping a hold at each end gave the thing three distinct movements —
 * climb, sit, fall — and read as stepping rather than breathing. This has
 * no stages to notice: one term, continuous everywhere, and flat at both
 * extremes because a cosine already levels off there.
 */
export const coverDissolveAt = (seconds: number, period = COVER_CYCLE) =>
  0.5 - 0.5 * Math.cos((2 * Math.PI * seconds) / period);

/**
 * Noise-domain units per device pixel, taken off the cover.
 *
 * The portrait measures its noise in head half-widths — `1.7806` units
 * across `subject` (0.2288) of a 2048px-wide image, so:
 *
 *     1.7806 / (0.2288 * 2048) = 0.003801 units/px
 *
 * Anything else that wants the cover's texture at the cover's *physical*
 * scale multiplies pixels by this. It matters because the filaments come
 * out of the finest octaves: 8 octaves at 2.5x lacunarity puts the last
 * one ~610x finer than the first, which is roughly a pixel and a half at
 * this rate. Pick a different rate and the tear is either a coarse blob
 * or invisible — those were both real failures on the way here, which is
 * why this is a shared constant and not a number typed twice.
 */
export const COVER_NOISE_PER_PX = 1.7806 / (0.2288 * 2048);

/**
 * The anisotropy that makes the tear vertical.
 *
 * Squashing the noise domain in y means it varies far faster across x
 * than down y, and that difference is the whole reason the cover shreds
 * into standing filaments instead of smearing into a directionless blur.
 * Isotropic noise gives a completely different effect, so this travels
 * with the constant above.
 */
export const COVER_NOISE_SKEW: readonly [number, number] = [1.0, 0.25];

/**
 * How far the cover's tear actually travels, in subject-widths.
 *
 * The portrait's displacement is `fine * uWarp` in image UV, with uWarp at
 * 1.15 and `subject` spanning 0.2288 of the image, so the peak throw is
 *
 *     1.15 / 0.2288 = 5.03 subject-widths
 *
 * which is the number that matters and the one that is easy to get wrong.
 * Guessing "a fraction of the em" put the first version of the text
 * dissolve at ~4px of travel on a 34px heading — about a hundredth of the
 * cover's throw. It ran, it was correct in every other respect, and it
 * read as a slightly soft fade, because a tear that cannot move a glyph
 * further than its own stroke width is not a tear. Anything reusing this
 * effect scales displacement by THIS, against whatever its own subject is.
 */
export const COVER_WARP_SUBJECTS = 1.15 / 0.2288;

/**
 * One clock for the whole cover, so everything breathes in phase.
 *
 * `coverDissolveAt` gives every effect the same 12-second period, but a
 * period is not a beat: fed each element's own mount time, four headings
 * that scrolled into view seconds apart come apart at four different
 * moments and the page reads as four unrelated effects that happen to
 * look alike. Measured from one module-level epoch they are one effect
 * appearing in four places, which is the thing the cover actually does.
 */
const EPOCH =
  typeof performance !== "undefined" ? performance.now() : 0;

export const coverElapsed = () => (performance.now() - EPOCH) / 1000;
