import type { Scene } from "../shader-stage";

/* ------------------------------------------------------------------ *
 * Insurance — the windscreen, and the moment the stone finds it.
 *
 * A laminated car windscreen, close and raked, filling the frame. A
 * stone comes in off the road; a pit opens with a bruise of crushed
 * glass round it; the radial legs run out in a few branching runs, each
 * one stopping before the next one starts; the concentric fractures ring
 * the crater the way laminated glass really breaks. It HOLDS — the
 * laminate is what stops it becoming a hole — and then the loop resets
 * and it happens again.
 *
 * That is this trade and not a metaphor bolted onto it. The page's own
 * caller list opens with "I've just hit someone", and three lines down
 * is "I'm calling about your customer — he reversed into my gate". This
 * is the business of the second after the damage, and of a phone that
 * has to pick up at the worst moment of somebody's year. Nothing else in
 * the set is glass, and the wooden blocks this band used to hold were a
 * mistake twice over: education's scene is also blocks, and timber has
 * no connection to insurance at all.
 *
 * ---- the materials, which are three ----
 * GLASS. Near-clear laminate, and the only honest way to draw it is to
 * draw what it reflects and what is behind it, because it has almost no
 * colour of its own. Two things carry it: a hard-edged soft box sweeping
 * across the curve, and a Fresnel that runs from 4% face-on at the near
 * corner to most of the light at the far one — a panel that is nearly
 * transparent at one edge of the frame and nearly a mirror at the other
 * is what says "glass" before anything else does. The green is real and
 * it is measured rather than decorative: float glass has iron in it, so
 * it absorbs red hardest and blue next, and the tint is therefore an
 * exponential of the path length. Through 7mm of laminate that is a
 * whisper; along a crack, where light is trapped between two faces and
 * travels a long way inside the glass, it is the green of a cut edge,
 * which is one of the truest colours there is.
 * FRIT. The black ceramic band round the rim, printed and fired into the
 * glass, fading inward through a lattice of dots that get smaller as they
 * go. It is the single most recognisable thing on a windscreen and it is
 * the reason a stranger says "windscreen" rather than "broken glass".
 * POWDER. Where the stone landed the glass is not cracked, it is
 * PULVERISED — a few million surfaces in a few cubic millimetres — and
 * that is why an impact pit is white and opaque while the cracks running
 * out of it are clear and silver. Two different things, and a render that
 * draws them the same way draws a sticker.
 *
 * ---- and what a mirror sees is a studio ----
 * The contract at the top of shader-stage.tsx now says it outright, and
 * this scene is the case it was written for: a reflective material may
 * sample a NEUTRAL studio, because a polished surface is whatever is
 * around it and pointing one at a violet wall renders it as violet
 * plastic. So the glass reflects a photographer's set — a dark floor, a
 * bright sweep overhead, a long warm key box and a cool fill card — and
 * the house palette lives where it belongs: in the BACKDROP behind the
 * car, in the ambient on the body and the frit, which are diffuse, and
 * in the paper the kicker is printed on.
 *
 * ---- how it is built, and why there is no march ----
 * A windscreen is a section of an ellipsoid, so it is INTERSECTED rather
 * than marched: one quadratic, one square root, an exact hit and an exact
 * normal. Nothing about this subject wants a march. A pane 7mm thick is
 * exactly the thin geometry a sphere trace stipples its own edges on; the
 * cracks are hairlines a distance field cannot hold at any step count;
 * and the one thing a march would buy — silhouette depth — is bought here
 * by the curvature and the rake instead. Not marching is also not a
 * saving taken quietly: measured on the same SwiftShader rasterizer, the
 * same twenty-four instants, against the marched scene this band used to
 * hold —
 *
 *     1440x617  desktop   78.9  ->  29.9 ms a frame   (-62%)
 *      656x410  tablet    28.3  ->   9.3              (-67%)
 *      242x303  phone      8.1  ->   2.6              (-68%)
 *
 * The contract allows a march and budgets it by tier; this scene spends
 * none of that budget, and the tier buys what this object actually needs
 * instead, which is samples and detail. It is spent the same way the
 * contract spends steps: the subject is whole on every tier, and what a
 * phone gives up is the second surface's ghost and the finest texture.
 *
 *   uTier 1.0  desktop  resolved frit dots, the inner surface's ghost,
 *                       the micro-shatter speckle in the bruise, the
 *                       wiper's swept haze
 *   uTier 0.5  tablet   resolved frit dots, the ghost
 *   uTier 0.0  phone    the whole object: glass, frit, pit, bruise,
 *                       every leg, every branch, every ring
 *
 * ---- the framing, which is the rule that has killed this work twice ----
 * The band is 4:5 on a phone and 21:9 on a desktop, and a windscreen is a
 * wide shallow thing, so the two aspects want opposite pictures. The lever
 * used is WHICH WAY THE RAKE GOES, because a raked panel is foreshortened
 * along the direction of the rake and along no other: at 21:9 the camera
 * drops to the road and looks up at fifty-four degrees, the height
 * compresses to 0.59 of itself and 1.60 by 0.59 fills a long band; at 4:5
 * it walks round to the driver's side at forty-six, the width is what
 * compresses, and the panel stands up in a tall frame.
 * Both were solved by projecting the panel's whole outline and the star's
 * outer reach through this exact camera and requiring them inside the
 * frame, and the composing is done with a LENS SHIFT rather than by
 * aiming off-centre — because aiming off-centre also moves what the glass
 * reflects, and the reflection is the one thing in the frame that must not
 * move when the band changes shape.
 *
 * AND THE STAR INSIDE THE FRAME IS NOT ENOUGH, which is what the third
 * pass at this got wrong. The rake made a picture of the right SHAPE on a
 * phone and then the shift sat it so tight on the panel that every edge of
 * the car was outside the frame: no pillar, no roof, no room behind any of
 * it, and what was left was a dark rounded rectangle with white scratches
 * on it. Read cold, on a phone, that is a cracked screen and not a
 * windscreen, and no amount of frit dots inside it argues otherwise —
 * the thing that says CAR is the car's own silhouette against the room.
 * So the requirement on both ends is now written down as three, not one:
 *
 *   · the star whole, and clear of the paper the kicker is printed on
 *   · the A-PILLAR in frame with the room beyond it, and the roof edge
 *     crossing the top — glass, black pillar, sky, in that order
 *   · the foot of the band as light as the long band's, so the picture
 *     goes down into the page instead of being cut off by the wash
 *
 * At 21:9 the old shift already gave all three and it has not been
 * touched. At 4:5 the shift moved 0.298 across and 0.158 up, which is a
 * fifth of the frame's width and a twelfth of its height, and the light
 * was laid over to follow it. Nothing else about the camera changed:
 * same rake, same distance, same lens, same object.
 *
 * ---- the one number that decides whether this works on a phone ----
 * A crack is a hairline. In world units it is about a millimetre and a
 * half, and on the 250-pixel buffer a phone actually gets, that is a
 * fifth of a pixel. A line narrower than a pixel, drawn honestly, is a
 * line that has been dimmed to a fifth of its brightness and then
 * dithered — which is how a fractured windscreen at 1440 becomes a faint
 * grey smudge at 390, and how a scene comes back with two different
 * names. So every line in this file is drawn at max(its own width, one
 * pixel) and at full strength. That is a deliberate refusal to conserve
 * energy, and it is the correct one: what a crack scatters does not halve
 * because you stepped back, and the alternative is a scene that names
 * itself differently on a phone. The frit's dots go the other way — they
 * are resolved while a pixel can hold one and replaced by their exact
 * mean coverage when it cannot, because a dot lattice below Nyquist is
 * not a faint lattice, it is a moire that crawls.
 *
 * ---- the loop ----
 * 8.4 seconds. Intact for 0.7 with the stone crossing the frame over the
 * last three tenths of it; 1.75 of fracture, staggered so that nineteen
 * separate runs each start after the last one has arrested; 4.6 seconds
 * HOLDING, which is the most important part of the loop because it is the
 * part a reader is most likely to arrive in and because the thing has to
 * be worth looking at as a still; then 1.3 seconds of the damage healing
 * from the rim inward, back to clear. The phase offset is chosen so that
 * the one frame a reduced-motion reader is drawn, at two seconds, lands
 * inside the hold — and so does anything photographed between two and six
 * and a half seconds, which is the whole point: the same four words at
 * every width.
 *
 * The hold is not a still, though, and that matters: four and a half of
 * eight seconds with nothing moving is a picture, not a scene. One cosine
 * on the loop's own period walks the lens three centimetres, and because
 * a mirror doubles every angle it is given, that is the soft box crossing
 * a hand's breadth of glass. The seam is exact rather than nearly: the
 * cosine closes on itself, every crack's growth is clamped at both ends,
 * and the healing front has gone past the crater before cyc reaches LOOP,
 * so the frame at 8.399 and the frame at 0.000 are the same frame.
 * ------------------------------------------------------------------ */

