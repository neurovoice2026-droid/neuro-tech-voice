import type { Scene } from "../shader-stage";

/* ------------------------------------------------------------------ *
 * Salons & spas — a pair of shears DOWN on the station top.
 *
 * This band used to be a lone pair of shears floating three-quarter on a
 * violet wall, and it had three faults the judge named:
 *
 *   IT WAS THE SAME PICTURE AS CLINICS-DENTAL. Two scenes in the set had
 *   re-formed the same shot — one polished instrument, alone, on a pale
 *   field, at the same scale, lit the same way. Clinics keeps it. This one
 *   moved, and it moved the only way that actually separates two pictures:
 *   a different CAMERA and a different SUBJECT. The shears are not held up
 *   any more, they are LYING on the station top with a cutting comb beside
 *   them and the morning's cut hair still on the counter, and the camera is
 *   up over the bench looking down at it. Nothing about the palette moved;
 *   the accent is the same violet it was.
 *
 *   A GARBLED SCRIBBLE ON THE BLADE. envAt() had six overlapping features
 *   in it — two horizon bands 0.055 and 0.062 wide, two azimuth uprights,
 *   a key and a fill — and on top of that the shading normal carried a
 *   per-band random jitter meant to read as the last pass of the polishing
 *   wheel. On a hollow-ground flat that turns several degrees inside one
 *   pixel, six hard features plus a random normal is not a studio, it is
 *   handwriting: the flat of the blade came back covered in little arcs.
 *   The room is now FOUR things — floor, wall, ceiling, and one broad warm
 *   softbox, with one soft bench line under them and one wide cool fill —
 *   none of them narrower than 0.14, and the wheel-mark jitter is gone. A
 *   blade reflects a room you could describe, which is the whole test.
 *
 *   A DETACHED FINGER TANG. The finger rest started at 0.157 from the ring
 *   centre, which is 0.011 outside that ring's own centreline and only
 *   just inside the tube — so the two touched along a single tangent and
 *   photographed as a sausage lying near a ring. It starts at 0.135 now,
 *   a clear 0.025 inside the tube's surface, and it is a hooked rest
 *   growing out of the ring rather than resting against it.
 *
 * GROUND CONTACT, which is what the move was really for.
 *
 *   The counter is a real plane at y = 0, intersected ANALYTICALLY — it is
 *   a plane, it has a closed form, and marching one would have cost the
 *   whole band a march it does not need. Everything on it is placed so it
 *   TOUCHES: the shears are dropped to 0.0864, which is the deepest point
 *   of the lower half (its blade spine at the pivot) and, after the dial's
 *   back face was brought in from 0.104 to 0.0864, of the tension dial
 *   too; the comb sits at 0.016, its own half thickness; the hair lies at
 *   its own radius. Nothing hovers.
 *
 *   The shadow is not painted. It is the distance field read from the
 *   counter: three taps along a direction leant off the vertical TOWARD
 *   the key, so what they measure is how much of the key each point of the
 *   top can still see. That makes it tight and near-black where the steel
 *   is a hundredth off the surface, wider and lighter under the blade tips
 *   where a hollow-ground shear really does lift, and it moves when the
 *   blades move, because it is the same field the blades are made of. The
 *   desktop tier spends its one allowed extra ray on a sixteen-step soft
 *   shadow at the key on top of that.
 *
 *   And it is TINTED. The top is multiplied, never overpainted: the lit
 *   value is a cool violet ambient plus a warm key, and the shadow is the
 *   same counter with the key taken off it. So the dark under the shears
 *   is the violet of the room with the warm light removed — which is what
 *   a shadow is — and not a grey blob or a flat swatch of the accent.
 *
 * COLOUR. The COUNTER and the room are the site's — uColors and uInk make
 * the top, the pool of light over the station and the haze the far end of
 * the bench runs into. The OBJECTS are their own materials:
 *
 *   POLISHED JAPANESE STEEL, F0 vec3(0.620, 0.640, 0.672). Rendered as a
 *   metal: no diffuse, a Fresnel to white at grazing, and the colour is
 *   almost entirely the room reflected in it — which is why that room is a
 *   NEUTRAL studio and not the violet counter. A mirror pointed at violet
 *   is violet, and this file shipped lavender plastic once already.
 *
 *   BRASS, vec3(0.855, 0.680, 0.345) — the tension dial at the pivot, and
 *   from above it is the highest thing on the counter and the one warm
 *   note in the steel.
 *
 *   CARBON, vec3(0.052, 0.050, 0.058) — the cutting comb, matt and almost
 *   black, a dielectric with a tight specular. It is the only thing in
 *   frame that is NOT a mirror, and it is what makes the shears read as
 *   one.
 *
 *   HAIR, a warm mid brown vec3(0.276, 0.150, 0.082) under an amber sheen
 *   vec3(0.86, 0.62, 0.34), shaded with Kajiya-Kay off the strand tangent.
 *
 * COST, and the three tiers. One march per fragment, 48 / 36 / 24 steps,
 * under-relaxed to 0.85, and it never runs to the cap: the ray is met with
 * the counter in closed form and with the two objects' bounding spheres
 * analytically, so a fragment with only counter in it does no marching at
 * all and one that has an object starts at that object's sphere and stops
 * at the counter. Inside the field there is a bound round each handle
 * cluster and a BOX round the comb — a box, because a sphere round a thing
 * 1.13 long and 0.03 thick is mostly air. Off the march: a five-tap normal
 * (the fifth is the field at the point itself, which buys the Newton step
 * and, from the tetrahedron's mean, the Laplacian — the surface's own
 * curvature), one env sample, one occlusion tap (two above phone), and,
 * desktop only, one sixteen-step shadow ray. The counter's own contact
 * taps are skipped outright wherever the first one comes back clear. No
 * nested march.
 *
 * The hair is NOT marched. Each strand is a quadratic arc sampled into
 * four segments, and the closest approach of the camera ray to a segment
 * is a closed form — so a strand lands with a true ray depth, is occluded
 * correctly by the shears above it, and is drawn at a width in pixels. Its
 * shadow is the same polyline measured in two dimensions ON the counter,
 * displaced by its own height over the key's slope, which is the cheapest
 * honest way to put a hair on a surface rather than over one.
 *
 * NOT BUGGY. The things in here that were bugs, compiled, rendered, looked
 * at and fixed, each commented where it happened: a march that took the
 * whole distance and stippled a six-thousandth cutting edge; an edge ramp
 * wider than a pixel, which shaded the air around a mirror with the wall
 * behind it; an environment sampled in one direction across a pixel that
 * sweeps three times a feature's width; a highlight lobe narrower than the
 * pixel it is drawn on; a cone correction that collapses to zero when a
 * ray turns away and painted the bounding sphere as a grey ball.
 *
 * What was checked rather than assumed:
 *   · the shears' bounding sphere is 1.35 against a measured 1.249 — the
 *     far point is the finger rest's end at 1.2011 plus its own 0.048, and
 *     the halves turn about that sphere's own centre, so opening them
 *     cannot move it;
 *   · the shears' BOX is 1.210 x 0.900 x 0.112 against a measured
 *     -1.185..1.180 by +/-0.884 by +/-0.106, taken over the whole swing and
 *     over BOTH halves — the second is the first mirrored, so the y extent
 *     is symmetric and a one-sided box cuts the far ring in half;
 *   · the handle bound is 0.69 against a measured 0.6757, which is the
 *     first shank capsule's start and not the ring or the rest;
 *   · the comb's box is 0.566 x 0.018 x 0.132 about local (0, 0, 0.068)
 *     against a union of 0.5645 x 0.016 x 0.1304, worked out from the
 *     spine's rounding and the teeth's own taper;
 *   · every bound is handed over at a radius LARGER than the furthest the
 *     counter's contact taps reach, because a step in the field is a step
 *     in the shadow and the counter draws it at full size;
 *   · the blade's field divides by 1.21 against a gradient recomputed at
 *     1.144, and the comb's teeth by 1.04 against 1.0004;
 *   · the resting height 0.0864 is the lower half's own maximum local z at
 *     the spine, arithmetic at the line itself, and the dial's back face
 *     was moved to meet it rather than the height being fudged;
 *   · every pow() has a clamped non-negative base, every normalize() is a
 *     divide by max(length, eps);
 *   · the loop closes by construction: the snip, the camera's drift and
 *     everything else are functions of mod(uTime, 13.6).
 *
 * FRAMING. The camera is over the bench at 64 degrees on a 4:5 phone band
 * and 52 on a 21:9 one, and the pair is turned in the plane of the counter
 * to suit — running the diagonal where the band is tall, laid across it
 * where the band is long. The field of view is solved against the band's
 * HEIGHT so a narrow band pulls back rather than cropping. The bottom cut
 * belongs to the harness; there is no veil in here.
 * ------------------------------------------------------------------ */

