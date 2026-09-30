/**
 * The CTA's single WebGL2 pass: the site's hero portrait (depth-portrait.tsx)
 * rebuilt for the film, plus the silver backlight halo the logo lands on.
 *
 *   0. framing: the art is placed so its eyes sit on the logo centre (the
 *      portrait crop is pushed in so its glitch band, v < 0.14, stays out)
 *   1. dolly (push-in about the eyes) + parallax-occlusion march through the
 *      depth map (white = near), driven by a scripted "pointer" orbit — the
 *      site's DepthPortrait with its 0.048 amplitude
 *   2. the site's dissolve: domain-warped Perlin fbm, skewed 1 : 0.25 so it
 *      tears into vertical filaments, folded about the face axis, eyes guarded
 *   3. the site's grade (brightness .82 · contrast 1.18 · saturate .88), the
 *      10 % pigment tint, then the hero scrim + wash, exactly as the CSS
 *   4. ERASE: a filament-noise threshold swaps the figure for the halo:
 *      thresholds spread over the whole window (outside-in, eyes last), the
 *      torn edge catches the light, the eyes flash lilac as they go
 *   5. REVEAL: from black, the eyes first, then a noisy radial opening
 *   6. the halo: #c4c0ba → #a19e97 → #7b7a7d → night, a round light with a
 *      flatter (superelliptic) underside, grainy falloff like the art's own
 *      backlight — the grain is fixed to the light, so it never boils
 *
 * Perlin / fbm are the site's (components/site/cover-noise.ts), copied
 * verbatim apart from the octave count, which is a uniform here so the
 * render stays inside the frame budget.
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
uniform vec2  uMouse;     // scripted pointer, 0..1
uniform float uAmp;       // parallax amplitude (site: 0.048)
uniform float uZoom;      // dolly about the eyes
uniform vec2  uPan;       // extra camera pan, uv
uniform float uTime;      // noise clock
uniform float uWarp;      // peak tear (site: 1.15)
uniform float uTear;      // 0..1 tear envelope
uniform float uLiquid;    // 0..1 entry: tear spreads over the whole frame
uniform float uErase;     // 0 portrait -> 1 halo only
uniform float uReveal;    // radial reveal radius (frame half-diagonals)
uniform float uEyes;      // 0..1 eyes-first
uniform float uAxisX;
uniform vec3  uEye;       // eye offset from axis, eye y, guard radius
uniform float uSubject;
uniform vec3  uBrand;     // #551a89
uniform vec2  uHaloC;     // halo centre, canvas px (y down)
uniform vec3  uHaloR;     // rx, ry above, ry below (canvas px)
uniform float uHaloGain;
uniform vec4  uFloor;     // y where the floor starts (at the axis), its length (canvas px), strength, rise at ±rx (px)
uniform vec3  uHaloShape; // underside superellipse power, low-freq wobble, falloff grain
uniform vec3  uFrame;     // base zoom, screen y of the eyes (0..1), art glitch-band edge v (0 = none)
uniform float uSeed;      // frame, for the site dither

const vec3 INK        = vec3(6.0, 4.0, 10.0) / 255.0;
const vec3 SILVER     = vec3(196.0, 192.0, 186.0) / 255.0;
const vec3 SILVER_MID = vec3(161.0, 158.0, 151.0) / 255.0;
const vec3 SILVER_LOW = vec3(123.0, 122.0, 125.0) / 255.0;

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
const mat2 rotHalf = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
float fbm(vec3 st) {
  float value = 0.0;
  float amp = 0.25;
  const float aM = 0.1 + 0.86 * 0.65;
  vec2 shift = vec2(100.0);
  for (int i = 0; i < OCTAVES; i++) {
    value += amp * perlin(st);
    st.xy *= rotHalf * 2.5;
    st.xy += shift;
    amp *= aM;
  }
  return value;
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

/* The hero scrim (linear, top -> bottom), as the CSS stops. */
float scrimA(float y) {
  if (y < 0.20) return mix(0.72, 0.10, y / 0.20);
  if (y < 0.44) return mix(0.10, 0.26, (y - 0.20) / 0.24);
  if (y < 0.62) return mix(0.26, 0.66, (y - 0.44) / 0.18);
  if (y < 0.82) return mix(0.66, 0.90, (y - 0.62) / 0.20);
  return mix(0.90, 1.0, clamp((y - 0.82) / 0.18, 0.0, 1.0));
}

/* The halo ramp: silver core, #a19e97, #7b7a7d, then out to night. */
vec3 haloRamp(float d) {
  vec3 c = SILVER;
  c = mix(c, SILVER_MID, smoothstep(0.36, 0.86, d));
  c = mix(c, SILVER_LOW, smoothstep(0.80, 0.95, d));
  return mix(c, INK, smoothstep(0.90, 1.14, d));
}

