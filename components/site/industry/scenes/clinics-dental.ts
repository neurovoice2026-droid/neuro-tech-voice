import type { Scene } from "../shader-stage";

/* ------------------------------------------------------------------ *
 * Clinics & dental — the mouth mirror, turning and throwing light.
 *
 *   A dental mouth mirror, close enough to touch. It rolls between an
 *   invisible finger and thumb — which is exactly what a dentist does
 *   with one — and because the head is set at seventy-four degrees to
 *   the shank, rolling the handle swings the face round a cone. It rocks
 *   sixty-two degrees either side of square, out and back each way once
 *   a loop, slowest at the two ends where a hand actually pauses and
 *   quickest through the middle. Along the way the face takes the
 *   operating lamp and throws it across the far wall. Nothing assembles,
 *   nothing falls, nothing tips over. It turns, and it turns back.
 *
 * The rock is centred on the angle at which the face is square to the
 * lens, and that angle is SOLVED rather than typed — one atan of the
 * view direction in the head's own frame — so it follows the layout at
 * every width instead of being tuned for one of them.
 *
 * ---- AND IT IS LYING DOWN, which is this pass -----------------------
 * The note back was four words: the mirror floats with no surface. There
 * was nothing in the frame for it to be on. It is down now — the butt of
 * the handle on the bracket table, the handle across a rolled cotton, the
 * head cantilevered clear of both — and every part of that is solved
 * from the instrument rather than placed by eye: the table's height off
 * the butt, the roll's radius off the tangent to the handle's underside,
 * and both contact shadows off the distance to the instrument's own
 * surface. The full argument, including why a flat fold of towel cannot
 * work at this camera and why the roll runs away from the lens rather
 * than through it, is written at the code.
 *
 * It used to be two full turns, and the full turn is what had to go. A
 * turn puts the disc edge-on twice, and an edge-on mouth mirror is a
 * thin ellipse on a stick rather than a mouth mirror. The window was
 * measured at 12.8 per cent of the loop — and since the three
 * screenshots that decide whether a stranger names this the same thing
 * at 1440, 820 and 390 are taken at three different MOMENTS, a window
 * that size lands in at least one of them about a third of the time. It
 * did, twice out of three. The rock removes the window rather than
 * making it less likely, and the whole argument is written out at the
 * roll itself, together with what it cost to check that the thrown patch
 * survived the change.
 *
 * ---- COLOUR, which is what this pass was for -------------------------
 * The note back on the last cut was one sentence: THE WHOLE PAGE IS
 * PURPLE. It was, and it was this file's own doing in two separate
 * places, both of which are fixed here.
 *
 *   THE BACKDROP went to the DEEP end of the palette — uColors[0] at
 *   ninety-two per cent — so the band sat on saturated violet while every
 *   sibling sat on lavender-to-white. The wall now runs from a light
 *   lavender at the head of the room to paper at its foot, which is where
 *   the rest of the set lives.
 *
 *   AND THE MIRROR SAW THE WALL. This is the one that actually destroyed
 *   the object. A mouth mirror is a FRONT-SURFACE mirror: it has almost
 *   no colour of its own, it is whatever is around it. Point it at a
 *   violet room and it returns violet, so the declared rhodium never
 *   appeared anywhere in the frame and the subject rendered as a flat
 *   violet disc with no image in it. The reflective materials now sample
 *   a NEUTRAL STUDIO — a dark floor, a bright overhead sweep, a warm key
 *   and a cool fill, exactly as a photographer lights an instrument —
 *   while the backdrop behind the object stays the house palette. Chrome
 *   reads as chrome or it reads as plastic; there is no third option.
 *
 * So: the wall, the corner fall, the occlusion tint and the diffuse
 * ambient are uColors and uInk, which is what keeps sixteen bands reading
 * as one website. The studio is neutral, and only the polished surfaces
 * ever see it — and even they take the wall back when they are pointed at
 * it, because that is where the wall is. The INSTRUMENT is its own, and a
 * mouth mirror is a short, honest list:
 *
 *   STEEL   0.552,0.568,0.592   304 surgical stainless at normal
 *                               incidence: neutral, a hair cool, and
 *                               never a violet scaled down.
 *   RHOD    0.770,0.770,0.762   rhodium. A mouth mirror is FRONT
 *                               surface rhodium rather than silvered
 *                               glass, which is why it is brighter and
 *                               cleaner than a bathroom mirror and why
 *                               it has no ghost image. 0.77 is also the
 *                               reason the face reads as a mirror and
 *                               not as a white blob: it is slightly
 *                               DARKER than the room it returns.
 *   LAMPC   0.960,0.978,1.000   the operating light. Dental lamps are
 *                               specified at 5000K — a hair cooler than
 *                               white, and never warm.
 *   SILIC   0.070,0.330,0.318   one narrow silicone ID ring behind the
 *                               ferrule, in the clinical teal every
 *                               practice colour-codes its tray sets
 *                               with. It is the only saturated colour
 *                               on the instrument and it is about two
 *                               per cent of the frame.
 *
 * Metal has no diffuse term. Its colour is what it reflects, tinted by
 * its own reflectance and taken to a mirror at grazing angles — so the
 * steel and the face are both a picture of the studio, and the studio is
 * neutral. The one dielectric on the instrument, the silicone ID ring,
 * takes its ambient from the HOUSE palette instead, because a diffuse
 * surface is lit by the room the site is in. That split is the whole
 * colour law of this file in one line: reflective sees the studio,
 * diffuse and backdrop see the palette.
 *
 * ---- what is actually being computed -------------------------------
 * ONE march per fragment: 48 steps on a desktop, 36 on a tablet, 24 on
 * a phone, and it breaks on a hit and on a far plane. There is no
 * second march — no shadow ray, no bounce ray — because everything else
 * in the frame is analytic, and analytic is both cheaper and sharper:
 *
 *   · the far wall is a plane, so the background is a ray-plane hit;
 *   · the mirror's own reflection is the STUDIO in whatever direction it
 *     is pointed, and only a ray leaving hard toward the back of the room
 *     picks up the wall at all. The face is slightly concave, the way a
 *     magnifying mouth mirror is, so what it returns arrives stretched,
 *     with the studio's horizon curving across it and the operating lamp
 *     in it as a hard white oval;
 *   · the bright patch it throws is the reflected ray hitting the wall.
 *     Centre, size and elongation all fall out of that one vector, so
 *     the sweep is not animated — it is what the geometry does;
 *   · the shaft of light between the two is the line-to-line distance
 *     from the camera ray to that reflected ray;
 *   · and there is NO cast shadow on the wall, which is a deletion rather
 *     than an omission. There used to be one — the instrument's two ends
 *     projected from the lamp, a capsule in wall coordinates — and it is
 *     the thing that rendered as a dark violet blob on a 16:10 band. The
 *     reasoning for taking it out rather than dimming it is written where
 *     it used to be: the lamp is a dish, the wall is thirty units behind
 *     the subject, and at that ratio there is no umbra left to draw.
 *
 * Before the march, the ray is tested against a sphere round the head
 * and a capsule round the handle. Three quarters of the band never
 * enters the loop at all, and the quarter that does starts at the hull
 * rather than at the lens, which is where the step budget comes from.
 * Both hulls are measured against the field inside them rather than
 * guessed, and both are handed back only while they are unmistakably
 * larger than the hit epsilon.
 *
 * ---- depth of field, which is the luxury ----------------------------
 * The focal plane sits on the mirror face and nowhere else. The circle
 * of confusion is the honest thin-lens one, |t - tFoc| / t, and it is
 * spent three ways: the silhouette bleeds outward by it (the march
 * already knows how close it passed — min(d/t) is an angle, and an
 * angle is a screen distance); the surface fades inward near its own
 * silhouette, because a grazing normal means the edge; and contrast
 * drops a little toward the wall behind. All three are DELIBERATELY
 * gentle now. Set on a 21:9 band they were ruinous on a 4:5 one, where
 * the instrument points down its own length rather than lying across the
 * frame: the butt of the handle lost two thirds of its coverage into a
 * wash of wall colour and the object stopped being whole, which is the
 * note this came back with. The far end now SOFTENS and stays. The face
 * is razor sharp at every width, and the entrance racks the focus onto
 * it once.
 *
 * ---- the framing, which killed two of these ------------------------
 * 4:5 and 21:9 are two different pictures. Rather than tune one and
 * pray, the camera fits the object: the head's bounding sphere and the
 * butt of the handle are projected at unit focal length, the box is
 * measured, and the focal length and lens shift are solved so the box
 * lands inside 0.425 of the band height — the strip between the paper
 * the harness cuts at the bottom and the site header floating over the
 * top — with the blur allowance already subtracted. Then the instrument
 * itself turns into the screen as the band narrows: nearly across the
 * frame at 21:9, nearly down the barrel at 4:5, which is how a fifteen
 * centimetre object earns a portrait band. Whole, named and inside the
 * frame at every width, by construction rather than by luck.
 *
 * The lamp moves with the band too. Where it stands decides where the
 * reflection lands, and a position that swept the middle of a 21:9 band
 * threw the patch clean off a 4:5 one — so it is interpolated between
 * two places that were measured, one per end, rather than chosen.
 *
 * ---- cost -----------------------------------------------------------
 * One march — 48 / 36 / 24 steps by tier — broken on a hit and on a far
 * plane and started at the hull rather than at the lens. Off the march,
 * and only on a fragment that hit: four distance taps for the normal,
 * one for occlusion (two on a desktop), one lookup of the studio for the
 * reflection, and one more for the mirror face. Everything else — the
 * wall, the patch, the shaft — is closed form.
 *
 * What the tier buys back is RAYS AND GEOMETRY, never the subject. The
 * phone loses a step budget and the second occlusion tap and the turning
 * marks on the back of the head; it keeps the instrument, the materials,
 * the rock, the thrown patch and the shaft of light, because those are
 * the picture. A tablet is not a small desktop — it has a desktop's
 * pixel count and a phone's power budget — so it sits on its own rung at
 * 36 steps rather than being handed either of the other two.
 * ------------------------------------------------------------------ */

