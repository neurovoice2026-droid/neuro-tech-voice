/**
 * The CTA's single WebGL2 pass: the site's hero portrait (depth-portrait.tsx)
 * rebuilt for the film, the room she stands in, the four lights, and the
 * merged light the wordmark lands in.
 *
 *   0. framing: the art is placed so its eyes sit on the core P (any of the
 *      portrait crop's glitch band, v < 0.14, the framing reaches is filled
 *      from the art just under it)
 *   1. dolly (push-in about the eyes) + parallax-occlusion march through the
 *      depth map (white = near), driven by a scripted "pointer" orbit — the
 *      site's DepthPortrait with its 0.048 amplitude
 *   2. the site's grade (brightness .82 · contrast 1.18 · saturate .88), the
 *      10 % pigment tint, then the hero scrim + wash, exactly as the CSS
 *   3. THE ROOM: the art's own sprayed cream backlight (a flat disc with a
 *      stippled edge) is replaced by a clean, motivated light on a near-black
 *      wall — one key behind her head, a point light's Lambert falloff
 *      ((1 + u²)^−3/2, no edge, no plateau), its colour her lilac at low
 *      chroma (uWall, uWallC). She reads as a silhouette with her own lit face.
 *   4. REVEAL: from black, the eyes first, then a soft radial opening (the
 *      converge plays it backwards: the light closes on her, the eyes last)
 *   5. the eyes carry her voice (her real envelope, uEyeGlow)
 *   6. the four lights: two premultiplied orb layers (FluidOrbs drawn in
 *      THIS context by orbPass.ts): the back one is occluded by the figure's
 *      own matte, the front one sits over everything; every orb throws a
 *      restrained bloom of its own light (an emitter, not a marble)
 *   7. after the impact (uArt = 0): THE MERGED LIGHT behind the wordmark — the
 *      burst's light standing as a soft elliptical corona just outside the
 *      word (gaussian on both sides, a hotter crest), a deep violet body
 *      inside it so the paper wordmark reads, and the four lights as four
 *      distinct arcs on its rim (rose top-left, emerald top-right, teal
 *      bottom-right, violet bottom-left), added as light; its underside
 *      settles under the word (uFloor) so the button sits on the night.
 *
 * No noise-driven tear, no filaments, no smear: every term is smooth in its
 * uniforms, so the 120 fps master samples it continuously. Absolute-frequency
 * terms are in CSS px (uPxScale = canvas px per CSS px), so the 4K master
 * (--scale 2) is the same picture, sharper.
 *
 * Perlin is the site's (components/site/cover-noise.ts), copied verbatim.
 */
export const HERO_VERT = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export const HERO_FRAG = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uImage;
uniform sampler2D uDepth;
uniform vec2  uRes;       // canvas px
uniform vec2  uImgRes;    // texture px
uniform float uPxScale;   // canvas px per CSS px (quality × devicePixelRatio)
uniform vec2  uMouse;     // scripted pointer, 0..1
uniform float uAmp;       // parallax amplitude (site: 0.048)
uniform float uZoom;      // dolly about the eyes
uniform vec2  uPan;       // extra camera pan, uv
uniform float uTime;      // noise clock (the reveal's soft edge)
uniform float uArt;       // 1 = the portrait pass runs, 0 = the merged light only
uniform float uReveal;    // radial reveal radius (frame half-diagonals)
uniform float uEyes;      // 0..1 eyes-first
uniform float uAxisX;
uniform vec3  uEye;       // eye offset from axis, eye y, guard radius
uniform float uSubject;
uniform vec3  uBrand;     // #551a89
uniform vec4  uWall;      // the room's key: centre (canvas px, y down), height over the wall (canvas px), strength
uniform vec3  uWallC;     // … its colour on the wall
uniform vec2  uHaloC;     // merged light centre, canvas px (y down)
uniform vec3  uHaloR;     // rx, ry above, ry below (canvas px)
uniform float uHaloGain;
uniform vec4  uMerge;     // corona: inner width (canvas px), outer width (canvas px), body level, ring gain
uniform vec4  uMerge2;    // corona: crest gain, outer glow gain, outer glow width (× outer width), ring saturation (0 = white-lilac, 1 = lilac)
uniform vec4  uFloor;     // y where the floor starts (at the axis), its length (canvas px), strength, rise at ±rx (px)
uniform vec3  uFrame;     // base zoom, screen y of the eyes (0..1), art glitch-band edge v (0 = none)
uniform float uSeed;      // frame, for the dither
uniform sampler2D uOrbBack;  // premultiplied orb layer behind the figure
uniform sampler2D uOrbFront; // premultiplied orb layer in front of everything
uniform float uOrbOn;     // 1 while any orb is drawn
uniform float uOcc;       // how much the figure hides the back layer (0..1)
uniform vec4  uGlowP[4];  // orb bloom: centre (canvas px, y down), radius px, strength
uniform vec3  uGlowC[4];  // orb bloom colour
uniform float uGlowBack[4]; // 1 = this bloom is behind the figure
uniform float uEyeGlow;   // the eyes' light, driven by Ava's real voice envelope (0..1)
uniform vec4  uRim;       // the four lights on the corona: strength (0..1), (unused), (unused), angular half-width (rad)
uniform vec3  uRimC[4];   // the four lights' arc colours: top-left, top-right, bottom-right, bottom-left
uniform float uGlowOver;  // how much of each orb's bloom also lies over its own body

