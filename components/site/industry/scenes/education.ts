import type { Scene } from "../shader-stage";

/* ------------------------------------------------------------------ *
 * Schools & tutoring — the tower, built one block at a time.
 *
 * WHAT THIS REVISION FIXED, because three of the four were the same
 * mistake made three ways — putting something in the frame that was not
 * the subject, and letting the house violet stand in for light.
 *
 *   ONE THING, AT EVERY WIDTH. The scatter of spare blocks used to grow
 *   with the band: four on a 4:5 and TWELVE on a 21:9, several of them
 *   cut in half by the edges. The 4:5 read as a tower being built and
 *   the 21:9 read as a spilled toybox — two different answers to the
 *   same picture, which is the one fault this set is not allowed to
 *   have. The count now runs the other way, five to four to three, and
 *   the three that survive stand further apart rather than closer.
 *
 *   THE ORPHAN. The floor carried a play mat drawn as a soft violet
 *   ellipse eight units across. At 4:5 you never saw the whole of it; at
 *   21:9 it was the biggest object in the picture, the same colour as
 *   every shadow, and with no edge a mat has — so it read as a shadow
 *   belonging to nothing. It is gone. What shapes the floor now is the
 *   pool under the window and the marks the blocks keep off it, both of
 *   which have something standing over them.
 *
 *   THE FLOATERS. This one was reported three times, and the two failed
 *   answers are worth keeping on the record because between them they
 *   are the whole shape of the mistake. A loose block had one mark on
 *   the floor, thrown along the light and therefore half a unit clear of
 *   the block — so the first answer given was to add a SECOND mark
 *   underneath it, and two shadows is one light too many: what came back
 *   was two grey smudges lying near a block and neither touching it. The
 *   second answer made it one mark, the block's own footprint — and then
 *   TRANSLATED that footprint a sixth of a unit along the light, which
 *   is the first fault again in a smaller hand. A square slid a sixth of
 *   a unit is no more under the block than a disc slid half of one; it
 *   just takes less daylight in along the near edge. Nineteen pixels of
 *   it, on the green D.
 *   There is ONE mark now and it does not move: the footprint where the
 *   block sits is the contact, and the light's angle is spent on the
 *   PENUMBRA — the same footprint swept along the light, which contains
 *   the contact instead of leaving it behind.
 *
 *   THE LETTERS. They were left as bare timber in the cut: a muddy tan
 *   on chrome yellow, which is the one pairing that cannot be read at
 *   all. The cut is now FILLED, white on the dark grounds and black on
 *   the yellow, chosen off the luminance of the pigment under it.
 *
 *   THE SHADOWS. Every mark on the floor was a mix toward flat #551a89
 *   — 42 per cent of it under the tower — which made the contact shadow
 *   the most saturated thing in the frame. That was corrected into a
 *   grey multiply, which is the opposite fault: a shadow in a room with
 *   two lights in it is not grey, it is the colour of the one light that
 *   still reaches. They are multiplies by the ROOM's own hue now —
 *   violet-grey, because that is what is bouncing around in here once
 *   the warm window is blocked — and still multiplies, never a mix
 *   toward a pigment.
 *
 *   THE STAIRCASE. Nothing in this band had an edge. A march that
 *   answers yes or no and a ray-box test that answers yes or no both
 *   write a hard silhouette, and a hard silhouette into a buffer drawn
 *   at a fraction of the screen's pixels is a flight of stairs round
 *   every block — worse on the marched tower, where a grazing ray is
 *   also the ray that needs the most steps, so the budget ran out along
 *   the edge and left it ragged as well as square. Both now answer with
 *   COVERAGE: how much of the pixel the block fills, measured in pixels
 *   rather than in world units so the answer is the same on a phone and
 *   on a desktop, and the block is composited over the floor instead of
 *   overwriting it. It costs one divide per march step and one extra
 *   floor evaluation behind a block, and it is the difference between a
 *   render and a screenshot of a render.
 *
 * (Nothing here is REFLECTIVE, so the studio rule at the top of
 * shader-stage.tsx does not bite: a varnished beech block is a diffuse
 * pigment with a small specular on it, not a mirror, and its shaded side
 * is meant to take the violet of the room it is standing in.)
 *
 * Two generations of this band are dead. The first was a field of
 * smears; the second was a flat drawn register, a picture that breathed
 * rather than a thing that moved. The note both times was the same and
 * it was finally said plainly: REAL movement, REAL depth, and a NEW
 * object. So there is nothing drawn here. There is a room, a floor, a
 * window, six wooden blocks, and a camera looking at them.
 *
 *   THE OBJECT. Nursery building blocks: cubes with rounded arrises and
 *   a letter cut into the face — A at the bottom, then B, C, D, E, F.
 *   Real geometry, marched, lit from a normal taken off the surface, so
 *   the near face and the far face of the same cube are different
 *   colours and the seam between two blocks is a groove with light in
 *   it. The letters are debossed at shading time rather than carved
 *   into the field: a groove a millimetre deep changes a silhouette by
 *   nothing and costs a march everything.
 *
 *   THE MOTION, which is the brief and not a suggestion: STACKING. One
 *   block at a time, swung in from beyond the frame, lifted over the
 *   tower, held for a beat while it is aimed, and set down. Each one
 *   lands a few degrees out of true and a little off centre, and the
 *   error accumulates, so the column leans the way a two-year-old's
 *   leans. The whole tower shivers when a block lands and the shiver
 *   damps out. IT NEVER FALLS. It reaches six, holds, and then the
 *   blocks are lifted away again one at a time until one is left, which
 *   is where the loop began. 15.6 seconds, no seam: the last block
 *   leaves through exactly the point the next one enters by, at exactly
 *   the attitude the next one enters at.
 *
 *   THE CAMERA. It pulls back as the tower grows. The framing is
 *   SOLVED, not tuned: the shader knows the height it has to hold
 *   (tower, plus headroom, plus the floor under it), knows the band's
 *   usable window — the harness washes the bottom to paper for the
 *   kicker and the site header floats over the top — and divides. The
 *   distance runs from eight block-widths to seventeen, and the camera
 *   levels off as it goes, looking down on the first block and very
 *   nearly straight at six. What that buys is the thing to watch. From
 *   the second block on, the tower's share of the frame hardly changes
 *   — three fifths of the window at two blocks, five sixths at six,
 *   because the headroom and the floor under it are held in the same
 *   frame — while the room around it more than DOUBLES in width, and
 *   the toys lying on the floor get further away and smaller as it
 *   does. The setting gets bigger and the child does not. What the
 *   pull-back is NOT allowed to do any more is hand the frame extra
 *   objects: that was tried, and eleven loose blocks is a toybox, not a
 *   room. (The one state that
 *   is not held to that is the single block the loop opens and closes
 *   on, where there is no tower to be about: the camera is held off
 *   there on purpose, and why is written where it happens.)
 *
 * MATERIALS, which is what this revision is for. The tower used to be
 * six shades of the site's violet, which is not what a block is.
 *
 *   PAINTED BEECH, in four nursery primaries and nothing else:
 *   vermilion, cobalt, chrome yellow, leaf green, written as literals
 *   and assigned by index so no two touching blocks in the tower share
 *   a pigment. Under the paint is the timber, and it shows in three
 *   places, all three of which are why a real block does not look like
 *   an extruded plastic one:
 *     · THE GRAIN. Paint sinks into the figure of the wood and dries
 *       fractionally darker there. The grain runs along ONE axis of the
 *       cube, so the same lines carry over the top face and down the
 *       side, and the two ends of the batten show rings instead —
 *       which is the difference between painted wood and painted
 *       anything else.
 *     · THE ARRISES. Paint is rubbed thin along every rounded edge,
 *       because that is what a hand and a floor do to an edge.
 *     · THE CHIPS. And in places it is off altogether, down to bare
 *       beech — hard-edged, irregular, hashed off the block's own
 *       coordinates so they sit still on the block while it turns.
 *   The letter is CUT and then FILLED: one lit lip and one shaded lip
 *   off the gradient of the letter's own field, and enamel in the
 *   groove — white where the ground is dark, black on the chrome
 *   yellow, picked off the luminance of the pigment under it. Those are
 *   the only two colours an alphabet block has ever used for a letter,
 *   and the reason is arithmetic: the bare timber this used to leave in
 *   the cut is a tan-brown, and tan-brown on yellow is the one pairing
 *   on the wheel with no contrast in it at all.
 *
 *   THE ROOM IS THE SITE'S, and stays the site's. Floor, haze,
 *   backdrop, the cast shadows and — the part that does the work — the
 *   FILL LIGHT all come off uColors and uInk. There is one warm window
 *   key and one violet-grey room bouncing into everything, so a red
 *   block's shaded side goes violet here exactly the way it would in
 *   that room. What is NOT the room's colour is the floor's shadows:
 *   light taken away cannot be more saturated than the light that was
 *   there, so every mark on the floor is a multiply with a breath of
 *   ink in it and never a mix toward a pigment. Between them those two
 *   rules are what stop four primaries looking pasted onto a violet
 *   page, and stop the page looking bruised under them.
 *
 * WHY IT CANNOT CROP. The band is 4:5 on a phone and 21:9 on a desktop.
 * Nothing here is sized for either. The vertical fit is the binding one
 * for a vertical object, so it is the one that is solved; the focal
 * length is opened up on the long band so the horizontal field does not
 * run away with it, and the tower is pushed an eighth of a frame left
 * of centre there so the long side has the floor, the cast shadow and
 * the three spare blocks in it rather than being dead space.
 * A vertical object in a 21:9 band cannot fill it and should not try;
 * what fills it is the room the object is standing in — light and
 * floor, which have no silhouette to count. The block that
 * flies in enters from a point computed FROM the camera — just outside
 * whichever edge this band actually has — so it is off frame at 4:5 and
 * off frame at 21:9 without a number being guessed at either.
 *
 * COST, against the contract at the top of shader-stage.tsx.
 *   · ONE march. 48 steps on a desktop, 36 on a tablet, 24 on a phone,
 *     exactly as the budget writes it. It breaks on a hit and on the
 *     far limit and never runs to the cap.
 *   · NO second march. The cast shadow is analytic — the tower's is one
 *     capsule on the floor whose radius and blur grow with the height
 *     it is thrown from, the flying block's is one ellipse — which is
 *     both cheaper than sixteen more steps and softer than they would
 *     have been.
 *   · The march is bounded before it starts: a ray is tested against a
 *     cylinder round the stack and a sphere round the block in the air,
 *     and against the floor plane, and most fragments never enter the
 *     loop at all. Both bounds are conservative by a clear margin and
 *     neither is ever handed back below the march's hit epsilon.
 *   · map() evaluates FOUR boxes, not six. A stack is indexed by
 *     height, so a point asks the three blocks nearest its own y and
 *     the one in the air, and a tower of six costs what a tower of
 *     three does. Per-block jitter comes out of a hash and the yaw out
 *     of an inverse square root, so there is no trigonometry anywhere
 *     inside the loop.
 *   · The loose blocks on the floor are not marched at all. They are
 *     exact ray-box intersections behind a bounding-sphere refusal,
 *     which between them cost less than one step of the loop.
 *   · Every material — grain, chips, letter — is resolved ONCE, at the
 *     surface, from the block's own local coordinates. Nothing in the
 *     paint costs a step.
 *   · What uTier buys back is rays and taps, never the subject. The
 *     tower, its paint, its grain, its chips, its letters and its
 *     lighting are identical on all three tiers. A phone halves the
 *     march steps and drops the second occlusion tap; a tablet drops
 *     the second tap. How many spare blocks are on the floor is NOT a
 *     tier decision and never was one — it is the band's aspect, and it
 *     goes down as the band gets wider, so the picture a stranger is
 *     asked to name is the same picture at 390 and at 1440.
 * ------------------------------------------------------------------ */

