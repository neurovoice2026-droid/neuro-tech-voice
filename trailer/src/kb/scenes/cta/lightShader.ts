/**
 * THE CLOSE's single WebGL2 pass — a FORK of film 1's src/scenes/cta/heroShader.ts (PIPELINE.md §7 fallback:
 * "HeroGL with art = 0"), cut down to what film 2 draws and made TRANSPARENT so it lies over the site's
 * gradient mesh (kit/MeshGround, a 2D canvas under it) instead of film 1's flat night:
 *
 *   · the four lights: the site's FluidOrb (orbPass.ts, film 1's, imported) in ONE premultiplied layer — there is
 *     no figure to hide a back layer — each throwing a tight bloom of its own light (an emitter, not a marble) and
 *     a faint wide pool of it onto the ground round it (uWide: a lamp in a room)
 *   · after the impact, THE BACKLIGHT behind the wordmark: film 1's merged light verbatim — a wide, filled
 *     ellipse of lilac-white light, brightest at the core and falling the whole way (one C¹ curve through its
 *     stops, so no stop shows as a ring), its rim taking the four lights' colours at the diagonals and spilling
 *     a little of them past its edge; its underside settles under the word (uFloor) so the button sits on the
 *     night. Film 1 mixed to its INK past the edge; here the far edge is NO light (alpha → 0): the mesh shows.
 *
 * OUTPUT: premultiplied RGBA, with alpha = the light's own brightest channel (and the orbs' coverage), so the
 * browser's ordinary source-over composite gives  light + mesh · (1 − max(light))  — light ADDED on the dark
 * ground (≈ screen), the orbs' bodies occluding it — with no CSS blend mode and no invalid (rgb > a) pixels.
 *
 * Every term is smooth in its uniforms (no noise, no smear), so the 120 fps master samples it continuously.
 * Absolute-frequency terms are in canvas px (uPxScale = canvas px per CSS px): the 4K master is the same picture.
 */
export const LIGHT_VERT = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export const LIGHT_FRAG = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform vec2  uRes;       // canvas px
uniform vec2  uHaloC;     // backlight centre, canvas px (y down)
uniform vec3  uHaloR;     // rx, ry above, ry below (canvas px)
uniform float uHaloGain;
uniform vec4  uMerge;     // the backlight: body gain, rim peak (≤ .75), rim spill past the edge, core lift
uniform vec4  uFloor;     // y where the floor starts (at the axis), its length (canvas px), strength, rise at ±rx (px)
uniform float uSeed;      // render frame, for the dither
uniform sampler2D uOrbs;  // the premultiplied orb layer
uniform float uOrbOn;     // 1 while any orb is drawn
uniform vec4  uGlowP[4];  // orb bloom: centre (canvas px, y down), radius px, strength
uniform vec3  uGlowC[4];  // orb bloom colour
uniform vec4  uRim;       // the four lights on the rim: strength (0..1), -, -, angular half-width (rad)
uniform vec3  uRimC[4];   // the rim's colours: top-left, top-right, bottom-right, bottom-left
uniform float uGlowOver;  // how much of each orb's bloom also lies over its own body (halation)
uniform vec2  uWide;      // each light's light on the ground round it: radius (× its bloom), strength (× its bloom's)

// THE BACKLIGHT (film 1's merged light): a lilac-white core (#f4efff), #dccfff, the night's light (#b298f6),
// a deep violet edge (#36176f), then no light
const vec3 L_CORE = vec3(244.0, 239.0, 255.0) / 255.0;
const vec3 L_HI   = vec3(220.0, 207.0, 255.0) / 255.0;
const vec3 L_MID  = vec3(178.0, 152.0, 246.0) / 255.0;
const vec3 L_EDGE = vec3(54.0, 23.0, 111.0) / 255.0;

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

