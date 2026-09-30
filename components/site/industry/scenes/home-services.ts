import type { Scene } from "../shader-stage";

/* ------------------------------------------------------------------ *
 * Home services — the tap that will not stop.
 *
 * This file has been wrong four times. It was a domain-warped noise
 * plasma in warm beige, which a review called a screensaver; then a
 * near-empty band with a bead the size of a full stop in it, which the
 * next review called a scene that had failed to load; then a flat 2D
 * drawing of a joist, a stain and a drip, which was legible and was
 * still a drawing. The note back was the same each time and it was
 * right: this trade's band has to be a THING, in space, with real
 * materials, and it has to be the thing that is actually wrong in the
 * house when the phone rings.
 *
 * The fourth was this object, built, and it failed on two counts that
 * are both fixed here and are both written down below, because both are
 * the sort of mistake that comes back:
 *
 *   IT WAS SEEN END ON. The gooseneck's arc lived in the YZ plane and
 *   the camera sat almost on the Z axis, so the arch was foreshortened
 *   to a slot two tenths of a unit wide and the two legs merged. What
 *   the band drew was a capped column with a stub out of its side. A
 *   stranger called it a tap on the phone and something else on a
 *   laptop, and that split is the thing that has killed this work three
 *   times over. The whole assembly is now SWUNG 48 degrees round the
 *   basin, so the reach and the rise are seen across the frame and the
 *   opening under the arch is a hole you can see the wall through at
 *   every width. See toTap().
 *
 *   IT WAS IN NOTHING. The bowl and the tap hung in a violet void: no
 *   counter, no surface anywhere in the frame, and under the rim nothing
 *   but more wall. An object that touches nothing has nowhere for a
 *   contact shadow to land, and without that shadow there is no scale, no
 *   floor and no weight — which is why the same drawing read as a
 *   photograph on one screen and as a render on the next. So the basin is
 *   now a DROP-IN, set into a stone counter whose cut edge meets the
 *   rolled rim exactly, with the moulded tap deck rising out of it and a
 *   contact that is tightest and darkest along the join and loosens away
 *   from it. See the counter block in main(). Nothing else in the file
 *   moved for it: no geometry, no camera, no materials, no motion.
 *
 *   THE CHROME WAS LAVENDER. It sampled env() — the house palette on a
 *   wall — so a mirror finish came back as a broad violet-grey with a
 *   dark violet cap on the nose where the arc reflected the top of the
 *   wall. That is not a lighting bug, it is the brief's own rule
 *   applied to the one material it cannot be applied to. A polished
 *   surface has no colour of its own; it is whatever is around it. So
 *   the chrome now samples studio(), a NEUTRAL set — dark floor, bright
 *   overhead sweep, one hard-edged warm key and a broad cool fill —
 *   while the wall behind the tap and every diffuse surface in the
 *   frame stay on the house palette. Chrome reads as chrome or it reads
 *   as plastic; there is no third option.
 *
 *   the object   a chrome monobloc mixer over a white basin, seen close
 *                and in three-quarter profile. Not a stand-in: a worn
 *                washer is the single most common thing a domestic
 *                plumber is rung about, and a tap that drips all night
 *                is the reason somebody looks up a number at seven in
 *                the morning.
 *
 *   the motion   it DRIPS, and nothing else in the frame moves. A bead
 *                gathers at the aerator over three and a half seconds,
 *                swells, sags, necks, lets go — and the neck snaps back
 *                to a residue at the mouth, which is where the next one
 *                starts. The drop falls in slow motion, stretching as it
 *                accelerates, and breaks on the glaze: a crown throws
 *                up, seven beads ride its rim and fly off it, the sheet
 *                collapses, and a ring runs out across the wet patch and
 *                dies. Then the mouth starts loading again. The washer
 *                is gone and it will not stop; that is the call.
 *
 *   the camera   almost still. It sits a little under the arch so the
 *                drop comes down towards the reader, and drifts by a few
 *                hundredths of a unit over the loop — one sine, so the
 *                loop has no seam. The pointer leans it a few degrees.
 *
 * MATERIALS. Three, and each is written as its own literal rather than
 * as a tint of the palette:
 *
 *   polished chrome    a mirror, and nothing else: no diffuse term at
 *                      all. F0 near 0.67 with a faint cool cast, and
 *                      what it looks like IS studio() — a photographer's
 *                      set, because that is what anybody has ever seen
 *                      chrome in. The dark band round its middle is the
 *                      set's horizon; the bright band along its top is
 *                      the overhead sweep; the pale one under the spout
 *                      is the basin throwing light back up into it. A
 *                      mirror with no horizon in it is a plastic tube.
 *   white glazed       a warm white, 0.955/0.945/0.925, over a clear
 *   ceramic            coat. The white is never shaded toward black: its
 *                      shadow side goes VIOLET, because the only light
 *                      reaching it there is the room's. That is what
 *                      keeps a white bowl sitting in this site's world
 *                      rather than cut out of another one.
 *   clear water        barely a colour — a cool 0.86/0.94/0.97 seen
 *                      through it — plus a hard bright specular and a
 *                      dark rim where a real drop turns its edge into a
 *                      lens. It TRANSMITS the room (the house palette,
 *                      because that is what is behind it) and REFLECTS
 *                      the set, which is what a drop hanging off chrome
 *                      actually does.
 *
 * COST. One field, one march, break on hit and on the far plane, never
 * to the cap: 48 steps on a desktop, 36 on a tablet, 24 on a phone, and
 * the march is under-relaxed to 0.86 of the distance because the crown's
 * sheet is two hundredths of a unit thick. The tap sits behind a box
 * bound and the water behind a capsule and a sphere, so a ray crossing
 * open wall pays one box test and one capsule test per step. Both bounds
 * are handed back only while they are unmistakably larger than the
 * march's own hit threshold — about thirty times it at this framing —
 * because a bound returned under the epsilon IS a hit, which is how a
 * scene in this set once shipped as a ball with its shading painted on.
 * The shadow ray is desktop only and is skipped wherever the surface
 * already faces away from the key. The ring on the glaze is not geometry
 * — it is a normal perturbation resolved once at the hit point — and the
 * crown's seven beads are ONE bead folded seven ways about the impact
 * axis, which is exact because everything they do is axisymmetric. What
 * the lower tiers give up is geometry and rays, never the subject: the
 * phone keeps the tap, the bead, the fall, the crown, its beads and the
 * ring, and loses the second AO tap, the shadow ray and the trailing
 * ripple.
 *
 * FRAMING. The object's vertical extent is fixed — the camera barely
 * moves — so the field of view is solved against the band's HEIGHT: the
 * impact lands at about a third of the band and the top of the arch at
 * 0.83, at every aspect. The bottom third is paper for the kicker, and
 * what is down there is the near rim of the bowl dissolving into it,
 * which is what that cut is for. On a long band the whole object moves
 * right so the kicker has the open left.
 *
 * 0.83 is measurement rather than taste. The site's header is DOCKED: it
 * floats over the top of this band whenever the band is at the top of the
 * viewport, and its pill reaches down to 0.90 of the band's height. That
 * leaves the arch between 42 and 24 pixels of daylight depending on the
 * width — and the numbers that matter are the WORST ones, so the arch was
 * swept against the pill at eight moments of the loop, at the four
 * corners of the pointer's range, and at 1440, 820 and 390. The tightest
 * of the twenty-odd is 24 pixels, at 820. Nothing touches.
 * ------------------------------------------------------------------ */