const frag = `
const float NB    = 6.0;     // a finished tower
const float HALF  = 0.5;     // a block is one unit on the side
const float BR    = 0.075;   // and its arrises are rounded, like a toy's
const float LOOP  = 15.6;    // build, hold, clear away
const float PLACE = 2.0;     // one block lifted in and set down
const float HOLD  = 1.7;     // the pause at full height
const float REM   = 0.78;    // one block lifted away again
const float LEANX = 0.34;    // where the top of the tower ends up
const float LEANZ = -0.22;

/* ---- the materials, as literals ----
   Four pigments off a real nursery set. Not a palette: these are what
   the paint on a beech block is, and there is no fifth. */
const vec3 VERMILION = vec3(0.741, 0.153, 0.118);
const vec3 COBALT    = vec3(0.086, 0.325, 0.612);
const vec3 CHROME    = vec3(0.929, 0.678, 0.086);
const vec3 LEAF      = vec3(0.216, 0.518, 0.243);
/* And the timber under all four, which shows at every chipped arris and
   in the floor of every cut letter. Beech: pale, warm, and darker along
   the figure. */
const vec3 BEECH = vec3(0.826, 0.686, 0.487);
const vec3 GRAIN = vec3(0.564, 0.420, 0.263);

/* The rest of the toy box, left where it was dropped — and there is
   very little of it, which is the correction this revision exists for.

   The last cut scattered TWELVE spare blocks in three rings and handed
   the widest band all twelve. What that produced at 21:9 was not a room
   with a tower in it; it was eleven loose blocks, several of them cut in
   half by the left and right edges, with a tower somewhere among them —
   a spilled toybox. The 4:5 band, which only ever saw four, was the one
   width that read as the thing this band is about. So the count now runs
   the other way: FOUR up to 16:10, THREE on a 21:9, against twelve. The
   wider the room, the fewer the toys, because a wide band does not need
   filling — the tower has to be the only thing in it worth counting.

   Four and not five on the narrow band, and that is arithmetic rather
   than taste. A 4:5 frame is 0.80 of a half-width across; the tower eats
   0.24 of it and a block at these depths is 0.09 to 0.16 wide, so four
   spares and their gaps come to about 0.56 against 0.56 of usable
   width. A fifth has nowhere to stand that is not already occupied, and
   a fifth was tried: it produced two pairs of touching blocks, which is
   a worse picture than four well-placed ones.

   NOT ONE OF THEM IS IN THE CAMERA'S CORRIDOR. The camera orbits a few
   degrees either side of one azimuth, so it always stands off toward
   +x +z. Every spare is placed in the camera's own frame instead — so
   far BEHIND the tower, so far ACROSS it — and then frozen into world
   coordinates at that mean azimuth, which is the only way a fixed
   scatter can be guaranteed inside a 4:5 frame and a 21:9 one at once.
   The four were swept against all three frames at nineteen moments of
   the loop, and the crop was measured rather than judged: the outermost
   three columns of the rendered band were searched for a saturated pixel,
   which only a painted block can produce. The only edge any block ever
   touches is the left one, at the moment the block in the air is coming
   through it, which is the motion doing what it is meant to. No spare is
   cut at any width at any moment.

   The first three are the ones the widest band keeps, so they are the
   three that carry the layout: one out to the left, one near on the
   right, one far beyond it. The fourth is the far left-hand one, and it
   is the one a 21:9 drops. One table rather than a dozen named
   constants, because the ray tests them in a loop: how far BEHIND the
   tower it is, how far ACROSS, how far round it is lying, and which
   letter is on it. Every one of them is on the floor, so y is 0.5 and
   is not worth a column.

   On the same side of the frame, the NEAR one sits close in to the
   tower and the FAR one well out — never the other way about. Two
   blocks whose across is proportional to their depth land on the same
   screen line whatever their distance, which is how a near block and a
   far one end up touching edge to edge and reading as one lump instead
   of as two toys with a floor between them. Every pair here was swept
   at one block standing (the closest the camera ever gets) and at six
   (the furthest), and they stay apart at both.

   ACROSS is the one that is scaled, and only that one. The vertical fit
   is solved, so a 21:9 band holds nearly three times the world width a
   4:5 band does at the same moment; a scatter placed to clear the narrow
   frame therefore huddles against the tower on the wide one, which is
   how a block ends up peering out from behind it and how the far corners
   end up empty. Depth is left alone — a spare that retreats as the band
   widens only gets smaller — and the spread doubles. */
const vec4 SPARES[4] = vec4[4](
  vec4(  4.20, -2.20,  0.42, 2.0),
  vec4(  9.00,  4.60, -0.66, 3.0),
  vec4(  2.90,  1.95,  1.30, 5.0),
  vec4( 10.60, -5.30, -0.28, 0.0)
);

/* The camera's own axes on the floor, at the azimuth it sways about —
   away from the lens, and across it. Frozen as constants because the
   scatter has to be FIXED in the world: a toy that slid sideways every
   time the pointer moved would not be a toy lying on a floor. */
const vec2 AWAY   = vec2(-0.4969, -0.8678);
const vec2 ACROSS = vec2( 0.8678, -0.4969);

/* Set once in main: how far the scatter is opened out, which is how the
   count is cut — both come off the band's aspect and nothing else. */
float gSpread;
int   gSpares;

vec2 sparePos(int i){
  vec4 s = SPARES[i];
  return s.x * AWAY + (s.y * gSpread) * ACROSS;
}

/* Set once in main, read inside the march. The block in the air has a
   real three-axis attitude, so its matrix is built once with the only
   six trig calls in the file rather than per step. */
vec3  gFlyP;
mat3  gFlyR;
float gFlyOn;
float gN;      // blocks currently standing
float gWob;    // the shiver a landing puts through the tower

/* Three well-spread numbers out of one index, and no sine in it: a big
   sine argument rounds badly on some mobile GPUs and the jitter would
   come out in stripes up the tower. */
vec3 hash31(float n){
  vec3 q = fract(vec3(n) * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yxz + 33.33);
  return fract((q.xxy + q.yzz) * q.zyx);
}

/* The same, from a pixel. Sine-free for the same reason: this one is
   fed raw fragment coordinates, which is the worst case for it. */
float hash2(vec2 p){
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

/* cos and sin of atan(t), exactly, for one inverse square root. Every
   block's yaw is carried as a tangent so the march never calls trig. */
vec2 rotc(float t){ float n = inversesqrt(1.0 + t*t); return vec2(n, t*n); }

mat3 rotMat(vec3 a){
  float cy = cos(a.x), sy = sin(a.x);
  float cp = cos(a.y), sp = sin(a.y);
  float cr = cos(a.z), sr = sin(a.z);
  mat3 Y = mat3( cy, 0.0, -sy,  0.0, 1.0, 0.0,   sy, 0.0,  cy);
  mat3 P = mat3(1.0, 0.0, 0.0,  0.0,  cp,  sp,  0.0, -sp,  cp);
  mat3 R = mat3( cr,  sr, 0.0,  -sr,  cr, 0.0,  0.0, 0.0, 1.0);
  return Y * P * R;
}

float rbox(vec3 p, float b, float r){
  vec3 d = abs(p) - b + r;
  return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0) - r;
}

float seg2(vec2 p, vec2 a, vec2 b){
  vec2 pa = p - a, ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}

/* Which pigment block i is painted with. Four of them, taken in order,
   so no two blocks touching in the tower are the same colour and the
   set reads as a set rather than as a gradient. */
vec3 paintOf(float i){
  float k = mod(i + 0.5, 4.0);
  if (k < 1.0) return VERMILION;
  if (k < 2.0) return COBALT;
  if (k < 3.0) return CHROME;
  return LEAF;
}

/* The figure of the timber, in the block's own coordinates.

   A block is sawn off a square batten, so the grain runs along ONE axis
   — here the local x — and that single fact is most of what separates
   painted wood from painted plastic: the same lines carry across the
   top face and down the side because they are the same board, and the
   two ends of the batten show rings rather than lines because they are
   cut across it. Evaluated once, at the surface, never in the march. */
float grainAt(vec3 q, vec3 nl, float seed){
  float a;
  if (abs(nl.x) > 0.5) {
    // the sawn end of the batten: growth rings about an off-centre pith
    a = length(q.yz - vec2(0.34, -0.26)) * 7.6 + seed;
  } else {
    // along the batten: straight figure, wandering the way a board's does
    a = (abs(nl.y) > 0.5 ? q.z : q.y) * 6.2 + sin(q.x * 3.1 + seed) * 0.42 + seed;
  }
  float r = abs(fract(a) - 0.5) * 2.0;
  return smoothstep(0.40, 0.99, r);      // 0 in the pale wood, 1 on a line
}

/* A stack is sorted by height, so a point only has to ask the blocks
   nearest its own y. Three of them, plus whatever is in the air. */
vec4 blkXf(float i){
  vec3 h = hash31(i + 3.17);
  float f = i / (NB - 1.0);
  float ff = f * f;
  return vec4(LEANX * ff + (h.x - 0.5) * 0.105 + gWob * f,
              i + 0.5,
              LEANZ * ff + (h.y - 0.5) * 0.105,
              (h.z - 0.5) * 0.40 + i * 0.048);
}

float blockAt(vec3 p, float i){
  vec4 x = blkXf(i);
  vec3 q = p - x.xyz;
  vec2 cs = rotc(x.w);
  q.xz = vec2(cs.x * q.x + cs.y * q.z, cs.x * q.z - cs.y * q.x);
  return rbox(q, HALF, BR);
}

float map(vec3 p){
  float i0 = clamp(floor(p.y), 0.0, gN - 1.0);
  float d = blockAt(p, i0);
  d = min(d, blockAt(p, max(i0 - 1.0, 0.0)));
  d = min(d, blockAt(p, min(i0 + 1.0, gN - 1.0)));
  if (gFlyOn > 0.5) d = min(d, rbox(gFlyR * (p - gFlyP), HALF, BR));
  return d;
}

/* Four taps, and never normalize() on something that could be zero: a
   constant patch of field would hand back a zero gradient and a NaN
   normal paints a black hole in the middle of a block. */
vec3 nrm(vec3 p, float k){
  vec2 e = vec2(1.0, -1.0) * k;
  vec3 g = e.xyy * map(p + e.xyy) + e.yyx * map(p + e.yyx)
         + e.yxy * map(p + e.yxy) + e.xxx * map(p + e.xxx);
  return g / max(length(g), 1e-6);
}

/* The ray's window on the tower: a cylinder round the stack, capped at
   its own height. Most of the band never opens the march at all.

   The radius is CONSERVATIVE and deliberately loose. The furthest any
   block reaches from the axis is its centre offset (lean, plus hash
   jitter, plus the landing shiver — 0.51 at worst) plus its own rotated
   half-diagonal (0.71), so 1.22; the bound is 1.45 and the few extra
   fragments it lets into the loop cost far less than a bound that
   clipped the thing it was bounding would.

   THE CAPS ARE LOOSER THAN THEY WERE, and they had to become so the
   moment the silhouette gained a soft edge. A ray that passes a pixel
   above the top face has to ENTER the bound to find out how close it
   came; at six blocks on the smallest buffer this band draws, the old
   clearance of 0.06 of a unit was three quarters of a pixel, so the top
   edge was being handed a hard cut-off exactly where the antialias was
   supposed to be. 0.24 is two pixels there and ten on a desktop, and
   what it costs is a handful of rays that leave the loop immediately. */
vec2 cylSlab(vec3 ro, vec3 rd, float r, float y0, float y1){
  vec2 o = ro.xz, d = rd.xz;
  float a = dot(d, d), b = dot(o, d), c = dot(o, o) - r * r;
  float t0 = -1e9, t1 = 1e9;
  if (a < 1e-7){ if (c > 0.0) return vec2(1.0, -1.0); }
  else {
    float h = b * b - a * c;
    if (h < 0.0) return vec2(1.0, -1.0);
    h = sqrt(h);
    t0 = (-b - h) / a; t1 = (-b + h) / a;
  }
  if (abs(rd.y) < 1e-7){ if (ro.y < y0 || ro.y > y1) return vec2(1.0, -1.0); }
  else {
    float ta = (y0 - ro.y) / rd.y, tb = (y1 - ro.y) / rd.y;
    t0 = max(t0, min(ta, tb)); t1 = min(t1, max(ta, tb));
  }
  return vec2(max(t0, 0.0), t1);
}

/* And round the block in the air. A unit cube's half-diagonal is 0.866 at
   any attitude, so 1.06 clears it by more than two pixels at the furthest
   the camera ever stands and by ten on a desktop — which is what a bound
   round a shape with a soft edge has to clear it by, rather than the hair
   that is enough for a shape with a hard one. */
vec2 sphSlab(vec3 ro, vec3 rd, vec3 c, float r){
  vec3 o = ro - c;
  float b = dot(o, rd), cc = dot(o, o) - r * r;
  float h = b * b - cc;
  if (h < 0.0) return vec2(1.0, -1.0);
  h = sqrt(h);
  return vec2(max(-b - h, 0.0), -b + h);
}

/* The blocks lying loose on the floor are solved rather than marched:
   an exact slab intersection is cheaper than a single step of the loop,
   and they take the same paint, the same grain and the same letters as
   the tower. */
float boxHit(vec3 ro, vec3 rd, vec3 c, float yaw, float pxa, out vec3 nw, out vec3 nl, out vec3 loc, out float cv){
  nw = vec3(0.0, 1.0, 0.0); nl = nw; loc = vec3(0.0); cv = 0.0;
  vec2 cs = rotc(yaw);
  vec3 o = ro - c;
  vec3 po = vec3(cs.x * o.x  + cs.y * o.z,  o.y,  cs.x * o.z  - cs.y * o.x);
  vec3 pd = vec3(cs.x * rd.x + cs.y * rd.z, rd.y, cs.x * rd.z - cs.y * rd.x);
  // A sign-preserving reciprocal. Adding an epsilon to the denominator
  // is not a guard: a component that happens to sit ON minus that
  // epsilon divides by zero and the block comes back as a full-screen
  // wedge of NaN.
  vec3 sg = vec3(greaterThanEqual(pd, vec3(0.0))) * 2.0 - 1.0;
  vec3 m  = sg / max(abs(pd), vec3(1e-6));
  vec3 nn = m * po;
  vec3 kk = abs(m) * HALF;
  vec3 ta = -nn - kk, tb = -nn + kk;
  float tN = max(max(ta.x, ta.y), ta.z);
  float tX = min(min(tb.x, tb.y), tb.z);
  if (tX < 0.0) return -1.0;
  /* AND AN EDGE, RATHER THAN A STAIRCASE. A yes/no ray-box test writes a
     hard binary silhouette into a buffer this band draws at a fraction of
     the screen's own pixels, and what that looks like from a foot away is
     a flight of stairs round every block.

     Halfway between the two slab parameters is the ray's closest approach
     to the box — well inside it on a clean hit, a hair outside it on a
     graze. How far outside, measured in PIXELS and not in world units, IS
     the pixel's coverage: one box filter, evaluated in about a dozen
     operations, which is the only antialias available to a scene that
     cannot afford to trace the frame twice. */
  float tm = max(0.5 * (tN + tX), 1e-4);
  vec3  eb = abs(po + pd * tm) - HALF;
  float sd = length(max(eb, 0.0)) + min(max(eb.x, max(eb.y, eb.z)), 0.0);
  cv = clamp(0.5 - sd / max(tm * pxa, 1e-5), 0.0, 1.0);
  if (cv <= 0.0) return -1.0;
  // A graze has no entry point to speak of, so it is shaded at the place it
  // came nearest — sub-pixel off the face, which is nothing at all.
  float t = tN > tX ? tm : (tN > 0.0 ? tN : tX);
  nl  = -sign(pd) * step(ta.yzx, ta.xyz) * step(ta.zxy, ta.xyz);
  loc = po + pd * t;
  nw  = vec3(cs.x * nl.x - cs.y * nl.z, nl.y, cs.y * nl.x + cs.x * nl.z);
  return t;
}

/* Run the exact test on ONE candidate — an index into the table, or a
   negative number for "there wasn't one" — and keep it if it is the
   nearest thing the ray has met so far. */
void tryExact(vec3 ro, vec3 rd, float idx, float pxa,
              inout float best, inout float pick, inout float cov, inout float byw, inout float blid,
              inout vec3 bn, inout vec3 bl, inout vec3 bq){
  if (idx < 0.0) return;
  int i = int(idx);
  vec4 s = SPARES[i];
  vec2 p = sparePos(i);
  vec3 n, nl, q;
  float cv;
  float t = boxHit(ro, rd, vec3(p.x, 0.5, p.y), s.z, pxa, n, nl, q, cv);
  if (t > 0.0 && t < best){
    best = t; pick = 2.0; cov = cv; byw = s.z; blid = s.w; bn = n; bl = nl; bq = q;
  }
}

/* The letters, in the face's own coordinates, where the face runs from
   -0.5 to 0.5. Only ever evaluated at a fragment that already hit
   something, three times, for the groove and its two walls — so they
   can afford to be letters rather than marks. */
float letterSDF(vec2 p, float id){
  // A fifth bigger than it was, and every proportion scaled together so
  // the ratios the B and the D are built out of are untouched. The flat
  // of a face runs to 0.425 before the arris starts rounding; the tallest
  // of these reaches 0.310, so there is room and a letter on a toy is
  // never shy.
  float H = 0.260, W = 0.181, S = 0.050;
  float d;
  if (id < 0.5) {                                   // A
    d = min(seg2(p, vec2(-W, -H), vec2(0.0, H)), seg2(p, vec2(W, -H), vec2(0.0, H)));
    d = min(d, seg2(p, vec2(-W * 0.56, -H * 0.10), vec2(W * 0.56, -H * 0.10)));
    d -= S;
  } else if (id < 1.5) {                            // B
    d = seg2(p, vec2(-W, -H), vec2(-W, H)) - S;
    vec2 q1 = p - vec2(-W, H * 0.50);
    float r1 = abs(length(q1 * vec2(0.88, 1.0)) - H * 0.50) - S;
    d = min(d, max(r1, -q1.x));
    vec2 q2 = p - vec2(-W, -H * 0.50);
    float r2 = abs(length(q2 * vec2(0.80, 1.0)) - H * 0.50) - S;
    d = min(d, max(r2, -q2.x));
  } else if (id < 2.5) {                            // C
    float r = abs(length(p * vec2(1.0, 0.86)) - H * 0.80) - S;
    d = max(r, -max(H * 0.20 - p.x, abs(p.y) - H * 0.46));
  } else if (id < 3.5) {                            // D
    d = seg2(p, vec2(-W, -H), vec2(-W, H)) - S;
    vec2 q = (p - vec2(-W, 0.0)) * vec2(H / (1.92 * W), 1.0);
    float r = abs(length(q) - H) - S;
    d = min(d, max(r, -q.x));
  } else if (id < 4.5) {                            // E
    d = seg2(p, vec2(-W, -H), vec2(-W, H));
    d = min(d, seg2(p, vec2(-W,  H), vec2(W * 0.88,  H)));
    d = min(d, seg2(p, vec2(-W, 0.0), vec2(W * 0.60, 0.0)));
    d = min(d, seg2(p, vec2(-W, -H), vec2(W * 0.88, -H)));
    d -= S;
  } else {                                          // F
    d = seg2(p, vec2(-W, -H), vec2(-W, H));
    d = min(d, seg2(p, vec2(-W,  H), vec2(W * 0.88,  H)));
    d = min(d, seg2(p, vec2(-W, 0.04), vec2(W * 0.60, 0.04)));
    d -= S;
  }
  return d;
}

/* ---- one painted block, lit ----
   loc/nl/ll are the point, the normal and the light in the BLOCK's own
   frame, which is what makes the grain, the chips and the letter sit on
   the face and turn with it.

   The albedo is built first and completely — pigment, grain, worn
   arris, chip, cut letter — and only then lit. Building it the other
   way round is how the last set of these scenes lost every mark it had
   painted: a light ramp that runs from dark to near-white lifts an
   inked groove to the same tone as the surface round it and erases it. */
vec3 shadeBlock(vec3 n, vec3 rd, vec3 loc, vec3 nl, vec3 ll, float lid, float ao, vec3 lw){
  float seed = lid * 1.7 + 0.31;

  // --- the timber ---
  float gr   = grainAt(loc, nl, seed);
  vec3  wood = mix(BEECH, GRAIN, gr * 0.72);

  // --- the paint on it ---
  vec3 pigment = paintOf(lid);
  vec3 base = pigment;
  // Paint sinks into the figure and dries a shade deeper there. This is
  // the whole reason a flat face is not a flat tone — and it is kept
  // faint on purpose: at full strength the block stopped being painted
  // wood and became corrugated card.
  base = mix(base, base * 0.74, gr * 0.22);

  /* Worn and chipped along the arrises. A point on an arris has TWO of
     its three local coordinates out at the face, a point on a face has
     one, and a corner has three — so the MIDDLE of the three is the
     edge test, and it costs three compares. */
  vec3  ex = max(abs(loc) - (HALF - BR - 0.010), 0.0);
  float m0 = max(ex.x, max(ex.y, ex.z));
  float m2 = min(ex.x, min(ex.y, ex.z));
  float m1 = ex.x + ex.y + ex.z - m0 - m2;
  float edge = smoothstep(0.006, 0.034, m1);
  // Hashed off the block's own coordinates, so a chip stays put on the
  // block while the block turns, and quantised so its edge is hard —
  // paint does not fade off, it comes off. Coarse and sparse: a chip on
  // every cell of every arris is not a worn block, it is a dotted line.
  float ck   = hash31(dot(floor(loc * 8.0), vec3(1.0, 37.3, 91.7)) + seed * 23.0).x;
  float chip = edge * smoothstep(0.700, 0.775, ck);
  base = mix(base, mix(base, wood, 0.55), edge * 0.30);   // rubbed thin
  base = mix(base, wood, chip);                           // and off altogether

  // --- the letter, cut into the face ---
  // The top and the bottom carry none: on a real set only the four
  // sides of the batten are printed.
  vec2  fp = vec2(0.0), fl = vec2(0.0);
  float has = 0.0;
  float ax = abs(nl.x), ay = abs(nl.y), az = abs(nl.z);
  if (ax >= ay && ax >= az) {
    fp = vec2(-sign(nl.x) * loc.z, loc.y);
    fl = vec2(-sign(nl.x) * ll.z,  ll.y);
    has = 1.0;
  } else if (az >= ay) {
    fp = vec2(sign(nl.z) * loc.x, loc.y);
    fl = vec2(sign(nl.z) * ll.x,  ll.y);
    has = 1.0;
  }

  float lip = 0.0, cut = 0.0;
  if (has > 0.5) {
    float L  = letterSDF(fp, lid);
    float Lx = letterSDF(fp + vec2(0.011, 0.0), lid);
    float Ly = letterSDF(fp + vec2(0.0, 0.011), lid);
    /* The gradient of the letter's own field IS the direction the wall
       of the groove faces. Dotted into the light, that is a debossed
       letter: a lit lip on one side of every stroke and a shaded one on
       the other, which is the whole reason it reads as cut and not
       printed.

       The two extra evaluations are only needed within a stroke's width
       of a stroke, and skipping them elsewhere behind an abs(L) test
       was tried and REVERTED: it made the scene twenty per cent slower,
       because the only rasterizer these are measured on flattens the
       branch, pays for both sides and adds the select on top. A branch
       that saves work on hardware nobody has measured and costs it on
       the one everybody has is not an optimisation. */
    vec2  g  = (vec2(Lx, Ly) - L) / 0.011;
    float w  = L / 0.026;
    float wall = exp(-w * w);
    vec2  fld = fl / max(length(fl), 1e-3);
    lip = clamp(dot(g, fld) * wall, -1.0, 1.0);
    cut = smoothstep(0.007, -0.009, L);
    /* THE INK IN THE CUT, and this is the thing that was wrong.

       The groove used to be left as bare timber, which on a yellow block
       is a muddy tan-brown on chrome yellow — the one pairing on the
       whole colour wheel that cannot be read. A painted alphabet block
       has never done that. The letter is cut and the cut is FILLED, with
       exactly two enamels and no third: white where the ground is dark,
       black where the ground is light. Which one it is is not a taste,
       it is the luminance of the pigment underneath — vermilion 0.28,
       cobalt 0.30 and leaf 0.43 all take white; chrome yellow at 0.69
       takes black, which is the pairing a nursery block has used since
       there were nursery blocks. */
    float ground = dot(pigment, vec3(0.2126, 0.7152, 0.0722));
    vec3  ink = ground > 0.5 ? vec3(0.055, 0.052, 0.048) : vec3(0.957, 0.953, 0.939);
    base = mix(base, ink, cut);
  }

  /* ---- light ----
     One warm window off to the left, and the room itself as the fill.
     The fill is the SITE's colour, which is the whole trick: a red
     block's shaded side goes violet here because the room it is
     standing in is violet, so four primaries can sit on this page
     without looking cut out and pasted onto it. */
  vec3 Lkey = vec3(1.000, 0.966, 0.906);                  // daylight through glass
  vec3 Lsky = mix(uColors[2], uColors[1], 0.40);          // the room, bouncing
  vec3 Lbnc = mix(uColors[3], uColors[1], 0.55);          // and the pale floor

  float key = max(dot(n, lw), 0.0);
  key = key * (0.55 + 0.45 * key);                        // a shoulder; paint is not flat
  float sky = 0.30 + 0.70 * (0.5 + 0.5 * n.y);
  float bnc = max(-n.y, 0.0);

  // The room's share is up from 0.50 to 0.58. A face turned away from the
  // window is meant to be dark; it is not meant to lose which of the four
  // pigments it is painted with, and at 0.50 the unlit side of the chrome
  // yellow read as olive and the unlit side of the vermilion as brown.
  vec3 lit = base * (Lkey * (key * 0.92 * mix(0.55, 1.0, ao))
                   + Lsky * (sky * 0.58 * ao)
                   + Lbnc * (bnc * 0.20 * ao));

  // A toy block is varnished, so there is a sheen — broken where the
  // grain is open, because that is where the varnish sank in. Every
  // tier gets it: it is one pow on a clamped base and the tier is not
  // allowed to take the subject away.
  vec3  hv = lw - rd;
  hv /= max(length(hv), 1e-4);
  // Five squarings rather than a pow. Cheaper, and it cannot be handed
  // a negative base by accident the way a pow can.
  float sp = clamp(dot(n, hv), 0.0, 1.0);
  sp *= sp; sp *= sp; sp *= sp; sp *= sp; sp *= sp;        // the thirty-second
  lit += Lkey * (sp * 0.30 * ao * (1.0 - 0.55 * gr));

  // The cut: one wall of every stroke catches the window and the other
  // does not, and the floor of it sits a little out of the light. Only a
  // little — a groove darkened by a quarter turns a white enamel grey and
  // a black one into a hole, and the point of repainting these was that
  // they can be read.
  lit *= 1.0 + lip * 0.45;
  lit *= mix(1.0, 0.90, cut);

  // And an edge off the room, so a block never dissolves into the wall
  // behind it.
  float fre = clamp(1.0 + dot(n, rd), 0.0, 1.0);
  lit = mix(lit, mix(uColors[2], uColors[3], 0.5), fre * fre * fre * 0.20 * ao);
  return lit;
}

void main(){
  vec2  sp   = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float asp  = uRes.x / uRes.y;
  float wide = smoothstep(0.95, 2.05, asp);
  float e    = smoothstep(0.0, 1.0, uEnter);

  /* ---------------- the clock ----------------
     Five blocks are put on and five are taken off, and the state at the
     end of the loop is the state at the start of it: one block down,
     one on its way in. No seam and no restart. */
  float tb = mod(uTime, LOOP);
  float BUILD = 5.0 * PLACE;
  float fitTop, u = 0.0, tgtI = -1.0, mode = 0.0;

  // The shiver a landing sends up the tower, damped, and carried across
  // into the next placement rather than cut off at the end of this one.
  float ll = floor(tb / PLACE) * PLACE + 0.88 * PLACE;
  if (ll > tb) ll -= PLACE;
  float since = max(tb - ll, 0.0);
  gWob = 0.034 * exp(-since * 5.5) * sin(since * 19.0)
       * (1.0 - smoothstep(BUILD - 0.2, BUILD + 1.2, tb))
       * smoothstep(0.0, 0.5, tb);

  if (tb < BUILD) {
    float k = floor(tb / PLACE) + 1.0;
    u = fract(tb / PLACE);
    gN = k; tgtI = k; mode = 1.0;
    // The camera has already started backing off while the block is
    // still on its way up, so it is never chasing the tower.
    fitTop = k + 0.45 + smoothstep(0.02, 0.50, u);
  } else if (tb < BUILD + HOLD) {
    gN = NB;
    fitTop = NB + 0.45;
  } else {
    float tc = tb - BUILD - HOLD;
    float m = min(floor(tc / REM), 4.0);
    u = clamp(tc / REM - m, 0.0, 1.0);
    float j = NB - 1.0 - m;
    gN = j; tgtI = j; mode = 2.0;
    fitTop = j + 0.45 + (1.0 - smoothstep(0.18, 0.82, u));
  }

  /* ---------------- the camera, solved ----------------
     The band's usable window is not the band. The harness washes
     everything below 0.17 of the height to paper for the kicker, and
     the site's own header floats over the top of it, so what this
     picture actually has is 0.270 to 0.885 — five eighths of the
     height, off centre. Both numbers are measured off the rendered
     page rather than guessed. A tenth of the window is then kept back,
     because a perspective divide puts the near foot of a tall thing
     lower than a linear estimate of it does. Hold the tower in exactly
     that, at every aspect, and the fit is a division rather than a
     number somebody liked on one screenshot. */
  // More floor under it the taller it gets, so the pull-back is spent on
  // the room rather than on headroom nobody wanted.
  float fitBot = -(0.26 + 0.09 * (fitTop - 1.45));
  float grow  = clamp((fitTop - 1.45) / 5.0, 0.0, 1.0);
  /* AND A FLOOR UNDER THE WHOLE FIT, which is the fix for the one real
     compositional fault the first cut had. Fitted honestly, a single
     block fills nearly six tenths of the window and the camera ends up
     two and a half units from it: the toys lying about are then a foot
     across and cropped by both edges of the band, and a picture that is
     a calm room for thirteen seconds is a pile-up for two. A floor on
     the half-height holds the camera off until there is enough tower to
     be worth coming in for, and because it is a max() on a quantity
     that only ever grows, the dolly never reverses — the first version
     of this correction rode on the placement's own easing and pulled
     the camera IN by eight per cent in the middle of the first block,
     which is a wrong-way dolly and the eye catches it. */
  float hH    = max(0.5 * (fitTop - fitBot), 1.645);
  vec3  tgt   = vec3(LEANX * 0.30, 0.5 * (fitTop + fitBot), LEANZ * 0.30);
  // A longer lens on the long band: the vertical field is fixed by the
  // window above, so a short one would have thrown a 42-degree half
  // field sideways and stretched the floor at the margins.
  float FOC   = mix(0.98, 1.34, wide);
  float WIN   = 0.3075 * 0.90;   // and a tenth of it kept back as margin
  float dist  = FOC * hH / WIN * mix(1.16, 1.0, e);
  // Looking down on it when it is one block, level with it when it is
  // six: the camera stands up as the tower does.
  float el    = mix(0.31, 0.125, grow);
  // The sway is locked to the LOOP rather than to uTime, so the band is
  // periodic in the full sense: same phase, same camera, no drift over
  // the twenty minutes a page might sit open.
  float az    = 0.52 + 0.085 * sin(6.2831853 * tb / LOOP) + (uPointer.x - 0.5) * 0.40;
  vec3  ro    = tgt + dist * vec3(sin(az) * cos(el), sin(el), cos(az) * cos(el));
  vec3  fwd   = normalize(tgt - ro);
  vec3  rgt   = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
  vec3  upv   = cross(rgt, fwd);
  float shX   = mix(0.0, 0.18, wide);   // the tower sits left of centre on a long band
  vec2  scr   = vec2(sp.x + shX, sp.y - 0.0775);
  vec3  rd    = normalize(scr.x * rgt + scr.y * upv + FOC * fwd);
  /* ONE PIXEL, IN WORLD UNITS, ONE UNIT OUT. Everything in this scene that
     has an edge is resolved against it: where the march decides it has
     arrived, and how much of a pixel a silhouette fills. Writing both in
     pixels rather than in world units is what makes the answer the same on
     a phone drawing three hundred rows and a desktop drawing twelve
     hundred, and it is the reason the block edges are no longer a
     staircase. (The ray fan is normalized, so the angle a pixel subtends is
     one row divided by the distance from the eye to the film — which is
     exactly the length of the unnormalized ray.) */
  float pxa   = 1.0 / (uRes.y * max(length(vec3(scr, FOC)), 1e-4));

  /* The window, and how high it is matters more than it looks. At the old
     elevation of 41 degrees a six-block tower threw a shadow seven units
     long — a violet slab running most of the way across a 21:9 floor with
     nothing standing on it. Lifted to 49, the same tower throws five and
     a bit, and the taper further down does the rest. */
  vec3 lw = normalize(vec3(-0.42, 0.86, 0.62));

  /* How much of the toy box this band gets, and it goes DOWN as the band
     goes up: four up to 16:10, three on a 21:9, against the twelve a
     desktop used to be handed. One number, read by the ray test and by
     the floor's shadows both, so a band can never draw a shadow for a
     block it is not drawing. And the few that are left stand further
     apart the wider the room, rather than huddling round the foot of the
     tower while the corners go empty. */
  gSpares = asp > 1.90 ? 3 : 4;
  gSpread = mix(1.0, 2.00, wide);

  /* ---------------- the block in the air ----------------
     It comes in from a point derived from the camera — just outside
     whichever edge this band has — so it is off frame on a 4:5 and off
     frame on a 21:9 without either being guessed at, and so the block
     that leaves at the end of the loop leaves through the same door the
     next one comes in by, AT THE SAME ATTITUDE. The first cut of this
     had the removal unwinding the other way, which meant the very last
     frame of the loop and the very first frame of it differed by
     sixty-seven degrees of yaw: a pop, once every fifteen seconds,
     invisible in any single screenshot and obvious on the page. */
  float exOff = dist * (asp * 0.5 - shX) / FOC * 1.30 + 0.85;
  vec3  ENT   = vec3(tgt.x - rgt.x * exOff, 0.60, tgt.z - rgt.z * exOff);
  gFlyOn = 0.0; gFlyP = vec3(0.0, -9.0, 0.0); gFlyR = mat3(1.0);

  if (mode > 0.5) {
    vec4  tx  = blkXf(tgtI);
    vec3  tp  = tx.xyz;
    float ty  = atan(tx.w);
    vec3  pos; float yaw, pit, rol;
    if (mode < 1.5) {
      // Up, over, a beat to aim, and down. The rise leads the descent
      // by a clear third of a second, which is the hesitation, and the
      // descent eases out so it is SET DOWN rather than dropped.
      float ey = smoothstep(0.06, 0.55, u);
      float dy = smoothstep(0.68, 0.94, u);
      float ex = smoothstep(0.02, 0.62, u);
      pos.xz = mix(ENT.xz, tp.xz, ex);
      float hz = (u - 0.63) / 0.11;
      pos.xz += vec2(rgt.x, rgt.z) * 0.050 * exp(-hz * hz) * sin(u * 46.0);
      pos.y = mix(ENT.y, tp.y + 0.30, ey);
      pos.y = mix(pos.y, tp.y, dy);
      float sn = max(u - 0.94, 0.0) * PLACE;
      pos.y += 0.026 * exp(-sn * 9.0) * sin(sn * 26.0);
      yaw = ty + 0.62 * (1.0 - smoothstep(0.10, 0.88, u));
      pit = 0.26 * (1.0 - smoothstep(0.05, 0.82, u));
      rol = -0.20 * (1.0 - smoothstep(0.05, 0.86, u));
    } else {
      // And away again: lifted clear first, then carried out. Up and
      // out, never sideways and down — this tower does not fall. The
      // attitude it leaves on is exactly the attitude the next one
      // arrives on, which is what closes the loop.
      float ry = smoothstep(0.00, 0.38, u);
      float rx = smoothstep(0.22, 1.00, u);
      float rt = smoothstep(0.12, 1.00, u);
      pos.y  = mix(tp.y, tp.y + 0.34, ry);
      pos.xz = mix(tp.xz, ENT.xz, rx);
      pos.y  = mix(pos.y, ENT.y, smoothstep(0.35, 1.00, u));
      yaw =  ty + 0.62 * rt;
      pit =  0.26 * rt;
      rol = -0.20 * rt;
    }
    gFlyP = pos;
    gFlyR = transpose(rotMat(vec3(yaw, pit, rol)));
    gFlyOn = 1.0;
  }

  /* ---------------- one march, bounded before it starts ---------------- */
  float tF   = rd.y < -1e-4 ? -ro.y / rd.y : 1e9;
  float FARP = dist * 5.0;
  vec2  A = cylSlab(ro, rd, 1.45, -0.10, gN + 0.24);
  vec2  B = vec2(1.0, -1.0);
  if (gFlyOn > 0.5) B = sphSlab(ro, rd, gFlyP, 1.06);
  float t0 = 1e9, t1 = -1e9;
  if (A.x <= A.y){ t0 = min(t0, A.x); t1 = max(t1, A.y); }
  if (B.x <= B.y){ t0 = min(t0, B.x); t1 = max(t1, B.y); }

  float tHit = 1e9;
  float cov  = 0.0;     // how much of this pixel the tower actually fills
  if (t1 > t0 && t0 < min(tF, FARP)) {
    float lim = min(t1, min(tF, FARP));
    float t = max(t0, 0.0);
    /* THE MARCH KEEPS ITS CLOSEST APPROACH, and that one extra compare is
       what fixes two faults at once.

       A march that answers yes or no writes a hard silhouette, and a hard
       silhouette on a buffer drawn at a fraction of the screen's pixels is
       the staircase that was round every block. Worse, a grazing ray is
       exactly the ray that needs the most steps, so the step budget ran
       out precisely along the edge and punched holes in it — which is why
       the stepping was ragged rather than merely square.

       So the smallest gap the ray ever saw is kept, and turned into
       PIXELS once at the end: under a quarter of a pixel is the surface, a
       pixel and a bit away is the background, and in between is the
       fraction of the pixel the block covers. A ray that runs out of steps
       half a pixel short now lands in that ramp instead of falling
       through to the floor.

       The comparison inside the loop stays in WORLD units and the divide
       stays outside it — one per fragment rather than one per step, which
       on the software rasterizer these are measured on is the difference
       between paying for the antialias and not. It is the same answer:
       the smallest gap and the smallest gap-in-pixels are found at the
       same step, because a march only slows down where it is closing on
       something and t is all but constant across the steps that matter. */
    float minD = 1e9;
    float hitD = 0.25 * pxa;          // a quarter of a pixel, as a slope in t
    // Three tiers. A tablet has a desktop's pixel count and a phone's
    // power budget, so it is neither of the other two and does not get
    // handed either one's number.
    int steps = uTier > 0.75 ? 48 : uTier > 0.25 ? 36 : 24;
    for (int i = 0; i < 48; i++){
      if (i >= steps) break;
      if (t > lim) break;
      float d = map(ro + rd * t);
      if (d < minD){ minD = d; tHit = t; }
      if (d < hitD * t) break;
      t += d * 0.90;
    }
    cov = smoothstep(1.05, 0.25, minD / max(tHit * pxa, 1e-5));
    if (cov <= 0.0) tHit = 1e9;
  }

  /* ---------------- the blocks left on the floor ---------------- */
  float best = FARP;
  float pick = -1.0;                                        // nothing: the backdrop
  if (tF   > 0.0 && tF   < best){ best = tF;   pick = 0.0; }
  if (tHit > 0.0 && tHit < best){ best = tHit; pick = 1.0; }
  vec3  bn = vec3(0.0, 1.0, 0.0), bl = bn, bq = vec3(0.0);
  float byw = 0.0, blid = 0.0;
  /* Nothing on the floor is reachable by a ray going up and away from a
     camera that is already above all of it, which is most of the band.

     Then TWO PASSES, and the split is the whole cost of this scene. A
     sphere round each block refuses a ray in about fifteen operations;
     the exact box costs forty and three divisions. Running the exact
     test inside each refusal — the obvious way, and the way this was
     first written — costs twelve box tests per fragment on anything
     that flattens a branch, which is nearly half the frame. So the
     first pass only SORTS: it keeps the three blocks whose bounding
     spheres the ray enters soonest, and the second pass runs the exact
     test on those three and nothing else.

     Three, and not one, because a bounding sphere is entered by rays that
     then miss the box — grazing ones, round the silhouette. Keeping only
     the first candidate would let a block's bounding sphere bite a
     crescent out of whatever is behind it. The spheres never overlap —
     the closest two spares are 4.35 apart against a pair of 1.10 radii —
     so three deep is past any case this scene can produce.

     AND THE SPHERE IS WIDER THAN THE BLOCK IT HOLDS BY A CLEAR MARGIN,
     which it now has to be. At a half-diagonal of 0.866 the old bound of
     0.883 cleared the block by 0.017 of a unit, which at these distances
     is a fifth of a pixel — so the refusal was landing inside the very
     pixel the silhouette is antialiased across, and clipping the edge it
     was let through to find. 1.10 clears it by two and a half pixels at
     the smallest buffer and the furthest camera this band ever has, and
     by twenty on a desktop. It costs nothing measurable: the exact test
     runs on three candidates either way, and the extra rays are ones it
     answers with a zero coverage. */
  if (rd.y < 0.0 || ro.y < 1.2) {
    vec2 c0 = vec2(1e9, -1.0), c1 = c0, c2 = c0;
    for (int i = 0; i < 4; i++){
      if (i >= gSpares) break;
      vec2 s = sparePos(i);
      vec3 o = ro - vec3(s.x, 0.5, s.y);
      float b = dot(o, rd);
      // 1.21 is the radius SQUARED, so the sphere is 1.10.
      float disc = b * b - dot(o, o) + 1.21;
      if (b > 0.0 || disc < 0.0) continue;
      float tt = -b - sqrt(disc);
      if      (tt < c0.x){ c2 = c1; c1 = c0; c0 = vec2(tt, float(i)); }
      else if (tt < c1.x){ c2 = c1; c1 = vec2(tt, float(i)); }
      else if (tt < c2.x){ c2 = vec2(tt, float(i)); }
    }
    tryExact(ro, rd, c0.y, pxa, best, pick, cov, byw, blid, bn, bl, bq);
    tryExact(ro, rd, c1.y, pxa, best, pick, cov, byw, blid, bn, bl, bq);
    tryExact(ro, rd, c2.y, pxa, best, pick, cov, byw, blid, bn, bl, bq);
  }

  /* ---------------- the room ---------------- */
  vec3 haze = mix(uColors[2], uColors[1], 0.42);
  vec3 col  = mix(haze, uColors[3], smoothstep(-0.06, 0.46, rd.y));
  // The window the key comes from, thrown as a wash on the far wall
  // rather than drawn: the top of the band is a room, not a void, and
  // the light in the frame and the light on the blocks are one light.
  float wv = clamp(dot(rd, lw), 0.0, 1.0);
  col = mix(col, uColors[3], wv * wv * 0.34);
  vec3 hn = vec3(0.0, 1.0, 0.0), hloc = vec3(0.0), hnl = hn, hll = hn;
  float hlid = 0.0, hao = 1.0, solid = 0.0;

  /* THE FLOOR PAINTS FIRST AND ALWAYS, and a block is composited over it
     rather than instead of it. That is not a tidy-up: a silhouette can
     only have a soft edge if there is something underneath it to be soft
     against, and the whole of the antialias above is spent for nothing if
     the winner of a depth test simply overwrites the frame. It costs a
     floor evaluation on the fragments a block is standing in front of,
     which is a few per cent of the band and a rounding error against a
     march. */
  if (tF > 0.0 && tF < FARP) {
    /* ---- the floor ----
       A pale nursery floor, and nothing drawn on it.

       It used to carry a play mat: one soft-edged violet ellipse eight
       units across. At 4:5 you never saw the whole of it and it passed.
       At 21:9 it was the largest object in the picture, it was the same
       colour as everything else that is dark here, and it had no edge a
       mat has — so it did not read as a mat. It read as a shadow with
       nothing standing in it, which is precisely what came back. What
       gives this floor its shape now is LIGHT and the marks the blocks
       keep off it, both of which have something above them. */
    vec3 fp = ro + rd * tF;
    vec3 fc = mix(uColors[3], uColors[2], 0.62);
    // one broad pool of window light, off to one side
    vec2 wp = fp.xz - vec2(-1.6, 2.2);
    fc = mix(fc, uColors[3], exp(-dot(wp, wp) * 0.035) * 0.55);

    /* The cast shadow, analytic. The tower's is a capsule from its own
       footprint out to the place the top block throws to, with the
       radius and the softness both growing along it — which is what a
       window does to a shadow and what sixteen more march steps would
       not have done as well.

       AND IT FADES ALONG ITS LENGTH, which the first cut did not do. A
       window is an area light: the foot of a tower is a hard dark line
       and the far end of what it throws is barely there. Held at one
       strength from end to end, a six-block tower's shadow is a six-unit
       slab lying on the floor — the second thing in this band that was
       being read as a shadow belonging to nothing. */
    vec2 sTop = vec2(LEANX, LEANZ) - lw.xz / lw.y * (gN - 0.1);
    vec2 pa = fp.xz - vec2(0.0), ba = sTop - vec2(0.0);
    float hh = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
    float dd = length(pa - ba * hh);
    float rad  = mix(0.52, 0.82, hh);
    float blur = mix(0.07, 0.52, hh);
    float sh = smoothstep(rad + blur, rad - blur * 0.5, dd) * mix(1.0, 0.26, hh);
    /* The block in the air throws its own, and it GOES as the block
       climbs. Held at strength it was the third orphan in this band: at
       the top of the tower the projection along the light lands six
       units away from anything, two units across, and a soft grey disc
       sitting by itself on a floor is a fault however honest the
       arithmetic behind it. It is honest to lose it, too — a shadow
       thrown six units under a window is almost entirely penumbra. What
       is left is the part that was worth having, which is the mark
       closing hard under the block in the last few inches before it is
       set down. */
    if (gFlyOn > 0.5) {
      vec2 fz = gFlyP.xz - lw.xz / lw.y * gFlyP.y;
      float fb = 0.10 + 0.20 * gFlyP.y;
      sh = max(sh, smoothstep(0.55 + fb, 0.55 - fb * 0.5, length(fp.xz - fz))
                 * (1.0 - 0.86 * smoothstep(0.35, 2.40, gFlyP.y)));
    }
    /* And the loose ones, which get ONE mark each, and it is UNDER the
       block. This is the fault that was being reported and it deserves
       naming plainly: every spare used to carry TWO discs — a cast blot
       thrown half a unit along the light, and a separate contact halo —
       and the pair of them read as two grey smudges lying near a block
       rather than as one shadow belonging to it. Two shadows is one light
       too many, and the offset one was far enough out to be touching
       nothing at all.

       So the mark is the block's OWN FOOTPRINT: a rounded square, turned
       with the block, sitting under it — which is what a cube resting
       flat on a floor actually keeps off that floor.

       AND IT IS ANCHORED THERE, which is the correction this line exists
       for now and the last thing wrong with this band. The footprint was
       TRANSLATED a sixth of a unit along the light before it was drawn —
       the whole square, core and penumbra together — on the reasoning
       that a sixth against a half-unit half-width still leaves it under
       the block. It does not. A translated square is not under the block
       any more than a translated disc was: it laps a sixth of a unit out
       on the far side and takes a sixth of a unit of daylight in along
       the near edge, and on this camera that sixth is nineteen pixels of
       lit floor between a block and its own shadow — measured on the
       green D's lower-left edge, where the floor came back at 195 to 220
       against the 139 the mark reaches everywhere the block is really
       touching. The light HAS an angle, so the throw is still here; what
       the angle is allowed to move is the PENUMBRA and not the contact.

       Two distances now, from the one rotation:

         nc  the footprint where the block actually sits, which is the
             contact — darkest, tightest, and by construction flush with
             the block's own bottom edge the whole way round it, with no
             gap to leave daylight in.
         nf  that same footprint SWEPT along the light, which is the soft
             part. A sweep is the footprint plus everything the throw
             passes over, so it CONTAINS the contact rather than
             replacing it — a translation is what cannot.

       Four rotations and a min of four 2-D rounded-box distances each,
       then TWO smoothsteps for the lot: the core off nc, the penumbra
       off nf. Which is one rounded box more than it was, on floor
       fragments only, and no ray and no step anywhere. */
    vec2  lean = -lw.xz / lw.y * 0.17;
    float nc = 1e9;    // the contact: the footprint, exactly where it sits
    float nf = 1e9;    // the penumbra: that footprint swept along the light
    for (int i = 0; i < 4; i++){
      if (i >= gSpares) break;
      vec2 cs2 = rotc(SPARES[i].z);
      vec2 dq  = fp.xz - sparePos(i);
      dq = vec2(cs2.x * dq.x + cs2.y * dq.y, cs2.x * dq.y - cs2.y * dq.x);
      // the throw, turned into the block's own frame with it, so the
      // sweep runs along the light and not along the block's axes
      vec2 lq  = vec2(cs2.x * lean.x + cs2.y * lean.y, cs2.x * lean.y - cs2.y * lean.x);
      vec2 eq  = abs(dq) - (HALF - 0.05);
      nc = min(nc, length(max(eq, 0.0)) + min(max(eq.x, eq.y), 0.0) - 0.05);
      // half the throw off centre, half the throw added to the extent:
      // the box grown to cover every place the footprint passes through,
      // which starts AT the footprint and never leaves it behind.
      vec2 sq  = abs(dq - lq * 0.5) - (HALF - 0.05 + abs(lq) * 0.5);
      nf = min(nf, length(max(sq, 0.0)) + min(max(sq.x, sq.y), 0.0) - 0.05);
    }
    sh = max(sh, smoothstep(0.46, 0.02, nf) * 0.54 + smoothstep(0.11, -0.02, nc) * 0.36);

    /* A SHADOW IS THE LIGHT THAT IS MISSING, AND IT IS THAT LIGHT'S
       COLOUR. Which is the second half of the same report: these marks
       were a flat grey multiply, and a flat grey is what a shadow looks
       like in a room with no light in it.

       There are two lights here. The key is the window — warm, near
       white. The fill is the room itself, which in this room is a
       violet-grey. Where the key cannot reach, the fill is all that is
       left, so the floor there is not the floor with the colour taken
       out of it; it is the floor seen by violet light. The multiply
       below is that fill's own hue, normalised so it darkens rather than
       tints toward a pigment, and pushed a third past itself so a
       twentieth of a hue survives a value this low. It is still a
       MULTIPLY and never a mix toward #551a89 — light taken away cannot
       be more saturated than the light that was there, and the cut that
       tried it made the contact shadow the most colourful thing in the
       frame. */
    vec3 room   = mix(uColors[2], uColors[1], 0.55);
    vec3 shTint = room / max(max(room.r, max(room.g, room.b)), 1e-4);
    shTint = mix(vec3(1.0), shTint, 1.35);
    fc *= mix(vec3(1.0), shTint * 0.60, sh);
    // the contact under the tower itself, which is the line that makes
    // it stand on the floor rather than hover over it — and, just
    // outside it, a little of the bottom block's own paint bounced back
    // up off a pale floor, which is the one place the object is allowed
    // to colour the room.
    float ct = smoothstep(0.78, 0.44, length(fp.xz));
    fc *= mix(vec3(1.0), shTint * 0.46, ct);
    fc = mix(fc, mix(fc, paintOf(0.0), 0.26),
             smoothstep(1.35, 0.60, length(fp.xz)) * (1.0 - ct) * 0.50);

    /* And the haze holds off far longer than it did. At 0.95 of the
       camera's own distance the floor was already going, which is the
       other half of why the far blocks floated: their shadows were being
       washed into the backdrop at full strength while the blocks
       themselves were only half washed. Now nothing on the floor within
       one and a half camera-lengths is touched, which covers every
       spare this band draws. */
    float fg = smoothstep(1.55, 4.60, tF / dist);
    col = mix(fc, haze, fg);
  }

  if (pick > 0.5 && pick < 1.5) {
    /* ---- a block in the tower, or the one in the air ---- */
    vec3 pw = ro + rd * tHit;
    vec3 n  = nrm(pw, max(0.0014, tHit * 0.0007));

    float i0 = clamp(floor(pw.y), 0.0, gN - 1.0);
    float ia = max(i0 - 1.0, 0.0), ib = min(i0 + 1.0, gN - 1.0);
    float da = blockAt(pw, i0), db = blockAt(pw, ia), dc = blockAt(pw, ib);
    float bi = i0, bd = da;
    if (db < bd){ bd = db; bi = ia; }
    if (dc < bd){ bd = dc; bi = ib; }

    vec3 loc, nl, lloc; float lid;
    float fd = gFlyOn > 0.5 ? rbox(gFlyR * (pw - gFlyP), HALF, BR) : 1e9;
    if (fd < bd) {
      loc = gFlyR * (pw - gFlyP); nl = gFlyR * n; lloc = gFlyR * lw; lid = tgtI;
    } else {
      vec4 x = blkXf(bi);
      vec2 cs = rotc(x.w);
      vec3 q = pw - x.xyz;
      loc  = vec3(cs.x * q.x  + cs.y * q.z,  q.y,  cs.x * q.z  - cs.y * q.x);
      nl   = vec3(cs.x * n.x  + cs.y * n.z,  n.y,  cs.x * n.z  - cs.y * n.x);
      lloc = vec3(cs.x * lw.x + cs.y * lw.z, lw.y, cs.x * lw.z - cs.y * lw.x);
      lid  = bi;
    }

    // Occlusion off the field itself: how much room there is above the
    // surface. It is what puts the dark line in the joint between two
    // blocks and under the one that has just been set down.
    float ao = clamp(map(pw + n * 0.11) / 0.11, 0.0, 1.0);
    if (uTier > 0.75) ao = 0.5 * ao + 0.5 * clamp(map(pw + n * 0.30) / 0.30, 0.0, 1.0);
    ao = mix(0.30, 1.0, ao);

    hn = n; hloc = loc; hnl = nl; hll = lloc; hlid = lid; hao = ao; solid = 1.0;
  } else if (pick > 1.5) {
    /* ---- a block on the floor ---- */
    vec2 cs = rotc(byw);
    vec3 lloc = vec3(cs.x * lw.x + cs.y * lw.z, lw.y, cs.x * lw.z - cs.y * lw.x);
    /* No field to take occlusion from out here, so the floor gives them
       theirs: dark where they meet it, open above. The floor of it is
       0.72 rather than 0.60, because a block lying alone in the middle
       of a room has almost nothing over it — and at 0.60 the one whose
       lit face was turned away came out a dark olive that nobody would
       call chrome yellow, which is the same complaint as the letters in
       a quieter voice. */
    hn = bn; hloc = bq; hnl = bl; hll = lloc; hlid = blid; solid = 1.0;
    hao = mix(0.72, 1.0, clamp(bq.y + 0.5, 0.0, 1.0));
  }

  // Both kinds of block are lit by the same one call. It carries the
  // grain, the chips, three evaluations of a letter and a specular
  // inside it, and a rasterizer that flattens branches would otherwise
  // have paid for it twice for every fragment in the band, including
  // the empty sky.
  if (solid > 0.5) {
    vec3 bc = shadeBlock(hn, rd, hloc, hnl, hll, hlid, hao, lw);
    // The same two numbers the floor fades on, so a block and the mark it
    // keeps off the floor go into the haze together rather than the block
    // outlasting its own shadow.
    bc = mix(bc, haze, smoothstep(1.55, 4.60, best / dist) * 0.5);
    // AND IT IS COMPOSITED, not substituted. cov is one everywhere but the
    // outermost pixel of a silhouette, where it is the fraction of that
    // pixel the block fills — which is the difference between an edge and
    // a flight of stairs.
    col = mix(col, bc, cov);
  }

  /* A lens, finally. Without it a 21:9 band is an even wash from edge to
     edge with nothing telling the eye where to be, and the far corners
     of the room read as more page rather than as more room. It is the
     site's own violet, and it is deliberately narrower across on a long
     band than on a tall one — the vertical field is fixed, so the long
     band is the one with corners to spare. */
  vec2  vq  = vec2(scr.x * mix(0.95, 0.56, wide), (scr.y + 0.06) * 1.15);
  float vig = 1.0 - exp(-dot(vq, vq) * 0.85);
  col = mix(col, mix(uColors[1], uInk, 0.22), vig * 0.15);

  // The entrance, once: the room comes up out of the paper rather than
  // the picture fading in over it.
  col = mix(uColors[3], col, e);
  // A little tooth, so the long washes never band on a cheap panel —
  // which is the only sort of panel this will be watched on.
  col += (hash2(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) * 0.014;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export const scene: Scene = {
  frag,
  colors: ["#551a89", "#a996c0", "#f4f3f7", "#ffffff"],
  /* The picture a phone with no WebGL is left with, and the one thing a
     stack of gradients can actually draw better than it can draw a
     ceiling: a tower. Four front faces with a hard seam between each,
     one side face down the right and one top face across, all on the
     same background-size and the same background-position so the four
     layers cannot drift apart — which is what happens the moment two
     layers of different sizes are positioned by percentage. Laid out
     for the 4:5 band, because that is the band where a poster is what
     the reader actually gets.

     The blocks carry the shader's own four pigments in the shader's own
     order — vermilion at the foot, then cobalt, chrome yellow and leaf
     green — at roughly the value a front face comes out at under the
     window. The shade down the right is one translucent violet wash
     over all four, so each block darkens in its own hue rather than
     toward a single grey. Everything that is NOT a block — the floor,
     the mat, the shadow, the seams — is an interpolation of the four
     colours above and the house violet. */
  poster:
    // the shaded side of the stack: one violet wash, so every block
    // darkens in its own colour
    "linear-gradient(to right, rgb(58 30 92 / 0) 0 75%, rgb(49 24 78 / 0.50) 75%, rgb(41 19 66 / 0.62) 100%) 47% 42% / 92px 210px no-repeat, " +
    // the top face of the top block, catching the window
    "linear-gradient(to bottom, #93c680 0 5.5%, rgb(255 255 255 / 0) 5.5%) 47% 42% / 92px 210px no-repeat, " +
    // four painted blocks, seamed, green at the top and vermilion at the foot
    "linear-gradient(to bottom, #4c9040 0 23.5%, #3b2059 23.5% 25.5%, " +
    "#d9a021 25.5% 48.5%, #3b2059 48.5% 50.5%, #27578f 50.5% 73.5%, " +
    "#3b2059 73.5% 75.5%, #a93627 75.5% 100%) 47% 42% / 92px 210px no-repeat, " +
    /* What it keeps off the floor, and nothing else down there. The mat
       that used to be under this went with the one in the shader, and for
       the same reason: a soft violet ellipse with no edge is read as a
       shadow, and a shadow under nothing is a fault. What is left is the
       contact — and it is a TINT, a grey-violet at four tenths rather
       than the near-house-violet at a half that was here, because a
       shadow on a pale floor is that floor with less light on it. */
    "radial-gradient(34% 7% at 53% 68.5%, rgb(150 138 170 / 0.44) 0%, rgb(150 138 170 / 0) 100%), " +
    "linear-gradient(to bottom, #ffffff 0%, #f8f6fb 22%, #efebf6 48%, #f6f3fa 64%, #ffffff 86%, #ffffff 100%)",
  alt: "A tower of painted wooden nursery blocks — vermilion, cobalt, chrome yellow and leaf green, chipped back to bare beech along the arrises, each with a letter cut into its face and filled with enamel, white on the dark blocks and black on the yellow — standing a few degrees out of true on a pale floor with two or three spare blocks lying behind it, while another block is carried in through the air to be set on top and the camera draws back as the tower grows.",
};
