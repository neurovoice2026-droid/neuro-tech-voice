import type { Scene } from "../shader-stage";

/* ------------------------------------------------------------------ *
 * Property management — the door entry panel, lighting up.
 *
 * This file used to draw the block itself, from across the street at
 * night: a flat elevation with a scatter of lit windows in it. It was a
 * picture rather than a thing, it was drawn rather than built, and it was
 * violet from edge to edge. All three notes came back at once, so none of
 * it survives.
 *
 * What is here now is the one object in this trade that IS the phone.
 *
 *   the object   a five-way audio door entry panel: a brushed stainless
 *                faceplate screwed to the wall beside a communal front
 *                door, a black perforated speaker grille set into the top
 *                of it, and five call buttons down the right with a
 *                printed white name card in a lit window beside each one.
 *                It is what a tenant is standing in front of at twenty to
 *                ten, what the gas engineer presses when nobody answers at
 *                14b, and the only handset in the building that rings an
 *                office rather than a flat. Every other trade on this site
 *                owns its phone. This one answers a door.
 *
 *   the motion   it LIGHTS UP. Six presses in twelve seconds, out of order,
 *                each one a button going in, its name window coming up
 *                amber, and the light falling away again over about a
 *                second. Five of them are somebody at the door. The sixth —
 *                the second button down, a third of the way through — is the
 *                call that was ANSWERED: it holds for three and a half
 *                seconds instead of a quarter of one. Its tail is the only
 *                light that ever overlaps the next press, which is what
 *                makes it read as the one that stayed. Nothing else in the
 *                frame moves. A door panel bolted to a wall does not swing,
 *                drip, topple or turn, and pretending otherwise would have
 *                been the tell.
 *
 *                AND THE AMBER BELONGS TO THE BUTTONS. A cut of this scene
 *                gave the answered call a "talk ring" as well — an amber
 *                annulus in the plate just outside the speaker recess, and
 *                a glare annulus over it, breathing at the rate of speech.
 *                It rendered as a bright orange halo round the grille, and
 *                it was invented hardware: no audio entry panel has a lamp
 *                round its speaker. The grille is a black powder-coated
 *                insert and it has no light of its own, so the ring, its
 *                glare and the faint backlight behind the holes are all
 *                gone. What tells you the call was answered is the one name
 *                window that stays lit while the other four flicker.
 *
 *   the camera   straight on and close, the way you meet a panel you are
 *                about to press. Five degrees of yaw and three of pitch
 *                across the whole loop, one cosine of the cycle each so the
 *                seam cannot exist, a per cent of dolly, and a little more
 *                from the pointer. What that buys is not parallax, it is the
 *                HIGHLIGHT: a brushed plate under a moving eye throws its
 *                grain across itself, and that travelling smear is the
 *                difference between steel and grey paint.
 *
 * ---------------------------------------------------------------------
 * COLOUR, WHICH IS THE NOTE THAT CAME BACK AND THE ONLY THING THAT CHANGED.
 *
 * The owner's words: "the code calls the faceplate brushed stainless; it
 * renders LAVENDER at all three widths, with lavender name cards and a
 * violet perforated grille." Every one of those was true, and all three had
 * the same cause. The plate was being lit, shadowed, occluded AND reflected
 * out of the house palette: its dark end was five parts uInk, its grain
 * swung from violet to white, its occlusion was a mix towards uInk, and —
 * the big one — the room it reflected was a violet-to-white gradient. A mid
 * grey with violet in its shadows, violet in its grain and violet in its
 * mirror is not a mid grey. It is lavender.
 *
 * So the plate now obeys the stage's studio rule. A polished surface has
 * almost no colour of its own; it is whatever is around it, and what a
 * photographer puts around a steel plate is a DARK FLOOR, A BRIGHT
 * OVERHEAD SWEEP, A WARM KEY AND A COOL FILL. studio() below is exactly
 * that and nothing else — there is not one house colour in it. The
 * faceplate and the black buttons sample it; the wall, the lamp's pool, the
 * haze and the cast shadow are still uColors and uInk, because the backdrop
 * is where the site's hand belongs.
 *
 * The object's own colours, written as literals:
 *
 *     STEEL   0.560 grey, a hair cool          brushed 304 stainless
 *     GRILLE  0.058 near-black                 the powder-coated insert
 *     PLASTIC 0.040 near-black                 moulded ABS call buttons
 *     CARD    0.905 warm white                 printed name card
 *     AMBER   255,130,27                       the lamp behind the lens
 *
 * Three materials, an insert and a light. Nothing in the object is a tone
 * of the palette any more; what the room contributes to it is a TINT in the
 * dark end — a fifth for a white card, an eighth for steel, a twentieth for
 * black plastic — which is what an object standing in a violet-lit lobby
 * actually does, and what stops it reading as a cut-out.
 *
 * Two tone decisions are worth keeping. The wall is the PALEST thing in the
 * frame, because a steel plate is a mid grey and a mid grey only reads as
 * metal against something lighter than it — the first cut had a deep violet
 * wall and the panel read as a lilac sticker on a lilac wall. And the amber
 * is added as LIGHT on top of a base that has itself gone amber, not as
 * emission alone: emission alone drove the lit window to white, and a white
 * window is a hole cut in the plate rather than a lamp behind it.
 * ---------------------------------------------------------------------
 *
 * WHAT MAKES IT READ AS BRUSHED rather than as a grey rectangle, since a
 * flat plate has one normal and one normal is one tone:
 *
 *   · the anisotropic lobe. The grain runs across the plate, so the plate
 *     scatters across it, and the half vector's component ALONG the grain is
 *     forgiven. What comes back is a broad horizontal sheen, hottest near
 *     the lamp and gone by the foot of the plate, and it travels as the
 *     camera eases. Its exponent is 26, not the 46 the first cut used: at 46
 *     the lobe had collapsed to nothing anywhere but the top two rows and
 *     the plate below it was flat.
 *   · the grain itself, as fine horizontal streaks in the REFLECTION rather
 *     than stripes in the albedo. It is carried at two pitches, forty-six
 *     lines to the unit and fifteen, and each is faded out by its own pixel
 *     footprint before it can alias — the first cut ran one pitch with no
 *     footprint test at all, and on a tablet at eight tenths of a pixel per
 *     line it beat into a dozen fat horizontal bars.
 *
 * How it is made. One distance field, one march per fragment, breaking on a
 * hit and on a far plane. The WALL is not in that field — it is one
 * ray-plane intersection, shaded analytically — which buys three things at
 * once: rays that miss the panel leave on the far plane instead of spending
 * a step budget converging on a plane, the closest-approach trick gives the
 * plate a properly antialiased silhouette against it, and the panel's cast
 * shadow is SOLVED rather than sampled — the faceplate stands 0.030 off the
 * plaster on its back box, so what it keeps off the wall is its own rounded
 * rectangle pushed along the lamp's direction, which is why a phone gets
 * exactly the shadow a desktop gets. That shadow is a MULTIPLY with a cool
 * tint and never a flat violet laid over the plaster: it belongs to the
 * light. The first cut painted it, at a tenth of a unit of standoff and a
 * tenth of a unit of penumbra, and it came back as a lilac halo on all four
 * sides of an object that is screwed flat to a wall. The cut after it threw
 * the shadow in the right direction and then blurred it by more than the
 * whole distance it had been thrown, which put the halo straight back: a
 * plate under a lamp up and to its left had an even grey border down its LIT
 * side, and an even grey border round a rectangle is a drop shadow. So the
 * contact is now the two marks a plate on a wall really has, kept apart — a
 * shadow under the lower and right edges, tight at the joint and opening as
 * it leaves it, and a shallow reveal round all four sides that is a hairline
 * rather than an outline. Nothing else about this panel moved to get them.
 *
 * Inside the field: the faceplate is one rounded slab with the grille recess
 * and five name openings cut out of it, the five cards are one card folded
 * five ways, and the five buttons are one button folded five ways behind a
 * box bound. The buttons are the only thing in here that moves, and because
 * they move independently the fold over them evaluates BOTH neighbouring
 * rows rather than the nearest — a nearest-cell fold is exact only while the
 * cells are identical, and two rows stop being identical the moment one of
 * them is pressed in. That second evaluation is paid for only inside a box
 * round the button column.
 *
 * What it costs, measured rather than asserted — every fragment of six
 * moments of the loop at three corners of the pointer's range, counted
 * rather than sampled. The march takes 2.2 steps a fragment at 1440x617 on
 * the desktop tier, 2.6 at 656x406 on the tablet and 3.3 at 242x302 on the
 * phone; the ninety-ninth centile is 7, 7 and 9; and the worst single
 * fragment found anywhere is 34 steps of 48, 26 of 36 and 21 of 24. NOTHING
 * on any tier reaches its own cap. Two numbers buy that and neither is a
 * guess: the march begins at 4.10 because nothing in the scene can be nearer
 * the lens than 4.778, and it ends at the ray's exit from the object's own
 * z-slab, which is one divide. The march advances by 0.85 of the distance
 * rather than all of it, because the cards, the window reveals and the
 * button lips are thin and a full step against a thin part is how a
 * silhouette stipples. What the tiers actually take off is the sixteen-step
 * self-shadow ray (desktop only — it is what puts a shadow under each
 * button) and the second occlusion tap (desktop and tablet). The cast
 * shadow, the occlusion, the studio reflection, the perforations, the grain,
 * the amber and the glare are on every tier.
 *
 * The perforations, the brushed grain, the printed names and the screw
 * dimples are all resolved once at the hit point from the plate's own local
 * coordinates. None of them is geometry and none of them is in the loop. The
 * grille carries TWO hex lattices and takes whichever the device can
 * resolve: the fine one fades out below about three pixels to the pitch, and
 * a coarse one at twice the pitch and twice the hole fades in underneath it.
 * Fading to a flat tone was tried first, and a tablet that had dropped to
 * half resolution came back with a plain disc where its speaker should be.
 * What degrades is the count of holes, never the object. The printed name
 * does the same thing in one dimension: its letter gaps fade to a LIGHTER
 * ink rather than closing up, because small type seen from across a lobby is
 * grey and a solid bar is a redaction.
 *
 * FRAMING, measured on the live page rather than guessed, and deliberately
 * untouched by this pass — it is the one thing the judge did not fault, and
 * a stranger gives the same four-word answer at 1440, 820 and 390 because
 * the plate lands in the same place at all three. The plate's vertical
 * extent is the one thing five degrees of camera cannot change, so the field
 * of view is solved against the band's HEIGHT and the width is left to do as
 * it likes. Two things eat that height: the docked header is a floating pill
 * whose foot sits at about a tenth of the band, and the kicker has both the
 * harness's paper cut and a CSS scrim over it that still has a fifth of its
 * white left a third of the way up. The plate goes between them, landing at
 * 0.36 to 0.86 of the band at every aspect ratio — 4:5 on a phone, 16:10 on
 * a tablet, 21:9 on a desktop — and the camera pulls back on the narrow band
 * rather than letting the frame crop it. On a long band it also moves right,
 * which does two jobs: the kicker gets the open left, and the plate is seen
 * ten degrees off its own normal, so its edge has thickness and it reads as
 * screwed to a wall rather than printed on one.
 * ------------------------------------------------------------------ */