void main() {
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);          // y down
  vec2 px = uv * uRes;
  float grainN = hash12(gl_FragCoord.xy + fract(uSeed * 0.618) * 311.0) - 0.5;

  /* ---- halo ------------------------------------------------------- */
  vec2 hd = px - uHaloC;
  bool under = hd.y > 0.0;
  vec2 q = abs(hd / vec2(uHaloR.x, under ? uHaloR.z : uHaloR.y));
  // round above; a flatter superellipse underneath, so the wordmark sits deep
  // in the light and the frame goes back to night right under it
  float pw = under ? uHaloShape.x : 2.0;
  float hr = pow(pow(q.x, pw) + pow(q.y, pw), 1.0 / pw);
  // the art's backlight is not a clean disc: a gently uneven, grungy rim …
  vec2 hs = px / uRes.y;
  hr += (perlin(vec3(hs * 3.2, 1.7)) * uHaloShape.y + perlin(vec3(hs * 9.0, 4.1)) * 0.035) * smoothstep(0.45, 0.95, hr);
  // … that falls off in grain, not in a clean gradient. The grain is pinned to
  // the light (halo-space hash, no time term): it moves with it, never boils.
  float haloGrain = hash12(floor(hd) + vec2(71.0, 113.0)) - 0.5;
  hr += haloGrain * uHaloShape.z * smoothstep(0.55, 1.0, hr);
  vec3 halo = haloRamp(hr);
  // the underside of the light settles under the wordmark once the logo is
  // in: a soft falloff whose edge curves up with the ellipse (no straight seam)
  float fy = uFloor.x - uFloor.w * (hd.x / uHaloR.x) * (hd.x / uHaloR.x);
  halo = mix(halo, INK, uFloor.z * smoothstep(0.0, 1.0, (px.y - fy) / uFloor.y));
  halo *= uHaloGain;

  if (uErase >= 0.999) {
    fragColor = vec4(clamp(halo + grainN * 0.012, 0.0, 1.0), 1.0);
    return;
  }

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

  /* ---- 2. dissolve (site) ------------------------------------------ */
  float imgAspect = uImgRes.x / uImgRes.y;
  const float REF_SUBJECT = 0.2288;
  const float REF_ASPECT = 1.7778;
  float dx = iuv.x - uAxisX;
  float side = dx < 0.0 ? -1.0 : 1.0;
  vec2 fuv = vec2(uAxisX + abs(dx), iuv.y);
  float headW = uSubject;
  float headH = uSubject * imgAspect;

  // measured in eye offsets (art px), so both crops cover the same figure
  // (landscape: identical to the site-tuned 0.16 x 0.50 uv box about y .52)
  vec2 pxA = fuv * uImgRes;
  float eo = uEye.x * uImgRes.x;
  vec2 eyeMidA = vec2(uAxisX, uEye.y) * uImgRes;
  vec2 rel = (pxA - (eyeMidA + vec2(0.0, 1.25 * eo))) / (vec2(3.12, 5.48) * eo);
  float figure = 1.0 - smoothstep(0.9, 1.55, length(rel));
  float mDist = mix(figure, 1.0, uLiquid);

  float eyeD = length((fuv - vec2(uAxisX + uEye.x, uEye.y)) / vec2(uEye.z * 1.5, uEye.z));
  float eyeGuard = 1.0 - smoothstep(1.15, 2.1, eyeD);

  vec2 warp = vec2(0.0);
  float nn = 0.5;
  bool busy = (uTear > 0.001 || (uErase > 0.001 && uErase < 0.999)) && mDist > 0.002;
  if (busy) {
    const float REF_EYE_Y = 0.4063;
    float blobDrop = (0.5 - REF_EYE_Y) / (REF_SUBJECT * REF_ASPECT);
    vec2 pos = vec2(uAxisX, uEye.y + blobDrop * headH);
    vec2 stIso = ((fuv - pos) * uImgRes) / (headW * uImgRes.x) * 1.7806;
    vec2 st = stIso * vec2(1.0, 0.25);
    vec2 drift = vec2(0.0, uTime * 0.005);
    float t = uTime * 0.025;
    vec2 r = vec2(
      fbm(vec3(st - drift + vec2(1.7, 9.2), t)),
      fbm(vec3(st - drift + vec2(8.2, 1.3), t))
    );
    float f = fbm(vec3(st + r - drift, t)) * 0.35;
    vec2 fine = f * 2.0 + r * 0.35;
    vec2 warpScale = (headW / REF_SUBJECT) * vec2(1.0, imgAspect / REF_ASPECT);
    warp = fine * mDist * uWarp * uTear * warpScale;
    nn = clamp(0.5 + (r.x * 1.3 + f * 2.2), 0.0, 1.0);
  }
  warp *= 1.0 - eyeGuard;
  warp.x *= side;

  vec2 tuv = iuv + warp;
  vec3 col = texture(uImage, tuv).rgb;
  // the portrait crop's top rows are a vertical-streak glitch band: the
  // framing keeps them out of shot, and anything the orbit or the tear still
  // pulls from there is replaced by the backlight just under it, smoothed
  if (uFrame.z > 0.0) {
    float g = 1.0 - smoothstep(uFrame.z - 0.004, uFrame.z + 0.018, tuv.y);
    if (g > 0.0) {
      vec3 fill = vec3(0.0);
      for (int i = -4; i <= 4; i++) fill += texture(uImage, vec2(tuv.x + float(i) * 0.03, uFrame.z + 0.03)).rgb;
      col = mix(col, fill / 9.0, g);
    }
  }

  /* ---- 3. tint, grade, scrim, wash --------------------------------- */
  float sat = max(max(col.r, col.g), col.b) - min(min(col.r, col.g), col.b);
  // the art's own backlight (bright, grey) vs the silhouette (dark or purple):
  // inside the figure box the light breaks through first
  float backlit = smoothstep(0.35, 0.6, dot(col, vec3(0.299, 0.587, 0.114))) * (1.0 - smoothstep(0.1, 0.25, sat));
  col = mix(col, uBrand * (0.5 + dot(col, vec3(0.299, 0.587, 0.114)) * 1.5),
            0.10 * smoothstep(0.03, 0.30, sat));
  col = grade(col);
  col = mix(col, INK, scrimA(uv.y));
  {
    float d = length((uv - vec2(0.50, 0.46)) / vec2(1.05, 0.88));
    float va = d < 0.34 ? 0.0 : d < 0.76 ? mix(0.0, 0.55, (d - 0.34) / 0.42)
             : d < 1.0 ? mix(0.55, 0.92, (d - 0.76) / 0.24) : 0.92;
    col = mix(col, INK, va);
    float d2 = length((uv - vec2(0.52, 0.32)) / vec2(0.62, 0.50));
    col = mix(col, uBrand, 0.16 * max(0.0, 1.0 - d2 / 0.72));
  }

  /* ---- 4. erase: figure -> halo ------------------------------------ */
  if (uErase > 0.0) {
    // Every figure pixel gets its own threshold k, spread over the whole
    // window: filament noise (contrast-remapped to ~0..1) mixed with the
    // distance from the eyes, so the silhouette frays from the outside in,
    // in vertical filaments, and the eyes go last.
    float dEye = length(pxA - (eyeMidA + vec2(eo, 0.0))) / eo;
    float eyeBias = 1.0 - smoothstep(0.35, 1.25, dEye);
    float dMid = clamp(length((pxA - eyeMidA) / vec2(1.0, 1.15)) / (6.0 * eo), 0.0, 1.0);
    float nr = smoothstep(0.26, 0.74, nn);
    float k = mix(nr, 1.0 - dMid, 0.45);
    // (never inside the head itself: its highlights are not backlight)
    float head = 1.0 - smoothstep(0.85, 1.2, length((pxA - eyeMidA - vec2(0.0, 0.4 * eo)) / (eo * vec2(2.1, 3.3))));
    k = max(0.0, k - 0.42 * backlit * (1.0 - head));
    k = mix(k, 0.88 + 0.12 * nr, eyeBias);
    const float BAND = 0.1;
    float e = mix(-BAND, 1.0 + BAND, uErase);
    float mFig = smoothstep(k - BAND, k + BAND, e);
    float mBg = smoothstep(0.0, 0.7, uErase);
    float m = mix(mBg, mFig, figure);
    // the torn edge catches the light; around the eyes it flashes lilac —
    // the eyes are what the core is made of
    float rim = smoothstep(0.0, 0.5, mFig) * (1.0 - smoothstep(0.5, 1.0, mFig)) * figure;
    // only where there is light to catch (never grey fur over the dark body)
    float lit = smoothstep(0.08, 0.45, dot(halo, vec3(0.333)));
    float eyeFlash = 1.0 - smoothstep(0.3, 0.95, dEye);
    vec3 rimCol = mix(vec3(0.80, 0.77, 0.86) * 0.32 * lit, vec3(0.73, 0.64, 1.0) * 0.75, eyeFlash);
    col = mix(col, halo, m);
    col += rim * rimCol;
  }

  /* ---- 5. reveal from black: the eyes first ------------------------ */
  if (uReveal < 2.0 || uEyes < 1.0) {
    vec2 eL = vec2(uAxisX - uEye.x * Z, uFrame.y) * uRes;
    vec2 eR = vec2(uAxisX + uEye.x * Z, uFrame.y) * uRes;
    float sep = 2.0 * uEye.x * Z * uRes.x;
    // vertical-streak edge noise, the dissolve's own language
    float edge = perlin(vec3(px * vec2(0.006, 0.0015), uTime * 0.03)) * 0.6
               + perlin(vec3(px * vec2(0.02, 0.005), uTime * 0.05)) * 0.3;
    float dE = min(length(px - eL), length(px - eR)) / sep;
    float em = (1.0 - smoothstep(0.16, 0.6, dE + edge * 0.12)) * uEyes;
    float rd = length(px - (eL + eR) * 0.5) / (0.5 * length(uRes));
    float rm = 1.0 - smoothstep(uReveal - 0.26, uReveal, rd + edge * 0.28);
    float m = max(rm, em);
    col *= m * m * (3.0 - 2.0 * m);
    // while only the eyes are out, they catch a little more light
    col *= 1.0 + 0.55 * em * (1.0 - rm);
  }

  col += grainN * 0.016;                      // the site's dither (0.016)
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;
