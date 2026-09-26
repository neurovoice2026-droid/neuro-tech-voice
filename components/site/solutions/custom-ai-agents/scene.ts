import type { Scene } from "@/components/site/industry/shader-stage";

/* ------------------------------------------------------------------ *
 * Custom AI Agents — a music-box movement, playing.
 *
 *   the object   a bare cylinder movement, out of its box: a brass
 *                bedplate, a pinned brass cylinder on a steel arbor
 *                between two steel bridges, a steel comb of twelve graded
 *                teeth screwed down in front of it, and on the desktop a
 *                governor fan spinning on its staff behind the right
 *                bridge.
 *
 *   why this     the comb is the voice. The pins are one business's
 *                decisions, set by hand, one at a time — which is the
 *                band's kicker, word for word. It is a CUSTOM mechanism
 *                that makes SOUND, which is the whole page in one object;
 *                it is a real thing that stands on a real table; and it
 *                loops by nature, because a cylinder that has gone round
 *                once is exactly where it started.
 *
 *   the motion   one revolution every twelve seconds, so a pin slot passes
 *                the comb every three quarters of a second: slow enough to
 *                follow a single pluck, quick enough that something is
 *                always happening. The pins follow a written pattern —
 *                SLOT[16], a twelve-bit mask per slot — that runs an
 *                arpeggio up the comb and back down, two chords and two
 *                rests, so the plucks read as a tune and not as noise.
 *                A pin coming round lifts its tooth's tip; the pin slips
 *                past; the tooth rings. The ring is a decaying cosine at a
 *                VISUAL nine hertz — eighteen aliases against sixty frames
 *                and reads as a flicker — and it starts from where the pin
 *                left the tip, so the tooth never teleports. The bending
 *                is weighted by (along/L)^2, so the root never moves.
 *                Every term is a function of the cylinder's angle, so the
 *                loop has no seam; the governor spins at twelve radians a
 *                second, which is a rotation and closes on itself too.
 *
 *   the camera   twenty-two degrees above the table, the assembly turned
 *                thirty-two degrees so the cylinder runs across the frame
 *                and the comb faces the reader. A slow sway of two degrees
 *                on one sine of the loop, and the pointer leans it by a
 *                degree and a half at most — a lean, never a turntable.
 *
 * THE FOUR THINGS THAT WERE WRONG IN THE FIRST RENDERS, AND WHY THE
 * NUMBERS BELOW DIFFER FROM THE BRIEF'S:
 *
 *   · THE CYLINDER HAD NO HIGHLIGHT. Turned the brief's way round, the
 *     half-vector between the camera and the key light ran two thirds of
 *     the way along the cylinder's axis, and a cylinder can only show a
 *     highlight where its normal can reach the half-vector — so it
 *     reached nowhere, and the brass came back as an evenly yellow tube.
 *     The turn is now the other way (the right end nearer), and the key
 *     is swung left to (-0.70, 0.60, 0.40), which puts the half-vector
 *     within four degrees of square to the axis: one long polished streak
 *     down the cylinder, which is what says "turned brass".
 *   · THE PLUCK WAS BEHIND THE CYLINDER. With the tips at 0.75 radians
 *     below the front horizontal, a camera twenty-two degrees up sees
 *     them exactly on the cylinder's lower silhouette: every lift went up
 *     into the brass and out of sight. The tips now meet the pin circle
 *     at 0.45 radians, in front of the cylinder, and the lift is 0.026
 *     rather than 0.018 — because a tooth reads its pluck as a TILT, and
 *     a tilt of that size swings its reflection across the overhead sweep
 *     so the tooth visibly darkens and flickers back at 390 wide.
 *   · THE COMB READ AS A GRATE. Twelve teeth of equal length over a flat
 *     slab, with the bright bedplate showing between them, is a
 *     radiator. So the free lengths are graded harder (0.30 bass to 0.16
 *     treble, the base's front edge cut on the diagonal to match, on a
 *     bedplate made a little deeper to hold it), the bedplate UNDER the
 *     teeth is taken down by the comb's own occlusion so the gaps read as
 *     gaps, and three screw heads hold the base down — the small detail
 *     that says "movement" rather than "grille".
 *   · STEEL WAS BLACK. The brief's studio has a black floor from the
 *     horizon down, and every vertical face a camera looks down on
 *     reflects exactly that: the bridges and the comb's front came back
 *     as black slabs. What those faces really see is the pale table
 *     running away from them, so the floor is now the table's grey at the
 *     horizon going to black only straight down — the underside of the
 *     cylinder still goes dark, which is the contrast brass needs.
 *
 * MATERIALS. Two metals, as literals, because the object is its own
 * colour; the ground it stands on is the house palette.
 *
 *   brass         F0 (0.95, 0.78, 0.45) — cylinder, flanges, bedplate. The
 *                 cylinder is polished and, on the desktop, brushed round
 *                 its circumference (two studio samples either side of the
 *                 reflection along the turning direction). The bedplate is
 *                 satin: darker and half as mirror-like, so the flat plate
 *                 does not become a sheet of flat yellow.
 *   spring steel  F0 (0.60, 0.61, 0.64) — pins, comb, bridges, arbor,
 *                 governor.
 *
 * AND WHAT THE METAL SEES IS A STUDIO, NOT THE WALL (shader-stage.tsx says
 * why). studio() is a neutral room: a floor, an overhead sweep with a dark
 * band just above the horizon where a photographer hangs a black flag, a
 * warm key with a crisp core, a cool fill, and a softbox behind the object
 * so the flat tops — teeth, pins, the comb's base — catch light. It never
 * reads uColors. The table under it does: uColors[2], and its shadow side
 * is a violet mix, never black.
 *
 * COST. One march of 48/36/24 steps by tier, only inside the analytic
 * bounding sphere of the assembly; the table is one divide. Inside the
 * field, the cylinder-and-pins, the comb and the governor each sit behind
 * a bound that is handed back only while it is thirty times the hit
 * epsilon (a bound returned under the epsilon IS a hit). The pins are
 * found by snapping to the nearest track and the nearest angular slot —
 * one capsule, not twenty; the desktop also checks the slots either side.
 * The teeth are ONE tooth repeated in x and clamped to twelve. The pluck
 * of all twelve teeth is solved once per fragment, not once per map()
 * call. Normals are tetrahedral (four map calls).
 *
 * The desktop's one extra ray is a sixteen-step soft shadow FROM THE
 * TABLE toward the key, over a coarse field (no pins, no governor — a
 * fan blade five thousandths thick stair-steps any sixteen-step ray).
 * Cast from the metal itself it drew jagged contours across the bedplate,
 * so the object's own surfaces take the cylinder's shadow analytically
 * instead (drumShadow: the distance between the light ray and the
 * cylinder's axis, one dot product) — on every tier alike.
 *
 *   the phone keeps   cylinder, pins (nearest slot), all twelve teeth, the
 *                     pluck, the bedplate, the contact and the cylinder's
 *                     cast shadow;
 *   the phone loses   the governor, the table's shadow ray, the second
 *                     occlusion tap and the brushing samples.
 *
 * At 390x488 with the stage's 1.2 x 0.62 buffer the drawing is about
 * 290x363, the assembly about 165 px across its 1.9 units: a pin is about
 * three and a half device pixels, a tooth about six, a gap about three.
 * At 320x400 on a 1x screen, the smallest buffer there is, the gap is
 * still about two. None of them can go sub-pixel.
 *
 * FRAMING. Solved against the band's height AND the kicker under it. The
 * object was painted solid and scanned, at five points in the loop and
 * all four corners of the pointer's range; the kicker's top was read off
 * the live page at the same sizes. Its top never rises above 0.755 of the
 * band from its foot on a phone or tablet band, 0.765 on the 21:9 one —
 * against a limit of 0.83, where the docked header's pill starts. Its
 * foot has to clear the kicker, and the kicker is what sets the size:
 * on a 320 phone it wraps to five lines and starts at 0.43 of the band,
 * on a 768 tablet (24px type, 16:10) at 0.325, so the object is drawn
 * small enough to stand in what is left above it, as the trades' objects
 * do — 5px clear at 320x400, 18 at 768x480, 29 at 820x513. On the 21:9
 * band the kicker has the open left and the object stands right of it.
 *
 * THE MISTAKES THIS SET HAS MADE BEFORE, AND THIS FILE DOES NOT:
 *   · noise plasma, an abstract blob, a flat drawing — it is a built
 *     object, with parts that do what their real counterparts do;
 *   · an end-on cylinder — it runs across the frame;
 *   · chrome sampling the violet wall — the metals see studio();
 *   · an object touching nothing — the bedplate stands on the table with
 *     a contact under its edges and the cylinder's shadow beside it;
 *   · pins going sub-pixel on phones — twelve tracks, sixteen slots,
 *     pins 0.022 in radius, checked above;
 *   · anything over 0.83 of the band height — measured above;
 *   · pow() of a negative base — every pow() takes a max(…, 0.0) or a
 *     clamp; no normalize() of a vector that can be zero — the normal
 *     falls back to +y and the brushing tangent carries a bias;
 *   · a march that runs to its cap — it breaks on a pixel-relative hit,
 *     on the sphere's exit and on the table.
 * ------------------------------------------------------------------ */

