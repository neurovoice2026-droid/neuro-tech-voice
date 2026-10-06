/**
 * THE END CARD's single WebGL2 pass — a FORK of film 2's src/kb/scenes/cta/lightShader.ts @ 743247a (itself the fork
 * of film 1's heroShader), so the reels' one end card works on BOTH their grounds. Everything film 2 draws is kept
 * term for term — the lights as EMITTERS (a flat-topped white-hot core in a thin halation and a tight gaussian bloom
 * of its own colour, plus a faint wide pool on the ground), the filled BACKLIGHT behind the wordmark (one C¹ Hermite
 * chain through its stops, so no stop shows as a ring; its rim taking colour at the diagonals; its underside settling
 * under the word, uFloor). What the fork adds:
 *
 *   · uStops[4]: the backlight's colours (core, high, mid, edge) are uniforms, not constants — film 2's lilac
 *     (BACKLIGHT_LILAC, the films' end-card light) or the reels' sunday teal
 *   · uTint: HOW it lies on the ground.
 *       0 = film 2's composite, verbatim: premultiplied, alpha = the light's brightest channel → the browser's
 *           source-over gives  light + ground · (1 − max(light))  — light ADDED on a dark ground (ig2's night)
 *       1 = on a LIGHT ground (the pearl reels): light cannot be added to near-white, so the backlight is laid OVER
 *           the ground as a FILLED pool of its colour — C(d) through uStops at opacity A(d) = gain·e^(−1.55 d²), its
 *           strongest at the core and falling the whole way (no rim term: on a light ground a coloured rim reads as a
 *           neon ring) — the emitters' blooms and cores composited over it the same way.
 *   · the dither (±.5/255 where there is light) is STATIC (uSeed held by the caller): the bit-budget probe settled
 *     static noise for the reels (components/Finish.tsx), re-seeded noise is smeared by the encoder.
 *
 * Every term is smooth in its uniforms (no noise, no smear), so the 120 fps master samples it continuously.
 */
export const IG_LIGHT_VERT = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export const IG_LIGHT_FRAG = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform vec2  uRes;       // canvas px
uniform vec2  uHaloC;     // backlight centre, canvas px (y down)
uniform vec3  uHaloR;     // rx, ry above, ry below (canvas px)
uniform float uHaloGain;
uniform vec4  uMerge;     // the backlight: body gain, rim peak (≤ .75), rim spill past the edge, core lift
uniform vec4  uFloor;     // y where the floor starts (at the axis), its length (canvas px), strength, rise at ±rx (px)
uniform float uSeed;      // the dither's seed (held: static noise)
uniform vec4  uGlowP[4];  // a light's bloom: centre (canvas px, y down), radius px (exp(−d²/r²): σ = r/√2), strength
uniform vec3  uGlowC[4];  // its colour
uniform vec4  uCoreP[4];  // a light's core: centre (canvas px, y down), radius px, intensity
uniform vec3  uCoreC[4];  // the hue its white-hot core and halation are tinted by
uniform vec4  uRim;       // the rim: strength (0..1), -, -, angular half-width (rad)
uniform vec3  uRimC[4];   // the rim's colours: top-left, top-right, bottom-right, bottom-left
uniform vec2  uWide;      // each light's light on the ground round it: radius (× its bloom), strength (× its bloom's)
uniform vec3  uStops[4];  // THE BACKLIGHT's colours: core, high, mid, edge
uniform float uTint;      // 0: light added on a dark ground (film 2) · 1: light laid over a light ground

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec3 screen(vec3 a, vec3 b) { return 1.0 - (1.0 - a) * (1.0 - clamp(b, 0.0, 1.0)); }
float maxc(vec3 c) { return max(c.r, max(c.g, c.b)); }

/* One monotone C¹ step across [a, b] (Hermite, end-slope ratios s0, s1). */
float herm(float a, float b, float s0, float s1, float d) {
  float u = clamp((d - a) / (b - a), 0.0, 1.0);
  float u2 = u * u, u3 = u2 * u;
  return (-2.0 * u3 + 3.0 * u2) + s0 * (u3 - 2.0 * u2 + u) + s1 * (u3 - u2);
}

/* THE BACKLIGHT's colour at halo distance d (1 = where it turns to its edge) — film 1's curve through uStops. */
vec3 backlightColour(float d, vec3 edgeC) {
  vec3 c = uStops[0];
  c = mix(c, uStops[1], herm(0.0, 0.52, 0.0, 1.2, d));
  c = mix(c, uStops[2], herm(0.52, 0.92, 0.8, 1.3, d));
  return mix(c, edgeC, herm(0.92, 1.16, 0.7, 1.1, d));
}
/* ... and its light past the rim (film 2: it falls to no light) */
float backlightFall(float d) { return 1.0 - herm(1.16, 1.55, 0.8, 0.0, d); }

/* premultiplied "over" */
vec4 over(vec4 top, vec4 under) { return top + under * (1.0 - top.a); }

