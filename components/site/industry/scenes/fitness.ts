import type { Scene } from "../shader-stage";

/* ------------------------------------------------------------------ *
 * Gyms & studios — the dumbbell, lifted on a count.
 *
 * This is the only trade on the site whose phone rings inside a building
 * that is open, occupied and staffed by nobody: nine on a Sunday, lights
 * on, music playing, eleven members training, the desk empty. And every
 * call into it has an expiry on it — the 6.15 starts at 6.15, the
 * late-cancel window shuts six hours out, the notice period runs from the
 * minute it was asked for. Ring back at 6.40 and you are not late, you
 * are irrelevant. The page's argument is a CLOCK, so the band is a beat.
 *
 * Three earlier versions died here. Two were a count kept with concentric
 * rings — a field, not a picture. The third was a flat-drawn barbell:
 * better, but still a painting of a bar rather than a bar in a room, and
 * the note back was blunt — real depth, real materials, real colour.
 *
 * So this one is BUILT and the band is a window on it.
 *
 *   the object   a fixed cast-iron dumbbell: two round heads on a
 *                knurled steel grip, sat on rubber gym matting. Not a
 *                decorative stand-in — it is what is on the floor at nine
 *                on a Sunday while the phone rings at the empty desk.
 *
 *   the motion   it IS LIFTED, on a strict six-beat count at 86 to the
 *                minute, and the count is the whole point. One beat up.
 *                A beat and a half held at the top. Two and a half beats
 *                down, under control — the descent is deliberately two
 *                and a half times slower than the pull, because that
 *                asymmetry is what a count looks like from outside. One
 *                beat resting on the mat, and again. Nothing about the
 *                timing drifts; nothing about it is random.
 *
 *                Two ticks inside the beat make it audible to the eye:
 *                the iron rings at lockout — a damped rock about the grip
 *                and a hair of overshoot — and the mat takes it at
 *                touchdown, the rubber compressing a few millimetres and
 *                giving it back. Between them the dumbbell tips slightly
 *                nose-up through the drive and nose-down as it is lowered,
 *                the way a weight held in one hand actually behaves.
 *
 *   the camera   low and close, all but level with the mat, so the lift
 *                comes up past the reader rather than across in front of
 *                them. It drifts a few degrees on a single cosine over
 *                the cycle, so the loop has no seam, and the pointer
 *                leans it — but it never takes the beat off the lift.
 *
 * COLOUR, which is the thing that changed. The room is the site's: the
 * wall behind, the pool of light on it, the haze, the shadow tint and the
 * upper half of everything the metal reflects all come out of uColors and
 * uInk, which is what keeps sixteen bands reading as one website. The
 * OBJECT is its own, written as literals, and there are three of them
 * because a dumbbell on a mat has exactly three:
 *
 *     IRON   #0c0d0e  black enamel over cast iron. Almost no albedo; it
 *                     is legible because of what it reflects, not because
 *                     of what it is, which is true of every painted
 *                     casting — so it is lit to its own albedo and never
 *                     ramped to white, or it stops being black.
 *     STEEL  #8f939b  the knurled grip. The one bright thing in the frame
 *                     and the reason a black mass reads as a dumbbell.
 *     RUBBER #3b344d  the matting, with #8f85a8 flecks — EPDM crumb, the
 *                     speckle that is on the floor of every gym in the
 *                     country, and it is sold in colours. This one is the
 *                     room's: a violet-charcoal with a paler violet fleck.
 *
 * That last one is the entry that changed, and both of this round's faults
 * were the same entry. Black enamel on near-black rubber under a wall washed
 * three quarters of the way to white was the one picture in sixteen with no
 * colour in it at all — and it was also a black object on a black floor,
 * which is to say an object with nowhere for a contact shadow to land: the
 * mark was being drawn, at a fifth of a per cent of the frame and against a
 * mat too dark to show it. Lifting the mat two stops and giving it the
 * room's violet is what makes the shadow underneath it a shadow.
 *
 * The iron and the steel did not move. The violet still arrives the way
 * light does: it is the wall, so it is in the sheen along the top of each
 * head, in the grazing sheen of the mat as it runs back to the horizon, in
 * everything the enamel reflects, and in the shadow — and that is what stops
 * a black object on a pale backdrop looking pasted on.
 *
 * WHAT IT COSTS. One distance field, one march per fragment, and it
 * breaks on a hit and on a far plane rather than running to the cap. The
 * march starts at 1.25 rather than at the lens, because the nearest point
 * the object can reach is 1.62 from the camera at any moment of the
 * cycle, and a ray that hits the mat stops the object march at the mat —
 * most of the bottom half of the band never marches at all. The field is
 * guarded by a box bound that is deliberately loose (1.00 x 0.62 x 0.62
 * around a 0.86 x 0.46 x 0.46 object) and never handed back below 0.09,
 * which is sixty times the hit epsilon: a bound returned under the
 * epsilon is a hit, and that is how an earlier scene in this set shipped
 * as a violet ball. The mat is not marched at all — it is one ray/plane
 * intersection, because an infinite plane in a distance field is what
 * turns a grazing ray into forty wasted steps.
 *
 * The march also remembers its closest approach in PIXELS, which is the
 * whole of the edge antialiasing: a ray that missed by half a pixel is
 * shaded where it came nearest and blended in by how near it came.
 *
 * The detail that is not geometry is not marched. The diamond knurl, the
 * casting ring on each head's face, the parting seam round its equator
 * and the crumb in the matting are all resolved once, at the hit point,
 * from local coordinates — and every one of them is faded out by its own
 * PIXEL FOOTPRINT before it can become moire, which is the difference
 * between a knurl and a shimmer on a phone.
 *
 *   uTier 1.0  desktop  48 march steps, one 16-step shadow ray, two
 *                       occlusion taps, two grades of crumb in the mat
 *   uTier 0.5  tablet   36 steps, no shadow ray, two occlusion taps
 *   uTier 0.0  phone    24 steps, no shadow ray, one occlusion tap, one
 *                       grade of crumb
 *
 * The tier buys rays and taps. It never buys the subject: the dumbbell,
 * the knurl, the flecks, the count and the contact shadow are on every
 * device, because a phone that gets a different picture is a bug.
 *
 * THE CONTACT, which of everything on this page is the thing a dumbbell has
 * to have. Of the sixteen subjects on this site this is the one that MUST be
 * on the floor: a bell can be on a desk and a phone can be held, but a weight
 * that is not touching is not a weight. It is made of three marks and none of
 * them costs a ray:
 *
 *   under the mat   the seam, black, along the line where each head meets the
 *                   rubber, opening into a soft skirt that runs out toward
 *                   the lens. Both are written in the WORLD, off the object's
 *                   own position, so the mark is under the iron at every
 *                   moment of the count and widens and lightens as the pull
 *                   takes it up — a black line on the mat, a grey haze at
 *                   lockout. It is tinted by what is left lighting it once
 *                   the ceiling is blocked, which is the violet wall.
 *   on the iron     the rim light dies in the last 20cm above the mat. A
 *                   bright edge running under a head is a line of daylight
 *                   between it and the floor, and it is the single thing that
 *                   makes a render look like a cut-out.
 *   behind it       the mat does not start fading toward the wall until 3.4
 *                   from the lens. The iron touches down at 2.3, so a fade
 *                   that opened at 2.2 laid a pale band across the exact line
 *                   the heads end on — a thing in front of a horizon rather
 *                   than a thing on a floor.
 *
 * The darkest pixel in the frame is the seam, not the enamel. That ordering
 * is the whole of it: a photograph of a weight on a mat has nothing in it
 * darker than where the two meet.
 *
 * FRAMING, which is what killed the last two. The vertical is solved
 * against the band's HEIGHT over the WHOLE CYCLE, not at one moment: from
 * the mat at 0 to the top of the head at lockout at 1.37, with the mat
 * line pinned at 0.37 of the band's height at every aspect — clear of the
 * paper the kicker is printed on, which starts at 0.30. The horizontal is
 * solved separately, and on a 4:5 phone band the camera simply PULLS BACK
 * (halfH = max(1.44, 1.24/aspect)) rather than letting the frame crop the
 * heads. Both were solved by SWEEPING the framing against the object's real
 * silhouette — the rim circles, not a bounding box, which reports a crop
 * that does not exist — at seventy-two points of the cycle and at the four
 * corners of the pointer's range. The margins that came out, as a share of
 * the band's half-height: 0.11 at the top on a wide band and 0.20 on a
 * phone, 0.08 at the foot, 0.13 at the sides. Nothing is cropped at any
 * aspect from 4:5 to 32:9, at any moment, wherever the pointer is. On a 21:9 band the object moves right of
 * centre so the kicker has the open left and the lift has a room to be
 * in. At no width and no moment of the loop does anything leave the band.
 * ------------------------------------------------------------------ */

