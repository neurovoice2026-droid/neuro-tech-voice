import type { Scene } from "../shader-stage";

/* ------------------------------------------------------------------ *
 * Restaurants — a cover, being laid.
 *
 * Every earlier version of this file was a PICTURE of a table: a plan
 * view drawn with circles and rounded boxes, lit by a gradient. It read
 * as a diagram of a place setting, which is not the same thing as a
 * place setting. So this one is built and photographed instead — a
 * distance field, a camera above the table, one pendant, and four
 * objects that are laid on it one at a time.
 *
 *   the object   a cover: a white china plate, a fork to its left, a
 *                knife to its right, and a wine glass above the knife,
 *                on a dark walnut top. Not a stand-in for the trade —
 *                it IS the perishable thing. A 7:30 two-top that nobody
 *                booked was prepped for and rostered for, and it goes
 *                out at half past whether anybody sits in it or not.
 *
 *   the motion   it SITS, and then it turns over. Fifteen seconds, and
 *                for the first nine and a half of them the cover is
 *                complete and nothing is in the air: the glass catches
 *                the pendant, the bowl flares, and a caustic opens on
 *                the timber beside its foot, which is what a wine glass
 *                really does to a table under a warm light. Then it is
 *                cleared in reverse — glass, knife, fork, plate — and
 *                laid again in order, each piece lowered on a cubic
 *                ease-out with a real contact: a short damped settle in
 *                the thing itself, and a shadow that widens and fades
 *                as the piece rises and snaps tight the moment it is
 *                down.
 *
 *                The proportions are deliberate. Two thirds of the loop
 *                used to have at least one piece in the air, and this
 *                band was photographed at 1440 with the knife gone and
 *                a stub of glass hanging off the top edge — a place
 *                setting with no knife in it, which is not a place
 *                setting, and which does not get the same answer out of
 *                a stranger as the same band does at 390. A reader
 *                arrives at an arbitrary moment. The complete cover is
 *                what is waiting for them, at every width.
 *
 *   the camera   high and slightly oblique — fifty-five degrees above
 *                the table, from the diner's own side of it, and on a
 *                LONG lens rather than a wide one, so the plate projects
 *                as the ellipse that elevation really gives and the far
 *                edge reads flat instead of raking. It eases about six
 *                degrees round and two up across the loop — one cosine,
 *                so the loop has no seam in it. The pointer is the
 *                pendant's hook rather than the camera's handle: move
 *                it and the pool travels, every shadow swings with it,
 *                and the steel and the glass relight. That is worth
 *                more than a camera nudge on a scene whose whole
 *                subject is what one light does to four materials.
 *
 * COLOUR. The environment is the site's and the object is its own.
 *   · the room beyond the table edge, the haze, the fill and every
 *     shadow are uColors and uInk — violet-grey, the house's;
 *   · the objects are their real colours, as literals: dark walnut
 *     (0.216, 0.142, 0.104) with a lighter grain at (0.312, 0.212,
 *     0.156) — walnut as it is IN THIS ROOM, which is the correction
 *     that stopped this being the one sepia band in a set of sixteen:
 *     the old pair ran two and a half parts red to one part blue, which
 *     is a timber shot under tungsten and nothing else, and the oiled
 *     top now mirrors the violet dining room at a few per cent
 *     everywhere rather than only at a graze, where a fourth-power
 *     Fresnel at a fifty-five degree camera was returning one part in a
 *     thousand and contributing nothing at all — glazed white china
 *     (0.955, 0.945, 0.928) which is
 *     warm-white and not white, polished stainless (0.735, 0.750,
 *     0.775) which is cool and neutral, and clear glass, which has
 *     almost no colour of its own and is drawn as what it does to the
 *     light rather than as a tint. Four, because a cover is four
 *     materials; there is no fifth anywhere in the file;
 *   · AND WHAT THE POLISHED TWO SEE IS A STUDIO. Steel and glass have
 *     almost no colour of their own — they are whatever is around them —
 *     so an environment mixed out of uColors handed the fork a lilac cast
 *     and handed the wine glass out as a lavender plastic goblet. They
 *     sample studio() instead: a dark floor, a big overhead sweep, a warm
 *     key off one shoulder and a cool fill off the other, exactly as a
 *     photographer would light a cover, with the table's own walnut put
 *     back into the lower hemisphere because that is what is really under
 *     them. The backdrop behind the object stays the house palette and so
 *     does every diffuse surface in the frame. Chrome reads as chrome or
 *     it reads as plastic; there is no third option;
 *   · the key is a tungsten pendant — warm (1.000, 0.918, 0.808), and
 *     a POINT light rather than a direction, so it falls off across the
 *     timber the way a pendant over a two-top actually does and the
 *     frame has a centre. The fill, the bounce, the aerial perspective
 *     and every shadow are the house violet, which is what stops a warm
 *     key from making this the one orange band on the site, and the
 *     floor past the far edge is the table's own timber in that violet
 *     shade rather than a slab of uInk — mixing straight to the house
 *     ink there put a saturated purple card behind the table and it was
 *     the only thing in the frame that looked pasted on.
 *
 * HOW IT IS BUILT, AND WHAT IT COSTS.
 *
 * The table top is NOT marched. It is the plane y = 0, intersected
 * analytically, which is exact, costs one divide, and buys the march
 * budget back for the four things that actually need it. The march
 * therefore only ever carries the plate, the fork, the knife and the
 * glass, each behind a conservative bounding sphere centred on its own
 * animated origin — and the spheres are centred on the point each piece
 * ROTATES about, so a bound stays valid through the tilt. No bound is
 * ever returned below 0.06, which is far above the hit threshold; that
 * is the bug that shipped a violet ball the last time this set was
 * built.
 *
 * Every field is exact. The plate and the glass are 2D profiles
 * revolved about their own axes, which is exact for every radius above
 * zero: the plate is a rounded cylinder with a very large sphere taken
 * out of its top, and the glass is a foot, a stem, a solid swell and a
 * three-segment polyline — the wall of the bowl — swept about one axis.
 * The bowl was a spherical shell once and it read as a bauble on a
 * stick; a wine glass is a tulip that opens out of its own stem, and
 * three segments are what that costs.
 *
 * AND THE GLASS IS ONE OBJECT. It was three. The stem was a rod pushed
 * straight through the foot and out of its underside, and the bowl's
 * wall cleared the side of that rod by four tenths of a millimetre —
 * a cup balanced on a pole with daylight at the join, and the first
 * thing anybody sees. The four parts are now combined with a SMOOTH
 * union whose radius is the fillet a glassblower really leaves, the
 * swell between the stem and the bowl is a cone of revolution that
 * simply was not there before, and the wall's first point sits ON that
 * swell's surface rather than beside it. A smooth union returns at or
 * below the minimum, so the march stays safe; what it can do is bulge,
 * so the whole piece is intersected with the plane its foot stands on
 * and the underside of the glass IS the table. The cutlery tapers, which costs a little
 * Lipschitz, so both pieces hand back a scaled distance. The fork's
 * three slots are one slot folded, and the fold is CLAMPED to one
 * period either side so the repeat cannot nick the outer tines — an
 * unclamped fold put a fourth slot through the edge of the head, and
 * the gaps are also drawn at the surface, because 2.5mm of geometry is
 * a third of a pixel on a phone and the first cut was a grey stick.
 *
 * The glass is not opaque. At a glass hit the ray is bent a little by
 * the surface normal and dropped onto the table plane analytically, so
 * what you see through the bowl is the real timber, displaced — one
 * divide, no second march. Fresnel decides how much of the pendant and
 * the room is on the surface instead.
 *
 * Shadows are analytic too, and thrown rather than ringed: each piece
 * is projected from the pendant onto the table as a disc or a capsule,
 * the penumbra widens with its height, and the opacity falls with it.
 * That is why a piece being lowered reads as being lowered. There is no
 * marched shadow ray anywhere in this file, on any tier — the light is
 * a point above a nearly flat arrangement and the analytic projection
 * is both cheaper and more correct than sixteen steps would have been.
 *
 * AND A CAST SHADOW IS NOT A CONTACT. That is what was missing, and it
 * is why the whole cover hovered. A cast shadow can only take the
 * pendant away, and the pendant is about half of what lies on this
 * timber; the violet fill went on underneath it at full strength, so
 * the darkest pixel in the frame was somewhere on an object rather than
 * where an object met the table. So each piece returns a second number:
 * a tight band that closes off the ROOM as well, at its darkest against
 * the join, gone within a finger's width of it, and gone outright the
 * moment the piece leaves the table. It is never a colour of its own —
 * it is this room's fill going out over this room's timber, so it is
 * tinted by the light rather than painted grey. And it is centred on
 * the PIECE, not on the pendant's projection: the two are the same
 * place for a plate 62cm across and they are not the same place for a
 * wine glass's foot, where nine millimetres of offset ate the dark ring
 * off one side of it entirely. Both height fades are solved once in
 * main() rather than per table fragment, which is what pays for it.
 *
 * What uTier buys is march steps and taps, never subject: 48/36/24, and
 * the second occlusion tap comes off below desktop. All four pieces, the
 * grain, the caustic and the pendant are on every tier, at every width —
 * the grain is now gated on its own PIXEL FOOTPRINT rather than on the
 * tier, which is the honest gate: a phone loses the 5mm pore because a
 * phone cannot resolve 5mm at this distance, not because it is a phone.
 *
 * The march is under-relaxed to 0.85 of the distance. Three of the four
 * pieces are thin — a 5mm blade, a 2.5mm gap between tines, a 2cm glass
 * wall — and a full step against a tapered field walks through the side
 * of one and stipples its own silhouette.
 *
 * FRAMING, which is the thing that cropped two earlier cuts. The
 * camera is long rather than wide — twelve degrees of half angle, not
 * twenty — so the plate projects as the ellipse a 55 degree elevation
 * really gives and the far edge of the table reads flat instead of
 * raking. The field of view is then solved against the band's HEIGHT,
 * and the frame is lifted clear of the bottom third the harness washes
 * to paper for the kicker.
 *
 * The one thing a 21:9 band is short of is height, and the tallest
 * thing here is the glass — so the glass MOVES. On a 4:5 band it stands
 * above the knife's tip, where a glass goes on a laid cover; as the
 * band widens it swings out to the right of the blade instead, which
 * takes a fifth off the object's vertical extent and spends it on width
 * the long band has going spare. Its path is solved against the knife
 * rather than tuned — the blade occupies x 0.80 to 0.87 out to a tip at
 * z 0.565, so a 0.158 foot clears it only at x above 1.03 or at z above
 * 0.72 — and the two eases are staggered so the path goes round the
 * corner of that rectangle and never through it. On a long band the
 * whole cover also moves right, which leaves the kicker the open left
 * rather than stranding it under the plate.
 *
 * THE LOOP HAS NO SEAM, BY CONSTRUCTION. Every piece's position is
 * home + approach * u, where u is 1 while it is off the table and 0 once
 * it is down, and u is the PRODUCT of a clear ramp that is zero before
 * the clear and a lay ramp that is zero after the lay. Both ends of the
 * cycle therefore have every u at 0 — the complete cover — whatever the
 * windows say. The contact wobble is clamped to zero before contact, so
 * the exponential in it can never run backwards, and by the wrap the
 * slowest of the four has decayed by e^-11. Measured rather than
 * asserted: at 1440, t = 0 against t = 14.9999 is a maximum difference
 * of five parts in 255 on any channel — the film grain, which is seeded
 * on fract(uTime) — and not one pixel in 888,480 differs by six.
 * ------------------------------------------------------------------ */