void main() {
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);          // y down
  vec2 px = uv * uRes;

  /* ---- the backlight ---------------------------------------------- */
  vec3 light = vec3(0.0);      // add mode: its light
  vec4 lay = vec4(0.0);        // tint mode: its colour at its strength (premultiplied)
  if (uHaloGain > 0.0005) {
    vec2 hd = px - uHaloC;
    vec2 R = vec2(uHaloR.x, mix(uHaloR.y, uHaloR.z, smoothstep(-0.6, 0.6, hd.y / max(uHaloR.y, 1.0))));
    vec2 q = hd / R;
    float hr = length(q);
    if (hr < 1.75) {
      vec3 edgeC = uStops[3];
      vec3 rimSum = vec3(0.0);
      if (uRim.x > 0.0 && hr > 0.5) {
        float a = atan(q.x, -q.y);                       // 0 at the top, clockwise
        const float ARC_A[4] = float[4](-0.785398, 0.785398, 2.356194, -2.356194);
        for (int i = 0; i < 4; i++) {
          float da = atan(sin(a - ARC_A[i]), cos(a - ARC_A[i]));
          float wA = uRim.x * exp(-pow(da / uRim.w, 2.0));
          edgeC = mix(edgeC, uRimC[i] * (uTint > 0.5 ? 1.0 : uMerge.y), wA);
          rimSum += uRimC[i] * wA;
        }
      }
      float fy = uFloor.x - uFloor.w * (hd.x / uHaloR.x) * (hd.x / uHaloR.x);
      float floorK = 1.0 - uFloor.z * smoothstep(0.0, 1.0, (px.y - fy) / uFloor.y);
      if (uTint < 0.5) {
        vec3 halo = backlightColour(hr, edgeC) * backlightFall(hr) * uMerge.x;
        halo += rimSum * uMerge.y * uMerge.z * exp(-pow((hr - 1.16) / 0.22, 2.0));
        halo += uStops[0] * uMerge.w * exp(-3.2 * hr * hr);
        light = halo * floorK * uHaloGain;
      } else {
        // laid over the ground: a FILLED pool of the light's colour, strongest at the core and falling the whole way
        // (a C¹ gaussian, no stop and no rim showing as a ring — on a light ground a coloured rim reads as a neon ring);
        // the core's lift whitens its heart a touch
        float A = uMerge.x * exp(-1.55 * hr * hr) * floorK * uHaloGain;
        A = clamp(A, 0.0, 1.0);
        vec3 col = backlightColour(hr, edgeC);
        col = mix(col, vec3(1.0), uMerge.w * exp(-3.2 * hr * hr));
        lay = vec4(col * A, A);
      }
    }
  }

  /* ---- the lights: bloom (their colour), halation, white-hot core ---- */
  vec3 glow = vec3(0.0);
  vec3 wide = vec3(0.0);
  vec3 hot = vec3(0.0);
  vec4 tintGlow = vec4(0.0);
  vec4 tintHot = vec4(0.0);
  for (int i = 0; i < 4; i++) {
    vec4 g = uGlowP[i];
    if (g.w > 0.0) {
      vec2 dd = (px - g.xy) / g.z;
      float d2 = dot(dd, dd);
      float w2 = d2 / (uWide.x * uWide.x);
      if (w2 < 9.0) {
        float aw = exp(-w2) * g.w * uWide.y;
        float ag = d2 < 9.0 ? exp(-d2) * g.w : 0.0;
        wide += uGlowC[i] * aw;
        glow += uGlowC[i] * ag;
        tintGlow = over(vec4(uGlowC[i] * ag, ag), over(vec4(uGlowC[i] * aw, aw), tintGlow));
      }
    }
    vec4 c = uCoreP[i];
    if (c.w > 0.0) {
      float d = length(px - c.xy);
      float u = d / c.z;
      if (u < 6.0) {
        float u2 = u * u;
        float k1 = c.w * exp(-u2 * u2 * u2);
        float k2 = 0.42 * c.w * exp(-u2 / 5.12);
        vec3 c1 = mix(vec3(1.0), uCoreC[i], 0.1);
        vec3 c2 = mix(vec3(1.0), uCoreC[i], 0.55);
        hot += c1 * k1 + c2 * k2;
        tintHot = over(vec4(c1 * clamp(k1, 0.0, 1.0), clamp(k1, 0.0, 1.0)), over(vec4(c2 * clamp(k2, 0.0, 1.0), clamp(k2, 0.0, 1.0)), tintHot));
      }
    }
  }

  // ±0.5/255 dither where there is light (static: uSeed is held)
  float n = hash12(gl_FragCoord.xy + fract(uSeed * 0.618) * 311.0) - 0.5;
  if (uTint < 0.5) {
    vec3 col = screen(screen(screen(light, wide), glow), hot);
    float a = maxc(col);
    col = clamp(col + n * 0.002 * a, 0.0, 1.0);
    a = clamp(a, 0.0, 1.0);
    fragColor = vec4(min(col, vec3(a)), a);
  } else {
    vec4 o = over(tintHot, over(tintGlow, lay));
    o.rgb = clamp(o.rgb + n * 0.002 * o.a, 0.0, 1.0);
    o.a = clamp(o.a, 0.0, 1.0);
    fragColor = vec4(min(o.rgb, vec3(o.a)), o.a);
  }
}`;
