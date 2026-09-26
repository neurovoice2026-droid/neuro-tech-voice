import type { Scene } from "../shader-stage";

/* ------------------------------------------------------------------ *
 * Retail & e-commerce — the till receipt, printing.
 *
 * Two versions died here. The first drew four lanes of rectangles at
 * varying heights and a review of the set called it what it was: a bar
 * chart. The second replaced them with cartons on a belt — better, but
 * still flat shapes sliding across a flat band, and the note back on the
 * whole set was blunt: build the thing in 3D, with real materials and
 * real light, and stop painting everything violet.
 *
 * So this one is a machine.
 *
 *   the object   a top-exit thermal receipt printer, the box that sits
 *                behind every till in the country, and the receipt coming
 *                out of it. Charcoal plastic, a serrated steel tear bar
 *                across the slot, a feed button and the green power lamp
 *                on the front. Not a stand-in for retail: it is the one
 *                object in the shop that exists solely to write down what
 *                just happened, which is exactly what the page is about —
 *                the agent can read the shop's own record and nothing
 *                else.
 *
 *   the motion   it PRINTS. The paper ratchets out a line at a time —
 *                thirty of them, each one moving for half its beat and
 *                holding for the rest, the way a stepper feeds — and the
 *                print is locked to the paper, so every line appears at
 *                the lip in the instant the paper carrying it clears the
 *                slot. As the receipt lengthens it stops standing up: the
 *                run past the first half unit bends on a fixed radius, so
 *                the further it goes the further round that bend it has
 *                travelled, and a finished receipt has come most of a
 *                half turn over the front of the machine. It holds
 *                finished for a beat, is pulled tight against the tear
 *                bar, tears — the bottom edge going ragged in the same
 *                instant it separates — and the torn receipt is lifted up
 *                and away out of frame. The slot sits empty for a moment.
 *                Then the next one starts. Thirteen seconds.
 *
 *   the camera   close, and about thirty degrees to one side, drifting a
 *                few degrees either way on a single cosine so the loop
 *                has no seam. Which side matters: from the machine's
 *                right the front of it recedes leftward and a receipt
 *                leaning toward the reader reads as one falling over
 *                backwards, so the camera is on the left, where forward
 *                is rightward on the screen. That angle is the whole reason the curl
 *                reads: dead on, a bowed receipt is a rectangle; from the
 *                side you see the paper leave the slot, stand up, roll
 *                forward and come down in front of the machine, and every
 *                part of that is at a different distance from you.
 *
 * COLOUR. The environment is the site's — the backdrop, the pool of light
 * behind the machine, the counter under it, the shadow it casts and the
 * violet that fills its shadows all come off uColors and uInk. The object
 * is its own, and its list is short because the real thing's list is
 * short: thermal paper (a white that is very slightly warm, warmer still
 * at the cut edges where the coating stops), thermal print (a grey-black,
 * never pure black — a till receipt is not laser output), charcoal ABS,
 * a stainless tear bar, and the one green pinpoint of the power lamp.
 * Five literals, and every one of them is what that part actually is.
 *
 * HOW IT IS BUILT, AND WHAT IT COSTS. One distance field, one march per
 * fragment, 48 steps on a desktop, 36 on a tablet, 24 on a phone, and it
 * breaks on a hit and on a far plane rather than running to the cap. Two
 * conservative box bounds carry it: one round the machine, one round the
 * paper — and the paper's is recomputed every frame from the curve's own
 * reach, so an empty slot costs nothing and a finished receipt costs only
 * what it covers. Neither is ever returned below the hit epsilon, which
 * is the bug that shipped a violet ball the last time anyone in this set
 * wrote a bound.
 *
 * The paper is the interesting part. It is a ribbon swept along a
 * centreline of two exact pieces — a segment out of the slot and a
 * circular arc bending forward — so the field is a 2D distance to that
 * centreline, extruded across the receipt's width and thickened. The arc
 * uses Inigo Quilez's closed-form arc rather than an atan, so the march
 * never pays for an inverse trig function; the one atan in the file is
 * taken once, at the hit point, to recover the arc length. That arc
 * length is everything: the print is indexed by distance from the LEADING
 * edge, which is a quantity that does not change as the paper feeds, so
 * every line stays welded to the sheet while the sheet moves.
 *
 * The print is not geometry and never could be. It is resolved once at
 * the hit point from the paper's own surface coordinates, and it knows
 * how big a pixel is where it landed — so where a row is four pixels tall
 * on a phone it fades to the mean tone of that row rather than shimmering
 * into a moire. The row pitch is fixed in world units, not in pixels, so
 * the receipt says the same thing at 390 as at 1440; only the tier
 * thickens the strokes a little, because two pixels of ink on a phone is
 * the difference between fine print and grey noise.
 *
 * FRAMING. The field of view is solved against the band's HEIGHT on a
 * wide band and against its WIDTH on a narrow one, which is the only way
 * a 21:9 strip and a 4:5 phone block hold the same object whole. The
 * camera pulls back on the narrow band rather than cropping, the frame is
 * placed on the middle of the object's real extent rather than on the
 * machine, and on a long band the whole thing moves right so the kicker
 * has the open left. Two edges had to be solved rather than eyeballed:
 * the bottom fifth of the band is paper the kicker sits on and the
 * harness cuts it for us, so the machine's feet stop above it, and on a
 * desktop the site's own docked header floats over the top of the band,
 * so the top of the bow stops below that. Both are measured at 1440,
 * where they are tightest.
 * ------------------------------------------------------------------ */

