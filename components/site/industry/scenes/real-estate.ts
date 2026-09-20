import type { Scene } from "../shader-stage";

/* ------------------------------------------------------------------ *
 * Real estate — the front door, opening.
 *
 * What stood here before was a picture of light crossing an empty room:
 * pretty, flat, and drawn rather than built. The note back was that the
 * set had to be made of THINGS — real objects, real materials, real
 * light, and one verb each. This trade's verb is OPENS, and the only
 * object in estate agency that opens is the one the whole job turns on.
 *
 *   the object   a panelled front door, 900 by 1960, four panels in the
 *                Victorian arrangement, a letterplate across the lock
 *                rail and an aged brass lever on the stile. Painted a
 *                deep bottle green, hung in a white architrave in a
 *                rendered wall, with a stone sill under it. It is the
 *                door a negotiator opens for somebody at half five on a
 *                Tuesday, and the door that does not get opened at 8:48
 *                on a Wednesday because the branch shut two hours ago.
 *
 *   the motion   it OPENS. Twelve seconds: shut for two, swinging in
 *                over three with a small settle at the end of the travel
 *                the way a real leaf finishes on its hinges, standing
 *                open for four and a half — breathing a degree either
 *                way, because a door held open by nothing is never quite
 *                still — then easing back to shut. And the point of it
 *                is what happens on the ground: with the door shut the
 *                paving outside is the site's own cool violet-grey, and
 *                as the leaf swings the hall lamp gets out and lays a
 *                warm wedge across the threshold that widens over the
 *                flags until the door is standing open.
 *
 *   the camera   three-quarter on from the lock side, at standing
 *                height, drifting in as the door opens and back out as
 *                it closes. The pointer nudges the angle a few degrees.
 *                The drift is driven by the door's own opening rather
 *                than by the clock, so it cannot introduce a seam the
 *                door itself does not have.
 *
 * THE LIGHT, WHICH IS THE WHOLE SCENE. The warm spill is not a painted
 * gradient. It is a real shadow, solved analytically, twice per shaded
 * point and never inside the march:
 *
 *   1. the APERTURE. Run the segment from the hall lamp to the point
 *      back to the plane of the wall and ask whether it crossed inside
 *      the doorway. That is the doorway's own projection, and it widens
 *      with distance for free, which is what a real one does.
 *   2. the LEAF. Ask whether that same segment crosses the plane of the
 *      door, and if it does, whether it crosses within the leaf. That is
 *      the door's shadow, and because the plane turns with the door, the
 *      shadow sweeps as it opens. Shut, it covers the opening exactly
 *      and nothing outside is lit at all.
 *
 * Both edges get a penumbra that grows with the occluder-to-receiver
 * distance, so the line at the threshold is sharp and the far end of the
 * wedge is soft. It costs two dot products and a divide, it is identical
 * on a phone and on a workstation, and it is the reason this reads as
 * light rather than as an airbrush.
 *
 * WHAT IT COSTS, and the two things that are not marched.
 *
 * The GROUND is one plane and the WALL is another, both intersected
 * exactly. That is not only cheaper than marching them, it is the fix
 * for a bug this file shipped once: a ray running nearly parallel to a
 * flat wall converges on it a few millimetres a step, so the far end of
 * a 21:9 band ran out of march steps and blended into the sky, leaving a
 * vertical seam across the render that no amount of step budget cured.
 * A plane has a closed-form hit and no such thing can happen. The wall
 * plane is used everywhere except the rectangle the architrave stands
 * in, which the march owns; both analytic hits then CAP the march's far
 * plane, so the great flat expanse of a long band costs two box fields
 * and about two steps a pixel.
 *
 * What is left to march is the doorway itself, and it sits inside one
 * conservative box with the leaf inside a second box within that. A
 * bound is only ever returned while it is unmistakably larger than the
 * march's hit threshold, and the occlusion taps deliberately read the
 * UNBOUNDED field: a bound is an underestimate, and an underestimate
 * read as an occlusion distance paints a visible shell of false shadow
 * in the air around whatever it was bounding.
 *
 * There is no shadow ray at any tier, and that is a decision rather than
 * an economy. The one dramatic shadow in this picture — the door's own,
 * on the ground — is already exact and already free, and a second
 * marched one would have had to read the bounds and would have cast the
 * shadow of a box. So all three tiers get the same picture and the tier
 * buys back nothing but march steps.
 *
 * COLOUR. The environment is the site's and the object is its own. The
 * render, the paving, the architrave, the haze and every shadow are
 * mixes of uColors and uInk. Three literals, each because the thing
 * really is that colour: bottle green for the paint, aged brass for the
 * furniture, and tungsten for the lamp in the hall, which is the only
 * warm thing anywhere in the frame. The green is never lit in isolation
 * — the violet sky is in its sheen and its shadows go toward uInk, which
 * is what stops it looking pasted onto somebody else's wall.
 *
 * FRAMING. The door's vertical extent never changes, so the field of
 * view is solved against the band's HEIGHT: the head of the architrave
 * sits just under the top of the frame and the threshold above the paper
 * the kicker is printed on, at 4:5, 16:10 and 21:9 alike. What changes
 * with the aspect is only where it sits — centred on a phone, at 62% of
 * the width on a long band, which gives the kicker the open left and the
 * wedge of light somewhere to spread.
 * ------------------------------------------------------------------ */