const frag = `
#define FAR 7.0

/* ---- the object's real materials. Three, and no more: a photograph of a
   cast-iron dumbbell on gym matting is a photograph of three things. ---- */
const vec3 IRON   = vec3(0.047, 0.050, 0.055);   // black enamel over cast iron
const vec3 STEEL  = vec3(0.560, 0.575, 0.605);   // the knurled grip
const vec3 RUBBER = vec3(0.232, 0.205, 0.300);   // the matting: violet-charcoal EPDM
const vec3 CRUMB  = vec3(0.560, 0.520, 0.660);   // the fleck in it, and it is not grey

/* ---- the animation state, resolved once per fragment and read by the
   field. Globals rather than arguments: map() is called fifty-odd times a
   pixel and none of this changes between calls. ---- */
vec3 gPos;   // the dumbbell's centre, in the world
mat3 gRot;   // world -> the dumbbell's own frame

float hash21(vec2 p){
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

/* ---- primitives. Exact fields: an approximate one overshoots, and an
   overshoot in a march is a hole through the middle of a part. ---- */
float sdBox3(vec3 p, vec3 b){
  vec3 d = abs(p) - b;
  return min(max(d.x, max(d.y, d.z)), 0.0) + length(max(d, 0.0));
}
/* A rounded cylinder about the object's own long axis. Everything solid in
   this file is one of these; rd is always well under r. */
float sdRCylX(vec3 p, float r, float h, float rd){
  vec2 d = vec2(length(p.yz) - r + rd, abs(p.x) - h + rd);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - rd;
}

/* The grip. Half a metre of knurled steel in real money, and it runs a
   little way INTO each collar so the union is watertight — a grip that
   stops at the casting leaves a seam the normal can see. */
float sdGrip(vec3 p){ return sdRCylX(p, 0.078, 0.462, 0.012); }

/* The casting: collar and head, one shape mirrored about the middle. The
   mirror is exact because the dumbbell is symmetric about its own centre
   and everything it does — rising, tipping, ringing — moves both ends
   together, so neither end ever leaves its half. */
float sdIron(vec3 p){
  vec3 q = vec3(abs(p.x), p.y, p.z);
  float d = sdRCylX(q - vec3(0.500, 0.0, 0.0), 0.172, 0.076, 0.026);   // collar
  return min(d, sdRCylX(q - vec3(0.700, 0.0, 0.0), 0.460, 0.160, 0.032)); // head
}

float map(vec3 p){
  vec3 lp = gRot * (p - gPos);
  /* BOUND, not surface. It is deliberately looser than the thing inside
     it — 1.00 x 0.62 against an object that reaches 0.860 x 0.460 — and
     it is only ever returned while it is unmistakably larger than the
     march's own hit threshold, which at this framing is about 0.0015.
     Both halves of that matter. A tight bound culls the geometry it is
     bounding and lets rays tunnel through; a bound handed back under the
     epsilon IS a hit, and renders as the bound. */
  float bb = sdBox3(lp, vec3(1.00, 0.62, 0.62));
  if (bb > 0.09) return bb;
  return min(sdGrip(lp), sdIron(lp));
}

vec3 normalAt(vec3 p){
  vec2 k = vec2(1.0, -1.0) * 0.0015;
  vec3 g = k.xyy * map(p + k.xyy) + k.yyx * map(p + k.yyx)
         + k.yxy * map(p + k.yxy) + k.xxx * map(p + k.xxx);
  // Never normalize something that can be zero.
  return g / max(length(g), 1e-6);
}

/* One short ray at the key light, sixteen steps, breaking on contact and
   on its own far plane. It is the first thing uTier takes off. */
float shadowRay(vec3 p, vec3 l){
  float s = 1.0, t = 0.030;
  for (int i = 0; i < 16; i++){
    float h = map(p + l * t);
    if (h < 0.0018) return 0.0;
    s = min(s, 8.5 * h / t);
    t += clamp(h, 0.030, 0.40);
    if (t > 3.0) break;
  }
  return clamp(s, 0.0, 1.0);
}

/* The room, as a reflection. Metal is mostly what it reflects, and this
   room is a dark rubber floor under a lit violet-white wall — which is
   one smoothstep on the reflected ray's height, plus the strip light
   overhead. The lower half is the MAT'S OWN colour and not a tone of the
   palette: an object standing on black rubber has black rubber in the
   underside of everything it owns, and putting violet there is exactly
   how a render starts looking like a sticker. */
vec3 envAt(vec3 r){
  vec3 lo  = mix(RUBBER * 1.15, mix(uColors[1], uInk, 0.55), 0.34);
  // Between the floor and the lit sweep is the WALL, and the wall is violet.
  // Leaving that band as a straight ramp from rubber to white is what made
  // every reflection on this object a greyscale one.
  vec3 mid = mix(uColors[1], uColors[2], 0.42);
  vec3 hi  = mix(uColors[2], uColors[3], 0.62);
  vec3 e   = mix(lo, mid, smoothstep(-0.34, 0.02, r.y));
  e        = mix(e, hi, smoothstep(0.04, 0.46, r.y));
  float st = (r.y - 0.60) / 0.17;
  return mix(e, uColors[3], exp(-st * st) * 0.85);
}

void main(){
  vec2  s0   = (2.0 * gl_FragCoord.xy - uRes) / uRes.y;
  float asp  = uRes.x / uRes.y;
  float wide = smoothstep(0.95, 2.00, asp);
  float e    = smoothstep(0.0, 1.0, uEnter);
  float gy   = gl_FragCoord.y / uRes.y;

  /* ---------------- the count ----------------
     Six beats at 86 to the minute, and it does not drift.

        beat 0 -> 1     the pull
        beat 1 -> 2.5   held at the top
        beat 2.5 -> 5   lowered, under control
        beat 5 -> 6     down on the mat

     The descent is two and a half times the pull, on purpose: that ratio
     is the only part of a count that survives being looked at without a
     metronome, and it is the whole reason this reads as a rep rather than
     as a thing bobbing. */
  float B  = 0.70;
  float T  = B * 6.0;
  float ph = fract(uTime / T);
  float bt = ph * 6.0;

  float u  = clamp(bt, 0.0, 1.0);
  float up = u * u * (3.0 - 2.0 * u);                  // off the mat, into lockout
  float v  = clamp((bt - 2.5) / 2.5, 0.0, 1.0);
  // Half smooth, half linear. A pure smoothstep descent floats; a lift
  // lowered under control leaves the top on the beat and then travels at a
  // steady rate, which is what the mixed curve is.
  float dn = mix(v, v * v * (3.0 - 2.0 * v), 0.45);
  float h  = up * (1.0 - dn);

  /* The two ticks inside the beat. Both are damped sines started at an
     exact beat, so both are numerically dead long before the loop wraps —
     at bt = 6 the lockout ring has decayed by e^-31 and the landing by
     e^-9, and both read exactly zero at bt = 0. That is the loop seam,
     checked rather than hoped for. */
  float tl   = max(bt - 1.0, 0.0) * B;
  float ring = exp(-tl * 9.0) * sin(tl * 34.0);        // the iron rings at lockout
  float td   = max(bt - 5.0, 0.0) * B;
  float land = exp(-td * 13.0) * sin(td * 42.0);       // the mat takes it

  const float R0     = 0.460;                          // head radius = resting height
  const float TRAVEL = 0.450;
  float yc = R0 + TRAVEL * h + 0.010 * ring - 0.007 * land;

  /* The tilt. Nose-up through the drive, nose-down as it is lowered, and
     rocking at lockout — a weight in one hand is never level. Both bumps
     are gaussians in the beat, and the drive's is windowed to zero at the
     start of the cycle so the wrap is exact rather than nearly exact. */
  float zl = (bt - 0.45) / 0.30;  float drive = exp(-zl * zl) * smoothstep(0.0, 0.30, bt);
  float zd = (bt - 3.60) / 0.95;  float ease  = exp(-zd * zd) * smoothstep(6.0, 5.4, bt);
  float tilt = 0.058 * drive - 0.034 * ease + 0.050 * ring;

  float ct = cos(tilt), st = sin(tilt);
  // local -> world is a rotation about z; this is its transpose, world -> local.
  gRot = mat3(ct, -st, 0.0,  st, ct, 0.0,  0.0, 0.0, 1.0);
  gPos = vec3(0.0, yc, 0.0);
  vec3 axis = vec3(ct, st, 0.0);                       // the grip's direction in the world

  /* ---------------- the camera ----------------
     Low and close, all but level with the mat, so the lift comes UP past
     the reader. One cosine of drift over the cycle, so the loop closes on
     itself, and the pointer leans it a few degrees either way.

     The vertical framing is solved against the band's height over the
     WHOLE cycle rather than at one moment: the mat at 0 and the top of the
     head at lockout at 1.37 both have to be inside it, and the contact
     line is pinned at 0.37 of the band's height at every aspect so it
     never sinks into the paper the kicker is printed on, which begins at
     0.30. The horizontal is solved separately — on a narrow band the
     camera PULLS BACK rather than cropping the heads. */
  float halfH = max(1.440, 1.24 / max(asp, 0.30));
  float yCen  = 0.260 * halfH;
  float D     = 2.60;
  float drift = cos(6.2831853 * ph);
  float az    = 0.395 + 0.070 * drift + (uPointer.x - 0.5) * 0.22;
  float roY   = 0.300 + 0.050 * (0.5 - 0.5 * drift) + (uPointer.y - 0.5) * 0.08;

  vec3 ro = vec3(sin(az) * D, roY, cos(az) * D);
  vec3 ta = vec3(0.0, yCen, 0.0);
  vec3 ww = normalize(ta - ro);
  vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
  vec3 vv = cross(uu, ww);

  /* Centred on a phone, right of centre on a long band: at 21:9 a centred
     object leaves the kicker stranded under it, and the open left is worth
     more to the page than symmetry is. */
  float xOff = 0.42 * wide;
  vec2  s    = vec2(s0.x - xOff, s0.y);
  vec3  rd   = normalize(s.x * uu + s.y * vv + (D / halfH) * ww);
  // One pixel, in world units per unit of distance travelled. The march
  // converges to a PIXEL rather than to a fixed epsilon, which is what
  // makes the silhouette antialiasing below cost nothing.
  float pxk  = 2.0 * halfH / (D * uRes.y);

  // The gym's ceiling light: up, to the left, a little in front. Anchored
  // in WORLD space, so the highlight travels along the iron as the camera
  // drifts and the dumbbell rises — which is where the sense of a solid
  // turning under a light actually comes from.
  vec3 lig = normalize(vec3(-0.54, 0.78, 0.32));

  /* ---------------- the wall behind it ----------------
     Paper at the foot where the words are, taking violet as it climbs,
     with a pool of light where the work is and a strip light crossing the
     room every eleven seconds. The same lane lights the wall and flares
     off the steel, so the two are one light rather than two effects. */
  vec3 bg = mix(uColors[3], mix(uColors[2], uColors[1], 0.78), smoothstep(0.02, 0.98, gy));
  // The pool of light, and the number that had to come down. At 0.72 it
  // washed three quarters of the wall to white, which is how a violet room
  // ended up the one greyscale picture in the set. It is a pool of light on a
  // violet wall, not a hole cut in it.
  vec2 gp = vec2(s.x * mix(1.00, 0.58, wide), (s.y - 0.24) * 1.08);
  bg = mix(bg, uColors[3], exp(-dot(gp, gp) * 1.05) * 0.46);
  bg = mix(bg, mix(uColors[2], uColors[1], 0.72),
           smoothstep(0.42, 1.75, abs(s0.x) / max(asp, 0.8)) * 0.26);
  /* The strip light's own eleven seconds are NOT the lift's four and a
     fifth, so where it restarts matters: it has to be far enough outside the
     frame at both ends of its sweep that the jump from one edge to the other
     is numerically nothing. On a 4:5 band -0.7 to 1.7 left a 1% glow on the
     right edge that teleported to the left one every eleven seconds; -1.1 to
     2.1 puts it under a thousandth at both. */
  float lane = (gl_FragCoord.x / uRes.y - mix(-1.1, 2.1, fract(uTime / 11.0)) * asp)
             / mix(0.36, 0.64, wide);
  float beam = exp(-lane * lane);
  bg = mix(bg, uColors[3], beam * 0.14);

  /* ---------------- the matting ----------------
     One ray/plane intersection, not a march. An infinite plane in a
     distance field is the classic way to spend forty steps on a grazing
     ray and still miss, and there is nothing a march would buy here. */
  vec3  back = bg;
  float tF   = 1e9;
  if (rd.y < -0.0015) {
    float tf = -ro.y / rd.y;                 // ro.y is always well above zero
    if (tf < 60.0) {
      tF = tf;
      vec3 fp = ro + rd * tf;

      // EPDM crumb: round flecks on a jittered lattice, not a checker —
      // a lattice you can see the grid of is worse than no texture at all.
      vec2  g  = fp.xz * 26.0;
      vec2  gi = floor(g), gf = fract(g);
      vec2  o  = vec2(hash21(gi), hash21(gi + 19.7));
      float fl = smoothstep(0.34, 0.12, length(gf - o)) * step(0.46, hash21(gi + 5.3));
      if (uTier > 0.25) {
        vec2  g2  = fp.xz * 61.0 + 3.7;
        vec2  gi2 = floor(g2), gf2 = fract(g2);
        vec2  o2  = vec2(hash21(gi2 + 41.0), hash21(gi2 + 8.1));
        fl = max(fl, smoothstep(0.30, 0.10, length(gf2 - o2))
                   * step(0.60, hash21(gi2 + 2.9)) * 0.70);
      }
      // Crumb costs nothing once it is smaller than a pixel except moire,
      // so it is faded out by distance before it can become any.
      fl *= 1.0 - smoothstep(1.4, 5.0, tf);
      vec3 mat = mix(RUBBER, CRUMB, fl * 0.72);

      // Lit by the ceiling, which is straight overhead of a flat floor, so
      // the key on it is one number rather than a dot product per pixel — and
      // then the same pool of light the wall is under, which is what gives the
      // mat a centre instead of a flat grey field running edge to edge.
      float pool = exp(-dot(fp.xz, fp.xz) * 0.075);
      vec3 lit = mat * (0.40 + 0.60 * lig.y) * mix(0.56, 1.18, pool);

      /* What the dumbbell keeps off the mat. The two heads are projected
         along the light and given a gaussian each, with the grip's shadow
         as the bar between them — so the shadow is the SHAPE of the thing,
         not a disc under it. It is hard and tight while the iron is down
         and wide and faint at the top of the pull, which is the second
         reading of the count and the one that survives being looked at as
         a still. */
      vec3  hA = gPos + axis * 0.700, hB = gPos - axis * 0.700;
      vec2  sA = (hA - lig * (hA.y / lig.y)).xz;
      vec2  sB = (hB - lig * (hB.y / lig.y)).xz;
      float up01 = clamp((gPos.y - R0) / TRAVEL, 0.0, 1.0);
      float rad  = 0.42 + 0.80 * up01;
      vec2  pa = fp.xz - sB, ba = sA - sB;
      float hh = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-5), 0.0, 1.0);
      float dS = length(pa - ba * hh) / (rad * 0.52);
      float dA = length(fp.xz - sA) / rad;
      float dB = length(fp.xz - sB) / rad;
      float sh = max(exp(-dA * dA) + exp(-dB * dB), exp(-dS * dS) * 0.78);
      sh = clamp(sh, 0.0, 1.0) * (0.66 - 0.30 * up01);

      /* And the contact, which is the whole of whether this is a photograph.
         The key is up, left and IN FRONT, so everything it casts goes AWAY
         from the lens: at a camera this close to the mat the cast shadow
         above is over the horizon and behind the iron, and none of it is the
         mark a viewer reads. The mark they read is the mat's own occlusion
         under the weight, and it has three jobs — be under the object, be
         darkest and tightest exactly where the iron touches, and open out and
         lighten with every millimetre of daylight under it.

         A cylinder on its side touches a floor along a LINE, so this is two
         narrow bands across the mat under the heads rather than a disc:

           core   a few millimetres either side of the touch, where nothing
                  reaches the mat at all. It is the darkest thing in the
                  frame, darker than the enamel, because a contact is.
           skirt  the soft one that runs out in front of it, which is the
                  wall's light being blocked at a shallower and shallower
                  angle as the mat leaves the iron.

         Both widen and fade with gap, the daylight under the weight, which
         is why the mark opens as the pull takes it up and shuts as it lands:
         at the top of the rep it is a wide grey haze, on the mat it is a
         black line. The old version faded to nothing 20cm up and was a fixed
         30cm gaussian on the way — eight pixels at this camera, on a mat too
         dark to show them. */
      float gap  = max(gPos.y - R0, 0.0);
      float ex   = 0.84 + 0.40 * gap;                       // how far it reaches in x
      float edge = smoothstep(ex + 0.22, ex, abs(fp.x));
      float head = smoothstep(0.40, 0.58, abs(fp.x));       // only the heads touch
      float zp   = fp.z / (0.78 + 1.30 * gap);
      float zc   = fp.z / (0.12 + 0.85 * gap);
      float skirt = edge * (0.40 + 0.60 * head) * exp(-zp * zp) * 0.66 / (1.0 + gap * 2.8);
      float core  = edge * head * exp(-zc * zc) * 0.95 / (1.0 + gap * 30.0);
      sh = clamp(max(sh, skirt + core), 0.0, 1.0);

      /* A multiply, never a mix toward a colour: a shadow that can end up
         lighter than the surface it is on is how a render gets a violet smear
         under a black object. What is left in it is the room — the violet
         wall, which is the only thing still reaching the mat once the ceiling
         is blocked, and the reason a real shadow on a coloured floor is more
         coloured than the floor around it and never a grey. */
      vec3 amb = mix(uInk, uColors[1], 0.30);
      lit = mix(lit, lit * 0.030 + amb * 0.014, sh);

      // Rubber is matte, but at a grazing angle everything is a mirror, and
      // this is the whole horizon: the mat takes the wall's colour as it
      // runs away, so the floor meets the wall instead of stopping at it.
      // The ceiling itself, broad and soft in a semi-gloss mat. This is what a
      // strip light over rubber actually looks like, and it is also what stops
      // the near mat meeting the kicker's paper as a hard black edge.
      // And it is OCCLUDED, which the first cut of it forgot: a reflection of
      // a ceiling cannot land on the four square inches of mat that cannot see
      // the ceiling. Adding it after the shadow lifted the seam under the iron
      // every time the strip light came past, which is a contact blinking.
      vec3  mh = normalize(lig - rd);
      lit += uColors[3] * pow(clamp(mh.y, 0.0, 1.0), 4.0) * 0.075 * (0.4 + 0.6 * beam)
           * (1.0 - 0.92 * sh);

      /* Where the mat meets the wall, and the one number in this file that
         has to be got right. At a camera this low EVERY floor ray is a
         grazing one — rd.y runs from -0.55 at the foot of the band to 0 at
         the horizon — so a fresnel written as a power of (1 + rd.y) is not a
         grazing term at all: at fourteen degrees below the horizon it still
         reads 0.49. The first cut of this had exactly that, and it washed a
         quarter of a BRIGHT WALL into the mat at every pixel of it, which
         greyed the rubber to the colour of concrete and lifted the shadow
         under the dumbbell to the same value as the floor around it. So the
         blend is distance, which is honest here: it fades into the wall AT
         THAT PIXEL, so it can never overshoot what it is fading into and
         there is nothing for a bright line along the horizon to be.

         The start of that fade is a contact number, not a haze number: the
         iron touches the mat at 2.3 from the lens and the far head at 2.9, so
         a fade opening at 2.2 was already a fifth of the way to the wall
         directly behind the weight — a pale band lying across the exact line
         the heads end on, which is a thing standing in front of the horizon
         rather than a thing on the floor. It opens behind the object now. */
      back = mix(lit, bg, smoothstep(3.4, 13.0, tf));
    }
  }

  vec3 col = back;

  /* ---------------- one march ----------------
     It starts at 1.25 because the nearest the object can be to the lens at
     any moment of the cycle is 1.62, and it stops at the mat where the mat
     is nearer — so most of the bottom half of the band never marches. It
     also remembers its own closest approach, measured in PIXELS: a ray
     that missed by half a pixel is shaded at the point where it came
     nearest and blended in by how near that was, so the silhouette of a
     round head is soft without a second sample anywhere. */
  int   steps = uTier > 0.75 ? 48 : uTier > 0.25 ? 36 : 24;
  float farO  = min(FAR, tF);
  float t = 1.25;
  float near = 1e9, nt = 1.25;
  for (int i = 0; i < 48; i++){
    if (i >= steps) break;
    float d = map(ro + rd * t);
    float rel = d / max(t * pxk, 1e-6);
    if (rel < near) { near = rel; nt = t; }
    if (rel < 0.35) break;
    t += d * 0.92;
    if (t > farO) break;
  }
  float cover = smoothstep(1.40, 0.42, near);

  if (cover > 0.002) {
    vec3 pos = ro + rd * nt;
    vec3 nor = normalAt(pos);
    vec3 lp  = gRot * (pos - gPos);
    vec3 nl  = gRot * nor;

    /* Which part was hit. One evaluation of each field, once, at the
       surface — never inside the loop. */
    float dG = sdGrip(lp), dI = sdIron(lp);

    // How many pixels across one period of the finest mark on this
    // surface. Every mark below is faded out by it before it can alias,
    // which is the difference between a knurl and a shimmer on a phone.
    float px = max(nt * pxk, 1e-6);

    vec3  base;
    float shin, spAmt, mtl, ltAmt, frAmt, sparkle = 0.0;

    if (dG < dI) {
      /* ---- the grip: knurled steel, and the only bright thing here ----
         The knurl is a diamond, which is two crossed helices, which is two
         triangle waves multiplied — the product is the raised point and the
         zeros are the crossed grooves. It is resolved from the grip's own
         coordinates so it turns with the dumbbell, and it is faded by its
         own pixel footprint and by how square the surface is to the eye,
         so it never survives to the silhouette where it would compress
         into a stripe. */
      base = STEEL;
      float ang = atan(lp.z, lp.y + 1e-6);
      float w1  = abs(fract(lp.x * 30.0 + ang * 2.6) - 0.5) * 2.0;
      float w2  = abs(fract(lp.x * 30.0 - ang * 2.6) - 0.5) * 2.0;
      float peak = clamp(w1 * w2, 0.0, 1.0);

      float kvis = smoothstep(1.7, 3.6, 0.0333 / px)
                 * smoothstep(0.10, 0.42, abs(dot(nor, rd)));
      // Knurled between the collars, with the smooth band every bar has at
      // its exact centre left plain.
      float kOn = smoothstep(0.440, 0.414, abs(lp.x)) * smoothstep(0.018, 0.044, abs(lp.x));
      kOn *= kvis;

      base = mix(base, base * 0.26, (1.0 - peak) * kOn * 0.80);
      sparkle = peak * kOn;
      // A little turning finish on the plain stretches, along the axis.
      base *= 1.0 + (hash21(floor(vec2(lp.x * 260.0, ang * 30.0))) - 0.5)
                    * 0.16 * smoothstep(3.0, 6.0, 0.0333 / px);
      shin = 68.0; spAmt = 1.00; mtl = 0.70; ltAmt = 0.55; frAmt = 0.26;
    } else {
      /* ---- the casting: black enamel over cast iron ----
         It has almost no albedo. Everything that makes it legible is what
         it reflects — which is the point of painting it, and the reason it
         must not be lit from its own dark to near-white. A ramp that ends
         at white turns a black casting into a grey one and takes every
         mark on it with it. */
      base = IRON;
      float rr   = length(lp.yz);
      float face = abs(nl.x);                    // 1 on a flat face, 0 on the rim
      float fx   = abs(lp.x);
      // Each mark is gated on ITS OWN width, in pixels, not on a number that
      // happened to be typed once: the casting ring is 0.024 across and the
      // parting seam 0.014, and one threshold for both is one of them erased.
      float fWide = smoothstep(1.5, 3.0, 0.024 / px);
      float fThin = smoothstep(1.4, 2.8, 0.014 / px);

      // The raised concentric ring every cast head carries, and the boss
      // where the grip goes through it.
      float rg = smoothstep(0.342, 0.366, rr) * smoothstep(0.412, 0.388, rr);
      base = mix(base, IRON * 2.20, rg * face * fWide * 0.60);
      base = mix(base, IRON * 0.52, smoothstep(0.236, 0.150, rr) * face * 0.55);
      // The chamfer: the narrow ground band where the face turns into the rim.
      // It is found from the NORMAL rather than from a radius, so it follows
      // the fillet exactly at any camera angle.
      base = mix(base, IRON * 3.10,
                 smoothstep(0.18, 0.52, face) * smoothstep(0.92, 0.58, face)
                 * smoothstep(0.404, 0.430, rr) * fWide * 0.55);
      base = mix(base, IRON * 1.70, smoothstep(0.173, 0.205, rr)
                                  * smoothstep(0.236, 0.210, rr) * face * fWide * 0.5);
      // The parting seam round the head's equator, where the two halves of
      // the mould met. One line, and it is what says cast rather than
      // turned.
      base = mix(base, IRON * 2.60,
                 smoothstep(0.014, 0.0, abs(fx - 0.700)) * smoothstep(0.420, 0.454, rr)
                 * fThin * 0.55);
      // Paint is never even. A coarse, low-amplitude wobble — coarse
      // enough to read as a finish rather than as noise.
      base *= 0.93 + 0.14 * hash21(floor(lp.yz * 24.0 + lp.x * 24.0));
      shin = 58.0; spAmt = 1.05; mtl = 0.19; ltAmt = 0.14; frAmt = 0.40;
    }

    /* ---------------- light ----------------
       One key with its own short shadow ray, a bounce off the mat that is
       a SUBTRACTION because the mat is black, two distance taps of
       occlusion, and the room reflected off the reflected ray. Everything
       ramps from each material's own dark to its own albedo; only the very
       top of the range goes toward the light's own colour. */
    float dif = clamp(dot(nor, lig), 0.0, 1.0);
    float sh  = 1.0;
    if (uTier > 0.75 && dif > 0.01) sh = shadowRay(pos + nor * 0.012, lig);

    float occ = clamp(map(pos + nor * 0.060) / 0.060, 0.0, 1.0);
    if (uTier > 0.25) occ = 0.5 * occ + 0.5 * clamp(map(pos + nor * 0.200) / 0.200, 0.0, 1.0);
    occ = mix(occ, 1.0, 0.25);

    float fre = clamp(1.0 + dot(nor, rd), 0.0, 1.0); fre = fre * fre * fre;
    vec3  hal = normalize(lig - rd);                 // lig and rd are never parallel here
    float spc = pow(clamp(dot(nor, hal), 0.0, 1.0), shin);

    float key = dif * mix(0.20, 1.0, sh);
    key = key * key * (3.0 - 2.0 * key);
    // Each material's own dark, carrying a little of the room's violet —
    // which is what an ambient in a violet-lit room actually does, and what
    // stops a black object reading as a hole cut in the page.
    vec3 dark = mix(base * 0.17, uInk * 0.16, 0.26);
    vec3 c = mix(dark, base, key);
    c = mix(c, mix(base, uColors[3], ltAmt), smoothstep(0.62, 1.0, key));
    // The mat, bouncing. It is black rubber, so what comes back off it is
    // less light rather than more — and that is most of what says the
    // dumbbell is ON the floor rather than floating over it.
    float down = clamp(0.25 + 0.75 * dot(nor, vec3(0.18, -1.0, 0.10)), 0.0, 1.0);
    c = mix(c, c * 0.58, down * 0.40);

    // The room, reflected. Anchored in world space while the key is fixed
    // to the light, which is why the sheen crawls along the top of each
    // head as the camera drifts and the lift comes up.
    vec3 eC = envAt(reflect(rd, nor));
    c = mix(c, eC, clamp(mtl * (0.34 + 0.66 * fre), 0.0, 1.0));
    // The enamel's clear coat, and the steel's edge: the one place the
    // wall's violet lands directly on the object.
    c = mix(c, eC, fre * frAmt);

    c *= mix(0.40, 1.0, occ);
    /* And the other half of the contact, which is on the object rather than
       on the mat: nothing gets under a weight that is on the floor. The rim
       light runs all the way round a head, and the last centimetre of it —
       the bit lying on the rubber — is a bright line of daylight between the
       iron and the mat, which is exactly the look of a sticker. It is one
       smoothstep on the surface point's HEIGHT, so it costs nothing, needs no
       ray, and lets go of the object by itself as the pull takes it up: at
       lockout the lowest iron in the frame is 45cm off the mat and this term
       is 1.0 everywhere on it. It stops SHORT of the mark on the mat, though
       — at 0.34 the bottom of a head went blacker than its own contact seam,
       and the darkest pixel in a photograph of a weight on a floor is where
       the two meet, never the weight. */
    c *= mix(0.52, 1.0, smoothstep(0.0, 0.20, pos.y));
    c += uColors[3] * clamp(spc * spAmt * (0.55 + 0.80 * beam), 0.0, 1.0) * mix(0.45, 1.0, sh);
    if (sparkle > 0.0) c += uColors[3] * sparkle * 0.14 * (0.30 + 0.70 * dif);

    col = mix(back, c, cover);
  }

  // The reveal: the room is already there, the light comes up on the work.
  col = mix(bg, col, e);
  // A little tooth, so the long wash into white never bands on a cheap
  // panel — which is the only sort of panel this will be watched on.
  col += (hash21(gl_FragCoord.xy + fract(uTime) * 57.0) - 0.5) * 0.016;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export const scene: Scene = {
  frag,
  colors: ["#551a89", "#7c74a6", "#f4f3f7", "#ffffff"],
  /* The dumbbell at rest on the mat, as far as stacked gradients can carry
     it — and they have to carry it, because this is what a reader on a slow
     phone looks at until the shader has compiled and what a device with no
     WebGL is left with for good. Every radius is in PIXELS off a centre
     placed with calc(), because a percentage radius is measured against
     width and height separately: the same stop that is a head on a 21:9
     band is a tall oval on a 4:5 one. The heads and the grip are the
     shader's own three materials; the wall is the house palette. */
  poster: [
    /* The two cast heads. Radii and spacing in PIXELS off a centre placed
       with calc(), because a percentage radius is measured against width and
       height separately and the same stop that is a round head on a 21:9 band
       is a tall oval on a 4:5 one. Every number here was measured off the
       shader's own frame at 390x488 — the band a phone gets, which is the
       band this poster is actually for: it is what a reader on a slow phone
       looks at until the shader has compiled, and what a device with no WebGL
       is left with for good. The near head carries a little more light than
       the far one, the way it does in the scene. */
    "radial-gradient(circle 72px at calc(50% - 86px) 44%, #181b21 0 52px, #1e222a 56px 64px, #2b303a 67px 69px, #0b0c10 70px 71px, rgb(255 255 255 / 0) 72px)",
    "radial-gradient(circle 72px at calc(50% + 86px) 44%, #1f232a 0 52px, #262a33 56px 64px, #353a46 67px 69px, #0e0f13 70px 71px, rgb(255 255 255 / 0) 72px)",
    // the knurled steel grip between them
    "radial-gradient(90px 6px at 50% 43.6%, #dcdfe5 0 26%, #979ca6 60%, #43464e 88%, rgb(255 255 255 / 0) 100%)",
    /* What it keeps off the mat. A head's centre is at 44% and its radius is
       72px, so the iron meets the rubber at 44% + 72px, and on the 488px band
       this poster is measured for that is 58.8% — which is where the seam
       goes, one under each head and not one wide smear under both. The seam
       is the darkest thing in the picture, as it is in the scene, and then a
       single soft pool in front of the pair of them. */
    "radial-gradient(54px 9px at calc(50% - 86px) 58.9%, rgb(5 4 9 / 0.96) 0 12%, rgb(6 5 11 / 0.62) 42%, rgb(8 6 13 / 0) 100%)",
    "radial-gradient(54px 9px at calc(50% + 86px) 58.9%, rgb(5 4 9 / 0.96) 0 12%, rgb(6 5 11 / 0.62) 42%, rgb(8 6 13 / 0) 100%)",
    "radial-gradient(158px 22px at 50% 60.6%, rgb(9 7 15 / 0.80) 0%, rgb(9 7 15 / 0) 100%)",
    // the matting: violet-charcoal EPDM, running back to a horizon at 58%
    "linear-gradient(to top, #4b4360 0%, #332d44 14%, #3a3449 34%, rgb(58 52 73 / 0.55) 39.5%, rgb(58 52 73 / 0) 42.5%)",
    // the pool of light on the wall the work is under — a pool ON a violet
    // wall, which is the number the shader had to come down on too
    "radial-gradient(70% 48% at 50% 50%, rgb(255 255 255 / 0.46) 0%, rgb(255 255 255 / 0) 100%)",
    // and the wall
    "linear-gradient(to top, #f3f1f8 0%, #e8e5f1 36%, #c9c4de 74%, #a8a3c4 100%)",
  ].join(", "),
  alt: "A black cast-iron dumbbell on violet-charcoal speckled rubber matting, seen from just above floor level: two round heads on a bright knurled steel grip, each head sitting in its own dark contact shadow. It is pulled off the mat on a strict count, held at the top with the iron ringing on the grip, lowered under control over twice as long as the pull, and set back down — then again, while a strip light crosses the wall behind it.",
};
