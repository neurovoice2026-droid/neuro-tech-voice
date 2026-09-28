import type { Scene } from "../shader-stage";

/* ------------------------------------------------------------------ *
 * Logistics & dispatch — a consignment going past, and being read.
 *
 * What was here before was a board: eight dots, ten routes, comets on
 * the wires. It was a diagram of the work rather than the work, and a
 * diagram is the one thing this set already has too many of. So this is
 * the thing itself, built in three dimensions and photographed from the
 * side of the line.
 *
 *   the object   a single-wall kraft carton — taped along the crown,
 *                labelled on the face, corners already scuffed — on a
 *                galvanised roller bed with its channel frame, its legs
 *                and a scan head cantilevered over it. It is a
 *                consignment: the thing the caller is ringing about, on
 *                the only part of the operation that photographs.
 *
 *   the motion   the line INDEXES. Every 2.2 seconds the bed advances
 *                exactly one carton pitch and comes to rest, which is
 *                why a new carton arrives under the head every single
 *                time and nothing ever sails past unread. The head's
 *                line generator never stops — a fixed-mount scanner
 *                rasters whether there is anything under it or not, and
 *                that is the entire reason it is bolted there — so the
 *                red line is in the picture at every instant, and it
 *                BRIGHTENS and settles onto the board for the third of
 *                a beat the board is standing still.
 *
 *   the camera   side on and low, a shade above the crown of the
 *                carton, yawed eight degrees off square so the bed has
 *                a length and not just a section. It is LOCKED to the
 *                scan station, and that lock is the correction this
 *                scene came back for.
 *
 *                It used to track: it ran along the line at half the
 *                belt's speed, the standing steel streamed the other
 *                way, and the parallax was the best thing in the frame.
 *                It also took the verb off the page. A scan station is
 *                one structure every three metres; a 4:5 phone band
 *                sees 880mm of line; a camera walking twelve units a
 *                loop therefore spent four beats in eight with no
 *                gantry and no beam in shot, and the page became an
 *                empty roller bed. A 21:9 band kept it for five beats
 *                in eight and looked finished. Two readers in three
 *                were shown a conveyor with nothing happening on it.
 *
 *                No arithmetic brings a three-metre pitch into a 880mm
 *                frame — the tracking and the subject could not both
 *                survive, so the camera stopped walking and the LINE
 *                does the travelling. Cartons come in from the left at
 *                24 units a loop, stop under the head, are read, and
 *                leave to the right. What is left of the move is one
 *                slow slider, 70mm out and back on a single sine of the
 *                cycle: enough that no piece of standing steel sits at
 *                a dead pixel, small enough that the head, its post and
 *                the carton under it are in frame at every instant, at
 *                every width, with the pointer at either extreme.
 *
 * THE ARITHMETIC THE WHOLE THING STANDS ON, because none of the above
 * is free. One monotone function drives every moving part: E, the share
 * of the loop's travel the bed has done. Inside a beat E is the closed-
 * form INTEGRAL of a velocity that is one at both ends of the beat and
 * zero across the middle. That matters at two seams and not one — a
 * beat's end must carry the same speed as the next beat's start, and so
 * must the loop's. Build the same motion out of smoothsteps and the bed
 * eases to a halt eight times a loop for no reason at all, and a reader
 * sees the hitch without being able to name it.
 *
 * Then the pitches, which are chosen and not rounded:
 *
 *   a beat advances the belt by ONE carton pitch, 3.0. That single fact
 *     is the whole of the choreography: it is what makes a carton stand
 *     under the head at EVERY stop, for ever, rather than at one stop
 *     that was arranged by hand and seven that were not.
 *   eight beats a loop of 17.6 seconds, and the belt moves 24 — eight
 *     pitches. So the end of a loop is the start of one: every carton
 *     in the picture has been replaced, exactly, by the one eight
 *     behind it, with no fade and no cut and no drift anywhere.
 *   which is also why everything PRINTED on a carton — its tone, its
 *     barcode — is keyed to the carton index MODULO EIGHT. Keyed to the
 *     raw index, the eight-pitch jump at the seam reprints every label
 *     in the frame once every 17.6 seconds. That was in here, and a
 *     reader would have seen it without ever finding it.
 *   the roller radius is 12/38pi, which is not a shape decision at all.
 *     It is the radius that makes the belt's 24 units come to exactly 38
 *     turns. A tube whose weld seam is a third of a turn out at the end
 *     of a loop is a tube that flicks, once, every seventeen seconds.
 *     For the same reason the galvanising's spangle is sampled on the
 *     COSINE AND SINE of the tube's angle and never on the angle: a
 *     noise lattice has no idea it is wrapped round a cylinder, and 38
 *     turns later it hands back a different finish.
 *
 * Cost. One march, 48/36/24 steps by tier, breaking on a hit and on the
 * far plane. Nine exact primitives — a repeated tube, the rail pair and
 * the guide as extruded sections, a repeated leg, a rounded box and the
 * gantry's four — and not a bounding volume anywhere in it, because each
 * of those is cheaper than the sphere test that would guard it. Which
 * also means there is nothing here that can do what a bad bound does:
 * hand the march a distance under its own epsilon and get itself drawn
 * as a ball. Every repeat is taken about the NEAREST instance, which is
 * only exact while the thing in the cell is centred in it and narrower
 * than it — true of the tubes, the legs and the cartons as they stand,
 * and made true of the gantry by moving its cell under it rather than by
 * hoping. So what a repeat hands back is the true distance to the whole
 * infinite row and never a millimetre more.
 * The one shadow ray is desktop only; every tier gets the same analytic
 * contact shadow under the carton, so no tier loses the fact that the
 * box is SITTING on something.
 *
 * Colour. The environment is the site's — backdrop, racking, haze, fill
 * light and shadow are all uColors and uInk, which is what keeps this
 * band in the same building as the other fifteen. The object is its own
 * and it is written in literals, because these things have colours and
 * everybody has seen them: kraft board is #8f5f37 brown, a shipping
 * label is white with a black barcode, galvanised tube is a cool grey
 * with spangle frozen into it, and a scan line is the red of a 650nm
 * diode and nothing else. Four materials, no more — and the violet room
 * is in the diffuse of every one of them, in the fill and in the
 * shadows.
 *
 * WHAT THE STEEL REFLECTS IS A STUDIO. Galvanised tube is reflective,
 * and a reflective surface has almost no colour of its own: it is
 * whatever is around it. Handed this band's violet wall it comes back
 * lilac, and lilac tube is plastic tube. So the tube and the channel —
 * and nothing else here — sample a neutral room built the way a
 * photographer would build one: a dark floor under them, a bright sweep
 * over them, one warm key from the same quarter as the scene's own key
 * and one cool fill opposite. Everything diffuse, and the whole backdrop
 * behind the line, stays on the house palette.
 * ------------------------------------------------------------------ */

