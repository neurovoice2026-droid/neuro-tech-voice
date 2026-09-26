import type { Scene } from "../shader-stage";

/* ------------------------------------------------------------------ *
 * Auto sales & service — the brake assembly, going together.
 *
 *   the object   a front brake: a cross-drilled vented disc, the caliper
 *                that straddles its rim on its carrier with a pad
 *                against each face, five studs on the hub and the
 *                five nuts that go on them. Not a decorative stand-in —
 *                it is the part that is on the bench when the phone
 *                rings, and the reason the customer is standing
 *                somewhere without their car while they ring.
 *
 *   the motion   it ASSEMBLES. The parts drift in, decelerating the way
 *                a placed part does; the disc first, the caliper closing
 *                over its rim second, and the nuts last — which travel
 *                in along the studs' own radii, then turn as they thread
 *                down. It holds seated for a beat, then releases in the
 *                reverse order, the nuts unwinding as they go. Thirteen
 *                seconds, and nothing in it is linear: everything
 *                arrives on a cubic ease-out and leaves on a cubic
 *                ease-in.
 *
 *   the camera   one slow arc about the axle, a single cosine so the
 *                loop has no seam. Its phase is the composition: the
 *                camera is near EDGE-ON while the disc slides in and the
 *                caliper closes over its rim — which is the only angle
 *                at which a clamp round a rim reads as a clamp — and has
 *                swung round to near FACE-ON by the time the five nuts
 *                thread down, which is the only angle at which five
 *                parts converging reads as five parts converging. Then
 *                it swings back while the thing comes apart.
 *
 * WHERE IT STANDS. The disc is on a BENCH, and it touches it.
 *
 *   Before this pass the whole brake hung in a violet room with a soft
 *   patch painted on the wall behind it. A painted patch is not a shadow
 *   and a reader knows it at a glance: nothing in the frame said how far
 *   away the wall was, which way was down, or what a twelve-kilo rotor
 *   was resting on. There is a surface now, at y = -1, which is the
 *   disc's own rim radius below its axle — so the seated disc STANDS ON
 *   IT, on the bottom of its friction ring, for the seventy-two per cent
 *   of the loop that the assembly is home.
 *
 *   The mark under it is made of three things and none of them is
 *   painted. The rotor's own shadow is the ray from each patch of bench
 *   toward the key, intersected with the DISC'S OWN PLANE: a true
 *   ellipse, at the disc's true angle, under the disc wherever the disc
 *   is, with a penumbra that opens with the gap between caster and bench
 *   and is therefore a knife edge exactly where the rim lands. The
 *   ambient the bench has lost is one evaluation of the rotor's field —
 *   black in the last centimetre, open and pale a hand's width away. And
 *   on the iron itself, the edge light dies in the last quarter unit
 *   above the bench, because a lit edge running under a disc is a line
 *   of daylight between it and the floor, and a line of daylight there
 *   is the one thing that makes a render look pasted on.
 *
 *   Everything in it is world-space and tier-free, so the contact is the
 *   same construction at 390, 820 and 1440 and on a phone that never
 *   gets a shadow ray. Measured on the live page, the darkest pixel
 *   under the rim is 40 at 1440, 38 at 820 and 37 at 390 against a bench
 *   of 185, 188 and 189 a disc-radius away — and it is lifted off its
 *   own 7 by the kicker's scrim, which veils the bottom two fifths of
 *   every one of these bands with white and is not this file's to move.
 *
 * WHAT CAME APART HERE AND WAS FIXED, because each of these shipped once:
 *
 *   the caliper in mid-air. It hung beside the disc with 0.028 of
 *   daylight on each side of the rim, nothing holding it, and nothing of
 *   it on the iron: a red clamp that touched no part of the brake it was
 *   closed over. It has its pads now, which shut that slot and carry it
 *   on the disc, and its CARRIER — the anchor bracket a caliper is
 *   bolted to, an arm round the outside of the rim at each end of the
 *   pad and a lug off each arm reaching back inboard to its mounting
 *   bolt.
 *
 *   the caliper bolted to the rotor, which is what the fix above bought
 *   and it was worse than what it replaced. The carrier's lugs came back
 *   inboard on the +z side — the HUB side, the side the studs and the
 *   nuts are on, the side the camera is on for the whole loop — so two
 *   ears stood a fifth of a unit proud of the swept face with their bolt
 *   heads pointing at the lens, bolted to nothing, and the other ends
 *   finished in air. A caliper is bolted to a bracket that is fixed to
 *   the upright; the rotor turns and the caliper does not, and a bolt
 *   into a friction face is the one thing in a brake that cannot exist.
 *   Both lugs are behind the disc now, and behind them is the bracket
 *   they bolt into: a cross member from boss to boss and a stem off it
 *   running inboard to radius 0.42, where it passes behind the hat and
 *   out of the picture toward the upright. Nothing of it is within 0.26
 *   of the iron. The bolt heads are hidden by the rotor for most of the
 *   loop, which is exactly where a car keeps them — the frame they were
 *   visible in was the frame that had them screwed into the disc.
 *
 *   the empty band. The parts used to fly clean out of the frame, so for
 *   about a second of every loop a reader arriving at the wrong moment
 *   found a blank violet band with one nut in the corner — a render that
 *   had stopped halfway. Nothing leaves the frame now. The disc backs
 *   off along the CAMERA's own axis: it recedes to two thirds of its
 *   size and drifts, which reads as "apart" at every aspect ratio and
 *   needs no width to do it in. That matters most on a 4:5 phone band,
 *   where the disc is already two thirds of the picture and there is no
 *   lateral room to leave by at all. The exploded state is now a
 *   picture in its own right: the whole brake, in pieces, named.
 *
 *   the tablet. `uTier > 0.5 ? 48 : 24` gives a tablet — uTier 0.5 —
 *   twenty-four steps, the phone's budget, on a screen with a desktop's
 *   pixel count. There are three tiers and the ladder now says so.
 *
 *   the wood grain. The cast iron came back with sweeping tree-ring
 *   contours across its face, on the desktop tier only. It was not the
 *   turned finish and it was not the normal: it was the shadow ray
 *   reading a BOUND as a distance. The whole story is at BOUND_GATE
 *   below, and the fix made the scene faster as well as clean.
 *
 *   the violet ball. The first cut of this file handed its own bounding
 *   sphere back at a distance under the march's hit epsilon, so the
 *   march hit the BOUND: what shipped was a violet ball with the disc's
 *   shading painted over it. Every bound in here is returned only while
 *   it is unmistakably larger than any epsilon, and every one of them is
 *   CONSERVATIVE — sized off the parts' own corner-to-centre distances
 *   rather than off a guess, because a bound tighter than the thing
 *   inside it is a hole the march walks through.
 *
 *   the polygon. A disc came back with straight chords and visible
 *   corners round its edge — about twenty flats, worst on a phone. The
 *   geometry was never guilty: every radius here is a length(p.xy), and
 *   the coverage mask measures round to a fifth of a pixel at every
 *   buffer size the page uses and at every moment of the loop. What was
 *   polygonal was the edge a reader SEES. The rim's own marks — twenty
 *   seven vent slots and two bright lips — were being drawn at full
 *   strength on a band that foreshortens to less than a pixel the moment
 *   the disc turns toward the camera, so the outermost pixels came out as
 *   a chain of black and bright beads, and a circle made of beads is read
 *   as a polygon. They are now weighted by the width they are actually
 *   drawn at, and below a pixel they fade to the average they would have
 *   integrated to. The whole story is at the vents below.
 *
 * COLOUR. The room is the site's; the object is its own.
 *
 *   The wall behind it, the pool of light on it, the strip light that
 *   crosses it, the tint in every shadow and everything the metal
 *   reflects are uColors and uInk — house violet, which is what keeps
 *   sixteen bands reading as one website.
 *
 *   Nothing in the object is violet. A brake disc is CAST IRON: a warm
 *   mid grey, going to a light oxide within a day of being unwrapped on
 *   everything the pads never touch, and machined bright silver in the
 *   band they do. A caliper is PAINTED, and the colour it is painted is
 *   red. Wheel nuts are ZINC-PLATED: cool, bright, near white. The studs
 *   they go on are black phosphate, which is why the nuts read as five
 *   separate things arriving rather than as the hub growing lumps. Four
 *   literals, three materials, and each one is what the part is.
 *
 * How it is made, and what it costs. One distance field, one march per
 * fragment — 48 steps on a desktop, 36 on a tablet, 24 on a phone — and
 * it breaks on a hit and on the far plane rather than running to the
 * cap. The five studs and nuts are one shape folded five ways about the
 * axis, so there is one hex prism in the shader rather than five, and
 * the fold is EXACT because everything the nuts do — travel along their
 * radii, thread down their studs, turn about their own centres — is
 * axisymmetric. Off the march: a four-tap normal, one key light, a
 * bounce, a Fresnel edge, occlusion from one distance tap (two above the
 * phone), and — desktop only, and the first thing uTier takes off — a
 * single sixteen-step shadow ray. No nested march.
 *
 * The march also remembers its closest approach in PIXELS, which is the
 * whole of the edge antialiasing: a ray that missed by half a pixel is
 * shaded where it came nearest and blended in by how near it came, so
 * round parts have soft silhouettes without a second sample anywhere.
 *
 * The detail that is not geometry is not marched: the cross-drilled
 * holes, the turning marks in the swept band, the vents in the rim and
 * the cast ribs on the caliper are all resolved once at the hit point
 * from the surface's own local coordinates. A hole that costs one atan
 * per fragment is worth having; one that costs an atan per step is not.
 *
 * Two things had to be un-learned to stop it looking like a plastic toy.
 * The step count is NOT used for occlusion — it is an integer, so it
 * draws a contour map of itself across a flat face, and the disc came
 * back looking like sawn wood. And the light must not ramp from dark to
 * near-white: it ramps from each material's own ambient to its own
 * albedo, and only the top of the range lifts toward the light, because
 * a ramp that runs to white lifts an inked drill hole to the same tone
 * as the iron round it and erases every mark in the albedo.
 *
 * Framing, which is what killed two earlier generations. The object's
 * vertical extent is fixed — the disc's own y axis lies in the image
 * plane whichever way the camera has arced to — so the field of view is
 * solved against the band's HEIGHT: the bottom fifth is paper the kicker
 * sits on, the top is under a docked header, and the frame is centred on
 * the middle of the object's own extent rather than on its axis, because
 * the caliper and its hose union reach a third of a unit further up than
 * the disc reaches down. The camera pulls back on the narrow band rather
 * than letting the frame crop the object. What changes with the aspect:
 * the parts come apart three times as far sideways on a 21:9 band, and
 * the whole assembly moves to 62% of the width, which leaves the kicker
 * the open left and gives the parts a width to come apart in.
 * ------------------------------------------------------------------ */

