import type { Scene } from "../shader-stage";

/* ------------------------------------------------------------------ *
 * Veterinary — the collar on the counter, and the tag someone spun.
 *
 * The page's argument is that this trade's caller is a bystander
 * describing a patient who cannot speak. So the object is the one thing
 * in the building that DOES speak for the patient: the tag with a name
 * and a number cut into it, off its ring and lying on the front-desk
 * counter, spun by somebody waiting.
 *
 *   the object   a tan leather collar lying in a slow curve across the
 *                counter — pebbled grain, a cream linen stitch running
 *                its whole length, BUCKLED through a steel buckle — and
 *                a warm brass disc lying loose in front of it with a
 *                name and a number engraved into its face.
 *
 *                Buckled, and that word is the geometry. A buckle frame
 *                is a closed rectangle; leather does not sit on one, it
 *                goes THROUGH it. So the tail runs under the whole frame
 *                and is visible through the window, the frame's plane
 *                rests on top of the tail rather than half sunk in it,
 *                the doubled end climbs over the frame and wraps the
 *                centre bar, and the tongue is hinged on that bar and
 *                goes through a hole punched clean through the tail —
 *                subtracted from the strap, not drawn on it, so a ray
 *                gets INSIDE the punch and its wall can be seen going
 *                down into the dark. The tongue bends where the lip is
 *                and follows it down; the point ends half a millimetre
 *                off the counter with the whole thickness of the hide
 *                closed round the shaft above it. You cannot see out
 *                the bottom of it and you should not be able to: a
 *                four-millimetre hole through four millimetres of
 *                leather is shut to a camera thirty-one degrees off the
 *                counter, and what reads as a hole is the near wall
 *                falling away, not daylight underneath.
 *
 *                AND IT IS LYING ON SOMETHING. The strap is in contact
 *                with the stone along its whole length — its underside
 *                is on y = 0 from one edge of the frame to the other —
 *                so the mark it leaves runs the whole length with it:
 *                a seam that is nearly black where the two meet and
 *                opens over a centimetre, with the cast sliver leaning
 *                it toward the lens. It is the darkest thing in the
 *                frame, and it is written off the distance from the
 *                strap's own footprint, so it is the same mark on a
 *                phone as on a monitor.
 *
 *   the motion   THE TAG SPINS AND COMES TO REST. It is flicked at the
 *                top of the loop and goes round nine times: fast enough
 *                at first that every mark on its face smears into a
 *                plain ring of brass, then slowing, then tipping onto
 *                its rim and rattling the way a dropped coin does — the
 *                contact point racing round the edge faster and faster
 *                as the lean comes off it — and finally flat and still,
 *                the engraving readable, for four and a half seconds.
 *                Then the flick again.
 *
 *                The blur is not a post effect and it is not a cheat. A
 *                disc turning about its own axis has a silhouette that
 *                does not change, so no GEOMETRY needs to smear; what
 *                smears is the detail on the face, and the angular
 *                average of a mark at radius r is a ring at radius r. So
 *                every mark on this tag is drawn twice — once where it
 *                is and once as the ring it becomes — and crossfaded by
 *                the tag's real angular speed. It is also why the tag
 *                has no drilled hole in its geometry: a hole is the one
 *                feature that CANNOT smear, and a razor-sharp hole next
 *                to engraving that has smeared to nothing is the tell.
 *                The hole is a mark on the face like the rest of them,
 *                and it smears into its own faint ring with them.
 *
 *   the camera   close and low over the counter — thirty-one degrees off
 *                the surface, an arm's length from the tag — and ALMOST
 *                STILL: two degrees of azimuth on one sine over the
 *                eleven-second cycle, so the loop closes on itself, and
 *                a few degrees more if a pointer leans it.
 *
 * COLOUR, and the rule that changed. The counter, the light pooled on
 * it, the haze at the back and the tint inside every shadow are uColors
 * and uInk — the house palette, which is what keeps sixteen bands
 * reading as one website. The OBJECT is its own, and it is three real
 * materials — plus the thread stitched into the first of them, which is
 * a colour a hide does not have:
 *
 *     LEATHER  #663f21  tan bridle hide, pebbled, with a burnished edge.
 *     THREAD   #a89974  the cream linen saddle stitch down both sides.
 *     BRASS    #e0af57  the tag. Warm, and the only gold in the frame.
 *     STEEL    #90949c  the buckle, its centre bar and its prong.
 *
 * AND WHAT THE METAL SEES IS A STUDIO. Brass and steel have almost no
 * colour of their own — they are whatever is around them — so pointing
 * them at a violet counter is how brass renders as a lilac biscuit. Both
 * sample a NEUTRAL studio instead: a dark floor, a bright overhead
 * sweep, one warm key up and to the left and one cool fill off to the
 * right, exactly as a still-life photographer would light them. The
 * counter behind them stays the house palette. Brass reads as brass or
 * it reads as plastic; there is no third option.
 *
 * WHAT IT COSTS. The counter is not marched — it is one ray/plane
 * intersection, and every shadow on it is PROJECTED rather than traced:
 * a flat ribbon lying on a circular arc throws its own arc, translated
 * along the light, and a tilted disc throws an exact ellipse, which is
 * four lines once the component along its normal is dropped. Only the
 * collar and the tag are marched, once per fragment, breaking on a hit
 * and on the nearer of the far plane and the counter — so the bottom
 * half of the band, which is bare counter, never marches at all.
 *
 * The contact under the strap is the same arithmetic and not a ray: the
 * distance from the strap's footprint is one length() the counter has
 * already taken, and both falloffs off it are an exp(). It costs nothing,
 * it cannot be a different mark on a different device because there is no
 * tier and no pixel footprint anywhere in it, and it runs the whole length
 * of the collar because the footprint does.
 *
 * The field is guarded by two bounds, both far looser than the things
 * inside them and neither EVER handed back below 0.30: a sphere of 0.78
 * round a buckle that reaches 0.484 — the bent tongue's point is 0.181,
 * well inside it — and one of 0.58 round a tag that
 * reaches 0.401. 0.30 is not an epsilon — it is further than the
 * furthest occlusion tap, because those ask the field about points
 * floating off a surface and a bound answers them with the distance to
 * the BOUND, which is shorter, and that draws a dark collar round
 * everything it guards.
 *
 * Every primitive here is exact or understates: a revolved rounded box
 * for the strap and for the tag, rounded boxes for the buckle, max()
 * against slabs to cut them to length. TWO of them cannot be, and both
 * are handled rather than hoped about. The doubled end is displaced
 * vertically as it climbs the buckle, which makes its field up to 1.18
 * times LONGER than the truth, so it is handed back at 0.84. And the
 * punched hole is a subtraction, the one operation that can overstate
 * outright — inside the punch the field would claim the radius while a
 * wall of leather is a hundredth away — so its reach is capped at 0.030,
 * which is less than a third of the strap's thickness and therefore
 * cannot be stepped through. An exact field cannot be stepped through
 * either — but the strap is under four millimetres thick and the buckle
 * plate is two and a half, so the march still advances by 0.85 of the
 * distance rather than all of it, and it converges to a PIXEL rather than
 * to a fixed epsilon, which is both the antialiasing and the reason a
 * thin edge does not stipple itself.
 *
 *   uTier 1.0  desktop  48 march steps, one 16-step shadow ray, two
 *                       occlusion taps, two grades of leather grain
 *   uTier 0.5  tablet   36 steps, no shadow ray, two occlusion taps
 *   uTier 0.0  phone    24 steps, no shadow ray, one occlusion tap
 *
 * The tier buys rays and taps. It never buys the subject: the collar,
 * the buckle, the stitching, the tag, the engraving and the spin are on
 * every device, because a phone that gets a different picture is a bug.
 *
 * FRAMING, solved by sweeping rather than by eye — every rim point of
 * the tag at forty moments of the cycle, every corner of the buckle and
 * its prong, and the strap's two edges along its whole length, at the
 * four corners of the pointer's range, at 4:5, 16:10 and 21:9:
 *
 *                       4:5            16:10           21:9      limit
 *     object x   -0.66..+0.48   -0.47..+0.89   -0.38..+1.15      ±asp
 *     tag    gy   0.399..0.688   0.395..0.739   0.383..0.771
 *
 * Nothing is cropped at any width, at any moment, wherever the pointer
 * is — and that survived the buckle being threaded rather than laid on,
 * which is the one change that made the object TALLER. Buckled, the
 * stack at the buckle is leather, frame and leather again: 0.254 above
 * the counter against 0.122 before it, ten millimetres, which is what a
 * fastened collar really measures there. The crest of the collar still
 * clears the top of the band by a tenth of its height at 21:9, where the
 * band is shallowest, at both ends of the pointer's range. The strap
 * runs off BOTH side edges at all three, so the collar is a length of
 * collar rather than a loop with its ends showing. The tag
 * never falls below 0.38 of the band height, which is clear of the
 * bottom third the harness cuts to paper for the kicker and clear of the
 * band's own scrim over it. On a long band the whole thing moves right,
 * which leaves the kicker the open left. And the nearest the collar ever
 * comes to the lens is 2.43, which is why the march can start at 1.80
 * and skip the empty foreground entirely.
 * ------------------------------------------------------------------ */