const vec3 INK  = vec3(6.0, 4.0, 10.0) / 255.0;
const vec3 ROOM = vec3(5.0, 4.0, 8.0) / 255.0;
// the merged light: the night's violet body, a lilac corona with a near-white crest
const vec3 M_BODY  = vec3(0.427, 0.157, 0.851);   // #6d28d9
const vec3 M_DEEP  = vec3(0.290, 0.102, 0.620);   // #4a1a9e
const vec3 M_RING  = vec3(0.725, 0.639, 1.0);     // #b9a3ff
const vec3 M_CREST = vec3(0.969, 0.953, 1.0);     // #f7f3ff

/* ---- site noise (cover-noise.ts) ------------------------------------ */
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

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float getDepth(vec2 uv) {
  vec3 c = texture(uDepth, uv).rgb;
  return 1.0 - dot(c, vec3(0.299, 0.587, 0.114));
}

/* CSS filter: brightness(.82) contrast(1.18) saturate(.88), in order. */
vec3 grade(vec3 c) {
  c = clamp(c * 0.82, 0.0, 1.0);
  c = clamp((c - 0.5) * 1.18 + 0.5, 0.0, 1.0);
  const float s = 0.88;
  mat3 m = mat3(
    0.213 + 0.787 * s, 0.213 - 0.213 * s, 0.213 - 0.213 * s,
    0.715 - 0.715 * s, 0.715 + 0.285 * s, 0.715 - 0.715 * s,
    0.072 - 0.072 * s, 0.072 - 0.072 * s, 0.072 + 0.928 * s
  );
  return clamp(m * c, 0.0, 1.0);
}

/* The hero scrim (top -> bottom): the CSS stops (.72 at 0, .10 at .20, .26 at .44, .66 at .62,
   .90 at .82, 1 at 1), joined by smoothsteps so no stop shows as a band. */
float scrimA(float y) {
  if (y < 0.20) return mix(0.72, 0.10, smoothstep(0.0, 0.20, y));
  if (y < 0.44) return mix(0.10, 0.26, smoothstep(0.20, 0.44, y));
  if (y < 0.62) return mix(0.26, 0.66, smoothstep(0.44, 0.62, y));
  if (y < 0.82) return mix(0.66, 0.90, smoothstep(0.62, 0.82, y));
  return mix(0.90, 1.0, smoothstep(0.82, 1.0, y));
}

vec3 screen(vec3 a, vec3 b) { return 1.0 - (1.0 - a) * (1.0 - clamp(b, 0.0, 1.0)); }

/* THE ROOM: a point light behind her head on a near-black wall (Lambert falloff, a wide key). */
vec3 wallLight(vec2 px) {
  vec2 d = (px - uWall.xy) / vec2(uWall.z * 1.3, uWall.z);
  float l = pow(1.0 + dot(d, d), -1.5);
  return ROOM + uWallC * (uWall.w * l);
}