/* THE BACKLIGHT at halo distance d (1 = where it turns to its edge) — film 1's curve; past the rim it falls to no light. */
vec3 backlight(float d, vec3 edgeC) {
  vec3 c = L_CORE;
  c = mix(c, L_HI, herm(0.0, 0.52, 0.0, 1.2, d));
  c = mix(c, L_MID, herm(0.52, 0.92, 0.8, 1.3, d));
  c = mix(c, edgeC, herm(0.92, 1.16, 0.7, 1.1, d));
  return mix(c, vec3(0.0), herm(1.16, 1.55, 0.8, 0.0, d));
}

void main() {
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);          // y down
  vec2 px = uv * uRes;

  /* ---- the backlight ---------------------------------------------- */
  vec3 light = vec3(0.0);
  if (uHaloGain > 0.0005) {
    vec2 hd = px - uHaloC;
    // (ry above → ry below eased across the axis: a hard switch leaves a kink)
    vec2 R = vec2(uHaloR.x, mix(uHaloR.y, uHaloR.z, smoothstep(-0.6, 0.6, hd.y / max(uHaloR.y, 1.0))));
    vec2 q = hd / R;
    float hr = length(q);
    // (past 1.75 every term below is under 1e-3 of a level: skip the work — the 4K master is software-rasterised)
    if (hr < 1.75) {
    vec3 edgeC = L_EDGE;
    vec3 rimSum = vec3(0.0);
    if (uRim.x > 0.0 && hr > 0.5) {
      float a = atan(q.x, -q.y);                       // 0 at the top, clockwise
      const float ARC_A[4] = float[4](-0.785398, 0.785398, 2.356194, -2.356194);
      for (int i = 0; i < 4; i++) {
        float da = atan(sin(a - ARC_A[i]), cos(a - ARC_A[i]));
        float wA = uRim.x * exp(-pow(da / uRim.w, 2.0));
        edgeC = mix(edgeC, uRimC[i] * uMerge.y, wA);
        rimSum += uRimC[i] * wA;
      }
    }
    vec3 halo = backlight(hr, edgeC) * uMerge.x;
    halo += rimSum * uMerge.y * uMerge.z * exp(-pow((hr - 1.16) / 0.22, 2.0));
    halo += L_CORE * uMerge.w * exp(-3.2 * hr * hr);
    float fy = uFloor.x - uFloor.w * (hd.x / uHaloR.x) * (hd.x / uHaloR.x);
    halo *= 1.0 - uFloor.z * smoothstep(0.0, 1.0, (px.y - fy) / uFloor.y);
    light = halo * uHaloGain;
    }
  }

  /* ---- the four lights' blooms ------------------------------------ */
  vec3 glow = vec3(0.0);
  vec3 wide = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    vec4 g = uGlowP[i];
    if (g.w <= 0.0) continue;
    vec2 dd = (px - g.xy) / g.z;
    float d2 = dot(dd, dd);
    // its light falling on the ground round it: a wide, faint pool of the same light (a lamp in a room, not a halo)
    float w2 = d2 / (uWide.x * uWide.x);
    if (w2 > 9.0) continue;                          // (beyond 3σ of the wide pool: nothing of this light reaches here)
    wide += uGlowC[i] * (exp(-w2) * g.w * uWide.y);
    if (d2 < 9.0) glow += uGlowC[i] * (exp(-d2) * g.w);
  }
  vec3 col = screen(screen(light, wide), glow);
  float a = maxc(col);

  /* ---- the orbs (premultiplied), then their halation --------------- */
  if (uOrbOn > 0.5) {
    vec4 o = texture(uOrbs, vUv);
    col = o.rgb + col * (1.0 - o.a);
    a = o.a + a * (1.0 - o.a);
    col = screen(col, glow * uGlowOver);
    a = max(a, maxc(col));
  }

  // ±0.5/255 dither where there is light (the film grain is the global overlay)
  float n = hash12(gl_FragCoord.xy + fract(uSeed * 0.618) * 311.0) - 0.5;
  col = clamp(col + n * 0.002 * a, 0.0, 1.0);
  a = clamp(a, 0.0, 1.0);
  fragColor = vec4(min(col, vec3(a)), a);
}`;
