import type { Scene } from "../shader-stage";

/* ------------------------------------------------------------------ *
 * Financial services — the return, filling in.
 *
 * This is the only trade on the site whose phone is scheduled by the
 * state. A plumber's phone follows the weather; this one follows a date
 * the caller did not choose and cannot move. HMRC's own January release
 * had 5.65 million returns outstanding with twenty-six days to go, and
 * 732,498 people filed on the final day itself.
 *
 * The scene before this one was a tear-off block calendar. It was a
 * picture of TIME, not of this trade — a calendar belongs to any
 * business with a diary — and its date was drawn below its own pixel. So
 * the object is now the thing the deadline is actually about.
 *
 *   the object   a self-assessment tax return: a printed paper form,
 *                flat on a pale lavender desk, ruled into boxes, with a
 *                red deadline rule across the head of it.
 *
 *   the motion   it FILLS. Figures land box by box, in ink, in the order
 *                somebody works down a form — turnover, other income,
 *                expenses, net profit — each figure written left to
 *                right a glyph at a time, wet and dark for a moment and
 *                then dry. The TOTAL lands last and alone, a beat and a
 *                half later, in a heavier double-ruled box. Then the
 *                sheet is drawn away off the top of the frame and a
 *                fresh blank one slides in UNDER it, and the next return
 *                starts.
 *
 *   the camera   top-down — sixty-nine degrees over the desk — and four
 *                degrees off square, so the sheet is a trapezoid lying on
 *                a surface rather than a rectangle pasted on one. It
 *                drifts three degrees of azimuth and one and a half of
 *                elevation on a single cosine of the whole loop, so the
 *                loop has no seam there either.
 *
 * MATERIALS. Four, and each is what the thing is: off-white paper, a
 * faint blue pre-print grid and box rule, printer's black for the ink,
 * and one red rule at the head.
 *
 * THE ROOM IS THE SITE'S, INCLUDING THE DESK. That is the whole of what
 * changed here last: the laminate was a near-black slab, which made this
 * the one band in sixteen that went dark while every other one stands in
 * lavender rolling off to white — and it made the paper do the work of a
 * light source instead of being lit by one. So the desk, the pool of
 * light, the fill in the paper's shadow side, the far end of the surface
 * and the wash at the foot of the band all come off uColors and uInk
 * now, and the PAPER, carried nearly a stop above the desk, is the one
 * bright thing in the frame. Nothing in the scene is painted a flat
 * violet: the desk is the house lavender MULTIPLIED by the light on it.
 *
 * NOTHING HERE IS POLISHED, so nothing samples a violet wall and comes
 * back lavender. The one near-specular surface is the desk's lacquer at
 * a grazing angle, and it reads a NEUTRAL STUDIO environment — a dark
 * floor, a bright overhead sweep, a warm key and a cool fill — exactly
 * as the contract says a reflective material must. Paper is diffuse, and
 * it is lit rather than tinted.
 *
 * THE SHEET IS ON THE DESK, not over it. Its underside is at y = 0 and
 * the desk is the y = 0 plane, so the two really touch — and what says so
 * is now an OCCLUSION rather than a mark. Paper is 0.011 thick; its cut
 * edge is a wall that low; a wall that low hides h/(h+e) of the horizon
 * from a point e away from it. So the contact is black in the crack, half
 * gone a paper's thickness out and a tenth of that ten thicknesses out,
 * and it is the darkest pixel in the picture — darker than the ink, which
 * is where a contact belongs. It is LIGHT REMOVED: the overhead sweep and
 * the room's violet fill simply do not arrive there, so the mark is the
 * colour this room's light leaves behind and never a swatch laid on top.
 * What it replaced was a skirt a ninth of the sheet's width laid the same
 * distance all the way round the outline, the same on the lamp's side as
 * on the side away from it, which is a drop shadow painted under a sheet
 * that is still floating. It opens into a soft wide bed, and lightens, as
 * the sheet is lifted away.
 *
 * WHAT IT COSTS. The field is TWO EXACT BOXES — the sheet in hand and
 * the sheet arriving — so there is no bounding volume anywhere in this
 * file and therefore no bound that can be handed back under the hit
 * epsilon. The march starts at 2.20 because the nearest either sheet can
 * come to the lens at any moment of the loop, at any point of the drift
 * and anywhere in the pointer's range, is 2.92 — which is the instant
 * the camera is directly over the arriving sheet, halfway in. It is
 * capped by the desk, which is one ray/plane intersection rather than a
 * plane in the field, and which is nearer than the far plane at every
 * pixel of the band; and it under-relaxes to 0.85 of the distance,
 * because paper is 0.011 thick and a full step against a thin edge is
 * what stipples a silhouette.
 *
 * THE SHADOWS ARE SOLVED, NOT MARCHED. The only occluders in the picture
 * are two rectangles at known heights, so the shadow each one throws is
 * the projection of a rectangle along the key — closed form, exact, with
 * a penumbra that widens with the gap. That is better than a sixteen
 * step ray and it costs a twentieth as much, so EVERY TIER gets it: the
 * shadow under the lifted sheet is what says the fresh one is arriving
 * beneath it, and a phone that lost it would be looking at a different
 * picture. There is no shadow ray in this file to gate on uTier, and
 * nothing in it wants one.
 *
 *   uTier 1.0  desktop  48 march steps, two occlusion taps, a second
 *                       grade of desk grain and of paper tooth
 *   uTier 0.5  tablet   36 steps, two occlusion taps, one grade of each
 *   uTier 0.0  phone    24 steps, one occlusion tap, one grade of each
 *
 * NONE OF THE PRINT IS GEOMETRY. The rules, the grid, the captions, the
 * pound signs and every numeral are resolved once at the hit point from
 * the page's own coordinates and antialiased against the ray's own pixel
 * footprint. The page is dispatched BY ROW — one band of z owns one row,
 * and the bands do not overlap — so a fragment resolves one row and not
 * five, which is what makes a form with real numerals on it affordable.
 *
 * THE FRAME IS THE SAME PICTURE AT EVERY WIDTH, and that is the whole
 * point of the numbers in it. halfH is 1.0885 at 4:5, at 16:10 and at
 * 21:9 alike, so the WHOLE SHEET — its top edge, the red rule, three
 * boxes and the total — occupies the same 51% of the band's height and
 * the same share of its width at all three. The only thing a wide band
 * adds is bare desk on the left for the kicker to sit on. The fit is
 * held by a floor, max(1.0885, 0.566/(0.93*asp)), which cannot engage
 * above 4:5 but means no aspect anyone can produce ever crops the sheet.
 *
 * The vertical is squeezed at both ends and both ends were measured off
 * a real screenshot rather than guessed. The DOCKED HEADER floats over
 * the top of this band and its lower edge sits 58px down a 617px one, so
 * the sheet's top edge sits at 0.82 of the band's height and not higher
 * — measured off the render at all three widths, 0.812 to 0.822 over the
 * whole loop — and an earlier cut of this put the red rule at 0.98 and
 * the header ate the head of the form at every width. The kicker's paper
 * starts at 0.40, so the sheet's foot stops at 0.31 and the last thing
 * on it, the total, at 0.41. That window — 0.31 to 0.82 — is why
 * the form has three boxes and a total rather than five and a total:
 * five would have put the numerals under two pixels a stroke on a phone,
 * and a form nobody can read the figures on is a sheet of paper.
 *
 * THE SEAM. Everything is periodic in 9.30s. At t=T the outgoing sheet
 * is 1.95 up-frame — the top of the band sees down to z = -0.97 and the
 * sheet's foot has reached -1.50, so it is gone and its shadow with it —
 * and the arriving sheet is exactly at home and exactly blank, which is
 * the picture at t=0 with the two sheets' names swapped. Both slides are
 * eased curves of a clamped x, so velocity is zero at both ends and
 * nothing snaps. Frames 9.30s apart were differenced: five levels out of
 * 255 at the worst pixel, which is the dither and nothing else.
 * ------------------------------------------------------------------ */