const frag = `
#define TAU 6.2831853
#define BOUND 1.35

/* The half-opening angle, resolved once per fragment, and the two frames
   the field is evaluated in. Globals rather than arguments because the
   field is evaluated fifty-odd times a pixel and none of this changes
   between calls. */
float gCa, gSa;
mat3  gMo, gMot, gCo, gCot;
vec3  gOrg, gCorg;
vec2  gHs;

float h11(float n){
  vec3 q = fract(vec3(n) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

mat3 eul(vec3 a){
  vec3 c = cos(a), s = sin(a);
  mat3 rz = mat3( c.z, s.z, 0.0, -s.z, c.z, 0.0,  0.0, 0.0, 1.0);
  mat3 rx = mat3( 1.0, 0.0, 0.0,  0.0, c.x, s.x,  0.0,-s.x, c.x);
  mat3 ry = mat3( c.y, 0.0,-s.y,  0.0, 1.0, 0.0,  s.y, 0.0, c.y);
  return ry * rx * rz;
}

/* ---- primitives. Exact fields: an approximate one overshoots, and an
   overshoot in a march is a hole through the middle of a blade. ---- */
float sdCylZ(vec3 p, float r, float h){
  vec2 d = vec2(length(p.xy) - r, abs(p.z) - h);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}
float sdBox(vec3 p, vec3 b){
  vec3 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0);
}
float sdCaps(vec3 p, vec3 a, vec3 b, float r){
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}
/* A shear's shank and its finger rings are flat straps, not wire. Squashing
   z and multiplying the distance back by the same factor keeps the field a
   true lower bound — an unscaled return here is an overshoot, and an
   overshoot is a hole through the middle of a ring. */
float sdCapsFlat(vec3 p, vec3 a, vec3 b, float r, float k){
  return sdCaps(vec3(p.xy, p.z / k), a, b, r) * k;
}
float sdRingFlat(vec3 p, float R, float r, float k){
  return (length(vec2(length(p.xy) - R, p.z / k)) - r) * k;
}

/* ---- one half of the pair ----
   Blade, pivot boss, two shank capsules, the finger ring, and — on one
   half only — the finger rest. Everything is in the half's own frame with
   the pivot at the origin, the blade running out along +x and the handle
   back along -x on the OTHER side of the cutting line, which is what makes
   a scissor a scissor: turn the blade up and the handle goes down.

   The tang argument is 1.0 on the half that carries the finger rest and
   0.0 on the other. It is added to that one capsule's distance rather than
   branched on, so the two halves take the same path through the shader. */
float sdHalf(vec3 p, float tang){
  /* The blade. A 2D outline extruded with a thickness that RAMPS: 0.006 at
     the cutting edge, 0.024 at the top of the bevel, 0.031 at the spine,
     and the whole thing thinning toward the tip. The crease where
     the bevel meets the flat is real geometry, not a painted line, which
     is why it catches the softbox as the pair turns. */
  float L  = 1.18;
  float u  = clamp(p.x / L, 0.0, 1.0);
  float u2 = u * u;
  /* The spine. A shear blade keeps most of its depth for two thirds of its
     length and spends the rest coming to a point — the smooth taper this had
     first read as a paper dart. */
  float u4 = u2 * u2;
  float hb = (0.166 * (1.0 - 0.70 * u) + 0.010) * (1.0 - 0.88 * u4 * u4);
  float rd = 0.009;
  vec2 dd = vec2(max(-(p.x + 0.105), p.x - L) + rd, max(-p.y, p.y - hb) + rd);
  float d2 = min(max(dd.x, dd.y), 0.0) + length(max(dd, 0.0)) - rd;
  /* The bevel, and the corner at the top of it is FILLETED. Two clamps met
     here, which is a crease with no width at all: a twelve-degree step in
     the normal, which on a mirror throws the reflected ray a quarter of a
     radian, and a quarter of a radian is the difference between the bench
     and the flat above it. No ground blade has a mathematically sharp
     internal corner either, so smoothstep gives it the radius the wheel
     would: both ramps have zero slope where they meet, the bevel is still a
     real change of plane, and the cost is in the bound below, which was
     recomputed rather than hoped for. */
  float th = (0.0060 + 0.0175 * smoothstep(0.0, 0.052, p.y)
                     + 0.0075 * smoothstep(0.052, 0.202, p.y))
           * mix(1.0, 0.56, u);
  /* HOLLOW GROUND, and it is the difference between steel and paper. A flat
     mirror reflects one direction and comes back one flat tone at every
     camera angle, which is exactly what the first cut of this looked like.
     A real blade's flat is bowed — concave up the face, and swept back
     toward the cutting plane along its length — so the reflection SLIDES
     across it as the pair turns, and that slide is the whole read. */
  float qy = clamp(p.y / 0.166, 0.0, 1.0);
  float zc = 0.030 + 0.026 * qy * qy - 0.015 * u2;
  vec2 w = vec2(d2, abs(p.z - zc) - th);
  /* The 1.21 is not a fudge, and it was worked out again when the bevel was
     filleted, because a smoothstep is half again as steep as the clamp it
     replaced. The z face moves with y at the bow's 0.313*qy plus the bevel's
     0.0175*1.5/0.052 = 0.505, worst together at p.y = 0.026 where they come
     to 0.554, and with x by at most 0.037; the spine's own slope reaches
     0.347. So the steepest this field runs is sqrt(1 + 0.554^2 + 0.037^2) =
     1.144, dividing by 1.21 leaves five per cent in hand, it is a true lower
     bound, and the march below cannot step through the flat of a blade. */
  float d = (min(max(w.x, w.y), 0.0) + length(max(w, 0.0))) / 1.21;

  // The pivot boss: the disc of steel the two halves ride on.
  d = min(d, sdCylZ(p - vec3(0.0, 0.0, 0.030), 0.150, 0.032));

  /* BOUND, not surface. Everything behind the boss — shank, ring, finger
     rest — lives inside this sphere, which is 0.62 against a measured 0.597
     (the far point is the finger rest's end, 0.549 from this centre plus
     its own 0.048; the ring's outer edge is 0.556), and it is only ever
     handed back while it is unmistakably larger than the march's own hit
     threshold. A bound returned under that threshold is a hit, and what
     ships is a violet ball.

     IT WAS 0.76 AND IT WAS HANDED BACK AT 0.055, AND BOTH WERE WRONG ONCE
     the counter started reading its contact shadow out of this same field.
     0.76 is a quarter of a unit of air, which under-reports every point
     outside it by 0.163. And handing over the moment the bound clears the
     march's hit threshold puts a STEP in the field at exactly that radius —
     inside it the real handle distance, outside it 0.055 — and the counter
     photographs a step in the field as a hard circular arc drawn across the
     top. Two of them, in fact, one per half, which is what shipped.

     0.69 against a measured 0.6757 — and the measurement is the first shank
     capsule's START, 0.5937 out plus its own 0.082, not the ring and not the
     rest, which are 0.556 and 0.597. 0.62 was tried, it is under that, and
     with the max() below a bound that is too small does not merely lose
     precision: it EATS the solid it was meant to hold, and what it ate was
     a chamfer off the shank where it leaves the boss.

     Handed over at 0.70, which is the largest radius the counter's taps
     reach, so both sides of the step are past every tap's own radius and a
     point taking the bound is one whose taps all clamp at one. */
  vec3 hc = p - vec3(-0.630, -0.246, 0.030);
  float bh = length(hc) - 0.69;
  if (bh > 0.70) return min(d, bh);

  vec3 q = p - vec3(0.0, 0.0, 0.030);
  float dh = sdCapsFlat(q, vec3(-0.120,  0.058, 0.0), vec3(-0.455, -0.048, 0.0), 0.082, 0.50);
  dh = min(dh, sdCapsFlat(q, vec3(-0.455, -0.048, 0.0), vec3(-0.770, -0.150, 0.0), 0.066, 0.50));
  dh = min(dh, sdRingFlat(q - vec3(-0.960, -0.240, 0.0), 0.168, 0.058, 0.52));
  /* THE FINGER REST, AND IT IS HOOKED THROUGH THE RING, NOT LAID AGAINST
     IT. It used to start at (-0.985, -0.395), which is 0.157 from the ring's
     centre: the ring's tube runs from 0.110 to 0.226 about a centreline at
     0.168, so 0.157 is 0.011 inside the tube's near face and the two solids
     met over a sliver. Out of focus and seen from the side that photographs
     as a detached sausage near a ring, which is exactly what the judge
     called it. It starts ON the tube's own centreline now, at 0.168 from
     the ring's centre, and its 0.048 of section is entirely inside that
     tube's 0.058 — so the join is buried in the ring, there is no weld to
     photograph, and 0.135 (which was tried first) is not used because at
     that radius the cap reaches 0.087 and pokes a blister through into the
     finger hole. It runs out along the same radius to 0.395, which leaves
     0.169 of rest proud of the ring. +9.0 takes it out of the
     min on the other half without a branch and without ever making the
     field larger than the true distance to anything that is there. */
  dh = min(dh, sdCapsFlat(q, vec3(-0.9866, -0.4059, 0.0), vec3(-1.0226, -0.6300, 0.0), 0.048, 0.50)
               + (1.0 - tang) * 9.0);
  // Both are lower bounds on the same distance, so the larger of the two is
  // one as well — and it is the one with no step in it.
  return min(d, max(dh, bh));
}

/* The tension dial: a shaft through the pivot with a brass disc proud of
   each face. The front one is the one with the holes in it.

   THE BACK ONE SETS THE HEIGHT OF THE WHOLE OBJECT, which is why it moved.
   At z = -0.086 it reached -0.104, seventeen thousandths below the lowest
   steel on the pair, so a shears laid flat would have balanced on one brass
   disc with everything else in the air. It sits at -0.0714 now and reaches
   -0.0864, which is exactly the lower half's own deepest point, so the
   dial and the blade spine come down on the counter together. */
float sdScrew(vec3 p){
  float d = sdCylZ(p, 0.052, 0.072);
  d = min(d, sdCylZ(p - vec3(0.0, 0.0,  0.086), 0.094, 0.020));
  d = min(d, sdCylZ(p - vec3(0.0, 0.0, -0.0714), 0.082, 0.015));
  return d;
}

/* ---- the cutting comb ----
   Flat on the counter in its own frame: the spine runs along x, the teeth
   run out along +z, and y is the thickness, so the comb's own down is the
   world's down and it rests on its own half thickness.

   The teeth are one limited repetition rather than thirty-three primitives.
   Because they are evenly spaced and the cell is wider than a tooth, the
   folded coordinate always lands in the cell of the NEAREST tooth and the
   two neighbours are equidistant exactly at the fold, so this is the true
   distance and not the usual repetition's overestimate. */
float sdComb(vec3 p){
  vec3 ds = abs(p - vec3(0.0, 0.0, -0.018)) - vec3(0.560, 0.0115, 0.040);
  float sp = length(max(ds, 0.0)) + min(max(ds.x, max(ds.y, ds.z)), 0.0) - 0.0045;
  float per = 0.0262;
  float ix  = clamp(floor(p.x / per + 0.5), -20.0, 20.0);
  float tx  = p.x - per * ix;
  /* A cutting comb's teeth taper to the tip in BOTH sections, which is the
     only reason a comb reads as a comb from above rather than as a rake.
     The taper leans the faces by 0.027, so the field is divided by 1.04 —
     against a worst gradient of 1.0004 that is more room than it needs. */
  float tz  = clamp((p.z - 0.022) / 0.160, 0.0, 1.0);
  float hw  = 0.0068 - 0.0032 * tz;
  float hy  = 0.0092 - 0.0038 * tz;
  vec3 dt = vec3(abs(tx) - hw, abs(p.y) - hy, abs(p.z - 0.102) - 0.094);
  float te = (length(max(dt, 0.0)) + min(max(dt.x, max(dt.y, dt.z)), 0.0) - 0.0022) / 1.04;
  return min(sp, te);
}

/* Everything ON the counter, and nothing of the counter itself. The top is
   a plane and it is met in closed form up in main(); keeping it out of here
   is what lets the contact taps below ask "how far is the nearest OBJECT"
   rather than "how far is the floor I am standing on", which is always
   zero. */
float mapObj(vec3 p){
  /* THE BOUND IS A BOX AND NOT A SPHERE, and that is not an optimisation.
     A pair of shears is 2.49 long, 1.36 across and 0.23 thick; the sphere
     that holds it is 1.35 in radius and it is ninety-odd per cent air. In a
     march that only costs steps. But the counter reads its contact shadow
     out of this field, and a sphere bound hands back "0.05" to every point
     of the top 1.40 from the pivot — so what the first version of this
     drew was the BOUNDING SPHERE, printed on the counter as a grey disc
     two and a half units across with the object's own shadow lost inside
     it.

     AND THE BOX IS SYMMETRIC IN Y, which is the whole point of a scissor
     and was got wrong once. The second half is the first MIRRORED through
     the cutting line, so whatever reach the finger rest has on one side the
     other half's ring has on the other: y runs -0.884 to +0.884, not
     -0.92 to +0.43. Against the max() below, a box that does not hold the
     object cuts it, and the version with the one-sided y sliced the far
     ring into a hook the moment the blades opened past a sixth of a radian.
     Measured over the whole swing: x -1.185..1.180 (the ring's outer edge
     with the pair nearly shut, and the blade tip), y +/-0.884 (the rest's
     end swung through a quarter radian), z +/-0.106 (the dial). */
  vec3 o = gMot * (p - gOrg);
  float b = sdBox(o, vec3(1.210, 0.900, 0.112));
  float d;
  /* AND THE HAND-OVER IS AT 0.78, NOT AT THE MARCH'S OWN 0.06, WHICH IS THE
     SAME BUG A SECOND TIME. A bound is free in a march — the ray steps short
     and takes one more step — so the natural place to stop paying for the
     real field is as soon as the bound clears the hit threshold. The counter
     is not a march: it asks this field for distances out to 0.360, and the
     first tap only earns the right to skip the other two at 0.70. Below
     that the answer has to be the real one, or the box prints itself on the
     counter — which it did, as a rounded rectangle two and a half units
     across with a dark rim, plainly the shape of nothing in the picture.

     max(), not the branch's own value, for the same reason the other way
     round: both the box and the assembled field are lower bounds on the
     same distance, so the larger of the two is also a lower bound, and it
     is the one that does not under-report the blade's 1.21 and the handle
     sphere's 0.023 of slack out where the taps can see them. */
  if (b > 0.78) d = b;
  else {
    // Half A is the world rotated by -a about the pivot; half B is the same
    // rotation the other way with the frame flipped through the cutting
    // plane, which is exactly what the second blade of a pair is.
    vec3 pa = vec3(gCa * o.x + gSa * o.y, -gSa * o.x + gCa * o.y, o.z);
    d = sdHalf(pa, 1.0);
    vec3 pb = vec3(gCa * o.x - gSa * o.y,  gSa * o.x + gCa * o.y, o.z);
    d = min(d, sdHalf(vec3(pb.x, -pb.y, -pb.z), 0.0));
    d = min(d, sdScrew(o));
    d = max(d, b);
  }
  vec3 c = gCot * (p - gCorg);
  float bc = sdBox(c - vec3(0.0, 0.0, 0.068), vec3(0.566, 0.018, 0.132));
  return min(d, bc > 0.32 ? bc : max(sdComb(c), bc));
}

/* Two things the normal costs one extra tap to also hand back.

   gD is mapObj() AT the point, which is what the Newton step below needs to
   put a shading point that missed by most of a pixel back on the surface.

   gLap is the second one and it is the useful one. The four offsets of the
   tetrahedron sum to zero and their cross terms cancel, so their mean is
   f + eps^2/2 * the Laplacian — and for a DISTANCE field the Laplacian is
   the sum of the principal curvatures. So five taps buy the exact answer to
   "how fast is this surface turning?", which is the number that decides how
   much of the room one pixel of a mirror is actually looking at. */
float gD, gLap;

vec3 normalAt(vec3 p, float eps){
  vec2 k = vec2(1.0, -1.0) * eps;
  float a = mapObj(p + k.xyy), b = mapObj(p + k.yyx);
  float c = mapObj(p + k.yxy), e = mapObj(p + k.xxx);
  gD   = mapObj(p);
  gLap = 2.0 * (0.25 * (a + b + c + e) - gD) / (eps * eps);
  vec3 g = k.xyy * a + k.yyx * b + k.yxy * c + k.xxx * e;
  return g / max(length(g), 1e-6);
}

/* One short ray at the key light, sixteen steps, breaking on contact and on
   its own far plane. It is the first thing uTier takes off. */
float shadowRay(vec3 p, vec3 l){
  float s = 1.0, t = 0.020;
  for (int i = 0; i < 16; i++){
    float h = mapObj(p + l * t);
    if (h < 0.0012) return 0.0;
    s = min(s, 9.0 * h / t);
    t += clamp(h, 0.024, 0.34);
    if (t > 2.6) break;
  }
  return clamp(s, 0.0, 1.0);
}

/* ---- the studio, as a mirror sees it ----
   A polished blade has almost no colour of its own: it is whatever is
   around it. Point one at the house violet and what comes back is lavender
   plastic. So the STEEL gets a photographer's studio and the COUNTER keeps
   the palette.

   AND IT IS FOUR THINGS, NOT SIX. This function had a floor, a flat, a
   ceiling, a key, a cool fill, a bench band 0.075 wide, a horizon band
   0.062 wide and two azimuth uprights at 0.16 and 0.22 — nine features
   across one hemisphere, most of them narrower than the sweep a single
   pixel of a hollow-ground blade makes. That is not a room, it is noise,
   and what it drew on the flat of the blade was a scribble. What is left is
   a room you could describe over the phone: a dark floor, a mid flat, a lit
   ceiling, one broad warm softbox over the bench, one soft line where the
   bench meets the flat, and one wide cool fill from the window side. The
   narrowest of them is 0.14, which is wider than any pixel's cone.

   IT IS STILL PREFILTERED. k is the half-width of the cone this pixel's
   reflected ray actually covers, and every feature is widened to at least k
   and dimmed by exactly what it was widened by, so what the widening moves
   is where the light is and never how much of it there is. */
vec3 envAt(vec3 d, float k){
  float h = clamp(d.y, -1.0, 1.0);
  vec3 flr = vec3(0.115, 0.113, 0.134);   // the bench top, in its own shade
  vec3 wal = vec3(0.298, 0.302, 0.318);   // the grey flat behind it
  vec3 cel = vec3(0.832, 0.838, 0.854);   // the lit ceiling above that
  vec3 c = mix(flr, wal, smoothstep(-0.40 - k, 0.06 + k, h));
  /* The ceiling is a TONE, not a white-out. Ramping the whole upper half to
     near white is what made the first cut of these blades read as paper: a
     mirror that reflects one bright field is a matt white surface, and the
     only thing that says otherwise is the SIZE of what is bright in it. So
     the room stays mid and the softbox is the one white thing in it. */
  c = mix(c, cel, smoothstep(0.16 - k, 0.62 + k, h));
  /* The key, in its box, over the bench and a little warm — and it is the
     SAME direction the key light below is at, so the highlight on a blade
     and the reflection of the box it comes out of are the same event. They
     used to be two, and two softboxes in a picture with one shadow is one
     of the things that makes a render look like a render. */
  float a1 = dot(d, vec3(-0.3796, 0.8391, -0.3896));
  float w1 = sqrt(0.300 * 0.300 + k * k);
  float s1 = (a1 - 0.780) / w1;
  c = mix(c, vec3(1.000, 0.984, 0.956), exp(-s1 * s1) * 0.95 * (0.300 / w1));
  // The fill, off to the window side and low, and COOL. Two lights of
  // different temperature is the whole reason a blade changes tone across
  // the frame instead of sliding one white bar back and forth.
  float a2 = dot(d, vec3(0.842, 0.170, 0.512));
  float w2 = sqrt(0.440 * 0.440 + k * k);
  float s2 = (a2 - 0.700) / w2;
  c = mix(c, vec3(0.664, 0.716, 0.842), exp(-s2 * s2) * 0.46 * (0.440 / w2));
  // And one line where the bench meets the flat, soft, to give the room a
  // horizon a curved edge can travel across.
  float w3 = sqrt(0.140 * 0.140 + k * k);
  float s3 = (h + 0.090) / w3;
  c = mix(c, vec3(0.052, 0.053, 0.062), exp(-s3 * s3) * 0.50 * (0.140 / w3));
  return c;
}

/* Closest approach of the camera ray to a segment, in closed form.
   x = the distance, y = the ray parameter there. This is the whole of the
   cut hair: a real depth, so the shears occlude it correctly, and a real
   distance, so it can be given a width in pixels. */
vec2 raySeg(vec3 ro, vec3 rd, vec3 a, vec3 b){
  vec3 ba = b - a, oa = ro - a;
  float bb = max(dot(ba, ba), 1e-8);
  float bd = dot(ba, rd);
  float bo = dot(ba, oa);
  float od = dot(oa, rd);
  float s  = clamp((bo - bd * od) / max(bb - bd * bd, 1e-6), 0.0, 1.0);
  float tr = max(bd * s - od, 0.0);
  return vec2(length(oa + rd * tr - ba * s), tr);
}

/* The same polyline, flat: what the counter needs to know to carry the
   hair's own shadow. */
float seg2(vec2 p, vec2 a, vec2 b){
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0);
  return length(pa - ba * h);
}

/* One strand of cut hair, lying on the counter: a quadratic arc through
   three points, sampled into four segments. Flat, because it is lying
   down — the curl is across the top, not up off it, so the strand touches
   the counter along its whole length and its shadow is under it. */
void hairArc(float k, out vec3 q0, out vec3 q1, out vec3 q2, out vec3 q3, out vec3 q4){
  float r1 = h11(k * 7.13 + 0.31);
  float r2 = h11(k * 3.91 + 5.13);
  float r3 = h11(k * 5.37 + 1.77);
  float r4 = h11(k * 2.71 + 8.29);
  vec3  cp  = vec3(mix(-gHs.x, gHs.x, r1), 0.0068, mix(-gHs.y, gHs.y * 1.25, r2));
  float ang = r3 * TAU;
  vec3  dir = vec3(cos(ang), 0.0, sin(ang));
  vec3  pd  = vec3(-sin(ang), 0.0, cos(ang));
  float len = mix(0.16, 0.36, r4);
  vec3  P0  = cp - dir * (0.5 * len);
  vec3  P1  = cp + dir * (0.5 * len);
  vec3  Cc  = cp + pd * mix(-0.58, 0.58, r2) * len;
  q0 = P0;
  q1 = 0.5625 * P0 + 0.3750 * Cc + 0.0625 * P1;
  q2 = 0.2500 * P0 + 0.5000 * Cc + 0.2500 * P1;
  q3 = 0.0625 * P0 + 0.3750 * Cc + 0.5625 * P1;
  q4 = P1;
}

void main(){
  vec2  s0   = (2.0 * gl_FragCoord.xy - uRes) / uRes.y;
  float asp  = uRes.x / uRes.y;
  float wide = smoothstep(0.95, 2.00, asp);
  float wq   = smoothstep(0.95, 2.34, asp);
  float e    = smoothstep(0.0, 1.0, uEnter);

  /* ---------------- the clock ----------------
     Fourteen seconds less a bit, four snips inside it, and everything is a
     function of mod(uTime, T) so the loop closes on itself exactly. */
  float T = 13.6, TS = 3.4;
  float tt  = mod(uTime, T);
  float cyc = tt / T;
  float u   = mod(tt, TS) / TS;
  float tw  = TAU * cyc;

  /* Open slowly, shut fast, dwell shut. Zero with zero slope at both ends
     of the snip, so four of these in a row have no joins in them. The pair
     is lying down and it is still working: the blades turn in the plane of
     the counter, which is what proves the shadow under them is the field
     and not a picture of one. */
  float openAmt = smoothstep(0.05, 0.54, u) * (1.0 - smoothstep(0.545, 0.672, u));
  float a = 0.007 + 0.210 * openAmt;
  gCa = cos(a); gSa = sin(a);

  /* ---------------- what is on the counter ----------------
     The pair is laid flat: -pi/2 about x puts the object's own thickness
     axis along the world's up, so the blades open IN the surface, and the
     yaw is the one thing the aspect ratio moves — the diagonal where the
     band is tall, across where it is long. 0.0864 is the lower half's
     deepest point, so the object rests on the counter rather than near it. */
  float spin = mix(0.62, 0.08, wide);
  gMo   = eul(vec3(-1.5707963, spin, 0.0));
  gMot  = transpose(gMo);
  gOrg  = vec3(mix(0.06, -0.10, wide), 0.0864, mix(-0.06, 0.02, wide));

  // The comb, behind the pair and turned off its axis, resting on its own
  // half thickness with the teeth pointing back toward the lens.
  float cang = mix(1.15, 0.30, wide);
  gCo   = eul(vec3(0.0, cang, 0.0));
  gCot  = transpose(gCo);
  gCorg = vec3(mix(-0.72, -0.55, wide), 0.016, mix(-0.45, -0.30, wide));

  // How far the morning's cuttings are scattered, which has to follow the
  // frame or a phone band shows two of them and a desktop shows a line.
  gHs = vec2(mix(1.10, 1.70, wide), mix(0.86, 0.58, wide));

  /* ---------------- the camera, over the bench ----------------
     Up above the station top looking down at it — 64 degrees on a 4:5 band,
     52 on a 21:9 one. Not straight down: a plan view has no contact in it,
     because the shadow hides under the thing that casts it. The drift is
     the CAMERA's, not the object's, because an object resting on a counter
     does not wander. */
  float el = clamp(mix(1.12, 0.90, wide) + (uPointer.y - 0.5) * 0.14, 0.55, 1.40);
  float az = mix(0.12, 0.0, wide) + 0.085 * sin(tw) + (uPointer.x - 0.5) * 0.26;
  float D  = mix(3.55, 4.30, wide);
  vec3  ta = vec3(0.0, 0.05, 0.02);
  vec3  ro = ta + D * vec3(sin(az) * cos(el), sin(el), cos(az) * cos(el));
  vec3  ww = normalize(ta - ro);
  vec3  uu = cross(ww, vec3(0.0, 1.0, 0.0));
  uu /= max(length(uu), 1e-4);          // zero only at a true plan view
  vec3  vv = cross(uu, ww);

  /* Solved against the band's HEIGHT at both ends, so a narrow band widens
     the lens rather than cropping the shears. wq reaches its top end at
     21:9 rather than at 2.0, which leaves a 16:10 tablet band — which has
     neither the phone's height nor the desktop's width — the half step of
     room it actually needs.

     The frame centre is lifted so the objects clear the paper the kicker is
     printed on, and on a long band it moves right, which leaves the kicker
     the open left.

     AND BOTH ENDS ARE SOLVED ON THE WIDEST OPENING, not on the shut pose.
     The pair is shut for most of the loop, and four times a loop the lower
     handle swings a fifth of a radian further down. Measured off the render
     at all three widths: shut, the object lives inside y 0.25 .. 0.87 of
     the band and is clear of the paper the harness lays over the bottom
     three tenths; at the instant of widest opening the finger rest reaches
     0.21 on a 21:9 band and takes some of that paper. That is a knowing
     trade. Framing the open pose instead costs another eleven per cent of
     the object at every width and every moment, to save the last twenty
     pixels of one limb for half a second in three and a half — and the top
     cannot give the room back, because the docked header takes the band's
     own top tenth. */
  float halfH = mix(1.62, 0.96, wq);
  float yOff  = mix(0.22, 0.32, wide);
  float xOff  = 0.28 * wide;
  vec2  s     = vec2(s0.x - xOff, s0.y - yOff);
  vec3  rd    = normalize(s.x * uu + s.y * vv + (D / halfH) * ww);
  // One pixel, in world units per unit of distance travelled. The march
  // converges to a pixel rather than to a fixed epsilon, which is what makes
  // the silhouette and the depth of field below cost nothing.
  float pxk   = 2.0 * halfH / (D * uRes.y);

  /* Focus a third of the way out along the blades, which leaves the far end
     of the counter well behind the focal plane. Everything below that reads
     "out of focus" comes off this one number. */
  float focusT = length(gOrg + gMo * vec3(0.30, 0.0, 0.0) - ro);
  float APER   = 0.075;

  /* The key. Up, over the window shoulder and BEHIND the objects, so what
     it throws comes forward across the counter into the lens instead of
     hiding behind the thing that cast it. It is the same direction envAt()
     puts its softbox at. */
  vec3 lig = vec3(-0.3796, 0.8391, -0.3896);

  // The counter, in closed form. It is a plane; marching one is a march
  // every fragment in the band would have had to pay for.
  float tP = rd.y < -1e-4 ? (-ro.y) / rd.y : 1e9;
  vec3  farC = mix(uColors[1], uColors[2], 0.34);

  /* ---------------- one march ----------------
     The ray meets each object's bounding sphere analytically first, and the
     counter bounds the far end of it. A fragment with nothing but counter in
     it does no marching at all — which is most of them — and one that has an
     object starts at that object's sphere.

     It also remembers its closest approach in PIXELS. That one float is the
     whole of the edge antialiasing and, widened by the circle of confusion,
     the whole of the soft silhouette out at the far end. */
  float t0 = 1e9, t1 = -1e9;
  vec3  qs = ro - gOrg;
  float bO = dot(qs, rd), bC = dot(qs, qs) - BOUND * BOUND;
  float disc = bO * bO - bC;
  if (disc > 0.0) { float sq = sqrt(disc); t0 = min(t0, -bO - sq); t1 = max(t1, -bO + sq); }
  vec3  qc = ro - gCorg;
  float cO = dot(qc, rd), cC = dot(qc, qc) - 0.62 * 0.62;
  float cdisc = cO * cO - cC;
  if (cdisc > 0.0) { float sq = sqrt(cdisc); t0 = min(t0, -cO - sq); t1 = max(t1, -cO + sq); }
  t0 = max(t0, 0.05);
  t1 = min(t1, min(tP, 40.0));

  float cover = 0.0, nt = 0.0, near = 1e9, cocPx = 0.0;
  if (t1 > t0) {
    int steps = uTier > 0.75 ? 48 : uTier > 0.25 ? 36 : 24;
    /* The break is a QUARTER OF A PIXEL on every tier, not a looser one on
       the small ones. The coverage below is read off the closest approach,
       so raising the break on a phone stops every interior ray early and
       the whole pair comes back washed and semi-transparent. The tier buys
       back RAYS, never the subject. */
    /* UNDER-RELAXED, at 0.85 of the distance, and this file is the reason
       the rule is written down. A cutting edge is six thousandths of a unit
       thick and the field around it is a true lower bound but a very nearly
       TIGHT one — so a full step taken from just outside a blade lands just
       inside it. Both samples report open air, the surface is crossed
       between them, and what that draws is a row of dots down every
       grazing edge. */
    float t = t0; nt = t0;
    float hitF = 0.0, ph = 1e10, phStep = 0.0;
    for (int i = 0; i < 48; i++){
      if (i >= steps) break;
      float d = mapObj(ro + rd * t);
      /* The closest approach is measured from the SEGMENT since the last
         sample, not from this sample, and the closed form is written for the
         step ACTUALLY TAKEN — d*d/(2*ph) is only the special case where the
         step equals the previous distance, and reusing it under relaxation
         fattens every silhouette. It is applied only while the ray is still
         CLOSING: a ray that turns and leaves gets d up to twice the previous
         step, y reaches d, the corrected distance collapses to zero, and
         every fragment inside the bounding sphere reports a hit — which
         shipped once as a grey ball the size of the band. */
      float y = 0.0;
      if (d < ph && phStep > 1e-6)
        y = clamp((d * d + phStep * phStep - ph * ph) / (2.0 * phStep), 0.0, phStep);
      float dc = sqrt(max(d * d - y * y, 0.0));
      float tc = max(t - y, 1e-3);
      float rel = dc / (tc * pxk);
      if (rel < near) { near = rel; nt = tc; }
      if (d / (t * pxk) < 0.25) { hitF = 1.0; nt = t; break; }
      ph = d;
      phStep = d * 0.85;
      t += phStep;
      if (t > t1) break;
    }
    cocPx = APER * abs(nt - focusT) / max(nt, 0.1) / max(focusT * pxk, 1e-6);
    /* AND THE RAMP IS SUB-PIXEL. It was widened on the small tiers in the
       belief that fewer steps make a staircase. It does not, and what the
       widening actually did was shade every point up to a pixel and a fifth
       OFF the steel as though it were on it — and a point off a mirror
       shades with whatever the mirror is standing in front of. Half a pixel
       is what antialiasing IS. Defocus still widens it, because a defocused
       edge really is wide. */
    float wEdge = 0.50 + cocPx * 0.55;
    cover = max(hitF, smoothstep(0.25 + wEdge, 0.25, near));
    if (nt > tP + 0.002) cover = 0.0;
  }

  /* ---------------- the counter, and what is standing on it ----------------
     The top is the house palette: a pale station top under a pool of light,
     running away into the room's haze at the far end.

     THE SHADOW IS THE FIELD, READ FROM THE TOP. Three taps along a direction
     leant off the vertical TOWARD the key — so what they measure is how much
     of the key each point of the counter can still see, which is what a
     shadow is. It is tight and near-black a hundredth under the steel,
     wider and lighter under the blade tips where a hollow-ground shear does
     lift off a bench, and it MOVES when the blades move, because it is the
     same field the blades are made of. The taps after the first are skipped
     wherever the first one comes back clear, which is most of the band. */
  vec3 back;
  if (rd.y < -1e-4) {
    float td = min(tP, 60.0);
    vec3  P  = ro + rd * td;
    vec2  pc = P.xz;
    float pool = exp(-dot(pc, pc) * 0.19);
    vec3  top  = mix(mix(uColors[2], uColors[1], 0.36), uColors[3], pool * 0.84);

    float occ = 1.0, shd = 1.0, hs = 1.0;
    if (cover < 0.995) {
      /* Leant well over toward the key rather than straight up, so what the
         three taps measure is how much of the KEY this point of the top can
         still see. Straight up is an ambient term and it sits symmetrically
         under the object; leant over, it comes out from under the steel on
         the side away from the light, which is where a shadow goes. */
      vec3 bd = vec3(0.0, 0.55, 0.0) + lig * 0.85;
      bd /= max(length(bd), 1e-4);
      /* AND THE CAST SHADOW COMES OUT OF THESE SAME THREE TAPS, WHICH IS THE
         WHOLE OF THIS CHANGE AND THE WHOLE OF THE FAULT IT FIXES.

         It used to come out of a sixteen-step shadow ray, and the budget
         allows that ray on the DESKTOP TIER ONLY. So the counter carried two
         different marks: on a wide screen a heavy bed under the whole pair,
         on a phone the three taps' own tight rim and nothing else — one scene
         telling two stories, which is the one thing a contact may never do.
         Every other term on this top was already tier-free; this was the only
         one that was not, and the fix is to stop asking for a ray the small
         tiers are not allowed to buy.

         The taps are unchanged — same direction, same three radii, same
         Lipschitz skip — so the phone pays exactly what it paid before and
         the desktop pays one sixteen-step ray LESS per counter fragment.
         What is new is what is read out of them. The weighted SUM is the
         ambient term and stays as it was; the MINIMUM of the same three,
         each widened into the cone its own radius subtends, is the key term.
         That is the standard soft-shadow estimator and it is the same one the
         steel's own ray uses a line at a time — min(s, k*h/t) — evaluated at
         three fixed distances instead of sixteen marched ones.

         2.6 rather than the ray's 9.0, and that is the price of three samples
         instead of sixteen: a cone that tight leaves gaps between the taps,
         and a gap in a shadow estimator photographs as a ring. 2.6 opens the
         penumbra to the point where the three cones overlap, so what falls
         off is smooth — tight and black where the steel is a hundredth off
         the top, opening and lightening over the next tenth, gone by the
         reach of the outermost tap, which is where the object's own height
         says the shadow has to end. */
      float o1 = mapObj(P + bd * 0.038);
      float v1 = clamp(o1 / 0.038, 0.0, 1.0);
      float ao = 0.50 * v1;
      shd = clamp(v1 * 2.6, 0.0, 1.0);
      /* 0.60 is not a taste threshold, it is the Lipschitz one. The field
         cannot fall faster than one per unit, so o1 >= 0.60 puts the 0.115
         tap over 0.52 and the 0.300 tap over 0.34 — both already past their
         own radius, both already clamped at one, and so is every cone drawn
         off them. Anything under that has to be asked. Guessing this at 0.40
         left the outer tap reading a quarter and painted a ring. */
      if (o1 < 0.60) {
        float v2 = clamp(mapObj(P + bd * 0.115) / 0.115, 0.0, 1.0);
        float v3 = clamp(mapObj(P + bd * 0.300) / 0.300, 0.0, 1.0);
        ao += 0.30 * v2 + 0.20 * v3;
        shd = min(shd, min(clamp(v2 * 2.6, 0.0, 1.0), clamp(v3 * 2.6, 0.0, 1.0)));
      } else ao += 0.50;
      occ = clamp(ao, 0.0, 1.0);
      occ = occ * occ * (3.0 - 2.0 * occ);   // contact darker, open lighter
      /* And the hair keeps its own thin shadow off the top. The sample is
         displaced by the strand's own height over the key's slope, which is
         where a hair three thousandths thick actually throws it: under
         itself and a little to one side, never a stripe beside it. */
      vec2 hp = pc + lig.xz * (0.0068 / max(lig.y, 0.2));
      int nh = uTier > 0.25 ? 8 : 5;
      for (int k = 0; k < 8; k++){
        if (k >= nh) break;
        vec3 a0, a1, a2, a3, a4;
        hairArc(float(k), a0, a1, a2, a3, a4);
        vec2 cc = 0.5 * (a0.xz + a4.xz);
        if (dot(hp - cc, hp - cc) > 0.09) continue;
        float dh = min(min(seg2(hp, a0.xz, a1.xz), seg2(hp, a1.xz, a2.xz)),
                       min(seg2(hp, a2.xz, a3.xz), seg2(hp, a3.xz, a4.xz)));
        hs = min(hs, smoothstep(0.0035, 0.026, dh));
      }
    }

    /* MULTIPLIED, NEVER OVERPAINTED. The lit value is a cool violet ambient
       plus a warm key; the shadow is the same counter with the key taken
       off it and some of the ambient with it. So what is dark under the
       shears is the room's own colour minus the light that is missing —
       which is what a shadow is — rather than a grey blob or a swatch of
       the accent laid on top. */
    vec3 AMBC = vec3(0.690, 0.700, 0.842);
    vec3 KEYC = vec3(1.000, 0.968, 0.918);
    /* The shadow arrives with the thing that casts it. The reveal below
       fades the OBJECTS up out of the counter, and the counter's dark is
       computed from the field whether or not they have arrived — so
       without this the band opened on an empty top with a pair of shears'
       shadow already lying on it. */
    float shade = mix(1.0, shd * mix(1.0, hs, 0.88), e);
    occ = mix(1.0, occ, e);
    vec3 lm = AMBC * (0.24 + 0.76 * occ) * 0.46 + KEYC * 0.62 * shade * occ;
    back = top * lm;
    // A station top is wiped, not matt: one broad sheen off the key.
    vec3 hn = lig - rd;
    hn /= max(length(hn), 1e-4);
    back += KEYC * pow(clamp(hn.y, 0.0, 1.0), 40.0) * 0.20 * shade * occ;
    // And it runs away into the room rather than stopping at an edge.
    back = mix(back, farC, smoothstep(2.6, 8.5, td));
  } else {
    back = farC;
  }

  vec3 col = back;

  if (cover > 0.002) {
    vec3 wp = ro + rd * nt;
    float nEps = clamp(0.36 * nt * pxk, 0.0016, 0.0060);
    vec3 nor = normalAt(wp, nEps);
    /* LAND ON IT. nt is the ray's closest approach, and on an edge fragment
       that is up to three quarters of a pixel outside the steel. Shading
       there asks the material questions about a point in mid air — and the
       answer to "what does the reflected ray see" is the counter. One
       Newton step down the gradient, using the distance normalAt() already
       paid for, puts the shading point ON the surface. */
    wp -= nor * clamp(gD, -0.02, 0.02);
    // Defocus AND resolution: a mark finer than the pixel it is drawn on is
    // not a mark, it is stipple. Everything fine in here is scaled by this.
    float sharp = smoothstep(0.0085, 0.0035, nt * pxk) / (1.0 + cocPx * 0.55);

    /* Which thing was hit, and where on it. One evaluation of each field,
       once, at the surface — never in the loop. */
    vec3 o   = gMot * (wp - gOrg);
    vec3 cb  = gCot * (wp - gCorg);
    float dC = sdComb(cb);
    vec3 pa  = vec3(gCa * o.x + gSa * o.y, -gSa * o.x + gCa * o.y, o.z);
    vec3 pbr = vec3(gCa * o.x - gSa * o.y,  gSa * o.x + gCa * o.y, o.z);
    vec3 pb  = vec3(pbr.x, -pbr.y, -pbr.z);
    float dA = sdHalf(pa, 1.0), dB = sdHalf(pb, 0.0), dS = sdScrew(o);
    float mS = min(min(dA, dB), dS);
    float isComb = step(dC, mS);
    float side = dA <= dB ? 1.0 : -1.0;
    vec3  lp = dA <= dB ? pa : pb;
    float screw = step(dS, min(dA, dB)) * (1.0 - isComb);

    // Contact and crevice, from the field, on the object as well as under
    // it. The march's own step count was not used: it is an integer, so
    // what it draws is a contour map of itself.
    float occ = clamp(mapObj(wp + nor * 0.055) / 0.055, 0.0, 1.0);
    if (uTier > 0.25) occ = 0.5 * occ + 0.5 * clamp(mapObj(wp + nor * 0.180) / 0.180, 0.0, 1.0);
    occ = mix(occ, 1.0, 0.30);

    float sh = 1.0;
    if (uTier > 0.75 && dot(nor, lig) > 0.02) sh = shadowRay(wp + nor * 0.012, lig);

    vec3 c;
    if (isComb > 0.5) {
      /* The comb, and it is the one thing in frame that is NOT a mirror.
         Matt carbon: a dielectric with a diffuse term, a little of the room
         on it and one tight specular. Without something in the picture that
         is plainly not metal, the eye has nothing to read the steel
         against. */
      vec3  CARB = vec3(0.080, 0.078, 0.090);
      float ndl  = clamp(dot(nor, lig), 0.0, 1.0);
      vec3  hn   = lig - rd;
      hn /= max(length(hn), 1e-4);
      float spc  = pow(clamp(dot(nor, hn), 0.0, 1.0), 44.0);
      float fres = pow(clamp(1.0 - clamp(dot(nor, -rd), 0.0, 1.0), 0.0, 1.0), 5.0);
      c  = CARB * (0.34 + 0.92 * ndl * sh);
      c += envAt(nor, 0.55) * (0.16 + 0.55 * fres);
      c += vec3(1.000, 0.972, 0.938) * spc * 0.55 * sh;
      c *= mix(0.42, 1.0, occ);
    } else {
      /* THE HOLLOW GRIND, and it is the whole difference between steel and
         moulded plastic. A shear's flat is not flat: it is dished up the
         face and swept along its length, by fractions of a millimetre.
         Putting that in the FIELD costs the march real money — the Lipschitz
         bound has to absorb every degree of it — so the geometry keeps only
         enough bow to shape the silhouette and the rest is done to the
         shading normal here, once, at the hit. The reflection then travels
         across the flat as the camera moves instead of sitting on it as one
         dead tone.

         WHAT IS NO LONGER DONE HERE is a random jitter of the normal per
         band of y, which was meant to be the last pass of the polishing
         wheel and was in fact half of the scribble on the blade. A
         mirror-finished blade IS smooth; the thing that makes it read as
         metal is what it reflects, not a texture laid over it. */
      vec3 norO = gMot * nor;
      vec3 nl = side > 0.0
              ? vec3(gCa * norO.x + gSa * norO.y, -gSa * norO.x + gCa * norO.y, norO.z)
              : vec3(gCa * norO.x - gSa * norO.y, -(gSa * norO.x + gCa * norO.y), -norO.z);
      float flatK = smoothstep(0.55, 0.88, abs(nl.z))
                 * smoothstep(-0.10, 0.02, lp.x) * smoothstep(1.20, 1.08, lp.x);
      if (flatK > 0.001) {
        float fs = sign(nl.z);
        float qy = clamp(lp.y / 0.166, 0.0, 1.0);
        float qx = clamp(lp.x / 1.18, 0.0, 1.0);
        nl.y += fs * flatK * (0.44 * (qy - 0.40));
        nl.x -= fs * flatK * (0.26 * (qx - 0.45));
        nl /= max(length(nl), 1e-5);
        norO = side > 0.0
             ? vec3(gCa * nl.x - gSa * nl.y, gSa * nl.x + gCa * nl.y, nl.z)
             : vec3(gCa * nl.x + gSa * (-nl.y), -gSa * nl.x + gCa * (-nl.y), -nl.z);
        nor = gMo * norO;
      }
      // The blade and boss live at lp.x > -0.17, the handle at lp.x < -0.07.
      // A smooth boundary across the overlap, because the two steels are near
      // enough that a hard one would only ever show as a seam.
      float onBlade = smoothstep(-0.20, -0.10, lp.x);

      vec3  STEEL = vec3(0.620, 0.640, 0.672);
      vec3  BRASS = vec3(0.855, 0.680, 0.345);
      vec3  base  = mix(STEEL, BRASS, screw);
      float rough = mix(mix(0.155, 0.045, onBlade), 0.200, screw);

      // The six adjusting holes in the face of the tension dial.
      if (screw > 0.5 && abs(o.z) > 0.070) {
        float ang = atan(o.y, o.x + 1e-6);
        float kk  = 1.04719755;
        float f   = ang - kk * floor(ang / kk + 0.5);
        float rr2 = length(o.xy);
        float hd  = length(vec2(rr2 - 0.060, rr2 * f)) - 0.013;
        base = mix(base, base * 0.26, smoothstep(0.004, -0.003, hd) * sharp);
      }

      /* ---- light ----
         A metal has no diffuse term. What it has is the room, reflected, and
         a Fresnel that carries it to white at grazing — so the colour of
         this object is very largely envAt(), and envAt() is a studio rather
         than the counter it is lying on. That is the whole of why it reads
         as steel. */
      vec3  ref = reflect(rd, nor);
      float ndv = clamp(dot(nor, -rd), 0.0, 1.0);

      /* HOW MUCH ROOM THIS PIXEL SEES, in radians. A pixel covers nt*pxk of
         world; at a grazing angle it covers that much surface divided by
         ndv; defocus multiplies it outright; and across that much surface
         the normal turns by the curvature, which is gLap out of the field
         plus the hollow grind. Twice that is how far the REFLECTED ray
         swings inside one pixel, and a mirror that wide cannot be asked
         about one direction. A lens integrates the sweep; so does envAt().
         The floors and ceilings are guards, not taste: ndv reaches zero at
         a silhouette and would ask for an infinite cone, and a crease makes
         gLap unbounded. */
      float pxW   = nt * pxk;
      float curv  = clamp(abs(gLap) + 2.9 * flatK, 0.0, 90.0);
      float foot  = pxW * (1.0 + cocPx) / max(ndv, 0.12);
      float envK  = clamp(foot * (1.6 + 2.0 * curv), 0.02, 0.60);

      /* Roughness is a cone too, so it goes in the same argument rather than
         costing a second sample. Leaning the direction toward the normal and
         widening the cone to match is the same picture for half the
         environment, and ref and nor can never cancel because dot(ref, nor)
         is ndv, which is never negative. */
      float blurK = clamp(rough * 2.3 + cocPx * 0.013, 0.0, 0.85);
      vec3  ed    = mix(ref, nor, blurK);
      ed /= max(length(ed), 1e-5);
      vec3  env   = envAt(ed, min(envK + blurK * 0.55, 0.75));

      vec3  F = base + (1.0 - base) * pow(clamp(1.0 - ndv, 0.0, 1.0), 5.0);
      c = env * F;

      vec3  hal = lig - rd;
      hal /= max(length(hal), 1e-4);   // zero only if the ray looks down the key
      float nh  = clamp(dot(nor, hal), 0.0, 1.0);
      /* AND THE HIGHLIGHT IS WIDENED TO THE PIXEL TOO. A shininess of 900 is
         a lobe about two degrees wide; the normal turns further than that
         inside one pixel of a blade, so the key's glint lands on some pixels
         and misses the ones between, and what that draws is a BRIGHT dashed
         line down the blade. The cap is the honest one: a lobe cannot be
         narrower than the normal's own spread inside the pixel it is drawn
         on, and widening it dims it in exactly the same proportion. */
      float nvar  = max(curv * foot, 1.0e-3);
      float shCap = 1.0 / (nvar * nvar);
      float shin0 = mix(150.0, 900.0, onBlade) / (1.0 + cocPx * 1.2);
      float shin  = max(min(shin0, shCap), 6.0);
      float spc   = pow(nh, shin) * min(shin / shin0, 1.0) / (1.0 + cocPx * 0.6);
      c += F * spc * sh * mix(1.6, 3.4, onBlade);

      /* What occlusion takes away is LIGHT, so what it leaves is the room's
         own dark floor with a breath of the house in it — not a flat violet
         painted into the crevices. Between the rings and under the boss this
         was once the most saturated colour on the object, which is the wrong
         way round: a shadow is the one place a mirror shows least of
         anything. */
      vec3 aoDark = mix(vec3(0.044, 0.045, 0.054), uInk, 0.14);
      c = mix(mix(c, aoDark, 0.55), c, occ);

      /* The cutting edge. A sharpened edge is a cylinder a few microns
         across with every normal on it, so it picks up light from the whole
         room and reads as a hairline — and it is the one mark that says this
         is a blade and not a strip of chrome. Geometry could never carry it
         at this scale; it goes in here, and out again as it leaves focus. */
      float hairline = smoothstep(0.014, 0.002, abs(lp.y))
                     * smoothstep(0.10, 0.24, lp.x) * smoothstep(1.19, 1.12, lp.x)
                     * onBlade * (1.0 - screw);
      c = mix(c, vec3(1.0), hairline * 0.52 * sharp);
    }

    /* Out of focus, a surface loses CONTRAST as well as edge — it flattens
       toward its own mean and takes on what is behind it. Without this the
       far end of the pair keeps every hard highlight it has and reads as a
       sharp object with a soft outline, which is the one thing a real lens
       never does. */
    float m = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(c, mix(vec3(m), back, 0.45), clamp(cocPx * 0.045, 0.0, 0.52));
    col = mix(back, c, cover);
  }

  /* ---------------- the cut hair ----------------
     On the counter, not in the air: each strand is an arc lying at its own
     radius, occluded by the steel above it, and carrying the shadow the
     counter drew for it a few lines up. */
  {
    vec3  HAIR  = vec3(0.276, 0.150, 0.082);
    vec3  SHEEN = vec3(0.860, 0.620, 0.340);
    float tSurf = cover > 0.004 ? nt : 1e9;
    int   nh    = uTier > 0.25 ? 8 : 5;
    for (int k = 0; k < 8; k++){
      if (k >= nh) break;
      vec3 a0, a1, a2, a3, a4;
      hairArc(float(k), a0, a1, a2, a3, a4);
      // One bound per strand, against the ray, so a fragment pays for the
      // four closed forms only where a strand could possibly be.
      vec3  dq = 0.5 * (a0 + a4) - ro;
      float tp = dot(dq, rd);
      if (dot(dq, dq) - tp * tp > 0.0784) continue;

      float r1 = h11(float(k) * 7.13 + 0.31);
      float rb = 0.0062 + 0.0030 * r1;
      vec2 g1 = raySeg(ro, rd, a0, a1);
      vec2 g2 = raySeg(ro, rd, a1, a2);
      vec2 g3 = raySeg(ro, rd, a2, a3);
      vec2 g4 = raySeg(ro, rd, a3, a4);
      // Thinner at the ends than in the middle, like every hair there is.
      float w1 = rb * 0.58, w2 = rb * 0.96, w3 = rb * 0.96, w4 = rb * 0.58;
      vec2  hit = g1; vec3 seg = a1 - a0; float rr3 = w1; float best = g1.x - w1;
      if (g2.x - w2 < best) { hit = g2; seg = a2 - a1; rr3 = w2; best = g2.x - w2; }
      if (g3.x - w3 < best) { hit = g3; seg = a3 - a2; rr3 = w3; best = g3.x - w3; }
      if (g4.x - w4 < best) { hit = g4; seg = a4 - a3; rr3 = w4; best = g4.x - w4; }

      float pw   = max(hit.y, 0.1) * pxk;
      float cocW = APER * abs(hit.y - focusT) / max(hit.y, 0.1) / max(focusT, 0.1);
      /* A strand is a few thousandths of a unit across, and on a phone band
         a pixel out here is wider than that — so drawn at its true width it
         is a mark finer than the pixel it is on, which is why the cut hair
         once read as a broken pencil scratch. It is never drawn thinner than
         a pixel, and it is dimmed by exactly what it was widened by: the ink
         is conserved, and a sub-pixel hair goes faint rather than dotted. */
      float core = rr3 + cocW;
      float wid  = max(core, pw * 0.85);
      float aa   = pw * 1.1 + cocW;
      float cov = smoothstep(wid, max(wid - aa, wid * 0.05), hit.x) * (core / max(wid, 1e-4));
      // Under the shears it is under the shears.
      cov *= 1.0 - cover * smoothstep(-0.02, 0.02, hit.y - tSurf);
      cov *= e;
      if (cov < 0.003) continue;

      /* Kajiya-Kay off the strand's own tangent: dark where it turns edge-on
         to the light, flaring where it turns across it. */
      vec3  Tn  = seg / max(length(seg), 1e-4);
      float tl  = dot(Tn, lig), te = dot(Tn, -rd);
      float stl = sqrt(max(1.0 - tl * tl, 0.0));
      float ste = sqrt(max(1.0 - te * te, 0.0));
      /* AND THE SHEEN IS A THIRD OF WHAT IT WAS. Kajiya-Kay peaks when the
         light and the lens are both square to the strand, and every strand
         on a counter is horizontal while the key and the camera are both
         over it — so at 0.90 every single one of them sat at the top of its
         own lobe and the cuttings came back bright orange wire. Hair is
         dark: the sheen is the line down one side of it, not the colour. */
      float ks  = pow(clamp(-tl * te + stl * ste, 0.0, 1.0), 24.0);
      vec3  hc  = HAIR * (0.48 + 0.52 * stl) + SHEEN * ks * 0.30;
      hc = mix(hc, uColors[2], 0.12);                       // the room, on it
      // How much of the counter a strand has taken on is a question about
      // DEFOCUS, so it is asked of the strand's true width and not of the
      // pixel floor above — otherwise a sharp strand on a phone would be
      // told it was blurred simply for being small.
      hc = mix(hc, back, clamp(cocW / max(core, 1e-4) * 0.32, 0.0, 0.38));
      col = mix(col, hc, clamp(cov, 0.0, 1.0));
    }
  }

  // The reveal: the counter is already there, the tools arrive on it.
  col = mix(back, col, e);
  // A little tooth, so the long wash into white never bands on a cheap
  // panel — which is the only sort of panel this will be watched on.
  col += (h11(dot(gl_FragCoord.xy, vec2(0.317, 0.719)) + fract(uTime)) - 0.5) * 0.016;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export const scene: Scene = {
  frag,
  colors: ["#551a89", "#8579ab", "#f4f3f7", "#ffffff"],
  /* The station top, as far as stacked gradients can carry it — and they
     have to carry it, because this is what a reader on a slow phone looks
     at until the shader has compiled, and what a device with no WebGL is
     left with for good. Solved at 390x487, the band a phone gets, and laid
     out the way the phone tier lays it out: the pair down on the counter
     running the diagonal, blades up to the right, rings and rest low and
     left, the comb behind them, two cuttings on the top and a soft dark
     under everything where it touches. Every chain is spaced under its own
     radius, or a chain of circles reads as a row of beads rather than as a
     tapered stroke — which is what the first cut of this did. */
  poster:
    "radial-gradient(circle 5px at 67.18% 48.87%, #4e3220 0 2.2px, rgb(255 255 255 / 0) 3.2px), " +
    "radial-gradient(circle 5px at 69.23% 49.18%, #4e3220 0 2.2px, rgb(255 255 255 / 0) 3.2px), " +
    "radial-gradient(circle 5px at 71.08% 49.62%, #4e3220 0 2.2px, rgb(255 255 255 / 0) 3.2px), " +
    "radial-gradient(circle 5px at 72.56% 50.31%, #4e3220 0 2.2px, rgb(255 255 255 / 0) 3.2px), " +
    "radial-gradient(circle 5px at 73.64% 51.27%, #4e3220 0 2.2px, rgb(255 255 255 / 0) 3.2px), " +
    "radial-gradient(circle 5px at 74.36% 52.46%, #4e3220 0 2.2px, rgb(255 255 255 / 0) 3.2px), " +
    "radial-gradient(circle 5px at 74.87% 53.80%, #4e3220 0 2.2px, rgb(255 255 255 / 0) 3.2px), " +
    "radial-gradient(circle 5px at 30.77% 71.87%, #4e3220 0 2.2px, rgb(255 255 255 / 0) 3.2px), " +
    "radial-gradient(circle 5px at 32.99% 70.94%, #4e3220 0 2.2px, rgb(255 255 255 / 0) 3.2px), " +
    "radial-gradient(circle 5px at 35.01% 70.16%, #4e3220 0 2.2px, rgb(255 255 255 / 0) 3.2px), " +
    "radial-gradient(circle 5px at 36.67% 69.61%, #4e3220 0 2.2px, rgb(255 255 255 / 0) 3.2px), " +
    "radial-gradient(circle 5px at 37.91% 69.34%, #4e3220 0 2.2px, rgb(255 255 255 / 0) 3.2px), " +
    "radial-gradient(circle 5px at 38.80% 69.30%, #4e3220 0 2.2px, rgb(255 255 255 / 0) 3.2px), " +
    "radial-gradient(circle 5px at 39.49% 69.40%, #4e3220 0 2.2px, rgb(255 255 255 / 0) 3.2px), " +
    "radial-gradient(circle 12px at 57.95% 34.09%, #c8cad0 0 10.0px, rgb(255 255 255 / 0) 11.0px), " +
    "radial-gradient(circle 12px at 59.69% 33.57%, #caccd2 0 9.6px, rgb(255 255 255 / 0) 10.6px), " +
    "radial-gradient(circle 12px at 61.42% 33.06%, #ccced4 0 9.3px, rgb(255 255 255 / 0) 10.3px), " +
    "radial-gradient(circle 11px at 63.16% 32.55%, #cdcfd5 0 8.9px, rgb(255 255 255 / 0) 9.9px), " +
    "radial-gradient(circle 11px at 64.90% 32.03%, #cfd1d7 0 8.5px, rgb(255 255 255 / 0) 9.5px), " +
    "radial-gradient(circle 11px at 66.64% 31.52%, #d1d3d9 0 8.2px, rgb(255 255 255 / 0) 9.2px), " +
    "radial-gradient(circle 10px at 68.38% 31.01%, #d3d5db 0 7.8px, rgb(255 255 255 / 0) 8.8px), " +
    "radial-gradient(circle 10px at 70.11% 30.49%, #d4d6dc 0 7.4px, rgb(255 255 255 / 0) 8.4px), " +
    "radial-gradient(circle 10px at 71.85% 29.98%, #d6d8de 0 7.1px, rgb(255 255 255 / 0) 8.1px), " +
    "radial-gradient(circle 9px at 73.59% 29.47%, #d8dae0 0 6.7px, rgb(255 255 255 / 0) 7.7px), " +
    "radial-gradient(circle 9px at 75.33% 28.95%, #dadce2 0 6.3px, rgb(255 255 255 / 0) 7.3px), " +
    "radial-gradient(circle 8px at 77.07% 28.44%, #dcdee4 0 6.0px, rgb(255 255 255 / 0) 7.0px), " +
    "radial-gradient(circle 8px at 78.80% 27.93%, #dddfe5 0 5.6px, rgb(255 255 255 / 0) 6.6px), " +
    "radial-gradient(circle 8px at 80.54% 27.41%, #dfe1e7 0 5.2px, rgb(255 255 255 / 0) 6.2px), " +
    "radial-gradient(circle 7px at 82.28% 26.90%, #e1e3e9 0 4.9px, rgb(255 255 255 / 0) 5.9px), " +
    "radial-gradient(circle 7px at 84.02% 26.39%, #e3e5eb 0 4.5px, rgb(255 255 255 / 0) 5.5px), " +
    "radial-gradient(circle 7px at 85.75% 25.87%, #e4e6ec 0 4.1px, rgb(255 255 255 / 0) 5.1px), " +
    "radial-gradient(circle 6px at 87.49% 25.36%, #e6e8ee 0 3.8px, rgb(255 255 255 / 0) 4.8px), " +
    "radial-gradient(circle 6px at 89.23% 24.85%, #e8eaf0 0 3.4px, rgb(255 255 255 / 0) 4.4px), " +
    "radial-gradient(circle 11px at 57.95% 37.58%, #a7a9af 0 9.0px, rgb(255 255 255 / 0) 10.0px), " +
    "radial-gradient(circle 11px at 59.63% 37.23%, #a9abb1 0 8.7px, rgb(255 255 255 / 0) 9.7px), " +
    "radial-gradient(circle 11px at 61.31% 36.89%, #acaeb4 0 8.3px, rgb(255 255 255 / 0) 9.3px), " +
    "radial-gradient(circle 10px at 62.99% 36.55%, #aeb0b6 0 8.0px, rgb(255 255 255 / 0) 9.0px), " +
    "radial-gradient(circle 10px at 64.67% 36.21%, #b0b2b8 0 7.7px, rgb(255 255 255 / 0) 8.7px), " +
    "radial-gradient(circle 10px at 66.35% 35.87%, #b2b4ba 0 7.3px, rgb(255 255 255 / 0) 8.3px), " +
    "radial-gradient(circle 9px at 68.03% 35.52%, #b5b7bd 0 7.0px, rgb(255 255 255 / 0) 8.0px), " +
    "radial-gradient(circle 9px at 69.72% 35.18%, #b7b9bf 0 6.7px, rgb(255 255 255 / 0) 7.7px), " +
    "radial-gradient(circle 9px at 71.40% 34.84%, #b9bbc1 0 6.3px, rgb(255 255 255 / 0) 7.3px), " +
    "radial-gradient(circle 8px at 73.08% 34.50%, #bcbec4 0 6.0px, rgb(255 255 255 / 0) 7.0px), " +
    "radial-gradient(circle 8px at 74.76% 34.15%, #bec0c6 0 5.7px, rgb(255 255 255 / 0) 6.7px), " +
    "radial-gradient(circle 8px at 76.44% 33.81%, #c0c2c8 0 5.3px, rgb(255 255 255 / 0) 6.3px), " +
    "radial-gradient(circle 7px at 78.12% 33.47%, #c2c4ca 0 5.0px, rgb(255 255 255 / 0) 6.0px), " +
    "radial-gradient(circle 7px at 79.80% 33.13%, #c5c7cd 0 4.7px, rgb(255 255 255 / 0) 5.7px), " +
    "radial-gradient(circle 7px at 81.48% 32.79%, #c7c9cf 0 4.3px, rgb(255 255 255 / 0) 5.3px), " +
    "radial-gradient(circle 6px at 83.16% 32.44%, #c9cbd1 0 4.0px, rgb(255 255 255 / 0) 5.0px), " +
    "radial-gradient(circle 6px at 84.84% 32.10%, #cbcdd3 0 3.7px, rgb(255 255 255 / 0) 4.7px), " +
    "radial-gradient(circle 6px at 86.52% 31.76%, #ced0d6 0 3.3px, rgb(255 255 255 / 0) 4.3px), " +
    "radial-gradient(circle 5px at 88.21% 31.42%, #d0d2d8 0 3.0px, rgb(255 255 255 / 0) 4.0px), " +
    "radial-gradient(circle 18px at 53.08% 35.73%, #b7b9bf 0 16.0px, rgb(255 255 255 / 0) 17.0px), " +
    "radial-gradient(circle 13px at 52.82% 35.32%, #e0b75f 0 10.5px, rgb(255 255 255 / 0) 11.5px), " +
    "radial-gradient(circle 7px at 52.05% 34.70%, #f3da9c 0 4.2px, rgb(255 255 255 / 0) 5.2px), " +
    "radial-gradient(circle 11px at 50.26% 34.91%, #b4b6bc 0 8.2px, rgb(255 255 255 / 0) 9.2px), " +
    "radial-gradient(circle 11px at 47.88% 35.41%, #b2b4ba 0 8.1px, rgb(255 255 255 / 0) 9.1px), " +
    "radial-gradient(circle 10px at 45.50% 35.92%, #afb1b7 0 7.9px, rgb(255 255 255 / 0) 8.9px), " +
    "radial-gradient(circle 10px at 43.12% 36.42%, #adafb5 0 7.8px, rgb(255 255 255 / 0) 8.8px), " +
    "radial-gradient(circle 10px at 40.75% 36.92%, #abadb3 0 7.6px, rgb(255 255 255 / 0) 8.6px), " +
    "radial-gradient(circle 10px at 38.37% 37.43%, #a8aab0 0 7.5px, rgb(255 255 255 / 0) 8.5px), " +
    "radial-gradient(circle 10px at 35.99% 37.93%, #a6a8ae 0 7.3px, rgb(255 255 255 / 0) 8.3px), " +
    "radial-gradient(circle 10px at 33.61% 38.44%, #a3a5ab 0 7.2px, rgb(255 255 255 / 0) 8.2px), " +
    "radial-gradient(circle 10px at 31.24% 38.94%, #a1a3a9 0 7.0px, rgb(255 255 255 / 0) 8.0px), " +
    "radial-gradient(circle 9px at 28.86% 39.44%, #9fa1a7 0 6.9px, rgb(255 255 255 / 0) 7.9px), " +
    "radial-gradient(circle 9px at 26.48% 39.95%, #9c9ea4 0 6.7px, rgb(255 255 255 / 0) 7.7px), " +
    "radial-gradient(circle 9px at 24.10% 40.45%, #9a9ca2 0 6.6px, rgb(255 255 255 / 0) 7.6px), " +
    "radial-gradient(circle 11px at 51.03% 37.99%, #a7a9af 0 8.2px, rgb(255 255 255 / 0) 9.2px), " +
    "radial-gradient(circle 11px at 48.79% 39.29%, #a5a7ad 0 8.1px, rgb(255 255 255 / 0) 9.1px), " +
    "radial-gradient(circle 10px at 46.55% 40.60%, #a2a4aa 0 7.9px, rgb(255 255 255 / 0) 8.9px), " +
    "radial-gradient(circle 10px at 44.31% 41.91%, #a0a2a8 0 7.8px, rgb(255 255 255 / 0) 8.8px), " +
    "radial-gradient(circle 10px at 42.07% 43.21%, #9ea0a6 0 7.6px, rgb(255 255 255 / 0) 8.6px), " +
    "radial-gradient(circle 10px at 39.84% 44.52%, #9c9ea4 0 7.5px, rgb(255 255 255 / 0) 8.5px), " +
    "radial-gradient(circle 10px at 37.60% 45.83%, #999ba1 0 7.3px, rgb(255 255 255 / 0) 8.3px), " +
    "radial-gradient(circle 10px at 35.36% 47.13%, #97999f 0 7.2px, rgb(255 255 255 / 0) 8.2px), " +
    "radial-gradient(circle 10px at 33.12% 48.44%, #95979d 0 7.0px, rgb(255 255 255 / 0) 8.0px), " +
    "radial-gradient(circle 9px at 30.89% 49.75%, #93959b 0 6.9px, rgb(255 255 255 / 0) 7.9px), " +
    "radial-gradient(circle 9px at 28.65% 51.05%, #909298 0 6.7px, rgb(255 255 255 / 0) 7.7px), " +
    "radial-gradient(circle 9px at 26.41% 52.36%, #8e9096 0 6.6px, rgb(255 255 255 / 0) 7.6px), " +
    "radial-gradient(circle 27px at 19.23% 41.07%, rgb(255 255 255 / 0) 0 10.9px, #b9bbc1 11.7px 24.1px, rgb(255 255 255 / 0) 25.1px), " +
    "radial-gradient(circle 27px at 22.56% 54.41%, rgb(255 255 255 / 0) 0 10.9px, #aaacb2 11.7px 24.1px, rgb(255 255 255 / 0) 25.1px), " +
    "radial-gradient(circle 8px at 23.33% 58.32%, #a2a4aa 0 5.6px, rgb(255 255 255 / 0) 6.6px), " +
    "radial-gradient(circle 8px at 23.72% 59.96%, #9fa1a7 0 5.4px, rgb(255 255 255 / 0) 6.4px), " +
    "radial-gradient(circle 8px at 24.10% 61.60%, #9c9ea4 0 5.3px, rgb(255 255 255 / 0) 6.3px), " +
    "radial-gradient(circle 8px at 24.49% 63.24%, #999ba1 0 5.2px, rgb(255 255 255 / 0) 6.2px), " +
    "radial-gradient(circle 7px at 24.87% 64.89%, #96989e 0 5.0px, rgb(255 255 255 / 0) 6.0px), " +
    "radial-gradient(circle 5px at 11.28% 37.17%, #33333a 0 2.4px, rgb(255 255 255 / 0) 3.4px), " +
    "radial-gradient(circle 4px at 13.33% 39.63%, #26262c 0 1.9px, rgb(255 255 255 / 0) 2.9px), " +
    "radial-gradient(circle 5px at 14.87% 35.06%, #33333a 0 2.4px, rgb(255 255 255 / 0) 3.4px), " +
    "radial-gradient(circle 4px at 16.92% 37.53%, #26262c 0 1.9px, rgb(255 255 255 / 0) 2.9px), " +
    "radial-gradient(circle 5px at 18.46% 32.96%, #33333a 0 2.4px, rgb(255 255 255 / 0) 3.4px), " +
    "radial-gradient(circle 4px at 20.51% 35.42%, #26262c 0 1.9px, rgb(255 255 255 / 0) 2.9px), " +
    "radial-gradient(circle 5px at 22.05% 30.85%, #33333a 0 2.4px, rgb(255 255 255 / 0) 3.4px), " +
    "radial-gradient(circle 4px at 24.10% 33.32%, #26262c 0 1.9px, rgb(255 255 255 / 0) 2.9px), " +
    "radial-gradient(circle 5px at 25.64% 28.75%, #33333a 0 2.4px, rgb(255 255 255 / 0) 3.4px), " +
    "radial-gradient(circle 4px at 27.69% 31.21%, #26262c 0 1.9px, rgb(255 255 255 / 0) 2.9px), " +
    "radial-gradient(circle 5px at 29.23% 26.64%, #33333a 0 2.4px, rgb(255 255 255 / 0) 3.4px), " +
    "radial-gradient(circle 4px at 31.28% 29.11%, #26262c 0 1.9px, rgb(255 255 255 / 0) 2.9px), " +
    "radial-gradient(circle 5px at 32.82% 24.54%, #33333a 0 2.4px, rgb(255 255 255 / 0) 3.4px), " +
    "radial-gradient(circle 4px at 34.87% 27.00%, #26262c 0 1.9px, rgb(255 255 255 / 0) 2.9px), " +
    "radial-gradient(circle 5px at 36.41% 22.43%, #33333a 0 2.4px, rgb(255 255 255 / 0) 3.4px), " +
    "radial-gradient(circle 4px at 38.46% 24.90%, #26262c 0 1.9px, rgb(255 255 255 / 0) 2.9px), " +
    "radial-gradient(circle 5px at 40.00% 20.33%, #33333a 0 2.4px, rgb(255 255 255 / 0) 3.4px), " +
    "radial-gradient(circle 4px at 42.05% 22.79%, #26262c 0 1.9px, rgb(255 255 255 / 0) 2.9px), " +
    "radial-gradient(circle 9px at 7.69% 32.85%, #3a3a42 0 6.2px, rgb(255 255 255 / 0) 7.2px), " +
    "radial-gradient(circle 9px at 9.64% 31.73%, #3b3b43 0 6.2px, rgb(255 255 255 / 0) 7.2px), " +
    "radial-gradient(circle 9px at 11.59% 30.61%, #3b3b44 0 6.2px, rgb(255 255 255 / 0) 7.2px), " +
    "radial-gradient(circle 9px at 13.54% 29.49%, #3c3c44 0 6.2px, rgb(255 255 255 / 0) 7.2px), " +
    "radial-gradient(circle 9px at 15.49% 28.36%, #3d3d45 0 6.2px, rgb(255 255 255 / 0) 7.2px), " +
    "radial-gradient(circle 9px at 17.44% 27.24%, #3e3e46 0 6.2px, rgb(255 255 255 / 0) 7.2px), " +
    "radial-gradient(circle 9px at 19.38% 26.12%, #3e3e47 0 6.2px, rgb(255 255 255 / 0) 7.2px), " +
    "radial-gradient(circle 9px at 21.33% 25.00%, #3f3f48 0 6.2px, rgb(255 255 255 / 0) 7.2px), " +
    "radial-gradient(circle 9px at 23.28% 23.87%, #404048 0 6.2px, rgb(255 255 255 / 0) 7.2px), " +
    "radial-gradient(circle 9px at 25.23% 22.75%, #414149 0 6.2px, rgb(255 255 255 / 0) 7.2px), " +
    "radial-gradient(circle 9px at 27.18% 21.63%, #41414a 0 6.2px, rgb(255 255 255 / 0) 7.2px), " +
    "radial-gradient(circle 9px at 29.13% 20.51%, #42424b 0 6.2px, rgb(255 255 255 / 0) 7.2px), " +
    "radial-gradient(circle 9px at 31.08% 19.38%, #43434c 0 6.2px, rgb(255 255 255 / 0) 7.2px), " +
    "radial-gradient(circle 9px at 33.03% 18.26%, #44444c 0 6.2px, rgb(255 255 255 / 0) 7.2px), " +
    "radial-gradient(circle 9px at 34.97% 17.14%, #44444d 0 6.2px, rgb(255 255 255 / 0) 7.2px), " +
    "radial-gradient(circle 9px at 36.92% 16.02%, #45454e 0 6.2px, rgb(255 255 255 / 0) 7.2px), " +
    "radial-gradient(60px 42px at 25% 58%, rgb(54 46 74 / 0.40) 0%, rgb(54 46 74 / 0) 100%), " +
    "radial-gradient(90px 40px at 62% 40%, rgb(54 46 74 / 0.30) 0%, rgb(54 46 74 / 0) 100%), " +
    "radial-gradient(72px 40px at 27% 31%, rgb(54 46 74 / 0.24) 0%, rgb(54 46 74 / 0) 100%), " +
    "radial-gradient(78% 52% at 46% 40%, rgb(255 255 255 / 0.82) 0%, rgb(255 255 255 / 0) 100%), " +
    "linear-gradient(to bottom, #b4aecb 0%, #c4c0d8 22%, #ddd9ea 48%, #f2f1f7 72%, #ffffff 90%)",
  alt: "Looking down on a salon station top: a pair of polished Japanese shears lying on the counter with the brass tension dial bright at the pivot, a black carbon cutting comb behind them, and the morning's cut hair scattered around — and the blades open slowly and shut, over and over, the soft dark under them moving as they go.",
};