const frag = `
#define TAU 6.28318531

/* ---- the clock ---- */
const float T_CYC = 11.0;   /* seconds, flick to flick                   */
const float SPIN  = 0.59;   /* the share of it the tag is still moving   */
const float TURNS = 9.0;    /* whole turns — an INTEGER, so the tag ends
                               the cycle in the orientation it starts the
                               next one in, and the only thing the seam
                               changes is the SPEED, which is what a
                               flick is                                  */
const float PREC  = 9.0;    /* whole turns of the rattle's contact point */
const float AMAX  = 0.44;   /* how far it leans at the worst of it       */
const float PH0   = 0.55;   /* where a reader arriving at t=0 comes in   */

/* ---- the collar, in units of 40mm ---- */
const float CZ   = 4.60;    /* the arc the strap lies on: centre in xz   */
const float RR   = 4.90;    /* and radius. A slow curve, not a loop.     */
const float SW   = 0.315;   /* half the strap's width — 25mm of collar   */
const float SH   = 0.048;   /* half its thickness — 3.8mm of bridle hide */
const float SY   = 0.048;   /* so the underside sits exactly on y = 0    */
const float BX   = -0.62;   /* where the buckle sits, along x            */
/* ---- and how the buckle is THREADED onto it ----
   The frame is a closed rectangle: the only way leather gets past it is
   through it. So the tail lies UNDER the whole frame — which means the
   frame's plane has to clear the top of the strap rather than sit half
   sunk in it — the doubled end comes over the top and wraps the centre
   bar, and the tongue drops through a hole punched clean through the
   tail. Every number below is what makes those three things true at
   once, and they are all measured off the strap: the leather runs from
   y = 0 to y = 0.096, and nothing may be put inside that. */
const float BKY  = 0.128;   /* the frame's plane. Its underside lands at
                               0.098, two thousandths off the leather —
                               resting on it, not buried in it           */
const float FLFT = 0.132;   /* how far the doubled end climbs to pass
                               OVER the frame and the centre bar: its
                               underside ends up at 0.166, clear of the
                               frame's top at 0.158                      */
const float HOLX = -0.105;  /* the punched hole, along the strap from the
                               buckle's centre. NEGATIVE, and that is the
                               one thing here chosen by the light rather
                               than by the leather: the key stands off to
                               -x, so the window has to be the one it can
                               see into. Put the doubled end on that side
                               instead and it towers over the window — it
                               is the tallest thing in the scene — and the
                               tongue, the hole and the tail under the
                               frame all disappear into its shadow       */
const float HOLR = 0.047;   /* a 3.8mm punch                             */
/* ---- the tongue, and why it is BENT ----
   It is hinged on the centre bar, whose axis is 32 thousandths above the
   top of the tail. A straight prong cannot do this job, and the arithmetic
   says so: leaving the bar at any angle steep enough to carry its point
   down through four millimetres of hide, it buries its own underside in
   solid leather long BEFORE it reaches the punch — at twenty-five degrees
   it is inside the tail at 0.031 along, and the hole does not begin until
   0.058. Fifteen degrees is the shallowest line whose underside first
   touches the tail exactly at the near lip of the hole, which is why the
   hole is where it is. But fifteen degrees also only ever grazes the
   surface — at the length it could be given it ended two tenths of a
   millimetre below the top of the leather — and what that draws is a prong
   lying ACROSS a punch it never enters, with the punch itself sealed under
   the flat of it. Not one ray in the frame reached the hole.
   So it leaves the bar at fifteen and turns down at sixty where the lip
   is: the only way a point gets through four millimetres of leather inside
   a hole four millimetres across. */
const float PC   = 0.9659;  /* the shank, fifteen degrees off the bar    */
const float PS   = 0.2588;
const float QC   = 0.5000;  /* the bend, sixty degrees into the punch    */
const float QS   = 0.8660;
const float TBX  = -0.0724; /* and where the two meet: the near lip      */
const float TBY  = -0.0194;
const float TAGR = 0.400;   /* the tag: a 32mm disc                      */
const float TAGH = 0.030;
const float TAGD = 0.018;   /* and the roll on its rim                   */
const float TAGX = 0.34;
const float TAGZ = 0.78;

/* ---- three materials, and not one of them is violet ---- */
const vec3 LEATHER = vec3(0.400, 0.248, 0.132);   /* tan bridle hide     */
const vec3 THREAD  = vec3(0.660, 0.600, 0.455);   /* cream linen stitch  */
const vec3 BRASS   = vec3(0.880, 0.686, 0.340);   /* the tag             */
const vec3 STEEL   = vec3(0.565, 0.580, 0.610);   /* the buckle          */

/* ---- the state, resolved once per fragment. Globals rather than
   arguments: map() runs fifty-odd times a pixel and none of this changes
   between calls. ---- */
vec3  gTagP, gTagN;   mat3 gTagM, gTagR;   /* centre, normal, both frames */
float gBlur;                               /* 0 sharp .. 1 fully smeared  */
vec3  gBuckP;         mat3 gBuckM;
vec3  gTan;                                /* along the strap, at the buckle */
vec3  gKey, gFil;                          /* the two lights              */

float h11(float n){
  n = fract(n * 0.1031);
  n *= n + 33.33;
  n *= n + n;
  return fract(n);
}
float h21(vec2 p){
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x),
             mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
}

/* ---- primitives. Exact wherever they can be — an exact field cannot be
   stepped THROUGH, which is the only reason a three-millimetre strap
   survives 24 steps — and where the threading makes that impossible, at
   the doubled end's climb and at the punched hole, the error is bounded
   and paid for on the spot rather than left to the march to discover. */
float box2(vec2 p, vec2 b, float r){
  vec2 d = abs(p) - b + r;
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - r;
}
float sdRBox(vec3 p, vec3 b, float r){
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}
/* Understates the distance, which is the safe direction: a march that
   steps short is slow, a march that steps long is a hole through a part. */
float smin(float a, float b, float k){
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
mat3 rotY(float a){ float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 rotX(float a){ float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }

/* ---- the strap ----
   A rounded rectangle revolved about a vertical axis 4.9 out in z. The
   revolution of a convex 2D profile that never crosses its own axis is
   EXACT — the 3D distance is the 2D distance from (radius, height) to
   the profile — which is what makes a curved leather strap cost one
   length() and one box. */
float sdStrap(float rr, float y){
  return box2(vec2(rr - RR, y - SY), vec2(SW, SH), 0.028);
}
/* The end of the strap doubled back OVER the buckle and stitched: a
   second, narrower layer riding 26 thousandths proud of the first — and
   then CLIMBING, because the frame it has to reach the bar of is lying
   on top of the tail. It peels off the strap over a third of a unit,
   crosses the rail on its own side of the frame with its underside eight
   thousandths above it, passes over the centre bar and is cut off just
   beyond it, where the bar hides the turn back under. That ramp is the
   one place
   in the scene where a surface is not axis-aligned, so its slope comes
   back off the field: 0.132 of climb over 0.32 of run is a gradient of
   0.62, and a field displaced by that is at most 1.18 times longer than
   the truth. 0.84 hands the margin back. */
float sdFold(vec3 p, float rr, float a){
  float lift = FLFT * smoothstep(0.62, 0.30, a);
  float f = box2(vec2(rr - RR, p.y - (SY + 0.030 + lift)), vec2(SW - 0.040, SH - 0.004), 0.026);
  return max(f, max(-0.015 - a, a - 0.80)) * 0.84;
}

/* ---- the buckle ---- in its own frame: x along the strap, z across it.
   The frame is a closed rectangle with a bar across the middle, and its
   whole plane now sits ABOVE the leather rather than inside it, which is
   what leaves the tail somewhere to run and the window something to show.
   The tongue is hinged on that bar — its near end is the bar's own centre
   line — drops away from it at fifteen degrees until it meets the top of
   the tail exactly at the near lip of the punched hole, and turns down
   there to go THROUGH it: the point finishes half a millimetre off the
   counter, at the bottom of the punch, with four millimetres of leather
   closed round the shaft above it. */
float sdBuckle(vec3 q){
  float d = max(sdRBox(q, vec3(0.230, 0.010, 0.395), 0.020),
               -sdRBox(q, vec3(0.145, 0.200, 0.310), 0.020));
  d = min(d, sdRBox(q, vec3(0.012, 0.012, 0.312), 0.018));                          /* centre bar */
  /* The tongue, in two runs. Each map is orthonormal — a reflection rather
     than a rotation, which costs nothing and preserves length either way —
     so both boxes are still EXACT and neither can be stepped through. The
     shank runs from the bar's own centre line out to the hole's near lip;
     the bend takes over there and drives the point down to within half a
     millimetre of the counter, inside the punch, with the leather's full
     thickness closed round it. */
  vec2 pr = vec2(-PC * q.x - PS * q.y, -PS * q.x + PC * q.y);
  d = min(d, sdRBox(vec3(pr.x - 0.0375, pr.y, q.z), vec3(0.0255, 0.004, 0.008), 0.012));
  vec2 qb = q.xy - vec2(TBX, TBY);
  vec2 pb = vec2(-QC * qb.x - QS * qb.y, -QS * qb.x + QC * qb.y);
  d = min(d, sdRBox(vec3(pb.x - 0.0512, pb.y, q.z), vec3(0.0392, 0.004, 0.008), 0.012));
  return d;
}

/* ---- the tag ---- a disc with a rolled rim, and nothing else. Every
   mark on it is a mark on the FACE rather than a shape, which is what
   lets the whole of it blur correctly for nothing. */
float sdTag(vec3 q){
  vec2 w = vec2(length(q.xz) - (TAGR - TAGD), abs(q.y) - (TAGH - TAGD));
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - TAGD;
}

/* The hole punched through the tail for the tongue. A vertical cylinder
   in the strap's own two surface coordinates — along it and across it,
   which are orthogonal and both unit — so it is an exact cylinder, and
   subtracted with a max(). A subtraction is the one CSG operation that
   can hand back MORE than the truth, so its reach is capped at 0.030:
   the void inside a 3.8mm punch is not worth a long step, and a long
   step there is a ray that lands inside the leather beside it. */
float sdHole(float rr, float a){
  return min(HOLR - length(vec2(a - HOLX, rr - RR)), 0.030);
}

float map(vec3 p){
  float rr = length(p.xz - vec2(0.0, CZ));
  float a  = dot(p - gBuckP, gTan);        /* along the strap, from the buckle */
  float d  = smin(max(sdStrap(rr, p.y), sdHole(rr, a)), sdFold(p, rr, a), 0.045);
  /* BOUNDS, not surfaces. Both are far looser than the things inside
     them, and neither is ever returned below 0.30 — which is not an
     epsilon but further than the furthest occlusion tap, because a bound
     answers those too and its answer is short. */
  float bb = length(p - gBuckP) - 0.78;      /* against a true 0.484 */
  if (bb > 0.30) d = min(d, bb);
  else           d = min(d, sdBuckle(gBuckM * (p - gBuckP)));
  float bt = length(p - gTagP) - 0.58;       /* against a true 0.401 */
  if (bt > 0.30) d = min(d, bt);
  else           d = min(d, sdTag(gTagM * (p - gTagP)));
  return d;
}

vec3 normalAt(vec3 p){
  vec2 k = vec2(1.0, -1.0) * 0.0013;
  vec3 g = k.xyy * map(p + k.xyy) + k.yyx * map(p + k.yyx)
         + k.yxy * map(p + k.yxy) + k.xxx * map(p + k.xxx);
  return g / max(length(g), 1e-6);           /* never normalize a zero */
}

/* One short ray at the key, sixteen steps, breaking on contact and on
   its own far plane. The first thing uTier takes off. */
float shadowRay(vec3 p, vec3 l){
  float s = 1.0, t = 0.035;
  for (int i = 0; i < 16; i++){
    float h = map(p + l * t);
    if (h < 0.0018) return 0.0;
    s = min(s, 7.0 * h / t);
    t += clamp(h, 0.035, 0.42);
    if (t > 2.6) break;
  }
  return clamp(s, 0.0, 1.0);
}

/* ---- the studio ----
   NEUTRAL, and that is the whole point of it. This is what the brass and
   the steel are looking at: a dark floor, a bright overhead sweep, a
   warm key up and to the left and a cool card off to the right — a
   still-life table, not a violet website. Point polished metal at the
   palette and brass renders as a lilac biscuit, which is what happened
   to a chrome desk bell elsewhere in this set. The counter BEHIND the
   collar is still the house palette; what the metal reflects is not. */
vec3 studio(vec3 r){
  vec3 e = mix(vec3(0.085, 0.086, 0.094), vec3(0.420, 0.425, 0.442),
               smoothstep(-0.70, -0.05, r.y));
  e = mix(e, vec3(0.930, 0.935, 0.950), smoothstep(0.00, 0.55, r.y));
  e += vec3(1.00, 0.94, 0.84) * smoothstep(0.58, 0.965, dot(r, gKey)) * 1.30;
  e = mix(e, vec3(0.560, 0.630, 0.780), smoothstep(0.38, 0.94, dot(r, gFil)) * 0.38);
  return e;
}

/* A metal is mostly what it reflects. Tint the environment with the
   metal's own colour, let the fresnel carry it toward white at a grazing
   angle, and ADD the two highlights rather than mixing toward white — a
   mix pulls the tint out from under them and brass goes to silver. */
vec3 metal(vec3 nor, vec3 rdv, vec3 tint, float rough, float aniso, vec3 anisoT, float occ, float sh){
  float fr = clamp(1.0 + dot(nor, rdv), 0.0, 1.0);
  fr = fr * fr * fr * fr * fr;
  vec3  F  = mix(tint, vec3(1.0), fr * 0.70);
  vec3  c  = studio(reflect(rdv, nor)) * F * mix(0.42, 1.0, occ);
  vec3  h  = normalize(gKey - rdv + 1e-6);
  float sp = pow(clamp(dot(nor, h), 0.0, 1.0), mix(150.0, 26.0, rough));
  if (aniso > 0.0){
    /* Broad, not tight. A narrow anisotropic lobe on a turned face is not
       a brushed finish, it is a cone of light with a hard edge — which is
       what the first cut of this drew straight across the tag. */
    float ht = dot(anisoT, h);
    sp = max(sp, pow(clamp(1.0 - ht * ht, 0.0, 1.0), 15.0) * aniso);
  }
  c += vec3(1.00, 0.95, 0.86) * F * sp * mix(1.30, 0.55, rough) * mix(0.18, 1.0, sh);
  vec3 h2 = normalize(gFil - rdv + 1e-6);
  c += vec3(0.70, 0.78, 0.92) * F * pow(clamp(dot(nor, h2), 0.0, 1.0), 40.0) * 0.30;
  return c;
}

/* ---- the engraving ----
   A row of cut strokes with the rhythm of a name: one stroke per cell,
   its height and width off a hash of the cell, a crossbar on some of
   them and a gap where a word ends. Laid out in the tag's own CARTESIAN
   coordinates rather than in polar, so there is no atan seam running
   across the face to tear it open. */
float glyphRow(vec2 q, float hx, float hy, float pitch, float seed, float gap){
  float inBox = smoothstep(hx, hx - 0.018, abs(q.x));
  float cx    = floor(q.x / pitch);
  float fx    = (fract(q.x / pitch) - 0.5) * pitch;
  float r1    = h11(cx * 3.1 + seed);
  float r2    = h11(cx * 3.1 + seed + 17.0);
  float on    = 1.0 - step(gap, r2);
  float hgt   = hy * (0.52 + 0.48 * r1);
  /* Between a third and three quarters of a millimetre, depending on the
     row, which is what a rotary engraver actually cuts — and, at the scale
     this tag is photographed, around two pixels on a phone. A finer stroke
     is not finer engraving, it is nothing at all: the first cut of this was
     a quarter of a millimetre and the whole name vanished under its own
     antialiasing before anyone could read it. */
  float wid   = pitch * 0.240;
  float bar   = smoothstep(wid, wid * 0.50, abs(fx)) * smoothstep(hgt, hgt * 0.66, abs(q.y));
  float tick  = smoothstep(pitch * 0.36, pitch * 0.20, abs(fx))
              * smoothstep(0.015, 0.006, abs(q.y - (r2 - 0.5) * hy * 0.86)) * step(0.45, r1);
  return inBox * on * max(bar, tick);
}

void main(){
  vec2  s0   = (2.0 * gl_FragCoord.xy - uRes) / uRes.y;
  float asp  = uRes.x / uRes.y;
  float wide = smoothstep(0.90, 2.10, asp);
  float e    = smoothstep(0.0, 1.0, uEnter);
  float gy   = gl_FragCoord.y / uRes.y;

  /* ---------------- the flick, and the settle ----------------
     One impulse at the seam and nothing but friction afterwards. The
     angle is written in closed form rather than integrated, so its rate
     is exact and the loop is periodic by construction:

       turn    phi = 9 * TAU * (1 - (1-s)^2.6), nine WHOLE turns, so the
               orientation at s = 1 is the orientation at s = 0;
       lean    a gaussian bump windowed to exactly zero at both ends, so
               the tag is flat when it starts and flat when it stops;
       rattle  the lean's azimuth, going as s^2.2 — the contact point
               races round the rim faster and faster as the lean comes
               off it, which is what a dropped coin does. */
  float cyc = fract(uTime / T_CYC + PH0);
  float sp  = clamp(cyc / SPIN, 0.0, 1.0);
  float one = max(1.0 - sp, 0.0);
  float phi = TURNS * TAU * (1.0 - pow(one, 2.6));
  float omg = TURNS * TAU * 2.6 * pow(one, 1.6) / (SPIN * T_CYC);   /* rad/s */
  float zt  = (sp - 0.58) / 0.26;
  float alp = AMAX * exp(-zt * zt) * smoothstep(0.0, 0.20, sp) * (1.0 - smoothstep(0.86, 1.0, sp));
  float psi = PREC * TAU * pow(sp, 2.2);
  /* Fast enough to blur: at the flick it is turning three and a half
     times a second, and the face stays one plain ring of brass until it
     is down to about two turns a second. */
  gBlur = smoothstep(2.4, 11.0, omg);

  /* Lean of alp about an axis at azimuth psi, spinning about its own
     normal underneath that. A disc of radius R leaning by alp and
     resting on its rim carries its centre at R*sin(alp) + h*cos(alp) —
     exact, so the tag RISES as it rattles and comes back down as it
     flattens, and its lowest point is on the counter at every instant. */
  gTagR = rotY(psi) * rotX(alp) * rotY(phi);
  gTagM = transpose(gTagR);
  gTagN = gTagR * vec3(0.0, 1.0, 0.0);
  gTagP = vec3(TAGX, TAGR * sin(alp) + TAGH * cos(alp), TAGZ);

  /* The buckle, square to the strap it is threaded onto, and lying ON it
     rather than in it. */
  float bq = sqrt(max(RR * RR - BX * BX, 1e-4));
  gTan     = vec3(bq, 0.0, BX) / RR;
  vec3 bZ  = vec3(-gTan.z, 0.0, gTan.x);
  gBuckP   = vec3(BX, BKY, CZ - bq);
  gBuckM   = transpose(mat3(gTan, vec3(0.0, 1.0, 0.0), bZ));

  /* Up, to the left, and BEHIND — which is the whole of the grounding.
     A key in front of a thing lying flat on a counter throws its shadow
     away from the reader, where it cannot be seen, and the collar comes
     back looking pasted onto a violet wall. Behind and at forty degrees,
     the shadow comes toward the lens and the leather picks up a rim. The
     fill is the cool card on the other side, low and near, so the faces
     turned toward the reader are not dead. */
  gKey = normalize(vec3(-0.62, 0.70, -0.34));
  gFil = normalize(vec3( 0.66, 0.30,  0.68));

  /* ---------------- the camera ----------------
     Close and low over the counter, and almost still: two degrees of
     azimuth and under one of elevation on a single sine over the cycle,
     so the whole scene closes on itself at eleven seconds. */
  float drift = TAU * uTime / T_CYC;
  float az = -0.05 + 0.035 * sin(drift)       + (uPointer.x - 0.5) * 0.14;
  float el =  0.55 + 0.014 * sin(drift + 1.9) + (uPointer.y - 0.5) * 0.07;
  float D  = 3.2;
  vec3  ta = vec3(0.25, 0.20, 0.34);
  vec3  ro = ta + vec3(sin(az) * cos(el), sin(el), cos(az) * cos(el)) * D;
  vec3  ww = normalize(ta - ro);
  vec3  uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
  vec3  vv = cross(uu, ww);

  /* Solved against the band's HEIGHT: the camera pulls back on the
     narrow band rather than cropping it, so the lens is the same lens at
     4:5 as at 21:9 and the collar simply keeps its share of the height.
     The object is lifted clear of the paper the kicker is printed on,
     and on a long band it moves right so the kicker has the open left. */
  float halfH = mix(1.56, 1.16, wide);
  float yOff  = mix(0.30, 0.44, wide);
  float xOff  = mix(0.08, 0.62, wide);
  vec2  s     = s0 - vec2(xOff, yOff);
  float fLen  = D / halfH;
  vec3  rd    = normalize(s.x * uu + s.y * vv + fLen * ww);
  float pxk   = 2.0 * halfH / (D * uRes.y);     /* one pixel, in world units */

  /* The two colours the house lends this scene's LIGHT, as opposed to
     its materials: a near-white warm key and a pale violet fill. */
  vec3 ambC = mix(vec3(0.62, 0.62, 0.66), mix(uInk, uColors[1], 0.55), 0.46);
  vec3 keyC = mix(uColors[3], vec3(1.00, 0.96, 0.90), 0.60);
  vec3 filC = mix(uColors[2], uColors[1], 0.30);

  /* ---------------- the room behind it ----------------
     Paper at the foot where the words go, taking violet as it climbs,
     with the light pooled where the work is. House palette, every line. */
  vec3 bg = mix(uColors[3], mix(uColors[2], uColors[1], 0.56), smoothstep(0.26, 1.18, gy));
  vec2 gp = vec2(s.x * mix(0.84, 0.50, wide), (s.y - 0.24) * 1.00);
  bg = mix(bg, uColors[3], exp(-dot(gp, gp) * 0.80) * 0.62);
  bg = mix(bg, mix(uColors[2], uColors[1], 0.70),
           smoothstep(0.50, 1.85, abs(s0.x) / max(asp, 0.80)) * 0.30);

  /* ---------------- the counter ----------------
     One ray/plane intersection rather than a march: an infinite plane in
     a distance field is the classic way to spend forty steps on a
     grazing ray and still miss it, and there is nothing a march buys. */
  vec3  back = bg;
  float tF   = 1e9;
  if (rd.y < -0.0015){
    float tf = -ro.y / rd.y;                 /* ro.y is 1.87, always above */
    if (tf < 40.0){
      tF = tf;
      vec3  fp = ro + rd * tf;
      float pxf = max(tf * pxk, 1e-6);

      /* Honed quartz, and the important word is QUIET. A counter wants a
         tooth, not a figure: the cut before this one had a slow violet
         cloud rolled across it at a fifth of a unit and the band came back
         looking like a spill on the desk rather than a desk. What says
         SURFACE here is the grazing sheen below and the contact marks —
         not marbling. So: one fine tooth, one whisper of mottle, and both
         faded out by their own pixel footprint before they can go moire. */
      vec3  stone = mix(uColors[2], uColors[1], 0.26);
      stone *= 0.985 + 0.030 * vnoise(fp.xz * 6.5);
      stone *= 1.0 + (h21(floor(fp.xz * 76.0)) - 0.5) * 0.085
                   * smoothstep(1.6, 3.4, 0.0132 / pxf);

      /* What the collar and the tag keep off it, PROJECTED along the key
         rather than traced.

         THE STRAP TOUCHES THE STONE ALONG ITS WHOLE LENGTH, and until now
         it left no mark saying so anywhere but under the buckle. A collar
         lying flat has its underside ON y = 0 from one edge of the frame
         to the other — there is no gap anywhere to have a gap — so the
         mark it leaves is one unbroken line that goes wherever the leather
         goes. That is free here: dSt is the distance from the strap's own
         footprint and it is zero along every millimetre of the contact, so
         anything written as a function of dSt runs the whole length by
         construction and cannot run anywhere else.

         The CAST shadow cannot carry that line, and the reason is geometry
         rather than taste. The hide is under four millimetres thick and
         the key is forty degrees up, so what the strap throws beyond its
         own edge is a two-millimetre sliver — a thirteenth of its width —
         and a camera thirty-one degrees off the counter sees almost none
         of it. What a reader actually reads at a seam like this is the
         stone's own light being shut OFF: at the touch the leather fills
         half the sky and takes the key and the cool card down with it, and
         a centimetre away it blocks nearly nothing. So the mark is built
         OUTWARD FROM THE SEAM, and the cast sliver only leans it toward
         the lens rather than being asked to be the whole of it. */
      float dSt = abs(length(fp.xz - vec2(0.0, CZ)) - RR) - SW;
      float gapS = max(dSt, 0.0);          /* daylight between stone and hide */
      /* the sliver, thrown off the TOP of the leather — the top edge is the
         one that draws its far lip, and projecting the mid-plane instead
         halved a shadow that was already hiding under the strap */
      vec3  q1  = fp + gKey * ((SY + SH) / gKey.y);
      float d1  = abs(length(q1.xz - vec2(0.0, CZ)) - RR) - SW;
      float penS = 0.010 + 0.55 * gapS;    /* hard at the touch, soft leaving */
      float shS  = 1.0 - smoothstep(-penS, penS, d1);
      /* Two falloffs, and the width of the first one is a RESOLUTION number
         as much as a physical one. Half a millimetre is the honest width of
         the touch and it was the first thing tried, and it is a third of a
         pixel on the phone's drawing buffer — which means the mark existed
         at 1440 and did not exist at 390, one scene telling two stories,
         the exact fault this pass is for. Two and a half millimetres is
         still tight — the hide is under four thick — it is what the stone
         within a leather's thickness of the seam really loses, and it is
         two pixels on the narrowest buffer we draw into. The second opens
         out over a centimetre so the first cannot end at a ring. */
      float seam = exp(-gapS * 11.0);      /* the touch, two and a half mm    */
      float hemS = exp(-gapS *  7.0);      /* and how far it opens, a cm      */

      vec3  q2  = gBuckM * ((fp + gKey * (BKY / gKey.y)) - gBuckP);
      float d2  = max(abs(q2.x) - 0.250, abs(q2.z) - 0.415);
      float shB = 1.0 - smoothstep(-0.028, 0.055, d2);

      /* where the rim is actually touching, and how flat the tag is lying */
      vec2  tn   = gTagN.xz;
      float tl   = length(tn);
      vec2  cdir = tl > 1e-4 ? tn / tl : vec2(0.0);
      vec2  cpt  = gTagP.xz + cdir * (TAGR * cos(alp));
      float flat01 = 1.0 - smoothstep(0.02, 0.22, alp);

      /* The tag's shadow is the EXACT shadow of a tilted disc: walk from
         the counter along the light up to the disc's plane, drop the
         component along its normal, and ask whether what is left is inside
         the radius. Four lines, and no second march anywhere.

         Its penumbra is GRADED, and that is what stops a tilted tag
         reading as a coin hovering over a desk. A shadow is hard where the
         thing casting it is touching and soft where it is far off the
         surface, so the softness grows with the distance from the contact
         point and the density falls away with it. Without that the shadow
         is one uniform blob sitting a third of a radius to the side of the
         tag, and the eye reads the pair as two separate objects. */
      vec3  q3    = fp + gKey * (gTagP.y / gKey.y);
      vec3  v3    = q3 - gTagP;  v3 -= gTagN * dot(v3, gTagN);
      float fromC = length(fp.xz - cpt);
      float pen   = mix(0.018 + 0.34 * fromC, 0.042, flat01);
      float shT   = (1.0 - smoothstep(-pen, pen, length(v3) - TAGR))
                * mix(1.0, mix(0.52, 1.0, flat01), smoothstep(0.10, 0.95, fromC));

      float shd = max(max(shS, shB), shT);
      shd = max(shd, (1.0 - smoothstep(0.0, 0.055, fromC)) * (1.0 - flat01));

      /* And the contact — the counter's own occlusion straight down
         under the leather and under the tag, which is the mark that says
         these things are TOUCHING rather than hovering. Under the tag it
         is the whole disc while it lies flat and a point at the rim
         while it is up on its edge, which is the second reading of the
         rattle and the one that survives being looked at as a still. */
      float aoS = max(seam, hemS * 0.80);
      float aoT = mix(1.0 - smoothstep(0.02, 0.15, fromC),
                      1.0 - smoothstep(TAGR * 0.86, TAGR * 1.16, length(fp.xz - gTagP.xz)),
                      flat01);
      /* A hard little core exactly where the rim is TOUCHING. Everything
         else about a tilted disc argues that it is in the air — its centre
         really is a third of its own radius up, and its shadow really has
         walked a third of a radius sideways — and without one definite
         mark at the point of contact the eye reads all of that as a coin
         hovering over a desk. This is the mark. It travels round the rim
         with the rattle, which is also the second reading of the rattle. */
      float core = (1.0 - smoothstep(0.0, 0.070, fromC)) * (1.0 - flat01) * 0.85;
      float ao  = clamp(max(max(aoS, aoT), core), 0.0, 1.0);
      /* and a second, far wider and far fainter one, so the contact does
         not stop dead at a ring and read as a drop shadow pasted under a
         cut-out */
      float aoW = max(1.0 - smoothstep(0.0, 0.50, dSt),
                      1.0 - smoothstep(TAGR * 0.9, TAGR * 2.1, length(fp.xz - gTagP.xz)));

      /* A flat plane's key term is one number rather than a dot product
         per pixel. The shadow removes the KEY and nothing else, so what
         is left inside it is the ambient and the fill — which is why it
         comes out a cool violet-grey on its own rather than being
         painted one. A shadow belongs to the light, not to the palette. */
      vec3 lit = stone * (ambC * ((0.42 + 0.24 * (1.0 - ao)) * mix(1.0, 0.88, aoW))
                        + keyC * (0.78 * gKey.y * (1.0 - shd))
                        + filC * (0.20 * gFil.y));

      /* THE SEAM, and it is LIGHT REMOVED rather than grey added. Where the
         leather meets the stone there is no sky left to reach it, no key
         and no card either, and what is there instead is the little the
         room bounces back under an edge — the room's own violet, and
         almost none of it. Everything above still has a floor under it:
         the ambient term never falls below 0.37 of itself and the fill is
         never occluded at all, so the deepest the block above can reach is
         a mid grey, which is not what the underside of a strap looks like.
         This is the one line that takes the rest of the light away, and it
         makes the darkest pixel in the frame a CONTACT rather than the
         burnished edge of the leather over it.

         It is a function of dSt alone — no tier, no pixel footprint, no
         aspect — so it is the same mark at 1440 as at 390, and it runs the
         whole length of the strap because dSt does. */
      float contactS = clamp(max(seam, max(hemS * 0.58, shS * 0.55)), 0.0, 1.0);
      lit = mix(lit, lit * 0.050 + mix(uInk, uColors[1], 0.35) * 0.017, contactS);

      /* The pool of light the work is under, so the counter has a centre
         instead of running edge to edge as one flat field. */
      vec2  pd = fp.xz - vec2(0.30, 0.10);
      lit *= mix(0.84, 1.10, exp(-dot(pd, pd) * 0.042));
      /* At a camera this low EVERY counter ray is a grazing one, so the
         stone's sheen climbs as it runs away from the reader — and that
         gradient is most of what says there is a SURFACE here rather than
         a wall of colour with things floating in front of it.

         And it is OCCLUDED, which matters more than it sounds: a sheen is
         a reflection of the room, and the room is exactly what cannot be
         seen from the half millimetre of stone under a strap. Added on
         afterwards it puts a floor of its own under the contact and the
         seam lifts off the leather again. */
      float grz = clamp(1.0 - abs(rd.y), 0.0, 1.0); grz = grz * grz * grz * grz;
      lit += mix(uColors[3], uColors[2], 0.45) * grz * 0.30 * (1.0 - 0.94 * contactS);
      vec3 mh = normalize(gKey - rd + 1e-6);
      lit += keyC * pow(clamp(mh.y, 0.0, 1.0), 7.0) * 0.050 * (1.0 - shd);

      back = mix(lit, mix(uColors[3], uColors[2], 0.35), smoothstep(3.8, 11.0, tf) * 0.55);
    }
  }

  vec3 col = back;

  /* ---------------- one march ----------------
     It starts at 1.80 because the nearest the collar comes to the lens
     at any moment, anywhere in the frame, is 2.41 — measured, not
     guessed — and it stops at the counter wherever the counter is
     nearer, so the bottom half of the band never marches. It remembers
     its closest approach in PIXELS, and that one float is the whole of
     the edge antialiasing: a ray that missed by half a pixel is shaded
     where it came nearest and blended in by how near it came. */
  int   steps = uTier > 0.75 ? 48 : uTier > 0.25 ? 36 : 24;
  float farO  = min(8.0, tF);
  float t = 1.80, near = 1e9, nt = 1.80;
  for (int i = 0; i < 48; i++){
    if (i >= steps || t > farO) break;
    float d = map(ro + rd * t);
    float rel = d / max(t * pxk, 1e-6);
    if (rel < near){ near = rel; nt = t; }
    if (rel < 0.35) break;
    t += d * 0.85;              /* under-relaxed: the strap is 3.8mm thick */
  }
  float cover = smoothstep(1.40, 0.42, near);

  if (cover > 0.002){
    vec3  pos = ro + rd * nt;
    vec3  nor = normalAt(pos);
    float px  = max(nt * pxk, 1e-6);

    float rr = length(pos.xz - vec2(0.0, CZ));
    float av = dot(pos - gBuckP, gTan);
    /* The hole is subtracted HERE too, and not as a nicety: without it
       every point of the tongue that is down inside the punch still reads
       as being within the strap's solid, and the tongue would be shaded
       as leather from the lip down. */
    float dS = max(sdStrap(rr, pos.y), sdHole(rr, av));
    float dF = sdFold(pos, rr, av);
    float dL = min(dS, dF);
    float dB = 1e9, dT = 1e9;
    vec3  bl = gBuckM * (pos - gBuckP);
    vec3  lp = gTagM * (pos - gTagP);
    if (length(pos - gBuckP) < 0.95) dB = sdBuckle(bl);
    if (length(pos - gTagP)  < 0.75) dT = sdTag(lp);

    /* Occlusion from two distance taps along the normal. Never from the
       step count: that is an integer, so what it draws is a contour map
       of itself across a flat face. */
    float occ = clamp(map(pos + nor * 0.055) / 0.055, 0.0, 1.0);
    if (uTier > 0.25) occ = 0.5 * occ + 0.5 * clamp(map(pos + nor * 0.170) / 0.170, 0.0, 1.0);
    occ = mix(occ, 1.0, 0.22);

    float sh = 1.0;
    if (uTier > 0.75 && dot(nor, gKey) > 0.01) sh = shadowRay(pos + nor * 0.014, gKey);

    vec3 c;

    if (dT <= dL && dT <= dB){
      /* ---------------- the brass tag ----------------
         Every mark on this face is drawn twice: once where it is, and
         once as the RING it becomes when the tag is turning too fast to
         hold it still. The two are crossfaded by the tag's real angular
         speed, which is why the engraving smears and the punched hole
         smears with it instead of sitting there razor sharp. */
      vec3  nl = gTagM * nor;
      float fc = abs(nl.y);                     /* 1 on a face, 0 on the rim */
      float r  = length(lp.xz);

      float hd    = length(lp.xz - vec2(0.0, -0.262));
      float holeS = 1.0 - smoothstep(0.050, 0.062, hd);
      float lipS  = (1.0 - smoothstep(0.062, 0.078, hd)) * smoothstep(0.054, 0.064, hd);
      float holeR = (1.0 - smoothstep(0.050, 0.064, abs(r - 0.262))) * 0.36;
      float hole  = mix(holeS, holeR, gBlur) * fc;
      float lip   = lipS * (1.0 - gBlur) * fc;

      /* the engraved border, which is already a ring and so never smears */
      float ring = (1.0 - smoothstep(0.336, 0.346, r)) * smoothstep(0.322, 0.332, r);

      /* A NAME over a NUMBER, and the difference between the two rows is
         the whole of what says dog tag rather than coin: five or six tall
         letters with no word break in them, and under that a long even run
         of small ones. Two rows of the same rhythm read as a medal. */
      float engS = max(glyphRow(lp.xz - vec2(0.0, -0.068), 0.205, 0.060, 0.0740,  3.0, 1.05),
                       glyphRow(lp.xz - vec2(0.0,  0.128), 0.256, 0.032, 0.0360, 11.0, 0.93));
      float engR = (1.0 - smoothstep(0.040, 0.078, abs(r - 0.145))) * 0.30
                 + (1.0 - smoothstep(0.026, 0.054, abs(r - 0.215))) * 0.24;
      float eng  = mix(engS, engR, gBlur) * smoothstep(0.70, 1.70, 0.0125 / px);

      float cut = clamp(max(max(eng, ring * 0.80), hole), 0.0, 1.0) * fc;

      /* Brushed in circles, the way a stamped tag is: the grooves run
         round the face, so the highlight streaks ACROSS them — radially
         — and comes out as the sunburst every turned brass face carries.
         It is rotationally symmetric already, so the spin does not touch
         it, which is exactly right. */
      vec3  tc = gTagR * (vec3(-lp.z, 0.0, lp.x) / max(r, 1e-4));
      vec3  at = normalize(tc - nor * dot(tc, nor) + vec3(1e-6));
      float ak = fc * smoothstep(0.03, 0.16, r) * 0.40;

      /* The faint tooth in the metal, and it is gated on its own pixel
         footprint like everything else here — a fleck finer than a pixel
         is not a finish, and on a face that is TURNING it is a crawling
         speckle, which is worse. */
      vec3 tint = BRASS * (1.0 + (h21(floor(lp.xz * 96.0)) - 0.5) * 0.09
                               * smoothstep(1.5, 3.2, 0.0104 / px));
      tint *= 1.0 - cut * 0.68;                      /* the cut is in shadow */
      tint = mix(tint, tint * 1.30, lip * 0.9);      /* and its lip catches  */
      c = metal(nor, rd, tint, mix(0.30, 0.62, cut), ak * (1.0 - cut * 0.70), at,
                occ * mix(1.0, 0.55, cut), sh);
      /* The hole is a hole: what is behind it is the counter in the tag's
         own shadow, not a darker shade of brass. */
      c = mix(c, mix(uInk, uColors[1], 0.35) * 0.22, hole * 0.86);
      /* And a little of the room's own violet on the rolled rim, so the
         tag belongs to the counter it is lying on rather than to a
         different photograph. */
      float fr = clamp(1.0 + dot(nor, rd), 0.0, 1.0);
      c = mix(c, c * 0.74 + mix(uColors[2], uColors[1], 0.40) * 0.15, fr * fr * 0.30);

    } else if (dB < dL){
      /* ---------------- the buckle ----------------
         Polished steel, drawn along its length, and the one bright
         neutral in the frame. It is also what makes a strap a COLLAR. */
      vec3  nb = gBuckM * nor;
      float up = abs(nb.y);
      float drawn = h21(floor(vec2(bl.x * 54.0, bl.z * 13.0)))
                  * smoothstep(1.4, 3.0, 0.0185 / px);
      vec3  tint = STEEL * (0.94 + 0.13 * drawn) * mix(0.88, 1.0, up);
      vec3  at   = normalize(gTan - nor * dot(gTan, nor) + vec3(1e-6));
      c = metal(nor, rd, tint, 0.26, 0.60 * up, at, occ, sh);

    } else {
      /* ---------------- tan bridle leather ----------------
         The grain is a real bump, not a print: the noise perturbs the
         NORMAL, which is why the light breaks up across the strap
         instead of a flat tan band carrying a pattern. Both grades are
         faded out by their own pixel footprint before they can alias. */
      float onFold = dF < dS ? 1.0 : 0.0;
      float halfW  = mix(SW, SW - 0.040, onFold);
      float v = rr - RR;                                  /* across the strap */
      float w = max(CZ - pos.z, 1e-3);
      float u = RR * atan(pos.x / w);                     /* along it, no seam */

      vec2  gc = pos.xz * 15.0;
      float n0 = vnoise(gc), nx = vnoise(gc + vec2(0.40, 0.0)), nz = vnoise(gc + vec2(0.0, 0.40));
      float gv = smoothstep(1.8, 3.8, 0.0666 / px);
      vec3  nn = normalize(nor + vec3(n0 - nx, 0.0, n0 - nz) * 0.85 * gv + vec3(1e-6));
      float fine = uTier > 0.75 ? vnoise(pos.xz * 62.0) : 0.5;

      vec3 base = LEATHER * (0.86 + 0.28 * n0 * gv)
                * (1.0 + (fine - 0.5) * 0.14 * smoothstep(1.4, 3.0, 0.0161 / px));
      /* the burnished edge — dyed darker and rolled over */
      base *= mix(1.0, 0.54, smoothstep(halfW - 0.055, halfW - 0.004, abs(v)));

      /* the awl channel, and the cream linen stitch lying in it */
      float row   = abs(abs(v) - (halfW - 0.078));
      base *= mix(1.0, 0.64, (1.0 - smoothstep(0.010, 0.026, row)) * 0.85);
      float svis  = smoothstep(1.5, 3.2, 0.084 / px);
      float ph    = fract(u / 0.084 + 0.25);
      float along = smoothstep(0.05, 0.16, ph) * (1.0 - smoothstep(0.58, 0.68, ph));
      float stitch = (1.0 - smoothstep(0.008, 0.019, row)) * along * svis;
      /* and the cross row that holds the doubled end down, back where the
         two layers are lying on each other again rather than out over the
         frame, where there would be nothing to stitch it to */
      float rowT  = abs(av - 0.70);
      float pht   = fract(v / 0.084 + 0.25);
      float alongT = smoothstep(0.05, 0.16, pht) * (1.0 - smoothstep(0.58, 0.68, pht));
      stitch = max(stitch, (1.0 - smoothstep(0.008, 0.019, rowT)) * alongT * svis * onFold);
      base = mix(base, THREAD, stitch * 0.92);

      /* Lit as the dielectric it is: a violet ambient off the room, a
         warm key with its own shadow, and a cool fill. Each term is the
         ALBEDO times the light that lands on it, so one line darkens tan
         hide and cream thread correctly. */
      float dif = clamp(dot(nn, gKey), 0.0, 1.0);
      float dfi = clamp(dot(nn, gFil), 0.0, 1.0);
      float sky = clamp(0.5 + 0.5 * nn.y, 0.0, 1.0);
      c = base * (ambC * ((0.30 + 0.28 * sky) * occ)
                + keyC * (0.90 * dif * mix(0.20, 1.0, sh) * mix(0.72, 1.0, occ))
                + filC * (0.26 * dfi * mix(0.62, 1.0, occ)));
      /* Leather keeps one low broad sheen, and the linen a tighter one. */
      vec3  hl  = normalize(gKey - rd + 1e-6);
      float spc = pow(clamp(dot(nn, hl), 0.0, 1.0), mix(15.0, 46.0, stitch));
      c += keyC * spc * mix(0.12, 0.34, stitch) * mix(0.25, 1.0, sh);
      /* The grazing sheen, which for a matte hide is most of its shape —
         and it is the ROOM, so the edges of the strap carry the room's
         own violet rather than a studio that is not behind them. */
      float fre = clamp(1.0 + dot(nn, rd), 0.0, 1.0); fre = fre * fre * fre;
      c = mix(c, mix(uColors[2], uColors[1], 0.35) * 0.82, fre * 0.26);
    }

    /* Air, so anything running back into the frame belongs to the same
       room as the counter behind it. */
    c = mix(c, back, smoothstep(4.6, 8.0, nt) * 0.5);
    col = mix(back, c, cover);
  }

  /* The reveal: the counter is already there, the collar is set down on it. */
  col = mix(bg, col, e);
  /* A little tooth, so the long wash into white never bands on a cheap
     panel — which is the only sort of panel this will be watched on. */
  col += (h21(gl_FragCoord.xy + fract(uTime) * 57.0) - 0.5) * 0.016;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export const scene: Scene = {
  frag,
  colors: ["#551a89", "#7c74a6", "#f4f3f7", "#ffffff"],
  /* The collar at rest with the tag lying flat, as far as stacked
     gradients can carry it — and they have to carry it, because this is
     what a reader on a slow phone looks at until the shader has compiled
     and what a device with no WebGL is left with for good. Solved at
     390x488, the band a phone gets: the tag's radii are in PIXELS off a
     centre placed with calc(), because a percentage radius is measured
     against width and height separately and the same stop that is a disc
     on a 4:5 band is a long lens shape on a 21:9 one. First layer is the
     topmost. */
  poster: [
    // The two engraved lines, and the punched hole above them.
    "radial-gradient(31px 5px at calc(50% + 38px) 42.4%, rgb(104 70 20 / 0.62), rgb(104 70 20 / 0) 100%)",
    "radial-gradient(27px 4px at calc(50% + 38px) 47.6%, rgb(104 70 20 / 0.52), rgb(104 70 20 / 0) 100%)",
    "radial-gradient(9px 5px at calc(50% + 38px) 37.8%, rgb(36 24 8 / 0.85) 0 50%, rgb(36 24 8 / 0) 100%)",
    // The brass tag, and the ring engraved round its edge.
    "radial-gradient(70px 38px at calc(50% + 38px) 45%, rgb(0 0 0 / 0) 0 88%, rgb(120 84 30 / 0.55) 92%, rgb(0 0 0 / 0) 96%)",
    "radial-gradient(78px 43px at calc(50% + 38px) 45%, " +
      "#f4d694 0 26%, #ddb059 56%, #bb8939 82%, #96692a 93%, rgb(255 255 255 / 0) 100%)",
    // What it keeps off the counter, down and to the right of the key.
    "radial-gradient(92px 28px at calc(50% + 54px) 48.6%, rgb(85 26 137 / 0.24), rgb(85 26 137 / 0) 100%)",
    // The steel buckle, sitting ON the strap where the shader puts it. The
    // first cut of this poster had it floating a few per cent below, and on
    // a band with no WebGL that is the whole difference between a dog
    // collar and a strip of leather.
    "radial-gradient(7px 13px at 20.8% 31%, #f4f6f8 0 46%, rgb(255 255 255 / 0) 100%)",
    "radial-gradient(31px 20px at 18.6% 31%, rgb(58 40 22 / 0.80) 0 33%, #d5dae1 44%, #a3a9b2 74%, #767c85 88%, rgb(255 255 255 / 0) 96%)",
    // The cream linen stitch down both edges of the strap. Dashes rather
    // than lines, because a continuous thread is a pinstripe and a dashed
    // one is a saddle stitch — and the dash is in PIXELS, so it stays a
    // stitch on a 21:9 band instead of stretching into a dotted rule.
    "repeating-linear-gradient(90deg, rgb(214 200 158 / 0.92) 0 7px, rgb(214 200 158 / 0) 7px 13px) 0 27.4% / 100% 2px no-repeat",
    "repeating-linear-gradient(90deg, rgb(206 192 150 / 0.78) 0 7px, rgb(206 192 150 / 0) 7px 13px) 0 34.4% / 100% 2px no-repeat",
    // The strap: a slow bow across the band, its far edge catching the key
    // and its near edge burnished almost black.
    "radial-gradient(150% 9.4% at 50% 30.8%, #8b5d37 0 34%, #79502e 62%, #593919 86%, #3a250f 96%, rgb(255 255 255 / 0) 100%)",
    // and what the strap keeps off the counter
    "radial-gradient(150% 12% at 51% 35.6%, rgb(85 26 137 / 0.22), rgb(85 26 137 / 0) 100%)",
    // The pool of light the work is under, and then the counter itself.
    "radial-gradient(78% 58% at 52% 43%, rgb(255 255 255 / 0.66), rgb(255 255 255 / 0) 100%)",
    "linear-gradient(to bottom, #b0a8c9 0%, #cbc6dc 20%, #e6e4ee 50%, #f8f7fb 80%, #ffffff 100%)",
  ].join(", "),
  alt: "A tan leather dog collar lying in a slow curve across a pale counter, seen close and low: pebbled grain, a cream stitched edge, and a steel buckle the collar is fastened through — the tail running under the frame and showing through its window, the doubled end climbing over the frame to wrap the centre bar, and the tongue dropping from that bar into a punched hole. A brass name tag lies loose in front of it. Someone has flicked the tag: it spins fast enough to smear its engraving into a plain ring of brass, slows, tips onto its rim and rattles like a dropped coin settling, then lies flat with the name and number readable — and after a pause it is flicked again.",
};