const frag = `
#define TAU 6.2831853
/* Where the march starts and where it gives up. NEAR is not a guess: the
   camera sits at 5.00 +/- 0.055 from a target on the wall, it never swings
   more than 0.1455 of a radian of yaw or 0.0945 of pitch (the cosine and
   the pointer's whole range, added), so its z is never under 4.930 — and
   the nearest face of the object's bound is at 0.152. Nothing in this scene
   can be closer to the lens than 4.778, so a march that begins at 4.10 has
   two thirds of a unit of margin and skips the six steps it used to spend
   converging on an object it already knew the distance to. Those six steps
   were the whole reason a phone was reaching its own cap. FAR is 6.2 for
   the same reason at the other end: a ray that has missed is a unit and a
   half past the wall by then. */
#define NEAR 4.10
#define FAR 6.20

/* ---- the panel's layout, in its own units. The faceplate is 2.0 tall
   and 1.36 wide, which is the proportion of a five-way audio entry panel
   with a name window beside every button. Everything else is measured
   off it rather than off the frame. ---- */
#define PW  0.680          /* half width of the faceplate */
#define PH  1.000          /* half height */
#define PZ  0.100          /* its front face, the wall being z = 0 */
#define PB  0.030          /* and its back: it stands this far off the wall */
#define GRY 0.585          /* the speaker grille's centre */
#define GRR 0.300          /* and its radius */
#define BY0 0.115          /* the top row */
#define BSP 0.235          /* and the pitch down to the other four */
#define WX (-0.155)        /* the name windows' centre */
#define WHW 0.425          /* their half width */
#define WHH 0.085          /* and half height */
#define BX  0.485          /* the call buttons' column */

/* ---- the object's own colours. Not the site's, and not a palette:
   304 stainless steel reads about 0.56 neutral grey with a faint cool
   cast, the speaker insert and the call buttons are near-black, a name
   card is white paper behind a milky lens, and the lamp behind that lens
   is a low colour-temperature amber. ---- */
const vec3 STEEL   = vec3(0.560, 0.566, 0.578);
const vec3 GRILLE  = vec3(0.058, 0.058, 0.062);
const vec3 PLASTIC = vec3(0.040, 0.040, 0.044);
const vec3 CARD    = vec3(0.905, 0.898, 0.878);
const vec3 PRINT   = vec3(0.110, 0.105, 0.108);
const vec3 AMBER   = vec3(1.000, 0.510, 0.105);
const vec3 AMHOT   = vec3(1.000, 0.808, 0.510);
const vec3 CAVITY  = vec3(0.019, 0.019, 0.022);
/* A neutral near-black for the bottom of every material's own range, and
   the doorway lamp's own colour for the top of it. Neither is a tone of
   the palette: a shadow belongs to the light, not to the brand. */
const vec3 DARKN   = vec3(0.030, 0.030, 0.034);
const vec3 WARMW   = vec3(1.000, 0.952, 0.885);

/* The lamp over the doorway. One point light, so the wall gets a real
   pool with a real falloff and the panel is lit by the same thing the
   wall is — a directional key and a separate wall gradient is how a
   pasted-on object happens. */
const vec3 LAMP = vec3(-1.45, 1.95, 1.65);

/* ---- THE STUDIO ----
   What a mirror sees is a studio, not the wall. A polished surface has
   almost no colour of its own — point one at a violet backdrop and it
   renders as lavender plastic, which is precisely what this plate did —
   so the reflective materials here sample a neutral environment lit the
   way a photographer lights steel: a dark floor under it, a bright
   overhead sweep above it, a warm key where the doorway lamp is and a
   cool fill opposite. There is not one house colour in this function. The
   backdrop behind the panel is still the site's; this is only what the
   metal is looking at. */
const vec3 KEYDIR  = vec3(-0.533, 0.603, 0.595);
const vec3 FILLDIR = vec3( 0.781, 0.200, 0.591);
vec3 studio(vec3 r){
  float h = r.y;
  vec3 c = mix(vec3(0.034, 0.034, 0.039), vec3(0.290, 0.294, 0.306),
               smoothstep(-0.72, -0.04, h));
  c = mix(c, vec3(0.865, 0.870, 0.888), smoothstep(0.03, 0.58, h));
  c += vec3(0.44, 0.32, 0.15) * pow(clamp(dot(r, KEYDIR),  0.0, 1.0), 10.0);
  c += vec3(0.09, 0.12, 0.18) * pow(clamp(dot(r, FILLDIR), 0.0, 1.0),  5.0);
  return c;
}

/* ---- the animation state, resolved once per fragment in main() and
   read by the field and the shading. Five buttons: four in a vec4 and
   the fifth on its own, because a dynamically indexed array is the one
   thing in this file that would have to be trusted to a driver. ---- */
vec4  gGlowA; float gGlowB;   /* how lit each name window is */
vec4  gPushA; float gPushB;   /* and how far each button is pressed in */

float pick5(vec4 a, float b, float i){
  return i < 0.5 ? a.x : i < 1.5 ? a.y : i < 2.5 ? a.z : i < 3.5 ? a.w : b;
}

/* A hash with no sin in it: a large sine argument rounds badly on some
   mobile GPUs, and brushed steel that bands in stripes on half the phones
   in the country is worse than steel with no grain at all. */
float hash21(vec2 p){
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

/* Smooth value noise, four taps. The wall's mottle used a bare floor()
   hash and what came back was a grid of cells, which is a texture rather
   than plaster. */
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}

/* One smooth line of grain, at whatever pitch is asked for, centred on
   zero so it can be added to a reflection without shifting it. */
float grainAt(float y){
  float i = floor(y), f = fract(y);
  return mix(hash21(vec2(i, 5.0)), hash21(vec2(i + 1.0, 5.0)),
             f * f * (3.0 - 2.0 * f)) - 0.5;
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
float sdCylZ(vec3 p, float r, float h){
  vec2 d = vec2(length(p.xy) - r, abs(p.z) - h);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}
/* The same rounded rectangle in two dimensions. The cast shadow and the
   wall's contact darkening are both this, on the wall plane. */
float sdRect2(vec2 p, vec2 b, float r){
  vec2 d = abs(p) - b + r;
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - r;
}

/* One hex lattice of perforations, at whatever pitch is asked for. Returns
   how far inside a hole the point is, and how near the drilled lip round
   it. The hole's edge is softened by the FRAGMENT's own width rather than
   by a constant, so it is one pixel of antialiasing at every width instead
   of eight pixels on a phone and a quarter of one on a desktop. mod()
   rather than fract-and-shift, because the grille's coordinates go
   negative on three quarters of the disc and mod() is the one that stays
   positive there. */
vec2 perf(vec2 q, float pitch, float px){
  vec2 hg = q / pitch;
  vec2 ha = vec2(1.0, 1.7320508);
  vec2 a1 = mod(hg, ha) - ha * 0.5;
  vec2 a2 = mod(hg + ha * 0.5, ha) - ha * 0.5;
  vec2 hh = dot(a1, a1) < dot(a2, a2) ? a1 : a2;
  float hr = length(hh);
  float aa = clamp(px / pitch, 0.022, 0.240);
  float lx = (hr - 0.415) / 0.070;
  return vec2(1.0 - smoothstep(0.330 - aa, 0.330 + aa, hr), exp(-lx * lx));
}

/* Which of the five rows a point belongs to, and where that row sits.
   A CLAMPED fold, not a repeat: above the top row and below the bottom one
   the field keeps measuring from the end row, which is what makes five
   buttons five buttons and not an infinite ladder. */
float rowOf(float y){ return clamp(floor((BY0 - y) / BSP + 0.5), 0.0, 4.0); }
float rowY(float i){ return BY0 - i * BSP; }

/* ---- the faceplate ----
   One rounded slab standing PB off the plaster on its back box, with the
   grille recess and the five name openings taken out of it. Both cuts are
   cylinders/boxes that start inside the plate and finish outside it, so
   what is left is a recess with a floor at 0.080 and a wall the light can
   catch. The standoff is not decoration: it is what gives the plate's edge
   a thickness at ten degrees off its own normal, and what its cast shadow
   is computed from. */
float sdPlate(vec3 p){
  float d = sdRBox(p - vec3(0.0, 0.0, 0.5 * (PZ + PB)),
                   vec3(PW, PH, 0.5 * (PZ - PB)), 0.014);
  d = max(d, -sdCylZ(p - vec3(0.0, GRY, PZ + 0.010), GRR, 0.030));
  float i = rowOf(p.y);
  vec3  w = vec3(p.x - WX, p.y - rowY(i), p.z - (PZ + 0.010));
  d = max(d, -sdRBox(w, vec3(WHW, WHH, 0.030), 0.016));
  return d;
}

/* ---- the name cards ----
   One card, folded five ways. Slightly smaller than the opening it sits
   in and set 0.008 behind the plate's face, so there is a reveal all the
   way round it: that hairline of shadow is the whole difference between
   a card in a window and a rectangle painted on a plate. Nothing here
   moves, so the nearest-cell fold is exact. */
float sdCards(vec3 p){
  float i = rowOf(p.y);
  return sdRBox(vec3(p.x - WX, p.y - rowY(i), p.z - 0.064),
                vec3(WHW - 0.011, WHH - 0.009, 0.028), 0.012);
}

/* ---- the call buttons ----
   One button, folded five ways, and the only thing in the field that
   moves. Because each row's z is its own, the fold has to look at BOTH
   neighbouring rows: a nearest-cell fold is exact only while the cells
   are identical, and a pressed button stops being identical to the one
   above it. That is two evaluations instead of one, so the column is
   bounded first — a box round the whole strip, returned only while it is
   unmistakably larger than any hit epsilon, which keeps the second
   evaluation off every ray that was never near the buttons. */
float sdOneButton(vec3 p, float i){
  float push = pick5(gPushA, gPushB, i);
  vec3  q = p - vec3(BX, rowY(i), PZ + 0.006 - push);
  return sdRBox(q, vec3(0.088, 0.078, 0.026), 0.024);
}
float sdButtons(vec3 p){
  float bb = sdBox3(p - vec3(BX, -0.355, 0.106), vec3(0.135, 0.620, 0.062));
  if (bb > 0.05) return bb;
  float ry = (BY0 - p.y) / BSP;
  float i0 = clamp(floor(ry + 0.5), 0.0, 4.0);
  float i1 = clamp(i0 + (ry > i0 ? 1.0 : -1.0), 0.0, 4.0);
  float d  = sdOneButton(p, i0);
  if (i1 != i0) d = min(d, sdOneButton(p, i1));
  return d;
}

/* The field. The wall is NOT in it — it is a plane, and a plane in a
   march costs every ray that misses the object a full step budget to
   converge on something one line of algebra already knows. Leaving it
   out is also what gives the plate an antialiased edge against it.

   The bound is a box larger than everything inside it on all three axes,
   and it is handed back only while it is greater than 0.06 — a bound
   returned at less than the march's own hit threshold is not a bound, it
   is a surface, and that is how a scene ends up rendering as the shape of
   its own bounding volume. The threshold here is about 0.002 on a desktop
   and 0.006 on a phone, so 0.06 clears the worst of them tenfold. */
float map(vec3 p){
  float b = sdBox3(p - vec3(0.0, 0.0, 0.066), vec3(0.72, 1.05, 0.086));
  if (b > 0.06) return b;
  float d = sdPlate(p);
  d = min(d, sdCards(p));
  d = min(d, sdButtons(p));
  return d;
}

vec3 normalAt(vec3 p){
  vec2 k = vec2(1.0, -1.0) * 0.0012;
  vec3 n = k.xyy * map(p + k.xyy) + k.yyx * map(p + k.yyx)
         + k.yxy * map(p + k.yxy) + k.xxx * map(p + k.xxx);
  /* Not normalize(). Four taps of a field that happens to be flat between
     them sum to zero, and normalize(0) is a NaN that spreads through every
     dot product below and paints one black pixel per frame in a different
     place. */
  return n * inversesqrt(max(dot(n, n), 1e-12));
}

/* One short ray toward the lamp, sixteen steps, breaking on contact and
   on the lamp's own distance. It only ever darkens the panel under its
   own buttons and inside its own recesses — the shadow the panel throws
   on the WALL is solved instead, below, so this is the first thing uTier
   takes off and the picture does not change shape when it goes. */
float selfShade(vec3 p, vec3 l, float far){
  float s = 1.0, t = 0.022;
  for (int i = 0; i < 16; i++){
    float h = map(p + l * t);
    if (h < 0.0012) return 0.0;
    s = min(s, 11.0 * h / t);
    t += clamp(h, 0.022, 0.30);
    if (t > far) break;
  }
  return clamp(s, 0.0, 1.0);
}

/* A press, as a light. Fast rise, a hold, then a soft exponential fall —
   and it is written against the wrapped phase rather than against uTime,
   so the envelope closes on itself: at the instant before the press the
   fall has taken it under half a level of an eight-bit ramp, and the rise
   starts from zero. There is no seam in this loop because there is nothing
   left alight to have one. */
float press(float c, float t0, float hold, float fall){
  float d = fract(c - t0);
  return smoothstep(0.0, 0.013, d) * exp(-max(d - hold, 0.0) * fall);
}
/* And the same press as a movement: down, held, and let go. Shorter than
   the light every time, because a finger leaves before a lamp does. */
float push(float c, float t0, float dur){
  float d = fract(c - t0);
  return smoothstep(0.0, 0.010, d) * (1.0 - smoothstep(dur, dur + 0.020, d));
}

void main(){
  vec2  s0  = (2.0 * gl_FragCoord.xy - uRes) / uRes.y;
  float asp = uRes.x / max(uRes.y, 1.0);
  float wide = smoothstep(0.95, 2.00, asp);
  float e   = smoothstep(0.0, 1.0, uEnter);

  /* ---------------- the clock ----------------
     Twelve seconds, and the phase matters: at uTime zero a reader finds the
     panel half a second away from the press that matters rather than
     sitting dark, so the first four seconds anyone sees are the four in
     which the most happens. */
  float cyc = fract(uTime / 12.0 + 0.295);

  /* Six presses, out of order, on five buttons — the bottom one twice,
     because somebody always presses it again. Five of them are a quarter of
     a second held and about a second of fall. The sixth, the second button
     down, is the one that gets ANSWERED: three and a half seconds held and
     a fall far slower, and its tail is the only light in the loop that is
     still going when the next button is pressed. That tail is half of why
     it reads as the one that stayed — and its fall rate is 9.0 rather than
     8.0 so that what is left of it at the wrap is under half a level of an
     eight-bit ramp instead of a level and a half. */
  float g0 = press(cyc, 0.145, 0.024, 26.0);
  float g1 = press(cyc, 0.330, 0.300,  9.0);
  float g2 = press(cyc, 0.775, 0.026, 22.0);
  float g3 = press(cyc, 0.030, 0.028, 24.0);
  float g4 = max(press(cyc, 0.220, 0.030, 22.0), press(cyc, 0.895, 0.020, 17.0));
  float lamps = smoothstep(0.10, 0.95, uEnter);
  gGlowA = vec4(g0, g1, g2, g3) * lamps;
  gGlowB = g4 * lamps;

  gPushA = vec4(push(cyc, 0.145, 0.020), push(cyc, 0.330, 0.048),
                push(cyc, 0.775, 0.022), push(cyc, 0.030, 0.024)) * 0.016;
  gPushB = max(push(cyc, 0.220, 0.026), push(cyc, 0.895, 0.018)) * 0.016;

  /* ---------------- the camera ----------------
     Straight on, and it stays straight on: five degrees of yaw and three
     of pitch across the whole twelve seconds, each a single cosine of the
     cycle so the loop has no seam, and a little more from the pointer.
     What that buys is not parallax — it is the highlight. A brushed plate
     under a moving eye throws its grain across itself, and that travelling
     smear is the difference between steel and grey paint. */
  float th = 0.088 * cos(TAU * cyc) + (uPointer.x - 0.5) * 0.115;
  float ph = 0.052 * cos(TAU * cyc + 1.9) + (uPointer.y - 0.5) * 0.085;
  float D  = 5.00 + 0.055 * cos(TAU * cyc + 0.6);
  vec3  ta = vec3(0.0, 0.0, 0.06);
  vec3  ro = ta + vec3(sin(th) * cos(ph), sin(ph), cos(th) * cos(ph)) * D;
  vec3  ww = normalize(ta - ro);
  vec3  uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
  vec3  vv = cross(uu, ww);

  /* ---------------- the frame ----------------
     Solved against the band's HEIGHT at both ends, because the plate's
     vertical extent is the one thing the camera cannot change. The bottom
     third is paper the kicker is printed on and the top tenth is under the
     docked header; the plate is put inside what is left, with margin, at
     every aspect ratio — the camera pulls back on the narrow band rather
     than letting the frame crop it.

     Sideways it only moves on a long band. Centred on 21:9 the panel sits
     in the middle of a great deal of wall with the kicker stranded under
     it; carried right it leaves the open left to the text, and — the part
     that is worth more than the composition — it puts the plate ten
     degrees off the camera's own axis, so its edge has thickness and it
     reads as screwed to a wall rather than printed on one. */
  float halfH = mix(2.08, 2.10, wide);
  float yOff  = 0.215;
  float xOff  = 0.440 * smoothstep(1.15, 2.10, asp);
  vec2  s     = vec2(s0.x - xOff, s0.y - yOff);
  vec3  rd    = normalize(s.x * uu + s.y * vv + (D / halfH) * ww);
  /* One pixel, in world units per unit of distance travelled: the march
     converges to a pixel rather than to a fixed epsilon, which is what
     makes the silhouette antialiasing below cost nothing. */
  float pxk   = 2.0 * halfH / (D * uRes.y);

  /* ---------------- the wall ----------------
     Not marched: one ray-plane intersection, then shaded. rd.z is always
     comfortably negative here — the camera is five units in front of the
     wall and never swings more than five degrees — but it is clamped
     anyway, because a division that is only safe while a constant stays
     put is a bug with a date on it.

     This IS the house palette, and it stays: the backdrop is where the
     site's hand belongs. Only the object was ever supposed to be its own
     colour. */
  float tw = -ro.z / min(rd.z, -0.02);
  vec3  wp = ro + rd * tw;

  vec3  toL = LAMP - wp;
  float dL2 = max(dot(toL, toL), 1e-4);
  vec3  lw  = toL * inversesqrt(dL2);
  /* The wall faces +z, so its lambert is just the lamp's own z. One real
     inverse square, which is what gives the pool an edge and a centre
     without a vignette being painted on top of it. */
  float pool = clamp(max(lw.z, 0.0) / (1.0 + 0.16 * dL2) * 2.7, 0.0, 1.0);

  /* Paper at the foot where the words are, taking violet as it climbs.
     This is the house ground every band in the set stands on, and it is
     deliberately the PALEST thing in the frame: a steel plate is a mid
     grey, and a mid grey only reads as metal against something lighter
     than it. An earlier cut had a deep violet wall, and the plate came
     back looking like a lilac sticker on a lilac wall. */
  float gy = gl_FragCoord.y / uRes.y;
  vec3  wall = mix(uColors[3], mix(uColors[2], uColors[1], 0.68), smoothstep(0.02, 1.04, gy));
  /* Then the pool the lamp lays on it, smoothstepped so the falloff has a
     shoulder rather than a hard edge. */
  wall = mix(wall, uColors[3], pool * pool * (3.0 - 2.0 * pool) * 0.62);
  /* And the far corner taken down, so a long band has a centre and the
     plate is not competing with a wash lit from edge to edge. */
  wall = mix(wall, mix(uColors[1], uInk, 0.22),
             smoothstep(0.34, 1.62, abs(s0.x) / max(asp, 0.8)) * 0.52);

  /* Painted plaster: two octaves of mottle, in the WALL's own coordinates
     so it sits still under the camera, and both of them a mix towards ink
     and towards paper rather than a brightness multiplier — nothing in
     this band is a house colour scaled up or down. */
  float gr = 0.70 * vnoise(wp.xy * 21.0 + 11.0) + 0.30 * vnoise(wp.xy * 5.3 + 3.0);
  wall = mix(mix(wall, uInk, 0.034), mix(wall, uColors[3], 0.034), gr);

  /* ---------------- THE CONTACT ----------------
     A plate screwed to a wall is two marks and not one: a SHALLOW REVEAL all
     the way round the joint, and a SHADOW under the lower edge where the lamp
     cannot get round it. Both are measured off one quantity — how far the
     wall point is outside the plate's own silhouette — so they can never
     drift out of step with each other or with the object.

     What was here before had the geometry right and the softness wrong. The
     shadow was thrown correctly, down and right of a lamp that is up and
     left, but with a flat 0.045 of penumbra: one and a half times the whole
     offset it was supposed to be revealing. A blur wider than the thing it
     blurs is not a penumbra, it is a spread — it smeared an equal grey onto
     all four sides, and on top of it the contact line ran a second uniform
     halo at 0.60 of its own strength and 0.029 of falloff. Measured on the
     live page at 1440 the wall came down from 237 to 214 approaching the
     LEFT edge, which is the fully lit side of a plate under a lamp up and to
     its left. Two even borders round a rectangle is the definition of a
     drop shadow, and a drop shadow is what makes a thing read as pasted on.
     Both are tightened here and nothing else in the file is touched. */
  float rim  = sdRect2(wp.xy, vec2(PW, PH), 0.030);
  float out0 = max(rim, 0.0);
  /* One pixel of the WALL, in world units. It is used for exactly one thing:
     keeping the shadow's own edge from aliasing where a device is drawing
     fewer pixels than a desktop. The mark's SIZE and its DARKNESS are in
     world units and come off the object's own standoff, so the contact is
     the same contact at 1440, 820 and 390 — a phone is not told a different
     story about where this panel is. */
  float wpx  = tw * pxk;

  /* THE SHADOW. The faceplate stands PB off the plaster on its back box, so
     what it keeps off the wall is its own rounded rectangle pushed along the
     lamp's direction by exactly that standoff — solved rather than sampled,
     which is why it splays correctly as the wall runs away from the lamp,
     costs one 2D distance, and is on every tier. At the lamp's angle that
     comes to 0.036 under the bottom edge and 0.026 beside the right one, and
     to nothing at all above or to the left: a sliver, which is what five
     millimetres of standoff actually throws.

     Its penumbra OPENS with distance from the edge that threw it and its
     density CLOSES, so it is darkest and tightest exactly at the joint and
     is already letting the lamp back round by a centimetre out.

     A MULTIPLY, never a flat violet laid over the plaster. A shadow belongs
     to the light: it can only take the wall down, it keeps whatever the wall
     was doing underneath it, and what is left in it is the cool fill, which
     is why it comes out more violet than the plaster and never a grey. */
  vec2  off    = lw.xy / max(lw.z, 0.25) * PB;
  float sh2    = sdRect2(wp.xy + off, vec2(PW, PH), 0.030);
  /* Capped, and the cap is the point of the whole pass: a penumbra is only
     ever allowed to be a fraction of the offset it is softening. tw runs away
     on a ray that is nearly parallel to the plaster, and a penumbra that can
     run away with it is a halo waiting to happen. */
  float pen    = min(max(1.2 * wpx, 0.010 + 0.22 * out0), 0.022);
  float thrown = (1.0 - smoothstep(0.0, pen, sh2)) * exp(-out0 * 14.0);
  wall *= mix(vec3(1.0), vec3(0.32, 0.28, 0.44), thrown * 0.95);

  /* THE REVEAL, which is not the shadow and does not point anywhere: it is
     the room the plate's own edge stands in the way of, so it runs all four
     sides equally. A plate PB off a wall shades the plaster for about PB and
     then stops, so this is a hairline: half the old halo's e-fold, and what
     depth it has is spent AT the joint rather than spread out from it. Deep
     and two pixels wide is a seam; shallow and eleven pixels wide is a drop
     shadow, and the two are not interchangeable however the area under the
     curve comes out. */
  float reveal = exp(-out0 / 0.015);
  wall *= mix(vec3(1.0), vec3(0.66, 0.63, 0.75), reveal * 0.70);

  vec3 col = wall;

  /* ---------------- one march ----------------
     It also remembers its closest approach, measured in PIXELS. That one
     float is the whole of the edge antialiasing: a ray that missed the
     plate by half a pixel is shaded where it came nearest and blended
     into the wall by how near it came, so the panel's outline is clean at
     every width without a second sample anywhere.

     It advances by 0.85 of the distance rather than all of it. The cards,
     the window reveals and the button lips are thin, the CSG cuts make the
     field a bound rather than a metric near their rims, and a full step
     against a thin part is how a silhouette comes back stippled. The four
     or five steps a flat plate met head on actually costs leaves room for
     the under-relaxation many times over. */
  int   steps = uTier > 0.75 ? 48 : uTier > 0.25 ? 36 : 24;
  /* And where it stops. The whole object lives in a z-slab 0.172 deep, so a
     ray that has come out of the back of that slab cannot hit anything ever
     again — and the t at which it does is one divide, not a step budget.
     Without it, rays grazing the plate's silhouette crept the length of the
     band at four hundredths of a unit a step and about eighty parts per
     million of them reached the phone's cap of 24 every frame. With it, and
     with the later start, the march measures 2.2 steps a fragment on a
     desktop, 2.6 on a tablet and 3.3 on a phone, the ninety-ninth centile is
     7, 7 and 9, and the worst single fragment anywhere is 34 of 48, 26 of 36
     and 21 of 24. Nothing on any tier reaches its own cap. */
  float farO = min(FAR, (ro.z + 0.020) / max(-rd.z, 1e-3));
  float t = NEAR, near = 1e9, nt = NEAR;
  for (int i = 0; i < 48; i++){
    if (i >= steps) break;
    float h = map(ro + rd * t);
    float rel = h / (t * pxk);
    if (rel < near) { near = rel; nt = t; }
    if (rel < 0.40) break;
    t += h * 0.85;
    if (t > farO) break;
  }
  float cover = smoothstep(1.30, 0.40, near);

  if (cover > 0.002) {
    vec3 pos = ro + rd * nt;
    vec3 nor = normalAt(pos);

    /* Which part was hit. One evaluation of each field, once, at the
       surface — never inside the loop. */
    float dP = sdPlate(pos), dC = sdCards(pos), dB = sdButtons(pos);
    float mD = min(dP, min(dC, dB));

    float i   = rowOf(pos.y);
    float ry  = pos.y - rowY(i);
    float rx  = pos.x - WX;
    float glw = pick5(gGlowA, gGlowB, i);
    /* One fragment, in world units, at this surface. Every mark below is
       gated on ITS OWN width measured against this, never on a constant
       that happened to be typed once. */
    float px  = max(nt * pxk, 1e-6);

    vec3  base = STEEL;
    float shin = 60.0, spAmt = 0.70, mtl = 0.52, dkAmt = 0.52, ltAmt = 0.34, frAmt = 0.22;
    float ambAmt = 0.38, dkRoom = 0.13;
    float aniso = 0.0, emit = 0.0, grain = 0.0;
    vec3  emitC = AMBER;

    if (mD == dB) {
      /* ---- the button: moulded black ABS ----
         Almost no diffuse and a tight, hard highlight on its rounded lip,
         which is the only way black plastic is ever legible. What keeps it
         from being a hole in the plate is the studio in its gloss and the
         amber coming off its own name window. */
      base  = PLASTIC;
      shin  = 120.0; spAmt = 0.85; mtl = 0.30; dkAmt = 0.34; ltAmt = 0.06; frAmt = 0.34;
      ambAmt = 0.13; dkRoom = 0.05;
      /* The pressed one takes a little amber round its shoulder — a lamp
         four centimetres to its left is the only light on it. */
      base = mix(base, mix(base, AMBER, 0.55), glw * 0.30);

    } else if (mD == dC) {
      /* ---- the name card: WHITE card behind a milky lens ----
         Printed with a surname and a flat number, and both of them stay
         where they are put: the light below ramps from this card's own
         dark to this card's own albedo rather than to white, and the amber
         is multiplied by what is NOT ink, so the name reads as a dark
         silhouette on a lit window exactly as it does on a real panel.
         Ramping to white here is what erased the print twice; taking its
         dark end out of the palette is what stopped it reading lavender. */
      base  = CARD;
      shin  = 26.0; spAmt = 0.20; mtl = 0.05; dkAmt = 0.40; ltAmt = 0.26; frAmt = 0.08;
      ambAmt = 0.58; dkRoom = 0.20;

      /* One line of type: an initial, a surname whose length is the row's
         own, and the flat number out at the right end. Three blocks rather
         than one long bar — a single bar on a card reads as a redaction,
         which is exactly what the first cut of this looked like, so the
         surname is shorter now and BROKEN BY LETTER GAPS on a fixed pitch.
         Where the device cannot resolve the pitch the gaps fade to a
         lighter ink rather than closing up: small type seen from across a
         lobby is grey, and grey is honest where a solid bar is not. */
      float line = 1.0 - smoothstep(0.016, 0.025, abs(ry));
      float nm = 0.072 + 0.052 * hash21(vec2(i, 7.0));
      float w1 = 1.0 - smoothstep(0.0, 0.010, abs(rx + 0.352) - 0.016);
      float w2 = 1.0 - smoothstep(0.0, 0.010, abs(rx + 0.298 - nm) - nm);
      float w3 = 1.0 - smoothstep(0.0, 0.009, abs(rx - 0.318) - 0.044);
      /* Letters on a fixed pitch, each one its OWN width. A plain cosine
         was tried and every card came back a barcode: type is a rhythm of
         unequal strokes, and equal ones are the one thing it never is. */
      float lu   = (rx + 0.300) * 36.9;
      float li   = floor(lu), lf = fract(lu) - 0.44;
      float lw   = 0.16 + 0.17 * hash21(vec2(li, i + 3.0));
      float lets = 1.0 - smoothstep(lw, lw + 0.13, abs(lf));
      float lres = smoothstep(1.9, 3.8, 0.027 / px);
      float gap  = mix(0.66, lets, lres);
      float ink  = clamp((w1 + w2 + w3) * gap * line, 0.0, 1.0);
      base = mix(base, PRINT, ink * 0.90);

      /* The lamp is behind the card, not in front of it, so the light is
         strongest in the middle of the window and falls off towards the
         frame — and it never touches the print.
         Lighting it does two things, and the first is not emission: the
         card stops being white paper and becomes an amber one, because
         everything reaching the eye has come through the lens. Only then is
         the lamp added on top. Emission alone drove it to white and the
         window read as a hole cut in the plate. */
      float lz = exp(-(rx * rx * 2.4 + ry * ry * 30.0));
      base = mix(base, mix(base, AMBER, 0.66), glw * (0.55 + 0.45 * lz));
      emit  = glw * (0.16 + 0.42 * lz) * (1.0 - ink * 0.90);
      emitC = mix(AMBER, AMHOT, clamp(lz, 0.0, 1.0) * 0.45);

    } else {
      /* ---- the faceplate: brushed 304 stainless ----
         A mid grey, and nothing but a mid grey: the grain is a luminance
         swing on STEEL itself, not a ramp between two house colours. The
         first cut mixed from STEEL-toward-uInk to STEEL-toward-white, which
         is a hue swing of forty degrees dressed up as a finish, and it is
         half of why a stainless plate rendered lavender.

         The grain is carried at two pitches and each is faded by its own
         pixel footprint: forty-six lines to the unit, which a desktop can
         resolve at three pixels a line, and fifteen underneath it, which a
         phone can. One pitch with no footprint test is what beat into a
         dozen fat horizontal bars on a tablet at eight tenths of a pixel to
         the line. What degrades is the fineness, never the finish. */
      float gvF = smoothstep(1.7, 3.6, 0.0217 / px);
      float gvC = smoothstep(1.7, 3.6, 0.0667 / px);
      grain = grainAt(pos.y * 46.0) * gvF * 0.85 + grainAt(pos.y * 15.0 + 7.0) * gvC * 0.55;
      base  = STEEL * (1.0 + grain * 0.30);
      aniso = 1.0;
      shin = 60.0; spAmt = 0.70; mtl = 0.52; dkAmt = 0.52; ltAmt = 0.34; frAmt = 0.22;
      ambAmt = 0.38; dkRoom = 0.13;

      /* The recess floors — the grille's and the five windows' — are the
         same steel, struck by much less light. A multiply, not a mix
         towards ink: a recess in a steel plate is darker steel. */
      float inset = smoothstep(0.094, 0.084, pos.z);
      base *= mix(1.0, 0.54, inset);

      /* ---- the grille ----
         A BLACK powder-coated insert sitting on the floor of the recess,
         drilled with a hex lattice. It is its own material, not a shaded
         patch of the plate: the whole reason a five-way panel reads as a
         five-way panel from across a lobby is the black disc at the top of
         a bright plate, and the first cut had a violet disc on a lavender
         plate, which reads as nothing at all. */
      float gd = length(pos.xy - vec2(0.0, GRY));
      float gm = (1.0 - smoothstep(GRR - 0.028, GRR - 0.004, gd)) * inset;
      /* The recess wall's own shadow, hugging the inside of the rim. Two
         hundredths of an inch of depth is not enough for the occlusion taps
         to find, and without this the grille sits on the plate rather than
         in it. */
      base *= mix(1.0, 0.55, smoothstep(GRR - 0.085, GRR - 0.012, gd) * inset);
      if (gm > 0.001) {
        /* TWO lattices, and the picture takes whichever one this device can
           actually resolve. A perforation finer than about three pixels is
           not a perforation, it is a moire pattern, so the fine lattice
           fades out — but fading it to a flat tone is what a tablet running
           at half resolution got, and a flat disc is not a speaker. So the
           coarse lattice, at twice the pitch and twice the hole, fades in
           underneath it: fewer holes, bigger holes, still a grille. What
           degrades is the count, never the object. */
        float rFine   = smoothstep(2.2, 4.2, 0.042 / px);
        float rCoarse = smoothstep(2.2, 4.2, 0.084 / px);
        vec2  q  = pos.xy - vec2(0.0, GRY);
        vec2  pf = perf(q, 0.042, px);
        vec2  pc = perf(q, 0.084, px);
        float hole = mix(pc.x * rCoarse, pf.x, rFine);
        /* The bright lip each hole is drilled with, which is the reason a
           grille reads as drilled rather than as printed dots — and on a
           black insert a bright lip is still black, only less of it. */
        float lip  = mix(pc.y * rCoarse, pf.y, rFine);
        float res  = max(rFine, rCoarse);
        vec3  gb   = mix(GRILLE, CAVITY, hole * 0.94);
        gb = mix(gb, GRILLE * 2.60, lip * 0.30);
        gb = mix(gb, mix(gb, CAVITY, 0.46), 1.0 - res);
        base = mix(base, gb, gm);
        /* The insert is black plastic, not steel, so it stops taking a
           steel's share of the studio and of the key. */
        mtl    = mix(mtl,    0.22, gm);
        shin   = mix(shin, 100.0,  gm);
        spAmt  = mix(spAmt,  0.55, gm);
        dkAmt  = mix(dkAmt,  0.36, gm);
        ltAmt  = mix(ltAmt,  0.06, gm);
        ambAmt = mix(ambAmt, 0.14, gm);
        dkRoom = mix(dkRoom, 0.05, gm);
        aniso  = 1.0 - gm;
        /* And NOTHING behind it. The insert is black powder-coated plastic
           in front of a paper cone: it is the darkest thing on the panel and
           it stays the darkest thing on the panel. A cut of this scene put a
           faint amber behind the holes and an amber ring in the plate round
           them, breathing while the call was up, and what it drew at 1440
           was a glowing orange halo on a grille that has no lamp in it. The
           amber on this panel is the name windows' backlight and that only. */
      }

      /* The two security screws, top and bottom centre, as a dimple in
         the normal rather than a circle in the albedo: a painted screw
         head is the flattest thing you can put on a lit metal plate. */
      vec2 sc = vec2(pos.x, abs(pos.y) - 0.945);
      float sr = length(sc);
      if (sr < 0.040) {
        float dip = smoothstep(0.040, 0.004, sr);
        nor  = normalize(nor - vec3(sc, 0.0) * dip * 9.0);
        base *= mix(1.0, 0.74, dip);
        /* the slot */
        base *= mix(1.0, 0.30,
                    (1.0 - smoothstep(0.0035, 0.0065, abs(sc.y)))
                    * (1.0 - smoothstep(0.020, 0.026, abs(sc.x))));
      }

      /* Light leaving a window lands on the plate around it. One row's
         worth, the nearest — the second nearest is 0.235 away and would
         be adding a hundredth of nothing. */
      float sp = sdRect2(vec2(rx, ry), vec2(WHW, WHH), 0.016);
      float spill = exp(-max(sp, 0.0) * 13.0) * glw;
      base = mix(base, mix(base, AMBER, 0.60), spill * 0.42);
    }

    /* ---------------- light ----------------
       One lamp over the door, its own inverse square, two distance taps of
       occlusion, and — the thing that makes this read as a steel plate
       rather than a grey one — the STUDIO reflected off the surface. Metal
       is mostly what it reflects, and what a photographer puts around steel
       is a dark floor, a bright sweep, a warm key and a cool fill. Pointing
       it at the violet wall instead is what made a stainless faceplate
       lavender, and the wall is still violet: it is simply not what the
       plate is looking at. */
    vec3  toLp = LAMP - pos;
    float dp2  = max(dot(toLp, toLp), 1e-4);
    vec3  lig  = toLp * inversesqrt(dp2);
    float atten = 1.0 / (1.0 + 0.20 * dp2) * 3.1;
    float dif = clamp(dot(nor, lig), 0.0, 1.0);

    float sh = 1.0;
    if (uTier > 0.75 && dif > 0.01) sh = selfShade(pos + nor * 0.006, lig, sqrt(dp2));

    float fre = clamp(1.0 + dot(nor, rd), 0.0, 1.0); fre = fre * fre * fre;
    vec3  hal = normalize(lig - rd);
    float spc = pow(clamp(dot(nor, hal), 0.0, 1.0), shin);
    /* On a brushed surface the highlight is not a spot. The grain runs
       along x, so the plate scatters along x, and what comes back is the
       broad horizontal smear that crosses every brushed plate — and it
       travels as the camera eases, which is the whole reason the camera
       eases at all. */
    if (aniso > 0.0) {
      /* Project the half vector into the plane ACROSS the grain and do the
         usual specular there. Anything the half vector does along the grain
         is forgiven, which is precisely what a groove forgives — so the
         lobe comes out as a band that runs the width of the plate and is
         tight in height. The first cut used 1 - dot(T,h)^2, which is a
         band at right angles to the grain: it washed the top third of the
         plate to paper and read as a blown highlight rather than a finish.
         The exponent is 26. At the 46 that followed it, the lobe read 0.55
         at the top of the plate, 0.04 at the middle and nothing at all at
         the foot — one bright row and a flat grey sheet underneath it. */
      vec3  hp = vec3(0.0, hal.y, hal.z);
      float hl = max(length(hp), 1e-4);
      spc = max(spc, pow(clamp(dot(hp / hl, nor), 0.0, 1.0), 26.0) * 0.58 * aniso);
    }

    /* Occlusion from distance taps along the normal. The march's step
       count is not used for this: it is an integer, so what it draws is a
       contour map of itself, and a flat plate comes back looking like
       sawn wood. */
    float occ = clamp(map(pos + nor * 0.035) / 0.035, 0.0, 1.0);
    if (uTier > 0.25) occ = 0.55 * occ + 0.45 * clamp(map(pos + nor * 0.120) / 0.120, 0.0, 1.0);
    occ = mix(occ, 1.0, 0.24);

    /* The key takes each material from its OWN dark to its OWN albedo,
       and only the top of the range lifts towards the LAMP's colour. A
       ramp that runs from dark to near-white lifts a printed name and an
       inked hole to the same tone as the metal around them, and every mark
       set into the albedo above is undone here. */
    float key = clamp(dif * atten, 0.0, 1.6) * mix(0.30, 1.0, sh);
    key = clamp(key, 0.0, 1.0);
    key = key * key * (3.0 - 2.0 * key);
    /* The doorway itself, as a fill. The lamp alone is a single oblique
       source and it left every front-facing surface at half its own
       albedo — a white name card came back grey, which is not a card in a
       window, it is a stain. So a hemispheric fill goes in, and how much of
       it each material takes is its own: paper drinks it, brushed steel
       takes a third of it, black plastic takes almost none, which is most
       of why those three read as three materials. */
    float amb = 0.32 + 0.68 * clamp(0.45 + 0.55 * nor.y, 0.0, 1.0);
    float lit = clamp(key + amb * ambAmt, 0.0, 1.0);
    /* What the dark end of each material's range IS: a neutral near-black
       with a TINT of the room in it, never the room's colour itself. All
       violet and the plate came back the colour of the wall it is screwed
       to; all neutral and it came back cut out and pasted on. A white card
       takes a fifth of the room, brushed steel an eighth, black plastic a
       twentieth. */
    vec3  dkC = mix(DARKN, uInk, dkRoom);
    vec3  c = mix(mix(base, dkC, dkAmt), base, lit);
    c = mix(c, mix(base, WARMW, ltAmt), smoothstep(0.62, 1.0, key));

    /* The studio, reflected, with the brushed grain streaking it. Anchored
       in WORLD space while the plate is fixed, so the reflection crawls
       across the steel as the camera eases — a still of this reads as a
       photograph of a plate rather than a drawing of one. */
    vec3  ref = reflect(rd, nor);
    ref.y += grain * 0.13;
    vec3  eC  = studio(ref);
    c = mix(c, eC, clamp(mtl * (0.34 + 0.55 * fre), 0.0, 1.0));

    /* Occlusion as a MULTIPLY. Mixing towards uInk instead is a violet
       painted into every reveal on the panel, which is where a third of the
       lavender was hiding. */
    c *= mix(0.42, 1.0, occ);
    /* The lamp's own highlight, ADDED and in the lamp's own colour. */
    c += WARMW * clamp(spc * spAmt, 0.0, 1.4);
    /* And the edge, which is the studio again — a grey plate dissolving
       into a violet wall is the other way this object loses its silhouette. */
    c = mix(c, eC, fre * frAmt);
    /* And the amber, added rather than mixed, because a lamp behind a
       lens is light and not paint. */
    c += emitC * emit * 1.05;

    col = mix(wall, c, cover);
  }

  /* ---------------- the glare ----------------
     What a lit lens does to the air in front of it, drawn on the plane of
     the faceplate so it lies over the plate AND the wall beside it. ONE
     source: the window that stays lit. The four short presses do not get
     one — a glare on every button at once is a Christmas tree, and the
     point of this loop is that one of the five calls was the one that
     mattered.

     The grille used to get a second, an amber annulus over the air round
     the speaker. Together with the ring in the plate underneath it, that is
     what drew the orange halo on a black grille, and there is no lamp on
     this panel for it to be the glare of. Both are gone. */
  float tg = (PZ - ro.z) / min(rd.z, -0.02);
  vec2  gp = (ro + rd * tg).xy;
  vec2  h1p = gp - vec2(WX + 0.10, rowY(1.0));
  float hd = length(h1p * vec2(0.62, 1.0));
  col += AMHOT * gGlowA.y * (exp(-hd * hd * 26.0) * 0.28 + exp(-hd * hd * 2.4) * 0.09);

  /* The exposure comes up with the scene rather than the scene arriving:
     the poster underneath is already this picture, and a fade from an
     empty wall would be a flash. */
  col *= mix(0.90, 1.0, e);

  /* A little tooth, so a wide wash into paper never bands on a cheap
     panel — which is the only sort of panel this will be watched on. */
  col += (hash21(gl_FragCoord.xy + fract(uTime) * 57.0) - 0.5) * 0.016;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export const scene: Scene = {
  frag,
  colors: ["#551a89", "#7c74a6", "#f4f3f7", "#ffffff"],
  /* The panel on its wall, as far as stacked gradients can carry it —
     and they have to carry it, because this is what a reader on a slow
     phone looks at until the shader has compiled and what a device with
     no WebGL is left with for good. Solved at 390x488, the band a phone
     gets, and every layer is sized as a share of the band rather than in
     pixels, so the plate is the same plate on a 21:9 strip and a 4:5
     crop. A background position is measured against the space the layer
     leaves over, which is why none of these percentages is round: each
     one is solved from the edge its shape is meant to land on.

     It carries the SAME four-word answer as the shader, which is the only
     job it has: a neutral steel plate, a black grille and white cards. The
     first cut of this poster had a violet-grey faceplate and lilac cards,
     so a reader on a slow phone got the lavender picture even after the
     shader had stopped drawing it. */
  poster: [
    // The glare off the one window that stays lit.
    "radial-gradient(closest-side, rgba(255,206,140,0.80), rgba(255,170,70,0)) no-repeat 47.2% 40.9% / 36% 22%",
    /* That window itself: amber through a milky lens, hottest in the middle.
       The values are read off the shader's own lit card rather than picked —
       255,255,176 in the middle of it and 255,213,127 at the ends — because a
       poster that is a shade more saturated than the thing it stands in for is
       a reader watching the picture change under them when the shader lands. */
    "radial-gradient(64% 135% at 50% 50%, #ffffb0 0%, #ffd57f 54%, #f5b455 100%) no-repeat 43.0% 42.6% / 27.7% 4.4%",
    // The other four name cards: white card, a little darker down the plate.
    "linear-gradient(#f4ecdf, #e6ddcd) no-repeat 43.0% 36.1% / 27.7% 4.4%",
    "linear-gradient(#ede5d8, #dfd6c7) no-repeat 43.0% 49.0% / 27.7% 4.4%",
    "linear-gradient(#e7dfd3, #d8cfc2) no-repeat 43.0% 55.4% / 27.7% 4.4%",
    "linear-gradient(#e0d8cd, #d1c8bc) no-repeat 43.0% 61.8% / 27.7% 4.4%",
    // The five call buttons, moulded black ABS. The second is the pressed one.
    "radial-gradient(closest-side, #3a3a3e, #17171a) no-repeat 66.8% 36.2% / 5.7% 4.1%",
    "radial-gradient(closest-side, #46372a, #221913) no-repeat 66.8% 42.6% / 5.7% 4.1%",
    "radial-gradient(closest-side, #36363a, #151518) no-repeat 66.8% 49.0% / 5.7% 4.1%",
    "radial-gradient(closest-side, #323236, #131316) no-repeat 66.8% 55.3% / 5.7% 4.1%",
    "radial-gradient(closest-side, #2e2e32, #111114) no-repeat 66.8% 61.7% / 5.7% 4.1%",
    /* The speaker grille: a black drilled insert, and the steel lip round it.
       Nothing goes over it. The poster used to carry an amber talk ring here
       as well, matching a ring the shader drew; both are gone, because the
       grille has no lamp behind it and the halo was invented hardware. */
    "radial-gradient(closest-side, #1b1a18 0%, #201f1c 64%, #403e3a 88%, #9d9a95 95%, rgba(0,0,0,0) 100%) no-repeat 50% 19.8% / 19.6% 15.6%",
    /* The faceplate: brushed steel, lit from the lamp above and to the left.
       Warm-neutral, because that is what the shader measures at 172,167,159 —
       not the cool grey it was first written as and certainly not the
       #a29eb8 / #8b85a8 violet-grey it was before that, which is what a reader
       on a slow phone was looking at while everyone argued about the shader. */
    "linear-gradient(168deg, #d9d6d1 0%, #c6c2bc 32%, #a8a49e 66%, #8d8a84 100%) no-repeat 50% 28.6% / 44.3% 52.1%",
    // The shadow it keeps off the wall, tight, down and right of that lamp.
    "linear-gradient(rgba(58,38,78,0.30), rgba(58,38,78,0.30)) no-repeat 51.6% 30.5% / 44.3% 52.1%",
    // The pool of light over the door, and the wall it lands on.
    "radial-gradient(62% 46% at 28% 12%, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0) 100%)",
    "linear-gradient(to bottom, #a29dc0 0%, #b0abca 22%, #c9c5da 46%, #ebe9f1 72%, #ffffff 90%)",
  ].join(", "),
  alt: "A brushed stainless door entry panel screwed to a wall, seen straight on and close: a black perforated speaker grille at the top, and five black call buttons down the right with a printed white name card in a lit window beside each one. The buttons light one after another in warm amber as residents press them, each fading away over about a second — and one of them stays lit, held, because that call was the one that was answered.",
};
