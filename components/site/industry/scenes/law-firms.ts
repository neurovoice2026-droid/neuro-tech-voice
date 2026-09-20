import type { Scene } from "../shader-stage";

/* ------------------------------------------------------------------ *
 * Law firms — the seal coming down on the wax.
 *
 * Three attempts died in this file before this one. Twice it was a
 * bundle of case files — horizontal strata, then a fanned stack — and
 * both times the note back was the same: a dozen cut edges landing on a
 * device pixel each is a moire pattern, not a picture. The third was a
 * single letter drawn flat on a desk: better, but a picture that
 * breathed rather than a thing that moved, and violet all through.
 *
 * So this one is not drawn on a plane. It is BUILT, and it strikes.
 *
 *   the object   a heavy handled desk seal in aged brass — a broad die,
 *                a turned boss, a knurled collar, a tapered shaft and a
 *                knob — standing over a poured pool of deep red sealing
 *                wax on a sheet of cream laid paper. It is
 *                the last thing that happens to a document in this trade
 *                and the one moment on the page where nothing is
 *                provisional.
 *
 *   the motion   it STAMPS. One clean strike a loop. The seal comes down
 *                accelerating, drives into the wax, rebounds on a damped
 *                spring — and is OFF IT AGAIN inside four tenths of a
 *                second, drawn up and back the way a hand lifts a seal
 *                off a document, leaving an impression: a spread disc
 *                with a raised squeeze-out rim round it and the scales
 *                struck in relief inside a beaded border. Eight and two
 *                fifths seconds, and the LOOP SEAM IS THE IMPACT ITSELF
 *                — the one place in the cycle where a discontinuity of
 *                velocity is not a bug but the subject. Position is
 *                continuous across it, which is why the spring is
 *                written as a sine rather than a cosine.
 *
 *                The wax softens back to a pool over the last second and
 *                a quarter, under the descending seal, because hot wax
 *                does and because the alternative is an impression that
 *                pops.
 *
 *   the camera   low and close to the sheet — fifteen degrees above the
 *                paper, a sixth of a metre up if the sheet is A4 — so the
 *                seal comes down TOWARDS the reader, the strike is read
 *                in profile, and the impression is still a disc with a
 *                device in it rather than a red line. It drifts a few
 *                degrees either way on a single cosine of the cycle, so
 *                there is no seam there either, and the pointer's own
 *                nudge is floored so no reader can push it back down flat.
 *
 * THE ONE THING THAT WAS WRONG, AND WHAT IT COST. Photographed at three
 * widths, this band named itself the same way twice and differently once:
 * at 1440 a brass seal above a struck wax impression, at 820 and at 390 a
 * brass disc sitting on a thin red ring, because the die was seated on
 * its own work and a seated die hides it. Two failures, compounding:
 *
 *   · the cycle spent a quarter of itself with the seal parked in the
 *     wax. It now spends an ELEVENTH there, and the eleventh is the
 *     strike itself. The impression is open from cyc 0.07 to cyc 0.89,
 *     and every uTime from half a second to seven falls inside that —
 *     which covers the whole window a reader, or a camera, can arrive in.
 *   · eleven degrees of elevation presented four device pixels of wax
 *     FACE on a phone. Everything cut into it was there and none of it
 *     could be seen. Fifteen degrees, a die a hundredth narrower and a
 *     struck disc two and a half hundredths wider, and the impression is
 *     the largest single thing in the frame at all three widths.
 *
 * The materials did not change. They were the part that was right.
 *
 * AND THEN THE PRESS FLOATED. Lifting the die clear of its own work fixed
 * the thing it was meant to fix and left a seal hanging in mid-air over a
 * document, because two separate things were missing and neither was the
 * timing:
 *
 *   · at the bottom of the stroke the die STOPPED ON the wax. Its
 *     underside came to rest exactly on the pool's top surface, which is
 *     two discs parked on each other, and only the first half-swing of
 *     the impact spring ever put brass below the wax line — a tenth of a
 *     second, and back out again on the rebound. It now carries a BITE:
 *     0.032 of a unit below whatever the wax's top is at that instant, a
 *     fifth of the die's own thickness, held through the whole press so
 *     the rebound never lifts it clear. Full note at bite, in the clock.
 *   · the only shadow the seal had TRAVELLED. The key is forty-two
 *     degrees up, so at the top of the lift the die's cast shadow is a
 *     third of a unit to the right of the die, and a press whose only
 *     shadow is over there is a press standing on nothing. There is now
 *     an ambient contact under it at every height — straight down, on the
 *     seal's own axis, tight and nearly solid at the seat and broad and
 *     faint at the top of the lift. See contact().
 *
 *     The surprise in it: MOST OF THAT SHADOW LANDS ON THE WAX, not on
 *     the paper. Painted in as a flat colour to find out where it went,
 *     the plane's share turned out to be a crescent — at fifteen degrees
 *     a disc of wax 0.88 across hides nearly every square unit of sheet
 *     the raised seal stands over. So the wax's own top takes the same
 *     disc, measured from its own height, and that is what carries the
 *     reading.
 *
 * AND THEN IT STILL CAST NOTHING, which is the pass this file has just
 * had. Photographed again, the heaviest object in the set was standing
 * over a sheet with no mark on it, the pool of wax was lying on the page
 * with no mark under it, and the page was lying on the desk with a flat
 * violet band beside it. Three faults, and none of them was the geometry:
 *
 *   · the ambient contact above was the ONLY thing the press had, and it
 *     is a smudge by construction. The die's own CAST shadow — the key
 *     removed rather than the dome occluded — now runs on the paper AND
 *     on the wax's top, out of one castDisc(), tightening to a hard edge
 *     as the press comes down and opening to a soft grey as it lifts.
 *   · the wax's shadow was its own silhouette shifted forty thousandths:
 *     a disc of shadow under a disc of wax OF THE SAME RADIUS, so all but
 *     a sliver of it was hidden behind the very thing casting it. What is
 *     there now is the seam round the rim, which is the part that can be
 *     seen and the darkest thing on the sheet by a factor of five.
 *   · every one of these was mixed toward a tint at a strength that left
 *     sixty per cent of the sheet's own brightness in the darkest pixel
 *     of the mark. Sixty per cent of cream paper is not a shadow. They
 *     are two mixes now, because a cast shadow and a contact are two
 *     different quantities of light: see the pair of them in main().
 *
 *     Measured, at 1440 and at 390, on the same probe: the sheet round
 *     the pool reads 217 and 201, the seam under its rim 42 and 46, the
 *     wax standing over that seam 55 and 62. It was 218 against 218.
 *
 * COLOUR. The environment is the site's — backdrop, desk, haze, shadow
 * and the window that crosses the frame all come off uColors and uInk.
 * The object is its own, and there are exactly three materials in it:
 *
 *   aged brass        #8c662c in the light, #2b1e0c in the crevices, a
 *                     green-grey #373a27 in the angles a working seal
 *                     collects a patina, and #f5c86b where it reflects.
 *                     Brass is mostly what it REFLECTS, and WHAT IT
 *                     REFLECTS IS A STUDIO: a dark neutral floor, a
 *                     bright overhead sweep, a warm key and a cool fill,
 *                     lit the way a photographer would light brass on a
 *                     table. Handing it the band's own violet-grey put a
 *                     mauve bloom across the top of the knob and took the
 *                     metal halfway to gold-coloured plastic. The backdrop
 *                     behind the object is still the house palette; the
 *                     environment a mirror samples is not.
 *   sealing wax       #7c1214 cooled, #a51e14 while it is still soft, and
 *                     #d12e1c coming through a thin edge of it, which is
 *                     what wax does and painted metal does not.
 *   cream laid paper  #f2ead7, with laid and chain lines that fade out the
 *                     instant they would alias rather than stripe the page,
 *                     and type printed in a warm near-black #35302d.
 *
 * WHAT IT COSTS. Only the fragments that cover the object march at all:
 * the object's bounding sphere is intersected ANALYTICALLY first, and a
 * ray that misses it never calls map() once. The paper is not marched
 * either — it is one plane, and one divide finds it exactly, which is the
 * whole reason a camera this low is affordable. So is the shadow: the
 * shadow of a horizontal disc cast on a horizontal plane is a translated
 * circle of the same radius, so the die's shadow, the knob's and the
 * wax's own are three lengths rather than a shadow ray. That is why every
 * tier gets the same picture here and the tier buys back only march steps
 * and one occlusion tap — 48/36/24, and no second ray on any of them.
 *
 * NOT BUGGY — the specific things that went wrong before, and where they
 * are handled here:
 *   · every bound is exact and conservative and is only ever RETURNED
 *     while it is above 0.05, which is thirty times the hit epsilon: the
 *     wax's bounding cylinder is 0.56 round a pool that never exceeds
 *     0.465, and the seal's bounding capsule is 0.42 round a body whose
 *     furthest corner is 0.323 from its axis.
 *   · NO PANCAKE ELLIPSOIDS. The conservative ellipsoid field is wrong by
 *     the ratio of its smallest semi-axis to its largest, and this file's
 *     antialiasing is the march's closest approach measured in pixels —
 *     so a crown 0.39 across and 0.014 thick reported two thousandths of
 *     a unit at points seven hundredths outside it, and painted a red
 *     haze on the paper eighteen pixels wide. The wax crown is a rounded
 *     cylinder now, and its field is exact. Full note at sdWax.
 *   · the march is UNDER-RELAXED at 0.86, because the squeeze-out rim is
 *     eighteen thousandths wide and a full step stipples a wall that thin.
 *   · no pow() with a base that can go negative — every one is wrapped in
 *     max(x, 0.0), and the eases are written as products rather than pow.
 *   · no normalize() of a vector that can be zero: the field normal falls
 *     back to +y, the relief gradient falls back to zero, the lobe and
 *     tangent directions fall back to +x at the axis, and the half vector
 *     cannot degenerate because the light never lies along a ray that
 *     reaches the object.
 *   · the march breaks on a pixel-relative hit and on a far plane, and
 *     that far plane is the min of the bounding sphere's exit and the
 *     paper, so it can never run to the cap.
 *   · the loop closes: at cyc = 1 the seal is at contact height with a
 *     pool under it, which is exactly what cyc = 0 is.
 * ------------------------------------------------------------------ */