const frag = `
#define PI   3.14159265
#define FAR  6.30
#define HW   0.340              /* half the receipt's width */
#define THK  0.0092             /* half its thickness */
#define ROWS 30.0
#define AA   0.420              /* the straight run out of the slot */
#define RR   0.320              /* the curl radius */
#define THM  3.050              /* how far it has curled when it is done */

/* ---- the animation state. Resolved once per fragment, read by the field
   fifty-odd times: globals rather than arguments, none of it changes
   between calls to map(). ---- */
float gL;        // how much paper has come out of the slot
float gSA;       // the straight run, which is the whole of a short receipt
float gTh;       // the arc's angle
float gHS, gHC;  // sin and cos of half of it
float gYlo;      // the paper's lower edge: below the lip, or at the tear bar
float gHi;       // where the straight run ends and the arc takes over
float gJag;      // how ragged that edge is — nothing until it is torn
float gP;        // one printed line, in world units
vec3  gPapO;     // the slot, plus wherever the torn receipt has got to
vec3  gPapC, gPapE;   // the paper's bound, in the paper's own frame

float hash11(float n){ return fract(sin(n * 127.1) * 43758.5453123); }
float hash21(vec2 p){
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

/* ---- primitives, all exact. An approximate field overshoots, and an
   overshoot in a march is a hole through the middle of a part. ---- */
float sdBox3(vec3 p, vec3 b){
  vec3 d = abs(p) - b;
  return min(max(d.x, max(d.y, d.z)), 0.0) + length(max(d, 0.0));
}
float sdRBox(vec3 p, vec3 b, float r){
  vec3 d = abs(p) - b + r;
  return min(max(d.x, max(d.y, d.z)), 0.0) + length(max(d, 0.0)) - r;
}
float sdCylY(vec3 p, float r, float h){
  vec2 d = vec2(length(p.xz) - r, abs(p.y) - h);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}
/* IQ's arc: exact, and — the reason it is here — no atan. The arc is
   symmetric about +y with half-aperture ta, sc = (sin ta, cos ta). An
   atan in map() would be paid forty-eight times a pixel; the one this
   file does take is taken once, at the surface. */
float sdArc2(vec2 p, vec2 sc, float ra){
  p.x = abs(p.x);
  return (sc.y * p.x > sc.x * p.y) ? length(p - sc * ra) : abs(length(p) - ra);
}

/* ---- the paper ----
   A ribbon swept along a centreline of two pieces that meet tangentially:
   a segment straight up out of the slot, and an arc of radius RR whose
   centre sits forward of it, so the paper bows toward the reader as it
   lengthens rather than standing up like a card. Distance to the
   centreline in the (z,y) plane, extruded across the width, thickened.
   Exact on both pieces, and exact at their join, because the union of two
   exact fields is exact.

   The torn edge is a sawtooth on the lower cap, and it only exists once
   the receipt has separated — before that the cap is below the lip, out
   of sight inside the machine. Twelve teeth across the width rather than
   the bar's twenty-two: paper tears between teeth, not along them, and
   the shallower sawtooth also keeps this field inside a Lipschitz bound
   of one, which a finer one would not. */
float sdPaper(vec3 q){
  float saw = abs(fract(q.x * 12.0) - 0.5) * 2.0;
  /* One gHi for the whole frame, computed with the clock rather than
     here. The field and the BOUND have to agree about where the straight
     run ends: a bound that assumes one end point while the geometry uses
     another is a bound shorter than the thing inside it, which is exactly
     how rays tunnelled through a part the last time this set was built. */
  float yLo = min(gYlo + gJag * saw, gHi - 0.002);
  vec2  pc  = vec2(q.z, q.y);
  float dSeg = length(pc - vec2(0.0, clamp(pc.y, yLo, gHi)));
  vec2  qq   = pc - vec2(RR, gHi);
  vec2  qr   = vec2(gHS * qq.x + gHC * qq.y, -gHC * qq.x + gHS * qq.y);
  float dArc = sdArc2(qr, vec2(gHS, gHC), RR);
  float dC   = min(dSeg, dArc);
  vec2  w    = vec2(dC - THK, abs(q.x) - HW);
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - 0.0030;
}

/* ---- the machine ----
   A body, a lid proud of it by the width of its own seam, the slot cut
   down through both so the throat has depth, and the tear bar standing
   across the front lip of that slot. The feed button is the one round
   thing on it. */
float sdBar(vec3 p){
  /* ONE STRIP, with teeth cut into it. A tear bar is a single length of
     folded stainless standing across the front lip of the slot; the
     serration is a notch ground into its top edge, not a bead threaded
     onto a wire. The cut before this one had the strip's shoulder clear
     the lid by 0.021 while the sawtooth on top of it ran 0.014 — the
     continuous part was three pixels tall on the band this is watched at
     and the teeth were two, so what rendered was twenty-four separate
     highlights floating on the moulding with the lid showing between
     them. The shoulder now clears the lid by twice the depth of the
     notches — 0.036 of a unit of unbroken steel under 0.014 of sawtooth —
     which is the only thing that makes a serrated edge read as an edge
     rather than as a string of highlights, and the notches are coarse
     enough that one of them is three or four pixels rather than one. */
  float saw = abs(fract(p.x * 18.0) - 0.5) * 2.0;
  float hh  = 0.0420 + 0.0070 * saw;
  /* The 0.72 is not taste, it is the Lipschitz bound. Sawing the top edge
     up and down across x makes this field steeper than one, so it can
     REPORT more distance than there is, and a march that believes it
     steps straight through a tooth. This pitch at this amplitude comes to
     a gradient of about 1.15, so the distance is scaled back by enough
     that the step scale above it stays under one. */
  return 0.72 * sdBox3(p - vec3(0.0, 0.020 + hh, 0.1470), vec3(0.4000, hh, 0.0130));
}
float sdBody(vec3 p){
  float d = sdRBox(p - vec3(0.0, -0.200, -0.100), vec3(0.5050, 0.2000, 0.4400), 0.028);
  d = min(d, sdRBox(p - vec3(0.0, 0.016, -0.108), vec3(0.4820, 0.0520, 0.4320), 0.022));
  /* The throat. It takes out everything in the slot's own thickness from
     well above the lid down to a fifth of a unit inside the machine, so a
     reader looking down at the slot finds a dark gap with paper standing
     in it and not a line ruled on a lid. */
  d = max(d, -sdBox3(p - vec3(0.0, 0.160, 0.1000), vec3(0.3860, 0.2600, 0.0270)));
  d = min(d, sdCylY(p - vec3(-0.3700, 0.0560, 0.2300), 0.0400, 0.0190));
  return d;
}

float map(vec3 p){
  /* Bound one: the machine. Larger than what is inside it on every axis,
     and only ever handed back while it is unmistakably bigger than the
     march's own hit threshold. */
  float hb = sdBox3(p - vec3(0.0, -0.1450, -0.1000), vec3(0.5600, 0.3000, 0.4800));
  float d  = hb > 0.070 ? hb : min(sdBody(p), sdBar(p));
  /* Bound two: the paper, recomputed every frame from the curve's own
     reach. An empty slot costs one box distance; a finished receipt costs
     only where it actually is. */
  vec3  q  = p - gPapO;
  float pb = sdBox3(q - gPapC, gPapE);
  d = min(d, pb > 0.070 ? pb : sdPaper(q));
  return d;
}

vec3 normalAt(vec3 p){
  vec2 k = vec2(1.0, -1.0) * 0.0013;
  vec3 g = k.xyy * map(p + k.xyy) + k.yyx * map(p + k.yyx)
         + k.yxy * map(p + k.yxy) + k.xxx * map(p + k.xxx);
  // normalize() of a zero vector is a NaN, and a NaN normal is a black
  // hole in the middle of the frame. It cannot happen after a near-hit;
  // it costs one add to be certain.
  return normalize(g + vec3(0.0, 1e-9, 0.0));
}

/* One short ray at the key light: sixteen steps, breaking on contact and
   on its own far plane, and the first thing uTier takes off. It is what
   lays the receipt's shadow across the lid. */
float shade(vec3 p, vec3 l){
  float s = 1.0, t = 0.030;
  for (int i = 0; i < 16; i++){
    float h = map(p + l * t);
    if (h < 0.0014) return 0.0;
    s = min(s, 8.0 * h / t);
    t += clamp(h, 0.030, 0.36);
    if (t > 2.6) break;
  }
  return clamp(s, 0.0, 1.0);
}

/* ---- the print ----
   Resolved at the hit point from the paper's own coordinates: u across
   the width in -1..1, and sTop, the distance from the LEADING edge, which
   is the one quantity that does not change while the paper feeds. fu and
   fr are one screen pixel in those two units, so every edge below is
   antialiased against the real footprint, and where a feature is smaller
   than a pixel the whole row falls back to its own mean tone instead of
   crawling. */
float runIk(float u, float ry, float a, float b, float cw, float h,
             float sd, float fu, float fr){
  if (u < a - fu || u > b + fu) return 0.0;
  float x  = (u - a) / cw;
  float ci = floor(x), cf = x - ci;
  float r1 = hash11(ci * 3.13 + sd);
  if (r1 < 0.150) return 0.0;                       // a space between words
  float r2 = hash11(ci * 7.71 + sd + 4.2);
  /* Every character the same width and the same height is a punched card,
     not a line of type — which is exactly what the first cut of this read
     as. A letter is between a third and four fifths of its cell wide, and
     the ascenders and descenders carry the rest. */
  float w  = 0.340 + 0.480 * r2;
  float e  = cw / max(fu, 1e-5);
  float g  = clamp((cf - (0.5 - w * 0.5)) * e, 0.0, 1.0)
           * clamp(((0.5 + w * 0.5) - cf) * e, 0.0, 1.0);
  float hh = h * (0.780 + 0.420 * fract(r1 * 5.7 + r2));
  float v  = clamp((hh - abs(ry - 0.5)) / max(fr, 1e-5), 0.0, 1.0);
  float f  = max(fu, 1e-5);
  float lim = clamp((u - a) / f + 0.5, 0.0, 1.0) * clamp((b - u) / f + 0.5, 0.0, 1.0);
  return g * v * lim;
}

float receiptInk(float u, float sTop, float fu, float fr, float hv){
  float n = floor(sTop / gP);
  if (n < 0.5 || n > ROWS + 0.5) return 0.0;
  float ry = sTop / gP - n;
  float f  = max(fr, 1e-5);

  /* Three dashed rules: under the head, above the total, under the card
     lines. They are what stops a column of text reading as a texture. */
  if (n == 6.0 || n == 17.0 || n == 25.0){
    float rl = clamp((0.86 - abs(u)) / max(fu, 1e-5) + 0.5, 0.0, 1.0);
    float dash = mix(step(0.34, fract(u * 11.0)), 0.62, clamp(fu / 0.05, 0.0, 1.0));
    return rl * dash * clamp((0.095 - abs(ry - 0.5)) / f, 0.0, 1.0) * 0.88;
  }
  /* The barcode, three rows of it, which is the one block on a receipt
     that is meant to be read by something that is not a person. */
  if (n >= 26.0 && n <= 28.0){
    float rl = clamp((0.58 - abs(u)) / max(fu, 1e-5) + 0.5, 0.0, 1.0);
    float bar = mix(step(0.44, hash11(floor(u * 34.0) * 1.7 + 9.0)), 0.52,
                    clamp(fu / 0.038, 0.0, 1.0));
    return rl * bar * clamp((0.47 - abs(ry - 0.5)) / f, 0.0, 1.0);
  }

  /* Everything else is text: a left run, sometimes a right one, in cells
     wide enough to survive a phone. The first cut of this file put
     forty-two characters across the sheet, which is what a real eighty
     millimetre roll holds and which came to two pixels a character on a
     390 band — so every row fell through to the unresolved grey below and
     the receipt came back looking like tracing paper. Twenty-eight is
     what this framing can actually draw. */
  float a = -0.86, b = -0.30, a2 = 2.0, b2 = 2.0, cw = 0.064, h = 0.190;
  float sd = n * 7.13 + 2.7;
  if      (n ==  1.0){ a = -0.60; b =  0.60; cw = 0.125; h = 0.305; }   // the shop's name
  else if (n ==  3.0){ a = -0.54; b =  0.54; }                          // the street
  else if (n ==  4.0){ a = -0.36; b =  0.36; }                          // the town, the number
  else if (n ==  7.0){ a = -0.86; b = -0.22; a2 = 0.30; b2 = 0.86; }    // date and time
  else if (n >=  9.0 && n <= 16.0){
    float k = hash11(n * 2.71 + 1.3);
    a = -0.86; b = -0.86 + 0.72 + 0.62 * k;
    a2 = 0.50 + 0.14 * hash11(n * 5.11); b2 = 0.88;
    if (n == 12.0){ a = -0.68; b = -0.16; a2 = 2.0; }                   // a size, indented
  }
  else if (n == 18.0){ a = -0.86; b = -0.44; a2 = 0.48; b2 = 0.88; }    // subtotal
  else if (n == 19.0){ a = -0.86; b = -0.38; a2 = 0.52; b2 = 0.88; }    // the VAT line
  else if (n == 21.0){ a = -0.86; b = -0.24; a2 = 0.20; b2 = 0.88; cw = 0.112; h = 0.305; }
  else if (n == 23.0){ a = -0.86; b = -0.08; a2 = 0.46; b2 = 0.88; }    // card, contactless
  else if (n == 24.0){ a = -0.86; b =  0.10; }                          // the auth code
  else if (n == 29.0){ a = -0.48; b =  0.48; }                          // thank you
  else return 0.0;

  h *= hv;
  float ik = runIk(u, ry, a, b, cw, h, sd, fu, fr);
  if (a2 < 1.5) ik = max(ik, runIk(u, ry, a2, b2, cw, h, sd + 31.0, fu, fr));

  /* And the fallback. Where one character is thinner than a pixel there
     is nothing to resolve, so the row goes to the tone it would average
     to — which is the difference between fine print on a phone and a
     field of crawling speckle.

     THE MEAN OF A RUN BELONGS OVER THAT RUN. This used to hand back one
     flat number for the whole row: across the full width of the sheet,
     including the margins either side of the type and the gap between a
     line's two runs, and through the full height of the row pitch, top
     edge to bottom edge. Thirty of those stack edge to edge with nothing
     between them, each at its own tone because each row's coverage is
     its own, so what the phone drew was a ladder of flat grey rectangles
     with a hard seam at every row boundary — and a sheet tiled in flat
     rectangles has no shading left, which is why the curl went out of it.
     At 1440 un is about a fifth of what it is at 390 and the same wash is
     a faint veil under legible type; at 390 un saturates and the wash is
     all there is.

     So the mean is laid down in the footprint the type would have had —
     inside the runs, inside the line's own height, one pixel of edge on
     every side — and at the density the type actually carries rather than
     scaled by how long the line is. The gutter between two lines goes
     back to being paper, and the paper is what was carrying the curl.

     Below about two pixels a row the profile itself cannot be resolved,
     so it opens back out to the whole pitch at its own duty cycle, which
     preserves the mean exactly across the handover — the alternative is
     to swap one aliasing pattern for another up at the top of the bow
     where the sheet is edge on. */
  float un  = clamp(max(fu / (cw * 0.70), fr / (h * 1.50)), 0.0, 1.0);
  float fe  = max(fu, 1e-5);
  float run = clamp((u - a) / fe + 0.5, 0.0, 1.0) * clamp((b - u) / fe + 0.5, 0.0, 1.0);
  if (a2 < 1.5) run = max(run, clamp((u - a2) / fe + 0.5, 0.0, 1.0)
                              * clamp((b2 - u) / fe + 0.5, 0.0, 1.0));
  float line = clamp((h - abs(ry - 0.5)) / f, 0.0, 1.0);
  float duty = clamp(2.0 * h, 0.0, 1.0);
  float coarse = clamp(fr * 2.0 - 0.6, 0.0, 1.0);
  return mix(ik, 0.50 * run * mix(line, duty, coarse), un * un);
}

void main(){
  vec2  s0   = (2.0 * gl_FragCoord.xy - uRes) / uRes.y;
  float asp  = uRes.x / uRes.y;
  float wide = smoothstep(0.95, 2.00, asp);
  float e    = smoothstep(0.0, 1.0, uEnter);

  /* ---------------- the clock ----------------
     Fourteen seconds, and the phase is chosen rather than left at zero: a
     reader arriving finds a receipt already a third of the way out and
     still coming, which is the part of this worth watching, instead of an
     empty slot. */
  float T   = 13.0;
  float cyc = fract(uTime / T + 0.260);

  float Lfull = AA + RR * THM;
  gP = Lfull / ROWS;

  /* Printing, and it RATCHETS. A thermal head feeds a line at a time: the
     paper moves for the first half of each beat and stands still for the
     rest, thirty-four times. A smooth ramp here reads as a conveyor, and
     that is the animation this file was rebuilt to stop being. */
  float prn  = clamp(cyc / 0.700, 0.0, 1.0);
  float rows = prn * ROWS;
  float ri   = floor(rows);
  gL = (ri + smoothstep(0.0, 0.50, rows - ri)) * gP;
  if (cyc > 0.700) gL = Lfull;

  /* The pull, and then the tear. The receipt is drawn tight against the
     bar first — a little more paper, the bow straightening — and then it
     separates, the lower edge going ragged in the same instant, and is
     lifted up and away. A tear takes about a second in life and it takes
     about a second here: the first cut of this eased in on a cubic and
     the receipt sat perfectly still for two seconds after it had already
     come off the bar, which is not a tear, it is a freeze. It leaves the
     frame long before the loop closes, which is what makes the seam
     invisible — at the end of the cycle there is nothing on screen to be
     discontinuous with the empty slot at the start of it. */
  float pull   = smoothstep(0.735, 0.782, cyc);
  float detach = smoothstep(0.782, 0.797, cyc);
  float flyK   = smoothstep(0.782, 0.862, cyc);

  gSA  = min(gL, AA) + 0.045 * pull;
  gHi  = max(gSA, mix(-0.220, 0.032, detach) + 0.002);
  gTh  = max(0.020, (gL - min(gL, AA)) / RR) * (1.0 - 0.10 * pull);
  gHS  = sin(gTh * 0.5); gHC = cos(gTh * 0.5);
  gYlo = mix(-0.220, 0.032, detach);
  gJag = 0.013 * detach;

  /* Up, forward and a little to the reader's side — a hand lifting it off
     the bar, not a prop falling over. */
  vec3 TEAR = vec3(-0.380, 0.852, 0.358);
  gPapO = vec3(0.0, 0.068, 0.100) + TEAR * (flyK * (0.35 + 0.65 * flyK) * 7.6);

  /* The paper's bound, from the curve's own reach. The arc never passes a
     quarter turn early or half a turn late, so both extremes are solved
     rather than guessed, and a fifth of a unit of margin is added on top. */
  float zMax = RR * (1.0 - cos(min(gTh, PI))) + THK + 0.020;
  float yMax = gHi + RR * (gTh > 1.5708 ? 1.0 : sin(gTh)) + THK + 0.020;
  float yMin = gYlo - THK - 0.020;
  gPapC = vec3(0.0, (yMax + yMin) * 0.5, (zMax - THK - 0.020) * 0.5);
  gPapE = vec3(HW + THK + 0.015, (yMax - yMin) * 0.5, (zMax + THK + 0.020) * 0.5);

  /* ---------------- the camera ----------------
     Close, and about thirty degrees to one side, drifting a few degrees
     either way on one cosine so the loop closes on itself. That angle is
     the whole reason the bow reads as a bow: dead on it is a rectangle. */
  /* The side it is seen FROM decided how the bow reads, and the first cut
     of this got it backwards. From the machine's right the paper bows to
     the left of the picture and the front of the machine recedes that way
     too, so a receipt leaning toward the reader looked like a receipt
     falling over backwards. Seen from the left, forward IS rightward on
     the screen: the paper stands up, rolls right and comes down in front
     of the machine, which is what it is actually doing. */
  float sweep = cos(6.2831853 * cyc);
  float th0 = -0.575 - 0.105 * sweep + (uPointer.x - 0.5) * 0.300;
  float ph0 =  0.215 + 0.055 * sweep + (uPointer.y - 0.5) * 0.140;
  float D   = 3.80;
  vec3  ta  = vec3(0.0, 0.150, 0.060);
  vec3  ro  = ta + vec3(sin(th0) * cos(ph0), sin(ph0), cos(th0) * cos(ph0)) * D;
  vec3  ww  = normalize(ta - ro);
  vec3  uu  = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
  vec3  vv  = cross(uu, ww);

  /* The field of view is solved against the band's HEIGHT on a long band
     and against its WIDTH on a narrow one — a 4:5 phone block has height
     to spare and no width at all, and a camera tuned on 21:9 crops the
     machine's corners off it. So the narrow band pulls back. */
  float halfH = mix(1.330, 1.300, wide);
  /* Where it sits. Vertically on the middle of the object's real extent,
     which runs from the machine's feet to the top of the bow and is not
     centred on either. Horizontally it only moves on a long one: centred
     on 21:9 the machine sits in the middle of a great deal of nothing
     with the kicker stranded under it. */
  float yOff = mix(0.075, 0.150, wide);
  float xOff = 0.780 * wide;
  vec2  s    = vec2(s0.x - xOff, s0.y - yOff);
  vec3  rd   = normalize(s.x * uu + s.y * vv + (D / halfH) * ww);
  float pxk  = 2.0 * halfH / (D * uRes.y);

  /* The key, declared up here rather than down at the surface, because
     the counter's shadow is thrown by the same lamp that lights the
     machine. A shadow aimed by one vector while the shading is aimed by
     another is a sticker, and that is what used to be under this thing. */
  vec3 lig = normalize(vec3(-0.460, 0.600, 0.660));

  /* ---------------- the room ----------------
     Paper at the foot where the words go, taking violet as it climbs, a
     pool of light behind the machine, the counter darkening away below
     it, and the shadow the machine keeps off that counter. All of it out
     of uColors and uInk: this is the part that has to look like the rest
     of the website. */
  /* How deep the room is was the last thing to get fixed here, and it was
     the whole picture. A near-white wall behind a white receipt is not a
     bright scene, it is a scene with no receipt in it: the paper measured
     0.78 against a backdrop of 0.87 and read as grey card. The wall now
     carries most of the house violet by the time it reaches the height
     the object stands at, and the paper is the brightest thing in the
     frame — which is what a till receipt is in a shop. */
  float gy = gl_FragCoord.y / uRes.y;
  vec3  bg = mix(uColors[3], mix(uColors[2], uColors[1], 0.640), smoothstep(-0.14, 0.94, gy));
  // The pool of light sits BESIDE the machine rather than behind it: a glow
  // centred on the object is a glow that erases its own silhouette, and on
  // a long band this is also what lifts the open left the kicker sits in.
  vec2  gp = vec2((s.x + mix(0.62, 1.20, wide)) * 0.86, (s.y - 0.22) * 0.78);
  bg = mix(bg, uColors[3], exp(-dot(gp, gp) * 0.90) * 0.30);
  bg = mix(bg, mix(uColors[1], uInk, 0.220),
           smoothstep(0.52, 1.62, abs(s0.x) / max(asp, 0.80)) * 0.240);
  // The counter: no line, just a darker surface going away under the machine.
  bg = mix(bg, mix(uColors[1], uInk, 0.300), smoothstep(-0.08, -0.62, s.y) * 0.460);
  /* ---- and what the machine keeps off it ----
     In the ROOM, not on the screen. The counter is the plane the feet
     stand on — y = -0.400, the body's own underside — so every ray that
     reaches it is asked two questions.

     How far is it from the footprint: that is the ambient the box takes
     out of the floor beside it, and it is tightest and darkest along the
     line where the plastic meets the laminate, loosening as it runs away
     from it. And can the key see it: that is the shadow the box throws
     back and to the right, sampled three times up the body so it widens
     and lightens the further it gets from the edge that casts it.

     A screen-space blob lived here and it was neither of those. It was
     pinned to the frame, so the camera drifted the machine off it; it was
     a soft Gaussian with its darkest point out in front of the feet
     rather than at them; and it was flat violet, mixed toward black.
     This one is anchored to the object in world space, so it moves with
     it, and it is not painted on at all — it takes the counter's own
     colour down and pushes it toward the violet that is filling every
     other shadow in the frame, because a shadow is the light that is
     missing rather than a grey decal laid over the floor. */
  float fdy = -rd.y;
  if (fdy > 0.002){
    vec3  fp = ro + rd * ((ro.y + 0.400) / fdy);
    vec2  fq = vec2(fp.x, fp.z + 0.100);     // the footprint's own frame
    vec2  fh = vec2(0.5050, 0.4400);         // and its half extent
    vec2  fd = abs(fq) - fh;
    float dC = length(max(fd, 0.0)) + min(max(fd.x, fd.y), 0.0);
    dC = max(dC, 0.0);
    /* Three falloffs rather than one, because the floor in FRONT of the
       machine is seen at twelve degrees: a tenth of a unit of counter
       there is seven pixels, and a single soft curve tuned to look right
       across that seven pixels is a fog bank out at the sides where the
       same tenth of a unit is twenty-five. The tight one draws the line
       where the plastic meets the laminate, the middle one is the ambient
       the box takes out of the floor beside it, and the long one is the
       pool that is still faintly there half a machine away. */
    float con = exp(-dC * 24.0) * 0.80 + exp(-dC * 7.0) * 0.45
              + exp(-dC *  2.4) * 0.22;
    vec2  sl  = lig.xz / lig.y;              // one unit of height, sideways
    float cst = 0.0;
    for (int i = 0; i < 3; i++){
      float h  = 0.090 + 0.175 * float(i);
      vec2  sq = abs(fq + sl * h) - fh;
      float dh = length(max(sq, 0.0)) + min(max(sq.x, sq.y), 0.0);
      cst += smoothstep(0.022 + 0.62 * h, -0.030, dh);
    }
    float sh = clamp(con + cst * 0.230, 0.0, 1.0);
    bg *= mix(vec3(1.0), vec3(0.345, 0.315, 0.480),
              sh * smoothstep(0.004, 0.070, fdy));
  }

  vec3 col = bg;

  /* ---------------- one march ----------------
     It also keeps its closest approach, measured in PIXELS. That single
     extra float is the whole of the edge antialiasing: a ray that missed
     by half a pixel is shaded where it came nearest and blended in by how
     near it came, so the tear bar's teeth and the paper's edge have soft
     silhouettes without a second sample anywhere. */
  int   steps = uTier > 0.75 ? 48 : uTier > 0.25 ? 36 : 24;
  float t = 2.20, near = 1e9, nt = 2.20;
  for (int i = 0; i < 48; i++){
    if (i >= steps) break;
    float d = map(ro + rd * t);
    float rel = d / (t * pxk);
    if (rel < near){ near = rel; nt = t; }
    if (rel < 0.35) break;
    t += d * 0.92;
    if (t > FAR) break;
  }
  float cover = smoothstep(1.30, 0.40, near);

  if (cover > 0.002){
    vec3 pos = ro + rd * nt;
    vec3 nor = normalAt(pos);

    /* Which part was hit. One evaluation of each field, once, here —
       never in the loop. */
    vec3  q   = pos - gPapO;
    float dPa = sdPaper(q);
    float dBd = sdBody(pos);
    float dBr = sdBar(pos);

    vec3  base;
    float shin, spAmt, mtl, frAmt;
    vec3  emis = vec3(0.0);

    if (dPa < min(dBd, dBr)){
      /* ---- thermal paper ----
         Where on the sheet, and which face. The arc length comes off one
         atan, taken here and nowhere else; sTop is measured from the
         LEADING edge, so it is welded to the sheet and the print does not
         slide while the paper feeds. */
      vec2  pc  = vec2(q.z, q.y);
      float sSg = clamp(pc.y, min(gYlo, gHi - 0.002), gHi);
      float dSg = length(pc - vec2(0.0, sSg));
      vec2  qq  = pc - vec2(RR, gHi);
      float ang = atan(qq.y, -qq.x + 1e-6);
      float lq  = length(qq);
      float dAr, sAr;
      if (ang <= 0.0)        { dAr = length(qq - vec2(-RR, 0.0)); sAr = 0.0; }
      else if (ang >= gTh)   { dAr = length(qq - RR * vec2(-cos(gTh), sin(gTh))); sAr = RR * gTh; }
      else                   { dAr = abs(lq - RR); sAr = RR * ang; }
      bool onArc = dAr < dSg;
      float sArc = onArc ? gHi + sAr : sSg;
      // Positive on the printed face, on both pieces, and continuous
      // across the join — the +z side of the straight run IS the inner
      // side of the bow, which is where the print goes.
      float pf   = onArc ? (RR - lq) : pc.x;
      float sTop = gL - sArc;
      float u    = q.x / HW;

      /* One pixel, where it landed, foreshortened by how the surface is
         turned away — which is what makes a receipt seen nearly edge-on
         fade to grey instead of shimmering. */
      float fw = pxk * nt / max(0.18, abs(dot(nor, rd)));
      float ik = receiptInk(u, sTop, fw / HW, fw / gP, mix(1.35, 1.0, uTier));
      // The back of a till receipt is thin enough to show its own print.
      ik *= pf > 0.0 ? 1.0 : 0.055;

      vec3 PAPER = vec3(0.960, 0.951, 0.930);   // thermal white, barely warm
      vec3 WARM  = vec3(0.905, 0.842, 0.742);   // and the cut edge, warmer
      vec3 PRINT = vec3(0.108, 0.104, 0.120);   // thermal grey-black, never ink
      base = PAPER;
      /* The warm is on the CUT EDGES, where the coating stops and the
         fibre shows: the two slit sides, the torn foot once it is torn,
         and the leading edge the blade left on the last one. Painted by
         u instead, as the first cut of this did, it is not an edge at
         all — it is a buff border printed down the sheet. */
      float edge = smoothstep(0.50, 0.90, abs(nor.x)) * 0.80
                 + smoothstep(0.075, 0.004, sArc - gYlo) * gJag * 46.0
                 + smoothstep(0.024, 0.003, gL - sArc) * 0.70;
      base = mix(base, WARM, clamp(edge, 0.0, 0.85));
      // fibre, so a sheet of paper is not a sheet of plastic
      base *= 0.985 + 0.030 * hash21(floor(vec2(u * 260.0, sArc * 260.0)));
      base = mix(base, PRINT, ik);
      shin = 26.0; spAmt = 0.085; mtl = 0.030; frAmt = 0.05;
    } else if (dBr < dBd){
      /* ---- the tear bar ----
         Stainless, and the only bright metal on the machine. */
      base = vec3(0.605, 0.610, 0.632);
      // The flank of each notch, a shade off the crown. It tracks the
      // geometry's own pitch — a stripe at one frequency over teeth at
      // another is what turned a strip into a string of beads.
      base = mix(base, vec3(0.430, 0.434, 0.458),
                 smoothstep(0.30, 0.90, abs(fract(pos.x * 18.0) - 0.5) * 2.0) * 0.38);
      shin = 78.0; spAmt = 1.00; mtl = 0.560; frAmt = 0.26;
    } else {
      /* ---- the machine ----
         Charcoal ABS: dark, slightly cool, and a shell rather than a
         solid — so the seam round the lid, the recess the slot sits in
         and the well round the feed button are all in the albedo, read
         off the machine's own coordinates. */
      base = vec3(0.216, 0.212, 0.238);
      // the recessed bezel the slot sits in
      float bz = smoothstep(0.260, 0.180, abs(pos.z - 0.105)) * smoothstep(0.470, 0.400, abs(pos.x))
               * smoothstep(0.020, 0.062, pos.y);
      base = mix(base, vec3(0.128, 0.126, 0.145), bz * 0.70);
      // the seam where the lid lifts, and the dark of the throat itself
      base = mix(base, vec3(0.072, 0.070, 0.084),
                 smoothstep(0.024, 0.006, abs(pos.y + 0.004)) * 0.55);
      base = mix(base, vec3(0.038, 0.037, 0.046), smoothstep(0.055, 0.010, pos.y) *
                 smoothstep(0.060, 0.030, abs(pos.z - 0.100)));
      // the well round the feed button, and the button's own grey
      float bd = length(vec3(pos.x + 0.370, pos.y - 0.056, pos.z - 0.230) * vec3(1.0, 0.6, 1.0));
      base = mix(base, vec3(0.255, 0.252, 0.272), smoothstep(0.048, 0.036, bd));
      // the power lamp on the front, which is the only colour on the box
      float lamp = smoothstep(0.028, 0.012, length(vec2(pos.x + 0.300, pos.y + 0.108)))
                 * smoothstep(0.310, 0.332, pos.z);
      emis = vec3(0.180, 0.860, 0.330) * lamp;
      // a fine matte tooth, so a dark moulding is not a flat silhouette
      base *= 0.94 + 0.12 * hash21(floor(pos.xy * 420.0) + floor(pos.zx * 420.0));
      shin = 34.0; spAmt = 0.46; mtl = 0.200; frAmt = 0.16;
    }

    /* ---------------- light ----------------
       One key hung off the CAMERA's axes, upper left and a little in
       front, so the machine is lit the same way wherever the drift has
       got to; a violet ambient off the site's own palette; a bounce from
       the counter; two distance taps of occlusion; and — desktop only —
       one short shadow ray, which is what lays the receipt across the
       lid. Everything is albedo TIMES light: a ramp that lifts a dark
       surface toward white is what erases print, and there is a page of
       print in this frame to erase. */
    /* The key is fixed in WORLD space, not hung off the camera. Hanging it
       off the camera keeps a turntable evenly lit, but this camera only
       drifts six degrees and the frame has one surface that matters — the
       printed face, standing up toward the reader. A key aimed by its
       angle to the CAMERA landed at twenty-three degrees to that face and
       the receipt came back mid-grey with the print barely darker than
       the paper round it. Aimed in the room, upper left and well in
       front, it lands at nearly sixty, and a till receipt is the
       brightest thing in the picture, which is what it is in life. It is
       declared above the room, because the counter's shadow comes off the
       same lamp. */
    float dif = clamp(dot(nor, lig), 0.0, 1.0);
    float sh  = 1.0;
    if (uTier > 0.75 && dif > 0.01) sh = shade(pos + nor * 0.012, lig);
    float key = dif * mix(0.58, 1.0, sh);
    key = key * key * (3.0 - 2.0 * key);

    float occ = clamp(map(pos + nor * 0.060) / 0.060, 0.0, 1.0);
    if (uTier > 0.25) occ = 0.5 * occ + 0.5 * clamp(map(pos + nor * 0.190) / 0.190, 0.0, 1.0);
    occ = mix(occ, 1.0, 0.240);

    // A lit ceiling over a darker counter, and the soft frontal fill a
    // shop's general lighting throws on anything standing up in it.
    float sky = 0.5 + 0.5 * nor.y;
    float fil = clamp(dot(nor, -rd), 0.0, 1.0);
    float fre = clamp(1.0 + dot(nor, rd), 0.0, 1.0); fre = fre * fre * fre;

    // The site's violet, doing the work an overcast sky does: filling the
    // shadows and tinting them. This is the join between the object and
    // the room, and it is the reason white paper here is not cut out.
    vec3 AMBC = mix(vec3(0.865, 0.860, 0.935), uColors[1] * 1.55, 0.420);
    vec3 KEYC = vec3(1.000, 0.978, 0.938);
    vec3 c = base * (AMBC * (mix(0.360, 0.560, sky) + 0.250 * fil) * occ
                   + KEYC * key * 0.520);

    /* What the surface reflects. A shop is a lit ceiling over a darker
       counter, so the environment is that, read straight off the
       reflected ray's height — anchored in WORLD space while the key is
       anchored to the camera, which is why the highlight crawls along the
       tear bar as the view drifts. */
    vec3  ref = reflect(rd, nor);
    vec3  eC  = mix(mix(uColors[1], uInk, 0.640), uColors[3],
                    smoothstep(-0.20, 0.42, ref.y));
    float strip = (ref.y - 0.62) / 0.16;
    eC = mix(eC, uColors[3], exp(-strip * strip) * 0.85);
    c = mix(c, eC * (0.35 + 0.65 * occ), mtl * (0.34 + 0.62 * fre));

    vec3  hal = normalize(lig - rd);
    float spc = pow(clamp(dot(nor, hal), 0.0, 1.0), shin);
    c += KEYC * spc * spAmt * mix(0.30, 1.0, sh) * occ;
    // An edge, so white paper never dissolves into a pale wall.
    c = mix(c, mix(uColors[2], uColors[3], 0.55), fre * frAmt * occ);
    c += emis;

    col = mix(bg, c, cover);
  }

  /* The reveal: the room is already there and the machine arrives on it,
     which is the one way a band that compiles late does not flash. */
  col = mix(bg, col, e);
  // A little tooth, so the long wash into white never bands on a cheap
  // panel — which is the only sort of panel this will be watched on.
  col += (hash21(gl_FragCoord.xy + fract(uTime) * 53.0) - 0.5) * 0.016;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export const scene: Scene = {
  frag,
  colors: ["#551a89", "#7c74a6", "#f4f3f7", "#ffffff"],
  /* The machine at rest with a receipt half out of it, as far as stacked
     gradients can carry it — and they have to carry it, because this is
     what a reader on a slow phone looks at until the shader has compiled
     and what a device with no WebGL is left with for good. Solved at
     390x488, the band a phone gets. The object's own colours are the
     shader's own literals; everything behind it is the house palette.
     Every part is sized in PIXELS and anchored to the band's CENTRE with
     a pixel offset, which took two goes. A percentage SIZE makes the
     machine a letterbox slab on a 21:9 band and a tower on a 4:5 one,
     because a percentage of the width and a percentage of the height are
     not the same number twice. And a percentage POSITION on a
     pixel-sized layer resolves against the container MINUS that layer,
     so eight layers of different widths at the same percentage walk away
     from each other as the band gets longer — which is how the second
     cut of this came out as a machine, a lid and a receipt standing in
     three different places. calc(50% + Npx) is the fix: every part is
     centred and then moved by a fixed number of pixels, so the whole
     thing holds together at any width. */
  poster:
    // The green power lamp, on the near end of the front face.
    "radial-gradient(circle 5px at 6px 6px, #4ae27c 0 2.5px, rgb(255 255 255 / 0) 5px) " +
    "calc(50% - 37px) calc(50% + 51px) / 12px 12px no-repeat, " +
    // The tear bar: a serrated steel line across the front lip of the slot.
    "repeating-linear-gradient(90deg, #c2c5cf 0 2px, #7d808c 2px 4px) " +
    "calc(50% + 6px) calc(50% - 26px) / 144px 6px no-repeat, " +
    // The print, and the sheet it is on: the straight run standing up out
    // of the slot, and the bow hooking over to the right above it.
    "repeating-linear-gradient(180deg, rgb(26 24 33 / 0.80) 0 2px, rgb(255 255 255 / 0) 2px 8px) " +
    "calc(50% - 10px) calc(50% - 82px) / 93px 100px no-repeat, " +
    "linear-gradient(97deg, #efe9de 0 5%, #fdfcf9 26%, #f4f2ec 62%, #dbd7ce 92%, #bfb9ad 100%) " +
    "calc(50% - 10px) calc(50% - 81px) / 97px 112px no-repeat, " +
    "linear-gradient(184deg, #fdfcf8 0 44%, #ece7dc 76%, #d2ccc0 100%) " +
    "calc(50% + 78px) calc(50% - 134px) / 140px 44px no-repeat, " +
    // The lid, proud of the body, and the body itself, lit from the left.
    "linear-gradient(180deg, #45434f 0 44%, #2d2b37 100%) calc(50%) calc(50% - 14px) / 210px 20px no-repeat, " +
    "linear-gradient(97deg, #403e4b 0 6%, #2d2b37 40%, #201e28 74%, #151419 100%) " +
    "calc(50%) calc(50% + 49px) / 234px 117px no-repeat, " +
    // What it keeps off the counter, the pool of light beside it, the room.
    "radial-gradient(100px 17px at 100px 17px, rgb(85 26 137 / 0.46) 0%, rgb(85 26 137 / 0) 100%) " +
    "calc(50%) calc(50% + 62px) / 200px 34px no-repeat, " +
    "radial-gradient(58% 40% at 20% 36%, rgb(255 255 255 / 0.40) 0%, rgb(255 255 255 / 0) 100%), " +
    "linear-gradient(to bottom, #9c95b9 0%, #ada6c6 26%, #c6c1d8 50%, #e8e6ef 70%, #ffffff 86%)",
  alt: "A till receipt printing: paper ratchets out of the slot of a charcoal thermal printer a line at a time, the print appearing as it clears the steel tear bar, and the receipt bows forward over the front of the machine as it lengthens before being torn off and lifted away — then the next one starts.",
};