const frag = `
#define TAU  6.28318531
#define EPS  0.0012
#define FAR  6.0
#define LOOP 12.0

/* ---- the movement, in its own frame: y up, the table at y = 0, the
   cylinder's axis along x, the comb toward +z. ---- */
const vec3  CYL = vec3(0.05, 0.36, -0.10);   // the cylinder's centre
const float RAD = 0.20;                      // and its radius
/* Where the comb meets the pin circle: 0.45 radians below the front
   horizontal, on a circle 0.03 outside the cylinder. See the header for
   why it is not the brief's 0.75. TIP is (z, y) of that point, solved. */
const float THC = 0.45;
const vec2  TIP = vec2(0.107103, 0.259958);
/* The comb base's front edge runs on the diagonal, so each tooth's free
   length is graded: 0.30 at the bass end, 0.16 at the treble.
   zf(x) = ZF0 + ZFK * x, and 0.99200 is 1/sqrt(1 + ZFK^2), which makes
   the cut an exact plane distance rather than a stretched one. */
const float ZF0 = 0.33710;
const float ZFK = -0.12727;

/* The assembly is turned thirty-two degrees about y — the right end
   toward the reader, so the key can put a highlight down the cylinder. */
const float CA = 0.848048;
const float SA = -0.529919;

/* ---- the studio, in world space ---- */
const vec3 KEY   = vec3(-0.69653, 0.59702, 0.39801);  // warm key, up and left
const vec3 FILLD = vec3(0.88900, 0.38100, -0.25400);  // cool fill, low right
const vec3 BACKD = vec3(0.0, 0.55470, -0.83205);      // softbox behind and above

/* ---- the two metals, as literals ---- */
const vec3 BRASS = vec3(0.95, 0.78, 0.45);
const vec3 STEEL = vec3(0.60, 0.61, 0.64);

/* The tune. One twelve-bit mask per angular slot, bit k = track k: an
   arpeggio up (0 2 4 7 9 11) and back down (9 7), a chord (0 4 7), a
   rest, up again (5 7 9), a chord (2 5 9), the top note, a rest. */
const int SLOT[16] = int[16](1, 4, 16, 128, 512, 2048, 512, 128, 145, 0, 32, 128, 512, 548, 2048, 0);

/* Resolved once a fragment in main() and read by the field, which is
   called forty-odd times a pixel and must not redo any of it. */
float gRot;           // the cylinder's angle
float gCF, gSF;       // the governor's, as cos and sin
float gOff[12];       // each tooth tip's lift, in units
vec3  gKeyL;          // the key, in the movement's frame

float hash(vec2 p){
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

vec3 toLocal(vec3 v){ return vec3(v.x * CA - v.z * SA, v.y, v.x * SA + v.z * CA); }
vec3 toWorld(vec3 v){ return vec3(v.x * CA + v.z * SA, v.y, -v.x * SA + v.z * CA); }

/* ---- exact primitives: an overestimating field is a hole in a part ---- */
float sdBox(vec3 p, vec3 b){
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}
float sdRBox(vec3 p, vec3 b, float r){ return sdBox(p, b - r) - r; }
float sdCylY(vec3 p, float r, float h){
  vec2 d = vec2(length(p.xz) - r, abs(p.y) - h);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}
float sdCylX(vec3 p, float r, float h){
  vec2 d = vec2(length(p.yz) - r, abs(p.x) - h);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

/* The bedplate: 1.84 by 0.94 and six hundredths thick. A little deeper
   than the brief's, to carry the longer bass teeth. */
float sdBed(vec3 p){ return sdRBox(p - vec3(0.0, 0.03, 0.05), vec3(0.92, 0.03, 0.47), 0.012); }

/* The cylinder and its two flanges; q is relative to CYL. */
float sdDrumBody(vec3 q){
  float d = sdCylX(q, RAD, 0.60);
  vec3 f = vec3(abs(q.x) - 0.61, q.yz);
  return min(d, sdCylX(f, 0.215, 0.012));
}

/* ---- the pins ----
   Capsules standing radially off the cylinder, 0.022 in radius and 0.045
   proud. Twelve tracks a tenth apart, sixteen slots round: the fragment
   snaps to its nearest track and its nearest slot, and only if SLOT says
   there is a pin there does it pay for a capsule. The desktop also checks
   the slots either side, so a pin's round head is never clipped at a slot
   boundary; on a phone that boundary is under a pixel wide. */
float sdPins(vec3 q){
  float kf = clamp(floor((q.x + 0.55) / 0.1 + 0.5), 0.0, 11.0);
  int   k  = int(kf);
  float px = q.x - (-0.55 + kf * 0.1);
  float sl = TAU / 16.0;
  float psi = atan(-q.y, q.z);                 // 0 at the front, + below
  float jc = floor((psi + gRot) / sl + 0.5);   // pin j sits at j*sl - rot
  int   n  = uTier > 0.75 ? 1 : 0;
  float d  = 1e3;
  for (int o = -1; o <= 1; o++){
    if (o < -n || o > n) continue;
    float j  = jc + float(o);
    int   ji = int(mod(j, 16.0) + 0.5) & 15;
    if (((SLOT[ji] >> k) & 1) == 0) continue;
    float th = j * sl - gRot;
    vec2  dir = vec2(cos(th), -sin(th));       // (z, y)
    vec2  zy = vec2(q.z, q.y);
    // From just inside the surface, so the pin grows out of the brass.
    float t  = clamp(dot(zy, dir), 0.17, RAD + 0.045);
    d = min(d, length(vec3(px, zy - dir * t)) - 0.022);
  }
  return d;
}

float sdDrum(vec3 p){
  vec3 q = p - CYL;
  // Bound: a capped cylinder of R + 0.07 round the body and every pin.
  float b = sdCylX(q, RAD + 0.07, 0.64);
  if (b > 30.0 * EPS) return b;
  return min(sdDrumBody(q), sdPins(q));
}

/* The arbor and the two bridges that carry it, standing on the plate. */
float sdFrame(vec3 p){
  vec3 q = p - CYL;
  float d = sdCylX(q, 0.02, 0.73);
  vec3 b = vec3(abs(q.x) - 0.70, p.y - 0.24, q.z);
  return min(d, sdRBox(b, vec3(0.03, 0.18, 0.05), 0.006));
}

/* ---- the comb ----
   The base block, cut on the diagonal at the front; one tooth, repeated
   twelve times in x, rising in a straight line from the base's top to the
   pin circle; three screw heads. The tooth is a box in its own (along,
   across) frame, and the pluck is a warp of that frame: the across
   coordinate is shifted by lift * h^2, h running 0 at the root to 1 at
   the tip — a cantilever's shape, so the root never moves and the tip
   moves the whole distance. */
float sdComb(vec3 p){
  float b = sdBox(p - vec3(0.05, 0.17, 0.29), vec3(0.69, 0.13, 0.24));
  if (b > 30.0 * EPS) return b;
  float lx = p.x - 0.05;
  float d = sdRBox(p - vec3(0.05, 0.12, 0.36), vec3(0.66, 0.045, 0.14), 0.006);
  d = max(d, (ZF0 + ZFK * lx - p.z) * 0.99200);
  float kf = clamp(floor((lx + 0.55) / 0.1 + 0.5), 0.0, 11.0);
  int   k  = int(kf);
  float xk = -0.55 + kf * 0.1;
  float qx = lx - xk;
  // Rooted two hundredths inside the base, so the join is solid.
  vec2  root = vec2(ZF0 + ZFK * xk + 0.02, 0.156);
  vec2  v  = TIP - root;
  float L  = length(v);
  vec2  u  = v / L;
  vec2  nr = vec2(u.y, -u.x);                  // the tooth's own "up"
  vec2  w  = vec2(p.z, p.y) - root;
  float al = dot(w, u);
  float h  = clamp(al / L, 0.0, 1.0);
  float pe = dot(w, nr) - gOff[k] * h * h;
  vec3  e  = vec3(abs(qx) - 0.031, abs(pe) - 0.009, abs(al - L * 0.5) - L * 0.5);
  float tooth = length(max(e, 0.0)) + min(max(e.x, max(e.y, e.z)), 0.0) - 0.004;
  float sx = lx - clamp(floor(lx / 0.5 + 0.5), -1.0, 1.0) * 0.5;
  float screw = sdCylY(vec3(sx, p.y - 0.168, p.z - 0.445), 0.026, 0.006) - 0.004;
  return min(min(d, tooth), screw);
}

/* ---- the governor: a two-bladed air brake on a vertical staff behind
   the right bridge. Desktop only — its blades are a pixel thick on a
   phone and it is the one part the picture does not need. ---- */
float sdGov(vec3 p){
  vec3 q = p - vec3(0.75, 0.0, -0.29);
  float b = sdBox(q - vec3(0.0, 0.30, 0.0), vec3(0.12, 0.25, 0.12));
  if (b > 30.0 * EPS) return b;
  float d = max(length(q.xz) - 0.010, abs(q.y - 0.30) - 0.24);
  vec2 r = vec2(q.x * gCF - q.z * gSF, q.x * gSF + q.z * gCF);
  return min(d, sdBox(vec3(r.x, q.y - 0.47, r.y), vec3(0.10, 0.04, 0.005)));
}

float map(vec3 p){
  float d = sdBed(p);
  d = min(d, sdDrum(p));
  d = min(d, sdComb(p));
  d = min(d, sdFrame(p));
  if (uTier > 0.75) d = min(d, sdGov(p));
  return d;
}

/* What the table's shadow ray sees: the same movement without its pins
   and its governor. Sixteen steps cannot resolve a blade five thousandths
   thick; they stair-step round it and draw the stairs on the table. */
float mapShadow(vec3 p){
  vec3 q = p - CYL;
  float d = min(sdBed(p), sdCylX(q, 0.215, 0.62));
  d = min(d, sdComb(p));
  return min(d, sdFrame(p));
}

vec3 normalAt(vec3 p){
  vec2 k = vec2(1.0, -1.0) * 0.0012;
  vec3 n = k.xyy * map(p + k.xyy) + k.yyx * map(p + k.yyx)
         + k.yxy * map(p + k.yxy) + k.xxx * map(p + k.xxx);
  float l = length(n);
  return l > 1e-6 ? n / l : vec3(0.0, 1.0, 0.0);
}

/* ---- what the metal sees ----
   A photographer's set, not the band's wall. r is unit (reflect of two
   unit vectors), so nothing here normalizes.
     the floor     black straight down, the pale table's grey toward the
                   horizon — vertical steel faces look at the table;
     the sweep     a dark band just above the horizon (the black flag
                   that gives a cylinder its contrast) rising to white;
     the key       warm, with a broad lobe and a crisp core, so the
                   cylinder carries one bright streak along its length;
     the fill      cool, low, opposite;
     the softbox   behind and above, so flat tops seen from the front —
                   teeth, pins, the comb's base — are bright. */
vec3 studio(vec3 r){
  vec3 c = mix(vec3(0.34), vec3(1.0), smoothstep(0.02, 0.72, r.y));
  vec3 fl = mix(vec3(0.07, 0.065, 0.08), vec3(0.50, 0.49, 0.52), smoothstep(-0.85, -0.06, r.y));
  c = mix(fl, c, smoothstep(-0.06, 0.10, r.y));
  float kd = max(dot(r, KEY), 0.0);
  c += vec3(1.0, 0.92, 0.80) * pow(kd, 24.0) * 1.6;
  c += vec3(1.0, 0.96, 0.90) * smoothstep(0.985, 0.996, kd) * 2.2;
  c += vec3(0.78, 0.84, 1.0) * pow(max(dot(r, FILLD), 0.0), 10.0) * 0.5;
  c += vec3(1.0, 0.98, 0.95) * smoothstep(0.72, 0.9, dot(r, BACKD)) * 0.9;
  return c;
}

/* ---- the cylinder's shadow, without a ray ----
   A point is in the cylinder's shadow when the ray from it toward the key
   passes within the flange radius of the axis, above the point, and
   between the flanges. That is the distance between two lines — one dot
   product — so every tier gets it, on the table and on the bedplate and
   the comb alike, and the penumbra opens with the distance to the
   caster. The cylinder's own surface never asks: the key is behind any
   point on it that faces away, and lambert already said so. */
float drumShadow(vec3 p){
  vec3  a  = p - CYL;
  vec2  k2 = gKeyL.yz;
  float s  = -dot(a.yz, k2) / dot(k2, k2);
  if (s <= 0.0) return 0.0;
  vec3  c  = a + gKeyL * s;
  float pen = 0.008 + 0.07 * s;
  float onX = smoothstep(0.64 + pen, 0.60 - pen, abs(c.x));
  return smoothstep(pen, -pen, length(c.yz) - 0.215) * onX;
}

/* ---- the table's soft shadow: desktop only, sixteen steps ----
   The improved estimate (the previous step's distance bounds where the
   nearest occluder can be), which keeps a sixteen-step ray from drawing
   its own step pattern into the penumbra. */
float rayShadow(vec3 p){
  float res = 1.0, t = 0.015, ph = 1e10;
  for (int i = 0; i < 16; i++){
    float h = mapShadow(p + gKeyL * t);
    float y = h * h / (2.0 * ph);
    float d = sqrt(max(h * h - y * y, 0.0));
    res = min(res, 6.0 * d / max(t - y, 1e-4));
    ph = h;
    t += clamp(h, 0.015, 0.1);
    if (res < 0.02 || t > 1.2) break;
  }
  res = clamp(res, 0.0, 1.0);
  return res * res * (3.0 - 2.0 * res);
}

void main(){
  vec2  s0   = (2.0 * gl_FragCoord.xy - uRes) / uRes.y;
  float asp  = uRes.x / uRes.y;
  float wide = smoothstep(1.25, 2.3, asp);
  float e    = smoothstep(0.0, 1.0, uEnter);

  /* ---------------- the clock ----------------
     One revolution in twelve seconds. The phase is set so that at
     uTime 2 — the one frame reduced motion draws — the pin on slot 7 is
     halfway up track 7's tooth: the still picture has a pluck in it. */
  float c = fract(uTime / LOOP + 0.188);
  gRot = TAU * c;
  float fa = uTime * 12.0;
  gCF = cos(fa); gSF = sin(fa);
  gKeyL = toLocal(KEY);

  /* ---------------- the camera ----------------
     Twenty-two degrees up (0.38397 rad), a sway on one sine of the loop so
     it closes on itself, and a pointer lean small enough never to turn
     the comb away from the reader. */
  float yaw = 0.035 * sin(TAU * c) + (uPointer.x - 0.5) * 0.055;
  float el  = 0.38397 + (uPointer.y - 0.5) * 0.04;
  vec3  ta  = vec3(0.05, 0.24, 0.02);
  float D   = 2.35;
  vec3  ro  = ta + D * vec3(sin(yaw) * cos(el), sin(el), cos(yaw) * cos(el));
  vec3  ww  = normalize(ta - ro);
  vec3  uu  = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
  vec3  vv  = cross(uu, ww);
  /* The focal length is solved against the band's HEIGHT, the one
     dimension that does not change with the aspect, and against the
     kicker, which covers more of a short band than a long one. The band
     comes in three aspects only — 0.8, 1.6, 2.33 — so wide is placed on
     them: 0 on the 4:5 phone band, about a quarter on 16:10, 1 on 21:9.
     4:5 and 16:10 cannot move the object out of the kicker's way (the
     text runs most of the width), so they draw it smaller and lift it
     above the text; only 21:9 has the room to move it right instead.
     The header comment has the measured top and the clearances. */
  float f   = mix(1.07, 2.25, wide);
  vec2  s   = vec2(s0.x - wide * 0.62, s0.y - mix(0.282, 0.08, wide));
  vec3  rd  = normalize(s.x * uu + s.y * vv + f * ww);
  // One pixel, in world units per unit of distance along the ray.
  float pxk = 2.0 / (f * uRes.y);

  /* ---------------- the room ----------------
     Paper haze behind, on the house palette, with a breath of its violet
     grey toward the horizon so the far table recedes rather than ends. */
  vec3 bg = mix(uColors[3], uColors[2], smoothstep(-0.2, 1.0, rd.y * 3.0));
  bg = mix(bg, uColors[1], 0.08 * smoothstep(0.3, -0.05, rd.y));

  vec3 rol = toLocal(ro);
  vec3 rdl = toLocal(rd);

  /* ---------------- the bound, and the pluck ----------------
     The assembly's bounding sphere is intersected ANALYTICALLY; a ray
     that misses it never calls map(). The teeth are zeroed first because
     the table's shadow ray reads them too, and an uninitialised global is
     undefined in GLSL. */
  for (int k = 0; k < 12; k++) gOff[k] = 0.0;
  vec3  oc  = rol - vec3(0.0, 0.26, 0.02);
  float bb  = dot(oc, rdl);
  float disc = bb * bb - (dot(oc, oc) - 1.08 * 1.08);
  if (disc > 0.0){
    /* For each tooth: the pin nearest AHEAD of its tip (still coming up)
       and the pin nearest BEHIND it (just slipped past). The first lifts
       the tip over the last 0.14 rad of approach; the second rings it,
       dt seconds after release, from the height it was left at. */
    float sl = TAU / 16.0;
    for (int k = 0; k < 12; k++){
      float ahead = 9.0, past = 9.0;
      for (int j = 0; j < 16; j++){
        if (((SLOT[j] >> k) & 1) == 0) continue;
        float a = mod(float(j) * sl - gRot - THC, TAU);
        ahead = min(ahead, a);
        past  = min(past, TAU - a);
      }
      float dt = past / (TAU / LOOP);
      float off = 0.026 * smoothstep(0.14, 0.0, ahead);
      off += 0.026 * exp(-dt / 0.4) * cos(TAU * 9.0 * dt) * smoothstep(1.2, 0.9, dt);
      gOff[k] = off;
    }
  }

  /* ---------------- the table, found rather than marched ---------------- */
  float tP = rdl.y < -0.002 ? -rol.y / rdl.y : -1.0;
  vec3 col = bg;
  if (tP > 0.0){
    vec3 pp = rol + rdl * tP;
    /* The shadow side is violet, never black: the table's own colour
       taken toward the house violet-grey and the ink. */
    vec3 shadeC = mix(uColors[2], mix(uColors[1], uInk, 0.28), 0.35);
    /* Contact: the light the bedplate keeps off the table right at its
       edges, falling off with the distance from the footprint. A tight
       tap on every tier, a broad one from the tablet up. */
    vec2 dq = abs(pp.xz - vec2(0.0, 0.05)) - vec2(0.92, 0.47);
    float dE = length(max(dq, 0.0)) + min(max(dq.x, dq.y), 0.0);
    float ao = 0.55 * exp(-max(dE, 0.0) * 40.0);
    if (uTier > 0.25) ao = max(ao, 0.30 * exp(-max(dE, 0.0) * 9.0));
    float sh = drumShadow(pp);
    if (uTier > 0.75) sh = max(sh, 1.0 - rayShadow(pp + vec3(0.0, 0.002, 0.0)));
    vec3 table = uColors[2];
    table = mix(table, shadeC, clamp(sh * 0.9, 0.0, 1.0));
    table = mix(table, mix(uColors[2], mix(uColors[1], uInk, 0.28), 0.6), clamp(ao, 0.0, 1.0));
    // Air: the table dissolves into the haze rather than meeting it.
    float fog = 1.0 - exp(-max(tP - 2.4, 0.0) * 0.45);
    col = mix(table, bg, fog);
  }
  vec3 behind = col;

  /* ---------------- one march ---------------- */
  if (disc > 0.0){
    float sq = sqrt(disc);
    float t0 = max(-bb - sq, 0.05);
    float tEnd = min(min(-bb + sq, FAR), tP > 0.0 ? tP : FAR);

    int   steps = uTier > 0.75 ? 48 : uTier > 0.25 ? 36 : 24;
    float t = t0, near = 1e9, nt = t0;
    for (int i = 0; i < 48; i++){
      if (i >= steps) break;
      float h = map(rol + rdl * t);
      float rel = h / max(t * pxk, 1e-6);
      if (rel < near){ near = rel; nt = t; }
      /* A hit is under EPS AND under a third of a pixel. EPS alone was a
         whole pixel at 1440, so hits stopped at up to a pixel out and the
         coverage below faded real surfaces into the table in contour
         lines — zebra stripes over every flat face. */
      if (h < EPS * t && rel < 0.3) break;
      t += h * 0.9;
      if (t > tEnd) break;
    }
    /* The closest approach, in pixels, is the edge antialiasing: a ray
       that missed by half a pixel is shaded where it came nearest and
       blended by how near it came. */
    float cover = smoothstep(1.15, 0.45, near);
    if (cover > 0.003){
      vec3 pos = rol + rdl * nt;
      vec3 nor = normalAt(pos);
      vec3 q = pos - CYL;
      // Which part it is, decided once, at the surface.
      float dBed = sdBed(pos), dBody = sdDrumBody(q), dPin = sdPins(q);
      float dComb = sdComb(pos), dFr = sdFrame(pos);
      float dGov = uTier > 0.75 ? sdGov(pos) : 1e3;
      float dSteel = min(min(dPin, dComb), min(dFr, dGov));
      bool brass = min(dBed, dBody) < dSteel;
      bool onDrum = dBody < min(dBed, dSteel);
      bool onBed = dBed < min(dBody, dSteel);

      float occ = clamp(map(pos + nor * 0.04) / 0.04, 0.0, 1.0);
      if (uTier > 0.25) occ = 0.5 * occ + 0.5 * clamp(map(pos + nor * 0.12) / 0.12, 0.0, 1.0);
      occ = mix(occ, 1.0, 0.45);

      vec3 nw = toWorld(nor);
      vec3 rw = reflect(rd, nw);
      vec3 env;
      if (onDrum && uTier > 0.75){
        /* Brushed round the circumference: two looks either side of the
           reflection along the turning direction. The bias keeps the
           tangent finite on a flange face, where the cross is zero. */
        vec3 tg = toWorld(normalize(cross(vec3(1.0, 0.0, 0.0), nor) + 1e-5));
        env = 0.5 * (studio(normalize(rw + tg * 0.08)) + studio(normalize(rw - tg * 0.08)));
      } else {
        env = studio(rw);
      }
      float sh = onDrum ? 0.0 : drumShadow(pos);
      vec3 F0 = brass ? BRASS : STEEL;
      if (onBed){
        // Satin, not mirror: a flat plate of mirror brass is a flat colour.
        F0 *= 0.82;
        if (nor.y > 0.5){
          /* The comb keeps the light off the plate under its teeth, so the
             gaps between them read as gaps — bright brass between the
             teeth was what made the comb a grate. */
          float lx = pos.x - 0.05;
          float zf = ZF0 + ZFK * lx;
          float under = smoothstep(0.66, 0.60, abs(lx)) * smoothstep(TIP.x - 0.03, TIP.x + 0.03, pos.z)
                      * smoothstep(zf + 0.02, zf - 0.02, pos.z);
          occ *= 1.0 - 0.62 * under;
        }
      }
      // Schlick, toward white at the grazing edge.
      float fre = pow(1.0 - clamp(dot(nw, -rd), 0.0, 1.0), 5.0);
      vec3 F = F0 + (1.0 - F0) * fre;
      /* Mostly what it reflects, over a little of its own colour under the
         key — without that floor a face turned from every light in the
         studio is a hole. */
      float dif = max(dot(nw, KEY), 0.0);
      vec3 cm = mix(F0 * (0.22 + 0.78 * dif) * 0.85, env * F, onBed ? 0.5 : brass ? 0.72 : 0.8);
      vec3 hw = normalize(KEY - rd);
      float sp = pow(max(dot(nw, hw), 0.0), brass ? 90.0 : 160.0);
      cm *= mix(1.0, 0.5, sh);
      cm *= occ;
      cm += (brass ? vec3(1.0, 0.9, 0.7) : vec3(1.0)) * sp * 1.4 * (1.0 - sh);
      col = mix(behind, cm, cover);
    }
  }

  // The reveal: the haze first, the table and the movement into it.
  col = mix(bg, col, e);
  // A little tooth, so the long wash into white never bands.
  col += (hash(gl_FragCoord.xy + fract(uTime) * 57.0) - 0.5) * 0.016;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

/* The poster below was measured against the shader's 4:5 frame as it was
   first drawn — focal length 1.55, lifted 0.08 — and the frame has since
   been pulled back and lifted to clear the kicker (see main()). Only the
   focal length and the lift changed, and that is an exact similarity of
   the picture: a zoom about the frame's centre and a vertical shift. So
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

export const scene: Scene = {
  frag,
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