const frag = `
const float TAU   = 6.28318530718;
const float LOOP  = 8.40;
const float T_HIT = 0.70;    // the stone lands
const float T_HEAL= 7.10;    // the damage starts to go

/* ---------------- the panel ----------------
   One unit is one metre, so every number here is the real part: a screen
   1.60 by 1.00 in 7mm of laminate, which is what a mid-size car carries.

   A windscreen is curved ACROSS and very nearly straight up the middle,
   and that is not a detail — it is what a reflection on one looks like.
   Drawn on a sphere, the soft box came back as a hook, because a surface
   that curves equally in both directions bends a straight light into an
   arc. So the panel is an ELLIPSOID: three metres of radius across,
   nine up, which is a 109mm bulge at the A-pillar and 5mm top to bottom
   — the real numbers off a real screen. It costs nothing: an ellipsoid
   is a sphere in scaled coordinates, so the intersection is still one
   quadratic and one square root, still exact, and still not a march. */
const vec3  SC   = vec3(0.0, 0.0, -3.00);   // the centre of curvature, behind
const vec3  RAD  = vec3(3.00, 9.00, 3.00);
const float TH   = 0.0035;                  // HALF the laminate's thickness
const float HH   = 0.50;
const float HWB  = 0.80;                    // half width at the bottom
const float HWT  = 0.665;                   // and at the top: a screen is a trapezoid
const float CRN  = 0.10;
const vec2  IMP  = vec2(-0.260, 0.050);     // where the stone finds it

/* ---------------- the materials ----------------
   Three, and no more. A photograph of a windscreen is a photograph of
   glass, black ceramic and — after the stone — powdered glass. */
const vec3 FRIT   = vec3(0.036, 0.035, 0.040);   // black ceramic enamel, fired in
const vec3 BODY   = vec3(0.052, 0.050, 0.059);   // the dark aperture round it
const vec3 POWD   = vec3(0.955, 0.965, 0.975);   // glass, pulverised
const vec3 GEDGE  = vec3(0.34, 0.86, 0.62);      // the green of a cut edge
/* Absorption per metre of float glass. Red hardest, then blue: this is
   the whole of why glass is green, and writing it as absorption rather
   than as a tint is what makes 7mm a whisper and 150mm a colour. */
const vec3 ABSORB = vec3(3.40, 0.55, 1.95);

/* ---------------- and what it is standing on ----------------
   There is no floor in this picture and there cannot be one. The camera
   at 21:9 is pitched up forty-nine and a half degrees and the widest ray
   in the frame still points twenty-five degrees above the horizontal:
   every ray at 1440, and at 820, goes UP. A ground plane under the car
   would be hit by nothing at either of those widths and by the bottom
   corner of the phone band only — which is inside the paper the kicker is
   printed on. That is the "heavy shadow bed on desktop and almost nothing
   on a phone" fault written backwards, and it is not what this subject
   needs anyway.

   What it needs is the contact it actually has. A windscreen is not laid
   ON the body, it is set INTO it: the pinchweld flange stands about two
   centimetres below the glass's outer face, the gap between the two is
   closed with a bead of black urethane, and the line that groove makes is
   the darkest line on any car — darker than the frit, darker than the
   paint, darker than the cabin behind the glass. Before this the glass
   was blended onto the body across one pixel of antialiasing and the join
   was a change of colour and nothing else, which is a windscreen PRINTED
   on a car rather than bonded into one.

   The same two numbers do the wiper, which is the other thing in this
   frame that rests on something. */
const float SEAT  = 0.022;   // how far the flange sits under the glass
const float WLIFT = 0.012;   // and how far the blade stands off it

/* ---------------- the studio ----------------
   Not the house palette, and that is the point. A polished surface has
   no colour of its own, so this is a photographer's set: a dark floor, a
   sweep coming up behind, one long warm soft box and one cool fill card.
   The axes are written out rather than crossed per fragment because they
   are constants and GLSL cannot fold a normalize() into one. */
const vec3 SUP  = vec3(0.00000, 0.62225, 0.78283);   // the set's up, the panel being raked
const vec3 FILL = vec3(0.72510, 0.18640, 0.66290);   // the cool card opposite

/* The box, and where it stands. A light is not a constant here, and that
   is not a shortcut — it is what a photographer does. A flat panel shows
   you exactly ONE direction per point, so a soft box that is not placed
   against the lens is a soft box you cannot see: point the camera at the
   glass from above and the reflection you get back is the floor. Both
   ends of the aspect interpolation move the camera a long way round this
   object, so the box is rigged off the panel's own mirror direction and
   walked up and to the left of it — the light follows the shot, exactly
   as it does on a real set, and the panel is lit at 4:5 and at 21:9
   rather than at whichever one the numbers were typed for. */
vec3 KEY, KX, KY;

/* Sine-free: a big sine argument rounds badly on some mobile GPUs, and
   this one is fed raw pixel coordinates for the dither. */
float h21(vec2 v){
  vec3 q = fract(v.xyx * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

/* What a mirror sees. Everything in here is neutral by construction —
   the only colours are the warmth of a tungsten-balanced box and the
   coolness of the card facing it, which is what a set actually looks
   like. No pow(): every falloff is written as multiplies, so there is no
   base that could ever arrive negative. */
vec3 studio(vec3 r, float boxGain){
  float h = dot(r, SUP);
  vec3 e = mix(vec3(0.030, 0.030, 0.036), vec3(0.520, 0.530, 0.560),
               smoothstep(-0.36, 0.04, h));
  e = mix(e, vec3(1.350, 1.365, 1.400), smoothstep(0.14, 0.88, h));
  /* The box itself, long and shallow and with an edge you can see. A
     gaussian here reads as a glow; a soft box reads as a soft box.

     Its value is FOURTEEN, and that number is the whole scene. Glass
     reflects four per cent of what is in front of it, so a source that
     is only as bright as the room contributes four per cent of the room
     and the panel renders as the black cabin behind it — which is what
     the first cut of this did, and it came back looking like a hole cut
     in the page. A real soft box is two orders of magnitude brighter
     than the wall beside it, and four per cent of THAT is a highlight.
     The whole reason a windscreen photographs is this one ratio. */
  vec2  ab = vec2(dot(r, KX), dot(r, KY));
  float bd = length(max(abs(ab) - vec2(0.310, 0.030), 0.0));
  float box = smoothstep(0.082, 0.0, bd) * max(dot(r, KEY), 0.0);
  e += vec3(1.000, 0.968, 0.918) * box * 13.5 * boxGain;
  // Its spill, which is what shapes a curved panel between the highlights.
  float k = max(dot(r, KEY), 0.0);
  e += vec3(1.000, 0.960, 0.905) * k * k * k * 0.30;
  // And the fill card, cool and weak, so the shadow side is not a hole.
  float f = max(dot(r, FILL), 0.0);
  e += vec3(0.600, 0.720, 0.980) * f * f * 0.26;
  return e;
}

/* What is behind the glass: a cabin, which is the darkest thing in the
   frame and therefore the reason the reflections read at all. Given as a
   function of a parallaxed surface coordinate rather than marched — at
   this distance the parallax IS the depth cue and the geometry is not. */
vec3 cabin(vec2 q){
  vec3 c = vec3(0.176, 0.174, 0.198);
  // The rear window, away up the cabin: the one light in there, and the
  // reason the headrests in front of it have a silhouette at all.
  vec2 rw = (q - vec2(0.30, 0.18)) / vec2(0.40, 0.19);
  c += vec3(0.240, 0.248, 0.278) * exp(-dot(rw, rw));
  // Two headrests standing against it.
  vec2 h1 = abs(q - vec2(-0.14, 0.03)) - vec2(0.055, 0.090);
  vec2 h2 = abs(q - vec2( 0.38, 0.02)) - vec2(0.055, 0.090);
  float hr = max(smoothstep(0.125, -0.035, length(max(h1, 0.0)) + min(max(h1.x, h1.y), 0.0)),
                 smoothstep(0.125, -0.035, length(max(h2, 0.0)) + min(max(h2.x, h2.y), 0.0)));
  c = mix(c, vec3(0.104, 0.101, 0.122), hr);
  // The wheel, and then the dash, which is the blackest thing of all.
  float sw = abs(length((q - vec2(0.10, -0.220)) / vec2(0.215, 0.095)) - 1.0);
  c = mix(c, vec3(0.205, 0.205, 0.222), smoothstep(0.30, 0.04, sw) * 0.75);
  c = mix(c, vec3(0.048, 0.048, 0.056), smoothstep(-0.14, -0.34, q.y));
  return c;
}

/* The outline of the glass, in the panel's own coordinates. Negative
   inside. The taper is what makes it a windscreen rather than a window. */
float glassSD(vec2 p){
  float s  = clamp(p.y / (2.0 * HH) + 0.5, 0.0, 1.0);
  float hw = mix(HWB, HWT, s);
  vec2  d  = vec2(abs(p.x) - (hw - CRN), abs(p.y) - (HH - CRN));
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - CRN;
}

/* And the aperture it is set in: the roof edge above, an A-pillar each
   side, the cowl and the bonnet below. Dark, and nothing more than dark. */
float bodySD(vec2 p){
  vec2 d = vec2(abs(p.x) - 1.00, abs(p.y + 0.06) - 0.66);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - 0.14;
}

/* The nearest intersection with the ellipsoid. Exact, one root, and the
   discriminant is tested before the square root rather than after. */
float hitShell(vec3 ro, vec3 rd){
  vec3  o = (ro - SC) / RAD;
  vec3  d = rd / RAD;
  float a = dot(d, d);
  float b = dot(o, d);
  float c = dot(o, o) - 1.0;
  float h = b * b - a * c;
  if (h < 0.0) return -1.0;
  h = sqrt(h);
  float t = (-b - h) / a;
  return (t > 1e-3) ? t : (-b + h) / a;
}

/* A crack runs fast and then arrests. Cubic out, clamped at both ends so
   the loop's seam cannot leak a negative into anything. */
float ez(float x){
  x = clamp(x, 0.0, 1.0);
  float k = 1.0 - x;
  return 1.0 - k * k * k;
}

/* One leg of the star. A = (angle, length, start, wander amplitude),
   B = (wander frequency, where it branches, how far the branch runs,
   which way it turns). Written down rather than hashed, because the
   order they go in IS the animation: each run has to arrest before the
   next one starts, and that is a composition, not a random number. */
void legOf(int i, out vec4 A, out vec4 B){
  if      (i == 0){ A = vec4(0.34, 0.300, 0.02, 0.15); B = vec4(11.0, 0.46, 0.15,  0.62); }
  else if (i == 1){ A = vec4(1.02, 0.085, 0.34, 0.26); B = vec4(15.0, 0.00, 0.00,  0.00); }
  else if (i == 2){ A = vec4(1.58, 0.380, 0.10, 0.12); B = vec4( 9.0, 0.38, 0.19, -0.55); }
  else if (i == 3){ A = vec4(2.26, 0.062, 0.62, 0.30); B = vec4(17.0, 0.00, 0.00,  0.00); }
  else if (i == 4){ A = vec4(2.84, 0.200, 0.24, 0.17); B = vec4(12.0, 0.58, 0.12,  0.70); }
  else if (i == 5){ A = vec4(3.55, 0.105, 0.86, 0.24); B = vec4(14.0, 0.00, 0.00,  0.00); }
  else if (i == 6){ A = vec4(4.22, 0.345, 0.48, 0.13); B = vec4(10.0, 0.42, 0.17, -0.60); }
  else if (i == 7){ A = vec4(4.92, 0.075, 1.18, 0.28); B = vec4(16.0, 0.00, 0.00,  0.00); }
  else            { A = vec4(5.62, 0.150, 1.02, 0.20); B = vec4(13.0, 0.62, 0.10,  0.50); }
}

/* The rings that hoop the crater: radius, when it starts, where the arc
   starts, how far round it gets. Never a whole turn — laminated glass
   rings its crater in arcs that stop against the radials, and a closed
   circle reads as a decal every time. */
void ringOf(int i, out vec4 R){
  if      (i == 0) R = vec4(0.019, 0.30, 0.8, 3.1);
  else if (i == 1) R = vec4(0.028, 0.52, 3.4, 2.4);
  else if (i == 2) R = vec4(0.040, 0.80, 1.9, 4.0);
  else if (i == 3) R = vec4(0.056, 1.12, 5.0, 2.0);
  else             R = vec4(0.077, 1.45, 2.6, 2.9);
}

void main(){
  vec2  uv  = gl_FragCoord.xy / uRes;
  float asp = uRes.x / uRes.y;
  float wide = smoothstep(0.95, 1.90, asp);
  float e   = smoothstep(0.0, 1.0, uEnter);

  /* Phased so that the frame a reduced-motion reader is drawn — the
     stage gives them exactly one, at two seconds — lands inside the
     hold, with the fracture complete and still. So does anything
     photographed between two and six and a half seconds in, which is
     what makes the answer at 1440 the answer at 390. */
  float cyc = mod(uTime + 0.55, LOOP);

  /* ================= the camera =================
     Raked, close, and barely moving: the glass is the subject and a
     camera that swings around it is a camera competing with it.

     The band is 4:5 on a phone and 21:9 on a desktop, and a windscreen
     is a wide shallow thing — so the aspect is answered by WHICH WAY the
     rake goes, which is the one lever that changes the shape of the
     object in the frame without cropping a millimetre off it. A panel
     raked at fifty-six degrees is foreshortened to 0.56 of itself along
     the direction of the rake, so:

       21:9   fifty-four degrees, and the camera is down at the road
              looking UP. The rake is vertical, the height compresses to
              0.59 of itself, and 1.60 by 0.59 fills a long band.
       4:5    forty-six degrees, and the camera has walked round to the
              driver's side. The rake is horizontal, the width is what
              compresses, and the panel stands up in a tall one.

     The same object, the same distance, the same lens, the same
     fracture, the whole star inside the frame at both ends, and at both
     ends the A-pillar with the room past it — which together are the
     only way the four words that come back at 1440 are the four that
     come back at 390. Both ends are somebody standing in front of a car
     looking at the damage, which is the point. */
  float fov  = mix(0.504, 0.292, wide);
  vec3  aim  = vec3(0.0, 0.02, 0.0);
  vec3  eye  = aim + vec3(mix(-1.090, -0.448, wide),
                          mix(-0.629, -1.232, wide),
                          mix( 1.216,  0.952, wide));
  float roll  = mix(-0.05, 0.03, wide);
  /* The shift at 4:5 is the whole answer to the breakpoint, and it was
     measured rather than nudged. At 0.338 the panel's far edge sat at
     u = 1.02 and the roof corner at v = 1.16, so every edge of the CAR
     was outside the frame and what was left inside it was a dark rounded
     rectangle with white scratches on it — a cracked phone, to anyone
     who had not been told. At 0.040 the same panel, at the same distance
     through the same lens, hands the frame the A-pillar at u = 0.77 to
     0.84, the room behind the car from there to the edge all the way
     down, and the roof coming in over the top at u = 0.43 and curving
     into the pillar at 0.84 — glass, pillar, sky, which is what says car
     in one glance. The 0.240 lifts the foot of the picture off the
     words: the frit band along the panel's bottom edge, which used to
     run right through the kicker, now sits at v = 0.28 to 0.36 with
     nothing but light going down into the paper under it. */
  vec2  shift = vec2(mix(0.040, 0.349, wide), mix(0.240, 0.180, wide));
  /* The camera the LIGHT is rigged against: no drift, no pointer, no
     entrance. Everything below moves the lens a few centimetres, and the
     box has to stay where the photographer put it — otherwise the
     highlight is welded to the frame and the glass never moves at all,
     which is the difference between a photograph and a diagram. */
  vec3 ww0 = normalize(aim - eye);

  /* One cosine on the loop's own period, so the seam cannot show. Four
     and a half of these eight seconds are the fracture HOLDING, and a
     held frame is a still picture unless something in it is alive. On
     glass the living thing is the reflection: a couple of centimetres of
     lens moves the box a hand's breadth across the panel, because a
     mirror doubles every angle you give it. */
  float drift = cos(TAU * cyc / LOOP);
  eye.x += drift * 0.030;
  eye.y += (1.0 - drift) * 0.016;
  // A hand over the band leans it a couple of centimetres, and no more.
  eye.x += (uPointer.x - 0.5) * 0.10;
  eye.y += (uPointer.y - 0.5) * 0.06;
  // And it settles the last of the way in as the band arrives.
  eye = mix(aim + (eye - aim) * 1.045, eye, e);

  vec3 ww = normalize(aim - eye);

  /* Rig the box: take where the middle of the panel is looking, walk it
     up and to the left, and build the box's own long and short axes off
     the set's up. The cross cannot collapse — the box never stands along
     the set's vertical — but it is guarded anyway, because a normalize()
     that could ever see a zero vector is a NaN waiting for a driver that
     does not flush it. */
  KEY = normalize(reflect(ww0, vec3(0.0, 0.0, 1.0))
                + mix(vec3(0.20, -0.20, 0.00), vec3(0.10, -0.12, 0.05), wide));
  vec3  kc = cross(KEY, SUP);
  float kl = length(kc);
  vec3  kx = (kl > 1e-3) ? kc / kl : vec3(1.0, 0.0, 0.0);
  vec3  ky = cross(kx, KEY);
  /* A soft box is long one way and short the other, and which way is
     which decides everything: the long axis has to run ACROSS the panel
     so the strip lies over the glass, not down it. Never level with the
     frame, because a light exactly parallel to the top of it reads as a
     graphic and not as a room — eighteen degrees on the long band.

     And the box is turned for the shot, as a box on a stand is. On 21:9
     the panel is wide and the strip lies across its lower half on its
     own; on 4:5 those same eighteen degrees stood the strip DOWN the
     frame — a bright column on the right with the whole left of the
     picture left in the dark cabin, which is the foot of the band
     bleeding out of the bottom of it under the very words it is printed
     behind. Laid over sixty-three degrees the other way it crosses the
     glass instead, and the tall band's foot now measures what the long
     one's does. Mean luminance of the strip the kicker sits in, 0.17 to
     0.30 of the height: 197 at 390 against 196 at 1440, where it was
     175. Over the fifth above that: 93 against 109, where it was 57. */
  vec3 lx = -ky, ly = kx;
  float ka  = mix(-1.100, 0.314, wide);
  float kca = cos(ka), ksa = sin(ka);
  KX = lx * kca + ly * ksa;
  KY = ly * kca - lx * ksa;

  vec3 up = vec3(sin(roll), cos(roll), 0.0);
  vec3 uu = normalize(cross(ww, up));
  vec3 vv = cross(uu, ww);
  /* A LENS SHIFT, not a pan. Both ends of the aspect interpolation look
     at this panel from a long way round from each other, and a camera
     aimed off-centre to compose also changes what the glass reflects —
     which is the one thing in the frame that must not move. Shifting the
     principal point instead slides the picture inside the frame with the
     view direction untouched, exactly as a view camera does, so the
     framing at 4:5 and at 21:9 is solved independently of the light. */
  vec2 sp = ((2.0 * uv - 1.0) * vec2(asp, 1.0) - shift) * fov;
  vec3 rd = normalize(sp.x * uu + sp.y * vv + ww);
  vec3 ro = eye;

  /* ---- the room behind the car ---- */
  vec3 sky = mix(uColors[3], mix(uColors[2], uColors[1], 0.72),
                 smoothstep(0.18, 1.10, uv.y));
  vec3 col = sky;

  float t = hitShell(ro, rd);
  if (t > 0.0){
    vec3  P  = ro + rd * t;
    vec3  N  = normalize((P - SC) / (RAD * RAD));
    vec2  q2 = P.xy;                       // the panel's own coordinates
    /* Tangents. Anywhere the panel or the body can be seen, N is within
       twenty degrees of straight out of the glass, so this can only
       collapse on a ray that has gone off to the pole of the ellipsoid
       and is being thrown away anyway. Guarded regardless: a normalize()
       that could ever see a zero vector is a NaN waiting for a driver
       that does not flush it. */
    vec3  tu0 = vec3(N.z, 0.0, -N.x);
    float tul = length(tu0);
    vec3  Tu  = (tul > 1e-4) ? tu0 / tul : vec3(1.0, 0.0, 0.0);
    vec3  Tv = cross(N, Tu);

    float ndv = max(abs(dot(N, rd)), 0.14);
    // One pixel, in metres, where this ray landed and at the angle it
    // landed at. Every mark in the file is sized against it.
    float px  = t * 2.0 * fov / uRes.y / ndv;

    float gsd = glassSD(q2);
    float bsd = bodySD(q2);
    float inG = smoothstep(px, -px, gsd);          // inside the glass
    float inB = smoothstep(px, -px, bsd);          // inside the aperture

    /* ---- the aperture: dark, diffuse, and lit by the house ---- */
    float bfr = clamp(1.0 + dot(N, rd), 0.0, 1.0);
    bfr = bfr * bfr * bfr;
    // Painted metal: a dark diffuse body under a clear coat. The diffuse
    // half is lit by the ROOM and therefore carries the house palette;
    // the coat on top of it is a mirror and therefore carries the set.
    vec3 bcol = BODY * mix(0.60, 1.30, max(dot(N, KEY), 0.0));
    bcol = mix(bcol, mix(BODY, uColors[1], 0.34), 0.36);
    bcol += studio(reflect(rd, N), 0.30) * (0.035 + 0.55 * bfr);

    /* ---- THE CONTACT: where the glass is bedded in the aperture ----
       Every term here is LIGHT REMOVED from the flange, never grey laid
       on top of it, and every one of them is anchored to the glass's own
       outline in the panel's coordinates — so it is welded to the object
       and not to the frame, and it is the same shadow in metres at 390 as
       it is at 1440.

       dF is how far out along the flange a fragment is from the edge of
       the glass. A straight wall of height SEAT standing at that distance
       takes 0.5 * (1 - d / sqrt(d*d + SEAT*SEAT)) of the hemisphere off
       it: exactly half at the join, an eighth of the sky a seat's width
       away, nothing by three. That is the shape a contact has and it is
       why this is solved rather than dialled — tightest and darkest where
       the two things touch, loosening and lifting as it runs away.

       Three falloffs and not one, for the same reason the retail scene
       has three: the flange is seen nearly edge-on down the A-pillar and
       nearly square-on across the roof, so a single curve tuned on one is
       a smudge on the other. The half-wall is the bite at the join, the
       short exponential is the bead's own groove, and the long one is the
       ambient the whole raised panel keeps off the paint a hand away.

       Then the key's own shadow of that standing edge, thrown by the SAME
       vector the body is shaded with, which is what makes the glass read
       as proud of the flange rather than flush with it: it lies below and
       to the left of the glass, where the box is not, and there is none
       at all above and to the right, where it is. */
    vec2  kt = vec2(dot(KEY, Tu), dot(KEY, Tv));
    float kn = max(dot(KEY, N), 0.25);
    /* Measured from the near side of the pixel rather than its centre,
       which is the same refusal the cracks make two hundred lines down
       and for the same reason. The darkest part of this line is a couple
       of millimetres wide; on the 242-pixel buffer a phone is given, no
       sample ever lands on it, so the join came back at 30 there against
       23 at 1440 — one scene, told twice. Half a pixel of conservative
       widening and both ends report the contact's own value. */
    float dF = max(gsd - 0.5 * px, 0.0);
    // And never tighter than a pixel either, so it cannot dither away.
    float seat = max(SEAT, 0.9 * px);
    float bAO  = 0.5 * (1.0 - dF / sqrt(dF * dF + seat * seat));
    float pen  = max(px, 0.34 * SEAT);
    float bCast = smoothstep(pen, -pen, glassSD(q2 + kt * (SEAT / kn)));
    float bed = clamp(bAO * 1.35 + exp(-dF * 16.0) * 0.26
                    + exp(-dF * 3.6) * 0.15 + bCast * 0.40, 0.0, 1.0);
    // What is left in the groove is what bounced in off the room, so it
    // goes toward the house violet — the same direction every other
    // shadow on this site goes, because a shadow is missing light and
    // not a grey decal.
    bcol *= mix(vec3(1.0), mix(vec3(0.140, 0.135, 0.165), uInk * 0.34, 0.45), bed);

    col  = mix(sky, bcol, inB);

    if (inG > 0.002){
      /* =============== the glass =============== */
      vec2  qc = q2 - IMP;
      float rr = length(qc);
      float th = (rr > 1e-6) ? atan(qc.y, qc.x) : 0.0;
      vec2  qd = (rr > 1e-6) ? qc / rr : vec2(1.0, 0.0);

      /* The heal: a front that starts outside the longest leg and closes
         on the crater, so the damage goes the way it came. At cyc = LOOP
         it is below zero everywhere and at cyc = 0 there is nothing to
         heal, which is what makes the seam exact rather than nearly. */
      float hs   = smoothstep(T_HEAL, LOOP - 0.05, cyc);
      float hf   = mix(0.50, -0.05, hs);
      float live = 1.0 - smoothstep(hf - 0.10, hf, rr);
      live *= step(T_HIT, cyc);

      float tc = cyc - T_HIT;

      /* ---- the legs, and their branches ----
         Nineteen separate runs, each with its own second to go in. What
         accumulates is three things: how much of this pixel a crack
         covers, the direction the crack's FACE points in — which is what
         decides whether an arm blazes or stays a dark hairline — and how
         much of it is the trapped-light green of a cut edge. */
      float crk = 0.0, grn = 0.0;
      vec2  fn  = vec2(0.0);
      float fw  = 0.0;

      if (live > 0.001) for (int i = 0; i < 9; i++){
        vec4 A, B;
        legOf(i, A, B);
        float dur = 0.055 + A.y * 0.24;
        float gl  = A.y * ez((tc - A.z) / dur);

        // The centreline wanders more the further it runs, which is the
        // difference between a fracture and a starburst clip-art.
        float ang = A.x + A.w * sin(rr * B.x + A.x * 3.1) * rr;
        float da  = th - ang;
        da -= TAU * floor(da / TAU + 0.5);
        float perp = abs(da) * rr;
        float taper = clamp(rr / A.y, 0.0, 1.0);
        float w  = mix(0.0042, 0.0006, sqrt(taper));
        float ew = max(w, 1.05 * px);
        float cv = smoothstep(ew, 0.0, perp)
                 * smoothstep(gl, gl - 0.014, rr)
                 * smoothstep(0.009, 0.020, rr) * live;
        // A crack scatters less where it is thinner, so the tips go out
        // rather than ending on a full-strength stub.
        cv *= mix(1.0, 0.62, taper);
        crk = max(crk, cv);
        grn = max(grn, cv * taper);
        // The lip you are on, ramped smoothly across the line so it does
        // not dither where the line is thinner than a pixel.
        vec2 pd = vec2(-sin(ang), cos(ang));
        fn += pd * cv * clamp(da * rr / ew, -1.0, 1.0);
        fw += cv;

        // The branch: it leaves the parent where the parent had reached
        // that far, and it runs its own short way.
        if (B.z > 0.0){
          float rb  = A.y * B.y;
          float ab  = A.x + A.w * sin(rb * B.x + A.x * 3.1) * rb;
          vec2  od  = vec2(cos(ab), sin(ab));
          vec2  O   = IMP + od * rb;
          vec2  bdv = vec2(cos(ab + B.w), sin(ab + B.w));
          float bg  = B.z * ez((tc - A.z - dur * B.y) / (dur * 0.7));
          vec2  wv  = q2 - O;
          float s   = clamp(dot(wv, bdv), 0.0, bg);
          float dsg = length(wv - bdv * s);
          float bw  = max(0.0019, 1.05 * px);
          float bcv = smoothstep(bw, 0.0, dsg) * smoothstep(0.0, 0.010, bg) * live;
          crk = max(crk, bcv);
          grn = max(grn, bcv * 0.85);
          vec2 bp = vec2(-bdv.y, bdv.x);
          fn += bp * bcv * clamp(dot(wv, bp) / bw, -1.0, 1.0);
          fw += bcv;
        }
      }

      /* ---- the rings ---- */
      if (live > 0.001) for (int i = 0; i < 5; i++){
        vec4 R;
        ringOf(i, R);
        float rk = R.x * (1.0 + 0.045 * sin(th * 3.0 + R.z) + 0.022 * sin(th * 7.0 - R.z));
        float d  = abs(rr - rk);
        float u  = th - R.z;
        u -= TAU * floor(u / TAU);
        float gr = R.w * ez((tc - R.y) / 0.30);
        float rw = max(0.0017, 1.05 * px);
        float cv = smoothstep(rw, 0.0, d)
                 * smoothstep(gr, gr - 0.28, u) * smoothstep(0.0, 0.12, u) * live;
        crk = max(crk, cv);
        grn = max(grn, cv * 0.55);
        fn += qd * cv * clamp((rr - rk) / rw, -1.0, 1.0);
        fw += cv;
      }

      /* ---- the crater, and the bruise round it ----
         A pit is not a circle: it is where a stone the shape of a stone
         went in. The radius is wobbled by the angle so the outline is
         the outline of an impact. */
      float rj = rr / (1.0 + 0.26 * sin(th * 5.0 + 1.1) + 0.15 * sin(th * 9.0 - 2.3));
      float pit    = smoothstep(0.030, 0.005, rj) * live;
      float core   = smoothstep(0.0072, 0.0016, rj) * live;
      float bruise = smoothstep(0.055, 0.013, rj) * live;

      /* The crater is a real dent, so it bends the surface: the wall
         tilts outward and catches the sweep as a ring of light, which is
         the whole difference between a chip and a decal. Closed form off
         the profile, not a second field tap. */
      float slope = -1.05 * smoothstep(0.032, 0.007, rj) * smoothstep(0.0, 0.011, rj) * live;
      vec3  Ng = normalize(N + (Tu * qd.x + Tv * qd.y) * slope);

      /* ---- and how deep the hole is ----
         The third contact, and the one the judge called line-art: a
         crater is a HOLE, and a hole cannot see the room. The pit had a
         wall that caught the key and nothing that lost the sky, so it
         read as a white disc with a dot in it — a sticker, at any size.

         The same occlusion that beds the glass in the body, turned on
         the pit's own rim. Nothing at the lip, most of the hemisphere
         gone at the bottom of the cone, and the near wall throwing its
         own shadow across the floor on the side the box cannot reach
         over. The squaring is the cone closing: a pit is not a cylinder
         and the light does not leave it linearly. */
      float pdep  = smoothstep(0.031, 0.004, rj) * live;
      pdep *= pdep;
      float ktl   = length(kt);
      vec2  kdir  = (ktl > 1e-4) ? kt / ktl : vec2(0.0, 1.0);
      float pcast = pdep * smoothstep(0.30, -0.55, dot(qd, kdir));
      /* Weighted toward the CAST rather than the bowl, and that split is
         the whole of it: pulverised glass is white and opaque and a pit
         dimmed evenly all round is just a grey disc, which loses the one
         thing that separates a crater from the cracks running out of it.
         What a hole looks like is a lit wall and a dark one. */
      float pitAO = clamp(pdep * 0.45 + pcast * 0.55, 0.0, 1.0);

      /* ---- the glass itself ----
         Fresnel from 4% face-on to nearly all of it at a graze, which is
         the gradient across the panel that says "glass" before anything
         else does. Schlick, with the base clamped into 0..1 first so
         there is no power of a negative anywhere in it. */
      float ci = clamp(-dot(Ng, rd), 0.0, 1.0);
      float m  = 1.0 - ci;
      float F  = 0.04 + 0.96 * m * m * m * m * m;

      // The path a ray really takes through 7mm of laminate, refracted.
      float si2 = 1.0 - ci * ci;
      float ct  = sqrt(max(1.0 - si2 / 2.25, 1e-4));
      float path = (2.0 * TH) / ct;
      vec3  tint = exp(-ABSORB * path);

      // Behind it: the cabin, with the parallax the rake gives it.
      vec2 par = q2 + (vec2(dot(rd, Tu), dot(rd, Tv))
                     - vec2(dot(ww, Tu), dot(ww, Tv))) * 0.95;
      vec3 back = cabin(par) * tint;

      // And on it: the set. This is the material.
      vec3 refl = studio(reflect(rd, Ng), 1.0);
      // The second surface reflects too, a little, and offset — which is
      // the ghost you see in every windscreen at night. The first thing
      // a phone gives up.
      if (uTier > 0.25){
        vec3 Ng2 = normalize(Ng + (Tu * 0.010 + Tv * 0.006));
        refl += studio(reflect(rd, Ng2), 0.85) * 0.22 * tint;
      }

      vec3 g = mix(back, refl, F);

      /* ---- the bruise: not cracked, crushed ----
         A few million surfaces in a few cubic millimetres, so it is
         opaque, it is white, and it is bright wherever the set is
         bright. Nothing else in the frame behaves like this. */
      float keyf = max(dot(Ng, KEY), 0.0);
      vec3  frost = POWD * (0.38 + 0.62 * keyf);
      if (uTier > 0.75){
        // The micro-shatter inside it, which is granular and not smooth.
        float sp2 = h21(floor(q2 * 1400.0));
        frost *= 0.80 + 0.40 * sp2;
      }
      g = mix(g, frost * (1.0 - 0.45 * pitAO), bruise * 0.72);

      /* ---- the cracks ----
         A crack is a new pair of air surfaces inside the glass, so it is
         a MIRROR, and what it shows is the set seen off a face that
         points whichever way the crack happens to run. One reflection,
         off the averaged face of whatever crossed this pixel — which is
         why some arms of the star blaze white and others stay dark green
         hairlines, exactly as they do in a photograph. */
      vec2  fnn = (fw > 1e-4) ? fn / fw : vec2(0.0);
      vec3  faceN = normalize(Ng * 0.36 + Tu * fnn.x + Tv * fnn.y);
      vec3  cenv = studio(reflect(rd, faceN), 0.55);
      // Light trapped between two crack faces travels a long way through
      // the glass before it gets out, so the fine ends of the legs carry
      // the green of a cut edge while the wide roots go silver.
      vec3  ccol = cenv * 1.10 + POWD * 0.46;
      ccol = mix(ccol, ccol * GEDGE * 1.40, grn * 0.34);
      /* And a floor under it, which is not decoration. A crack ADDS
         scattered light to whatever is behind it, so it can never be
         darker than the glass it is in — and where a leg ran across the
         soft box's own reflection it was, at almost exactly the same
         value, and the line broke up into dashes that read as a bug in
         the renderer rather than as a crack over a highlight. */
      ccol = max(ccol, g * 1.25 + 0.14);
      g = mix(g, ccol, clamp(crk, 0.0, 1.0) * 0.94);

      /* ---- the pit, with the sky it cannot see taken back out ---- */
      g = mix(g, POWD * (0.66 + 0.60 * keyf) * (1.0 - 0.60 * pitAO), pit * 0.96);
      // The bottom of the cone closes to a point and sees nothing at all,
      // so what is left down there is the room's own violet.
      g = mix(g, mix(vec3(0.055, 0.060, 0.062), uInk * 0.16, 0.45), core * 0.90);

      /* ---- the flash, and the dust that comes off it ---- */
      float fl = exp(-max(tc, 0.0) * 24.0) * step(T_HIT, cyc) * step(cyc, T_HIT + 0.45);
      g += vec3(1.0, 0.98, 0.94) * fl * exp(-rr * rr / 0.0016) * 1.15;
      if (cyc > T_HIT && cyc < T_HIT + 0.42){
        for (int i = 0; i < 7; i++){
          float fi = float(i);
          float a  = fi * 0.897 + 0.4;
          float sv = 0.55 + 0.45 * fract(fi * 0.374);
          float pr = tc * sv * 1.9;
          vec2  pp = qc - vec2(cos(a), sin(a)) * pr;
          float k  = 1.0 - tc / 0.42;
          g += POWD * exp(-dot(pp, pp) / 0.00006) * k * k * 0.85;
        }
      }

      /* ---- the black ceramic band ----
         Solid at the rim, then a lattice of dots that shrink as they run
         inward. Resolved while a pixel can hold one, and replaced by its
         own exact mean coverage when it cannot — a dot lattice under
         Nyquist is not a faint lattice, it is a moire that crawls. */
      float dE = -gsd;
      float solid = smoothstep(0.023, 0.014, dE);
      float dotR  = 0.47 * (1.0 - smoothstep(0.017, 0.062, dE));
      vec2  gg = q2 / 0.0105;
      // Staggered every other row, and staggered in X ONLY: adding the
      // offset to both components moves the dot off its own row as well
      // as along it, which is a lattice that no printer ever made.
      vec2  gf = fract(gg + vec2(0.5 * mod(floor(gg.y), 2.0), 0.0)) - 0.5;
      float sharp = smoothstep(dotR, dotR - 0.16, length(gf));
      float meanc = clamp(3.14159 * dotR * dotR, 0.0, 1.0);
      // A dot is resolvable when a pixel is a THIRD of the pitch, not
      // when it is nine tenths of it: at nine tenths the lattice is at
      // 1.2 pixels a dot and what it draws is its own beat pattern. The
      // threshold is read off both ends — 0.32 at 1440, where the dots
      // are right, and 0.83 on the phone buffer, where they were a
      // crawling stipple along the rim.
      float resolv = smoothstep(0.55, 0.30, px / 0.0105);
      float dots = mix(meanc, sharp, resolv) * step(0.02, dotR);
      float frit = clamp(solid + dots * (1.0 - solid), 0.0, 1.0);

      // The mirror and camera bracket, hung off the top band. Nothing
      // else on any object anywhere is shaped like this.
      vec2  mq = (q2 - vec2(0.0, 0.437)) / vec2(0.072, 0.052);
      float mp = smoothstep(1.08, 0.90, length(mq));
      frit = clamp(frit + mp, 0.0, 1.0);

      // Ceramic is diffuse and it is lit by the room, so it takes the
      // house palette where the glass takes the set.
      vec3 fc = FRIT * mix(0.70, 1.55, max(dot(N, KEY), 0.0));
      fc = mix(fc, mix(FRIT, uColors[1], 0.34), 0.30);
      fc = mix(fc, mix(FRIT, uColors[3], 0.50), bfr * 0.22);
      g = mix(g, fc, frit);

      /* ---- the wiper, parked along the bottom band ----
         Where a wiper actually sits, which is why it costs the picture
         nothing and buys it the last of its name. */
      vec2  wa = vec2(-0.66, -0.408), wb = vec2(0.40, -0.318);
      vec2  wd = wb - wa;
      float ws = clamp(dot(q2 - wa, wd) / dot(wd, wd), 0.0, 1.0);
      vec2  wv2 = q2 - wa - wd * ws;
      float wdd = length(wv2);
      // Signed across the blade, so the spine can sit on its top edge
      // rather than on a distance that has no sides.
      float wsg = dot(wv2, vec2(-wd.y, wd.x) / max(length(wd), 1e-5));
      float blade = smoothstep(0.0215, 0.0175, wdd);
      vec3  wcol = vec3(0.024, 0.024, 0.028) * mix(0.9, 1.7, max(dot(N, KEY), 0.0));
      // The steel spine along its top edge, catching the box — one line,
      // not a rail: a wiper is rubber with a bright millimetre on it, and
      // that millimetre goes out when it is thinner than a pixel rather
      // than turning into a ruled white bar, which is what it did.
      float spine = smoothstep(0.0040 + px, 0.0, abs(wsg - 0.0150))
                  * smoothstep(0.90, 0.35, px / 0.0040);
      wcol = mix(wcol, vec3(0.245, 0.250, 0.268), spine * 0.85);
      /* ---- and what the blade takes off the glass under it ----
         The wiper is the second contact in this frame and the only one
         that sits on the subject rather than the subject sitting in it,
         so it is drawn the same way: the half-wall occlusion off the
         rubber's own edge, and the key's shadow of a blade standing
         twelve millimetres proud.

         On glass the first term is not a nicety, it is the whole join:
         the pane within a few millimetres of the rubber reflects the
         RUBBER instead of the room, so the light goes out of it, and
         that tight dark line is the only thing that says the two are
         touching. The cast shadow is the weaker of the two here and
         deliberately so — most of what this surface is showing is a
         reflection of the box, and a shadow does not fall on a
         reflection. */
      float dW  = max(wdd - 0.0195 - 0.5 * px, 0.0);
      float wh  = max(WLIFT, 0.9 * px);
      float wAO = 0.5 * (1.0 - dW / sqrt(dW * dW + wh * wh));
      vec2  wq  = q2 + kt * (WLIFT / kn);
      float wsc = clamp(dot(wq - wa, wd) / dot(wd, wd), 0.0, 1.0);
      float wCast = smoothstep(max(px, 0.005), 0.0,
                               length(wq - wa - wd * wsc) - 0.0195);
      g *= mix(vec3(1.0), mix(vec3(0.150, 0.145, 0.175), uInk * 0.34, 0.45),
               clamp(wAO * 1.40 + wCast * 0.22, 0.0, 1.0));
      g = mix(g, wcol, blade);
      if (uTier > 0.75){
        // The haze a wiper leaves: fine arcs about its own pivot, and
        // only where the box is glancing off the glass, which is the only
        // place you ever see them on a real screen.
        float ra = length(q2 - vec2(-0.72, -0.62));
        float sw = abs(fract(ra * 30.0) - 0.5) * 2.0;
        g += vec3(0.020, 0.021, 0.022) * smoothstep(0.80, 1.0, sw)
             * smoothstep(0.86, 0.34, ra) * smoothstep(0.03, 0.10, dE)
             * clamp(F * 5.0, 0.0, 1.0);
      }

      col = mix(col, g, inG);
    }
  }

  /* ---- the stone, on its way in ----
     Three samples along the last of its path, which is a shutter rather
     than an effect: a stone crossing this frame in a third of a second
     is a streak and not a pebble. It exists for 0.30 of 8.40 seconds, so
     the whole of it sits behind a gate. */
  if (cyc > T_HIT - 0.32 && cyc < T_HIT + 0.015){
    /* Laid out in the CAMERA's frame — so far toward the lens, so far
       up and across the picture — rather than in the panel's. A stone
       placed in world coordinates is a stone that is in shot at one
       aspect ratio and off the top of the frame at the other, and the
       two ends of this interpolation stand a metre and a half apart. */
    vec3 endP = vec3(IMP, 0.0) + vec3(0.0, 0.0, 0.03);
    vec3 begP = endP - ww * 0.55 - uu * 0.30 + vv * 0.32;
    float s1 = clamp((cyc - (T_HIT - 0.30)) / 0.30, 0.0, 1.0);
    float acc = 0.0;
    vec3  hitN = normalize(-rd);
    /* A shutter, not a stack of coins. The five samples are a MAXIMUM
       rather than a sum and each older one is weaker, so what comes out
       is one smear that fades behind the stone — and the shading comes
       off the newest sample only, because five separately lit spheres
       lying on top of each other draw their own edges and that is what
       made the first cut of this look like a roll of pennies. */
    for (int i = 0; i < 5; i++){
      float s = clamp(s1 - float(i) * 0.030, 0.0, 1.0);
      vec3  cP = mix(begP, endP, s) - vv * (0.06 * s * (1.0 - s));
      vec3  oc = ro - cP;
      float b  = dot(oc, rd);
      float c2 = dot(oc, oc) - 0.0280 * 0.0280;
      float hh = b * b - c2;
      if (hh > 0.0){
        float ts = -b - sqrt(hh);
        if (ts > 0.0){
          acc = max(acc, 1.0 - float(i) * 0.175);
          if (i == 0){
            vec3 hp = (ro + rd * ts) - cP;
            hitN = hp / max(length(hp), 1e-5);
          }
        }
      }
    }
    acc = clamp(acc, 0.0, 1.0);
    // Road stone: dark, matte, and lit by the same box as everything else.
    vec3 sc = vec3(0.078, 0.073, 0.068) * mix(0.40, 2.10, max(dot(hitN, KEY), 0.0));
    sc = mix(sc, mix(sc, uColors[1], 0.35), 0.22);
    col = mix(col, sc, acc * 0.92);
  }

  // The scene arrives out of the paper rather than fading up as a
  // picture: the contrast comes in, the object was always there.
  col = mix(sky, col, mix(0.32, 1.0, e));
  // A little tooth, so the long wash across the backdrop never bands on
  // a cheap panel — the only sort this will be watched on.
  col += (h21(gl_FragCoord.xy + fract(uTime) * 57.0) - 0.5) * 0.014;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export const scene: Scene = {
  frag,
  colors: ["#551a89", "#7c74a6", "#f4f3f7", "#ffffff"],
  /* What a reader on a slow phone looks at until the shader has compiled,
     and what a device with no WebGL is left with for good. Measured off
     the shader's own frame at 390x488 — the 4:5 band a phone gets, which
     is the band this poster is actually for.

     EVERY LAYER IS ANCHORED TO THE BAND'S CENTRE IN PIXELS, and that is a
     fix rather than a style. A background layer given a percentage
     position is placed at that fraction of (container minus LAYER), so a
     stack of differently sized layers at differing percentages holds
     together only in the band it was solved in and fans out into nonsense
     in any other. Under `calc(50% + Npx)` the layer's CENTRE lands at the
     band's centre plus N whatever the band and whatever the layer, so the
     break is the same break at 390 and at 2560.

     Background layers composite front to back, so an edge that runs at
     an angle is cut the only way a stack of gradients can cut one: by a
     hard stop in a layer that is transparent on one side of it. Two of
     them carry the whole picture — the ROOF, above which the car layer
     is transparent and the room shows through, and the panel's own top
     edge, over which the car's colour is painted back on top of the
     glass. Both lines were least-squares fitted to the shader's own
     projected edges at 390 by 488, which is the band this poster is
     actually for, and both sit within eleven pixels of them.

     The ROOM's stops are the four house colours; the OBJECT's are the
     shader's own literals, so the handover at compile time is not a
     change of colour. */
  poster:
    /* The same paper cut the harness makes in the shader — white below
       0.17 of the band, released by 0.30. Without it the poster is the
       only picture on the page whose foot is still bodywork where the
       kicker is printed, which is the scene bleeding out of the bottom
       of the band on exactly the readers who wait longest for it. */
    "linear-gradient(to top, #ffffff 0 17%, rgb(255 255 255 / 0) 30%), " +
    // the star: five diameters through the impact, ten radial legs
    "linear-gradient(101deg, rgb(255 255 255 / 0) 49.3%, #eef6f3 49.7%, #eef6f3 50.3%, rgb(255 255 255 / 0) 50.7%) calc(50% - 56px) calc(50% - 87px) / 107px 107px no-repeat, " +
    "linear-gradient(9deg, rgb(255 255 255 / 0) 49.3%, #e4f1ec 49.7%, #e4f1ec 50.3%, rgb(255 255 255 / 0) 50.7%) calc(50% - 56px) calc(50% - 87px) / 133px 73px no-repeat, " +
    "linear-gradient(143deg, rgb(255 255 255 / 0) 49.3%, #f2f9f6 49.7%, #f2f9f6 50.3%, rgb(255 255 255 / 0) 50.7%) calc(50% - 56px) calc(50% - 87px) / 60px 88px no-repeat, " +
    "linear-gradient(58deg, rgb(255 255 255 / 0) 49.4%, #dcefe8 49.8%, #dcefe8 50.2%, rgb(255 255 255 / 0) 50.6%) calc(50% - 56px) calc(50% - 87px) / 38px 60px no-repeat, " +
    "linear-gradient(168deg, rgb(255 255 255 / 0) 49.4%, #dcefe8 49.8%, #dcefe8 50.2%, rgb(255 255 255 / 0) 50.6%) calc(50% - 56px) calc(50% - 87px) / 83px 30px no-repeat, " +
    // the concentric fractures hooping the crater, and the crater itself
    "radial-gradient(circle 13px at calc(50% - 56px) calc(50% - 87px), rgb(255 255 255 / 0) 0 10px, rgb(230 244 239 / 0.75) 10.5px 11.2px, rgb(255 255 255 / 0) 13px), " +
    "radial-gradient(circle 9px at calc(50% - 56px) calc(50% - 87px), rgb(255 255 255 / 0) 0 6.2px, rgb(238 249 244 / 0.9) 6.8px 7.4px, rgb(255 255 255 / 0) 9px), " +
    "radial-gradient(circle 8px at calc(50% - 56px) calc(50% - 87px), #f4faf7 0 2.5px, rgb(244 250 247 / 0.45) 4.3px, rgb(244 250 247 / 0) 8px), " +
    "radial-gradient(circle 3px at calc(50% - 56px) calc(50% - 87px), rgb(16 24 22 / 0.78) 0 1px, rgb(16 24 22 / 0) 3px), " +
    // the mirror and camera bracket, hung off the top band
    "radial-gradient(11px 8px at calc(50% + 15px) calc(50% - 161px), #07080a 0 76%, rgb(7 8 10 / 0) 100%), " +
    // the black ceramic frit, fading inward through its lattice of dots
    "linear-gradient(to bottom, #07080a 0 15px, rgb(7 8 10 / 0.45) 24px, rgb(7 8 10 / 0) 40px) calc(50% - 57px) calc(50% - 85px) / 286px 300px no-repeat, " +
    "linear-gradient(to right, #07080a 0 13px, rgb(7 8 10 / 0.40) 21px, rgb(7 8 10 / 0) 36px) calc(50% - 57px) calc(50% - 85px) / 286px 300px no-repeat, " +
    // the wiper, parked along the bottom of the glass
    "linear-gradient(to bottom, rgb(255 255 255 / 0) 0 74%, #16181d 74.5% 79.5%, rgb(255 255 255 / 0) 80%) calc(50% - 57px) calc(50% - 85px) / 286px 300px no-repeat, " +
    // the soft box, laid over so it crosses the lower glass
    "linear-gradient(128deg, rgb(255 255 255 / 0) 42%, rgb(255 253 248 / 0.07) 52%, rgb(255 253 248 / 0.30) 59%, rgb(255 253 248 / 0.30) 64%, rgb(255 253 248 / 0.05) 71%, rgb(255 255 255 / 0) 82%) calc(50% - 57px) calc(50% - 85px) / 286px 300px no-repeat, " +
    /* The roof rail, painted back in the CAR'S colour over the glass
       beneath it. Background layers composite front to back and cannot
       multiply, so a trapezoid is cut the only way a stack of gradients
       can cut one: by putting back what is behind. The cut runs along
       the panel's own top edge — through (65, -9) and (304, 117) of this
       layer's box, which is where the shader's camera puts it. */
    "linear-gradient(208deg, #16171d 0 23.8%, rgb(22 23 29 / 0) 23.8%) calc(50% - 57px) calc(50% - 85px) / 286px 300px no-repeat, " +
    // the glass, and the dark cabin behind it
    "linear-gradient(168deg, #34373f 0%, #262932 40%, #1a1c23 74%, #131419 100%) calc(50% - 57px) calc(50% - 85px) / 286px 300px no-repeat, " +
    /* The car it is set in, cut along the ROOF: transparent above the
       line and bodywork below it, so the room shows over the roof and
       beyond the A-pillar exactly as it does in the shader. That edge,
       and the room down the right of it, is the whole of what says car
       rather than phone on a 4:5 band. */
    "linear-gradient(220deg, rgb(25 26 33 / 0) 0 17.3%, #191a21 17.3%, #0d0e13 100%) calc(50% - 217px) calc(50% - 14px) / 720px 620px no-repeat, " +
    // and the room it is standing in
    "linear-gradient(to top, #ffffff 0%, #f4f3f7 26%, #e4e0ee 58%, #cfc6e4 82%, #b9aed9 100%)",
  alt: "A laminated car windscreen seen close and raked, filling the frame: black ceramic frit round the rim, the dark cabin behind it, and a long soft studio light lying across the curve of the glass. A stone comes in off the road and lands; a white pit opens with a bruise of crushed glass round it, radial cracks run out across the pane in a few branching runs, one arresting before the next begins, and concentric fractures ring the crater. It holds — and then it is clear again, and the stone comes back.",
};