const frag = `
#define TAU 6.2831853
#define FAR 9.0

/* ---- the four materials, written as what they are ---- */
const vec3 PAPER = vec3(0.958, 0.949, 0.926);   // off-white wove
const vec3 INK   = vec3(0.072, 0.075, 0.088);   // printer's black
const vec3 PRE   = vec3(0.376, 0.502, 0.667);   // the pre-print blue
const vec3 RED   = vec3(0.729, 0.129, 0.133);   // the deadline rule

/* The sheet. Half extents, and the offset from the PRINT ORIGIN — which
   is not the sheet's centre but the point on it the camera is aimed at,
   so every layout number below is read straight off the picture. */
const vec3  SHEET = vec3(0.445, 0.0055, 0.534);
const float SOFFZ = -0.0835;

vec3 gA, gB;    // the two sheets' print origins, in the world
vec3 gLig;      // the key, in the world

float hash(vec2 p){
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

/* ---- primitives. Exact: an approximate field overshoots, and an
   overshoot in a march is a hole through the middle of a part. ---- */
float sdBox3(vec3 p, vec3 b){
  vec3 d = abs(p) - b;
  return min(max(d.x, max(d.y, d.z)), 0.0) + length(max(d, 0.0));
}
float sdBox2(vec2 p, vec2 b){
  vec2 d = abs(p) - b;
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

/* Two boxes, and that is the entire field. No bound, because there is
   nothing here a bound would save and a bound returned under the hit
   epsilon is the one mistake that has repeatedly rendered as the
   object. */
float map(vec3 p){
  return min(sdBox3(p - gA - vec3(0.0, 0.0, SOFFZ), SHEET),
             sdBox3(p - gB - vec3(0.0, 0.0, SOFFZ), SHEET));
}

vec3 normalAt(vec3 p){
  vec2 k = vec2(1.0, -1.0) * 0.0013;
  vec3 n = k.xyy * map(p + k.xyy) + k.yyx * map(p + k.yyx)
         + k.yxy * map(p + k.yxy) + k.xxx * map(p + k.xxx);
  return n / max(length(n), 1e-6);   // never normalize a possible zero
}

/* ---- the shadow, in closed form ----
   A sheet is a rectangle at a known height. Project the receiving point
   along the key onto that height and test the rectangle: exact, and the
   penumbra widens with the gap, which is the difference between a sheet
   lying on the desk (a hairline at its edge) and a sheet lifted off it
   (a soft band the arriving one slides under). Returns 1 in full light. */
float sheetShadow(vec3 p, vec3 o){
  float dy = o.y - p.y;
  if (dy <= 0.0006) return 1.0;               // nothing above: nothing to cast
  vec2  q = (p + gLig * (dy / gLig.y)).xz - vec2(o.x, o.z + SOFFZ);
  float e = sdBox2(q, SHEET.xz);
  float pen = 0.007 + 0.62 * dy;
  return smoothstep(-pen, pen, e);
}

/* ---- the contact ----------------------------------------------------
   Not a mark drawn round the sheet: the sky the sheet takes off the desk.

   What was here was a skirt 0.072 wide — a ninth of the sheet's own width
   — laid the same distance all the way round the outline whatever the
   light was doing and whatever the paper was resting on. That is a
   rectangle painted under a sheet that is still floating, and the give
   away is that it was the same band on the side the lamp is on as on the
   side it is not.

   Paper is 0.011 thick. Its cut edge is a wall exactly that low, and a
   wall that low takes the light off a laminate over a distance of its own
   height and over no more than that — which is why a printed form lying
   on a desk has a black hairline in the angle where the two meet and
   almost nothing past it. So the term is the geometry and not a drawing:
   an edge of height h seen from a distance e hides h/(h+e) of the horizon
   behind it. Full in the crack, half a paper's thickness out, a tenth of
   that ten thicknesses out — darkest and TIGHTEST at the touch, softening
   with distance, which is the falloff occlusion really has and the one a
   gaussian puddle does not.

   h is the paper's own thickness plus the daylight under the sheet, and
   the daylight is measured off the UNDERSIDE — o.y - SHEET.y — so a sheet
   at home gives exactly zero and the two surfaces are in contact rather
   than half a thickness apart, which is what the old g got wrong. As the
   sheet is drawn up, h grows: the crack opens into a soft wide bed and
   the whole mark lightens, which is what picking a sheet off a desk does
   to the mark under it. Inside the outline it saturates, because a desk
   with paper over it has no sky at all.

   It is in PAGE UNITS throughout and the sheet holds the same share of
   the band at every aspect, so the mark is the same mark at 1440, at 820
   and at 390. */
float sheetContact(vec3 p, vec3 o){
  float e   = sdBox2(p.xz - vec2(o.x, o.z + SOFFZ), SHEET.xz);
  float gap = max(o.y - SHEET.y - p.y, 0.0);
  float h   = SHEET.y * 4.5 + 1.5 * gap;
  /* h/(h+e) is written for a receiver with no size, and it is total only
     at e exactly 0 — one point, which is the one point the sheet's own
     antialiased silhouette is standing on. So the crack proper is flat: a
     paper's thickness and a half out from the outline nothing reaches the
     laminate at all, which is true of the angle between two surfaces in
     contact and is also wide enough to survive being sampled. Past it the
     falloff takes over unchanged. */
  float t0  = SHEET.y * 2.2 + 0.35 * gap;
  float occ = max(h / (h + max(e - t0, 0.0)), smoothstep(0.0, -0.045 - gap, e));
  return occ * (1.0 - smoothstep(0.012, 0.098, gap));
}

/* ---- the print -----------------------------------------------------
   Everything below is resolved once, at the hit point, in the page's own
   units, and antialiased against w — the ray's own pixel footprint on
   that surface. The sheet is 0.890 across and 1.068 down; x runs +-0.380
   inside its margins, and z runs from -0.6175 at the head to +0.4505 at
   its foot, INCREASING DOWN THE PICTURE, because the camera looks along
   -z. Everything in this file is written in those units. */
float mk(float d, float w){ return smoothstep(w, -w, d); }

float segBox(vec2 p, vec2 c, vec2 h){
  vec2 d = abs(p - c) - h + 0.030;
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - 0.030;
}

/* ---- the numerals, and they are MARKS, not a readout -----------------
   What was here was a seven-segment routine, and a seven-segment routine
   renders a seven-segment display however it is dressed: a 1 that is a
   bare bar, a 4 with a flat top, a 0 with no curve anywhere on it. The
   alt text has always said the figures land in INK, so they are now
   drawn the way ink lands — real bowls on 0 3 5 6 8 9, a real diagonal
   on 4 and 7, a stem with a flag and a foot on the 1.

   A bowl is ONE approximate-ellipse distance: two lengths, where the
   segments cost seven boxes, so the whole figure got cheaper rather than
   dearer. The straights are capsules, which is what gives every terminal
   the rounded end an inked stroke really has. */
float inkBar(vec2 p, vec2 a, vec2 b){
  vec2  pa = p - a, ba = b - a;
  float h  = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-9), 0.0, 1.0);
  return length(pa - ba * h);
}

/* The bowl. iq's cheap ellipse: the ratio k1/k2 is the local scale of the
   field and is bounded by the two semi-axes, so it is well behaved right
   up to the centre — and k1 is floored so that the one point where both
   lengths vanish can never become 0/0 and put a blot in the middle of an
   O. */
float sdOval(vec2 p, vec2 ab){
  vec2  q  = p / ab;
  float k1 = max(length(q), 1e-4);
  float k2 = max(length(q / ab), 1e-9);
  return (k1 - 1.0) * (k1 / k2);
}

/* One figure. Drawn on a cap of +-0.845 and a half width of 0.44, which
   with the 0.165 stroke and the 1.12 widening is the same 1.31 x 2.05
   advance box every layout number below was measured against, so nothing
   downstream of this moves. s is the glyph's scale. */
float digit(vec2 p, int n, float s){
  // The page's own second axis is z, and z runs DOWN the picture — the
  // head of the form is at -0.6175 and the total at +0.306. So every
  // glyph is turned over on its way in, or the form fills itself out
  // upside down, which is exactly what the first cut of this did.
  p = vec2(p.x, -p.y) / s;
  p.x /= 1.12;                  // figures are a shade wider than they are drawn
  const float T = 0.165;        // half the stroke, in glyph units
  float d = 1e9;
  if (n == 0){
    d = abs(sdOval(p, vec2(0.42, 0.845))) - T;
  } else if (n == 1){
    d = inkBar(p, vec2( 0.05,  0.845), vec2( 0.05, -0.845));
    d = min(d, inkBar(p, vec2(-0.25,  0.545), vec2( 0.05,  0.845)));
    d = min(d, inkBar(p, vec2(-0.27, -0.845), vec2( 0.34, -0.845)));
    d -= T;
  } else if (n == 2){
    // a shoulder, a diagonal off its right terminal, and the foot it lands on
    float b = abs(sdOval(p - vec2(0.0, 0.395), vec2(0.42, 0.455))) - T;
    d = max(b, 0.200 - p.y);
    d = min(d, inkBar(p, vec2( 0.379,  0.200), vec2(-0.40, -0.845)) - T);
    d = min(d, inkBar(p, vec2(-0.40, -0.845), vec2( 0.42, -0.845)) - T);
  } else if (n == 3){
    // two bowls open to the left, meeting at the waist
    float u = abs(sdOval(p - vec2(0.0,  0.425), vec2(0.36, 0.420))) - T;
    float l = abs(sdOval(p - vec2(0.0, -0.415), vec2(0.42, 0.430))) - T;
    d = min(max(u, -0.12 - p.x), max(l, -0.16 - p.x));
  } else if (n == 4){
    d = inkBar(p, vec2( 0.16,  0.845), vec2(-0.42, -0.125));
    d = min(d, inkBar(p, vec2(-0.42, -0.125), vec2( 0.40, -0.125)));
    d = min(d, inkBar(p, vec2( 0.18,  0.845), vec2( 0.18, -0.845)));
    d -= T;
  } else if (n == 5){
    d = inkBar(p, vec2(-0.36,  0.845), vec2( 0.38,  0.845));
    d = min(d, inkBar(p, vec2(-0.36,  0.845), vec2(-0.36,  0.020)));
    d -= T;
    // the bowl, with the sliver above its own waist on the left taken out
    float b = abs(sdOval(p - vec2(0.0, -0.345), vec2(0.42, 0.500))) - T;
    d = min(d, max(b, min(-0.36 - p.x, p.y + 0.345)));
  } else if (n == 6){
    d = abs(sdOval(p - vec2(0.0, -0.335), vec2(0.42, 0.505))) - T;
    float k = inkBar(p, vec2( 0.24,  0.845), vec2(-0.22,  0.330));
    k = min(k, inkBar(p, vec2(-0.22,  0.330), vec2(-0.40, -0.230)));
    d = min(d, k - T);
  } else if (n == 7){
    d = inkBar(p, vec2(-0.40,  0.845), vec2( 0.40,  0.845));
    d = min(d, inkBar(p, vec2( 0.40,  0.845), vec2(-0.14, -0.845)));
    d -= T;
  } else if (n == 8){
    float u = abs(sdOval(p - vec2(0.0,  0.450), vec2(0.34, 0.395))) - T;
    float l = abs(sdOval(p - vec2(0.0, -0.395), vec2(0.42, 0.450))) - T;
    d = min(u, l);
  } else {
    d = abs(sdOval(p - vec2(0.0,  0.335), vec2(0.42, 0.505))) - T;
    float k = inkBar(p, vec2(-0.24, -0.845), vec2( 0.22, -0.330));
    k = min(k, inkBar(p, vec2( 0.22, -0.330), vec2( 0.40,  0.230)));
    d = min(d, k - T);
  }
  return d * s;
}

/* The pound sign the box is pre-printed with: a stem, a head, a bar and
   a foot. Four strokes is all it needs at this size and all it can
   carry on a phone. */
float pound(vec2 p, float s){
  p = vec2(p.x, -p.y) / s;   // z runs down the page; the glyph does not
  float d = segBox(p, vec2(-0.02,  0.02), vec2(0.16, 0.60));
  d = min(d, segBox(p, vec2( 0.22,  0.62), vec2(0.38, 0.16)));
  d = min(d, segBox(p, vec2( 0.06, -0.12), vec2(0.40, 0.12)));
  d = min(d, segBox(p, vec2( 0.10, -0.78), vec2(0.56, 0.16)));
  return d * s;
}

/* Small print, which is not type: strokes at a pitch, each a different
   width, because a row of identical bars is a barcode and a row of
   unequal ones is a line of nine point text seen from across a desk.
   Under about three pixels a pitch they stop being strokes at all, so
   they resolve into the tone they average to rather than strobing. */
float txt(vec2 p, vec2 c0, vec2 h, float pitch, float seed, float w){
  vec2  q   = p - c0;
  float box = mk(max(abs(q.x) - h.x, abs(q.y) - h.y), w);
  float i   = floor(q.x / pitch);
  float r   = fract(sin(i * 12.9898 + seed) * 43758.5453);
  float bar = mk(abs(q.x - (i + 0.5) * pitch) - pitch * (0.27 + 0.17 * r), w);
  return box * mix(0.80, bar, smoothstep(1.4 * w, 4.2 * w, pitch));
}

/* A money figure, right-aligned with its right edge at x = 0, written
   LEFT TO RIGHT a glyph at a time: rev counts the glyphs laid so far, so
   the thousands comma arrives in its place in the run rather than with
   the digit it happens to be drawn beside. Coverage, not distance,
   because every glyph carries its own alpha. */
float money(vec2 p, float v, float nd, float s, float w, float rev){
  float advD = 1.66 * s, advC = 0.56 * s;
  float cov = 0.0, x = 0.0;
  for (int k = 0; k < 6; k++){
    float fk = float(k);
    if (fk >= nd) break;
    if (k == 3 && nd > 3.5) {
      float ac = clamp(rev - (nd - 3.5), 0.0, 1.0);
      if (ac > 0.003) {
        vec2  cp = p - vec2(x - 0.5 * advC, 0.0);
        vec2  pa = cp - vec2( 0.05 * s, 0.62 * s);   // +y is down the page
        vec2  ba = vec2(-0.13 * s, 0.36 * s);
        float hh = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-9), 0.0, 1.0);
        cov = max(cov, mk(length(pa - ba * hh) - 0.16 * s, w) * ac);
      }
      x -= advC;
    }
    float a = clamp(rev - (nd - 1.0 - fk), 0.0, 1.0);
    if (a > 0.003) {
      float dig = floor(mod(v / pow(10.0, fk), 10.0));
      cov = max(cov, mk(digit(p - vec2(x - 0.5 * advD, 0.0), int(dig + 0.5), s), w) * a);
    }
    x -= advD;
  }
  return cov;
}

/* ---- the form's own contents, and its clock -------------------------
   Three boxes worked down in the order a return is actually worked down,
   and then the total, alone, a beat and a half later. */
float rowZ(float i){ return -0.302 + 0.186 * i; }
/* Takings, then what they cost, then what is left — and the three of
   them are arithmetic rather than decoration: 84,200 less 29,640 is
   54,560, which is the figure the total is charged on. */
float rowVal(int i){
  if (i == 0) return 84200.0;   // turnover
  if (i == 1) return 29640.0;   // allowable expenses
  return 54560.0;               // net profit for the year
}
float rowCap(int i){
  if (i == 0) return 0.272;
  if (i == 1) return 0.214;
  return 0.248;
}
float rowT(int i){ return 0.80 + 1.25 * float(i); }

/* One page. tS is this sheet's own clock — a blank sheet is handed a
   time far enough in the past that nothing on it has been written yet,
   which is how the arriving sheet is blank without a second code path.

   The page is dispatched by BAND: the head owns z below -0.335, each row
   owns 0.186 of z, the total owns 0.410 to 0.625, and the bands do not
   overlap, so one fragment resolves one row. Five rows of five numerals
   evaluated at every pixel of a sheet is a form nobody can afford. */
vec3 pageInk(vec2 q, float tS, float w, vec3 paper){
  vec3 c = paper;

  /* The pre-print grid, faint and blue, the way a form is printed before
     anybody touches it. Under three pixels a square it resolves into the
     tone it averages to instead of crawling. */
  const float GP = 0.0555;
  vec2  gg = abs(fract(q / GP + 0.5) - 0.5) * GP;
  float gv = smoothstep(1.5, 3.6, GP / max(w, 1e-5));
  c = mix(c, mix(paper, PRE, 0.115), mix(0.09, mk(min(gg.x, gg.y) - 0.0012, w), gv));

  if (q.y < -0.395) {
    /* ---- the head ----
       The deadline, in red, and the one red rule on the page under it;
       then what the form is and what year it is for. */
    c = mix(c, RED, txt(q, vec2(-0.245, -0.556), vec2(0.135, 0.0106), 0.0152, 5.3, w) * 0.94);
    c = mix(c, RED, mk(sdBox2(q - vec2(0.0, -0.526), vec2(0.380, 0.0072)), w));
    c = mix(c, INK, txt(q, vec2(-0.165, -0.478), vec2(0.215, 0.0148), 0.0208, 1.7, w) * 0.90);
    c = mix(c, mix(paper, INK, 0.60),
            txt(q, vec2(-0.195, -0.440), vec2(0.185, 0.0082), 0.0131, 9.1, w));
    c = mix(c, mix(paper, INK, 0.80), mk(sdBox2(q - vec2(0.0, -0.412), vec2(0.380, 0.0022)), w));
    return c;
  }

  float ri = floor((q.y + 0.395) / 0.186);
  if (ri >= 0.0 && ri <= 2.0) {
    int   i   = int(ri);
    float zc  = rowZ(ri);
    float at  = rowT(i);
    float rev = (tS - at) / 0.085;
    float act = smoothstep(at - 0.62, at - 0.14, tS) * smoothstep(at + 0.90, at + 0.38, tS);
    float wet = exp(-max(tS - at, 0.0) * 2.4);

    // The caption, and the printed square every numbered box carries.
    c = mix(c, PRE * 0.85, mk(sdBox2(q - vec2(-0.368, zc - 0.082), vec2(0.011, 0.010)), w));
    c = mix(c, mix(paper, INK, 0.62),
            txt(q, vec2(-0.340 + rowCap(i), zc - 0.082), vec2(rowCap(i), 0.0090), 0.0131, 2.3 + 8.1 * ri, w));

    // The box: a blue rule round a faintly tinted field, and a wash in
    // it while this is the box being worked on.
    float bx = sdBox2(q - vec2(0.0, zc + 0.012), vec2(0.380, 0.062));
    c = mix(c, mix(paper, PRE, 0.050 + 0.085 * act), mk(bx, w));
    c = mix(c, mix(paper, PRE, 0.78), mk(abs(bx) - 0.0026, w));

    /* The pound sign it is printed with, and the figure, written into it
       a glyph at a time — wet and dark for a moment, then dry.

       THE FIGURE IS SET AT THE SIZE OF THE POUND SIGN IT IS WRITTEN BESIDE.
       At 0.048 a numeral stood 0.097 of the page tall in a box 0.124 deep
       — four fifths of the box, and five and a half times the height of
       the caption printed over it — so a sheet caught leaving the frame
       carried figures that belonged to a different document from the form
       under them. The pound is 1.72 glyph units on a 0.036 body, which is
       0.062 of the page; a digit is 2.02 units, so 0.034 puts it at 0.069
       and the two are the same size on the page, which is what they are on
       a real return. Nothing else moved: the glyphs, the stroke, the
       advance, the comma and the order they are written in are untouched,
       and the figure is still right-aligned to x = 0.355. */
    c = mix(c, mix(paper, INK, 0.62), mk(pound(q - vec2(-0.330, zc + 0.012), 0.036), w));
    c = mix(c, mix(INK, INK * 0.52, wet * 0.7),
            money(q - vec2(0.355, zc + 0.012), rowVal(i), 5.0, 0.034, w, rev));
    return c;
  }

  if (q.y > 0.170 && q.y < 0.400) {
    /* ---- the total ----
       Last, alone, and in a heavier box: two rules rather than one, both
       black rather than blue, and a larger figure in them. */
    float rev = (tS - 4.75) / 0.095;
    float act = smoothstep(4.12, 4.60, tS) * smoothstep(5.95, 5.25, tS);
    float wet = exp(-max(tS - 4.75, 0.0) * 2.2);

    c = mix(c, mix(paper, INK, 0.86),
            txt(q, vec2(-0.172, 0.212), vec2(0.196, 0.0108), 0.0157, 6.7, w));
    float bx = sdBox2(q - vec2(0.0, 0.306), vec2(0.380, 0.070));
    c = mix(c, mix(paper, PRE, 0.042 + 0.075 * act), mk(bx, w));
    c = mix(c, mix(paper, INK, 0.90), mk(abs(bx) - 0.0040, w));
    c = mix(c, mix(paper, INK, 0.72), mk(abs(bx + 0.0130) - 0.0018, w));

    // The total is a size up from the rows, and it keeps exactly the step
    // it had: 0.039 is to 0.034 what 0.055 was to 0.048, and it sits at
    // the size of the larger pound sign it is written beside.
    c = mix(c, mix(paper, INK, 0.70), mk(pound(q - vec2(-0.326, 0.306), 0.042), w));
    c = mix(c, mix(INK, INK * 0.52, wet * 0.7),
            money(q - vec2(0.355, 0.306), 11286.0, 5.0, 0.039, w, rev));
    return c;
  }
  return c;
}

/* The pool of light the work is under — one lamp, in WORLD space, so the
   desk and the sheet are lit by the same thing and the sheet does not
   float in a brightness of its own. Wider on a long band, where an even
   wash edge to edge would leave the frame without a centre. */
float poolAt(vec2 xz, float wide){
  vec2 v = vec2((xz.x - 0.04) * mix(0.90, 0.56, wide), (xz.y + 0.05) * 0.74);
  return exp(-dot(v, v) * 0.95);
}

/* A NEUTRAL STUDIO, and it is deliberately not the wall. The desk's
   lacquer is the only near-specular surface in this picture, and a
   lacquer that sampled a violet backdrop comes back lavender — which is
   the mistake the contract at the top of shader-stage now names. So what
   it reads is what a photographer would actually have put round it: a
   dark floor, a bright overhead sweep, a warm key and a cool fill. The
   backdrop and every diffuse surface still take the house palette. */
vec3 studio(vec3 r){
  vec3 s = mix(vec3(0.040, 0.040, 0.046), vec3(0.900, 0.905, 0.930),
               smoothstep(-0.10, 0.58, r.y));
  s = mix(s, vec3(1.000, 0.960, 0.895), smoothstep(0.42, 0.95, dot(r, gLig)) * 0.70);
  s = mix(s, vec3(0.600, 0.680, 0.810),
          smoothstep(0.35, 0.92, dot(r, vec3(0.640, 0.430, -0.636))) * 0.32);
  return s;
}

void main(){
  vec2  s0   = (2.0 * gl_FragCoord.xy - uRes) / uRes.y;
  float asp  = uRes.x / uRes.y;
  float wide = smoothstep(0.95, 2.00, asp);
  float e    = smoothstep(0.0, 1.0, uEnter);
  float gy   = gl_FragCoord.y / uRes.y;

  /* ---------------- the clock ----------------
     10.8 seconds, and every last thing in the scene is periodic in it.

       0.80 2.05 3.30       the three boxes, in the order they are worked
       4.75                 the total, alone, a beat and a half later
       4.75 -> 6.30         the return, finished, on the desk
       6.30 -> 8.40         drawn away; the fresh one slides in under it
       8.40 -> 9.30         a blank form, waiting

     The phase is chosen twice over. A reader arriving at uTime zero finds
     a form part filled rather than an empty desk; and the single frame
     the reduced-motion path draws — always at t = 2.0 — lands at cyc
     5.60, which is a finished return sitting on the desk rather than a
     total caught half written. */
  const float T = 9.30;
  float tt  = uTime / T + 0.387;
  float ph  = fract(tt);
  float cyc = ph * T;

  /* The two slides are deliberately OUT OF STEP, and that is the whole
     reading of the swap: the fresh sheet starts in before the filled one
     starts out and is all but home while the filled one is still over
     it, so for most of a second the arriving form is visibly UNDER the
     departing one. Run on one clock they simply cross a gap, which is
     what the first cut of this did and it read as two unrelated sheets. */
  float xA = clamp((cyc - 6.70) / 1.70, 0.0, 1.0);
  float xB = clamp((cyc - 6.30) / 1.55, 0.0, 1.0);
  float pA = xA * xA * (3.0 - 2.0 * xA);
  float pB = 1.0 - pow(1.0 - xB, 2.6);       // base is clamped to 0..1
  float lift = 0.062 * smoothstep(0.0, 0.24, xA);

  /* Both slides are functions of the same x, and x is 0 at both ends of
     the loop: at cyc = T the outgoing sheet is 3.10 up-frame — its whole
     2.23 of length past the top of the picture — and the arriving sheet
     is exactly at home and exactly blank, which is the picture at cyc =
     0 with the two names swapped. That is the seam, and it is exact. */
  gA = vec3(-0.32 * pA, 0.0055 + lift, -1.95 * pA);
  gB = vec3( 0.26 * (1.0 - pB), 0.0055, 2.30 * (1.0 - pB));

  /* The sheet being drawn away gives itself up over the top sixth of
     the band. The DOCKED HEADER floats across exactly that strip, and a
     corner of a printed form appearing above it reads as a bug rather
     than as a page leaving — so the page gives itself up to the room
     instead of leaving the frame, which is what the far end of a desk
     does to anything pushed on to it. It is gated on that sheet having
     actually started to move, so the one standing at home, whose head
     sits at 0.82 of the band, is never touched: at rest the gate is
     exactly zero, and by the time the head is under the header it is
     fully open. IT TAKES THE SHEET'S SHADOW WITH IT — the first cut of
     this faded the paper and left the shadow, which is a black rectangle
     lying on the desk with nothing above it. */
  float goneA = smoothstep(0.735, 0.822, gy) * smoothstep(0.02, 0.16, pA);

  // The lamp: overhead, a little to the left and a little in front. Held
  // in WORLD space, so the sheen crawls across the desk as the drift goes
  // by rather than sitting welded to the lens.
  gLig = normalize(vec3(-0.42, 0.88, 0.24));

  /* ---------------- the camera ----------------
     Down the top of the form at sixty-nine degrees — top-down, and four
     degrees off square so the sheet is a trapezoid rather than a
     rectangle pasted on. One cosine of the whole loop for the drift, so
     the last frame and the first are the same frame. */
  /* The drift is mostly AZIMUTH, and that is not a taste decision. The
     vertical field here is 0.654 radians across the whole band, so a
     hundredth of a radian of elevation slides the entire picture 1.5% of
     the band's height: the 0.026 this had at first walked the head of
     the form 20px up and down a 512px band, straight at the docked
     header. Yaw turns the sheet in its own plane and moves nothing
     vertically, so the loop can breathe on that instead. */
  float az = 0.070 + 0.040 * cos(TAU * ph) + (uPointer.x - 0.5) * 0.055;
  float el = 1.215 + 0.010 * sin(TAU * ph) + (uPointer.y - 0.5) * 0.030;
  float D  = 3.20;
  vec3  ta = vec3(0.0, 0.0055, -0.0825);
  vec3  ro = ta + vec3(sin(az) * cos(el), sin(el), cos(az) * cos(el)) * D;
  vec3  ww = normalize(ta - ro);
  // cross() with up can shrink toward zero as the camera comes over the
  // top of the object, so it is never handed to normalize() raw.
  vec3  uu = cross(ww, vec3(0.0, 1.0, 0.0)); uu /= max(length(uu), 1e-5);
  vec3  vv = cross(uu, ww);

  /* ---------------- the frame ----------------
     THE SAME PICTURE AT EVERY WIDTH. halfH is 1.0885 at 4:5, 16:10 and
     21:9 alike, which pins the whole sheet — its top edge, the red rule,
     three boxes and the total — to the same 51% of the band's height and
     the same share of its width at all three. The floor below it cannot
     engage above 4:5; it is there so that no aspect anyone can produce
     crops the sheet, including at the far end of the pointer's swing. On
     a long band the form moves right of centre, because the only thing
     the extra width buys is bare desk and the kicker should have it. */
  float halfH = max(1.0885, 0.566 / (0.93 * max(asp, 0.30)));
  vec2  s  = vec2(s0.x - 0.95 * wide, s0.y - 0.1750);
  vec3  rd = normalize(s.x * uu + s.y * vv + (D / halfH) * ww);
  // One pixel, in object units per unit of distance travelled. The march
  // converges to a pixel rather than to a fixed epsilon, which is what
  // makes the silhouette below cost nothing and the print resolve.
  float pxk = 2.0 * halfH / (D * uRes.y);

  /* ---------------- the desk ----------------
     One ray/plane intersection, not a march: an infinite plane in a
     distance field is the classic way to spend forty steps on a grazing
     ray. The camera never comes within twenty degrees of the horizon, so
     every ray in the band meets it. */
  float tD = rd.y < -0.05 ? (-ro.y / rd.y) : FAR;
  tD = min(tD, FAR);
  vec3  dp = ro + rd * tD;
  float dw = tD * pxk / max(-rd.y, 0.25);

  /* The desk is the ROOM, and the room is the site's. This was a slab of
     near-black laminate, which made it the one band in sixteen that went
     dark while every other one stands in lavender rolling off to white —
     and a black desk is also the one backdrop an off-white form cannot be
     the bright thing against, because the paper was doing the work of a
     light source instead of being lit. So the laminate now comes off
     uColors like every other surface in the room, and it is the paper,
     nearly a stop above it, that the eye lands on. */
  vec3 deskA = mix(uColors[1], uColors[2], 0.44);

  // Matte laminate: a fine grain, a brushed direction in it, and a second
  // grade of grain the desktop tier can afford. Each is faded out by its
  // own pixel footprint before it can become moire — and each is quieter
  // than it was, because grain that read as texture on a dark top reads
  // as dirt on a pale one.
  float g1 = hash(floor(dp.xz * 180.0));
  vec3  dcol = deskA * (0.95 + 0.11 * mix(0.5, g1, smoothstep(1.4, 3.2, (1.0 / 180.0) / max(dw, 1e-5))));
  dcol *= 1.0 + 0.012 * sin(dp.x * 41.0 + hash(floor(vec2(dp.z * 70.0, 3.0))) * TAU)
               * smoothstep(1.6, 4.0, (1.0 / 41.0) / max(dw, 1e-5));
  if (uTier > 0.75) {
    dcol *= 1.0 + (hash(floor(dp.xz * 430.0 + 7.3)) - 0.5) * 0.060
                * smoothstep(1.4, 3.0, (1.0 / 430.0) / max(dw, 1e-5));
  }

  float pool = poolAt(dp.xz, wide);
  float shd  = min(mix(sheetShadow(dp, gA), 1.0, goneA), sheetShadow(dp, gB));
  float con  = max(sheetContact(dp, gA) * (1.0 - goneA), sheetContact(dp, gB));

  /* The light MULTIPLIES the albedo, here and on the paper. The obvious
     alternative — ramping each surface from a dark mix up toward white —
     is what erases print: the top of that ramp lifts a black numeral
     toward the tone of the paper round it and every mark the page just
     made comes out grey. The fill is violet-grey because that is the
     only other light in this room, and it is what puts the site's colour
     into the paper's shadow side without tinting the paper itself. */
  vec3  fillC = mix(mix(uInk, uColors[1], 0.45), uColors[2], 0.46);
  /* THE CONTACT IS LIGHT REMOVED, and that is the whole of the difference
     between a shadow and a grey rectangle. Nothing is added here and no
     swatch is mixed in. This desk has two sources — the overhead sweep and
     the room's own violet fill — and in the crack under the paper's cut
     edge neither of them arrives: the sweep goes first and hardest,
     because it is the broad one the edge is standing in front of, and the
     fill goes with it but leaves a trace, so the mark takes its colour
     from the light in this room rather than from a tint chosen for it.
     Written this way it can never come out lighter, or more saturated,
     than the laminate it is cut into — which is exactly what the old
     vec3(0.44, 0.40, 0.56) multiply did, and why that read as a violet
     puddle painted under a sheet rather than as the sheet touching. */
  vec3  lit = dcol * (vec3(0.60) * (0.78 + 0.22 * pool) * mix(0.34, 1.0, shd) * (1.0 - 0.92 * con)
                      + fillC * 0.30 * (1.0 - 0.96 * con));
  // The overhead softbox in a semi-gloss desk: broad, low, and the thing
  // that gives the laminate a gradient instead of a flat field. It is
  // occluded too, because a reflection of a ceiling cannot land on the
  // strip of laminate that can no longer see the ceiling — and a sheen
  // laid over a contact is what makes the seam under an object blink.
  vec3 dh = normalize(gLig - rd);
  lit += vec3(0.86, 0.87, 0.91) * pow(clamp(dh.y, 0.0, 1.0), 20.0) * 0.13 * shd
       * (0.30 + 0.70 * pool) * (1.0 - 0.96 * con);
  // And what the lacquer reflects, which is the studio and not the wall —
  // and not in the crack either, for the same reason.
  float dfre = pow(clamp(1.0 + rd.y, 0.0, 1.0), 4.0);
  lit = mix(lit, studio(reflect(rd, vec3(0.0, 1.0, 0.0))) * 0.62,
            (0.07 + 0.34 * dfre) * (1.0 - 0.92 * con));
  /* The far end of the desk, running back into the room's own light. It
     used to run into the room's own dark, which is what put a black band
     across the top of the frame under the docked header. It starts past
     the sheet's own footprint, so the contact shadow is never hazed. */
  lit = mix(lit, mix(uColors[1], uColors[2], 0.62), smoothstep(3.10, 4.20, tD) * 0.78);

  vec3 back = lit;
  vec3 col  = back;

  /* ---------------- one march ----------------
     It starts at 2.20 because the nearest either sheet comes to the lens
     at any moment of the loop, at any point of the drift and anywhere in
     the pointer's range, is 2.92 — which is when the camera is directly
     over the arriving sheet, halfway in; it is capped by the desk, which is
     nearer than the far plane everywhere in the band; and it advances by
     0.85 of the distance rather than all of it, because a sheet of paper
     is 0.011 thick and a full step against a thin edge is what stipples
     a silhouette. It also remembers its own closest approach, measured
     in PIXELS: a ray that missed by half a pixel is shaded where it came
     nearest and blended in by how near it came, so the cut edge of a
     sheet is clean without a second sample anywhere. */
  int   steps = uTier > 0.75 ? 48 : uTier > 0.25 ? 36 : 24;
  float farO  = min(FAR, tD);
  float t = 2.20, near = 1e9, nt = 2.20;
  for (int i = 0; i < 48; i++){
    if (i >= steps) break;
    float d = map(ro + rd * t);
    float rel = d / max(t * pxk, 1e-6);
    if (rel < near) { near = rel; nt = t; }
    if (rel < 0.35) break;
    t += d * 0.85;
    if (t > farO) break;
  }
  float cover = smoothstep(1.40, 0.42, near);

  if (cover > 0.002) {
    vec3 pos = ro + rd * nt;
    vec3 nor = normalAt(pos);

    /* Which sheet, and where on it. One evaluation of each box, once, at
       the surface — never inside the loop. */
    float dA = sdBox3(pos - gA - vec3(0.0, 0.0, SOFFZ), SHEET);
    float dB = sdBox3(pos - gB - vec3(0.0, 0.0, SOFFZ), SHEET);
    bool  onA = dA <= dB;
    vec3  o   = onA ? gA : gB;
    vec2  q   = vec2(pos.x - o.x, pos.z - o.z);
    // The arriving sheet is blank because its clock has not started. One
    // code path, one page function, two sheets.
    float tS  = onA ? cyc : -30.0;

    // One pixel, in page units, along the surface the ray actually hit.
    float w  = nt * pxk / max(abs(dot(nor, rd)), 0.30);
    float up = smoothstep(0.55, 0.92, nor.y);

    vec3 base = mix(PAPER * 0.80, pageInk(q, tS, w, PAPER), up);
    // Paper tooth: fine, low, and faded out by its own footprint.
    base *= 1.0 + (hash(floor(q * 520.0)) - 0.5) * 0.050
                * smoothstep(1.3, 3.0, (1.0 / 520.0) / max(w, 1e-5));
    if (uTier > 0.75) {
      base *= 1.0 + (hash(floor(q * 1300.0 + 4.1)) - 0.5) * 0.032
                  * smoothstep(1.3, 3.0, (1.0 / 1300.0) / max(w, 1e-5));
    }

    /* A sheet of paper is never flat, and this is the whole reason a
       rectangle of off-white reads as paper rather than as a card of
       colour: three long, shallow waves perturb the NORMAL and nothing
       else, so the sheet stays geometrically flat, the print stays where
       it was printed, and the light runs across it in soft bands. The
       largest slope any of them reaches is 0.042. It is WEIGHTED by how
       far up the surface faces rather than switched on above a threshold:
       a branch on the face test puts a step in the normal along the
       sheet's own rim, which is two pixels of crawling edge that nobody
       could name and everybody would see. */
    {
      const vec2 k1 = vec2( 2.30, 1.10), k2 = vec2(-1.30, 2.70), k3 = vec2(3.90, 3.10);
      float c1 = cos(dot(k1, q) + 0.7), c2 = cos(dot(k2, q) + 2.1), c3 = cos(dot(k3, q) + 4.2);
      vec3  dn = vec3(0.0075 * k1.x * c1 + 0.0055 * k2.x * c2 + 0.0026 * k3.x * c3, 0.0,
                      0.0075 * k1.y * c1 + 0.0055 * k2.y * c2 + 0.0026 * k3.y * c3);
      nor = nor - dn * up;
      nor = nor / max(length(nor), 1e-6);
    }

    float dif  = clamp(dot(nor, gLig), 0.0, 1.0);
    // The other sheet's shadow, and its contact skirt: this is what says
    // the fresh one is arriving UNDER the one being drawn away.
    float sh2  = onA ? sheetShadow(pos, gB) : mix(sheetShadow(pos, gA), 1.0, goneA);
    float sk2  = onA ? 1.0 : (1.0 - 0.72 * sheetContact(pos, gA) * (1.0 - goneA));
    float pool2 = poolAt(pos.xz, wide);

    float occ = clamp(map(pos + nor * 0.060) / 0.060, 0.0, 1.0);
    if (uTier > 0.25) occ = 0.5 * occ + 0.5 * clamp(map(pos + nor * 0.190) / 0.190, 0.0, 1.0);
    occ = mix(occ, 1.0, 0.25);

    float key = dif * (0.42 + 0.58 * pool2) * mix(0.30, 1.0, sh2) * sk2;
    vec3  hal = normalize(gLig - rd);       // never parallel at this camera
    float spc = pow(clamp(dot(nor, hal), 0.0, 1.0), 26.0);

    /* THE PAPER IS THE BRIGHT THING. It carries the same multiply the
       desk does — the light times the albedo, never a ramp toward white,
       because a ramp is what lifts a black numeral to grey — but it is
       carried nearly a stop higher, so an off-white sheet on a lavender
       desk reads as the lit object and the desk reads as the room. */
    vec3 c = base * (vec3(0.96) * key + fillC * (0.24 * occ) + vec3(0.055));
    // The sheen sits ON the paper rather than in it, which is the other
    // half of keeping ink dark: the light catches over a printed numeral
    // exactly as it does over the paper beside it.
    c += vec3(0.92, 0.93, 0.96) * spc * 0.090 * mix(0.55, 1.0, key);
    // A trace of the room at the sheet's own grazing edge, so the paper
    // never meets the desk as a cut-out.
    float fre = clamp(1.0 + dot(nor, rd), 0.0, 1.0); fre = fre * fre * fre;
    c = mix(c, mix(uColors[2], uColors[3], 0.55), fre * 0.10);
    c = mix(c, mix(uColors[1], uColors[2], 0.62), smoothstep(3.35, 5.20, nt) * 0.26);

    if (onA) c = mix(c, back, goneA);

    col = mix(back, c, cover);
  }

  // The reveal: the desk is already there, the form arrives on it.
  col = mix(back, col, e);
  /* The foot of the band. The harness whitens the bottom of every band
     for the kicker, and the desk arriving at that cut as a step is the
     one thing this composition could get wrong — so the room's own light
     comes up under it first and the two meet without an edge. */
  col = mix(col, mix(uColors[2], uColors[3], 0.55), smoothstep(0.255, 0.065, gy) * 0.34);
  // A little tooth, so the long wash into white never bands on a cheap
  // panel — which is the only sort of panel this will be watched on.
  col += (hash(gl_FragCoord.xy + fract(uTime) * 53.0) - 0.5) * 0.016;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export const scene: Scene = {
  frag,
  colors: ["#551a89", "#7c74a6", "#f4f3f7", "#ffffff"],
  /* The form on the desk, as far as stacked gradients can carry it — and
     they have to carry it, because this is what a reader on a slow phone
     looks at until the shader has compiled and what a device with no
     WebGL is left with for good. Solved at 390x488, the band a phone
     gets, with every layer given its own size in PIXELS off a position
     computed against the remaining space, because a percentage size is
     measured against width and height separately and the same stop that
     is a sheet on a 4:5 band is a stripe on a 21:9 one. The paper, the
     blue rule and the red are the shader's own literals. */
  poster: [
    // the figures in the boxes, and the total in its heavier one — at the
    // size the shader now sets them, a little over half the depth of the
    // box rather than four fifths of it, and re-centred on the same spot
    // they held before, because a background position is measured against
    // the space the layer leaves over
    "repeating-linear-gradient(90deg, #15171d 0 9px, rgb(0 0 0 / 0) 9px 14px) 59.1% 56.3% / 74px 14px no-repeat",
    "repeating-linear-gradient(90deg, #191b21 0 8px, rgb(0 0 0 / 0) 8px 13px) 59.0% 45.4% / 68px 12px no-repeat",
    "repeating-linear-gradient(90deg, #191b21 0 8px, rgb(0 0 0 / 0) 8px 13px) 59.0% 38.3% / 68px 12px no-repeat",
    "repeating-linear-gradient(90deg, #191b21 0 8px, rgb(0 0 0 / 0) 8px 13px) 59.0% 31.2% / 68px 12px no-repeat",
    // the total's double-ruled box, then the three blue-ruled ones
    "linear-gradient(#1b1d23 0 2px, #f5f4f1 2px 29px, #1b1d23 29px) 49.5% 56.5% / 184px 31px no-repeat",
    "linear-gradient(#8ea3c0 0 2px, #f4f6f8 2px 24px, #8ea3c0 24px) 49.5% 45.5% / 180px 26px no-repeat",
    "linear-gradient(#8ea3c0 0 2px, #f4f6f8 2px 24px, #8ea3c0 24px) 49.5% 38.1% / 180px 26px no-repeat",
    "linear-gradient(#8ea3c0 0 2px, #f4f6f8 2px 24px, #8ea3c0 24px) 49.5% 30.7% / 180px 26px no-repeat",
    // the head: a hairline rule, the title, and the one red rule
    "linear-gradient(#2a2c33, #2a2c33) 49.5% 25.5% / 176px 2px no-repeat",
    "repeating-linear-gradient(90deg, #1d1f26 0 5px, rgb(0 0 0 / 0) 5px 8px) 49.5% 23.3% / 176px 7px no-repeat",
    "linear-gradient(#b52024, #b52024) 49.1% 21.1% / 170px 5px no-repeat",
    // the sheet itself, and it is the brightest thing in the picture
    "linear-gradient(162deg, #fdfcfa, #ece9e4) 49.4% 35.2% / 212px 244px no-repeat",
    // where it meets the desk, and it is a crack rather than a cushion: a
    // hard, dark, seven-pixel core sitting on the sheet's own foot at
    // 67.6% of the band, and then a much weaker bed opening out behind it.
    // The core is nearly neutral because a contact is light taken away and
    // what is left of this room in it is only a trace of the violet fill;
    // the wide part is where the fill still reaches, so it keeps the tint.
    // These are the two numbers the shader's own contact resolves to at the
    // foot of the sheet, so the poster and the scene are the same picture.
    "radial-gradient(104px 7px at 49.7% 67.6%, rgb(24 19 34 / 0.62) 0%, rgb(24 19 34 / 0) 100%)",
    "radial-gradient(132px 30px at 50.2% 68.6%, rgb(46 36 66 / 0.17) 0%, rgb(46 36 66 / 0) 100%)",
    // the pool of light the work is under, and the desk it falls on — the
    // house's own lavender rolling off to white, like every other band
    "radial-gradient(74% 46% at 50% 39%, rgb(255 255 255 / 0.30) 0%, rgb(255 255 255 / 0) 100%)",
    "linear-gradient(to bottom, #b3aac9 0%, #b6aecb 44%, #c0b9d3 68%, #cdc7dd 77%, #e6e2ef 88%, #ffffff 97%)",
  ].join(", "),
  alt: "A self-assessment tax return lying on a pale lavender desk, photographed from almost directly above: a red deadline rule across the head of the form, a title block, and ruled boxes running down the page. Figures are written into the boxes in ink, one at a time, in the order somebody works down a return, and the total arrives last in a heavier double-ruled box — then the sheet is drawn away off the top of the frame and a fresh blank form slides in underneath it.",
};