/* THE MERGED LIGHT at halo distance d (1 = the corona's line) and signed px distance from it. */
vec3 mergedLight(float d, float dpx, vec3 ringCol) {
  // the body: the merged orb's violet, faint, brightest at the core and falling the whole way
  // (a gaussian — no plateau, no edge): the word stands on it, paper on violet-black
  float body = exp(-d * d * 1.6);
  vec3 c = mix(M_DEEP, M_BODY, exp(-d * d * 3.0)) * body * uMerge.z;
  // the corona: an even-width line of light just outside the word (the same width all round,
  // in px) — soft on both sides, a hotter crest — and a long, faint outer glow
  float w = dpx < 0.0 ? uMerge.x : uMerge.y;
  float ring = exp(-dpx * dpx / (w * w));
  float gw = uMerge.y * uMerge2.z;
  // (inside, the px distance is only meaningful near the line: the inner glow fades out toward the
  // core, so the centre — where the distance's direction flips — stays clean)
  float halo = exp(-dpx * dpx / (gw * gw)) * uMerge2.y * (dpx > 0.0 ? 1.0 : 0.6 * smoothstep(0.3, 0.85, d));
  c += ringCol * (ring * 0.62 + halo) * uMerge.w;
  c += M_CREST * pow(ring, 5.0) * uMerge2.x * uMerge.w;
  return c;
}