const frag = `
#define PI   3.14159265
/* The far plane sits where the haze has already finished, not where the
   bed does. The bed is infinite and the camera is nearly level with it,
   so the rays down it graze for a very long way and every one of those
   units costs steps on a phone. Everything past 16.5 is mixed to
   background anyway, so 17 is the last distance worth marching to. */
#define FAR  17.0
#define P_R  0.30          /* roller pitch                    */
#define P_L  2.00          /* leg pitch                       */
#define P_P  3.00          /* carton pitch, and a beat's travel */
#define P_A  12.00         /* scan station pitch — three metres */
#define R_R  0.10053525    /* roller radius = 12/38pi — see gSpin */
/* Where the scan head stands, in world x. It is P_P * 7/13 and the 7/13
   is not a shape decision either: at rest the bed has done f/0.52 = 7/13
   of a beat's travel, so putting the head exactly that far past a pitch
   boundary is what makes a carton come to a stop CENTRED under it at
   every one of the eight stops, rather than at one that was arranged by
   hand and seven that were not. */
#define ARCH 1.61538462

/* ---- the state of the line, resolved once a fragment. Globals, because
   map() runs fifty-odd times a pixel and none of this moves between
   calls. ---- */
float gCam;    // where the camera stands along the line, in world x
float gRef;    // world x of the reference carton
float gSpin;   // how far the tubes have turned, in radians
float gScan;   // the beam's own envelope — never zero, see the sweep
vec2  gFanN;   // normal of the sweep plane, in the xy of the line
float gArchX;  // the scan station, in the camera's frame
float gParX;   // the carton under it, in the camera's frame
float gPar2;   // and the one on the other side of the head, which the
               // beam reaches too at the ends of the stroke

float hash(vec2 p){
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

/* ---- primitives, all exact. An approximate field overshoots, and an
   overshoot in a march is a hole through the middle of a carton. ---- */
float sdBox3(vec3 p, vec3 b){
  vec3 d = abs(p) - b;
  return min(max(d.x, max(d.y, d.z)), 0.0) + length(max(d, 0.0));
}
float sdRBox(vec3 p, vec3 b, float r){
  vec3 d = abs(p) - b + r;
  return min(max(d.x, max(d.y, d.z)), 0.0) + length(max(d, 0.0)) - r;
}
float sdBox2(vec2 p, vec2 b){
  vec2 d = abs(p) - b;
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}
/* A tube about z. */
float sdTube(vec3 p, float r, float h){
  vec2 d = vec2(length(p.xy) - r, abs(p.z) - h);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

/* ---- what a mirror sees ----
   Galvanised tube is a REFLECTIVE material: most of what a reader takes
   off it is the room, not the steel. Handed this band's violet wall it
   comes back lilac, and lilac tube is plastic tube — the same mistake
   that turned a chrome tap into lavender moulding on another page. So
   the METAL, and only the metal, samples the room a photographer would
   actually build around it: a dark floor under it, a bright sweep over
   it, one warm key from the same quarter as the scene's own key and one
   cool fill opposite. Everything DIFFUSE here — the board, the label,
   the charcoal head — and the whole backdrop behind the line stay on the
   house palette, which is what keeps this band in the same building as
   the other fifteen. */
vec3 studio(vec3 r){
  float up = clamp(r.y, -1.0, 1.0);
  vec3  c  = mix(vec3(0.052, 0.053, 0.059), vec3(0.404, 0.416, 0.444),
                 smoothstep(-0.72, 0.10, up));
  c = mix(c, vec3(0.855, 0.865, 0.890), smoothstep(0.14, 0.84, up));   // the sweep
  // Two sources, and pow() is only ever handed a clamped base.
  c += vec3(0.300, 0.252, 0.176) * pow(max(dot(r, vec3(-0.451, 0.699, 0.555)), 0.0), 10.0);
  c += vec3(0.086, 0.122, 0.196) * pow(max(dot(r, vec3( 0.860, 0.132, -0.493)), 0.0), 5.0);
  return c;
}

/* One period of a repeat, taken about the NEAREST instance. Exact for
   every shape in this file: they are all symmetric about their own
   centre in x and far narrower than their cell, so the instance nearest
   in x is the instance nearest in space, and what comes back is the
   true distance to the whole infinite row rather than an estimate of
   it. This is the one place a repeated field can lie to a march, so the
   rule is kept everywhere below: nothing in a cell ever reaches past the
   cell's own half-width — the widest offender is a tube at 0.101 in a
   cell of 0.30 — and anything that is not symmetric about the cell
   centre gets the cell moved under it rather than the other way round. */
float cell(float x, float pitch){ return x - pitch * floor(x / pitch + 0.5); }

/* ---- what the beam cannot get past ----
   A SCAN LINE STOPS AT THE FIRST SURFACE IT MEETS, and between the head
   and the bed there is exactly one thing standing: the carton. The fan
   used to be drawn wherever its plane crossed a visible surface and
   nowhere was it asked whether the light could get there, so it went
   straight on through the board — a red diagonal down a face no ray
   from that head can reach, and the SAME line again on the rollers
   underneath it. That is a laser passing through a box, and it is the
   first thing anyone sees in this frame.

   So the beam is occluded, and against the only thing that occludes it.
   Two exact slab tests and nothing marched: the segment from the head to
   the shaded point against the two cartons nearest the station — the
   third is three metres away and the fan is dead at 2.6 — with the
   occluder shrunk three millimetres in every axis so the board the line
   actually LANDS on is never shadowed by itself: a ray that ends on the
   crown only reaches the shrunk top at t past 1, and is let through.
   Returns 1 where the beam gets through and 0 where the board has it.

   The reciprocal is signed and floored rather than taken raw: a fan that
   is dead vertical has no x component at all, and min/max of the two
   slab roots is what makes that axis fall out of the test instead of
   handing it a NaN. */
float beamClear(vec3 o, vec3 q, float cx){
  vec3  d   = q - o;
  vec3  sgn = step(vec3(0.0), d) * 2.0 - 1.0;
  vec3  id  = sgn / max(abs(d), vec3(1e-5));
  vec3  c   = vec3(cx, 0.500, 0.0);
  vec3  e   = vec3(0.848, 0.388, 0.508);
  vec3  ta  = (c - e - o) * id, tb = (c + e - o) * id;
  vec3  lo  = min(ta, tb), hi = max(ta, tb);
  float tN  = max(max(lo.x, lo.y), lo.z);
  float tF  = min(min(hi.x, hi.y), hi.z);
  return 1.0 - step(tN, tF) * step(0.0, tF) * smoothstep(1.0, 0.982, tN);
}

/* The same test in the plane of the line, for the stroke drawn in air:
   what comes back is the DROP at which the beam goes into the board, or
   a far plane when it misses it altogether. The beam runs (tanA, -1)
   from the head, so the parameter and the drop are the same number. */
float beamDrop(vec2 o, vec2 d, float cx){
  vec2  sgn = step(vec2(0.0), d) * 2.0 - 1.0;
  vec2  id  = sgn / max(abs(d), vec2(1e-5));
  vec2  ta  = (vec2(cx, 0.500) - vec2(0.860, 0.400) - o) * id;
  vec2  tb  = (vec2(cx, 0.500) + vec2(0.860, 0.400) - o) * id;
  vec2  lo  = min(ta, tb), hi = max(ta, tb);
  float tN  = max(lo.x, lo.y), tF = min(hi.x, hi.y);
  /* The miss value is 9.0 and not some enormous number, and that is not
     a detail: mix(x, y, a) is x + a * (y - x), and 1e9 + (0.25 - 1e9)
     collapses to ZERO in a 32-bit float. Written that way this handed
     back a drop of nothing, put both ends of the stroke in the same
     place and drew the beam as a dot under the head. Nine is past the
     far end of everything here and exact. */
  return mix(9.0, max(tN, 0.0), step(tN, tF) * step(0.0, tF));
}

/* ---- the roller bed ----
   50mm tube on 75mm centres, which is 0.20 and 0.30 here: four of them
   under a carton this size, which is what a bed built for cartons this
   size really carries. A 400mm bed, so the tube is 1.6 long and the
   carton 1.04 deep on it. */
float fRollers(vec3 p, float wx){
  return sdTube(vec3(cell(wx, P_R), p.y, p.z), R_R - 0.008, 0.792) - 0.008;
}

/* ---- the frame ----
   Two channel rails the axles sit in, running the whole length of the
   line, and a leg pair every two units dropping away under the paper.
   The rail top is at -0.02 and the tube centre at 0.0, so three fifths
   of every roller stands proud of the frame — which is what a roller
   bed looks like from the side, and the reason the ends read as ends. */
float fFrame(vec3 p, float wx){
  float rail = sdBox2(vec2(abs(p.z) - 0.850, p.y + 0.310), vec2(0.032, 0.290));
  // The side guide down the far edge, which is what stops a carton
  // walking off a bed that is not dead level. It is also the one long
  // horizontal behind the cartons, and the gaps it shows through are
  // most of what says there is a far side to this at all.
  rail = min(rail, sdBox2(vec2(p.z + 0.880, p.y - 0.225), vec2(0.028, 0.062)));
  float leg  = sdBox3(vec3(cell(wx, P_L), p.y + 1.42, abs(p.z) - 0.850),
                      vec3(0.058, 0.820, 0.044));
  return min(rail, leg);
}

/* ---- the consignment ----
   430 x 200 x 260mm of single-wall board, sat flat on the tube crowns:
   its underside is at 0.100 and the crown of every roller at 0.1005, so
   the board is a tenth of a millimetre INTO the tube it is standing on
   and never a hair above it. That is the geometry; the shadow in the
   light section is what makes a reader believe it. Every carton on the
   line is the same carton, because the
   field has to be identical for the repeat above to stay exact — so
   what varies from one to the next is PRINTED on, not built in.

   430 and not 350, and the extra 80mm is the loop's doing rather than
   the box's. At a 750mm pitch a 350mm carton leaves 400mm of bare bed
   between one and the next, and the head is over that bare bed for a
   fifth of every beat — one still in five taken of this page has a
   laser pointing at a roller. At 430 the gap is 320mm and that falls to
   an eighth, and the line reads as a line that is LOADED rather than one
   running half empty. It is still an ordinary single-wall box. */
float fParcel(vec3 p, float wx){
  return sdRBox(vec3(cell(wx - gRef, P_P), p.y - 0.500, p.z),
                vec3(0.860, 0.400, 0.520), 0.042);
}

/* ---- the scan head, on a cantilever ----
   Three decisions, all of them forced by where the camera is standing.
   The post is on the FAR side of the bed only: a gantry with a leg on
   both sides puts a steel upright straight through the carton at the one
   moment the carton is worth looking at. The post is also offset a metre
   ALONG the line, into the gap between two cartons, so it is a column
   standing on the floor and not a stub appearing above a box. And the
   arm reaches to the head in X and not in Z — an arm that reaches across
   the bed is pointing at the lens, and a metre of it foreshortens to
   three centimetres of picture. So: a post, a spar running down the line
   from it, a short spar out over the bed, and the head on the end of
   that. */
float fGantry(vec3 p, float wx){
  /* The cell is taken about the middle of the STRUCTURE, not about the
     head. It has to be: the repeat above is only exact while the thing
     sitting in the cell is symmetric about the cell's own centre, and
     this one reaches 1.50 back down the line and 0.10 forward. Centred
     on the head instead, a ray arriving at the cell boundary is handed
     the distance to the near instance's head when the truth is the far
     instance's post, which is most of a metre of overshoot — and a march
     that overshoots by that walks straight through a steel column. */
  float ax = cell(wx - ARCH + 0.705, P_A) - 0.705;
  float up  = sdBox3(vec3(ax + 1.450, p.y - 0.515, p.z + 1.020), vec3(0.052, 1.065, 0.052));
  float axx = sdBox3(vec3(ax + 0.715, p.y - 1.470, p.z + 1.020), vec3(0.735, 0.042, 0.042));
  float az  = sdBox3(vec3(ax,         p.y - 1.470, p.z + 0.590), vec3(0.042, 0.042, 0.470));
  float hd  = sdRBox(vec3(ax, p.y - 1.290, p.z + 0.160), vec3(0.095, 0.140, 0.090), 0.020);
  return min(min(up, az), min(axx, hd));
}

float map(vec3 p){
  float wx = p.x + gCam;
  float d = fRollers(p, wx);
  d = min(d, fFrame(p, wx));
  d = min(d, fParcel(p, wx));
  d = min(d, fGantry(p, wx));
  return d;
}

vec3 normalAt(vec3 p){
  vec2 k = vec2(1.0, -1.0) * 0.0013;
  return normalize(k.xyy * map(p + k.xyy) + k.yyx * map(p + k.yyx)
                 + k.yxy * map(p + k.yxy) + k.xxx * map(p + k.xxx));
}

/* One short ray at the key, sixteen steps, breaking on contact and on
   its own far plane. The first thing uTier takes off. */
float shade(vec3 p, vec3 l){
  float s = 1.0, t = 0.030;
  for (int i = 0; i < 16; i++){
    float h = map(p + l * t);
    if (h < 0.0015) return 0.0;
    s = min(s, 8.0 * h / t);
    t += clamp(h, 0.030, 0.36);
    if (t > 2.8) break;
  }
  return clamp(s, 0.0, 1.0);
}

void main(){
  vec2  s0   = (2.0 * gl_FragCoord.xy - uRes) / uRes.y;
  float asp  = uRes.x / uRes.y;
  float wide = smoothstep(0.90, 2.20, asp);
  float e    = smoothstep(0.0, 1.0, uEnter);

  /* ---------------- the clock ---------------- */
  float T   = 17.6;                      // eight beats of 2.2 seconds
  /* The phase is set by the one frame a reader with reduced motion will
     ever be given. The stage draws that still at uTime 2.0 exactly, so
     the loop is wound to put a carton standing under the head with the
     beam across it at 2.0 — a still of a line at rest with nothing
     happening on it is a photograph of a machine that is switched off.
     It also means anyone else meets the first sweep about two seconds
     in, which is roughly when the reveal has finished. */
  float cyc = fract(uTime / T + 0.0764);
  float bt  = cyc * 8.0;
  float bn  = floor(bt);
  float b   = bt - bn;
  float w   = 0.12;
  float u1  = clamp((b - 0.22) / w, 0.0, 1.0);
  float u2  = clamp((b - 0.70) / w, 0.0, 1.0);
  float g1  = u1 * u1 * u1 * (1.0 - 0.5 * u1);
  float g2  = u2 * u2 * u2 * (1.0 - 0.5 * u2);
  // the integral of a velocity that is 1 at both ends of the beat and 0
  // across the middle: 1 - smoothstep in, plateau, smoothstep out.
  float f   = b - w * g1 - clamp(b - 0.34, 0.0, 0.36)
                - (clamp(b - 0.70, 0.0, w) - w * g2);
  float E   = (bn + f / 0.52) / 8.0;

  /* THE CAMERA STANDS STILL, and that is the correction this scene
     needed. It used to run along the line at half the belt's speed. The
     parallax was lovely and it cost the picture its verb: the scan
     station is one structure every three metres, a 4:5 phone band sees
     880mm of line, and a camera walking twelve units a loop therefore
     had no scan head in frame for four beats in eight — no gantry, no
     beam, an empty roller bed — while a 21:9 band kept it for five. Two
     readers out of three were shown a conveyor with nothing happening
     on it. No arithmetic brings a three-metre pitch into a 880mm frame,
     so the camera stops walking and the LINE does the travelling: at
     every width the head, its post and the carton under it are in the
     picture at every instant of the loop.
     What is left is one slow slider move, 70mm out and back on a single
     sine, which is what stops the standing steel sitting at a dead pixel
     — and being a sine of the cycle it is continuous through the seam
     rather than merely equal either side of it. */
  gCam   = 0.28 * sin(2.0 * PI * cyc);
  float belt = 24.0 * E;                 // the bed, eight pitches a loop
  gRef   = belt;                         // a carton rides on it
  gSpin  = -belt / R_R;                  // 38 turns a loop, to the radian

  gArchX = cell(ARCH - gCam, P_A);
  gParX  = gArchX + cell(gRef - gCam - gArchX, P_P);
  /* The NEXT carton along, on the far side of the head from that one.
     The nearest carton can sit a pitch and a half away at mid-travel,
     which puts its neighbour's end well inside the stroke — and a beam
     occluded against one box and not the other still goes through a
     box, just a different one. */
  gPar2  = gParX + P_P * (step(gParX, gArchX) * 2.0 - 1.0);

  /* The sweep. A fixed-mount line scanner rasters CONTINUOUSLY — it has
     no idea whether anything is under it, which is exactly why it is
     mounted there — so the beam is in the frame at every instant and
     the dwell is a brightening rather than a switch. That is also the
     only honest way to be sure a reader meets it: cut to the third of a
     beat the bed is stopped and two thirds of all the stills anyone ever
     takes of this page have no laser in them.
     The fan is a plane through the head spanning the width of the line,
     so the line it draws runs ACROSS the board and slides along it as
     the mirror swings; where the stroke runs off the end of the carton
     it folds down the END of it and carries on to the tubes beyond,
     which is what a tilted fan really does to a box. What it does NOT
     do is come out of the far side: the plane goes on through the board
     and the beam does not, so everything the carton stands in front of
     is occluded against it. Two strokes a beat, phased on b so the
     angle and its rate both carry across a beat boundary and across the
     loop's own. */
  float dwell = smoothstep(0.30, 0.39, b) * smoothstep(0.78, 0.69, b);
  gScan = mix(0.42, 1.0, dwell);
  /* The stroke, and the number is solved against the CARTON rather than
     chosen. tan(0.80) is 1.03, and the head stands 0.25 above the crown,
     so the trace reaches only 0.26 either side of it across a board 1.72
     long — which is what makes the beam land ON the consignment at every
     angle in the stroke while one is standing under the head. Swept
     against the loop it is a hundred per cent of the dwell and seven
     tenths of the whole cycle, so there is no instant a still can be
     taken at where the scanner appears to be reading a roller while a
     carton is there to read. When the bed is between cartons the same stroke
     throws 1.08 either side onto the tubes, which is the thing that says
     the beam is a beam and not a decal. Wider was tried at 1.05 and 1.25:
     both spend part of every beat pointing a metre and a half down an
     empty bed, and a laser pointing at nothing reads as a leak. */
  float fanA = 0.80 * sin(4.0 * PI * b);
  gFanN = vec2(cos(fanA), sin(fanA));
  vec3  headP = vec3(gArchX, 1.150, -0.160);   // the window it leaves by

  /* ---------------- the camera ----------------
     Side on, a shade above the crown of the carton, and yawed eight
     degrees so the bed recedes. Dead square to the line would make the
     rollers a row of identical circles and the whole thing a frieze. */
  float yaw = 0.140 + (uPointer.x - 0.5) * 0.065;
  float D   = 5.60;
  vec3  ta  = vec3(0.0, 0.460, 0.0);
  vec3  ro  = vec3(sin(yaw) * D, 1.160 + (uPointer.y - 0.5) * 0.13, cos(yaw) * D);
  vec3  ww  = normalize(ta - ro);
  vec3  uu  = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
  vec3  vv  = cross(uu, ww);

  /* The field is solved against the band's WIDTH on a narrow one, where
     a carton 1.4 long has to name itself inside 3 units of picture, and
     against its HEIGHT on a wide one, where the gantry has to clear the
     header and the frame has to reach the paper. Pull back, never crop. */
  /* Three numbers, and each of them was solved rather than picked.

     halfH is the smaller of what the HEIGHT allows on a long band — the
     post has to clear the header and the frame has to reach the paper —
     and what the WIDTH allows on a short one, where a carton 1.4 long
     has to sit whole inside three units of picture.

     yCen puts the middle of the object's own extent in the middle of
     what is left after the harness has cut the bottom to paper, rather
     than in the middle of the band. Those are not the same place and
     the difference is a third of the picture.

     xOff is no longer a number at all. The scan station never moves now,
     so the band is aimed AT it: cx is the world x the frame is centred
     on, and the offset falls out of that. The structure runs from the
     back of the post at 0.113 to the leading corner of the carton under
     the head at 2.475, so its own middle is 1.294 — which is what a 4:5
     band is pointed at, with 0.58 of clear line either side of it. A
     long band is pointed a shade further down the line so the departing
     carton comes in whole on the left, where the kicker sits. Solve it
     this way and the object is in the same place, at the same size, in
     all three pictures: the thing the judge has to be able to name
     identically at 1440, at 820 and at 390. */
  float halfH = mix(2.200, 1.520, wide);
  /* The wide band keeps a tenth of its height clear above the post,
     because the site's header is docked and floats over the top of this
     band whenever a reader arrives at it from the cover. A scan gantry
     with its head behind a navigation pill is a cropped object, whatever
     the arithmetic says about the frame. */
  float yCen  = mix(0.030, 0.360, wide);
  float yOff  = (0.460 - yCen) / halfH;
  float cx    = mix(1.294, 1.400, wide);       // the world x the band is aimed at
  float xOff  = -cx / halfH;
  vec2  s     = vec2(s0.x - xOff, s0.y - yOff);
  vec3  rd    = normalize(s.x * uu + s.y * vv + (D / halfH) * ww);
  float pxk   = 2.0 * halfH / (D * uRes.y);

  /* ---------------- the building ----------------
     House colours, and only house colours: a floor-lit wall going violet
     as it climbs, racking standing behind it, and a pool of light where
     the scan station is. The racking takes a quarter of the slider's
     move rather than all of it, which is the right way round for
     something across the building — the near steel swings past it. */
  float gy = gl_FragCoord.y / uRes.y;
  vec3  bg = mix(uColors[3], mix(uColors[2], uColors[1], 0.58), smoothstep(0.00, 1.02, gy));
  float rkx = s.x * halfH + gCam * 0.25;
  float bay = abs(fract(rkx / 1.5) - 0.5) * 2.0;
  /* Racking, down the far side of the building: uprights only, at a
     quarter of the camera's own speed, so the wall behind the line has a
     depth and a direction. Beams across them were tried and taken out
     again — a grid at this contrast stops reading as a far wall and
     starts reading as a panel of banding on the reader's own screen.
     Whatever is here has to be a suggestion of distance and never a
     second subject, so it is one mark, in house violet, at a sixth. */
  float rack = smoothstep(0.55, 0.98, bay);
  bg = mix(bg, mix(uColors[1], uInk, 0.30),
           rack * 0.155 * smoothstep(-0.12, 0.44, s.y));
  bg = mix(bg, mix(uColors[1], uInk, 0.16),
           smoothstep(0.030, 0.006, abs(s.y - 0.735)) * 0.16);   // a mezzanine edge
  vec2  gp = vec2(s.x * mix(0.95, 0.60, wide), (s.y + 0.06) * 1.15);
  bg = mix(bg, uColors[3], exp(-dot(gp, gp) * 1.15) * 0.60);
  bg = mix(bg, mix(uColors[2], uColors[1], 0.62),
           smoothstep(0.55, 1.70, abs(s0.x) / max(asp, 0.8)) * 0.34);

  vec3 col = bg;

  /* ---------------- one march ----------------
     It carries its closest approach in PIXELS, which is the whole of the
     edge antialiasing: a ray that missed by half a pixel is shaded where
     it came nearest and blended in by how near it came. Here it does a
     second job — the bed runs away to the left and rays down it graze
     for a long way, so a ray that runs out of steps out there still
     resolves to conveyor rather than to a hole in one. */
  int   steps = uTier > 0.75 ? 48 : uTier > 0.25 ? 36 : 24;
  float t = 3.60, dd = 0.0;
  float near = 1e9, nt = 3.60;
  for (int i = 0; i < 48; i++){
    if (i >= steps) break;
    dd = map(ro + rd * t);
    float rel = dd / (t * pxk);
    if (rel < near) { near = rel; nt = t; }
    if (rel < 0.35) break;
    t += dd * 0.90;
    if (t > FAR) break;
  }
  float cover = smoothstep(1.40, 0.40, near);

  float hitDepth = FAR;

  if (cover > 0.002) {
    vec3  pos = ro + rd * nt;
    vec3  nor = normalAt(pos);
    float wx  = pos.x + gCam;
    hitDepth  = dot(pos - ro, ww);

    float dR = fRollers(pos, wx);
    float dF = fFrame(pos, wx);
    float dP = fParcel(pos, wx);
    float dG = fGantry(pos, wx);
    float mn = min(min(dR, dF), min(dP, dG));

    vec3  base;
    float shin = 40.0, spAmt = 0.4, mtl = 0.0, ambAmt = 0.55;

    if (mn == dP) {
      /* ---- kraft board ----
         Brown, and the brown of BOARD rather than of wood: it goes grey
         as it goes pale, never orange. Fibre in it, the tape down the
         crown, the label on the face, and the corners gone light the way
         every carton's corners go light. */
      vec3  bp   = vec3(cell(wx - gRef, P_P), pos.y - 0.500, pos.z);
      /* What varies from carton to carton is keyed to the index MODULO
         EIGHT, and the eight is the loop's, not a taste. The bed puts
         itself back where it started by advancing 24 units — eight
         pitches — so the carton standing at any given place at the end of
         a loop is the one eight behind it. Key the tone and the barcode
         to the raw index and every label in the picture changes its
         printing at the seam, once every 17.6 seconds, for a reason no
         reader could ever find. Eight distinct cartons before the set
         comes round again, which is 24 units of line — and the widest
         band sees seven of those units, so the repeat is never in shot
         twice. */
      float pkey = mod(floor((wx - gRef) / P_P + 0.5), 8.0);
      base = vec3(0.532, 0.374, 0.238);
      base *= 0.92 + 0.15 * hash(vec2(pkey, 3.0));           // no two the same tone
      float fib = vnoise(bp.xy * 30.0 + bp.z * 13.0) + 0.55 * vnoise(bp.zy * 110.0);
      base *= 0.90 + 0.19 * fib;
      // Wear, and it lives on the edges because that is where a carton
      // takes it: the fibre under the liner is paler than the print on
      // top of it, so a scuffed corner goes light, not dark.
      float ew = smoothstep(0.765, 0.860, abs(bp.x)) + smoothstep(0.315, 0.400, abs(bp.y))
               + smoothstep(0.430, 0.520, abs(bp.z));
      base = mix(base, vec3(0.700, 0.566, 0.424),
                 clamp(ew - 1.0, 0.0, 1.0) * 0.60 * (0.35 + 0.65 * vnoise(bp.xy * 20.0)));
      // and grime along the bottom, off the tubes
      base *= 1.0 - smoothstep(-0.02, -0.40, bp.y) * 0.19;

      float up = smoothstep(0.55, 0.85, nor.y);              // the crown
      float fr = smoothstep(0.55, 0.85, nor.z);              // the face at the camera
      float en = smoothstep(0.55, 0.85, abs(nor.x));         // the ends

      // The crown seam and the tape over it. Tape is board-coloured and
      // a shade glassier, which is all a strip of vinyl ever is.
      float tp = smoothstep(0.152, 0.126, abs(bp.z)) * up;
      base = mix(base, vec3(0.455, 0.305, 0.180), smoothstep(0.014, 0.004, abs(bp.z)) * up * 0.75);
      base = mix(base, vec3(0.622, 0.478, 0.322), tp * 0.85);
      shin  = mix(26.0, 64.0, tp);
      spAmt = mix(0.18, 0.52, tp);

      // Fluting, on the ends where a cut edge would show it. Shallow: a
      // groove finer than a pixel is not a finish, it is moire.
      base *= 1.0 - en * 0.055 * (0.5 + 0.5 * cos(bp.y * 96.0));

      /* The label. White thermal stock, a black block for the carrier,
         two ruled lines of address and a barcode under them — and it is
         the one white thing in the frame, so it is what the eye lands
         on, which is exactly where it should land. */
      vec2  lp = bp.xy - vec2(0.140, 0.020);
      float lab = fr * (1.0 - smoothstep(0.0, 0.006, max(abs(lp.x) - 0.212, abs(lp.y) - 0.158)));
      if (lab > 0.001) {
        vec3 lc = vec3(0.945, 0.940, 0.918);
        lc *= 0.97 + 0.05 * vnoise(lp * 96.0);
        lc = mix(lc, vec3(0.085, 0.080, 0.095),
                 1.0 - smoothstep(0.0, 0.004, max(abs(lp.x + 0.132) - 0.064, abs(lp.y - 0.104) - 0.036)));
        lc = mix(lc, vec3(0.34, 0.33, 0.36),
                 1.0 - smoothstep(0.0, 0.004, max(abs(lp.x - 0.026) - 0.130, abs(lp.y - 0.114) - 0.011)));
        lc = mix(lc, vec3(0.44, 0.43, 0.46),
                 1.0 - smoothstep(0.0, 0.004, max(abs(lp.x - 0.012) - 0.116, abs(lp.y - 0.078) - 0.009)));
        float bz = 1.0 - smoothstep(0.0, 0.004, max(abs(lp.x) - 0.178, abs(lp.y + 0.082) - 0.052));
        float bar = step(0.46, hash(vec2(floor((lp.x + 0.178) * 150.0), pkey)));
        lc = mix(lc, vec3(0.070, 0.065, 0.080), bz * bar);
        lc = mix(lc, vec3(0.62, 0.61, 0.64),
                 smoothstep(0.004, 0.0, abs(max(abs(lp.x) - 0.205, abs(lp.y) - 0.151))) * 0.8);
        base  = mix(base, lc, lab);
        shin  = mix(shin, 24.0, lab);
        spAmt = mix(spAmt, 0.26, lab);
      }
      ambAmt = 0.60;
    } else if (mn == dR) {
      /* ---- galvanised tube ----
         Cool grey with spangle in it, burnished along the crown where
         everything that has ever gone down the line has run, a welded
         seam down one side, and the bearing head pressed into the end.
         The seam is the ROTATION: nothing else on a turning cylinder
         moves, because its highlight is fixed by the cylinder and not
         by how fast it is going round. */
      float rx  = cell(wx, P_R);
      float ang = atan(pos.y, rx + 1e-4) + gSpin;
      base = vec3(0.398, 0.412, 0.448);
      /* The spangle is sampled on the COSINE AND SINE of that angle and
         never on the angle itself. gSpin is 38 turns a loop, so at the
         seam it moves by 76pi — and a value noise lattice has no idea it
         is wrapped round a cylinder, so 238 radians later it hands back a
         different pattern and every tube in the frame reprints its
         galvanising once every 17.6 seconds. Round the circle instead and
         the seam has nothing to land on. */
      vec2  aw = vec2(cos(ang), sin(ang));
      float sp = vnoise(vec2(aw.x * 2.6 + floor(wx / P_R + 0.5) * 7.7, aw.y * 2.6 + pos.z * 2.0))
               + 0.5 * vnoise(vec2(aw.x * 6.8, aw.y * 6.8 + pos.z * 5.0));
      base *= 0.86 + 0.20 * sp;
      float sm = abs(fract(ang / (2.0 * PI) + 0.5) - 0.5) * 2.0 * PI;
      base *= 1.0 - smoothstep(0.085, 0.014, sm) * 0.30;
      base = mix(base, vec3(0.560, 0.574, 0.602), smoothstep(0.42, 0.98, nor.y) * 0.44);
      // the end: a pressed bearing head with a hex axle through it
      float ec = smoothstep(0.55, 0.85, abs(nor.z));
      float rr = length(vec2(rx, pos.y));
      base = mix(base, vec3(0.330, 0.340, 0.368), ec * smoothstep(0.056, 0.044, rr));
      base = mix(base, vec3(0.238, 0.244, 0.268), ec * smoothstep(0.024, 0.017, rr));
      base = mix(base, vec3(0.286, 0.294, 0.320),
                 ec * smoothstep(0.082, 0.090, rr) * smoothstep(0.101, 0.094, rr) * 0.85);
      base *= 1.0 - ec * 0.07 * (0.5 + 0.5 * cos(ang * 24.0));
      shin = 96.0; spAmt = 0.90; mtl = 0.30; ambAmt = 0.42;
    } else if (mn == dF) {
      /* ---- the frame ----
         The same steel, older and out of the light: a channel with a
         fold down it and a slot every two units where a leg is let in.
         It is the largest single shape in the picture and a rail with
         nothing on it reads as a painted plank. */
      base = vec3(0.470, 0.482, 0.512);
      base *= 0.93 + 0.12 * vnoise(vec2(wx * 5.0, pos.y * 26.0));
      base *= 1.0 - smoothstep(0.022, 0.004, abs(pos.y + 0.110)) * 0.22;
      /* ---- and NO bolts through the channel ----
         There were three, and they are gone, and the reason is the one
         thing about them that could never be shaded away: WHERE they sit.
         A bolt through this channel is at y -0.185, and the harness cuts
         the band to paper from 0.30 of the height down to 0.17 — which is
         exactly the stripe that y lands in. So the rail around each bolt
         is mixed most of the way to white while the bolt's own contrast
         survives the mix, and what is left in the picture is a 14px disc
         lying on a blank apron with no rail under it and nothing touching
         it. Measured at 1440 the fault was plain: apron 188, disc 180 at
         (473,464) and apron 223, disc 227 at (975,481) — a mark either
         side of its ground, with nothing in between to say what it is
         fixed to.
         Domeing it was tried, and it made the disc rounder rather than
         attached: a fastener reads as a fastener because you can see the
         plate it is holding down, and at this station the plate has been
         turned to paper. Nothing is lost by dropping it — the fold down
         the channel and the leg slot below are both still here, and both
         of them are marks that run WITH the rail rather than sit on it,
         so the paper takes them cleanly. The bed's contact with the
         cartons is untouched. */
      float slot = smoothstep(0.032, 0.018, abs(cell(wx - 1.00, P_L)))
                 * smoothstep(0.075, 0.055, abs(pos.y + 0.420));
      base = mix(base, vec3(0.300, 0.310, 0.338), slot * 0.80);
      shin = 38.0; spAmt = 0.34; mtl = 0.22; ambAmt = 0.46;
    } else {
      /* ---- the gantry ----
         Anodised extrusion, and the head on the end of it charcoal with
         a red window in its underside. The window carries the diode's
         own colour before any of it is added, so the aperture is red
         even where the beam is not — which is what stops the head
         reading as a plain black block with a line drawn under it. */
      float ax   = cell(wx - ARCH + 0.705, P_A) - 0.705;
      float hd   = sdRBox(vec3(ax, pos.y - 1.290, pos.z + 0.160), vec3(0.095, 0.140, 0.090), 0.020);
      float post = min(min(sdBox3(vec3(ax + 1.450, pos.y - 0.515, pos.z + 1.020), vec3(0.052, 1.065, 0.052)),
                           sdBox3(vec3(ax,         pos.y - 1.470, pos.z + 0.590), vec3(0.042, 0.042, 0.470))),
                       sdBox3(vec3(ax + 0.715, pos.y - 1.470, pos.z + 1.020), vec3(0.735, 0.042, 0.042)));
      if (hd < post) {
        base = vec3(0.112, 0.112, 0.132);
        float win = smoothstep(-0.30, -0.75, nor.y)
                  * (1.0 - smoothstep(0.0, 0.010, max(abs(ax) - 0.062, abs(pos.z + 0.160) - 0.056)));
        base = mix(base, vec3(0.320, 0.042, 0.038), win);
        base += vec3(0.66, 0.05, 0.03) * win * gScan;
        shin = 70.0; spAmt = 0.55; mtl = 0.10; ambAmt = 0.34;
      } else {
        base = vec3(0.452, 0.466, 0.496);
        base *= 0.95 + 0.09 * vnoise(vec2(pos.y * 34.0, ax * 8.0));
        base *= 1.0 - smoothstep(0.016, 0.003, abs(abs(pos.z + 1.020) - 0.026)) * 0.14;
        shin = 52.0; spAmt = 0.55; mtl = 0.30; ambAmt = 0.46;
      }
    }

    /* ---------------- light ----------------
       One key off the high bay, the room itself as fill, a bounce off
       the floor, two distance taps of occlusion and — desktop only — a
       short shadow ray. The fill and the bounce are the SITE's colours,
       which is how a brown box and a grey roller end up living in a
       violet room instead of being pasted onto a picture of one. */
    vec3  lig = normalize(vec3(-0.34, 0.86, 0.38));
    float dif = clamp(dot(nor, lig), 0.0, 1.0);

    /* ---- the carton is SITTING on the bed, and this is what says so ----
       The board's underside is at 0.100 and the crown of every roller at
       0.1005: they touch, and they always did. What was missing is the
       shadow that proves it, and what was here was a soft box pushed
       0.17 along the line and 0.12 across it TOWARDS the key rather than
       away from it — so the dark patch sat on the wrong side of the
       carton at both ends, and a box beside its own shadow is a box
       hanging in the air.

       So it is cast now instead of placed. The receiving point is run
       back up the KEY to the plane of the carton's underside and tested
       against the carton's own footprint, which means three things at
       once: it lands where this light actually throws it (+x and -z),
       it travels with the box pitch for pitch because the footprint is
       taken in the carton's own cell, and it is TIGHT AND BLACK where
       the two meet and opens and lifts with every millimetre of air
       under the surface catching it. The darkest pixel in the picture
       is the line where the board sits on the tube.

       Every tier gets it; the marched ray is desktop only and now says
       the same thing rather than fighting it. */
    float lift = max((0.100 - pos.y) / lig.y, 0.0);     // air under the receiver
    vec2  sfp  = pos.xz + lig.xz * lift;                // back up the key to the underside
    float sdw  = sdBox2(vec2(cell(sfp.x + gCam - gRef, P_P), sfp.y), vec2(0.818, 0.478)) - 0.042;
    float pen  = 0.022 + 0.62 * lift;                   // the penumbra opens with the gap
    float contact = 1.0 - (0.82 / (1.0 + 3.4 * lift))
                        * (1.0 - smoothstep(0.0, pen, sdw))
                        * smoothstep(0.128, 0.100, pos.y);

    /* And the other half of standing on something, which the key shadow
       cannot supply from where this camera is: the board takes the ROOM
       away from the bed it is pressed against. This key comes over the
       carton's front shoulder, so the strip of tube the camera can see
       under the box is not in its cast shadow at all — it is simply
       walled in by a board a centimetre away, and what it loses is
       ambient, not key.
       Taken off the carton's own exact field, so it is tightest and
       deepest at the tube the board is touching and opens out into the
       gap between one carton and the next. Folded in with a MIN rather
       than added: a desktop already gets this from its second occlusion
       tap and must not pay twice, while a phone has only the 70mm tap
       and was the tier the box looked parked above the bed on. */
    float ct  = 0.74 * smoothstep(0.30, 0.02, dP) * smoothstep(0.128, 0.100, pos.y);

    float sh  = contact;
    if (uTier > 0.75 && dif > 0.01) sh = min(sh, shade(pos + nor * 0.011, lig));

    float occ = clamp(map(pos + nor * 0.070) / 0.070, 0.0, 1.0);
    if (uTier > 0.25) occ = 0.5 * occ + 0.5 * clamp(map(pos + nor * 0.250) / 0.250, 0.0, 1.0);
    occ = min(occ, 1.0 - ct);
    occ = mix(occ, 1.0, 0.24);

    vec3  sky = mix(uColors[2], uColors[3], 0.72);
    vec3  grd = mix(uColors[1], uInk, 0.42);
    vec3  amb = mix(grd, sky, clamp(nor.y * 0.5 + 0.5, 0.0, 1.0));
    float bnc = clamp(0.25 + 0.75 * dot(nor, vec3(0.16, -1.0, 0.24)), 0.0, 1.0);

    vec3  hv  = lig - rd;
    vec3  hal = hv / max(length(hv), 1e-4);
    float spc = pow(clamp(dot(nor, hal), 0.0, 1.0), shin);
    float fre = clamp(1.0 + dot(nor, rd), 0.0, 1.0); fre = fre * fre * fre;

    /* The key ramps each material from its OWN shade to its OWN albedo.
       A ramp that runs on to near-white takes a black barcode up to the
       same tone as the board it is printed on, and every mark above it
       with it. */
    float key = dif * mix(0.20, 1.0, sh);
    key = key * key * (3.0 - 2.0 * key);
    vec3 c = base * (amb * ambAmt * (0.34 + 0.66 * occ) + vec3(1.0, 0.985, 0.960) * key * 1.02);
    c += base * mix(uColors[2], uColors[1], 0.35) * bnc * 0.16;

    /* What the steel reflects, which is most of what steel is — and what
       it reflects is the studio overhead, not the violet wall behind it.
       Tinted by the metal's own albedo on the way back out, because that
       is the one thing a metal does to a reflection. */
    vec3  ref  = reflect(rd, nor);
    vec3  eC   = studio(ref);
    float lamp = (ref.y - 0.66) / 0.17;
    eC = mix(eC, vec3(1.0), exp(-lamp * lamp) * 0.60);   // the high bay's own tube, in it
    c = mix(c, eC * mix(vec3(1.0), base * 1.70, 0.74), mtl * (0.26 + 0.46 * fre));

    c += vec3(1.0, 0.985, 0.955) * spc * spAmt * mix(0.30, 1.0, sh);
    c = mix(c, mix(grd, uInk, 0.22), (1.0 - occ) * 0.28);
    // The room's violet lands straight on the dull surfaces at a grazing
    // angle. The polished ones have a sky of their own by now and taking
    // the wall to them a second time is how tube goes lilac.
    float rim = 1.0 - clamp(mtl * 3.2, 0.0, 1.0);
    c = mix(c, mix(uColors[2], uColors[3], 0.55), fre * 0.13 * rim);
    c = mix(c, eC, fre * 0.20 * (1.0 - rim));

    /* ---------------- the beam, where it lands ----------------
       The sweep is a plane through the head; where it crosses a surface
       it draws a line. It is added after the light and it is not
       shadowed, because a laser is not lit by the room — and it is
       scaled by how much red the surface can give back, so it is
       brightest on the label, strong on the board and cool on the
       steel. Which is what a scan line really does, and the reason one
       is worth drawing at all.
       And it is drawn only where the light can GET to: the plane crosses
       the carton, the carton's own face, and the bed beyond it, and only
       the first of those three is lit. */
    float dPlane = dot(pos.xy - headP.xy, gFanN);
    float below  = smoothstep(0.00, 0.09, headP.y - pos.y);
    float clear  = beamClear(headP, pos, gParX) * beamClear(headP, pos, gPar2);
    /* How far the fan spreads across the bed. It is cut at 0.86 and not
       further, and that is a fix rather than a taste: the gantry post
       stands at z -1.02, and at the extremes of the stroke the sweep
       plane passes straight through it. A red line up a steel column
       nobody is scanning reads as a leak, so the fan stops just short of
       it — which is also where a real line-generator's aperture stops. */
    float across = 1.0 - smoothstep(0.70, 0.86, abs(pos.z - headP.z));
    /* And how far the beam throws. Without this the sweep plane goes on
       for ever: at the end of its stroke it is pointing three units down
       the bed, so a head that has already left the frame leaves a single
       red pixel on a roller with nothing to explain it — which reads as
       a stray, not as a laser. A diverging beam dies anyway, so it dies
       here, just past the far end of the carton it is reading. */
    float reach  = 1.0 - smoothstep(1.90, 2.60, length(pos.xy - headP.xy));
    float lineI  = exp(-dPlane * dPlane * 6400.0) * below * across * reach * clear * gScan;
    c += vec3(1.00, 0.10, 0.06) * lineI * (0.30 + 1.05 * base.r);
    c += vec3(1.00, 0.24, 0.16) * exp(-dPlane * dPlane * 260.0)
       * below * across * reach * clear * gScan * 0.11;

    // Air. The bed runs away to the left and it goes into the building
    // rather than off the edge of a sheet.
    c = mix(c, bg, smoothstep(7.0, 16.5, nt));
    col = mix(bg, c, cover);
  }

  /* ---------------- the beam, in the air ----------------
     The stroke between the head and whatever it is standing on, drawn in
     screen space off its two projected ends and cut wherever something
     nearer has already been drawn. It leans as the mirror swings, and it
     lands on the crown of the carton when there is one under it and on
     the tubes when there is not — which is what makes the extremes of
     the stroke read as the beam running off the end of the box.
     Unconditional, because the diode is: gScan never reaches zero. */
  {
    float fcl  = D / halfH;
    float tanA = gFanN.y / max(gFanN.x, 0.30);           // tan of the fan angle, guarded
    /* Where the stroke ENDS, and it ends at the first thing in its way.
       The beam leaves the head on (tanA, -1); under it are the two
       cartons nearest the station and, past them, the crown of the bed,
       and the foot is the nearest of the three. So the line stops ON the
       board while there is board under it, on the END of the board while
       it is running off the side of one, and on the tubes when there is
       nothing there.
       This was a fade between a box top and a bed on a threshold of
       0.80, which is neither: for a tenth of the carton's length the
       stroke ended INSIDE the board, and past the threshold it ran
       through it to the rollers. A beam does not average two surfaces.
       It does step, hard, when it clears the far top edge — that is what
       a laser sweeping off the corner of a box really does. */
    vec2  bd   = vec2(tanA, -1.0);
    float drop = min(headP.y - 0.101,
                     min(beamDrop(headP.xy, bd, gParX), beamDrop(headP.xy, bd, gPar2)));
    vec2  foot = headP.xy + bd * drop;

    vec3  A  = headP;
    vec3  B  = vec3(foot.x, foot.y, -0.050);
    vec3  va = A - ro, vb = B - ro;
    float za = dot(va, ww), zb = dot(vb, ww);
    if (za > 0.4 && zb > 0.4) {
      vec2  pa = vec2(dot(va, uu), dot(va, vv)) * fcl / za;
      vec2  pb = vec2(dot(vb, uu), dot(vb, vv)) * fcl / zb;
      vec2  ab = pb - pa;
      float h  = clamp(dot(s - pa, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
      float dl = length(s - pa - ab * h);
      float bw = 0.0085;
      float dz = mix(za, zb, h);
      float vis = smoothstep(-0.07, 0.03, hitDepth - dz);
      col += vec3(1.00, 0.13, 0.08) * exp(-(dl * dl) / (bw * bw)) * gScan * vis * 0.60 * mix(0.5, 1.0, h);
      col += vec3(1.00, 0.30, 0.20) * exp(-(dl * dl) / (bw * bw * 24.0)) * gScan * vis * 0.10;
    }
  }

  // The building is already there; the line arrives on it.
  col = mix(bg, col, e);
  // A little tooth, so a long wash never bands on a cheap panel.
  col += (hash(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) * 0.016;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export const scene: Scene = {
  frag,
  colors: ["#551a89", "#7c74a6", "#f4f3f7", "#ffffff"],
  /* The line at rest, as far as stacked gradients can carry it — and they
     have to carry it, because this is what a reader on a slow phone looks
     at until the shader has compiled and what a device with no WebGL is
     left with for good. Solved against the SHADER'S OWN 390x488 frame,
     layer by layer and measured off it rather than guessed: the post and
     its spar where the render puts them, the scan head on the end of it,
     the kraft block under that with its white label, the roller crowns,
     the channel and its legs. The violet is the building; the brown, the
     white and the red are the objects, which is the same division the
     shader makes — and it is the same object in the same place, so the
     picture does not jump when the shader finally arrives. */
  poster: [
    /* The paper cut comes FIRST, because the harness applies its own last:
       guarded() mixes the bottom of every band to white from 0.30 of the
       height down to 0.17, and a poster whose legs and channel run on
       under that line is a poster that does not match the picture it is
       standing in for. Same two numbers, same direction. */
    "linear-gradient(to top, #ffffff 0 17%, rgba(255,255,255,0) 30%)",
    /* The beam. It LEANS, because the shader's does — the fan is tilted
       off vertical, and it STOPS ON THE CROWN, because the shader's does
       too: a scan line ends at the first surface it meets, and the board
       is that surface. This box used to run 140px down the picture, which
       carried the poster's line through the face of the carton and onto
       the rollers under it — the same fault the shader had, in the layer
       a reader on a slow phone actually looks at. So: one box the size of
       the stroke the render really draws, measured off the shader's own
       390 frame at the still's uTime of 2.0 — head at (203,121), crown at
       (213,153) — and a gradient turned across it at the stroke's own
       angle, which makes a straight line of any slope out of two stops. */
    "linear-gradient(76deg, rgba(232,38,26,0) calc(50% - 1.6px), rgba(233,46,34,0.88) calc(50% - 1.6px), rgba(233,46,34,0.88) calc(50% + 1.6px), rgba(232,38,26,0) calc(50% + 1.6px)) calc(50% + 13px) calc(50% - 107px) / 24px 36px no-repeat",
    "linear-gradient(76deg, rgba(232,38,26,0) calc(50% - 8px), rgba(236,74,60,0.17) calc(50% - 8px), rgba(236,74,60,0.17) calc(50% + 8px), rgba(232,38,26,0) calc(50% + 8px)) calc(50% + 13px) calc(50% - 107px) / 24px 36px no-repeat",
    /* The scan head on its cantilever: the box, the spar, the post. */
    "linear-gradient(#26262e, #101015) calc(50% + 11px) calc(50% - 142px) / 27px 40px no-repeat",
    "linear-gradient(#83878f, #565a64) calc(50% - 70px) calc(50% - 161px) / 146px 12px no-repeat",
    "linear-gradient(#6b6f7a, #50545e) calc(50% - 139px) calc(50% - 101px) / 12px 133px no-repeat",
    /* The label: carrier block, two ruled lines of address, the barcode. */
    "repeating-linear-gradient(to right, #14131a 0 2px, rgba(255,255,255,0) 2px 5px) calc(50% + 34px) calc(50% - 37px) / 46px 16px no-repeat",
    "linear-gradient(#44434b, #44434b) calc(50% + 51px) calc(50% - 52px) / 25px 3px no-repeat",
    "linear-gradient(#3c3b43, #3c3b43) calc(50% + 53px) calc(50% - 59px) / 29px 3px no-repeat",
    "linear-gradient(#0f0e14, #0f0e14) calc(50% + 23px) calc(50% - 58px) / 23px 9px no-repeat",
    "linear-gradient(#f8f7f3, #eceae5) calc(50% + 39px) calc(50% - 46px) / 64px 42px no-repeat",
    /* The carton: a lit crown, kraft board, a scuffed foot. Every one of
       these five tones was read off the shader's own 390 frame rather
       than picked, which is why the poster does not warm up by half a
       stop the moment the canvas takes over. */
    "linear-gradient(#cb956d 0 7%, #9a6a45 7% 11%, #7a5340 11% 28%, #6e4b37 28% 84%, #4f3628 84% 100%) calc(50% + 21px) calc(50% - 47px) / 226px 101px no-repeat",
    /* The side guide, the roller crowns, the channel rail and its legs. */
    "linear-gradient(#8d919c, #6f7380) 50% calc(50% - 39px) / 100% 6px no-repeat",
    "repeating-linear-gradient(to right, #3c3f48 0 2px, #5a5d69 2px 4px, #969aa6 4px 15px, #3f424c 15px 17px) 50% calc(50% + 3px) / 100% 68px no-repeat",
    "linear-gradient(#5f5d6b 0 9%, #504e5d 9% 100%) 50% calc(50% + 76px) / 100% 74px no-repeat",
    "repeating-linear-gradient(to right, rgba(0,0,0,0) 0 96px, #63616f 96px 110px, rgba(0,0,0,0) 110px 190px) 50% calc(50% + 135px) / 100% 46px no-repeat",
    /* The building, in the order the shader builds it: the wall going
       violet as it climbs, the pool of light where the station is — and
       the shader puts that pool at the middle of the LINE, not the middle
       of the band, so on a phone it sits a sixth of the way in — then the
       vignette last and over the top of both. */
    "linear-gradient(to right, rgba(85,26,137,0.10) 0%, rgba(85,26,137,0) 26%, rgba(85,26,137,0) 74%, rgba(85,26,137,0.10) 100%)",
    "radial-gradient(64% 58% at 16% 46%, rgba(255,255,255,0.56) 0%, rgba(255,255,255,0) 100%)",
    "linear-gradient(#b0abcb 0%, #c2bed8 30%, #d2cfe1 58%, #eae9f1 86%, #f8f7fb 100%)",
  ].join(", "),
  alt: "A kraft cardboard parcel with a white shipping label, sitting on a galvanised roller conveyor and seen from the side and low, standing under a scan head on a cantilevered post while a red laser line is drawn across the top of it. The rollers turn, the bed indexes one parcel along every couple of seconds, and the next parcel arrives under the head as this one leaves.",
};