const frag = `
#define PI 3.141592653589793

/* ---- the instrument's own materials ---------------------------------
   Reflectances, not paint. Everything else in the frame comes out of
   uColors and uInk, which are the site's. */
const vec3 STEEL = vec3(0.552, 0.568, 0.592);   // 304 surgical stainless
const vec3 RHOD  = vec3(0.770, 0.770, 0.762);   // the front-surface face
const vec3 LAMPC = vec3(0.960, 0.978, 1.000);   // the operating light, 5000K
const vec3 SILIC = vec3(0.070, 0.330, 0.318);   // the silicone ID ring

/* ---- the studio the polished surfaces stand in ----------------------
   NOT the wall, and this is the distinction the last cut did not make.
   A front-surface mirror has no colour of its own; it is whatever is
   around it. The room it sampled was built out of uColors, so the face
   came back as a violet disc and the declared rhodium never appeared in
   the frame at all.

   So the reflective materials sample a neutral studio instead: a dark
   floor under the instrument, a bright sweep over it, a warm key from
   the left and a cool fill from the right — which is how anyone would
   photograph a surgical instrument, and which is what puts a readable
   IMAGE in a mirror instead of a flat wash. The backdrop behind the
   object is still the house palette. */
const vec3 STFLOOR = vec3(0.105, 0.110, 0.122);   // the floor under it
const vec3 STHORIZ = vec3(0.400, 0.414, 0.442);   // where floor turns to sweep
const vec3 STSWEEP = vec3(0.900, 0.912, 0.932);   // the sweep over it
const vec3 STKEY   = vec3(1.000, 0.940, 0.862);   // the warm key
const vec3 STFILL  = vec3(0.706, 0.790, 0.910);   // the cool fill
const vec3 KEYDIR  = vec3(-0.640, 0.520, 0.566);  // unit, checked
const vec3 FILLDIR = vec3( 0.760, 0.180,-0.625);  // unit, checked
/* WHERE THE SWEEP HANGS, and this is the one number that decides whether
   the subject of this band is a mirror or a hole.

   A sweep is not a ceiling. It is a curved surface that comes down behind
   the subject, bends under it and runs FORWARD toward the lens — and a
   photographer shooting anything mirror-finish puts it where the mirror
   can see it, which is in front, not overhead. This file had it overhead,
   and the consequence was measurable rather than aesthetic: the face's
   own reflected ray was solved at four moments of the loop and at all
   three widths and it came back between 0.03 and 0.52 of the hemisphere
   EVERY TIME — that is, in the dark half, always. The mirror was pointed
   at the floor for the entire loop. Leaning the sweep fifty-one degrees
   forward puts the same numbers at 0.11 to 0.90, so the face crosses the
   horizon twice a turn, which is what a mirror does. */
const vec3 SWEEPUP = vec3(-0.050, 0.621, 0.782);  // unit, checked

/* ---- the instrument, in its own frame --------------------------------
   q.x runs along the handle from the head toward the butt; q.y and q.z
   are the cross section, and they are the pair that the rock turns, so
   the whole head orbits the handle axis for two cosines. One unit is
   about eleven millimetres: the head is 22mm across and the thing is
   155mm long, which is a real mouth mirror rather than a lollipop. */
const vec3  HCQ = vec3(-0.52, 0.24, 0.0);          // head centre
const vec3  NQF = vec3(-0.27564, 0.96126, 0.0);    // face normal, 74 deg off the axis
const vec3  SH0 = vec3( 0.30, 0.205, 0.0);         // shank, at the head
const vec3  SH1 = vec3( 2.62, 0.010, 0.0);         // shank, at the collar
const float HX0 = 2.45;                            // handle, front
const float HX1 = 13.55;                           // handle, butt
const float ID0 = 3.36;                            // the ID ring, front
const float ID1 = 4.04;                            // the ID ring, back
const float ZW  = -38.0;                           // the far wall
const float EPS = 0.0016;                          // hit, as a fraction of range

vec3 gAX, gBX, gCX, gO;
/* The bench, as one tone. A polished surface lying ON something shows
   that something in its underside, and until this pass there was nothing
   under this instrument to show: the steel's downward reflection came
   back as the studio's dark floor, which is why the darkest pixel in the
   frame used to be the handle's own belly rather than any contact. This
   is the lit tone of the table, solved once in main() and handed to the
   reflective materials so the thing they are resting on is in them. */
vec3 gBEN;
/* How much of the knurl the frame can actually resolve, 0 to 1, solved
   once in main() from the buffer height and the focal length. The knurl is
   GEOMETRY — it is cut into the distance field — so unlike a mark painted
   at the hit point it cannot be faded by a texture footprint after the
   fact: it has to leave the field, or the normal keeps swinging a full
   groove between one pixel and the next. A groove finer than the pixel it
   is drawn on is not a groove, it is moire. This matters most where it is
   least visible in a screenshot: the adaptive quality step in the harness
   halves the buffer twice on a slow phone, and a knurl that is nine
   pixels a period at full resolution is four and a half after it. */
float gKN;

float smin(float a, float b, float k){
  float h = clamp(0.5 + 0.5*(b-a)/k, 0.0, 1.0);
  return mix(b, a, h) - k*h*(1.0-h);
}

/* A shoulder rather than a clip. Polished steel under an operating lamp
   really does blow out where the lamp lands in it — but a blown patch
   with a HARD edge is an artefact, and a clamp() is exactly how you get
   one. This rolls the top of the range into white MONOTONICALLY, leaves
   everything below 0.8 untouched, and preserves hue because it scales
   all three channels by the same factor. */
vec3 shoulder(vec3 c){
  float m = max(max(c.r, c.g), c.b);
  float k = m > 0.80 ? (0.80 + 0.20*(1.0 - exp(-(m - 0.80)*4.0))) / m : 1.0;
  return c * k;
}

/* The same idea for an additive wash: approaches its ceiling instead of
   arriving at it. The first cut of this scene clamped the lamp's wash at
   0.50 and the boundary of the clamped region drew a hard circle across
   the wall, three metres wide, every time the mirror came round. */
float softsat(float x, float m){ return m * (1.0 - exp(-max(x, 0.0) / m)); }

/* The whole instrument, in its own frame. Five pieces and two smooth
   joins: a rounded disc standing on its tilted plane, a shank, the
   collar the shank screws into, a tapered handle with rings turned into
   it, and the silicone ID ring standing a little proud behind the
   collar. The rings are 0.0072 deep against a 0.37 radius and the ID
   ring is 0.026 proud over 0.04 of travel, so the field stays Lipschitz
   enough for a 0.92 step. */
float mapQ(vec3 q){
  vec3  v  = q - HCQ;
  float a  = dot(v, NQF);
  float r  = length(v - a*NQF);
  vec2  wq = vec2(r - 0.968, abs(a) - 0.022);
  float d  = min(max(wq.x, wq.y), 0.0) + length(max(wq, 0.0)) - 0.030;

  vec3  pa = q - SH0, ba = SH1 - SH0;
  float hh = clamp(dot(pa,ba)/dot(ba,ba), 0.0, 1.0);
  d = smin(d, length(pa - ba*hh) - 0.135, 0.085);

  float rad = length(q.yz);
  float dx  = max(max(HX0 - q.x, q.x - HX1), 0.0);
  float u   = clamp((q.x - HX0)/(HX1 - HX0), 0.0, 1.0);
  float rH  = 0.372 - 0.060*u;
  float kn  = smoothstep(4.20, 5.00, q.x) * smoothstep(10.00, 9.10, q.x);
  rH -= 0.0072 * gKN * kn * (0.5 - 0.5*cos(q.x * 6.60));
  // The ferrule the shank screws into: a step with two shoulders, not a
  // bead. A bead is what a lollipop has.
  rH += 0.052 * smoothstep(2.52, 2.66, q.x) * smoothstep(3.16, 3.02, q.x);
  // The silicone ID ring, standing proud the way a moulded collar does.
  rH += 0.026 * smoothstep(ID0, ID0 + 0.04, q.x) * smoothstep(ID1, ID1 - 0.04, q.x);
  d = smin(d, length(vec2(dx, rad)) - rH, 0.060);
  return d;
}

float map(vec3 p){
  vec3 v = p - gO;
  return mapQ(vec3(dot(v,gAX), dot(v,gBX), dot(v,gCX)));
}

vec3 nrm(vec3 p, float h){
  vec2 k = vec2(1.0, -1.0);
  vec3 g = k.xyy*map(p + k.xyy*h) + k.yyx*map(p + k.yyx*h)
         + k.yxy*map(p + k.yxy*h) + k.xxx*map(p + k.xxx*h);
  // Never normalize something that can be zero. Four taps of a field can
  // cancel exactly — at the centre of the disc's rounding, for one — and
  // a normalize of a zero vector is a NaN, which paints a black pixel
  // that survives every clamp downstream.
  return g / max(length(g), 1e-6);
}

/* The two hulls the march is allowed to start from. Everything outside
   them is wall, and wall costs a divide.

   Both are MEASURED, and against TWO things rather than one.

   The obvious one is the geometry. The head's farthest point from the
   axis point the sphere is centred on is 0.24 (the head sits that far
   off the axis) + 0.999 (disc radius, its own rounding and half its
   thickness) = 1.24. The handle's widest point is 0.372 + 0.052 of
   ferrule + 0.026 of silicone + the smin bulge = 0.46, and the shank
   leaves the axis by 0.205 + 0.135 = 0.34.

   The one that is easy to miss, and that cost this file a real bug: the
   SILHOUETTE IS WIDER THAN THE OBJECT. The march records how close it
   came and the depth of field bleeds coverage outward by that much, so
   a fragment as far as half a unit clear of the handle still draws part
   of it. Outside the hull the march never runs at all, so coverage
   there is not faded — it is absent, and the difference between "faded
   to 0.02" and "absent" is a hard edge in the exact shape of the bound.
   The bound was drawing ITSELF, as a set of faint arcs hugging the butt
   of the handle. So each hull carries the bleed as well as the part, and
   the bleed is capped below so that the margin is a guarantee rather
   than a hope at any aspect. A hull tighter than what is inside it also
   lets rays tunnel straight through the object, and a hull
   returned at less than the march's own hit epsilon IS a hit — which is
   how an earlier scene in this set shipped as a violet ball. Neither is
   ever returned as a distance.

   So: 1.46 round the head against 1.24 of geometry, and 0.72 round the
   handle against 0.46, with the bleed capped at 0.06 below so that the
   0.22 and the 0.26 of margin cover it at every aspect. */
float iSph(vec3 ro, vec3 rd, vec3 ce, float r){
  vec3 oc = ro - ce;
  float b = dot(oc, rd), c = dot(oc,oc) - r*r;
  float h = b*b - c;
  return h < 0.0 ? -1.0 : -b - sqrt(h);
}
float iCap(vec3 ro, vec3 rd, vec3 pa, vec3 pb, float r){
  vec3 ba = pb - pa, oa = ro - pa;
  float bb = dot(ba,ba), bd = dot(ba,rd), bo = dot(ba,oa);
  float a = bb - bd*bd;
  float b = bb*dot(rd,oa) - bo*bd;
  float c = bb*dot(oa,oa) - bo*bo - r*r*bb;
  float h = b*b - a*c;
  if (h < 0.0) return -1.0;
  float t = (-b - sqrt(h))/max(a, 1e-6);
  float y = bo + t*bd;
  if (y > 0.0 && y < bb) return t;
  vec3 oc = y <= 0.0 ? oa : ro - pb;
  b = dot(rd,oc); c = dot(oc,oc) - r*r;
  h = b*b - c;
  return h > 0.0 ? -b - sqrt(h) : -1.0;
}

/* ---- point to segment, and ray to segment ---------------------------
   The two distances every contact below is made of. The ray one has to
   solve the pair, clamp the one that is BOUNDED and then re-solve the
   other against the clamped point — the same order, and for exactly the
   same reason, as the shaft of light further down this file: clamping
   both independently is not the distance to a segment, and the locus
   where it goes wrong is a conic, which draws as a soft ellipse gliding
   over the floor. */
float pSeg(vec3 p, vec3 a, vec3 b, out vec3 q){
  vec3  ab = b - a, ap = p - a;
  float u  = clamp(dot(ap,ab) / max(dot(ab,ab), 1e-5), 0.0, 1.0);
  q = a + ab*u;
  return length(p - q);
}
float rSeg(vec3 ro, vec3 rd, vec3 a, vec3 b, out float tr){
  vec3  ab = b - a, ao = ro - a;
  float bd = dot(ab, rd), bb = dot(ab, ab);
  float b1 = dot(rd, ao), bo = dot(ab, ao);
  float u  = clamp((b1*bd - bo) / min(bd*bd - bb, -1e-5), 0.0, 1.0);
  tr = max(u*bd - b1, 0.0);
  return length(ao + rd*tr - ab*u);
}

/* ---- WHAT THE INSTRUMENT KEEPS OFF WHAT IT IS LYING ON ---------------
   Two different things, and "a flat violet puddle" is what you get by
   collapsing them into one.

   CONTACT is a solid angle: the ambient this patch of surface would have
   had if the instrument were not sitting in the way. There is no
   direction in it. It is measured to the instrument's own SURFACE rather
   than to its centre line, so it is tightest and darkest exactly AT the
   touch and lighter every millimetre away from it, and it is weighted by
   how much of that surface the receiving normal can actually see — which
   is what keeps the steep flank of a fold of cloth from darkening as
   hard as the crease at its foot. Three falloffs rather than one, for
   the reason the till's counter needs three: this table is seen at
   fifteen degrees, so a tenth of a unit of it under the butt is two
   pixels and the same tenth out at the side is twenty, and no single
   curve is honest across both.

   CAST is what the set's key cannot see. It is thrown along ONE vector —
   KEYDIR, the warm key the polished surfaces in this frame are already
   standing in, and the only light here that is above the bench, which is
   why it and not the operating lamp throws this — and its penumbra opens
   with the distance back to the thing casting it. So it is nearly a hard
   edge where the handle meets the cloth and a soft one a hand's width
   out, which is the difference between a shadow and a decal.

   Both come back as light REMOVED, 0 to 1. The caller multiplies. */
float rested(vec3 P, vec3 n, vec3 hA, vec3 hB, float hR, vec3 HC, float HR){
  vec3  qa;
  float dA  = pSeg(P, hA, hB, qa) - hR;
  float dB  = length(P - HC) - HR;
  vec3  toO = dB < dA ? HC - P : qa - P;
  float dC  = max(min(dA, dB), 0.0);
  float ndo = clamp(dot(n, toO / max(length(toO), 1e-4)), 0.0, 1.0);
  /* The three rates are set in WORLD units and they have to survive the
     tier, which is the one thing a contact tuned on a desktop screenshot
     gets wrong. The harness draws this band into a buffer at about half
     the canvas at every width, and at 4:5 the butt of the handle is five
     units further from the lens than it is at 21:9 — so a core that ran
     0.12 of a unit wide, which is four buffer pixels on a desktop, came
     out at under two on a phone and the bilinear upscale simply averaged
     it away. Measured: the butt's contact read 40 at 1440 and 78 at 390,
     for the same scene. Wider rates make the core about three of a unit
     across at both, which is a contact that is the same DEPTH at every
     width rather than the same number of source pixels. */
  float con = (exp(-dC*5.60)*0.82 + exp(-dC*2.00)*0.36 + exp(-dC*0.72)*0.16)
            * mix(0.34, 1.0, ndo);

  float tr;
  float ds  = rSeg(P + n*0.004, KEYDIR, hA, hB, tr);
  float pen = 0.060 + 0.150*tr;
  float cst = 1.0 - smoothstep(hR - pen, hR + pen, ds);
  vec3  dh  = HC - P;
  float th  = dot(dh, KEYDIR);
  float dp  = length(dh - KEYDIR*th);
  float ph  = 0.090 + 0.150*max(th, 0.0);
  cst = max(cst, (1.0 - smoothstep(HR - ph, HR + ph, dp)) * smoothstep(0.0, 0.30, th));

  return clamp(con*0.88 + cst*0.40, 0.0, 1.0);
}

/* The wall. Light lavender at the head of the room, paper at its foot,
   with the lamp's own wash off to the left. It is thirty units behind the
   focal plane and therefore never in focus, so there is nothing on it
   with an edge. Every tone in here is the site's.

   THE PALE END, and this is the correction. The last cut ran to
   uColors[0] at ninety-two per cent, which is the deep end of the
   palette, and the argument written here for it was that a bright patch
   thrown onto near-white is a patch nobody can see. That argument was
   right about the patch and wrong about everything else: it put the whole
   band on saturated violet where every sibling sits on lavender-to-white,
   and — far worse — it stood a MIRROR in front of a violet wall, which is
   the entire reason the subject rendered as a purple disc. The patch is
   worth less than the object. */
vec3 wallBase(vec3 W){
  float wv = clamp(W.y*0.0300 + 0.42, 0.0, 1.0);
  // The deepest this wall is allowed to go is a light lavender: uColors[1]
  // carried a little way toward paper, never uColors[0].
  vec3 c = mix(mix(uColors[2], uColors[1], 0.42), mix(uColors[2], uColors[1], 0.90),
               smoothstep(0.40, 0.98, wv));
  c = mix(mix(uColors[3], uColors[2], 0.78), c, smoothstep(0.23, 0.52, wv));
  // The paper end starts low: the harness already cuts the foot of the
  // band to white, and a wall that had gone there on its own left the
  // lower third of a 4:5 band empty.
  c = mix(uColors[3], c, smoothstep(-0.18, 0.08, wv));
  // One broad, gentle lift where the lamp's own spill falls on it — and
  // it is the LAMP's white rather than a paler violet, so the room has
  // one light in it rather than two unrelated brightenings.
  vec2 dl = (W.xy - vec2(-15.0, 7.0)) * vec2(0.042, 0.058);
  return mix(c, mix(c, LAMPC, 0.55), exp(-dot(dl,dl)) * 0.30);
}

/* The ambient a DIFFUSE surface sees, and the only thing on the
   instrument that is diffuse is the silicone ring. The studio below is
   for the polished materials; anything that takes light rather than
   returning it is lit by the room the site is in, which is the house
   palette. Keeping the two apart is what lets the steel be neutral
   without the one coloured part of the instrument drifting out of the
   page's own light. */
vec3 ambHouse(vec3 n){
  float up = n.y*0.5 + 0.5;
  return mix(mix(uColors[1], uColors[2], 0.35), uColors[2], smoothstep(0.30, 0.85, up));
}

/* THE STUDIO, as a direction, WITHOUT the lamp in it. This is what a
   polished surface in this frame is actually standing in, and it is
   neutral on purpose: a dark floor below, a bright sweep above, a warm
   key from the left and a cool fill from the right.

   The hard horizon between the floor and the sweep is the whole
   difference between chrome and paint — a rod lying under a studio sweep
   picks up one long bright band with a DARK LINE under it, and paint
   picks up a soft gradient and nothing else. It is also what gives the
   mirror face something to hold: a disc with a horizon curving across it
   is unmistakably a mirror, and a disc of flat wash is a lollipop. */
vec3 roomBase(vec3 r, float sf){
  // How far up the SWEEP this direction lands — not how high it points.
  // See SWEEPUP above: the only genuinely dark direction in a studio is
  // down AND away from the lens.
  float up = dot(r, SWEEPUP)*0.5 + 0.5;
  // The floor, and it is dark rather than black. Without the floor the
  // underside of a polished rod is a dead flat line and reads as ink;
  // with the floor at nothing, a mirror turned toward it is a hole cut in
  // the page, which is a worse failure than a flat disc.
  vec3 c = mix(STFLOOR, STFLOOR*2.8, smoothstep(0.02, 0.30, up));
  /* WHERE the horizon sits is the one number in this function, and it is
     set against the handle rather than against a hemisphere. A rod seen
     from the side maps the WHOLE hemisphere across its own width: the
     normal at its bottom silhouette points down, at its visible centre it
     points at the lens, and at its top silhouette it points up — and the
     reflected ray turns at twice that rate. So the height at which this
     crossover is written is, quite literally, how far up the handle the
     bright band starts. Written at 0.45 the horizon sat above the middle
     of the rod, five sixths of the instrument came back below it, and a
     stainless mouth mirror rendered as black enamel. At 0.24 the floor is
     the underside, the mid band is the lower flank and the sweep is the
     top half, which is what a photograph of surgical steel looks like. */
  c = mix(c, STHORIZ, smoothstep(0.240 - sf, 0.380 + sf, up));
  c = mix(c, STSWEEP, smoothstep(0.430 - sf, 0.590 + sf, up));
  /* AND THE SWEEP FALLS AWAY at its far end, because a sweep is a panel
     and not a sky. Without anything up here the face came back as a flat
     cream disc at the moments the rock passes through square, where the
     whole disc is sampling the top of one unbroken gradient — a white
     disc with nothing in it, which is a note this scene has had once.

     It is a FALLOFF and not an edge, and that distinction was learned
     from the frame. Written first as a hard panel edge between 0.87 and
     0.985 it did light up the face — but the reflected ray reaches its
     maximum at the middle of a dished mirror, so the dark side of that
     edge landed as a soft grey patch in the CENTRE of the disc and read
     as a stain on the glass rather than as a reflection of anything.
     Spread from 0.82 to 1.0 and stopping at three quarters rather than
     half, the same information arrives as the gentle fall a real sweep
     has toward its far edge: structure, with nothing in it that looks
     like dirt. */
  c = mix(c, mix(STHORIZ, STSWEEP, 0.62), smoothstep(0.820 - sf, 1.000 + sf, up));
  // And the sweep is graded across its own face, brightest where the light
  // hangs in it. It plateaus at 0.84 so it does not fight the falloff
  // above, which is the thing that actually carries the top end.
  c *= 1.0 + 0.22*smoothstep(0.58, 0.84, up);
  // The key and the fill. Two lights, warm and cool, set the way anybody
  // photographing an instrument would set them — and they are the reason
  // the steel turns through a range of tones as it rolls rather than
  // sliding up and down one grey.
  c *= mix(vec3(1.0), STKEY  * 1.14, 0.42*smoothstep(-0.15, 0.80, dot(r, KEYDIR)));
  c *= mix(vec3(1.0), STFILL * 1.08, 0.34*smoothstep(-0.15, 0.80, dot(r, FILLDIR)));
  return c;
}

/* The same studio with the operating lamp in it: a hard disc with a
   broad halo, and the only thing in the room brighter than the sweep.
   One function for the steel and the mirror both, so the two agree about
   what is standing round them. */
/* sf widens every edge in the studio at once, and it is the reflection
   LOBE rather than a stylistic softness: a surface that is out of focus
   is one whose microstructure is not being resolved, so what it returns
   is an average over a cone rather than one direction. Where it comes
   from, and why it has its own ramp rather than sharing the depth of
   field's, is written where it is computed. */
vec3 room(vec3 r, vec3 lv, float sf){
  float l = max(dot(r, lv), 0.0);
  // Three lobes. The broad one is the pool the lamp throws across the
  // whole sweep, and it is the one that matters on a mirror: the hard
  // disc is six degrees wide and simply is not in the face's view at most
  // of the angles the rock reaches. l is clamped at zero above, so the
  // pow has a non-negative base and the cube is just cheaper than a
  // second one.
  // The exponent is clamped as well as the base. l is non-negative above,
  // so the base is safe — but sf now reaches 0.34 from the steel's lobe and
  // an unclamped sf*3.0 would extrapolate the mix past 5.0 and out the far
  // side, and pow() of a small base to a NEGATIVE exponent is not a soft
  // highlight, it is a division by nearly nothing.
  return roomBase(r, sf) + LAMPC * (0.30*l*l*l + 0.70*pow(l, mix(22.0, 5.0, clamp(sf*3.0, 0.0, 1.0)))
                              + 1.90*smoothstep(0.9855 - sf*0.09, 0.9960, l));
}

/* What the mirror can see, in any direction at all. Mostly the studio it
   is standing in; only a ray that leaves hard toward the back of the room
   picks up the wall, and even then the studio is still a third of it,
   because a mirror shows a room that is LIT rather than a surface that is
   painted.

   The balance moved a long way in this pass. It used to hand the wall
   over at -r.z of 0.26 and at full strength, and since the wall was
   saturated violet, most of every turn of the face was a violet disc —
   the exact fault the owner named. Now the ramp starts at 0.18, finishes
   at 0.62, and tops out at seventy per cent, so the bright sweep and the
   dark floor are in the face at every angle the rock reaches. */
vec3 seen(vec3 o, vec3 r, vec3 lv, float sf, float wgt){
  vec3 W = o + r * ((ZW - o.z) / min(r.z, -0.02));
  // sf is the reflection lobe: zero for the face, which is the one surface
  // in the frame that is never out of focus, and wider down the handle.
  // wgt is how much of the wall this material is allowed to take.
  vec3 c = mix(room(r, lv, sf), wallBase(W) * 1.02,
               smoothstep(0.18, 0.62, -r.z) * wgt);
  /* AND DOWN IS THE BENCH, now that there is one. The studio's floor is a
     dark tone standing in for a surface that was never drawn; the table
     under the instrument is drawn, so a ray leaving downward returns the
     table instead. It is not a flourish — a chrome rod lying on pale
     cloth has a bright band along its belly, and without it the object
     is a rod lying on a dark floor that is not in the picture. */
  return mix(c, gBEN, smoothstep(-0.05, -0.40, r.y) * 0.78);
}

float hash21(vec2 p){
  vec3 q = fract(p.xyx * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

void main(){
  vec2  p   = (gl_FragCoord.xy - 0.5*uRes) / uRes.y;
  float asp = uRes.x / uRes.y;
  float e   = smoothstep(0.0, 1.0, uEnter);
  float aa  = 1.30 / uRes.y;
  // Linear in the aspect, not a smoothstep of it: the width available
  // grows linearly with the aspect, and a layout eased against a budget
  // that is not eased is how an object ends up half out of a 16:9 band.
  float wl  = clamp((asp - 0.80) / 1.54, 0.0, 1.0);

  /* ---------------- where the instrument lies ----------------
     Same object, turned into the screen as the band narrows. At 21:9 it
     lies nearly across the frame; at 4:5 it points away down its own
     length and the perspective does the work instead of the width. */
  vec3 ANCH = vec3(mix(-0.60, -2.60, wl), mix(0.30, 0.20, wl), mix(-6.90, -7.90, wl));
  /* The 4:5 end of this was 0.350 across and 0.928 into the screen, which
     is very nearly down the barrel: the handle projected to 1.21 head
     diameters of screen length against 4.82 at 21:9. Four times. That is
     not the same picture, and a picture that is not the same does not get
     the same four words out of a stranger — a mouth mirror with a stub on
     it is a hand mirror. 0.600 / 0.760 brings the phone band to 2.04 and
     the tablet to 3.36, so the instrument foreshortens across the set
     instead of collapsing at one end of it, and the whole object still
     lands inside the frame at every aspect by the solve below. */
  vec3 AX   = normalize(vec3(mix(0.600, 0.945, wl),
                             mix(-0.250, -0.100, wl),
                             mix(-0.760, -0.310, wl)));

  /* ---------------- the camera fits the object ----------------
     Project the head's bounding sphere and the butt of the handle at
     unit focal length, measure the box, then solve the focal length and
     the lens shift so it lands inside the strip the band actually
     leaves: above the paper the harness cuts at 0.17, below the header
     floating over the top. The blur allowance comes off first, because
     a silhouette that bleeds by a twentieth of the band is part of the
     object as far as the edge of the frame is concerned. */
  vec3  axisC = ANCH + HCQ.x*AX;                 // the head's point ON the axis
  vec3  buttP = ANCH + HX1*AX;
  vec2  ph1   = axisC.xy / -axisC.z;
  vec2  pb1   = buttP.xy / -buttP.z;
  float rh1   = 1.30 / -axisC.z * 1.05;          // 1.24 of head, and a margin
  float rb1   = 0.40 / -buttP.z * 1.10;
  vec2  lo    = min(ph1 - rh1, pb1 - rb1);
  vec2  hi    = max(ph1 + rh1, pb1 + rb1);
  vec2  ctr   = 0.5*(lo + hi);
  vec2  hlf   = max(0.5*(hi - lo), vec2(1e-3));
  // Floored as well as capped. The numerator goes negative for an aspect
  // under about 0.2, which this band cannot reach — but a focal length
  // that can change SIGN turns the picture inside out rather than
  // degrading, and a guard that costs one instruction is cheaper than
  // finding that out from a screenshot.
  float f     = clamp(min((0.5*asp - mix(0.050, 0.100, wl)) / hlf.x, 0.2125 / hlf.y), 0.35, 1.58);
  float sx    = -f*ctr.x + mix(0.00, -0.06, wl);
  float sy    = 0.0725 - f*ctr.y;

  /* One period of the knurl, in buffer pixels, measured at the middle of
     the knurled stretch — and then how much of it the field is allowed to
     keep. The period is 2*PI/6.60 = 0.952 of a unit; a unit at distance t
     is f*uRes.y/t pixels. It comes out at about 65 pixels on a desktop,
     38 on a tablet and 19 on a phone, so nothing is taken away from any
     tier that this band normally runs at — this is the guard for the one
     case a screenshot never shows, which is the harness giving up
     resolution twice on a slow device and halving that 19 to under five. */
  float knPx  = 0.952 * f * uRes.y / max(length(ANCH + 7.10*AX), 1.0);
  gKN = smoothstep(4.0, 11.0, knPx);

  /* ---------------- the roll ----------------
     A hand rolls a mouth mirror between finger and thumb to look at one
     surface from two sides and then rolls it back. It does not spin the
     thing. This used to be two full turns a loop, and the full turn is
     what had to go — for a reason that is arithmetic rather than taste.

     THE OBJECT HAS TO BE THE SAME FOUR WORDS AT EVERY MOMENT, not just at
     every width, because the three screenshots that decide that are taken
     at three DIFFERENT moments: the shader compiles when the device gets
     round to it, so the loop is at a different phase in each one. Two full
     turns put the disc edge-on for 12.8 per cent of the loop — measured,
     by integrating the readability over twenty thousand samples — and
     three independent captures of a 12.8 per cent window come up with at
     least one edge-on frame about a third of the time. It did: two of the
     first three landed there, and an edge-on mouth mirror is a thin
     ellipse on a stick, which is not the same four words. Easing harder
     does not fix it; at the monotonic limit the window is still 11.6 per
     cent, because the disc has to cross edge-on twice per turn however
     fast it goes through.

     So it rocks instead, through 62 degrees either side of square, once
     out and back each way per loop. The consequences were all measured
     before it was written:

       · the face is never more than 66 degrees off square at ANY width —
         the worst case over the whole loop is 0.49, 0.49 and 0.41 of
         normal-to-eye at 4:5, 16:10 and 21:9. The disc is always a disc.
       · the thrown patch SURVIVES, which was the thing at risk: the lamp
         is unchanged and the mirror still casts onto the wall for 66, 49
         and 22 per cent of the loop at the three widths.
       · a single sine closes the loop exactly — value and slope both
         match at u = 1 and u = 0 — so there is no seam and no restart.
       · it is slowest at the two ends of the rock, which is where a hand
         actually pauses, and quickest through square.

     What is lost is the view of the turned steel back. That view was also
     the moment that made a 4:5 band and a 21:9 band look like different
     objects, so it is not much of a loss. uEnter rolls it in once. */
  float u   = fract(uTime / 9.6);

  vec3 b0 = normalize(cross(AX, vec3(0.0, 0.0, 1.0)));
  vec3 c0 = cross(AX, b0);
  vec3 eye = normalize(-ANCH);                 // from the head back to the lens
  // The angle at which the face is square to the lens, SOLVED rather than
  // typed — one atan of the view direction in the head's own frame — so
  // the rock is centred on the same thing at every aspect. Written the
  // other way round, as an ease keyed against this angle, the beats landed
  // wherever the aspect happened to put them and a 21:9 band showed the
  // bright face at the same instant a 4:5 band showed the dark back.
  float face = atan(dot(c0, eye), dot(b0, eye));
  float phi = face + 1.08*sin(2.0*PI*u) + (1.0 - e)*0.55
            + (uPointer.x - 0.5)*0.22;

  float cf = cos(phi), sf = sin(phi);
  gAX = AX;
  gBX = b0*cf + c0*sf;
  gCX = c0*cf - b0*sf;
  gO  = ANCH;

  // The head's true centre, which is off the axis by HCQ.y and therefore
  // turns with the rock. The bounding sphere is centred on the axis point
  // instead and carries that 0.24 inside its radius, so it stays a
  // conservative hull at every angle rather than only at one.
  vec3 headC = axisC + HCQ.y*gBX;

  /* ---------------- the lens, drifting ----------------
     An orbit about the head rather than a pan, so the instrument stays
     pinned and the wall behind it slides. Two and a half degrees, over
     periods that do not divide into each other or into the rock. */
  float yaw = 0.030*sin(uTime*0.191) + 0.017*sin(uTime*0.1163 + 2.1)
            + (uPointer.x - 0.5)*0.050;
  float pit = 0.019*sin(uTime*0.1571 + 1.2) - (uPointer.y - 0.5)*0.030;
  vec3 ro = vec3(0.0);
  vec3 rd = normalize(vec3(p.x - sx, p.y - sy, -f));
  {
    float c = cos(yaw), s = sin(yaw);
    vec3 o = ro - ANCH;
    ro = ANCH + vec3(c*o.x + s*o.z, o.y, -s*o.x + c*o.z);
    rd = vec3(c*rd.x + s*rd.z, rd.y, -s*rd.x + c*rd.z);
  }
  {
    float c = cos(pit), s = sin(pit);
    vec3 o = ro - ANCH;
    ro = ANCH + vec3(o.x, c*o.y - s*o.z, s*o.y + c*o.z);
    rd = vec3(rd.x, c*rd.y - s*rd.z, s*rd.y + c*rd.z);
  }

  /* ---------------- the light it throws ----------------
     The face's world normal, the lamp, and one reflection. Where that
     reflected ray meets the wall is the bright patch, how far it has
     travelled is how big and how faint, and how obliquely it lands is
     how far it smears along its own direction. None of that is keyed:
     it is what a mirror on a cone does, which is why the sweep
     accelerates off the frame instead of sliding off at one speed. */
  vec3  LMP = mix(vec3(-12.0, 6.0, 36.0), vec3(-36.0, -2.0, 4.0), wl);
  vec3  Cw  = headC;
  vec3  Nw  = NQF.x*gAX + NQF.y*gBX;
  vec3  lv  = normalize(LMP - Cw);
  float nl  = dot(Nw, lv);
  vec3  rv  = 2.0*nl*Nw - lv;
  float rz  = min(rv.z, -0.001);
  float tw  = (ZW - Cw.z) / rz;
  float ok  = smoothstep(0.03, 0.22, -rv.z) * smoothstep(0.0, 0.22, nl)
            * smoothstep(0.02, 0.30, e);
  vec3  Ws  = Cw + rv*clamp(tw, 0.0, 300.0);

  /* ---------------- the wall ---------------- */
  float twall = (ZW - ro.z) / min(rd.z, -0.02);
  vec3  W     = ro + rd*twall;
  vec3  bg    = wallBase(W);

  /* ---------------- IT IS LYING DOWN ----------------
     The note back on the last cut was four words: the mirror floats with
     no surface. It did. There was nothing in this frame for it to be on —
     an instrument hanging in a room, which is the one thing no photograph
     of a hand instrument has ever been.

     It is down now. The butt of the handle is on the bracket table, the
     handle itself is across a folded tray towel, and the head is
     cantilevered clear of both.

     WHY A TOWEL AND NOT SIMPLY THE TABLE — which is arithmetic, not
     taste, and it is also why this scene could not just be given a floor.
     The head is set at seventy-four degrees to the shank and its centre
     stands 0.24 off the handle's axis, so as the instrument rolls the
     rim sweeps to 1.05 BELOW that axis while the handle is only 0.36
     across. A mouth mirror laid flat on a tray would drive its own head
     through the tray twice a loop. Lifting the handle over a fold of
     towel raises the head 0.67 clear of the table at 21:9 and 2.7 at
     4:5 — which is both why a surgery puts a towel under an instrument
     and the only arrangement in which this roll stays possible.

     AND NOTHING HERE IS PAINTED AT A SCREEN POSITION, which is the fault
     this set keeps being sent back for. The table's height is SOLVED
     from the butt of the handle rather than typed. The towel's section is
     solved so the handle is TANGENT to it — the support function of an
     ellipse against a line of known slope, which is one square root —
     rather than resting its crest on a point the handle passes through
     and intersecting it either side. Every shadow is measured in the
     room, off the instrument's own geometry, so all of it moves with the
     object and none of it was tuned on one screenshot. */
  vec3  UPQ  = normalize(vec3(0.0, 1.0, 0.0) - AX.y*AX);   // up, across the axis
  float yT   = buttP.y - 0.312*UPQ.y;                      // the table, at the butt
  const float TXC = 5.60;                                  // where the roll sits
  vec3  tAxP = ANCH + TXC*AX;
  float tRad = 0.372 - 0.060*(TXC - HX0)/(HX1 - HX0);
  float hAb  = (tAxP.y - tRad*UPQ.y) - yT;                 // the handle, over the table
  float mslp = (AX.y + 0.060/(HX1 - HX0)) / max(length(AX.xz), 1e-3);
  /* THE ROLL IS ROUND IN SECTION, AND THAT IS GEOMETRY RATHER THAN
     TASTE. It was a flat fold of towel first, and a flat fold cannot
     work here: the lens sits very nearly in the handle's own vertical
     plane, so the plane of eye-rays grazing the handle's underside falls
     away toward the lens at a quarter of a unit per unit at 4:5. A crest
     flatter than that rate climbs THROUGH that plane on the near side —
     which is to say the cloth draws over the handle it is supposed to be
     holding up, and on a phone it hid the whole back half of the
     instrument. A round section falls quadratically instead of linearly,
     so it stays under the silhouette to within a pixel, and for the same
     reason the roll runs AWAY from the lens from its contact rather than
     through it: a cylinder's crest is a level line, and a level line
     carried toward this lens rises above the handle however short it is.
     What it is, then, is what a surgery has a drawer of — a rolled
     cotton, 8mm at 21:9 and 20mm at 4:5, and 37mm long at both. Its
     radius is SOLVED, not chosen: tangent to the handle's underside from
     below and resting on the table, which is one square root. */
  // Floored, because a radius that can reach zero is a capsule that turns
  // into a line and a normalize of nothing.
  float tR   = max(hAb, 0.05) / (1.0 + sqrt(1.0 + mslp*mslp));
  vec3  tDir = normalize(vec3(AX.z, 0.0, -AX.x));          // across the handle, level
  vec3  tA   = vec3(tAxP.x, yT + tR, tAxP.z);              // the contact end
  vec3  tB   = tA + tDir*3.40;                             // and away from the lens
  vec3  hoA  = ANCH + HX0*AX;                              // the handle, as an occluder
  const float hoR = 0.345;
  const float hdR = 0.998;
  // The bench as one tone, for the polished materials to stand on. Solved
  // here rather than sampled per reflected ray: the table is flat and
  // evenly lit, so one value is the whole of it, and a mirror-finish rod
  // does not need a second intersection to know what it is lying on.
  gBEN = mix(uColors[2], uColors[1], 0.95)
       * (ambHouse(vec3(0.0, 1.0, 0.0))*0.60 + LAMPC*(0.06 + 0.30*KEYDIR.y));

  /* And it carries its own edge. Everything else in this frame is either
     analytic to the wall or antialiased by the march's closest approach,
     and the harness draws the whole band into a buffer at about half the
     canvas — so a hard silhouette here is not a hard edge, it is a two
     pixel staircase after the upscale. The ray-to-segment distance the
     shadows already need is also the coverage, for one smoothstep. */
  float tTow = iCap(ro, rd, tA, tB, tR);
  float trw;
  float dtw  = rSeg(ro, rd, tA, tB, trw);
  float tTw  = tTow > 0.0 ? tTow : trw;
  float wA   = max(trw*aa*1.30, 1e-5);
  float covT = 1.0 - smoothstep(-wA, wA, dtw - tR);

  float tBen = rd.y < -1e-4 ? (yT - ro.y)/rd.y : -1.0;
  // Past the wall is the wall's business: the table runs under the room
  // and stops where the room does.
  if (tBen > 0.0 && ro.z + rd.z*tBen < ZW) tBen = -1.0;

  float tSet  = 1e9;
  float onWall = 1.0;
  /* The bench, and the cloth on it. Both are DIFFUSE, so by this file's
     own colour law they are lit by the HOUSE palette — the split that
     sends the polished materials to the studio and everything that takes
     light rather than returning it to the room the page is in. */
  if (tBen > 0.0 && tBen < twall) {
    tSet = tBen;
    onWall = 0.0;
    vec3  SP  = ro + rd*tBen;
    vec3  SN  = vec3(0.0, 1.0, 0.0);
    vec3  alb = mix(uColors[2], uColors[1], 0.95);
    vec3  lit = alb * (ambHouse(SN)*0.60 + LAMPC*(0.06 + 0.30*clamp(dot(SN, KEYDIR), 0.0, 1.0)));
    float sh  = rested(SP, SN, hoA, buttP, hoR, headC, hdR);
    /* And the roll's own weight on the table, which is a contact too and
       has to be the DARKEST thing the table has. The crease where cotton
       meets laminate is hidden under the roll's own overhang from this
       lens, so the first table the eye can see is already almost fully
       occluded — which is why the tight term here is 0.90 and not the
       0.66 it was, where the seam came out lighter than the roll it
       belonged to. */
    vec3  q;
    float dTw = max(pSeg(SP, tA, tB, q) - tR, 0.0);
    float ct  = exp(-dTw*5.20)*0.94 + exp(-dTw*1.90)*0.36 + exp(-dTw*0.72)*0.13;
    float trr;
    float dsw = rSeg(SP + SN*0.004, KEYDIR, tA, tB, trr);
    float pw  = 0.070 + 0.150*trr;
    ct = max(ct, (1.0 - smoothstep(tR*0.82 - pw, tR*0.82 + pw, dsw)) * 0.54);
    sh = clamp(sh + ct, 0.0, 1.0);
    /* A MULTIPLY, never a mix toward a colour. A shadow is the light that
       is missing, so it can only ever be a darker shade of the surface it
       is on — and it is tinted by what is still reaching it, which in
       this room is the house violet bouncing off the wall behind. That is
       the whole reason a shadow on a coloured surface is MORE coloured
       than the surface round it and never a grey. */
    lit *= mix(vec3(1.0), vec3(0.195, 0.176, 0.310), sh);
    // The table gives way to the room rather than meeting it at a line:
    // thirty units of air is thirty units of air.
    bg = mix(lit, wallBase(W), smoothstep(14.0, 34.0, tBen)*0.85);
  }
  if (covT > 0.002 && tTw < twall) {
    tSet = min(tSet, tTw);
    onWall *= 1.0 - covT;
    vec3  SP = ro + rd*tTw;
    vec3  q;
    pSeg(SP, tA, tB, q);
    vec3  SN  = normalize(SP - q);
    vec3  alb = mix(uColors[2], uColors[1], 0.30);
    // A nap, so a rolled cotton is not a moulding. Gentle, and the
    // same at every tier: the global dither downstream carries the rest.
    alb *= 0.972 + 0.052*hash21(floor(vec2(dot(SP, tDir), SP.y)*46.0));
    vec3  lit = alb * (ambHouse(SN)*0.60 + LAMPC*(0.06 + 0.30*clamp(dot(SN, KEYDIR), 0.0, 1.0)));
    lit *= mix(vec3(1.0), vec3(0.195, 0.176, 0.310),
               rested(SP, SN, hoA, buttP, hoR, headC, hdR));
    bg = mix(bg, lit, covT);
  }

  /* THE BLOB WAS THE INSTRUMENT'S CAST SHADOW, and naming it took a
     projection back to screen space rather than a guess. The two ends of
     the instrument were projected from the lamp onto the wall as a
     capsule — correct geometry — and painted mix(uColors[0], uInk, 0.30)
     at thirty per cent, which is #551a89 at thirty per cent, because
     those two colours are the same colour. At 16:10 and only at 16:10 the
     two ends land four wall units apart while the radius reached five and
     a bit, so the capsule degenerated into a DISC: a flat violet circle
     three metres across, sitting at 0.65 of the half-width with the butt
     of the handle back at 0.49, with nothing in the frame to cast it.
     That is the "dark circular blob at 820 with nothing behind it".

     It is not dimmed here, it is gone, because the honest answer is that
     there is no shadow to draw. The lamp is a DISH — a dental operating
     light is about 200mm across — the instrument stands thirty units in
     front of the wall, and at that ratio of source size to throw distance
     the umbra has vanished completely and the penumbra is spread over
     something like forty units. What reaches that wall is not a shadow,
     it is a hemisphere of light very slightly less even than it was. So
     the wall keeps the lamp's own broad wash and the patch the mirror
     throws across it, and nothing is drawn that a photograph of this
     arrangement would not contain. */

  // The patch, sweeping. It is the lamp's own white rather than paper
  // white, because it IS the lamp — arriving second hand off a mirror.
  {
    vec2 dW = W.xy - Ws.xy;
    vec2 ed = normalize(rv.xy + vec2(1e-4, 0.0));
    float al = dot(dW, ed);
    float ac = dW.x*ed.y - dW.y*ed.x;
    float sg = 2.55 + 0.082*clamp(tw, 0.0, 200.0);
    float st = clamp(1.0 / max(-rv.z, 0.10), 1.0, 6.0);
    float s2 = (al*al)/(sg*sg*st*st) + (ac*ac)/(sg*sg);
    float fall = 900.0 / (tw*tw + 420.0);
    // onWall, because the patch is ON the wall. Left ungated it painted
    // itself across the table in the foreground as well, which is a
    // reflection landing on two surfaces thirty units apart at once.
    float I = ok * nl * fall * 5.4 * onWall;
    bg = mix(bg, LAMPC, softsat((exp(-s2) + exp(-s2*3.0)*0.9) * I, 0.80));
    // and the wash it puts round itself, which is how a room knows a
    // light has moved in it. Lighter than it was: the wall it lands on is
    // now pale, and a white wash driven to half on a pale wall is a second
    // white blob rather than a light.
    bg = mix(bg, mix(uColors[2], LAMPC, 0.60), softsat(exp(-s2*0.10) * I * 0.30, 0.34));
  }

  // And the shaft of it in the air, as the line-to-line distance from
  // this camera ray to that reflected one. No march: two dots and a
  // determinant. A phone does without it, since the patch it lands in
  // carries the event on its own; a tablet keeps it.
  if (uTier > 0.25) {
    vec3  w0 = ro - Cw;
    float bq = dot(rd, rv);
    float dq = dot(rd, w0), eq = dot(rv, w0);
    float den = max(1.0 - bq*bq, 1e-3);
    /* The closest approach between the camera RAY and the light SEGMENT,
       and it has to be done in this order: solve the pair, clamp the one
       that is bounded, then RE-SOLVE the other against the clamped point.

       The first cut clamped both parameters independently and gated the
       result with step(sc > 0). Clamping both independently is not the
       distance to a segment, and the locus where the unclamped solution
       goes out of range is a conic — so what that actually drew was a
       soft-edged ellipse about four metres across, gliding over the wall
       with the mirror, twice a loop. It survived one round of review
       because it looked a little like a light. It is not: rv is a unit
       vector, so tc is a distance in the same units as tw, and the
       geometry below is exact. */
    float tc = clamp((eq - bq*dq) / den, 0.0, max(tw, 0.0));
    vec3  Pb = Cw + rv*tc;
    float sc = max(dot(Pb - ro, rd), 0.0);
    vec3  Pr = ro + rd*sc;
    float sg = 1.15 + 0.070*tc/(1.0 + tc/120.0);
    /* The ONLY gate here that is a function of screen position is the
       Gaussian, and that is deliberate. tc is the distance along the beam
       to the closest approach, and near either end of the beam it changes
       by tens of units from one pixel to the next — so a smoothstep on
       tc, however wide it is written, is sub-pixel on the screen and
       draws a hard curve. A ramp is not soft because its two arguments
       are far apart; it is soft because the thing it ramps on moves
       slowly. The distance between the two closest points does; tc does
       not. The beam therefore ends where the geometry ends it — tc is
       clamped to the segment, so past the wall the closest point IS the
       wall end and the Gaussian falls away from it on its own. */
    float g = exp(-dot(Pr-Pb, Pr-Pb)/(sg*sg)) * smoothstep(0.0, 2.4, tc);
    // And it is air, so it is in front of the table or it is behind it.
    // sc is where along this camera ray the closest approach happens and
    // tSet is where the surface is, so the test is one subtraction.
    g *= smoothstep(-0.20, 0.60, tSet - sc);
    bg = mix(bg, LAMPC, softsat(g * ok * 0.46, 0.62));
  }

  // A little corner fall, so the frame has a middle — and a MULTIPLY, for
  // the same reason the shadow is one. The last cut painted uColors[0]
  // over the corners at fourteen per cent, which on a pale wall is four
  // lilac stains rather than a falloff.
  bg *= mix(vec3(1.0), vec3(0.900, 0.884, 0.928),
            smoothstep(0.40, 1.20, dot(p,p)*1.4));

  /* ---------------- one march ----------------
     Started at the hull, never run to the cap, and stepped down by tier.
     min(d/t) along the way is the angle by which the ray missed, and an
     angle is a screen distance — which is the whole silhouette, in
     focus and out of it, for one extra min per step. */
  float tS = iSph(ro, rd, axisC, 1.46);
  float tC = iCap(ro, rd, ANCH + 0.20*AX, buttP, 0.72);
  float t0 = 1e9;
  if (tS > -0.5) t0 = min(t0, tS);
  if (tC > -0.5) t0 = min(t0, tC);

  float t = max(t0, 0.05);
  float dmin = 1e9, tAt = -axisC.z;
  int steps = uTier > 0.75 ? 48 : uTier > 0.25 ? 36 : 24;

  if (t0 < 1e8) {
    for (int i = 0; i < 48; i++) {
      if (i >= steps) break;
      float d = map(ro + rd*t);
      float dr = d / t;
      if (dr < dmin) { dmin = dr; tAt = t; }
      if (dr < EPS) break;
      // Under-relaxed. The handle is a rod a third of a unit across seen
      // at twenty units, and a full step against geometry that thin is how
      // a march overshoots the surface and stipples its own edge.
      t += d*0.85;
      if (t > 30.0) break;
    }
  }

  /* ---------------- where the blur is measured ----------------
     For a ray that HIT, at the hit. For a ray that MISSED — and every
     fragment of the soft silhouette is a ray that missed — the march's
     own record of where it came nearest is worthless here, and this cost
     a long afternoon to find because the symptom pointed at the wrong
     variable. dmin comes out clean: rendered on its own it is a set of
     smooth contours. tAt does not. The rays that graze the handle run
     about thirty degrees off its axis, so the distance field is nearly
     FLAT for two whole units along them and the argmin is settled by
     rounding — tAt jumps a whole march step between neighbouring pixels.
     It reaches cov only through the circle of confusion, swings it by a
     third, and what it drew was five faint concentric dotted rings round
     the butt of the handle, on every tier, at every width.

     So a ray that missed takes its depth from the GEOMETRY, which is
     analytic and therefore smooth: the closest approach of the ray to
     the handle's own axis segment, or to the centre of the head,
     whichever it actually passed nearer. Solve the pair, clamp the one
     that is bounded, re-solve the other — the same order the shaft of
     light needs, and for the same reason. The head candidate is not
     optional: drop it and the razor-sharp face picks up a nine-pixel
     bleed, because the axis segment starts three quarters of a unit
     behind it and the blur would be measured from there. */
  float tDof = tAt, dGeo = 0.0, wAxis = 0.0;
  vec3  pGeo = vec3(0.0);
  if (dmin > EPS) {
    vec3  A0 = ANCH + 0.20*AX, dA = buttP - A0, w1 = ro - A0;
    float cq = dot(dA, dA), bq2 = dot(rd, dA);
    float uu = clamp((dot(dA, w1) - bq2*dot(rd, w1)) / max(cq - bq2*bq2, 1e-4), 0.0, 1.0);
    vec3  Qa = A0 + dA*uu;
    float tA = max(dot(Qa - ro, rd), 0.05);
    float tH = max(dot(axisC - ro, rd), 0.05);
    vec3  eA = ro + rd*tA - Qa, eH = ro + rd*tH - axisC;
    float lA = dot(eA, eA), lH = dot(eH, eH);
    tDof = lH < lA ? tH : tA;

    /* And the SILHOUETTE itself, from the same three vectors, because it
       has exactly the same disease and a worse case of it.

       Out at the butt the bokeh is twenty pixels wide, and twenty pixels
       of coverage read off the minimum of a march that samples the ray
       every third of a unit is twenty pixels of sampling error. That is
       where the rings came from. Jittering the march's phase was tried
       first: it worked, in the sense that it proved the diagnosis — the
       rings became twenty pixels of speckle, which is worse. The error
       had to go, not be stirred.

       So where the blur is wide the coverage comes from the geometry.
       The handle is a tapered rod about a known axis, so the distance
       from a ray to its surface is closed form — distance to the axis,
       less the radius there — and the radius steps down to the shank in
       front of it so the crossfade has nothing to disagree with. Exact,
       smooth, about ten operations, and it makes coverage continuous
       across the hull boundary into the bargain. */
    if (lA <= lH) {
      float qx  = dot(Qa - ANCH, AX);
      float uh  = clamp((qx - HX0) / (HX1 - HX0), 0.0, 1.0);
      float rHa = mix(0.160, 0.372 - 0.060*uh, smoothstep(2.05, 2.60, qx));
      /* The ferrule and the ID ring stand proud of the taper, and this
         profile has to carry them or it is not the same rod. Left out,
         the shading point below lands INSIDE the collar it is meant to
         sit on; the normal there is the gradient of a field under its own
         surface, it swings about, and every so often it catches the lamp
         — so the ferrule grew a burst of white spikes. Only on a 4:5
         band, because that is the only aspect where the object recedes
         far enough for the crossfade to reach the collar at all, which is
         precisely why three widths get looked at rather than one. The
         knurl is left out on purpose: at 0.0072 deep it is a third of a
         pixel and putting it in would only alias. */
      rHa += 0.052 * smoothstep(2.52, 2.66, qx) * smoothstep(3.16, 3.02, qx);
      rHa += 0.026 * smoothstep(ID0, ID0 + 0.04, qx) * smoothstep(ID1, ID1 - 0.04, qx);
      dGeo  = max((sqrt(lA) - rHa) / tA, 0.0);
      wAxis = 1.0;
      // And the POINT to shade it at, which turned out to matter just as
      // much as the distance. A fragment on the soft edge is shaded at
      // the march's closest approach, and that position jumps a whole
      // step between neighbouring pixels for exactly the reason the
      // distance did — so fixing only the coverage left the rings
      // sitting there in the COLOUR instead, which is why they survived
      // a fix that should have worked. The nearest point on the rod is
      // the same three vectors again.
      pGeo  = Qa + eA * (rHa / max(sqrt(lA), 1e-4));
    }
  }

  /* ---------------- depth of field ----------------
     The thin-lens circle of confusion, about a focal plane sitting on
     the face. The entrance racks it in from behind, once. */
  float tFoc = length(Cw - ro) * mix(1.42, 1.0, e);
  /* The aperture rides with the FOCAL LENGTH, which is both physically
     right and the other half of the fix for the handle fogging out. At a
     fixed f-number the circle of confusion goes as the square of the
     focal length, and this band solves a different focal length per
     aspect — 1.204 at 21:9 down to 0.861 at 4:5. Held at one number the
     4:5 band, which also has the deepest subject because the instrument
     points away down its own length, got half as much again of blur as
     the 21:9 band that the number was tuned on. Tied to f, the butt of
     the handle comes out at 0.22 of blur at every width instead of 0.31,
     0.30 and 0.22, so the far end reads the same on a phone as on a
     desktop. Clamped, because a solve is not a guarantee. */
  float apr  = 0.082 * clamp(f / 1.204, 0.60, 1.05);
  float coc  = apr * abs(tDof - tFoc) / max(tDof, 0.2);
  /* The bleed, in world units at this depth, is cocE * tDof / f, and this
     caps it at 0.06 of a unit — a little over the height of the ferrule's
     own shoulder. That number is measured, not chosen.

     Coverage bled from the march's closest approach is only honest while
     it stays SMALLER THAN THE FEATURES IT IS BLEEDING PAST. The distance
     to a ribbed collar is lumpy — its nearest feature changes from the
     ferrule to the ID ring to a knurl crest as the ray turns — and a
     bleed five times the height of those ribs renders every one of those
     changeovers as a spike. What the 4:5 band grew was a ring of bright
     flat whiskers standing out of the collar, and they survived every
     other suspect: 260 march steps draw them as clearly as 24, a step of
     0.55 as clearly as 0.92, and switching off the knurl, the shank, the
     ID ring, the satin lobe and the lamp changed nothing. Pinning the
     bleed to the minimum removed them completely, which is what named it.

     Uncapped it reached a full unit out at the butt on a 4:5 band, where
     the focal length is shortest and the butt is furthest away. The
     bokeh it was giving up is paid for below instead, by dissolving the
     out-of-focus surface into the wall — which is a function of the
     surface's own depth rather than of a sampled minimum, and therefore
     has nothing to go lumpy. */
  float cocE = max(min(coc, 0.06 * f / max(tDof, 0.2)), 0.85*aa);
  /* The march's own minimum where the picture is sharp and it is good to
     a fraction of a pixel; the geometry out where the blur is wide and it
     is not. The crossfade sits over the stretch of handle where the two
     agree to well under a pixel, so there is no seam to find.

     And it is gated on the march having actually RUN, which is the whole
     lesson of the first attempt at this. The analytic distance is defined
     everywhere — that is the point of it — so handing it to cov
     unconditionally gave coverage to rays that never entered the hull.
     Those rays have no surface point: they shade at the march's unused
     initial depth, out in mid-air, off a normal taken four taps from
     nothing. The frame came back with a pale sheath four times the width
     of the handle wrapped round it. Coverage still stops at the hull; the
     hull is simply now wide enough that coverage has already reached zero
     by the time it gets there. */
  float wGeo = smoothstep(0.010, 0.026, coc) * wAxis;
  float dUse = t0 < 1e8 ? mix(dmin, dGeo, wGeo) : 1e9;
  float cov  = 1.0 - smoothstep(0.0, cocE, max(dUse - EPS, 0.0) * f);

  vec3 col = bg;

  if (cov > 0.002) {
    /* At tAt — the CLOSEST APPROACH — and not at t, which is where the
       march happened to stop.

       For a ray that hit they are the same value, because the loop breaks
       on the hit before it steps again. For a ray that MISSED they are
       not, and a ray that missed is the entire point of cov: the
       silhouette's soft edge is shaded from these fragments. Shading them
       at the final t put the sample metres past the instrument, out in
       the middle of the field, where the normal is whatever four taps of
       a distance function far from any surface happen to give — so the
       edge of the head came back with a scatter of near-black pixels
       round it. It was invisible on a desktop, where 48 steps land the
       two close together, and it dotted the whole silhouette on a phone
       at 24. One character, and it is the difference between a clean edge
       and a dirty one on the tier that can least afford to hide it. */
    vec3 pos = mix(ro + rd*tAt, pGeo, wGeo);
    vec3 N   = nrm(pos, max(0.0016*tDof, 0.0016));
    vec3 vq  = pos - gO;
    vec3 qh  = vec3(dot(vq,gAX), dot(vq,gBX), dot(vq,gCX));

    vec3  vh = qh - HCQ;
    float ah = dot(vh, NQF);
    vec3  th = vh - ah*NQF;
    float rh = length(th);
    float onHead = smoothstep(1.06, 1.00, rh) * smoothstep(0.17, 0.13, abs(ah));
    float isFace = onHead * smoothstep(0.004, 0.020, ah) * smoothstep(0.985, 0.940, rh);

    // The back of a mirror head is turned, not flat. Bowing the shading
    // normal out across it puts the dish there without costing the field
    // a single extra evaluation, and the silhouette stays a clean disc.
    vec3 thw = th.x*gAX + th.y*gBX + th.z*gCX;
    float back = onHead * smoothstep(0.004, -0.010, ah);
    N = normalize(N + thw * (0.66 * back));

    vec3  lvs = normalize(LMP - pos);
    vec3  rfl = reflect(rd, N);
    float ndv = max(dot(N, -rd), 0.0);
    float frs = pow(1.0 - ndv, 5.0);
    // A half vector is only degenerate if the lamp is exactly down the
    // view ray, which the rock can in principle reach. Guarded rather
    // than argued about.
    vec3  hq  = lvs - rd;
    vec3  hv  = dot(hq, hq) > 1e-8 ? normalize(hq) : N;
    float dif = max(dot(N, lvs), 0.0);
    /* Two separate softnesses out of one circle of confusion, and pulling
       them apart is what stopped the handle fogging out.

       BLUR is the picture one: the big soft highlight, and the dissolve
       toward the wall further down. Its ramp used to run to 0.070, which
       on a 4:5 band — where the instrument points almost straight away
       from the lens and the depth range is three to one — reached 0.82 at
       the butt. Eighty-two per cent, spent on a 0.52 dissolve into the
       wall and a graze cull with no floor under it, is a handle that
       disappears into fog a long way short of the frame edge. That was
       the note. The ramp now runs to 0.115 and the two terms it feeds are
       gentler, so the far end of the handle SOFTENS — which is what a
       shallow lens does — rather than evaporating.

       SOFT is the reflection lobe, and it is not the same number. A
       surface that is out of focus is one whose microstructure is not
       being resolved, so what it returns is an average over a cone. It
       had to exist: the knurl is seven thousandths of a unit deep, which
       is nothing, but it swings the reflected ray across the studio's
       horizon and back once per groove, and the bokeh then smears every
       one of those crossings sideways past the silhouette — a fan of
       bright dashes standing off the collar like whiskers. It is not the
       march; 48 steps draw them as clearly as 24. A groove finer than the
       blur circle is not a groove any more, and this is what says so. It
       keeps its own short ramp, because widening BLUR to save the handle
       would otherwise have taken the whiskers back out of retirement. */
    float blur = smoothstep(0.0055, 0.115, coc);
    float soft = smoothstep(0.0040, 0.060, coc) * 0.34;

    /* Occlusion from the field itself, along the normal: one tap
       everywhere, a second on a desktop. The march's own step count was
       tried here first and taken straight out again — a step count is an
       INTEGER, so what it draws is a contour map of itself, and the back
       of the head came back looking like sawn wood. Two taps of the
       field are continuous and cost less than that artefact did. This is
       the shade in the knurl valleys and in the corner where the shank
       meets the collar, and it is the only thing in the frame that says
       those two parts are separate. */
    float ao = clamp(map(pos + N*0.14)/0.14, 0.0, 1.0);
    if (uTier > 0.75) ao = 0.5*ao + 0.5*clamp(map(pos + N*0.38)/0.38, 0.0, 1.0);
    ao = mix(ao, 1.0, 0.28);

    /* ---- surgical stainless ----
       Metal has NO diffuse term: its colour is what it reflects, tinted
       by its own reflectance, going to a plain mirror at grazing angles
       because that is what Fresnel does. So the steel is a picture of the
       STUDIO — the sweep as a hard bright band down the top of the rod,
       the horizon as the dark line under it, the floor giving a little
       back beneath that. That is what makes a rod read as steel. Pointing
       it at the house violet instead is what made this one read as a
       lilac plastic handle. */
    /* And the steel gets the SAME lookup as the face, wall included, which
       is the second half of the repair and the one that was easy to miss.

       A rod pointing away from the lens is seen at grazing incidence
       everywhere, so reflect(rd, N) comes back very nearly parallel to the
       view ray: a chrome rod pointing away from you shows you what is
       BEHIND it. On a 4:5 band the instrument does point away down its own
       length, so the whole handle was reflecting the one direction the
       studio makes darkest — down and away — and it rendered as black
       enamel while the same handle at 21:9, lying across the sweep, was
       bright steel. Same object, two materials, which is the failure this
       set keeps being sent back for.

       What is actually behind it is the wall, so that is what it returns.
       Half as much of it as the face takes, because the handle is grained
       rather than polished and because a rod that takes all of a lavender
       wall is the lavender plastic tap in the brief. */
    vec3 env  = seen(pos, rfl, lvs, soft, 0.52);
    vec3 F    = STEEL + (1.0 - STEEL)*frs;
    vec3 surf = F * env;
    // The satin lobe. An instrument handle is not a chrome ball — it is
    // lightly grained, so the lamp also lands on it as a broad soft band
    // that a single reflected direction cannot give on its own.
    float sat = pow(max(dot(N, hv), 0.0), mix(58.0, 7.0, blur));
    surf += LAMPC * STEEL * sat * mix(0.60, 0.22, blur);

    // The reverse of a mirror head is a turned dish with a raised rim,
    // and both matter: without them the back of it comes round twice a
    // loop as a flat disc with nothing on it.
    surf *= 1.0 + back * (smoothstep(0.78, 0.86, rh)*0.24 - smoothstep(0.86, 0.94, rh)*0.28);
    // and the marks the tool left crossing it, which is the one thing
    // that says the back is turned steel rather than pressed.
    if (uTier > 0.25) surf *= 1.0 + back * 0.016 * cos(rh*26.0) * smoothstep(0.90, 0.58, rh);

    // Occlusion, and it goes toward the room's own dark rather than toward
    // black: a crease in a lit room is full of bounce. The bounce carries
    // a little of the house violet, because that is the wall the
    // instrument is standing in front of — a tint, at eight per cent, not
    // a violet painted into every shadow on the object.
    surf = surf * mix(0.30, 1.0, ao) + mix(uInk, uColors[1], 0.70) * (1.0 - ao) * 0.08;

    /* ---- the silicone ID ring ----
       The one dielectric on the instrument, and the only saturated
       colour in the frame. A practice colour-codes its tray sets with
       these; it takes the room as LIGHT rather than reflecting it, which
       is the whole visible difference between a moulded collar and the
       steel either side of it. */
    float idr = smoothstep(ID0 + 0.005, ID0 + 0.050, qh.x)
              * smoothstep(ID1 - 0.005, ID1 - 0.050, qh.x);
    if (idr > 0.002) {
      // The one diffuse surface on the instrument, so it is the one thing
      // that takes the HOUSE ambient rather than the studio: a moulded
      // collar is lit by the room the page is in.
      vec3 amb = ambHouse(N)*0.70 + ambHouse(vec3(0.0, 1.0, 0.0))*0.22;
      vec3 sil = SILIC * (amb + LAMPC * 0.85 * dif);
      sil += LAMPC * pow(max(dot(N, hv), 0.0), mix(26.0, 6.0, blur)) * 0.17;
      surf = mix(surf, sil, idr);
    }

    /* ---- the face itself ----
       Front-surface rhodium, and slightly concave the way a magnifying
       mouth mirror is, so the reflected rays converge and what comes back
       arrives stretched, with the studio's horizon curving across it and
       the operating lamp in it as a hard white oval. One ray-plane hit.
       RHOD is 0.77 rather than 1.0, and that is the difference between a
       mirror and a white disc: a mirror is always a little darker than
       the room it is showing you.

       And what it shows is the STUDIO. That is the whole repair. The face
       is the largest single shape in this frame at every width, it has no
       colour of its own, and pointing it at a violet wall turned the
       subject of the band into a violet disc with no image in it. */
    if (isFace > 0.001) {
      /* The concavity, raised from 0.52 to 0.80. A magnifying mouth mirror
         really is dished — two-times is a common specification — and the
         dish is what guarantees the picture rather than decorating it: it
         fans the reflected rays about thirty-eight degrees either side of
         the centre, so across one face the studio is sampled through
         seventy-six degrees. That is wide enough for the floor, the
         horizon, the sweep and the sweep's far edge to land somewhere on
         the disc at EVERY angle of the rock and at every width. A flatter
         face returns one patch of the studio, and one patch of anything
         is a flat disc. NQF is a unit vector perpendicular to th, so the
         sum can never be zero and this normalize is safe by construction
         rather than by luck. */
      vec3 nqe = normalize(NQF - 0.80*th);
      vec3 Nf  = nqe.x*gAX + nqe.y*gBX + nqe.z*gCX;
      vec3 rr  = reflect(rd, Nf);
      vec3 fc  = RHOD * seen(pos, rr, lvs, 0.0, 0.70);
      // The shade the bezel casts on the glass, and the lit lip of the
      // bezel itself — the two lines that say this is set into something.
      fc = mix(fc, fc*0.62 + vec3(0.042, 0.040, 0.048), smoothstep(0.86, 0.945, rh));
      fc = mix(fc, STEEL * roomBase(N, 0.0) * 1.30, smoothstep(0.930, 0.962, rh) * 0.70);
      surf = mix(surf, fc, isFace);
    }

    // A shoulder on the top of the range. Below 0.8 nothing moves.
    surf = shoulder(surf);

    /* Out of focus is also out of contrast: the far end of the handle
       loses a little into the wall behind it, and thins toward its own
       silhouette where the normal grazes.

       A LITTLE. Both of these terms were set on a 21:9 band, where the
       instrument lies nearly across the frame and nothing is more than a
       stop out, and both were ruinous on a 4:5 one, where it points down
       its own length. A 0.52 dissolve and a graze cull with no floor
       under it between them took the butt of the handle to about a third
       of its own coverage in a wash of wall colour, which is what "the
       handle dissolves into fog before the frame edge" was. 0.26 and a
       0.42 floor keep it whole, and it still reads as out of focus,
       because the highlight has already gone soft and wide by then. */
    surf = mix(surf, bg, blur*0.26);
    float graze = abs(dot(N, rd));
    cov = min(cov, mix(1.0, clamp(graze*2.6 + 0.42, 0.0, 1.0), blur));

    col = mix(col, surf, clamp(cov, 0.0, 1.0));
  }

  // A little tooth, so the long wash down the wall never bands on a
  // cheap panel — which is the only sort of panel this will be seen on.
  col += (hash21(gl_FragCoord.xy + fract(uTime)*71.0) - 0.5) * 0.016;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export const scene: Scene = {
  frag,
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
