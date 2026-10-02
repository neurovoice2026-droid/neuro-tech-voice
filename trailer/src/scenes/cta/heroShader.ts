/**
 * The CTA's single WebGL2 pass: the site's hero portrait (depth-portrait.tsx)
 * rebuilt for the film, the room she stands in, the four lights, and the
 * merged light the wordmark lands in.
 *
 *   0. framing: the art is placed so its eyes sit at uFrame.y (any of the
 *      portrait crop's glitch band, v < 0.14, the framing reaches is filled
 *      from the art just under it)
 *   1. dolly (push-in about the eyes) + parallax-occlusion march through the
 *      depth map (white = near), driven by a scripted "pointer" orbit — the
 *      site's DepthPortrait with its 0.048 amplitude
 *   2. the site's grade (brightness .82 · contrast 1.18 · saturate .88), the
 *      10 % pigment tint, then the hero scrim + wash, exactly as the CSS
 *   3. THE ROOM: the art's own sprayed cream backlight (a flat disc with a
 *      stippled edge) is replaced by a clean, motivated light on a near-black
 *      wall — one low key behind her head, a point light's Lambert falloff
 *      ((1 + u²)^−3/2, no edge, no plateau), its colour her lilac at low
 *      chroma (uWall, uWallC); the wall falls dark toward her silhouette (a
 *      soft matte, so the art's cut-out edge never reads as an edge) and the
 *      whole figure sits in a feathered radial matte about her head (uVig,
 *      ≈ 120 px of falloff): no shoulder line, no horizon, she comes out of the
 *      night. Her face: the art's stipple smoothed (eyes guarded), the stripe
 *      shadows lifted out of the crushed black, so the stripes read as light.
 *   4. REVEAL: from black, the eyes first, then a soft radial opening (the
 *      converge plays it backwards: the light closes on her, the eyes last)
 *   5. the eyes carry her voice (her real envelope, uEyeGlow)
 *   6. the four lights: two premultiplied orb layers (FluidOrbs drawn in
 *      THIS context by orbPass.ts): the back one is occluded by the figure's
 *      own matte, the front one sits over everything; every orb throws a
 *      tight bloom of its own light (an emitter, not a marble) and KEYS her
 *      face from its side (uGlowSpill: its light on her surface only — a
 *      point light's falloff, the lit stripes catching it most); while the
 *      lights lead her own purple calms (uFace.w), so the light in turn is
 *      the colour on her face
 *   7. after the impact (uArt = 0): THE BACKLIGHT behind the wordmark — the
 *      merged light standing as a wide, filled ellipse of lilac-white light
 *      (no plateau: brightest at the core, falling the whole way, one C¹
 *      curve through its stops so no stop shows as a ring) whose falloff
 *      takes the four lights' colours on its rim (rose top-left, emerald
 *      top-right, teal bottom-right, violet bottom-left) and spills a little
 *      of them past its edge; its underside settles under the word (uFloor)
 *      so the button sits on the night.
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
uniform vec4  uMerge;     // the backlight: body gain, rim peak (≤ .75), rim spill past the edge, core lift
uniform vec4  uFloor;     // y where the floor starts (at the axis), its length (canvas px), strength, rise at ±rx (px)
uniform vec3  uFrame;     // base zoom, screen y of the eyes (0..1), art glitch-band edge v (0 = none)
uniform float uSeed;      // frame, for the dither
uniform sampler2D uOrbBack;  // premultiplied orb layer behind the figure
uniform sampler2D uOrbFront; // premultiplied orb layer in front of everything
uniform float uOrbOn;     // 1 while any orb is drawn
uniform float uOcc;       // how much the figure hides the back layer (0..1)
uniform vec4  uGlowP[4];  // orb bloom: centre (canvas px, y down), radius px, strength
uniform vec3  uGlowC[4];  // orb bloom colour
uniform float uGlowBack[4]; // how far this bloom is behind the figure (0..1)
uniform float uEyeGlow;   // the eyes' light, driven by Ava's real voice envelope (0..1)
uniform vec4  uRim;       // the four lights on the corona: strength (0..1), (unused), (unused), angular half-width (rad)
uniform vec3  uRimC[4];   // the four lights' arc colours: top-left, top-right, bottom-right, bottom-left
uniform float uGlowOver;  // how much of each orb's bloom also lies over its own body
uniform float uGlowSpill[4]; // each light's key on her face (0..)
uniform vec3  uSpillC[4];  // … its colour on her
uniform vec2  uSpill;     // the key's reach (CSS px), gain
uniform vec4  uVig;       // her matte: centre drop below the eyes, radii x / y (eye offsets), feather (CSS px)
uniform vec4  uFace;      // de-stipple radius (art px), de-stipple amount, shadow lift, her purple calmed (0..1)
uniform float uWallNear;  // the wall falls dark toward her silhouette over this many art px

const vec3 INK  = vec3(6.0, 4.0, 10.0) / 255.0;
const vec3 ROOM = vec3(5.0, 4.0, 8.0) / 255.0;
// THE BACKLIGHT (the merged light): a lilac-white core (#f4efff), #dccfff, the night's light
// (#b298f6), a deep violet edge (#36176f), the night
const vec3 L_CORE = vec3(244.0, 239.0, 255.0) / 255.0;
const vec3 L_HI   = vec3(220.0, 207.0, 255.0) / 255.0;
const vec3 L_MID  = vec3(178.0, 152.0, 246.0) / 255.0;
const vec3 L_EDGE = vec3(54.0, 23.0, 111.0) / 255.0;

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

/* CSS filter: brightness(b) contrast(k) saturate(.88), in order (the site: .82, 1.18). */
vec3 grade(vec3 c, float b, float k) {
  c = clamp(c * b, 0.0, 1.0);
  c = clamp((c - 0.5) * k + 0.5, 0.0, 1.0);
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

/* One monotone C¹ step across [a, b] (Hermite, end-slope ratios s0, s1 = slope × length / rise):
   the backlight's stops joined so no stop shows as a ring. */
float herm(float a, float b, float s0, float s1, float d) {
  float u = clamp((d - a) / (b - a), 0.0, 1.0);
  float u2 = u * u, u3 = u2 * u;
  return (-2.0 * u3 + 3.0 * u2) + s0 * (u3 - 2.0 * u2 + u) + s1 * (u3 - u2);
}

/* THE BACKLIGHT at halo distance d (1 = where it turns to its edge): no plateau — brightest at the
   core and falling the whole way, lilac-white to the night's light by .9 (the wordmark's ends sit
   there, still in the light), through its edge colour (the four lights on the rim) to the night. */
vec3 backlight(float d, vec3 edgeC) {
  vec3 c = L_CORE;
  c = mix(c, L_HI, herm(0.0, 0.52, 0.0, 1.2, d));
  c = mix(c, L_MID, herm(0.52, 0.92, 0.8, 1.3, d));
  c = mix(c, edgeC, herm(0.92, 1.16, 0.7, 1.1, d));
  return mix(c, INK, herm(1.16, 1.55, 0.8, 0.0, d));
}

void main() {
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);          // y down
  vec2 px = uv * uRes;
  vec2 pxC = px / uPxScale;                      // CSS px (absolute frequencies)
  float grainN = hash12(gl_FragCoord.xy + fract(uSeed * 0.618) * 311.0) - 0.5;

  /* ---- the backlight (the end card) ------------------------------- */
  vec2 hd = px - uHaloC;
  // (ry above → ry below eased across the axis: a hard switch left a kink, a faint line, at the centre row)
  vec2 R = vec2(uHaloR.x, mix(uHaloR.y, uHaloR.z, smoothstep(-0.6, 0.6, hd.y / max(uHaloR.y, 1.0))));
  vec2 q = hd / R;
  float hr = length(q);
  vec3 halo = vec3(0.0);
  if (uHaloGain > 0.0005) {
    // the four lights on its rim: its edge takes each light's colour at its diagonal (rose
    // top-left, emerald top-right, teal bottom-right, violet bottom-left), the night's violet
    // in between — light spilling round a source, never a tube
    vec3 edgeC = L_EDGE;
    vec3 rimSum = vec3(0.0);
    if (uRim.x > 0.0) {
      float a = atan(q.x, -q.y);                       // 0 at the top, clockwise
      const float ARC_A[4] = float[4](-0.785398, 0.785398, 2.356194, -2.356194);
      for (int i = 0; i < 4; i++) {
        float da = atan(sin(a - ARC_A[i]), cos(a - ARC_A[i]));
        float wA = uRim.x * exp(-pow(da / uRim.w, 2.0));
        edgeC = mix(edgeC, uRimC[i] * uMerge.y, wA);
        rimSum += uRimC[i] * wA;
      }
    }
    halo = backlight(hr, edgeC) * uMerge.x;
    // a little of the rim's light spills past the edge (soft, ≤ its peak × uMerge.z)
    halo += rimSum * uMerge.y * uMerge.z * exp(-pow((hr - 1.16) / 0.22, 2.0));
    // the core's own bloom: the light reads as light, not as a flat slab
    halo += L_CORE * uMerge.w * exp(-3.2 * hr * hr);
    // the underside settles under the wordmark: a soft falloff whose edge curves up with the ellipse
    float fy = uFloor.x - uFloor.w * (hd.x / uHaloR.x) * (hd.x / uHaloR.x);
    halo = mix(halo, INK, uFloor.z * smoothstep(0.0, 1.0, (px.y - fy) / uFloor.y));
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
  vec2 tx = 1.0 / uImgRes;
  // outside her figure the art's backlight is a sprayed stipple: smooth it before it is replaced
  if (figure < 0.999) {
    vec3 acc = col;
    for (int k = 0; k < 8; k++) {
      float a = float(k) * 0.7853982 + 0.39;
      vec2 dir = vec2(cos(a), sin(a));
      acc += texture(uImage, iuv + dir * 7.0 * tx).rgb;
      acc += texture(uImage, iuv + dir.yx * vec2(1.0, -1.0) * 16.0 * tx).rgb;
    }
    col = mix(acc / 17.0, col, figure);
  }
  // HER FACE: the art's stripes are a sprayed stipple (upscaled ≈ 1.9× at 4K, it reads as
  // blotches): a small disc average inside her head smooths it, the eyes guarded (lashes and
  // irises stay crisp). A static optical treatment of the art, never animated.
  float faceM = 1.0 - smoothstep(0.95, 1.2, hm);
  if (uFace.y > 0.0 && faceM > 0.0) {
    vec2 eA = eyeMidA + vec2(eo, 0.0);           // (folded about the axis: one eye stands for both)
    float eyeG = 1.0 - smoothstep(0.8, 1.25, length((pxA - eA) / (eo * vec2(0.62, 0.34))));
    float k = uFace.y * faceM * (1.0 - eyeG);
    if (k > 0.001) {
      vec3 acc = col;
      for (int j = 0; j < 8; j++) {
        float a = float(j) * 0.7853982;
        vec2 dir = vec2(cos(a), sin(a));
        acc += texture(uImage, iuv + dir * uFace.x * tx).rgb;
        acc += texture(uImage, iuv + vec2(dir.x - dir.y, dir.x + dir.y) * (0.7071 * 1.9 * uFace.x) * tx).rgb;
      }
      col = mix(col, acc / 17.0, k);
    }
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
  // the art's own backlight (bright, grey) vs the silhouette (dark or purple); toward her silhouette
  // (outside her face) a lower threshold takes the antialiased fringe too — on the near-black wall a
  // half-cream edge pixel would draw her outline as a grey line
  float lumA = dot(col, vec3(0.299, 0.587, 0.114));
  float greyA = 1.0 - smoothstep(0.1, 0.25, sat);
  float backlit = max(smoothstep(0.35, 0.6, lumA), smoothstep(0.08, 0.36, lumA) * smoothstep(0.72, 0.92, hm)) * greyA;
  // her matte: inside the figure box, whatever is not the art's backlight is her
  // (inside her head the lit stripes are her too, never backlight)
  float headCore = 1.0 - smoothstep(0.62, 0.82, hm);
  occ = uOcc * figure * max(1.0 - backlit, headCore);
  // a bloom behind her is hidden by her HEAD (softly, past its edge): light from behind wraps the body
  occG = occ * (1.0 - smoothstep(1.0, 1.5, hm));
  float backW = clamp(max(backlit, 1.0 - figure), 0.0, 1.0) * (1.0 - headCore);
  col = mix(col, uBrand * (0.5 + dot(col, vec3(0.299, 0.587, 0.114)) * 1.5),
            0.10 * smoothstep(0.03, 0.30, sat));
  // the site's grade (.82 · 1.18) crushes the stripes' shadow side to black — the posterised
  // blocks: on her face a gentler contrast, and the toe lifted a little (a night's bounce, violet-grey),
  // so the stripes read as light falling across her
  // (her face only: toward her silhouette the site's grade holds, so the head's outline stays in
  // the night — no grey cut-out)
  float faceIn = 1.0 - smoothstep(0.58, 0.86, hm);
  vec3 her = grade(col, 0.86, 1.04);
  her += uFace.z * vec3(0.085, 0.07, 0.115) * (1.0 - smoothstep(0.0, 0.2, dot(her, vec3(0.2126, 0.7152, 0.0722))));
  col = mix(grade(col, 0.82, 1.18), her, faceIn * (1.0 - backlit));
  // while the four lights lead, her own purple calms (luminance kept): the light in turn is the colour on her
  float faceW = (1.0 - backW) * (uFace.w > 0.0 ? 1.0 : 0.0);
  {
    float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(col, vec3(l) * vec3(0.97, 0.96, 1.05), uFace.w * faceW);
  }

  /* ---- 3. THE KEY: the light in turn on her, from its side ----------- */
  // a point light's falloff ((1 + u²)^−3/2) on her surface only (never the wall: that is the
  // bloom's job): the lit stripes catch it most, the shadow side a little
  if (uSpill.y > 0.0) {
    vec3 key = vec3(0.0);
    for (int i = 0; i < 4; i++) {
      if (uGlowSpill[i] <= 0.0) continue;
      vec2 dd = (px - uGlowP[i].xy) / (uSpill.x * uPxScale);
      key += uSpillC[i] * uGlowSpill[i] * pow(1.0 + dot(dd, dd), -1.5);
    }
    float l0 = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col += key * (1.0 - backW) * uSpill.y * (0.1 + 1.15 * l0);
  }

  // her head's outer band (ears, jaw, crown edge) falls into the night: the art's thin rim line on
  // her silhouette never reads as a cut-out outline
  col *= mix(1.0, 0.42, smoothstep(0.76, 1.0, hm) * (1.0 - backW));

  /* ---- 4. the room: a low, clean key replaces the art's cream disc ---- */
  // (it falls dark toward her silhouette — the head matte, smooth — so the art's cut-out edge
  // never meets a lit wall)
  vec3 wall = mix(ROOM, wallLight(px), uWallNear > 0.0 ? smoothstep(1.0, 1.0 + uWallNear, hm) : 1.0);
  col = mix(col, wall, backW);

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
  /* ---- her matte: a feathered ellipse about her head (no shoulder line, no horizon) ---- */
  {
    vec2 vr = vec2(uVig.y, uVig.z) * eo;
    vec2 vq = (pxA - (eyeMidA + vec2(0.0, uVig.x * eo))) / vr;
    float vd = length(vq);
    float vgr = length(vq / vr) / max(vd, 1e-4);
    float outA = (vd - 1.0) / max(vgr, 1e-6);                  // art px outside the ellipse
    float artPerCss = uImgRes.x * uPxScale / (uRes.x * Z);       // art px per CSS px
    float vig = 1.0 - smoothstep(0.0, uVig.w * artPerCss, outA);
    col = mix(ROOM, col, vig);
    occ *= vig;
    occG *= vig;
  }

  /* ---- 5. reveal from black: the eyes first ------------------------ */
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

  /* ---- 6. the eyes carry her voice --------------------------------- */
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

  /* ---- 7. the four lights ------------------------------------------ */
  // every orb throws its own light; a bloom behind the figure only shows
  // where she does not hide it, so it rims her silhouette
  vec3 glow = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    vec4 g = uGlowP[i];
    if (g.w <= 0.0) continue;
    vec2 dd = (px - g.xy) / g.z;
    float e = exp(-dot(dd, dd)) * g.w;
    e *= 1.0 - occG * uGlowBack[i];
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