const frag = `
#define PI  3.14159265
#define K5  1.25663706            /* a fifth of a turn */
#define FAR 11.5

/* How far outside a bounding volume the march is willing to trust the
   BOUND instead of evaluating what is inside it.

   This number was 0.05 and it was the bug that took longest to find,
   because it did not look like a bug in the field at all — it looked
   like the cast iron had a WOOD GRAIN in it. Sweeping tree-ring
   contours, all over the disc face, at every camera angle, and only on
   the desktop tier.

   A bound makes map() discontinuous on purpose: step across the gate and
   the answer jumps from 0.05 to whatever the real distance is, which
   near this disc is a quarter of a unit. The primary march does not care
   — the value is always an UNDERESTIMATE, so it never overshoots, it
   just takes one short step and then a long one. But the shadow ray's
   penumbra estimate is min(k*h/t), and that reads h as a real distance.
   Every ray that crossed a gate had one sample quantised to 0.05, and
   the set of shading points whose ray crossed the gate at a given t is a
   CONTOUR — so the bounding sphere of the disc and the two tori round
   the hub got drawn onto the disc, as grain.

   0.18 is the number that makes them invisible: the shadow ray stops at
   t = 1.10 and its k is 6, so k*h/t at the gate is never below 6*0.18 /
   1.10 = 0.98, and a penumbra factor of 0.98 is not a mark. It is also
   FASTER than 0.05 was, which was the surprise: a bound handed back at
   0.05 makes the march crawl through the shell around it in twenty short
   steps, and one handed back at 0.18 strides through it in six. The
   extra field evaluations cost less than the steps they save. */
#define BOUND_GATE 0.18

/* The bench top. Not a number chosen to look right: it is the rotor's own
   rim radius, negated, because a disc stood on edge touches the bench at
   exactly one radius below its axle and the axle is the origin of this
   scene. The seated disc therefore TOUCHES this plane — along a line, the
   way a cylinder on its side does — for the seventy-two per cent of the
   loop that the assembly is home, and it is the same plane and the same
   line at every width, because there is not an aspect ratio anywhere in
   this paragraph or in the code that uses it. */
#define GROUND (-1.000)

/* ---- the object's own colours. Literals, because a brake is not
   violet: it is iron, paint and zinc, and the violet in this frame is
   the room it is standing in. ---- */
const vec3 IRON    = vec3(0.395, 0.378, 0.360);  // as-cast iron, faintly warm
const vec3 IRON_M  = vec3(0.665, 0.660, 0.668);  // the swept band, machined bright
const vec3 IRON_OX = vec3(0.372, 0.240, 0.152);  // the oxide on everything unswept
const vec3 RED     = vec3(0.742, 0.146, 0.106);  // caliper paint
const vec3 RED_D   = vec3(0.455, 0.070, 0.056);  // the same paint in the cast hollows
const vec3 ZINC    = vec3(0.782, 0.798, 0.830);  // zinc-plated nut: cool, bright
const vec3 STEEL_D = vec3(0.228, 0.228, 0.248);  // black-phosphate stud, and the union

/* ---- the animation state, resolved once per fragment and read by the
   field. Globals rather than arguments: map() is called fifty-odd times
   a pixel and none of this changes between calls. ---- */
vec3  gRotP;  mat3 gRotM;         // disc: world centre, world -> local
vec3  gCalP;  mat3 gCalM;         // caliper: the same
float gNutR;                      // how far the nuts still are from their studs
float gNutZ;                      // and how high above them
float gNutC, gNutS;               // cos/sin of their thread angle

float hash(vec2 p){
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

/* ---- primitives. Exact fields: an approximate one overshoots, and an
   overshoot in a march is a hole through the middle of a part. ---- */
float sdCylZ(vec3 p, float r, float h){
  vec2 d = vec2(length(p.xy) - r, abs(p.z) - h);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}
float sdCylY(vec3 p, float r, float h){
  vec2 d = vec2(length(p.xz) - r, abs(p.y) - h);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}
/* A rounded annulus about z — a rounded box in (radial, axial) revolved.
   Every round thing in this file is one of these. */
float sdRingZ(vec3 p, float rm, float w, float h, float rd){
  vec2 d = vec2(abs(length(p.xy) - rm) - w + rd, abs(p.z) - h + rd);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - rd;
}
float sdBox3(vec3 p, vec3 b){
  vec3 d = abs(p) - b;
  return min(max(d.x, max(d.y, d.z)), 0.0) + length(max(d, 0.0));
}
float sdRBox(vec3 p, vec3 b, float r){
  vec3 d = abs(p) - b + r;
  return min(max(d.x, max(d.y, d.z)), 0.0) + length(max(d, 0.0)) - r;
}
float sdHexZ(vec3 p, float r, float h){
  const vec3 k = vec3(-0.8660254, 0.5, 0.5773503);
  p = abs(p);
  p.xy -= 2.0 * min(dot(k.xy, p.xy), 0.0) * k.xy;
  vec2 d = vec2(length(p.xy - vec2(clamp(p.x, -k.z * r, k.z * r), r)) * sign(p.y - r),
                p.z - h);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

mat3 eul(vec3 a){
  vec3 c = cos(a), s = sin(a);
  mat3 rz = mat3( c.z, s.z, 0.0, -s.z, c.z, 0.0,  0.0, 0.0, 1.0);
  mat3 rx = mat3( 1.0, 0.0, 0.0,  0.0, c.x, s.x,  0.0,-s.x, c.x);
  mat3 ry = mat3( c.y, 0.0,-s.y,  0.0, 1.0, 0.0,  s.y, 0.0, c.y);
  return ry * rx * rz;
}

/* ---- the disc ----
   A vented rotor is a top hat: the friction ring out at the rim, a web
   plate set back from it, the hat barrel, the hub face, and the bore
   through the middle. Five shapes and one subtraction, all exact. */
float sdDisc(vec3 p){
  float d = sdRingZ(p, 0.800, 0.200, 0.048, 0.007);                            // friction ring
  d = min(d, sdRingZ(p - vec3(0.0, 0.0, 0.050), 0.500, 0.150, 0.026, 0.005));  // web
  d = min(d, sdRingZ(p - vec3(0.0, 0.0, 0.160), 0.400, 0.045, 0.115, 0.004));  // hat
  d = min(d, sdCylZ (p - vec3(0.0, 0.0, 0.268), 0.480, 0.030));                // hub flange
  d = max(d, -sdCylZ(p - vec3(0.0, 0.0, 0.200), 0.155, 0.420));                // bore
  return d;
}

/* ---- the studs and the nuts, separately ----
   Five of each, drawn as ONE and folded about the axis. The fold is
   exact because everything that moves here moves axisymmetrically — the
   nuts come in along their own radii and turn about their own axes, so
   no nut ever leaves its fifth of the circle.

   Returned as a pair rather than a min, because the shading needs to
   know which of the two it landed on: a stud is black phosphate and a
   nut is bright zinc, and collapsing them into one material is what
   made five nuts arriving read as the hub growing lumps.

   The fold sits on the studs' own 36-degree phase. With five bolts
   something is always near the vertical; 36 degrees is the offset that
   puts the furthest one at 0.951 of the stud radius rather than at 1.0,
   so no nut ever climbs above the disc's own silhouette and none of
   them is thrown straight down into the paper the kicker is printed on. */
vec2 hubParts(vec3 p, float rr){
  float a = atan(p.y, p.x + 1e-6) - 0.62832;
  a -= K5 * floor(a / K5 + 0.5);
  vec2  f = vec2(cos(a), sin(a)) * rr;

  /* The stud circle is 0.335 of the disc's own radius, which is what a
     5x114 hub on a 280mm disc actually is, and the nut is sized off it
     rather than off the frame. An earlier cut put a 0.118 nut on a 0.200
     circle: adjacent nuts touched, the fold stopped being exact at the
     wedge boundary, and the middle of the picture was a lumpy rosette
     rather than five nuts with daylight between them. */
  float ds = sdCylZ(vec3(f.x - 0.335, f.y, p.z - 0.400), 0.038, 0.105);
  vec3  n  = vec3(f.x - (0.335 + gNutR), f.y, p.z - gNutZ);
  n.xy = vec2(gNutC * n.x - gNutS * n.y, gNutS * n.x + gNutC * n.y);
  /* A hex prism intersected with a sphere: that one length() is the
     chamfer round the corners and the top edge, and it is the whole
     difference between a wheel nut and a die. Seen face-on the flats
     still read as a hexagon; seen from an angle — which is most of this
     loop — the corners catch the light the way a turned chamfer does
     instead of going square. The sphere is wider than the flats, so it
     takes the corners and leaves the hexagon. */
  return vec2(ds, max(sdHexZ(n, 0.098, 0.078), length(n) - 0.116));
}

float sdHub(vec3 p){
  /* Two TORUS bounds before the fold, so the march can step past the
     whole hub ring for the price of two square roots while the nuts are
     still out at their exploded radius. The tube radii are the parts'
     own corner-to-centre distances and not a guess: a stud is 0.038 by
     0.105 about its axis, so its corner is 0.1117 out and 0.115 bounds
     it; a nut is a 0.098 hexagon chamfered by a sphere of 0.116, so
     nothing on it is further than 0.116 out and 0.140 bounds it. A torus any tighter is a
     bound that culls the thing it is bounding and lets the march walk
     straight through the end of a stud. */
  float rr = length(p.xy);
  float bS = length(vec2(rr - 0.335, p.z - 0.400)) - 0.115;
  float bN = length(vec2(rr - (0.335 + gNutR), p.z - gNutZ)) - 0.140;
  float b  = min(bS, bN);
  // BOUND, not surface. See BOUND_GATE below for why the gate is 0.18
  // and not the 0.05 it was.
  if (b > BOUND_GATE) return b;
  vec2 h = hubParts(p, rr);
  return min(h.x, h.y);
}

/* ---- the caliper, the pads, and the carrier it is bolted to ----
   A body with a U cut out of it so it straddles the rim: the slot takes
   out everything within the disc's own thickness inboard of the bridge,
   which leaves two ears over the faces and the bridge joining them
   outside the rim. Then the piston housings bulging off both ears, and
   the union for the flexi hose on top.

   AND THEN THE TWO THINGS THAT MAKE IT A BRAKE RATHER THAN A CLAMP HELD
   IN MID-AIR. What shipped was a caliper that touched nothing and hung
   off nothing:

     THE PADS fill the slot. The ear's inner face is at 0.076 and the
     disc's own face is at 0.048, so the clamp had 0.028 of daylight on
     each side of the rim — it never made contact with the disc it was
     closed over, and a part that touches nothing can neither be seated
     nor mark what it is seated on. The plates run 0.046 to 0.078: two
     thousandths INTO the iron under them and two into the ear over them,
     so the slot is shut at every camera angle, the caliper is carried on
     its pads, and the occlusion has a real contact to find.

     THE CARRIER is what holds it there. A caliper is bolted to an anchor
     bracket that straddles the disc: an arm at each end of the pad that
     passes round the OUTSIDE of the rim — clear of it by 0.112, as the
     bridge is by 0.140 — and a lug off each arm reaching back inboard,
     BEHIND the disc, to the boss its mounting bolt goes through, and
     then the bracket that boss lands on.

   Which side "inboard" is on was got wrong once and it is the whole of
   why this part had to be rebuilt twice. The hat, the studs and the five
   nuts are at +z, so +z is the wheel side, and it is the side the camera
   is on at every point of the arc. Lugs at +z therefore stand between
   the lens and the swept face with their bolts pointing out of the
   frame: two ears bolted to a rotor, which is the one joint a brake
   cannot have, because the rotor turns and the caliper does not. They
   are at -z now. The rotor hides them, which is what a rotor does, and
   the mark they used to throw on the swept band is gone with them —
   that mark was the wrong part of the fix and the shadow this frame
   actually wanted was the one it did not have at all, on the ground.

   The arm and the lug are folded about the caliper's own centreline:
   they are symmetric, the fold is exact because no part of either
   crosses y = 0, and there is one of each in the shader rather than two.
   The bracket is the one piece that cannot be folded — it spans from one
   lug to the other, so it crosses the centreline by definition — and it
   is two plain boxes for that reason.

   None of it moves the object's extents, which is what the whole frame
   is solved against. The body's own corner is still the highest point in
   this scene at y = 1.24; the bracket's highest corner is 0.920 seated
   and never clears 0.94 at any point of the tumble on the way out, and
   its lowest is 0.21, which is a unit and a fifth above the bench. */
float sdCaliper(vec3 p){
  /* The proportions are the whole of whether this reads as a caliper.
     An earlier cut was 0.34 deep radially and 0.38 long tangentially —
     square — and seated at 0.935 on a disc of radius 1.0, so half of it
     lay INSIDE the friction band and the picture was a red box parked on
     a disc. A caliper is the other way round: short in the radial
     direction, long round the arc of the rim, and hung so the bridge
     clears the rim outside it. 0.26 by 0.40, seated at 1.00, spanning
     0.74 to 1.26 — over the outer quarter of the swept band and past the
     edge. */
  float d = sdRBox(p, vec3(0.260, 0.400, 0.150), 0.028);
  // The U. It takes out everything within the disc's own thickness
  // inboard of the bridge, which leaves an ear over each face and the
  // bridge joining them clear OUTSIDE the rim. The cut box is placed so
  // the bridge left standing is 0.12 thick: an earlier one left 0.04,
  // which at this scale is no bridge at all.
  d = max(d, -sdBox3(p - vec3(-0.360, 0.0, 0.0), vec3(0.500, 0.520, 0.076)));
  d = min(d, sdCylZ(vec3(p.x + 0.040, p.y, abs(p.z) - 0.168), 0.118, 0.052));
  d = min(d, sdCylY(p - vec3(0.060, 0.462, 0.000), 0.036, 0.100));
  // The pads, folded about the disc's own plane. They close the slot on
  // the rim: 0.046 to 0.078, into the iron below and the ear above.
  d = min(d, sdRBox(vec3(p.x + 0.135, p.y, abs(p.z) - 0.062), vec3(0.125, 0.380, 0.016), 0.012));
  /* The carrier, folded about the caliper's centreline. The arm passes
     round the rim at 1.112 to 1.202 — inside the union's 0.096 by a clear
     0.016 and outside the disc's 1.001 — and the lug comes back inboard,
     BEHIND the disc, to the bolt boss at radius 0.715.

     Every z here is negative, and that sign is the whole of the fix. The
     hub, the studs and the nuts are at +z, so +z is the wheel side and it
     is the side the camera is on all loop. The lug and its boss were on
     that side: they stood a fifth of a unit proud of the swept face with
     their bolt heads pointing at the lens, which is a caliper bolted to
     the spinning rotor. They are on the -z side now, which is where an
     upright is, and the disc hides them exactly as a rotor hides a real
     carrier. */
  vec3 q = vec3(p.x, abs(p.y) - 0.436, p.z);
  d = min(d, sdRBox(q - vec3( 0.157, 0.0,-0.050), vec3(0.045, 0.038, 0.222), 0.018));
  d = min(d, sdRBox(q - vec3(-0.090, 0.0,-0.230), vec3(0.250, 0.032, 0.050), 0.016));
  d = min(d, sdCylZ(q - vec3(-0.285, 0.0,-0.280), 0.055, 0.030));
  /* And the bracket the two bosses land on, which is what the bolts go
     INTO. It is one casting in two pieces of arithmetic: a cross member
     lying behind the disc from boss to boss — its face at z = -0.308 is
     the face the bosses end on at -0.310, so the joint is a contact and
     not a coincidence — and a stem off the middle of it running inboard
     to radius 0.42, where it passes behind the rotor's hat and out of the
     picture toward the upright it is fixed to. Nothing on it is within
     0.26 of the iron: the rotor turns and the bracket does not. */
  d = min(d, sdRBox(p - vec3(-0.285, 0.0,-0.350), vec3(0.092, 0.462, 0.042), 0.020));
  d = min(d, sdRBox(p - vec3(-0.430, 0.0,-0.364), vec3(0.150, 0.150, 0.050), 0.022));
  return d;
}

float map(vec3 p){
  vec3  lp = gRotM * (p - gRotP);
  float br = length(lp) - 1.16;          // conservative: the disc reaches 1.001
  float d  = br > BOUND_GATE ? br : sdDisc(lp);
  d = min(d, sdHub(lp));
  // Conservative: with its carrier and the bracket under it the caliper
  // now reaches 0.728, at the inboard corner of the bracket stem — it was
  // 0.664 at the lip of a bolt boss, and 0.66 against a reach of 0.574
  // before that. A bound tighter than the thing inside it is a hole the
  // march walks through, so this one keeps the same margin the last one
  // had: 0.09 of clear air outside the furthest corner.
  float bc = length(p - gCalP) - 0.82;
  d = min(d, bc > BOUND_GATE ? bc : sdCaliper(gCalM * (p - gCalP)));
  return d;
}

vec3 normalAt(vec3 p){
  vec2 k = vec2(1.0, -1.0) * 0.0016;
  return normalize(k.xyy * map(p + k.xyy) + k.yyx * map(p + k.yyx)
                 + k.yxy * map(p + k.yxy) + k.xxx * map(p + k.xxx));
}

/* One short ray at the key light, sixteen steps, breaking on contact and
   on its own far plane. It is the first thing uTier takes off.

   It is a CONTACT shadow and it stops at 1.10 — the caliper onto the
   disc, the nuts onto the hub face, and nothing further. Two reasons,
   and both of them are BOUND_GATE: a short ray is a ray that crosses
   fewer bounds, and a short ray is one whose penumbra term stays above
   the gate's own step. The step is free rather than clamped to a
   minimum, because a minimum step quantises t and quantised t draws the
   same contours by itself. */
float shade(vec3 p, vec3 l){
  float s = 1.0, t = 0.022;
  for (int i = 0; i < 16; i++){
    float h = map(p + l * t);
    if (h < 0.0016) return 0.0;
    s = min(s, 6.0 * h / t);
    t += h;
    if (t > 1.10) break;
  }
  return clamp(s, 0.0, 1.0);
}

void main(){
  vec2  s0   = (2.0 * gl_FragCoord.xy - uRes) / uRes.y;
  float asp  = uRes.x / uRes.y;
  float wide = smoothstep(0.95, 2.00, asp);
  float e    = smoothstep(0.0, 1.0, uEnter);

  /* ---------------- the clock ----------------
     Thirteen seconds, and the phase matters: at uTime zero a reader
     finds the disc already down, the caliper settling onto its rim and
     the nuts still to come, so the first three seconds anyone sees are
     the three seconds in which the most happens. */
  float T   = 13.0;
  float cyc = fract(uTime / T + 0.220);

  /* Each part gets an arrival and a release. Cubic ease-out in, so a
     part decelerates into its place the way a placed part does, and
     cubic ease-in out, so a released one accelerates away. Order in:
     disc, caliper, nuts. Order out: the reverse. The windows overlap on
     purpose — three parts that move one at a time is a slideshow, and
     three that move together is a collision. */
  float si, so, u;
  si = smoothstep(0.00, 0.18, cyc); so = smoothstep(0.90, 1.00, cyc);
  u = 1.0 - si; float aDisc = (1.0 - u * u * u) * (1.0 - so * so * so);
  si = smoothstep(0.13, 0.32, cyc); so = smoothstep(0.78, 0.92, cyc);
  u = 1.0 - si; float aCal  = (1.0 - u * u * u) * (1.0 - so * so * so);
  si = smoothstep(0.28, 0.48, cyc); so = smoothstep(0.62, 0.78, cyc);
  u = 1.0 - si; float aNut  = (1.0 - u * u * u) * (1.0 - so * so * so);

  /* ---------------- the camera ----------------
     One arc about the axle, a single cosine so it closes on itself — and
     its phase is the whole composition of the loop, not a detail. It is
     set so the two extremes land on the two moments worth looking at:
     near EDGE-ON at the start, where the disc slides in and the caliper
     closes over its rim and you can see that it straddles it, and round
     to near FACE-ON by 0.55, where the five nuts thread down onto the
     hub in front of you and the assembly holds. The camera lifts as it
     goes edge-on, because a disc seen dead edge-on from its own plane is
     a line. The pointer nudges the arc a few degrees either way. */
  float sweep = cos(6.2831853 * (cyc - 0.55));
  float th0 = 0.780 - 0.520 * sweep + (uPointer.x - 0.5) * 0.40;
  float ph0 = 0.150 + 0.170 * (0.5 - 0.5 * sweep)
            + 0.035 * sin(6.2831853 * cyc + 1.0)
            + (uPointer.y - 0.5) * 0.15;
  float D   = 5.20;
  vec3  ro  = vec3(sin(th0) * cos(ph0), sin(ph0), cos(th0) * cos(ph0)) * D;
  vec3  ta  = vec3(0.0, 0.0, 0.10);
  vec3  ww  = normalize(ta - ro);
  // ph0 never exceeds 0.43rad, so ww is never near vertical and this
  // cross product is never near zero.
  vec3  uu  = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
  vec3  vv  = cross(uu, ww);

  /* The key, hoisted out of the shading block because the bench below is
     lit by it and casts by it: one light in the room, not one for the
     object and another for the floor it stands on. It is hung off the
     CAMERA's axes — upper left and a little in front — so a part is lit
     the same way at every point of the arc; see the lighting block for
     why that matters more here than world-anchoring would. */
  vec3  lig = normalize(uu * (-0.52) + vv * 0.66 + ww * (-0.54));

  /* ---------------- where "apart" is ----------------
     Not off the edge of the band. The parts come apart along the
     CAMERA's own axes rather than the world's, and the largest component
     of every one of those moves is WW — straight away from the lens.
     Depth costs no width, which is the whole reason this works on a 4:5
     phone band where the disc is already two thirds of the picture: the
     disc recedes to two thirds of its size and drifts, and it is still
     a whole disc, in frame, with its five nuts spread round it.
     Sideways travel is what a long band has spare and a narrow one has
     none of, so it is scaled by the aspect and by nothing else. */
  float spread = mix(0.30, 2.70, wide);

  float ur = 1.0 - aDisc;
  gRotP = (uu * (-spread) + vv * 0.34 + ww * 2.55) * ur;
  // A quarter-turn of tumble, and no more: a disc rolled far enough to
  // present its edge on the way in is a coin, not a rotor.
  gRotM = transpose(eul(vec3(0.30, 0.52, 0.26) * ur));

  float PHI = 2.234;                                   // the caliper's o'clock
  float uc  = 1.0 - aCal;
  gCalP = 1.000 * vec3(cos(PHI), sin(PHI), 0.0)
        + (uu * (0.26 + 1.30 * wide) + vv * 0.16 + ww * 1.85) * uc;
  gCalM = transpose(eul(vec3(0.42 * uc, -0.58 * uc, PHI + 0.95 * uc)));

  /* The nuts travel in along their studs' own radii first and only then
     thread down, so the last thing that happens in the assembly is five
     nuts turning. On the way out they unwind and slide back off. They
     are the one part that stays in the disc's own frame, which is what
     makes the fold exact — and it also means they recede WITH the disc
     when it backs off, so the hub and its five nuts stay one cluster
     however far apart the brake is.

     The radial run is a flare and nothing more; nearly all of the travel
     is AXIAL, straight down the stud. Two reasons, and neither is
     taste. Radially the nuts have nowhere to go — the band's height is
     already spent on the disc, and a nut thrown a unit out along its own
     radius is a nut sitting in the paper the kicker is printed on. And a
     nut that comes in sideways is not threading onto anything: an
     earlier cut sent them half a disc-radius out and they read as five
     dice floating near a wheel rather than as five nuts hovering off
     five studs. */
  float tv = smoothstep(0.0, 0.62, aNut);  tv = 1.0 - (1.0 - tv) * (1.0 - tv) * (1.0 - tv);
  float th = smoothstep(0.55, 1.00, aNut); th = th * th * (3.0 - 2.0 * th);
  gNutR = mix(0.22, 0.28, wide) * (1.0 - tv);
  /* Kept SHORT on purpose. The nuts detach along the axle, and the
     camera is at its most oblique exactly when they are furthest out —
     so every unit of axial travel is most of a unit of sideways travel
     on the screen. An earlier cut ran them 1.2 units up the studs and
     they landed a disc and a half to the left of the hub: five dice in
     the corner of the band, with nothing to say they had ever been nuts
     on those studs. Two thirds of a disc radius is enough to read as
     off, and near enough to read as off THOSE STUDS. */
  gNutZ = 0.375 + mix(0.34, 0.44, wide) * (1.0 - tv) + 0.22 * (1.0 - th);
  float spin = 8.8 * (1.0 - th) + 0.42;
  gNutC = cos(spin); gNutS = sin(spin);

  /* The field of view is solved against the band's HEIGHT, at both ends.
     The bottom fifth is paper under the kicker and the top is under the
     header; what is left has to hold the object's own vertical extent
     whichever way the camera has arced, because that extent never
     changes under an arc about the axle. So the camera pulls back on the
     narrow band rather than cropping.

     Where it sits. The vertical is set by measurement rather than taste:
     the extent is not symmetric about the axis — the caliper and its
     hose union reach a third of a unit further up than the disc reaches
     down — so the frame is placed on the middle of the EXTENT, or the
     caliper grazes the docked header while there is clear band under the
     disc. The horizontal only moves on a long one: centred on 21:9 the
     object sits in the middle of a great deal of nothing with the kicker
     stranded under it; at 62% of the width the text has the open left to
     itself and the parts have somewhere to come apart into. */
  /* Measured, not guessed: the caliper's top corner is at y = 1.24 and
     the disc's rim at y = -1.00, so the extent is 2.24 tall about a
     centre 0.12 above the axle. The window left between the paper and
     the header is s0.y in [-0.33, 0.70]. Those two numbers are what
     these two are.

     The top of that window was measured on the LIVE PAGE rather than in
     a harness, which is the only place the mistake shows. The docked
     header is a fixed pill over the document, so at the scroll position
     where the band's own top reaches the viewport's, it covers the first
     66px of the band on a desktop and 56px on a phone — 10.7% and 11.5%
     of the band's height. Two passes of this landed the caliper's corner
     inside that, because a harness photographing the band on its own has
     no header in it to collide with. Measured across twelve moments of
     the loop at all three widths, the object's top now reaches 0.870,
     0.866 and 0.855 of the band from its foot, against a header that
     starts at 0.893, 0.891 and 0.885. The bottom reaches 0.335, which is
     clear of the 0.30 where the harness begins washing the band to the
     paper the kicker is printed on. */
  float halfH = mix(2.24, 2.16, wide);
  float yOff  = mix(0.132, 0.138, wide);
  float xOff  = 0.55 * wide;
  vec2  s     = vec2(s0.x - xOff, s0.y - yOff);
  vec3  rd    = normalize(s.x * uu + s.y * vv + (D / halfH) * ww);
  // One pixel, in world units per unit of distance travelled. The march
  // converges to a pixel rather than to a fixed epsilon, which is what
  // makes the silhouette below cost nothing.
  float pxk   = 2.0 * halfH / (D * uRes.y);

  /* ---------------- the room ----------------
     A violet-grey wall going to paper at the foot where the words are,
     with a pool of light where the work is. This is the only thing in
     the frame that takes the house palette, and it takes all of it: an
     earlier cut washed the wall almost to white, and pale metal on a
     pale wall is how a rendering of a part stops looking like a
     photograph of one. A strip light crosses the band every nine
     seconds — the same lane lights the wall and rakes across the metal,
     so the two are one light and not two effects. */
  float gy = gl_FragCoord.y / uRes.y;
  vec3  bg = mix(uColors[3], mix(uColors[2], uColors[1], 0.78), smoothstep(0.02, 1.02, gy));
  bg = mix(bg, mix(uColors[1], uColors[0], 0.30), smoothstep(0.52, 1.10, gy) * 0.34);
  // The pool of light the work is under, narrowed on a long band so the
  // frame has a centre: a 21:9 wash lit evenly from edge to edge has
  // nowhere for the eye to go and makes the object look mislaid in it.
  vec2  gp = vec2(s.x * mix(1.05, 0.62, wide), s.y * 1.15);
  bg = mix(bg, uColors[3], exp(-dot(gp, gp) * 0.88) * 0.60);
  // And the far corner taken down, which is the rest of that centre.
  bg = mix(bg, mix(uColors[1], uColors[0], 0.34),
           smoothstep(0.50, 1.55, abs(s0.x) / max(asp, 0.8)) * 0.42);
  float lane = (gl_FragCoord.x / uRes.y - mix(-0.6, 1.6, fract(uTime / 9.0)) * asp)
             / mix(0.34, 0.60, wide);
  float beam = exp(-lane * lane);
  bg = mix(bg, uColors[3], beam * 0.16);
  /* What the assembly keeps off the wall behind it. Down and to the
     right, because the key is up and to the left.

     It used to be the only shadow in the frame and it was carrying more
     than a painted ellipse can: a soft patch on a wall is a smudge, not a
     contact, and there was no ground under the rotor for a real one to
     fall on. The bench below now casts the shadow this scene actually
     needed, so this is back to what it honestly is — the wall behind a
     large object going down a shade — at a bit over half the strength it
     had when it was pretending to be more. */
  float pres = clamp(0.85 * aDisc + 0.45 * aCal, 0.0, 1.0) * e;
  vec2  hq   = vec2((s.x - 0.17) * 1.05, (s.y + 0.15) * 1.35);
  // ... and it arrives WITH the assembly. The reveal below fades the
  // object onto the wall over the first second and a half; a shadow
  // painted into the wall itself would have been lying on an empty band
  // for the whole of it.
  bg = mix(bg, mix(uColors[1], uInk, 0.42), exp(-dot(hq, hq) * 2.1) * 0.22 * pres);

  /* Has the rotor still got a bench under it? It comes apart along the
     camera's axes, and at this elevation two and a half units back is
     also half a unit DOWN, so for about a second either side of the
     exploded state the disc is BELOW the bench top. A caster that has
     passed through the surface it was standing on must stop casting on
     it: the field measure below is a distance to the iron and has no
     opinion about which side of the plane the iron is, so left alone it
     wrapped the sinking disc in a black collar — a rotor dipped in ink.
     This is the one number that says the contact is over. It is 1 while
     the disc is anywhere at or above its seated height, which is the
     whole seated three quarters of the loop. */
  float onBench = 1.0 - smoothstep(0.02, 0.26, -gRotP.y);

  /* ---------------- the bench ----------------
     There was no ground under any of this. A twelve-kilo rotor hung in a
     violet room with a soft patch painted on the wall behind it, and a
     painted patch is the one thing a reader clocks as false however well
     the iron is lit. So: a bench, at GROUND, which the disc stands on.

     One ray/plane intersection rather than a march. An infinite plane in
     a distance field is the classic way to spend forty steps on a grazing
     ray and still miss it, and a march buys nothing here.

     It is a NEAR surface and not a room: it gives out into the backdrop a
     little way behind the object instead of running to a horizon. That is
     not taste. The parts come apart along the CAMERA's own axes — two and
     a half units back, which at this elevation is half a unit DOWN — so a
     bench that ran to a horizon would have the exploded rotor buried in
     it for a second of every loop. The fade is over before anything gets
     there, and what the fade takes out it also stops occluding. */
  vec3  back = bg;
  float tF = 1e9, fOp = 0.0;
  if (rd.y < -0.0015) {
    float tf = (ro.y - GROUND) / (-rd.y);       // ro.y is 0.78 to 1.63: always above it
    fOp = 1.0 - smoothstep(5.75, 6.90, tf);     // the seated contact is at 5.53
    if (fOp > 0.003) {
      tF = tf;
      vec3 fp = ro + rd * tf;

      /* The bench is the ROOM, so it is the house palette and nothing
         else — the object is the only thing in this frame allowed its own
         materials. Lit from the ceiling, which is straight overhead of a
         flat surface, so the key on it is one number rather than a dot
         product per pixel, and under the same pool of light the wall is
         under, so the two read as one room. */
      vec3  mat  = mix(uColors[2], uColors[1], 0.38);
      float pool = exp(-dot(fp.xz, fp.xz) * 0.055);
      vec3  lit  = mat * (0.56 + 0.44 * lig.y) * mix(0.90, 1.07, pool);

      /* What the rotor keeps off the bench — and it is the disc's shadow
         rather than a shape drawn to resemble one. The ray from this
         patch of bench toward the key is intersected with the DISC'S OWN
         PLANE; inside its radius there, the key is blocked. So the mark
         is the true ellipse a leaning disc throws, it is under the disc
         at every moment of the loop because it is read off the disc's own
         position and rotation, and nothing about it needs retuning when
         the camera arcs or the disc tumbles out.

         The penumbra is the distance between caster and bench, which AT
         THE CONTACT IS ZERO. That is the whole of why this reads: one
         line of arithmetic gives a knife edge where the rim lands and a
         soft smudge a foot up the ellipse, with no hand-placed gaussian
         anywhere and nothing to keep in sync with the animation. */
      vec3  L  = gRotM * lig;
      vec3  lq = gRotM * (fp - gRotP);
      float dz = L.z;
      // A disc edge-on to the key throws a shadow with no width in it.
      dz = abs(dz) < 0.05 ? (dz < 0.0 ? -0.05 : 0.05) : dz;
      float sp = -lq.z / dz;
      float rr = length(lq.xy + L.xy * sp);
      float pen = 0.05 + 0.26 * max(sp, 0.0);
      float sh  = smoothstep(1.0 + pen, 1.0 - pen, rr) * step(0.0, sp)
                / (1.0 + 0.80 * max(sp, 0.0));

      /* And the ambient this patch of bench has LOST, which is not a cast
         shape at all: it is how much of the room it can still see with an
         iron disc standing on it. One evaluation of the rotor's own field
         is the honest measure of that and costs about what a gaussian
         would. It is also the mark the eye actually reads, because the
         key is up, left and IN FRONT: everything it casts goes away from
         the lens, and most of that is behind the disc that cast it.

         Two grades of it, because one falloff cannot be both. The CORE is
         what nothing at all gets under: full out to 0.12 of the disc's
         radius from the iron and gone by 0.36. Those are distances to the
         ROTOR, not distances on the bench, and that is what gives the
         mark its shape — the bench leaves the disc fast going toward the
         lens and slowly along the tangent, so one number draws a long
         thin lens welded to the bottom of the rim. At 1440 it measures
         seven pixels deep and a hundred and forty-five across, under a
         disc two hundred and ninety wide, which is what a contact looks
         like. The SKIRT is the room closing over the bench as it leaves
         the rim and it runs out over half a radius. A single soft falloff
         gives a grey smudge with no contact in it; a single hard one
         gives a sticker. */
      float dG    = max(sdDisc(lq), 0.0);
      float core  = 1.0 - smoothstep(0.120, 0.360, dG);
      float skirt = exp(-dG * 3.1) * 0.62;
      sh = max(sh, max(core, skirt));
      // Both of the rotor's marks go when the rotor leaves the bench.
      sh *= onBench;

      /* The caliper is most of two units up and its shadow is what that
         distance makes of a fist-sized casting: wide, weak, thrown along
         the key. It is not a contact and it is not drawn like one. */
      float sc = (gCalP.y - GROUND) / max(lig.y, 0.25);
      vec2  cq = (fp - (gCalP - lig * sc)).xz / (0.34 + 0.30 * max(sc, 0.0));
      sh = max(sh, exp(-dot(cq, cq)) * 0.34 / (1.0 + 0.55 * max(sc, 0.0)) * aCal);

      // It arrives with the assembly, like everything else on this wall.
      sh = clamp(sh, 0.0, 1.0) * e;

      /* A MULTIPLY, never a mix toward a colour. A shadow is light
         REMOVED: what is left in it is the room's own violet, which is
         the only thing still reaching the bench once the ceiling is
         blocked, and the reason a shadow on a violet floor is more violet
         than the floor around it and never a grey. A term that can end up
         lighter than the surface it is on is how a render gets a lilac
         puddle under an iron casting. */
      vec3 amb = mix(uInk, uColors[1], 0.26);
      lit = mix(lit, lit * 0.030 + amb * 0.016, sh);

      // The strip light, broad and soft in a bench top — and OCCLUDED,
      // because a reflection of a ceiling cannot land on the six square
      // inches of bench that cannot see the ceiling. Adding it after the
      // shadow lifts the seam under the iron every time the lane goes
      // past, which is a contact blinking.
      vec3 mh = normalize(lig - rd);
      lit += uColors[3] * pow(clamp(mh.y, 0.0, 1.0), 5.0) * 0.070
           * (0.4 + 0.6 * beam) * (1.0 - 0.92 * sh);

      back = mix(bg, lit, fOp);
    }
  }

  vec3 col = back;

  /* ---------------- one march ----------------
     Three tiers, because a tablet is neither of the other two: it has a
     desktop's pixel count and a phone's power budget. The tier buys back
     RAYS AND STEPS and never the subject — every tier gets the whole
     brake, in its own colours, lit the same way.

     The march also remembers its own closest approach, measured in
     pixels. That one extra float is the whole of the edge antialiasing:
     a ray that missed by half a pixel is shaded at the point where it
     came nearest and blended in by how near that was, so the silhouette
     of a round part has a soft edge without a second sample anywhere. */
  int   steps = uTier > 0.75 ? 48 : uTier > 0.25 ? 36 : 24;
  float t = 0.6, d = 1.0;
  float near = 1e9, nt = 0.6;
  for (int i = 0; i < 48; i++){
    if (i >= steps) break;
    d = map(ro + rd * t);
    float rel = d / (t * pxk);
    if (rel < near) { near = rel; nt = t; }
    if (rel < 0.35) break;               // hit
    t += d * 0.92;
    if (t > FAR) break;                  // far plane
  }
  float cover = smoothstep(1.35, 0.40, near);

  if (cover > 0.002) {
    vec3 pos = ro + rd * nt;
    vec3 nor = normalAt(pos);
    t = nt;

    /* Which part was hit, and where on it. One evaluation of each field,
       once, at the surface — never in the loop. hubParts is called
       unbounded here, so the stud and the nut arrive separately: they
       are different metals and the picture depends on it. */
    vec3  lp = gRotM * (pos - gRotP);
    vec3  cp = gCalM * (pos - gCalP);
    vec2  hp = hubParts(lp, length(lp.xy));
    float dD = sdDisc(lp), dH = min(hp.x, hp.y), dC = sdCaliper(cp);
    float mD = min(dD, min(dH, dC));

    /* Four materials. Each carries its own ALBEDO and its own AMBIENT —
       the colour it goes in full shade, which is the material darkened
       and then tinted by the room it is standing in, never a uniform
       scaled down and never the house violet on its own. Giving them all
       one band of value is what made an earlier cut read as one moulding
       in one plastic: a caliper is painted and stays dark even lit, and
       a zinc nut is nearly white where it catches. */
    vec3  base, amb, anisoT = vec3(0.0, 1.0, 0.0);
    float shin, spAmt, mtl, ltAmt, frAmt, anisoK = 0.0;

    if (mD == dC) {
      /* The caliper: the only painted thing in the frame, and the only
         strong colour in it. Gloss paint, so it is nearly a dielectric —
         it barely reflects the room, it just carries a hard white
         highlight across its cast shoulders. */
      base  = RED;
      // Cast ribs down the outboard face, and the machined pad of the
      // bridge. Both read off the caliper's own coordinates, so they
      // turn with it.
      float rib = abs(fract(cp.y * 3.6 + 0.25) - 0.5) * 2.0;
      base = mix(base, RED_D,
                 smoothstep(0.35, 0.95, rib) * smoothstep(0.09, 0.15, abs(cp.z)) * 0.55);
      base = mix(base, RED_D, smoothstep(0.16, 0.30, cp.x) * 0.42);
      // The union for the flexi hose is a steel banjo, not paint.
      base = mix(base, STEEL_D, smoothstep(0.380, 0.412, cp.y));
      /* And two of the three things this field returns are not painted
         either. The carrier is a separate casting — it is what the
         caliper is bolted TO — and the pads are steel and friction
         material. Both are named by the caliper's own coordinates rather
         than by a second field evaluation. Returning the whole of it in
         caliper red is how a bracket stops reading as the thing holding
         the caliper and starts reading as more of its moulding.

         The carrier takes two clauses, because it is outside the body at
         its ends and BEHIND it at its bracket. The ends alone left a red
         crescent round each boss, which is wider than the lug it stands
         on and dips back inside the body's own tangential extent. The
         second clause takes everything behind z = -0.245, which is the
         lug, the boss, the cross member and the stem and nothing of the
         caliper at all: the body stops at 0.150 and the piston housings
         at 0.220, so no painted surface in this field can reach it. */
      float brk = max(smoothstep(0.4005, 0.4065, abs(cp.y)),
                      smoothstep(-0.225, -0.245, cp.z));
      float pad = smoothstep(0.086, 0.074, abs(cp.z)) * smoothstep(0.13, 0.09, cp.x)
                * (1.0 - brk);
      base = mix(base, mix(IRON, IRON_OX, 0.42) * 0.82, brk);        // bare cast carrier
      base = mix(base, mix(STEEL_D, IRON_OX, 0.25), pad);            // backing plate and friction
      /* The bolt head in each boss, which is the claim itself: this
         caliper is BOLTED to that bracket rather than parked beside the
         disc. Bare steel and brighter than the casting round it — an
         inked disc at the same place read as a hole through the boss,
         which says the opposite of what a fastener says. It faces
         on the lug's outboard face and its shank runs back through the
         boss into the bracket, so the rotor stands between it and the
         lens for most of the loop and only the tumble on the way out
         shows it. That is not a detail lost: it is where the bolt on a
         car is, and the frame it was visible in was the frame that had
         it screwed into the friction face. */
      base = mix(base, mix(STEEL_D, ZINC, 0.42),
                 smoothstep(0.034, 0.028, length(vec2(cp.x + 0.285, abs(cp.y) - 0.436)))
               * smoothstep(-0.172, -0.181, cp.z));
      amb  = mix(base * 0.22, uColors[0], 0.26);
      shin = 58.0; spAmt = 0.82; mtl = 0.07; ltAmt = 0.30; frAmt = 0.09;
      // Neither a dry casting nor a pad carries the paint's hard
      // highlight across it.
      float dry = max(brk, pad);
      shin = mix(shin, 20.0, dry); spAmt *= 1.0 - 0.70 * dry; ltAmt *= 1.0 - 0.45 * dry;
    } else if (mD == dH && hp.y <= hp.x) {
      /* The nuts: zinc-plated, the brightest metal in the picture, and
         the only thing in it that turns. */
      base  = ZINC;
      amb   = mix(base * 0.27, uColors[0], 0.19);
      shin  = 78.0; spAmt = 1.00; mtl = 0.40; ltAmt = 0.58; frAmt = 0.26;
    } else if (mD == dH) {
      /* The studs: black phosphate. They are dark on purpose — five
         bright nuts arriving onto five dark studs is what makes the
         nuts read as five separate parts rather than as the hub
         growing lumps. */
      base  = STEEL_D;
      amb   = mix(base * 0.34, uColors[0], 0.22);
      shin  = 42.0; spAmt = 0.46; mtl = 0.22; ltAmt = 0.24; frAmt = 0.16;
    } else {
      /* Cast iron. The swept band where the pads have been is machined
         bright; everything the pads never touch has the light oxide a
         bare rotor picks up within a day of coming out of its wrapper,
         which is the warm brown-grey in the hat and at the rim. */
      float rr = length(lp.xy);
      vec3  nl = gRotM * nor;              // the normal in the disc's own frame
      float fc = abs(nl.z);                // 1 on a face, 0 on the rim
      float ring  = smoothstep(0.60, 0.645, rr) * smoothstep(1.00, 0.965, rr);
      float swept = ring * fc;
      base = mix(mix(IRON, IRON_OX, 0.34), IRON_M, swept);
      // The hat, set back behind the web and darker for it.
      base = mix(base, mix(IRON, IRON_OX, 0.52) * 0.72, smoothstep(0.62, 0.44, rr) * 0.70);

      /* The turned finish, and it is a DIRECTION rather than a texture.
         A flat face under one light is one flat tone at every camera
         angle, which is precisely what this frame looked like before this
         existed. The fix is not to bump the normal — a groove finer than
         a pixel is not a finish, it is moire, and tilting the normal at
         forty-six grooves to the radius made the disc read as sawn wood.
         It is to say that the surface scatters ALONG the circle, and let
         the highlight below come out as the broad bowtie that crosses
         every machined disc face and sweeps as the camera arcs. It costs
         one cross product and it is the whole finish. */
      anisoT = transpose(gRotM) * vec3(-lp.y, lp.x, 0.0) / max(rr, 1e-4);
      anisoK = swept * 0.55;
      /* And the grooves are barely in the albedo at all. At 22 rings
         across the radius they land about seven pixels apart on a
         desktop band, and under the ellipse a face makes when the camera
         arcs they stopped reading as a turned finish and started reading
         as the grain in a sawn plank. The finish is the sheen above; the
         rings are a whisper under it. */
      float grv = abs(fract(rr * 22.0) - 0.5) * 2.0;
      base = mix(base, base * 0.90, swept * grv * 0.14);

      /* Cross-drilled, and the drilling is the one mark that makes a
         disc a disc at a glance. One atan for the whole fragment. */
      float ha = atan(lp.y, lp.x + 1e-6);
      float hk = PI / 5.0;
      float hf = ha - hk * floor(ha / hk + 0.5);
      float hd = length(vec2(rr - 0.800, rr * hf)) - 0.062;
      float inHole = smoothstep(0.006, -0.004, hd) * ring * fc;
      base = mix(base, vec3(0.036, 0.033, 0.038), inHole);
      // The chamfer round each hole, which is the bright part of a drilled
      // disc and the reason the holes read as holes and not as spots.
      float ch = (hd - 0.016) / 0.011;
      base = mix(base, IRON_M * 1.14, exp(-ch * ch) * ring * fc * 0.70);

      /* And the vents, seen in the rim when the camera comes round edge
         on: the openings between the vanes, straight down the thickness.

         THE POLYGON LIVED HERE, and it was never in the geometry. Every
         radius in this file is a length(p.xy), so the disc is a true
         circle: the coverage mask measures round to a fifth of a pixel at
         every buffer size and every moment of the loop. What was not
         round was THE EDGE A READER SEES.

         The outer cylinder is 0.096 deep and it foreshortens. The moment
         the disc turns anywhere near face-on that band lands as a sliver
         thinner than one pixel — and this block was painting twenty-seven
         near-black vent slots and two bright lips inside that sliver,
         keyed on an lp.z that runs through the whole thickness within a
         single pixel. Neighbouring pixels round the circumference landed
         in different slots at different depths, so the edge came out as
         alternating black and bright beads, and a circle drawn out of
         beads is read as straight chords with corners between them. That
         is the polygon, and it was worst on a phone because that is where
         the sliver is thinnest.

         Worse at the very edge: the march shades its closest approach, so
         a ray that missed by half a pixel is shaded at a point OFF the
         surface, where rr is past 1.0 and lp.z means nothing. The
         antialiased pixels that MAKE the silhouette were being handed the
         rim treatment as well.

         So every mark on the rim is now weighted by the width it is
         actually being drawn at. rimPx is that width in pixels: the
         band's own depth, foreshortened by how broadside it lands, over
         the world size of one pixel at this distance. By three pixels the
         marks are drawn in full, which is the edge-on half of the loop,
         where a vented rim is the whole point of having one. Under one
         pixel they fade — not to nothing, but to the AVERAGE they would
         have integrated to across that pixel, which is the only fade that
         leaves the rim the same tone it was. Fading them out instead
         would have made the disc's edge lighten every time the camera
         came round to face-on, which is a second bug wearing the first
         one's clothes. Nothing away from the rim moves. */
      float rimPx = 0.096 * clamp(-dot(nor, rd), 0.0, 1.0) / max(t * pxk, 1e-5);
      float lod   = smoothstep(1.0, 3.0, rimPx);
      float vn  = abs(fract(ha * 4.2972) - 0.5) * 2.0;
      float rim = smoothstep(0.55, 0.92, 1.0 - fc) * smoothstep(0.955, 0.985, rr);
      base = mix(base, vec3(0.048, 0.044, 0.050),
                 rim * mix(0.22, smoothstep(0.50, 0.12, vn) * smoothstep(0.034, 0.010, abs(lp.z)), lod) * 0.92);
      // The two lips of the rim, which is where the light lands on a disc
      // and the only reason its silhouette has an edge. Wider than a
      // pixel they are two lips; thinner, they become the single tone the
      // lips and the land between them average to, so the edge stays lit
      // all the way round instead of flickering between them.
      base = mix(base, IRON_M, rim * mix(0.36, smoothstep(0.024, 0.042, abs(lp.z)), lod) * 0.55);

      amb  = mix(base * 0.26, uColors[0], 0.18);
      shin = 36.0; spAmt = 0.74; mtl = 0.30; ltAmt = 0.44; frAmt = 0.20;
      /* And a hole takes no gloss. Inking a drill hole into the albedo
         and then handing that pixel the same reflection and the same
         highlight as the iron round it puts the light straight back and
         the mark goes grey — which is the named way this whole set has
         gone wrong before. There is nothing to reflect down a hole. */
      mtl   *= 1.0 - inHole * 0.85;
      spAmt *= 1.0 - inHole * 0.90;
      ltAmt *= 1.0 - inHole * 0.85;
      anisoK *= 1.0 - inHole;
    }

    /* ---------------- light ----------------
       One key from the upper left with its own short shadow ray, a
       bounce off the pale floor, occlusion from the field itself, and —
       the thing that actually makes this read as metal rather than as
       plastic — the room, reflected. Metal is mostly what it reflects,
       and this room is a dark floor under a lit ceiling with a strip
       light across it, which is one dot product.

       The key is hung off the CAMERA's axes, not the world's — upper
       left and a little in front — so a part is lit the same way at
       every point of the arc. A key fixed in world space leaves the
       whole assembly in silhouette for a third of a slow orbit, which is
       a beautiful decision in a renderer and a dead band on a web page.
       What does travel with the arc is the reflection, which is where
       the sense of turning metal actually comes from. */
    float dif = clamp(dot(nor, lig), 0.0, 1.0);
    // The shadow ray is skipped where the surface already faces away
    // from the light, which is about half of every frame and costs
    // nothing to notice. Desktop only: it is the first thing uTier takes.
    float sh  = 1.0;
    if (uTier > 0.75 && dif > 0.01) sh = shade(pos + nor * 0.022, lig);
    float bnc = clamp(0.30 + 0.70 * dot(nor, vec3(0.10, -1.0, 0.20)), 0.0, 1.0);
    float fre = clamp(1.0 + dot(nor, rd), 0.0, 1.0); fre = fre * fre * fre;
    vec3  hal = normalize(lig - rd);
    float spc = pow(clamp(dot(nor, hal), 0.0, 1.0), shin);   // base clamped: never negative
    // Where the surface is turned, the highlight is not a spot: it is the
    // broad wedge thrown by grooves running round the axis.
    if (anisoK > 0.0) {
      float ht = dot(anisoT, hal);
      spc = max(spc, pow(clamp(1.0 - ht * ht, 0.0, 1.0), 9.0) * anisoK);
    }

    /* Occlusion from distance taps along the normal. The march's own
       step count was tried here and taken out again: a step count is an
       INTEGER, so what it draws is a contour map of itself, and the disc
       came back with curved bands across its face that read as wood
       grain. Taps of the field are continuous and cost less than the
       artefact did. */
    float occ = clamp(map(pos + nor * 0.070) / 0.070, 0.0, 1.0);
    if (uTier > 0.25) occ = 0.5 * occ + 0.5 * clamp(map(pos + nor * 0.210) / 0.210, 0.0, 1.0);
    occ = mix(occ, 1.0, 0.26);

    /* The key takes each surface from its own AMBIENT to its own ALBEDO,
       and only the top of the range lifts toward the light. Ramping
       straight from dark to near-white was half of why an earlier cut
       looked inflated, and all of why its marks vanished: it lifts an
       inked drill hole to the same tone as the iron round it, so every
       mark painted into the albedo above was washed out again here. */
    float key = dif * mix(0.20, 1.0, sh);
    key = key * key * (3.0 - 2.0 * key);
    vec3  c   = mix(amb, base, key);
    c = mix(c, mix(base, uColors[3], ltAmt), smoothstep(0.62, 1.0, key));
    // The bounce off the paper floor, which is the site's own light.
    c = mix(c, mix(base, uColors[2], 0.42), bnc * 0.13);

    /* The room, reflected. Anchored in WORLD space while the key is
       anchored to the camera, which is why the highlight crawls round
       the rim as the arc goes by and why a still of this reads as a
       photograph of a part rather than a rendering of one. */
    vec3  ref = reflect(rd, nor);
    vec3  eC  = mix(mix(uColors[0], uInk, 0.50), mix(uColors[2], uColors[3], 0.62),
                    smoothstep(-0.16, 0.34, ref.y));
    float strip = (ref.y - 0.60) / 0.13;
    eC = mix(eC, uColors[3], exp(-strip * strip) * 0.95);
    /* And then most of the HUE is taken out of it again, which is the
       single most important line in this block. What a workshop reflects
       at a piece of iron is its LIGHT — a dark floor, a lit ceiling, a
       strip lamp — and that light is only tinted by the room, it is not
       made of it. Reflecting the house violet at full strength put a
       lavender cast over the whole disc and every nut, so the iron read
       as violet plastic and the plating read as nothing at all. Keeping
       the value structure and dropping half the saturation leaves the
       metal grey, with the room in it. */
    float eL = dot(eC, vec3(0.299, 0.587, 0.114));
    eC = mix(vec3(eL), eC, 0.42);
    c = mix(c, eC, mtl * (0.40 + 0.56 * fre));

    // Contact: toward the material's OWN ambient, not toward the house
    // ink. A red caliper stays red in its own crevices.
    c = mix(c, amb, (1.0 - occ) * 0.62);
    c = mix(c, uColors[3], clamp(spc * spAmt + spc * beam * 0.55, 0.0, 1.0));
    // And an edge, so a dark part never dissolves into a dark wall — but
    // a painted caliper gets far less of it than plated steel does.
    c = mix(c, mix(uColors[2], uColors[3], 0.5), fre * frAmt);

    /* The other half of the contact, and it is on the IRON rather than on
       the bench: nothing gets under a rim that is standing on it. The
       edge light and the reflected room die in the last quarter unit
       above the bench — squared, so the hem is deep in the last
       centimetre and barely there an inch up — because a lit edge running
       along the bottom of the disc is a line of daylight between the two,
       and a line of daylight there is the single thing that makes a
       rendered object look pasted onto its floor. It goes toward the
       material's OWN ambient, so the iron darkens as iron. And it is
       switched off with the bench itself, by the same distance fade, so
       the exploded rotor — which passes below GROUND on its way back and
       has no bench under it by then — does not carry a dark hem through
       empty air. */
    float land = 1.0 - smoothstep(0.0, 0.26, pos.y - GROUND);
    land = land * land * (1.0 - smoothstep(5.75, 6.90, t)) * onBench;
    c = mix(c, amb * 0.20, land * 0.90);

    // Air. A part far back in the room takes the backdrop's colour rather
    // than sitting on top of it as a cut-out.
    c = mix(c, back, smoothstep(5.6, 10.4, t) * 0.80);

    /* And the bench in front of it wins, where the plane is nearer than
       the hit. Only as far as the bench is still THERE: where it has
       given out into the backdrop it stops occluding, and it stops a
       little faster than it stops being drawn, because the alternative is
       the exploded rotor sliced across by a surface no longer in the
       picture. */
    float hid = t > tF ? fOp * fOp : 0.0;
    col = mix(back, c, cover * (1.0 - hid));
  }

  // The reveal: the room is already there, the assembly arrives in it.
  col = mix(back, col, e);
  // A little tooth, so the long wash into white never bands on a cheap
  // panel — which is the only sort of panel this will be watched on.
  col += (hash(gl_FragCoord.xy + fract(uTime) * 53.0) - 0.5) * 0.016;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export const scene: Scene = {
  frag,
  colors: ["#551a89", "#7c74a6", "#f4f3f7", "#ffffff"],
  /* The assembly, seated, as far as stacked gradients can carry it — and
     they have to carry it, because this is what a reader on a slow phone
     looks at until the shader has compiled and what a device with no
     WebGL is left with for good. Solved at 390x488, the band a phone
     gets: every radius is in PIXELS off a centre placed in percentages,
     so the disc stays round and the same stop is not a hub on one band
     and a moon on the other.

     The colours are the shader's own materials, not the house palette:
     iron greys, a red caliper, zinc nuts, on a violet-grey wall over the
     bench the disc stands on, going to paper at the foot. A poster in
     violet under a scene in iron and red is a flash of the wrong picture
     on every first paint — and a poster with the disc in mid-air under a
     scene that stands it on a bench is the same mistake in geometry. */
  poster:
    // The five nuts on the hub face, on the studs' own 36-degree phase,
    // so none of them sits at twelve or six o'clock. Zinc plating.
    "radial-gradient(circle 15px at 58.5% 36.0%, #e4e7ee 0 13px, rgb(255 255 255 / 0) 15px), " +
    "radial-gradient(circle 15px at 46.8% 32.9%, #d3d8e1 0 13px, rgb(255 255 255 / 0) 15px), " +
    "radial-gradient(circle 15px at 39.5% 40.9%, #c0c6d1 0 13px, rgb(255 255 255 / 0) 15px), " +
    "radial-gradient(circle 15px at 46.8% 48.9%, #b6bcc8 0 13px, rgb(255 255 255 / 0) 15px), " +
    "radial-gradient(circle 15px at 58.5% 45.8%, #d3d8e1 0 13px, rgb(255 255 255 / 0) 15px), " +
    // The caliper, clamped over the rim at eleven o'clock, in its paint.
    "radial-gradient(52px 44px at 30.7% 21.2%, #c9382c 0 46%, #a51f16 74%, rgb(255 255 255 / 0) 100%), " +
    // The disc: bore, hub flange, hat, web, the friction ring with its
    // machined band, and the lit lip at the rim. Every radius is the
    // shader's own proportion times the 122px the disc actually measures
    // on a 390x488 band — flange at 0.48 of the disc's radius, stud
    // circle at 0.335, web at 0.65, swept band from 0.60 out.
    "radial-gradient(circle 122px at 50% 40.9%, " +
    "#ded9ec 0 16px, #6d665e 18px 33px, #7d766d 35px 53px, #4a443e 56px 60px, " +
    "#6e675f 62px 67px, #55504a 69px 77px, #a8a7a9 78px 107px, #c3c2c4 108px 112px, " +
    "#4f4a45 113px 115px, rgb(255 255 255 / 0) 117px), " +
    /* THE CONTACT, which the poster had no more of than the shader did:
       a disc floating on a wall with an offset smudge behind it. The
       disc's own stops put its rim at 116px below a centre at 40.9%, so
       it lands at 64.9% of the band — and these two layers are under it
       and nowhere else. The tight one is the seam: half as wide as the
       disc, a few pixels deep, and the darkest thing in the poster. The
       wide one is the bench losing the room as it leaves the rim. Both
       are violet-black rather than grey, because what is left in a
       shadow here is the room. */
    "radial-gradient(58px 7px at 50% 64.8%, rgb(24 14 34 / 0.80) 0%, rgb(26 16 38 / 0.46) 58%, rgb(85 26 137 / 0) 100%), " +
    "radial-gradient(146px 40px at 50% 66.6%, rgb(48 30 72 / 0.34) 0%, rgb(85 26 137 / 0) 100%), " +
    /* The pool of light, and then the room: a violet-grey wall down to
       the bench line at 65%, the bench top under it going to the paper
       the kicker is printed on. The one tone break is at the contact, so
       the disc is standing on something and not in front of it. */
    "radial-gradient(62% 52% at 50% 41%, rgb(255 255 255 / 0.58) 0%, rgb(255 255 255 / 0) 100%), " +
    "linear-gradient(to bottom, #8b80b0 0%, #a9a2c4 26%, #d8d2e6 58%, #cec7df 65%, #e6e2f0 76%, #ffffff 92%)",
  alt: "A front brake assembling itself on a workbench: a cast-iron cross-drilled disc drifts in and settles on its rim, in its own dark contact shadow; a red caliper closes over the rim on the bracket behind it; and five zinc-plated wheel nuts travel in along the studs and turn as they thread down — then the whole thing releases and comes apart again while the camera arcs slowly round from edge-on to face-on.",
};