void main() {
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);          // y down
  vec2 px = uv * uRes;
  vec2 pxC = px / uPxScale;                      // CSS px (absolute frequencies)
  float grainN = hash12(gl_FragCoord.xy + fract(uSeed * 0.618) * 311.0) - 0.5;

  /* ---- the merged light (the end card) ----------------------------- */
  vec2 hd = px - uHaloC;
  // (ry above → ry below eased across the axis: a hard switch left a kink, a faint line, at the centre row)
  vec2 R = vec2(uHaloR.x, mix(uHaloR.y, uHaloR.z, smoothstep(-0.6, 0.6, hd.y / max(uHaloR.y, 1.0))));
  vec2 q = hd / R;
  float hr = length(q);
  vec3 halo = vec3(0.0);
  if (uHaloGain > 0.0005) {
    // signed px distance to the corona's line (hr = 1): (hr − 1) / |∇hr|
    float gl = length(q / R) / max(hr, 1e-4);
    float dpx = (hr - 1.0) / max(gl, 1e-6);
    // the four lights on the corona: its lilac takes each light's colour at its diagonal (rose
    // top-left, emerald top-right, teal bottom-right, violet bottom-left), lilac in between
    vec3 ringCol = mix(M_CREST, M_RING, uMerge2.w);
    if (uRim.x > 0.0) {
      float a = atan(q.x, -q.y);                       // 0 at the top, clockwise
      const float ARC_A[4] = float[4](-0.785398, 0.785398, 2.356194, -2.356194);
      for (int i = 0; i < 4; i++) {
        float da = atan(sin(a - ARC_A[i]), cos(a - ARC_A[i]));
        ringCol = mix(ringCol, uRimC[i], uRim.x * exp(-pow(da / uRim.w, 2.0)));
      }
    }
    halo = mergedLight(hr, dpx, ringCol);
    // the underside settles under the wordmark: a soft falloff whose edge curves up with the ellipse
    float fy = uFloor.x - uFloor.w * (hd.x / uHaloR.x) * (hd.x / uHaloR.x);
    halo *= 1.0 - uFloor.z * smoothstep(0.0, 1.0, (px.y - fy) / uFloor.y);
    halo *= uHaloGain;
  }

  vec3 col = ROOM + halo;
  float occ = 0.0;     // how much of the back orb layer the figure hides here
  float occG = 0.0;    // … and how much of a bloom behind her: her head only (soft), never a body edge
  if (uArt > 0.5) {
  /* ---- 1. dolly + parallax occlusion ------------------------------- */
  vec2 F = vec2(uAxisX, uEye.y);                // the eyes, in the art
  vec2 Fs = vec2(uAxisX, uFrame.y);             // … and where they sit on screen
  float Z = uFrame.x * uZoom;                   // base framing × dolly
  vec2 suv = F + (uv - Fs) / Z + uPan;

  vec2 parallaxDir = (uMouse - 0.5) * 0.82 * uAmp;
  const int STEPS = 16;
  float layerDepth = (1.0 / float(STEPS)) * 0.5;
  float currentLayerDepth = 0.0;
  vec2 currentUv = suv;
  vec2 prevUv = currentUv;
  float currentDepth = getDepth(currentUv);
  float prevDepth = currentDepth;
  for (int i = 0; i < STEPS; i++) {
    if (currentDepth < currentLayerDepth) break;
    currentLayerDepth += layerDepth;
    prevUv = currentUv;
    prevDepth = currentDepth;
    currentUv -= parallaxDir * layerDepth;
    currentDepth = getDepth(currentUv);
  }
  float beforeDepth = prevDepth - (currentLayerDepth - layerDepth);
  float afterDepth = currentDepth - currentLayerDepth;
  float weight = clamp(beforeDepth / (beforeDepth - afterDepth + 1e-5), 0.0, 1.0);
  vec2 iuv = mix(prevUv, currentUv, weight);   // frame aspect == image aspect

  // the figure, measured in eye offsets (art px), so both crops cover the same figure
  float dx = iuv.x - uAxisX;
  vec2 fuv = vec2(uAxisX + abs(dx), iuv.y);
  vec2 pxA = fuv * uImgRes;
  float eo = uEye.x * uImgRes.x;
  vec2 eyeMidA = vec2(uAxisX, uEye.y) * uImgRes;
  vec2 rel = (pxA - (eyeMidA + vec2(0.0, 1.25 * eo))) / (vec2(3.12, 5.48) * eo);
  float figure = 1.0 - smoothstep(0.9, 1.55, length(rel));
  // the head matte (1 = its edge, ears to crown, down past the chin)
  float hm = length((pxA - eyeMidA - vec2(0.0, 0.4 * eo)) / (eo * vec2(2.1, 3.3)));

  col = texture(uImage, iuv).rgb;
  // outside her figure the art's backlight is a sprayed stipple: smooth it before it is replaced
  if (figure < 0.999) {
    vec3 acc = col;
    vec2 tx = 1.0 / uImgRes;
    for (int k = 0; k < 8; k++) {
      float a = float(k) * 0.7853982 + 0.39;
      vec2 dir = vec2(cos(a), sin(a));
      acc += texture(uImage, iuv + dir * 7.0 * tx).rgb;
      acc += texture(uImage, iuv + dir.yx * vec2(1.0, -1.0) * 16.0 * tx).rgb;
    }
    col = mix(acc / 17.0, col, figure);
  }
  // the portrait crop's top rows are a vertical-streak glitch band: the framing keeps
  // them out of shot; anything the orbit still pulls from there is the art just under it
  if (uFrame.z > 0.0) {
    float g = 1.0 - smoothstep(uFrame.z - 0.004, uFrame.z + 0.018, iuv.y);
    if (g > 0.0) {
      vec3 fill = vec3(0.0);
      for (int i = -4; i <= 4; i++) fill += texture(uImage, vec2(iuv.x + float(i) * 0.03, uFrame.z + 0.03)).rgb;
      col = mix(col, fill / 9.0, g);
    }
  }

  /* ---- 2. tint, grade ---------------------------------------------- */
  float sat = max(max(col.r, col.g), col.b) - min(min(col.r, col.g), col.b);
  // the art's own backlight (bright, grey) vs the silhouette (dark or purple)
  float backlit = smoothstep(0.35, 0.6, dot(col, vec3(0.299, 0.587, 0.114))) * (1.0 - smoothstep(0.1, 0.25, sat));
  // her matte: inside the figure box, whatever is not the art's backlight is her
  // (inside her head the lit stripes are her too, never backlight)
  float headCore = 1.0 - smoothstep(0.62, 0.82, hm);
  occ = uOcc * figure * max(1.0 - backlit, headCore);
  // a bloom behind her is hidden by her HEAD (softly, past its edge): light from behind wraps the body
  occG = occ * (1.0 - smoothstep(1.0, 1.5, hm));
  float backW = clamp(max(backlit, 1.0 - figure), 0.0, 1.0) * (1.0 - headCore);
  col = mix(col, uBrand * (0.5 + dot(col, vec3(0.299, 0.587, 0.114)) * 1.5),
            0.10 * smoothstep(0.03, 0.30, sat));
  col = grade(col);

  /* ---- 3. the room: a clean motivated key replaces the art's cream disc ---- */
  col = mix(col, wallLight(px), backW);

  /* ---- scrim, vignette, wash (the site's cover) --------------------- */
  col = mix(col, INK, scrimA(uv.y));
  {
    // the cover's vignette, as one smooth curve (the CSS stops' piecewise ramps showed as rings)
    float d = length((uv - vec2(0.50, 0.46)) / vec2(1.05, 0.88));
    float va = 0.92 * pow(smoothstep(0.30, 1.08, d), 1.15);
    col = mix(col, INK, va);
    float d2 = length((uv - vec2(0.52, 0.32)) / vec2(0.62, 0.50));
    col = mix(col, uBrand, 0.12 * max(0.0, 1.0 - d2 / 0.72));
  }

  /* ---- 4. reveal from black: the eyes first ------------------------ */
  if (uReveal < 2.0 || uEyes < 1.0) {
    vec2 eL = vec2(uAxisX - uEye.x * Z, uFrame.y) * uRes;
    vec2 eR = vec2(uAxisX + uEye.x * Z, uFrame.y) * uRes;
    float sep = 2.0 * uEye.x * Z * uRes.x;
    // a soft, organic edge (light arriving, not a datamosh): near-isotropic low noise
    float edge = perlin(vec3(pxC * vec2(0.0036, 0.0026), uTime * 0.03)) * 0.6
               + perlin(vec3(pxC * vec2(0.009, 0.0065), uTime * 0.05)) * 0.22;
    float dE = min(length(px - eL), length(px - eR)) / sep;
    float em = (1.0 - smoothstep(0.16, 0.6, dE + edge * 0.12)) * uEyes;
    float rd = length(px - (eL + eR) * 0.5) / (0.5 * length(uRes));
    float rm = 1.0 - smoothstep(uReveal - 0.28, uReveal, rd + edge * 0.2);
    float m = max(rm, em);
    col = ROOM + (col - ROOM) * (m * m * (3.0 - 2.0 * m));
    // while only the eyes are out, they catch a little more light
    col *= 1.0 + 0.55 * em * (1.0 - rm);
    occ *= max(rm, 0.0);
    occG *= max(rm, 0.0);
  }

  /* ---- 5. the eyes carry her voice --------------------------------- */
  // (the irises sit at .877 of the site's eye offset, .0053 above its eye line,
  // ~9.5 art px in radius — measured on the art)
  if (uEyeGlow > 0.001) {
    float rI = 9.5 * (uRes.x / uImgRes.x) * Z;
    float ey = (uFrame.y - 0.0053 * Z) * uRes.y;
    vec2 eL = vec2((uAxisX - 0.877 * uEye.x * Z) * uRes.x, ey);
    vec2 eR = vec2((uAxisX + 0.877 * uEye.x * Z) * uRes.x, ey);
    float dI = min(length(px - eL), length(px - eR)) / rI;
    float iris = (1.0 - smoothstep(0.45, 1.12, dI)) * (0.55 + 0.45 * exp(-dI * dI * 3.0));
    float bloom = exp(-dI * dI / 9.0);
    col = screen(col, vec3(0.73, 0.64, 1.0) * uEyeGlow * uEyes * (2.2 * iris + 0.7 * bloom));
  }
  }

  /* ---- 6. the four lights ------------------------------------------ */
  // every orb throws its own light; a bloom behind the figure only shows
  // where she does not hide it, so it rims her silhouette
  vec3 glow = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    vec4 g = uGlowP[i];
    if (g.w <= 0.0) continue;
    vec2 dd = (px - g.xy) / g.z;
    float e = exp(-dot(dd, dd)) * g.w;
    if (uGlowBack[i] > 0.5) e *= 1.0 - occG;
    glow += uGlowC[i] * e;
  }
  col = screen(col, glow);
  if (uOrbOn > 0.5) {
    vec4 ob = texture(uOrbBack, vUv) * (1.0 - occ);
    col = ob.rgb + col * (1.0 - ob.a);
    vec4 of = texture(uOrbFront, vUv);
    col = of.rgb + col * (1.0 - of.a);
    // halation: part of each light's bloom lies over its own body (an emitter)
    col = screen(col, glow * uGlowOver);
  }

  // ±0.5/255 dither (the film grain is the global overlay)
  col += grainN * 0.002;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;