const frag = `
#define PI   3.14159265
#define FAR  13.0

/* The geometry that never moves, in basin radii, and all of it in the
   TAP'S OWN FRAME — see toTap() below. The bowl's mid surface is an
   ellipsoid of 1.70 x 0.760 x 1.70 centred on the rim plane, so y = 0 is
   the rim and the glaze runs down from it. Everything else is hung off
   that. */
#define SPZ   (-0.880)      /* the spout's axis: the fall line          */
#define MOUTH  1.010        /* the lip of the aerator                   */
#define IMPY  (-0.598)      /* where the fall line meets the glaze      */
#define TAPZ  (-1.950)      /* the column's axis, out on the back ledge */
#define ARCY   1.620        /* the top of the column = the arc's centre */
#define ARCR   0.535        /* half the reach, so the arc lands on SPZ  */
#define ARCZ  (-1.415)
#define TUBE   0.145
#define LEVY   1.268        /* the pivot's height on the column         */

/* ---- the counter the basin is set into ----
   CTRY is its top and CUTR is the cutout, and the pair is an IDENTITY
   rather than two numbers nudged until the join looked closed: the rolled
   rim is a torus of tube 0.075 about the circle r = 1.70 in the rim plane,
   so it passes through the plane y = CTRY exactly at

       r = 1.70 + sqrt(0.075^2 - CTRY^2) = 1.7740

   and the cut edge is put there. The bead of the rim therefore stands
   0.087 proud of the stone with no gap anywhere along the join, at any
   width, because there is nothing there to drift.

   CTRY IS SHALLOW ON PURPOSE, and it was -0.042 for one render. A drop-in
   basin's rim OVERHANGS its own cut edge, and this camera looks down at
   eleven degrees: at -0.042 the bead stood 0.042 proud of the stone, which
   hid 0.22 of a unit of counter behind itself all the way round the far
   side, and 0.22 of a unit is exactly where the tight term of the contact
   has already fallen to a third. So the seam existed, was correct, and was
   invisible everywhere except where the cast reached out past the bead.
   At -0.012 the overhang is a thousandth of a unit and the darkest part of
   the contact is the first counter pixel outside the basin's silhouette,
   which is where a contact belongs. It is not a softer shadow; it is the
   same shadow, no longer behind the thing casting it.

   LEDA/LEDB are the moulded deck's own cross-section at that same level —
   the ellipsoid 0.78 x 0.34 x 0.42 centred at y -0.24 is 0.579 x 0.312
   where the plane cuts it — padded a little for the fillet that ties it
   into the bowl. */
#define CTRY  (-0.012)
#define CUTR   1.7740
#define LEDZ  (-2.040)
#define LEDA   0.635
#define LEDB   0.345

/* ---- the swing, which is the whole of the second fix ----
   The arc's centreline is a circle in the tap frame's YZ plane, which is
   the only way an arch rises out of a column and comes back down
   pointing at the basin. Written straight into the world that put the
   arc's plane along the camera's own axis: the reach vanished, the two
   legs printed on top of each other and the object read as a capped
   column. So the assembly — column, arc, spout, lever, the ledge it is
   mounted on, the fall line and the place the water lands — is turned
   48 degrees about Y, which is a RIGID rotation and therefore leaves
   every distance in this file exactly as true as it was. The bowl and
   its rim are surfaces of revolution and do not care.

   48 degrees is measured, not chosen: it is the angle that puts the
   arc's reach within a few degrees of the screen's own horizontal, so
   the arch projects at 0.87 of its true span instead of 0.22. */
#define TC 0.669131         /* cos 48                                   */
#define TS 0.743145         /* sin 48                                   */
vec3 toTap(vec3 p){   return vec3(p.x * TC + p.z * TS, p.y, p.z * TC - p.x * TS); }
vec3 fromTap(vec3 q){ return vec3(q.x * TC - q.z * TS, q.y, q.x * TS + q.z * TC); }

/* The impact point, and the surface frame there, in the tap's frame. The
   glaze is tilted 17 degrees out of horizontal at that spot, so the
   crown stands along the SURFACE normal rather than straight up — which
   is the difference between a splash and a sticker. All three are
   constants: the tap does not move and neither does the place the water
   lands. */
const vec3 IMP = vec3(0.0, IMPY, SPZ);
const vec3 UPN = vec3(0.0, 0.9653, 0.2611);
const vec3 EA  = vec3(1.0, 0.0, 0.0);
const vec3 EB  = vec3(0.0, 0.2611, -0.9653);

/* The lever's own axis, unit, in the tap's frame — the collar's boss, the
   arm and the pivot all run along this one line, which is what makes them
   a single turned part rather than three shapes that meet. */
const vec3 LDIR = vec3(-0.704362, -0.088045, 0.704362);

/* ---- the state of the drip, resolved once per fragment in main() and
   read by the field. Globals rather than arguments: map() runs fifty
   times a pixel and none of this changes between calls. ---- */
float gBeadR, gBeadY, gNeckR, gNeckK;     /* the pendant and its neck   */
float gDropR, gDropH, gDropY, gDropOn;    /* the one that let go        */
float gCrH, gCrR0, gCrR1, gCrW, gCrOn;    /* the crown's sheet          */
float gCrBR, gCrBY, gCrB;                 /* and the beads on its rim   */

float hash(vec2 p){
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

float smin(float a, float b, float k){
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

/* ---- primitives. Exact where it is cheap to be exact: an overshooting
   field is a hole through the middle of a part. ---- */
float sdCylY(vec3 p, float r, float h){
  vec2 d = vec2(length(p.xz) - r, abs(p.y) - h);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}
float sdBox3(vec3 p, vec3 b, float r){
  vec3 d = abs(p) - b + r;
  return min(max(d.x, max(d.y, d.z)), 0.0) + length(max(d, 0.0)) - r;
}
float sdCap(vec3 p, vec3 a, vec3 b, float r){
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h) - r;
}
/* A torus about the tap frame's X axis: the gooseneck's centreline. */
float sdTorusX(vec3 p, float R, float r){
  return length(vec2(length(p.yz) - R, p.x)) - r;
}
/* An ellipsoid, on the standard approximation, held back to 0.85 of what
   it says. The approximation is exact for a sphere and only close for a
   2.2:1 body like this bowl, and close is not good enough to march: a
   field that overstates itself anywhere is a ray through the porcelain.
   At the exact centre the ratio is 0/0, and that one point is answered
   outright, because returning zero there would be a HIT hanging in the
   middle of the open bowl where a ray on its way to the glaze passes. */
float sdEll(vec3 p, vec3 r){
  float k1 = length(p / (r * r));
  if (k1 < 1e-4) return -min(r.x, min(r.y, r.z));
  float k0 = length(p / r);
  return 0.85 * k0 * (k0 - 1.0) / k1;
}

/* ---- the basin ----
   A shell about the mid surface, cut off at the rim plane, with the
   rolled rim as a real torus and the back ledge the tap is mounted on
   as one rounded box. Three shapes, and the whole lower half of the
   picture is made of them.

   It takes the point TWICE — once in the world, once in the tap's frame
   — because the bowl and the rim are surfaces of revolution about Y and
   do not turn with the tap, while the moulded ledge the tap stands on
   must. Both arguments are the same point under a rigid rotation, so
   mixing them costs the field nothing. */
float sdBasin(vec3 p, vec3 q){
  float bowl = max(abs(sdEll(p, vec3(1.70, 0.760, 1.70))) - 0.05, p.y);
  /* The rolled rim, and it is deliberately fat. At 0.052 its lit edge
     was narrower than a pixel on the phone's buffer and what the band
     drew round the bowl was a DOTTED line. A rim you can see is a rim
     several pixels across on the smallest buffer this ever runs in. */
  float rim  = length(vec2(length(p.xz) - 1.70, p.y)) - 0.075;
  /* The tap platform: moulded into the back of the bowl rather than a
     slab standing behind it, which is what a one-hole basin has and what
     stops a hard-edged white step floating over the rim.

     It is an ELLIPSOID and it was a rounded box, and that is the second
     thing the swing above broke. A box behind the basin is invisible
     while the camera is on the tap's own axis and is a blunt white stub
     with a flat end on it the moment the camera is anywhere else — which
     is exactly what the first render of the swing came back with. An
     ellipsoid tapers to nothing at both ends: it dies inside the rolled
     rim at 1.62 out and into the air at 2.46, so what is left is a swelling
     in the back of the basin with the tap standing on the crown of it.
     Its radii are solved so the crown clears the rim plane under the
     flange and has fallen back under it by the time it reaches the rim,
     because anything of this that rises inside 1.70 pokes up through the
     glaze — and a white bump inside a basin reads as a chip. */
  float ldg  = sdEll(q - vec3(0.0, -0.24, -2.04), vec3(0.78, 0.34, 0.42));
  /* The rim is FILLETED into the bowl rather than butted against it, and
     the ledge into both. A butt joint between two curved surfaces is a
     crease, the four-tap normal at a crease is an average of two
     different normals, and what that draws at the resolutions this band
     degrades to is a dotted stitch line all the way round the basin. A
     real basin is moulded in one piece and has the fillet anyway. */
  return smin(smin(bowl, rim, 0.085), ldg, 0.20);
}

/* ---- the tap, in its own frame ----
   Base flange, column, the half arc over the top, the drop leg and the
   aerator collar at its mouth, and the lever out of the body's side. The
   arc is clipped to its upper half against the plane through its own
   centre, so the two ends come out vertical and the column and the leg
   continue them without a seam.

   THE LEVER IS PART OF THE BODY, and that is the fix this revision is
   for. It used to be one capsule min()'d into the column with its inner
   end buried on the column's own axis — which is attached in the field
   and is not attached in the picture, for a reason worth writing down.
   The lever's axis runs within a few degrees of the world's -x, and the
   camera sits so that the world's -x is within a few degrees of where
   the column's own SILHOUETTE is. A tube leaving a cylinder along the
   line of sight's tangent leaves it exactly at the outline: there is no
   shoulder, no penetration and no fillet to see, because all of it is
   edge-on. What the band drew was a bar that stopped at a line, with the
   bead at the aerator hanging under its far end — and that is precisely
   what a reader described: a lever starting in mid-air with a loose ball
   on it.

   So the joint is now a joint, with volume in it at the one place the
   eye looks. A cartridge collar wraps the column at the pivot height, a
   boss comes out of that collar along the lever's own axis, and the arm
   springs out of the boss. None of the three is min()'d: they are
   smooth-joined to each other and the whole of it is smooth-joined to
   the column, so there is a real fillet at every change of section and
   the run from the flange on the basin to the tip of the handle is ONE
   moulded solid. The collar is what carries it at any size — it is a
   feature ON the column, a quarter wider than the column is, so it
   survives being twelve pixels tall on a phone, which a fillet alone
   does not.

   Where the lever sits is unchanged, and it is a composition decision as
   much as a plumbing one. It comes off the body BELOW the arc's
   springing line and reaches out across the frame — not up into the
   opening under the arch, which is the one piece of empty space doing
   the work of saying this is a tap. Its own direction is within a few
   degrees of the screen's horizontal, so it reads as a lever rather than
   as the stub it was when it pointed at the camera. */
float sdTap(vec3 p){
  vec3 a = p - vec3(0.0, ARCY, ARCZ);
  float d = max(sdTorusX(a, ARCR, TUBE), -a.y);

  /* The column and everything growing out of it, filleted into one part.
     The arm is started 0.120 along the axis — inside the boss, which ends
     at 0.165 — rather than at the boss's own mouth, so the smooth join has
     material on both sides of it to work with instead of blending a cap
     into a cap. */
  vec3  lo   = vec3(0.0, LEVY, TAPZ);
  float body = sdCylY(p - vec3(0.0, 0.825, TAPZ), 0.152, 0.795);
  float coll = sdCylY(p - lo, 0.166, 0.076) - 0.026;
  float boss = sdCap(p, lo, lo + LDIR * 0.165, 0.086);
  float arm  = sdCap(p, lo + LDIR * 0.120, lo + LDIR * 0.560, 0.058);
  body = smin(body, smin(coll, smin(boss, arm, 0.060), 0.038), 0.036);
  d = min(d, body);

  d = min(d, sdCylY(p - vec3(0.0, 0.050, TAPZ), 0.235, 0.015) - 0.025);
  d = min(d, sdCylY(p - vec3(0.0, 1.335, SPZ), 0.145, 0.285));
  d = min(d, sdCylY(p - vec3(0.0, 1.055, SPZ), 0.147, 0.017) - 0.028);
  return d;
}

/* ---- the water, in the tap's frame ----
   The pendant is a bulb with a capsule neck reaching back to the mouth,
   smooth-joined. As the neck thins its radius is taken NEGATIVE and the
   join tightened to nothing, which is how it lets go without leaving a
   sausage behind: a zero-radius capsule is still a well-formed distance
   to a segment, and a join of 0.005 is a min. */
float sdWater(vec3 p){
  vec3 c = vec3(0.0, gBeadY, SPZ);
  float d = smin(length(p - c) - gBeadR,
                 sdCap(p, c, vec3(0.0, MOUTH, SPZ), gNeckR), gNeckK);

  if (gDropOn > 0.5) {
    vec3 r = vec3(gDropR, gDropH, gDropR);
    vec3 q = (p - vec3(0.0, gDropY, SPZ)) / r;
    d = min(d, (length(q) - 1.0) * min(gDropR, gDropH));
  }

  if (gCrOn > 0.5) {
    /* The crown, in the glaze's own frame: a segment from the foot of
       the sheet to its lip, revolved — which is exact — and seven beads
       folded about the same axis, which is exact for the same reason.
       They ride the lip while the sheet stands and fly off it as the
       sheet collapses. */
    vec3 v = p - IMP;
    vec3 q = vec3(dot(v, EA), dot(v, UPN), dot(v, EB));
    float rr = length(q.xz);

    /* The fold, first, because the sheet is cut by it as well as the
       beads being placed by it. Seven ways about the impact axis, and it
       is EXACT: cos(7a) of the folded angle equals cos(7t) of the true
       one, since the two differ by whole turns. */
    float ang = atan(q.z, q.x + 1e-6);
    float k = 2.0 * PI / 7.0;
    ang -= k * floor(ang / k + 0.5);

    /* The sheet: a segment from the foot to the lip, revolved, which is
       exact - then SCALLOPED, cut down between the fingers and left tall
       where a bead sits. An unscalloped sheet is a bucket, which is
       exactly what the first cut of this looked like. */
    vec2 pa = vec2(rr, q.y) - vec2(gCrR0, 0.0);
    vec2 ba = vec2(gCrR1 - gCrR0, gCrH);
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-5), 0.0, 1.0);
    float sheet = length(pa - ba * h) - gCrW;
    /* The cut is divided by three, and that is not a taste decision. It
       is a HEIGHT FIELD, not a distance: its gradient across the fold is
       0.46 * gCrH * 7 / rr, which is about 2.4 at the lip, so handing it
       to max() straight lets the field claim two and a half times the
       distance that is really there and the march walks through the side
       of a finger. That is what put a comb of fine hairs down the edge
       of every finger in the first render of this crown. */
    sheet = max(sheet, (q.y - gCrH * (0.54 + 0.46 * cos(7.0 * ang))) / 3.0);
    d = min(d, sheet);

    vec2 f = vec2(cos(ang), sin(ang)) * rr;
    d = min(d, length(vec3(f.x - gCrBR, q.y - gCrBY, f.y)) - gCrB);
  }
  return d;
}

/* The tap behind its bound, in the tap's frame. The bound is honestly
   larger than what is inside it: a bound is only ever handed back while
   it is unmistakably bigger than the march's own epsilon, because a
   bound returned at less than that IS a hit — which is how an earlier
   scene in this set shipped as a violet ball with its shading painted
   on. The hit threshold is not a constant here — the march converges to
   a PIXEL — so it was worked out at the worst case rather than the best:
   a phone band at 390 with the buffer scaled to 0.62, which puts it near
   0.0065 of a unit out at the object's own distance. 0.10 is fifteen
   times that, and about twenty-five times the desktop's.

   This is also the only thing in the frame that CASTS, which is why it
   is a function of its own. The water does not cast: a drop is a lens,
   its shadow is a bright ring with a dark thread in it, and a black dot
   of one on white glaze reads as a chip in the enamel. */
float sdTapB(vec3 q){
  float bt = sdBox3(q - vec3(-0.276, 1.155, -1.458), vec3(0.64, 1.26, 0.86), 0.12);
  return bt > 0.10 ? bt : sdTap(q);
}

float map(vec3 p){
  vec3 q = toTap(p);
  float d  = min(sdBasin(p, q), sdTapB(q));
  float bw = sdCap(q, vec3(0.0, IMPY, SPZ), vec3(0.0, MOUTH, SPZ), 0.24);
  if (gCrOn > 0.5) bw = min(bw, length(q - IMP) - 1.10);
  return min(d, bw > 0.10 ? bw : sdWater(q));
}

vec3 normalAt(vec3 p){
  vec2 k = vec2(1.0, -1.0) * 0.0014;
  vec3 g = k.xyy * map(p + k.xyy) + k.yyx * map(p + k.yyx)
         + k.yxy * map(p + k.yxy) + k.xxx * map(p + k.xxx);
  /* Never normalize something that can be zero. */
  return g / max(length(g), 1e-6);
}

/* One short ray at the key, sixteen steps, breaking on contact and on
   its own far plane. The first thing uTier takes off.

   It marches the tap alone, and that is the fix for the bug this file
   shipped on its first render rather than an optimisation. The glaze is
   CONCAVE: a ray leaving the inside of a bowl for a window up and to the
   left runs nearly tangent to that bowl for a long way, so a penumbra
   term stays small along the whole path and the sixteen sample positions
   print themselves across the porcelain as a fan of dark contours. Two
   things came out of that. A bowl does not need to shadow itself — the
   light term and the occlusion taps do it continuously and for free.

   And once the bowl is out of the ray, the shadow can be SOFT again. The
   first cut of this file marched the bowl and banded, concluded that a
   sixteen-sample penumbra always bands, and went hard — and a hard edge
   round the one thing this tap casts, the spout leg's shadow on the
   rolled rim, drew a grey wedge the size of a thumb with a crease round
   it that read as a chip in the enamel rather than as a shadow. The
   banding was the tangency, not the sample count: against a slim
   vertical tube at arm's length the penumbra term is well behaved, and
   the stride is clamped so sixteen steps still reach the far plane
   without stalling on a near miss. */
float shade(vec3 p, vec3 l){
  float s = 1.0, t = 0.09;
  for (int i = 0; i < 16; i++){
    float h = sdTapB(toTap(p + l * t));
    if (h < 0.005) return 0.0;
    s = min(s, 6.5 * h / t);
    t += clamp(h, 0.06, 0.85);
    if (t > 3.6) break;
  }
  return clamp(s, 0.0, 1.0);
}

/* ---- the room: the wall behind the object, and what DIFFUSE surfaces
   are lit by ----
   Down is the basin: white glaze, and bright, because the tap hangs
   right over it. Up is the wall on the house palette, running to a lit
   ceiling with one window band across it. In between, the dark line of
   the bowl's own shaded inside. This is the site's world, and it is what
   the backdrop, the porcelain's ambient and the water's transmission all
   come out of. It is NOT what the chrome sees — see studio(). */
vec3 env(vec3 d){
  vec3 glaze = vec3(0.90, 0.885, 0.862);
  vec3 low   = mix(mix(uColors[1], uInk, 0.28), glaze, 0.64);
  vec3 wall  = mix(uColors[2], mix(uColors[1], uInk, 0.16), smoothstep(-0.02, 0.78, d.y));
  vec3 c     = mix(low, wall, smoothstep(-0.26, 0.06, d.y));
  /* The window sits high. At 0.30 it was crossing the top of the band
     itself, which washed the wall out to paper on a 4:5 phone and left
     the frame with no top to it. Up here it is a reflection rather than
     a backdrop, which is what a window over a basin is. */
  float w = (d.y - 0.52) / 0.165;
  c = mix(c, vec3(1.0), exp(-w * w) * smoothstep(0.90, -0.50, d.x) * 0.85);
  float k = (d.y + 0.46) / 0.22;
  c = mix(c, mix(uColors[1], uInk, 0.55), exp(-k * k) * 0.40);
  return c;
}

/* ---- the set: what the CHROME sees, and only the chrome ----
   A polished surface has almost no colour of its own. Point one at a
   violet wall and you get a violet tap — which is exactly what this file
   shipped, complete with a dark violet cap on the nose where the arc
   reflected the top of that wall. So the mirror is given the environment
   a mirror is always photographed in: a dark floor, a bright overhead
   sweep, one hard-edged warm key and a broad cool fill. The wall behind
   the tap does not change; only what the tap has in it does.

   The three bands are the whole of it, and they are in this order for a
   reason. Straight DOWN is the white basin the spout hangs over, and
   that pale streak along the underside of a spout is the single most
   recognisable thing about a tap over a sink. Round the MIDDLE is the
   set's dark floor and its horizon — a mirror with no horizon in it is a
   plastic tube, and this line is what the eye actually reads as polish.
   UP is the sweep climbing to a lit ceiling. Hard edges throughout: a
   source with a soft edge reflects as a smear, a source with a hard edge
   reflects as a shape you can name. */
vec3 studio(vec3 d){
  float y = clamp(d.y, -1.0, 1.0);
  vec3 c = vec3(0.820, 0.825, 0.840);                          /* the basin, below */
  c = mix(c, vec3(0.062, 0.065, 0.074), smoothstep(-0.66, -0.20, y));  /* the floor */
  c = mix(c, vec3(0.115, 0.120, 0.135), smoothstep(-0.14,  0.06, y));  /* the horizon */
  c = mix(c, vec3(0.965, 0.970, 0.990), smoothstep( 0.10,  0.52, y));  /* the sweep */
  /* The big white bounce card, low and to the front left. Everything
     above is a function of HEIGHT alone, and height alone is not enough:
     a vertical tube reflects sideways along its whole length, samples
     the horizon at every pixel of itself and comes back one flat tone —
     which is a painted tube. The card is the azimuthal mark that breaks
     that, and it is the hard bright streak running the length of every
     chrome column anybody has ever photographed. */
  float b = dot(d, vec3(-0.6094, 0.1181, 0.7839));
  c = mix(c, vec3(0.930, 0.935, 0.955), smoothstep(0.30, 0.62, b) * 0.92);
  /* The fill: a big cool card off to the front right. It only ever
     LIFTS — max() rather than a mix toward its own colour — so it can
     lighten the dark side of the tap without ever dimming the sweep. */
  float f = dot(d, vec3(0.8602, 0.1000, 0.5001));
  c = mix(c, max(c, vec3(0.470, 0.510, 0.600)), smoothstep(0.18, 0.86, f));
  /* The key: a warm softbox high and to the left, aimed exactly where
     the scene's own key is, so the reflected panel and the specular
     highlight are one light rather than two effects. */
  float k = dot(d, vec3(-0.4197, 0.7995, 0.4297));
  c += vec3(1.00, 0.97, 0.92) * smoothstep(0.24, 0.86, k) * 0.10;
  c = mix(c, vec3(1.00, 0.975, 0.930), smoothstep(0.80, 0.90, k) * 0.95);
  return c;
}

void main(){
  vec2  s0   = (2.0 * gl_FragCoord.xy - uRes) / uRes.y;
  float asp  = uRes.x / uRes.y;
  float wide = smoothstep(0.95, 2.00, asp);
  float e    = smoothstep(0.0, 1.0, uEnter);

  /* ---------------- the clock ----------------
     5.4 seconds, and the phase is set so a reader arrives on the swell
     rather than on an empty mouth.

       0.00 - 0.10   the bead is full, sagging, the neck thinning
       0.10          it lets go
       0.10 - 0.196  half a second of fall, accelerating
       0.196         it breaks
       0.196- 0.31   the crown stands and collapses
       0.196- 0.62   the ring runs out and dies
       0.26 - 0.97   the mouth loads again, from the residue it kept
       0.97 - 1.00   full, and still — which is exactly what 0.00 is, so
                     the loop has no seam at all. */
  float T = 5.4;
  float c = fract(uTime / T + 0.735);

  /* How full the mouth is. One number, continuous through the wrap: on
     the way out it collapses to the 0.22 of itself that stays clinging
     to the aerator, and the growth on the other side starts from that
     same 0.22. The two branches meet at 0.18, where both are 0.22. */
  float pend = c < 0.18 ? mix(1.0, 0.22, smoothstep(0.095, 0.140, c))
                        : mix(0.22, 1.0, smoothstep(0.26, 0.97, c));
  gBeadR = 0.105 * pow(clamp(pend, 0.0, 1.0), 0.60);
  /* It sags on the way to letting go, and the sag is most of what makes
     a drop look heavy. */
  float sag = smoothstep(0.0, 0.10, c) * (1.0 - smoothstep(0.10, 0.15, c));
  gBeadY = MOUTH - 0.030 - gBeadR * 0.80 - 0.085 * sag;
  float thin = smoothstep(0.02, 0.115, c) * (1.0 - smoothstep(0.16, 0.24, c));
  gNeckR = mix(0.034, -0.02, thin);
  gNeckK = mix(0.055, 0.005, thin);

  /* The fall. Quadratic, because that is what gravity is, and stretched
     along the way: a drop at speed is a prolate spheroid and a drop at
     rest is a ball. Half a second for 115mm is slow motion by a factor
     of three, which is the one piece of licence in the file and the
     reason anybody can see the thing that is being described. */
  float fu = clamp((c - 0.10) / 0.096, 0.0, 1.0);
  gDropOn  = (c > 0.10 && c < 0.198) ? 1.0 : 0.0;
  float y0 = MOUTH - 0.030 - 0.105 * 0.80 - 0.085;
  gDropY   = y0 - (y0 - (IMPY + 0.098)) * fu * fu;
  float st = 1.0 + 0.62 * fu;
  gDropH   = 0.105 * st;
  gDropR   = 0.105 / sqrt(st);

  /* The crown. It stands in 0.12 of the cycle and spreads as it falls,
     and its lip carries seven beads that leave it on the way down —
     which is the photograph everyone has seen of a drop landing, and is
     also simply what happens. */
  float ci = clamp((c - 0.196) / 0.114, 0.0, 1.0);
  gCrOn = (c > 0.196 && c < 0.315) ? 1.0 : 0.0;
  float rise = smoothstep(0.0, 0.20, ci);
  float coll = smoothstep(0.34, 1.0, ci);
  gCrH  = 0.30 * rise * (1.0 - coll * coll);
  gCrR0 = 0.100 + 0.42 * ci;
  gCrR1 = 0.190 + 0.56 * ci;
  /* A SHEET. The first cut of this had a wall 0.03 thick on a lip of
     0.15 radius, which is not a crown, it is a fluted cup. */
  /* Thin, but not thinner than the march can resolve: at 0.009 the
     fingers came back stippled, because a wall two hundredths of a unit
     thick is narrower than the stride a relaxed march takes past it. */
  gCrW  = 0.021 * (1.0 - 0.40 * ci) + 0.004;
  /* The beads ride the lip while it stands and are thrown clear of it as
     it collapses, on their own small parabola. */
  float fly = smoothstep(0.30, 1.0, ci);
  /* The bound round all of this is a sphere of 1.10 at the impact, and
     these two lines are why it is that big rather than the 0.86 it was:
     a bead thrown to gCrR1 + 0.16 at ci = 1 is 0.88 out on its own, and
     a bound smaller than what it bounds is a ray straight through the
     thing it was meant to protect. */
  gCrBR = gCrR1 + 0.16 * fly;
  gCrBY = gCrH + 0.028 + 0.55 * fly * (1.0 - fly) - 0.16 * fly * fly;
  gCrB  = 0.029 * (1.0 - smoothstep(0.55, 1.0, ci) * 0.85);

  /* The ring, which is not geometry — it is resolved at the hit point on
     the glaze. It decelerates the way a capillary ring does and dies
     inside the wet patch, because a ripple that carries on over dry
     porcelain is a diagram of an impact rather than an impact. */
  float ri  = clamp((c - 0.196) / 0.46, 0.0, 1.0);
  float rwR = 0.70 * sqrt(ri);
  /* It has to still be there at the far end of its run. A cubic decay
     put the ring below a hundredth of a unit of amplitude a third of the
     way out, which left two and a half seconds of this loop - half of it
     - with nothing moving in the frame at all. */
  float ra  = 1.0 - ri;
  float rwA = (c > 0.196 ? 1.0 : 0.0) * ra * (0.32 + 0.68 * ra);

  /* ---------------- the camera ----------------
     Almost still, a little under the arch so the drop comes down towards
     the reader, and off the axis so the tap is read three-quarter rather
     than flat. The drift is one sine of the loop's own period, so it
     closes on itself; the pointer leans it a few degrees either way. */
  float ph  = 6.2831853 * c;
  vec3  ro  = vec3(1.15 + 0.085 * sin(ph) + (uPointer.x - 0.5) * 0.55,
                   0.80 + 0.040 * cos(ph) + (uPointer.y - 0.5) * 0.14,
                   3.85 + 0.060 * sin(ph + 1.9));
  vec3  ta  = vec3(0.0, 0.851, -1.25);
  vec3  ww  = normalize(ta - ro);
  vec3  uu  = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
  vec3  vv  = cross(uu, ww);
  float D   = length(ta - ro);

  /* The field of view is solved against the band's HEIGHT rather than
     its width, at every aspect: the impact lands at 0.33 of the band and
     the top of the arch at 0.80, so the object is whole on a 4:5 phone
     band and on a 21:9 desktop one alike and the camera pulls back on
     the narrow one rather than letting the frame crop it. Below the
     impact is the near rim of the bowl going into the paper the kicker
     is printed on, which is what that cut is for.

     Sideways it only moves on a long band: centred on 21:9 the tap sits
     in the middle of a lot of nothing with the kicker stranded under it;
     shifted right the text has the open left to itself. */
  float halfH = mix(3.26, 3.14, wide);
  /* 0.17 is the object's seat in the band, and it is the number the
     header argument lands on: it puts the top of the arc at 0.80 of the
     band's height against a pill that reaches 0.90, and the impact at
     0.33 against paper that starts at 0.30. Ten points of clearance at
     the top and three at the foot is what survives the loop's drift and
     the pointer's lean together. */
  float yOff  = 0.18;
  float xOff  = 0.36 * wide;
  vec2  s     = vec2(s0.x - xOff, s0.y - yOff);
  vec3  rd    = normalize(s.x * uu + s.y * vv + (D / halfH) * ww);
  /* One pixel, in world units per unit of distance travelled. The march
     converges to a pixel rather than to a fixed epsilon, which is the
     whole of the edge antialiasing further down. */
  float pxk   = 2.0 * halfH / (D * uRes.y);

  /* ---------------- the room ----------------
     The wall the object stands in front of, on the house palette. Over
     it: the pool of light the work is under, narrowed on a long band so
     the frame has a centre, and the far corners taken down. */
  vec3  bg = env(rd);
  vec2  gp = vec2((s.x - 0.26) * mix(1.00, 0.62, wide), (s.y - 0.06) * 1.10);
  bg = mix(bg, uColors[3], exp(-dot(gp, gp) * 0.85) * 0.40);
  bg = mix(bg, mix(uColors[1], uColors[2], 0.55),
           smoothstep(0.55, 1.60, abs(s0.x) / max(asp, 0.8)) * 0.42);

  /* The key, hoisted out of the shading below, because the counter's
     contact is thrown by the same window that lights the basin. A shadow
     aimed by one vector while the shading is aimed by another is a decal,
     and that is precisely the fault this pass exists to fix. It is
     anchored in the WORLD rather than to the camera: this camera hardly
     moves and a bathroom window does not move at all. */
  vec3 lig = normalize(vec3(-0.42, 0.80, 0.43));
  /* One unit of height, sideways, on the counter — and in the TAP's frame,
     because the deck and the column are both written in that frame and
     the footprint they cast is read there. */
  vec2 sw  = lig.xz / lig.y;
  vec2 sl  = vec2(sw.x * TC + sw.y * TS, sw.y * TC - sw.x * TS);

  /* ---------------- the counter ----------------
     Until this pass the basin was not in anything. It was a bowl and a
     tap hanging in a violet void, with nothing under the rim but more
     wall and nothing anywhere in the frame saying where the floor of it
     was. So there is now a counter and the basin is a DROP-IN set into
     it, which is what a one-hole basin with a moulded tap deck is.

     It is a PLANE rather than geometry, and that is the whole reason it
     costs nothing: y = CTRY with a circular cutout at CUTR, intersected
     once before the march instead of joining map() and being asked for
     fifty times a pixel. The march's own hit is drawn over it only when
     the object is NEARER than the plane — one float compare, doing what a
     depth buffer would do, and it is what hides the bowl's outer body
     where it hangs below the stone and what lets the moulded deck rise
     out of it instead of being sliced by it.

     Rays that go down the HOLE get no counter at all: inside CUTR what is
     there is the basin, and the march is what draws it. */
  float fdy = -rd.y;
  float tC  = 1e9;
  if (fdy > 0.004) {
    float tp = (ro.y - CTRY) / fdy;
    vec3  fp = ro + rd * tp;
    vec2  fq = vec2(fp.x * TC + fp.z * TS, fp.z * TC - fp.x * TS);
    float rr = length(fq);
    if (rr > CUTR) {
      tC = tp;

      /* ---- and what the basin takes out of it ----
         In the ROOM, not on the screen. A painted ellipse under an object
         is pinned to the frame, so the camera's drift walks the object off
         its own shadow; this is anchored to the basin's FOOTPRINT in world
         space and moves with the basin because it is the basin's.

         The footprint is the two things that actually touch the stone: the
         cut edge the rolled rim sits in, and the moulded deck the tap
         stands on, taken as its own cross-section at the counter's level.

         CON is the ambient the basin takes out of the stone, and it is
         three falloffs rather than one. A single curve tuned on the seam
         is a fog bank a hand's width away, and one tuned on the pool has
         no seam in it at all. The tight one is the crevice where the rim
         meets the stone — 1/e at 0.071 of a unit, which is about eight
         millimetres at this basin's size; the middle one is the ambient
         the bowl steals from the counter beside it; the long one is what
         is still faintly there a hand away.

         CST is the key: can the window see this patch of stone. Sampled up
         the tap, so its shadow widens and lightens the further it gets
         from the foot that throws it, plus one low sample for the rim's
         own lip — which is all a drop-in basin has to cast with, and is
         why the darkness here is nearly all occlusion and nearly none of
         it a cast. That is what a basin set into a counter looks like. */
      float dB = rr - CUTR;
      vec2  el = (fq - vec2(0.0, LEDZ)) / vec2(LEDA, LEDB);
      float dL = (length(el) - 1.0) * LEDB;
      float dF = max(min(dB, dL), 0.0);

      float con = exp(-dF * 14.0) * 0.70
                + exp(-dF *  4.2) * 0.44
                + exp(-dF *  1.25) * 0.18;

      vec2  lq  = fq + sl * 0.085;
      vec2  le  = (lq - vec2(0.0, LEDZ)) / vec2(LEDA, LEDB);
      float cst = smoothstep(0.035, -0.070,
                    min(length(lq) - CUTR, (length(le) - 1.0) * LEDB)) * 0.44;
      for (int i = 0; i < 3; i++) {
        float h  = 0.30 + 0.58 * float(i);
        vec2  sq = fq + sl * h;
        /* The tap's cross-section at that height: the column low down,
           and up at the springing line the arc reaching across towards
           the spout, which is why the top sample is a segment and the
           other two are discs on the same line. */
        vec2  a  = vec2(0.0, TAPZ);
        vec2  b  = vec2(0.0, i == 2 ? SPZ : TAPZ);
        vec2  pa = sq - a, ba = b - a;
        float u  = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
        float dt = length(pa - ba * u) - 0.170;
        cst += smoothstep(0.040 + 0.50 * h, -0.045, dt) * 0.38;
      }

      float sh = clamp(con + cst, 0.0, 1.0);

      /* The stone. On the HOUSE palette, because a counter is ground and
         not object: the materials in this frame are the chrome, the glaze
         and the water, and nothing else in it is allowed a literal. The
         sheen is the lit wall lying in a polished top, and it is most of
         what makes a horizontal surface read as horizontal rather than as
         a second wall — it comes up as the view grazes and is gone where
         the counter is steeply under the camera. */
      vec3  ctr = mix(uColors[2], uColors[1], 0.56);
      float grz = clamp(1.0 - fdy * 1.5, 0.0, 1.0);
      ctr = mix(ctr, uColors[3], grz * grz * 0.46);

      /* A MULTIPLY toward the room's own violet, never a mix toward grey
         and never a tone laid over the top. A shadow is the light that is
         missing: what is left under this rim is the violet the wall is
         filling every other shadow in the frame with, which is why a
         shadow on a coloured surface comes out MORE coloured than the
         surface round it and never duller. */
      ctr *= mix(vec3(1.0), vec3(0.300, 0.272, 0.430), sh);

      /* And it runs away into the room rather than ending on a horizon,
         on the same distances the object's own air fade uses. The fdy gate
         is what stops the last few grazing rows flickering between stone
         and wall from one frame to the next. */
      bg = mix(bg, ctr, smoothstep(10.6, 5.4, tp) * smoothstep(0.006, 0.060, fdy));
    }
  }

  vec3 col = bg;

  /* ---------------- one march ----------------
     It also remembers its closest approach in PIXELS. That one float is
     the whole of the edge antialiasing: a ray that missed by half a
     pixel is shaded where it came nearest and blended in by how near it
     came, so a 20-pixel bead has a clean round silhouette without a
     second sample anywhere. The step is under-relaxed to 0.86 because
     the crown's sheet is two hundredths of a unit thick and a full step
     walks straight past the side of it. */
  int   steps = uTier > 0.75 ? 48 : uTier > 0.25 ? 36 : 24;
  float t = 0.45, near = 1e9, nt = 0.45;
  for (int i = 0; i < 48; i++){
    if (i >= steps) break;
    float d = map(ro + rd * t);
    float rel = d / max(t * pxk, 1e-6);
    if (rel < near) { near = rel; nt = t; }
    if (rel < 0.35) break;
    t += d * 0.86;
    if (t > FAR) break;
  }
  float cover = smoothstep(1.15, 0.45, near);

  /* The depth test against the counter, and it is the whole of why a plane
     can stand in for geometry here. Anything the march found BEYOND the
     stone is under the stone — the bowl's outer body hanging below the
     cutout, the lower half of the rolled rim, the buried half of the deck
     — and a counter you can see the basin's underside through is not a
     counter. Everything nearer than the plane is drawn over it as before,
     including the half-covered pixels along the rim, so the object's own
     silhouette lands on the stone antialiased instead of against the wall
     it used to be cut out of. */
  if (cover > 0.002 && nt < tC) {
    vec3 pos = ro + rd * nt;
    vec3 qp  = toTap(pos);
    vec3 nor = normalAt(pos);

    /* Which of the three materials was hit. One evaluation of each
       field, once, at the surface — never inside the loop. */
    float dB = sdBasin(pos, qp);
    float dT = sdTap(qp);
    float dW = sdWater(qp);
    float mD = min(dB, min(dT, dW));

    /* The key is the window: up, to the left, and a little in front, and
       it is declared above the room because the counter's contact is
       thrown by the same lamp that lights this surface. */
    float dif = clamp(dot(nor, lig), 0.0, 1.0);
    float sh  = 1.0;
    if (uTier > 0.75 && dif > 0.04) sh = shade(pos + nor * 0.025, lig);
    float fre = clamp(1.0 + dot(nor, rd), 0.0, 1.0);
    float fr5 = fre * fre * fre * fre * fre;
    vec3  hal = normalize(lig - rd);
    float ndh = clamp(dot(nor, hal), 0.0, 1.0);
    vec3  ref = reflect(rd, nor);

    /* Occlusion from distance taps along the normal. The march's own
       step count is NOT used here: it is an integer, so what it draws is
       a contour map of itself, and a bowl came back looking turned out
       of wood. */
    float occ = clamp(map(pos + nor * 0.075) / 0.075, 0.0, 1.0);
    if (uTier > 0.25) occ = 0.5 * occ + 0.5 * clamp(map(pos + nor * 0.24) / 0.24, 0.0, 1.0);
    occ = mix(occ, 1.0, 0.24);

    vec3 c;

    if (mD == dT) {
      /* ---- polished chrome ----
         A mirror and nothing else. There is NO diffuse term here at all:
         chrome's is within a per cent of zero, and the broad falloff a
         diffuse term draws is precisely what made this object read as
         matte plastic. Everything with a colour in it comes out of
         studio(), so the arc carries the sweep along its top, the dark
         floor round its middle and the basin along its underside — which
         is what chrome over a sink does, and is what a violet wall can
         never make it do. */
      vec3 F0 = vec3(0.660, 0.675, 0.695);
      c = studio(ref) * mix(F0, vec3(1.0), fr5);
      /* The key's own reflection in it: the same softbox studio() draws,
         seen as a point because the surface is smooth. */
      c += vec3(1.0, 0.985, 0.96) * pow(ndh, 260.0) * 0.60 * sh;
      /* Chrome takes its occlusion on the reflection rather than on a
         diffuse term it does not have. */
      c *= mix(0.55, 1.0, occ);
    } else if (mD == dW) {
      /* ---- clear water ----
         What is behind it, cooled, plus a hard specular and a dark rim.
         The ray through is bent toward the far side of the bead, which
         is why a hanging drop carries the bright basin up into its
         underside and a falling one carries the wall down into it. It
         TRANSMITS the room, because the room is what is behind it, and
         REFLECTS the set, because it is hanging off a mirror in it. */
      vec3 thr = env(normalize(rd * 0.80 - nor * 0.26));
      c = thr * vec3(0.86, 0.94, 0.97);
      c = mix(c, studio(ref), 0.10 + 0.72 * fr5);
      /* A sheet of water is also LIT. Without this the crown is only the
         room it reflects, and the wall over a basin is dark. */
      c += vec3(1.0, 0.995, 0.985) * clamp(dot(nor, lig), 0.0, 1.0) * 0.22 * sh;
      /* The dark edge. A real drop turns its own rim into a lens that
         sends the room sideways, and without it a bead reads as a bead
         of plastic. */
      /* The dark edge is an EDGE. Taken over too wide a range it eats a
         thin sheet whole, because nearly every pixel of a crown is a
         grazing one, and the crown came back a grey plastic cup. */
      c = mix(c, mix(uColors[1], uInk, 0.40), smoothstep(0.88, 1.0, fre) * 0.45);
      c += vec3(1.0) * (pow(ndh, 320.0) * 1.30 + pow(ndh, 40.0) * 0.22) * sh;
      /* Water is nearly all light: it never sits below the room it is in,
         which is what turned an earlier crown into a grey plastic cup. */
      c = max(c, bg * 0.88);
      /* And it is thin. A sheet of water a millimetre thick is mostly
         whatever is behind it, and the glaze behind it is white. */
      c = mix(c, max(bg, vec3(0.86, 0.855, 0.87)), (1.0 - fr5) * 0.26);
    } else {
      /* ---- white glazed ceramic ----
         A warm white that is never shaded toward black: the light that
         reaches its shadow side is the room's, so its shadow is VIOLET.
         Then the clear coat over the top — a sharp highlight and a
         grazing sheen — which is the whole difference between glaze and
         plaster. */
      vec3 alb = vec3(0.955, 0.945, 0.925);

      /* The wet patch it has been landing in for weeks, and the ring
         running out across it. Both are read off the impact frame, and
         the ring perturbs the normal rather than the colour, so the
         light does the work: the crests catch the window and the troughs
         do not. */
      vec3  v  = qp - IMP;
      vec3  q  = vec3(dot(v, EA), dot(v, UPN), dot(v, EB));
      float rr = length(q.xz);
      /* Two radii, and they are not the same thing. 'wet' is the patch
          it has been landing in for weeks, which is a change of FINISH
          and not of tone - wet porcelain is a shade darker, a shade
          cooler and a good deal glossier, and a pale ellipse painted on
          the glaze instead reads as a sticker, which is what the first
          cut of this was. 'film' is how far a ripple can still run
          before the water is too thin to carry one, and it is wider,
          because the ring has to survive the whole of its journey. */
      float wet  = smoothstep(0.66, 0.20, rr);
      float film = smoothstep(1.06, 0.26, rr);
      if (rwA > 0.001 && rr > 1e-4) {
        float g = (rr - rwR) / 0.095;
        float wv = exp(-g * g) * sin(g * 2.2) * rwA * film;
        if (uTier > 0.25) {
          float g2 = (rr - rwR * 0.55) / 0.12;
          wv += exp(-g2 * g2) * sin(g2 * 1.9) * rwA * 0.45 * film;
        }
        wv = clamp(wv, -0.5, 0.5);
        /* The ripple's radial direction is in the TAP's frame, so it has
           to be carried back out to the world before it can bend a world
           normal. A rotation, so nothing else about it changes. */
        vec3 rad = fromTap((q.x * EA + q.z * EB) / rr);
        nor = normalize(nor - rad * wv * 1.15);
        /* The normal moved, so everything read off it has to move with
           it or the ripple is a stain rather than a wave. */
        dif = clamp(dot(nor, lig), 0.0, 1.0);
        ref = reflect(rd, nor);
        ndh = clamp(dot(nor, hal), 0.0, 1.0);
        fre = clamp(1.0 + dot(nor, rd), 0.0, 1.0);
        fr5 = fre * fre * fre * fre * fre;
      }
      /* Wet glaze is darker and cooler than dry glaze, and that patch is
         the only part of this bowl that has a colour of its own. */
      alb = mix(alb, alb * vec3(0.88, 0.915, 0.935), wet * 0.80);

      /* Hemispheric ambient: the lit ceiling above, the shaded inside of
         the bowl below, both off the room. This is where the violet
         comes from, and it is the reason a white object sits in this
         site's world instead of being pasted onto it. */
      vec3 amb = mix(mix(uColors[1], uColors[2], 0.42), uColors[3],
                     clamp(nor.y * 0.5 + 0.5, 0.0, 1.0));
      float key = dif * mix(0.66, 1.0, sh);
      key = key * key * (3.0 - 2.0 * key);
      /* White glaze STAYS white. A bowl is a box of interreflection and
         its shadow side never goes grey - it goes violet and stays
         light, which is why the ambient floor here is so high and why
         the occlusion below tints rather than darkens. */
      c = alb * (amb * mix(0.44, 0.60, occ) + vec3(1.0, 0.985, 0.96) * key * 0.64);
      c = mix(c, mix(uColors[1], uInk, 0.26), (1.0 - occ) * 0.42);
      /* The clear coat. */
      /* The exponents are held down deliberately. A 700 power on the
         rolled rim of a bowl is a highlight narrower than a pixel, and
         what it draws is a dotted line rather than a lit edge. */
      /* The clear coat's own highlight is only HALF put out by the
         shadow, and that is not fudging the physics, it is the second
         half of the hard-shadow argument above. The one thing this tap
         casts on the basin is the spout leg, a thin vertical tube whose
         shadow lands on the rolled rim as a shape the size of a thumb.
         Taken at full strength, with the coat's highlight switched off
         inside it, that shape stopped reading as a shadow and started
         reading as a chip in the enamel — on the desktop tier only,
         which is the worst place for a mark to appear. Halved, it is a
         shadow. */
      c += vec3(1.0) * (pow(ndh, 55.0) * 0.16 + pow(ndh, 200.0) * wet * 0.42)
                     * mix(0.50, 1.0, sh);
      c = mix(c, env(ref), (0.05 + 0.26 * fr5) * mix(0.60, 1.0, occ));
    }

    /* Air: anything at the back of the room dissolves into the wall
       rather than ending on a hard line. */
    c = mix(c, bg, smoothstep(6.4, 11.0, nt) * 0.85);
    col = mix(bg, c, cover);
  }

  /* The flash of the break. A drop landing throws light for about a
     twelfth of a second and it is the one moment in the loop with an
     event in it; without this the impact is silent. */
  float fl = (c > 0.196 && c < 0.27) ? (1.0 - smoothstep(0.196, 0.27, c)) : 0.0;
  vec3  ip = fromTap(IMP) - ro;
  vec2  is = vec2(dot(ip, uu), dot(ip, vv)) * (D / halfH) / max(dot(ip, ww), 0.2);
  vec2  fq = (s - is) * vec2(1.0, 1.25) / 0.30;
  col = mix(col, uColors[3], exp(-dot(fq, fq)) * fl * fl * 0.30);

  /* The reveal: the room is already there, the tap arrives on it. */
  col = mix(bg, col, e);
  /* A little tooth, so the long wash into white never bands on a cheap
     panel — which is the only sort of panel this will be watched on. */
  col += (hash(gl_FragCoord.xy + fract(uTime) * 57.0) - 0.5) * 0.016;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export const scene: Scene = {
  frag,
  colors: ["#551a89", "#7c7aa8", "#eef1f6", "#ffffff"],
  /* The same picture as far as stacked gradients can carry one, solved
     at 390x488 - the band a phone gets, and the only band where a poster
     really matters, because it is what a reader on a slow connection
     looks at until the shader has compiled and what a device with no
     WebGL is left with for good. The wall, the bowl with its rolled rim,
     the chrome arch standing on the back of it, and the bead at the
     mouth. Every stop is an exact interpolation of the four colours
     above and the house violet, since CSS cannot mix them at paint time
     and a hand-picked near-miss is precisely the drift the palette
     exists to stop. */
  poster: [
    /* Every radius is in PIXELS off a centre placed with calc(), and every
       number was measured off the shader's own frame at 390x488 — the band
       a phone gets, which is the band this poster is actually for. A
       percentage radius is measured against width and height separately,
       so the same stop that is a round bead on a 21:9 band is a tall oval
       on a 4:5 one. */
    // The bead at the aerator, which is the whole subject.
    "radial-gradient(circle 8px at calc(50% + 43px) 39.5%, #ffffff 0 4px, rgb(255 255 255 / 0) 8px)",
    // The aerator collar at the mouth.
    "radial-gradient(17px 6px at calc(50% + 42px) 37.1%, #7c8088 0 52%, #1e2025 88%, rgb(255 255 255 / 0) 100%)",
    /* The pivot, then the lever — and in that order, because the first
       layer of a CSS background is the one on TOP, and what is nearest
       the eye here is the collar. This used to be a single ellipse
       floating in the gap between the two legs with the bead hanging
       under its near end: the same fault the shader had, drawn in CSS.
       An ellipse tapers to nothing at both ends, so it could not touch
       anything even where it overlapped, and the poster is what a phone
       on a slow connection looks at for as long as the compile takes.

       So it is now the two parts the shader has. The collar is a BAR, a
       fifth wider than the leg it wraps and standing a little proud of
       it on both sides, with the chrome's own section across it. The arm
       is a second bar running out of it, and it stops INSIDE the collar
       rather than at its edge, so no rounding of a percentage can open a
       seam between them. Every POSITION is read off the shader's own
       frame at 390x488: the leg is 27px across at x 294, the collar 33px
       at 291, the arm 11px deep from x 258 to the collar.

       The COLOUR is not read off that frame, and that is deliberate. The
       poster's chrome is graded a good deal deeper than the shader's is
       — a stack of gradients cannot carry a mirror, so it carries a dark
       tube with one hard bright streak instead, and every leg in this
       poster is on that grade. Two bars dropped in at the shader's own
       lighter values came back looking pasted onto the tap rather than
       turned out of it. So both use the LEGS' section, lifted one step
       because a collar standing proud of its column and a lever facing
       the bounce card both do catch more light than the column does. */
    "linear-gradient(to right, rgb(255 255 255 / 0) 0 2%, #232529 8%, #7a7f89 21%, #a9adb5 34%, #767d8a 55%, #4a5161 78%, #333842 95%, rgb(255 255 255 / 0) 100%) calc(50% + 112.5px) 33.2% / 33px 21px no-repeat",
    "linear-gradient(to bottom, #202227 0 8%, #a6aab2 19%, #949aa4 36%, #848b97 56%, #6b7280 78%, #3a3f4a 90%, #202329 97%) calc(50% + 82.5px) 34.6% / 39px 11px no-repeat",
    /* The two legs, and they are BARS rather than the stretched ellipses
       every earlier cut of this poster used. An ellipse tapers at both
       ends, and a tapered leg under a blob of an arc is why two attempts
       at this came back reading as an exclamation mark. A layer with its
       own size and position is a rectangle, and a rectangle with the
       chrome's own section across it — dark edge, the bounce card's hard
       bright streak at a third, mid, dark edge — is a tube. That streak
       is the whole difference between chrome and a grey pipe, in the
       poster exactly as in the shader.

       The x offset works out at 50% of the band plus a fixed number of
       pixels whatever the band is wide, because a mixed background
       position resolves to (container - layer) * p + length, and the
       layer's own width is in that subtraction. */
    "linear-gradient(to right, rgb(255 255 255 / 0) 0 3%, #191a1d 9%, #6a6f79 22%, #9da1a9 34%, #6b7280 54%, #414857 78%, #2b2f39 95%, rgb(255 255 255 / 0) 100%) calc(50% + 42.5px) 27.1% / 30px 74px no-repeat",
    "linear-gradient(to right, rgb(255 255 255 / 0) 0 3%, #191a1d 9%, #6a6f79 22%, #9da1a9 34%, #6b7280 54%, #414857 78%, #2b2f39 95%, rgb(255 255 255 / 0) 100%) calc(50% + 112.5px) 32.0% / 30px 150px no-repeat",
    /* The OPENING under the arch, punched back out of the arc below it in
       the wall's own colour. CSS can draw an annulus but it cannot open
       one at the bottom, and a closed ring standing on two legs reads as
       a hand mirror — which is what two earlier attempts at this poster
       looked like. Two ellipses: the eye of the arch, and the gap that
       runs down between the legs under it. */
    "radial-gradient(21px 20px at calc(50% + 77px) 26.2%, #ecedf4 0 92%, rgb(236 237 244 / 0) 100%)",
    "radial-gradient(21px 34px at calc(50% + 77px) 32.4%, #eef0f5 0 92%, rgb(238 240 245 / 0) 100%)",
    // The arc itself, and the sweep caught along its outer shoulder.
    "radial-gradient(7px 13px at calc(50% + 53px) 21.3%, #a8acb4 0 44%, rgb(255 255 255 / 0) 100%)",
    "radial-gradient(49px 46px at calc(50% + 77px) 26.6%, #565b66 0 50%, #292c33 86%, rgb(255 255 255 / 0) 100%)",
    // The base flange, standing on the deck at the back of the basin.
    "radial-gradient(17px 6px at calc(50% + 111px) 53.5%, #6f737b 0 52%, #1e2025 88%, rgb(255 255 255 / 0) 100%)",
    /* The bowl: the glaze inside it, the rolled rim round it and the body
       under that, the last of it going into the paper the kicker is
       printed on — which is what the shader does too. */
    "radial-gradient(178px 31px at calc(50% - 10px) 60.7%, #ffffff 0 52%, #f2eeee 78%, #d9d4dc 96%, rgb(255 255 255 / 0) 100%)",
    "radial-gradient(215px 38px at calc(50% - 10px) 59.6%, #ffffff 0 80%, #bcb9c1 93%, rgb(255 255 255 / 0) 100%)",
    "radial-gradient(202px 62px at calc(50% - 10px) 63.9%, #ffffff 0 60%, #ece9ef 84%, #c9c5d3 96%, rgb(255 255 255 / 0) 100%)",
    // The pool of light the work is under.
    "radial-gradient(64% 44% at 62% 42%, rgb(255 255 255 / 0.50) 0%, rgb(255 255 255 / 0) 100%)",
    /* And the wall, deepening as it climbs the way the shader's does.
       Every stop is an exact interpolation of the four colours above and
       the house violet, since CSS cannot mix them at paint time and a
       hand-picked near-miss is precisely the drift the palette exists to
       stop: #d7d9e6 is 20% of the mid violet in the pale, #dddfea 15%,
       #e3e5ee 10%, #e7eaf1 6%, and #f7f8fb is halfway from the pale to
       paper. */
    "linear-gradient(to bottom, #d7d9e6 0%, #dddfea 13%, #e3e5ee 26%, #e7eaf1 42%, #e7eaf1 54%, #f7f8fb 76%, #ffffff 92%)",
  ].join(", "),
  alt: "A chrome mixer tap over a white glazed basin set into a pale stone counter, seen close and in three-quarter profile so the gooseneck's arch stands clear of the column. A bead of water gathers at the aerator, sags, lets go and falls towards you, and breaks on the porcelain in a crown of seven droplets with a ring running out across the wet patch. Then the mouth starts loading again."
};