const frag = `
#define FAR 12.0

/* The hinge is on the far side from the camera, so the leaf turns its
   panelled face TOWARD the lens as it swings in rather than away. */
const vec3 HINGE  = vec3(-0.455, 0.0, 0.0);
/* The lamp in the hall: over head height, a little to the lock side, a
   metre and a half back from the opening. A bare inverse square from a
   point a metre off the leaf delivers four times white to it, so the
   falloff below carries the lamp's own size in its denominator and what
   it can deliver is capped — which is what a shade does. */
const vec3 LAMP   = vec3(0.200, 1.780, -1.520);
const vec3 WARM   = vec3(1.000, 0.692, 0.362);   // tungsten, and the only warm thing here
const vec3 PAINT  = vec3(0.142, 0.298, 0.228);   // bottle green, semi-gloss
const vec3 BRASS  = vec3(0.790, 0.632, 0.330);   // aged brass
const vec3 PATINA = vec3(0.245, 0.208, 0.112);   // and what sits in its crevices
const vec3 KEY    = vec3(-0.4206, 0.7210, 0.5507); // the cool exterior key, unit length
/* The wall's outer face and the rectangle of it the architrave stands
   in, which is the one part of the wall the march owns. */
#define WALLZ 0.090
#define FOOTX 0.595
#define FOOTY 2.115

/* Resolved once a fragment and read by the field. Globals rather than
   arguments: map() is called a few dozen times a pixel and none of this
   changes between calls. */
float gC, gS, gOpen;
vec3  gSky, gGnd, gKeyC;

float hash21(vec2 p){
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
/* normalize() of a vector that can be zero is undefined, and there are
   four places below whose argument is a difference of two things that
   could in principle coincide. */
vec3 nrm(vec3 v){ float l = length(v); return l > 1e-6 ? v / l : vec3(0.0, 1.0, 0.0); }

/* One mortar joint between two flags, filtered against the pixel that is
   reading it: the distance to the joint's centre line, the joint's half
   width, and half the pixel's footprint — and the footprint is different
   along the path and across it, which is why this takes it rather than
   assuming it. Once the pixel is wider than the joint the joint's
   CONTRIBUTION falls away instead of the band widening: widen it and the
   path grows three-centimetre grout as it recedes, hold the band at its
   built width and the far courses break into a dotted line. Both are the
   same failure as the grid this replaced — a pattern sampled at a spacing
   it was never meant to survive. */
float jointLine(float d, float w, float h){
  return clamp(0.5 + (w - d) / (2.0 * h), 0.0, 1.0) * min(1.0, w / h);
}

/* ---- primitives, all exact ---- */
float sdBox3(vec3 p, vec3 b){
  vec3 d = abs(p) - b;
  return min(max(d.x, max(d.y, d.z)), 0.0) + length(max(d, 0.0));
}
float sdRBox(vec3 p, vec3 b, float r){
  vec3 d = abs(p) - b + r;
  return min(max(d.x, max(d.y, d.z)), 0.0) + length(max(d, 0.0)) - r;
}
float sdCylZ(vec3 p, float r, float h){
  vec2 d = vec2(length(p.xy) - r, abs(p.z) - h);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

/* World -> the leaf's own frame: a rigid rotation about the hinge line,
   so the field inside stays exact however far the door has swung. x runs
   across the leaf, y up it, z out through its outer face. */
vec3 toDoor(vec3 p){
  vec3 q = p - HINGE;
  return vec3(q.x * gC - q.z * gS - 0.450, q.y - 1.025, q.x * gS + q.z * gC);
}

/* ---- the leaf ----
   A 900 x 1960 slab with four panels sunk into it. The panels are cut
   from BOTH faces at once — abs(z) mirrors the cut — because that is
   what a panelled door is: a thin board held in a frame of stiles and
   rails, not a groove routed into a plank. The two columns are mirrored
   in x for the same reason, so two rounded boxes buy four panels.

   The proportions are a Victorian four-panel, measured rather than
   guessed: 105mm stiles, a 200mm bottom rail, a 190mm lock rail with
   room on it for a letterplate, and a top rail half the bottom's depth.
   The cut runs from 4.5mm off the centre line out past the face, so what
   is left in the panel is a 9mm board in an 18mm recess, and the 12mm
   rounding on it is the moulding: the cove where a stile turns down into
   a panel, which is the whole of what tells a reader at a glance that
   this is a panelled door and not a slab. */
float sdWood(vec3 p){
  float d = sdRBox(p, vec3(0.450, 0.980, 0.0225), 0.006);
  vec3 q = vec3(abs(p.x) - 0.213, p.y, abs(p.z) - 0.0235);
  float up = sdRBox(vec3(q.x, q.y - 0.3775, q.z), vec3(0.132, 0.4775, 0.019), 0.012);
  float lo = sdRBox(vec3(q.x, q.y + 0.5350, q.z), vec3(0.132, 0.2450, 0.019), 0.012);
  return max(d, -min(up, lo));
}

/* ---- the brass ----
   A letterplate across the lock rail and a lever on the stile, both
   mirrored through the leaf so there is furniture on the hall side too.
   The lever points back toward the hinge, which is the way a lever is
   hung, and it is cranked down off its rose. */
float sdBrass(vec3 p){
  float az = abs(p.z);
  float d = sdRBox(vec3(p.x, p.y + 0.195, az - 0.0265), vec3(0.166, 0.049, 0.005), 0.004);
  vec2 h = vec2(p.x - 0.390, p.y + 0.105);
  d = min(d, sdCylZ(vec3(h, az - 0.0285), 0.042, 0.006));           // rose
  d = min(d, sdCylZ(vec3(h, az - 0.0400), 0.015, 0.012));           // neck
  d = min(d, sdRBox(vec3(h.x + 0.072, h.y + 0.016, az - 0.0530),    // lever
                    vec3(0.074, 0.0115, 0.0105), 0.0095));
  return d;
}

/* The letterplate's aperture: a 35mm slot taken out of the plate and the
   wood behind it. It is a recess and not a hole on purpose — a 35mm slot
   through a 45mm door is a tunnel, and a 24-step march on a phone does
   not get down one. The web at the back of it is shaded as what you
   would see through it, which is a lit hall. */
float sdApert(vec3 p){
  return sdBox3(vec3(p.x, p.y + 0.195, abs(p.z) - 0.0415), vec3(0.132, 0.0175, 0.026));
}

float sdLeaf(vec3 p){
  /* The leaf's own bound, sized to the geometry and not a millimetre
     over, so the shell where the bound takes over is invisible in the
     occlusion taps below. Returned only while it is far larger than the
     march's hit threshold. */
  float lb = sdBox3(p, vec3(0.452, 0.982, 0.070));
  if (lb > 0.06) return lb;
  return max(min(sdWood(p), sdBrass(p)), -sdApert(p));
}

/* ---- everything that stands in the doorway ----
   The lining (the wall's own thickness, which is the reveal you see when
   the door is open), the architrave proud of the face, the stone sill,
   and the leaf. Unbounded: this is the field the occlusion taps read. */
float sdGroup(vec3 p){
  float opn = sdBox3(p - vec3(-0.0025, 1.025, 0.0), vec3(0.4565, 0.9840, 0.42));
  float d = max(sdBox3(p - vec3(-0.0025, 1.050, -0.015), vec3(0.605, 1.050, 0.105)), -opn);
  d = min(d, max(sdRBox(p - vec3(-0.0025, 1.062, 0.108), vec3(0.6025, 1.062, 0.018), 0.008), -opn));
  d = min(d, sdRBox(p - vec3(-0.0025, 0.026, 0.022), vec3(0.660, 0.028, 0.122), 0.008));
  return min(d, sdLeaf(toDoor(p)));
}

/* The far wall of the hall, which is all there is to hit through the
   opening besides the floor. */
float sdHall(vec3 p){ return sdBox3(p - vec3(0.0, 2.40, -2.60), vec3(7.0, 2.40, 0.10)); }

/* The unbounded field, for the occlusion taps and the normal. */
float mapFull(vec3 p){ return min(sdHall(p), sdGroup(p)); }

/* The bounded field, for the march. The box is the doorway's own extent
   over every angle the leaf ever reaches — including the degree of sway
   it keeps while it stands open — with a centimetre and a half of air
   round all of it. It is never handed back below 0.06, which is more
   than twenty times the march's own hit threshold. */
float map(vec3 p){
  float d  = sdHall(p);
  float nb = sdBox3(p - vec3(0.0, 1.065, -0.385), vec3(0.672, 1.072, 0.560));
  return nb > 0.06 ? min(d, nb) : min(d, sdGroup(p));
}

vec3 normalAt(vec3 p){
  vec2 k = vec2(1.0, -1.0) * 0.0014;
  return nrm(k.xyy * mapFull(p + k.xyy) + k.yyx * mapFull(p + k.yyx)
           + k.yxy * mapFull(p + k.yxy) + k.xxx * mapFull(p + k.xxx));
}

/* ---- how much of the hall lamp reaches a point ----
   Two analytic occluders and no march. See the note at the top of the
   file; the only subtlety is the penumbra, which grows with the
   occluder-to-receiver distance and is what puts a hard line at the
   threshold and a soft one at the far end of the wedge. */
float spill(vec3 P){
  float s = 1.0;
  vec3  dv = P - LAMP;

  // 1. the doorway, for anything out in front of the wall. The test is
  //    run wherever the segment actually crosses the plane of the wall
  //    and nowhere else, so it is continuous across it: cutting it in at
  //    some distance in front instead leaves a seam at that distance,
  //    and the leaf's own face passes through any such line as it swings.
  if (P.z > 0.0){
    float tq = -LAMP.z / max(dv.z, 1e-4);        // dv.z >= 1.52 whenever P.z > 0.0
    vec3  Q  = LAMP + dv * tq;
    float pen = clamp(0.030 + 0.34 * (1.0 - tq) / max(tq, 0.12), 0.030, 0.38);
    s *= smoothstep(0.4565 + pen, 0.4565 - pen, abs(Q.x + 0.0025));
    s *= smoothstep(0.9840 + pen, 0.9840 - pen, abs(Q.y - 1.025));
  }

  // 2. the leaf. Its plane turns with it, so this one shadow is the
  //    whole animation: shut, it covers the opening exactly; open, it
  //    has swung clear and the wedge is at its widest.
  vec3  n  = vec3(gS, 0.0, gC);
  float fL = dot(LAMP - HINGE, n);
  float fP = dot(P    - HINGE, n);
  if (fL * fP < 0.0){                            // opposite sides, so the segment crosses
    float td = fL / (fL - fP);                   // non-zero, because the signs differ
    vec3  r  = (LAMP + (P - LAMP) * td) - HINGE;
    float u  = r.x * gC - r.z * gS;              // where on the leaf it crossed
    float pen = clamp(0.030 + 0.30 * (1.0 - td) / max(td, 0.12), 0.030, 0.38);
    float m = smoothstep(-pen, pen, u) * smoothstep(0.900 + pen, 0.900 - pen, u)
            * smoothstep(0.045 - pen, 0.045 + pen, r.y)
            * smoothstep(2.005 + pen, 2.005 - pen, r.y);
    s *= 1.0 - m;
  }
  return s;
}

vec3 envAt(vec3 n){ return mix(gGnd, gSky, clamp(0.5 + 0.5 * n.y, 0.0, 1.0)); }

/* One lighting model for everything in the frame: a cool hemisphere and
   a cool key, which are the site's, plus the hall lamp, which is not.
   Nothing ramps to white — each surface goes from its own shadow to its
   own albedo and only the specular is allowed above that. A ramp ending
   in white lifts an inked joint to the same tone as the stone round it
   and erases every mark in the albedo. */
vec3 lightIt(vec3 P, vec3 N, vec3 rd, vec3 alb,
             float shin, float spec, float metal, float ao, float wv){
  /* How much of the outside a point can see, which is the difference
     between the two halves of this picture. Without it the cool sky lit
     the hall as brightly as it lit the paving, and the one warm thing in
     the frame came back as a white rectangle: a lit hall seen from a
     cold street is warm because nothing cold reaches it, not because the
     lamp is bright. The ramp is a long one and the floor under it is not
     zero, because the mouth of a doorway is not the back of a hall: a
     leaf swung half open stands where plenty of sky still reaches it,
     and a hard ramp turned it into a black slab for a third of the loop.
     It is a straight ramp and not a smoothstep, because a smoothstep has
     an inflection in it and the leaf swings across the whole range: the
     inflection came out as a hard diagonal band painted down the door. */
  float ext = 0.18 + 0.82 * clamp((P.z + 1.40) / 1.62, 0.0, 1.0);

  float kd = clamp(dot(N, KEY), 0.0, 1.0);
  vec3  c  = alb * ext * (envAt(N) * 0.40 * ao + gKeyC * kd * 0.56 * mix(0.45, 1.0, ao));

  vec3  lv = LAMP - P;
  float dl = max(length(lv), 1e-4);
  vec3  lw = lv / dl;
  float w  = min(wv * clamp(dot(N, lw), 0.0, 1.0) * 11.0 / (1.40 + dl * dl), 1.05);
  c += alb * WARM * w;

  /* The fill: everything the light has already bounced off before it got
     here. Small, flat and unconditional — it is what keeps a dark green
     door standing in a doorway's own shadow reading as dark green rather
     than as a hole cut in the wall. */
  c += alb * mix(gGnd, gSky, 0.55) * 0.13;

  vec3 hk = nrm(KEY - rd);
  c += gKeyC * pow(clamp(dot(N, hk), 0.0, 1.0), shin) * spec * ao * ext;
  vec3 hw = nrm(lw - rd);
  c += WARM * pow(clamp(dot(N, hw), 0.0, 1.0), shin) * spec * min(w * 1.6, 1.5);

  // What the surface reflects. Paint takes a little of it; brass is
  // mostly made of it, which is the whole difference between them.
  float fr = clamp(1.0 + dot(N, rd), 0.0, 1.0); fr = fr * fr * fr;
  if (metal > 0.001){
    vec3 er = envAt(reflect(rd, N)) * alb * 1.50 * ext + WARM * alb * wv * 1.05;
    c = mix(c, er * mix(0.55, 1.0, ao), metal * (0.42 + 0.50 * fr));
  } else {
    c += envAt(reflect(rd, N)) * fr * spec * 0.55 * ao * ext;
  }
  return c;
}

void main(){
  vec2  s0   = (2.0 * gl_FragCoord.xy - uRes) / uRes.y;
  float asp  = uRes.x / uRes.y;
  float wide = smoothstep(0.95, 2.00, asp);
  float e    = smoothstep(0.0, 1.0, uEnter);

  gSky  = mix(uColors[2], uColors[3], 0.40);
  gGnd  = mix(uColors[1], uColors[2], 0.26);
  gKeyC = mix(uColors[2], uColors[3], 0.66);

  /* ---------------- the clock ----------------
     Twelve seconds, and every term is built out of cyc so the last frame
     of the loop is the first frame of the loop. At cyc 0 the door is
     shut, so a reader who arrives then watches it open, which is the
     right two seconds to be given first. */
  float T   = 12.0;
  float cyc = fract(uTime / T);
  float a   = smoothstep(0.07, 0.30, cyc);
  float b   = smoothstep(0.66, 0.90, cyc);
  float ua  = 1.0 - a;
  /* Cubic out, so the leaf decelerates into its travel the way weight on
     hinges does, and a small damped settle at the end of it. The settle
     is exactly zero at a = 0 and three ten-thousandths at a = 1, so
     neither end of the swing has a step in it. */
  float oa  = 1.0 - ua * ua * ua + 0.042 * exp(-5.0 * a) * sin(10.5 * a);
  float ob  = b * b * (3.0 - 2.0 * b);
  gOpen = clamp(oa * (1.0 - ob), 0.0, 1.0);

  /* Eighty-four degrees, and the number is a composition decision rather
     than a detail of the hardware. A door hinged on the far side and seen
     three-quarter on swings almost along the line of sight, so at the
     sixty-odd degrees that first stood here the leaf still covered eight
     tenths of its own opening and the frame read as a shut door in a lit
     doorway. At eighty-four it covers half of it, and the other half is
     the hall. The degree of sway on top is a door standing open in a hall
     with air in it. Both are scaled by gOpen, so the shut frames are
     properly still and the seam is exact. */
  float th = 1.466 * gOpen + 0.013 * gOpen * sin(18.8495559 * cyc);
  gC = cos(th); gS = sin(th);

  /* ---------------- the camera ----------------
     Three-quarter on from the lock side at standing height, drifting in
     as the door opens and back out as it shuts. */
  float dolly = gOpen * gOpen * (3.0 - 2.0 * gOpen);
  vec3  ro = vec3(2.148, 1.620, 5.075) + vec3(-0.235, -0.050, -0.552) * dolly;
  ro.x += (uPointer.x - 0.5) * 0.60 + 0.05 * sin(6.2831853 * cyc);
  ro.y += (uPointer.y - 0.5) * 0.28;
  vec3  ta = vec3(-0.04, 1.00, -0.08);
  vec3  ww = nrm(ta - ro);
  vec3  uu = nrm(cross(ww, vec3(0.0, 1.0, 0.0)));
  vec3  vv = cross(uu, ww);
  float D  = length(ta - ro);

  /* The field of view is solved against the band's HEIGHT at every
     aspect, because the door's vertical extent is the one thing that
     never changes: the head of the architrave lands under the top of the
     frame by enough that the site's docked header — which laps the top of
     this band while a reader is scrolling past it — never covers it, and
     the sill lands above the paper the kicker is printed on. The camera
     pulls back a little on a long band rather than ever letting the frame
     crop the door. Horizontally it only moves on a long one —
     centred at 4:5, at 62% of the width at 21:9, which gives the kicker
     the open left and the wedge of light room to spread. */
  float halfH = mix(1.965, 2.025, wide) * (1.0 - 0.060 * dolly);
  float yOff  = mix(0.162, 0.174, wide);
  /* The sideways move has a ramp of its own, later than the one the
     field of view uses: a 16:10 band is not long enough to strand a
     kicker under a centred door, and pushing the door to 62% there only
     left half a tablet band empty. */
  float xOff  = 0.55 * smoothstep(1.30, 2.10, asp);
  vec2  sc = vec2(s0.x - xOff, s0.y - yOff);
  float f  = D / halfH;
  vec3  rd = nrm(sc.x * uu + sc.y * vv + f * ww);
  // One pixel, in world units per unit of distance travelled: the march
  // converges to a pixel rather than to a fixed epsilon, which is what
  // makes the antialiasing below cost nothing.
  float pxk = 2.0 * halfH / (D * uRes.y);

  /* ---------------- the two planes ----------------
     The ground and the wall's outer face, intersected exactly. The wall
     is used everywhere except the rectangle the architrave stands in,
     which the march owns — and the exclusion is a few millimetres inside
     the architrave's own edge, so its rounded corner is drawn over wall
     rather than over a hole. Whichever is nearer caps the march. */
  float tG = -1.0, tW = -1.0;
  if (rd.y < -1e-4){
    float ty = -ro.y / rd.y;
    if (ty > 0.05 && ty < 200.0) tG = ty;
  }
  if (rd.z < -1e-4){
    float tz = (WALLZ - ro.z) / rd.z;
    if (tz > 0.05 && tz < 200.0){
      vec3 Pw = ro + rd * tz;
      if (abs(Pw.x + 0.0025) > FOOTX || Pw.y > FOOTY) tW = tz;
    }
  }
  /* Neither plane is capped at the march's far plane: on a 21:9 band the
     outer rays meet the wall fifteen units out, and an exact hit costs
     the same there as it does at four. They fade into the haze long
     before anyone could read them. */
  float tA = 400.0; int aKind = 0;
  if (tG > 0.0 && tG < tA){ tA = tG; aKind = 1; }
  if (tW > 0.0 && tW < tA){ tA = tW; aKind = 2; }

  /* ---------------- one march ----------------
     It remembers its closest approach in PIXELS, which is the whole of
     the edge antialiasing: a ray that missed by half a pixel is shaded
     where it came nearest and blended in by how near it came. */
  int   steps = uTier > 0.75 ? 48 : uTier > 0.25 ? 36 : 24;
  float t = 0.30, cl = 1e9, nt = t;
  for (int i = 0; i < 48; i++){
    if (i >= steps) break;
    float h = map(ro + rd * t);
    float rel = h / max(t * pxk, 1e-6);
    if (rel < cl){ cl = rel; nt = t; }
    if (rel < 0.35) break;
    t += h * 0.90;
    if (t > min(tA, FAR)) break;
  }
  float cover = smoothstep(1.35, 0.40, cl);

  vec3 haze = mix(uColors[1], uColors[2], 0.42);
  vec3 col  = mix(gGnd, gSky, clamp(0.5 + 0.5 * rd.y, 0.0, 1.0));

  /* ---------------- the ground and the wall ---------------- */
  if (aKind > 0){
    vec3  P = ro + rd * tA;
    vec3  N = aKind == 1 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0);
    vec3  alb; float shin = 22.0, spc = 0.05, ao = 1.0;

    if (aKind == 1 && P.z < 0.0){
      // The hall floor: boards running out toward the door.
      float bd = abs(fract(P.x * 6.6 + 0.5) - 0.5) / 6.6;
      alb = mix(uColors[1], uColors[2], 0.38);
      alb = mix(alb, mix(uColors[0], uColors[1], 0.50), smoothstep(0.011, 0.0, bd) * 0.70);
      shin = 44.0; spc = 0.12;
    } else if (aKind == 1){
      /* The path outside: sawn stone flags, 860 by 580, laid in a RUNNING
         BOND so no joint ever runs the whole depth of the picture.

         What stood here was a square lattice of hairlines on a flat field,
         and a square lattice of hairlines is a debug grid however it is
         coloured — it told the reader they were looking at a viewport
         before they had read a word. The fix is not a finer line; it is
         that the ground stops being made of lines at all.

         None of it costs a march step at any tier. This plane is solved
         rather than marched, so all of it is four hashes and a tilted
         normal, once, on the fragment that already hit the ground. */

      /* The footprint is not one number, and it is not the ray's own width
         either. A pixel lands on this plane as a long thin PARALLELOGRAM,
         and both of its edges have to be counted: a step across the screen
         moves the hit a millimetre, a step down it moves the hit a hand's
         width — and that second edge has a component along BOTH ground
         axes, which is the part that gets forgotten. Forget it and the
         joints running away from the camera stay a built-width line while
         the pixel reading them is wider than they are, which is a dotted
         line and nothing else. Two exact differentials, and then every
         feature is filtered at the size it really is: a 13mm joint has
         gone long before an 860mm flag has. */
      float ry  = min(rd.y, -0.02);                      // this branch only runs for rd.y < 0
      vec3  du  = (uu - rd * (uu.y / ry)) * (tA * pxk);  // the hit moves this far per pixel across
      vec3  dv  = (vv - rd * (vv.y / ry)) * (tA * pxk);  // and this far per pixel down
      float fpx = abs(du.x) + abs(dv.x);                 // so the pixel spans this much world x
      float fpz = abs(du.z) + abs(dv.z);                 // and this much world z
      float hx  = max(0.5 * fpx, 0.0012);                // half that footprint, each way
      float hz  = max(0.5 * fpz, 0.0012);
      float fd  = 1.0 - smoothstep(0.10, 0.34, max(fpx, fpz));  // is a whole flag still resolved?

      float rowf = (P.z - 0.315) / 0.580;
      float row  = floor(rowf);
      // mod() of a negative row is still 0 or 1, so the bond holds on both
      // sides of the origin and the course under the sill is a whole one.
      float colf = (P.x + 0.140 + 0.430 * mod(row, 2.0)) / 0.860;
      vec2  cid  = vec2(floor(colf), row);
      vec2  loc  = vec2(fract(colf), fract(rowf)) - 0.5;

      float ax = (0.5 - abs(loc.x)) * 0.860;             // metres to the joint, each way
      float az = (0.5 - abs(loc.y)) * 0.580;
      float joint = max(jointLine(ax, 0.0065, hx), jointLine(az, 0.0065, hz));

      /* Three things make the reader see a FACE where the grid had a line,
         and a face is the whole of it — a lit plane the size of a flag is
         a thing, a hairline is a diagram.

           the ARRIS, a 12mm edge worn off by weather. Run it at the two
             centimetres it wants to be and every flag gets a bright border
             and a dark one, and the path reads as chamfered ceramic tile;
           the SETTLE, a fraction of a degree of lean, different per flag,
             because no two flags laid on sand are coplanar;
           the DISH, a slight riven curvature across each face, convex on
             one flag and hollow on the next. This is the one that says
             stone rather than tile: a tile is flat and a flag never is,
             and under a single low key the difference is legible at a
             glance even though it is under a millimetre of relief. */
      float arx = (1.0 - smoothstep(0.0065, 0.0125 + hx, ax)) * min(1.0, 0.012 / hx);
      float arz = (1.0 - smoothstep(0.0065, 0.0125 + hz, az)) * min(1.0, 0.012 / hz);
      vec3  nb  = vec3(sign(loc.x) * arx, 0.0, sign(loc.y) * arz) * 0.14;
      nb += vec3(hash21(cid + 11.3) - 0.5, 0.0, hash21(cid + 41.7) - 0.5) * 0.105 * fd;
      nb += vec3(loc.x * (hash21(cid + 7.9) - 0.5), 0.0,
                 loc.y * (hash21(cid + 23.1) - 0.5)) * 0.30 * fd;
      N = nrm(vec3(nb.x, 1.0, nb.z));

      // Each flag its own tone, then the wear: rubbed pale across the face
      // where feet cross it and holding its dirt at the edge.
      alb = mix(uColors[1], uColors[2], 0.42 + 0.11 * (hash21(cid + 3.7) - 0.5) * fd);
      alb *= mix(1.035, 0.945, smoothstep(0.26, 0.50, max(abs(loc.x), abs(loc.y))) * fd);
      alb *= 1.0 + 0.075 * (hash21(floor(vec2(P.x, P.z) * 330.0)) - 0.5)
                 * min(1.0, 0.005 / max(hx, hz));
      alb  = mix(alb, mix(uColors[0], uColors[1], 0.80), joint * 0.50);
      shin = 20.0; spc = 0.06 * (1.0 - 0.72 * joint);
      // The step and the wall keep the sky off the flags at their feet,
      // and this plane is not marched, so it has no occlusion of its own.
      // The mortar sits below the faces either side of it and holds a
      // little of its own shadow, which is what makes the joint a recess
      // rather than a drawn line.
      ao = mix(0.50, 1.0, smoothstep(0.02, 0.72, P.z - 0.14)) * mix(1.0, 0.78, joint);
    } else {
      /* The render. Flat colour would leave a 21:9 band as one unbroken
         field, so it gets a fine tooth, a slow mottle, a soft pool of
         light round the doorway to give the frame a centre, and the
         damp at its foot that every rendered wall has. */
      float gr = hash21(floor(P.xy * 150.0));
      alb  = mix(uColors[1], uColors[2], 0.58);
      alb *= 1.0 + 0.068 * (gr - 0.5) * (1.0 - smoothstep(3.0, 7.0, tA));
      alb *= 1.0 + 0.032 * sin(P.x * 2.1) * sin(P.y * 3.3);
      // A rendered wall is darker where it has been rained on and lighter
      // up under the eaves, and it loses the sky as it runs away from the
      // doorway. Both are gradients rather than a pool, because a pool of
      // light on a flat wall with nothing casting it reads as a mistake.
      alb *= mix(0.80, 1.06, clamp(P.y * 0.30 + 0.24, 0.0, 1.0));
      alb *= mix(1.02, 0.80, smoothstep(0.5, 4.2, abs(P.x)));
      shin = 12.0; spc = 0.03;
      /* What the architrave keeps off the wall. Two terms, because one
         symmetric ring round a proud moulding is not a shadow, it is a
         halo: a tight contact darkening all the way round, and a wider
         one thrown DOWN AND RIGHT, which is where a key up and to the
         left puts it. And then the foot of the wall. */
      vec2  q0 = abs(vec2(P.x + 0.0025, P.y - 1.062)) - vec2(0.6025, 1.062);
      float d0 = length(max(q0, 0.0)) + min(max(q0.x, q0.y), 0.0);
      vec2  q1 = abs(vec2(P.x - 0.0275, P.y - 1.012)) - vec2(0.6025, 1.062);
      float d1 = length(max(q1, 0.0)) + min(max(q1.x, q1.y), 0.0);
      ao = mix(0.76, 1.0, smoothstep(0.0, 0.055, d0))
         * mix(0.86, 1.0, smoothstep(0.0, 0.170, d1))
         * mix(0.72, 1.0, smoothstep(0.0, 0.32, P.y));
    }

    vec3 c = lightIt(P, N, rd, alb, shin, spc, 0.0, ao, spill(P));
    c = mix(c, mix(uInk, uColors[0], 0.5), (1.0 - ao) * 0.26);
    col = mix(c, haze, smoothstep(6.0, 15.0, tA) * 0.74);
  }

  /* ---------------- whatever the march found ---------------- */
  if (cover > 0.002){
    vec3 P = ro + rd * nt;
    vec3 N = normalAt(P);

    /* Which part was hit, and where on it. One evaluation of each field,
       once, at the surface — never in the loop. */
    float opn   = sdBox3(P - vec3(-0.0025, 1.025, 0.0), vec3(0.4565, 0.9840, 0.42));
    float dLin  = max(sdBox3(P - vec3(-0.0025, 1.050, -0.015), vec3(0.605, 1.050, 0.105)), -opn);
    float dArch = max(sdRBox(P - vec3(-0.0025, 1.062, 0.108), vec3(0.6025, 1.062, 0.018), 0.008), -opn);
    float dSill = sdRBox(P - vec3(-0.0025, 0.026, 0.022), vec3(0.660, 0.028, 0.122), 0.008);
    float dBack = sdHall(P);
    vec3  lp    = toDoor(P);
    float dWood = sdWood(lp), dBr = sdBrass(lp);
    float m     = min(min(min(dLin, dArch), min(dSill, dBack)), min(dWood, dBr));

    /* Occlusion from two distance taps along the normal, read off the
       UNBOUNDED field. Never from the step count: that is an integer, so
       what it draws is a contour map of itself across a flat face. */
    float occ = clamp(mapFull(P + N * 0.050) / 0.050, 0.0, 1.0);
    if (uTier > 0.25) occ = 0.5 * occ + 0.5 * clamp(mapFull(P + N * 0.175) / 0.175, 0.0, 1.0);
    occ = mix(occ, 1.0, 0.20);

    float wv = spill(P);
    vec3  alb; float shin, spc, mtl = 0.0, emit = 0.0;

    if (m == dBr){
      /* Aged brass: bright on the faces a thumb reaches and gone dark
         and slightly green where one never does. It is the one thing in
         the frame that carries both lights at once — the violet sky down
         one side of the lever and the hall lamp up the other — which is
         exactly what brass on a front door does. */
      alb  = mix(PATINA, BRASS, clamp(0.20 + 0.88 * occ, 0.0, 1.0));
      shin = 58.0; spc = 1.10; mtl = 0.68;
    } else if (m == dWood){
      /* The paint. A dark bottle green, laid on thick enough to read as
         paint rather than stain: the brush left faint vertical drag in
         it, it is a shade darker down at the bottom rail where less sky
         reaches, and the violet sky is in its sheen. */
      float br = hash21(vec2(floor(lp.x * 230.0), 3.0));
      alb  = PAINT * (0.958 + 0.084 * br) * mix(0.84, 1.05, clamp(P.y / 2.0, 0.0, 1.0));
      shin = 44.0; spc = 0.38;
      // The letterplate's aperture: the web behind the slot, seen as
      // what is behind it, which is a lit hall.
      float slot = step(abs(lp.x), 0.133) * step(abs(lp.y + 0.195), 0.0178)
                 * step(abs(lp.z), 0.0205);
      alb  = mix(alb, vec3(0.050, 0.038, 0.030), slot);
      spc  = mix(spc, 0.03, slot);
      emit = slot * 0.50;
    } else if (m == dArch || m == dLin){
      /* The architrave and the lining behind it: painted near-white,
         which is what makes the green read as green. The lining is a
         shade off it, because a reveal a metre and a half from a lamp
         painted the same white as the architrave clipped to flat paper
         and took the corner of the doorway with it. */
      alb  = m == dLin ? mix(uColors[1], uColors[2], 0.88) : mix(uColors[2], uColors[3], 0.50);
      shin = 32.0; spc = 0.15;
    } else if (m == dSill){
      // The stone step, with a fine aggregate speckle in it.
      float sp = hash21(floor(P.xz * 180.0));
      alb  = mix(uColors[1], uColors[2], 0.34 + 0.10 * sp);
      shin = 16.0; spc = 0.05;
    } else {
      // The far wall of the hall, which nothing cool ever reaches.
      alb  = mix(uColors[1], uColors[2], 0.36);
      shin = 18.0; spc = 0.04;
    }

    vec3 c = lightIt(P, N, rd, alb, shin, spc, mtl, occ, wv);
    /* Shadow goes toward the house violet rather than toward black, so a
       green door and a brass lever sit in this site's world instead of
       being cut out and pasted onto it. */
    c = mix(c, mix(uInk, uColors[0], 0.45), (1.0 - occ) * 0.42);
    c += WARM * emit;
    c = mix(c, haze, smoothstep(3.6, 9.5, nt) * 0.35);
    col = mix(col, c, cover);
  }

  /* The light in the air. Not a veil over the band — a tight warm bloom
     at the opening, which is what a lit hall does to the dusk round its
     own doorway, and it is only there while the door is open. */
  vec3  dc = vec3(-0.02, 0.98, 0.0) - ro;
  float dz = max(dot(dc, ww), 0.20);
  vec2  dp = vec2(dot(dc, uu), dot(dc, vv)) * (f / dz) + vec2(xOff, yOff);
  vec2  gq = (s0 - dp) * vec2(1.30, 0.66);
  col += WARM * exp(-dot(gq, gq) * 1.7) * 0.22 * gOpen;

  // It develops out of the site's own paper rather than snapping on.
  col = mix(mix(uColors[2], uColors[3], 0.5), col, 0.30 + 0.70 * e);
  // A little tooth, so a wide wash never bands on a cheap panel — which
  // is the only sort of panel this will be watched on.
  col += (hash21(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) * 0.017;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export const scene: Scene = {
  frag,
  colors: ["#551a89", "#7c74a6", "#f4f3f7", "#ffffff"],
  /* The door, shut, as far as stacked backgrounds can carry it — and
     they have to carry it, because this is what a reader on a slow phone
     looks at until the shader has compiled, and what a device with no
     WebGL is left with for good.

     Every layer is sized in PIXELS and placed from the band's own CENTRE
     with calc(), not by percentage. A percentage background-position
     aligns the same fraction of the IMAGE with that fraction of the
     CONTAINER, so a fixed-size layer placed that way slides relative to
     every other one the moment the band changes width: the first cut of
     this drew the panels off the leaf and the handle out in the wall on
     a tablet. calc(50% + Npx) is centre-then-offset, and it holds at
     every width. The only warm thing in it is the light getting out
     round the edges and through the letterplate, which is the picture
     the shader then animates. */
  poster:
    /* Solved at 135 pixels to the metre, so the leaf is 900 by 1960 in
       the same proportion the shader builds it in and the letterplate
       lands on the lock rail rather than across the handle. */
    // The brass: the lever on the stile and the letterplate on the rail.
    "radial-gradient(circle 7px at calc(50% + 63px) calc(50% - 21px), #e8c983 0 5px, rgb(255 255 255 / 0) 7px), " +
    "linear-gradient(#e2c07a, #9c7f45) calc(50% + 53px) calc(50% - 19px) / 20px 5px no-repeat, " +
    "linear-gradient(#e0bd75, #8e7239) calc(50% + 10px) calc(50% - 9px) / 45px 13px no-repeat, " +
    /* The four panels, the upper pair long and the lower pair short —
       each one drawn twice: the field, and behind it a slightly larger
       rectangle running light at the top left to dark at the bottom
       right, which is the cove of the moulding and the only thing that
       tells a reader at a glance that this is a panelled door. */
    "linear-gradient(158deg, #29513e, #0d1e15) calc(50% - 19px) calc(50% - 86px) / 36px 129px no-repeat, " +
    "linear-gradient(158deg, #29513e, #0d1e15) calc(50% + 39px) calc(50% - 86px) / 36px 129px no-repeat, " +
    "linear-gradient(158deg, #29513e, #0d1e15) calc(50% - 19px) calc(50% + 37px) / 36px 66px no-repeat, " +
    "linear-gradient(158deg, #29513e, #0d1e15) calc(50% + 39px) calc(50% + 37px) / 36px 66px no-repeat, " +
    "linear-gradient(150deg, #4a7b60, #0f2118) calc(50% - 19px) calc(50% - 86px) / 42px 135px no-repeat, " +
    "linear-gradient(150deg, #4a7b60, #0f2118) calc(50% + 39px) calc(50% - 86px) / 42px 135px no-repeat, " +
    "linear-gradient(150deg, #4a7b60, #0f2118) calc(50% - 19px) calc(50% + 37px) / 42px 72px no-repeat, " +
    "linear-gradient(150deg, #4a7b60, #0f2118) calc(50% + 39px) calc(50% + 37px) / 42px 72px no-repeat, " +
    // The leaf, and the warm light getting out all round its edges.
    "linear-gradient(104deg, #1f3e2e, #11241a) calc(50% + 10px) calc(50% - 35px) / 121px 265px no-repeat, " +
    "linear-gradient(rgb(255 209 156 / 0.72), rgb(255 179 110 / 0.72)) calc(50% + 10px) calc(50% - 35px) / 127px 271px no-repeat, " +
    // The architrave round it, and the stone sill under it.
    "linear-gradient(#fcfbff, #e3dfee) calc(50% + 10px) calc(50% - 40px) / 163px 287px no-repeat, " +
    "linear-gradient(#d6d1e4, #a29bbc) calc(50% + 10px) calc(50% + 103px) / 178px 13px no-repeat, " +
    // What the hall throws onto the paving, the glow round the opening,
    // and then the wall and the ground it all stands in.
    "radial-gradient(160px 56px at calc(50% + 6px) calc(50% + 132px), rgb(255 190 120 / 0.44) 0%, rgb(255 190 120 / 0) 100%), " +
    "radial-gradient(210px 250px at calc(50% + 10px) calc(50% - 10px), rgb(255 196 132 / 0.17) 0%, rgb(255 196 132 / 0) 100%), " +
    "linear-gradient(to bottom, #8b83a6 0%, #a49dbd 33%, #c6c1d8 60%, #ece9f3 82%, #ffffff 100%)",
  alt: "A deep green panelled front door with an aged brass lever and letterplate, hung in a white architrave: it swings open from a rendered wall and the warm light of a hall lamp spills out across the stone threshold and widens over the paving, holds, then eases back to shut while the camera drifts slowly in and out.",
};