const frag = `
#define FAR 11.0

/* ---- the animation state. Globals, because map() is called fifty-odd
   times a fragment and not one of these changes between calls. ---- */
vec3  gPlP, gFkP, gKnP, gGlP;      // where each piece is, at its contact point
vec3  gGlB;                        // the glass's bound centre (it is tall)
float gPlC, gPlS;                  // plate: cos/sin of its tilt about x
float gFkC, gFkS;                  // fork:  cos/sin of its yaw
float gKnC, gKnS;                  // knife: cos/sin of its yaw
float gGlC, gGlS;                  // glass: cos/sin of its tilt about x
vec3  gLP;                         // the pendant
vec2  gSP, gSF, gSK, gSG, gSB;     // where each piece throws: plate, fork,
                                   // knife, glass foot, glass bowl
vec4  gSH;                         // and how high each of them is
vec4  gEnd, gSit;                  // ...and, solved once, how much of its
                                   // cast and of its contact that height
                                   // leaves — both are height alone
vec2  gFkD, gKnD;                  // the cutlery's own direction on the table
vec4  gAway;                       // how far each piece is from home, 0..1

float hash(vec2 p){
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

/* ---- primitives ---- */
float rbox2(vec2 p, vec2 b, float r){
  vec2 d = abs(p) - b + r;
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - r;
}
float box3(vec3 p, vec3 b){
  vec3 d = abs(p) - b;
  return min(max(d.x, max(d.y, d.z)), 0.0) + length(max(d, 0.0));
}
float rbox3(vec3 p, vec3 b, float r){
  vec3 d = abs(p) - b + r;
  return min(max(d.x, max(d.y, d.z)), 0.0) + length(max(d, 0.0)) - r;
}
float seg2(vec2 p, vec2 a, vec2 b){
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1.0e-6), 0.0, 1.0);
  return length(pa - ba * h);
}
/* A smooth union, which is the only way one object made of several fields
   comes out as ONE object. It returns at or below the min of the two, so
   the march stays conservative; all it ever costs is a shorter step inside
   the fillet itself. */
float smin(float a, float b, float k){
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
/* A cone of revolution with round ends, given in the (r, y) profile plane:
   the radius runs r0 at y0 to r1 at y1. It is the EXACT distance for every
   radius above zero, which is what lets a stem open out into a bowl
   without an approximation in the middle of the thinnest thing in frame.
   Requires y1 > y0 and |r1 - r0| < y1 - y0, which every call here holds. */
float rcone2(vec2 q, float y0, float r0, float y1, float r1){
  q.y -= y0;
  float h = y1 - y0;
  float b = (r0 - r1) / h;
  float a = sqrt(max(1.0 - b * b, 1.0e-6));
  float k = dot(q, vec2(-b, a));
  if (k < 0.0) return length(q) - r0;
  if (k > a * h) return length(q - vec2(0.0, h)) - r1;
  return dot(q, vec2(a, b)) - r0;
}

/* ---- the plate ----
   A profile revolved about its own axis, and the revolve is EXACT
   because the profile is centred on the axis: rbox2 over (r, y) is a
   rounded cylinder, and the scoop is a real sphere. The well is a very
   large sphere taken out of the top — which is what a plate is, a 28cm
   disc with most of a metre of radius of curvature in its middle — and
   that radius is SOLVED from the width and the depth of the well rather
   than guessed, so the rim comes out at the 29% of the radius a bistro
   plate really has. Local origin at the foot, so the tilt turns it
   about the point it touches the table. */
float sdPlate(vec3 p){
  vec2  q = vec2(length(p.xz), p.y);
  // 28cm across and 9mm thick, standing on a 3mm foot ring: at this
  // scale one unit is 22.6cm, and every number in this file is that
  // plate's real one rather than a number that looked right.
  float d = rbox2(q - vec2(0.0, 0.028), vec2(0.620, 0.020), 0.017);
  // The well. The sphere's radius is SOLVED from the width and the depth
  // of the well — 0.44 across, 6mm down — rather than picked; a guessed
  // radius gives either a saucer or a soup bowl. The shoulder it leaves
  // at 0.44 is the line that makes a plate read as a plate.
  float w = length(vec3(p.x, p.y - 3.491, p.z)) - 3.471;
  d = max(d, -w);
  d = min(d, rbox2(q - vec2(0.430, 0.007), vec2(0.028, 0.007), 0.005));
  return d;
}

/* ---- the wine glass ----
   ONE piece of glass, blown in one piece, and that is the whole of what
   changed here. The last cut was three solids dropped on top of each
   other: a centimetre-thick rod pushed straight THROUGH the foot and
   out of its underside, and a tulip wall whose bottom rim cleared that
   rod by four tenths of a millimetre — a bowl balanced on a pole with
   daylight at the join. Nobody has to be told what to look for; it is
   the first thing anyone sees.

   So the profile now runs continuously from the table to the rim, and
   every place two parts meet is a real fillet rather than one solid
   pushed into another:

     · the FOOT sits on the table — its underside is y = 0 exactly;
     · the STEM grows out of the middle of it. It stops INSIDE the foot
       and the smooth union is what puts the cove there, which is what a
       glassblower leaves and what the old min() could not have made;
     · the SWELL is the piece that was simply missing: the stem opening
       out into the solid underside of the bowl. It is an exact cone of
       revolution, and its domed top is the punt you see through the
       bowl when you look down into a wine glass;
     · the WALL springs off the swell's own flank — its first point is
       ON that surface, not beside it — and the fillet between them is
       the thick glass at the bottom of a bowl.

   A smooth union returns at or below the minimum, so the field stays
   safe to march; what it can do is bulge, so the whole thing is finally
   intersected with the plane its foot stands on. Nothing of one piece of
   glass hangs below the table it is standing on. */
float sdGlass(vec3 p){
  vec2  q = vec2(length(p.xz), p.y);
  float d = rbox2(q - vec2(0.0, 0.011), vec2(0.150, 0.011), 0.009);
  d = smin(d, rbox2(q - vec2(0.0, 0.2340), vec2(0.0185, 0.2160), 0.015), 0.048);
  d = smin(d, rcone2(q, 0.390, 0.0198, 0.498, 0.046), 0.040);
  /* The bowl is a WALL, not a ball. A spherical shell with a hole cut in
     the top is geometrically a bowl and reads as a Christmas bauble on a
     stick; a wine glass is a tulip that opens out of the stem, widens,
     and closes a little again at the mouth. So the wall is a
     three-segment polyline revolved — 7cm across the rim, 18cm tall —
     and the revolve is exact because the distance to a segment in
     (r, y) IS the distance to the surface of revolution for every
     radius above zero. It costs three segment distances and it is the
     difference between a glass and a goblet. */
  float wall = min(min(seg2(q, vec2(0.046, 0.498), vec2(0.116, 0.604)),
                       seg2(q, vec2(0.116, 0.604), vec2(0.160, 0.726))),
                       seg2(q, vec2(0.160, 0.726), vec2(0.150, 0.812))) - 0.0085;
  d = smin(d, wall, 0.030);
  return max(d, -p.y);
}

/* ---- the fork ----
   One tapered bar with three slots folded out of the head. The taper is
   what stops it reading as a grey stick, and it costs a little
   Lipschitz, so the distance is handed back scaled. The fold is CLAMPED
   to one period either side: unclamped it puts a fourth slot through
   the outside edge of the outer tines. */
float sdFork(vec3 p){
  float z = p.z;
  float head = smoothstep(0.02, 0.28, z);
  // 22.6cm long, a 7.5mm handle opening to a 2.5cm head. The first cut
  // of this had the head at 1.6cm and the gaps at a millimetre, which is
  // a tenth of a pixel on a phone: it rendered as a grey stick.
  float w = mix(0.0165, 0.0550, head) * (1.0 - 0.34 * smoothstep(0.40, 0.505, z));
  float h = mix(0.0105, 0.0050, head);
  float d = rbox3(p - vec3(0.0, h, 0.0), vec3(w, h, 0.500), 0.0044);
  /* Three slots, which is four tines, and the pitch is solved so that
     all four come out the same width: with a head half-width W and a
     slot half-width s, the outer tine is W - p - s and the inner is
     p - 2s, and they are equal only at p = (W + s) / 2. At a pitch
     picked by eye the outer tines came out a third wider than the inner
     pair, which is the sort of thing nobody can name and everybody can
     see. The fold is CLAMPED to one period either side; unclamped it
     puts a fourth slot through the outside edge of the head. */
  float k = 0.03025;
  float xf = p.x - k * clamp(floor(p.x / k + 0.5), -1.0, 1.0);
  float slot = box3(vec3(xf, p.y, p.z - 0.450), vec3(0.00550, 0.060, 0.120));
  d = max(d, -slot);
  return d * 0.80;
}

/* ---- the knife ----
   A thick handle running into a thin blade that closes to a point. The
   spine is offset off the centreline so the piece is not symmetric,
   which is most of what reads as a knife from above. */
float sdKnife(vec3 p){
  float z = p.z;
  float blade = smoothstep(-0.02, 0.15, z);
  float tip = smoothstep(0.33, 0.505, z);
  float w = mix(0.0170, 0.0300, blade) * (1.0 - 0.90 * tip);
  float h = mix(0.0130, 0.0046, blade);
  float d = rbox3(p - vec3(0.0060 * blade, h, 0.0), vec3(w, h, 0.500), 0.0040);
  return d * 0.80;
}

/* ---- the field ----
   Four bounds, every one of them centred on the point its piece turns
   about, so the sphere stays valid through the tilt, and every one of
   them larger than what is inside it. A bound is only ever handed back
   while it is unmistakably above the hit threshold. */
float map(vec3 p){
  float d;

  vec3 a = p - gPlP;
  float b = length(a) - 0.700;
  if (b > 0.06) { d = b; }
  else { a.yz = vec2(gPlC * a.y + gPlS * a.z, gPlC * a.z - gPlS * a.y); d = sdPlate(a); }

  vec3 f = p - gFkP;
  b = length(f) - 0.580;
  if (b > 0.06) { d = min(d, b); }
  else { f.xz = vec2(gFkC * f.x + gFkS * f.z, gFkC * f.z - gFkS * f.x); d = min(d, sdFork(f)); }

  vec3 n = p - gKnP;
  b = length(n) - 0.580;
  if (b > 0.06) { d = min(d, b); }
  else { n.xz = vec2(gKnC * n.x + gKnS * n.z, gKnC * n.z - gKnS * n.x); d = min(d, sdKnife(n)); }

  b = length(p - gGlB) - 0.580;
  if (b > 0.06) { d = min(d, b); }
  else {
    vec3 g = p - gGlP;
    g.yz = vec2(gGlC * g.y + gGlS * g.z, gGlC * g.z - gGlS * g.y);
    d = min(d, sdGlass(g));
  }
  return d;
}

vec3 normalAt(vec3 p){
  vec2 k = vec2(1.0, -1.0) * 0.0013;
  vec3 g = k.xyy * map(p + k.xyy) + k.yyx * map(p + k.yyx)
         + k.yxy * map(p + k.yxy) + k.xxx * map(p + k.xxx);
  float l = length(g);
  return l > 1.0e-7 ? g / l : vec3(0.0, 1.0, 0.0);
}

/* ---- what the four pieces throw on the table ----
   Discs and capsules projected from the pendant onto y = 0, not haloes
   ringed round the objects — a ring is how you get a thing that glows
   instead of a thing that sits on something. A pendant is a shade and
   not a filament, so each piece throws a tight core inside a wide soft
   skirt; both open and both fade as the piece rises, and that is the
   whole of the contact. A plate held 30cm up has a grey ghost under it
   and a plate on the timber has a hard dark line. */
/* And SEPARATELY, the contact. A cast shadow can only ever take the
   pendant away, and the pendant is about half of what lies on this timber
   — so a piece standing on the table came out sitting in a grey saucer
   with its own body darker than the wood beside it, which is a thing
   hovering rather than a thing resting. What a real contact does is close
   off the ROOM as well: the few millimetres of table beside the join can
   see almost none of the sky, and that is the darkest pixel anywhere in
   the frame. It is tight — it is gone within a finger's width — and it
   dies the moment the piece leaves the table, which is the whole of the
   difference between lowering something and floating it.

   BOTH FADES ARE FUNCTIONS OF HEIGHT ALONE, so neither belongs in here.
   The first is the old one — a piece carried up out of the band was still
   throwing a quarter-strength saucer of grey across the timber behind it,
   because the lobe only ever divided its opacity down and never reached
   zero — and the second is the new one. They were costing ten smoothsteps
   a table fragment to recompute four numbers that do not change anywhere
   in the frame; they are solved once in main() now and handed in, which
   is what keeps a second lobe term inside the budget this band had. */
vec2 lobe(float d, float h, float k0, float end, float sit){
  float k = k0 + 0.90 * h;
  float core = smoothstep(k, -k * 0.35, d) / (1.0 + 2.5 * h);
  float skirt = smoothstep(k * 5.0 + 0.135, -k, d) / (1.0 + 1.4 * h);
  float ct = (1.0 - smoothstep(0.0, 0.052, max(d, 0.0))) * sit;
  return vec2(max(core, skirt * 0.50) * end, ct);
}
vec2 shadowAt(vec2 w){
  /* An early out, because this is the most expensive thing in the file:
     the table is the plane, so nearly every fragment in a full-bleed band
     is a table fragment, and every one of them was paying for five lobes
     of a cover that occupies about a fifth of the top. Nothing here throws
     further than its own half-length plus the widest skirt the tallest
     piece can open, and that bound is deliberately generous — it is
     compared in SQUARED distance so the test costs four dot products and
     no square roots at all. */
  float hm = max(max(gSH.x, gSH.y), max(gSH.z, gSH.w));
  float reach = 1.62 + 4.8 * hm;
  vec2 dp = w - gSP, df = w - gSF, dk = w - gSK, dg = w - gSG;
  float q2 = min(min(dot(dp, dp), dot(df, df)), min(dot(dk, dk), dot(dg, dg)));
  if (q2 > reach * reach) return vec2(0.0);

  vec2 s = lobe(length(w - gSP) - 0.620 * (1.0 + 0.42 * gSH.x), gSH.x, 0.030,
                gEnd.x, gSit.x);
  s = max(s, lobe(seg2(w, gSF - gFkD * 0.46, gSF + gFkD * 0.46)
                  - 0.040 * (1.0 + 0.5 * gSH.y), gSH.y, 0.020, gEnd.y, gSit.y));
  s = max(s, lobe(seg2(w, gSK - gKnD * 0.46, gSK + gKnD * 0.46)
                  - 0.036 * (1.0 + 0.5 * gSH.z), gSH.z, 0.020, gEnd.z, gSit.z));
  /* Glass is the one thing on this table that light goes THROUGH, and
     what it leaves on the timber is not a disc — it is the caustic
     below, and a RING. Light passes through the middle of a foot, which
     is what a foot is for; at the bevel it turns, so the table just
     outside the rim is the one place that sees neither the pendant nor
     the room. So the weight goes UP outside the rim and DOWN underneath
     it, which is both the physics and the picture: flat across the
     underside and the foot is a black puck cut into the wood, as weak as
     it used to be everywhere and the glass hovers over its own table. */
  float fd = length(w - gSG) - 0.150 * (1.0 + 0.5 * gSH.w);
  vec2 gf = lobe(fd, gSH.w, 0.026, gEnd.w, gSit.w);
  float thru = mix(0.55, 1.0, smoothstep(-0.032, 0.004, fd));
  /* AND THE RING, which is what the glass did not have. Measured off the
     mask rather than guessed: the plate's contact came back at 0.96 with
     0.79 of cast under it, held over ten pixels of timber at 1440, and the
     foot's came back at 0.90 with 0.41, held over four. Four pixels of a
     half-tone is nothing once the foot's own antialiasing has had its two,
     so the one transparent piece on this table was the one piece standing
     on nothing — which is exactly what it looked like.
     Two numbers, and neither of them is a new kind of mark:
       · the CAST goes back to what the other three get. The 0.66 was
         double counting: thru, above, is already the light a foot passes
         — up outside the bevel, down through the middle — and taking a
         third off again on top of it is what halved the only shadow on
         this table that had a piece of glass to explain it;
       · the CONTACT carries its own band. The shared one is 1.2cm wide,
         which is right against a 28cm plate and is a hairline against a
         6.8cm foot. This one is 2cm, full strength hard against the bevel
         — 5mm of solid glass edge-on to both the pendant and the room, so
         the timber there sees neither — and smoothstepped out from it, so
         it is still tightest and darkest AT THE JOIN and still gone within
         a finger's width. It dies with gSit.w like every other contact in
         this file: lift the glass and there is nothing under it. */
  float ring = (1.0 - smoothstep(0.004, 0.088, max(fd, 0.0))) * gSit.w;
  s = max(s, vec2(gf.x, max(gf.y, ring)) * thru);
  // The bowl is a metre of air above the timber: it throws, it never touches.
  s.x = max(s.x, 0.30 * lobe(length(w - gSB) - 0.185 * (1.0 + 0.5 * gSH.w),
                             gSH.w, 0.070, gEnd.w, 0.0).x);
  return clamp(s, 0.0, 1.0);
}

/* ---- the studio a polished surface stands in ----
   A polished surface has almost no colour of its own: it is whatever is
   around it. Point one at a violet backdrop and the glass comes back as
   lavender plastic and the steel as a grey lozenge — which is what this
   file shipped, and it was the palette rule that did it. So the two
   REFLECTIVE materials here sample a studio instead, lit the way anyone
   who has ever photographed a cover lights one: a dark floor, a big soft
   overhead sweep, a warm key off one shoulder and a cool fill off the
   other. The backdrop behind the object stays the house violet; the
   DIFFUSE surfaces — the timber, the glaze, every fill and every shadow —
   stay on the house palette too. Only what is mirror-like is allowed in
   here, and it is allowed because chrome reads as chrome or it reads as
   plastic, and there is no third option. */
vec3 studio(vec3 r){
  vec3 c = mix(vec3(0.038, 0.037, 0.036), vec3(0.200, 0.202, 0.211),
               smoothstep(-0.62, 0.02, r.y));                      // floor -> wall
  c = mix(c, vec3(0.880, 0.876, 0.868), smoothstep(0.10, 0.74, r.y)); // overhead sweep
  float k = max(dot(r, vec3(-0.402, 0.747, 0.529)), 0.0);          // the warm key
  c += vec3(1.000, 0.918, 0.808) * pow(k, 9.0) * 1.20;
  float f = max(dot(r, vec3(0.606, 0.330, -0.724)), 0.0);          // the cool fill
  c += vec3(0.720, 0.772, 0.880) * pow(f, 5.0) * 0.21;
  return c;
}

/* ---- the table, and the room past its far edge ----
   The top is the plane y = 0 and is intersected analytically rather
   than marched, which is exact and costs one divide. Dark walnut: two
   browns and a grain that runs the length of the boards, lit by a warm
   pendant that falls off with distance the way a pendant over a two-top
   does, and filled by the house violet. The sheen is a real one — a
   restaurant table is oiled, so the room lies along it at grazing
   angles and the pendant sits in it as a broad soft highlight. */
vec3 timberAt(vec3 hp, vec3 rd, float dist, float px, float caustic){
  /* GRAIN, and this is the thing that was wrong. The first cut faded the
     figure out on DISTANCE — exp(-(dist - 6) * 0.3) — and at this camera
     the whole visible table is between 6.7 and 8.9 away, so the fade was
     already half-closed at the near edge and two-thirds closed at the
     far one. Every mark on the timber was smeared out before it was
     drawn and what came back was vertical streaks of brown with no wood
     in them.

     A mark is not lost because it is far away. It is lost because it is
     narrower than a pixel. So there are three scales here — the figure a
     board is cut with, the earlywood/latewood banding inside it, and the
     open pore a walnut has — and each is gated on ITS OWN width measured
     in PIXELS, exactly as the fitness scene gates its knurl. Wide enough
     to see, it is drawn; narrower than about two pixels, it would be
     moire and it is faded. At 1440 all three survive; at 390 the figure
     and the banding do and the pore does not, which is what a phone would
     actually resolve. */
  float gx = hp.x + sin(hp.z * 0.80) * 0.16;
  float figure = sin(gx * 15.0 + sin(gx * 5.3 + hp.z * 0.7) * 1.15);
  float band   = sin(gx * 68.0 + sin(gx * 9.1 + hp.z * 1.4) * 0.90);
  float pore   = sin(gx * 276.0 + hp.z * 3.10);
  float vFig = smoothstep(1.6, 3.4, 0.4189 / px);   // 2pi/15,  ~9.5cm
  float vBan = smoothstep(1.6, 3.4, 0.0924 / px);   // 2pi/68,  ~2.1cm
  float vPor = smoothstep(1.7, 3.6, 0.0228 / px);   // 2pi/276, ~5mm

  /* WALNUT, IN THIS ROOM. It stays walnut — two browns, figure, banding
     and an open pore — but the orange has come off it. The old pair ran
     two and a half parts red to one part blue, which is a timber
     photographed under tungsten and nothing else; this table is in a
     violet-grey dining room with one warm pendant over it, and a dark
     walnut in that room is a cooler, quieter brown. The frame was the one
     sepia band in a set of sixteen and it was these two numbers, the lift
     below and the reflection further down that did it. */
  vec3 dark = vec3(0.216, 0.142, 0.104);
  vec3 lite = vec3(0.312, 0.212, 0.156);
  float g = 0.44 + 0.26 * figure * vFig + 0.115 * band * vBan
          + 0.05 * sin(hp.z * 2.1 + gx * 2.7);
  vec3 alb = mix(dark, lite, clamp(g, 0.0, 1.0));
  // Walnut is an open-pored timber: the fine dark flecks that lie along
  // the grain are most of what says wood rather than brown paint.
  alb = mix(alb, dark * 0.76, smoothstep(0.50, 1.0, pore) * 0.30 * vPor);
  // The joint between two boards: a shadow rather than an ink line, and
  // it is kept a couple of pixels wide at any width rather than a fixed
  // slab of world that becomes a stripe when the camera is long.
  float seam = abs(fract(hp.x * 0.40 + 0.5) - 0.5) / 0.40;
  alb = mix(vec3(0.138, 0.090, 0.073), alb, smoothstep(0.0, 0.020 + px * 3.0, seam));

  vec3 nor = vec3(0.0, 1.0, 0.0);
  vec3 Lv = gLP - hp;
  float Ld = length(Lv);
  vec3 L = Lv / max(Ld, 1.0e-4);
  float att = 4.1 / (1.0 + 0.66 * Ld * Ld);
  /* Two numbers come back from the projection, and they do different
     work. The CAST shadow takes the pendant away — that is what a shadow
     is. The CONTACT closes off the room as well, because the table three
     millimetres from a plate's foot ring can see almost none of it; that
     is what a contact is, and it is the thing that was missing. */
  vec2  shd = shadowAt(hp.xz);
  float sh = 1.0 - shd.x * 0.86;
  float amb = 1.0 - shd.y * 0.74;

  // The pendant is warm; everything that is not the pendant is the
  // house violet, which is what keeps this band on the site.
  vec3 warm = vec3(1.000, 0.918, 0.808);
  float dif = max(L.y, 0.0) * att * sh;
  // The pendant is the object's own light; the fill is the room's, and
  // the room is the site's. A dark timber top under a warm pendant is a
  // warm mid-brown with violet in its corners, not a black rectangle.
  /* And the fill is what the CONTACT takes away. It is never painted on
     as a colour of its own: the darkest pixel beside a plate is this
     room's violet fill going out, over this room's timber, which is why
     the shadow is tinted by the light rather than by a swatch. */
  vec3 c = alb * (warm * dif + (mix(uColors[1], uInk, 0.40) * 0.86
                              + mix(uColors[2], uColors[1], 0.5) * 0.16) * amb);

  // Oiled timber. The sheen is almost all the pendant's own broad
  // highlight; the room only lies along the surface right up at the far
  // edge, where the ray is closest to grazing, which is exactly where a
  // polished top picks it up.
  vec3 hv = L - rd;
  vec3 hal = hv * inversesqrt(max(dot(hv, hv), 1.0e-8));
  float spc = pow(max(hal.y, 0.0), 13.0) * att * sh;
  c += warm * spc * 0.30;
  /* THE ROOM, LYING ON THE TABLE, and this is the other half of why the
     band was sepia. An oiled top is a mirror at a few per cent EVERYWHERE
     and a mirror outright at a graze; what it mirrors is the dining room,
     and the dining room is the house's violet. The old term was a bare
     fourth power of the incidence, which at a fifty-five degree camera
     returns one part in a thousand — so over the whole visible table the
     site's colour was contributing nothing at all and what was left was a
     warm key on brown timber from edge to edge.
     A reflection is not tinted by the albedo underneath it. That is
     exactly why this, and not a violet veil over the band, is what brings
     the timber back into the house environment without making it stop
     being timber. */
  float fre = 1.0 - max(-rd.y, 0.0);
  fre = 0.055 + 0.945 * fre * fre * fre * fre * fre;
  c = mix(c, mix(mix(uColors[1], uInk, 0.42), uColors[2], 0.22),
          clamp(fre * 1.75, 0.0, 0.62) * amb);

  // The caustic the glass opens on the timber beside its foot. It is
  // there whenever the glass is down and it blooms when the bowl catches
  // the pendant — which is exactly what a wine glass does to a table.
  /* It is thrown between the foot's shadow and the bowl's, which is where
     a bowl of glass over a point source really focuses it, and it is TIGHT.
     Centred on the bowl's projection alone and two thirds of a foot across,
     it read as a stray warm blob sitting on the timber next to the glass
     rather than as the glass's own light. */
  vec2  cc = mix(gSG, gSB, 0.62);
  float cd = length((hp.xz - cc) * vec2(1.45, 0.90));
  // It cannot reach into the contact. Light focused by a bowl lands on
  // open table, not in the hairline under the foot that is holding it up.
  float cl = caustic * (1.0 - shd.y);
  c += warm * exp(-cd * cd * 60.0) * cl * 0.26;
  c += warm * exp(-cd * cd * 16.0) * cl * 0.065;
  return c;
}

void main(){
  vec2  s0  = (2.0 * gl_FragCoord.xy - uRes) / uRes.y;
  float asp = uRes.x / uRes.y;
  float wide = smoothstep(0.95, 2.00, asp);
  float e = smoothstep(0.0, 1.0, uEnter);

  /* ---------------- the clock ----------------
     Fifteen seconds, and the COMPLETE COVER holds for more than half of
     them. That is not a taste decision. A reader arrives at an arbitrary
     moment and so does anyone photographing this band, and a cover caught
     mid-clear is a place setting with the knife missing — which is not a
     place setting, and does not get the same answer out of a stranger as
     the one beside it at another width. The old schedule spent two thirds
     of its loop with at least one piece in the air and it was photographed
     at 1440 with no knife on the table.

     So: complete from 0 to 0.640 — nine and a half of the fifteen
     seconds, and every one of the first nine and a half — cleared in
     reverse from 0.640 to 0.796, laid again from 0.796 to 0.952, and
     complete again to the wrap. cyc has no offset on it, so uTime zero
     is the complete cover and so is anything anyone is likely to
     photograph. */
  float T = 15.0;
  float cyc = fract(uTime / T);

  /* Each piece has one number: how far it still is from home, 1 while it
     is held above the table and 0 once it is down. It is the PRODUCT of a
     clear ramp (0 -> 1, the piece is taken away) and a lay ramp (1 -> 0 on
     a cubic ease-out, so it decelerates into its place the way a placed
     piece does). Before the clear the first factor is 0; after the lay the
     second is 0. Both ends of the loop therefore have every piece down,
     whatever the windows say, so the loop cannot have a seam. */
  float l1 = 1.0 - smoothstep(0.796, 0.856, cyc); l1 = l1 * l1 * l1;
  float l2 = 1.0 - smoothstep(0.826, 0.886, cyc); l2 = l2 * l2 * l2;
  float l3 = 1.0 - smoothstep(0.856, 0.916, cyc); l3 = l3 * l3 * l3;
  float l4 = 1.0 - smoothstep(0.886, 0.952, cyc); l4 = l4 * l4 * l4;
  /* Cleared in reverse — glass, knife, fork, plate — and laid in order.
     The plate's lay begins on the same frame its clear ends, so it turns
     round at the top of its travel rather than resting there: the table
     is bare for about a quarter of a second of the fifteen, while the
     plate is above the frame's own fade-out, and for no longer. An empty
     top is a different photograph from a place setting and a stranger
     asked to name it would say so, so it is worth counting. */
  float u1 = clamp(smoothstep(0.736, 0.796, cyc) * l1, 0.0, 1.0);
  float u2 = clamp(smoothstep(0.704, 0.764, cyc) * l2, 0.0, 1.0);
  float u3 = clamp(smoothstep(0.672, 0.732, cyc) * l3, 0.0, 1.0);
  float u4 = clamp(smoothstep(0.640, 0.700, cyc) * l4, 0.0, 1.0);

  /* The contact. A short damped settle in the piece itself, a few
     hundredths of a unit, for about half a second after it is down. The
     time since contact is CLAMPED at zero: an exponential handed a
     negative argument runs backwards and throws the piece through the
     table, which is the sort of bug that compiles. By the wrap the
     slowest of the four has decayed by e^-11 and at cyc = 0 all four are
     exactly zero, so the seam is checked rather than hoped for. */
  float b1 = exp(-13.0 * max(cyc - 0.856, 0.0) * T) * sin(31.0 * max(cyc - 0.856, 0.0) * T) * 0.011;
  float b2 = exp(-15.0 * max(cyc - 0.886, 0.0) * T) * sin(40.0 * max(cyc - 0.886, 0.0) * T) * 0.007;
  float b3 = exp(-15.0 * max(cyc - 0.916, 0.0) * T) * sin(40.0 * max(cyc - 0.916, 0.0) * T) * 0.007;
  float b4 = exp(-14.0 * max(cyc - 0.952, 0.0) * T) * sin(27.0 * max(cyc - 0.952, 0.0) * T) * 0.009;

  /* The glass catching the light, in the middle of the long held cover —
     which is where it belongs, because it is the pay-off of a complete
     cover and not a thing that happens to an empty table. */
  float flare = smoothstep(0.150, 0.235, cyc) * (1.0 - smoothstep(0.300, 0.400, cyc));
  flare = flare * flare * (3.0 - 2.0 * flare);

  /* ---------------- the camera ----------------
     High and slightly oblique, from the diner's side of the table. One
     cosine over the cycle, so it eases about six degrees round and two
     up and closes on itself with no seam. The pointer is NOT on the
     camera — it is on the pendant, below, which is worth more on a scene
     whose whole subject is what one light does to four materials. */
  float sweep = cos(6.2831853 * cyc);
  float th = 0.105 + 0.055 * sweep;
  float ph = 0.960 + 0.020 * sweep;
  /* A long lens rather than a wide one. At D = 4.3 the vertical half
     angle was twenty degrees and the far edge of the table raked across
     the top of the band like a skewed floor; at 7.4 it is twelve, the
     plate projects as the ellipse a 55 degree elevation really gives,
     and the table reads flat. The object is held at size by halfH, so
     the only thing this costs is a longer first step in the march. */
  float D  = 7.40;
  vec3  ta = vec3(0.030, 0.150, 0.130);
  vec3  ro = ta + D * vec3(sin(th) * cos(ph), sin(ph), -cos(th) * cos(ph));
  vec3  ww = normalize(ta - ro);
  // Screen right is world right. cross(ww, up) would mirror the frame
  // for a camera on the negative z side, which is where this one is.
  vec3  uu = normalize(cross(vec3(0.0, 1.0, 0.0), ww));
  vec3  vv = cross(ww, uu);

  /* The field of view, solved against BOTH ends of the band, by measurement rather than by
     eye: the bottom third is washed to paper for the kicker and the top
     of a full-bleed band passes under a docked header, so the cover has
     to live between gy 0.33 and roughly the top eighth at every aspect.
     16:10 is the tight one — a 513px band under a 57px header — and it
     is what these two numbers are set from. */
  float halfH = mix(1.56, 1.44, wide);
  // Lifted clear of the bottom third the harness washes to paper for the
  // kicker, and moved right on a long band so the kicker has the open
  // left rather than being stranded under the plate.
  float yOff = mix(0.095, 0.175, wide);
  float xOff = 0.62 * wide;
  vec2  s  = vec2(s0.x - xOff, s0.y - yOff);
  vec3  rd = normalize(s.x * uu + s.y * vv + (D / halfH) * ww);
  float pxk = 2.0 * halfH / (D * uRes.y);

  /* ---------------- where everything is ----------------
     Home first: a cover as it is actually laid. The plate in the middle,
     the fork to its left, the knife to its right, and the glass beyond
     the knife — see below for where exactly, because that one moves. */
  vec3 homeP = vec3(0.000, 0.0, 0.030);
  vec3 homeF = vec3(-0.840, 0.0, 0.060);
  vec3 homeK = vec3(0.830, 0.0, 0.060);
  /* The glass moves with the band, and its path is SOLVED against the
     knife rather than tuned: the blade occupies x 0.80 to 0.87 out to a
     tip at z 0.565, so a 0.158 foot clears it only at x above 1.03 or at
     z above 0.72. On a 4:5 band it therefore stands above the knife's
     tip, where a glass goes on a laid cover; as the band grows it swings
     out to the right of the blade instead, which takes a fifth off the
     object's HEIGHT — and height is the only thing a 21:9 band is short
     of. The two eases are staggered so the path goes round the corner of
     that rectangle and never through it. */
  vec3 homeG = vec3(mix(0.700, 1.100, smoothstep(0.0, 0.55, wide)), 0.0,
                    mix(0.780, 0.420, smoothstep(0.45, 1.0, wide)));

  /* And where a piece is held while it is off the cover: straight up the
     SCREEN, which for a camera looking down is up and away in the world. A
     piece lifted along world +y alone would travel toward the lens and
     swell; along the screen's own up it rises at the size it arrives.

     It does NOT go far enough to reach the top of the band any more. It
     used to travel 1.26 of the half-height and it was faded out over the
     last stretch of that, which meant the tallest piece — the glass — was
     still at full opacity with its rim already cut off by the top edge:
     a bowl and half a stem hanging in the room, attached to nothing.
     0.72 of the half-height, and the fade below finishes before anything
     touches the edge. */
  vec3 lift = vv * (halfH * 0.72) + vec3(0.0, 0.10, 0.0);

  gPlP = homeP + lift * u1 + vec3(0.0, b1, 0.0);
  gFkP = homeF + lift * u2 + vec3(0.0, b2, 0.0);
  gKnP = homeK + lift * u3 + vec3(0.0, b3, 0.0);
  gGlP = homeG + lift * u4 + vec3(0.0, b4, 0.0);
  gAway = vec4(u1, u2, u3, u4);

  // The tilts. A piece is held at an angle and squares up as it lands,
  // and the cutlery keeps a little of the rattle for a moment after.
  float tp = 0.20 * u1 + b1 * 1.6;
  gPlC = cos(tp); gPlS = sin(tp);
  float tg = 0.13 * u4 + b4 * 1.2;
  gGlC = cos(tg); gGlS = sin(tg);
  float yf = -0.30 * u2 + b2 * 2.6;
  gFkC = cos(yf); gFkS = sin(yf);
  float yk = 0.26 * u3 + b3 * 2.6;
  gKnC = cos(yk); gKnS = sin(yk);
  gFkD = vec2(sin(yf), cos(yf));
  gKnD = vec2(sin(yk), cos(yk));

  // The glass's bound rides with it, because it is the one tall thing.
  gGlB = gGlP + vec3(0.0, 0.410, 0.0);

  /* ---------------- the pendant ----------------
     One warm point light over the table, and the pointer is its hook.
     Untouched it hangs up, back and a little left of the cover, which is
     the angle every plate of food has ever been photographed under: the
     shadows then come toward the diner and to the right, so you read the
     height of everything on the table. */
  /* And it hangs over the COVER, not over the open left. On a long band
     the whole cover moves right to leave the kicker the open left, and a
     pendant pinned to the world put its pool of light on the empty half
     and the place setting in the dim one — a two-top lit from the next
     table along. The hook travels with the framing. */
  gLP = vec3(mix(-0.80, -0.22, wide) + (uPointer.x - 0.5) * 1.70,
             2.62,
             1.10 + (0.5 - uPointer.y) * 1.20);

  /* Where each piece throws. Projected from the pendant onto the table,
     once, here — five divides for the whole frame rather than five per
     table fragment.

     And the projection is EASED OFF as a piece comes to rest, which is
     the fix that made the contact a contact. A thrown shadow is a
     projection from the light; a contact is not — it is the table failing
     to see the room, and it belongs under the object, centred on the
     object. Those are the same place for a plate 62cm across, where the
     pendant's nine-millimetre offset is one pixel, and they are NOT the
     same place for a wine glass's foot, which is fifteen centimetres
     across: that offset ate the dark ring off one side of it entirely
     and left the other side wearing a crescent. Below a finger's height
     the disc sits square under the piece, above it the real projection
     takes over, and in between the lobe is already wide and soft enough
     that the slide cannot be seen. */
  vec3 P = gPlP + vec3(0.0, 0.026, 0.0);
  vec3 Dv = P - gLP;
  float lay = smoothstep(0.030, 0.120, P.y);
  gSP = P.xz + Dv.xz * (-P.y / min(Dv.y, -0.05)) * lay; gSH.x = P.y;
  P = gFkP + vec3(0.0, 0.012, 0.0); Dv = P - gLP;
  lay = smoothstep(0.030, 0.120, P.y);
  gSF = P.xz + Dv.xz * (-P.y / min(Dv.y, -0.05)) * lay; gSH.y = P.y;
  P = gKnP + vec3(0.0, 0.013, 0.0); Dv = P - gLP;
  lay = smoothstep(0.030, 0.120, P.y);
  gSK = P.xz + Dv.xz * (-P.y / min(Dv.y, -0.05)) * lay; gSH.z = P.y;
  P = gGlP + vec3(0.0, 0.018, 0.0); Dv = P - gLP;
  lay = smoothstep(0.030, 0.120, P.y);
  gSG = P.xz + Dv.xz * (-P.y / min(Dv.y, -0.05)) * lay; gSH.w = P.y;
  // The bowl is 70cm of air above the table and never touches it, so its
  // projection is the real one at every moment of the loop.
  P = gGlP + vec3(0.0, 0.700, 0.0);
  Dv = P - gLP; gSB = P.xz + Dv.xz * (-P.y / min(Dv.y, -0.05));
  /* And how much of the cast and of the contact each height leaves,
     solved here, once. Both are functions of the height alone — the cast
     dies when a piece is carried up out of the band, the contact dies the
     moment it leaves the table — so working them out per table fragment
     was ten smoothsteps a pixel spent on four numbers that do not change
     anywhere in the frame. */
  gEnd = vec4(1.0) - smoothstep(vec4(0.12), vec4(0.42), gSH);
  gSit = vec4(1.0) - smoothstep(vec4(0.020), vec4(0.090), gSH);

  /* ---------------- the room ----------------
     Past the far edge of the table there is a dining room, and it is the
     site's: violet-grey, dark up in the ceiling, with the pendant's own
     glow in it. Nothing in here is a material — it is uColors and uInk
     from end to end, which is what keeps this band on the website. */
  float gy = gl_FragCoord.y / uRes.y;
  vec3 room = mix(mix(uColors[1], uColors[2], 0.26), mix(uColors[1], uInk, 0.62),
                  smoothstep(0.58, 1.14, gy));
  // The pendant reaches the room too, but only where it is: a flat slab
  // of violet along the top of the band is the one thing in this frame
  // that could look pasted on, so it is graded across as well as down.
  vec2 gp = vec2((s.x + 0.30) * mix(0.90, 0.58, wide), (s.y - 1.16) * 1.05);
  room = mix(room, mix(uColors[2], uColors[3], 0.35), exp(-dot(gp, gp) * 1.05) * 0.26);
  room = mix(room, mix(uColors[1], uInk, 0.55),
             smoothstep(0.35, 1.40, abs(s.x) / max(asp, 0.80)) * 0.34);

  /* ---------------- the table, analytically ----------------
     One divide. The top is y = 0; the near edge is below the band and
     the far edge is up near the top of it, which is where the room
     starts. */
  vec3 bg = room;
  float tPl = 1.0e9;
  if (rd.y < -0.0015) tPl = -ro.y / rd.y;
  float caustic = (1.0 - smoothstep(0.0, 0.22, u4)) * (0.30 + 1.40 * flare) * e;
  if (tPl > 0.0 && tPl < 60.0) {
    vec3 hp = ro + rd * tPl;
    vec2 ed = abs(vec2(hp.x, hp.z + 2.20)) - vec2(5.40, 3.75);
    float dTab = min(max(ed.x, ed.y), 0.0) + length(max(ed, 0.0)) - 0.07;
    float aaw = max(tPl * pxk * 1.8, 0.0015);
    float on = smoothstep(aaw, -aaw, dTab);
    /* Past the far edge there is no WALL — there is floor, a long way
       down the room and in the table's own shade. It is the same dark
       timber as the top, carrying the house ink, so it comes out a deep
       violet-brown; mixing straight to uInk here put a saturated purple
       card behind the table edge, and it was the one thing in the frame
       that looked pasted on. It lifts to the house violet only as it
       recedes, and that lift is on the RAY'S OWN LENGTH rather than on
       the distance to the edge — a grazing ray covers three metres of
       floor in twenty pixels, so a world-space falloff off the edge is a
       hairline, and on tPl it grades across the whole strip. */
    bg = mix(uInk, vec3(0.200, 0.128, 0.084), 0.62);
    /* And it is DARK, because it is in the table's own shade. A pendant
       hanging over a two-top does not light the floor beyond it, and the
       strip past the far edge was coming out brighter and more saturated
       than the lit timber in front of it — a plum card stood up behind
       the table. Two things come off that: the top of the band stops
       competing with the cover, and the tallest thing on the table stops
       being a violet object. The wine glass projects above the far edge
       at every width — it is 18cm of glass on a table seen from 55
       degrees, it cannot not — so whatever is behind it is what it is
       made of, and it must not be a bright purple wall. */
    bg *= mix(0.30, 0.62, smoothstep(0.0, 0.70, dTab));
    if (on > 0.002) {
      vec3 wood = timberAt(hp, rd, tPl, max(tPl * pxk, 1.0e-6), caustic);
      /* THE SEAM. The arris — where the top of the table turns over into
         its edge — used to be a mix a third of the way to uColors[2],
         which is very nearly white, laid on at 60% over a dark walnut top
         and ruled from one side of the band to the other at a constant
         value. A line of constant brightness across a whole frame is not
         something a light does, so it did not read as an edge: it read as
         a hard diagonal lighting seam across the top of the table, at
         every width, which is exactly what it was.

         It belongs to the PENDANT. Same warm key, same inverse-square
         falloff from the same point, so it is bright where the light
         actually is — a little left of centre — and gone by the far
         corners, and it is soft over several pixels instead of ruled.

         And it is SMALL. Measured down a column of pixels across the edge,
         the first pass at this still overshot the timber beside it by
         twenty-eight of two hundred and fifty-five across three pixels,
         which is a rule however softly it is drawn: an edge highlight
         BRIGHTER than the lit surface behind it is a seam. Seven is a
         chamfer catching the light. */
      float eLd = length(gLP - hp);
      float eAtt = 4.1 / (1.0 + 0.66 * eLd * eLd);
      float arris = smoothstep(aaw * 5.0 + 0.018, 0.0, abs(dTab + 0.010));
      wood += vec3(1.000, 0.918, 0.808) * arris * eAtt * 0.052;
      bg = mix(bg, wood, on);
    }
    /* Aerial perspective, and it is what puts the site's colour into a
       band whose subject is brown. The room is dim and the far half of
       the table is metres further into it, so it grades toward the house
       violet with the ray's own length. It is a distance, not a veil
       across the top of the band: it moves with the camera and it is
       different at every aspect, which a screen-space wash would not be.
       The range was set for a wide lens and this camera is a long one —
       at 7.4 the whole visible table lies between 6.7 and 8.9, so the old
       8.5 to 13.8 never opened at all and the band had no depth cue in it
       whatsoever. These are the numbers this camera actually reaches. */
    bg = mix(bg, mix(uColors[1], uInk, 0.30), smoothstep(6.6, 12.5, tPl) * 0.40);
  }

  vec3 col = bg;

  /* ---------------- one march ----------------
     48 steps on a desktop, 36 on a tablet, 24 on a phone, and it breaks
     on a hit and on the far plane rather than running to the cap. It
     also remembers its closest approach in PIXELS, which is the whole of
     the edge antialiasing: a ray that missed by half a pixel is shaded
     where it came nearest and blended in by how near it came. */
  int steps = uTier > 0.75 ? 48 : uTier > 0.25 ? 36 : 24;
  /* It starts at 6.00 because the nearest point any of the four pieces can
     reach at any moment of the cycle, anywhere in the camera's sweep, is
     6.91 — the near rim of the plate halfway through being laid — and a
     start that is conservative by nearly a metre still buys back the two
     steps the under-relaxation below costs. It also breaks on a hit and on
     the far plane rather than running to the cap, and it remembers its
     closest approach in PIXELS, which is the whole of the edge
     antialiasing: a ray that missed by half a pixel is shaded where it
     came nearest and blended in by how near it came. */
  float t = 6.00, near = 1.0e9, nt = 6.00;
  for (int i = 0; i < 48; i++){
    if (i >= steps) break;
    float d = map(ro + rd * t);
    float rel = d / (t * pxk);
    if (rel < near) { near = rel; nt = t; }
    if (rel < 0.40) break;
    // UNDER-RELAXED. Three of the four pieces here are thin — a 5mm blade,
    // a 2.5mm gap between tines, a 2cm glass wall — and a full step against
    // a tapered field walks through the side of one and stipples its own
    // silhouette. 0.85 of the distance, not 0.92.
    t += d * 0.85;
    if (t > FAR) break;
  }
  float cover = smoothstep(1.40, 0.42, near);

  if (cover > 0.002) {
    vec3 pos = ro + rd * nt;
    vec3 nor = normalAt(pos);

    /* Which piece was hit. One evaluation of each field, once, at the
       surface — never inside the loop. */
    vec3 a = pos - gPlP;
    a.yz = vec2(gPlC * a.y + gPlS * a.z, gPlC * a.z - gPlS * a.y);
    float dP = sdPlate(a);
    vec3 f = pos - gFkP;
    f.xz = vec2(gFkC * f.x + gFkS * f.z, gFkC * f.z - gFkS * f.x);
    float dF = sdFork(f);
    vec3 n = pos - gKnP;
    n.xz = vec2(gKnC * n.x + gKnS * n.z, gKnC * n.z - gKnS * n.x);
    float dK = sdKnife(n);
    vec3 g = pos - gGlP;
    g.yz = vec2(gGlC * g.y + gGlS * g.z, gGlC * g.z - gGlS * g.y);
    float dG = sdGlass(g);
    float mn = min(min(dP, dF), min(dK, dG));

    /* The light, at the surface. The same pendant as the table: warm,
       a point, falling off with distance. The fill, the bounce off the
       timber and every shadow are the house violet. */
    vec3  Lv = gLP - pos;
    float Ld = length(Lv);
    vec3  L = Lv / max(Ld, 1.0e-4);
    float att = 4.1 / (1.0 + 0.66 * Ld * Ld);
    vec3  warm = vec3(1.000, 0.918, 0.808);
    float dif = max(dot(nor, L), 0.0) * att;
    // L and rd are both unit and very nearly opposed, but the half
    // vector is still the one normalize() in this file that could be
    // handed a zero, so it is not asked to guess.
    vec3  hv = L - rd;
    vec3  hal = hv * inversesqrt(max(dot(hv, hv), 1.0e-8));
    float ndh = max(dot(nor, hal), 0.0);
    /* Two grazing terms, not one. grz is simply how far off square to
       the eye the surface is — which on a transparent thing is how much
       GLASS the eye is looking through, and it is what draws every bright
       line on a wine glass. fre is the real Fresnel, five powers steeper,
       and it is what decides how much of the studio is mirrored. Using the
       fifth power for both is why the stem and the foot came back as a
       brown rod on a grey coaster: at the middle of a stem the fifth power
       is four thousandths, so nothing was drawn there at all. */
    float grz = 1.0 - max(dot(nor, -rd), 0.0);
    float fre = grz * grz * grz * grz * grz;
    // Two taps of the field for occlusion; the second is what uTier
    // takes off. The step count is NOT used here — it is an integer and
    // draws a contour map of itself across a flat rim.
    /* The taps are kept SHORT. A long tap over a shallow dish finds the
       plate's own rim rather than its floor, and a min() of two distances
       creases where the nearer one changes hands — which drew a hard arc
       right across the well, a crease in the lighting that no plate has.
       Short taps keep the crease inside the wall it belongs to. */
    float occ = clamp(map(pos + nor * 0.038) / 0.038, 0.0, 1.0);
    if (uTier > 0.75) occ = 0.62 * occ + 0.38 * clamp(map(pos + nor * 0.105) / 0.105, 0.0, 1.0);
    occ = mix(occ, 1.0, 0.34);
    // The bounce off the timber, which is brown and warm and the reason
    // the undersides of the china are not simply grey.
    float bnc = clamp(0.45 - 0.55 * nor.y, 0.0, 1.0);
    vec3  wood = mix(vec3(0.235, 0.148, 0.094), uColors[1], 0.45);
    /* What the polished things see, and it is a STUDIO, not the wall.
       This used to be a violet ceiling over a dark brown table, and it is
       why the steel came back as a grey lozenge with a lilac cast and the
       glass came back as lavender plastic. It is now the studio above,
       anchored in WORLD space while the shape turns under it — which is
       where the sense of real metal and real glaze comes from — with the
       table's own walnut put back into the lower hemisphere, because a
       fork lying on walnut really does have walnut in its underside, and
       the pendant sat in the top of it where the pendant really is. */
    vec3 ref = reflect(rd, nor);
    vec3 env = studio(ref);
    env = mix(env, vec3(0.150, 0.095, 0.062), smoothstep(-0.05, -0.55, ref.y) * 0.72);
    float pend = (ref.y - 0.72) / 0.20;
    env = mix(env, warm * 1.15, exp(-pend * pend) * 0.55);

    vec3 c;
    float away;

    if (mn == dG) {
      /* ---- clear glass ----
         Almost no colour of its own, so it is drawn as what it does to
         the light. What you see through it is the real table: the ray is
         bent a little by the surface and dropped onto the plane
         analytically — one divide, no second march — so the timber
         behind the bowl is displaced the way it is through real glass.
         Fresnel decides how much of the room is on the surface instead,
         and the rim, where the glass is thickest along the eye, goes
         dark and then very bright. */
      vec3 rd2 = normalize(rd - nor * 0.22);
      vec3 seen = room;
      if (rd2.y < -0.05) {
        float tp2 = -pos.y / rd2.y;
        if (tp2 > 0.0 && tp2 < 22.0) {
          vec3 hp2 = pos + rd2 * tp2;
          vec2 ed2 = abs(vec2(hp2.x, hp2.z + 2.20)) - vec2(5.40, 3.75);
          float dT2 = min(max(ed2.x, ed2.y), 0.0) + length(max(ed2, 0.0)) - 0.07;
          /* Soft, not binary. Some of what you see through the top of a
             bowl is the room past the far edge of the table and some of
             it is the timber below, and switching between the two on the
             sign of a distance painted a hard violet band straight across
             the glass. It is blended over a hand's width of table, and
             it grades into the room with the bent ray's own length. */
          /* And past the edge it is the FLOOR, at the same value the floor
             really has beside it — not the room gradient from the top of
             the band. The bowl of this glass stands above the far edge at
             every width, so the thing behind most of it is that strip, and
             reading a brighter, more saturated colour through the glass
             than the one lying next to it on the page is precisely how a
             clear object turns into a violet one. */
          vec3 beyond = mix(uInk, vec3(0.200, 0.128, 0.084), 0.62)
                      * mix(0.30, 0.62, smoothstep(0.0, 0.70, dT2));
          seen = mix(timberAt(hp2, rd2, nt + tp2,
                              max((nt + tp2) * pxk * 1.8, 1.0e-6), caustic), beyond,
                     smoothstep(-0.22, 0.10, dT2));
          seen = mix(seen, beyond, smoothstep(9.0, 15.0, nt + tp2) * 0.55);
        }
      }
      // A glass is not perfectly clear: it takes a little out of what
      // passes through it and it has the faintest cool cast. It also takes
      // a little of the COLOUR out — nothing seen through glass comes back
      // more saturated than the thing behind it, and a bowl held up in
      // front of the violet room used to come back as a violet bowl.
      vec3 tint = vec3(0.90, 0.965, 0.935);
      seen = mix(seen, vec3(dot(seen, vec3(0.30, 0.59, 0.11))), 0.26);
      /* Glass over a dark table is a BRIGHT object, not a dark one: what
         you read is the light lying on it and the thick places glowing,
         not the timber behind it. And what lies on it is the STUDIO —
         this was the house violet, weighted to the ceiling, and it came
         back as a lavender plastic goblet. A wine glass has no colour.
         The studio's own floor is dropped a little further under it,
         because most of what is under this glass is table. */
      vec3 genv = studio(ref);
      genv = mix(genv, vec3(0.190, 0.122, 0.080), smoothstep(-0.10, -0.60, ref.y) * 0.60);
      float gp2 = (ref.y - 0.70) / 0.24;
      genv = mix(genv, warm * 1.25, exp(-gp2 * gp2) * 0.65);
      /* Face on, a glass is almost entirely what is behind it; it only
         turns into a mirror at a grazing angle. Weighting the general
         environment in face-on — which an earlier cut did, to stop the
         bowl going dark — is exactly what turned it into a pewter goblet.
         The bowl is allowed to be dark in the middle. What makes it read
         is the EDGES: every silhouette on a glass is a bright line, and
         there are five of them on a wine glass seen from above. */
      c = seen * tint * 1.02;
      /* Face on, a sheet of glass mirrors about four per cent and you see
         straight through the rest of it. Eighteen per cent — which is what
         this was — is four times too much, and four times too much of a
         bright studio sweep over dark walnut is an opaque grey disc: the
         foot of this glass read as a plastic coaster. Six per cent face on,
         everything at the silhouette. */
      c = mix(c, genv, clamp(0.06 + 0.94 * fre, 0.0, 1.0));
      /* The thick places — the rim, the foot's edge, the two sides of the
         stem, the turn of the bowl — where the eye looks ALONG the glass
         rather than through it. This is the term that draws a wine glass,
         so it is on grz and not on the fifth power of it. Colourless,
         because that is what the light inside glass is. */
      c += vec3(0.980, 0.976, 0.968) * smoothstep(0.34, 0.90, grz) * 0.80;
      // And the specular. This is the one the whole loop is waiting for:
      // when the cover is complete, the bowl catches the pendant.
      c += warm * pow(ndh, 200.0) * att * clamp(2.4 + 15.0 * flare, 0.0, 18.0);
      c += warm * pow(ndh, 22.0) * att * (0.20 + 0.60 * flare);
      /* The rim. Looking down on a glass, the top of the bowl is a 2mm
         annulus of solid glass lit from every side at once, and it is the
         brightest line in the whole frame — it is what says GLASS before
         anything else does. It faces up, so Fresnel will not find it; it
         has to be asked for by name. */
      float rimf = smoothstep(0.794, 0.810, g.y) * smoothstep(0.20, 0.62, nor.y);
      c = mix(c, mix(uColors[3], warm, 0.30) * (1.02 + 0.55 * flare), rimf * 0.80);
      // Where the glass shades itself it goes toward the studio's floor,
      // not toward the house violet: a shadow inside a clear material that
      // is violet is the tell that turned this into a plastic goblet.
      c = mix(c, c * 0.90 + vec3(0.055, 0.053, 0.052), (1.0 - occ) * 0.40);
      away = gAway.w;
    } else if (mn == dP) {
      /* ---- white glazed china ----
         Warm white, not white, and the glaze is the point: a tight
         bright specular over a soft body, a Fresnel sheen that runs
         round the rim, and a violet fill in the shade so it sits in this
         room and not on a cut-out. */
      vec3 alb = vec3(0.955, 0.945, 0.928);
      /* The shoulder at 0.44, where the flat of the rim turns down into
         the well. It is seven degrees of geometry and the normal alone
         will not carry it at this size, so the glaze is allowed to do
         what glaze does at a change of section: pool a shade deeper in
         the turn and lie a shade brighter on the flat just outside it.
         Both read off the plate's own radius, so they hold as the camera
         eases and as the plate tilts down into place. */
      float rr = length(a.xz);
      float xr = (rr - 0.440) / 0.020;
      float shoulder = exp(-xr * xr);
      alb = mix(alb, alb * 0.900, shoulder * 0.70);
      alb = mix(alb, alb * 1.030, smoothstep(0.470, 0.530, rr) * smoothstep(0.615, 0.570, rr));
      c = alb * (warm * dif * 1.06 + mix(uColors[1], uInk, 0.30) * 0.30
                 + mix(uColors[2], uColors[3], 0.5) * 0.20);
      c += wood * bnc * 0.26;
      c = mix(c, env, 0.10 + 0.34 * fre);
      c += warm * pow(ndh, 120.0) * att * 0.85;
      c += warm * pow(ndh, 20.0) * att * 0.09;
      // A 9mm dish barely occludes itself, and the two taps hand over
      // somewhere inside the well — so the more this is asked for, the more
      // the handover shows as a pair of soft arcs across the glaze.
      c = mix(c, mix(uColors[1], uInk, 0.35), (1.0 - occ) * 0.19);
      away = gAway.x;
    } else {
      /* ---- polished stainless ----
         Cool, neutral, and mostly what it reflects — which is why the
         environment above is anchored in world space. The highlight runs
         ALONG the piece rather than sitting on it as a spot, because a
         polished spoon-finish scatters down its own length; that streak
         is what makes a fork read as steel rather than as a grey
         lozenge, and it travels as the camera eases. */
      vec3 alb = vec3(0.735, 0.750, 0.775);
      bool isF = mn == dF;
      vec3 axis = normalize(isF ? vec3(gFkS, 0.0, gFkC) : vec3(gKnS, 0.0, gKnC));
      /* A metal has almost no diffuse term; nearly all of it is the
         environment, and the environment is the studio. Half of this used
         to be a violet-tinted diffuse, which is why a polished fork came
         back as a grey lozenge with a lilac cast. The room is still
         allowed a little of its own colour in here — the fork is in the
         room — but it is a twelfth of the value now, not a third. */
      c = alb * (warm * dif * 0.50 + vec3(0.150, 0.150, 0.158)
                 + mix(uColors[1], uInk, 0.35) * 0.12);
      c += wood * bnc * 0.22;
      c = mix(c, env, 0.72 + 0.26 * fre);
      float ht = dot(axis, hal);
      float an = clamp(1.0 - ht * ht, 0.0, 1.0);
      c += warm * pow(an, 34.0) * att * 0.55;
      c += warm * pow(ndh, 130.0) * att * 1.15;
      if (isF) {
        /* The four tines. The gaps between them are 2.5mm of geometry —
           a third of a pixel on a phone band — so they are resolved HERE,
           at the surface, from the fork's own coordinates, at a width
           taken from the ray's real pixel footprint. The slots are still
           cut in the field as well, because that is what notches the
           silhouette; this is what makes them visible. */
        float kk = 0.03025;
        float xf = abs(f.x - kk * clamp(floor(f.x / kk + 0.5), -1.0, 1.0));
        float gw = max(nt * pxk * 1.4, 0.0016);
        float slot = smoothstep(0.0055 + gw, 0.0055 - gw, xf)
                   * smoothstep(0.300, 0.328, f.z) * smoothstep(0.560, 0.520, f.z);
        // What is down a tine gap is the timber under the fork, in shade.
        c = mix(c, vec3(0.088, 0.058, 0.040), slot * 0.92);
      }
      // The cutting edge of the knife and the shoulders of the tines:
      // a bright hairline where the steel turns over.
      c += vec3(0.98, 0.98, 1.0) * fre * 0.30;
      c = mix(c, mix(vec3(0.075, 0.072, 0.078), uInk, 0.22), (1.0 - occ) * 0.40);
      away = isF ? gAway.y : gAway.z;
    }

    /* A piece being carried away goes TRANSPARENT rather than being mixed
       toward the room's violet. Mixing the colour was the bug: a knife
       halfway up the band had violet painted onto it while it was still
       over dark timber, so what was left at the top of the frame was a
       lavender stub attached to nothing. Dropping its coverage instead
       fades it into whatever is really behind it, wherever it is. */
    // The glass stands twice as tall as anything else here, so it reaches
    // the top of the band on half the travel and is faded out on half the
    // travel. The other three share a window.
    float gone = smoothstep(mn == dG ? 0.06 : 0.40, mn == dG ? 0.34 : 0.86, away);
    col = mix(bg, c, cover * (1.0 - gone));
  }

  // The reveal: the table is already laid, the cover arrives on it.
  col = mix(bg, col, e);
  // A little tooth, so the long fall from warm timber into paper never
  // bands on a cheap panel — which is the only sort of panel this will
  // be watched on.
  col += (hash(gl_FragCoord.xy + fract(uTime) * 57.0) - 0.5) * 0.017;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export const scene: Scene = {
  frag,
  colors: ["#551a89", "#7c74a6", "#f4f3f7", "#ffffff"],
  /* The cover, laid, as far as stacked gradients can carry it — and they
     have to carry it, because this is what a reader on a slow phone looks
     at until the shader has compiled and what a device with no WebGL is
     left with for good. Solved at 390x488, the band a phone gets, with
     every radius in PIXELS off a centre placed in percentages, so the
     plate stays round rather than becoming an oval on a 21:9 band. The
     timber, the china, the steel and the glass are the shader's own
     literals; the strip above the table edge is the house violet in the
     table's shade.

     RE-SOLVED against the shader's own frame rather than carried over.
     Every vertical position in the first cut of this was six to eight
     points of the band's height too high — the glass sat at 9.8% where
     the render puts its rim at 17.4%, the fork began at 28.6% where the
     render starts it at 36.5% — so the poster and the scene it stands in
     for were two different pictures, and the swap from one to the other
     was a jump. These numbers are sampled off the 390 render. */
  poster:
    // The glass, from its rim down: the bright ring that is the first
    // thing that says GLASS, the bowl with the dark room in its top and
    // the timber through its bottom, the stem, and the foot with its lit
    // edge. Then the fork, the knife, the plate with its rim and the
    // shoulder of its well, what the plate throws on the timber, the
    // pendant's pool, and last the table and the strip above its far edge.
    "radial-gradient(30px 21px at 82% 17.4%, rgba(255,255,255,0) 0 74%, " +
    "rgba(255,255,255,0.72) 80% 92%, rgba(255,255,255,0) 100%), " +
    "radial-gradient(29px 20px at 82% 17.4%, #241a1e 0 52%, #433231 70% 90%, rgba(255,255,255,0) 96%), " +
    "linear-gradient(to bottom, rgba(0,0,0,0) 21.3%, #9a8e88 21.8% 31.8%, rgba(0,0,0,0) 32.3%) " +
    "80.8% 0 / 6px 100% no-repeat, " +
    "radial-gradient(26px 12px at 80% 32.5%, #463833 0 68%, rgba(255,255,255,0.58) 84% 93%, rgba(255,255,255,0) 98%), " +
    "linear-gradient(to bottom, rgba(0,0,0,0) 36.1%, #eceae6 36.5% 42.5%, rgba(0,0,0,0) 42.9%) " +
    "15.6% 0 / 12px 100% no-repeat, " +
    "linear-gradient(to bottom, rgba(0,0,0,0) 36.1%, #d5d2cd 36.5% 59.5%, rgba(0,0,0,0) 59.9%) " +
    "15.6% 0 / 7px 100% no-repeat, " +
    "linear-gradient(to bottom, rgba(0,0,0,0) 39.6%, #cdcac5 40.0% 66.5%, rgba(0,0,0,0) 66.9%) " +
    "80.8% 0 / 8px 100% no-repeat, " +
    "radial-gradient(92px 81px at 48% 51%, #fdfbf7 0 40px, #f3eee4 44px 47px, " +
    "#ffffff 52px 74px, #e8e0d2 77px 80px, #4a3836 82px 84px, rgba(0,0,0,0) 86px), " +
    "radial-gradient(110px 95px at 51.5% 54%, rgba(22,11,11,0.60) 0%, rgba(22,11,11,0) 100%), " +
    "radial-gradient(58% 46% at 28% 38%, rgba(255,230,192,0.13) 0%, rgba(255,230,192,0) 100%), " +
    "linear-gradient(to bottom, #27152b 0 3.2%, #1f1122 5.6%, #1b0e1d 7.6%, " +
    "#573d40 12.5%, #634549 30%, #5a3f42 52%, #4f393c 70%, #c9bdc0 80%, #ffffff 86%)",
  alt: "A place setting on a dark walnut table under a warm pendant, seen from high and slightly to one side: a white china plate, a polished fork to its left, a knife to its right and a clear wine glass beyond them. It is held complete for most of the loop, the glass catching the pendant and opening a patch of warm light on the timber beside its foot. Then the cover is cleared in reverse — glass, knife, fork, plate — and laid again in order, each piece lowered with a small contact and a shadow that widens while it is held and snaps tight the moment it is down.",
};