const frag = `
#define TAU 6.28318531

/* ---- the three materials, as literals. Nothing here is a uniform
   scaled down: brass is brass, wax is wax, paper is paper. ---- */
const vec3 BRASS  = vec3(0.548, 0.398, 0.172);   // aged brass, in the light
const vec3 BRASSD = vec3(0.168, 0.116, 0.048);   // and in its own shadow
const vec3 PATINA = vec3(0.214, 0.228, 0.152);   // the green-grey a used seal gets
const vec3 BRSPEC = vec3(0.960, 0.786, 0.418);   // brass, reflected
const vec3 WAXC   = vec3(0.486, 0.072, 0.078);   // sealing wax, cooled
const vec3 WAXHOT = vec3(0.648, 0.118, 0.080);   // and while it is still soft
const vec3 WAXSSS = vec3(0.820, 0.180, 0.110);   // what comes through a thin edge
const vec3 PAPERC = vec3(0.948, 0.918, 0.842);   // cream laid
const vec3 TYPEC  = vec3(0.208, 0.190, 0.178);   // and what is printed on it

/* ---- the key. A window up and to the left, a little in front, so the
   shadow falls to the right and towards the reader where it can be read.
   Anchored in WORLD space, because the camera barely moves and a light
   that stays put is what makes a room a room. ---- */
const vec3 LIG = vec3(-0.7315, 0.6633, -0.1580);
/* Where that key puts a thing's shadow, per unit of height above whatever
   surface it is standing on: -LIG.xz / LIG.y, a little over one to one at
   forty-two degrees up. Every shadow in this file is a translated circle
   rather than a ray, and this is the translation. */
const vec2 SOFF = vec2(1.102819, 0.238203);

/* ---- the animation, resolved once a fragment and read by the field.
   Globals rather than arguments: map() is called forty-odd times a pixel
   and none of this changes between calls. ---- */
float gY;        // the die's underside, above the paper
float gStruck;   // 0 a poured pool, 1 a struck impression
float gWaxR;     // how far the wax has spread
float gWaxH;     // and how flat it has gone
float gTC, gTS;  // the seal's tilt, as cos and sin
float gSX, gSZ;  // and its sway

float hash(vec2 p){
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

/* ---- primitives. Exact fields, because an approximate one overshoots
   and an overshoot in a march is a hole through the middle of a part. ---- */
float sdCylY(vec3 p, float r, float h){
  vec2 d = vec2(length(p.xz) - r, abs(p.y) - h);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}
float sdRCylY(vec3 p, float r, float h, float rd){
  vec2 d = vec2(length(p.xz) - r + rd, abs(p.y) - h + rd);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - rd;
}
/* A rounded annulus about y: a rounded box in (radial, axial) revolved.
   The squeeze-out rim round the impression is one of these. */
float sdRingY(vec3 p, float rm, float w, float h, float rd){
  vec2 d = vec2(abs(length(p.xz) - rm) - w + rd, abs(p.y) - h + rd);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - rd;
}
/* Deliberately the CONSERVATIVE ellipsoid — (|p/r|-1) * min(r) never
   overestimates, where the sharper form occasionally does. A knob that
   rays tunnel through is not worth the two per cent.

   The price is that it is wrong by min(r)/max(r), and this file reads the
   field's value as a DISTANCE when it antialiases. So it is used here for
   ONE shape only: the knob, 0.148 by 0.104, where that ratio is 0.70 and
   the error is a pixel. Anything flatter gets an exact field instead —
   see the crown in sdWax, which is what taught us the difference. */
float sdEll(vec3 p, vec3 r){
  return (length(p / r) - 1.0) * min(r.x, min(r.y, r.z));
}
/* iq's round cone about y: base radius r1 at y=0, r2 at y=h. Exact. */
float sdConeY(vec3 p, float r1, float r2, float h){
  vec2  q = vec2(length(p.xz), p.y);
  float b = (r1 - r2) / h;
  float a = sqrt(max(1.0 - b * b, 0.0));
  float k = dot(q, vec2(-b, a));
  if (k < 0.0)   return length(q) - r1;
  if (k > a * h) return length(q - vec2(0.0, h)) - r2;
  return dot(q, vec2(a, b)) - r1;
}
float sdSeg2(vec2 p, vec2 a, vec2 b, float r){
  vec2  pa = p - a, ba = b - a;
  float h  = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

/* ---- the wax ----
   A poured pool becomes a struck impression without ever changing what
   it is made of: the disc spreads and flattens, the dome on top of it
   goes away, and the lip round its edge grows into a squeeze-out rim.
   Three primitives and one lobe function, and every one of them is
   continuous in gStruck — which is what lets the same field draw the
   moment before the strike and the moment after it.

   The rim always sits OUTSIDE the die's own radius, at every value of
   gStruck, because wax flows out past the edge of a die rather than
   piling up under it — which is also the arithmetic that guarantees the
   die never intersects the rim at any point of the press. Its innermost
   wall is R - 0.044, which at a fresh pour's R of 0.364 is 0.320 against
   a die of 0.300: two hundredths of clearance at the tightest moment of
   the cycle, where the cut before this one had none and the two solids
   grew through each other. */
float sdWax(vec3 p){
  /* BOUND, not surface, and exact: an honest cylinder 0.560 across a
     pool that never exceeds 0.465, handed back only while it is well
     above any epsilon the march could mistake for a hit. */
  float b = sdCylY(p - vec3(0.0, 0.075, 0.0), 0.560, 0.180);
  if (b > 0.05) return b;

  /* Poured wax is not a circle. The lobes come off the unit direction by
     angle doubling rather than an atan — two multiplies against a trig
     call, inside a field that is evaluated forty times a fragment. */
  float rr = length(p.xz);
  vec2  u  = rr > 1e-4 ? p.xz / rr : vec2(1.0, 0.0);
  float c2 = u.x * u.x - u.y * u.y;
  float s2 = 2.0 * u.x * u.y;
  float c3 = u.x * c2 - u.y * s2;
  float R  = gWaxR * (1.0 + 0.032 * c3 + 0.020 * c2);
  float H  = gWaxH;

  float d = sdRCylY(p - vec3(0.0, H * 0.5, 0.0), R, H * 0.5, 0.026);
  /* The crown a pool has and an impression does not. At gStruck 1 it is
     flush with the face and costs the field nothing.

     THIS WAS AN ELLIPSOID AND THAT WAS A BUG, and it is worth the four
     lines because it is the kind that hides. sdEll is the conservative
     form, (|p/r| - 1) * min(r), and its error is the ratio of the
     smallest semi-axis to the largest: for a crown 0.389 across and
     0.014 thick that is a factor of twenty-eight. A point seven
     hundredths of a unit OUTSIDE the wax, at the crown's own height,
     reported a distance of two thousandths. Marching survives that — an
     underestimate always does — but this file's antialiasing is the
     march's closest approach measured in PIXELS, and two thousandths is
     a fraction of a pixel on a degraded buffer. So every ray that passed
     anywhere near the disc came back partly wax, and what stood round
     the impression was a red haze on the paper eighteen pixels wide that
     nothing had cast. Invisible at 1440 where a pixel is small, plain at
     390 and on any machine the adaptive resolution has stepped down.

     A rounded cylinder with its corner radius equal to its half-height
     is the same pour — flat on top, rolled at the rim — and its field is
     EXACT, so the closest approach means what it says. */
  float dh = 0.014 + 0.070 * (1.0 - gStruck);
  d = min(d, sdRCylY(p - vec3(0.0, H - 0.014, 0.0), R * 0.88, dh, dh));
  // The squeeze-out.
  float rh = 0.010 + 0.026 * gStruck;
  d = min(d, sdRingY(p - vec3(0.0, H, 0.0), R - 0.026, 0.018, rh, 0.008));
  return d;
}

/* ---- the seal ----
   A broad die, a turned boss, a knurled collar, a tapered shaft, a knob
   and a finial: six primitives, every one overlapping the next so the
   union has no seam, and 0.798 tall over a die 0.620 across. The
   proportions are the whole reading — the first cut of this file stacked
   three tiers of nearly the same diameter and what came back was a chess
   pawn. A desk seal is a WIDE flat die with ONE turned taper off it and a
   slim handle above, and that ratio is what says so at a glance. */
float sdSeal(vec3 p){
  float d = sdRCylY(p - vec3(0.0, 0.072, 0.0), 0.300, 0.072, 0.013);  // the die
  d = min(d, sdConeY(p - vec3(0.0, 0.132, 0.0), 0.184, 0.132, 0.096)); // the boss
  d = min(d, sdRCylY(p - vec3(0.0, 0.296, 0.0), 0.128, 0.072, 0.009)); // knurled collar
  d = min(d, sdConeY(p - vec3(0.0, 0.356, 0.0), 0.074, 0.050, 0.250)); // the shaft
  d = min(d, sdEll  (p - vec3(0.0, 0.664, 0.0), vec3(0.148, 0.104, 0.148))); // the knob
  d = min(d, sdRCylY(p - vec3(0.0, 0.778, 0.0), 0.056, 0.020, 0.012)); // the finial
  return d;
}

/* The seal's own frame: world in, seal-local out. */
vec3 sealLocal(vec3 p){
  vec3 sp = p - vec3(gSX, gY, gSZ);
  return vec3(gTC * sp.x + gTS * sp.y, gTC * sp.y - gTS * sp.x, sp.z);
}

float map(vec3 p){
  float d  = sdWax(p);
  vec3  sp = sealLocal(p);
  /* A capsule round the axis from 0.12 to 0.64, radius 0.42. The
     furthest point of the seal from that segment is the corner of the
     die at 0.323, so this is conservative by nine hundredths of a unit —
     and it is only ever returned above 0.06, which is forty times the
     epsilon the march calls a hit. */
  vec3  q = sp; q.y -= clamp(q.y, 0.12, 0.64);
  float b = length(q) - 0.42;
  return min(d, b > 0.06 ? b : sdSeal(sp));
}

vec3 normalAt(vec3 p){
  vec2 k = vec2(1.0, -1.0) * 0.0018;
  vec3 n = k.xyy * map(p + k.xyy) + k.yyx * map(p + k.yyx)
         + k.yxy * map(p + k.yxy) + k.xxx * map(p + k.xxx);
  float l = length(n);
  return l > 1e-6 ? n / l : vec3(0.0, 1.0, 0.0);
}

/* ---- the device cut into the die, and therefore struck into the wax.
   A beaded border, a fine inner rule, and the scales: post, foot, beam,
   two cords and two pans. It is a real 2D distance field, so the relief
   gets a bevel with a lit side and a shaded one rather than a decal. ---- */
float devField(vec2 q){
  float r = length(q);
  vec2  u = r > 1e-5 ? q / r : vec2(1.0, 0.0);
  // Sixteen beads round the border, by four angle doublings.
  float c1 = u.x, s1 = u.y;
  for (int i = 0; i < 4; i++){ float n = c1 * c1 - s1 * s1; s1 = 2.0 * c1 * s1; c1 = n; }
  float d = abs(r - (0.268 + 0.0080 * c1)) - 0.0140;
  d = min(d, abs(r - 0.200) - 0.0060);
  d = min(d, sdSeg2(q, vec2( 0.000, -0.108), vec2(0.000,  0.086), 0.0140));  // post
  d = min(d, sdSeg2(q, vec2(-0.066, -0.114), vec2(0.066, -0.114), 0.0135));  // foot
  d = min(d, sdSeg2(q, vec2(-0.112,  0.086), vec2(0.112,  0.086), 0.0110));  // beam
  d = min(d, sdSeg2(q, vec2(-0.112,  0.084), vec2(-0.112, 0.034), 0.0052));  // cords
  d = min(d, sdSeg2(q, vec2( 0.112,  0.084), vec2( 0.112, 0.034), 0.0052));
  d = min(d, sdSeg2(q, vec2(-0.148,  0.028), vec2(-0.076, 0.028), 0.0125));  // pans
  d = min(d, sdSeg2(q, vec2( 0.076,  0.028), vec2( 0.148, 0.028), 0.0125));
  return d;
}

/* ---- what the brass sees: a STUDIO, not the wall ----
   A polished metal has almost no colour of its own. It is whatever is
   around it, and the earlier cut of this handed it the band's own
   violet-grey — which is why the knob came back with a mauve bloom
   across the top of it and why brass anywhere near this palette tends
   to render as gold-coloured plastic. The backdrop behind the object is
   still the house palette; what the object REFLECTS is lit the way a
   photographer would light it on a table:

     a dark neutral floor, so there is something for the underside to be;
     a bright overhead sweep, so a turned face catches a band and not a dot;
     a warm key up and to the left, on the same vector as the real one;
     a cool fill opposite it, low and to the right;
     and the cream sheet itself, which is a real bounce and the one thing
     in here that is allowed a colour, because it is actually that colour.

   r comes in off reflect() of two unit vectors, so it is already unit and
   nothing here has to normalize a vector that could be zero. ---- */
const vec3 FILLDIR = vec3(0.7332, 0.2824, 0.6182);   // unit, by construction

vec3 roomEnv(vec3 r){
  vec3 c = mix(vec3(0.052, 0.048, 0.044), vec3(0.872, 0.874, 0.896),
               smoothstep(-0.46, 0.34, r.y));
  // the sheet under it
  c = mix(c, PAPERC * 0.90, smoothstep(-0.08, -0.66, r.y) * 0.78);
  // the softbox overhead
  c = mix(c, vec3(1.0), smoothstep(0.62, 0.98, r.y) * 0.62);
  // the key, and the fill
  c = mix(c, vec3(1.000, 0.948, 0.872), smoothstep(0.66, 0.992, dot(r, LIG)) * 0.92);
  c = mix(c, vec3(0.604, 0.664, 0.812), smoothstep(0.42, 0.960, dot(r, FILLDIR)) * 0.42);
  return c;
}

/* ---- the contact ----
   A cast shadow TRAVELS. This key is forty-two degrees up, so at the top
   of the lift the die's shadow is a third of a unit to the RIGHT of the
   die and most of what is left of it falls behind the wax — and a press
   whose only shadow is over there is a press standing on nothing, which
   is exactly how it read.

   What ties an object to a surface is the light it keeps off that surface
   STRAIGHT DOWN: the room's own dome, occluded by the body of the seal.
   That one cannot walk away from what casts it. So this takes no light
   direction at all — it is centred on the seal's own axis, and h is the
   height of the die's underside above whatever surface is being shaded,
   the paper for the sheet and the wax's own top for the impression.

   The falloff is the real one rather than a curve that looked right. A
   disc of radius a held h above a surface takes a*a/(a*a + h*h) of a
   cosine-weighted hemisphere off the point beneath it, which is
   1/(1 + (h/a)^2). The a here is 0.354 and not the die's own 0.300,
   because the die is not the only thing overhead — the boss, the collar,
   the shaft and the knob all stand on top of it, and the room this is
   lit in has a bright sweep straight up, which a disc overhead blocks
   more of than it blocks a uniform sky. So the term is nearly solid at
   the seat and half of itself at the top of the lift: it tightens to the
   die's own footprint as the press comes down, and it spreads and fades as
   it goes up. One square root, so every tier gets it, like every other
   shadow in this file.

   It is HALF the answer and not the whole one. On its own it is a soft
   round smudge centred on the seal, and a soft round smudge is what the
   band had instead of a shadow — worse, the die is drawn back over the
   sheet at the top of its lift, so nearly all of this one lands on the
   pool rather than on the paper and there was nothing left over to read.
   The other half is castDisc, below, and the seams under the pool's rim
   and the sheet's edge, down in main(). */
float contact(vec2 q, float h){
  h = max(h, 0.0);
  float w = 0.022 + 0.58 * h;
  return smoothstep(w, -w, length(q - vec2(gSX, gSZ)) - (0.300 + 0.52 * h))
       * 0.94 / (1.0 + 8.0 * h * h);
}

/* ---- and the cast one, which is the other half of it ----
   The ambient term above says the press is over SOMETHING. What says how
   far over it is, is the shadow the key throws — and because the shadow of
   a horizontal disc cast on a horizontal plane along a fixed direction is a
   translated circle of the same radius, that is one length rather than a
   ray. Every tier gets it; the tier buys back march steps and nothing else.

   gap is the daylight between the disc and the surface it is shading, and
   it drives both numbers, which is the whole reading:

     the penumbra opens with it   — a window a metre wide draws a hard black
                                    edge under a die that is touching and a
                                    soft grey one under a die at the top of
                                    its lift;
     the strength closes with it  — the umbra of a broad source is eaten by
                                    its own penumbra as the caster rises.

   So it TIGHTENS as the press comes down and SPREADS as it lifts, which is
   the one thing a viewer reads a height off. */
float castDisc(vec2 q, vec2 c, float rad, float gap){
  gap = max(gap, 0.0);
  float pen = 0.012 + 0.34 * gap;
  return smoothstep(pen, -pen, length(q - (c + SOFF * gap)) - rad)
       / (1.0 + 2.2 * gap);
}

/* The pool's own outline — the same lobed radius sdWax builds its body
   from, so the seam under the rim sits ON the rim rather than near it.
   Poured wax is not a circle and a circular shadow under a lobed disc is a
   shadow that peels away from its object on two sides out of six. */
float waxR(vec2 q){
  float r = length(q);
  vec2  u = r > 1e-4 ? q / r : vec2(1.0, 0.0);
  float c2 = u.x * u.x - u.y * u.y;
  float s2 = 2.0 * u.x * u.y;
  return gWaxR * (1.0 + 0.032 * (u.x * c2 - u.y * s2) + 0.020 * c2);
}

/* One printed mark: a rectangle in the paper's own coordinates, so it
   foreshortens with the paper rather than being drawn foreshortened. */
float bar(vec2 p, vec2 c, vec2 h, vec2 aa){
  vec2 f = smoothstep(h + aa, h - aa, abs(p - c));
  return f.x * f.y;
}

void main(){
  vec2  s0   = (2.0 * gl_FragCoord.xy - uRes) / uRes.y;
  float asp  = uRes.x / uRes.y;
  float wide = smoothstep(0.95, 2.00, asp);
  float e    = smoothstep(0.0, 1.0, uEnter);

  /* ---------------- the clock ----------------
     Eight and two fifths of a second, and CONTACT IS AT ZERO — the seam
     of the loop is the moment of the strike, which is the one place in
     the cycle where a jump in velocity is the subject rather than a bug.

     THE DIE DOES NOT REST ON WHAT IT HAS JUST MADE. That is the whole of
     this revision. A seal seated in wax hides the impression under its
     own body, and the earlier cut of this file held it there for two and
     a half of its nine and a half seconds — a quarter of every loop in
     which the one thing the band is about was behind a brass disc, and
     two of the three widths it was photographed at landed inside that
     quarter. So the strike is now a STRIKE: it lands, it rings, and it
     is off the wax again inside four tenths of a second. The die covers
     the impression for eleven hundredths of the cycle and no more, and
     for the other eighty-nine the seal stands clear of its own work.

     The phase is chosen so that too. uTime runs from the frame the
     shader first draws, and the whole window a reader — or a camera —
     can plausibly arrive in, anything from half a second to six, lands
     with the seal up and the impression open. The ONE frame that
     prefers-reduced-motion draws (the harness composes it at uTime two)
     is at cyc 0.26: the seal at the top of its lift, the fresh
     impression under it, all three materials in one frame. */
  float T   = 8.4;
  float cyc = fract(uTime / T + 0.020);

  /* The wax: it takes the impression over the half second the die is
     driving into it, and softens back to a pool over the last second and
     a quarter, under the descending seal. Both ends of the cycle are a
     pool, so the seam closes — and the melt is held off until the very
     end of the hover, because a cycle in which the impression exists is
     a cycle in which the band has a subject. It exists for the whole of
     cyc 0.03 to 0.89: seven seconds of the eight and a half. */
  float grow = smoothstep(0.000, 0.055, cyc);
  float melt = 1.0 - smoothstep(0.830, 0.980, cyc);
  gStruck = grow * melt;
  gWaxR   = mix(0.364, 0.442, gStruck);   // it spreads
  gWaxH   = mix(0.072, 0.060, gStruck);   // and flattens
  // Where the top of the wax is under the die: the crown of the dome at
  // 0.142 while it is a fresh pool, the face at 0.060 once it is struck.
  // Solved off the geometry above and not guessed - and the 0.082 between
  // them IS the press. The die seats a bite BELOW this, not on it.
  float P = 0.142 - 0.082 * gStruck;

  /* The strike. Off the wax on a cubic ease-out that starts almost at
     once, down on a CUBED ease-in so the fall is high and slow for most
     of its length and only the last tenth of it is spent anywhere near
     the impression, and the impact itself is a damped spring written as
     a SINE rather than a cosine: sin(0) is zero, so the seal's position
     is continuous across the seam and only its velocity jumps, which is
     precisely what an impact is. Three visible bounces, dead inside
     seven tenths of a second.

     The two numbers that matter are where hover crosses 0.17, because
     0.17 of the lift is 0.060 of a unit and 0.060 is exactly the height
     at which the die's near edge stops standing between this camera and
     the middle of the impression. Solved rather than guessed: rising it
     crosses at cyc 0.072, falling at cyc 0.959. */
  float up = smoothstep(0.045, 0.235, cyc);
  float iu = 1.0 - up;  up = 1.0 - iu * iu * iu;
  float dn = smoothstep(0.760, 1.000, cyc);  dn = dn * dn * dn;
  float hover = clamp(up - dn, 0.0, 1.0);
  float imp   = -0.032 * exp(-cyc * 34.0) * sin(cyc * 132.0);

  /* THE DIE DOES NOT STOP ON THE WAX. IT GOES INTO IT.
     P is where the TOP of the wax is, and a press whose underside comes
     to rest exactly on that is two discs parked on each other: at the
     bottom of the stroke the seal was sitting on the pool the way a lid
     sits on a jar, and the only thing that ever put brass below the wax
     line was the first half-swing of the spring — a tenth of a second,
     and back out again on the rebound.

     So the seat carries a BITE: the die is driven 0.032 of a unit below
     whatever the wax's top is at that instant, which is a fifth of the
     die's own thickness and, at the pour, nine thousandths under the
     crown where the die's own edge meets it. The two solids genuinely
     intersect — map() unions them, so what is drawn is wax standing
     against brass all the way round the die, with the die rising out of
     it — and they stay intersected through the whole press: the rebound
     tops out at nine thousandths, which is a third of the bite, so the
     brass never leaves the wax between the strike and the lift.

     It is multiplied by (1 - hover), so it is the full bite at the seat
     and exactly zero at the top of the lift: the composition, and the
     header clearance solved against it, do not move. */
  float bite = 0.032 * (1.0 - hover);
  float L = mix(0.355, 0.315, wide);
  gY = P - bite + L * hover + hover * 0.018 * sin(cyc * 15.0 + 0.6) + imp;

  /* Held in a hand, so it is drawn BACK as well as up — a seal is lifted
     off a document the way a hand lifts it, away from the body and to
     the side, not straight up a plumb line. That is the second half of
     the fix: for the whole of the hover the brass stands up and to the
     left of the impression instead of on top of it, so the picture is a
     seal and its work side by side rather than a seal and a red edge.
     It is small — an eighth of a unit left and a sixteenth back, well
     inside the bounding sphere below — and it is multiplied by hover, so
     it is exactly zero at the moment of the strike and at the seam. */
  gSX = hover * (-0.128 + 0.015 * sin(cyc * 10.0 + 1.3));
  gSZ = hover * (-0.062 + 0.009 * sin(cyc *  7.0 + 0.2));
  float tilt = hover * 0.040 * sin(cyc * 8.0 + 0.7);
  gTC = cos(tilt);  gTS = sin(tilt);

  /* ---------------- the camera ----------------
     Low and close: FIFTEEN degrees above the paper and three units out,
     so the seal still comes down towards the reader and the strike is
     still read in profile — but the impression is now a disc with a
     device in it rather than a red line. Eleven degrees was the earlier
     cut, and at eleven degrees a struck seal 0.44 across presents four
     device pixels of face on a phone: everything that had been cut into
     it was there and none of it could be seen. Fifteen is as far as this
     goes — past about twenty the sheet stops being a surface seen along
     and starts being a plan of one, and the strike stops being a strike.
     One cosine of the cycle drifts it a few degrees, which closes on
     itself, and a pointer on the band nudges it — and the pointer's
     range is FLOORED, so no reader can push it back down flat and get
     the picture this whole revision exists to stop. */
  float th = 0.300 + 0.120 * cos(TAU * cyc) + (uPointer.x - 0.5) * 0.26;
  float ph = 0.262 + 0.022 * cos(TAU * cyc + 1.2) + (uPointer.y - 0.5) * 0.070;
  ph = max(ph, 0.205);
  float D  = 3.05;
  vec3  ta = vec3(0.0, 0.30, 0.0);
  vec3  ro = ta + vec3(sin(th) * cos(ph), sin(ph), cos(th) * cos(ph)) * D;
  vec3  ww = normalize(ta - ro);
  vec3  uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
  vec3  vv = cross(uu, ww);

  /* The field of view is solved against the band's HEIGHT, which is the
     only dimension that does not change with the aspect: s0.y runs -1 to
     1 at every width. The bottom sixth is paper the kicker sits on and
     the top eighth is under a DOCKED HEADER that floats over the band —
     so the whole picture is pushed down a fortieth of the band's height
     from where it would naturally sit. Measured at all three widths: the
     finial clears the header by sixteen pixels at 820, which is where it
     was tightest, and the near lip of the wax is still above the line
     where the kicker's paper begins. The lift is shortened a touch on a
     long band, where height is the scarcest thing there is. */
  float halfH = mix(1.250, 1.215, wide);
  float yOff  = mix(-0.070, -0.045, wide);
  float xOff  = 0.16 * wide;
  vec2  s     = vec2(s0.x - xOff, s0.y - yOff);
  vec3  rd    = normalize(s.x * uu + s.y * vv + (D / halfH) * ww);
  // One device pixel in world units per unit of distance travelled. The
  // march converges to a pixel rather than to a fixed epsilon, which is
  // the whole of the edge antialiasing further down.
  float pxk   = 2.0 * halfH / (D * uRes.y);

  /* ---------------- the desk, found rather than marched ----------------
     The paper is one plane and one divide finds it exactly. That is the
     entire reason a camera this low is affordable: a grazing ray against
     a box field converges a step at a time and would eat the whole
     budget before it reached the seal. */
  float tP = (rd.y < -0.0020) ? (-ro.y / rd.y) : -1.0;

  /* ---------------- the window ----------------
     One band of light crossing the desk every fourteen seconds, in WORLD
     space, so the same light that washes the paper also rakes the brass
     and travels round the knob.

     It sweeps twelve units for a desk that is four wide in shot, which is
     not slack: at six units out the gaussian is four thousandths, so the
     WRAP happens with the beam genuinely off the picture. At three units
     it was still seven per cent lit at the edge of the sheet, and what
     that buys you is a step in the brightness of one corner of the band
     every fourteen seconds that nobody can explain. */
  float lanex = fract(uTime / 14.0) * 12.0 - 6.0;

  /* ---------------- the wall behind it ---------------- */
  vec3 bg;
  {
    vec3 hi = mix(uColors[1], uInk, 0.20);
    vec3 lo = mix(uColors[1], uColors[2], 0.44);
    bg = mix(lo, hi, smoothstep(0.00, 0.60, rd.y));
    /* The window itself, which does not travel — only the light it throws
       across the desk does. Sliding this with the beam put a moving bright
       patch on a wall, which is a thing walls do not do, and it wrapped. */
    float wx = (s.x + 0.60) / 0.88;
    bg = mix(bg, uColors[3], exp(-wx * wx) * smoothstep(0.00, 0.34, rd.y) * 0.30);
    // The far corners taken down, so the band has a centre.
    bg = mix(bg, mix(uColors[1], uInk, 0.14),
             smoothstep(0.55, 1.70, abs(s.x) / max(asp, 0.8)) * 0.34);
  }

  vec3 col = bg;

  if (tP > 0.0) {
    vec3  pw = ro + rd * tP;
    vec2  xz = pw.xz;
    /* The footprint of one device pixel on the plane, along each axis.
       Both are exact and at this angle they are wildly different, which
       is why every pattern below is gated against its OWN axis instead of
       every mark on the page being thrown away to protect one of them. */
    float pxx = tP * pxk;
    float pxz = tP * pxk / max(-rd.y, 0.035);
    float pe  = max(pxx, pxz);

    float SW  = mix(0.92, 1.62, wide);
    float SZF = mix(1.35, 1.88, wide);
    float SZN = mix(1.30, 1.62, wide);
    // Signed distance to the sheet, in the plane. One field, used for the
    // silhouette, the contact shadow and the cast one.
    vec2  ctr = vec2(0.0, (SZN - SZF) * 0.5);
    vec2  ext = vec2(SW, (SZN + SZF) * 0.5);
    vec2  dq  = abs(xz - ctr) - ext;
    float dr  = length(max(dq, 0.0)) + min(max(dq.x, dq.y), 0.0);
    float onSheet = smoothstep(pe * 1.2, -pe * 1.2, dr);

    /* ---- the desk ----
       It is DARKER as it comes towards the reader, and as it goes away it
       lands on exactly the tone the wall has at the horizon. That is the
       whole trick to a band with no horizon LINE in it: the first cut had
       the desk light where the wall behind it was lighter still, and what
       crossed the picture was a glowing bar nobody had drawn. */
    vec3 desk = mix(mix(uColors[1], uColors[2], 0.44), mix(uColors[1], uInk, 0.36),
                    smoothstep(-2.4, 1.4, xz.y));
    desk = mix(desk, mix(uColors[1], uInk, 0.30), smoothstep(1.1, 2.9, abs(xz.x)) * 0.45);

    /* ---- the paper ----
       Cream, and the palest thing in the frame by a distance, which is
       the right way round: paper is what a violet-grey room is measured
       against. Laid lines running with the page and chain lines across
       it, each one gated against the pixel it would have to fit in — the
       instant a rule cannot hold a pixel it fades, rather than striping
       the sheet with the moire that killed two earlier versions of this
       file. */
    vec3 paper = PAPERC;
    float laid  = abs(fract(xz.x * 44.0) - 0.5) * 2.0;
    float chain = abs(fract(xz.y *  5.6) - 0.5) * 2.0;
    paper *= 1.0 - smoothstep(0.50, 1.0, laid)  * smoothstep(0.30, 0.05, pxx * 44.0) * 0.028;
    paper *= 1.0 + smoothstep(0.82, 1.0, chain) * smoothstep(0.30, 0.05, pxz *  5.6) * 0.020;
    paper *= mix(1.03, 0.90, smoothstep(-1.6, 1.3, xz.y) * 0.62 + smoothstep(-1.5, 1.5, xz.x) * 0.38);

    /* ---- what is printed on it ----
       A deed: a heading, a block of body, the rule, the attestation and
       two signature lines with the wax between them, which is where a
       seal goes and the only reason the page needs one. Everything is a
       rectangle in PAPER coordinates, so a mark is the size it is meant
       to be. And every mark is sized against the PIXEL IT MUST FIT IN at
       the depth it sits at: the first cut of this used a printer's
       hairline for the rules, and what a hairline becomes at eleven
       degrees is a scratch. */
    vec2 aa = vec2(pxx, pxz) * 0.9;
    float typ = 0.0, hvy = 0.0;

    hvy += bar(xz, vec2(0.000, -1.185), vec2(0.265, 0.0300), aa) * 0.88;
    typ += bar(xz, vec2(0.000, -1.100), vec2(0.150, 0.0190), aa) * 0.60;

    /* Five rows of body, with real word breaks in them. Four bars of
       unequal length is a loading skeleton; a line that breaks into
       words is a line of type. Every tier draws all five — the tier buys
       back march steps here, never the subject. */
    for (int i = 0; i < 5; i++){
      float fi = float(i);
      float zc = -1.000 + fi * 0.104;
      float rh = hash(vec2(fi * 3.7 + 1.0, 7.3));
      float ln = (i == 4) ? (0.34 + 0.18 * rh) : (0.76 + 0.22 * rh);
      float x1 = -0.740 + 1.480 * ln;
      float wp = 0.094 + 0.034 * fract(rh * 53.0);
      float wu = (xz.x + 0.74 + 0.30 * fract(rh * 191.0)) / wp;
      float we = 0.58 + 0.28 * hash(vec2(floor(wu), fi + 2.0));
      float gw = max(pxx / wp, 0.060);
      float wd = smoothstep(we * 0.5 + gw, we * 0.5 - gw, abs(fract(wu) - we * 0.5));
      float rw = smoothstep(0.0235 + pxz * 0.9, 0.0235 - pxz * 0.9, abs(xz.y - zc));
      float rn = smoothstep(-0.740 - pxx, -0.740 + pxx, xz.x)
               * smoothstep(x1 + pxx, x1 - pxx, xz.x);
      typ = max(typ, rw * rn * wd * 0.78);
    }

    hvy += bar(xz, vec2( 0.000, -0.505), vec2(0.740, 0.0215), aa) * 0.92;
    typ += bar(xz, vec2(-0.395, -0.420), vec2(0.345, 0.0210), aa) * 0.70;
    typ += bar(xz, vec2(-0.505, -0.330), vec2(0.235, 0.0190), aa) * 0.56;

    /* The two signature rules, one either side of the seal, with a printed
       name under each — which is what a sealed deed actually looks like.
       Thick and short, because a printer's hairline seen at fifteen degrees
       is not a rule, it is a scratch with ragged ends, and two of those
       either side of the seal were the last thing in this file that read
       as a defect rather than as a document. */
    hvy += bar(xz, vec2(-0.645,  0.108), vec2(0.180, 0.0300), aa) * 0.62;
    hvy += bar(xz, vec2( 0.645,  0.108), vec2(0.180, 0.0300), aa) * 0.62;
    typ += bar(xz, vec2(-0.700,  0.244), vec2(0.120, 0.0260), aa) * 0.46;
    typ += bar(xz, vec2( 0.590,  0.244), vec2(0.120, 0.0260), aa) * 0.46;

    // The hand on the page. The only thing here that is not a rectangle.
    float sgx = clamp(xz.x, -0.860, -0.470);
    float sgz = 0.050 + 0.040 * sin((sgx + 0.47) * 16.0) + 0.020 * sin((sgx + 0.47) * 7.0);
    typ += smoothstep(max(0.0115, pxz * 1.3), 0.0, abs(xz.y - sgz))
         * smoothstep(-0.866, -0.848, xz.x) * smoothstep(-0.462, -0.482, xz.x) * 0.85;

    typ *= smoothstep(0.02, 0.46, uEnter);
    hvy *= smoothstep(0.02, 0.46, uEnter);
    paper = mix(paper, mix(TYPEC, uInk, 0.22), clamp(typ, 0.0, 1.0) * 0.72);
    paper = mix(paper, mix(TYPEC, uInk, 0.34), clamp(hvy, 0.0, 1.0) * 0.86);

    /* ---- where the hot wax has bled into the sheet ---- */
    float bl = length(xz) - gWaxR * 1.02;
    paper = mix(paper, mix(paper, WAXC, 0.26),
                smoothstep(0.030, 0.001, bl) * mix(0.34, 0.18, gStruck));

    vec3 plane = mix(desk, paper, onSheet);

    /* ---- the shadows, which are four lengths and not a shadow ray ----
       The shadow of a HORIZONTAL disc cast on a HORIZONTAL plane along a
       fixed direction is a translated circle of the same radius. So the
       die's cast shadow, the knob's, the wax's own and the ambient the
       press keeps off the sheet are exact, cost four square roots between
       them, and — the point — every tier gets them. That is the whole
       reason a phone here sees the same picture as a desktop and only
       marches half as far. */
    float sh = castDisc(xz, vec2(gSX, gSZ), 0.300, gY);
    sh = max(sh, castDisc(xz, vec2(gSX, gSZ), 0.148, gY + 0.664) * 0.42);
    // And the one that cannot leave the object: see contact(), above.
    float dieAmb = contact(xz, gY);
    sh = max(sh, dieAmb);
    // What the key throws past the pool's rim, offset by its own thickness.
    vec2 wo = xz - SOFF * gWaxH;
    sh = max(sh, smoothstep(0.020, -0.020, length(wo) - waxR(wo)) * 0.88);

    /* ---- and the SEAMS, which are not the same thing as a shadow ----
       A cast shadow is the key taken away and the room left behind. A
       contact is both gone: in the last few millimetres before two
       surfaces meet there is nothing left that can reach the sheet at all,
       which is why the darkest thing in a photograph of a desk is always a
       seam and never a shadow. They are two quantities of light, so they
       get two mixes below rather than one.

       Three of them, and each one is a place where something in this scene
       is genuinely touching something else in it:

         the pool's rim on the paper — the whole of what was missing. What
           stood here before was the pool's own silhouette shifted forty
           thousandths along the key: a disc of shadow under a disc of wax
           of the SAME RADIUS, so all but a sliver of it was hidden behind
           the very thing casting it and the sheet came back bare. The seam
           is the part that can be seen, it is lobed like the pool so it
           cannot peel away from it, and it is flat-topped rather than
           squared — squaring it halved its width at the near rim, which at
           fifteen degrees is the two pixels that have to carry it.
         the die on the wax, once the die is nearly down. Its occlusion is
           an ambient term while the press is up and a true contact once it
           is within a tenth of a unit of the surface, so the mark hardens
           into the seat rather than staying a haze through the strike.
         the sheet's edge on the desk. This was a flat violet band laid
           down beside the paper — a painted offset rectangle, which is the
           one thing a contact may not be. It is a LINE and not a band. A
           sheet of laid paper is a tenth of a millimetre thick and its
           honest seam is narrower than a pixel here, so the width is the
           one number in this block chosen to be seen rather than solved:
           two and a half millimetres, which is four screen pixels at both
           widths. At four times that — where it started — a sealed deed
           came back with a dark border inked round it, which is a
           rectangle with a stroke on it and not a sheet lying on a desk.
           The soft half of the mark lives in sh rather than here. */
    float dE = max(dr, 0.0);
    /* Measured from where the pool actually TOUCHES, which is not its
       silhouette: the body is a rounded cylinder with a corner radius of
       0.026, so it meets the sheet a little inside the widest point it
       shows and the rolled rim overhangs the last of it. That is two
       hundredths of a unit of sheet that is already fully shut out by the
       time it is first visible, and at fifteen degrees those two
       hundredths are the whole of what the NEAR rim can show — measured
       from the silhouette instead, the seam started its falloff on the
       first pixel of paper there and never got dark. */
    float core = smoothstep(0.135, 0.050, max(length(xz) - waxR(xz) + 0.020, 0.0)) * 0.98;
    core = max(core, dieAmb * (1.0 - smoothstep(0.0, 0.090, gY)));
    core = max(core, smoothstep(0.040, 0.006, dE) * (1.0 - onSheet) * 0.92);
    sh   = max(sh,   smoothstep(0.100, 0.012, dE) * (1.0 - onSheet) * 0.46);

    /* A shadow is LESS OF THE LIGHT, not a colour laid over the surface.
       This was a mix toward a violet, which means a shadow that carries
       none of the paper it is lying on: cream went lilac wherever the
       seal covered it, and the darker the shadow the less the sheet was
       made of paper. So the plane is taken DOWN and given a little of the
       room's own violet back as the ambient a shadow in a violet room
       really has, which is a tint and cannot overshoot.

       The old numbers were the other half of why this band read as
       shadowless: at FULL strength they left sixty per cent of the sheet's
       own brightness in the darkest pixel of the mark, and sixty per cent
       of cream paper is not a shadow, it is slightly duller cream. */
    vec3  amb = mix(uColors[1], uInk, 0.72);
    float shc = clamp(sh, 0.0, 1.0);
    float cor = clamp(core, 0.0, 1.0);
    plane = mix(plane, plane * 0.300 + amb * 0.115, shc);
    plane = mix(plane, plane * 0.030 + amb * 0.065, cor);
    shc = max(shc, cor);

    /* Paper at a grazing angle is bright — that is why a photograph of a
       desk from this height has a sheen running up the sheet — and the
       window crossing it is the same light that rakes the brass. */
    float graze = clamp(1.0 + rd.y * 1.35, 0.0, 1.0);
    graze = graze * graze;
    float lz = (xz.x - lanex) / 0.85;
    float bm = exp(-lz * lz) * (1.0 - shc * 0.85);
    plane = mix(plane, mix(plane, uColors[3], 0.62), bm * 0.40 * onSheet + bm * 0.22 * (1.0 - onSheet));
    /* And the sheen is OCCLUDED too, which the cut before this forgot. A
       grazing highlight is the room reflected in the paper, and the four
       square inches of paper that cannot see the room cannot reflect it:
       left ungated it laid a seven per cent white floor under everything,
       which is enough to stop any contact on a cream sheet ever going
       dark — the shadow was being drawn and then lit back up again. */
    plane = mix(plane, mix(plane, vec3(1.0), 0.55),
                graze * 0.30 * onSheet * (1.0 - shc * 0.88));

    // Air. The desk dissolves into the room rather than ending in a line
    // at the horizon.
    float fog = 1.0 - exp(-max(tP - 4.4, 0.0) * 0.22);
    col = mix(plane, bg, clamp(fog, 0.0, 1.0));
  }
  vec3 behind = col;

  /* ---------------- one march, and only where there is something ----
     The object's bounding sphere is intersected ANALYTICALLY first. A
     ray that misses it never calls map() once, which is most of the band
     — and it is why a scene with this much geometry in it fits inside
     twenty-four steps on a phone. */
  /* The sphere is solved rather than guessed, because its AREA is the
     share of the band that pays for the march: the two points furthest
     from the centre are the far lip of the spread wax at 0.698 and the
     finial at full lift, drawn back an eighth of a unit and tilted, at
     0.736 — and centring on 0.52 balances them. 0.82 is that plus a
     twentieth of a unit, which at this distance is ten pixels on a
     phone: twelve times the antialiasing band below, so nothing the
     coverage test could ever want is outside it. Against a lazy sphere
     of 1.0 it is a third fewer marched fragments on a phone, where two
     thirds of a 4:5 band falls inside the silhouette anyway. */
  vec3  oc = ro - vec3(0.0, 0.52, 0.0);
  float bb = dot(oc, rd);
  float cc = dot(oc, oc) - 0.6724;
  float disc = bb * bb - cc;

  if (disc > 0.0) {
    float sq = sqrt(disc);
    float t0 = max(-bb - sq, 0.05);
    float tEnd = min(-bb + sq, tP > 0.0 ? tP : 60.0);

    if (tEnd > t0) {
      int   steps = uTier > 0.75 ? 48 : uTier > 0.25 ? 36 : 24;
      float t = t0, near = 1e9, nt = t0;
      for (int i = 0; i < 48; i++){
        if (i >= steps) break;
        float h = map(ro + rd * t);
        float rel = h / max(t * pxk, 1e-6);
        if (rel < near) { near = rel; nt = t; }
        if (rel < 0.28) break;
        /* Under-relaxed. The thinnest thing in this field is the
           squeeze-out rim: eighteen thousandths wide and ten high on a
           fresh pour. A full step against a wall that thin overshoots it
           on the way in and stipples its edge, so the march advances by
           0.86 of what the field reports and never by all of it. */
        t += h * 0.86;
        if (t > tEnd) break;
      }
      /* The march remembers its closest approach IN PIXELS, and that one
         float is the whole of the edge antialiasing: a ray that missed by
         half a pixel is shaded where it came nearest and blended in by
         how near it came, so the knob and the die have soft silhouettes
         without a second sample anywhere.

         The band is kept NARROW, and that is a bug fix rather than taste.
         A ray that creeps along the tangent of the wax disc can run out of
         steps while the field still reads a hundredth of a unit, which is
         about one and a quarter pixels — so a wide band let every
         exhausted ray for fifteen pixels either side of the seal paint
         itself part wax, and what stood round the impression was a red
         haze on the paper that nothing had cast. */
      float cover = smoothstep(0.86, 0.22, near);

      if (cover > 0.003) {
        vec3 pos = ro + rd * nt;
        vec3 nor = normalAt(pos);

        // Which of the two it is, evaluated once, at the surface.
        vec3  sp = sealLocal(pos);
        float dW = sdWax(pos);
        float dS = sdSeal(sp);

        float occ = clamp(map(pos + nor * 0.055) / 0.055, 0.0, 1.0);
        if (uTier > 0.25) occ = 0.5 * occ + 0.5 * clamp(map(pos + nor * 0.175) / 0.175, 0.0, 1.0);
        occ = mix(occ, 1.0, 0.30);

        float opx = nt * pxk;
        vec3  hal = normalize(LIG - rd);
        float lo2 = (pos.x - lanex) / 0.85;
        float bm2 = exp(-lo2 * lo2);
        vec3  c;

        if (dW < dS) {
          /* ---------------- sealing wax ----------------
             Deep red, soft, and lit THROUGH as much as it is lit on.
             While it is molten it is warmer; once it has taken the
             impression it settles to the colour of a wax seal that has
             cooled. */
          // The device, struck in relief on the face. A real 2D field, so
          // the bevel has a lit side and a shaded one — which is the only
          // reason the scales read at a camera this low.
          float upf = clamp(nor.y, 0.0, 1.0);
          upf = upf * upf;
          float d0 = devField(pos.xz);
          vec2  gq = vec2(devField(pos.xz + vec2(0.0055, 0.0)) - d0,
                          devField(pos.xz + vec2(0.0, 0.0055)) - d0);
          float gl = length(gq);
          vec2  gd = gl > 1e-6 ? gq / gl : vec2(0.0, 0.0);
          float rel2 = smoothstep(0.010, -0.004, d0) * gStruck * upf;
          float bz   = d0 / 0.0120;
          float bev  = exp(-bz * bz) * gStruck * upf;
          nor = normalize(nor + vec3(gd.x, 0.0, gd.y) * bev * 0.80);

          float fre = clamp(1.0 + dot(nor, rd), 0.0, 1.0);
          fre = fre * fre * fre;
          vec3  env = roomEnv(reflect(rd, nor));
          vec3  wa  = mix(WAXHOT, WAXC, gStruck);
          // The floor of an impression is duller than the relief on it.
          wa *= mix(0.88, 1.04, rel2 + (1.0 - gStruck) * 0.5);

          // Wax scatters: light wraps round it rather than stopping dead
          // at the terminator, which is most of why it does not read as
          // painted metal.
          float wrp = clamp((dot(nor, LIG) + 0.60) / 1.60, 0.0, 1.0);
          wrp = wrp * wrp;
          float ao2 = mix(occ, 1.0, 0.42);
          c = wa * mix(0.32, 1.72, wrp) * ao2;
          /* What a crevice in wax goes to is deep maroon with a little of
             the room in it — never a flat violet. A shadow belongs to the
             light, and the light here is a window over a cream sheet. */
          c = mix(c, mix(WAXC * 0.20, uInk, 0.26), (1.0 - occ) * 0.40);
          // What comes through a thin edge of it.
          c += WAXSSS * fre * (0.30 + 0.26 * (1.0 - gStruck)) * ao2;
          // A broad waxy highlight, and the room in it at a glance.
          /* A pool still molten is GLOSSY and a cooled seal is not, so
             the highlight is two: a broad waxy sheen both states have, and
             a tight wet one that only the fresh pour gets. */
          float spw = pow(max(dot(nor, hal), 0.0), 26.0);
          float spg = pow(max(dot(nor, hal), 0.0), 70.0);
          c += vec3(1.0, 0.95, 0.90) * spw * (0.32 + 0.40 * rel2) * (0.40 + 0.60 * bm2);
          c += vec3(1.0, 0.97, 0.94) * spg * (1.20 * (1.0 - gStruck) + 0.14);
          c = mix(c, env * 0.55 + WAXC * 0.45, fre * 0.30);
          c = mix(c, mix(c, uColors[3], 0.30), bm2 * 0.20);

          /* And the press standing over its own work keeps the room off
             the WAX, which is the surface actually under it — MOST of
             this shadow's ground is. Photographed with the pool painted
             in, the plane's own contact turned out to be almost entirely
             hidden: at fifteen degrees a disc of wax 0.88 across and 0.09
             thick covers nearly every square unit of sheet the raised
             seal stands over, so a contact drawn only on the paper is a
             contact nobody sees. This is the same disc, measured from the
             wax's own top rather than the paper's, and it is what carries
             the reading — the impression darkens under the die as the
             press comes back down onto it and clears as it lifts away.

             Scaled by how far the surface faces up, because nothing
             overhead shades a vertical wall, and held a little under
             full, because this one lands on the subject of the band and
             has to stay a shadow rather than become a stain. */
          /* Two marks, and they are not the same mark. The ambient one is
             broad, centred on the seal's own axis and weak — it says the
             press is over SOMETHING. The CAST one is the die's own disc,
             thrown along the key onto the wax's top from the die's height
             above it, and it is the one that says how far over: it lands
             offset, it tightens and darkens as the press comes down onto
             the impression, and it opens and fades as the seal lifts away.
             Held at a little over half strength on the ambient so the two
             do not stack into a flat veil over the subject of the band. */
          float wgap = gY - pos.y;
          float wsh  = max(castDisc(pos.xz, vec2(gSX, gSZ), 0.300, wgap),
                           contact(pos.xz, wgap) * 0.55);
          c = mix(c, c * 0.26 + mix(WAXC * 0.20, uInk, 0.26) * 0.10,
                  clamp(wsh, 0.0, 1.0) * clamp(nor.y, 0.0, 1.0) * 0.94);

        } else {
          /* ---------------- aged brass ----------------
             Mostly what it REFLECTS, which here is a violet-grey room —
             and that is exactly what keeps it in the band rather than on
             top of it. What is its own is the albedo underneath: brass
             where it is handled and polished, tarnish where it is not,
             and a green-grey patina down in the angles where a working
             seal collects one. */
          float ry = sp.y, rr = length(sp.xz);
          vec2  u  = rr > 1e-4 ? sp.xz / rr : vec2(1.0, 0.0);
          vec3  alb = BRASS;

          // The knurl on the collar: thirty-two flutes by five angle
          // doublings, gated off the moment they cannot hold a pixel.
          float c1 = u.x, s1 = u.y;
          for (int i = 0; i < 5; i++){ float n = c1 * c1 - s1 * s1; s1 = 2.0 * c1 * s1; c1 = n; }
          float onCol = smoothstep(0.222, 0.242, ry) * smoothstep(0.368, 0.348, ry);
          /* The gate is the pixel against the flute's own ARC, r*2pi/32.
             The first cut of this divided by the flute COUNT instead, and
             gated the knurl off on every device there is. */
          float knA = smoothstep(0.44, 0.12, opx * 5.1 / max(rr, 0.05));
          float knurl = onCol * knA * smoothstep(-0.10, -0.95, c1);
          alb = mix(alb, BRASSD, knurl * 0.80);

          // Turning marks round the die's wall.
          float trn = abs(fract(ry * 34.0) - 0.5) * 2.0;
          alb = mix(alb, BRASSD, trn * smoothstep(0.34, 0.06, opx * 34.0) * 0.16
                                     * smoothstep(0.144, 0.104, ry));
          // Tarnish in the angles, patina under the knob, a polished
          // handle where a hand has been.
          alb = mix(alb, PATINA, smoothstep(0.145, 0.275, ry) * smoothstep(0.630, 0.410, ry) * 0.60);
          alb = mix(alb, BRASSD, smoothstep(0.205, 0.145, ry) * 0.40);
          alb = mix(alb, vec3(0.672, 0.514, 0.254), smoothstep(0.590, 0.720, ry) * 0.40);
          alb = mix(alb, BRASSD, (1.0 - occ) * 0.72);

          float fre = clamp(1.0 + dot(nor, rd), 0.0, 1.0);
          fre = fre * fre * fre;
          vec3  env = roomEnv(reflect(rd, nor));
          float dif = max(dot(nor, LIG), 0.0);

          /* The key takes brass from its own dark to its own albedo and
             only the top of the range lifts toward white. Ramping to
             near-white is what erases every mark in an albedo — a
             tarnish line lifted to the tone of the metal round it is a
             tarnish line that was never drawn. */
          float key = dif * dif * (3.0 - 2.0 * dif);
          vec3  mat = mix(BRASSD * 0.42, alb, key);
          mat = mix(mat, mix(alb, vec3(1.0), 0.28), smoothstep(0.66, 1.0, key) * 0.40);
          // Bounced off the cream sheet below, which is a real light here.
          float bnc = clamp(0.20 + 0.80 * dot(nor, vec3(0.06, -1.0, 0.10)), 0.0, 1.0);
          mat = mix(mat, mix(alb, PAPERC, 0.50), bnc * 0.26);

          // And then the room, which for a metal is most of the surface.
          vec3 F = BRSPEC + (1.0 - BRSPEC) * fre;
          float poli = mix(0.52, 0.86, occ) * (1.0 - knurl * 0.45);
          c = mix(mat, env * F, poli);
          // Down in the angles brass goes to its own tarnish carrying a
          // little of the room, not to the house violet: a crevice painted
          // uInk is a purple line drawn on a gold object.
          c = mix(c, mix(BRASSD * 0.30, uInk, 0.28), (1.0 - occ) * 0.52);

          /* Two highlights. A tight one for the polished faces, and a
             BROAD WEDGE across anything turned — a surface that scatters
             along the circle throws the bowtie you see on every machined
             brass face, and it is the single thing that says "turned
             metal" rather than "a shape with a shiny spot on it". */
          float spc = pow(max(dot(nor, hal), 0.0), 150.0);
          vec3  tgl = vec3(-u.y, 0.0, u.x);
          vec3  tgw = vec3(gTC * tgl.x - gTS * tgl.y, gTS * tgl.x + gTC * tgl.y, tgl.z);
          float ht  = dot(tgw, hal);
          float ani = pow(max(1.0 - ht * ht, 0.0), 30.0) * (1.0 - abs(nor.y)) * 0.55;
          c += BRSPEC * (max(spc, ani) * (1.15 + 2.10 * bm2));
          c = mix(c, mix(c, uColors[3], 0.42), bm2 * 0.20 * (0.30 + 0.70 * dif));
          // An edge, so brass never dissolves into a violet wall.
          c = mix(c, mix(BRSPEC, uColors[3], 0.45), fre * 0.22);
        }

        // The far side of anything takes the room.
        c = mix(c, bg, smoothstep(3.7, 4.7, nt) * 0.50);
        col = mix(behind, c, cover);
      }
    }
  }

  // The reveal: the desk is already there, the seal arrives on it.
  col = mix(bg, col, e);
  // A little tooth, so the long wash into white never bands on a cheap
  // panel — which is the only sort of panel this will be watched on.
  col += (hash(gl_FragCoord.xy + fract(uTime) * 71.0) - 0.5) * 0.016;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export const scene: Scene = {
  frag,
  colors: ["#551a89", "#a996c0", "#f4f3f7", "#ffffff"],
  /* The seal lifted clear of its own impression, as far as stacked
     gradients can carry it — and they have to carry it, because this is
     what a reader on a slow phone looks at until the shader has compiled
     and what a device with no WebGL is left with for good. Solved at
     390x488, the band a phone gets, and measured off the shader's own
     frame at uTime two rather than guessed: every centre and radius below
     came off a row-by-row scan of that render.

     AND EVERY RADIAL GRADIENT HERE ENDS ON A TRANSPARENT STOP. The cut
     this replaces did not: four of its blobs ended on an opaque colour,
     and a radial gradient carries its last stop out to the corners of the
     box. Three brass ellipses each filled the whole band with their own
     dark rim, the topmost of them won, and what the poster actually
     painted — on every phone slow enough to see it, and for good on
     anything without WebGL — was a brown rectangle with a small gold
     stalk in the middle of it. It is the one part of this band nobody
     screenshots, because by the time you look the canvas is over it. */
  poster:
    // The finial, the knob and the shaft of the seal, held above the page.
    "radial-gradient(11px 7px at 43.2% 14.5%, #dab76e 0 45%, #9a7639 84%, rgb(255 255 255 / 0) 100%), " +
    "radial-gradient(29px 19px at 43.2% 19.7%, #e9c680 0%, #c1964c 44%, #7b5b29 80%, #402f14 95%, rgb(255 255 255 / 0) 100%), " +
    "linear-gradient(90deg, rgb(255 255 255 / 0) 0 40.3%, #6d5124 40.3% 41.5%, #cfa758 41.5% 44.6%, #7d5b28 44.6% 46.4%, rgb(255 255 255 / 0) 46.4%) 50% 25.4% / 100% 9.8% no-repeat, " +
    // The knurled collar, the turned boss and the broad die under them.
    // Their vertical extents OVERLAP on purpose: three ellipses with
    // daylight between them is a snowman, not a turned handle.
    "radial-gradient(27px 12px at 43.8% 34.2%, #d5ac5f 0%, #9d7535 54%, #4c3718 86%, rgb(255 255 255 / 0) 100%), " +
    "radial-gradient(38px 17px at 43.8% 38.8%, #dab264 0%, #a27939 56%, #503a19 88%, rgb(255 255 255 / 0) 100%), " +
    "radial-gradient(57px 20px at 43.7% 44.3%, #f1cc7f 0%, #b98843 40%, #75541f 74%, #33240b 94%, rgb(255 255 255 / 0) 100%), " +
    "radial-gradient(55px 9px at 43.7% 47.3%, #3b2b12 0 52%, rgb(59 43 18 / 0) 100%), " +
    // What the lifted seal keeps off the sheet, down and right of the key.
    "radial-gradient(84px 19px at 52.5% 51.8%, rgb(85 26 137 / 0.22) 0%, rgb(85 26 137 / 0) 100%), " +
    // The impression: the raised squeeze-out rim, the struck face inside
    // it, and the thickness of cooled wax standing off the page.
    "radial-gradient(89px 36px at 50.3% 61.1%, rgb(255 255 255 / 0) 0 60%, #932019 66%, #c4382b 76%, #6e1210 90%, rgb(255 255 255 / 0) 100%), " +
    "radial-gradient(62px 24px at 48.8% 60.2%, rgb(255 255 255 / 0) 0 78%, rgb(198 62 48 / 0.34) 88%, rgb(255 255 255 / 0) 100%), " +
    "radial-gradient(40px 15px at 45.5% 58.6%, rgb(222 71 56 / 0.85) 0%, rgb(222 71 56 / 0) 100%), " +
    "radial-gradient(84px 32px at 47.5% 59.4%, #a3201a 0%, #7a1513 52%, #4a0b0c 86%, rgb(74 11 12 / 0) 100%), " +
    "radial-gradient(80px 16px at 50.3% 65.0%, #4c0a0b 0 58%, #2a0506 86%, rgb(42 5 6 / 0) 100%), " +
    "radial-gradient(104px 26px at 56.5% 63.6%, rgb(85 26 137 / 0.24) 0%, rgb(85 26 137 / 0) 100%), " +
    // The type on the deed: the body block over the wax, and a signature
    // rule either side of it, which is where a seal goes on a sealed deed.
    "linear-gradient(90deg, #6a635b 0 100%) 11.4% 61.4% / 15% 0.8% no-repeat, " +
    "linear-gradient(90deg, #6a635b 0 100%) 93.1% 62.6% / 17% 0.8% no-repeat, " +
    "linear-gradient(90deg, #7a746d 0 100%) 74.0% 53.6% / 42% 0.7% no-repeat, " +
    "linear-gradient(90deg, #837d76 0 100%) 70.0% 52.2% / 46% 0.6% no-repeat, " +
    "linear-gradient(90deg, #8a847d 0 100%) 73.0% 50.9% / 44% 0.6% no-repeat, " +
    "linear-gradient(90deg, #8a847d 0 100%) 68.0% 49.6% / 48% 0.5% no-repeat, " +
    /* The sheet of cream laid paper, and the wall behind the whole thing.
       The scene has the sheet's near corner running back into the room at
       the left, and a wedge of wall in the bottom corner with it; every
       shape a CSS gradient can make of that at one aspect becomes a
       violet cloud at another, so the poster carries the sheet edge to
       edge. It has about a second and a half to be right. */
    "linear-gradient(to bottom, rgb(255 255 255 / 0) 0 48%, #f4edda 51% 78%, rgb(244 237 218 / 0) 88%), " +
    "linear-gradient(to bottom, #bfb0d0 0%, #c8bbd7 24%, #c6b9d5 44%, #b09ac7 58%, #9d82ba 68%, #e4dcef 84%, #ffffff 94%)",
  alt: "A heavy brass desk seal stamping a document: it comes down out of the top of the frame onto a pool of deep red sealing wax lying on a sheet of cream laid paper, drives in, rebounds, and is drawn up and back out of the way — leaving an impression, a spread disc with a raised rim round it and the scales of justice struck in relief inside a beaded border, with the seal standing over it. The camera is low and close to the sheet, so the strike is read in profile.",
};
